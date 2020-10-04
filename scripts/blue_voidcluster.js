var _bluevc = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _bluevc = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  let config = exports.config = {
    BLUEVC_TOTPOINT_MUL : 0.75,
    BLUEVC_POISSON_TEST : true,
    BLUEVC_FILTERWID    : 2,
    BLUEVC_RADIUS_MUL   : 0.95,
    BLUEVC_GENSTART     : 0.0001,
    BLUEVC_STEPSMUL     : 3.0,
    BLUEVC_BRIGHTNESS   : 1.0,
    BLUEVC_DRAW_RADII   : false,
    BLUEVC_RAD_CURVE    : new cconst.EditableCurve("BlueVC Radius Curve", {"points":[{"0":0,"1":0.06874999999999998,"eid":30,"flag":0,"deg":3,"tangent":1},{"0":0.1312499999999999,"1":0.34375,"eid":72,"flag":0,"deg":3,"tangent":1},{"0":0.2500000000000001,"1":0.8125,"eid":75,"flag":0,"deg":3,"tangent":1},{"0":0.3562500000000002,"1":0.8750000000000002,"eid":73,"flag":0,"deg":3,"tangent":1},{"0":0.5,"1":0.8562500000000001,"eid":76,"flag":1,"deg":3,"tangent":1},{"0":0.5500000000000002,"1":0.9812500000000001,"eid":74,"flag":1,"deg":3,"tangent":1},{"0":0.5812499999999999,"1":0.24375000000000002,"eid":2,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":77}}), 
    BLUEVC_CURVE        : new cconst.EditableCurve("BlueVC Filter Curve", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.36250000000000004,"1":0,"eid":104,"flag":0,"deg":3,"tangent":1},{"0":0.5312500000000001,"1":0.1812499999999998,"eid":103,"flag":0,"deg":3,"tangent":1},{"0":0.64375,"1":0.11250000000000004,"eid":102,"flag":0,"deg":3,"tangent":1},{"0":0.9750000000000002,"1":0.3437500000000001,"eid":101,"flag":1,"deg":3,"tangent":1},{"0":1,"1":0.9937500000000001,"eid":106,"flag":0,"deg":3,"tangent":1},{"0":1,"1":0.9875,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":108}}),
    BLUEVC_GEN_CURVE : new cconst.EditableCurve("BlueVC Tone Curve", {"points":[{"0":0.012500000000000039,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.05625000000000008,"1":0.09375,"eid":20,"flag":0,"deg":3,"tangent":1},{"0":0.21249999999999988,"1":0.36875000000000013,"eid":21,"flag":1,"deg":3,"tangent":1},{"0":0.6062500000000001,"1":0.675,"eid":19,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":22}})
  };
  
  var BlueVCGenerator = exports.BlueVCGenerator = class BlueVCGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
      this.skip_point_draw = true;
      
      this.cur = 0;
    }
    
    static build_ui(gui) {
      let panel2 = gui.panel("BlueVC");
      
      panel2.slider('BLUEVC_FILTERWID', 'Filter Width', 2.0, 0.0001, 15.0, 0.001, false, false);
      panel2.slider('BLUEVC_BRIGHTNESS', 'Brightness', 2.0, 0.0001, 5.0, 0.001, false, false);
      panel2.slider('BLUEVC_STEPSMUL', 'Extra Steps', 1.0, 0.0001, 35.0, 0.001, false, false);
      panel2.slider('BLUEVC_TOTPOINT_MUL', 'TotalPointMul', 1.0, 0.0001, 1.0, 0.00001, false, false);
      panel2.slider('BLUEVC_GENSTART', 'genstart', 0.05, 0.0001, 1.0, 0.00001, false, false);
      panel2.slider('BLUEVC_RADIUS_MUL', 'Radius Mul', 0.95, 0.0001, 1.5, 0.00001, false, false);
      
      
      
      panel2.check('BLUEVC_POISSON_TEST', "Poisson Mode");
      panel2.check('BLUEVC_DRAW_RADII', "Draw Radii");
      
      let panel3 = panel2.panel("Filter Curve");
      
      //need to finish config refactor so I'm not putting things in window in such a hackish way as this
      window.BLUEVC_CURVE = panel3.curve("BLUEVC_CURVE", "Filter Curve", cconst.DefaultCurves.BLUEVC_CURVE).curve;
      panel3.close();
      
      panel3 = panel2.panel("Pre-tone Curve");
      window.BLUEVC_GEN_CURVE = panel3.curve("BLUEVC_GEN_CURVE", "Tone Curve", cconst.DefaultCurves.BLUEVC_GEN_CURVE).curve;
      panel3.close();
      
      panel3 = panel2.panel("Radius Curve");
      window.BLUEVC_RAD_CURVE = panel3.curve("BLUEVC_RAD_CURVE", "BlueVC Radius Curve", cconst.DefaultCurves.BLUEVC_RAD_CURVE).curve;
      panel3.close();
      
      panel2.close();
    }
    
    current_level() {
      return 0;
    }
    
    done() {
      return this.cur >= this.maxpoints;
    }
    
    max_level() {
      return this.maxgen;
    }
    
    draw(g) {
      super.draw(g);
      
      let d = 0.5;
      //g.clearRect(-d, -d, 1+d*2, 1+d*2);
      
      let ps = this.points;
      let r = this.r*DRAW_RMUL;
      
      for (let off of _poffs) {
        if ((off[0] != 0.0 || off[1] != 0.0) && !DRAW_TILED) {
          continue;
        }
        
        for (let pi=0; pi<ps.length; pi += PTOT) {
          let x = ps[pi]+off[0], y = ps[pi+1]+off[1], gen = ps[pi+PGEN];
          
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
          
          gen = 1.0 - gen;
          let f1 = gen, f2 = gen*0.5;
          
          f1 = ~~(f1*255);
          f2 = ~~(f2*255);
          g.fillStyle = "rgb("+f1+","+f2+",0, 1.0)";
          g.fill();
          
          if (BLUEVC_DRAW_RADII) {
            g.beginPath();
            g.moveTo(x, y);
            g.arc(x, y, ps[pi+PR], -Math.PI, Math.PI);
            
            g.fillStyle = "rgba("+f1+","+f2+",0, 0.1)";
            g.fill();
          }
        }
      }
    }

    reset(size, appstate, mask_image) {
      super.reset(size, appstate, mask_image);
      
      util.seed(0);
      
      this.cur = 0;
      this.maxgen = 1.0;
      this.dimen = size;
      this._done = false;
      
      let totpoint = this.totpoint = ~~(size*size*this.config.BLUEVC_TOTPOINT_MUL);
      this.maxpoints = totpoint;
      
      //XXX am I using this particular radius calculation? or overriding it somewhere?
      //this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
      
      this.final_r = this.r = 0.8 / Math.sqrt(totpoint);
      
      this.throw();
    }
    
    max_level() {
      return 1.0;
    }
    
    done() {
      return false;
    }
    
    throw() {
      let steps = this.totpoint;
      let ps = this.points;
      
      let r = this.final_r;
      let msize = this.mask_img.width;
      
      for (let i=0; i<steps; i++) {
        let pi = ps.length;
        
        for (let j=0; j<PTOT; j++) {
          ps.push(0);
        }
        
        let x = util.random(), y = util.random();
        
        ps[pi+PDX] = 0; //tag as not processed yet
        
        ps[pi] = x;
        ps[pi+1] = y;
        ps[pi+PR] = r;
        ps[pi+PGEN] = 1.0;
        
        ps[pi+PIX] = ~~(ps[pi]*msize);
        ps[pi+PIY] = ~~(ps[pi+1]*msize);
        
        this.find_mask_pixel(0, pi);
      }
      
      steps = 12;
      for (let i=0; i<steps; i++) {
        let f = (1.0 - i/steps);
        
        f = f*0.5 + 0.5;
        
        this.relax(undefined, undefined, 1.0 + f*5.5);
      }
      
      for (let i=0; i<steps; i++) {
        this.relax();
      }
      
      this.tonePoints();
      this.regen_spatial();
      this.raster();
    }
    
    step_intern() {
      let ps = this.points;
      
      let cf = this.config;
      let pi1, sumw, sumtot, r1, x1, y1, off, searchr;
      let searchfac = cf.BLUEVC_FILTERWID;
      let bad;
      
      let callback = (pi2) => {
        if (pi1 == pi2) 
          return;
        
        if (ps[pi2+PDX] == 0)
          return;
        
        let dx = ps[pi2] - x1, dy = ps[pi2+1] - y1;
        let dis = dx*dx + dy*dy;
        
        if (isNaN(dis)) {
          throw new Error("NaN!");
        }
        
        if (dis >= searchr*searchr) {
          return;
        }
        
        if (cf.BLUEVC_POISSON_TEST && dis < r1*r1) {
          bad = true;
          //return;
          //return true;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        //w = Math.abs(w);
        
        w = cf.BLUEVC_CURVE.evaluate(w);
        
        sumw += w;
        sumtot++;
      }
      
      let minw = undefined, minpi = undefined, minr = undefined, mingen = undefined;
      let tree = this.regen_spatial();
      
      let totpoint = ps.length/PTOT;
      for (let _i=0; _i<totpoint; _i++) {
        pi1 = Math.floor(Math.random()*0.9999999*totpoint)*PTOT;
        
      //for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        if (ps[pi1+PDX] != 0) {
          continue;
        }
        
        let gen = this.cur/this.maxpoints;
        
        gen = cf.BLUEVC_RAD_CURVE.evaluate(gen);
        
        //let rgen = 1.0 - Math.min((1.0-gen) + cf.BLUEVC_GENSTART, 1.0 - cf.BLUEVC_GENSTART);
        let rgen = gen*(1.0 - cf.BLUEVC_GENSTART) + cf.BLUEVC_GENSTART;
        
        let r = cf.BLUEVC_RADIUS_MUL / Math.sqrt(Math.floor(rgen*this.maxpoints) + 1);
        //r = this.final_r;
        
        searchr = r*searchfac;
        sumw = sumtot = 0.0;

        //r1 = r//searchr;
        r1 = cf.BLUEVC_RADIUS_MUL / Math.sqrt(this.cur+1);
        
        //let off = [0, 0];
        bad = false;
        
        for (off of _poffs) {
          x1 = ps[pi1] + off[0], y1 = ps[pi1+1] + off[1];
          
          tree.forEachPoint(x1, y1, searchr, callback);
        }
        
        if (sumtot != 0.0) {
          sumw /= sumtot;
        }
        
        if (bad) {
          sumw += 10.0;
          //continue;
        }
        
        if (sumw < 0.0) {
          throw new Error(sumw);
        }
        
        if (minw === undefined || sumw < minw) {// || (sumw == minw && Math.random() > 0.5)) {
          minw = sumw;
          minpi = pi1;
          minr = r1;
          mingen = this.cur/this.maxpoints;
        }
      }
      
      if (minw === undefined) {
        if (Math.random() > 0.9999) {
          console.log("eek!");
        }
        return;
      }
      
      //console.log("minw", minw, minpi);
      
      ps[minpi+PDX] = 1;
      ps[minpi+POGEN] = ps[minpi+PGEN] = mingen; //ps[minpi+PGEN] = this.cur / this.maxpoints;
      ps[minpi+PR] = minr;
      
      this.cur++;
    }
    
    step(custom_steps) {
      custom_steps = custom_steps === undefined ? STEPS : custom_steps;
      custom_steps = Math.min(custom_steps, 128);
      
      for (let i=0; i<custom_steps; i++) {
        this.step_intern();
      }
      
      this.regen_spatial();
      this.raster();
      this.tonePoints();
      
      this.report("Finished points:", this.cur, "of", this.maxpoints);
    }
    
    tonePoints() {
      return; //XXX
      
      let ps = this.points;
      let cf = this.config;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+POGEN]/this.maxgen;
        let d = 0.3; //stupid hack to fix cut off error
        
        ps[pi+PGEN] = cf.BLUEVC_GEN_CURVE.evaluate(gen)*this.maxgen*BLUEVC_BRIGHTNESS;
      }
    }
    
    raster() {
      this.tonePoints();
      super.raster();
    }
  };
  
  sinterface.MaskGenerator.register(config, BlueVCGenerator, "BLUEVC");
  
  return exports;
});
