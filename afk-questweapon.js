/* ============================================================================
 * afk-questweapon.js — 新手任務與任務武器（玩家 2026-11-02 01:02；外掛開關 questweapon，預設開；經典模式不開放）
 *
 *   說話之島的「新手指導員 莉娜」：
 *   一、新手任務（Lv15 以下才能接、Lv10 以內就做得完）：接下後打倒 30 隻怪物（哪裡的都可以）→ 交回給
 *       「見習的○○」（照職業，可以用到 Lv40）＋7，不能強化，每個角色只能拿一把。
 *   二、任務武器（每個角色只能拿一把）：「試煉的○○」（照職業，可以用到 Lv60）＋7，不能強化。
 *       完成 30 級職業試煉後在莉娜這裡領，或用 5 枚狩獵徽章（冒險者公會）在這裡換。
 *   兩把都是「等級超過就不能裝備」：Lv41／Lv61 以上裝不上去，已經裝著的會自動卸下。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'questweapon', name: '新手任務與任務武器（說話之島 莉娜）', group: '遊戲內容', seal: true,
    desc: '說話之島的新手指導員：Lv15 以下接新手任務，交回 Lv40 以下用的 +7 職業武器；完成 30 級職業試煉或用 5 枚狩獵徽章換 Lv60 以下用的 +7 職業武器；都不能強化、每個角色各一把' });
  if (T && !T.enabled('questweapon')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var NPC_ID = 'npc_afk_novice', NPC_N = '新手指導員 莉娜', TOWN = 'town_talking';
  var KILLS = 30, ACCEPT_MAX = 15, EN = 7, BADGE_COST = 5;
  var CLS_N = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', warrior: '戰士', dragon: '龍騎士' };
  // [來源武器, 名稱後綴, Lv40 加成, Lv60 加成]
  var BASE = {
    royal: ['wpn_longsword', '長劍'], knight: ['wpn_2hsword', '雙手劍'], mage: ['wpn_crystalwand', '魔杖'], elf: ['wpn_elfbow', '弓'],
    dark: ['wpn_dual_silver', '雙刀'], illusion: ['wpn_illu_wand', '魔杖'], warrior: ['wpn_warrior_trial_axe', '戰斧'], dragon: ['wpn_dragon_2h', '雙手劍']
  };
  var TIER = {
    40: { pre: '見習的', st: { hit: 2, dmgBonus: 2 }, cast: { mdmg: 2, magicHit: 2 }, c: 'text-emerald-300' },
    60: { pre: '試煉的', st: { hit: 4, dmgBonus: 4 }, cast: { mdmg: 4, magicHit: 3 }, c: 'text-sky-300' }
  };
  var idOf = function (cap, cls) { return 'afk_qw' + cap + '_' + cls; };
  var mk = function (cap, cls) {
    var b = BASE[cls], s = b && DB.items[b[0]], id = idOf(cap, cls); if (!s || DB.items[id]) return;
    var t = TIER[cap], d = JSON.parse(JSON.stringify(s));
    // Renaming a quest reward must keep its source weapon icon.
    d.img = typeof getIconUrl === 'function' ? getIconUrl(s) : s.img;
    ['legend', 'relic', 'procSkill', 'procRate', 'procRateBase', 'procRatePerEn', 'spellProc', 'gachaWeight', 'set'].forEach(function (k) { delete d[k]; });
    Object.assign(d, { n: t.pre + b[1], req: cls, safe: 0, p: 1000, gachaWeight: 0, noTrade: true, noEnhance: true, ttmiMaxLevel: cap, afkQuestWpn: cap, c: t.c,
      d: CLS_N[cls] + '專用。' + (cap === 40 ? '說話之島新手任務的獎勵' : '完成 30 級職業試煉（或用狩獵徽章換）的獎勵') + '，拿到時就是 +' + EN + '，不能強化；Lv' + cap + ' 以下才能裝備（等級超過會自動卸下）。每個角色只能拿一把。' });
    Object.keys(t.st).forEach(function (k) { d[k] = (Number(d[k]) || 0) + t.st[k]; });
    if (cls === 'mage' || cls === 'illusion') Object.keys(t.cast).forEach(function (k) { d[k] = (Number(d[k]) || 0) + t.cast[k]; });
    DB.items[id] = d;
    try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[b[0]] && !WEAPON_TAGS[id]) WEAPON_TAGS[id] = WEAPON_TAGS[b[0]].slice ? WEAPON_TAGS[b[0]].slice() : WEAPON_TAGS[b[0]]; } catch (e) {}
  };
  Object.keys(BASE).forEach(function (c) { mk(40, c); mk(60, c); });

  var store = function (p) { p = p || P(); if (!p) return null; if (!p.afkNovQ || typeof p.afkNovQ !== 'object') p.afkNovQ = { st: 0, kills: 0, w40: false, w60: false }; return p.afkNovQ; };
  var trial30 = function (p) { var k = p.cls + '30'; return !!(p.trialQ && p.trialQ[k] === 2); };
  var give = function (p, cap) {
    var id = idOf(cap, p.cls); if (!DB.items[id]) return false;
    var it = gainItem(id, 1, true, true); var got = (p.inv || []).filter(function (x) { return x && x.id === id; }).pop();
    if (got) got.en = EN;
    return !!(it || got);
  };
  var accept = function () {
    var p = P(), q = store(p); if (!p || p.classicMode) return false;
    if (q.st) return false;
    if ((p.lv || 1) > ACCEPT_MAX) { sys('<span class="text-amber-300">' + NPC_N + '：這是給剛出發的冒險者的任務，Lv' + ACCEPT_MAX + ' 以下才能接。</span>'); return false; }
    q.st = 1; q.kills = 0; sys('<span class="text-amber-300 font-bold">' + NPC_N + '：</span>去外面打倒 ' + KILLS + ' 隻怪物，再回來找我。'); try { saveGame(); } catch (e) {} return true;
  };
  var complete = function () {
    var p = P(), q = store(p); if (!p || q.st !== 1 || q.kills < KILLS) return false;
    if (!give(p, 40)) return false;
    q.st = 2; q.w40 = true;
    sys('<span class="c-legend font-bold">' + NPC_N + '：新手任務完成！</span><span class="text-amber-200">你獲得了 ' + esc(DB.items[idOf(40, p.cls)].n) + ' +' + EN + '。</span>');
    try { saveGame(); renderTabs(); } catch (e) {} return true;
  };
  var claim60 = function (how) {
    var p = P(), q = store(p); if (!p || p.classicMode || q.w60) return false;
    if (how === 'trial') { if (!trial30(p)) { sys('還沒有完成 30 級職業試煉。'); return false; } }
    else {
      var H = W.__afkHunter, h = H && H.store ? H.store(p) : null;
      if (!h || (h.badges || 0) < BADGE_COST) { sys('<span class="text-amber-300">狩獵徽章不夠（要 ' + BADGE_COST + ' 枚）。</span>'); return false; }
      h.badges -= BADGE_COST;
    }
    if (!give(p, 60)) return false;
    q.w60 = true;
    sys('<span class="c-legend font-bold">' + NPC_N + '：</span><span class="text-amber-200">你獲得了 ' + esc(DB.items[idOf(60, p.cls)].n) + ' +' + EN + '。</span>');
    try { saveGame(); renderTabs(); } catch (e) {} return true;
  };
  // 30 級職業試煉交付時直接發（還沒拿過的話）
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var p = P(), before = p && p.trialQ ? p.trialQ[key] : 0, r = oDone.apply(this, arguments);
      try { var c = typeof TRIAL_Q !== 'undefined' && TRIAL_Q[key]; if (p && c && c.lv === 30 && !c.afkSaga && before === 1 && p.trialQ[key] === 2 && !p.classicMode && !store(p).w60) claim60('trial'); } catch (e) {}
      return r;
    };
    try { (0, eval)('trialQComplete = window.trialQComplete'); } catch (e) {}
  }
  // 擊殺計數
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState && mapState.mobs ? mapState.mobs[idx] : null, was = m && !m._dead, r = oKill.apply(this, arguments);
      try { var p = P(), q = p && p.afkNovQ; if (q && q.st === 1 && was && m._dead && m.race !== '建築' && q.kills < KILLS) { q.kills++; if (q.kills === KILLS) sys('<span class="text-emerald-300">新手任務：已經打倒 ' + KILLS + ' 隻怪物，回說話之島找' + NPC_N + '。</span>'); } } catch (e) {}
      return r;
    };
  }
  // 等級超過：不能裝、裝著的卸下
  var tooHigh = function (p, d) { return !!(d && d.afkQuestWpn && (p.lv || 1) > d.afkQuestWpn); };
  if (typeof W.equipItem === 'function') {
    var oEq = W.equipItem;
    W.equipItem = function (item) {
      var p = P(), d = item && DB.items[item.id];
      if (p && tooHigh(p, d)) { sys('<span class="text-amber-300">「' + esc(d.n) + '」限 Lv' + d.afkQuestWpn + ' 以下才能裝備。</span>'); return; }
      return oEq.apply(this, arguments);
    };
    try { (0, eval)('equipItem = window.equipItem'); } catch (e) {}
  }
  var lastCheck = 0;
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var t = (typeof state !== 'undefined' && state.ticks) || 0; if (t - lastCheck < 50 && t >= lastCheck) return r; lastCheck = t;
        var p = P(); if (!p || !p.eq) return r;
        ['wpn', 'offwpn'].forEach(function (k) { var e = p.eq[k], d = e && DB.items[e.id]; if (tooHigh(p, d) && typeof unequipItem === 'function') { unequipItem(k); sys('<span class="text-amber-300">等級超過 Lv' + d.afkQuestWpn + '，「' + esc(d.n) + '」已經卸下。</span>'); } });
      } catch (e) {}
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // NPC
  try {
    var L = W.__afkLore;
    var def = { id: NPC_ID, n: NPC_N, title: '新手任務', type: 'quest', classicHide: true, d: '在說話之島照顧剛出發的冒險者。發新手任務，也替完成職業試煉的人準備任務武器。' };
    if (L && L.addNpc) L.addNpc(TOWN, def, null, null); else if (DB.towns[TOWN]) DB.towns[TOWN].npcs.push(def);
  } catch (e) {}
  var render = function (div) {
    var p = P(); if (!p || !div) return;
    var q = store(p), w40 = DB.items[idOf(40, p.cls)], w60 = DB.items[idOf(60, p.cls)], H = W.__afkHunter, badges = H && H.store ? (H.store(p).badges || 0) : 0;
    var box = function (title, body) { return '<div style="margin:10px 0;padding:10px 12px;border:1px solid #6b4e36;border-radius:6px;background:rgba(40,39,48,.6)"><div style="font-weight:bold;color:#e7d2a7;margin-bottom:6px">' + title + '</div>' + body + '</div>'; };
    var btn = function (act, label, ok) { return '<button class="btn ' + (ok ? 'bg-amber-800 hover:bg-amber-700' : 'bg-slate-700 opacity-60') + ' py-1.5 px-3 font-bold" data-afk-nq="' + act + '"' + (ok ? '' : ' disabled') + '>' + label + '</button>'; };
    if (p.classicMode) { div.innerHTML = '<div class="p-4 text-slate-300">' + NPC_N + '：經典模式不開放。</div>'; return; }
    var h = '<div class="p-4 text-slate-300 leading-relaxed" id="afk-novq">';
    var s1 = '獎勵：<b class="text-emerald-300">' + esc(w40 ? w40.n : '') + ' +' + EN + '</b>（Lv40 以下用、不能強化）。';
    if (q.st === 2) s1 += '<div class="text-emerald-400 mt-1">✅ 已完成。</div>';
    else if (q.st === 1) s1 += '<div class="mt-1">打倒怪物：<b class="' + (q.kills >= KILLS ? 'text-emerald-300' : 'text-amber-200') + '">' + q.kills + '／' + KILLS + '</b></div><div class="mt-2">' + btn('done', '交回任務', q.kills >= KILLS) + '</div>';
    else s1 += '<div class="mt-1">打倒 ' + KILLS + ' 隻怪物（哪裡的都可以）。Lv' + ACCEPT_MAX + ' 以下才能接。</div><div class="mt-2">' + btn('accept', '接下新手任務', (p.lv || 1) <= ACCEPT_MAX) + '</div>';
    h += box('🌱 新手任務', s1);
    var s2 = '獎勵：<b class="text-sky-300">' + esc(w60 ? w60.n : '') + ' +' + EN + '</b>（Lv60 以下用、不能強化），每個角色只能拿一把。';
    if (q.w60) s2 += '<div class="text-emerald-400 mt-1">✅ 已經領過。</div>';
    else s2 += '<div class="mt-2" style="display:flex;gap:8px;flex-wrap:wrap">' + btn('trial', '完成 30 級職業試煉的獎勵', trial30(p)) + btn('badge', '用 ' + BADGE_COST + ' 枚狩獵徽章換（有 ' + badges + ' 枚）', badges >= BADGE_COST) + '</div>';
    h += box('⚔️ 任務武器', s2) + '</div>';
    div.innerHTML = h;
    div.querySelectorAll('[data-afk-nq]').forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-afk-nq'); if (a === 'accept') accept(); else if (a === 'done') complete(); else claim60(a); render(div); }; });
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) render(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-questweapon]', e); }
      return r;
    };
  }
  W.__afkQuestWeapon = { NPC_ID: NPC_ID, KILLS: KILLS, ACCEPT_MAX: ACCEPT_MAX, EN: EN, BADGE_COST: BADGE_COST, idOf: idOf, store: store, accept: accept, complete: complete, claim60: claim60, render: render };
})();
