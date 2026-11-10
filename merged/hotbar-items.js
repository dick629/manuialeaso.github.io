/* Consumable hotkeys: use the native item path, cooldowns and restrictions. */
(function () {
  'use strict';
  const W=window;
  function describe(id) {
    const d=DB.items[id];if(!d||d.noUse||d.gmOnly)return null;
    const info={kind:'buff',keys:[],label:'效果結束後補用',manual:false};
    if(/potion_heal/.test(id)||['potion_strong','potion_ult'].includes(id)||d.ttmiHealPotion)return {...info,kind:'hp',label:'HP 低於設定比例'};
    if(d.ttmiAction==='mp')return {...info,kind:'mp',label:'MP 低於設定比例'};
    if(d.eff==='teleport_scroll'||d.ttmiAction==='returnTown')return {...info,kind:'escape',label:'HP 過低時脫離戰鬥',manual:d.ttmiAction==='returnTown'};
    if(d.ttmiAction==='antidote')return {...info,kind:'cleanse',label:'中毒時使用'};
    if(d.ttmiAction==='scroll'){
      const sk=DB.skills[d.ttmiSkill];if(!sk||sk.type!=='buff'||sk.summon||sk.awaken)return null;
      info.manual=true;info.keys=[sk.haste?'haste':d.ttmiSkill];return info;
    }
    if(d.ttmiAction&&!['buff','blue','thirdHaste','poly'].includes(d.ttmiAction))return null;
    if(d.ttmiBuff)info.keys.push(d.ttmiBuffFamily==='food'?'ttmi_food:'+id:'ttmi_'+(d.ttmiBuffFamily||'combat'));
    (d.ttmiHaste||[]).forEach(h=>info.keys.push(h.moveOnly?'ttmi_walk2':h.stage===1?'haste':h.stage===2?(h.mult>=1.3?'brave':'elfcookie'):'ttmi_haste3'));
    if(d.ttmiAction==='blue')info.keys.push('ttmi_blue');
    if(d.ttmiAction==='thirdHaste')info.keys.push('ttmi_haste3');
    if(d.ttmiAction==='poly'||d.eff==='poly')info.keys.push('poly');
    if(d.eff==='magicbarrier')info.keys.push('sk_magic_shield');
    if(d.type==='pot'&&d.dur>0&&['haste','brave','blue','cautious','elfcookie'].includes(d.eff))info.keys.push(d.eff);
    return info.keys.length?info:null;
  }
  function conditions(info){
    if(!info)return {};
    const base={smart:info.kind==='hp'?'HP ≤ 70%':info.kind==='mp'?'MP ≤ 50%':info.kind==='escape'?'HP ≤ 30%':info.label};
    if(['hp','mp','escape'].includes(info.kind))for(const n of [20,30,50,70,90])base[(info.kind==='mp'?'mp':'hp')+n]=(info.kind==='mp'?'MP':'HP')+' ≤ '+n+'%';
    return base;
  }
  function active(p,key){
    if(key==='haste'&&p._equipHaste)return true;
    if(['brave','elfcookie'].includes(key))return (p.buffs.brave||0)>0||(p.buffs.elfcookie||0)>0;
    if(key==='blue'&&(p.buffs.ttmi_blue||0)>0)return true;
    return (p.buffs[key]||0)>0;
  }
  function ready(p,id,info,cond){
    const d=DB.items[id];
    if(typeof reqAllowsClass==='function'&&!reqAllowsClass(d,p.cls))return false;
    if((d.ttmiMinLevel&&p.lv<d.ttmiMinLevel)||(d.ttmiMaxLevel&&p.lv>d.ttmiMaxLevel))return false;
    if(d.ttmiRiftOnly&&!(W.AFK_TTMI_ITEMS?.inRift?.()))return false;
    if(['hp','mp'].includes(info.kind)){
      if((p.cds?.pot||0)>0||(p.ttmiPotionRemaining||0)>0)return false;
      if(info.kind==='hp'&&typeof pvpArenaPotionBlocked==='function'&&pvpArenaPotionBlocked())return false;
    }
    if(['hp','mp','escape'].includes(info.kind)){
      const mp=info.kind==='mp',v=mp?p.mp:p.hp,max=mp?p.mmp:p.mhp,threshold=/^(hp|mp)(20|30|50|70|90)$/.test(cond||'')?Number(cond.slice(2)):mp?50:info.kind==='escape'?30:70;
      if(!(max>0&&v<max&&v/max*100<=threshold))return false;
      if(info.kind==='escape'){
        if(!(mapState.mobs||[]).some(m=>m&&!m._dead&&m.curHp>0))return false;
        if(state.ticks<(state._manualTpUntil||0))return false;
      }
      return true;
    }
    if(info.kind==='cleanse')return ['poison','venom','deadlyPoison'].some(k=>(p.statuses?.[k]||0)>0);
    if(info.keys.includes('sk_magic_shield')&&(p.magicShieldCd||0)>0)return false;
    return info.keys.some(k=>!active(p,k));
  }
  let owner=null,next=0,lastTick=-1;
  function step(){
    const p=typeof player!=='undefined'?player:null,t=Number(typeof state!=='undefined'&&state.ticks)||0;
    if(owner!==p||t<lastTick){owner=p;next=0;}lastTick=t;
    if(!p||!p.cls||!state.running||p.dead||!(p.hp>0)||t<next||!W.AFK_HOTBAR)return;
    if(W.AFK_TOGGLES&&!W.AFK_TOGGLES.enabled('hotbar'))return;
    if(typeof inAbsBarrier==='function'&&inAbsBarrier())return;
    if(['stone','paralyze','freeze','stun','sleep'].some(k=>(p.statuses?.[k]||0)>0))return;
    const b=W.AFK_HOTBAR.bar(),au=p._afkHotbarAuto||[],cond=p._afkHotbarCond||[];
    for(let i=0;i<8;i++){
      if(!au[i])continue;
      const info=describe(b[i]);if(!info||!ready(p,b[i],info,cond[i]))continue;
      const it=(p.inv||[]).find(x=>x.id===b[i]&&!x.lock&&(x.cnt==null||x.cnt>0));if(!it)continue;
      // Never buy supplies here. Preserve all native class, map, PvP and item guards.
      const before=it.cnt==null?1:it.cnt;next=t+(info.kind==='escape'?50:10);
      useItem(it.uid,!info.manual,true);
      const left=p.inv.find(x=>x.uid===it.uid);
      if(!left||(left.cnt==null?1:left.cnt)<before)W.AFK_HOTBAR.render();
      return;
    }
  }
  const original=W.autoActions;
  if(typeof original==='function')W.autoActions=function(){const r=original.apply(this,arguments);step();return r;};
  W.AFK_HOTBAR_ITEMS={describe,conditions,ready,step};
})();
