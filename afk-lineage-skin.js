/* ==========================================================================
 * afk-lineage-skin.js — 新增系統的介面換上遊戲原生的天堂風格（玩家 2026-10-23 指定）
 *
 * 新增的面板（至幻者、卡冊、變身收集冊、奧拉奇里亞、哈瑪大師、夢域、暗夢星迴、裂痕補給、攻城）
 * 原本各自用現代網頁的藍灰配色；這裡統一改成遊戲本體的「炭灰面板＋銅邊＋金字」：
 *   面板＝--lineage-panel 漸層、銅色邊框與內陰影；標題＝暖金色、黑色字影；按鈕＝本體 .btn 的銅棕漸層。
 * 另外提供 .afk-lore（傳說引言）的排版：暖金褐色、左側銅線、細字距。
 * 純 CSS 覆寫，不改任何功能；最後載入，所以蓋得過各外掛自己注入的樣式。
 * ========================================================================== */
(function () {
  'use strict';
  if (document.getElementById('afk-lineage-skin')) return;
  var PANEL = 'linear-gradient(120deg,rgba(255,255,255,.025),transparent 28%,rgba(0,0,0,.07) 70%,rgba(255,255,255,.015)),linear-gradient(180deg,var(--lineage-panel,#302f39) 0%,#2a2933 55%,var(--lineage-panel-deep,#24232b) 100%)';
  var ROW = 'linear-gradient(180deg,#2b2830 0%,#211f26 100%)';
  var BTN = 'linear-gradient(180deg,#332c2c 0%,#211e22 55%,#17161a 100%)';
  var BTN_H = 'linear-gradient(180deg,#493a34 0%,#2c2527 58%,#1b181c 100%)';
  var BTN_ON = 'linear-gradient(180deg,#704b34 0%,#3f2c26 58%,#231b1c 100%)';
  var EDGE = '#765036', EDGE_L = '#a97a50', GOLD = '#e8c48a', INK = '#ddd8d2', SUB = '#b3aa9e';
  var css = [
    // 傳說引言
    '.afk-lore{color:#d8c08e;font-size:12.5px;line-height:1.7;letter-spacing:.04em;text-shadow:1px 1px 0 #000;border-left:2px solid #8a6040;padding:1px 0 1px 9px;margin:6px 0 9px}',
    // 至幻者／卡冊／變身收集冊／合成
    '.afk-ca-panel{background:' + PANEL + ';border:1px solid ' + EDGE + ';border-radius:.35rem;box-shadow:inset 0 0 0 1px rgba(12,10,12,.78),inset 0 1px rgba(220,177,116,.14),0 6px 12px rgba(0,0,0,.45);color:' + INK + ';margin:10px 0;border-top:1px solid ' + EDGE + '}',
    '.afk-ca-panel h3,.afk-ca-dialog h3{color:' + GOLD + ';text-shadow:1px 1px 0 #000;letter-spacing:.06em;border-bottom:1px solid #5a3b29;padding-bottom:5px}',
    '.afk-ca-panel p,.afk-ca-dialog p{color:' + SUB + '}',
    '.afk-ca-panel .afk-lore,.afk-ca-dialog .afk-lore{color:#d8c08e}',
    '.afk-ca-tier{background:' + ROW + ';border:1px solid #4e3526;border-radius:.25rem;box-shadow:inset 0 1px rgba(220,177,116,.07)}',
    '.afk-ca-tier small{color:#a39a8e}',
    '.afk-ca-overlay{background:rgba(8,6,8,.8)}',
    '.afk-ca-dialog{background:' + PANEL + ';border:2px solid ' + EDGE + ';border-radius:.35rem;color:' + INK + ';box-shadow:inset 0 0 0 1px rgba(12,10,12,.78),inset 0 1px rgba(220,177,116,.14),0 10px 26px rgba(0,0,0,.7)}',
    '.afk-ca-dialog header{border-bottom:1px solid #805839;margin-bottom:8px}.afk-ca-dialog header strong{color:' + GOLD + ';text-shadow:1px 1px 0 #000}',
    '.afk-ca-dialog header button{background:' + BTN + ';border:1px solid ' + EDGE + ';border-radius:.25rem;color:#f1ede8}',
    '.afk-ca-form span{color:#a39a8e!important}',
    '.afk-ca-search{background:#17161b!important;border:1px solid ' + EDGE + '!important;color:#ece6dc!important}',
    '#afk-poly-codex details{border-top:1px solid #3d2a20;padding:4px 0}#afk-poly-codex summary{color:' + INK + '}#afk-poly-codex summary b{color:' + GOLD + '}',
    // 奧拉奇里亞（轉生技藝）
    '.afk-arts-embed .card,#afk-arts-modal .card{background:' + ROW + '!important;border:1px solid #4e3526!important;border-radius:.25rem!important}',
    '.afk-arts-embed .card.on,#afk-arts-modal .card.on{border-color:#c29a67!important;box-shadow:0 0 8px rgba(194,154,103,.35)!important}',
    '.afk-arts-embed .card b,#afk-arts-modal .card b{color:' + GOLD + '!important;text-shadow:1px 1px 0 #000}',
    '.afk-arts-embed button,#afk-arts-modal button{background:' + BTN + '!important;border:1px solid ' + EDGE + '!important;border-radius:.25rem!important;color:#f1ede8!important}',
    '.afk-arts-embed button:hover:not([disabled]),#afk-arts-modal button:hover:not([disabled]){background:' + BTN_H + '!important;border-color:' + EDGE_L + '!important}',
    '#afk-arts-modal .box{background:' + PANEL + '!important;border:2px solid ' + EDGE + '!important;border-radius:.35rem!important;color:' + INK + '!important}',
    '#afk-arts-modal h3{color:' + GOLD + '!important}.afk-arts-embed .note,#afk-arts-modal .note{color:' + SUB + '!important}',
    // 哈瑪大師（遺物強化）
    '#rp-modal{background:rgba(8,6,8,.78)!important}',
    '.rp-box{background:' + PANEL + '!important;border:2px solid ' + EDGE + '!important;border-radius:.35rem!important;color:' + INK + '!important}',
    '.rp-embed .rp-box{background:transparent!important;border:0!important}',
    '.rp-head{background:linear-gradient(180deg,#302a29 0%,#211e22 48%,#17161b 100%)!important;border-bottom:1px solid #805839!important;color:' + GOLD + '!important;text-shadow:1px 1px 0 #000}',
    '.rp-embed .rp-head{background:transparent!important;border-bottom:1px solid #5a3b29!important}',
    '.rp-x{background:' + BTN + '!important;border:1px solid ' + EDGE + '!important;border-radius:.25rem!important;color:#f1ede8!important}',
    '.rp-rule,.rp-tools{border-bottom-color:#3d2a20!important;color:' + SUB + '!important}.rp-rule summary{color:' + GOLD + '!important}',
    '.rp-row{background:' + ROW + '!important;border:1px solid #4e3526!important;border-radius:.25rem!important}',
    '.rp-nm{color:#e9cf98!important}.rp-sub{color:#a39a8e!important}',
    '.rp-go,.rp-tools button,.rp-tools select{background:' + BTN + '!important;border:1px solid ' + EDGE + '!important;border-radius:.25rem!important;color:#f1ede8!important}',
    '.rp-go:hover:not([disabled]),.rp-tools button:hover:not([disabled]){background:' + BTN_H + '!important;border-color:' + EDGE_L + '!important}',
    '.rp-asc{background:' + BTN_ON + '!important;border-color:#c0935d!important;color:#fff3df!important}',
    // 哈瑪大師 2026-10-27 重排：工具列分成五張小卡、說明改表格（玩家：介面太突兀、說明字體要貼近遊戲）
    '.rp-head .rp-bal{display:flex;gap:6px;flex-wrap:wrap;font-size:12.5px!important;color:' + SUB + '!important;text-shadow:none}',
    '.rp-head .rp-bal span{background:#17161b;border:1px solid #4e3526;border-radius:.25rem;padding:2px 9px}',
    '.rp-head .rp-bal b{color:' + GOLD + ';font-variant-numeric:tabular-nums;margin-left:4px}',
    '.rp-tools{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px!important;align-items:stretch!important;padding:10px 0!important;font-size:13px!important;color:' + INK + '!important}',
    '.rp-sec{background:' + ROW + ';border:1px solid #4e3526;border-radius:.25rem;box-shadow:inset 0 1px rgba(220,177,116,.07);padding:8px 10px;display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.rp-sec.rp-wide{grid-column:span 2}','@media (max-width:640px){.rp-sec.rp-wide{grid-column:1/-1}}',
    '.rp-sec h4{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 2px;padding-bottom:4px;border-bottom:1px solid #3d2a20;color:' + GOLD + ';font-size:13.5px;font-weight:700;letter-spacing:.06em;text-shadow:1px 1px 0 #000}',
    '.rp-sec h4 small{color:#a39a8e;font-size:11.5px;font-weight:400;letter-spacing:0;text-shadow:none}',
    '.rp-kv{display:flex;align-items:center;gap:8px;color:' + SUB + ';font-size:12.5px}',
    '.rp-kv b{margin-left:auto;color:#f1ede8;font-size:14px;font-variant-numeric:tabular-nums}',
    '.rp-kv em{font-style:normal;color:#8f867b;font-size:11.5px}',
    '.rp-kv select{margin-left:auto}',
    '.rp-btns{display:flex;flex-wrap:wrap;gap:6px}',
    '.rp-tools .rp-btns button{min-height:32px!important;padding:3px 12px!important;font-size:13px!important;font-weight:700;letter-spacing:.04em;display:inline-flex;align-items:center;gap:6px}',
    '.rp-tools .rp-btns button small{color:' + GOLD + ';font-weight:400;font-size:12px;font-variant-numeric:tabular-nums}',
    '.rp-tools select{min-height:30px!important;font-size:13px!important;padding:2px 8px!important}',
    '.rp-chk{display:flex;align-items:center;gap:6px;color:' + INK + ';font-size:12.5px;cursor:pointer}.rp-chk input{accent-color:#a97a50;min-width:16px;min-height:16px}',
    '.rp-chips{display:flex;flex-wrap:wrap;gap:5px}.rp-chips span{background:#17161b;border:1px solid #3d2a20;border-radius:.25rem;padding:1px 8px;font-size:12px;color:' + SUB + '}.rp-chips b{color:#f1ede8;margin-left:3px}',
    '.rp-note{margin:0;color:#8f867b;font-size:12px;line-height:1.6}',
    '.rp-doc{padding:4px 2px 2px;font-size:13px;line-height:1.75;color:' + INK + '}',
    '.rp-doc h5{margin:10px 0 5px;color:' + GOLD + ';font-size:13px;letter-spacing:.06em;text-shadow:1px 1px 0 #000}',
    '.rp-tbl{width:100%;border-collapse:collapse;font-size:12.5px;background:#17161b;border:1px solid #3d2a20}',
    '.rp-tbl th{color:' + GOLD + ';font-weight:700;text-align:left;background:#211e22;border-bottom:1px solid #4e3526;padding:4px 8px}',
    '.rp-tbl td{padding:4px 8px;border-top:1px solid #2a2520;color:' + INK + ';vertical-align:top}.rp-tbl td:first-child{color:#e9cf98;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.rp-tbl small{display:block;color:#8f867b;font-size:11.5px}',
    '.rp-fee{margin:5px 0 0;color:' + SUB + ';font-size:12.5px}',
    '.rp-dl{margin:10px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px}.rp-dl dt{color:' + GOLD + ';font-weight:700;white-space:nowrap}.rp-dl dd{margin:0;color:' + SUB + '}',
    '@media (max-width:560px){.rp-dl{grid-template-columns:1fr}.rp-dl dd{margin-bottom:4px}}',
    '.rp-rule summary{font-size:13.5px;letter-spacing:.04em}',
    '.rp-nm{font-size:14.5px;letter-spacing:.02em;text-shadow:1px 1px 0 #000}',
    '.rp-go{min-width:118px;line-height:1.35}',
    // 失去光輝的碎片（哈瑪大師下方）
    '.afk-lost{margin-top:12px;background:' + PANEL + ';border:1px solid ' + EDGE + ';border-radius:.35rem;box-shadow:inset 0 0 0 1px rgba(12,10,12,.78),inset 0 1px rgba(220,177,116,.14);padding:10px 12px;color:' + INK + '}',
    '.afk-lost h3{display:flex;align-items:center;gap:8px;margin:0 0 4px;color:' + GOLD + ';font-size:14.5px;font-weight:700;letter-spacing:.06em;text-shadow:1px 1px 0 #000;border-bottom:1px solid #5a3b29;padding-bottom:5px}',
    '.afk-lost{margin:0 0 12px!important}.afk-lost.closed h3{margin:0;border-bottom:0;padding-bottom:0}.afk-lost.closed .afk-lost-body{display:none}',
    '.afk-lost-ready{font-style:normal;font-size:11.5px;font-weight:400;letter-spacing:0;color:#9bc48a;background:#17161b;border:1px solid #3d4a2e;border-radius:.25rem;padding:0 6px;text-shadow:none}',
    '.afk-lost-toggle{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:.04em;padding:2px 10px;min-height:26px;border-radius:.25rem;border:1px solid ' + EDGE + ';background:' + BTN + ';color:#f1ede8;cursor:pointer;text-shadow:none}.afk-lost-toggle:hover{background:' + BTN_H + ';border-color:' + EDGE_L + '}',
    '.afk-lost-rule{margin:6px 0;color:' + SUB + ';font-size:12.5px;line-height:1.7}.afk-lost-rule b{color:#f1ede8}',
    '.afk-lost-bal{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.afk-lost-bal span{background:#17161b;border:1px solid #4e3526;border-radius:.25rem;padding:2px 9px;font-size:12.5px;color:' + SUB + '}.afk-lost-bal b{color:' + GOLD + ';margin-left:4px;font-variant-numeric:tabular-nums}.afk-lost-bal b.afk-lost-low{color:#e57f6c}',
    '.afk-lost-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}',
    '.afk-lost-card{background:' + ROW + ';border:1px solid #4e3526;border-radius:.25rem;padding:6px 8px;display:flex;flex-direction:column;gap:4px}',
    '.afk-lost-card.ready{border-color:#7a5a3a}',
    '.afk-lost-nm{color:#e9cf98;font-size:13px;font-weight:700}',
    '.afk-lost-bar{height:4px;background:#17161b;border-radius:2px;overflow:hidden}.afk-lost-bar i{display:block;height:100%;background:linear-gradient(90deg,#7a5a3a,#d8b070)}',
    '.afk-lost-cnt{font-size:12px;color:' + SUB + ';display:flex;gap:6px;align-items:baseline}.afk-lost-cnt b{color:#f1ede8;font-variant-numeric:tabular-nums}.afk-lost-cnt em{margin-left:auto;font-style:normal;color:#9bc48a;font-size:11.5px}',
    '.afk-lost-btns{display:flex;gap:6px}.afk-lost-btns .btn{flex:1;min-height:30px;padding:2px 8px;font-size:12.5px;background:' + BTN + ';border:1px solid ' + EDGE + ';border-radius:.25rem;color:#f1ede8}',
    '.afk-lost-btns .btn:hover:not([disabled]){background:' + BTN_H + ';border-color:' + EDGE_L + '}.afk-lost-btns .btn[disabled]{opacity:.4;cursor:not-allowed}',
    // 席琳夢域鏡（席琳祈禱）、暗夢星迴入口
    '#afk-dream-card,#afk-ds-box>div{background:' + ROW + '!important;border:1px solid #6b3a4a!important;border-radius:.25rem!important;box-shadow:inset 0 1px rgba(244,114,182,.08)}',
    // 裂痕補給
    '.ttmi-rift-dialog{background:' + PANEL + '!important;border:2px solid ' + EDGE + '!important;border-radius:.35rem!important;color:' + INK + '!important}',
    // 攻城面板、血盟回城選單
    '#afk-castle-home{background:' + ROW + '!important;border:1px solid #4e3526!important;border-radius:.25rem!important}',
    '#afk-castle-home select{background:#17161b!important;border:1px solid ' + EDGE + '!important;color:#ece6dc!important}',
    // 變身光環：收斂發光，貼近原作較樸素的光暈
    '.afk-trans-aura{opacity:.72}.afk-trans-aura .ca-ring{box-shadow:0 0 4px var(--ca-gold),inset 0 0 6px var(--ca-shadow)!important}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'afk-lineage-skin'; st.textContent = css;
  var put = function () { (document.head || document.documentElement).appendChild(st); };
  put();
  // 其他外掛的樣式是在第一次開面板時才插入，插入後把這份移回最後面，確保優先
  try {
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) {
        var n = list[i].addedNodes[j]; if (n !== st && n.nodeName === 'STYLE') { if (document.head.lastElementChild !== st) document.head.appendChild(st); return; }
      }
    });
    mo.observe(document.head, { childList: true });
  } catch (e) {}
  console.log('[AFK-lineage-skin] 已啟用：新增系統介面套用天堂原生風格');
})();
