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
    if (!d || !d.relic || !d.n || d.gmOnly || d.relicNoStack || d.noTrade || d.bossRelic || d.bossRelicKey) return false;
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

/* ============================================================================
 * 潘朵拉黑市「遺物上架」（Ping 11-23 10:16～10:23）
 *   ‧移除遺物布告欄（進行中的委託不再顯示、不退龍鑽）。
 *   ‧黑市 24 格每次換格 1% 換上一件 +0 遺物（平均抽一件可賣的遺物）。
 *   ‧價格（全部血龍鑽，11-23 10:32）：一般 20～55 萬、高一階（來源小怪 Lv65 以上）55～105 萬、
 *          王者遺物 30～52.5 萬、王遺物（來源是王）82.5～157.5 萬；
 *          底價隨機，再依同級強度（來源怪等級）加 0～30%，可以超過上限；
 *          再乘每日漲價 1.01^天數（2026-11-23 起算，最多 365 天）。
 *   ‧整個帳號累計刷出 5 件 → 12 小時內刷不出遺物，之後重新計數。
 *   ‧防刷（11-23 10:41）：帳號紀錄存瀏覽器＋每個角色存檔，加簽章取最嚴格；遺物格加簽章；
 *     冷卻中時間往後跳超過 24 小時 → 冷卻重新計 12 小時。
 *   ‧經典模式沒有。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !W.__afkRelicShop) return;
  var KEY = 'afk_bmrelic_v1', RATE = 0.01, CAP = 5, CD_MS = 12 * 3600000, BOOST = 0.30, BLOOD = 'afk_blood_dia';
  var BAND = {
    mob: { cur: 'blood', lo: 350000, hi: 850000 },     // 11-23 15:47 Ping 調價（全部血龍鑽）
    high: { cur: 'blood', lo: 850000, hi: 1550000 },
    king: { cur: 'blood', lo: 1000000, hi: 2525000 },
    boss: { cur: 'blood', lo: 1825000, hi: 3575000 }
  };
  var CUR_N = { dia: '龍之鑽石', blood: '血龍鑽' };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return (Number(n) || 0).toLocaleString(); };
  var active = function () { var p = P(); return !!p && !p.classicMode; };

  // ── 分級：王者系列＝relic_boss_*；其他看最容易拿的來源怪（有小怪來源就用小怪）──
  var INFO = null;
  var build = function () {
    var mobs = {}; Object.keys(DB.mobs || {}).forEach(function (k) { var m = DB.mobs[k]; if (!m || !m.n) return; var o = mobs[m.n] || (mobs[m.n] = { lv: 1e9, hp: 0, boss: true }); o.lv = Math.min(o.lv, Number(m.lv) || 0); o.hp = Math.max(o.hp, Number(m.hp) || 0); if (!m.boss) o.boss = false; });
    var src = {};
    try { Object.keys(MOB_DROPS).forEach(function (mn) { (MOB_DROPS[mn] || []).forEach(function (x) { if (x && x[0]) (src[x[0]] = src[x[0]] || []).push(mn); }); }); } catch (e) {}
    var base = function (id) {
      var d = DB.items[id];
      if (!d || !d.relic || !d.n || d.gmOnly || d.relicNoStack || d.noTrade || d.dimRelic || /^dimr_/.test(id) || d.relicEvo != null) return false;
      if (d.relicBase && d.relicBase !== id) return false;
      if (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') return false;
      return W.__afkRelicShop.sellable(id) || !!d.bossRelicKey;
    };
    var out = {}, by = { mob: [], high: [], king: [], boss: [] };
    Object.keys(DB.items).forEach(function (id) {
      if (!base(id)) return;
      var band, lv, hp = 0;
      if (/^relic_boss_/.test(id)) { band = 'king'; lv = 0; (src[id] || []).forEach(function (mn) { if (mobs[mn]) { lv = Math.max(lv, mobs[mn].lv); hp = Math.max(hp, mobs[mn].hp); } }); }
      else {
        var ss = (src[id] || []).map(function (mn) { return mobs[mn]; }).filter(Boolean); if (!ss.length) return;   // 沒有掉落來源（任務、活動）不賣
        var small = ss.filter(function (m) { return !m.boss; }), pick = small.length ? small : ss;
        var e = pick.slice().sort(function (x, y) { return x.lv - y.lv || x.hp - y.hp; })[0]; lv = e.lv; hp = e.hp;
        band = small.length ? (lv >= 65 ? 'high' : 'mob') : 'boss';
      }
      out[id] = { band: band, lv: lv, hp: hp }; by[band].push(id);
    });
    Object.keys(by).forEach(function (b) {   // 同級強度：來源怪等級（同等級再比 HP）排名 → 0～1，同分取平均名次
      var key = function (id) { return out[id].lv * 1e12 + out[id].hp; };
      var l = by[b].slice().sort(function (x, y) { return key(x) - key(y); }), n = l.length, i = 0;
      while (i < n) { var j = i; while (j + 1 < n && key(l[j + 1]) === key(l[i])) j++; var v = n > 1 ? ((i + j) / 2) / (n - 1) : 0; for (var k = i; k <= j; k++) out[l[k]].str = v; i = j + 1; }
    });
    INFO = { map: out, list: Object.keys(out), by: by };
    return INFO;
  };
  var info = function () { return INFO || build(); };

  // ── 帳號計數（累計刷出 5 件 → 12 小時冷卻）──
  // 帳號紀錄（Ping 11-23 10:41）：瀏覽器一份＋每個角色存檔各一份，都加簽章；讀的時候取最嚴格的那份。
  //   e＝第幾輪冷卻、n＝這一輪已刷出幾件、cd＝冷卻到何時、day＝漲價天數、last＝最後看到的時間。
  //   簽章對不上＝被改過 → 當成冷卻中（重新計 12 小時）。
  var SALT = 'bmr:9f3:';
  var fnv = function (str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(36); };
  var aSig = function (a) { return fnv(SALT + [a.e, a.n, a.cd, a.day, a.last].join('|')); };
  var norm = function (a) { return { e: Number(a.e) || 0, n: Number(a.n) || 0, cd: Number(a.cd) || 0, day: Number(a.day) || 0, last: Number(a.last) || 0 }; };
  var readOne = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var a = norm(raw); a.bad = raw.k !== aSig(a); return a;
  };
  var acct = function () {
    var L = null; try { L = readOne(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { L = null; }
    var p = P(), S = p ? readOne(p.afkBmRelicAcct) : null;
    var list = [L, S].filter(Boolean), now = Date.now();
    var a = { e: 0, n: 0, cd: 0, day: 0, last: 0 }, bad = false;
    list.forEach(function (x) {
      if (x.bad) { bad = true; }
      if (x.e > a.e) { a.e = x.e; a.n = x.n; } else if (x.e === a.e) a.n = Math.max(a.n, x.n);
      a.cd = Math.max(a.cd, x.cd); a.day = Math.max(a.day, x.day); a.last = Math.max(a.last, x.last);
    });
    if (bad) { a.e += 1; a.n = 0; a.cd = Math.max(a.cd, now + CD_MS); }
    // 時間往後跳超過 24 小時、而且當時在冷卻中 → 冷卻不解除，從現在重新計 12 小時
    if (a.last && now - a.last > 86400000 && a.cd > a.last) a.cd = now + CD_MS;
    if (now > a.last) a.last = now;
    if (bad || !L || !S || L.e !== a.e || L.n !== a.n || L.cd !== a.cd || L.day !== a.day || S.cd !== a.cd || S.day !== a.day) acctSave(a);
    return a;
  };
  var acctSave = function (a) {
    var o = norm(a); o.k = aSig(o);
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    var p = P(); if (p) p.afkBmRelicAcct = { e: o.e, n: o.n, cd: o.cd, day: o.day, last: o.last, k: o.k };
  };
  var coolLeft = function () { var a = acct(); return Math.max(0, (Number(a.cd) || 0) - Date.now()); };
  setInterval(function () { try { if (P()) acct(); } catch (e) {} }, 60000);
  // 遺物格簽章：上架時蓋、購買時驗，對不上就不能買
  var sSig = function (s) { return fnv(SALT + 'slot|' + [s.id, s.price, s.afkCur, s.setTick].join('|')); };
  var rng = function (tag) { try { if (typeof lootRng === 'function') return lootRng(tag); } catch (e) {} return Math.random(); };
  // 每日漲價（Ping 11-23 10:35／10:36）：從 2026-11-23（台灣時間）起每天 ×1.01 複利，最多算 365 天；
  //   天數只增不減（記在帳號計數裡），調回系統時間也不會變便宜。
  var INF_START = Date.UTC(2026, 10, 22, 16, 0, 0), INF_DAYS = 365, INF_RATE = 1.01;
  var infDay = function () {
    var d = Math.floor((Date.now() - INF_START) / 86400000); if (!(d > 0)) d = 0;
    var a = acct(); if ((Number(a.day) || 0) > d) d = Number(a.day) || 0; else if (d > (Number(a.day) || 0)) { a.day = d; acctSave(a); }
    return Math.min(INF_DAYS, d);
  };
  var infMult = function () { return Math.pow(INF_RATE, infDay()); };
  var priceOf = function (id) {
    var I = info().map[id], B = BAND[I.band];
    var v = B.lo + rng('afkBmRelicPrice') * (B.hi - B.lo);
    v *= 1 + BOOST * (I.str || 0);
    v *= infMult();
    return { cur: B.cur, price: Math.max(1000, Math.round(v / 1000) * 1000) };
  };
  var roll = function (nowT) {
    if (!active() || coolLeft() > 0) return null;
    if (rng('afkBmRelic') >= RATE) return null;
    var L = info().list; if (!L.length) return null;
    var id = L[Math.min(L.length - 1, Math.floor(rng('afkBmRelicPick') * L.length))], pr = priceOf(id);
    var a = acct(); a.n += 1; if (a.n >= CAP) { a.n = 0; a.e += 1; a.cd = Date.now() + CD_MS; } acctSave(a);
    try { if (typeof logSys === 'function') logSys('<span class="text-amber-300 font-bold">🏺【潘朵拉黑市】上架了遺物：' + esc(DB.items[id].n) + '（' + fmt(pr.price) + ' ' + CUR_N[pr.cur] + '）！</span>'); } catch (e) {}
    var slot = { id: id, price: pr.price, afkCur: pr.cur, afkRelic: 1, weight: 1, setTick: nowT, sold: false, bless: false }; slot.k = sSig(slot); return slot;
  };
  var oStock = W._pandoraStock;
  if (typeof oStock === 'function') {
    W._pandoraStock = function (nowT, market, idx) {
      var s = oStock.apply(this, arguments);
      try { if (s && !s.buyOrder) { var r = roll(nowT); if (r) return r; } } catch (e) { console.warn('[AFK-bmrelic] stock', e); }
      return s;
    };
  }
  var oLog = W._pandoraLogLatest;
  if (typeof oLog === 'function') W._pandoraLogLatest = function (slot) { if (slot && slot.afkRelic) return; return oLog.apply(this, arguments); };

  // ── 購買 ──
  var bloodHave = function () { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && i.id === BLOOD; }).reduce(function (n, i) { return n + (Number(i.cnt) || 1); }, 0) : 0; };
  var have = function (cur) { if (cur === 'blood') return bloodHave(); try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var pay = function (cur, n) {
    if (cur === 'dia') { var r = W.pandoraAdjustSharedDiamonds(-n); return !!(r && r.ok); }
    var p = P(); if (!p || bloodHave() < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== BLOOD) continue; var q = Math.min(n, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var msg = function (h) { var e = document.getElementById('pandora-msg'); if (e) e.innerHTML = h; };
  var oBuy = W.buyPandoraItem;
  if (typeof oBuy === 'function') {
    W.buyPandoraItem = function (i) {
      var p = P(), m = p && p.pandoraMarket2, s = m && m.slots && m.slots[i];
      var d0 = s && DB.items[s.id];
      if (s && !s.sold && ((d0 && d0.relic) || s.afkRelic) && (!s.afkRelic || s.k !== sSig(s))) { s.sold = true; msg('<span class="text-red-400">這件商品的資料不正確，已經下架。</span>'); try { pandoraRenderMarket(_pandoraDiv); } catch (e) {} return; }   // 被改過的遺物格（價格、憑空塞進來的）
      if (!s || !s.afkRelic) return oBuy.apply(this, arguments);
      var d = DB.items[s.id];
      if (!d) { msg('<span class="text-red-400">商品已不存在。</span>'); return; }
      if (s.sold) { msg('<span class="text-red-400">此商品已售出，請等待該格輪換。</span>'); return; }
      if (!active()) { msg('<span class="text-red-400">經典模式不能買遺物。</span>'); return; }
      var cn = CUR_N[s.afkCur] || '龍之鑽石';
      if (have(s.afkCur) < s.price) { msg('<span class="text-red-400">' + cn + '不夠！要 ' + fmt(s.price) + '。</span>'); return; }
      if (!confirm('花 ' + fmt(s.price) + ' ' + cn + '買 +0「' + d.n + '」？')) return;
      if (s.sold || have(s.afkCur) < s.price || !pay(s.afkCur, s.price)) { msg('<span class="text-red-400">購買失敗，' + cn + '不夠。</span>'); return; }
      s.sold = true;
      try { gainItem(s.id, 1, true, true, false); } catch (e) { console.warn('[AFK-bmrelic] gain', e); }
      try { logSys('在潘朵拉黑市花費 <span class="text-amber-300">' + fmt(s.price) + '</span> ' + cn + '購買了 <span class="font-bold ' + (typeof getItemColor === 'function' ? getItemColor({ id: s.id }) : '') + '">' + esc(d.n) + '</span>。'); } catch (e) {}
      if (p.pandoraAnnounce === s.id) { p.pandoraAnnounce = null; p.pandoraAnnounceBless = false; try { renderPandoraBanner(); } catch (e) {} }
      try { updateUI(); saveGame(); } catch (e) {}
      try { pandoraTipHide(); } catch (e) {}
      try { pandoraRenderMarket(_pandoraDiv); } catch (e) {}
      try { renderSyslogPandora(); } catch (e) {}
      msg('<span class="text-green-400">購買成功！</span>');
    };
  }

  // ── 畫面：遺物格金框＋價格幣別；拿掉遺物布告欄 ──
  W.pandoraRelicBoardHTML = function () { return ''; };
  W.pandoraRelicSuggestionHTML = function () { return ''; };
  W.pandoraTryRelicSearchFromInputs = function () { return false; };
  var oRender = W.pandoraRenderMarket;
  if (typeof oRender === 'function') {
    W.pandoraRenderMarket = function (div) {
      var r = oRender.apply(this, arguments);
      try {
        if (!div) return r;
        var nav = div.querySelector('[data-market-section="pandora-relic-board"]'); if (nav) nav.remove();
        var p = P(), m = p && p.pandoraMarket2; if (!m || !Array.isArray(m.slots)) return r;
        var cards = div.querySelectorAll('.pandora-market-card'), ci = 0;
        m.slots.forEach(function (s, i) {
          if (!s || !DB.items[s.id]) return;
          var c = cards[ci++]; if (!c || !s.afkRelic) return;
          c.style.borderColor = '#f59e0b'; c.style.boxShadow = '0 0 10px rgba(245,158,11,.55)';
          var cn = CUR_N[s.afkCur] || '龍之鑽石', pe = c.querySelector('.pandora-card-price');
          if (pe) { pe.innerHTML = fmt(s.price) + '<span class="text-slate-500"> ' + (s.afkCur === 'blood' ? '血龍鑽' : '龍鑽') + '</span>'; pe.style.color = s.afkCur === 'blood' ? '#fda4af' : '#67e8f9'; }
          var b = c.querySelector('button'); if (!b || s.sold) return;
          var ok = have(s.afkCur) >= s.price;
          b.disabled = !ok;
          b.className = 'btn shrink-0 ' + (ok ? 'bg-amber-700 hover:bg-amber-600 border-amber-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed') + ' font-bold rounded pandora-card-buy';
        });
      } catch (e) { console.warn('[AFK-bmrelic] render', e); }
      return r;
    };
  }
  var oTip = W.pandoraTipShow;
  if (typeof oTip === 'function') {
    W.pandoraTipShow = function (ev, i) {
      var r = oTip.apply(this, arguments);
      try {
        var p = P(), s = p && p.pandoraMarket2 && p.pandoraMarket2.slots[i]; if (!s || !s.afkRelic) return r;
        var el = document.getElementById('pandora-tooltip'), pe = el && el.querySelector('.text-yellow-300');
        if (pe) pe.innerHTML = '售價 ' + fmt(s.price) + ' ' + (CUR_N[s.afkCur] || '龍之鑽石') + '<span style="color:#f59e0b;">（遺物）</span>' + (s.sold ? '<span style="color:#64748b;">（已售出）</span>' : '');
      } catch (e) {}
      return r;
    };
  }
  W.__afkBmRelic = { infDay: infDay, infMult: infMult, info: info, coolLeft: coolLeft, acct: acct, RATE: RATE, CAP: CAP, CD_MS: CD_MS, BAND: BAND, BOOST: BOOST, _roll: roll, _priceOf: priceOf };
})();

/* ============================================================================
 * 潘朵拉黑市金幣價格 ×3（Ping 11-23 10:57／11:19：金幣商品提高 200%，收購單一起漲）
 *   ‧卡片價格區間 ×3（陳列與收購單共用）；一般商品陳列價 ×3；收購單擲的市價基準 ×3。
 *   ‧黑市收購價提示讀同一組函式，區間自動跟著變。已在架上的商品維持上架時的價格。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, K = 3;
  var oRange = W.pandoraCardPriceRange, oPrice = W.pandoraPrice, oProf = W.pandoraBuyOrderPriceProfile;
  if (typeof oRange === 'function') W.pandoraCardPriceRange = function (d) { var r = oRange.apply(this, arguments); return r ? { min: r.min * K, max: r.max * K } : r; };
  if (typeof oPrice === 'function') W.pandoraPrice = function (id) { var d = DB.items[id]; var v = oPrice.apply(this, arguments); return (d && d.eff === 'card') ? v : Math.max(1, Math.round(v * K)); };   // 卡片已經在區間 ×3 了
  if (typeof oProf === 'function') W.pandoraBuyOrderPriceProfile = function (id) { var r = oProf.apply(this, arguments); if (r) r = Object.assign({}, r, { base: r.base * K }); return r; };
  W.__afkPandoraGoldK = K;
})();

/* 收購單不能指定遺物（Ping 11-23 16:14）：黑市的遺物只會隨機上架。
 *   核心 pandoraBuyOrderAllowed 只擋 d.relic，次元遺物（dimr_、dimRelic）漏掉 → 這裡補擋所有遺物；
 *   已經掛著的遺物收購單，下次換格時清掉。 */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var isR = function (id) { var d = DB.items[id]; return !!(d && (d.relic || d.dimRelic || /^dimr_/.test(String(id)) || (typeof isRelic === 'function' && isRelic(d)))); };
  var oAllow = W.pandoraBuyOrderAllowed;
  if (typeof oAllow === 'function') W.pandoraBuyOrderAllowed = function (id) { if (isR(id)) return false; return oAllow.apply(this, arguments); };
  var oStock = W._pandoraStock;
  if (typeof oStock === 'function') W._pandoraStock = function (nowT, market) { try { if (market && market.buyOrder && isR(market.buyOrder.id)) market.buyOrder = null; } catch (e) {} return oStock.apply(this, arguments); };
})();
