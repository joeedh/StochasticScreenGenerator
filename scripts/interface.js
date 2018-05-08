var _interface = undefined;

define([
  "util", "const", "kdtree", "report"
], function(util, cconst, kdtree, reportfunc) {
  'use strict';
  
  var exports = _interface = {};
  var Class = util.Class;
  
  exports._configs = [];
  
  var MaskConfig = exports.MaskConfig = class MaskConfig {
    constructor() {
      this.update();
      
      this.RELAX_CURRENT_LEVEL = false;
    }
    
    static registerConfig(cfg) {
      exports._configs.push(cfg);
      cconst.registerConfig(cfg);
    }

    update() {
      for (let cfg of exports._configs) {
        for (let k in cfg) {
          this[k] = window[k]; //need to update config system to not use window
        }
      }
      
      this.USE_TONE_CURVE = USE_TONE_CURVE;
      this.CMYK = CMYK;
      this.GEN_MASK = GEN_MASK;
      this.FFT_TARGETING = FFT_TARGETING;
      
      this.RADIUS_CURVE = RADIUS_CURVE;
      this.TONE_CURVE = TONE_CURVE;
      this.SPH_CURVE = SPH_CURVE;
      this.FFT_CURVE = FFT_CURVE;
      this.VOIDCLUSTER_MID_R = VOIDCLUSTER_MID_R;
      
      this.VOID_HEX_MODE = VOID_HEX_MODE;
      this.GEN_CMYK_MASK = GEN_CMYK_MASK;
      this.TILABLE = TILABLE;
      this.LIMIT_DISTANCE = LIMIT_DISTANCE;
      this.DISTANCE_LIMIT = DISTANCE_LIMIT;
      this.HIEARCHIAL_SCALE = HIEARCHIAL_SCALE;
      this.HIEARCHIAL_LEVELS = HIEARCHIAL_LEVELS;
      this.SPH_SPEED = SPH_SPEED;
      
      this.ALLOW_OVERDRAW = ALLOW_OVERDRAW;
      this.SMALL_MASK = SMALL_MASK;
    }
  };
  
  var MaskGenerator = exports.MaskGenerator = class MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      this.dilute_small_mask = dilute_small_mask == undefined ? true : dilute_small_mask;
      
      this.appstate = appstate;
      this.colors = CMYK;
      this.config = new MaskConfig();
      this.encode_new_offsets = true; //encode special lower-level offsets
      
      this.skip_point_draw = false;
      
      this.ff_rand = new util.MersenneRandom();
      this.draw_rmul = 1.0;
      
      this.points = [];
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
    }
    
    static build_ui(gui) {
      
    }
    
    get_visible_points(restrict, for_fft, invert) {
      var ps2 = [];
      var ps = this.points;
      var maxlvl = this.max_level();
      
      for (var i=0; i<ps.length; i += PTOT) {
        var gen = ps[i+PGEN]/maxlvl;
        
        if (TONE_CURVE != undefined) {
          gen = 1.0 - TONE_CURVE.evaluate(1.0 - gen);
        }
        
        if (gen != -1 && (invert ? gen < restrict : gen > restrict)) {
          continue;
        }
        
        for (var j=0; j<PTOT; j++) {
          ps2.push(ps[i+j]);
        }
      }
      
      return ps2;
    }
    
    set_config(config) {
      this.config = config;
    }
    
    update_fscale(adaptive) {
      var totpoint = this.points.length/PTOT;
      
      if (!adaptive) {
        totpoint = this.dimen*this.dimen;
      }
      
      //from PSA
      var fnorm = 2.0 / Math.sqrt(totpoint);
      var frange  = 10; // Frequency range relative to Nyq. freq. of hexagonal lattice
      var fsize = Math.floor(frange/fnorm);
      
      return this.fscale;
    }

    ff_weight(seed) {
      //randomly sample in fft;
      var steps = 32;
      
      var err = 0.0;
      var tot=0;
      var ff_rand = this.ff_rand;
      
      if (seed != undefined) {
        ff_rand.seed(seed);
      }
      
      for (var i=0; i<steps; i++){ 
        var x = ff_rand.random(), y = ff_rand.random();
        var _i = 0;
        
        
        while (x*x + y*y > 1.0) {
          x = ff_rand.random(), y = ff_rand.random();
          
          if (_i++ > 1000) {
            console.log("infinite loop! eek!");
            break;
          }
        }
        
        var r = (x-0.5)*(x-0.5) + (y-0.5)*(y-0.5);
        r = r != 0 ? Math.sqrt(r)*2.0 : r;
        
        var goal = FFT_CURVE.evaluate(r);
        var f = this.fft.get(x, y)*0.5;
        
        var e = Math.abs(f-goal);
        err += e*e;
      }
      
      //use. . . variance of error?
      err = err != 0.0 ? Math.sqrt(err) : 0.0;
      
      return err;
    }
    
    //console.log-style function, but without text coloring or anything like that
    report() {
      //console.log.apply(console, arguments);
      reportfunc.apply(window, arguments);
    }
    
    calc_avg_dis() {
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 5.0;
      
      var avgdis=0.0, tot=0.0;
      var hr = this.r;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r = ps[i+PR];
        var gen1 = ps[i+PGEN];
        
        //in hiearchal mode, r might really be bigger
        r = Math.max(r, hr);
        
        var searchrad = r*searchfac;
        
        this.kdtree.forEachPoint(x, y, searchrad, function(pi) {
          var x2 = ps[pi], y2 = ps[pi+1], r2=ps[pi+PR];
          var gen2 = ps[pi+PGEN];
          r2 = Math.max(r, hr);
          
          if (pi == i) {
            return;
          }
          
          var dx = x-x2, dy = y-y2;
          
          var dis = dx*dx + dy*dy;
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          
          avgdis += dis;
          tot++;
        }, this);
      }
      
      if (tot)
        avgdis /= tot;
      
      return avgdis;
    }
    
    offs_relax() {
      let ps2 = this.points.slice(0, this.points.length);
      let ps = this.points;
      
      for (let i=0; i<12; i++) {
        this.off_relax_intern();
      }
      
      var msize = this.mask_img.width;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let x, y;

        x = ps2[pi], y = ps2[pi+1];
        
        x = Math.floor(x*msize)/msize;
        y = Math.floor(y*msize)/msize;
        
        ps[pi+POFFX] = (ps[pi] - x);
        ps[pi+POFFY] = (ps[pi+1] - y);
        
        ps[pi] = ps2[pi];
        ps[pi+1] = ps2[pi+1];
        
        ps[pi+PIX] = ps2[pi+PIX];
        ps[pi+PIY] = ps2[pi+PIY];
      }
      
      this.regen_spatial();
      this.raster();
    }
    
    off_relax_intern(use_avg_dis, max_lvl_perc) {
      use_avg_dis = use_avg_dis == undefined ? false : use_avg_dis;
      
      max_lvl_perc = max_lvl_perc == undefined ? 1.0 : max_lvl_perc;
      //max_lvl_perc = DRAW_RESTRICT_LEVEL;
      
      //console.log("warning, default implementation");
      
      var cf = this.config;
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 2.5;
      var msize = this.mask_img.width;
      
      var r = this.r;
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
      
      if (use_avg_dis) {
        r = this.calc_avg_dis();
      }
      
      function callback(pi) {
        var x2 = ps[pi], y2 = ps[pi+1], r2=ps[pi+PR];
        var gen2 = ps[pi+PGEN];
        
        x2 -= _poffs[j][0];
        y2 -= _poffs[j][1];
        
        if (use_avg_dis)
          r2 = r;
        
        if (cf.GEN_MASK) {
          var f2 = ~~((gen2/maxgen)*255*0.99999);
          f2 = hist[f2];
          r2 = Math.sqrt(1.0 / (2*Math.sqrt(3)*totpoint*f2));
        } else {
          r2 = r;
        }
        
        //if ((cf.GEN_MASK) && gen1 < gen2) {
        //  return;
        //}
        
        var filterwid = searchrad;
        
        //var f1 = gen1/maxgen, f2 = gen2/maxgen;
        //var ratio = cf.GEN_MASK ? f2/(0.00001+f1) : 1.0;
        //filterwid /= f1/f2;
        
        if (pi == i) {
          return;
        }
        
        var dx = x2-x, dy = y2-y;
        var dis = dx*dx + dy*dy;
        
        if (dis == 0 || dis > filterwid*filterwid) {
          return;
        }
        
        dis = Math.sqrt(dis);
        var r3 = Math.min(r2, r1);
        
        var w = 1.0 - dis/filterwid;
        
        //w = cf.SPH_CURVE.evaluate(w);
        w = w*w*w;
        
        dx /= dis;
        dy /= dis;
        
        var fx = x - dx*r3;
        var fy = y - dy*r3;
        
        sumx += w*fx;
        sumy += w*fy;
        sumtot += w;
      }
      
      var totpoint = plen / PTOT;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR];
        var gen1 = ps[i+PGEN];
        var hgen1 = ps[i+PD];
        
        if (hgen1 != curgen && cf.RELAX_CURRENT_LEVEL) {
          continue;
        } else if (gen1/maxgen > max_lvl_perc) {
          continue;
        }
        
        if (use_avg_dis)
          r1 = r;
        else //r1 is often final radius, not current hiearchial one
          r1 = Math.max(r1, r);
        
        if (cf.GEN_MASK) {
          var f1 = ~~((gen1/maxgen)*255*0.99999);
          f1 = hist[f1];
          r1 = Math.sqrt(1.0 / (2*Math.sqrt(3)*totpoint*f1));
        } else {
          f1 = gen1/maxgen;
          r1 = r;
        }
        
        var searchrad = r1*searchfac;
        var sumtot=1, sumx=x, sumy=y;
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, searchrad, callback, this);
        }
        
        sumx /= sumtot;
        sumy /= sumtot;
        
        var fac = 1.0; //cf.GEN_MASK ? 1.0 / (0.3 + f1*f1) : 1.0;
        
        ps[i] += (sumx - ps[i])*2.0*fac;
        ps[i+1] += (sumy-ps[i+1])*2.0*fac;
          
        //ps[i] = Math.fract(ps[i]);
        //ps[i+1] = Math.fract(ps[i+1]);
        //ps[i] = Math.min(Math.max(ps[i], 0), 1);
        //ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
        
      this.regen_spatial();
      this.raster();
    }
    
    relax(use_avg_dis, max_lvl_perc) {
      use_avg_dis = use_avg_dis == undefined ? false : use_avg_dis;
      
      max_lvl_perc = max_lvl_perc == undefined ? 1.0 : max_lvl_perc;
      //max_lvl_perc = DRAW_RESTRICT_LEVEL;
      
      //console.log("warning, default implementation");
      
      var cf = this.config;
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 2.5;
      var msize = this.mask_img.width;
      
      var r = this.r;
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
      
      if (use_avg_dis) {
        r = this.calc_avg_dis();
      }
      
      function callback(pi) {
        var x2 = ps[pi], y2 = ps[pi+1], r2=ps[pi+PR];
        var gen2 = ps[pi+PGEN];
        
        x2 -= _poffs[j][0];
        y2 -= _poffs[j][1];
        
        if (use_avg_dis)
          r2 = r;
        
        if (cf.GEN_MASK) {
          var f2 = ~~((gen2/maxgen)*255*0.99999);
          f2 = hist[f2];
          r2 = Math.sqrt(1.0 / (2*Math.sqrt(3)*totpoint*f2));
        } else {
          r2 = r;
        }
        
        if ((cf.GEN_MASK) && gen1 < gen2) {
        //  return;
        }
        
        var filterwid = searchrad;
        
        //var f1 = gen1/maxgen, f2 = gen2/maxgen;
        //var ratio = cf.GEN_MASK ? f2/(0.00001+f1) : 1.0;
        //filterwid /= f1/f2;
        
        if (pi == i) {
          return;
        }
        
        var dx = x2-x, dy = y2-y;
        var dis = dx*dx + dy*dy;
        
        if (dis == 0 || dis > filterwid*filterwid) {
          return;
        }
        
        dis = Math.sqrt(dis);
        var r3 = Math.min(r2, r1);
        
        var w = 1.0 - dis/filterwid;
        
        //w = cf.SPH_CURVE.evaluate(w);
        w = w*w*w;
        
        dx /= dis;
        dy /= dis;
        
        var fx = x - dx*r3;
        var fy = y - dy*r3;
        
        sumx += w*fx;
        sumy += w*fy;
        sumtot += w;
      }
      
      var totpoint = plen / PTOT;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR];
        var gen1 = ps[i+PGEN];
        var hgen1 = ps[i+PD];
        
        if (hgen1 != curgen && cf.RELAX_CURRENT_LEVEL) {
          continue;
        } else if (gen1/maxgen > max_lvl_perc) {
          continue;
        }
        
        if (use_avg_dis)
          r1 = r;
        else //r1 is often final radius, not current hiearchial one
          r1 = Math.max(r1, r);
        
        if (cf.GEN_MASK) {
          var f1 = ~~((gen1/maxgen)*255*0.99999);
          f1 = hist[f1];
          r1 = Math.sqrt(1.0 / (2*Math.sqrt(3)*totpoint*f1));
        } else {
          f1 = gen1/maxgen;
          r1 = r;
        }
        
        var searchrad = r1*searchfac;
        var sumtot=1, sumx=x, sumy=y;
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, searchrad, callback, this);
        }
        
        sumx /= sumtot;
        sumy /= sumtot;
        
        var fac = cf.GEN_MASK ? 1.0 / (0.3 + f1*f1) : 1.0;
        
        ps[i] += (sumx - ps[i])*2.0*fac;
        ps[i+1] += (sumy-ps[i+1])*2.0*fac;
          
        ps[i] = Math.fract(ps[i]);
        ps[i+1] = Math.fract(ps[i+1]);
        //ps[i] = Math.min(Math.max(ps[i], 0), 1);
        //ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
        
      this.regen_spatial();
      this.raster();
    }
    
    sort() {
      console.trace("sort was called!");
      return;
      
      var plen = this.points.length/PTOT;
      var index = [];
      var ps = this.points;
      
      for (var i=0; i<plen; i++) {
        index.push(i);
      }
      
      index.sort(function(a, b) {
        return ps[a*PTOT+PGEN] - ps[b*PTOT+PGEN];
      });
      
      var ps2 = [];
      for (var i=0; i<plen; i++) {
        for (var j=0; j<PTOT; j++) {
          ps2[i*PTOT+j] = ps[index[i]*PTOT+j];
        }
      }
      
      this.points = ps2;
      this.regen_spatial();
    }
    
    is_done() {
      return false;
    }
    
    step(custom_steps) {
    }
    
    current_level() {
      throw new Error("current_level(): implement me!");
    }
    
    max_level() {
      throw new Error("max_level(): implement me!");
    }    
        
    regen_kdtree() {
      this.regen_spatial();
    }

    reset(size, appstate, mask_image) {
      this.appstate = appstate;
      
      this.dimen = size;
      this.mask_img = mask_image;
      this.mask = mask_image.data;
      
      var msize = mask_image.width;
      this.maskgrid = new Int32Array(msize*msize);
      
      this.maskgrid.fill(-1, 0, this.maskgrid.length);
      this.masksize = mask_image.width;
  
      var iview = new Int32Array(this.mask.buffer);
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = 0;
      iview.fill(iview[0], 0, iview.length);
      
      this.points = [];
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
    }
    
    destroy_all_settings() {
      console.log("implement me: destroy_all_settings");
    }
    
    draw(g) {
    }
    
    //optional
    next_level() {
    }
    
    raster_point(pi, ps) {
      var mscale = SMALL_MASK ? 1 : (XLARGE_MASK ? 8 : 4);
      
      var mask = this.mask, msize = this.mask_img.width
      ps = ps === undefined ? this.points : ps;
      
      var x = ps[pi], y = ps[pi+1], gen=ps[pi+PGEN];
      var color = ps[pi+PCLR];
      
      if (gen < 0) return; //skip point
      
      var d = 1.0 - gen/this.max_level();

      //XXX
      //d = 1.0 - (pi) / ps.length;
      
      if (TONE_CURVE != undefined && USE_TONE_CURVE) {
        d = 1.0 - this.config.TONE_CURVE.evaluate(1.0-d);
      }
      
      if (d < 0 || d > 1.0 || isNaN(d)) {
        throw new Error("eek! " + d);
      }
      
      var ix = ps[pi+PIX], iy = ps[pi+PIY];
      if (ix < 0) return; //dropped point
      
      if (ix < 0 || iy < 0 || ix >= msize || iy >= msize)
        return;
      
      //ix = Math.min(Math.max(ix, 0), msize-1);
      //iy = Math.min(Math.max(iy, 0), msize-1);
      
      var idx = (iy*msize+ix)*4;
      if (!ALLOW_OVERDRAW && mask[idx] != 0) return;
      
      //small offset to signal that a pixel isn't blank in expanded/large masks.
      //didn't want to use alpha for it.
      let off = LARGE_MASK_NONZERO_OFFSET;
      
      d = ~~(d*(255-off)) + off;
      
      var color = ps[pi+PCLR];
      if (GEN_CMYK_MASK) {
        var r = ~~(d*CMYK[color&3][0]*255);
        var g = ~~(d*CMYK[color&3][1]*255);
        var b = ~~(d*CMYK[color&3][2]*255);
        
        mask[idx] = r;
        mask[idx+1] = g;
        mask[idx+2] = b;
      } else {
        if (this.encode_new_offsets) {
          mask[idx] = d;
          
          let dx = ps[pi+POFFX], dy = ps[pi+POFFY];
          
          dx *= msize/mscale;
          dy *= msize/mscale;
          
          dx = (dx + 1.0)*0.5;
          dy = (dy + 1.0)*0.5;
          
          dx = ~~(dx*255);
          dy = ~~(dy*255);
          
          mask[idx+1] = dx;
          mask[idx+2] = dy;
        } else {
          mask[idx] = mask[idx+1] = mask[idx+2] = d;
        }
      }
      
      mask[idx+3] = 255;
    }
    /*
    raster() {
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[1] = 255;
      this.mask[3] = SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = ~~(this.points.length/PTOT);
      
      for (var i=0; i<plen; i++) {
        this.raster_point(i);
      }
    }*/
    
    assign_mask_pixels() {
      this.maskgrid.fill(-1, 0, this.maskgrid.length);
      var ps = this.points;
      
      for (var i=0; i<ps.length; i += PTOT) {
        this.find_mask_pixel(i);
      }
      
      //deal with any empty grid cells
      var size = this.masksize;
      var grid = this.maskgrid;
      var cf = this.config;
      
      if (cf.SMALL_MASK && this.dilute_small_mask && size < 256) {
        var off = cconst.get_searchoff(4);
        //console.log(this.dilute_small_mask, this, this.__proto__, this.constructor.name);
        //console.trace("glen", grid.length, size, grid[0], off.length);
        
        var refgrid = new Float64Array(this.maskgrid);
        
        for (var i=0; i<grid.length; i++) {
          var off = cconst.get_searchoff(4);
          
          var ix = i % size, iy = ~~(i / size);
          if (grid[i] >= 0) continue;
          var ok = false;
          
          for (var j=0; j<off.length; j++) {
            var ix1 = ix + off[j][0], iy1 = iy + off[j][1];
            
            if (ok) 
              break;
            
            for (var k=0; k<_poffs.length; k++) {
              var ix2 = (ix1 + _poffs[k][0]*size) % size;
              var iy2 = (iy1 + _poffs[k][1]*size) % size;
              
              if (ix2 < 0 || iy2 < 0 || ix2 >= size || iy2 >= size)
                continue;
              
              var idx = (iy2*size+ix2);
              
              if (Math.random() > 0.9) {
                //console.log("g", ix2, iy2, ix, iy, grid[idx]);
              }
              
              if (refgrid[idx] >= 0) { 
                grid[i] = refgrid[idx];
                ok = 1;
                break;
              }
            }
          }
        }
      }
      
      //raster
      var mask = this.mask;
      var msize = this.mask_img.width;
      var maxgen = this.max_level();
      var cf = this.config;
      
      for (var i=0; i<grid.length; i++) {
        var ix = i % size, iy = ~~(i / size);
        var idx = (iy*msize+ix)*4;

        if (grid[i] < 0 || ps[grid[i]+PGEN] < 0) continue;
        
        var gen = 1.0 - ps[grid[i]+PGEN] / maxgen;
        var f;
        
        if (cf.USE_TONE_CURVE) {
          f = 1.0-cf.TONE_CURVE.evaluate(1.0-gen);
        } else {
          f = gen;
        }
        
        var color = ps[grid[i]+PCLR];
        if (GEN_CMYK_MASK) {
          var r = ~~(f*CMYK[color&3][0]*255);
          var g = ~~(f*CMYK[color&3][1]*255);
          var b = ~~(f*CMYK[color&3][2]*255);
          
          mask[idx]   = r;
          mask[idx+1] = g;
          mask[idx+2] = b;
        } else {
          mask[idx] = mask[idx+1] = mask[idx+2] = ~~(f*255);
        }
        
        mask[idx+3] = 255;
      }
    }
    
    raster() {
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[1] = 255;
      this.mask[3] = SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      if (this.config.SMALL_MASK) {
        this.assign_mask_pixels();
      } else {
        //this.mask[0] = this.mask[1] = this.mask[2] = 0;
        //this.mask[1] = 255;
        //this.mask[3] = SMALL_MASK ? 255 : 0;
        
        var iview = new Int32Array(this.mask.buffer);
        iview.fill(iview[0], 0, iview.length);
        //console.log("raster!");
        for (var i=0; i<this.points.length; i += PTOT) {
          this.raster_point(i);
        }
      }
    }
    
    find_mask_pixel(pi) {
      var ps = this.points, grid = this.maskgrid;
      var size = this.masksize;
      var x = ps[pi], y = ps[pi+1];
      var ix = ~~(x*size+0.0001), iy = ~~(y*size+0.0001);
      var idx = iy*size + ix;

      //ignore if out of bounds
      //if (ix < 0 || iy < 0 || x >= size || y >= size) {
      //  return;
      //}
      
      if (grid[idx] == -1 || ALIGN_GRID) {
        ps[pi+PIX] = ix;
        ps[pi+PIY] = iy;
        grid[idx] = pi;
        return;
      }
      
      var d = 4;
      var mindis = 1e17, min = undefined;
      
      var offs = cconst.get_searchoff(d);
      for (var i=0; i<offs.length; i++) {
        var ix2 = ix + offs[i][0], iy2 = iy + offs[i][1];
        
        if (ix2 < 0 || iy2 < 0 || ix2 >= size || iy2 >= size)
          continue;
        
        var idx = iy2*size+ix2;
        var dis = offs[i][0]*offs[i][0] + offs[i][1]*offs[i][1];
        
        if (grid[idx] == -1 && (min == undefined || dis < mindis)) {
          min = idx;
          mindis = dis;
        }
      }
      
      if (min == undefined || grid[min] != -1) {
        //console.log("eek!");
        return;
        
        for (var ix2=0; ix2<size; ix2++) {
          for (var iy2=0; iy2<size; iy2++) {
            break; //XXX evil loop
            
            var dis = (ix2-ix)*(ix2-ix) + (iy2-iy)*(iy2-iy);
            var idx = iy2*size + ix2;
            
            if (grid[idx] == -1 && (min == undefined || dis < mindis)) {
              min = idx;
              mindis = dis;
            }
          }
        }
      }

      if (min != undefined) { //grid[min] == -1) {
        ps[pi+PIX] = ix;
        ps[pi+PIY] = iy;
        grid[min] = pi;
        return;
      }
      
      //this.report("WARNING: dropping a point");
      
      ps[pi+PIX] = -1;
      ps[pi+PIY] = -1;
    }

    done() {
      return this.current_level() >= this.max_level();
    }
    
    toggle_timer_loop(appstate, simple_mode) {
        if (appstate.timer != undefined) {
          window.clearInterval(appstate.timer);
          appstate.timer = undefined;
          return;
        } 
        
        var this2 = this;
        var start = util.time_ms();
        var lasttot = 0;
        var totsame = 0;
        
        appstate.timer = window.setInterval(function() {
          if (util.time_ms() - start < 45) {
            return;
          }
          
          if (simple_mode) {
            var start2 = util.time_ms();
            var report = 0;
            
            this2.config.update();
            
            while (util.time_ms() - start2 < 700) {
              appstate.step(undefined, report++);
            }
          }
          
          if (simple_mode||totsame == QUALITY_STEPS) {
            if (appstate.generator.done()) {
              this2.report("  Finished job");
              
              window.clearInterval(appstate.timer);
              appstate.timer = undefined;
            }
            
            appstate.next_level();
            totsame = 0;
          }
          
          var start2 = util.time_ms();
          var report = 0;
          
          while (util.time_ms() - start2 < 150) {
            appstate.step(undefined, report++);
          }
          
          if (appstate.generator.points.length == lasttot) {
            totsame++;
          } else {
            totsame = 0;
          }
          
          this2.report("same: ", totsame);
          
          lasttot = appstate.generator.points.length;
          redraw_all();
          
          start = util.time_ms();
        }, 25);
    }
    
    regen_spatial() {
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
      var ps = this.points;
      
      //console.log("regenerating kdtree...");
      var start = util.time_ms();
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        this.kdtree.insert(x, y, i);
      }
      
      var time = util.time_ms() - start;
      //console.log("done", time.toFixed(2) + "ms");
      
      return this.kdtree;
    }
  };
  
  var NullGenerator = exports.NullGenerator = class NullGenerator extends MaskGenerator {
  };
  
  return exports;
});
