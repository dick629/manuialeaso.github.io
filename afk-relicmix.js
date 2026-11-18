/* ============================================================================
 * afk-relicmix.js — 遺物武器特效混合（Ping 11-18 18:01）
 *
 *   A. 繼承（資料在 afk-relicplus 的 inheritMix）：
 *      共鳴：fxResonance＝這把也算共鳴武器；觸發機率減半（戰鬥中判定時一半的機會不算）。
 *      魔擊：relicMagicStrike＋fxMagicStrike；觸發機率減半。
 *      攻擊施法：第二觸發槽 procSkill2（核心本來就有，機率在繼承時已減半）。
 *   B. 連鎖：共鳴、魔擊、攻擊施法打出的傷害，命中後可以再觸發這三種各一次（只連 1 層，機率是平常的一半）。
 *      目前只做你本人（傭兵的出手函式另外一套，之後再接）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined') return;
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var defOf = function (id) { return id && DB.items[id] ? DB.items[id] : null; };

  // ── A：共鳴 ──
  var hookRes = function () {
    var o = W.isResonanceWeapon; if (typeof o !== 'function' || W.__afkMixRes) return; W.__afkMixRes = true;
    var f = function (item) {
      if (o.apply(this, arguments)) return true;
      var id = typeof item === 'string' ? item : item && item.id, d = defOf(id);
      try { if (typeof W.__afkDimRes === 'function' && W.__afkDimRes(id)) return true; } catch (e) {}   // 次元遺物魔杖 +2
      if (!d || !d.fxResonance) return false;
      return S().inTick ? Math.random() < d.fxResonance : true;   // 戰鬥判定時一半機會（＝機率減半）；畫面顯示照算是共鳴武器
    };
    f.__afkMix = true; W.isResonanceWeapon = f; try { (0, eval)('isResonanceWeapon = window.isResonanceWeapon'); } catch (e) {}
  };
  // ── A：魔擊（你本人走 magicStrikeProc；傭兵走 AFK_RELIC_WEAPON_BRIDGE.magicStrikeChance）──
  var hookMs = function () {
    var o = W.magicStrikeProc;
    if (typeof o === 'function' && !W.__afkMixMs) {
      W.__afkMixMs = true;
      var f = function () {
        try { var w = player && player.eq && player.eq.wpn, d = w && defOf(w.id); if (d && d.fxMagicStrike && d.eff !== 'magicstrike' && Math.random() >= d.fxMagicStrike) return; } catch (e) {}
        return o.apply(this, arguments);
      };
      f.__afkMix = true; W.magicStrikeProc = f; try { (0, eval)('magicStrikeProc = window.magicStrikeProc'); } catch (e) {}
    }
    var B = W.AFK_RELIC_WEAPON_BRIDGE;
    if (B && typeof B.magicStrikeChance === 'function' && !B.magicStrikeChance.__afkMix) {
      var oc = B.magicStrikeChance;
      B.magicStrikeChance = function (a, d) { var v = oc.apply(this, arguments); try { if (d && d.fxMagicStrike && d.eff !== 'magicstrike') v = v * d.fxMagicStrike; } catch (e) {} return v; };
      B.magicStrikeChance.__afkMix = true;
    }
  };

  // ── B：連鎖 ──
  var inProc = false, chain = false;
  var PROCS = ['wandLightArrowProc', 'magicStrikeProc', 'weaponSpellProc'];
  var runChain = function (t) {
    chain = true;
    try {
      PROCS.forEach(function (n) {
        if (!t || !(t.curHp > 0) || (player && player.dead)) return;
        if (Math.random() >= 0.5) return;   // 連鎖的機率是平常的一半
        try { W[n](t); } catch (e) {}
      });
    } finally { chain = false; }
  };
  var hookChain = function () {
    PROCS.forEach(function (n) {
      var o = W[n]; if (typeof o !== 'function' || (W.__afkMixCh = W.__afkMixCh || {})[n]) return; W.__afkMixCh[n] = true;
      var f = function (t) {
        if (inProc || chain || (player && player.classicMode)) return o.apply(this, arguments);
        var tg = t && typeof t === 'object' ? t : null, hp0 = tg ? Number(tg.curHp) : NaN, r;
        inProc = true;
        try { r = o.apply(this, arguments); } finally { inProc = false; }
        try { if (tg && isFinite(hp0) && Number(tg.curHp) < hp0 && tg.curHp > 0) runChain(tg); } catch (e) {}
        return r;
      };
      f.__afkChain = true; W[n] = f; try { (0, eval)(n + ' = window.' + n); } catch (e) {}
    });
  };
  // ── 追擊（11-18 18:24）：遺物詞綴沒有可繼承的特效時給 relicChase（%）；一般攻擊後照機率再打一次（全身相加）──
  var chaseOf = function (a) { var t = 0; try { Object.keys(a.eq || {}).forEach(function (k) { var it = a.eq[k], d = it && defOf(it.id); if (d && d.relicChase) t += Number(d.relicChase) || 0; }); } catch (e) {} return t; };
  var hookChase = function () {
    var o = W.playerAttack;
    if (typeof o === 'function' && !W.__afkMixChase) {
      W.__afkMixChase = true;
      var f = function () {
        var r = o.apply(this, arguments);
        try { var x; if (!W.__afkChasing && player && !player.dead && (x = chaseOf(player)) > 0 && Math.random() * 100 < x) { W.__afkChasing = true; try { o.apply(this, arguments); } finally { W.__afkChasing = false; } } } catch (e) { W.__afkChasing = false; }
        return r;
      };
      W.playerAttack = f; try { (0, eval)('playerAttack = window.playerAttack'); } catch (e) {}
    }
    var oa = W.allyAttackOnce;
    if (typeof oa === 'function' && !W.__afkMixChaseA) {
      W.__afkMixChaseA = true;
      var fa = function (ally) {
        var r = oa.apply(this, arguments);
        try { var x; if (ally && !ally.__afkChase && !ally._downed && (x = chaseOf(ally)) > 0 && Math.random() * 100 < x) { ally.__afkChase = true; try { oa.apply(this, arguments); } finally { ally.__afkChase = false; } } } catch (e) {}
        return r;
      };
      W.allyAttackOnce = fa; try { (0, eval)('allyAttackOnce = window.allyAttackOnce'); } catch (e) {}
    }
  };
  var hookAll = function () { hookRes(); hookMs(); hookChain(); hookChase(); };
  hookAll(); W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); });
  W.__afkRelicMix = { inChain: function () { return chain; } };
})();
