/* ============================================================================
 * afk-matwh.js — 副本材料從倉庫補足（玩家 2026-11-03；外掛開關 matwh，預設開；經典模式不套用）
 *
 *   進副本要交的材料，背包不夠時直接從倉庫拿（只拿差的那幾個，倉庫上鎖的不拿）。顯示的持有數＝背包＋倉庫。
 *   套用的地方：
 *     ‧星途遠征（席琳結晶、夢艷結晶；afk-starroad 呼叫 __afkMatWh）
 *     ‧時空裂痕（龜裂之核 1）、暗夢星迴（龜裂之核 1,000；afk-dreamstar、afk-fix1101 連續挑戰）
 *     ‧黑暗妖精聖地／受詛咒的聖地（死亡騎士之書）、崩壞的長老會議廳（吉爾塔斯的封印）：進場與頭目再臨
 *     ‧需鑰匙的地圖（四軍王之室、底比斯／提卡爾祭壇）：選單進場、「出發」、擊敗後再臨
 *   頭目再臨（打完要再交一個才復活）背包沒有時，一次從倉庫補最多 10 個，免得每打一隻就存一次檔。
 *   寫入照核心倉庫的交易流程：先存角色、再存倉庫，任一步失敗就還原（whTxnSnapshot／whTxnCommit）。
 *   數量讀取：倉庫只讀不改時直接解 _lzGet(whKey())（同 afk-bracelet 的 weaveOwned），1.5 秒快取。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'matwh', name: '副本材料從倉庫補足', group: '遊戲玩法', seal: true,
    desc: '進副本要交的材料（星途遠征、時空裂痕、暗夢星迴、聖地、軍王之室與祭壇的鑰匙）背包不夠時，直接從倉庫補足' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('matwh'))); };
  var n1 = function (it) { return Math.max(1, Math.floor(Number(it && it.cnt) || 1)); };
  var nm = function (id) { return (DB.items[id] && DB.items[id].n) || id; };
  var sys = function (h) { try { if (typeof logSys === 'function' && !(typeof state !== 'undefined' && state && state.ff)) logSys(h); } catch (e) {} };

  var bag = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (a, i) { return a + (i && i.id === id && !i.lock ? n1(i) : 0); }, 0) : 0; };
  var cache = { at: 0, key: null, m: null };
  var whMap = function () {
    if (!on() || typeof _lzGet !== 'function' || typeof whKey !== 'function') return {};
    var k = whKey(), now = Date.now();
    if (cache.m && cache.key === k && now - cache.at < 1500) return cache.m;
    var m = {};
    try {
      var s = _lzGet(k);
      if (s) {
        var tombs = {}; try { tombs = typeof _whTombsRead === 'function' ? _whTombsRead() : {}; } catch (e) {}
        (JSON.parse(s).items || []).forEach(function (i) { if (i && i.id && !i.lock && !(i.uid != null && tombs[i.uid])) m[i.id] = (m[i.id] || 0) + n1(i); });
      }
    } catch (e) { m = {}; }
    cache = { at: now, key: k, m: m };
    return m;
  };
  var wh = function (id) { return whMap()[id] || 0; };
  var total = function (id) { return bag(id) + wh(id); };
  var flush = function () { cache.m = null; };

  // 讓背包至少有 need 個（從倉庫拿差額；extra＝倉庫夠的話多拿幾個，最多拿到 need＋extra）
  var pull = function (id, need, extra) {
    var p = P(); if (!p || !id) return false;
    var have = bag(id); if (have >= need) return true;
    if (!on() || typeof loadWarehouse !== 'function' || typeof whTxnCommit !== 'function' || typeof whTxnSnapshot !== 'function') return false;
    var w = loadWarehouse(); if (!w || !Array.isArray(w.items)) return false;
    var avail = w.items.reduce(function (a, i) { return a + (i && i.id === id && !i.lock ? n1(i) : 0); }, 0);
    var want = need - have; if (avail < want) return false;
    var n = Math.min(avail, want + Math.max(0, Math.floor(extra || 0)));
    var snap = whTxnSnapshot(), left = n;
    for (var j = w.items.length - 1; j >= 0 && left > 0; j--) {
      var it = w.items[j]; if (!it || it.id !== id || it.lock) continue;
      var c = n1(it), u = Math.min(c, left); left -= u;
      if (c - u <= 0) w.items.splice(j, 1); else it.cnt = c - u;
    }
    try { gainItem(id, n, true, true); } catch (e) { if (typeof whTxnRestore === 'function') whTxnRestore(snap); return false; }
    if (bag(id) < have + n) { if (typeof whTxnRestore === 'function') whTxnRestore(snap); return false; }   // 背包放不下
    var ok = false; try { ok = whTxnCommit(w, snap); } catch (e) { ok = false; }
    flush();
    if (!ok) return false;
    sys('<span class="text-cyan-300">從倉庫取出 ' + nm(id) + ' ×' + n.toLocaleString() + '。</span>');
    try { if (typeof renderTabs === 'function' && !(state && state.ff)) renderTabs(true); } catch (e) {}
    return true;
  };
  var txt = function (id) { var b = bag(id), w = wh(id); return w > 0 ? (b + w).toLocaleString() + '（背包 ' + b.toLocaleString() + '＋倉庫 ' + w.toLocaleString() + '）' : b.toLocaleString(); };
  W.__afkMatWh = { on: on, bag: bag, wh: wh, total: total, pull: pull, txt: txt, flush: flush };
  if (typeof W.saveWarehouse === 'function') {
    var oSave = W.saveWarehouse;
    W.saveWarehouse = function () { flush(); return oSave.apply(this, arguments); };
  }

  var wrap = function (name, fn) {
    var o = W[name]; if (typeof o !== 'function') { console.warn('[AFK-matwh] 找不到 ' + name); return; }
    W[name] = function () { try { if (on()) fn.apply(this, arguments); } catch (e) { console.warn('[AFK-matwh] ' + name, e); } return o.apply(this, arguments); };
    try { (0, eval)(name + ' = window.' + name); } catch (e) {}
  };
  var CORE = 'mat_crack_core';
  // ── 時空裂痕 ──
  wrap('enterRift', function () { var p = P(); if (p.riftRewardMs == null && !(state && state.riftRun)) pull(CORE, 1); });
  if (typeof W.renderRiftEntrance === 'function') {
    var oEnt = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try {
        if (on() && container && wh(CORE) > 0) {
          container.querySelectorAll('div.text-xs').forEach(function (d) { if (/目前持有 \d+/.test(d.innerHTML)) d.innerHTML = d.innerHTML.replace(/目前持有 [\d,]+/, '目前持有 ' + txt(CORE)); });
        }
      } catch (e) {}
      return r;
    };
  }
  // ── 聖地／長老會議廳 ──
  wrap('sanctuaryEnter', function (mapKey, costId) { if (costId) pull(costId, 1); });
  if (typeof W._sanctItemCount === 'function') {
    var oSc = W._sanctItemCount;
    W._sanctItemCount = function (id) { var r = oSc.apply(this, arguments); try { if (on() && (id === 'item_dk_book' || id === 'item_giltas_seal')) r += wh(id); } catch (e) {} return r; };
    try { (0, eval)('_sanctItemCount = window._sanctItemCount'); } catch (e) {}
  }
  wrap('sanctBossRespawnCharge', function () {
    var cost = null; try { cost = SANCT_RESPAWN_COST[mapState.current]; } catch (e) {}
    if (cost) pull(cost, 1, 9);
  });
  // ── 需鑰匙的地圖 ──
  var needKeyOf = function (v) {
    try { for (var c in MAP_CATEGORIES) { var e = (MAP_CATEGORIES[c] || []).find(function (m) { return m.v === v; }); if (e) return e.needKey || null; } } catch (e) {}
    return null;
  };
  var kingKey = function (v) { try { var kr = KING_ROOMS[v]; return kr ? (kr.key || 'item_king_key') : null; } catch (e) { return null; } };
  wrap('changeMap', function (force) {
    if (force) return;
    var el = document.getElementById('map-select'), tgt = el && el.value;
    if (!tgt || tgt === mapState.current) return;
    var k = needKeyOf(tgt); if (k) pull(k, 1);
  });
  wrap('departToLastBattle', function () { var p = P(), k = kingKey(p.lastBattleMap); if (k) pull(k, 1); });
  wrap('settleDeadMobs', function () { if (state && state._kbVictory) { var k = kingKey(mapState.current); if (k) pull(k, 1, 9); } });
  wrap('kbRoomRespawn', function () { var k = kingKey(mapState.current); if (k) pull(k, 1, 9); });
  if (typeof W.mapOptDisabled === 'function') {
    var oDis = W.mapOptDisabled;
    W.mapOptDisabled = function (m) {
      try { if (m && m.needKey && on() && bag(m.needKey) < 1 && wh(m.needKey) > 0) return oDis.call(this, Object.assign({}, m, { needKey: null })); } catch (e) {}
      return oDis.apply(this, arguments);
    };
    try { (0, eval)('mapOptDisabled = window.mapOptDisabled'); } catch (e) {}
  }
})();
