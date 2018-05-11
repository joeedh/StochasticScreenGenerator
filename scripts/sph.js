var _sph = undefined;

define([
  "util", "vectormath", "kdtree", "const", "interface", "sph_presets"
], function(util, vectormath, kdtree, cconst, iface, sph_presets) {
  "use strict";
  
  let exports = _sph = {};

  let config = exports.config = {
    DIMEN : 64,
    USE_MASK : false,
    
    PROG_BASE_LAYER : false,
    EXPONENT : 1.0,
    PREPOWER : 2.0,  
    TONE_IN_SOLVER : false,
    KEEP_UNIFORM : false,
    DRAW_COLORS : true,
    SEARCHRAD : 5.0,
    RMUL : 1.0,
    SPH_SPEED : 1.0,
    
    PARAM : 4.0,
    PARAM2 : 0.0,
    PARAM3 : 0.001,
    PARAM4 : 5.0,
    PARAM5 : 0.7,
    
    START_THRESHOLD : 0.0,
    GENSTART : 0.1,
    SHOW_RADII : true,
    DV_DAMPING : 0.4,
    VOIDCLUSTER : true,
    ALTERNATE : false, //alternate between void-cluster and sph mode
    GUASS_MIN : 0.1,
    GUASS_POW : 1.0,
    SCALE_GAUSS : false,
    SCALE_RADIUS : false,
    RADIUS_POW : 1.0,
    PROPEGATE_W : true,
    INITIAL_W_POWER : 4.0,
    DRAW_KDTREE : false,
    TONE_MASK : true,
    SEARCHRAD2 : 4.0,
    
    GEN_CURVE : new cconst.EditableCurve("Gen Curve", {"points":[{"0":0,"1":0,"eid":77,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":78}})
  };
  
  let defaults = {"APP_VERSION":0.0001,"DIMEN":28,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"PREPOWER":0.5,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"DRAW_COLORS":true,"SEARCHRAD":4,"RMUL":1,"SPH_SPEED":4.69,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.406,"PARAM":0.45,"PARAM2":3.751,"PARAM3":0.000001,"PARAM4":4,"PARAM5":0.721,"TIMER_STEPS":33554432,"START_THRESHOLD":0.3,"GENSTART":0.05,"SMALL_MASK":false,"XLARGE_MASK":true,"SHOW_RADII":false,"DV_DAMPING":1,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SEARCHRAD2":3.96,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1};

  for (let k in defaults) {
    if (k in config) {
      config[k] = defaults[k];
    }
  }
  
  iface.MaskConfig.registerConfig(config);
  
  let gen_curve = exports.gen_curve = function(s, ctx) {
    ctx = ctx === undefined ? exports : ctx;
    
    /*
    s = (1.0-s)*(1.0-s);
    return Math.exp(-(s*ctx.PARAM4)/(2.0*ctx.PARAM5*ctx.PARAM5));
    //*/
    
    return ctx.GEN_CURVE.evaluate(s);
  }
  
  let gen_curve_inv = exports.gen_curve_inv = function(s, ctx) {
    /*
    let f;
    
    if (s == 0.0) return 0.0;
    
    f = 2.0*Math.log(1 / s) / ctx.PARAM4;
    f = f != 0.0 ? Math.sqrt(f) : 0.0;
    f *= Math.abs(ctx.PARAM5);

    return 1.0-f//Math.sqrt(f);
    
    //*/
    return ctx.GEN_CURVE.inverse(s);
  }
 
  /*mask toning function
    
    Used either prior to solving or after, see TONE_IN_SOLVER.
    If after, any transformation applied prior to solve is first reversed 
    and then toning is applied (see PrePower, it applies pow(generation, PrePower) prior to solve,
    *but only if if TONE_IN_SOLVER is off*
   */
  let tonefunc = exports.tonefunc = function(gen, ctx) {
    return ctx.TONE_CURVE.evaluate(gen);
    /*
    gen = 1.0 - gen;
    let t = 0.75;
    gen = Math.pow(gen, 1.5)*(1.0-t) + Math.pow(gen, ctx.EXPONENT)*t;
    gen = 1.0 - gen;
    //*/
    
    let off = ctx.GENSTART; 
    //off = ctx.EXPONENT;
    gen = Math.max((gen - off) / (1.0 - off), 0.0);
    
    let exp2 = 3.25; //ctx.EXP2
    let exp1 = 0.7; //ctx.EXP2; //0.7;  //ctx.EXPONENT
    
    gen = 1.0 - Math.exp(-gen*exp2);
    gen = gen != 0.0 ? Math.pow(gen, exp1) : 0.0;
    
    return gen;
  }
  
  let tonefunc_inv = exports.tonefunc_inv = function(f, ctx) {
    return ctx.TONE_CURVE.inverse(gen);
  }
  
  let gridoffs = [
    [0, 0],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    
    [0, 1],
    [1, 1],
    [1, 0],
    
    [1, -1],
    [0, -1]
  ];
  
  let calcradius = function(totpoint, cconst_ctx) {
    return cconst_ctx.RMUL / Math.sqrt(totpoint) / Math.sqrt(2.0);
    //return cconst.RMUL * 1.0 / Math.sqrt(totpoint * 2.0 * Math.sqrt(3.0));
  }
  
  let SPHGenerator = exports.SPHGenerator = class SPHGenerator extends iface.MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.skip_point_draw = true;
    }
    
    static build_ui(gui) {
      var panel2 = gui.panel("SPH");
      
      panel2.slider('SPH_SPEED', 'SPH Speed', 1.0, 0.001, 15.0, 0.0001, false, false);
      panel2.slider('SEARCHRAD', 'Filter Width', 4.0, 0.001, 20.0, 0.0001, false, false);
      panel2.slider("SEARCHRAD2", "Filter2 Width", 2.25, 0.0, 10.0, 0.00001, false, false);
      panel2.slider("RMUL", "rmul", 0.75, 0.0, 10.0, 0.00001, false, false);

      let panel3 = panel2.panel("Additional Settings");
      panel3.slider("START_THRESHOLD", "StartThresh", 0.0, 0.0, 1.0, 0.00001, false, false);
      panel3.slider("GENSTART", "Genstart", 0.0, 0.0, 1.0, 0.00001, false, false);
      panel3.slider("DV_DAMPING", "Damping", 0.0, 0.0, 1.0, 0.00001, false, false);

      panel3.slider("PARAM", "Param1", 1.0, 0.0, 10.0, 0.00001, false, false);
      panel3.slider("PARAM2", "Param2", 2.0, 0.0, 10.0, 0.00001, false, false);
      panel3.slider("PARAM3", "Param3", 0.1, 0.0, 10.0, 0.00001, false, false);
      panel3.slider("PARAM4", "Param4", 4, 0.0, 10.0, 0.00001, false, false);
      panel3.slider("PARAM5", "Param5", 0.72, 0.0, 10.0, 0.00001, false, false);

      panel3.slider("PREPOWER", "PrePower", 0.72, 0.0, 10.0, 0.00001, false, false);
      
      panel3.check("VOIDCLUSTER", "Progressive Mode");
      panel3.check("PROPEGATE_W", "propegate_w");
      /*
    START_THRESHOLD
    GENSTART
    DV_DAMPING
    VOIDCLUSTER
    PROPEGATE_W
    INITIAL_W_POWER
    SEARCHRAD2
    SEARCHRAD : 5.0,
      //*/
      
      panel3 = panel2.panel("Gen Curve");
      window.GEN_CURVE = panel3.curve('GEN_CURVE', 'Gen Curve', cconst.DefaultCurves.GEN_CURVE).curve;
      panel3 = panel2.panel("SPH Curve");
      window.SPH_CURVE = panel3.curve('SPH_CURVE', 'SPH Curve').curve;
      
      panel2.close()
      
      var list = {
      }
      
      for (var k in sph_presets.presets) {
        list[k] = k;
      }
      
      //sph_presets
      var sph_val = "Simple";
      panel2.listenum(undefined, 'preset', list, sph_val, function(val) {
        sph_val = val;
      });        
        
      panel2.button('load_preset', 'Load SPH Preset', function() {
        SPH_CURVE.loadJSON(sph_presets.presets[sph_val]);
        SPH_CURVE.update();
        SPH_CURVE.widget.draw();
        SPH_CURVE.widget.save();
      });
    }
    
    reset(dimen, appstate, mask_image) {
      super.reset(dimen, appstate, mask_image);
      
      this.dimen = dimen;
      this.points = [];
      this.totpoint = 0;
      this.tick = 0;
      this.r = 0;
      this.totbase = 0.0;
      this.maxgen = 1.0;
      
      this.throw(this.config);
    }
    
    max_level() {
      return this.maxgen;
    }
    
    current_level() {
      return this.maxgen;
    }
    
    throw2() {
      let totpoint = this.dimen*this.dimen*0.95;
      let ps = this.points;
      
      let genstart = totpoint*cconst.GENSTART;
      let maxgen = totpoint + genstart;
      
      let dimen2 = Math.floor(Math.sqrt(totpoint));
      
      for (let i=0; i<totpoint; i++) {
        let i2 = i;
        
        let ix = i2 % dimen2, iy = ~~(i2 / dimen2);
        let x = ix/dimen2, y = iy/dimen2;
        
        let pi = ps.length;
        for (let j=0; j<PTOT; j++) {
          ps.push(0.0);
        }
        
        let gen = i/totpoint;
        gen = Math.fract(gen*Math.PI*363.324 + y*23.24);
        
        if (cconst.TONE_IN_SOLVER) {
          gen = cconst.tonefunc(gen, cconst);
        } else {
          //gen = Math.sqrt(gen);
          gen = Math.pow(gen, cconst.PREPOWER);
        }
        
        let r = 0.8 / Math.sqrt(2 + gen*totpoint);
        
        ps[pi] = x;
        ps[pi+1] = y;
        ps[pi+PGEN] = gen;
        ps[pi+POGEN] = gen;
        ps[pi+PR] = r;
      }
    }

    throw(ctx) {
      let totpoint = this.dimen*this.dimen*0.87;
      let ps = this.points;
      
      let genstart = totpoint*ctx.GENSTART;
      let maxgen = totpoint + genstart;
      
      let dimen2 = Math.floor(Math.sqrt(totpoint));
      this.r = undefined;
      let mw = this.mask_img.width, mh = this.mask_img.height;
      
      for (let i=0; i<totpoint; i++) {
        //let i2 = ~~(Math.random()*totpoint*0.9999);
        //let ix = i2 % dimen2, iy = ~~(i2 / dimen2);
        let x = util.random(), y = util.random();
        //let x = ix/dimen2, y = iy/dimen2;
        //x += (util.random()-0.5)/dimen2/3.0;
        //y += (util.random()-0.5)/dimen2/3.0;
        
        let pi = ps.length;
        for (let j=0; j<PTOT; j++) {
          ps.push(0.0);
        }
        
        let ff = genstart / totpoint;
        
        let gen = i/totpoint;
        gen = ctx.GENSTART + gen*(1.0 - ctx.GENSTART);
        //gen = ff + gen*(1.0 - ff);
        
        if (ctx.TONE_IN_SOLVER) {
          gen = ctx.tonefunc(gen, ctx);
        } else {
          //gen = Math.sqrt(gen);
          gen = Math.pow(gen, ctx.PREPOWER);
        }
        
        let r = 0.8 / Math.sqrt(genstart + gen*totpoint);
        
        
        ps[pi] = x;
        ps[pi+1] = y;
        ps[pi+PGEN] = gen;
        ps[pi+POGEN] = gen;
        ps[pi+PR] = r;
        
        ps[pi+PIX] = ~~(ps[pi]*mw);
        ps[pi+PIY] = ~~(ps[pi+1]*mh);
        
        this.r = this.r === undefined ? r : Math.min(r, this.r);
      }
      
      //XXX get rid of prior radius calculations 
      this.r = 1.0 / Math.sqrt(this.points.length/PTOT);
    }
    /*
    makeKDTree() {
      let kd = this.kdtree = new kdtree.KDTree([-2.5, -2.5, -2.5], [2.5, 2.5, 2.5]);
      
      let ps = this.points;
      let co = [0, 0, 0];
      let visit = {};
      let totpoint = 0;

      while (totpoint < ps.length/PTOT) {
        let pi = ~~(Math.random()*0.999999*ps.length/PTOT);
        if (pi in visit) {
          continue;
        }
        
        visit[pi] = 1;
        pi *= PTOT;
        totpoint++;
        
      //for (let pi=0; pi<ps.length; pi += PTOT) {
        kd.insert(ps[pi], ps[pi+1], pi);
      }
      
      return kd;
    }//*/

    updateVelocity(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let fac = ctx.DV_DAMPING;
        let dx, dy, mindv=1e17;

        //calc derivatives.  complicated by toroidal domain
        for (let off of gridoffs) {
          let dx2 = ps[pi] - (ps[pi+POLDX] + off[0]);
          let dy2 = ps[pi+1] - (ps[pi+POLDY] + off[1]);
          let dis = dx2*dx2 + dy2*dy2;
          
          if (dis < mindv) {
            mindv = dis;
            ps[pi+PDX] = dx2;
            ps[pi+PDY] = dy2;
          }
        }
        
        ps[pi+PDX] *= fac;
        ps[pi+PDY] *= fac;
        
        ps[pi+POLDX] = ps[pi];
        ps[pi+POLDY] = ps[pi+1];
      }
    }
    
    applyVelocity(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        ps[pi] += ps[pi+PDX];
        ps[pi+1] += ps[pi+PDY];
        
        ps[pi] = Math.fract(ps[pi]);
        ps[pi+1] = Math.fract(ps[pi+1]);
      }
    }
    
    calcRadii(ctx) {
      if (!cconst.USE_MASK) {
        return;
      }
      
      let tree = this.regen_spatial();
      let totpoint = this.points.length/PTOT;
      let ps = this.points;
      
      this.r = 0.5 / Math.sqrt(totpoint);
      let sumdis = 0.0, sumtot = 0.0, searchr, x1, y1, gen1, pi;
      
      let callback = (pi2) => {
        if (pi2 == pi) {
          return;
        }
        let x2 = ps[pi2], y2 = ps[pi2+1], gen2 = ps[pi2+PGEN];
        
        let dx = x2-x1, dy = y2-y1;
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0 || dis > searchr*searchr) {
          return;
        }
        
        if (gen2 > gen1) {
          return;
        }
        
        dis = Math.sqrt(dis);
        
        let w = 1.0 - dis/searchr;
        
        w = w*w*w;
        let w2 = (1.0 + gen1) / (1.0 + gen2);
        w *= w2*w2;
        
        sumdis += dis*w;
        sumtot += w;
      }
      
      let minr = undefined;
      
      for (pi=0; pi<ps.length; pi += PTOT) {
        x1 = ps[pi], y1 = ps[pi+1], gen1 = ps[pi+PGEN];
        let r = 6.0 / Math.sqrt(ps.length/PTOT*0.075 + gen1*ps.length/PTOT);
        
        searchr = r;
        sumdis = sumtot = 0.0;
        tree.forEachPoint(x1, y1, searchr, callback);
        
        if (sumtot != 0.0) {
          r = sumdis / sumtot * 0.5; //why do I have to multiply by 1/2?
          ps[pi+PR] = r;
          
          minr = minr === undefined ? r : Math.min(minr, r);
        } else { //estimate
          r = 1.5 / Math.sqrt(ps.length/PTOT*0.075 + gen1*ps.length/PTOT);
          ps[pi+PR] = r;
        }
        
        /*
        r = 0.9 / Math.sqrt(ps.length/PTOT);
        ps[pi+PR] = r;
        //*/
      }
      
      this.r = minr;
    }
    
    jitter() {
      let ps = this.points;
      let size = this.r;
      
      for (let i=0; i<ps.length; i += PTOT) {
        ps[i] += (util.random()-0.5)*2.0*size;
        ps[i+1] += (util.random()-0.5)*2.0*size;
        
        ps[i] = Math.min(Math.max(ps[i], 0.0), 1.0);
        ps[i+1] = Math.min(Math.max(ps[i+1], 0.0), 1.0);
      }
    }
    
    updateFinalGen(ctx) {
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+PGEN];
        
        gen = gen_curve_inv(gen, ctx);
        gen = gen != 0.0 ? Math.pow(gen, 1.0 / ctx.PREPOWER) : 0.0;
        gen = (gen - ctx.GENSTART) / (1.0 - ctx.GENSTART);
        
        ps[pi+PGEN] = gen;
      }
    }
    
    step(custom_steps, noreport) {
      let ctx = this.config;
      
      this.applyVelocity(ctx);
      this.smooth_intern(ctx);
      this.updateFinalGen(ctx);
      this.updateVelocity(ctx);
      
      this.raster();
      this.tick++;
    }
    
    smooth_intern(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      window.minfac = window.maxfac = undefined;
      
      let param = 0.5 + this.tick*0.125;
      
      param = Math.min(param, ctx.PARAM);
      window.param = param;
      
      const thresh = ctx.START_THRESHOLD;
      let ps = this.points;
      
      let searchfac = ctx.SEARCHRAD;
      let speed = ctx.SPH_SPEED;
      
      let sumdx, sumdy, sumw, sumtot, x1, y1, r1, pi1, gen1, searchr, off;
      let testgen;
      
      let tree = this.regen_spatial();
      
      this.totbase = 0;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+POGEN];
        
        ps[pi+PGEN] = gen_curve(gen, ctx);
        
        if (ps[pi+PGEN] < thresh) {
          this.totbase++;
        }
        
        ps[pi+POLDX] = ps[pi];
        ps[pi+POLDY] = ps[pi+1];
      }
      
      let callback = (pi2) => {
        if (pi2 == pi1) {
          return;
        }
        
        let x2 = ps[pi2+POLDX], y2 = ps[pi2+POLDY], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN];
        let searchr2 = searchr;
        
        let dx = x1+off[0] - x2, dy = y1+off[1] - y2;
        let dis = dx*dx + dy*dy;
        
        if (testgen) {
        //  searchr2 = this.r * ((a+dd) / (b+dd) * ctx.PARAM + ctx.PARAM2);
        }
        
        if (dis == 0.0) {// || dis > searchr2*searchr2) {
          return;
        }
        
        dis = Math.sqrt(dis);
        let w = 1.0 - dis / searchr2;

        //*
        if (gen2 > gen1 && (testgen || ctx.PROG_BASE_LAYER)) { //ctx.PROG_BASE_LAYER && !testgen && gen2 > gen1) {
          //w *= 0.7;
          
          if (!testgen) {
            let f = (gen1-gen2) / thresh;
            w *= f;
            //w *= 0.0;
            //dis *= 0.0;
            return;
          }
          //return;
        } else if (!ctx.PROG_BASE_LAYER && !testgen && gen2 > thresh) {
          w *= 0.0;
          dis *= 0.0;
          //return;
        }//*/
        
        if (/*ctx.PROG_BASE_LAYER ||*/ testgen) {
          //so, this little equation actually *works*.  bleh!
          let a = gen1, b = gen2;
          a = Math.pow(a, ctx.PARAM4);
          b = Math.pow(b, ctx.PARAM4);
          //a = ctx.SPH_CURVE.evaluate(a);
          //b = ctx.SPH_CURVE.evaluate(b);
          
          //let a = r2, b = r1;
          
          //this one works too.  why?
          //let dd = (1.0-b)*ctx.PARAM3 + 0.01;
          
          let dd = ctx.PARAM3*this.r + 0.000001;
          //let r = 0.8 / Math.sqrt(this.points.length/PTOT+1);
          
          let fac = (b+dd) / (a+dd);
          //dd = ctx.PARAM3
          //w = Math.pow(w, ctx.PARAM2 + param*fac);
          
          fac = param*fac + ctx.PARAM2 + 0.0001;
          if (isNaN(fac)) {
            throw new Error("NaN");
          }
          
          if (isNaN(w)) {
            console.log(dis, searchr);
            throw new Error("NaN");
          }
          
          let w0 = w;
          //w = Math.exp(-(1.0-w)/(fac*fac));
          //w = Math.exp(-dis*ctx.PARAM*(b+dd)/(a+dd));
          
          //w = 1.0 / (1.0 + dis*ctx.PARAM); //*(a+dd)/(b+dd));
          
          //w = Math.pow(w, fac);
          
          //w = dis/searchr;
          
          fac = (b + dd) / (a + dd);

          let max = 1.0 / (ctx.PARAM3*this.r);
          //fac = Math.pow(fac/max, 2.0)*max;
          
          //fac = ctx.SPH_CURVE.evaluate(fac/max)*max;
          //w = w * (1.0 + ctx.SPH_CURVE.evaluate(fac/max));
          
          minfac = minfac === undefined ? fac : Math.min(minfac, fac);
          maxfac = maxfac === undefined ? fac : Math.max(maxfac, fac);
          
          fac = fac*param + ctx.PARAM2;
          //w = Math.pow(w, fac);
          //w = ctx.SPH_CURVE.evaluate(w);
          w = Math.exp(w*fac) / Math.exp(fac);
          
          if (isNaN(w)) {
            console.log(w0, dis, fac);
            throw new Error("NaN");
          }
          //w *= w*w*w;
          
        } else {
          //w = ctx.SPH_CURVE.evaluate(w);
          w = Math.pow(w, 5.0);
        }
        
        if (isNaN(w)) {
          w = 0.0;
        }
        //if (isNaN(w)) {
        //  throw new Error("NaN");
        //}
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1.0;
      } 
      
      let maxr = undefined; 
      let threshtot = 0.0;
      
      for (let pi1=0; pi1<ps.length; pi1 += PTOT) {
        let r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN];
        
        threshtot += gen1 < thresh;
        
        maxr = maxr === undefined ? r1 : Math.max(r1, maxr);
      }
      
      let startr = 0.8 / Math.sqrt(threshtot+1);
      let do_startlvl = Math.random() < 0.2;
      let mw = this.mask_img.width, mh = this.mask_img.height;
      
      //for (let _i=0; _i<ps.length; _i += PTOT) {
      //  pi1 = Math.floor(Math.random()*0.99999*ps.length/PTOT)*PTOT;
        
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        x1 = ps[pi1+POLDX], y1 = ps[pi1+POLDY], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN];
        
        let searchr3;
        
        //make sure initial "layer" is uniform
        if (gen1 < thresh) {
          if (!do_startlvl) {
            //continue;
          }
          
          //r1 = startr;
          //searchr = startr*ctx.SEARCHRAD2;
          
          searchr = r1*ctx.SEARCHRAD2;
          searchr3 = searchr;
          
          testgen = false;
        } else {
          let fac = threshtot / (ps.length / PTOT);
          
          let gen = gen1*ps.length/PTOT;
          gen += threshtot;
          
          r1 = 0.9 / Math.sqrt(ps.length/PTOT);
          
          testgen = true;
          searchr = r1*searchfac;

          /*
          searchr3 = 0.9 / Math.sqrt(gen) * ctx.SEARCHRAD2;
          searchr3 = searchr3 != 0.0 ? Math.pow(searchr3, 2.0) : 0.0;
          searchr3 = Math.max(searchr3, searchr);
          //*/
          
          searchr3 = searchr;
        }
        
        //searchr = this.r * searchfac * 2.5;
        sumdx = sumdy = sumw = sumtot = 0.0;
        
        //off = gridoffs[0];
        for (off of gridoffs) {
          tree.forEachPoint(x1+off[0], y1+off[1], searchr3, callback);
        }
        if (sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        let fac = speed*0.1//*Math.pow(0.01 + gen1, 2.0);
        
        if (gen1 < thresh) {
          fac *= ctx.PROG_BASE_LAYER ? 0.05 : 0.45;
        }
        
        ps[pi1] += sumdx*fac;
        ps[pi1+1] += sumdy*fac;
        
        ps[pi1] = Math.fract(ps[pi1]);
        ps[pi1+1] = Math.fract(ps[pi1+1]);
        
        ps[pi1+PIX] = ~~(ps[pi1]*mw);
        ps[pi1+PIY] = ~~(ps[pi1+1]*mh);
        
        //ps[pi1] = Math.min(Math.max(ps[pi1], 0.0), 1.0);
        //ps[pi1+1] = Math.min(Math.max(ps[pi1+1], 0.0), 1.0);
      }
    }
    
    draw(g) {
      let d = 0.5;
      //g.clearRect(-d, -d, 1+d*2, 1+d*2);
      
      let ps = this.points;
      let r = this.r*DRAW_RMUL;
      
      for (let off of gridoffs) {
        if ((off[0] != 0.0 || off[1] != 0.0) && !DRAW_TILED) {
          continue;
        }
        
        for (let pi=0; pi<ps.length; pi += PTOT) {
          let x = ps[pi]+off[0], y = ps[pi+1]+off[1], gen = ps[pi+POGEN];
          
          if (DRAW_OFFS) {
            x += ps[pi+POFFX];
            y += ps[pi+POFFY];
          }

          if (gen > DRAW_RESTRICT_LEVEL) {
            continue;
          }
          
          g.beginPath();
          g.moveTo(x, y);
          g.arc(x, y, r*0.5, -Math.PI, Math.PI);
          
          let f1 = gen, f2 = gen*0.5;
          
          f1 = ~~(f1*255);
          f2 = ~~(f2*255);
          g.fillStyle = "rgb("+f1+","+f2+",0, 1.0)";
          g.fill();
        }
      }
    }
    
    toggle_timer_loop(appstate, simple_mode) {
        if (appstate.timer != undefined) {
          window.clearInterval(appstate.timer);
          appstate.timer = undefined;
          return;
        } 
        
        var start = util.time_ms();
        var first = util.time_ms();

        var lasttot = 0;
        var totsame = 0;
        
        appstate.timer = window.setInterval(() => {
          if (util.time_ms() - start < 80) {
            return;
          }
          
          this.config.update();
          
          var start2 = util.time_ms();
          var report1 = 0;
          
          while (util.time_ms() - start2 < 150) {
            appstate.step(undefined, report1++);
          }
          
          redraw_all();
          
          var t = util.time_ms() - first;
          t = (t/1000.0).toFixed(1);
          
          this.report("time elapsed: ", t + "s");
          start = util.time_ms();
        }, 100);
    }
  }
  
  return exports;
});
