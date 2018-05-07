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
  
  var tent=Math.tent, fract=Math.fract, cos=Math.cos, sin=Math.sin;
  function cos1(f) {
     return  cos(f*2.0*Math.PI);
  }
  var SLIDERS=[-0.5775604999999985,6.440483302499992,2.804,1.3311397674999965,8.5];

  var noise2_rets = new util.cachering(function() {
    return [0, 0];
  }, 128);

  function noise2(x, y) {
    x += 10.0;
    y += 10.0;
    
    x = Math.fract(x*0.1)+1.0 + x*0.0002;
    y = Math.fract(y*0.1)+1.0 + y*0.0003;
    var dx = Math.fract(1.0 / (0.000001*x*y + 0.00001));
    var dy = Math.fract(1.0 / (0.000002*(x*y+x) + 0.00001));
    
    var ret = noise2_rets.next();
    ret[0] = dx;
    ret[1] = dy;
    
    return ret;
  }
  function stepnoise(ix, iy, size) {
    return noise2((~~(ix/size))*size, (~~(iy/size))*size);
  }
  
  function cubic(a, b, c, d, t) {
    var r1 = a*(1.0-t) + b*t;
    var r2 = b*(1.0-t) * c*t;
    var r3 = c*(1.0-t) + d*t;
    
    var a1 = r1*(1.0-t) + r2*t;
    var a2 = r2*(1.0-t) + r3*t;
    
    return a1*(1.0-t) + a2*t;
  }

  if (window.TT == undefined)
    window.TT = 4.0
  
  //SLIDERS=[4.474403462499999,3.0383999999999998];

  var SimpleGen = exports.SimpleGen = util.Class([
    function dxdy(ix, iy, size, seed) {
      var ret = dxdy_rets.next();
      
      //ret[2] = Math.fract(Math.fract(Math.fract(ix*2.1324 + iy*3.345)*TT)*4.245);
      //ret[2] = Math.fract((ix*ix + iy*iy)*(5.0 + 1.0/31));
      /*
      var th = 566/99;
      //th = 131/23;
      
      var f  = Math.fract(ix*th + iy/th);
      
      var f2 = Math.fract(ix/Math.PI)*Math.fract(iy/Math.PI); //Math.sqrt(2));
      var d = 4;
      f2 = (~~(f2*d))/d;
      
      f = 1.0-0.985*Math.log(1.0+(1.0-f)*19.95) / Math.log(20.0);
      f = f2*0.1 + f*0.9;
      
      f = cubic(0.0, 0.95, 0.9, 1.0, f);
    
      ret[2] = f;
      return ret;
      //*/
      
      if (1) { //integer version
        var p = 9;
        var q = 95;//105;
        var w = 254;
        
        var dx = (ix*p - iy*q);
        var dy = (iy*p + ix*q);
        
        dx = (dx % w) / w;
        dy = (dy % w) / w;
        
        dx = dx < 0 ? 1.0 + dx : dx;
        dy = dy < 0 ? 1.0 + dy : dy;
        
        var f = Math.min(dx, dy);
        var fsteps = 255;
        
        f = (~~(f*fsteps))/fsteps;
      } else { //floating point version
        //var th1 = (~~(th1*d))/d;
        var th1 = 150/32; //299/64; //4.675448462499999// 4.474403462499999; //57 / 16;
        var th1 = 72/83;
        //th1 = 4.687508837500001;
        
        var dx = Math.fract(ix*th1 - iy/th1);
        var dy = Math.fract(iy*th1 + ix/th1);
        
        var f = Math.min(dx, dy);
      }
      
      //f = Math.fract(ix*2.430365924999999 + iy*3.242500000000001);
      ret[2] = f;
      
      return ret;
      
      //var r = stepnoise(ix, iy, SLIDERS[4]);
      //ix += r[0]*SLIDERS[2];
      //iy += r[1]*SLIDERS[2];
      
      var f1 = tent(ix*SLIDERS[0] + iy/(SLIDERS[0]+0.5));
      var f2 = tent(iy*SLIDERS[1] + ix/(SLIDERS[1]+0.5));
      
      var f = 1.0 - f1*f2;
      //f = f*f*1.0 + f*0.2;
      
      f = f*f*f*f*f*0.75 + f*f*0.2 + f*0.1;
      var d = 255;
      f = (~~(f*d))/d;
      
      ret[0] = 0;
      ret[1] = 0;
      ret[2] = f;
      
      return ret;
    }
  ]);
  
  return exports;
});
