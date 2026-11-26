'use strict';
window.GiranPartyEffects=(()=>{
  const owners=new WeakMap(),last=new WeakMap();
  const living=p=>p&&!p.dead&&!p._downed;
  function foods(who){
    const selected=new Map(),take=p=>{
      if(!p)return;
      for(const id of Object.keys(p.ttmiFoods||{})){
        const time=p.buffs?.['ttmi_food:'+id]||0;
        if(time>0&&DB.items[id]?.ttmiBuffFamily==='food')selected.set(id,Math.max(time,selected.get(id)||0));
      }
    };
    take(who);const leader=owners.get(who);
    if(leader&&living(who))take(leader);
    return selected;
  }
  function sync(leader){
    if(!leader?.cls||typeof _recomputingAlly!=='undefined'&&_recomputingAlly)return;
    const merchant=window.GiranMagicMerchant;
    const ids=[...foods(leader).keys(),...(merchant?.allKeys||[]).filter(k=>merchant.seconds(leader,k)>0)].sort().join('|');
    for(const a of leader.allies||[]){
      if(!a)continue;
      owners.set(a,leader);
      const status=living(a)?ids:'down';
      const old=last.get(a);if(old===status)continue;
      last.set(a,status);if(old===undefined&&!ids)continue;
      if(living(a))_allyLevelRecompute(a);
    }
  }
  const inheritedIllusions=new Set(['sk_illu_ogre','sk_illu_golem','sk_illu_lich','sk_illu_avatar']);
  function companions(){
    const out=[],seen=new Set();
    function take(unit,kind,owner){
      if(!unit||seen.has(unit.uid)||!living(unit)||unit.hp<=0||!living(owner))return;
      seen.add(unit.uid);
      out.push({unit,kind,owner,name:unit.n||unit.form});
    }
    for(const p of petsOutList())take(p,'寵物',player);
    for(const s of summonRenderList()){
      const owner=window.AFK_RELIC_COMPANIONS?.ownerOf(s)||player.allies?.find(a=>a.summon===s)||player;
      take(s,'召喚物',owner);
    }
    return out;
  }
  function companionBenefit(id,entry){
    const {unit,owner,kind}=entry,skill=DB.skills[id],d=skill.d||{};
    const spirit=unit.skId==='sk_elf_summon'||unit.skId==='sk_elf_summon2';
    if(d.ac)return {active:true,label:'AC −'+d.ac};
    if(d.meleeDmg)return {active:true,label:'近戰傷害 +'+d.meleeDmg};
    if(d.magicDmg){
      if(kind==='寵物'){
        const magic=PET_BOOK[unit.form]?.sk?.some(sk=>sk.d&&sk.kind==='magic');
        return {active:!!magic,label:magic?'法術傷害 +'+d.magicDmg:'沒有傷害法術'};
      }
      const base=(owner.d?.magicDmg||0)+(spirit?0:_sumOwnerMdBonus(owner));
      const capped=base-(owner.buffs?.[id]>0?d.magicDmg:0)>=12;
      return {active:!capped,label:capped?'主人魔傷已達倍率上限 12':'魔傷 +'+d.magicDmg+' 計入召喚倍率'};
    }
    const effects=[];
    if(d.extraHit)effects.push('命中 +'+d.extraHit);
    if(d.extraDmg&&(!spirit||id==='sk_royal_burnweapon'))effects.push('普攻傷害 +'+d.extraDmg);
    if(skill.dmgTakenReduce)effects.push('承傷 −'+skill.dmgTakenReduce+'%');
    return {active:effects.length>0,label:effects.join('、')};
  }
  function current(){
    const team=[player,...GiranPartyView.combatAllies().filter(Boolean)],rows=new Map();
    const add=(k,name,kind,who,seconds,by)=>{
      if(!rows.has(k))rows.set(k,{id:k,name,kind,members:new Map()});
      const members=rows.get(k).members;
      if((members.get(who)?.seconds||0)<seconds)members.set(who,{seconds,by});
    };
    const auras=typeof TEAM_AURA_SKILLS==='undefined'?[]:TEAM_AURA_SKILLS;
    for(const p of team.filter(living)){
      if(p!==player)owners.set(p,player);
      for(const id of ['haste','brave','elfcookie','cautious']){
        const equip=id==='haste'&&p._equipHaste;
        if(equip||mercPermanentPotionFor(p,id))add(id,BUFF_NAMES[id]||id,'藥水狀態',p,Infinity,equip?'裝備':'傭兵職業常駐');
      }
      for(const [id,s] of foods(p)){
        const owner=p===player||player.buffs?.['ttmi_food:'+id]>=s?player:p;
        add('ttmi_food:'+id,DB.items[id].n,'料理',p,s,owner.name||owner._allyName);
      }
      const merchant=window.GiranMagicMerchant;
      for(const id of merchant?.allKeys||[]){const sec=merchant.seconds(p,id);if(sec>0)add(id,BUFF_NAMES[id]||DB.skills[id]?.n||id,'倫德羅強化',p,sec,'倫德羅');}
      for(const row of window.__afkBuffIcons?.rows(p)||[]){
        if(!row.key.startsWith('ttmi_food:')&&row.sec>0)add(row.key,row.name,'個人補給',p,row.sec,p.name);
        if(row.desc&&rows.has(row.key))rows.get(row.key).description=row.desc;
      }
      for(const [id,s] of Object.entries(p.buffs||{})){
        if(!(Number(s)>0)||id.startsWith('ttmi_food:'))continue;
        const n=DB.skills[id]?.n||(typeof BUFF_NAMES!=='undefined'&&BUFF_NAMES[id]);if(!n)continue;
        if(auras.includes(id)){for(const a of team.filter(living))add(id,n,'全隊光環',a,s,p.name);}
        else add(id,n,typeof TEAM_SHARE_BUFFS!=='undefined'&&TEAM_SHARE_BUFFS.has(id)?'共享法術':'個人狀態',p,s,p.name);
      }
    }
    const roster=companions();
    for(const row of rows.values()){
      row.companions=new Map();
      if(!auras.includes(row.id)&&!inheritedIllusions.has(row.id))continue;
      const providers=team.filter(p=>living(p)&&p.buffs?.[row.id]>0);
      const source=providers.reduce((best,p)=>!best||p.buffs[row.id]>best.buffs[row.id]?p:best,null);
      if(source)for(const entry of roster)row.companions.set(entry.unit,{...companionBenefit(row.id,entry),by:source.name||source._allyName,seconds:source.buffs[row.id]});
    }
    const classes=window.LineageClassCombat;
    if(classes)for(const owner of team.filter(living)){
      for(const skill of classes.activeAuras(owner)){
        const seconds=classes.state(owner).cd['upkeep:'+skill.id]-state.ticks/10;
        const label=skill.description.split('。')[0];
        if(!rows.has(skill.id))rows.set(skill.id,{id:skill.id,name:skill.name,kind:'流派光環',members:new Map(),companions:new Map()});
        const row=rows.get(skill.id);
        for(const who of team.filter(living)){
          if(skill.plan.ops.some(op=>classes.acceptsAura(who,op)))add(skill.id,skill.name,row.kind,who,seconds,owner.name);
        }
        for(const e of roster){
          const applies=skill.plan.ops.some(op=>{
            if(!classes.acceptsAura(e.unit,op)||op.key==='healingIn'&&e.unit._noHeal||op.key==='control'&&e.kind==='召喚物')return false;
            if(op.key==='damage'||op.key==='hit'){
              if(op.filter==='ranged')return false;
              if(['magic','element','rangedElement'].includes(op.filter))return e.kind==='寵物'
                ?PET_BOOK[e.unit.form]?.sk?.some(sk=>sk.kind==='magic')
                :['sk_elf_summon','sk_elf_summon2'].includes(e.unit.skId)||!!_sumTierOf(e.unit.form)?.mob.proc?.some(proc=>proc.ele&&proc.ele!=='none');
            }
            return true;
          });
          if((row.companions.get(e.unit)?.seconds||0)>=seconds)continue;
          row.companions.set(e.unit,{active:applies,label:applies?label:skill.plan.ops.every(op=>op.summonsOnly)?'限召喚物':'此夥伴沒有適用的招式或狀態',by:owner.name,seconds});
        }
      }
    }
    // Some leader HUD effects (e.g. shape changes, regeneration and debuffs)
    // originate outside buffs. Use the exact name and duration of their icon.
    const known=new Set();
    for(const row of rows.values()){known.add(row.name);known.add(STATUS_ICON_SKILLS[row.id]);}
    for(const status of document.getElementById('status-icon-bar')?.statusRows||[]){
      const label=status.label.replace('（隊友提供）','');
      if(known.has(label))continue;
      const id='status:'+status.name;
      add(id,label,label.startsWith('異常：')?'異常狀態':'角色狀態',player,status.ticks>0?status.ticks:Infinity,status.ally?'隊友':'本人');
      rows.get(id).companions=new Map();
    }
    return {team,companions:roster,rows:[...rows.values()]};
  }
  function coverage(row,roster){
    return ['寵物','召喚物'].map(kind=>{
      const units=roster.filter(e=>e.kind===kind);
      return units.length?kind+' '+units.filter(e=>row.companions.get(e.unit)?.active).length+'/'+units.length:'';
    }).filter(Boolean).join('・');
  }
  function markIcons(bar){
    if(!bar?.childElementCount)return;
    const {team,companions:roster,rows}=current(),lookup=new Map();
    for(const r of rows){lookup.set(r.name,r);if(typeof STATUS_ICON_SKILLS!=='undefined'&&STATUS_ICON_SKILLS[r.id])lookup.set(STATUS_ICON_SKILLS[r.id],r);}
    for(const el of bar.querySelectorAll('.status-icon')){
      const name=(el.querySelector('img')?.alt||'').replace('（隊友提供）','');
      const row=lookup.get(name);
      if(!row){
        if(el.dataset.effectId!==undefined){
          delete el.dataset.effectId;delete el.dataset.scope;el.removeAttribute('aria-description');
        }
        continue;
      }
      const scope=row.members.size===team.length?'whole':row.members.size>1?'some':'self';
      const description=[row.kind,row.members.size+' / '+team.length+' 人',coverage(row,roster),'點開查看明細'].filter(Boolean).join('，');
      if(el.dataset.effectId!==row.id)el.dataset.effectId=row.id;
      if(el.dataset.scope!==scope)el.dataset.scope=scope;
      if(el.getAttribute('aria-description')!==description)el.setAttribute('aria-description',description);
    }
  }
  const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
  function paint(list,member=null){
    if(!list)return;
    const all=current(),team=member?[member]:all.team,roster=member?all.companions.filter(c=>c.owner===member):all.companions;
    const rows=member?all.rows.filter(r=>r.members.has(member)||roster.some(c=>r.companions.get(c.unit)?.active)):all.rows,existing=new Map([...list.querySelectorAll('details')].map(el=>[el.dataset.effect,el]));
    if(!rows.length){if(!list.querySelector('.ga-empty'))list.replaceChildren(make('p','ga-empty','目前沒有生效的隊伍增益。'));return;}
    list.querySelector('.ga-empty')?.remove();
    for(const row of rows){
      let box=existing.get(row.id);
      if(!box){
        box=make('details','ga-effect');box.dataset.effect=row.id;
        const summary=make('summary');summary.append(make('strong','',row.name),make('small','',row.kind),make('b'));box.append(summary);
        list.append(box);
      }
      existing.delete(row.id);
      const extra=row.companions.size?coverage(row,roster):'';
      box.firstChild.lastChild.textContent=[(member?(row.members.has(member)?'本人受益':'夥伴受益'):row.members.size+' / '+team.length+' 人'),extra].filter(Boolean).join('・');
      if(!box.open&&!box.querySelector('.ga-effect-row'))box.ontoggle=()=>{if(box.open&&box.isConnected)paint(list,member);};
      if(!box.open)continue;
      for(let i=0;i<team.length;i++){
        const who=team[i],rec=row.members.get(who);
        let line=box.children[i+1];if(!line){line=make('div');box.append(line);}if(line.className!=='ga-effect-row'){line.className='ga-effect-row';line.replaceChildren(make('span'),make('span'));}
        line.firstChild.textContent=(who===all.team[0]?'隊長・':'')+(who.name||who._allyName||'隊員');
        const clock=rec?Math.ceil(rec.seconds):0;
        line.lastChild.textContent=rec?(Number.isFinite(clock)?('剩餘 '+Math.floor(clock/60)+' 分 '+clock%60+' 秒'):rec.by+'・常駐'):(living(who)?'未生效':'已倒地');
        if(rec?.by)line.title='來源・'+rec.by;else line.removeAttribute('title');
      }
      let pos=1+team.length;
      for(const entry of roster){
        const rec=row.companions.get(entry.unit);if(!rec)continue;
        let line=box.children[pos++];if(!line){line=make('div');box.append(line);}
        line.className='ga-companion-effect';
        const number=roster.filter(e=>e.kind===entry.kind).indexOf(entry)+1;
        line.textContent=entry.kind+' '+number+'・'+entry.name+'（'+(entry.owner.name||entry.owner._allyName)+'）　'+rec.label+'・來源 '+rec.by;
        line.classList.toggle('ga-inactive',!rec.active);
      }
      if(roster.length&&!row.companions.size){
        let line=box.children[pos++];if(!line){line=make('div');box.append(line);}
        line.className='ga-companion-effect ga-inactive';
        line.textContent='此狀態加持角色。寵物另依主人面板繼承部分能力。';
      }
      if(row.description){
        let line=box.children[pos++];if(!line){line=make('p');box.append(line);}
        line.className='ga-effect-description';
        if(line.textContent!==row.description)line.textContent=row.description;
      }
      while(box.children.length>pos)box.lastChild.remove();
    }
    for(const box of existing.values())box.remove();
  }
  return {attach:(ally,head)=>owners.set(ally,head),leaderOf:p=>owners.get(p),sync,foods,current,paint,markIcons};
})();
