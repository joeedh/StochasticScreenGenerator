/*
all pattern generators are required to 
distribute brightness values linearly,
such that there is area/255 black pixels and 1 white pixel.
*/
var _aa_noise = undefined;

define([
  "util", "const", "interface", "vectormath", "kdtree", "void_cluster",
  "aa_hex", "aa_simple", "aa_simple_hex", "aa_types", "aa_simple_2", "cz"
], function(util, cconst, sinterface, vectormath, kdtree, void_cluster,
            aa_hex, aa_simple, aa_simple_hex, aa_types, aa_simple_2, cz) 
{
  'use strict';

  var exports = _aa_noise = {};
  
  var test_unique_ids = 0;
  
  var Generators = exports.Generators = {
    aa_simple     : new aa_simple.SimpleGen(),
    aa_hex        : new aa_hex.HexGen(),
    aa_simple_hex : new aa_simple_hex.SimpleHexGen(),
    aa_really_simple : new aa_simple.ReallySimpleGen(),
    aa_simple_2 : new aa_simple_2.SimpleGen()
  };
  
  var GENERATOR = exports.GENERATOR = Generators.aa_simple_2;
  
  var OX=0, OY=1, OGEN=2, OTOT=3;
  var test_without_offsets = 0;

  var dxdy_rets = new util.cachering(function() {
    return [0, 0, 0];
  }, 256);
  
  var LEVEL_STEPS = 255
  var seedrand = new util.MersenneRandom();
  seedrand.seed(0);
  
  var seeds = [], muls = [];
  for (var i=0; i<LEVEL_STEPS*3; i++) {
    seeds.push(~~(seedrand.random()*(1<<24)));
    muls.push(~~(seedrand.random()*(1<<17)));
  }
  
  var LARGE_PRIME = 2147483249; //~(1<<31)
  
  var IXY=0, IID=1, ITOT=2;
  
  var IDCache = exports.IDCache = util.Class([
    function constructor(size) {
      size = size == undefined ? 4096 : size;
      
      this.max_used_id = 1;
      this.size = size;
      this.cache = new Int32Array(size*size);
      this.cache.fill(-1, 0, this.cache.length);
      
      this.id_xymap = {};
      this.id_users_min = 1e17;
      this.id_users_max = -1e17;
      this.id_users_avg = 0;
      this._id_users_avg = 0;
      this.id_users_avg_tot = 0;
      
      //XXX uses too much memory
      //this.ids = [];
      
      this.min = [-256, -256];
      this.max = [size-256, size-256];
      this.length = 0;
      
      //stores how many positions an id was found at
      this.usedmap = {};
    },
    
    function reset() {
      this.length = 0;

      this.id_xymap = {};
      this.id_users_min = 1e17;
      this.id_users_max = -1e17;
      this.id_users_avg = 0;
      this._id_users_avg = 0;
      this.id_users_avg_tot = 0;
      
      this.usedmap = {};
      this.cache.fill(0, 0, this.cache.length);
      this.max_used_id = 1;
    },
    
    function toJSON() {
      var c = this.cache;
      
      var fields = ["packed_xy", "geoid"];
      
      //XXX uses too much memory
      var data = []; //new Int32Array(this.ids.length);
      var ids = []; //this.ids;
      
      for (var i=0; i<ids.length; i++) {
        data[i] = ids[i];
      }
      
      var chars = new Uint8Array(data.buffer);
      var len1 = chars.length;
      
      /*
      chars = cz.compress(chars);
      console.log(":", len1, chars.length, (chars.length/len1).toFixed(3));
      
      var buf = "";
      for (var i=0; i<chars.length; i++) {
        buf += String.fromCharCode(chars[i]);
      }*/
      
      return {
        size   : this.size,
        min    : this.min,
        max    : this.max,
        //data   : this.ids,
        //buf    : buf,
        length : this.length,
        datafields : fields
      }
    },
    
    util.Class.static(function fromJSON(obj) {
      var ret = new IDCache(obj.size);
      var d = obj.data, totfield = obj.datafields.length;
      
      if (totfield <= 0 || isNaN(totfield)) {
        throw new Error("bad totfield " + totfield + "!");
      }
      
      for (var i=0; i<d.length; i += totfield) {
        var idx = d[i], id = d[i+1];
        var ix = idx % obj.size, iy = ~~(idx / obj.size);
        
        ix += obj.min[0];
        iy += obj.min[1];
        
        ret.set(ix, iy, id);
      }
      
      return ret;
    }),
    
    function set(ix, iy, id) {
      ix = ~~ix, iy = ~~iy; //paranoia check
      
      ix -= this.min[0];
      iy -= this.min[1];
      var size = this.size;
      
      if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
        console.log("Eek! Out of cache bounds!", size, ix, iy);
        return;
      }
      
      var key = iy*size + ix;
      
      if (!(id in this.id_xymap)) {
        this.id_xymap[id] = new util.set();
        this.id_users_avg_tot++;
      }
      
      var set = this.id_xymap[id];
      
      this._id_users_avg -= set.length;
      set.add(key);
      this._id_users_avg += set.length;

      this.id_users_avg = this._id_users_avg / this.id_users_avg_tot;
      
      this.id_users_min = Math.min(this.id_users_min, set.length);
      this.id_users_max = Math.max(this.id_users_max, set.length);
      
      if (key < 0 || id < 0) {
        throw new Error("invalid data in idcache.get! " + key + " " + ix + " " + iy);
      }
      
      if (!(id in this.usedmap)) {
        this.usedmap[id] = 1;
      }
      
      if (this.cache[key] < 0) {
        this.length++;
        
        this.usedmap[id]++;
        this.max_used_id = Math.max(this.max_used_id, this.usedmap[id]);
        //XXX uses too much memory
        //this.ids.push(key);
        //this.ids.push(id);
      }
      
      this.cache[key] = id;
    },
    
    function get(ix, iy) {
      ix = ~~ix, iy = ~~iy; //paranoia check
      
      ix -= this.min[0];
      iy -= this.min[1];
      var size = this.size;
      
      if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
        console.log("Eek! Out of cache bounds!", size, ix, iy);
        return undefined;
      }
      
      var key = iy*size + ix;
      var ret = this.cache[key];
      
      return ret < 0 ? undefined : ret;
    },
    
    util.Class.static(function test() {
      var cache = new IDCache();
      var bad = false;
      var data = [];
      
      bad = bad || cache.get(22, 33) != undefined;
      
      for (var i=0; i<5; i++) {
        var x = i % 16, y = ~~(i / 16);
        var id = (x*235 + y*2354 + x*y*42) % 1024;
        
        cache.set(x, y, id);
        bad = bad || cache.get(x, y) != id;
        
        console.log(x, y, id, cache.get(x, y));
        data.push([x, y, id]);
      }
      
      cache = IDCache.fromJSON(JSON.parse(JSON.stringify(cache)));
      console.log("");
      
      for (var i=0; i<data.length; i++) {
        bad = bad || cache.get(data[i][0], data[i][1]) != data[i][2];
        
        console.log(data[i][0], data[i][1], data[i][2], cache.get(data[i][0], data[i][1]));
      }
      
      console.log(cache);
      console.log(bad ? "bad!" : "success");
      
      return !bad;
    })
  ]);
  
  exports.id_cache = new IDCache();

  var SpatialGrid = exports.SpatialGrid = util.Class(IDCache, [
    //size is optional, see IDCache constructor
    function constructor(size) {
       IDCache.call(this, size);
       
       this.id_xymap = {};
    },
    
    function set(ix, iy, finalx, finaly, id) {
      var size = this.size;
      var key = iy*size + ix;
      var xymap = this.id_xymap;
      
      if (!(id in xymap)) {
        xymap[id] = {};
      }
      
      var submap = xymap[id];
      if (key in submap) {
        
      }
    }
  ]);
  
  function id_cache_get(ix, iy) {
    return exports.id_cache.get(ix, iy);
  }
  
  function id_cache_set(ix, iy, id) {
    exports.id_cache.set(ix, iy, id);
  }
  
  var get_id = exports.get_id = function get_id(ix, iy, size, seed, limit, depth) {
    if (test_unique_ids) {
      ix = ~~ix + 1024;
      iy = ~~iy + 1024;
      
      return iy*2048 + ix;
    }
    
    var max_depth = 0;
    
    if (depth > 0) return undefined;

    depth = depth == undefined ? 0 : depth;
    
    //lookup in cache
    if (max_depth == 0) {
      var ret = id_cache_get(ix, iy);
      if (ret != undefined) {
        return ret;
      }
    }
    
    var ret1 = dxdy(ix, iy, size, AA_SEED);
    if (ret1 == undefined) return undefined;
    
    var mask = 0;
    var childmask = 0;
    
    var mi = 0;
    var d = 1;
    var offs = cconst.get_searchoff_norand(d);
    var nmask = 0; //neighborhood mask
    
    for (var i=0; i<offs.length; i++, mi) {
      var tx1 = offs[i][0], ty1 = offs[i][1];
      var ret = dxdy(ix+tx1, iy+ty1, size, AA_SEED);
      
      if (ret == undefined)
        continue;
      
      var lvl = ~~(ret[2]*LEVEL_STEPS);
      mask = (mask*muls[lvl] + seeds[lvl]) % LARGE_PRIME;
      
      var submask = get_id(ix, iy, size, seed, limit, depth+1);
      if (submask != undefined) {
        nmask ^= submask;
      }
      
      nmask = nmask < 0 ? -nmask : nmask;
    }
    
    if (depth >= max_depth-1) {
      mask = nmask != 0 ? mask ^ nmask : mask;
    }
    
    mask = mask < 0 ? -mask : mask;
    
    if (depth == 0) {
      if (Math.random() > 0.999) {
        console.log("set id...", ix, iy, mask);
      }
      id_cache_set(ix, iy, mask);
    }
    
    return mask;
  }
  window.maxmask = 0;
  
  window.get_id = get_id;
  
    var F2 = 0.5*(Math.sqrt(3.0)-1.0);
    var G2 = (3.0-Math.sqrt(3.0))/6.0;
  
  //p and q are ignored for now . . .  
  var dxdy = exports.dxdy = function dxdy(ix, iy, size, seed) {
    /*
      //for hex...
      size = 128;
      return aa_hex.dxdy(ix/size, iy/size, size, p, q);
    */
    
    //ix += ~~(DIMEN*AA_PAN_X);
    //iy += ~~(DIMEN*AA_PAN_Y);
    
    return GENERATOR.dxdy(ix, iy, size, seed);
  }
  
  function dxdy_old(ix, iy, p, q) {
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
      
      var dx = ret[0] = dx1/(2*q);
      var dy = ret[1] = dy1/(2*q);
      
      var gen = Math.min(dx, dy);
      ret[2] = gen;
      
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
  
  window._AA_MAX_OFFSET_LEN = 6;
  window._AA_MAX_OFFSET_SEARCH = 7; //_AA_MAX_OFFSET_LEN;
  window._AA_MASK_INTERVAL = 5;
  window._AA_RELAX_STEPS = 16;
  window._AA_MASSIVE_DOMAIN = 1024; //size of domain used by relax2(), it randomly samples it.
  window._AA_TEST_ONLY_DOMAIN = false;
  
  var AANoiseGenerator = exports.AANoiseGenerator = Class(MaskGenerator, [
    Class.getter(function dilute_small_mask() {
      return false;
    }),
    Class.setter(function dilute_small_mask(val) {
      //do nothing
    }),
    
    function load_offsets(json) {
      this.offsets = util.IntHash.fromJSON(json);
    },
    
    function constructor(appstate) {
      MaskGenerator.call(this, appstate, false);
    
      this.adjmap = new SpatialGrid();
      
      this.relax2_visit = undefined;
      this.pass = 0;
      
      this.offsets = new util.IntHash(OTOT);
            
      if ("bn9_aa_offsets" in localStorage) {
        var offs = JSON.parse(localStorage["bn9_aa_offsets"]);
        this.offsets = util.IntHash.fromJSON(offs);
        
        window._offs = offs;
      }
      
      if ("bn9_aa_idcache" in localStorage) {
        //var idcache = JSON.parse(localStorage.bn9_aa_idcache);
        //exports.id_cache = IDCache.fromJSON(idcache);
      }
      
      this.colors = [];
      util.seed(0);
      
      for (var i=0; i<128; i++) {
        //this.colors.push([i/128, i/128, i/128, 1.0]);
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
      console.trace("deprecation error: delete_gens called");
      return;
      
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
      
      //delete localStorage.bn9_aa_idcache;
      //exports.id_cache = new IDCache();
      
      this.offsets = new util.IntHash(OTOT);
      this.apply_offsets();
      
      redraw_all();
    },
    
    Class.static(function destroy_all_settings() {
      delete localStorage.bn9_aa_cdf;
      delete localStorage.bn9_aa_limit_cdf;
      delete localStorage.bn9_aa_offsets;
      //delete localStorage.bn9_aa_idcache;
    }),
    
    function export_offsets() {
      var offs = {
        offs     : this.offsets.toJSON(),
        func     : ""+GENERATOR.dxdy,
        aa_seed  : AA_SEED,
        aa_limit : AA_LIMIT
      };
      
      var offs = JSON.stringify(offs);
      var blob = new Blob([offs], {type : "application/x-octet-stream"});
      var url = URL.createObjectURL(blob);
      
      window.open(url);
    },
    
    function save_offsets() {
      if (!this.config.AA_USE_OFFSETS) {
        return;
      }
      
      var offs = this.offsets.toJSON();
      
      //localStorage.bn9_aa_idcache = JSON.stringify(exports.id_cache);
      localStorage.bn9_aa_offsets = JSON.stringify(offs);
    },
    
    function reset(dimen, appstate, mask_image) {
      this.dimen1 = dimen;
      
      this.relax2_visit = new util.set(); //new util.IntHash(1);
      
      //dimen *= 2;

      if (EXPLORE_AA_LIMIT || EXPLORE_AA_SEED) {
        this.report("\nPress 'R' accept pointset, 'N' too reject it\n");
      }
      
      this.totfilled = 0;
      this.maxgen = 1;
      this.orig_kdtree = new kdtree.KDTree();
      this.relax_first = true;
      
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
      
      //this.voidcluster = new void_cluster.VoidClusterGenerator(appstate);
      //this.voidcluster.ignore_initial_points = true;
      //this.voidcluster.reset.apply(this.voidcluster, arguments);
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
        this.raster();
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
      
      var size2 = ~~(size*1.5);
      var pad = ~~((size2-size)*0.5+0.5);
      
      for (var si=0; si<steps; si++, this.cur++) {
        var pi = ps.length;
        var cur = this.cur;
        
        if (cur >= size2*size2) {
          this.report("done generating points", cur);
          
          break;
        }
        
        var ix = cur % size2 - pad;
        var iy = ~~(cur / size2) - pad;
      
        //if (ix == 0 || iy == 0) continue;
        var x = (ix+0.001)/size;
        var y = (iy+0.001)/size;
        
        //var plaque = 3;
        //seed = (~~(x*plaque))/plaque;
        //limit = Math.fract(y*plaque); //(~~(y*plaque))/plaque;
        
        var ix2 = ix;
        var iy2 = iy;
       
        var ax = ~~(DIMEN*AA_PAN_X);
        var ay = ~~(DIMEN*AA_PAN_Y);
        
        var ret = dxdy(ix+ax, iy+ay, this.dimen, AA_SEED);
        if (ret == undefined) continue;
        
        var dx  = ret[0];
        var dy  = ret[1];
        var gen = ret[2];
        
        //if ((dx > limit || dy > limit)) {
          //continue;
        //}

        var id = get_id(ix+ax, iy+ay, DIMEN, AA_SEED, limit);
        
        //var color = exports.id_cache.usedmap[id] / exports.id_cache.max_used_id;
        //color = ~~(color*this.colors.length*0.999999);

        var color = Math.abs(id % this.colors.length);
        
        if (this.config.AA_ADD_JITTER) {
          //gen += Math.random()*0.05;
          
          x += Math.random()/size2/2;
          y += Math.random()/size2/2;
        }
        
        //if (x < 0 || y < 0 || x >= 1.0 || y >= 1.0) {
           //x = Math.min(Math.max(x, 0.0), 1.0);
           //y = Math.min(Math.max(y, 0.0), 1.0);
           //continue;
        //}
        
        //create space for point
        for (var j=0; j<PTOT; j++) {
          ps.push(0);
        }
        
        var dx2 = dx-0.5, dy2 = dy-0.5;
        
        gen = ~~(gen*256);
        
        //if (x == 0 && y == 0) continue;
        
        ps[pi] = ps[pi+PDX] = x;
        ps[pi+1] = ps[pi+PDY] = y;
        
        ps[pi+PIX] = ~~(x*msize+0.001);
        ps[pi+PIY] = ~~(y*msize+0.001);
        ps[pi+PR] = this.r;
        ps[pi+PCLR] = color % this.colors.length;
        
        ps[pi+PGEN] = gen; //gen;
        
        ps[pi+PFLAG] = -1; //flag for if point has been labeled yet, can't use gen
        ps[pi+PD]   = id;
        
        this.maxgen = Math.max(this.maxgen, gen+1);
        
        this.kdtree.insert(x, y, pi/PTOT);
        this.orig_kdtree.insert(x, y, pi/PTOT);
      }
      
      //this.save_offsets();
      this.apply_offsets();
      
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
      if (!this.config.AA_USE_OFFSETS) {
        return;
      }
      
      var ps = this.points;
      var offs = this.offsets;
      var msize = this.mask_img.width;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var c = ps[i+PD];
        
        
        if (this.offsets.has(c)) {
          var vals = this.offsets.get(c);
          
          ps[i+PGEN] = vals[OGEN];
          this.maxgen = Math.max(ps[i+PGEN]+1, this.maxgen);
          
          var dx = vals[OX];
          var dy = vals[OY];
          
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
        
        var tmp = new Array(OTOT);
        var offs = this.offsets;
        var bl = 0.3;
        
        for (var i=0; i<this.points.length; i += PTOT) {
          var c = this.points[i+PD];
          
          var dx=0, dy=0;
          var savegen=undefined;
        
          if (offs.has(c)) {
            var vals = offs.get(c);
            
            dx = vals[0];
            dy = vals[1];
            savegen = vals[2];
          }
          
          var x = this.points[i], y = this.points[i+1];
          
          if (x < bl || x > 1.0 - bl*2 || y < bl || y > 1.0 - bl*2) {
            //continue;
          }
          
          dx += fac*0.1*(Math.random()-0.5)//this.dimen;
          dy += fac*0.1*(Math.random()-0.5)//this.dimen;
          
          tmp[0] = dx;
          tmp[1] = dy;
          tmp[2] = savegen != undefined ? savegen : this.points[i+PGEN];
          
          offs.set(c, tmp);
          
          this.points[i] = this.points[i+PDX] + dx/this.dimen;
          this.points[i+1] = this.points[i+PDY] + dy/this.dimen;
        }

        this.regen_spatial();

        this.save_offsets();
        this.apply_offsets();
        this.raster();
        
        redraw_all();
    },
    
    function relax2() {
      if (!this.config.AA_USE_OFFSETS) {
        return;
      }
      
     /*
      all pattern generators are assumed to 
      distribute brightness values linearly,
      such that there is area/255 black pixels and 1 white pixel.
     */
      var cf = this.config;
      
      var offs = this.offsets;
      var size = this.dimen;
      var r1 = new Array(3), r2 = new Array(3);
      var LSTEPS = 64;
      var tmp = new Array(OTOT);
      
      //this.report("relaxing...");
      
      var ax = ~~(DIMEN*AA_PAN_X);
      var ay = ~~(DIMEN*AA_PAN_Y);
        
      var size3 = !test_unique_ids ? _AA_MASSIVE_DOMAIN : size;
      var max_offset_len = _AA_MAX_OFFSET_LEN; //7.0;
      
      var test_only_domain = _AA_TEST_ONLY_DOMAIN;
      
      if (test_only_domain || test_unique_ids) {
        size3 = size;
        this.pass++;
      }

      var do_mask = (this.pass % _AA_MASK_INTERVAL != 0) && cf.GEN_MASK;
      
      var _ilen = (test_only_domain||test_unique_ids) ? size*size : _AA_RELAX_STEPS;
      var __i = 0;
      
      for (var _i=0; _i<_ilen; _i++) {
        var i = ~~(Math.random()*size3*size3*0.999999999);
        
        if (test_only_domain || test_unique_ids) {
          i = _i;
        }
        
        if (this.relax2_visit.length >= this.offsets.used-5) {
          console.log(" - next pass - ");
          this.relax2_visit = new util.set();
          this.pass++;
        }
        
        if (__i++ > 100000) {
          console.log("infinite loop");
          break;
        }
        
        if (!(test_only_domain && !test_unique_ids) && this.relax2_visit.has(i)) {
          _i--;
          continue;
        }
        
        this.relax2_visit.add(i);
        
        var ix = i % size3, iy = ~~(i / size3);
        //var ix = ~~((Math.random()-0.5)*size3);
        //var iy = ~~((Math.random()-0.5)*size3);
        
        var id = get_id(ix+ax, iy+ay, size, AA_SEED, this.limit);
        
        var ox=0, oy=0;
        if (offs.has(id)) {
          var vals = offs.get(id);
          ox = vals[0], oy = vals[1];
        }
        var x = ix/size3 + ox/size3, y = iy/size3 + oy/size3;
        
        //XXX ignore points that have pushed themselves out of the unit domain
        //if (x < 0 || y < 0 || x >= 1.0 || y >= 1.0) {
        //  continue;
        //}
        
        var ret = dxdy(ix+ax, iy+ay, size3, AA_SEED);
        r1[0] = ret[0], r1[1] = ret[1], r1[2] = ret[2];
        var lvl1 = r1[2];
        
        var r = do_mask ? ~~((1.0-lvl1)*9) + 3 : 2;
        var rd = Math.ceil(r);
        
        var soffs = cconst.get_searchoff(rd + ~~_AA_MAX_OFFSET_SEARCH + 1);
        var sx=0, sy=0, sw=0;
        
        for (var j=0; j<soffs.length; j++) {
          var ix2 = ~~(x*size3) + soffs[j][0], iy2 = ~~(y*size3) + soffs[j][1];
          var id2 = get_id(ix2+ax, iy2+ay, size3, AA_SEED, this.limit);
        
          if (soffs[j][0] == 0 && soffs[j][1] == 0) {
            continue;
          }
          
          var ox2=0, oy2=0;
          if (offs.has(id2)) {
            var vals = offs.get(id2);
            ox2 = vals[0], oy2 = vals[1];
          }
          
          var x2 = ix2/size3 + ox2/size3, y2 = iy2/size3 + oy2/size3;
          
          var ret = dxdy(ix2+ax, iy2+ay, size3, AA_SEED);
          r2[0] = ret[0], r2[1] = ret[1], r2[2] = ret[2];
          var lvl2 = r2[2];
          
          var l1 = (~~(lvl1*LSTEPS)+1)/(LSTEPS+1);
          var l2 = (~~(lvl2*LSTEPS)+1)/(LSTEPS+1);
          
          //var rad1 = 2*Math.sqrt(2.0) / (0.000001+Math.sqrt(size3*size3*l1));
          //var rad2 = 2*Math.sqrt(2.0) / (0.000001+Math.sqrt(size3*size3*l2));
          
          /*XXX argh! should be sqrt(1/(2*sqrt(3)*N)), but this only works with
            sqrt(1/(2*sqrt(3)*sqrt(N)))
            
            why the extra sqrt? mean!
          */
          var rad1 = 0.909*Math.sqrt(1 / (2*Math.sqrt(3)*Math.sqrt(size3*size3*l1)));
          var rad2 = 0.909*Math.sqrt(1 / (2*Math.sqrt(3)*Math.sqrt(size3*size3*l2)));
          
          //if (Math.random() > 0.999) {
            //console.log(l1, l2, rad1, rad2);
          //}
          
          if (do_mask && l2 > l1) {
            continue;
          }
          
          var dx = x2-x, dy = y2-y;
          var dis = dx*dx + dy*dy;
          var r3;
          
          if (do_mask && l2 != l1) {
            var lf = l1 != 0.0 ? 1.3 * (l2 / l1) : 1.0;
            
            //r3 = ((1.0 + l1*(cf.HIEARCHIAL_SCALE-1.0))*r)/size3;
            r3 = Math.min(rad1, rad2);
          } else {
            r3 = r/size3;
          }
          
          if (dis > r3*r3) {
            continue;
          }
          
          dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;
          var w = 1.0 - dis/r3;
          //w *= w*w;
          //w = SPH_CURVE.evaluate(w);
          
          if (dis > 0) {
            dx *= r3/dis;
            dy *= r3/dis;
          }
          
          sx += -dx*w;
          sy += -dy*w;
          sw += w;
        }
        
        if (sw == 0) continue;
        
        sx /= sw;
        sy /= sw;
        
        //if (Math.random() > 0.999) {
          //console.log(sx, sy, sw);
        //}
        
        ix = i % size3, iy = ~~(i / size3);
        
        sx = ((sx+x)*size3-ix);
        sy = ((sy+y)*size3-iy);
        
        var fac = /*(1.15-lvl1) * */0.5*AA_SPEED;
        
        sx = ox + (sx - ox)*fac;
        sy = oy + (sy - oy)*fac;
        
        var olen = sx*sx + sy*sy;
        if (olen >= 0.999*max_offset_len*max_offset_len) {
          olen = olen != 0.0 ? Math.sqrt(olen) : 0.0;
          
          sx *= max_offset_len/olen;
          sy *= max_offset_len/olen;
        }
        
        if (isNaN(sx) || isNaN(sy)) {
          console.log(sx, sy, f, fac, ox, oy, olen);
          throw new Error("NaN!");
        }
        
        var f = lvl1; //(~~(lvl1*LSTEPS))/LSTEPS;
        
        tmp[OX] = sx;
        tmp[OY] = sy;
        tmp[OGEN] = ~~(f*256);
        offs.set(id, tmp);
        
        //if (Math.random() > 0.99) {
        //  console.log(lvl1);
        //}
      }
      
      this.save_offsets();
      this.regen_spatial();
      this.apply_offsets();
      this.raster();
      
      var perc = (this.relax2_visit.length / this.offsets.used)*100.0;
      this.report((!do_mask ? "P: " : "M: ") + perc.toFixed(2) + "%: done relaxing");
      this.report("  total IDs: " + _aa_noise.id_cache.id_users_avg_tot);
    },
    
    function relax() {
      var use_avg_dis = true;
      
      var offs = this.offsets;
      
      //threshold to not affect boundary points
      var bl = 0.1;
      
      //initial jitter
      //XXX doesn't make sense with new random sampling of large domain
      if (0 && this.relax_first && !GEN_MASK) {
        this.relax_first = 0;
        var tmp = [0, 0, 0];
        
        for (var i=0; i<this.points.length; i += PTOT) {
          var c = this.points[i+PD];
          
          var dx=0, dy=0;
          if (offs.has(c)) {
            continue;
            
            var vals = offs.get(c);
            dx = vals[0], dy = vals[1];
          }
          
          var x = this.points[i], y = this.points[i+1];
          
          dx += 0.7*(Math.random()-0.5)//this.dimen;
          dy += 0.7*(Math.random()-0.5)//this.dimen;
          
          tmp[0] = dx;
          tmp[1] = dy;
          tmp[2] = this.points[i+PGEN];
          
          offs.set(c, tmp);
          
          this.points[i] = this.points[i+PDX] + dx/this.dimen;
          this.points[i+1] = this.points[i+PDY] + dy/this.dimen;
        }

        this.regen_spatial();
        this.apply_offsets();
        //return;
      }
      
      this.relax2();
      return;
      
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

        if (offs.has(c) && !test_without_offsets) {
          var vals = offs.get(c);
          var dx1 = vals[0], dy1 = vals[1];
          
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
          
          var ret = dxdy(ix2, iy2, this.dimen, AA_SEED);
          
          if (ret[0] > this.limit || ret[1] > this.limit)
            continue;
          
          var id = get_id(ix2, iy2, DIMEN, AA_SEED, this.limit);
          
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
            
            //ignore points too far outside of boundary
            var lmt = 0.05;
            if (x2 < lmt || y2 < lmt || x2 >= 1.0+lmt || y2 >= 1.0+lmt) {
              return;
            }
            
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
          continue;
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
        if (ps[i] > bl && ps[i] < 1.0-bl*2 && ps[i+1] > bl && ps[i+1] < 1.0 - bl*2) {
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
      return;
      var ps = this.points;
      
      if (this.voidcluster.points !== this.points) {
        this.report("initializing clusterer. . .");
        //this.voidcluster.init_from_points(this.points);
      }

      //console.log("assigning hiearchial tags");
      
      for (var i=0; i<32; i++) {
        this.voidcluster.cluster_step();
      }
      
      for (var i=0; i<ps.length; i += PTOT) {
        var c = ps[i+PD];
        
        this.maxgen = Math.max(this.maxgen, ps[i+PGEN]+1);
        
        if (!this.offsets.has(c*OTOT)) {
          this.offsets.set(c*OTOT, 0);
          this.offsets.set(c*OTOT+1, 0);
        }
        
        this.offsets.set(c*OTOT+OGEN, ps[i+PGEN]);
      }
      
      this.save_offsets();
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
