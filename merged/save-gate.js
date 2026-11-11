/* Mandatory web import boundary: a role import never rewinds shared assets. */
(function(){'use strict';
 const B=window.LineageSaveBridge,R=window.LineageRecovery;
 function profile(p){
  const items=Object.fromEntries(Object.getOwnPropertyNames(DB.items).map(id=>{const d=DB.items[id],cap=['wpn','arm','acc'].includes(d.type)?enhanceCap(d):null,relic=!!window.__afkRelicPlus?.kindOk(d);return [id,{name:d.n,type:d.type,cap,relic,relicMax:relic?(cap<=5?10:15):undefined}];}));
  return {sherineSystem:1,classSystem:1,derivedRelics:1,items,maxLevel:typeof window.__afkLvCap==='function'?__afkLvCap(p):100,skills:Object.keys(DB.skills),maps:[...new Set([...Object.keys(DB.maps),...Object.keys(DB.towns),...Object.values(typeof MAP_CATEGORIES!=='undefined'?MAP_CATEGORIES:{}).flat().map(x=>x.v).filter(Boolean)])]};
 }
 // 11-12 00:42（Ping）：匯入除錯紀錄——每一步記下來，失敗時告訴玩家卡在哪一步；最近 20 筆存在 lineage_import_debug_v1，存檔與修復可以看、可以複製
 const DBG_KEY='lineage_import_debug_v1';let T=null;
 const shortP=p=>p?((p.name||'?')+'／'+(p.cls||'?')+'／'+(p.rebirth||0)+'轉 Lv'+(p.lv||'?')):'（無）';
 const trace={
  start(raw,slot){let head='';try{head=String(raw||'').replace(/^\uFEFF/,'').trimStart().slice(0,5);}catch(e){}
   T={at:new Date().toISOString(),slot,size:(raw||'').length,head,ver:(window.__afkCodeVersion||(document.querySelector('script[src*="save-gate.js"]')||{}).src||'').toString().slice(-20),ua:navigator.userAgent.replace(/\s+/g,' ').slice(0,120),steps:[],ok:null,msg:'',failStep:''};},
  step(name,detail){if(T)T.steps.push({n:name,d:String(detail==null?'':detail).slice(0,300),t:Date.now()});},
  end(ok,msg){if(!T)return;T.ok=ok;T.msg=String(msg||'').slice(0,500);if(!ok)T.failStep=(T.steps[T.steps.length-1]||{}).n||'';
   try{const a=JSON.parse(localStorage.getItem(DBG_KEY)||'[]');a.unshift(T);localStorage.setItem(DBG_KEY,JSON.stringify(a.slice(0,20)));}catch(e){}
   const r=T;T=null;return r;},
  fail(e){const r=trace.end(false,e&&e.message||e);return '匯入已停止：'+(e&&e.message||e)+(r?'\n\n【除錯】卡在第 '+r.steps.length+' 步「'+r.failStep+'」'+(r.steps.length?'：'+r.steps[r.steps.length-1].d:'')+'\n詳細紀錄：存檔與修復 →「匯入紀錄」。':'');}
 };
 window.LineageImportDebug={key:DBG_KEY,list(){try{return JSON.parse(localStorage.getItem(DBG_KEY)||'[]');}catch(e){return [];}},clear(){try{localStorage.removeItem(DBG_KEY);}catch(e){}}};
 window.LineageSaveGate={
  async importRole(raw,slot){
   trace.start(raw,slot);
   try{
    let cur0=null;try{cur0=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null;}catch(e){}
    trace.step('讀取檔案','大小 '+(raw||'').length+' 字元、開頭「'+String(raw||'').replace(/^\uFEFF/,'').trimStart().slice(0,5)+'」；選的位置 '+slot+'：'+shortP(cur0));
    // 11-11 23:56：完整備份也能「讀回同一個角色自己的舊進度」——從備份裡挑出這個位置那個角色的存檔來用
    let d0=null;try{d0=B.inspect(raw);}catch(e){trace.step('判斷檔案種類','解不開：'+(e.message||e));throw e;}
    trace.step('判斷檔案種類',d0.kind==='full'?'完整備份（裡面有 '+(d0.roles||[]).length+' 個角色）':'單一角色存檔：'+shortP(d0.value&&d0.value.p)+(d0.signed?'，有簽章':'，沒有簽章')+(d0.compressed?'，壓縮過':''));
    if(d0.kind==='full'){const pick=this.roleFromFull(d0,slot);trace.step('從完整備份挑角色',typeof pick==='string'?'找到這個位置的角色':pick.why);if(typeof pick!=='string')throw Error(pick.why);raw=pick;}
    if(!await this.beforeImport(raw,slot,true))return false;
    const decoded=B.decode(raw),doc=decoded.value;
    if(!decoded.signed&&!confirm('此存檔沒有完整性簽章。仍要匯入舊版角色嗎？')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
    const shared=['wh','pets','pandoraDiamonds','clanState'];
    if(shared.some(k=>Object.prototype.hasOwnProperty.call(doc,k))&&!confirm('單一角色匯入只帶入角色進度，不會覆蓋共用倉庫、寵物、貨幣或血盟。完整搬家請使用完整資料備份。繼續匯入角色嗎？')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
    doc.p.enSeed=LineageIntegrityCore.seed(doc.p);doc.p._roleEpoch=_roleEpoch();doc.p.allies=[];
    for(const k of shared)delete doc[k];
    const key='lineage_idle_save_'+slot;
    const cur=localStorage.getItem(key),reload=cur!==null;
    trace.step(reload?'讀回舊進度檢查':'匯入到空位置',reload?'倉庫存入次數：存檔 '+(Number(doc.p.afkWhPut)||0)+'／帳本 '+(window.__afkReloadLedger?window.__afkReloadLedger.wh(doc.p):'?'):'位置 '+slot);
    if(reload){const why=this.reloadWhy(doc.p,slot);if(why)throw Error(why);if(!confirm('這份是「'+(doc.p.name||'')+'」自己的舊存檔。\n要讀回這份舊進度嗎？這個位置目前的進度會被蓋掉（會先自動備份一份）。')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
     const RL=window.__afkReloadLedger;if(RL)doc.p.afkReloadN=RL.count(doc.p)+1;}
    const apply=async()=>{
     if(localStorage.getItem(key)!==cur)throw Error('目的位置的資料已變更，請重新操作');
     const change={key,before:cur,after:LineageLegacyCodec.wrap(JSON.stringify(doc)),reason:reload?'ROLE_RELOAD':'ROLE_IMPORT'};
     await R.transact(localStorage,[change],s=>LineageBackups.save({...s,originalImport:raw,slot},reload?'role-reload':'role-import'),{integrity:reload?'reload':'import',canWrite:()=>!(typeof state!=='undefined'&&state.running)&&R.scan(R.capture(localStorage)).canRepair});
     if(reload&&window.__afkReloadLedger)window.__afkReloadLedger.bump(doc.p);
    };
    trace.step('寫入存檔（保護交易）','先自動備份再寫入');
    await (navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},apply):apply());
    trace.step('完成',reload?'讀回成功':'匯入成功');trace.end(true,'');
    renderLoadSelect();alert(reload?'已讀回「'+(doc.p.name||'')+'」的舊進度；倉庫等共用資料維持原樣。':'角色已匯入；共用資料維持原進度。');return true;
   }catch(e){alert(trace.fail(e));return false;}
  },
  roleFromFull(d0,slot){
   const cur=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null,IC=window.LineageIntegrityCore;
   if(!cur||!IC)return {why:'這是完整備份。要讀回某個角色的舊進度，請先選那個角色原本的存檔位置再匯入；要整個還原請到「存檔與修復」。'};
   const want=IC.identity(cur);
   for(const k of d0.roles||[]){try{const v=d0.keys[k],p=B.decode(v).value.p;if(!p)continue;const q=Object.assign({},p);q.enSeed=IC.seed(p);if(IC.identity(q)===want)return v;}catch(e){}}
   return {why:'這份完整備份裡沒有「'+(cur.name||'')+'」。只能讀回同一個角色自己的舊進度；要整個還原請到「存檔與修復」。'};
  },
  // 11-11 21:37 同一個角色讀回自己的舊存檔：只限同一個角色；這份存檔之後有把東西存進倉庫就不行（防洗倉庫）
  reloadWhy(p,slot){
   try{
    const cur=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null;const IC=window.LineageIntegrityCore;
    if(!cur||!IC)return '此位置已有角色，請選擇空的存檔位置。';
    const q=Object.assign({},p);q.enSeed=IC.seed(p);
    if(IC.identity(q)!==IC.identity(cur))return '此位置已有別的角色。只能把同一個角色自己的舊存檔讀回它原本的位置；其他角色請選空的存檔位置。';
    const RL=window.__afkReloadLedger;if(RL&&(Number(p.afkWhPut)||0)<RL.wh(cur))return '這份舊存檔之後，這個角色有把東西存進倉庫，不能讀回這份存檔（避免倉庫裡的東西變成兩份）。';
    return '';
   }catch(e){return '讀不到這個位置的角色：'+e.message;}
  },
  async beforeImport(raw,slot,inner){
   const own=!T;if(own)trace.start(raw,slot);
   try{
    trace.step('遊戲狀態',(typeof state!=='undefined'&&state.running)?'遊戲還在進行中':'在角色選擇畫面');
    if(typeof player!=='undefined'&&player&&player.cls&&typeof state!=='undefined'&&state.running)throw Error('請先返回角色選擇畫面，再匯入存檔。');
    const data=B.inspect(raw);
    trace.step('檢查職業傳承資料',data.kind==='role'?shortP(data.value.p)+(data.value.p.classPath?'，有職業進化 '+data.value.p.classPath.route+' 第 '+data.value.p.classPath.stage+' 段':'，沒有職業進化'):'完整備份');
    if(data.kind==='role'&&window.LineageClassCore&&!LineageClassCore.valid(data.value.p))throw Error('職業傳承資料與目前版本不相容，未修改原始存檔');if(data.kind!=='role')throw Error('這是完整備份，請到「存檔與修復」還原。');
    trace.step('檢查存檔位置','位置 '+slot+'（上限 '+(typeof SAVE_SLOT_MAX!=='undefined'?SAVE_SLOT_MAX:'?')+'）'+(slotSummary(slot)?'，已有角色':'，空位置'));
    if(!Number.isInteger(slot)||slot<1||slot>SAVE_SLOT_MAX)throw Error('請先選擇有效的存檔位置。');
    if(slotSummary(slot)){trace.step('同一個角色檢查','備份：'+shortP(data.value.p));const why=this.reloadWhy(data.value.p,slot);if(why)throw Error(why);}
    const keys=R.capture(localStorage),status=R.scan(keys);
    trace.step('其他分頁檢查',status.canRepair?'沒有其他分頁在用':'有其他遊戲分頁開著');
    if(!status.canRepair)throw Error('其他遊戲分頁仍在使用資料，請先關閉後再匯入。');
    trace.step('檢查席琳界約資料','');
    if(window.LineageSherineCore&&!LineageSherineCore.valid(data.value.p))throw Error('席琳界約資料無法驗證');
    const compatibility=B.analyzeCompatibility(data.value,profile(data.value.p));
    trace.step('版本相容檢查',compatibility.ok?'相容':(compatibility.blockers||[]).map(b=>b.message).join('；'));
    if(!compatibility.ok)throw Error(compatibility.blockers[0].message+' 原始檔已保留，請使用對應版本。');
    trace.step('匯入前自動備份','');
    const snapshot={format:R.ID,schema:1,createdAt:new Date().toISOString(),keys,changes:[],originalImport:raw,slot};
    await LineageBackups.save(snapshot,'before-import');
    const after=R.capture(localStorage);
    if(!R.scan(after).canRepair)throw Error('備份期間有其他遊戲分頁啟動，請關閉後重新匯入。');
    // Session registry heartbeats may change harmlessly; every other source key must remain stable.
    const stable=k=>k!=='fb5_active_role_sessions_v1'&&k!=='afk_diag_hb';
    for(const k of new Set([...Object.keys(keys),...Object.keys(after)]))if(stable(k)&&keys[k]!==after[k]){trace.step('備份期間資料變動','變動的資料：'+k);throw Error('備份期間資料已變更，請重新匯入。');}
    if(own)trace.end(true,'檢查通過');
    return true;
   }catch(e){alert(trace.fail(e));return false;}
  },
  async restoreFull(pack){
   if(typeof state!=='undefined'&&state.running)throw Error('請先返回角色選擇畫面再還原。');
   const data=B.inspect(JSON.stringify(pack));if(data.kind!=='full')throw Error('不是完整資料備份。');
   const qp=R.quarantinePlan(data.keys);
   if(qp.count){
    if(!await confirm('備份有 '+qp.count+' 筆缺少物品 ID。是否完整備份後封存異常記錄，再還原其餘內容？不猜造或刪除原記錄。'))throw Error('已取消封存，原檔未更改');
    await LineageBackups.save({format:R.ID,schema:1,keys:data.keys,changes:[],originalImport:JSON.stringify(pack)},'import-original');
    data.keys={...data.keys};for(const change of qp.changes)data.keys[change.key]=change.after;
   }
   if(R.scan(data.keys).issues.some(x=>x.severity==='critical'))throw Error('備份含有毀損角色，沒有寫入任何資料。');
   for(const key of B.roleKeys(data.keys)){
    const role=B.decode(data.keys[key]).value;
    if(window.LineageClassCore&&!LineageClassCore.valid(role.p))throw Error('備份中的職業傳承資料無法驗證');
    if(window.LineageSherineCore&&!LineageSherineCore.valid(role.p))throw Error('席琳界約資料無法驗證');
    const c=B.analyzeCompatibility(role,profile(role.p));if(!c.ok)throw Error(key+' '+(c.blockers[0].location||'')+'：'+c.blockers[0].message);
   }
   const soulKey=window.LineageClasses?.KEY;if(soulKey&&data.keys[soulKey]&&!LineageClassCore.validVault(JSON.parse(data.keys[soulKey])))throw Error('備份中的魂魄簿無法驗證');
   // 11-11 14:13：電腦上的角色存檔有時是沒壓縮的明文（一格 180 萬字），手機寫不進去 → 角色與倉庫在寫入前先壓縮（遊戲讀取本來就會自動解壓）
   if(typeof LZString!=='undefined'){data.keys={...data.keys};for(const k of Object.keys(data.keys)){const v=data.keys[k];if((/^lineage_idle_save(?:_\d+)?$/.test(k)||/^lineage_idle_warehouse(?:_[a-z]+)*$/.test(k))&&typeof v==='string'&&v.length>20000&&v.slice(0,4)!=='LZ1:'){try{const z='LZ1:'+LZString.compressToUTF16(v);if(LZString.decompressFromUTF16(z.slice(4))===v)data.keys[k]=z;}catch{}}}}
   const apply=()=>{if(typeof _lzWorkerRev!=='undefined')for(const k of new Set([...Object.keys(data.keys),...Object.keys(R.capture(localStorage))]))_lzWorkerRev[k]=(_lzWorkerRev[k]||0)+1;return R.transact(localStorage,R.fullRestorePlan(data.keys,R.capture(localStorage)),snapshot=>LineageBackups.save(snapshot,'full-restore'),{canWrite:()=>R.scan(R.capture(localStorage)).canRepair});};
   return navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},apply):apply();
  }
 };
})();
