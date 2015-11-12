var _darts = undefined;

define([
  "util", "const", "interface"
], function(util, cconst, sinterface) {
  'use strict';
  
  var exports = _darts = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  var DartsGenerator = exports.DartsGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this.cells = this.cellsize = undefined;
      this._colortots = [0, 0, 0, 0]; //temporary variable
      
      this.pass = 0;
      this.r = this.final_r = undefined;
      this.hlvl = this.hmul = this.hsteps = undefined;
    },
    
    function max_level() {
      return this.hsteps;
    },
    
    function find_mask_pixel(pi) {
      var ps = this.points, grid = this.maskgrid;
      var size = this.masksize;
      
      var x = ps[pi*PTOT], y = ps[pi*PTOT+1];
      var ix = ~~(x*size*0.9999999), iy = ~~(y*size*0.9999999);
      var idx = iy*size + ix;
      
      if (grid[idx] == -1) {
        ps[pi*PTOT+PIX] = ix;
        ps[pi*PTOT+PIY] = iy;
        grid[idx] = pi;
        return;
      }
      
      var d = 16;
      var mindis = 1e17, min = undefined;
      
      for (var i=-d; i<=d; i++) {
        for (var j=-d; j<=d; j++) {
          var ix2 = ix + i, iy2 = iy + j;
          
          if (ix2 < 0 || iy2 < 0 || ix2 >= size || iy2 >= size)
            continue;
          
          var idx = iy2*size+ix2;
          var dis = i*i + j*j;
          
          if (grid[idx] == -1 && (min == undefined || dis < mindis)) {
            min = idx;
            mindis = dis;
          }
        }
      }
      
      if (min == undefined || grid[min] != -1) {
        for (var ix2=0; ix2<size; ix2++) {
          for (var iy2=0; iy2<size; iy2++) {
            
            var dis = (ix2-ix)*(ix2-ix) + (iy2-iy)*(iy2-iy);
            var idx = iy2*size + ix2;
            
            if (grid[idx] == -1 && (min == undefined || dis < mindis)) {
              min = idx;
              mindis = dis;
            }
          }
        }
      }

      if (min != undefined) { //grid[min] == -1) {
        ps[pi*PTOT+PIX] = ix;
        ps[pi*PTOT+PIY] = iy;
        grid[min] = pi;
        return;
      }
      
      this.report("WARNING: dropping a point");
      
      ps[pi*PTOT+PIX] = -1;
      ps[pi*PTOT+PIY] = -1;
    },
    
    function update_cell(ci) {
      var cells = this.cells, csize = this.cellsize;
      var cx = cells[ci*CTOT], cy = cells[ci*CTOT+1];
      var ix1 = cells[ci*CTOT+CIX], cy1 = cells[ci*CTOT+CIY];
      var r =this.r;
      
      var icsize = 1.0 / csize;
      
      var is_dead = false;
      
      function update_cell_callback(pi) {
        var ps = this.points;
        var x = ps[pi*PTOT], y = ps[pi*PTOT+1];//, r = ps[pi*PTOT+2];
        
        var ix2 = x*csize, iy2 = y*csize;
        var mask = 0, dis;
        
        dis = (x-cx)*(x-cx) + (y-cy)*(y-cy);
        mask |= dis < r*r ? 1 : 0;
        
        
        dis = (x-cx)*(x-cx) + (y-(cy+icsize))*(y-(cy+icsize));
        mask |= dis < r*r ? 2 : 0;
        
        dis = (x-(cx+icsize))*(x-(cx+icsize)) + (y-(cy+icsize))*(y-(cy+icsize));
        mask |= dis < r*r ? 4 : 0;
        
        dis = (x-(cx+icsize))*(x-(cx+icsize)) + (y-cy)*(y-cy);
        mask |= dis < r*r ? 8 : 0;
        
        is_dead = is_dead || mask == 15;
        //console.log("mask", mask, r);
      }
      
      this.kdtree.forEachPoint(cx, cy, 3.0/csize, update_cell_callback, this);
      
      if (is_dead) {
        //remove cell
        for (var i=0; cells.length > CTOT && i < CTOT; i++) {
          cells[ci*CTOT+i] = cells[cells.length-CTOT+i];
        }
        
        cells.length -= CTOT;
      }
    },
    
    function update_cells() {
      var cells = this.cells, csize = this.cellsize;
      var _i = 0;
      
      for (var i=0; i<cells.length; i += CTOT) {
        var clen = cells.length;
        
        if (_i++ > 1000000) {
          console.log("infinite loop!");
          break;
        }
        
        this.update_cell(~~(i/CTOT));
        
        if (cells.length != clen && cells.length > 0) {
          i -= CTOT;
        }
      }
    },
    
    function step(custom_steps, noreport) {
      var steps = custom_steps != undefined ? custom_steps : STEPS;
      var ps = this.points, kdtree = this.kdtree, r = this.r;
      var final_r = this.final_r;
      var hlvl = this.hlvl;
      
      this.pass++;
      
      var t;
      //*
      if (this.hsteps == 1)
        t = 1;
      else
        t = RADIUS_CURVE.evaluate(1.0 - hlvl / (this.hsteps-1));
        
      var r = this.r = this.start_r*t + this.final_r*(1.0-t);
      //*/
      //var r = this.r = this.start_r*t + this.final_r*(1.0-t);
      //var r = this.r = this.start_r*Math.pow(this.hmul, ~~(t*this.hsteps));
      
      var clrtots = [0, 0, 0, 0];
      var cells = this.cells, cellsize = this.cellsize;
      var icellsize = 1.0 / cellsize;
      
      for (var si=0; si<steps; si++) {
        if (cells.length == 0)
          break; //should never happen (not implementing full maximal), but still. . .
        
        var x = Math.random(), y = Math.random();
        var ci = ~~(Math.random()*(~~(cells.length/CTOT))*0.999999999);
        ci *= CTOT;
        
        //ci = (this._cur++) % (cells.length/CTOT);
        //ci *= CTOT;
        
        var cx = cells[ci], cy = cells[ci+1], cix = cells[ci+CIX];
        
        x = cx + icellsize*x;
        y = cy + icellsize*y;
        
        if (isNaN(x) || isNaN(y)) {
          throw new Error("nan!");
        }
        //if (cix%4==0) {
        //  y += icellsize*0.5;
        //}
        
        clrtots[0] = clrtots[1] = clrtots[2] = clrtots[3] = 0.0;
        
        var bad = false;
        var mindis = undefined;
        var color = 0;
        
        mindis = undefined;
        for (var i=0; i<_poffs.length; i++) {
          if (i > 0 && !TILABLE)
            break;
          
          if (bad)
            break;
          
          var ox = _poffs[i][0], oy = _poffs[i][1];
          
          var x1 = x+ox, y1 = y+oy;
          
          var rsqr = r*r;
          var rcolor = r*2.5;
          var rsqr2 = rcolor*rcolor;
          
          var rmul = Math.max(LIMIT_DISTANCE ? 5.0 : 3.0, rcolor*1.5);
          
          //
          kdtree.forEachPoint(x1, y1, r*rmul, function(pi) {
            var x2 = ps[pi*PTOT]-(x+ox), y2 = ps[pi*PTOT+1]-(y+oy);
            var dis = x2*x2 + y2*y2;
            var gen2 = ps[pi*PTOT+PGEN];
           
            var color2 = ps[pi*PTOT+PCLR];
            
            if (dis < rsqr2) {
              var w = dis != 0.0 ? Math.sqrt(dis) / rcolor: 0.0;
              w = 1.0 - w;
              
              w = w*w*(3.0 - 2.0*w);
              clrtots[color2] += w;
            }
            
            if (dis < rsqr) {
              bad = true;
            }
            
            if (LIMIT_DISTANCE) {
              if (mindis == undefined || dis < mindis)
                mindis = dis;
            }
          });
        }
        
        if (clrtots[0] < clrtots[1] && clrtots[0] < clrtots[2] && clrtots[0] < clrtots[3])
          color = 0;
        else if (clrtots[1] < clrtots[0] && clrtots[1] < clrtots[2] && clrtots[1] < clrtots[3])
          color = 1;
        else if (clrtots[2] < clrtots[1] && clrtots[2] < clrtots[0] && clrtots[2] < clrtots[3])
          color = 2;
        else if (clrtots[3] < clrtots[1] && clrtots[3] < clrtots[2] && clrtots[3] < clrtots[0])
          color = 3;
        //else if (clrtots[0] != 0) // && clrtots[1] != 0 && clrtots[2] != 0)
        //  continue;
        else
          color = ~~(Math.random()*3.99999)
        
        var rsqr2 = this.r*(1.0 + DISTANCE_LIMIT);
        rsqr2 *= rsqr2;
        
        if (mindis != undefined && mindis > rsqr2) {
          bad = true;
        }
        
        if (bad) continue;
        
        var pi = ps.length;
        
        for (var i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        var pi2 = ~~(pi/PTOT);
        
        ps[pi+PR2] = r;
        ps[pi+PCLR] = color;
        ps[pi] = x, ps[pi+1] = y, ps[pi+PR]=final_r, ps[pi+PGEN]=hlvl;
        kdtree.insert(x, y, pi2);
        
        this.find_mask_pixel(pi2);
        this.raster_point(pi2);
      }
      
      /*
      for (var i=0; i<ps.length; i += PTOT) {
        this.color_point(i/PTOT);
      }
      //*/
      
      this.update_cells();
      this.raster();
      
      if (!noreport) {
        this.report("points", this.points.length/PTOT);
        this.report("hiearchial level: ", this.hlvl, "of", this.hsteps);
        this.report("cells:", this.cells.length/CTOT);
      }
    },
    
    function color_point(pi) {
      var ps = this.points, kdtree = this.kdtree, r = this.r;
      var final_r = this.final_r;
      var hlvl = this.hlvl;
      var r = ps[pi*PTOT+PR2];
      
      if (Math.random() < 0.98) {
        //return;
      }
      
      var cells = this.cells, cellsize = this.cellsize;
      var icellsize = 1.0 / cellsize;
      var x = ps[pi*PTOT], y = ps[pi*PTOT+1], gen=ps[pi*PTOT+PGEN];
      
      var clrtots = this._colortots;
      clrtots[0] = clrtots[1] = clrtots[2] = clrtots[3] = 0.0;
      
      var color = 0;
      
      for (var i=0; i<_poffs.length; i++) {
        if (i > 0 && !TILABLE)
          break;
        
        var ox = _poffs[i][0], oy = _poffs[i][1];
        
        var x1 = x+ox, y1 = y+oy;
        
        var rsqr = r*r;
        var rcolor = r*8.0;
        var rsqr2 = rcolor*rcolor;
        
        var rmul = Math.max(LIMIT_DISTANCE ? 5.0 : 3.0, rcolor*1.25);
        
        //
        kdtree.forEachPoint(x1, y1, r*rmul, function(pi) {
          var x2 = ps[pi*PTOT]-(x+ox), y2 = ps[pi*PTOT+1]-(y+oy);
          var r2 = ps[pi*PTOT+PR], color2 = ps[pi*PTOT+PCLR];
          var gen2 = ps[pi*PTOT+PGEN];

          if (gen2 > gen) {
            return;
          }
          
          var dis = x2*x2 + y2*y2;
          
          if (dis < rsqr2) {
            var w = dis != 0.0 ? Math.sqrt(dis) / rcolor: 0.0;
            w = 1.0 - w;
            w = w*w*(3.0 - 2.0*w);
            
            clrtots[color2] += w;
          }
        });
      }
      
      if (clrtots[0] < clrtots[1] && clrtots[0] < clrtots[2] && clrtots[0] < clrtots[3])
        color = 0;
      else if (clrtots[1] < clrtots[0] && clrtots[1] < clrtots[2] && clrtots[1] < clrtots[3])
        color = 1;
      else if (clrtots[2] < clrtots[1] && clrtots[2] < clrtots[0] && clrtots[2] < clrtots[3])
        color = 2;
      else if (clrtots[3] < clrtots[1] && clrtots[3] < clrtots[2] && clrtots[3] < clrtots[0])
        color = 3;
      else if (clrtots[0] == clrtots[1] && clrtots[0] == clrtots[2] && clrtots[0] == clrtots[3])
        return;
      else
//        return;
        color = ~~(Math.random()*3.99999)
      
      //var i = ~~(this.pass / 5);
      //if (i % 4 != color) return;
      
      //if (color != 3) return;
      ps[pi*PTOT+PCLR] = color;
    },
    
    function make_cells() {
      var r = this.r;
      var dimen = ~~(1 / r);
      dimen *= 2;
      
      console.log("cell size:", dimen);
      
      var cells = this.cells = [];
      this.cellsize = dimen;
      
      for (var i=0; i<dimen*dimen; i++) {
        var x = i % dimen;
        var y = ~~(i / dimen);
        
        cells.push(x/dimen);
        cells.push(y/dimen);
        cells.push(x);
        cells.push(y);
      }
      
      console.log("cells:", this.cells.length/CTOT);
    },
    
    function reset(size, appstate, mask_image) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.pass = 0;
      this._cur = 0;
      
      var totpoint = size*size;
      
      //this.final_r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
      this.final_r = 1.0 / (Math.sqrt(1.5)*size);
      
      if (HIEARCHIAL_LEVELS > 1) {
        this.start_r = GEN_MASK ? this.final_r*HIEARCHIAL_SCALE : this.final_r;
        this.r = this.start_r;
      } else {
        this.r = this.start_r = this.final_r;
      }
      
      var msize = mask_image.width;
      this.maskgrid = new Int32Array(msize*msize);
      
      this.maskgrid.fill(-1, 0, this.maskgrid.length);
      this.masksize = mask_image.width;
      
      var iview = new Int32Array(mask_image.data.buffer);
      var m = mask_image.data;
      //m[0] = 200, m[1] = 200, m[2] = 200, m[3] = 255;
      m[3] = 255;
      
      iview.fill(iview[0], 0, iview.length);
      
      if (HIEARCHIAL_LEVELS > 1 && GEN_MASK) {
        this.hlvl = 0;
        this.hsteps = HIEARCHIAL_LEVELS;
        this.hmul = 1.0 / Math.pow(HIEARCHIAL_SCALE, 1.0/HIEARCHIAL_LEVELS);
      } else {
        this.hlvl = 0;
        this.hsteps = 1;
        this.hmul = 1;
      }
      
      this.make_cells();
    },
    
    function draw(g) {
      MaskGenerator.prototype.draw.call(this, g);
    },
    
    //optional
    function raster_point(pi) {
      var mask = this.mask, ps = this.points, msize = this.mask_img.width
      
      var x = ps[pi*PTOT], y = ps[pi*PTOT+1], gen=ps[pi*PTOT+PGEN];
      var color = ps[pi*PTOT+PCLR];
      
      var d = 1.0 - gen/this.hsteps;

      //XXX
      d = 1.0 - (pi*PTOT) / this.points.length;
      
      if (TONE_CURVE != undefined) {
        d = 1.0 - TONE_CURVE.evaluate(1.0-d);
      }
      
      //d = (~~(d*16))/16;
      
      //d = Math.pow(Math.abs(d), 5.0);
      
      if (d < 0 || d > 1.0 || isNaN(d)) {
        throw new Error("eek! " + d);
      }
      
      var ix = ps[pi*PTOT+PIX], iy = ps[pi*PTOT+PIY];
      if (ix < 0) return; //dropped point
      
      ix = Math.min(Math.max(ix, 0), msize-1);
      iy = Math.min(Math.max(iy, 0), msize-1);
      
      //console.log(ix, iy, msize);
      //console.log(d)
      
      var idx = (iy*msize+ix)*4;
      if (!ALLOW_OVERDRAW && mask[idx] != 0) return;
      
      if (GEN_CMYK_MASK) {
        var r = ~~(d*CMYK[color][0]*255);
        var g = ~~(d*CMYK[color][1]*255);
        var b = ~~(d*CMYK[color][2]*255);
        
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
      this.mask[3] = 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = ~~(this.points.length/PTOT);
      
      for (var i=0; i<plen; i++) {
        this.raster_point(i);
      }
    },
    
    function current_level() {
      return this.hlvl;
    },
    
    function next_level(steps) {
      steps = steps == undefined ? 1 : steps;
      
      for (var i=0; i<steps; i++) {
        if (this.hlvl < this.hsteps) {
          this.hlvl++;
          this.r *= this.hmul;
        }
      }
      
      this.make_cells();
    },
    
    function regen_spatial() {
      MaskGenerator.prototype.regen_spatial.call(this);
    }
  ]);
  
  return exports;
});
