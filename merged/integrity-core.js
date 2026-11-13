(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./save-bridge'),require('./legacy-codec'),require('./class-core')(require('./class-catalog')));else r.LineageIntegrityCore=f(r.LineageSaveBridge,r.LineageLegacyCodec,()=>r.LineageClassCore);})(typeof globalThis!=='undefined'?globalThis:this,function(B,codec,classCore){
 'use strict';
 const C=()=>typeof classCore==='function'?classCore():classCore,copy=x=>JSON.parse(JSON.stringify(x)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),dict=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
 const V='lineage_character_souls_v1',S='afk_evo_used_v1';
 function fail(message){throw Error(message);}
 function fresh(){return {schema:1,revision:0,seen:{},sealed:{},spent:{},paths:{},retired:{},vaultRevision:0};}
 function valid(l){return l&&l.schema===1&&Number.isSafeInteger(l.revision)&&l.revision>=0&&['seen','sealed','spent','paths','retired'].every(k=>dict(l[k]))&&Number.isSafeInteger(l.vaultRevision)&&l.vaultRevision>=0;}
 function seed(p){return String(p.enSeed||('es'+codec.seedHash((p.name||'')+'|'+p.cls+'|lz').toString(36)));}
 function identity(p){return seed(p)+'|'+(p.classicMode?'classic':'normal');}
 // 11-13：allowDup＝已經存在的重複角色（true＝全部）可以略過第二份，不然重複了就什麼都刪不掉、改不了；新造成的重複照樣擋
 function dupIds(keys){const n={},d=new Set();for(const k of B.roleKeys(keys)){try{const p=B.validateRole(B.decode(keys[k]).value).p,id=identity(p);if(n[id])d.add(id);n[id]=1;}catch(e){}}return d;}
 function roles(keys,tolerateInvalid=false,allowDup=null){const out={};for(const k of B.roleKeys(keys)){let p;try{p=B.validateRole(B.decode(keys[k]).value).p;if(!C().valid(p))fail('職業資料無法驗證');}catch(e){if(tolerateInvalid)continue;throw e;}const id=identity(p);if(own(out,id)){if(allowDup===true||allowDup&&allowDup.has(id))continue;fail('發現重複角色身分，請先保留備份並檢查');}Object.defineProperty(out,id,{value:{key:k,p},enumerable:true});}return out;}
 // 11-12：存檔序號（js/13 saveGame 每存一次 +1）。曾經存在過的角色，只准匯入「比這台裝置上最後見過的還新」的進度（讀舊檔＝重：不准）
 function saveSeq(p){const n=Number(p&&p._saveSeq);return Number.isSafeInteger(n)&&n>0?n:0;}
 function path(p){return p.classPath?{route:p.classPath.route,stage:p.classPath.stage,ultimates:copy(p.classPath.ultimates||{})}:null;}
 function pathCheck(old,p,advance){const n=path(p);if(!old)return;if(!n||n.route!==old.route||n.stage<old.stage)fail('不能用舊存檔回退或更換永久職業路線');for(const [k,v] of Object.entries(old.ultimates))if(n.ultimates[k]!==v)fail('不能用舊存檔更換已選定的大絕');if(!advance&&(n.stage!==old.stage||Object.keys(n.ultimates).length!==Object.keys(old.ultimates).length))fail('職業進階與大絕必須由導師完成');}
 function vault(keys){if(!own(keys,V))return C().freshVault();const v=B.parse(keys[V]);if(!C().validVault(v))fail('魂魄簿異常，未重建或刪除原資料');return v;}
 function absorb(l,keys,{advance=false,tolerateInvalid=false,allowDup=null}={}){
  if(!valid(l))fail('本機保護帳本異常，請保留資料');const out=copy(l),rs=roles(keys,tolerateInvalid,allowDup);let v,used=[];
  // A corrupt current file may be replaced by a verified backup. Never reset the
  // independent history to make it fit: only the replacement must pass strictly.
  try{v=vault(keys);}catch(e){if(!tolerateInvalid)throw e;}
  try{used=own(keys,S)?B.parse(keys[S]):[];if(!Array.isArray(used)||used.some(x=>typeof x!=='string'))fail('舊制魂魄消耗紀錄異常');}catch(e){if(!tolerateInvalid)throw e;used=[];}
  for(const k of ['seen','sealed','spent','paths','retired'])Object.setPrototypeOf(out[k],null);
  for(const [id,{p}] of Object.entries(rs)){if(own(l.sealed,id)||own(l.retired,seed(p)))fail('備份含已封魂或已消耗的角色，不能恢復成可使用角色');if(!C().valid(p))fail('職業資料無法驗證');pathCheck(l.paths[id],p,advance);out.seen[id]=true;{const q=saveSeq(p);if(q>0){if(!dict(out.seq))out.seq=Object.create(null);if(!(Number(out.seq[id])>=q))out.seq[id]=q;}}if(path(p))out.paths[id]=path(p);}
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
  const prevDup=dupIds(before),base=absorb(l,before,{tolerateInvalid:true,allowDup:true}),after={...before};for(const c of changes){if((own(before,c.key)?before[c.key]:null)!==c.before)fail('資料已變更，請重新操作');if(c.after===null)delete after[c.key];else after[c.key]=c.after;}
  const rb=roles(before,true,true),ra=roles(after,false,prevDup),okKeys=new Set(Object.values(rb).map(x=>x.key)),bad=new Set(B.roleKeys(before).filter(k=>!okKeys.has(k)));
  const last=id=>Math.max(own(rb,id)?saveSeq(rb[id].p):0,dict(base.seq)?Number(base.seq[id])||0:0);
  if(kind==='import')for(const [id,{p}] of Object.entries(ra))if(!own(rb,id)&&own(base.seen,id)&&!(saveSeq(p)>last(id)))fail('這個角色曾經在這台裝置上出現過，而這份存檔不比上次的進度新；為了防止重複匯入舊裝備，只能匯入比較新的進度（請在原本的裝置上繼續玩、存檔後再匯出）');
  // 11-11 21:37 同一個角色讀回自己的舊存檔（覆蓋原位置）：角色名單必須完全不變；封魂、魂魄消耗、職業路線照樣由 absorb 擋
  // 11-12 女神挑戰紀錄點（checkpoint）同樣只能是同一個角色
  if(kind==='reload'||kind==='checkpoint'){const b=Object.keys(rb).sort().join('\n'),a2=Object.keys(ra).sort().join('\n');if(b!==a2)fail('只能讀回同一個角色自己的舊存檔');}
  // 11-12 讀舊檔＝重：任何寫入（匯入、讀回、還原、修復）都不能讓角色的存檔序號倒退；
  //   例外：女神挑戰紀錄點、目前那份存檔已經壞掉讀不出來（只能靠備份救回）
  if(kind!=='checkpoint')for(const [id,{key,p}] of Object.entries(ra)){if(bad.has(key))continue;const n=last(id);if(saveSeq(p)<n)fail('不能讀回比較舊的進度（這份存檔第 '+saveSeq(p)+' 次存檔，這台裝置上已經到第 '+n+' 次）。女神戰打輸請用「回到挑戰前」。');}
  // 11-12 帳本跟著存檔移動：把存檔帶來的帳本摘要（其他角色的序號、已消耗的角色）併進這台裝置的帳本
  const seeds=new Set(Object.values(ra).map(x=>seed(x.p)));
  for(const [id,{p}] of Object.entries(ra)){const a=p&&p._acct;if(!dict(a))continue;
   if(dict(a.seq))for(const [k,v] of Object.entries(a.seq)){if(own(ra,k))continue;const n=Number(v);if(Number.isSafeInteger(n)&&n>0){if(!dict(base.seq))base.seq=Object.create(null);if(!(Number(base.seq[k])>=n))base.seq[k]=n;}}
   if(Array.isArray(a.retired))for(const x of a.retired)if(typeof x==='string'&&x&&!seeds.has(x))base.retired[x]=true;}
  const next=absorb(base,after,{advance:kind==='class',allowDup:prevDup});next.revision=l.revision+1;return next;
 }
 return Object.freeze({fresh,valid,seed,identity,roles,vault,absorb,plan,path,saveSeq});
});
