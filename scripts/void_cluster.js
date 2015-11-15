//ignore this file

var _void_cluster = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "darts", "sph",
  "fft"
], function(util, cconst, sinterface, vectormath, kdtree, darts, 
            sph, fft) 
{
  'use strict';
  
  var exports = _void_cluster = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var Modes = exports.Modes = {
    SHUFFLE  : 0,
    CONVERGE : 1
  };
  
  var GIDX=0, GW=1, GTAG=2, GTOT=3;
  
  var VoidClusterGenerator = exports.VoidClusterGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this.hsteps = this.hscale = 0;
      this.hlvl = 0;
      this.gen = 0;
      
      this.grid = undefined;
      this.gridsize = undefined;
      
      this._color = undefined;
      this.points = undefined;
    },
    
    function max_level() {
      return this.maxgen;
    },
    
     
    function next_level() {
      if (this.gen >= this.hsteps-1) {
        this.gen = this.hsteps;
        return;
      }
    },
    
    function reset(dimen, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.dimen = dimen;
      this.totfilled = 0;
      this.maxgen = 0;

      this.fft = new fft.FFT(64);
      this.fscale = 1.0;
      
      this.gridsize = ~~(dimen);
      this.grid = new Float64Array(this.gridsize*this.gridsize*GTOT);
      this.grid.fill(-1, 0, this.grid.length);
      
      var hsteps = this.hsteps = HIEARCHIAL_LEVELS;
      var hscale = this.hscale = HIEARCHIAL_SCALE;
      
      var r = 1.0 / dimen;
      var midr = r*0.5 + this.hscale*r*0.5;
      
      this.r = this.start_r = midr;
      this.min_r = r;
      this.max_r = r*this.hscale;
      
      this.points = [];
      
      var midsize = ~~(1.0 / midr+0.5);
      
      this.midsize = midsize;
      this.dimen = dimen;
      
      var genmask = window.GEN_MASK;
      var dofft = window.FFT_TARGETING;
      
      window.FFT_TARGETING = false;
      window.GEN_MASK = false;
      
      var gen = new darts.DartsGenerator(appstate);
      gen.reset(midsize, appstate, mask_image);
      while (gen.current_level() < gen.max_level()) {
        gen.next_level();
      }
      
      for (var i=0; i<15; i++) {
        gen.step();
      }
      
      var ps = gen.points;
      //*
      var sgen = new sph.SPHGenerator(appstate);
      var smidsize = ~~(1.0 / (midr/Math.sqrt(2.0)));
      sgen.reset(midsize, appstate, mask_image);
      
      sgen.r = midr;
      sgen.points = ps;
      sgen.regen_spatial();
      for (var i=0; i<5; i++) {
        sgen.step();
      }
      //*/
      
      var gridsize = this.gridsize;
      var msize = mask_image.width;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        var ix = ~~(x*gridsize+0.0001), iy = ~~(y*gridsize+0.0001);
        
        var idx = (iy*gridsize+ix)*GTOT;
        this.grid[idx] = ~~(i/PTOT);
        
        ps[i] = (ix+0.5)/gridsize;
        ps[i+1] = (iy+0.5)/gridsize;
        
        ps[i+PIX] = ~~(((ix+0.00001)/gridsize)*msize+0.0001);
        ps[i+PIY] = ~~(((iy+0.00001)/gridsize)*msize+0.0001);
        
        ps[i+PGEN] = 0;
      }
      
      var size = this.gridsize;
      for (var i=0; i<size*size; i++) {
        var ix = i % size, iy = ~~(i / size);
        
        var f = this.filter(ix, iy);
        this.grid[i*GTOT+GW] = f;
      }
      
      this.cells = [];
      for (var i=0; i<size*size; i++) {
        if (this.grid[i*GTOT] < 0) {
          this.cells.push(i);
        }
      }
      
      this.midpoints = ps.length/PTOT;
      
      this.points = ps;
      this.regen_spatial();
      
      window.GEN_MASK = genmask;
      window.FFT_TARGETING = dofft;
      
      this.raster();
    },
    
    function current_level() {
      return this.gen;
    },
    
    function grid_update(ix, iy, mode) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var r = 3*this.r;
      var ir = r*size;
      var rd = ~~(ir*Math.sqrt(2.0)+0.5);
      
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
          if (!mode && grid[idx] >= 0) {
            continue;
          }
          
          if (mode && !(grid[idx] < 0 || grid[idx] >= this.midpoints)) {
            continue;
          }
          
          var dis = (ix2-ix1)*(ix2-ix1) + (iy2-iy1)*(iy2-iy1);
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          
          if (dis > ir) {
            continue;
          }
          
          grid[idx+GW] = this.filter(ix2, iy2, mode); //mode ? this.filter2(ix2, iy2) : this.filter(ix2, iy2);
        }
      }
    },
    
    function filter2(ix, iy) {
      return this.filter(ix, iy, true);
    },
    
    function filter(ix, iy, mode2) {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var maxpoints = this.gridsize*this.gridsize;
      var tfac = (maxpoints - this.points.length/PTOT)/maxpoints;
      
      var r = this.r;
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
          if (mode2 && (grid[idx] < 0 || grid[idx] >= this.midpoints)) {
            continue;
          }
          
          var dis = (ix2-ix1)*(ix2-ix1) + (iy2-iy1)*(iy2-iy1);
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          
          if (dis > ir) {
            continue;
          }
          
          var w = 1.0 - dis / ir;
          //w = VOIDCLUSTER_CURVE.evaluate(w);
          var pw = VOIDCLUSTER_CURVE.evaluate(tfac);
          w = pw==0.0 ? w : Math.pow(w, pw*10.0);
          
          //w *= w*w*(3.0-2.0*w);
          //w *= w*w*w*w*w;
          
          sum += w;
          sumtot++;
        }
      }
      
      sumtot = sumtot != 0 ? 1.0 / sumtot : 0;
      
      return sum;
    },
    
    function step(custom_steps) {
      var steps = custom_steps ? custom_steps : STEPS;
      steps = ~~(Math.log(steps) / Math.log(2)) + 20;
      
      console.log("steps", steps);
      
      var preparenext = false;

      for (var i=0; i<steps; i++) {
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
        
        //for (var i=0; i<grid.length; i += GTOT) {
        //  grid[i+GW] = this.filter2(i % gridsize, ~~(i / gridsize));
        //}
      }
      
      console.log("points:", this.points.length/PTOT);
      
      this.raster();
      this.fft_image = this.fft.raster(this.fft_image);
    },
    
    function cluster_step() {
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      if (this.totfilled <= 0) {
        console.log("Done.");
        this.sort();
        
        return;
      }
      
      var rd = ~~(this.r*Math.sqrt(2)*size+2.0);
      var maxf=-1e17, minf=1e17;
      var maxi=-1, mini=-1;
      
      for (var i=0; i<size*size; i++) {
        if (grid[i*GTOT] >= this.midpoints) continue;
        
        var ix = i % size, iy = ~~(i / size);
        var f = this.filter2(ix, iy);

        //var f = grid[i*GTOT+GW];
        
        //if (Math.random() > 0.9) {
          //console.log(f)
        //}
        
        if (f > maxf) {
          maxf = f;
          maxi = i;
        }
        
        if (f < minf) {
          minf = f;
          mini = i;
        }
      }
      
      console.log("minf, maxf", minf, maxf, mini, maxi);
      mini = maxi;
      if (mini < 0) return;
      
      var pi = this.grid[mini*GTOT]
      this.grid[mini*GTOT] = -1;
      
      ps[pi*PTOT+PGEN] = this.gen++;
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      this.totfilled--;
      
      //this.grid_update(ix, iy, true);
    },
    
    function void_step(custom_steps) {
      var steps = custom_steps ? custom_steps : STEPS;
      var size = this.gridsize, grid = this.grid, ps = this.points;
      
      var rd = ~~(this.r*Math.sqrt(2)*size+2.0);
      var maxf=-1e17, minf=1e17;
      var maxi=-1, mini=-1;
      var minri=-1, maxri=-1;
      
      //eek! slow!
      //stochastic to the rescue!
      
      var cells = this.cells;
      var tot = this.gridsize;
      var cs = [];
      
      var idxs = []
      for (var _i=0; _i<tot; _i++) {
        var ri = ~~(Math.random()*cells.length*0.9999999);
        idxs.push(ri);
      }
      
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
        
        var f = this.filter(ix, iy, false);
        cs.push(f);
        
        //var f = grid[i*GTOT+GW];
        
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
      
      var idxs2 = [];
      var idxs3 = [];
      var cs2 = [];
      
      for (var i=0; i<idxs.length; i++) {
        if (cs[i] != empty) {
          idxs3.push(idxs[i]);
          cs2.push(cs[i]);
          idxs2.push(idxs3.length-1);
        }
      }
      
      if (cs.length == 0) 
        return;
      
      idxs = idxs3;
      cs = cs2;
      
      idxs2.sort(function(a, b) {
        return (cs[a] - cs[b]);
      });

      if (cs.length != idxs.length) throw new Error();
      //console.log(cs, idxs, idxs2);
      
      console.log("start");
      var last = undefined;
      var mini2 = 0;
      
      var minf = 1e17;
      var seed = Math.random();
      var arr = [0, 0, 0, 0, 0, 0];
      
      for (var i=0; i<idxs2.length; i++) {
        var ci = idxs2[i];
        
        if (!FFT_TARGETING) {
          mini2 = 0;
          break;
        }
        
        if (i > 0 && Math.abs(cs[ci] - last) > 0.01) {
          break;
        }
        
        var ii = idxs[ci];
        
        var x = ((ii+0.5) % size)/size;
        var y = (~~(ii/size)+0.5)/size;
        
        arr[0] = x;
        arr[1] = y;
        
        var pi = this.points.length/PTOT;
        this.fft.add_points(arr, this.fscale, 0, 1, pi);
        
        var f1 = this.ff_weight(seed);
        
        this.fft.remove_points(arr, 0, 1, pi);
        
        if (f1 < minf) {
          minf = f1;
          mini2 = i;
        }
        
        //console.log(f1.toFixed(3), minf.toFixed(3), mini2); //cs[ci]);
        last = cs[ci];
      }
      if (mini2 == 1e17) mini2 = 0;
      
      minri = idxs[idxs2[mini2]];
      mini = cells[minri];
      //console.log("mini", mini, cs[idxs2[mini2]], mini2, idxs2[mini2]);
      
      //console.log("minf, maxf", minf, maxf, mini, maxi);

      if (mini < 0) return;
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      
      if (cells.length > 0) {
        cells[minri] = cells[cells.length-1];
        cells.length--;
      }
      
      //this.grid_update(ix, iy, false);
      
      var pi = ps.length;
      for (var i=0; i<PTOT; i++) {
        ps.push(0);
      }
      
      ps[pi] = (ix+0.5)/size;
      ps[pi+1] = (iy+0.5)/size;
      ps[pi+PIX] = ~~(((ix+0.000001)/size)*this.mask_img.width+0.0001);
      ps[pi+PIY] = ~~(((iy+0.000001)/size)*this.mask_img.width+0.0001);
      ps[pi+PGEN] = this.maxgen++;
      
      grid[mini*GTOT] = pi/PTOT;
      
      this.update_fscale(true);
      this.fft.add_points(ps, this.fscale, pi/PTOT, pi/PTOT+1);
    },
    
    function draw(g) {
      var size = this.gridsize;
      
      if (this.fft_image != undefined) {
        this.fft.raster(this.fft_image);
        this.fft.calc_radial();
        this.fft.draw(g, 80, 450, this.fft_image);
      }
      
      return;
      
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
  ]);
  
  return exports;
});
