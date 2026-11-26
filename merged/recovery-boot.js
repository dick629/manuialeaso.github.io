/* 時鐘防護（Ping 11-23 16:52 定案）：遊戲時間只能往前走。
 *   ‧遊戲讀到的時間＝max(電腦時間, 上次看到的時間＋這段期間實際經過的時間)。電腦時間往回調 → 遊戲時間不跟著退；
 *     關掉遊戲的期間不算離線時間，直到真實時間追上（超過 10 分鐘才提示）。
 *   ‧連得上網站時：電腦時間比網站回應的時間快超過 15 分鐘 → 以網站時間為準。
 *   ‧遊戲開著時電腦時間突然往後跳超過 10 分鐘 → 先跟網站對時（最多等 3 秒），對不上網站才照電腦時間。
 *   ‧上次看到的時間記在瀏覽器（加簽章）與存檔（p._clkSeen，merged/anticheat 寫入／讀回）。
 *   要在所有程式之前載入（整個遊戲的 Date 都走這裡）。 */
(function(){'use strict';
 var W=window,OD=W.Date,PF=W.performance;if(!OD||!PF||typeof PF.now!=='function'||W.__afkClock)return;
 var KEY='afk_clock_v1',SALT='clk:9e3:',BACK=600000,AHEAD=900000,HOLD=3000;
 var fnv=function(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0;}return h.toString(36);};
 var read=function(){try{var a=JSON.parse(localStorage.getItem(KEY)||'null');if(a&&typeof a.t==='number'&&isFinite(a.t)&&a.k===fnv(SALT+a.t))return a.t;}catch(e){}return 0;};
 var write=function(t){try{t=Math.floor(t);localStorage.setItem(KEY,JSON.stringify({t:t,k:fnv(SALT+t)}));}catch(e){}};
 var raw0=OD.now(),L0=read();
 var G0=Math.max(raw0,L0),p0=PF.now(),booted=false,srvOff=null,holdUntil=0,okJumpUntil=0,checking=false,firstCheck=false;
 var debt0=L0-raw0>BACK?L0-raw0:0,ahead0=0;
 var verify=function(cb){
  if(checking){if(cb)setTimeout(cb,HOLD);return;}checking=true;
  var done=function(){checking=false;firstCheck=true;if(cb)try{cb();}catch(e){}};
  try{
   var t0=OD.now(),ctl=typeof AbortController==='function'?new AbortController():null,tm=setTimeout(function(){try{ctl&&ctl.abort();}catch(e){}},HOLD);
   fetch('version.json?clk='+t0.toString(36),{method:'HEAD',cache:'no-store',signal:ctl?ctl.signal:undefined}).then(function(r){
    clearTimeout(tm);var h=r&&r.headers&&r.headers.get('date'),sv=h?OD.parse(h):NaN,t1=OD.now();
    if(isFinite(sv)&&sv>0&&t1-t0<10000){
     srvOff=sv-(t0+t1)/2;
     if(-srvOff>AHEAD){   // 電腦時間比網站快：回到網站時間（不低於上次看到的時間）
      var pn=PF.now(),est=t1+srvOff,base=L0+(pn-pBoot);
      if(!ahead0)ahead0=-srvOff;
      if(G0+(pn-p0)>Math.max(est,base)){G0=Math.max(est,base);p0=pn;}
     }
    }
    done();
   },function(){clearTimeout(tm);done();});
  }catch(e){done();}
 };
 var pBoot=p0;
 var now=function(){
  var r=OD.now(),pn=PF.now(),c=G0+(pn-p0),cr=r;
  if(srvOff!==null&&-srvOff>AHEAD)cr=r+srvOff;
  if(cr>c){
   if(booted&&cr-c>BACK&&!(pn<okJumpUntil)){
    if(!holdUntil){holdUntil=pn+HOLD;verify(function(){okJumpUntil=PF.now()+5000;holdUntil=0;});}
    if(pn<holdUntil)return Math.floor(c);
    holdUntil=0;
   }
   G0=cr;p0=pn;c=cr;
  }else if(booted&&c-cr>BACK&&!checking&&pn>nextBackCheck){nextBackCheck=pn+600000;verify();}
  booted=true;
  return Math.floor(c);
 };
 var nextBackCheck=0;
 function D(){
  if(!(this instanceof D))return new OD(now()).toString();
  var a=arguments,d;
  if(a.length===0)d=new OD(now());
  else if(a.length===1)d=new OD(a[0]);
  else d=new (Function.prototype.bind.apply(OD,[null].concat(Array.prototype.slice.call(a))))();
  var nt=new.target;
  if(nt&&nt!==D&&nt.prototype)try{Object.setPrototypeOf(d,nt.prototype);}catch(e){}
  return d;
 }
 D.prototype=OD.prototype;D.now=now;D.UTC=OD.UTC;D.parse=OD.parse;
 try{Object.defineProperty(D,'name',{value:'Date'});Object.defineProperty(D,'length',{value:7});}catch(e){}
 try{Object.defineProperty(OD.prototype,'constructor',{value:D,writable:true,configurable:true,enumerable:false});}catch(e){}
 try{W.Date=D;}catch(e){return;}
 var seen=function(){return now();};
 var api={
  now:now,seen:seen,raw:function(){return OD.now();},
  debt:function(){return debt0;},ahead:function(){return ahead0;},until:function(){return L0;},
  fmt:function(t){var d=new OD(t),z=function(n){return(n<10?'0':'')+n;};return(d.getMonth()+1)+' 月 '+d.getDate()+' 日 '+z(d.getHours())+':'+z(d.getMinutes());},
  absorb:function(t){t=Number(t)||0;if(!isFinite(t)||t<=0)return;var pn=PF.now(),c=G0+(pn-p0);if(t>c){if(t-OD.now()>BACK&&t-OD.now()>debt0)debt0=t-OD.now();if(t>L0)L0=t,pBoot=pn;G0=t;p0=pn;}}
 };
 try{Object.defineProperty(W,'__afkClock',{value:Object.freeze(api),writable:false,configurable:false});}catch(e){W.__afkClock=api;}
 // 記下「上次看到的時間」：第一次對時完成（或 3 秒）之後才開始記，免得把調快的時間記進去
 var persist=function(){if(!firstCheck&&PF.now()-pBoot<HOLD+500)return;if(holdUntil)return;write(now());};
 setInterval(persist,5000);
 addEventListener('pagehide',persist);
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&firstCheck&&!checking&&PF.now()>nextBackCheck){nextBackCheck=PF.now()+60000;verify();}else if(document.hidden)persist();});
 setInterval(function(){if(!document.hidden)verify();},600000);
 verify();
})();
(function(){'use strict';
 const events=[],returnKey='giran.recovery.return';
 function record(type,source,line){events.push({type,source:String(source||'').split('?')[0].split('/').pop(),line:line||0});if(events.length>40)events.shift();try{sessionStorage.setItem('lineage.merge.events',JSON.stringify(events));}catch{}}
 addEventListener('error',e=>{const t=e.target;if(t&&t!==window&&['SCRIPT','LINK'].includes(t.tagName))record('resource',t.src||t.href,0);else if(e.filename)record('runtime',e.filename,e.lineno);},true);
 addEventListener('unhandledrejection',()=>record('promise','game',0));
 function leaveSafely(){
  try{
   if(typeof player!=='undefined'&&player&&player.cls&&typeof state!=='undefined'&&state.running){
    window.__fb5CloseFlush=true;let saved;try{saved=typeof saveGame==='function'&&saveGame();}finally{window.__fb5CloseFlush=false;}
    if(saved!==true){alert('目前進度尚未成功保存。請保留這個遊戲分頁，另開修復頁面下載已保存資料；不要直接清除瀏覽器資料。');return false;}
    sessionStorage.setItem(returnKey,JSON.stringify({slot:currentSlot,role:_roleFingerprint(player),map:mapState.current}));
    state.running=false;if(typeof _roleSessionForget==='function')_roleSessionForget();
   }
   return true;
  }catch{alert('目前進度尚未成功保存，請先保留備份再離開遊戲。');return false;}
 }
 function goRecovery(){
  if(!leaveSafely())return;
  const url=new URL('recovery.html',location.href);
  if(document.documentElement.dataset.playMode==='dimension')url.searchParams.set('mode','dimension');
  location.assign(url.href);
 }
 function resumeGame(){
  const url=new URL(location.href);if(!url.searchParams.has('resume'))return;
  url.searchParams.delete('resume');history.replaceState(null,'',url);
  let back;try{back=JSON.parse(sessionStorage.getItem(returnKey)||'null');}catch{return;}
  if(!back)return;
  const slot=Number(back.slot),stored=Number.isSafeInteger(slot)&&slot>0&&_roleReadSavePlayer(slot);
  if(!stored||_roleFingerprint(stored)!==back.role){sessionStorage.removeItem(returnKey);return;}
  if(_roleOtherActiveSessions().some(row=>String(row.slot)===String(slot)))return;
  currentSlot=slot;loadGame();
  if(typeof player==='object'&&player?.cls&&_roleFingerprint(player)===back.role)sessionStorage.removeItem(returnKey);
 }
 window.addEventListener('load',()=>setTimeout(resumeGame,0),{once:true});
 function mountToolsEntry(){
  const panel=document.getElementById('tab-automation');if(!panel)return;
  let row=document.getElementById('m-afk-navrow');
  if(!row){
   row=document.createElement('div');row.id='m-afk-navrow';row.className='bg-slate-800 p-3 rounded-lg border border-slate-700';
   row.innerHTML='<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap"></div>';panel.append(row);
  }
  let a=document.getElementById('merge-recovery-game-entry');
  if(!a){a=document.createElement('a');a.id='merge-recovery-game-entry';a.href='recovery.html';a.dataset.mergeRecovery='';a.className='btn py-2 text-sm font-bold';a.textContent='存檔與修復';a.style.cssText='display:block;width:100%;margin-top:8px;text-align:center;text-decoration:none';}
  // Other tools may mount later. Keep recovery visually last without a polling loop.
  row.style.display='flex';row.style.flexDirection='column';a.style.order='1';
  if(a.parentNode!==row)row.append(a);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountToolsEntry,{once:true});else mountToolsEntry();
 document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('[data-merge-recovery]');if(a){e.preventDefault();goRecovery();}
 });
 window.LineageBoot={events,goRecovery};
})();
