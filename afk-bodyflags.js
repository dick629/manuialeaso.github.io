/* ============================================================================
 * afk-bodyflags.js — 用 body 上的 class 取代融合版 CSS 的 body:has(...)（效能，11-11）
 *
 *   body:has(...) 會讓「整頁任何地方一變動」就重算整頁樣式；戰鬥畫面每 0.1 秒都在變，掛機時很吃效能。
 *   這裡改成：只在需要時（元素出現／消失、class 改變）重新判斷一次，結果寫成 body 的 class，CSS 改看 class。
 *     afk-f-ingame   ＝ #game-screen 存在且沒有 .hidden
 *     afk-f-modal    ＝ 設定、狀態、提示等全畫面視窗開著
 *     afk-f-ovl      ＝ 屬性說明、天賦巔峰、職業 這三種大視窗開著
 *     afk-f-classov  ＝ 職業視窗開著且不是內嵌模式
 * ========================================================================== */
(function () {
  'use strict';
  var d = document, MODAL = '#afk-toggles-overlay,#afk-ms-overlay,#afk-ps-overlay,#afk-pwa-notice,#afk-radio-menu,#afk-stg-menu.open,#m-fsv-modal.open,#m-stg-modal.open,#m-hist-modal.open,#m-diag-modal.open,#m-rid-modal.open,#m-mobname-modal.open,#afk-alert-modal.open,#afk-confirm-modal.open';
  var set = function (c, on) { var b = d.body; if (b && b.classList.contains(c) !== on) b.classList.toggle(c, on); };
  var sync = function () {
    queued = false; if (!d.body) return;
    var gs = d.getElementById('game-screen'), co = d.getElementById('class-overlay');
    set('afk-f-ingame', !!(gs && !gs.classList.contains('hidden')));
    set('afk-f-modal', !!d.querySelector(MODAL));
    set('afk-f-ovl', !!(d.getElementById('attribute-help') || d.getElementById('growth-overlay') || co));
    set('afk-f-classov', !!(co && !co.classList.contains('class-embedded')));
  };
  var queued = false;
  var q = function () { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(sync); } };
  var start = function () {
    sync();
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'childList' ? m.target === d.body || (m.target.id === 'lm-detail') : (m.target.id && (m.target.id === 'game-screen' || m.target.id === 'class-overlay' || /modal|menu/.test(m.target.id)))) { q(); return; }
        }
      }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    setInterval(sync, 2000);   // 保險：漏掉的情況兩秒內也會對上
  };
  if (d.body) start(); else d.addEventListener('DOMContentLoaded', start);
})();
