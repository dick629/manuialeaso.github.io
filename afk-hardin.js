/* ============================================================================
 * afk-hardin.js — 支線「知識與背叛」（Lv20～70）＋哈汀的時空（隊伍副本）＋四色／哈汀之影重做
 *   （玩家 2026-10-29；企劃 docs/lore-expansion-plan.md B2、C2～C5、D）
 *
 *   發派：象牙塔新 NPC「魔法師 喬」（哈汀的弟子，後來投向特羅斯）。7 章，照順序：
 *     1 Lv20 日記的另一半　　說話之島地監 1～2 樓（骷髏、骷髏弓箭手、骷髏斧手、骷髏槍兵、人形殭屍、長老）燒焦的研究筆記 ×5 → 封印師的長靴
 *     2 Lv25 說話之島的地底　巴風特　　封印的碎片 ×1　→ 祝福的盔甲卷軸
 *     3 Lv30 四色的命令　　　卡士柏、巴土瑟、西瑪、馬庫爾 各一張命令書 → 歐林的研究腰帶（法師另得 西瑪之帽）
 *     4 Lv40 七樓的隱者　　　古魯丁地監 7 樓（食人妖精、食人妖精王、地獄犬、楊果里恩、食屍鬼、史巴托）歐林的鍊金殘渣 ×6 → 歐林的項鍊＋歐林的日記本
 *                            完成後，大魔法師 歐林 每 30 分鐘在古魯丁地監 7 樓出現一次，可以向他「請教」
 *     5 Lv50 活祭品　　　　　賽尼斯(首領)　水之精靈的淚 ×3 → 哈汀的長袍
 *     6 Lv60 哈汀之影　　　　哈汀之影　哈汀之影的殘響 ×3 → 哈汀的斗篷＋黑暗哈汀的日記本
 *     7 Lv70 哈汀的時空　　　大魔法師 哈汀（副本最後的頭目）碎裂的時空沙漏 ×1 → 哈汀的禁書
 *     哈汀的遺產（封印師的長靴、歐林的研究腰帶、哈汀的長袍、哈汀的斗篷）：
 *       2 件 最大 MP +50、魔防 +5；3 件 再 魔法傷害 +1、額外命中 +2；4 件 再 額外傷害 +2、最大 HP +100、MP 回復 +3
 *
 *   哈汀的時空（隊伍副本，喬 → 從前的說話之島地底；接了第 7 章就能進，次數不限，每天第一次通關給印記）：
 *     12 波魔界怪 → 第 6 波後二選一（阻止封印儀式＝黑翼賽尼斯／讓儀式完成＝失控的巴風特；30 秒沒選就讓儀式完成）
 *     → 第 12 波後出現選的頭目 → 大魔法師 哈汀
 *     頭目與小怪的 HP ×（1 ＋ 0.25 × 進場時活著的傭兵數）
 *     通關：每天第一次 哈汀的魔法印記 ×1、魔法結晶體 ×30；第一次走「阻止封印儀式」通關另得 賽尼斯的淚滴耳環
 *     喬用印記換：魔法結晶體、黑暗哈汀的日記本、歐林的日記本、哈汀的禁書、賽尼斯的淚滴耳環
 *
 *   Boss：
 *     歐林 Lv58：四元素齊射（每 12 秒，火／地／風／水各一發單體）、鍊金護壁（HP 70%／35%，10 秒受到傷害 −50%）、時間停止（每 40 秒冰凍 HP 最高的一人）
 *     黑翼賽尼斯 Lv72：伊娃的淚（全體水）、魅惑（每 30 秒一名傭兵 5 秒內改打自己人）、活祭品的詛咒（每少 25% HP，你的最大 HP −5%，打完為止）、黑翼（HP 30% 飛起 6 秒，近戰打不到）
 *     失控的巴風特 Lv72：地裂術／震裂術、惡魔契約（每 25 秒召喚 3 隻魔界的骷髏）、失控（HP 50%：攻速 +50%、受到傷害 +20%）
 *     大魔法師 哈汀 Lv80：黑魔法領域（全體必中）、禁咒・永生（第一次倒下以 30% HP 復活）、
 *       弟子的影子（HP 75% 火／50% 地＋風／25% 冰，影子活著時哈汀受到傷害 −50%）、知識的代價（每 45 秒全體封印魔法＋吸取 10% MP）
 *   既有 Boss 重做：
 *     四色：各多一招全體魔法；連攜（同圖另一位四色還活著，受到傷害 −20%）；剩最後一位時狂暴（攻速 +30%）
 *     哈汀之影：HP 50% 分出影分身（本體 30% HP），影分身倒下前本體不受傷害
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit;
  if (T && T.register) T.register({ id: 'lorehardin', name: '支線劇情「知識與背叛」與哈汀的時空', group: '遊戲內容',
    desc: '象牙塔魔法師喬發派的哈汀支線 Lv20～70（7 章，獎勵哈汀的遺產套裝）；隊伍副本「哈汀的時空」；大魔法師歐林；四色、哈汀之影技能重做' });
  if (T && !T.enabled('lorehardin')) return;
  if (!L || !K || typeof DB === 'undefined' || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var IC = function (p) { return 'assets/icons/' + p + '.png'; };
  var esc = L.esc, sys = L.sys, clog = L.clog, B = L.boss;
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var CRYSTAL = (function () { try { return W.AFK_TTMI_ITEMS.resolve(7102) || null; } catch (e) { return null; } })();
  var alive = function (m) { return !!(m && !m._dead && m.curHp > 0); };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var NPC_ID = 'npc_afk_joe', NPC_N = '魔法師 喬', TOWN = 'town_ivory_tower';
  var MAP = 'afk_hardin_time', MAP_N = '哈汀的時空－從前的說話之島地底';

  // ── 裝備 ──
  var SET_TXT = '【哈汀的遺產】2 件：最大 MP +50、魔防 +5；3 件：再 魔法傷害 +1、額外命中 +2；4 件：再 額外傷害 +2、最大 HP +100、MP 回復 +3。';
  var SET = ['afk_hd_boots', 'afk_hd_belt', 'afk_hd_robe', 'afk_hd_cloak'];
  var gear = {
    afk_hd_boots: { n: '封印師的長靴', type: 'arm', slot: 'boots', ac: 4, er: 3, mr: 6, mpR: 2, safe: 6, img: IC('armors/影子長靴'), d: '說話之島地底封印陣旁找到的長靴，鞋底畫著封印符文。AC 4、迴避 +3、魔防 +6、MP 回復 +2。' },
    afk_hd_belt: { n: '歐林的研究腰帶', type: 'acc', slot: 'belt', ac: 2, mr: 5, mhp: 50, mmp: 50, safe: 5, img: IC('accessories/水精靈的皮帶'), d: '歐林掛滿試管與筆記的腰帶。AC 2、魔防 +5、最大 HP +50、最大 MP +50。' },
    afk_hd_robe: { n: '哈汀的長袍', type: 'arm', slot: 'armor', ac: 9, mr: 12, dr: 3, mpR: 3, mdmg: 1, safe: 6, img: IC('armors/古老的長袍'), d: '哈汀年輕時在象牙塔穿的長袍，袖口還沾著當年的祭壇灰。AC 9、魔防 +12、傷害減免 +3、MP 回復 +3、魔法傷害 +1。' },
    afk_hd_cloak: { n: '哈汀的斗篷', type: 'arm', slot: 'cloak', ac: 4, mr: 10, er: 1, mdmg: 1, safe: 6, img: IC('armors/幻術士斗篷'), d: '哈汀之影消散後留下的斗篷，摸起來像影子一樣冰冷。AC 4、魔防 +10、迴避 +1、魔法傷害 +1。' },
    afk_hd_tome: { n: '哈汀的禁書', type: 'acc', slot: 'amulet', ac: 2, mr: 10, mmp: 60, mpR: 10, mdmg: 3, extraHit: 1, extraDmg: 1, safe: 5, c: 'text-fuchsia-300', img: IC('items/受詛咒的精靈書'),
      d: '大魔法師哈汀追求永生寫下的禁書，用鎖鏈綁在身上。AC 2、魔防 +10、最大 MP +60、MP 回復 +10、魔法傷害 +3、額外命中 +1、額外傷害 +1。' },
    afk_hd_tear: { n: '賽尼斯的淚滴耳環', type: 'acc', slot: 'ear', ac: 2, mr: 10, mhp: 80, mmp: 40, resWater: 10, safe: 5, c: 'text-sky-300', img: IC('accessories/受困幽魂的淚滴'),
      d: '你阻止了那一晚的封印儀式。賽尼斯的眼淚凝成了一對耳環。AC 2、魔防 +10、最大 HP +80、最大 MP +40、水屬性抗性 +10。' }
  };
  Object.keys(gear).forEach(function (id) { var g = gear[id]; g.c = g.c || 'text-violet-300'; g.p = 60000; g.req = 'all'; if (SET.indexOf(id) >= 0) g.d += SET_TXT; L.addItem(id, g); });
  L.defineSet({ name: '哈汀的遺產', ids: SET, tiers: [[2, { mmp: 50, mr: 5 }], [3, { mdmg: 1, extraHit: 2 }], [4, { extraDmg: 2, mhp: 100, mpR: 3 }]] });
  var MARK = 'afk_hd_mark';
  L.addItem(MARK, { n: '哈汀的魔法印記', type: 'etc', noUse: true, c: 'text-fuchsia-300', img: IC('items/冥法軍團印記'),
    d: '從哈汀的時空帶回來的魔法印記，每天第一次通關得到 1 個。可以交給象牙塔的魔法師 喬 交換物品。' });

  // ── 新怪物 ──
  var mk = function (id, def, anim) { return L.addMob(id, Object.assign({ s: 'L', beh: '主動', goldMin: 0, goldMax: 0 }, def), anim); };
  mk('afk_hd_orin', { n: '大魔法師 歐林', lv: 58, boss: true, race: '法師', e: 'none', hp: 18000, ac: -55, mr: 90, exp: 4000, goldMin: 800, goldMax: 2000,
    atkSpd: 1.8, dmg: [3, 30], db: 40, hit: 65, afkHd: 'orin', mag: { skn: '光箭', cd: 40, chance: 0.5, dmg: [2, 60], db: 80, ele: 'none' } }, '魔法師喬');
  mk('afk_hd_senis', { n: '黑翼賽尼斯', lv: 72, boss: true, race: '人形', e: 'water', hp: 45000, ac: -60, mr: 100, exp: 9000, goldMin: 2000, goldMax: 5000,
    atkSpd: 1.5, dmg: [3, 35], db: 60, hit: 80, afkHd: 'senis',
    mag: { skn: '伊娃的淚', cd: 150, dmg: [4, 40], db: 120, ele: 'water', alwaysHit: true },
    mag2: { skn: '黑翼冰矛', cd: 60, chance: 0.5, dmg: [3, 60], db: 100, ele: 'water', sec: { type: 'freeze', pbase: 100 } } }, '魔女賽尼斯');
  mk('afk_hd_baph', { n: '失控的巴風特', lv: 72, boss: true, race: '惡魔', e: 'earth', hp: 60000, ac: -70, mr: 80, exp: 9000, goldMin: 2000, goldMax: 5000,
    atkSpd: 1.5, dmg: [4, 50], db: 90, hit: 80, afkHd: 'baph',
    mag: { skn: '地裂術', cd: 50, chance: 0.5, dmg: [3, 153], db: 230, ele: 'earth' }, mag2: { skn: '震裂術', cd: 60, chance: 0.4, dmg: [6, 76], db: 230, ele: 'earth' } }, '巴風特');
  mk('afk_hd_hardin', { n: '大魔法師 哈汀', lv: 80, boss: true, race: '法師', e: 'none', hp: 90000, ac: -80, mr: 120, exp: 15000, goldMin: 3000, goldMax: 8000,
    atkSpd: 2, dmg: [3, 50], db: 100, hit: 90, afkHd: 'hardin',
    mag: { skn: '黑魔法領域', cd: 100, dmg: [3, 120], db: 150, ele: 'none', alwaysHit: true },
    mag2: { skn: '禁忌之矢', cd: 60, chance: 0.5, dmg: [3, 80], db: 160, ele: 'none' } }, '哈汀之影');
  mk('afk_hd_skel', { n: '魔界的骷髏', lv: 60, race: '不死', un: true, e: 'earth', hp: 1500, ac: -30, mr: 30, exp: 600, atkSpd: 1.2, dmg: [2, 30], db: 40, hit: 60 }, '骷髏斧手');
  var SHADOWS = [
    ['afk_hd_sh_fire', '卡士柏之影', '卡士柏', 'fire', '燃燒的火球'],
    ['afk_hd_sh_earth', '巴土瑟之影', '巴土瑟', 'earth', '地裂術'],
    ['afk_hd_sh_wind', '西瑪之影', '西瑪', 'wind', '極光雷電'],
    ['afk_hd_sh_water', '馬庫爾之影', '馬庫爾', 'water', '冰錐']
  ];
  SHADOWS.forEach(function (s) {
    mk(s[0], { n: s[1], lv: 60, race: '幻影', e: s[3], hp: 5000, ac: -40, mr: 80, exp: 1500, atkSpd: 2, dmg: [2, 40], db: 40, hit: 70, afkHdShadow: true,
      mag: { skn: s[4], cd: 50, chance: 0.5, dmg: [2, 80], db: 80, ele: s[3] } }, s[2]);
  });
  if (DB.mobs.iv_hatin) mk('afk_hd_clone', Object.assign(JSON.parse(JSON.stringify(DB.mobs.iv_hatin)), { n: '哈汀之影的分身', exp: 500, afkHdClone: true }), '哈汀之影');
  try { ['伊娃的淚', '黑魔法領域', '知識的代價'].forEach(function (n) { MOB_PARTY_AOE_SKILLS.add(n); }); } catch (e) {}
  try {
    var TTMI = {}; try { (W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items || []).forEach(function (id) { TTMI[id] = 1; }); } catch (e) {}
    var cp = function (to, from) { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[to] && MOB_DROPS[from]) MOB_DROPS[to] = MOB_DROPS[from].filter(function (x) { return !TTMI[x[0]]; }).map(function (x) { return x.slice(); }); };   // 天堂透視鏡道具不複製（它自己依怪名掛掉落）
    cp('黑翼賽尼斯', '賽尼斯(首領)'); cp('失控的巴風特', '巴風特'); cp('大魔法師 哈汀', '哈汀之影'); cp('大魔法師 歐林', '食人妖精王');
  } catch (e) {}

  // ── 四色重做：多一招全體魔法 ──
  var FOUR = { sema: ['暴風之刃', 'wind'], batus: ['大地崩裂', 'earth'], casper: ['烈焰風暴', 'fire'], marcus: ['冰霜新星', 'water'] };
  Object.keys(FOUR).forEach(function (id) {
    var m = DB.mobs[id]; if (!m || m.mag2) return;
    m.mag2 = { skn: FOUR[id][0], cd: 150, chance: 0.5, dmg: [2, 60], db: 60, ele: FOUR[id][1] };
    if (id === 'marcus') m.mag2.sec = { type: 'freeze', pbase: 100 };
    try { MOB_PARTY_AOE_SKILLS.add(FOUR[id][0]); } catch (e) {}
  });
  var isFour = function (m) { return !!(m && m.race === '四色' && !m.afkHdShadow); };

  // ── 地圖：哈汀的時空 ──
  var POOL = ['iv_reaper', 'iv_shadow', 'iv_spirit', 'iv_baless', 'iv_flameslave', 'iv_imp', 'iv_baphomet', 'iv_wing', 'iv_flameshadow', 'iv_demonshadow'].filter(function (id) { return !!DB.mobs[id]; });
  var ELITE = DB.mobs.flame_demon ? 'flame_demon' : POOL[0];
  DB.maps[MAP] = POOL.concat([ELITE, 'afk_hd_senis', 'afk_hd_baph', 'afk_hd_hardin']);
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/地監深層.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '數十年前的說話之島地底。哈汀正準備用賽尼斯當活祭品，封印失控的巴風特。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = MAP_N; } catch (e) {}
  var WAVES = 12, CHOICE_AT = 6, CHOICE_WAIT = 300;

  // ── 任務線 ──
  var line = L.defineLine({
    id: 'hardin', name: '知識與背叛', hostIds: [], hostN: NPC_N,
    intro: '「我是喬，曾經是哈汀老師的學生……後來我跟了特羅斯殿下。老師留下的東西，比你想像的還要可怕。我想知道那一晚，說話之島地底到底發生了什麼事。」',
    outro: '「老師沒有死，他一直躲在時空的縫隙裡。至少現在我們知道真相了——賽尼斯恨的，從來不只是亞丁。」',
    chapters: [
      { lv: 20, title: '日記的另一半', map: '說話之島地監 1～2 樓', story: '喬拿出一本歐林的日記本，後半本被撕掉了。地監裡的不死者身上，還留著當年燒剩的研究筆記。',
        reqs: [{ id: 'afk_q_hd_note', n: '燒焦的研究筆記', img: IC('items/封印的歷史書第1頁'), d: '邊緣燒焦的研究筆記，字跡和歐林的日記本一模一樣。', need: 5, mobs: ['骷髏', '骷髏弓箭手', '骷髏斧手', '骷髏槍兵', '人形殭屍', '長老'] }],
        rewards: { all: ['afk_hd_boots'] }, first: CRYSTAL ? [[CRYSTAL, 50]] : [] },
      { lv: 25, title: '說話之島的地底', map: '說話之島地監 2 樓（巴風特）', story: '筆記寫著：「封印在地底，老師說不能讓任何人知道。」地監 2 樓的巴風特比記載的還要躁動——牠身上的封印正在鬆動。',
        reqs: [{ id: 'afk_q_hd_seal', n: '封印的碎片', img: IC('items/哀石碎片'), d: '從巴風特身上剝落的封印碎片，刻著哈汀的印。', need: 1, mobs: ['巴風特'] }],
        rewards: { all: ['scroll_armor_b'] }, first: [['scroll_armor_b', 2], ['gold', 100000]] },
      { lv: 30, title: '四色的命令', map: '古魯丁地監 3～4 樓（四色）', story: '火之卡士柏、地之巴土瑟、風之西瑪、冰之馬庫爾——哈汀的四名弟子，至今還守在古魯丁地監。他們懷裡揣著老師的命令書。',
        reqs: [
          { id: 'afk_q_hd_ord_fire', n: '卡士柏的命令書', img: IC('items/密封的情報書'), d: '蓋著哈汀之印的命令書：「找到歐林，不留活口。」', need: 1, mobs: ['卡士柏'] },
          { id: 'afk_q_hd_ord_earth', n: '巴土瑟的命令書', img: IC('items/密封的情報書'), d: '蓋著哈汀之印的命令書：「找到歐林，不留活口。」', need: 1, mobs: ['巴土瑟'] },
          { id: 'afk_q_hd_ord_wind', n: '西瑪的命令書', img: IC('items/密封的情報書'), d: '蓋著哈汀之印的命令書：「找到歐林，不留活口。」', need: 1, mobs: ['西瑪'] },
          { id: 'afk_q_hd_ord_water', n: '馬庫爾的命令書', img: IC('items/密封的情報書'), d: '蓋著哈汀之印的命令書：「找到歐林，不留活口。」', need: 1, mobs: ['馬庫爾'] }],
        rewards: { all: ['afk_hd_belt'], mage: ['arm_57'] }, first: [['scroll_weapon_b', 1]] },
      { lv: 40, title: '七樓的隱者', map: '古魯丁地監 7 樓', story: '四色追殺的歐林，就躲在古魯丁地監最深處。七樓的魔物身上沾著他的鍊金殘渣——跟著殘渣走，就能找到他。',
        reqs: [{ id: 'afk_q_hd_resid', n: '歐林的鍊金殘渣', img: IC('items/召喚球碎片'), d: '還在發熱的鍊金殘渣，散發著歐林慣用的藥草味。', need: 6, mobs: ['食人妖精', '食人妖精王', '地獄犬', '楊果里恩', '食屍鬼', '史巴托'] }],
        rewards: { all: ['acc_orin_amulet', 'item_olin_diary'] }, first: CRYSTAL ? [[CRYSTAL, 100]] : [],
        onDone: function () { sys('<span class="text-amber-200">歐林把日記的後半本交給你：「想知道更多，就到七樓來找我——讓我看看你值不值得。」（大魔法師 歐林 每 30 分鐘會在古魯丁地監 7 樓出現一次）</span>'); } },
      { lv: 50, title: '活祭品', map: '傲慢之塔 41～60 樓（賽尼斯）', story: '日記的後半本寫著：召喚失控的那一晚，老師把一名水之精靈推上了祭壇。她叫賽尼斯。她活了下來，從此再也沒有原諒過任何人。',
        reqs: [{ id: 'afk_q_hd_tear', n: '水之精靈的淚', img: IC('accessories/人魚的淚滴'), d: '賽尼斯落下的眼淚，凝成了冰冷的水晶。', need: 3, mobs: ['賽尼斯(首領)'] }],
        rewards: { all: ['afk_hd_robe'] }, first: [['scroll_weapon_b', 2]] },
      { lv: 60, title: '哈汀之影', map: '象牙塔隱藏封印區（哈汀之影）', story: '象牙塔的封印區裡徘徊著哈汀之影。喬說：那不是老師的亡魂，是老師分出去的影子——本體還活著。',
        reqs: [{ id: 'afk_q_hd_echo', n: '哈汀之影的殘響', img: IC('items/失去光明的靈魂'), d: '哈汀之影消散時留下的殘響，裡面有一個不屬於這個時代的聲音。', need: 3, mobs: ['哈汀之影'] }],
        rewards: { all: ['afk_hd_cloak', 'item_hatin_diary'] }, first: [['scroll_armor_b', 3]] },
      { lv: 70, title: '哈汀的時空', map: '哈汀的時空（隊伍副本，找喬進入）', story: '殘響指向時空的縫隙。喬可以送你回到那一晚的說話之島地底——守住 12 波魔界怪，選擇要不要阻止封印儀式，最後面對哈汀本人。',
        reqs: [{ id: 'afk_q_hd_glass', n: '碎裂的時空沙漏', img: IC('items/時空裂痕碎片'), d: '哈汀倒下時摔碎的沙漏，沙子還在倒著流。', need: 1, mobs: ['大魔法師 哈汀'] }],
        rewards: { all: ['afk_hd_tome'] }, first: [['gold', 500000]].concat(CRYSTAL ? [[CRYSTAL, 200]] : []) }
    ]
  });
  var chState = function (i) { var p = P(); return p ? trialQStateFor(p, L.keyOf(line, i, p.cls)) : 0; };

  // ── 歐林：第 4 章完成後，每 30 分鐘在古魯丁地監 7 樓出現 ──
  var ORIN_MAP = 'zone_12', ORIN_EVERY = 30 * 60 * 1000;
  var orinOn = function () { return mobs().some(function (m) { return alive(m) && m.afkHd === 'orin'; }); };

  // ── 副本流程 ──
  var run = null, lastMap = null;
  var partyN = function () { var p = P(); return 1 + ((p && p.allies) || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; }).length; };
  var canEnter = function () {
    var p = P(); if (!p) return '請先進入遊戲。';
    if ((p.lv || 1) < 70) return '需要 Lv70。';
    if (chState(6) < 1) return '先向喬接取第 7 章「哈汀的時空」。';
    return null;
  };
  var enter = function () {
    var p = P(), why = canEnter(); if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return false;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { stage: 'wave', wave: 1, queue: [], killed: 0, need: 0, choice: null, curse: 0, scale: 1 + 0.25 * (partyN() - 1), choiceAt: 0 };
    lastMap = MAP; startWave(1);
    sys('<span class="font-bold" style="color:#c084fc">喬念完咒語，四周的牆壁像沙子一樣崩落——你站在數十年前的說話之島地底。（隊伍 ' + partyN() + ' 人：頭目與魔界怪 HP ×' + run.scale.toFixed(2) + '）</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
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
    return true;
  };
  var startWave = function (w) {
    run.stage = 'wave'; run.wave = w; run.killed = 0;
    var n = 3 + Math.floor(w / 4), q = [];
    for (var i = 0; i < n; i++) q.push(POOL[Math.floor(Math.random() * POOL.length)]);
    if (w % 4 === 0) q.push(ELITE);
    run.queue = q; run.need = q.length;
    sys('<span style="color:#c084fc">【' + MAP_N.split('－')[0] + '】第 ' + w + '／' + WAVES + ' 波：魔界的裂縫湧出 ' + q.length + ' 隻魔界怪。</span>');
  };
  var startBoss = function (stage) {
    run.stage = stage; run.killed = 0; run.need = 1;
    run.queue = [stage === 'hardin' ? 'afk_hd_hardin' : (run.choice === 'stop' ? 'afk_hd_senis' : 'afk_hd_baph')];
    if (stage === 'hardin') sys('<span class="font-bold" style="color:#e879f9">「真是令人失望的學生們。」黑袍的大魔法師從祭壇後走出來——大魔法師 哈汀。</span>');
    else if (run.choice === 'stop') sys('<span class="font-bold" style="color:#38bdf8">你打斷了封印儀式。祭壇上的賽尼斯睜開眼睛，巴風特的魔力把她的翅膀染成了黑色——黑翼賽尼斯！</span>');
    else sys('<span class="font-bold" style="color:#f97316">封印儀式完成了一半，巴風特掙脫了束縛——失控的巴風特！</span>');
  };
  var choiceBox = function (show) {
    try {
      var el = document.getElementById('afk-hd-choice');
      if (!show) { if (el) el.remove(); return; }
      if (el) return;
      el = document.createElement('div'); el.id = 'afk-hd-choice';
      el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:60;background:rgba(15,23,42,.95);border:1px solid #a855f7;border-radius:10px;padding:12px 14px;max-width:min(92vw,520px);color:#e2e8f0;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.6)';
      el.innerHTML = '<div style="font-weight:700;color:#e9d5ff;margin-bottom:6px">祭壇上的封印儀式開始了</div>'
        + '<div style="font-size:13px;color:#cbd5e1;margin-bottom:8px">哈汀要把賽尼斯當成活祭品封印巴風特。你要怎麼做？（30 秒內沒選，儀式會自己完成）</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-hdc="stop" style="flex:1 1 200px;padding:8px;border-radius:6px;background:#0c4a6e;border:1px solid #38bdf8;color:#fff;font-weight:700">阻止封印儀式（打黑翼賽尼斯，難；第一次通關多一件耳環）</button>'
        + '<button type="button" data-hdc="ritual" style="flex:1 1 200px;padding:8px;border-radius:6px;background:#7c2d12;border:1px solid #f97316;color:#fff;font-weight:700">讓儀式完成（打失控的巴風特，較簡單）</button></div>';
      el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-hdc]'); if (b) choose(b.getAttribute('data-hdc')); });
      document.body.appendChild(el);
    } catch (e) {}
  };
  var choose = function (c) {
    if (!run || run.stage !== 'choice') return false;
    run.choice = c === 'stop' ? 'stop' : 'ritual'; choiceBox(false);
    sys(run.choice === 'stop' ? '<span class="text-sky-300 font-bold">你決定阻止封印儀式。賽尼斯被綁在祭壇上，望著你。</span>' : '<span class="text-orange-300 font-bold">你別過頭，讓儀式繼續進行。</span>');
    startWave(CHOICE_AT + 1);
    return true;
  };
  var watchMap = function () {
    var cur = (typeof mapState !== 'undefined') ? mapState.current : null;
    if (cur !== lastMap) { if (lastMap === MAP && run) { run = null; choiceBox(false); try { recomputeStats(); } catch (e) {} } lastMap = cur; }
  };
  var victory = function () {
    var p = P(), got = [];
    run.stage = 'done';
    p.afkHdStats = p.afkHdStats || { clears: 0, stop: 0, ritual: 0 };
    p.afkHdStats.clears++; p.afkHdStats[run.choice === 'stop' ? 'stop' : 'ritual']++;
    if (p._afkHdDay !== dayKey()) {
      p._afkHdDay = dayKey(); gainItem(MARK, 1, true); got.push(DB.items[MARK].n + ' ×1');
      if (CRYSTAL && DB.items[CRYSTAL]) { gainItem(CRYSTAL, 30, true); got.push(DB.items[CRYSTAL].n + ' ×30'); }
    }
    if (run.choice === 'stop' && !p._afkHdTear) { p._afkHdTear = true; gainItem('afk_hd_tear', 1, true); got.push('<span class="text-sky-300 font-bold">賽尼斯的淚滴耳環</span>'); }
    sys('<span class="text-yellow-300 font-bold">🏆 哈汀的身影碎成了沙，時空的縫隙開始崩塌。</span>' + (got.length ? '你得到了：' + got.join('、') + '。' : '（今天的印記已經領過了）'));
    var t0 = run;
    setTimeout(function () { try { if (mapState.current === MAP && run === t0) { setMapSelectors(TOWN); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
  };

  // ── 出怪 ──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var cur = (typeof mapState !== 'undefined') ? mapState.current : null;
      if (cur === MAP) {
        var keep = function () { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; };
        if (!run || run.stage === 'choice' || run.stage === 'done' || !run.queue.length) return keep();
        if ((run.stage === 'boss' || run.stage === 'hardin') && idx !== 1) return keep();
        var id = run.queue.shift(), b = DB.mobs[id]; if (!b) return keep();
        var m = B.place(idx, b, { mobId: id, _hdRun: true });
        var mult = run.scale * (run.stage === 'wave' ? 1.5 + 0.1 * run.wave : 1);
        m.hp = Math.max(1, Math.round(m.hp * mult)); m.curHp = m.hp;
        try { if ((m.boss || run.stage !== 'wave') && typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
        try { if (!S().ff) renderMobs(); } catch (e) {}
        return;
      }
      var r = oSpawn.apply(this, arguments);
      try {
        var p = P(), m2 = mapState.mobs && mapState.mobs[idx];
        if (p && cur === ORIN_MAP && m2 && !m2.boss && chState(3) === 2 && !orinOn() && Date.now() >= (Number(p.afkHdOrin) || 0)) {
          p.afkHdOrin = Date.now() + ORIN_EVERY;
          var o = B.place(idx, DB.mobs.afk_hd_orin, { mobId: 'afk_hd_orin' });
          sys('<span class="font-bold" style="color:#fde68a">📖 大魔法師 歐林從堆滿書的角落站了起來：「想請教？先讓我看看你的本事。」</span>');
          try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(o); } catch (e) {}
          try { if (!S().ff) renderMobs(); } catch (e) {}
        }
      } catch (e) { console.warn('[AFK-hardin] orin', e); }
      return r;
    };
  }

  // ── 小工具 ──
  var member = function () { return B.party(); };
  var maxHpOf = function (t) { return t === P() ? (Number(t.mhp) || 1) : (Number(t.mhp) || Number(t.curHp) || 1); };
  var freeze = function (mob, t, skn) {
    var sk = { skn: skn, type: 'freeze', pbase: 200, alwaysHit: true };
    try { if (t === P()) applyMobMagic(mob, sk); else if (typeof applyMobMagicToAlly === 'function') applyMobMagicToAlly(mob, sk, t); } catch (e) {}
  };
  var cast = function (mob, sk) { try { castMobMagic(mob, sk); } catch (e) {} };
  var placeFree = function (id, extra) {
    var ms = mobs(), j = -1, q;
    for (q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
    if (j < 0) for (q = 0; q < ms.length; q++) if (ms[q] && !ms[q].boss && !ms[q].afkHd && !ms[q].afkHdShadow && ms[q].n !== '哈汀之影') { j = q; break; }
    if (j < 0) return null;
    var m = B.place(j, DB.mobs[id], Object.assign({ mobId: id }, extra || {}));
    try { if (!S().ff) renderMobs(); } catch (e) {}
    return m;
  };
  var cloneOf = function (m) { return mobs().some(function (x) { return alive(x) && x.afkHdClone && x._hdOwner === m.uid; }); };
  var shadowsUp = function () { return mobs().some(function (x) { return alive(x) && x.afkHdShadow; }); };
  var fourAlive = function (except) { return mobs().filter(function (x) { return alive(x) && isFour(x) && x !== except; }); };

  // ── 每 tick 的技能 ──
  var ELEM = [['火球', 'fire'], ['岩石碎擊', 'earth'], ['風刃', 'wind'], ['冰錐', 'water']];
  var hdTick = function () {
    var t = tk(), p = P(); if (!p) return;
    if (run && mapState.current === MAP && run.stage === 'choice' && t >= run.choiceAt) choose('ritual');
    mobs().forEach(function (m, i) {
      if (!alive(m)) return;
      var hf = m.curHp / (m.hp || 1);
      if (m.n === '哈汀之影' && !m.afkHdClone && !m._hdSplit && hf <= 0.5) {
        m._hdSplit = true;
        var c = placeFree('afk_hd_clone');
        if (c) { c.hp = c.curHp = Math.max(1, Math.round(m.hp * 0.3)); c._hdOwner = m.uid; clog('<span class="font-bold" style="color:#a78bfa">【影分身】</span>哈汀之影一分為二——影分身倒下之前，本體不會受到傷害。'); }
        return;
      }
      if (!m.afkHd) return;
      if (B.halted(m)) { ['_hdA', '_hdB', '_hdC'].forEach(function (k) { if (m[k]) m[k]++; }); return; }
      if (m._hdA == null) { m._hdA = t + (m.afkHd === 'orin' ? 120 : m.afkHd === 'senis' ? 300 : m.afkHd === 'baph' ? 250 : 450); m._hdB = t + 400; }
      if (m.afkHd === 'orin') {
        if (t >= m._hdA) { m._hdA = t + 120; clog('<span class="font-bold" style="color:#fde68a">【四元素齊射】</span>歐林依序放出火、地、風、水四道魔法——那是四色的招式。'); ELEM.forEach(function (e) { if (m.curHp > 0) cast(m, { skn: e[0], dmg: [2, 45], db: 60, ele: e[1] }); }); }
        if (t >= m._hdB) {
          m._hdB = t + 400;
          var top = member().sort(function (a, b) { return (b === P() ? b.hp : b.curHp) - (a === P() ? a.hp : a.curHp); })[0];
          if (top) { freeze(m, top, '時間停止'); clog('<span class="font-bold" style="color:#93c5fd">【時間停止】</span>歐林讓' + (top === p ? '你' : (top._allyName || '傭兵')) + '的時間停了下來。'); }
        }
        [0.7, 0.35].forEach(function (th, k) { var f = '_hdW' + k; if (!m[f] && hf <= th) { m[f] = true; m._hdWallUntil = t + 100; clog('<span class="font-bold" style="color:#fbbf24">【鍊金護壁】</span>歐林灑出鍊金藥劑——10 秒內受到的傷害 −50%。'); } });
      } else if (m.afkHd === 'senis') {
        if (t >= m._hdA) {
          m._hdA = t + 300;
          var al = ((p.allies) || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0 && !(a._hdCharm > t); });
          if (al.length) { var a = al[Math.floor(Math.random() * al.length)]; a._hdCharm = t + 50; a._hdCharmHit = t; clog('<span class="font-bold" style="color:#f0abfc">【魅惑】</span>黑翼賽尼斯看了 ' + esc(a._allyName || '傭兵') + ' 一眼——5 秒內，他會攻擊自己人。'); }
        }
        var lost = Math.min(3, Math.floor((1 - hf) / 0.25));
        if (run && lost > run.curse) { run.curse = lost; try { recomputeStats(); if (p.hp > p.mhp) p.hp = p.mhp; updateUI(); } catch (e) {} clog('<span class="font-bold" style="color:#7dd3fc">【活祭品的詛咒】</span>賽尼斯的詛咒纏上了你：最大 HP −' + (5 * lost) + '%（打完為止）。'); }
        if (!m._hdFly && hf <= 0.3) { m._hdFly = true; m._hdFlyUntil = t + 60; clog('<span class="font-bold" style="color:#a5b4fc">【黑翼】</span>黑翼賽尼斯展翅飛起——6 秒內近戰攻擊打不到她。'); }
      } else if (m.afkHd === 'baph') {
        if (t >= m._hdA) { m._hdA = t + 250; var got = B.summon('afk_hd_skel', 3, {}); mobs().forEach(function (x) { if (alive(x) && x.mobId === 'afk_hd_skel' && !x._hdScaled) { x._hdScaled = true; x.hp = x.curHp = Math.round(x.hp * (run ? run.scale : 1)); } }); if (got) clog('<span class="font-bold" style="color:#f97316">【惡魔契約】</span>巴風特從地底召喚了 ' + got + ' 隻魔界的骷髏。'); }
        if (!m._hdRage && hf <= 0.5) { m._hdRage = true; m.atkSpd = (Number(m.atkSpd) || 1.5) / 1.5; m._baseAtkSpd = m.atkSpd; clog('<span class="font-bold" style="color:#ef4444">【失控】</span>巴風特完全失去了理智——攻擊速度 +50%，受到的傷害 +20%。'); }
      } else if (m.afkHd === 'hardin') {
        if (t >= m._hdA) {
          m._hdA = t + 450;
          clog('<span class="font-bold" style="color:#e879f9">【知識的代價】</span>哈汀翻開禁書：「知識是要付出代價的。」——全隊被封印魔法，並被吸走 10% MP。');
          cast(m, { skn: '知識的代價', type: 'magicseal', pbase: 80, alwaysHit: true });
          member().forEach(function (x) { if (x === p) p.mp = Math.max(0, (Number(p.mp) || 0) - Math.round((Number(p.mmp) || 0) * 0.1)); else if (x.mp != null) x.mp = Math.max(0, (Number(x.mp) || 0) - Math.round((Number(x.mmp) || 0) * 0.1)); });
        }
        var steps = [[0.75, ['afk_hd_sh_fire']], [0.5, ['afk_hd_sh_earth', 'afk_hd_sh_wind']], [0.25, ['afk_hd_sh_water']]];
        steps.forEach(function (s, k) {
          var f = '_hdS' + k; if (m[f] || hf > s[0]) return; m[f] = true;
          var names = [];
          s[1].forEach(function (id) { var x = placeFree(id, { _hdShadowOf: m.uid }); if (x) { x.hp = x.curHp = Math.round(x.hp * (run ? run.scale : 1)); names.push(x.n); } });
          if (names.length) clog('<span class="font-bold" style="color:#c084fc">【弟子的影子】</span>哈汀召喚了' + names.join('、') + '——影子活著的時候，哈汀受到的傷害 −50%。');
        });
      }
    });
    // 魅惑：被魅惑的傭兵每秒打一名自己人
    ((p.allies) || []).forEach(function (a) {
      if (!a || !(a._hdCharm > t) || a._downed || t - (a._hdCharmHit || 0) < 10) return;
      a._hdCharmHit = t;
      var vs = member().filter(function (x) { return x !== a; }); if (!vs.length) return;
      var v = vs[Math.floor(Math.random() * vs.length)], d = B.hurt(v, maxHpOf(v) * 0.04);
      clog('<span style="color:#f0abfc">被魅惑的 ' + esc(a._allyName || '傭兵') + ' 攻擊了' + (v === p ? '你' : esc(v._allyName || '傭兵')) + '（' + d + '）</span>');
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      try { watchMap(); } catch (e) {}
      var t0 = tk(), r = oTick.apply(this, arguments);
      if (tk() !== t0) { try { hdTick(); } catch (e) { console.warn('[AFK-hardin] tick', e); } }
      return r;
    };
  }
  // 活祭品的詛咒：只在副本裡，打完為止
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { if (run && run.curse > 0 && mapState.current === MAP) p.mhp = Math.max(1, Math.round((p.mhp || 0) * (1 - 0.05 * run.curse))); });

  // ── 傷害修正 ──
  var mod = function (actor, target, v, kind) {
    var t = tk();
    if (actor && actor._hdCharm > t && target && target.afkHd === 'senis') return 0;
    if (!target) return v;
    if (target.n === '哈汀之影' && !target.afkHdClone && cloneOf(target)) return 0;
    if (isFour(target) && fourAlive(target).length) v *= 0.8;
    if (target.afkHd === 'orin' && t < (target._hdWallUntil || 0)) v *= 0.5;
    if (target.afkHd === 'senis' && t < (target._hdFlyUntil || 0) && kind === 'melee') return 0;
    if (target.afkHd === 'baph' && target._hdRage) v *= 1.2;
    if (target.afkHd === 'hardin' && shadowsUp()) v *= 0.5;
    return v;
  };
  var hooked = false;
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) { var v = o.apply(this, arguments); try { if (v > 0) { var w = mod(actor, target, v, opt && opt.kind); if (w !== v) v = Math.floor(w); } } catch (e) {} return v; };
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // ── 擊殺：永生、波數推進、四色狂暴、歐林的獎勵 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx];
      if (m && !m._dead && m.afkHd === 'hardin' && !m._hdRevived) {
        m._hdRevived = true; m.curHp = Math.round(m.hp * 0.3);
        clog('<span class="font-bold" style="color:#e879f9;text-shadow:0 0 8px #701a75">【禁咒・永生】</span>哈汀倒下又站了起來：「我追求的，就是不會死。」——以 30% HP 復活。');
        try { if (!S().ff) renderMobs(); } catch (e) {}
        return;
      }
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && !m._hdDone) {
          m._hdDone = true;
          if (isFour(m)) {
            var rest = fourAlive(m);
            if (rest.length === 1 && !rest[0]._hdEnraged) { var x = rest[0]; x._hdEnraged = true; x.atkSpd = (Number(x.atkSpd) || 2) / 1.3; x._baseAtkSpd = x.atkSpd; clog('<span class="font-bold" style="color:#ef4444">「為了老師……！」</span>' + esc(x.n) + ' 狂暴了——攻擊速度 +30%。'); }
          }
          if (m.afkHd === 'orin') {
            var got = [];
            if (CRYSTAL && DB.items[CRYSTAL]) { var c = 20 + Math.floor(Math.random() * 21); gainItem(CRYSTAL, c, true); got.push(DB.items[CRYSTAL].n + ' ×' + c); }
            if (Math.random() < 0.1) { gainItem('item_olin_diary', 1, true); got.push(DB.items.item_olin_diary.n); }
            if (DB.items.relic_orin_ring && Math.random() < 0.01) { gainItem('relic_orin_ring', 1, true); got.push('<span class="text-yellow-300 font-bold">' + DB.items.relic_orin_ring.n + '</span>'); }
            sys('<span class="text-amber-200">歐林放下法杖：「不錯。」他塞給你：' + (got.join('、') || '一句稱讚') + '</span>');
          }
          if (m._hdRun && run && mapState.current === MAP && run.stage !== 'done') {
            run.killed++;
            if (run.killed >= run.need) {
              if (run.stage === 'wave') {
                if (run.wave === CHOICE_AT) { run.stage = 'choice'; run.choiceAt = tk() + CHOICE_WAIT; choiceBox(true); sys('<span class="font-bold" style="color:#e9d5ff">祭壇亮了起來——哈汀開始了封印儀式。<button type="button" class="btn px-2 py-0.5 ml-1" onclick="__afkHardin.choose(\'stop\')">阻止封印儀式</button><button type="button" class="btn px-2 py-0.5 ml-1" onclick="__afkHardin.choose(\'ritual\')">讓儀式完成</button></span>'); }
                else if (run.wave < WAVES) startWave(run.wave + 1);
                else startBoss('boss');
              } else if (run.stage === 'boss') startBoss('hardin');
              else if (run.stage === 'hardin') victory();
            }
          }
        }
      } catch (e) { console.warn('[AFK-hardin] kill', e); }
      return r;
    };
  }

  // ── 魔法師 喬 ──
  var EXCH = [
    { key: 'crystal', id: CRYSTAL, n: 50, cost: 1 },
    { key: 'hatin', id: 'item_hatin_diary', n: 1, cost: 3 },
    { key: 'olin', id: 'item_olin_diary', n: 1, cost: 3 },
    { key: 'tome', id: 'afk_hd_tome', n: 1, cost: 6 },
    { key: 'tear', id: 'afk_hd_tear', n: 1, cost: 6 }
  ].filter(function (x) { return x.id && DB.items[x.id]; });
  var exchange = function (key) {
    var x = EXCH.filter(function (e) { return e.key === key; })[0]; if (!x) return '沒有這個選項。';
    if (!K.take(MARK, x.cost)) return DB.items[MARK].n + '不夠（需要 ' + x.cost + '）。';
    gainItem(x.id, x.n, true);
    sys('<span class="text-fuchsia-300">' + esc(NPC_N) + '收下 ' + x.cost + ' 個' + esc(DB.items[MARK].n) + '，交給你 ' + esc(DB.items[x.id].n) + ' ×' + x.n + '。</span>');
    try { renderTabs(true); saveGame(); } catch (e) {}
    return null;
  };
  var ui = { err: '' };
  var paintJoe = function (div) {
    var box = div.querySelector('#afk-hd-joe'); if (!box) return;
    var p = P(); if (!p) return;
    var why = canEnter(), st = p.afkHdStats || { clears: 0, stop: 0, ritual: 0 }, today = p._afkHdDay === dayKey();
    var h = '<div class="ax-h">哈汀的時空（隊伍副本）</div>'
      + '<div class="ax-note">回到數十年前的說話之島地底：守住 12 波魔界怪，第 6 波後選擇要不要阻止封印儀式，第 12 波後打倒黑翼賽尼斯或失控的巴風特，最後是大魔法師 哈汀。'
      + '頭目與魔界怪的 HP 會隨隊伍人數變高（每多一名活著的傭兵 +25%）。次數不限；每天第一次通關得到 哈汀的魔法印記 ×1。中途離開或倒下要重來。</div>'
      + '<div class="ax-note">通關 ' + st.clears + ' 次（阻止儀式 ' + st.stop + '、讓儀式完成 ' + st.ritual + '）　今天的印記：' + (today ? '<b style="color:#86efac">已領</b>' : '<b style="color:#fde68a">還沒領</b>') + '</div>';
    h += K.rowHtml({ key: 'enter', name: '進入哈汀的時空', color: '#e9d5ff', desc: '需要 Lv70，並接取第 7 章「哈汀的時空」。', why: why || '', btns: [['enter', '進入', !why]] }, 'data-hd');
    h += '<div class="ax-h">用哈汀的魔法印記交換</div>' + K.matBar([MARK]);
    EXCH.forEach(function (x) { var d = DB.items[x.id]; h += K.rowHtml({ key: x.key, ico: K.itemIco(x.id), name: esc(d.n) + (x.n > 1 ? ' ×' + x.n : ''), color: '#fde68a', req: K.reqTxt(K.have(MARK), x.cost, DB.items[MARK].n), btns: [['x:' + x.key, '交換', K.have(MARK) >= x.cost]] }, 'data-hd'); });
    if (ui.err) h += '<div class="ax-err">' + esc(ui.err) + '</div>';
    K.repaint(box, h);
  };
  var renderJoe = function (div) {
    if (!div) return; K.css(); ui.err = '';
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">「老師教會我的第一件事，是知識會吃人。」</div></div>';
    L.render(line, div);
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-hd-joe'; div.appendChild(box);
    paintJoe(div);
    if (!div.__afkHdBound) {
      div.__afkHdBound = true;
      div.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-hd]'); if (!b || b.disabled || !div.querySelector('#afk-hd-joe')) return;
        var a = b.getAttribute('data-hd');
        if (a === 'enter') { enter(); return; }
        if (a.indexOf('x:') === 0) { ui.err = exchange(a.slice(2)) || ''; paintJoe(div); }
      });
    }
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: '占卜師', type: 'quest',
    d: '哈汀的弟子之一，後來投向特羅斯的占卜師。他想知道當年說話之島地底發生了什麼事——支線「知識與背叛」與隊伍副本「哈汀的時空」。' }, '2767');
  K.hookNpc(NPC_ID, NPC_N, '占卜師', renderJoe);

  W.__afkHardin = { line: line, MAP: MAP, NPC_ID: NPC_ID, MARK: MARK, SET: SET, EXCH: EXCH, enter: enter, canEnter: canEnter, choose: choose, exchange: exchange,
    run: function () { return run; }, tick: hdTick, mod: mod, startWave: startWave, startBoss: startBoss, partyN: partyN, renderJoe: renderJoe, WAVES: WAVES };
})();
