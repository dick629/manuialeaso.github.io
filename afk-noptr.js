/* ============================================================================
 * afk-noptr.js — 手機取消「下拉重新整理」（玩家 2026-11-05 20:28：快速強化時滑裝備，網頁常常自動重開）
 *
 * 手機版面由 #game-screen 單層捲動（afk-mobile）。捲到最上面再往下滑，捲動會「接力」傳給整個網頁，
 *   Chrome（Android）就把它當成下拉重新整理 → 整頁重開。滑背包、裝備清單時最容易誤觸。
 * 作法：#game-screen 與 html／body 的垂直 overscroll-behavior 設成不往外傳（contain／none）：
 *   ‧內層清單捲到底照樣接給 #game-screen（不影響原本的捲動），只是不再傳到網頁本身；
 *   ‧沒有下拉重新整理、也沒有網頁整頁回彈；要重新整理請用瀏覽器的重新整理鈕。
 * 只對觸控裝置（pointer: coarse）。開關 noptr（遊戲介面，預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'noptr', name: '手機取消下拉重新整理', group: '遊戲介面',
    desc: '手機上捲到最上面再往下滑時，不會觸發瀏覽器的下拉重新整理（避免滑背包時整頁重開）' });
  if (T && !T.enabled('noptr')) return;
  var init = function () {
    if (document.getElementById('afk-noptr-style')) return;
    var s = document.createElement('style'); s.id = 'afk-noptr-style';
    s.textContent = '@media (pointer: coarse){html,body{overscroll-behavior-y:none;}#game-screen{overscroll-behavior-y:contain;}}';
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
