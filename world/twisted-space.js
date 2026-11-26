'use strict';
// The two battle interfaces share the same field, encounter pool and kill rewards.
window.TwistedSpace = (() => {
  const map = 'twisted_spacetime', proof = 'dimensional_hunt_proof', limit = 30;
  const here = () => mapState.current === map;
  const open = () => !!window.__afkDimRift?.on();
  const live = m => m && !m._dead && m.curHp > 0;
  const canPlace = idx => open() && (live(mapState.mobs[idx]) || mapState.mobs.filter(live).length < limit);
  DB.items[proof] = {n:'次元獵殺證明', type:'etc', p:0, weight:0, gachaWeight:0,
    noUse:true, noSell:true, c:'text-cyan-300', img:'assets/icons/items/法令軍王徽印.png',
    d:'扭亂時空每次擊殺有 1% 機會掉落 1 張。在席琳神殿的裂縫之門可兌換每日次元副本的額外入場次數。'};
  MAP_CATEGORIES.wild.push({v:map,t:'扭亂時空',c:'#c4b5fd',classicHide:true,requiresDimRift:true});
  MAP_REGIONS.find(r => r.key === 'sherine').maps.push({v:map,t:'扭亂時空'});
  SPECIAL_AREA_BG[map] = 'assets/area/1920x1080/rift_altar.jpg';

  let ordinary = [], bosses = [];
  const dynamicBossHp = new Map();
  function rebuild() {
    ordinary = []; bosses = [];
    const existing = new Set(Object.values(DB.mobs).filter(m => m?.boss).map(m => m.n));
    const register = (key, name, base, art) => {
      if (!name || !base || existing.has(name)) return;
      existing.add(name);
      const def = {...base,n:name,boss:true,questOnly:true};
      if (def.race === '建築' || def.race === '血盟') def.race = '其他';
      for (const tag of ['afkWe','afkRb','afkMb','transformTo','transformHpPct','siegeEnemy','pledgeEnemy','trollPlayer']) delete def[tag];
      DB.mobs['twisted_boss_'+key] = def;
      if (art && art !== name) window.__afkLore?.aliasAnim(name,art);
    };
    const dungeons = window.__afkRiftDg;
    for (const dungeon of dungeons?.D || []) {
      for (const [i,stage] of (dungeon.stages || []).entries()) {
        const b = stage.boss;
        if (!b?.n || existing.has(b.n)) continue;
        const base = DB.mobs[dungeons.findBase(b.re || b.n)];
        const hp = b.hp || dungeons.R.bossRef*(b.hpX || 10);
        if (b.hpAbs) dynamicBossHp.set(b.n,() => b.hpAbs({pick:'1'}) / hp);
        if (base) register(dungeon.id+'_'+i,b.n,{...base,hp},base.n);
      }
    }
    const guard = window.__afkGuardRing;
    for (const [id, knight] of Object.entries(guard?.DGK || {})) {
      const base = guard.fieldBoss(id,85);
      if (base) register('guard_'+id,knight.boss,{...base,hp:base.hp*guard.DG.bossHp},knight.anim);
    }
    for (const [id,m] of Object.entries(DB.mobs)) {
      if (!m?.n || !(m.hp > 0) || m.race === '建築' || m.race === '血盟' ||
          m.trollPlayer || m.siegeEnemy || m.pledgeEnemy || m._train || m.isAlly ||
          id === 'afk_rd_base' || id.startsWith('afk_dummy')) continue;
      // Regional lords and world events have their own timers, parties and encounter scripts.
      if (m.afkRb || m.afkWe) continue;
      if (m.boss) bosses.push(id);
      else if (m.exp > 0) ordinary.push(id);   // 11-26 Ping（次元）：全部怪都會出現，不限 Lv85
    }
    DB.maps[map] = ordinary.concat(bosses);
  }
  rebuild();
  window.addEventListener('load', rebuild);
  // 11-26 Ping（次元）：場上王必定 3 隻（5 格的 60%）——空格補怪時，活著的王不到 3 隻就補王
  const BOSS_KEEP = 3;
  function pickBossOrMob(force, chance) {
    const liveBoss = mapState.mobs.filter(m => live(m) && m.boss).length;
    if ((force || liveBoss < BOSS_KEEP) && bosses.length) {
      const aliveNames = new Set(mapState.mobs.filter(live).map(m => m.n));
      const candidates = bosses.filter(id => !aliveNames.has(DB.mobs[id].n));
      if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return ordinary[Math.floor(Math.random() * ordinary.length)];
  }
  // applySherineBuff is shared by native spawns, transformations and the scripted boss placer.
  // It has already applied Dream Mirror before this step. Leave level, dice, cooldowns and
  // probabilities intact. Attack damage uses the same outgoing multiplier as the rift.
  // 11-26 16:15 Ping（次元）：難度約時光屋 3.5 倍、收益比時光屋低——HP ×2、防禦類 ×1.5、命中 ×4/3、怪物傷害 ×2.5、經驗 ×1.5、金幣 ×3（原本 ×10／×5／×5／×15／×5／×5）
  const X = {hp:1, bossHp:0.35, def:1.2, hit:4/3, dmg:2.5, drain:2, exp:1.5, gold:3};
  function scale(m) {
    if (!m || m._twisted || !m._dream) return;
    m._twisted = true;
    m._dimRift = true;
    const ratio = dynamicBossHp.get(m.n);
    m.hp = Math.max(1, Math.round(m.hp * (ratio ? ratio() : 1) * (m.boss ? X.bossHp : X.hp)));
    m.curHp = m.hp;
    for (const key of ['ac','mr','dr','er','_dreamEva','_dreamRegen','regenHp','resFire','resWater','resWind','resEarth'])
      if (typeof m[key] === 'number') m[key] = Math.round(m[key] * X.def);
    if (typeof m.hit === 'number') m.hit = Math.round(m.hit * X.hit);
    if (typeof m.exp === 'number') m.exp = Math.round(m.exp * X.exp);
    for (const key of ['goldMin','goldMax']) if (typeof m[key] === 'number') m[key] = Math.round(m[key] * X.gold);
  }
  function relics(m) {
    const name = DB.mobs[m.mobId]?.n || m.n;
    return (MOB_DROPS[name] || MOB_DROPS[m.n] || []).filter(([id,rate]) => rate > 0 && DB.items[id]?.relic &&
      (!window.LineageDropPolicy || LineageDropPolicy.allows(m,id)));
  }
  function cardRows(m) {
    const source = DB.mobs[m.mobId]?.n || m.n;
    const name = CARD_DROP_ALIAS[source] || source;
    if (m.transformTo || !CARD_MOB_INFO[name]) return [];
    const names = CARD_CHAIN_BY_FINAL[name] || [name];
    const rates = [[3,0.00001],[2,0.0001],[1,0.001]];
    if (window.__afkCardPlus?.enabled()) rates.push(...window.__afkCardPlus.baseRates);
    return rates.map(([tier,rate]) => ({names,tier,rate}));
  }
  function settle(m, kills, sample, item, card) {
    const proofs = sample(kills,0.01);
    if (proofs) item(proof,proofs);
    for (const [id,pct] of relics(m)) {
      const count = sample(kills,pct/100);
      if (count) item(id,count);
    }
    for (const {names,tier,rate} of cardRows(m)) {
      let remaining = sample(kills,rate);
      // Only split successful draws when a transformation chain has several possible cards.
      for (let i=0; remaining && i<names.length; i++) {
        const count = i===names.length-1 ? remaining : sample(remaining,1/(names.length-i));
        if (count) card(names[i],tier,count);
        remaining -= count;
      }
    }
  }
  let killDepth = 0, awarding = false;
  function cardBoss(m) {
    if (!m.boss) return;
    const name = DB.mobs[m.mobId]?.n || m.n;
    return window.__afkMapBoss?.BY[m.afkMb] || window.__afkBossCard?.LIST.find(b=>b.n===name);
  }
  function killRewards(m) {
    const before = awarding;
    awarding = true;
    try {
      settle(m,1,(_,rate) => Number(Math.random()<rate), (id,n) => gainItem(id,n), acquireCard);
      window.__afkBossCardKill?.(cardBoss(m),m);
    } finally { awarding = before; }
  }
  function preview(m) {
    const rows = [[proof,DB.items[proof].n,1,'',true]];
    for (const [id,pct] of relics(m)) rows.push([id,DB.items[id].n,pct,'',true]);
    for (const {names,tier,rate} of cardRows(m)) for (const name of names) {
      const id = cardId(name,tier);
      if (DB.items[id]) rows.push([id,DB.items[id].n,rate*100/names.length,'',true]);
    }
    const king = cardBoss(m);
    if (king) {
      let remaining = 1;
      for (const t of [...__afkBossCard.TIERS].reverse().filter(t => t.t !== 4)) {
        const id = __afkBossCard.cid(king.id,t.t);
        if (DB.items[id]) rows.push([id,DB.items[id].n,t.rate*remaining*100,'',true]);
        remaining *= 1-t.rate;
      }
    }
    return rows;
  }
  // Keep add-on awards inside the same kill transaction. Purchases outside combat stay usable.
  function wrapKill() {
    const previous = window.killMob;
    if (previous.twistedGuard) return;
    function guarded(idx) {
      if (!here()) return previous.apply(this,arguments);
      killDepth++;
      try { return previous.apply(this,arguments); } finally { killDepth--; }
    }
    guarded.twistedGuard = true;
    window.killMob = guarded;
  }
  wrapKill();
  window.addEventListener('load',wrapKill);
  const regional = window.__afkRbRegionOf;
  window.__afkRbRegionOf = (id,keys) => id === map && keys.length ?
    keys[Math.floor(Math.random()*keys.length)] : regional?.(id,keys);
  return {map,proof,limit,here,open,canPlace,pickBossOrMob,scale,settle,killRewards,preview,cardBoss,
    X, monsterDamage:(m,dmg) => m?._twisted ? dmg*X.dmg : dmg,
    blockItem(id) {
      if (!killDepth) return false;
      const d = DB.items[id];
      return !(d?.cardMob || d?.bossCard || id.startsWith('bcard_') || (awarding && (id===proof || d?.relic)));
    },
    blockingSideRewards:() => killDepth>0,
  };
})();
