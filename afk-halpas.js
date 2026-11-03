/* ============================================================================
 * afk-halpas.js — 終章「闇龍的低語」（Lv85～100）＋火焰之影（真身）＋闇龍 哈爾巴斯＋反王肯恩／死亡騎士重做
 *   （玩家 2026-10-29；企劃 docs/lore-expansion-plan.md B3、C6、C7、第 5 節）
 *
 *   發派：燃柳村 奧拉奇里亞（光龍；接在轉生技藝下面）。5 章，照順序：
 *     1 Lv85  不死的特別部隊　暗影神殿 3 樓 火焰之影親衛兵　魔族的密令 ×6 → 闇龍獵人的頭盔（第一次另給 龍之鑽石 ×20）
 *     2 Lv88  反王的密報　　　謀叛者的低語 反王肯恩(謀叛)　肯恩的密信 ×1 → 闇龍獵人的手套（＋回夢水晶 ×5）
 *     3 Lv91  生命之樹的種子　四龍巢穴（任一階）四龍各 1 次　龍的記憶 ×4 → 闇龍獵人的長靴＋生命之樹的種子；
 *                            之後挑戰哈爾巴斯時帶著「奧拉奇里亞的祝福」（擋一次吞噬）
 *     4 Lv95  火焰之影　　　　火焰之影（真身）（暗影神殿最深處）火焰之影的核心 ×1 → 火焰之影的斗篷
 *     5 Lv100 闇龍　　　　　　闇龍 哈爾巴斯（時空裂痕－闇龍的巢）闇龍的逆鱗 ×1 → 闇龍獵人的盔甲（＋闇龍的鱗片 ×10）
 *     闇龍獵人套裝（頭盔、手套、長靴、盔甲）：2 件 額外傷害 +2、最大 HP +100；3 件 再 傷害減免 +2、魔防 +10；
 *       4 件 再 額外傷害 +3、額外命中 +3、最大 HP +200、魔法傷害 +2
 *
 *   火焰之影（真身）Lv96：暗影神殿最深處（奧拉奇里亞送你去；接了第 4 章就能進，次數不限）
 *     HP 40 萬（以 8 人隊為準，每少一人 −25% 份；最少 36%）
 *     業火領域（每秒全隊最大 HP 1% 火傷，火抗可減）、親衛隊召集（HP 80／60／40／20% 各 4 名親衛兵）、
 *     煉獄火柱（每 20 秒標記 2 人，3 秒後爆炸：兩人各 30% 最大 HP 的傷害由全隊平分）、不死之焰（HP 10%：20 秒內每秒回 1% HP）
 *   闇龍 哈爾巴斯 Lv105：時空裂痕－闇龍的巢（接了第 5 章就能進，次數不限；每天第一次打倒才給鱗片）
 *     HP 150 萬 ×（隊伍人數 ÷ 16，最少 4 人份；席琳夢域鏡再 6 折，跟四龍最終龍一樣）；20 分鐘沒打倒算失敗
 *       （企劃原本 450 萬；2026-10-29 用玩家存檔（王族＋7 傭兵、瘋狂席琳＋夢域鏡）實測太久，下修）
 *     第一階段（100～70%）闇之吐息；第二階段（70～35%）每 20 秒換一招四龍的招式（地震、詛咒之水、業火、暴風）；
 *     第三階段（35%～）吞噬：每 30 秒吸走全隊最大 HP 10% 回補自己（奧拉奇里亞的祝福擋一次）
 *     每天第一次打倒：闇龍的鱗片 ×3～5、闇龍之心 10%
 *   奧拉奇里亞用闇龍的鱗片交換：龍之鑽石、闇龍獵人的套裝（給傭兵用）、闇龍之眼（需要闇龍之心）
 *   既有 Boss 重做：
 *     反王肯恩（傲慢之塔）：HP 50% 召喚 2 名黑騎士親衛；篡位者的威壓——他活著時，王族「精準目標」對所有敵人的加成減半
 *     死亡騎士：HP 30% 召喚 4 隻骷髏（死亡騎士的誓約）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit;
  if (T && T.register) T.register({ id: 'lorehalpas', name: '終章劇情「闇龍的低語」與闇龍哈爾巴斯', group: '遊戲內容',
    desc: '燃柳村奧拉奇里亞發派的終章 Lv85～100（5 章，獎勵闇龍獵人套裝）；火焰之影（真身）、闇龍 哈爾巴斯；反王肯恩、死亡騎士技能重做' });
  if (T && !T.enabled('lorehalpas')) return;
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
  var NPC_ID = 'npc_orachilia', NPC_N = '奧拉奇里亞', TOWN = 'town_gludio';
  var dia = function (n) { try { var r = W.pandoraAdjustSharedDiamonds(n) || {}; return !!r.ok; } catch (e) { return false; } };

  // ── 裝備與材料 ──
  var SET_TXT = '【闇龍獵人】2 件：額外傷害 +2、最大 HP +100；3 件：再 傷害減免 +2、魔防 +10；4 件：再 額外傷害 +3、額外命中 +3、最大 HP +200、魔法傷害 +2。';
  var SET = ['afk_hp_helm', 'afk_hp_gloves', 'afk_hp_boots', 'afk_hp_armor'];
  var gear = {
    afk_hp_helm: { n: '闇龍獵人的頭盔', type: 'arm', slot: 'helm', ac: 6, mr: 10, mhp: 100, hpR: 5, safe: 6, img: IC('armors/騎士面甲'), d: '光龍為追獵闇龍的人打造的頭盔。AC 6、魔防 +10、最大 HP +100、HP 自然恢復 +5。' },
    afk_hp_gloves: { n: '闇龍獵人的手套', type: 'arm', slot: 'gloves', ac: 5, extraHit: 4, extraDmg: 2, safe: 6, img: IC('armors/惡魔手套'), d: '指節嵌著龍骨的手套。AC 5、額外命中 +4、額外傷害 +2。' },
    afk_hp_boots: { n: '闇龍獵人的長靴', type: 'arm', slot: 'boots', ac: 5, er: 4, mr: 8, mhp: 80, safe: 6, img: IC('armors/影子長靴'), d: '踩過四龍巢穴的長靴。AC 5、迴避 +4、魔防 +8、最大 HP +80。' },
    afk_hp_armor: { n: '闇龍獵人的盔甲', type: 'arm', slot: 'armor', ac: 14, dr: 4, mr: 10, mhp: 150, safe: 6, img: IC('armors/鋼鐵金屬盔甲'), d: '用哈爾巴斯的逆鱗補強的鎧甲。AC 14、傷害減免 +4、魔防 +10、最大 HP +150。' },
    afk_hp_flame_cloak: { n: '火焰之影的斗篷', type: 'arm', slot: 'cloak', ac: 5, mr: 15, resFire: 30, extraDmg: 2, mdmg: 2, safe: 6, c: 'text-orange-300', img: IC('armors/冥法軍王斗篷'),
      d: '魔族之主火焰之影倒下後留下的斗篷，到現在還在悶燒。AC 5、魔防 +15、火屬性抗性 +30、額外傷害 +2、魔法傷害 +2。' },
    afk_hp_eye: { n: '闇龍之眼', type: 'acc', slot: 'ear', ac: 3, mr: 15, mhp: 150, extraDmg: 3, extraHit: 3, mdmg: 3, safe: 5, c: 'text-fuchsia-300', img: IC('accessories/不死耳環'),
      d: '哈爾巴斯失去的記憶凝成的眼睛。AC 3、魔防 +15、最大 HP +150、額外傷害 +3、額外命中 +3、魔法傷害 +3。' }
  };
  Object.keys(gear).forEach(function (id) { var g = gear[id]; g.c = g.c || 'text-indigo-300'; g.p = 100000; g.req = 'all'; if (SET.indexOf(id) >= 0) g.d += SET_TXT; L.addItem(id, g); });
  L.defineSet({ name: '闇龍獵人', ids: SET, tiers: [[2, { extraDmg: 2, mhp: 100 }], [3, { dr: 2, mr: 10 }], [4, { extraDmg: 3, extraHit: 3, mhp: 200, mdmg: 2 }]] });
  var SCALE = 'afk_hp_scale', HEART = 'afk_hp_heart', SEED = 'afk_hp_seed';
  L.addItem(SCALE, { n: '闇龍的鱗片', type: 'etc', noUse: true, c: 'text-indigo-300', img: IC('items/光明的鱗片'), d: '闇龍哈爾巴斯身上剝落的鱗片，黑得像沒有星星的夜。可以交給奧拉奇里亞交換物品；也是之後二轉裝備的材料。' });
  L.addItem(HEART, { n: '闇龍之心', type: 'etc', noUse: true, c: 'text-fuchsia-300', img: IC('items/哀石水晶'), d: '哈爾巴斯胸口那顆還在跳動的心。可以交給奧拉奇里亞做成闇龍之眼；也是之後二轉裝備的材料。' });
  L.addItem(SEED, { n: '生命之樹的種子', type: 'etc', noUse: true, c: 'text-emerald-300', img: IC('items/召喚球碎片'), d: '四龍記憶裡共同指向的種子。哈爾巴斯想要的就是它。之後二轉內容的材料。' });

  // ── 新怪物 ──
  var mk = function (id, def, anim) { return L.addMob(id, Object.assign({ s: 'L', beh: '主動', goldMin: 0, goldMax: 0 }, def), anim); };
  mk('afk_hp_flame', { n: '火焰之影（真身）', lv: 96, boss: true, race: '惡魔', e: 'fire', hp: 400000, ac: -85, mr: 150, exp: 40000, goldMin: 20000, goldMax: 40000,
    atkSpd: 1.5, dmg: [4, 90], db: 180, hit: 130, afkHp: 'flame',
    mag: { skn: '地獄火', cd: 90, dmg: [3, 200], db: 300, ele: 'fire', alwaysHit: true }, mag2: { skn: '火焰風暴', cd: 120, chance: 0.5, dmg: [5, 80], db: 250, ele: 'fire' } }, '火焰之影');
  mk('afk_hp_halpas', { n: '闇龍 哈爾巴斯', lv: 105, boss: true, race: '龍', e: 'none', hp: 1500000, ac: -100, mr: 250, exp: 120000, goldMin: 50000, goldMax: 100000,
    atkSpd: 1.5, dmg: [5, 100], db: 280, hit: 160, afkHp: 'halpas',
    mag: { skn: '闇龍的爪擊', cd: 60, chance: 0.5, dmg: [4, 150], db: 350, ele: 'none' } }, '巴拉卡斯');
  mk('afk_hp_kenn_guard', { n: '黑騎士親衛', lv: 70, race: '黑騎士', e: 'none', s: 'S', hp: 6000, ac: -50, mr: 50, exp: 1500, atkSpd: 1.2, dmg: [3, 30], db: 40, hit: 70 }, '暗黑黑騎士');
  var BREATH = { skn: '闇之吐息', dmg: [6, 100], db: 300, ele: 'none', alwaysHit: true };
  var ECHO = [
    { skn: '闇龍・地震', dmg: [5, 90], db: 280, ele: 'earth', alwaysHit: true, from: '安塔瑞斯' },
    { skn: '闇龍・詛咒之水', dmg: [5, 90], db: 260, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 120 }, from: '法利昂' },
    { skn: '闇龍・業火', dmg: [5, 100], db: 300, ele: 'fire', alwaysHit: true, from: '巴拉卡斯' },
    { skn: '闇龍・暴風', dmg: [5, 90], db: 280, ele: 'wind', alwaysHit: true, from: '林德拜爾' }
  ];
  try { [BREATH.skn].concat(ECHO.map(function (e) { return e.skn; })).forEach(function (n) { MOB_PARTY_AOE_SKILLS.add(n); }); } catch (e) {}
  var GUARDS = ['afk_ttmi_72', 'afk_ttmi_73', 'afk_ttmi_74', 'afk_ttmi_75', 'afk_ttmi_76', 'afk_ttmi_77', 'afk_ttmi_78', 'afk_ttmi_79'].filter(function (id) { return !!DB.mobs[id]; });
  var DK_SKEL = ['afk_ttmi_180', 'afk_ttmi_182'].filter(function (id) { return !!DB.mobs[id]; });
  if (!DK_SKEL.length && DB.mobs.skel_axe) DK_SKEL.push('skel_axe');
  try {
    var TTMI = {}; try { (W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items || []).forEach(function (id) { TTMI[id] = 1; }); } catch (e) {}
    var cp = function (to, from) { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[to] && MOB_DROPS[from]) MOB_DROPS[to] = MOB_DROPS[from].filter(function (x) { return !TTMI[x[0]]; }).map(function (x) { return x.slice(); }); };   // 天堂透視鏡道具不複製（它自己依怪名掛掉落）
    cp('火焰之影（真身）', '火焰之影'); cp('闇龍 哈爾巴斯', '巴拉卡斯'); cp('黑騎士親衛', '暗黑黑騎士');
  } catch (e) {}

  // ── 地圖 ──
  var ARENA = {
    flame: { map: 'afk_flame_depth', n: '暗影神殿最深處', boss: 'afk_hp_flame', ch: 3, bg: 'assets/area/地監深層.jpg', desc: '暗影神殿最深處的火焰祭壇。魔族之主火焰之影在這裡指揮不死的特別部隊。' },
    halpas: { map: 'afk_halpas_nest', n: '時空裂痕－闇龍的巢', boss: 'afk_hp_halpas', ch: 4, bg: 'assets/area/1920x1080/時空裂痕戰場.jpg', desc: '時空裂痕的盡頭，被吉爾塔斯喚醒的闇龍哈爾巴斯在這裡等待生命之樹。' }
  };
  Object.keys(ARENA).forEach(function (k) {
    var a = ARENA[k];
    DB.maps[a.map] = k === 'flame' ? [a.boss].concat(GUARDS) : [a.boss];
    try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([a.map]); } catch (e) {}
    try { SPECIAL_AREA_BG[a.map] = a.bg; } catch (e) {}
    try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[a.map]) MAP_DESC[a.map] = a.desc; } catch (e) {}
    try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[a.map] = a.n; } catch (e) {}
  });
  var HALPAS_LIMIT = 12000;   // 20 分鐘（tick）

  // ── 任務線 ──
  var dragonNames = function (key) { return Object.keys(DB.mobs).map(function (id) { return DB.mobs[id]; }).filter(function (m) { return m && m.boss && m.n && m.n.indexOf(key) >= 0; }).map(function (m) { return m.n; }).filter(function (n, i, a) { return a.indexOf(n) === i; }); };
  var GUARD_N = GUARDS.map(function (id) { return DB.mobs[id].n; });
  var mem = function (key, id) { return { id: id, n: key + '的記憶', img: IC('items/光明的鱗片'), d: key + '身上殘留的記憶碎片，裡面一直有個聲音在呼喚：「孩子……」', need: 1, mobs: dragonNames(key) }; };
  var line = L.defineLine({
    id: 'halpas', name: '闇龍的低語', hostIds: [NPC_ID], hostN: NPC_N,
    intro: '「我的弟弟——闇龍哈爾巴斯——被吉爾塔斯喚醒了。他忘了自己是龍，只記得飢餓。他想要生命之樹……如果讓他得到，亞丁就會從地圖上消失。」',
    outro: '「哈爾巴斯沉睡了。也許有一天，他會想起自己曾經是誰……謝謝你，替我們六龍守住了這個世界。」',
    chapters: [
      { lv: 85, title: '不死的特別部隊', map: '暗影神殿 3 樓（火焰之影親衛兵）', story: '魔族之主火焰之影派出不死的特別部隊，在亞丁各地搜尋生命之樹。從親衛兵身上把他們的密令搶過來。',
        reqs: [{ id: 'afk_q_hp_order', n: '魔族的密令', img: IC('items/密封的情報書'), d: '用魔族文字寫的密令：「找到生命之樹，獻給闇龍。」', need: 6, mobs: GUARD_N }],
        rewards: { all: ['afk_hp_helm'] }, onDone: function () { if (dia(20)) sys('<span class="text-cyan-300">奧拉奇里亞另外交給你 龍之鑽石 ×20。</span>'); } },
      { lv: 88, title: '反王的密報', map: '謀叛者的低語（反王肯恩(謀叛)）', story: '是誰把哈爾巴斯復活的消息賣給了魔族？密令的筆跡指向一個你很熟悉的名字——反王肯恩。',
        reqs: [{ id: 'afk_q_hp_letter', n: '肯恩的密信', img: IC('items/古老的交易文件'), d: '肯恩寫給火焰之影的密信：「生命之樹的位置，換我的王座。」', need: 1, mobs: ['反王肯恩(謀叛)'] }],
        rewards: { all: ['afk_hp_gloves'] }, first: DB.items.afk_reverie_crystal ? [['afk_reverie_crystal', 5]] : [] },
      { lv: 91, title: '生命之樹的種子', map: '四龍巢穴（任一階）', story: '四龍的身上都留著哈爾巴斯的呼喚。把四龍的記憶帶回來，奧拉奇里亞就能找出生命之樹的種子藏在哪裡。',
        reqs: [mem('安塔瑞斯', 'afk_q_hp_m_ant'), mem('法利昂', 'afk_q_hp_m_faf'), mem('巴拉卡斯', 'afk_q_hp_m_val'), mem('林德拜爾', 'afk_q_hp_m_lin')],
        rewards: { all: ['afk_hp_boots', SEED] },
        onDone: function () { sys('<span class="text-yellow-200">奧拉奇里亞把手放在你的額頭上：「帶著我的祝福去吧——它能替你擋下一次哈爾巴斯的吞噬。」</span>'); } },
      { lv: 95, title: '火焰之影', map: '暗影神殿最深處（找奧拉奇里亞前往）', story: '火焰之影要搶在你之前把種子獻給闇龍。到暗影神殿最深處，打倒魔族之主。',
        reqs: [{ id: 'afk_q_hp_core', n: '火焰之影的核心', img: IC('items/哀石水晶'), d: '火焰之影胸口的核心，碰到的瞬間會把手燙傷。', need: 1, mobs: ['火焰之影（真身）'] }],
        rewards: { all: ['afk_hp_flame_cloak'] }, first: [['gold', 1000000]] },
      { lv: 100, title: '闇龍', map: '時空裂痕－闇龍的巢（找奧拉奇里亞前往）', story: '哈爾巴斯已經聞到了種子的味道。在時空裂痕的盡頭擋下他——不是殺死他，是讓他再一次沉睡。',
        reqs: [{ id: 'afk_q_hp_scale', n: '闇龍的逆鱗', img: IC('items/光明的鱗片'), d: '哈爾巴斯喉嚨下唯一倒長的鱗片。', need: 1, mobs: ['闇龍 哈爾巴斯'] }],
        rewards: { all: ['afk_hp_armor'] }, first: [[SCALE, 10]] }
    ]
  });
  var chState = function (i) { var p = P(); return p ? trialQStateFor(p, L.keyOf(line, i, p.cls)) : 0; };

  // ── 進場 ──
  var run = null, lastMap = null;
  var partyN = function () { var p = P(); return 1 + ((p && p.allies) || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; }).length; };
  var hpScale = function (k, n) { return k === 'flame' ? Math.max(0.36, (1 + 0.25 * (n - 1)) / 2.75) : Math.max(4, n) / 16; };
  var canEnter = function (k) {
    var p = P(), a = ARENA[k]; if (!p) return '請先進入遊戲。';
    if (chState(a.ch) < 1) return '先接取第 ' + (a.ch + 1) + ' 章「' + line.chapters[a.ch].title + '」。';
    return null;
  };
  var enter = function (k) {
    var p = P(), a = ARENA[k], why = canEnter(k); if (!a) return false;
    if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(a.map)) return false;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    mapState.current = a.map; p.lastBattleMap = a.map;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    var n = partyN();
    run = { k: k, queue: [a.boss], scale: hpScale(k, n), n: n, start: tk(), bless: (k === 'halpas' && chState(2) === 2) ? 1 : 0, done: false };
    lastMap = a.map;
    sys('<span class="font-bold" style="color:#fde68a">奧拉奇里亞張開光之翼，把你送到了' + a.n + '。（隊伍 ' + n + ' 人：頭目 HP ×' + run.scale.toFixed(2) + (run.bless ? '；帶著奧拉奇里亞的祝福' : '') + '）</span>');
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
  var arenaOf = function (map) { var r = null; Object.keys(ARENA).forEach(function (k) { if (ARENA[k].map === map) r = k; }); return r; };
  var leave = function () { setTimeout(function () { try { if (arenaOf(mapState.current)) { setMapSelectors(TOWN); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500); };
  var watchMap = function () {
    var cur = (typeof mapState !== 'undefined') ? mapState.current : null;
    if (cur !== lastMap) { if (arenaOf(lastMap)) run = null; lastMap = cur; }
  };

  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var cur = (typeof mapState !== 'undefined') ? mapState.current : null;
      if (!arenaOf(cur)) return oSpawn.apply(this, arguments);
      var keep = function () { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; };
      if (!run || run.done || !run.queue.length || idx !== 1) return keep();
      var id = run.queue.shift(), m = B.place(idx, DB.mobs[id], { mobId: id, _hpRun: true });
      var p = P(), dream = !!(p && p.sherineDream && p.sherineMad);
      m.hp = Math.max(1, Math.round(m.hp * run.scale * (dream && run.k === 'halpas' ? 0.6 : 1))); m.curHp = m.hp;   // 席琳夢域鏡：跟四龍最終龍一樣 6 折
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
  }

  // ── 技能 ──
  var member = function () { return B.party(); };
  var mhpOf = function (t) { return Number(t.mhp) || 1; };
  var cast = function (mob, sk) { try { castMobMagic(mob, sk); } catch (e) {} };
  var nameOf = function (t) { return t === P() ? '你' : esc(t._allyName || '傭兵'); };
  var resFire = function (t) { var r = t === P() ? Number(t.d && t.d.resFire) || 0 : Number(t.resFire) || 0; return Math.max(0.3, 1 - r / 150); };
  var summonScaled = function (id, n, mult) {
    var got = 0;
    for (var i = 0; i < n; i++) {
      var ms = mobs(), j = -1;
      for (var q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
      if (j < 0) break;
      var m = B.place(j, DB.mobs[typeof id === 'function' ? id(i) : id], { mobId: typeof id === 'function' ? id(i) : id });
      if (mult && mult !== 1) { m.hp = m.curHp = Math.round(m.hp * mult); }
      got++;
    }
    try { if (got && !S().ff) renderMobs(); } catch (e) {}
    return got;
  };
  var hpTick = function () {
    var t = tk(), p = P(); if (!p) return;
    if (run && !run.done && run.k === 'halpas' && arenaOf(mapState.current) === 'halpas' && t - run.start >= HALPAS_LIMIT) {
      run.done = true;
      sys('<span class="text-red-400 font-bold">20 分鐘過去了——哈爾巴斯咬住生命之樹的氣息，鑽進了時空的裂縫。挑戰失敗。</span>');
      leave(); return;
    }
    mobs().forEach(function (m) {
      if (!alive(m)) return;
      var hf = m.curHp / (m.hp || 1);
      // 既有 Boss 重做
      if (m.n === '反王肯恩' && !m._hpGuard && hf <= 0.5) { m._hpGuard = true; var g = summonScaled('afk_hp_kenn_guard', 2); if (g) clog('<span class="font-bold" style="color:#a3a3a3">【黑騎士親衛】</span>反王肯恩：「親衛隊！」——' + g + ' 名黑騎士親衛衝了出來。'); }
      if (m.n === '死亡騎士' && !m._hpOath && hf <= 0.3 && DK_SKEL.length) { m._hpOath = true; var s = summonScaled(function (i) { return DK_SKEL[i % DK_SKEL.length]; }, 4); if (s) clog('<span class="font-bold" style="color:#94a3b8">【死亡騎士的誓約】</span>死亡騎士把劍插進地面——' + s + ' 隻骷髏爬了出來。'); }
      if (!m.afkHp) return;
      if (B.halted(m)) { ['_hpA', '_hpB', '_hpC', '_hpMarkAt'].forEach(function (k) { if (m[k]) m[k]++; }); return; }
      if (m._hpA == null) { m._hpA = t + 200; m._hpB = t + 180; m._hpC = t + 300; m._hpFire = t; }
      if (m.afkHp === 'flame') {
        if (t - m._hpFire >= 10) { m._hpFire = t; member().forEach(function (x) { B.hurt(x, mhpOf(x) * 0.01 * resFire(x), false); }); }
        [0.8, 0.6, 0.4, 0.2].forEach(function (th, k) {
          var f = '_hpG' + k; if (m[f] || hf > th) return; m[f] = true;
          var got = summonScaled(function () { return GUARDS[Math.floor(Math.random() * GUARDS.length)]; }, 4, 3 * (run ? run.scale : 1));
          if (got) clog('<span class="font-bold" style="color:#fb923c">【親衛隊召集】</span>火焰之影召喚了 ' + got + ' 名親衛兵。');
        });
        if (!m._hpMark && t >= m._hpA) {
          m._hpA = t + 200; var ms = member().slice().sort(function () { return Math.random() - 0.5; }).slice(0, 2);
          if (ms.length) { m._hpMark = ms; m._hpMarkAt = t + 30; clog('<span class="font-bold" style="color:#ef4444">【煉獄火柱】</span>火焰之影標記了' + ms.map(nameOf).join('、') + '——3 秒後爆炸，傷害由全隊分攤。'); }
        }
        if (m._hpMark && t >= m._hpMarkAt) {
          var tot = m._hpMark.reduce(function (s, x) { return s + mhpOf(x) * 0.3; }, 0), all = member(); m._hpMark = null;
          if (all.length) { var each = tot / all.length; all.forEach(function (x) { B.hurt(x, each * resFire(x), false); }); clog('<span class="font-bold" style="color:#ef4444">【煉獄火柱】</span>火柱炸開——全隊各分攤 ' + Math.round(each) + ' 點傷害。'); }
        }
        if (!m._hpUndying && hf <= 0.1) { m._hpUndying = t + 200; m._hpRegen = t; clog('<span class="font-bold" style="color:#fbbf24">【不死之焰】</span>火焰之影燃起不死之焰——20 秒內每秒回復 1% HP，要在火熄滅前打倒他！'); }
        if (m._hpUndying && t < m._hpUndying && t - m._hpRegen >= 10) { m._hpRegen = t; m.curHp = Math.min(m.hp, m.curHp + Math.round(m.hp * 0.01)); }
      } else if (m.afkHp === 'halpas') {
        var phase = hf > 0.7 ? 1 : hf > 0.35 ? 2 : 3;
        if (phase !== m._hpPhase) { m._hpPhase = phase; clog(['', '', '<span class="font-bold" style="color:#a78bfa">【記憶的回音】</span>哈爾巴斯的眼睛裡閃過四種顏色——他開始借用兄姊們的招式。', '<span class="font-bold" style="color:#e879f9">【生命之樹的飢渴】</span>哈爾巴斯張開大口，空氣開始被吸進他的喉嚨。'][phase]); }
        if (phase === 1 && t >= m._hpB) { m._hpB = t + 180; clog('<span class="font-bold" style="color:#818cf8">【闇之吐息】</span>哈爾巴斯吐出漆黑的龍息。'); cast(m, BREATH); }
        if (phase === 2 && t >= m._hpB) { m._hpB = t + 200; var e = ECHO[(m._hpEcho = ((m._hpEcho == null ? -1 : m._hpEcho) + 1) % ECHO.length)]; clog('<span class="font-bold" style="color:#a78bfa">【記憶的回音】</span>哈爾巴斯想起了' + e.from + '——' + e.skn.split('・')[1] + '！'); cast(m, e); }
        if (phase === 3 && t >= m._hpC) {
          m._hpC = t + 300;
          if (run && run.bless > 0) { run.bless--; clog('<span class="font-bold" style="color:#fde68a">【奧拉奇里亞的祝福】</span>一道金光擋在隊伍前面——吞噬被擋下了。', 'player'); }
          else {
            var sum = 0; member().forEach(function (x) { sum += B.hurt(x, mhpOf(x) * 0.1); });
            var heal = Math.min(Math.round(m.hp * 0.03), sum * 10); m.curHp = Math.min(m.hp, m.curHp + heal);
            clog('<span class="font-bold" style="color:#e879f9">【吞噬】</span>哈爾巴斯吸走了全隊 10% 的生命（回復 ' + heal.toLocaleString() + ' HP）。');
          }
        }
      }
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      try { watchMap(); } catch (e) {}
      var t0 = tk(), r = oTick.apply(this, arguments);
      if (tk() !== t0) { try { hpTick(); } catch (e) { console.warn('[AFK-halpas] tick', e); } }
      return r;
    };
  }
  // 篡位者的威壓：反王肯恩活著時，精準目標的加成減半
  if (typeof W.fragileMult === 'function') {
    var oFrag = W.fragileMult;
    W.fragileMult = function (t) {
      var r = oFrag.apply(this, arguments);
      try {
        if (t && t.n === '反王肯恩' && alive(t)) {
          var p = P(), pp = null;
          if (p.buffs && p.buffs.sk_royal_precise > 0) pp = p;
          else (p.allies || []).forEach(function (a) { if (!pp && a && !a._downed && a.buffs && a.buffs.sk_royal_precise > 0) pp = a; });
          if (pp) { var b = (1 + (pp.lv || 1) / (pp.mastery === 'k_royal_pledge' ? 10 : 15)) / 100; r = r / (1 + b) * (1 + b / 2); }
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 擊殺 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], cur = mapState.current, r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._hpRun && !m._hpDone && run && !run.done && arenaOf(cur) === run.k) {
          m._hpDone = true; run.done = true;
          var p = P(), got = [];
          if (run.k === 'flame') {
            if (CRYSTAL && DB.items[CRYSTAL]) { var c = 30 + Math.floor(Math.random() * 31); gainItem(CRYSTAL, c, true); got.push(DB.items[CRYSTAL].n + ' ×' + c); }
            if (Math.random() < 0.02) { gainItem('afk_hp_flame_cloak', 1, true); got.push('<span class="text-orange-300 font-bold">火焰之影的斗篷</span>'); }
            p.afkHpStats = p.afkHpStats || {}; p.afkHpStats.flame = (p.afkHpStats.flame || 0) + 1;
            sys('<span class="text-yellow-300 font-bold">🏆 火焰之影的身軀崩成了灰燼。</span>' + (got.length ? '你得到了：' + got.join('、') + '。' : ''));
          } else {
            p.afkHpStats = p.afkHpStats || {}; p.afkHpStats.halpas = (p.afkHpStats.halpas || 0) + 1;
            if (p._afkHpDay !== dayKey()) {
              p._afkHpDay = dayKey(); var s = 3 + Math.floor(Math.random() * 3); gainItem(SCALE, s, true); got.push(DB.items[SCALE].n + ' ×' + s);
              if (Math.random() < 0.1) { gainItem(HEART, 1, true); got.push('<span class="text-fuchsia-300 font-bold">' + DB.items[HEART].n + '</span>'); }
            }
            sys('<span class="text-yellow-300 font-bold">🏆 哈爾巴斯發出一聲長長的龍吟，閉上了眼睛——他又沉睡了。</span>' + (got.length ? '你得到了：' + got.join('、') + '。' : '（今天的鱗片已經領過了）'));
          }
          leave();
        }
      } catch (e) { console.warn('[AFK-halpas] kill', e); }
      return r;
    };
  }

  // ── 奧拉奇里亞：入口與交換 ──
  var EXCH = [
    { key: 'dia', n: '龍之鑽石 ×10', cost: 5, give: function () { return dia(10) ? null : '龍之鑽石帳戶暫時無法使用。'; } },
    { key: 'helm', id: 'afk_hp_helm', cost: 8 }, { key: 'gloves', id: 'afk_hp_gloves', cost: 8 }, { key: 'boots', id: 'afk_hp_boots', cost: 8 }, { key: 'armor', id: 'afk_hp_armor', cost: 12 },
    { key: 'eye', id: 'afk_hp_eye', cost: 20, heart: 1 }
  ];
  var exchange = function (key) {
    var x = EXCH.filter(function (e) { return e.key === key; })[0]; if (!x) return '沒有這個選項。';
    if (K.have(SCALE) < x.cost) return DB.items[SCALE].n + '不夠（需要 ' + x.cost + '）。';
    if (x.heart && K.have(HEART) < x.heart) return '需要' + DB.items[HEART].n + '。';
    if (x.give) { var err = x.give(); if (err) return err; }
    K.take(SCALE, x.cost); if (x.heart) K.take(HEART, x.heart);
    if (x.id) gainItem(x.id, 1, true);
    sys('<span class="text-indigo-300">' + esc(NPC_N) + '收下 ' + x.cost + ' 片' + esc(DB.items[SCALE].n) + (x.heart ? '與' + esc(DB.items[HEART].n) : '') + '，交給你 ' + esc(x.id ? DB.items[x.id].n : x.n) + '。</span>');
    try { renderTabs(true); saveGame(); } catch (e) {}
    return null;
  };
  var ui = { err: '' };
  var paint = function (div) {
    var box = div.querySelector('#afk-hp-panel'); if (!box) return;
    var p = P(); if (!p) return;
    var st = p.afkHpStats || {}, today = p._afkHpDay === dayKey();
    var h = '<div class="ax-h">闇龍的低語・挑戰</div>';
    h += K.rowHtml({ key: 'flame', name: '前往暗影神殿最深處（火焰之影（真身））', color: '#fdba74',
      desc: 'Lv96、HP 40 萬（以 8 人隊為準，人少會變少）。業火領域、親衛隊召集、煉獄火柱、不死之焰。次數不限。打倒 ' + (st.flame || 0) + ' 次。', why: canEnter('flame') || '', btns: [['go:flame', '前往', !canEnter('flame')]] }, 'data-hp');
    h += K.rowHtml({ key: 'halpas', name: '前往時空裂痕－闇龍的巢（闇龍 哈爾巴斯）', color: '#c4b5fd',
      desc: 'Lv105、HP 150 萬 ×（隊伍人數 ÷ 16，最少 4 人份）、20 分鐘限時。闇之吐息 → 四龍的招式 → 吞噬。完成第 3 章的人帶著奧拉奇里亞的祝福（擋一次吞噬）。次數不限；每天第一次打倒給闇龍的鱗片。打倒 ' + (st.halpas || 0) + ' 次，今天的鱗片：' + (today ? '已領' : '還沒領') + '。',
      why: canEnter('halpas') || '', btns: [['go:halpas', '前往', !canEnter('halpas')]] }, 'data-hp');
    h += '<div class="ax-h">用闇龍的鱗片交換</div>' + K.matBar([SCALE, HEART]);
    EXCH.forEach(function (x) {
      var ok = K.have(SCALE) >= x.cost && (!x.heart || K.have(HEART) >= x.heart);
      h += K.rowHtml({ key: x.key, ico: x.id ? K.itemIco(x.id) : '', name: esc(x.id ? DB.items[x.id].n : x.n), color: '#c7d2fe',
        req: K.reqTxt(K.have(SCALE), x.cost, DB.items[SCALE].n) + (x.heart ? '　' + K.reqTxt(K.have(HEART), x.heart, DB.items[HEART].n) : ''), btns: [['x:' + x.key, '交換', ok]] }, 'data-hp');
    });
    if (ui.err) h += '<div class="ax-err">' + esc(ui.err) + '</div>';
    K.repaint(box, h);
  };
  var renderPanel = function (div) {
    if (!div) return; K.css(); ui.err = '';
    var old = div.querySelector('#afk-hp-panel'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-hp-panel'; div.appendChild(box);
    paint(div);
    if (!div.__afkHpBound) {
      div.__afkHpBound = true;
      div.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-hp]'); if (!b || b.disabled || !div.querySelector('#afk-hp-panel')) return;
        var a = b.getAttribute('data-hp');
        if (a.indexOf('go:') === 0) { enter(a.slice(3)); return; }
        if (a.indexOf('x:') === 0) { ui.err = exchange(a.slice(2)) || ''; paint(div); }
      });
    }
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) renderPanel(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-halpas] ui', e); }
      return r;
    };
  }
  // 交付章節後重畫時，挑戰面板要留在最下面
  var rr = 'afkLoreRender_halpas', oRR = W[rr];
  if (typeof oRR === 'function') W[rr] = function (div) { oRR(div); try { renderPanel(div); } catch (e) {} };

  W.__afkHalpas = { line: line, ARENA: ARENA, SET: SET, SCALE: SCALE, HEART: HEART, SEED: SEED, EXCH: EXCH, enter: enter, canEnter: canEnter, exchange: exchange,
    run: function () { return run; }, tick: hpTick, hpScale: hpScale, partyN: partyN, renderPanel: renderPanel, LIMIT: HALPAS_LIMIT };
})();
