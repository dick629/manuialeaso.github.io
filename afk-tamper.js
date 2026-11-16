/* ============================================================================
 * afk-tamper.js — 直接改角色資料的作弊（F12 寫進裝備格、改聖甲蟲／密奧／冒險點數）（Ping 11-16 定案；隱藏規則，不寫進任何玩家看得到的地方）
 *
 *   一、偵測（執行中）：遊戲自己的流程（遊戲迴圈、玩家真的點按鈕或按鍵、本站排的計時器、gainItem、讀檔）結束時記下「目前的樣子」，
 *       下一次遊戲流程開始時比對；中間被改掉的＝不是遊戲做的（主控台、書籤小程式、外部腳本）。
 *       追蹤：身上與背包的裝備（編號＋強化、祝福、遠古、屬性、符文、印記…）、聖甲蟲（等級、型態）、密奧之卡各張階段、冒險點數。
 *   二、偵測（第一次看到這個角色時，已經在存檔裡的）：
 *       ‧不可能的狀態：聖甲蟲等級超過該型態上限（沉睡 39、展翅 69）或型態不對。
 *       ‧防作弊上線（11-11）後才建立的角色：聖甲蟲、密奧、冒險點數、遺物強化合理時數加總 > 帳號遊玩時數 × 3 ＋ 5 小時 → 從時數最大的開始標記，直到不超過。
 *   三、標記後（不回收；面板、道具說明照常顯示）：
 *       ‧這個角色造成的傷害 −30%。
 *       ‧被標記的裝備：實際能力不算（重算能力時拿掉，面板另外算一份照常顯示）。
 *       ‧被標記的聖甲蟲：沒有任何效果（不加能力、不成長、變不成凱布利／拉）。
 *       ‧被標記的密奧之卡：用標記前最後一次正常的階段（存檔裡本來就有的＝沒有）。
 *       ‧被標記的冒險點數：用標記前最後一次正常的點數。
 *   管理者（anticheat 的 owner）不檢查；經典模式不檢查。管理密碼解鎖後 LineageTamper.list()／clear() 看與清除。
 * ========================================================================== */
