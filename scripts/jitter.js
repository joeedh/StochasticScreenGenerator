var _jitter = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree"
], function(util, cconst, sinterface, vectormath, kdtree) {
  'use strict';
  
  var exports = _jitter = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var JitterGenerator = exports.JitterGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this.report("NOTE: Noise is applied within hiearchial levels");
      this.report("  (click \"Show Mask\")")
    },
    
    function reset(dimen, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.dimen = dimen;
      
      this.points = [];
      
      this.hsteps = HIEARCHIAL_LEVELS;
      this.hscale = HIEARCHIAL_SCALE;
      this.hlvl = 0;
      
      var size = ~~(dimen/this.hscale+0.501);
      var rmul = Math.pow(this.hscale, 1.0/this.hsteps);
      
      var ps = this.points;
      this.r = 0.5 / dimen;
      
      var msize = mask_image.width;
      
      var si = 0;
      size = dimen;
      
      function random() {
        var f = Math.random();
        
        return f;
      }
      
      if (1) { //for (var si=0; si<this.hsteps; si++) {
        size = ~~(dimen/Math.pow(rmul, si)+0.501);
        var r = 0.5 / size;
        
        for (var ix=0; ix<size; ix++) {
          for (var iy=0; iy<size; iy++) {
            var x = 0.5/size + ix/size, y = 0.25/size + iy/size;
            
            if (ix & 1) {
              y += 0.5/size;
            }
            
            var pi = ps.length;
            
            for (var i=0; i<PTOT; i++) {
              ps.push(0);
            }
            
            var fac = 0.001/size;
            
            x += (Math.random()-0.5)*fac;
            y += (Math.random()-0.5)*fac;
            
            x = Math.fract(x);
            y = Math.fract(y);
            
            ps[pi] = x;
            ps[pi+1] = y;
            
            ps[pi+PIX] = ~~(x*msize+0.001);
            ps[pi+PIY] = ~~(y*msize+0.001);
            
            var lvl = this.hsteps - si - 1;
            
            lvl = lvl / this.hsteps;
            lvl = Math.pow(lvl, 4.0);
            lvl = ~~(lvl * this.hsteps);
            
            lvl = ~~(random()*this.hsteps*0.9999999);
            
            ps[pi+PR] = r;
            ps[pi+PGEN] = 1;//lvl;
            
            this.kdtree.insert(x, y, pi/PTOT);
          }
        }
      }
      
      this.raster();
    },
    
    function step() {
      this.report("points:", this.points.length/PTOT);
      
      var rmul = Math.pow(this.hscale, 1.0 / this.hsteps);
      var lvltots = new Float64Array(this.hsteps);
      var rs = [];
      var r = this.r * this.hscale;
      
      var t = 0, dt = 1.0 / (this.hsteps==0 ? 1 : this.hsteps-1);
      var start = this.r*this.hscale, end = this.r;
      
      for (var i=0; i<this.hsteps; i++, t += dt) {
        var t2 = RADIUS_CURVE.evaluate(t);
        
        r = start*(1.0-t2) + end*t2;
        rs.push(r);
      }
      
      var ps = this.points;
      var plen = this.points.length/PTOT;
      var ltot2 = [];
      
      for (var _i=0; _i<this.points.length; _i += PTOT) {
        var i = (~~(Math.random()*0.9999*plen))*PTOT;
        i=_i;
        
        var x = ps[i], y = ps[i+1], lvl = ps[i+2];
        var r1 = rs[lvl];
        
        lvltots.fill(0, 0, lvltots.length);
        var sumw = 0, sumtot = 0;
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, 1.5*this.r*this.hscale, function(pi) {
            var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1], lvl2=ps[pi*PTOT+PGEN];
            var r2 = rs[lvl2];
            
            if (pi == i/PTOT) return;
            
            var d = (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1);

            if (d < r2*r2) {
              var w = d != 0 ? Math.sqrt(d) : 0.0;
              w = 1.0 - w/r2;
              
              w = w*w*(3.0 - 2.0*w);
              w *= w;
              
              sumw += w;
              sumtot += 1;
              
              lvltots[lvl2] += lvl2+1//r2;
            }
          });
        }
        
        if (sumtot > 0) {
          sumw /= sumtot;
        }
        
        var lvl;
        
        //*
        var lvl=undefined, minlvl=1e17;
        
        for (var j=0; j<lvltots.length; j++) {
          if (lvltots[j] < minlvl) {
            lvl = j;
            minlvl = lvltots[j];
          }
        }
        
        ltot2.length = 0;
        
        for (var j=0; j<lvltots.length; j++) {
          if (lvltots[j] == minlvl) {
            ltot2.push(j);
          }
        }
        
        if (ltot2.length > 0) {
          lvl = ltot2[~~(Math.random()*ltot2.length*0.99999)];
        }
        
        if (lvl == undefined || isNaN(lvl)) {
          throw new Error()
        }//*/

        ps[i+PGEN] = lvl;
      }
    
      var plen = this.points.length/PTOT;
      var index = [];
      
      for (var i=0; i<plen; i++) {
        index.push(i);
      }
      
      index.sort(function(a, b) {
        return ps[a*PTOT+PGEN] - ps[b*PTOT+PGEN];
      });
      
      var ps2 = [];
      for (var i=0; i<plen; i++) {
        for (var j=0; j<PTOT; j++) {
          ps2[i*PTOT+j] = ps[index[i]*PTOT+j];
        }
      }
      
      this.points = ps2;
      this.regen_spatial();
      
      this.raster();
    },
    
    function max_level() {
      return this.hsteps;
    },
    
    function current_level() {
      return this.hlvl;
    }
  ]);
  
  return exports;
});
