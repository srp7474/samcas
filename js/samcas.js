// samcas.js - Cascaded SAM implementation
/*
 Change History:
   EC0714 - Original.
*/
/*
 @license
 Copyright (c) 2020 by Steve Pritchard of Rexcel Systems Inc.
 This file is made available under the terms of the Creative Commons Attribution-ShareAlike 3.0 license
 http://creativecommons.org/licenses/by-sa/3.0/.
 Contact: public.pritchard@gmail.com
*/

"use strict";

/*
The first section defines the classes we use.

The 2nd section gives some basic routines.

samcas design notes

  THIS IS NOT YET FLESHED OUT here and in the whole file

 1. no virtual DOM, no compiling. Just inject HTML.
 2. Cascade simplifies each model.
 3. form elements bound to model by elem-gen
 4. replayable by recordin g actions
 5. get dependent code in one place.
 6. string symbols key to maintainable programs

 state tables
 state names - static name such as ssEngaged
 signal names - present tense such as sgEngaging
*/

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/////////////////////////////////  State ///////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function State(view,state) {
  //console.log("State %o",{mdl:mdl,state:state});
  this.state = state;
  if (!view[state]) view[state] = "{{> frame}}"; // default view
}

State.prototype = (function() {
  var f = {constructor:State};   // ----------- exported routines -------------
  f.next = function(nextStr) {
    this.next = nextStr;
    return this;
  }
  f.nap = function(funcStr) {
    this.nap = funcStr;           // flip to function in factory
    return this;
  }
  f.allow = function(action,funcStr) {
    if (!this.hasOwnProperty('allow')) this.allow = {};
    this.allow[action] = funcStr; // flip to function in factory
    return this;
  }
  f.ignore = function(ignStr) {
    this.ignore = ignStr;
    return this;
  }
  f.skipDisplay = function() {
    this.skipDisplay = true;
    return this;
  }
  f.signal = function(signalStr) {
    this.signal = signalStr;
    return this;
  }
  f.weakSignal = function(signalStr) {
    this.signal = signalStr;
    this.weakSignal = true;
    return this;
  }
  return f;
}());                             // -------- end State prototype -------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/////////////////////////////////  Action //////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function Action(mdl,action) {
  console.log("Action %o",{mdl:mdl,action:action});
  this.action = action;
}

Action.prototype = (function() {
  var f = {constructor:Action};   // ----------- exported routines -------------
  return f;
}());                             // -------- end State prototype -------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///////////////////////////////// SamApp ///////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function SamApp(samModel) {
  this.model = samModel;
  this.appBase = "app-base";
  if (!this.model.mdlBase) this.model.mdlBase = this.appBase
}

SamApp.prototype = (function() {
  var f = {constructor:SamApp};   // ----------- exported routines -------------
  return f;
}());                             // -------- end SamApp prototype -------------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///////////////////////////////// SamModel /////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function SamModel(samActions,samState,samView,parent) {
  this.actions          = samActions;
  this.state            = samState;
  this.view             = samView;
  this.samBusy          = false;
  this.samQ             = [];
  samActions.model      = this;
  samState.model        = this;
  samView.model         = this;
  this.strState         = "ss-virgin";
  this.mid              = samc.getNextMdl(); //unique model id
  samc.mdlMap[this.mid] = this;
  this.cfg              = {};
  this.cfg['elem-gen']  = function() {return samc['elem-gen']};
  if (parent) {
    this.parent = parent;
    parent.addKid(this);
  }
}

