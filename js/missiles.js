// missiles.js - Misile site implemnted using samcas.js
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
if (!this.missiles) {
    this.missiles = {};
}
(function () {
//*****************************************************************************
//----------------------------- Single Bank (Row) ----------------------------*
//*****************************************************************************
// We build the Mold and then the Model. (at this juncture things are still static).
function createBankModel(presentMold,sa,ss,sv,row) {
  console.log("createBankModel %o",{presentMold:presentMold,sa:sa,ss:ss,sv:sv,row:row});
  // ================================== View ==================================
  sv.frame = `
    <td class=bank-name>                    <div>{{&vertical}}</div></td>
    {{#isState(ssActive)}}
      <td class=bank-panel id={{cpanTag}}>  <p>panel {{cpanTag}}</p></td>
      {{#silos}}
        <td><div id={{tag}}>{{tag}}</div></td>
      {{/silos}}
      {{#voids}}
        <td><div class=void><p>VOID</p></div></td>
      {{/voids}}
    {{/isState(ssActive)}}
    {{#isState(ssDepleted)}}
      <td class=bank-depan><div style=display:none  id={{cpanTag}}></div><p class=rep>{{&elem(button,replenFunc,val=Replenish,title=press to replenish this bank)}}</p></td>

      <td class=bank-depleted colspan={{row.maxDepth}}><p class=txt>D E P L E T E D</p>
      {{#silos}}
        <p style=display:none; id={{tag}}></p>
      {{/silos}}
      </td>
    {{/isState(ssDepleted)}}
  `
  // ================================= Action =================================
  //---- computed transitions (must be first)
  sa.addFunc("fnEngaging",function(model,newState,stepParms) {
    //model.strState = "ssActive"; // no state change
    console.log("fnEngaging %s %o",newState,{model:model,stepParms:stepParms});
    var times = -1;
    model.kids.forEach(function(kidMdl) {
      if (kidMdl.strState == "ssReady") {
        times += 1;
        kidMdl.counter = kidMdl.counter + (times * stepParms.kid.delaySecs);
        if (kidMdl.counter > 10) {
          kidMdl.present("ssReady","ssWaiting");
        } else {
          kidMdl.present("ssReady","ssCounting");
        }
      }
    });
  });
  sa.addFunc("fnLaunching",function(model,stepParms) {
    checkDepleted(model,stepParms);
  });
  sa.addFunc("fnAborting",function(model,stepParms) {
    checkDepleted(model,stepParms);
  });
  function checkDepleted(model,stepParms) {
    var nUsed = 0;
    model.kids.forEach(function(mdl) { // we skip over cpanModel because it is never ssAborted or ssLaunched
      if ("ssAborted/ssLaunched".indexOf(mdl.strState) >= 0) nUsed += 1;
    });
    if (model.row.depth == nUsed) {
      model.present(model.strState,"ssDepleted");
    }
    console.log("checkDepleted %o",{model:model,stepParms:stepParms});
  }
  //---- event action mappings
  sa['sa-logmsg'] = function(evt,model) {
   //console.log(model.samName+" has msg %o",{evt:evt,model:model});
   model.cpanModel.actions['sa-logmsg'](evt,model.cpanModel); // relay message
  }  // ================================= State ==================================
  //---- transition mapping table
  ss.addState("ssActive").next("ssDepleted").signal("sgBankReplen");
  ss.addState("sgEngaging").nap("fnEngaging");
  ss.addState("sgLaunching").nap("fnLaunching");
  ss.addState("sgAborting").nap("fnAborting");
  ss.addState("ssEngaged");
  ss.addState("ssDepleted").signal("sgBankDepleted");
  return presentMold(buildModel,sa,ss,sv,row);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,row) {
    sm.mdlBase =  row.tag;
    sm.row = row;
    sm.cpanTag = samc.getNextTag();
    sm.silos = [];
    for(var i=0; i < row.depth; i++) {
      sm.silos.push({tag:samc.getNextTag(),name:"Silo-"+(i+1),type:row.name,samName:"silo."+(i+1)+"."+row.rowNum});
    }
    sm.vertical = function(m,p1,p2) {
      //console.log("vertical %o",{this:this,m:m,p1:p1,p2:p2});
      var s = "";
      for(var i=0; i < this.row.name.length; i++) {
        s += "<p>"+this.row.name.charAt(i)+"</p>";
      }
      return s;
    }
    sm.replenFunc = function(model,evt) {
      var smSite = model.parent;
      console.log("replenFunc %o",{model:model,evt:evt,smSite:smSite});
      var cfg = smSite.cfg;
      smSite.dispose(model);
      cfg.cfgFunc(cfg,model.row.rowNum,model.row,smSite);
      console.log("replenFunc.done %o",{model:model,evt:evt,smSite:smSite});
    }
  }
}
//*****************************************************************************
//---------------------------- Bank Control Panel ----------------------------*
//*****************************************************************************
// We build the Mold and then the Model. (at this juncture things are still static).
function createControlModel(presentMold,sa,ss,sv,row) {
  console.log("createControlModel %o",{presentMold:presentMold,sa:sa,ss:ss,sv:sv,row:row});
  // ================================== View ==================================
  sv.frame = `
    <div class=cpan>
      <p class=name>{{name}}</p>
      {{#isState(ssAutoMode/ssManMode)}}<p class=mode>{{&elem(check,strState,val=ssManMode,opt=ssAutoMode/ssManMode,hint=Automatic mode,title=Adds Incoming button and automatic firing of missiles)}}{{/isState(ssAutoMode/ssManMode)}}
      {{#isState(ssAutoMode)}}
        <p class=delay>{{&elem(radio,delaySecs,flat,val=5,opt=5/10/20/30,hint=Fast/Meduim/Slow/Slowest,title=Gap of 5 seconds/Gap of 10 seconds/Gap of 20 seconds/Gap of 30 seconds)}}</p>
        <p class=but>{{&elem(button,saIncoming,val=Incoming,title=Trigger automatic defence response)}}</p>
      {{/isState(ssAutoMode)}}
      {{#isState(ssEngaged/ssLocked)}}
        <p class=busy>{{#isState(ssEngaged)}}Is Engaged{{/isState(ssEngaged)}}{{#isState(ssLocked)}}Locked{{/isState(ssLocked)}}</p>
      {{/isState(ssEngaged/ssLocked)}}
      {{#isState(ssEngaged/ssLocked/ssManMode)}}
        <p class=text>{{&elem(textarea,logSheet,readonly,id=logTag,hint=activity log)}}</p>
      {{/isState(ssEngaged/ssLocked/ssManMode)}}
    </div>
  `
  // ================================= Action =================================
  //---- event action mappings
  sa.saIncoming  = function(evt,model) {model.present('ssAutoMode','ssEngaged',{evt:evt})}
  sa['sa-logmsg'] = function(evt,model) {
    if (!model.logLines) model.logLines = "";
    model.logLines = evt.logModel.samName+":"+evt.msg+"\r\n" + model.logLines;
  	var elem = document.getElementById(model.logTag);
  	if (elem) elem.textContent = model.logLines;
    //console.log("sa-logmsg %o",{evt:evt,model:model,elem:elem});
  }
// ================================= State ==================================
  ss.addState("ssManMode").next("ssAutoMode/ssLocked");
  ss.addState("ssAutoMode").next("ssManMode/ssLocked/ssEngaged");
  ss.addState("ssLocked").next("ssManMode");
  ss.addState("ssEngaged").signal("sgEngaging");
  return presentMold(buildModel,sa,ss,sv,row);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,ctx) {
    sm.name    =  ctx.name;
    sm.mdlBase =  ctx.tag;
    sm.logTag  = samc.getNextTag();
  }
}

