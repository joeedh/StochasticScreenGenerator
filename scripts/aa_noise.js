var _aa_noise = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree"
], function(util, cconst, sinterface, vectormath, kdtree) {
  'use strict';
  
  var OX=0, OY=1, OGEN=2, OTOT=3;
  
  var dxdy_rets = new util.cachering(function() {
    return [0, 0];
  }, 256);
  
  function get_id2(ix, iy, p, q, limit, depth) {
    if (depth > 1) return undefined;
    
    depth = depth == undefined ? 0 : depth;
    
    var d = 9;
    var t = (p-q) / (2*q);
    
    var ret1 = dxdy(ix, iy, p, q);
    var mask = 0;
    
    if (ret1[0] > limit || ret1[1] > limit) {
      return undefined;
    }
    
    var mi = 0;
    for (var si=0; si<2; si++) {
      for (var i=-d; i<=d; i++, mi++) {
        var tx1 = 0, ty1 = 0;

        if (si) {
          ty1 += i/d;
        } else {
          tx1 += i/d;
        }

        var ret = dxdy(ix+tx1, iy+ty1, p, q);
        
        if (ret[0] < limit && ret[1] < limit) {
          mi++;
        }
        
        if (ret[0] < limit && ret[1] < limit) {
          var bit = 1 << (mi % 31);
          
          mask = si ? mask ^ bit : mask | bit;
          
          var id2 = get_id(ix+tx1, iy+ty1, p, q, limit, depth+1);
          
          if (id2 != undefined) {
            mask = mask ^ id2;
          }
        }
      }
    }
    
    var offs = cconst.get_searchoff(d);
    for (var i=0; i<offs.length; i++, mi++) {
      break; //XXX
      
      var tx1 = offs[i][0], ty1 = offs[i][1];
      var ret = dxdy(ix+tx1, iy+ty1, p, q);
      
      if (ret[0] < limit && ret[1] < limit) {
        mi++;
      }
      
      if (ret[0] < limit && ret[1] < limit) {
        mask |= 1 << (mi>>1);
      }
      
      continue;
      var a, b;
      
      if (ret[0] > t - ret1[0] && ret[0] < t) {
        mask |= 1<<mi;
      } else if (ret[0] >= 1.0 - ret[0] && ret[0] > 1.0 - t) {
        mask |= 1<<(mi+d*d);
      } else { //impossible
        continue;
      }
    }
    
    window.max_mi = mi;
    
    return mask;
  }
  
  function get_id(ix, iy, p, q, limit, depth) {
    if (depth > 1) return undefined;
    
    depth = depth == undefined ? 0 : depth;
    
    var d = 4;
    var t = (p-q) / (2*q);
    
    var ret1 = dxdy(ix, iy, p, q);
    var mask = 0;
    
    if (ret1[0] > limit || ret1[1] > limit) {
      return undefined;
    }
    
    var mi = 0;
    var offs = cconst.get_searchoff(d);
    for (var i=0; i<offs.length; i++, mi) {
      var tx1 = offs[i][0], ty1 = offs[i][1];
      var ret = dxdy(ix+tx1, iy+ty1, p, q);
      
      if (ret[0] > limit || ret[1] > limit) {
        mi++;
      }
      
      if (ret[0] < limit && ret[1] < limit) {
        mask |= 1 << (mi>>1);
      }
      
      /*
      var id2 = get_id(ix, iy, p, q, limit, depth+1);
      if (id2 != undefined) {
        mask = mask ^ id2;
      }*/
      
      continue;
      var a, b;
      
      if (ret[0] > t - ret1[0] && ret[0] < t) {
        mask |= 1<<mi;
      } else if (ret[0] >= 1.0 - ret[0] && ret[0] > 1.0 - t) {
        mask |= 1<<(mi+d*d);
      } else { //impossible
        continue;
      }
    }
    
    window.max_mi = mi;
    
    return mask;
  }

  window.get_id = get_id;
  
    var F2 = 0.5*(Math.sqrt(3.0)-1.0);
    var G2 = (3.0-Math.sqrt(3.0))/6.0;
    
    function dxdy(ix, iy, p, q) {
      var flipx = ix < 0, flipy = iy < 0;
      
      ix = flipx ? -ix : ix;
      iy = flipy ? -iy : iy;
      
      //*skew
      var s = (ix + iy) * F2;
      
      ix = ix + s;
      iy = iy + s;
      //*/
      
      var dx1 = (p*(ix+1) + q*(iy+1)) % (2*q);
      var dy1 = (q*(ix+1) + p*(iy+1)) % (2*q);
      
      dx1 = flipx ? 2*q - dx1 : dx1;
      dy1 = flipy ? 2*q - dy1 : dy1;
      
      var ret = dxdy_rets.next();
      
      ret[0] = dx1/(2*q);
      ret[1] = dy1/(2*q);
      return ret;
    }
    
    window.dxdy = dxdy;

  //pre-optimized positions are stored in PDX/PDY
  
  /*
  fun patterns:
  
  seed      |  limit
  0.23368   |  0.64119675687
  0.39212   |  0.31364
  0.26552   |  0.39064 // pacman
  0.18780   |  0.64177 // l-tile thingies
  
  0.25018   |  0.23342 //blueish
  0.40461   |  0.20191 //blueish2
  
  0.25018   |  0.21999
  0.25018   |  0.48407
  0.25018   |  0.48306
  
  //hiearchial masks
  0.42265   | 0.76512
  0.25021   | 0.95311
  0.25021   | 0.79639
  
  0.44527   | 0.75831
  0.38358   | 0.64822
  0.53891   | 0.92872

  //winding pattern
  0.57886   | 0.38250
  0.39822   | 0.50743
  
  */
  var exports = _aa_noise = {};
  
  var CDFS = {
    //dummy
    empty : {
    },
    
    a : {
      limit : [0.10000000000000009,3.1,3.1,4.1,3.1,5.1,3.1,3.1,3.1,4.1,3.1,4.1,6.1,3.1,7.1,4.1,7.1,5.1,5.1,4.1,4.1,4.1,4.1,4.1,4.1,3.1,4.1,4.1,4.1,7.1,3.1,15.1,15.1,8.1,6.1,5.1,3.1,5.1,3.1,4.1,3.1,2.1,4.1,4.1,5.1,7.1,7.1,4.1,7.1,5.1,5.1,5.1,8.1,4.1,4.1,6.1,4.1,5.1,7.1,6.1,8.1,6.1,4.1,4.1],
      seed  : [1.1,3.1,3.1,3.1,3.1,3.1,3.1,2.1,5.1,3.1,2.1,7.1,8.1,11.1,11.1,9.1,13.1,13.1,17.1,4.1,3.1,4.1,7.1,5.1,7.1,13.1,8.1,9.1,7.1,4.1,3.1,5.1,4.1,3.1,3.1,7.1,6.1,4.1,4.1,4.1,3.1,2.1,3.1,3.1,3.1,3.1,4.1,3.1,3.1,3.1,2.1,3.1,3.1,3.1,3.1,5.1,3.1,3.1,4.1,6.1,2.1,2.1,4.1,3.1]
    },
    
    progressive : {
      limit : [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,2.1,3.1,2.1,1.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,1.1,0.1,0.1,0.1,0.1,0.1,1.1,2.1,2.1,0.1,2.1,0.1,0.1,2.1,0.1,2.1,2.1,5.1,7.1,10.1,8.1,2.1,0.1,1.1,0.1,2.1,2.1,0.1,4.1,3.1,0.1,2.1,0.1,0.1,0.1,0.1,0.1],
      seed  : [0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,2.1,0.1,0.1,2.1,0.1,3.1,2.1,0.1,2.1,1.1,0.1,0.1,0.1,0.1,1.1,2.1,1.1,0.1,1.1,1.1,2.1,0.1,6.1,5.1,5.1,4.1,3.1,3.1,1.1,1.1,3.1,2.1,0.1,1.1,2.1,0.1,0.1,2.1,0.1,0.1,0.1,0.1,0.1,1.1,0.1,0.1,1.1,0.1,0.1,0.1,0.1,0.1,1.1,0.1,0.1,0.1,1.1,0.1,2.1,1.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,1.1,2.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1]
    }
  }
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var CDF = exports.CDF = Class(Array, [
    function constructor(size) {
      Array.call(this);

      this._random = new util.MersenneRandom(0);
      
      size = size == undefined ? MAX_BIN : size;
      
      this.total = 0;
      var startfill = 0.1;
      
      for (var i=0; i<size; i++) {
        this.push(0.0);
        this.total += startfill;
      }
      
      this.invcdf = new Float64Array(size);
      
      this.pdf = new Float64Array(size);
      this.pdf.fill(startfill, 0, this.pdf.length);
      
      this.normalize();
    },
    
    function seed(seed) {
      this._random.seed(seed);
    },
    
    function toJSON() {
      var ret = [];
      for (var i=0; i<this.pdf.length; i++) {
        ret.push(this.pdf[i]);
      }
      
      return ret;
    },
    
    Class.static(function fromJSON(obj) {
      var ret = new CDF(obj.length);
      ret.total = 0;
      
      for (var i=0; i<obj.length; i++) {
        ret.pdf[i] = obj[i];
        ret.total += obj[i];
      }
      
      ret.normalize();
      
      return ret;
    }),
    
    function add(val, weight) {
      weight = weight == undefined ? 1 : weight;
      
      var x = ~~(val*this.pdf.length*0.99999);
      this.pdf[x] += weight;
      
      
      this.normalize();
    },
   
    function remove(val, weight) {
      weight = weight == undefined ? 1 : weight;
      
      var x = ~~(val*this.pdf.length*0.99999);
      this.pdf[x] -= weight;
      
      
      this.normalize();
    },
    
    function print() {
      var maxcol = 64;
      var maxrow = 16;
      var s = "";
      var dj = Math.ceil(this.length / maxcol);
      
      var maxcdf = 0;
      for (var i=0; i<this.pdf.length; i++) {
        maxcdf = Math.max(maxcdf, this.pdf[i]/this.total);
      }
    
      for (var i=0; i<maxrow; i++) {
        var row = "";
        
        for (var j=0; j<this.length; j += dj) {
          var bin = ~~((this[j])*maxrow*0.9999);
          
          if (bin == i) {
            row += ".";
          } else {
            row += " ";
          }
        }
        
        s += row + "\n";
      }
      
      console.log(s);
    },
    
    function normalize() {
      var sum = 0;
      
      var pdfmin = 1e19;
      for (var i=0; i<this.length; i++) {
        pdfmin = Math.min(pdfmin, this.pdf[i]);
      } 
      //for (var i=0; i<this.length; i++) {
        //pdfmin = Math.min(pdfmin, this.pdf[i]);
        //this.pdf[i] -= pdfmin - 0.1;
      //}
      
      var pdftot = 0;
      for (var i=0; i<this.length; i++) {
        pdftot += this.pdf[i];
      }
      
      this.total = pdftot;
      
      for (var i=0; i<this.length; i++) {
        sum += this.pdf[i]/pdftot;
        
        this[i] = sum;
      }
      
      this.invcdf.fill(-1, 0, this.invcdf.length);
      
      for (var i=0; i<this.length; i++) {
        var x = ~~(this[i]*this.invcdf.length*0.99999);
        
        if (this.invcdf[x] == -1) {
          this.invcdf[x] = i/this.length;
        }
      }
      
      var last = 0;
      var invcdf = this.invcdf;
      
      for (var i=0; i<this.length; i++) {
        if (invcdf[i] == -1) {
          while (i < this.length && invcdf[i] == -1) {
            this.invcdf[i] = last;
            i++;
          }
        }
        
        last = i < this.length-1 ? this.invcdf[i] : -1;
      }
    },
    
    function reset() {
      this.total = 0.1;
      
      for (var i=0; i<this.pdf.length; i++) {
        this.pdf[i] = 0.1;
        this.total += 0.1;
      }
      
      this.normalize();
    },
    
    function random() {
      var f = this._random.extract_number() / (1<<30);
      
      var x = ~~(f*this.length*0.9999999);
      var r = this.invcdf[x];
      
      var f2 = this._random.extract_number() / (1<<30);
      
      return r + 0.25*(f2-0.5)/this.length;
    }
  ]);
  
  var AANoiseGenerator = exports.AANoiseGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this.offsets = new util.hashtable();
            
      if ("bn9_aa_offsets" in localStorage) {
        var offs = JSON.parse(localStorage["bn9_aa_offsets"]);

        window._offs = offs;
        
        for (var i=0; i<offs.length; i += 2) {
          var key = offs[i], val = offs[i+1];
          this.offsets.set(parseInt(key), parseFloat(val));
        }
      }
      
      this.colors = [];
      util.seed(0);
      
      for (var i=0; i<64; i++) {
        this.colors.push([util.random(), util.random(), util.random(), 1.0]);
      }
      
      if ("bn9_aa_cdf" in localStorage) {
        console.log("Loading stored cdf. . .");
        
        var j = JSON.parse(localStorage["bn9_aa_cdf"]);
        this.cdf = CDF.fromJSON(j);
      } else {
        this.cdf = new CDF();
      }
      
      if ("bn9_aa_limit_cdf" in localStorage) {
        console.log("Loading stored cdf. . .");
        
        var j = JSON.parse(localStorage["bn9_aa_limit_cdf"]);
        this.limit_cdf = CDF.fromJSON(j);
      } else {
        this.limit_cdf = new CDF();
      }
      
      
      //seed cdf's internal prng
      var entropy = util.time_ms();
      
      if (Math._random != undefined) {
        entropy += Math._random()*1024;
      } else {
        entropy += Math.random()*1024;
      }
      
      //console.log("SEED", entropy);
      this.cdf.seed(entropy);
      this.limit_cdf.seed(entropy);
      
      this.seed = undefined;
      this.nice = true;
    },
    
    function delete_gens() {
      this._gen_ws = new util.hashtable();
      this._gen_tots = new util.hashtable();
      
      var ps = this.points;
      var offs = this.offsets;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var id = ps[i+PD];
        if (offs.has(id*OTOT+OGEN)) {
          offs.set(id*OTOT+OGEN, -1);
        }
      }
      
      this.apply_offsets();
      this.raster();
      redraw_all();
    },
    
    function delete_offsets() {
      delete localStorage.bn9_aa_offsets;
      
      this.offsets = new util.hashtable();
      this.apply_offsets();
      
      redraw_all();
    },
    
    Class.static(function destroy_all_settings() {
      delete localStorage.bn9_aa_cdf;
      delete localStorage.bn9_aa_limit_cdf;
      delete localStorage.bn9_aa_offsets;
    }),
    
    function save_offsets() {
      var offs = [];
      
      this.offsets.forEach(function(k, v) {
        offs.push(k);
        offs.push(v);
      }, this);
      
      localStorage.bn9_aa_offsets = JSON.stringify(offs);
    },
    
    function reset(dimen, appstate, mask_image) {
      this.dimen1 = dimen;
      
      dimen *= 2;

      if (EXPLORE_AA_LIMIT || EXPLORE_AA_SEED) {
        this.report("\nPress 'R' accept pointset, 'N' too reject it\n");
      }
      
      this.maxgen = 1;
      this.orig_kdtree = new kdtree.KDTree();
      this.relax_first = true;
      
      this._gen_ws = new util.hashtable();
      this._gen_tots = new util.hashtable();
      
      if (EXPLORE_AA_LIMIT) {
        if (this.limit != undefined && this.nice)  {
          this.limit_cdf.add(this.limit);
        } else if (this.limit != undefined && !this.nice) {
          //this.limit_cdf.remove(this.limit);
        }
        
        localStorage["bn9_aa_limit_cdf"] = JSON.stringify(this.limit_cdf.toJSON());
        
        this.limit_cdf.print();
      }
      
      if (EXPLORE_AA_SEED) {
        if (this.seed != undefined && this.nice) {
          this.cdf.add(this.seed);
        } else if (this.seed != undefined && !this.nice) {
          //this.cdf.remove(this.seed);
        }
        
        localStorage["bn9_aa_cdf"] = JSON.stringify(this.cdf.toJSON());
        
        var test_cdf = new CDF();
        for (var i=0; i<128; i++) {
          var r = this.cdf.random();
          test_cdf.add(r);
        }
        
        console.log("CDF VALIDATION (should match distribution):");
        test_cdf.print();
      }
      
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.r = 1.0 / dimen;
      
      this.dimen = dimen;
      this.points = [];
      this.cur = 0;
      
      this.limit = EXPLORE_AA_LIMIT ? this.limit_cdf.random() : AA_LIMIT;
      this.seed = EXPLORE_AA_SEED ? this.cdf.random() : AA_SEED;
      this.nice = true;
      
      /* promising seeds:
      
         0.241006018
         0.474055173800
         0.38144067
         0.439272413
         0.2019
      */
      
      if (EXPLORE_AA_SEED) {
        this.cdf.print();
      }
      
      var base = AA_BASE;
      
      this.p = base;
      this.q = ~~(this.seed*base);
    },
    
    function toggle_timer_loop(appstate, simple_mode) {
      if (appstate.timer != undefined) {
        window.clearInterval(appstate.timer);
        appstate.timer = undefined;
        
        this.report("timer stopped");
        return;
      } 
      
      var this2 = this;
      this.report("starting timer");
      
      appstate.timer = window.setInterval(function() {
        if (this2.cur < this2.dimen*this2.dimen) {
          appstate.step();
          this2.save_offsets();
        } else {
          this2.relax();
        }
        
        redraw_all();
      }, 50);
    },
    
    function next_level() {
      this.nice = false;
      
      if (EXPLORE_AA_SEED || EXPLORE_AA_LIMIT) {
        this.reset(this.dimen1, _appstate, this.mask_img);
      } else {
        this.label_hiearchy();
      }
    },
    
    function step(custom_steps) {
      this.report("points:", this.points.length/PTOT);
      this.report("seed:", this.seed.toFixed(5), "limit:", this.limit.toFixed(5));
      
      var msize = this.mask_img.width;
      var steps = custom_steps ? custom_steps : STEPS;
      var ps = this.points, size = this.dimen;
      
      var seed = this.seed;
      var limit = this.limit;
      
      for (var si=0; si<steps; si++, this.cur++) {
        var pi = ps.length;;
        var cur = this.cur;
        
        if (cur >= size*size) {
          this.report("done generating points", cur);
          break;
        }
        
        var ix = cur % size;
        var iy = ~~(cur / size);
      
        //if (ix == 0 || iy == 0) continue;
        var x = (ix+0.001)/size;
        var y = (iy+0.001)/size;
        
        //var plaque = 3;
        //seed = (~~(x*plaque))/plaque;
        //limit = Math.fract(y*plaque); //(~~(y*plaque))/plaque;
        
        var ix2 = ix;
        var iy2 = iy;
        
        var ret = dxdy(ix, iy, this.p, this.q);
        var dx = ret[0];
        var dy = ret[1];
        
        var ax = 0.5*(ix*seed - iy);
        var ay = 0.5*(ix + iy*seed); 
        
        if ((dx > limit || dy > limit)) {
          continue;
        }

        var id = get_id(ix, iy, this.p, this.q, limit);
        var color = id % this.colors.length;
        
        //create space for point
        for (var j=0; j<PTOT; j++) {
          ps.push(0);
        }
        
        //progressive sampling labeler
        //var gen = Math.min(dx, dy)// + (Math.random()-0.5)*0.3;
        
        var dx2 = dx-0.5, dy2 = dy-0.5;
        
        var gen = (Math.sqrt(dx2*dx2+dy2*dy2+0.000001));
        var gen = Math.min(dx, dy);
        
        /*
        gen = Math.min(Math.max(gen, 0), 0.9999);
        if (gen < 0) 
          gen = Math.random()*0.01;
        else if (gen > 1.0) 
          gen = 1.0 - Math.random()*0.01;
        */
        
        //correction offset labeler
        /*
        var vx = (ax-ix), vy = (ay-iy);
        
        vx = (vx + 50.5);
        vy = (vy + 50.5);
        if (vx < 0 || vy < 0) {
          console.log(vx, vy, "|", ax, ay, ix, iy);
          throw new Error("eek!");
        }
        
        var color = vx*vx + vy*vy;
        */
        
        if (AA_ADD_JITTER) {
          //gen += Math.random()*0.05;
          
          x += Math.random()/size/2;
          y += Math.random()/size/2;
        }
        
        color = ~~(gen*this.colors.length);
        gen = ~~(gen*256);
        
        if (x < 0 || y < 0 || x >= 1.0 || y >= 1.0) continue;
        
        //if (x == 0 && y == 0) continue;
        
        ps[pi] = ps[pi+PDX] = x;
        ps[pi+1] = ps[pi+PDY] = y;
        
        ps[pi+PIX] = ~~(x*msize+0.001);
        ps[pi+PIY] = ~~(y*msize+0.001);
        ps[pi+PR] = this.r;
        ps[pi+PCLR] = color % this.colors.length;
        
        ps[pi+PGEN] = gen; //gen;
        this.offsets.set(id*OTOT+OGEN, gen);
        
        ps[pi+PFLAG] = -1; //flag for if point has been labeled yet, can't use gen
        ps[pi+PD]   = id;
        
        this.maxgen = Math.max(this.maxgen, gen);
        
        this.kdtree.insert(x, y, pi/PTOT);
        this.orig_kdtree.insert(x, y, pi/PTOT);
      }
      
      this.save_offsets();
      this.apply_offsets();
      this.sort();
      
      this.raster();
    },
    
    function draw_cdf(g, cdf, clr) {
      var maxpdf = 0;
      for (var i=0; i<cdf.length; i++) {
        maxpdf = Math.max(maxpdf, cdf.pdf[i]/cdf.total);
      }
      
      var x = -0.5, dx = 0.5 / cdf.length;
      
      g.beginPath();
      
      for (var i=0; i<cdf.length; i++) {
        var f = cdf.pdf[i]/cdf.total/maxpdf;
        var y = 0.5 - f*0.5;

        if (i == 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
        
        x += dx;
      }
      
      g.strokeStyle = clr;
      g.stroke();
      
      g.beginPath();
      x = -0.5;
      for (var i=0; i<cdf.length; i++) {
        var f = cdf[i];
        var y = 0.5 - f*0.5;

        if (i == 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
        
        x += dx;
      }
      
      //g.strokeStyle = "green";
      g.stroke();
    },
    
    function load_cdf(name) {
      if (!(name in CDFS)) {
        throw new Error(name + " not in CDFS!");
      }
      
      if (name == "empty") {
        this.cdf = new CDF();
        this.limit_cdf = new CDF();
      } else {
        this.cdf = CDF.fromJSON(CDFS[name].seed);
        this.limit_cdf = CDF.fromJSON(CDFS[name].limit);
      }
    },

    function apply_offsets() {
      var ps = this.points;
      var offs = this.offsets;
      var msize = this.mask_img.width;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var c = ps[i+PD];
        
        if (this.offsets.has(c*OTOT)) {
          //if (this.offsets.has(c*OTOT+OGEN))
          ps[i+PGEN] = this.offsets.get(c*OTOT+OGEN);
          this.maxgen = Math.max(ps[i+PGEN]+1, this.maxgen);
          
          var dx = this.offsets.get(c*OTOT);
          var dy = this.offsets.get(c*OTOT+1);
          
          ps[i] = ps[i+PDX] + dx/this.dimen;
          ps[i+1] = ps[i+PDY] + dy/this.dimen;
          
          ps[i+PIX] = ~~(ps[i]*msize+0.0001);
          ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
        } else {
          ps[i] = ps[i+PDX];
          ps[i+1] = ps[i+PDY];
          ps[i+PIX] = ~~(ps[i]*msize+0.0001);
          ps[i+PIY] = ~~(ps[i+1]*msize+0.0001);
        }
      }
    },
    
    function jitter(fac) {
        fac = fac == undefined ? 1.0 : fac;
        
        var offs = this.offsets;
        var bl = 0.3;
        
        for (var i=0; i<this.points.length; i += PTOT) {
          var c = this.points[i+PD];
          
          var dx=0, dy=0;
          
          if (offs.has(c*OTOT)) {
            dx = offs.get(c*OTOT);
            dy = offs.get(c*OTOT+1);
          }
          
          var x = this.points[i], y = this.points[i+1];
          
          if (x < bl || x > 1.0 - bl*2 || y < bl || y > 1.0 - bl*2) {
            //continue;
          }
          
          dx += fac*0.1*(Math.random()-0.5)//this.dimen;
          dy += fac*0.1*(Math.random()-0.5)//this.dimen;
          
          offs.set(c*OTOT, dx);
          offs.set(c*OTOT+1, dy);
          
          if (!offs.has(c*OTOT+OGEN))
            offs.set(c*OTOT+OGEN, this.points[i+PGEN]);
          
          this.points[i] = this.points[i+PDX] + dx/this.dimen;
          this.points[i+1] = this.points[i+PDY] + dy/this.dimen;
        }

        this.regen_spatial();

        this.save_offsets();
        this.apply_offsets();
        this.raster();
        
        redraw_all();
    },
    
    function relax() {
      var use_avg_dis = true;
      
      var test_without_offsets = 0;
      
      //initial jitter
      var offs = this.offsets;
      
      //threshold to not affect boundary points
      var bl = 0.2;
      
      if (this.relax_first) {
        this.relax_first = 0;

        for (var i=0; i<this.points.length; i += PTOT) {
          var c = this.points[i+PD];
          
          var dx=0, dy=0;
          if (offs.has(c*OTOT)) {
            continue;
            
            //dx = offs.get(c*OTOT);
            //dy = offs.get(c*OTOT+1);
          }
          
          var x = this.points[i], y = this.points[i+1];
          
          if (x < bl || x > 1.0 - bl || y < bl || y > 1.0 - bl) {
          //  continue;
          }
          
          dx += 1.1*(Math.random()-0.0)//this.dimen;
          dy += 1.1*(Math.random()-0.0)//this.dimen;
          
          offs.set(c*OTOT, dx);
          offs.set(c*OTOT+1, dy);
          
          if (!offs.has(c*OTOT+OGEN))
            offs.set(c*OTOT+OGEN, this.points[i+PGEN]);
          
          this.points[i] = this.points[i+PDX] + dx/this.dimen;
          this.points[i+1] = this.points[i+PDY] + dy/this.dimen;
        }

        this.regen_spatial();
        this.apply_offsets();
        //return;
      }
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 2.5;
      var msize = this.mask_img.width;
      var r = this.r;
      
      if (use_avg_dis) {
        r = this.calc_avg_dis();
      }
      
      var offs = this.offsets;
      var dimen = this.dimen;
      
      var soffs = cconst.get_searchoff(~~(searchfac+2));
      
      for (var i=0; i<plen; i += PTOT) {
        var x = ps[i], y = ps[i+1], r1 = ps[i+PR], c = ps[i+PD];
        var gen1 = ps[i+PGEN];

        if (offs.has(c*OTOT) && !test_without_offsets) {
          var dx1 = offs.get(c*OTOT);
          var dy1 = offs.get(c*OTOT+1);
          
          x = ps[i+PDX] + dx1/dimen;
          y = ps[i+PDY] + dy1/dimen;
        }
        
        var ix = ~~(ps[i+PDX]*this.dimen+0.0001);
        var iy = ~~(ps[i+PDY]*this.dimen+0.0001);
        
        if (use_avg_dis)
          r1 = r;
        
        var searchrad = r1*searchfac;
        var sumtot=0, sumx=0, sumy=0, sumtot2=0;
        
        /*
        for (var j=0; j<soffs.length; j++) {
          var ix2 = soffs[j][0] + ix, iy2 = soffs[j][1] + iy;
          
          if (ix2 == ix && iy2 == iy) {
            continue;
          }
          
          var ret = dxdy(ix2, iy2, this.p, this.q);
          
          if (ret[0] > this.limit || ret[1] > this.limit)
            continue;
          
          var id = get_id(ix2, iy2, this.p, this.q, this.limit);
          
          if (Math.random() > 0.99) {
            console.log(id, ix2, iy2);
          }
          
          var dx=0, dy=0;
          if (offs.has(id*OTOT)) {
            dx = offs.get(id*OTOT);
            dy = offs.get(id*OTOT+1);
          }
          
          var x2 = (ix2 + dx)/dimen, y2 = (iy2 + dy)/dimen;
        
          //console.log("ix iy", ix, iy, ix2, iy2, "|", x, y, x2, y2);
          //if (j > 2) break;
        }*/
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
          
          this.kdtree.forEachPoint(x1, y1, searchrad, function(pi) {
            var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1], r2=ps[pi*PTOT+PR];
            var gen2 = ps[pi*PTOT+PGEN];
            
            x2 -= _poffs[j][0];
            y2 -= _poffs[j][1];
            
            if (use_avg_dis)
              r2 = r;
            
            if (pi == i/PTOT) {
              return;
            }
            
            if (GEN_MASK && gen1 < gen2) {
              return;
            }//*/
            
            var dx = x2-x, dy = y2-y;
            var dis = dx*dx + dy*dy;
            
            if (dis == 0 || dis > searchrad*searchrad) {
              return;
            }
            
            dis = Math.sqrt(dis);
            
            var w = 1.0-dis/searchrad;
            w = w*w*w*w*w*w;
            
            sumx += dx*w;
            sumy += dy*w;
            
            sumtot += w;
            sumtot2++;
         }, this);
        }
        
        var density = sumtot2 != 0 ? sumtot / sumtot2 : 0.0;
        
        if (sumtot != 0) {
          sumx /= sumtot;
          sumy /= sumtot;
        }
        
        x = ps[i] - sumx*0.5*AA_SPEED;
        y = ps[i+1] - sumy*0.5*AA_SPEED;
        
        if (x < bl || x > 1.0-bl*2 || y < bl || y > 1.0 - bl*2) {
        //  continue;
        }
        
        ps[i]   = x;
        ps[i+1] = y;
          
        //ps[i] = Math.fract(ps[i]);
        //ps[i+1] = Math.fract(ps[i+1]);
        //ps[i] = Math.min(Math.max(ps[i], 0), 1);
        //ps[i+1] = Math.min(Math.max(ps[i+1], 0), 1);
        
        //ps[i+PIX] = ~~(ps[i]*msize+0.001);
        //ps[i+PIY] = ~~(ps[i+1]*msize+0.001);
        
        var c = ps[i+PD];
        var dx = (ps[i] - ps[i+PDX])*this.dimen;
        var dy = (ps[i+1] - ps[i+PDY])*this.dimen;
        
        //limit offset
        var l = 5.5;
        
        if (dx*dx + dy*dy > l*l) {
          var l2 = Math.sqrt(dx*dx + dy*dy);
          
          dx *= l/l2;
          dy *= l/l2;
          
          ps[i] = ps[i+PDX] + dx/dimen;
          ps[i+1] = ps[i+PDY] + dy/dimen;
        }
        var df = r*9;
        
        this.kdtree.remove(i/PTOT);
        this.kdtree.insert(ps[i], ps[i+1], i/PTOT);
        
        //if (/*!test_without_offsets &&*/ Math.abs(dx) <= l && Math.abs(dy) <= l) {
        if (1) { //ps[i] > bl && ps[i] < 1.0-bl*2 && ps[i+1] > bl && ps[i+1] < 1.0 - bl*2) {
          offs.set(c*OTOT, dx);
          offs.set(c*OTOT+1, dy);
          
          if (!offs.has(c*OTOT+OGEN))
            offs.set(c*OTOT+OGEN, ps[i+PGEN])
        }
        //}
      }
      
      this.save_offsets();
      
      if (!test_without_offsets) {
        this.apply_offsets();
      }
      
      this.raster();
    },
    
    function label_hiearchy() {
      return; //unused
      
      var use_avg_dis = true;
      
      var test_without_offsets = 0;
      
      //initial jitter
      var offs = this.offsets;
      
      //threshold to not affect boundary points
      var bl = 0.2;
      
      var plen = this.points.length;
      var ps = this.points;
      var searchfac = 3;
      var msize = this.mask_img.width;
      var r = this.r;
      
      if (use_avg_dis) {
        r = this.calc_avg_dis();
      }

      var tots = this._gen_ws;
      var ws = this._gen_tots;
      
      var offs = this.offsets;
      
      for (var si=0; si<15; si++) {
        var offs = this.offsets;
        var dimen = this.dimen;
        
        var soffs = cconst.get_searchoff(~~(searchfac+2));
        var maxweight = -1, maxweight2 = -1, maxpi = -1, maxpi2 = -1;
        
        for (var i=0; i<plen; i += PTOT) {
          var x = ps[i], y = ps[i+1], r1 = ps[i+PR], c = ps[i+PD];
          var gen1 = ps[i+PGEN];

          //if (x < bl || x > 1.0-bl || y < bl || y > 1.0 - bl) {
          //  continue;
          //}
          
          if (ps[i+PFLAG] >= 0) continue;
          //if (ps[i+PGEN] >= 0) continue;
          
          var ix = ~~(ps[i+PDX]*this.dimen+0.0001);
          var iy = ~~(ps[i+PDY]*this.dimen+0.0001);
          
          if (use_avg_dis)
            r1 = r;
          
          var searchrad = r1*searchfac;
          var sumtot=0, sumx=0, sumy=0, sumtot2=0;
          
          for (var j=0; j<_poffs.length; j++) {
            var x1 = x + _poffs[j][0], y1 = y + _poffs[j][1];
            
            this.kdtree.forEachPoint(x1, y1, searchrad, function(pi) {
              var x2 = ps[pi*PTOT], y2 = ps[pi*PTOT+1], r2=ps[pi*PTOT+PR];
              var gen2 = ps[pi*PTOT+PGEN];
              
              if (ps[pi*PTOT+PFLAG] >= 0) return;
              if (ps[pi*PTOT+PGEN] >= 0) return;
              
              if (use_avg_dis)
                r2 = r;
              
              if (pi == i/PTOT) {
                return;
              }
              
              if (GEN_MASK && gen1 < gen2) {
                //return;
              }//*/
              
              var dx = x2-x1, dy = y2-y1;
              var dis = dx*dx + dy*dy;
              
              if (dis == 0 || dis > searchrad*searchrad) {
                return;
              }
              
              dx += 2*Math.random()/this.dimen;
              dy += 2*Math.random()/this.dimen;
              dis = dx*dx + dy*dy;
              
              dis = Math.sqrt(dis);
              
              var w = 1.0 - dis/searchrad;
              //w = w != 0.0 ? Math.sqrt(w) : 0.0;
              w = w <= 0 ? 0 : Math.pow(w, 0.5);
              
              sumtot += w;
              sumtot2++;
           }, this);
          }
          
          c = ps[i+PD];
          var density = sumtot//sumtot2 != 0 ? sumtot / sumtot2 : 0.0;
          
          if (tots.has(c*OTOT+OGEN)) {
            var d = ws.get(c*OTOT+OGEN);
            var tot = tots.get(c*OTOT+OGEN);
            
            ws.set(c*OTOT+OGEN, d+density)
            tots.set(c*OTOT+OGEN, tot+1);
            
            density = (density+d) / (tot+1);
          } else {
            ws.set(c*OTOT+OGEN, density);
            tots.set(c*OTOT+OGEN, 1);
          }
          
          if (density > maxweight) {
            var id = ps[i+PD], g1=-1;
            
            if (offs.has(id*OTOT+OGEN)) {
              g1 = offs.get(id*OTOT+OGEN);
            }
            
            maxweight = density;
            maxpi = i/PTOT;
          }
        }
        
        console.log("max pi:", maxpi, maxweight);
        
        if (maxweight < 0) {
          continue;
        }
        
        var pi = maxpi*PTOT;
        var gen = this.maxgen++;
        ps[pi+PGEN] = gen;
        
        var id = ps[pi+PD];
        
        //ensure we have full record
        if (!offs.has(id*OTOT)) {
          offs.set(id*OTOT,   0);
          offs.set(id*OTOT+1, 0);
        }
        
        offs.set(id*OTOT+OGEN, gen);
        
        //flag point as done
        ps[pi+PFLAG] = 1;
      } 
      
      this.save_offsets();
      this.apply_offsets();
      this.sort();
      this.raster();
    },
        
    function draw(g) {
      g.beginPath();
      g.rect(-0.5, 0, 0.5, 0.5);
      var cdf = EXPLORE_AA_LIMIT ? this.limit_cdf : this.cdf;
      
      if (EXPLORE_AA_SEED)
        this.draw_cdf(g, this.cdf, "green");
      
      if (EXPLORE_AA_LIMIT)
        this.draw_cdf(g, this.limit_cdf, "orange");
    },
    
    function max_level() {
      return this.maxgen;
    },
    
    function current_level() {
      return 0;
    },
    
    function regen_spatial() {
      redraw_all();
      
      var plen = this.points.length/PTOT;
      var ps = this.points;
      
      this.orig_kdtree = new kdtree.KDTree();
      this.kdtree = new kdtree.KDTree();
      
      for (var pi=0; pi<plen; pi++) {
        this.kdtree.insert(ps[pi*PTOT], ps[pi*PTOT+1], pi);
        this.orig_kdtree.insert(ps[pi*PTOT+PDX], ps[pi*PTOT+PDY], pi);
      }
    },
    
  ]);
  
  return exports;
});
