let CommandTypes = new Set([
  "STRING", "PATH", "BOOL", "INT", "FLOAT", "ENUM", "CMD"
]);

let numre = /[0-9a-fxfeEX\.\-]/

function isNumber(s) {
  if (typeof s == "number" || typeof s == "boolean")
    return true;
  
  s = s.toLowerCase();
  if (s.startsWith("0x") || s.startsWith("-0x")) {
    return true;
  }
  
  return !isNaN(parseFloat(s));
}

let CommandArg = exports.CommandArg = class CommandArg {
  constructor(key, type, help, defaultval, cb, short) {
    this.help = help;
    this.key = key;
    this.type = type;
    this.cb = cb;
    this.defaultval = defaultval;
    this._trigger = false; //used by parse function to defer firing events
    this.not_in_json = false;
    this.short = short;
  }
  
  callback(cb) {
    this.cb = cb;
    return this;
  }
  
  process(val, parser) {
    if (this.type == "STRING" || this.type == "PATH") {
      val = parser.templateReplace(val);
    }
    
    return val;
  }
  
  shortkey(key) {
    this.short = key;
    return this;
  }
  
  notInJSON() {
    this.not_in_json = true;
    return this;
  }
}

let CommandEnum = exports.CommandEnum = class CommandEnum extends CommandArg {
  constructor(enumdef, key, help, defaultval, cb, short) {
    super(key, "ENUM", help, defaultval, cb, short);
    
    this.enumdef = enumdef;
    
    //if (defaultval !== undefined) {
    //this.defaultval = enumdef[defaultval];
    //}
  }
      
  process(val, parser) {
    if (!(val in this.enumdef)) {
      let keys = [];
      for (let k in this.enumdef) {
        keys.push(k);
      }
      
      parser.error(`Invalid value ${val}, expected one of ${keys}`);
    }
    
    return this.enumdef[val];
  }
}

