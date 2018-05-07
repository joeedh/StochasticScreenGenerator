var _mitchell = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _mitchell = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  var MitchellGenerator = exports.MitchellGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.apply(this, arguments);
      
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
    },
    
    function current_level() {
      return 0;
    },
    
    function done() {
      return this._done;
    },
    
    function max_level() {
      return this.maxgen;
    },
    
    function draw(g) {
      MaskGenerator.prototype.draw.call(this, g);
      
      /*
      if (FFT_TARGETING && this.fft_image != undefined) {
        this.fft.raster(this.fft_image);
        this.fft.calc_radial();
        this.fft.draw(g, 180, 350, this.fft_image);
      }
      */
      
      if (!ALIGN_GRID)
        return;
      
      var cf = this.config;
      var size = this.dimen;
      
      g.strokeStyle = "grey";
      
      g.beginPath();
      var dx = 1.0 / size;
      for (var i=0; i<size; i++) {
        g.moveTo(i*dx, 0);
        g.lineTo(i*dx, 1);
        
        g.moveTo(0, i*dx);
        g.lineTo(1, i*dx);
      }
      g.stroke();
    },

    function reset(size, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      util.seed(0);
      
      this.maxgen = 0.0;
      this.points = [];
      this.dimen = size;
      this._done = false;
      
      let totpoint = this.totpoint = ~~(size*size*0.8);
      this.maxpoints = totpoint;
      this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
    },
    
    function step(custom_steps) {
      let steps = custom_steps ? custom_steps : STEPS;
      steps = Math.min(steps, 128);
      
      let ps = this.points;
      let size = this.dimen;
      
      let totpoint = ps.length / PTOT;
      let r = Math.sqrt(0.5 / (Math.sqrt(3)*2*(totpoint+1)));
      
      if (totpoint >= this.maxpoints) {
        this._done = true;
        return;
      }
      
      let sumw, sumtot, x1, y1, r1, mindis, found, off, searchr, minw;
      
      let callback = (pi2) => {
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PD];
        
        let dx = (x1+off[0]) - x2;
        let dy = (y1+off[1]) - y2;
        
        let lsqr = dx*dx + dy*dy;
        
        mindis = Math.min(mindis, lsqr);
        
        let dis = lsqr != 0.0 ? Math.sqrt(lsqr) : 0.0;
        
        let w = Math.max(1.0 - dis/searchr, 0.0);
        //w *= w*w;
        //w = w*w*(3.0 - 2.0*w);
        //w = Math.pow(w, 4.0)*0.25 + Math.pow(w, 6.0)*0.75;
        let fi = 1.0 - ps.length/PTOT/this.maxpoints;
        //fi *= fi;
        fi = fi != 0.0 ? Math.sqrt(fi) : fi;
        
        w *= w*w*w*w;
        //w = Math.pow(w, 1.0 + 6.0*fi); //*0.75 + Math.pow(w, 4.0)*0.25;

        sumw += w;
        sumtot++;
        
        //having the poisson test here helps with performance
        if (lsqr < r*r) {
          found = true;
          return true; //stop kdtree iteration
        }
      };
      let cw = this.mask_img.width;
      let ch = this.mask_img.height;
      
      for (let si=0; si<steps; si++) {
        totpoint = ps.length / PTOT;
        
        if (totpoint >= this.maxpoints) {
          break;
        }
        
        //generation number used to display value in mask
        let gen = (ps.length+PTOT)/PTOT/this.maxpoints;
        
        //gen = Math.sqrt(gen)*0.7 + 0.3*gen;
        
        if (gen != 0.0)
          gen = Math.pow(gen, 0.5)*0.75 + 0.25*gen;
        
        gen *= this.maxpoints;
        
        this.maxgen = this.maxpoints; //Math.max(this.maxgen, gen);
        
        //r = Math.sqrt(0.5 / (Math.sqrt(3)*2*(totpoint+1)));
        r = 0.72 / Math.sqrt(gen+1);
        //r = 0.72 / Math.sqrt(this.maxpoints+1);
        
        let maxdis = -1e17, x=undefined, y=undefined;
        let tries = ~~(totpoint*1.25)+30;
        searchr = r*2.0;
        minw = undefined;
        
        for (let sj=0; sj<tries; sj++) {
          x1 = util.random(), y1 = util.random();
          let pi = ps.length;

          found = false;
          mindis = 1e17;
          sumw=0, sumtot=0;
          
          for (off of _poffs) {
            /*
            for (let pi3=0; pi3<ps.length; pi3 += PTOT) {
              let dx = ps[pi3] - x1 - off[0], dy = ps[pi3+1] - y1 - off[1];
              
              if (dx*dx + dy*dy < searchr*searchr) {
                callback(pi3);
              }
            }
            //*/
            
            this.kdtree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);
          }
          
          if (found) {
            continue;
          }
          
          //if (sumtot == 0.0) continue;
          //sumw /= sumtot;
          if (sumtot != 0.0)
            sumw /= sumtot;
          
          if (isNaN(sumw)) {
            throw new Error("NaN");
          }
          
          if (minw === undefined || sumw <= minw) {
            minw = sumw;
          //if (mindis > maxdis) {
            //maxdis = mindis;
            x = x1;
            y = y1;
          }
        }
        
        if (x === undefined) {
          continue;
        }
        
        let pi = ps.length;
        for (let i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        ps[pi] = x;
        ps[pi+1] = y;
        
        ps[pi+PGEN] = Math.max(gen-0.0345*this.maxgen, 0.0);

        ps[pi+PR] = ps[pi+PR2] = r;
        ps[pi+PD] = ps[pi+PD] = pi/PTOT; //real generation number
        
        this.kdtree.insert(ps[pi], ps[pi+1], pi); 
        
        //this.kdtree.balance();
        this.find_mask_pixel(pi);
      }
      
      console.log("Total points:", this.points.length/PTOT);
      
      this.regen_spatial();
      this.raster();
    }
  ]);
  
  return exports;
});
