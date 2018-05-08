var _mitchell = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _mitchell = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  let config = exports.config = {
    MITCHELL_POISSON_TEST : true,
    MITCHELL_FILTERWID : 2.0,
    MITCHELL_STEPSMUL   : 2.0,
    MITCHELL_BRIGHTNESS : 1.0,
    MITCHELL_CURVE     : new cconst.EditableCurve("Mitchell Filter Curve", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.6749999999999999,"1":0,"eid":25,"flag":0,"deg":3,"tangent":1},{"0":0.8374999999999999,"1":0,"eid":21,"flag":0,"deg":3,"tangent":1},{"0":0.9250000000000002,"1":0.7875,"eid":24,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":26}}),
    MITCHELL_GEN_CURVE : new cconst.EditableCurve("Mitchell Tone Curve", {"points":[{"0":0.012500000000000039,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.05625000000000008,"1":0.09375,"eid":20,"flag":0,"deg":3,"tangent":1},{"0":0.21249999999999988,"1":0.36875000000000013,"eid":21,"flag":1,"deg":3,"tangent":1},{"0":0.6062500000000001,"1":0.675,"eid":19,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":22}})
  };
  
  sinterface.MaskConfig.registerConfig(config);
  
  var MitchellGenerator = exports.MitchellGenerator = class MitchellGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
    }
    
    static build_ui(gui) {
      let panel2 = gui.panel("Mitchell");
      
      panel2.slider('MITCHELL_FILTERWID', 'Filter Width', 2.0, 0.0001, 5.0, 0.001, false, false);
      panel2.slider('MITCHELL_BRIGHTNESS', 'Brightness', 2.0, 0.0001, 5.0, 0.001, false, false);
      panel2.slider('MITCHELL_STEPSMUL', 'Extra Steps', 1.0, 0.0001, 35.0, 0.001, false, false);
      panel2.check('MITCHELL_POISSON_TEST', "Poisson Mode");
      
      let panel3 = panel2.panel("Filter Curve");
      
      //need to finish config refactor so I'm not putting things in window in such a hackish way as this
      window.MITCHELL_CURVE = panel3.curve("MITCHELL_CURVE", "Filter Curve", cconst.DefaultCurves.MITCHELL_CURVE).curve;

      panel3 = panel2.panel("Pre-tone Curve");
      window.MITCHELL_GEN_CURVE = panel3.curve("MITCHELL_GEN_CURVE", "Tone Curve", cconst.DefaultCurves.MITCHELL_GEN_CURVE).curve;
      
      panel3.close();
      panel2.close();
    }
    
    current_level() {
      return 0;
    }
    
    done() {
      return this._done;
    }
    
    max_level() {
      return this.maxgen;
    }
    
    draw(g) {
      super.draw(g);
      
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
    }

    reset(size, appstate, mask_image) {
      super.reset(size, appstate, mask_image);
      
      util.seed(0);
      
      this.maxgen = 0.0;
      this.points = [];
      this.dimen = size;
      this._done = false;
      
      let totpoint = this.totpoint = ~~(size*size*0.95);
      this.maxpoints = totpoint;
      
      //XXX am I using this particular radius calculation? or overriding it somewhere?
      this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
    }
    
    step(custom_steps) {
      let steps = custom_steps ? custom_steps : STEPS;
      steps = Math.min(steps, 128);
      
      let ps = this.points;
      let size = this.dimen;
      
      let cf = this.config;
      let searchfac = cf.MITCHELL_FILTERWID;
      
      let totpoint = ps.length / PTOT;
      //let r = Math.sqrt(0.5 / (Math.sqrt(3)*2*(totpoint+1)));
      let r;
      
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
        
        //let fi = 1.0 - ps.length/PTOT/this.maxpoints;
        //fi *= fi;
        //fi = fi != 0.0 ? Math.sqrt(fi) : fi;
        
        w = cf.MITCHELL_CURVE.evaluate(w);
        
        //w = Math.pow(w, 1.0 + 6.0*fi); //*0.75 + Math.pow(w, 4.0)*0.25;

        sumw += w;
        sumtot++;
        
        //having the poisson test here helps with performance
        if (cf.MITCHELL_POISSON_TEST && lsqr < r*r) {
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
        let gen = (ps.length/PTOT+1)/this.maxpoints;
        
        //gen = Math.sqrt(gen)*0.7 + 0.3*gen;
        
        //if (gen != 0.0)
        //  gen = Math.pow(gen, 0.5)*0.75 + 0.25*gen;
        if (gen < 0 || gen > 1.0) {
          throw new Error("Gen was: " + gen);
        }
        
        gen *= this.maxpoints;
        
        this.maxgen = this.maxpoints; //Math.max(this.maxgen, gen);
        
        //r = Math.sqrt(0.5 / (Math.sqrt(3)*2*(totpoint+1)));
        r = 0.75 / Math.sqrt(gen+1);
        //r = 0.72 / Math.sqrt(this.maxpoints+1);
        
        let maxdis = -1e17, x=undefined, y=undefined;
        let tries = ~~(totpoint*cf.MITCHELL_STEPSMUL)+30;
        searchr = r*searchfac;
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

        //gen will be set in tonePoints()
        //ps[pi+PGEN] = gen;

        ps[pi+PR] = ps[pi+PR2] = r;
        ps[pi+PD] = ps[pi+POGEN] = pi/PTOT; //real generation number
        
        this.kdtree.insert(ps[pi], ps[pi+1], pi); 
        
        //this.kdtree.balance();
        this.find_mask_pixel(pi);
      }
      
      console.log("Total points:", this.points.length/PTOT);
      
      this.regen_spatial();
      this.raster();
      this.tonePoints();
    }
    
    tonePoints() {
      let ps = this.points;
      let cf = this.config;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+POGEN]/this.maxgen;
        let d = 0.3; //stupid hack to fix cut off error
        
        ps[pi+PGEN] = cf.MITCHELL_GEN_CURVE.evaluate(gen)*this.maxgen*MITCHELL_BRIGHTNESS;
      }
    }
    
    raster() {
      this.tonePoints();
      super.raster();
    }
  };
  
  return exports;
});
