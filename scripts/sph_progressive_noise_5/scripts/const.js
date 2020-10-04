var _const = undefined;

define([
], function() {
  'use strict';
  
  var exports = _const = {};
  
  exports.gridoffs = [
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

  exports._save_exclude = {
    gridoffs : 1,
    _save_exclude : 1,
    //SPH_CURVE     : 1,
    //RADIUS_CURVE     : 1,
    //TONE_CURVE    : 1,
    //IMAGE_CURVE   : 1
  };
  
  exports.SmoothModes = {
    SIMPLE  : 1,
    POLYFIT : 2
  };
  
  exports.PATH_DEGREE = 8;
  
  exports.SPH_CURVE = exports.RADIUS_CURVE = exports.TONE_CURVE = exports.IMAGE_CURVE = undefined;
  exports.APPLY_TONING = false;
  
  exports.SEARCHRAD = 1.5;
  exports.CMYK_SEARCHRAD = 4;
  
  exports.DRAW_TEST = false;
  exports.DIMEN = 32;
  exports.MAX_SCALE = 8.0;
  exports.RADMUL = 0.8;
  exports.PATH_SMOOTH_FACTOR = 1.0;
  exports.SIMPLE_MODE = false;
  exports.DISPLAY_LEVEL = 1;
  exports.SOLVE_LEVEL = 1;
  exports.DV_DAMPING = 1.0;
  exports.GENSTART = 0.0;
  exports.PULL_FACTOR = 0.05;
  exports.RANGE = 255;
  exports.REPEAT = 5;
  exports.STARTCO_BLEND = 1.0;
  exports.PRESTEPS = 16;
  exports.RANDFAC = 1.5;
  exports.PARAM1 = 0;
  exports.PARAM2 = 0;
  exports.PARAM3 = 0;
  exports.PARAM4 = 0;
  exports.PARAM5 = 0;
  exports.PARAM6 = 0;
  exports.PARAM7 = 0;
  exports.DRAW_INTENSITY = false;
  exports.DRAW_COLORS = true;
  exports.IMAGE_COLORS = true;
  exports.USE_IMAGE = true;
  exports.GENSTEPS = 255;
  
  exports.SOLVER_PARAM_MIN = 0;
  exports.SOLVER_PARAM_MAX = 7;
  exports.SOLVER_STEPS = 15;
  exports.SOLVER_SPEED = 1.0;
  exports.SOLVER_SEARCHRAD = 2.5;
  exports.SOLVER_RANGE = 24;
  exports.SOLVER_NORMAL_STEPS = 15;
  exports.SOLVER_PARAM_WEIGHT = 1.0;
  exports.SOLVER_SEARCHRAD_WEIGHT = 1.0;
  exports.SOLVER_MAXSCALE_WEIGHT = 1.0;
  exports.SOLVER_RANDFAC = 1.0;
  exports.SOLVER_IN_SERIES = true;
  exports.SOLVER_RANDSEED = 1;
  exports.SOLVER_STARTSPEED_THRESH = 1.0;
  
  //points "data structure"
  if (window.PTOT === undefined) {
    window.PX=0;
    window.PY=1;
    window.POLDX=2;
    window.POLDY=3;
    window.PDX=4;
    window.PDY=5;
    window.PR=6;
    window.PR2=7
    window.PGEN=8;
    window.PSDX=9;
    window.PSDY=10;
    window.PSW=11;
    window.PSNUM=12;
    window.PVAL=13;
    window.POGEN=14;
    window.PSTARTX = 15;
    window.PSTARTY = 16;
    window.PCLR = 17;
    window.PTOT=18;
  }
  
  exports.copy = function() {
    let ret = {};
    
    for (let k in this) {
      ret[k] = this[k];
    }
    
    return ret;
  }
  
  exports.toJSON = function() {
    let ret = {};
    
    for (let k in this) {
      for (let k in this) {
        
      }
      let v = this[k];
      
      if (k in exports._save_exclude) {
        continue;
      }
      
      if (typeof v == "function") {
        continue;
      }
      
      if (k[0] == "_") {
        continue;
      }
      
      ret[k] = v;
    }
    
    return ret;
  }
  
  exports.headlessLoad = function(config, uimodule) {
    if (config !== undefined) {
      for (let k in config) {
        exports[k] = config[k];
      }
    }
    
    for (let k in exports) {
      let v = exports[k];
      
      if (typeof v == "object" && v.is_new_curve) {
        let curve = new uimodule.Curve(v.setting_id);
        
        curve.loadJSON(v);
        exports[k] = curve;
      }
    }
  }
  
  exports.loadJSON = function loadJSON(obj) {
    for (let k in obj) {
      if (k in exports._save_exclude) {
        continue;
      }
      
      if (k[0] != "_") {
        exports[k] = obj[k];
      }
    }
  }
  
  
  function load(obj) {
    for (let k in obj) {
      exports[k] = obj[k];
    }
  }
 
  let defaults;
  
  defaults = {"gridoffs":[[0,0],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]],"SmoothModes":{"SIMPLE":1,"POLYFIT":2},"PATH_DEGREE":8,"IMAGE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Image CurveIMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3437499999999999,"1":0.1812499999999998,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.6312500000000004,"1":0.8562500000000001,"eid":11,"flag":1,"deg":3,"tangent":1},{"0":0.9999999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":0},"TONE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Tone CurveTONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.675,"1":0.1937500000000001,"eid":39,"flag":1,"deg":3,"tangent":1},{"0":0.825,"1":0.13124999999999987,"eid":38,"flag":1,"deg":3,"tangent":1},{"0":0.9812500000000001,"1":0.99375,"eid":28,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":40}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":1},"RADIUS_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Radius CurveRADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.006249999999999992,"1":0.23750000000000004,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.08750000000000008,"1":0.4562499999999998,"eid":12,"flag":1,"deg":3,"tangent":1},{"0":0.21874999999999997,"1":0.7125000000000001,"eid":15,"flag":0,"deg":3,"tangent":1},{"0":0.475,"1":0.9187500000000001,"eid":14,"flag":0,"deg":3,"tangent":1},{"0":0.69375,"1":1,"eid":13,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x*x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":1},"SPH_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__SPH CurveSPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":6,"flag":0,"deg":3,"tangent":1},{"0":0.2124999999999999,"1":0.29375000000000007,"eid":8,"flag":0,"deg":3,"tangent":1},{"0":0.60625,"1":0.0687500000000002,"eid":10,"flag":0,"deg":3,"tangent":1},{"0":0.84375,"1":0.33125000000000004,"eid":9,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":11}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.2676}],"version":0.5,"active_generator":2},"APPLY_TONING":true,"SEARCHRAD":2,"CMYK_SEARCHRAD":0.25,"DRAW_TEST":true,"DIMEN":28,"MAX_SCALE":2,"RADMUL":0.95,"PATH_SMOOTH_FACTOR":1,"SIMPLE_MODE":true,"DISPLAY_LEVEL":1,"SOLVE_LEVEL":1,"DV_DAMPING":1,"GENSTART":0.05,"PULL_FACTOR":0.05,"RANGE":255,"REPEAT":15,"STARTCO_BLEND":1,"PRESTEPS":16,"RANDFAC":1,"PARAM1":5.076442691459362,"PARAM2":0.05757226946767474,"PARAM3":3.6788143426420703,"PARAM4":2.8922538884573337,"PARAM5":1,"PARAM6":1,"PARAM7":1,"DRAW_INTENSITY":false,"DRAW_COLORS":false,"IMAGE_COLORS":false,"USE_IMAGE":false,"GENSTEPS":4096,"SOLVER_PARAM_MIN":1,"SOLVER_PARAM_MAX":4,"SOLVER_STEPS":10,"SOLVER_SPEED":1,"SOLVER_SEARCHRAD":1.3,"SOLVER_RANGE":32,"SOLVER_NORMAL_STEPS":30,"SOLVER_PARAM_WEIGHT":1,"SOLVER_SEARCHRAD_WEIGHT":0,"SOLVER_MAXSCALE_WEIGHT":0,"SOLVER_RANDFAC":1,"SOLVER_IN_SERIES":false,"SOLVER_RANDSEED":1,"SOLVER_STARTSPEED_THRESH":2.425,"APP_VERSION":0.0001,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"PREPOWER":1,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"RMUL":1,"SPH_SPEED":0.35465781249999995,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.22,"PARAM":0.45,"TIMER_STEPS":33554432,"START_THRESHOLD":0.3,"SMALL_MASK":false,"XLARGE_MASK":false,"SHOW_RADII":false,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SEARCHRAD2":3.96,"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1,"SHOW_PATHS":false,"UPDATE_START_COS":false,"ADV_SOLVE":false,"ADV_STEPS":32,"CMYRK_SEARCHRAD":4,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"PARAM0":0.7865952966818254};
  
  defaults = {"gridoffs":[[0,0],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]],"SmoothModes":{"SIMPLE":1,"POLYFIT":2},"PATH_DEGREE":8,"IMAGE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Image CurveIMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3437499999999999,"1":0.1812499999999998,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.6312500000000004,"1":0.8562500000000001,"eid":11,"flag":1,"deg":3,"tangent":1},{"0":0.9999999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":0},"TONE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Tone CurveTONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.675,"1":0.1937500000000001,"eid":39,"flag":1,"deg":3,"tangent":1},{"0":0.825,"1":0.13124999999999987,"eid":38,"flag":1,"deg":3,"tangent":1},{"0":0.9812500000000001,"1":0.99375,"eid":28,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":40}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":1},"RADIUS_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Radius CurveRADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.006249999999999992,"1":0.23750000000000004,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.08750000000000008,"1":0.4562499999999998,"eid":12,"flag":1,"deg":3,"tangent":1},{"0":0.21874999999999997,"1":0.7125000000000001,"eid":15,"flag":0,"deg":3,"tangent":1},{"0":0.475,"1":0.9187500000000001,"eid":14,"flag":0,"deg":3,"tangent":1},{"0":0.69375,"1":1,"eid":13,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x*x"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":1},"SPH_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__SPH CurveSPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":6,"flag":0,"deg":3,"tangent":1},{"0":0.2124999999999999,"1":0.29375000000000007,"eid":8,"flag":0,"deg":3,"tangent":1},{"0":0.60625,"1":0.0687500000000002,"eid":10,"flag":0,"deg":3,"tangent":1},{"0":0.84375,"1":0.33125000000000004,"eid":9,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":11}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.2676}],"version":0.5,"active_generator":2},"APPLY_TONING":true,"SEARCHRAD":2,"CMYK_SEARCHRAD":0.25,"DRAW_TEST":true,"DIMEN":28,"MAX_SCALE":2,"RADMUL":0.95,"PATH_SMOOTH_FACTOR":1,"SIMPLE_MODE":true,"DISPLAY_LEVEL":1,"SOLVE_LEVEL":1,"DV_DAMPING":1,"GENSTART":0.05,"PULL_FACTOR":0.05,"RANGE":255,"REPEAT":11,"STARTCO_BLEND":1,"PRESTEPS":16,"RANDFAC":1,"PARAM1":3.982289748343331,"PARAM2":0.13567612765503795,"PARAM3":3.6448736102720494,"PARAM4":2.5463536875252384,"PARAM5":1,"PARAM6":1,"PARAM7":1,"DRAW_INTENSITY":false,"DRAW_COLORS":false,"IMAGE_COLORS":false,"USE_IMAGE":false,"GENSTEPS":4096,"SOLVER_PARAM_MIN":1,"SOLVER_PARAM_MAX":4,"SOLVER_STEPS":10,"SOLVER_SPEED":1,"SOLVER_SEARCHRAD":1.3,"SOLVER_RANGE":32,"SOLVER_NORMAL_STEPS":30,"SOLVER_PARAM_WEIGHT":1,"SOLVER_SEARCHRAD_WEIGHT":0,"SOLVER_MAXSCALE_WEIGHT":0,"SOLVER_RANDFAC":1,"SOLVER_IN_SERIES":false,"SOLVER_RANDSEED":1,"SOLVER_STARTSPEED_THRESH":2.425,"APP_VERSION":0.0001,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"PREPOWER":1,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"RMUL":1,"SPH_SPEED":0.35465781249999995,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.22,"PARAM":0.45,"TIMER_STEPS":33554432,"START_THRESHOLD":0.3,"SMALL_MASK":false,"XLARGE_MASK":false,"SHOW_RADII":false,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SEARCHRAD2":3.96,"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1,"SHOW_PATHS":false,"UPDATE_START_COS":false,"ADV_SOLVE":false,"ADV_STEPS":32,"CMYRK_SEARCHRAD":4,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"PARAM0":0.7865952966818254};
  
  defaults = {"gridoffs":[[0,0],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]],"SmoothModes":{"SIMPLE":1,"POLYFIT":2},"PATH_DEGREE":8,"IMAGE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Image CurveIMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3437499999999999,"1":0.1812499999999998,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.6312500000000004,"1":0.8562500000000001,"eid":11,"flag":1,"deg":3,"tangent":1},{"0":0.9999999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":0},"TONE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Tone CurveTONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.675,"1":0.1937500000000001,"eid":39,"flag":1,"deg":3,"tangent":1},{"0":0.825,"1":0.13124999999999987,"eid":38,"flag":1,"deg":3,"tangent":1},{"0":0.9812500000000001,"1":0.99375,"eid":28,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":40}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":1},"RADIUS_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Radius CurveRADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.006249999999999992,"1":0.23750000000000004,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.08750000000000008,"1":0.4562499999999998,"eid":12,"flag":1,"deg":3,"tangent":1},{"0":0.21874999999999997,"1":0.7125000000000001,"eid":15,"flag":0,"deg":3,"tangent":1},{"0":0.475,"1":0.9187500000000001,"eid":14,"flag":0,"deg":3,"tangent":1},{"0":0.69375,"1":1,"eid":13,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":1},"SPH_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__SPH CurveSPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":6,"flag":0,"deg":3,"tangent":1},{"0":0.2124999999999999,"1":0.29375000000000007,"eid":8,"flag":0,"deg":3,"tangent":1},{"0":0.60625,"1":0.0687500000000002,"eid":10,"flag":0,"deg":3,"tangent":1},{"0":0.84375,"1":0.33125000000000004,"eid":9,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":11}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.2676}],"version":0.5,"active_generator":2},"APPLY_TONING":true,"SEARCHRAD":2,"CMYK_SEARCHRAD":0.5,"DRAW_TEST":true,"DIMEN":32,"MAX_SCALE":2,"RADMUL":0.95,"PATH_SMOOTH_FACTOR":1,"SIMPLE_MODE":true,"DISPLAY_LEVEL":1,"SOLVE_LEVEL":1,"DV_DAMPING":1,"GENSTART":0.05,"PULL_FACTOR":0.05,"RANGE":255,"REPEAT":12,"STARTCO_BLEND":1,"PRESTEPS":16,"RANDFAC":1,"PARAM1":3.982289748343331,"PARAM2":0.08,"PARAM3":8.7,"PARAM4":2.5463536875252384,"PARAM5":1,"PARAM6":0.3,"PARAM7":1,"DRAW_INTENSITY":false,"DRAW_COLORS":false,"IMAGE_COLORS":true,"USE_IMAGE":false,"GENSTEPS":4096,"SOLVER_PARAM_MIN":1,"SOLVER_PARAM_MAX":4,"SOLVER_STEPS":10,"SOLVER_SPEED":1,"SOLVER_SEARCHRAD":1.3,"SOLVER_RANGE":32,"SOLVER_NORMAL_STEPS":30,"SOLVER_PARAM_WEIGHT":1,"SOLVER_SEARCHRAD_WEIGHT":0,"SOLVER_MAXSCALE_WEIGHT":0,"SOLVER_RANDFAC":1,"SOLVER_IN_SERIES":false,"SOLVER_RANDSEED":1,"SOLVER_STARTSPEED_THRESH":2.425,"APP_VERSION":0.0001,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"PREPOWER":1,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"RMUL":1,"SPH_SPEED":0.225,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.2,"PARAM":0.45,"TIMER_STEPS":33554432,"START_THRESHOLD":0.3,"SMALL_MASK":false,"XLARGE_MASK":false,"SHOW_RADII":false,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SEARCHRAD2":3.96,"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1,"SHOW_PATHS":false,"UPDATE_START_COS":false,"ADV_SOLVE":false,"ADV_STEPS":32,"CMYRK_SEARCHRAD":4,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"PARAM0":0.7865952966818254};
  
  defaults = {"SmoothModes":{"SIMPLE":1,"POLYFIT":2},"PATH_DEGREE":8,"IMAGE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Image CurveIMAGE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.3437499999999999,"1":0.1812499999999998,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.6312500000000004,"1":0.8562500000000001,"eid":11,"flag":1,"deg":3,"tangent":1},{"0":0.9999999999999999,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":0},"TONE_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Tone CurveTONE_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.675,"1":0.1937500000000001,"eid":39,"flag":1,"deg":3,"tangent":1},{"0":0.825,"1":0.13124999999999987,"eid":38,"flag":1,"deg":3,"tangent":1},{"0":0.9812500000000001,"1":0.99375,"eid":28,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":40}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":0,"deviation":3}],"version":0.5,"active_generator":1},"RADIUS_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__Radius CurveRADIUS_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.006249999999999992,"1":0.23750000000000004,"eid":16,"flag":0,"deg":3,"tangent":1},{"0":0.08750000000000008,"1":0.4562499999999998,"eid":12,"flag":1,"deg":3,"tangent":1},{"0":0.21874999999999997,"1":0.7125000000000001,"eid":15,"flag":0,"deg":3,"tangent":1},{"0":0.475,"1":0.9187500000000001,"eid":14,"flag":0,"deg":3,"tangent":1},{"0":0.69375,"1":1,"eid":13,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":17}},{"type":2,"equation":"x**0.75"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":1},"SPH_CURVE":{"is_new_curve":true,"setting_id":"startup_file_spha5__SPH CurveSPH_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0,"1":0,"eid":6,"flag":0,"deg":3,"tangent":1},{"0":0.2124999999999999,"1":0.29375000000000007,"eid":8,"flag":0,"deg":3,"tangent":1},{"0":0.60625,"1":0.0687500000000002,"eid":10,"flag":0,"deg":3,"tangent":1},{"0":0.84375,"1":0.33125000000000004,"eid":9,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":11}},{"type":2,"equation":"x"},{"type":4,"height":1,"offset":1,"deviation":0.2676}],"version":0.5,"active_generator":2},"APPLY_TONING":true,"SEARCHRAD":2,"CMYK_SEARCHRAD":0.5,"DRAW_TEST":true,"DIMEN":32,"MAX_SCALE":2,"RADMUL":0.95,"PATH_SMOOTH_FACTOR":1,"SIMPLE_MODE":true,"DISPLAY_LEVEL":1,"SOLVE_LEVEL":1,"DV_DAMPING":1,"GENSTART":0.05,"PULL_FACTOR":0.05,"RANGE":255,"REPEAT":20,"STARTCO_BLEND":1,"PRESTEPS":16,"RANDFAC":7.6736,"PARAM1":0.2391,"PARAM2":0.2391,"PARAM3":1.4782000000000002,"PARAM4":4.2943,"PARAM5":1.1402,"PARAM6":1.4782000000000002,"PARAM7":0.915,"DRAW_INTENSITY":false,"DRAW_COLORS":false,"IMAGE_COLORS":true,"USE_IMAGE":false,"GENSTEPS":4096,"SOLVER_PARAM_MIN":1,"SOLVER_PARAM_MAX":4,"SOLVER_STEPS":10,"SOLVER_SPEED":1,"SOLVER_SEARCHRAD":1.3,"SOLVER_RANGE":32,"SOLVER_NORMAL_STEPS":30,"SOLVER_PARAM_WEIGHT":1,"SOLVER_SEARCHRAD_WEIGHT":0,"SOLVER_MAXSCALE_WEIGHT":0,"SOLVER_RANDFAC":1.0322600000000002,"SOLVER_IN_SERIES":false,"SOLVER_RANDSEED":1,"SOLVER_STARTSPEED_THRESH":2.425,"APP_VERSION":0.0001,"USE_MASK":false,"PROG_BASE_LAYER":true,"EXPONENT":0.1,"PREPOWER":1,"TONE_IN_SOLVER":false,"KEEP_UNIFORM":false,"RMUL":1,"SPH_SPEED":0.225,"DISPLAY_LEVEL1":0,"DISPLAY_LEVEL2":1,"POINTSCALE":0.293,"PARAM":0.45,"TIMER_STEPS":33554432,"START_THRESHOLD":0.3,"SMALL_MASK":false,"XLARGE_MASK":false,"SHOW_RADII":false,"VOIDCLUSTER":true,"ALTERNATE":false,"GUASS_MIN":0.1,"GUASS_POW":1,"SCALE_GAUSS":false,"SCALE_RADIUS":false,"RADIUS_POW":1,"PROPEGATE_W":true,"INITIAL_W_POWER":4,"DRAW_KDTREE":false,"TONE_MASK":true,"SEARCHRAD2":3.96,"EXP2":0.8,"Equations":{"W5":0,"W4":1,"W3":2,"GUASSIAN":3,"CUBIC":4,"POW":5},"W_EQUATION":3,"SPH_EQUATION":0,"W_PARAM":0.6,"W_PARAM2":0.4,"SPH_PARAM":1,"SHOW_PATHS":false,"UPDATE_START_COS":false,"ADV_SOLVE":false,"ADV_STEPS":32,"CMYRK_SEARCHRAD":4,"CURVE_DEFAULTS":{"TONE_CURVE":{"points":[{"0":0.13125,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.26249999999999996,"1":0.6,"eid":5,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":9}}},"PARAM0":0.7865952966818254};
  
  load(defaults);
  
  return exports;
});
