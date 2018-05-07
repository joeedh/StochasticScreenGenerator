var _sph = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "report"
], function(util, cconst, sinterface, vectormath, kdtree, report) {
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
  
  var SPHGenerator = exports.SPHGenerator = class SPHGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(dilute_small_mask);
      
      this.draw_rmul = 0.4;
      this.encode_new_offsets = true;
      
      this._ki = 0;
      
      this.speedmul = 1.0;
      this.mode = Modes.SHUFFLE;
      
      this.mpos = new Vector2();
      
      this.search_rmul = 3.0;
      this.base = 1.00012;
      this.maxgen = this.config.HIEARCHIAL_LEVELS;
      this.pass = 0;
      
      this.points = [];
    }
    
    max_level() {
      return this.max_ni;
    }
    
    pthrow(steps) {
        //steps = steps == undefined ? 0.4*DIMEN*DIMEN : steps;
        steps = steps == undefined ? 110 : steps;
        var size=this.gridsize, grid=this.grid;
        var cf = this.config;
        
        var size2 = this.basesize2;
        
        console.log("points", this.points.length);
        
        var ps = this.points;
        var mask = this.mask_img;
        var cw, ch;
        
        if (mask != undefined) {
          cw = mask.width;
          ch = mask.height;
        } else {
          cw = ch = size;
        }
        
        var r = this.final_r = Math.sqrt(1 / (2*Math.sqrt(3)*size2*size2));
        
        for (var si=0; si<steps; si++) {
            var x, y;
            
            if (this.points.length/PTOT > size2*size2) {
              continue;
            }
            
            var i1 = ~~(Math.random()*size2*size2)
            
            var x = (i1 % size2) / size2;
            var y = i1 / (size2*size2);
            
            x += Math.random()/size2;
            y += Math.random()/size2;
            
            //x = Math.random()*0.001+0.5;
            //y = Math.random()*0.001+0.5;
            
            var ix = ~~(x*size), iy = ~~(y*size);
            
            if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
                continue;
            }
            
            var idx = (iy*size+ix)*GTOT;
            
            if (grid[idx+GFILLED]==1) {
            //    continue;
            }
            
            var pi = this.points.length;
            
            grid[idx+GFILLED] = 1;
            grid[idx+GIDX] = pi;
            
            for (var i=0; i<PTOT; i++) {
              ps.push(0);
            }
            
            var gen = Math.random();//(Math.random()+Math.random()+Math.random()+Math.random())*0.25;
            //make uniform more linear, but one sided.
            gen = Math.log(1.0 + gen*8) / Math.log(8);
            gen *= gen;
            //gen = gen*gen*gen*gen*0.25 + gen*gen*gen*0.25 + gen*gen*0.5;
            
            gen = 0.005 + gen*(1.0 - 0.01);
            
            //see constructor(), size from above is actually this.dimen*3
            var size3 = Math.sqrt(3*this.points.length/PTOT);
            
            var r2 = Math.sqrt(1 / (2*Math.sqrt(3)*size3*size3));
            
            gen = pi/PTOT/(size2*size2);
            let gsteps = window.HIEARCHIAL_LEVELS;
            gen = (~~(gen*gsteps))/gsteps;
            
            //gen = Math.pow(gen, 1.0);
            
            //gen = Math.pow(gen, 0.75);
            //var r = this.final_r = Math.sqrt(1 / (2*Math.sqrt(3)*size*size));
            
            ps[pi+PX] = ps[pi+POLDX] = x;
            ps[pi+PY] = ps[pi+POLDY] = y;
            ps[pi+PR] = r2;
            ps[pi+PIX] = ~~(x*cw*0.99999);
            ps[pi+PIY] = ~~(y*ch*0.99999);
            
            //gen = ~~(gen*255);
            gen *= 255;
            
            this.points[pi+PGEN] = gen;
            this.max_ni = Math.max(this.max_ni, gen+1);
        }
        
    }
    
    toggle_timer_loop(appstate, simple_mode) {
        if (appstate.timer != undefined) {
          window.clearInterval(appstate.timer);
          appstate.timer = undefined;
          return;
        } 
        
        var this2 = this;
        var start = util.time_ms();
        var first = util.time_ms();
        var lasttot = 0;
        var totsame = 0;
        
        appstate.timer = window.setInterval(function() {
          if (util.time_ms() - start < 80) {
            return;
          }
          
          this2.config.update();
          
          var start2 = util.time_ms();
          var report1 = 0;
          
          //while (util.time_ms() - start2 < 700) {
          appstate.step(undefined, report1++);
          //}
          
          redraw_all();
          
          var t = util.time_ms() - first;
          t = (t/1000.0).toFixed(1);
          
          report("time elapsed: ", t + "s");
          start = util.time_ms();
        }, 100);
    }
    
      
    step(custom_steps, noreport) {
      let x1, y1, r1, searchfac, searchrad;
      let gen1;
      let plen = this.points.length, ps = this.points;
      let offx, offy, pi;
      
      var sumx, sumy, sumtot, sumw, summass;
      var cf = this.config;
      let df = 0.0005;

      let error = 0.0;
      
      let callback = (pi2) => {
        if (pi2 == pi) return;
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR];
        
        let dx = x2 - (x1+offx), dy = y2 - (y1+offy);
        let dx2 = x2 - (x1+df+offx), dy2 = y2 - (y1+df+offy);
        
        let len = dx*dx + dy*dy;
        
        //console.log(len, searchrad*searchrad);
        if (len == 0 || len >= searchrad*searchrad)
          return;
        
        len = Math.sqrt(len);
        let len2 = Math.sqrt(dx2*dx2 + dy*dy);
        let len3 = Math.sqrt(dx*dx + dy2*dy2);

        let w  = 1.0 - len/searchrad;
        let w2 = 1.0 - len2/searchrad;
        let w3 = 1.0 - len3/searchrad;

        let gen1 = ps[pi+PGEN]+1;
        let gen2 = ps[pi2+PGEN]+1;
        
        //if (r2 > r1) {
          //return
        //}
        let mass = 1//r2 < r1 ? Math.pow(gen1/gen2, 14.0)*0.0 : 1.0;
        if (gen1 < gen2) {
            mass = Math.pow(gen1/gen2, 1.0);
            //mass = 0.1;
            //mass = 0.1
        //    return;
        }
        //mass = Math.pow(mass, 0.5);
        
        w = cf.SPH_CURVE.evaluate(w)*mass;
        w2 = cf.SPH_CURVE.evaluate(w2)*mass;
        w3 = cf.SPH_CURVE.evaluate(w3)*mass;
        
        dx = (w2-w) / df;
        dy = (w3-w) / df;
        
        let fac = 0.001;
        
        //ps[pi2] += dx*fac;
        //ps[pi2+1] += dy*fac;
        
        /*
        on factor;
        off period;
        
        operator filter;
        
        w := 1.0 - sqrt(dx*dx + dy*dy) / searchrad;
        comment: df(filter(w), dx);
        df(w, dx);
        df(w, dy);
        
        */
        
        //if (r2 < r1) {
        //  return;
        //}
        
        if (isNaN(w) || isNaN(x2) || isNaN(y2)) {
          console.log("NaN!", w, x2, y2, pi);
        }
        
        sumx += dx*mass;
        sumy += dy*mass;
        summass += mass;
        
        sumw += w*mass;
        sumtot++;
      }
        
      searchfac = window.SPH_FILTERWID;
      
      for (let i=0; i<ps.length; i += PTOT) {
        ps[i+PDX] = ps[i] - ps[i+POLDX];
        ps[i+PDY] = ps[i+1] - ps[i+POLDY];
        
        ps[i+POLDX] = ps[i];
        ps[i+POLDY] = ps[i+1];
      }
      
      let maxr = 0.1;
      let minr = 10000.0;
      for (var pi1=0; pi1<plen; pi1 += PTOT) {
        maxr = Math.max(maxr, ps[pi1+PR]);
        minr = Math.min(minr, ps[pi1+PR]);
      }
      
      
      for (var pi1=0; pi1<plen; pi1 += PTOT) {
        pi = ~~(Math.random()*(plen/PTOT - 1))*PTOT;
        
        x1 = ps[pi], y1 = ps[pi+1], r1 = ps[pi+PR];
        gen1 = ps[pi+PGEN];
        let hgen1 = ps[pi+PD];
        
        //searchrad = r1*searchfac;
        searchrad = minr*searchfac;
        
        sumx=sumy=sumw=sumtot=summass=0;
        
        for (var j=0; j<_poffs.length; j++) {
          offx = _poffs[j][0], offy = _poffs[j][1];
          //offx = 0, offy = 0;
          /*
          for (var k=0; k<ps.length; k += PTOT) {
            let x2 = ps[k+POLDX], y2 = ps[k+POLDY];
            let dx = x2-(x1+offx), dy = y2-(y1+offy);
            
            if (k == pi)
              continue;

            if (dx*dx + dy*dy < searchrad*searchrad) {
              callback(k);
            }
          }//*/
          
          this.kdtree.forEachPoint(x1+offx, y1+offy, searchrad, callback, this);
        }
        
        if (sumtot == 0) {
          continue;
        }
        
        //sumx /= summass; //sumw;
        //sumy /= summass; //sumw;
        sumx /= summass;
        sumy /= summass;
        sumw /= summass; 
        //summass /= sumtot;
        
        error += sumw;
        
        let dot = (sumx * sumx + sumy*sumy);
        if (dot == 0.0) {
          continue;
        }
        
        //sumw *= 1.0 / dot;
        
        let mul = -cf.SPH_SPEED*0.025;
        
        ps[pi] += mul*sumx;
        ps[pi+1] += mul*sumy;
        
        ps[pi] = Math.fract(ps[pi]);
        ps[pi+1] = Math.fract(ps[pi+1]);
      }
      
      console.log("\nerror:", error.toFixed(4), "\n\n");
      
      this.assign_mask_pixels();
      this.regen_spatial();
      this.raster();
      
      this.first = false;
    }
    
    reset(basesize, appstate, mask_image) {
      super.reset(basesize, appstate, mask_image);
      var cf = this.config;
      
      this.pass = 0;
      this.maxgen = cf.HIEARCHIAL_LEVELS;
      this.speedmul = 1.0;
      this.mode = Modes.SHUFFLE;
      this.targetpoints = 0;          
      this.r_mul = 1.0;
      this.ni = 0;
      this.max_ni = 0;
      this.first = true;
      this._ci = 0;
      
      var basesize2 = basesize //* 0.85;
      this.basesize2 = basesize2;
      
      this.r = Math.sqrt(2.0) / (basesize2);
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
      
      var starting_points = basesize2*basesize2;//*(1.0/this.b)+0.5);
      
      for (var i=0; i<1500; i++) {
          this.pthrow(starting_points - this.points.length/PTOT);
          
          if (this.points.length/PTOT >= starting_points) {
              break;
          }
      }
      
      this.report("points", this.points.length/PTOT);
      this.regen_spatial();
      this.raster();
    }
    
    /*
    relax(use_avg_dis) {
      use_avg_dis = use_avg_dis==undefined ? true : use_avg_dis;
      use_avg_dis=1
      super.relax(use_avg_dis);
    }
    */
    
    current_level() {
      return this.max_level();
    }
    
    //optional
    next_level() {
    }
  };
  
  return exports;
});
