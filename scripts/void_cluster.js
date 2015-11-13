//ignore this file

var _void_cluster = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "darts", "sph"
], function(util, cconst, sinterface, vectormath, kdtree, darts, sph) {
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
      window.GEN_MASK = false;
      
      var gen = new darts.DartsGenerator(appstate);
      gen.reset(midsize, appstate, mask_image);
      while (gen.current_level() < gen.max_level()) {
        gen.next_level();
      }
      
      for (var i=0; i<9; i++) {
        gen.step();
      }
      
      var ps = gen.points;
      //*
      var sgen = new sph.SPHGenerator(appstate);
      sgen.reset(midsize, appstate, mask_image);
      
      sgen.points = ps;
      sgen.regen_spatial();
      sgen.step();
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
          //w *= w*w*(3.0-2.0*w);
          w *= w*w*w*w*w;
          
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
        
        for (var i=0; i<grid.length; i += GTOT) {
          grid[i+GW] = this.filter2(i % gridsize, ~~(i / gridsize));
        }
      }
      
      console.log("points:", this.points.length/PTOT);
      
      this.raster();
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
        //var f = this.filter(ix, iy);

        var f = grid[i*GTOT+GW];
        
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
      if (mini < 0) return;
      
      var pi = this.grid[mini*GTOT]
      this.grid[mini*GTOT] = -1;
      
      ps[pi*PTOT+PGEN] = this.gen++;
      
      var ix = mini % size;
      var iy = ~~(mini / size);
      this.totfilled--;
      
      this.grid_update(ix, iy, true);
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
      var tot = 24;
      
      for (var _i=0; _i<tot; _i++) {
        var ri = ~~(Math.random()*cells.length*0.9999999);
        var i = cells[ri];
        
        if (grid[i*GTOT] >= 0) continue;
        
        var ix = i % size, iy = ~~(i / size);
        var f = this.filter(ix, iy, false);

        //var f = grid[i*GTOT+GW];
        
        //if (Math.random() > 0.9) {
          //console.log(f)
        //}
        
        if (f > maxf) {
          maxf = f;
          maxi = i;
          maxri = ri;
        }
        
        if (f < minf) {
          minf = f;
          mini = i;
          minri = ri;
        }
      }
      
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
    },
    
    function draw(g) {
      var size = this.gridsize;
      
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
