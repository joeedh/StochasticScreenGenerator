var _mitchell = undefined;

define([
  "util", "const", "interface", "fft"
], function(util, cconst, sinterface, fft) {
  'use strict';
  
  var exports = _mitchell = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CX=0, CY=1, CGIDX=2, CTOT=3;
  var GDEAD=0, GCI=1, GPI=2, GW=3, GTOTW=4, GDIS=5, GTOT=6;
  
  let config = exports.config = {
    DRAW_CELLS            : false,
    DRAW_RADII            : false,
    MITCHELL_TOTPOINT_MUL : 0.85,
    MITCHELL_RADMUL       : 0.75,
    MITCHELL_GENSTART     : 0.05,
    MITCHELL_POISSON_TEST : true,
    MITCHELL_FILTERWID : 4.0,
    MITCHELL_STEPSMUL   : 2.0,
    MITCHELL_BRIGHTNESS : 1.0,
    MITCHELL_RAD_CURVE : new cconst.EditableCurve("Mitchell Radius Curve", {"is_new_curve":true,"setting_id":"bn9_gui2_Mitchell_Radius CurveMITCHELL_RAD_CURVE","generators":[{"type":1,"points":[{"0":0,"1":0,"eid":12,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"deg":6,"eidgen":{"_cur":19}},{"type":2,"equation":"(exp(-(1.0-x)*4.0)-0.0183)/(1.0183)"},{"type":4,"height":1,"offset":1,"deviation":0.3}],"version":0.5,"active_generator":1}), 
    //MITCHELL_CURVE     : new cconst.EditableCurve("Mitchell Filter Curve", {"points":[{"0":0,"1":0,"eid":1,"flag":0,"deg":3,"tangent":1},{"0":0.4187500000000002,"1":0.012499999999999956,"eid":42,"flag":0,"deg":3,"tangent":1},{"0":0.6125000000000002,"1":0.08750000000000013,"eid":43,"flag":1,"deg":3,"tangent":1},{"0":0.8124999999999999,"1":0.13749999999999996,"eid":37,"flag":0,"deg":3,"tangent":1},{"0":0.95,"1":0.9000000000000001,"eid":45,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1},{"0":1,"1":1,"eid":3,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":46}}),
    MITCHELL_GEN_CURVE : new cconst.EditableCurve("Mitchell Tone Curve", {"points":[{"0":0.025000000000000022,"1":0,"eid":1,"flag":1,"deg":3,"tangent":1},{"0":1,"1":1,"eid":2,"flag":0,"deg":3,"tangent":1}],"eidgen":{"_cur":28}})
  };
  
  let calcradius = exports.calcradius = function calcradius(gen, maxpoints, ctx) {
    let minr = MITCHELL_RADMUL / Math.sqrt(maxpoints + 1);
    let maxr = MITCHELL_RADMUL / Math.sqrt(ctx.MITCHELL_GENSTART*maxpoints + 1);
    
    let f = 1.0 - gen;
    f = ctx.MITCHELL_RAD_CURVE.evaluate(f);
    
    return minr + (maxr - minr) * f;
    /*
    let rgen = gen*(1.0 - ctx.MITCHELL_GENSTART) + ctx.MITCHELL_GENSTART;
    rgen = ctx.MITCHELL_RAD_CURVE.evaluate(rgen);
    rgen *= maxpoints;
    
    let r = MITCHELL_RADMUL / Math.sqrt(rgen+1);
    //r = ctx.MITCHELL_RAD_CURVE.evaluate(r/maxr)*maxr;
    
    return r;
    //*/
  }
  
  var MitchellGenerator = exports.MitchellGenerator = class MitchellGenerator extends MaskGenerator {
    constructor(appstate, dilute_small_mask) {
      super(appstate, dilute_small_mask);
      
      this.level_r_decay = 1;
      this.draw_rmul = 1;
      this.level = 0;
      this._decay = 1.0;
    }
    
    static build_ui(gui) {
      let panel2 = gui.panel("Mitchell");
      
      panel2.slider('MITCHELL_FILTERWID', 'Filter Width', 2.0, 0.0001, 15.0, 0.001, false, false);
      panel2.slider('MITCHELL_BRIGHTNESS', 'Brightness', 2.0, 0.0001, 5.0, 0.001, false, false);
      panel2.slider('MITCHELL_STEPSMUL', 'Extra Steps', 1.0, 0.0001, 35.0, 0.001, false, false);
      panel2.slider('MITCHELL_TOTPOINT_MUL', 'TotalPointMul', 1.0, 0.0001, 1.0, 0.00001, false, false);
      panel2.slider('MITCHELL_GENSTART', 'genstart', 0.05, 0.004, 0.999, 0.0001, false, false);
      panel2.slider('MITCHELL_RADMUL', 'radmul', 0.75, 0.004, 3.0, 0.0001, false, false);
      
      panel2.check('MITCHELL_POISSON_TEST', "Poisson Mode");
      
      panel2.check('DRAW_CELLS', "Draw Cells");
      panel2.check('DRAW_RADII', "Draw Radii");
      
      let panel3;
      //panel3 = panel2.panel("Filter Curve");
      
      //need to finish config refactor so I'm not putting things in window in such a hackish way as this
      //window.MITCHELL_CURVE = panel3.curve("MITCHELL_CURVE", "Filter Curve", cconst.DefaultCurves.MITCHELL_CURVE).curve;
      //panel3.close();
      
      panel3 = panel2.panel("Pre-tone Curve");
      window.MITCHELL_GEN_CURVE = panel3.curve("MITCHELL_GEN_CURVE", "Tone Curve", cconst.DefaultCurves.MITCHELL_GEN_CURVE).curve;
      panel3.close();
      
      panel3 = panel2.panel("Radius Curve");
      window.MITCHELL_RAD_CURVE = panel3.curve("MITCHELL_RAD_CURVE", "Mitchell Radius Curve", cconst.DefaultCurves.MITCHELL_RAD_CURVE).curve;
      panel3.close();
      
      panel2.close();
    }
    
    current_level() {
      return 0;
    }
    
    done() {
      return this._done;
    }
    
    max_level() {
      return this.maxgen;
    }
    
    draw_grid(g) {
      if (!ALIGN_GRID)
        return;
      
      var ctx = this.config;
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
    
    draw_cells(g) {
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
    
    draw_radii(g, offx=0, offy=0) {
      let ps = this.points;

      let r = calcradius(ps.length/PTOT/this.maxpoints, this.maxpoints, this.config);

      for (let pi=0; pi<ps.length; pi += PTOT) {
        let x = ps[pi]+offx, y = ps[pi+1]+offy;

        g.beginPath();

        g.moveTo(x, y);
        g.arc(x, y, r, -Math.PI, Math.PI);
        
        g.fillStyle = "rgba(255, 175, 45, 0.3)";
        g.fill();
        
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r*0.5, -Math.PI, Math.PI);
        
        g.fillStyle = "rgba(255, 175, 45, 0.3)";
        g.fill();
      }
    }

    draw(g) {
      super.draw(g);
      
      if (ALIGN_GRID) {
        this.draw_grid(g);
      }
      
      if (DRAW_RADII) {
        if (DRAW_TILED) {
          for (let off of _poffs) {
            this.draw_radii(g, off[0], off[1]);
          }
        } else {
          this.draw_radii(g);
        }
      }

      if (DRAW_CELLS) {
        this.draw_cells(g);
      }
    }
    
    makeCells(ctx) {
      let dimen = this.dimen;
      let r = calcradius(1, this.maxpoints, ctx);
      r = r == 0.0 ? 0.01 : r;
      
      let csize = this.cellsize = Math.max(Math.ceil(2 / r), 4);
      let cells = this.cells = new Array(csize*csize*CTOT);

      let cgrid = this.cellgrid = new Float64Array(csize*csize*GTOT);
      
      cgrid.fill(0, 0, cgrid.length);
      cells.fill(0, 0, cells.length);
      
      for (let i=0; i<csize*csize; i++) {
        let ix = i % csize, iy = ~~(i / csize);
        
        let ci = i*CTOT;
        let gi = i*GTOT;

        cells[ci] = ix/csize;
        cells[ci+1] = iy/csize;
        
        cells[ci+CGIDX] = gi;
        
        cgrid[gi+GCI] = ci;
        cgrid[gi+GPI] = -1;
      }
      
      return this;
    }
    
    updateCells(ctx, pi) {
      //return;
      let cells = this.cells, ps = this.points;
      let cgrid = this.cellgrid;
      
      let x = ps[pi], y = ps[pi+1];
      
      let offx, offy, x1, y1, ci, ok;
      
      let totpoint = ps.length/PTOT;
      let r = calcradius(0.9999, this.maxpoints, ctx);
      
      let searchr = r*3;
      let tree = this.kdtree; //kdtree would have been updated in step() already
      let csize = this.cellsize, icsize = 1.0 / csize;
      
      function dis(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
      }
      
      let coversCell = (x1, y1, pi, offx, offy) => {
        let ok2 =    dis(x1+offx,        y1+offy, x, y) <= r;
        ok2 = ok2 && dis(x1+offx+icsize, y1+offy, x, y) <= r;
        ok2 = ok2 && dis(x1+offx+icsize, y1+offy+icsize, x, y) <= r;
        ok2 = ok2 && dis(x1+offx,        y1+offy, x, y) <= r;
        
        return ok2;
      };
      
      let testCell = (ci, pi, offx, offy) => {
        if (coversCell(cells[ci], cells[ci+1], pi, offx, offy)) {
          cgrid[cells[ci+CGIDX] + GDEAD] = 1;
          
          if (cells.length == CTOT) {
            cells.length = 0;
            return;
          }
          
          let ci2 = cells.length - CTOT;

          for (let j=0; j<CTOT; j++) {
            cells[ci+j] = cells[ci2+j];
          }
          
          cells.length -= CTOT;
          
          if (cells.length > 0) {
            //update the cell we swapped's grid pointer
            cgrid[cells[ci + CGIDX] + GCI] = ci;
          }
        }
      }
      
      let rd = ~~(searchr * csize + 1);
      
      let offs = cconst.get_searchoff(rd);
      
      x = ps[pi], y = ps[pi+1];
      let ix = ~~(x*csize);
      let iy = ~~(y*csize);
      
      for (let off1 of offs) {
        let ix2 = ix + off1[0], iy2 = iy + off1[1];
        
        let offx, offy;

        if (ix2 < 0) {
          offx = -1.0;
          ix2 += csize;
          //continue;
        } else if (ix2 >= csize) {
          offx = 1.0;
          ix2 -= csize;
          //continue;
        } else {
          offx = 0.0
        }
        
        if (iy2 < 0) {
          offy = -1.0;
          iy2 += csize;
          //continue;
        } else if (iy2 >= csize) {
          offy = 1.0;
          iy2 -= csize;
          //continue;
        } else {
          offy = 0.0
        }
        
        if (offx != 0 || offy != 0) {
          continue;
        }

        let gidx = (iy2*csize + ix2)*GTOT;
        if (cgrid[gidx+GDEAD]) {
          continue;
        }
        
        ok = false;
        testCell(cgrid[gidx+GCI], pi, offx, offy);
      }
    }
    
    subdivideCells(ctx) {
      this.subdivided++;
      
      let cells = this.cells;
      let cgrid = this.grid;
      let csize = this.cellsize, csize2 = csize*2;
      let ps = this.points;
      
      let cgrid2 = new Float64Array(csize2*csize2*GTOT);
      let cells2 = [];
      
      cgrid2.fill(0, 0, cgrid2.length);
      for (let gi=0; gi<cgrid2.length; gi += GTOT) {
        cgrid2[gi+GPI] = -1;
        cgrid2[gi+GDEAD] = 1;
      }
      
      for (let ci=0; ci<cells.length; ci += CTOT) {
        let x = cells[ci], y = cells[ci+1];
        let gi = cells[ci+CGIDX];
        
        let ix = (gi/GTOT) % csize, iy = ~~((gi/GTOT) / csize);
        //let ix = ~~(x*csize+0.0001), iy = ~~(y*csize+0.00001);

        for (let i=0; i<4; i++) {
          let offx = i % 2, offy = ~~(i / 2);
          let ix2 = ix*2 + offx, iy2 = iy*2 + offy;
          let x2 = ix2/csize2, y2 = iy2/csize2;
          
          let gi2 = (iy2*csize2 + ix2)*GTOT;
          
          let ci2 = cells2.length;
          for (let j=0; j<CTOT; j++) {
            cells2.push(0);
          }
          
          cells2[ci2] = x2;
          cells2[ci2+1] = y2;
          cells2[ci2+CGIDX] = gi2;
          
          cgrid2[gi2+GDEAD] = 0;
          cgrid2[gi2+GCI] = ci2;
        }
      }
      
      this.cells = cells2;
      this.cellgrid = cgrid2;
      this.cellsize = csize2;

      for (let pi=0; pi<ps.length; pi += PTOT) {
        this.updateCells(ctx, pi);
      }
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        this.updateGrid(ctx, pi);
      }
    }
    
    getSearchRad(ctx) {
      let ps = this.points
      let r = calcradius(ps.length/PTOT/this.maxpoints, this.maxpoints, ctx);
      
      return r*ctx.MITCHELL_FILTERWID;
    }

    updateGrid(ctx, pi) {
      let searchr = this.getSearchRad(ctx);
      let ps = this.points, cells = this.cells, cgrid = this.cellgrid;
      let csize = this.cellsize;

      let x = ps[pi], y = ps[pi+1];
      let ix = ~~(x*csize), iy = ~~(y*csize);

      let rd = ~~(searchr * csize + 2);
      let offs = cconst.get_searchoff(rd);

      for (let off of offs) {
        let ix2 = ix + off[0], iy2 = iy + off[1];
        let x2 = (ix2 + 0.0)/csize, y2 = (iy2 + 0.0) / csize;

        let dis = Math.sqrt((x-x2)*(x-x2) + (y-y2)*(y-y2));

        if (dis > searchr) {
          continue;
        }

        //let w = 1.0 - dis/searchr;
        //w = ctx.MITCHELL_CURVE.evaluate(w);

        if (ix2 < 0) ix2 += csize;
        else if (ix2 >= csize) ix2 -= csize;
        if (iy2 < 0) iy2 += csize;
        else if (iy2 >= csize) iy2 -= csize;

        //ix2 = (ix2+csize) % csize;
        //iy2 = (iy2+csize) % csize;

        let gidx = (iy2*csize + ix2)*GTOT;
        if (cgrid[gidx+GPI] < 0 || dis < cgrid[gidx+GDIS]) {
          cgrid[gidx+GDIS] = dis;
          cgrid[gidx+GPI] = pi;
        }

        //cgrid[gidx+GW] = w;
        //cgrid[gidx+GTOTW] += 1.0;
        //}
      }
    }
    
    next_level() {
      this.subdivideCells(this.config);
    }
    
    reset(size, appstate, mask_image) {
      super.reset(size, appstate, mask_image);
      
      util.seed(0);
      
      this.subdivided = 0;
      this.maxgen = 0.0;
      this.dimen = size;
      this._done = false;
      
      let totpoint = this.totpoint = ~~(size*size*this.config.MITCHELL_TOTPOINT_MUL);
      this.maxpoints = totpoint;
      
      //this.final_r = this.r = Math.sqrt(0.5 / (Math.sqrt(3)*2*totpoint));
      this.final_r = this.r = calcradius(1.0, totpoint, this.config);
      
      this.makeCells(this.config);
    }
    
    step(custom_steps) {
      let steps = custom_steps ? custom_steps : STEPS;
      steps = Math.min(steps, 256);
      
      let ps = this.points;
      let size = this.dimen;
      
      let ctx = this.config;
      let searchfac = ctx.MITCHELL_FILTERWID;
      
      let totpoint = ps.length / PTOT;
      let r;
      
      if (totpoint >= this.maxpoints) {
        this._done = true;
        return;
      }
      
      let sumw, sumtot, x1, y1, r1, mindis, found, off, searchr, minw;
      
      let callback = (pi2) => {
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PD];
        
        let dx = (x1+off[0]) - x2;
        let dy = (y1+off[1]) - y2;
        
        let lsqr = dx*dx + dy*dy;
        
        mindis = Math.min(mindis, lsqr);
        
        let dis = lsqr != 0.0 ? Math.sqrt(lsqr) : 0.0;
        
        let w = Math.max(1.0 - dis/searchr, 0.0);
        
        //let fi = 1.0 - ps.length/PTOT/this.maxpoints;
        //fi *= fi;
        //fi = fi != 0.0 ? Math.sqrt(fi) : fi;
        
        w = ctx.MITCHELL_CURVE.evaluate(w);
        
        //w = Math.pow(w, 1.0 + 6.0*fi); //*0.75 + Math.pow(w, 4.0)*0.25;

        sumw += w;
        sumtot++;
        
        //having the poisson test here helps with performance
        let pr = r//calcradius((ps.length/PTOT+1)/this.maxpoints, this.maxpoints, ctx);//r;
        
        if (ctx.MITCHELL_POISSON_TEST && lsqr < pr*pr) {
          found = true;
          return true; //stop kdtree iteration
        }
      };
      let cw = this.mask_img.width;
      let ch = this.mask_img.height;
      
      for (let si=0; si<steps; si++) {
        totpoint = ps.length / PTOT;
        
        if (totpoint >= this.maxpoints) {
          break;
        }
        
        //generation number used to display value in mask
        let gen = (ps.length/PTOT + 1)/this.maxpoints;
        
        if (gen < 0 || gen > 1.0) {
          throw new Error("Gen was: " + gen);
        }
        
        this.maxgen = this.maxpoints;
                
        let maxdis = -1e17, x=undefined, y=undefined;
        let totcell = this.cells.length / CTOT;
        let tries = ~~(totcell*ctx.MITCHELL_STEPSMUL)+1;//30;
        let maxr = calcradius(1.0, this.maxpoints, ctx);
        
        //r = calcradius(gen, this.maxpoints, ctx);
        r = calcradius(ps.length/PTOT/this.maxpoints, this.maxpoints, ctx);
        searchr = this.getSearchRad(ctx);

        minw = undefined;

        let cells = this.cells, cgrid = this.cellgrid;
        let csize = this.cellsize, icsize = 1.0 / csize;
        let rd = ~~(searchr * csize + 2);
        let offs = cconst.get_searchoff(rd);
        
        if (cells.length == 0) {
          console.warn("no cells");
          return;
        }
        let ix, iy;
        
        if (this.points.length/PTOT > this.maxpoints*0.5 && this.subdivided==0) {
          this.subdivideCells(ctx);
        }
        
        for (let sj=0; sj<tries; sj++) {
          let ci = (~~(util.random()*(cells.length/CTOT)*0.99999))*CTOT;
          
          x1 = cells[ci] + util.random()*icsize;
          y1 = cells[ci+1] + util.random()*icsize;
          
          let pi = ps.length;

          found = false;
          mindis = 1e17;
          sumw=0, sumtot=0;
          
          ix = ~~(x1*csize*0.9999), iy = ~~(y1*csize*0.9999);
          let gidx = (iy*csize + ix)*GTOT;
          
          //sumw = cgrid[gidx+GTOTW] == 0 ? 0 : cgrid[gidx+GW] / cgrid[gidx+GTOTW];
          sumw = cgrid[gidx+GPI] < 0 ? rd/this.dimen : cgrid[gidx+GDIS];
          
          let pr = this._decay*ctx.MITCHELL_RADMUL / Math.sqrt(this.points.length/PTOT + this.maxpoints*ctx.MITCHELL_GENSTART);
          if (ctx.MITCHELL_POISSON_TEST && cgrid[gidx+GPI]>=0 && cgrid[gidx+GDIS] < pr) {
            this._decay *= 0.999;
            continue;
          }

          this._decay = 1.0;
          
          //x=x1;
          //y=y1;
          //break;

          for (off of _poffs) {
            /*
            for (let pi3=0; pi3<ps.length; pi3 += PTOT) {
              let dx = ps[pi3] - x1 - off[0], dy = ps[pi3+1] - y1 - off[1];
              
              if (dx*dx + dy*dy < searchr*searchr) {
                callback(pi3);
              }
            }
            //*/
            
            //this.kdtree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);
          }
          
          
          if (found) {
            continue;
          }
          
          //if (sumtot == 0.0) continue;
          /*
          if (sumtot != 0.0)
            sumw /= sumtot;
          //*/
          
          if (isNaN(sumw)) {
            throw new Error("NaN");
          }
          
          if (minw === undefined || sumw > minw) {
            minw = sumw;
          //if (mindis > maxdis) {
            //maxdis = mindis;
            x = x1;
            y = y1;
          }
        }
        
        if (x === undefined) {
          continue;
        }
        
        let pi = ps.length;
        for (let i=0; i<PTOT; i++) {
          ps.push(0);
        }
        
        ps[pi] = x;
        ps[pi+1] = y;

        //gen will be set in tonePoints()
        //ps[pi+PGEN] = gen;

        ps[pi+PR] = ps[pi+PR2] = r;
        ps[pi+PD] = ps[pi+POGEN] = pi/PTOT; //real generation number
        
        ix = ~~(x*csize), iy = ~~(y*csize);
        
        this.updateGrid(ctx, pi);
        this.kdtree.insert(ps[pi], ps[pi+1], pi); 
        
        //this.kdtree.balance();
        this.find_mask_pixel(0, pi);
        this.updateCells(ctx, pi);
      }
      
      this.report("Total points:", this.points.length/PTOT, "of", this.maxpoints);
      
      this.regen_spatial(ctx);
      
      this.raster();
      this.tonePoints();
    }
    
    tonePoints() {
      let ps = this.points;
      let ctx = this.config;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+POGEN]/this.maxgen;
        let d = 0.3; //stupid hack to fix cut off error
        
        ps[pi+PGEN] = ctx.MITCHELL_GEN_CURVE.evaluate(gen)*this.maxgen*MITCHELL_BRIGHTNESS;
      }
    }
    
    raster() {
      this.tonePoints();
      super.raster();
    }
  };
  
  sinterface.MaskGenerator.register(config, MitchellGenerator, "MITCHELL", 4);

  return exports;
});
