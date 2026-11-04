/* ============================================================================
 * afk-dimrift.js — 次元裂縫（夢域鏡再往上一階的難度；玩家 2026-11-04 16:57）
 *   現階段：席琳神殿的祈禱介面多一張「次元裂縫」卡，按鈕灰色、尚未開放。
 *   開放條件（設計稿 docs/dimension-rift-design.md）：二轉，並打贏終焉第三階層。
 *   window.__afkDimRiftOn() 目前一律 false（afk-riftsupply 傭兵吃裂痕藥水等功能看這個）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dimrift', name: '次元裂縫', group: '遊戲內容', seal: true,
    desc: '夢域鏡再往上一階的難度；目前只在席琳神殿顯示入口（尚未開放）' });
  if (T && !T.enabled('dimrift')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  if (typeof W.renderSherinePray !== 'function') return;
  var oPray = W.renderSherinePray;
  W.renderSherinePray = function (div) {
    var r = oPray.apply(this, arguments);
    try {
      var p = P(); if (!p || p.classicMode || !div || div.querySelector('#afk-dimrift-card')) return r;
      var box = div.querySelector('.flex.flex-col.gap-3') || div;
      box.insertAdjacentHTML('beforeend',
        '<div id="afk-dimrift-card" class="bg-slate-950/80 border border-slate-700 rounded p-3 text-sm leading-relaxed opacity-80">'
        + '<div class="font-bold mb-1 text-sky-200">🌀 次元裂縫：<span class="text-slate-400">尚未開放</span></div>'
        + '<div class="afk-lore">「縫的那一邊，還有別的天空。總有一天，得有人替我把它縫上。」——席琳</div>'
        + '<div class="text-slate-300 text-xs">比席琳夢域鏡更深的一層。開放條件：完成二次轉生，並打贏終焉第三階層。</div></div>'
        + '<button type="button" id="afk-dimrift-btn" class="btn py-3 text-base font-bold bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed" disabled title="尚未開放">🌀 踏進次元裂縫（尚未開放）</button>');
    } catch (e) { console.warn('[AFK-dimrift]', e); }
    return r;
  };
  try { (0, eval)('renderSherinePray = window.renderSherinePray'); } catch (e) {}
  if (typeof W.__afkDimRiftOn !== 'function') W.__afkDimRiftOn = function () { return false; };
  W.__afkDimRift = { open: function () { return false; } };
})();
