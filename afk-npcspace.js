/* ============================================================================
 * afk-npcspace.js — 村莊 NPC 不擠在一起（玩家 2026-10-27：燃柳村 NPC 疊成一團）
 *
 * 原因：核心每個村莊有一組 NPC 站位（TOWN_NPC_SPOTS），外掛後來加的 NPC 超過站位數時，
 *   核心只把它們「往右下挪 3%／2%」疊在原站位旁邊（燃柳村只有 1 個站位、卻有 5 個 NPC）。
 * 做法：
 *   ① 站位太少的村莊補上手調的站位（依背景圖的空地挑）
 *   ② 每次畫完村莊，檢查名牌有沒有互相重疊（左右 13%、上下 6% 以內算重疊）；
 *      重疊的那一個改站到「附近、不跟任何人重疊」的空位（先找該村還沒用到的站位，再找附近格點）
 *   只動畫面上的位置，不動資料。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'npcspace', name: '村莊 NPC 不擠在一起', desc: 'NPC 名牌重疊時自動換到附近的空位', group: '遊戲介面' });
  var on = function () { return !T || T.enabled('npcspace'); };

  // ① 補站位（x%, y%；依背景空地）
  var EXTRA = {
    // 燃柳村莊：歐斯＝鍛造屋前院（核心）｜廣場中央偏左｜廣場下方｜下方右側路口｜左側屋前空地｜右側小屋前
    town_gludio: [[62, 36], [30, 62], [44, 76], [60, 70], [22, 46], [66, 50]],
    // 長老會議廳：補議場左右兩側石板
    town_elder_council: [[50, 38], [63, 60], [36, 62], [50, 76]],
    // 沉默洞穴：補右下與上方
    town_silent: null
  };
  try {
    if (typeof TOWN_NPC_SPOTS !== 'undefined') Object.keys(EXTRA).forEach(function (t) {
      var add = EXTRA[t]; if (!add) return;
      var cur = TOWN_NPC_SPOTS[t] || [];
      if (cur.length < add.length) TOWN_NPC_SPOTS[t] = add.map(function (p, i) { return cur[i] || p; }).concat(cur.slice(add.length));
    });
  } catch (e) {}

  // ①b 指定站位（玩家 2026-10-27：奇岩右半邊 NPC 擠成一團）：外掛新增的 NPC 改站到廣場空地
  var PIN = {
    town_giran: { npc_junk_scholar: [36, 47], npc_ttmi_workshop: [46, 24] },
    town_aden: { npc_ttmi_archive: [24, 82] }
  };
  try {
    if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') Object.keys(PIN).forEach(function (t) {
      var o = TOWN_NPC_POS_OVERRIDE[t] = TOWN_NPC_POS_OVERRIDE[t] || {};
      Object.keys(PIN[t]).forEach(function (id) { if (!o[id]) o[id] = PIN[t][id]; });
    });
  } catch (e) {}

  // ①c 散開站位（玩家 2026-10-28：每張地圖的 NPC 不要過度集中）——依背景圖空地手挑，蓋過核心與各外掛給的位置
  //   新四城（奇岩城、妖魔堡、侏儒城、亞丁城）原本沒有站位表，全擠在畫面中央一排；亞丁城鎮外掛加的 NPC 集中在左下廣場
  var LAYOUT = {
    town_giran_castle: { npc_wh_giran: [20, 50], npc_ally_giranc: [42, 32], npc_giran_guard: [68, 46], npc_esti: [24, 80], npc_tros: [24, 80], npc_track_giran: [60, 86] },
    town_orc_fortress_castle: { npc_wh_orc_fortress: [24, 46], npc_ally_orc_fortressc: [56, 40], npc_orc_fortress_guard: [46, 62], npc_esti: [78, 50], npc_tros: [78, 50], npc_track_orc_fortress: [74, 80] },
    town_dwarf_castle_castle: { npc_wh_dwarf_castle: [76, 30], npc_ally_dwarf_castlec: [84, 62], npc_dwarf_castle_guard: [68, 80], npc_esti: [40, 88], npc_tros: [40, 88], npc_track_dwarf_castle: [90, 86] },
    town_aden_castle: { npc_wh_aden: [32, 44], npc_ally_adenc: [58, 36], npc_aden_guard: [48, 56], npc_esti: [56, 80], npc_tros: [56, 80], npc_track_aden: [32, 70], npc_traitor_ira: [80, 72] },
    town_aden: { npc_aden_leo: [40, 33], npc_dragon_lindvior: [64, 60], npc_zomg: [56, 68], npc_ttmi_archive: [28, 76], npc_ally_aden: [46, 76] }
  };
  try {
    if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') Object.keys(LAYOUT).forEach(function (t) {
      var o = TOWN_NPC_POS_OVERRIDE[t] = TOWN_NPC_POS_OVERRIDE[t] || {};
      Object.keys(LAYOUT[t]).forEach(function (id) { o[id] = LAYOUT[t][id]; });
    });
  } catch (e) {}
  W.__afkNpcLayout = LAYOUT;

  // ② 名牌重疊就換位
  var DX = 13, DY = 6;
  var clash = function (a, b) { return Math.abs(a.x - b.x) < DX && Math.abs(a.y - b.y) < DY; };
  var candidates = function (townId, p) {
    var out = [];
    try { (TOWN_NPC_SPOTS[townId] || []).forEach(function (s) { out.push({ x: s[0], y: s[1], spot: 1 }); }); } catch (e) {}
    for (var r = 1; r <= 6; r++) {
      for (var a = 0; a < 12; a++) {
        var ang = a / 12 * Math.PI * 2, x = p.x + Math.cos(ang) * r * 6, y = p.y + Math.sin(ang) * r * 4;
        if (x >= 10 && x <= 90 && y >= 28 && y <= 88) out.push({ x: Math.round(x), y: Math.round(y) });
      }
    }
    return out;
  };
  var spread = function (townId) {
    var map = document.getElementById('town-npc-map'); if (!map) return;
    var els = Array.prototype.slice.call(map.querySelectorAll('.town-npc'));
    if (els.length < 2) return;
    var placed = [];
    els.forEach(function (el) {
      var p = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
      if (!isFinite(p.x) || !isFinite(p.y)) return;
      if (!placed.some(function (q) { return clash(p, q); })) { placed.push(p); return; }
      var best = null, bd = Infinity;
      candidates(townId, p).forEach(function (c) {
        if (placed.some(function (q) { return clash(c, q); })) return;
        var d = Math.hypot((c.x - p.x) * 16 / 9, c.y - p.y) - (c.spot ? 8 : 0);   // 優先用村莊原本的站位
        if (d < bd) { bd = d; best = c; }
      });
      if (!best) { placed.push(p); return; }
      el.style.left = best.x + '%'; el.style.top = best.y + '%'; el.style.zIndex = Math.round(best.y * 10);
      placed.push(best);
    });
  };
  if (typeof W.renderTownNPCMap === 'function') {
    var o = W.renderTownNPCMap;
    W.renderTownNPCMap = function (townId) {
      var r = o.apply(this, arguments);
      try { if (on()) spread(townId || (typeof mapState !== 'undefined' && mapState.current)); } catch (e) {}
      return r;
    };
  }
  W.AFK_NPCSPACE = { spread: spread };
})();
