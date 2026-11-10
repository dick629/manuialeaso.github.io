(function(W){
 'use strict';
 const data=W.LineageDropPolicyData;if(!data||data.schema!==1)return;
 const blocked=new Map(Object.entries(data.blocked).map(([name,ids])=>[name,new Set(ids)]));
 const protectedIds=new Set(data.protectedIds),optional=new Set(data.optionalCollectionIds);
 const stats={removedEntries:0,filteredEntries:0,blockedEventRewards:0,optionalCollections:optional.size};
 function definitionProtected(id){
  const d=DB.items[id];if(!d)return false;
  const skill=d.ttmiSkill&&DB.skills&&DB.skills[d.ttmiSkill];
  return !!(d.relic||d.doll||d.slot==='doll'||d.type==='skillbk'||d.type==='pot'||d.questItem||d.ttmiBuff||d.ttmiLearn||d.ttmiHaste||d.ttmiMpMin!=null||d.afkSuperSale||d.ttmiDragonOnly||/藥水|藥劑|萬能藥/.test(d.n||'')||['panacea','poly'].includes(d.eff)||['buff','mp','blue','thirdHaste','antidote','poly'].includes(d.ttmiAction)||(d.ttmiAction==='scroll'&&skill&&['buff','heal'].includes(skill.type)));
 }
 function allows(mob,id){const name=typeof mob==='string'?mob:mob&&mob.n;return protectedIds.has(id)||definitionProtected(id)||!blocked.get(name)?.has(id);}
 function refreshProtection(){
  if(typeof CRAFT_RECIPES!=='undefined')for(const list of Object.values(CRAFT_RECIPES))for(const r of list){protectedIds.add(r.result);for(const q of r.req||r.mats||[])if(q.id)protectedIds.add(q.id);if(r.src)protectedIds.add(r.src);}
  if(typeof TRIAL_Q!=='undefined')for(const q of Object.values(TRIAL_Q)){for(const[id]of q.reqs||[])protectedIds.add(id);for(const id of q.rewards||[])protectedIds.add(id);}
 }
 function apply(){
  refreshProtection();
  const tables=[MOB_DROPS,DARK_WEAPON_DROPS,DARK_CRYSTAL_DROPS,DRAGON_DROPS,WARRIOR_DROPS,MEM_DROPS];
  for(const table of tables)for(const name of blocked.keys()){
   const list=table[name];if(!Array.isArray(list))continue;
   const kept=list.filter(e=>allows(name,Array.isArray(e)?e[0]:e&&e.id));
   if(kept.length!==list.length){stats.removedEntries+=list.length-kept.length;table[name]=kept;}
  }
  let collectionChanged=false;
  for(const id of optional){const d=DB.items[id];if(d){const value=!protectedIds.has(id)&&!definitionProtected(id);if(d.lmDropOptional!==value){d.lmDropOptional=value;collectionChanged=true;}}}
  if(collectionChanged&&typeof W.__afkDexCacheBump==='function')W.__afkDexCacheBump();
 }
 const oldFilter=W.__afkDropListFilter;
 W.__afkDropListFilter=function(mob,list){const incoming=oldFilter?oldFilter.apply(this,arguments)||list:list;const kept=incoming.filter(e=>allows(mob,Array.isArray(e)?e[0]:e&&e.id));stats.filteredEntries+=incoming.length-kept.length;return kept;};
 W.LineageDropPolicy={source:data.source,allows,apply,stats,allowEvent(mob,id){const allowed=allows(mob,id);if(!allowed)stats.blockedEventRewards++;return allowed;}};
 apply();W.addEventListener('load',apply);
})(window);
