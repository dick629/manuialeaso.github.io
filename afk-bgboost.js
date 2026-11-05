/* ============================================================================
 * afk-bgboost.js — 背景落後時多算一點（玩家 2026-11-05 19:31「好」）
 *
 *   分頁在背景時，核心只靠 Worker 每秒喚醒一次主迴圈，每次最多算 80ms（FF_BUDGET_MS）。
 *   一刻超過約 8ms（大存檔、電腦同時在跑別的遊戲）就跟不上，欠的時間越積越多，回到畫面要補跑很久。
 *   這裡在同一個 Worker 喚醒之後：還欠超過 1 秒時，再多跑幾次主迴圈，每秒合計最多約 300ms（多約三成核心）。
 *   沒落後就什麼都不做（背景耗電與原本相同）。仍是逐刻真實結算，收益一刻都不多不少。開關 bgboost（效能）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bgboost', name: '背景落後時多算一點', group: '效能', seal: true,
    desc: '分頁在背景、遊戲跟不上時，多用一點電腦效能追上進度（回到畫面不用補跑那麼久）' });
  var on = function () { return !T || T.enabled('bgboost'); };
  var EXTRA_MS = 220;      // 核心那次 80ms 之外再多算的上限（每秒合計約 300ms）
  var BEHIND_MS = 1000;    // 欠超過這麼多才加算
  var TICK = 100;
  var stats = W.__afkBgBoostStats = { wakes: 0, boosts: 0, loops: 0 };
  var debt = function () { try { return (typeof _tickDebt !== 'undefined') ? (+_tickDebt || 0) : 0; } catch (e) { return 0; } };
  var boost = function () {
    stats.wakes++;
    if (!on() || typeof document === 'undefined' || !document.hidden) return;
    if (typeof state === 'undefined' || !state || !state.running || typeof player === 'undefined' || !player || player.dead) return;
    if (typeof gameLoop !== 'function' || debt() < BEHIND_MS) return;
    stats.boosts++;
    var t0 = performance.now(), d;
    while ((d = debt()) >= TICK && performance.now() - t0 < EXTRA_MS) {
      if (!state.running || player.dead || !document.hidden) break;
      gameLoop(); stats.loops++;
      if (debt() >= d) break;   // 沒有進展（例如補跑出錯停下）就不硬跑
    }
    // 追平了：把背景延後的存檔補寫（跟核心 Worker 喚醒同一條規則）
    try { if (debt() < TICK && typeof takeCatchupSaveRequest === 'function' && takeCatchupSaveRequest() && typeof saveGame === 'function') saveGame(); } catch (e) {}
  };
  var hook = function () {
    var w = (typeof _bgHeartbeatWorker !== 'undefined') ? _bgHeartbeatWorker : null;
    if (!w || w.__afkBgBoost) return !!w;
    w.__afkBgBoost = true;
    w.addEventListener('message', function () { try { boost(); } catch (e) {} });   // 排在核心 onmessage 之後
    return true;
  };
  if (!hook()) { var n = 0, iv = setInterval(function () { if (hook() || ++n > 30) clearInterval(iv); }, 1000); }
  W.__afkBgBoost = { boost: boost, debt: debt };
})();
