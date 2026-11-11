/* ============================================================================
 * afk-soulstone.js — 靈魂石系統（玩家 2026-11-01 18:23；外掛開關 soulstone，預設開）
 *
 *   參照《天堂：戰與和》的靈魂石：用某隻頭目的靈魂石，就能在訓練所裡單獨叫出那一隻頭目來打。
 *   一、NPC：席琳神殿的「扎爾」（外型借惡魔，縮小到 65%）。看自己的靈魂石、召喚、製作都在這裡；靈魂石也可以直接從背包使用。
 *   二、靈魂石：每一隻頭目各一種。範圍（11-02 01:02 再改：只剩原作名單＋謀叛者的低語＋六隻指定的副本頭目，見 ALLOW；19:16 版）：遊戲原本就有的頭目＋支配者傲慢之塔、謀叛者的低語、哈汀的時空；
 *       四龍（含四龍副本、侵蝕的安塔瑞斯巢穴）、世界事件、地區霸主、其他外掛新增的頭目沒有。先前發出去的停用靈魂石讀檔時換成隨機的。
 *       使用＝進入「靈魂石訓練所」，自己一個人（傭兵留在外面，打完或離開時回到隊伍）挑戰那一隻頭目。
 *       頭目的能力、掉落物跟原本一樣（照頭目名字的掉落表）；訓練所裡不再掉靈魂石。打倒後 3 秒回到原本的地方。
 *       倒下、或自己換地圖＝這次挑戰結束（靈魂石已經用掉）。讀檔時還在訓練所裡的話，回到席琳神殿、傭兵歸隊。
 *   三、取得：
 *       ‧Lv60 以上的一般怪物（野外、地監、傲慢之塔；攻城、時空裂痕、暗夢星迴不算）：每隻 0.02% 掉一顆隨機靈魂石、2% 掉 1 個靈魂石碎片
 *       ‧頭目（訓練所以外）：每隻 5% 掉一顆隨機靈魂石
 *       ‧扎爾製作：靈魂石碎片 ×150 → 隨機靈魂石 ×1；失去光芒的傳說裝備 ×10（哪一種都可以）→ 隨機靈魂石 ×1
 *         （19:16：每件傳說裝備都有「失去光芒的」版本，怪物掉落表有那件傳說裝備就另外照它的機率 ×5、最多 20% 掉）
 *       隨機靈魂石＝所有頭目平均抽一種。
 *   經典模式：扎爾不出現、不掉落、不能使用。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'soulstone', name: '靈魂石系統（扎爾）', group: '遊戲內容', seal: true,
    desc: '席琳神殿的扎爾：每隻頭目各有一種靈魂石，使用後在訓練所單獨挑戰那隻頭目（掉落物相同）；Lv60 以上怪物、頭目會掉靈魂石與碎片，碎片 150 個或失去光芒的傳說裝備 10 件可做一顆隨機靈魂石' });
  var on = function () { return !T || T.enabled('soulstone'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var ok = function () { var p = P(); return !!(p && on() && !p.classicMode); };

  var PREFIX = 'afk_soul_', SHARD = 'mat_soulstone_shard', ROOM = 'afk_soul_room', ROOM_N = '靈魂石訓練所', HOME = 'town_sherine';
  var NPC_ID = 'npc_afk_zal', NPC_N = '扎爾';
  var RATE = { stone: 0.0002, shard: 0.02, boss: 0.05, minLv: 60 }, COST = { shard: 150, legend: 10 }, BACK_MS = 3000;
  var ICON = 'assets/icons/items/靈魂之球.png';

  // ── 一、靈魂石 ──
  //   範圍（玩家 2026-11-01 19:16）：遊戲原本就有的頭目（野外王、軍王、傲慢之塔、冰之女王、底比斯、提卡爾、日出之國…）
  //   ＋支配者傲慢之塔、傲慢之塔的反王肯恩／賽尼斯、謀叛者的低語、哈汀的時空。
  //   不要：四龍（含四龍副本與侵蝕的安塔瑞斯巢穴）、世界事件、地區霸主、透視鏡匯入的其他頭目、其他外掛新增的頭目；攻城物件、樓梯、傳送門。
  var EXCL = { pride_stairs: 1, obli_portal: 1 };
  var DRAGON = /^(antaras|fafurion|valakas|lindvior)$|^cr_(fafurion|valakas|lindvior)_|^ant_/;
  var PLUGIN_OK = /^afk_boss_(kenrauhel|cerenis)$|^afk_traitor_|^afk_hd_/;
  var bossLike = function (id) {
    var m = DB.mobs[id];
    return !!(m && m.boss && (m.lv || 0) > 1 && m.n && !m.siegeEnemy && !m.noAttack && !m.pledgeEnemy && m.race !== '血盟' && !/^siege_/.test(id) && !EXCL[id]);
  };
  // 玩家 2026-11-02 01:02：只剩這些（天堂原作的靈魂石名單＋謀叛者的低語＋指定的副本頭目）
  //   黑騎士隊長、死亡騎士、哈汀之影、黑魔法師、惡魔、墮落、長老（琪娜、艾迪爾、巴塔斯、巴洛斯、泰瑪斯、安迪斯、拉曼斯、巴陸德）、
  //   四軍王（海露拜、蕾雅、巴蘭卡、史雷佛）、謀叛者的低語（反王肯恩、魔女賽尼斯、冥皇丹特斯）、
  //   大魔法師歐林、黑翼賽尼斯、失控的巴風特、大魔法師哈汀、火焰之影（真身）、闇龍哈爾巴斯。原作名單裡的「魔法師」本作沒有這隻頭目。
  var ALLOW = ['afk_ttmi_43', 'dk', 'iv_hatin', 'iv_blackmage', 'nm_034', 'fallen_boss',
    'de_elder_kina', 'de_elder_adiel', 'de_elder_batas', 'de_elder_balos', 'de_elder_taimas', 'de_elder_andis', 'de_elder_ramas', 'de_elder_balud',
    'de_king_heruby', 'de_king_laia', 'de_king_baranka', 'de_king_slayer',
    'afk_traitor_ken', 'afk_traitor_senis', 'afk_traitor_dantes',
    'afk_hd_orin', 'afk_hd_senis', 'afk_hd_baph', 'afk_hd_hardin', 'afk_hp_flame', 'afk_hp_halpas'];
  var eligible = function (id) { return ALLOW.indexOf(id) >= 0 && !!DB.mobs[id]; };
  var BOSSES = [];
  var mkStone = function (id, legacy) {
    var m = DB.mobs[id], sid = PREFIX + id; if (DB.items[sid]) return;
    DB.items[sid] = { n: '靈魂石：' + m.n, type: 'etc', eff: 'afk_soulstone', soulBoss: id, req: 'all', p: 500, gachaWeight: 0, noJunk: true,
      c: 'text-fuchsia-300', img: ICON, soulLegacy: !!legacy,
      d: legacy ? '這顆靈魂石已經停用。讀檔時扎爾會把它換成一顆隨機的靈魂石。'
        : '封著「' + m.n + '」（Lv' + m.lv + '）魂魄的石頭。使用後進入靈魂石訓練所，自己一個人（傭兵留在外面）挑戰這隻頭目；頭目的能力與掉落物跟原本相同。' };
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[DB.items[sid].n] == null) ITEM_WEIGHTS[DB.items[sid].n] = 5; } catch (e) {}
  };
  var build = function () {
    Object.keys(DB.mobs).forEach(function (id) {
      if (!bossLike(id) && !eligible(id)) return;
      if (eligible(id)) { if (DB.items[PREFIX + id] && DB.items[PREFIX + id].soulLegacy) delete DB.items[PREFIX + id]; mkStone(id, false); if (BOSSES.indexOf(id) < 0) BOSSES.push(id); }
      else mkStone(id, true);   // 11-01 18:23 版本發出去的靈魂石（已停用的頭目）：保留道具資料，讀檔時換掉
    });
    BOSSES.sort(function (a, b) { return ((DB.mobs[a].lv || 0) - (DB.mobs[b].lv || 0)) || String(DB.mobs[a].n).localeCompare(String(DB.mobs[b].n), 'zh-Hant'); });
  };
  build();
  W.addEventListener('load', build);
  try { if (DB.items[SHARD]) DB.items[SHARD].d = '製作材料。席琳神殿的扎爾收 150 個，換一顆隨機的靈魂石。'; } catch (e) {}
  var isStone = function (id) { var d = id && DB.items[id]; return !!(d && d.eff === 'afk_soulstone' && d.soulBoss && !d.soulLegacy); };
  var isLegacy = function (id) { var d = id && DB.items[id]; return !!(d && d.eff === 'afk_soulstone' && d.soulLegacy); };
  var randomStone = function () { return PREFIX + BOSSES[Math.floor(Math.random() * BOSSES.length)]; };

  // ── 背包小工具 ──
  var countOf = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id ? Math.max(1, Number(i.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (!p || countOf(id) < n) return false;
    for (var i = p.inv.length - 1; i >= 0 && n > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id) continue;
      var c = Math.max(1, Number(it.cnt) || 1), u = Math.min(c, n);
      if (c > u) it.cnt = c - u; else p.inv.splice(i, 1);
      n -= u;
    }
    return true;
  };
  var give = function (id, n) { try { gainItem(id, n || 1, true, true); } catch (e) {} };
  var stoneLine = function (id, how) { var d = DB.items[id]; return '<span class="font-bold" style="color:#e879f9">' + esc(d ? d.n : id) + '</span>' + (how ? '（' + how + '）' : ''); };

  // ── 二、訓練所 ──
  DB.maps[ROOM] = [];
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([ROOM]); } catch (e) {}
  try { SPECIAL_AREA_BG[ROOM] = 'assets/area/1920x1080/新兵修練場.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[ROOM]) MAP_DESC[ROOM] = '扎爾用靈魂石叫出頭目的訓練所。只容得下你一個人。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[ROOM] = ROOM_N; } catch (e) {}
  var run = null;   // { boss, from, uid, done }
  var inRoom = function () { return typeof mapState !== 'undefined' && mapState && mapState.current === ROOM; };
  var busy = function () {
    var s = S(), p = P(), cur = (typeof mapState !== 'undefined' && mapState) ? mapState.current || '' : '';
    if (!p) return '請先進入遊戲。';
    if (p.classicMode) return '經典模式不能使用靈魂石。';
    if (!on()) return '靈魂石系統已關閉（外掛開關）。';
    if (p.dead) return '倒下的狀態不能使用。';
    if (cur === ROOM) return '已經在訓練所裡了。';
    if (s.riftRun || s.dreamStar || s.prideClimb || s.oblivion || s.antharas || s._afkFinal || s.pvpDuel) return '正在進行副本或挑戰，先結束再使用。';
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(cur)) return '攻城中不能使用。'; } catch (e) {}
    try { if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[cur]) return '軍王之室裡不能使用。'; } catch (e) {}
    try { if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(cur) >= 0) return '頭目房裡不能使用。'; } catch (e) {}
    try { var C = W.AFK_CARD_COMBAT; if (C && C.inDungeon && C.inDungeon()) return '副本裡不能使用。'; } catch (e) {}
    if (/^(afk_traitor_whisper|afk_hardin_time|afk_giltas_altar|afk_flame_depth|afk_halpas_nest|afk_final_sea|rift_battle)$/.test(cur)) return '副本裡不能使用。';
    var ps = p.statuses || {};
    if (ps.stone > 0 || ps.paralyze > 0 || ps.freeze > 0 || ps.stun > 0 || ps.sleep > 0) return '目前無法行動。';
    return null;
  };
  var bench = function () { var p = P(); if (!p || p._afkSoulBench) return; p._afkSoulBench = (p.allies || []).slice(); p.allies = []; };
  var unbench = function (quiet) {
    var p = P(); if (!p || !p._afkSoulBench) return false;
    var back = p._afkSoulBench; delete p._afkSoulBench;
    p.allies = back.concat((p.allies || []).filter(function (a) { return back.indexOf(a) < 0; }));
    try { recomputeStats(); } catch (e) {}
    if (!quiet && back.length) sys('<span class="text-sky-300">傭兵回到了隊伍（' + back.length + ' 人）。</span>');
    return true;
  };
  var place = function (id) {
    var base = DB.mobs[id], B = W.__afkLore && W.__afkLore.boss;
    var m;
    if (B && B.place) m = B.place(1, base, { mobId: id, _afkSoul: true });
    else {
      m = Object.assign(JSON.parse(JSON.stringify(base)), { mobId: id, _afkSoul: true });
      mapState.mobs[1] = Object.assign(m, { curHp: m.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
      try { if (typeof applySherineBuff === 'function') applySherineBuff(1); } catch (e) {}
      m = mapState.mobs[1]; try { if (m.hard && typeof initHardSkin === 'function') initHardSkin(m); } catch (e) {}
    }
    return m;
  };
  var showBattle = function () {
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
  };
  // 連續挑戰（玩家 2026-11-02 19:23）：打倒後自動用下一顆同一個王的靈魂石，直到用完；扎爾那裡可以關掉
  var chainOn = function () { var p = P(); return !p || p.afkSoulChain !== false; };
  var enter = function (bossId) {
    var p = P(), why = busy(); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    var sid = PREFIX + bossId; if (!DB.mobs[bossId] || !take(sid, 1)) { sys('<span class="text-amber-300">背包裡沒有這顆靈魂石。</span>'); return false; }
    try { if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(ROOM)) { give(sid, 1); return false; } } catch (e) {}
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    var from = mapState.current || HOME;
    bench();
    mapState.current = ROOM;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    var m = place(bossId);
    run = { boss: bossId, from: from, uid: m && m.uid, done: false, t0: tk() };
    p._afkSoulRun = { boss: bossId, from: from };
    p.afkSoulStats = p.afkSoulStats || { used: 0, won: 0 }; p.afkSoulStats.used++;
    sys('<span class="font-bold" style="color:#e879f9">靈魂石碎成了紫色的煙。煙散去的時候，' + esc(DB.mobs[bossId].n) + '（Lv' + DB.mobs[bossId].lv + '）就站在你面前——這裡只有你們兩個。</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
    showBattle();
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { if (m && typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
    try { recomputeStats(); renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    return true;
  };
  var leave = function (to) {
    var p = P(); run = null; if (p) delete p._afkSoulRun;
    unbench();
    try { setMapSelectors(to && to !== ROOM ? to : HOME); changeMap(true); } catch (e) { try { setMapSelectors(HOME); changeMap(true); } catch (e2) {} }
    try { saveGame(); } catch (e) {}
  };
  var bossAlive = function () { return (mapState.mobs || []).some(function (m) { return m && m._afkSoul && !m._dead && m.curHp > 0; }); };
  var step = function () {
    var p = P(); if (!p) return;
    if (!inRoom()) {   // 離開訓練所（倒下回村、自己換地圖）：傭兵歸隊
      if (p._afkSoulBench || p._afkSoulRun) { run = null; delete p._afkSoulRun; unbench(); }
      return;
    }
    if (!run) { run = { boss: p._afkSoulRun && p._afkSoulRun.boss, from: (p._afkSoulRun && p._afkSoulRun.from) || HOME, done: false, t0: tk() }; }
    if (run.done || bossAlive()) return;
    run.done = true;
    p.afkSoulStats = p.afkSoulStats || { used: 0, won: 0 }; p.afkSoulStats.won++;
    var sid = PREFIX + run.boss, left = run.boss ? countOf(sid) : 0, r0 = run;
    if (chainOn() && left > 0 && DB.mobs[run.boss]) {
      sys('<span class="text-yellow-300 font-bold">🏆 ' + esc(DB.mobs[run.boss].n) + ' 的魂魄散成了紫色的煙。</span>還有 ' + left + ' 顆它的靈魂石——3 秒後再叫出來。');
      setTimeout(function () {
        try {
          if (!inRoom() || run !== r0 || P().dead) return;
          if (!take(sid, 1)) { leave(r0.from); return; }
          mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null]; mapState.targetIdx = -1;
          var m = place(r0.boss); r0.uid = m && m.uid; r0.done = false;
          var q = P(); q.afkSoulStats = q.afkSoulStats || { used: 0, won: 0 }; q.afkSoulStats.used++;
          sys('<span class="font-bold" style="color:#e879f9">又一顆靈魂石碎成紫煙——' + esc(DB.mobs[r0.boss].n) + '再次站在你面前。（還剩 ' + countOf(sid) + ' 顆）</span>');
          try { if (m && typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
          try { renderMobs(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
        } catch (e) { console.warn('[AFK-soulstone] chain', e); }
      }, BACK_MS);
      return;
    }
    sys('<span class="text-yellow-300 font-bold">🏆 ' + esc((DB.mobs[run.boss] || {}).n || '頭目') + ' 的魂魄散成了紫色的煙。3 秒後回到原本的地方。</span>');
    setTimeout(function () { try { if (inRoom() && run === r0) leave(r0.from); } catch (e) {} }, BACK_MS);
  };
  // 訓練所不自己出怪
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) { if (inRoom()) { if (mapState.mobs[idx] && mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; } return oSpawn.apply(this, arguments); };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { step(); } catch (e) { console.warn('[AFK-soulstone]', e); } return r; };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  // 讀檔：還在訓練所裡（或傭兵還沒歸隊）就結束這次挑戰
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () {
      var r = oLoad.apply(this, arguments);
      try { swapLegacy(); } catch (e) {}
      try {
        var p = P(); run = null;
        if (p && (p._afkSoulBench || p._afkSoulRun || inRoom())) {
          delete p._afkSoulRun; unbench(true);
          if (inRoom()) setTimeout(function () { try { if (inRoom()) { setMapSelectors(HOME); changeMap(true); sys('<span class="text-slate-300">訓練所的門在你離開時關上了。傭兵都回到了隊伍。</span>'); } } catch (e) {} }, 0);
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }

  // 已停用頭目的靈魂石（11-01 18:23 版本發出去的）：換成一顆隨機的靈魂石
  var swapLegacy = function () {
    var p = P(); if (!p || !p.inv) return 0;
    var n = 0;
    p.inv.slice().forEach(function (it) { if (it && isLegacy(it.id)) { var c = Math.max(1, Number(it.cnt) || 1); n += c; var i = p.inv.indexOf(it); if (i >= 0) p.inv.splice(i, 1); } });
    if (!n) return 0;
    var got = []; for (var k = 0; k < n; k++) { var sid = randomStone(); give(sid, 1); got.push(sid); }
    sys('<span class="text-fuchsia-300">扎爾：「有些頭目的魂魄我已經不收了。」——' + n + ' 顆停用的靈魂石換成了 ' + got.map(function (x) { return stoneLine(x); }).join('、') + '。</span>');
    return n;
  };

  // 背包使用
  var ask = function (it) {
    var d = DB.items[it.id], bid = d.soulBoss, m = DB.mobs[bid];
    var why = busy(); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; }
    var p = P(), nAl = (p.allies || []).length;
    var msg = '使用「' + d.n + '」？\n\n進入靈魂石訓練所，自己一個人挑戰 ' + m.n + '（Lv' + m.lv + '，HP ' + Number(m.hp || 0).toLocaleString() + '）。'
      + (nAl ? '\n傭兵 ' + nAl + ' 人留在外面，打完或離開時回到隊伍。' : '') + '\n頭目的能力與掉落物跟原本相同；倒下或離開＝這次挑戰結束（靈魂石會用掉）。'
      + (chainOn() && countOf(it.id) > 1 ? '\n\n你有 ' + countOf(it.id) + ' 顆：打倒後會自動用下一顆再打，直到用完（在扎爾那裡可以改成一次一顆）。' : '');
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '靈魂石', message: msg, align: 'left', okText: '進入訓練所', cancelText: '取消', onOk: function () { enter(bid); } });
    else if (W.confirm(msg)) enter(bid);
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      var p = P(), it = p && (p.inv || []).find(function (i) { return i && i.uid === u; });
      if (!it || !isStone(it.id)) return oUse.apply(this, arguments);
      if (arguments[1]) return;   // 自動使用（silent）一律不碰靈魂石
      try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
      ask(it);
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }

  // ── 三、掉落 ──
  var BAD_CAT = { siege: 1, castle: 1, rift: 1 };
  var roll = function (m) {
    var p = P(); if (!m || !ok() || inRoom() || m._afkSoul || m._afkSoulRolled) return;
    m._afkSoulRolled = true;
    var cur = mapState.current || '', s = S();
    if (/^town_/.test(cur) || s.riftRun || s.dreamStar) return;
    var cat = 'wild'; try { if (typeof mapCategoryOf === 'function') cat = mapCategoryOf(cur); } catch (e) {}
    if (m.boss) {
      if (BAD_CAT[cat] || m.siegeEnemy || m.noAttack || m.race === '建築') return;   // 2026-11-03：傲慢之塔的「往上層的樓梯」、遺忘之島傳送門算頭目，每層 5% 送靈魂石
      if (Math.random() < RATE.boss) { var sid = randomStone(); give(sid, 1); sys(esc(m.n) + ' 的身上掉出了 ' + stoneLine(sid) + '！'); }
      return;
    }
    if ((m.lv || 0) < RATE.minLv || BAD_CAT[cat] || m.race === '血盟' || m.trollPlayer) return;
    if (Math.random() < RATE.stone) { var sid2 = randomStone(); give(sid2, 1); sys(esc(m.n) + ' 的身上掉出了 ' + stoneLine(sid2) + '！'); }
    if (Math.random() < RATE.shard) give(SHARD, 1);
  };
  // 失去光芒的傳說裝備：每件傳說裝備（遺物除外）各有一個「失去光芒的」版本，只能拿去給扎爾做靈魂石。
  //   掉落：怪物的掉落表裡有那件傳說裝備，就另外照「傳說裝備機率 ×5（最多 20%）」掉它失去光芒的版本（各自判定）。
  var DULL = 'afk_dull_', DULL_K = 5, DULL_CAP = 20;
  var isLegendGear = function (d) { return !!(d && d.legend && !d.relic && ['wpn', 'arm', 'acc'].indexOf(d.type) >= 0); };
  var isDull = function (id) { var d = id && DB.items[id]; return !!(d && d.afkDullOf); };
  var dullSrc = null;   // 怪物名字 → [[失去光芒的 id, 機率%]]
  var buildDull = function () {
    Object.keys(DB.items).forEach(function (id) {
      var d = DB.items[id]; if (!isLegendGear(d) || DB.items[DULL + id]) return;
      var img = d.img; try { if (!img && typeof getIconUrl === 'function') img = getIconUrl(d); } catch (e) {}
      DB.items[DULL + id] = { n: '失去光芒的' + d.n, type: 'etc', req: 'all', p: 100, gachaWeight: 0, noUse: true, afkDullOf: id, c: 'text-slate-400', img: img || ICON,
        d: '光芒褪盡的「' + d.n + '」，已經不能裝備。席琳神殿的扎爾收 ' + COST.legend + ' 件（哪一種都可以），換一顆隨機的靈魂石。' };
      try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[DB.items[DULL + id].n] == null) ITEM_WEIGHTS[DB.items[DULL + id].n] = 1; } catch (e) {}
    });
    dullSrc = {};
    try {
      Object.keys(MOB_DROPS).forEach(function (n) {
        (MOB_DROPS[n] || []).forEach(function (e) {
          var id = Array.isArray(e) ? e[0] : null, pct = Array.isArray(e) ? Number(e[1]) || 0 : 0;
          if (!id || !isLegendGear(DB.items[id]) || !(pct > 0) || !DB.items[DULL + id]) return;
          (dullSrc[n] = dullSrc[n] || []).push([DULL + id, Math.min(DULL_CAP, pct * DULL_K)]);
        });
      });
    } catch (e) {}
  };
  buildDull();
  W.addEventListener('load', buildDull);
  var rollDull = function (m) {
    if (!m || !ok() || m._afkDullRolled) return;
    m._afkDullRolled = true;
    var list = dullSrc && dullSrc[m.n]; if (!list) return;
    list.forEach(function (x) {
      if (Math.random() * 100 < x[1]) { give(x[0], 1); sys(esc(m.n) + ' 的身上掉出了 <span class="text-slate-300 font-bold">' + esc(DB.items[x[0]].n) + '</span>。'); }
    });
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try { if (m && (m._dead || !(m.curHp > 0) || mapState.mobs[idx] !== m)) { roll(m); rollDull(m); } } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }

  // ── 四、製作 ──
  var dullList = function () { var p = P(); return p ? (p.inv || []).filter(function (it) { return it && isDull(it.id); }) : []; };
  var dullCount = function () { return dullList().reduce(function (t, it) { return t + Math.max(1, Number(it.cnt) || 1); }, 0); };
  var craftShard = function (n) {
    n = Math.max(1, Math.floor(n || 1));
    if (!ok()) return 0;
    var made = [];
    for (var i = 0; i < n; i++) { if (!take(SHARD, COST.shard)) break; var sid = randomStone(); give(sid, 1); made.push(sid); }
    if (made.length) { sys('扎爾把 ' + (COST.shard * made.length) + ' 個靈魂石碎片揉成了 ' + made.map(function (x) { return stoneLine(x); }).join('、') + '。'); try { saveGame(); } catch (e) {} }
    return made.length;
  };
  // 失去光芒的傳說裝備 ×10（哪一種都可以）→ 隨機靈魂石 ×1；先用背包裡數量最多的
  var craftDull = function (n) {
    n = Math.max(1, Math.floor(n || 1));
    if (!ok()) return 0;
    var made = [];
    for (var i = 0; i < n; i++) {
      if (dullCount() < COST.legend) break;
      var need = COST.legend;
      var list = dullList().sort(function (a, b) { return (Number(b.cnt) || 1) - (Number(a.cnt) || 1); });
      for (var j = 0; j < list.length && need > 0; j++) { var c = Math.max(1, Number(list[j].cnt) || 1), u = Math.min(c, need); take(list[j].id, u); need -= u; }
      var sid = randomStone(); give(sid, 1); made.push(sid);
    }
    if (made.length) { sys('扎爾把 ' + (COST.legend * made.length) + ' 件失去光芒的傳說裝備熔成了 ' + made.map(function (x) { return stoneLine(x); }).join('、') + '。'); try { saveGame(); } catch (e) {} }
    return made.length;
  };

  // ── 五、扎爾 ──
  try { if (typeof NPC_SPR !== 'undefined') NPC_SPR.afk_zal = { g: 'afk_zal', f: 8, w: 8 }; } catch (e) {}
  if (W.__afkLore && W.__afkLore.addNpc) W.__afkLore.addNpc(HOME, { id: NPC_ID, n: NPC_N, title: '靈魂石', type: 'afk', classicHide: true,
    d: '把頭目的魂魄封進石頭裡的惡魔。拿靈魂石來，他就替你打開訓練所的門。' }, 'afk_zal', [76, 68]);   // Ping 11-12 席琳神殿重排
  var ui = { tab: 'mine' };
  var CSS_ID = 'afk-zal-css';
  var css = function () {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    st.textContent = '#afk-zal .zs-say{color:#e9d5ff;font-size:14px;line-height:1.6;margin-bottom:10px}'
      + '#afk-zal .zs-tabs{display:flex;flex-wrap:nowrap;gap:6px;margin-bottom:10px;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}#afk-zal .zs-tabs>button{flex:0 0 auto;white-space:nowrap}'
      + '#interaction-content #afk-zal button.zs-tab{padding:6px 12px;font-size:14px;font-weight:700;border-radius:6px;border:1px solid #6b21a8 !important;background:#1e1b2e !important;color:#d8b4fe !important}'
      + '#interaction-content #afk-zal button.zs-tab.on{background:linear-gradient(180deg,#7e22ce,#4c1d95) !important;border-color:#e879f9 !important;color:#fdf4ff !important}'
      + '#afk-zal .zs-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #3b2a4f;border-radius:6px;background:#15121c;margin-bottom:5px;font-size:13px;color:#e5e7eb}'
      + '#afk-zal .zs-row img{width:26px;height:26px;object-fit:contain;image-rendering:pixelated}'
      + '#afk-zal .zs-row .zs-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#afk-zal .zs-row .zs-lv{color:#94a3b8;font-size:12px;white-space:nowrap}'
      + '#interaction-content #afk-zal button.zs-go{padding:4px 10px;border-radius:5px;font-size:13px;font-weight:700;border:1px solid #c026d3 !important;background:#701a75 !important;color:#fdf4ff !important}'
      + '#interaction-content #afk-zal button.zs-go:disabled{opacity:.45;cursor:not-allowed}'
      + '#afk-zal .zs-card{border:1px solid #4c1d95;border-radius:8px;padding:10px;margin-bottom:8px;background:#120f19}'
      + '#afk-zal .zs-card b{color:#f0abfc}#afk-zal .zs-note{font-size:12px;color:#94a3b8;line-height:1.6}'
      + '#afk-zal .zs-empty{color:#94a3b8;font-size:13px;padding:8px}';
    document.head.appendChild(st);
  };
  var mine = function () {
    var p = P(), seen = {}, out = [];
    (p.inv || []).forEach(function (it) { if (!it || !isStone(it.id) || seen[it.id]) return; seen[it.id] = 1; out.push({ id: it.id, uid: it.uid, cnt: countOf(it.id), m: DB.mobs[DB.items[it.id].soulBoss] }); });
    out.sort(function (a, b) { return ((b.m && b.m.lv) || 0) - ((a.m && a.m.lv) || 0); });
    return out;
  };
  var render = function (div) {
    var p = P(); if (!div || !p) return;
    if (!ok()) { div.innerHTML = '<div class="text-sm text-slate-300">「……今天不做生意。」</div>'; return; }
    css();
    var h = '<div id="afk-zal"><div class="zs-say">「頭目死了，魂魄還會在世上徘徊。我把它們封進石頭裡——想再打一次，拿石頭來。訓練所只容得下一個人，你的傭兵就在外面等著吧。」</div>'
      + '<div class="zs-tabs"><button type="button" class="btn zs-tab' + (ui.tab === 'mine' ? ' on' : '') + '" data-zs="tab:mine">我的靈魂石</button>'
      + '<button type="button" class="btn zs-tab' + (ui.tab === 'craft' ? ' on' : '') + '" data-zs="tab:craft">製作</button>'
      + '<button type="button" class="btn zs-tab' + (ui.tab === 'info' ? ' on' : '') + '" data-zs="tab:info">說明</button>'
      + (W.LineageClassUI ? '<button type="button" class="btn zs-tab" data-zs="souls:open" aria-haspopup="dialog">角色封魂・五格魂魄</button>' : '') + '</div>';
    var why = busy();
    if (ui.tab === 'mine') h += '<div class="zs-say" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>連續挑戰：打倒後自動用下一顆同一個王的靈魂石，直到用完。</span>'
      + '<button type="button" class="btn zs-tab' + (chainOn() ? ' on' : '') + '" data-zs="chain:1">' + (chainOn() ? '開' : '關') + '</button></div>';
    if (ui.tab === 'mine') {
      var list = mine();
      if (!list.length) h += '<div class="zs-empty">背包裡沒有靈魂石。Lv60 以上的怪物與頭目偶爾會掉，也可以在「製作」用碎片或失去光芒的傳說裝備換。</div>';
      list.forEach(function (r) {
        h += '<div class="zs-row"><img src="' + esc(ICON) + '" alt=""><span class="zs-n">' + esc(r.m ? r.m.n : r.id) + ' ×' + r.cnt + '</span><span class="zs-lv">Lv' + (r.m ? r.m.lv : '?') + '</span>'
          + '<button type="button" class="btn zs-go" data-zs="use:' + esc(r.uid) + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>召喚</button></div>';
      });
    } else if (ui.tab === 'craft') {
      var sh = countOf(SHARD), lg = dullCount();
      h += '<div class="zs-card"><b>靈魂石碎片 ×' + COST.shard + ' → 隨機靈魂石 ×1</b><div class="zs-note">你有 ' + sh.toLocaleString() + ' 個碎片。</div>'
        + '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn zs-go" data-zs="shard:1"' + (sh < COST.shard ? ' disabled' : '') + '>做 1 顆</button>'
        + '<button type="button" class="btn zs-go" data-zs="shard:10"' + (sh < COST.shard * 10 ? ' disabled' : '') + '>做 10 顆</button></div></div>';
      h += '<div class="zs-card"><b>失去光芒的傳說裝備 ×' + COST.legend + ' → 隨機靈魂石 ×1</b><div class="zs-note">你有 ' + lg + ' 件（哪一種都可以）。打倒會掉傳說裝備的怪物時，另外會掉它「失去光芒的」版本。</div>'
        + '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn zs-go" data-zs="dull:1"' + (lg < COST.legend ? ' disabled' : '') + '>做 1 顆</button>'
        + '<button type="button" class="btn zs-go" data-zs="dull:10"' + (lg < COST.legend * 10 ? ' disabled' : '') + '>做 10 顆</button></div></div>';
    } else {
      h += '<div class="zs-card zs-note">'
        + '‧遊戲原本的頭目（野外王、軍王、傲慢之塔與支配者、冰之女王、底比斯、提卡爾、日出之國…）與謀叛者的低語、哈汀的時空的頭目，各有一種靈魂石，共 <b>' + BOSSES.length + '</b> 種（四龍、世界事件、地區霸主沒有）。<br>'
        + '‧使用＝進入<b>' + ROOM_N + '</b>，自己一個人挑戰那隻頭目；傭兵留在外面，打完或離開就歸隊。頭目的能力、掉落物跟原本一樣（訓練所裡不會再掉靈魂石）。<br>'
        + '‧打倒後 3 秒回到原本的地方；倒下或自己換地圖＝挑戰結束。<br>'
        + '‧取得：Lv' + RATE.minLv + ' 以上的怪物 ' + (RATE.stone * 100) + '% 掉隨機靈魂石、' + (RATE.shard * 100) + '% 掉靈魂石碎片；頭目 ' + (RATE.boss * 100) + '% 掉隨機靈魂石（攻城、時空裂痕、暗夢星迴不掉）。<br>'
        + '‧製作：碎片 ×' + COST.shard + '，或失去光芒的傳說裝備 ×' + COST.legend + '，各換一顆隨機靈魂石（所有頭目平均抽）。'
        + (p.afkSoulStats ? '<br>‧你已經用過 ' + p.afkSoulStats.used + ' 顆，打倒 ' + p.afkSoulStats.won + ' 次。' : '') + '</div>';
    }
    h += '</div>';
    div.innerHTML = h;
    div.onclick = function (ev) {
      var b = ev.target.closest('[data-zs]'); if (!b || b.disabled) return;
      var v = b.getAttribute('data-zs'), k = v.slice(0, v.indexOf(':')), a = v.slice(v.indexOf(':') + 1);
      if (k === 'souls') { if (W.LineageClassUI) W.LineageClassUI.open('souls'); return; }
      if (k === 'tab') { ui.tab = a; render(div); return; }
      if (k === 'chain') { var pc = P(); pc.afkSoulChain = !chainOn(); try { saveGame(); } catch (e) {} render(div); return; }
      if (k === 'use') { var it = (P().inv || []).find(function (i) { return i && i.uid === a; }); if (it) ask(it); return; }
      if (k === 'shard') { craftShard(Number(a) || 1); try { renderTabs(true); } catch (e) {} render(div); return; }
      if (k === 'dull') { craftDull(Number(a) || 1); try { renderTabs(true); } catch (e) {} render(div); return; }
    };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) { var div = document.getElementById('interaction-content'); if (div) render(div); } } catch (e) { console.warn('[AFK-soulstone] ui', e); }
      return r;
    };
    try { (0, eval)('interactNPC = window.interactNPC'); } catch (e) {}
  }

  W.__afkSoulStone = { PREFIX: PREFIX, ROOM: ROOM, NPC_ID: NPC_ID, RATE: RATE, COST: COST, bosses: function () { return BOSSES.slice(); }, eligible: eligible, enter: enter, leave: leave, step: step,
    roll: roll, craftShard: craftShard, craftDull: craftDull, dullCount: dullCount, dullSrc: function () { return dullSrc; }, DULL: DULL, isLegacy: isLegacy, randomStone: randomStone, busy: busy, render: render, run: function () { return run; }, unbench: unbench, swapLegacy: swapLegacy };
})();
