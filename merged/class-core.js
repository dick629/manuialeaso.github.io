(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory;else root.LineageClassCore=factory(root.LineageClassCatalog);})(typeof globalThis!=='undefined'?globalThis:this,function(D){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
 const trees=new Map(D.trees.map(t=>[t.id,t])),skills=new Map(D.trees.flatMap(t=>t.skills.map(s=>[s.id,{...s,tree:t.id}])));
 const CLS={knight:'騎士',royal:'王族',elf:'妖精',mage:'法師',dark:'黑暗妖精',warrior:'戰士',dragon:'龍騎士',illusion:'幻術士'};
 function fail(message){throw Error(message);}
 function get(p){return p&&p.classPath||null;}
 function tree(p){const v=get(p);return v&&trees.get(v.route)||null;}
 function valid(p){const v=get(p);if(!v)return true;const t=trees.get(v.route);if(!t||t.base!==p.cls||v.version!==1||!integer(v.stage,1,3)||!v.ultimates||typeof v.ultimates!=='object'||Array.isArray(v.ultimates))return false;
  if(Object.entries(v.ultimates).some(([stage,id])=>{const s=skills.get(id);return !s||s.tree!==t.id||s.type!=='大絕'||String(s.stage)!==stage||s.stage>v.stage;}))return false;
  if(v.cooldowns&&(typeof v.cooldowns!=='object'||Array.isArray(v.cooldowns)||Object.values(v.cooldowns).some(x=>!Number.isFinite(x)||x<0)))return false;
  return (!v.auto||Array.isArray(v.auto)&&v.auto.length<=8&&new Set(v.auto).size===v.auto.length&&v.auto.every(id=>canUse(p,id)))&&(!v.auras||Array.isArray(v.auras)&&v.auras.length<=2&&new Set(v.auras).size===v.auras.length&&v.auras.every(id=>canUse(p,id)&&skills.get(id).type==='光環'));
 }
 function canUse(p,id){const s=skills.get(id),v=get(p);return !!(s&&v&&s.tree===v.route&&s.stage<=v.stage&&s.stage>=1&&(!s.requiresFusionTransfer||tree(p)?.requiresFusionTransfer)&& (s.type!=='大絕'||v.ultimates&&v.ultimates[s.stage]===id));}
 function requirement(t,stage){return t.requiresFusionTransfer?{cls:t.partnerKey,rebirth:2,level:200}:{cls:t.base,rebirth:stage-1,level:100};}
 function description(s){
  const breach=s.plan?.ops?.find(o=>o.kind==='breach');
  if(breach)return '命中後解除目標的'+(breach.mode==='magic'?'魔法':'物理')+'免疫，使 AC +'+breach.ac+'、魔防 '+breach.mr+'，持續 '+breach.seconds+' 秒。次元格擋率降低 '+breach.suppression+' 個百分點（頭目最低 70%、小怪最低 50%）。效果結束後 '+breach.recovery+' 秒內無法再次破除同類免疫。對無敵、封印及傷害門檻無效。';
  return String(s.description||'').replace(/包含自己、隊友與合法寵物／召喚物／守衛；同名取最高、光環不能被再次分享。/g,'作用於自己、隊友、寵物、召喚物與守衛；同名光環只取最強效果。').replace(/不生成可放置旗幟或距離判定。/g,'').replace(/不無限改目標刷首次攻擊。/g,'切換目標不會重置首次攻擊加成。').replace(/不召免費新軍/g,'需已有守衛在場').replace(/，不免費回血|；不免費學技藝/g,'').replace(/不能無屍免費再召/g,'重新召喚仍需屍骸').replace(/不能免費多召/g,'不增加召喚數量').replace(/合法/g,'').replace(/既有/g,'現有').replace(/合格直接承傷/g,'直接承傷').replace(/同名不疊/g,'同名效果不疊加').replace(/(\d+(?:\.\d+)?)([PHM])\b/g,(_,n,k)=>Math.round(Number(n)*10000)/100+'% '+({P:'技能基準傷害',H:'最大生命',M:'最大魔力'}[k])).replace(/\b[PHM]\b/g,k=>({P:'技能基準傷害',H:'最大生命',M:'最大魔力'}[k])).replace(/。{2,}/g,'。').replace(/；。/g,'。').trim();
 }
 function recipientGate(p,stage){if(!p||!CLS[p.cls]||p.classicMode) return '經典模式不開放職業進化';if(p.dead)return '死亡時不能進化';if(stage===1&&Number(p.rebirth||0)<1)return '本人需完成一轉';if(stage>=2&&Number(p.rebirth||0)<2)return '本人需完成二轉';if(stage===3&&p.afkFinalTier?.t3!=='win')return '本人需通過終焉第三階層';return '';}
 function freshVault(){return {version:1,souls:[],spent:{},sealed:{},revision:0};}
 function validVault(v){return !!(v&&v.version===1&&integer(v.revision,0,Number.MAX_SAFE_INTEGER)&&Array.isArray(v.souls)&&v.souls.length<=3&&v.spent&&v.sealed&&typeof v.spent==='object'&&typeof v.sealed==='object'&&!Array.isArray(v.spent)&&!Array.isArray(v.sealed)&&v.souls.every(s=>s&&typeof s==='object')&&new Set(v.souls.map(s=>s.id)).size===v.souls.length&&new Set(v.souls.map(s=>s.identity)).size===v.souls.length&&v.souls.every(s=>s&&typeof s.id==='string'&&!!s.id&&typeof s.identity==='string'&&!!s.identity&&typeof s.name==='string'&&CLS[s.cls]&&integer(s.level,1,200)&&integer(s.rebirth,0,2)&&typeof s.classic==='boolean'&&v.sealed[s.identity]===s.id&&!v.spent[s.id]));}
 function sourceIdentity(p,fingerprint){if(!p||!p.cls||!fingerprint)return '';return String(fingerprint).split('|')[0]+'|'+(p.classicMode?'classic':'normal');}
 function seal(v,p,meta){if(!validVault(v))fail('魂魄簿資料異常，請先修復存檔');if(v.souls.length>=3)fail('三格魂魄已滿');if(!meta||!meta.id||!meta.identity||v.sealed[meta.identity]||v.spent[meta.id]||v.souls.some(s=>s.id===meta.id))fail('角色或魂魄已使用，不能重複封存');if(!CLS[p.cls]||!integer(p.lv,1,200)||!integer(p.rebirth||0,0,2))fail('來源角色資料不完整');
  const out=copy(v),s={id:meta.id,identity:meta.identity,name:String(p.name||'冒險者'),cls:p.cls,level:p.lv,rebirth:p.rebirth||0,classic:!!p.classicMode,sealedAt:meta.at,sourceSlot:meta.slot};out.souls.push(s);out.sealed[s.identity]=s.id;out.revision++;return out;
 }
 function eligible(p,t,stage,s){const r=requirement(t,stage);return !!(s&&s.cls===r.cls&&s.rebirth===r.rebirth&&s.level>=r.level&&s.classic===!!p.classicMode);}
 function advance(p,v,route,soulId,ultimateId){if(!valid(p)||!validVault(v))fail('職業或魂魄資料異常，未消耗材料');const t=trees.get(route);if(!t||t.base!==p.cls)fail('流派與本職業不符');const old=get(p);if(!old&&p.afkEvo?.stage>0)fail('已有舊制進化，請先使用一次轉換');if(old&&old.route!==route)fail('流派永久固定，不能更換');const stage=(old?.stage||0)+1;if(stage>3)fail('已完成第三段');const gate=recipientGate(p,stage);if(gate)fail(gate);
  const soul=v.souls.find(s=>s.id===soulId),u=skills.get(ultimateId);if(!eligible(p,t,stage,soul))fail('魂魄職業、轉生次數或等級不符');if(!u||u.tree!==route||u.type!=='大絕'||u.stage!==stage)fail('請選擇本段永久大絕');
  const q=copy(p),w=copy(v);q.classPath={...(q.classPath||{version:1,route,stage:0,ultimates:{},auto:[],auras:[]}),stage};q.classPath.ultimates[stage]=ultimateId;w.souls=w.souls.filter(s=>s.id!==soulId);w.spent[soulId]={recipient:p.enSeed||p.name,route,stage};w.revision++;return {player:q,vault:w};
 }
 function convert(p,route,knownLegacy){if(p.classicMode)fail('經典模式不支援職業進化');if(get(p)||!knownLegacy||knownLegacy.cls!==p.cls||!integer(p.afkEvo?.stage,1,3))fail('沒有可轉換的舊制進化');const t=trees.get(route);if(!t||t.base!==p.cls||t.requiresFusionTransfer)fail('免費轉換僅限本職非融合流派；融合需外職二轉100魂魄');const q=copy(p);q.classPath={version:1,route,stage:p.afkEvo.stage,ultimates:{},auto:[],auras:[],legacy:copy(p.afkEvo)};return q;}
 function chooseUltimate(p,id){if(!valid(p))fail('職業資料異常');const q=copy(p),s=skills.get(id),v=q.classPath;if(!v||!s||s.type!=='大絕'||s.tree!==v.route||s.stage>v.stage)fail('大絕未開放');if(v.ultimates[s.stage]&&v.ultimates[s.stage]!==id)fail('大絕已永久選定');v.ultimates[s.stage]=id;return q;}
 return Object.freeze({D,CLS,trees,skills,copy,get,tree,valid,canUse,requirement,description,recipientGate,freshVault,validVault,sourceIdentity,seal,eligible,advance,convert,chooseUltimate});
});
