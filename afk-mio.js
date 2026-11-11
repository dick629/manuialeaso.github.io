/* ============================================================================
 * afk-mio.js — 密奧之卡（塔羅牌 22 張）第二版（玩家 2026-11-02 13:10 定案；設計稿 docs/mio-sigil-design.md 第四版；外掛開關 mio；經典模式沒有）
 *
 *   一、取得：席琳夢域鏡裡一般怪物 0.001%、頭目 0.1% 掉「密奧碎片」，乘隊伍人數（最多 ×16）；
 *       碎片不受隱藏規則十二（夢域鏡隊伍人數不加掉寶）影響。
 *       碎片 ×10 點亮一張還沒點亮的卡（偉特）；×20 升托特；×30 升馬賽。
 *   二、裝備：密奧欄位（裝備視窗第二頁、刻印下面）只能裝一張。
 *       ‧裝著的卡：用它目前階段的特效；托特以上另外有「保底」與「光環」：
 *           保底＝最大 HP、傷害減免、魔防、防禦、迴避、額外傷害、額外命中低於職業標準的補到標準（托特＝曲線 65、馬賽＝曲線 75）
 *           光環＝托特：五屬性抗性 +15；馬賽：五屬性抗性 +25、異常狀態抵抗 +15%
 *       ‧其他點亮的卡：全部一起給偉特的特效（「世界」會放大這些偉特）。
 *   三、收集加成（可疊加）：全部點亮＝最大 HP +5%、五屬性抗性 +10；全部托特以上＝造成傷害 +5%、受到傷害 −5%；
 *       全部馬賽＝造成傷害 +10%、受到傷害 −10%。
 *   四、淵源解放（玩家 2026-11-06 13:02；設計稿 docs/mio-liberation-design.md）：22 張全部淵源才開放；每張卡各付一次
 *       （密奧碎片 50,000＋龍之鑽石 100,000＋金幣 50 億＋夢艷結晶 100,000＋席琳結晶 100,000）。裝著解放的那張：特效換解放值、
 *       光環（五屬性抗性 +50、異常抵抗 +25%、異常持續 −20%、負重上限 +2,000）、保底曲線 95。22 張全部解放：造成傷害 +5%、受到傷害 −5%。
 *       進過次元裂縫之後就不能再解放（已經解放的不受影響）。
 *   觸發時角色頭上浮出卡的小圖和卡名，戰鬥日誌同一張卡每 5 秒最多一行（共用 afk-procfx.js）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mio', name: '密奧之卡（塔羅牌）', group: '遊戲內容', seal: true,
    desc: '席琳夢域鏡掉密奧碎片，點亮 22 張塔羅牌（偉特→托特→馬賽）；每張有自己的特效，裝著的那張托特以上另有保底與光環，其他點亮的卡給偉特特效' });
  if (T && !T.enabled('mio')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var on = function (p) { return !!(p && !p.classicMode); };
  var tk = function () { return (typeof state !== 'undefined' && state) ? (Number(state.ticks) || 0) : 0; };
  var rnd = function () { return api.roll(); };

  var SHARD = 'afk_mio_shard', RATE = { mob: 0.00001, boss: 0.001 }, COST = [10, 20, 30];
  var STAGE = ['', '偉特', '托特', '馬賽', '淵源', '起源', '創世'], STAGE_C = ['', '#93c5fd', '#c4b5fd', '#fcd34d', '#f472b6', '#22d3ee', '#fef3c7'];
  // ── 次元升級（玩家 2026-11-05 20:50／21:34；設計稿 docs/mio-dimension-design.md）──
  //   馬賽 → 淵源：密奧碎片 500＋龍之鑽石 100,000＋金幣 5 億（現在開放）
  //   淵源 → 起源：次元密奧卡 100＋血龍鑽 500＋金幣 1 億；起源 → 創世：次元密奧卡 500＋血龍鑽 1,000＋金幣 5 億（次元裂縫開放後）
  //   淵源以上：特效照馬賽；裝著時另有「次元效果」（只在次元裂縫生效，裂縫開放後接上）；保底曲線 80（起源、創世之後量）；光環見 AURA。
  var DIM_CARD = 'afk_mio_dim', BLOOD = 'afk_blood_dia';
  var UP_COST = { 4: { shard: 500, dia: 100000, gold: 500000000 }, 5: { dim: 100, blood: 500, gold: 100000000 }, 6: { dim: 500, blood: 1000, gold: 500000000 } };
  var DIM_RATE = { mob: 0.00002, boss: 0.002 };
  // 淵源解放（每張卡各付一次；22 張全部淵源才開放）
  var DREAM_X = 'afk_dream_crystal', SHER_X = 'sherine_crystal';
  var LIB_COST = { shard: 50000, dia: 100000, gold: 5000000000, dream: 100000, sherine: 100000 };
  var riftOpen = function () { try { return !!(W.__afkDimRiftOn && W.__afkDimRiftOn()); } catch (e) { return false; } };
  var maxStage = function () { return riftOpen() ? 6 : 4; };
  var ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  // 每張卡：名字、各階段數值（[偉特, 托特, 馬賽]）、說明
  var CARDS = [
    ['愚者', { red: [30, 75, 100], cd: [90, 45, 30] }, function (v) { return '每 ' + v.cd + ' 秒，下一次受到的傷害 −' + v.red + '%'; }],
    ['魔術師', { ch: [4, 10, 15] }, function (v) { return '攻擊魔法 ' + v.ch + '% 機率再施放一次（傷害 ×2，不耗 MP）'; }],
    ['女祭司', { pct: [1, 2, 3], dur: [5, 8, 10], cd: [90, 60, 60] }, function (v) { return 'MP 低於 30% 時，' + v.dur + ' 秒內每秒回復最大 MP ' + v.pct + '%（冷卻 ' + v.cd + ' 秒）'; }],
    ['女皇', { pct: [15, 35, 50] }, function (v) { return '喝治癒藥水時，傭兵全隊也回同樣回復量的 ' + v.pct + '%'; }],
    ['皇帝', { pct: [2, 5, 8] }, function (v) { return '傭兵受到的傷害 −' + v.pct + '%'; }],
    ['教皇', { ch: [10, 25, 35], heal: [2, 5, 8] }, function (v) { return '中異常狀態時 ' + v.ch + '% 機率立刻解除，並回復最大 HP ' + v.heal + '%'; }],
    ['戀人', { pct: [2, 5, 8] }, function (v) { return '每 5 秒，你和傭兵裡 HP 比例最低的' + ((v.n || 1) > 1 ? ' ' + v.n + ' 位各' : '那位') + '回復最大 HP ' + v.pct + '%'; }],
    ['戰車', { per: [1, 2, 2], max: [5, 8, 10] }, function (v) { return '一般攻擊連續打同一個目標，每下傷害 +' + v.per + '%，最多 ' + v.max + ' 層'; }],
    ['力量', { pct: [10, 25, 40] }, function (v) { return '一般攻擊爆擊時，傷害再 +' + v.pct + '%'; }],
    ['隱者', { per: [0.3, 1, 1.5] }, function (v) { return '比 16 人每少 1 人，造成的傷害 +' + v.per + '%（最多 15 人份）'; }],
    ['命運之輪', { dmg: [4, 9, 12], red: [4, 9, 12], reg: [0.7, 1.5, 2] }, function (v) { return '每 30 秒隨機得到一種，持續 30 秒：造成傷害 +' + v.dmg + '%／受到傷害 −' + v.red + '%／每秒回復最大 HP ' + v.reg + '%'; }],
    ['正義', { pct: [20, 50, 80] }, function (v) { return '受到攻擊時，對攻擊者反擊這次傷害的 ' + v.pct + '%（每秒最多一次）'; }],
    ['吊人', { pct: [10, 25, 35] }, function (v) { return 'HP 低於 ' + (v.th || 30) + '% 時受到的傷害 −' + v.pct + '%'; }],
    ['死神', { pct: [5, 15, 20] }, function (v) { return '一般怪物 HP 低於 ' + v.pct + '% 時直接斬殺（頭目不算）'; }],
    ['節制', { pot: [5, 20, 30], cap: [3, 8, 12] }, function (v) { return '治癒藥水回復量 +' + v.pot + '%；補滿溢出的部分變成護盾（最多最大 HP ' + v.cap + '%）'; }],
    ['惡魔', { leech: [0.5, 2, 3], cost: [0, 5, 3] }, function (v) { return '造成傷害的 ' + v.leech + '% 回復 HP' + (v.cost ? '；受到的傷害 +' + v.cost + '%' : ''); }],
    ['高塔', { pct: [5, 20, 30] }, function (v) { return '頭目的百分比機制傷害（王登場衝擊、時空暴走、裂痕崩塌等）−' + v.pct + '%'; }],
    ['星星', { hp: [15, 35, 50], cd: [15, 8, 5] }, function (v) { return '倒下時立刻以最大 HP ' + v.hp + '% 站起來（每 ' + v.cd + ' 分鐘一次）'; }],
    ['月亮', { er: [2, 8, 12], crit: [0, 1, 1] }, function (v) { return '迴避 +' + v.er + (v.crit ? '；迴避成功後，下一次一般攻擊必定爆擊' : ''); }],
    ['太陽', { pct: [0.5, 2, 3] }, function (v) { return '打倒一般怪物時回復最大 HP 與 MP 各 ' + v.pct + '%'; }],
    ['審判', { pct: [4, 12, 18] }, function (v) { return '頭目 HP 低於 50% 後，對它的傷害 +' + v.pct + '%'; }],
    ['世界', { mult: [1.1, 1.3, 1.5] }, function (v) { return '其他點亮的卡給的偉特效果 ×' + v.mult; }]
  ];
  // 解放淵源的特效（裝著那張才用）
  var LIBV = [{ red: 100, cd: 20 }, { ch: 22 }, { pct: 4, dur: 12, cd: 45 }, { pct: 70 }, { pct: 12 }, { ch: 50, heal: 10 }, { pct: 8, n: 2 }, { per: 3, max: 12 },
    { pct: 60 }, { per: 2 }, { dmg: 16, red: 16, reg: 2.5 }, { pct: 120 }, { pct: 45, th: 35 }, { pct: 25 }, { pot: 40, cap: 18 }, { leech: 4, cost: 0 },
    { pct: 45 }, { hp: 70, cd: 4 }, { er: 18, crit: 1 }, { pct: 4 }, { pct: 25 }, { mult: 1.8 }];
  // 淵源的特效（玩家 2026-11-06 18:19 確認；介於馬賽與解放淵源之間）
  var ABV = [{ red: 100, cd: 25 }, { ch: 18 }, { pct: 3.5, dur: 11, cd: 50 }, { pct: 60 }, { pct: 10 }, { ch: 42, heal: 9 }, { pct: 10 }, { per: 2, max: 12 },
    { pct: 50 }, { per: 1.75 }, { dmg: 14, red: 14, reg: 2 }, { pct: 100 }, { pct: 40 }, { pct: 22 }, { pot: 35, cap: 15 }, { leech: 3.5, cost: 1 },
    { pct: 38 }, { hp: 60, cd: 5 }, { er: 15, crit: 1 }, { pct: 3.5 }, { pct: 21 }, { mult: 1.65 }];
  // 起源（新的一套卡牌規則；創世＝起源的延續）——玩家 2026-11-11 18:52／19:16 定案；[起源, 創世]
  var ORIGIN = [
    [{ sec: [2, 3], cd: [180, 120] }, function (v) { return '受到致命傷時以 1 HP 留下，並無敵 ' + v.sec + ' 秒（冷卻 ' + v.cd + ' 秒）'; }],
    [{ n: [5, 5], mult: [2, 2.5] }, function (v) { return '每放 ' + v.n + ' 次攻擊魔法，下一次攻擊魔法傷害 ×' + v.mult; }],
    [{ pct: [15, 20] }, function (v) { return 'MP 消耗 −' + v.pct + '%'; }],
    [{ hp: [20, 30] }, function (v) { return '你與傭兵每 5 秒回復 HP ' + v.hp + ' 點（HP 自然恢復 +' + v.hp + '）'; }],
    [{ pct: [8, 12] }, function (v) { return '傭兵造成的傷害 +' + v.pct + '%'; }],
    [{ cd: [20, 15] }, function (v) { return '每 ' + v.cd + ' 秒替你與傭兵各解除一個異常狀態'; }],
    [{ cd: [300, 200] }, function (v) { return '你要倒下時，HP 最高的一名傭兵替你倒下，你留下 30% HP（冷卻 ' + v.cd + ' 秒）'; }],
    [{ pct: [10, 15] }, function (v) { return '移動中造成的傷害 +' + v.pct + '%'; }],
    [{ pct: [8, 12] }, function (v) { return '一般攻擊傷害 +' + v.pct + '%'; }],
    [{ pct: [10, 15] }, function (v) { return '隊伍 4 人以下時，造成的傷害 +' + v.pct + '%'; }],
    [{ ch: [10, 15] }, function (v) { return '爆擊時 ' + v.ch + '% 機率讓所有技能冷卻 −1 秒'; }],
    [{ pct: [10, 15] }, function (v) { return '受到頭目傷害的 ' + v.pct + '% 反彈給那隻頭目'; }],
    [{ pct: [40, 60] }, function (v) { return '被暈眩、冰凍、麻痺後，下一次攻擊傷害 +' + v.pct + '%'; }],
    [{ ch: [3, 5] }, function (v) { return '打倒怪物時 ' + v.ch + '% 機率得到「死神之鐮」：5 秒內造成的傷害 +20%'; }],
    [{ pot: [20, 30] }, function (v) { return '治癒藥水回復量 +' + v.pot + '%'; }],
    [{ pct: [12, 18] }, function (v) { return '對 HP 高於 80% 的目標傷害 +' + v.pct + '%'; }],
    [{ pct: [30, 45] }, function (v) { return '對狂暴中的頭目傷害 +' + v.pct + '%'; }],
    [{ hp: [30, 40] }, function (v) { return '每 5 分鐘一次：倒下時改成留下 ' + v.hp + '% HP（不算倒下次數）'; }],
    [{ er: [10, 15], hit: [10, 15] }, function (v) { return '夜晚（台灣時間 18:00～06:00）迴避 +' + v.er + '、命中 +' + v.hit; }],
    [{ pct: [8, 12] }, function (v) { return '白天（台灣時間 06:00～18:00）造成的傷害 +' + v.pct + '%'; }],
    [{ pct: [15, 22] }, function (v) { return '頭目 HP 低於 30% 時，對它的傷害 +' + v.pct + '%'; }],
    [{ mult: [1.3, 1.5] }, function (v) { return '其他點亮的卡給的偉特效果 ×' + v.mult; }]
  ];
  var originVal = function (i, st) { var o = {}, V = ORIGIN[i][0]; Object.keys(V).forEach(function (k) { o[k] = V[k][st >= 6 ? 1 : 0]; }); return o; };
  var K = {}; ['fool', 'magician', 'priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot', 'strength', 'hermit', 'wheel', 'justice', 'hanged', 'death', 'temperance', 'devil', 'tower', 'star', 'moon', 'sun', 'judgement', 'world'].forEach(function (k, i) { K[k] = i; });
  var SET = [
    { n: '22 張全部點亮', txt: '最大 HP +5%、五屬性抗性 +10', fx: { mhpPct: 5, res: 10 } },
    { n: '22 張全部托特以上', txt: '造成的傷害 +5%、受到的傷害 −5%', fx: { dmg: 5, taken: 5 } },
    { n: '22 張全部馬賽', txt: '造成的傷害 +10%、受到的傷害 −10%；得到稱號「占星者」', fx: { dmg: 10, taken: 10 } },
    { n: '22 張全部淵源', txt: '再得到一次「全部托特」的加成：造成的傷害 +5%、受到的傷害 −5%', fx: { dmg: 5, taken: 5 } },
    { n: '22 張全部起源', txt: '再得到一次「全部馬賽」的加成：造成的傷害 +10%、受到的傷害 −10%', fx: { dmg: 10, taken: 10 } },
    { n: '22 張全部創世', txt: '得到稱號「創世占星者」', fx: {} },
    { n: '22 張全部解放淵源', txt: '造成的傷害 +5%、受到的傷害 −5%', fx: { dmg: 5, taken: 5 } }
  ];
  var AURA = [null, null, { res: 15, abn: 0 }, { res: 25, abn: 15 }, { res: 35, abn: 20, dur: 15 }, { res: 15, abn: 0 }, { res: 25, abn: 15 }];   // 起源＝托特光環、創世＝馬賽光環（玩家 2026-11-11 18:52）
  // 保底（曲線 65／75；最大 HP、傷害減免、魔防、防禦、迴避、額外傷害、額外命中；2026-11-02 量測，新角色未轉生，裝備照曲線對照表）
  var AURA_LIB = { res: 50, abn: 25, dur: 20, weight: 2000 };
  var STD = {"95":{"royal":[3777,147,255,-189,97,70,25],"knight":[6385,130,219,-223,123,50,33],"elf":[3627,122,296,-189,115,50,50],"mage":[4317,132,387,-253,107,50,30],"dark":[3566,122,356,-225,107,50,63],"dragon":[5458,130,309,-218,122,83,33],"illusion":[3407,132,387,-256,124,70,50],"warrior":[6026,124,176,-185,112,75,33]},"80":{"royal":[2451,131,189,-162,67,70,25],"knight":[4235,116,154,-191,89,50,33],"elf":[2321,109,216,-159,86,50,50],"mage":[2658,118,280,-216,73,50,30],"dark":[2316,109,264,-193,78,50,63],"dragon":[3505,116,231,-187,88,83,33],"illusion":[2182,118,323,-219,90,70,50],"warrior":[4099,111,123,-158,81,75,33]},"65":{"royal":[2081,71,124,-107,48,70,25],"knight":[3382,73,80,-130,66,50,33],"elf":[1846,67,141,-101,69,50,50],"mage":[2163,71,182,-150,43,50,30],"dark":[2020,67,189,-135,55,50,63],"dragon":[2615,73,153,-126,65,83,33],"illusion":[1799,71,225,-153,60,70,50],"warrior":[3357,71,70,-103,62,75,33]},
    "75":{"royal":[2081,121,139,-149,52,70,25],"knight":[3382,104,98,-175,71,50,33],"elf":[1846,97,156,-143,74,50,50],"mage":[2163,102,200,-195,49,50,30],"dark":[2020,97,204,-177,60,50,63],"dragon":[2615,104,171,-171,70,83,33],"illusion":[1799,102,243,-198,66,70,50],"warrior":[3357,101,85,-145,66,75,33]}};
  var STD_N = ['最大 HP', '傷害減免', '魔防', '防禦', '迴避', '額外傷害', '額外命中'];
  var idOf = function (i) { return 'afk_mio_' + (i < 10 ? '0' : '') + i; };
  var idxOf = function (id) { var m = /^afk_mio_(\d\d)$/.exec(id || ''); return m ? Number(m[1]) : -1; };
  var rawVal = function (i, st, lib) { var o = {}, V = CARDS[i][1]; Object.keys(V).forEach(function (k) { o[k] = V[k][Math.max(1, Math.min(3, st)) - 1]; }); if (lib && LIBV[i]) Object.assign(o, LIBV[i]); else if (st >= 4 && ABV[i]) Object.assign(o, ABV[i]); return o; };
  var descOf = function (i, st, lib) { return st >= 5 ? ORIGIN[i][1](originVal(i, st)) : CARDS[i][2](rawVal(i, st, lib)); };
  var auraTxt = function (st, lib) { var a = lib ? AURA_LIB : AURA[st]; return a ? '五屬性抗性 +' + a.res + (a.abn ? '、異常狀態抵抗 +' + a.abn + '%' : '') + (a.dur ? '、受到的異常狀態持續時間 −' + a.dur + '%' : '') + (a.weight ? '、負重上限 +' + a.weight.toLocaleString() : '') + (a.ero ? '；次元裂縫的地圖侵蝕扣 AC、抗性最多扣到 −' + a.ero : '') : ''; };
  var stdKeyC = function (c) { return c.eqLib ? '95' : stdKey(c.eqSt); };
  var auraC = function (c) { return c.eqLib ? AURA_LIB : AURA[c.eqSt]; };
  var stdKey = function (st) { return st >= 4 ? '80' : st >= 3 ? '75' : st >= 2 ? '65' : null; };
  var stdName = function (st) { return st >= 4 ? STAGE[Math.min(st, 4)] : st >= 3 ? '馬賽' : '托特'; };
  // 次元效果（淵源／起源／創世）：只在次元裂縫生效
  var DIM = [
    [[30, 40, 50], [120, 90, 60], function (v, c) { return '被「裁決之光」打到剩 1 HP 時，立刻回復最大 HP ' + v + '%（每 ' + c + ' 秒一次）'; }],
    [[8, 12, 16], null, function (v) { return '攻擊魔法無視目標魔防 ' + v + '%'; }],
    [[0.3, 0.5, 0.8], null, function (v) { return '地圖侵蝕每秒扣血時，同時回復最大 MP ' + v + '%'; }],
    [[10, 15, 20], null, function (v) { return '你與傭兵受到的治療 +' + v + '%'; }],
    [[20, 30, 40], null, function (v) { return '傭兵受到的地圖侵蝕扣血 −' + v + '%'; }],
    [[60, 45, 30], null, function (v) { return '光蝕每 ' + v + ' 秒自動少 1 層（你與傭兵）'; }],
    [[4, 6, 8], null, function (v) { return '每 5 秒，全隊 HP 比例最低的兩位各回復最大 HP ' + v + '%'; }],
    [[1500, 2500, 4000], null, function (v) { return '次元裂縫的負重減少，抵銷 ' + v.toLocaleString(); }],
    [[6, 10, 15], null, function (v) { return '對頭目的一般攻擊傷害 +' + v + '%'; }],
    [[0.3, 0.5, 0.8], null, function (v) { return '比 16 人每少 1 人，受到的傷害 −' + v + '%（最多 15 人份）'; }],
    [[10, 15, 20], null, function (v) { return '每 30 秒隨機一種，持續 ' + v + ' 秒：地圖侵蝕暫停／光蝕立刻 −2 層／造成的傷害 +15%'; }],
    [[0.1, 0.2, 0.3], null, function (v) { return '頭目對你用百分比機制傷害時，反擊頭目最大 HP ' + v + '%（每 30 秒一次）'; }],
    [[20, 30, 40], null, function (v) { return 'HP 低於 40% 時受到的傷害 −' + v + '%'; }],
    [[10, 15, 20], null, function (v) { return '一般怪物 HP 低於 ' + v + '% 時直接斬殺'; }],
    [[15, 20, 25], null, function (v) { return '補血溢出變成護盾的上限提高到最大 HP ' + v + '%；地圖侵蝕扣血先扣護盾'; }],
    [[1, 1.5, 2], null, function (v) { return '造成傷害的 ' + v + '% 回復 HP，不受光蝕的治療減少影響'; }],
    [[40, 50, 60], null, function (v) { return '頭目的百分比機制傷害 −' + v + '%（裁決之光除外）'; }],
    [[50, 60, 70], [5, 4, 3], function (v, c) { return '倒下時以最大 HP ' + v + '% 站起來，並清掉 5 層光蝕（每 ' + c + ' 分鐘一次）'; }],
    [[14, 17, 20], null, function (v) { return '迴避 +' + v + '；迴避成功後，下一次一般攻擊必定爆擊'; }],
    [[2, 3, 5], null, function (v) { return '打倒怪物時，被侵蝕掉的 AC 與四屬性抗性各恢復 ' + v + ' 點'; }],
    [[10, 15, 20], [5, 8, 10], function (v, c) { return '對頭目的傷害 +' + v + '%，頭目 HP 低於 50% 後再 +' + c + '%'; }],
    [[1.7, 1.9, 2.2], null, function (v) { return '其他點亮的卡給的偉特效果 ×' + v; }]
  ];
  var dimDesc = function (i, st) { var x = DIM[i], k = Math.max(4, Math.min(6, st)) - 4; return x ? x[2](x[0][k], x[1] ? x[1][k] : null) : ''; };

  // ── 道具 ──
  if (!DB.items[SHARD]) DB.items[SHARD] = { n: '密奧碎片', type: 'etc', eff: 'afk_mio', req: 'all', p: 0, gachaWeight: 0, noJunk: true, noSell: true, c: 'text-fuchsia-300',
    img: 'assets/icons/items/afk_mio_shard.png', d: '從席琳夢域鏡的夢裡剝落的塔羅牌碎片。10 個點亮一張密奧之卡，20 個升到托特，30 個升到馬賽。使用後打開密奧之卡。' };
  if (!DB.items[DIM_CARD]) DB.items[DIM_CARD] = { n: '次元密奧卡', type: 'etc', req: 'all', p: 0, gachaWeight: 0, noJunk: true, noSell: true, c: 'text-cyan-300',
    img: 'assets/icons/items/afk_mio_shard.png', d: '次元裂縫的光裡浮出的牌。密奧之卡從淵源升到起源要 100 張、從起源升到創世要 500 張。次元裂縫開放後掉落。' };
  CARDS.forEach(function (c, i) {
    var id = idOf(i), d = DB.items[id] || (DB.items[id] = {});
    Object.assign(d, { n: '密奧之卡・' + ROMAN[i] + ' ' + c[0], type: 'acc', slot: 'mio', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, noSell: true, noJunk: true,
      c: 'text-fuchsia-300', img: 'assets/icons/items/' + id + '.png', afkMio: i,
      d: '只能裝一張。偉特：' + descOf(i, 1) + '。托特：' + descOf(i, 2) + '；' + auraTxt(2) + '。馬賽：' + descOf(i, 3) + '；' + auraTxt(3) + '。'
        + '淵源：' + descOf(i, 4) + '；' + auraTxt(4) + '。起源：' + descOf(i, 5) + '；' + auraTxt(5) + '。創世：' + descOf(i, 6) + '；' + auraTxt(6) + '。沒裝著的點亮卡只給偉特。' });
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[d.n] == null) ITEM_WEIGHTS[d.n] = 0; } catch (e) {}
  });
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS.indexOf('mio') < 0) WEIGHT_COUNT_SLOTS.push('mio'); } catch (e) {}
  W.__afkMioSlotOn = function (p) { return on(p) && (!T || T.enabled('mio')); };

  // ── 狀態 ──
  var store = function (p) { p.afkMio = p.afkMio || { cards: {} }; p.afkMio.cards = p.afkMio.cards || {}; return p.afkMio; };
  var stageOf = function (p, i) { return Number(store(p).cards[i]) || 0; };
  var libOf = function (p, i) { var s = store(p); return !!(s.lib && s.lib[i]) && stageOf(p, i) >= 4; };
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, it) { return s + (it && it.id === id && !it.lock ? Math.max(1, Number(it.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (count(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var equippedIdx = function (p) { var e = p && p.eq && p.eq.mio; return e ? idxOf(e.id) : -1; };
  // 目前生效的狀態：每張點亮的卡用哪個階段、數值（含「世界」放大）、收集、保底
  var compute = function (p) {
    var o = { act: {}, lit: 0, th: 0, ma: 0, ab: 0, og: 0, cr: 0, lb: 0, eq: -1, eqSt: 0, eqLib: false, set: {} };
    if (!on(p)) return o;
    var s = store(p), eq = equippedIdx(p);
    o.eq = eq; o.eqSt = eq >= 0 ? stageOf(p, eq) : 0; o.eqLib = eq >= 0 && libOf(p, eq) && o.eqSt === 4;   // 起源以後是新的一套，不再用解放淵源
    o.origin = eq >= 0 && o.eqSt >= 5 ? { i: eq, st: o.eqSt, v: originVal(eq, o.eqSt) } : null;
    var wSt = stageOf(p, K.world), wMult = wSt > 0 ? (o.origin && eq === K.world ? o.origin.v.mult : rawVal(K.world, eq === K.world ? wSt : 1, eq === K.world && o.eqLib).mult) : 1;
    CARDS.forEach(function (c, i) {
      var st = Number(s.cards[i]) || 0; if (st <= 0) return;
      o.lit++; if (st >= 2) o.th++; if (st >= 3) o.ma++; if (st >= 4) o.ab++; if (st >= 5) o.og++; if (st >= 6) o.cr++; if (libOf(p, i)) o.lb++;
      if (i === eq && st >= 5) return;   // 裝著的起源／創世卡：舊特效不再生效，改用起源規則（見下方 ORIGIN 區塊）
      var use = i === eq ? st : 1, v = rawVal(i, use, i === eq && o.eqLib);
      if (i !== eq && i !== K.world && wMult !== 1) Object.keys(v).forEach(function (k) { if (k !== 'cd' && k !== 'dur' && k !== 'max' && k !== 'crit') v[k] = Math.round(v[k] * wMult * 100) / 100; });
      o.act[i] = { st: use, lib: i === eq && o.eqLib, v: v };
    });
    var n = CARDS.length;
    [o.lit, o.th, o.ma, o.ab, o.og, o.cr, o.lb].forEach(function (c, k) { if (c >= n && SET[k]) Object.keys(SET[k].fx).forEach(function (f) { o.set[f] = (o.set[f] || 0) + SET[k].fx[f]; }); });
    o.title = o.cr >= n ? '創世占星者' : o.ma >= n ? '占星者' : '';
    return o;
  };
  var cache = null;
  var cur = function () { var p = P(); if (!cache || cache.p !== p) cache = { p: p, v: compute(p) }; return cache.v; };
  var A = function (k) { var a = cur().act[K[k]]; return a ? a.v : null; };
  var refresh = function () { cache = null; try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var fire = function (k, extra) {
    var i = K[k]; if (!X) return;
    var img = (DB.items[idOf(i)] || {}).img;
    X.pop('mio' + i, img, CARDS[i][0] + (extra ? ' ' + extra : ''), '#f0abfc');
    X.note('mio' + i, '<span style="color:#f0abfc">🃏【' + CARDS[i][0] + '】</span>' + esc(descOf(i, (cur().act[i] || {}).st || 1)));
  };

  // ── 數值類效果：重算時套用（保底、光環、收集、迴避）──
  var RES = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      cache = null;
      // 解放淵源光環的負重上限：掛在裝著的那張卡上（核心負重計算會掃密奧欄位的 weightCap）
      try { CARDS.forEach(function (x, i) { var dd = DB.items[idOf(i)]; if (dd) dd.weightCap = 0; }); var p0 = P(); if (p0 && on(p0)) { var c0 = compute(p0), a0 = auraC(c0); if (a0 && a0.weight && c0.eq >= 0) DB.items[idOf(c0.eq)].weightCap = a0.weight; } } catch (e) {}
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (p && p.d && on(p)) {
          var c = cur(), d = p.d, res = c.set.res || 0;
          var moon = A('moon'); if (moon) d.er = (Number(d.er) || 0) + moon.er;
          var aura = auraC(c); if (aura) res += aura.res;
          if (res) RES.forEach(function (k) { d[k] = (Number(d[k]) || 0) + res; });
          var std = c.eqSt >= 2 ? (STD[stdKeyC(c)] || {})[p.cls] : null;
          if (std) {
            d.dr = Math.max(Number(d.dr) || 0, std[1]); d.mr = Math.max(Number(d.mr) || 0, std[2]); d.ac = Math.min(Number(d.ac) || 0, std[3]);
            d.er = Math.max(Number(d.er) || 0, std[4]); d.extraDmg = Math.max(Number(d.extraDmg) || 0, std[5]); d.extraHit = Math.max(Number(d.extraHit) || 0, std[6]);
          }
        }
        // 光環的異常狀態抵抗：掛在裝著的那張卡上（密奧欄位在 WEIGHT_COUNT_SLOTS 裡，核心的抵抗判定會掃到）
        CARDS.forEach(function (x, i) { var dd = DB.items[idOf(i)]; if (dd) dd.abnormalResist = 0; });
        if (p && on(p)) { var cc = cur(), a2 = auraC(cc); if (a2 && a2.abn && cc.eq >= 0) DB.items[idOf(cc.eq)].abnormalResist = a2.abn; }
      } catch (e) { console.warn('[AFK-mio]', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  var maxAdd = function (p) {
    if (!p || p !== P() || !on(p)) return;
    var c = compute(p);
    if (c.set.mhpPct) p.mhp = Math.floor((p.mhp || 0) * (1 + c.set.mhpPct / 100));
    var std = c.eqSt >= 2 ? (STD[stdKeyC(c)] || {})[p.cls] : null;
    if (std) p.mhp = Math.max(p.mhp || 0, std[0]);
  };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(maxAdd);
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { var t = A('temperance'); if (t) v += t.pot; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  // 高塔：頭目的百分比機制傷害
  var prevIn = W.__afkIncomingMod;
  W.__afkIncomingMod = function (t, dmg) { var v = typeof prevIn === 'function' ? prevIn.apply(this, arguments) : dmg; try { var p = P(), tw = A('tower'); if (tw && t === p && v > 0) { v = v * (1 - tw.pct / 100); fire('tower'); } } catch (e) {} return v; };

  // ── 受到傷害的百分比（核心合併、上限 75%）──
  var wheel = { kind: -1, until: 0, next: 0 };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(); if (!p || !on(p)) return 1;
    var c = cur(), m = 1;
    if (ent === p) {
      if (c.set.taken) m *= 1 - c.set.taken / 100;
      var hg = A('hanged'); if (hg && (p.hp || 0) < (p.mhp || 1) * (hg.th || 30) / 100) { m *= 1 - hg.pct / 100; fire('hanged'); }
      var dv = A('devil'); if (dv && dv.cost && c.eq === K.devil) m *= 1 + dv.cost / 100;
      var wh = A('wheel'); if (wh && wheel.kind === 1 && tk() < wheel.until) m *= 1 - wh.red / 100;
    } else if ((p.allies || []).indexOf(ent) >= 0) {
      var em = A('emperor'); if (em) m *= 1 - em.pct / 100;
    }
    return m;
  });

  var DEB = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'], lastDeb = {};
  if (X) {
    var fool = { at: 0 }, just = { at: 0 }, star = { at: -1e9 }, chariot = { t: null, n: 0 }, pri = { until: 0, at: -1e9, next: 0 }, lov = { next: 0 };
    // 受到傷害之後（護盾之前）：愚者、正義
    X.on('taken', function (ent, dmg, mob) {
      var p = P(); if (!p || ent !== p || !(dmg > 0) || !on(p)) return dmg;
      var f = A('fool');
      if (f && tk() >= fool.at) { fool.at = tk() + f.cd * 10; dmg = dmg * (1 - f.red / 100); fire('fool'); }
      var j = A('justice');
      if (j && mob && !mob._dead && tk() >= just.at) { just.at = tk() + 10; if (X.hitMob(mob, dmg * j.pct / 100) > 0) fire('justice'); }
      return dmg;
    });
    // 造成傷害
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(); if (!p || actor !== p || !on(p)) return v;
      var c = cur(), m = 1;
      if (c.set.dmg) m *= 1 + c.set.dmg / 100;
      var mg = A('magician'); if (mg && opt.kind === 'magic' && rnd() < mg.ch / 100) { m *= 2; fire('magician'); }
      var ch = A('chariot');
      if (ch && opt.packet) { if (chariot.t === target) chariot.n = Math.min(ch.max, chariot.n + 1); else { chariot.t = target; chariot.n = 0; } if (chariot.n > 0) m *= 1 + ch.per * chariot.n / 100; }
      var sg = A('strength'); if (sg && opt.packet && opt.packet.crit) { m *= 1 + sg.pct / 100; fire('strength'); }
      var hm = A('hermit'); if (hm) m *= 1 + hm.per * Math.max(0, 16 - X.party()) / 100;
      var wh = A('wheel'); if (wh && wheel.kind === 0 && tk() < wheel.until) m *= 1 + wh.dmg / 100;
      var jg = A('judgement'); if (jg && target.boss && target.hp > 0 && target.curHp < target.hp * 0.5) m *= 1 + jg.pct / 100;
      v = v * m;
      var dt = A('death'); if (dt && !target.boss && target.hp > 0 && (target.curHp - v) > 0 && (target.curHp - v) < target.hp * dt.pct / 100) { v = Math.max(v, target.curHp); fire('death'); }
      var dv = A('devil'); if (dv) { var heal = Math.floor(Math.min(v, Math.max(0, target.curHp)) * dv.leech / 100); if (heal > 0) p.hp = Math.min(p.mhp || p.hp, p.hp + heal); }
      return v;
    });
    // 每一刻：女祭司、戀人、命運之輪
    X.on('tick', function () {
      var p = P(); if (!p || !on(p) || p.dead) return;
      // 淵源以上的光環：受到的異常狀態持續時間縮短（新上身或被刷新的那一下打折）
      var au = auraC(cur()), stt = p.statuses;
      if (riftOpen()) { var sx = store(p); if (!sx.riftSeen) sx.riftSeen = 1; }   // 進過次元裂縫：之後不能再解放
      if (au && au.dur && stt) { DEB.forEach(function (k) { var v = Number(stt[k]) || 0, pv = Number(lastDeb[k]) || 0; if (v > 0 && v > pv) { v = Math.max(pv, Math.max(1, Math.round(v * (1 - au.dur / 100)))); stt[k] = v; } lastDeb[k] = v; }); }
      else lastDeb = {};
      var t = tk();
      var pr = A('priestess');
      if (pr) {
        if (t >= pri.at && (p.mp || 0) < (p.mmp || 1) * 0.3 && X.inCombat()) { pri.at = t + pr.cd * 10; pri.until = t + pr.dur * 10; pri.next = t; fire('priestess'); }
        if (t < pri.until && t >= pri.next) { pri.next = t + 10; p.mp = Math.min(p.mmp || p.mp, (p.mp || 0) + Math.floor((p.mmp || 0) * pr.pct / 100)); }
      }
      var lv = A('lovers');
      if (lv && t >= lov.next && X.inCombat()) {
        lov.next = t + 50;
        var ents = [p].concat((p.allies || []).filter(function (a) { return a && !a._downed; })).map(function (e) { return { e: e, r: (e === p ? p.hp : e.curHp) / (e.mhp || 1) }; })
          .filter(function (x) { return x.r < 1; }).sort(function (a, b) { return a.r - b.r; }).slice(0, Math.max(1, lv.n || 1));
        ents.forEach(function (x) { var best = x.e, amt = Math.floor((best.mhp || 0) * lv.pct / 100); if (best === p) p.hp = Math.min(p.mhp, p.hp + amt); else best.curHp = Math.min(best.mhp, best.curHp + amt); });
        if (ents.length) fire('lovers');
      }
      var wh = A('wheel');
      if (wh && X.inCombat()) {
        if (t >= wheel.next) { wheel.next = t + 300; wheel.until = t + 300; wheel.kind = Math.floor(rnd() * 3) % 3; fire('wheel', ['傷害', '減傷', '回復'][wheel.kind]); }
        if (wheel.kind === 2 && t < wheel.until && t % 10 === 0) p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * wh.reg / 100));
      }
    });
    // 打倒怪物：太陽
    X.on('kill', function (m) {
      var p = P(), s = A('sun'); if (!p || !s || m.boss || !on(p)) return;
      p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * s.pct / 100)); p.mp = Math.min(p.mmp, p.mp + Math.floor(p.mmp * s.pct / 100)); fire('sun');
    });
    // 迴避：月亮（托特以上）
    X.on('evade', function () { var p = P(), mo = A('moon'); if (p && mo && mo.crit && on(p)) { p._darkEvadeCrit = true; fire('moon'); } });
    // 倒下：星星
    X.on('death', function () {
      var p = P(), s = A('star'); if (!p || !s || !on(p)) return false;
      if (tk() - star.at < s.cd * 600) return false;
      star.at = tk(); p.hp = Math.max(1, Math.floor(p.mhp * s.hp / 100)); fire('star'); return true;
    });
    // 治癒藥水：女皇、節制
    X.on('potion', function (d, est, hp0) {
      var p = P(); if (!p || !on(p)) return;
      var e = A('empress');
      if (e) { var a = Math.floor(est * e.pct / 100); (p.allies || []).forEach(function (x) { if (x && !x._downed && x.curHp > 0) x.curHp = Math.min(x.mhp, x.curHp + a); }); fire('empress'); }
      var tp = A('temperance');
      if (tp) { var over = est - Math.max(0, (p.mhp || 0) - hp0); if (over > 0) { X.shield.add(over, Math.floor(p.mhp * tp.cap / 100)); fire('temperance'); } }
    });
    // 異常狀態：教皇
    X.on('resist', function () {
      var p = P(), h = A('hierophant'); if (!p || !h || !on(p)) return false;
      if (rnd() < h.ch / 100) { p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * h.heal / 100)); fire('hierophant'); return true; }
      return false;
    });
  }

  // ── 掉落：夢域鏡；一般怪 0.001%、頭目 0.1%，乘隊伍人數（不受隱藏規則十二影響）──
  var dream = function () { var p = P(); if (!p || p.classicMode) return false; try { if (W.__afkDreamHell && W.__afkDreamHell.on) return !!W.__afkDreamHell.on(); } catch (e) {} return !!(p.sherineDream && p.sherineMad); };
  if (X) X.on('kill', function (m) {
    if (m._afkMioRoll || !dream() || m._train) return; m._afkMioRoll = true;
    var rate = (m.boss ? RATE.boss : RATE.mob) * X.party();
    if (rnd() < rate) { gainItem(SHARD, 1, true, true); sys('<span class="font-bold" style="color:#f0abfc">🃏 ' + esc(m.n) + ' 的夢裡剝落了一片「密奧碎片」。</span>'); }
  });

  // ── 開卡、升階、裝備 ──
  var openCard = function () {
    var p = P(); if (!on(p)) return -1;
    var s = store(p), pool = []; CARDS.forEach(function (c, i) { if (!(Number(s.cards[i]) > 0)) pool.push(i); });
    if (!pool.length) { sys('<span class="text-amber-300">22 張密奧之卡已經全部點亮了。</span>'); return -1; }
    if (!take(SHARD, COST[0])) { sys('<span class="text-amber-300">密奧碎片不夠（要 ' + COST[0] + ' 個）。</span>'); return -1; }
    var i = pool[Math.floor(rnd() * pool.length) % pool.length];
    s.cards[i] = 1; gainItem(idOf(i), 1, true, true);
    sys('<span class="font-bold" style="color:#f0abfc">🃏 碎片拼回了一張牌——密奧之卡「' + ROMAN[i] + ' ' + CARDS[i][0] + '」（偉特）亮了起來。</span>');
    refresh(); try { saveGame(); } catch (e) {}
    return i;
  };
  var needOf = function (st) {   // 從 st 升到 st+1 要的東西：[{ id, n, have, name }]，龍鑽另算
    var p = P(), list = [];
    if (st < 3) return { list: [{ id: SHARD, n: COST[st], have: count(SHARD), name: '密奧碎片' }], dia: 0, gold: 0, fee: true };
    var c = UP_COST[st + 1]; if (!c) return null;
    if (c.shard) list.push({ id: SHARD, n: c.shard, have: count(SHARD), name: '密奧碎片' });
    if (c.dim) list.push({ id: DIM_CARD, n: c.dim, have: count(DIM_CARD), name: '次元密奧卡' });
    if (c.blood) list.push({ id: BLOOD, n: c.blood, have: count(BLOOD), name: '血龍鑽' });
    return { list: list, dia: c.dia || 0, gold: c.gold || 0, fee: false };
  };
  var missOf = function (st) {
    var p = P(), nd = needOf(st); if (!nd) return '已經是最高階段了。';
    var m = nd.list.filter(function (x) { return x.have < x.n; }).map(function (x) { return x.name + '還差 ' + (x.n - x.have).toLocaleString(); });
    var DC = window.__afkDiaCost;
    if (nd.fee) { var fm = DC ? DC.check(DC.COST.mioUp) : null; if (fm) m.push(fm); }
    else {
      var hd = DC ? DC.have().dia : 0, hg = Math.floor(Number(p.gold) || 0);
      if (nd.dia && hd < nd.dia) m.push('龍之鑽石還差 ' + (nd.dia - hd).toLocaleString());
      if (nd.gold && hg < nd.gold) m.push('金幣還差 ' + (nd.gold - hg).toLocaleString());
    }
    return m.join('；');
  };
  var upgrade = function (i) {
    var p = P(); if (!on(p) || !CARDS[i]) return false;
    var st = stageOf(p, i); if (st <= 0 || st >= maxStage()) { if (st >= 4 && st < 6) sys('<span class="text-amber-300">起源、創世要等次元裂縫開放。</span>'); return false; }
    var miss = missOf(st);
    if (miss) { sys('<span class="text-amber-300">升級密奧之卡「' + CARDS[i][0] + '」到' + STAGE[st + 1] + '：' + miss + '。</span>'); return false; }
    var nd = needOf(st), DC = window.__afkDiaCost;
    nd.list.forEach(function (x) { take(x.id, x.n); });
    if (nd.fee) { if (DC) DC.pay(DC.COST.mioUp); }
    else {
      if (nd.dia) { try { W.pandoraAdjustSharedDiamonds(-nd.dia); } catch (e) {} }
      if (nd.gold) p.gold = (Number(p.gold) || 0) - nd.gold;
    }
    store(p).cards[i] = st + 1;
    if (st + 1 >= 6) { try { if (W.__afkAcStampMio) W.__afkAcStampMio(p, i); } catch (e) {} }   // 正規升到創世：蓋正當來源印記
    sys('<span class="font-bold" style="color:' + STAGE_C[st + 1] + '">🃏 密奧之卡「' + ROMAN[i] + ' ' + CARDS[i][0] + '」升到' + STAGE[st + 1] + '。</span>');
    refresh(); try { saveGame(); } catch (e) {}
    return true;
  };
  // ── 淵源解放（每張卡各付一次）──
  var libNeed = function () {
    var p = P(), DC = window.__afkDiaCost;
    return [
      { k: 'shard', id: SHARD, name: '密奧碎片', n: LIB_COST.shard, have: count(SHARD) },
      { k: 'dream', id: DREAM_X, name: '夢艷結晶', n: LIB_COST.dream, have: count(DREAM_X) },
      { k: 'sherine', id: SHER_X, name: '席琳結晶', n: LIB_COST.sherine, have: count(SHER_X) },
      { k: 'dia', name: '龍之鑽石', n: LIB_COST.dia, have: DC ? DC.have().dia : 0 },
      { k: 'gold', name: '金幣', n: LIB_COST.gold, have: Math.floor(Number(p && p.gold) || 0) }
    ];
  };
  var libState = function (i) {   // 'done'／'hide'（還沒 22 張淵源）／'stage'／'rift'／'miss'／'ok'
    var p = P(); if (!on(p) || !CARDS[i]) return 'hide';
    if (libOf(p, i)) return 'done';
    if (compute(p).ab < CARDS.length) return 'hide';
    if (stageOf(p, i) !== 4) return 'stage';
    if (store(p).riftSeen) return 'rift';
    return libNeed().some(function (x) { return x.have < x.n; }) ? 'miss' : 'ok';
  };
  var liberate = function (i) {
    var p = P(), st0 = libState(i);
    if (st0 === 'miss') {   // 倉庫裡的材料先搬到背包再算一次
      try { var MW = W.__afkMatWh; if (MW && MW.on && MW.on()) [[SHARD, LIB_COST.shard], [DREAM_X, LIB_COST.dream], [SHER_X, LIB_COST.sherine]].forEach(function (x) { var lack = x[1] - count(x[0]); if (lack > 0) { try { MW.pull(x[0], lack); } catch (e) {} } }); } catch (e) {}
      st0 = libState(i);
    }
    if (st0 === 'rift') { sys('<span class="text-amber-300">已經進過次元裂縫，不能再解放。</span>'); return false; }
    if (st0 === 'miss') { sys('<span class="text-amber-300">淵源解放「' + CARDS[i][0] + '」：' + libNeed().filter(function (x) { return x.have < x.n; }).map(function (x) { return x.name + '還差 ' + (x.n - x.have).toLocaleString(); }).join('；') + '。</span>'); return false; }
    if (st0 !== 'ok') return false;
    take(SHARD, LIB_COST.shard); take(DREAM_X, LIB_COST.dream); take(SHER_X, LIB_COST.sherine);
    try { W.pandoraAdjustSharedDiamonds(-LIB_COST.dia); } catch (e) {}
    p.gold = (Number(p.gold) || 0) - LIB_COST.gold;
    var s = store(p); s.lib = s.lib || {}; s.lib[i] = 1;
    sys('<span class="font-bold" style="color:#fb7185">🃏 密奧之卡「' + ROMAN[i] + ' ' + CARDS[i][0] + '」的淵源解放了——牌面裂開，露出底下更深的那一層。</span>');
    refresh(); try { saveGame(); } catch (e) {}
    return true;
  };
  var equipCard = function (i) {
    var p = P(); if (!on(p) || stageOf(p, i) <= 0) return false;
    var id = idOf(i);
    if (p.eq && p.eq.mio && p.eq.mio.id === id) return true;
    var it = (p.inv || []).find(function (x) { return x && x.id === id; });
    if (!it) { gainItem(id, 1, true, true); it = (p.inv || []).find(function (x) { return x && x.id === id; }); }   // 卡片道具不見了就補一張
    if (!it) return false;
    try { equipItem(it); } catch (e) { return false; }
    refresh();
    return !!(p.eq.mio && p.eq.mio.id === id);
  };
  // 目前生效的效果（介面用）
  var summary = function (p) {
    var c = compute(p), out = [];
    Object.keys(c.act).forEach(function (i) { i = Number(i); var a = c.act[i]; out.push({ i: i, st: a.st, lib: a.lib, t: CARDS[i][2](a.v) }); });
    return { c: c, list: out };
  };
  var ui = { sel: -1 };
  var CSS = '#afk-mio-ov{position:fixed;inset:0;z-index:10040;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:12px}'
    + '#afk-mio{width:min(760px,100%);max-height:min(92vh,100%);overflow-y:auto;background:linear-gradient(160deg,#1e1530,#0f0d16 55%);border:1px solid #8b6db8;border-radius:14px;padding:14px;color:#e7e5e4;font-size:13px;line-height:1.5;box-shadow:0 10px 40px rgba(0,0,0,.7)}'
    + '#afk-mio .hd{display:flex;align-items:center;gap:10px}#afk-mio .hd b{font-size:18px;color:#f5d0fe;letter-spacing:2px}#afk-mio .hd .x{margin-left:auto}'
    + '#afk-mio .lore{color:#a8a29e;font-size:12px;margin-top:4px}'
    + '#afk-mio .bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border:1px solid #4c3d66;border-radius:10px;background:rgba(17,12,28,.8)}'
    + '#afk-mio .bar img{width:28px;height:28px}#afk-mio .bar .n{font-size:16px;font-weight:bold;color:#f0abfc}'
    + '#afk-mio .prog{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}'
    + '#afk-mio .prog div{padding:6px 8px;border:1px solid #3b3150;border-radius:8px;background:rgba(17,12,28,.7);font-size:12px}#afk-mio .prog div.ok{border-color:#fcd34d;box-shadow:0 0 8px rgba(252,211,77,.25) inset}'
    + '#afk-mio .prog b{display:block;font-size:13px}'
    + '#afk-mio .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin-top:10px}'
    + '#afk-mio .cd{position:relative;display:flex;flex-direction:column;align-items:center;padding:6px 2px;border:1px solid #3b3150;border-radius:8px;background:rgba(17,12,28,.8);cursor:pointer;color:inherit;font:inherit}'
    + '#afk-mio .cd img{width:52px;height:52px;border-radius:6px}#afk-mio .cd.off img{filter:grayscale(1) brightness(.35)}#afk-mio .cd span{font-size:11px;white-space:nowrap}'
    + '#afk-mio .cd.sel{border-color:#f0abfc;box-shadow:0 0 0 1px #f0abfc inset,0 0 10px rgba(240,171,252,.35)}#afk-mio .cd i{position:absolute;top:2px;left:4px;font-style:normal;font-size:10px;font-weight:bold}'
    + '#afk-mio .cd u{position:absolute;top:2px;right:4px;text-decoration:none;font-size:10px;color:#86efac}'
    + '#afk-mio .det{margin-top:10px;padding:10px;border:1px solid #8b6db8;border-radius:10px;background:rgba(24,16,38,.9)}'
    + '#afk-mio .det .top{display:flex;gap:12px;align-items:center}#afk-mio .det .top img{width:72px;height:72px;border-radius:8px}'
    + '#afk-mio .det table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}#afk-mio .det td{padding:5px 6px;border-top:1px solid #2e2540}#afk-mio .det td.s{white-space:nowrap;font-weight:bold;width:1%}#afk-mio .det tr.now td{background:rgba(240,171,252,.08)}'
    + '#afk-mio .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}'
    + '#afk-mio button.mb{padding:6px 14px!important;border-radius:8px!important;font-weight:bold;font-size:13px;border:1px solid #f0abfc!important;background:linear-gradient(#a21caf,#581c87)!important;color:#fdf4ff!important;cursor:pointer;white-space:nowrap;opacity:1!important}'
    + '#afk-mio button.mb[disabled]{border-color:#3b3150!important;background:#1c1726!important;color:#57534e!important;cursor:not-allowed}'
    + '#afk-mio .sum{margin-top:10px;font-size:12px;color:#d6d3d1}#afk-mio .sum b{color:#86efac}'
    + '@media (max-width:480px){#afk-mio{padding:10px}#afk-mio .prog{grid-template-columns:1fr}#afk-mio .grid{grid-template-columns:repeat(4,minmax(0,1fr))}#afk-mio .cd img{width:44px;height:44px}}';
  var ico = function (id) { var d = DB.items[id]; try { return d && typeof getIconUrl === 'function' ? getIconUrl(d) : (d && d.img) || ''; } catch (e) { return (d && d.img) || ''; } };
  var close = function () { var o = document.getElementById('afk-mio-ov'); if (o) o.remove(); };
  var render = function () {
    var p = P(), ov = document.getElementById('afk-mio-ov'); if (!p || !ov) return;
    if (!document.getElementById('afk-mio-css')) { var st = document.createElement('style'); st.id = 'afk-mio-css'; st.textContent = CSS; document.head.appendChild(st); }
    var s = store(p), sm = summary(p), v = sm.c, eq = equippedIdx(p), n = CARDS.length, sh = count(SHARD);
    if (ui.sel < 0) ui.sel = eq >= 0 ? eq : 0;
    var h = '<div id="afk-mio"><div class="hd"><img src="' + esc(ico(SHARD)) + '" style="width:36px;height:36px"><b>密奧之卡</b><button class="mb x" data-mio="close">關閉</button></div>'
      + '<div class="lore">夢域鏡的夢裡散落著二十二張牌的碎片。拼回來的牌會一直亮著；裝在身上的那張，才會露出它真正的樣子。</div>'
      + '<div class="bar"><img src="' + esc(ico(SHARD)) + '">密奧碎片 <span class="n">' + sh + '</span><span style="flex:1"></span>'
      + '<button class="mb" data-mio="open"' + (sh >= COST[0] && v.lit < n ? '' : ' disabled') + '>點亮一張（碎片 ×' + COST[0] + '）</button></div>'
      + '<div class="prog">' + SET.map(function (x, k) { if (k === 6 ? v.ab < n : (k >= 4 && !riftOpen())) return ''; var c = [v.lit, v.th, v.ma, v.ab, v.og, v.cr, v.lb][k] || 0; return '<div class="' + (c >= n ? 'ok' : '') + '"><b style="color:' + (STAGE_C[k + 1] || '#fb7185') + '">' + ['點亮', '托特以上', '馬賽以上', '淵源以上', '起源以上', '創世', '解放淵源'][k] + ' ' + c + '／' + n + '</b>' + esc(x.n) + '：' + esc(x.txt) + '</div>'; }).join('') + '</div>'
      + (v.title ? '<div style="margin-top:6px;color:#fef3c7;font-weight:bold">稱號：' + esc(v.title) + '</div>' : '')
      + '<div class="grid">' + CARDS.map(function (c, i) {
          var st = Number(s.cards[i]) || 0;
          return '<button type="button" class="cd' + (st ? '' : ' off') + (i === ui.sel ? ' sel' : '') + '" data-mio="sel:' + i + '"><img src="' + esc(ico(idOf(i))) + '">'
            + (st ? '<i style="color:' + (libOf(p, i) && st === 4 ? '#fb7185' : STAGE_C[st]) + '">' + (libOf(p, i) && st === 4 ? '解放' : STAGE[st]) + '</i>' : '') + (i === eq ? '<u>裝備中</u>' : '') + '<span>' + ROMAN[i] + ' ' + esc(c[0]) + '</span></button>';
        }).join('') + '</div>';
    var i = ui.sel, c = CARDS[i], st = Number(s.cards[i]) || 0;
    h += '<div class="det"><div class="top"><img src="' + esc(ico(idOf(i))) + '"' + (st ? '' : ' style="filter:grayscale(1) brightness(.4)"') + '><div><div style="font-size:16px;font-weight:bold;color:#f5d0fe">' + ROMAN[i] + ' ' + esc(c[0]) + '</div>'
      + '<div style="color:' + (st ? STAGE_C[st] : '#78716c') + '">' + (st ? '目前：' + (libOf(p, i) && st === 4 ? '解放淵源' : STAGE[st]) + (i === eq ? '（裝備中，用這個階段）' : '（沒裝著，只給偉特的效果）') : '還沒點亮') + '</div></div></div>'
      + '<table>' + [1, 2, 3, 4, 5, 6].filter(function (k) { return k <= maxStage(); }).map(function (k) {
          var locked = false;   // 次元裂縫開放前只列到淵源（未開放的內容不放進介面說明）
          return '<tr class="' + (k === st && !libOf(p, i) ? 'now' : '') + '"><td class="s" style="color:' + STAGE_C[k] + '">' + STAGE[k] + '</td><td>'
            + esc(descOf(i, k))
            + (k >= 2 ? '<div style="color:#a8a29e;font-size:11px">裝著時另有：' + esc(auraTxt(k)) + '</div>' : '')
            + (k >= 4 && riftOpen() ? '<div style="color:#67e8f9;font-size:11px">次元效果（只在次元裂縫）：' + esc(dimDesc(i, k)) + '</div>' : '')
            + (locked ? '<div style="color:#78716c;font-size:11px">次元裂縫開放後開放</div>' : '') + '</td></tr>'; }).join('') + (v.ab >= n ? '<tr class="' + (libOf(p, i) ? 'now' : '') + '"><td class="s" style="color:#fb7185">解放淵源</td><td>' + esc(descOf(i, 4, true)) + '<div style="color:#a8a29e;font-size:11px">裝著時另有：' + esc(auraTxt(4, true)) + '</div></td></tr>' : '') + '</table>'
      + '<div class="acts">'
      + (st > 0 && st < maxStage() ? (function () {
          var nd = needOf(st), m = missOf(st), DC = window.__afkDiaCost, parts = nd.list.map(function (x) { return x.name + ' ×' + x.n.toLocaleString(); });
          if (nd.fee && DC) parts.push('💎 ' + DC.COST.mioUp.toLocaleString() + '＋金幣 ' + DC.goldOf(DC.COST.mioUp).toLocaleString());
          if (nd.dia) parts.push('💎 ' + nd.dia.toLocaleString()); if (nd.gold) parts.push('金幣 ' + nd.gold.toLocaleString());
          return '<button class="mb" data-mio="up:' + i + '"' + (m ? ' disabled' : '') + '>升到' + STAGE[st + 1] + '（' + parts.join('＋') + '）</button>' + (m ? '<div class="mio-miss" style="color:#fca5a5;font-size:12px">' + esc(m) + '</div>' : ''); })() : '')
      + (function () {
          var ls = libState(i); if (ls === 'hide' || ls === 'done') return ls === 'done' ? '<span style="color:#fb7185;font-weight:bold;align-self:center">已解放</span>' : '';
          var cost = '碎片 ×' + LIB_COST.shard.toLocaleString() + '＋夢艷結晶 ×' + LIB_COST.dream.toLocaleString() + '＋席琳結晶 ×' + LIB_COST.sherine.toLocaleString() + '＋💎 ' + LIB_COST.dia.toLocaleString() + '＋金幣 ' + LIB_COST.gold.toLocaleString();
          var why = ls === 'rift' ? '已經進過次元裂縫，不能再解放' : ls === 'stage' ? '這張要先升到淵源' : ls === 'miss' ? libNeed().filter(function (x) { return x.have < x.n; }).map(function (x) { return x.name + '還差 ' + (x.n - x.have).toLocaleString(); }).join('；') : '';
          return '<button class="mb" data-mio="lib:' + i + '"' + (ls === 'ok' || ls === 'miss' ? '' : ' disabled') + '>淵源解放（' + cost + '）</button>' + (why ? '<div style="color:#fca5a5;font-size:12px">' + esc(why) + '</div>' : '');
        })()
      + (st > 0 && i !== eq ? '<button class="mb" data-mio="eq:' + i + '">裝備這張</button>' : '')
      + '</div></div>';
    var std = v.eqSt >= 2 ? (STD[stdKeyC(v)] || {})[p.cls] : null;
    h += '<div class="sum"><b style="color:#f5d0fe">目前生效</b>'
      + (sm.list.length ? '<ul style="margin:4px 0 0 18px;list-style:disc">' + sm.list.map(function (x) { return '<li><span style="color:' + (x.lib ? '#fb7185' : STAGE_C[x.st]) + '">' + ROMAN[x.i] + ' ' + esc(CARDS[x.i][0]) + '（' + (x.lib ? '解放淵源' : STAGE[x.st]) + '）</span>：' + esc(x.t) + '</li>'; }).join('') + '</ul>' : '：還沒有點亮的卡')
      + (std ? '<div style="margin-top:4px">裝著的卡是' + (v.eqLib ? '解放淵源' : STAGE[v.eqSt]) + '：' + esc(auraTxt(v.eqSt, v.eqLib)) + '；保底（' + (v.eqLib ? '解放淵源' : stdName(v.eqSt)) + '標準）：' + STD_N.map(function (nm, k) { return nm + ' ' + (k === 3 ? '' : '') + std[k].toLocaleString(); }).join('、') + '</div>' : '')
      + (Object.keys(v.set).length ? '<div style="margin-top:4px">收集加成：' + SET.filter(function (x, k) { return [v.lit, v.th, v.ma, v.ab, v.og, v.cr, v.lb][k] >= n && Object.keys(x.fx).length; }).map(function (x) { return esc(x.txt); }).join('；') + '</div>' : '')
      + '</div>'
      + '<div class="lore" style="margin-top:6px">取得：席琳夢域鏡裡一般怪物 0.001%、頭目 0.1% 掉密奧碎片，乘隊伍人數（最多 ×16）。點亮 10 個、托特 20 個、馬賽 30 個。密奧欄位在裝備視窗第二頁、刻印下面。</div></div>';
    ov.innerHTML = h;
    ov.querySelectorAll('[data-mio]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var a = b.getAttribute('data-mio').split(':');
        if (a[0] === 'close') return close();
        if (a[0] === 'open') { var k = openCard(); if (k >= 0) ui.sel = k; }
        else if (a[0] === 'sel') ui.sel = Number(a[1]);
        else if (a[0] === 'up') upgrade(Number(a[1]));
        else if (a[0] === 'eq') equipCard(Number(a[1]));
        else if (a[0] === 'lib') liberate(Number(a[1]));
        try { if (typeof updateUI === 'function') updateUI(); if (typeof renderTabs === 'function') renderTabs(); } catch (e) {}
        render();
      };
    });
  };
  var open = function () {
    var p = P(); if (!on(p)) return;
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
    close();
    var ov = document.createElement('div'); ov.id = 'afk-mio-ov';
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov); render();
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      var p = P(), it = p && (p.inv || []).find(function (i) { return i && i.uid === u; });
      if (!it || it.id !== SHARD) return oUse.apply(this, arguments);
      if (arguments[1]) return;   // 自動使用不碰
      open();
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  // 卡片的道具視窗多一顆「打開密奧之卡」
  if (typeof W.openModal === 'function') {
    var oModal = W.openModal;
    W.openModal = function (item) {
      var r = oModal.apply(this, arguments);
      try {
        if (item && idxOf(item.id) >= 0 && on(P())) {
          var box = document.getElementById('modal-actions');
          if (box) { var b = document.createElement('button'); b.className = 'col-span-2 w-full btn border-fuchsia-700 bg-fuchsia-900 hover:bg-fuchsia-800 text-fuchsia-100 py-3 text-lg font-bold'; b.textContent = '🃏 打開密奧之卡'; b.onclick = function () { ui.sel = idxOf(item.id); open(); }; box.insertBefore(b, box.firstChild); }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('openModal = window.openModal'); } catch (e) {}
  }

  // ── NPC：歐瑞村莊的洛蒂（玩家 2026-11-05 23:53：原本的德州撲克荷官改當密奧之卡的 NPC）──
  var NPC_ID = 'npc_afk_mio', NPC_N = '洛蒂', NPC_T = '密奧之卡';
  var npcPanel = function (div) {
    if (!div) return;
    var Kt = W.__afkNpcKit; if (Kt && Kt.css) Kt.css();
    var p = P();
    if (!p || !on(p)) { div.innerHTML = '<div class="afk-ax"><p class="ax-lore">「牌今天不想說話。」</p></div>'; return; }
    var c = compute(p), n = CARDS.length;
    div.innerHTML = '<div class="afk-ax"><p class="ax-lore">洛蒂把二十二張牌在桌上攤成一個圓：「牌會記得你走過的夢。拼回來的牌，裝在身上的那張，才會露出它真正的樣子。」</p>'
      + '<div class="ax-row"><div class="ax-main"><div><div class="ax-name">🃏 密奧之卡</div><div class="ax-desc">密奧碎片 ' + count(SHARD).toLocaleString() + ' 個；點亮 ' + c.lit + '／' + n + '、馬賽以上 ' + c.ma + '／' + n + '、淵源以上 ' + c.ab + '／' + n + '</div></div></div>'
      + '<div class="ax-act"><button type="button" class="ax-btn" data-mio-npc="open">打開</button></div></div></div>';
    var b = div.querySelector('[data-mio-npc="open"]'); if (b) b.onclick = function () { open(); };
  };
  try {
    var Lr = W.__afkLore, ndef = { id: NPC_ID, n: NPC_N, title: NPC_T, type: 'quest', classicHide: true,
      d: '在歐瑞村莊替人解牌的洛蒂。點亮、升級、裝備密奧之卡。' };
    if (Lr && Lr.addNpc) Lr.addNpc('town_oren', ndef, '6804', [58, 80]);
    else if (DB.towns && DB.towns.town_oren && !DB.towns.town_oren.npcs.some(function (x) { return x.id === NPC_ID; })) DB.towns.town_oren.npcs.push(ndef);
    var Kn = W.__afkNpcKit; if (Kn && Kn.hookNpc) Kn.hookNpc(NPC_ID, NPC_N, NPC_T, npcPanel);
  } catch (e) { console.warn('[AFK-mio] NPC', e); }

  // ── 起源／創世：裝著的那張卡改用起源規則（玩家 2026-11-11 19:16 確認上線）──
  var OG = function (k) { var c = cur(); return c.origin && c.origin.i === K[k] ? c.origin.v : null; };
  var ofire = function (k) { var i = K[k]; if (!X) return; X.pop('mioo' + i, (DB.items[idOf(i)] || {}).img, CARDS[i][0], '#22d3ee'); X.note('mioo' + i, '<span style="color:#22d3ee">🃏【' + CARDS[i][0] + '・起源】</span>' + esc(descOf(i, cur().origin.st))); };
  var twHour = function () { return new Date(Date.now() + 8 * 3600000).getUTCHours(); };
  var isNight = function () { var h = twHour(); return h >= 18 || h < 6; };
  // 數值類：女祭司（MP 消耗）、月亮（夜晚迴避、命中）
  if (typeof W.recomputeStats === 'function') {
    var oRe2 = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe2.apply(this, arguments);
      try {
        var p = P(); if (p && p.d && on(p)) {
          var pr = OG('priestess'); if (pr) p.d.mpReduce = (Number(p.d.mpReduce) || 0) + pr.pct;
          var mo = OG('moon'); if (mo && isNight()) { p.d.er = (Number(p.d.er) || 0) + mo.er; p.d.extraHit = (Number(p.d.extraHit) || 0) + mo.hit; }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot2 = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot2.apply(this, arguments); try { var t = OG('temperance'); if (t) v += t.pot; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  if (X) {
    var og = { foolAt: -1e9, inv: 0, mag: 0, lovAt: -1e9, starAt: -1e9, hierAt: 0, regAt: 0, cc: false, reap: 0, wasCC: false };
    var RR = function () { return W.AFK_RELIC_RUNTIME; };
    X.on('taken', function (ent, dmg, mob) {
      var p = P(); if (!p || !on(p) || !(dmg > 0)) return dmg;
      if (ent === p && tk() < og.inv) return 0;   // 愚者的無敵
      var ju = OG('justice'); if (ju && ent === p && mob && mob.boss && !mob._dead) X.hitMob(mob, dmg * ju.pct / 100);
      return dmg;
    });
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(); if (!p || !on(p) || !(v > 0) || !target) return v;
      var c = cur(); if (!c.origin) return v;
      var m = 1;
      if (actor !== p) { var em = OG('emperor'); if (em && (p.allies || []).indexOf(actor) >= 0) m *= 1 + em.pct / 100; return v * m; }
      var mg = OG('magician'); if (mg && opt.kind === 'magic') { og.mag++; if (og.mag > mg.n) { og.mag = 0; m *= mg.mult; ofire('magician'); } }
      var ch = OG('chariot'); if (ch) { try { var mv = RR() && RR().state(p, '_movement'); if (mv && mv.moving) m *= 1 + ch.pct / 100; } catch (e) {} }
      var sg = OG('strength'); if (sg && opt.packet) m *= 1 + sg.pct / 100;
      var hm = OG('hermit'); if (hm && X.party() <= 4) m *= 1 + hm.pct / 100;
      var wh = OG('wheel'); if (wh && opt.packet && opt.packet.crit && rnd() < wh.ch / 100) { try { var cd = p.cds || {}; ['atkSk', 'healSk', 'purifySk', 'convertSk'].forEach(function (k) { if (cd[k] > 0) cd[k] = Math.max(0, cd[k] - 10); }); if (cd.healSkillCds) Object.keys(cd.healSkillCds).forEach(function (k) { cd.healSkillCds[k] = Math.max(0, cd.healSkillCds[k] - 10); }); } catch (e) {} ofire('wheel'); }
      var hg = OG('hanged'); if (hg && og.cc) { og.cc = false; m *= 1 + hg.pct / 100; ofire('hanged'); }
      if (OG('death') && tk() < og.reap) m *= 1.2;
      var dv = OG('devil'); if (dv && target.hp > 0 && target.curHp > target.hp * 0.8) m *= 1 + dv.pct / 100;
      var tw = OG('tower'); if (tw && target.boss) { var rg = 1; try { rg = typeof mobRageDmgMult === 'function' ? mobRageDmgMult(target) : 1; } catch (e) {} if (rg > 1 || target._enraged) m *= 1 + tw.pct / 100; }
      var su = OG('sun'); if (su && !isNight()) m *= 1 + su.pct / 100;
      var jg = OG('judgement'); if (jg && target.boss && target.hp > 0 && target.curHp < target.hp * 0.3) m *= 1 + jg.pct / 100;
      return v * m;
    });
    X.on('tick', function () {
      var p = P(); if (!p || !on(p) || p.dead) return;
      var c = cur(); if (!c.origin) return;
      var t = tk();
      var em = OG('empress'); if (em && t >= og.regAt) { og.regAt = t + 50; p.hp = Math.min(p.mhp, (p.hp || 0) + em.hp); (p.allies || []).forEach(function (a) { if (a && !a._downed && a.curHp > 0) a.curHp = Math.min(a.mhp, a.curHp + em.hp); }); }
      var hi = OG('hierophant');
      if (hi && t >= og.hierAt && X.inCombat()) {
        og.hierAt = t + hi.cd * 10; var any = false;
        [p].concat(p.allies || []).forEach(function (e) { var stt = e && e.statuses; if (!stt) return; for (var j = 0; j < DEB.length; j++) { if ((Number(stt[DEB[j]]) || 0) > 0) { stt[DEB[j]] = 0; any = true; break; } } });
        if (any) ofire('hierophant');
      }
      var hg = OG('hanged');
      if (hg) { var stt0 = p.statuses || {}, nowCC = (stt0.stun || 0) > 0 || (stt0.freeze || 0) > 0 || (stt0.paralyze || 0) > 0; if (og.wasCC && !nowCC) og.cc = true; og.wasCC = nowCC; }
    });
    X.on('kill', function (m) { var p = P(), d = OG('death'); if (!p || !d || !on(p)) return; if (rnd() < d.ch / 100) { og.reap = tk() + 50; ofire('death'); } });
    X.on('death', function () {
      var p = P(); if (!p || !on(p)) return false;
      var c = cur(); if (!c.origin) return false;
      var t = tk();
      var fo = OG('fool'); if (fo && t >= og.foolAt) { og.foolAt = t + fo.cd * 10; og.inv = t + fo.sec * 10; p.hp = 1; ofire('fool'); return true; }
      var lv = OG('lovers');
      if (lv && t >= og.lovAt) {
        var al = (p.allies || []).filter(function (a) { return a && !a._downed && a.curHp > 0; }).sort(function (a, b) { return b.curHp - a.curHp; })[0];
        if (al) { og.lovAt = t + lv.cd * 10; al.curHp = 0; p.hp = Math.max(1, Math.floor(p.mhp * 0.3)); ofire('lovers'); return true; }
      }
      var st = OG('star'); if (st && t - og.starAt >= 3000) { og.starAt = t; p.hp = Math.max(1, Math.floor(p.mhp * st.hp / 100)); ofire('star'); return true; }
      return false;
    });
  }
  var api = W.__afkMio = { SHARD: SHARD, RATE: RATE, COST: COST, CARDS: CARDS, K: K, SET: SET, AURA: AURA, STD: STD, STD_N: STD_N, STAGE: STAGE, ROMAN: ROMAN, idOf: idOf, idxOf: idxOf,
    store: store, compute: compute, UP_COST: UP_COST, DIM: DIM, dimDesc: dimDesc, DIM_CARD: DIM_CARD, DIM_RATE: DIM_RATE, maxStage: maxStage, needOf: needOf, missOf: missOf, summary: summary, rawVal: rawVal, descOf: descOf, auraTxt: auraTxt, openCard: openCard, upgrade: upgrade, equipCard: equipCard, open: open, close: close,
    NPC_ID: NPC_ID, npcPanel: npcPanel, LIB_COST: LIB_COST, LIBV: LIBV, AURA_LIB: AURA_LIB, libOf: libOf, libState: libState, liberate: liberate, libNeed: libNeed,
    roll: function () { return Math.random(); }, count: count, wheel: wheel, refresh: refresh, ORIGIN: ORIGIN, originVal: originVal };
})();
