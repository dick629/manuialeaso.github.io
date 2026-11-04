/* ============================================================================
 * afk-fglag.js — 前景跟不上時照常重畫（玩家 2026-11-04 17:49 手機：「遊戲流暢度怎感覺卡卡的 打怪沒有動畫 怪物也不會動」；開關 fglag，預設開）
 *
 *   原因（核心 js/03 gameLoop）：每 100ms 跑一刻，只要欠 2 刻以上就走「補跑」：state.ff、catchupActive() 為真
 *     → 怪物格子不重畫、怪物待機／攻擊／受擊動畫（js/09 每 1/8 秒的動畫計時器）、傷害飄字、技能特效、音效、存檔全部停住，
 *       要等債務還清才收尾重畫一次。手機上一刻＋重畫超過 100ms（8 人隊伍＋寵物＋遺物，CPU 慢 4 倍時一刻 45～90ms）
 *       → 債務永遠還不完，整段遊戲都在補跑：怪物定格、沒有攻擊動畫。F5、換地圖都一樣。
 *   修法（核心補丁 patchFgLag）：前景、欠 2～30 刻（含寄放）時（window.__afkFgLag 回 true）：
 *     ‧補跑照樣靜音快跑（收益、速度跟原本補跑一樣；這段補跑標成 _ffAcc.fg）；怪物動畫計時器在這種補跑中照跑；
 *     ‧每 0.3 秒一次（window.__afkFgShow）：沒跑完的整刻寄放在這裡（__afkFgCarryPut），最後一刻照一般路徑跑（有攻擊動畫、
 *       特效、音效），收尾重畫（_ffFinishCatchup：怪物格子、飄字、補印掉落日誌）；下一次 gameLoop 一開始把寄放的加回去
 *       （__afkFgCarryTake）——一刻都不少。寄放期間 catchupActive() 為假，存檔照常。
 *   不介入：外掛關掉、背景分頁、核心 queueCatchupMs 排入的背景補跑（從背景回來）、欠超過 30 刻（含寄放）→ 原樣補跑。
 *   診斷：window.__afkFgLagStats（calls 介入次數、shows 收尾重畫次數、carryMax 最大寄放毫秒）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fglag', name: '前景跟不上時照常重畫', group: '效能', seal: true,
    desc: '手機跑不動時不再整段卡在「補跑」：怪物動畫、攻擊特效、傷害數字照常顯示（進度一刻都不少）' });
  var on = function () { return !T || T.enabled('fglag'); };
  var WINDOW = 30;     // 刻；超過＝真的落後很多（或從背景回來），交給原本的補跑
  var SHOW_MS = 300;   // 補跑中每隔多久收尾重畫一次
  var stats = W.__afkFgLagStats = { calls: 0, shows: 0, carryMax: 0 };
  var lastShow = 0;
  var now = function () { return (W.performance && performance.now) ? performance.now() : Date.now(); };
  var carry = 0;
  var bg = false;    // 核心排入的背景補跑：下一次一定走原本的補跑

  W.__afkFgCarryPut = function (ms) { ms = Number(ms); if (isFinite(ms) && ms > 0) { carry += ms; if (carry > stats.carryMax) stats.carryMax = carry; } };
  W.__afkFgCarryTake = function () { var c = carry; carry = 0; return c; };
  W.__afkFgShow = function () { var t = now(); if (t - lastShow < SHOW_MS) return false; lastShow = t; stats.shows++; return true; };
  W.__afkFgLag = function (owed) {
    if (bg) { bg = false; return false; }
    if (!on()) return false;
    owed = Math.floor(Number(owed) || 0);
    if (owed < 2 || owed > WINDOW) return false;
    stats.calls++;
    return true;
  };

  var wrapQueue = function () {
    if (typeof W.queueCatchupMs !== 'function' || W.queueCatchupMs.__afkFg) return;
    var o = W.queueCatchupMs;
    var f = function () { var r = o.apply(this, arguments); if (r) bg = true; return r; };
    f.__afkFg = true; W.queueCatchupMs = f;
    try { (0, eval)('queueCatchupMs = window.queueCatchupMs'); } catch (e) {}
  };
  // 核心把債務歸零的地方（重新啟動計時器、停止、重新錨定時鐘：換角色、讀檔、bfcache 回來）寄放的也一起清掉
  var wrapReset = function (name) {
    if (typeof W[name] !== 'function' || W[name].__afkFg) return;
    var o = W[name];
    var f = function () { carry = 0; bg = false; return o.apply(this, arguments); };
    f.__afkFg = true; W[name] = f;
    try { (0, eval)(name + ' = window.' + name); } catch (e) {}
  };
  var install = function () { wrapQueue(); wrapReset('startGameTimers'); wrapReset('stopGameTimers'); wrapReset('_resetGameLoopClock'); };
  install();
  W.addEventListener('load', install);
})();
