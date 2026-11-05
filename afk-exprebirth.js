/* ============================================================================
 * afk-exprebirth.js — 轉生後經驗藥水、料理無效（玩家 2026-11-05 15:14；開關 exprebirth，預設開；經典模式沒有轉生，不受影響）
 *
 *   轉生前：所有增加狩獵經驗的效果照舊。
 *   轉生後（player.rebirth ≥ 1）：藥水、料理這類「喝／吃下去的經驗倍率」不再生效；
 *     魔法娃娃的經驗、符文「豐」、聖紋「Y」、組隊加成照樣有效（新手加成本來就只有轉生前）。
 *   做法：把天堂透視鏡物品的經驗倍率（__afkTtmiExpMult 最底層）在轉生後當成 1；符文、聖紋包在它外面，照乘。
 *   藥水照樣可以喝（不擋），物品說明加一句「轉生後無效」。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'exprebirth', name: '轉生後經驗藥水無效', group: '遊戲玩法', seal: true,
    desc: '轉生後，增加狩獵經驗的藥水、料理不再生效（魔法娃娃、符文、聖紋、組隊加成照樣有效）' });
  var on = function () { return !T || T.enabled('exprebirth'); };
  var reborn = function (p) { return !!(p && !p.classicMode && (Number(p.rebirth) || 0) >= 1); };
  if (typeof W.__afkTtmiExpMult === 'function') {
    var o = W.__afkTtmiExpMult;
    W.__afkTtmiExpMult = function (p) { if (on() && reborn(p)) return 1; return o.apply(this, arguments); };
  }
  var NOTE = '（轉生後無效）';
  var mark = function () {
    try {
      Object.keys(DB.items).forEach(function (id) {
        var d = DB.items[id]; if (!d || !d.ttmiBuff || !(Number(d.ttmiBuff.ttmiExpMult) > 1)) return;
        if (String(d.d || '').indexOf(NOTE) < 0) d.d = String(d.d || '') + NOTE;
      });
    } catch (e) {}
  };
  if (on()) { mark(); W.addEventListener('load', mark); }
  W.__afkExpRebirth = { reborn: reborn, on: on, NOTE: NOTE };
})();