let CommandParse = exports.CommandParse = class CommandParse {
  constructor(binname) {
    this.config = {};
    this.binname = binname;
    this.commands = [];
    this.shortmap = {};
    this.keymap = {};
  }
  
  error(msg) {
    console.log(this.printHelp());
    console.log(msg);
    process.exit(-1);
  }
  
  loadJSON(obj) {
    if (typeof obj == "string") {
      obj = JSON.parse(obj);
    }
    
    for (let key of obj) {
      this.config[key] = obj[key];
    }
    
    return this;
  }
  
  templateReplace(s) {
    function escape(key) {
      let ret = ""
      
      for (let i=0; i<key.length; i++) {
        let c = key[i];
        
        if (c == "." || c == "[" || c == "]" || c == "(" || c == ")"
            || c == "{" || c == "}" || c == "$" || c == "*" || c == "+" 
            || c == "-" ||  c == "?" || c == "<" || c == ">" || c == "/"
        ) {
          c = "\\" + c
        }
        
        ret += c;
      }
      
      return new RegExp(ret, "g");
    }
    
    for (let k in this.config) {
      let v = this.config[k];
      let key = escape("${" + k + "}");
      
      s = s.replace(key, ""+v);
    }
    
    return s;
  }
  
  makeJSON() {
    let obj = {};
    
    for (let cmd of this.commands) {
      if (cmd.not_in_json)
        continue;
      if (cmd.type == "CMD" || cmd.defaultval === undefined)
        continue;
      
      
      obj[cmd.key] = cmd.defaultval;
    }
    
    return JSON.stringify(obj, undefined, 2);
  }
  
  parseCmdLine(args) {
    let args2 = [];
    
    //fix things like splitting apart --arg=bleh (as opposed to --arg = bleh)
    //etc
    for (let a of args) {
      a = a.trim();
      
      if (a.startsWith("=")) {
        a = a.slice(1, a.length);
      }
      
      if (a.match("=")) {
        a = a.split("=");
        args2.push(a[0]);
        args2.push(a[1]);
      } else {
        args2.push(a);
      }
    }
    
    args = args2;
    let error = false;
    
    for (let i=0; i<args.length; i++) {
      let key, cmd;
      
      if (args[i].startsWith("--")) {
        key = args[i].slice(2, args[i].length);
        cmd = this.keymap[key];
        
        if (cmd === undefined) {
          this.error("Unknown argument", args[i]);
          error = true;
          continue;
        }
      } else if (args[i].startsWith("-")) {
        key = args[i].slice(1, args[i].length);
        cmd = this.shortmap[key];
        
        if (cmd === undefined) {
          this.error("Unknown argument", args[i]);
          error = true;
          continue;
        }
      } else {
        this.error("Unknown argument", args[i]);
        error = true;
        continue;
      }
      
      let have_next = i < args.length - 1;
      have_next = have_next && !(args[i+1].startsWith("-") && !isNumber(args[i+1]));
      
      if (have_next && cmd.type != "CMD") {
        this.config[cmd.key] = args[++i];
        cmd._trigger = 2;
      } else {
        cmd._trigger = 1;
      }
    }
    
    for (let cmd of this.commands) {
      if (cmd.type != "CMD" && this.config[cmd.key] !== undefined) {
        this.config[cmd.key] = cmd.process(this.config[cmd.key], this);
      }
    }
    
    for (let cmd of this.commands) {
      if (cmd._trigger && cmd.cb) {
        cmd.cb(this.config[cmd.key]);
      }
    }
    
    return error;
  }
  
  add(cmd) {
    this.calcShort(cmd);
    this.commands.push(cmd);
    
    this.shortmap[cmd.short] = cmd;
    this.keymap[cmd.key] = cmd;
    
    if (cmd.defaultval !== undefined) {
      this.config[cmd.key] = cmd.defaultval;
    }
    
    return this;
  }
  
  printHelp() {
    let s = "\nusage: " + this.binname + " [options]\n\n";
    
    let args = [];
    let lines = [];
    let maxarg = 0;
    
    for (let cmd of this.commands) {
      let help = cmd.help;
      let arg = `--${cmd.key}, -${cmd.short}`;
      
      if (cmd.type == "ENUM") {
        help = help.trim();
        if (!help.endsWith(".")) {
          help += ".";
        }
        
        help += " Must be one of ["
        let i = 0;
        for (let k in cmd.enumdef) {
          if (i > 0)
            help += ", ";
          help += k;
          i++
        }
        help += "]";
      } else {
        arg += ` [${cmd.type.toLowerCase()}]`;
      }
      
      maxarg = Math.max(maxarg, arg.length);
      args.push(arg);
      lines.push(help);
    }
    
    let indent = maxarg
    
    for (let i=0; i<lines.length; i++) {
      let tab = indent - args[i].length;
      let line = "";
      
      line += args[i];
      for (let j=0; j<tab; j++) {
        line += " ";
      }
      line += " : "
      
      let words = lines[i].split(/[ \t]/g)
      let totline = 1;
      
      for (let w of words) {
        if (line.length + w.length + 1 > 79) {
          s += line + "\n";
          line = "";
          
          for (let j=0; j<indent+3; j++) {
            line += " ";
          }
          totline++;
        }
        
        line += w + " ";
      }
      s += line + "\n";
      if (totline > 1) {
        s += "\n"
      }
    }
    
    return s
  }
  
  int(key, defaultval, help) {
    let ret = new CommandArg(key, "INT", help, defaultval);
    this.add(ret);
    return ret;
  }

  float(key, defaultval, help) {
    let ret = new CommandArg(key, "FLOAT", help, defaultval);
    this.add(ret);
    return ret;
  }
  
  bool(key, defaultval, help) {
    let ret = new CommandArg(key, "BOOL", help, defaultval);
    this.add(ret);
    return ret;
  }
  
  command(key, defaultval, help) {
    let ret = new CommandArg(key, "CMD", help, defaultval);
    this.add(ret);
    return ret;
  }
  
  path(key, defaultval, help) {
    let ret = new CommandArg(key, "PATH", help, defaultval);
    this.add(ret);
    return ret;
  }
  
  enum(key, enumdef, defaultval, help) {
    let ret = new CommandEnum(enumdef, key, help, defaultval);
    this.add(ret);
    
    return ret;
  }
  
  calcShort(cmd) {
    let short = "";
    
    if (cmd.key.length == 1) {
      short = cmd.key;
    } else if (!(cmd.key[0] in this.shortmap)) {
      short = cmd.key[0];
    } else {
      let ls = cmd.key.split("_");
      if (ls.length < 2) {
        ls = cmd.key.split("-");
      }
      
      if (ls.length < 2) {
        ls = [cmd.key[0], cmd.key[1]];
      } else {
        ls = [ls[0][0], ls[1][0]]
      }
      
      short = ls[0] + ls[1];
    }
    
    for (let c of this.commands) {
      if (c.short == short) {
        return false; 
      }
    }
    
    cmd.short = short;
    return true;
  }
  
  printConfig() {
    let s = "Configuration:\n"
    let keys = [];
    let vals = [];
    let maxkey = 0;
    
    for (let k in this.config) {
      let v = this.config[k];
      let cmd = this.keymap[k];
      
      if (1) { //v != cmd.defaultval) {
        keys.push(k);
        maxkey = Math.max(maxkey, k.length);
        
        if (cmd.type == "PATH" || cmd.type == "STRING") {
          v = '"' + v + '"';
        } else if (cmd.type == "ENUM") {
          let v2 = v;
          v = "(invalid value)";
          
          for (let k in cmd.enumdef) {
            if (cmd.enumdef[k] == v2) {
              v = k;
            }
          }
        } else {
          v = ""+v;
        }
        vals.push(v);
      }
    }
    
    let indent = maxkey;
    for (let i=0; i<keys.length; i++) {
      let tab = indent - keys[i].length;
      
      s += "  " + keys[i]
      
      for (let j=0; j<tab; j++) {
        s += " ";
      }
      
      s += " : " + vals[i] + "\n";
    }
    
    return s;
  }
}
