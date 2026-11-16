/* ============================================================================
 * afk-cardregions.js — 怪物卡冊補上新地圖、新地區、新副本（Ping 11-17 04:19「用地區分就好」）
 *
 *   新地區自成一頁：佩特拉（8 張圖）。時光屋的怪都是各地原本就有卡的怪，不另開一頁。
 *   其他新圖照所在地區併進原本的頁：
 *     歐瑞＋雪壁營地 3 張、哈汀的時空、冰之女王的宮殿（單人）；肯特＋肯特地監 1～4 樓；燃柳＋妖魔城堡地監；
 *     風木＋風木城堡地監；拉斯塔巴德＋吉爾塔斯的祭壇；古魯丁＋炎之深淵、屍魂塔（單人）；說話之島＋幽靈船；
 *     亞丁＋謀叛者的低語、中央寺院（單人）；威頓＋火龍巢穴（單人）；傲慢之塔＋信念之塔 1～4 樓；奇岩＋破滅的奇岩地監 1～4 樓。
 *   夢域鏡、次元裂縫的副本（暗夢星迴、次元裂縫各副本、時空裂痕）用的都是原本就有卡的怪，頭目在王者卡冊，不另外加。
 *   保底：併進新怪之前已經達成的地區完成階，讀檔時記下來，不會因為多了新怪而掉（要升到更高階才需要新怪的卡）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var ADD = {
    oren: ['snow_sanctum', 'snow_lava', 'snow_collapse', 'afk_hardin_time', 'afk_solo_ice'],
    kent: ['cd_kent_1', 'cd_kent_2', 'cd_kent_3', 'cd_kent_4'],
    burningwillow: ['cd_orc'],
    windwood: ['cd_windwood'],
    rastabad: ['afk_giltas_altar'],
    gludin: ['afk_flame_depth', 'afk_solo_soul'],
    talkingisland: ['afk_ghostship'],
    aden: ['afk_traitor_whisper', 'afk_solo_central'],
    witon: ['afk_solo_firedragon'],
    tower: ['afk_solo_belief1', 'afk_solo_belief2', 'afk_solo_belief3', 'afk_solo_belief4'],
    giran: ['afk_solo_ruin1', 'afk_solo_ruin2', 'afk_solo_ruin3', 'afk_solo_ruin4']
  };
  var NEW = [
    { key: 'petra', name: '佩特拉', stat: 'dr', vals: [1, 2, 3], maps: ['petra_baobab', 'petra_oasis', 'petra_canyon', 'petra_dry', 'petra_bandit', 'petra_nemesis', 'petra_ruins', 'petra_sandhell'] }
  ];
  var NAMES = {
    snow_sanctum: '古龍的聖地', snow_lava: '凝固的熔岩地帶', snow_collapse: '崩塌的雪壁', afk_hardin_time: '哈汀的時空', afk_solo_ice: '冰之女王的宮殿（單人）',
    cd_kent_1: '肯特地監1樓', cd_kent_2: '肯特地監2樓', cd_kent_3: '肯特地監3樓', cd_kent_4: '肯特地監4樓', cd_orc: '妖魔城堡地監（污濁之地）', cd_windwood: '風木城堡地監',
    afk_giltas_altar: '吉爾塔斯的祭壇', afk_flame_depth: '炎之深淵', afk_solo_soul: '屍魂塔（單人）', afk_ghostship: '幽靈船', afk_traitor_whisper: '謀叛者的低語',
    afk_solo_central: '中央寺院（單人）', afk_solo_firedragon: '火龍巢穴（單人）',
    afk_solo_belief1: '信念之塔1樓', afk_solo_belief2: '信念之塔2樓', afk_solo_belief3: '信念之塔3樓', afk_solo_belief4: '信念之塔4樓',
    afk_solo_ruin1: '破滅的奇岩地監1樓', afk_solo_ruin2: '破滅的奇岩地監2樓', afk_solo_ruin3: '破滅的奇岩地監3樓', afk_solo_ruin4: '破滅的奇岩地監4樓',
    petra_baobab: '猴麵包樹森林', petra_oasis: '佩特拉綠洲', petra_canyon: '砂之沙漠峽谷', petra_dry: '乾枯的沙漠地帶', petra_bandit: '盜賊團營地',
    petra_nemesis: '古代兵器涅默西斯駐紮地', petra_ruins: '廢墟都市入口', petra_sandhell: '沙地獄', time_room: '時光屋'
  };
  var ok = function () { try { return typeof CARD_REGIONS !== 'undefined' && typeof CARD_REGION_MOBS !== 'undefined' && typeof DB !== 'undefined'; } catch (e) { return false; } };
  // 併進新怪之前的名單（保底用）
  var OLD = null;
  var snapOld = function () { if (OLD || !ok()) return; OLD = {}; CARD_REGIONS.forEach(function (r) { OLD[r.key] = (CARD_REGION_MOBS[r.key] || []).slice(); }); };
  var done = {};
  var reg = function (rk, mk) {
    var tag = rk + '|' + mk; if (done[tag]) return false;
    var pool = DB.maps[mk]; if (!pool || !pool.length) return false;
    done[tag] = 1;
    var names = CARD_REGION_MOBS[rk] = CARD_REGION_MOBS[rk] || [], added = false;
    var one = function (mid, mob) {
      var nm = mob.n; if (!nm) return;
      if (names.indexOf(nm) < 0) { names.push(nm); added = true; }
      if (!CARD_MOB_INFO[nm]) {
        CARD_MOB_INFO[nm] = { id: mid, mob: mob };
        CARD_TIERS.forEach(function (ct) {
          DB.items[cardId(nm, ct.t)] = { n: nm + ' 的' + ct.sfx, type: 'misc', eff: 'card', cardTier: ct.t, cardMob: nm, c: ct.col, img: ct.img, p: ct.price, gachaWeight: ct.weight,
            d: '怪物卡片。使用以在卡片收集冊中登錄「' + nm + '」（' + ct.sfx + '效果）。' };
        });
      }
      (CARD_MOB_REGIONS[nm] = CARD_MOB_REGIONS[nm] || []); if (CARD_MOB_REGIONS[nm].indexOf(rk) < 0) CARD_MOB_REGIONS[nm].push(rk);
      (CARD_MOB_MAPS[nm] = CARD_MOB_MAPS[nm] || []); if (CARD_MOB_MAPS[nm].indexOf(mk) < 0) CARD_MOB_MAPS[nm].push(mk);
    };
    pool.forEach(function (mid) {
      var mob = DB.mobs[mid]; if (!mob || !mob.n || mob.race === '血盟' || mob.race === '建築') return;
      if (mob.boss) return;   // 頭目收在王者卡冊
      one(mid, mob);
      var seen = {}; seen[mid] = 1; var t = mob.transformTo;
      while (t && DB.mobs[t] && DB.mobs[t].n && !seen[t]) { seen[t] = 1; one(t, DB.mobs[t]); t = DB.mobs[t].transformTo; }
    });
    if (NAMES[mk] && typeof _CARD_MAP_NAMES !== 'undefined' && !_CARD_MAP_NAMES[mk]) _CARD_MAP_NAMES[mk] = NAMES[mk];
    if (added) names.sort(function (a, b) { return ((CARD_MOB_INFO[a].mob.lv) || 0) - ((CARD_MOB_INFO[b].mob.lv) || 0); });
    return added;
  };
  var ensure = function () {
    if (!ok()) return;
    snapOld();
    NEW.forEach(function (r) { if (!CARD_REGIONS.some(function (x) { return x.key === r.key; })) { CARD_REGIONS.push({ key: r.key, name: r.name, stat: r.stat, vals: r.vals, maps: r.maps.slice() }); } });
    Object.keys(ADD).forEach(function (rk) { ADD[rk].forEach(function (mk) { if (reg(rk, mk)) { var R = CARD_REGIONS.find(function (x) { return x.key === rk; }); if (R && Array.isArray(R.maps) && R.maps.indexOf(mk) < 0) R.maps.push(mk); } }); });
    NEW.forEach(function (r) { r.maps.forEach(function (mk) { reg(r.key, mk); }); });
  };
  // ── 保底：併進新怪前已經達成的完成階 ──
  // 用原本的完成階算法（含其他外掛加的更高階），只是把名單暫時換回併進新怪前的
  var keepFor = function (p, base) {
    if (!p || !OLD || !base) return null;
    var k = p.cardRegionKeep;
    if (!k || k.v !== 1 || k.who !== p) {
      if (!k || k.v !== 1) {
        k = { v: 1, t: {} };
        Object.keys(ADD).forEach(function (rk) {
          var cur = CARD_REGION_MOBS[rk]; if (!OLD[rk]) return;
          CARD_REGION_MOBS[rk] = OLD[rk];
          try { var t = Number(base(rk)) || 0; if (t > 0) k.t[rk] = t; } catch (e) {}
          CARD_REGION_MOBS[rk] = cur;
        });
        p.cardRegionKeep = k;
      }
      try { Object.defineProperty(k, 'who', { value: p, enumerable: false, configurable: true, writable: true }); } catch (e) {}
    }
    return k.t;
  };
  var wrapTier = function () {
    var o = W.cardRegionTier; if (typeof o !== 'function' || o.__afkCR) return;
    var f = function (key) {
      var v = o.apply(this, arguments);
      try { var p = typeof player !== 'undefined' ? player : null, t = keepFor(p, o); if (t && t[key] > v) v = t[key]; } catch (e) {}
      return v;
    };
    f.__afkCR = true; W.cardRegionTier = f;
    try { (0, eval)('cardRegionTier = window.cardRegionTier'); } catch (e) {}
  };
  ensure(); wrapTier();
  W.addEventListener('load', function () { ensure(); wrapTier(); setTimeout(ensure, 3000); });
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () { try { ensure(); } catch (e) {} var r = oLoad.apply(this, arguments); try { if (typeof cardRegionTier === 'function') cardRegionTier('oren'); } catch (e) {} return r; };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }
  W.__afkCardRegions = { ensure: ensure, ADD: ADD, NEW: NEW };
  try { console.log('[AFK-cardregions] 已啟用：怪物卡冊補上新地區與副本'); } catch (e) {}
})();
