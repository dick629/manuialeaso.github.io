/* ============================================================================
 * afk-geniewish.js — 巨靈的三個願望：每一只都要有自己的三個願望（玩家 2026-11-05 10:35「三個願望進化後沒顯示 + 哪三種能力」）
 *
 *   核心在「拿到 +0 的那一刻」才抽願望（gainItem，存在物品的 gw）。遺物合成／昇華支配做出來的、舊存檔、
 *   倉庫或傭兵退回時被併成一疊的，有可能沒有 gw → 物品說明不列願望、能力也沒加。
 *   ‧沒有願望的巨靈戒指（任何合成階段）補抽三個：用物品 uid 當種子，同一只戒指永遠抽到同樣三個（不能靠重新整理重抽）。
 *   ‧背包、身上、傭兵、倉庫裡的都補。
 *   ‧一疊共用一組願望；從一疊拿一只出來穿上也帶著同樣的願望。
 *   ‧願望不同的兩只戒指不會再被併成一疊（物品簽章加上願望）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var BASE = 'relic_genie_wishes';
  var POOL = ['hp60', 'mp30', 'md3', 'rd3', 'mdmg2', 'sp6', 'hpr10', 'mpr5', 'dr3', 'ac3', 'mr6', 'str1', 'dex1', 'int1', 'wis1', 'con1', 'cha1'];   // 與核心 gainItem 同一張表
  var isGenie = function (it) { return !!(it && typeof it.id === 'string' && (it.id === BASE || it.id.indexOf(BASE + '~') === 0)); };
  var hash = function (s) { s = String(s || ''); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  var rng = function (seed) { var t = seed >>> 0; return function () { t = (t + 0x6D2B79F5) | 0; var x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  var roll = function (it) {
    var r = rng(hash('geniewish|' + (it.uid || it.id))), pool = POOL.slice(), out = [];
    for (var k = 0; k < 3; k++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  var fix = function (it) {
    if (!isGenie(it)) return false;
    if (Array.isArray(it.gw) && it.gw.length) return false;
    if (!it.uid && typeof uid === 'function') it.uid = uid();
    it.gw = roll(it);
    return true;
  };
  var sweep = function () {
    var p = (typeof player !== 'undefined' && player) ? player : null; if (!p) return 0;
    var n = 0;
    (p.inv || []).forEach(function (it) { if (fix(it)) n++; });
    var eq = p.eq || {}; for (var k in eq) if (fix(eq[k])) n++;
    (p.allies || []).forEach(function (a) { if (!a) return; (a.inv || []).forEach(function (it) { if (fix(it)) n++; }); var e = a.eq || {}; for (var j in e) if (fix(e[j])) n++; });
    if (n) { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} }
    return n;
  };
  // 願望不同就不是同一種東西：簽章加上願望（只影響巨靈戒指）
  if (typeof W.itemSig === 'function' && !W.itemSig.__afkGenie) {
    var oSig = W.itemSig;
    var sig = function (it) {
      var s = oSig.apply(this, arguments);
      return (it && Array.isArray(it.gw) && it.gw.length && isGenie(it)) ? s + '|gw:' + it.gw.join(',') : s;
    };
    sig.__afkGenie = true; W.itemSig = sig;
    try { (0, eval)('itemSig = window.itemSig'); } catch (e) {}
  }
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () { var r = oLoad.apply(this, arguments); try { sweep(); } catch (e) {} return r; };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }
  // 倉庫裡的也要補（在倉庫看說明、取出來都要有願望）：讀倉庫時補上，有補到就寫回一次
  if (typeof W.loadWarehouse === 'function') {
    var oWh = W.loadWarehouse;
    W.loadWarehouse = function () {
      var w = oWh.apply(this, arguments);
      try {
        var n = 0; (w && Array.isArray(w.items) ? w.items : []).forEach(function (it) { if (fix(it)) n++; });
        if (n && typeof _whLoadOk !== 'undefined' && _whLoadOk !== false && typeof saveWarehouse === 'function') saveWarehouse(w);
      } catch (e) {}
      return w;
    };
    try { (0, eval)('loadWarehouse = window.loadWarehouse'); } catch (e) {}
  }
  setInterval(function () { try { if (!document.hidden) sweep(); } catch (e) {} }, 3000);
  W.__afkGenieWish = { sweep: sweep, roll: roll, fix: fix };
})();