SamModel.prototype = (function() {
  var f = {constructor:SamModel};   // ----------- exported routines -------------

  /* traditional parent/children relationship handler
  */
  f.addKid = function(kid) {
    if (!this.kids) this.kids = [];
    this.kids.push(kid);
  }

  // remove a chile from relationship
  f.dispose = function(kid) {
    var kidIx = -1;
    for(var i=0; i < this.kids.length; i++) {
      if (this.kids[i] === kid) {
        kidIx = i;
        break;
      }
    }
    if (kidIx == -1) throw "kid lost during disposal "+kid.samName;
    kid.parent = null;
    this.kids.splice(i,1);
  }

  // fire off the initial state
  f.activate = function() {
    if (this.state.stepMap['ss-virgin']) {
      if (this.state.stepMap['ss-virgin'].next) {
        this.present('ss-virgin',this.state.stepMap['ss-virgin'].next);
      } else {
        throw "lost ss-virgin.next state map"
      }
    } else {
      throw "lost ss-virgin state map"
    }
  }

  // set a new value to strState (not yet used)
  f.setState = function(newState) {
    console.log("setState %s from %s %o",newState,this.strState,{model:this});
  }

  // tests whether in on of a list of states
  f.inState = function(testStates) {
    if (testStates.indexOf(this.strState) >= 0) return true;
    return false;
  }

  /*
  The lynchpin of the whole system. Thank you Jean-Jacques Dubray.

  present - does premiminary validation and then hands it off to the state.step function
  to make any state transistions and model value changes.

  Can also be called to directly issue an action when newState is numm and the action can
  perhaps modify the state.

  As the final step it does the render function which is where we render the view
  and potentially make any nap function calls. (Sequence important)

  It is assumed this function is serialized and never entered concurrently.  Hence a Queue.
  case a queue needs to be placed in front so that this is the case.  In the case of the
  browser, this is automatically the case because we run on the main task.  If worker tasks
  are added to the mix then a queue mechanism will need to be added. This is left as an exercise
  for the reader.
  */

  f.present = function(expState,newState,stepParms) {
    if (this.samBusy) {            // ------------ queue up to simplify --------
      this.samQ.push({expState:expState,newState:newState,stepParms:stepParms});
      return;
    }
    this.samBusy = true;
    var strType = "new="+(newState?newState:"?");
    if ((newState == null) && stepParms && stepParms.action) strType = "act="+stepParms.action;
    console.log("---- present %s exp=%s %s %o",(this.samName?this.samName:"?"),expState,strType,{model:this,stepParms:stepParms});
    if (!this.inState(expState)) { // ------------- validate ------------
      var bIgnore = false;
      if ((newState == null) && (stepParms && stepParms.action && this.state.stepMap[this.strState])) {
        var stepObj = this.state.stepMap[this.strState];
        if ((stepObj.ignore) && (stepObj.ignore.indexOf(stepParms.action) >= 0)) bIgnore = true;
      }
      if (!bIgnore) console.log("concurrency error expect=%s have=%s newState=%s %o",expState,this.strState,newState,{stepParms:stepParms});
      // for now we return. could also enter ss-broken state.
    } else {                                       // validated OK. apply transformation
      var oldState = this.strState;
      var retObj = this.state.step(this,newState,stepParms) || null;    // apply step function
      if (oldState != this.strState) {             // if we have a change, try everything
        this.view.render(this,newState,stepParms);
        this.state.nextAction(this,newState,stepParms);
        this.state.raiseSignal(this,newState,stepParms);
      } else {                                     // allow action to specify
        if (retObj) {
          if (retObj.render) this.view.render(this,newState,stepParms);
          if (retObj.nap)    this.state.nextAction(this,newState,stepParms);
          if (retObj.signal) this.state.raiseSignal(this,newState,stepParms);
        }
      }
    }
    this.samBusy = false;           // --------- dequeue, process remaining queue ---
    console.log("---- present.exit %s ",(this.samName?this.samName:"?"),{model:this});
    if (this.samQ.length > 0) {
      var q = this.samQ.shift();
      this.present(q.expState,q.newState,q.stepParms);
    }
	}
  return f;
}());                               // ---------- end SamModel prototype -------


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///////////////////////////////// SamState /////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/* state machine note
  no next state is terminal
  no next but nap is a terminal transition

*/
function SamState() {
  this.stepMap = {};
  this.stepMap['ss-broken'] = {};
}

