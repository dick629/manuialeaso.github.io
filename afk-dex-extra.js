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
  // ── 次元裂縫的材料（11-18 Ping：寫清楚從哪裡來、拿去做什麼；機率與公式不寫）──
  var RG = '次元裂縫', GATE = '席琳神殿「裂縫之門」';
  X.acq('afk_dim_crystal', RG + '裡打倒怪物偶爾會留下。用在守護者之戒、席琳遺骸淬鍊、次元遺物。');
  X.acq('afk_rift_shard', RG + '的頭目一定會留下幾個，一般怪偶爾掉。無盡的裂縫入場、守護者之戒都要用。');
  X.acq('afk_star_dust', RG + '裡的怪偶爾掉。在席琳神殿「次元的鍛造師」加上血龍鑽合成異化星塵。');
  X.acq('afk_split_dust', RG + '裡的怪偶爾掉。在席琳神殿「次元的鍛造師」加上血龍鑽合成聚合的蔑視塵埃。');
  X.acq('afk_star_core', RG + '裡的怪很少掉；無盡的裂縫越往深處越常見。無盡的裂縫入場要用。');
  X.acq('afk_mio_dim', RG + '裡極少見，頭目比一般怪容易，隊伍人越多越容易。密奧之卡升到第五、六階，以及解放起源、解放創世要用。');
  X.acq('afk_dim_xcrystal', GATE + '的副本頭目偶爾留下，隊伍人越多越容易遇到。製作與強化次元遺物、覺醒神話技能書都要用。');
  X.acq('afk_alien_dust', '席琳神殿「次元的鍛造師」：破碎星光塵埃加上血龍鑽合成。強化次元遺物與次元支配（縫天★）要用。');
  X.acq('afk_merge_dust', '席琳神殿「次元的鍛造師」：分裂的蔑視塵埃加上血龍鑽合成。刻幻聖紋要用。');
  X.acq('afk_dimlib_stone', '席琳神殿「次元的鍛造師」：用昇華支配強化石換。強化阿納金的號角要用。');
  X.acq('afk_time_mirror', '佩特拉後裔村「時光的引路人」：用倒影之鏡換。開啟時光副本、強化次元遺物、重抽次元遺物的套裝都要用。');
  X.acq('afk_rd_sand', GATE + '的「哈汀的時空・裂縫」「謀叛者的低語・裂縫」「回到過去的時光・裂縫」，以及時光副本。席琳遺骸淬鍊、之魂憶起要用。');
  X.acq('afk_rd_water', GATE + '的「謀叛者的低語・裂縫」「回到過去的時光・裂縫」偶爾撿到，時光副本也有機會。席琳遺骸淬鍊、之魂憶起要用。');
  X.acq('afk_rd_scale', GATE + '的「四龍副本・裂縫」：打倒龍時取得。');
  X.acq('afk_rd_feather', RG + '開著時，傲慢之塔 91～100 樓的怪偶爾掉；墮光天使 阿納金也會留下。10 片可以召喚阿納金。');
  X.acq('afk_rd_echo', GATE + '的墮光天使 阿納金第 3～5 形態留下。50 個可以進次元藝能「號角」的副本。');
  X.acq('afk_rd_pick', GATE + '的墮光天使 阿納金留下。在席琳神殿「次元的鍛造師」換成武器、防具或飾品用的昇華支配強化石。');
  X.acq('afk_rd_mirror', GATE + '的「倒影迴廊」，時光副本也有機會。次元時空進化要用；在佩特拉後裔村「時光的引路人」換時光之鏡。');
  X.acq('afk_rd_ember', GATE + '的「燃燼礦坑」：鑽機撐得越久挖得越多。50 個可以進次元藝能「熾燼」的副本。');
  X.acq('afk_rd_ink', GATE + '的「漂流的墓船」：深淵的大王烏賊留下，時光副本也有機會。50 個可以進次元藝能「墨」的副本。');
  X.acq('afk_rd_neptune', GATE + '的「漂流的墓船」深處撿到，時光副本也有機會。50 個可以進次元藝能「海」的副本。');
  X.acq('afk_rd_eclipse', GATE + '的「星墜的祭壇」：星蝕者留下。黃道星卡升到歸一要用。');
  X.acq('afk_rd_hmark', GATE + '的「哈汀的時空・裂縫」，時光副本也有機會。50 個可以進次元藝能「哈汀」的副本。');
  X.acq('afk_rd_thread', GATE + '的「封印戰」與「無盡的裂縫」留下。');
  X.acq('afk_rd_remnant', GATE + '的「封印戰」與「無盡的裂縫」深處留下，時光副本也有機會。50 個可以進次元藝能「殘光」的副本。');
  X.acq('afk_anakin_horn', GATE + '：第一次打倒墮光天使 阿納金第 5 形態時取得（每個角色一支）。');
  [['afk_guard_rift_glim', '裂縫碎光'], ['afk_guard_rift_memory', '席琳的水之記憶'], ['afk_guard_rift_thread', '天空的縫線'], ['afk_guard_rift_sand', '凝結的時之沙'], ['afk_guard_rift_scale', '侵蝕龍鱗']].forEach(function (x) {
    X.acq(x[0], '開了守護者之戒的欄位後，在次元裂縫拿到「' + x[1] + '」時，會同時拿到一樣多的這個。只用在守護者之戒。');
  });
  X.acq('afk_dim_essence', '席琳神殿「藝能的守門人」：用地獄精華換。解放、升星次元藝能要用。');
  X.acq('afk_dim_stardust', '席琳神殿「藝能的守門人」：用至暗星塵換。解放、升星次元藝能要用。');
  ['horn', 'light', 'ember', 'ink', 'sea', 'hardin'].forEach(function (k) { X.acq('afk_art_' + k, '席琳神殿「藝能的守門人」的藝能副本：打倒你自己的倒影時留下。解放、升星對應的次元藝能要用。'); });
  X.acq('afk_rune_dim', 'GD之子的期待的頭目很少留下；佩特拉後裔村「時光的引路人」的時光副本偶爾撿到。符文升星要用。');
  ['afk_rune_dim2', 'afk_rune_dim3'].forEach(function (id) { X.acq(id, '佩特拉後裔村「時光的引路人」的時光副本偶爾撿到。符文升星要用。'); });
  X.acq('afk_eye_four', '威頓村「米米」：四種次元魔眼合成（每個角色一顆）。');
  // ── 劇情「吞噬天空的光」「伊娃的水」的任務道具（afk-riftquest）──
  (function () {
    var H1 = '劇情任務「吞噬天空的光」進行到該章時，', H2 = '劇情任務「伊娃的水」進行到該章時，', T = '收齊為止。';
    X.acq('afk_rq_ero', H1 + '次元裂縫開著、在野外打倒一般怪必定取得，' + T);
    X.acq('afk_rq_stay', H1 + '次元裂縫開著、在村莊以外連續撐過 10 分鐘取得（回村、倒下、關掉裂縫會重算）。');
    X.acq('afk_rq_root', H1 + '次元裂縫開著、在精靈墓穴打倒一般怪必定取得，' + T);
    X.acq('afk_rq_heart', H1 + '次元裂縫開著、打倒深淵之主必定取得，' + T);
    X.acq('afk_rq_seed', H1 + '次元裂縫開著、在日出之國的東之地、西之地、北之地、城墎各打倒一隻怪取得一顆。');
    X.acq('afk_rq_charm', H1 + '次元裂縫開著、在日出之國的東之地、西之地、北之地、城墎打倒一般怪必定取得，' + T);
    X.acq('afk_rq_plume', H1 + '次元裂縫開著、在傲慢之塔 91～100 樓打倒一般怪必定取得，' + T);
    X.acq('afk_rq_oracle', H1 + '每打倒一次墮光天使 阿納金（任一形態）取得一份，' + T);
    X.acq('afk_rq_assent', H1 + '在次元裂縫裡打倒安塔瑞斯、法利昂、巴拉卡斯、林德拜爾（巢穴或四龍副本・裂縫都算），每條龍一片。');
    X.acq('afk_rq_log', H1 + '在「漂流的墓船」打倒深淵的大王烏賊取得。');
    X.acq('afk_rq_page', H1 + '在「星墜的祭壇」打倒星蝕者 艾斯崔亞取得。');
    X.acq('afk_rq_evaw', H2 + '次元裂縫開著、在伊娃王國打倒一般怪必定取得，' + T);
    X.acq('afk_rq_refl', H2 + '在「倒影迴廊」打倒映照者 米菈取得。');
    X.acq('afk_rq_oath', H2 + '次元裂縫開著、在傲慢之塔頂打倒土、水、風、火精靈王，每位一份。');
    X.acq('afk_rq_tear', H2 + '次元裂縫開著、在伊娃王國打倒一般怪必定取得，' + T);
    X.acq('afk_rq_word', H2 + '打倒墮光天使 阿納金（任一形態）取得。');
  })();
  X.acq('afk_gt_key', '長老會議廳 NPC「次元裂隙」：次元時空鑰匙碎片(上)＋(下) 組成。交出鑰匙進入異界祭壇（席琳夢域鏡限定、每個角色每天通關一次）。');
  X.acq('afk_gt_orb', '崩壞的長老會議廳「真‧死亡騎士 冥皇丹特斯」：身上沒有寶珠時必掉。帶在身上＝全隊免疫真‧吉爾塔斯的致死圓形結界。');
  X.acq('wpn_gt_sword', '吉爾塔斯副本・異界祭壇：打倒第三層「真‧吉爾塔斯」通關時很少見地出現（唯一）。');

  // ── 謀叛者的低語（afk-traitor）：主謀三人另外掉 ──
  ['冥皇丹特斯', '反王肯恩(謀叛)', '魔女賽尼斯(謀叛)'].forEach(function (n) {
    X.drop(n, 'sherine_crystal', 100, '20～40 顆', true);
    X.drop(n, 'afk_asc_shard', 30, '1～3 個', true);
  });

  // ── 席琳夢域鏡（afk-dreamhell）──
  X.acq('afk_dream_crystal', '席琳夢域鏡：一般怪常常掉 1 顆，頭目一定掉 3 顆。暗夢星迴的頭目有時會留下三個隨機的昇華支配材料，也可能是這個。');
  X.acq('afk_hell_essence', '席琳夢域鏡：頭目一定掉 1 個。暗夢星迴的頭目有時會留下三個隨機的昇華支配材料，也可能是這個。');
  ['earth', 'water', 'wind', 'fire'].forEach(function (k) {
    X.acq('afk_contempt_' + k, function () {
      return '席琳夢域鏡：Lv80 以上頭目必掉一顆（四屬性隨機）；滅魔蔑視水晶碎片 100 個合成 1 顆。' + (k === 'earth' ? '「' + antFinal() + '」（任何模式）必掉。' : '') + '暗夢星迴頭目的隨機材料也可能抽到。';
    });
  });
  X.acq('afk_contempt_shard', '席琳夢域鏡的一般怪偶爾掉。100 個合成 1 顆滅魔蔑視水晶。');
  X.acq('afk_abyss_key', '四大龍副本裡的怪偶爾掉（席琳夢域鏡比較常見，瘋狂的席琳世界極少）。暗夢星迴頭目的隨機材料也可能是這個。');
  X.acq('afk_dark_stardust', '燃柳村「哈瑪大師」：地獄精華 20 個合成（有機會失敗）。暗夢星迴頭目的隨機材料也可能是這個。');
  X.acq('afk_dream_dust', '暗夢星迴的頭目有時會留下三個隨機的昇華支配材料，這是其中最難抽到的幾種之一。');
  ['wpn', 'arm', 'acc'].forEach(function (k) {
    X.acq('afk_asc_stone_' + k, '席琳夢域鏡：白金卡全部收集滿以後，打怪極少見地掉（三種隨機一種）；也可以在萊利的輔佐官用 500 積分指定兌換。');
  });
  X.acq('afk_asc_shard', '席琳夢域鏡：白金卡全部收集滿以後，打怪很少見地掉；謀叛者的低語（席琳夢域鏡）的主謀三人常常留下 1～3 個；真‧吉爾塔斯通關一定給 2～5 個。');
  X.acq('afk_cancel_scroll', '燃柳村「哈瑪大師」販售（每張 10 顆龍之鑽石）。帶在身上時，暗夢星迴頭目張開聖結界會自動用掉 1 張；隊伍裡有人會魔法相消術時先讓他放，3 秒後聖結界還在才用卷軸。');
  X.acq('sherine_crystal', '席琳的世界：被席琳化的怪會掉；謀叛者的低語的主謀三人一定掉（席琳夢域鏡 20～40、瘋狂席琳 10～20、席琳的世界 5～10、一般 2～5 顆）；真‧吉爾塔斯通關一定給 50～100 顆。');

  // ── 暗夢星迴（afk-dreamstar）：六種時空材料 ──
  ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'].forEach(function (id) {
    X.acq(id, '暗夢星迴・星迴試煉（時空裂痕入口）：打倒頭目才會掉，必掉六種時空材料其中一種（隨機）；15 分鐘自爆或中途離開都拿不到。六種集齊＋Lv100 → 可進入時空裂痕-冥王域轉生。');
  });
  X.acq('afk_card_pick', '暗夢星迴的頭目、四大龍副本的最終王極少見地掉。使用後可自選任一隻怪的鑽石卡。');

  // ── 失去光輝的碎片（afk-lostshard）──
  Object.keys(DB.items).forEach(function (id) {
    if (!/^afk_lost_/.test(id)) return;
    var base = id.replace(/^afk_lost_/, 'afk_'), bn = (DB.items[base] || {}).n || '對應材料';
    X.acq(id, '席琳夢域鏡：一般怪偶爾掉 1 個，頭目一定掉 5 個（每個隨機一種）；最終頭目決戰不掉。在燃柳村「哈瑪大師」用 100 個，加上龍之鑽石 500、席琳結晶 1,000，換 1 個「' + bn + '」。');
  });

  // ── 詞綴擴充（afk-affix-plus）──
  X.acq('afk_dmark_shard', '燃柳村「龍紋師 艾格尼絲」：同一條龍的心、爪、眼、牙、肉、骨、血、鱗各 1 個換 1 個（龍的材料在四大龍副本掉落）。');
  X.acq('afk_dmark_stone', '燃柳村「龍紋師 艾格尼絲」：龍印碎片 20 個換 1 顆。');
  ['wpn', 'arm'].forEach(function (k) { [[1, 100, '一'], [2, 500, '二'], [3, 800, '三']].forEach(function (t) { X.acq('afk_bless_' + k + '_' + t[0], '燃柳村「龍紋師 艾格尼絲」：' + t[1] + ' 張「祝福的 對' + (k === 'wpn' ? '武器' : '盔甲') + '施法的卷軸」換 1 張（' + t[2] + '階）。'); }); });
  X.acq('afk_dres_shard', '席琳夢域鏡：一般怪很少掉，頭目一定掉 1 個。100 個可以在燃柳村「龍紋師 艾格尼絲」賦予「闇龍的抵抗者」。');

  // ── 符文石與時空裂痕重做（afk-runedata／afk-rift2）──
  X.acq('afk_lament_dust', '時空裂痕（席琳模式）：一般怪偶爾掉，頭目常常掉（等級越高越常見），撐到第 60 分鐘以後頭目一定掉。');
  X.acq('afk_lament_shard', '時空裂痕（瘋狂席琳模式）：一般怪偶爾掉，頭目常常掉（等級越高越常見），撐到第 60 分鐘以後頭目一定掉。');
  X.acq('afk_lament_stone', '時空裂痕（夢域鏡席琳模式）：一般怪偶爾掉，頭目常常掉（等級越高越常見），撐到第 60 分鐘以後頭目一定掉。');
  X.acq('afk_lament_crystal', '燃柳村「符文師 佐爾頓」：哀石塵埃 150 個換 1 個。');
  X.acq('afk_lament_essence', '燃柳村「符文師 佐爾頓」：哀石碎片 150 個換 1 個。');
  X.acq('afk_lament_gem', '燃柳村「符文師 佐爾頓」：哀石 150 個換 1 個。');
  X.acq('afk_miasma_stone', '時空裂痕（席琳模式）撐滿 60 分鐘完全通關：100 個。');
  X.acq('afk_bone_stone', '時空裂痕（瘋狂席琳模式）撐滿 60 分鐘完全通關：50 個。');
  X.acq('afk_void_stone', '時空裂痕（夢域鏡席琳模式）撐滿 60 分鐘完全通關：10 個；夢域鏡撐過 55 分鐘的結算也可能給。');
  X.acq('afk_fate_unlock', '燃柳村「符文師 佐爾頓」：瘴氣魔石 1,000、骸骨魔石 500、破空石 100 換 1 個。');
  X.acq('afk_runebox_1', '時空裂痕（席琳模式）的結算獎勵；頭目也極少見地掉。');
  X.acq('afk_runebox_2', '時空裂痕的結算獎勵（瘋狂席琳撐 9～55 分、夢域鏡撐 9～35 分）；瘋狂席琳模式的頭目也極少見地掉。');
  X.acq('afk_runebox_3', '時空裂痕的結算獎勵（瘋狂席琳撐 55 分以上或完全通關、夢域鏡撐 35～55 分）；夢域鏡模式的頭目也極少見地掉。');
  ((window.__afkRuneData || {}).list || []).forEach(function (r) { X.acq(r.id, '打開「失去光芒的符文石（' + window.__afkRuneData.STAGE_N[r.stage] + '）」隨機取得。'); });

  // ── 遺物第二詞綴重洗（afk-relicreroll）──
  X.acq('afk_reverie_incense', '席琳夢域鏡的四龍巢穴：各區頭目一定掉 2 個、最終龍一定掉 5 個，一般怪偶爾掉 1 個。');
  X.acq('afk_reverie_crystal', '銀騎士村「艾彼迪爾」：回夢香塵 20 個換 1 個。用來重洗遺物的第二詞綴（另需一件 +10 遺物）。');

  // ── 套裝活動品（afk-sets）：所有頭目 0.05% 掉其中一件 ──
  Object.keys(DB.items).forEach(function (id) {
    var d = DB.items[id]; if (!d || !/^afk_(set_vg_|acc_)/.test(id)) return;
    if (!/^afk_acc_(love|miracle|hope|luck|passion|truth|w11|b11|r11|tr|11)_/.test(id) && !/^afk_set_vg_/.test(id)) return;
    X.acq(id, '活動品：打倒任何頭目時極少見地掉一件活動飾品（營養滿分、慈愛、奇蹟、希望、幸運、熱情、真實、11 週年、修練者隨機一件）。攻城的敵人、暗夢星迴不會掉。');
  });

  // ── 生命之葉（afk-ttmi-items，2026-10-27）：所有頭目與首領固定 1%，不吃倍率 ──
  Object.keys(DB.items).forEach(function (id) {
    if (DB.items[id].n !== '生命之葉') return;
    X.acq(id, '所有頭目、名字裡有「首領」的怪偶爾掉（組隊或換世界都一樣，不會變多；攻城守軍與星迴試煉不掉）。工匠薩克復原失去氣息的古物時使用。');
  });

  // ── 劇情「水面下的證詞」（afk-dreamquest）的任務道具：任務進行到該章、在席琳夢域鏡世界打倒指定對象必定取得 ──
  (function () {
    var mn = function (id) { try { return (W.AFK_EXTRA && W.AFK_EXTRA.mapName) ? W.AFK_EXTRA.mapName(id) : id; } catch (e) { return id; } };
    var HEAD = '劇情任務「水面下的證詞」進行到該章時，在席琳夢域鏡世界', TAIL = '必定取得，收齊為止。';
    var byMap = function (id, map, who) { X.acq(id, function () { return HEAD + '的' + mn(map) + '打倒' + who + TAIL; }); };
    var byMobs = function (id, mobs, note) { mobs.forEach(function (m) { X.drop(m, id, 100, '任務進行中', true); }); X.acq(id, HEAD + '打倒' + mobs.join('、') + TAIL + (note || '')); };
    byMap('afk_dq_drop', 'eva_kingdom', '任一怪物');
    byMap('afk_dq_grace', 'pride_91_100', '一般怪');
    byMap('afk_dq_stair', 'pride_91_100', '一般怪');
    byMap('afk_dq_plan', 'zone_41', '任一怪物');
    byMap('afk_dq_dew', 'tikal_deep', '任一怪物');
    byMobs('afk_dq_ledger', ['邪惡的鐮刀死神', '邪惡的鐮刀死神(支配)']);
    byMobs('afk_dq_note', ['哈汀之影']);
    byMobs('afk_dq_book', ['提卡爾杰弗雷庫(雄)', '提卡爾杰弗雷庫(雌)'], '雄、雌各算 2 本。');
    byMobs('afk_dq_echo', ['真‧吉爾塔斯']);
    byMobs('afk_dq_sutra', ['長老．琪娜', '長老．安迪斯', '長老．巴塔斯', '長老．巴洛斯', '長老．巴陸德', '長老．拉曼斯', '長老．泰瑪斯', '長老．艾迪爾'], '每位長老只算一次。');
    X.acq('afk_dq_scar', HEAD + '打倒四龍（安塔瑞斯、法利昂、巴拉卡斯、林德拜爾）' + TAIL + '每條龍只算一次。');
    X.acq('afk_dq_eye', HEAD + '打倒暗夢星迴的夢境者投影' + TAIL);
    X.acq('afk_dq_wedge', '劇情任務「水面下的證詞」進行到該章時，在席琳夢域鏡的時空裂痕撐過 30 分鐘，結算時取得。');
    X.acq('afk_dq_lens', '劇情任務「水面下的證詞」最後一章「監視之眼」第一次完成的獎勵（不會消耗）。');
  })();
  // ── 世界事件「克特的追殺令」（afk-kurt-hunt）──
  X.acq('afk_kurt_order', '世界事件「克特的追殺令」：打倒前來追殺王族的克特必定取得 1 張。');

  // ── 各系統的專屬道具：沒有登記過取得方式的，至少指到小百科講這個系統的分頁（全部外掛載入完才掃一次）──
  var fillByPrefix = function () {
    var see = function (tab) { return '取得方式與用途見小百科「' + tab + '」分頁。'; };
    var RULES = [
      [/^afk_qw40_/, '說話之島「新手指導員 莉娜」的新手任務獎勵：接下後打倒 30 隻怪物交回（Lv50 以下才能接，每個角色一把，可以用到 Lv40）。'],
      [/^afk_qw60_/, '說話之島「新手指導員 莉娜」：完成 30 級職業試煉後領取，或用 5 枚狩獵徽章交換（每個角色一把，可以用到 Lv60）。'],
      [/^afk_arw(bag)?_/, '歐瑞村莊的箭矢工匠「門蘇」製作。'],
      [/^afk_(soul|dull|brace|abyss|will|yin)_/, see('靈魂石')],
      [/^afk_rune_/, see('符文系統')],
      [/^afk_(sigil|mio)_/, see('密奧與聖紋')],
      [/^afk_(zd|rd|dim|cloth)_/, see('次元裂縫')],
      [/^afk_blood_dia$/, '潘朵拉黑市用龍之鑽石兌換。用途見小百科「次元裂縫」分頁。'],
      [/^afk_guard_/, see('守護者之戒')],
      [/^afk_rift_/, see('時空裂痕')],
      [/^afk_(rb|we)_/, see('世界事件與地區霸主')],
      [/^afk_kurt_helm$/, see('世界事件與地區霸主')],
      [/^afk_engrave_/, see('星途遠征')],
      [/^afk_hunter_/, see('冒險者')],
      [/^afk_set_/, see('套裝')],
      [/^afk_(hp|hd)_/, see('劇情任務')]
    ];
    try {
      Object.keys(DB.items).forEach(function (id) {
        if (id.charCodeAt(0) !== 97 || id.indexOf('afk_') !== 0 || id.indexOf('~') >= 0 || X.acquire[id]) return;
        for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(id)) { X.acquire[id] = RULES[i][1]; break; }
      });
      X.rev++;
    } catch (e) {}
  };
  if (document.readyState === 'complete') setTimeout(fillByPrefix, 0); else W.addEventListener('load', function () { setTimeout(fillByPrefix, 0); });

  // ── 古代藥水（afk-ancient）：跟著終極治癒藥水一起賣 ──
  X.sellLike(Object.keys(DB.items).filter(function (id) { return /^potion_(heal_anc|anc_pack)/.test(id); }), 'potion_ult');
})();
