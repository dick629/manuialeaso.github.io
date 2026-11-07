/* afk-novel.js — 📖 小說《放置天堂 - 次元裂縫》閱讀器（Ping 11-07 23:37：放在設定分頁「🔌 外掛」列）
 *   內容：assets/novel/novel.md（用到才下載）。依「# 」切章；記住讀到哪一章、捲到哪裡（localStorage）。
 *   外掛開關 novel（查詢與資訊，預設開）。
 */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'novel', name: '小說《次元裂縫》', desc: '設定分頁「🔌 外掛」列多一個「📖 小說」：線上閱讀連載小說，記住讀到哪一章', group: '查詢與資訊', seal: true });
  if (T && !T.enabled('novel')) return;
  var SRC = 'assets/novel/novel.md?v=1107b', LS = 'afk_novel_pos';
  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var inl = function (s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); };
  var chapters = null, loading = null;

  function load() {
    if (chapters) return Promise.resolve(chapters);
    if (loading) return loading;
    loading = fetch(SRC).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      t = t.replace(/^﻿/, '');
      var lines = t.split(/\r?\n/), out = [], cur = null;
      lines.forEach(function (ln, i) {
        if (/^# /.test(ln)) {
          if (i === 0) { cur = { t: '簡介與目錄', l: [] }; out.push(cur); return; }
          cur = { t: ln.slice(2).trim(), l: [] }; out.push(cur); return;
        }
        if (!cur) { cur = { t: '簡介與目錄', l: [] }; out.push(cur); }
        cur.l.push(ln);
      });
      chapters = out; return out;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function md(lines) {
    var h = '', para = [], i = 0;
    var flush = function () { if (para.length) { h += '<p>' + para.map(inl).join('<br>') + '</p>'; para = []; } };
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*$/.test(ln)) { flush(); i++; continue; }
      if (/^---+\s*$/.test(ln)) { flush(); h += '<hr>'; i++; continue; }
      var m = ln.match(/^(#{2,4}) (.*)$/);
      if (m) { flush(); h += '<h' + (m[1].length + 1) + '>' + inl(m[2]) + '</h' + (m[1].length + 1) + '>'; i++; continue; }
      if (/^>/.test(ln)) {
        flush(); var q = [];
        while (i < lines.length && /^>/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        h += '<blockquote>' + q.map(function (x) { return x ? inl(x) : ''; }).join('<br>') + '</blockquote>'; continue;
      }
      if (/^\|/.test(ln)) {
        flush(); var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        h += '<table>' + rows.filter(function (r) { return !/^\|[\s:|-]+\|\s*$/.test(r); }).map(function (r, k) {
          var cells = r.replace(/^\||\|\s*$/g, '').split('|');
          return '<tr>' + cells.map(function (c) { return (k ? '<td>' : '<th>') + inl(c.trim()) + (k ? '</td>' : '</th>'); }).join('') + '</tr>';
        }).join('') + '</table>'; continue;
      }
      if (/^[-*] /.test(ln)) { flush(); var li = []; while (i < lines.length && /^[-*] /.test(lines[i])) { li.push('<li>' + inl(lines[i].slice(2)) + '</li>'); i++; } h += '<ul>' + li.join('') + '</ul>'; continue; }
      para.push(ln); i++;
    }
    flush(); return h;
  }

  function css() {
    if (el('afk-novel-css')) return;
    var s = document.createElement('style'); s.id = 'afk-novel-css';
    s.textContent = '#afk-novel{position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,.92);display:flex;flex-direction:column;color:#e2e8f0}'
      + '#afk-novel .nv-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #334155;background:#0f172a}'
      + '#afk-novel .nv-head b{flex:1;color:#fcd34d;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#afk-novel button{background:#334155;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:6px 10px;font-size:14px}'
      + '#afk-novel select{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:8px;padding:6px;max-width:46vw;font-size:14px}'
      + '#afk-novel .nv-body{flex:1;overflow-y:auto;padding:16px 18px 40px;max-width:760px;width:100%;margin:0 auto;font-size:17px;line-height:1.95;-webkit-overflow-scrolling:touch}'
      + '#afk-novel .nv-body h1{font-size:22px;color:#fde68a;margin:4px 0 14px;font-weight:bold}'
      + '#afk-novel .nv-body h3,#afk-novel .nv-body h4,#afk-novel .nv-body h5{color:#fcd34d;margin:18px 0 8px;font-weight:bold}'
      + '#afk-novel .nv-body p{margin:0 0 14px;text-indent:2em}'
      + '#afk-novel .nv-body blockquote{border-left:3px solid #a78bfa;padding:4px 12px;color:#c4b5fd;margin:0 0 14px;font-size:15px}'
      + '#afk-novel .nv-body hr{border:0;border-top:1px solid #334155;margin:18px 0}'
      + '#afk-novel .nv-body table{border-collapse:collapse;font-size:14px;line-height:1.5;margin:0 0 14px;width:100%}'
      + '#afk-novel .nv-body td,#afk-novel .nv-body th{border:1px solid #334155;padding:4px 6px;text-align:left;vertical-align:top}'
      + '#afk-novel .nv-foot{display:flex;justify-content:space-between;gap:8px;max-width:760px;margin:10px auto 0}';
    document.head.appendChild(s);
  }

  var pos = function () { try { return JSON.parse(localStorage.getItem(LS)) || { c: 0, y: 0 }; } catch (e) { return { c: 0, y: 0 }; } };
  var savePos = function (c, y) { try { localStorage.setItem(LS, JSON.stringify({ c: c, y: y })); } catch (e) {} };

  function show(ci, y) {
    var box = el('afk-novel'); if (!box || !chapters) return;
    ci = Math.max(0, Math.min(chapters.length - 1, ci | 0));
    var ch = chapters[ci], body = box.querySelector('.nv-body');
    box.querySelector('select').value = String(ci);
    body.innerHTML = '<h1>' + esc(ch.t) + '</h1>' + md(ch.l)
      + '<div class="nv-foot">' + (ci > 0 ? '<button type="button" data-nv="prev">◀ 上一章</button>' : '<span></span>')
      + (ci < chapters.length - 1 ? '<button type="button" data-nv="next">下一章 ▶</button>' : '<span>（全書完）</span>') + '</div>';
    body.scrollTop = y || 0; box.dataset.ci = ci; savePos(ci, y || 0);
  }

  function open() {
    css();
    var box = el('afk-novel');
    if (!box) {
      box = document.createElement('div'); box.id = 'afk-novel';
      box.innerHTML = '<div class="nv-head"><b>📖 放置天堂 - 次元裂縫</b><select aria-label="章節"></select><button type="button" data-nv="close" aria-label="關閉">✕</button></div><div class="nv-body">讀取中…</div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-nv]'); if (!b) return;
        var a = b.getAttribute('data-nv'), ci = +box.dataset.ci || 0;
        if (a === 'close') close(); else if (a === 'prev') show(ci - 1, 0); else if (a === 'next') show(ci + 1, 0);
      });
      box.querySelector('select').addEventListener('change', function (e) { show(+e.target.value, 0); });
      var t = 0; box.querySelector('.nv-body').addEventListener('scroll', function (e) { clearTimeout(t); var y = e.target.scrollTop; t = setTimeout(function () { savePos(+box.dataset.ci || 0, y); }, 300); });
    }
    box.style.display = 'flex';
    load().then(function (cs) {
      var sel = box.querySelector('select');
      if (!sel.options.length) sel.innerHTML = cs.map(function (c, i) { return '<option value="' + i + '">' + esc(c.t) + '</option>'; }).join('');
      var p = pos(); show(p.c, p.y);
    }).catch(function () { box.querySelector('.nv-body').textContent = '小說讀取失敗，請確認網路後再試一次。'; });
  }
  function close() { var b = el('afk-novel'); if (b) b.style.display = 'none'; }

  var tries = 0;
  function injectNav() {
    if (!el('tab-automation')) return false;
    if (el('m-afk-nav-novel')) return true;
    var row = el('m-afk-navrow');
    if (!row) {
      row = document.createElement('div'); row.id = 'm-afk-navrow'; row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      el('tab-automation').appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-novel'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%'; b.style.marginTop = '8px';
    b.textContent = '📖 小說《次元裂縫》';
    b.addEventListener('click', open);
    var gh = el('m-afk-nav-gamehall');
    if (gh && gh.parentNode === row) row.insertBefore(b, gh); else row.appendChild(b);
    return true;
  }
  (function tryNav() { if (injectNav() && tries > 6) return; if (++tries < 40) setTimeout(tryNav, 500); })();
  W.__afkNovel = { open: open, close: close, load: load };
})();
