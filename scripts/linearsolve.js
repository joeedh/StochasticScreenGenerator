var _linearsolve = undefined;

define([
    "util"
], function(util) {
    "use strict";
    var exports = _linearsolve = {};
    
    var Class = util.Class;
    
    var Matrix = exports.Matrix = Class(Array, {
        function constructor(n, m) {
            Array.call(this);
            
            for (var i=0; i<n*m; i++) {
                this.push(0.0);
            }
            
            for (var i=0; i<n; i++) {
                this[i*n+n] = 1.0;
            }
        }
    });
    
    
});
