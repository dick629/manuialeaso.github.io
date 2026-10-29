/* ============================================================================
 * afk-ghostship.js — 幽靈船出航（玩家 2026-10-29 21:36：開船 30 分鐘一次；外掛開關 ghostship，預設開）
 *
 *   時刻：照你電腦的時鐘，每個整點與半點（:00、:30）幽靈船靠上說話之島的港口。
 *         靠岸後 10 分鐘內可以找港口的「幽靈船的引路人」登船（Lv30 以上）；靠岸後 20 分鐘船會沉回霧裡，船上的人回到說話之島。
 *   船上：甲板上的船員（海賊骷髏、海賊骷髏刀手、船舶之墓的殭屍）一直湧出來，強度跟著你的等級（Lv30～115）；
 *         這一趟打倒 30 名船員，幽靈船長就會現身（每趟一次）：
 *           幽靈砲擊（每 15 秒，全隊水屬性）、深海的召喚（每 25 秒叫 2 名溺死的水手）、
 *           沉船的詛咒（HP 50% 以下：全隊每 10 秒受到最大 HP 3% 的傷害，直到船長倒下）。
 *   獎勵：船員照一般怪（經驗、金幣、掉落）；幽靈船長：德雷克的掉落表＋幽靈船的寶藏（魔法結晶體 40～80、L×1,500 金幣，
 *         另外 30% 祝福的盔甲／武器卷軸其中一張、5% 龍之鑽石 ×5）。
 *   不在船上的時候：靠岸時系統訊息通知；狀態列顯示「⛵ 幽靈船靠岸 mm:ss」倒數。
 *   副本性質：不會在離線補跑時進行；在船上不會觸發克特與其他世界事件。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit;
  if (T && T.register) T.register({ id: 'ghostship', name: '幽靈船出航（說話之島，每 30 分鐘）', group: '遊戲內容',
    desc: '每個整點與半點幽靈船靠上說話之島港口，10 分鐘內可以登船；甲板上打倒 30 名船員，幽靈船長現身，打倒得到幽靈船的寶藏' });
  if (T && !T.enabled('ghostship')) return;
  if (!L || !K || typeof DB === 'undefined' || !DB.maps || !DB.mobs) return;

  var MAP = 'afk_ghostship', MAP_N = '幽靈船－甲板', TOWN = 'town_talking', NPC_ID = 'afk_npc_ghostship', NPC_N = '幽靈船的引路人';
  var EVERY = 30 * 60 * 1000, BOARD = 10 * 60 * 1000, VOYAGE = 20 * 60 * 1000, NEED = 30, LV_MIN = 30, REF = 65;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog, B = L.boss;
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };

  // ── 時刻（本地時鐘的 :00／:30）──
  var now = function () { return (W.__afkGsNow ? W.__afkGsNow() : Date.now()); };
  var slot = function (t) { var d = new Date(t); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 0 : 30); return d.getTime(); };   // 這一班的靠岸時間
  var docked = function (t) { t = t == null ? now() : t; return t - slot(t) < BOARD; };
  var sailing = function (t) { t = t == null ? now() : t; return t - slot(t) < VOYAGE; };
  var nextDock = function (t) { t = t == null ? now() : t; return slot(t) + EVERY; };
  var mmss = function (ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s %= 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; };
  var hhmm = function (t) { var d = new Date(t); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); };

  // ── 怪物（數值以 Lv65 為準，實際依你的等級縮放）──
  var mk = function (id, def, anim, from) {
    var base = from && DB.mobs[from] ? JSON.parse(JSON.stringify(DB.mobs[from])) : {};
    ['n', 'afkTtmi', 'hard', 'img', 'boss'].forEach(function (k) { delete base[k]; });
    return L.addMob(id, Object.assign(base, { s: 'M', beh: '主動', lv: REF, afkGs: true }, def), anim);
  };
  mk('afk_gs_skel', { n: '幽靈船的海賊骷髏', race: '不死', e: 'water', hp: 2400, ac: -45, mr: 50, exp: 700, goldMin: 200, goldMax: 400, atkSpd: 1.6, dmg: [2, 40], db: 22, hit: 60 }, '海賊骷髏', 'pirate_skeleton');
  mk('afk_gs_blade', { n: '幽靈船的骷髏刀手', race: '不死', e: 'water', hp: 2800, ac: -50, mr: 55, exp: 800, goldMin: 220, goldMax: 450, atkSpd: 1.4, dmg: [2, 46], db: 26, hit: 66 }, '海賊骷髏刀手', 'pirate_skelblade');
  mk('afk_gs_zombie', { n: '船舶之墓的溺死者', race: '不死', e: 'water', hp: 3200, ac: -40, mr: 60, exp: 850, goldMin: 200, goldMax: 400, atkSpd: 2, dmg: [3, 36], db: 20, hit: 56,
    mag: { skn: '海水的詛咒', cd: 80, chance: 0.3, dmg: [3, 30], db: 40, ele: 'water', alwaysHit: true } }, '船舶之墓殭屍(男)');
  mk('afk_gs_sailor', { n: '溺死的水手', race: '不死', e: 'water', hp: 1800, ac: -40, mr: 40, exp: 300, atkSpd: 1.6, dmg: [2, 34], db: 18, hit: 58 }, '船舶之墓殭屍(女)');
  mk('afk_gs_captain', { n: '幽靈船長', boss: true, s: 'L', race: '不死', e: 'water', hp: 30000, ac: -70, mr: 100, exp: 6000, goldMin: 5000, goldMax: 10000, atkSpd: 1.5, dmg: [3, 60], db: 50, hit: 85,
    mag: { skn: '幽靈砲擊', cd: 150, dmg: [4, 50], db: 120, ele: 'water', alwaysHit: true } }, '德雷克', 'pirate_drake');
  try { MOB_PARTY_AOE_SKILLS.add('幽靈砲擊'); } catch (e) {}
  var CREW = ['afk_gs_skel', 'afk_gs_blade', 'afk_gs_zombie'];
  try {
    var TTMI = {}; ((W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items) || []).forEach(function (id) { TTMI[id] = 1; });
    var cp = function (to, from) { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[to] && MOB_DROPS[from]) MOB_DROPS[to] = MOB_DROPS[from].filter(function (x) { return !TTMI[x[0]]; }).map(function (x) { return x.slice(); }); };
    cp('幽靈船長', '德雷克'); cp('幽靈船的海賊骷髏', '海賊骷髏'); cp('幽靈船的骷髏刀手', '海賊骷髏刀手');
  } catch (e) {}

  // ── 地圖 ──
  DB.maps[MAP] = CREW.concat(['afk_gs_captain']);
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/海賊島.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '每個整點與半點從霧裡駛進說話之島港口的幽靈船。甲板上的船員早就不是活人了。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = MAP_N; } catch (e) {}

  var Lv = function () { var p = P(); return Math.max(LV_MIN, Math.min(115, Number(p && p.lv) || LV_MIN)); };
  var scale = function (base, lv, hpMult) {
    var k = lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = lv; m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3))); m.hit = Math.round((base.hit || 0) * k); m.ac = Math.round((base.ac || 0) * k); m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2'].forEach(function (f) { var sk = m[f]; if (sk && Array.isArray(sk.dmg)) { sk.dmg = [sk.dmg[0], Math.max(2, Math.round(sk.dmg[1] * k))]; sk.db = Math.round((sk.db || 0) * Math.pow(k, 1.3)); } });
    m.exp = Math.round((base.exp || 0) * k * k); m.goldMin = Math.round((base.goldMin || 0) * k); m.goldMax = Math.round((base.goldMax || 0) * k);
    return m;
  };
  var allyN = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };

  // ── 這一趟的狀態（不存檔；登船那一班的時間存在角色上，重新讀檔還在同一班就留在船上）──
  var run = null;   // { slot, L, kills, captain: 0 未出／1 在場／2 已倒, curseOn, cannonAt, callAt, curseAt }
  var store = function () { var p = P(); if (!p) return {}; if (!p.afkGs || typeof p.afkGs !== 'object') p.afkGs = { voy: 0, kills: 0, captains: 0, rides: 0 }; return p.afkGs; };
  var newRun = function (sl) { run = { slot: sl, L: Lv(), kills: 0, captain: 0, curseOn: false, cannonAt: 0, callAt: 0, curseAt: 0 }; return run; };

  var showBattle = function () {
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
  };
  var canBoard = function () {
    var p = P(); if (!p) return '請先進入遊戲。';
    if ((Number(p.lv) || 1) < LV_MIN) return '需要 Lv' + LV_MIN + '。';
    if (p.dead) return '先復活再登船。';
    if (!docked()) return '幽靈船還沒靠岸。下一班 ' + hhmm(nextDock()) + '（' + mmss(nextDock() - now()) + ' 後）。';
    return null;
  };
  var board = function () {
    var p = P(), why = canBoard(); if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return false;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeTownFloatWindow === 'function') closeTownFloatWindow(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    var sl = slot(now()), st = store();
    if (!run || run.slot !== sl) newRun(sl);
    if (st.voy !== sl) { st.voy = sl; st.rides = (st.rides || 0) + 1; }
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    sys('<span class="font-bold" style="color:#5eead4">⛵ 你踏上濕滑的甲板，身後的跳板沉進了霧裡——幽靈船出航了。</span><span class="text-slate-300">（Lv' + run.L + '；打倒 ' + NEED + ' 名船員，幽靈船長就會現身；' + hhmm(sl + VOYAGE) + ' 船會沉回霧裡）</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
    showBattle();
    return true;
  };
  var leave = function (why) {
    if (typeof mapState === 'undefined' || mapState.current !== MAP) { run = null; return; }
    var p = P();
    sys(why === 'sink' ? '<span class="font-bold" style="color:#5eead4">⛵ 霧越來越濃，幽靈船慢慢沉了下去——等你回過神來，已經站在說話之島的港口。</span>'
      : '<span class="font-bold" style="color:#5eead4">⛵ 你回到了說話之島的港口。</span>');
    run = null;
    try { if (p && p.dead) return; setMapSelectors(TOWN); changeMap(true); saveGame(); } catch (e) { console.warn('[AFK-ghostship] leave', e); }
  };

  // ── 出怪：船員一直湧出；滿 30 名換船長（每趟一次）──
  var place = function (idx, id, extra) {
    var base = DB.mobs[id], m = scale(base, base.boss ? run.L + 5 : run.L, base.boss ? 1 + 0.15 * allyN() : 1);
    var mob = B.place(idx, m, Object.assign({ mobId: id, _gs: true }, extra || {}));
    return mob;
  };
  var captainOn = function () { return (mapState.mobs || []).some(function (m) { return m && m._gsCaptain && !m._dead && m.curHp > 0; }); };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (typeof mapState === 'undefined' || mapState.current !== MAP) return oSpawn.apply(this, arguments);
      var keep = function () { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; };
      if (!run) return keep();
      try {
        if (run.captain === 0 && run.kills >= NEED) {
          run.captain = 1; var t = tk(); run.cannonAt = t + 150; run.callAt = t + 250; run.curseAt = 0;
          var c = place(idx, 'afk_gs_captain', { _gsCaptain: true });
          sys('<span class="font-bold" style="color:#5eead4;text-shadow:0 0 8px #000">⛵ 船艙的門被一腳踹開——「誰准你們上我的船？」幽靈船長現身了！</span>');
          try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(c); } catch (e) {}
        } else place(idx, CREW[Math.floor(Math.random() * CREW.length)]);
        try { if (!S().ff) renderMobs(); } catch (e) {}
      } catch (e) { console.warn('[AFK-ghostship] spawn', e); keep(); }
    };
  }
  var treasure = function (m) {
    var p = P(), got = [], CR = null;
    try { CR = W.AFK_TTMI_ITEMS.resolve(7102); } catch (e) {}
    if (CR && DB.items[CR]) { var n = rint(40, 80); gainItem(CR, n, true, true); got.push(DB.items[CR].n + ' ×' + n); }
    var g = (m._gsL || run.L) * 1500; p.gold = (Number(p.gold) || 0) + g; got.push(g.toLocaleString() + ' 金幣');
    if (Math.random() < 0.3) { var sc = Math.random() < 0.5 ? 'scroll_armor_b' : 'scroll_weapon_b'; if (DB.items[sc]) { gainItem(sc, 1, true, true); got.push(DB.items[sc].n); } }
    if (Math.random() < 0.05) { var ok = false; try { ok = !!(W.pandoraAdjustSharedDiamonds(5) || {}).ok; } catch (e) {} if (ok) got.push('龍之鑽石 ×5'); }
    sys('<span class="text-amber-300">⛵ 船長的寶箱裡有：' + got.join('、') + '</span>');
    try { updateUI(); saveGame(); } catch (e) {}
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._gs && !m._gsPaid && run && mapState.current === MAP) {
          m._gsPaid = true; var st = store();
          if (m._gsCaptain) {
            run.captain = 2; run.curseOn = false; st.captains = (st.captains || 0) + 1;
            sys('<span class="font-bold" style="color:#fde68a">⛵ 幽靈船長跪倒在甲板上，化成一灘海水。船身開始傾斜——這艘船撐不了多久了。</span>');
            treasure(m);
          } else if (!m._gsSummon) {
            run.kills++; st.kills = (st.kills || 0) + 1;
            if (run.captain === 0 && (run.kills === 10 || run.kills === 20)) clog('<span style="color:#5eead4">⛵ 船艙深處傳來沉重的腳步聲……（船員 ' + run.kills + '／' + NEED + '）</span>');
          }
        }
      } catch (e) { console.warn('[AFK-ghostship] kill', e); }
      return r;
    };
  }

  // ── 船長的技能 ──
  var cast = function (mob, sk) { try { castMobMagic(mob, sk); } catch (e) {} };
  var captainTick = function () {
    var c = (mapState.mobs || []).find(function (m) { return m && m._gsCaptain && !m._dead && m.curHp > 0; });
    if (!c) return;
    var t = tk();
    if (B.halted(c)) { run.cannonAt++; run.callAt++; if (run.curseAt) run.curseAt++; return; }
    if (t >= run.cannonAt) { run.cannonAt = t + 150; clog('<span class="font-bold" style="color:#5eead4">【幽靈砲擊】</span>船舷的砲口一齊噴出冰冷的海水！'); cast(c, c.mag); }
    if (t >= run.callAt) {
      run.callAt = t + 250; var n = 0;
      for (var i = 0; i < mapState.mobs.length && n < 2; i++) { var x = mapState.mobs[i]; if (!x || x._dead) { place(i, 'afk_gs_sailor', { _gsSummon: true }); n++; } }
      if (n) { clog('<span class="font-bold" style="color:#5eead4">【深海的召喚】</span>船長敲響船鐘，' + n + ' 名溺死的水手從海裡爬上甲板。'); try { if (!S().ff) renderMobs(); } catch (e) {} }
    }
    if (!run.curseOn && c.curHp <= c.hp * 0.5) { run.curseOn = true; run.curseAt = t + 100; clog('<span class="font-bold" style="color:#ef4444">【沉船的詛咒】</span>「這艘船沉了一百年，你們也一起下來吧！」——全隊每 10 秒受到最大 HP 3% 的傷害。'); }
    if (run.curseOn && t >= run.curseAt) { run.curseAt = t + 100; B.party().forEach(function (m) { if (!m || m.dead || m._downed) return; var mx = m === P() ? (m.mhp || 1) : (m.mhp || m.curHp || 1); B.hurt(m, mx * 0.03); }); }
  };

  // ── 時鐘：通知、狀態列、到點沉船 ──
  var lastNote = 0;
  var badge = function () {
    try {
      var el = document.getElementById('afk-gs-badge'), p = P(), t = now(), txt = '';
      var onShip = typeof mapState !== 'undefined' && mapState.current === MAP;
      if (p && onShip && sailing(t)) txt = '⛵ 幽靈船 ' + mmss(slot(t) + VOYAGE - t) + (run && run.captain === 0 ? '（船員 ' + run.kills + '／' + NEED + '）' : '');
      else if (p && (Number(p.lv) || 0) >= LV_MIN && docked(t)) txt = '⛵ 幽靈船靠岸 ' + mmss(slot(t) + BOARD - t);
      if (!txt) { if (el) el.remove(); return; }
      var host = document.getElementById('status-alerts'); if (!host) return;
      if (!el) { el = document.createElement('span'); el.id = 'afk-gs-badge'; el.style.cssText = 'font-weight:bold;margin-left:6px;color:#5eead4'; host.appendChild(el); }
      el.textContent = txt;
    } catch (e) {}
  };
  var catching = function () { try { return typeof W.__afkOfflineNow === 'function' && !!W.__afkOfflineNow(); } catch (e) { return false; } };
  var clock = function () {
    var p = P(); if (!p) return;
    var t = now(), sl = slot(t), onShip = typeof mapState !== 'undefined' && mapState.current === MAP;
    if (onShip) {
      if (!sailing(t) || (store().voy && store().voy !== sl)) { leave('sink'); badge(); return; }
      if (!run || run.slot !== sl) newRun(sl);
      captainTick();
    } else if (run) run = null;
    if (docked(t) && lastNote !== sl && !catching() && (Number(p.lv) || 0) >= LV_MIN) {
      lastNote = sl;
      if (!onShip) sys('<span class="font-bold" style="color:#5eead4">⛵ 霧裡傳來船鐘聲——幽靈船靠上了說話之島的港口！' + hhmm(sl + BOARD) + ' 前可以找港口的「' + NPC_N + '」登船。</span>');
    }
    if (tk() % 10 === 0) badge();
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { clock(); } catch (e) { console.warn('[AFK-ghostship] tick', e); } } return r; };
  }
  // 在城裡（不跑戰鬥 tick）也要更新狀態列與靠岸通知
  setInterval(function () { try { if (!S().running || (typeof mapState !== 'undefined' && mapState.current !== MAP)) { var p = P(); if (p) { var t = now(), sl = slot(t); if (docked(t) && lastNote !== sl && (Number(p.lv) || 0) >= LV_MIN && !catching()) { lastNote = sl; sys('<span class="font-bold" style="color:#5eead4">⛵ 霧裡傳來船鐘聲——幽靈船靠上了說話之島的港口！' + hhmm(sl + BOARD) + ' 前可以找港口的「' + NPC_N + '」登船。</span>'); } } } badge(); } catch (e) {} }, 1000);

  // ── NPC ──
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: '港口', type: 'travel',
    d: '站在說話之島港口霧裡的老水手。每個整點與半點，幽靈船會靠岸 10 分鐘，他會帶你登船。' }, '1045');
  var ui = { err: '' };
  var paint = function (div) {
    var box = div.querySelector('#afk-gs-npc'); if (!box) return;
    var p = P(); if (!p) return;
    var t = now(), why = canBoard(), st = store(), d = docked(t);
    var h = '<div class="ax-h">幽靈船出航</div>'
      + '<div class="ax-note">每個<b>整點與半點</b>（照你電腦的時鐘），幽靈船會從霧裡靠上這座港口，<b>停 10 分鐘</b>讓人登船，靠岸 <b>20 分鐘</b>後沉回霧裡、船上的人回到這裡。'
      + '甲板上的船員會一直湧出來（強度跟著你的等級）；這一趟打倒 ' + NEED + ' 名船員，<b>幽靈船長</b>就會現身：幽靈砲擊、深海的召喚、HP 一半以下的沉船的詛咒。打倒他得到船長的寶箱（魔法結晶體、金幣、機率祝福卷軸與龍之鑽石）。</div>'
      + '<div class="ax-note">' + (d ? '<b style="color:#5eead4">幽靈船正在靠岸</b>：還可以登船 ' + mmss(slot(t) + BOARD - t) + '，' + hhmm(slot(t) + VOYAGE) + ' 開走。'
        : '下一班 <b>' + hhmm(nextDock(t)) + '</b>（' + mmss(nextDock(t) - t) + ' 後）。') + '　搭過 ' + (st.rides || 0) + ' 趟、打倒船長 ' + (st.captains || 0) + ' 次。</div>';
    h += K.rowHtml({ key: 'board', name: '登船', color: '#99f6e4', desc: '需要 Lv' + LV_MIN + '。登船後甲板上的船員依你的等級變強。', why: why || '', btns: [['board', '登船', !why]] }, 'data-gs');
    if (ui.err) h += '<div class="ax-err">' + esc(ui.err) + '</div>';
    K.repaint(box, h);
  };
  var render = function (div) {
    if (!div) return; K.css(); ui.err = '';
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">「聽見船鐘了嗎？那艘船一百年前就沉了，可是它每半個時辰就回來一次……」</div></div>';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-gs-npc'; div.appendChild(box);
    paint(div);
    if (!div.__afkGsBound) {
      div.__afkGsBound = true;
      div.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-gs]'); if (!b || b.disabled || !div.querySelector('#afk-gs-npc')) return; if (b.getAttribute('data-gs') === 'board') board(); });
    }
  };
  K.hookNpc(NPC_ID, NPC_N, '港口', render);

  W.__afkGhostShip = { MAP: MAP, TOWN: TOWN, NPC_ID: NPC_ID, NEED: NEED, EVERY: EVERY, BOARD: BOARD, VOYAGE: VOYAGE, LV_MIN: LV_MIN,
    slot: slot, docked: docked, sailing: sailing, nextDock: nextDock, canBoard: canBoard, board: board, leave: leave, clock: clock, render: render,
    run: function () { return run; }, stats: store };
})();