//*****************************************************************************
//----------------------------------- Banner ----------------------------------*
//*****************************************************************************
// We build the Mold and then the Model. (at this juncture things are still static).
function createBannerModel(presentMold,sa,ss,sv,row) {
  console.log("createBannerModel %o",{presentMold:presentMold,sa:sa,ss:ss,sv:sv,row:row});
  // ================================== View ==================================
  sv.frame = `
    {{#isState(ssVisible)}}<span class=banner style=color:rgb({{colorNow}})>{{bannerText}}</span>{{/isState(ssVisible)}}
  `
  // ================================= Action =================================
  //---- event action mappings
  sa.addFunc("fnStartFlash",function(model,newState,stepParms) {
    //console.log("fnStartFlash %o",{model:model,stepParms:stepParms});
    if (model.inState("ssVisible") && model.color && model.altColor && (model.color != model.altColor)) {
      setTimeout(function(mdl) {
        mdl.present(mdl.strState,null,{action:'saFlash'});
      },1000,model) ;
    }
  });
  sa.addFunc("fnFlash",function(model,stepParms) {
    //console.log("fnFlash %o",{model:model,stepParms:stepParms});
    if (model.colorNow == model.color) {
      model.colorNow = model.altColor;
    } else {
      model.colorNow = model.color;
    }
    return {render:true,nap:true}
  });
// ================================= State ==================================
  ss.addState("ssHidden").next("ssVisible").ignore("saFlash");
  ss.addState("ssVisible").next("ssHidden").allow("saFlash","fnFlash").nap("fnStartFlash");
  return presentMold(buildModel,sa,ss,sv,row);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,ctx) {
    sm.bannerText  =  ctx.bannerText;
    sm.colorNow    =  ctx.color;
    sm.color       =  ctx.color;
    sm.altColor    =  ctx.altColor;
    sm.mdlBase     =  ctx.tag;
  }
}

