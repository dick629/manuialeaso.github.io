(function(W){'use strict';
 const policy=W.LineageOwnerPolicy,GM=new Set(['99998','99999']),roles=new Set(policy.roles),items=new Set(policy.items),cache=new Map(),pending=new Map(),key='lineage_admin_receipts_v1';
 const enc=new TextEncoder(),role=p=>W.LineageIntegrityCore.identity(p),subtle=()=>{if(!crypto.subtle)throw Error('管理授權需使用 HTTPS 或本機 localhost');return crypto.subtle;};
 const hash=async text=>Array.from(new Uint8Array(await subtle().digest('SHA-256',enc.encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
 async function prepare(p){if(!p?.cls)return false;const id=role(p);if(pending.has(id))return pending.get(id);const job=(async()=>{const allowed=roles.has(await hash(id));cache.set(id,allowed);return allowed;})();pending.set(id,job);return job;}
 const itemCache=new Map();
 async function prepareItem(e){const id=String(e.id)+'|'+e.uid;if(!itemCache.has(id))itemCache.set(id,items.has(await hash(id)));return itemCache.get(id);}
 async function refresh(p){if(!p?.cls)return false;const ok=await prepare(p);for(const e of [...Object.values(p.eq||{}),...(p.inv||[])])if(e&&GM.has(String(e.id))){await prepareItem(e);e.lock=true;}return ok;}
 function allowed(p,e){if(!p?.cls||!e||!GM.has(String(e.id)))return false;const id=role(p),ik=String(e.id)+'|'+e.uid;if(!cache.has(id))cache.set(id,roles.has(W.LineageIdentityDigest(id)));if(!itemCache.has(ik))itemCache.set(ik,items.has(W.LineageIdentityDigest(ik)));return cache.get(id)===true&&itemCache.get(ik)===true;}
 const gain=W.gainItem;W.gainItem=function(id){if(GM.has(String(id))||DB.items[id]?.gmOnly)throw Error('GM 裝備不開放發放；只保留已綁定帳號的原有裝備');return gain.apply(this,arguments);};
 const toggle=W.toggleLock;W.toggleLock=function(id){const e=[...(player.inv||[]),...Object.values(player.eq||{})].find(x=>x?.uid===id);if(e&&GM.has(String(e.id))){e.lock=true;return;}return toggle.apply(this,arguments);};
 const re=W.recomputeStats;let lastInv=null,lastLen=-1,lastEq=null;W.recomputeStats=function(){if(player?.cls){const inv=player.inv||[];if(inv!==lastInv||inv.length!==lastLen||player.eq!==lastEq){lastInv=inv;lastLen=inv.length;lastEq=player.eq;for(const e of Object.values(player.eq||{}))if(e&&GM.has(String(e.id)))e.lock=true;for(const e of inv)if(e&&GM.has(String(e.id)))e.lock=true;}}return re.apply(this,arguments);};
 const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 let busy=false;
 async function apply(code){if(busy)throw Error('授權操作進行中');busy=true;try{
  const [body,sig,...rest]=String(code).split('.');if(rest.length||!body||!sig)throw Error('授權碼格式錯誤');const bytes=decode(body),pub=await subtle().importKey('jwk',policy.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!await subtle().verify({name:'ECDSA',hash:'SHA-256'},pub,decode(sig),bytes))throw Error('授權碼簽章無效');
  const d=JSON.parse(new TextDecoder().decode(bytes)),p=player;
  if(!p?.cls||d.schema!==1||d.kind!=='item'||d.role!==await hash(role(p))||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>100000||!Number.isFinite(d.expires)||d.expires<Date.now()||d.expires>Date.now()+11*60*1000||typeof d.nonce!=='string'||d.nonce.length>80)throw Error('授權碼不適用此角色或已過期');
  if(!DB.items[d.item]||GM.has(String(d.item))||DB.items[d.item].gmOnly)throw Error('不可發放這個物品');
  if(!/^town_/.test(mapState.current)||p.dead)throw Error('請在村莊使用授權碼');
  const run=()=>{const old=localStorage.getItem(key),receipts=old?JSON.parse(old):{};if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))throw Error('授權帳本異常');if(receipts[d.nonce])throw Error('授權碼已使用');if(player!==p)throw Error('角色已切換');
   return W.LineageGrowth.transactionAsync('管理授權發放',()=>{if(player!==p||d.expires<Date.now()||localStorage.getItem(key)!==old)throw Error('授權狀態已變更，未發放');const count=()=>p.inv.filter(e=>String(e.id)===String(d.item)).reduce((n,e)=>n+(e.cnt==null?1:Number(e.cnt)),0),before=count();gain.call(W,d.item,d.quantity,true,true);if(count()-before!==d.quantity)throw Error('未完整取得指定數量，已取消發放');receipts[d.nonce]={at:Date.now(),role:d.role,item:d.item,quantity:d.quantity};const raw=JSON.stringify(receipts);localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('授權紀錄保存失敗');return true;},(disk,p)=>JSON.stringify(disk.p.inv)===JSON.stringify(p.inv));};
  return await (navigator.locks?navigator.locks.request('lineage-admin-grant',{mode:'exclusive'},run):run());
 }finally{busy=false;}}
 // This authenticates the supported administration entry. It is not a server or an anti-tamper boundary.
 W.LineageOwnerGuard=Object.freeze({allowed,prepare:refresh});W.LineageAdmin=Object.freeze({apply,identity:()=>hash(role(player))});
})(window);
