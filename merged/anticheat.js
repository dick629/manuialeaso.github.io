/* ============================================================================
 * merged/anticheat.js — 異常道具檢查（設計稿 docs/anticheat-design.md，Ping 11-11 決定）
 *
 *   ‧遊玩時間 p.afkPlay：每個遊戲 tick 加 100 毫秒（離線補跑也是 tick，照補跑實際跑的算）；簽章對不上＝歸零。
 *   ‧A 級道具：第一次看到時記下當時的遊玩時間與「這件合理要花的時數」；之後強化上去的差額另外記。
 *     上線後新增的 A 級花費總和 > 遊玩時數 × 3 ＋ 寬限 → 從最新的開始送進隔離區，直到不超過。
 *     融合版上線前（2026-11-11 00:36）就有的、或這支程式第一次載入時就在身上的＝舊有，不檢查。
 *   ‧同一個 uid 重複出現（複製）：多出來的送隔離。
 *   ‧從 F12 直接呼叫取得道具：沒解鎖＝照樣「成功」但給亂碼道具（送隔離）；解鎖後正常給、記管理紀錄。
 *     判斷方式：呼叫堆疊最底層不是本站的程式檔（主控台、書籤小程式、外部腳本）。
 *   ‧蜜罐：giveItem、gmSpawn、DEBUG.addItem 等假入口，被叫了就給亂碼道具，之後 3 天新取得的 A 級道具一律隔離。
 *   ‧隔離區 3 天後刪除。管理者（owner-policy 的角色、或同一個瀏覽器裡建立過管理者角色後新建的角色）完全不檢查。
 *   密碼只放加鹽 SHA-256。
 * ========================================================================== */
