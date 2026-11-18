/* ============================================================================
 * afk-trade.js — 潘朵拉黑市「寄賣攤」（玩家之間一口價買賣；Ping 2026-11-16 定案）
 *
 *   伺服器：旅人頻道同一台（backend/heartbeat 的 /mkt/*），共用旅人身分（afk-heartbeat 的 uid＋token）。
 *   規則（伺服器把關，這裡只做提示）：
 *     ‧貨幣＝血龍鑽（afk_blood_dia，從「目前角色」背包扣、入帳）
 *     ‧定價下限 500、沒有上限；上架費 2%（無條件進位，按下就扣、不退）；成交手續費 5%（賣家實拿 95%）
 *     ‧上架 24 小時；同時最多 3 件；每天上架 3 次、購買 5 件（台灣時間 00:00 換日）
 *     ‧旅人身分建立 72 小時內不能上架（可以買）
 *     ‧同一件物品（物品編號）全服只能上架一次；買到、領回的物品會換新編號
 *   可以賣：可強化的武器／防具／飾品（+15 以下）、遺物、席琳遺骸、怪物卡片（一次 ≤10）、8 級以上的法術書（一次 ≤10）、卷軸（一次 ≤100）
 *   不能賣：上鎖的、身上穿的、消耗品、材料、任務道具、寵物、魔法娃娃等
 *   只能在村莊上架、購買、領取（野外只能瀏覽）。
 *   用完整備份或轉移碼還原、或匯入角色後 24 小時內不能上架和購買。
 *
 *   防重複（沒有雲端存檔，所以靠「先扣再送、記帳、對帳」）：
 *     上架：先記帳（localStorage afk_mkt_jr）→ 從背包拿走物品＋扣上架費 → 存檔 → 送出。
 *           伺服器明確拒絕＝退回物品與上架費；連線中斷＝留著帳，下次打開寄賣攤時跟伺服器對帳（有這筆＝完成，沒有＝退回）。
 *     購買：先記帳 → 扣血龍鑽 → 存檔 → 送出；同樣拒絕就退錢、中斷就對帳。
 *     交貨：伺服器的「待交貨」入帳後記在 afk_mkt_done（最多 300 筆）→ 存檔 → 回報「已收到」；回報沒送到也不會重複入帳。
 *   API：W.__afkTrade = { open, catOf, state }
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'trade', name: '寄賣攤（潘朵拉黑市）', group: '遊戲內容', def: true,
    desc: '潘朵拉黑市多一個分頁：跟其他玩家用血龍鑽一口價買賣裝備、遺物、遺骸、卡片、法術書、卷軸（要連旅人伺服器）' });
  if (typeof DB === 'undefined' || !DB.items) return;
  var on = function () { return !T || T.enabled('trade'); };
  var BLOOD = 'afk_blood_dia';
  var RULE = { minPrice: 500, postFee: 0.02, saleFee: 0.05, listMs: 24 * 3600000, maxActive: 3, postPerDay: 3, buyPerDay: 5, cats: { equip: 1, relic: 1, remains: 1, card: 10, book: 10, scroll: 100 } };
  var CAT_N = { equip: '裝備', relic: '遺物', remains: '席琳遺骸', card: '卡片', book: '法術書', scroll: '卷軸' };
  var COOL_MS = 24 * 3600000, K_JR = 'afk_mkt_jr', K_DONE = 'afk_mkt_done', K_RESTORE = 'afk_mkt_restore';

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  var jget = function (k, d) { try { var v = JSON.parse(get(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  var HB = function () { return W.AFK_HEARTBEAT || null; };
  var api = function () { var h = HB(); try { return h && h.api ? h.api() : ''; } catch (e) { return ''; } };
  var inTown = function () { var id = (typeof mapState !== 'undefined' && mapState) ? mapState.current : ''; return !!(id && (DB.towns && DB.towns[id] || /^town_/.test(id))); };
  var plain = function (html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  var nameOf = function (it) { try { return plain(getItemFullName(Object.assign({}, it, { cnt: 1 }))); } catch (e) { var d = DB.items[it.id]; return d ? d.n : it.id; } };
  var save = function () { try { if (typeof renderTabs === 'function') renderTabs(); if (typeof updateUI === 'function') updateUI(); if (typeof saveGame === 'function') saveGame(); } catch (e) { console.warn('[AFK-trade] save', e); } };
  var opId = function () { var a = new Uint8Array(12); (W.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return 'op' + Date.now().toString(36) + Array.prototype.map.call(a, function (x) { return (x % 36).toString(36); }).join(''); };

  // ── 血龍鑽 ──
  var blood = function () { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && i.id === BLOOD; }).reduce(function (n, i) { return n + (Number(i.cnt) || 1); }, 0) : 0; };
  var spendBlood = function (n) {
    var p = P(); if (!p || blood() < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== BLOOD) continue; var q = Math.min(n, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var gainBlood = function (n) { if (n > 0) gainItem(BLOOD, n, true, true); };

  // ── 能不能賣 ──
  var catOf = function (it) {
    var d = it && DB.items[it.id]; if (!d || d.gmOnly || d.noTrade) return null;
    if (/^card_[psg]_/.test(it.id)) return 'card';
    if (d.type === 'skillbk') { var s = DB.skills && DB.skills[d.sk]; return s && Number(s.tier) >= 8 ? 'book' : null; }
    if (d.slot && /^rem_/.test(d.slot)) return 'remains';
    if (/卷軸/.test(d.n || '') && !d.relic && d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc' && !d.quest && !d.questItem && d.type !== 'quest' && !/^(quest_|afk_q_|afk_aq_)/.test(it.id)) return 'scroll';   // 11-17：卷軸（一次 ≤100）
    if (d.relic || (typeof isRelic === 'function' && isRelic(d))) return 'relic';
    if (((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc') && !d.noEnhance && !/^(doll|mio|sigil|engrave|petarm|petwpn)$/.test(d.slot || '')) return 'equip';
    return null;
  };
  var whyNot = function (it) {
    if (!catOf(it)) return '這類物品不能上架';
    if (it.lock) return '已上鎖（先解鎖）';
    try { if (W.__afkAcSealedItem && W.__afkAcSealedItem(it)) return '封印中的道具不能上架'; } catch (e) {}   // Ping 11-18 20:10
    if (typeof W.__afkTagHasHoles === 'function' && W.__afkTagHasHoles(it)) return '開了卡洞（標籤卡）的裝備不能上架';
    if ((Number(it.en) || 0) > 15) return '強化超過 +15';
    return '';
  };

  // ── 物品資料只留認得的欄位（11-16 資安：跟伺服器 market.mjs cleanItem 同一套）──
  //   遺物的能力一律由物品編號重建（__afkRelicData.ensure 會檢查 +15／昇華 5／進化 9 的上限），不吃物品身上夾帶的數值。
  var ANC = { eternal: 1, immortal: 1, primordial: 1, ancient: 1 };
  var int = function (v, lo, hi) { var n = Number(v); return Number.isSafeInteger(n) && n >= lo && n <= hi ? n : NaN; };
  var cleanItem = function (it) {
    try {
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || it.id.length > 160) return null;
      var id = it.id;
      if (id.indexOf('~') >= 0) { if (!(W.__afkRelicData && W.__afkRelicData.ensure && W.__afkRelicData.ensure(id))) return null; }
      var d = DB.items[id]; if (!d || d.gmOnly || d.noTrade) return null;
      var o = { id: id, uid: String(it.uid || ''), cnt: int(it.cnt == null ? 1 : it.cnt, 1, 10), en: int(it.en == null ? 0 : it.en, -20, 15) };
      if (isNaN(o.cnt) || isNaN(o.en)) return null;
      if (it.bless != null && it.bless !== false) { if (it.bless === true || it.bless === 'cursed') o.bless = it.bless; else return null; }
      if (it.anc != null && it.anc !== false) { if (it.anc === true || ANC[it.anc]) o.anc = it.anc; else return null; }
      if (it.attr != null && it.attr !== false) { if (/^(fr|wa|wi|ea)[1-5]$/.test(String(it.attr))) o.attr = it.attr; else return null; }
      if (it.attrMagic != null && it.attrMagic !== false) { if (typeof it.attrMagic === 'string' && DB.skills && DB.skills[it.attrMagic]) o.attrMagic = it.attrMagic; else return null; }
      if (it.attrMagicStar != null) { o.attrMagicStar = int(it.attrMagicStar, 1, 5); if (isNaN(o.attrMagicStar)) return null; }
      if (it.seteff != null && it.seteff !== false) { if (/^[\u3400-\u9fff]{2,3}$/.test(String(it.seteff))) o.seteff = it.seteff; else return null; }
      ['ancLv', 'blessLv'].forEach(function (k) { if (it[k] != null) o[k] = int(it[k], 0, 5); });
      if (it.rbLv != null) o.rbLv = int(it.rbLv, 0, 50);
      if (['ancLv', 'blessLv', 'rbLv'].some(function (k) { return k in o && isNaN(o[k]); })) return null;
      if (it.gw != null) { if (Array.isArray(it.gw) && it.gw.length <= 3 && it.gw.every(function (x) { return /^[a-z]{2,4}\d{1,2}$/.test(String(x)); })) o.gw = it.gw.slice(); else return null; }
      if (!catOf(o)) return null;
      return o;
    } catch (e) { return null; }
  };

  // ── 物品進背包（交貨）──
  var addItem = function (src) {
    var p = P(); if (!p) throw new Error('沒有角色');
    var o = cleanItem(src);
    if (!o) throw new Error('物品資料不正確（' + String(src && src.id || '?').slice(0, 40) + '）');
    o.cnt = Math.max(1, Math.floor(Number(o.cnt) || 1)); o.uid = typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2, 11); o.lock = false; o.junk = false;
    try { if (typeof registerEquipObtained === 'function') registerEquipObtained(o.id); if (typeof registerMiscObtained === 'function') registerMiscObtained(o.id); if (typeof registerRelicObtained === 'function') registerRelicObtained(o.id); } catch (e) {}
    var ex = !o.gw && typeof sameItemSig === 'function' ? p.inv.find(function (i) { return i && !i.gw && !i.lock && sameItemSig(i, o); }) : null;
    if (ex) ex.cnt = (Number(ex.cnt) || 1) + o.cnt; else p.inv.push(o);
    try { if (W.__afkTpAbsorb) W.__afkTpAbsorb(); } catch (e) {}   // 11-16：伺服器交貨是非同步流程，交完立刻記成正常取得
  };

  // ── 記帳 ──
  var jr = function () { return jget(K_JR, []); };
  var jrSet = function (a) { set(K_JR, a.length ? JSON.stringify(a) : null); };
  var done = function () { return jget(K_DONE, []); };
  var markDone = function (id) { var a = done(); if (a.indexOf(id) < 0) a.push(id); set(K_DONE, JSON.stringify(a.slice(-300))); };
  var restoreLeft = function () { var t = Number(get(K_RESTORE) || 0); return t ? Math.max(0, t + COOL_MS - Date.now()) : 0; };

  // ── 連線 ──
  function req(method, path, b) {
    var u = api(); if (!u) return Promise.reject(Object.assign(new Error('旅人伺服器還沒設定。'), { status: 0, final: true }));
    var o = { method: method, headers: {} }; if (b) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(b); }
    return fetch(u + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw Object.assign(new Error(d.error || ('伺服器回應錯誤（' + r.status + '）')), { status: r.status, final: r.status >= 400 && r.status < 500 }); return d; });
    }, function () { throw Object.assign(new Error('連不上旅人伺服器，請稍後再試。'), { status: 0, net: true }); });
  }
  var who = function () { var h = HB(); if (!h || !h.ensureId) return Promise.reject(new Error('旅人頻道沒有載入。')); return h.ensureId(); };
  var authed = function (path, b) { return who().then(function (id) { return req('POST', path, Object.assign({ uid: id.uid, token: id.token }, b || {})); }); };

  // ── 狀態 ──
  var S = { view: 'browse', cat: '', q: '', sort: 'new', page: 1, list: null, more: false, mine: null, busy: false, msg: '', err: '', sel: null, price: '', pcat: '', pq: '', ask: null, loadedAt: 0 };
  W.__afkTrade = { state: S };
  var paint = function () { try { if (W.__afkBloodDia && W.__afkBloodDia.rerender) W.__afkBloodDia.rerender(); } catch (e) {} };
  var note = function (m, bad) { if (bad) { S.err = m; S.msg = ''; } else { S.msg = m; S.err = ''; } paint(); };

  // 對帳＋交貨（打開寄賣攤、上架／購買之後都跑一次）
  function sync() {
    return authed('/mkt/mine').then(function (m) {
      if (S.err && /連不上/.test(S.err)) S.err = '';
      S.mine = m; if (m.rules) RULE = Object.assign(RULE, m.rules);
      var p = P(), changed = false, now = Date.now(), left = [];
      jr().forEach(function (j) {
        if (j.t === 'post') {
          if ((m.listings || []).some(function (l) { return l.op === j.op; })) { changed = true; return; }
          if (now - j.at < 15000) { left.push(j); return; }
          if (p && j.slot === currentSlotSafe()) { try { addItem(j.item); gainBlood(j.fee); changed = true; S.msg = '上次上架沒有完成，「' + j.name + '」和上架費已退回。'; return; } catch (e) {} }
          left.push(j); return;
        }
        if (j.t === 'buy') {
          var got = (m.bought || []).some(function (b) { return b.id === j.id; }) || (m.deliveries || []).some(function (d) { return d.kind === 'bought' && d.listing_id === j.id; }) || done().indexOf('L' + j.id) >= 0;
          if (got) { changed = true; return; }
          if (now - j.at < 15000) { left.push(j); return; }
          if (p && j.slot === currentSlotSafe()) { gainBlood(j.price); changed = true; S.msg = '上次購買沒有完成，' + fmt(j.price) + ' 顆血龍鑽已退回。'; return; }
          left.push(j); return;
        }
      });
      jrSet(left);
      if (changed) save();
      return deliver(m.deliveries || [], true);
    });
  }
  var currentSlotSafe = function () { try { return typeof currentSlot !== 'undefined' ? currentSlot : 0; } catch (e) { return 0; } };

  // 交貨：auto＝只自動回報「已經入帳過」的，真正入帳要玩家按「領取」（要在村莊、進目前角色）
  function deliver(list, auto, only) {
    var ack = [], got = [], fails = [];
    var p = P(), dn = done();
    list.forEach(function (d) {
      if (dn.indexOf(d.id) >= 0) { ack.push(d.id); return; }
      if (auto || (only && only.indexOf(d.id) < 0)) return;
      if (!p) return;
      try {
        if (d.kind === 'proceeds') gainBlood(Number(d.payload.blood) || 0);
        else addItem(d.payload.item);
        markDone(d.id); if (d.kind === 'bought') markDone('L' + d.listing_id); ack.push(d.id);
        got.push(d.kind === 'proceeds' ? '血龍鑽 ' + fmt(d.payload.blood) + ' 顆（' + d.payload.name + ' 賣出）' : d.payload.name + (d.kind === 'returned' ? '（退回）' : ''));
      } catch (e) { fails.push(d.payload && d.payload.name + '：' + e.message); }
    });
    if (got.length) { save(); try { logSys('<span class="text-amber-300 font-bold">🏮 寄賣攤：領到 ' + esc(got.join('、')) + '。</span>'); } catch (e) {} }
    if (fails.length) S.err = '有東西領不到：' + fails.join('；');
    if (!ack.length) return Promise.resolve(got);
    return authed('/mkt/ack', { ids: ack }).then(function () {
      if (S.mine) S.mine.deliveries = (S.mine.deliveries || []).filter(function (x) { return ack.indexOf(x.id) < 0; });
      return got;
    }, function () { return got; });
  }

  function load() {
    S.busy = true; S.err = ''; paint();
    var qs = '?sort=' + S.sort + '&page=' + S.page + (S.cat ? '&cat=' + S.cat : '') + (S.q ? '&q=' + encodeURIComponent(S.q) : '');
    return Promise.all([req('GET', '/mkt/list' + qs).then(function (d) { S.list = d.items || []; S.more = !!d.more; }), sync()])
      .catch(function (e) { S.err = e.message; })
      .then(function () { S.busy = false; S.loadedAt = Date.now(); paint(); });
  }

  // ── 上架 ──
  var stackOf = function (uidv) { var p = P(); return p && (p.inv || []).find(function (i) { return i && i.uid === uidv; }); };
  function doPost() {
    var p = P(), it = S.sel && stackOf(S.sel.uid);
    if (!p || !it) return note('找不到要上架的物品。', true);
    var cat = catOf(it), bad = whyNot(it); if (bad) return note(bad, true);
    var k = Math.max(1, Math.min(RULE.cats[cat] || 1, Math.floor(Number(S.sel.cnt) || 1), Number(it.cnt) || 1));
    var price = Math.floor(Number(S.price));
    if (!(price >= RULE.minPrice)) return note('定價最少 ' + fmt(RULE.minPrice) + ' 顆血龍鑽。', true);
    var fee = Math.ceil(price * RULE.postFee);
    if (blood() < fee) return note('血龍鑽不夠付上架費（' + fmt(fee) + ' 顆）。', true);
    var before = Number(it.cnt) || 1;
    var snap = cleanItem(Object.assign({}, it, { cnt: k }));
    if (!snap) return note('這件物品的資料不正確，不能上架。', true);
    snap.uid = before > 1 ? it.uid + ':' + before : it.uid;
    var name = nameOf(it), op = opId();
    var a = jr(); a.push({ t: 'post', op: op, item: snap, fee: fee, name: name, at: Date.now(), slot: currentSlotSafe() }); jrSet(a);
    it.cnt = before - k; if (it.cnt <= 0) p.inv.splice(p.inv.indexOf(it), 1);
    spendBlood(fee); save();
    S.busy = true; S.ask = null; paint();
    return authed('/mkt/post', { op: op, name: String(p.name || '旅人').slice(0, 12), cat: cat, price: price, itemName: name.slice(0, 60), item: snap }).then(function (r) {
      jrSet(jr().filter(function (j) { return j.op !== op; }));
      S.sel = null; S.price = ''; S.view = 'mine';
      note('「' + name + '」上架了：定價 ' + fmt(price) + '，上架費 ' + fmt(r.fee) + ' 顆，24 小時後沒賣掉會退回。');
      return load();
    }, function (e) {
      if (e.final || (e.status && !e.net)) {
        jrSet(jr().filter(function (j) { return j.op !== op; }));
        try { addItem(snap); gainBlood(fee); } catch (er) {}
        save(); note(e.message + '（物品和上架費已退回）', true);
      } else note(e.message + ' 下次打開寄賣攤會自動確認這筆上架。', true);
      S.busy = false; paint();
    });
  }

  // ── 購買 ──
  function doBuy(row) {
    var p = P(); if (!p) return;
    if (blood() < row.price) return note('血龍鑽不夠（要 ' + fmt(row.price) + ' 顆）。', true);
    var a = jr(); a.push({ t: 'buy', id: row.id, price: row.price, name: row.name, at: Date.now(), slot: currentSlotSafe() }); jrSet(a);
    spendBlood(row.price); save();
    S.busy = true; S.ask = null; paint();
    return authed('/mkt/buy', { id: row.id, price: row.price, name: String(p.name || '旅人').slice(0, 12) }).then(function (r) {
      return deliver([r.delivery], false, [r.delivery.id]).then(function () {
        jrSet(jr().filter(function (j) { return !(j.t === 'buy' && j.id === row.id); }));
        note('買到「' + row.name + '」，已放進背包（花了 ' + fmt(row.price) + ' 顆血龍鑽）。');
        return load();
      });
    }, function (e) {
      if (e.final || (e.status && !e.net)) {
        jrSet(jr().filter(function (j) { return !(j.t === 'buy' && j.id === row.id); }));
        gainBlood(row.price); save(); note(e.message + '（血龍鑽已退回）', true);
      } else note(e.message + ' 下次打開寄賣攤會自動確認這筆購買。', true);
      S.busy = false; paint(); if (e.status === 409) load();
    });
  }
  function doCancel(id) {
    S.busy = true; paint();
    return authed('/mkt/cancel', { id: id }).then(function () { note('已下架，物品在「我的攤位」領回（上架費不退）。'); return load(); }, function (e) { S.busy = false; note(e.message, true); });
  }
  function doClaim(ids) {
    if (!inTown()) return note('要在村莊才能領取。', true);
    S.busy = true; paint();
    return deliver((S.mine && S.mine.deliveries) || [], false, ids).then(function (got) { S.busy = false; if (got.length) note('領到：' + got.join('、') + '。'); else paint(); });
  }

  // ── 畫面 ──
  var css = function () {
    if (document.getElementById('afk-trade-css')) return;
    var s = document.createElement('style'); s.id = 'afk-trade-css';
    s.textContent = '.afk-tr{padding:8px 10px;color:#e2e8f0;font-size:14px;max-width:760px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}'
      + '.afk-tr .bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
      + '.afk-tr .top{display:flex;gap:12px;flex-wrap:wrap;color:#cbd5e1;font-size:13px}.afk-tr .top b{color:#fda4af}'
      + '.afk-tr button{padding:5px 11px;border-radius:6px;border:1px solid #92400e;background:#3a2410;color:#fcd34d;font-weight:700;font-size:13px;cursor:pointer}'
      + '.afk-tr button.on,.afk-tr button.go{background:#b45309;color:#fff;border-color:#f59e0b}.afk-tr button[disabled]{opacity:.45;cursor:not-allowed}'
      + '.afk-tr input,.afk-tr select{background:#0f172a;color:#fde68a;border:1px solid #475569;border-radius:6px;padding:5px 8px;font-size:14px}'
      + '.afk-tr .row{display:flex;gap:10px;align-items:center;background:#1e1b2e;border:1px solid #3f3a55;border-radius:8px;padding:8px 10px}'
      + '.afk-tr .row.sel{border-color:#f59e0b;background:#2a1d0c}.afk-tr .row .main{flex:1;min-width:0}.afk-tr .row .nm{font-weight:700;overflow-wrap:anywhere}'
      + '.afk-tr .row .sub{color:#94a3b8;font-size:12px}.afk-tr .row .pr{color:#fda4af;font-weight:700;white-space:nowrap}'
      + '.afk-tr .ax-ico{width:40px;height:40px;flex-shrink:0;border:1px solid #475569;border-radius:6px;background:#0b1220;display:flex;align-items:center;justify-content:center}.afk-tr .ax-ico img{max-width:36px;max-height:36px}'
      + '.afk-tr .err{color:#fca5a5}.afk-tr .ok{color:#86efac}.afk-tr .dim{color:#94a3b8;font-size:12.5px}.afk-tr .red{color:#fca5a5}'
      + '.afk-tr .badge{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:#dc2626;color:#fff;font-size:11px;margin-left:4px}'
      + '.afk-tr details{background:#151320;border:1px solid #3f3a55;border-radius:8px;padding:6px 10px}.afk-tr summary{cursor:pointer;color:#fcd34d}';
    document.head.appendChild(s);
  };
  var ico = function (id) { var K = W.__afkNpcKit; return K && K.itemIco ? K.itemIco(id) : ''; };
  var tleft = function (t) { var ms = t - Date.now(); if (ms <= 0) return '已到期'; var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000); return (h ? h + ' 小時 ' : '') + m + ' 分'; };
  var rulesHtml = function () {
    return '<details><summary>規則</summary><div class="dim" style="line-height:1.7">'
      + '‧用<b>血龍鑽</b>一口價買賣，從目前角色的背包扣、入帳。<br>'
      + '‧定價最少 ' + fmt(RULE.minPrice) + ' 顆；上架費 ' + Math.round(RULE.postFee * 100) + '%（按下上架就扣、不退）；賣出時扣成交手續費 ' + Math.round(RULE.saleFee * 100) + '%。<br>'
      + '‧上架 24 小時，沒賣掉自動退回；同時最多 ' + RULE.maxActive + ' 件；每天上架 ' + RULE.postPerDay + ' 次、購買 ' + RULE.buyPerDay + ' 件（台灣時間 00:00 換日）。<br>'
      + '‧可以賣：武器、防具、飾品（+15 以下）、遺物、席琳遺骸、怪物卡片（一次最多 10 張）、8 級以上的法術書（一次最多 10 本）、卷軸（一次最多 100 張）。上鎖的要先解鎖。<br>'
      + '‧同一件物品只能上架一次；買到的物品可以再賣。<br>'
      + '‧新的旅人身分 72 小時內不能上架（可以買）。用備份、轉移碼還原或匯入角色後 24 小時內不能上架和購買。<br>'
      + '‧只能在村莊上架、購買、領取；野外可以瀏覽。賣出的血龍鑽、退回的物品在「我的攤位」領取，30 天內沒領會作廢。'
      + '</div></details>';
  };
  function html() {
    var p = P(), m = S.mine, pend = m ? (m.deliveries || []).length : 0;
    if (!api()) return '<div class="afk-tr"><div class="err">旅人伺服器還沒設定，寄賣攤暫時不能用。</div></div>';
    var h = '<div class="afk-tr" id="afk-tr-page"><div style="font-size:16px;font-weight:700;color:#fcd34d">🏮 寄賣攤 <span class="dim" style="font-weight:400">跟其他冒險者用血龍鑽一口價買賣</span></div>';
    h += '<div class="top"><span>血龍鑽 <b>' + fmt(blood()) + '</b></span>'
      + (m ? '<span>今天上架 ' + m.today.posts + '／' + RULE.postPerDay + '</span><span>今天購買 ' + m.today.buys + '／' + RULE.buyPerDay + '</span><span>上架中 ' + m.active + '／' + RULE.maxActive + '</span>' : '')
      + (inTown() ? '' : '<span class="red">在野外只能瀏覽</span>') + '</div>';
    var cool = restoreLeft(); if (cool) h += '<div class="red">剛還原過存檔，還要 ' + tleft(Date.now() + cool) + '才能上架和購買。</div>';
    if (m && m.banned) h += '<div class="red">這個旅人身分已被停用：不能上架和購買，已成交的東西仍可領取。</div>';
    h += '<div class="bar">' + [['browse', '🛒 逛攤位'], ['sell', '📦 我要上架'], ['mine', '📋 我的攤位']].map(function (v) { return '<button type="button" data-tr="view:' + v[0] + '"' + (S.view === v[0] ? ' class="on"' : '') + '>' + v[1] + (v[0] === 'mine' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</button>'; }).join('')
      + '<button type="button" data-tr="reload" style="margin-left:auto"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '讀取中…' : '重新整理') + '</button></div>';
    if (S.err) h += '<div class="err">' + esc(S.err) + '</div>'; if (S.msg) h += '<div class="ok">' + esc(S.msg) + '</div>';
    if (S.view === 'browse') h += browseHtml();
    else if (S.view === 'sell') h += sellHtml();
    else h += mineHtml();
    h += rulesHtml() + '</div>';
    return h;
  }
  function browseHtml() {
    var h = '<div class="bar"><select data-tr-in="cat" aria-label="分類"><option value="">全部分類</option>' + Object.keys(CAT_N).map(function (k) { return '<option value="' + k + '"' + (S.cat === k ? ' selected' : '') + '>' + CAT_N[k] + '</option>'; }).join('') + '</select>'
      + '<input data-tr-in="q" placeholder="搜尋名稱" value="' + esc(S.q) + '" style="width:130px">'
      + '<select data-tr-in="sort" aria-label="排序"><option value="new">最新</option><option value="cheap"' + (S.sort === 'cheap' ? ' selected' : '') + '>便宜→貴</option><option value="dear"' + (S.sort === 'dear' ? ' selected' : '') + '>貴→便宜</option></select>'
      + '<button type="button" data-tr="search">搜尋</button></div>';
    if (!S.list) return h + '<div class="dim">讀取中…</div>';
    if (!S.list.length) return h + '<div class="dim">目前沒有東西在賣。</div>';
    var mineIds = S.mine ? (S.mine.listings || []).map(function (l) { return l.id; }) : [];
    S.list.forEach(function (r) {
      var own = mineIds.indexOf(r.id) >= 0, asking = S.ask && S.ask.t === 'buy' && S.ask.id === r.id;
      var ci = cleanItem(r.item), full; try { full = ci ? getItemFullName(ci) : esc(r.name) + ' <span class="red">（資料異常，不能買）</span>'; } catch (e) { full = esc(r.name); }
      h += '<div class="row">' + ico(ci ? ci.id : '') + '<div class="main"><div class="nm">' + full + (r.cnt > 1 ? ' ×' + r.cnt : '') + '</div><div class="sub">' + (CAT_N[r.cat] || '') + '・賣家 ' + esc(r.seller) + '・剩 ' + tleft(r.exp) + '</div>'
        + (asking ? '<div class="bar" style="margin-top:4px"><span class="ok">確定用 ' + fmt(r.price) + ' 顆血龍鑽買？</span><button type="button" class="go" data-tr="buyok:' + r.id + '">確定</button><button type="button" data-tr="no">取消</button></div>' : '') + '</div>'
        + '<div class="pr">' + fmt(r.price) + ' 🩸</div>'
        + (own ? '<span class="dim">自己的</span>' : '<button type="button" data-tr="buy:' + r.id + '"' + (ci && canTrade() && blood() >= r.price && !S.busy ? '' : ' disabled') + '>購買</button>') + '</div>';
    });
    h += '<div class="bar">' + (S.page > 1 ? '<button type="button" data-tr="page:-1">上一頁</button>' : '') + '<span class="dim">第 ' + S.page + ' 頁</span>' + (S.more ? '<button type="button" data-tr="page:1">下一頁</button>' : '') + '</div>';
    return h;
  }
  var canTrade = function () { return inTown() && !restoreLeft() && !(S.mine && S.mine.banned); };
  function sellHtml() {
    var p = P(); if (!p) return '<div class="dim">請先進入遊戲。</div>';
    var m = S.mine, h = '';
    if (m && Date.now() < m.postFrom) h += '<div class="red">旅人身分建立未滿 72 小時，' + tleft(m.postFrom) + '後才能上架（可以先購買）。</div>';
    if (S.sel) {
      var it = stackOf(S.sel.uid);
      if (!it) { S.sel = null; } else {
        var cat = catOf(it), max = Math.min(RULE.cats[cat] || 1, Number(it.cnt) || 1), price = Math.floor(Number(S.price)) || 0, fee = Math.ceil(price * RULE.postFee), net = price - Math.ceil(price * RULE.saleFee);
        var full; try { full = getItemFullName(Object.assign({}, it, { cnt: 1 })); } catch (e) { full = esc(nameOf(it)); }
        h += '<div class="row sel">' + ico(it.id) + '<div class="main"><div class="nm">' + full + '</div><div class="sub">' + CAT_N[cat] + (max > 1 ? '・背包有 ' + fmt(it.cnt) : '') + '</div></div><button type="button" data-tr="unsel">換一件</button></div>'
          + '<div class="bar">' + (max > 1 ? '數量 <input data-tr-in="cnt" type="number" min="1" max="' + max + '" value="' + esc(S.sel.cnt || 1) + '" style="width:70px">' : '')
          + '定價 <input data-tr-in="price" type="number" min="' + RULE.minPrice + '" step="1" inputmode="numeric" placeholder="最少 ' + RULE.minPrice + '" value="' + esc(S.price) + '" style="width:130px"> 顆血龍鑽</div>'
          + '<div class="dim">上架費 ' + fmt(fee) + ' 顆（現在扣、不退）；賣出後拿到 ' + fmt(Math.max(0, net)) + ' 顆（扣成交手續費 ' + Math.round(RULE.saleFee * 100) + '%）；上架 24 小時。</div>';
        var okp = price >= RULE.minPrice && blood() >= fee && canTrade() && !(m && Date.now() < m.postFrom) && !S.busy;
        if (S.ask && S.ask.t === 'post') h += '<div class="bar"><span class="ok">確定上架？物品會交給伺服器保管，上架費 ' + fmt(fee) + ' 顆不退。</span><button type="button" class="go" data-tr="postok">確定上架</button><button type="button" data-tr="no">取消</button></div>';
        else h += '<div class="bar"><button type="button" class="go" data-tr="post"' + (okp ? '' : ' disabled') + '>上架</button>' + (blood() < fee && price ? '<span class="red">血龍鑽不夠付上架費</span>' : '') + '</div>';
        return h;
      }
    }
    h += '<div class="bar"><select data-tr-in="pcat" aria-label="分類"><option value="">全部可賣的</option>' + Object.keys(CAT_N).map(function (k) { return '<option value="' + k + '"' + (S.pcat === k ? ' selected' : '') + '>' + CAT_N[k] + '</option>'; }).join('') + '</select><input data-tr-in="pq" placeholder="搜尋背包" value="' + esc(S.pq) + '" style="width:130px"><span class="dim">倉庫的東西要先取出來</span></div>';
    var rows = (p.inv || []).filter(function (it) { var c = it && !it.lock && catOf(it); return c && (!S.pcat || c === S.pcat) && (!S.pq || nameOf(it).indexOf(S.pq) >= 0); });
    h += '<div class="dim">上鎖的物品不會列在這裡（要賣先解鎖）。</div>';   // 11-17 Ping：上鎖的遺物太多會搞錯
    if (!rows.length) return h + '<div class="dim">背包裡沒有可以上架的東西。</div>';
    rows.slice(0, 120).forEach(function (it) {
      var bad = whyNot(it), full; try { full = getItemFullName(it); } catch (e) { full = esc(nameOf(it)); }
      h += '<div class="row">' + ico(it.id) + '<div class="main"><div class="nm">' + full + '</div><div class="sub">' + CAT_N[catOf(it)] + (bad ? '・<span class="red">' + bad + '</span>' : '') + '</div></div><button type="button" data-tr="pick:' + esc(it.uid) + '"' + (bad ? ' disabled' : '') + '>選這件</button></div>';
    });
    if (rows.length > 120) h += '<div class="dim">只列前 120 件，請用分類或搜尋縮小範圍。</div>';
    return h;
  }
  function mineHtml() {
    var m = S.mine; if (!m) return '<div class="dim">讀取中…</div>';
    var h = '', dl = m.deliveries || [];
    if (dl.length) {
      h += '<div class="bar"><b>待領取</b><button type="button" class="go" data-tr="claimall"' + (inTown() && !S.busy ? '' : ' disabled') + '>全部領到目前角色</button>' + (inTown() ? '' : '<span class="red">要在村莊才能領</span>') + '</div>';
      dl.forEach(function (d) {
        var t = d.kind === 'proceeds' ? '賣出「' + esc(d.payload.name) + '」（買家 ' + esc(d.payload.to) + '）：血龍鑽 ' + fmt(d.payload.blood) + ' 顆（成交 ' + fmt(d.payload.price) + '，手續費 ' + fmt(d.payload.fee) + '）'
          : d.kind === 'returned' ? '退回「' + esc(d.payload.name) + '」' + ({ expired: '（24 小時沒賣掉）', cancel: '（你下架的）' }[d.payload.why] || '（' + esc(d.payload.why || '') + '）')
          : '買到「' + esc(d.payload.name) + '」';
        h += '<div class="row">' + (d.kind === 'proceeds' ? ico(BLOOD) : ico(d.payload.item && d.payload.item.id)) + '<div class="main"><div class="nm">' + t + '</div><div class="sub">' + new Date(d.created_at).toLocaleString('zh-TW', { hour12: false }) + '・30 天內沒領會作廢</div></div><button type="button" data-tr="claim:' + d.id + '"' + (inTown() && !S.busy ? '' : ' disabled') + '>領取</button></div>';
      });
    }
    var ST = { active: '上架中', sold: '已賣出', expired: '過期退回', cancelled: '已下架', removed: '被管理者下架' };
    h += '<div class="bar"><b>我的上架（30 天內）</b></div>';
    if (!(m.listings || []).length) h += '<div class="dim">還沒有上架紀錄。</div>';
    (m.listings || []).forEach(function (l) {
      var act = l.status === 'active' && l.expires_at > Date.now();
      h += '<div class="row"><div class="main"><div class="nm">' + esc(l.item_name) + (l.cnt > 1 ? ' ×' + l.cnt : '') + '</div><div class="sub">' + (ST[l.status] || l.status) + (act ? '・剩 ' + tleft(l.expires_at) : '') + (l.buyer_name ? '・買家 ' + esc(l.buyer_name) : '') + '・上架費 ' + fmt(l.fee) + '</div></div><div class="pr">' + fmt(l.price) + ' 🩸</div>'
        + (act ? '<button type="button" data-tr="cancel:' + l.id + '"' + (S.busy ? ' disabled' : '') + '>下架</button>' : '') + '</div>';
    });
    if ((m.bought || []).length) { h += '<div class="bar"><b>我買到的（30 天內）</b></div>'; m.bought.forEach(function (b) { h += '<div class="row"><div class="main"><div class="nm">' + esc(b.item_name) + '</div><div class="sub">賣家 ' + esc(b.seller_name) + '・' + new Date(b.closed_at).toLocaleString('zh-TW', { hour12: false }) + '</div></div><div class="pr">' + fmt(b.price) + ' 🩸</div></div>'; }); }
    return h;
  }
  function click(a, el) {
    S.err = ''; if (a !== 'reload') S.msg = '';
    var t = a.split(':'), k = t[0], v = t.slice(1).join(':');
    if (k === 'view') { S.view = v; S.ask = null; if (v === 'browse' && !S.list) return load(); return paint(); }
    if (k === 'reload') return load();
    if (k === 'search') { S.page = 1; return load(); }
    if (k === 'page') { S.page = Math.max(1, S.page + Number(v)); return load(); }
    if (k === 'no') { S.ask = null; return paint(); }
    if (k === 'buy') { if (!canTrade()) return note(inTown() ? '現在不能購買。' : '要在村莊才能購買。', true); S.ask = { t: 'buy', id: Number(v) }; return paint(); }
    if (k === 'buyok') { var row = (S.list || []).find(function (r) { return r.id === Number(v); }); if (row && canTrade()) return doBuy(row); return; }
    if (k === 'pick') { S.sel = { uid: v, cnt: 1 }; S.ask = null; return paint(); }
    if (k === 'unsel') { S.sel = null; S.ask = null; return paint(); }
    if (k === 'post') { if (!canTrade()) return note(inTown() ? '現在不能上架。' : '要在村莊才能上架。', true); S.ask = { t: 'post' }; return paint(); }
    if (k === 'postok') { if (canTrade()) return doPost(); return; }
    if (k === 'cancel') return doCancel(Number(v));
    if (k === 'claim') return doClaim([Number(v)]);
    if (k === 'claimall') return doClaim(((S.mine && S.mine.deliveries) || []).map(function (d) { return d.id; }));
  }
  function bind(box) {
    var pg = box.querySelector('#afk-tr-page'); if (!pg) return;
    pg.addEventListener('click', function (ev) { var b = ev.target.closest('[data-tr]'); if (!b || b.disabled) return; ev.preventDefault(); click(b.getAttribute('data-tr'), b); });
    pg.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute && ev.target.getAttribute('data-tr-in'); if (!k) return;
      if (k === 'cat' || k === 'sort') { S[k] = ev.target.value; S.page = 1; load(); }
      else if (k === 'pcat') { S.pcat = ev.target.value; paint(); }
      else if (k === 'price' || k === 'cnt') { if (k === 'price') S.price = ev.target.value; else if (S.sel) S.sel.cnt = ev.target.value; S.ask = null; paint(); }
    });
    pg.addEventListener('keydown', function (ev) {
      var k = ev.target.getAttribute && ev.target.getAttribute('data-tr-in'); if (ev.key !== 'Enter' || !k) return;
      if (k === 'q') { S.q = ev.target.value.trim(); S.page = 1; load(); }
      else if (k === 'pq') { S.pq = ev.target.value.trim(); paint(); }
      else if (k === 'price') { S.price = ev.target.value; paint(); }
    });
    pg.addEventListener('input', function (ev) { var k = ev.target.getAttribute && ev.target.getAttribute('data-tr-in'); if (k === 'q') S.q = ev.target.value.trim(); if (k === 'pq') S.pq = ev.target.value.trim(); if (k === 'price') S.price = ev.target.value; });
  }

  // 掛進潘朵拉黑市（afk-blooddia 的分頁列）
  (W.__afkMarketTabs = W.__afkMarketTabs || []).push({
    id: 'trade', label: '🏮 交易所',
    show: function () { var p = P(); return on() && !!p && !p.classicMode; },
    render: function (box) { css(); box.innerHTML = html(); bind(box); if (!S.loadedAt && !S.busy) load(); else if (Date.now() - S.loadedAt > 60000 && !S.busy) load(); }
  });
  W.__afkTrade.catOf = catOf; W.__afkTrade.cleanItem = cleanItem; W.__afkTrade.sync = sync; W.__afkTrade.load = load;

  // 還原存檔／匯入角色後 24 小時不能交易
  var hookGate = function () {
    var G = W.LineageSaveGate; if (!G || G.__afkTradeHook) return;
    ['importRole', 'restoreFull'].forEach(function (k) {
      var o = G[k]; if (typeof o !== 'function') return;
      G[k] = function () { var r = o.apply(this, arguments); var mark = function (v) { if (v !== false) set(K_RESTORE, String(Date.now())); return v; }; return r && r.then ? r.then(mark) : mark(r); };
    });
    try { G.__afkTradeHook = true; } catch (e) {}
  };
  hookGate(); W.addEventListener('load', hookGate);
  W.__afkTrade.markRestore = function () { set(K_RESTORE, String(Date.now())); };
  // 進遊戲後如果有沒對完的帳，過一會兒自動對一次
  W.addEventListener('load', function () { setTimeout(function () { if (on() && api() && jr().length && P()) sync().catch(function () {}); }, 20000); });
})();
