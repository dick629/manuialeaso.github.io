/* ============================================================================
 * afk-blooddia.js — 潘朵拉黑市「血龍鑽兌換」分頁（玩家 2026-11-03；外掛開關 blooddia，預設開；經典模式看不到）
 *
 *   龍之鑽石 50 顆 → 血龍鑽 1 顆，沒有每日上限；只能單向兌換。
 *   黑市面板上方多一排分頁：「商品」（原本的黑市）／「血龍鑽兌換」。
 *   兌換頁：輸入要換幾顆（或按 ×1／×10／×100／最多），按「兌換」後再按一次「確定」才扣龍鑽。
 *   血龍鑽：背包道具 afk_blood_dia（不能賣、不能標廢品），玩家說之後給拍賣場用；目前程式裡沒有拍賣場，所以還沒有用途。
 *   API：W.__afkBloodDia = { ID, RATE, max(), exchange(n), have() }
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'blooddia', name: '血龍鑽兌換（潘朵拉黑市）', group: '遊戲內容', def: true,
    desc: '潘朵拉黑市多一個分頁：龍之鑽石 50 顆換 1 顆血龍鑽，沒有每日上限' });
  if (typeof DB === 'undefined' || !DB.items) return;
  var ID = 'afk_blood_dia', RATE = 50;
  if (!DB.items[ID]) DB.items[ID] = { n: '血龍鑽', type: 'etc', req: 'all', p: 0, gachaWeight: 0, noSell: true, noJunk: true, c: 'text-rose-400',
    img: (DB.items.diamond && DB.items.diamond.img) || 'assets/icons/items/龍之鑽石.png',
    d: '浸過龍血的龍之鑽石。在潘朵拉黑市用龍之鑽石 50 顆換 1 顆。所有角色共用一份，數量顯示在潘朵拉黑市上方。' };
  var on = function () { return !T || T.enabled('blooddia'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var act = function () { var p = P(); return on() && !!p && !p.classicMode; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var dia = function () { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var have = function () { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && i.id === ID; }).reduce(function (n, i) { return n + (Number(i.cnt) || 1); }, 0) : 0; };
  var max = function () { return Math.floor(dia() / RATE); };
  var exchange = function (n) {
    n = Math.floor(Number(n));
    if (!act()) return { ok: false, msg: '目前不能兌換。' };
    if (!(n > 0)) return { ok: false, msg: '請輸入要換幾顆。' };
    var cost = n * RATE;
    if (dia() < cost) return { ok: false, msg: '龍之鑽石不夠：換 ' + fmt(n) + ' 顆要 ' + fmt(cost) + ' 顆，你有 ' + fmt(dia()) + ' 顆。' };
    var r = null; try { r = W.pandoraAdjustSharedDiamonds(-cost) || {}; } catch (e) { r = {}; }
    if (!r.ok) return { ok: false, msg: '龍之鑽石帳戶暫時無法寫入，沒有兌換。' };
    gainItem(ID, n, true, true);
    try { logSys('<span class="text-rose-300 font-bold">用龍之鑽石 ' + fmt(cost) + ' 顆換到血龍鑽 ' + fmt(n) + ' 顆。</span>'); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(); if (typeof updateUI === 'function') updateUI(); if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    return { ok: true, n: n, cost: cost };
  };
  W.__afkBloodDia = { ID: ID, RATE: RATE, max: max, exchange: exchange, have: have, ui: null };

  // ── 黑市分頁 ──
  var ui = { page: 'market', amt: 1, ask: false, msg: '', err: '' }; W.__afkBloodDia.ui = ui;
  var css = function () {
    if (document.getElementById('afk-blooddia-css')) return;
    var s = document.createElement('style'); s.id = 'afk-blooddia-css';
    s.textContent = '.afk-bd-tabs{display:flex;gap:6px;justify-content:center;margin:4px 0 6px;flex-shrink:0}'
      + '.afk-bd-tabs button{padding:6px 14px;border-radius:6px;border:1px solid #6b21a8;background:#1e1b2e;color:#d8b4fe;font-weight:700;font-size:14px}'
      + '.afk-bd-tabs button[aria-pressed="true"]{background:#7e22ce;color:#fff;border-color:#c084fc}'
      + '.afk-bd{padding:10px;color:#e2e8f0;font-size:14px;max-width:560px;margin:0 auto;width:100%}'
      + '.afk-bd .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}'
      + '.afk-bd input{width:120px;background:#0f172a;color:#fde68a;border:1px solid #475569;border-radius:6px;padding:6px 8px;font-size:15px}'
      + '.afk-bd button{padding:6px 12px;border-radius:6px;border:1px solid #9f1239;background:#4c0519;color:#fecdd3;font-weight:700;font-size:13px}'
      + '.afk-bd button.go{background:#be123c;color:#fff;border-color:#fb7185}.afk-bd button[disabled]{opacity:.45;cursor:not-allowed}'
      + '.afk-bd .err{color:#fca5a5;min-height:1.2em}.afk-bd .ok{color:#86efac;min-height:1.2em}.afk-bd .sm{color:#94a3b8;font-size:12.5px}';
    document.head.appendChild(s);
  };
  var amount = function () { var n = Math.floor(Number(ui.amt)); return n > 0 ? n : 0; };
  var pageHtml = function () {
    var n = amount(), cost = n * RATE, mx = max(), ok = n > 0 && n <= mx;
    var h = '<div class="afk-bd" id="afk-bd-page">'
      + '<div class="font-bold text-rose-300" style="font-size:16px">血龍鑽兌換</div>'
      + '<div class="sm">龍之鑽石 ' + RATE + ' 顆換 1 顆血龍鑽，沒有每日上限；換了不能換回。</div>'
      + '<div class="row">龍之鑽石 <b class="text-yellow-300">' + fmt(dia()) + '</b>　血龍鑽 <b class="text-rose-300" id="afk-bd-have">' + fmt(have()) + '</b>　最多可換 <b>' + fmt(mx) + '</b> 顆</div>'
      + '<div class="row"><label>換 <input id="afk-bd-amt" type="number" min="1" step="1" inputmode="numeric" aria-label="要換幾顆血龍鑽" value="' + esc(ui.amt) + '"> 顆</label>'
      + [1, 10, 100].map(function (k) { return '<button type="button" data-bd="set:' + k + '">×' + k + '</button>'; }).join('')
      + '<button type="button" data-bd="set:max"' + (mx > 0 ? '' : ' disabled') + '>最多</button></div>'
      + '<div class="row">需要龍之鑽石 <b class="' + (ok || !n ? 'text-yellow-300' : 'text-red-400') + '" id="afk-bd-cost">' + fmt(cost) + '</b></div>';
    if (ui.ask && ok) h += '<div class="row"><span class="text-amber-200">確定用龍之鑽石 ' + fmt(cost) + ' 顆換血龍鑽 ' + fmt(n) + ' 顆？</span>'
      + '<button type="button" class="go" data-bd="yes">確定</button><button type="button" data-bd="no">取消</button></div>';
    else h += '<div class="row"><button type="button" class="go" data-bd="ask"' + (ok ? '' : ' disabled') + '>兌換</button></div>';
    h += '<div class="err">' + esc(ui.err) + '</div><div class="ok">' + esc(ui.msg) + '</div></div>';
    return h;
  };
  var lastDiv = null;
  var decorate = function (div) {
    if (!div || !act()) return;
    var panel = div.querySelector('.pandora-market-panel'); if (!panel) return;
    css(); lastDiv = div;
    var title = panel.querySelector('.pandora-market-title');
    var tabs = document.createElement('div'); tabs.className = 'afk-bd-tabs'; tabs.setAttribute('role', 'tablist');
    // 其他外掛的分頁（afk-trade 寄賣攤）：W.__afkMarketTabs = [{ id, label, show(), render(box) }]
    var extra = (W.__afkMarketTabs || []).filter(function (x) { try { return !x.show || x.show(); } catch (e) { return false; } });
    if (ui.page !== 'market' && ui.page !== 'blood' && !extra.some(function (x) { return x.id === ui.page; })) ui.page = 'market';
    tabs.innerHTML = '<button type="button" role="tab" data-bdtab="market" aria-pressed="' + (ui.page === 'market') + '">商品</button>'
      + '<button type="button" role="tab" data-bdtab="blood" aria-pressed="' + (ui.page === 'blood') + '">血龍鑽兌換</button>'
      + extra.map(function (x) { return '<button type="button" role="tab" data-bdtab="' + esc(x.id) + '" aria-pressed="' + (ui.page === x.id) + '">' + esc(x.label) + '</button>'; }).join('');
    if (title && title.nextSibling) panel.insertBefore(tabs, title.nextSibling); else panel.insertBefore(tabs, panel.firstChild);
    if (ui.page === 'blood') {
      Array.prototype.forEach.call(panel.children, function (c) { if (c !== title && c !== tabs) c.style.display = 'none'; });
      var box = document.createElement('div'); box.innerHTML = pageHtml(); panel.appendChild(box.firstChild);
    } else if (ui.page !== 'market') {
      Array.prototype.forEach.call(panel.children, function (c) { if (c !== title && c !== tabs) c.style.display = 'none'; });
      var xb = document.createElement('div'); xb.style.cssText = 'display:flex;flex-direction:column;min-height:0;flex:1;overflow:auto'; panel.appendChild(xb);
      var tab = extra.filter(function (x) { return x.id === ui.page; })[0];
      try { tab.render(xb); } catch (e) { xb.textContent = '分頁載入失敗：' + e.message; console.warn('[AFK-blooddia] 分頁', e); }
      tabs.onclick = function (ev) { var b = ev.target.closest('[data-bdtab]'); if (!b) return; ui.page = b.getAttribute('data-bdtab'); ui.ask = false; ui.err = ''; ui.msg = ''; rerender(); };
      return;
    }
    tabs.onclick = function (ev) { var b = ev.target.closest('[data-bdtab]'); if (!b) return; ui.page = b.getAttribute('data-bdtab'); ui.ask = false; ui.err = ''; ui.msg = ''; rerender(); };
    var pg = panel.querySelector('#afk-bd-page'); if (!pg) return;
    pg.addEventListener('input', function (ev) {
      if (ev.target.id !== 'afk-bd-amt') return;
      ui.amt = ev.target.value; ui.ask = false; ui.err = ''; ui.msg = '';
      var n = amount(), c = pg.querySelector('#afk-bd-cost'), go = pg.querySelector('[data-bd="ask"]');
      if (c) { c.textContent = fmt(n * RATE); c.className = (n > 0 && n <= max()) || !n ? 'text-yellow-300' : 'text-red-400'; }
      if (go) go.disabled = !(n > 0 && n <= max());
    });
    pg.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-bd]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-bd'); ui.err = ''; ui.msg = '';
      if (a.indexOf('set:') === 0) { var v = a.slice(4); ui.amt = v === 'max' ? max() : Number(v); ui.ask = false; }
      else if (a === 'ask') ui.ask = true;
      else if (a === 'no') ui.ask = false;
      else if (a === 'yes') { var r = exchange(amount()); ui.ask = false; if (r.ok) ui.msg = '換到血龍鑽 ' + fmt(r.n) + ' 顆。'; else ui.err = r.msg; }
      rerender();
    });
  };
  var rerender = W.__afkBloodDia.rerender = function () { try { if (lastDiv && typeof W.pandoraRenderMarket === 'function') W.pandoraRenderMarket(lastDiv); } catch (e) { console.warn('[AFK-blooddia]', e); } };
  if (typeof W.pandoraRenderMarket === 'function') {
    var oR = W.pandoraRenderMarket;
    W.pandoraRenderMarket = function (div) { var r = oR.apply(this, arguments); try { decorate(div); } catch (e) { console.warn('[AFK-blooddia] 黑市分頁', e); } return r; };
    try { (0, eval)('pandoraRenderMarket = window.pandoraRenderMarket'); } catch (e) {}
  } else console.warn('[AFK-blooddia] 找不到潘朵拉黑市面板，兌換分頁停用');
  console.log('[AFK-blooddia] 已啟用：潘朵拉黑市血龍鑽兌換');
})();

/* ============================================================================
 * 血龍鑽改成帳號共用貨幣（Ping 11-23 15:24）
 *   ‧所有角色共用一份數字（存瀏覽器 afk_blood_acct_v1，加簽章），跟龍之鑽石一樣。
 *   ‧搬家：每個角色第一次讀進來時，背包裡的血龍鑽加進共用帳戶（同一個存檔位＋角色名只搬一次，讀舊存檔不會重複加）；
 *          倉庫裡的血龍鑽在第一次啟動時整批搬進去、從倉庫拿掉。
 *   ‧做法（不改各系統的扣款程式）：背包裡留一疊「鏡像」，數量永遠等於共用帳戶；
 *     各系統照舊從背包扣、用 gainItem 給，鏡像的增減會同步寫回共用帳戶（每 0.5 秒、存檔前、換角色前都會同步）。
 *     鏡像不顯示在背包，黑市上方跟龍之鑽石一起顯示數量。經典模式不受影響。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, ID = 'afk_blood_dia', KEY = 'afk_blood_acct_v1', SALT = 'bda:4k2:';
  if (typeof DB === 'undefined' || !DB.items || !DB.items[ID]) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var ok = function (p) { return !!p && !p.classicMode; };
  var fnv = function (s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(36); };
  var sig = function (a) { return fnv(SALT + a.b + '|' + (a.wh ? 1 : 0) + '|' + Object.keys(a.mig || {}).sort().join(',')); };
  var read = function () { var a = null; try { a = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} if (!a || typeof a !== 'object') a = { b: 0, wh: 0, mig: {} }; a.b = Math.max(0, Math.floor(Number(a.b) || 0)); if (!a.mig || typeof a.mig !== 'object') a.mig = {}; a.bad = !!a.k && a.k !== sig(a); return a; };
  var write = function (a) { var o = { b: Math.max(0, Math.floor(a.b)), wh: a.wh ? 1 : 0, mig: a.mig || {} }; o.k = sig(o); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  var invCount = function (p) { return (p.inv || []).reduce(function (n, i) { return n + (i && i.id === ID ? (Number(i.cnt) || 1) : 0); }, 0); };
  var setInv = function (p, n) {
    var keep = null; p.inv = (p.inv || []).filter(function (i) { if (!i || i.id !== ID) return true; if (!keep) { keep = i; return true; } return false; });
    if (n <= 0) { if (keep) p.inv.splice(p.inv.indexOf(keep), 1); return; }
    if (!keep) { keep = { id: ID, cnt: n, uid: 'bd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }; p.inv.push(keep); }
    keep.cnt = n; delete keep.lock; delete keep.junk;
  };
  var slotKey = function (p) { var s = ''; try { s = String(currentSlot); } catch (e) {} return s + ':' + String(p.name || ''); };
  var curP = null, last = 0, busy = false, movedIn = 0;
  var migrateWh = function (a) {
    if (a.wh) return;
    try {
      if (typeof loadWarehouse !== 'function' || typeof saveWarehouse !== 'function') return;
      var w = loadWarehouse(); if (typeof _whLoadOk !== 'undefined' && !_whLoadOk) return;   // 倉庫讀不到就先不搬（下次再試）
      var n = 0; w.items = (w.items || []).filter(function (it) { if (it && it.id === ID) { n += Number(it.cnt) || 1; return false; } return true; });
      if (n > 0) saveWarehouse(w);
      a.b += n; a.wh = 1; movedIn += n;
      if (n > 0) try { logSys('<span class="text-rose-300">倉庫裡的血龍鑽 ' + n.toLocaleString() + ' 顆已搬進帳號共用（所有角色共用）。</span>'); } catch (e) {}
    } catch (e) { console.warn('[AFK-blooddia] 倉庫搬家', e); }
  };
  var sync = W.__afkBloodSync = function () {
    if (busy || (W.__afkBloodAcct && W.__afkBloodAcct.pause)) return; var p = P(); if (!ok(p)) { curP = null; return; }
    busy = true;
    try {
      var a = read();
      if (curP !== p) {   // 剛讀檔／換角色
        migrateWh(a);
        var k = slotKey(p);
        if (!a.mig[k] && !p.afkBloodMig) { var n = invCount(p); a.b += n; movedIn += n; if (n > 0) try { logSys('<span class="text-rose-300">背包裡的血龍鑽 ' + n.toLocaleString() + ' 顆已搬進帳號共用（所有角色共用）。</span>'); } catch (e) {} }
        a.mig[k] = 1; p.afkBloodMig = 1;
        write(a); setInv(p, a.b); last = a.b; curP = p; return;
      }
      var c = invCount(p);
      if (c !== last) { a.b = Math.max(0, a.b + (c - last)); write(a); }
      if (invCount(p) !== a.b) setInv(p, a.b);
      last = a.b;
    } finally { busy = false; }
  };
  W.__afkBloodAcct = { get: function () { return read().b; }, sync: sync, read: read, moved: function () { return movedIn; } };
  // 存檔前、換角色前先同步
  if (typeof W.saveGame === 'function') { var oS = W.saveGame; W.saveGame = function () { try { sync(); } catch (e) {} return oS.apply(this, arguments); }; }
  if (typeof W.loadGame === 'function') { var oL = W.loadGame; W.loadGame = function () { try { sync(); } catch (e) {} curP = null; var r = oL.apply(this, arguments); try { sync(); } catch (e) {} return r; }; Object.keys(oL).forEach(function (k) { if (!(k in W.loadGame)) W.loadGame[k] = oL[k]; }); }
  if (typeof W.gainItem === 'function') { var oG = W.gainItem; W.gainItem = function (id) { var r = oG.apply(this, arguments); if (id === ID) try { sync(); } catch (e) {} return r; }; }
  setInterval(function () { try { sync(); } catch (e) {} }, 500);
  try { W.addEventListener('storage', function (e) { if (e && e.key === KEY) try { sync(); } catch (x) {} }); } catch (e) {}
  // 背包不顯示鏡像
  if (typeof W.renderTabs === 'function') {
    var oT = W.renderTabs;
    W.renderTabs = function () {
      var p = P(); if (!ok(p) || !(p.inv || []).some(function (i) { return i && i.id === ID; })) return oT.apply(this, arguments);
      var isB = function (i) { return i && i.id === ID; }, bloods = p.inv.filter(isB);
      p.inv = p.inv.filter(function (i) { return !isB(i); });
      try { return oT.apply(this, arguments); } finally { p.inv = p.inv.filter(function (i) { return !isB(i); }).concat(bloods); }
    };
    try { (0, eval)('renderTabs = window.renderTabs'); } catch (e) {}
  }
  // 黑市上方：跟龍之鑽石一起顯示
  if (typeof W.pandoraRelicBalanceHTML === 'function') {
    var oB = W.pandoraRelicBalanceHTML;
    W.pandoraRelicBalanceHTML = function () { var h = oB.apply(this, arguments); try { var p = P(); if (ok(p)) h = String(h || '') + '<div class="text-sm" style="color:#fda4af;font-weight:700;margin-top:2px">🩸 血龍鑽：' + read().b.toLocaleString() + ' 顆（所有角色共用）</div>'; } catch (e) {} return h; };
  }
  W.addEventListener('load', function () { setTimeout(function () { try { sync(); } catch (e) {} }, 1500); });
})();
