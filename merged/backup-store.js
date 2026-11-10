(function(root){'use strict';
 const DB='lineage-merged-safety',STORE='snapshots';let opening;
 const hash=async text=>{if(!root.crypto||!crypto.subtle)throw Error('目前環境無法驗證備份，請使用 HTTPS 或本機伺服器開啟。');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');};
 function open(){if(opening)return opening;opening=new Promise((resolve,reject)=>{let r;try{r=indexedDB.open(DB,1);}catch(e){reject(e);return;}r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('備份空間正在其他分頁更新，請關閉其他修復頁面。'));});return opening.catch(e=>{opening=null;throw e;});}
 async function operation(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);let result;try{const req=fn(tx.objectStore(STORE));if(req)req.onsuccess=()=>{result=req.result;};}catch(e){try{tx.abort();}catch{}reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('備份讀寫失敗。'));tx.onabort=()=>reject(tx.error||Error('備份未完成。'));});}
 async function read(id){const r=await operation('readonly',s=>s.get(id));if(!r||await hash(r.text)!==r.sha256)throw Error('備份完整性檢查失敗，未套用備份。');return {...r,snapshot:JSON.parse(r.text)};}
 async function list(){const all=await operation('readonly',s=>s.getAll());return all.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({text,...meta})=>meta);}
 async function save(snapshot,kind='repair'){
  const text=JSON.stringify(snapshot),sha256=await hash(text),id=Date.now().toString(36)+'-'+crypto.randomUUID();
  const r={id,kind,createdAt:new Date().toISOString(),text,sha256,bytes:text.length*2,changes:snapshot.changes?snapshot.changes.length:0};
  await operation('readwrite',s=>s.put(r));const verified=await read(id);
  if(verified.text!==text)throw Error('備份回讀內容不一致，沒有開始修復。');
  // Retain the latest eight verified snapshots. Never remove the current backup.
  // An unfinished protected transaction must retain its recovery snapshot even
  // when the user creates additional diagnostic checkpoints.
  let pinned=null,canPrune=true;try{pinned=(await root.LineageIntegrity?.status())?.pending?.backupId;}catch{canPrune=false;}
  const old=canPrune?(await list()).slice(8):[];for(const x of old)if(x.id!==pinned)try{await operation('readwrite',s=>s.delete(x.id));}catch{}
  return {id,verified:true};
 }
 root.LineageBackups=Object.freeze({save,read,list});
})(typeof globalThis!=='undefined'?globalThis:this);
