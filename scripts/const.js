
//argh! I hate doing this! but necassary!
//core data 'structures' are actually embedded in typed arrays. . . ger

let _legacy_config_keys = ["MODE","SPH_SPEED","SPH_EXP","SPH_MUL","SPH_FILTERWID","DIMEN","DRAW_RMUL","SCALE","PANX","PANY","DISTANCE_LIMIT","HIEARCHIAL_SCALE","HIEARCHIAL_LEVELS","DRAW_RESTRICT_LEVEL","STEPS","QUALITY_STEPS", "SMALL_MASK",
"XLARGE_MASK", "QUALITY_STEPS", "ALLOW_OVERDRAW", "GEN_CMYK_MASK", "DRAW_HISTOGRAM", "DRAW_OFFS", "FFT_TARGETING",
"DRAW_KDTREE", "DRAW_MASK", "SCAN_MODE", "HIEARCHIAL_SCALE", "HIEARCHIAL_LEVELS", "TILABLE", "LIMIT_DISTANCE", "USE_MERSENNE",
"DRAW_TILED", "DISPLAY_TILED", "NO_COLOR", "USE_TONE_CURVE", "DRAW_GRID", "DRAW_COLOR", "DRAW_GEN"];

window.DEV_MODE = false;
window.APP_VERSION = 0.5;

window.MAX_REPORT_LINES = 12;

window.MODES = {
  SPH      : 0,
  DART     : 1,
  VOID_CLUSTER : 2,
  DART2    : 3,
  MITCHELL : 4,
  MASKOPT  : 5,
  BLUEVC   : 6
};

window.DRAW_GRID = false;
window.MODE = MODES.DART;
window.VOID_HEX_MODE = false;
window.TEST_CLUSTER = false;

//small offset to signal that a pixel isn't blank in expanded/large masks.
//didn't want to use alpha for it.
window.LARGE_MASK_NONZERO_OFFSET = 5;
 
window.CMYK = [
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
  [0, 0, 0]
];

window.ALIGN_GRID = false;
window.VOID_BAYER_MODE = false;

var MAX_BIN = 128;
  

//points, if PR is < 0 then point is dead
var PX=0, PY=1, PR=2, PGEN=3, PDX=4, PDY=5, PR2=6, PD=7, 
    PIX=8, PIY=9, PCLR=10, PFLAG=11, POLDX=12, POLDY=13,
    POFFX=14, POFFY=15, POX=16, POY=17, POGEN=18, PTOT=19;

window.DRAW_OFFS = false;
window.DRAW_HISTOGRAM = true;
window.SPH_CURVE = undefined;
window.TONE_CURVE = undefined;
window.USE_TONE_CURVE = true;
window.RADIUS_CURVE = undefined;
window.VOIDCLUSTER_CURVE = undefined;
window.FFT_CURVE = undefined;

window.FFT_TARGETING = false;

window.GEN_MASK = true;
window.GEN_CMYK_MASK = false;

window.DISPLAY_TILED = true;  
window.NO_COLOR = false;
window.ALLOW_OVERDRAW = false;

window.SPH_SPEED = 1.0;
window.SPH_EXP = 2.2;
window.SPH_MUL = 1.0;
window.SPH_FILTERWID = 7.5;

window.DIMEN = 50;

window.DRAW_RMUL = 0.5;
window.DRAW_COLOR = false;
window.DRAW_GEN = false;

window.SCALE = 0.5;
window.PANX = 0.0;
window.PANY = 0.0;
window.DRAW_KDTREE = false;
window.DRAW_MASK = false;
window.SCAN_MODE = false;

window.TILABLE = true;

window.LIMIT_DISTANCE = false;
window.DISTANCE_LIMIT = 0.15;

window.HIEARCHIAL_SCALE = 9.5;
window.HIEARCHIAL_LEVELS = 8;

window.USE_MERSENNE = true;

Math._random = Math.random;
Math.random = function() {
  if (USE_MERSENNE) {
    return _util.random();
  } else {
    return Math._random();
  }
}

window.DRAW_RESTRICT_LEVEL = 1;
window.DRAW_TILED = false;

window.SMALL_MASK = false;
window.XLARGE_MASK = false;

window.STEPS = 760;
window.QUALITY_STEPS = 8;

window._search_offs = new Array(64);
_search_offs[0] = [];

//helper offsets for making pointsets tilable
var _poffs = [
  [ 0,  0],
  
  [-1, -1],
  [-1,  0],
  [-1,  1],
  
  [ 0,  1],
  [ 1,  1],
  [ 1,  0],

  [ 1, -1],
  [ 0, -1]
];

