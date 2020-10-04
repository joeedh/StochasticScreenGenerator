
var _darts = undefined;

define([
  "util", "const", "interface", "fft", "presets"
], function(util, cconst, sinterface, fft, presets) {
  'use strict';
  
  var exports = _darts = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CTOT=2;
  
  let config = exports.config = {
    DRAW_CELLS         : false,
    MAX_CELL_DEPTH     : 3,
    DART_PUSH_SPACING  : false,
    DART_MAX_SPACING   : 0.1,
    TRIES_STEPS_MUL    : 0.9,
    DART_MITCHELL_MODE : false
  };
  
  var DartsGenerator = exports.DartsGenerator = class DartsGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.cells = this.cellsize = undefined;
      this.celldepth = 0;
      this._colortots = [0, 0, 0, 0]; //temporary variable
      
      this.totfft = 0;
      this.pass = 0;
      this.r = this.final_r = undefined;
      this.hlvl = this.hmul = this.hsteps = undefined;
      this.maxgen = undefined;
      this.cur = 0;
    }
    
    static build_ui(gui) {
      var panel2 = gui.panel("Dart");
      
      var panel3 = panel2.panel("Radius Curve");
      window.RADIUS_CURVE = panel3.curve('RADIUS_CURVE', 'Radius Curve', presets.RADIUS_CURVE).curve;
      panel3.close();
      
      //panel2.close();
      panel2.check('LIMIT_DISTANCE', 'Pack Densely');
      panel2.slider('DISTANCE_LIMIT', 'Pack Threshold', 0.1, 0.001, 1.2, 0.001, false, false);
      panel2.slider('MAX_CELL_DEPTH', 'Cell Subdivision', 4, 0.0, 10, 1, true, false);
      
      panel3 = panel2.panel("Mitchell Mode");
      panel3.check('DART_MITCHELL_MODE', 'Mitchell Mode');
      panel3.slider('TRIES_STEPS_MUL', 'Tries', 0.9, 0.0, 30, 0.001, false, false);
      panel3.close();
      
      panel2.check('DART_PUSH_SPACING', 'Pack Lightly');
      panel2.slider('DART_MAX_SPACING', 'Pack Threshold', 0.1, 0.001, 1.2, 0.001, false, false);
      
      panel2.check('ALIGN_GRID', 'Align To Grid');
      panel2.check('SCAN_MODE', 'Scan Mode');
      
      panel2.check('DRAW_CELLS', 'Draw Cells');
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
      
      this.update_cells();
    }
    
    update_r() {
      var hlvl = this.hlvl;
      var t, t2;
      
      if (this.hsteps == 1)
        return this.start_r;
      
      t = RADIUS_CURVE.evaluate(1.0 - hlvl / (this.hsteps-1));
      t2 = RADIUS_CURVE.evaluate(1.0 - (hlvl+1) / (this.hsteps-1));
      
      var s = Math.min(this._t / 8, 1.0);
      
      t += (t2 - t) * s*0.5;
      
      this.r = this.start_r*t + this.final_r*(1.0-t);
    }
    
    step(custom_steps, noreport) {
      var steps = custom_steps != undefined ? custom_steps : STEPS;
      var ps = this.points, kdtree = this.kdtree, r = this.r;
      var final_r = this.final_r;
      var hlvl = this.hlvl;
      var size = this.dimen;
      
      let cellrow = undefined;
      this.pass++;
      
      this.update_r();
      this._t++;
      
      var r = this.r;
      //*/
      //var r = this.r = this.start_r*t + this.final_r*(1.0-t);
      //var r = this.r = this.start_r*Math.pow(this.hmul, ~~(t*this.hsteps));
      
      var clrtots = [0, 0, 0, 0];
      var cells = this.cells, cellsize = this.cellsize;
      var icellsize = 1.0 / cellsize;
      
      //console.log("tries", tries);
      
      for (var si=0; si<steps; si++) {
        let maxdis = undefined;
        let maxx=0, maxy = 0, maxcolor=0;
        
        let tries = ~~((this.points.length/PTOT+25)*TRIES_STEPS_MUL);
        tries = !DART_MITCHELL_MODE ? 1 : tries;
        
        for (let tri=0; tri<tries; tri++) {
          if (cells.length == 0)
            break; //should never happen (not implementing full maximal), but still. . .
          
          var x, y, ci;
          var rsqr3 = Math.pow(r*(1.0 + DART_MAX_SPACING), 2.0);
          
          if (SCAN_MODE) {
            ci = this.cur++ % (cells.length/CTOT);
          } else {
            ci = ~~(Math.random()*(~~(cells.length/CTOT))*0.999999999);
          }
          
          ci *= CTOT;
          
          var cx = cells[ci], cy = cells[ci+1];
          cellrow = cy;

          if (ALIGN_GRID) {
            x = (~~(x*size) + 0.5) / size;
            y = (~~(y*size) + 0.5) / size;
          } else {
            x = cx + icellsize*Math.random()*0.5;
            y = cy + icellsize*Math.random()*0.5;
          }
          
          x = Math.fract(x);
          y = Math.fract(y);
          
          if (isNaN(x) || isNaN(y)) {
            throw new Error("nan!");
          }
          
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
              
              if (mindis === undefined || dis < mindis) {
                mindis = dis;
              }
              
              if (dis < rsqr) {
                bad = true;
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
        
          if (LIMIT_DISTANCE && mindis != undefined && mindis > rsqr2) {
            bad = true;
          }
          
          if (DART_PUSH_SPACING && mindis !== undefined && mindis < rsqr3) {
            bad = true;
          }
          
          //XXX
          bad = bad && !FFT_TARGETING
          
          if (bad) continue;
          
          if (maxdis === undefined || mindis > maxdis) {
            maxdis = mindis === undefined ? 1 : mindis;
            maxx = x;
            maxy = y;
            maxcolor = color;
          }
        }
        
        if (maxdis === undefined) {
          //no matches found
          continue;
        } else {
          bad = false;
        }
        
        x = maxx, y = maxy, color = maxcolor;
        
        if (SCAN_MODE) this.cur--;
        
        var pi = ps.length;
        
        for (var i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        //store original level gen here
        ps[pi+PD] = this.hlvl;
        
        ps[pi+PR2] = r;
        ps[pi+PCLR] = color;
        
        ps[pi] = x, ps[pi+1] = y, ps[pi+PR]=final_r, ps[pi+PGEN]=hlvl;

        //*
        ps[pi+PGEN] = ps.length/PTOT;
        this.maxgen = ps.length/PTOT;
        //*/
        
        kdtree.insert(x, y, pi);
        
        this.find_mask_pixel(0, pi);
        this.raster_point(0, pi);
        
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
      
      if (!SCAN_MODE) {
        this.update_cells();
        this.subdivide();
        this.update_cells();
      }
      this.raster();
      
      /*
      if (SCAN_MODE) {
        cells = this.cells;
        
        for (let ci=0; ci<cells.length; ci += CTOT) {
          let cx = cells[ci], cy = cells[ci+1];
          
          if (cy >= cellrow) {
            this.cur = ci;
            break;
          }
        }
        //this.cur = 0;
      }//*/
      
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
    
    subdivide() {
      if (this.celldepth >= MAX_CELL_DEPTH) {
        return;
      }
      
      this.cur *= 2;
      
      let newcs = [], cs = this.cells, ics = 1.0 / this.cellsize;
      
      for (let ci=0; ci<cs.length; ci += CTOT) {
        for (let i=0; i<4; i++) {
          let x = cs[ci] + (i % 2)*0.5*ics;
          let y = cs[ci+1] + Math.floor(i / 2)*0.5*ics;
          
          let ci2 = newcs.length;
          for (let j=0; j<CTOT; j++) {
            newcs.push(cs[ci+j]);
          }
          
          newcs[ci2] = x;
          newcs[ci2+1] = y;
        }
      }
      
      this.cellsize *= 2.0;
      this.cells = newcs;
      this.celldepth++;
    }
    
    update_cells() {
      let cs = this.cells, ics = 1.0 / this.cellsize, cellsize = this.cellsize;
      let ps = this.points;
      
      let tree = this.regen_spatial();
      let searchr = ics + this.r*1.5;
      
      let newcs = [];
      
      for (let ci=0; ci<cs.length; ci += CTOT) {
        let cx = cs[ci], cy = cs[ci+1];
        let ok = true;
        
        for (let off of _poffs) {
          tree.forEachPoint(cx+ics*0.5+off[0], cy+ics*0.5+off[1], searchr, (pi) => {
            let x = ps[pi]-off[0], y = ps[pi+1]-off[1], r = this.r*1.001; //ps[pi+PR];
            let rsqr = r*r;
            
            let d1 = (x-cx)*(x-cx)         + (y-cy)*(y-cy);
            let d2 = (x-cx-ics)*(x-cx-ics) + (y-cy)*(y-cy);
            let d3 = (x-cx-ics)*(x-cx-ics) + (y-cy-ics)*(y-cy-ics);
            let d4 = (x-cx)*(x-cx)         + (y-cy-ics)*(y-cy-ics);
            
            if (d1 < rsqr && d2 < rsqr && d3 < rsqr && d4 < rsqr) {
              ok = false;
              return true; //stop kdtree iteration
            }
          });
        }
        
        if (ok) {
          for (let i=0; i<CTOT; i++) {
            newcs.push(cs[ci+i]);
          }
        }
      }
      
      this.cells = newcs;
    }
    
    make_cells() {
      var r = this.r;
      var dimen = Math.max(Math.floor(1.5*Math.sqrt(2) / r), 3);
      
      if (SCAN_MODE)
        dimen *= 2;
      
      this.cellsize = dimen;
      this.celldepth = 0;
      
      console.log("cell size:", dimen);
      
      var cells = this.cells = [];
      
      for (var i=0; i<dimen*dimen; i++) {
        var x = i % dimen;
        var y = Math.floor(i / dimen);
        
        let ci = cells.length;
        for (let j=0; j<CTOT; j++) {
          cells.push(0);
        }
        
        cells[ci] = x/dimen;
        cells[ci+1] = y/dimen;
      }
      
      this.update_cells();
      //console.log("cells:", this.cells.length/CTOT);
    }
    
    reset(size, appstate, mask_image) {
      super.reset(size, appstate, mask_image);
      
      this._t = 0;
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
      this.final_r = 1.15 / (Math.sqrt(1.5)*size);
      
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
      let ps = this.points, cells = this.cells, icellsize = 1.0 / this.cellsize;
      let cellsize = this.cellsize;
      
      super.draw(g);
      
      if (!DRAW_CELLS) {
        return;
      }
      
      let pad = this.cells.length/CTOT < 2048 ? 0.05 / this.dimen : 0.0;
      
      g.beginPath();
      for (let ci=0; ci<cells.length; ci += CTOT) {
        let cx = cells[ci], cy = cells[ci+1];
        
        g.rect(cx+pad, cy+pad, icellsize-2*pad, icellsize-2*pad);
      }
      
      g.fillStyle = "rgba(75, 175, 255, 0.5)";
      g.fill();
    }
    
    /*
    //optional
    function raster_point(mi, pi) {
      var mask = this.masks[mi].mask, ps = this.points, msize = this.masks[mi].mask_img.width
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
    
    function raster_mask(mi) {
      var cf = this.config;
      
      this.mask[0] = this.mask[1] = this.mask[2] = 0;
      this.mask[3] = cf.SMALL_MASK ? 255 : 0;
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      var plen = ~~(this.points.length/PTOT);
      
      for (var i=0; i<plen; i++) {
        this.raster_point(mi, i, this.points);
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
      this._t = 0;
      
      //scramble order of first level if pack densely is on
      //*
      
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
      
      this.update_r();
      this.make_cells();
    }
  };
  
  sinterface.MaskGenerator.register(config, DartsGenerator, "DART");
  
  return exports;
});
