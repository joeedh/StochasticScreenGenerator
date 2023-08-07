let _TileOpt;

define(["util", "vectormath", "interface", "const"],
  function (util, vectormath, sinterface, cconst) {
    "use strict";

    let exports = _TileOpt = {};

    let config = exports.config = {
      NUM_TILES           : 5,
      TEST_TILES          : 15
    };

    let Tile = exports.Tile = class Tile {
      constructor(idx) {
        this.idx = idx;
        this.points = [];
      }
    };

    let TileOptGenerator = exports.TileOptGenerator = class TileOptGenerator extends sinterface.MaskGenerator {
      constructor(appstate, dilute_small_mask) {
        super(appstate, dilute_small_mask);

        this.tiles = [];
        this.instances = [];
        this.numtiles = 5;
        this.skip_point_draw = false;
        this.dimen = 32;
      }

      static build_ui(gui) {
        var panel2 = gui.panel("Tile Opt");
        panel2.slider("NUM_TILES", "Tiles", 5, 1, 15, 1, true);
        panel2.slider("TEST_TILES", "Test Tiles", 5, 1, 35, 1, true);
      }

      reset(size, appstate, mask_image) {
        super.reset(size, appstate, mask_image);

        this.dimen = size;
        this.points = [];

        this.numtiles = this.config.NUM_TILES;
        this.testtiles = this.config.TEST_TILES;
        this.tiles = [];
        this.instances = [];


        for (let ti=0; ti<this.numtiles; ti++) {
          let r = this.get_radius();
          let tile = new Tile(ti);

          this.tiles.push(tile);

          for (let i = 0; i < size * size; i++) {
            let x = util.random();
            let y = util.random();

            let pi = tile.points.length;
            for (let j=0; j<PTOT; j++) {
              tile.points.push(0.0);
            }

            let gen = ti * size*size + i;

            tile.points[pi+PX] = x;
            tile.points[pi+PY] = y;
            tile.points[pi+PGEN] = tile.points[pi+PD] = i/(size*size);
            tile.points[pi+PR] = tile.points[pi+PR2] = r;
          }
        }

        this.r = 0.8 / (this.testtiles*this.dimen);

        console.log("Numtiles", this.tiles.length);
        this.throw();
      }

      get_radius() {
        return 0.8 / this.dimen;
      }

      is_done() {
        return false;
      }

      current_level() {
        return 10;
      }

      step(custom_steps, noreport) {

      }

      throw() {
        util.seed(0);

        this.points.length = 0;
        let ps = this.points;
        let r = this.get_radius();
        let dimen = this.dimen;

        let cx = this.celldimen = this.testtiles;

        cx = Math.max(cx, 1);
        let cellsize = this.cellsize = 1.0 / cx;

        for (let i=0; i<cx*cx; i++) {
          let tx = i % cx, ty = ~~(i / cx);

          let fx = tx/this.numtiles*5.0;
          let fy = ty/this.numtiles*5.0;

          let dx = Math.tent(fx);
          let dy = Math.tent(fy);
          let seed = Math.PI/4.0;

          let dx2 = Math.cos(seed)*dx + Math.sin(seed)*dy;
          let dy2 = Math.cos(seed)*dy - Math.sin(seed)*dx;

          let f = Math.sqrt(dx2*dx + dy2*dy);

          let a = ~~(f*this.numtiles);
          let tt = (i/(cx*cx))*this.numtiles*this.numtiles*6.05;
          tt += a;
          tt = ~~tt;

          let ti = tt % this.tiles.length;

          let tile =  this.tiles[ti];

          this.instances.push({
            tile, tx, ty
          });

          let ps2 = tile.points;
          for (let pi1=0; pi1<ps2.length; pi1 += PTOT) {
            let pi2 = ps.length;

            for (let k=0; k<PTOT; k++) {
              ps.push(ps2[pi1+k]);
            }

            ps[pi2+PX] = tx*cellsize + ps[pi2+PX]*cellsize;
            ps[pi2+PY] = ty*cellsize + ps[pi2+PY]*cellsize;

            this.find_mask_pixel(0, pi2);

            ps[pi2+PDX] = ti;
            ps[pi2+PDY] = pi1;
            ps[pi2+POX] = tx*cellsize;
            ps[pi2+POY] = ty*cellsize;
          }
        }

        this.maxgen = this.points.length;

        this.regen_spatial();
        this.raster();
      }

      step() {
        this.relax();
        this.regen_spatial();
        this.raster();
      }

      relax() {
        super.relax(...arguments);

        let cellsize = this.cellsize;

        for (let tile of this.tiles) {
          let ps = tile.points;
          for (let pi=0; pi<ps.length; pi += PTOT) {
            ps[pi+POLDX] = 0;
          }
        }


        let ps = this.points;
        for (let pi=0; pi<ps.length; pi += PTOT) {
          let x = ps[pi], y = ps[pi+1];

          let ti = ps[pi+PDX];
          let pi1 = ps[pi+PDY];

          let ox = ps[pi+POX];
          let oy = ps[pi+POY];

          let tile = this.tiles[ti];

          x = (x - ox) / cellsize;
          y = (y - oy) / cellsize;

          let ps2 = tile.points;
          if (ps2[pi1+POLDX] == 0) {
            ps2[pi1+PX] = ps2[pi1+PY] = 0.0;
          }

          ps2[pi1+PX] += x;
          ps2[pi1+PY] += y;

          ps2[pi1+POLDX] += 1.0;
        }

        for (let tile of this.tiles) {
          let ps = tile.points;
          for (let pi=0; pi<ps.length; pi += PTOT) {
            if (ps[pi+POLDX] > 0) {
              ps[pi+PX] /= ps[pi+POLDX];
              ps[pi+PY] /= ps[pi+POLDX];
              ps[pi+PX] = Math.fract(ps[pi+PX]);
              ps[pi+PY] = Math.fract(ps[pi+PY]);
            }
          }
        }

        for (let pi=0; pi<ps.length; pi += PTOT) {
          let x = ps[pi], y = ps[pi+1];

          let ti = ps[pi+PDX];
          let pi1 = ps[pi+PDY];

          let ox = ps[pi+POX];
          let oy = ps[pi+POY];

          let tile = this.tiles[ti];
          let ps2 = tile.points;

          ps[pi+PX] = ps2[pi1+PX]*cellsize + ox;
          ps[pi+PY] = ps2[pi1+PY]*cellsize + oy;
          this.find_mask_pixel(0, pi);
        }
      }

      max_level() {
        return 1.0;
      }

      draw(g) {
        console.log(this.points);
        g.beginPath();
        g.rect(0, 0, 1, 1);
        g.stroke();

        let cx = this.celldimen;
        let cellsize = this.cellsize;

        for (let inst of this.instances) {
          let tile = inst.tile;
          let tx = inst.tx * cellsize;
          let ty = inst.ty * cellsize;

          let i1 = tile.idx;

          g.beginPath();
          g.rect(tx, ty, cellsize, cellsize);
          g.stroke();

          let f = Math.fract(i1*0.1234*Math.sqrt(3.0));
          let r = Math.fract(f*3.0)*255;
          let g1 = Math.fract(f*5.0+0.5)*255;
          let b = Math.fract(f*4.5+0.25)*255;

          r = ~~r;
          g1 = ~~g1;
          b = ~~b;

          g.fillStyle = `rgba(${r},${g1},${b}, 0.5)`;
          g.fill();
        }
      }

    }

    sinterface.MaskGenerator.register(config, TileOptGenerator, "TILEOPT");

    return exports;
});