(function (W) {
  'use strict';
  if (typeof DB === 'undefined' || !DB.items) return;
  var SALT = 'lgac:5b1e9c:', PWH = '49462dbd53447d0f175d972fef88c1ff48831462d2245c343bbc2eb84b5aa5d0';
  var OB_KEY = 'lineage_ob_v1', OB_SALT = 'lgob:91c2:';
  var LAUNCH = Date.UTC(2026, 10, 10, 16, 36);   // 2026-11-11 00:36 台北
  var QDAYS = 3, FACTOR = 3, GRACE_H = 5, HONEY_DAYS = 3, TICK = 100;
  var dg = function (s) { try { return W.LineageIdentityDigest(String(s)); } catch (e) { return ''; } };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var unlocked = false, adminLog = [];
  // 本機測試（localhost）不攔主控台呼叫；自動測試要驗證這裡時先設 __afkAcTest
  var LOCAL = function () { try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !W.__afkAcTest; } catch (e) { return false; } };
  var INIT_KEY = 'lineage_ac_init_v1';
  var initRec = function (id, set) { try { var m = JSON.parse(localStorage.getItem(INIT_KEY) || '{}'); if (set && !m[id]) { m[id] = Date.now(); localStorage.setItem(INIT_KEY, JSON.stringify(m)); } return m[id] || 0; } catch (e) { return 0; } };

  // ── 亂碼道具 ──
  var GL = '̷̸̵̴░▒▓█▙▛▜▟◈◇⌇⌁⍜⍉⎔⏃⏚';
  var garble = function (n) { var s = ''; for (var i = 0; i < n; i++) s += GL.charAt(Math.floor(Math.random() * GL.length)); return s; };
  DB.items.afk_glitch = { n: garble(6), type: 'misc', p: 0, gachaWeight: 0, noSell: true, noTrade: true, c: 'text-slate-500', img: 'assets/icons/items/原石碎片.png', d: garble(18) };

  // ── 管理者判定 ──
  var policy = W.LineageOwnerPolicy || { roles: [] };
  var roles = {}; (policy.roles || []).forEach(function (r) { roles[r] = 1; });
  var ident = function (p) { try { return W.LineageIntegrityCore.identity(p); } catch (e) { return ''; } };
  var ownerCache = new WeakMap();
  var browserOwner = function () {
    var v = ''; try { v = localStorage.getItem(OB_KEY) || ''; } catch (e) { return false; }
    if (!v) return false;
    return (policy.roles || []).some(function (r) { return dg(OB_SALT + r) === v; });
  };
  var isOwner = function (p) {
    if (!p) return false;
    if (W.__afkAcTest && W.__afkAcTest.notOwner) return false;
    if (ownerCache.has(p)) return ownerCache.get(p);
    var r = dg(ident(p)), own = !!roles[r];
    if (own) { try { localStorage.setItem(OB_KEY, dg(OB_SALT + r)); } catch (e) {} }
    else own = browserOwner();
    ownerCache.set(p, own); return own;
  };

  // ── 遊玩時間 ──
  var fnv = function (s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  var signOf = function (p, x) { return fnv(SALT + x.ms + '|' + x.since + '|' + ident(p)); };
  var play = function (p) {
    var x = p.afkPlay;
    if (!x || typeof x !== 'object') { x = p.afkPlay = { ms: 0, since: Date.now() }; x.sig = signOf(p, x); }
    return x;
  };
  var checkPlay = function (p) { var x = play(p); if (x.sig !== signOf(p, x)) { x.ms = 0; x.since = Date.now(); x.bad = (x.bad || 0) + 1; x.sig = signOf(p, x); } };
  var hours = function (p) { return (play(p).ms || 0) / 3600000; };

  // ── A 級道具與合理時數（估計值；依 PLM 存檔實測的擊殺速度推算，見 docs/anticheat-design.md 十） ──
  var DIM_H = [0.1, 10, 25, 45, 70, 120], DRG_H = [5, 15, 30, 50];
  var ONCE = { afk_fate_unlock: 20, afk_runebox_3: 20 };
  var costOf = function (it) {
    var d = it && DB.items[it.id]; if (!d || it.acx) return 0;
    if (ONCE[it.id]) return ONCE[it.id];
    if (d.dimDragon != null) return DRG_H[d.dimDragon] || 0;
    if (d.dimRelic) return DIM_H[Math.min(5, Number(it.dimEn) || 0)];
    if (d.relicEvo != null) return 15 + 10;
    if (d.relicAsc != null && d.relicAsc >= 1) return d.relicAsc * 2;
    return 0;
  };
  // 舊有材料折算成時數（異化星塵 1 個≈1 小時；破碎星光塵埃 100 個＝1 個異化星塵；倒影之鏡、四龍時空碎片、昇華支配強化石各 5 小時）
  var credit = function (p) {
    var c = function (id) { try { return typeof questCountId === 'function' ? questCountId(id) : 0; } catch (e) { return 0; } };
    return c('afk_alien_dust') + c('afk_star_dust') / 100 + (c('afk_rd_mirror') + c('afk_rd_dfrag') + c('afk_rd_pick')) * 5 + c('afk_dim_crystal') / 5000;
  };
  var store = function (p) {
    if (!p.afkAc || typeof p.afkAc !== 'object') {
      // 第一次：這個瀏覽器以前已經記錄過這個角色＝紀錄被刪掉，不當成舊有
      var key = dg('ac|' + ident(p)), had = initRec(key);
      p.afkAc = { v: 1, init: Date.now(), seen: {}, sp: [], q: [] };
      if (!had && !(p.afkPlay && p.afkPlay.ms > 0)) p.afkAc.fresh = 1;
      initRec(key, true);
    }
    var a = p.afkAc; a.seen = a.seen || {}; a.sp = a.sp || []; a.q = a.q || []; return a;
  };
  var allItems = function (p) {
    var out = []; (p.inv || []).forEach(function (it, i) { if (it) out.push({ it: it, where: 'inv', i: i }); });
    var eq = p.eq || {}; Object.keys(eq).forEach(function (k) { if (eq[k]) out.push({ it: eq[k], where: 'eq', k: k }); });
    return out;
  };
  var quarantine = function (p, ref, why) {
    var a = store(p), it = ref.it;
    if (ref.where === 'inv') { var i = p.inv.indexOf(it); if (i < 0) return; p.inv.splice(i, 1); }
    else { if (p.eq[ref.k] !== it) return; p.eq[ref.k] = null; }
    a.q.push({ it: it, at: Date.now(), why: why });
    var d = DB.items[it.id];
    sys('<span class="text-red-300 font-bold">⚠ 「' + (d ? d.n : '？') + '」的取得紀錄異常，已移到隔離區，3 天後刪除。</span>');
    return true;
  };

  // ── 掃描 ──
  // 玩家 11-11 10:10：會誤鎖道具 → 只留密碼保護 S 級道具；取得速度、重複編號、蜜罐後隔離都拿掉。
  //   之前被隔離的真道具全部放回背包；只有亂碼道具會被清掉。
  var S_FROM = Date.UTC(2026, 10, 14, 16, 0);   // 玩家 11-11 10:24：2026-11-15 00:00（台北）起才擋
  // 玩家 11-11 12:16：只鎖 GM 裝備，其他（至高的支配、次元遺物…）全部開放
  var S_TIER = function (id) { var d = DB.items[id]; return !!d && (String(id) === '99998' || String(id) === '99999' || !!d.gmOnly); };
  var scan = function (force) {
    var p = P(); if (!p || p.classicMode) return;
    var a = store(p), changed = false;
    var back = a.q.filter(function (x) { return x && x.it && x.it.id !== 'afk_glitch'; });
    if (back.length) { back.forEach(function (x) { p.inv.push(x.it); }); sys('<span class="text-emerald-300">先前移到隔離區的 ' + back.length + ' 件道具已放回背包。</span>'); changed = true; }
    if (a.q.length) { a.q = []; changed = true; }
    a.sp = []; delete a.honey;
    allItems(p).forEach(function (r) { if (r.it.id === 'afk_glitch' && r.where === 'inv') { var i = p.inv.indexOf(r.it); if (i >= 0) { p.inv.splice(i, 1); changed = true; } } });
    // 玩家 11-11 10:31：11/15 前就在身上（背包、裝備、倉庫）的 S 級道具，標成「11/15 前取得」，永遠不檢查
    if (Date.now() < S_FROM) {
      allItems(p).forEach(function (r) { if (S_TIER(r.it.id) && !r.it.acPre) { r.it.acPre = 1; changed = true; } });
      // 11-11 11:53：不再讀寫倉庫——每 10 秒重讀倉庫會蓋掉倉庫視窗的快照，造成倉庫道具異常。倉庫裡的會在領出到背包時標上。
    }
    if (changed) { try { if (typeof calcStats === 'function') calcStats(); if (typeof updateUI === 'function') updateUI(); } catch (e) {} }
  };
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (item) {
      var h = oDesc.apply(this, arguments);
      try { if (item && item.acPre) h += '<div style="color:#86efac;font-size:12px;margin-top:4px">🛡 2026/11/15 前取得：不受異常道具檢查</div>'; } catch (e) {}
      return h;
    };
  }

  // ── 主控台呼叫判定 ──
  var external = function () {
    try {
      var lim = Error.stackTraceLimit; Error.stackTraceLimit = 80; var s = new Error().stack || ''; Error.stackTraceLimit = lim;
      var ls = s.split('\n').filter(function (l) { return /\S/.test(l) && !/^Error\b/.test(l); });
      if (ls.length < 2) return false;
      return !/(https?|file|blob):\/\//.test(ls[ls.length - 1]);
    } catch (e) { return false; }
  };
  var giveGlitch = function (p) {
    DB.items.afk_glitch.n = garble(6); DB.items.afk_glitch.d = garble(18);
    try { var r = oGain('afk_glitch', 1, true, true); if (r && typeof r === 'object') r.glitch = 1; return r; } catch (e) { return null; }
  };
  var oGain = W.gainItem;
  if (typeof oGain === 'function') {
    W.gainItem = function (id) {
      var st = (typeof state !== 'undefined' && state) || {};
      if (!st.ff && !LOCAL() && external()) {
        var p = P();
        if (!unlocked) { if (S_TIER(id) && Date.now() >= S_FROM) return giveGlitch(p); return oGain.apply(this, arguments); }
        adminLog.push({ id: id, n: arguments[1], at: Date.now() });
        var r = oGain.apply(this, arguments);
        try { if (p) { var a = store(p); if (r && r.uid != null) a.seen[r.uid] = costOf(r); (a.admin = a.admin || []).push([String(id), Number(arguments[1]) || 1, Date.now()]); if (a.admin.length > 200) a.admin.splice(0, a.admin.length - 200); } } catch (e) {}
        return r;
      }
      var r2 = oGain.apply(this, arguments);
      // 次元裂縫（含時空裂縫的副本）裡遊戲給的東西：不算進取得速度
      try { var R = W.__afkDimRift; if (r2 && r2.uid != null && R && typeof R.on === 'function' && R.on()) { var pp = P(); (pp && pp.inv || []).forEach(function (x) { if (x && x.uid === r2.uid) x.acx = 1; }); } } catch (e) {}
      return r2;
    };
    try { (0, eval)('gainItem = window.gainItem'); } catch (e) {}
  }

  // ── 蜜罐 ──
  var honey = function () {
    var p = P();
    return p && !unlocked ? giveGlitch(p) : null;
  };
  var trap = function () { var r = honey(); return r ? { ok: true, item: r } : { ok: true }; };
  ['giveItem', 'gmSpawn', 'addItem', 'cheatItem'].forEach(function (k) { if (!(k in W)) W[k] = trap; });
  if (!W.DEBUG) W.DEBUG = { addItem: trap, giveGold: trap, spawn: trap };

  // ── 管理 ──
  var old = W.LineageAdmin || {};
  var admin = {};
  Object.keys(old).forEach(function (k) { admin[k] = old[k]; });
  admin.unlock = function (pw) { unlocked = dg(SALT + String(pw == null ? '' : pw)) === PWH; return unlocked; };
  admin.lock = function () { unlocked = false; return true; };
  admin.quarantine = function () { if (!unlocked) return []; var p = P(); return p ? store(p).q.map(function (x, i) { var d = DB.items[x.it.id]; return i + ': ' + (d ? d.n : x.it.id) + '（' + x.why + '）'; }) : []; };
  admin.restore = function (i) { if (!unlocked) return false; var p = P(); if (!p) return false; var a = store(p), x = a.q[i]; if (!x) return false; a.q.splice(i, 1); a.seen[x.it.uid] = costOf(x.it); p.inv.push(x.it); try { updateUI(); } catch (e) {} return true; };
  admin.playHours = function () { var p = P(); return p ? Math.round(hours(p) * 100) / 100 : 0; };
  admin.log = function () { return unlocked ? adminLog.slice() : []; };
  W.LineageAdmin = Object.freeze(admin);

  // ── 掛上遊戲迴圈 ──
  if (typeof W.tick === 'function') {
    var oTick = W.tick, n = 0;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try { var p = P(); if (p && !p.classicMode) { var x = play(p); x.ms += TICK; x.sig = signOf(p, x); if (++n % 100 === 0) scan(); } } catch (e) {}
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () { var r = oLoad.apply(this, arguments); try { scan(true); } catch (e) {} return r; };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }
  // ── 效能（11-11）：補跑期間 updateUI 外面包的一層層外掛（PVP 傳送鈕、頭像…）也先不跑，
  //    跟核心一樣只記「待重畫」，補跑結束由 flushTickRender 畫一次 ──
  if (typeof W.updateUI === 'function') {
    var oUI = W.updateUI, setDirty = null;
    try { setDirty = (0, eval)('(function () { if (typeof _uiDirty !== "undefined") _uiDirty = true; })'); } catch (e) {}
    W.updateUI = function () {
      try { if (typeof catchupActive === 'function' && catchupActive()) { if (setDirty) setDirty(); return; } } catch (e) {}
      return oUI.apply(this, arguments);
    };
    try { (0, eval)('updateUI = window.updateUI'); } catch (e) {}
  }
  W.__afkAntiCheat = { scan: scan, costOf: costOf, isOwner: isOwner, hours: hours, external: external, store: store };
})(window);
