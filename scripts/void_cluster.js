//ignore this file

var _void_cluster = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "darts", "sph",
  "fft", "report"
], function(util, cconst, sinterface, vectormath, kdtree, darts, 
            sph, fft, report) 
{
  'use strict';
  
  var xy2grid_rets = new util.cachering(function() {
    return [0, 0];
  }, 32);
  var grid2xy_rets = new util.cachering(function() {
    return [0, 0];
  }, 32);
  
  var sqrt3 = Math.sqrt(3);
  var sqrt2 = Math.sqrt(2);
  var hexfac = 1.0 / (sqrt3);
  
  var grid_funcs = {
    hex : {
      xy2grid : function(x, y, size) {
        var ret = xy2grid_rets.next();
        
        ret[0] = x*size+0.00001;
        ret[1] = y*size+0.00001;
        
        if ((~~ret[0]) & 1) {
          ret[1] -= 0.5;
        }
        
        ret[0] -= 0.5;
        ret[1] -= 0.5;
        
        return ret;
      },
      
      grid2xy : function(ix, iy, size) {
        if ((~~ix) & 1) {
          iy += 0.5;
        }
        
        //ix *= hexfac;
        
        var ret = grid2xy_rets.next();
        ret[0] = (ix+0.5)/size;
        ret[1] = (iy+0.5)/size;
        
        return ret;
      }
    },
    cartessian : {
      xy2grid : function(x, y, size) {
        var ret = xy2grid_rets.next();
        
        ret[0] = x*size+0.50001;
        ret[1] = y*size+0.50001;
        
        return ret;
      },
      
      grid2xy : function(ix, iy, size) {
        var ret = grid2xy_rets.next();
        
        ret[0] = (ix+0.5)/size;
        ret[1] = (iy+0.5)/size;
        
        return ret;
      }
    }
  };
  var exports = _void_cluster = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var Modes = exports.Modes = {
    SHUFFLE  : 0,
    CONVERGE : 1
  };
  
  var GIDX=0, GW=1, GSUM=2, GTAG=3, GTOT=4;
  
  var VoidClusterGenerator = exports.VoidClusterGenerator = class VoidClusterGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.ignore_initial_points = false;
      this.cur_cmyk = 0;
      
      this.hsteps = this.hscale = 0;
      this.hlvl = 0;
      this.gen = 0;
      
      this.grid = undefined;
      this.gridsize = undefined;
      
      this._color = undefined;
      this.points = undefined;
    }
    
    max_level() {
      return this.maxgen;
    }
    
     
    next_level() {
      if (this.gen >= this.hsteps-1) {
        this.gen = this.hsteps;
        return;
      }
    }
    
    get_visible_points(restrict, for_fft) {
      var size = this.gridsize;
      var ps2 = super.get_visible_points(restrict, for_fft);

      if (for_fft && ps2.length/PTOT > size*size*0.5) {
        ps2 = super.get_visible_points(restrict, for_fft, true);
      }
      return ps2;
    }
    
    jitter(fac) {
      fac = fac == undefined ? 0.5 : fac;
      
      var ps = this.points;
      var size = this.dimen;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        
        x += fac*(Math.random()-0.5)/size;
        y += fac*(Math.random()-0.5)/size;
        
        ps[i] = x;
        ps[i+1] = y;
        
        var ixy = this.xy2grid(x, y, size);
        
        ps[i+PIX] = ~~((ixy[0]/size+0.00001)*this.mask_img.width+0.00001);
        ps[i+PIY] = ~~((ixy[1]/size+0.00001)*this.mask_img.height+0.00001);
      }
      
      this.regen_spatial();
      this.raster();
      redraw_all()
    }
    
    gen_initial_blue(dimen, appstate, mask_image) {
      var midsize = this.midsize, dimen = this.dimen;
      var midr = this.start_r;
      
      let ps = this.points;
      
      for (let i=0; i<midsize*midsize; i++) {
        let x = Math.random(), y = Math.random();
        
        let pi = ps.length;
        for (let j=0; j<PTOT; j++) {
          ps.push(0);
        }
      
        ps[pi] = x, ps[pi+1] = y;
        ps[pi+PR] = ps[pi+PR2] = midr;
        
        ps[pi+PGEN] = this.maxgen++;
        this.gen++;
      }

      this.searchr = this.filter_r();
      
      for (let i=0; i<10; i++) {
        this.relax();
      }
      
      /*
      var sgen = new sph.SPHGenerator(appstate);
      var smidsize = ~~(1.0 / (midr/Math.sqrt(2.0)));
      sgen.reset(midsize, appstate, mask_image);
      
      sgen.r = midr;
      sgen.points = ps;
      sgen.regen_spatial();
      
      for (var i=0; i<13; i++) {
        sgen.step();
      }
      //*/
    }
    
    gen_initial_structured(dimen, appstate, mask_image) {
      var ps = this.points;
      
      var repeat = ~~(dimen/8);
      
      function point(x, y, ix, iy) {
        var pi = ps.length;
        
        for (var i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        ps[pi]   = x/repeat + ix;
        ps[pi+1] = y/repeat + iy;
        
        return pi;
      }
      
      for (var i=0; i<repeat*repeat; i++) {
        var x = i % repeat, y = ~~(i / repeat);
        
        x /= repeat;
        y /= repeat;
        
        var a = 0.0;
        
        point(0.25+a*2, 0.25+a*2, x, y);
        point(0.25+a*2, 0.75-a, x, y);
        point(0.75-a, 0.75-a, x, y);
        point(0.75-a, 0.25+a*2, x, y);
        
        //point(0.5, 0.5, x, y);
        
        //point(1.0/3.0, 0.5, x, y);
        //point(0.77, 0.5, x, y);
        //point(0.5, 1.0/3.0, x, y);
        //point(0.5, 0.77, x, y);
        
        point(0.5, 0, x, y);
        point(0.0, 0.5, x, y);
      }
    }
    
    snap_grid() {
      var ps = this.points, size = this.gridsize;
      var xy2grid = this.xy2grid;
      var grid2xy = this.grid2xy;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var ret = xy2grid(ps[i], ps[i+1], size);
        
        ret[0] = ~~ret[0];
        ret[1] = ~~ret[1];
        
        ret = grid2xy(ret[0], ret[1], size);
        ps[i]   = ret[0];
        ps[i+1] = ret[1];
      }
      
      this.regen_spatial();
      this.raster();
      redraw_all();
    }
    
    reset(dimen, appstate, mask_image) {
      super.reset(dimen, appstate, mask_image);

      this.dimen = dimen;
      this.hsteps = this.hscale = this.hlvl = this.gen = this.maxgen = this.totfilled = 0;
      
      var cf = this.config;
      
      var gfuncs = cf.VOID_HEX_MODE ? grid_funcs.hex : grid_funcs.cartessian;
      
      this.xy2grid = gfuncs.xy2grid;
      this.grid2xy = gfuncs.grid2xy;
      
      this.gridsize = ~~(dimen);
      this.grid = new Float64Array(this.gridsize*this.gridsize*GTOT);
      this.grid.fill(-1, 0, this.grid.length);
      
      for (let gi=0; gi<this.grid.length; gi += GTOT) {
        this.grid[gi+GW] = this.grid[gi+GSUM] = 0;
      }
      
      var hsteps = this.hsteps = HIEARCHIAL_LEVELS;
      var hscale = this.hscale = HIEARCHIAL_SCALE;
      
      var r = 1.0 / dimen;
      var midr = r*0.5 + this.hscale*r*0.5;
      var midr = r + (r*hscale - r)*cf.VOIDCLUSTER_MID_R;
      
      if (TEST_CLUSTER) {
        midr *= 0.4;
      }
      
      this.draw_rmul = r/midr;
      
      this.r = this.start_r = midr;
      this.min_r = r;
      this.max_r = r*this.hscale;
      
      this.points = [];
      
      var midsize = ~~(1.0 / midr+0.5);
      
      this.midsize = midsize;
      this.dimen = dimen;
      
      var gridsize = this.gridsize;
      var msize = mask_image.width;
      var ps = this.points;
      
      if (!this.ignore_initial_points) {
        if (VOID_BAYER_MODE) {
          this.gen_initial_structured(dimen, appstate, mask_image);
        } else {
          this.gen_initial_blue(dimen, appstate, mask_image);
        }
      }

      this.search_r = this.filter_r();
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        
        var ixy = this.xy2grid(x, y, gridsize);
        var ix = ~~(ixy[0]+0.0), iy = ~~(ixy[1]+0.0);
        
        var idx = (iy*gridsize + ix)*GTOT;
        
        this.grid[idx] = i;
        
        var xy = this.grid2xy(ix, iy, gridsize);
        
        xy[0] = Math.fract(xy[0]);
        xy[1] = Math.fract(xy[1]);
        
        ps[i]   = xy[0];
        ps[i+1] = xy[1];
        
        ps[i+PIX] = ~~((ix/gridsize+0.0001)*msize+0.0001);
        ps[i+PIY] = ~~((iy/gridsize+0.0001)*msize+0.0001);
        
        ps[i+PGEN] = 0;
        
        this.grid_sum_point(i, 1);
      }

      var size = this.gridsize;

      this.cells = [];
      for (var i=0; i<size*size; i++) {
        if (this.grid[i*GTOT] < 0) {
          this.cells.push(i);
        }
      }
      
      this.midpoints = ps.length/PTOT;
      this.regen_spatial();
      
      if (TEST_CLUSTER) {
        this.totfilled = this.midpoints;
        this.maxgen = this.midpoints;
        this.gen = 0;
      }
      
      this.raster();
    }
    
    init_from_points(ps) {
      var grid = this.grid, size = this.gridsize;
      
      this.points = ps;
      this.regen_spatial();

      grid.fill(-1, 0, grid.length);
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        
        var ixy = this.xy2grid(x, y, size);
        var ix = ~~ixy[0], iy = ~~ixy[1];
        
        var idx = (iy*size+ix)*GTOT;
        
        grid[idx+GIDX] = i;
        grid[idx+GW] = grid[idx+GSUM] = 0;
        
        ps[i+PGEN] = 0;
      }
      
      this.midpoints = this.totfilled = ps.length/PTOT;
      this.search_r = this.filter_r();
    }
    
    grid_sum_point(pi, sign) {
      var grid = this.grid, size = this.gridsize;
      var ps = this.points, r = this.search_r; //this.filter_r();
      
      var x = ps[pi], y = ps[pi+1];
      var ixy = this.xy2grid(x, y, size);
      
      var ix = ~~ixy[0], iy = ~~ixy[1];
      
      var rd = ~~(r*size*Math.sqrt(2.0)+2);
      rd = Math.max(rd, 1);
      var off = cconst.get_searchoff(rd);
      
      for (var i=0; i<off.length; i++) {
        var ix2 = off[i][0] + ix, iy2 = off[i][1] + iy;
        var x2 = x, y2 = y;
        
        if (ix2 < 0) {
          ix2 += size;
          x2 += 1.0;
        } else if (ix2 >= size) {
          ix2 -= size;
          x2 -= 1.0;
        }
        
        if (iy2 < 0) {
          iy2 += size;
          y2 += 1.0;
        } else if (iy2 >= size) {
          iy2 -= size;
          y2 -= 1.0;
        }
        
        var xy3 = this.grid2xy(ix2, iy2, size);
        var x3 = xy3[0], y3 = xy3[1];
        
        var dx = x3-x2, dy = y3-y2;
        var dis = dx*dx + dy*dy;
        
        if (dis > r) continue;
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        var w = 1.0 - dis/r;
        
        w = VOIDCLUSTER_CURVE.evaluate(w);
        
        var idx = (iy2*size+ix2)*GTOT;
        
        grid[idx+GW]   += w*sign;
        grid[idx+GSUM] += sign;
      }
    }
    
    current_level() {
      return this.gen;
    }
    
    filter2(ix, iy) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = Math.sqrt(2.0) / Math.sqrt(this.totfilled+2);
      r *= 2;
      
      r = Math.min(r, 0.5);
      
      var xy = this.grid2xy(x, y, size);
      var x = xy[0], y = xy[1];
      
      var idx = (iy*size+ix)*GTOT;
      if (grid[idx] < 0) return 0;
      
      function pointcallback(pi) {
        var x2 = ps[pi], y2 = ps[pi+1];
        var gen = ps[pi+PGEN];
        
        if (gen != 0) return;
          
        //x2 -= _poffs[j][0];
        //y2 -= _poffs[j][1];
        
        var dx = x2-x1, dy = y2-y1;
        var dis = dx*dx + dy*dy;
        
        if (isNaN(dis)) throw new Error();

        if (dis > r*r) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        var w = 1.0 - dis/r;
        //w = Math.exp(-w*6); //gaussian
        
        w = VOIDCLUSTER_CURVE.evaluate(w);
        //var pw = VOIDCLUSTER_CURVE.evaluate(tfac);
        //w = pw==0.0 ? w : Math.pow(w, pw*10.0);
        
        sumtot++;
        sumw += w;
      }
      
      var sumw = 0, sumtot=0;
      var x1, y1;
      
      for (var j=0; j<_poffs.length; j++) {
        x1 = x + _poffs[j][0];
        y1 = y + _poffs[j][1];
        
        this.kdtree.forEachPoint(x1, y1, r*1.25, pointcallback);
      }
        
      return sumtot == 0 ? 0 : sumw;
    }
    
    //void filter
    filter(ix, iy, ignore_existence, excluded_pi) {
      return this.filter_new(ix, iy, ignore_existence, excluded_pi);
    }
    
    filter_r() {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = Math.sqrt(2.0) / Math.sqrt(1+this.points.length/PTOT);
      r *= 1.5;
      
      return r;
    }
    
    filter_new(ix, iy, ignore_existence, excluded_pi) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = this.filter_r();
      var xy = this.grid2xy(ix, iy, size);
      var x = xy[0], y = xy[1];
      
      var idx = (iy*size+ix)*GTOT;
      
      if (grid[idx] >= 0 && !ignore_existence)
        return 0;
      
      function pointcallback(pi) {
        if (excluded_pi == pi) {
          return;
        }
        
        var x2 = ps[pi], y2 = ps[pi+1];
        var gen = ps[pi+PGEN];
        
        //x2 -= _poffs[j][0];
        //y2 -= _poffs[j][1];
        
        var dx = x2-x1, dy = y2-y1;
        var dis = dx*dx + dy*dy;
        
        if (isNaN(dis)) throw new Error();

        if (dis > r*r) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        var w = 1.0 - dis/r;
        //w = w*w;
        
        w = VOIDCLUSTER_CURVE.evaluate(w);
        //var pw = VOIDCLUSTER_CURVE.evaluate(tfac);
        //w = pw==0.0 ? w : Math.pow(w, pw*10.0);
        
        sumtot++;
        sumw += w;
      }
      
      var sumw = 0, sumtot=0;
      var x1, y1;
      
      for (var j=0; j<_poffs.length; j++) {
        x1 = x + _poffs[j][0];
        y1 = y + _poffs[j][1];
        
        this.kdtree.forEachPoint(x1, y1, r, pointcallback);
      }
        
      return sumtot == 0 ? 0 : sumw//sumtot;
    }

    filter_old(ix, iy, mode2) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = this.filter_r();
      var ir = r*Math.sqrt(2)*size;
      var rd = ~~(ir+2.0);
        
      var offs = cconst.get_searchoff(rd);

      //if (Math.random() > 0.95) {
      //  console.log(r, rd);
      //}
      
      var sum = 0;
      var sumtot = 0;
      
      for (var i=0; i<_poffs.length; i++) {
        var ix1 = ix + _poffs[i][0]*size;
        var iy1 = iy + _poffs[i][1]*size;
        //if (i > 0) break;
        
        for (var j=0; j<offs.length; j++) {
          var ix2 = ix1 + offs[j][0], iy2 = iy1 + offs[j][1];
          
          if (ix2 < 0 || iy2 < 0 || ix2 >= size || iy2 >= size)
            continue;
          
          var idx = (iy2*size+ix2)*GTOT;
          if (!mode2 && grid[idx] < 0) {
            continue;
          }
          if (mode2 && (grid[idx] < 0 || grid[idx] >= this.midpoints*PTOT)) {
            continue;
          }
          
          var dis = (ix2-ix1)*(ix2-ix1) + (iy2-iy1)*(iy2-iy1);
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          
          if (dis > ir) {
            continue;
          }
          
          var w = 1.0 - dis / ir;
          w = VOIDCLUSTER_CURVE.evaluate(w);
          //var pw = VOIDCLUSTER_CURVE.evaluate(tfac);
          //w = pw==0.0 ? w : Math.pow(w, pw*10.0);
          
          //w *= w*w*(3.0-2.0*w);
          //w *= w*w*w*w*w;
          
          sum += w;
          sumtot++;
        }
      }
      
      sumtot = sumtot != 0 ? 1.0 / sumtot : 0;
      
      return sum;
    }
    
    step(custom_steps) {
      var steps = custom_steps ? custom_steps : STEPS;
      steps = ~~(Math.log(steps) / Math.log(2)) + 20;
      
      console.log("steps", steps);
      
      //steps = 1;
      
      var preparenext = false;

      for (var i=0; i<steps; i++) {
        if (TEST_CLUSTER) {
          this.cluster_step();
          continue;
        }
        
        if (this.points.length/PTOT < this.gridsize*this.gridsize) {
          this.void_step();
          
          if (this.points.length/PTOT >= this.gridsize*this.gridsize) {
            preparenext = true;
            
            break;
          }
        } else if (this.totfilled > 0) {
          this.cluster_step();
        } else {
          break;
        }
      }
      
      if (preparenext) {
        var grid = this.grid;
        var gridsize = this.gridsize;
        
        this.totfilled = this.midpoints;
        
        for (var i=this.midpoints*PTOT; i<this.points.length; i += PTOT) {
          this.points[i+PGEN] += this.midpoints;
        }
        
        this.maxgen += this.midpoints;
        
        for (var i=0; i<grid.length; i += GTOT) {
          grid[i+GW] = 0;
          grid[i+GSUM] = 0;
        }
        
        for (var i=0; i<this.midpoints; i++) {
          this.grid_sum_point(i*PTOT, 1);
        }
      }
      
      report("points:", this.points.length/PTOT);
      
      this.raster();
    }
    
    cluster_step() {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      if (this.totfilled <= 0) {
        console.log("Done.");
        //this.sort();
        
        return;
      }
      
      var rd = ~~(this.r*Math.sqrt(2)*size+2.0);
      var maxf=-1e17, minf=1e17;
      var maxi=-1, mini=-1;
      
      for (var i=0; i<size*size; i++) {
        if (grid[i*GTOT] < 0 || grid[i*GTOT] >= this.midpoints) continue;
        
        var ix = i % size, iy = ~~(i / size);
        //var f = this.filter2(ix, iy);

        var f = grid[i*GTOT+GW];
        
        if (f > maxf) {
          maxf = f;
          maxi = i;
        }
        
        if (f < minf) {
          minf = f;
          mini = i;
        }
      }
      
      report("minf, maxf", minf, maxf, mini, maxi);
      mini = maxi;
      if (mini < 0) return;
      
      var pi = this.grid[mini*GTOT]
      this.grid[mini*GTOT] = -1;
      
      ps[pi+PGEN] = this.gen++;
      
      //ps[pi+PCLR] = this.cur_cmyk;
      //this.cur_cmyk = (this.cur_cmyk+1) % 4;
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      this.totfilled--;
      
      this.grid_sum_point(pi, -1);
    }
    
    void_step(custom_steps) {
      var steps = custom_steps ? custom_steps : STEPS;
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var rd = ~~(this.r*Math.sqrt(2)*size+2.0);
      var maxf=-1e17, minf=1e17;
      var maxi=-1, mini=-1;
      var minri=-1, maxri=-1;
      
      //eek! slow!
      //stochastic to the rescue!
      
      var cells = this.cells;
      var tot = this.gridsize*3;
      var cs = [];
      
      var idxs = []
      for (var _i=0; _i<tot; _i++) {
        var ri = ~~(Math.random()*cells.length*0.9999999);
        idxs.push(ri);
      }
      
      //* . . .or not.
      idxs = [];
      for (var i=0; i<cells.length; i++) {
        idxs.push(i);
      }
      //*/
      
      var empty = undefined;
      
      for (var _i=0; _i<idxs.length; _i++) {
        var ri = idxs[_i];
        var i = cells[ri];
        
        if (cells.length == 0) break;
        if (grid[i*GTOT] >= 0) {
          cs.push(empty);
          continue;
        }
        
        var ix = i % size, iy = ~~(i / size);
        
        //var f = this.filter(ix, iy);
        
        var f = grid[i*GTOT+GW];
        cs.push(f);
        
        //if (Math.random() > 0.9) {
          //console.log(f)
        //}
        
        if (f > maxf) {
          maxf = f;
          maxi = i;
          maxri = ri;
        }
        
        if (f < minf) { // || (Math.abs(f-minf)<Math.min(f, minf)*0.01 && Math.random() > 0.5)) {
          minf = f;
          mini = i;
          minri = ri;
        }
      }
      
      var idxs3 = [];
      var cs2 = [];
      var minidx = undefined;
      var minval = undefined;
      
      for (var i=0; i<idxs.length; i++) {
        if (cs[i] != empty) {
          if (minval === undefined || cs[i] < minval) {
            minidx = i;
            minval = cs[i];
          }
          
          idxs3.push(idxs[i]);
          cs2.push(cs[i]);
        }
      }
      
      if (cs.length == 0 || minval === undefined) 
        return;
      
      idxs = idxs3;
      cs = cs2;
      
      //console.log("start");
      var last = undefined;
      var mini2 = 0;
      
      var minf = 1e17;
      var seed = Math.random();
      var arr = [0, 0, 0, 0, 0, 0];

      mini2 = 0;
      
      minri = minidx;
      mini = cells[minri];

      if (mini < 0) return;
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      
      if (cells.length > 0) {
        cells[minri] = cells[cells.length-1];
        cells.length--;
      }
      
      var xy = this.grid2xy(ix, iy, size);
      
      //are we generating stippling (i.e. not aligned to grid) mask?
      if (!this.config.SMALL_MASK) {
        //xy = this.optimize_grid_point(xy, ix, iy, pi);
      }
      
      var pi = ps.length;
      
      for (var i=0; i<PTOT; i++) {
        ps.push(0);
      }
      
      xy[0] = Math.fract(xy[0]);
      xy[1] = Math.fract(xy[1]);
      
      ps[pi]      = xy[0];
      ps[pi+1]    = xy[1];
      ps[pi+PIX]  = ~~((xy[0]+0.0001)*this.mask_img.width*0.999999+0.0001);
      ps[pi+PIY]  = ~~((xy[1]+0.0001)*this.mask_img.width*0.999999+0.0001);
      ps[pi+PGEN] = this.maxgen++;
      //ps[pi+PCLR] = this.cur_cmyk;
      //this.cur_cmyk = (this.cur_cmyk+1) % 4;
      
      this.kdtree.insert(ps[pi], ps[pi+1], pi);
      
      grid[mini*GTOT] = pi;
      
      this.update_fscale(true);
      this.grid_sum_point(pi, 1);
    }
    
    optimize_grid_point(xy, ix, iy, pi) {
      var grid = this.grid, size = this.gridsize;
      
      var steps = 10; 
      /*
      for (var i=0; i<steps; i++) {
        ix = xy[0]*size, iy = xy[1]*size;
        
        var df = 0.0005;
        
        var f1 = this.filter(ix, iy, true, pi);
        var f2 = this.filter(ix+df, iy, true, pi);
        var f3 = this.filter(ix, iy+df, true, pi);
        
        var dx = (f2-f1) / df;
        var dy = (f3-f1) / df;
        
        let dot = dx*dx + dy*dy;
        
        if (dot == 0.0 || f1 == 0.0) {
          continue;
        }
        
        let fac = f1/dot*0.95;
        
        xy[0] += dx*fac;
        xy[1] += dy*fac;
        
        xy[0] = Math.fract(xy[0]);
        xy[1] = Math.fract(xy[1]);
      }
      
      return xy;
      //*/
      for (var i=0; i<steps; i++) {
        ix = xy[0]*size;
        iy = xy[1]*size;
        
        var df = 0.025;
        var f1 = this.filter(ix, iy, true);
        var f2 = this.filter(ix-df, iy, true);
        var f3 = this.filter(ix, iy-df, true);
        
        var f4 = this.filter(ix+df, iy, true);
        var f5 = this.filter(ix, iy+df, true);
        
        var dx = f1-f2, dy = f1-f3;
        var dx2 = ((f4-f1) - dx)*0.5;
        var dy2 = ((f5-f1) - dy)*0.5;
        
        var dot = dx2*dx2 + dy2*dy2;
        
        if (dot == 0) continue;
        
        f1 /= dot;
        
        var fac = 0.015*f1/size;
        dx2 *= fac;
        dy2 *= fac;
        
        var m = 1.0/size/steps/3;
        if (dx2*dx2 + dy2*dy2 > m*m) {
          dot = Math.sqrt(dx2*dx2 + dy2*dy2);
          dx2 *= m/dot;
          dy2 *= m/dot;
        }
        //console.log(dx2, dy2);
        
        xy[0] += dx2;
        xy[1] += dy2;
      }
      
      return xy;
      
      var ix1 = (ix+1) % size, iy1 = (iy+1)%size;
      var ix0 = (ix+size-1) % size, iy0 = (iy+size-1)%size;
      
      var idx1 = (iy*size+ix)*GTOT;
      var idxx = (iy*size+ix1)*GTOT;
      var idxy = (iy1*size+ix)*GTOT;
      
      var idxx0 = (iy*size + ix0)*GTOT;
      var idxy0 = (iy0*size + ix)*GTOT;
      
      var f1 = grid[idx1+GW], fx = grid[idxx+GW], fy = grid[idxy+GW];
      var fx2 = grid[idxx0+GW], fy2 = grid[idxy0+GW];
      
      var dx1 = f1-fx2, dy1 = f1-fy2;
      var dx2 = (fx-f1) - dx1, dy2 = (fy-f1) - dy1;
      
      var dot = dx2*dx2 + dy2*dy2;
      if (dot == 0) return xy;
      
      dot = Math.sqrt(dot);
      dx2 /= dot*size;
      dy2 /= dot*size;
      
      f1 /= dot*size;
      
      var fac = (Math.random()*0.8+0.2);
      xy[0] += -dx2*0.25//*fac;
      xy[1] += -dy2*0.25//*fac;
      
      console.log(dx2, dy2, f1, 1.0/size);
      //console.log(-dx*f1, -dy*f1);
      
      var d = 1;
      return xy;
    }
    
    draw(g) {
      var size = this.gridsize;
      
      
      //return;
      
      g.strokeStyle = "grey";
      
      g.beginPath();
      var dx = 1.0 / size;
      for (var i=0; i<size; i++) {
        g.moveTo(i*dx, 0);
        g.lineTo(i*dx, 1);
        
        g.moveTo(0, i*dx);
        g.lineTo(1, i*dx);
      }
      g.stroke();
    }
  };
  
  return exports;
});
