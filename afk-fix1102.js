/* ============================================================================
 * afk-fix1102.js — 玩家 2026-11-02 01:02 的系統調整（外掛開關 fix1102，預設開；經典模式不套用）
 *
 *   一、滿等不給經驗：傭兵（和你自己）已經到等級上限（未轉生 100、一轉 150、二轉 200）時不再累積經驗，
 *       解散時也不會再出現「累積的 N 經驗已直接結算至來源角色」。
 *   二、隊伍人數的掉寶倍率：上限從 ×8 改成 ×16（你＋還站著的傭兵，每人 ×1）；金幣一樣。
 *       席琳夢域鏡本身的掉寶倍率 ×8 → ×7（核心補丁 82）。
 *   三、多魯嘉傳家之寶：一律給龍之鑽石——1 世 50、2 世 1,000、3 世 1,500、4 世 2,000、5 世 2,500、6 世 3,000、7 世 50,000。
 *   四、濃縮古代藥水（afk-ancient 定義物品）：工匠薩克原本的三條濃縮體力恢復劑配方改成做濃縮古代藥水
 *       （古代體力恢復劑／強力／終極 ×3＋金幣 5 萬 → 1 罐）。
 *   五、收藏冊：已經拿不到的道具（掉落、商店、製作、抽獎、道具包都沒有，而且是透視鏡匯入後下架或刪除的）從道具收藏、裝備收藏拿掉。
 *   六、村莊 NPC 站位：NPC 越加越多擠成一團，畫完村莊後把太近的 NPC 互相推開（只動擠在一起的，盡量留在原本的位置附近）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fix1102', name: '11/02 調整（滿等不給經驗、掉寶人數 ×16、多魯嘉給龍鑽、濃縮古代藥水、收藏冊、NPC 站位）', group: '遊戲玩法', seal: true,
    desc: '滿等不再累積經驗；隊伍人數掉寶倍率上限 ×16；夢域鏡掉寶 ×7；多魯嘉傳家之寶改給龍之鑽石；濃縮配方改做濃縮古代藥水；拿不到的道具移出收藏冊；村莊 NPC 不再擠在一起' });
  var on = function () { return !T || T.enabled('fix1102'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var hidden = function () { return !T || T.enabled('hiddenbonus'); };
  var dreamOn = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function') return false; var o = W[name]; W[name] = mk(o); try { (0, eval)(name + ' = window.' + name); } catch (e) {} return true; };

  // ── 一、滿等不給經驗 ──
  var capOf = function (x) { try { return typeof W.__afkLvCap === 'function' ? W.__afkLvCap(x) : 100; } catch (e) { return 100; } };
  wrapG('__afkExpCarry', function (o) { return function (x, raw) { if (on() && x && !x.classicMode && (x.lv || 1) >= capOf(x)) return 0; return o.apply(this, arguments); }; });

  // ── 二、隊伍人數掉寶 ──
  var PARTY_CAP = 16, DREAM_BASE = 7;
  W.__afkDreamDropBase = function () { return on() ? DREAM_BASE : 8; };
  wrapG('partyRewardMult', function (o) {
    return function () {
      var r = o.apply(this, arguments), p = P();
      if (!on() || !p || p.classicMode) return r;
      if (dreamOn() && hidden()) return 1;   // 隱藏規則十二：夢域鏡裡隊伍人數不加掉寶
      return Math.min(PARTY_CAP, 1 + (p.allies || []).filter(function (a) { return a && !a._downed; }).length);
    };
  });

  // ── 三、多魯嘉傳家之寶 ──
  var DOLU = { ttmi_410: 50, ttmi_412: 1000, ttmi_414: 1500, ttmi_416: 2000, ttmi_418: 2500, ttmi_420: 3000, ttmi_422: 50000 };
  var addDia = function (n) { try { var r = W.pandoraAdjustSharedDiamonds(n) || {}; return !!r.ok; } catch (e) { return false; } };
  var doluText = function () {
    Object.keys(DOLU).forEach(function (id) { var d = DB.items[id]; if (!d) return; if (d._afkDoluOrig == null) d._afkDoluOrig = d.d; d.d = on() ? '打開後得到龍之鑽石 ' + DOLU[id].toLocaleString() + ' 顆。' : d._afkDoluOrig; });
  };
  wrapG('useItem', function (o) {
    return function (u, silent) {
      try {
        var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === u; });
        if (it && DOLU[it.id] && on() && !p.classicMode) {
          if (it.lock || !(it.cnt > 0)) return false;
          var n = DOLU[it.id];
          if (!addDia(n)) { if (typeof logSys === 'function') logSys('<span class="text-red-400">龍之鑽石帳戶暫時無法寫入，傳家之寶沒有打開。</span>'); return false; }
          it.cnt = (it.cnt || 1) - 1; if (it.cnt <= 0) p.inv.splice(p.inv.indexOf(it), 1);
          if (typeof logSys === 'function') logSys('<span class="text-cyan-300">你打開了' + esc(DB.items[it.id].n) + '，得到龍之鑽石 ' + n.toLocaleString() + ' 顆。</span>');
          try { if (typeof renderTabs === 'function') renderTabs(); if (typeof updateUI === 'function') updateUI(); if (typeof saveGame === 'function') saveGame(); } catch (e) {}
          return true;
        }
      } catch (e) { console.warn('[AFK-fix1102] dolu', e); }
      return o.apply(this, arguments);
    };
  });

  // ── 四、濃縮古代藥水配方 ──
  var condensed = function () {
    var A = W.__afkAncient; if (!A || !A.CPOTS || !on()) return 0;
    var map = { potion_heal_ttmi_137: 0, potion_heal_ttmi_139: 1, potion_heal_ttmi_141: 2 }, n = 0;
    var L = (typeof CRAFT_RECIPES !== 'undefined' && CRAFT_RECIPES.npc_ttmi_workshop) || [];
    L.forEach(function (r) {
      if (!r || !(r.result in map) || r.afkCondensed) return;
      var i = map[r.result], id = A.CPOTS[i], base = A.CBASE[i]; if (!DB.items[id] || !DB.items[base]) return;
      var gold = (r.req || []).filter(function (q) { return q && q.id === 'gold'; })[0];
      r.result = id; r.req = [{ id: base, cnt: 3 }, { id: 'gold', cnt: gold ? gold.cnt : 50000 }]; r.yield = 1; r.afkCondensed = true; n++;
    });
    if (n && typeof buildRecipeIndex === 'function') try { buildRecipeIndex(); } catch (e) {}
    return n;
  };

  // ── 五、收藏冊：拿不到的道具 ──
  var pruned = { misc: [], equip: [] };
  var obtainable = function () {
    var S = Object.create(null), add = function (id) { if (id && DB.items[id]) S[id] = 1; };
    Object.keys(DB.items).forEach(function (id) { if ((DB.items[id].gachaWeight || 0) > 0) S[id] = 1; });
    ['MOB_DROPS', 'DARK_WEAPON_DROPS', 'DARK_CRYSTAL_DROPS', 'DRAGON_DROPS', 'WARRIOR_DROPS', 'MEM_DROPS'].forEach(function (n) {
      var t; try { t = (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : null'); } catch (e) {}
      if (t) Object.keys(t).forEach(function (m) { (t[m] || []).forEach(function (e) { add(Array.isArray(e) ? e[0] : (e && e.id) || e); }); });
    });
    try { if (typeof SHOP_LISTS === 'object') Object.keys(SHOP_LISTS).forEach(function (k) { (SHOP_LISTS[k] || []).forEach(function (x) { add(typeof x === 'string' ? x : x && x.id); }); }); } catch (e) {}
    try { Object.keys(CRAFT_RECIPES).forEach(function (k) { (CRAFT_RECIPES[k] || []).forEach(function (r) { if (r) add(r.result); }); }); } catch (e) {}
    var A = W.AFK_TTMI_ITEMS;
    try { A.shopStock().forEach(function (x) { add(typeof x === 'string' ? x : x.id); }); A.gachaPool().forEach(add); } catch (e) {}
    try { (A.recipes || []).forEach(function (r) { if (r) add(r.result); }); } catch (e) {}   // 古物與材料工坊關著時 CRAFT_RECIPES 是空的，照樣算
    try { (A.source.items || []).forEach(function (r) { (r.contents || []).forEach(function (c) { add(A.resolve(c.sourceId)); }); }); } catch (e) {}
    try { Object.keys(TRIAL_Q).forEach(function (k) { (TRIAL_Q[k].rewards || []).forEach(add); }); } catch (e) {}
    try { Object.keys(DB.towns).forEach(function (t) { (DB.towns[t].npcs || []).forEach(function (n) { try { (getShopItemsForNpc(n.id) || []).forEach(add); } catch (e) {} }); }); } catch (e) {}
    return S;
  };
  // 只拿掉「透視鏡匯入後下架／刪除」的（核心與其他外掛的道具有很多是程式裡發的，查不到來源也不能當成拿不到）
  var dead = function (id) { var d = DB.items[id]; return !!(d && (d.afkDeleted || d.ttmiRetired || d.ttmiPolyRemoved || (d.ttmiEvent && !d.ttmiCurated))); };
  var petDup = function (id) { var C = W.__afkDropCut; return !!(C && C.PET && C.PET[id]); };
  var prune = function () {
    if (!on()) return;
    var S = obtainable();
    var cut = function (CAT, ITEM, out, extra) {
      if (typeof CAT !== 'object' || !CAT) return;
      Object.keys(CAT).forEach(function (k) {
        var L = CAT[k]; if (!Array.isArray(L)) return;
        for (var i = L.length - 1; i >= 0; i--) { var id = L[i]; if (!S[id] && (dead(id) || (extra && extra(id)))) { L.splice(i, 1); if (ITEM) delete ITEM[id]; out.push(id); } }
      });
    };
    try { cut(MISC_CAT_ITEMS, typeof MISC_ITEM_CAT !== 'undefined' ? MISC_ITEM_CAT : null, pruned.misc); } catch (e) {}
    try { cut(EQUIP_CAT_ITEMS, typeof EQUIP_ITEM_CAT !== 'undefined' ? EQUIP_ITEM_CAT : null, pruned.equip, petDup); } catch (e) {}
    try { if (typeof OBTAINABLE_MISC !== 'undefined') pruned.misc.forEach(function (id) { delete OBTAINABLE_MISC[id]; }); } catch (e) {}
  };

  // ── 六、村莊 NPC 站位 ──
  var RX = 9.5, RY = 11, XMIN = 5, XMAX = 95, YMIN = 26, YMAX = 92;
  var relax = function () {
    var map = document.getElementById('town-npc-map'); if (!map || !on()) return 0;
    var els = [].slice.call(map.querySelectorAll('.town-npc'));
    if (els.length < 2) return 0;
    var pts = els.map(function (el) { var x = parseFloat(el.style.left), y = parseFloat(el.style.top); return { el: el, x: x, y: y, x0: x, y0: y }; }).filter(function (q) { return isFinite(q.x) && isFinite(q.y); });
    var moved = 0;
    for (var it = 0; it < 80; it++) {
      var any = false;
      for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) {
        var a = pts[i], b = pts[j], dx = (b.x - a.x) / RX, dy = (b.y - a.y) / RY, d = Math.hypot(dx, dy);
        if (d >= 1) continue;
        any = true;
        if (d < 1e-6) { dx = (j % 2 ? 1 : -1) * 0.6; dy = 0.4; d = Math.hypot(dx, dy); }
        var push = (1 - d) / 2 * 1.02, ux = dx / d, uy = dy / d;
        a.x -= ux * push * RX; a.y -= uy * push * RY; b.x += ux * push * RX; b.y += uy * push * RY;
      }
      pts.forEach(function (q) { q.x = Math.max(XMIN, Math.min(XMAX, q.x)); q.y = Math.max(YMIN, Math.min(YMAX, q.y)); });
      if (!any) break;
    }
    pts.forEach(function (q) {
      if (Math.abs(q.x - q.x0) < 0.05 && Math.abs(q.y - q.y0) < 0.05) return;
      moved++; q.el.style.left = (Math.round(q.x * 100) / 100) + '%'; q.el.style.top = (Math.round(q.y * 100) / 100) + '%'; q.el.style.zIndex = Math.round(q.y * 10);
    });
    if (moved && typeof W._scheduleTownLabelResolve === 'function') try { W._scheduleTownLabelResolve(); } catch (e) {}
    return moved;
  };
  wrapG('renderTownNPCMap', function (o) { return function () { var r = o.apply(this, arguments); try { relax(); } catch (e) { console.warn('[AFK-fix1102] npc', e); } return r; }; });

  // 02:56 再調：人多的村莊（說話之島、奇岩、亞丁）把外掛加的 NPC 移到人少的村莊
  //   冒險者公會 接待員：說話之島、奇岩、亞丁、歐瑞 → 古魯丁村莊、歐瑞村莊、海賊島村莊；遠征隊長 托爾：→ 古魯丁村莊
  var MOVES = { npc_afk_guild: ['town_gludin', 'town_oren', 'town_pirate_village'], npc_afk_exped: ['town_gludin'] };
  var moved = false;
  var moveNpcs = function () {
    if (moved || !on()) return; moved = true;
    Object.keys(MOVES).forEach(function (id) {
      var def = null;
      Object.keys(DB.towns).forEach(function (t) { var L = DB.towns[t].npcs || []; for (var i = L.length - 1; i >= 0; i--) if (L[i] && L[i].id === id) { def = def || L[i]; L.splice(i, 1); } });
      if (!def) return;
      MOVES[id].forEach(function (t) { var tw = DB.towns[t]; if (tw && !(tw.npcs || []).some(function (n) { return n.id === id; })) (tw.npcs = tw.npcs || []).push(def); });
    });
  };
  var boot = function () { doluText(); condensed(); prune(); moveNpcs(); };
  boot(); W.addEventListener('load', boot);

  // ── 地區專屬掉落（玩家 2026-11-02 12:15）：借用傲慢之塔怪物的地圖（慾望洞穴的小惡魔、象牙塔的死亡之劍、黑騎士前哨的魔狼）
  //   不再掉傲慢之塔的移動卷軸與封印傳送符；只有傲慢之塔各樓層與時空裂痕會掉 ──
  var LOCK = [{ item: /^item_pride_(scroll|sealed)_\d+$/, ok: function (map) { return /^pride_/.test(map || '') || !!(typeof state !== 'undefined' && state.riftRun); } }];
  var dropFilter = function (mob, list) {
    var map = typeof mapState !== 'undefined' && mapState ? mapState.current : '';
    var out = list.filter(function (e) { var id = Array.isArray(e) ? e[0] : e; return !LOCK.some(function (L) { return L.item.test(id) && !L.ok(map); }); });
    return out.length === list.length ? list : out;
  };
  var prevDF = W.__afkDropListFilter;
  W.__afkDropListFilter = function (mob, list) { if (typeof prevDF === 'function') list = prevDF(mob, list) || list; return T && !T.enabled('fix1102') ? list : dropFilter(mob, list); };
  W.__afkFix1102 = { MOVES: MOVES, LOCK: LOCK, dropFilter: dropFilter, PARTY_CAP: PARTY_CAP, DREAM_BASE: DREAM_BASE, DOLU: DOLU, condensed: condensed, prune: prune, pruned: function () { return pruned; }, obtainable: obtainable, relax: relax, RX: RX, RY: RY };
})();
