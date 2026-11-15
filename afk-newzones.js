/* ============================================================================
 * afk-newzones.js — 新地圖、城堡地監、單人副本（Ping 2026-11-14 17:16；本機測試版，還沒上線）
 *
 *   原則（Ping 17:16／17:19）：怪物、掉落物只用遊戲現有的；遊戲裡沒有的怪、物品一律不做，
 *   整理在 claude/newzones-missing.md 給 Ping 討論。
 *   怪物是「同名的現有怪物」依地圖等級放大（名字、外觀、卡片、原本的掉落都一樣，只有等級、HP、攻擊、經驗變高）。
 *
 *   一、佩特拉（新地區）：佩特拉後裔村＋7 個獵場＋沙地獄（每個整點依機率開 20 分鐘）；古代兵器駐紮地有王「封印的涅默西斯」（出現規則同地圖王）
 *   二、雪壁營地（歐瑞）：村莊＋古龍的聖地、凝固的熔岩地帶、崩塌的雪壁（掉守護者頭盔、古龍皮長靴、飛龍皮手套、聖地戒指）
 *   三、城堡地監：肯特地監 1～4 樓、妖魔城堡地監（污濁之地）、風木城堡地監；沒有時數限制，擁有那座城才能進（Ping 22:24）
 *   四、單人副本（Ping 22:24）：信念之塔 1～4 樓、破滅的奇岩地監 1～4 樓（各 10 波 × 30 隻後出現該層的王）、
 *       冰之女王的宮殿、中央寺院（守護獨角獸三回合→夢幻的支配者）、火龍巢穴（每區火龍的雷歐→伊弗利特／不死鳥／巴拉卡斯）、屍魂塔（每層守層王→魔王安德雷亞）。
 *       難度跟著世界模式：夢域鏡 1,000 龍鑽、次元裂縫 500 血龍鑽；每個副本（每層）每天一次；傭兵留在隊伍、副本裡不出場。
 *       王一律掉：夢域鏡＝覺醒職業神話法術書碎片 0.1%、傳說技能秘笈 0.1%；次元裂縫＝失去光芒的覺醒職業神話法術書 0.01%、神話技能秘笈 0.1%；
 *       兩種都有：黑暗精靈水晶（暗影衝擊）1%、精靈水晶（精靈之暈）1%；其他照原本角色的掉落。
 *   五、新物品：世界樹戒指、屍魂之頭盔等 5 件、真‧死亡騎士烈炎之劍（遺物）；雪壁四件傳說裝備；暗影衝擊、精靈之暈（技能）；
 *       覺醒導師「神話法術書」分頁：碎片 100→失去光芒的法術書 1；失去光芒的法術書 10＋神話／傳說技能秘笈 1→自己職業的神話／傳說法術書。
 *   弱點：照天堂M 大補帖，用怪物屬性表現（弱火＝地屬性、弱風＝水屬性、弱水＝火屬性、弱地＝風屬性）。
 *   經典模式沒有；外掛開關 newzones（本機測試預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'newzones', name: '新地圖與單人副本', group: '遊戲內容', def: true, desc: '佩特拉、雪壁營地、信念之塔、破滅的奇岩地監、城堡地監，以及冰之女王的宮殿、中央寺院、火龍巢穴、屍魂塔四個單人副本' });
  if (T && !T.enabled('newzones')) return;
  if (typeof DB === 'undefined' || !DB.maps || !DB.mobs || !DB.towns) return;
  var L = W.__afkLore, K = W.__afkNpcKit;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var N = function (x) { return Number(x) || 0; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var cur = function () { return (typeof mapState !== 'undefined' && mapState.current) || ''; };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var GET = function (n) { try { return (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : null'); } catch (e) { return null; } };
  var WEAK = { fire: 'earth', wind: 'water', water: 'fire', earth: 'wind', none: 'none' };   // 弱 X → 怪物屬性

  // ── 怪物：同名現有怪物依地圖等級放大 ──
  var clone = function (src, lv, weak, tag) {
    var b = DB.mobs[src]; if (!b) return null;
    var id = 'afk_nz_' + src + '_' + lv + (weak ? '_' + weak : '') + (tag || '');
    if (DB.mobs[id]) return id;
    var m = JSON.parse(JSON.stringify(b)), k = Math.max(1, lv / Math.max(1, N(b.lv)));
    m.lv = Math.max(N(b.lv), lv);
    m.hp = Math.max(1, Math.round(N(b.hp || 100) * Math.pow(k, 2.2)));
    var sd = function (o) { if (o && Array.isArray(o.dmg)) o.dmg = [o.dmg[0], Math.max(2, Math.round(o.dmg[1] * k))]; };
    sd(m); sd(m.mag); sd(m.mag2); sd(m.mag3);
    m.db = Math.round(N(b.db) * Math.pow(k, 1.3)); m.hit = Math.round(N(b.hit) * k);
    m.exp = Math.round(N(b.exp) * k * k); m.goldMin = Math.round(N(b.goldMin) * k); m.goldMax = Math.round(N(b.goldMax) * k);
    if (weak && WEAK[weak]) m.e = WEAK[weak];
    m._nzSrc = src;
    DB.mobs[id] = m;
    return id;
  };
  var pool = function (list, lv, weak) { return list.map(function (s) { return clone(s, lv, weak); }).filter(Boolean); };

  // ── 新怪物（Ping 11-15）：佩特拉 21 種（名字照韓國 Inven 玩家整理的直譯）、破滅奇岩 1 樓的罪犯 ──
  //   外觀、基本數值借現有的怪（之後換 GPT 專屬圖）；掉落只用遊戲現有的物品，天堂M 有但遊戲沒有的列在報告裡
  var PAN = ['panacea_white', 0.5];   // 純白的萬能藥：佩特拉的怪全部會掉
  var NEWM = {
    // 海市蜃樓結界入口（放在佩特拉綠洲）
    p_beetle: ['甲蟲', 'thebes_scarab', [PAN]], p_bug: ['毒蟲', 'afk_ttmi_147', [PAN]], p_wingspider: ['翼蜘蛛', 'afk_ttmi_148', [PAN]],
    p_hippogriff: ['鷹獅', 'griffon', [PAN]], p_armadillo: ['犰狳', 'armadillo', [PAN]], p_desertlizard: ['沙漠蜥蜴', 'evil_lizard', [PAN]],
    // 猴麵包樹森林
    p_cactus: ['瘋狂仙人掌', 'thebes_mandra', [PAN, ['arm_69', 0.1]]], p_spore: ['孢子人', 'nm_038', [PAN, ['arm_69', 0.1]]], p_cactusdog: ['仙人掌狗', 'doberman', [PAN, ['arm_69', 0.1]]],
    // 砂之沙漠峽谷
    p_sandfin: ['沙鰭', 'cr_fafurion_m2', [PAN, ['acc_134', 0.1]]], p_sabertooth: ['劍齒虎', 'afk_ttmi_2', [PAN, ['acc_134', 0.1]]], p_bluetongue: ['藍舌', 'obli_evillizard', [PAN, ['acc_134', 0.1]]],
    // 佩特拉盜賊營地
    p_thief_war: ['盜賊團戰士', 'afk_ttmi_24', [PAN, ['acc_120', 0.1]]], p_thief_mage: ['盜賊團魔法師', 'pride_flamemage', [PAN, ['acc_120', 0.1]]], p_thief_bow: ['盜賊團弓手', 'afk_ttmi_23', [PAN, ['acc_120', 0.1]]],
    // 乾枯的沙漠地帶
    p_rockwar: ['岩石戰士', 'afk_ttmi_46', [PAN, ['amu_str', 0.1]]], p_sandman: ['沙人', 'thebes_obelisk', [PAN, ['amu_str', 0.1]]], p_rockbeast: ['岩石野獸', 'iv_stone_golem', [PAN, ['amu_str', 0.1]]],
    // 廢墟都市入口
    p_earthgolem: ['佩特拉大地魔像', 'afk_ttmi_47', [PAN, ['wpn_damascus', 0.1]]], p_golem: ['佩特拉魔像', 'afk_ttmi_48', [PAN, ['wpn_damascus', 0.1]]],
    p_guardian: ['佩特拉守護者', 'afk_ttmi_49', [PAN, ['wpn_damascus', 0.1], ['bk_aw_runeblade_illusion2', 0.01]]],
    // 破滅的奇岩地監 1 樓
    r_evil: ['邪惡的罪犯', 'bandit', 'earth'], r_cruel: ['殘忍的罪犯', 'bandit', 'earth'], r_violent: ['暴力的罪犯', 'afk_ttmi_25', 'earth'], r_hungry: ['飢餓的罪犯', 'ghoul', 'fire']
  };
  var CRIM = [['glv_official', 0.05], ['bot_official', 0.05], ['shd_official', 0.05], ['arm_official_cloak', 0.05], ['wpn_thunder_sword', 0.05], ['scroll_armor', 1], ['scroll_weapon', 0.5]];
  var NMID = {};
  var NM_ART = {};   // GPT 做好的專屬動畫（Ping 11-15）
  ["仙人掌狗", "佩特拉大地魔像", "佩特拉守護者", "佩特拉魔像", "劍齒虎", "孢子人", "岩石戰士", "岩石野獸", "暴力的罪犯", "殘忍的罪犯", "毒蟲", "沙人", "沙漠蜥蜴", "沙鰭", "犰狳", "甲蟲", "瘋狂仙人掌", "盜賊團弓手", "盜賊團戰士", "盜賊團魔法師", "翼蜘蛛", "藍舌", "邪惡的罪犯", "飢餓的罪犯", "鷹獅"].forEach(function (n) { NM_ART[n] = 1; });
  Object.keys(NEWM).forEach(function (k) {
    var x = NEWM[k], src = DB.mobs[x[1]]; if (!src) return;
    var id = 'afk_nzm_' + k, m = JSON.parse(JSON.stringify(src));
    m.n = x[0]; delete m.boss; delete m.afkTtmi;
    var weak = /^p_/.test(k) ? 'fire' : x[2]; if (weak && WEAK[weak]) m.e = WEAK[weak];   // 佩特拉 21 種全部弱火
    if (k === 'r_hungry') m.race = '不死';
    DB.mobs[id] = m; NMID[k] = id;
    try { if (NM_ART[x[0]]) { var nms = GET('MOB_ANIM_NAMES'), al = GET('MOB_ANIM_ALIAS'); if (nms) nms.add(x[0]); if (al) delete al[x[0]]; } else if (L && L.aliasAnim) L.aliasAnim(x[0], src.n); } catch (e) {}
    try { var MD = GET('MOB_DROPS'); if (MD) MD[x[0]] = (/^p_/.test(k) ? x[2] : CRIM).map(function (e) { return e.slice(); }).filter(function (e) { return DB.items[e[0]]; }); } catch (e) {}
  });
  var nm = function (keys) { return keys.map(function (k) { return NMID[k]; }).filter(Boolean); };
  // ── 地圖 ──
  var BG = 'assets/area/1920x1080/';
  var ZONES = [
    // 佩特拉（天堂M：8 個地區＋沙地獄；21 種怪照韓國 Inven 玩家整理的 6 區，對不到的涅默西斯駐紮地、沙地獄照舊用現有的怪）
    { id: 'petra_baobab', n: '猴麵包樹森林', region: 'petra', cat: 'wild', lv: 82, bg: '', mobs: nm(['p_cactus', 'p_spore', 'p_cactusdog']), drops: 'gem' },
    { id: 'petra_oasis', n: '佩特拉綠洲', region: 'petra', cat: 'wild', lv: 83, bg: '', mobs: nm(['p_beetle', 'p_bug', 'p_wingspider', 'p_hippogriff', 'p_armadillo', 'p_desertlizard']), drops: 'gem' },
    { id: 'petra_canyon', n: '砂之沙漠峽谷', region: 'petra', cat: 'wild', lv: 84, bg: '', mobs: nm(['p_sandfin', 'p_sabertooth', 'p_bluetongue']), drops: 'gem' },
    { id: 'petra_dry', n: '乾枯的沙漠地帶', region: 'petra', cat: 'wild', lv: 84, bg: '', mobs: nm(['p_rockwar', 'p_sandman', 'p_rockbeast']), drops: 'gem' },
    { id: 'petra_bandit', n: '盜賊團營地', region: 'petra', cat: 'wild', lv: 85, weak: 'fire', bg: '', mobs: nm(['p_thief_war', 'p_thief_mage', 'p_thief_bow']).concat(['afk_mb_bandit']), drops: 'gem' },
    { id: 'petra_nemesis', n: '古代兵器涅默西斯駐紮地', region: 'petra', cat: 'wild', lv: 87, bg: '', mobs: ['afk_ttmi_44', 'afk_ttmi_45', 'afk_ttmi_46', 'afk_ttmi_47', 'afk_ttmi_48', 'afk_ttmi_49', 'afk_ttmi_50'], drops: 'gem' },
    { id: 'petra_ruins', n: '廢墟都市入口', region: 'petra', cat: 'wild', lv: 86, weak: 'fire', bg: '', mobs: nm(['p_earthgolem', 'p_golem', 'p_guardian']), drops: 'gem' },
    { id: 'petra_sandhell', n: '沙地獄', region: 'petra', cat: 'dungeon', lv: 90, weak: 'fire', bg: '', mobs: ['afk_ttmi_144', 'afk_ttmi_145', 'afk_ttmi_146', 'afk_ttmi_147', 'afk_ttmi_148', 'afk_ttmi_149', 'afk_ttmi_150', 'afk_ttmi_151'], drops: 'gem2', sandhell: true },
    // 雪壁營地周邊（周邊獵場的怪物表查不到，用遊戲現有的龍、熔岩、雪原怪）
    { id: 'snow_sanctum', n: '古龍的聖地', region: 'oren', cat: 'wild', lv: 80, bg: '', mobs: ['afk_ttmi_189', 'afk_ttmi_190', 'afk_ttmi_30', 'wyvern'] },
    { id: 'snow_lava', n: '凝固的熔岩地帶', region: 'oren', cat: 'wild', lv: 78, bg: '', mobs: ['lava_golem', 'fire_beast', 'fire_egg', 'salamander', 'afk_ttmi_200', 'afk_ttmi_202'] },
    { id: 'snow_collapse', n: '崩塌的雪壁', region: 'oren', cat: 'wild', lv: 76, bg: '', mobs: ['afk_ttmi_199', 'afk_ttmi_59', 'afk_ttmi_60', 'afk_ttmi_61', 'nm_020', 'nm_022', 'nm_012'] },
    // 城堡地監（肯特火、妖堡風、風木火）：Ping 22:24 改成沒有時數限制；擁有那座城才能進去
    { id: 'cd_kent_1', n: '肯特地監1樓', region: 'kent', cat: 'dungeon', lv: 62, weak: 'fire', gate: { castle: 'kent' }, bg: '', mobs: ['zombie', 'skeleton', 'skel_archer', 'ghoul'], drops: 'red' },
    { id: 'cd_kent_2', n: '肯特地監2樓', region: 'kent', cat: 'dungeon', lv: 65, weak: 'fire', gate: { castle: 'kent' }, bg: '', mobs: ['skel_axe', 'skel_spear', 'sparto', 'ungoliant'], drops: 'red' },
    { id: 'cd_kent_3', n: '肯特地監3樓', region: 'kent', cat: 'dungeon', lv: 68, weak: 'fire', gate: { castle: 'kent' }, bg: '', mobs: ['ogre', 'cerberus', 'lycan', 'ogre_warrior'], drops: 'red' },
    { id: 'cd_kent_4', n: '肯特地監4樓', region: 'kent', cat: 'dungeon', lv: 72, weak: 'fire', gate: { castle: 'kent' }, bg: '', mobs: ['ogre_king', 'b_knight', 'cerberus', 'ogre_warrior'], drops: 'red' },
    { id: 'cd_orc', n: '妖魔城堡地監（污濁之地）', region: 'burningwillow', cat: 'dungeon', lv: 68, weak: 'wind', gate: { castle: 'orc_fortress' }, bg: '', mobs: ['nm_007', 'spider', 'afk_ttmi_23', 'bandit', 'dark_spirit_king', 'pride_fire_king', 'fighter', 'afk_ttmi_87'], drops: 'red' },
    { id: 'cd_windwood', n: '風木城堡地監', region: 'windwood', cat: 'dungeon', lv: 64, weak: 'fire', gate: { castle: 'windwood' }, bg: '', mobs: ['zombie', 'skeleton', 'skel_archer', 'skel_axe', 'skel_spear', 'sparto', 'ghoul', 'ungoliant', 'ogre', 'cerberus', 'ogre_king'], drops: 'red' }
  ];
  // 地圖額外掉落（只用遊戲現有物品；% ＝ 每隻怪的機率，跟一般掉落一樣吃掉寶倍率）
  var DROPS = {
    gem: [['new_item_151', 0.3], ['new_item_160', 0.3], ['new_item_157', 0.3], ['new_item_154', 0.3]],          // 鑽石、藍寶石、紅寶石、綠寶石
    gem2: [['new_item_151', 0.6], ['new_item_160', 0.6], ['new_item_157', 0.6], ['new_item_154', 0.6]],
    red: [['new_item_188', 0.5]]                                   // 紅色布料
  };
  var ZBY = {};
  ZONES.forEach(function (z) { ZBY[z.id] = z; if (!z.bg) z.bg = BG + z.n + '.jpg'; DB.maps[z.id] = pool(z.mobs, z.lv, z.weak); });

  // ── 村莊 ──
  var TOWNS = {
    town_petra: { n: '佩特拉後裔村', region: 'petra', bg: '佩特拉後裔村', npcs: [
      { id: 'npc_nz_petra_shop', n: '沙漠商人 哈迪', title: '雜貨商人', type: 'shop', d: '佩特拉後裔村的商人，賣的是旅人在沙漠裡用得到的東西。' },
      { id: 'npc_nz_petra_wh', n: '倉庫管理員 薩伊德', title: '倉庫', type: 'warehouse', d: '存放物品與金幣，四個存檔角色共用。' },
      { id: 'npc_nz_petra_ally', n: '傭兵公會', title: '協力', type: 'ally', d: '傭兵公會替你牽起命運的絲線，召喚其他存檔位的角色一起作戰。' }
    ] },
    town_snowwall: { n: '雪壁營地', region: 'oren', bg: '歐瑞雪壁', npcs: [
      { id: 'npc_nz_salin', n: '沙林', title: '雜貨商人', type: 'shop', d: '雪壁營地的雜貨商人沙林。' },
      { id: 'npc_nz_tyler', n: '泰勒', title: '卷軸商人', type: 'shop', d: '雪壁營地的卷軸商人泰勒。' },
      { id: 'npc_nz_dorin', n: '朵琳', title: '倉庫', type: 'warehouse', d: '倉庫管理員朵琳，存放物品與金幣，四個存檔角色共用。' },
      { id: 'npc_nz_kesen', n: '凱森', title: '武器防具商人', type: 'shop', d: '雪壁營地的武器防具商人凱森。' },
      { id: 'npc_nz_snow_ally', n: '傭兵公會', title: '協力', type: 'ally', d: '傭兵公會替你牽起命運的絲線，召喚其他存檔位的角色一起作戰。' }
    ] }
  };
  Object.keys(TOWNS).forEach(function (t) { if (!DB.towns[t]) DB.towns[t] = { n: TOWNS[t].n, npcs: TOWNS[t].npcs.slice() }; });
  try { var A19 = GET('AREA_1920'); var TB = GET('TOWN_BG_1920'); Object.keys(TOWNS).forEach(function (t) { if (A19 && A19.add) A19.add(TOWNS[t].bg); if (TB) TB[t] = TOWNS[t].bg; }); } catch (e) {}
  try { var SPR = GET('NPC_SPR_FIXED'); if (SPR) { var cp = { npc_nz_petra_shop: 'npc_piwood', npc_nz_petra_wh: 'npc_wh_oren', npc_nz_petra_ally: 'npc_ally_oren', npc_nz_salin: 'npc_piwood', npc_nz_tyler: 'npc_lawen', npc_nz_dorin: 'npc_wh_oren', npc_nz_kesen: 'npc_piwood', npc_nz_snow_ally: 'npc_ally_oren' }; Object.keys(cp).forEach(function (k) { if (!SPR[k] && SPR[cp[k]]) SPR[k] = SPR[cp[k]]; }); } } catch (e) {}

  // ── 選單：分類、地區、背景 ──
  try {
    var MC = GET('MAP_CATEGORIES'), MR = GET('MAP_REGIONS'), SAB = GET('SPECIAL_AREA_BG');
    var addCat = function (cat, v, t, c) { if (MC && MC[cat] && !MC[cat].some(function (x) { return x.v === v; })) MC[cat].push(c ? { v: v, t: t, c: c } : { v: v, t: t }); };
    var region = function (key) { return MR && MR.filter(function (r) { return r.key === key; })[0]; };
    if (MR && !region('petra')) { var ai = MR.map(function (r) { return r.key; }).indexOf('aden'); MR.splice(ai >= 0 ? ai + 1 : MR.length, 0, { key: 'petra', label: '佩特拉', maps: [] }); }
    var addReg = function (key, v, t) { var r = region(key); if (r && !r.maps.some(function (x) { return x.v === v; })) r.maps.push({ v: v, t: t }); };
    Object.keys(TOWNS).forEach(function (t) { addCat('village', t, TOWNS[t].n, '#fcd34d'); addReg(TOWNS[t].region, t, TOWNS[t].n); });
    ZONES.forEach(function (z) {
      addCat(z.cat, z.id, z.n, z.gate ? '#fca5a5' : (z.sandhell ? '#f59e0b' : '#fde68a'));
      addReg(z.region, z.id, z.n);
      if (SAB) SAB[z.id] = z.bg;
    });
  } catch (e) { console.warn('[AFK-newzones] 選單', e); }
  // 限時、收費、單人副本的地圖不跑離線掛機
  W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat(ZONES.filter(function (z) { return z.gate || z.sandhell; }).map(function (z) { return z.id; }));

  // ── 沙地獄：每個整點 35% 機率開 20 分鐘 ──
  var hourKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 3600000); };
  var sandOpen = function () {
    var hk = hourKey(), x = Math.sin(hk * 12.9898) * 43758.5453; x = x - Math.floor(x);
    var min = new Date(Date.now() + 8 * 3600000).getUTCMinutes();
    return x < 0.35 && min < 20;
  };

  // ========================================================================
  // 新物品（Ping 11-14 22:24）
  // ========================================================================
  var ICO = 'assets/icons/newzones/';
  var itemIcon = function (id) { var x = DB.items[id]; return x && x.img; };
  var NEWI = {
    // 覺醒職業的神話法術書
    afk_aw_myth_frag: { n: '覺醒職業 神話法術書碎片', type: 'etc', c: 'text-fuchsia-300', img: ICO + '覺醒職業神話法術書碎片.webp', d: '單人副本（夢域鏡難度）的頭目偶爾留下的碎片。100 片可在覺醒導師合成「失去光芒的覺醒職業 神話法術書」。' },
    afk_aw_myth_lost: { n: '失去光芒的覺醒職業 神話法術書', type: 'etc', c: 'text-fuchsia-300', img: ICO + '失去光芒的覺醒職業神話法術書.webp', d: '失去光芒的法術書。10 本加上神話技能秘笈（或傳說技能秘笈），可在覺醒導師換一本覺醒職業的神話（或傳說）法術書。' },
    afk_myth_codex: { n: '神話技能秘笈', type: 'etc', c: 'text-fuchsia-300', img: ICO + '神話技能秘笈.webp', d: '次元裂縫難度的副本頭目偶爾留下的秘笈。覺醒導師兌換神話法術書時需要。' },
    afk_legend_codex: { n: '傳說技能秘笈', type: 'etc', c: 'text-amber-300', img: ICO + '傳說技能秘笈.webp', d: '單人副本（夢域鏡難度）的頭目偶爾留下的秘笈。覺醒導師兌換傳說法術書時需要。' },
    // 技能書
    bk_dark_shadowstun: { n: '黑暗精靈水晶(暗影衝擊)', type: 'skillbk', sk: 'sk_dark_shadowstun', p: 30000, img: ICO + '暗影衝擊.webp' },
    bk_elf_spiritstun: { n: '精靈水晶(精靈之暈)', type: 'skillbk', sk: 'sk_elf_spiritstun', p: 30000, img: ICO + '精靈之暈.webp' },
    // 遺物
    relic_worldtree_ring: { noRiftRelic: true, n: '世界樹戒指', type: 'acc', slot: 'ring', relic: true, noEnhance: true, ac: 1, mhp: 60, mmp: 30, hpR: 4, mpR: 2, mr: 5, req: 'all', p: 10000, img: ICO + '世界樹戒指.webp', d: '【遺物】佩特拉世界樹的枝條纏成的戒指，戴著能感覺到生命在指間流動。' },
    relic_true_dk_flameblade: { noRiftRelic: true, n: '真‧死亡騎士烈炎之劍', type: 'wpn', relic: true, noEnhance: true, dmgS: 18, dmgL: 12, hit: 7, dmgBonus: 5, spd: 0.8, req: 'knight', p: 10000, img: ICO + '真‧死亡騎士烈炎之劍.webp', spellProc: { skn: '地獄火', dice: [16, 5], flat: 60, ele: 'fire', aoe: true }, procRateBase: 6, procRatePerEn: 0, d: '【遺物】火龍巢穴深處找到的烈炎之劍，劍刃上的業火比死亡騎士手中的還要旺盛。' },
    relic_soul_helm: { noRiftRelic: true, n: '屍魂之頭盔', type: 'arm', slot: 'helm', relic: true, noEnhance: true, ac: 5, mr: 5, req: 'all', p: 10000, img: ICO + '屍魂之頭盔.webp', d: '【遺物】惡靈守門人遺下的頭盔，冰冷的怨氣還繞在上頭。' },
    relic_soul_gloves: { noRiftRelic: true, n: '屍魂之手套', type: 'arm', slot: 'gloves', relic: true, noEnhance: true, ac: 3, meleeHit: 2, rangedHit: 2, req: 'all', p: 10000, img: ICO + '屍魂之手套.webp', d: '【遺物】執行者巴羅卡勒行刑時戴的手套。' },
    relic_soul_boots: { noRiftRelic: true, n: '屍魂之靴', type: 'arm', slot: 'boots', relic: true, noEnhance: true, ac: 3, hpR: 3, req: 'all', p: 10000, img: ICO + '屍魂之靴.webp', d: '【遺物】混亂的威里諾踏過屍魂塔的靴子。' },
    relic_soul_armor: { noRiftRelic: true, n: '屍魂之盔甲', type: 'arm', slot: 'armor', relic: true, noEnhance: true, ac: 8, mhp: 50, req: 'all', p: 10000, img: ICO + '屍魂之盔甲.webp', d: '【遺物】百獸王卡諾圖身上剝下的盔甲。' },
    relic_soul_cloak: { noRiftRelic: true, n: '屍魂之披風', type: 'arm', slot: 'cloak', relic: true, noEnhance: true, ac: 3, mr: 5, req: 'all', p: 10000, img: ICO + '屍魂之披風.webp', d: '【遺物】魔王安德雷亞的披風，邊緣燃著紫黑色的靈魂火。' },
    // 雪壁營地的裝備（照天堂M 原版能力，Ping 11-14 23:37 提供）
    afk_nz_guard_helm: { n: '守護者面甲', legend: true, type: 'arm', slot: 'helm', ac: 4, str: 2, dr: 1, req: 'all', safe: 4, maxEn: 14, p: 150000, img: ICO + '守護者面甲.webp', d: '古龍聖地的守護者戴過的面甲。' },
    afk_nz_dragon_boots: { n: '古龍皮長靴', type: 'arm', slot: 'boots', ac: 4, dex: 1, rangedHit: 1, req: 'elf', safe: 4, maxEn: 14, p: 80000, c: 'text-purple-300', img: ICO + '古龍皮長靴.webp', d: '【英雄】用古龍的皮縫成的長靴，耐得住熔岩地帶的高溫。' },
    afk_nz_wyvern_gloves: { n: '飛龍皮手套', type: 'arm', slot: 'gloves', ac: 2, int: 1, mdmg: 1, magicHit: 1, req: 'mage,knight', nzReq: ['mage', 'paladin'], safe: 4, maxEn: 14, p: 80000, c: 'text-purple-300', img: ICO + '飛龍皮手套.webp', d: '【英雄】飛龍皮做的手套，又輕又韌。' },
    relic_nz_sanct_ring: { noRiftRelic: true, n: '聖地戒指', type: 'acc', slot: 'ring', relic: true, noEnhance: true, ac: 1, str: 1, int: 1, mpR: 1, req: 'all', p: 10000, img: ICO + '聖地戒指.webp', d: '【遺物】古龍聖地的祭司留下的戒指，帶著聖地的守護。' },
    // 信念之塔四隻王的傳說裝備（Ping 11-15 照天堂M 透視鏡的數值；遊戲沒有的能力換成最接近的，見 NZ_EN 下方說明）
    afk_nz_deos_pants: { n: '戴歐斯的褲子', legend: true, type: 'arm', slot: 'shin', ac: 8, mhp: 200, nzIgn: 2, req: 'all', nzReq: ['royal', 'dark', 'dragon', 'darkknight', 'paladin'], safe: 4, maxEn: 14, weight: 100, p: 300000, img: ICO + '戴歐斯的褲子.webp', d: '黑暗王子戴歐斯的褲子。造成的傷害 +2%（無視傷害減少）。強化 +5 起每 +1 力量 +1，+14 時力量 +10。' },
    afk_nz_deos_boots: { n: '戴歐斯的長靴', legend: true, type: 'arm', slot: 'boots', ac: 8, mhp: 100, nzIgn: 2, req: 'elf', nzReq: ['elf'], safe: 4, maxEn: 14, p: 300000, img: ICO + '戴歐斯的長靴.webp', d: '黑暗王子戴歐斯的長靴。造成的傷害 +2%（無視傷害減少）。強化 +5 起每 +1 敏捷 +1，+14 時敏捷 +10。' },
    afk_nz_belial_black: { n: '貝利亞爾的黑色翅膀', legend: true, type: 'arm', slot: 'cloak', ac: 7, mhp: 150, meleeDmg: 5, meleeHit: 3, nzStunHit: 2, req: 'all', nzReq: ['royal', 'knight', 'dark', 'dragon', 'warrior', 'berserker', 'thunder', 'paladin', 'darkknight', 'runeblade'], safe: 4, maxEn: 14, p: 300000, img: ICO + '貝利亞爾的黑色翅膀.webp', d: '貪婪的貝利亞爾的黑色翅膀，近戰職業用。強化 +5 起每 +1 力量 +1，+14 時力量 +10。昏迷命中 +2（衝擊之暈這類昏迷技能比較容易成功）。' },
    afk_nz_belial_purple: { n: '貝利亞爾的紫色翅膀', legend: true, type: 'arm', slot: 'cloak', ac: 5, mhp: 100, mdmg: 5, magicHit: 3, nzCastSpd: 3, req: 'mage,knight', nzReq: ['mage', 'paladin'], safe: 4, maxEn: 14, p: 300000, img: ICO + '貝利亞爾的紫色翅膀.webp', d: '貪婪的貝利亞爾的紫色翅膀，法師、神聖劍士用。強化 +5 起每 +1 智力 +1，+14 時智力 +10。施法速度 +3%。' },
    afk_nz_belial_ring: { n: '貝利亞爾的戒指', legend: true, type: 'acc', slot: 'ring', ac: 3, stunResist: 5, req: 'all', safe: 0, maxEn: 8, p: 300000, img: ICO + '貝利亞爾的戒指.webp', d: '貪婪的貝利亞爾的戒指。昏迷抗性 +5%。強化 +1～+4 每階 HP +20；+5～+8 每階近距離／遠距離命中、近距離／遠距離傷害、魔攻各 +1，造成的傷害 +1%。' },
    afk_nz_isabe_ear: { n: '伊莎貝的耳環', legend: true, type: 'acc', slot: 'ear', ac: 5, nzIgn: 3, nzEnvy: 3, req: 'all', safe: 0, maxEn: 8, p: 300000, img: ICO + '伊莎貝的耳環.webp', d: '嫉妒的公主伊莎貝的耳環。造成的傷害 +3%（無視傷害減免）。強化 +1～+4 每階 HP +20；+5～+8 每階造成的傷害 +1%、藥水恢復量 +2%。「嫉妒」：攻擊命中時 3% 機率讓目標 5 秒內受到的傷害 +10%。' },
    afk_nz_isabe_brace: { n: '伊莎貝的手環', legend: true, type: 'acc', slot: 'bracelet', ac: 4, str: 2, meleeHit: 4, moveSpeedPct: 7, nzDoubt: 3, req: 'all', safe: 0, maxEn: 8, p: 300000, img: ICO + '伊莎貝的手環.webp', d: '嫉妒的公主伊莎貝的手環（轉生後的手環欄位）。近距離命中 +4（無視近距離迴避）、移動速度 +7%。強化 +5～+8 每階近距離爆擊 +1、攻擊速度 +1%。「猜忌」：受到攻擊時 3% 機率讓攻擊者 2 秒內無法攻擊。' },
    afk_nz_lazel_str: { n: '拉澤爾的力量項鍊', legend: true, type: 'acc', slot: 'amulet', ac: 4, str: 3, meleeHit: 3, stunResist: 7, paralyzeResist: 5, sleepResist: 5, req: 'all', safe: 0, maxEn: 8, p: 300000, img: ICO + '拉澤爾的力量項鍊.webp', d: '監視者拉澤爾的項鍊。力量 +3、近距離命中 +3（無視近距離迴避）、昏迷抗性 +7%。恐怖抗性 +5%（遊戲沒有恐怖，算成麻痺、睡眠抵抗 +5%）。' },
    afk_nz_lazel_dex: { n: '拉澤爾的敏捷項鍊', legend: true, type: 'acc', slot: 'amulet', ac: 4, dex: 3, rangedHit: 3, stunResist: 7, paralyzeResist: 5, sleepResist: 5, req: 'all', safe: 0, maxEn: 8, p: 300000, img: ICO + '拉澤爾的敏捷項鍊.webp', d: '監視者拉澤爾的項鍊。敏捷 +3、遠距離命中 +3、昏迷抗性 +7%（敏捷版的數值官方資料不完整，照力量版對稱）。恐怖抗性 +5%（遊戲沒有恐怖，算成麻痺、睡眠抵抗 +5%）。' },
    afk_nz_belief_guard: { n: '信念的臂甲', legend: true, type: 'arm', slot: 'shield', ac: 5, meleeDmg: 3, armguard: { stat: 'none', base: 0, th: [0, 0, 0] }, nzRangedDR: 5, nzFaith: 2, req: 'all', safe: 4, maxEn: 14, p: 300000, img: ICO + '信念的臂甲.webp', d: '信念之塔的王掉落的臂甲（裝在副手，可以跟雙手武器一起用）。近距離傷害 +3。強化到 +14，每 +1 AC −1。受到的遠距離傷害 −5%（強化 +10 起每 +1 再 −1%，+14 時 −10%）。「信念」：受到攻擊時 2% 機率，3 秒內受到的傷害 −30%。' },
    // 冰之女王的耳環（遺物）：只在單人副本「冰之女王的宮殿」打倒冰魔後給（Ping 11-15）
    relic_icequeen_ear: { noRiftRelic: true, n: '冰之女王的耳環', type: 'acc', slot: 'ear', relic: true, noEnhance: true, ac: 1, mhp: 20, mmp: 10, hpR: 4, mpR: 2, str: 1, dex: 1, int: 1, req: 'all', p: 10000, img: ICO + '冰之女王的耳環.webp', d: '【遺物】冰之女王一直戴著的耳環，冰晶裡封著她的寒氣。只有在冰之女王的宮殿打倒冰魔才拿得到。' },
  };
  Object.keys(NEWI).forEach(function (id) {
    if (DB.items[id]) return; var x = Object.assign({ gachaWeight: 0 }, NEWI[id]);
    if (x.type === 'etc') { x.p = x.p || 0; x.noUse = true; x.noSell = true; x.weight = 0; }
    if (!x.img) delete x.img;
    DB.items[id] = x;
  });
  // ── 新裝備的職業限制、強化加成 ──
  // nzReq：照天堂M 的職業清單（覺醒職業另外列，例如神聖劍士可以、一般騎士不行）
  if (typeof W.checkCanEquip === 'function') {
    var oCanNz = W.checkCanEquip;
    W.checkCanEquip = function (item) {
      var p = player, d = item && DB.items[item.id];
      if (d && d.nzReq) return !!(p && d.nzReq.indexOf(p.cls) >= 0);
      return oCanNz.apply(this, arguments);
    };
  }
  var clampN = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  // 每件的強化加成（en＝強化值）；nzIgn＝造成的傷害 +%（天堂M 的「無視傷害減免」，遊戲沒有這個能力，換成傷害加成）
  var NZ_EN = {
    afk_nz_deos_pants: function (en) { return { str: clampN(en - 4, 0, 10) }; },
    afk_nz_deos_boots: function (en) { return { dex: clampN(en - 4, 0, 10) }; },
    afk_nz_belial_black: function (en) { return { str: clampN(en - 4, 0, 10) }; },
    afk_nz_belial_purple: function (en) { return { int: clampN(en - 4, 0, 10) }; },
    afk_nz_belial_ring: function (en) { var a = clampN(en, 0, 4), b = clampN(en - 4, 0, 4); return { mhp: a * 20, meleeHit: b, rangedHit: b, meleeDmg: b, rangedDmg: b, mdmg: b, nzIgn: b }; },
    afk_nz_isabe_ear: function (en) { var a = clampN(en, 0, 4), b = clampN(en - 4, 0, 4); return { mhp: a * 20, nzIgn: b, potionBonus: b * 2 }; },
    afk_nz_isabe_brace: function (en) { var b = clampN(en - 4, 0, 4); return { meleeCrit: b, atkSpdPct: b }; },
    afk_nz_belief_guard: function (en) { var e = clampN(en, 0, 14); return { ac: e, mhp: -e * 10, nzRangedDR: clampN(en - 9, 0, 5) }; }   // 臂甲本來每 +1 給 HP +10，這件改成 AC −1
  };
  var enBonus = function (it) { var f = it && NZ_EN[it.id]; return f ? f(Math.max(0, Number(it.en) || 0)) : null; };
  var vdef = {};
  var withEnDefs = function (p, fn) {
    var swaps = [];
    try {
      Object.keys((p && p.eq) || {}).forEach(function (k) {
        var it = p.eq[k], b = enBonus(it); if (!b) return;
        var vid = it.id + '~nzen' + (Number(it.en) || 0);
        if (!vdef[vid]) { var d = JSON.parse(JSON.stringify(DB.items[it.id])); Object.keys(b).forEach(function (f) { if (f !== 'nzIgn' && f !== 'potionBonus' && !/^nz/.test(f)) d[f] = (Number(d[f]) || 0) + b[f]; }); vdef[vid] = d; }
        Object.defineProperty(DB.items, vid, { value: vdef[vid], writable: true, configurable: true, enumerable: false });
        swaps.push([it, it.id]); it.id = vid;
      });
      return fn();
    } finally { swaps.forEach(function (s) { s[0].id = s[1]; }); }
  };
  if (typeof W.recomputeStats === 'function') {
    var oRecNz = W.recomputeStats;
    W.recomputeStats = function () { var p = player, self = this, a = arguments; return withEnDefs(p, function () { return oRecNz.apply(self, a); }); };
  }
  var sumNz = function (p, f) { var v = 0; Object.keys((p && p.eq) || {}).forEach(function (k) { var it = p.eq[k], d = it && DB.items[it.id]; if (!d) return; v += Number(d[f]) || 0; var b = enBonus(it); if (b && b[f]) v += b[f]; }); return v; };
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPotNz = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPotNz.apply(this, arguments); try { var p = player; Object.keys(p.eq || {}).forEach(function (k) { var b = enBonus(p.eq[k]); if (b && b.potionBonus) v += b.potionBonus; }); } catch (e) {} return v; };
  }
  var hookNzDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkNzIgn) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try { if (r > 0 && actor === player) { var v = sumNz(player, 'nzIgn'); if (v > 0) r = Math.max(1, Math.floor(r * (1 + v / 100))); } } catch (e) {}
      return r;
    };
    C.__afkNzIgn = true;
  };
  hookNzDmg(); W.addEventListener('load', hookNzDmg);
  // 信念之塔裝備的特殊效果（Ping 11-15 04:53「製作」）：嫉妒、猜忌、信念、遠距離減傷、昏迷命中、施法速度
  var nzNow = function () { return Date.now(); };
  var nzMobOk = function (m) { return !!(m && !m._dead && m.curHp > 0); };
  var nzRanged = function (m) { return !!(m && /弓|射手|弩|投擲|狙擊|槍手/.test(m.n || '')); };
  var nzLog = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'player-special'); } catch (e) {} };
  var hookNzEv = function () {
    var g = W.LineageGrowth; if (!g || typeof g.event !== 'function' || g.__afkNzEv) return; var o = g.event;
    g.event = function (name, c) {
      try { if (name === 'beforeHit' && c && c.target && (c.target._nzEnvy || 0) > nzNow()) c.damage = Number(c.damage) * 1.1; } catch (e) {}
      var r = o.apply(this, arguments);
      try {
        if (name === 'afterHit' && c && c.actor && nzMobOk(c.target) && c.actor.eq) {
          var v = sumNz(c.actor, 'nzEnvy'); if (v > 0 && Math.random() * 100 < v) { if (!((c.target._nzEnvy || 0) > nzNow())) nzLog('<span class="font-bold" style="color:#4ade80">【嫉妒】</span>' + (c.target.n || '') + '受到的傷害 +10%（5 秒）。'); c.target._nzEnvy = nzNow() + 5000; }
        }
      } catch (e) {}
      return r;
    };
    g.__afkNzEv = true;
  };
  hookNzEv(); W.addEventListener('load', hookNzEv);
  var hookNzTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkNzTaken) return; W.__afkNzTaken = true;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = o.apply(this, arguments);
      try {
        if (!(v > 0) || !ent || !ent.eq) return v;
        if ((ent._nzFaith || 0) > nzNow()) v = Math.floor(v * 0.7);
        if (nzRanged(mob)) { var dr = sumNz(ent, 'nzRangedDR'); if (dr > 0) v = Math.floor(v * (1 - dr / 100)); }
        var fa = sumNz(ent, 'nzFaith'); if (fa > 0 && Math.random() * 100 < fa && !((ent._nzFaith || 0) > nzNow())) { ent._nzFaith = nzNow() + 3000; nzLog('<span class="font-bold" style="color:#fde68a">【信念】</span>3 秒內受到的傷害 −30%。'); }
        var dt = sumNz(ent, 'nzDoubt'); if (dt > 0 && nzMobOk(mob) && Math.random() * 100 < dt) { mob._atkCd = Math.max(Number(mob._atkCd) || 0, 20); try { var api = W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; if (api && api.status) api.status(mob, 'attackDelay', 2, 1); } catch (e2) {} nzLog('<span class="font-bold" style="color:#86efac">【猜忌】</span>' + (mob.n || '') + ' 2 秒內無法攻擊。'); }
      } catch (e) {}
      return v;
    };
  };
  hookNzTaken(); W.addEventListener('load', hookNzTaken);
  if (typeof W.applyMobStatus === 'function') {   // 昏迷命中：每 +1 ≈ 命中率 +5%（同 st.hitOff）
    var oAms = W.applyMobStatus;
    W.applyMobStatus = function (m, st) {
      try { if (st && st.kind === 'stun' && !st.force) { var h = sumNz(player, 'nzStunHit'); if (h > 0) arguments[1] = Object.assign({}, st, { hitOff: (Number(st.hitOff) || 0) + h }); } } catch (e) {}
      return oAms.apply(this, arguments);
    };
  }
  if (typeof W.getAutoCastInterval === 'function') {   // 施法速度 +%
    var oAci = W.getAutoCastInterval;
    W.getAutoCastInterval = function (actor) { var v = oAci.apply(this, arguments); try { var c = sumNz(actor || player, 'nzCastSpd'); if (c > 0 && v > 0) v = v * (1 - c / 100); } catch (e) {} return v; };
  }
  // 收藏：新裝備進「裝備收集冊」、新遺物進「遺物收集冊」
  try {
    var ECI = GET('EQUIP_CAT_ITEMS'), EIC = GET('EQUIP_ITEM_CAT'), RCI = GET('RELIC_CAT_ITEMS'), RIC = GET('RELIC_ITEM_CAT');
    Object.keys(NEWI).forEach(function (id) {
      var d = DB.items[id]; if (!d || !/^(wpn|arm|acc)$/.test(d.type) || typeof equipCatKey !== 'function') return;
      var ck = equipCatKey(id, d), rel = !!d.relic, C = rel ? RCI : ECI, I = rel ? RIC : EIC;
      if (!ck || !C || !C[ck] || C[ck].indexOf(id) >= 0) return;
      C[ck].push(id); if (I) I[id] = ck;
    });
  } catch (e) {}
  try { if (typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS.relic_true_dk_flameblade) WEAPON_TAGS.relic_true_dk_flameblade = ['單手劍']; } catch (e) {}   // 遺物合成的第二、第三詞綴照單手劍抽
  // 技能：暗影衝擊（黑暗妖精的衝擊之暈）、精靈之暈（妖精的衝擊之暈，要拿弓）
  if (DB.skills) {
    if (!DB.skills.sk_dark_shadowstun) DB.skills.sk_dark_shadowstun = { n: '暗影衝擊', type: 'atk', tier: 1, reqD: 60, mp: 12, dmgType: 'physical', skillAddDmg: 10, stunChance: 0.1, stun: 150, img: ICO + '暗影衝擊.webp', d: '黑暗妖精版的衝擊之暈：一擊之後有機會讓目標昏迷。' };
    if (!DB.skills.sk_elf_spiritstun) DB.skills.sk_elf_spiritstun = { n: '精靈之暈', type: 'atk', tier: 1, reqE: 60, mp: 12, dmgType: 'physical', ranged: true, reqWpn: 'bow', skillAddDmg: 10, stunChance: 0.1, stun: 150, img: ICO + '精靈之暈.webp', d: '妖精版的衝擊之暈（要拿弓）：一箭之後有機會讓目標昏迷。' };
  }
  // 雪壁營地周邊：面甲（古龍的聖地）、長靴（凝固的熔岩地帶）、手套（崩塌的雪壁）；聖地戒指（遺物）三張都掉
  DROPS.snow1 = [['afk_nz_guard_helm', 0.02], ['relic_nz_sanct_ring', 0.01]];
  DROPS.snow2 = [['afk_nz_dragon_boots', 0.02], ['relic_nz_sanct_ring', 0.01]];
  DROPS.snow3 = [['afk_nz_wyvern_gloves', 0.02], ['relic_nz_sanct_ring', 0.01]];
  [['snow_sanctum', 'snow1'], ['snow_lava', 'snow2'], ['snow_collapse', 'snow3']].forEach(function (x) { if (ZBY[x[0]]) ZBY[x[0]].drops = x[1]; });
  // ── 新角色（王）：外觀先借現有怪物，之後換專屬圖 ──
  var BOSS = {
    deos: ['黑暗王子戴歐斯', 'pride_vander_boss', '闇黑的騎士范德', 86], belial: ['貪婪的貝利亞爾', 'nm_034', '惡魔', 88], isabe: ['嫉妒的公主伊莎貝', 'afk_ttmi_207', '思克巴女皇', 90], lazel: ['監視者拉澤爾', 'pride_reaper_boss', '邪惡的鐮刀死神', 92],
    klein: ['爆走的克萊恩', 'afk_ttmi_100', '漆黑的食人妖精王', 86], talos: ['暗黑領主塔洛斯', 'dark_spirit_king', '闇精靈王', 88], gorogus: ['守門將哥洛古斯', 'pride_irongolem', '恐怖的鋼鐵高崙', 90], dektos: ['教父戴克托斯', 'afk_traitor_dantes', '冥皇丹特斯', 92],
    leo1: ['火龍的雷歐', 'afk_ttmi_30', '深紅飛龍', 68], leo2: ['火龍的火燒雷歐', 'cr_lindvior_m2', '災厄的飛龍', 70], leo3: ['火龍的紅雷歐', 'sanct_wyvern', '翼龍', 72],
    dreamlord: ['夢幻的支配者', 'de_king_heruby', '冥法軍王海露拜', 68],
    s_gate: ['惡靈守門人', 'iv_spirit', '象牙塔惡靈', 72], s_exec: ['執行者巴羅卡勒', 'de_train_soulknight', '魂騎士', 75], s_chaos: ['混亂的威里諾', 'chaos_priest_beast', '混沌的司祭(野獸)', 78], s_mammon: ['屍魂的曼孟', 'afk_ttmi_41', '哈蒙將軍的怨靈', 80], s_beast: ['百獸王卡諾圖', 'de_king_baranka', '魔獸軍王巴蘭卡', 82], s_andrea: ['魔王安德雷亞', 'afk_ttmi_114', '炎魔', 86],
    nemesis: ['封印的涅默西斯', 'afk_ttmi_50', '泰坦高崙', 90]
  };
  var BID = {};
  // GPT 做好的專屬動畫（Ping 11-15）：assets/anim/<王的名字>/idle、attack、hurt、death 各 4／4／2／4 張
  var OWN_ART = {};
  ['黑暗王子戴歐斯', '貪婪的貝利亞爾', '嫉妒的公主伊莎貝', '監視者拉澤爾', '爆走的克萊恩', '暗黑領主塔洛斯', '守門將哥洛古斯', '教父戴克托斯',
   '火龍的雷歐', '火龍的火燒雷歐', '火龍的紅雷歐', '夢幻的支配者', '惡靈守門人', '執行者巴羅卡勒', '混亂的威里諾', '屍魂的曼孟', '百獸王卡諾圖', '魔王安德雷亞', '封印的涅默西斯']
    .forEach(function (n) { OWN_ART[n] = 1; });
  var GETG = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
  var ownArt = function (n) {
    var names = GETG('MOB_ANIM_NAMES'), alias = GETG('MOB_ANIM_ALIAS'); if (!names) return;
    names.add(n); if (alias) delete alias[n];
  };
  Object.keys(BOSS).forEach(function (k) {
    var b = BOSS[k], src = DB.mobs[b[1]]; if (!src) return;
    var id = 'afk_nzb_' + k, m = DB.mobs[clone(b[1], b[3], null, '_b_' + k)];
    m = JSON.parse(JSON.stringify(m)); m.n = b[0]; m.boss = true; m.hp = Math.round(m.hp * 8); m.exp = Math.round(m.exp * 5); m._nzBoss = true;
    DB.mobs[id] = m; BID[k] = id;
    try { if (OWN_ART[b[0]]) ownArt(b[0]); else if (L && L.aliasAnim) L.aliasAnim(b[0], b[2]); } catch (e) {}
  });

  // ── 城堡地監：擁有那座城才能進 ──
  var CASTLE_N = { kent: '肯特城', orc_fortress: '妖魔堡', windwood: '風木城' };
  var holds = function (c) { try { var CW = W.__afkCastleWar; return !!(CW && CW.held && CW.held().indexOf(c) >= 0); } catch (e) { return false; } };

  var gateWhy = function (p, z) {
    if (!p) return '沒有角色';
    if (p.classicMode) return '經典模式沒有這張地圖';
    if (z.sandhell && !sandOpen()) return '沙地獄現在沒有開';
    var g = z.gate; if (!g) return '';
    if (g.castle && !holds(g.castle)) return '要擁有' + CASTLE_N[g.castle] + '才能進去';
    return '';
  };
  if (typeof W.changeMap === 'function') {
    var oCM = W.changeMap;
    W.changeMap = function (force) {
      var p = P(), el = document.getElementById('map-select'), tgt = el ? el.value : '', z = ZBY[tgt];
      if (!force && z && tgt !== cur()) {
        var why = gateWhy(p, z);
        if (why) { try { syncMapSelectors(); } catch (e) {} sys('<span class="text-red-400">' + esc(z.n) + '：' + esc(why) + '。</span>'); return; }
      }
      return oCM.apply(this, arguments);
    };
    try { (0, eval)('changeMap = window.changeMap'); } catch (e) {}
  }
  if (typeof W.mapOptDisabled === 'function') {
    var oDis = W.mapOptDisabled;
    W.mapOptDisabled = function (def) { var z = def && ZBY[def.v]; if (z && def.v !== cur() && gateWhy(P(), z)) return true; return oDis.apply(this, arguments); };
    try { (0, eval)('mapOptDisabled = window.mapOptDisabled'); } catch (e) {}
  }
  setInterval(function () {
    var z = ZBY[cur()]; if (!z || !P()) return;
    if (z.sandhell && !sandOpen()) { sys('<span class="text-amber-300">沙地獄的入口關上了，你被沙子推回地面。</span>'); try { setMapSelectors('petra_oasis'); changeMap(true); saveGame(); } catch (e) {} }
  }, 1000);

  // ── 涅默西斯（古代兵器涅默西斯駐紮地的王；出現規則跟地圖王一樣，屬隱藏規則） ──
  var nemRec = function (p) { p.afkNz = p.afkNz || {}; p.afkNz.nem = p.afkNz.nem || { k: 0, life: 0, roll: 0, lucky: 0 }; return p.afkNz.nem; };
  var nemOn = function () { return mobs().some(function (m) { return m && !m._dead && m.curHp > 0 && m._nzNem; }); };

  // ========================================================================
  // 單人副本（Ping 22:24：夢域鏡／次元裂縫兩種難度；每個副本（樓層）每天一次；傭兵留在隊伍、副本裡不出場）
  // ========================================================================
  var COST = { dream: { n: '夢域鏡', amt: 1000, cur: '龍鑽' }, rift: { n: '次元裂縫', amt: 500, cur: '血龍鑽' } };
  var mode = function () { var p = P(); if (!p) return null; try { if (W.__afkDimRiftOn && W.__afkDimRiftOn()) return 'rift'; } catch (e) {} return (p.sherineDream && p.sherineMad) ? 'dream' : null; };
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var waves = function (mobsList, lv, weak, n, k) { var a = []; for (var i = 1; i <= n; i++) a.push({ n: '第 ' + i + ' 波', mobs: mobsList, lv: lv, weak: weak, k: k }); return a; };
  var BELIEF = [
    [1, 72, null, ['pride_earth_king', 'pride_water_king', 'pride_wind_king', 'pride_fire_king', 'afk_ttmi_103', 'afk_ttmi_104', 'afk_ttmi_105', 'afk_ttmi_106'], 'deos'],
    [2, 78, 'wind', ['afk_ttmi_18', 'afk_ttmi_19', 'afk_ttmi_20', 'afk_ttmi_21'], 'belial'],
    [3, 81, 'none', ['afk_ttmi_162', 'afk_ttmi_163', 'afk_ttmi_164', 'afk_ttmi_165', 'afk_ttmi_166'], 'isabe'],
    [4, 84, 'water', ['afk_ttmi_169', 'afk_ttmi_170', 'afk_ttmi_171', 'afk_ttmi_172', 'afk_ttmi_173', 'afk_ttmi_175'], 'lazel']
  ];
  var RUIN = [
    [1, 80, 'earth', nm(['r_evil', 'r_cruel', 'r_violent', 'r_hungry']).concat(['afk_ttmi_177', 'afk_ttmi_179']), 'klein'],
    [2, 82, null, ['afk_ttmi_204', 'afk_ttmi_205', 'afk_ttmi_206', 'afk_ttmi_207'], 'talos'],
    [3, 85, 'fire', ['afk_ttmi_181', 'afk_ttmi_210', 'afk_ttmi_211', 'afk_ttmi_212'], 'gorogus'],
    [4, 87, 'fire', ['afk_ttmi_181', 'afk_ttmi_211', 'afk_ttmi_212', 'afk_ttmi_214', 'afk_ttmi_192'], 'dektos']
  ];
  var SOLO = [];
  BELIEF.forEach(function (f) { SOLO.push({ id: 'belief' + f[0], group: 'belief', n: '信念之塔' + f[0] + '樓', town: 'town_pride', lv: 68, rooms: waves(f[3], f[1], f[2], 10, 30), final: [f[4]] }); });
  RUIN.forEach(function (f) { SOLO.push({ id: 'ruin' + f[0], group: 'ruin', n: '破滅的奇岩地監' + f[0] + '樓', town: 'town_giran', lv: 80, rooms: waves(f[3], f[1], f[2], 10, 30), final: [f[4]] }); });
  SOLO.push(
    { id: 'ice', group: 'ice', n: '冰之女王的宮殿', town: 'town_oren', lv: 52, pick: [['ice_demon', '冰魔'], ['ice_queen', '冰之女王']],
      rooms: [{ n: '侍女的廳', lv: 60, mobs: ['ice_maid', 'afk_ttmi_59', 'afk_ttmi_61'], k: 8 }, { n: '禁衛兵的迴廊', lv: 62, mobs: ['afk_ttmi_57', 'afk_ttmi_58', 'afk_ttmi_60'], k: 8 }, { n: '雪怪的冰窟', lv: 64, mobs: ['nm_020', 'afk_ttmi_59', 'afk_ttmi_60'], k: 6 }],
      reward: function (r) { var a = []; if (r.pick === 'ice_demon') { a.push(give('mat_ice_crystal', 1)); if (Math.random() < 0.05) a.push(give('relic_icequeen_ear', 1)); } return a; } },
    { id: 'central', group: 'central', n: '中央寺院', town: 'town_aden', lv: 50, unicorn: true,
      rooms: [{ n: '第一回合', lv: 58, mobs: ['pride_medusa', 'pride_earth_king'], k: 10 }, { n: '第二回合', lv: 60, mobs: ['pride_medusa', 'pride_water_king', 'pride_wind_king'], k: 10 }, { n: '第三回合', lv: 62, mobs: ['pride_medusa', 'pride_fire_king'], k: 10 }],
      final: ['dreamlord'],
      reward: function () { var a = []; if (Math.random() < 0.3) a.push(give('mat_unicorn_horn', 1)); if (Math.random() < 0.1) a.push(give(['ttmi_14388', 'ttmi_14389', 'ttmi_14390', 'ttmi_14391'][Math.floor(Math.random() * 4)], 1)); return a; } },
    { id: 'firedragon', group: 'firedragon', n: '火龍巢穴', town: 'town_witon', lv: 60,
      rooms: [{ n: '第一區', lv: 65, mobs: ['fire_archer', 'fire_warrior', 'salamander', 'fire_egg'], k: 10, boss: ['leo1'] }, { n: '第二區', lv: 68, mobs: ['lava_golem', 'ashitakio', 'fire_beast'], k: 10, boss: ['leo2'] }, { n: '第三區', lv: 70, mobs: ['fire_warrior', 'lava_golem', 'fire_beast', 'ashitakio'], k: 10, boss: ['leo3'] }],
      finalRand: ['ifrit', 'phoenix', 'valakas'] },
    { id: 'soul', group: 'soul', n: '屍魂塔', town: 'town_gludio', lv: 1,
      rooms: [{ n: '第一層', lv: 70, mobs: ['afk_ttmi_184', 'afk_ttmi_185', 'afk_ttmi_142'], k: 8, boss: ['s_gate'] }, { n: '第二層', lv: 73, mobs: ['afk_ttmi_187', 'afk_ttmi_188'], k: 8, boss: ['s_exec'] }, { n: '第三層', lv: 76, mobs: ['afk_ttmi_66', 'afk_ttmi_67', 'afk_ttmi_68'], k: 8, boss: ['s_chaos'] }, { n: '隱藏的房間', lv: 78, mobs: ['afk_ttmi_224', 'afk_ttmi_142'], k: 6, boss: ['s_mammon'], chance: 0.3 }, { n: '第四層', lv: 79, mobs: ['afk_ttmi_198', 'afk_ttmi_199', 'afk_ttmi_200', 'afk_ttmi_98'], k: 8, boss: ['s_beast'] }],
      final: ['s_andrea'] }
  );
  var NPCS = {
    belief: ['npc_nz_belief', '信念之塔的守門人', '信念之塔', '傲慢之塔旁的另一座塔。每一層要先撐過 10 波、每波 30 隻怪，才會見到那一層的王。每層每天只能挑戰一次。', ''],
    ruin: ['npc_nz_ruin', '破滅的奇岩地監 引路人', '破滅的奇岩地監', '被破壞的奇岩地監。每一層要先撐過 10 波、每波 30 隻怪，才會見到那一層的王。每層每天只能挑戰一次。', ''],
    ice: ['npc_nz_brand', '布朗德', '冰之女王的宮殿', '布朗德守著通往冰之女王宮殿的冰門。進去之後只能二選一：打冰魔，或打冰之女王。', '布朗德'],
    central: ['npc_nz_central', '中央寺院的守門人', '中央寺院', '亞丁地底的中央寺院。守護獨角獸撐過三回合（獨角獸倒下就失敗），就會見到寺院深處的夢幻的支配者。', '中央寺院的守門人'],
    firedragon: ['npc_nz_edenas', '愛德那斯', '火龍巢穴', '火龍窟深處的巢穴。分三區推進，每一區都會碰到一次火龍的雷歐；最深處是伊弗利特、不死鳥、巴拉卡斯其中一隻。', '愛德那斯'],
    soul: ['npc_nz_ezekiel', '天使艾澤奇爾', '屍魂塔', '妖魔森林邪惡神殿裡的屍魂塔。一層一層往上打，每層都有守層的王，最頂端是魔王安德雷亞。', '天使艾澤奇爾']
  };
  var SBY = {};
  SOLO.forEach(function (d) {
    SBY[d.id] = d; d.map = 'afk_solo_' + d.id;
    d.bg = BG + (d.group === 'belief' || d.group === 'ruin' ? d.n : d.n) + '.jpg';
    d.rooms.forEach(function (rm) { rm.pool = pool(rm.mobs, rm.lv, rm.weak); if (rm.boss) rm.bossIds = rm.boss.map(function (k) { return BID[k]; }).filter(Boolean); });
    if (d.final) d.finalIds = d.final.map(function (k) { return BID[k]; }).filter(Boolean);
    DB.maps[d.map] = d.rooms[0].pool.slice();
    try { var SAB2 = GET('SPECIAL_AREA_BG'); if (SAB2) SAB2[d.map] = d.bg; } catch (e) {}
    try { var SMN = GET('SANCTUARY_MAP_NAMES'); if (SMN) SMN[d.map] = d.n; } catch (e) {}
    W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([d.map]);
  });
  var give = function (id, n) { if (n > 0 && DB.items[id]) { try { gainItem(id, n, true, true); } catch (e) {} return (DB.items[id].n || id) + (n > 1 ? ' ×' + n : ''); } return ''; };
  var nzRec = function (p) { p.afkNz = p.afkNz || {}; p.afkNz.day = p.afkNz.day || {}; return p.afkNz; };
  var doneToday = function (p, d) { return nzRec(p).day[d.id] === dayKey(); };
  var soloWhy = function (d) {
    var p = P(); if (!p) return '沒有角色';
    if (p.classicMode) return '經典模式沒有這個副本';
    if (cur() !== d.town) return '要在' + ((DB.towns[d.town] || {}).n || '村莊');
    if (N(p.lv) < d.lv && N(p.rebirth) < 1) return '需要等級 ' + d.lv;
    if (doneToday(p, d)) return '今天已經挑戰過了（每天一次）';
    var md = mode(); if (!md) return '要先開啟夢域鏡或次元裂縫（難度跟著目前的世界模式）';
    var c = COST[md];
    if (md === 'dream') { var have = 0; try { have = N(W.pandoraGetSharedDiamonds()); } catch (e) {} if (have < c.amt) return '龍鑽不足，需要 ' + c.amt.toLocaleString(); }
    else { var G = W.LineageGrowth; if (!G || G.blood() < c.amt) return '血龍鑽不足，需要 ' + c.amt.toLocaleString(); }
    return '';
  };
  var pay = function (md) {
    var c = COST[md];
    if (md === 'dream') { var res = {}; try { res = W.pandoraAdjustSharedDiamonds(-c.amt) || {}; } catch (e) { res = { ok: false }; } return !!res.ok; }
    var G = W.LineageGrowth; try { G.transaction('單人副本入場', function () { G.spendBlood(c.amt); }); return true; } catch (e) { return false; }
  };
  // 傭兵：留在隊伍裡，副本裡暫時不出場（離開副本就回來；存檔裡也記著，讀檔時還原）
  var stashAllies = function (p) { var r = nzRec(p); if (!r.stash && (p.allies || []).length) { r.stash = p.allies; p.allies = []; } };
  var restoreAllies = function (p) { var r = nzRec(p); if (r.stash) { p.allies = (p.allies || []).concat(r.stash); delete r.stash; try { updateUI(); } catch (e) {} } };
  var run = null;
  var showBattle = function () {
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden'); document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden'); document.getElementById('town-view').classList.remove('flex'); mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
  };
  // 守護獨角獸（中央寺院）
  var uniEl = null;
  var uniShow = function () {
    if (!run || !run.D.unicorn || run.phase === 'final') { if (uniEl) { uniEl.remove(); uniEl = null; } return; }
    var bv = document.getElementById('battle-view'); if (!bv) return;
    if (!uniEl || uniEl.parentElement !== bv) { uniEl = document.createElement('div'); uniEl.style.cssText = 'position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:30;background:rgba(15,23,42,.85);border:1px solid #fcd34d;border-radius:8px;padding:4px 12px;color:#fde68a;font-size:13px;pointer-events:none'; bv.appendChild(uniEl); }
    var hp = Math.max(0, run.uni);
    uniEl.innerHTML = '🦄 守護獨角獸 <b>' + Math.ceil(hp) + '%</b><div style="height:5px;background:#334155;border-radius:3px;margin-top:2px"><div style="height:5px;width:' + hp + '%;background:' + (hp > 30 ? '#fbbf24' : '#ef4444') + ';border-radius:3px"></div></div>';
  };
  var enter = function (id, pick) {
    var d = SBY[id], p = P(); if (!d) return; var why = soloWhy(d);
    if (why) { sys('<span class="text-amber-300">' + esc(d.n) + '：' + esc(why) + '</span>'); return; }
    var md = mode(); if (!pay(md)) { sys('<span class="text-red-400">' + esc(d.n) + '：入場費扣款失敗。</span>'); return; }
    nzRec(p).day[d.id] = dayKey();
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeTownFloatWindow === 'function') closeTownFloatWindow(); } catch (e) {}
    stashAllies(p);
    mapState.current = d.map; p.lastBattleMap = d.map;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null]; mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { id: id, D: d, md: md, pick: pick || null, ri: 0, spawned: 0, killed: 0, phase: 'room', bossSpawned: false, uni: 100 };
    sys('<span class="font-bold" style="color:#93c5fd">你走進了「' + esc(d.n) + '」（' + COST[md].n + '難度，' + COST[md].amt.toLocaleString() + ' ' + COST[md].cur + '）。【' + esc(d.rooms[0].n) + '】</span>');
    showBattle(); uniShow();
  };
  var leave = function (msg) {
    var d = run && run.D; run = null; uniShow(); if (msg) sys(msg);
    setTimeout(function () { var p = P(); try { if (d && cur() === d.map) { setMapSelectors(d.town); changeMap(true); } } catch (e) {} if (p) restoreAllies(p); try { saveGame(); } catch (e) {} }, 1500);
  };
  var finish = function () {
    var d = run.D, got = (d.reward ? d.reward(run) : []).filter(Boolean);
    leave('<span class="font-bold" style="color:#93c5fd">🏆 「' + esc(d.n) + '」通關。</span>' + (got.length ? '<span class="text-amber-200">得到：' + got.map(esc).join('、') + '</span>' : ''));
  };
  var oSpawn = W.spawnMob;
  var spawnInto = function (idx, ids, extra) {
    var d = run.D, keep = DB.maps[d.map];
    DB.maps[d.map] = ids;
    try { mobs()[idx] = null; oSpawn(idx); } catch (e) {}
    DB.maps[d.map] = keep;
    var m = mobs()[idx]; if (m && !m._dead) Object.assign(m, { _solo: true, noAutoTeleport: true }, extra || {});
    return m;
  };
  var bossesNow = function () {
    var d = run.D, rm = d.rooms[run.ri];
    if (run.phase === 'roomBoss') return rm.bossIds || [];
    if (d.pick) return [run.pick];
    if (d.finalRand) return [d.finalRand[Math.floor(Math.random() * d.finalRand.length)]];
    return d.finalIds || [];
  };
  if (typeof oSpawn === 'function') {
    W.spawnMob = function (idx) {
      var d = null; for (var k in SBY) if (SBY[k].map === cur()) d = SBY[k];
      if (!d) {
        // 涅默西斯
        var p0 = P();
        if (cur() === 'petra_nemesis' && p0 && !p0.classicMode && BID.nemesis) { var nr = nemRec(p0); if (nr.lucky && !nemOn() && idx === 1) { nr.lucky = 0; var keep = DB.maps.petra_nemesis; DB.maps.petra_nemesis = [BID.nemesis]; try { oSpawn.apply(this, arguments); } catch (e) {} DB.maps.petra_nemesis = keep; var nm = mobs()[idx]; if (nm) { nm._nzNem = true; nm._nzBoss = true; sys('<span class="font-bold" style="color:#fca5a5">👑 封印的涅默西斯甦醒了！</span>'); } return; } }
        return oSpawn.apply(this, arguments);
      }
      var ms = mobs(); if (ms[idx] && ms[idx]._dead) ms[idx] = null;
      if (!run || run.D !== d) { if (!run) leave(); return; }
      if (run.phase === 'roomBoss' || run.phase === 'final') {
        if (!run.bossSpawned && idx === 0) {
          run.bossSpawned = true; var bl = bossesNow();
          bl.forEach(function (bid, i) { var m = spawnInto([1, 0, 2, 3, 4][i], [bid], { boss: true, _nzBoss: true }); if (m) { try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {} } });
          sys('<span class="font-bold" style="color:#fca5a5">' + bl.map(function (b) { return esc((DB.mobs[b] || {}).n || b); }).join('、') + ' 現身了。</span>');
        }
        try { if (!S().ff) renderMobs(); } catch (e) {}
        return;
      }
      var rm = d.rooms[run.ri];
      if (run.spawned < rm.k) { if (spawnInto(idx, rm.pool)) run.spawned++; }
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  var alive = function () { return mobs().filter(function (x) { return x && !x._dead && x.curHp > 0 && x._solo; }); };
  var nextRoom = function () {
    var d = run.D;
    run.ri++; run.spawned = 0; run.killed = 0; run.bossSpawned = false; run.phase = 'room';
    while (run.ri < d.rooms.length && d.rooms[run.ri].chance && Math.random() >= d.rooms[run.ri].chance) run.ri++;   // 隱藏的房間：有機率才出現
    if (run.ri >= d.rooms.length) {
      if (d.pick || d.finalRand || (d.finalIds && d.finalIds.length)) { run.phase = 'final'; sys('<span style="color:#fca5a5">最深處……</span>'); }
      else { finish(); return; }
    } else sys('<span style="color:#93c5fd">【' + esc(d.rooms[run.ri].n) + '】</span>');
    var t0 = N(S().ticks); mapState.spawnAt = [t0 + 20, t0 + 25, t0 + 30, t0 + 35, t0 + 40];
    uniShow();
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], was = !!(m && m._dead), r = oKill.apply(this, arguments);
      try {
        if (m && !was && m._dead) {
          var p = P();
          // 涅默西斯的出現計數（跟地圖王同一套：300 隻出現；累計 3000 隻後每 100 隻 1%）
          if (cur() === 'petra_nemesis' && p && !m.boss && !m._nzNem) {
            var nr = nemRec(p); nr.life++;
            if (nr.life > 3000) { if (!nemOn() && !nr.lucky && ++nr.roll >= 100) { nr.roll = 0; if (Math.random() < 0.01) nr.lucky = 1; } }
            else if (++nr.k >= 300) { nr.k = 0; nr.lucky = 1; }
          }
          if (m._solo && run && cur() === run.D.map) {
            if (run.phase === 'roomBoss' || run.phase === 'final') {
              if (!alive().length) { if (run.phase === 'final') finish(); else nextRoom(); }
            } else {
              run.killed++;
              var rm = run.D.rooms[run.ri];
              if (run.killed >= rm.k && !alive().length) {
                if (rm.bossIds && rm.bossIds.length) { run.phase = 'roomBoss'; run.bossSpawned = false; var t1 = N(S().ticks); mapState.spawnAt = [t1 + 20, t1 + 25, t1 + 30, t1 + 35, t1 + 40]; }
                else nextRoom();
              }
            }
          }
        }
      } catch (e) { console.warn('[AFK-newzones] kill', e); }
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  // 獨角獸：每秒被場上的怪圍攻（每隻 0.5%）；倒下就失敗
  setInterval(function () {
    if (!run || !run.D.unicorn || run.phase === 'final' || cur() !== run.D.map) return;
    var n = alive().length; if (n) { run.uni -= n * 0.5; uniShow(); }
    if (run.uni <= 0) leave('<span class="text-red-400 font-bold">守護獨角獸倒下了……中央寺院的挑戰失敗。</span>');
  }, 1000);
  // 離開副本地圖（死亡回村、手動換地圖）就結束；傭兵回到隊伍
  setInterval(function () {
    var p = P(); if (!p) return;
    if (run && cur() !== run.D.map) { sys('<span class="text-slate-400">你離開了「' + esc(run.D.n) + '」。</span>'); run = null; uniShow(); }
    if (!run && p.afkNz && p.afkNz.stash) { var inSolo = false; for (var k in SBY) if (cur() === SBY[k].map) inSolo = true; if (!inSolo) restoreAllies(p); }
  }, 1000);
  if (typeof W.loadGame === 'function') { var oLoad = W.loadGame; W.loadGame = function () { var r = oLoad.apply(this, arguments); setTimeout(function () { var p = P(); for (var k in SBY) if (cur() === SBY[k].map && !run) { try { setMapSelectors(SBY[k].town); changeMap(true); } catch (e) {} } if (p) restoreAllies(p); }, 300); return r; }; }

  // ── 掉落：地圖額外掉落＋單人副本的王 ──
  var BOSS_DROP = {
    dream: [['afk_aw_myth_frag', 0.1], ['afk_legend_codex', 0.1]],   // 碎片 0.1%（Ping 11-14 23:37）
    rift: [['afk_aw_myth_lost', 0.01], ['afk_myth_codex', 0.1]],
    all: [['bk_dark_shadowstun', 1], ['bk_elf_spiritstun', 1]]
  };
  var SPECIAL = {   // 個別的王另外掉的遺物、裝備
    '惡靈守門人': [['relic_soul_helm', 1]], '執行者巴羅卡勒': [['relic_soul_gloves', 1]], '混亂的威里諾': [['relic_soul_boots', 1]], '百獸王卡諾圖': [['relic_soul_armor', 1]], '魔王安德雷亞': [['relic_soul_cloak', 1]],
    '伊弗利特': [['relic_true_dk_flameblade', 1]], '不死鳥': [['relic_true_dk_flameblade', 1]], '巴拉卡斯': [['relic_true_dk_flameblade', 1]],
    '黑暗王子戴歐斯': [['afk_nz_deos_pants', 1], ['afk_nz_deos_boots', 1], ['afk_nz_belief_guard', 1]],
    '貪婪的貝利亞爾': [['afk_nz_belial_black', 1], ['afk_nz_belial_purple', 1], ['afk_nz_belial_ring', 1], ['afk_nz_belief_guard', 1]],
    '嫉妒的公主伊莎貝': [['afk_nz_isabe_ear', 1], ['afk_nz_isabe_brace', 1], ['afk_nz_belief_guard', 1]],
    '監視者拉澤爾': [['afk_nz_lazel_str', 1], ['afk_nz_lazel_dex', 1], ['afk_nz_belief_guard', 1]],
    '封印的涅默西斯': [['relic_worldtree_ring', 1], ['bk_aw_runeblade_trinity', 1], ['bk_aw_runeblade_illusion2', 1]]
  };
  var oFilt = W.__afkDropListFilter;
  W.__afkDropListFilter = function (mob, list) {
    var l = list;
    if (typeof oFilt === 'function') { try { l = oFilt.apply(this, arguments) || list; } catch (e) {} }
    if (!mob) return l;
    var add = [];
    var z = ZBY[cur()]; if (z && z.drops && DROPS[z.drops] && !mob._solo) add = add.concat(DROPS[z.drops]);
    if (mob._solo && (mob._nzBoss || mob.boss) && run) { add = add.concat(BOSS_DROP[run.md] || [], BOSS_DROP.all); if (SPECIAL[mob.n]) add = add.concat(SPECIAL[mob.n]); }
    if (mob._nzNem) add = add.concat(SPECIAL['封印的涅默西斯']);
    if (mob._rdBoss && cur() === 'afk_riftdg') add = add.concat(BOSS_DROP.rift, BOSS_DROP.all);   // 次元裂縫的多人副本王：跟單人副本（次元裂縫難度）的王一樣
    add = add.filter(function (e) { return DB.items[e[0]]; });
    return add.length ? l.concat(add) : l;
  };
  // 掉落查詢、小百科：這些是程式發的掉落（__afkDropListFilter），掉落表裡沒有 → 登記到 AFK_DEX_EXTRA（Ping 11-15 上線檢查）
  var dexReg = function () {
    var X = W.AFK_DEX_EXTRA; if (!X || !X.drop || X.__nz) return; X.__nz = true;
    var nm = function (id) { return (DB.items[id] && DB.items[id].n) || id; };
    var soloBoss = Object.keys(BOSS).filter(function (k) { return k !== 'nemesis'; }).map(function (k) { return BOSS[k][0]; }).concat(['伊弗利特', '不死鳥', '巴拉卡斯', '冰魔', '冰之女王']);
    soloBoss.forEach(function (n) {
      BOSS_DROP.dream.forEach(function (e) { X.drop(n, e[0], e[1], '單人副本・夢域鏡難度', true); });
      BOSS_DROP.rift.forEach(function (e) { X.drop(n, e[0], e[1], '單人副本・次元裂縫難度', true); });
      BOSS_DROP.all.forEach(function (e) { X.drop(n, e[0], e[1], '單人副本', true); });
    });
    Object.keys(SPECIAL).forEach(function (n) { SPECIAL[n].forEach(function (e) { X.drop(n, e[0], e[1], n === '封印的涅默西斯' ? '古代兵器涅默西斯駐紮地' : '單人副本', true); }); });
    X.drop('冰魔', 'relic_icequeen_ear', 5, '冰之女王的宮殿', true);
    var by = {};
    var add = function (id, t) { (by[id] = by[id] || []).push(t); };
    Object.keys(SPECIAL).forEach(function (n) { SPECIAL[n].forEach(function (e) { add(e[0], n + '（' + (n === '封印的涅默西斯' ? '古代兵器涅默西斯駐紮地的地圖王' : '單人副本的王') + '）' + e[1] + '%'); }); });
    add('relic_icequeen_ear', '冰之女王的宮殿（單人副本）打倒冰魔 5%');
    add('afk_aw_myth_frag', '單人副本（夢域鏡難度）的王 0.1%；100 片在覺醒導師合成失去光芒的覺醒職業 神話法術書');
    add('afk_legend_codex', '單人副本（夢域鏡難度）的王 0.1%');
    add('afk_aw_myth_lost', '單人副本（次元裂縫難度）的王、次元裂縫的多人副本王 0.01%；也可以在覺醒導師用碎片 100 片合成');
    add('afk_myth_codex', '單人副本（次元裂縫難度）的王、次元裂縫的多人副本王 0.1%');
    ['bk_dark_shadowstun', 'bk_elf_spiritstun'].forEach(function (id) { add(id, '單人副本的王、次元裂縫的多人副本王 1%'); });
    Object.keys(DROPS).forEach(function (k) {
      var zs = Object.keys(ZBY).filter(function (zid) { return ZBY[zid].drops === k; }).map(function (zid) { return ZBY[zid].n; });
      if (!zs.length) return;
      DROPS[k].forEach(function (e) { if (DB.items[e[0]] && !/^relic_|^afk_nz_|^bk_/.test(e[0]) ) return; add(e[0], zs.join('、') + '的怪 ' + e[1] + '%'); });
    });
    Object.keys(by).forEach(function (id) { if (DB.items[id] && !X.acquire[id]) X.acq(id, by[id].join('；') + '。'); });
  };
  if (document.readyState === 'complete') setTimeout(dexReg, 0); else W.addEventListener('load', dexReg);
  // 收藏圖鑑：新物品、地圖額外掉落登記為「可取得」
  try {
    var OM = GET('OBTAINABLE_MISC'), all = [];
    Object.keys(DROPS).forEach(function (k) { all = all.concat(DROPS[k]); }); all = all.concat(BOSS_DROP.dream, BOSS_DROP.rift, BOSS_DROP.all); Object.keys(SPECIAL).forEach(function (k) { all = all.concat(SPECIAL[k]); });
    all.forEach(function (e) { if (OM && DB.items[e[0]] && /^(etc|skillbk|misc)$/.test(DB.items[e[0]].type || '')) OM[e[0]] = true; });
    var MCI = GET('MISC_CAT_ITEMS'); if (MCI && typeof MCI === 'object') ['afk_aw_myth_frag', 'afk_aw_myth_lost', 'afk_myth_codex', 'afk_legend_codex', 'bk_dark_shadowstun', 'bk_elf_spiritstun'].forEach(function (id) { var cat = DB.items[id].type === 'skillbk' ? (MCI.skillbk ? 'skillbk' : null) : (MCI.etc ? 'etc' : null); if (cat && Array.isArray(MCI[cat]) && MCI[cat].indexOf(id) < 0) MCI[cat].push(id); });
  } catch (e) {}

  // 雪壁營地三家商店分開賣（Ping 11-15）：沙林雜貨、泰勒卷軸、凱森武器防具
  try {
    var SL = GET('SHOP_LISTS');
    if (SL) {
      SL.npc_nz_salin = ['potion_heal', 'potion_strong', 'potion_ult', 'potion_blue', 'potion_haste', 'potion_brave', 'new_item_140', 'new_item_139', 'wpn_5', 'wpn_22', 'candle'];
      SL.npc_nz_tyler = ['scroll_teleport', 'scroll_revive', 'scroll_poly', 'scroll_magicbarrier'];
      SL.npc_nz_kesen = (SL.npc_wino || []).concat(SL.npc_vangil || []);
    }
  } catch (e) {}
  // ── NPC ──
  var art = function (f) { return f ? '<img src="assets/npc-art/' + encodeURIComponent(f) + '.webp" alt="" style="float:right;width:120px;max-height:180px;object-fit:contain;margin:0 0 6px 10px" onerror="this.remove()">' : ''; };
  var renderNpc = function (g) {
    return function (box) {
      if (!box) return; try { if (K && K.css) K.css(); } catch (e) {}
      var info = NPCS[g], p = P(), md = mode(), list = SOLO.filter(function (d) { return d.group === g; });
      var h = '<div class="afk-ax">' + art(info[4]) + '<p class="ax-lore">' + esc(info[3]) + '</p>'
        + '<div class="ax-desc">難度跟著目前的世界模式：<b>夢域鏡</b> 入場 1,000 龍鑽；<b>次元裂縫</b> 入場 500 血龍鑽。目前：' + (md ? '<b style="color:#fde68a">' + COST[md].n + '</b>' : '<span style="color:#fca5a5">沒有開啟夢域鏡或次元裂縫</span>') + '</div>'
        + '<div class="ax-desc">單人副本：只有你自己進去，傭兵留在隊伍裡、離開副本就回來。死亡、換地圖就結束。每個副本（每層）每天一次。</div>';
      list.forEach(function (d) {
        var why = soloWhy(d), flow = d.rooms.filter(function (r) { return !r.chance; }).length + ' 段';
        if (d.group === 'belief' || d.group === 'ruin') flow = '10 波 × 30 隻 → ' + esc((DB.mobs[d.finalIds && d.finalIds[0]] || {}).n || '王');
        h += '<div class="ax-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px"><div><div class="ax-name">' + esc(d.n) + '</div><div class="ax-desc">' + (d.lv > 1 ? 'Lv' + d.lv + ' 以上　' : '') + flow + (why ? '　<span style="color:#fca5a5">' + esc(why) + '</span>' : '') + '</div></div><div style="display:flex;gap:6px">'
          + (d.pick ? d.pick.map(function (x) { return '<button type="button" data-nz-go="' + d.id + '" data-nz-pick="' + x[0] + '"' + (why ? ' disabled' : '') + '>挑戰' + esc(x[1]) + '</button>'; }).join('') : '<button type="button" data-nz-go="' + d.id + '"' + (why ? ' disabled' : '') + '>進入</button>')
          + '</div></div>';
      });
      box.innerHTML = h + '</div>';
    };
  };
  Object.keys(NPCS).forEach(function (g) {
    var info = NPCS[g], d0 = SOLO.filter(function (d) { return d.group === g; })[0]; if (!d0) return;
    var def = { id: info[0], n: info[1], title: info[2], type: 'quest', classicHide: true, d: info[3] };
    if (L && L.addNpc) L.addNpc(d0.town, def, null); else if (K && K.addNpc) K.addNpc(d0.town, def, null);
    try { var SPR2 = GET('NPC_SPR_FIXED'); if (SPR2 && !SPR2[info[0]] && SPR2.npc_dragon_valakas) SPR2[info[0]] = SPR2.npc_dragon_valakas; } catch (e) {}
    if (K && K.hookNpc) K.hookNpc(info[0], info[1], info[2], renderNpc(g));
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nz-go]'); if (!b) return;
    e.preventDefault(); enter(b.getAttribute('data-nz-go'), b.getAttribute('data-nz-pick'));
  });

  // ── 覺醒導師：神話法術書的合成與兌換 ──
  var AW = W.__afkAwaken;
  if (AW && AW.tabs) {
    var cnt = function (id) { try { return questCountId(id); } catch (e) { return 0; } };
    var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
    var books = function (p, tier) { return Object.keys(AW.SK).map(function (k) { return AW.SK[k]; }).filter(function (s) { return s.tier === tier && s.cls === p.cls; }).map(function (s) { return { bk: 'bk_aw_' + s.cls + '_' + s.key, n: s.n }; }).filter(function (b) { return DB.items[b.bk]; }); };
    AW.tabs.push({ id: 'mythbook', label: '神話法術書', show: function () { return true; }, render: function (p) {
      var h = '<div class="ax-desc">覺醒職業 神話法術書碎片 ×100 → 失去光芒的覺醒職業 神話法術書 ×1。</div>'
        + '<div class="ax-desc">持有：碎片 ' + cnt('afk_aw_myth_frag') + '、失去光芒的法術書 ' + cnt('afk_aw_myth_lost') + '、神話技能秘笈 ' + cnt('afk_myth_codex') + '、傳說技能秘笈 ' + cnt('afk_legend_codex') + '</div>'
        + '<div style="margin:6px 0"><button type="button" data-aw-x="mbfuse"' + (cnt('afk_aw_myth_frag') < 100 ? ' disabled' : '') + '>合成 1 本</button></div>';
      if (!AW.isAw(p)) return h + '<div class="ax-note">覺醒之後才能兌換自己職業的法術書。</div>';
      [['神話', 'afk_myth_codex'], ['傳說', 'afk_legend_codex']].forEach(function (t) {
        h += '<div class="ax-name" style="margin-top:8px">' + t[0] + '法術書（失去光芒的法術書 ×10＋' + DB.items[t[1]].n + ' ×1；學習時另需原本的學習材料）</div>';
        books(p, t[0]).forEach(function (b) { var ok = cnt('afk_aw_myth_lost') >= 10 && cnt(t[1]) >= 1; h += '<div class="ax-row" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>' + esc(b.n) + '</span><button type="button" data-aw-x="mbswap" data-aw-arg="' + b.bk + '|' + t[1] + '"' + (ok ? '' : ' disabled') + '>兌換</button></div>'; });
      });
      return h;
    }, click: function (x, arg) {
      if (x === 'mbfuse') { if (cnt('afk_aw_myth_frag') < 100) return '碎片不足 100'; take('afk_aw_myth_frag', 100); give('afk_aw_myth_lost', 1); try { saveGame(); } catch (e) {} return '合成了 1 本失去光芒的覺醒職業 神話法術書。'; }
      if (x === 'mbswap') { var a = String(arg || '').split('|'), bk = a[0], cx = a[1]; if (!DB.items[bk] || !DB.items[cx]) return '找不到法術書'; if (cnt('afk_aw_myth_lost') < 10 || cnt(cx) < 1) return '材料不足'; take('afk_aw_myth_lost', 10); take(cx, 1); give(bk, 1); try { saveGame(); } catch (e) {} return '換到了 ' + DB.items[bk].n + '。'; }
    } });
  }

  // ── 王者卡冊：新地區 19 隻王（第三個分頁「王者・新地區」；卡面先用 GPT 動畫的待機圖）──
  var NZ_CARD = {}, NZ_WHERE = { deos: '信念之塔 1 樓', belial: '信念之塔 2 樓', isabe: '信念之塔 3 樓', lazel: '信念之塔 4 樓', klein: '破滅的奇岩地監 1 樓', talos: '破滅的奇岩地監 2 樓', gorogus: '破滅的奇岩地監 3 樓', dektos: '破滅的奇岩地監 4 樓',
    leo1: '火龍巢穴 第一區', leo2: '火龍巢穴 第二區', leo3: '火龍巢穴 第三區', dreamlord: '中央寺院', s_gate: '屍魂塔 第一層', s_exec: '屍魂塔 第二層', s_chaos: '屍魂塔 第三層', s_mammon: '屍魂塔 隱藏房間（30%）', s_beast: '屍魂塔 第四層', s_andrea: '屍魂塔 頂端', nemesis: '古代兵器涅默西斯駐紮地（跟地圖王一樣的出現規則）' };
  Object.keys(BOSS).forEach(function (k) { NZ_CARD[BOSS[k][0]] = { id: 'nz_' + k, n: BOSS[k][0], type: 'nz', maps: [], where: NZ_WHERE[k] || '', card: 'assets/bosscard/nz_' + k + '.png', sil: 'assets/bosscard/nz_' + k + '_sil.png' }; });   // sil：未遇見時的剪影（卡面是不透明底，直接變黑會整張黑）
  try { if (W.__afkBossCard && W.__afkBossCard.register) W.__afkBossCard.register(Object.keys(NZ_CARD).map(function (n) { return NZ_CARD[n]; })); } catch (e) {}
  if (typeof W.killMob === 'function') {
    var oKillBc = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], was = !!(m && m._dead), r = oKillBc.apply(this, arguments);
      try { if (m && !was && m._dead && (m._nzBoss || m._nzNem) && NZ_CARD[m.n] && W.__afkBossCardKill) W.__afkBossCardKill(NZ_CARD[m.n], m); } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }

  // ── 小百科「新地區副本」分頁（afk-wiki 讀 W.__afkNewZones.wiki）──
  var wEsc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var wTbl = function (h, rows) { return '<div style="overflow-x:auto"><table class="m-wiki-tbl"><thead><tr>' + h.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; };
  var wCard = function (t, body) { return '<div class="m-wiki-card"><div class="m-wiki-name">' + wEsc(t) + '</div>' + body + '</div>'; };
  var wLi = function (x) { return '<div class="m-wiki-desc" style="margin-top:4px;">・' + x + '</div>'; };
  var ELE_N = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' };
  var mobN = function (id) { var b = Object.keys(BOSS).filter(function (k) { return k === id; })[0]; if (b) return BOSS[b][0]; var m = DB.mobs[id]; return m ? m.n : id; };
  var itemN = function (id) { var d = DB.items[id]; return d ? d.n : id; };
  var uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
  var dropTxt = function (list) { return (list || []).filter(function (e) { return DB.items[e[0]]; }).map(function (e) { return wEsc(itemN(e[0])) + ' ' + e[1] + '%'; }).join('、'); };
  var mapN = function (k) { var t = TOWNS[k]; if (t) return t.n; var m = DB.maps && DB.maps[k]; return (m && m.n) || ({ town_pride: '傲慢之塔', town_giran: '奇岩村', town_oren: '歐瑞村', town_aden: '亞丁城鎮', town_witon: '威頓村', town_gludio: '古魯丁村' })[k] || k; };
  var wiki = function (H) {
    if (H && typeof H.tbl === 'function') wTbl = H.tbl;
    var h = '<div class="m-wiki-note">佩特拉、雪壁營地、城堡地監，以及信念之塔、破滅的奇岩地監、冰之女王的宮殿、中央寺院、火龍巢穴、屍魂塔六個單人副本。地圖從「移動」選單選，單人副本找入口的 NPC。</div>';
    // 野外與地監
    var rows = ZONES.map(function (z) {
      var gate = z.gate && z.gate.castle ? '要擁有' + ({ kent: '肯特城', orc_fortress: '妖魔堡', windwood: '風木城' }[z.gate.castle] || z.gate.castle) : '';
      return [wEsc(z.n), z.cat === 'dungeon' ? '地監' : '野外', 'Lv' + z.lv, z.weak ? '弱' + (ELE_N[z.weak] || z.weak) : '—', wEsc(uniq(z.mobs.map(mobN)).join('、')), (z.drops && DROPS[z.drops] ? dropTxt(DROPS[z.drops]) : '—') + (gate ? '<br><b>' + gate + '</b>' : '')];
    });
    h += wCard('地圖一覽', wTbl(['地圖', '類型', '怪物等級', '弱點', '怪物', '額外掉落／進入條件'], rows) + wLi('城堡地監沒有時數限制，要擁有那座城才能進去。') + wLi('「封印的涅默西斯」在古代兵器涅默西斯駐紮地：打倒 300 隻一般怪出現；累計 3,000 隻以後改成每 100 隻 1%。'));
    // 村莊
    h += wCard('村莊', wTbl(['村莊', 'NPC'], Object.keys(TOWNS).map(function (k) { var t = TOWNS[k]; return [wEsc(t.n), wEsc((t.npcs || []).map(function (n) { return n.n + (n.title ? '（' + n.title + '）' : ''); }).join('、'))]; })));
    // 單人副本共通
    h += wCard('單人副本：共通規則', [
      '難度跟著目前的世界模式：<b>夢域鏡</b>入場 ' + COST.dream.amt.toLocaleString() + ' 龍鑽、<b>次元裂縫</b>入場 ' + COST.rift.amt.toLocaleString() + ' 血龍鑽；兩種都沒開就不能進。',
      '每個副本每天一次；信念之塔、破滅的奇岩地監是每一層各一次。',
      '傭兵不用解散：進副本時留在隊伍裡、暫時不出場，離開副本就回來。',
      '副本的王一律掉：夢域鏡 ' + dropTxt(BOSS_DROP.dream) + '；次元裂縫 ' + dropTxt(BOSS_DROP.rift) + '；兩種都有 ' + dropTxt(BOSS_DROP.all) + '。'
    ].map(wLi).join(''));
    // 各副本
    var groups = {}; SOLO.forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    Object.keys(NPCS).forEach(function (g) {
      var info = NPCS[g], list = groups[g] || []; if (!list.length) return;
      var body = wLi('入口：' + wEsc(mapN(list[0].town)) + '的「' + wEsc(info[1]) + '」。') + wLi(wEsc(info[3]));
      var r2 = [];
      list.forEach(function (d) {
        var rooms = d.rooms || [], bosses = [];
        rooms.forEach(function (rm) { (rm.boss || []).forEach(function (b) { bosses.push(BOSS[b] ? BOSS[b][0] : mobN(b)); }); });
        var fin = (d.final || []).map(function (b) { return BOSS[b] ? BOSS[b][0] : mobN(b); }).concat((d.finalRand || []).length ? [(d.finalRand || []).map(mobN).join('／') + '（三選一）'] : []).concat((d.pick || []).length ? [d.pick.map(function (x) { return x[1]; }).join('或') + '（進去後二選一）'] : []);
        var mobsAll = uniq([].concat.apply([], rooms.map(function (rm) { return rm.mobs || []; })).map(mobN));
        r2.push([wEsc(d.n), rooms.length + (d.group === 'belief' || d.group === 'ruin' ? ' 波（每波 ' + (rooms[0] && rooms[0].k) + ' 隻）' : ' 區'), wEsc(mobsAll.join('、')), wEsc(bosses.concat(fin).join('、'))]);
      });
      body += wTbl(['副本', '進度', '怪物', '王'], r2);
      h += wCard(info[2], body);
    });
    // 王的個別掉落
    h += wCard('王的個別掉落', wTbl(['王', '掉落'], Object.keys(SPECIAL).map(function (n) { return [wEsc(n), dropTxt(SPECIAL[n])]; })) + wLi('冰之女王的宮殿打倒冰魔：' + wEsc(itemN('relic_icequeen_ear')) + ' 5%。'));
    // 新裝備
    var eq = Object.keys(NEWI).filter(function (id) { var d = DB.items[id]; return d && /^(wpn|arm|acc)$/.test(d.type); });
    h += wCard('新裝備與遺物', wTbl(['物品', '說明'], eq.map(function (id) { var d = DB.items[id]; return ['<b>' + wEsc(d.n) + '</b>', wEsc(d.d || '')]; })));
    return h;
  };

  W.__afkNewZones = { soloWhy: soloWhy, leave: leave, wiki: wiki, NZ_CARD: NZ_CARD, ZONES: ZONES, ZBY: ZBY, TOWNS: TOWNS, SOLO: SOLO, SBY: SBY, DROPS: DROPS, BOSS_DROP: BOSS_DROP, BID: BID, clone: clone, sandOpen: sandOpen, mode: mode, enter: enter, run: function () { return run; }, nemRec: nemRec, holds: holds };
})();
