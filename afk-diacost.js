/* ============================================================================
 * afk-diacost.js — 服務費：龍之鑽石＋等比例金幣（玩家 2026-11-03 04:25）
 *
 *   比例照遺物合成：龍之鑽石 500 ＝ 金幣 5,000 萬（1 顆龍鑽配 10 萬金幣）。
 *   用到的地方（各外掛呼叫這裡）：
 *     密奧之卡升級 5,000／手環製作 10,000、升階 20,000→30,000（上限 30,000）／星途遠征進場 1,000（另加席琳結晶 1,000；夢域鏡再加夢艷結晶 1,000）／
 *     聖紋裝上 50,000、拆下 10,000／龍的印記、龍的傷痕賦予 500／符文師每項服務 5,000
 *   先檢查夠不夠，動作成功後才扣；不夠時回傳「還差多少」的說明。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, GOLD_PER = 100000;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var dia = function () { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var gold = function () { var p = P(); return p ? Math.max(0, Math.floor(Number(p.gold) || 0)) : 0; };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var goldOf = function (d) { return Math.round(d * GOLD_PER); };
  var txt = function (d) { return '龍之鑽石 ' + fmt(d) + '＋金幣 ' + fmt(goldOf(d)); };
  var off = function () { return !!W.__afkTestNoFee; };
  var check = function (d) {
    if (!(d > 0) || off()) return null;
    var miss = [], hd = dia(), hg = gold(), g = goldOf(d);
    if (hd < d) miss.push('龍之鑽石還差 ' + fmt(d - hd) + '（需要 ' + fmt(d) + '）');
    if (hg < g) miss.push('金幣還差 ' + fmt(g - hg) + '（需要 ' + fmt(g) + '）');
    return miss.length ? miss.join('；') : null;
  };
  var pay = function (d) {
    if (!(d > 0) || off()) return true;
    if (check(d)) return false;
    var r = null; try { r = W.pandoraAdjustSharedDiamonds(-d) || {}; } catch (e) { r = {}; }
    if (!r.ok) return false;
    var p = P(); if (p) p.gold = gold() - goldOf(d);
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    return true;
  };
  W.__afkDiaCost = { GOLD_PER: GOLD_PER, check: check, pay: pay, txt: txt, goldOf: goldOf, have: function () { return { dia: dia(), gold: gold() }; },
    COST: { mioUp: 5000, braceMake: 10000, braceUp: [20000, 30000, 30000], starroad: 1000, starroadCrystal: 1000, sigilOn: 50000, sigilOff: 10000, dmark: 500, rune: 5000 } };
})();
