//for node compatibility
if (typeof define == "undefined") {
  define = function define(deps, callback) {
    var module = callback();
    module.test();
  }
}

var _cz = undefined;
define([], function() {
  'use strict';
  var exports = _cz = {};
    
  if (Array.prototype.fill == undefined) {
    Array.prototype.fill = function(val, a, b) {
      for (var i=a; i<b; i++) {
        this[i] = val;
      }
    }
  }

  var five_to_eight = exports.five_to_eight = function five_to_eight(fives) {
    var ret = [];
    var last = fives[0];
    
    var sum = 0, bits = 8;
    var rem = undefined;
    
    var _i = 0;
    
    var i = 0;
    
    var bits = fives.length*5;
    var bytes = Math.ceil(bits/8);
    
    for (var i=0; i<bytes; i++) {
      var sum = 0;
      
      for (var j=0; j<8; j++) {
        var bit = i*8 + j;
        var five = ~~(bit / 5);
        var subbit = bit % 5;
        
        if (five >= fives.length) {
          break;
        }
        
        bit = !!(fives[five] & (1<<subbit));
        sum = sum | (bit << j)
      }
      
      ret.push(sum);
    }
    
    return ret;
  }

  var eight_to_five = exports.eight_to_five = function eight_to_five(chars) {
    var ret = [];
    var last = chars[0];
    
    var sum = 0, bits = 8;
    var rem = undefined;
    
    var _i = 0;
    
    var i = 0;
    
    var bits = chars.length*8;
    var bytes = Math.floor(bits/5);
    
    for (var i=0; i<bytes; i++) {
      var sum = 0;
      
      for (var j=0; j<5; j++) {
        var bit = i*5 + j;
        var eight = ~~(bit / 8);
        var subbit = bit % 8;
        
        if (eight >= chars.length) {
          break;
        }
        
        bit = !!(chars[eight] & (1<<subbit));
        sum = sum | (bit << j)
      }
      
      ret.push(sum);
    }
    
    return ret;
  }

  var compress = exports.compress = function compress(chars) {
    if (typeof chars == "string") {
      var c2 = [];
      
      //encode into utf-8, if necassary
      for (var i=0; i<chars.length; i++) {
        var c = chars.charCodeAt(i); //IIRC, js strings are 16-bit unicode, but without continuation bits
        //but, for now just ignore
        
        c2.push(c);
      }
      chars = c2;
    }
    
    var d = new Array(255);
    d.fill(0, 0, d.length);
    
    for (var i=0; i<chars.length; i++) {
      d[chars[i]]++; 
    }
    
    var d2 = new Array(255);
    for (var i=0; i<255; i++) {
      d2[i] = i;
    }
    d2.sort(function(a, b) {
      return d[b] - d[a];
    });
    
    var dictsize = 15;
    var dict = new Array(255);
    dict.fill(-1, 0, dict.length);
    
    for (var i=0; i<dictsize; i++) {
      dict[d2[i]] = i+1;
    }
    
    var chars2 = [dictsize];
    for (var i=0; i<dictsize; i++) {
      chars2.push(d2[i]);
    }
    
    var fives = [];
    for (var i=0; i<chars.length; i++) {
      var c = chars[i];
      var key = dict[c];
      
      if (key > 0) {
        fives.push(key);
        //console.log("KEY", key);
      } else {
        fives.push(0);
        fives.push(c & 31);
        fives.push((c>>5) & 31);
      }
    }
    
    var ret = five_to_eight(fives);
    for (var i=0; i<ret.length; i++) {
      chars2.push(ret[i]);
    }
    
    return chars2;
  }

  var decompress = exports.decompress = function decompress(chars) {
    var dictsize = chars[0];
    var dict = chars.slice(1, dictsize+1);
    
    var fives = eight_to_five(chars.slice(dictsize+1, chars.length));
    var ret = [];
    
    var i = 0;
    while (i < fives.length) {
      if (fives[i] == 0) {
        i++;
        
        var c = fives[i++] | ((fives[i++]<<5) & 7);
        //console.log("B", c);
        
        ret.push(c);
      } else {
        var c = fives[i];
        //console.log("C", c);
        ret.push(dict[c-1]);
        
        i++;
      }
    }
    
    return ret;
  }

  exports.test = function() {
    //var test = [31, 30, 31, 30, 29, 0, 31, 18, 7]; 
    var test = [30, 24, 22, 8, 7, 5, 16, 15, 7, 9, 27, 30];

    var r = five_to_eight(test);
    console.log(test);
    console.log(r);
    //console.log(test.length, r.length);
    console.log(eight_to_five(r));

    decompress(compress(test));

    var u = new Int32Array(2048*4);

    for (var i=0; i<u.length/9; i++) {
      var ri = ~~(Math.random()*u.length*0.99999);
      u[i] = ~~(Math.random()*((1<<8)-1));
    }

    u = new Uint8Array(u.buffer);
    var test = u;
    var test2 = compress(compress(test));

    console.log(test.length, test2.length);
  }
  
  return exports;
});
