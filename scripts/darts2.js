var _darts2 = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _darts2 = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  var Darts2Generator = exports.Darts2Generator = class Darts2Generator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
    }
    
    next_level() {
      if (this.level < this.levels.length) {
        for (let i=0; i<1; i++) {
          //this.relax();
        }
        
        this.level_r_decay = 1;
        this.level++;
      }
    }
    
    current_level() {
      return this.level;
    }
    
    done() {
      return this.level >= this.levels.length;
    }
    
    max_level() {
      return this.levels.length;
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
      
      this.level = 0;
      this.level_r_decay = 1;
      
      this.points = [];
      this.dimen = size;
      
      let totpoint = this.totpoint = ~~(size*size*0.85);
      this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
      
      //this.final_r = 1.0 / (Math.sqrt(1.5)*size);
      
      let levels = this.levels = new Array(HIEARCHIAL_LEVELS);
      let sumlevels = this.sumlevels = new Array(HIEARCHIAL_LEVELS);
      let totlevel = 0, level;
      
      let pw = Math.pow(HIEARCHIAL_SCALE, 1.0 / levels.length);
      window.pw = pw;
      
      level = pw;
      
      for (let i=0; i<levels.length; i++) {
        this.levels[i] = level;
        
        totlevel += level;
        
        level *= pw; //1.0 + 1.0/HIEARCHIAL_SCALE;
      }
      
      let sum = 0;
      for (let i=0; i<levels.length; i++) {
        level = Math.ceil((this.levels[i] / totlevel)*totpoint);
        level = Math.max(level, 1);
        
        this.levels[i] = level;
        sum += level;
        
        this.sumlevels[i] = sum;
      }
    }
    
    step(custom_steps, noreport) {
      let steps = custom_steps === undefined ? STEPS : custom_steps;
      let ps = this.points;
      let size = this.dimen;
      
      //this.final_r = 1.0 / (Math.sqrt(1.5)*size);
      //let r1 = 1.0 / (Math.sqrt(1.5)*size);
      
      if (this.level >= this.levels.length) {
        return;
      }
      
      let totpoint = this.sumlevels[this.level]+1;
      //let totpoint = this.sumlevels[Math.max(this.level-1, 0)];
      
      let r1 = 2.35*Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint))*this.level_r_decay;
      let levelr = 2.35*Math.sqrt(0.5 / (Math.sqrt(3)*2*(this.levels[this.level]+1)))*this.level_r_decay;
      
      console.log("R", r1, levelr, this.level);
      
      if (this.level_r_decay > 0.6) {
        this.level_r_decay *= 0.995;
        console.log("this.level_r_decay:", this.level_r_decay.toFixed(4));
      }
      
      let cw = this.mask_img.width;
      let ch = this.mask_img.height;
      
      for (let si=0; si<steps; si++) {
        if (ps.length/PTOT > this.sumlevels[this.level]) {
          console.log("Automatic next level!");

          if (!noreport) {
            this.report("Automatic next level!");
          }
          
          this.next_level();
        //  break;
        }
        
        let x1 = Math.random(), y1 = Math.random();
        let pi = ps.length;

        let found = false;
        let mindis = 10000;
        
        for (let off of _poffs) {
          this.kdtree.forEachPoint(x1+off[0], y1+off[1], levelr*3, (pi2) => {
            let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+2], gen2 = ps[pi2+PD];
            
            let dx = (x1+off[0]) - x2;
            let dy = (y1+off[1]) - y2;
            
            let lsqr = dx*dx + dy*dy;
            
            if (lsqr < levelr*levelr && gen2 == this.level) {
              found = true;
              
              if (!window.LIMIT_DISTANCE)
                return true; //stop kdtree iteration
            }
            
            if (window.LIMIT_DISTANCE) {
              mindis = Math.min(mindis, lsqr);
            }
            
            if (lsqr < r1*r1) {
              found = true;
              
              if (!window.LIMIT_DISTANCE)
                return true; //stop kdtree iteration
            }
          });
          
          if (window.LIMIT_DISTANCE && mindis != 10000) {
            let r3 = r1 + r1*DISTANCE_LIMIT;
            
            if (mindis > r3*r3) {
              found = true;
            }
          }
          
          if (found) {
            break;
          }
        }
        
        if (found) {
          continue;
        }
        
        for (let i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        ps[pi] = x1;
        ps[pi+1] = y1;
        
        ps[pi+PR] = ps[pi+PR2] = levelr;
        ps[pi+PD] = ps[pi+PD] = this.level; //real generation number
        
        //generation number used to display value in mask
        
        let d = (this.level / this.levels.length);
        
        //d = d*d*d*0.5 + d*0.5;
        //d = 1.0-Math.pow(1.0-d, 2.0);
        d = Math.pow(d, 5.0)*0.75 + 0.25*d;
        ps[pi+PGEN] = d*this.levels.length;
        
        //ps[pi+PIX] = ~~(x1*cw*0.99999);
        //ps[pi+PIY] = ~~(y1*ch*0.99999);
        
        this.kdtree.insert(ps[pi], ps[pi+1], pi); 
        this.find_mask_pixel(pi);
      }
      
      this.regen_spatial();
      this.raster();
      
      if (!noreport) {
        this.report("number of points:", this.points.length/PTOT);
        this.report("current level:", this.level, "of", this.levels.length);
      }
    }
  }
  
  return exports;
});
