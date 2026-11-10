(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./save-bridge'),require('./legacy-codec'),require('./class-core')(require('./class-catalog')));else r.LineageIntegrityCore=f(r.LineageSaveBridge,r.LineageLegacyCodec,()=>r.LineageClassCore);})(typeof globalThis!=='undefined'?globalThis:this,function(B,codec,classCore){
 'use strict';
 const C=()=>typeof classCore==='function'?classCore():classCore,copy=x=>JSON.parse(JSON.stringify(x)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),dict=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
 const V='lineage_character_souls_v1',S='afk_evo_used_v1';
 function fail(message){throw Error(message);}
 function fresh(){return {schema:1,revision:0,seen:{},sealed:{},spent:{},paths:{},retired:{},vaultRevision:0};}
 function valid(l){return l&&l.schema===1&&Number.isSafeInteger(l.revision)&&l.revision>=0&&['seen','sealed','spent','paths','retired'].every(k=>dict(l[k]))&&Number.isSafeInteger(l.vaultRevision)&&l.vaultRevision>=0;}
 function seed(p){return String(p.enSeed||('es'+codec.seedHash((p.name||'')+'|'+p.cls+'|lz').toString(36)));}
 function identity(p){return seed(p)+'|'+(p.classicMode?'classic':'normal');}
 function roles(keys,tolerateInvalid=false){const out={};for(const k of B.roleKeys(keys)){let p;try{p=B.validateRole(B.decode(keys[k]).value).p;if(!C().valid(p))fail('職業資料無法驗證');}catch(e){if(tolerateInvalid)continue;throw e;}const id=identity(p);if(own(out,id))fail('發現重複角色身分，請先保留備份並檢查');Object.defineProperty(out,id,{value:{key:k,p},enumerable:true});}return out;}
 function path(p){return p.classPath?{route:p.classPath.route,stage:p.classPath.stage,ultimates:copy(p.classPath.ultimates||{})}:null;}
 function pathCheck(old,p,advance){const n=path(p);if(!old)return;if(!n||n.route!==old.route||n.stage<old.stage)fail('不能用舊存檔回退或更換永久職業路線');for(const [k,v] of Object.entries(old.ultimates))if(n.ultimates[k]!==v)fail('不能用舊存檔更換已選定的大絕');if(!advance&&(n.stage!==old.stage||Object.keys(n.ultimates).length!==Object.keys(old.ultimates).length))fail('職業進階與大絕必須由導師完成');}
 function vault(keys){if(!own(keys,V))return C().freshVault();const v=B.parse(keys[V]);if(!C().validVault(v))fail('魂魄簿異常，未重建或刪除原資料');return v;}
 function absorb(l,keys,{advance=false,tolerateInvalid=false}={}){
  if(!valid(l))fail('本機保護帳本異常，請保留資料');const out=copy(l),rs=roles(keys,tolerateInvalid);let v,used=[];
  // A corrupt current file may be replaced by a verified backup. Never reset the
  // independent history to make it fit: only the replacement must pass strictly.
  try{v=vault(keys);}catch(e){if(!tolerateInvalid)throw e;}
  try{used=own(keys,S)?B.parse(keys[S]):[];if(!Array.isArray(used)||used.some(x=>typeof x!=='string'))fail('舊制魂魄消耗紀錄異常');}catch(e){if(!tolerateInvalid)throw e;used=[];}
  for(const k of ['seen','sealed','spent','paths','retired'])Object.setPrototypeOf(out[k],null);
  for(const [id,{p}] of Object.entries(rs)){if(own(l.sealed,id)||own(l.retired,seed(p)))fail('備份含已封魂或已消耗的角色，不能恢復成可使用角色');if(!C().valid(p))fail('職業資料無法驗證');pathCheck(l.paths[id],p,advance);out.seen[id]=true;if(path(p))out.paths[id]=path(p);}
  if(v){
  for(const [id,sid] of Object.entries(l.sealed))if(v.sealed[id]!==sid)fail('還原會回退封魂紀錄，已停止');
  for(const [sid,receipt] of Object.entries(l.spent))if(!own(v.spent,sid)||JSON.stringify(v.spent[sid])!==JSON.stringify(receipt))fail('還原會回退魂魄消耗紀錄，已停止');
  if(v.revision<l.vaultRevision)fail('魂魄簿版本落後，不能回退');
  for(const s of v.souls)if(own(l.spent,s.id))fail('魂魄已消耗，不能重複使用');
  for(const [id,sid] of Object.entries(v.sealed)){out.sealed[id]=sid;if(own(rs,id))fail('同一角色不能同時存在於存檔與魂魄簿');}
  Object.assign(out.spent,v.spent);out.vaultRevision=v.revision;
  }
  for(const x of used)out.retired[x]=true;
  for(const {p} of Object.values(rs))if(own(out.retired,seed(p)))fail('備份含已消耗角色');
  return out;
 }
 function plan(l,before,changes,kind='repair'){
  const base=absorb(l,before,{tolerateInvalid:true}),after={...before};for(const c of changes){if((own(before,c.key)?before[c.key]:null)!==c.before)fail('資料已變更，請重新操作');if(c.after===null)delete after[c.key];else after[c.key]=c.after;}
  if(kind==='import')for(const [id] of Object.entries(roles(after)))if(!own(roles(before,true),id)&&own(base.seen,id))fail('這個角色曾經存在或匯入過；不能刪角後重複匯入舊裝備。請使用完整備份檢查還原');
  const next=absorb(base,after,{advance:kind==='class'});next.revision=l.revision+1;return next;
 }
 return Object.freeze({fresh,valid,seed,identity,roles,vault,absorb,plan,path});
});
