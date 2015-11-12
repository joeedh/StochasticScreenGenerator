//argh! I hate doing this! but necassary!
//core data 'structures' are actually embedded in typed arrays. . . ger

window.DEV_MODE = false;

window.MAX_REPORT_LINES = 12;

window.MODES = {
  SPH      : 0,
  DART     : 1,
//  SPECTRAL : 2,
  JITTER   : 3,
  AA       : 4
};

window.MODE = MODES.DART;

window.CMYK = [
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
  [0, 0, 0]
];

window.AA_ADD_JITTER = 0;

//only used if EXPLORE_AA_SEED is false
//var AA_SEED = Math.sqrt(3.0)*0.1443375
//var AA_SEED = 0.001327338899593235; //0.617411; //2.3683055473992147;

//simplex version
//var AA_SEED = 0.0012417041318775422;
var AA_SEED = 0.07350273436363906;

//0.617411
//0.40656
//0.39075
//0.22686
//0.57733
//0.58663

//only used if EXPLORE_AA_LIMIT is false
//hard to describe, picture in paper is clear
//though.

/*limit: 0.3227518406, seed: 2.3683055473992147 */

/*parameters for first convergent progressive sph:
  aa_seed : 0.07350273436363906
  limit   : 0.45325
  base    : 22383453
*/

//be very careful with changing this one
//affects quality and periocity of patterns
var AA_BASE = 22383453;
//previously: 23355

var AA_LIMIT =  0.45325; //0.485879655; //0.495;//0.3227518406;
  
var EXPLORE_AA_SEED = 0;
var EXPLORE_AA_LIMIT = 0;

var MAX_BIN = 128;
  

//points, if PR is < 0 then point is dead
var PX=0, PY=1, PR=2, PGEN=3, PDX=4, PDY=5, PR2=6, PD=7, PIX=8, PIY=9, PCLR=10, PFLAG=11, PTOT=12;

window.SPH_CURVE = undefined;
window.TONE_CURVE = undefined;
window.RADIUS_CURVE = undefined;

window.GEN_MASK = true;
window.GEN_CMYK_MASK = false;

window.DISPLAY_TILED = true;
window.NO_COLOR = false;
window.ALLOW_OVERDRAW = false;

window.AA_SPEED = 0.5;
window.SPH_SPEED = 1.0;
window.DIMEN = 50;

window.DRAW_RMUL = 0.5;
window.DRAW_COLOR = false;

window.SCALE = 0.5;
window.PANX = 0.0;
window.PANY = 0.0;
window.DRAW_KDTREE = false;
window.DRAW_MASK = false;

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

window.SMALL_MASK = false;

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
  
  var get_searchoff = exports.get_searchoff = function get_searchoff(n, noreport) {
    var r = n, i=n;
    
    if (_search_offs.length <= n) {
      _search_offs.length = n+1;
    }
    
    if (_search_offs[n] != undefined) {
      return _search_offs[n];
    }
    
    if (!noreport)
      console.trace("generate search a off of radius", n, "...");
    
    var lst = [];
    for (var x=-i; x<i; x++) {
      for (var y=-i; y<i; y++) {
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
    
    _search_offs[n] = lst;
    
    return lst;
  }

  for (var i=0; i<32; i++) {
      get_searchoff(i, true);
  }
  
  return exports;
});