SamState.prototype = (function() {
  var f = {constructor:SamState};  // ----------- exported routines ------------

  f.broken = function(model,errMsg) {              //force broken state
    model.strState = 'ss-broken';
    model.err      = errMsg;
  }

  f.step = function(model,newState,stepParms) {    // step function.
    //console.log("step %o",{model:model,newState:newState,stepParms:stepParms});
    var retObj = {};
    if (newState) {
      // --- newState specified ---
      if (this.stepMap[model.strState] && this.stepMap[model.strState].next && this.stepMap[model.strState].next.indexOf(newState) >= 0) { // check allowed to go there
        if (!newState.match(/^sg/)) { // SGs do not cause state change. Later add overide in stepParms if needed
          model.strState = newState;
        }
      } else if (newState.match(/sg/) && this.stepMap[newState] && this.stepMap[newState].nap) { // check signal handler specified
        retObj.nap =true;
      } else { // not allowed to go there
        if (!newState.match(/^sg/)) { // SGs do not need next entry, just keep existing state
          model.err = "cannot transition from '"+model.strState+"' to '"+newState+"'";
          model.strState = 'ss-broken';
        }
      }
      // --- no newState but action ---
    } else if (stepParms && stepParms.action && (this.stepMap[model.strState]).allow && (this.stepMap[model.strState]).allow[stepParms.action]) { // if allowed to apply action
      retObj = (this.stepMap[model.strState]).allow[stepParms.action](model,stepParms) || {};
    } else if (stepParms && stepParms.action && (this.stepMap[model.strState]).ignore && ((this.stepMap[model.strState]).ignore.indexOf(stepParms.action) >= 0)) {
      // quietly ignore
    } else {
      if (stepParms.action && stepParms.actionUniversal) {
        if (model.actions.funcMap[stepParms.action]) {
          retObj = model.actions.funcMap[stepParms.action](model,stepParms) || {};
        } else {
          model.err = "cannot transition from '"+model.strState+"' with action '"+JSON.stringify(stepParms)+"'";
          model.strState = 'ss-broken';
        }
      } else {
        model.err = "cannot transition from '"+model.strState+"' with action '"+JSON.stringify(stepParms)+"'";
        model.strState = 'ss-broken';
      }
    }
    return retObj;
  }


  // Next action predicate, derives whether
  // the system is in a (control) state where
  // an action needs to be invoked
  f.nextAction = function(model,newState,stepParms) {
    //console.log("nextAction %s %o",newState,{model:model});
    var useState = model.strState;
    if (newState && newState.match(/^sg/) && model.state.stepMap[newState]) useState = newState;
    if (model.state.stepMap[useState].nap) {
      model.state.stepMap[useState].nap(model,newState,stepParms);
    }
  }


  f.raiseSignal = function(model,newState) {               //raise signal
    var stepObj = this.stepMap[model.strState];
    if (stepObj.signal) {
      var signal = stepObj.signal;
      if (model.parent) {
        console.log("raising signal %s %o",signal,{model:model});
        model.parent.present(model.parent.strState,signal,{kid:model});
      } else {
        if (!model.state.stepMap[model.strState].weakSignal) {
          console.warn("signal required but no parent %s %o",signal,{model:model});
        }
      }
    }
  }
  return f;
}());                              // -------- end SamState prototype ----------

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///////////////////////////////// SamView //////////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function SamView() {
  this['ss-broken'] = "<p>Model broken:{{err}}</p>"
}

