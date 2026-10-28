/* ============================================================================
 * afk-batchopen.js — 禮盒、袋子一次開多個（玩家 2026-10-28：不用一直點，也不會卡）
 *
 * 物品視窗的「使用」下面多兩顆按鈕：「開 10 個」「全部開啟」。
 * 適用：會開出東西的盒子／袋子（天堂透視鏡的禮盒類、魔法娃娃的袋子／盒子、歐西里斯／庫庫爾坎寶箱）；
 *   有冷卻的封印盒、要自選的券、藥水與卷軸不適用。
 * 做法：照樣一個一個呼叫遊戲本身的「使用」，但開的期間先不重畫畫面、不存檔、不逐筆寫系統訊息，
 *   每 100 個讓畫面喘一口氣；開完只重畫一次、存一次，系統訊息列出這次總共拿到什麼。
 *   開到一半東西用完、或某次沒有扣到（例如寶箱沒有鑰匙），就停下來。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'batchopen', name: '禮盒一次開多個', group: '遊戲介面',
    desc: '物品視窗多「開 10 個」「全部開啟」：禮盒、袋子、寶箱一次開完，最後列出總共拿到的東西' });
  if (T && !T.enabled('batchopen')) return;
  if (typeof W.openModal !== 'function' || typeof W.useItem !== 'function') { console.warn('[AFK-batchopen] 找不到物品視窗，略過'); return; }

  var EFFS = { doll_bag: 1, doll_box_high: 1, osiris_box: 1 };
  var eligible = function (d) { return !!d && !d.noUse && ((d.ttmiAction === 'box' && !d.ttmiBoxCooldown) || !!EFFS[d.eff]); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var counts = function (p) { var m = {}; (p.inv || []).forEach(function (it) { if (it && it.id) m[it.id] = (m[it.id] || 0) + (it.cnt || 1); }); return m; };
  var running = false;
  var QUIET = ['renderTabs', 'updateUI', 'saveGame', 'logSys'];

  var run = function (uid, want) {
    var p = P(); if (!p || running) return;
    var it = p.inv.find(function (x) { return x.uid === uid; }), d = it && DB.items[it.id];
    if (!it || !eligible(d) || it.lock) return;
    if (p.dead) { try { logSys('死亡狀態無法使用道具，請先復活。'); } catch (e) {} return; }
    var id = it.id, total = Math.min(want, it.cnt || 1), done = 0;
    var before = counts(p), gold0 = Number(p.gold) || 0, saved = {}, lastMsg = '';
    running = true;
    var btns = document.querySelectorAll('[data-afk-bo]'); btns.forEach(function (b) { b.disabled = true; });
    var label = document.querySelector('[data-afk-bo="all"]');
    var quiet = function (on) {
      QUIET.forEach(function (k) {
        if (on) { saved[k] = W[k]; W[k] = k === 'logSys' ? function (h) { lastMsg = h; } : function () {}; }
        else if (saved[k]) W[k] = saved[k];
      });
    };
    var finish = function () {
      quiet(false); running = false;
      var after = counts(p), gains = [];
      Object.keys(after).forEach(function (k) { if (k === id) return; var dv = after[k] - (before[k] || 0); if (dv > 0) gains.push([k, dv]); });
      gains.sort(function (a, b) { return b[1] - a[1]; });
      var gold = (Number(p.gold) || 0) - gold0;
      var list = gains.map(function (g) { var dd = DB.items[g[0]] || {}; return '<span class="' + (dd.c || 'text-slate-200') + '">' + esc(dd.n || g[0]) + '</span> ×' + g[1].toLocaleString(); });
      if (gold > 0) list.unshift('<span class="text-yellow-300">金幣</span> ×' + gold.toLocaleString());
      try {
        logSys('開啟了 <span class="' + (d.c || 'text-amber-200') + ' font-bold">' + esc(d.n) + '</span> ×' + done.toLocaleString() + '：' + (list.length ? list.join('、') : '沒有拿到東西') + '。'
          + (done < total && lastMsg ? '<span class="text-slate-400">（停在第 ' + (done + 1) + ' 個：' + String(lastMsg).replace(/<[^>]+>/g, '') + '）</span>' : ''));
      } catch (e) {}
      try { renderTabs(); } catch (e) {} try { updateUI(); } catch (e) {} try { saveGame(); } catch (e) {}
      var left = p.inv.find(function (x) { return x.uid === uid; }) || p.inv.find(function (x) { return x.id === id && !x.lock; });
      try { if (left) openModal(left, false); else closeModal(); } catch (e) {}
    };
    var step = function () {
      quiet(true);
      try {
        for (var k = 0; k < 100 && done < total; k++) {
          var cur = p.inv.find(function (x) { return x.uid === uid; }) || p.inv.find(function (x) { return x.id === id && !x.lock; });
          if (!cur) { total = done; break; }
          uid = cur.uid;
          var c0 = counts(p)[id] || 0;
          W.useItem(cur.uid, false, true);
          if ((counts(p)[id] || 0) >= c0) { total = done; break; }   // 沒有扣到（缺鑰匙、條件不符）→ 停
          done++;
        }
      } catch (e) { console.warn('[AFK-batchopen]', e); total = done; }
      quiet(false);
      if (done < total) { if (label) label.textContent = '開啟中… ' + done + '／' + total; setTimeout(step, 0); }
      else finish();
    };
    step();
  };
  W.afkBatchOpen = run;

  var oOpen = W.openModal;
  W.openModal = function (item, isEq) {
    var r = oOpen.apply(this, arguments);
    try {
      var d = item && DB.items[item.id];
      if (!isEq && eligible(d) && !item.lock && (item.cnt || 1) > 1) {
        var box = document.getElementById('modal-actions'), use = box && box.querySelector('button[onclick^="useItem("]');
        if (use && !box.querySelector('[data-afk-bo]')) {
          var n = item.cnt || 1, cls = 'btn border-sky-700 bg-sky-900 hover:bg-sky-800 text-sky-100 py-2 text-base font-bold';
          use.insertAdjacentHTML('afterend',
            '<button type="button" data-afk-bo="10" class="' + cls + '" onclick="afkBatchOpen(\'' + item.uid + '\',10)">開 ' + Math.min(10, n) + ' 個</button>'
            + '<button type="button" data-afk-bo="all" class="' + cls + '" onclick="afkBatchOpen(\'' + item.uid + '\',' + n + ')">全部開啟（' + n.toLocaleString() + '）</button>');
        }
      }
    } catch (e) {}
    return r;
  };
  console.log('[AFK-batchopen] 已載入：禮盒一次開多個');
})();
