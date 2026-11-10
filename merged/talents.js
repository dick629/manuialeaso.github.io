(function(W){
  'use strict';
  const G=W.LineageGrowth,C=W.LineageGrowthCore,R=W.AFK_RELIC_RUNTIME,states=new WeakMap(),events=new WeakMap(),damageEvents=new WeakSet(),allocations=new WeakMap();
  const N=n=>Number(n)||0,now=()=>N(state.ticks)/10;
  function st(p){let s=states.get(p);if(!s){s={buffs:{},cd:{},counts:{},hits:{}};states.set(p,s);}return s;}
  function allocation(p){const g=G.read(p);if(!g)return null;let a=allocations.get(g.talent);if(!a){a={nodes:new Set(g.talent.nodes),counts:{},effects:C.talentEffects(g.talent)};for(const id of g.talent.nodes){const key=id.slice(0,id.lastIndexOf('.'));a.counts[key]=(a.counts[key]||0)+1;}allocations.set(g.talent,a);}return a;}
  function count(p,d,k){const a=allocation(p);return a?a.counts[d+'.'+k]||0:0;}
  function effect(p,k){const a=allocation(p);return a?a.effects[k]||0:0;}
  function has(p,d,k,i){const a=allocation(p);return !!(a&&a.nodes.has(d+'.'+k+'.'+(i||1)));}
  function live(p){return p&&!p.dead&&!p._downed&&N(p===player?p.hp:p.curHp==null?p.hp:p.curHp)>0;}
  function hp(p){return N(p===player?p.hp:p.curHp==null?p.hp:p.curHp);}
  function maxhp(p){if(p===player||p&&p.cls)return N(p.mhp)||1;return W.AFK_RELIC_COMPANIONS?W.AFK_RELIC_COMPANIONS.maxHp(p):N(p.mhp||p.maxHp||p.hp)||1;}
  function team(){return [player].concat(player.allies||[]).filter(live);}
  function companions(p){return R.api.pets(p).concat(R.api.summons(p)).filter(live);}
  function lowest(xs){return xs.slice().sort((a,b)=>hp(a)/maxhp(a)-hp(b)/maxhp(b))[0];}
  function buff(p,key,values,sec){if(!p)return;st(p).buffs[key]={...values,until:now()+sec};if(values.move||values.hit||values.mr)R.recalc(p);}
  function buffs(p){return Object.values(st(p).buffs).filter(b=>b.until>now());}
  function sum(p,k){return buffs(p).reduce((n,b)=>n+N(b[k]),0);}
  function consume(p,k,kind){let v=0;for(const b of buffs(p)){if(b[k+'Kinds']&&!b[k+'Kinds'].includes(kind))continue;v=Math.max(v,N(b[k]));if(b[k])delete b[k];}return v;}
  function cooldown(p,key,sec){const s=st(p);if(N(s.cd[key])>now())return false;s.cd[key]=now()+sec;return true;}
  function shield(p,owner,ratio){if(!live(p))return;const n=maxhp(p)*ratio;R.api.shield(p,n,{source:'talent-'+(ratio===.1?'K':'J'),owner,cap:maxhp(p)*(ratio===.1?1:ratio),duration:6});}
  function healPet(p,n,owner){if(!live(p))return;const key=p===player?'hp':p.curHp==null?'hp':'curHp';p[key]=Math.min(maxhp(p),N(p[key])+Math.floor(n));}
  function shielded(p){return Object.values(R.state(p,'_shields')).some(s=>s.until>now()&&s.amount>0);}
  function support(p,target){
    const s=st(p);s.supportAt=now();s.supportTarget=target||p;
    if(has(p,'support','K')&&cooldown(p,'Ksupport',12))team().forEach(t=>buff(t,'Ksupport',{healingIn:.1},6));
    jEffect(p,'support',{target:target||p});
  }
  function passive(p){
    const g=G.read(p);if(!g)return;const d=p.d;
    p.mhp=Math.floor(p.mhp*(1+effect(p,'hp')/100));p.mmp=Math.floor(p.mmp*(1+effect(p,'mp')/100));
    d.meleeHit=N(d.meleeHit)+effect(p,'meleeHit')+(has(p,'melee','N3',3)?2:0)+sum(p,'hit');
    d.rangedHit=N(d.rangedHit)+effect(p,'rangedHit')+(has(p,'ranged','N3',3)?2:0)+sum(p,'hit');
    d.magicHit=N(d.magicHit)+(has(p,'magic','N3',1)?2:0)+sum(p,'hit');
    d.meleeCrit=N(d.meleeCrit)+effect(p,'meleeCrit');d.rangedCrit=N(d.rangedCrit)+effect(p,'rangedCrit');
    ['melee','ranged','magic'].forEach(k=>{d[k+'CritDmg']=N(d[k+'CritDmg'])+effect(p,k+'CritDmg')+(has(p,k,'N3',k==='magic'?3:2)?5:0);});
    d.mpR=N(d.mpR)*(1+effect(p,'mpRegen')/100);d.ac=N(d.ac)-(has(p,'defense','N3',1)?1:0);d.mr=N(d.mr)+effect(p,'mr')+sum(p,'mr');
    for(const k of ['resFire','resWater','resEarth','resWind'])d[k]=N(d[k])+effect(p,'resist');
    d.moveSpeedPct=N(d.moveSpeedPct)+sum(p,'move');
    for(const [id,b] of Object.entries(g.supportBuffs||{}))if(p.buffs&&p.buffs[id]>0){for(const [k,n] of Object.entries(b.delta||{})){if(k==='mhp'||k==='mmp')p[k]+=n*b.ratio;else d[k]=N(d[k])+n*b.ratio;}}

  }
  function direct(c){return !(typeof _royalFreeCast!=='undefined'&&_royalFreeCast)&&c.direct!==false&&!c.generated&&!c.isDot&&!c.reflection&&['normal','auto','gm'].includes(c.origin||'normal');}
  function beforeDamage(c){
    const p=c.actor,k=c.kind==='ranged'?'ranged':c.kind==='magic'?'magic':'melee';if(!direct(c))return;
    let mult=1+effect(p,k+'Direct')/100+G.pct(p,k==='magic'?'magic':'physical')/100;
    const skill=!!c.skillId||c.paid;if(skill)mult+=effect(p,k+'Skill')/100;
    if(skill&&k==='melee')mult+=sum(p,'meleeSkill');
    if(k==='ranged'&&c.main&&has(p,'ranged','K')){const s=st(p);if(s.rangedTarget!==c.target){s.rangedTarget=c.target;s.rangedCount=0;}if((N(s.rangedCount)+1)%3===0)mult+=.25;}
    for(const b of buffs(p)){if(b.requiresShield&&!shielded(p))continue;if(b.target&&b.target!==c.target)continue;if(b.outAll)mult+=b.outAll;if(b.outKind&&b.outKind.includes(k))mult+=b.out||0;}
    mult+=consume(p,'nextDamage',k);if(k==='melee')mult+=consume(p,'nextMelee');
    if(has(p,'magic','K')&&k==='magic'&&c.paid&&st(p).spellBoost)mult+=.12;
    c.damage*=mult;
  }
  function onDirect(c){
    const p=c.actor,s=st(p),k=c.kind||'melee';if(!direct(c)||!(c.actualDamage>0)||!live(p))return;
    if(s.lastDirect===c.actionId)return;s.lastDirect=c.actionId;
    s.hits[k]={at:now(),target:c.target};
    if(k==='ranged'&&c.main){if(s.rangedTarget!==c.target){s.rangedTarget=c.target;s.rangedCount=0;}s.rangedCount=N(s.rangedCount)+1;}
    if(k==='melee'&&has(p,'melee','K')){s.counts.melee=N(s.counts.melee)+1;if(s.counts.melee>=3&&cooldown(p,'Kmelee',12)){s.counts.melee=0;buff(p,'Kmelee',{meleeSkill:.12},8);}}
    if(has(p,'minions','K')&&cooldown(p,'Kminions',12)){s.hunt={target:c.target,until:now()+8};}
    jEffect(p,'hit',c);
  }
  function pair(s,a,b,same){const x=s.hits[a],y=s.hits[b];return x&&y&&Math.abs(x.at-y.at)<=8&&now()-Math.max(x.at,y.at)<.15&&(!same||x.target===y.target);}
  function jEffect(p,event,c){
    const g=G.read(p);if(!g||!g.talent.j)return;const dirs=g.talent.order,s=st(p),key=dirs.slice().sort().join('+');
    const attacks=['melee','ranged','magic'].filter(k=>dirs.includes(k)),pet=dirs.includes('minions'),sup=dirs.includes('support'),def=dirs.includes('defense'),move=dirs.includes('movement');
    const target=c.target,who=lowest(companions(p));let ready=false;
    if(attacks.length===3)ready=event==='hit'&&attacks.every(k=>s.hits[k]&&now()-s.hits[k].at<=10);
    else if(attacks.length===2)ready=event==='hit'&&pair(s,attacks[0],attacks[1],pet);
    else if(attacks.length===1){const a=attacks[0],hit=s.hits[a],recent=hit&&now()-hit.at<=8;
      if(def&&move)ready=event==='hit'&&c.kind===a;
      else if(def&&pet)ready=event==='hit'&&c.kind===a&&(a!=='ranged'||who&&st(p).petTarget===target);
      else if(def&&sup)ready=event==='hit'&&c.kind===a&&(a!=='melee'||shielded(p));
      else if(sup&&pet)ready=a==='magic'?event==='support'&&recent:event==='hit'&&c.kind===a&&now()-N(s.supportAt)<=8&&s.supportAt!=null;
      else if(sup&&move)ready=event==='support'&&(a==='magic'||recent);
      else if(pet&&move)ready=(event==='pet'||event==='hit')&&recent&&s.petTarget===hit.target&&now()-N(s.petAt)<=8&&(a!=='magic'||event==='hit');
    }else ready=event===(sup?'support':'pet');
    if(!ready||!cooldown(p,'J',attacks.length===3?20:15))return;
    if(attacks.length===3){buff(p,'J',{nextDamage:.3},20);s.hits={};return;}
    if(attacks.length===2){
      const a=attacks.join('+');
      if(def){shield(p,p,.05);if(a==='melee+ranged')buff(p,'J',{outKind:attacks,out:.1,target,requiresShield:true},6);if(a==='melee+magic')buff(p,'J',{mpKinds:attacks,mpCut:.1,requiresShield:true},6);if(a==='ranged+magic')buff(p,'J',{nextTaken:.1,from:target},6);}
      if(sup){buff(p,'J',{nextSupport:a==='melee+ranged'?.2:.15,supportHealOnly:a==='melee+ranged',afterSupport:a},15);}
      if(pet){if(a==='melee+magic')companions(p).forEach(t=>{buff(t,'J',{outAll:.15,target},6);healPet(t,maxhp(t)*.03,p);});else if(who){assist(p,who,target,.5);if(a==='ranged+magic')buff(who,'J',{hit:8},6);}}
      if(move){buff(p,'J',{move:20,...(a==='melee+ranged'?{nextHit:8,nextHitKinds:attacks}:a==='melee+magic'?{nextMp:.2,nextMpKinds:attacks}:{nextDamage:.15,nextDamageKinds:attacks})},6);}
      delete s.hits[attacks[0]];delete s.hits[attacks[1]];return;
    }
    const a=attacks[0];
    if(a&&def&&move){shield(p,p,.05);buff(p,'J',{move:20},6);}
    else if(a&&def&&pet){if(a!=='ranged')shield(p,p,.05);if(who){shield(who,p,.05);if(a==='melee')buff(who,'J',{nextDamage:.15},6);if(a==='magic')buff(who,'J',{mr:10},6);}if(a==='ranged')buff(p,'J',{outKind:['ranged'],out:.1,target},6);}
    else if(a&&def&&sup){if(a==='melee'){const t=lowest(team());shield(t,p,.05);buff(t,'J',{healingIn:.1},6);}else buff(p,'J',{healShield:true,supportHealOnly:true,nextSupport:a==='magic'?.15:0,mr:a==='ranged'?10:0},6);}
    else if(a&&sup&&pet){companions(p).forEach(t=>{buff(t,'J',{outAll:.12,nextHealing:a==='magic'?.2:0},6);if(a!=='magic')healPet(t,maxhp(t)*.03,p);});}
    else if(a&&sup&&move){buff(p,'J',{move:20,...(a==='magic'?{nextMp:.2,nextMpKinds:['magic'],attackMpOnly:true}:{})},6);if(a==='melee')buff(target,'J',{healingIn:.1},6);if(a==='ranged')buff(target,'J',{nextHit:8},6);}
    else if(a&&pet&&move){buff(p,'J',{move:20},6);if(a==='magic'&&who)assist(p,who,target,.4);else if(who)buff(who,'J',a==='melee'?{nextDamage:.25}:{outAll:.12,target},6);}
    else if(!a){if(move)buff(p,'J',{move:20},6);if(def){if(sup&&pet)shield(p,p,.05);shield(pet?who:lowest(team()),p,.05);}if(pet&&sup)companions(p).forEach(t=>buff(t,'J',{healingIn:.1,...(!def?{outAll:.1}:{})},6));}
  }
  function assist(owner,pet,target,scale){
    if(!pet||!target||target._dead||target.curHp<=0)return;
    const d=pet.form&&typeof petDerive==='function'?petDerive(pet):typeof _sumDeriveAny==='function'?_sumDeriveAny(pet,owner):pet.d||pet;
    let base=d&&d.dice?N(d.flat)+(N(d.dice)+1)/2:Array.isArray(pet.dmg)?pet.dmg[0]*(pet.dmg[1]+1)/2+N(pet.db):N(d&&d.meleeDmg)+N(pet.atk||pet.damage)||1;
    G.secondaryHit(owner,target,Math.floor(base*scale),'melee');
  }
  function beforeHeal(c){const healer=c.healer||c.caster||c.owner||player,t=c.recipient||c.actor;let mult=1+sum(t,'healingIn');if(has(t,'defense','N3',3))mult+=.04;
    const owner=W.AFK_RELIC_COMPANIONS&&W.AFK_RELIC_COMPANIONS.ownerOf(t);if(owner&&companions(owner).includes(t)&&has(owner,'minions','N3',2))mult+=.04;
    mult+=consume(t,'nextHealing');
    if(c.healSource==='spell'){mult+=effect(healer,'healing')/100+(has(healer,'support','N3',3)?.04:0)+G.pct(healer,'healing')/100;const extra=consume(healer,'nextSupport');mult+=extra;}
    c.amount*=mult;
  }
  function supportFollowup(p,t,isHeal){
    for(const b of buffs(p)){if(isHeal&&b.healShield){shield(t,p,.05);delete b.healShield;}if(b.afterSupport&&(!b.supportHealOnly||isHeal)){if(b.afterSupport==='melee+ranged')buff(t,'J-after',{outKind:['melee','ranged'],out:.06},6);else if(b.afterSupport==='melee+magic')buff(p,'J-after',{nextMelee:.15},6);else buff(t,'J-after',{nextDamage:.08},6);delete b.afterSupport;}}
  }
  function onHeal(c){if(!(c.actualHeal>0)||c.healSource!=='spell')return;const p=c.healer||c.caster||c.owner||player,t=c.recipient||c.actor;
    supportFollowup(p,t,true);
    support(p,t);
  }
  function event(name,c){
    if(!c||!c.actor||!G.read(c.actor)&&!['beforeHeal','onHeal','beforeHurt'].includes(name))return;
    let done=events.get(c);if(!done){done=new Set();events.set(c,done);}if(done.has(name))return;done.add(name);
    const p=c.actor;
    if((name==='beforeHit'||name==='beforeSkill')&&!damageEvents.has(c)){damageEvents.add(c);beforeDamage(c);}
    if(name==='directHit'){if(direct(c)&&c.actualDamage>0)st(p).hitThisAttack=true;onDirect(c);}
    if(name==='onCompanionStats'){
      c.maxHpMult*=1+effect(p,'petHp')/100;const d=c.stats||{};d.hit=N(d.hit)+effect(p,'petHit')+sum(c.companion,'hit');d.meleeHit=N(d.meleeHit)+effect(p,'petHit')+sum(c.companion,'hit');d.mr=N(d.mr)+sum(c.companion,'mr');
      if(has(p,'minions','N3',1))for(const k of ['resFire','resWater','resEarth','resWind'])d[k]=N(d[k])+5;
    }
    if(name==='onCast'&&c.success&&direct(c)){if(c.skill&&c.skill.type==='buff'&&!c.skill.summon)enhanceBuff(p,c.skillId);castFinished(p,c.skill,true,c.paidMp||0);}
    if(name==='beforeCast'){
      const sk=c.skill||{},k=sk.dmgType==='ranged'?'ranged':sk.dmgType==='phys'||sk.dmgType==='melee'?'melee':'magic';let cut=0;
      if(sk.type==='heal')cut=effect(p,'healCost')/100;
      else if(sk.type==='buff')cut=has(p,'support','N3',2)?.03:0;
      else cut=has(p,k,'N3',k==='magic'?2:1)?.03:0;
      for(const b of buffs(p)){if(b.requiresShield&&!shielded(p))continue;if(b.mpKinds&&b.mpKinds.includes(k))cut+=b.mpCut;}
      for(const b of buffs(p))if(b.nextMp&&(!b.nextMpKinds||b.nextMpKinds.includes(k))&&(!b.attackMpOnly||sk.type==='atk'))cut+=b.nextMp;
      c.mpCost*=Math.max(0,1-cut);
    }
    if(name==='beforeHurt'){
      if(c.main&&c.kind!=='magic'&&c.kind!=='dot')c.damage*=1-effect(p,'normalReduction')/100;
      const owner=W.AFK_RELIC_COMPANIONS&&W.AFK_RELIC_COMPANIONS.ownerOf(p);if(owner&&companions(owner).includes(p)){if(c.single===false||c.singleTarget===false)c.damage*=1-effect(owner,'petAreaReduction')/100;if(c.main&&c.kind!=='magic'&&has(owner,'minions','N3',3))c.damage*=.98;}
      for(const b of buffs(p))if(b.nextTaken&&b.from===c.attacker&&c.direct!==false&&c.kind!=='dot'){c.damage*=1-b.nextTaken;delete b.nextTaken;}
    }
    if(name==='afterHurt'&&live(p)&&has(p,'defense','K')&&hp(p)<maxhp(p)*.4&&cooldown(p,'Kdefense',30))shield(p,p,.1);
    if(name==='beforeHeal')beforeHeal(c);if(name==='onHeal')onHeal(c);
    if(name==='petHit'){
      if(c._module==='weapon'){let mult=1+effect(p,'petDamage')/100+G.pct(p,'companions')/100;const h=st(p).hunt;if(h&&h.until>now()&&h.target===c.target)mult+=.1;const pet=c.companion||c.pet;if(pet){for(const b of buffs(pet))if(!b.target||b.target===c.target)mult+=N(b.outAll);mult+=consume(pet,'nextDamage');}c.damage*=mult;}
      else if(c.actualDamage>0){st(p).petTarget=c.target;st(p).petAt=now();jEffect(p,'pet',c);}
    }
  }
  function killed(p,m){const g=G.read(p);if(!g)return;const s=st(p),mov=C.movement(g);if(mov.killSpeed)buff(p,'N2move',{move:mov.killSpeed},3);if(mov.core){s.counts.kills=N(s.counts.kills)+1;if(s.counts.kills>=3&&cooldown(p,'Kmovement',12)){s.counts.kills=0;buff(p,'Kmovement',{move:15},6);}}}
  function castFinished(p,sk,ok,paid){if(!ok||!sk)return;const k=sk.dmgType==='ranged'?'ranged':['phys','melee'].includes(sk.dmgType)?'melee':'magic';for(const b of buffs(p))if(b.nextMp&&(!b.nextMpKinds||b.nextMpKinds.includes(k))&&(!b.attackMpOnly||sk.type==='atk'))delete b.nextMp;if(sk.type==='buff'&&!sk.summon)support(p,p);if(paid>0&&sk.type==='atk'&&(!sk.dmgType||sk.dmgType==='magic')&&has(p,'magic','K')){const s=st(p);if(s.spellBoost)s.spellBoost=false;else{s.counts.spells=N(s.counts.spells)+1;if(s.counts.spells>=3){s.counts.spells=0;s.spellBoost=true;}}}}
  function beforeAttack(p){const s=st(p);if(s.hitThisAttack===false){s.rangedCount=0;s.rangedTarget=null;}s.hitThisAttack=false;}
  function tick(){for(const p of team().concat(companions(player))){let recalc=false;const s=st(p);for(const [k,b] of Object.entries(s.buffs))if(b.until<=now()){if(b.move||b.hit||b.mr)recalc=true;delete s.buffs[k];}if(recalc)R.recalc(p);}}
  function enhanceBuff(p,id){
    const g=G.read(p),dur=p.buffs&&p.buffs[id];if(!g||!dur)return;
    p.buffs[id]=dur*(1+effect(p,'buffDuration')/100);
    let extra=0;for(const b of buffs(p))if(!b.supportHealOnly&&b.nextSupport){extra=Math.max(extra,b.nextSupport);delete b.nextSupport;}const ratio=effect(p,'buffPower')/100+extra;if(!ratio){supportFollowup(p,p,false);return;}
    g.supportBuffs=g.supportBuffs||{};delete g.supportBuffs[id];
    const keys=['str','dex','con','int','wis','cha','ac','mr','meleeDmg','rangedDmg','magicDmg','meleeHit','rangedHit','magicHit','meleeCrit','rangedCrit','magicCrit','hpR','mpR','dr','er','resFire','resWater','resEarth','resWind','moveSpeedPct'];
    const health={hp:p.hp,mp:p.mp},left=p.buffs[id];p.buffs[id]=0;R.recalc(p);const base={...p.d,mhp:p.mhp,mmp:p.mmp};p.buffs[id]=left;R.recalc(p);const after={...p.d,mhp:p.mhp,mmp:p.mmp},delta={};
    for(const k of keys.concat(['mhp','mmp'])){const n=N(after[k])-N(base[k]);if(n&&(k==='ac'?n<0:n>0))delta[k]=n;}
    g.supportBuffs[id]={ratio,delta};R.recalc(p);p.hp=Math.min(health.hp,p.mhp);p.mp=Math.min(health.mp,p.mmp);supportFollowup(p,p,false);
  }
  W.LineageTalents={hitBonus:function(p,k,probe){const a=R.action();if(probe||a&&!['normal','auto','gm'].includes(a.origin))return 0;return consume(p,'nextHit',k);},event,passive,killed,castFinished,count,has,states:st,companions,support,shield,assist,buffs,beforeAttack,tick,reset:function(p){states.delete(p);for(const x of companions(p)){states.delete(x);}for(const x of team()){const b=R.state(x,'_shields');for(const k of Object.keys(b))if(k.startsWith('talent-'))delete b[k];}}};

})(window);
