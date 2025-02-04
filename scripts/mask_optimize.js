var _mask_optimize = undefined;

define([
  "util", "const", "interface", "fft", "void_cluster", "sph"
], function(util, cconst, sinterface, fft, voidcluster, sph) {
  'use strict';
  
  var exports = _mask_optimize = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  exports._seed = 0;
  
  let config = {
    MASKOPT_REPEAT        : 2,
    MASKOPT_SPEED         : 1.0,
    MASKOPT_RELAX_STEPS   : 7,
    MASKOPT_FILTERWID     : 2.5,
    MASKOPT_GENSTART      : 0.1,
    MASKOPT_ROTATION      : true,
    MASKOPT_LEVEL_OFFSETS : true,
    MASKOPT_PATT_SIZE     : 1.0,
    MASKOPT_OFFSET_POWER  : 1.0,
    MASKOPT_DO_OFFSET_POWER : true,
    MASKOPT_ROT_SPEED     : 1.0,
    MASKOPT_TONECURVE     : new cconst.EditableCurve("MO Tone Curve"),
    MASKOPT_TOTPOINT_MUL  : 0.8
  };
  
  var MaskOptGenerator = exports.MaskOptGenerator = class MaskOptGenerator extends MaskGenerator{
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.encode_new_offsets = true;
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
    }
    
    static build_ui(gui) {
      var panel2 = gui.panel("Mask Optimize");

      
      panel2.slider("MASKOPT_TOTPOINT_MUL", "PointsMul", 0.8, 0.001, 1.0, 0.001, false, false);
      
      panel2.slider("MASKOPT_REPEAT", "Repeat", 2, 1, 24, 1, true, false);
      panel2.slider("MASKOPT_RELAX_STEPS", "Relax Steps", 7, 0, 48, 1, true, false);
      panel2.slider("MASKOPT_SPEED", "Speed", 1, 0, 7, 0.001, false, false);
      panel2.slider("MASKOPT_FILTERWID", "Filter Wid", 2.5, 0, 12, 0.001, false, false);
      panel2.slider("MASKOPT_GENSTART", "genstart", 0.1, 0, 1.0, 0.001, false, false);
      
      panel2.slider("MASKOPT_PATT_SIZE", "Pattern Size", 1.0, 0, 10.0, 0.001, false, false);
      
      panel2.check("MASKOPT_ROTATION", "Enable Rotation");
      panel2.slider("MASKOPT_ROT_SPEED", "Rotation Speed", 1.0, 0, 10.0, 0.001, false, false);
      
      panel2.check("MASKOPT_LEVEL_OFFSETS", "Toning Offsets");
      panel2.slider("MASKOPT_OFFSET_POWER", "Off Power", 1.0, -3.0, 9.0, 0.001, false, false);
      panel2.check("MASKOPT_DO_OFFSET_POWER", "OffsLvlPower");
      
      let panel3 = panel2.panel("Tone Curve");
      window.MASKOPT_TONECURVE = panel3.curve("MASKOPT_TONECURVE", "Tone Curve").curve;
      panel3.close();
      
      panel2.close();
    }
    
    sample(cf, x, y) {
      //return 0.01;
      x *= MASKOPT_PATT_SIZE;
      y *= MASKOPT_PATT_SIZE;
      
      let d = x*x + y*y;
      
      d = d != 0.0 ? Math.sqrt(d) : 0.0;
      d = Math.cos(d*26.5)*0.5 + 0.5;
      
      let th = this._step*0.05*cf.MASKOPT_ROT_SPEED;
      
      let band = Math.cos(th)*x + Math.sin(th)*y;
      let band2 = Math.cos(th+Math.PI*0.5)*x + Math.sin(th+Math.PI*0.5)*y;
      
      d = Math.tent(band + this._step*0.05*cf.MASKOPT_ROT_SPEED); //Math.floor(y*5)/5);
      let d2 = Math.tent(band2 + this._step*0.05*cf.MASKOPT_ROT_SPEED); //Math.floor(y*5)/5);

      //d = Math.max(d, d2);
      //d = Math.sqrt(d*d2);
      d = Math.sqrt(d*d + d2*d2) / Math.sqrt(2.0);
      
      return d*0.999 + 0.001;
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

    throw(config) {
      let size2 = this.size2;
      
      let cf = config;
      let ps = this.points, mps = this.mpoints;
      let totpoint = this.totpoint;
      let mask_image = this.mask_img;
      
      for (let _i=0; _i<size2*size2; _i++) {
        if (this.points.length/PTOT >= totpoint) {
          break;
        }
        
        //let i = ~~(Math.random()*totpoint*0.9999999999);
        let i = _i;
        let ix = i % size2, iy = ~~(i / size2);
        
        let x = (ix + util.random()*0.0 + 0.5)/size2, y = (iy + util.random()*0.0 + 0.5)/size2;
        
        let pi = mps.length;
        
        for (let j=0; j<PTOT; j++) {
          mps.push(0);
        }
        
        mps[pi] = x;
        mps[pi+1] = y;
        
        mps[pi+PIX] = ~~(x*mask_image.width);
        mps[pi+PIY] = ~~(y*mask_image.height);
        
        mps[pi+PR] = mps[pi+PR2] = 0.9 / Math.sqrt(i + totpoint*MASKOPT_GENSTART);
        mps[pi+PGEN] = Math.fract(ix*1.37432 + iy*0.623); ;//i/totpoint;
      }
      
    }
    
    throw_vc(config) {
      let cf = config.copy();
      
      let size2 = this.size2;
      
      let vc = new voidcluster.VoidClusterGenerator(this.appstate);
      vc.config = cf;
      vc.reset(size2, this.appstate, this.mask_img);
      
      for (let i=0; !vc.done() && i<2000; i++) {
        vc.step();
      }
      
      let mps = this.mpoints = vc.points;
      for (let mpi=0; mpi<mps.length; mpi += PTOT) {
        mps[mpi+PGEN] /= vc.maxgen;
      }
      
      this.mpoints = vc.points;
      this.regen_spatial();
    }
    
    reset(size, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.mask_image = mask_image;
      util.seed(exports._seed++);
      
      this.mpoints = [];
      this.dimen = size;
      this._done = false;
      this._step = 0;
      
      this.repeat = MASKOPT_REPEAT;
      
      let size2 = this.size2 = Math.ceil(Math.sqrt(size*size*this.config.MASKOPT_TOTPOINT_MUL));
      
      let totpoint = this.totpoint = ~~(size2*size2);
      this.maxpoints = totpoint;
      this.maxgen = 1.0;
      
      this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint))/this.repeat;
      
      this.throw_vc(this.config);
      
      this.retile(this.config);
    }
    
    retile(cf) {
      this.points.length = 0;
      let mps = this.mpoints, ps = this.points, mask_image = this.mask_image;
      
      let totpoint = this.repeat*this.repeat*this.mpoints.length/PTOT;
      
      for (let i=0; i<this.repeat; i++) {
        for (let j=0; j<this.repeat; j++) {
          for (let k=0; k<mps.length; k += PTOT) {
            let pi = ps.length;
            
            let x = mps[k]/this.repeat + i/this.repeat, y = mps[k+1]/this.repeat + j/this.repeat;
            
            let d = this.sample(cf, x, y);
            d *= 0.98;
            
            if (1.0-d < mps[k+PGEN]) {
              continue;
            }
            
            for (let l=0; l<PTOT; l++) {
              ps.push(mps[k+l])
            }
            
            let fac;
            
            if (cf.MASKOPT_DO_OFFSET_POWER) {
              fac = 1.0 - d;
              fac = Math.pow(fac, cf.MASKOPT_OFFSET_POWER);
            } else {
              fac = 1.0;
            }
            
            if (cf.MASKOPT_LEVEL_OFFSETS) {
              ps[pi] += mps[k+POFFX] * fac;
              ps[pi+1] += mps[k+POFFY] * fac;
            }
            
            ps[pi] = (ps[pi] + i) / this.repeat;
            ps[pi+1] = (ps[pi+1] + j) / this.repeat;
            
            if (isNaN(ps[pi]) || isNaN(ps[pi+1])) {
              throw new Error("NaN5");
            }
            
            let final_r = 0.9 / Math.sqrt(totpoint);
            let max_r = final_r*7.0;
            
            d = MASKOPT_TONECURVE.evaluate(d);
            
            let pr = final_r + (max_r - final_r) * d;
            
            //pr = final_r;
            ps[pi+PD] = mps[pi+PGEN];
            ps[pi+PR] = pr;
            ps[pi+PR] = 0.8 / Math.sqrt(totpoint*(1.0-d) + totpoint*MASKOPT_GENSTART);
            
            ps[pi+POLDX] = ps[pi];
            ps[pi+POLDY] = ps[pi+1];
            
            ps[pi+PIX] = ~~(mps[k]*mask_image.width);
            ps[pi+PIY] = ~~(mps[k+1]*mask_image.height);
            
            //put reference to original point in pdx
            ps[pi+PD] = k;
          }
        }
      }
      
      this.regen_spatial();
      this.raster();
    }
    
    step() {
      let cf = this.config;
      
      for (let i=0; i<cf.MASKOPT_RELAX_STEPS; i++) {
        this.relax();
      }
      
      this.calc_offsets(this.config);
      
      this.retile(this.config);
      
      if (this.config.MASKOPT_ROTATION) {
        this._step++;
      }
    }

    calc_offsets(cf) {
      let ps = this.points, mps = this.mpoints;
      
      //zero summation fields
      for (let mi=0; mi<mps.length; mi += PTOT) {
        mps[mi+PDX] = mps[mi+PDY] = mps[mi+POLDX] = 0;
      }
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let mi = ps[pi+PD];
        
        let dx = ps[pi] - ps[pi+POLDX];
        let dy = ps[pi+1] - ps[pi+POLDY];
        
        if (isNaN(dx) || isNaN(dy)) {
          console.log(dx, dy, mi, ps[pi], ps[pi+1]);
          throw new Error("NaN4");
        }
        
        mps[mi+PDX] += dx*this.repeat;
        mps[mi+PDY] += dy*this.repeat;
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
        
        //dx = dy = 0;
        
        mps[mi] += dx;
        mps[mi+1] += dy;
        
        mps[mi+POX] = dx;
        mps[mi+POY] = dy;
        
        mps[mi+PIX] = ~~(mps[mi]*this.mask_image.width);
        mps[mi+PIY] = ~~(mps[mi+1]*this.mask_image.height);
        
        mps[mi+PDX] = mps[mi+PDY] = mps[mi+POLDX] = 0.0;
      }
      
      //now compute lower-level offsets
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let x = ps[pi], y = ps[pi+1];

        let mi = ps[pi+PD];
        
        let mdx = mps[mi+POX];
        let mdy = mps[mi+POY];
        
        let ix = Math.floor(x * this.repeat);
        let iy = Math.floor(y * this.repeat);
        
        let mx = (mps[mi] + ix)/this.repeat;
        let my = (mps[mi+1] + iy)/this.repeat;
        
        let dx = x - mx;
        let dy = y - my;
        
        //*
        dx = (x - ps[pi+POLDX]) - mdx;
        dy = (y - ps[pi+POLDY]) - mdy;
        //dx *= this.repeat;
        //dy *= this.repeat;
        //*/        
        
        //dx -= mdx;
        //dy -= mdy;
        
        let fac;
        
        if (cf.MASKOPT_DO_OFFSET_POWER) {
          fac = 1.0 - this.sample(cf, x, y);
          fac = Math.pow(fac, 1.0/cf.MASKOPT_OFFSET_POWER);
        } else {
          fac = 1.0;
        }
        
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
    }
    
    relax() {
      this.report("relaxing");
      //console.log("warning, default implementation");
      
      var cf = this.config;
      var sumtot, sumdx, sumdy, searchrad;
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = MASKOPT_FILTERWID;
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
        
        let searchr2 = r2*searchfac;
        //let searchr2 = searchrad;
        
        x2 -= _poffs[j][0];
        y2 -= _poffs[j][1];
        
        if (pi == i) {
          return;
        }
        
        var dx = x-x2, dy = y-y2;
        var dis = dx*dx + dy*dy;

        if (isNaN(dis)) {
          console.log("dis was NaN!", dx, dy);
          throw new Error("NaN!");
        }
        
        if (isNaN(r1) || isNaN(r2)) {
          console.log("NaN!", r1, r2);
          throw new Error("NaN!");
        }
        
        if (dis > searchr2*searchr2) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        var w = 1.0 - dis/searchr2;
        
        w = Math.pow(w, 8.0);
        
        sumdx += w*dx;
        sumdy += w*dy;
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
        sumtot = sumdx = sumdy = 0.0;
        
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
        
        sumdx /= sumtot;
        sumdy /= sumtot;
        
        var fac = MASKOPT_SPEED*0.125;//*r1*Math.sqrt(this.totpoint);
        
        if (isNaN(sumdx) || isNaN(sumdy) || isNaN(sumtot)) {
          console.log(sumdx, sumdy, sumtot);
          //throw new Error("NaN6");
          continue;
        }
        
        ps[i] += sumdx*cf.SPH_SPEED*fac;
        ps[i+1] += sumdy*cf.SPH_SPEED*fac;
          
        //ps[i] = Math.fract(ps[i]);
        //ps[i+1] = Math.fract(ps[i+1]);
        ps[i] = Math.min(Math.max(ps[i], 0), 0.999999);
        ps[i+1] = Math.min(Math.max(ps[i+1], 0), 0.99999);
        
        //ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        //ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
      
      this.regen_spatial();
      this.raster();
      
      this.report("done relaxing");
    }
    
    raster() {
      this.raster_mask(0);
    }
    
    raster_mask(mi) {
      //var iview = new Int32Array(this.masks[mi].mask.buffer);
      //iview.fill(iview[0], 0, iview.length);
      
      //if (this.config.SMALL_MASK) {
      //  this.assign_mask_pixels(mi);
      //} else {
        
        var iview = new Int32Array(this.masks[mi].mask.buffer);
        iview[0] = 0;
        iview.fill(iview[0], 0, iview.length);
        //console.log("raster!");
        
        for (var mpi=0; mpi<this.mpoints.length; mpi += PTOT) {
          this.raster_point(mi, mpi, this.mpoints);
        }
      //}
    }
  };

  sinterface.MaskGenerator.register(config, MaskOptGenerator, "MASKOPT", 5);
  
  return exports;
});