var _const = undefined;
define([
  "util"
], function(util) {
  'use strict';
  
  var exports = _const = {};
  
  exports.save = function() {
    let ret = {};
    
    for (let cfg of exports._configs) {
      for (let k in cfg) {
        ret[k] = window[k];
      }
    }
    
    for (let k of _legacy_config_keys) {
      ret[k] = window[k];
    }
    
    return ret;
  }
  
  exports.load = function(obj) {
    console.log("loading", obj);
    
     for (let k in obj) {
       let v = obj[k];
       
       window[k] = obj[k];
     }
  }
  
  exports._configs = [];
  exports.DefaultCurves = {};
  
  exports.EditableCurve = class EditableCurve {
    constructor(uiname, default_json) {
      this.uiname = uiname;
      this.default_json = default_json;
    }
  }
  
  //note: don't call this directly, call interface.MaskConfig.registerConfig!
  exports.registerConfig = function(cfg) {
    exports._configs.push(cfg);
    
    //need to refactor config system
    for (let k in cfg) {
      let v = cfg[k];
      
      if (v instanceof exports.EditableCurve) {
        if (v.default_json !== undefined) {
          console.log("Registering curve", k);
          
          exports.DefaultCurves[k] = v.default_json;
        }
        
        v = undefined; //XXX should spawn a curve here, but need to split curve base code out of ui.js first
      }
      
      if (!(k in window)) {
        window[k] = v;
      }
    }
  }
  
  function gen_soff_variants(soff) {
    var steps = 16;
    var hash = {};
    
    function shuffle(lst) {
      for (var i=0; i<lst.length; i++) {
        var ri = ~~(Math.random()*lst.length*0.999999);
        var t = lst[ri];
        
        lst[ri] = lst[i];
        lst[i] = t;
      }
    }
    
    for (var i=0; i<soff.length; i++) {
      var ix = soff[i][0], iy = soff[i][1];
      var dis = ix*ix + iy*iy;
      
      if (!(dis in hash)) {
        hash[dis] = [];
      }
      
      var lvl = hash[dis];
      lvl.push([ix, iy]);
    }
    
    var ret = [];
    
    for (var si=0; si<steps; si++) {
      var lst = [];
      
      for (var k in hash) {
        var lvl = hash[k];
        
        //don't shuffle base level
        if (si > 0) {
          shuffle(lvl);
        }
        
        for (var j=0; j<lvl.length; j++) {
          lst.push(lvl[j]);
        }
      }
      
      lst.sort(function(a, b) {
        return a[0]*a[0] + a[1]*a[1] - b[0]*b[0] - b[1]*b[1];
      });
      
      ret.push(lst);
    }
    
    return ret
  }
  
  var get_searchoff_norand = exports.get_searchoff_norand = function get_searchoff_norand(n, noreport) {
    if (_search_offs[n] != undefined) {
      var variants = _search_offs[n];
      return variants[0];
    }
    
    get_searchoff(n, noreport);
    
    return _search_offs[n][0];
  }
  
  var get_searchoff = exports.get_searchoff = function get_searchoff(n, noreport) {
    var r = n, i=n;
    
    if (_search_offs.length <= n) {
      _search_offs.length = n+1;
    }
    
    if (_search_offs[n] != undefined) {
      var variants = _search_offs[n];
      var ri = ~~(Math.random()*variants.length*0.99999);
      
      return variants[ri];
    }

    if (!noreport) {
    //  console.trace("generate search a off of radius", n, "...");
    }
    
    var lst = [];
    for (var x=-i; x<=i; x++) {
      for (var y=-i; y<=i; y++) {
        var x2 = x < 0 ? x+1 : x;
        var y2 = y < 0 ? y+1 : y;
        
        var dis = x2*x2 + y2*y2;
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        //console.log(dis.toFixed(3), r.toFixed(3));
        
        if (dis > r) {
          continue;
        }
        
        lst.push([x, y]);
      }
    }
    
    //sort by distance
    lst.sort(function(a, b) {
      return a[0]*a[0] + a[1]*a[1] - b[0]*b[0] - b[1]*b[1];
    });
    
   _search_offs[n] = gen_soff_variants(lst);
    
    return exports.get_searchoff(n);
  }

  window.gen_soff_variants = gen_soff_variants;
  
  for (var i=0; i<16; i++) {
      get_searchoff(i, true);
  }
  
  return exports;
});

