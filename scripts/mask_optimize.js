var _mask_optimize = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _mask_optimize = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  exports._seed = 0;
  
  var MaskOptGenerator = exports.MaskOptGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.apply(this, arguments);
      
      this.encode_new_offsets = true;
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
    },
    
    function sample(x, y) {
      let d = x*x + y*y;
      
      d = d != 0.0 ? Math.sqrt(d) : 0.0;
      d = Math.cos(d*26.5)*0.5 + 0.5;
      let th = this._step*0.05;
      let band = Math.cos(th)*x + Math.sin(th)*y;
      
      d = Math.tent(band + this._step*0.05); //Math.floor(y*5)/5);

      return d*0.999 + 0.001;
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

    function reset(size, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.mask_image = mask_image;
      util.seed(exports._seed++);
      
      this.mpoints = [];
      this.points = [];
      this.dimen = size;
      this._done = false;
      this._step = 0;
      
      this.repeat = 2;
      
      let totpoint = this.totpoint = ~~(size*size);
      this.maxpoints = totpoint;
      this.maxgen = 1.0;
      
      this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint))/this.repeat;
      let ps = this.points, mps = this.mpoints;
      
      for (let i=0; i<totpoint; i++) {
        let x = util.random()/this.repeat, y = util.random()/this.repeat;
        
        let pi = mps.length;
        
        for (let j=0; j<PTOT; j++) {
          mps.push(0);
        }
        
        mps[pi] = x;
        mps[pi+1] = y;
        
        mps[pi+PIX] = ~~(x*this.repeat*mask_image.width);
        mps[pi+PIY] = ~~(y*this.repeat*mask_image.height);
        
        mps[pi+PR] = mps[pi+PR2] = this.r;
        mps[pi+PGEN] = i/totpoint;
      }
      
      this.retile();
    },
    
    function retile() {
      this.points = [];
      let mps = this.mpoints, ps = this.points, mask_image = this.mask_image;
      
      let totpoint = this.repeat*this.repeat*this.mpoints.length/PTOT;
      
      for (let i=0; i<this.repeat; i++) {
        for (let j=0; j<this.repeat; j++) {
          for (let k=0; k<mps.length; k += PTOT) {
            let pi = ps.length;
            
            let x = mps[k] + i/this.repeat, y = mps[k+1] + j / this.repeat;
            
            let d = this.sample(x, y);
            
            if (1.0-d < mps[k+PGEN]) {
              continue;
            }
            
            for (let l=0; l<PTOT; l++) {
              ps.push(mps[k+l])
            }
            
            let fac = 1.0 - d;
            fac = Math.pow(fac, 3.0);
            
            ps[pi] += mps[k+POFFX] * fac;
            ps[pi+1] += mps[k+POFFY] * fac;
            
            ps[pi] += i / this.repeat;
            ps[pi+1] += j / this.repeat;
            
            if (isNaN(ps[pi]) || isNaN(ps[pi+1])) {
              throw new Error("NaN5");
            }
            
            ps[pi+PD] = mps[pi+PGEN];
            ps[pi+PR] = 0.9 / Math.sqrt(totpoint*d);
            
            ps[pi+POLDX] = ps[pi];
            ps[pi+POLDY] = ps[pi+1];
            
            ps[pi+PIX] = ~~(mps[k]*this.repeat*mask_image.width);
            ps[pi+PIY] = ~~(mps[k+1]*this.repeat*mask_image.height);
            
            //put reference to original point in pdx
            ps[pi+PDX] = k;
          }
        }
      }
      
      this.regen_spatial();
      this.raster();
    },
    
    function step() {
      for (let i=0; i<7; i++) {
        this.relax();
      }
      
      this.calc_offsets();
      
      this.retile();
      this._step++;
    },

    function calc_offsets() {
      let ps = this.points, mps = this.mpoints;
      
      //zero summation fields
      for (let mi=0; mi<mps.length; mi += PTOT) {
        mps[mi+PDX] = mps[mi+PDY] = mps[mi+POLDX] = 0;
      }
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let mi = ps[pi+PDX];
        
        let dx = ps[pi] - ps[pi+POLDX];
        let dy = ps[pi+1] - ps[pi+POLDY];
        
        if (isNaN(dx) || isNaN(dy)) {
          console.log(dx, dy, mi, ps[pi], ps[pi+1]);
          throw new Error("NaN4");
        }
        
        mps[mi+PDX] += dx;
        mps[mi+PDY] += dy;
        mps[mi+POLDX]++;
      }
      
      for (let mi=0; mi<mps.length; mi += PTOT) {
        if (mps[mi+POLDX] == 0.0) {
          mps[mi+PDX] = mps[mi+PDY] = mps[mi+POLDX] = 0.0;
          continue;
        }
        
        let dx = mps[mi+PDX] / mps[mi+POLDX];
        let dy = mps[mi+PDY] / mps[mi+POLDX];
        
        if (isNaN(dx) || isNaN(dy)) {
          console.log(dx, dy, mps[mi+POLDX], mi, mps[mi+PDX]);
          throw new Error("NaN3");
        }
        
        mps[mi] += dx;
        mps[mi+1] += dy;
        
        mps[mi+POX] = dx;
        mps[mi+POY] = dy;
        
        mps[mi+PIX] = ~~(mps[mi]*this.repeat*this.mask_image.width);
        mps[mi+PIY] = ~~(mps[mi+1]*this.repeat*this.mask_image.height);
        
        mps[mi+PDX] = mps[mi+PDY] = mps[mi+POLDX] = 0.0;
      }
      
      //now compute lower-level offsets
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let x = ps[pi], y = ps[pi+1];

        let mi = ps[pi+PDX];
        let mdx = mps[mi+POX];
        let mdy = mps[mi+POY];
        
        let dx = x - ps[pi+POLDX];
        let dy = y - ps[pi+POLDY];
        
        dx -= mdx;
        dy -= mdy;
        
        let fac = 1.0 - this.sample(x, y);
        
        fac = Math.pow(fac, 1.0/3.0);
        //fac = Math.pow(fac, 3.0);
        
        if (isNaN(fac) || isNaN(x) || isNaN(y)) {
          console.log(fac, x, y);
          console.log(mps[mi], mps[mi+1]);
          
          throw new Error("NaN2");
        }
        
        mps[mi+PDX] += dx * fac;
        mps[mi+PDY] += dy * fac;
        mps[mi+POLDX] += fac;
      }
      
      for (let mi=0; mi<mps.length; mi += PTOT) {
        if (mps[mi+POLDX] == 0.0) {
          continue;
        }
        
        let dx = mps[mi+PDX] / mps[mi+POLDX];
        let dy = mps[mi+PDY] / mps[mi+POLDX];
        
        if (isNaN(dx) || isNaN(dy)) {
          console.log(mps[mi+POLDX]);
          
          throw new Error("NaN");
        }
        
        mps[mi + POFFX] = dx;
        mps[mi + POFFY] = dy;
      }
    },
    
    function relax() {
      //console.log("warning, default implementation");
      
      var cf = this.config;
      var sumtot, sumx, sumy, searchrad;
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 2.5;
      var msize = this.mask_img.width;
      
      var curgen = this.current_level();
      curgen = this.hlvl;
      
      var maxgen = this.max_level();
      var hist = new Float64Array(255);
      hist.fill(0, 0, hist.length);
      
      for (var i=0; i<plen; i += PTOT) {
        var gen = ps[i+PGEN] / maxgen;
        var ri = ~~(gen*255*0.999999);
        hist[ri]++
      }
      
      var sum = 0;
      for (var i=0; i<hist.length; i++) {
        sum += hist[i];
        hist[i] = sum;
      }
      for (var i=0; i<hist.length; i++) {
        hist[i] /= sum;
      }      
      
      window.hist = hist;
      
      function callback(pi) {
        var x2 = ps[pi], y2 = ps[pi+1], r2=ps[pi+PR];
        var gen2 = ps[pi+PGEN];
        
        x2 -= _poffs[j][0];
        y2 -= _poffs[j][1];
        
        if (pi == i) {
          return;
        }
        
        var dx = x2-x, dy = y2-y;
        var dis = dx*dx + dy*dy;

        if (isNaN(dis)) {
          console.log("dis was NaN!", dx, dy);
          throw new Error("NaN!");
        }
        
        if (isNaN(r1) || isNaN(r2)) {
          console.log("NaN!", r1, r2);
          throw new Error("NaN!");
        }
        
        if (dis == 0 || dis > searchrad*searchrad) {
          return;
        }
        
        dis = Math.sqrt(dis);
        var r3 = Math.max(r2, r1);
        
        var w = 1.0 - dis/searchrad;
        
        w = cf.SPH_CURVE.evaluate(w);
        
        if (w < 0.0 || w > 1.0 || isNaN(w)) {
          console.log("Bad weight!", w);
          
          if (isNaN(w)) {
            throw new Error("W NaN!");
          }
        }
        
        dx /= dis;
        dy /= dis;
        
        if (isNaN(dis)) {
          throw new Error("dis nan!");
        }
        
        var fx = x - dx*r3;
        var fy = y - dy*r3;
        
        if (isNaN(fx) || isNaN(fy)) {
          console.log("fx, fy", fx, fy, dx, dy, r3);
          throw new Error("NaN");
        }
        
        sumx += w*fx;
        sumy += w*fy;
        sumtot += w;
      }
      
      var totpoint = plen / PTOT;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR];
        var gen1 = ps[i+PGEN];
        var hgen1 = ps[i+PD];
        
        if (cf.GEN_MASK) {
          var f1 = ~~((gen1/maxgen)*255*0.99999);
          f1 = hist[f1];
        } else {
          f1 = gen1/maxgen;
        }
        
        searchrad = r1*searchfac;
        sumtot=1, sumx=x, sumy=y;
        
        if (searchrad == 0.0) {
          continue;
        }
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, searchrad, callback, this);
        }
        
        if (sumtot == 0.0) {
          continue;
        }
        
        sumx /= sumtot;
        sumy /= sumtot;
        
        var fac = 0.5; //cf.GEN_MASK ? 1.0 / (0.5 + f1*f1) : 1.0;
        
        if (isNaN(sumx) || isNaN(sumy) || isNaN(sumtot)) {
          console.log(sumx, sumy, sumtot);
          //throw new Error("NaN6");
          continue;
        }
        
        ps[i] += (sumx - ps[i])*cf.SPH_SPEED*fac;
        ps[i+1] += (sumy-ps[i+1])*cf.SPH_SPEED*fac;
          
        //ps[i] = Math.fract(ps[i]);
        //ps[i+1] = Math.fract(ps[i+1]);
        ps[i] = Math.min(Math.max(ps[i], 0), 1);
        ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        //ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        //ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
      
      this.regen_spatial();
      this.raster();
    },

    function raster() {
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[1] = 0;
      this.mask[3] = SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      //if (this.config.SMALL_MASK) {
      //  this.assign_mask_pixels();
      //} else {
        //this.mask[0] = this.mask[1] = this.mask[2] = 0;
        //this.mask[1] = 255;
        //this.mask[3] = SMALL_MASK ? 255 : 0;
        
        var iview = new Int32Array(this.mask.buffer);
        iview.fill(iview[0], 0, iview.length);
        //console.log("raster!");
        
        for (var pi=0; pi<this.mpoints.length; pi += PTOT) {
          this.raster_point(pi, this.mpoints);
        }
      //}
    },
  ]);
  
  return exports;
});
