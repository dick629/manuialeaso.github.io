(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./save-bridge.js'),()=>require('./class-core.js')(require('./class-catalog.js')));else root.LineageRecovery=factory(root.LineageSaveBridge,()=>root.LineageClassCore);})(typeof globalThis!=='undefined'?globalThis:this,function(bridge,getClassCore){
 'use strict';
 const ROLE=/^lineage_idle_save(?:_\d+)?$/;
 const ID='lineage-merged-recovery-v1';
 const QUARANTINE='lineage_repair_quarantine_v1';
 const brokenItem=it=>it!=null&&(!bridge.record(it)||!['string','number'].includes(typeof it.id)||String(it.id).trim()==='');
 function quarantineData(keys){
  if(!bridge.own(keys,QUARANTINE))return {format:'lineage-item-quarantine',schema:1,entries:[]};
  const q=bridge.parse(keys[QUARANTINE]);
  if(!q||q.format!=='lineage-item-quarantine'||q.schema!==1||!Array.isArray(q.entries))throw error('QUARANTINE','隔離區資料無法驗證，請先保留完整備份；不會覆蓋舊資料。');
  return q;
 }
 function quarantinePlan(keys,now=Date.now()){
  const changes=[],q=quarantineData(keys);let count=0;
  for(const key of bridge.roleKeys(keys)){
   let d;try{d=bridge.decode(keys[key]);bridge.validateRole(d.value);}catch{continue;}
   const bad=d.value.p.inv.map((item,index)=>({item,index})).filter(x=>brokenItem(x.item));if(!bad.length)continue;
   bad.forEach(x=>q.entries.push({roleKey:key,inventoryIndex:x.index,record:x.item,reason:'MISSING_ITEM_ID',isolatedAt:new Date(now).toISOString()}));
   count+=bad.length;d.value.p.inv=d.value.p.inv.filter(it=>!brokenItem(it));
   const after=bridge.encodeRole(d.value);bridge.decode(after);
   changes.push({key,before:keys[key],after,reason:'QUARANTINE_ITEMS'});
  }
  if(count)changes.push({key:QUARANTINE,before:bridge.own(keys,QUARANTINE)?keys[QUARANTINE]:null,after:JSON.stringify(q),reason:'PRESERVE_QUARANTINE'});
  return {changes,count};
 }
 function error(code,message){const e=new Error(message);e.code=code;return e;}
 function capture(store){const out=Object.create(null);for(let i=0;i<store.length;i++){const k=store.key(i),v=store.getItem(k);if(k!==null&&v!==null)out[k]=v;}return out;}
 function scan(keys,now=Date.now()){
  const issues=[],changes=[],identities=new Map();let roles=0,bytes=0;
  const issue=(code,severity,message,extra={})=>issues.push({code,severity,message,...extra});
  for(const [key,raw] of Object.entries(keys)){
   bytes+=(key.length+raw.length)*2;
   if(ROLE.test(key)){
    roles++;let d;
    try{d=bridge.decode(raw);bridge.validateRole(d.value);}catch(e){issue('SAVE_'+(e.code||'READ'),'critical',e.message,{key,automatic:false});continue;}
    const p=d.value.p;const classes=getClassCore&&getClassCore();if(classes&&!classes.valid(p))issue('CLASS_INVALID','critical','職業流派或永久大絕紀錄不符，請保留備份，不會重選或清除。',{key,automatic:false});
    const broken=p.inv.filter(brokenItem).length;
    if(broken)issue('MISSING_ITEM_ID','repairable','背包有 '+broken+' 筆缺少物品 ID 的異常紀錄；可先備份並完整封存到隔離區，不猜造數量或強化值。',{key,automatic:true,count:broken});
    if(Object.values(p.eq).some(brokenItem))issue('BROKEN_EQUIPPED_ITEM','critical','穿著的裝備缺少物品 ID，無法安全推定原裝備，請保留備份。',{key,automatic:false});
    if(!Number.isFinite(p.lv)||p.lv<1||!Number.isFinite(p.gold)||p.gold<0||!Number.isFinite(p.exp)||p.exp<0)issue('PROGRESS_INVALID','critical','角色數值不完整，請使用備份還原或匯出診斷報告。',{key,automatic:false});
    const ident=p.enSeed;
    if(ident&&identities.has(ident))issue('DUPLICATE_ROLE','warning','有兩個存檔位使用相同角色身分，請保留備份後確認要使用的角色。',{key,automatic:false});
    if(ident)identities.set(ident,key);
    const ids=new Set();let duplicate=false;
    for(const it of [...p.inv,...Object.values(p.eq)])if(it&&it.uid!==undefined){if(ids.has(String(it.uid)))duplicate=true;ids.add(String(it.uid));}
    if(duplicate)issue('DUPLICATE_ITEM_UID','warning','物品識別資料重複，需要確認物品關聯後處理。',{key,automatic:false});
    // Repair only the representation of a verified save, never its game payload.
    if(!broken&&!d.compressed&&raw!==d.portable){changes.push({key,before:raw,after:d.portable,reason:'SAVE_WHITESPACE'});issue('SAVE_WHITESPACE','repairable','可清除存檔外層的多餘字元，角色內容保持原樣。',{key,automatic:true});}
    if(!d.signed)issue('UNSIGNED','notice','這份角色來自舊版無簽章存檔，已保留原內容。',{key,automatic:false});
   }
  }
  try{if(issues.some(x=>x.code==='MISSING_ITEM_ID'))changes.push(...quarantinePlan(keys,now).changes);else if(bridge.own(keys,QUARANTINE))quarantineData(keys);}catch(e){issue('QUARANTINE_INVALID','critical',e.message,{automatic:false});}
  const soulKey='lineage_character_souls_v1';if(bridge.own(keys,soulKey)){try{const classes=getClassCore&&getClassCore();if(!classes||!classes.validVault(bridge.parse(keys[soulKey])))throw Error('invalid soul ledger');}catch{issue('SOUL_VAULT_INVALID','critical','魂魄簿無法驗證，請保留完整備份；不會自動刪除、重建或解除已消耗紀錄。',{key:soulKey,automatic:false});}}
  const scale=keys.afk_ui_scale;
  if(scale!==undefined&&(!/^\d+(?:\.\d+)?$/.test(scale)||Number(scale)<0.9||Number(scale)>1.4)){
   changes.push({key:'afk_ui_scale',before:scale,after:'1',reason:'UI_SCALE'});issue('UI_SCALE','repairable','介面縮放設定異常，可恢復正常大小。',{automatic:true});
  }
  const lite=keys.afk_ui_lite;
  if(lite!==undefined&&!['0','1'].includes(lite)){
   changes.push({key:'afk_ui_lite',before:lite,after:null,reason:'UI_LITE'});issue('UI_LITE','repairable','輕量顯示設定異常，可恢復自動判斷。',{automatic:true});
  }
  if(keys.afk_uiscale_v1!==undefined){
   try{
    const value=bridge.parse(keys.afk_uiscale_v1);
    const ranges={scale:[0.6,1],left:[240,640],right:[240,640],log:[0,900],split:[20,80]};
    if(!bridge.record(value)||Object.entries(ranges).some(([k,[min,max]])=>value[k]!==undefined&&(!Number.isFinite(value[k])||value[k]<min||value[k]>max)))throw Error('scale');
   }catch{
    changes.push({key:'afk_uiscale_v1',before:keys.afk_uiscale_v1,after:null,reason:'DESKTOP_SCALE'});
    issue('DESKTOP_SCALE','repairable','電腦縮放設定異常，可在備份後恢復預設框架大小。',{automatic:true});
   }
  }
  let active=[];
  if(keys.fb5_active_role_sessions_v1){
   try{const r=bridge.parse(keys.fb5_active_role_sessions_v1);if(!bridge.record(r)||Object.values(r).some(x=>!bridge.record(x)||!Number.isFinite(x.ts)))throw Error('invalid session');active=Object.values(r).filter(x=>x.ts>now-90000);}catch{issue('SESSION_DATA','warning','分頁狀態無法判定，請關閉其他遊戲分頁後重新檢查。',{automatic:false});}
  }
  if(active.length)issue('OTHER_SESSION','blocking','另有遊戲分頁正在使用存檔；請先離開該分頁的遊戲，再重新檢查。',{automatic:false});
  return {schema:1,roles,estimatedBytes:bytes,issues,changes,activeSessions:active.length,canRepair:!active.length&&!issues.some(x=>x.code==='SESSION_DATA')};
 }
 const OPTIONAL=/^(afk_hist_|afk_diag_|afk_return_probe|lineage_repair_quarantine|lineage_growth_transaction_backup)|_bak$/;
 async function transact(store,changes,backup,options={}){
  if(!Array.isArray(changes)||changes.some(c=>typeof c.key!=='string'||!(c.after===null||typeof c.after==='string')))throw error('PLAN','修復計畫不完整。');
  if(new Set(changes.map(c=>c.key)).size!==changes.length)throw error('PLAN','修復計畫包含重複項目。');
  if(!changes.length)return {ok:true,changed:0,backupId:null};
  if(options.canWrite&&!(await options.canWrite()))throw error('BUSY','目前無法安全寫入，請關閉其他遊戲分頁。');
  for(const c of changes)if(store.getItem(c.key)!==c.before)throw error('CONFLICT','資料已變更，請重新檢查後再試。');
  const snapshot=capture(store);
  const receipt=await backup({format:ID,schema:1,createdAt:new Date().toISOString(),keys:snapshot,changes});
  if(!receipt||!receipt.verified||!receipt.id)throw error('BACKUP','修復前備份未能完成，沒有修改任何資料。');
  if(options.canWrite&&!(await options.canWrite()))throw error('BUSY','備份期間有其他遊戲分頁啟動，沒有修改資料。');
  for(const c of changes)if(store.getItem(c.key)!==c.before)throw error('CONFLICT','備份期間資料已變更（'+c.key+'），沒有修改資料。');
  const applied=[];
  try{
   for(const c of changes){
    if(store.getItem(c.key)!==c.before)throw error('CONFLICT','寫入期間資料已變更。');
    if(c.after===null)store.removeItem(c.key);else{
     try{store.setItem(c.key,c.after);}
     catch(q){
      // 11-11：手機空間不夠時，可再生的紀錄（歷史、診斷、_bak 副本、隔離區紀錄）先略過，角色與倉庫照寫
      if(OPTIONAL.test(c.key)&&/quota|22/i.test(String(q&&(q.name||q.code||q.message)))){try{store.removeItem(c.key);}catch{}c.skipped=true;c.after=null;}
      else{q.failKey=c.key;q.failSize=c.after.length;throw q;}
     }
    }
    applied.push(c);
    if(store.getItem(c.key)!==c.after)throw error('VERIFY','寫入後驗證失敗。');
   }
   return {ok:true,changed:changes.length,backupId:receipt.id};
  }catch(cause){
   const failed=[];
   for(const c of applied.reverse()){
    try{
     // Do not overwrite a concurrent writer while trying to undo our own change.
     const current=store.getItem(c.key);
     if(current!==c.after&&current!==c.before){failed.push(c.key);continue;}
     if(current!==c.before){if(c.before===null)store.removeItem(c.key);else store.setItem(c.key,c.before);}
     if(store.getItem(c.key)!==c.before)failed.push(c.key);
    }catch{failed.push(c.key);}
   }
   let used=0;try{for(let i=0;i<store.length;i++){const k=store.key(i);used+=k.length+(store.getItem(k)||'').length;}}catch{}
   const e=error(failed.length?'ROLLBACK_INCOMPLETE':'WRITE_FAILED',failed.length?'寫入與回復未完全成功，請使用修復前備份還原。':'寫入失敗，已回復本次修改。');
   e.backupId=receipt.id;e.rollbackFailed=failed;e.causeCode=cause.code||cause.name;e.failKey=cause.failKey;e.failSize=cause.failSize;e.used=used;throw e;
  }
 }
 function undoPlan(snapshot,current){
  if(!snapshot||snapshot.format!==ID||snapshot.schema!==1||!Array.isArray(snapshot.changes))throw error('BACKUP','這份備份不能用來撤銷修復。');
  return snapshot.changes.map(c=>{
   const v=bridge.own(current,c.key)?current[c.key]:null;
   if(v!==c.after)throw error('CONFLICT','修復後已有新的變更，不能直接撤銷；請保留現況並使用備份檢查。');
   return {key:c.key,before:v,after:c.before,reason:'UNDO'};
  });
 }
 function fullRestorePlan(incoming,current){
  if(!bridge.record(incoming)||Object.values(incoming).some(v=>typeof v!=='string'))throw error('PACK','備份資料不完整。');
  const changes=[];
  for(const key of new Set([...Object.keys(current),...Object.keys(incoming)])){
   if(key==='fb5_active_role_sessions_v1'||key==='afk_diag_hb'||key==='lineage_admin_receipts_v1')continue;
   // 玩家 11-11：舊版的整份交易備份（約 5MB）不還原、而且清掉，否則手機容量不夠、轉移碼還原寫入失敗
   const before=bridge.own(current,key)?current[key]:null,after=key==='lineage_growth_transaction_backup_v1'?null:(bridge.own(incoming,key)?incoming[key]:null);
   if(before!==after)changes.push({key,before,after,reason:'FULL_RESTORE'});
  }
  // Release keys absent from the snapshot before growing others; backup already exists before transact writes.
  return changes.sort((a,b)=>(a.after!==null)-(b.after!==null));
 }
 function report(scanResult,events=[],build='merge-0.1'){
  return {format:'lineage-diagnostic',schema:1,build,createdAt:new Date().toISOString(),roles:scanResult.roles,
   issues:scanResult.issues.map(({code,severity,automatic,key})=>({code,severity,automatic,slot:key&&ROLE.test(key)?key.replace('lineage_idle_save_',''):undefined})),
   events:events.slice(-40).map(e=>({type:e.type,source:String(e.source||'').split(/[\\/]/).pop().split('?')[0],line:Number(e.line)||0})),
   includesSaveData:false};
 }
 return Object.freeze({capture,scan,transact,undoPlan,fullRestorePlan,report,ID,quarantinePlan,quarantineData,QUARANTINE});
});