//*****************************************************************************
//--------------------------- Cascaded Site Engine) ---------------------------*
//*****************************************************************************
// We build the Mold and then the Model. (at this juncture things are still static).
function createSiteModel(presentMold,sa,ss,sv,ctx) {
  console.log("createSiteModel %o",{presentMold:presentMold,sa:sa,ss:ss,sv:sv,ctx:ctx});
  // ================================== View ==================================
  sv.css = `
    <style>
      div#{{mdlBase}} div.but button                        {width:130px;}
      div#{{mdlBase}} h1                                    {font-size:18;}
      div#{{mdlBase}} table.site
     ,div#{{mdlBase}} table.site td
     ,div#{{mdlBase}} table.site th                         {border:1px solid black;}
      div#{{mdlBase}} table.site                            {border-collapse:collapse;}
      div#{{mdlBase}} table.site tr.head                    {background-color:rgb(230,230,230);}
      div#{{mdlBase}} table.site tr.patriot                 {background-color:rgb(243,177,214);}
      div#{{mdlBase}} table.site tr.scud                    {background-color:rgb(164,149,251);}
      div#{{mdlBase}} table.site tr.cruise                  {background-color:rgb(0,217,217);}
      div#{{mdlBase}} table.site div.void p                 {width:100%; text-align:center;}
      div#{{mdlBase}} table.site td.bank-name div p         {margin-top:0px;margin-bottom:0px;width:100%; font-weight:bold; text-align:center; font-size:80%;}
      div#{{mdlBase}} table.site td.bank-panel              {vertical-align:top; width:240px; height:100%;}
      div#{{mdlBase}} table.site td.bank-panel p.name       {width:100%; text-align:center; font-weight:bold; margin-bottom:0px;}
      div#{{mdlBase}} table.site td.bank-panel p.busy       {width:100%; text-align:center; font-weight:bold; margin-top:0px;margin-bottom:0px; background-color:green;}
      div#{{mdlBase}} table.site td.bank-panel p.mode       {margin-bottom:0px; margin-top:0px;}
      div#{{mdlBase}} table.site td.bank-panel p.delay      {margin-top:0px; font-size:80%;}
      div#{{mdlBase}} table.site td.bank-panel p.but        {width:100%; text-align:center;}
      div#{{mdlBase}} table.site td.bank-panel p.text       {margin-top:5px; margin-bottom:0px;}
      div#{{mdlBase}} table.site td.bank-panel textarea     {width:100%; height:60px; margin-top:0px;}
      div#{{mdlBase}} table.site td.bank-depleted p.txt     {width:100%; font-height:bold; font-size:120%; text-align:center;}
      div#{{mdlBase}} table.site td.bank-depleted p.rep     {width:100%; font-height:bold; font-size:120%; text-align:center;}
      div#{{mdlBase}} table.site td.bank-depleted           {vertical-align:center;}
      div#{{mdlBase}} table.site td.bank-depan              {vertical-align:center;}
      div#{{mdlBase}} table.site td.bank-depan p.rep        {width:100%; text-align:center;}
      div#{{mdlBase}} table.site td.bank-depan p.rep button {border-radius:5px; width:150px;}
      div#{{mdlBase}} p.defunct                             {border-radius:10px; border: 5px solid black; font-size:130%; padding:20px; color:red;}
    </style>
  `
  sv.frame = `
    <h1>Missile Defence Site <i>{{siteName}}</i> Dashboard <span id={{banTag}}></span></h1>
    {{#isState(ssOperational/ssSiteWarning)}}
      <table class=site>
        <thead>
          <tr class=head>
            <th>Type</th><th>Bank</th><th colspan={{maxDepth}}>Silos</th>
          </tr>
        </thead>
        <tbody>
          {{#cfg.rows}}
            <tr class={{id}} id={{tag}}>
              <td>{{name}} {{tag}}</td>
            </tr>
          {{/cfg.rows}}
        </body>
      </table>
    {{/isState(ssOperational/ssSiteWarning)}}
    {{#isState(ssDefunct)}}
      <p class=defunct>Site {{siteName}} no longer operational</p>
    {{/isState(ssDefunct)}}

  `
  // ================================= Action =================================
  //---- event action mappings
  sa.addFunc("fnCheckBankStatus",function(model,stepParms) {
    var depleteCnt = 0
    model.kids.forEach(function(kid) {
      if (kid.strState == "ssDepleted") depleteCnt += 1;
    });
    //console.log("fnCheckBankStatus %s %s %o",model.strState,depleteCnt,{model:model,stepParms:stepParms});
    if (model.kids.length != model.cfg.rows.length) return; // not during site build
    if (depleteCnt == model.kids.length) {
      if (model.banModel.inState("ssVisible")) model.banModel.present(model.banModel.strState,"ssHidden")
      model.present(model.strState,"ssDefunct"); // its over
    } else if ((depleteCnt + 1) == model.kids.length) {
      if (model.banModel.inState("ssHidden")) model.banModel.present(model.banModel.strState,"ssVisible")
    } else {
      if (model.banModel.inState("ssVisible")) model.banModel.present(model.banModel.strState,"ssHidden")
    }

  });
  // ================================= State ==================================
  ss.addState("ssOperational").next("ssDefunct");
  ss.addState("ssDefunct"); // terminal state
  ss.addState("sgBankDepleted").nap("fnCheckBankStatus");
  ss.addState("sgBankReplen").nap("fnCheckBankStatus");
  return presentMold(buildModel,sa,ss,sv,ctx);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,ctx) {
    sm.siteName = ctx.siteName || "No-Name";
    sm.cfg = {};
    sm.cfg.rows = [];
    var maxDepth = 1;
    sm.banTag = samc.getNextTag();
    sm.banModel = samc.factory(createBannerModel,{tag:sm.banTag,bannerText:"WARNING: Site near DEPLETION",color:"192,0,0",altColor:"258,128,64"});
    ctx.cfg.types.forEach(function(type) {
      var banks = ctx[type.id].banks;
      var depth = ctx[type.id].depth;
      if ((banks - 0 > 0) && (depth > maxDepth)) maxDepth = depth;
    });

    ctx.cfg.types.forEach(function(type) {
      var banks = ctx[type.id].banks;
      var depth = ctx[type.id].depth;
      if (banks - 0 > 0) {
        for(var i=0; i < banks; i++) {
          var row = {name:type.name,id:type.id,bank:'Bank-'+(i+1),depth:depth,maxDepth:maxDepth,tag:samc.getNextTag()};
          sm.cfg.rows.push(row);
        }
      }
    });
    sm.maxDepth = maxDepth;
  }
}
//*****************************************************************************
//----------------------------- Site Configurator  ---------------------------*
//*****************************************************************************
// We build the Mold and then the Model. (at this juncture things are still static).
function createConfigureModel(presentMold,sa,ss,sv,ctx) {
  // ================================== View ==================================
  sv.css = `
    <style>
     div#{{mdlBase}} div.cfg              {margin-top:10px}
     div#{{mdlBase}} div.cfg label.head   {display:inline-block;width:100px;text-align:right;font-weight:bold;}
     div#{{mdlBase}} div.cfg label        {margin-left:30px;}
     div#{{mdlBase}} div.but button       {width:130px;}
     div#{{mdlBase}} h1                   {font-size:20px;}
     div#{{mdlBase}} h1 input             {width:200px; margin-left:40px;}
    </style>
  `
  sv.frame = `
    <h1>Build Missile Site {{&elem(text,siteName,hint=optional site name)}}</h1>
     <hr>
     {{#cfg.types}}
       <div class=cfg>
         <label class=head>{{name}}</label>
         <label>Banks:</label> {{&elem(select,.banks,val=1,opt=0/1/2/3/4/5)}}
         <label>Depth:</label> {{&elem(select,.depth,val=3,opt=1/2/3/4/5)}}
       </div>
     {{/cfg.types}}
     <hr>
     <div class=but> {{&elem(button,saBuild,val=Build)}} </div>
  `
  // ================================= Action =================================
  //---- event action mappings
  sa.saBuild   = function(evt,model) {model.present('ssReady','ssConfigured',{evt:evt})}
  // ================================= State ==================================
  //---- transition mapping table
  ss.addState("ssReady").next("ssConfigured");
  ss.addState("ssConfigured").nap(buildMissileSite); // this is a terminal transition
  return presentMold(buildModel,sa,ss,sv,ctx);
  // ================================= Model ==================================
  function buildModel(sa,sm,ss,sv,ctx) {
    sm.cfg.types = [];
    "Patriot/Scud/Cruise".split("/").forEach(function(val){sm.cfg.types.push({name:val,id:val.toLowerCase(),mdl:sm})});
    sm.samName = "builder";
  }
}

