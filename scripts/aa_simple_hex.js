var _aa_simple_hex = undefined;

define([
  "util", "const", "aa_types"
], function(util, cconst, aa_types) 
{
  'use strict';

  var exports = _aa_simple_hex = {};
  var Class = util.Class;
  
  var dxdy_rets = new util.cachering(function() {
    return [0, 0, 0];
  }, 512);

  var SimpleHexGen = exports.SimpleHexGen = Class(aa_types.AAGen, [
    function dxdy(ix, iy, size, seed) {
      var th = seed;
      
      var ret = dxdy_rets.next();
      
      if ((~~ix) & 1) {
        iy += 0.5;
      }
      
      var x = Math.cos(th)*ix - Math.sin(th)*iy + ix*0.001;
      var y = Math.cos(th)*iy + Math.sin(th)*ix + iy*0.001;
      
      if ((~~x) & 1) {
        y += 0.5;
      }
      
      var dx = Math.fract(x), dy = Math.fract(y);
      ret[0] = dx;
      ret[1] = dy;
      
      var f = dx*dx*0.5 + dy*dy*0.5 + dx*dy;// + dx*dy)/3.0;
      
      //f = Math.max(1.0 - f*0.7, 0.0);
      //ret[2] = f*f*0.8;
      
      
      ret[2] = f*0.5;
      
      //if (Math.random() > 0.9999) {
      //  console.log(f, th);
      //  console.log("th", p, q, th, ret, f);
      //}
      
      return ret;
    }
  ]);
  
  return exports;
});
