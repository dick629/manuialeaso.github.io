/* ============================================================================
 * afk-procfx.js — 觸發型特效的共用底層（玩家 2026-11-02 13:10；密奧之卡、聖紋共用；沒有外掛開關，本身不做任何事）
 *
 *   各系統用 W.__afkProc.on(事件, 函式) 掛上去：
 *     dealt(actor, target, v, opt) → 回傳新的傷害     你（或傭兵）每次對怪物造成傷害（卡冊結算之後）
 *     taken(ent, dmg, mob, kind) → 回傳新的傷害       受到傷害（各種百分比減傷算完之後；護盾在這裡吸收）
 *     tick()                                          每一刻（0.1 秒）
 *     kill(mob)                                       怪物被打倒
 *     evade(mob)                                      你迴避了怪物的攻擊（核心補丁 88）
 *     death() → 回傳 true 就不倒下（函式自己把 HP 補回來）
 *     potion(def, est, hpBefore)                      你喝了治癒藥水（est＝這罐預估回復量）
 *     resist(kind) → 回傳 true 就抵抗這次異常狀態
 *   另外提供：pop（角色頭上浮出圖示與名字）、note（戰鬥日誌，同一個 key 每 5 秒最多一行）、hitMob（追加傷害）、
 *   shield（護盾）、party（隊伍人數）、inCombat。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.__afkProc) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var H = { dealt: [], taken: [], tick: [], kill: [], evade: [], death: [], potion: [], resist: [] };
  var on = function (ev, fn) { if (H[ev]) H[ev].push(fn); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var inCombat = function () {
    try { var key = mapState.current || ''; if (/^town_/.test(key)) return false; return (mapState.mobs || []).some(function (m) { return m && !m._dead && m.curHp > 0; }); } catch (e) { return false; }
  };
  var party = function () { var p = P(); return p ? Math.min(16, 1 + (p.allies || []).filter(function (a) { return a && !a._downed; }).length) : 1; };

  // ── 浮字 ──
  var css = function () {
    if (document.getElementById('afk-proc-css')) return;
    var s = document.createElement('style'); s.id = 'afk-proc-css';
    s.textContent = '.afk-proc-pop{position:fixed;z-index:9990;display:flex;align-items:center;gap:6px;padding:3px 10px 3px 4px;border-radius:99px;background:rgba(15,10,25,.82);border:1px solid var(--c,#f0abfc);color:#fff;font:700 13px/1.2 sans-serif;text-shadow:0 1px 2px #000;pointer-events:none;transform:translate(-50%,0);animation:afkProcUp 1s ease-out forwards;white-space:nowrap;box-shadow:0 0 10px var(--c,#f0abfc)}'
      + '.afk-proc-pop img{width:24px;height:24px;border-radius:5px}'
      + '@keyframes afkProcUp{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}15%{opacity:1;transform:translate(-50%,0) scale(1.05)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-34px) scale(1)}}';
    document.head.appendChild(s);
  };
  var lastPop = {}, popN = 0;
  var pop = function (key, img, text, color) {
    try {
      if (S().ff || (typeof _vfxMute === 'function' && _vfxMute())) return;
      var t = Date.now(); if (lastPop[key] && t - lastPop[key] < 800) return; lastPop[key] = t;
      var bv = document.getElementById('battle-view'), r = bv ? bv.getBoundingClientRect() : null;
      if (!r || !(r.width > 0)) return;
      css();
      var el = document.createElement('div'); el.className = 'afk-proc-pop'; el.style.setProperty('--c', color || '#f0abfc');
      var lane = (popN++ % 3) - 1;
      el.style.left = (r.left + r.width / 2 + lane * 70) + 'px'; el.style.top = (r.top + r.height * 0.62) + 'px';
      el.innerHTML = (img ? '<img src="' + esc(img) + '">' : '') + esc(text);
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 1100);
    } catch (e) {}
  };
  var lastNote = {};
  var note = function (key, html) {
    var t = tk(); if (lastNote[key] != null && t - lastNote[key] < 50 && t >= lastNote[key]) return; lastNote[key] = t;
    try { if (typeof logCombat === 'function') logCombat(html, 'skill'); } catch (e) {}
  };

  // ── 追加傷害（不再走卡冊結算，避免循環）──
  var hitMob = function (m, dmg) {
    if (!m || m._dead || !(m.curHp > 0) || !(dmg > 0)) return 0;
    var w = m._reflectWall; if (w && w.block && tk() <= (w.until || 0)) return 0;
    dmg = Math.max(1, Math.floor(dmg));
    m.curHp -= dmg;
    if (m.curHp <= 0) { var i = (mapState.mobs || []).indexOf(m); if (i >= 0) { try { killMob(i); } catch (e) {} } }
    return dmg;
  };

  // ── 護盾 ──
  var shield = {
    get: function () { var p = P(); return p ? Math.max(0, Number(p._afkShield) || 0) : 0; },
    add: function (n, cap) { var p = P(); if (!p || !(n > 0)) return; p._afkShield = Math.min(cap > 0 ? cap : Infinity, (Number(p._afkShield) || 0) + Math.floor(n)); },
    set: function (n) { var p = P(); if (p) p._afkShield = Math.max(0, Math.floor(n) || 0); }
  };

  // ── 掛點 ──
  // 面板傷害：每個攻擊者最近直接傷害（一般攻擊、魔法）的移動平均；給持續傷害上限用（玩家 2026-11-02 15:20 平衡 A）
  var PANEL = new WeakMap();
  // 各系統的百分比加減傷（刻印 +3%、蝕刻 ×1.5、密奧、聖紋…）乘完會有小數；傷害一律取整數（玩家 2026-11-04：頭目身上飄出 0.599999999996275）
  var whole = function (v) { v = Number(v); if (!isFinite(v) || !(v > 0)) return 0; return Math.floor(v); };
  W.__afkPanelDmg = function (actor) { return (actor && typeof actor === 'object' && PANEL.get(actor)) || 0; };
  var hookedC = false;
  var hookC = function () {
    var C = W.AFK_CARD_COMBAT; if (hookedC || !C || typeof C.damage !== 'function') return; hookedC = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { var k = opt && opt.kind; if (v > 0 && actor && typeof actor === 'object' && (k === 'melee' || k === 'ranged' || k === 'magic')) { var pv = PANEL.get(actor); PANEL.set(actor, pv ? pv * 0.9 + v * 0.1 : v); } } catch (e) {}
      try { if (v > 0) for (var i = 0; i < H.dealt.length; i++) { var r = H.dealt[i](actor, target, v, opt || {}); if (typeof r === 'number' && r >= 0 && isFinite(r)) v = r; } } catch (e) { console.warn('[AFK-proc] dealt', e); }
      return whole(v);
    };
  };
  hookC(); W.addEventListener('load', hookC);
  if (typeof W.__afkTaken === 'function') {
    var oT = W.__afkTaken;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = oT.apply(this, arguments);
      try {
        for (var i = 0; i < H.taken.length; i++) { var r = H.taken[i](ent, v, mob, kind); if (typeof r === 'number' && r >= 0 && isFinite(r)) v = r; }
        var p = P();
        v = whole(v);
        if (ent === p && v > 0 && p._afkShield > 0) { var a = Math.min(Math.floor(p._afkShield), v); p._afkShield -= a; v -= a; }
      } catch (e) { console.warn('[AFK-proc] taken', e); }
      return whole(v);
    };
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try { if (P()) for (var i = 0; i < H.tick.length; i++) H.tick[i](); } catch (e) { console.warn('[AFK-proc] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  if (typeof W.killMob === 'function') {
    var oK = W.killMob;
    W.killMob = function (idx) {
      var m = typeof mapState !== 'undefined' && mapState.mobs ? mapState.mobs[idx] : null, alive = m && !m._dead;
      var r = oK.apply(this, arguments);
      try { if (alive && m._dead && !m._afkProcKill) { m._afkProcKill = true; for (var i = 0; i < H.kill.length; i++) H.kill[i](m); } } catch (e) { console.warn('[AFK-proc] kill', e); }
      return r;
    };
  }
  var prevEv = W.__afkOnEvade;
  W.__afkOnEvade = function (ent, mob) { if (typeof prevEv === 'function') prevEv.apply(this, arguments); try { for (var i = 0; i < H.evade.length; i++) H.evade[i](mob); } catch (e) {} };
  if (typeof W.killPlayer === 'function') {
    var oKP = W.killPlayer;
    W.killPlayer = function () {
      try { var p = P(); if (p && !p.dead) for (var i = 0; i < H.death.length; i++) if (H.death[i]() === true && p.hp > 0) return; } catch (e) { console.warn('[AFK-proc] death', e); }
      return oKP.apply(this, arguments);
    };
    try { (0, eval)('killPlayer = window.killPlayer'); } catch (e) {}
  }
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      var p = P(), it = p && (p.inv || []).find(function (i) { return i && i.uid === u; }), d = it && DB.items[it.id];
      var pot = !!(d && d.type === 'pot' && (d.valMin != null || d.val) && !/mp|mana|藍|魔力/i.test(String(d.eff || '') + (d.n || ''))), hp0 = p ? p.hp : 0;
      var r = oUse.apply(this, arguments);
      try {
        if (pot && p && p.hp > hp0) {
          var base = d.valMin != null && d.valMax != null ? (d.valMin + d.valMax) / 2 : (d.val || 0);
          var pct = 0; try { pct = (typeof getConPotionPct === 'function' ? getConPotionPct(p.d.con) : 0) + (typeof playerEquipPotionBonusPct === 'function' ? playerEquipPotionBonusPct() : 0); } catch (e) {}
          var est = base * (1 + pct / 100);
          for (var i = 0; i < H.potion.length; i++) H.potion[i](d, est, hp0);
        }
      } catch (e) { console.warn('[AFK-proc] potion', e); }
      return r;
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  if (typeof W.playerStatusResisted === 'function') {
    var oRes = W.playerStatusResisted;
    W.playerStatusResisted = function (kind) {
      var r = oRes.apply(this, arguments);
      if (r) return r;
      try { for (var i = 0; i < H.resist.length; i++) if (H.resist[i](kind) === true) return true; } catch (e) {}
      return r;
    };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }

  W.__afkProc = { on: on, H: H, pop: pop, note: note, hitMob: hitMob, shield: shield, party: party, inCombat: inCombat, tk: tk, esc: esc };
})();
