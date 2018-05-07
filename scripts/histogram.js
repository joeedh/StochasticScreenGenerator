var _histogram;

define([
  "util"
], function(util) {
  "use strict";
  
  let exports = _histogram = {};
  
  function quadbez(a, b, c, t) {
    let f1 = a + (b - a)*t;
    let f2 = b + (c - b)*t;
    
    return f1 + (f2 - f1)*t;
    
  }
  
  function cubicbez(a, b, c, d, t) {
    let f1 = quadbez(a, b, c, t);
    let f2 = quadbez(b, c, d, t);
    
    return f1 + (f2 - f1)*t;
  }
  
  function quarticbez(a, b, c, d, e, t) {
    let f1 = cubicbez(a, b, c, d, t);
    let f2 = cubicbez(b, c, d, e, t);
    
    return f1 + (f2 - f1)*t;
  }
  
  let HVAL=0, HNUM=1, HTOT=2;
  
  let Histogram = exports.Histogram = class Histogram extends Float64Array {
    constructor(size) {
      super(size*HTOT);
      
      this.tot = undefined;
      this.min = undefined;
      this.max = undefined;
      this.size = size;
      
      this.reset();
    }
    
    reset() {
      this.fill(0, 0, this.length);
      
      this.tot = 0.0;
      this.min = this.max = undefined;
    }
    
    add(val) {
      val = Math.min(Math.max(val, 0.0), 1.0);
      let hi = (~~(val*(this.size-1)))*HTOT;
      
      let oldtot = this.tot;
      
      this[hi+HVAL] += val;
      this[hi+HNUM]++;
      
      this.tot += val;
      
      let f = this[hi+HVAL];
      
      if (this.min === undefined) {
        this.min = this.max = f;
      } else {
        this.min = Math.min(this.min*oldtot, f)/this.tot;
        this.max = Math.max(this.max*oldtot, f)/this.tot;
      }
    }
    
    sample(val) {
      val = Math.min(Math.max(val, 0.0), 1.0);
      let hi = (~~(val*(this.size-1)))*HTOT;
      
      if (this.tot == 0.0) {
        return 0.0;
      }
      
      return this[hi+HVAL] / this.tot;
    }
    
    //normalizes result
    getBins() {
      let ret = [];
      
      for (let i=0; i<this.length; i += HTOT) {
        ret.push(this[i+HVAL] / this.tot);
      }
      
      return ret;
    }
    
    //interp_penalize is just multiplied with interpolated points 
    //defaults to 1.0
    finish(interp_penalize) {
      interp_penalize = interp_penalize === undefined ? 1.0 : interp_penalize;
      
      /*
      this.min = this.max = undefined;
      for (let i=0; i<this.length; i += HTOT) {
        let f = this[i+HVAL] / this.tot;
        
        if (this.min === undefined) {
          this.min = this.max = f;
        } else {
          this.min = Math.min(this.min, f);
          this.max = Math.max(this.max, f);
        }
      }
      
      return;
      //*/
      
      //interpolate gaps in histogram
      if (this.tot == 0.0) { //anything in histogram?
        return;
      }
      
      //make sure we have a first entry
      if (this[HNUM] == 0) {
        this[HVAL] = 0;
        this[HNUM] = 1;
      }
      
      for (let i=0; i<this.length-HTOT; i += HTOT) {
        //we want to be inside a filled bin, next to a (possibly series of) unfilled one
        if (this[i+HNUM] == 0.0 || this[i+HTOT+HNUM] != 0) {
          continue;
        }
        
        let a = i;
        let b = undefined;
        
        for (let j=i+HTOT; j < this.length; j += HTOT) {
          if (this[j+HNUM] != 0) {
            b = j;
            break;
          }
        }
        
        if (b === undefined) {
          this[this.length - HTOT+HNUM] = this[a+HNUM];
          this[this.length - HTOT+HVAL] = this[a+HVAL];
          this.tot += this[a+HVAL];
          
          b = this.length-HTOT;
        }
        
        for (let j=a+HTOT; j<b; j += HTOT) {
          let t = (j - a) / (b - a);
          
          this[j+HVAL] = (this[a+HVAL] + (this[b+HVAL] - this[a+HVAL])*t)*interp_penalize;
          this[j+HNUM] = (this[a+HNUM] + (this[b+HNUM] - this[a+HNUM])*t)*interp_penalize;
          
          this.tot += this[j+HVAL];
          
          i = j;
        }
      }
      
      let tot = 0.0;
      for (let i=0; i<this.length; i += HTOT) {
        tot += this[i+HVAL];
      }
      
      this.tot = tot;
      if (this.tot == 0.0) {
        return;
      }
      
      this.min = this.max = undefined;
      for (let i=0; i<this.length; i += HTOT) {
        let f = this[i+HVAL] / this.tot;
        
        if (this.min === undefined) {
          this.min = this.max = f;
        } else {
          this.min = Math.min(this.min, f);
          this.max = Math.max(this.max, f);
        }
      }
    }
    
    draw(canvas, g) {
      let x = 15, y = 15, w = 400, h = 100;
      
      console.log("histogram draw!");
      
      g.beginPath();
      g.strokeStyle = "black";
      g.fillStyle = "white";
      
      g.rect(x, y-4, x+w, y+h+8);
      
      g.stroke();
      g.fill();
      
      g.beginPath();
      g.moveTo(x, y+h);
      g.lineTo(x+w+16, y+h);
      g.strokeStyle = "grey";
      g.stroke();
      
      g.beginPath();
      
      let x2 = x, dx = w / this.size;
      let lasty2 = y+h, lastx2 = x2;
      let hsum = 0.0;
      
      for (let i=0; this.tot > 0 && i<this.length; i += HTOT) {
        let val = this[i+HVAL] / this.tot;
        hsum += val;
        
        val = 1.0 - val/this.max;
        
        let y2 = y + val*h;
        
        if (i != 0) {
          g.moveTo(x2-dx, y+h);
          g.lineTo(x2-dx, y2);
          g.lineTo(x2, y2);
          g.lineTo(x2, y+h);
        }
        
        lasty2 = y2;
        lastx2 = x2;
        x2 += dx;
      }
      
      console.log("hsum", hsum);
      
      g.strokeStyle = "red";
      g.fillStyle = "red";
      
      //g.fill();
      g.stroke();
    }
  }
 
  return exports;
});
