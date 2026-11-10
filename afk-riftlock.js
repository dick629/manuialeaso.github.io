/* afk-riftlock.js — 次元裂縫相關 NPC 的資格鎖（Ping 11-07 21:08）
 *   還沒達到開放條件（完成二次轉生、打贏終焉第三階層）時：
 *   席琳神殿的「裂縫之門」「次元的鍛造師」「星鑄師 艾琳娜」顯示成灰色，點了只會看到開放條件，看不到裡面的內容。
 *   條件跟席琳的祈禱介面「踏進次元裂縫」按鈕共用 __afkDimRift.canOpen（afk-dimrift.js）。
 *   載入順序：放在 afk-zodiac / afk-riftdungeons / afk-dimrelic 之後，才能最先攔到 interactNPC。
 */
(function () {
  'use strict';
  var W = window;
  var LOCK = { npc_afk_riftgate: 1, npc_afk_dimsmith: 1, npc_afk_elena: 1 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var why = function () {
    var p = P(), DR = W.__afkDimRift;
    if (!p || !DR || typeof DR.canOpen !== 'function') return '';
    try { return DR.canOpen(p) || ''; } catch (e) { return ''; }
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var npcDef = function (id) {
    try { var t = DB.towns || {}; for (var k in t) { var l = (t[k] && t[k].npcs) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; } } catch (e) {}
    return null;
  };
  W.__afkRiftLocked = why;

  // 點 NPC：沒資格就只顯示開放條件
  if (typeof W.interactNPC === 'function') {
    var oI = W.interactNPC;
    W.interactNPC = function (id) {
      var w = LOCK[id] ? why() : '';
      if (w) {
        var n = npcDef(id) || { n: '', title: '' };
        var html = '<div class="p-3 text-sm leading-relaxed text-slate-300">'
          + '<div class="font-bold text-slate-400 mb-2">🔒 尚未開放</div>'
          + '<div>這裡和次元裂縫有關，達到開放條件後才能使用。</div>'
          + '<div class="mt-2 text-amber-300">開放條件：完成二次轉生，並打贏終焉第三階層。</div>'
          + '<div class="mt-1 text-slate-400">目前：' + esc(w) + '</div>'
          + '<div class="mt-2 text-slate-500 text-xs">詳細內容可以先在小百科查看。</div></div>';
        if (typeof W.openTownFloatWindow === 'function') { try { W.openTownFloatWindow(n.n, '尚未開放', function (div) { if (div) div.innerHTML = html; }); return; } catch (e) {} }
        try { var box = document.getElementById('interaction-content'); if (box) box.innerHTML = html; } catch (e) {}
        return;
      }
      return oI.apply(this, arguments);
    };
    try { (0, eval)('interactNPC = window.interactNPC'); } catch (e) {}
  }

  // 城鎮地圖：沒資格的 NPC 顯示灰色
  if (typeof W.renderTownNPCMap === 'function') {
    var oT = W.renderTownNPCMap;
    W.renderTownNPCMap = function (townId) {
      var r = oT.apply(this, arguments);
      try {
        if (why()) {
          var names = {};
          ((DB.towns[townId] && DB.towns[townId].npcs) || []).forEach(function (n) { if (LOCK[n.id]) names[n.n + '|' + n.title] = 1; });
          document.querySelectorAll('#town-npc-map .town-npc').forEach(function (el) {
            var nm = el.querySelector('.tn-name'), tt = el.querySelector('.tn-title');
            if (nm && names[nm.textContent + '|' + (tt ? tt.textContent : '')]) { el.style.filter = 'grayscale(1)'; el.style.opacity = '.45'; el.title = '尚未開放：完成二次轉生，並打贏終焉第三階層'; if (tt) tt.textContent = '尚未開放'; }
          });
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('renderTownNPCMap = window.renderTownNPCMap'); } catch (e) {}
  }
})();
