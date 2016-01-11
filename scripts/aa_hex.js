/*new aa funcs based on hexoganal grids */

var _aa_hex = undefined;
define([
  "util", "aa_types"
], function(util, aa_types) {
  'use strict';
  var exports = _aa_hex = {};
  
  var cachering = util.cachering;
  
  var xy2hex_tmp = new cachering(function() {
    return [0, 0, 0];
  }, 64);
  var xy2hex_ret = new cachering(function() {
    return [0, 0, 0];
  }, 512);
  var hex2xy_ret = new cachering(function() {
    return [0, 0, 0];
  }, 512);
  
  var _sqrt_2 = Math.sqrt(2);
  var _sqrt_3 = Math.sqrt(3);

  var dxdy_ret = new cachering(function() {
    return [0, 0, 0];
  }, 2048);
  var dxdy_tmp = new cachering(function() {
    return [0, 0];
  }, 64);
  
  function hex2xy(x, y, size) {
    var ret = hex2xy_ret.next();
    
    hex2xy_intern(ret, x, y, size);
    return ret;
  }

  function hex2xy_intern(out, x, y, size) {
    var r = (_sqrt_3/3.0) / size;
    var ix = x*size+0.00001;
    var iy = y*size+0.00001;
    
    if ((Math.floor(ix)) & 1) {
      iy += 0.5;
    }
    
    ix *= _sqrt_3*0.5;
    
    out[0] = ix/size;
    out[1] = iy/size;
    out[2] = r;
  }

  function xy2hex(x, y, size, r) {
    var ret = hex2xy_ret.next();
    
    if (r == undefined) {
      r = (_sqrt_3/3.0) / size;
    }
    
    var ix = x*size+0.00001;
    var iy = y*size+0.00001;
    
    ix /= _sqrt_3*0.5;
    
    if ((Math.floor(ix+0.00001)) & 1) {
      iy -= 0.5;
    }
    
    var h = xy2hex_tmp.next();
    h[0] = h[1] = 0;
    
    /*
    var oks = [];
    var d = 1;
    for (var i=-d; i<=d; i++) {
      for (var j=-d; j<=d; j++) {
        var ix1 = Math.floor(ix + i);
        var iy1 = Math.floor(iy + j);
        
        hex2xy_intern(h, ix1/size, iy1/size, size);
        
        //console.log(x.toFixed(3), y.toFixed(3), h[0].toFixed(3), h[1].toFixed(3), h[2].toFixed(3))
        
        //console.log(h, x, y)
        if (point_in_hex(x, y, h[0], h[1], h[2])) {
          ret[0] = (ix1 + Math.fract(ix))/size;
          ret[1] = (iy1 + Math.fract(iy))/size;
          ret[2] = r;
          return ret;
          
          oks.push(i);
          oks.push(j);
          oks.push(" ");
        }
      }
    }
    
    if (oks.length > 0) {
      console.log("yay", oks);
    } else {
      //console.log(ix, iy, r, " ", h[0], h[1], h[2]);
      throw new Error();
    }
    //*/
    
    ret[0] = ix/size;
    ret[1] = iy/size;
    ret[2] = r;
    
    return ret;
  }

  var hexvert_ret = new cachering(function() {
    return [0, 0];
  }, 64);

  function hexvert_intern(x, y, idx, r) {
    var thoff = Math.PI*0.5;

    var th = -Math.PI + thoff, dth = (Math.PI*2.0)/6;
    
    th += dth*idx;
    var ret = hexvert_ret.next();
    
    ret[0] = Math.sin(th)*r + x;
    ret[1] = Math.cos(th)*r + y;
    
    return ret;
  }

  function hexvert(x, y, idx, size) {
    var r = (_sqrt_3/3.0) / size;

    return hexvert_intern(x, y, idx, r);
  }

  //safe arc cosine
  function saacos(dot) {
    dot = Math.min(Math.max(dot, -1.0), 1.0);
    return Math.acos(dot);
  }

  function dot2(v2a, v2b) {
    return v2a[0]*v2b[0] + v2a[1]*v2b[1];
  }

  function normalize2(v2) {
    var l = v2[0]*v2[0] + v2[1]*v2[1];
    
    if (l > 0) {
      l = Math.sqrt(l);
      
      v2[0] /= l;
      v2[1] /= l;
    }
    
    return v2;
  }

  var rot2_rets = new cachering(function() {
    return [0, 0];
  }, 64);

  function rot2(v2, th) {
    var x = Math.cos(th)*v2[0] - Math.sin(th)*v2[1];
    var y = Math.cos(th)*v2[1] + Math.sin(th)*v2[0];
    
    var ret = rot2_rets.next();
    
    ret[0] = x;
    ret[1] = y;
    
    return ret;
  }

  function get_hotspot(x, y, size, limit) {
      var hv1 = hexvert(x, y, 0, size);
      var hv2 = hexvert(x, y, 3, size);
      
      var t = limit*0.5;
      x = hv1[0] + (hv2[0] - hv1[0])*t;
      y = hv1[1] + (hv2[1] - hv1[1])*t;
      
      var r = limit * (_sqrt_3/3.0) / size;
      return [x, y, r];
  }

  function point_in_hex(px, py, hx, hy, r) {
    var size = (_sqrt_3/3.0)/r;
    var sum = 0.0;
    
    r *= 2.0;
    for (var i=0; i<6; i++) {
      var v1 = hexvert_intern(hx, hy, i, r);
      var v2 = hexvert_intern(hx, hy, (i+1)%6, r);
      
      v1[0] -= px, v1[1] -= py;
      v2[0] -= px, v2[1] -= py;
      
      normalize2(v1);
      normalize2(v2);
      
      var ang = saacos(dot2(v1, v2));
      sum += ang;
    }
    
    //console.log("-", sum.toFixed(5), px, py, hx, hy);
    return Math.abs(sum - Math.PI*2.0) < 0.01;
  }

  var HexGen = exports.HexGen = util.Class(aa_types.AAGen, [
    function dxdy(ix, iy, size, seed, limit) {
      limit = limit == undefined ? 0.9 : limit;
      
      var x = ix/size, y = iy/size, th = seed;
      
      limit *= 1.25;
      var dd = 0.045
      
      var tx = Math.tent(x*size*(15233+dd));
      var ty = Math.tent(y*size*(15233+dd));
      
      var v = dxdy_tmp.next();
      v = hex2xy(x, y, size);
      
      var v2 = rot2(v, -th);
      var h = xy2hex(v2[0]+0.5/size, v2[1]+0.5/size, size);

      var h2 = dxdy_tmp.next();
      var tmp = dxdy_tmp.next();
      h2[0] = (Math.floor(h[0]*size+0.00001))/size;
      h2[1] = (Math.floor(h[1]*size+0.00001))/size;
      
      h2 = hex2xy(h2[0], h2[1], size);
      var x = h2[0], y = h2[1];
      
      var w = 0.01;
      
      h = hex2xy(h[0], h[1]);
      var v3 = rot2(h, 0);
      
      tmp[0] = x;
      tmp[1] = y;
      var xy2 = rot2(tmp, th);
      
      //1.6493361431346414 
      //limit 0.921
      var trfac = Math.min(tx, ty); //tx*tx + ty*ty;
      trfac = trfac*0.5 + 0.5;
      
      var r = trfac*(_sqrt_3/3.0) / size;
      
      var hs = get_hotspot(x, y, size, limit);
      
      var v4 = hexvert_intern(v[0], v[1], 0, r);
      var v4 = rot2(v4, -th);
      
      var inside = point_in_hex(v4[0], v4[1], hs[0], hs[1], hs[2]);
      
      //1.478
      
      //0.529986
      //limit 1.4
      if (inside) {
        var r = (_sqrt_3/3.0) / size;
        var hv = hexvert_intern(hs[0], hs[1], 1, hs[2]);
        
        var dx = v4[0]-hv[0], dy = v4[1]-hv[1];
        var f = dx*dx + dy*dy;
        
        f = f != 0.0 ? Math.sqrt(f) : 0.0;
        f = f / (1.25*hs[2]);
        
        f = Math.min(Math.max(f, 0.0), 1.0);
        f = 1.0 - f;

        var ret = dxdy_ret.next();
        ret[0] = dx;
        ret[1] = dy;
        ret[2] = f;
        
        return ret;
      }
    }
  ]);
  
  var olddxdy = exports.olddxdy = function olddxdy(x, y, size, limit) {
    /*create a localized distortion.
      we could use perlin noise, but that would be
      far too computationally expensive.*/
    
    var t = Math.tent(x*size*13.234325);
    
    x += t;
    y += t;
    
    var v = dxdy_tmp.next();
    v = hex2xy(x, y, size);
        
    var w = 0.02;
    
    var v2 = rot2(v, -AA_SEED);
    var h = xy2hex(v2[0]+0.5/size, v2[1]+0.5/size, size);

    var h2 = dxdy_tmp.next();
    var tmp = dxdy_tmp.next();
    h2[0] = (Math.floor(h[0]*size+0.00001))/size;
    h2[1] = (Math.floor(h[1]*size+0.00001))/size;
    
    h2 = hex2xy(h2[0], h2[1], size);
    var x = h2[0], y = h2[1];
    
    w = 0.01;
    
    h = hex2xy(h[0], h[1], size);
    var v3 = rot2(h, 0);
    
    tmp[0] = x;
    tmp[1] = y;
    var xy2 = rot2(tmp, AA_SEED);
    
    //g.rect(v3[0]-w*0.5, v3[1]-w*0.5, w, w);
    
    var r = (_sqrt_3/3.0) / size;
    var hs = get_hotspot(x, y, size, limit);
    
    var v4 = rot2(v, -AA_SEED);
    var inside = point_in_hex(v4[0], v4[1], hs[0], hs[1], hs[2]);

    if (inside) {
      var r = (_sqrt_3/3.0) / size;
      
      var hv = hexvert_intern(hs[0], hs[1], 1, hs[2]);
      
      var dx = v4[0]-hv[0], dy = v4[1]-hv[1];
      var f = dx*dx + dy*dy;
      
      f = f != 0.0 ? Math.sqrt(f) : 0.0;
      f = f / (2*hs[2]);
      
      f = Math.min(Math.max(f, 0.0), 1.0);
      f = 1.0 - f;

      var ret = dxdy_ret.next();

      ret[0] = dx;
      ret[1] = dy;
      ret[2] = f;

      return ret;
    } else {
      return undefined;
      /*
      var ret = dxdy_ret.next();

      ret[0] = limit*2+1;
      ret[1] = limit*2+1;
      ret[2] = 0.0;
      
      return ret;
      //*/
    }
  }
  
  return exports;
});
