
var _darts = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _darts = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CIX=2, CIY=3, CTOT=4;
  
  var DartsGenerator = exports.DartsGenerator = class DartsGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.cells = this.cellsize = undefined;
      this._colortots = [0, 0, 0, 0]; //temporary variable
      
      this.totfft = 0;
      this.pass = 0;
      this.r = this.final_r = undefined;
      this.hlvl = this.hmul = this.hsteps = undefined;
      this.maxgen = undefined;
      this.cur = 0;
    }
    
    done() {
      return this.hlvl == this.hsteps;
    }
    
    max_level() {
      return this.maxgen;
    }
    
    relax() {
      //this.config.RELAX_CURRENT_LEVEL = true;
      super.relax();
    }
    
    update_cell(ci) {
      //return; //XXX
      
      var cells = this.cells, csize = this.cellsize;
      var cx = cells[ci*CTOT], cy = cells[ci*CTOT+1];
      var ix1 = cells[ci*CTOT+CIX], cy1 = cells[ci*CTOT+CIY];
      var r = this.r;
      
      var icsize = 1.0 / csize;
      
      var is_dead = false;
      
      function update_cell_callback(pi) {
        var ps = this.points;
        var x = ps[pi], y = ps[pi+1];//, r = ps[pi+2];
        
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
    }
    
    update_cells() {
      return; //XXX
      
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
    }
    
    step(custom_steps, noreport) {
      var steps = custom_steps != undefined ? custom_steps : STEPS;
      var ps = this.points, kdtree = this.kdtree, r = this.r;
      var final_r = this.final_r;
      var hlvl = this.hlvl;
      var size = this.dimen;
      
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
        
        var x, y, ci;
        
        if (SCAN_MODE) {
          ci = this.cur++ % (cells.length/CTOT);
        } else {
          ci = ~~(Math.random()*(~~(cells.length/CTOT))*0.999999999);
        }
        ci *= CTOT;
        
        //ci = (this._cur++) % (cells.length/CTOT);
        //ci *= CTOT;
        
        var cx = cells[ci], cy = cells[ci+1], cix = cells[ci+CIX];
        
        if (!ALIGN_GRID) {
          x = cx + icellsize*Math.random();
          y = cy + icellsize*Math.random();
        } else {
          x = (cx+0.0000*icellsize)*size;
          y = (cy+0.0000*icellsize)*size;
          x = (~~x+0.5) / size;
          y = (~~y+0.5) / size;
        }
        
        //x += icellsize*Math.random()*3;
        //y += icellsize*Math.random()*3;
        
        //if (x < 0 || x >= 1 || y < 0 || y >= 1) 
        //  continue;
        
        x = Math.fract(x);// Math.min(Math.max(x, 0), 1);
        y = Math.fract(y);//min(Math.max(y, 0), 1);
        
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
          //if (FFT_TARGETING) break;
          
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
            var x2 = ps[pi]-(x+ox), y2 = ps[pi+1]-(y+oy);
            var dis = x2*x2 + y2*y2;
            var gen2 = ps[pi+PGEN];
           
            var color2 = ps[pi+PCLR];
            
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
        
        //XXX
        bad = bad && !FFT_TARGETING
        
        if (bad) continue;
        
        var pi = ps.length;
        
        for (var i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        //store original level gen here
        ps[pi+PD] = this.hlvl;
        
        ps[pi+PR2] = r;
        ps[pi+PCLR] = color;
        ps[pi] = x, ps[pi+1] = y, ps[pi+PR]=final_r, ps[pi+PGEN]=hlvl;
        
        kdtree.insert(x, y, pi);
        
        this.find_mask_pixel(pi);
        this.raster_point(pi);
        
        if (FFT_TARGETING && this.totfft % 25 == 0) {
          this.do_fft(25);
          
          console.log((this.points.length/PTOT) % 25);
        }
        
        this.totfft++;
        this.regen_spatial();
      }
      
      /*
      for (var i=0; i<ps.length; i += PTOT) {
        this.color_point(i);
      }
      //*/
      
      this.regen_spatial();
      this.update_cells();
      this.raster();
      
      if (!noreport) {
        this.report("points", this.points.length/PTOT);
        this.report("hiearchial level: ", this.hlvl, "of", this.hsteps);
        this.report("cells:", this.cells.length/CTOT);
      }
    }
    
    do_fft(steps) {
      steps = steps == undefined ? 5 : steps;
      
      var ps = this.points;
      
      this.update_fscale();
      
      this.fft.add_points(ps, this.fscale, this.fft.totpoint, ps.length/PTOT);
      this.fft.raster(this.fft_image);
      
      //check last 5 points
      var ps2 = [];
      
      for (var i=0; i<steps; i++) {
        if (ps.length-i*PTOT < 0) break;
        
        ps2.push((ps.length-i*PTOT)/PTOT);
      }
      
      if (ps2.length < steps) 
        return; //wait for more points
      
      var seed = Math.random();
      
      var w = this.ff_weight(seed);
      console.log("fft error estimate", w);
      
      var ws = [];
      var minw=1e17, mini=0;
      
      for (var i=0; i<ps2.length; i++) {
        this.fft.remove_points(ps, ps2[i], ps2[i]+1);
        
        var w2 = this.ff_weight(seed);
        console.log(ps2[i], "fft error estimate", w2);
        this.fft.add_points(ps, this.fscale, ps2[i], ps2[i]+1);
        
        ws.push(w2);
        
        if (w2 < minw) {
          minw = w2;
          mini = i;
        }
      }
      
      mini = ps2[mini];
      
      console.log("least error:", mini, ps2);
      
      var tmp = []
      for (var i=0; i<PTOT; i++) {
        tmp.push(ps[mini*PTOT+i]);
      }
      
      for (var i=0; i<ps2.length; i++) {
        this.fft.remove_points(ps, ps2[i], ps2[i]+1);
      }
      
      ps.length -= ps2.length*PTOT;
      var pi = ps.length/PTOT;
      
      for (var i=0; i<PTOT; i++) {
        ps.push(tmp[i]);
      }

      this.fft.add_points(ps, this.fscale, pi, pi+1);
      this.regen_spatial();
    }
    
    color_point(pi) {
      var ps = this.points, kdtree = this.kdtree, r = this.r;
      var final_r = this.final_r;
      var hlvl = this.hlvl;
      var r = ps[pi+PR2];
      
      if (Math.random() < 0.98) {
        //return;
      }
      
      var cells = this.cells, cellsize = this.cellsize;
      var icellsize = 1.0 / cellsize;
      var x = ps[pi], y = ps[pi+1], gen=ps[pi+PGEN];
      
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
          var x2 = ps[pi]-(x+ox), y2 = ps[pi+1]-(y+oy);
          var r2 = ps[pi+PR], color2 = ps[pi+PCLR];
          var gen2 = ps[pi+PGEN];

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
      ps[pi+PCLR] = color;
    }
    
    make_cells() {
      var r = this.r;
      var dimen = this.dimen; //~~(Math.sqrt(2) / r);
      //dimen *= 2;
      
      //console.log("cell size:", dimen);
      
      var cells = this.cells = [];
      this.cellsize = Math.max(~~dimen, 16);
      
      for (var i=0; i<dimen*dimen; i++) {
        var x = i % dimen;
        var y = ~~(i / dimen);
        
        cells.push(x/dimen);
        cells.push(y/dimen);
        cells.push(x);
        cells.push(y);
      }
      
      //console.log("cells:", this.cells.length/CTOT);
    }
    
    reset(size, appstate, mask_image) {
      super.reset(size, appstate, mask_image);
      
      this.cur = 0;
      var cf = this.config;
      
      this.totfft = 0;
      this.pass = 0;
      this._cur = 0;
      this.dimen = size;
      
      var totpoint = size*size;

      if (cf.FFT_TARGETING) {
        this.fft = new fft.FFT(64);
        this.fscale = 1.0;
        
        this.fft_image = this.fft.raster();
      }
      
      //this.final_r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
      this.final_r = 1.0 / (Math.sqrt(1.5)*size);
      
      if (cf.HIEARCHIAL_LEVELS > 1) {
        this.start_r = cf.GEN_MASK ? this.final_r*cf.HIEARCHIAL_SCALE : this.final_r;
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
      
      if (cf.HIEARCHIAL_LEVELS > 1 && cf.GEN_MASK) {
        this.hlvl = 0;
        this.hsteps = cf.HIEARCHIAL_LEVELS;
        this.hmul = 1.0 / Math.pow(cf.HIEARCHIAL_SCALE, 1.0/cf.HIEARCHIAL_LEVELS);
      } else {
        this.hlvl = 0;
        this.hsteps = 1;
        this.hmul = 1;
      }
      
      this.maxgen = this.hsteps;
      
      this.make_cells();
    }
    
    draw(g) {
      super.draw(g);
            
      if (FFT_TARGETING && this.fft_image != undefined) {
        this.fft.raster(this.fft_image);
        this.fft.calc_radial();
        this.fft.draw(g, 180, 350, this.fft_image);
      }
      
      if (!ALIGN_GRID)
        return;

      var cf = this.config;
      var size = this.dimen;
      
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
    
    /*
    //optional
    function raster_point(pi) {
      var mask = this.mask, ps = this.points, msize = this.mask_img.width
      var cf = this.config;
      
      var x = ps[pi], y = ps[pi+1], gen=ps[pi+PGEN];
      var color = ps[pi+PCLR];
      
      var d = 1.0 - gen/this.hsteps;

      //XXX
      d = 1.0 - (pi) / this.points.length;
      
      if (cf.TONE_CURVE != undefined) {
        d = 1.0 - cf.TONE_CURVE.evaluate(1.0-d);
      }
      
      //d = (~~(d*16))/16;
      
      //d = Math.pow(Math.abs(d), 5.0);
      
      if (d < 0 || d > 1.0 || isNaN(d)) {
        throw new Error("eek! " + d);
      }
      
      var ix = ps[pi+PIX], iy = ps[pi+PIY];
      if (ix < 0) return; //dropped point
      
      ix = Math.min(Math.max(ix, 0), msize-1);
      iy = Math.min(Math.max(iy, 0), msize-1);
      
      //console.log(ix, iy, msize);
      //console.log(d)
      
      var idx = (iy*msize+ix)*4;
      if (!cf.ALLOW_OVERDRAW && mask[idx] != 0) return;
      
      if (cf.GEN_CMYK_MASK) {
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
    }
    
    function raster() {
      var cf = this.config;
      
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = cf.SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = ~~(this.points.length/PTOT);
      
      for (var i=0; i<plen; i++) {
        this.raster_point(i);
      }
    }
    */
    current_level() {
      return this.hlvl;
    }
    
    next_level(steps) {
      this.cur = 0;
      
      var cf = this.config;
      
      this.maxgen = this.hsteps;
      
      //scramble order of first level if pack densely is on
      //*
      if (this.hlvl == 0 && cf.LIMIT_DISTANCE) {
        var ps = this.points;
        
        for (var i=0; i<ps.length; i += PTOT) {
          var gen = ps[i+PGEN];
          
          ps[i+PGEN] = ~~(Math.random()*5);
        }
        
        //this.sort();
        
        for (var i=0; i<ps.length; i += PTOT) {
          var gen = ps[i+PGEN];
          
          ps[i+PGEN] = 0;
        }
      }
      
      var ps = this.points;
      for (var i=0; i<ps.length; i += PTOT) {
        ps[i+PGEN] = i/PTOT;
      }
      
      this.maxgen = ps.length/PTOT;
      //*/
      
      steps = steps == undefined ? 1 : steps;
      
      for (var i=0; i<steps; i++) {
        if (this.hlvl < this.hsteps) {
          this.hlvl++;
          this.r *= this.hmul;
        }
      }
      
      //this.make_cells();
    }
  };
  
  return exports;
});
