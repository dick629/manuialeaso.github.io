/* Mandatory web import boundary: a role import never rewinds shared assets. */
(function(){'use strict';
 const B=window.LineageSaveBridge,R=window.LineageRecovery;
 function profile(p){
  const items=Object.fromEntries(Object.getOwnPropertyNames(DB.items).map(id=>{const d=DB.items[id],cap=['wpn','arm','acc'].includes(d.type)?enhanceCap(d):null,relic=!!window.__afkRelicPlus?.kindOk(d);return [id,{name:d.n,type:d.type,cap,relic,relicMax:relic?(cap<=5?10:15):undefined}];}));
  return {sherineSystem:1,classSystem:1,derivedRelics:1,items,maxLevel:typeof window.__afkLvCap==='function'?__afkLvCap(p):100,skills:Object.keys(DB.skills),maps:[...new Set([...Object.keys(DB.maps),...Object.keys(DB.towns),...Object.values(typeof MAP_CATEGORIES!=='undefined'?MAP_CATEGORIES:{}).flat().map(x=>x.v).filter(Boolean)])]};
 }
 window.LineageSaveGate={
  async importRole(raw,slot){
   try{
    if(!await this.beforeImport(raw,slot))return false;
    const decoded=B.decode(raw),doc=decoded.value;
    if(!decoded.signed&&!confirm('此存檔沒有完整性簽章。仍要匯入舊版角色嗎？'))return false;
    const shared=['wh','pets','pandoraDiamonds','clanState'];
    if(shared.some(k=>Object.prototype.hasOwnProperty.call(doc,k))&&!confirm('單一角色匯入只帶入角色進度，不會覆蓋共用倉庫、寵物、貨幣或血盟。完整搬家請使用完整資料備份。繼續匯入角色嗎？'))return false;
    doc.p.enSeed=LineageIntegrityCore.seed(doc.p);doc.p._roleEpoch=_roleEpoch();doc.p.allies=[];
    for(const k of shared)delete doc[k];
    const key='lineage_idle_save_'+slot;
    const cur=localStorage.getItem(key),reload=cur!==null;
    if(reload){const why=this.reloadWhy(doc.p,slot);if(why)throw Error(why);if(!confirm('這份是「'+(doc.p.name||'')+'」自己的舊存檔。\n要讀回這份舊進度嗎？這個位置目前的進度會被蓋掉（會先自動備份一份）。'))return false;
     const RL=window.__afkReloadLedger;if(RL)doc.p.afkReloadN=RL.count(doc.p)+1;}
    const apply=async()=>{
     if(localStorage.getItem(key)!==cur)throw Error('目的位置的資料已變更，請重新操作');
     const change={key,before:cur,after:LineageLegacyCodec.wrap(JSON.stringify(doc)),reason:reload?'ROLE_RELOAD':'ROLE_IMPORT'};
     await R.transact(localStorage,[change],s=>LineageBackups.save({...s,originalImport:raw,slot},reload?'role-reload':'role-import'),{integrity:reload?'reload':'import',canWrite:()=>!(typeof state!=='undefined'&&state.running)&&R.scan(R.capture(localStorage)).canRepair});
     if(reload&&window.__afkReloadLedger)window.__afkReloadLedger.bump(doc.p);
    };
    await (navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},apply):apply());
    renderLoadSelect();alert(reload?'已讀回「'+(doc.p.name||'')+'」的舊進度；倉庫等共用資料維持原樣。':'角色已匯入；共用資料維持原進度。');return true;
   }catch(e){alert('匯入已停止：'+e.message);return false;}
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
  async beforeImport(raw,slot){
   try{
    if(typeof player!=='undefined'&&player&&player.cls&&typeof state!=='undefined'&&state.running)throw Error('請先返回角色選擇畫面，再匯入存檔。');
    const data=B.inspect(raw);if(data.kind==='role'&&window.LineageClassCore&&!LineageClassCore.valid(data.value.p))throw Error('職業傳承資料與目前版本不相容，未修改原始存檔');if(data.kind!=='role')throw Error('這是完整備份，請到「存檔與修復」還原。');
    if(!Number.isInteger(slot)||slot<1||slot>SAVE_SLOT_MAX)throw Error('請先選擇有效的存檔位置。');
    if(slotSummary(slot)){const why=this.reloadWhy(data.value.p,slot);if(why)throw Error(why);}
    const keys=R.capture(localStorage),status=R.scan(keys);
    if(!status.canRepair)throw Error('其他遊戲分頁仍在使用資料，請先關閉後再匯入。');
    if(window.LineageSherineCore&&!LineageSherineCore.valid(data.value.p))throw Error('席琳界約資料無法驗證');
    const compatibility=B.analyzeCompatibility(data.value,profile(data.value.p));
    if(!compatibility.ok)throw Error(compatibility.blockers[0].message+' 原始檔已保留，請使用對應版本。');
    const snapshot={format:R.ID,schema:1,createdAt:new Date().toISOString(),keys,changes:[],originalImport:raw,slot};
    await LineageBackups.save(snapshot,'before-import');
    const after=R.capture(localStorage);
    if(!R.scan(after).canRepair)throw Error('備份期間有其他遊戲分頁啟動，請關閉後重新匯入。');
    // Session registry heartbeats may change harmlessly; every other source key must remain stable.
    const stable=k=>k!=='fb5_active_role_sessions_v1'&&k!=='afk_diag_hb';
    for(const k of new Set([...Object.keys(keys),...Object.keys(after)]))if(stable(k)&&keys[k]!==after[k])throw Error('備份期間資料已變更，請重新匯入。');
    return true;
   }catch(e){alert('匯入已停止：'+e.message);return false;}
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
