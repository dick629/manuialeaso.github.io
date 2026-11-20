/* ============================================================================
 * afk-autosupply.js — 自動喝／自動買：三段加速藥水、增益料理（玩家 2026-11-01 18:23；外掛開關 autosupply，預設開）
 *
 *   技能設定分頁的藥水區（自我加速藥水、變形卷軸、魔法屏障卷軸…那一塊）多兩個勾選，跟原本的勾選一樣「自動使用＝自動購買」：
 *   ‧三段加速藥水：身上沒有三段加速時，喝背包裡的三段加速藥水（洛依賣的那幾種）；背包沒有就自動買一瓶再喝。
 *     買的時候挑洛依貨架上「持續最久、同持續時間最便宜」的那一種；價格照洛依的售價（金幣）。
 *   ‧增益料理：身上沒有那一盤料理的增益時吃一盤；背包沒有就自動買一盤再吃。可選「全部營養料理」或指定一種
 *     （營養料理各盤可以疊加，所以「全部」＝每一種都維持著）。
 *   ‧時空裂痕加速藥水（1～3 段）、時空裂痕魔力藥水（2026-11-03 23:11，預設不勾）：帶出裂痕的那幾瓶，一般地圖上沒有效果時自動喝，
 *     每次照 afk-riftsupply 的帶出規則收龍鑽（__afkDiaCost）；不夠就安靜跳過。裂痕裡照舊由 afk-riftsupply 自動喝。只有 riftout 開著才顯示。
 *     11-19（Ping）：背包沒有就自動買——裂痕內花戰勳（補給原價）、一般地圖每瓶 50 龍鑽（魔力 30），只扣龍鑽。
 *   設定每個角色各自記住（player._afkAutoSupply）。經典模式不顯示、不動作。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'autosupply', name: '自動喝三段加速藥水、增益料理', group: '遊戲玩法', seal: true,
    desc: '技能設定的藥水區多兩個勾選：三段加速藥水、增益料理；身上沒有效果時自動使用，背包沒有就自動向洛依的價格買一份' });
  var on = function () { return !T || T.enabled('autosupply'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var A = function () { return W.AFK_TTMI_ITEMS || null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var cfg = function (p) { p = p || P(); if (!p) return { haste3: false, food: false, foodSel: 'all' }; var c = p._afkAutoSupply; if (!c || typeof c !== 'object') c = p._afkAutoSupply = { haste3: false, food: false, foodSel: 'all' }; return c; };
  var stock = function () { var a = A(); try { var s = a && a.shopStock ? a.shopStock() : []; return (Array.isArray(s) ? s : Object.keys(s || {})).map(function (x) { return typeof x === 'string' ? x : (x && x.id); }).filter(Boolean); } catch (e) { return []; } };
  var isH3 = function (d) { return !!(d && !d.ttmiRiftOnly && !d.gmOnly && (d.ttmiAction === 'thirdHaste' || (d.ttmiHaste || []).some(function (h) { return h && h.stage === 3 && !h.moveOnly; }))); };
  var FOOD_PREFIX = 'ttmi_mix_food_';
  var isFood = function (id) { var d = DB.items[id]; return !!(d && id.indexOf(FOOD_PREFIX) === 0 && d.ttmiBuffFamily === 'food' && !d.ttmiRiftOnly); };
  var priceOf = function (id) { var a = A(); try { var v = a && a.price ? Number(a.price(id)) : 0; return Number.isFinite(v) && v > 0 ? Math.ceil(v) : 0; } catch (e) { return 0; } };
  var bestH3 = function () {
    var ids = stock().filter(function (id) { return isH3(DB.items[id]) && priceOf(id) > 0 && !(A().priceDia && A().priceDia(id)); });
    ids.sort(function (a, b) { return ((DB.items[b].dur || 0) - (DB.items[a].dur || 0)) || (priceOf(a) - priceOf(b)) || (a < b ? -1 : 1); });
    return ids[0] || null;
  };
  var foods = function () { return stock().filter(isFood); };
  var invOf = function (pred) { var p = P(); return (p.inv || []).find(function (i) { return i && pred(i.id); }) || null; };
  var potBlocked = function () { try { return typeof pvpArenaPotionBlocked === 'function' && pvpArenaPotionBlocked(); } catch (e) { return false; } };
  var stats = { used: 0, bought: 0, gold: 0 };

  // 用一份：背包有就用，沒有就買一份再用；buyId＝要買的那一種
  var supply = function (pred, buyId) {
    var p = P(), it = invOf(pred);
    if (!it && buyId) {
      var cost = priceOf(buyId);
      if (!cost || (p.gold || 0) < cost) return false;
      p.gold -= cost; stats.gold += cost; stats.bought++;
      try { gainItem(buyId, 1, true, true); } catch (e) { p.gold += cost; return false; }
      try { if (typeof logSys === 'function' && !(state && state.ff)) logSys('自動花費 ' + cost.toLocaleString() + ' 金幣購買了 1 份' + esc(DB.items[buyId].n) + '。'); } catch (e) {}
      it = invOf(function (id) { return id === buyId; });
    }
    if (!it) return false;
    try { useItem(it.uid, true); stats.used++; return true; } catch (e) { return false; }
  };
  var buffLeft = function (k) { var p = P(); return Number(p && p.buffs && p.buffs[k]) || 0; };

  var step = function () {
    var p = P(); if (!p || !on() || p.classicMode || p.dead || !A() || potBlocked()) return;
    var c = cfg(p);
    if (c.haste3 && buffLeft('ttmi_haste3') <= 0) supply(function (id) { return isH3(DB.items[id]); }, bestH3());
    riftOut(p, c);
    if (c.food) {
      var list = foods(), want = c.foodSel && c.foodSel !== 'all' ? [c.foodSel] : list;
      want.forEach(function (id) { if (!isFood(id) || buffLeft('ttmi_food:' + id) > 0) return; supply(function (x) { return x === id; }, list.indexOf(id) >= 0 ? id : null); });
    }
  };

  // ── 帶出裂痕的加速／魔力藥水（玩家 2026-11-03 23:11）：一般地圖上沒有效果時自動喝背包裡的，每次照 riftout 收龍鑽；龍鑽不夠就安靜跳過 ──
  //   裂痕裡照舊由 afk-riftsupply 自己自動喝；這裡只管裂痕外。不會自動買（裂痕補給只能在裂痕裡用戰勳換）。
  var RS = function () { return W.__afkRiftSupply || null; };
  var riftOutOk = function () { var r = RS(); try { return !!(r && r.outOn && r.outOn()); } catch (e) { return false; } };
  // 11-19（Ping 04:18、04:30）：背包沒有就自動買——裂痕裡用戰勳（照補給原價），一般地圖用龍鑽（每瓶 OUT_BUY，只扣龍鑽；喝的時候另照 riftout 收費）
  var OUT_BUY = { h1: 50, h2: 50, h3: 50, blue: 30 };
  var credits = function () { var A0 = A(), cid = null; try { cid = A0 && A0.resolve ? A0.resolve(12039) : null; } catch (e) {} if (!cid) return { id: null, n: 0 }; var p = P(); return { id: cid, n: (p.inv || []).reduce(function (s, it) { return s + (it && it.id === cid && !it.lock ? Math.max(0, Number(it.cnt) || 1) : 0); }, 0) }; };
  var diaHave = function () { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var riftRetry = { p: null };   // 測試對話 11-19：這一次沒喝成／沒買成 → 5 拍後再試，不每一拍都掃整個背包
  var riftOut = function (p, c) {
    var r = RS(); if (!r || !(c.riftHaste || c.riftBlue) || !riftOutOk()) return;
    var A0 = A(), inR = false; try { inR = !!(A0 && A0.inRift && A0.inRift()); } catch (e) {}
    var ids = r.ids(), DC = W.__afkDiaCost;
    var ks = (c.riftHaste ? ['h1', 'h2', 'h3'] : []).concat(c.riftBlue ? ['blue'] : []);
    ks.forEach(function (k) {
      if ((Number(p.buffs && p.buffs[r.BUFF[k]]) || 0) > 0) return;
      var tk = (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0;
      if (riftRetry.p === p && riftRetry[k] > tk && riftRetry[k] - tk <= 5) return;
      riftRetry.p = p; riftRetry[k] = tk + 5;
      var it = (p.inv || []).find(function (x) { return x && x.id === ids[k] && !x.lock && (Number(x.cnt) || 1) > 0; }) || null;
      if (!it) {
        var d = DB.items[ids[k]]; if (!d) return;
        if (inR) {   // 裂痕裡：戰勳買 1 瓶（afk-riftsupply 會在同一輪自動喝）
          var cr = credits(), cost = Number(d.ttmiCost) || 0;
          if (!cost || cr.n < cost || !A0.riftBuy) return;
          try { if (A0.riftBuy(ids[k], 1)) { stats.bought++; riftRetry[k] = 0; if (typeof logSys === 'function' && !(state && state.ff)) logSys('自動花費 ' + cost + ' 戰勳兌換了 1 瓶' + esc(d.n) + '。'); } } catch (e) {}
          return;
        }
        var price = OUT_BUY[k], fee = r.OUT_FEE || 10;
        try { if (DC && DC.check(fee)) return; } catch (e) { return; }
        if (diaHave() < price + fee) return;   // 買完還要付得起喝的費用
        var res = null; try { res = W.pandoraAdjustSharedDiamonds(-price) || {}; } catch (e) { res = {}; }
        if (!res.ok) return;
        try { gainItem(ids[k], 1, true, true); } catch (e) { try { W.pandoraAdjustSharedDiamonds(price); } catch (e2) {} return; }
        stats.bought++;
        try { if (typeof logSys === 'function' && !(state && state.ff)) logSys('自動花費 ' + price + ' 龍之鑽石購買了 1 瓶' + esc(d.n) + '。'); } catch (e) {}
        it = (p.inv || []).find(function (x) { return x && x.id === ids[k] && !x.lock; }) || null;
        if (!it) return;
      }
      if (inR) return;   // 裂痕裡的喝由 afk-riftsupply 處理
      try { if (DC && DC.check(r.OUT_FEE)) return; } catch (e) { return; }   // 龍鑽／金幣不夠：安靜跳過
      try { if (r.use(it, true) === true) { stats.used++; riftRetry[k] = 0; } } catch (e) {}
    });
  };

  // ── 設定介面：藥水區（弓箭自動購買那一列的上面）──
  var ui = function () {
    var p = P(), arrow = document.getElementById('set-auto-buy-arrow'), box = arrow && arrow.closest('label') && arrow.closest('label').parentElement;
    var old = document.getElementById('afk-autosupply-rows');
    if (!box || !p || !on() || p.classicMode) { if (old) old.style.display = 'none'; return; }
    if (!old) {
      old = document.createElement('div'); old.id = 'afk-autosupply-rows'; old.className = 'col-span-2 grid grid-cols-2 gap-x-3 gap-y-1.5 items-center';
      old.innerHTML = '<label class="cursor-pointer flex items-center gap-2"><input type="checkbox" id="set-afk-haste3" class="w-4 h-4"> <span class="text-emerald-300">三段加速藥水</span></label>'
        + '<label class="cursor-pointer flex items-center gap-2"><input type="checkbox" id="set-afk-food" class="w-4 h-4"> <span class="text-orange-200">增益料理</span></label>'
        + '<label class="cursor-pointer flex items-center gap-2" id="afk-rift-haste-row"><input type="checkbox" id="set-afk-rift-haste" class="w-4 h-4"> <span class="text-violet-300" id="afk-rift-haste-lb">時空裂痕加速藥水</span></label>'
        + '<label class="cursor-pointer flex items-center gap-2" id="afk-rift-blue-row"><input type="checkbox" id="set-afk-rift-blue" class="w-4 h-4"> <span class="text-violet-300" id="afk-rift-blue-lb">時空裂痕魔力藥水</span></label>'
        + '<div id="afk-food-sel-row" class="col-span-2 flex items-center gap-2 text-xs text-slate-400"><span>料理</span><select id="set-afk-food-sel" class="flex-1 bg-slate-900 border text-orange-200 px-2 py-1 rounded text-xs"></select></div>';
      box.insertBefore(old, arrow.closest('label'));
      old.addEventListener('change', function (ev) {
        var c = cfg(); if (!c) return;
        if (ev.target.id === 'set-afk-haste3') c.haste3 = !!ev.target.checked;
        if (ev.target.id === 'set-afk-food') c.food = !!ev.target.checked;
        if (ev.target.id === 'set-afk-food-sel') c.foodSel = ev.target.value || 'all';
        if (ev.target.id === 'set-afk-rift-haste') c.riftHaste = !!ev.target.checked;
        if (ev.target.id === 'set-afk-rift-blue') c.riftBlue = !!ev.target.checked;
        sync(); try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
      });
    }
    old.style.display = '';
    sync();
  };
  var lastSel = null;   // 11-21：洛依沒賣料理時清單是空字串，原本跟初值相同＝選單一直空白
  var sync = function () {
    var p = P(); if (!p) return; var c = cfg(p);
    var h = document.getElementById('set-afk-haste3'), f = document.getElementById('set-afk-food'), s = document.getElementById('set-afk-food-sel'), row = document.getElementById('afk-food-sel-row');
    if (h) h.checked = !!c.haste3; if (f) f.checked = !!c.food;
    if (s) {
      var list = foods(), key = list.join(',');
      if (key !== lastSel) { lastSel = key; s.innerHTML = '<option value="all">全部營養料理（各盤疊加）</option>' + list.map(function (id) { return '<option value="' + esc(id) + '">' + esc(DB.items[id].n) + '（' + priceOf(id).toLocaleString() + ' 金幣）</option>'; }).join(''); }
      s.value = (c.foodSel && list.indexOf(c.foodSel) >= 0) ? c.foodSel : 'all';
    }
    if (row) row.style.display = c.food ? '' : 'none';
    var rok = riftOutOk(), fee = (RS() && RS().OUT_FEE) || 10;
    [['afk-rift-haste', 'riftHaste', '時空裂痕加速藥水（1～3 段）'], ['afk-rift-blue', 'riftBlue', '時空裂痕魔力藥水']].forEach(function (x) {
      var r0 = document.getElementById(x[0] + '-row'), cb = document.getElementById('set-' + x[0]), lb = document.getElementById(x[0] + '-lb');
      if (r0) { r0.style.display = rok ? '' : 'none'; r0.title = '沒有效果時自動喝；背包沒有就自動買（裂痕內花戰勳、一般地圖花龍鑽），不夠就不買不喝'; }
      if (cb) cb.checked = !!c[x[1]];
      if (lb) {
        var bp = x[1] === 'riftBlue' ? OUT_BUY.blue : OUT_BUY.h1, cc = (RS() && DB.items[RS().ids()[x[1] === 'riftBlue' ? 'blue' : 'h1']] || {}).ttmiCost || 0;
        var t = x[2] + '<br><small class="text-slate-400">沒有就自動買：裂痕內 ' + cc + ' 戰勳／瓶、一般地圖 ' + bp + ' 龍鑽／瓶；一般地圖每次喝另付 ' + fee + ' 龍鑽＋' + (fee * 10) + ' 萬金幣</small>';
        if (lb.innerHTML !== t) lb.innerHTML = t;
      }
    });
    var hl = h && h.closest('label'); if (hl) { var b = bestH3(); hl.title = b ? '沒有三段加速時自動喝；背包沒有就買「' + DB.items[b].n + '」（' + priceOf(b).toLocaleString() + ' 金幣）' : '洛依沒有賣三段加速藥水'; }
  };

  var lastP = null;
  if (typeof W.autoActions === 'function') {
    var oAA = W.autoActions;
    W.autoActions = function () {
      var r = oAA.apply(this, arguments);
      try { var p = P(); if (p !== lastP) { lastP = p; ui(); } step(); } catch (e) { console.warn('[AFK-autosupply]', e); }
      return r;
    };
    try { (0, eval)('autoActions = window.autoActions'); } catch (e) {}
  }
  ['loadGame', 'renderTabs'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function () { var r = o.apply(this, arguments); try { if (fn === 'loadGame' || !document.getElementById('afk-autosupply-rows')) ui(); } catch (e) {} return r; };
    try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
  });
  setTimeout(function () { try { ui(); } catch (e) {} }, 0);

  W.__afkAutoSupply = { OUT_BUY: OUT_BUY, step: step, riftOut: riftOut, ui: ui, sync: sync, cfg: cfg, bestH3: bestH3, foods: foods, stats: stats, isH3: isH3 };
})();
