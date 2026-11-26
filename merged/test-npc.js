(function(W){
 'use strict';
 const host=location.hostname,enabled=location.protocol==='file:'||host==='localhost'||host==='127.0.0.1'||host==='::1'||/^192\.168\./.test(host)||/^10\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);
 if(!enabled)return;
 const ID='npc_merged_tester',TOWN='town_talking',C=W.LineageGrowthCore;let busy=false;
 const copy=x=>JSON.parse(JSON.stringify(x)),n=x=>Number(x)||0;
 const fields=['trialQ','afkQuestRerun','afkKurtStats','afkWe','afkGs','afkRb','afkHunter','growth','lv','exp','bonus','rebirth','testTools'];
 function fill(p){
  p.afkKurtStats||={};for(const k of ['met','kills'])p.afkKurtStats[k]=Math.max(1,n(p.afkKurtStats[k]));
  p.afkWe||={};p.afkWe.stats||={};for(const id of W.__afkWorldEvents?.IDS||[]){const s=p.afkWe.stats[id]||={};s.met=Math.max(1,n(s.met));s.kills=Math.max(1,n(s.kills));}
  p.afkGs||={};for(const k of ['rides','captains'])p.afkGs[k]=Math.max(1,n(p.afkGs[k]));
  p.afkRb||={};p.afkRb.stats||={};for(const b of W.__afkRegionBoss?.LIST||[]){const s=p.afkRb.stats[b.r]||={};s.met=Math.max(1,n(s.met));s.kills=Math.max(1,n(s.kills));}
  p.trialQ||={};const L=W.__afkLore;for(const line of Object.values(L?.lines||{}))line.chapters.forEach((c,i)=>p.trialQ[L.keyOf(line,i,p.cls)]=2);
  for(const q of W.AFK_CLASS_SAGA?.chapters||[])if(q.cls===p.cls)p.trialQ[q.key]=2;
  for(const q of W.AFK_ADEN_QUESTS?.quests||[])p.trialQ[W.AFK_ADEN_QUESTS.keyOf(q,p)]=2;
  for(const [k,q] of Object.entries(TRIAL_Q))if(q.cls===p.cls&&!q.afkLore&&!q.afkSaga&&!q.afkAden)p.trialQ[k]=2;
  if(W.__afkHunter&&!p.classicMode){const h=W.__afkHunter.store(p);h.pts=Math.max(n(h.pts),W.__afkHunter.RANKS.at(-1)[1]);}
  if(!W.__afkSpecialCollection.full(p))throw Error('特殊收藏資料未全部對齊，已停止，沒有寫入');
  // These test completions belong to this rebirth, including a queued load hook.
  p.afkQuestRerun=Math.max(n(p.afkQuestRerun),n(p.rebirth));
 }
 function grow(p,mode){
  const full=W.__afkSpecialCollection.full(p);
  if(mode==='max'){p.rebirth=2;if(full)p.afkQuestRerun=Math.max(n(p.afkQuestRerun),n(p.rebirth));}const cap=W.__afkLvCap(p),lv=Math.max(n(p.lv),cap);p.bonus=n(p.bonus)+Math.max(0,lv-Math.max(49,n(p.lv)));p.lv=lv;p.exp=0;
  const g=W.LineageGrowth.read(p);if(!g)throw Error('成長資料異常，請先修復存檔');
 }
 async function run(mode){
  if(!['collection','level','max','paragon'].includes(mode))throw Error('未知測試選項');
  if(busy||!player?.cls||player.dead||!/^town_/.test(mapState.current)||_roleOtherActiveSessions().length)throw Error('請在村莊操作，並關閉其他遊戲分頁');
  if(player.classicMode)throw Error('此測試功能只提供一般模式');
  const p=player,slot=currentSlot,running=state.running;state.running=false;busy=true;const status=document.querySelector('#interaction-content [role=status]');if(status)status.textContent='正在備份與保存，請稍候…';
  try{
   const doc=JSON.parse(saveStateJson()),docs=new Map([[slot,doc]]),changes=[];
   if(mode==='collection')for(const a of p.allies||[]){const s=Number(a?._slot);if(!s||s===slot)continue;const u=_saveUnwrap(_lzGet('lineage_idle_save_'+s));if(!u?.ok)throw Error('隊友來源存檔驗證失敗，未修改');const d=JSON.parse(u.payload);if(!d.p?.cls)throw Error('隊友來源存檔不存在');docs.set(s,d);}
   for(const d of docs.values()){
    if(mode==='collection'){fill(d.p);for(const a of d.p.allies||[])if(a?.cls)fill(a);}
    else if(mode==='level'||mode==='max')grow(d.p,mode);
    else {if(n(d.p.rebirth)<1||n(d.p.lv)<100)throw Error('巔峰需一轉 Lv100，請先使用測試二轉滿等');const g=W.LineageGrowth.read(d.p);if(!g)throw Error('成長資料異常');g.paragon.level=W.LineageGrowthCore&&W.LineageGrowthCore.PMAX||1000;g.paragon.xp=0;}
    d.p.testTools={...(d.p.testTools||{}),used:true,last:mode,at:Date.now()};
   }
   for(const [s,d] of docs){const key='lineage_idle_save_'+s;changes.push({key,before:localStorage.getItem(key),after:'LZ1:'+LZString.compressToUTF16(_saveWrap(JSON.stringify(d))),reason:'LOCAL_TEST_NPC'});if(typeof _lzWorkerRev!=='undefined')_lzWorkerRev[key]=(_lzWorkerRev[key]||0)+1;}
   await W.LineageRecovery.transact(localStorage,changes,s=>W.LineageBackups.save({...s,label:'測試員操作前完整備份'},'test-npc'),{canWrite:()=>player===p&&currentSlot===slot&&!_roleOtherActiveSessions().length});
   for(const k of fields)if(k in doc.p)p[k]=doc.p[k];if(mode==='collection')for(const a of p.allies||[])if(a?.cls)fill(a);
   calcStats();updateUI();render('完成並保存；操作前完整備份可從「存檔與修復」還原。');
  }finally{busy=false;state.running=running;}
 }
 const options=[['collection','補滿全隊特殊收藏','補齊自己與現有隊友來源存檔的特殊收藏紀錄，包含劇情／任務完成紀錄；不發放任務獎品，也不修改終焉勝負或城堡。'],['level','目前轉生滿等','升到目前轉生上限（100／150／200），補足等級屬性點及應得天賦，不更改轉生。'],['max','測試二轉 Lv200','直接設為二轉 Lv200，天賦總額 135 點（扣除已用點）；不解鎖職業路線或補造終焉通關。'],['paragon','測試巔峰 P1000','巔峰到 1,000，保留已配點，剩餘點數可自由配置。']];
 function render(msg=''){const el=document.querySelector('#interaction-content');if(!el)return;el.innerHTML='<div style="color:#ddcc9e;display:grid;gap:12px;padding:12px"><h3>測試員・本機測試工具</h3><p>僅供測試副本使用。每次操作先備份，會標記為測試角色。正式公開網址不顯示此 NPC。</p>'+options.map(([id,label,desc])=>'<section style="border:1px solid #766544;padding:12px;background:#172922"><button class="btn w-full py-2" data-test-action="'+id+'">'+label+'</button><p style="font-size:14px;margin-top:8px">'+desc+'</p></section>').join('')+'<p role="status"></p></div>';el.querySelector('[role=status]').textContent=msg;el.onclick=e=>{const b=e.target.closest('[data-test-action]');if(!b||busy)return;const opt=options.find(x=>x[0]===b.dataset.testAction);W.AFK_UI.confirm({title:opt[1],message:opt[2]+' 操作前會保存完整備份。',requireText:player.name,onOk:async()=>{b.disabled=true;try{await run(opt[0]);}catch(e){render(e.message);}}});};}
 const def={id:ID,n:'測試員',title:'本機測試',type:'quest',classicHide:true,d:'集中調整測試角色的特殊收藏、等級、天賦與巔峰。'};
 if(W.__afkLore?.addNpc)W.__afkLore.addNpc(TOWN,def,null,null);else DB.towns[TOWN].npcs.push(def);
 const npc=W.interactNPC;W.interactNPC=function(id,town){const r=npc.apply(this,arguments);if(id===ID)render();return r;};
 const save=W.saveGame;W.saveGame=function(){if(busy)return false;return save.apply(this,arguments);};
 W.LineageTestNPC={run,fill,grow,render,id:ID,town:TOWN};
})(window);
