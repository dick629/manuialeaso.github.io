/* ============================================================================
 * afk-trackfind.js — 魔物追蹤：直接輸入名稱搜尋（玩家 2026-11-04 10:16）
 *
 *   奧貝勒／赫特／帝倫的追蹤視窗最上面多一個搜尋欄：輸入魔物名稱（部分文字即可），
 *   列出所有可追蹤地區裡名字相符的魔物「魔物名 — 地區」，點一下就幫你選好地區和那隻魔物。
 *   只是幫忙選，追蹤費用、規則照舊（頭目照原本的限制）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'trackfind', name: '魔物追蹤：名稱搜尋', group: '介面', desc: '追蹤 NPC 視窗可以直接輸入魔物名稱搜尋' });
  if (T && !T.enabled('trackfind')) return;
  if (typeof W.renderObelNPC !== 'function') return;
  var q = '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var maps = function () { try { return (typeof obelMapList === 'function') ? obelMapList() : []; } catch (e) { return []; } };
  var search = function (txt) {
    var out = [], seen = {};
    txt = String(txt || '').trim(); if (!txt) return out;
    maps().forEach(function (m) {
      var ids = (DB.maps && DB.maps[m.v]) || [];
      ids.forEach(function (id) {
        var mb = DB.mobs[id]; if (!mb || !mb.n || mb.n.indexOf(txt) < 0) return;
        var k = id + '@' + m.v; if (seen[k]) return; seen[k] = 1;
        out.push({ id: id, n: mb.n, lv: mb.lv, boss: !!mb.boss, map: m.v, mapName: m.t });
      });
    });
    return out.slice(0, 60);
  };
  var pick = function (map, id) {
    try {
      (0, eval)('_obelSel.map = ' + JSON.stringify(map) + '; _obelSel.mob = "";');
      if (typeof W.onObelMobToggle === 'function') W.onObelMobToggle(id);
      else { var el = document.getElementById('interaction-content'); if (el) W.renderObelNPC(el); }
    } catch (e) { console.warn('[AFK-trackfind]', e); }
  };
  var listHtml = function () {
    var r = search(q);
    if (!q.trim()) return '';
    if (!r.length) return '<div class="text-slate-500 text-xs px-1">找不到名稱含「' + esc(q) + '」的魔物</div>';
    return r.map(function (x) {
      return '<button type="button" class="afk-tf-pick text-left w-full py-1 px-2 rounded hover:bg-sky-900/50 text-sm" data-map="' + esc(x.map) + '" data-id="' + esc(x.id) + '">'
        + '<span class="' + (typeof getMobColor === 'function' ? getMobColor(x.lv) : '') + '">' + esc(x.n) + '</span>'
        + (x.boss ? ' <span class="text-xs text-rose-300">頭目</span>' : '')
        + ' <span class="text-xs text-slate-400">— ' + esc(x.mapName) + '</span></button>';
    }).join('');
  };
  var paintList = function (box) { var l = box.querySelector('.afk-tf-list'); if (l) l.innerHTML = listHtml(); };
  var inject = function (div) {
    if (!div || div.querySelector('#afk-tf-box')) return;
    var p = (typeof player !== 'undefined') ? player : null;
    if (p && p.tracking && p.tracking.until > Date.now()) return;   // 追蹤中不顯示
    var sel = div.querySelector('select'); if (!sel) return;
    var box = document.createElement('div');
    box.id = 'afk-tf-box';
    box.className = 'flex flex-col gap-1';
    box.innerHTML = '<input id="afk-tf-input" type="search" placeholder="🔍 輸入魔物名稱搜尋" class="w-full bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded text-sm" value="' + esc(q) + '">'
      + '<div class="afk-tf-list max-h-48 overflow-y-auto flex flex-col bg-slate-800/40 rounded"></div>';
    sel.parentNode.insertBefore(box, sel);
    paintList(box);
    var inp = box.querySelector('#afk-tf-input');
    inp.addEventListener('input', function () { q = inp.value; paintList(box); });
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('.afk-tf-pick'); if (!b) return;
      pick(b.getAttribute('data-map'), b.getAttribute('data-id'));
    });
  };
  var oR = W.renderObelNPC;
  W.renderObelNPC = function (div) {
    var hadFocus = document.activeElement && document.activeElement.id === 'afk-tf-input';
    var r = oR.apply(this, arguments);
    try { inject(div); if (hadFocus) { var i = document.getElementById('afk-tf-input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } } catch (e) { console.warn('[AFK-trackfind]', e); }
    return r;
  };
  try { (0, eval)('renderObelNPC = window.renderObelNPC'); } catch (e) {}
  W.__afkTrackFind = { search: search, pick: pick };
})();
