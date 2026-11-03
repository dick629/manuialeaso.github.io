/* ============================================================================
 * afk-bracelet.js — 手環系統（靈魂石王的專屬掉落；玩家 2026-11-02 02:56；外掛開關 bracelet，預設開；經典模式不開放）
 *
 *   一、材料（只在「靈魂石訓練所」打倒靈魂石叫出來的王才會掉）：
 *       ‧深淵靈魂：每次必掉，數量＝頭目等級 ÷ 4（最少 5；Lv60＝15、Lv100＝25）
 *       ‧意志抵抗精華：1%
 *       ‧胤魂石：深淵靈魂 1,000 → 1 顆（席琳神殿「手環工匠 赫菲」）
 *   二、手環（裝在手環欄位，轉生後才開放；兩格，在裝備視窗第二頁戒指右邊的位置；同一種只能裝一個）：在赫菲用深淵靈魂 1,000 換一個（六種任選），初始 0 階，可以升到 3 階：
 *       升 1 階：同一種 0 階手環 2 個合成 1 個 1 階　升 2 階：胤魂石 ×3　升 3 階：破空石 ×5＋意志抵抗精華 ×100＋胤魂石 ×5
 *   三、效果（0／1／2／3 階）：
 *       抵抗之手環（異常狀態抵抗，所有異常一起算）：5／10／15／25%
 *       元素之手環（火、水、風、地、無五種屬性抗性）：各 +8／15／25／40
 *       負重之手環（負重上限）：+300／600／1,000／1,500
 *       力量之手環（面板）：最大 HP +150／300／500／800、最大 MP +50／100／200／300、傷害減免 +1／2／3／5
 *       馴獸之手環（寵物、召喚物）：傷害 +3／6／10／15、命中 +3／6／10／15
 *       共鳴之手環（組合）：元素之手環一半的抗性＋馴獸之手環一半的寵物加成；升滿 3 階再加上力量之手環一半的面板加成
 *   四、織羽手環（玩家 2026-11-02 22:15）：六種手環各一個 3 階（背包裡、沒上鎖）交給赫菲，合成一個織羽手環；每個角色只能擁有一個（背包、身上、倉庫一起算）。
 *       效果＝六種 3 階全部加總 ×1.2，再加寵物傷害／命中 +25、無屬性抗性 +50：
 *       異常狀態抵抗 30%、火水風地抗性各 72、無屬性抗性 122、負重 +1,800、最大 HP +1,440、最大 MP +540、傷害減免 +10、寵物與召喚物傷害／命中 +53。
 *       它是自己一種，可以和其他任一種手環一起裝。
 *   圖示：用遊戲裡「食屍鬼的手環」的圖改成六種顏色（不能從網路抓圖）；織羽手環另外一張白金色。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bracelet', name: '手環系統（靈魂石王掉落）', group: '遊戲內容', seal: true,
    desc: '靈魂石訓練所的王掉深淵靈魂與意志抵抗精華，在席琳神殿的手環工匠換六種手環（抵抗、元素、負重、力量、馴獸、共鳴），各可升到 3 階；裝在轉生後的手環欄位' });
  if (T && !T.enabled('bracelet')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  var SOUL = 'afk_abyss_soul', ESS = 'afk_will_essence', YIN = 'afk_yin_stone', VOID = 'afk_void_stone';
  var COST = { brace: 1000, yin: 1000, up1: 2, up2: { yin: 3 }, up3: { void: 5, ess: 100, yin: 5 } };
  var DROP = { ess: 0.01, min: 5, perLv: 0.25 };
  var mat = function (id, n, c, img, d) { if (!DB.items[id]) DB.items[id] = { n: n, type: 'etc', p: 0, c: c, img: img, gachaWeight: 0, noJunk: true, d: d }; };
  mat(SOUL, '深淵靈魂', 'text-violet-300', 'assets/icons/items/失去光明的靈魂.png', '靈魂石訓練所的王留下的魂魄。席琳神殿的手環工匠 赫菲收 1,000 個換一個手環或一顆胤魂石。');
  mat(ESS, '意志抵抗精華', 'text-rose-300', 'assets/icons/ttmi/i159.jpg', '靈魂石訓練所的王 1% 掉落。升 3 階手環要 100 個。');
  mat(YIN, '胤魂石', 'text-amber-300', 'assets/icons/items/靈魂之球.png', '深淵靈魂 1,000 個凝成的石頭。升 2 階手環要 3 顆、升 3 階要 5 顆。');

  var LV = [0, 1, 2, 3], LV_N = ['', '·壹', '·貳', '·參'];
  var VAL = {
    resist: { abnormalResist: [5, 10, 15, 25] },
    element: { res: [8, 15, 25, 40] },
    weight: { weightCap: [300, 600, 1000, 1500] },
    panel: { mhp: [150, 300, 500, 800], mmp: [50, 100, 200, 300], dr: [1, 2, 3, 5] },
    pet: { petDmg: [3, 6, 10, 15], petHit: [3, 6, 10, 15] }
  };
  var TYPES = [
    ['resist', '抵抗之手環', 'text-orange-300'], ['element', '元素之手環', 'text-sky-300'], ['weight', '負重之手環', 'text-yellow-200'],
    ['panel', '力量之手環', 'text-red-300'], ['pet', '馴獸之手環', 'text-emerald-300'], ['combo', '共鳴之手環', 'text-fuchsia-300']
  ];
  var RES = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  var statsOf = function (type, lv) {
    var o = {}, half = function (v) { return Math.round(v / 2); };
    var put = function (t, k) {
      var V = VAL[t]; Object.keys(V).forEach(function (key) {
        var v = k ? half(V[key][lv]) : V[key][lv];
        if (key === 'res') RES.forEach(function (r) { o[r] = (o[r] || 0) + v; }); else o[key] = (o[key] || 0) + v;
      });
    };
    if (type === 'combo') { put('element', true); put('pet', true); if (lv >= 3) put('panel', true); }
    else put(type, false);
    return o;
  };
  var txtOf = function (o) {
    var t = [];
    if (o.abnormalResist) t.push('異常狀態抵抗 +' + o.abnormalResist + '%');
    if (o.resFire && o.resNone && o.resNone !== o.resFire) { t.push('火水風地屬性抗性各 +' + o.resFire); t.push('無屬性抗性 +' + o.resNone); }
    else if (o.resFire) t.push('火水風地無屬性抗性各 +' + o.resFire);
    if (o.weightCap) t.push('負重上限 +' + o.weightCap.toLocaleString());
    if (o.mhp) t.push('最大 HP +' + o.mhp.toLocaleString()); if (o.mmp) t.push('最大 MP +' + o.mmp.toLocaleString()); if (o.dr) t.push('傷害減免 +' + o.dr);
    if (o.petDmg) t.push('寵物與召喚物傷害 +' + o.petDmg + '、命中 +' + o.petHit);
    return t.join('、');
  };
  var idOf = function (type, lv) { return 'afk_brace_' + type + '_' + lv; };
  TYPES.forEach(function (t) {
    LV.forEach(function (lv) {
      var id = idOf(t[0], lv); if (DB.items[id]) return;
      var st = statsOf(t[0], lv);
      DB.items[id] = Object.assign({ n: t[1] + LV_N[lv], type: 'acc', slot: 'bracelet', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, c: t[2],
        img: 'assets/icons/items/afk_brace_' + t[0] + '.png', afkBrace: { type: t[0], lv: lv },
        d: '裝在手環欄位（轉生後才開放；最多兩個，同一種只能裝一個）。' + lv + ' 階：' + txtOf(st) + '。' + (t[0] === 'combo' && lv < 3 ? '升滿 3 階另外加上力量之手環一半的面板加成。' : '') + '席琳神殿的手環工匠 赫菲可以升階（最高 3 階）。' }, st);
      ['petDmg', 'petHit'].forEach(function (k) { if (DB.items[id][k] != null) { DB.items[id]['_afk' + k] = DB.items[id][k]; delete DB.items[id][k]; } });
    });
  });

  // ── 織羽手環：六種 3 階加總 ×1.2，再加寵物 +25、無屬性抗性 +50（玩家 2026-11-02 22:15 指定的數值）──
  var WEAVE = { type: 'weave', n: '織羽手環', c: 'c-legend', mult: 1.2, petAdd: 25, noneAdd: 50 };
  var weaveStats = function () {
    var sum = {}; TYPES.forEach(function (t) { var st = statsOf(t[0], 3); Object.keys(st).forEach(function (k) { sum[k] = (sum[k] || 0) + st[k]; }); });
    var o = {}; Object.keys(sum).forEach(function (k) { o[k] = Math.round(sum[k] * WEAVE.mult); });
    o.petDmg += WEAVE.petAdd; o.petHit += WEAVE.petAdd; o.resNone += WEAVE.noneAdd;
    return o;
  };
  var WEAVE_ID = idOf('weave', 3);
  if (!DB.items[WEAVE_ID]) {
    var wst = weaveStats();
    DB.items[WEAVE_ID] = Object.assign({ n: WEAVE.n, type: 'acc', slot: 'bracelet', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, c: WEAVE.c,
      img: 'assets/icons/items/afk_brace_weave.png', afkBrace: { type: 'weave', lv: 3 },
      d: '六種手環的力量織成一環。裝在手環欄位（轉生後才開放），可以和其他任一種手環一起裝。效果：' + txtOf(wst) + '。每個角色只能擁有一個。席琳神殿的手環工匠 赫菲用六種 3 階手環各一個合成。' }, wst);
    ['petDmg', 'petHit'].forEach(function (k) { DB.items[WEAVE_ID]['_afk' + k] = DB.items[WEAVE_ID][k]; delete DB.items[WEAVE_ID][k]; });
  }
  // 手環、刻印、聖物欄位也算進「裝備欄位」（抵抗、負重、重量都掃這張表）
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined') ['bracelet', 'bracelet2', 'engrave', 'holy'].forEach(function (k) { if (WEIGHT_COUNT_SLOTS.indexOf(k) < 0) WEIGHT_COUNT_SLOTS.push(k); }); } catch (e) {}

  // ── 手環兩格（玩家 2026-11-02 04:22：手環可以裝兩個，都在戒指右邊的位置）──
  //   裝備時先放空的那格；同一種手環只能裝一個（換階時直接換掉同一種的那一格）；兩格都滿就換掉第 1 格。
  var SLOTS = ['bracelet', 'bracelet2'];
  var typeIn = function (p, k) { var e = p.eq[k], d = e && DB.items[e.id]; return d && d.afkBrace ? d.afkBrace.type : null; };
  var pickSlot = function (p, d) {
    var t = d.afkBrace && d.afkBrace.type;
    for (var i = 0; i < SLOTS.length; i++) if (typeIn(p, SLOTS[i]) === t) return SLOTS[i];
    for (var j = 0; j < SLOTS.length; j++) if (!p.eq[SLOTS[j]]) return SLOTS[j];
    return SLOTS[0];
  };
  if (typeof W.equipItem === 'function') {
    var oEq = W.equipItem;
    W.equipItem = function (item) {
      var p = P(), d = item && DB.items[item.id];
      if (!p || !d || d.slot !== 'bracelet' || !d.afkBrace || !p.eq) return oEq.apply(this, arguments);
      var to = pickSlot(p, d);
      if (to === 'bracelet') return oEq.apply(this, arguments);
      d.slot = to;
      try { return oEq.apply(this, arguments); } finally { d.slot = 'bracelet'; }
    };
    try { (0, eval)('equipItem = window.equipItem'); } catch (e) {}
  }

  // 寵物、召喚物
  var petBonus = function () {
    var p = P(); if (!p || !p.eq || p.classicMode) return null;
    var o = { dmg: 0, hit: 0 }, any = false;
    SLOTS.forEach(function (k) { var e = p.eq[k], d = e && DB.items[e.id]; if (d && d.afkBrace) { o.dmg += d._afkpetDmg || 0; o.hit += d._afkpetHit || 0; any = true; } });
    return any ? o : null;
  };
  if (typeof W.petGearBonus === 'function') {
    var oPG = W.petGearBonus;
    W.petGearBonus = function () { var r = oPG.apply(this, arguments); try { var b = petBonus(); if (b && r) { r.dmg = (r.dmg || 0) + b.dmg; r.hit = (r.hit || 0) + b.hit; } } catch (e) {} return r; };
    try { (0, eval)('petGearBonus = window.petGearBonus'); } catch (e) {}
  }
  if (typeof W.summonGearBonus === 'function') {
    var oSG = W.summonGearBonus;
    W.summonGearBonus = function (owner) { var r = oSG.apply(this, arguments); try { var p = P(); if (owner === p || !owner) { var b = petBonus(); if (b && r) { r.dmg = (r.dmg || 0) + b.dmg; r.hit = (r.hit || 0) + b.hit; } } } catch (e) {} return r; };
    try { (0, eval)('summonGearBonus = window.summonGearBonus'); } catch (e) {}
  }

  // ── 掉落：靈魂石訓練所的王 ──
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id && !i.lock ? Math.max(1, Number(i.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (count(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var soulsFor = function (m) { return Math.max(DROP.min, Math.floor((m.lv || 1) * DROP.perLv)); };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState && mapState.mobs ? mapState.mobs[idx] : null, was = m && !m._dead && m._afkSoul;
      var r = oKill.apply(this, arguments);
      try {
        var p = P();
        if (was && m._dead && !m._afkBraceDrop && p && !p.classicMode) {
          m._afkBraceDrop = true;
          var n = soulsFor(m); gainItem(SOUL, n, true, true);
          var got = '深淵靈魂 ×' + n;
          if (Math.random() < DROP.ess) { gainItem(ESS, 1, true, true); got += '、意志抵抗精華 ×1'; }
          sys('<span class="text-violet-300">' + esc(m.n) + ' 留下了 ' + got + '。</span>');
        }
      } catch (e) { console.warn('[AFK-bracelet] drop', e); }
      return r;
    };
  }

  // ── 手環工匠 ──
  var NPC_ID = 'npc_afk_brace', NPC_N = '手環工匠 赫菲', TOWN = 'town_sherine';
  try { var L = W.__afkLore, def = { id: NPC_ID, n: NPC_N, title: '手環', type: 'quest', classicHide: true, d: '在席琳神殿收集深淵靈魂的工匠，把王的魂魄打進手環裡。' }; if (L && L.addNpc) L.addNpc(TOWN, def, null, null); else if (DB.towns[TOWN]) DB.towns[TOWN].npcs.push(def); } catch (e) {}
  var buy = function (type) {
    if (!TYPES.some(function (t) { return t[0] === type; })) return false;
    var DC = W.__afkDiaCost, dc = DC ? DC.COST.braceMake : 0, miss = DC ? DC.check(dc) : null;   // 2026-11-03：製作另收龍鑽 10,000＋金幣
    if (miss) { sys('<span class="text-amber-300">製作手環要' + DC.txt(dc) + '：' + miss + '。</span>'); return false; }
    if (!take(SOUL, COST.brace)) { sys('<span class="text-amber-300">深淵靈魂不夠（要 ' + COST.brace + ' 個）。</span>'); return false; }
    if (DC) DC.pay(dc);
    gainItem(idOf(type, 0), 1, true, true); sys('<span class="text-fuchsia-300">赫菲把深淵靈魂打進手環——你得到了 ' + esc(DB.items[idOf(type, 0)].n) + '。</span>'); try { saveGame(); } catch (e) {} return true;
  };
  var makeYin = function () { if (!take(SOUL, COST.yin)) { sys('<span class="text-amber-300">深淵靈魂不夠（要 ' + COST.yin + ' 個）。</span>'); return false; } gainItem(YIN, 1, true, true); sys('得到胤魂石 ×1。'); try { saveGame(); } catch (e) {} return true; };
  var need = function (lv) { return lv === 0 ? '同一種 0 階手環 ×2' : lv === 1 ? '胤魂石 ×' + COST.up2.yin : '破空石 ×' + COST.up3.void + '＋意志抵抗精華 ×' + COST.up3.ess + '＋胤魂石 ×' + COST.up3.yin; };
  var canUp = function (type, lv) {
    if (lv >= 3) return false;
    if (lv === 0) return count(idOf(type, 0)) >= COST.up1;
    if (lv === 1) return count(YIN) >= COST.up2.yin && count(idOf(type, 1)) >= 1;
    return count(VOID) >= COST.up3.void && count(ESS) >= COST.up3.ess && count(YIN) >= COST.up3.yin && count(idOf(type, 2)) >= 1;
  };
  var upgrade = function (type, lv) {
    if (!canUp(type, lv)) { sys('<span class="text-amber-300">升階材料不夠：' + need(lv) + '（手環要放在背包、沒有上鎖）。</span>'); return false; }
    var DC = W.__afkDiaCost, dc = DC ? DC.COST.braceUp[Math.min(2, lv)] : 0, miss = DC ? DC.check(dc) : null;   // 2026-11-03：升階另收龍鑽 20,000／30,000＋金幣
    if (miss) { sys('<span class="text-amber-300">升階要' + DC.txt(dc) + '：' + miss + '。</span>'); return false; }
    if (DC) DC.pay(dc);
    if (lv === 0) take(idOf(type, 0), COST.up1);
    else if (lv === 1) { take(YIN, COST.up2.yin); take(idOf(type, 1), 1); }
    else { take(VOID, COST.up3.void); take(ESS, COST.up3.ess); take(YIN, COST.up3.yin); take(idOf(type, 2), 1); }
    gainItem(idOf(type, lv + 1), 1, true, true);
    sys('<span class="c-legend font-bold">手環升階成功：' + esc(DB.items[idOf(type, lv + 1)].n) + '。</span>');
    try { saveGame(); renderTabs(); } catch (e) {} return true;
  };
  // 織羽手環：背包（含上鎖）、身上、倉庫裡有一個就不能再做
  var weaveOwned = function () {
    var p = P(); if (!p) return 0; var n = 0;
    (p.inv || []).forEach(function (i) { if (i && i.id === WEAVE_ID) n += Math.max(1, Number(i.cnt) || 1); });
    if (p.eq) Object.keys(p.eq).forEach(function (k) { var e = p.eq[k]; if (e && e.id === WEAVE_ID) n++; });
    try { var s = typeof _lzGet === 'function' && typeof whKey === 'function' ? _lzGet(whKey()) : null; if (s) { var w = JSON.parse(s); (w.items || []).forEach(function (i) { if (i && i.id === WEAVE_ID) n += Math.max(1, Number(i.cnt) || 1); }); } } catch (e) {}
    return n;
  };
  var canWeave = function () { return !weaveOwned() && TYPES.every(function (t) { return count(idOf(t[0], 3)) >= 1; }); };
  var weave = function () {
    if (weaveOwned()) { sys('<span class="text-amber-300">織羽手環每個角色只能擁有一個。</span>'); return false; }
    if (!canWeave()) { sys('<span class="text-amber-300">要六種手環各一個 3 階（放在背包、沒有上鎖）。</span>'); return false; }
    TYPES.forEach(function (t) { take(idOf(t[0], 3), 1); });
    gainItem(WEAVE_ID, 1, true, true);
    sys('<span class="c-legend font-bold">赫菲把六種手環織成一環——你得到了織羽手環。</span>');
    try { saveGame(); renderTabs(); } catch (e) {} return true;
  };
  // ── 手環工匠介面（玩家 2026-11-02 04:22：介面太簡陋 → 重做）──
  //   上方：材料列＋胤魂石兌換；中間：目前裝著的兩格；六種手環的頁籤（顯示背包裡最高階）；下方：選中那種的效果表與製作／升階配方。
  var ui = { sel: 'resist' };
  var CSS = '#afk-brace{padding:12px;color:#d6d3d1;font-size:13px;line-height:1.5}'
    + '#afk-brace .br-hd{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #6b5a3a;border-radius:10px;background:linear-gradient(135deg,rgba(76,29,149,.35),rgba(30,27,36,.9) 60%)}'
    + '#afk-brace .br-hd img{width:44px;height:44px;border-radius:8px;flex:0 0 44px}'
    + '#afk-brace .br-hd b{font-size:16px;color:#f5d28a;letter-spacing:1px}#afk-brace .br-hd small{display:block;color:#a8a29e;font-size:12px}'
    + '#afk-brace .br-mats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}'
    + '#afk-brace .br-mat{display:flex;flex-direction:column;align-items:center;padding:6px 2px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85);min-width:0}'
    + '#afk-brace .br-mat img{width:30px;height:30px;object-fit:contain}#afk-brace .br-mat span{font-size:11px;color:#a8a29e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}#afk-brace .br-mat b{font-size:14px;color:#fde68a}'
    + '#afk-brace .br-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding:8px 10px;border:1px dashed #4b4553;border-radius:8px;background:rgba(17,16,22,.6)}'
    + '#afk-brace .br-sec{margin-top:12px;font-weight:bold;color:#e7d2a7;font-size:13px;display:flex;align-items:center;gap:6px}#afk-brace .br-sec:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#6b5a3a,transparent)}'
    + '#afk-brace .br-eq{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'
    + '#afk-brace .br-eqs{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85);min-width:0}'
    + '#afk-brace .br-eqs img{width:36px;height:36px;border-radius:6px;flex:0 0 36px}#afk-brace .br-eqs .nm{font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#afk-brace .br-eqs .em{color:#78716c;font-size:12px}'
    + '#afk-brace .br-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin-top:6px}'
    + '#afk-brace .br-tab{position:relative;display:flex;flex-direction:column;align-items:center;padding:6px 2px 4px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85);cursor:pointer;min-width:0;color:inherit;font:inherit}'
    + '#afk-brace .br-tab img{width:40px;height:40px;border-radius:6px}#afk-brace .br-tab span{font-size:11px;white-space:nowrap}'
    + '#afk-brace .br-tab.on{border-color:#f5d28a;box-shadow:0 0 0 1px #f5d28a inset,0 0 10px rgba(245,210,138,.35);background:rgba(68,52,24,.55)}'
    + '#afk-brace .br-tab i{position:absolute;top:2px;right:4px;font-style:normal;font-size:10px;color:#fde68a;text-shadow:0 0 2px #000}'
    + '#afk-brace .br-card{margin-top:8px;padding:10px;border:1px solid #6b5a3a;border-radius:10px;background:rgba(20,18,26,.92)}'
    + '#afk-brace .br-top{display:flex;gap:12px;align-items:center}#afk-brace .br-top img{width:64px;height:64px;border-radius:10px;flex:0 0 64px}'
    + '#afk-brace .br-top .ttl{font-size:16px;font-weight:bold}#afk-brace .br-top .why{font-size:12px;color:#a8a29e}'
    + '#afk-brace .pips{display:inline-flex;gap:3px;margin-left:6px;vertical-align:middle}#afk-brace .pips u{width:9px;height:9px;transform:rotate(45deg);border:1px solid #f5d28a;display:inline-block}#afk-brace .pips u.f{background:#f5d28a;box-shadow:0 0 4px #f5d28a}'
    + '#afk-brace table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}#afk-brace td{padding:5px 6px;border-top:1px solid #2e2a35;vertical-align:top}'
    + '#afk-brace td.lv{white-space:nowrap;color:#f5d28a;font-weight:bold;width:1%}#afk-brace td.cnt{white-space:nowrap;text-align:right;color:#a8a29e;width:1%}#afk-brace tr.mx td{background:rgba(245,210,138,.08)}'
    + '#afk-brace .rcp{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:6px;padding:8px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85)}'
    + '#afk-brace .rcp .to{display:flex;align-items:center;gap:4px;font-weight:bold;white-space:nowrap}#afk-brace .rcp .to img{width:30px;height:30px;border-radius:5px}'
    + '#afk-brace .need{display:flex;flex-wrap:wrap;gap:4px}#afk-brace .need span{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:99px;font-size:11px;background:rgba(127,29,29,.45);color:#fecaca;white-space:nowrap}'
    + '#afk-brace .need span.ok{background:rgba(20,83,45,.5);color:#bbf7d0}#afk-brace .need img{width:14px;height:14px;object-fit:contain}'
    + '#afk-brace button.bb{padding:6px 14px!important;border-radius:8px!important;font-weight:bold;font-size:13px;border:1px solid #fcd34d!important;background:linear-gradient(#d97706,#92400e)!important;color:#fffbeb!important;cursor:pointer;white-space:nowrap;box-shadow:0 0 8px rgba(251,191,36,.35);text-shadow:0 1px 1px #000;opacity:1!important}'
    + '#afk-brace button.bb[disabled]{border-color:#3f3a46!important;background:#1c1a22!important;color:#57534e!important;cursor:not-allowed;box-shadow:none;text-shadow:none}'
    + '#afk-brace .note{font-size:11px;color:#8b8580;margin-top:6px}'
    + '@media (max-width:480px){#afk-brace .br-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}#afk-brace .rcp{grid-template-columns:1fr auto}#afk-brace .rcp .to{grid-column:1/-1}}';
  var css = function () { if (document.getElementById('afk-brace-css')) return; var st = document.createElement('style'); st.id = 'afk-brace-css'; st.textContent = CSS; document.head.appendChild(st); };
  var ico = function (id) { var d = DB.items[id]; try { return d && typeof getIconUrl === 'function' ? getIconUrl(d) : (d && d.img) || ''; } catch (e) { return (d && d.img) || ''; } };
  var pips = function (lv) { var h = '<span class="pips">'; for (var i = 1; i <= 3; i++) h += '<u class="' + (i <= lv ? 'f' : '') + '"></u>'; return h + '</span>'; };
  var tName = function (type) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === type) return TYPES[i]; return TYPES[0]; };
  var WHY = { resist: '所有異常狀態一起抵抗', element: '火、水、風、地、無五種屬性抗性', weight: '負重上限', panel: '最大 HP、最大 MP、傷害減免', pet: '寵物與召喚物的傷害、命中', combo: '元素＋馴獸各一半，3 階再加力量一半' };
  var chip = function (id, n, label) { var have = count(id); return '<span class="' + (have >= n ? 'ok' : '') + '"><img src="' + esc(ico(id)) + '">' + esc(label || (DB.items[id] || {}).n || id) + ' ' + have.toLocaleString() + '/' + n.toLocaleString() + '</span>'; };
  var diaOf = function (lv) { var DC = W.__afkDiaCost; return DC ? (lv === -1 ? DC.COST.braceMake : DC.COST.braceUp[Math.min(2, lv)]) : 0; };
  var diaChip = function (lv) { var DC = W.__afkDiaCost, d = diaOf(lv); if (!DC || !d) return ''; return '<span class="' + (DC.check(d) ? '' : 'ok') + '">💎 ' + d.toLocaleString() + '＋金幣 ' + DC.goldOf(d).toLocaleString() + '</span>'; };
  var diaOk = function (lv) { var DC = W.__afkDiaCost; return !DC || !DC.check(diaOf(lv)); };
  var needChips = function (type, lv) { return needChips0(type, lv) + diaChip(lv); };
  var needChips0 = function (type, lv) {
    if (lv === -1) return chip(SOUL, COST.brace);
    if (lv === 0) return chip(idOf(type, 0), COST.up1, '0 階');
    if (lv === 1) return chip(idOf(type, 1), 1, '1 階') + chip(YIN, COST.up2.yin);
    return chip(idOf(type, 2), 1, '2 階') + chip(VOID, COST.up3.void) + chip(ESS, COST.up3.ess) + chip(YIN, COST.up3.yin);
  };
  var render = function (div) {
    var p = P(); if (!p || !div) return;
    if (p.classicMode) { div.innerHTML = '<div class="p-4 text-slate-300">' + NPC_N + '：經典模式不開放。</div>'; return; }
    css();
    var t = tName(ui.sel), type = t[0];
    var have = LV.map(function (lv) { return count(idOf(type, lv)); });
    var top = -1; LV.forEach(function (lv) { if (have[lv] > 0) top = lv; });
    SLOTS.forEach(function (k) { var e = p.eq && p.eq[k], d = e && DB.items[e.id]; if (d && d.afkBrace && d.afkBrace.type === type) top = Math.max(top, d.afkBrace.lv); });
    var h = '<div id="afk-brace">'
      + '<div class="br-hd"><img src="' + esc(ico(idOf('combo', 3))) + '"><div><b>手環工匠 赫菲</b><small>把靈魂石王的魂魄打進手環。手環欄位在轉生後開放，最多裝兩個（同一種只能一個）。</small></div></div>'
      + '<div class="br-mats">' + [[SOUL, '深淵靈魂'], [YIN, '胤魂石'], [ESS, '意志抵抗精華'], [VOID, '破空石']].map(function (m) {
          return '<div class="br-mat"><img src="' + esc(ico(m[0])) + '"><span>' + m[1] + '</span><b>' + count(m[0]).toLocaleString() + '</b></div>'; }).join('') + '</div>'
      + '<div class="br-row"><div class="need" style="flex:1">' + chip(SOUL, COST.yin) + '</div><button class="bb" data-afk-br="yin"' + (count(SOUL) >= COST.yin ? '' : ' disabled') + '>換胤魂石</button></div>'
      + '<div class="br-sec">目前裝著</div><div class="br-eq">' + SLOTS.map(function (k, i) {
          var e = p.eq && p.eq[k], d = e && DB.items[e.id];
          if (!d) return '<div class="br-eqs"><div class="em">手環 ' + (i + 1) + '：' + ((W.__afkRebirthSlotOn && W.__afkRebirthSlotOn(p)) ? '空' : '轉生後開放') + '</div></div>';
          return '<div class="br-eqs"><img src="' + esc(ico(e.id)) + '"><div style="min-width:0"><div class="nm ' + esc(d.c || '') + '">' + esc(d.n) + '</div>' + pips(d.afkBrace ? d.afkBrace.lv : 0) + '</div></div>';
        }).join('') + '</div>'
      + '<div class="br-sec">六種手環</div><div class="br-tabs">' + TYPES.map(function (x) {
          var mx = -1; LV.forEach(function (lv) { if (count(idOf(x[0], lv)) > 0) mx = lv; });
          SLOTS.forEach(function (k) { var e = p.eq && p.eq[k], d = e && DB.items[e.id]; if (d && d.afkBrace && d.afkBrace.type === x[0]) mx = Math.max(mx, d.afkBrace.lv); });
          return '<button type="button" class="br-tab' + (x[0] === type ? ' on' : '') + '" data-afk-br="sel:' + x[0] + '"><img src="' + esc(ico(idOf(x[0], 0))) + '"><span class="' + x[2] + '">' + x[1].replace('之手環', '') + '</span>' + (mx >= 0 ? '<i>' + mx + ' 階</i>' : '') + '</button>';
        }).join('') + '</div>'
      + '<div class="br-card"><div class="br-top"><img src="' + esc(ico(idOf(type, 0))) + '"><div><div class="ttl ' + t[2] + '">' + esc(t[1]) + pips(Math.max(0, top)) + '</div><div class="why">' + esc(WHY[type] || '') + '</div></div></div>'
      + '<table>' + LV.map(function (lv) {
          return '<tr class="' + (lv === top ? 'mx' : '') + '"><td class="lv">' + lv + ' 階</td><td>' + esc(txtOf(statsOf(type, lv))) + '</td><td class="cnt">背包 ' + have[lv] + '</td></tr>';
        }).join('') + '</table>'
      + '<div class="br-sec">製作與升階</div>'
      + [-1, 0, 1, 2].map(function (lv) {
          var ok = (lv === -1 ? count(SOUL) >= COST.brace : canUp(type, lv)) && diaOk(lv), to = lv + 1;
          return '<div class="rcp"><div class="to"><img src="' + esc(ico(idOf(type, to))) + '">' + (lv === -1 ? '製作 0 階' : '升 ' + to + ' 階') + '</div><div class="need">' + needChips(type, lv) + '</div>'
            + '<button class="bb" data-afk-br="' + (lv === -1 ? 'buy:' + type : 'up:' + type + ':' + lv) + '"' + (ok ? '' : ' disabled') + '>' + (lv === -1 ? '製作' : '升階') + '</button></div>';
        }).join('')
      + '<div class="note">升階用的手環要放在背包裡、沒有上鎖（裝著的請先卸下）。深淵靈魂必掉、意志抵抗精華 1%，都只在靈魂石訓練所打倒王時掉落；破空石是時空裂痕夢域鏡完全通關給的。</div>'
      + '</div>'
      + '<div class="br-sec">織羽手環</div><div class="br-card"><div class="br-top"><img src="' + esc(ico(WEAVE_ID)) + '"><div><div class="ttl c-legend">織羽手環</div><div class="why">' + esc(txtOf(weaveStats())) + '</div></div></div>'
      + '<div class="rcp"><div class="to"><img src="' + esc(ico(WEAVE_ID)) + '">合成</div><div class="need">' + TYPES.map(function (t) { return chip(idOf(t[0], 3), 1, t[1].replace('之手環', '') + ' 3 階'); }).join('') + '</div>'
      + '<button class="bb" data-afk-br="weave"' + (canWeave() ? '' : ' disabled') + '>' + (weaveOwned() ? '已擁有' : '合成') + '</button></div>'
      + '<div class="note">六種手環各一個 3 階合成一個，每個角色只能擁有一個（背包、身上、倉庫一起算）。可以和其他任一種手環一起裝。</div></div>'
      + '</div>';
    div.innerHTML = h;
    div.querySelectorAll('[data-afk-br]').forEach(function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-afk-br').split(':');
        if (a[0] === 'sel') ui.sel = a[1];
        else if (a[0] === 'yin') makeYin(); else if (a[0] === 'buy') buy(a[1]); else if (a[0] === 'up') upgrade(a[1], Number(a[2])); else if (a[0] === 'weave') weave();
        render(div);
      };
    });
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) { var r = oNpc.apply(this, arguments); try { if (npcId === NPC_ID) render(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-bracelet]', e); } return r; };
  }
  W.__afkBracelet = { ui: ui, SLOTS: SLOTS, pickSlot: pickSlot, SOUL: SOUL, ESS: ESS, YIN: YIN, VOID: VOID, COST: COST, DROP: DROP, TYPES: TYPES, VAL: VAL, statsOf: statsOf, txtOf: txtOf, WEAVE_ID: WEAVE_ID, weaveStats: weaveStats, weave: weave, canWeave: canWeave, weaveOwned: weaveOwned, idOf: idOf, buy: buy, makeYin: makeYin, upgrade: upgrade, canUp: canUp, soulsFor: soulsFor, render: render, NPC_ID: NPC_ID, count: count };
})();
