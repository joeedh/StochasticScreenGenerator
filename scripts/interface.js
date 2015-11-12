var _interface = undefined;

define([
  "util", "const", "kdtree", "report"
], function(util, cconst, kdtree, reportfunc) {
  'use strict';
  
  var exports = _interface = {};
  var Class = util.Class;
  
  var MaskGenerator = exports.MaskGenerator = Class([
    function constructor(appstate) {
      this.appstate = appstate;
      this.colors = CMYK;
      
      this.points = [];
      this.kdtree = new kdtree.KDTree();
    },
    
    //console.log-style function, but without text coloring or anything like that
    function report() {
      console.log.apply(console, arguments);
      reportfunc.apply(window, arguments);
    },
    
    function calc_avg_dis() {
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 5.0;
      
      var avgdis=0.0, tot=0.0;
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r = ps[i+PR];
        var gen1 = ps[i+PGEN];
        
        var searchrad = r*searchfac;
        
        this.kdtree.forEachPoint(x, y, searchrad, function(pi) {
          var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1], r2=ps[pi*PTOT+PR];
          var gen2 = ps[pi*PTOT+PGEN];
          
          if (pi == i/PTOT) {
            return;
          }
          
          var dx = x-x2, dy = y-y2;
          
          var dis = dx*dx + dy*dy;
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          
          avgdis += dis;
          tot++;
        }, this);
      }
      
      if (tot)
        avgdis /= tot;
      
      return avgdis;
    },
    
    function relax(use_avg_dis) {
      use_avg_dis = use_avg_dis == undefined ? false : use_avg_dis;
      
      console.log("warning, default implementation");
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 5.0;
      var msize = this.mask_img.width;
      var r = this.r;
      
      if (use_avg_dis) {
        r = this.calc_avg_dis();
      }
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR];
        var gen1 = ps[i+PGEN];
        
        if (use_avg_dis)
          r1 = r;
        
        var searchrad = r1*searchfac;
        var sumtot=1, sumx=x, sumy=y;
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, searchrad, function(pi) {
            var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1], r2=ps[pi*PTOT+PR];
            var gen2 = ps[pi*PTOT+PGEN];
            
            x2 -= _poffs[j][0];
            y2 -= _poffs[j][1];
            
            if (use_avg_dis)
              r2 = r;
            
            if (pi == i/PTOT) {
              return;
            }
            
            if (gen1 < gen2) {
              //return;
            }
            
            var dx = x2-x, dy = y2-y;
            var dis = dx*dx + dy*dy;
            
            if (dis == 0 || dis > searchrad*searchrad) {
              return;
            }
            
            dis = Math.sqrt(dis);
            var r3 = Math.max(r2, r1);
            
            var w = 1.0 - dis/searchrad;
            w = w*w;
            
            var fac = 0.00001;
            
            dx /= dis;
            dy /= dis;
            
            var fx = x - dx*r3;
            var fy = y - dy*r3;
            
            sumx += w*fx;
            sumy += w*fy;
            sumtot += w;
          }, this);
        }
        
        sumx /= sumtot;
        sumy /= sumtot;
        ps[i] = sumx;
        ps[i+1] = sumy;
          
        ps[i] = Math.fract(ps[i]);
        ps[i+1] = Math.fract(ps[i+1]);
        //ps[i] = Math.min(Math.max(ps[i], 0), 1);
        //ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        ps[i+PIX] = ~~(ps[i]*msize+0.0001);
        ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
      }
        
      this.regen_spatial();
      this.raster();
    },
    
    function sort() {
      var plen = this.points.length/PTOT;
      var index = [];
      var ps = this.points;
      
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
    },
    
    function is_done() {
      return false;
    },
    
    function step(custom_steps) {
    },
    
    function current_level() {
      throw new Error("current_level(): implement me!");
    },
    
    function max_level() {
      throw new Error("max_level(): implement me!");
    },    
        
    function regen_kdtree() {
      console.log("regenerating kdtree...");
      this.kdtree = new kdtree.KDTree();
      
      var start = util.time_ms();
      
      for (var i=0; i<this.points.length/PTOT; i++) {
        this.kdtree.insert(this.points[i*PTOT], this.points[i*PTOT+1], i);
      }
      
      var time = util.time_ms() - start;
      
      console.log("done", time.toFixed(2) + "ms");
    },

    function reset(size, appstate, mask_image) {
      this.appstate = appstate;
      
      this.mask_img = mask_image;
      this.mask = mask_image.data;
      
      var iview = new Int32Array(this.mask.buffer);
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = 255;
      iview.fill(iview[0], 0, iview.length);
      
      this.points = [];
      this.kdtree = new kdtree.KDTree();
    },
    
    Class.static(function destroy_all_settings() {
    }),
    
    function draw(g) {
    },
    
    //optional
    function next_level() {
    },
    
    function raster_point(pi) {
      var mask = this.mask, ps = this.points, msize = this.mask_img.width
      
      var x = ps[pi*PTOT], y = ps[pi*PTOT+1], gen=ps[pi*PTOT+PGEN];
      var color = ps[pi*PTOT+PCLR];
      
      if (gen < 0) return; //skip point
      
      if (Math.random() > 0.99) {
        console.trace(gen, this.max_level(), this.maxgen)
      }
      var d = 1.0 - gen/this.max_level();

      //XXX
      //d = 1.0 - (pi*PTOT) / this.points.length;
      
      if (TONE_CURVE != undefined) {
        d = 1.0 - TONE_CURVE.evaluate(1.0-d);
      }
      
      if (d < 0 || d > 1.0 || isNaN(d)) {
        throw new Error("eek! " + d);
      }
      
      var ix = ps[pi*PTOT+PIX], iy = ps[pi*PTOT+PIY];
      if (ix < 0) return; //dropped point
      
      ix = Math.min(Math.max(ix, 0), msize-1);
      iy = Math.min(Math.max(iy, 0), msize-1);
      
      var idx = (iy*msize+ix)*4;
      if (!ALLOW_OVERDRAW && mask[idx] != 0) return;
      
      if (GEN_CMYK_MASK) {
        var r = ~~(d*CMYK[color&3][0]*255);
        var g = ~~(d*CMYK[color&3][1]*255);
        var b = ~~(d*CMYK[color&3][2]*255);
        
        mask[idx] = r;
        mask[idx+1] = g;
        mask[idx+2] = b;
      } else {
        mask[idx] = mask[idx+1] = mask[idx+2] = ~~(d*255);
      }
      
      mask[idx+3] = 255;
    },
    
    function raster() {
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = 255;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = ~~(this.points.length/PTOT);
      
      for (var i=0; i<plen; i++) {
        this.raster_point(i);
      }
    },

    function toggle_timer_loop(appstate, simple_mode) {
        if (appstate.timer != undefined) {
          window.clearInterval(appstate.timer);
          appstate.timer = undefined;
          return;
        } 
        
        var this2 = this;
        var start = util.time_ms();
        var lasttot = 0;
        var totsame = 0;
        
        appstate.timer = window.setInterval(function() {
          if (util.time_ms() - start < 80) {
            return;
          }
          
          if (simple_mode) {
            var start2 = util.time_ms();
            var report = 0;
            
            while (util.time_ms() - start2 < 700) {
              appstate.step(undefined, report++);
            }
          }
          
          if (simple_mode||totsame == QUALITY_STEPS) {
            if (appstate.generator.current_level() >= appstate.generator.max_level()) {
              this2.report("  Finished job");
              
              window.clearInterval(appstate.timer);
              appstate.timer = undefined;
            }
            
            appstate.next_level();
            totsame = 0;
          }
          
          var start2 = util.time_ms();
          var report = 0;
          
          //while (util.time_ms() - start2 < 700) {
            appstate.step(undefined, report++);
          //}
          
          if (appstate.generator.points.length == lasttot) {
            totsame++;
          } else {
            totsame = 0;
          }
          
          this2.report("same: ", totsame);
          
          lasttot = appstate.generator.points.length;
          redraw_all();
          
          start = util.time_ms();
        }, 100);
    },
    
    function regen_spatial() {
      this.kdtree = new kdtree.KDTree();
      var ps = this.points;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        this.kdtree.insert(x, y, i/PTOT);
      }
    }
  ]);
  
  return exports;
});