function buildMissileSite(model,state) {
  console.log("buildMissileSite %o",{model:model,state:state});
  var smSite = samc.factory(createSiteModel,model);
  var samApp = new SamApp(smSite);
  smSite.samName = "site";
  smSite.activate();
  smSite.banModel.activate();
  var cfg = smSite.cfg;
  cfg.bankMold = samc.factory(createBankModel,cfg.rows[0]);
  cfg.rockMold = samc.factory(rocket.createRocketModel,{samcExtendMold:samcExtendRocketMold});
  cfg.cpanMold = samc.factory(createControlModel,{cpanTag:"X",name:"Y"});
  cfg.cfgFunc  = cfgFunc;
  var rowNum = 0;
  console.log("factory.built site %o",{smSite:smSite,bankMold:cfg.bankMold,rockMold:cfg.rockMold,cpanMold:cfg.cpanMold});
  for(var i=0; i <  smSite.cfg.rows.length; i++) {
    var row = smSite.cfg.rows[i];
    cfgFunc(cfg,rowNum,row,smSite);
  }

  function cfgFunc(cfg,rowNum,row,smSite) {
    row.rowNum = rowNum;
    row.rockMold = cfg.rockMold;
    var smBank = samc.cloneFactory(cfg.bankMold,row,smSite);
    smBank.voids = [];
    for(var i=row.depth; i < row.maxDepth ; i++) {
      smBank.voids.push(i);
    }
    //console.log("factory.bank %o",{smBank:smBank,row:row});
    smBank.samName = "bank-"+rowNum;
    smBank.activate();
    smBank.silos.forEach(function(silo) {
      var smRock = samc.cloneFactory(cfg.rockMold,{},smBank);
      //console.log("silo %o",{silo:silo,smRock:smRock});
      smRock.fired = "FIRED";
      smRock.readyMsg = "Ready to FIRE";
      smRock.what = silo.type;
      smRock.mdlBase = silo.tag;
      smRock.samName = silo.samName;
      smRock.activate();
    });
    var smCpan = samc.cloneFactory(cfg.cpanMold,{tag:smBank.cpanTag,name:row.bank},smBank);
    smBank.cpanModel = smCpan;
    console.log("built smCpan %o",{cpan:smCpan,row:row});
    smCpan.samName = "cp"+row.bank.replace(/Bank/,row.name);
    smCpan.activate();
  };
}

