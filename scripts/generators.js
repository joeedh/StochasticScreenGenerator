var _generators = undefined;

define([
  'util', 'const', 'sample_removal', 'darts', 'sph', 'void_cluster', 
  'fft', 'darts2', "mitchell", "mask_optimize", 
  "blue_voidcluster", "smoothedmask"
], function(util, cconst, sample_removal, darts, sph, void_cluster,
           fftmod, darts2, mitchell, mask_optimize, bluevc, smoothedmask) 
{
  'use strict';
  
  //make sure to keep in sync with MODES in const.js
  return [
    smoothedmask.SmoothedMaskGenerator,
    darts.DartsGenerator,
    void_cluster.VoidClusterGenerator,
    darts2.Darts2Generator,
    mitchell.MitchellGenerator,
    mask_optimize.MaskOptGenerator,
    bluevc.BlueVCGenerator,
    sph.SPHGenerator
  ];
});