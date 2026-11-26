(function(W){
  'use strict';
  const A=W.AFK_TTMI_ITEMS,crystal='ttmi_7102';if(!A)return;
  const heirs=Object.fromEntries([410,412,414,416,418,420,422].map(n=>['ttmi_'+n,true]));
  const materials=['earth','water','wind','fire'].map(k=>'afk_contempt_'+k);
  const bosses=['ant_antharas_s7','cr_fafurion_d7','cr_lindvior_d7','cr_valakas_d7'];
  const rates={};
  for(const rows of Object.values(MOB_DROPS))for(const e of rows)if(heirs[e[0]])rates[e[0]]=Math.max(rates[e[0]]||0,e[1]);
  A.dragonOnly(heirs);
  // Four alternative recipes, one crystal type per craft. Preserve native output of one.
  for(let i=A.recipes.length-1;i>=0;i--)if(A.recipes[i].result===crystal)A.recipes.splice(i,1);
  for(const id of materials){if(!DB.items[id])throw Error('Missing dragon crystal: '+id);A.recipes.push({result:crystal,req:[{id,cnt:100}],yield:1,ttmiRecipeKind:'refine',ttmiServiceFee:0,dragonCrystalOnly:true});}
  // 配方已改為四龍水晶，委託材料不能繼續顯示舊的結晶體精煉用途。
  for(const {id} of A.junk()){const d=DB.items[id];if(d)d.d=String(d.d||'').replace(/可交給材料工坊：[^。\n]*提煉為 1 個魔法結晶體。/g,'古物學者委託材料，可交給奇岩的古物學者 塞勒斯。');}
  function restrictDrops(){
    for(const table of [MOB_DROPS,DARK_WEAPON_DROPS,DARK_CRYSTAL_DROPS,DRAGON_DROPS,WARRIOR_DROPS,MEM_DROPS])for(const rows of Object.values(table))for(let i=rows.length-1;i>=0;i--)if(heirs[rows[i][0]])rows.splice(i,1);
    for(const id of bosses){const m=DB.mobs[id];if(!m)throw Error('Missing dragon final boss: '+id);const rows=MOB_DROPS[m.n]||(MOB_DROPS[m.n]=[]);for(const item of Object.keys(heirs))rows.push([item,rates[item]||.15]);}
    if(typeof buildRecipeIndex==='function')buildRecipeIndex();
  }
  for(const id of Object.keys(heirs)){const d=DB.items[id];if(d){d.ttmiDragonOnly=true;d.d=String(d.d||'')+'【取得】僅四龍副本最終頭目掉落；工匠薩克不再製作。';}}
  DB.items[crystal].d=String(DB.items[crystal].d||'')+'【薩克製作】任一種滅魔蔑視水晶（地／水／風／火）100 個合成 1 個；原有獎勵來源保留。';
  const oldFilter=W.__afkDropListFilter;W.__afkDropListFilter=function(m,list){const rows=oldFilter?oldFilter.apply(this,arguments)||list:list;const maps=['antharas_nest_1','antharas_nest_2','antharas_nest_3','antharas_lair'].concat(Object.values(W.__afkCorrupt.areasOf).flat());return maps.includes(mapState.current)?rows:rows.filter(e=>!heirs[e[0]]);};
  restrictDrops();W.addEventListener('load',restrictDrops);
  W.LineageDragonWorkshop={crystal,materials,heirs:Object.keys(heirs),bosses,restrictDrops};
})(window);
