Stochastic Screen Generator (for printing, stippling, etc)
==========================================

This little web app generates stochastic (blue noise) screens
for digital halftoning/stippling.  It has four methods:

* Dart:  Classic, progressive dart throwing.  Generates
  the highest quality masks.
  
* SPH: SPH fluid method.  Not quite as good as dart, and 
  a bit harder to control.  Is much slower at higher resolutions.
  
* Jitter: A very simple randomlized hexagonal grid method.  Produces
  the worst results
  
* AA: AA patterns, optimized to have blue noise properties via the SPH
      method.  Based on papers by Abdalla G. M. Ahmed, but modified to use skewed 
      grids and a dynamic threshold limit instead of a fixed one.

Usage
==========================
