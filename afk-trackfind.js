/* ============================================================================
 * afk-trackfind.js — 魔物追蹤：直接輸入名稱搜尋（玩家 2026-11-04 10:16）
 *
 *   奧貝勒／赫特／帝倫的追蹤視窗最上面多一個搜尋欄：輸入魔物名稱（部分文字即可），
 *   列出所有可追蹤地區裡名字相符的魔物「魔物名 — 地區」，點一下就幫你選好地區和那隻魔物。
 *   只是幫忙選，追蹤費用、規則照舊（頭目照原本的限制）。
 *   2026-11-06：結果改成「一隻魔物一筆、底下列出牠出現的地區」，完全相同的名字排最前、頭目放最後；
 *   按 Enter 直接選第一個；名字完全相同、只出現在一個地區時打完就自動選好；中文輸入法組字中不會打斷。
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
  // 名稱正規化：去空白、全形半形括號一致、大小寫不分
  var norm = function (t) { return String(t || '').replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase(); };
  // 回傳「魔物」清單（同一隻在很多地圖出現只算一筆，地圖列在底下）；排序：完全相同 > 開頭相同 > 包含；可追蹤的在前；再依等級
  var search = function (txt) {
    var key = norm(txt); if (!key) return [];
    var byId = {};
    maps().forEach(function (m) {
      var ids = (DB.maps && DB.maps[m.v]) || [];
      ids.forEach(function (id) {
        var mb = DB.mobs[id]; if (!mb || !mb.n) return;
        var nn = norm(mb.n), pos = nn.indexOf(key); if (pos < 0) return;
        var o = byId[id] || (byId[id] = { id: id, n: mb.n, lv: mb.lv, boss: !!mb.boss, rank: nn === key ? 0 : pos === 0 ? 1 : 2, maps: [], seen: {} });
        if (!o.seen[m.v]) { o.seen[m.v] = 1; o.maps.push({ v: m.v, t: m.t }); }
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) {
      return (a.boss - b.boss) || (a.rank - b.rank) || ((a.lv || 0) - (b.lv || 0)) || (a.n < b.n ? -1 : 1);
    }).slice(0, 40);
  };
  var pick = function (map, id) {
    try {
      (0, eval)('_obelSel.map = ' + JSON.stringify(map) + '; _obelSel.mob = "";');
      if (typeof W.onObelMobToggle === 'function') W.onObelMobToggle(id);
      else { var el = document.getElementById('interaction-content'); if (el) W.renderObelNPC(el); }
      // 選好後把那隻捲到看得到的地方
      setTimeout(function () { var c = document.querySelector('#interaction-content input[type=checkbox]:checked'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }, 30);
    } catch (e) { console.warn('[AFK-trackfind]', e); }
  };
  var listHtml = function () {
    var r = search(q);
    if (!q.trim()) return '';
    if (!r.length) return '<div class="text-slate-500 text-xs px-1">找不到名稱含「' + esc(q) + '」的魔物</div>';
    return r.map(function (x) {
      var head = '<span class="' + (typeof getMobColor === 'function' ? getMobColor(x.lv) : '') + '">' + esc(x.n) + '</span> <span class="text-xs text-slate-500">Lv' + (x.lv || '?') + '</span>'
        + (x.boss ? ' <span class="text-xs text-rose-300">頭目（無法追蹤）</span>' : '');
      if (x.boss) return '<div class="py-1 px-2 text-sm opacity-60">' + head + '</div>';
      var chips = x.maps.map(function (m) { return '<button type="button" class="afk-tf-pick text-xs py-0.5 px-2 rounded bg-slate-700 hover:bg-sky-800 border border-slate-600" data-map="' + esc(m.v) + '" data-id="' + esc(x.id) + '">' + esc(m.t) + '</button>'; }).join('');
      return '<div class="py-1 px-2 rounded hover:bg-slate-800/70"><div class="text-sm">' + head + '</div><div class="flex flex-wrap gap-1 mt-0.5">' + chips + '</div></div>';
    }).join('');
  };
  // 打完名字按 Enter：第一隻可追蹤的魔物、第一個地區直接選好；只有一隻＋一個地區時打完就自動選
  var autoPick = function (force) {
    var r = search(q).filter(function (x) { return !x.boss; });
    if (!r.length) return false;
    var only = r.length === 1 && r[0].maps.length === 1 && r[0].rank === 0;
    if (force || only) { pick(r[0].maps[0].v, r[0].id); return true; }
    return false;
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
    box.innerHTML = '<input id="afk-tf-input" type="search" placeholder="🔍 輸入魔物名稱（按 Enter 直接選第一個）" class="w-full bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded text-sm" value="' + esc(q) + '">'
      + '<div class="afk-tf-list max-h-48 overflow-y-auto flex flex-col bg-slate-800/40 rounded"></div>';
    sel.parentNode.insertBefore(box, sel);
    paintList(box);
    var inp = box.querySelector('#afk-tf-input');
    var composing = false;
    inp.addEventListener('compositionstart', function () { composing = true; });
    inp.addEventListener('compositionend', function () { composing = false; q = inp.value; paintList(box); autoPick(false); });
    inp.addEventListener('input', function () { q = inp.value; paintList(box); if (!composing) autoPick(false); });
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); q = inp.value; autoPick(true); } });
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
