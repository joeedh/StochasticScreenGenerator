var _interface = undefined;

define([
  "util", "const", "kdtree", "report", "ui"
], function(util, cconst, kdtree, reportfunc, ui) {
  'use strict';
  
  var exports = _interface = {};
  var Class = util.Class;
  
  exports._configs = [];
  exports.generators = [];
  
  let configMap = exports.configMap = new Map();

  exports.getConfigKeys = function(cls=_appstate.generator.constructor) {
    return configMap.get(cls);
  }
  
  exports.saveConfig = function(config_keys=exports.getConfigKeys()) {
    let buf = "  {\n";
    for (let k in config_keys) {
      let v = window[k] !== undefined ? window[k] : config_keys;
      
      if (v instanceof ui.Curve) {
        v = JSON.stringify(v.toJSON());
        v = "new cconst.EditableCurve(\"" + k + "\", " + v + ")";
      } else {
        v = JSON.stringify(v);
      }
      
      buf += "    " + k + "  :  " + v + ",\n";
    }
    buf += "  };\n"
    
    return buf;
  }
  /*
  Multi-mask refactor.  Need to add support for generators creating 
  multiple masks.
  
  note that some Mask methods (mostly rasterization) is in MaskGenerator
  to avoid subclassing Mask.  Could also use a mixin approach I guess.
  
  TODO:
  
    - BAD: add support for multiple point sets
      this will make problems with referencing points
      instead, have points reference masks
    - add API to automatically draw each mask
    - implement raster
  */
  
  var Mask = exports.Mask = class Mask {
    constructor(config, maskid, points) {
      this.maskid = maskid;
      this.points = points;
      this.mask_image = undefined;
      this.kdtree = undefined;
      this.config = config;
      this.dimen = undefined;
      
      this.reset(config, config.DIMEN, points);
    }
    
    report() {
      //console.log.apply(console, arguments);
      reportfunc.apply(window, arguments);
    }
    
    get localpoints() {
      let ps = this.points;
      let maskid = this.maskid;
      
      return (function*() {
        for (let pi=0; pi<ps.length; pi += PTOT) {
          if (ps[pi+PMASK] == maskid)
            yield pi;
        }
      })();
    }
    
    regen_spatial() {
      if (this.kdtree === undefined) {
        this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
      }
      
      this.kdtree.clear();
      let ps = this.points;
      
      //for (let pi of this.localpoints) {
      //*
      for (let pi=0; pi<ps.length; pi += PTOT) {
        if (ps[pi+PMASK] != this.maskid)
          continue;
      //*/
        var x = ps[pi], y = ps[pi+1], mi = ps[pi+PMASK];
        
        this.kdtree.insert(x, y, pi);
      }
    }
    
    reset(config, dimen, points, mask_image = undefined) {
      this.config = config;
      
      //var msize = mask_image.width;
      var msize;
      if (config.XLARGE_MASK) {
        msize = dimen*8;
      } else if (!config.SMALL_MASK) {
        msize = dimen*4;
      } else {
        msize = dimen;
      }
      
      if (mask_image === undefined) {
        mask_image = new ImageData(msize, msize);
      } else if (mask_image.width != msize) {
        this.report(`ERROR: mask size wrong, ${mask_image.width} should be ${msize}`);
      }
      
      this.points = points;

      this.mask_img = mask_image;
      this.mask = mask_image.data;

      this.maskgrid = new Int32Array(msize*msize);
      this.maskgrid.fill(-1, 0, this.maskgrid.length);
      this.masksize = msize;
  
      var iview = new Int32Array(this.mask.buffer);
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = 0;
      iview.fill(iview[0], 0, iview.length);
      
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
    }
  }
  

  var MaskConfig = exports.MaskConfig = class MaskConfig {
    constructor() {
      this.update();
      
      this.SEED = 0;
      this.RELAX_CURRENT_LEVEL = false;
      this.DRAW_ALL_MASKS = true;
      this.CURRENT_MASK = 0;
      this.TOTMASKS = 1;
    }
    
    static registerConfig(cfg, cls) {
      configMap.set(cls, cfg);
      
      if (cls === undefined) {
        throw new Error("bad call to MaskConfig.registerConfig");
      }
      
      exports._configs.push(cfg);
      cconst.registerConfig(cfg, MaskConfig);
    }
    
    copy() {
      let mc = new MaskConfig();
      
      for (let k in this) {
        if (typeof this[k] == "function") {
          continue;
        }
        
        mc[k] = this[k];
      }
      
      return mc;
    }
    
    static registerCurve(key, json) {
      let curve;
      
      if (!(json instanceof ui.Curve)) {
        if (typeof json == "string")
          json = JSON.parse(json);
        
        curve = new ui.Curve(json.setting_id === undefined ? "bleh! stupid!" : json.setting_id);
        curve.loadJSON(json);
      } else {
        curve = json;
      }
      
      //XXX stupid global namespacing of config stuff
      //also, UI code will override this instance anyway,
      //bleh but it's necassary
      window[key] = curve;
    }
    
    update() {
      //XXX I'd like to move away from having config values in the global
      //namespace
      
      for (let cfg of exports._configs) {
        for (let k in cfg) {
          this[k] = window[k]; //need to update config system to not use window
        }
      }
      
      this.TOTMASKS = window.TOTMASKS;
      this.DRAW_ALL_MASKS = window.DRAW_ALL_MASKS;
      this.CURRENT_MASK = window.CURRENT_MASK;
      this.USE_TONE_CURVE = USE_TONE_CURVE;
      this.CMYK = CMYK;
      this.GEN_MASK = GEN_MASK;
      this.FFT_TARGETING = FFT_TARGETING;
      this.LARGE_MASK_NONZERO_OFFSET = LARGE_MASK_NONZERO_OFFSET;
      this.RELAX_SPEED = RELAX_SPEED;
      
      this.RADIUS_CURVE = RADIUS_CURVE;
      this.TONE_CURVE = TONE_CURVE;
      this.SPH_CURVE = SPH_CURVE;
      this.FFT_CURVE = FFT_CURVE;
      //this.VOIDCLUSTER_MID_R = VOIDCLUSTER_MID_R;
      
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
      
      this.reset_i = 0;
      
      this.masks = [];
      
      this.appstate = appstate;
      this.colors = CMYK;
      this.config = new MaskConfig();
      this.encode_new_offsets = true; //encode special lower-level offsets
      
      this.skip_point_draw = false;
      
      this.ff_rand = new util.MersenneRandom();
      this.draw_rmul = 1.0;
      
      this.points = [];
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
      this.add_mask();
    }
    
    static register(config, cls, enum_name=cls.name, order) {
      if (cls === undefined) {
        throw new Error("bad call to MaskGenerator.register");
      }
      
      if (order === undefined) {
        throw new Error('order cannot be undefined for' + cls.name);
      }

      cls.enumName = enum_name
      MaskConfig.registerConfig(config, cls);
      cls.order = order
      exports.generators.push(cls);
      exports.generators.sort((a, b) => a.order - b.order);

      for (const cls2 of exports.generators) {
        window.MODES[cls2.enumName] = exports.generators.findIndex(a => a === cls2)
      }
    }
    
    gen_masks(count) {
      this.masks.length = 1;
      count--;
      
      for (let i=0; i<count; i++) {
        this.add_mask();
      }
    }
    
    add_mask() {
      let config = this.config === undefined ? new MaskConfig() : this.config; //XXX should never be undefined
      let mask = new Mask(config, this.masks.length, this.points);
      
      this.masks.push(mask);
      
      return mask;
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
        
      
        /*make small force towards grid in small mask mode*/
        if (cf.SMALL_MASK) {
          let dx = Math.floor(ps[i]*msize + 0.5)/msize - ps[i];
          let dy = Math.floor(ps[i+1]*msize + 0.5)/msize - ps[i+1];
          
          ps[i] += dx*0.35;
          ps[i+1] += dy*0.35;
        }
        
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
    
    relax(use_avg_dis, max_lvl_perc, speed=undefined, config=undefined) {
      if (config === undefined) {
        config = this.config;
      }
      
      if (speed === undefined) {
        speed = config.RELAX_SPEED;
      }
      
      this.report("relaxing. . .");

      this.relax_intern(0, use_avg_dis, max_lvl_perc, speed, config);
      this.relax_intern(1, use_avg_dis, max_lvl_perc, speed, config);
    }
    
    relax_intern(local_only, use_avg_dis, max_lvl_perc, speed=undefined, config=undefined) {
      use_avg_dis = use_avg_dis == undefined ? false : use_avg_dis;
      
      max_lvl_perc = max_lvl_perc == undefined ? 1.0 : max_lvl_perc;
      //max_lvl_perc = DRAW_RESTRICT_LEVEL;
      
      //console.log("warning, default implementation");
      
      var cf = config === undefined ? this.config : config;
      
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
        var mi2 = ps[pi+PMASK];
        var gen2 = ps[pi+PGEN];
        
        if (local_only && mi1 != mi2) {
          return;
        }
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

        if (isNaN(dx) || isNaN(dy) || isNaN(dis) || isNaN(w) || isNaN(x) || isNaN(y)) {
          throw new Error("nan!");
        }
        var fx = x - dx*r3;
        var fy = y - dy*r3;
        
        sumx += w*fx;
        sumy += w*fy;
        sumtot += w;
      }
      
      var totpoint = plen / PTOT;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR];
        var mi1 = ps[i+PMASK];
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
        
        if (local_only) {
          /*
          find area of r1 times this.masks.length
          mlen*(pi*r1**2) = pi*r2**2;
          r2 = sqrt(mlen)*r1;
          */
          
          r1 *= Math.sqrt(this.masks.length);
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
        
        fac *= speed;

        ps[i] += (sumx - ps[i])*2.0*fac;
        ps[i+1] += (sumy-ps[i+1])*2.0*fac;

        if (isNaN(ps[i]) || isNaN(ps[i+1]) || isNaN(sumx) || isNaN(sumy) || isNaN(fac) || isNaN(sumtot)) {
          throw new Error("nan");
        }

        ps[i] = Math.fract(ps[i]);
        ps[i+1] = Math.fract(ps[i+1]);
        //ps[i] = Math.min(Math.max(ps[i], 0), 1);
        //ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
        
      this.regen_spatial();
      this.raster();
      this.report("done relaxing");
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
      
      this._update_mask_pointrefs();
      this.regen_spatial();
    }
    
    _update_mask_pointrefs() {
      for (let mask of this.masks) {
        mask.points = this.points;
      }
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
    
    //generators is a list of generator constructors
    //it's passed in here to avoid module dependency cycles
    reset(dimen, appstate, mask_image, generators) { 
      util.seed(this.config.SEED + this.reset_i);
      this.reset_i++;
      
      this.appstate = appstate;
      
      this.dimen = dimen;
      
      this.points = [];
      this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
      
      for (let mask of this.masks) {
        mask.reset(this.config, dimen, this.points, mask_image);
      }
      
      this.mask_img = this.masks[0].mask_img;
      this.mask = mask_image.data;
      this.maskgrid = this.masks[0].maskgrid;
      this.masksize = this.masks[0].masksize;
    }
    
    destroy_all_settings() {
      console.log("implement me: destroy_all_settings");
    }
    
    draw(g) {
    }
    
    //optional
    next_level() {
    }
    
    /*
      mi : mask index (in this.masks)
      pi : point index (in ps)
      ps : pointset (usually this.points)
    */
    raster_point(mi, pi, ps) {
      var mscale = SMALL_MASK ? 1 : (XLARGE_MASK ? 8 : 4);
      var config = this.config;
      var mask = this.masks[mi].mask, msize = this.mask_img.width
      ps = ps === undefined ? this.points : ps;
      
      if (mi !== ps[pi+PMASK])
        return;
      
      var x = ps[pi], y = ps[pi+1], gen=ps[pi+PGEN];
      var color = ps[pi+PCLR];
      
      if (gen < 0) return; //skip point
      
      var d = 1.0 - gen/this.max_level();

      //XXX
      //d = 1.0 - (pi) / ps.length;
      
      if (config.TONE_CURVE != undefined && config.USE_TONE_CURVE) {
        d = 1.0 - config.TONE_CURVE.evaluate(1.0-d);
      }
      
      if (d < 0 || d > 1.0 || isNaN(d)) {
        throw new Error("eek! " + d);
      }
      
      var ix = ps[pi+PIX], iy = ps[pi+PIY];
      if (ix < 0) return; //dropped point
      
      if (ix < 0 || iy < 0 || ix >= msize || iy >= msize) {
        return;
      }
      
      //ix = Math.min(Math.max(ix, 0), msize-1);
      //iy = Math.min(Math.max(iy, 0), msize-1);
      
      var idx = (iy*msize+ix)*4;
      if (!config.ALLOW_OVERDRAW && mask[idx] != 0) return;
      
      //small offset to signal that a pixel isn't blank in expanded/large masks.
      //didn't want to use alpha for it.
      let off = config.LARGE_MASK_NONZERO_OFFSET;
      
      d = ~~(d*(255-off)) + off;
      
      var color = ps[pi+PCLR];
      if (config.GEN_CMYK_MASK) {
        var r = ~~(d*CMYK[color&3][0]*255);
        var g = ~~(d*CMYK[color&3][1]*255);
        var b = ~~(d*CMYK[color&3][2]*255);
        
        mask[idx] = r;
        mask[idx+1] = g;
        mask[idx+2] = b;
      } else {
        if (0&&this.encode_new_offsets) {
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
        this.raster_point(mi, i);
      }
    }*/
    
    assign_mask_pixels(mi) {
      this.masks[mi].maskgrid.fill(-1, 0, this.masks[mi].maskgrid.length);
      var ps = this.points;
      
      for (var i=0; i<ps.length; i += PTOT) {
        if (ps[i+PMASK] == mi) {
          this.find_mask_pixel(mi, i);
        }
      }
      
      //deal with any empty grid cells
      var size = this.masks[mi].masksize;
      var grid = this.masks[mi].maskgrid;
      var cf = this.config;
      
      if (cf.SMALL_MASK && this.dilute_small_mask && size < 256) {
        var off = cconst.get_searchoff(4);
        //console.log(this.dilute_small_mask, this, this.__proto__, this.constructor.name);
        //console.trace("glen", grid.length, size, grid[0], off.length);
        
        var refgrid = new Float64Array(this.masks[mi].maskgrid);
        
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
      var mask = this.masks[mi].mask;
      var msize = this.masks[mi].mask_img.width;
      var maxgen = this.max_level();
      var cf = this.config;
      
      for (var i=0; i<grid.length; i++) {
        var ix = i % size, iy = ~~(i / size);
        var idx = (iy*msize+ix)*4;

        if (grid[i] < 0 || ps[grid[i]+PGEN] < 0) continue;
        if (ps[grid[i]+PMASK] != mi) continue;
        
        var gen = 1.0 - ps[grid[i]+PGEN] / maxgen;
        var f;
        
        if (cf.USE_TONE_CURVE && cf.TONE_CURVE) {
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
      for (let mask of this.masks) {
        this.raster_mask(mask.maskid);
      }
    }
    
    raster_mask(mi) {
      //this.mask[0] = this.mask[1] = this.mask[2] = 0;
      //this.mask[1] = 255;
      //this.mask[3] = SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.masks[mi].mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      if (this.config.SMALL_MASK) {
        /*
        let mask = this.masks[mi].mask;
        
        for (var i=0; i<mask.length; i += 4) {
          let f = Math.random()*255;
          mask[i] = f;
          mask[i+1] = f;
          mask[i+2] = f;
          mask[i+3] = 255;
        }
        return;
        //*/
        this.assign_mask_pixels(mi);
      } else {
        //this.masks[mi].mask[0] = this.masks[mi].mask[1] = this.masks[mi].mask[2] = 0;
        //this.masks[mi].mask[1] = 255;
        //this.masks[mi].mask[3] = SMALL_MASK ? 255 : 0;
        
        var iview = new Int32Array(this.masks[mi].mask.buffer);
        iview.fill(iview[0], 0, iview.length);
        //console.log("raster!");
        for (var i=0; i<this.points.length; i += PTOT) {
          this.raster_point(mi, i);
        }
      }
    }
    
    find_mask_pixel(mi, pi) {
      var ps = this.points, grid = this.masks[mi].maskgrid;
      var size = this.masks[mi].masksize;
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
        var i = 0;
        
        appstate.timer = window.setInterval(function() {
          if (util.time_ms() - start < 45) {
            return;
          }
          
          if (simple_mode) {
            var start2 = util.time_ms();
            var report = 0;
            
            this2.config.update();
            
            while (util.time_ms() - start2 < 225) {
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
          
          this2.config.update();
          
          while (util.time_ms() - start2 < 225) {
            appstate.step(undefined, report++);
          }
          
          if (appstate.generator.points.length == lasttot) {
            totsame++;
          } else {
            totsame = 0;
          }
          
          this2.report("same: ", totsame, "i", i);
          i++;
          
          lasttot = appstate.generator.points.length;
          redraw_all();
          
          start = util.time_ms();
        }, 25);
    }
    
    regen_spatial() {
      if (this.kdtree === undefined) {
        this.kdtree = new kdtree.KDTree([-2, -2, -2], [2, 2, 2]);
      }
      
      this.kdtree.clear();
      var ps = this.points;
      
      //console.log("regenerating kdtree...");
      var start = util.time_ms();
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        this.kdtree.insert(x, y, i);
      }
      
      for (let mask of this.masks) {
        mask.points = this.points;
        mask.regen_spatial();
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
