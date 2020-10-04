var _smoothedmask = undefined;

define([
  "util", "vectormath", "kdtree", "const", "linear_algebra", "binomial_table", "smoothmask", "interface", "void_cluster", "mitchell", "darts", "indexdb_store", "ui", "./sph_progressive_noise_5/scripts/sph",
  "./sph_progressive_noise_5/scripts/const"
], function(util, vectormath, kdtree, cconst, linalg, binomial_table, smoothmask, sinterface, 
            void_cluster, mitchell, darts, indexdb_store, ui, sph5, sph5_const)
{
  "use strict";
  let exports = _smoothedmask = {};
  
  //for compatibility with sph5
  if (window.POX !== undefined) {
    window.PSTARTX = POX;
    window.PSTARTY = POY;
  } else {
    window.PSTARTX = window.PSTARTY = 0;
  }
  
  sph5_const.headlessLoad(undefined, ui);
  
  let SmoothModes = exports.SmoothModes = {
    SIMPLE  : 1,
    POLYFIT : 2
  };
  /*
  let config = exports.config = {
    SM_SPH_CURVE  :  new cconst.EditableCurve("SM_SPH_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.6625,"1":0.06875000000000009,"eid":5,"flag":0,"deg":3,"tangent":1},{"0":0.8687500000000001,"1":0,"eid":4,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":7}}),
    SM_GEN_CURVE  : new cconst.EditableCurve("SM_GEN_CURVE"),
    SM_TONE_CURVE  :  new cconst.EditableCurve("SM_TONE_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.4062500000000001,"1":0.2250000000000001,"eid":19,"flag":0,"deg":3,"tangent":1},{"0":0.6,"1":0.55625,"eid":20,"flag":1,"deg":3,"tangent":1},{"0":1,"1":0.76875,"eid":18,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":21}}),
    SM_IMAGE_CURVE  : new cconst.EditableCurve("SM_SPH_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3125000000000001,"1":0.24375000000000013,"eid":4,"flag":0,"deg":3,"tangent":1},{"0":0.6937500000000001,"1":0.5687500000000001,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":0.99375,"1":0.78125,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":6}}),
    PATH_DEGREE  :  4,
    DRAW_TEST  :  true,
    MAX_SCALE  :  8,
    SM_RADMUL  :  0.95,
    PATH_SMOOTH_FACTOR  :  0.092,
    SIMPLE_MODE  :  true,
    DISPLAY_LEVEL  :  1,
    SOLVE_LEVEL  :  1,
    SM_DV_DAMPING  :  1,
    SM_GENSTART  :  0.025,
    PULL_FACTOR  :  0.378,
    RANGE  :  128,
    REPEAT  :  10,
    SM_SPH_SPEED2 : 4.0,
    SHOW_PATHS  :  true,
    STARTCO_BLEND  :  1,
    PRESTEPS  :  35,
    UPDATE_START_COS  :  false,
    SM_SEARCHRAD  :  1.5,
    SM_SEARCHRAD2  :  3.96,
    ADV_SOLVE  :  true,
    ADV_STEPS  :  5,
    SM_TOTPOINT_MUL  :  0.95,
    SM_PREPOWER  :  0.6,
  };*/
/*
  let config = exports.config = {
    SM_SPH_CURVE  :  new cconst.EditableCurve("SM_SPH_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.6062500000000001,"1":0.04375000000000018,"eid":9,"flag":1,"deg":3,"tangent":1},{"0":0.6625,"1":0.06875000000000009,"eid":5,"flag":0,"deg":3,"tangent":1},{"0":0.8125000000000001,"1":0.1875,"eid":4,"flag":1,"deg":3,"tangent":1},{"0":0.9125,"1":0.3437500000000002,"eid":8,"flag":0,"deg":3,"tangent":1},{"0":0.9249999999999999,"1":0.9125000000000001,"eid":7,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":10}}),
    SM_GEN_CURVE  :  {"uiname":"SM_GEN_CURVE"},
    SM_TONE_CURVE  :  new cconst.EditableCurve("SM_TONE_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3187500000000001,"1":0.1875000000000001,"eid":19,"flag":0,"deg":3,"tangent":1},{"0":0.6,"1":0.55625,"eid":20,"flag":0,"deg":3,"tangent":1},{"0":0.8250000000000001,"1":0.7812500000000001,"eid":18,"flag":1,"deg":3,"tangent":1},{"0":0.9062500000000001,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":21}}),
    SM_IMAGE_CURVE  :  new cconst.EditableCurve("SM_IMAGE_CURVE", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3125000000000001,"1":0.24375000000000013,"eid":4,"flag":0,"deg":3,"tangent":1},{"0":0.6937500000000001,"1":0.5687500000000001,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":0.99375,"1":0.78125,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":6}}),
    SM_G_CURVE : new cconst.EditableCurve("SM_G_CURVE"),
    PATH_DEGREE  :  4,
    DRAW_TEST  :  true,
    MAX_SCALE  :  8,
    SM_RADMUL  :  0.95,
    SM_START_GENERATOR : MODES.VOID_CLUSTER,
    PATH_SMOOTH_FACTOR  :  0.057,
    SIMPLE_MODE  :  true,
    DISPLAY_LEVEL  :  1,
    SOLVE_LEVEL  :  1,
    SM_DV_DAMPING  :  1,
    SM_GENSTART  :  0.025,
    PULL_FACTOR  :  0.28600000000000003,
    RANGE  :  127,
    SOLVE_RANGE_MUL : 2,
    REPEAT  :  4,
    SM_SPH_SPEED  :  4.5,
    SM_SPH_SPEED2  :  8.25,
    SHOW_PATHS  :  true,
    STARTCO_BLEND  :  1,
    PRESTEPS   : 15,
    PRESTEPS2  :  15,
    UPDATE_START_COS  :  true,
    SM_SEARCHRAD  :  2.45,
    SM_SEARCHRAD2  :  3.96,
    SM_PRE_PARAM   : 0.001,
    ADV_SOLVE  :  true,
    ADV_STEPS2  :  4,
    ADV_STEPS  :  2,
    SM_TOTPOINT_MUL  :  0.95,
    SM_PREPOWER  :  1,
    SM_G_POW     : 3,

    SMOOTH_REPEAT  :  1,
    SMOOTH_WID     : 0.1,
    SMOOTH_PULSE_RATE : 0.1,
    SMOOTH_PULSE_FAC  : 1.0,
    SMOOTH_PULSE_STEPS : 3,
    SMOOTH_PULSE : false
  };
  */
  /*
   let config = exports.config = {
    SM_SPH_CURVE  :  new cconst.EditableCurve("SM_SPH_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_SPH CurveSM_SPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.31875,"1":0,"eid":30,"flag":0,"deg":3,"tangent":1},{"0":0.7625,"1":0,"eid":29,"flag":1,"deg":3,"tangent":1},{"0":0.81875,"1":0.83125,"eid":32,"flag":0,"deg":3,"tangent":1},{"0":0.9375000000000001,"1":1,"eid":34,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":35}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_GEN_CURVE  :  {"uiname":"SM_GEN_CURVE"},
    SM_TONE_CURVE  :  new cconst.EditableCurve("SM_TONE_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Tone CurveSM_TONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.65,"1":0.68125,"eid":86,"flag":1,"deg":3,"tangent":1},{"0":0.9624999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":87}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_IMAGE_CURVE  :  new cconst.EditableCurve("SM_IMAGE_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Image CurveSM_IMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3125000000000001,"1":0.24375000000000013,"eid":4,"flag":0,"deg":3,"tangent":1},{"0":0.6937500000000001,"1":0.5687500000000001,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":0.99375,"1":0.78125,"eid":3,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":6}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_RADIUS_CURVE  :  new cconst.EditableCurve("SM_RADIUS_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Radius CurveSM_RADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":3}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    PATH_DEGREE  :  3,
    DRAW_TEST  :  true,
    MAX_SCALE  :  8,
    SM_RADMUL  :  0.95,
    SM_START_GENERATOR  :  2,
    PATH_SMOOTH_FACTOR  :  0.21,
    SIMPLE_MODE  :  true,
    DISPLAY_LEVEL  :  1,
    SOLVE_LEVEL  :  0.973,
    SM_DV_DAMPING  :  0,
    SM_GENSTART  :  0.01,
    PULL_FACTOR  :  0.355,
    RANGE  :  129,
    SOLVE_RANGE_MUL  :  1,
    SM_RANDOM_ORDER : false,
    REPEAT  :  14,
    SM_SPH_SPEED  :  2,
    SM_SPH_SPEED2  :  1,
    SM_PRE_RAND  :  0.00001,
    SHOW_PATHS  :  true,
    STARTCO_BLEND  :  1,
    PRESTEPS  :  55,
    PRESTEPS2  :  0,
    UPDATE_START_COS  :  false,
    SM_SEARCHRAD  :  2.32,
    SM_SEARCHRAD2  :  1.3,
    SM_PRE_PARAM  :  2,
    ADV_SOLVE  :  true,
    ADV_STEPS2  :  3,
    ADV_STEPS  :  2,
    SM_TOTPOINT_MUL  :  0.85,
    SM_PREPOWER  :  1,
    SM_G_POW  :  0.5,
    SMOOTH_REPEAT  :  1,
    SMOOTH_WID  :  8.59,
    SMOOTH_PULSE_RATE  :  0.52,
    SMOOTH_PULSE_FAC  :  1,
    SMOOTH_PULSE_STEPS  :  3,
    SMOOTH_PULSE  :  false,
    START_FACTOR  :  0.584,
    GEN_RANGE  :  4096,
  };*/

  let config = {
    SM_SPH_CURVE  :  new cconst.EditableCurve("SM_SPH_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_SPH CurveSM_SPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.31875,"1":0,"eid":30,"flag":0,"deg":3,"tangent":1},{"0":0.7625,"1":0,"eid":29,"flag":1,"deg":3,"tangent":1},{"0":0.81875,"1":0.83125,"eid":32,"flag":0,"deg":3,"tangent":1},{"0":0.9375000000000001,"1":1,"eid":34,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":35}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_GEN_CURVE  :  {"uiname":"SM_GEN_CURVE"},
    SM_TONE_CURVE  :  new cconst.EditableCurve("SM_TONE_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Tone CurveSM_TONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.65,"1":0.68125,"eid":86,"flag":1,"deg":3,"tangent":1},{"0":0.9624999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":87}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_IMAGE_CURVE  :  new cconst.EditableCurve("SM_IMAGE_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Image CurveSM_IMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3125000000000001,"1":0.24375000000000013,"eid":4,"flag":0,"deg":3,"tangent":1},{"0":0.6937500000000001,"1":0.5687500000000001,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":0.99375,"1":0.78125,"eid":3,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":6}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    SM_RADIUS_CURVE  :  new cconst.EditableCurve("SM_RADIUS_CURVE", {"is_new_curve":true,"setting_id":"bn9_gui2_Smoothed Mask_Radius CurveSM_RADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.32499999999999996,"1":0.6374999999999998,"eid":7,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":9}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":0}),
    PATH_DEGREE  :  3,
    DRAW_TEST  :  true,
    MAX_SCALE  :  8,
    SM_RADMUL  :  1,
    SM_START_GENERATOR  :  2,
    PATH_SMOOTH_FACTOR  :  0.748,
    SIMPLE_MODE  :  true,
    DISPLAY_LEVEL  :  1,
    SOLVE_LEVEL  :  1,
    SM_DV_DAMPING  :  0,
    SM_GENSTART  :  0.01,
    PULL_FACTOR  :  0.5630000000000001,
    RANGE  :  185,
    SOLVE_RANGE_MUL  :  1,
    SM_RANDOM_ORDER  :  true,
    REPEAT  :  11,
    SM_SPH_SPEED  :  8.45,
    SM_SPH_SPEED2  :  4.23,
    SM_PRE_RAND  :  0.00001,
    SHOW_PATHS  :  true,
    STARTCO_BLEND  :  1,
    PRESTEPS  :  55,
    PRESTEPS2  :  20,
    UPDATE_START_COS  :  true,
    SM_SEARCHRAD  :  2.49,
    SM_SEARCHRAD2  :  2,
    SM_PRE_PARAM  :  2,
    ADV_SOLVE  :  true,
    ADV_STEPS2  :  3,
    ADV_STEPS  :  2,
    SM_TOTPOINT_MUL  :  0.9647,
    SM_PREPOWER  :  1,
    SM_G_POW  :  0.48,
    SMOOTH_REPEAT  :  0,
    SMOOTH_WID  :  11.97,
    SMOOTH_PULSE_RATE  :  0.52,
    SMOOTH_PULSE_FAC  :  1,
    SMOOTH_PULSE_STEPS  :  3,
    SMOOTH_PULSE  :  false,
    START_FACTOR  :  0.10300000000000001,
    GEN_RANGE  :  4096,
  };
  
  exports.saveConfig = function() {
    let buf = "  {\n";
    for (let k in exports.config) {
      let v = window[k] !== undefined ? window[k] : exports.config[k];
      
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
  
  let WHITE_NOISE_PATTERN = 100;
  let GRATING_NOISE_PATTERN = 101;
  
  //"optional" fract
  function optfract(f) {
    //return Math.fract(f);
    return f;
  }
  
  let binomials = undefined;
  
  if (binomial_table === undefined) {
    //kind of sick of rjs errors, perhaps the time has come for es6 modules
    
    let timer = window.setInterval(() => {
      if (_binomial_table === undefined) {
        return;
      }
      
      binomial_table = _binomial_table;
      binomials = binomial_table.binomial_table;
      
      //console.log(binomial_table);
      window.clearInterval(timer);
    }, 150);
    //throw new Error("module load error");
  }
  
  //snap to nearest intensity level
  var clampify = exports.clampify = function clampify(ctx, t) {
    return Math.floor(t*ctx.RANGE + 0.0001/ctx.RANGE)/ctx.RANGE;
  }

  let TX=0, TY=1, TR=2, TGEN=3, TTIME=4, TLEN=5, TTOT=6;
  
  let path_eval_cache = util.cachering.fromConstructor(vectormath.Vector2, 64);
  
  let Path = exports.Path = class Path extends Array {
    constructor(ctx, pi, x, y, startx, starty) {
      super();
      
      this.pi = pi;
      
      this.last_startx = startx;
      this.last_starty = starty;
      
      //pre-allocate points
      for (let i=0; i<ctx.RANGE; i++) {
        let ti = this.length;
        
        for (let j=0; j<TTOT; j++) {
          this.push(0);
        }
        
        this[ti] = x;
        this[ti+1] = y;
        this[ti+TTIME] = i / ctx.RANGE;
        this[ti+TGEN] = -1; //flag as not used yet
      }
    }
    
    toJSON() {
      let array = [];
      for (let v of this) {
        array.push(v);
      }
      
      return {
        pi   : this.pi,
        data : array
      }        
    }

    loadJSON(obj) {
      this.pi = obj.pi;
      this.length = obj.data.length;
      
      for (let i=0; i<obj.data.length; i++) {
        this[i] = obj.data[i];
      }
      
      return this;
    }
    
    fit_smooth(ctx, factor) {
      let degree = ctx.PATH_DEGREE;
      
      //berstein (bezier) version
      function poly(cs, t) {
        let sum = 0.0;
        
        for (let i=0; i<cs.length; i++) {
          let w = binomials[degree][i] * t**i * (1.0 - t)**(degree - i);
          
          sum += w*cs[i];
        }
        
        return sum;
      }
      /*
      function poly(cs, t) {
        let sum = cs[0];
        
        for (let i=1; i<cs.length; i++) {
          sum += cs[i]*t;
          
          t *= t;
        }
        
        return sum;
      }//*/
      
      let xcs = new Array(degree+1), ycs = new Array(degree+1);
      xcs.length = degree+1;
      ycs.length = degree+1;
      
      xcs[0] = this[0];
      xcs[xcs.length-1] = this[this.length-TTOT];
      ycs[0] = this[1];
      ycs[ycs.length-1] = this[this.length-TTOT+1];
      
      for (let i=1; i<xcs.length-1; i++) {
        if (i > xcs.length/2) {
          xcs[i] = xcs[xcs.length-1];
          ycs[i] = ycs[ycs.length-1];
        } else {
          xcs[i] = xcs[0];
          ycs[i] = ycs[0];
        }
      }
      
      let msize = 2*(degree-1);
      let matrix = new linalg.Matrix(msize, msize);
      matrix.fill(0, 0, matrix.length);
      
      let error = () => {
        let steps = msize;
        let dt = 1.0 / (steps+2), t = dt;
        let err = 0.0;
        
        for (let j=0; j<steps; j++, t += dt) {
          for (let i=0; i<steps; i++) {
            let ti = (~~(t * this.length / TTOT))*TTOT;
            let ci, clist;
            let axis;
            
            if (i >= degree-1) {
              ci = i - (degree-1) + 1;
              clist = ycs;
              axis = 1;
            } else {
              ci = i+1;
              clist = xcs;
              axis = 0;
            }
            
            let df = 0.0001;
            let mul = 1;//ctx.DIMEN*8;
            
            let a = this[ti+axis]*mul;
            let b = poly(clist, t)*mul;
            
            let orig = clist[ci];
            
            clist[ci] += df;
            let c = poly(clist, t)*mul;
            
            clist[ci] = orig;
            
            if (isNaN(a) || isNaN(b) || isNaN(c)) {
              console.log(axis, this, ti, i, j, clist, c, ci);
              throw new Error("NaN");
            }
            
            let g = ((c - a)*(c - a) - (b - a)*(b - a)) / df;
            
            let idx = (j*msize + i);
            
            matrix[idx] = g;
            
            err += (b - a)*(b - a);

            if (Math.abs(g) > 0.00001) {
              let r1 = (b-a) * (b-a);
              
              //clist[ci] += -r1/g*0.98;
              clist[ci] += -g*0.35;
            }
          }
        }
        
        /*
        //console.log(matrix);
        //matrix.transpose();
        
        let det = matrix.determinant();
        if (Math.abs(det) > 0.001 && Math.abs(det) < 1e6) {
          matrix.invert();
          
          let vec = xcs.slice(1, degree).concat(ycs.slice(1, degree));
          
          if (vec.length != msize) {
            console.log(vec.length, msize);
            throw new Error("error!");
          }
          
          for (let i=0; i<vec.length; i++) {
            let sum = 0.0;
            
            for (let j=0; j<vec.length; j++) {
              let idx = i*msize + j;
              //let idx = j*msize + i;
              
              sum += matrix[idx]*vec[j];
            }
            
            vec[i] = sum;
          }
          
          console.log(vec);
          for (let i=1; i<degree; i++) {
            xcs[i] = vec[i-1];
            ycs[i] = vec[i-1+(degree-1)];
          }
          
          console.log(det, matrix.toString(3));
        }
        //*/
        
        return err != 0.0 ? Math.sqrt(err) : 0.0;
      }
      
      console.log(" ");
      let steps = 512;
      
      error();
      //*
      console.log("err", error().toFixed(5));
      for (let i=0; i<steps; i++) {
        error();
      }
      console.log("err", error().toFixed(5));
      //*/
      
      xcs[0] = this[0];
      xcs[xcs.length-1] = this[this.length-TTOT];
      
      ycs[0] = this[1];
      ycs[ycs.length-1] = this[this.length-TTOT+1];
      
      for (let ti=0; ti < this.length; ti += TTOT) {
        let t = ti / this.length;
        
        //break;
        
        let x = poly(xcs, t);
        let y = poly(ycs, t);
        
        this[ti] += (x - this[ti]) * factor;
        this[ti+1] += (y - this[ti+1]) * factor;
      }
    }
    
    wrap(ctx) {
      //return gridoffs[0];
        let sumx = 0, sumy = 0, sumtot = 0;

        for (let ti=0; ti<this.length; ti += TTOT) {
            sumx += this[ti];
            sumy += this[ti+1];
            sumtot++;
        }

        if (sumtot == 0)
            return;
        
        let minerr, minoff;

        for (let off of gridoffs) {
            let err = 0.0;

            for (let ti=0; ti<this.length; ti += TTOT) {
                for (let axis=0; axis<2; axis++) {
                    if (this[ti+axis]+off[axis] >= 0 && this[ti+axis]+off[axis] < 1.0) {
                        continue;
                    }

                    let f = this[ti+axis]+off[axis] < 0 ? -(this[ti+axis]+off[axis]) : (this[ti+axis]+off[axis])-1.0;
                    err += f;
                }
            }
                
            if (minerr === undefined || err < minerr) {
                minerr = err;
                minoff = off;
            }
        }

        for (let ti=0; ti<this.length; ti += TTOT) {
            this[ti] += minoff[0];
            this[ti+1] += minoff[1];
        }

        return minoff;
    }

    smooth(ctx, factor, mode) {
      mode = mode === undefined ? SmoothModes.SIMPLE : mode;
      
      switch (mode) {
        case SmoothModes.SIMPLE:
          for (let i=0; i<ctx.SMOOTH_REPEAT; i++) {
            this.simple_smooth(ctx, factor);
          }
          break;
        case SmoothModes.POLYFIT:
          this.fit_smooth(ctx, factor);
          break;
        default:
          throw new Error("unknown smoothing mode " + mode);
      }
    }
    
    
    curvature_smooth(ctx, factor) {
      function curvature(v1, v2, v3, v4, v5) {
        let len1 = (v4[0]-v2[0])*(v4[0]-v2[0]) + (v4[1]-v2[1])*(v4[1]-v2[1]);
        let len2 = (v3[0]-v1[0])*(v3[0]-v1[0]) + (v3[1]-v1[1])*(v3[1]-v1[1]);
        
        let dx1 = v4[0] - v2[0], dy1 = v4[1] - v2[1];
        let dx2 = v3[0] - v1[0], dy2 = v3[1] - v1[1];
        
        dx1 /= 2*len1, dy1 /= 2*len1;
        dx2 /= 2*len2, dy2 /= 2*len2;
        
        dx2 = (dx2 - dx1) / ((len1+len2)*0.5);
        dy2 = (dy2 - dy1) / ((len1+len2)*0.5);
        
        return (dx1*dy2 - dy1*dx2) / Math.pow(dx1*dx1 + dy1*dy1, 3/2);
      }
    }
   
    updateTlen() {
      for (let ti=0; ti<this.length-TTOT; ti += TTOT) {
        let dx = this[ti+TTOT] - this[ti];
        let dy = this[ti+TTOT+1] - this[ti+1];
        let dis = dx*dx + dy*dy;
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        this[ti+TLEN] = dis;
      }
    }
    
    constrainTlen(factor=0.5, t, w) {
      for (let ti=0; ti<this.length-TTOT; ti += TTOT) {
        let dx = this[ti+TTOT] - this[ti];
        let dy = this[ti+TTOT+1] - this[ti+1];
        let dis = dx*dx + dy*dy;
        
        let t1 = this[ti+TTIME];
        let t2 = this[ti+TTOT+TTIME];
        
        if (this[ti+TGEN] == -1) {
          continue; //unfilled point
        }
        //wrap around functions
        //let tdis1 = Math.min(Math.min(Math.abs(t-t1), Math.abs(t-t1-1.0)), Math.abs(t-t1+1.0));
        //let tdis2 = Math.min(Math.min(Math.abs(t-t2), Math.abs(t-t2-1.0)), Math.abs(t-t2+1.0));
        
        let tdis1 = Math.abs(t - t1);
        let tdis2 = Math.abs(t - t2);
        
        if (tdis1 >= w) {
          continue;
        }
        
        let s = 1.0 - tdis1/w;
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        let goal = this[ti+TLEN];
        
        if (dis == 0.0 || goal == 0.0) {
          continue;
        }
        
        goal = dis - goal;
        
        dx *= 0.5*goal/dis;
        dy *= 0.5*goal/dis;
        
        this[ti] += dx*factor*s;
        this[ti+1] += dy*factor*s;
        
        this[ti+TTOT] -= dx*factor*s;
        this[ti+TTOT+1] -= dy*factor*s;
      }
    }

    local_smooth_wrap(ctx, factor, t, w) {
      this.updateTlen();
      
      let ti = this.find(t), ti1=ti;
      
      let totpoint = this.length / TTOT;
      let iw = Math.ceil(w*this.length/TTOT);

      ti = (ti/TTOT - iw + totpoint) % totpoint;
      
      let iw2 = iw*2;
      
      let sumx=0, sumy=0, sumtot=0;

      for (let i=0; i<iw2; i++) {
        let ti2 = ((ti + i) % totpoint)*TTOT;
        let ti3 = ((ti + i + 1) % totpoint)*TTOT;
        let t2 = this[ti2+TTIME];
        let t3 = this[ti3+TTIME];

        let s2 = Math.abs(t2 - t);
        let s3 = Math.abs((t2+1) - t);
        let s4 = Math.abs((t2 - 1) - t);

        let s = Math.min(Math.min(s2, s3), s4);
        if (s > w) {
          continue;
        }

        s = 1.0 - s/w;
        s *= s;
        
        /*
        //let s = 1.0 - Math.abs(i/iw2 - 0.5)*2.0;
        
        sumx += this[ti2]*s;
        sumy += this[ti2+1]*s;
        sumtot += s;
        //*/

        //*
        let fx = (this[ti2] + this[ti3])*0.5;
        let fy = (this[ti2+1] + this[ti3+1])*0.5;
        s *= factor;
        
        this[ti2] += (fx - this[ti2])*s;
        this[ti2+1] += (fy - this[ti2+1])*s;
        //*/
      }
        
      /*
      if (sumtot != 0) {
        sumx /= sumtot;
        sumy /= sumtot;

        this[ti1] += (sumx - this[ti1])*factor;
        this[ti1+1] += (sumy - this[ti1+1])*factor;
      }
      //*/
      this.constrainTlen(undefined, t, w);
    }

    local_smooth(ctx, factor, t, w) {
      this.updateTlen();
      //return this.local_smooth_wrap(ctx, factor, t, w);
      
      let ti = this.find(t);

      while (ti > 0 && this[ti+TTIME] > t-w) {
        ti -= TTOT;
      }
      
      for (; ti<this.length - TTOT; ti += TTOT) {
        if (this[ti+TTIME] > t+w) {
          break;
        }

        let fx = (this[ti] + this[ti+TTOT])*0.5;
        let fy = (this[ti+1] + this[ti+TTOT+1])*0.5;
        let s = 1.0 - Math.abs(this[ti+TTIME] - t) / w;

        if (s > 1.0) {
          continue;
        }

        s *= s*factor;
        
        this[ti] += (fx - this[ti])*s;
        this[ti+1] += (fy - this[ti+1])*s;
      }
      
      this.constrainTlen(undefined, t, w);
    }

    simple_smooth(ctx, factor) {
      let cpy = this.slice(0, this.length);
      
      for (let ti=0; ti<this.length; ti += TTOT) {
        let nx, ny;
        
        if (ti == 0) {
          nx = (cpy[ti] + cpy[ti+TTOT])*0.5;
          ny = (cpy[ti+1] + cpy[ti+TTOT+1])*0.5;
        } else if (ti == this.length - TTOT) {
          nx = (cpy[ti-TTOT] + cpy[ti])*0.5;
          ny = (cpy[ti-TTOT+1] + cpy[ti+1])*0.5;
        } else {
          nx = (cpy[ti-TTOT] + cpy[ti] + cpy[ti+TTOT]) / 3.0;
          ny = (cpy[ti-TTOT+1] + cpy[ti+1] + cpy[ti+TTOT+1]) / 3.0;
        }
        
        this[ti] += (nx-this[ti])*factor;
        this[ti+1] += (ny-this[ti+1])*factor;
      }
    }
    
    find(t) {
      //XXX not sure I'm going to need this anymore
      //let totpoint = ~~(this.length/TTOT);
      
      //totpoint -= 1;

      //return Math.floor(totpoint*t + 0.5)*TTOT;

      if (t == 1.0) t = 0.9999999;
      
      let start = 0.0;
      let end = 0.9999999;
      let mid = (start+end) * 0.5;
      
      for (let i=0; i<25; i++) {
        let ti1 = Math.floor(start*this.length/TTOT)*TTOT;
        let ti2 = Math.floor(mid*this.length/TTOT)*TTOT;
        let ti3 = Math.floor(end*this.length/TTOT)*TTOT;
        
        if (Math.abs(this[ti1+TTIME]-t) < 0.00001)
          return ti1;
        if (Math.abs(this[ti2+TTIME]-t) < 0.00001)
          return ti2;
        if (Math.abs(this[ti3+TTIME]-t) < 0.00001)
          return ti3;
        
        if (this[ti2 + TTIME] > t) {
          end = mid;
        } else {
          start = mid;
        }
        
        mid = (start + end)*0.5;
      }
      
      
      //return closest one
      let ti = Math.floor(mid*this.length/TTOT)*TTOT;
      
      //. . .that's less than t
      while (ti > 0 && this[ti+TTIME] > t) {
        ti -= TTOT;
      }
      
      return ti;
    }
    
    testFind() {
      for (let i=0; i<RANGE; i++) {
        let ti = this.find(i/RANGE);
        
        if (ti === undefined) {
          console.log("Error!" + i);
        }
      }
    }
    
    loadMaskPoint(p) {
        let offs = p.offsets;
        this.length = 0;

        let fieldlen = p.fieldlen;
        let ctype = p.curvetype;
        
        let is_nonuniform = ctype == smoothmask.CurveTypes.LINEAR_NONUNIFORM;

        for (let i=0; i<offs.length; i += fieldlen) {
            let ti = this.length;

            for (let j=0; j<TTOT; j++) {
                this.push(0);
            }

            this[ti] = offs[i];
            this[ti+1] = offs[i+1];

            if (is_nonuniform) {
                this[ti+TTIME] = offs[i+2];
            }
        }

        return this;
    }

    fillMaskPoint(p) {
      for (let ti=0; ti<this.length; ti += TTOT) {
        p.offsets.push(this[ti]);
        p.offsets.push(this[ti+1]);

        if (p.curvetype == smoothmask.CurveTypes.LINEAR_NONUNIFORM) {
            p.offsets.push(this[ti+TTIME]);
        }
      }
      
      return this;
    }
    
    hasData(t) {
      let ti = this.find(t);
      return this[ti+TGEN] != -1;
    }
    
    update(t, x, y, r, gen, _is_recurse) {
      let ti;
      
      ti = this.find(t);
      ti = ti === undefined ? this.length : ti;
      
      /*
      for (ti=0; ti<this.length; ti += TTOT) {
        if (this[ti+TTIME] == t) {
          break;
        }
      }
      //*/
      
      if (ti == this.length && _is_recurse) {
        console.log(arguments);
        throw new Error("bug in Path.update()");
      }
      
      if (ti == this.length) {
        console.log("inserting new point for", this.pi);
        
        //insert a new point
        for (let j=0; j<TTOT; j++) {
          this.push(0);
        }
        
        this[ti+TTIME] = t;
        
        this.sort();
        return this.update(t, x, y, r, gen, true);
      }
      
      while (ti < this.length - TTOT && this[ti+TTIME] < t) {
        ti += TTOT;
      }
      
      while (ti > 0 && this[ti+TTIME] > t) {
        ti -= TTOT;
      }
      
      let s = t - this[ti+TTIME];
      
      if (ti < this.length-TTOT && this[ti+TTIME] != this[ti+TTOT+TTIME]) {
        let w = this[ti+TTOT+TTIME] - this[ti+TTIME];
        
        s /= w;
        
        this[ti]   += (x - this[ti])*(1.0 - s);
        this[ti+1] += (y - this[ti+1])*(1.0 - s);
        
        this[ti+TTOT]   += (x - this[ti+TTOT])*s;
        this[ti+TTOT+1] += (y - this[ti+TTOT+1])*s;
      } else {
        this[ti] = x;
        this[ti+1] = y;
      }
      
      this[ti+TR] = r;
      this[ti+TGEN] = gen;
    }
    
    evaluate(t) {
      t *= 0.9999999;
      
      //t = Math.floor(t*RANGE + 0.5)/RANGE;
      
      let ti = this.find(t);
      
      let ret = path_eval_cache.next();
      
      if (ti === undefined) {
        return ret.zero();
      }
      
      if (ti == this.length - TTOT) {
        ret[0] = this[ti];
        ret[1] = this[ti+1];

        return ret;
      }
      
      let s = t - this[ti+TTIME];
      let w = this[ti+TTOT+TTIME] - this[ti+TTIME];

      if (w == 0.0) {
        ret[0] = this[ti];
        ret[1] = this[ti+1];

        return ret;
      }
      
      s /= w;
      
      ret[0] = this[ti] + (this[ti+TTOT] - this[ti])*s;
      ret[1] = this[ti+1] + (this[ti+TTOT+1] - this[ti+1])*s;

      return ret;

      /*
      let ti;
      
      let ret = path_eval_cache.next();
      
      if (this.length == 0) {
        return ret.zero();
      }
      
      for (ti=0; ti<this.length; ti += TTOT) {
        if (this[ti+TGEN] == -1) {
          continue; //point hasn't gotten data yet
        }
        
        if (this[ti+TTIME] > t) {
          break;
        }
      }
      
      if (ti == TTOT && ti > 0) {
        ti -= TTOT;
        
        ret[0] = this[ti], ret[1] = this[ti+1];
        return ret;
      } else { //if (ti == 0) {
        ret[0] = this[ti], ret[1] = this[ti+1];
        return ret;
      }
      //*/
      
      /*
      ti -= TTOT;
      let t2 = (t - this[ti+TTIME]) / (this[ti+TTOT+TTIME] - this[ti+TTIME]);
      
      ret[0] = this[ti] + (this[ti+TTOT] - this[ti]) * t2;
      ret[1] = this[ti+1] + (this[ti+TTOT+1] - this[ti+1]) * t2;
      
      return ret;
      //*/
    }
    
    sort() {
      let list = [];
      
      for (let ti=0; ti<this.length; ti += TTOT) {
        list.push(ti);
      }
      
      list.sort((a, b) => {
        return this[a+TTIME] - this[b+TTIME];
      });
      
      let cpy = this.slice(0, this.length);
      let ti2 = 0;
      
      for (let ti of list) {
        for (let j=0; j<TTOT; j++) {
          this[ti2+j] = cpy[ti+j];
        }
        
        ti2 += TTOT;
      }
    }
  };
  
  let SmoothedMaskGenerator = exports.SmoothedMaskGenerator = class SmoothedMaskGenerator extends sinterface.MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate,dilute_small_mask);
      
      this.skip_point_draw = true;
      this.encode_new_offsets = false;
    }
    
    static build_ui(gui) {
      gui = gui.panel("Smoothed Mask");
      
      gui.check("SIMPLE_MODE", "Solve Mode");
      
      gui.button("load_image", "Load Test Image", () => {
        _appstate.generator.load_image().then((data) => {
            this.image = data;
            window.redraw_all();
            
            localStorage.startup_image_bn4 = data.dataurl;
        });
      });
      
      gui.button("savemask", "Download Mask", () => {
        _appstate.generator.download_mask();
      });
     
      gui.button("savemask", "Save to cache", () => {
        _appstate.generator.save_mask_to_cache();
      });
     
      let panel;
      
      panel = gui.panel("Radius Curve");
      window.SM_RADIUS_CURVE = panel.curve("SM_RADIUS_CURVE", "Radius Curve", cconst.DefaultCurves.SM_RADIUS_CURVE).curve;

      panel = gui.panel("SPH Curve");
      window.SM_SPH_CURVE = panel.curve("SM_SPH_CURVE", "Filter Curve", cconst.DefaultCurves.SM_SPH_CURVE).curve;

      panel = gui.panel("Image Curve");
      window.SM_IMAGE_CURVE = panel.curve("SM_IMAGE_CURVE", "Image Curve", cconst.DefaultCurves.SM_IMAGE_CURVE).curve;
      
      panel = gui.panel("Tone Curve");
      window.SM_TONE_CURVE = panel.curve("SM_TONE_CURVE", "Tone Curve", cconst.DefaultCurves.SM_TONE_CURVE).curve;
      
      panel = gui.panel("Settings2");
      //panel.slider("SM_PREPOWER", "PrePower", 1, 0.001, 9.0, 0.0001, false, true);
      panel.slider("SM_SPH_SPEED2", "PreSpeed", 1.0, 0.005, 16.0, 0.01, false, true);
      panel.slider("SM_SEARCHRAD2", "PreSearchRad", 3.0, 0.1, 6.0, 0.01, false, true);
      panel.slider("SM_PRE_RAND", "PreRand", 0.001, 0.00001, 5.0, 0.00001, false, false);
      panel.slider("SM_G_POW", "g pow", 3, -2.0, 16.0, 0.001, false, false);
      //listenum(path, name, enummap, defaultval, callback) {

      let modes = {};
      for (let k in MODES) {
        if (k == "SMOOTHMASK") {
          continue;
        }

        let v = MODES[k];
        k = k.replace(/_/g, " ");
        k = k[0].toUpperCase() + k.slice(1, k.length).toLowerCase();

        modes[k] = v;
      }
      
      modes["White Noise"] = WHITE_NOISE_PATTERN;
      modes["Grating Noise"] = GRATING_NOISE_PATTERN;

      panel.listenum("SM_START_GENERATOR", "Start Pattern", modes, config.SM_START_GENERATOR, () => {
        //
      });

      panel.slider("SM_TOTPOINT_MUL", "TotalPointMul", 0.85, 0.001, 1.5, 0.0001, false, true);

      panel.slider("GEN_RANGE", "IntensityRange", 255, 2, 4096, 1, true, true);
      panel.slider("RANGE", "Range", 255, 2, 255, 1, true, true);
      panel.slider("SOLVE_RANGE_MUL", "RangeMul", 2, 0.125, 64, 0.0001, false, true);
      panel.slider("PATH_DEGREE", "Path Degree", 4, 1, 8, 1, true, true);
      panel.slider("PRESTEPS", "SPH Steps", 16, 0, 102, 1, true, true);
      panel.slider("PRESTEPS2", "Initial Relax Steps", 16, 0, 45, 1, true, true);
      panel.slider("ADV_STEPS", "AdvSteps", 32, 0, 255, 1, true, true);
      panel.slider("ADV_STEPS2", "AdvSteps2", 2, 0, 25, 1, true, true);
      panel.slider("SM_RADMUL", "Radius Factor", 0.8, 0.0, 1.0, 0.001, false, true);
      panel.slider("SM_DV_DAMPING", "Damping", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("SM_GENSTART", "GenStart", 0.05, 0.001, 0.5, 0.001, false, true);
      panel.close();      
    
      panel = gui.panel("Settings1");
    
      panel.check("SM_RANDOM_ORDER", "Random Order");
      panel.check("ADV_SOLVE", "AdvancedSolve");
      panel.check("UPDATE_START_COS", "UpdateStartCos");
      
      panel.check("DRAW_TEST", "Draw Test");
      panel.slider("REPEAT", "Test Repeat", 5, 1, 45, 1, true, true);
      
      panel.slider("DISPLAY_LEVEL", "Display Level", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("STARTCO_BLEND", "Offset Blend", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("SOLVE_LEVEL", "Solve Level", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("PULL_FACTOR", "Pull Factor", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("START_FACTOR", "Start Factor", 1.0, 0.0, 1.0, 0.001, false, true);

      let panel2 = panel.panel("Path Smoothing");

      panel2.slider("PATH_SMOOTH_FACTOR", "Amount", 1.0, 0.0, 1.0, 0.001, false, true);
      panel2.slider("SMOOTH_REPEAT", "Repeat", 1, 0, 45.0, 1, true, false);
      panel2.slider("SMOOTH_WID", "Filter Width", 1.0, 0.005, 16.0, 0.01, false, true);
      panel2.check("SMOOTH_PULSE", "Initial Smooth Pulse", true);
      panel2.slider("SMOOTH_PULSE_RATE", "Pulse Rate", 0.1, 0.005, 2.0, 0.01, false, true);
      panel2.slider("SMOOTH_PULSE_FAC", "Pulse Amplitude", 1.0, 0.005, 2.0, 0.01, false, true);
      panel2.slider("SMOOTH_PULSE_STEPS", "Pulse Steps", 1, 0, 45.0, 1, true, false);

      panel.slider("SM_SPH_SPEED", "Speed", 1.0, 0.005, 16.0, 0.01, false, true);

      panel.slider("SM_SEARCHRAD", "Search Rad", 3.0, 0.1, 15.0, 0.01, false, true);
      //panel.slider("EXPONENT", "Exponent", 1.0, 0.001, 18.0, 0.001, false, true);
      
      panel = gui.panel("Draw Settings");
      
      panel.check("DRAW_KDTREE", "Draw kdtree");
      panel.check("SMALL_MASK", "Small Mask Mode");
      panel.check("XLARGE_MASK", "Extra Large Mask Mode");
      panel.check("SHOW_RADII", "Show Point Radius");
      panel.check("SHOW_PATHS", "Show Paths");
    }
    
    save_smoothmask() {
      let ps = this.points;
      
      let pset = new smoothmask.PointSet(this.dimen);
      
      let itone = new Array(128);
      let s=0, ds = 1.0 / itone.length;
      let ctx = this.config;

      for (let i=0; i<itone.length; i++, s += ds) {
        itone[i] = 1.0-ctx.SM_TONE_CURVE.inverse(1.0-s);
        //itone[i] = ctx.SM_TONE_CURVE.evaluate(s);
        //let f = ctx.SM_TONE_CURVE.evaluate(s);
        //let fi = ~~(f*itone.length*0.99999);
        //itone[fi] = s;
      }
      
      /*
      if (itone[0] === undefined) {
        itone[0] = 0;
      }

      for (let i=0; i<itone.length-1; i++) {
        if (itone[i+1] === undefined) {
          itone[i+1] = itone[i];
        }
      }//*/
      
      pset.setInverseToneCurve(itone);
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(this.config, pi, true);
        
        let gen = ps[pi+PGEN];
        //gen = 1.0 - this.config.SM_TONE_CURVE.evaluate(1.0 - gen);

        let p = new smoothmask.MaskPoint(ps[pi+PSTARTX], ps[pi+PSTARTY], pi/PTOT, gen, ps[pi+PR]); 
        
        //, smoothmask.CurveTypes.LINEAR_NONUNIFORM);
        path.fillMaskPoint(p);
        //p.compress();
        
        pset.points.push(p);
      }
      
      /*
      let json = JSON.stringify(pset, (key, val) => {
        if (typeof val == "number") {
          let a = val.toFixed(5);
          let b = val.toString();
          
          return a.length < b.length ? a : b;
        }
        
        return val;
      });//*/
      
      return pset;
    }
    
    download_mask() {
      let file = this.save_mask();
      let blob = new Blob([file], {type : 'text/smooth-mask'});
      let url = URL.createObjectURL(blob);
      
      let a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", "smoothmask_" + this.dimen + ".smask");
      a.setAttribute("target", "_blank");

      console.log("URL", url);
      
      a.click();
      window.a = a;
    }
    
    save_mask_to_cache() {
      console.log("saving pointset mask to local storage...");
      this.report("saving pointset mask to local storage...");

      new indexdb_store.IndexDBStore("bluenoise_mask").write("data", this.save_mask());

      //localStorage.startup_mask_bn4 = this.save_mask();
      
      /*
      this.save_mask(true).then((url) => {
        console.log("saving mask to local storage...");
        this.report("saving mask to local storage...");
        localStorage.startup_mask_bn4 = url;
      });
      //*/
    }

    save_mask() {
      let buf = this.save_smoothmask().toBinary().toString();
      buf = "SMOOTHMASK" + buf;

      return buf;
    }
    
    loadJSON(obj) {
      this.points = obj.points;
      this.paths = obj.paths;
      
      for (let k in this.paths) {
        let path = new Path(this.config);
        
        path.loadJSON(this.paths[k]);
        this.paths[k] = path;
      }
      
      return this;
    }
    
    toJSON() {
      return {
        points : this.points,
        paths  : this.paths,
        dimen  : this.dimen
      };
    }
    
    reset(dimen, appstate, mask_image, generators) {
      super.reset(dimen, appstate, mask_image, generators);
      
      this.config.update();
      
      this.smooth_mul = 1.0;
      this.smooth_i = 0;
      
      this.dimen = dimen;
      this.points = [];
      this.totpoint = 0;
      this.tick = 0;
      this.r = 0;
      this.paths = {};
      this.totbase = 0.0;
      this.maxgen = 1.0;
      this.totpath = 0;
      
      let ctx = this.config;
      
      ctx.SOLVE_RANGE = ctx.SOLVE_RANGE_MUL*ctx.RANGE;
      
      let rand = new util.MersenneRandom(0);
      
      let random = rand.random.bind(rand);
      
      this.cur_r = 0;
      this.cur_t = (ctx.SOLVE_RANGE_MUL-1) / ctx.SOLVE_RANGE;
      this.cur_t_i = 0;
      
      ctx = ctx.copy();

      let dimen2 = dimen;
      
      let maxgen=1.0;
      let mode = ctx.SM_START_GENERATOR;

      if (mode < 100) {
          
          if (mode == MODES.BLUEVC) {
            this.report("BlueVC not supported right now; make sure to fix it");
            throw new Error("BlueVC not supported right now; fix it!");
            //mode = MODES.VOID_CLUSTER;
          }

          let vc = new generators[mode](this.appstate);
          
          switch (mode) {
            case MODES.VOID_CLUSTER:
              dimen2 = Math.ceil(Math.sqrt(dimen*dimen*ctx.SM_TOTPOINT_MUL));
              break;
            case MODES.DART:
              break;
            case MODES.MITCHELL:
              ctx.MITCHELL_STEPSMUL = 0.465;
              ctx.MITCHELL_TOTPOINT_MUL = ctx.SM_TOTPOINT_MUL;
              break;
          }

          vc.config = ctx.copy();
          vc.TOTMASK = 1;
          vc.reset(dimen2, appstate, mask_image, generators);

          let i = 0;
          while (!vc.done()) {
              vc.step();
              
              if (i % 8 == 0 && (mode == MODES.DART || mode == MODES.DART2)) { //for darts
                vc.next_level();
              }

              if (i > ctx.PRESTEPS && (mode == MODES.SPH || mode == MODES.MASKOPT)) {
                break;
              }

              i++;
          }

          this.points = vc.points;
          
          maxgen = vc.max_level();

          //make hexagonal for void-cluster, which is a grid based method
          if (mode == MODES.VOID_CLUSTER) {
            let ps = this.points;
            for (let pi=0; pi<ps.length; pi += PTOT) {
                ps[pi+1] += Math.fract(ps[pi]*this.dimen/2.0)/this.dimen;
                ps[pi+1] = Math.fract(ps[pi+1]);
            }
          }
      } else if (mode == GRATING_NOISE_PATTERN) {
          function grating(ix, iy) {
            return Math.fract(ix*3.3234 + iy*0.539 + util.random()*0.05);
          }

          let totpoint = dimen*dimen*ctx.SM_TOTPOINT_MUL;

          dimen = Math.ceil(Math.sqrt(totpoint)*0.935);
          let dimen3 = Math.ceil(Math.sqrt(dimen*dimen*ctx.SM_TOTPOINT_MUL));
          dimen2 = Math.ceil(dimen3*2.5);

          let ps = this.points = [];
          
          console.log("DIMEN2", dimen2);
          
          for (let i=0; i<dimen3*dimen2; i++) {
            let ix = i % dimen2, iy = ~~(i / dimen2);
            
            let x = ix/dimen3, y = iy/dimen3;
            x *= Math.sqrt(3)*0.5;

            if (ix % 2 == 0) {
              y += 0.5/dimen3;
            }
            
            x += 0.5/dimen3;
            y += 0.5/dimen3;

            if (x <= 0 || y < 0 || x > 1.0 || y > 1) {
              continue;
            }
            
            let pi = ps.length;
            for (let j=0; j<PTOT; j++) {
              ps.push(0.0);
            }

            let gen = grating(ix, iy);
            
            ps[pi+PGEN] = ps[pi+POGEN] = gen;
            
            let r = 0.95 / Math.sqrt(gen*dimen2*dimen2 + dimen2*dimen2*ctx.SM_GENSTART);
            ps[pi+PR] = r;
            
            let maxr = 0.95 / Math.sqrt(dimen2*dimen2*ctx.SM_GENSTART);
            let rf = Math.pow(r/maxr, 2.0)*maxr;
            
            //x += 0.1*r*(random()-0.5)//dimen2;
            //y += 0.1*r*(random()-0.5)//dimen2;
            
            ps[pi] = x;
            ps[pi+1] = y;
            
            ps[pi+PSTARTX] = ps[pi];
            ps[pi+PSTARTY] = ps[pi+1];
          }
      } else {
          //*/
          let ps = this.points = [];
          let totpoint = Math.ceil(dimen*dimen*ctx.SM_TOTPOINT_MUL);
          maxgen = 1.0;

          for (let i=0; i<totpoint; i++) {
              let pi = ps.length;

              for (let j=0; j<PTOT; j++) {
                  ps.push(0.0);
              }

              ps[pi] = util.random();
              ps[pi+1] = util.random();
              
              //let gen = util.random();
              let gen = i/totpoint;
              
              ps[pi+PGEN] = ps[pi+POGEN] = gen;

              let r = 0.95 / Math.sqrt(gen*totpoint + totpoint*ctx.SM_GENSTART);
              ps[pi+PR] = r;

              ps[pi+PSTARTX] = ps[pi];
              ps[pi+PSTARTY] = ps[pi+1];
          }
      }

      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
          let gen = ps[pi+PGEN] = ps[pi+PGEN] / maxgen;
          
          if (isNaN(gen) || isNaN(ps[pi+PR])) {
            console.log(ps[pi+PGEN], maxgen);
            throw new Error("NaN");
          }

          gen = 1.0 - ctx.SM_TONE_CURVE.evaluate(1.0 - gen);
          gen = Math.floor(gen * ctx.GEN_RANGE) / ctx.GEN_RANGE;
          
          ps[pi+PGEN] = gen;
          
          ps[pi+PSTARTX] = ps[pi];
          ps[pi+PSTARTY] = ps[pi+1];
          
          ps[pi+PIX] = ~~(ps[pi]*mask_image.width*0.999999);
          ps[pi+PIY] = ~~(ps[pi+1]*mask_image.width*0.999999);
      }

      this.calcRadii();

      for (let pi=0; pi<ps.length; pi += PTOT) {
          ps[pi] += (util.random()-0.5)/this.dimen*ctx.SM_PRE_RAND;
          ps[pi+1] += (util.random()-0.5)/this.dimen*ctx.SM_PRE_RAND;
          ps[pi] = Math.fract(ps[pi]);
          ps[pi+1] = Math.fract(ps[pi+1]);
      }

      for (let i=0; i<ctx.PRESTEPS2; i++) {
          this.step_base_generate(this.config.copy());
      }
      
      //this.updateStartCos(this.config);

      for (let pi=0; pi<ps.length; pi += PTOT) {
          //ps[pi] = util.random();
          //ps[pi+1] = util.random();

          ps[pi] = ps[pi+PSTARTX] = Math.fract(ps[pi]);
          ps[pi+1] = ps[pi+PSTARTY] = Math.fract(ps[pi+1]);
      }
      
      /*
      this.throw();
      
      let steps = ctx.PRESTEPS2;
      for (let i=0; i<steps; i++) {
        if (Math.random() > 0.1) {
          console.log(i, "of", steps)
        }
        this.step_base_generate(ctx);
      }
      //*/
    }
    
    getPath(ctx, pi, create_if_nonexisting) {
      if (create_if_nonexisting && !(pi in this.paths)) {
        this.paths[pi] = new Path(ctx, pi, this.points[pi], this.points[pi+1], this.points[pi+PSTARTX], this.points[pi+PSTARTY]);
      }
      
      return this.paths[pi];
    }
    
    compressPaths(ctx) {
        for (let k in this.paths) {
            let path = this.paths[k];

            let p = new smoothmask.MaskPoint(path.last_startx, path.last_starty, undefined, undefined, undefined, smoothmask.CurveTypes.LINEAR_NONUNIFORM);
            
            path.fillMaskPoint(p);
            p.compress();
            path.loadMaskPoint(p);

        }
    }

    updatePath(pi, ctx) {
      if (ctx === undefined) {
        throw new Error("ctx cannot be undefined");
      }
      
      let path = this.getPath(ctx, pi, true);
      
      let ps = this.points;
      let x = ps[pi], y = ps[pi+1], r = ps[pi+PR], gen = ps[pi+PGEN];
      
      //find center of existing path points
      let cx=0, cy=0, ctot=0;
      
      for (let ti=0; ti<path.length; ti += TTOT) {
        cx += path[ti];
        cy += path[ti+1];
        ctot++;
      }
      
      if (ctot != 0.0) {
        cx /= ctot;
        cy /= ctot;
      }
      
      let mindis = undefined;
      let minoff = undefined;
      
      //find appropriate toroidal offset
      //by finding grid offset that minimizes distance to centroid of path
      for (let off of gridoffs) {
        let dx = x+off[0] - cx;
        let dy = y+off[1] - cy;
        
        let dis = dx*dx + dy*dy;
        
        if (mindis === undefined || dis < mindis) {
          mindis = dis;
          minoff = off;
        }
      }
      
      x += minoff[0];
      y += minoff[1];
      
      let t = clampify(ctx, ctx.SOLVE_LEVEL);
      
      path.update(t, x, y, r, gen);
    }
    
    calcRadii() {
      let totpoint = this.points.length/PTOT;
      let ps = this.points;
      let ctx = this.config;
      
      //cumulative distribution function (histogram) for 
      //calculating point radius from modified (non-linear) gen threshold
      let cdf = new Float64Array(1024);

      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+PGEN];
        
        let ci = ~~(gen * cdf.length * 0.9999999);
        cdf[ci]++;
      }
      
      for (let i=1; i<cdf.length; i++) {
        cdf[i] += cdf[i-1];
      }

      for (let pi=0; pi<ps.length; pi += PTOT) {
          let gen = ps[pi+PGEN];
          let ci = ~~(gen*cdf.length*0.9999999);

          let r = ctx.SM_RADMUL / Math.sqrt(1 + cdf[ci]);
          ps[pi+PR] = r;
      }

      //XXX get rid of prior radius calculations 
      this.r = this.cur_r = ctx.SM_RADMUL / Math.sqrt(this.points.length/PTOT);
    }
    
    throw() {
      let totpoint = this.dimen*this.dimen*0.95;
      let ps = this.points;
      let ctx = this.config;
      
      let genstart = totpoint*ctx.SM_GENSTART;
      let maxgen = totpoint + genstart;
      
      this.maxgen = maxgen;
      let dimen2 = Math.floor(Math.sqrt(totpoint));
      this.r = undefined;
      
      //cumulative distribution function (histogram) for 
      //calculating point radius from modified (non-linear) gen threshold
      let cdf = new Float64Array(1024);

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
        
        let gen = i / totpoint;
        
        gen = Math.max(gen-ctx.SM_GENSTART, 0)/(1.0 - ctx.SM_GENSTART);
        gen = Math.pow(gen, ctx.SM_PREPOWER);
        gen = 1.0 - ctx.SM_TONE_CURVE.evaluate(1.0 - gen);
        
        let ci = ~~(gen * cdf.length * 0.9999999);
        cdf[ci]++;

        ps[pi] = ps[pi+POLDX] = ps[pi+PSTARTX] = x;
        ps[pi+1] = ps[pi+POLDY] = ps[pi+PSTARTY] = y;

        ps[pi+PGEN] = ps[pi+POGEN] = gen;
      }
      
      for (let i=1; i<cdf.length; i++) {
        cdf[i] += cdf[i-1];
      }

      for (let pi=0; pi<ps.length; pi += PTOT) {
          let gen = ps[pi+PGEN];
          let ci = ~~(gen*cdf.length*0.9999999);

          let r = ctx.SM_RADMUL / Math.sqrt(1 + cdf[ci]);
          ps[pi+PR] = r;
      }

      //XXX get rid of prior radius calculations 
      this.r = this.cur_r = ctx.SM_RADMUL / Math.sqrt(this.points.length/PTOT);
    }
    
    regen_spatial(ctx) {
      ctx = ctx === undefined ? this.config : ctx;

      let kd = this.kdtree === undefined ? new kdtree.KDTree([-2.5, -2.5, -2.5], [2.5, 2.5, 2.5]) : this.kdtree;
      kd.clear();
      
      let ps = this.points;
      let co = [0, 0, 0];
      let visit = {};
      let totpoint = 0;

      while (totpoint < ps.length/PTOT) {
        let pi = ~~(Math.random()*0.999999*ps.length/PTOT);
        if (pi in visit) {
          continue;
        }
        
        totpoint++;
        visit[pi] = 1;
        pi *= PTOT;

        if (ctx.SIMPLE_MODE && (ps[pi+PGEN]) > ctx.SOLVE_LEVEL) {
          continue;
        }
        
      //for (let pi=0; pi<ps.length; pi += PTOT) {
        kd.insert(ps[pi], ps[pi+1], pi);
      }
      
      return kd;
    }

    updateVelocity(ctx) {
      ctx = ctx === undefined ? this.config : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let fac = ctx.SM_DV_DAMPING;
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
      ctx = ctx === undefined ? this.config : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        ps[pi] += ps[pi+PDX];
        ps[pi+1] += ps[pi+PDY];
        
        ps[pi] = optfract(ps[pi]);
        ps[pi+1] = optfract(ps[pi+1]);
      }
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
    
    loadPathCos(ctx) {
      ctx = ctx === undefined ? (this.config.update(), this.config) : ctx;
      
      let solvet = ctx.SOLVE_LEVEL;

      solvet = clampify(ctx, solvet);

      //load last solve for this level
      let ps = this.points;
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(ctx, pi, true);
        
        let off = path.wrap();

        let co = path.evaluate(solvet);
        
        ps[pi] = co[0];
        ps[pi+1] = co[1];

        ps[pi+PSTARTX] += off[0];
        ps[pi+PSTARTY] += off[1];
      }
    }
      
    advanced_solve(ctx) {
      //make copy of ctx so we can make changes of it
      ctx = ctx.copy();
      
      ctx.SOLVE_RANGE = ctx.RANGE * ctx.SOLVE_RANGE_MUL;
      
      //let s = ctx.PATH_SMOOTH_FACTOR;
      //s += (s*this.smooth_mul - s) * ctx.SMOOTH_PULSE_FAC;
      //ctx.PATH_SMOOTH_FACTOR = s;
      
      /*
         To get better correlations across levels (and thus better handle sharp gradients
         and sharp edges in sampling), we:

         1. do 1 normal solve across the full 1.0 time range
         2. Set PATH_SMOOTH_FACTOR to 1 and solve for SMOOTH_PULSE_STEPS steps
         3. go back to normal solving with user-set PATH_SMOOTH_FACTOR
      */

      if (ctx.SMOOTH_PULSE && this.smooth_i > 1 && this.smooth_i < ctx.SMOOTH_PULSE_STEPS + 1) {
        ctx.PATH_SMOOTH_FACTOR = 1.0;
        ctx.PULL_FACTOR = 0.9;
      } else if (ctx.SMOOTH_PULSE) {
        ctx.PATH_SMOOTH_FACTOR = Math.max(this.smooth_mul, ctx.PATH_SMOOTH_FACTOR);
      }
      
      let ci = this.cur_t_i % ctx.SOLVE_RANGE;
      let ci2 = (~~(this.cur_t_i / ctx.SOLVE_RANGE)) % 2;

      if (1) { //!ci2) {
        this.cur_t = ci / ctx.SOLVE_RANGE + 0.00001;
      } else {
        this.cur_t = (ctx.SOLVE_RANGE-ci-1) / ctx.SOLVE_RANGE + 0.00001;
      }
      
      ctx.SOLVE_LEVEL = this.cur_t;

      for (let i=0; i<ctx.ADV_STEPS2; i++) {
        this.advanced_solve_intern(ctx);
      }
      
      if (ctx.SM_RANDOM_ORDER)
        this.cur_t_i = Math.floor(Math.random()*0.999999*ctx.SOLVE_RANGE);
      else
        this.cur_t_i++;
      
      if (this.cur_t_i % ctx.SOLVE_RANGE == 0) {
        this.smooth_i++;

        if (this.smooth_i > 1 + ctx.SMOOTH_PULSE_STEPS) {
          this.smooth_mul *= 1.0 - ctx.SMOOTH_PULSE_RATE;
        }
        //this.smooth_mul *= 1.0 - ctx.SMOOTH_PULSE_RATE; //= Math.fract(this.smooth_mul - ctx.SMOOTH_PULSE_RATE);
        //this.smooth_mul = 1.0 - (1.1 - this.smooth_mul) * (1.0 - ctx.SMOOTH_PULSE_RATE);
      }
      
      if (ctx.SMOOTH_PULSE) {
        this.report("cur_t", this.cur_t.toFixed(3), "smooth_i", Math.max(this.smooth_i, 1), "of", ctx.SMOOTH_PULSE_STEPS, "amount", ctx.PATH_SMOOTH_FACTOR);
      } else {
        this.report("cur_t", this.cur_t.toFixed(3));
      }
    }

    advanced_solve_intern(ctx) {      
      //load last solve for this level
      let ps = this.points;

      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(ctx, pi, true);
        
        if (!path.hasData(this.cur_t)) {
          continue;
        }
        
        let off = path.wrap();

        let co = path.evaluate(this.cur_t);

        ps[pi] = co[0];
        ps[pi+1] = co[1];

        ps[pi+PSTARTX] += off[0];
        ps[pi+PSTARTY] += off[1];
      }
      
      for (let i=0; i<ctx.ADV_STEPS; i++) {
        this.step_simple(ctx);
      }
      
      if (ctx.UPDATE_START_COS)
        this.updateStartCos(ctx);
      
      //profiler said this is slow, so do it every third frame
      //if (this.cur_t_i % 3 == 0) {
         //this.smoothPaths(ctx);
      //}

      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(ctx, pi, false);

        if (path === undefined) {
          continue;
        }
        
        for (let j=0; j<ctx.SMOOTH_REPEAT; j++) {
          path.local_smooth(ctx, ctx.PATH_SMOOTH_FACTOR*0.05, this.cur_t, ctx.SMOOTH_WID/Math.min(ctx.RANGE, ctx.SOLVE_RANGE));
        }
      }
    }
    
    updateStartCos(ctx) {
      let ps = this.points;
      
      //update startx/starty positions
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(ctx, pi);
        
        if (path === undefined) {
          //console.log("no paths!");
          continue;
        }
        
        let sumx = 0, sumy = 0, sumtot = 0;
        let minx, miny, maxx, maxy;
        
        for (let ti=0; ti<path.length; ti += TTOT) {
          if (path[ti+TGEN] == -1) continue;
          
          if (minx === undefined) {
            minx = maxx = path[ti];
            miny = maxy = path[ti+1];
          } else {
            minx = Math.min(minx, path[ti]);
            maxx = Math.max(maxx, path[ti]);
            
            miny = Math.min(miny, path[ti+1]);
            maxy = Math.max(maxy, path[ti+1]);
          }
          
          //*
          sumx += path[ti];
          sumy += path[ti+1];
          sumtot++;
          
          //*/
          
          /*
          sumx += path[ti]*path[ti];
          sumy += path[ti+1]*path[ti+1];
          sumtot++;
          //*/
        }
        
        if (sumtot == 0.0)
          continue;
        
        sumx /= sumtot;
        sumy /= sumtot;
        
        /*
        sumx = Math.sqrt(sumx);
        sumy = Math.sqrt(sumy);
        //*/
        
        //*
        sumx = (minx + maxx)*0.5;
        sumy = (miny + maxy)*0.5;
        //*/
        
        ps[pi+PSTARTX] += (sumx - ps[pi+PSTARTX])*0.015;
        ps[pi+PSTARTY] += (sumy - ps[pi+PSTARTY])*0.015;
      }

      //this.rebasePaths(ctx);
    }
    
    step(ctx) {
      ctx = ctx === undefined ? this.config : ctx;
      
      if (ctx.ADV_SOLVE && ctx.SIMPLE_MODE) {
        this.advanced_solve(ctx);
      } else if (ctx.SIMPLE_MODE) {
        ctx = ctx.copy();

        ctx.SOLVE_LEVEL = clampify(ctx, ctx.SOLVE_LEVEL);

        this.loadPathCos(ctx);

        //this.applyVelocity(ctx);
        this.step_simple(ctx);
        
        if (ctx.UPDATE_START_COS)
          this.updateStartCos(ctx);
        
        //this.updateVelocity(ctx);
      } else {
        this.step_base_generate(ctx.copy());
      }
      
      let msize = this.mask_img.width;
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        ps[pi+PIX] = ~~(ps[pi]*msize*0.9999999);
        ps[pi+PIY] = ~~(ps[pi+1]*msize*0.9999999);
      }
      
      this.regen_spatial(this.config);
      this.raster();
    }
    
    step_simple(ctx) {
      let ps = this.points;
      let searchfac = ctx.SM_SEARCHRAD;
      
      let x1, y1, r1, sumdx, sumdy, sumw, sumtot, searchr, gen1, off, pi1;
      
      let tree = this.regen_spatial(ctx);
      
      let tot = 0;
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        let gen = ps[pi1+PGEN];
        
        tot += gen <= ctx.SOLVE_LEVEL;
      }
      
      if (tot == 0) {
        return;
      }
      
      let callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        if (ps[pi2+PGEN] > ctx.SOLVE_LEVEL) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN];
        
        let dx = x2-x1-off[0];
        let dy = y2-y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        w *= w*w*w*w; 
        //w = ctx.SM_SPH_CURVE.evaluate(w);
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1.0;
      }

      let r = this.cur_r = ctx.SM_RADMUL / Math.sqrt(tot);
      let fac = ctx.SM_SPH_SPEED * 0.0625;
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        sumdx = sumdy = sumw = sumtot = 0.0;
        
        x1 = ps[pi1], y1 = ps[pi1+1], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN];
        
        if (gen1 > ctx.SOLVE_LEVEL) {
          continue;
        }
        
        searchr = r*searchfac;
        
        for (off of gridoffs) {
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);
        }
        
        if (sumtot == 0.0 || sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        ps[pi1] += -sumdx*fac;
        ps[pi1+1] += -sumdy*fac;
      }
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        let gen1 = ps[pi1+PGEN];
        
        if (gen1 > ctx.SOLVE_LEVEL) {
          continue;
        }
  
        //pull towards starting positions (generated by step_base_generate()) a bit
        let dx = ps[pi1+PSTARTX] - ps[pi1];
        let dy = ps[pi1+PSTARTY] - ps[pi1+1];
        
        let tfac = 1.0 - Math.abs(ps[pi1+PGEN] - ctx.SOLVE_LEVEL);
        
        let pfac = tfac*ctx.PULL_FACTOR;// + ctx.PULL_FACTOR*(1.0 - ctx.SOLVE_LEVEL);
        
        ps[pi1] += dx*ctx.PULL_FACTOR/2.0;
        ps[pi1+1] += dy*ctx.PULL_FACTOR/2.0;
        
        let sfac = /*tfac**/ctx.START_FACTOR; //Math.min(ctx.START_FACTOR, ctx.PULL_FACTOR);
        
        let dstartx=0, dstarty=0;
        
        let sdx = dx, sdy = dy, slen = Math.sqrt(sdx*sdx + sdy*sdy);
        if (slen > 0) {
          //sdx /= slen*this.dimen;
          //sdy /= slen*this.dimen;
          
          //pull start (path origin) positions towards points too
          dstartx += -sdx*0.02*sfac;
          dstarty += -sdy*0.02*sfac;
        }
        
        let path = this.getPath(ctx, pi1, false);

        //wrap around as necessary
        if (ctx.START_FACTOR > 0 && path !== undefined) {
          let offx=0, offy=0;
          
          if (ps[pi1+PSTARTX] < 0)
            offx = 1.0;
          else if (ps[pi1+PSTARTX] >= 1.0)
            offx = -1.0;
          
          if (ps[pi1+PSTARTY] < 0)
            offy = 1.0;
          else if (ps[pi1+PSTARTY] >= 1.0)
            offy = -1.0;
          
          dstartx += offx;
          dstarty += offy;
          
          ps[pi1] += offx;
          ps[pi1+1] += offy;
        }

        //pull towards path position too
        if (path !== undefined) {
            let co = path.evaluate(this.cur_t);

            dx = co[0] - ps[pi1];
            dy = co[1] - ps[pi1+1];

            ps[pi1] += dx*ctx.PULL_FACTOR/2*0.25;
            ps[pi1+1] += dy*ctx.PULL_FACTOR/2*0.25;
        }
        
        ps[pi1+PSTARTX] += dstartx;
        ps[pi1+PSTARTY] += dstarty;
        
        path.last_startx += dstartx;
        path.last_starty += dstarty;
        
        for (let ti=0; ti<path.length; ti += TTOT) {
          path[ti] += dstartx;
          path[ti+1] += dstarty;
        }

        /*
        if (ps[pi1] > 1.0) {
          ps[pi1] -= 1.0;
          ps[pi1+PSTARTX] -= 1.0;
        } else if (ps[pi1] < 0.0) {
          ps[pi1] += 1.0;
          ps[pi1+PSTARTX] += 1.0;
        }
        
        if (ps[pi1+1] > 1.0) {
          ps[pi1+1] -= 1.0;
          ps[pi1+PSTARTY] -= 1.0;
        } else if (ps[pi1+1] < 0.0) {
          ps[pi1+1] += 1.0;
          ps[pi1+PSTARTY] += 1.0;
        }
        //*/
        
        //update paths
        this.updatePath(pi1, ctx);
      }
      
      //this.rebasePaths(ctx);
    }
    
    step_base_generate_new(ctx) {
      let sph = new sph5.SPH(this.dimen);
      sph.points = this.points;
      
      let ctx2 = sph5_const.copy();
      
      this.report("suggested PreSpeed: " + ctx2.SPH_SPEED.toFixed(4) + ", PreSearchRad: "
                  + ctx2.SEARCHRAD.toFixed(4));
      
      ctx2.SPH_SPEED = ctx.SM_SPH_SPEED2*0.1;
      ctx2.SEARCHRAD = ctx.SM_SEARCHRAD2;
      ctx2.RADIUS_CURVE = ctx.SM_RADIUS_CURVE;
      
      if (this.cmyk_tick === undefined) {
        this.cmyk_tick = 0;
      }
      
      //recalculate radii
      
      function calcradius(gen, maxgen, ctx) {
        let b = ctx.RADMUL / Math.sqrt(1 + maxgen);
        let a = b*ctx.MAX_SCALE;

        return a + (b - a)*gen;
        
        return ctx.RADMUL / Math.sqrt(1 + gen*maxgen);
      }

      let ps = this.points;
      let old_radii = [], old_gen = [];
      let totpoint = ps.length/PTOT;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+PGEN];
        
        old_radii.push(ps[pi+PR]);
        old_gen.push(gen);
        
        ps[pi+PGEN] = ctx.SM_TONE_CURVE.inverse(gen);
        ps[pi+PR] = calcradius(ps[pi+PGEN], totpoint, ctx);
      }
      
      sph.step(ctx2);
      //this.step_base_generate_new_intern(ctx);
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let i = pi/PTOT;
        
        ps[pi+PR] = old_radii[i];
        ps[pi+PGEN] = old_gen[i];
      }
    }
    
    makeKDTree(ctx) {
      return this.regen_spatial(ctx);
    }
    
    step_base_generate_new_intern(ctx) {
      this.cmyk_tick++;
      
      ctx = ctx === undefined ? cconst : ctx;
      
      let ps = this.points;
      let searchfac = ctx.SEARCHRAD;
      let cmyk_searchfac = ctx.CMYK_SEARCHRAD;

      let ct = Math.min(this.cmyk_tick / 64, 1.0);
      
      cmyk_searchfac += (0.6 - cmyk_searchfac) * (1.0 - ct);

      this.ct = cmyk_searchfac.toFixed(3);
      
      let x1, y1, r1, sumdx, sumdy, sumw, sumtot, searchr, gen1, off, pi1, color1, sumcolorw, sumcolortot;
      let sumcmyk = [0, 0, 0, 0], sumcolor=0;
      
      let max_r = undefined;
      
      ctx = ctx.copy();
      ctx.SIMPLE_MODE = false;
      ctx.ADV_SOLVE = false;
      
      let tree = this.makeKDTree(ctx);
      let tot = ps.length / PTOT;
      
      if (tot == 0) {
        return;
      }
      
      let calcweight = (w, r1, r2, gen1, gen2) => {
        
        /*
        off factor;
        off period;
        
        k1 := 1;
        k2 := 2;
        k3 := 3;
        k4 := 1;
        k5 := 1;
        d := 0.0;
        
        g1 := gen1 - gen2 + 1.0;
        g2 := (gen2+d) / (gen1+d);
        g1 := g1**k1;
        g2 := g2**k4;
        
        fw := w; comment: 1.0 - dis/searchr;
        fw := fw**(g2*k2 + k3);
        fw := fw*(g1*k5 + 1.0-k5);
        
        */
        let g1 = gen1 - gen2 + 1.0;
        let g2 = (gen2+0.0001) / (gen1+0.0001);
        
        //g = Math.pow(g, ctx.PARAM1 + Math.pow(1.0-gen1, ctx.PARAM3)*ctx.PARAM2);
        g1 = Math.pow(g1, ctx.PARAM1);
        g2 = Math.pow(g2, ctx.PARAM4);
        
        //w *= 0.00001+g*dis;
        //w = g/dis;
        //w *= -g;
        
        //w += g*ctx.PARAM2;
        //w *= g+ctx.PARAM2;
        w = Math.pow(w, g2*ctx.PARAM2 + ctx.PARAM3);
        w *= g1*ctx.PARAM5 + 1.0 - ctx.PARAM5;
        
        if (gen1 < gen2) {
          w *= ctx.PARAM6;
          w = Math.pow(w, ctx.PARAM7);
        }
        //w *= Math.pow(g, ctx.PARAM1);
        return w;
      } 
           
      let callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN], color2 = ps[pi2+PCOLOR];
        
        let dx = x2-x1-off[0];
        let dy = y2-y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0 || dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        w = calcweight(w, r1, r2, gen1, gen2);

        //w = ctx.SPH_CURVE.evaluate(w);
        
        dx /= dis;
        dy /= dis;
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1.0;
      }

      let cmyk_callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN], color2 = ps[pi2+PCOLOR];
        
        let dx = x2 - x1-off[0];
        let dy = y2 - y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0 || dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        w = calcweight(w, r1, r2, gen1, gen2);
        w *= w*w;
        
        sumcolor += color2*w;
        sumcmyk[color2] += w;
        
        sumcolorw += w;
        sumcolortot += 1.0;
      }

      let fac = ctx.SPH_SPEED*0.5;// * 0.45;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let r1 = ps[pi+PR];
        
        max_r = max_r === undefined ? r1 : Math.max(max_r, r1);
      }
      
      let swaps = [[], [], [], []];
      let bins = [[], [], [], []];
          
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        sumdx = sumdy = sumw = sumtot = sumcolor = sumcolorw = sumcolortot = 0.0;
        
        for (let i=0; i<4; i++) {
          sumcmyk[i] = 0;
        }
        
        x1 = ps[pi1], y1 = ps[pi1+1], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN], color1 = ps[pi1+PCOLOR];
        
        //searchr = (r1+max_r)*0.5*searchfac;
        //searchr = r1*searchfac;
        
        for (off of gridoffs) {
          searchr = max_r*searchfac;
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);

          //XXX disabled for speed, until needed
          //searchr = max_r*cmyk_searchfac;
          //tree.forEachPoint(x1+off[0], y1+off[1], searchr, cmyk_callback);
        }
        
        if (sumtot == 0.0 || sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        let fac2 = Math.pow(1.0 - r1/max_r, 2.0) + 0.125;
        fac2 *= 0.5;
        fac2 = 0.1;
        
        ps[pi1] += -sumdx*fac2*fac;
        ps[pi1+1] += -sumdy*fac2*fac;
        
        if (sumcolorw == 0.0) {
          continue;
        }

        if (sumcolor / sumcolorw >= 4) {
          throw new Error("sumcolor corruption");
        }

        sumcolor = (~~((sumcolor + color1) / (sumcolorw + 1))) % 4;
        //sumcolor = (~~(sumcolor / sumcolorw)) % 4;
        
        let mini=0, maxi=0, minc=0, maxc=0;
        
        for (let i=0; i<4; i++) {
          sumcmyk[i] /= sumcolortot;
          
          if (i==0 || sumcmyk[i] > maxc) {
            maxc = sumcmyk[i];
            maxi = i;
          }
          
          if (i == 0 || sumcmyk[i] < minc) {
            minc = sumcmyk[i];
            mini = i;
          }
        }
        
        //mini = sumcolor;
        if (mini != color1) {
          swaps[mini].push(pi1);
          bins[mini].push(pi1);
        }
        //if (color1 != sumcolor) {
        //  swaps[sumcolor].push(pi1);
        // bins[color1].push(pi1);
        //}
      }

      for (let i=0; i<4; i++) {
        swaps[i].sort();
        bins[i].sort();
      }

      let steplen = swaps[0].length + swaps[1].length + swaps[2].length + swaps[3].length;
      for (let step=0; step<steplen; step++) {
        let i = ~~(Math.random()*3.999999);
        
        for (let i2=0; i2<swaps[i].length; i2++) {
          let pi1 = swaps[i][i2];
          let rj = ~~(Math.random()*2.999999);
          let j = (i + rj) % 4;
          
          j = ps[pi1+PCOLOR];
          
          if (j == undefined) {
            throw new Error("eek!");
          }

          if (swaps[j].length == 0) {
            continue;
          }
          
          let k;
          for (k=0; k<swaps[j].length; k++) {
            if (ps[swaps[j][k]+PCOLOR] == i) {
              break;
            }
          }

          if (k == swaps[j].length) {
            continue;
          }
          
          let pi2 = swaps[j][k];
          
          let t = ps[pi1+PCOLOR];
          ps[pi1+PCOLOR] = i;//ps[pi2+PCOLOR];
          ps[pi2+PCOLOR] = j;//t;
          
          //remove from lists
          swaps[i][i2] = swaps[i][swaps[i].length-1];
          swaps[j][k] = swaps[j][swaps[j].length-1];

          swaps[i].pop();
          swaps[j].pop();

          i2--;
        }
      }
      console.log(swaps);
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        ps[pi1] = Math.fract(ps[pi1]);
        ps[pi1+1] = Math.fract(ps[pi1+1]);
        
        ps[pi1+PSTARTX] = ps[pi1];
        ps[pi1+PSTARTY] = ps[pi1+1];
      }
    }
      
    step_base_generate(ctx) {
      return this.step_base_generate_new(ctx);
      //return this.step_base_generate_old(ctx);

      let ps = this.points;
      let searchfac = ctx.SM_SEARCHRAD2;
      
      let x1, y1, r1, sumdx, sumdy, sumw, sumtot, searchr, gen1, off, pi1;
      
      ctx = ctx.copy();
      ctx.SIMPLE_MODE = false;
      ctx.ADV_SOLVE = false;
      
      let tree = this.regen_spatial(ctx);
      let tot = ps.length / PTOT;
      
      if (tot == 0) {
        return;
      }
      
      let callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN];
        
        let dx = x2-x1-off[0];
        let dy = y2-y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        if (1||gen2 > gen1) {
          //w *= 0.25;
          //return;
          //w *= 0.6;
          let d = ctx.SM_PRE_PARAM; //0.001;
          //let g = gen2 > gen1 ? (gen1+d)/(gen2+d) : (gen2+d)/(gen1+d);
          
          let g1 = gen1; //Math.pow(gen1, d);
          let g2 = gen2; //Math.pow(gen2, d);

          let g = g1 - g2 + 1.0;
          //g = 1.0 / (gen1*gen1 + gen2*gen2 + d);
          //g = Math.atan2(gen1, gen2)/Math.PI/2.0 + 0.5;
          
          let pw = ctx.SM_G_POW;//*Math.pow((1.0-gen1), 0.5);

          //pw += (1.0-gen1)*1.0;
          g2 = g;
          g2 = g2 != 0.0 ? Math.pow(g2, 1) : g2;
          let d2 = 0.1;
          //w = Math.pow(w, 3 + (g1+d2)/(g2+d2)*ctx.SM_PRE_PARAM); //2.0 + g2*ctx.SM_PRE_PARAM);
          w *= Math.pow(g, pw);
          w = Math.pow(w, ctx.SM_PRE_PARAM);
          
          //w = Math.pow(w, 1.0 + ctx.SM_G_POW*g);
          
          //w *= ctx.SM_G_CURVE.evaluate(g);
          //w = Math.pow(w, 1.0 + (gen1+d)/(gen2+d));
        } else {
          w = Math.pow(w, ctx.SM_PRE_PARAM);
          //return;
        }
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1.0;
      }

      let r = this.cur_r = ctx.SM_RADMUL / Math.sqrt(tot);
      let fac = ctx.SM_SPH_SPEED2;// * 0.45;
      
      let max_r = undefined;
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let r1 = ps[pi+PR];
        
        max_r = max_r === undefined ? r1 : Math.max(max_r, r1);
      }
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        sumdx = sumdy = sumw = sumtot = 0.0;
        
        x1 = ps[pi1], y1 = ps[pi1+1], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN];
        
        //searchr = max_r*searchfac;
        //searchr = (r1+max_r)*0.5*searchfac;
        searchr = r1*searchfac;
        //searchr = Math.pow(r1/max_r, ctx.SM_PRE_PARAM)*max_r*searchfac;
        
        for (off of gridoffs) {
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);
        }
        
        if (sumtot == 0.0 || sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        let fac2 = Math.pow(1.0 - r1/max_r, 2.0) + 0.125;
        fac2 *= 0.5;
        
        ps[pi1] += -sumdx*fac2*fac;
        ps[pi1+1] += -sumdy*fac2*fac;
      }
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        ps[pi1] = Math.fract(ps[pi1]);
        ps[pi1+1] = Math.fract(ps[pi1+1]);
        
        ps[pi1+PSTARTX] = ps[pi1];
        ps[pi1+PSTARTY] = ps[pi1+1];
      }
    }

    step_base_generate_old(ctx) {
      ctx = ctx.copy();
      
      let settings = {"DIMEN":28,"MAX_SCALE":8,"SM_RADMUL":0.8,"SIMPLE_MODE":false,"APP_VERSION":0.0001,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"SM_PREPOWER":0.5,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"DRAW_COLORS":true,"SM_SEARCHRAD":4,"RMUL":1,"SM_SPH_SPEED":4.69,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.406,"PARAM":0.45,"PARAM2":3.751,"PARAM3":0.000001,"PARAM4":4,"PARAM5":0.721,"TIMER_STEPS":11074,"START_THRESHOLD":0.3,"SM_GENSTART":0.05,"SMALL_MASK":false,"XLARGE_MASK":true,"SHOW_RADII":false,"SM_DV_DAMPING":1,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SM_SEARCHRAD2":3.96,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1};
      
      for (let k in settings) {
          ctx[k] = settings[k];
      }
      
      this.applyVelocity(ctx);
      this.step_base_generate_intern(ctx);
      this.updateVelocity(ctx);
      this.tick++;
      
      let ps = this.points;
      for (let pi=0; pi<ps.length; pi += PTOT) {
        ps[pi+PSTARTX] = ps[pi];
        ps[pi+PSTARTY] = ps[pi+1];
      }
    }

        
    smoothPaths(ctx, factor, mode) {
      ctx = ctx === undefined ? this.config : ctx;
      factor = factor === undefined ? ctx.PATH_SMOOTH_FACTOR : factor;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let path = this.getPath(ctx, pi);
        
        if (path === undefined) {
          continue;
        }
        
        path.smooth(ctx, factor, mode);
      }
    }
    
    step_base_generate_intern(ctx) {
      ctx = ctx === undefined ? this.config : ctx;
      
      window.minfac = window.maxfac = undefined;
      
      let param = 0.5 + this.tick*0.125;
      
      param = Math.min(param, ctx.PARAM);
      window.param = param;
      
      const thresh = ctx.START_THRESHOLD;
      let ps = this.points;
      
      let searchfac = ctx.SM_SEARCHRAD;
      let speed = ctx.SM_SPH_SPEED2;
      
      let sumdx, sumdy, sumw, sumtot, x1, y1, r1, pi1, gen1, searchr, off;
      let testgen;
      
      let tree = this.regen_spatial(ctx);
      
      this.totbase = 0;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+POGEN];
        
        //ps[pi+PGEN] = ctx.SM_GEN_CURVE.evaluate(gen);
        
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
          //a = ctx.SM_SPH_CURVE.evaluate(a);
          //b = ctx.SM_SPH_CURVE.evaluate(b);
          
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
          
          //fac = ctx.SM_SPH_CURVE.evaluate(fac/max)*max;
          //w = w * (1.0 + ctx.SM_SPH_CURVE.evaluate(fac/max));
          
          minfac = minfac === undefined ? fac : Math.min(minfac, fac);
          maxfac = maxfac === undefined ? fac : Math.max(maxfac, fac);
          
          fac = fac*param + ctx.PARAM2;
          //w = ctx.SM_SPH_CURVE.evaluate(w);
          w = Math.pow(w, fac);
          //w = Math.exp(w*fac) / Math.exp(fac);
          
          if (isNaN(w)) {
            console.log(w0, dis, fac);
            throw new Error("NaN");
          }
          //w *= w*w*w;
          
        } else {
          //w = ctx.SM_SPH_CURVE.evaluate(w);
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
      
      //for (let _i=0; _i<ps.length; _i += PTOT) {
      //  pi1 = Math.floor(Math.random()*0.99999*ps.length/PTOT)*PTOT;
        
      for (let pi1=0; pi1<ps.length; pi1 += PTOT) {
        x1 = ps[pi1+POLDX], y1 = ps[pi1+POLDY], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN];
        
        let searchr3;
        
        //make sure initial "layer" is uniform
        if (gen1 < thresh) {
          if (!do_startlvl) {
            //continue;
          }
          
          //r1 = startr;
          //searchr = startr*ctx.SM_SEARCHRAD2;
          
          searchr = r1*ctx.SM_SEARCHRAD2;
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
          searchr3 = 0.9 / Math.sqrt(gen) * ctx.SM_SEARCHRAD2;
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
        //ps[pi1] = Math.min(Math.max(ps[pi1], 0.0), 1.0);
        //ps[pi1+1] = Math.min(Math.max(ps[pi1+1], 0.0), 1.0);
      }
    }
    
    rebasePaths(ctx) {
        let ps = this.points;

        for (let pi=0; pi<ps.length; pi += PTOT) {
            let path = this.getPath(ctx, pi, false);

            if (path === undefined) {
                continue;
            }

            let dx = ps[pi+PSTARTX] - path.last_startx;
            let dy = ps[pi+PSTARTY] - path.last_starty;

            for (let ti=0; ti<path.length; ti += TTOT) {
                path[ti] += dx;
                path[ti+1] += dy;
            }

            path.last_startx = ps[pi+PSTARTX];
            path.last_starty = ps[pi+PSTARTY];
        }
    }

    setStartCos(ctx) {
        let ps = this.points;

        for (let pi=0; pi<ps.length; pi += PTOT) {
            ps[pi+PSTARTX] = ps[pi];
            ps[pi+PSTARTY] = ps[pi+1];
        }

        //this.rebasePaths(ctx);
    }

    relax() {
        let ps = this.points;
        
        for (let pi=0; pi<ps.length; pi += PTOT) {
          ps[pi+POFFX] = ps[pi];
          ps[pi+POFFY] = ps[pi+1];
          
          ps[pi] = ps[pi+PSTARTX];
          ps[pi+1] = ps[pi+PSTARTY];
        }
        
        //super.relax();
        this.step_base_generate(this.config.copy());

        this.setStartCos(this.config);
        //this.rebasePaths(this.config);
        
        for (let pi=0; pi<ps.length; pi += PTOT) {
          if (this.getPath(this.config, pi, false) !== undefined) {
            ps[pi] = ps[pi+POFFX];
            ps[pi+1] = ps[pi+POFFY];
          }
        }

        this.regen_spatial(this.config);
    }

    max_level() {
      return 1.0;
    }
    
    current_level() {
      return 1.0;
    }
    
    done() {
      return false;
    }
    
    draw(g) {
      super.draw(g);
      
      this.config.update();

      let ctx = window; //this.config;
      let ps = this.points;
      
      if (ctx.SHOW_PATHS && !ctx.DRAW_TEST) {
        let steps = 32, ds = 1.0 / steps;
        
        for (let i=0; i<ps.length; i += PTOT) {
          let path = this.getPath(this.config, i);
          if (path === undefined) {
            continue;
          }
          
          let gen = ps[i+PGEN];
          if (gen > ctx.DISPLAY_LEVEL)
            continue;
          
          let r = this.r*0.2;//*ctx.DRAW_RMUL;
          let lastp = undefined;
          
          let repeat = !ctx.DRAW_TEST && ctx.DRAW_TILED ? 9 : 1;

          for (let step=0; step<repeat; step++) {
            let rx = gridoffs[step][0], ry = gridoffs[step][1];

            g.beginPath();
            g.lineWidth = r*0.15;
            
            let off = gridoffs[step];
            
            for (let s=0, j=0; j<steps; j++, s += ds) {
              if (s < gen) {
                continue;
              }

              let p = path.evaluate(s);

              if (lastp !== undefined && p.vectorDistance(lastp) > 0.25) {
                //sudden jump, probably caused by points wrapping around.
                //during solve

                //for now, just break
                break;
              }

              if (lastp === undefined) {
                g.moveTo(p[0]+off[0], p[1]+off[1]);
              } else {
                g.lineTo(p[0]+off[0], p[1]+off[1]);
              }

              lastp = p;
            }

            g.stroke();
          }
        }
      }
      
      let displaylvl = clampify(ctx, ctx.DISPLAY_LEVEL);

      let solve_limit = _appstate.timer !== undefined && ctx.ADV_SOLVE ? this.cur_t : ctx.SOLVE_LEVEL;
      solve_limit = clampify(ctx, solve_limit);

      let repeat = ctx.DRAW_TEST ? ctx.REPEAT : (ctx.DRAW_TILED ? 3 : 1);
      
      for (let rx=0; rx<repeat; rx++) {
      for (let ry=0; ry<repeat; ry++) {
      
      g.beginPath();
      
      let offx = rx/repeat, offy = ry/repeat;
      for (let i=0; i<ps.length; i += PTOT) {
        let x = ps[i], y = ps[i+1], gen = ps[i+PGEN], r = ps[i+PR], val = gen;
        
        if (ctx.DRAW_TEST) {
            x = ps[i+PSTARTX];
            y = ps[i+PSTARTY];
        }

        x = x/repeat + offx;
        y = y/repeat + offy;

        let f = x * Math.floor(1 + y*9);
        f = Math.fract(f);
        
        if (ctx.DRAW_TEST && this.image !== undefined) {
            let idata = this.image.data;
            let size = Math.max(this.image.width, this.image.height);

            let ix = ~~(x * size);
            let iy = ~~(y * size);

            if (ix < 0 || iy < 0 || ix >= this.image.width || iy >= this.image.height) {
                continue;
            }

            let idx = (iy*this.image.width + ix)*4;
            let s = (idata[idx]/255 + idata[idx+1]/255 + idata[idx+2]/255) / 3.0;

            f = s;
        }
        
        if (ctx.SM_IMAGE_CURVE !== undefined && ctx.SM_IMAGE_CURVE.evaluate !== undefined) {
            f = ctx.SM_IMAGE_CURVE.evaluate(f);
        }
        
        f = f != 0.0 ? f**0.75 : f;
        let ff = 1.0 - Math.pow(1.0 - f, 2.0);
        f = f*0.5 + ff*0.5;

        if (gen > 1.0-f && ctx.DRAW_TEST) {
          continue;
        }
        
        let path = this.getPath(this.config, i);

        if (path !== undefined) {
          let drawlvl;
          
          if (!ctx.DRAW_TEST) {
            drawlvl = Math.min(solve_limit, displaylvl);
          } else {
            drawlvl = 1.0 - f;
          }
          
          let p = path.evaluate(drawlvl*0.999999);
          
          //x = Math.fract(p[0])/repeat+offx;
          //y = Math.fract(p[1])/repeat+offy;
          
          x = p[0]/repeat + offx;
          y = p[1]/repeat + offy;
        }
        
        x = ps[i+PSTARTX]/repeat + offx + (x - ps[i+PSTARTX]/repeat-offx) * ctx.STARTCO_BLEND;
        y = ps[i+PSTARTY]/repeat + offy + (y - ps[i+PSTARTY]/repeat-offy) * ctx.STARTCO_BLEND;
        
        //x = Math.fract(x);
        //y = Math.fract(y);
        
        //let w = r;
        let w;
        
        if (ctx.DRAW_TEST) {
          w = this.r;
        } else if (gen > solve_limit) {
          w = this.r*0.25*2.0;
        } else {
          w = ctx.SIMPLE_MODE && _appstate.timer !== undefined ? this.cur_r : this.r;
          w *= 0.2*2.0;
        }
        
        w *= ctx.DRAW_RMUL;
        
        f = 1.0 - gen;
        
        if (gen > displaylvl) {
          continue;
        }
        
        let alpha = gen > solve_limit ? 0.2 : 1.0;
        
        let ix = ~~(x*this.mask_size + 0.5);
        let iy = ~~(y*this.mask_size + 0.5);
        let idx = (iy*this.mask_size + ix)*4;
        
        let mgen = gen; //gen < ctx.START_THRESHOLD ? 0.0 : gen;
        
        let mf = 0.0; //mgen;
        
        let f1 = ~~(val*255*3);
        let f2=0, f3 = 0;
        
        if (f1 > 255) {
          f2 = f1 - 255;
          f1 = 255;
        }
        
        if (f2 > 255) {
          f3 = f2 - 255;
          f2 = 255;
          f1 = 0;
        }
        //f1=f2=f3=~~(val*255);
        //f1=f2=f3=~~((1.0-mf)*255);
        f1=~~((1.0-Math.sqrt(mf))*255), f2=f3=0.0;
        
        if (ctx.DRAW_COLORS && !ctx.DRAW_TEST) {
          g.beginPath();
        }

        if (ctx.DRAW_TILED && !ctx.DRAW_TEST) {
          x = x*repeat - 1.0;
          y = y*repeat - 1.0;
        }

        g.moveTo(x, y);
        g.arc(x, y, w/repeat, -Math.PI, Math.PI);

        if (ctx.DRAW_COLORS && !ctx.DRAW_TEST) {
          
          g.fillStyle = "rgba("+f1+","+f2+","+f3+","+alpha+")";
          g.fill();
        } else {
          g.fillStyle = "black";
        }
        if (ctx.SHOW_RADII) {
          r = ps[i+PR]*ctx.SM_SEARCHRAD/repeat;
          
          g.beginPath();
          g.moveTo(x, y);
          g.arc(x, y, r, -Math.PI, Math.PI);
          
          if (ctx.DRAW_COLORS && !ctx.DRAW_TEST) {
            g.fillStyle = "rgba("+f1+","+f2+","+f3+","+(0.1*alpha)+")";
          } else {
            g.fillStyle = "black";
          }
          
          g.fill();
        }
        
        //g.rect(x-w*0.5, y-w*0.5, w, w);
      }
      
      g.fill();
      }
      }
      
      if (ctx.DRAW_KDTREE && this.kdtree !== undefined) {
        this.kdtree.draw(g);
      }
    }
  }
  
  sinterface.MaskGenerator.register(config, SmoothedMaskGenerator, "SMOOTHMASK");
  
  return exports;
});
