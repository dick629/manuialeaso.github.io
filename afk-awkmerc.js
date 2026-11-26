/* ============================================================================
 * afk-awkmerc.js — 覺醒職業當傭兵：核心的職業判斷一律當成原職業（Ping 11-18 20:02「製作完整版 每個職業都開放」）
 *
 *   原本核心不認得覺醒職業：傭兵只會普攻、數值照法師那一段算、各職業精通（巨斧、劍術、雙刀…）都吃不到。
 *   這裡在核心處理傭兵的期間（傭兵的每一拍、出手、施法、維持增益、被打、數值重算）把傭兵的 cls 暫時換成原職業，結束後換回來：
 *     雷神→法師、狂戰士→戰士、神聖劍士→騎士、暗黑騎士→黑暗妖精、魔劍士→龍騎士。
 *   存檔、名單、介面上看到的還是覺醒職業。覺醒職業自己的技能目前只有你本人有（傭兵沒有對應的掛點）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var CLS = function () { var A = W.__afkAwaken; return (A && A.CLS) || null; };
  var baseOf = function (c) { var M = CLS(); return M && M[c] && M[c].base ? M[c].base : null; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var isAlly = function (a) { var p = W.__afkAwkLeader || P(); return !!(a && p && a !== p && (p.allies || []).indexOf(a) >= 0); };
  var swap = function (a) { if (!a || a._awkSw) return false; var b = baseOf(a.cls); if (!b) return false; a._awkSw = a.cls; a.cls = b; return true; };
  var back = function (a) { if (a && a._awkSw) { a.cls = a._awkSw; delete a._awkSw; } };
  var leader = function () { var p = P(); return p && !p._awkSw ? p : null; };
  // 包住「第一個參數是傭兵」的函式
  var wrapAlly = function (n, idx) {
    var o = W[n]; if (typeof o !== 'function' || o.__afkAwkM) return;
    var f = function () {
      var a = arguments[idx], did = false;
      try { did = isAlly(a) && swap(a); } catch (e) {}
      try { return o.apply(this, arguments); } finally { if (did) back(a); }
    };
    f.__afkAwkM = true; W[n] = f; try { (0, eval)(n + ' = window.' + n); } catch (e) {}
  };
  // 傭兵的每一拍：整隊換、整隊換回
  var wrapTick = function () {
    var o = W.alliesTick; if (typeof o !== 'function' || o.__afkAwkM) return;
    var f = function () {
      var p = leader(), list = [];
      try { if (p) GiranPartyView.combatAllies(p).forEach(function (a) { if (a && swap(a)) list.push(a); }); } catch (e) {}
      try { return o.apply(this, arguments); } finally { list.forEach(back); }
    };
    f.__afkAwkM = true; W.alliesTick = f; try { (0, eval)('alliesTick = window.alliesTick'); } catch (e) {}
  };
  // 數值重算：核心重算傭兵時把 player 換成傭兵、_recomputingAlly＝true
  var wrapRe = function () {
    var o = W.recomputeStats; if (typeof o !== 'function' || o.__afkAwkM) return;
    var f = function () {
      var did = false, p = null;
      try { if (typeof _recomputingAlly !== 'undefined' && _recomputingAlly) { p = P(); did = swap(p); } } catch (e) {}
      try { return o.apply(this, arguments); } finally { if (did) back(p); }
    };
    f.__afkAwkM = true; W.recomputeStats = f; try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  };
  // 整個遊戲 tick 期間都換（各外掛有「每拍算一次」的快取，例如轉生技藝的人數上限；只包傭兵函式會被快取蓋掉）
  var wrapGameTick = function () {
    var o = W.tick; if (typeof o !== 'function' || o.__afkAwkM) return;
    var f = function () {
      var p = leader(), list = [];
      try { if (p) GiranPartyView.combatAllies(p).forEach(function (a) { if (a && swap(a)) list.push(a); }); } catch (e) {}
      try { return o.apply(this, arguments); } finally { list.forEach(back); }
    };
    f.__afkAwkM = true; W.tick = f; try { (0, eval)('tick = window.tick'); } catch (e) {}
  };
  // 傭兵經驗結算（待領紀錄要記覺醒職業，領取時才對得上）：結算當下先換回來
  var wrapSettle = function () {
    var o = W._settleAllyExp; if (typeof o !== 'function' || o.__afkAwkM) return;
    var f = function (a) { var sw = a && a._awkSw ? a.cls : null; if (sw) back(a); try { return o.apply(this, arguments); } finally { if (sw) swap(a); } };
    f.__afkAwkM = true; W._settleAllyExp = f; try { (0, eval)('_settleAllyExp = window._settleAllyExp'); } catch (e) {}
  };
  var hook = function () {
    if (!CLS()) return;
    wrapTick(); wrapRe(); wrapSettle();
    ['allyAttackOnce', 'allyCastMagic', 'allyCastNonDamage', 'allyCastPhysicalSkill', 'allyMaintainBuffs'].forEach(function (n) { wrapAlly(n, 0); });
    wrapAlly('enemyAttackAlly', 1);
    wrapAlly('applyMobMagicToAlly', 2);
  };
  hook(); W.addEventListener('load', function () { hook(); setTimeout(function () { hook(); wrapGameTick(); }, 2500); });
  setInterval(function () { try { var o = W.tick; if (typeof o === 'function' && !o.__afkAwkM && CLS()) wrapGameTick(); } catch (e) {} }, 5000);   // 之後有外掛再包一層 tick 時，重新包到最外面
  W.__afkAwkMerc = { swap: swap, back: back, baseOf: baseOf };
})();