SamView.prototype = (function() {
  var f = {constructor:SamView};  // ----------- exported routines ------------

  f.render = function(model,newState,stepParms) {            //render function
    //console.log("render %o",{this:this,model:model,newState:newState,stepParms:stepParms});
    var display = true;
    var useState = model.strState;
  	if (!model.state.stepMap[useState]) {
  	  model.err = "no stepMap for state '"+useState+"'";
	    model.strState = 'ss-broken';
	  } else {
      if (!model.view.hasOwnProperty(useState)) {
        model.err = "no view for state '"+useState+"'";
        model.strState = 'ss-broken';
      }
    }
    representation(model,newState,stepParms);
	  if (model.kids) model.kids.forEach(function(kid) {
    	var elem = document.getElementById(kid.mdlBase);
    	if (elem) { // ignore if child not present
	      kid.present(kid.strState,null,{action:"sa-repaint",actionUniversal:true}); // paint children
	    }
	  });
  }

  function representation(model,newState,stepParms) {                   //representant (displlay) state
    var strRep = model.view[model.strState];
    if (strRep.length == 0) return;                  //ignore representation, propbably needs terminal nap
    strRep = Mustache.render(strRep,model,model.view);
    //console.log("moustach.render %o",{strRep:strRep});
	  display(model,model.view,strRep,stepParms);
  }

  function display(model,view,representation,stepParms) {           // display function
  	var elem = document.getElementById(model.mdlBase);
    //console.log("display %o",{elem:elem,model:model,representation:representation});
  	var css = "";
  	if (view.css) {
  	  if (!model['css-parsed']) model['css-parsed'] = Mustache.render(view.css,model);
	    css = model['css-parsed'];
  	}
  	if (!elem) {
  	  if (!stepParms || !stepParms.action || (stepParms.action != "sa-repaint")) { // quietly ignore repaints
    	  console.warn("lost elem %o",{model:model,stepParms:stepParms});
    	  samc.samAlert("Lost elem "+model.mdlBase+" in "+model.samName+" displaying "+representation)
  	    samc.samAbort("cannot continue. lost "+model.mdlBase);
  	  }
  	} else {
  	  elem.innerHTML = css + representation;
  	}
	}

  return f;
}());                              // -------- end SamView prototype ----------


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///////////////////////////////// SamActions ///////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function SamActions() {
  this.funcMap = {};
  this.funcMap['sa-repaint'] = function(model,evt) {
    //console.log("sa-repaint %s %o",model.samName,{evt:evt,model:model});
    return {render:true};
  }
}

SamActions.prototype = (function() {
  var f = {constructor:SamActions};  // ----------- exported routines ------------

  f.addFunc = function(funcName,funcCode) {
    if (!this.funcMap) this.funcMap = {};
    this.funcMap[funcName] = funcCode;
  }

  return f;
}());                              // -------- end SamActions prototype ----------


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
////////////////////////////// SamCas Statics //////////////////////////////////
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

if (!this.samc) {
    this.samc = {};
}

