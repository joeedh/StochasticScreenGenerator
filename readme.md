Stochastic Screen Generator (for printing, stippling, etc)
==========================================

[Click here to try it out](http://joeedh.github.io/StochasticScreenGenerator/bluenoise9.html)

This little web app generates stochastic (blue noise) screens
for digital halftoning/stippling.  It has four methods:

* Void-and-cluster: A classic, this one works best for generating
  stochastic screens for printers.
  
* Dart:  Classic, progressive dart throwing.  Generates
  the highest quality masks.
  
* SPH: SPH fluid method.  Not quite as good as dart, and 
  a bit harder to control.  Is much slower at higher resolutions.
  
* Jitter: A very simple randomlized hexagonal grid method.  Randomizes the
  hiearhcial levels, not the point positions.  Mostly for reference purposes.
  Produces the worst results.
  
* AA: AA patterns, optimized to have blue noise properties via the SPH
      method.  Based on papers by Abdalla G. M. Ahmed, but modified to use skewed 
      grids and a dynamic threshold limit instead of a fixed one.

Usage
=====

Load bluenoise9.html in a web browser.  Press "Start Generating".

![example image](http://joeedh.github.io/StochasticScreenGenerator/examples/Startup.png "Example")

Using with Blue Noise Stippler
==============================
To test the generated masks, you can use [this stippling app of mine](https://github.com/joeedh/BlueNoiseStippling).
[Here's a direct link](http://joeedh.github.io/BlueNoiseStippling/bluenoise6.html) to the app itself.

Click on the "Save To Cache" button on the lower-right side of the screen.  You should see a 
message like "saving blue noise mask to local storage."  You should be able to use the new mask
in the stippling app.

FFT
===
The FFT power spectrum feature is ported [from PSA](https://github.com/nodag/psa).
I recommend using it with "dimensions" set to 50 or less (I usually use 32).





