var _sample_removal = undefined;

define([
  "util", "const", "interface"
], function(util, cconst, sinterface) {
  'use strict';
  
  var exports = _sample_removal = {};
  
  var Class = util.Class;
  var MaskGenerator = sinterface.MaskGenerator;
  
  var RemovalGenerator = exports.RemovalGenerator = Class(MaskGenerator, [
    function constructor(appstate) {
      MaskGenerator.call(this, appstate);
    },
    
    function step(custom_steps) {
    },
    
    function reset(appstate) {
      MaskGenerator.prototype.reset.apply(this, arguments);
    },
    
    function draw(g) {
      MaskGenerator.prototype.draw.call(this, g);
    },
    
    //optional
    function next_level() {
    },
    
    function regen_spatial() {
      MaskGenerator.prototype.regen_spatial.call(this);
    }
  ]);
  
  return exports;
});
