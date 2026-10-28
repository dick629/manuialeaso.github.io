/* ============================================================================
 * afk-dex-extra.js — 掉落查詢「外掛掉落」登記表（玩家 2026-10-27：怪物掉落查詢沒有同步更新）
 *
 * 原因：掉落查詢只讀遊戲的掉落表（MOB_DROPS 等 6 張）。後來加的副本與模式（席琳夢域鏡、吉爾塔斯、
 *   謀叛者的低語、暗夢星迴、失去光輝的碎片、詞綴擴充、套裝活動品…）是在「打倒怪物時」用程式直接發東西，
 *   不在掉落表裡 → 查詢顯示「沒有固定取得途徑」、頭目卡寫「無專屬掉落表」。
 * 做法：在這裡統一登記，掉落查詢與小百科讀這張表：
 *   drop(怪物名, 物品id, 機率%, 附註, 固定機率)  → 列進該怪的掉落表（固定機率＝不吃席琳倍率）
 *   acq(物品id, 一行取得方式)                    → 物品詳情的「取得方式」
 *   sellLike([物品id…], 既有商品id)              → 跟著某件既有商品一起賣（外掛包了商店函式、不在 SHOP_LISTS 的）
 * 以後新增「程式發放」的掉落，記得在這裡補一行。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var X = W.AFK_DEX_EXTRA = W.AFK_DEX_EXTRA || { drops: {}, acquire: {}, shopLike: [], rev: 0 };
  X.drop = function (mob, id, pct, note, fixed) { (X.drops[mob] = X.drops[mob] || []).push([id, pct, note || null, !!fixed]); X.rev++; };
  X.acq = function (id, txt) { X.acquire[id] = txt; X.rev++; };
  X.sellLike = function (ids, like) { X.shopLike.push({ ids: ids, like: like }); X.rev++; };
  X.dropsOf = function (mob) { return (X.drops[mob] || []).filter(function (e) { return typeof DB !== 'undefined' && DB.items[e[0]]; }); };
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs) return;
  var antFinal = function () { return W.__afkAntFinal || '被侵蝕的時空安塔瑞斯'; };

  // ── 吉爾塔斯副本「異界祭壇」（afk-giltas）──
  X.drop('吉爾塔斯', 'afk_gt_frag_up', 100, '受詛咒的聖地才掉', true);
  X.drop('冥皇丹特斯', 'afk_gt_frag_down', 100, '謀叛者的低語', true);
  X.drop('真‧死亡騎士 冥皇丹特斯', 'afk_gt_orb', 100, '崩壞的長老會議廳・身上沒有才掉', true);
  X.drop('真‧吉爾塔斯', 'sherine_crystal', 100, '50～100 顆', true);
  X.drop('真‧吉爾塔斯', 'afk_asc_shard', 100, '2～5 個', true);
  X.drop('真‧吉爾塔斯', 'wpn_gt_sword', 1, '唯一', true);
  X.drop('真‧吉爾塔斯', 'afk_asc_card_spacetime_giltas', 1, '唯一', true);
  X.acq('afk_gt_frag_up', '受詛咒的黑暗妖精聖地「吉爾塔斯」必掉。');
  X.acq('afk_gt_frag_down', '謀叛者的低語（亞丁城副本）第三層「冥皇丹特斯」必掉。');
  X.acq('afk_gt_key', '長老會議廳 NPC「次元裂隙」：次元時空鑰匙碎片(上)＋(下) 組成。交出鑰匙進入異界祭壇（席琳夢域鏡限定、每個角色每天通關一次）。');
  X.acq('afk_gt_orb', '崩壞的長老會議廳「真‧死亡騎士 冥皇丹特斯」：身上沒有寶珠時必掉。帶在身上＝全隊免疫真‧吉爾塔斯的致死圓形結界。');
  X.acq('wpn_gt_sword', '吉爾塔斯副本・異界祭壇：打倒第三層「真‧吉爾塔斯」通關時 1%（唯一）。');

  // ── 謀叛者的低語（afk-traitor）：主謀三人另外掉 ──
  ['冥皇丹特斯', '反王肯恩(謀叛)', '魔女賽尼斯(謀叛)'].forEach(function (n) {
    X.drop(n, 'sherine_crystal', 100, '20～40 顆', true);
    X.drop(n, 'afk_asc_shard', 30, '1～3 個', true);
  });

  // ── 席琳夢域鏡（afk-dreamhell）──
  X.acq('afk_dream_crystal', '席琳夢域鏡：一般怪 10% 掉 1 顆、頭目必掉 3 顆。暗夢星迴頭目 50% 掉的「三個隨機昇華支配材料」也可能抽到。');
  X.acq('afk_hell_essence', '席琳夢域鏡：頭目必掉 1 個。暗夢星迴頭目 50% 掉的「三個隨機昇華支配材料」也可能抽到。');
  ['earth', 'water', 'wind', 'fire'].forEach(function (k) {
    X.acq('afk_contempt_' + k, function () {
      return '席琳夢域鏡：Lv80 以上頭目必掉一顆（四屬性隨機）；滅魔蔑視水晶碎片 100 個合成 1 顆。' + (k === 'earth' ? '「' + antFinal() + '」（任何模式）必掉。' : '') + '暗夢星迴頭目的隨機材料也可能抽到。';
    });
  });
  X.acq('afk_contempt_shard', '席琳夢域鏡：一般怪固定 1% 掉落。100 個合成 1 顆滅魔蔑視水晶。');
  X.acq('afk_abyss_key', '四大龍副本任何怪：瘋狂的席琳世界 0.01%、席琳夢域鏡 1%。暗夢星迴頭目的隨機材料也可能抽到。');
  X.acq('afk_dark_stardust', '燃柳村「哈瑪大師」：地獄精華 20 個合成（成功率 70%）。暗夢星迴頭目的隨機材料也可能抽到。');
  X.acq('afk_dream_dust', '暗夢星迴頭目：50% 掉「三個隨機昇華支配材料」時可能抽到（機率最低的幾種之一）。');
  ['wpn', 'arm', 'acc'].forEach(function (k) {
    X.acq('afk_asc_stone_' + k, '席琳夢域鏡（白金卡全部收集滿）每殺一隻 0.05%（三種隨機）；萊利的輔佐官 500 積分指定兌換。');
  });
  X.acq('afk_asc_shard', '席琳夢域鏡（白金卡全部收集滿）每殺一隻 0.1%；謀叛者的低語（席琳夢域鏡）主謀三人各 30%（1～3 個）；真‧吉爾塔斯通關必得 2～5 個。');
  X.acq('afk_cancel_scroll', '燃柳村「哈瑪大師」販售（每張 10 顆龍之鑽石）。帶在身上時，暗夢星迴頭目張開聖結界會自動用掉 1 張；隊伍裡有人會魔法相消術時先讓他放，3 秒後聖結界還在才用卷軸。');
  X.acq('sherine_crystal', '席琳的世界：被席琳化的怪掉落（機率見下方「全域特殊掉落規則」）；謀叛者的低語主謀三人必掉（席琳夢域鏡 20～40、瘋狂席琳 10～20、席琳的世界 5～10、一般 2～5 顆）、真‧吉爾塔斯通關必得 50～100 顆。');

  // ── 暗夢星迴（afk-dreamstar）：六種時空材料 ──
  ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'].forEach(function (id) {
    X.acq(id, '暗夢星迴・星迴試煉（時空裂痕入口）：打倒頭目才會掉，必掉六種時空材料其中一種（隨機）；15 分鐘自爆或中途離開都拿不到。六種集齊＋Lv100 → 可進入時空裂痕-冥王域轉生。');
  });
  X.acq('afk_card_pick', '暗夢星迴頭目 0.01%；四大龍副本最終王 0.01%。使用後可自選任一隻怪的鑽石卡。');

  // ── 失去光輝的碎片（afk-lostshard）──
  Object.keys(DB.items).forEach(function (id) {
    if (!/^afk_lost_/.test(id)) return;
    var base = id.replace(/^afk_lost_/, 'afk_'), bn = (DB.items[base] || {}).n || '對應材料';
    X.acq(id, '席琳夢域鏡：一般怪 1% 掉 1 個（隨機一種）、頭目必掉 5 個（每個隨機一種）；最終頭目決戰不掉。燃柳村「哈瑪大師」：100 個＋龍之鑽石 500＋席琳結晶 1,000 → 換 1 個「' + bn + '」。');
  });

  // ── 詞綴擴充（afk-affix-plus）──
  X.acq('afk_dmark_shard', '燃柳村「龍紋師 艾格尼絲」：同一條龍的心、爪、眼、牙、肉、骨、血、鱗各 1 個換 1 個（龍的材料在四大龍副本掉落）。');
  X.acq('afk_dmark_stone', '燃柳村「龍紋師 艾格尼絲」：龍印碎片 20 個換 1 顆。');
  ['wpn', 'arm'].forEach(function (k) { [[1, 100, '一'], [2, 500, '二'], [3, 800, '三']].forEach(function (t) { X.acq('afk_bless_' + k + '_' + t[0], '燃柳村「龍紋師 艾格尼絲」：' + t[1] + ' 張「祝福的 對' + (k === 'wpn' ? '武器' : '盔甲') + '施法的卷軸」換 1 張（' + t[2] + '階）。'); }); });
  X.acq('afk_dres_shard', '席琳夢域鏡：一般怪 0.1%、頭目必掉 1 個。100 個可在燃柳村「龍紋師 艾格尼絲」賦予「闇龍的抵抗者」。');

  // ── 套裝活動品（afk-sets）：所有頭目 0.05% 掉其中一件 ──
  Object.keys(DB.items).forEach(function (id) {
    var d = DB.items[id]; if (!d || !/^afk_(set_vg_|acc_)/.test(id)) return;
    if (!/^afk_acc_(love|miracle|hope|luck|passion|truth|w11|b11|r11|tr|11)_/.test(id) && !/^afk_set_vg_/.test(id)) return;
    X.acq(id, '活動品：任何頭目被打倒時 0.05% 掉落一件活動飾品（營養滿分、慈愛、奇蹟、希望、幸運、熱情、真實、11 週年、修練者隨機一件；攻城敵人、暗夢星迴除外）。');
  });

  // ── 生命之葉（afk-ttmi-items，2026-10-27）：所有頭目與首領固定 1%，不吃倍率 ──
  Object.keys(DB.items).forEach(function (id) {
    if (DB.items[id].n !== '生命之葉') return;
    X.acq(id, '所有頭目與名稱有「首領」的怪被打倒時固定 1%（不吃組隊、席琳、夢域等任何掉落倍率；攻城守軍與星迴試煉除外）。工匠薩克復原失去氣息的古物時使用。');
  });

  // ── 古代藥水（afk-ancient）：跟著終極治癒藥水一起賣 ──
  X.sellLike(Object.keys(DB.items).filter(function (id) { return /^potion_(heal_anc|anc_pack)/.test(id); }), 'potion_ult');
})();
