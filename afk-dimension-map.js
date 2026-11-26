(() => {
'use strict';
const {TerrainView, BattleFormation, walker, advance, route, loadStrideData, mapForm, battleForm, stride, finishStride, alignFeet, trainingHealth, battleActions} = window.AFK_DIMENSION_VIEW;
const field = document.getElementById('battle-view');
const enemyList = document.getElementById('mob-list');
const game = document.getElementById('game-screen');
const heading = document.getElementById('map-adventure-heading');

window.AFK_TOGGLES?.register({id:'dimension-map', name:'地圖戰鬥', desc:'狩獵時顯示等距地圖、角色步態和施法動作。',group:'戰鬥',def:true});
if (field && enemyList && game && heading && !document.getElementById('dm-training') &&
    (!window.AFK_TOGGLES || window.AFK_TOGGLES.enabled('dimension-map'))) install();

function install() {
  const element = (tag, css, parent) => {
    const el = document.createElement(tag);
    el.className = css;
    parent.append(el);
    return el;
  };
  const canvas = element('canvas', 'dm-map-canvas', field);
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const terrain = new TerrainView(canvas);
  const marker = element('div', 'dm-marker', field);
  marker.hidden = true;
  const fieldActions=element('div','dm-field-actions',field);
  const toggle = element('button', 'dm-switch', fieldActions);
  toggle.type = 'button';
  toggle.hidden = true;
  const townActions=element('span','dm-town-actions',heading);
  const menuSwitch=element('button','dm-menu-switch',townActions);
  menuSwitch.type='button';menuSwitch.hidden=true;
  const practice=trainingHealth(() => active && mapState.current==='training' && !backgroundBattle());
  const vitality=element('button','dm-vitality',fieldActions);
  vitality.type='button';
  vitality.hidden=true;
  vitality.title='耐打模式提高小怪生命值，剩下 10% 血量時可觸發即死。點擊可切換原始規則。';
  vitality.addEventListener('click',()=>{practice.toggle(); syncVitality();});
  const enter = element('button', '', townActions);
  enter.id = 'dm-training';
  enter.type = 'button';
  enter.hidden = true;
  enter.textContent = '前往新兵修練場';
  const style = element('style', '', document.head);
  const mobileQuery = matchMedia('(max-width: 820px), (max-width: 1024px) and (max-height: 520px) and (pointer: coarse)');
  const board=new BattleFormation(terrain);
  // Screen-space offsets give allies a visible front and back line on a 2:1 isometric floor.
  const enemySlots=[[168,12],[145,-96],[155,102],[258,-45],[252,71],[90,135],[236,-125]];
  const partySlots=[[-100,61],[-102,-56],[-208,-14],[16,-108],[0,111],[-201,-107],[-200,96]];
  const meleeSlots=[[81,6],[-18,-77],[-12,80],[80,-74],[75,83],[-85,-69],[-83,76]];
  const rangedSlots=[[-201,-73],[-201,76],[-120,-120],[-121,126],[-258,0],[-252,-90],[-248,103]];
  const companionSlots=[[60,65],[44,-67],[-41,82],[-49,-73],[122,44],[-137,35],[-121,-47]];
  const mobs = new Map(), allies = new Map();
  const companions=new Map();
  let companionRoster=[], rally;
  let mobHistory=new WeakMap();
  const preferenceKey='dimension-battle-view-v1';
  const readPreference=()=>{try{return localStorage.getItem(preferenceKey);}catch{return null;}};
  let preference=readPreference();
  const defaultMode=()=>preference==='map' || (preference!=='original' && !mobile());
  let enabled = defaultMode(), active = false, request = 0, previous = 0, plannedAt = 0;
  let sceneId = '', mapKey = null, renderedRevision = -1, slotCount = 0;
  let leader, rosterHero, destination = null, resumeAt = 0, blockedAt = 0, cachedTarget = null;
  let paused = false, pausedAt=0;
  const canShow=()=>active && !!leader && mapKey===mapState.current &&
    field.classList.contains('dm-map') && !window.__vfxOff && !backgroundBattle();
  const actions=battleActions(field,resolveActor,canShow);

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function syncVitality() {
    vitality.hidden=!active || mapState.current!=='training' || !field.classList.contains('dm-map');
    setText(vitality,practice.enabled?'小怪血量 · 耐打':'小怪血量 · 原始');
    if (vitality.getAttribute('aria-pressed')!==String(practice.enabled))
      vitality.setAttribute('aria-pressed',String(practice.enabled));
  }
  function mapLabel(key) {
    const select = document.getElementById('map-select');
    if (select?.value === key && select.selectedOptions[0]) {
      return select.selectedOptions[0].textContent.trim().replace(/^[🔒⚔️\s]+/u, '');
    }
    if (typeof MAP_REGIONS !== 'undefined') {
      for (const region of MAP_REGIONS) {
        const found = region.maps.find(m => m.v === key);
        if (found) return found.t;
      }
    }
    return (typeof mapEntryOf === 'function' && mapEntryOf(key)?.t) || key;
  }
  function mobile() { return mobileQuery.matches || window.__afkm?.isMobile?.(); }
  function encounter(key) {
    const floor=/^pride_f(\d+)$/.exec(key);
    if(floor)return {signature:key,name:'傲慢之塔 '+floor[1]+' 樓'};
    if(key==='afk_riftdg'){
      const run=window.__afkRiftDg?.run?.();
      if(run){
        const id='riftdg_'+run.id;
        const variant=id+(run.pick?'_'+run.pick:'');
        const pick=run.D.pick?.find(p=>String(p[0])===String(run.pick));
        return {signature:variant,field:window.AFK_HUNTING_FIELDS[variant]?variant:id,
          name:run.D.n+(pick?'・'+pick[1]:''),art:window.AFK_HUNTING_FIELDS[id]?undefined:SPECIAL_AREA_BG[key]};
      }
    }
    if(key==='rift_battle')return {signature:key,name:'時空裂痕戰場'};
    const name=typeof SANCTUARY_MAP_NAMES!=='undefined' && SANCTUARY_MAP_NAMES[key];
    if(!window.AFK_HUNTING_FIELDS[key] && typeof SPECIAL_AREA_BG!=='undefined' && SPECIAL_AREA_BG[key]){
      const art=typeof upgradeAreaPath==='function'?upgradeAreaPath(SPECIAL_AREA_BG[key]):SPECIAL_AREA_BG[key];
      return {signature:key,name,art};
    }
    return {signature:key,name};
  }
  function backgroundBattle() {
    return document.hidden || state.running === false || !!state.ff || !!window.__afkOfflineNow?.() ||
      (typeof catchupActive === 'function' && catchupActive());
  }
  function trainingAvailable() {
    if (!/^town_/.test(mapState.current) || typeof setMapSelectors !== 'function') return false;
    const entry = typeof mapEntryOf === 'function' && mapEntryOf('training');
    return !!entry && typeof mapOptDisabled === 'function' && !mapOptDisabled(entry);
  }
  function clearMovement() {
    mobs.clear(); allies.clear(); companions.clear();companionRoster=[];mobHistory=new WeakMap();
    rosterHero=null;actions.reset();
    leader=walker(...terrain.origin);rally={x:leader.x,y:leader.y};board.floor=[];
    for(const node of field.querySelectorAll('#pet-layer .dm-grounded'))node.classList.remove('dm-grounded');
    destination = null; resumeAt = blockedAt = 0; plannedAt = 0; cachedTarget = null;
    marker.hidden = true;
    for (const moving of field.querySelectorAll('.dm-walking')) moving.classList.remove('dm-walking');
  }
  function stop() {
    practice.suspend();
    active = false;
    if (request) cancelAnimationFrame(request);
    request = 0; previous = 0; mapKey = null;sceneId=''; paused = false;
    field.classList.remove('dm-map');
    document.body.classList.remove('dm-viewing');
    delete field.dataset.dmTerrain;delete field.dataset.dmMap;delete field.dataset.dmScene;
    marker.hidden = vitality.hidden = true;
    terrain.reset(); clearMovement();
    delete window.__dimMapForm;
    delete window.__dimMapArrival;
    delete window.__dimMapSkillPerformed;
    delete window.__dimMapProc;
    delete window.__dimMapNative;
    delete window.__dimMapSpellFx;
    delete window.__dimMapCompanions;
    delete window.__dimMapCompanionPoint;
  }
  function sync() {
    enabled=defaultMode();
    const loaded = typeof player !== 'undefined' && player?.cls &&
      typeof mapState !== 'undefined' && typeof state !== 'undefined' &&
      !game.classList.contains('hidden');
    const inBattle = loaded && !!mapState.current && !field.classList.contains('hidden') && !mapState.current.startsWith('town_');
    if (!loaded || !enabled || mapState.current !== 'training') practice.reset();
    enter.hidden = !(loaded && !inBattle && trainingAvailable());
    toggle.hidden=!inBattle;menuSwitch.hidden=!loaded || inBattle;
    townActions.hidden=menuSwitch.hidden && enter.hidden;
    setText(menuSwitch,enabled?'地圖戰鬥 · 開':'地圖戰鬥 · 關');
    menuSwitch.setAttribute('aria-pressed',String(enabled));
    setText(toggle, enabled ? '返回原戰鬥' : '地圖戰鬥');
    toggle.setAttribute('aria-pressed', String(enabled));
    if (!inBattle || !enabled || document.hidden) { if (active) stop(); return; }
    if (!active) {
      active = true; previous = 0;
      window.__dimMapForm=mapForm;
      window.__dimMapArrival=actions.arrival;
      loadStrideData().catch(error => console.warn('步態載入失敗',error));
      window.__dimMapSkillPerformed = showSkill;
      window.__dimMapProc=actions.proc;
      window.__dimMapNative=actions.native;
      window.__dimMapSpellFx=actions.spellFx;
      window.__dimMapCompanions=roster=>{
        if(!field.classList.contains('dm-map'))return null;
        companionRoster=roster;return companions;
      };
      window.__dimMapCompanionPoint=pet=>{
        const actor=companions.get(pet.uid);
        if(!actor || !terrain.camera || mapKey!==mapState.current)return null;
        const [x,y]=terrain.project(actor.fx,actor.fy);
        return {x:x/terrain.width,y:y/terrain.height};
      };
      request = requestAnimationFrame(frame);
    }
  }
  function switchMode(){
    preference=enabled?'original':'map';
    try{localStorage.setItem(preferenceKey,preference);}catch{}
    sync();
  }
  toggle.addEventListener('click',switchMode);menuSwitch.addEventListener('click',switchMode);
  window.addEventListener('storage',event=>{if(event.key===preferenceKey){preference=readPreference();sync();}});
  enter.addEventListener('click', () => {
    if (!trainingAvailable()) return;
    const origin = mapState.current;
    setMapSelectors('training');
    const select = document.getElementById('map-select');
    const opt = select?.querySelector('option[value="training"]');
    if (!opt || opt.disabled) { setMapSelectors(origin); return; }
    select.value = opt.value;
    select.dispatchEvent(new Event('change', {bubbles:true}));
    sync();
  });
  field.addEventListener('click', event => {
    if (!active || !field.classList.contains('dm-map') || !leader || player.dead ||
        document.hidden || state.running===false || state.ff || window.__afkOfflineNow?.()) return;
    if (event.target.closest('.mob-target[data-uid]')) {
      // The game's delegated click handler has already resolved the UID to a live slot.
      destination = null; marker.hidden = true; resumeAt = blockedAt = 0; plannedAt = 0;
      return;
    }
    if (event.target.closest('button,select,input,a,[onclick],#status-icon-bar')) return;
    if (terrain.kind === 'loading') return;
    const rect = field.getBoundingClientRect();
    const to = terrain.cell((event.clientX - rect.left) * field.clientWidth / rect.width,
                            (event.clientY - rect.top) * field.clientHeight / rect.height);
    const world=terrain.world;
    if(!world?.map || !world.pass(to[0]-world.map.d.gameX0,to[1]-world.map.d.gameY0))return;
    routeLeader(to);
    resumeAt = blockedAt = 0;
  });

  function routeLeader(to) {
    const occupied=(x,y)=>board.occupied(leader,x,y);
    const goal=occupied(...to) ? board.seat(leader,{x:to[0],y:to[1]},[0,0]) : to;
    destination=route(leader,goal || [leader.x,leader.y],terrain,occupied);
    [leader.goalX,leader.goalY]=destination;
  }
  function layoutSlots() {
    const count = enemyList.children.length;
    if (count === slotCount) return;
    slotCount = count;
    // Positions live on the stable list. A card rebuilt during a hit keeps its impact anchor.
    style.textContent = Array.from({length:count}, (_, i) =>
      '#battle-view.dm-map #mob-list>.mob-target:nth-child('+(i+1)+'){' +
      '--dm-x:var(--dm-e'+i+'-x);--dm-y:var(--dm-e'+i+'-y);--dm-z:var(--dm-e'+i+'-z)}'
    ).join('\n');
  }
  function position(node, actor, prefix) {
    const [x, y] = terrain.project(actor.fx, actor.fy);
    const values = [Math.round(x)+'px', Math.round(y)+'px', String(4 + Math.max(0, Math.min(60, Math.floor(60*y/terrain.height))))];
    ['x','y','z'].forEach((key,i) => {
      const prop = prefix + key;
      if (node.style.getPropertyValue(prop) !== values[i]) node.style.setProperty(prop, values[i]);
    });
  }
  function approach(actor,anchor,offset) {
    const seat=board.seat(actor,anchor,offset);
    if(!seat)return;
    const [x,y]=seat;
    if(actor.goalX===x && actor.goalY===y && (actor.step || actor.path.length || actor.x===x && actor.y===y))return;
    const to=route(actor,seat,terrain,(cx,cy)=>board.occupied(actor,cx,cy));
    if((to[0]!==x || to[1]!==y) && board.occupied(actor,...to)){actor.path=[];return;}
    actor.goalX=to[0];actor.goalY=to[1];
  }
  function ranged(who) {
    const id = who?.eq?.wpn?.id;
    const weapon = typeof DB !== 'undefined' && DB.items?.[id];
    return weapon?.isBow || weapon?.animFam === 'bow' || (id && typeof atkSpdFamily === 'function' && atkSpdFamily(id) === 'bow') ||
      who?.cls === 'mage';
  }
  function live(ref) { return ref && !ref._dead && ref.curHp > 0; }
  function resolveActor(who) {
    if (!who || !rosterHero || !leader) return null;
    let actor,el,id,short,name,mob=false,afterHit=false;
    if(who===rosterHero) {
      actor=leader;id='hero';el=document.getElementById('player-morph-sprite');
      short=who.name || allyName(who);name='隊長・'+short;
    } else if(rosterHero.allies?.includes(who)) {
      id='ally-'+who._slot;actor=allies.get(String(who._slot));
      el=typeof _allySpriteStates!=='undefined' && _allySpriteStates[String(who._slot)]?.el;
      short=who.name || who._allyName || allyName(who);
      const index=rosterHero.allies.indexOf(who)+1;
      if(rosterHero.allies.some(a=>a && a!==who && (a.name||a._allyName||allyName(a))===short))short+=' '+index;
      name='傭兵・'+short;
    } else if(who.uid!=null && (mapState.mobs.includes(who)||mobHistory.has(who))) {
      id='mob-'+who.uid;actor=mobHistory.get(who);short=name=who.n;mob=true;
      if(!actor)return null;
      el=actor.el;
      if(!el?.isConnected || el.dataset.uid!==String(who.uid))
        el=Array.from(enemyList.children).find(n=>n.dataset.uid===String(who.uid));
      if(!el)afterHit=performance.now()-actor.seenAt<900;
    } else return null;
    if(!actor || (!el?.isConnected && !afterHit))return null;
    const [x,y]=terrain.project(actor.fx,actor.fy);
    return {who,actor,el,id,short,name,mob,afterHit,x,y,h:Math.max(18,Math.min(150,actor.inkHeight||62)),
      ranged:!mob && ranged(who), onRoute:!mob && (!!destination || actor.path.length>1),
      commandedWalk:!mob && !!destination && (!!actor.step || actor.path.length>0)};
  }
  // Native projectiles use viewport rectangles. The original party element can be
  // one pixel tall, so supply the visible silhouette measured at its current foot.
  for(const [fn,getWho] of [['_partyMemberRect',who=>who],['_pmCasterRect',()=>player]]) {
    const original=window[fn];
    if(typeof original==='function')window[fn]=function(who) {
      return actions.rect(getWho(who)) || original.apply(this,arguments);
    };
  }
  function showSkill(who, skill, records, result, aimedAt) {
    if(!canShow()||!skill?.name)return;
    const aim=!records?.length && aimedAt && skill.plan?.ops.some(o=>['hit','mark','debuff','status'].includes(o.kind));
    actions.active(who,skill,aim?[{who:aimedAt,kind:'aim'}]:records,aim?{kind:'aim'}:{});
  }
  function updateMobs(seconds, plan) {
    layoutSlots();
    const current = new Set();
    const byUid = new Map();
    for (const mob of mapState.mobs) if (mob) byUid.set(String(mob.uid), mob);
    Array.from(enemyList.children).forEach((card, slot) => {
      const uid = card.dataset.uid, mob = byUid.get(uid);
      if (!mob) return;
      if (practice.enabled && mapKey==='training') practice.apply(mob);
      current.add(uid);
      let offset=enemySlots[slot%enemySlots.length];
      const fixed=card.matches('.siege-fixed,.duel-fixed');
      if(fixed && card.style.left && card.style.top){
        offset=[(parseFloat(card.style.left)/100-.5)*terrain.width,(parseFloat(card.style.top)/100-.58)*terrain.height];
      }
      let actor = mobs.get(uid);
      if (!actor) {
        actor=board.spawn(destination?leader:rally,offset);
        card.classList.toggle('dm-no-seat',!actor);
        if(!actor)return;
        mobs.set(uid,actor);
      }
      card.classList.remove('dm-no-seat');actor.el=card;actor.seenAt=previous;mobHistory.set(mob,actor);
      if (plan && !fixed && !player.dead && live(mob)) {
        const distance = Math.max(Math.abs(actor.x-leader.x), Math.abs(actor.y-leader.y));
        if(distance>9 || terrain.project(actor.x,actor.y)[0]>terrain.width-28) approach(actor,destination?leader:rally,offset);
        else if(mob===mapState.mobs[mapState.targetIdx] && !destination && distance>6) approach(actor,leader,[104,16]);
        else if(!actor.step){actor.path=[];actor.goalX=actor.x;actor.goalY=actor.y;}
      }
      alignFeet(actor,card,true,mob.n);
      const steps=live(mob)?stride(actor,card,mob,'mob'):null;
      if (steps) advance(actor,seconds,0.64,terrain,(x,y)=>board.occupied(actor,x,y));
      else actor.walking=false;
      finishStride(card,steps,actor,true);
      position(enemyList,actor,'--dm-e'+slot+'-');
    });
    for (const id of mobs.keys()) if (!current.has(id)) mobs.delete(id);
  }
  function moveMember(el,actor,who,kind,seconds) {
    alignFeet(actor,el,false,battleForm(who,kind==='ally')?.domKey);
    if(actions.pose(el,who,kind,previous)){actor.walking=false;return;}
    const steps=stride(actor,el,who,kind);
    if (steps) advance(actor,seconds,kind==='hero'?0.47:0.50,terrain,(x,y)=>board.occupied(actor,x,y));
    else actor.walking=false;
    finishStride(el,steps,actor);
  }
  function updateParty(seconds, plan, now) {
    const mob = mapState.mobs[mapState.targetIdx], target = live(mob) && mobs.get(String(mob.uid));
    if (leader.step) blockedAt=0;
    if (destination && !leader.path.length && !leader.step &&
        (leader.x!==destination[0] || leader.y!==destination[1])) {
      // A moving ally can occupy the next tile after the original click.
      if(!blockedAt)blockedAt=now;
      if(now-blockedAt>=1800)destination=[leader.x,leader.y];
      else if(plan)routeLeader(destination);
    }
    if (destination && !leader.step && leader.x===destination[0] && leader.y===destination[1]) {
      if (!resumeAt) {rally={x:leader.x,y:leader.y};resumeAt=now+2500;}
      if (now >= resumeAt) { destination = null; resumeAt = blockedAt = 0; }
    }
    const hero = document.getElementById('player-morph-sprite');
    if (!player.dead && player.hp > 0) {
      if (plan && !destination && target) {
        approach(leader,target,ranged(player)?[-160,0]:[-68,0]);
      }
      moveMember(hero,leader,player,'hero',seconds);
    } else { leader.path = []; leader.walking = false; destination = null; actions.pose(hero,player,'hero',now);finishStride(hero,null,leader); }
    if (hero) position(hero,leader,'--dm-');
    const seen = new Set();
    let back=0,front=0;
    (player.allies || []).forEach((ally,i) => {
      if (!ally) return;
      const id = String(ally._slot);
      seen.add(id);
      const support=ranged(ally);
      const offset=partySlots[i%partySlots.length];
      const combat=support?rangedSlots[back++%rangedSlots.length]:meleeSlots[front++%meleeSlots.length];
      let actor = allies.get(id);
      const visual=typeof _allySpriteStates!=='undefined' && _allySpriteStates[id];
      if(!actor){
        actor=board.spawn(leader,offset);visual?.el?.classList.toggle('dm-no-seat',!actor);
        if(!actor)return;
        allies.set(id,actor);
      }
      visual?.el?.classList.remove('dm-no-seat');
      if (!ally._downed && ally.curHp > 0) {
        if (plan) {
          if (target && !destination) {
            approach(actor,target,combat);
          } else approach(actor,leader,offset);
        }
        moveMember(visual?.el,actor,ally,'ally',seconds);
      } else { actor.walking=false;actions.pose(visual?.el,ally,'ally',now); finishStride(visual?.el,null,actor); }
      if (visual?.el) position(visual.el,actor,'--dm-');
    });
    for (const id of allies.keys()) if (!seen.has(id)) allies.delete(id);
    marker.hidden = !destination;
    if (destination) {
      const [x,y] = terrain.project(...destination);
      marker.style.left = Math.round(x)+'px'; marker.style.top = Math.round(y)+'px';
    }
  }
  function updateCompanions(seconds, plan) {
    if(!companionRoster.length && !companions.size)return;
    const nodes=new Map(Array.from(field.querySelectorAll('#pet-layer [data-pet]'),el=>[el.dataset.pet,el]));
    const seen=new Set();
    for(const [i,p] of companionRoster.entries()){
      const el=nodes.get(String(p.uid));
      if(!el)continue;
      const offset=companionSlots[i%companionSlots.length];
      let actor=companions.get(p.uid);
      if(!actor){
        actor=board.spawn(leader,offset);
        if(!actor){el.classList.remove('dm-grounded');continue;}
        companions.set(p.uid,actor);
      }
      seen.add(p.uid);
      const target=!destination && mobs.get(String(p._faceMobUid ?? mapState.mobs[mapState.targetIdx]?.uid));
      if(plan && !p._downed)approach(actor,target||leader,offset);
      const dir=actor.step?actor.heading:actor.path[0];
      const form=p.formGfx||p.form;
      if(dir!==undefined && !actor.step)actor.heading=dir;
      const anim=typeof _pet8Cache!=='undefined' && _pet8Cache[form+'#'+actor.heading];
      if(!p._downed && !p._animAct && anim?.walk?.length)advance(actor,seconds,.48,terrain,(x,y)=>board.occupied(actor,x,y));
      else actor.walking=false;
      alignFeet(actor,el,false,form);position(el,actor,'--dm-');
      el.classList.add('dm-grounded');
    }
    for(const id of companions.keys())if(!seen.has(id))companions.delete(id);
  }
  function fitRosterToView() {
    // Reassign only the followers that a resized viewport has put outside the stage.
    // Their battle state and the leader's current route belong to the game.
    for(const roster of [allies,mobs,companions]){
      for(const [id,actor] of roster){
        const [x,y]=terrain.project(actor.fx,actor.fy);
        if(x<24 || x>terrain.width-24 || y<50 || y>terrain.height-12)roster.delete(id);
      }
    }
    plannedAt=0;
  }
  function frame(now) {
    request = 0;
    if (!active) return;
    if (now-previous < 31) { request=requestAnimationFrame(frame); return; }
    const seconds = Math.min(0.075,(now-previous)/1000);
    previous = now;
    try {
      if (backgroundBattle()) {
        practice.suspend();
        if(!paused){pausedAt=now;paused=true;}
        if(pausedAt>=0 && (now-pausedAt>300 || state.running===false || document.hidden)) {
          actions.reset();pausedAt=-1;
        }
        request=requestAnimationFrame(frame);return;
      }
      if (paused) {
        paused = false;
        plannedAt = 0;
      }
      const current=encounter(mapState.current);
      if (mapKey!==mapState.current || sceneId!==current.signature) {
        if (mapState.current !== 'training') practice.reset();
        mapKey=mapState.current;sceneId=current.signature;
        const label=current.name || (typeof mapDisplayName==='function' && mapDisplayName(mapKey)) ||
          (typeof ANTHARAS_AREA_NAMES!=='undefined' && ANTHARAS_AREA_NAMES[mapKey]) || mapLabel(mapKey);
        terrain.select(current.field || sceneId,label,current.art);
      }
      practice.resume();
      {
        toggle.hidden = false;
        setText(toggle,'返回原戰鬥');
        const resized=terrain.width!==field.clientWidth || terrain.height!==field.clientHeight;
        terrain.prepare(field.clientWidth,field.clientHeight,now);
        if (renderedRevision !== terrain.revision) { clearMovement(); renderedRevision = terrain.revision; }
        terrain.draw(leader,field.clientWidth,field.clientHeight,now);
        if(resized)fitRosterToView();
        field.dataset.dmMap=mapKey;field.dataset.dmScene=sceneId;
        field.dataset.dmTerrain = terrain.kind;
        if (!field.classList.contains('dm-map')) {field.classList.add('dm-map');document.body.classList.add('dm-viewing');}
        rosterHero=player;
        syncVitality();
        const uid = mapState.mobs[mapState.targetIdx]?.uid;
        const plan = now >= plannedAt || cachedTarget !== uid;
        if (plan) { plannedAt=now+320; cachedTarget=uid; }
        board.begin([leader,...allies.values(),...mobs.values(),...companions.values()],leader,plan);
        updateMobs(seconds,plan);
        updateParty(seconds,plan,now);
        updateCompanions(seconds,plan);
        actions.frame(now);
      }
    } catch (error) {
      console.warn('地圖演出已切回原戰鬥',error);
      preference='original'; enabled=false; stop(); sync(); return;
    }
    request = requestAnimationFrame(frame);
  }
  const observer = new MutationObserver(sync);
  for (const node of [field, game, document.getElementById('town-view')].filter(Boolean)) {
    observer.observe(node,{attributes:true,attributeFilter:['class']});
  }
  // The field also changes class during normal renders. Avoid writing our own class twice.
  mobileQuery.addEventListener('change',sync);
  window.addEventListener('resize',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',sync);
  sync();
}

})();
