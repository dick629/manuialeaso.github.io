/* ==========================================================================
 * afk-returnfast.js — 回城不卡（玩家 2026-10-27：回城畫面停 ~0.5 秒）
 *
 * 量測（玩家存檔、7 名傭兵）：回城的 changeMap 裡，「依最新存檔刷新全部隊員」（refreshAllAllies）
 * 佔了九成——逐名讀來源存檔重建戰力快照、結算傭兵經驗，最後當場存檔（開著存檔即時壓縮時還要壓一次）。
 * 這些都跟「畫面切到村莊」無關，卻跟換畫面擠在同一段，於是整個畫面停住。
 *
 * 做法：玩家「主動」回城／傳送進安全區時（changeMap 沒帶 force），先把村莊畫面換好、讓瀏覽器畫出來，
 * 下一個空檔再刷新隊員（內容與時機點以外完全照舊：結算後立刻存檔、刷新完重算一次能力與畫面）。
 *   ‧載入存檔、死亡復活等內部流程（force）照舊同步刷新，不改變任何既有順序。
 *   ‧排程期間如果已經離開安全區，就不刷新——等下次進安全區再一起結算（經驗留在帳上，不會遺失也不會重複）。
 *   ‧排程期間關分頁：刷新還沒做＝經驗還沒結算，存檔裡仍是未結算的帳，下次照常結算（不會重複入帳）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof W.changeMap !== 'function' || typeof W.refreshAllAllies !== 'function') { console.warn('[AFK-returnfast] 找不到 changeMap / refreshAllAllies，略過'); return; }
  if (W.changeMap.__afkReturnFast) return;
  var inTown = function () { try { return typeof mapState !== 'undefined' && String(mapState.current || '').indexOf('town_') === 0; } catch (e) { return false; } };
  var deferOn = 0, pending = false, st = { deferred: 0, ran: 0, skipped: 0 };

  var oRefresh = W.refreshAllAllies;
  var run = function () {
    pending = false;
    if (!inTown()) { st.skipped++; return; }
    var n = 0;
    try { n = oRefresh.apply(W, []); } catch (e) {}
    st.ran++;
    try { if (player && player.allies) player.allies.forEach(function (a) { if (a) a.mp = a.mmp; }); } catch (e) {}   // 照 changeMap 安全區分支：隊員 MP 補滿
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    return n;
  };
  W.refreshAllAllies = function () {
    if (!deferOn) return oRefresh.apply(this, arguments);
    if (!pending) {
      pending = true; st.deferred++;
      // 先讓這一幀畫出村莊，再在下一個空檔刷新
      var go = function () { setTimeout(run, 0); };
      try { if (typeof requestAnimationFrame === 'function' && !document.hidden) requestAnimationFrame(go); else go(); } catch (e) { go(); }
    }
    return 0;
  };
  W.refreshAllAllies.__afkReturnFast = true;

  var oCM = W.changeMap;
  W.changeMap = function (force) {
    if (force) return oCM.apply(this, arguments);
    deferOn++;
    try { return oCM.apply(this, arguments); } finally { deferOn--; }
  };
  W.changeMap.__afkReturnFast = true;

  W.__afkReturnFast = { stats: function () { return Object.assign({ pending: pending }, st); }, flush: function () { if (pending) return run(); } };
  console.log('[AFK-returnfast] 已啟用：回城先換畫面，隊員刷新延到下一個空檔');
})();
