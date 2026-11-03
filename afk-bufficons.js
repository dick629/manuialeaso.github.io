/* ============================================================================
 * afk-bufficons.js — 料理、三段加速等古物增益在戰鬥畫面右上的狀態圖示（玩家 2026-11-01 23:44；外掛開關 bufficons，預設開）
 *
 *   原本營養料理、三段加速藥水、戰鬥補給、歷練加持、魔力湧泉、疾行，以及裂痕補給的加速與魔力，身上有效果卻看不到。
 *   現在都在戰鬥畫面右上的狀態圖示列出現（用那件道具的圖示）；跟其他狀態圖示一樣，滑鼠移上去（或點一下）才顯示名稱、效果說明與剩餘時間
 *   （玩家 2026-11-02 02:56：圖示上不常駐倒數）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bufficons', name: '料理與三段加速的狀態圖示', group: '遊戲介面', seal: true,
    desc: '營養料理、三段加速、戰鬥補給、裂痕補給等增益在戰鬥畫面右上顯示圖示；滑鼠移上去或點一下看說明與剩餘時間' });
  var on = function () { return !T || T.enabled('bufficons'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var A = function () { return W.AFK_TTMI_ITEMS || null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var R = function (sid) { var a = A(); try { return a && a.resolve ? a.resolve(sid) : null; } catch (e) { return null; } };
  var icon = function (id) { var d = id && DB.items[id]; try { return d && typeof getIconUrl === 'function' ? getIconUrl(d) : ''; } catch (e) { return ''; } };
  var fmt = function (s) { s = Math.max(0, Math.ceil(s)); if (s >= 3600) return Math.floor(s / 3600) + 'h'; if (s >= 600) return Math.floor(s / 60) + 'm'; return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  var fmtLong = function (s) { s = Math.max(0, Math.ceil(s)); var m = Math.floor(s / 60), x = s % 60; return (m ? m + ' 分 ' : '') + x + ' 秒'; };
  var plain = function (h) { return String(h || '').replace(/<[^>]*>/g, ''); };
  var h3Item = function () {
    var a = A(), s = W.__afkAutoSupply;
    try { var b = s && s.bestH3 && s.bestH3(); if (b) return b; } catch (e) {}
    try { var st = a && a.shopStock ? a.shopStock() : []; for (var i = 0; i < st.length; i++) { var id = typeof st[i] === 'string' ? st[i] : st[i] && st[i].id, d = DB.items[id]; if (d && (d.ttmiAction === 'thirdHaste' || (d.ttmiHaste || []).some(function (h) { return h && h.stage === 3; }))) return id; } } catch (e) {}
    return R(12033);
  };

  // 目前要顯示的增益：[{ key, id(道具), name, desc, sec }]
  var rows = function (p) {
    var out = [], b = p.buffs || {};
    Object.keys(b).forEach(function (k) {
      if (!(b[k] > 0) || k.indexOf('ttmi_food:') !== 0) return;
      var id = k.slice(10), d = DB.items[id]; if (!d) return;
      out.push({ key: k, id: id, name: d.n, desc: plain(d.d), sec: b[k] });
    });
    var fam = p.ttmiBuffs || {};
    Object.keys(fam).forEach(function (f) {
      var k = 'ttmi_' + f, id = fam[f], d = DB.items[id]; if (!(b[k] > 0) || !d) return;
      out.push({ key: k, id: id, name: d.n, desc: plain(d.d), sec: b[k] });
    });
    if (b.ttmi_haste3 > 0) { var f3 = Number(p.ttmiHaste3Factor) || 1.15; out.push({ key: 'ttmi_haste3', id: h3Item(), name: '三段加速', desc: '攻擊、移動與施法速度 +' + Math.round((f3 - 1) * 100) + '%。', sec: b.ttmi_haste3 }); }
    if (b.ttmi_blue > 0) out.push({ key: 'ttmi_blue', id: R(12034), name: '魔力湧泉', desc: '提高 MP 自然恢復：精神未滿 12 時 +1；精神達 12 時增加「精神－' + (p.ttmiBlueBase || 8) + '」。', sec: b.ttmi_blue });
    if (b.ttmi_walk2 > 0) out.push({ key: 'ttmi_walk2', id: R(12032), name: '疾行加持', desc: '移動速度提高（×' + (Number(p.ttmiWalkFactor) || 1) + '）。', sec: b.ttmi_walk2 });
    var S = W.__afkRiftSupply;
    if (S) {
      var map = { h1: 12031, h2: 12032, h3: 12033, blue: 12034 };
      Object.keys(map).forEach(function (k) {
        var key = S.BUFF[k]; if (!(b[key] > 0)) return;
        var id = R(map[k]), d = DB.items[id];
        out.push({ key: key, id: id, name: S.NAMES[key], desc: plain(d && d.d), sec: b[key] });
      });
      if (S.BUFF.bone && b[S.BUFF.bone] > 0) { var bid = S.ids().bone, bd = DB.items[bid]; out.push({ key: S.BUFF.bone, id: bid, name: S.NAMES[S.BUFF.bone], desc: plain(bd && bd.d), sec: b[S.BUFF.bone] }); }   // 骸之護符（2026-11-03）
    }
    return out;
  };

  var css = function () {
    if (document.getElementById('afk-bufficons-css')) return;
    var s = document.createElement('style'); s.id = 'afk-bufficons-css';
    s.textContent = '#afk-buff-extra{display:contents}'
      + '.afk-bi{cursor:pointer}'
      + '.afk-bi .afk-bi-t{position:absolute;left:0;right:0;bottom:0;font:700 9px/11px sans-serif;text-align:center;color:#fef9c3;background:rgba(2,6,23,.72);text-shadow:0 0 2px #000;pointer-events:none}'
      + '#afk-bi-tip{position:fixed;z-index:10050;max-width:min(280px,86vw);background:#0f172a;border:1px solid #a78bfa;border-radius:8px;padding:8px 10px;color:#e2e8f0;font-size:12px;line-height:1.5;box-shadow:0 6px 18px rgba(0,0,0,.6)}'
      + '#afk-bi-tip b{color:#fde68a}#afk-bi-tip .t{color:#93c5fd}';
    document.head.appendChild(s);
  };
  var tipKey = null, tipTimer = 0;
  var hideTip = function () { var t = document.getElementById('afk-bi-tip'); if (t) t.remove(); tipKey = null; };
  var showTip = function (el, r) {
    hideTip(); tipKey = r.key;
    var t = document.createElement('div'); t.id = 'afk-bi-tip';
    t.innerHTML = '<b>' + esc(r.name) + '</b><div>' + esc(r.desc || '') + '</div><div class="t">剩餘 ' + fmtLong(r.sec) + '</div>';
    document.body.appendChild(t);
    var rc = el.getBoundingClientRect(), w = t.offsetWidth, x = Math.min(window.innerWidth - w - 8, Math.max(8, rc.left + rc.width / 2 - w / 2));
    t.style.left = x + 'px'; t.style.top = Math.min(window.innerHeight - t.offsetHeight - 8, rc.bottom + 6) + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 5000);
  };
  var cur = [];
  var render = function () {
    var bar = document.getElementById('status-icon-bar'), p = P();
    var box = document.getElementById('afk-buff-extra');
    if (!bar || !p || !on() || p.classicMode) { if (box) box.innerHTML = ''; cur = []; return; }
    if (!box || box.parentNode !== bar) { if (box) box.remove(); box = document.createElement('div'); box.id = 'afk-buff-extra'; bar.appendChild(box); box.dataset.sig = ''; }
    css();
    cur = rows(p);
    var sig = cur.map(function (r) { return r.key + '|' + r.id; }).join(',');
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = cur.map(function (r, i) {
        return '<div class="status-icon afk-bi" data-afk-bi="' + i + '"><img src="' + esc(icon(r.id)) + '" alt="' + esc(r.name) + '"></div>';
      }).join('');
    }
    cur.forEach(function (r, i) {
      var el = box.querySelector('[data-afk-bi="' + i + '"]'); if (!el) return;
      var title = r.name + '｜' + (r.desc || '') + '｜剩餘 ' + fmtLong(r.sec); if (el.title !== title) el.title = title;
      if (tipKey === r.key) { var tip = document.getElementById('afk-bi-tip'), tt = tip && tip.querySelector('.t'); if (tt) tt.textContent = '剩餘 ' + fmtLong(r.sec); }
    });
    if (tipKey && !cur.some(function (r) { return r.key === tipKey; })) hideTip();
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest('[data-afk-bi]');
    if (!el) { if (!(ev.target && ev.target.closest && ev.target.closest('#afk-bi-tip'))) hideTip(); return; }
    var r = cur[Number(el.getAttribute('data-afk-bi'))]; if (!r) return;
    if (tipKey === r.key) hideTip(); else showTip(el, r);
  });
  if (typeof W.renderStatusIconBar === 'function') {
    var o = W.renderStatusIconBar;
    W.renderStatusIconBar = function () {
      var r = o.apply(this, arguments);
      try { if (!(typeof state !== 'undefined' && state.ff)) render(); } catch (e) { console.warn('[AFK-bufficons]', e); }
      return r;
    };
    try { (0, eval)('renderStatusIconBar = window.renderStatusIconBar'); } catch (e) {}
  }
  W.__afkBuffIcons = { rows: rows, render: render, fmt: fmt };
})();
