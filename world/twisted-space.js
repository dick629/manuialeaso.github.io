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
    d:'扭亂時空每次擊殺有 1% 機會掉落 1 張。在席琳神殿的裂縫之門，用證明和血龍鑽可兌換每日次元副本的額外入場。'};
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
  const BOSS_KEEP = 3;
  const resident = m => !!m && !m._afkWe && !m._afkRb && m._afkKurt !== 'hunt' && !m._afkKurtMinion;
  const needsBoss = idx => mapState.mobs.filter((m,i) => i !== idx && live(m) && m.boss && resident(m)).length < BOSS_KEEP;
  function pickBossOrMob(idx) {
    if (needsBoss(idx) && bosses.length) {
      const others = mapState.mobs.filter((m,i) => i !== idx && live(m));
      const aliveNames = new Set(others.map(m => DB.mobs[m.mobId]?.n || m.n));
      const candidates = bosses.filter(id => !aliveNames.has(DB.mobs[id].n));
      if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return ordinary[Math.floor(Math.random() * ordinary.length)];
  }
  // applySherineBuff is shared by native spawns, transformations and the scripted boss placer.
  // It has already applied Dream Mirror before this step. Leave level, dice, cooldowns and
  // probabilities intact. Attack damage uses the same outgoing multiplier as the rift.
  const X = Object.freeze({hp:1,bossHp:0.35,def:1.2,hit:4/3,dmg:2.5,drain:2,exp:1.5,gold:3});
  // 11-26 23:03 Ping：扭亂時空三條新規則的常數（全部集中在這裡）
  //   fee／feeSec：待在扭亂時空每滿 feeSec 秒（遊戲時間）扣 fee 金幣；不夠就不扣、送回席琳神殿
  //   stunHit／stunHitSec：一般怪每次命中有 stunHit 機率暈眩被打的人 stunHitSec 秒
  //   stunBossSec：王出場暈眩全隊；stunGuardSec：同一人被暈後這段時間內不會再被暈（王出場與一般怪共用）
  //   entryPct／entryFloor：每隻王出場扣最大 HP entryPct，出場傷害最多打到剩 entryFloor
  const R3 = Object.freeze({fee:500000, feeSec:60, stunHit:0.05, stunHitSec:2, stunBossSec:3, stunGuardSec:5, entryPct:0.10, entryFloor:0.5});
  function scale(m) {
    if (!m || m._twisted || !m._dream) return;
    m._twisted = true;
    m._dimRift = true;
    const ratio = dynamicBossHp.get(m.n);
    m.hp = Math.max(1,Math.round(m.hp * (ratio ? ratio() : 1) * (m.boss ? X.bossHp : X.hp)));
    m.curHp = m.hp;
    for (const key of ['ac','mr','dr','er','_dreamEva','_dreamRegen','regenHp','resFire','resWater','resWind','resEarth']) {
      if (typeof m[key] === 'number') m[key] = Math.round(m[key] * X.def);
    }
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
  // Use the saved simulation clock. A fresh visit starts its own minute even if
  // the player crosses the boundary twice between two whole-second ticks.
  const feeTicks = R3.feeSec * 10;
  let feeReturnFor = null;
  function startVisit(tick = state.ticks) {
    mapState.twistedFeeDue = tick + feeTicks;
  }
  function hasFeeReturn() { return feeReturnFor === player; }
  function reportFeeReturn() {
    if (state.ff || !hasFeeReturn()) return;
    feeReturnFor = null;
    logSys('<span class="text-amber-300 font-bold">金幣不足 ' + R3.fee.toLocaleString() + '，已離開扭亂時空，返回席琳神殿。</span>');
  }
  function feeSecond(previousTick = state.ticks) {
    if (!here() || player.dead) return;
    if (!Number.isSafeInteger(mapState.twistedFeeDue)) startVisit(previousTick);
    const elapsed = state.ticks - mapState.twistedFeeDue;
    if (elapsed < 0) return;
    const minutes = 1 + Math.floor(elapsed / feeTicks);
    const paid = Math.min(minutes, Math.floor(Math.max(0, Number(player.gold) || 0) / R3.fee));
    if (paid) {
      player.gold -= paid * R3.fee;
      mapState.twistedFeeDue += paid * feeTicks;
      if (!state.ff) logSys('<span class="text-slate-300">扭亂時空的停留費用：' + (paid * R3.fee).toLocaleString() + ' 金幣。</span>');
    }
    if (paid === minutes) return;
    delete mapState.twistedFeeDue;
    feeReturnFor = player;
    setMapSelectors('town_sherine');
    changeMap(true);
    if (state.ff) queueMicrotask(reportFeeReturn);
    else reportFeeReturn();
  }
  // ── 規則 2：暈眩（照玩家、傭兵現有的暈眩抗性與免暈；同一人 stunGuardSec 秒內不再被暈） ──
  const stunGuard = new WeakMap();
  const standardStun = Object.freeze({respectImmunity:true});
  function stunOne(ent, sec, mob) {
    if (!ent || (ent === player ? player.dead : (ent._downed || !(ent.curHp > 0)))) return false;
    const now = state.ticks || 0;
    if ((stunGuard.get(ent) || -1) > now) return false;
    const resisted = ent === player ? (typeof playerStatusResisted === 'function' && playerStatusResisted('stun',mob,standardStun))
      : (typeof allyStatusResisted === 'function' && allyStatusResisted(ent,'stun',mob,standardStun));
    if (resisted) return false;
    const t = Math.round(sec * 10);
    const existing = Number(ent.statuses?.stun) || 0;
    if (existing >= t) return false;
    if (window.AFK_RELIC_DEFENSE_BRIDGE) {
      const applied = AFK_RELIC_DEFENSE_BRIDGE.setStatus(ent,'stun',t,mob,standardStun);
      if (applied <= existing) return false;
    } else {
      (ent.statuses ||= {}).stun = t;
    }
    stunGuard.set(ent, now + R3.stunGuardSec * 10);
    return true;
  }
  function onHit(ent, mob, kind) {
    if (!here() || !mob || mob.boss || kind === 'dot' || Math.random() >= R3.stunHit) return;
    if (stunOne(ent, R3.stunHitSec, mob)) try { if (!state.ff) logCombat('<span class="text-yellow-300">' + (ent === player ? '你' : (ent._allyName || '傭兵')) + '被' + mob.n + '打暈了（' + R3.stunHitSec + ' 秒）。</span>', 'enemy'); } catch (e) {}
  }
  function bossEntryStun(mob) {
    if (!here()) return 0;
    let n = 0;
    [player].concat(GiranPartyView.combatAllies(player)).forEach(e => { if (stunOne(e, R3.stunBossSec, mob)) n++; });
    if (n) try { if (!state.ff) logCombat('<span class="text-yellow-300 font-bold">' + (mob && mob.n || '王') + '出場的威壓讓 ' + n + ' 人暈眩（' + R3.stunBossSec + ' 秒）。</span>', 'enemy'); } catch (e) {}
    return n;
  }
  const regional = window.__afkRbRegionOf;
  window.__afkRbRegionOf = (id,keys) => id === map && keys.length ?
    keys[Math.floor(Math.random()*keys.length)] : regional?.(id,keys);
  return {map,proof,limit,here,open,canPlace,pickBossOrMob,scale,settle,killRewards,preview,cardBoss,
    baseSlots:5,bossSlots:BOSS_KEEP,resident,needsBoss,X,R3,onHit,bossEntryStun,feeSecond,startVisit,hasFeeReturn,reportFeeReturn,
    monsterDamage:(m,dmg) => m?._twisted ? dmg*X.dmg : dmg,
    blockItem(id) {
      if (!killDepth) return false;
      const d = DB.items[id];
      return !(d?.cardMob || d?.eff === 'afk_pcard' || d?.bossCard || id.startsWith('bcard_') || (awarding && (id===proof || d?.relic)));
    },
    blockingSideRewards:() => killDepth>0,
  };
})();