(function (W) {
  'use strict';
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var AC = function () { return W.__afkAntiCheat || null; };
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var LOCAL = function () { try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !W.__afkAcTest; } catch (e) { return false; } };
  var exempt = function (p) { var a = AC(); try { return !p || p.classicMode || !!(a && a.isOwner(p)); } catch (e) { return true; } };
  var external = function () { var a = AC(); try { return !LOCAL() && !!(a && a.external && a.external()); } catch (e) { return false; } };
  var oSetTimeout = W.setTimeout, oSetInterval = W.setInterval;

  // ── 追蹤什麼：身上與背包的每一件（同一個物件、同一組強化數值）＋聖甲蟲、密奧、冒險點數 ──
  //   用「物件本身」記（WeakMap），比對只用數字，背包幾千件也只要零點幾毫秒。
  // 指紋只讀四個欄位（背包幾千件、每個遊戲迴圈都要比，讀太多欄位會慢）；新做出來的物件本身就會被抓到
  var nfp = function (it) { var id = it.id; return (it.en | 0) + (it.dimEn | 0) * 1024 + (it.blessLv | 0) * 1048576 + (id ? id.length * 1073741824 : 0); };
  var sh = function (s) { s = String(s); var h = 0; for (var i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
  var stOf = function (p) {
    var s = p.afkScarab, m = p.afkMio, h = p.afkHunter, mc = '';
    if (m && m.cards && typeof m.cards === 'object') { var ks = Object.keys(m.cards); for (var i = 0; i < ks.length; i++) mc += ks[i] + ':' + N(m.cards[ks[i]]) + ','; }
    return { scarab: s && typeof s === 'object' ? (s.got ? 1 : 0) + ',' + N(s.lv) + ',' + N(s.form) : '', mio: mc, hunter: h && typeof h === 'object' ? String(N(h.pts)) : '' };
  };
  var each = function (p, fn, eqOnly) {
    var eq = p.eq || {}, ks = Object.keys(eq), i, it;
    for (i = 0; i < ks.length; i++) { it = eq[ks[i]]; if (it && typeof it === 'object') fn(it, 'eq', ks[i]); }
    if (eqOnly) return;
    var inv = p.inv || []; for (i = 0; i < inv.length; i++) { it = inv[i]; if (it && typeof it === 'object') fn(it, 'inv'); }
  };

  // ── 標記紀錄（跟著角色存檔） ──
  var rec = function (p) { var r = p.afkTp; if (!r || typeof r !== 'object') r = p.afkTp = { v: 1, it: {}, k: {} }; r.it = r.it || {}; r.k = r.k || {}; return r; };
  var trusted = { };   // 目前角色最後一次正常的聖甲蟲／密奧／冒險點數
  var parseSt = function (p) { var s = p.afkScarab || {}, m = (p.afkMio && p.afkMio.cards) || {}, h = p.afkHunter || {}; var mc = {}; Object.keys(m).forEach(function (k) { mc[k] = N(m[k]); }); return { scarab: { lv: N(s.lv), form: N(s.form) }, mio: mc, hunter: N(h.pts) }; };
  var flagItem = function (p, it, why) { if (it._tq) return; it._tq = 1; if (it.uid != null) rec(p).it[it.uid] = why || 1; changed(); };
  var flagKind = function (p, k, snap) { var r = rec(p); if (r.k[k]) return; r.k[k] = snap == null ? { none: 1 } : { v: snap }; changed(); };
  var isItemBad = function (p, it) { return !!(it && (it._tq || (p && p.afkTp && p.afkTp.it && it.uid != null && p.afkTp.it[it.uid]))); };
  var anyBad = function (p) {
    if (!p || exempt(p) || !p.afkTp) return false;
    var r = p.afkTp; for (var k in r.k) if (r.k[k]) return true;
    var eq = p.eq || {}; for (var s in eq) if (eq[s] && isItemBad(p, eq[s])) return true;
    return false;
  };
  var cacheV = 0; var changed = function () { cacheV++; try { if (W.__afkMioRefresh) W.__afkMioRefresh(); } catch (e) {} };

  // ── 帳本：上一次遊戲流程結束時的樣子 ──
  var SYM = typeof Symbol === 'function' ? Symbol('t') : '__afkTpK', who = null, lastSt = null, pending = false, seenGain = {};
  var baseline = function (p) {
    who = p;
    each(p, function (it) { it[SYM] = nfp(it); });
    lastSt = stOf(p); trusted = parseSt(p); seenGain = {};
  };
  var setK = function (it) { var v = nfp(it); if (it[SYM] !== v) it[SYM] = v; };
  var absorb = function (light) {
    var p = P(); if (!p || exempt(p)) { who = null; return; }
    if (who !== p) { baseline(p); return; }
    each(p, setK, true);
    if (!light) { var inv = p.inv || [], it, v, id; for (var i = 0; i < inv.length; i++) { it = inv[i]; if (!it || typeof it !== 'object') continue; id = it.id; v = (it.en | 0) + (it.dimEn | 0) * 1024 + (it.blessLv | 0) * 1048576 + (id ? id.length * 1073741824 : 0); if (it[SYM] !== v) it[SYM] = v; } }
    var s = stOf(p);
    if (s.scarab !== lastSt.scarab || s.mio !== lastSt.mio || s.hunter !== lastSt.hunter) {
      var ps = parseSt(p), r = p.afkTp;
      ['scarab', 'mio', 'hunter'].forEach(function (k) { if (s[k] !== lastSt[k] && !(r && r.k && r.k[k])) trusted[k] = ps[k]; });
      lastSt = s;
    }
    seenGain = {};
  };
  var chk1 = function (p, it) {
    var k = it[SYM], v = nfp(it);
    if (k === undefined) { if (!(it.uid != null && seenGain[it.uid])) flagItem(p, it, 'new'); }
    else if (k !== v) flagItem(p, it, 'mod');
    it[SYM] = v;
  };
  var check = function (light) {
    var p = P(); if (!p || exempt(p)) { who = null; return; }
    if (pending) { pending = false; absorb(); return; }
    if (who !== p) { baseline(p); return; }
    each(p, function (it) { chk1(p, it); }, true);
    if (!light) {
      var inv = p.inv || [], it, v, k, id;
      for (var i = 0; i < inv.length; i++) {
        it = inv[i]; if (!it || typeof it !== 'object') continue;
        id = it.id; v = (it.en | 0) + (it.dimEn | 0) * 1024 + (it.blessLv | 0) * 1048576 + (id ? id.length * 1073741824 : 0); k = it[SYM];
        if (k === v) continue;
        chk1(p, it);
      }
    }
    var s = stOf(p);
    ['scarab', 'mio', 'hunter'].forEach(function (k2) { if (s[k2] !== lastSt[k2]) flagKind(p, k2, trusted[k2]); });
    lastSt = s; seenGain = {};
  };

  // ── 第一次看到這個角色（已經在存檔裡的） ──
  var LEGACY_HOURS = false;
  var FORM_MAX = [0, 49, 74, 100];   // 11-16 聖甲蟲新分段（舊的 39／69 也在這範圍內）
  var scarabExp = function (lv) { var S = W.__afkScarab, t = 0; if (!S || !S.need) return 0; for (var i = 1; i < lv; i++) t += S.need(i); return t; };
  var MIO_H = [0, 5, 15, 30, 60, 150, 300];
  var relicH = function (it) {
    var d = DB.items[it.id]; if (!d || !(d.relic || d.relicBase || /^relic_/.test(String(it.id)))) return 0;
    var en = N(it.en), h = 1 + (en <= 5 ? en : en <= 10 ? 5 + (en - 5) * 10 : 55 + (en - 10) * 5);
    if (d.relicAsc != null) h += N(d.relicAsc) * 2;
    if (d.relicEvo != null) h += 25;
    var a = AC(); try { if (a && a.costOf) h = Math.max(h, N(a.costOf(it))); } catch (e) {}
    return h;
  };
  var legacy = function (p) {
    var r = rec(p); if (r.lg) return; r.lg = 1;
    if (W.__afkTpNoLegacy) return;   // 自動測試用
    var s = p.afkScarab;
    if (s && typeof s === 'object' && (N(s.form) < 1 || N(s.form) > 3 || N(s.lv) > FORM_MAX[Math.max(1, Math.min(3, N(s.form)))] || N(s.lv) > 100)) flagKind(p, 'scarab', null);
    var a = AC(); if (!LEGACY_HOURS || !a || !a.acct) return;   // 11-16：遊玩時數只從 11-11 開始記，用時數判斷會誤判老角色 → 先關掉，等 Ping 決定
    var budget = N(a.acct().ms) / 3600000 * 3 + 5, list = [];
    if (s && s.got && !r.k.scarab) list.push({ h: scarabExp(N(s.lv)) / 600000, f: function () { flagKind(p, 'scarab', null); } });
    var mc = (p.afkMio && p.afkMio.cards) || {}, mh = 0; Object.keys(mc).forEach(function (k) { var st = Math.max(0, Math.min(6, N(mc[k]))); mh += MIO_H[st]; });
    if (mh) list.push({ h: mh, f: function () { flagKind(p, 'mio', null); } });
    var hp = N(p.afkHunter && p.afkHunter.pts); if (hp > 0) list.push({ h: hp / 60, f: function () { flagKind(p, 'hunter', null); } });
    each(p, function (it) { var h = relicH(it); if (h > 0) list.push({ h: h, f: function () { flagItem(p, it, 'legacy'); } }); });
    var tot = list.reduce(function (t, x) { return t + x.h; }, 0);
    list.sort(function (x, y) { return y.h - x.h; });
    for (var i = 0; i < list.length && tot > budget; i++) { list[i].f(); tot -= list[i].h; }
  };

  // ── 懲罰 ──
  var view = 0;
  W.__afkTpView = function () { return view > 0; };
  W.__afkTpBad = function (p, k) { return !!(p && view === 0 && !exempt(p) && p.afkTp && p.afkTp.k && p.afkTp.k[k]); };
  W.__afkTpCards = function (p, cards) { if (!W.__afkTpBad(p, 'mio')) return cards; var x = p.afkTp.k.mio; return (x && x.v) || {}; };
  W.__afkTpNum = function (p, k, v) { if (!W.__afkTpBad(p, k)) return v; var x = p.afkTp.k[k]; return x && x.v != null ? N(x.v) : 0; };
  W.__afkTpCacheV = function () { return cacheV * 2 + (view > 0 ? 1 : 0); };
  // 造成的傷害 −30%
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkTp) return;
    var o = C.damage;
    C.damage = function (actor) { var r = o.apply(this, arguments); try { var p = P(); if (r > 0 && actor && actor === p && anyBad(p)) r = Math.max(1, Math.floor(r * 0.7)); } catch (e) {} return r; };
    C.damage.__afkTp = true;
  };
  // 能力：面板一份（照常）、實際一份（拿掉被標記的東西）
  var SKIP = { hp: 1, mp: 1, exp: 1, gold: 1, lv: 1, dead: 1 };
  var topNums = function (p) { var o = {}; Object.keys(p).forEach(function (k) { if (!SKIP[k] && typeof p[k] === 'number') o[k] = p[k]; }); return o; };
  var swap = null;   // { real: {d, top}, disp: {d, top} }
  var disp = null;   // 目前角色的面板版
  var unswapNow = function () { var p = P(); if (!swap || !p) return null; var s = swap; p.d = s.realD; Object.keys(s.realTop).forEach(function (k) { p[k] = s.realTop[k]; }); if (s.ratioHp != null) { p.hp = s.realHp; p.mp = s.realMp; } swap = null; return s; };
  var swapIn = function () {
    var p = P(); if (!p || !disp || disp.who !== p || swap) return false;
    var s = { realD: p.d, realTop: {}, realHp: p.hp, realMp: p.mp, ratioHp: null };
    Object.keys(disp.top).forEach(function (k) { s.realTop[k] = p[k]; p[k] = disp.top[k]; });
    if (disp.top.mhp != null && s.realTop.mhp) { s.ratioHp = 1; p.hp = Math.round(N(s.realHp) / Math.max(1, N(s.realTop.mhp)) * N(disp.top.mhp)); }
    if (disp.top.mmp != null && s.realTop.mmp) p.mp = Math.round(N(s.realMp) / Math.max(1, N(s.realTop.mmp)) * N(disp.top.mmp));
    p.d = disp.d; swap = s; return true;
  };
  var swapOut = function () {
    var p = P(), s = swap; if (!s || !p) { swap = null; return; }
    // 面板期間有人改了 hp／mp（例如點了喝水）：換回實際的比例
    if (s.ratioHp != null || disp.top.mmp != null) {
      var dh = N(p.hp), dm = N(p.mp);
      p.d = s.realD; Object.keys(s.realTop).forEach(function (k) { p[k] = s.realTop[k]; });
      p.hp = disp.top.mhp ? Math.round(dh / Math.max(1, N(disp.top.mhp)) * N(p.mhp)) : s.realHp;
      p.mp = disp.top.mmp ? Math.round(dm / Math.max(1, N(disp.top.mmp)) * N(p.mmp)) : s.realMp;
    } else { p.d = s.realD; Object.keys(s.realTop).forEach(function (k) { p[k] = s.realTop[k]; }); }
    swap = null;
  };
  var wrapView = function (name) {
    var o = W[name]; if (typeof o !== 'function' || o.__afkTp) return;
    var f = function () {
      var p = P(), need = p && disp && disp.who === p && !swap && anyBad(p);
      if (!need) return o.apply(this, arguments);
      view++; var did = swapIn();
      try { return o.apply(this, arguments); } finally { if (did) swapOut(); view--; }
    };
    f.__afkTp = true; W[name] = f;
    try { (0, eval)(name + ' = window.' + name); } catch (e) {}
  };
  var rsDepth = 0;   // 這支可能被包好幾層（之後的外掛包在外面，又被重新包回最外層）：共用同一個深度
  var wrapRecompute = function () {
    var o = W.recomputeStats; if (typeof o !== 'function' || o.__afkTp) return;
    var f = function () {
      var p = P();
      if (rsDepth > 0) return o.apply(this, arguments);   // 重算裡面又叫重算：照目前這一輪（面板版或實際版）算
      if (!p || !anyBad(p)) { disp = null; return o.apply(this, arguments); }
      rsDepth++;
      try {
      var was = unswapNow(), r;
      // 面板版：全部照算
      view++; try { o.apply(this, arguments); } finally { view--; }
      var dD = Object.assign({}, p.d), dTop = topNums(p);
      // 實際版：拿掉被標記的裝備
      var hid = [];
      Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k]; if (it && isItemBad(p, it)) { hid.push([k, it]); p.eq[k] = null; } });
      try { r = o.apply(this, arguments); } finally { hid.forEach(function (x) { if (!p.eq[x[0]]) p.eq[x[0]] = x[1]; }); }
      var rTop = topNums(p), top = {};
      Object.keys(dTop).forEach(function (k) { if (dTop[k] !== rTop[k]) top[k] = dTop[k]; });
      disp = { who: p, d: dD, top: top };
      if (was) { view++; swapIn(); view--; }
      return r;
      } finally { rsDepth--; }
    };
    f.__afkTp = true; W.recomputeStats = f;
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  };

  // ── 遊戲流程的邊界 ──
  var wrapTick = function () {
    var o = W.tick; if (typeof o !== 'function' || o.__afkTpTick) return;
    var f = function () {
      if (tkDepth > 0) return o.apply(this, arguments);   // 被包了好幾層：只有最外層做
      tkDepth++;
      try { return tk1.call(this, o, arguments); } finally { tkDepth--; }
    };
    f.__afkTpTick = true; W.tick = f;
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  };
  var tkDepth = 0, inFF = false, ffN = 0;
  var tk1 = function (o, args) {
    {
      var ff = !!(typeof state !== 'undefined' && state && state.ff);
      // 離線補跑（一次跑幾千個迴圈）：開始時比一次，中間每 200 個迴圈記一次，結束時記下，不然補跑會變慢
      if (ff) { if (!inFF) { inFF = true; ffN = 0; try { check(); } catch (e) {} } try { return o.apply(this, args); } finally { if (++ffN % 200 === 0) { try { absorb(); } catch (e) {} } } }
      if (inFF) { inFF = false; try { absorb(); } catch (e) {} } else { try { check(); } catch (e) {} }
      try { return o.apply(this, args); } finally { try { absorb(); } catch (e) {} }
    }
  };
  // 玩家真的點、按：開始前比對，結束後（含後面的非同步）記下
  ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'change', 'input', 'touchend', 'submit'].forEach(function (ev) {
    W.addEventListener(ev, function (e) {
      if (!e.isTrusted) return;
      try { if (!pending) check(); } catch (er) {}
      pending = true;
      oSetTimeout.call(W, function () { try { absorb(); } catch (er) {} pending = false; }, 0);
    }, true);
  });
  // 本站排的計時器：開始前比對、結束後記下（主控台排的不算）
  var wrapTimer = function (orig, name) {
    W[name] = function (cb) {
      if (typeof cb !== 'function' || external()) return orig.apply(W, arguments);
      var args = Array.prototype.slice.call(arguments);
      args[0] = function () { try { check(true); } catch (e) {} try { return cb.apply(this, arguments); } finally { try { absorb(true); } catch (e) {} } };   // 計時器只比身上與狀態（背包每個遊戲迴圈比一次）
      return orig.apply(W, args);
    };
  };
  wrapTimer(oSetTimeout, 'setTimeout'); wrapTimer(oSetInterval, 'setInterval');
  if (typeof W.requestIdleCallback === 'function') wrapTimer(W.requestIdleCallback, 'requestIdleCallback');
  // gainItem 給的（已經擋掉主控台呼叫）＝正常
  var wrapGain = function () {
    var o = W.gainItem; if (typeof o !== 'function' || o.__afkTp) return;
    var f = function () { var r = o.apply(this, arguments); try { if (r && typeof r === 'object' && !external()) { if (r.uid != null) seenGain[r.uid] = 1; r[SYM] = nfp(r); } } catch (e) {} return r; };
    f.__afkTp = true; W.gainItem = f;
    try { (0, eval)('gainItem = window.gainItem'); } catch (e) {}
  };
  var wrapLoad = function () {
    var o = W.loadGame; if (typeof o !== 'function' || o.__afkTp) return;
    var f = function () {
      var r = o.apply(this, arguments);
      try { var p = P(); disp = null; swap = null; if (p && !exempt(p)) { legacy(p); baseline(p); if (anyBad(p)) recomputeStats(); } else who = null; } catch (e) { console.warn('[AFK-tamper] load', e); }
      return r;
    };
    f.__afkTp = true; W.loadGame = f;
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  };
  var install = function () { wrapTick(); wrapGain(); wrapLoad(); wrapRecompute(); wrapView('updateUI'); wrapView('renderTabs'); wrapView('interactNPC'); hookDmg(); };
  install();
  W.addEventListener('load', function () { install(); oSetTimeout.call(W, install, 0); oSetTimeout.call(W, install, 3000); });
  oSetInterval.call(W, install, 10000);   // 之後才包上去的外掛：重新包在最外層

  // ── 非同步流程（伺服器交易、轉移）自己呼叫 ──
  W.__afkTpAbsorb = function () { if (!external()) { try { absorb(); } catch (e) {} } };
  // ── 管理 ──
  var adminOk = function () { try { return !!(W.LineageAdmin && W.LineageAdmin.account && W.LineageAdmin.account()); } catch (e) { return false; } };
  W.LineageTamper = Object.freeze({
    list: function () {
      if (!adminOk()) return null; var p = P(); if (!p) return null; var r = rec(p), out = { kinds: Object.keys(r.k), items: [] };
      each(p, function (it, where, k) { if (isItemBad(p, it)) { var d = DB.items[it.id]; out.items.push((d ? d.n : it.id) + '（' + (where === 'eq' ? '穿著 ' + k : '背包') + '・' + (r.it[it.uid] || '') + '）'); } });
      return out;
    },
    clear: function (what) {
      if (!adminOk()) return false; var p = P(); if (!p) return false; var r = rec(p);
      if (what === 'all' || what === 'scarab' || what === 'mio' || what === 'hunter') { (what === 'all' ? Object.keys(r.k) : [what]).forEach(function (k) { delete r.k[k]; }); }
      if (what === 'all' || what === 'items') { each(p, function (it) { delete it._tq; }); r.it = {}; }
      changed(); baseline(p); try { recomputeStats(); updateUI(); saveGame(); } catch (e) {} return true;
    }
  });
  W.__afkTamper = { disp: function () { return disp; }, check: check, absorb: absorb, baseline: baseline, legacy: legacy, anyBad: anyBad, isItemBad: isItemBad, rec: rec, relicH: relicH, scarabExp: scarabExp };
})(window);
