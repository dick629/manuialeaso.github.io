(function(W){
 'use strict';
 const B=W.LineageClassCombat,C=W.LineageClassCore;
 const num=x=>Number(x)||0;
 // The borrowed spell gate only extends ordinary book learning. It neither
 // grants a spell nor changes any book, quest, level or item requirement.
 const req=W.skillReqLv;
 W.skillReqLv=function(sk,id){if(B.tIs(player,'knight','mage')&&C.valid(player)&&player.classPath.borrowMagic&&sk.reqM!=null&&sk.tier>=1&&sk.tier<=6)return sk.reqM;return req.apply(this,arguments);};
 function heavy(id){const d=DB.items[id];return !!(d&&d.type==='wpn'&&isTwoHandedWpn(d)&&!d.isBow&&!d.ranged&&!d.isArrow);}
 function doubleHeavy(){return B.tIs(player,'knight','warrior')&&C.valid(player);}
 const weapon=W.warriorDualWieldWpnOk,two=W.effTwoHanded,dual=W.dualWieldOffhandOk,off=W.dualWieldOffhandAttack;
 W.warriorDualWieldWpnOk=function(id){return doubleHeavy()?heavy(id):weapon.apply(this,arguments);};
 W.effTwoHanded=function(d,id){if(doubleHeavy()&&heavy(id))return false;return two.apply(this,arguments);};
 W.dualWieldOffhandOk=function(){return doubleHeavy()?heavy(player.eq?.wpn?.id):dual.apply(this,arguments);};
 W.dualWieldOffhandAttack=function(target){
  if(!doubleHeavy())return off.apply(this,arguments);
  if(!target||!W.dualWieldOffhandOk()||!heavy(player.eq?.offwpn?.id)||player.eq.shield||B.absoluteLock(player))return;
  // A 65% secondary weapon packet; the primary attribute is already paid by
  // the main hand. No copied primary damage, equipment procs or J recursion.
  const inst=player.eq.offwpn,d=DB.items[inst.id],dice=num(target.s==='L'?d.dmgL:d.dmgS)||2;
  const n=((dice+1)/2+num(d.meleeDmg)+num(inst.en))*.65*wpnEnFinalMult(inst);
  B.damage(player,target,n,{id:'class-offhand',name:'雙手副武器',plan:{channel:'melee'}});
 };
 const tags=W.getWeaponTags;
 W.getWeaponTags=function(id){const original=tags.apply(this,arguments);if(!player)return original;const a=B.state(player),passive=B.passive(player).some(o=>o.key==='weaponStyle');
  const d=DB.items[id],active=a.stance?.family==='weaponStyle'&&a.stance.until>state.ticks/10;
  if(!(active||passive)||!d||d.type!=='wpn'||d.isBow||d.ranged||id!==player.eq?.wpn?.id)return original;
  if(original.includes('雙刀')||original.includes('鋼爪'))return original;
  return original.concat(a.weaponStyle==='claw'?'鋼爪':'雙刀');
 };
 // Class spirits expire independently. Normal contract expiration and the
 // normal resummon switch never create another unpaid temporary spirit.
 const pick=W._petPickTarget;if(pick)W._petPickTarget=function(pet){const target=pet?._classTarget&&(mapState.mobs||[]).find(m=>m&&m.uid===pet._classTarget&&!m._dead&&m.curHp>0);return target||pick.apply(this,arguments);};
 const attack=W.playerAttack;if(attack)W.playerAttack=function(){if(B.state(player).casting)return;return attack.apply(this,arguments);};
 const cards=W.AFK_CARD_COMBAT,settle=cards.damage,born=new WeakMap();
 function blockRate(target){
  if(!target?._dimRift||!W.__afkDimRiftOn?.())return 0;
  const tick=num(state.ticks);if(!born.has(target))born.set(target,tick);
  const elapsed=Math.max(0,tick-born.get(target))/600;
  // GD之子的期待（能進次元裂縫的角色）：次元格擋率固定 80%，不隨時間下降；破除、裝備的壓制照算，最低 60%（Ping 11-12 17:30）
  if(W.__afkGdRiftOn?.()){const g=AFK_RELIC_RUNTIME.sources(player).reduce((n,s)=>Math.max(n,num(s.def.dimensionBlockSuppression)),0),sp=B.blockSuppression?B.blockSuppression(target):0;return Math.max(.6,.8-Math.max(g,sp+(W.LineageSherine?.suppression(target)||0))/100);}
  const gear=AFK_RELIC_RUNTIME.sources(player).reduce((n,s)=>Math.max(n,num(s.def.dimensionBlockSuppression)),0);
  const suppression=B.blockSuppression?B.blockSuppression(target):0;
  return Math.max(target.boss?.7:.5,(target.boss?1:.7)-Math.floor(elapsed)*.05-Math.max(gear,suppression+(W.LineageSherine?.suppression(target)||0))/100);
 }
 cards.damage=function(actor,target,amount,opt){const value=settle.apply(this,arguments);
  if(!actor?.cls||actor===target||!target||!(value>0)||opt?.kind==='true'||opt?.kind==='dot'||opt?.reflection||opt?.redirected)return value;
  const rate=blockRate(target);if(rate>0&&Math.random()<rate)return Math.floor(value*.7);return value;
 };
 W.LineageClassNative={blockRate,doubleHeavy,heavy};
})(window);
