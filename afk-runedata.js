/* ============================================================================
 * afk-runedata.js — 符文石與時空裂痕新材料的資料（玩家 2026-10-29 晚，設計稿 docs/runes-design.md 第三版）
 *
 * 不是開關：只登錄物品與資料表，給 afk-runes（佐爾頓：開孔、鑲嵌、兌換）與 afk-rift2（時空裂痕）使用。
 *   ‧32 顆符文（三階段：一＝補助、藥水；二＝減傷、寵物；三＝攻擊、套裝、職業）
 *   ‧失去光芒的符文石（階段一／二／三）：打開隨機給該階段一顆符文
 *   ‧哀石塵埃／哀石碎片／哀石（時空裂痕席琳／瘋狂席琳／夢域鏡掉落）→ 各 150 換 1 顆 哀石水晶／哀石精華／哀石結晶
 *   ‧瘴氣魔石／骸骨魔石／破空石（時空裂痕完全通關）→ 1,000＋500＋100 換 1 顆解命石（開瘴骸·破等級的孔）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var IMG = function (n) { return 'assets/icons/items/' + n + '.png'; };
  var STAGE_C = { 1: 'text-slate-200', 2: 'text-sky-300', 3: 'text-rose-400' };
  var STAGE_N = { 1: '階段一', 2: '階段二', 3: '階段三' };
  // 單符文效果（數字在 afk-runes 實作；這裡是說明文字）
  var RUNES = [
    ['hui', '穗', 1, 'aid', '材料掉落 +15%（全身最多算 2 顆）'],
    ['feng', '豐', 1, 'aid', '金幣 +25%、經驗 +10%（最多 2 顆）'],
    ['xun', '尋', 1, 'aid', '遺物掉落判定 +25%（最多 2 顆，跟幸運暴走兔腳相乘；時空裂痕裡不算）'],
    ['shi', '拾', 1, 'aid', '夢域專屬材料 +25%：夢域塵、回夢香塵、闇龍的抵抗者碎片、之魂（最多 2 顆）'],
    ['quan', '泉', 1, 'potion', '藥水回復量 +25%（最多 2 顆）'],
    ['shun', '瞬', 1, 'potion', '藥水冷卻 −25%（最多 2 顆）'],
    ['ni', '逆', 1, 'potion', '不受「死亡藥水」影響：喝治癒藥水照樣補血'],
    ['yin', '飲', 1, 'potion', '一次喝三罐：扣 3 瓶、回復 ×3，冷卻不變'],
    ['dun', '盾', 2, 'guard', '受到的物理傷害 −6%（最多 2 顆）'],
    ['zhao', '罩', 2, 'guard', '受到的魔法傷害 −6%（最多 2 顆）'],
    ['jing', '淨', 2, 'guard', '受到的屬性傷害 −8%（最多 2 顆）'],
    ['hai', '骸', 2, 'guard', '受到的真實傷害 −10%（最多 2 顆）'],
    ['zong', '鬃', 2, 'pet', '寵物基本屬性 +15%（最多 2 顆）'],
    ['ya', '牙', 2, 'pet', '寵物多學 1 個技能（最多 2 顆）（效果製作中）'],
    ['qi', '契', 2, 'pet', '寵物繼承主人面板 30% → 40%（兩顆 50%）'],
    ['meng', '夢', 3, 'set', '夢域席琳套裝的百分比效果 +20%（只放大多出來的部分）'],
    ['yan', '魘', 3, 'set', '夢域席琳套裝的能力加成（力量、命中、魔防這類固定數值）×1.5'],
    ['hun', '魂', 3, 'set', '席琳套裝需要的件數 −1，可以跟之魂疊加（最少 1 件）'],
    ['ming', '冥', 3, 'set', '夢域套裝的吸血 ×1.5，受到的傷害 −5%'],
    ['lei', '雷', 3, 'attack', '魔法二次傷害：魔法命中後 20% 機率再打 50%'],
    ['lie', '裂', 3, 'attack', '所有二次傷害可以爆擊（沒有這顆時二次傷害一律不爆擊）（效果製作中）'],
    ['jian', '濺', 3, 'attack', '濺射 A：爆擊率不用滿 80%，爆擊時濺射 20% 給其他敵人（從主目標扣）'],
    ['po', '破', 3, 'attack', '無視目標 20% 的減傷與防禦'],
    ['zhan', '斬', 3, 'attack', '對頭目傷害 +15%'],
    ['shi_k', '誓', 3, 'class', '騎士：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['ye', '葉', 3, 'class', '妖精：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['zhi', '識', 3, 'class', '法師：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['ying', '影', 3, 'class', '黑暗妖精：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['guan', '冠', 3, 'class', '王族：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['lin', '鱗', 3, 'class', '龍騎士：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['huan', '幻', 3, 'class', '幻術士：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）'],
    ['nu', '怒', 3, 'class', '戰士：指定技能常駐（增益）或每 8 秒自動施放（攻擊）（效果製作中）']
  ];
  var CLASS_OF = { shi_k: 'knight', ye: 'elf', zhi: 'mage', ying: 'dark', guan: 'royal', lin: 'dragon', huan: 'illusion', nu: 'warrior' };
  var CAT_N = { aid: '補助', potion: '藥水', guard: '減傷', pet: '寵物', set: '套裝', attack: '攻擊', 'class': '職業' };
  var SLOT_CATS = { weapon: ['attack', 'set', 'class'], armor: ['guard', 'potion', 'pet'], acc: ['aid'] };
  var list = RUNES.map(function (r) { return { id: 'afk_rune_' + r[0], key: r[0], ch: r[1], stage: r[2], cat: r[3], d: r[4], cls: CLASS_OF[r[0]] || null }; });
  var byId = {}; list.forEach(function (r) { byId[r.id] = r; });
  // 符文之語：照孔的順序比對（'職'＝任一顆職業符文）。武器：相鄰兩孔（1→2、2→3）或三孔；防具：同一件的 1→2 孔。
  //   三符文之語成立時，裡面包含的兩符文之語不另外算；同名符文之語全身最多算 2 次。
  var WORDS = [
    ['bulwark', '壁壘', 'armor', '盾罩', '物理、魔法傷害再各 −3%'],
    ['pure', '無垢', 'armor', '淨骸', '屬性、真實傷害再各 −5%'],
    ['sanct', '聖域', 'armor', '罩逆', '「減少治療」的效果減半'],
    ['uncurse', '解咒', 'armor', '逆淨', '也不受「死亡治療」影響'],
    ['nectar', '甘露', 'armor', '泉飲', '一次喝三罐只扣 2 瓶'],
    ['spring', '湧泉', 'armor', '瞬泉', '每次喝藥水 20% 機率不進冷卻'],
    ['beastking', '獸王', 'armor', '鬃牙', '寵物技能觸發率 +30%（效果製作中）'],
    ['bond', '同心', 'armor', '契鬃', '寵物受到的傷害 −30%（效果製作中）'],
    ['shatter', '碎陣', 'weapon', '濺破', '濺射 B：爆擊率不用滿 80%，濺射 35%（取代 A），從主目標扣'],
    ['thunder', '雷裂', 'weapon', '雷裂', '魔法二次傷害的機率 20% → 35%'],
    ['regicide', '弒王', 'weapon', '斬破', '對頭目傷害再 +10%'],
    ['nightmare', '夢魘', 'weapon', '夢魘', '夢域套裝百分比效果再 +10%'],
    ['pact', '冥契', 'weapon', '魂冥', '夢域套裝的吸血再 ×1.3'],
    ['dreamhunt', '獵夢', 'weapon', '夢斬', '對夢域的敵人傷害 +15%'],
    ['mastery', '專精', 'weapon', '職斬', '指定技能（傷害格）的傷害 +30%（效果製作中）'],
    ['awaken', '覺醒', 'weapon', '職裂', '指定技能（冷卻格）的冷卻 −30%（效果製作中）'],
    ['skyfall', '天崩', 'weapon', '濺破裂', '濺射 C：爆擊率滿 80% 時濺射 50%，主目標不扣'],
    ['judgment', '雷霆審判', 'weapon', '雷裂斬', '魔法二次傷害改成 100% 傷害'],
    ['eternal', '永夢', 'weapon', '夢魘魂', '夢域套裝效果再 +15%'],
    ['grace', '席琳的眷顧', 'weapon', '魂冥夢', '夢域套裝吸血 ×2，受到的傷害再 −5%'],
    ['dragonslay', '屠龍', 'weapon', '斬破濺', '對四龍（含各階型態）傷害 +25%'],
    ['zenith', '極意', 'weapon', '職雷裂', '指定技能也會觸發二次傷害（效果製作中）'],
    ['kingsway', '王道', 'weapon', '職斬破', '指定技能傷害 +50%，無視 20% 減傷（效果製作中）'],
    ['styx', '冥河', 'weapon', '冥斬裂', '擊殺時回復 3% 最大 HP']
  ].map(function (w) { return { id: w[0], n: w[1], where: w[2], seq: w[3].split(''), d: w[4] }; });
  var ITEMS = {};
  list.forEach(function (r) {
    ITEMS[r.id] = { n: r.ch + '之符文', c: STAGE_C[r.stage], img: IMG('符文(' + r.ch + ')'),
      d: '【符文石・' + STAGE_N[r.stage] + '・' + CAT_N[r.cat] + '】' + r.d + '。在說話之島的符文師佐爾頓那裡鑲進' + (r.cat === 'aid' ? '飾品或腰帶' : (SLOT_CATS.armor.indexOf(r.cat) >= 0 ? '防具' : '武器')) + '的星蝕·解孔。' };
  });
  var BOX = { 1: 'afk_runebox_1', 2: 'afk_runebox_2', 3: 'afk_runebox_3' };
  var SRC = { 1: '時空裂痕（席琳模式）', 2: '時空裂痕（瘋狂席琳模式）', 3: '時空裂痕（夢域鏡席琳模式）' };
  [1, 2, 3].forEach(function (s) {
    ITEMS[BOX[s]] = { n: '失去光芒的符文石（' + STAGE_N[s] + '）', c: STAGE_C[s], img: IMG('失去光芒的符文石(階段' + s + ')'), eff: 'afk_runebox', stage: s,
      d: '黯淡無光的符文石，握在手裡才微微發熱。使用後隨機變成一顆' + STAGE_N[s] + '的符文（' + list.filter(function (r) { return r.stage === s; }).map(function (r) { return r.ch; }).join('、') + '）。' + SRC[s] + '的結算獎勵。' };
  });
  var LAMENT = {
    afk_lament_dust: ['哀石塵埃', 'text-slate-300', '時空裂痕（席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。'],
    afk_lament_shard: ['哀石碎片', 'text-violet-300', '時空裂痕（瘋狂席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。'],
    afk_lament_stone: ['哀石', 'text-teal-300', '時空裂痕（夢域鏡席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。500 個可以請佐爾頓把一顆符文完整拆下來。'],
    afk_lament_crystal: ['哀石水晶', 'text-sky-200', '佐爾頓：哀石塵埃 150 個換 1 個。鑲入階段一符文每次 5 個。'],
    afk_lament_essence: ['哀石精華', 'text-violet-300', '佐爾頓：哀石碎片 150 個換 1 個。鑲入階段二符文每次 10 個。'],
    afk_lament_gem: ['哀石結晶', 'text-rose-300', '佐爾頓：哀石 150 個換 1 個。鑲入階段三符文每次 20 個；戒指、項鍊、耳環開孔 5 個。'],
    afk_miasma_stone: ['瘴氣魔石', 'text-lime-300', '時空裂痕（席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_bone_stone: ['骸骨魔石', 'text-stone-200', '時空裂痕（瘋狂席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_void_stone: ['破空石', 'text-cyan-300', '時空裂痕（夢域鏡席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_fate_unlock: ['解命石', 'text-yellow-300', '佐爾頓：瘴氣魔石 1,000、骸骨魔石 500、破空石 100 換 1 個。用來打開瘴骸·破等級的符文孔（武器第三孔、腰帶三孔）。']
  };
  var LIMG = { afk_lament_dust: '哀石塵埃', afk_lament_shard: '哀石碎片', afk_lament_stone: '哀石', afk_lament_crystal: '哀石水晶', afk_lament_essence: '哀石精華', afk_lament_gem: '哀石結晶', afk_miasma_stone: '瘴氣魔石', afk_bone_stone: '骸骨魔石', afk_void_stone: '破空石', afk_fate_unlock: '解命石' };
  Object.keys(LAMENT).forEach(function (id) { var x = LAMENT[id]; ITEMS[id] = { n: x[0], c: x[1], img: IMG(LIMG[id]), d: x[2] }; });
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, img: x.img, noUse: !x.eff, gachaWeight: 0, d: x.d };
    if (x.eff) { DB.items[id].eff = x.eff; DB.items[id].runeStage = x.stage; }
    try { if (typeof miscCatKey === 'function' && typeof MISC_CAT_ITEMS !== 'undefined') { var k = miscCatKey(id, DB.items[id]); if (k && MISC_CAT_ITEMS[k] && !MISC_ITEM_CAT[id]) { MISC_CAT_ITEMS[k].push(id); MISC_ITEM_CAT[id] = k; if (typeof OBTAINABLE_MISC !== 'undefined') OBTAINABLE_MISC[id] = true; } } } catch (e) {}
  });
  // 失去光芒的符文石：使用＝打開
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var openBox = function (it) {
    var p = P(), d = DB.items[it.id], s = d.runeStage;
    var pool = list.filter(function (r) { return r.stage === s; });
    var r = pool[Math.floor(Math.random() * pool.length)];
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    gainItem(r.id, 1, true, true);
    try { logSys('<span class="' + STAGE_C[s] + ' font-bold">符文石重新亮了起來：' + DB.items[r.id].n + '。</span>'); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(); saveGame(); } catch (e) {}
    return r.id;
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }), d = it && DB.items[it.id];
      if (d && d.eff === 'afk_runebox') { if (it.lock) return; openBox(it); try { if (typeof closeModal === 'function') { var left = p.inv.find(function (x) { return x.uid === uid; }); if (left && typeof openModal === 'function') openModal(left, false); else closeModal(); } } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
  }
  W.__afkRuneData = { list: list, byId: byId, WORDS: WORDS, CAT_N: CAT_N, SLOT_CATS: SLOT_CATS, STAGE_N: STAGE_N, STAGE_C: STAGE_C, BOX: BOX, CLASS_OF: CLASS_OF,
    DUST: { sherine: 'afk_lament_dust', mad: 'afk_lament_shard', dream: 'afk_lament_stone' },
    CUR: { 1: 'afk_lament_crystal', 2: 'afk_lament_essence', 3: 'afk_lament_gem' },
    EXCHANGE: { afk_lament_dust: 'afk_lament_crystal', afk_lament_shard: 'afk_lament_essence', afk_lament_stone: 'afk_lament_gem' }, EX_RATE: 150,
    FATE: { id: 'afk_fate_unlock', need: { afk_miasma_stone: 1000, afk_bone_stone: 500, afk_void_stone: 100 } },
    CLEAR: { sherine: ['afk_miasma_stone', 100], mad: ['afk_bone_stone', 50], dream: ['afk_void_stone', 10] },
    INLAY: { 1: 5, 2: 10, 3: 20 }, REMOVE: ['afk_lament_stone', 500], openBox: openBox };
})();
