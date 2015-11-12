var _sph = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree"
], function(util, cconst, sinterface, vectormath, kdtree) {
  'use strict';
  
  var exports = _sph = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var Modes = exports.Modes = {
    SHUFFLE  : 0,
    CONVERGE : 1
  };
  
  //I so hate this crap of putting fine-grained objects in flat 
  //Float64Array's
  var GFILLED=0, GIDX = 1, GTOT=2;
  
  var SPHGenerator = exports.SPHGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this._ki = 0;
      
      this.speedmul = 1.0;
      this.mode = Modes.SHUFFLE;
      
      this.mpos = new Vector2();
      
      this.search_rmul = 3.0;
      this.base = 1.00012;
      this.maxgen = HIEARCHIAL_LEVELS;
      
      this.points = [];
    },
    
    function max_level() {
      return this.maxgen;
    },
    
    function pthrow(steps) {
        //steps = steps == undefined ? 0.4*DIMEN*DIMEN : steps;
        steps = steps == undefined ? 110 : steps;
        var size=this.gridsize, grid=this.grid;
            
        for (var si=0; si<steps; si++) {
            var x, y;
            
            var size2 = size/2;
            var i1 = ~~(Math.random()*size2*size2)
            
            var x = (i1 % size2) / size2;
            var y = i1 / (size2*size2);
            
            //x += Math.random()/size;
            //y += Math.random()/size;
            
            var ix = ~~(x*size), iy = ~~(y*size);
            
            if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
                continue;
            }
            
            var idx = (iy*size+ix)*GTOT;
            
            if (grid[idx+GFILLED]==1) {
                continue;
            }
            
            var pi = this.points.length/PTOT;
            
            grid[idx+GFILLED] = 1;
            grid[idx+GIDX] = pi;
            
            this.points.push(x);
            this.points.push(y);
            this.points.push(this.r);
            
            for (var i=3; i<PTOT; i++) {
                this.points.push(0);
            }
            
            var plen = this.points.length/PTOT;
            var gen=0;
            
            //if (plen > 205)
            //  gen = ~~(Math.log(plen-205) / Math.log(base));
            
            gen = plen;
            
            if (isNaN(gen) || gen == Infinity || gen == -Infinity) gen = 0;
            
            this.points[pi*PTOT+PGEN] = gen;
            this.max_ni = gen;
        }
        
        var maxgen = this.maxgen;
        var final_scale = HIEARCHIAL_SCALE;
        var final_r = this.r*final_scale;
        
        var d = 1.0 / (final_r*Math.sqrt(2.0));
        
        var ci = 0;
        var lvl = 0;
        
        var off = Math.ceil(d*d*Math.sqrt(2.0));
        console.log("OFF", off);
        
        var base  = Math.pow(final_scale, 1.0/this.points.length);
        var mulbase = 1.0/base;

        var base2 = Math.pow(final_scale, 1.0/maxgen);

        var rmul=final_scale;
        
        var ps = this.points;
        for (var i=0; i<ps.length; i += PTOT) {
            var gen = ps[i+PGEN]/this.max_ni;
            
            //gen = Math.pow(gen, 1.1);
            //gen = 1.0 - (Math.pow(0.25, maxgen*gen));
            
            //var t = 1.0 - gen;
            
            //gen = 1.0 - Math.pow(1.0 - gen, 1.0);
            //gen = gen != 0.0 ? Math.log((i+off)/PTOT) / Math.log(1.1) : 0.0;
            gen = (i+1)/ps.length;
            
            //gen = Math.pow(gen, 1.0/maxgen)*maxgen;
            gen = Math.log(i/maxgen) / Math.log(base2);
            gen = Math.floor(gen);
            
            if (ci > off) {
              var d = 1.0 / (this.r*rmul*Math.sqrt(2.0));
              
              off = Math.ceil(d*d);
              //console.log("OFF", off);
              
              rmul /= base2;
              
              lvl++;
              ci = 0;
            }
            
            ci++;
            gen = lvl;
            //gen /= Math.log(ps.length/PTOT) / Math.log(1.0/base);
            
            //gen = Math.pow(base2, gen);
            
            
            //gen = (~~(gen*maxgen))/maxgen;
            
            ps[i+PR2] = ps[i+PR]*rmul // + (final_r - ps[i+PR])*(1.0 - gen) ;
            ps[i+PGEN] = ~~(gen);
            
            this.kdtree.insert(ps[i], ps[i+1], i/PTOT);
        }
        
        window._max_gen = ci;
        
        this.max_ni = this.ni = maxgen;
    },
    
    //custom_steps, noreport are ignored for now
    function step(custom_steps, noreport) {
      //if (this._ki++ % 5 == 0) {
        this.regen_kdtree();
      //}
      
      if (GEN_MASK) {
        this.step_b();
        //this.mode ^= 1;
        
        //this.step_b();
        //this.mode ^= 1;
      } else {
        this.step_b();
      }
    },

    function step_b() {
        var ps = this.points, grid = this.grid;
        var size = this.gridsize, plen=this.points.length;
        var rmul = 4.0;
        
        //closure communication vars
        var sumd, sumw, sumtot, dx1, dy1, i;
        var gen, r, rr;
        var minangle = Math.PI, maxangle = -Math.PI;
        var clrtots = [0, 0, 0, 0];
        var final_r = this.final_r;
        
        function pointcallback(pi) {
          if (pi*PTOT == i) return;
          if (ps[pi*PTOT+PR] < 0) return;
          if (pi < 0) return;
          
          var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1];
          var r2 = ps[pi*PTOT+PR], gen2=ps[pi*PTOT+PGEN];
          var rr2 = ps[pi*PTOT+PR2];
          var color2 = ps[pi*PTOT+PCLR];
          
          if (GEN_MASK && this.mode == Modes.SHUFFLE && gen2 > gen) {
            return;
          }
          
          var r3 = Math.max(r, r2);
          
          if (gen2 == gen) {
            r3 = Math.max(rr, rr2);
          }
          
          x2 -= _poffs[sj][0];
          y2 -= _poffs[sj][1];
          
          var ang = Math.atan2(x2, y2);
          minangle = Math.min(minangle, ang);
          maxangle = Math.max(maxangle, ang);
          
          var dx = x2-x, dy = y2-y;
          var dis = dx*dx + dy*dy;
          
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          if (dis < r3) { //(gen2 > gen && dis < final_r) || (gen2 <= gen && dis < r3)) {
            clrtots[color2]++;
          }
          
          if (dis > r3*rmul || dis == 0.0) {
            return;
          }
          
          dx /= dis;
          dy /= dis;
          
          var x3 = x2;//x - dx*r3*3;
          var y3 = y2;//y - dy*r3*3;
          
          var w = dis/(r3*rmul);
          w = 1.0 - w;
          
          if (window.SPH_CURVE != undefined) {
            w = window.SPH_CURVE.evaluate(w);
          } else {
            w *= w;
          }
          
          //var d1 = ps[pi*PTOT+PD];
          //d1 *= 0.1+Math.sin((x2*x2 + y2*y2)*5)*0.5 +0.5;
          //w *= 1.0+55*d1;
          
          var d = gen2/this2.max_ni;
          
          dx1 += dx*w;
          dy1 += dy*w;
          
          sumd += ps[pi*PTOT+PD];
          sumw += w;
          
          sumtot++;
        }
        
        for (var i=0; i<ps.length; i += PTOT) {
          var x = ps[i], y = ps[i+1], r = ps[i+PR];
          var gen = ps[i+PGEN], rr = ps[i+PR2];
          
          if (r < 0) continue; //dead point check
          
          //var gridi = this.get_grid(rr);
          //grid = this.grids[gridi];
          //size = this.gridsizes[gridi];
          //var rd = ~~Math.ceil(rmul*size*Math.sqrt(2.0)*rr);
          //var ix = x*size, iy = y*size;
          
          minangle = Math.PI, maxangle = -Math.PI;
          var sumw = 0;
          var sumtot=0;
          var dx1=0, dy1=0;
          var sumd = 0.0;
          var this2 = this;
          
          if (!GEN_MASK)
            rr = this.r;
          
          clrtots[0] = clrtots[1] = clrtots[2] = clrtots[3] = 0.0;
          
          for (var sj=0; sj<_poffs.length; sj++) {
            if (!TILABLE && sj > 0) break;
            
            var x1 = x + _poffs[sj][0];
            var y1 = y + _poffs[sj][1];
            //var ix1 = x1*size, iy1 = y1*size;
             
            this.kdtree.forEachPoint(x1, y1, rr*rmul, pointcallback, this);
          }
          
          var color;
          
          if (clrtots[0] < clrtots[1] && clrtots[0] < clrtots[2] && clrtots[0] < clrtots[3])
            color = 0;
          else if (clrtots[1] < clrtots[0] && clrtots[1] < clrtots[2] && clrtots[1] < clrtots[3])
            color = 1;
          else if (clrtots[2] < clrtots[1] && clrtots[2] < clrtots[0] && clrtots[2] < clrtots[3])
            color = 2;
          else if (clrtots[3] < clrtots[1] && clrtots[3] < clrtots[2] && clrtots[3] < clrtots[0])
            color = 3;
          else
            color = ~~(Math.random()*3.99999)
          
          if (NO_COLOR) {
            color = 3;
          }
          
          if (sumtot == 0.0 || sumw == 0.0) {
            continue;
          }
          
          ps[i+PD] = sumw/sumtot;
          ps[i+PCLR] = color;
          
          dx1 /= sumw;
          dy1 /= sumw;
          
          var density = sumd/sumtot;
          
          var err = sumw/sumtot;
          err = Math.abs(err-density*0.5);
          
          var dot = dx1*dx1 + dy1*dy1;
          if (dot != 0.0) err /= dot;
          
          var fac;
          if (!GEN_MASK) {
            fac = SPH_SPEED*0.07;
          } else {
            fac = SPH_SPEED*(0.965*this.speedmul+0.035)*0.1;
          }
          
          var sx = ps[i], sy = ps[i+1];
          
          ps[i+PDX] += -dx1*0.5;//err*dx1*fac1;
          ps[i+PDY] += -dy1*0.5;//-err*dy1*fac1;
          
          ps[i]   += ps[i+PDX]*fac;
          ps[i+1] += ps[i+PDY]*fac;
          
          ps[i+PDX] *= 0.5;
          ps[i+PDY] *= 0.5;
          
          if (TILABLE) {
            ps[i] = Math.fract(ps[i]);
            ps[i+1] = Math.fract(ps[i+1]);
          } else {
            var rx = ps[i], ry = ps[i+1];
            ps[i] = Math.min(Math.max(ps[i], 0.0), 1.0);
            ps[i+1] = Math.min(Math.max(ps[i+1], 0.0), 1.0);
            
            /*
            rx -= ps[i];
            ry -= ps[i+1];
            
            var boundforce = 0.5;
            if (ps[i] == 0) ps[i] = Math.random()*0.01;
            if (ps[i+1] == 0) ps[i+1] = Math.random()*0.01;
            if (ps[i] == 1) ps[i] = 1-Math.random()*0.01;
            if (ps[i+1] == 1) ps[i+1] = 1-Math.random()*0.01;
            
            if (ps[i] < 0.5) {
              ps[i+PDX] += (0.5-ps[i])*0.2;
            } else {
              ps[i+PDX] -= (ps[i]-0.5)*0.2;
            }
            
            if (ps[i+1] < 0.5) {
              ps[i+PDY] += (0.5-ps[i+1])*0.2;
            } else {
              ps[i+PDY] -= (ps[i+1]-0.5)*0.2;
            }*/
          }
          
          this.kdtree.remove(i/PTOT);
          this.kdtree.insert(ps[i], ps[i+1], i/PTOT);
        }
        
        this.report("points", this.points.length/PTOT);
        
        //XXX
        //this.speedmul *= 0.99; //speed > 0.1 ? 0.95 : 0.97;
        
        if (this.speedmul < 0.0005) {
          this.speedmul = 0.15;
        }
        
        this.raster();
    },

    function reset(basesize, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.maxgen = HIEARCHIAL_LEVELS;
      this.speedmul = 1.0;
      this.mode = Modes.SHUFFLE;
      this.targetpoints = 0;          
      this.r_mul = 1.0;
      this.ni = 0;
      this.max_ni = 0;
      this.first = true;
      this._ci = 0;
      
      this.r = Math.sqrt(2.0) / (DIMEN);
      this.start_r = this.r;
      
      this.gen = 0;
      this.dimen = basesize;
      
      this.hlvl = 0;
      
      this.final_r = this.r;
      this.start_r = this.r;
      
      this.mdown = false;
      this.points = [];
      
      var size = basesize*3;
      
      this.mask_img = mask_image;
      this.mask = this.mask_img.data;
      this.msize = this.mask_img.width;
      
      this.mask[0] = this.mask[1] = this.mask[2] = 0.0;
      this.mask[0] = 0;
      this.mask[1] = 0;
      this.mask[3] = 255;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      for (var i=0; i<this.msize; i++) {
          for (var j=0; j<this.msize; j++) {
              var idx = (j*this.msize+i)*4;
              var u = i/this.msize;
              var v = j/this.msize;

              this.mask[idx]   = 0; //255
              this.mask[idx+1] = 0;//~~(u*255);
              this.mask[idx+2] = 0;//~~(v*255);
              this.mask[idx+3] = 255;
          }
      }
      
      //base grid
      this.gridsize = size;
      this.grid = new Float64Array(size*size*GTOT);
      this.grid.fill(0, 0, this.grid.length);
      
      var starting_points = DIMEN*DIMEN;//*(1.0/this.b)+0.5);
      
      for (var i=0; i<1500; i++) {
          this.pthrow(starting_points - this.points.length/PTOT);
          
          if (this.points.length/PTOT >= starting_points) {
              break;
          }
      }

    },
    
    function current_level() {
      return this.max_level();
    },
    
    function draw(g) {
      MaskGenerator.prototype.draw.call(this, g);
    },
    
    //optional
    function next_level() {
    },
    
    function raster() {
      this.mask[0] = this.mask[1] = this.mask[2] = 0.0;
      this.mask[0] = 0;
      this.mask[1] = 0;
      this.mask[3] = 255;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = this.points.length/PTOT;
      
      for (var i=0; i<plen; i++) {
        this.raster_point(i);
      }
    },
    
    function raster_point(pi) {
      var mask = this.mask, ps = this.points, msize = this.mask_img.width
      
      var x = ps[pi*PTOT], y = ps[pi*PTOT+1], gen=ps[pi*PTOT+PGEN];
      var color = ps[pi*PTOT+PCLR];
      
      var d = 1.0 - gen/this.max_ni;
      
      var ix = ~~(x*msize), iy = ~~(y*msize);
      var idx = (iy*msize+ix)*4;
      
      if (GEN_CMYK_MASK) {
        var r = ~~(CMYK[color][0]*255);
        var g = ~~(CMYK[color][1]*255);
        var b = ~~(CMYK[color][2]*255);
        
        mask[idx] = r;
        mask[idx+1] = g;
        mask[idx+2] = b;
      } else {
        mask[idx] = mask[idx+1] = mask[idx+2] = ~~(d*255);
      }
      
      mask[idx+3] = 255;
    },
    
    function regen_spatial() {
      MaskGenerator.prototype.regen_spatial.call(this);
    }
  ]);
  
  return exports;
});
