#!/usr/bin/env node

let cparse = require("./cmdparse");
let fs = require("fs");

global.window = global;
global.self = global;

global.ImageData = class ImageData {
  constructor(width, height) {
    this.data = new Uint8Array(width*height*4);
    this.width = width;
    this.height = height;
  }
}

//various stubs for dat
//we load the ui code because
//that's where the curve code lives
global.document = {
  _makeNullDOMNode : () => {
    return {
      appendChild : () => {},
      childNodes : [],
      style : {}
    }
  },
  createElement : () => {return {}},
  getElementsByTagName : () => { return [document._makeNullDOMNode()];}
};

//an appstate stub
global._appstate = {
  constructor() {
    this._no_reports = false;
  },
  
  report() {
    if (this._no_reports) {
      return;
    }
    
    let s = "";
    
    for (let i=0; i<arguments.length; i++) {
      s += arguments[i] + " ";
    }
    
    console.log(s);
  }
}

let rjs = require("requirejs")
let pngjs = require("pngjs");

function writePNG(image, path) {
  var PNG = pngjs.PNG;

  var newfile = new PNG({width:image.width,height:image.height});

  let d1 = newfile.data, d2 = image.data;
  for (let i=0; i<d1.length; i++) {
    d1[i] = d2[i];
  }

  newfile.pack()
    .pipe(fs.createWriteStream(path))
    .on('finish', function() {
      console.log(`wrote ${path}`);
    });
}

window.HEADLESS_APP = true;

rjs.config({
    //Pass the top-level main.js/index.js require
    //function to requirejs so that node modules
    //are loaded relative to the top-level JS file.
    nodeRequire: require,
    baseUrl: __dirname + "/scripts"
});
rjs(["util", "interface", "ui", "generators", "app"], 
    (util, iface, ui, generators, app) => 
{
  "use strict";
  
  //patch time_ms
  util.time_ms = () => {
    return Number(process.hrtime.bigint()) / (1024 * 1024);
  }

  function makeOptions() {
    let options = new cparse.CommandParse("node bluegen.js");

    options.enum("generator", {
      SMOOTHMASK : 0,
      DART : 1,
      VOIDCLUSTER : 2,
      MITCHELL : 4
    }, "VOIDCLUSTER", "Mask Generator");

    options.command("help", undefined, "Print this help").callback(() => {
      console.log(options.printHelp());
      process.exit(0);
    });
    
    options.path("out", "mask${dimen}.png", "Output path");
    options.path("gen_csource", "masksrc.c", "Generate C source code").callback((path) => {
    });
    
    options.bool("large_mask", false, "Generate larger mask with black space around mask pixels");
    options.int("dimen", 32, "Dimension of generated mask");
    options.float("filterwid", 1.25, "Void-cluster/SPH/etc filter kernel width");

    options.path("config", undefined, "use config json").notInJSON();
    options.int("seed", 0, "random seed")
    
    options.path("make_config", "config.json", "Generate default config file").callback(() => {
      console.log(options.printConfig());

      let json = options.makeJSON(undefined);
      let path = options.config.make_config;
      
      console.log("writing default configuration to", path);
      fs.writeFileSync(path, json);
      //console.log(json, path)
      
      process.exit(0);
    }).notInJSON().notInCfgList();
    
    return options;
  }

  function makeGuassianCurve(setting_id) {
    let curve = new ui.Curve(setting_id);
    curve.switchGenerator(ui.CurveTypes.GUASSIAN);
    return curve;
  }

  function genMaskConfig(options) {
    let config = options.config;
    let cf = new iface.MaskConfig();
    
    cf.SEED = options.config.seed;
    cf.USE_TONE_CURVE = false;
    cf.CMYK = false;
    cf.GEN_MASK = true;
    cf.FFT_TARGETING = false;
    cf.SPH_CURVE = makeGuassianCurve("SPH_CURVE");
    cf.TILABLE = true;
    cf.VC_FILTERWID = config.filterwid;
    cf.VOIDCLUSTER_CURVE = makeGuassianCurve("VOIDCLUSTER_CURVE");
    cf.SEARCHRAD = cf.SEARCHRAD2 = config.filterwid;
    cf.DIMEN = config.dimen;
    cf.SMALL_MASK = !config.large_mask;
    cf.LARGE_MASK_NONZERO_OFFSET = 0;
    
    return cf;
  }
  
  function generate(options, mconfig) {
    let start_time = util.time_ms();

    let gen = generators[options.config.generator]
    gen = new gen(_appstate, true);
    
    let dimen = mconfig.DIMEN;
    
    _appstate.generator = gen;
    _appstate.mask = new ImageData(dimen, dimen);
    _appstate._no_reports = true;

    gen.set_config(mconfig);
    gen.reset(dimen, _appstate, _appstate.mask, generators);
    
    let last_time = util.time_ms();
    
    while (!gen.done()) {
      gen.step(1);
      
      if (util.time_ms() - last_time > 275) {
        console.log("points:", gen.points.length/PTOT, (util.time_ms()-start_time).toFixed(2) + "ms");
        last_time = util.time_ms();
      }
    }
    
    gen.raster();
    writePNG(_appstate.mask, options.config.out);
    
    _appstate._no_reports = false;
    
    if (options.config.gen_csource) {
      let path = options.config.gen_csource;
      let data = app.AppState.prototype.gen_cmatrix.call(_appstate);
      fs.writeFileSync(path, data);
      console.log(`wrote ${path}`);
      //console.log(data);
    }
  }
  
  let options = makeOptions();

  //console.log(process.argv)
  options.parseCmdLine(process.argv.slice(2, process.argv.length))
  if (options.config.config) {
    let json = fs.readFileSync(options.config.config, "utf8")
    json = JSON.parse(json);
    options.loadJSON(json);
  }
  console.log(options.printConfig());
  
  let mconfig = genMaskConfig(options);
  
  generate(options, mconfig);
  //console.log(mconfig)
});

