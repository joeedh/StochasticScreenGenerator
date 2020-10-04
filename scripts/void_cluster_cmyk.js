//ignore this file

var _void_cluster_cmyk = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "darts", "sph_old",
  "fft", "report", "presets", "void_cluster"
], function(util, cconst, sinterface, vectormath, kdtree, darts, 
            sph, fft, report, presets, void_cluster) 
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
        
        ret[0] = (ix)/size;
        ret[1] = (iy)/size;
        
        return ret;
      }
    }
  };
  var exports = _void_cluster_cmyk = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var Modes = exports.Modes = {
    SHUFFLE  : 0,
    CONVERGE : 1
  };
  
  let config = exports.config = Object.assign({
    MAKE_JOINT : false
  }, void_cluster.config);
  
  var GIDX=0, GW=1, GSUM=2, GTAG=3, GTOT=4;
  
  /*reuses void-cluster defaults
  let config = {
    //VOIDCLUSTER_MID_R : 0.8,
    VC_FILTERWID : 0.55,
    VC_HIEARCHIAL_SCALE : 7.6,
    TEST_CLUSTER : false,
    VOID_HEX_MODE : false,
    VOID_BAYER_MODE : false,
    VOIDCLUSTER_CURVE : new cconst.EditableCurve("VC Filter Curve", {"points":[{"0":0,"1":0,"eid":40,"flag":0,"deg":3,"tangent":1},{"0":0.07499999999999968,"1":0.03749999999999987,"eid":156,"flag":0,"deg":3,"tangent":1},{"0":0.1874999999999999,"1":0.04375000000000018,"eid":166,"flag":0,"deg":3,"tangent":1},{"0":0.48749999999999993,"1":0.03125,"eid":165,"flag":1,"deg":3,"tangent":1},{"0":0.58125,"1":0.16874999999999996,"eid":162,"flag":0,"deg":3,"tangent":1},{"0":0.64375,"1":0.70625,"eid":168,"flag":0,"deg":3,"tangent":1},{"0":0.8250000000000002,"1":0.9812500000000002,"eid":170,"flag":0,"deg":3,"tangent":1},{"0":0.9125,"1":1,"eid":169,"flag":0,"deg":3,"tangent":1},{"0":0.91875,"1":1,"eid":167,"flag":0,"deg":3,"tangent":1},{"0":0.9999999999999999,"1":0.9875,"eid":130,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":123,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":171}})
  };*/
  
  
  
  var VoidClusterGeneratorCMYK = exports.VoidClusterGeneratorCMYK = class VoidClusterGeneratorCMYK extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.ignore_initial_points = false;
      this.cur_cmyk = 0;
      
      this.hscale = 0;
      this.hlvl = 0;
      this.gen = 0;
      
      this.grids = undefined;
      this.gridsize = undefined;
      
      this._color = undefined;
      this.points = undefined;
    }
    
    static build_ui(gui) {
      gui.check("MAKE_JOINT", "Joint Mask", "Encoded masks into r,g,b,a channels of one image");
      
      //uses normal void-cluster's settings panel
      /*
      var panel2 = gui.panel("Void-Cluster");
      
      let panel3 = panel2.panel("Filter Curve");
      window.VOIDCLUSTER_CURVE = panel3.curve('VOIDCLUSTER_CURVE', 'VC Filter Curve',  cconst.DefaultCurves.VOIDCLUSTER_CURVE).curve;
      panel3.close();
      
      //panel2.slider('VOIDCLUSTER_MID_R', 'Middle Radius', 0.5, 0, 1, 0.001, false, false);
      panel2.slider('VC_FILTERWID', 'Filter Width', 0.5, 0, 16, 0.001, false, false);
      panel2.slider('VC_HIEARCHIAL_SCALE', 'Density Range', 1.0, 0, 40, 0.001, false, false);
      
      panel2.check('TEST_CLUSTER', 'Test Cluster');
      panel2.check('VOID_HEX_MODE', 'Hexagon Mode');
      panel2.check("VOID_BAYER_MODE", "Bayer Mode");
      panel2.close();
      //*/
    }
    
    max_level() {
      return this.maxgen;
    }
    
     
    next_level() {
    }
    
    get_visible_points(restrict, for_fft) {
      var size = this.gridsize;
      var ps2 = super.get_visible_points(restrict, for_fft);

      if (for_fft && ps2.length/PTOT > size*size*0.5) {
        ps2 = super.get_visible_points(restrict, for_fft, true);
      }
      return ps2;
    }
    
    gen_initial_blue(cf, dimen, appstate, mask_image) {
      var midsize = this.midsize;
      var midr = this.start_r;
      
      let ps = this.points;
      
      util.seed(0);
      
      for (let i=0; i<midsize*midsize; i++) {
        let x = util.random(), y = util.random();
        
        let pi = ps.length;
        for (let j=0; j<PTOT; j++) {
          ps.push(0);
        }
      
        let color = i % 4;
        
        ps[pi] = x, ps[pi+1] = y;
        ps[pi+PR] = ps[pi+PR2] = midr/2;
        ps[pi+PCLR] = color;
        
        ps[pi+PGEN] = this.maxgen++;
        this.gen++;
      }

      this.searchr = this.filter_r(cf);
      
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
      
      let midr = this.midr;
      let midsize = this.midsize;
      let totpoint = midsize*midsize*4;
      this.maxgen = 0;
      ps.length = 0;
      
      let middimen = Math.max(Math.ceil(Math.sqrt(totpoint)), 1);
      
      //for (let ci=0; ci<4; ci++) {
        for (let i=0; i<totpoint; i++) {
          let pi = ps.length;
          ps.length += PTOT;
          
          for (let j=0; j<PTOT; j++) {
            ps[pi+j] = 0.0;
          }
          
          let x = i % middimen;
          let y = ~~(i / middimen);
          
          x += 0.5;
          y += 0.5;
          x = (x / middimen);
          y = (y / middimen);

          x += (util.random()-0.5)/middimen*0.25;
          y += (util.random()-0.5)/middimen*0.25;
          
          let ci = i % middimen;
          ci += ~~(Math.sqrt(Math.PI)*i / middimen);
          
          x = (Math.floor(x*dimen))/dimen;
          y = (Math.floor(y*dimen))/dimen;
          ps[pi+PCLR] = (ci) % 4;
          ps[pi+PX] = x;
          ps[pi+PY] = y
          ps[pi+PR] = ps[pi+PR2] = midr/2;
          ps[pi+PGEN] = this.maxgen++;
        }
      //}
      return;
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
    
    reset(dimen, appstate, mask_image) {
      super.reset(dimen, appstate, mask_image);
      
      this.colortick = 0;
      this.dimen = dimen;
      this.hscale = this.hlvl = this.gen = this.maxgen = this.totfilled = 0;
      
      this.config.update();
      
      var cf = this.config;
      
      var gfuncs = grid_funcs.cartessian; //cf.VOID_HEX_MODE ? grid_funcs.hex : grid_funcs.cartessian;
      
      this.xy2grid = gfuncs.xy2grid;
      this.grid2xy = gfuncs.grid2xy;
      
      if (cf.MAKE_JOINT) {
        this.gridsize = ~~(dimen);
        this.maxpoints = dimen*dimen*4.0;
      } else {
        this.gridsize = ~~(dimen/2);
        this.maxpoints = dimen*dimen;
      }
      
      
      this.grids = new Array(4);
      
      for (let i=0; i<4; i++) {
        let grid = new Float64Array(this.gridsize*this.gridsize*GTOT);
        grid.fill(-1, 0, grid.length);
        this.grids[i] = grid;
      
        for (let gi=0; gi<grid.length; gi += GTOT) {
          grid[gi+GW] = grid[gi+GSUM] = 0;
        }
      }
      
      var hscale = this.hscale = VC_HIEARCHIAL_SCALE;
      
      var r = 1.0 / this.gridsize;
      //var midr = r*0.5 + this.hscale*r*0.5;
      //var midr = r + (r*hscale - r)*cf.VOIDCLUSTER_MID_R;
      let midr = r*hscale;
      
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
        if (1||VOID_BAYER_MODE) {
          this.gen_initial_structured(dimen, appstate, mask_image);
        } else {
          this.gen_initial_blue(this.config, dimen, appstate, mask_image);
        }
      }

      this.search_r = this.filter_r(this.config);
      let joint = this.config.MAKE_JOINT;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        let color = ps[i+PCLR];
        
        var ixy = this.xy2grid(x, y, gridsize);
        var ix = ~~(ixy[0]+0.0), iy = ~~(ixy[1]+0.0);
        
        var idx = (iy*gridsize + ix)*GTOT;
        
        this.grids[color][idx] = i;
              
        var xy = this.grid2xy(ix+0.0001, iy+0.0001, gridsize);
        
        xy[0] = Math.fract(xy[0]);
        xy[1] = Math.fract(xy[1]);
        
        let ox = (color%2)/2, oy = (~~(color/2))/2;
       
        //ps[pi] = x/2+ox, ps[pi+1] = y/2+oy;

        ps[i+PDX] = xy[0];
        ps[i+PDY] = xy[1];
        
        if (!joint) {
          ps[i]   = xy[0]/2 + ox;
          ps[i+1] = xy[1]/2 + oy;
        
          ps[i+PIX] = ~~((ix*gridsize+0.0001)*msize+0.0001);
          ps[i+PIY] = ~~((iy*gridsize+0.0001)*msize+0.0001);
        } else {
          ps[i+PIX] = ~~(xy[0]*dimen);
          ps[i+PIY] = ~~(xy[1]*dimen);
        }
        
        ps[i+PGEN] = 0;
        
        this.grid_sum_point_all(cf, i, 1);
        //this.grid_sum_point(this.grids[color], this.config, i, 1);
      }

      var size = this.gridsize;

      this.cells = [[], [], [], []];
      
      for (let j=0; j<4; j++) {
        for (var i=0; i<size*size; i++) {
          if (this.grids[j][i*GTOT] < 0) {
            this.cells[j].push(i);
          }
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
    
    grid_sum_point(grid, cf, pi, sign, fac=1.0) {
      var size = this.gridsize;
      var ps = this.points, r = this.search_r; //this.filter_r();
      
      let colortick = ps[pi+PCLR];
      
      //we abuse pdx/pdy to store within-grid coordinates,
      //actual x/y store final position in cmyk tiling
      
      var x = ps[pi+PDX], y = ps[pi+PDY];
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
        
        var xy3 = this.grid2xy(ix2+0.0001, iy2+0.0001, size);
        var x3 = xy3[0], y3 = xy3[1];
        
        var dx = x3-x2, dy = y3-y2;
        var dis = dx*dx + dy*dy;
        
        if (dis > r) continue;
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        
        var w = 1.0 - dis/r;
        
        w = cf.VOIDCLUSTER_CURVE.evaluate(w)*fac;
        
        var idx = (iy2*size+ix2)*GTOT;
        
        grid[idx+GW]   += w*sign;
        grid[idx+GSUM] += sign;
      }
    }
    
    current_level() {
      return this.gen;
    }
    
    filter_r(cf) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = Math.sqrt(2.0) / Math.sqrt(this.gridsize*this.gridsize*0.1+this.points.length/PTOT);
      r *= cf.VC_FILTERWID;
      
      return r;
    }
    
    step(custom_steps) {
      let cf = this.config;
      
      var steps = custom_steps ? custom_steps : STEPS;
      if (steps > 64) {
        steps = ~~(Math.log(steps) / Math.log(1.15)) + 40;
      }
      
      console.log("steps", steps);
      
      //steps = 1;
      
//      var preparenext = false;

      for (var i=0; !this.done() && i<steps; i++) {
          this.void_step();
      }
      
      /*
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
          this.grid_sum_point(cf, i*PTOT, 1);
        }
      }//*/
      
      report("points:", this.points.length/PTOT);
      
      this.raster();
    }
    
    done() {
      return this.points.length/PTOT >= this.maxpoints;
    }

    void_step(custom_steps) {
      let cf = this.config;
      var steps = custom_steps ? custom_steps : STEPS;
      var size = this.gridsize, grid = this.grids[this.colortick], ps = this.points;
      
      var rd = ~~(this.r*Math.sqrt(2)*size+2.0);
      var maxf=-1e17, minf=1e17;
      var maxi=-1, mini=-1;
      var minri=-1, maxri=-1;
      
      //eek! slow!
      //stochastic to the rescue!
      
      var cells = this.cells[this.colortick];
      var tot = this.gridsize*3;
      var cs = [];
      
      var idxs = []
      for (var _i=0; _i<tot; _i++) {
        var ri = ~~(Math.random()*cells.length*0.9999999);
        idxs.push(cells[ri]);
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
      let joint = cf.MAKE_JOINT;
      
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
      
      let dimen = this.dimen;
      let small_mask_mode = this.config.SMALL_MASK;
      
      if (cs.length == 0 || minval === undefined) {
        this.colortick = (this.colortick + 1) % 4;
        return;
      }
      
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

      if (mini < 0) {
        this.colortick = (this.colortick + 1) % 4;
        return;
      }
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      
      if (cells.length > 0) {
        cells[minri] = cells[cells.length-1];
        cells.length--;
      }
      
      let xy = this.grid2xy(ix+0.0001, iy+0.0001, size);
      //xy[0] = Math.fract(xy[0]);
      //xy[1] = Math.fract(xy[1]);
      
      //are we generating stippling (i.e. not aligned to grid) mask?
      if (!this.config.SMALL_MASK) {
        //xy = this.optimize_grid_point(xy, ix, iy, pi);
      }
      
      let x2 = xy[0], y2 = xy[1];
      
      var pi = ps.length;
      
      for (var i=0; i<PTOT; i++) {
        ps.push(0);
      }
      
      let gridscale = this.gridsize / this.dimen;
      let gdimen = Math.floor(1.0 / gridscale + 0.5);
      
      //abuse dx/dy to store within-grid coordinates
      ps[pi+PDX] = x2;
      ps[pi+PDY] = y2;
      
      if (!joint) {
        let ox = ~~((this.colortick % gdimen));
        let oy = ~~((this.colortick / gdimen));
        ox *= gridscale;
        oy *= gridscale;
      
        ps[pi]      = x2*gridscale + ox;
        ps[pi+1]    = y2*gridscale + oy;
        //ps[pi+PIX]  = ~~((xy[0]+0.0001)*this.mask_img.width*0.999999+0.0001);
        //ps[pi+PIY]  = ~~((xy[1]+0.0001)*this.mask_img.width*0.999999+0.0001);
      } else {
        let clr = this.colortick;
        
        let ox = clr % 2;
        let oy = ~~(clr / 2);
        
        ps[pi]      = x2 + 0.0001/dimen;// + ox/dimen/4;
        ps[pi+1]    = y2 + 0.0001/dimen;// + oy/dimen/4;
        
        if (!small_mask_mode){ 
          ps[pi]   += (ox/2.0)/dimen;
          ps[pi+1] += (oy/2.0)/dimen;
        }
      }
      
      ps[pi+PIX]  = ~~(ps[pi]*dimen+0.00001);
      ps[pi+PIY]  = ~~(ps[pi]*dimen+0.00001);
      ps[pi+PGEN] = this.maxgen;
      ps[pi+PCLR] = this.colortick; //(pi/PTOT) % 4;
      
      //this.maxgen = ps.length / PTOT;
      this.maxgen++;
      this.gen++;
      
      //ps[pi+PCLR] = this.cur_cmyk;
      //this.cur_cmyk = (this.cur_cmyk+1) % 4;
      
      this.kdtree.insert(ps[pi], ps[pi+1], pi);
      
      grid[mini*GTOT + GIDX] = pi;
      
      this.update_fscale(true);
      this.grid_sum_point_all(cf, pi, 1);
      
      this.colortick = (this.colortick + 1) % 4;
    }
    
        
    raster() {
      let ps = this.points, dimen = this.dimen;
      let mask = this.mask;
      
      let maskdimen = ~~this.mask_img.width;
      let joint = this.config.MAKE_JOINT;
      let small_mask_mode = this.config.SMALL_MASK;
      
      for (let i=0; i<mask.length; i++) {
        mask[i] = 0.0;
      }
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let x = ps[pi], y = ps[pi+1], ix = ~~ps[pi+PIX], iy = ~~ps[pi+PIY];
        let clr = ps[pi+PCLR];
        let gen = ps[pi+PGEN] / this.maxgen;
        
        if (clr != 1) {
          //continue;
        }
        
        ix = ~~(x*maskdimen);
        iy = ~~(y*maskdimen);
        
        gen *= 255;
        let idx = (iy * maskdimen + ix)*4;
        
        if (!joint) {
          mask[idx] = mask[idx+1] = mask[idx+2] = gen;
          mask[idx+3] = 255;
        } else {
          mask[idx+clr] = gen;
          
          if (clr == 3 && !small_mask_mode) {
            mask[idx] = mask[idx+1] = mask[idx+2] = gen;
            mask[idx+3] = 255;
          }
        }
      }
    }

    grid_sum_point_all(cf, pi, sign) {
      let color = this.points[pi+PCLR];
      
      for (let j=0; j<4; j++) {
        let fac = color === j ? 1.0 : 0.5;
        this.grid_sum_point(this.grids[j], cf, pi, 1, fac);
      }
    }
    
    draw(g) {
      var size = this.dimen;
      
      //return;
      
      g.strokeStyle = "grey";
      
      g.beginPath();
      var dx = 1.0 / size;
      for (var i=0.0; i<size+0.0; i++) {
        let i2 = i + 0.5;
        g.moveTo(i2*dx, 0);
        g.lineTo(i2*dx, 1);
        
        g.moveTo(0, i2*dx);
        g.lineTo(1, i2*dx);
      }
      g.stroke();
    }
  };
  
  //reuses normal void cluster's settings
  sinterface.MaskGenerator.register(config, VoidClusterGeneratorCMYK, "VOID_CLUSTER_CMYK");
  
  return exports;
});
