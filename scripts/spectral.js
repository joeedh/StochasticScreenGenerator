var _spectral = undefined;

//currently unused

define([
  "util", "const", "interface", "vectormath", "kdtree"
], function(util, cconst, sinterface, vectormath, kdtree) {
  'use strict';
  
  var exports = _spectral = {};
  
  var Vector2 = vectormath.Vector2;
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var Modes = exports.Modes = {
    SHUFFLE  : 0,
    CONVERGE : 1
  };
  
  //I so hate this crap of putting fine-grained objects in flat 
  //Float64Array's
  var DSUM=0, DX=1, DY=2, DTOT=3;
  
  //alias a few fields in point structure
  var PERR = PR2, PDY2 = PD;
  
  var SpectralGenerator = exports.SpectralGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
      
      this._ki = 0;
      
      this.speedmul = 1.0;
      this.mode = Modes.SHUFFLE;
      
      this.mpos = new Vector2();
      
      this.facmul = 1.0;
      
      this.gen = 0;
      
      this.base = 1.00012;
      
      this._color = this.dda = this.dda_img = this.dsize = undefined;
      
      this.points = undefined;
    },
    
    function make_dv(goal) {
      var dv = new Float64Array(goal.length);
      
      var dsize = this.dsize;
      var dlen = goal.length / DTOT;
      
      dv.fill(0, 0, dv.length);
      
      for (var i=0; i<dlen; i++) {
        var x = i % dsize;
        var y = ~~(i / dsize);
        
        var dx, dy;
        
        dx = x < dsize-1 ? 1 : -1;
        dy = y < dsize-1 ? 1 : -1;
        
        var idx1 = (y*dsize+x)*DTOT;
        var idx2 = (y*dsize+x+dx)*DTOT;
        var idx3 = ((y+dy)*dsize+x)*DTOT;
        
        var f1 = goal[idx1], f2 = goal[idx2], f3 = goal[idx3];
        
        var dvx = (f2-f1)*Math.sign(dx);
        var dvy = (f3-f1)*Math.sign(dy);

        if (isNaN(dvx) || isNaN(dvy)) {
          console.log(idx1, idx2, idx3, dx, dy, dvx, dvy, f1, f2, f3, goal.length);
          throw new Error("nan!");
        }
        
        dv[idx1] = dvx;
        dv[idx1+1] = dvy;
      }
      
      return dv;
    },
    
    function max_level() {
      return this.hsteps;
    },
    
    function _throw() {
      var dimen = this.dimen;
      var totpoint = this.htotals[this.gen];
      var r = this.hrs[this.gen];
      var ps = this.points;
      var start_i = ps.length;
      
      for (var i=0; i<totpoint*132; i++) {
        if (this.points.length-start_i >= totpoint*PTOT) {
          break;
        }
        
        var x = Math.random(), y = Math.random();
        
        x = i % dimen;
        y = i / dimen;
        
        if (x % 2 == 0) {
          y += 0.5;
        }
        
        x += Math.random()*0.15;
        y += Math.random()*0.15;
        
        x /= dimen;
        y /= dimen;
        
        x = Math.random();
        y = Math.random();
        
        var bad = 0;
        
        this.kdtree.forEachPoint(x, y, r*4, function(pi) {
          var x2 = ps[pi*PTOT]-x, y2 = ps[pi*PTOT+1]-y;
          var d = x2*x2 + y2*y2;
          
          if (d < r*r) {
            bad = 1;
          }
        }, this);
        
        if (bad) { 
          //continue;
        }
        
        var pi = this.points.length;
        this.points.push(x);
        this.points.push(y);
        
        for (var j=2; j<PTOT; j++) {
          this.points.push(0);
        }
        
        this.points[pi+PGEN] = this.gen;
        this.points[pi+PR] = this.final_r;
        
        this.kdtree.insert(x, y, pi/PTOT);
      }
    },
    
    function next_level() {
      if (this.gen >= this.hsteps-1) {
        this.gen = this.hsteps;
        return;
      }
      
      this.gen++;
      this.r = this.hrs[this.gen];
      
      var tot = this.htotals[this.gen];
      var ps = this.points;

      console.log("next level!!", tot);
      
      this._throw();
      this.raster();
    },
    
    function _forEachPoint(cb, thisvar) {
      var plen = this.points.length/PTOT;
      
      if (thisvar == undefined)
        thisvar = this;
      
      for (var i=0; i<plen; i++) {
        cb.call(thisvar, i);
      }
    },
    
    function reset(dimen, mask) {
      MaskGenerator.prototype.reset.apply(this, arguments);
      
      this.dimen = dimen;
      
      var hsteps = this.hsteps = HIEARCHIAL_LEVELS;
      var hscale = this.hscale = HIEARCHIAL_SCALE;
      
      var tots = this.htotals = [];
      var rs = this.hrs = [];
      var r = this.final_r = 0.5*Math.sqrt(2) / (dimen);
      
      var startr = r*hscale, r2 = startr;
      var rmul = 1.0 / Math.pow(hscale, 1.0/hsteps);
      
      var total = 0.0;
      for (var i=0; i<hsteps; i++) {
        rs.push(r2);
        tots.push(Math.ceil(1.0 / (r2*r2)));
        total += tots[tots.length-1];
        
        r2 *= rmul;
      }
      
      for (var i=0; i<hsteps; i++) {
        var d = ~~(dimen*dimen*(tots[i]/total)+0.5);
        tots[i] = d;
        
        rs[i] = Math.sqrt(2.0 / (Math.sqrt(3)*2*d));
      }
      
      startr = rs[0];
      this.r = r = startr;
      
      this.points = [];
      
      //differential distribution function
      var dsize = this.dsize = 128;//Math.min(dimen*4, 128);
      
      this.dda = new Float64Array(dsize*dsize*DTOT);
      this.dda.fill(0, this.dda.length);

      this.dda_img = new ImageData(dsize, dsize);
      this.goal_img  = new ImageData(dsize, dsize);
      this.goal_img2 = new ImageData(dsize, dsize);
      
      this.goal = new Float64Array(dsize*dsize*DTOT);
      this.goal2 = new Float64Array(dsize*dsize*DTOT);
      
      var d = this.dda_img.data;
      d[0] = d[1] = d[2] = 0;
      d[3] = 255;
      
      var iview = new Int32Array(this.dda_img.data.buffer);
      iview.fill(iview[0], 0, iview.length);
      
      this._color = iview[0];
      
      iview = new Int32Array(this.goal_img.data.buffer);
      iview.fill(this._color, 0, iview.length);
      
      var totpoint = this.htotals[0];
      var ps = this.points;
      
      this._throw();
      
      this.make_goal();
    },
    
    function make_goal() {
      var dsize = this.dsize, goal = this.goal, idata = this.goal_img.data;
      
      for (var ix=0; ix<dsize; ix++) {
        for (var iy=0; iy<dsize; iy++) {
          var x=ix/dsize - 0.5, y=iy/dsize - 0.5
          
          var f = x*x + y*y;
          
          f = f != 0 ? Math.sqrt(f) : 0;
          
          f = f/Math.sqrt(2.0);
          f *= 2;
          
          //f = Math.max(Math.abs(x), Math.abs(y));
          
          f = Math.max(1.0 - f*1.3, 0.0);
          f = SPH_CURVE.evaluate(f);
          
          var idx = (iy*dsize+ix)*DTOT;
          
          goal[idx] = f;
          goal[idx+1] = 1;
          
          idx = (iy*dsize+ix)*4;
          
          f = f;
          idata[idx]   = ~~(f*255);
          idata[idx+1] = ~~(f*255);
          idata[idx+2] = ~~(f*255);
          idata[idx+3] = 255;
        }
      }
    },
    
    function current_level() {
      return this.gen;
    },

    function step(custom_steps) {
      this.make_goal();
      
      var no_poff = 0;
      
      var goal = this.goal;
      
      var steps = custom_steps ? custom_steps : STEPS;
      
      console.log("points:", this.points.length/PTOT);
      console.log("hiearchial level:", this.current_level());
      
      var ps = this.points, dsize = this.dsize, dda = this.dda;
      var idata = this.dda_img.data;
      var plen = this.points.length/PTOT;
      var searchrad = 0.5;//7*this.r;
      var kdtree = this.kdtree;
      
      dda.fill(0, 0, dda.length);
      var iview = new Int32Array(idata.buffer);
      iview.fill(this._color, 0, iview.length);
      
      var mindis=undefined, maxdis=undefined, avgdis=0.0, tot=0;
      var mindx, mindy, maxdx, maxdy;
      var dda_dv, goal_dv;

      var sumdis, sumdx, sumdy, sumtot, sumdx2, sumdy2, sumerr;
      var set_dda = true;
      var x, y, i, j, total=0;
      var kdtree = this.kdtree;
      
      function point_callback(pi) {
        var x2 = ps[pi*PTOT], y2=ps[pi*PTOT+1], r2=ps[pi*PTOT+PR];
        
        if (pi == i/PTOT)
          return;
        
        x2 -= _poffs[j][0];
        y2 -= _poffs[j][1];
        
        var dx = (x2-x), dy = (y2-y);
        
        var dis = dx*dx + dy*dy;
        dis = dis != 0 ? Math.sqrt(dis) : 0;
        
        if (Math.abs(dx) > searchrad || Math.abs(dy) > searchrad) 
          return;
        
        if (dis < this.r) 
          return;
        
        
        /*
        on factor;
        off period;
        
        operator dda, dda_goal;
        
        err := dda(x1-x2, y1-y2) - dda_goal(x1-x2, y1-y2);
        
        */
        
        dx /= searchrad;
        dy /= searchrad;
        
        dx *= Math.sqrt(2.0);
        dy *= Math.sqrt(2.0);
        
        var ix = ~~((dx*0.5 + 0.5)*dsize);
        var iy = ~~((dy*0.5 + 0.5)*dsize);
        
        var idx = (iy*dsize+ix)*DTOT;
        
        var f1 = dda[idx];
        
        if (ix < 0 || iy < 0 || ix >= dsize-1 || iy >= dsize-1) {
          return;
        }
        var ix2 = ix-dsize*0.5, iy2 = iy-dsize*0.5;
        var dlimit = dsize*0.5;
        
        //if (ix2*ix2 + iy2*iy2 > dlimit*dlimit) {
        //  return;
        //}
        
        if (set_dda) {
          dda[idx] += 1;
          total++;
        }
        
        //var dis2 = dis//*dsize;
        //var w = Math.exp(-(dis2*dis2) / 2);
        var w = dis/searchrad;
        w = 1.0;
        //w *= w*w;
        //w = w*w*(3.0-2.0*w);
        
        if (dis/this.r < 0.1) {
        //  return;
        }
        
        if (!set_dda && goal_dv != undefined) {
          //w = (dda[idx] - goal[idx]);
          //w = w != 0 ? -1.0 / w : 0;
          w = dda[idx] - goal[idx];
          
          var dx = dda_dv[idx] - goal_dv[idx];
          var dy = dda_dv[idx+1] - goal_dv[idx+1];
          
          sumdx += -dx*w;
          sumdy += -dy*w;
          
          sumerr += (dda[idx] - goal[idx])*w;
        }
        
        sumdis += dis*w;
        sumtot += w;
      }
         
      //console.log("mindis", mindis.toFixed(3), "maxdis", maxdis.toFixed(3), "avgdis", avgdis.toFixed(4));
      console.log("this.r", this.r.toFixed(3));
      
      //mindx = mindy = -avgdis;
      //maxdx = maxdy = avgdis;
      
      //mindx = mindy = -this.r*(1.0/8.0);
      //maxdx = maxdy = this.r*8;
      
      sumdis = sumtot = sumdx = sumdy = sumdx2 = sumdy2 = sumerr = 0.0;
      set_dda = true;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1], r = ps[i+PR];
        
        for (j=0; j<_poffs.length; j++) {
          x1 = x + _poffs[j][0],  y1 = y + _poffs[j][1];
          
          if (no_poff && j > 0) {
            break;
          }
          
          this._forEachPoint(point_callback, this);
          //kdtree.forEachPoint(x1, y1, searchrad, point_callback, this);
        }        
      }
      
      var total = 0, total2=0;
      var maxcount = 0;
      
      for (var i=0; i<dda.length; i += DTOT) {
        var count = dda[i], tot = dda[i+1];
        
        maxcount = Math.max(maxcount, count);
        
        total += count;
        total2 += count != 0 ? 1 : 0;
      }
      
      var maxf = 0;
      var minf = 1e17;
      
      for (var i=0; i<dda.length; i += DTOT) {
        var count = dda[i];
        var f = count / total;
        
        dda[i] = f;
        
        if (count != 0) {
          dda[i+DX] /= count;
          dda[i+DY] /= count;
        }
        
        minf = Math.min(f, minf);
        maxf = Math.max(f, maxf);
      }
      
      var dda2 = new Float64Array(dda.length);
      
      var gdata = this.goal_img2.data;
      var goal = this.goal;
      var goal2 = this.goal2;
      
      var goalsum = 0;
      var maxgf=0.0001;
      for (var i=0; i<goal.length; i += DTOT) {
        goalsum += goal[i];
        maxgf = Math.max(maxgf, goal[i]);
      }
      maxgf /= goalsum;
      
      for (var x=0; x<dsize; x++) {
        for (var y=0; y<dsize; y++) {
          var idx = (y*dsize+x)*4;
          
          var gidx = (y*dsize+x)*DTOT;
          var g = goal[gidx]/goalsum;
          
          goal2[gidx] = g;
          
          g = g/maxgf;
          
          gdata[idx] = ~~(g*255);
          gdata[idx+1] = ~~(g*255);
          gdata[idx+2] = ~~(g*255);
          gdata[idx+3] = 255;
        }
      }
      
      var d = 1;
      
      for (var i=0; i<dda.length; i += DTOT) {
        var x = (i/DTOT) % dsize;
        var y = ~~((i/DTOT) / dsize);
        
        var sum=0, tot=0;
        var sqrt2 = Math.sqrt(2.0);
        var sumdx=0, sumdy=0;
        
        for (var ix1=-d; ix1 <= d; ix1++) {
          for (var iy1=-d; iy1 <= d; iy1++) {
            var dx1 = ix1/d, dy1 = iy1/d;
            
            var w = dx1*dx1 + dy1*dy1;
            w = w != 0 ? Math.sqrt(w) : 0;
            
            w = Math.max(1.0 - w/sqrt2, 0.0);
            //w = (ix1==0 && iy1 == 0) ? 1 : 0.1
            
            w = w*w*(3.0-2.0*w);
            w *= w*w;
            
            var ix2 = ix1 + x, iy2 = iy1 + y;
            
            //wrap filter around domain
            if (ix2 < 0) ix2 += dsize;
            if (ix2 >= dsize) ix2 -= dsize;
            
            if (iy2 < 0) iy2 += dsize;
            if (iy2 >= dsize) iy2 -= dsize;
            
            if (ix2 < 0 || iy2 < 0 || ix2 >= dsize || iy2 >= dsize) {
              throw new Error("eek");
            }
            
            if (isNaN(ix2) || isNaN(iy2)) throw new Error("nan!");
            
            var idx2 = (iy2*dsize+ix2)*DTOT;
            
            sum += dda[idx2]*w;
            sumdx += dda[idx2+DX]*w;
            sumdy += dda[idx2+DY]*w;
            tot += w;
          }
        }
        
        if (tot == 0) continue;
        
        sum /= tot;
        sumdx /= tot;
        sumdy /= tot;
        
        dda2[i]   = sum;
        dda2[i+DX] = sumdx;
        dda2[i+DY] = sumdy;
        
        if (isNaN(sumdx) || isNaN(sumdy)) throw new Error()
      }
      
      dda = this.dda = dda2;
      
      dda_dv = this.make_dv(dda);
      goal_dv = this.make_dv(goal);
      
      set_dda = false;      
      
      window._ddv = dda_dv;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1], r = ps[i+PR];
        
        var sumdis = 0;
        var sumtot = 0;
        
        var sumdx  = 0;
        var sumdy  = 0;
        var sumerr = 0;
        
        var sumdx2 = 0;
        var sumdy2 = 0;
        
        for (var j=0; j<_poffs.length; j++) {
          var x1 = x + _poffs[j][0],  y1 = y + _poffs[j][1];
          if (no_poff && j > 0) {
            break;
          }
          
          this._forEachPoint(point_callback, this);
          //kdtree.forEachPoint(x1, y1, searchrad, point_callback, this);
        }
        
        if (sumtot > 0) {
          sumdis /= sumtot;
          
          sumdx  /= sumtot;
          sumdy  /= sumtot;
          sumerr /= sumtot;
        }
        
        ps[i+PDX] = sumdx;
        ps[i+PDY] = sumdy;
        ps[i+PERR] = sumerr;
      }
      
      for (var i=0; i<dda.length; i += DTOT) {
        var x= (i/DTOT) % dsize;
        var y = ~~((i/DTOT) / dsize);
        
        //var f = Math.pow(dda[i], 90);
        var f = dda[i];
        //f += 0.5;
        
        if (f < 0 || isNaN(f)) {
          //throw new Error("eek!");
          continue;
        }
        
        f = f/maxf;
        
        var idx = (y*dsize+x)*4;
        idata[idx] = ~~(f*255);
        idata[idx+1] = ~~(f*255);
        idata[idx+2] = ~~(f*255);//~~(f*255);
        idata[idx+3] = 255;
      }
      
      var goal = this.goal;
      
      //return; //XXX
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        var gen = ps[i+PGEN];
        var err = ps[i+PERR];
        
        var dx = ps[i+PDX], dy = ps[i+PDY];
        
        var l = dx*dx + dy*dy;
        var udx = dx, udy = dy;
        
        if (l > 0) {
          l = Math.sqrt(l);
          
          udx /= l;
          udy /= l;
        }
        
        //if (Math.random() > 0.1) continue;
        
        var fac = SPH_SPEED*0.01;
        
        //if (err != 0 && (dx != 0 || dy != 0)) {
        //  err /= (dx*dx + dy*dy);
        //}
        //err = -err;
        
        //err = Math.sign(err)*10;
        dx = udx;
        dy = udy;
        err = Math.abs(err)*0.01;
        
        ps[i]   += err*dx*fac;
        ps[i+1] += err*dy*fac;
        
        ps[i]   = Math.fract(ps[i]);
        ps[i+1] = Math.fract(ps[i+1]);
        
        this.kdtree.remove(i/PTOT);
        this.kdtree.insert(ps[i], ps[i+1], i/PTOT);
      }
      
      //this.facmul *= 0.98;
      this.raster();
    },
    
    function raster() {
      var ps = this.points;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1];
        
        ps[i+PIX] = ~~(x*this.mask_img.width);
        ps[i+PIY] = ~~(y*this.mask_img.height);
      }
      
      MaskGenerator.prototype.raster.call(this);
    },
    
    function draw(g) {
      g.putImageData(this.dda_img, 15, 205);
      g.putImageData(this.goal_img, 15, 205+this.dda_img.height+5);
      g.putImageData(this.goal_img2, 15+this.dda_img.width+5, 205+this.dda_img.height+45);
      
      
    }
  ]);
  
  return exports;
});
