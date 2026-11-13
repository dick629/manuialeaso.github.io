(function(W){'use strict';
 const C=W.LineageIntegrityCore,S=W.LineageIntegrityStore,R=W.LineageRecovery;let busy=false;
 async function observe(){return S.edit(s=>{if(s.pending)throw Error('上次保存尚未結束，請到「存檔與修復」完成保護交易');s.ledger=C.absorb(s.ledger,R.capture(localStorage),{tolerateInvalid:true,allowDup:true});/* 11-13：已經重複的角色也要能進「刪除」流程 */s.ledger.revision++;return s;});}
 async function transact(store,changes,backup,options={}){
  if(store!==localStorage)throw Error('保護交易必須使用本機正式儲存區');if(busy)throw Error('已有保存操作進行中');busy=true;let token=null,applied=false;
  try{
   const current=await observe(),before=R.capture(store),kind=options.integrity||((changes.some(c=>/RESTORE|UNDO/.test(c.reason)))?'restore':'repair'),next=C.plan(current.ledger,before,changes,kind);
   const result=await R.transact(store,changes,async snapshot=>{const receipt=await backup(snapshot);if(!receipt?.verified||!receipt.id)throw Error('備份未驗證');token=await S.reserve(current.ledger.revision,next,changes,receipt.id);return receipt;},options);
   applied=true;if(token)await S.finish(token,true);return result;
  }catch(e){if(token&&!applied){const p=(await S.read()).pending;if(p?.token===token&&p.changes.every(c=>store.getItem(c.key)===c.before))await S.finish(token,false);}if(applied)e.message='資料已寫入，保護帳本尚待確認。請到「存檔與修復」完成保護交易。';throw e;
  }finally{busy=false;}
 }
 async function recover(){
  if(busy)throw Error('正在保存');if(!R.scan(R.capture(localStorage)).canRepair)throw Error('請先關閉遊戲分頁');busy=true;
  try{const r=await S.read(),p=r.pending;if(!p)return {status:'clean'};
   const is=(side)=>p.changes.every(c=>localStorage.getItem(c.key)===c[side]);
   if(is('after')){await S.finish(p.token,true);return {status:'committed'};}
   if(is('before')){await S.finish(p.token,false);return {status:'rolled-back'};}
   // 11-11 21:39：只改角色存檔的交易（例如職業進化），中斷後遊戲又自動存檔過 → 用職業傳承資料判斷那筆變更有沒有生效
   const roleOnly=p.changes.every(c=>/^lineage_idle_save_\d+$/.test(c.key));
   if(roleOnly&&p.changes.some(c=>{const v=localStorage.getItem(c.key);return v!==c.before&&v!==c.after;})){
    const cp=raw=>{try{if(raw==null)return 'null';const d=W.LineageSaveBridge.decode(raw).value;return JSON.stringify((d&&d.p&&d.p.classPath)||null);}catch(e){return '?';}};
    const side=p.changes.map(c=>{const v=cp(localStorage.getItem(c.key)),a=cp(c.after),b=cp(c.before);return v==='?'?'?':v===a&&a!==b?'after':v===b?'before':'?';});
    if(side.every(x=>x==='after')){await S.finish(p.token,true);return {status:'committed'};}
    if(side.every(x=>x==='before')){await S.finish(p.token,false);return {status:'rolled-back'};}
   }
   if(p.changes.some(c=>{const v=localStorage.getItem(c.key);return v!==c.before&&v!==c.after;}))throw Error('中斷後資料又有變更，不能自動覆蓋；請保留備份 ID：'+p.backupId);
   const changes=p.changes.filter(c=>localStorage.getItem(c.key)!==c.before).map(c=>({key:c.key,before:localStorage.getItem(c.key),after:c.before,reason:'INTERRUPTED_ROLLBACK'}));
   await R.transact(localStorage,changes,s=>W.LineageBackups.save(s,'integrity-recovery'),{canWrite:()=>R.scan(R.capture(localStorage)).canRepair});await S.finish(p.token,false);return {status:'rolled-back'};
  }finally{busy=false;}
 }
 W.LineageRecovery=Object.freeze({...R,transact});W.LineageIntegrity=Object.freeze({observe,recover,status:S.read,isBusy:()=>busy});
})(window);
