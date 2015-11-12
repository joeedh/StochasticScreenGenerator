var _report = undefined;

define([
  "util", "const"
], function(util, cconst) {
  'use strict';
  
  var report = _report = function report() {
    var s = ""
    
    for (var i=0; i<arguments.length; i++) {
      if (i > 0) s += " "
      s += arguments[i];
    }
    
    var lines = s.split("\n");
    
    for (var i=0; i<lines.length; i++) {
      _appstate.report(lines[i]);
    }
  }
  
  return report;
});
