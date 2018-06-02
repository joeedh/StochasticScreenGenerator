var _app = undefined; //for debugging purposes only.  don't write code with it

define([
  "./util", "./sph", "./const", "./events", "./ui", "./smoothmask", "./colors"
], function(util, sph, cconst, events, ui, smoothmask, colors) {
  'use strict';
  
  var exports = _app = {};
  
  window.STARTUP_FILE_NAME = "startup_file_spha5";
  
  var AppState = exports.AppState = class AppState extends events.EventHandler {
    loadStartupImage() {
      if (this.image === undefined && "startup_image_bn4" in localStorage) {
        _appstate.load_image(localStorage.startup_image_bn4).then((idata) => {
          _appstate.image = idata;
          window.redraw_all();
        });
      }
    }
    
    report() {
      let str = "";
      
      for (let arg of arguments) {
        str += arg + " ";
      }
      str += "<br>"
      
      this.reportbuf.shift();
      this.reportbuf.push(str);
      
      let s = "";
      for (let line of this.reportbuf) {
        if (line === undefined) {
          continue;
        }
        s += line + "\n";
      }
      
      let div = document.getElementById("reportbox");
      div.innerHTML = s;
    }
    
    constructor() {
      super();
      
      this.shuffle_f_i = 0.0;
      this.shuffle_rfac = 1.0;
      
      this.reportbuf = new Array(7);
      
      this.mask_canvas = document.createElement("canvas");
      this.mask_g = this.mask_canvas.getContext("2d");
      
      this.last_save = 0;
      this.canvas = document.getElementById("canvas2d");
      this.g = this.canvas.getContext("2d");
      
      this.points = [];
      this.sph = new sph.SPH();
      this.sph.points = this.points;
      
      this.makeGUI();
      
      this.mask = undefined;
      this.reset();
    }
    
    makeGUI() {
      if (this.gui !== undefined) {
        return; //this.gui.destroy();
      }
      
      this.gui = new ui.UI(STARTUP_FILE_NAME + "_", cconst);
      
      this.gui.button("reset", "Reset", () => {
        this.reset();
        window.redraw_all();
      });

      this.gui.button("load_image", "Load Test Image", () => {
        this.load_image().then((data) => {
            this.image = data;
            window.redraw_all();
            
            localStorage.startup_image_bn4 = data.dataurl;
        });
      });
      
      this.gui.button("reset_tick", "Reset Tick", () => {
        this.sph.tick = 0;
        window.redraw_all();
      });

      this.gui.button("savemask", "Download Mask", () => {
        this.download_mask();
      });
     
      this.gui.button("savemask", "Save to cache", () => {
        this.save_mask_to_cache();
      });
     
      let panel = this.gui.panel("Basic Settings");
      
      panel.slider("DIMEN", "Dimen", 64, 3.0, 256, 1.0, true, true);
      //panel.slider("TIMER_STEPS", "TimerSteps", 300, 1.0, 1024*32, 1.0, true, true);
      panel.slider("POINTSCALE", "Point Scale", 1.0, 0.0, 2.0, 0.001, false, true);
      
      panel = this.gui.panel("SPH Curve");
      cconst.SPH_CURVE = panel.curve("SPH_CURVE", "Filter Curve", cconst.SPH_CURVE).curve;

      panel = this.gui.panel("Radius Curve");
      cconst.RADIUS_CURVE = panel.curve("RADIUS_CURVE", "Radius Curve", cconst.RADIUS_CURVE).curve;

      panel = this.gui.panel("Image Curve");
      cconst.IMAGE_CURVE = panel.curve("IMAGE_CURVE", "Image Curve", cconst.IMAGE_CURVE).curve;
      
      panel = this.gui.panel("Tone Curve");
      cconst.TONE_CURVE = panel.curve("TONE_CURVE", "Tone Curve", cconst.TONE_CURVE).curve;
      
      panel = this.gui.panel("Param Solver");
      panel.slider("SOLVER_SEARCHRAD", "UniformSearchRad", 1.0, 0.005, 16.0, 0.001, false, true);
      panel.slider("SOLVER_SPEED", "UniformSpeed", 1.0, 0.005, 16.0, 0.001, false, true);
      panel.slider("SOLVER_STEPS", "UniformSlvSteps", 15, 1, 128, true, false);
      panel.slider("SOLVER_RANGE", "Range", 24, 1, 512, true, false);
      panel.slider("SOLVER_NORMAL_STEPS", "NormalSlvSteps", 15, 1, 128, true, false);
      panel.slider("SOLVER_STARTSPEED_THRESH", "SpeedThresh", 1.0, 0.005, 5.0, 0.0001, false, true);
      
      let spanel = panel.panel("Paramaters");
      spanel.slider("SOLVER_PARAM_MIN", "ParamMin", 0, 1, 7, true, false);
      spanel.slider("SOLVER_PARAM_MAX", "ParamMax", 7, 0, 7, true, false);
      spanel.slider("SOLVER_PARAM_WEIGHT", "ParamW", 1, 0, 1, 0.00001, false, false);
      spanel.slider("SOLVER_SEARCHRAD_WEIGHT", "SearchRadW", 1, 0, 1, 0.00001, false, false);
      spanel.slider("SOLVER_MAXSCALE_WEIGHT", "MaxScaleW", 1, 0, 1, 0.00001, false, false);
      spanel.slider("SOLVER_RANDFAC", "RandFac", 1, 0.0, 10, 0.00001, false, false);
      spanel.slider("SOLVER_RANDSEED", "RandSeed", 1, 0.001, 10, 0.00001, false, false);
      spanel.check("SOLVER_IN_SERIES", "One At A Time");
      
      panel = this.gui.panel("Settings2");
      panel.slider("SPH_SPEED", "Speed", 1.0, 0.005, 16.0, 0.001, false, true);
      panel.slider("SEARCHRAD", "Search Rad", 3.0, 0.1, 15.0, 0.001, false, true);
      panel.slider("MAX_SCALE", "MaxRadScale", 3.0, 0.1, 15.0, 0.001, false, true);
      panel.slider("CMYK_SEARCHRAD", "CMYKSearchRad", 3.0, 0.1, 15.0, 0.001, false, true);

      panel.slider("GENSTEPS", "IntensitySteps", 513, 1, 4096, false, true);
      panel.slider("RANDFAC", "Rand Fac", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM1", "Param1", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM2", "Param2", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM3", "Param3", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM4", "Param4", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM5", "Param5", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM6", "Param6", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("PARAM7", "Param7", 1, -1, 9.0, 0.0001, false, true);
      panel.slider("RADMUL", "Radius Factor", 0.8, 0.0, 1.0, 0.001, false, true);
      panel.slider("DV_DAMPING", "Damping", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("GENSTART", "GenStart", 0.05, 0.001, 0.5, 0.001, false, true);
      panel.close();      
    
      panel = this.gui.panel("Settings1");
    
      panel.check("DRAW_TEST", "Draw Test");
      panel.check("USE_IMAGE", "Use Image");
      panel.check("APPLY_TONING", "Apply Toning");
      panel.check("DRAW_COLORS", "Draw Colors");
      panel.check("IMAGE_COLORS", "Image Colors");
      panel.check("DRAW_INTENSITY", "Draw Intensity");
      
      panel.slider("REPEAT", "Test Repeat", 5, 1, 45, 1, true, true);
      
      panel.slider("DISPLAY_LEVEL", "Display Level", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("STARTCO_BLEND", "Offset Blend", 1.0, 0.0, 1.0, 0.001, false, true);
      panel.slider("SOLVE_LEVEL", "Solve Level", 1.0, 0.0, 1.0, 0.001, false, true);
      
      //panel.slider("EXPONENT", "Exponent", 1.0, 0.001, 18.0, 0.001, false, true);
      
      panel = this.gui.panel("Draw Settings");
      
      panel.check("DRAW_KDTREE", "Draw kdtree");
      panel.check("SMALL_MASK", "Small Mask Mode");
      panel.check("XLARGE_MASK", "Extra Large Mask Mode");
      panel.check("SHOW_RADII", "Show Point Radius");
      
      this.gui.load();
    }
    
    load_image(dataurl) {
      let doaccept;
      
      let promise = new Promise((accept, reject) => {
        doaccept = accept;
      });
      
      let onload = (e) => {
        let data = e.target.result;
        let image = new Image();
        
        image.src = data;
        image.onload = (e) => {
          console.log("got image", image.width, image.height);
          
          let canvas = document.createElement("canvas");
          let g = canvas.getContext("2d");
          
          canvas.width = image.width;
          canvas.height = image.height;
          
          g.drawImage(image, 0, 0);
          let idata = g.getImageData(0, 0, image.width, image.height);
          
          let dataurl = canvas.toDataURL();
          idata.dataurl = dataurl;
          
          doaccept(idata);
        }
      };
      
      if (dataurl !== undefined) {
        onload({target : {result : dataurl}});
        return promise;
      }
      
      let input = document.createElement("input");
      input.type = "file";
      
      input.addEventListener("change", function(e) {
        let files = this.files;
        console.log("got file", e, files)
            
        if (files.length == 0) return;
        
        var reader = new FileReader();
        var this2 = this;
        
        reader.onload = onload;
        
        reader.readAsDataURL(files[0]);
      });
      
      input.click();
      return promise;
    }
    
    save_mask_to_cache() {
      console.log("saving pointset mask to local storage...");
      this.report("saving pointset mask to local storage...");

      localStorage.startup_mask_bn4 = this.save_mask();
      
      /*
      this.save_mask(true).then((url) => {
        console.log("saving mask to local storage...");
        this.report("saving mask to local storage...");
        localStorage.startup_mask_bn4 = url;
      });
      //*/
    }

    save_mask() {
      let buf = this.save_smoothmask().toBinary().toString();
      buf = "SMOOTHMASK" + buf;

      return buf;
    }

    reset() {
      //window._last_error = undefined;
      this.shuffle_f_i = 0;
      this.shuffle_rfac = 1.0;
      
      let dimen;
      let mscale;
      let msize;
      
      if (cconst.USE_MASK && "sph_analyzer_ps" in localStorage) {
        this.points = JSON.parse(localStorage.sph_analyzer_ps);
        mscale = cconst.SMALL_MASK ? 1.0 : (cconst.XLARGE_MASK ? 8 : 4);
        
        dimen = Math.ceil(Math.sqrt(this.points.length/PTOT*1.2))*mscale;
        msize = dimen;
      } else {
        mscale = cconst.SMALL_MASK ? 1.0 : (cconst.XLARGE_MASK ? 8 : 4);
        dimen = cconst.DIMEN;
        
        msize = dimen*mscale;
      }
      
      this.mask_size = msize;
      this.mask = new ImageData(msize, msize);
      
      let md = this.mask.data;
      
      for (let i=0; i<md.length; i += 4) {
        md[i+3] = 255;
      }
      
      this.sph.reset(dimen);
      
      if (window.redraw_all !== undefined)
        window.redraw_all();
    }
    
    step() {
      this.sph.step();
      
      console.log("Done.");
      window.redraw_all();
    }
    
    setsize() {
      var w = window.innerWidth, h = window.innerHeight;
      
      var eventfire = this.canvas.width != w || this.canvas.height != h;
      
      if (this.canvas.width != w)
        this.canvas.width = w;
      if (this.canvas.height != h)
        this.canvas.height = h;
      
      if (eventfire)
        this.on_resize([w, h]);
    }
    
    draw() {
      this.setsize();
      
      let g = this.g;
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      let w = this.canvas.width, h = this.canvas.height;
      let scale2 = 0.4, scale = w*scale2;
      
      g.save();
      
      g.scale(w*scale2, h*scale2);
      
      g.translate(0.25, 0.05);
      g.scale(1.0, w/h);
      
      g.fillStyle = g.strokeStyle = "black";
      
      g.beginPath();
      g.lineWidth /= scale;
      g.rect(0, 0, 1, 1);
      g.stroke();
      
      let ps = this.sph.points;
      
      let mdata = this.mask.data;
      mdata.fill(255, 0, mdata.length);
      for (let i=0; i<mdata.length; i += 4) {
        mdata[i+3] = 255;
      }
      
      let solve_limit = this.timer !== undefined ? this.sph.cur_t : cconst.SOLVE_LEVEL;

      let repeat = cconst.DRAW_TEST ? cconst.REPEAT : 1;
      
      repeat = Math.ceil(repeat / this.sph.dimen * 16);
      
      for (let rx=0; rx<repeat; rx++) {
      for (let ry=0; ry<repeat; ry++) {
      
      let offx = rx/repeat, offy = ry/repeat;
      
      let cmyk = [[0, 1, 1], [1, 0, 1], [1, 1, 0], [0, 0, 0]];
      
      if (cconst.DRAW_TEST && cconst.USE_IMAGE && !this.image) {
        this.loadStartupImage();
      }
      
      g.beginPath();
      for (let _i=0; _i<ps.length*4; _i += PTOT) {
        let i = _i % ps.length;
        let curcolor = ~~(_i / ps.length);
        
        if (curcolor > 0 && !cconst.DRAW_COLORS) {
          break;
        }
        
        curcolor = 3 - curcolor;
        
        let x = ps[i], y = ps[i+1], r = ps[i+PR], val = ps[i+POGEN], color=ps[i+PCLR];
        let gen = cconst.APPLY_TONING ? ps[i+POGEN] : ps[i+PGEN];

        if (cconst.DRAW_COLORS && color != curcolor) {
          continue;
        }
        
        color = cmyk[color];
        
        if (cconst.DRAW_TEST) {
            x = ps[i+PSTARTX];
            y = ps[i+PSTARTY];            
        }

        x = x/repeat + offx;
        y = y/repeat + offy;

        let f;
        
        if (cconst.DRAW_TEST && this.image !== undefined && cconst.USE_IMAGE) {
            let idata = this.image.data;
            let size = Math.max(this.image.width, this.image.height);

            let ix = ~~(x * size);
            let iy = ~~(y * size);

            if (ix < 0 || iy < 0 || ix >= this.image.width || iy >= this.image.height) {
                continue;
            }

            let idx = (iy*this.image.width + ix)*4;
            let s = (idata[idx]/255 + idata[idx+1]/255 + idata[idx+2]/255) / 3.0;

            f = s;
            
            if (cconst.IMAGE_COLORS && cconst.DRAW_COLORS) {
              let r = idata[idx]/255, g = idata[idx+1]/255, b = idata[idx+2]/255;
              
              let c = colors.rgb_to_cmyk(r, g, b);
              f = 1.0 - c[ps[i+PCLR]];
            }
        } else {
          //make little pyramid graphic
          f = Math.fract(x * Math.floor(1 + y*9));
        }
         
        //f = 1.0 - cconst.TONE_CURVE.inverse(1.0 - f);

        if (cconst.IMAGE_CURVE !== undefined && cconst.IMAGE_CURVE.evaluate !== undefined) {
            f = cconst.IMAGE_CURVE.evaluate(f);
        }
        
        f = f != 0.0 ? f**0.75 : f;
        let ff = 1.0 - Math.pow(1.0 - f, 2.0);
        f = f*0.5 + ff*0.5;

        if (gen > 1.0-f && cconst.DRAW_TEST) {
          continue;
        }
        
        x = ps[i+PSTARTX]/repeat + offx + (x - ps[i+PSTARTX]/repeat-offx) * cconst.STARTCO_BLEND;
        y = ps[i+PSTARTY]/repeat + offy + (y - ps[i+PSTARTY]/repeat-offy) * cconst.STARTCO_BLEND;
        
        //x = Math.fract(x);
        //y = Math.fract(y);
        
        //let w = r;
        let w;
        
        if (gen > solve_limit) {
          w = this.sph.r;
        } else {
          w = cconst.SIMPLE_MODE ? this.sph.cur_r : this.sph.r;
        }
        
        if (cconst.DRAW_TEST)
          w *= 2.0;
        w *= cconst.POINTSCALE;
        
        f = 1.0 - gen;
        
        if (1.0-f > cconst.DISPLAY_LEVEL) {
          continue;
        }
        
        let alpha = gen > solve_limit ? 0.2 : 1.0;
        
        let ix = ~~(x*this.mask_size + 0.5);
        let iy = ~~(y*this.mask_size + 0.5);
        let idx = (iy*this.mask_size + ix)*4;
        
        let mgen = gen; //gen < cconst.START_THRESHOLD ? 0.0 : gen;
        
        let mf = 0.0; //mgen;
        
        let f1 = ~~(gen*255*2);
        let f2=0, f3 = 0;
        
        if (f1 > 255) {
          f2 = f1 - 255;
          f1 = 255;
        }
        
        if (f2 > 255) {
          f3 = f2 - 255;
          f2 = 255;
          f1 = 0;
        }
        //f1=f2=f3=~~(val*255);
        //f1=f2=f3=~~((1.0-mf)*255);
        //f1=~~((1.0-Math.sqrt(mf))*255), f2=f3=0.0;
        
        mf = ~~(mf*240 + 15);
        mdata[idx] = mf;
        mdata[idx+1] = mf;
        mdata[idx+2] = mf;
        
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, w/repeat, -Math.PI, Math.PI);
        if (cconst.DRAW_INTENSITY && !cconst.DRAW_TEST) {
          
          g.fillStyle = "rgba("+f1+","+f2+","+f3+","+alpha+")";
        } else if (cconst.DRAW_COLORS) {
          g.fillStyle = `rgba(${~~(color[0]*255)},${~~(color[1]*255)},${~~(color[2]*255)},1.0)`;
        } else {
          g.fillStyle = "black";
        }
        
        g.fill();
        
        if (cconst.SHOW_RADII) {
          r = ps[i+PR]*cconst.SEARCHRAD/repeat;
          
          g.beginPath();
          g.moveTo(x, y);
          g.arc(x, y, r, -Math.PI, Math.PI);
          
          if (cconst.DRAW_INTENSITY && !cconst.DRAW_TEST) {
            g.fillStyle = "rgba("+f1+","+f2+","+f3+","+(0.1*alpha)+")";
          } else {
            g.fillStyle = "black";
          }
          
          g.fill();
        }
        
        //g.rect(x-w*0.5, y-w*0.5, w, w);
      }
      
      g.fill();
      }
      }
      
      if (cconst.DRAW_KDTREE && this.sph.kdtree !== undefined) {
        this.sph.kdtree.draw(g);
      }
      
      g.restore();
      g.putImageData(this.mask, 10, 10)
    }
    
    save() {
      localStorage[STARTUP_FILE_NAME] = JSON.stringify(this);
    }
    
    load(str) {
      try {
        this.loadJSON(JSON.parse(str));
      } catch(error) {
        util.print_stack(error);
        console.warn("Failed to load start up file!");
      }
      
      this.reset();
      this.gui.update();
      
      return this;
    }
    
    toJSON() {
      let cconsts2 = {};
      for (let k in cconst) {
        let v = cconst[k];
        
        if (k == k.toUpperCase() && typeof v != "function") {
          cconsts2[k] = v;
        }
      }
      
      return {
        version : cconst.APP_VERSION,
        consts  : cconsts2
      };
    }
    
    loadJSON(obj) {
      let cpy = cconst.copy();
      cconst.loadJSON(obj.consts);
      
      for (let k in obj.consts) {
        let v = obj.consts[k];

        if (k.search("CURVE") >= 0 && k != "CURVE_DEFAULTS") {
          let curve = cpy[k];
          
          if (curve === undefined || !(curve instanceof ui.Curve)) {
            curve = new ui.Curve(k);
            curve.setting_id = undefined;
          }

          if (v !== undefined) {
            curve.loadJSON(v);
            curve.update();
          }

          cconst[k] = curve;
        }
      }
      
      window.redraw_all();
      return this;
    }
    
    on_resize(newsize) {
      console.log("resize event");
    }
    
    on_mousedown(e) {
    }
    
    on_mousemove(e) {
    }
    
    on_mouseup(e) {
    }
    
    on_tick() {
      if (this.gui !== undefined) {
        this.gui.on_tick();
      }
      
      if (util.time_ms() - this.last_save > 900) {
        //console.log("autosaving");
        _appstate.save();
        this.last_save = util.time_ms();
      }
    }
    
    on_keydown(e) {
      console.log("keycode", e.keyCode);
      //this.report("keycode", e.keyCode);
      
      if (e.ctrlKey || e.shiftKey || e.altKey || e.commandKey)
        return;
      
      switch (e.keyCode) {
        case 69: //ekey
          this.toggle_timer_loop();
          break;
        case 82: //rkey
          this.reset()
          break;
        case 68: //dkey
          this.step();
          window.redraw_all();
          break;
        case 76: //lkey
          this.report("Error:", this.sph.calcError(cconst, false, false).toFixed(5));
          window.redraw_all();
          break;
        case 75: //kkey
          if (this.stimer !== undefined) {
            window.clearInterval(this.stimer);
            this.stimer = undefined;
          } else {
            let startps = this.sph.points.slice(0, this.sph.points.length);
            let iter = this.sph.shuffleGen(cconst, _appstate.shuffle_rfac, true, true);
            let lastval;

            this.stimer = window.setInterval(() => {
              let time = util.time_ms();

              while (util.time_ms() - time < 450) {
                let ret = iter.next();
                
                if (ret.done) {
                  let fi = ~~(_appstate.shuffle_f_i/(_appstate.shuffle_rfac < 0.7 ? 4 : 6));
                  let rf = Math.exp(-fi*0.0625*0.75);
                  
                  if (rf < 0.0135) {
                    _appstate.shuffle_f_i = 0;
                  } else {
                    _appstate.shuffle_f_i++;
                  }
                  
                  //rf = rf*(1.0 - 0.0125) + 0.0125;
                  
                  rf = _appstate.shuffle_rfac = window._last_error === undefined ? 0.0 : rf;
                  
                  //window.clearInterval(this.stimer);
                  //this.stimer = undefined;

                  let best = window._last_error !== undefined ? window._last_error : NaN;
                  
                  console.log("Final mask error:", lastval.toFixed(5));
                  this.report("Final mask error: " + lastval.toFixed(3) + ", Best error: " + best.toFixed(3));
                  this.report("rf: " + rf.toFixed(5));
                  
                  if (window._last_error !== undefined && lastval < window._last_error) {
                    window._last_error = lastval;
                    cconst.loadJSON(window.shuffleconfig);
                    
                    cconst.SPH_SPEED = window.shufflespeed;
                    
                    _appstate.save();
                    _appstate.gui.update();
                  } else if (window._last_error === undefined) {
                    window._last_error = lastval;
                    this.sph.points = startps;
                  }
                  
                  
                  iter = this.sph.shuffleGen(cconst, _appstate.shuffle_rfac, true, true);
                  lastval = undefined;
                  
                  return;
                } else {
                  lastval = ret.value;
                }
              }

              window.redraw_all();
            }, 100)
          }
          window.redraw_all();
          break;
        default:
          break;
      }
    }
    
    toggle_timer_loop() {
      if (this.timer === undefined) {
        let i = 0;
        this.timer = window.setInterval(() => {
          let time = util.time_ms();
          
          while (util.time_ms() - time < 150) {
            //if (i > cconst.TIMER_STEPS) {
            //  window.clearInterval(this.timer);
            //  this.timer = undefined;
            //}
            
            this.sph.step();
            this.gui.redrawCurves();
            window.redraw_all();
            //this.step();
            if (i % 8 == 0) {
              this.report(i, "totbase", this.sph.totbase, "ct", this.sph.ct);
            }
            i++;
          }
        }, 32);
      } else {
        window.clearInterval(this.timer);
        this.timer = undefined;
      }
    }
  }
  
  function start() {
    var animreq = undefined;
    function dodraw() {
      animreq = undefined;
      _appstate.draw();
    }
    
    window.redraw_all = function redraw_all() {
      if (animreq !== undefined) {
        return;
      }
      
      animreq = requestAnimationFrame(dodraw);
    }
    
    window._appstate = new AppState();
    
    var canvas = document.getElementById("canvas2d");
    _appstate.pushModal(canvas, true);

    if (STARTUP_FILE_NAME in localStorage) {
      try {
        _appstate.load(localStorage[STARTUP_FILE_NAME]);
      } catch(error) {
        util.print_stack(error);
        console.log("failed to load startup file");
        
        window._appstate = new AppState();
        _appstate.pushModal(canvas, true);
        
        console.log("started!");
        window.redraw_all();
      }
      
    } else {
      //make base file
      console.log("started!");
      window.redraw_all();
    }
    
    window.setInterval(function() {
      _appstate.on_tick();
    }, 250);
  }

  start();
  
  return exports;
});
