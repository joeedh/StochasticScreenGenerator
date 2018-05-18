/*
  _app is for getting module through debug console.  
  not used by the code.  don't confused with _appstate.
*/
var _app = undefined;

define([
  'util', 'const', 'ui', 'kdtree', 'sample_removal', 'darts', 'sph', 'sph_presets',
  'presets', 'void_cluster', 'fft', 'interface', 'darts2', 'histogram', "mitchell", 
  "mask_optimize", "blue_voidcluster", "smoothedmask", "indexdb_store"
], function(util, cconst, ui, kdtree, sample_removal, darts, sph, 
           sph_presets, presets, void_cluster, fftmod, iface, darts2, 
           histogram, mitchell, mask_optimize, bluevc, smoothedmask, indexdb_store) 
{
  'use strict';
  
  var exports = _app = {};
  var Class = util.Class;
  
  var generators = [
    smoothedmask.SmoothedMaskGenerator,
    darts.DartsGenerator,
    void_cluster.VoidClusterGenerator,
    darts2.Darts2Generator,
    mitchell.MitchellGenerator,
    mask_optimize.MaskOptGenerator,
    bluevc.BlueVCGenerator,
    sph.SPHGenerator
  ];
  
  var sin_table = (function() {
    var steps = 32768;
    var table = new Float64Array(steps);
    
    var t = 0, dt = (2*Math.PI)/(steps-1);
    
    console.log("building sin table approximation. . .");
    
    for (var i=0; i<steps; i++, t += dt) {
      table[i] = Math.sin(t);
    }
    
    var TWOPI = Math.PI*2.0;
    var ONETWOPI = 1.0 / TWOPI;
    var PIOVER2 = Math.PI / 2.0;
    
    return {
      sin : function(s) {
        i = ~~(s*0.15915494309189535*32768);
        i = i & 32767;
        //i = i < 0 ? i + 32768 : i;
        
        return table[i];
      },
      
      cos : function(s) {
        s += 1.5707963267948966; //PIOVER2;
        i = ~~(s*0.15915494309189535*32768);
        i = i & 32767;
        //i = i < 0 ? i + 32768 : i;
        
        return table[i];
      },
      
      test : function() {
        for (var i=-32; i<32; i++) {
          console.log(Math.sin(i*0.2).toFixed(4), this.sin(i*0.2).toFixed(4));
        }
      }
    }
  })();
  
  //XXX
  window.sin_table = sin_table;
  
  
  var AppState = Class([
    function constructor() {
      this.generator = undefined
      
      this.hist = new histogram.Histogram(64);
      
      this.report_queue = [];
      this.report_lines = [];
      this._lastsize = [0, 0];
      
      this.g = this.canvas = undefined;
      this.gui;
      this._last_mode = -1;
    },
    
    function reset() {
      this.dimen = DIMEN;
      
      if (MODE != this._last_mode) {
        console.log("switching generator type");
        
        this.generator = new generators[MODE];
        
        this._last_mode = MODE;
      }
      
      var size = DIMEN;
      var msize = SMALL_MASK ? size : (XLARGE_MASK ? size*8 : size*4);
      
      this.mask_img = new ImageData(msize, msize);
      this.mask = this.mask_img.data;
      this.mask.fill(0, 0, this.mask.length);
      
      var iview = new Int32Array(this.mask.buffer);
      iview.fill(iview[0], 0, iview.length);

      this.mask_canvas = document.createElement("canvas");
      this.mask_g = this.mask_canvas.getContext("2d");
      this.mask_canvas.width = this.mask_canvas.height = this.mask_img.width;
      
      this.generator.set_config(new iface.MaskConfig());
      this.generator.reset(size, this, this.mask_img);
    },
    
    function fft() {
      var restrict = ~~(DRAW_RESTRICT_LEVEL*this.generator.max_level());
      var ps = this.generator.points;
      var plen = 0;
      
      var maxlvl = this.generator.max_level();
      restrict /= maxlvl;
      
      var ps2 = this.generator.get_visible_points(restrict, true);
      var plen = ps2.length/PTOT;
      
      var gen = this.generator;
      
      //from PSA
      var fnorm = 2.0 / Math.sqrt(plen);
      var frange  = 10// Frequency range relative to Nyq. freq. of hexagonal lattice
      var size = Math.floor(frange/fnorm);
      
      var size2 = size; //64;
      var fscale = size/size2;
      size = size2;
      
      var fft_image, fft;

      if (this.fft_image != undefined && this.fft_image.width == size) {
        fft_image = this.fft_image;
        fft = fft_image.data;
      } else {
        fft_image = new ImageData(size, size);
        fft = fft_image.data;
        fft.fill(200, 0, fft.length);
        
        this.fft_image = fft_image;
      }
      
      var fft = new fftmod.FFT(size);
      //fft.jitter = 1;
      
      this._fft = fft;
      
      var pi = 0;
      var this2 = this;
      
      var next = function() {
        var steps = 95;
        
        var pi2 = Math.min(pi+steps*PTOT, ps.length);
        if (pi >= ps2.length) return 0;
        
        fft.add_points(ps2, fscale, pi/PTOT, pi2/PTOT);
        pi = pi2;

        this2.report("completed " + (pi/PTOT) + " of " + (ps2.length/PTOT) + " points");
        return 1;
      }
      
      var update = function update() {
        fft.raster(fft_image);
        fft.calc_radial();
      }
      
      next = next.bind(this);
      update = update.bind(this);
      var last_update = util.time_ms();
      
      window._fft_timer = window.setInterval(function() {
        if (!next()) {
          window.clearInterval(_fft_timer);
          window._fft_timer = undefined;
          
          if (util.time_ms() - last_update > 150) {
            update();
            last_update = util.time_ms();
          }
          
          redraw_all();
          return;
        }
        
        if (util.time_ms() - last_update > 150) {
          update();
          last_update = util.time_ms();
          redraw_all();
        }
      });
      
      redraw_all();
    },
    
    function save_ps_matrix_cmyk() {
      var s = this.gen_ps_matrix(0, "ScreenC");
      s += this.gen_ps_matrix(1, "ScreenM");
      s += this.gen_ps_matrix(2, "ScreenY");
      s += this.gen_ps_matrix(3, "ScreenK");
      
      var blob = new Blob([s], {type : "text/plain"});
      var url = URL.createObjectURL(blob);
      window.open(url);
    },
    
    function gen_ps_matrix(restrict_color, prefix) {
      var s = ""
      
      if (prefix == undefined)
        prefix = "HalfDict";
      
      /*
      /HalfDict_8 4 dict def
      HalfDict_8 begin
        /HalftoneType 3 def
        /Width 8 def
        /Height 8 def % octals? -v
        /Thresholds (\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\060\260\020\220\070\270\030\230\360\160\320\120\370\170\330\130\014\214\054\254\000\200\044\244\314\114\354\154\304\104\344\144\074\274\034\234\064\264\024\224\374\174\334\134\364\164\324\124) 	def
      end*/
      
      var mask = this.mask;
      var plen = this.generator.points.length/PTOT;
      
      var size = this.dimen;
      var msize = this.mask_img.width;
      //var size = ~~(Math.sqrt(plen)*0.9);
      
      //we didn't generate mask in small mask mode.
      //we'll have to rebase
      var rebase = msize != size;
      
      var grid = new Float64Array(size*size);
      var tots = new Int32Array(size*size);
      var lvls = new Int32Array(size*size);
      
      var hsteps = this.generator.max_level();
      
      tots.fill(0, 0, tots.length);
      grid.fill(-1, 0, grid.length);
      lvls.fill(hsteps, 0, lvls.length);
      
      var ps = this.generator.points;
      
      for (var i=0; i<ps.length; i += PTOT) {
        var x = ps[i], y = ps[i+1], gen = ps[i+PGEN];
        var color = ps[i+PCLR];
        
        if (restrict_color != undefined && color != restrict_color) {
          continue;
        }
        
        var ix, iy;
        
        if (rebase) {
          ix = ~~(size*((ps[i+PIX]+0.0001)/msize)+0.0001);
          iy = ~~(size*((ps[i+PIY]+0.0001)/msize)+0.0001);
        } else {
          ix = ps[i+PIX];
          iy = ps[i+PIY];
        }
        
        if (ix < 0) continue;
        if (ix < 0 || iy < 0 || ix >= size || iy >= size) continue;
        
        if (lvls[iy*size+ix] <= gen) {
          continue;
        }
        
        var d = Math.abs(gen/(hsteps));
        
        if (TONE_CURVE != undefined) {
          d = TONE_CURVE.evaluate(d*0.9999);
        }
        
        d = Math.abs(1.0 - d);
        
        if (grid[iy*size+ix] != -1) {
          continue;
        }
        
        grid[iy*size+ix] = d;
        tots[iy*size+ix] = 1;
        
        lvls[iy*size+ix] = gen;
      }
      
      for (var i=0; i<grid.length; i++) {
        if (grid[i] == -1) grid[i] = 0;
        if (tots[i] == 0) continue;
        
        grid[i] = ~~(255*grid[i]/tots[i]);
      }
      
      var method = "(error)";
      for (var k in MODES) {
        if (MODE == MODES[k]) {
          method = k;
        }
      }
      
      function write_curve(label, cv) {
        s += "%  " + label + " (as polyline):\n"
        s += "%    ["
        
        var steps = 24;
        
        for (var i=0; i<steps; i++) {
          var x = i / (steps-1);
          var y = cv.evaluate(x*0.999999);
          
          if (i > 0) s += ", "
          s += "(" + x.toFixed(4) + "," + y.toFixed(4) + ")"
        }
        
        s += "]\n"
        s += "%  ascii rendition:\n"
        var rows = 10;
        var cols = 30;
        
        for (var i=0; i<rows; i++) {
          s += "% "
          
          for (var j=0; j<cols; j++) {
            var x = j / (cols-1);
            var y = 1.0-cv.evaluate(x);
            
            y = ~~(y*rows);
            
            if (y != i) {
              s += " ";
            } else {
              s += "."
            }
          }
          s += "\n"
        }
      }
      
      s += "%params\n"
      s += "%generating method: "+method+"\n"
      if (MODE == MODES.SPH) {
        write_curve("sph curve", SPH_CURVE);
      }

      s += "%  scale of maximum level: " + HIEARCHIAL_SCALE
      if (MODE == MODES.SPH) {
        s += " (note: may be incorrect for SPH)"
      }
      s += "\n"
      
      s += "%  total threshold levels: " + hsteps + "\n"
      write_curve("tone curve", TONE_CURVE);

      s += "/"+prefix+"_"+size+" 4 dict def\n"
      s += prefix+"_"+size+" begin\n"
      s += "\t/HalftoneType 3 def\n"
      s += "\t/Width " + size + " def\n"
      s += "\t/Height " + size + " def\n"
      s += "\t/Thresholds ("
      
      for (var i=0; i<size*size; i++) {
        //var th = ~~mask[i*4];
        var th = grid[i];
        
        //th = ~~((i / (size*size))*254);
        //th = th.toString(8);
        
        //if (th == 0) th = 1;
        //th = 1;
        
        th = th.toString(8);
        
        while (th.length < 3) {
          th = "0" + th;
        }
        
        if (th.length > 3) {
          throw new Error("eek!");
        }
        
        s += "\\" + th
      }
      
      s += ") \tdef\n";
      s += "end\n\n"
      
      return s;
    },
    
    function save_ps_matrix() {
      var s = this.gen_ps_matrix();
      
      var blob = new Blob([s], {type : "text/plain"});
      var url = URL.createObjectURL(blob);
      window.open(url);
    },
    
    function step(custom_steps, noreport) {
      this.generator.step.apply(this.generator, arguments);
    },
    
    function raster() {
      this.generator.raster();
    },
    
    function save_dataurl() {
      this.raster();
      redraw_all();
      
      var data = this.mask_img.data;
      for (var i=0; i<data.length; i += 4) {
        if (data[i+3] == 0) {
          data[i] = data[i+1] = data[i+2] = 0;
          data[i+3] = 255;  
        }
      }

      var g = this.mask_g;
      g.putImageData(this.mask_img, 0, 0);
      
      return this.mask_canvas.toDataURL();
    },
    
    function toJSON() {
      let json = {
        APP_VERSION : APP_VERSION,
        settings : cconst.save()
      };
      
      return json;
    },
    
    function loadJSON(obj) {
      cconst.load(obj.settings);
    },
    
    function save() {
      localStorage.startup_file_bn9 = JSON.stringify(this);
    },
    
    function load() {
      if (localStorage.startup_file_bn9 === undefined) {
        return;
      }
      
      let obj = localStorage.startup_file_bn9;
      try {
        obj = JSON.parse(obj);
        this.loadJSON(obj);
      } catch (err) {
        util.print_stack(err);
      }
    },
    
    function save_mask() {
      this.raster();
      
      redraw_all();
      
      var g = this.mask_g;
      
      var data = this.mask_img.data;
      for (var i=0; i<data.length; i += 4) {
        if (data[i+3] == 0) {
          data[i] = data[i+1] = data[i+2] = 0;
          data[i+3] = 255;  
        }
      }
      
      g.putImageData(this.mask_img, 0, 0);
      
      let promise = new Promise((accept, reject) => {
        this.mask_canvas.toBlob((blob) => {
          let url = URL.createObjectURL(blob);
          
          accept(url);
        });
      });
      
      return promise;
    },
    
    function next_level(steps) {
      steps = steps == undefined ? 1 : steps;
      
      for (var i=0; i<steps; i++) {
        this.generator.next_level();
      }
    },
    
    function draw_transform(g) {
      var w = this.canvas.width, h = this.canvas.height;
      var sz = Math.max(w, h);
      
      g.lineWidth /= sz*SCALE*0.5;
      
      g.translate(w*0.2+PANX*sz, h*0.05+PANY*sz);
      g.scale(sz*SCALE*0.5, sz*SCALE*0.5);
    },
    
    Class.getter(function points() {
      throw new Error("refactor error!");
    }),
    
    Class.getter(function hsteps() {
      throw new Error("refactor error!");
    }),

    Class.getter(function hlvl() {
      throw new Error("refactor error!");
    }),
    
    Class.getter(function kdtree() {
      throw new Error("refactor error!");
    }),
    
    function report() {
      var s = "";
      
      for (var i=0; i<arguments.length; i++) {
        if (i > 0) s += " "
        
        s += arguments[i];
      }
      
      console.log(s);
      
      //this.report_queue.push(s);
      this.report_lines.push(s);
      
      if (this.report_lines.length > MAX_REPORT_LINES) {
        this.report_lines.shift();
      }
      
      this.redraw_report();
    },
    
    function redraw_report() {
      var r = document.getElementById("messages");
      var ls = this.report_lines;
      
      var s = "";
      for (var i=0; i<ls.length; i++) {
        s += ls[i] + "<br>\n";
      }
      
      r.innerHTML = s;
    },
    
    function draw() {
      var g = this.g; 
      
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      if (this.fft_image != undefined) {
        var fftx=20, ffty=350;
        g.putImageData(this.fft_image, fftx, ffty);
        
        var steps = 32;
        var t = 0, dt = 1.0 / (steps-1);
        
        var h = 40;
        var y = ffty+this.fft_image.height + h + 2;
        
        g.strokeStyle = "black";
        g.beginPath();
        
        var first = 1;
        
        for (var i=0; i<steps; i++, t += dt) {
          var f = this._fft.eval_radial(t);
          
          //if (f < 0) continue; //fft wants us to skip this t value
          f = 1.0 - f;
          
          var x2 = fftx + i*3;
          var y2 = y + f*h;
          //y2 = y;
          
          if (first) {
            g.moveTo(x2, y2);
            first = 0;
          } else {
            g.lineTo(x2, y2);
          }
        }
        
        g.stroke();
      }
      
      if (DRAW_MASK) {
        var mg = this.mask_g;
        mg.putImageData(this.mask_img, 0, 0);
        
        g.imageSmoothingEnabled = false;
        
        var msize = this.mask_canvas.width;
        var tottile= DISPLAY_TILED ? 4 : 1;
        
        g.save();
        g.scale(SCALE*7, SCALE*7);
        
        for (var x=0; x<tottile; x++) {
          for (var y=0; y<tottile; y++) {
            
            g.beginPath();
            g.fillStyle = "rgb(0, 0, 0)";
            g.rect(20+msize*x, 20+msize*y, this.mask_canvas.width+1, this.mask_canvas.height+1);
            g.fill();
            
            g.drawImage(this.mask_canvas, 20+msize*x, 20+msize*y);
          }
        }
        g.restore();
        return;
      }
      
      g.save();
      this.draw_transform(g);
      
      if (!DRAW_TILED) {
        g.beginPath();
        g.rect(0, 0, 1, 1);
        g.stroke();
      }
      
      if (DRAW_GRID) {
        let steps = this.mask_img.width;
        let mscale = SMALL_MASK ? 1 : (XLARGE_MASK ? 8 : 4);
        
        for (let axis=0; axis<2; axis++) {
          
          for (let i=0; i<steps; i++) {
            let f = i / steps;
            
            let x = axis ? 0 : f;
            let y = !axis ? 0 : f;
            
            g.beginPath();

            g.moveTo(x, y);
            
            x = axis ? 1 : f;
            y = !axis ? 1 : f;
            
            g.lineTo(x, y);
            f = (i % mscale)/mscale;
            f = f*0.5 + 0.5;
            f = ~~(f*255);
            
            let f1 = f// & 255;
            let f2 = f//(f>>8) & 255;
            let f3 = f//f2;
            
            g.strokeStyle = "rgb("+f1+","+f2+","+f3+")";
            g.stroke();
          }
        }
      }
      
      if (DRAW_KDTREE) {
        this.generator.kdtree.draw(g);
      }
      g.beginPath();
      
      var restrict = DRAW_RESTRICT_LEVEL;
      
      var ps = this.generator.points;
      var ps2 = this.generator.get_visible_points(restrict);
      
      var colors = this.generator.colors;
      var drmul = DRAW_RMUL*this.generator.draw_rmul;
      
      for (var _j=0; !this.generator.skip_point_draw && _j<colors.length; _j++) {
        var j = _j % colors.length;
        
        if (DRAW_COLOR) {
          var c = colors[j];
          var r = ~~(c[0]*255);
          var g1 = ~~(c[1]*255);
          var b = ~~(c[2]*255);
          g.fillStyle = "rgb("+r+","+g1+","+b+")";
        }
        
        if (!DRAW_COLOR && !DRAW_GEN) {
          g.fillStyle = "black";
        }
        
        var maxgen = this.generator.max_level();
        
        for (var si=0; si<_poffs.length; si++) {
          if (!DRAW_TILED && si > 0)
            break;
            
          g.beginPath();
          
          for (var i=0; i<ps2.length; i += PTOT) {
            var x = ps2[i], y = ps2[i+1], r = ps2[i+PR], gen = ps2[i+PGEN];
            var color = ps2[i+PCLR];
            
            if (DRAW_OFFS) {
              x += ps2[i+POFFX];
              y += ps2[i+POFFY];
            }
            
            x += _poffs[si][0], y += _poffs[si][1];
            r = this.generator.r;
            
            //CMYK
            if (color != j) continue;
            
            if (DRAW_GEN) {
              let f1 = gen, f2 = gen*0.5;
          
              f1 = ~~(f1*255);
              f2 = ~~(f2*255);
              g.fillStyle = "rgba("+f1+","+f2+",0, 1.0)";
              g.beginPath();
            }
            
            g.moveTo(x, y);
            g.arc(x, y, r*0.5*drmul, -Math.PI, Math.PI);
            
            if (DRAW_GEN) {
              g.fill();
            }
          }
          g.fill();
        }
      }
      
      this.generator.draw(g);

      g.restore();
      
      if (DRAW_HISTOGRAM) {
        let ps = this.generator.points;
        let mdata = this.mask;
        
        g.save();
        g.translate(0, 575);
        
        this.hist.reset();
        for (let i=0; i<mdata.length; i += 4) {
          let val = (mdata[i] + mdata[i+1] + mdata[i+2]) / 255.0 / 3.0;
          
          if ((val == 0 && !SMALL_MASK) || mdata[i+3] == 0.0) {
            continue; //ignore pure black (in large mask mode) or transparent pixels
          }
          
          this.hist.add(val);
        }
        
        this.hist.finish(0.0);
        
        this.hist.draw(this.canvas, g);
        g.restore();
      }
    },
    
    function on_tick() {
      if (this.gui == undefined) return;
      
      if (window.innerWidth != this._lastsize[0] || window.innerHeight != this._lastsize[1]) {
        this.on_resize();
      }
      
      this.gui.on_tick();
      this.gui2.on_tick();
    },
    
    function on_resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      
      this._lastsize[0] = this.canvas.width;
      this._lastsize[1] = this.canvas.height;
      
      redraw_all();
    },
    
    function on_keydown(e) {
      console.log(e.keyCode);
      
      switch (e.keyCode) {
        case 80: //pkey
          if (this.rtimer != undefined) {
            this.report("stopping timer");
            window.clearInterval(this.rtimer)
            this.rtimer = undefined;
            
            break;
          }
          
          this.report("start timer");
          
          this.rtimer = window.setInterval(function() {
            _appstate.generator.config.update();
            _appstate.generator.relax();
            redraw_all();
          }, 50);
          break;
        case 76: //lkey
          _appstate.generator.config.update();
          this.generator.offs_relax();
          redraw_all();
          break;
        case 75: //kkey
          _appstate.generator.config.update();
          this.generator.relax();
          redraw_all();
          break;
        case 68: //dkey
          if (!e.ctrlKey) {
            _appstate.generator.config.update();
            
            this.step();
            redraw_all();
          }
          break;
        case 83: //skey
          var dataurl = this.save_dataurl();
          
          //localStorage.startup_mask_bn4 = dataurl;
          new indexdb_store.IndexDBStore("bluenoise_mask").write("data", _appstate.save_dataurl());

          window.open(dataurl);
          
          redraw_all();
          break;
        case 82: //rkey
          //*
          if (!e.ctrlKey) {
            this.reset();
            _appstate.generator.config.update();
            redraw_all();
          }
          //*/
          break;
        case 78: //nkey
          console.log("\ngoing to next level. . .\n\n");
          
          this.next_level();
          
          console.log("hiearchial level:", this.generator.current_level());
          redraw_all();
          
          break;
        case 73: //ikey
          var start = util.time_ms();
          var report = 0;
          
          while (util.time_ms() - start < 700) {
            this.step(undefined, report++);
            this.step(undefined, report++);
          }
          
          console.log("\ngoing to next level. . .\n\n");
          this.next_level();
          console.log("hiearchial level:", this.generator.current_level());
          
          redraw_all();
          break;
        case 84: //tkey
        case 69: //ekey
          this.generator.toggle_timer_loop(this, e.shiftKey);
          break;
      }
    },
    
    function destroy_all_settings() {
      this.report("Removing all stored user data");
      this.report("  (except for any cached masks)");
      
      ui.destroy_all_settings();
      
      for (var i=0; i<generators.length; i++) {
        if (generators[i].destroy_all_settings !== undefined) {
          generators[i].destroy_all_settings();
        }
      }
      
      if (window.SPH_CURVE != undefined) {
        window.SPH_CURVE.destroy_all_settings();
        window.SPH_CURVE = undefined;
      }
      
      if (window.TONE_CURVE != undefined) {
        window.TONE_CURVE.destroy_all_settings();
        window.TONE_CURVE = undefined;
      }
      
      if (window.RADIUS_CURVE != undefined) {
        window.RADIUS_CURVE.destroy_all_settings();
        window.RADIUS_CURVE = undefined;
      }
      
      if (window.VOIDCLUSTER_CURVE != undefined) {
        window.VOIDCLUSTER_CURVE.destroy_all_settings();
        window.VOIDCLUSTER_CURVE = undefined;
      }
      
      if (window.FFT_CURVE != undefined) {
        window.FFT_CURVE.destroy_all_settings();
        window.FFT_CURVE = undefined;
      }
      
      for (let k in cconst.DefaultCurves) {
        let v = window[k];
        
        if (v !== undefined) {
          v.destroy_all_settings();
        }
        
        window[k] = undefined;
      }
      
      this.gui.destroy();
      this.gui2.destroy();
      this.gui = undefined;
      this.gui2 = undefined;
      
      /*
      var this2 = this;
      require.undef("const");
      require(["const"], function(module) {
        cconst = module;
        console.log("reloaded const.js");
        
        this2.reset();
        this2.build_ui();
        redraw_all();
      });//*/
    },
    
    function build_ui() {
      var panel = this.gui2 = new ui.UI("bn9_gui2", window); //XXX don't use window!
      panel.check('GEN_MASK', 'Generate Mask');
      
      panel.button('save_mask', "Save To Cache", function() {
        this2.report("\nSaving blue noise mask to local storage");
        //this2.report("  so other apps can load it, e.g. BlueNoiseStippling");
        
        new indexdb_store.IndexDBStore("bluenoise_mask").write("data", _appstate.save_dataurl());
        //localStorage.startup_mask_bn4 = _appstate.save_dataurl();
      });
      
      var panel2 = panel.panel("Tone Curve");
      window.TONE_CURVE = panel2.curve('TONE_CURVE', 'Tone Curve', presets.TONE_CURVE).curve;
      panel2.check('USE_TONE_CURVE', 'Enable Tone Curve');
      panel2.close();
      
      for (let gen of generators) {
        gen.build_ui(panel);
      }
      
      panel.slider('DRAW_RESTRICT_LEVEL', 'Display Level', 1.0, 0, 1, 0.0001, false, true);
      panel.check("DRAW_COLOR", "Show Colors");
      panel.check("DRAW_GEN", "Show MaskLevels");
      
      panel.check("GEN_CMYK_MASK", "Make Color Mask");
      
      var panel2 = panel.panel("FFT");
      window.FFT_CURVE = panel2.curve('FFT_CURVE', 'Radial Spectrum', presets.FFT_CURVE).curve;
      panel2.close();
      
      var panel = this.gui = new ui.UI("bn9_gui1", window);
        
      panel.button('fft', "FFT", function() {
        if (window._fft_timer != undefined) {
          this.report("stopping current fft");
          clearInterval(window._fft_timer);
          window._fft_timer = undefined;
          return;
        }
        
        _appstate.fft();
      });
      
      var uinames = {};
      for (var k in MODES) {
        var k2 = k[0] + k.slice(1, k.length).toLowerCase();
        k2 = k2.replace(/[_]+/g, " ");
        
        uinames[k2] = MODES[k];
      }
      
      var mode = parseInt(ui.load_setting('MODE'));
      
      if (!isNaN(mode))
        window.MODE = mode;
      
      panel.listenum(undefined, 'MODE', uinames, MODE, function(value) {
        console.log("m", value);
        window.MODE = parseInt(value);
        ui.save_setting('MODE', value);
      });
      
      panel.button('reset', 'Reset', function() {
        _appstate.reset();
        window.redraw_all();
      });
      
      var startb = panel.button('start', 'Start Generating', function() {
        _appstate.generator.toggle_timer_loop(_appstate, false);
        
        if (_appstate.timer != undefined) {
          startb.name("Pause");
        } else {
          startb.name("Start Generating");
        }
      }, this);
      
      panel.button('step', 'Single Step', function() {
        _appstate.step();
        window.redraw_all();
      });
      
      panel.button('save_mask', "Save Mask", function() {
        _appstate.save_mask().then((url) => {
          window.open(url);
        });
      });
      
      var this2 = this;
      
      panel.button('save_matrix', "Save PS Matrix", function() {
        _appstate.save_ps_matrix();
      });
      
      panel.button('save_matrix', "Save PS CMYK", function() {
        _appstate.save_ps_matrix_cmyk();
      });
      
      panel.slider('DIMEN', 'Dimensions', 32, 1, 512, 1, true, false);
      panel.slider('STEPS', 'Steps Per Run', 32, 1, 10000, 1, true, false);
      panel.slider('QUALITY_STEPS', 'Quality', 4, 1, 100, 1, true, false);
      panel.slider('DRAW_RMUL', 'Point Size', 1.0, 0.001, 4.0, 0.01, false, true);
      
      panel.slider('HIEARCHIAL_LEVELS', 'Levels', 255, 1, 255, 1, true, false);
      panel.slider('HIEARCHIAL_SCALE', 'Max Scale', 5.0, 1, 40, 0.001, false, false);
      panel.slider('SCALE', 'Zoom', 1.0, 0.01, 5, 0.001, false, true);
      
      panel.check('DRAW_KDTREE', 'Show kd-tree');
      panel.check('DRAW_GRID', 'Show Grid');
      panel.check('DRAW_MASK', 'Show Mask');
      panel.check('SMALL_MASK', 'Small Mask');
      panel.check('DRAW_OFFS', 'Apply Offsets');
      panel.check('XLARGE_MASK', 'Extra Large Mask');
      panel.check('DRAW_TILED', 'Draw Tiled');
      panel.check('FFT_TARGETING', 'Target FFT');
      
      panel.check('TILABLE', 'Make Tilable');
      
      if (DEV_MODE) {
        panel.check("ALLOW_OVERDRAW", "Allow Overdraw");
      }
      
      this.gui.load();
      this.gui2.load();
    }
  ]);
  
  var animreq = undefined;
  window.redraw_all = function() {
    if (animreq == undefined) {
      animreq = requestAnimationFrame(function() {
        //console.log("draw");
        
        animreq = undefined;
        _appstate.draw();
      });
    }
  }
  
  console.log("loaded");
  
  window._appstate = new AppState();
  _appstate.load();
  _appstate.build_ui();
  _appstate.reset();
  
  //start on_tick timer
  window.setInterval(() => {
    _appstate.on_tick();
  }, 150);
  
  _appstate.canvas = document.getElementById("canvas");
  _appstate.g = _appstate.canvas.getContext("2d");
  
  redraw_all();
  
  window.addEventListener("keydown", _appstate.on_keydown.bind(_appstate));
  return exports;
});

