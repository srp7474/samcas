// rocket.js - Rocket launcher implemnted using samcas.js
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
if (!this.rocket) {this.rocket = {};}(function () {
// We build the Mold and then the Model. (at this juncture things are still static).
rocket.createRocketModel = function(presentMold,sa,ss,sv,ctx) {
  // ================================== View ==================================
  sv.css = `
    <style type="text/css">
       div#{{mdlBase}} div.rocket            {width:100px; height:100px; background-color:yellow; border-radius:5px; border: 1px solid black; position:relative;}
       div#{{mdlBase}} div.rocket div p.ctr  {text-align:center; font-weight:bold; font-size:120%; background-color:white;width:30px; margin-left:35px; margin-top:8px; margin-bottom:8px;}
       div#{{mdlBase}} div.rocket div p      {text-align:center; font-size:80%; margin-top:0px; margin-bottom:0px; }
       div#{{mdlBase}} div.rocket div img    {width:30px; height:30px; margin-top:15px; margin-bottom:15px; margin-left:35px;}
       div#{{mdlBase}} div.but               {margin-left:5px; font-size:70%; margin-top: 10px;}
       div#{{mdlBase}} div.but button        {width:43px; border-radius:5px; font-size:70%;}
       div#{{mdlBase}} div.but button.w1     {width:88px; font-size:100%;}
    </style>
  `
  sv.colorMap = {ssReady:'242,240,249',ssCounting:'202,255,217',ssPaused:'255,170,85',ssAborted:'255,136,136',ssLaunched:'128,255,128'}
  sv.frame = `
    <div class=rocket style=background-color:rgb({{stateColor}});>
      <div>
        <p><b>{{what}}</b></p>
        {{#isState(ssReady)}}    <p class=ctr>--</p>             <p>{{readyMsg}}</p>                 {{/isState(ssReady)}}
        {{#isState(ssCounting)}} <p class=ctr>{{counter}}</p>    <p>secs to launch</p>               {{/isState(ssCounting)}}
        {{#isState(ssPaused)}}   <p class=ctr>{{counter}}</p>    <p>** Paused **</p>                 {{/isState(ssPaused)}}
        {{#isState(ssAborted)}}  <img src=img/aborted.png>  <p class=fail><b>ABORTED</b></p>         {{/isState(ssAborted)}}
        {{#isState(ssLaunched)}} <img src=img/launched.png> <p class=good><b>{{fired}}</b></p>       {{/isState(ssLaunched)}}
      </div>
      {{#isState(ssReady)}}    <div class=but>{{&elem(button,saStart,val=Start,class=w1)}}</div>                                {{/isState(ssReady)}}
      {{#isState(ssCounting)}} <div class=but>{{&elem(button,saAbort,val=Abort)}} {{&elem(button,saPause,val=Pause)}}</div>     {{/isState(ssCounting)}}
      {{#isState(ssPaused)}}   <div class=but>{{&elem(button,saAbort,val=Abort)}} {{&elem(button,saRestart,val=Restart)}}</div> {{/isState(ssPaused)}}
    </div>
  `
  // ================================= Action =================================
  //---- computed actions
  sa.addFunc("fnStartTimer",function(model,newState,stepParms) {
    setTimeout(function(mdl) {
      mdl.present(mdl.strState,null,{action:'saDecrement'}) ;
    },1000,model) ;
  });
  sa.addFunc("fnCheckDecrement",function(model,stepParms) {
    //console.log("fnCheckDecrement %s %o",model.strState,{model:model,stepParms:stepParms});
    model.counter -= 1;
    if (model.parent) samc.logAction(model,model.strState+" count "+model.counter);
    if (model.counter <= 0 ) {
      model.present(model.strState,"ssLaunched");
      return null;
    } else {
      model.actions.funcMap.fnStartTimer(model,model.strState,stepParms); // kick off timer again
      return {render:true};
    }
  });
  //---- event action mappings
  sa.saStart   = function(evt,model) {model.present('ssReady','ssCounting',{evt:evt})}
  sa.saAbort   = function(evt,model) {model.present('ssCounting/ssPaused','ssAborted',{evt:evt})}
  sa.saPause   = function(evt,model) {model.present('ssCounting','ssPaused',{evt:evt})}
  sa.saRestart = function(evt,model) {model.present('ssPaused','ssCounting',{evt:evt})}
  // ================================= State ==================================
  //---- transition mapping table
  ss.addState("ssReady").next("ssCounting");
  ss.addState("ssLaunched").weakSignal("sgLaunching").ignore("saDecrement");
  ss.addState("ssCounting").next("ssAborted/ssPaused/ssLaunched").allow("saDecrement","fnCheckDecrement").nap("fnStartTimer");
  ss.addState("ssAborted").weakSignal("sgAborting").ignore("saDecrement");
  ss.addState("ssPaused").next("ssAborted/ssCounting").ignore("saDecrement");
  return presentMold(buildModel,sa,ss,sv,ctx);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,ctx) {
    sm.counter   = 10;
    sm.what      = sm.samName = "Saturn";
    sm.fired     = "LAUNCHED";
    sm.readyMsg  = 'Ready to Launch'
  }
}
 ///////////////////// Build model and Start Engines /////////////////////////
rocket.main = function() {
  var sm = samc.factory(rocket.createRocketModel);
  console.log("factory.built %o",{sm:sm});
  var samApp = new SamApp(sm);
  sm.activate();
  console.log("running %o",{Mustache:Mustache,sm:sm});
}
// End closure
}());
