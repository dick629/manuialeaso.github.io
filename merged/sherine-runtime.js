(function(W){'use strict';
 const C=W.LineageSherineCore,R=W.AFK_RELIC_RUNTIME,B=W.LineageClassCombat,SD=W.__afkSherineDream,states=new WeakMap(),seen=new WeakMap(),CRYSTAL='afk_dim_crystal';
 const N=x=>Number(x)||0,now=()=>N(state.ticks)/10,live=p=>p&&!p.dead&&!p._downed&&R.api.hp(p)>0;
 const mem=p=>{if(!states.has(p))states.set(p,{cd:{},next:{},casts:new Set(),hits:0,arrows:0,owned:new WeakMap(),dots:[]});return states.get(p);};
 // 效能（11-11）：同一個 tick 內同一個角色只算一次（補跑時每次命中都會問，原本每次重掃裝備）
 const viewMemo=new WeakMap();
 function view(p){const live2=!!(typeof state!=='undefined'&&state&&(state.inTick||state.ff)),k=live2?N(state.ticks):-1,m=p&&typeof p==='object'?viewMemo.get(p):null;if(live2&&m&&m.k===k&&m.eq===p.eq)return m.v;const c=C.counts(p,DB.items,SD.setCut(p)),v={c,tiers:C.tiers(c),mix:C.active(p,c)};if(p&&typeof p==='object')viewMemo.set(p,{k,eq:p.eq,v});return v;}
 const has=(v,g,n)=>v.tiers[g]?.includes(n),oldActive=(p,g)=>{const a=mem(p),m=view(p).mix;return m?.old===g&&a.mixUntil>now();};
 const ready=(p,key,sec)=>{const a=mem(p);if(N(a.cd[key])>now())return false;a.cd[key]=now()+sec;return true;};
 const next=(p,key,mult,sec=6)=>mem(p).next[key]={mult,until:now()+sec};
 function hitBonus(p){const a=mem(p);return (a.next.mixArrow?.until>now()?25:0)+(oldActive(p,'白鳥')?25:0);}
 function suppression(t){return t?N(R.state(t,'_sherineBlock').until)>now()?N(R.state(t,'_sherineBlock').value):0:0;}
 function suppress(t,n,sec){if(!t)return;const s=R.state(t,'_sherineBlock');s.value=Math.max(N(s.until)>now()?N(s.value):0,n);s.until=now()+sec;}
 function shield(p,t,amount,seconds=6){if(live(t))R.api.shield(t,amount,{owner:p,source:'sherine:'+LineageIntegrityCore.identity(p),cap:p.mhp*.6,duration:seconds});}
 const partial=(p,t,n,dot=false)=>B.damage(p,t,n,{id:'sherine-extra',name:'席琳界約',plan:{channel:'melee'}},{kind:dot?'magic':'melee',element:dot?'fire':undefined,dot});
 function mixTrigger(p,kind,t){const m=view(p).mix;if(!m||m.new!==kind||!ready(p,'mix',20))return;const a=mem(p);a.mixUntil=now()+6;R.recalc(p);
  if(kind==='潮誓'){const ally=B.team().filter(x=>x!==p&&live(x)).sort((x,y)=>R.api.hp(x)/x.mhp-R.api.hp(y)/y.mhp)[0];if(ally)shield(p,ally,Math.min(ally.mhp*.12,p.mhp*.2));}
  if(kind==='葬星')next(p,'mixExtra',1.2);
  if(kind==='裂鎧')suppress(t,10,8);
  if(kind==='冥契')shield(p,p,p.mhp*.15);
  if(kind==='破曉')next(p,'mixArrow',.2,4);
  if(kind==='鏡潮')next(p,'mixExtra',1.2);
  if(kind==='星祭'){W.LineageSherine.restoreErosion(p);}
  if(kind==='封夢')for(const ally of B.team())shorten(ally,.2);
  if(kind==='噬影')a.marked={target:t,until:now()+6,mult:.25};
  if(kind==='界織'){const team=B.team().filter(live),total=team.reduce((n,x)=>n+x.mhp*.08,0),scale=Math.min(1,p.mhp*.6/Math.max(1,total));team.forEach(x=>shield(p,x,x.mhp*.08*scale));}
  if(kind==='祖誓')suppress(t,10,6);
  if(kind==='燼心'&&live(t)){a.dots=a.dots.filter(x=>x.t!==t);a.dots.push({t,left:4,next:now()+1,damage:B.baseline(p)*.3});}
 }
 const negatives=['stun','freeze','stone','sleep','paralysis','paralyze','blind','fear','magicseal','silence','slowAtk','slow','weaken','disease','confuse','poison','bind','curse','mrhalf'];
 function shorten(p,n){const z=p.statuses||p.st||{};for(const k of negatives)if(z[k]>0)z[k]=Math.ceil(z[k]*(1-n));}
 function signal(p,kind,t,extra={}){if(!live(p))return;const v=view(p),a=mem(p);
  if(kind==='healOther'){if(has(v,'潮誓',5)&&ready(p,'tide',10))next(p,'tide',.25);mixTrigger(p,'潮誓',t);}
  if(kind==='breach'){if(has(v,'裂鎧',5))suppress(t,10,8);mixTrigger(p,'裂鎧',t);}
  if(kind==='blood'){if(has(v,'冥契',5)&&ready(p,'blood',8))next(p,'blood',.3);if(extra.amount>=p.mhp*.05)mixTrigger(p,'冥契',t);}
  if(kind==='dodge'){if(has(v,'鏡潮',5)&&ready(p,'mirror',12))shield(p,p,p.mhp*.15);mixTrigger(p,'鏡潮',t);}
  if(kind==='cleanse'){if(has(v,'封夢',5)&&ready(p,'cleanse',12))next(p,'cleanse',.3);mixTrigger(p,'封夢',t);}
  if(kind==='debuff'&&t){a.owned.set(t,now()+Math.max(.1,N(extra.seconds)||3));mixTrigger(p,'噬影',t);}
  if(kind==='shieldBreak'){if(has(v,'界織',5)&&ready(p,'silence',30))a.silenceUntil=now()+3;mixTrigger(p,'界織',t);}
  if(kind==='resource'){if(has(v,'祖誓',5)&&ready(p,'resource',12))next(p,'resource',.3);mixTrigger(p,'祖誓',t);}
  if(kind==='cast'&&extra.id){a.casts.add(extra.id);if(a.casts.size>=3){a.casts.clear();if(has(v,'星祭',5)&&ready(p,'mp',12))p.mp=Math.min(p.mmp,p.mp+p.mmp*.06);mixTrigger(p,'星祭',t);}}
 }
 function event(name,c){if(!c?.actor)return;let s=seen.get(c);if(!s){s=new Set();seen.set(c,s);}if(s.has(name))return;s.add(name);const p=c.actor,v=view(p),a=mem(p),direct=c.direct!==false&&!c.generated&&!c.noProc&&!c.environment&&!c.isDot&&!c.reflection&&!c.redirected&&c.kind!=='true'&&!['proc','dot','reflection','redirect','sherine','class'].includes(c.origin);
  if(name==='battleEnd'){const cd=a.cd;states.delete(p);mem(p).cd=cd;return;}
  if(name==='onStats'){const d=c.stats,add=(k,n)=>d[k]=N(d[k])+n;
   const base={潮誓:{extraDmg:50,extraMp:30},葬星:{extraHit:50,mr:50},裂鎧:{ac:-30,dr:30},冥契:{meleeDmg:30,meleeHit:30},破曉:{rangedDmg:30,rangedHit:30},鏡潮:{extraDmg:20,extraHit:30},星祭:{mpR:50,extraMp:60},封夢:{magicDmg:30,magicHit:25},噬影:{extraDmg:70},界織:{magicDmg:30},燼心:{}};
   for(const[g,attrs]of Object.entries(base))if(has(v,g,2))for(const[k,n]of Object.entries(attrs))add(k,n);
   if(has(v,'葬星',3))for(const k of ['melee','ranged','magic']){add(k+'Crit',12);add(k+'CritDmg',30);}
   if(has(v,'破曉',3)){add('rangedCrit',15);add('rangedCritDmg',30);}if(has(v,'鏡潮',3)){add('er',20);add('mr',100);}if(has(v,'封夢',3)){for(const k of ['resFire','resWater','resWind','resEarth'])add(k,100);add('extraMp',50);}if(has(v,'噬影',3)){add('meleeCrit',10);add('er',5);}if(has(v,'界織',3))add('extraMp',50);
   if(oldActive(p,'麗人'))add('meleeCritDmg',30);if(oldActive(p,'月光'))add('er',5);if(typeof getIntExtraMp==='function'){const raw=Math.max(0,getIntExtraMp(d.int));d.intSp=Math.min(33,raw);d.itemSp=Math.max(0,N(d.extraMp)-raw);}return;
  }
  if(name==='beforeStatus'&&has(v,'界織',3)&&negatives.includes(c.statusKind))c.duration*=.75;
  if(name==='beforeHeal'){const owner=c.healer||c.owner,ov=owner&&view(owner);if(ov&&has(ov,'潮誓',3)&&!String(c.healingSourceId||c.healSource).startsWith('sherine'))c.amount*=1.2;if(has(v,'冥契',3))c.amount*=1.15;if(has(v,'燼心',5)&&R.api.hp(p)<p.mhp*.4)c.amount*=1.2;if(oldActive(p,'狂怒'))c.amount*=1.2;}
  if(name==='onHeal'&&c.actualHeal>0){const owner=c.healer||c.owner||p,recipient=c.recipient||c.target||p;if(owner!==recipient&&!String(c.healingSourceId||c.healSource).startsWith('sherine'))signal(owner,'healOther',recipient);}
  if(name==='beforeCast'&&direct)c.mpCost*=1-(has(v,'星祭',3)?.15:0)-(oldActive(p,'學徒')?.12:0);
  if(name==='onCast'&&direct&&c.skillId){signal(p,'cast',c.target,{id:c.skillId});a.silenceUntil=0;}
  if(name==='castPaid'&&c.hpCost>0)signal(p,'blood',c.target,{amount:c.hpCost});
  if(name==='onDodge'&&c.normalAttack!==false)signal(p,'dodge',c.attacker);
  if(name==='onStatusAttempt'&&c.applied&&c.attacker?.cls&&c.attacker!==p)signal(c.attacker,'debuff',p,{seconds:c.duration});
  if(name==='shieldBreak'&&direct&&!String(c.shieldSource).startsWith('sherine'))signal(p,'shieldBreak',c.attacker);
  if((name==='beforeHit'||name==='beforeSkill')&&direct&&!s.has('damage')){s.add('damage');let bonus=0;for(const[k,x]of Object.entries(a.next))if(x.until>now()&&!k.endsWith('Extra')&&(k!=='cleanse'||c.kind==='magic')&&(!['arrow','mixArrow'].includes(k)||c.kind==='ranged')&&(k!=='blood'&&k!=='resource'||!c.skillId)){bonus+=x.mult;delete a.next[k];}
   if(a.marked?.target===c.target&&a.marked.until>now()){bonus+=a.marked.mult;a.marked=null;}if(has(v,'噬影',5)&&(a.owned.get(c.target)||0)>now())bonus+=.25;if(has(v,'燼心',5)&&R.api.hp(p)<p.mhp*.4)bonus+=.2;
   if(oldActive(p,'紅獅')&&c.kind==='melee'||oldActive(p,'疾風')&&c.kind==='ranged'||oldActive(p,'魔女')&&c.kind==='magic'||oldActive(p,'幻覺')&&c.kind==='magic'&&p.cls==='illusion'||oldActive(p,'暗影')&&c.element==='dark')bonus+=.12;c.damage*=1+bonus;
  }
  if(name==='beforeDot'&&c.dotKind==='poison'&&oldActive(p,'暗影'))c.damage*=1.12;
  if(name==='beforeHurt'&&direct){if(has(v,'裂鎧',3))c.damage*=.75;if(has(v,'祖誓',3))c.damage*=.8;if(oldActive(p,'鐵衛'))c.damage*=.9;}
  if(name==='directHit'&&direct&&c.actualDamage>0&&c.main!==false){if(a.last===c.actionId&&c.actionId!=null)return;a.last=c.actionId;
   if(!c.skillId){for(const k of ['starExtra','mixExtra']){const x=a.next[k];if(x?.until>now()){delete a.next[k];partial(p,c.target,B.baseline(p)*x.mult);}}
    if(++a.hits%6===0){if(has(v,'葬星',5)&&ready(p,'star',12))next(p,'starExtra',1.5);mixTrigger(p,'葬星',c.target);}
    if(c.kind==='ranged'&&++a.arrows%3===0){if(has(v,'破曉',5)&&ready(p,'arrow',8))next(p,'arrow',.3,4);mixTrigger(p,'破曉',c.target);}}
   if(R.api.hp(p)<p.mhp*.4)mixTrigger(p,'燼心',c.target);
   let leech=(has(v,'祖誓',2)&&c.kind!=='magic'?.05:0)+(oldActive(p,'龍血')?.03:0);if(leech&&ready(p,'leech',1))R.api.heal(p,Math.min(c.actualDamage*leech,p.mhp*(has(v,'祖誓',2)?.03:.02)),{owner:p,source:'sherine-leech'});
  }
  if(name==='tick'){if(a.mixUntil&&a.mixUntil<=now()){a.mixUntil=0;R.recalc(p);}for(const d of a.dots)if(d.left>0&&d.next<=now()&&live(d.t)){d.left--;d.next=now()+1;partial(p,d.t,d.damage,true);}a.dots=a.dots.filter(d=>d.left>0&&live(d.t));}
 }
 const RC=W.AFK_RELIC_COMPANIONS,oldCapacity=RC?.equipmentCapacity;if(oldCapacity)RC.equipmentCapacity=function(p,cap){return oldCapacity.apply(this,arguments)+(has(view(p),'燼心',2)?500:0);};
 if(W.__afkMaxAdd?.add)W.__afkMaxAdd.add(p=>{const v=view(p);let bonus=0;if(has(v,'冥契',3))bonus+=.2;if(has(v,'燼心',3))bonus+=.5;p.mhp=Math.floor(p.mhp*(1+bonus)+(has(v,'燼心',2)?5000:0));});
 function erosionBack(p){if(!W.__afkDimRift?.on()||!view(p).mix||view(p).mix.new!=='星祭')return 0;const a=mem(p),e=N(W.__afkDimRift.rec(player).ero);if(!e)a.erosion=0;return Math.min(e,300,N(a.erosion));}
 function restoreErosion(p){if(!W.__afkDimRift?.on())return false;const a=mem(p),e=Math.min(300,N(W.__afkDimRift.rec(player).ero)),lost=Math.max(0,e-erosionBack(p));a.erosion=Math.min(e,N(a.erosion)+Math.min(40,lost*.15));R.recalc(p);return lost>0;}
 W.LineageSherine={view,event,signal,mem,suppression,hitBonus,erosionBack,restoreErosion,
  shieldMultiplier:p=>{const v=view(p);return 1+(has(v,'潮誓',3)?.2:0)+(has(v,'界織',2)?.1:0);},
  costMultiplier:p=>1-(has(view(p),'星祭',3)?.15:0)-(oldActive(p,'學徒')?.12:0),
  consumeSilence:p=>{mem(p).silenceUntil=0;},ignoreSilence:p=>has(view(p),'界織',5)&&mem(p).silenceUntil>now()};
})(window);
