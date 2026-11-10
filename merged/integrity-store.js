(function(W){'use strict';
 let opening;const DB='lineage-integrity-v1',TABLE='account';
 function checked(value){
  const s=value===undefined?{ledger:W.LineageIntegrityCore.fresh(),pending:null}:value,p=s?.pending;
  if(!s||!W.LineageIntegrityCore.valid(s.ledger)||p!==null&&(!p||typeof p.token!=='string'||!p.token||typeof p.backupId!=='string'||!p.backupId||!W.LineageIntegrityCore.valid(p.next)||p.next.revision!==s.ledger.revision+1||!Array.isArray(p.changes)||p.changes.some(c=>!c||typeof c.key!=='string'||![c.before,c.after].every(v=>v===null||typeof v==='string'))||new Set(p.changes.map(c=>c.key)).size!==p.changes.length))throw Error('保護帳本或中斷紀錄損壞；沒有重建或覆蓋原紀錄');
  return s;
 }
 function open(){if(!opening)opening=new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(TABLE);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('保護帳本被其他分頁占用'));q.onsuccess=()=>{q.result.onversionchange=()=>{q.result.close();opening=null;};resolve(q.result);};}).catch(e=>{opening=null;throw e;});return opening;}
 async function edit(fn){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(TABLE,'readwrite'),s=t.objectStore(TABLE);let result,error;const q=s.get('local');q.onsuccess=()=>{try{result=checked(fn(checked(q.result)));s.put(result,'local');}catch(e){error=e;t.abort();}};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(error||t.error);t.onabort=()=>reject(error||t.error||Error('保護帳本交易中止'));});}
 async function read(){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(TABLE,'readonly'),q=t.objectStore(TABLE).get('local');q.onsuccess=()=>{try{resolve(checked(q.result));}catch(e){reject(e);}};q.onerror=()=>reject(q.error);});}
 async function reserve(revision,next,changes,backupId){const token=crypto.randomUUID();await edit(s=>{if(s.pending||s.ledger.revision!==revision)throw Error('有另一筆操作或資料已變更，請重新操作');s.pending={token,next,changes,backupId,at:Date.now()};return s;});return token;}
 async function finish(token,commit){return edit(s=>{if(!s.pending||s.pending.token!==token)throw Error('保護交易識別不符');if(commit)s.ledger=s.pending.next;s.pending=null;return s;});}
 W.LineageIntegrityStore=Object.freeze({edit,read,reserve,finish});
})(window);
