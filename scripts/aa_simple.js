/*`new aa funcs based on hexoganal grids */

var _aa_hex = undefined;
define([
  "util"
], function(util) {
  'use strict';
  var exports = _aa_hex = {};
  
  var cachering = util.cachering;
  
  var PARAMS = exports.PARAMS = {
    SEED     : 0,
    LIMIT    : 1,
    SHEER    : 2,
    DISTORT  : 3,
    DISTFREQ : 4,
    JITTER   : 5,
    DISTMODE : 6
  };
  
  exports.params = [2.047934363488196, 1.0, 400, 0.1997097292950952, 200, 1.5, 1];
  
  var dxdy_rets = new util.cachering(function() {
    return [0, 0, 0];
  }, 64);

  function spiral(x, y) {
    var a = Math.atan2(y-0.5, x-0.5)/Math.PI;
    var rad = (x-0.5)*(x-0.5) + (y-0.5)*(y-0.5);
    
    var f = Math.cos((x*x + y*y)*7.0)*0.5+0.5;
    f = 1.0 - (1.0-f)*(1.0-f);
    
    rad = Math.sqrt(rad);
    f = Math.fract((a*1.0+3*rad)*1.0);
    
    return f;
  }

  function waver(f) {
    f = Math.fract(f);
    f = 1.0 - Math.abs(f-0.5)*2.0;
    
    return f;
  }

  function waver2(f) {
    return waver(f)*2.0 - 1.0;
  }

  function dist2(f) {
    f /= 3.141;
    
    f = Math.fract(f);
    var rnd = Math.fract(1.0 / (0.000001 + 0.00001*f));
    
    return rnd;
  }

  function dist3(f) {
    f /= 3.141;
    
    f = Math.fract(f);
    var rnd = Math.fract(1.0 / (0.000001 + 0.00001*f));
    f = (f+rnd)*0.5;
    f = (f-0.5)*2.0;
    
    return rnd*1.35;
  }
  
  var ReallySimpleGen = exports.ReallySimpleGen = util.Class([
    function dxdy(ix, iy, size, seed) {
      var th = seed;
      
      var x = Math.cos(th)*ix - Math.sin(th)*iy;
      var y = Math.cos(th)*iy + Math.sin(th)*ix;
      
      var dx = Math.fract(x), dy = Math.fract(y);
      var ret = dxdy_rets.next();
      
      ret[0] = dx;
      ret[1] = dy;
      ret[2] = dx*dx + dy*dy;
      
      return ret;
    }
  ]);
  
  var SimpleGen = exports.SimpleGen = util.Class([
    function dxdy(ix, iy, size, seed) {
      var params = exports.params;
      
      var seed = params[0], limit = params[1], sheer = params[2], distort = params[3];
      var distfreq = params[4];
      
      var wave = waver;
      
      if (!params[PARAMS.DISTMODE] == undefined) {
        ix += Math.sin(ix*distfreq)*distort;
        iy += Math.cos(iy*distfreq)*distort;
      } else if (params[PARAMS.DISTMODE] == 1) {
        ix += dist2(ix*distfreq)*distort;
        iy += dist2(iy*distfreq)*distort;
      } else if (params[PARAMS.DISTMODE] == 2) {
        ix += dist3(ix*distfreq)*distort*0.15;
        iy += dist3(iy*distfreq)*distort*0.15;
      } else if (params[PARAMS.DISTMODE] == 3) {
        wave = waver2;
        
        var x1=ix, y1=iy;
        
        ix = waver(distfreq*distort)*ix - waver(distfreq*distort+0.5)*iy;
        iy = waver(distfreq*distort)*iy + waver(distfreq*distort+0.5)*ix;
        
        var dx = Math.fract(ix), dy = Math.fract(iy);
        
        if (dx > 0.75 || dy > 0.75) {
          var ret = dxdy_rets.next();
          
          ret[0] = 1.0;
          ret[1] = 1.0;
          return ret;
        }
      } else if (params[PARAMS.DISTMODE] == 4) {
        wave = waver2;
        
        var f = 1; //Math.tent(T)*0.75+0.25;
        
        ix += wave(iy*0.2)*distort;
        iy -= wave(ix*0.2)*distort;
        
        //ix += waver(ix*0.3*distort*f);
        //iy += waver(iy*0.3*distort*f);
      }
      
      var rx = wave(seed)*ix - wave(seed*sheer+0.5)*iy;
      var ry = wave(seed)*iy + wave(seed*sheer+0.5)*ix;
      
      var dx = Math.fract(rx), dy = Math.fract(ry);
      var ret = dxdy_rets.next();
      
      if (params[PARAMS.DISTMODE] == 4) {
        var seed2 = seed+0.4;
        var rx2 = wave(seed2)*ix - wave(seed2*sheer+0.5)*iy;
        var ry2 = wave(seed2)*iy + wave(seed2*sheer+0.5)*ix;
        
        ret[0] = dx*Math.fract(rx2)*1.5;
        ret[1] = dy*Math.fract(ry2)*1.5;
      } else {
        ret[0] = dx;
        ret[1] = dy;
      }
      
      var f = Math.max(ret[0], ret[1]);
      //f = 1.0 - (1.0-f)*(1.0-f);
      
      ret[2] = f*f;
      
      return ret;
    }  
  ]);
  
  return exports;
});
