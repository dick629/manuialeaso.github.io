/* ============================================================================
 * afk-relicshop.js — 潘朵拉黑市「遺物自選」（Ping 11-17 20:06）
 *
 *   黑市多一個分頁：用血龍鑽買 +0 遺物，自己挑。
 *     ‧每件 5,000 血龍鑽（從目前角色背包扣）。
 *     ‧同一件遺物，每個角色只能買一次（記在 player.afkRelicShop）。
 *     ‧不賣：王者系列遺物（地圖王遺物）、新地區遺物、次元遺物（含次元裂縫掉的涅默西斯的符石劍）、
 *            GM／不能交易的、遺物蛋。
 *   經典模式沒有。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var PRICE = 5000, BLOOD = 'afk_blood_dia';
  var NZ = { relic_icequeen_ear: 1, relic_nz_sanct_ring: 1, relic_soul_armor: 1, relic_soul_boots: 1, relic_soul_cloak: 1, relic_soul_gloves: 1, relic_soul_helm: 1, relic_true_dk_flameblade: 1, relic_worldtree_ring: 1, relic_nemesis_runesword: 1 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return (Number(n) || 0).toLocaleString(); };
  var sellable = function (id) {
    var d = DB.items[id];
    if (!d || !d.relic || !d.n || d.gmOnly || d.noTrade || d.bossRelic || d.bossRelicKey) return false;
    if (NZ[id] || /^dimr_/.test(id) || d.dimRelic) return false;
    if (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') return false;   // 遺物蛋等
    return true;
  };
  var LIST = null;
  var list = function () { if (!LIST) LIST = Object.keys(DB.items).filter(sellable).sort(function (a, b) { var x = DB.items[a], y = DB.items[b]; return (x.type + x.n).localeCompare(y.type + y.n, 'zh-Hant'); }); return LIST; };
  var rec = function (p) { if (!p.afkRelicShop || typeof p.afkRelicShop !== 'object') p.afkRelicShop = { b: {} }; if (!p.afkRelicShop.b) p.afkRelicShop.b = {}; return p.afkRelicShop; };
  var blood = function () { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && i.id === BLOOD; }).reduce(function (n, i) { return n + (Number(i.cnt) || 1); }, 0) : 0; };
  var spend = function (n) {
    var p = P(); if (!p || blood() < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== BLOOD) continue; var q = Math.min(n, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var ui = { cat: 'wpn', q: '', ask: null, msg: '', err: '' };
  var ico = function (id) { var K = W.__afkNpcKit; return K && K.itemIco ? K.itemIco(id) : ''; };
  var buy = function (id) {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (p.classicMode) return '經典模式沒有遺物自選。';
    if (!sellable(id)) return '這件遺物不能買。';
    var r = rec(p); if (r.b[id]) return '這件遺物已經買過了（每件只能買一次）。';
    if (blood() < PRICE) return '血龍鑽不夠（要 ' + fmt(PRICE) + ' 顆）。';
    if (!spend(PRICE)) return '扣血龍鑽失敗。';
    r.b[id] = Date.now();
    try { gainItem(id, 1, true, true, false); } catch (e) { console.warn('[AFK-relicshop]', e); }
    try { if (typeof logSys === 'function') logSys('<span class="text-purple-300 font-bold">遺物自選：花 ' + fmt(PRICE) + ' 血龍鑽買到 +0 ' + esc(DB.items[id].n) + '。</span>'); } catch (e) {}
    try { if (typeof saveGame === 'function') saveGame(); if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    return '';
  };
  var CAT_N = { wpn: '武器', arm: '防具', acc: '飾品' };
  var CN = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士' };
  var css = function () {
    if (document.getElementById('afk-rshop-css')) return;
    var s = document.createElement('style'); s.id = 'afk-rshop-css';
    s.textContent = '.afk-rs{display:flex;flex-direction:column;gap:8px;padding:6px 2px;font-size:14px}.afk-rs .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
      + '.afk-rs button{padding:5px 10px;border:1px solid #57534e;border-radius:4px;background:#292524;color:#e7e5e4}.afk-rs button[aria-pressed=true]{border-color:#c084fc;color:#f5d0fe;background:#3b0764}'
      + '.afk-rs button.go{border-color:#a855f7;background:#581c87;color:#fff}.afk-rs button:disabled{opacity:.45}.afk-rs input{background:#1c1917;border:1px solid #57534e;color:#fff;padding:5px 8px;border-radius:4px;min-width:0;flex:1}'
      + '.afk-rs .ax-ico{width:40px;height:40px;flex:0 0 40px;border:1px solid #475569;border-radius:6px;background:#0b1220;display:flex;align-items:center;justify-content:center;overflow:hidden}.afk-rs .ax-ico img{width:34px;height:34px;max-width:34px;max-height:34px;object-fit:contain;pointer-events:none}'   // 11-17：大張圖示（GPT 圖）不撐開
      + '.afk-rs .row{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #292524}.afk-rs .row .nm{flex:1;min-width:0;overflow-wrap:anywhere}.afk-rs .row button{flex:0 0 auto}.afk-rs .dim{color:#a8a29e;font-size:12px}.afk-rs .err{color:#f87171}.afk-rs .ok{color:#86efac}';
    document.head.appendChild(s);
  };
  var html = function () {
    var p = P(), r = rec(p), q = ui.q;
    var rows = list().filter(function (id) { var d = DB.items[id]; return d.type === ui.cat && (!q || d.n.indexOf(q) >= 0); });
    var bought = Object.keys(r.b).length;
    var h = '<div class="afk-rs" id="afk-rs-page"><div class="font-bold" style="color:#e9d5ff;font-size:16px">遺物自選</div>'
      + '<div class="dim">用血龍鑽買 +0 遺物：每件 ' + fmt(PRICE) + ' 顆，同一件每個角色只能買一次。王者系列、新地區、次元遺物不賣。</div>'
      + '<div class="bar">持有血龍鑽 <b style="color:#fda4af">' + fmt(blood()) + '</b>　已買 ' + bought + ' 件</div>'
      + '<div class="bar">' + Object.keys(CAT_N).map(function (k) { return '<button type="button" data-rs="cat:' + k + '" aria-pressed="' + (ui.cat === k) + '">' + CAT_N[k] + '</button>'; }).join('')
      + '<input data-rs-in="q" placeholder="搜尋名稱" value="' + esc(q) + '" aria-label="搜尋遺物"></div>';
    if (ui.err) h += '<div class="err">' + esc(ui.err) + '</div>';
    if (ui.msg) h += '<div class="ok">' + esc(ui.msg) + '</div>';
    if (!rows.length) h += '<div class="dim">沒有符合的遺物。</div>';
    rows.slice(0, 150).forEach(function (id) {
      var d = DB.items[id], done = !!r.b[id], ask = ui.ask === id;
      h += '<div class="row">' + ico(id) + '<div class="nm"><div class="' + (typeof getItemColor === 'function' ? getItemColor({ id: id }) : '') + '">' + esc(d.n) + '</div>'
        + (d.req && d.req !== 'all' ? '<div class="dim">' + esc(String(d.req).split(',').map(function (c) { return CN[c] || c; }).join('、')) + '</div>' : '') + '</div>'
        + (done ? '<span class="dim">已買過</span>'
          : ask ? '<button type="button" class="go" data-rs="ok:' + esc(id) + '">確定 ' + fmt(PRICE) + '</button><button type="button" data-rs="no">取消</button>'
          : '<button type="button" data-rs="ask:' + esc(id) + '"' + (blood() < PRICE ? ' disabled' : '') + '>買</button>') + '</div>';
    });
    if (rows.length > 150) h += '<div class="dim">只列前 150 件，請用搜尋縮小範圍。</div>';
    return h + '</div>';
  };
  var paint = function (box) {
    box.innerHTML = html();
    var pg = box.querySelector('#afk-rs-page'); if (!pg) return;
    pg.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-rs]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-rs'), i = a.indexOf(':'), k = i < 0 ? a : a.slice(0, i), v = i < 0 ? '' : a.slice(i + 1);
      ui.err = ''; ui.msg = '';
      if (k === 'cat') { ui.cat = v; ui.ask = null; }
      else if (k === 'ask') ui.ask = v;
      else if (k === 'no') ui.ask = null;
      else if (k === 'ok') { var e = buy(v); ui.ask = null; if (e) ui.err = e; else ui.msg = '買到 +0 ' + DB.items[v].n + '，放進背包了。'; }
      paint(box);
    });
    var inp = pg.querySelector('[data-rs-in="q"]');
    if (inp) inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ui.q = inp.value.trim(); paint(box); } });
    if (inp) inp.addEventListener('change', function () { ui.q = inp.value.trim(); paint(box); });
  };
  (W.__afkMarketTabs = W.__afkMarketTabs || []).push({
    id: 'relicshop', label: '🏺 遺物自選',
    show: function () { var p = P(); return !!p && !p.classicMode; },
    render: function (box) { css(); paint(box); }
  });
  W.__afkRelicShop = { list: list, sellable: sellable, buy: buy, PRICE: PRICE };
})();
