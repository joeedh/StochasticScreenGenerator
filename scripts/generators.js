var _generators = undefined;

define([
  'util', 'const', 'sample_removal', 'darts', 'sph', 'void_cluster', 
  'fft', 'darts2', "mitchell", "mask_optimize", 
  "blue_voidcluster", "smoothedmask", "void_cluster_cmyk", "interface", "TileOpt"
], function(util, cconst, sample_removal, darts, sph, void_cluster,
           fftmod, darts2, mitchell, mask_optimize, bluevc, smoothedmask,
            vccmyk, sinterface, tileopt)
{
  'use strict';
  
  return sinterface.generators;
});