/* Retire seven catalogue entries and unify snowman definitions without rewriting saves. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else{
  const api=root.LineageDollPolicy=factory();
  api.install({items:DB.items,ttmi:root.AFK_TTMI_ITEMS,dropcut:root.__afkDropCut,
   drops:[typeof MOB_DROPS==='undefined'?null:MOB_DROPS,typeof DARK_WEAPON_DROPS==='undefined'?null:DARK_WEAPON_DROPS,typeof DARK_CRYSTAL_DROPS==='undefined'?null:DARK_CRYSTAL_DROPS,typeof DRAGON_DROPS==='undefined'?null:DRAGON_DROPS,typeof WARRIOR_DROPS==='undefined'?null:WARRIOR_DROPS,typeof MEM_DROPS==='undefined'?null:MEM_DROPS],
   recipes:typeof CRAFT_RECIPES==='undefined'?null:CRAFT_RECIPES,shops:typeof SHOP_LISTS==='undefined'?null:SHOP_LISTS,
   catalogs:[{groups:typeof MISC_CAT_ITEMS==='undefined'?null:MISC_CAT_ITEMS,index:typeof MISC_ITEM_CAT==='undefined'?null:MISC_ITEM_CAT},{groups:typeof EQUIP_CAT_ITEMS==='undefined'?null:EQUIP_CAT_ITEMS,index:typeof EQUIP_ITEM_CAT==='undefined'?null:EQUIP_ITEM_CAT}],
   obtainable:typeof OBTAINABLE_MISC==='undefined'?null:OBTAINABLE_MISC});
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const retired=Object.freeze(['ttmi_12520','ttmi_12521','ttmi_14336','ttmi_14337','ttmi_14340','ttmi_14341','ttmi_14535']);
 const snow=Object.freeze(['ttmi_10574','ttmi_10575','ttmi_10576','ttmi_10578']);
 const canonical='doll_雪人';
 const idOf=x=>Array.isArray(x)?x[0]:x&&typeof x==='object'?x.id:x;
 function strip(table,set){
  if(!table)return;
  for(const rows of Object.values(table))if(Array.isArray(rows))for(let i=rows.length-1;i>=0;i--)if(set[idOf(rows[i])])rows.splice(i,1);
 }
 function install(env){
  const items=env.items,base=items&&items[canonical];
  if(!base)throw Error('缺少原版雪人娃娃定義，未執行娃娃合併。');
  const set=Object.fromEntries([...retired,...snow].map(id=>[id,true]));
  if(env.ttmi&&typeof env.ttmi.purge==='function')env.ttmi.purge(set);
  if(env.dropcut&&env.dropcut.DEL)Object.assign(env.dropcut.DEL,set);
  for(const table of env.drops||[])strip(table,set);
  strip(env.shops,set);
  if(env.recipes)for(const list of Object.values(env.recipes))if(Array.isArray(list))for(let i=list.length-1;i>=0;i--){const r=list[i];if(r&&(set[r.result]||(r.req||[]).some(q=>q&&set[q.id])))list.splice(i,1);}
  for(const cat of env.catalogs||[]){strip(cat.groups,set);if(cat.index)for(const id of Object.keys(set))delete cat.index[id];}
  if(env.obtainable)for(const id of Object.keys(set))delete env.obtainable[id];
  for(const id of retired){
   const d=items[id];if(!d)continue;
   Object.assign(d,{afkDeleted:true,ttmiEvent:true,ttmiRetired:true,ttmiCurated:false,gachaWeight:0});
   if(!d.mergedDollRetired){d.d=String(d.d||'')+'\n此娃娃已下架，不再取得；舊存檔持有品保留。';d.mergedDollRetired=true;}
   Object.defineProperty(items,id,{value:d,writable:true,configurable:true,enumerable:false});
  }
  for(const id of snow){
   // Old IDs stay readable by native loading and shared storage; UID/count/enchant are untouched.
   const d=Object.assign({},base,{n:'魔法娃娃：雪人',dollImg:'魔法娃娃：雪人',ttmiMergedInto:canonical,afkDeleted:true,ttmiEvent:true,ttmiRetired:true,ttmiCurated:false,gachaWeight:0});
   Object.defineProperty(items,id,{value:d,writable:true,configurable:true,enumerable:false});
   if(env.ttmi&&env.ttmi.sourceIds)env.ttmi.sourceIds[Number(id.slice(5))]=canonical;
  }
  return {retired:retired.slice(),aliases:snow.slice(),canonical};
 }
 return Object.freeze({install,retired,snow,canonical});
});
