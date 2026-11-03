/* ============================================================================
 * afk-itemui.js — 物品資訊窗點外面就關＋特殊物品固定淡光（玩家 2026-10-27：參考舒適版的兩個小改善）
 *
 * ① 點空白關閉：物品資訊窗（#item-modal，含右邊的比較窗）開著時，點到窗外任何地方就關掉。
 *    點到另一件物品＝先關再開那一件（核心的 onclick 照常跑）；
 *    窗內按鈕、確認對話框、其他浮窗（強化、批次設定、提示框…）裡面的點擊不算「窗外」。
 * ② 固定淡光：遺物、傳說、祝福、詛咒、遠古、屬性、席琳結晶等特殊物品的圖示，背後多一層靜態的淡色光暈
 *    （純背景漸層，沒有動畫、沒有濾鏡）。開了省電模式「關光暈」時，原本的呼吸光整個消失、看不出哪件特殊；
 *    這層固定淡光還在，一眼就分得出來，也幾乎不耗效能。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) {
    T.register({ id: 'clickaway', name: '點窗外關閉物品資訊', desc: '物品資訊／比較窗開著時，點窗外任何地方就關掉', group: '遊戲介面' });
    T.register({ id: 'staticglow', name: '特殊物品固定淡光', desc: '遺物、傳說、祝福、遠古、屬性等圖示背後多一層靜態淡光（關光暈時也看得出來）', group: '遊戲介面' });
  }
  var on = function (id) { return !T || T.enabled(id); };

  // ── ① 點空白關閉 ──
  // 這些地方裡面的點擊不關資訊窗：資訊窗本身、確認／提示對話框、各種浮窗（id 以 -modal／-overlay 結尾或 role=dialog）
  var KEEP = '#item-modal, [role="dialog"], [aria-modal="true"], [id$="-modal"], [id$="-overlay"], .afk-ui-confirm, .afk-ca-overlay, #rp-modal, #afk-hb-modal';
  var visible = function (el) { return !!(el && !el.classList.contains('hidden') && el.getClientRects().length); };   // fixed 定位的 offsetParent 是 null，改看有沒有畫在畫面上
  document.addEventListener('pointerdown', function (e) {
    if (!on('clickaway')) return;
    var m = document.getElementById('item-modal'); if (!visible(m)) return;
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest(KEEP)) return;
    if (e.button !== undefined && e.button !== 0) return;   // 只認左鍵／觸控
    try { if (typeof W.closeModal === 'function') W.closeModal(); else m.classList.add('hidden'); } catch (err) {}
  }, true);

  // ── ② 固定淡光：直接畫在圖示 <img> 的背景（透明處透出），任何顯示圖示的地方都適用 ──
  var g = function (c, a) { return 'radial-gradient(circle at 50% 55%,rgba(' + c + ',' + a + ') 0%,rgba(' + c + ',' + (a * 0.4).toFixed(2) + ') 42%,transparent 72%)'; };
  var RULES = [
    ['relic-glow', g('76,201,240', 0.42)],
    ['legend-glow', g('245,180,60', 0.42)],
    ['mana-glow', g('96,165,250', 0.42)],
    ['bless-glow', g('250,215,90', 0.34)],
    ['bless-glow-strong', g('250,215,90', 0.46)],
    ['curse-glow', g('220,60,60', 0.38)],
    ['ancient-glow', g('170,110,240', 0.34)],
    ['ancient-glow-strong', g('170,110,240', 0.46)],
    ['anc-bless-glow', g('170,110,240', 0.34) + ',' + g('250,215,90', 0.22)],
    ['tri-glow', 'radial-gradient(circle at 35% 45%,rgba(250,215,90,.32),transparent 55%),radial-gradient(circle at 65% 45%,rgba(170,110,240,.32),transparent 55%),radial-gradient(circle at 50% 70%,rgba(76,201,240,.28),transparent 60%)'],
    ['sherine-glow-icon', g('110,231,140', 0.38)]
  ];
  var css = RULES.map(function (r) { return 'body.afk-static-glow img.' + r[0] + '{background-image:' + r[1] + ';border-radius:4px}'; });
  [['fr', '239,90,60'], ['wa', '70,150,240'], ['wi', '90,210,140'], ['ea', '214,160,80']].forEach(function (x) {
    for (var t = 1; t <= 5; t++) css.push('body.afk-static-glow img.attr-glow-' + x[0] + t + '{background-image:' + g(x[1], (0.18 + t * 0.05).toFixed(2)) + ';border-radius:4px}');
  });
  var st = document.createElement('style'); st.id = 'afk-itemui-css'; st.textContent = css.join('\n');
  var root = document.head || document.documentElement; if (root && root.appendChild) root.appendChild(st);
  var sync = function () { try { if (document.body) document.body.classList.toggle('afk-static-glow', on('staticglow')); } catch (e) {} };
  if (document.body) sync(); else if (document.addEventListener) document.addEventListener('DOMContentLoaded', sync);
  if (T && typeof T.set === 'function') { var oSet = T.set; T.set = function () { var r = oSet.apply(this, arguments); sync(); return r; }; }
  W.AFK_ITEMUI = { sync: sync };
})();
