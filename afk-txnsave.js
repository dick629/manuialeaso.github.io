/* ============================================================================
 * afk-txnsave.js — 玩家操作的存檔不延後（玩家 2026-10-30 11:08：倉庫操作取消「角色進度無法安全儲存」）
 *
 * 原因：核心在「補跑」期間（離線補跑，或背景分頁被節流後一次補好幾拍：_tickDebt ≥ 100ms）會把 saveGame() 延後、回傳 false，
 *   避免補跑殺頭目時每殺一隻就整份存檔。但玩家自己按的操作——倉庫存取、寵物放生、建立血盟、遺物合成、變身卡升階……——
 *   都要求「這一下一定要存進去」，拿到 false 就整筆取消並顯示「倉庫操作取消：角色進度無法安全儲存」。
 *   剛回到遊戲（歡迎回來）或分頁剛切回前景時最容易撞上。
 * 改法：只有在遊戲迴圈「正在跑 tick」裡呼叫的存檔才延後（那才是補跑本身觸發的）；
 *   其他時候（玩家點按鈕觸發的存檔）一律照常寫入，用核心本來就有的「最終存檔」旗標 __fb5CloseFlush 繞過延後。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, depth = 0, bypassed = 0;
  var wrapTick = function () {
    if (typeof W.tick !== 'function' || W.tick.__afkTxnTick) return;
    var o = W.tick;
    W.tick = function () { depth++; try { return o.apply(this, arguments); } finally { depth--; } };
    W.tick.__afkTxnTick = true;
  };
  var wrapSave = function () {
    if (typeof W.saveGame !== 'function' || W.saveGame.__afkTxnSave) return;
    var o = W.saveGame;
    W.saveGame = function () {
      if (depth > 0 || W.__fb5CloseFlush) return o.apply(this, arguments);
      var busy = false; try { busy = typeof catchupActive === 'function' && catchupActive(); } catch (e) {}
      if (!busy) return o.apply(this, arguments);
      bypassed++;
      W.__fb5CloseFlush = true;
      try { return o.apply(this, arguments); } finally { W.__fb5CloseFlush = false; }
    };
    W.saveGame.__afkTxnSave = true;
  };
  wrapTick(); wrapSave();
  W.__afkTxnSave = { inTick: function () { return depth > 0; }, bypassed: function () { return bypassed; },
    _asTick: function (fn) { depth++; try { return fn(); } finally { depth--; } } };   // 測試用
})();
