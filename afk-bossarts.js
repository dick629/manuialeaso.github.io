/* ============================================================================
 * afk-bossarts.js — 頭目秘技（玩家 2026-11-03；外掛開關 bossarts，預設開；經典模式不套用）
 *
 *   範圍：副本、席琳夢域鏡、終焉裡的頭目。每隻頭目每 45 秒從下面四招隨機施放一招
 *   （被冰凍、暈眩、石化、沉睡、麻痺、魔法封印、真空時不施放，等解除後再放）。
 *     一、能量粉碎：隨機一名角色魔防 −400，5 秒；魔法屏障（法術或魔法卷軸）擋得下（擋下後屏障消失）
 *     二、汙濁之水：隨機一名角色 AC +400（變差），5 秒；魔法屏障擋得下
 *     三、汙濁之水（全體）：隊伍裡所有角色（你與傭兵）陷入全部負面狀態 3 秒，無法解除
 *     四、恐慌：隨機一名角色陷入全部負面狀態 10 秒，只有魔法相消術能解除
 *   「角色」＝你與傭兵（倒下的不算）。
 *   副本＝時空裂痕（含暗夢星迴）、龍的巢穴／最終決戰、軍王之室與底比斯／提卡爾祭壇（KING_ROOMS）、
 *        純頭目房（PURE_BOSS_MAPS）、黑暗妖精聖地、外掛副本（afk_ 開頭的地圖；木人場除外）——同 afk-bossdrain。
 *   全部負面狀態＝暈眩、冰凍、石化、麻痺、沉睡、沉默、魔法封印、中毒、灼燒、燙傷、邪靈之氣、弱化、疾病、目盲、
 *                藥水霜化、汙濁之水（治癒減半）、緩速、破壞盔甲（沿用核心既有狀態；持續傷害類本身不扣血）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossarts', name: '頭目秘技', group: '遊戲玩法', seal: true,
    desc: '副本、席琳夢域鏡、終焉的頭目每 45 秒施放一招：能量粉碎、汙濁之水、汙濁之水（全體）、恐慌' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };
  var on = function () { var p = P(); return (!T || T.enabled('bossarts')) && !!(p && !p.classicMode); };
  var CFG = { every: 450, mr: 400, ac: 400, shortTicks: 50, allTicks: 30, panicTicks: 100 };
  var KEYS = ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'silence', 'magicseal', 'poison', 'burn', 'scald', 'evilAura',
    'weaken', 'disease', 'blind', 'potionFrost', 'foulWater', 'slowAtk', 'armorBreak'];
  var ARTS = [
    { k: 'crush', n: '能量粉碎' },
    { k: 'foul', n: '汙濁之水' },
    { k: 'foulAll', n: '汙濁之水（全體）' },
    { k: 'panic', n: '恐慌' }
  ];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var mobName = function (m) { return '<span class="' + (typeof getMobColor === 'function' ? getMobColor(m.lv) : '') + '">' + esc(m.n) + '</span>'; };

  // ── 範圍 ──
  var SANCT = ['dark_elf_sanctuary', 'cursed_dark_elf_sanctuary', 'collapsed_elder_council_hall'];
  var instance = function () {
    try {
      var st = S(), c = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
      if (!c || c.indexOf('town_') === 0) return false;
      if (st.riftRun || st.dreamStar || st._afkFinal || st.antharas) return true;
      if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[c]) return true;
      if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(c) >= 0) return true;
      if (SANCT.indexOf(c) >= 0) return true;
      return /^afk_/.test(c) && c !== 'afk_dummy';
    } catch (e) { return false; }
  };
  var dream = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) { return false; } };
  var inScope = function () {
    try { var c = String(mapState.current || ''); if (!c || c.indexOf('town_') === 0 || c === 'afk_dummy') return false; } catch (e) { return false; }
    return instance() || dream() || !!S()._afkFinal;
  };

  // ── 隊伍 ──
  var isP = function (x) { return x === P(); };
  var alive = function (x) { return isP(x) ? (!x.dead && x.hp > 0) : (!!x && !x._downed && (x.curHp || 0) > 0); };
  var party = function () { var p = P(); if (!p) return []; return [p].concat(p.allies || []).filter(function (x) { return x && alive(x); }); };
  var who = function (x) { return isP(x) ? '你' : '協力·' + esc(x._allyName || '傭兵'); };
  var stOf = function (x) { return x.statuses || (x.statuses = {}); };
  var recalc = function (x) {
    try {
      if (isP(x)) { if (typeof calcStats === 'function') calcStats(); }
      else if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(x);
    } catch (e) {}
  };
  var shielded = function (x) { return !!(x.buffs && (x.buffs.sk_magic_shield || 0) > 0); };
  var useShield = function (x) {   // 與核心魔法屏障擋技能相同：屏障消失，3 秒內不能再放
    x.buffs.sk_magic_shield = 0; if (isP(x)) x.magicShieldCd = 3;
  };

  // ── 能力值：魔防 −400／AC +400 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var e = (typeof player !== 'undefined') ? player : null, t = now();   // 傭兵重算時 player 會暫時換成那名傭兵
        if (e && e.d) {
          if ((e._afkBaMr || 0) > t) e.d.mr = (Number(e.d.mr) || 0) - CFG.mr;
          if ((e._afkBaAc || 0) > t) e.d.ac = (Number(e.d.ac) || 0) + CFG.ac;
        }
      } catch (e2) {}
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }

  // ── 鎖定的負面狀態 ──
  // x._afkBaLock = { until: tick, cancel: true＝只有魔法相消術能解 }
  var applyLock = function (x) {
    var L = x._afkBaLock; if (!L) return;
    var left = L.until - now();
    if (left <= 0 || !alive(x)) { delete x._afkBaLock; return; }
    var st = stOf(x), changed = false;
    KEYS.forEach(function (k) {
      if (!((st[k] || 0) > 0)) changed = true;
      if ((st[k] || 0) < left) st[k] = left;
    });
    if (!(st.poisonTick > 0)) { st.poisonDmg = st.poisonDmg || 0; st.poisonTick = st.poisonTick || 0; }
    if (!st.armorBreakPct) st.armorBreakPct = 50;
    return changed;
  };
  var lock = function (x, ticks, cancel) {
    var L = x._afkBaLock, until = now() + ticks;
    if (L && L.until >= until && (L.cancel || !cancel)) return;   // 已有更久、而且一樣難解的
    x._afkBaLock = { until: Math.max(until, L ? L.until : 0), cancel: L ? (L.cancel && cancel) : !!cancel };
    applyLock(x); recalc(x);
  };
  var clearLock = function (x) {
    if (!x || !x._afkBaLock) return;
    var st = stOf(x);
    KEYS.forEach(function (k) { st[k] = 0; });
    delete x._afkBaLock; recalc(x);
  };
  // 魔法相消術：一次解一人（核心 teamCleanseOne）→ 那人如果中了恐慌，整組解掉
  if (typeof W.teamCleanseOne === 'function') {
    var oTCO = W.teamCleanseOne;
    W.teamCleanseOne = function (kinds) {
      var isCancel = Array.isArray(kinds) && kinds.indexOf('foulWater') >= 0 && kinds.indexOf('freeze') >= 0;
      if (isCancel) {
        var p = P(), panicked = p ? [p].concat(p.allies || []).filter(function (x) { return x && alive(x) && x._afkBaLock && x._afkBaLock.cancel; }) : [];
        if (panicked.length) {
          var m = panicked[0];
          clearLock(m);
          clog('<span class="text-emerald-300 font-bold">魔法相消術</span>驅散了' + who(m) + '的恐慌！');
          return m;
        }
      }
      return oTCO.apply(this, arguments);
    };
    try { (0, eval)('teamCleanseOne = window.teamCleanseOne'); } catch (e) {}
  }
  if (typeof W.teamHasCurableStatus === 'function') {   // 中了恐慌就算「有得解」：讓傭兵的自動相消會去解
    var oTHC = W.teamHasCurableStatus;
    W.teamHasCurableStatus = function (kinds) {
      if (Array.isArray(kinds) && kinds.indexOf('foulWater') >= 0 && kinds.indexOf('freeze') >= 0) {
        var p = P(); if (p && [p].concat(p.allies || []).some(function (x) { return x && alive(x) && x._afkBaLock && x._afkBaLock.cancel; })) return true;
      }
      return oTHC.apply(this, arguments);
    };
    try { (0, eval)('teamHasCurableStatus = window.teamHasCurableStatus'); } catch (e) {}
  }

  // ── 施放 ──
  var pick = function () { var l = party(); return l.length ? l[Math.floor(Math.random() * l.length)] : null; };
  var doArt = function (mob, k) {
    var a = ARTS.filter(function (x) { return x.k === k; })[0]; if (!a) return false;
    var head = mobName(mob) + ' 施放<span class="font-bold" style="color:#f472b6;">【' + a.n + '】</span>';
    if (k === 'foulAll') {
      var l = party(); if (!l.length) return false;
      l.forEach(function (x) { lock(x, CFG.allTicks, false); });
      clog(head + '，全隊陷入所有負面狀態 ' + (CFG.allTicks / 10) + ' 秒，無法解除！');
      return true;
    }
    var x = pick(); if (!x) return false;
    if (k === 'panic') {
      lock(x, CFG.panicTicks, true);
      clog(head + '，' + who(x) + '陷入恐慌：所有負面狀態 ' + (CFG.panicTicks / 10) + ' 秒，只有魔法相消術能解除！');
      return true;
    }
    if (shielded(x)) { useShield(x); clog(head + '，被' + who(x) + '的魔法屏障擋了下來。'); return true; }
    if (k === 'crush') { x._afkBaMr = now() + CFG.shortTicks; recalc(x); clog(head + '，' + who(x) + '的魔防 −' + CFG.mr + '（' + (CFG.shortTicks / 10) + ' 秒）！'); }
    else { x._afkBaAc = now() + CFG.shortTicks; recalc(x); clog(head + '，' + who(x) + '的 AC +' + CFG.ac + '（' + (CFG.shortTicks / 10) + ' 秒）！'); }
    return true;
  };
  var busy = function (m) {
    var s = m.st || {};
    return s.freeze > 0 || s.stun > 0 || s.stone > 0 || s.sleep > 0 || s.paralyze > 0 || s.magicseal > 0 || s.vacuum > 0;
  };
  var bossTick = function () {
    if (!on() || !inScope()) return;
    var p = P(); if (!p || p.dead) return;
    var t = now();
    (mapState.mobs || []).forEach(function (m) {
      if (!m || !m.boss || m._dead || !(m.curHp > 0) || m.trollPlayer) return;
      if (m._afkBaAt == null || m._afkBaAt - t > CFG.every) m._afkBaAt = t + CFG.every;
      if (t < m._afkBaAt || busy(m) || p.dead) return;
      m._afkBaAt = t + CFG.every;
      doArt(m, ARTS[Math.floor(Math.random() * ARTS.length)].k);
    });
  };
  // 到期：魔防／AC 還原、鎖定狀態維持
  var upkeep = function () {
    var p = P(); if (!p) return;
    var t = now();
    [p].concat(p.allies || []).forEach(function (x) {
      if (!x) return;
      if (!alive(x)) { if (x._afkBaLock) delete x._afkBaLock; }
      else if (x._afkBaLock) applyLock(x);
      var re = false;
      if (x._afkBaLock && x._afkBaLock.until - t > CFG.panicTicks) delete x._afkBaLock;   // 讀檔後時間軸重算：不留殘
      if (x._afkBaMr && (x._afkBaMr <= t || x._afkBaMr - t > CFG.shortTicks)) { delete x._afkBaMr; re = true; }
      if (x._afkBaAc && (x._afkBaAc <= t || x._afkBaAc - t > CFG.shortTicks)) { delete x._afkBaAc; re = true; }
      if (re) recalc(x);
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = now();
      try { return oTick.apply(this, arguments); }
      finally { try { if (now() !== t0) { bossTick(); upkeep(); } } catch (e) { console.warn('[AFK-bossarts] tick', e); } }
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  W.__afkBossArts = { CFG: CFG, KEYS: KEYS, ARTS: ARTS, on: on, inScope: inScope, instance: instance, doArt: doArt, lock: lock, clearLock: clearLock, bossTick: bossTick, upkeep: upkeep };
})();
