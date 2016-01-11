var _bayer = undefined;

define([
  "util", "interface", "const"
], function(util, sinterface, cconst) {
  'use strict';
  
  var exports = _bayer = {};
  var Class = util.Class;;
  var MaskGenerator = sinterface.MaskGenerator;
  
  window.decompose = function decompose(base, a) {
    var _i=0;
    var n = Math.floor(Math.log(a) / Math.log(2));
    //a = Math.pow(base, n);
    var start = a;
    var bit = [];
    
    while (~~a > 0) {
      if (_i++ > 500) {
        console.log("infinite loop!");
        break;
      }
      
      var ra = a - (~~(a/base))*base;
      
      //console.log(a % base);
      bit.push(a % base);

      a = ~~(a/base);
    }
    
    var sum = 0;
    for (var i=0; i<bit.length; i++) {
      sum += Math.pow(base, i)*bit[i];
    }
    
    //console.log("sum", sum, start);
    return bit;
  }
  window.decompose = decompose;
  
  window.bxor = function bxor(base, a, b) {
    var b1 = decompose(base, a);
    var b2 = decompose(base, b);
    var len = Math.max(b1.length, b2.length);
    
    //console.log(b1, b2);
    
    var sum = 0.0;
    for (var i=0; i<len; i++) {
      var i1 = i >= b1.length ? 0 : b1[i];
      var i2 = i >= b2.length ? 0 : b2[i];
      
      var bool1 = Math.abs(i1) > 0.0001;
      var bool2 = Math.abs(i2) > 0.0001;
      
      if (!bool1 && bool2) {
        sum += Math.pow(base, i)*i2;
      } else if (!bool2 && bool1) {
        sum += Math.pow(base, i)*i1;
      }
    }
    
    //console.log("sum", sum, a ^ b);
    
    return sum;
  }
  window.bxor = bxor;
  
  var BayerGenerator = exports.BayerGenerator = Class(MaskGenerator, [
    function constructor() {
      MaskGenerator.apply(this, arguments);
      
      this.maxgen = 0;
    },
    
    function step() {
    },
    
    function reset(dimen) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.dimen = dimen;
      this.points = [];
      
      var ps = this.points;
      this.r = 1.0 / dimen;
      
      var maxgen = this.maxgen = HIEARCHIAL_LEVELS;
      maxgen=0;
      
      var rndlist = new Int32Array(dimen*dimen);
      for (var i=0; i<dimen*dimen; i++) {
        rndlist[i] = i;
      }
      
      for (var i=0; i<dimen*dimen; i++) {
        var ri = ~~(Math.random()*rndlist.length*0.99999999);
        var t = rndlist[i];
        
        rndlist[i] = rndlist[ri];
        rndlist[ri] = t;
      }      
      
      var r = this.r;
      var msize = this.mask_img.width;

      var grid = new Int32Array(dimen*dimen);
      grid.fill(-1, 0, grid.length);
      
      function addpoint(x, y, gen, r) {
        var pi = ps.length;
        
        var ix = ~~(x*msize*0.999999+0.05);
        var iy = ~~(y*msize*0.999999+0.05);
        var idx = iy*dimen + ix;
        if (grid[idx] >= 0) return;
        
        grid[idx] = pi/PTOT;
        
        for (var j=0; j<PTOT; j++) {
          ps.push(0);
        }
        
        ps[pi] = x;
        ps[pi+1] = y;
        ps[pi+PGEN] = gen;
        ps[pi+PCLR] = 0;
        ps[pi+PR] = r;
        
        ps[pi+PIX] = ix;
        ps[pi+PIY] = iy;
        
        maxgen = Math.max(maxgen, gen+1);
      }
      
      function recurse(minx, miny, maxx, maxy, depth, gen) {
        var pi = ps.length/PTOT;
        
        if (maxx-minx < 1.0/dimen || depth > 29) return;
        
        //gen = Math.max(gen-2, 0);
        
        
        //gen += ~~(Math.random()*16.0);
//        gen = ~~(gen*255);
        
        var cx = (minx + maxx)*0.5;
        var cy = (miny + maxy)*0.5;
        
        var gen2 = Math.max(gen-2, 0);
        //gen2 = Math.pow(gen2, 1.0);
        addpoint(cx, cy, gen2, r);
        
        addpoint(minx, miny, gen, r);
        addpoint(minx, maxy, gen, r);
        addpoint(maxx, maxy, gen, r);
        addpoint(maxx, miny, gen, r);

        recurse(minx, miny, cx, cy, depth+1, gen+1);
        recurse(minx, cy, cx, maxy, depth+1, gen+1);
        recurse(cx, miny, maxx, cy, depth+1, gen+1);
        recurse(cx, cy, maxx, maxy, depth+1, gen+1);
        /*
        var d = 1
        if (depth%2) {
          if (cy > 0.5) {
            recurse(minx, miny, cx, cy, depth+1, gen+2*d);
            recurse(minx, cy, cx, maxy, depth+1, gen+1*d);
            recurse(cx, miny, maxx, cy, depth+1, gen+2*d);
            recurse(cx, cy, maxx, maxy, depth+1, gen+1*d);
          } else {
            recurse(minx, miny, cx, cy, depth+1, gen+1*d);
            recurse(minx, cy, cx, maxy, depth+1, gen+2*d);
            recurse(cx, miny, maxx, cy, depth+1, gen+1*d);
            recurse(cx, cy, maxx, maxy, depth+1, gen+2*d);
          }
        } else {
          if (cx > 0.5) {
            recurse(minx, miny, cx, cy, depth+1, gen+2*d);
            recurse(minx, cy, cx, maxy, depth+1, gen+2*d);
            recurse(cx, miny, maxx, cy, depth+1, gen+1*d);
            recurse(cx, cy, maxx, maxy, depth+1, gen+1*d);
          } else {
            recurse(minx, miny, cx, cy, depth+1, gen+1*d);
            recurse(minx, cy, cx, maxy, depth+1, gen+1*d);
            recurse(cx, miny, maxx, cy, depth+1, gen+2*d);
            recurse(cx, cy, maxx, maxy, depth+1, gen+2*d);
          }
        }*/         
      }
      
      /*
      recurse(0, 0, 1, 1, 0, 0);
      this.maxgen = maxgen;

      this.regen_spatial();
      this.raster();
      console.log("points", this.points.length/PTOT);

      return;
      //*/
      
      for (var i=0; i<dimen*dimen; i++) {
        var ix = i % dimen, iy = ~~(i / dimen);
        
        var x = (ix+0.49)/dimen, y = (iy+0.49)/dimen;
        
        var pi = ps.length;
        
        for (var j=0; j<PTOT; j++) {
          ps.push(0);
        }
        
        var gen;
        
        gen = ~~(maxgen*Math.random()*0.99999);
        gen = ~~(Math.log(ix*4) / Math.log(2.0));
        gen = pi;
        
        var a = iy
        var b = ix ^ iy;
        var m = Math.ceil(Math.max(Math.log2(a), Math.log2(b)))+1;
        var v = 0;
        
        //m = ~~(m/2);
        var bit = 0;
        
        for (var j=0; j<m; j++) {
          var a2 = a && (1<<j);
          var b2 = b && (1<<j);
          
          v |= (1<<bit++) * (a2 != 0);
          v |= (1<<bit++) * (b2 != 0);
        }
        
        //if (ix % 2 == 0) {
        //  iy += Math.sign(Math.random()-0.5)//*(Math.random() > 0.5 ? 2 : 1);
        //} else {
         // ix += Math.sign(Math.random()-0.5)//*(Math.random() > 0.5 ? 2 : 1);
        //}
        
        var M = 10;
        var v = 0, mask = M-1, xc = ix ^ iy, yc = ix % 2 ? iy : ix;
        for(var bit=0; bit < 2*M; --mask)
        {
            v |= ((yc >> mask)&1) << bit++;
            v |= ((xc >> mask)&1) << bit++;
        }
        
        gen = v/(1<<((M+1)*2));
        //*/
        
        //gen = Math.fract(x*HIEARCHIAL_SCALE)*Math.fract(y*HIEARCHIAL_SCALE);
        
        //gen = Math.log(ix) / Math.log(dimen*HIEARCHIAL_SCALE);
        
        gen = ~~(gen*255 + Math.random()*25*0);
        
        //gen = rndlist[i];
        //gen = ~~(Math.random()*dimen*dimen*0.999999);
        
        //gen = Math.fract(x*15.0)*Math.fract(y*15)*maxgen;
        maxgen = Math.max(maxgen, gen+1);
        
        ps[pi] = x;
        ps[pi+1] = y;
        ps[pi+PGEN] = gen;
        ps[pi+PCLR] = 0;
        ps[pi+PR] = this.r;
      }
      
      var min=Math.min, abs=Math.abs;
      
      function dist(x1, y1, x2, y2) {
        var xmin = min(abs(x1-x2), dimen-abs(x1-x2));
        var ymin = min(abs(y1-y2), dimen-abs(y1-y2));
        
        return Math.min(xmin, ymin);
      }
      
      this.maxgen = maxgen;
      
      this.regen_spatial();
      this.raster();
      console.log("points", this.points.length/PTOT);
    },
    
    function max_level() {
      return this.maxgen;
    },
    
    function current_level() {
      return 0;
    }
  ]);
  
  return exports;
});
