/* ============================================================================
 * afk-balance1102.js — 玩家 2026-11-02 15:20 同意的戰鬥平衡（外掛開關 balance1102，預設開；經典模式不套用）
 *
 *   C. 技能遞減
 *      ‧三重矢在席琳夢域鏡一次 10 箭：命中的第 1～3 箭全額，第 4 箭起每箭 −10%（第 10 箭剩 30%）。
 *      ‧幻影箭：同一個人 1 秒內連續觸發，第 2 次起每次 −30%（最低 10%）。
 *   D. 新手保障：角色 Lv1～49、還沒轉生 → 經驗 +50%、金幣 +30%、藥水回復 +30%（轉生後沒有）。
 *   E. 隊伍人數：9 人以上，每多 1 人，怪物的 HP 與造成的傷害各 +7%（16 人 ×1.56）。
 *      人數變動時，場上的怪物跟著調整（目前 HP 照比例）；木人場不套用。
 *
 *   F. 月光 5 件「碎裂」（23:58）：原本讓怪物 AC −10（更難命中，跟名字相反）→ 改成 AC +10（更容易被命中）；核心補丁 92 讀 __afkShatterAc。
 *      經典模式維持原本。月光、夢域月光（血月）的套裝說明跟著改。
 *   （A. 持續傷害上限在 afk-relicplus.js／afk-relic-runtime.js；技藝領域強化在 afk-arts.js）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'balance1102', name: '11/02 戰鬥平衡（三重矢遞減、新手保障、大隊伍怪物強化）', group: '遊戲玩法', seal: true,
    desc: '夢域鏡三重矢第 4 箭起遞減；Lv1～49（未轉生）經驗 +50%、金幣 +30%、藥水 +30%；9 人以上每多 1 人怪物 HP 與傷害 +7%（16 人 ×1.56）' });
  var on = function () { return !T || T.enabled('balance1102'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var act = function () { return on() && P() && !classic(); };
  var tk = function () { return (typeof state !== 'undefined' && state && state.ticks) || 0; };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function') return false; var o = W[name]; W[name] = mk(o); try { (0, eval)(name + ' = window.' + name); } catch (e) {} return true; };
  var mirror = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) { return false; } };

  // ── C-1 三重矢：夢域鏡 10 箭遞減 ──
  var TRI = { id: 'sk_elf_triple', full: 3, step: 0.10, min: 0.30 };
  var tri = null;   // { a: 施放者, n: 已命中箭數 }
  var triMult = function (n) { return n <= TRI.full ? 1 : Math.max(TRI.min, 1 - TRI.step * (n - TRI.full)); };
  var withTri = function (actor, sid, fn, self, args) {
    if (!(act() && sid === TRI.id && mirror())) return fn.apply(self, args);
    var prev = tri; tri = { a: actor, n: 0 };
    try { return fn.apply(self, args); } finally { tri = prev; }
  };
  wrapG('castSkillInner', function (o) { return function (skId) { return withTri(P(), skId, o, this, arguments); }; });
  wrapG('allyCastPhysicalSkill', function (o) { return function (ally, sk) { var sid = (sk && typeof DB !== 'undefined' && DB.skills && sk === DB.skills[TRI.id]) ? TRI.id : null; return withTri(ally, sid, o, this, arguments); }; });
  W.__afkTripleArrowMult = function (actor, opt) {
    if (!tri || tri.a !== actor || (opt && opt.second)) return 1;
    tri.n++; return triMult(tri.n);
  };

  // ── C-2 幻影箭：1 秒內連發遞減 ──
  var PH = { win: 10, step: 0.30, min: 0.10 };
  var phLog = new WeakMap();
  W.__afkPhantomDecay = function (actor) {
    if (!act() || !actor) return 1;
    var t = tk(), list = (phLog.get(actor) || []).filter(function (x) { return t - x < PH.win; });
    var m = Math.max(PH.min, 1 - PH.step * list.length);
    list.push(t); phLog.set(actor, list);
    return m;
  };

  // ── D 新手保障 ──
  var NOV = { maxLv: 49, exp: 0.5, gold: 30, pot: 30 };
  var novice = function (p) { p = p || P(); return !!(act() && p === P() && (p.lv || 1) <= NOV.maxLv && !(p.rebirth > 0)); };
  W.__afkNoviceGuard = novice;
  wrapG('__afkTtmiExpMult', function (o) { return function (p) { var v = o.apply(this, arguments); try { if (novice(p)) v *= 1 + NOV.exp; } catch (e) {} return v; }; });
  wrapG('dollFieldVal', function (o) { return function (f) { var v = o.apply(this, arguments); try { if (f === 'goldBonus' && novice()) v = (Number(v) || 0) + NOV.gold; } catch (e) {} return v; }; });
  wrapG('playerEquipPotionBonusPct', function (o) { return function () { var v = o.apply(this, arguments); try { if (novice()) v = (Number(v) || 0) + NOV.pot; } catch (e) {} return v; }; });

  // ── E 隊伍人數：怪物 HP 與傷害 ──
  var PTY = { base: 8, per: 0.07, cap: 16 };   // 16 人 ×1.56（設計稿的數字；原寫「每人 +8%」算出來是 ×1.64，照 ×1.56 改成每人 +7%）
  var partySize = function () { var p = P(); return p ? Math.min(PTY.cap, 1 + (p.allies || []).filter(Boolean).length) : 1; };
  var ptyMult = function () { return act() ? 1 + PTY.per * Math.max(0, partySize() - PTY.base) : 1; };
  W.__afkPartyMobMult = ptyMult;
  var exempt = function (m) { return !m || m._train || m.isTrainingDummy || m._pvp || m.isPlayerClone; };
  var scaleMob = function (m, f) {
    if (exempt(m) || !(Number(m.hp) > 0)) return;
    var f0 = Number(m._afkPtyF) || 1; if (Math.abs(f0 - f) < 1e-9) return;
    var hp0 = Number(m.hp), cur = Number(m.curHp) || 0, nh = Math.max(1, Math.round(hp0 / f0 * f));
    m.hp = nh; if (cur > 0) m.curHp = Math.max(1, Math.min(nh, Math.round(cur / hp0 * nh)));
    m._afkPtyF = f;
  };
  W.__afkPartyScaleMob = scaleMob;
  wrapG('tick', function (o) {
    return function () {
      var r = o.apply(this, arguments);
      try {
        if (typeof mapState === 'undefined' || !mapState || !mapState.mobs) return r;
        var f = ptyMult();
        for (var i = 0; i < mapState.mobs.length; i++) { var m = mapState.mobs[i]; if (m && !m._dead && (m.curHp > 0)) scaleMob(m, f); }
      } catch (e) {}
      return r;
    };
  });
  if (typeof W.__afkTaken === 'function') {
    var oT = W.__afkTaken;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = oT.apply(this, arguments);
      try { if (v > 0 && mob && !exempt(mob)) { var f = Number(mob._afkPtyF) || 1; if (f > 1 && act()) v = v * f; } } catch (e) {}
      return v;
    };
  }

  // ── B 王族單人（玩家 2026-11-02 16:41：單人拉到 4 分）：王族自己造成的直接傷害 ×ROYAL（隊長光環不變；持續傷害不算）──
  var DARK_DOT = 0.6;
  // ── 三重矢 MP 消耗 +50%（玩家 2026-11-02 19:15；經典模式照原本）──
  try {
    var TS = DB.skills && DB.skills[TRI.id];
    if (TS && typeof TS.mp === 'number') { var triMp0 = TS.mp; Object.defineProperty(TS, 'mp', { configurable: true, enumerable: true, get: function () { return act() ? Math.ceil(triMp0 * 1.5) : triMp0; }, set: function (v) { triMp0 = v; } }); }
  } catch (e) {}
  var ROYAL = { base: 2.0, reborn: 1.6 };   // 模擬校準：未轉生曲線 75～80 約 4 分；轉生（劍誓、號令）約 4 分
  var royalMult = function (a) { return (a && a.cls === 'royal' && act()) ? (a.rebirth > 0 ? ROYAL.reborn : ROYAL.base) : 1; };
  var hookR = false, hookRoyal = function () {
    var C = W.AFK_CARD_COMBAT; if (hookR || !C || typeof C.damage !== 'function') return; hookR = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { var k = opt && opt.kind; if (v > 0 && k !== 'dot' && !(opt && (opt.reflection || opt.redirected || opt.second))) { var m = royalMult(actor); if (m !== 1) v = Math.floor(v * m); } } catch (e) {}
      try { if (v > 0 && opt && opt.kind === 'dot' && actor && actor.cls === 'dark' && act()) v = Math.max(0, Math.floor(v * DARK_DOT)); } catch (e) {}   // 2026-11-02 19:15：黑暗妖精造成的持續傷害 ×0.6
      return v;
    };
  };
  hookRoyal(); W.addEventListener('load', hookRoyal);

  // ── F. 月光碎裂 ──
  var classic = function () { try { return !!(typeof player !== 'undefined' && player && player.classicMode); } catch (e) { return false; } };
  W.__afkShatterAc = function () { return on() && !classic() ? -10 : 10; };   // 核心是「減去」這個值
  var MOON_OLD = null, MOON_NEW = '5件：一般攻擊或技能造成傷害時，使目標「碎裂」3秒（AC+10，更容易被命中；最多1層，重複觸發刷新）';
  var moonText = function () {
    try {
      if (typeof SHERINE_SET_TEXT === 'undefined' || !SHERINE_SET_TEXT['月光']) return;
      var t = SHERINE_SET_TEXT['月光'];
      if (MOON_OLD == null) MOON_OLD = t[2];
      t[2] = on() && !classic() ? MOON_NEW : MOON_OLD;
    } catch (e) {}
  };
  moonText();
  if (typeof W.loadGame === 'function') { var oLoadMoon = W.loadGame; W.loadGame = function () { var r = oLoadMoon.apply(this, arguments); moonText(); return r; }; }
  setInterval(moonText, 5000);

  W.__afkBalance1102 = { on: on, TRI: TRI, triMult: triMult, PH: PH, NOV: NOV, novice: novice, PTY: PTY, partySize: partySize, ptyMult: ptyMult, ROYAL: ROYAL, royalMult: royalMult, DARK_DOT: DARK_DOT, moonText: moonText };
})();