/* This illustrates extending a Mold. Here we add a new State ssWaiting so we have to modify
 * the sa,ss,sv tables
 *
  This is for illustration only. It would have been far easier to define the ssWaiting state
  in the base mold and only have it activated when we set counting to greater than 10.
 */
function samcExtendRocketMold(sa,ss,sv,ctx) {
  console.log("samcExtendRocketMold %o",{sa:sa,ss:ss,sv:sv,ctx:ctx});
  // actions
  sa.addFunc("fnCheckWaitDecrement",function(model,stepParms) {
    console.log("fnCheckWaitDecrement %s %o",model.strState,{model:model,stepParms:stepParms});
    if (model.inState("ssWaiting") && (model.counter == 10)) {
      model.present(model.strState,"ssCounting");
    }
    if (model.parent) samc.logAction(model,model.strState+" count "+(model.counter - 1));
    return sa.funcMap.prevCheckDecrement(model,stepParms)
  });
  sa.saAbort   = function(evt,model) {model.present('ssCounting/ssWaiting/ssPaused','ssAborted',{evt:evt})}
  sa.saPause   = function(evt,model) {model.present('ssCounting/ssWaiting','ssPaused',{evt:evt})}
  // state
  var ssCnt = ss.stepMap.ssCounting;
  ssCnt.next = ssCnt.next+"/ssWaiting";
  var ssRdy = ss.stepMap.ssReady;
  ssRdy.next = ssRdy.next+"/ssWaiting";
  ss.addState("ssWaiting").next("ssAborted/ssPaused/ssCounting").allow("saDecrement","fnCheckWaitDecrement").nap("fnStartTimer");
  sa.funcMap.prevCheckDecrement = sa.funcMap.fnCheckDecrement;

  // view
  sv.colorMap.ssWaiting = "185,122,87"
  sv.frame = sv.frame.replace(/isState[(]ssCounting[)]/g,"isState(ssCounting/ssWaiting)");

}

//*****************************************************************************
//------------------------------ M A I N L I N E  -----------------------------*
//*****************************************************************************
// this is where the process is initiated.
missiles.main = function() {
  var sm = samc.factory(createConfigureModel);
  console.log("factory.created %o",{sm:sm});
  var samApp = new SamApp(sm);
  sm.activate();
  console.log("running %o",{Mustache:Mustache,sm:sm});
}
// End closure
}());
