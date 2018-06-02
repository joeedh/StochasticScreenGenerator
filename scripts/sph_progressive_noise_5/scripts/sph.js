var _sph = undefined;

define([
  "./util", "./vectormath", "./kdtree", "./const", "./linear_algebra", "./smoothmask",
  "./solver"
], function(util, vectormath, kdtree, cconst, linalg, smoothmask, solver) {
  "use strict";
  let exports = _sph = {};
  
  let gridoffs = cconst.gridoffs;
  
  function torusPointDist(x1, y1, x2, y2) {
    let dx = Math.min(Math.abs(x1-x2), Math.abs(x1-x2+1));
    dx = Math.min(dx, Math.abs(x1-x2-1));
    let dy = Math.min(Math.abs(y1-y2), Math.abs(y1-y2+1));
    dy = Math.min(dy, Math.abs(y1-y2-1));

    return Math.sqrt(dx*dx + dy*dy);
  }

  window.torusPointDist = torusPointDist;

  let Solver = exports.Solver = class Solver {
    constructor(sph, params, ranges) {
      this.sph = sph;
      this.params = params;
      this.ranges = ranges;
    }
    
    calcDistance(ctx, points, lvl) {
      let ps1 = this.points, ps2 = points;
      let sum = 0.0;
      
      for (let pi=0; pi<ps1.length; pi += PTOT) {
        sum += torusPointDist(ps1[pi], ps1[pi+1], ps2[pi], ps2[pi+1]);
      }
      
      return sum;
    }
    
    calcMaskError(ctx, origpoints) {
      let range = ctx.SOLVER_RANGE;
      ctx = ctx.copy();
      
      let error = 0.0;
      
      let time = util.time_ms();
      
      for (let i=0; i<range; i++) {
        if (util.time_ms() - time > 700) {
          console.log("step", i+1, "of", range);
          time = util.time_ms();
        }
        
        let gen = i / (range - 1);
        
        this.loadPoints(origpoints);
        this.makeLevelUniform(ctx, gen);
        
        let totpoints = 0;
        for (let pi=0; pi<origpoints.length; pi += PTOT) {
          totpoints += origpoints[pi+PGEN] <= gen;
        }
        
        error += this.calcDistance(ctx, origpoints, gen) / (1 + totpoints);
      }
      
      return error/origpoints.length/PTOT*10000000;
    }
    
    loadPoints(points) {
      this.points = points.slice(0, points.length);
      return this;
    }
    
    unloadPoints(points) {
      points.length = this.points.length;
      
      for (let i=0; i<points.length; i++) {
        points[i] = this.points[i];
      }
      
      return points;
    }
    
    levelSPHStep(ctx) {
      ctx = ctx.copy();
      ctx.SIMPLE_MODE = true;
      
      let ps = this.points;
      let tree = this.sph.makeKDTree(ctx);
      
      let totpoint = 0;
      let lvl = ctx.SOLVE_LEVEL;
      
      for (let pi1=0; pi1<this.points.length; pi1 += PTOT) {
        let gen = ps[pi1+PGEN];
        
        totpoint += gen <= lvl;
      }
      
      if (totpoint == 0) {
        console.warn("Solver.leverlSPHStep(): No points!");
        return;
      }
      
      let r = 0.95 / Math.sqrt(ps.length/PTOT*0.05 + totpoint);
      let searchfac = ctx.SOLVER_SEARCHRAD;
      let speed = ctx.SOLVER_SPEED*0.15;
      
      let sumdx, sumdy, sumw, sumtot, x1, y1, r1, gen1, searchr, off, pi1;
      
      let callback = (pi2) => {
        if (pi2 == pi1)
          return;
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN];
        
        let dx = -(x2 - x1 - off[0]), dy = -(y2 - y1 - off[1]);
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0) {
          sumdx += dx;
          sumdy += dy;
          sumw += 1.0;
          sumtot += 1.0;
          
          return;
        }
        
        if (dis > searchr*searchr) {
          return;
        }
        
        dis = Math.sqrt(dis);
        
        let w = 1.0 - dis/searchr;
        w *= w*w;
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1;
      }
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        x1 = ps[pi1], y1 = ps[pi1+1], r1 = ps[pi1+PR], gen1=ps[pi1+PGEN];
        
        if (gen1 > ctx.SOLVE_LEVEL) {
          continue;
        }
        
        sumdx = sumdy = sumw = sumtot = 0;
        searchr = r*searchfac;
        
        for (off of gridoffs) {
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);
        }
        
        if (sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        ps[pi1] += sumdx*speed;
        ps[pi1+1] += sumdy*speed;
        
        ps[pi1] = Math.fract(ps[pi1]);
        ps[pi1+1] = Math.fract(ps[pi1+1]);
      }
    }
    
    makeLevelUniform(ctx, lvl) {
      ctx = ctx.copy();
      ctx.SOLVE_LEVEL = lvl;
      
      for (let i=0; i<ctx.SOLVER_STEPS; i++) {
        this.levelSPHStep(ctx);
      }
    }
  }

  function* calcError(sph, ctx, full_solve, screenreport) {
      let slv = new Solver(sph);
      
      util.seed(cconst.SOLVER_RANDSEED);
      
      if (full_solve) {
        let time = util.time_ms();
        
        function doreport(i, ilen) {
          if (util.time_ms() - time > 700) {
            console.log("doing", i+1, "of", ilen);
            
            if (screenreport) {
              _appstate.report(`doing ${i+1} of ${ilen}`);
            }
            
            time = util.time_ms();
          }
        }
        
        function report(msg) {
          console.log(msg);

          if (screenreport) {
            _appstate.report(msg);
          }
        }

        ctx = ctx.copy();
        
        //reset
        sph.reset(sph.dimen);

        //make sure we aren't in too random of a starting point
        for (let i=0; i<5; i++) {
          sph.step(ctx);
          yield 1;
        }
        
        let startps = sph.points.slice(0, sph.points.length);
        
        //figure out speed
        let speed = 0.1;
        let r = 0.95 / Math.sqrt(sph.points.length/PTOT);
        
        let lastgood = speed, sum;
        let lastsum = 0;
        let isteps=10;
        for (let i=0; i<isteps; i++) {
          doreport(i, isteps);
          
          sph.points = startps.slice(0, startps.length);
          ctx.SPH_SPEED = speed;
          sph.step(ctx);
          
          let ps = sph.points;
          sum = 0.0;
          for (let pi=0; pi<startps.length; pi += PTOT) {
            sum += torusPointDist(ps[pi], ps[pi+1], startps[pi], startps[pi+1]);
          }
          sum /= startps.length/PTOT;
          
          if (sum > r*0.0425*1.5*ctx.SOLVER_STARTSPEED_THRESH) {
            speed = lastgood;
            //sum = lastsum;
            break;
          }
          
          lastsum = sum;
          lastgood = speed;
          speed *= 1.525;
          
          yield 1;
        }
        
        sph.points = startps.slice(0, startps.length);

        report("Speed: " + speed.toFixed(5) + " Divergence: " + sum.toFixed(5) + " r: " + r.toFixed(5));
        
        window.shufflespeed = speed;
        
        for (let i=0; i<ctx.SOLVER_NORMAL_STEPS; i++) {
          doreport(i, ctx.SOLVER_NORMAL_STEPS);

          sph.step(ctx);
          yield 1;
        }
      }

      yield slv.calcMaskError(ctx, sph.points);
  }
  
  //"optional" fract
  function optfract(f) {
    //return Math.fract(f);
    return f;
  }
    
  function calcradius(gen, maxgen, ctx) {
    let a = ctx.RADMUL / Math.sqrt(1 + maxgen);
    let b = a*ctx.MAX_SCALE;
    
    gen = Math.min(Math.max(gen, 0.0), 1.0)*0.99999999;
    
    let f = 1.0 - gen;
    
    if (ctx.RADIUS_CURVE !== undefined && ctx.RADIUS_CURVE.evaluate !== undefined) {
      f = ctx.RADIUS_CURVE.evaluate(f);
    }

    return a + (b - a)*f;
    
    return ctx.RADMUL / Math.sqrt(1 + gen*maxgen);
  }
  
  let SPH = exports.SPH = class SPH {
    constructor(dimen) {
      this.reset(dimen);
    }
    
    loadJSON(obj) {
      this.points = obj.points;
      
      return this;
    }
    
    toJSON() {
      return {
        points : this.points,
        dimen  : this.dimen
      };
    }
    
    reset(dimen) {
      util.seed(cconst.SOLVER_RANDSEED);
      
      this.cmyk_tick = 0;
      this.dimen = dimen;
      this.points = [];
      this.totpoint = 0;
      this.tick = 0;
      this.r = 0;
      this.totbase = 0.0;
      this.maxgen = 1.0;
      
      this.cur_r = 0;
      this.cur_t = (cconst.RANGE-1) / cconst.RANGE;
      this.cur_t_i = cconst.RANGE-1;
      
      this.throw();
    }
    
    throw() {
      let totpoint = Math.ceil(this.dimen*this.dimen*0.95);
      let ps = this.points;
      
      let genstart = totpoint*cconst.GENSTART;
      
      let dimen2 = Math.floor(Math.sqrt(totpoint));
      this.r = undefined;

      for (let i=0; i<totpoint; i++) {
        let ix = i % dimen2, iy = ~~(i / dimen2);
        let x = ix/dimen2, y = iy/dimen2;

        //let x = util.random(), y = util.random();

        let rfac = cconst.RANDFAC;
        
        x += (util.random()-0.5)/dimen2*rfac;
        y += (util.random()-0.5)/dimen2*rfac;
        x = Math.fract(x);
        y = Math.fract(y);

        let pi = ps.length;
        for (let j=0; j<PTOT; j++) {
          ps.push(0.0);
        }
        
        let gen = Math.fract(ix*3.3234 + iy*0.539 + util.random()*0.05);
        //gen = util.random();
        
        gen = Math.max(gen-cconst.GENSTART, 0)/(1.0 - cconst.GENSTART);
        ps[pi+POGEN] = gen;
        
        gen = 1.0 - cconst.TONE_CURVE.evaluate(1.0 - gen);
        gen = Math.floor(gen*cconst.GENSTEPS)/cconst.GENSTEPS;

        ps[pi] = ps[pi+POLDX] = ps[pi+PSTARTX] = x;
        ps[pi+1] = ps[pi+POLDY] = ps[pi+PSTARTY] = y;

        ps[pi+PGEN] = gen;
        //let gi = ~~(gen * totpoint);
        let gi = i;
        
        ps[pi+PCLR] = gi % 4;
      }
      
      this.calcRadii(cconst);
    }
    
    makeKDTree(ctx) {
      let kd = this.kdtree = new kdtree.KDTree([-2.5, -2.5, -2.5], [2.5, 2.5, 2.5]);
      
      let ps = this.points;
      let co = [0, 0, 0];
      let visit = {};
      let totpoint = 0;

      while (totpoint < ps.length/PTOT) {
        let pi = ~~(util.random()*0.999999*ps.length/PTOT);
        if (pi in visit) {
          continue;
        }
        
        totpoint++;
        visit[pi] = 1;
        pi *= PTOT;

        if (ctx.SIMPLE_MODE && (ps[pi+PGEN]) > ctx.SOLVE_LEVEL) {
          continue;
        }
        
      //for (let pi=0; pi<ps.length; pi += PTOT) {
        kd.insert(ps[pi], ps[pi+1], pi);
      }
      
      return kd;
    }

    updateVelocity(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let fac = ctx.DV_DAMPING;
        let dx, dy, mindv=1e17;

        //calc derivatives.  complicated by toroidal domain
        for (let off of gridoffs) {
          let dx2 = ps[pi] - (ps[pi+POLDX] + off[0]);
          let dy2 = ps[pi+1] - (ps[pi+POLDY] + off[1]);
          let dis = dx2*dx2 + dy2*dy2;
          
          if (dis < mindv) {
            mindv = dis;
            ps[pi+PDX] = dx2;
            ps[pi+PDY] = dy2;
          }
        }
        
        ps[pi+PDX] *= fac;
        ps[pi+PDY] *= fac;
        
        ps[pi+POLDX] = ps[pi];
        ps[pi+POLDY] = ps[pi+1];
      }
    }
    
    applyVelocity(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      let ps = this.points;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        ps[pi] += ps[pi+PDX];
        ps[pi+1] += ps[pi+PDY];
        
        ps[pi] = optfract(ps[pi]);
        ps[pi+1] = optfract(ps[pi+1]);
      }
    }
        
    jitter() {
      let ps = this.points;
      let size = this.r;
      
      for (let i=0; i<ps.length; i += PTOT) {
        ps[i] += (util.random()-0.5)*2.0*size;
        ps[i+1] += (util.random()-0.5)*2.0*size;
        
        ps[i] = Math.min(Math.max(ps[i], 0.0), 1.0);
        ps[i+1] = Math.min(Math.max(ps[i+1], 0.0), 1.0);
      }
    }
    
    calcRadii(ctx) {
      let ps = this.points;
      
      //cumulative distribution function (histogram) for 
      //calculating point radius from modified (non-linear) gen threshold
      let cdf = new Float64Array(1024);
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let gen = ps[pi+PGEN];
        let ci = ~~(gen * cdf.length * 0.9999999);
        
        cdf[ci]++;
      }
      
      for (let i=1; i<cdf.length; i++) {
        cdf[i] += cdf[i-1];
      }
      
      let maxgen = cdf[cdf.length-1];
      this.maxgen = maxgen;
            
      for (let pi=0; pi<ps.length; pi += PTOT) {
          let gen = ps[pi+PGEN];
          let ci = ~~(gen*cdf.length*0.9999999);

          let r = calcradius(cdf[ci]/maxgen, maxgen, ctx);
          ps[pi+PR] = r;
      }

      this.r = this.cur_r = calcradius(1.0, maxgen, ctx);
    }

    shuffleGen(ctx, randfac, full_solve, screenreport) {
      randfac *= ctx.SOLVER_RANDFAC;
      
      let config = ctx.copy();
      let this2 = this;
      
      let do_all = !config.SOLVER_IN_SERIES;
      let params = {};
      
      if (ctx.SOLVER_PARAM_WEIGHT != 0) {
        for (let i=ctx.SOLVER_PARAM_MIN; i<=ctx.SOLVER_PARAM_MAX; i++) {
          if (i == 5)
            continue;
          
          let key = "PARAM" + i;
          params[key] = ctx.SOLVER_PARAM_WEIGHT;
        }
      }
      
      if (ctx.SOLVER_SEARCHRAD_WEIGHT != 0) {
        params["SEARCHRAD"] = ctx.SOLVER_SEARCHRAD_WEIGHT;
      }
      
      if (ctx.SOLVER_MAXSCALE_WEIGHT != 0) {
        params["MAX_SCALE"] = ctx.SOLVER_MAXSCALE_WEIGHT;
      }
      
      let list = [];
      for (let k in params) {
        list.push(k);
      }
      
      if (do_all) {
        for (let i=0; i<list.length; i++) {
          let k = list[i], v = params[k];
          
          config[k] += (Math.random()-0.5)*randfac*v;
          config[k] = Math.max(config[k], 0.000001);
        }
      } else {
        let ri = ~~(Math.random()*list.length*0.999999);
        
        //do both of these together
        if (list[ri] == "SEARCHRAD" || list[ri] == "MAX_SCALE") {
          config.SEARCHRAD += (Math.random()-0.5)*randfac*config.SOLVER_SEARCHRAD_WEIGHT;
          config.MAX_SCALE += (Math.random()-0.5)*randfac*config.SOLVER_MAXSCALE_WEIGHT;
          
          config.SEARCHRAD = Math.max(config.SEARCHRAD, 0.25);
          config.MAX_SCALE = Math.max(config.MAX_SCALE, 0.25);
        } else {
          let k = list[ri], v = params[k];
          
          config[k] += (Math.random()-0.5)*randfac*v;
          config[k] = Math.max(config[k], 0.0);
        }
      }
      
      window.shuffleconfig = config.copy();
      
      return (function*() {
        for (let val of this2.calcErrorGen(config, full_solve, screenreport)) {
          yield val;
        }
      })();
      
      /*
      return (function* () {
        yield * this2.calcError(ctx, full_solve, screenreport);
      })();*/
    }
    
    calcErrorGen(ctx, full_solve, screenreport) {
      ctx = ctx === undefined ? cconst : ctx;

      return calcError(this, ctx, full_solve, screenreport);
    }

    calcError(ctx, full_solve, screenreport) {
      ctx = ctx === undefined ? cconst : ctx;
      let val;
      
      for (val of calcError(this, ctx, full_solve, screenreport)) {
      }
      
      return val;
    }
    
    step(ctx) {
      ctx = ctx === undefined ? cconst : ctx;
      
      this.cmyk_tick++;
      
      
      let ps = this.points;
      let searchfac = ctx.SEARCHRAD;
      let cmyk_searchfac = ctx.CMYK_SEARCHRAD;

      let ct = Math.min(this.cmyk_tick / 64, 1.0);
      
      cmyk_searchfac += (0.6 - cmyk_searchfac) * (1.0 - ct);

      this.ct = cmyk_searchfac.toFixed(3);
      
      let x1, y1, r1, sumdx, sumdy, sumw, sumtot, searchr, gen1, off, pi1, color1, sumcolorw, sumcolortot;
      let sumcmyk = [0, 0, 0, 0], sumcolor=0;
      
      let max_r = undefined;
      
      ctx = ctx.copy();
      ctx.SIMPLE_MODE = false;
      ctx.ADV_SOLVE = false;
      
      this.calcRadii(ctx);
      
      let tree = this.makeKDTree(ctx);
      let tot = ps.length / PTOT;
      
      if (tot == 0) {
        return;
      }
      
      let calcweight = (w, r1, r2, gen1, gen2) => {
        /*
        if (gen1 < gen2) {
          return 0.0;
        } else {
          return ctx.SPH_CURVE.evaluate(w); //Math.pow(w, 4.0);
        }
        //*/
        
        /*
        off factor;
        off period;
        
        k1 := 1;
        k2 := 2;
        k3 := 3;
        k4 := 1;
        k5 := 1;
        d := 0.0;
        
        g1 := gen1 - gen2 + 1.0;
        g2 := (gen2+d) / (gen1+d);
        g1 := g1**k1;
        g2 := g2**k4;
        
        fw := w; comment: 1.0 - dis/searchr;
        fw := fw**(g2*k2 + k3);
        fw := fw*(g1*k5 + 1.0-k5);
        
        */
        let g1 = gen1 - gen2 + 1.0;
        let g2 = (gen2+0.0001) / (gen1+0.0001);
        
        //g = Math.pow(g, ctx.PARAM1 + Math.pow(1.0-gen1, ctx.PARAM3)*ctx.PARAM2);
        g1 = Math.pow(g1, ctx.PARAM1);
        g2 = Math.pow(g2, ctx.PARAM4);
        
        //w *= 0.00001+g*dis;
        //w = g/dis;
        //w *= -g;
        
        //w += g*ctx.PARAM2;
        //w *= g+ctx.PARAM2;
        w = Math.pow(w, g2*ctx.PARAM2 + ctx.PARAM3);
        w *= g1*ctx.PARAM5 + 1.0 - ctx.PARAM5;
        
        if (gen1 < gen2) {
          w *= ctx.PARAM6;
          w = Math.pow(w, ctx.PARAM7);
        }
        //w *= Math.pow(g, ctx.PARAM1);
        return w;
      } 
           
      let callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN], color2 = ps[pi2+PCLR];
        
        let dx = x2-x1-off[0];
        let dy = y2-y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0 || dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        w = calcweight(w, r1, r2, gen1, gen2);

        //w = ctx.SPH_CURVE.evaluate(w);
        
        dx /= dis;
        dy /= dis;
        
        sumdx += dx*w;
        sumdy += dy*w;
        sumw += w;
        sumtot += 1.0;
      }

      let cmyk_callback = (pi2) => {
        if (pi1 == pi2) {
          return;
        }
        
        let x2 = ps[pi2], y2 = ps[pi2+1], r2 = ps[pi2+PR], gen2 = ps[pi2+PGEN], color2 = ps[pi2+PCLR];
        
        let dx = x2 - x1-off[0];
        let dy = y2 - y1-off[1];
        
        let dis = dx*dx + dy*dy;
        
        if (dis == 0.0 || dis >= searchr*searchr) {
          return;
        }
        
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
        let w = 1.0 - dis/searchr;
        
        w = calcweight(w, r1, r2, gen1, gen2);
        w *= w*w;
        
        sumcolor += color2*w;
        sumcmyk[color2] += w;
        
        sumcolorw += w;
        sumcolortot += 1.0;
      }

      let fac = ctx.SPH_SPEED*0.5;// * 0.45;
      
      for (let pi=0; pi<ps.length; pi += PTOT) {
        let r1 = ps[pi+PR];
        
        max_r = max_r === undefined ? r1 : Math.max(max_r, r1);
      }
      
      let swaps = [[], [], [], []];
      let bins = [[], [], [], []];
          
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        sumdx = sumdy = sumw = sumtot = sumcolor = sumcolorw = sumcolortot = 0.0;
        
        for (let i=0; i<4; i++) {
          sumcmyk[i] = 0;
        }
        
        x1 = ps[pi1], y1 = ps[pi1+1], r1 = ps[pi1+PR], gen1 = ps[pi1+PGEN], color1 = ps[pi1+PCLR];
        
        //searchr = (r1+max_r)*0.5*searchfac;
        
        for (off of gridoffs) {
          //searchr = max_r*searchfac;
          searchr = r1*searchfac;
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, callback);

          //searchr = max_r*cmyk_searchfac;
          searchr = r1*cmyk_searchfac;
          tree.forEachPoint(x1+off[0], y1+off[1], searchr, cmyk_callback);
        }
        
        if (sumtot == 0.0 || sumw == 0.0) {
          continue;
        }
        
        sumdx /= sumw;
        sumdy /= sumw;
        
        let fac2 = Math.pow(1.0 - r1/max_r, 2.0) + 0.125;
        fac2 *= 0.5;
        fac2 = 0.1;
        
        ps[pi1] += -sumdx*fac2*fac;
        ps[pi1+1] += -sumdy*fac2*fac;
        
        if (sumcolorw == 0.0) {
          continue;
        }

        if (sumcolor / sumcolorw >= 4) {
          throw new Error("sumcolor corruption");
        }

        sumcolor = (~((sumcolor + color1) / (sumcolorw + 1))) % 4;
        //sumcolor = (~~(sumcolor / sumcolorw)) % 4;
        
        let mini=0, maxi=0, minc=0, maxc=0;
        
        for (let i=0; i<4; i++) {
          sumcmyk[i] /= sumcolortot;
          
          if (i==0 || sumcmyk[i] > maxc) {
            maxc = sumcmyk[i];
            maxi = i;
          }
          
          if (i == 0 || sumcmyk[i] < minc) {
            minc = sumcmyk[i];
            mini = i;
          }
        }
        
        //mini = sumcolor;
        if (mini != color1) {
          swaps[mini].push(pi1);
          bins[mini].push(pi1);
        }
        //if (color1 != sumcolor) {
        //  swaps[sumcolor].push(pi1);
        // bins[color1].push(pi1);
        //}
      }

      for (let i=0; i<4; i++) {
        swaps[i].sort();
        bins[i].sort();
      }
      
      //for (let )
      let steplen = swaps[0].length + swaps[1].length + swaps[2].length + swaps[3].length;
      for (let step=0; step<steplen; step++) {
        let i = ~~(util.random()*3.999999);
        
        for (let i2=0; i2<swaps[i].length; i2++) {
          let pi1 = swaps[i][i2];
          let rj = ~~(util.random()*2.999999);
          let j = (i + rj) % 4;
          
          j = ps[pi1+PCLR];
          
          if (j == undefined) {
            throw new Error("eek!");
          }

          if (swaps[j].length == 0) {
            continue;
          }
          
          let k;
          for (k=0; k<swaps[j].length; k++) {
            if (ps[swaps[j][k]+PCLR] == i) {
              break;
            }
          }

          if (k == swaps[j].length) {
            continue;
          }
          
          let pi2 = swaps[j][k];
          
          let t = ps[pi1+PCLR];
          ps[pi1+PCLR] = i;//ps[pi2+PCLR];
          ps[pi2+PCLR] = j;//t;
          
          //remove from lists
          swaps[i][i2] = swaps[i][swaps[i].length-1];
          swaps[j][k] = swaps[j][swaps[j].length-1];

          swaps[i].pop();
          swaps[j].pop();

          i2--;
        }
      }
      //console.log(swaps);
      
      for (pi1=0; pi1<ps.length; pi1 += PTOT) {
        ps[pi1] = Math.fract(ps[pi1]);
        ps[pi1+1] = Math.fract(ps[pi1+1]);
        
        ps[pi1+PSTARTX] = ps[pi1];
        ps[pi1+PSTARTY] = ps[pi1+1];
      }
    }
  }
  
  return exports;
});










