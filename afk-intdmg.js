/* ============================================================================
 * afk-intdmg.js — 傷害與 HP 一律整數（玩家 2026-11-04：席琳恩賜頭目身上飄出「0.599999999996275」「3.200000000023523」；外掛開關 intdmg，預設開）
 *
 *   真正的原因修在源頭：
 *     ‧afk-procfx 的 dealt／taken 掛點：刻印（造成的傷害 +N%、血咒、蝕刻 ×1.5、尤之怒）、密奧之卡、聖紋都直接把傷害乘上百分比，
 *       結果沒取整數就扣到怪物（和你）身上 → 怪物 HP 帶小數，飄字用「上一幀 HP − 這一幀 HP」算傷害，就跑出 0.599999999996275。
 *     ‧afk-card-combat：封印減半的變身卡首擊倍率是 ×7.5、持續傷害補差額也可能帶小數。
 *   這支是最後一道保險（以後新加的倍率忘了取整數也不會再出現小數）：
 *     一、卡冊結算 AFK_CARD_COMBAT.damage 包最外層：回傳取整數；NaN／Infinity 當 0。
 *     二、每一刻結束：怪物、你、傭兵、寵物、召喚物、城堡護衛的 HP 有小數就進位（差不到 1 點；活著的不會因此變 0）；
 *         NaN／Infinity 換回上一次的整數值。怪物在畫面飄字前也再整理一次（飄字取樣在 tick 之後）。
 *     三、能力重算（你與傭兵）結束時 HP／MP 上限取整數（核心的 CON 成長每級帶小數，例如 14384.9375，畫面本來就只顯示整數）。
 *     四、傷害飄字：顯示前取整數；不是有限正數就不顯示。
 *   要排在所有會包 AFK_CARD_COMBAT.damage、tick、recomputeStats 的外掛之後（外掛層最後一支）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'intdmg', name: '傷害與 HP 取整數', group: '系統與其他',
    desc: '傷害、HP 一律整數，不再出現帶小數的傷害數字' });
  var on = function () { return !T || T.enabled('intdmg'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };

  // 傷害：有限正數取整數，其他（0、負的、NaN、Infinity）當 0
  var whole = function (v) { v = Number(v); if (!isFinite(v) || !(v > 0)) return 0; return Math.floor(v); };
  // HP：小數進位（浮點誤差 1e-6 內四捨五入）；NaN／Infinity 換回上一次的整數值
  var last = new WeakMap();
  var fixHp = function (o, key) {
    if (!o || typeof o !== 'object') return;
    var v = o[key]; if (typeof v !== 'number') return;
    var g = last.get(o);
    if (!isFinite(v)) {
      var b = g && g[key];
      o[key] = (typeof b === 'number' && isFinite(b)) ? b : 0;
      try { console.warn('[AFK-intdmg] ' + key + ' 不是有限數字（' + v + '），已還原為 ' + o[key]); } catch (e) {}
      return;
    }
    if (v !== Math.floor(v)) { var r = Math.round(v); v = Math.abs(v - r) < 1e-6 ? r : (v > 0 ? Math.ceil(v) : Math.floor(v)); o[key] = v; }
    if (!g) { g = {}; last.set(o, g); }
    g[key] = v;
  };
  W.__afkFixHp = fixHp;
  var fixMobs = function () { var ms = (typeof mapState !== 'undefined' && mapState && mapState.mobs) || []; for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m) { fixHp(m, 'curHp'); fixHp(m, 'hp'); } } };
  var each = function (list, key) { if (list && list.length) for (var i = 0; i < list.length; i++) fixHp(list[i], key); };
  var n = 0;
  var sweep = function () {
    fixMobs();
    var p = P(); if (!p) return;
    fixHp(p, 'hp');
    each(p.allies, 'curHp');
    each(p.summonsV2, 'hp');
    each(p.guardsV2, 'hp');
    if ((++n % 10) === 0 && typeof W.petsOutList === 'function') { try { each(W.petsOutList(), 'hp'); } catch (e) {} }
  };
  W.__afkIntSweep = sweep;

  // ── 一、卡冊結算最外層 ──
  var wrapDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkInt) return;
    var o = C.damage;
    var f = function () { var v = o.apply(this, arguments); return on() ? whole(v) : v; };
    f.__afkInt = true; C.damage = f;
  };

  // ── 二、每一刻結束 ──
  var wrapTick = function () {
    if (typeof W.tick !== 'function' || W.tick.__afkInt) return;
    var o = W.tick;
    var f = function () { var r = o.apply(this, arguments); try { if (on()) { wrapDamage(); sweep(); } } catch (e) {} return r; };
    f.__afkInt = true; W.tick = f;
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  };

  // ── 三、能力重算後 HP／MP 上限取整數（傭兵重算時全域 player 暫時是那個傭兵）──
  var wrapRecompute = function () {
    if (typeof W.recomputeStats !== 'function' || W.recomputeStats.__afkInt) return;
    var o = W.recomputeStats;
    var f = function () {
      var r = o.apply(this, arguments);
      try {
        var p = (typeof player !== 'undefined') ? player : null;
        if (on() && p && typeof p === 'object') {
          if (typeof p.mhp === 'number' && isFinite(p.mhp)) p.mhp = Math.max(1, Math.floor(p.mhp));
          if (typeof p.mmp === 'number' && isFinite(p.mmp)) p.mmp = Math.max(0, Math.floor(p.mmp));
          if (typeof p.hp === 'number' && p.hp > p.mhp) p.hp = p.mhp;
          if (typeof p.mp === 'number' && p.mp > p.mmp) p.mp = p.mmp;
          if (typeof p.curHp === 'number' && p.curHp > p.mhp) p.curHp = p.mhp;
        }
      } catch (e) {}
      return r;
    };
    f.__afkInt = true; W.recomputeStats = f;
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  };

  // ── 四、傷害飄字 ──
  var wrapVfx = function () {
    if (typeof W._vfxQueueDmg === 'function' && !W._vfxQueueDmg.__afkInt) {
      var oq = W._vfxQueueDmg;
      var fq = function (m) { try { if (on() && m) { fixHp(m, 'curHp'); fixHp(m, '_vfxHp'); } } catch (e) {} return oq.apply(this, arguments); };
      fq.__afkInt = true; W._vfxQueueDmg = fq;
      try { (0, eval)('_vfxQueueDmg = window._vfxQueueDmg'); } catch (e) {}
    }
    if (typeof W._vfxNumber === 'function' && !W._vfxNumber.__afkInt) {
      var on2 = W._vfxNumber;
      var fn = function (x, y, dmg) {
        if (on() && typeof dmg === 'number') { dmg = whole(dmg); if (!dmg) return; arguments[2] = dmg; }
        return on2.apply(this, arguments);
      };
      fn.__afkInt = true; W._vfxNumber = fn;
      try { (0, eval)('_vfxNumber = window._vfxNumber'); } catch (e) {}
    }
  };

  var install = function () { wrapDamage(); wrapTick(); wrapRecompute(); wrapVfx(); };
  install();
  // 其他外掛有些在 load 才包：load 之後再確認一次自己還在最外層（不在就再包一層，取整數兩次也一樣）
  W.addEventListener('load', function () { setTimeout(function () { install(); }, 0); });
})();