(function () {

// globals
var app       = {};
var nextTag   = 1000;
var nextMdl   = 100;
samc.app      = app;
samc.mdlMap   = {};

samc.getNextMdl = function() {
  return nextMdl++;
}

samc.getNextTag = function() {
  return 'tag-'+(nextTag++);
}

/* This is the common handler for all HTML on events such as onClick
 *
 * All are expected to include the 3 parms
 */

function tryDefault(mdl,evt,action) {
  switch(action) {
    case 'sa-change':
      var elem = evt.target;
      var sym  = elem.getAttribute("data-sym");
      var val  = elem.value;
      var prev = samc.writeVal(mdl,sym,val);
      console.log("sa-change %s new=%s old=%s %o",sym,val,prev,{elem:elem,mdl:mdl});
      return true;
      break;
    case 'sa-check':
      var elem = evt.target;
      var sym  = elem.getAttribute("data-sym");
      var trueVal = elem.getAttribute("data-true");
      var falseVal = elem.getAttribute("data-false");
      if (elem.checked) {
        var val = {bool:true,val:trueVal}
      } else {
        var val = {bool:false,val:falseVal}
      }
      if (sym == "strState") {
        console.log("sa-check %s new=%o old=%o %o",sym,val,prev,{elem:elem,mdl:mdl});
        mdl.present(mdl.strState,val.val,null);
      } else {
        var prev = samc.writeVal(mdl,sym,val,false);
        //console.log("sa-check %s new=%o old=%o %o",sym,val,prev,{elem:elem,mdl:mdl});
        //var act = {action:'sa-dirty',sym:sym,val:val};
        //mdl.present(mdl.strState,null,act);
      }
      return true;
      break;
    case 'sa-radio':
      var elem = evt.target;
      var sym  = elem.getAttribute("data-sym");
      var val  = elem.getAttribute("data-val");
      if (sym == "strState") {
        console.log("sa-check %s new=%o old=%o %o",sym,val,prev,{elem:elem,mdl:mdl});
        mdl.present(mdl.strState,val.val,null);
      } else {
        var prev = samc.writeVal(mdl,sym,val,false);
      }
      return true;
      break;
  }
}

samc.action = function(evt,mid,action) {
  console.log("action %o",{evt:evt,mid:mid,action:action});
  if (samc.mdlMap[mid]) {
    var model = samc.mdlMap[mid];
    if (model.actions && model.actions[action]) {
      model.actions[action](evt,model);
    } else if (model[action] && (typeof(model[action]) == "function")) {
      model[action](model,evt);
    } else {
      if (!tryDefault(model,evt,action)) {
        console.log("Unconnected action '%s' for model '%s' %o",action,mid,{model:model});
      }
    }
  } else {
    console.log("Unconnected model '%s' for action '%s'",mid,action);
  }
}

// relay log message to model
samc.logAction = function(mdl,msg) {
  //console.log("logAction %s %o",msg,{mdl:mdl});
  if (!mdl.parent) return;
  if (mdl.parent.actions && mdl.parent.actions['sa-logmsg']) {
    mdl.parent.actions['sa-logmsg']({msg:msg,logModel:mdl},mdl.parent);
  }
}

samc.actionDirty = function(model,stepParms) {
  console.log("actionDirty %o",{model:model,stepParms:stepParms});
}

/*
These 2 routines control all read/write access to the model.
*/
samc.fetchVal = function(mdl,sym,defVal) {
  var parts = sym.split(/\./);
  var map = mdl;
  for(var i=0; i < parts.length-1; i++) {
    var part = parts[i];
    if (!(part in map)) return defVal;
    map = map[part];
  }
  var key = parts[parts.length-1];
  if (!(key in map)) return defVal;
  //console.log("fetchVal ret=%s key=%s sym=%s",map[key],key,sym);
  return map[key];
}

samc.writeVal = function(mdl,sym,val) {
  var parts = sym.split(/\./);
  var map = mdl;
  for(var i=0; i < parts.length-1; i++) {
    var part = parts[i];
    if (!(part in map)) map[part] = {};
    map = map[part];
  }
  var key = parts[parts.length-1];
  var prev = map[key];
  map[key] = val;
  return prev;
}



samc.insertHtml = function(mdl,stepParms) {
  var wtr = Mustache;
  console.log("insertHtml %o",{mdl:mdl,stepParms:stepParms,wtr:wtr});
  if (stepParms.target) {
  	var elem = document.getElementById(stepParms.target);
  	if (!elem) {
      console.warn("Target %s not found for samc.insertHtml %o",stepParms.target,{mdl:mdl,stepParms:stepParms});
  	} else {
      elem.innerHTML = stepParms.text || "";
  	}
  } else {
    console.warn("No target specified for samc.insertHtml %o",{mdl:mdl,html:html,stepParms:stepParms});
  }
}

/* This is used to build form components (even though we do not use the form element)
   that have bi-directional binding into the model.
   The parameters is a , separated string passed by mustache as a section function
   The first X parms are positional
     0 - element type. select, button, textarea, or input type such as text
     1 - symbol to get/put value from OR for button the action event
     keywords as follows.
     opt=for select to generate values. can be a function or bounded string
     val=default initial value
     hint=place holder string (no ,)
     title=title value
     class=classes
     on-X=saXXXXX - cause action event for X
     cust=function name to customize element

     design notes:
       The control only reads a value when being formatted.  It relies on the
       action to eventually set the desired value.
 */

samc.isState = function(testState) {
  return (testState.indexOf(this.strState) >= 0);
}

samc.stateColor = function() {
  if (this.view.colorMap && this.view.colorMap[this.strState]) return this.view.colorMap[this.strState];
  return "255,255,255" // White is default
}

samc['elem-gen'] = function(type,action) {
  //console.log("elem-gen %s %s %o",type,action,{this:this});
  var s = "";
  var parms = arguments;
  if (parms.length < 2) return err("need type, symbol");
  var s = "";
  var tail= " />";
  var txt = "";
  var stop = ">";
  var keyMap = {};
  var mdl = this;
  var id = null;
  if (this.mdl) { // inside a loop
    //console.log("loop.elem-gen %s %s %o",type,action,{this:this});
    mdl = this.mdl;
    id = this.id
  }
  for(var i=2;i < parms.length; i+=1) {
    var str = parms[i];
    var ix = str.indexOf("=");
    if (ix < 2) {
      if (ix < 0) {
        key = str;
        keyMap[key] = true; // implied boolean
      } else {
        return err("invalid key "+str);
      }
    } else {
      var key = str.substring(0,ix);
      keyMap[key] = str.substring(ix+1);
    }
    if ("/opt/val/hint/title/class/flat/readonly/id/cust".indexOf(key) < 0) return err("keyword "+key+" not implmented");
  }
  var sym = parms[1];
  if (sym.charAt(0) == '.') {
    if (!id) return err("implied parent for "+sym+" had no sym");
    sym = id + sym;
  }
  var title = "";
  if (keyMap.title) title = " title=\""+keyMap.title+"\"";
  var tagId = "";
  if (keyMap.id) {
    var tagVal = samc.fetchVal(mdl,keyMap.id,undefined);
    if (!tagVal) return err("id="+keyMap.id+" has no value in model");
    tagId = " id="+tagVal+" ";
  }
  var readonly = keyMap.readonly?" readonly":"";
  switch(parms[0]) {
    case "select":
      //TODO - make sure ssXXX format if strState
      s += "<select "+tagId+"data-sym="+sym+" onChange=\"samc.action(event,"+mdl.mid+",'sa-change');return false;\""
      var curVal = samc.fetchVal(mdl,sym,undefined);
      if (curVal == undefined) { // ensure mopel agrees
        curVal = keyMap.val;
        samc.writeVal(mdl,sym,curVal);
      }
      txt = genOptions(keyMap,mdl,curVal);
      if (txt.match(/^<span/)) return txt; // report error
      tail = "</select>";
      break;
    case "text":
      //TODO - cammot be strState
      var strVal = ' value="'+(samc.fetchVal(mdl,sym,"").replace(/"/,'\\"'))+'"';
      s += "<input "+tagId+"type=text data-sym="+sym+strVal+readonly+" onChange=\"samc.action(event,"+mdl.mid+",'sa-change');return false;\""
      tail = "";
      break;
    case "textarea":
      //TODO - cammot be strState
      var strVal = (samc.fetchVal(mdl,sym,"").replace(/"/,'\\"'));
      s += "<textarea "+tagId+"data-sym="+sym+readonly+" onChange=\"samc.action(event,"+mdl.mid+",'sa-change');return false;\""
      txt = strVal;
      tail = "</textarea>";
      break;
    case "check":
      var chkId = samc.getNextTag();
      if (!keyMap.val) return err("check requires val= value");
      if (!keyMap.opt) return err("check requires opt= value");
      var opts = keyMap.opt.split(/\//);
      if (opts.length != 2) return err("check opt= requires 2 / separated values, 1st when true, 2nd when false");
      if ((keyMap.val != opts[0]) && (keyMap.val != opts[1])) return err("check val= does not match opt= vals");
      //TODO - make sure ssXXX format if strState
      var curVal = samc.fetchVal(mdl,sym,undefined);
      if (curVal == undefined) { // ensure model agrees
        curVal = keyMap.val;
        samc.writeVal(mdl,sym,curVal);
      }
      var checked = (curVal == opts[0])?" checked":"";
      s += "<input type=checkbox id="+chkId+" data-sym="+sym+" data-true="+opts[0]+" data-false="+opts[1]+checked+" onChange=\"samc.action(event,"+mdl.mid+",'sa-check');return false;\""
      tail = "<label class=checkbox for="+chkId+title+">"+(keyMap.hint || "no hint provide")+"</label>";
      break;
    case "radio":
      if (!keyMap.val) return err("check requires val= value");
      if (!keyMap.opt) return err("check requires opt= value");
      var opts = keyMap.opt.split(/\//);
      if (opts.length < 2) return err("check opt= requires at least 2 / separated values");
      //TODO - make sure ssXXX format if strState
      var curVal = samc.fetchVal(mdl,sym,undefined);
      if (curVal == undefined) { // ensure model agrees
        curVal = keyMap.val;
        samc.writeVal(mdl,sym,curVal);
      }
      var hints  = (keyMap.hint)?keyMap.hint.split(/\//):[];
      var titles = (keyMap.title)?keyMap.title.split(/\//):[];
      var nIX = -1;
      var br = keyMap.flat?"":"<br>";
      opts.forEach(function(opt) {
        nIX += 1;
        var chkId = samc.getNextTag();
        var checked = (curVal == opt)?" checked":"";
        var subTitle = titles[nIX]?" title=\""+titles[nIX]+"\"":"";
        var subHint  = hints[nIX]?hints[nIX]:opts[nIX];
        s += "<input type=radio name="+sym+" id="+chkId+" data-sym="+sym+" data-val="+opt+checked+" value="+opt+" onChange=\"samc.action(event,"+mdl.mid+",'sa-radio');return false;\">"
        s += "<label class=checkbox for="+chkId+subTitle+">"+subHint+"</label>"+br;
      });
      title = "";
      keyMap.hint = "";
      tail = "";
      stop = "";
      break;
    case "button":
      if (!parms[1]) {
        return err("button requires action code of function pointer as 2nd parameter");
      } else {
        if (!parms[1].match(/^sa/)) {
          if (typeof(mdl[parms[1]]) != "function") {
            return err("button action must be of format saXXXXX or a function ptr, not "+parms[1]);
          }
        }
      }
      s += "<button "+tagId+"onClick=\"samc.action(event,"+mdl.mid+",'"+parms[1]+"');return false;\""
      if (!keyMap.val) return err("button requires val= value");
      txt = keyMap.val;
      tail = "</button>";
      break;
    default:
      return err("type "+parms[0]+" not implemented");
  }
  if (keyMap.class)  s += " class=\""+keyMap.class+"\"";
  if (title)         s += title;
  if (keyMap.hint)   s += " placeholder=\""+keyMap.hint+"\"";
  s = s + stop+txt+tail;
  // cust func here
  return s;

  function err(err) {
    return "<span class=gen-err>"+err+"</span>";
  }

  function genOptions(keyMap,mdl,curVal) {
    //TODO if value not found report error
    if (!keyMap.opt) return err("require opt keyword for select");
    var opts = keyMap.opt.split(/\//);
    var s = "";
    opts.forEach(function(opt) {
      var sel = (opt==curVal)?" selected":"";
      s += "<option"+sel+">"+opt+"</option>\r\n";
    });
    return s;
  }

}


/* This lets us clone a new model from a shell (pattern). This works because
 * state,actions and view are all read-only.
 * The customizer must separate out the sm formatting portion.
 */
samc.cloneFactory = function(mold,ctx,parent) {
  var sm = new SamModel(mold.actions,mold.state,mold.view,parent);
  mold.buildModel(sm.actions,sm,sm.state,sm.view,ctx);
  sm.elem       = samc['elem-gen'];
  sm.isState    = samc.isState;
  sm.stateColor = samc.stateColor;
  return sm;
}

/*
 * The single place we build SAMC complexes. Note that it is 2-part so that
 * we can clone the result.
 * Nomenclature:
 *   Model
 *   Complex
 *   Mold
 */
samc.factory = function(buildComplex,ctx/*,parent*/) {
  var sa        = new SamActions();
  var sv        = new SamView();
  var ss        = new SamState();
  ss.addState   = addState;
  var sm = buildComplex(presentMold,sa,ss,sv,ctx);
  validateComplex(sa,sm,ss,sv);
  return sm;

  // Call back from buildComplex so that we can separate out
  // the Model portion of the complex. This is needed for
  // clone operations.
  function presentMold(buildModel,sa,ss,sv,ctx) {
    if (ctx && ctx.samcExtendMold) ctx.samcExtendMold(sa,ss,sv,ctx);
    var sm = new SamModel(sa,ss,sv);
    sm.elem       = samc['elem-gen'];
    sm.isState    = samc.isState;
    sm.stateColor = samc.stateColor;
    sm.buildModel = buildModel;        // for cloning
    buildModel(sa,sm,ss,sv,ctx);
    return sm;
  }

  //--- validator ---
  //console.log("--- Validating --- %o",{sm:sm,keys:Object.keys(ss.stepMap)});
  function validateComplex(sa,sm,ss,sv) {
    // 1. convert funcStr into funcPtr, check signature, make plain objects
    var stepMap = {};
    Object.keys(ss.stepMap || {}).forEach(function(stepKey) {
      var stepCls = ss.stepMap[stepKey];
      var stepObjKeys = Object.keys(stepCls);
      var stepObj = {};
      stepMap[stepKey] = stepObj;
      //console.log("process stepKey %s %o",stepKey,{stepCls:stepCls});
      stepObjKeys.forEach(function(stepObjKey) {
        stepObj[stepObjKey] = stepCls[stepObjKey];
        if (stepObjKey == 'allow') {
          Object.keys(stepObj.allow).forEach(function(action) {
            var funcStr = stepObj.allow[action];
            var func    = sa.funcMap[funcStr];
            if (!func) {
              console.warn("Function "+funcStr+" used by action "+action+" in state "+stepKey+" not defined");
            } else {
              console.log("Function "+funcStr+" set for action "+action+" in state "+stepKey+" not defined");
              stepObj.allow[action] = func;
              // TODO - check signature
            }
          });
        }
        if (stepObjKey == 'nap') {
          var funcStr = stepObj.nap;
          console.log("funcStr %s %o",typeof(funcStr),{funcStr:funcStr,stepObj:stepObj});
          if (typeof(funcStr) == "function") {
            stepObj.nap = funcStr; // external function
          } else {
            var func    = sa.funcMap[funcStr];
            if (!func) {
              console.warn("Function "+funcStr+" used as nap in state "+stepKey+" not defined");
            } else {
              stepObj.nap = func;
            }
          }
        }
      });
    });
    ss.stepMap = stepMap;
    // 2. check view has frame
    // 3. add ss-virgin -> first state else make ss-static
  }

  function addState(parms) {
    //console.log("addState %o",{this:this,parms:parms});
    if (typeof(parms) != 'string') { // add terminal list
      var ss = this;
      parms.forEach(function(state) {
        ss.addState(state);
      });
      return null;
    }
    if (!this.stepMap['ss-virgin']) {
      this.stepMap['ss-virgin'] = new State(sv,"ss-virgin");
      this.stepMap['ss-virgin'].next(parms);
    }
    this.stepMap[parms] = new State(sv,parms);
    return this.stepMap[parms];
  }
}

samc.samAlert = function(html) {
  var tag = document.getElementById("samc-error-base");
  tag.innerHTML = "<div style=color:red;font-size:120%;>SAMCAS error reported:</div><hr>"+html+"<hr>";
  console.log("samAlert %o",{tag:tag,html:html});
}

samc.samAbort = function(abortMsg) {
  throw abortMsg;
}
samc.begin = function(appStart,icon) {
  // make sure we have error tag
  var tag = document.getElementById('samc-error-base');
  if (!tag) {
    var body = document.getElementsByTagName("body");
    if (!body || (body.length == 0)) {
      alert("body tag required for samcas operation. Aborted.");
      throw "samcas aborted";
    }
    body[0].insertAdjacentHTML("afterBegin","<div id=samc-error-base style=color:red;></div>");
  }
  appStart();
};

// End closure
}());

