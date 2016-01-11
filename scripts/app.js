/*
  _app is for getting module through debug console.  
  not used by the code.  don't confused with _appstate.
*/
var _app = undefined;

define([
  'util', 'const', 'ui', 'kdtree', 'sample_removal', 'darts', 'sph', 'sph_presets',
  'spectral', 'jitter', 'aa_noise', 'presets', 'void_cluster', 'fft',
  'interface', 'bayer'
], function(util, cconst, ui, kdtree, sample_removal, darts, sph, 
           sph_presets, spectral, jitter, aa_noise, presets, void_cluster,
           fftmod, iface, bayer) 
{
  'use strict';
  
  var exports = _app = {};
  var Class = util.Class;
  
  var generators = [
    sph.SPHGenerator,
    darts.DartsGenerator,
    spectral.SpectralGenerator,
    jitter.JitterGenerator,
    aa_noise.AANoiseGenerator,
    void_cluster.VoidClusterGenerator,
    bayer.BayerGenerator
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
      this.build_ui();
      
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
      var msize = SMALL_MASK ? size : size*4;
      
      this.mask_img = new ImageData(msize, msize);
      this.mask = this.mask_img.data;
      this.mask.fill(0, 0, this.mask.length);
      
      this.mask.fill(0, this.mask.length);
      //this.mask[1] = 255;
      this.mask[3] = 255;
      
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
    
    function save() {
      this.raster();
      redraw_all();
      
      var g = this.mask_g;
      g.putImageData(this.mask_img, 0, 0);
      
      var url = this.mask_canvas.toDataURL();
      
      return url;
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
      
      if (DRAW_KDTREE) {
        this.generator.kdtree.draw(g);
      }
      g.beginPath();
      
      var restrict = DRAW_RESTRICT_LEVEL;
      
      var ps = this.generator.points;
      var ps2 = this.generator.get_visible_points(restrict);
      
      var colors = this.generator.colors;
      var drmul = DRAW_RMUL*this.generator.draw_rmul;
      
      for (var _j=0; _j<colors.length; _j++) {
        var j = _j % colors.length;
        
        var c = colors[j];
        var r = ~~(c[0]*255);
        var g1 = ~~(c[1]*255);
        var b = ~~(c[2]*255);
        g.fillStyle = "rgb("+r+","+g1+","+b+")";
        
        if (!DRAW_COLOR) {
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
            
            x += _poffs[si][0], y += _poffs[si][1];
            r = this.generator.r;
            
            //CMYK
            if (color != j) continue;
            
            g.moveTo(x, y);
            g.arc(x, y, r*0.5*drmul, -Math.PI, Math.PI);
          }
          g.fill();
        }
      }
      
      this.generator.draw(g);
      
      g.restore();
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
        case 76: //lkey
          if (this.rtimer != undefined) {
            this.report("stoping timer");
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
        case 75: //kkey
          _appstate.generator.config.update();
          this.generator.relax();
          redraw_all();
          break;
        case 68: //dkey
          if (e.ctrlKey) {
            if (this.generator instanceof aa_noise.AANoiseGenerator) {
              this.report("Deleted optimized point offsets");
              
              this.generator.delete_offsets();
              this.generator.apply_offsets();
              redraw_all();
              
              e.preventDefault();
            }
          } else {
            _appstate.generator.config.update();
            
            this.step();
            redraw_all();
          }
          break;
        case 83: //skey
          var dataurl = this.save();
          
          localStorage.startup_mask_bn4 = dataurl;
          window.open(dataurl);
          
          redraw_all();
          break;
        case 82: //rkey
          if (!e.ctrlKey) {
            this.reset();
            _appstate.generator.config.update();
            redraw_all();
          }
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
        generators[i].destroy_all_settings();
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
      
      this.gui.destroy();
      this.gui2.destroy();
      this.gui = undefined;
      this.gui2 = undefined;
      
      var this2 = this;
      
      require.undef("const");
      require(["const"], function(module) {
        cconst = module;
        console.log("reloaded const.js");
        
        this2.reset();
        this2.build_ui();
        redraw_all();
      });
    },
    
    function build_ui() {
      var panel = this.gui2 = new ui.UI();
      panel.check('gen_mask', 'Generate Mask');

      var panel2 = panel.panel("SPH Curve");
      
      panel2.slider('sph_speed', 'SPH Speed', 0.001, 5.0, 0.0001, false, false);
      panel2.curve('sph_curve', 'SPH Curve');
      panel2.close()
      
      var list = {
      }
      
      for (var k in sph_presets.presets) {
        list[k] = k;
      }
      
      //sph_presets
      var sph_val = "Simple";
      panel2.listenum('preset', list, sph_val, function(val) {
        sph_val = val;
      });        
        
      panel2.button('load_preset', 'Load SPH Preset', function() {
        SPH_CURVE.loadJSON(sph_presets.presets[sph_val]);
        SPH_CURVE.update();
        SPH_CURVE.widget.draw();
        SPH_CURVE.widget.save();
      });
      
      var panel2 = panel.panel("Tone Curve");
      panel2.curve('tone_curve', 'Tone Curve', presets.TONE_CURVE);
      panel2.close();
      
      var panel2 = panel.panel("Radius Curve");
      panel2.curve('radius_curve', 'Radius Curve', presets.RADIUS_CURVE);
      panel2.close();

      var panel2 = panel.panel("AA");
      
      panel2.slider('aa_speed', 'Speed', 0.001, 2.0, 0.0001, false, false);
      panel2.button('clear_aa_cache', "Clear Cache", function() {
        
        if (_appstate.generator instanceof aa_noise.AANoiseGenerator) {
          _appstate.generator.delete_offsets();
        } else {
          _appstate.report("Error: not in AA mode");
        }
      }, this);
      
      var panel3 = panel2.panel("Pan");
      panel2.slider('aa_pan_x', "X%", 0.0, 27.0, 0.0001, false, false);
      panel2.slider('aa_pan_y', "Y%", 0.0, 27.0, 0.0001, false, false);
      panel2.close();
      
      var panel2 = panel.panel("Dart");
      panel2.close();
      panel2.check('limit_distance', 'Pack Densely');
      panel2.slider('distance_limit', 'Pack Threshold', 0.01, 1.2, 0.001, false, false);
      panel2.check('align_grid', 'Align To Grid');
      panel2.check('scan_mode', 'Scan Mode');
      
      panel.slider('draw_restrict_level', 'Display Level', 0, 1, 0.0001, false, true);
      panel.check("draw_color", "Show Colors");
      panel.check("gen_cmyk_mask", "Make Color Mask");
      
      panel.button('save_mask', "Save To Cache", function() {
        this2.report("\nSaving blue noise mask to local storage");
        //this2.report("  so other apps can load it, e.g. BlueNoiseStippling");
        
        localStorage.startup_mask_bn4 = _appstate.save();
      });
      
      var panel2 = panel.panel("Void-Cluster Filter Curve");
      
      panel2.curve('voidcluster_curve', 'VC Filter Curve',  presets.VOIDCLUSTER_CURVE);
      panel2.slider('voidcluster_mid_r', 'Middle Radius', 0, 1, 0.001, false, false);
      panel2.check('void_hex_mode', 'Hexagon Mode');
      panel2.check("void_bayer_mode", "Bayer Mode");
      panel2.close();
      
      var panel2 = panel.panel("FFT");
      panel2.curve('fft_curve', 'Radial Spectrum', presets.FFT_CURVE);
      panel2.close();
      
      var panel = this.gui = new ui.UI();
        
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
      
      panel.listenum('mode', uinames, MODE, function(value) {
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
        window.open(_appstate.save());
      });
      
      var this2 = this;
      
      panel.button('save_matrix', "Save PS Matrix", function() {
        _appstate.save_ps_matrix();
      });
      
      panel.button('save_matrix', "Save PS CMYK", function() {
        _appstate.save_ps_matrix_cmyk();
      });
      
      panel.slider('dimen', 'Dimensions', 1, 1500, 1, true, false);
      panel.slider('steps', 'Steps Per Run', 1, 10000, 1, true, false);
      panel.slider('quality_steps', 'Quality', 1, 100, 1, true, false);
      panel.slider('draw_rmul', 'Point Size', 0.001, 4.0, 0.01, false, true);
      
      panel.slider('hiearchial_levels', 'Levels', 1, 255, 1, true, false);
      panel.slider('hiearchial_scale', 'Max Scale', 1, 40, 0.001, false, false);
      panel.slider('scale', 'Zoom', 0.01, 5, 0.001, false, true);
      
      panel.check('draw_kdtree', 'Show kd-tree');
      panel.check('draw_mask', 'Show Mask');
      panel.check('small_mask', 'Small Mask');
      panel.check('draw_tiled', 'Draw Tiled');
      panel.check('fft_targeting', 'Target FFT');
      
      panel.check('tilable', 'Make Tilable');
      
      if (DEV_MODE) {
        panel.check("allow_overdraw", "Allow Overdraw");
      }
    }
  ]);
  
  var animreq = undefined;
  window.redraw_all = function() {
    if (animreq == undefined) {
      animreq = requestAnimationFrame(function() {
        console.log("draw");
        
        animreq = undefined;
        _appstate.draw();
      });
    }
  }
  
  console.log("loaded");
  
  window._appstate = new AppState();
  _appstate.reset();
  
  _appstate.canvas = document.getElementById("canvas");
  _appstate.g = _appstate.canvas.getContext("2d");
  
  redraw_all();
  
  window.addEventListener("keydown", _appstate.on_keydown.bind(_appstate));
  return exports;
});

