/* ============================================================================
 * afk-bosslines.js — 頭目台詞（玩家 2026-11-05 05:29／05:32：全部地圖的王都要有登場、死亡台詞，含半血、四分之一血；先上線）
 *
 *   每隻頭目：登場、HP 第一次 ≤ 70%、≤ 50%、≤ 25%、倒下，各在系統日誌顯示一句（以頭目名稱開頭）。
 *   每個階段可以有多句（陣列），每次到那個階段才從裡面隨機挑一句（玩家 2026-11-05 19:44：五個階段各 10 句輪換）；同一隻頭目同一階段不會連續兩次同一句。
 *   台詞資料在 afk-bosslines-data.js（window.__afkBossLinesData = { lines: { key: {open,half,quarter,death} }, names: { 怪物名: key } }）；
 *   同一個角色的不同版本（夢域鏡、瘋狂、謀叛…）共用一個 key。其他外掛可以 __afkBossLines.add(名稱, {...}) 登記自己的頭目。
 *   補跑期間不顯示（一刻都不影響戰鬥）；經典模式不顯示；開關 bosslines（預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bosslines', name: '頭目台詞', group: '遊戲介面', seal: true,
    desc: '頭目登場、血量剩七成、剩一半、剩四分之一、倒下時，在系統日誌說一句話' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return (!T || T.enabled('bosslines')) && !!p && !p.classicMode; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var D = W.__afkBossLinesData || { lines: {}, ids: {}, stages: [] };
  var extra = {};
  // 名字 → key；多階段頭目（四龍副本的最終龍、九尾狐）記下第一與最後階段的名字：登場只在第一階段說、倒下只在最後階段說，半血／四分之一同一場只說一次
  var NAMES = null, FIRST = {}, LAST = {}, STAGEKEY = {};
  var names = function () {
    if (NAMES) return NAMES;
    NAMES = {};
    try {
      var st = {}; (D.stages || []).forEach(function (k) { st[k] = 1; });
      Object.keys(D.ids || {}).forEach(function (k) {
        var ids = D.ids[k] || [], ns = [];
        ids.forEach(function (id) { var m = DB.mobs[id]; if (m && m.n) { NAMES[m.n] = k; if (ns.indexOf(m.n) < 0) ns.push(m.n); } });
        if (st[k] && ns.length > 1) { STAGEKEY[k] = 1; FIRST[ns[0]] = 1; LAST[ns[ns.length - 1]] = 1; }
      });
    } catch (e) {}
    return NAMES;
  };
  var keyOf = function (n) { return names()[n] || n; };
  var enc = {};   // 多階段頭目同一場的進度：key → { s, h, q, at }
  var lastPick = {};   // key|階段 → 上次說的那句（避免連續同一句）
  // 抽台詞用自己的亂數（不動 Math.random）：台詞只是表演，不能改變戰鬥的亂數序列（固定種子的測試、重播都靠它）
  var seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  var rnd = function () { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  var pick = function (k, stage, v) {
    if (!Array.isArray(v)) return v;
    var arr = v.filter(Boolean); if (!arr.length) return null; if (arr.length === 1) return arr[0];
    var id = k + '|' + stage, prev = lastPick[id], t, n = 0;
    do { t = arr[Math.floor(rnd() * arr.length)]; } while (t === prev && ++n < 8);
    lastPick[id] = t; return t;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var linesOf = function (m) {
    if (!m || !m.n) return null;
    if (extra[m.n]) return extra[m.n];
    return (D.lines && D.lines[keyOf(m.n)]) || null;
  };
  var isBoss = function (m) { return !!(m && typeof m === 'object' && (m.boss || m._afkTrLayer || m._bossLines) && m.race !== '建築' && !m.trollPlayer && !m._pvpDuelFoe && !m.siegeEnemy); };
  var quiet = function () { var s = S(); return !!(s.ff || (typeof catchupActive === 'function' && catchupActive())); };
  // 補跑（含手機跟不上時的靜音快跑）期間先排隊，下一次正常畫面時補印；排太久（> 5 秒）或太多（> 4 句）的丟掉，免得一次洗版
  var queue = [];
  var out = function (n, t) {
    // 放在系統日誌（玩家 2026-11-05 14:45：不要放在「敵人」戰鬥紀錄裡）
    try { if (typeof logSys === 'function') logSys('<span class="font-bold" style="color:#fda4af">' + esc(n) + '</span><span style="color:#fecdd3">：「' + esc(t) + '」</span>'); } catch (e) {}
  };
  var say = function (m, key) {
    var L = linesOf(m), t = L && pick(keyOf(m.n), key, L[key]); if (!t) return;
    if (quiet()) { queue.push({ n: m.n, t: t, at: Date.now() }); if (queue.length > 4) queue.shift(); return; }
    out(m.n, t);
  };
  var flush = function () {
    if (!queue.length || quiet()) return;
    var now = Date.now(), q = queue; queue = [];
    for (var i = 0; i < q.length; i++) if (now - q[i].at <= 5000) out(q[i].n, q[i].t);
  };
  var scan = function () {
    if (!on() || typeof mapState === 'undefined' || !mapState || !mapState.mobs) return;
    flush();
    var ms = mapState.mobs;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; if (!isBoss(m) || m._dead) continue;
      var st = m._afkBl || (m._afkBl = {});
      var k = keyOf(m.n), staged = !!STAGEKEY[k], e = null;
      if (staged) { if (FIRST[m.n] || !enc[k] || Date.now() - enc[k].at > 1800000) { if (!st.o) enc[k] = { s: 0, h: 0, q: 0, at: Date.now() }; } e = enc[k] || (enc[k] = { s: 0, h: 0, q: 0, at: Date.now() }); }
      if (!st.o) { st.o = 1; if (!staged || FIRST[m.n]) say(m, 'open'); }
      var hp = Number(m.hp) || 0, cur = Number(m.curHp);
      if (!(hp > 0) || !(cur > 0)) continue;
      var h = e || st;
      // 一下掉很多（例如 80% → 20%）只說最低那一階，跳過的不補說
      if (!h.q && cur <= hp * 0.25) { h.q = h.h = h.s = 1; say(m, 'quarter'); }
      else if (!h.h && cur <= hp * 0.5) { h.h = h.s = 1; say(m, 'half'); }
      else if (!h.s && cur <= hp * 0.7) { h.s = 1; say(m, 'p70'); }
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { scan(); } catch (e) {} return r; };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && isBoss(m) && on()) { var st = m._afkBl || (m._afkBl = {}); if (!st.d) { st.d = 1; var k = keyOf(m.n); if (!STAGEKEY[k] || LAST[m.n]) say(m, 'death'); }  }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  W.__afkBossLines = {
    add: function (name, l) { if (name && l) extra[name] = l; },
    get: linesOf, scan: scan, data: function () { return D; },
    count: function () { return Object.keys(D.lines || {}).length + Object.keys(extra).length; }
  };
})();
