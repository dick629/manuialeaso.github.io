/* ============================================================================
 * afk-statsrc.js — 六大屬性的來源明細（Ping 11-18 15:13）
 *
 *   能力分頁點力量／敏捷／體質／智力／精神／魅力，原本的「下一個能力門檻」視窗裡多一塊「點數從哪裡來」：
 *     創角基礎、配點、萬能藥、裝備本身、魔法與增益、套裝／收集／願望／遺物詞綴、其他系統加成（至高的支配、天賦、巔峰、卡片換算等）、
 *     之後才加的（四大軍王、白鳥套裝、夢域魅力）。各列相加＝總值（超過上限的部分照樣算，跟門檻視窗同一個總值）。
 *   作法：包住 __afkAttrBoost（屬性換算戰鬥數值前的最後一站），記下那一刻前後的數值；裝備、魔法照核心的加法自己再算一次。
 *   外掛開關 statsrc。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'statsrc', name: '屬性來源明細', group: '介面', desc: '能力分頁點六大屬性的數字，列出點數從哪裡來' });
  if (T && !T.enabled('statsrc')) return;
  var K6 = ['str', 'dex', 'con', 'int', 'wis', 'cha'], NM = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cp = function (d) { var o = {}; K6.forEach(function (k) { o[k] = N(d[k]); }); return o; };

  // 記錄：換算前（pre）、外掛加完（post）
  var hook = function () {
    var o = W.__afkAttrBoost;
    if (o && o.__afkSrc) return;
    var f = function (p, d) {
      var pre = d ? cp(d) : null, r;
      try { r = typeof o === 'function' ? o.apply(this, arguments) : undefined; }
      finally { try { if (p && d && pre) Object.defineProperty(p, '_afkStatSrc', { value: { pre: pre, post: cp(d) }, writable: true, configurable: true, enumerable: false });   /* 不進存檔 */ } catch (e) {} }
      return r;
    };
    f.__afkSrc = true; W.__afkAttrBoost = f;
  };
  hook();
  W.addEventListener('load', function () { hook(); setTimeout(hook, 3000); setTimeout(hook, 8000); });

  var rows = function (p, k) {
    var out = [], b = N(p.base && p.base[k]), a = N(p.alloc && p.alloc[k]), pn = N(p.panacea && p.panacea[k]);
    var eq = 0, eqList = [];
    Object.keys(p.eq || {}).forEach(function (s) {
      var it = p.eq[s], dd = it && DB.items[it.id]; if (!dd) return;
      var v = N(dd[k]);
      if (k === 'str' && dd.swordStr && s !== 'wpn' && p.eq.wpn) { try { var tg = getWeaponTags(p.eq.wpn.id); if (tg.indexOf('單手劍') >= 0 || tg.indexOf('雙手劍') >= 0) v += N(dd.swordStr); } catch (e) {} }
      if (v) { eq += v; eqList.push((dd.n || it.id) + ' ' + (v > 0 ? '+' : '') + v); }
    });
    var bf = 0, bfList = [];
    Object.keys(p.buffs || {}).forEach(function (s) { var sk = DB.skills && DB.skills[s]; if (N(p.buffs[s]) > 0 && sk && sk.d && N(sk.d[k])) { bf += N(sk.d[k]); bfList.push((sk.n || s) + ' +' + N(sk.d[k])); } });
    var tot = typeof W.__afkStatTotal === 'function' ? N(W.__afkStatTotal(k)) : N(p.d && p.d[k]);
    var src = p._afkStatSrc, pre = src ? src.pre[k] : null, post = src ? src.post[k] : null;
    out.push(['創角基礎', b, '']);
    out.push(['配點', a, '升級點數（Lv50 起每級 1 點、星辰藥水）分配的點數']);
    out.push(['萬能藥', pn, '']);
    out.push(['裝備本身', eq, eqList.join('、')]);
    out.push(['魔法、增益', bf, bfList.join('、')]);
    if (pre != null) {
      out.push(['套裝、收集、願望、遺物詞綴', pre - b - a - pn - eq - bf, '套裝效果、魔法娃娃全收集、巨靈的願望、百變的透明內衣、百變化身等']);
      out.push(['其他系統加成', post - pre, '至高的支配全能力、天賦、巔峰、城堡、標籤卡換算等']);
      if (tot !== post) out.push(['之後才加的', tot - post, '四大軍王、白鳥套裝的魅力、席琳夢域的魅力等']);
    } else out.push(['其他', tot - b - a - pn - eq - bf, '']);
    return { rows: out, total: tot };
  };
  var html = function (k) {
    var p = (typeof player !== 'undefined' && player && player.cls) ? player : null; if (!p || !p.d || !NM[k]) return '';
    var r = rows(p, k);
    var h = '<div class="afk-ss"><b class="afk-ss-t">點數從哪裡來</b><table>';
    r.rows.forEach(function (x) {
      if (!x[1] && x[0] !== '創角基礎' && x[0] !== '配點') return;
      h += '<tr><td>' + esc(x[0]) + (x[2] ? '<small>' + esc(x[2]) + '</small>' : '') + '</td><td class="' + (x[1] < 0 ? 'neg' : '') + '">' + (x[1] > 0 ? '+' : '') + x[1] + '</td></tr>';
    });
    h += '<tr class="sum"><td>合計</td><td>' + r.total + '</td></tr></table>';
    if (N(p.bonus) > 0) h += '<p class="afk-ss-n">還有 ' + N(p.bonus) + ' 點升級點數沒分配。</p>';
    return h + '</div>';
  };
  // 掛在原本的「下一個能力門檻」視窗裡（點六大屬性就會開那個視窗）
  var lastStat = null;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('#tab-stats .ability-primary-control');
    if (!el) return;
    lastStat = K6.filter(function (k) { return el.classList.contains('ability-primary-' + k); })[0] || null;
  }, true);
  document.addEventListener('keydown', function (e) { var el = e.target && e.target.closest && e.target.closest('#tab-stats .ability-primary-control'); if (el) lastStat = K6.filter(function (k) { return el.classList.contains('ability-primary-' + k); })[0] || null; }, true);
  var inject = function () {
    var m = document.getElementById('attribute-help'); if (!m || m.querySelector('.afk-ss')) return;
    var k = lastStat;
    if (!k) { var t = (m.querySelector('h2') || {}).textContent || ''; k = K6.filter(function (x) { return t.indexOf(NM[x]) === 0; })[0]; }
    var body = m.querySelector('.attribute-help-body'); if (!body || !k) return;
    var first = body.querySelector('p');
    var box = document.createElement('div'); box.innerHTML = html(k);
    if (first && first.nextSibling) body.insertBefore(box.firstChild, first.nextSibling); else body.appendChild(box.firstChild);
  };
  if (typeof MutationObserver === 'function') new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length) { inject(); break; } }).observe(document.body || document.documentElement, { childList: true });
  var css = document.createElement('style');
  css.textContent = '#attribute-help .afk-ss{border:1px solid #766846;background:#151b22;padding:8px 10px;margin:0 0 12px}'
    + '#attribute-help .afk-ss-t{color:#dcc58e;margin-bottom:4px}#attribute-help .afk-ss table{width:100%;border-collapse:collapse}'
    + '#attribute-help .afk-ss td{padding:3px 2px;border-top:1px solid #2a323c;vertical-align:top;font-size:13px}'
    + '#attribute-help .afk-ss td:last-child{text-align:right;font-weight:700;color:#e5d9b4;white-space:nowrap;padding-left:8px}#attribute-help .afk-ss td.neg{color:#fca5a5}'
    + '#attribute-help .afk-ss small{display:block;font-size:11px;color:#8f999e}#attribute-help .afk-ss tr.sum td{border-top:2px solid #766846;color:#fff}'
    + '#attribute-help .afk-ss-n{margin:6px 0 0;font-size:12px;color:#93c5fd}';
  (document.head || document.documentElement).appendChild(css);
  W.__afkStatSrc = { rows: rows, html: html };
})();
