/* ============================================================================
 * afk-expedition.js — 冒險者遠征與刻印石；轉生後的聖物、手環、刻印欄位（玩家 2026-11-02 01:02；外掛開關 expedition，預設開；經典模式不開放）
 *
 *   一、轉生欄位：轉生後（一轉起）裝備視窗第二頁多三格——聖物（魔法娃娃的位置）、手環（戒指左 1 的位置）、刻印（戒指右 1 的位置）。
 *       聖物、手環目前還沒有能裝的道具（先開欄位）；刻印只能裝刻印石。核心補丁 83 負責畫格子。
 *   二、遠征點數（每個角色各自計算）：打倒這 6 個副本的最後頭目，每個副本每天（本機日期）第一次給 10 點：
 *       四龍副本（被侵蝕的時空安塔瑞斯、破滅的時空法利昂、深淵的時空巴拉卡斯、災厄的時空林德拜爾）、哈汀的時空（大魔法師 哈汀）、闇龍的低語（闇龍 哈爾巴斯）。
 *       不分難度；在席琳夢域鏡打倒 ×1.5（15 點，可以超過一天 60 點）。時空裂痕、靈魂石訓練所、暗夢星迴裡打倒的不算。
 *       升上位者那一段（下位者 → 上位者）只有夢域鏡給點，而且 ×0.8（每個副本 8 點、一天 48 點，500 點約 11 天）。
 *   三、遠征位階（在冒險者公會旁的「遠征隊長 托爾」升階；升階花掉點數）：
 *       無段者：S 級冒險者，而且 S 級的武器、防具、飾品三件遺物都換過，100 點
 *       初段：200 點　下位者：300 點　上位者：500 點（只計夢域鏡的點數）
 *       每升一階給該階的刻印石（裝在刻印欄位，限轉生後；只能裝一顆）：
 *         無段者的刻印石：打一轉女神（初次輪迴）時受到女神與使徒的傷害 −5%、對它們的傷害 +5%；藥水恢復量 +5%
 *         初段者的刻印石：終焉第一階層（席琳夢境，轉生後）同上；藥水恢復量 +10%
 *         下位者的刻印石：終焉第二階層（席琳幻影）同上；藥水恢復量 +15%
 *         上位者的刻印石：終焉第三階層（席琳伴身）同上；藥水恢復量 +20%；受到的異常狀態持續時間 −10%
 *       每顆只對自己那一場有效（不疊加低階的效果）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'expedition', name: '冒險者遠征與遠征徽記（轉生欄位）', group: '遊戲內容', seal: true,
    desc: '轉生後開聖物、手環、遠征徽記欄位；打四龍副本、哈汀的時空、闇龍的低語給遠征點數，在遠征隊長升遠征位階、拿遠征徽記（打女神時的減傷、增傷與藥水恢復量）' });
  var on = function () { return !T || T.enabled('expedition'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // ── 一、轉生欄位 ──
  var SLOTS = { holy: '聖物', bracelet: '手環', bracelet2: '手環', engrave: '遠征徽記' };
  var slotOn = function (p) { return !!(p && on() && !p.classicMode && (p.rebirth || 0) > 0); };
  W.__afkRebirthSlotOn = slotOn;
  // 聖物格：轉生後，或身上有日輪聖甲蟲（afk-scarab 設 __afkScarabOwns；核心補丁 89）
  W.__afkHolySlotOn = function (p) { if (!p || p.classicMode) return false; if (slotOn(p)) return true; try { return !!(W.__afkScarabOwns && W.__afkScarabOwns(p)); } catch (e) { return false; } };
  if (typeof W.equipItem === 'function') {
    var oEq = W.equipItem;
    W.equipItem = function (item) {
      var p = P(), d = item && DB.items[item.id];
      if (p && d && SLOTS[d.slot] && !d.afkScarab && !slotOn(p)) {   // 日輪聖甲蟲不用轉生（afk-scarab）
        sys('<span class="text-amber-300">「' + esc(d.n) + '」要裝在' + SLOTS[d.slot] + '欄位，轉生後才會開放。</span>'); return; }
      return oEq.apply(this, arguments);
    };
    try { (0, eval)('equipItem = window.equipItem'); } catch (e) {}
  }
  try {
    var css = document.createElement('style'); css.id = 'afk-reb-slot-css';
    css.textContent = '.equipment-slot-lbl{position:absolute;left:0;right:0;bottom:2px;text-align:center;font-size:10px;font-weight:bold;color:#c4b5fd;text-shadow:0 0 2px #000,0 0 2px #000;pointer-events:none}';
    document.head.appendChild(css);
  } catch (e) {}

  // ── 刻印石 ──
  var RANKS = [
    { key: 'none', n: '（尚未入階）' },
    { key: 'r1', n: '無段者', cost: 100, stone: 'afk_engrave_1', pot: 5, fight: 'novice', fightN: '一轉女神（初次輪迴）', c: '#a3e635' },
    { key: 'r2', n: '初段', cost: 200, stone: 'afk_engrave_2', pot: 10, fight: 'first', fightN: '終焉第一階層（席琳夢境）', c: '#38bdf8' },
    { key: 'r3', n: '下位者', cost: 300, stone: 'afk_engrave_3', pot: 15, fight: 'tier2', fightN: '終焉第二階層（席琳幻影）', c: '#c084fc' },
    { key: 'r4', n: '上位者', cost: 500, stone: 'afk_engrave_4', pot: 20, fight: 'tier3', fightN: '終焉第三階層（席琳伴身）', c: '#fbbf24', debuff: 0.9, dreamOnly: 0.8 }
  ];
  var DMG = 0.05;
  RANKS.slice(1).forEach(function (r) {
    if (DB.items[r.stone]) return;
    DB.items[r.stone] = { n: r.n + '的遠征徽記', type: 'acc', slot: 'engrave', req: 'all', safe: 0, p: 0, gachaWeight: 0, noTrade: true, noEnhance: true, noSell: true, c: 'text-violet-300',
      img: 'assets/icons/items/靈魂之球.png', afkEngrave: RANKS.indexOf(r),
      d: '遠征位階「' + r.n + '」的證明。裝在遠征徽記欄位（轉生後才開放）。打' + r.fightN + '時受到的傷害 −5%、造成的傷害 +5%；藥水恢復量 +' + r.pot + '%' + (r.debuff ? '；受到的異常狀態持續時間 −10%' : '') + '。' };
  });
  var stoneOf = function (a) { var e = a && a.eq && a.eq.engrave, d = e && DB.items[e.id]; return d && d.afkEngrave ? RANKS[d.afkEngrave] : null; };
  var fightNow = function () {
    var s = S(); if (!s._afkFinal) return null;
    var m = s._afkFinalMode || 'first';
    if (m === 'first') return s._afkFinalNovice ? 'novice' : 'first';
    return m;   // tier2／tier3（second＝二轉決戰、solo 不算）
  };
  var godSide = function (m) { return !!(m && (m._afkFinal || m._afkApostle)); };
  var stoneActive = function (a) { var r = stoneOf(a); return !!(r && on() && slotOn(a) && fightNow() === r.fight); };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return godSide(mob) && stoneActive(ent) ? 1 - DMG : 1; });
  var prevIn = W.__afkIncomingMod;
  W.__afkIncomingMod = function (t, dmg) { var v = typeof prevIn === 'function' ? prevIn.apply(this, arguments) : dmg; try { if (stoneActive(t)) v = v * (1 - DMG); } catch (e) {} return v; };
  var hooked = false;
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function' || C.damage.__afkEngrave) return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target) { var v = o.apply(this, arguments); try { if (v > 0 && godSide(target) && stoneActive(actor)) v = Math.floor(v * (1 + DMG)); } catch (e) {} return v; };
    C.damage.__afkEngrave = true;
  };
  hook(); W.addEventListener('load', hook);
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { var p = P(), r = stoneOf(p); if (r && on() && slotOn(p)) v += r.pot; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  // 上位者：異常狀態持續時間 −10%（每 tick 看新上身或被刷新的狀態，跟粹煉之魂同一套做法）
  var DEBUFFS = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'];
  var lastSt = new WeakMap();
  var debuffTick = function () {
    var p = P(); if (!p || p.classicMode || !on()) return;
    [p].concat(p.allies || []).forEach(function (a) {
      var r = stoneOf(a), st = a && a.statuses; if (!st || !r || !r.debuff || !slotOn(a)) { if (a) lastSt.delete(a); return; }
      var prev = lastSt.get(a) || {}, now = {};
      DEBUFFS.forEach(function (k) { var v = Number(st[k]) || 0; if (v > 0 && v > (Number(prev[k]) || 0)) { v = Math.max(Number(prev[k]) || 0, Math.max(1, Math.round(v * r.debuff))); st[k] = v; } now[k] = v; });
      lastSt.set(a, now);
    });
  };

  // ── 二、遠征點數 ──
  var DUNG = { ant_antharas_s7: '侵蝕的安塔瑞斯巢穴', cr_fafurion_d7: '法利昂副本', cr_valakas_d7: '巴拉卡斯副本', cr_lindvior_d7: '林德拜爾副本', afk_hd_hardin: '哈汀的時空', afk_hp_halpas: '闇龍的低語' };
  var BASE = 10, DREAM_X = 1.5, NAMES = null;
  var byName = function () { if (!NAMES) { NAMES = {}; Object.keys(DUNG).forEach(function (k) { if (DB.mobs[k]) NAMES[DB.mobs[k].n] = k; }); } return NAMES; };
  var store = function (p) {
    p = p || P(); if (!p) return null;
    if (!p.afkExped || typeof p.afkExped !== 'object') p.afkExped = { pts: 0, rank: 0, day: '', got: {}, total: 0 };
    var x = p.afkExped; if (x.day !== today()) { x.day = today(); x.got = {}; } return x;
  };
  var dream = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  var excluded = function () { var s = S(), cur = (typeof mapState !== 'undefined' && mapState && mapState.current) || ''; return !!(s.riftRun || s.dreamStar || cur === 'afk_soul_room' || cur === 'rift_battle'); };
  var award = function (mobId) {
    var p = P(); if (!p || p.classicMode || !on() || !DUNG[mobId] || excluded()) return 0;
    var x = store(p); if (x.got[mobId]) return 0;
    var pts;
    if (x.rank === 3) { if (!dream()) return 0; pts = Math.round(BASE * RANKS[4].dreamOnly); }   // 下位者 → 上位者：只有夢域鏡，×0.8
    else pts = Math.round(BASE * (dream() ? DREAM_X : 1));
    x.got[mobId] = pts; x.pts += pts; x.total = (x.total || 0) + pts;
    sys('<span class="text-violet-300 font-bold">🧭 遠征：打倒' + esc(DUNG[mobId]) + '的最後頭目，遠征點數 +' + pts + '（目前 ' + x.pts + ' 點）。</span>');
    return pts;
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState && mapState.mobs ? mapState.mobs[idx] : null, id = m && (DUNG[m.mobId] ? m.mobId : byName()[m.n]), was = m && !m._dead;
      var r = oKill.apply(this, arguments);
      try { if (was && m._dead && id && DUNG[id]) award(id); } catch (e) { console.warn('[AFK-expedition] award', e); }
      return r;
    };
  }
  var sReady = function (p) {
    var H = W.__afkHunter; if (!H || !H.isS || !H.isS(p)) return '要先成為 S 級冒險者';
    var h = H.store(p), n = h && h.relics ? Object.keys(h.relics).filter(function (k) { return h.relics[k]; }).length : 0;
    return n >= 3 ? '' : 'S 級的武器、防具、飾品三件遺物還沒換完（' + n + '／3）';
  };
  var whyNot = function (p) {
    var x = store(p); if (!p || p.classicMode) return '經典模式不開放';
    if (x.rank >= 4) return '已經是最高位階';
    var next = RANKS[x.rank + 1];
    if (x.rank === 0) { var w = sReady(p); if (w) return w; }
    if (x.pts < next.cost) return '遠征點數不夠（' + x.pts + '／' + next.cost + '）';
    return '';
  };
  var promote = function () {
    var p = P(), w = whyNot(p); if (w) { sys('<span class="text-amber-300">遠征隊長：' + esc(w) + '。</span>'); return false; }
    var x = store(p), next = RANKS[x.rank + 1];
    x.pts -= next.cost; x.rank++;
    try { gainItem(next.stone, 1, true, true); } catch (e) {}
    sys('<span class="c-legend font-bold">🧭 遠征位階升為「' + next.n + '」！</span><span class="text-violet-300">獲得 ' + esc(DB.items[next.stone].n) + '。</span>');
    try { saveGame(); renderTabs(); } catch (e) {}
    return true;
  };

  // ── 遠征隊長 ──
  var NPC_ID = 'npc_afk_exped', NPC_N = '遠征隊長 托爾';
  try {
    var L = W.__afkLore;
    ['town_talking', 'town_giran', 'town_aden', 'town_oren'].forEach(function (t) {
      var def = { id: NPC_ID, n: NPC_N, title: '冒險者遠征', type: 'quest', classicHide: true, d: '帶領 S 級冒險者遠征各大副本的隊長。替遠征隊員評定位階，頒發遠征徽記。' };
      if (L && L.addNpc) L.addNpc(t, def, '949', null); else if (DB.towns[t]) DB.towns[t].npcs.push(def);
    });
  } catch (e) {}
  var render = function (div) {
    var p = P(); if (!p || !div) return;
    if (p.classicMode || !on()) { div.innerHTML = '<div class="p-4 text-slate-300">' + NPC_N + '：經典模式不開放。</div>'; return; }
    var x = store(p), cur = RANKS[x.rank], next = RANKS[x.rank + 1], w = whyNot(p);
    var rows = Object.keys(DUNG).map(function (k) { var g = x.got[k]; return '<tr><td style="padding:3px 8px">' + esc(DUNG[k]) + '</td><td style="padding:3px 8px;color:' + (g ? '#4ade80' : '#94a3b8') + '">' + (g ? '今天已拿 ' + g + ' 點' : '今天還沒拿') + '</td></tr>'; }).join('');
    var h = '<div class="p-4 text-slate-300 leading-relaxed" id="afk-exped">'
      + '<div style="font-size:15px;font-weight:bold;color:#e7d2a7">🧭 冒險者遠征</div>'
      + '<div class="mt-1">目前位階：<b style="color:' + (cur.c || '#94a3b8') + '">' + cur.n + '</b>　遠征點數：<b class="text-amber-200">' + x.pts + '</b></div>'
      + '<div class="text-xs text-slate-400 mt-1">四龍副本、哈汀的時空、闇龍的低語的最後頭目：每個副本每天第一次 10 點，席琳夢域鏡 ×1.5' + (x.rank === 3 ? '；<b class="text-amber-300">升上位者這一段只有夢域鏡給點，而且 ×0.8（每個 8 點）</b>' : '') + '。</div>'
      + '<table style="margin:8px 0;font-size:13px">' + rows + '</table>';
    if (next) h += '<div style="margin:8px 0;padding:10px;border:1px solid #6b4e36;border-radius:6px">下一階：<b style="color:' + next.c + '">' + next.n + '</b>（' + next.cost + ' 點' + (x.rank === 0 ? '，要 S 級冒險者並換完三件 S 級遺物' : '') + '）→ 獎勵 ' + esc(DB.items[next.stone].n)
      + '<div class="text-xs text-slate-400 mt-1">' + esc(DB.items[next.stone].d) + '</div>'
      + '<div class="mt-2"><button class="btn ' + (w ? 'bg-slate-700 opacity-60' : 'bg-amber-800 hover:bg-amber-700') + ' py-1.5 px-3 font-bold" data-afk-ex="up"' + (w ? ' disabled' : '') + '>升階</button>' + (w ? ' <span class="text-xs text-red-300">' + esc(w) + '</span>' : '') + '</div></div>';
    else h += '<div class="text-emerald-400">已經是最高位階（上位者）。</div>';
    h += '<div class="text-xs text-slate-400">遠征徽記裝在裝備視窗第二頁的「遠征徽記」欄位（轉生後才開放），一次只能裝一顆；每顆只對自己那一場女神有效。</div></div>';
    div.innerHTML = h;
    var b = div.querySelector('[data-afk-ex="up"]'); if (b) b.onclick = function () { promote(); render(div); };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) render(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-expedition]', e); }
      return r;
    };
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { debuffTick(); } catch (e) {} return r; };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  W.__afkExpedition = { RANKS: RANKS, DUNG: DUNG, BASE: BASE, DREAM_X: DREAM_X, DMG: DMG, SLOTS: SLOTS, slotOn: slotOn, store: store, award: award, whyNot: whyNot, promote: promote, stoneOf: stoneOf, stoneActive: stoneActive, fightNow: fightNow, render: render, NPC_ID: NPC_ID };
})();
