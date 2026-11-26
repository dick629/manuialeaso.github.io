'use strict';
window.GiranMagicMerchant=(()=>{
  const id='npc_giran_magic_merchant',price=10000,duration=1800;
  const towns=[...Object.keys(GiranTravelData),'town_elf','town_gludio','town_pirate_village','town_silent','town_ivory_tower','town_pride'];
  const types={melee:['giran_fire_ward','近戰','火焰武器','近戰傷害 +4'],ranged:['giran_wind_ward','遠戰','風之神射','遠距命中 +6']};
  NPC_SPR['792']={g:'792',f:6,shadow:false};
  for(const town of towns)__afkLore.addNpc(town,{id,n:'倫德羅',title:'魔法商人',type:'guide'},'792',[52,35]);
  for(const [key,_,name] of Object.values(types))BUFF_NAMES[key]='倫德羅的'+name;
  const common={giran_earth_guard:'大地防護',giran_life_spring:'生命之泉',giran_water_guard:'水之防護',giran_iron_morale:'鋼鐵士氣'};
  Object.assign(BUFF_NAMES,common);
  const weaponKeys=Object.values(types).map(t=>t[0]);
  const effects={...common,giran_fire_ward:'火焰武器',giran_wind_ward:'風之神射'};
  const allKeys=[...Object.keys(effects),'haste','sk_soul_up'];
  function own(p,key){
    const b=p?.buffs;if(!b)return 0;
    if(key==='haste'||key==='sk_soul_up')return Math.min(b[key]||0,Math.max(b.giran_fire_ward||0,b.giran_wind_ward||0));
    if(Object.hasOwn(b,key))return Math.max(0,b[key]||0);
    // Saves from the first release stored the common spells as one weapon timer.
    return Object.hasOwn(common,key)&&!Object.hasOwn(b,'giran_iron_morale')?Math.max(b.giran_fire_ward||0,b.giran_wind_ward||0):0;
  }
  function seconds(p,key){
    const head=window.GiranPartyEffects?.leaderOf(p);
    return Math.max(own(p,key),head&&!p._downed&&!p.dead?own(head,key):0);
  }
  function current(p){
    const [fire,wind]=weaponKeys.map(key=>seconds(p,key)>0);
    return fire&&wind?'both':fire?'melee':wind?'ranged':null;
  }
  const active=(p,key)=>seconds(p,key)>0;
  function apply(p,d){
    const buffs=p?.buffs;if(!buffs)return;
    const already=(sk,stat)=>buffs[sk]>0?(DB.skills[sk]?.d?.[stat]||0):0;
    if(active(p,'giran_iron_morale'))d.ac-=8;
    if(active(p,'giran_earth_guard'))d.ac-=Math.max(0,6-already('sk_elf_earthguard','ac'));
    if(active(p,'giran_life_spring'))d.hpR+=15;
    if(active(p,'giran_fire_ward'))d.meleeDmg+=Math.max(0,4-already('sk_elf_firewpn','meleeDmg'));
    if(active(p,'giran_wind_ward'))d.rangedHit+=Math.max(0,6-already('sk_elf_windshot','rangedHit'));
  }
  function arrowEvade(p,attacker){
    return active(p,'giran_water_guard')&&!attacker?.magicMelee&&GiranCombat.usesBow(attacker)?5:0;
  }
  function buy(choice,town){
    if(!Object.hasOwn(types,choice))throw Error('請選擇要施放的魔法');
    if(!towns.includes(town)||mapState.current!==town||!currentSlot||player.dead||document.body.classList.contains('giran-guest'))throw Error('請自己的隊長到村莊找倫德羅');
    if(player.gold<price)throw Error('金幣不足，需要 10,000 金幣');
    const [key,,name]=types[choice];
    LineageGrowth.transaction('倫德羅的強化魔法',()=>{
      player.gold-=price;
      player.buffs.haste=Math.max(player.buffs.haste||0,duration);
      player.buffs.sk_soul_up=Math.max(player.buffs.sk_soul_up||0,duration);
      for(const buff of [...Object.keys(common),key])player.buffs[buff]=Math.max(player.buffs[buff]||0,duration);
    },disk=>disk.p.gold===player.gold&&[...Object.keys(common),key].every(k=>disk.p.buffs[k]===player.buffs[k]&&disk.p.buffs[k]>=duration));
    window.__afkTpAbsorb?.();
    window.GiranPartyEffects?.sync(player);
    const members=1+GiranPartyView.combatAllies().filter(a=>a&&!a._downed&&!a.dead).length;
    const msg='倫德羅為隊伍 '+members+' 人施放了'+name+'與六項共同強化。';
    logSys(msg);
    const merchant=document.querySelector('[data-world-npc="'+id+'"] img'),leader=document.querySelector('.g-town-unit img');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(const [el,delay] of [[merchant,0],[leader,240]])el?.animate([{filter:'brightness(1)'},{filter:'brightness(1.55) drop-shadow(0 0 6px #b9d9ff)'},{filter:'brightness(1)'}],{duration:650,delay});
    }
    return msg;
  }
  function show(town){
    const host=document.getElementById('interaction-content');host.replaceChildren();
    const box=document.createElement('div');box.className='g-travel';
    const title=document.createElement('p'),detail=document.createElement('p'),balance=document.createElement('span'),list=document.createElement('div'),result=document.createElement('output');
    title.textContent='由隊長付費，全隊獲得七項魔法，持續 30 分鐘。';
    detail.textContent='共同強化包含加速術、靈魂昇華、大地防護、生命之泉、水之防護與鋼鐵士氣。';
    result.setAttribute('aria-live','polite');box.append(title,detail,balance,result,list);host.append(box);
    function draw(){
      const active=Object.values(types).filter(([key])=>player.buffs[key]>0).map(([key,,name])=>name+'剩餘 '+Math.ceil(player.buffs[key]/60)+' 分鐘');
      balance.textContent=['持有 '+player.gold.toLocaleString()+' 金幣',...active].join(' · ');
      list.replaceChildren();
      for(const [choice,[,label,name,desc]] of Object.entries(types)){
        const b=document.createElement('button'),heading=document.createElement('b'),fee=document.createElement('span');
        b.type='button';b.disabled=player.gold<price||document.body.classList.contains('giran-guest');
        heading.textContent=label+' · '+name;fee.textContent=desc+' · 10,000 金幣';b.append(heading,fee);
        b.onclick=()=>{try{result.textContent=buy(choice,town);}catch(e){result.textContent=e.message;}draw();};list.append(b);
      }
    }
    draw();
  }
  const prior=window.interactNPC;
  window.interactNPC=function(npc,town){const r=prior.apply(this,arguments);if(npc===id&&town===mapState.current&&towns.includes(town))show(town);return r;};
  return {towns,apply,arrowEvade,buy,current,seconds,allKeys,effects};
})();
