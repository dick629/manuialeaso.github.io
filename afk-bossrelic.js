/* ============================================================================
 * afk-bossrelic.js — 王者遺物（地圖王、副本王專屬遺物 79 件；設計稿 claude/boss-relic-design.md，Ping 11-13 19:35／20:28 定案）
 *
 *   ‧一隻王一件，掉落率跟其他遺物一樣（MOB_DROPS[王的名字] 0.01%，走核心的掉落流程，吃一樣的掉落倍率）；不跟王者卡冊連動。
 *   ‧部位底子（傷害、命中、AC…）＝現有同部位遺物的平均（11-13 量的，見 BASE）；遺物合成、昇華支配、詞綴照 afk-relicplus 共通規則。
 *   ‧特效分 5 階：本體（+0）／+5／+10／昇華支配／昇華支配 +5（tier()，跟現有 250 件同一套切法）。
 *       百分比 ×1／1.25／1.5／2.4／3.5；機率 ×1／1.2／1.4／1.8／2.2（最多 100%）；間隔、冷卻 ÷1／1.1／1.2／1.4／1.6；疊層 +0／0／1／2／3。
 *   ‧武器另有「王者之威」造成的傷害 +N%（MIGHT_BASE，各部位不同；木人場對齊現有同部位遺物用）。
 *   ‧保命效果（短暫無敵、保住 1 HP、站起來）：同一個人身上同時只算一件（階段最高的那件）。
 *   ‧掛點：afk-procfx 的 dealt／taken／tick／kill／death；__afkRelicTier（buildDef 時寫入階段）；
 *         金幣 dollFieldVal('goldBonus')、經驗 __afkTtmiExpMult。
 *   ‧內部：觸發型（命中時 c%）同一個人同一種效果 0.5 秒內最多一次。
 *   ‧圖示：assets/icons/relic-boss/<key>.webp（GPT 圖，11-13 交件）。經典模式沒有效果。外掛開關 bossrelic。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossrelic', name: '王者遺物', group: '遊戲內容', desc: '79 隻地圖王、副本王各掉一件專屬遺物' });
  if (T && !T.enabled('bossrelic')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var X = function () { return W.__afkProc; };
  var tk = function () { try { return Number(state.ticks) || 0; } catch (e) { return 0; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RATE = 0.0001;

  // ── 部位底子（11-13 現有遺物同部位平均，四捨五入）與職業、武器種類 ──
  var BASE = {
    sword1: { type: 'wpn', tags: ['單手劍'], req: 'royal,knight,elf,mage,dark,dragon', s: { dmgS: 7, dmgL: 8, hit: 11, dmgBonus: 11 }, img: 'relic_goblin_blade', cat: '單手劍' },
    dagger: { type: 'wpn', tags: ['匕首'], req: 'royal,knight,elf,mage,dark', s: { dmgS: 6, dmgL: 6, hit: 11, dmgBonus: 9 }, img: 'relic_doberman_fang', cat: '匕首' },
    wand: { type: 'wpn', isWand: true, ignHardSkin: true, req: 'royal,knight,elf,mage,illusion', s: { dmgS: 6, dmgL: 6, hit: 11, dmgBonus: 11, extraMp: 3 }, img: 'relic_zombie_shin', cat: '魔杖' },
    blunt2: { type: 'wpn', w2h: true, eff: 'crush', ignHardSkin: true, tags: ['雙手鈍器'], req: 'royal,knight,elf,illusion,dragon,warrior', s: { dmgS: 21, dmgL: 23, hit: 11, dmgBonus: 12 }, img: 'relic_golem_fist', cat: '雙手鈍器' },
    chainsword: { type: 'wpn', w2h: true, chainsword: true, eff: 'combo', ignHardSkin: true, weakExpose: true, req: 'dragon', s: { dmgS: 23, dmgL: 21, hit: 15, dmgBonus: 15, comboRate: 20 }, img: 'relic_starfish_arm', cat: '鎖鏈劍' },
    spear: { type: 'wpn', w2h: true, eff: 'pierce', pierceChance: 100, ignHardSkin: true, tags: ['矛'], req: 'royal,knight,warrior', s: { dmgS: 13, dmgL: 14, hit: 13, dmgBonus: 12, mhp: 9 }, img: 'relic_executor_skewer', cat: '矛' },
    bow: { type: 'wpn', w2h: true, isBow: true, ranged: true, ignHardSkin: true, req: 'royal,knight,elf,mage,illusion', s: { dmgS: 3, dmgL: 3, hit: 13, dmgBonus: 12, rapidfire: 70 }, img: 'relic_orcarcher_bow', cat: '弓' },
    claw: { type: 'wpn', w2h: true, eff: 'combo', ignHardSkin: true, tags: ['鋼爪'], req: 'dark', s: { dmgS: 17, dmgL: 15, hit: 11, dmgBonus: 12, comboRate: 40 }, img: 'relic_spider_claw', cat: '鋼爪' },
    dual: { type: 'wpn', w2h: true, eff: 'combo', ignHardSkin: true, tags: ['雙刀'], req: 'dark', s: { dmgS: 15, dmgL: 11, hit: 14, dmgBonus: 14, comboRate: 30 }, img: 'relic_elastic_rib', cat: '雙刀' },
    katana: { type: 'wpn', tags: ['單手劍', '武士刀'], req: 'royal,knight,elf,dark,dragon', s: { dmgS: 15, dmgL: 13, hit: 16, dmgBonus: 15 }, img: 'relic_darkelf_grindblade', cat: '武士刀' },
    sword2: { type: 'wpn', w2h: true, eff: 'cleave', tags: ['雙手劍'], req: 'royal,knight,dragon', s: { dmgS: 22, dmgL: 24, hit: 13, dmgBonus: 16 }, img: 'relic_venom_fang', cat: '雙手劍' },
    shield: { type: 'arm', slot: 'shield', req: 'royal,knight,elf,mage,dark,dragon,illusion', s: { ac: 5, mr: 4, dr: 3, mhp: 7, block: 12 }, img: 'relic_orc_lid', cat: '盾牌' },
    armor: { type: 'arm', slot: 'armor', req: 'all', s: { ac: 10, mr: 4, dr: 2 }, img: 'relic_wolf_shawl', cat: '盔甲' },
    cloak: { type: 'arm', slot: 'cloak', req: 'all', s: { ac: 6, mr: 5, er: 2, dr: 1 }, img: 'relic_dwarf_sheet', cat: '斗篷' },
    helm: { type: 'arm', slot: 'helm', req: 'all', s: { ac: 5, mr: 5 }, img: 'relic_mushroom_cap', cat: '頭盔' },
    gloves: { type: 'arm', slot: 'gloves', req: 'all', s: { ac: 5 }, img: 'relic_monsterhand_skin', cat: '手套' },
    boots: { type: 'arm', slot: 'boots', req: 'all', s: { ac: 7, er: 2, mmp: 8, mpR: 1 }, img: 'relic_shepherd_boots', cat: '長靴' },
    shin: { type: 'arm', slot: 'shin', req: 'all', s: { ac: 3, mr: 1 }, img: 'relic_orc_loincloth', cat: '脛甲' },
    amulet: { type: 'acc', slot: 'amulet', req: 'all', s: { mr: 1, er: 1, mmp: 4 }, img: 'relic_ghoul_bracelet', cat: '項鍊' },
    ear: { type: 'acc', slot: 'ear', req: 'all', s: { ac: 1, hpR: 4 }, img: 'relic_bear_fishbone', cat: '耳環' },
    ring: { type: 'acc', slot: 'ring', req: 'all', s: { mr: 1, mhp: 8, hpR: 2, mpR: 2 }, img: 'relic_mermaid_tear', cat: '戒指' },
    belt: { type: 'acc', slot: 'belt', req: 'all', s: { ac: 1, hpR: 2 }, img: 'relic_ohm_shackle', cat: '腰帶' }
  };

  // ── 79 件：[王的代號, 部位, 遺物名, 說明, 特效…]；特效 [種類, +0 的數值] ──
  var LIST = [
    ['gorun', 'shield', '老樹精的年輪盾', '老樹精哥倫掉下的一圈年輪，年年長出新的嫩芽。', ['regen', { p: 1 }], ['summon', { name: '小樹精', p: 30 }], ['share', { p: 4 }]],
    ['dela', 'chainsword', '黛菈的蔓刺鞭', '墮落樹妖的藤蔓編成的鞭子，倒刺會緊緊纏住獵物。', ['entangle', { c: 10, p: 15 }], ['vsMarked', { p: 15 }]],
    ['sarna', 'armor', '巨蟒的蛻皮甲', '巨蟒薩爾納蛻下的皮，鱗片之間還滲著毒液。', ['magicCut', { p: 5 }], ['thorn', { c: 20, p: 5 }]],
    ['odi', 'sword1', '叛騎士的斷誓劍', '歐迪背棄誓言那天折斷的劍，斷口反而更鋒利。', ['block', { c: 6 }], ['blockNext', { p: 50 }]],
    ['kajie', 'dagger', '盜賊王的沙暗匕首', '卡傑藏在沙塵裡出手的匕首，見光之前一切就結束了。', ['stealth', { t: 15, p: 150 }], ['gold', { p: 10 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['kentgen', 'amulet', '斷劍將軍的軍令章', '肯特將軍至死別在胸前的軍令章，部下見到它便不會退。', ['allyDmg', { p: 10 }], ['lowHpTeam', { p: 3 }]],
    ['scar', 'dual', '刀疤的雙刃', '盜賊團長刀疤的一對短刃，一刀見血、一刀奪財。', ['mpSteal', { c: 15, n: 5 }], ['double', { c: 10 }]],
    ['melo', 'wand', '潮汐女巫的珠杖', '梅洛以海潮淬鍊的珠杖，咒文一出便捲起水柱。', ['splash', { c: 15, p: 40 }], ['magicCut', { p: 5 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['polly', 'gloves', '巨人王的投石臂甲', '獨眼巨人之王投擲巨石時穿的臂甲，越遠越有勁。', ['ranged', { p: 8 }], ['berserk', { p: 15 }]],
    ['fenris', 'cloak', '冰狼王的毛皮斗篷', '芬里斯的毛皮，披上的人身邊總跟著一頭冰狼。', ['summon', { name: '冰狼', p: 30 }], ['res', { k: 'resWater', n: 20 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['saka', 'spear', '蠍王的尾鉤', '蠍王薩卡的尾鉤，毒液一層疊過一層。', ['poison', { c: 15, p: 2, k: 3 }], ['invuln', { th: 30, d: 2, cd: 120 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['karan', 'ring', '戰魂的不滅戒', '不散的戰魂卡蘭留下的戒指，倒下的人還會再握緊武器。', ['lastStand', { cd: 180, p: 20 }]],
    ['wag', 'claw', '銀狼人的利爪', '銀色狼人瓦格的爪子，專挑虛弱的獵物下手。', ['hunt', { p: 12 }], ['lifesteal', { p: 2 }]],
    ['red', 'bow', '黑鬍子的燧發短銃', '海賊船長雷德的短銃，必要時整艘船的砲口都會跟著開火。', ['pulse', { name: '砲擊', t: 8, p: 60 }], ['gold', { p: 10 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['isfi', 'armor', '深海守護者的鱗甲', '伊斯菲在深海守了千年的鱗甲，潮水會替穿的人療傷。', ['physCut', { p: 5 }], ['regen', { p: 1 }], ['absorb', { e: 'water', p: 20 }]],
    ['sphinx', 'ear', '獅身人面的謎之耳環', '答不出謎題的人，攻擊都會原封不動地回到自己身上。', ['guard', { p: 3 }], ['reflect', { c: 15, p: 30 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['kuku', 'helm', '羽蛇祭司的羽冠', '庫庫祭祀羽蛇時戴的羽冠，羽毛裡藏著神的庇護。', ['magicDmg', { p: 8 }], ['invuln', { th: 30, d: 2, cd: 120 }], ['weak', { e: 'wind', c: 20, p: 20 }]],
    ['ronin', 'katana', '落武者的居合刀', '無名落武者的佩刀，收刀的那一瞬間才看得見刀光。', ['iai', { t: 6, p: 250 }], ['block', { c: 6 }]],
    ['drake', 'amulet', '黑鱗幼龍的逆鱗', '黑鱗幼龍喉下唯一倒長的鱗片，碰到便噴出龍息。', ['pulse', { name: '龍息', t: 8, p: 60 }], ['res', { k: 'resFire', n: 20 }], ['weak', { e: 'fire', c: 20, p: 20 }]],
    ['recruit', 'amulet', '教官人偶的訓練徽章', '修練場教官人偶胸口的徽章，戴著它練功事半功倍。', ['exp', { p: 5 }], ['regen', { p: 1 }]],
    ['spartoi', 'shield', '骨兵長的骨盾', '沉默的骨兵長用同袍骸骨拼成的盾，敲一下骷髏兵就會站起來。', ['summon', { name: '骷髏兵', p: 30 }], ['block', { c: 6 }]],
    ['hermit', 'amulet', '隱遁王的地獄犬項圈', '薩爾瓦養的地獄犬戴的項圈，聞到血味的那一刻最兇。', ['petDmg', { p: 10 }], ['ambush', { p: 100 }]],
    ['gate', 'shield', '鐵壁將軍的塔盾', '正門的鐵壁將軍扛了一輩子的塔盾，再大的王也撞不開。', ['block', { c: 6 }], ['bossCut', { p: 5 }]],
    ['tamer', 'chainsword', '馴獸王的皮鞭', '受詛咒的馴獸王的皮鞭，鞭聲一響百獸發狂。', ['allyDmg', { p: 10 }], ['berserk', { p: 15 }]],
    ['sadtio', 'dagger', '血祭司的獻祭短刃', '神廟深處的血祭司用來獻祭的短刃，刺下去的血都歸持有者。', ['lifesteal', { p: 2 }], ['magicCut', { p: 5 }]],
    ['bandit', 'boots', '游擊頭子的輕靴', '巴洛打了就跑的輕靴，總能搶在對手前面出手。', ['ambush', { p: 100 }], ['atk', { p: 6 }]],
    ['tiger', 'ear', '白虎王的牙飾', '森林白虎王塔加的獠牙，受傷越重越兇猛。', ['melee', { p: 8 }], ['berserk', { p: 15 }], ['weak', { e: 'wind', c: 20, p: 20 }]],
    ['scarbeast', 'ring', '異界獸的變異核', '闇龍傷痕裡長出的異界獸核心，還在一下一下地跳動。', ['poison', { c: 15, p: 2, k: 3 }], ['regen', { p: 1 }], ['vsWeak', { p: 15 }]],
    ['lizardk', 'shin', '蜥蜴王的鱗片護腿', '密林蜥蜴王戈札的鱗片，刀槍法術都難以穿透。', ['guard', { p: 3 }], ['magicCut', { p: 3 }]],
    ['handy', 'gloves', '怪手的吸盤手套', '海底隧道怪手的吸盤，抓住就不放，還會招來觸手。', ['entangle', { c: 10, p: 15 }], ['summon', { name: '觸手', p: 30 }]],
    ['dwarfgen', 'blunt2', '侏儒大將軍的戰旗', '侏儒大將軍插在陣前的戰旗，人越多旗越重。', ['perAlly', { p: 2 }], ['teamDmg', { p: 4 }]],
    ['lykan2', 'helm', '狼群首領的頭骨盔', '北島狼群首領的頭骨，戴上它狼群便認你為王。', ['summon', { name: '狼群', p: 30 }], ['berserk', { p: 15 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['orcelder', 'wand', '大長者的骨杖', '妖魔部落大長者的骨杖，敲地一下詛咒與戰士一起現身。', ['curse', { c: 10, p: 10 }], ['summon', { name: '妖魔戰士', p: 30 }]],
    ['griffin', 'bow', '格利芬王的翼羽弓', '荒地格利芬王的翼羽製成的弓，第一箭總是最狠。', ['ambush', { p: 100 }], ['pulse', { name: '俯衝', t: 8, p: 60 }], ['weak', { e: 'wind', c: 20, p: 20 }]],
    ['kraken', 'belt', '大王烏賊的墨囊', '大王烏賊的墨囊，被打中時一團墨就噴了出去。', ['ink', { c: 15, p: 25 }], ['summon', { name: '觸手', p: 30 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['spiderq', 'cloak', '蜘蛛女王的絲網斗篷', '地底蜘蛛女王的絲網，碰到的人手腳都慢了下來。', ['web', { c: 15, p: 15 }], ['summon', { name: '小蜘蛛', p: 30 }], ['vsWeak', { p: 15 }]],
    ['keeper', 'amulet', '守墓人的提燈', '被遺忘的守墓人提著的燈，燈火不滅，守墓人也不會倒下。', ['summon', { name: '骷髏', p: 30 }], ['lastStand', { cd: 180, p: 20 }]],
    ['one', 'ear', '夢魘幼龍的眠鱗', '歐涅身上的鱗片，看久了就會沉沉睡去。', ['control', { c: 5, d: 3, name: '睡眠' }], ['berserk', { p: 15 }], ['vsWeak', { p: 15 }]],
    ['warden', 'chainsword', '監獄長的鎖鍊', '奇岩監獄長的鎖鍊，鎖上的囚犯再也逃不掉。', ['curse', { c: 10, p: 10 }], ['block', { c: 6 }]],
    ['pharaoh', 'helm', '法老的黃金面具', '法老的影子留下的面具，面具下的眼睛仍在詛咒盜墓者。', ['curse', { c: 10, p: 10 }], ['summon', { name: '木乃伊', p: 30 }], ['weak', { e: 'fire', c: 20, p: 20 }]],
    ['bone', 'armor', '龍骨守衛的骨甲', '龍骨守衛的肋骨鎧甲，受擊時會震起一陣地鳴。', ['shield', { t: 15, p: 5 }], ['reflect', { c: 15, p: 30 }]],
    ['antguard', 'gloves', '近衛長的甲殼護手', '巨蟻近衛長的甲殼，兵蟻聽到它的聲音就會趕來。', ['summon', { name: '兵蟻', p: 30 }], ['physCut', { p: 5 }]],
    ['rat', 'dagger', '毒鼠王的鼠牙', '下水道毒鼠王的門牙，咬過的傷口永遠不會乾淨。', ['poison', { c: 15, p: 2, k: 5 }], ['hunt', { p: 12 }]],
    ['golem', 'ring', '魔導人偶的核心', '失控魔導人偶的動力核心，同時擋得住劍與魔法。', ['guard', { p: 3 }], ['magicDmg', { p: 8 }], ['vsWeak', { p: 15 }]],
    ['watcher', 'cloak', '監視者的暗影披風', '暗影監視者的披風，藏身其中，出手前沒人看得見。', ['ambush', { p: 100 }], ['blind', { c: 10, p: 20 }]],
    ['giantking', 'shield', '守陵王的墓碑盾', '巨人墓守陵王以墓碑改成的盾，亡魂還在碑後守著。', ['shield', { t: 15, p: 5 }], ['summon', { name: '巨人亡魂', p: 30 }]],
    ['crystal', 'amulet', '鋼心巨像的水晶心', '水晶洞鋼心巨像胸中的水晶，溫潤的光會慢慢治好傷口。', ['block', { c: 6 }], ['regen', { p: 1 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['ghoulking', 'claw', '食屍鬼王的腐爪', '格魯腐爛的爪子，撕開的傷口會爛下去，吃掉的生命會回來。', ['poison', { c: 15, p: 2, k: 3 }], ['killHp', { p: 2 }]],
    ['elder13', 'ear', '老長老的智慧耳環', '地監老長老歐巴的耳環，聽得見咒文，也擋得住咒文。', ['shield', { t: 15, p: 5 }], ['curse', { c: 10, p: 10 }]],
    ['pan', 'wand', '潘恩的污染笛', '污染的森林之主潘恩的笛子，笛聲讓藤蔓纏上敵人。', ['entangle', { c: 10, p: 15 }], ['regen', { p: 1 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['dudama', 'blunt2', '大族長的戰斧', '都達瑪拉大族長的戰斧，舉起來全族都會跟著衝。', ['summon', { name: '妖魔戰士', p: 30 }], ['perAlly', { p: 2 }]],
    ['crypt18', 'sword1', '屍骨將的骨刃', '奇岩墓穴屍骨將的骨刃，握著它的人倒下後還能再站起來。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }]],
    ['lykan', 'amulet', '萊卡的月牙項鍊', '狼人頭目萊卡的項鍊，月牙形的獠牙專咬殘血的獵物。', ['hunt', { p: 12 }], ['ambush', { p: 100 }]],
    ['kastel', 'belt', '掘地將軍的礦工腰帶', '卡司特掘地將軍的腰帶，一拍地面就震得到處都是土石。', ['pulse', { name: '地震', t: 8, p: 60 }], ['summon', { name: '卡司特', p: 30 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['shelob', 'ring', '毒蛛的毒腺', '沙下毒蛛夏洛的毒腺，毒液一沾上就動彈不得。', ['poison', { c: 15, p: 2, k: 3 }], ['entangle', { c: 10, p: 15 }]],
    ['ogre23', 'ring', '食人妖精隊長的鐵指環', '食人妖精隊長的鐵指環，打得越凶搶得越多。', ['berserk', { p: 15 }], ['gold', { p: 10 }]],
    ['ogre24', 'belt', '食人妖精祭司的骨鈴', '食人妖精祭司的骨鈴，鈴聲是詛咒也是祝福。', ['curse', { c: 10, p: 10 }], ['regen', { p: 1 }]],
    ['skelwar', 'sword2', '骷髏劍聖的古劍', '龍谷骷髏劍聖的古劍，擋下一劍就還一劍，倒下了也會再站起來。', ['block', { c: 6 }], ['blockNext', { p: 50 }], ['revive', { cd: 240, h: 20 }]],
    ['monia', 'gloves', '莫妮亞的毒絲手套', '織網的莫妮亞女王用毒絲織的手套。', ['entangle', { c: 10, p: 15 }], ['poison', { c: 15, p: 2, k: 3 }]],
    ['aruba', 'blunt2', '巨人首領的戰錘', '阿魯巴巨人首領的戰錘，砸下去整片地都在搖。', ['pulse', { name: '地震', t: 8, p: 60 }], ['berserk', { p: 15 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['scuba', 'cloak', '戰爭母后的翅膜', '思克巴戰爭母后的翅膜，振翅一次全軍都跟著衝。', ['summon', { name: '思克巴', p: 30 }], ['teamDmg', { p: 4 }]],
    ['scubaq', 'helm', '思克巴女帝的冠冕', '龍谷深處思克巴女帝的冠冕，護著女帝，也護著她的僕從。', ['shield', { t: 15, p: 5 }], ['allyDmg', { p: 10 }]],
    ['whiteant', 'belt', '工兵長的蟻酸瓶', '白蟻巢工兵長的蟻酸瓶，潑上去的盔甲會慢慢溶掉。', ['curse', { c: 10, p: 10, name: '酸蝕' }], ['summon', { name: '工兵蟻', p: 30 }]],
    ['naga', 'wand', '蛇女祭司的蛇杖', '地下水道蛇女祭司的蛇杖，咒文繞著杖身盤成一道盾。', ['curse', { c: 10, p: 10 }], ['shield', { t: 15, p: 5 }], ['weak', { e: 'water', c: 20, p: 20 }]],
    ['eyes', 'ear', '千眼的凝視之眼', '歐庫千隻眼睛裡的一隻，被它盯上的會變成石頭。', ['control', { c: 5, d: 3, name: '石化' }], ['invuln', { th: 30, d: 2, cd: 120 }], ['weak', { e: 'earth', c: 20, p: 20 }]],
    ['armor37', 'shield', '守門巨像的石臂甲', '象牙塔守門巨像的石臂，什麼都擋得下來。', ['shield', { t: 15, p: 5 }], ['block', { c: 6 }]],
    ['armor38', 'armor', '空殼騎士的鎧甲', '象牙塔空殼騎士的鎧甲，裡面空無一人，卻永遠不會倒。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }]],
    ['reaper', 'spear', '收魂者的鐮刀', '象牙塔收魂者的鐮刀，每收走一個魂就多一分力。', ['killMp', { p: 3 }], ['ambush', { p: 100 }]],
    ['wraith', 'amulet', '哀泣亡靈的淚滴', '象牙塔哀泣亡靈的眼淚，冰冷得連死亡都碰不到。', ['invuln', { th: 30, d: 2, cd: 120 }], ['poison', { c: 15, p: 2, k: 3 }]],
    ['ohm1', 'gloves', '歐姆統領的狂戰護腕', '狂暴的歐姆統領的護腕，越痛打得越狠。', ['berserk', { p: 15 }], ['shield', { t: 15, p: 5 }]],
    ['remnant', 'amulet', '薩恩的指揮官徽章', '殘兵指揮官薩恩的徽章，殘兵們還在等它的號令。', ['allyDmg', { p: 10 }], ['summon', { name: '殘兵', p: 30 }]],
    ['bast', 'wand', '守墓神官的權杖', '金字塔守墓神官的權杖，詛咒入侵者，也喚醒倒下的守墓人。', ['curse', { c: 10, p: 10 }], ['revive', { cd: 240, h: 20 }], ['weak', { e: 'fire', c: 20, p: 20 }]],
    ['elemlab', 'ring', '四元素核心碎片', '失控的四元素核心崩下的碎片，四種力量互相抵消。', ['res4', { n: 10 }], ['shield', { t: 15, p: 5 }], ['weakAura', { e: 'rand', t: 12, p: 20 }]],
    ['necro', 'spear', '教頭的雙刃戟', '冥法軍教頭的雙刃戟，攻守一體。', ['berserk', { p: 15 }], ['block', { c: 6 }]],
    ['jelly', 'belt', '果凍王的黏液', '火焰之影果凍王的黏液，傷口沾上就慢慢合起來。', ['regen', { p: 1 }], ['invuln', { th: 30, d: 2, cd: 120 }], ['absorb', { e: 'fire', p: 20 }]],
    ['wingdemon', 'boots', '翼魔教官的蝠翼靴', '修練地監翼魔教官的靴子，從高處撲下的第一擊最致命。', ['ambush', { p: 100 }], ['shield', { t: 15, p: 5 }], ['weak', { e: 'wind', c: 20, p: 20 }]],
    ['ogrechief', 'ear', '大首領的獸牙耳環', '邪惡的食人妖精大首領的耳環，戴上它小弟們都會來幫忙。', ['berserk', { p: 15 }], ['summon', { name: '食人妖精', p: 30 }]],
    ['desire', 'wand', '四元之主的元素球', '慾望洞穴四元之主的元素球，四種元素輪流守護持有者。', ['magicDmg', { p: 8 }], ['shield', { t: 15, p: 5 }], ['regen', { p: 1 }], ['weakAura', { e: 'rand', t: 12, p: 20 }], ['vsWeak', { p: 15 }]],
    ['lab', 'gloves', '試作兵器的機械臂', '魔族實驗室試作兵器的機械臂，壞了也會自己重新啟動。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }], ['vsWeak', { p: 15 }]]
  ];

  // ── 補齊遺物 150 件（Ping 11-19 15:48 定案；設計稿 claude/relic-fill-150-design.md）：[代號, 部位, 遺物名, 說明, 怪物名, 特效…] ──
  var LIST2 = [
    ["fill_m01", "ear", "仙人掌狗的尖刺耳飾", "仙人掌狗耳邊的一撮硬刺，碰到的人都會挨上一下。", "仙人掌狗", ["thorn", {"c": 20, "p": 5}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_m02", "gloves", "瘋狂仙人掌的刺手套", "瘋狂仙人掌的刺皮縫成的手套，越被打越想還手。", "瘋狂仙人掌", ["reflect", {"c": 15, "p": 30}], ["revenge", {"p": 50}]],
    ["fill_m03", "helm", "孢子人的菌帽", "孢子人頭上的菌傘，裡面塞滿了隨時會爆開的孢子。", "孢子人", ["poison", {"c": 15, "p": 2, "k": 3}], ["bomb", {"name": "孢子", "c": 10, "p": 40}]],
    ["fill_m04", "spear", "骷髏槍兵的骨矛", "骷髏槍兵一輩子只會往同一個地方刺，刺到穿為止。", "骷髏槍兵", ["focus", {"p": 3, "k": 5}]],
    ["fill_m05", "armor", "犰狳的捲殼甲", "犰狳捲起來的硬殼，重擊打上去只會滑開。", "犰狳", ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_m06", "belt", "白蟻的酸囊", "白蟻腹中的酸囊，潑上去連石頭都會鬆動。", "巨大白螞蟻", ["curse", {"c": 10, "p": 10, "name": "酸蝕"}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_m07", "shield", "甲蟲的硬殼盾", "甲蟲的背殼，擋得住劍，更擋得住重錘。", "甲蟲", ["block", {"c": 6}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_m08", "boots", "鷹獅的翼爪靴", "鷹獅俯衝時的爪子，第一擊總是從風裡來。", "鷹獅", ["ambush", {"p": 100}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_m09", "ring", "毒蟲的毒囊", "毒蟲的毒囊，越虛弱的獵物越經不起。", "毒蟲", ["poison", {"c": 15, "p": 2, "k": 3}], ["vsMarked", {"p": 15}]],
    ["fill_m10", "cloak", "翼蜘蛛的絲翼", "翼蜘蛛振翅時灑下的絲，一閃身就不見了。", "翼蜘蛛", ["web", {"c": 15, "p": 15}], ["phase", {"c": 5}]],
    ["fill_m11", "shin", "沙漠蜥蜴的鱗片護腿", "沙漠蜥蜴的鱗片，被沙暴打過反而更結實。", "沙漠蜥蜴", ["absorb", {"e": "earth", "p": 20}], ["guard", {"p": 3}]],
    ["fill_m12", "sword1", "盜賊團的彎刀", "盜賊團戰士的彎刀，砍倒一個就想再搶下一個。", "盜賊團戰士", ["gold", {"p": 10}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_m13", "bow", "盜賊團的短弓", "盜賊團弓手的短弓，連射到第五箭時手最穩。", "盜賊團弓手", ["ranged", {"p": 8}], ["echo", {"p": 100}]],
    ["fill_m14", "wand", "盜賊團的咒杖", "盜賊團魔法師的咒杖，咒文裡帶著燒灼的味道。", "盜賊團魔法師", ["mpSteal", {"c": 15, "n": 5}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m15", "amulet", "惡靈的冥火", "船舶之墓的冥火，飄忽得連刀都砍不中。", "惡靈", ["killMp", {"p": 3}], ["phase", {"c": 5}]],
    ["fill_m16", "claw", "實驗體的腐爪", "實驗體吞下的獵物，連最後一口力氣都不浪費。", "惡魔實驗體(食腐獸)", ["killHp", {"p": 2}], ["overkill", {"p": 50}]],
    ["fill_m17", "ear", "實驗體的火核耳環", "實驗體體內的火核，靠著火焰活下去。", "惡魔實驗體(深淵火靈)", ["absorb", {"e": "fire", "p": 20}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m18", "dagger", "藍舌的舌刺", "藍舌的舌刺，舔一次就停不下來。", "藍舌", ["lifesteal", {"p": 2}], ["focus", {"p": 3, "k": 5}]],
    ["fill_m19", "dual", "沙鰭的雙鰭刃", "沙鰭在沙中游動的兩片鰭，一來一回都是刀。", "沙鰭", ["double", {"c": 10}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_m20", "katana", "劍齒虎的劍齒刀", "劍齒虎的長牙磨成的刀，等最好的那一刻才出手。", "劍齒虎", ["iai", {"t": 6, "p": 250}], ["execute", {"c": 5, "p": 10}]],
    ["fill_m21", "belt", "食腐獸的胃袋", "食腐獸的胃袋，越吃越有力氣。", "食腐獸", ["killHp", {"p": 2}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_m22", "ring", "特提斯的觸鬚環", "特提斯的觸鬚，纏住的獵物會被拖進深水。", "特提斯", ["entangle", {"c": 10, "p": 15}], ["weak", {"e": "water", "c": 20, "p": 20}]],
    ["fill_m23", "amulet", "閃電球的雷核", "閃電球的雷核，電光會從一個人跳到另一個人身上。", "閃電球", ["chain", {"c": 15, "p": 50}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_m24", "spear", "混沌司祭的長戟", "混沌司祭的長戟，詛咒一層一層刻進同一道傷口。", "混沌的司祭(槍兵)", ["curse", {"c": 10, "p": 10}], ["focus", {"p": 3, "k": 5}]],
    ["fill_m25", "sword2", "混沌騎兵的大劍", "混沌騎兵的大劍，砍穿一個還不夠。", "混沌的司祭(騎兵)", ["melee", {"p": 8}], ["overkill", {"p": 50}]],
    ["fill_m26", "gloves", "混沌野獸的爪套", "混沌野獸的爪套，挨的每一下都會記住。", "混沌的司祭(野獸)", ["berserk", {"p": 15}], ["revenge", {"p": 50}]],
    ["fill_m27", "cloak", "翼魔的蝠翼", "翼魔的蝠翼，收起來就沒人看得見。", "翼魔", ["stealth", {"t": 15, "p": 150}], ["phase", {"c": 5}]],
    ["fill_m28", "helm", "阿努斯的胡狼頭盔", "胡狼神阿努斯的頭盔，看得見每個獵物剩下的壽命。", "底比斯 阿努斯", ["hunt", {"p": 12}], ["execute", {"c": 5, "p": 10}]],
    ["fill_m29", "dagger", "黑阿努斯的冥刃", "黑阿努斯的冥刃，留下的印記五秒後才會發作。", "底比斯 阿努斯(黑)", ["vsMarked", {"p": 15}], ["bomb", {"name": "冥印", "c": 10, "p": 40}]],
    ["fill_m30", "ear", "巴斯的貓眼耳環", "巴斯的貓眼，盯住的獵物看不清方向。", "底比斯 巴斯", ["blind", {"c": 10, "p": 20}], ["phase", {"c": 5}]],
    ["fill_m31", "wand", "紅巴斯的日輪杖", "紅巴斯的日輪杖，日光底下萬物都怕火。", "底比斯 巴斯(紅)", ["magicDmg", {"p": 8}], ["weakAura", {"e": "fire", "t": 12, "p": 20}]],
    ["fill_m32", "shield", "近衛隊長的紋章盾", "近衛隊長的紋章盾，扛住了，全隊就能往前衝。", "拉斯塔巴德近衛隊隊長", ["blockNext", {"p": 50}], ["bigHitCut", {"th": 20, "p": 25}], ["teamDmg", {"p": 4}]],
    ["fill_m33", "boots", "翼龍的皮靴", "翼龍的皮靴，踩過的風都變得鋒利。", "翼龍", ["atk", {"p": 6}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_m34", "ring", "小眼魔的眼珠", "小眼魔的眼珠，被看上一眼腳就動不了。", "小幻象眼魔", ["control", {"c": 5, "d": 3, "name": "石化"}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_m35", "armor", "殭屍王的腐甲", "殭屍王的腐甲，被打得越慘，還手越狠。", "恐怖的殭屍王", ["regen", {"p": 1}], ["revenge", {"p": 50}]],
    ["fill_m36", "belt", "艾莉絲的蛇鱗腰帶", "艾莉絲的蛇鱗，毒與石化從來不分家。", "艾莉絲", ["poison", {"c": 15, "p": 2, "k": 3}], ["control", {"c": 5, "d": 3, "name": "石化"}]],
    ["fill_m37", "amulet", "木乃伊王的聖甲蟲", "木乃伊王陪葬的聖甲蟲，詛咒入侵者燒成灰。", "木乃伊王", ["curse", {"c": 10, "p": 10}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m38", "cloak", "吸血鬼的血色斗篷", "吸血鬼的斗篷，吸來的血會在身上凝成一層殼。", "馬昆斯吸血鬼", ["lifesteal", {"p": 2}], ["dmgShield", {"p": 3}]],
    ["fill_m39", "shin", "土精靈王的岩護腿", "土精靈王的岩護腿，大地的力量傷不了它的主人。", "土精靈王", ["absorb", {"e": "earth", "p": 20}], ["weakAura", {"e": "earth", "t": 12, "p": 20}]],
    ["fill_m40", "ring", "水精靈王的水滴戒", "水精靈王的水滴，潮水會替它的主人療傷。", "水精靈王", ["absorb", {"e": "water", "p": 20}], ["weakAura", {"e": "water", "t": 12, "p": 20}]],
    ["fill_m41", "boots", "風精靈王的疾風靴", "風精靈王的疾風靴，穿著它就站在風的這一邊。", "風精靈王", ["absorb", {"e": "wind", "p": 20}], ["weakAura", {"e": "wind", "t": 12, "p": 20}]],
    ["fill_m42", "wand", "火精靈王的焰杖", "火精靈王的焰杖，火焰只會燒向敵人。", "火精靈王", ["absorb", {"e": "fire", "p": 20}], ["weakAura", {"e": "fire", "t": 12, "p": 20}]],
    ["fill_m43", "sword2", "范德的騎士劍", "騎士范德的騎士劍，盯上的對手絕不放過。", "騎士范德", ["block", {"c": 6}], ["focus", {"p": 3, "k": 5}]],
    ["fill_m44", "amulet", "深淵水靈的潮珠", "深淵水靈凝成的潮珠，冰冷得能凍穿任何防禦。", "深淵水靈", ["res", {"k": "resWater", "n": 20}], ["weak", {"e": "water", "c": 20, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_m45", "ear", "深淵風靈的風環", "深淵風靈纏成的風環，風聲裡藏著弱點的位置。", "深淵風靈", ["res", {"k": "resWind", "n": 20}], ["weak", {"e": "wind", "c": 20, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_m46", "belt", "深淵火靈的焰環", "深淵火靈燒成的焰環，被它照到的都會怕火。", "深淵火靈", ["res", {"k": "resFire", "n": 20}], ["weak", {"e": "fire", "c": 20, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_m47", "wand", "巴風特司祭的骨杖", "巴風特司祭的骨杖，詛咒會順著屍體一路傳下去。", "死亡的司祭(巴風特)", ["curse", {"c": 10, "p": 10}], ["chain", {"c": 15, "p": 50}]],
    ["fill_m48", "blunt2", "巴列斯司祭的戰鎚", "巴列斯司祭的戰鎚，砸碎一個，餘勁還能再砸一個。", "死亡的司祭(巴列斯)", ["berserk", {"p": 15}], ["overkill", {"p": 50}]],
    ["fill_m49", "helm", "惡魔司祭的角冠", "惡魔司祭的角冠，戴上它，咒文都帶著硫磺味。", "死亡的司祭(惡魔)", ["magicDmg", {"p": 8}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m50", "ear", "小惡魔的火叉耳環", "小惡魔的火叉，第一下總是從背後來。", "火焰之影親衛兵(小惡魔)", ["ambush", {"p": 100}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m51", "gloves", "巴列斯親衛的鐵拳套", "巴列斯親衛的鐵拳，挨了打就要加倍打回去。", "火焰之影親衛兵(巴列斯)", ["melee", {"p": 8}], ["revenge", {"p": 50}]],
    ["fill_m52", "shield", "巴風特親衛的山羊盾", "巴風特親衛的山羊盾，撞上來的都會被彈回去。", "火焰之影親衛兵(巴風特)", ["block", {"c": 6}], ["reflect", {"c": 15, "p": 30}]],
    ["fill_m53", "cloak", "思克巴親衛的翅膜", "思克巴親衛的翅膜，輕輕一閃就讓開了攻擊。", "火焰之影親衛兵(思克巴)", ["allyDmg", {"p": 10}], ["phase", {"c": 5}]],
    ["fill_m54", "armor", "惡魔親衛的焦甲", "惡魔親衛的焦甲，在火裡泡過，再大的火也只是溫暖。", "火焰之影親衛兵(惡魔)", ["absorb", {"e": "fire", "p": 20}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_m55", "spear", "親衛槍兵的焰矛", "親衛槍兵的焰矛，刺進去的地方會一直燒。", "火焰之影親衛兵(槍兵)", ["hunt", {"p": 12}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m56", "boots", "親衛騎兵的馬靴", "親衛騎兵的馬靴，一路踏過去，越踏越快。", "火焰之影親衛兵(騎兵)", ["atk", {"p": 6}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_m57", "helm", "親衛隊長的山羊盔", "親衛隊長的山羊盔，隊長不倒，隊伍就不散。", "火焰之影親衛隊(巴風特)", ["teamDmg", {"p": 4}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_m58", "ring", "炎魔分身的火影戒", "炎魔分身的火影，你的每五次攻擊裡，總有一次是它替你出手。", "炎魔的分身", ["echo", {"p": 100}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m59", "claw", "炎魔惡魔的焦爪", "炎魔惡魔的焦爪，爪子劃過的地方會冒出火焰。", "炎魔的惡魔", ["pulse", {"name": "火焰", "t": 8, "p": 60}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_m60", "ear", "咆哮翼魔的聲囊", "咆哮翼魔的聲囊，吼聲會震得一整排敵人發暈。", "實驗變異怪(咆哮翼魔)", ["control", {"c": 5, "d": 3, "name": "暈眩"}], ["chain", {"c": 15, "p": 50}]],
    ["fill_m61", "shield", "水晶惡魔的晶盾", "水晶惡魔的晶盾，連魔法都會被它照回去。", "實驗變異怪(水晶惡魔)", ["reflect", {"c": 15, "p": 30}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_m62", "ring", "潔尼斯的女王戒", "潔尼斯女王的戒指，咒文到了它面前會原路折返。", "潔尼斯女王", ["magicDmg", {"p": 8}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_m63", "amulet", "幻象眼魔的幻眼", "幻象眼魔的幻眼，看見的永遠不是真的。", "幻象眼魔", ["blind", {"c": 10, "p": 20}], ["phase", {"c": 5}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_m64", "dagger", "吸血鬼的獠牙", "吸血鬼的獠牙，吸來的血一半留著當鎧甲。", "吸血鬼", ["lifesteal", {"p": 2}], ["dmgShield", {"p": 3}]],
    ["fill_m65", "gloves", "殭屍王的腐手", "殭屍王的腐手，每一下痛楚都化成力氣。", "殭屍王", ["killHp", {"p": 2}], ["revenge", {"p": 50}]],
    ["fill_m66", "boots", "黑豹的軟墊靴", "黑豹的軟墊靴，悄無聲息地咬住就不鬆口。", "黑豹", ["ambush", {"p": 100}], ["focus", {"p": 3, "k": 5}]],
    ["fill_m67", "belt", "支配木乃伊王的裹屍布", "支配者木乃伊王的裹屍布，詛咒會在獵物身上慢慢發酵。", "木乃伊王(支配)", ["curse", {"c": 10, "p": 10}], ["bomb", {"name": "詛咒", "c": 10, "p": 40}]],
    ["fill_m68", "ear", "支配艾莉絲的蛇眼", "支配者艾莉絲的蛇眼，被看住的獵物連逃都忘了。", "艾莉絲(支配)", ["control", {"c": 5, "d": 3, "name": "石化"}], ["vsMarked", {"p": 15}]],
    ["fill_m69", "sword1", "支配范德的斷罪劍", "支配者范德的斷罪劍，殘存的敵人一劍了斷。", "騎士范德(支配)", ["block", {"c": 6}], ["execute", {"c": 5, "p": 10}]],
    ["fill_m70", "wand", "巫妖的冥杖", "巫妖的冥杖，冥火會從天上找到每一個敵人。", "巫妖", ["killMp", {"p": 3}], ["starfall", {"name": "冥火", "t": 10, "p": 80}]],
    ["fill_m71", "blunt2", "烏格奴斯的巨鎚", "烏格奴斯的巨鎚，砸下去連大地都裂出弱點。", "烏格奴斯", ["pulse", {"name": "地震", "t": 8, "p": 60}], ["weakAura", {"e": "earth", "t": 12, "p": 20}]],
    ["fill_b01", "sword1", "哈蒙將軍的怨劍", "哈蒙將軍不肯安息的怨念，倒下了也要站起來報仇。", "哈蒙將軍的怨靈", ["revive", {"cd": 240, "h": 20}], ["block", {"c": 6}], ["revenge", {"p": 50}]],
    ["fill_b02", "gloves", "沙人的砂礫拳套", "沙人的砂礫拳套，揮出去就是一陣沙暴。", "沙人", ["blind", {"c": 10, "p": 20}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_b03", "shield", "岩石野獸的岩盾", "岩石野獸的岩盾，越重的攻擊越打不穿。", "岩石野獸", ["block", {"c": 6}], ["reflect", {"c": 15, "p": 30}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_b04", "blunt2", "岩石戰士的石鎚", "岩石戰士的石鎚，每一下都讓大地鬆動。", "岩石戰士", ["pulse", {"name": "地震", "t": 8, "p": 60}], ["weakAura", {"e": "earth", "t": 12, "p": 20}]],
    ["fill_b05", "armor", "墳墓守護者的石棺甲", "墳墓守護者的石棺，裡面的人怎樣都不會死去。", "墳墓守護者", ["physCut", {"p": 5}], ["lastStand", {"cd": 180, "p": 20}]],
    ["fill_b06", "shield", "巨大守護者的墓門盾", "巨大守護者的墓門，擋下的攻擊都會記在帳上。", "巨大墳墓守護者", ["block", {"c": 6}], ["shield", {"t": 15, "p": 5}], ["revenge", {"p": 50}]],
    ["fill_b07", "spear", "巴列斯的獄炎戟", "巴列斯的獄炎戟，燒穿一個還會燒向下一個。", "炎魔的巴列斯", ["berserk", {"p": 15}], ["weak", {"e": "fire", "c": 20, "p": 20}], ["overkill", {"p": 50}]],
    ["fill_b08", "cloak", "墮落的黑翼", "墮落天使的黑翼，詛咒與鮮血是它的供品。", "墮落", ["curse", {"c": 10, "p": 10}], ["lifesteal", {"p": 2}], ["phase", {"c": 5}]],
    ["fill_b09", "wand", "扭曲女王的權杖", "扭曲女王的權杖，所有咒文都會繞回施法的人身上。", "扭曲的潔尼斯女王", ["magicDmg", {"p": 8}], ["curse", {"c": 10, "p": 10}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_b10", "ear", "不幸眼魔的邪眼", "不幸眼魔的邪眼，被看上的人只剩石頭與黑暗。", "不幸的幻象眼魔", ["control", {"c": 5, "d": 3, "name": "石化"}], ["blind", {"c": 10, "p": 20}]],
    ["fill_b11", "cloak", "恐怖吸血鬼的夜之斗篷", "恐怖吸血鬼的夜之斗篷，夜裡出手，血化成盾。", "恐怖的吸血鬼", ["lifesteal", {"p": 2}], ["stealth", {"t": 15, "p": 150}], ["dmgShield", {"p": 3}]],
    ["fill_b12", "ring", "狄高的水之心", "水之領域狄高的心臟，潮水在它四周永不止息。", "狄高", ["absorb", {"e": "water", "p": 20}], ["weakAura", {"e": "water", "t": 12, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_b13", "amulet", "安加斯的火之心", "火之領域安加斯的心臟，靠近的一切都會燒起來。", "安加斯", ["absorb", {"e": "fire", "p": 20}], ["weakAura", {"e": "fire", "t": 12, "p": 20}], ["pulse", {"name": "火焰", "t": 8, "p": 60}]],
    ["fill_b14", "boots", "巴薩斯的風之心", "風之領域巴薩斯的心臟，風會替它的主人多揮一刀。", "巴薩斯", ["absorb", {"e": "wind", "p": 20}], ["weakAura", {"e": "wind", "t": 12, "p": 20}], ["double", {"c": 10}]],
    ["fill_b15", "dual", "史雷佛的暗殺雙刃", "暗殺軍王的雙刃，隱身、出手、了結，一氣呵成。", "暗殺軍王史雷佛", ["stealth", {"t": 15, "p": 150}], ["execute", {"c": 5, "p": 10}], ["hunt", {"p": 12}]],
    ["fill_b16", "gloves", "死亡殭屍王的屍爪", "死亡殭屍王的屍爪，死過一次的人不怕再死。", "死亡的殭屍王", ["killHp", {"p": 2}], ["revive", {"cd": 240, "h": 20}]],
    ["fill_b17", "sword2", "火焰之影的魔劍", "火焰之影的魔劍，劍上的暗焰會在敵陣裡爆開。", "火焰之影", ["pulse", {"name": "暗焰", "t": 8, "p": 60}], ["berserk", {"p": 15}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_b18", "claw", "巴蘭卡的獸王爪", "巴蘭卡的獸王爪，魔獸聞到血腥就會趕來。", "魔獸軍王巴蘭卡", ["summon", {"name": "魔獸", "p": 30}], ["focus", {"p": 3, "k": 5}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_b19", "wand", "蕾雅的法令權杖", "蕾雅的法令權杖，違抗法令的咒文會被原封退回。", "法令軍王蕾雅", ["curse", {"c": 10, "p": 10}], ["shield", {"t": 15, "p": 5}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_b20", "boots", "地獄黑豹的影步靴", "地獄黑豹的影步靴，影子總比本體快一步出手。", "地獄的黑豹", ["ambush", {"p": 100}], ["echo", {"p": 100}]],
    ["fill_b21", "ring", "賽尼斯的魔女戒", "魔女賽尼斯的戒指，咒文會在敵人之間跳來跳去。", "賽尼斯(首領)", ["magicDmg", {"p": 8}], ["mpSteal", {"c": 15, "n": 5}], ["chain", {"c": 15, "p": 50}]],
    ["fill_b22", "sword2", "肯恩的反逆大劍", "反王肯恩的大劍，越是被逼到絕境越是兇狠。", "反王肯恩", ["melee", {"p": 8}], ["lastStand", {"cd": 180, "p": 20}], ["revenge", {"p": 50}]],
    ["fill_b23", "belt", "不死木乃伊王的黃金腰帶", "不死木乃伊王的黃金腰帶，詛咒永遠不會消失。", "不死的木乃伊王", ["curse", {"c": 10, "p": 10}], ["revive", {"cd": 240, "h": 20}], ["bomb", {"name": "詛咒", "c": 10, "p": 40}]],
    ["fill_b24", "ear", "冷酷艾莉絲的蛇髮", "冷酷艾莉絲的蛇髮，毒牙與石化之眼一起發作。", "冷酷的艾莉絲", ["poison", {"c": 15, "p": 2, "k": 3}], ["control", {"c": 5, "d": 3, "name": "石化"}], ["vsMarked", {"p": 15}]],
    ["fill_b25", "amulet", "深淵之主的元素珠", "深淵之主的元素珠，四種元素輪流撕開敵人的防禦。", "深淵之主", ["res4", {"n": 10}], ["weakAura", {"e": "rand", "t": 12, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_b26", "armor", "大地魔像的岩甲", "大地魔像的岩甲，大地的攻擊只會讓它更硬。", "佩特拉大地魔像", ["physCut", {"p": 5}], ["thorn", {"c": 20, "p": 5}], ["absorb", {"e": "earth", "p": 20}]],
    ["fill_b27", "gloves", "佩特拉魔像的岩拳", "佩特拉魔像的岩拳，攻守都硬得像石頭。", "佩特拉魔像", ["melee", {"p": 8}], ["block", {"c": 6}]],
    ["fill_b28", "shield", "佩特拉守護者的古盾", "佩特拉守護者的古盾，守了廢墟千年從未被打穿。", "佩特拉守護者", ["block", {"c": 6}], ["guard", {"p": 3}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_b29", "cloak", "不死鳥的羽衣", "不死鳥的羽衣，燃盡之後還會從灰裡飛起來。", "不死鳥", ["revive", {"cd": 240, "h": 20}], ["absorb", {"e": "fire", "p": 20}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_b30", "blunt2", "古代巨人的巨木棒", "古代巨人的巨木棒，砸倒一個，地震還會傳到下一個。", "古代巨人", ["pulse", {"name": "地震", "t": 8, "p": 60}], ["berserk", {"p": 15}], ["overkill", {"p": 50}]],
    ["fill_b31", "ring", "冰魔的冰核", "冰魔的冰核，寒氣會鑽進敵人的骨頭裡。", "冰魔", ["absorb", {"e": "water", "p": 20}], ["control", {"c": 5, "d": 3, "name": "冰凍"}], ["weak", {"e": "water", "c": 20, "p": 20}]],
    ["fill_b32", "helm", "阿努比斯的胡狼冠", "阿努比斯的胡狼冠，秤過靈魂的重量，再取走它。", "底比斯 阿努比斯", ["hunt", {"p": 12}], ["execute", {"c": 5, "p": 10}], ["killMp", {"p": 3}]],
    ["fill_b33", "bow", "賀洛斯的鷹眼弓", "賀洛斯的鷹眼，從高空就看得見獵物的破綻。", "底比斯 賀洛斯", ["ranged", {"p": 8}], ["ambush", {"p": 100}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_b34", "wand", "海露拜的冥法杖", "冥法軍王的權杖，冥火從天而降，骷髏從地而起。", "冥法軍王海露拜", ["curse", {"c": 10, "p": 10}], ["summon", {"name": "骷髏", "p": 30}], ["starfall", {"name": "冥火", "t": 10, "p": 80}]],
    ["fill_b35", "helm", "混沌的面甲", "混沌的面甲，戴上它的人周圍什麼都會亂掉。", "混沌", ["curse", {"c": 10, "p": 10}], ["guard", {"p": 3}], ["weakAura", {"e": "rand", "t": 12, "p": 20}]],
    ["fill_b36", "spear", "死亡的鐮槍", "死亡的鐮槍，揮過的地方不會留下活口。", "死亡", ["hunt", {"p": 12}], ["execute", {"c": 5, "p": 10}], ["killHp", {"p": 2}]],
    ["fill_b37", "dagger", "史勒夫的毒針", "史勒夫的毒針，刺下去的毒五秒後才真正發作。", "可疑的魔族史勒夫", ["poison", {"c": 15, "p": 2, "k": 3}], ["stealth", {"t": 15, "p": 150}], ["bomb", {"name": "毒", "c": 10, "p": 40}]],
    ["fill_b38", "armor", "變異實驗體的再生肉甲", "變異實驗體的再生肉甲，傷口長回來時會帶著怒氣。", "變異實驗體", ["regen", {"p": 1}], ["shield", {"t": 15, "p": 5}], ["revenge", {"p": 50}]],
    ["fill_b39", "belt", "須曼的湖底鱗帶", "地底湖須曼的鱗帶，湖水會纏住每一個敵人。", "須曼", ["absorb", {"e": "water", "p": 20}], ["entangle", {"c": 10, "p": 15}], ["weak", {"e": "water", "c": 20, "p": 20}]],
    ["fill_b40", "wand", "冰之女王的冰晶杖", "冰之女王的冰晶杖，整片戰場都會被冰封。", "冰之女王", ["control", {"c": 5, "d": 3, "name": "冰凍"}], ["magicDmg", {"p": 8}], ["weakAura", {"e": "water", "t": 12, "p": 20}], ["shield", {"t": 15, "p": 5}]],
    ["fill_b41", "ear", "玉藻的九尾耳飾", "玉藻九條尾巴上的狐火，真身從來不在你看見的地方。", "白面金毛九尾狐・玉藻", ["summon", {"name": "狐火", "p": 30}], ["blind", {"c": 10, "p": 20}], ["starfall", {"name": "狐火", "t": 10, "p": 80}], ["phase", {"c": 5}]],
    ["fill_b42", "sword2", "闇黑范德的黑騎士劍", "闇黑范德的黑騎士劍，擋下一劍就還一劍，一劍比一劍重。", "闇黑的騎士范德", ["block", {"c": 6}], ["blockNext", {"p": 50}], ["focus", {"p": 3, "k": 5}]],
    ["fill_b43", "ring", "史塔伯洛的厄運戒", "史塔伯洛的厄運戒，把霉運種在敵人身上。", "不幸的史塔伯洛", ["curse", {"c": 10, "p": 10}], ["gold", {"p": 10}], ["bomb", {"name": "厄運", "c": 10, "p": 40}]],
    ["fill_b44", "amulet", "歪曲女王的項鍊", "歪曲女王的項鍊，魔法在它面前會扭曲回去。", "歪曲的潔尼斯女王", ["magicDmg", {"p": 8}], ["shield", {"t": 15, "p": 5}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_b45", "helm", "支配眼魔的眼冠", "支配者眼魔的眼冠，能看穿大地的弱點。", "不幸的幻象眼魔(支配)", ["control", {"c": 5, "d": 3, "name": "石化"}], ["guard", {"p": 3}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_b46", "ring", "支配吸血鬼的血戒", "支配者吸血鬼的血戒，血喝得越多，盾就越厚。", "恐怖的吸血鬼(支配)", ["lifesteal", {"p": 2}], ["berserk", {"p": 15}], ["dmgShield", {"p": 3}]],
    ["fill_b47", "amulet", "琪娜的長老聖印", "長老琪娜的聖印，護著持有者，也點燃敵人。", "長老．琪娜", ["regen", {"p": 1}], ["shield", {"t": 15, "p": 5}], ["weak", {"e": "fire", "c": 20, "p": 20}]],
    ["fill_b48", "wand", "艾迪爾的長老杖", "長老艾迪爾的法杖，偷來的魔力化成寒流。", "長老．艾迪爾", ["magicDmg", {"p": 8}], ["mpSteal", {"c": 15, "n": 5}], ["weak", {"e": "water", "c": 20, "p": 20}]],
    ["fill_b49", "ear", "巴塔斯的長老耳環", "長老巴塔斯的耳環，聽得見咒文，也聽得見風。", "長老．巴塔斯", ["guard", {"p": 3}], ["magicCut", {"p": 5}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_b50", "ring", "巴洛斯的長老戒", "長老巴洛斯的戒指，詛咒會從腳下的土裡長出來。", "長老．巴洛斯", ["curse", {"c": 10, "p": 10}], ["killMp", {"p": 3}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_b51", "belt", "泰瑪斯的長老腰帶", "長老泰瑪斯的腰帶，危急時會張開一道光。", "長老．泰瑪斯", ["regen", {"p": 1}], ["invuln", {"th": 30, "d": 2, "cd": 120}]],
    ["fill_b52", "boots", "安迪斯的長老靴", "長老安迪斯的靴子，快得讓人以為有兩個他。", "長老．安迪斯", ["double", {"c": 10}], ["ambush", {"p": 100}], ["echo", {"p": 100}]],
    ["fill_b53", "cloak", "拉曼斯的長老斗篷", "長老拉曼斯的斗篷，咒文打上去只會被彈開。", "長老．拉曼斯", ["magicCut", {"p": 5}], ["mirror", {"c": 10, "p": 50}]],
    ["fill_b54", "helm", "巴陸德的長老冠", "長老巴陸德的冠冕，讓整支隊伍看得見敵人的弱點。", "長老．巴陸德", ["teamDmg", {"p": 4}], ["lowHpTeam", {"p": 3}], ["vsWeak", {"p": 15}]],
    ["fill_b55", "amulet", "不滅巫妖的命匣", "不滅巫妖的命匣，只要命匣還在，巫妖就不會真的死去。", "不滅的巫妖", ["revive", {"cd": 240, "h": 20}], ["killMp", {"p": 3}], ["starfall", {"name": "冥火", "t": 10, "p": 80}]],
    ["fill_b56", "spear", "鐮刀死神的大鐮", "鐮刀死神的大鐮，一揮就收走殘存的生命。", "邪惡的鐮刀死神", ["hunt", {"p": 12}], ["execute", {"c": 5, "p": 10}], ["overkill", {"p": 50}]],
    ["fill_b57", "chainsword", "炎魔的獄火鞭", "炎魔的獄火鞭，抽到哪裡，哪裡就是地獄。", "炎魔", ["pulse", {"name": "獄火", "t": 8, "p": 60}], ["berserk", {"p": 15}], ["absorb", {"e": "fire", "p": 20}], ["weakAura", {"e": "fire", "t": 12, "p": 20}]],
    ["fill_b58", "armor", "支配殭屍王的屍甲", "支配者殭屍王的屍甲，死不了，也忘不了痛。", "死亡的殭屍王(支配)", ["physCut", {"p": 5}], ["revive", {"cd": 240, "h": 20}], ["revenge", {"p": 50}]],
    ["fill_b59", "claw", "支配黑豹的影爪", "支配者黑豹的影爪，影子會在第五下替你補上一擊。", "地獄的黑豹(支配)", ["ambush", {"p": 100}], ["hunt", {"p": 12}], ["echo", {"p": 100}]],
    ["fill_b60", "helm", "支配木乃伊王的黃金面具", "支配者木乃伊王的黃金面具，詛咒比主人活得更久。", "不死的木乃伊王(支配)", ["curse", {"c": 10, "p": 10}], ["lastStand", {"cd": 180, "p": 20}], ["bomb", {"name": "詛咒", "c": 10, "p": 40}]],
    ["fill_b61", "dagger", "殘忍艾莉絲的蛇牙", "殘忍艾莉絲的蛇牙，咬住就不會鬆口。", "殘忍的艾莉絲", ["poison", {"c": 15, "p": 2, "k": 3}], ["vsMarked", {"p": 15}], ["focus", {"p": 3, "k": 5}]],
    ["fill_b62", "shield", "黑暗范德的黑騎士盾", "黑暗范德的黑騎士盾，重擊打上去就被原樣送回去。", "黑暗的騎士范德", ["block", {"c": 6}], ["reflect", {"c": 15, "p": 30}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_b63", "boots", "風龍守護者的風靴", "風龍守護者的風靴，乘風而行，風就不會傷它。", "風龍的守護者", ["absorb", {"e": "wind", "p": 20}], ["atk", {"p": 6}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_b64", "ear", "支配巫妖的魂火", "支配者巫妖的魂火，連鎖的冥火會燒遍敵陣。", "不滅的巫妖(支配)", ["magicDmg", {"p": 8}], ["invuln", {"th": 30, "d": 2, "cd": 120}], ["chain", {"c": 15, "p": 50}]],
    ["fill_b65", "gloves", "奧馬爾的傲慢之拳", "奧馬爾的傲慢之拳，挨的每一拳都會連本帶利還回去。", "傲慢的奧馬爾", ["melee", {"p": 8}], ["berserk", {"p": 15}], ["block", {"c": 6}], ["revenge", {"p": 50}]],
    ["fill_b66", "sword2", "烏格奴斯的傲慢大劍", "烏格奴斯的傲慢大劍，倒下一個，力道就壓向下一個。", "傲慢的烏格奴斯", ["pulse", {"name": "重擊", "t": 8, "p": 60}], ["lastStand", {"cd": 180, "p": 20}], ["guard", {"p": 3}], ["overkill", {"p": 50}]],
    ["fill_b67", "shin", "風泥龍的鱗脛甲", "風泥龍的鱗片，在風裡反而更堅韌。", "泥龍(風)", ["absorb", {"e": "wind", "p": 20}], ["physCut", {"p": 5}]],
    ["fill_b68", "belt", "地泥龍的泥鱗帶", "地泥龍的泥鱗，大地會慢慢把它的傷口填平。", "泥龍(地)", ["absorb", {"e": "earth", "p": 20}], ["regen", {"p": 1}]],
    ["fill_b69", "bow", "風荒龍的翼骨弓", "風荒龍的翼骨弓，射出去的箭帶著龍息。", "荒龍(風)", ["ranged", {"p": 8}], ["pulse", {"name": "龍息", "t": 8, "p": 60}], ["weak", {"e": "wind", "c": 20, "p": 20}]],
    ["fill_b70", "shield", "地荒龍的鱗盾", "地荒龍的鱗盾，連大地本身都撞不開。", "荒龍(地)", ["block", {"c": 6}], ["absorb", {"e": "earth", "p": 20}], ["weak", {"e": "earth", "c": 20, "p": 20}]],
    ["fill_b71", "dual", "支配死神的雙鐮", "支配者死神的雙鐮，一左一右，收割得更快。", "邪惡的鐮刀死神(支配)", ["hunt", {"p": 12}], ["double", {"c": 10}], ["execute", {"c": 5, "p": 10}]],
    ["fill_b72", "armor", "恐怖安塔瑞斯的龍鱗甲", "恐怖安塔瑞斯的龍鱗，被它擋下的攻擊都會付出代價。", "恐怖的安塔瑞斯", ["physCut", {"p": 5}], ["absorb", {"e": "earth", "p": 20}], ["thorn", {"c": 20, "p": 5}], ["bigHitCut", {"th": 20, "p": 25}]],
    ["fill_b73", "blunt2", "安塔瑞斯的地龍牙鎚", "地龍安塔瑞斯的獠牙，每一次落地都讓大地崩裂。", "安塔瑞斯", ["pulse", {"name": "地震", "t": 8, "p": 60}], ["berserk", {"p": 15}], ["weakAura", {"e": "earth", "t": 12, "p": 20}], ["overkill", {"p": 50}]],
    ["fill_b74", "wand", "法利昂的水龍珠杖", "水龍法利昂的龍珠，潮水會淹沒整片戰場。", "法利昂", ["splash", {"c": 15, "p": 40}], ["magicDmg", {"p": 8}], ["weakAura", {"e": "water", "t": 12, "p": 20}], ["vsWeak", {"p": 15}]],
    ["fill_b75", "sword2", "巴拉卡斯的火龍牙劍", "火龍巴拉卡斯的獠牙，龍息一次比一次猛烈。", "巴拉卡斯", ["pulse", {"name": "龍息", "t": 8, "p": 60}], ["melee", {"p": 8}], ["weakAura", {"e": "fire", "t": 12, "p": 20}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_b76", "bow", "林德拜爾的風龍弓", "風龍林德拜爾的翼骨，箭會隨著風在敵陣裡跳躍。", "恐怖的林德拜爾", ["ranged", {"p": 8}], ["double", {"c": 10}], ["weakAura", {"e": "wind", "t": 12, "p": 20}], ["chain", {"c": 15, "p": 50}]],
    ["fill_b77", "katana", "丹特斯的冥皇刀", "冥皇丹特斯的佩刀，一刀斬斷生死的界線。", "冥皇丹特斯", ["iai", {"t": 6, "p": 250}], ["revive", {"cd": 240, "h": 20}], ["teamDmg", {"p": 4}], ["execute", {"c": 5, "p": 10}]],
    ["fill_b78", "spear", "謀叛肯恩的叛旗槍", "謀叛者肯恩的叛旗，旗下的人越多，叛亂就越兇。", "反王肯恩(謀叛)", ["perAlly", {"p": 2}], ["allyDmg", {"p": 10}], ["killRush", {"p": 5, "k": 3}]],
    ["fill_b79", "amulet", "謀叛賽尼斯的魔女心", "謀叛魔女賽尼斯的心臟，還在跳著詛咒的節拍。", "魔女賽尼斯(謀叛)", ["curse", {"c": 10, "p": 10}], ["magicDmg", {"p": 8}], ["mpSteal", {"c": 15, "n": 5}], ["mirror", {"c": 10, "p": 50}]]
  ];

  // ── 分階 ──
  var tier = function (n, a) { return a != null ? (a >= 5 ? 4 : 3) : n >= 10 ? 2 : n >= 5 ? 1 : 0; };
  var STAGE_N = ['本體', '+5', '+10', '昇華支配', '昇華支配 +5'];
  var MP = [1, 1.25, 1.5, 2.4, 3.5], MC = [1, 1.2, 1.4, 1.8, 2.2], MT = [1, 1.1, 1.2, 1.4, 1.6], MK = [0, 0, 1, 2, 3], MD = [1, 1.15, 1.3, 1.6, 2];
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var val = function (o, s) {
    var v = {};
    Object.keys(o).forEach(function (k) {
      var x = o[k];
      if (Array.isArray(x)) { v[k] = x[s]; return; }   // 進階特效（afk-relicevo）：每階直接寫數字
      if (typeof x !== 'number') { v[k] = x; return; }
      if (k === 'p' || k === 'n' || k === 'h') v[k] = r1(x * MP[s]);
      else if (k === 'c') v[k] = Math.min(100, Math.round(x * MC[s]));
      else if (k === 't' || k === 'cd') v[k] = r1(x / MT[s]);
      else if (k === 'k') v[k] = x + MK[s];
      else if (k === 'd') v[k] = r1(x * MD[s]);
      else v[k] = x;
    });
    return v;
  };
  var SAVES = { invuln: 1, lastStand: 1, revive: 1, husk: 1 };
  var TXT = {
    acid: function (v) { return '攻擊命中時讓目標 AC +' + v.p + '（最多 ' + v.k + ' 層）'; },
    husk: function (v) { return '倒下時留下空殼：保住 1 HP 並 ' + v.d + ' 秒不受傷害（冷卻 ' + v.cd + ' 秒）'; },
    shadow: function (v) { return '影分身斬：每 ' + v.t + ' 秒影子追加一次攻擊（你近 5 秒每秒傷害 ' + v.p + '%）'; },
    scarab: function (v) { return '聖甲蟲群：每 ' + v.t + ' 秒咬全體敵人（你近 5 秒每秒傷害 ' + v.p + '%）並上一層弱點'; },
    forkRush: function (v) { return '火叉連刺：對新目標的前 3 下傷害 +' + v.p + '%'; },
    thirst: function (v) { return '血之渴望：HP 低於 30% 時吸血 +' + v.p + '%'; },
    teamRegen: function (v) { return '清流：全隊每 ' + v.t + ' 秒恢復最大 HP ' + v.p + '%'; },
    windBlade: function (v) { return '攻擊命中時 ' + v.c + '% 追加風刃（' + v.p + '% 傷害）'; },
    burnHit: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標燃燒 5 秒，每秒造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    vow: function (v) { return '黑騎士之誓：隊友 HP 低於 30% 時你替他吃下一擊（冷卻 ' + v.cd + ' 秒）'; },
    regen: function (v) { return '每 10 秒恢復最大 HP ' + v.p + '%'; },
    summon: function (v) { return '召喚「' + v.name + '」協戰：戰鬥中每 3 秒攻擊目標一次，造成你近 5 秒每秒傷害 ' + v.p + '%（算召喚物：寵物・召喚物・守衛的傷害加成都有效）'; },
    share: function (v) { return '受到的傷害 −' + v.p + '%（召喚物分擔）'; },
    entangle: function (v) { return '攻擊命中時 ' + v.c + '% 纏繞目標 5 秒：目標造成的傷害 −' + v.p + '%'; },
    web: function (v) { return '受到攻擊時 ' + v.c + '% 用絲網纏住攻擊者 5 秒：它造成的傷害 −' + v.p + '%'; },
    vsMarked: function (v) { return '對被纏繞、詛咒、中毒的目標傷害 +' + v.p + '%'; },
    curse: function (v) { return '攻擊命中時 ' + v.c + '% ' + (v.name || '詛咒') + '目標 8 秒：目標受到的傷害 +' + v.p + '%'; },
    thorn: function (v) { return '受到近距離攻擊時 ' + v.c + '% 讓攻擊者中毒 5 秒，每秒受到你近 5 秒每秒傷害 ' + v.p + '%'; },
    poison: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標中毒一層（最多 ' + v.k + ' 層，8 秒），每層每秒造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    block: function (v) { return '受到物理攻擊時 ' + v.c + '% 格擋（這一下不受傷害）'; },
    blockNext: function (v) { return '格擋之後，下一次攻擊傷害 +' + v.p + '%'; },
    stealth: function (v) { return '每 ' + v.t + ' 秒隱身一次，下一次攻擊傷害 +' + v.p + '%'; },
    gold: function (v) { return '打倒怪物得到的金幣 +' + v.p + '%'; },
    exp: function (v) { return '得到的經驗值 +' + v.p + '%'; },
    allyDmg: function (v) { return '傭兵、寵物、召喚物造成的傷害 +' + v.p + '%'; },
    petDmg: function (v) { return '寵物、召喚物造成的傷害 +' + v.p + '%'; },
    lowHpTeam: function (v) { return '你的 HP 每少 25%，全隊受到的傷害 −' + v.p + '%（最多 3 段）'; },
    mpSteal: function (v) { return '攻擊命中時 ' + v.c + '% 吸取 ' + Math.round(v.n) + ' 點 MP'; },
    double: function (v) { return '近距離、遠距離攻擊命中時 ' + v.c + '% 再追加一次同樣的傷害'; },
    splash: function (v) { return '魔法命中時 ' + v.c + '% 捲起水柱，其他敵人各受到這次傷害 ' + v.p + '%'; },
    magicCut: function (v) { return '受到的魔法傷害 −' + v.p + '%'; },
    physCut: function (v) { return '受到的物理傷害 −' + v.p + '%'; },
    guard: function (v) { return '受到的物理、魔法傷害各 −' + v.p + '%'; },
    ranged: function (v) { return '遠距離攻擊傷害 +' + v.p + '%'; },
    melee: function (v) { return '近距離攻擊傷害 +' + v.p + '%'; },
    atk: function (v) { return '近距離、遠距離攻擊傷害 +' + v.p + '%'; },
    magicDmg: function (v) { return '魔法傷害 +' + v.p + '%'; },
    berserk: function (v) { return '狂暴：HP 低於 50% 時造成的傷害 +' + v.p + '%'; },
    hunt: function (v) { return '對 HP 低於 50% 的目標傷害 +' + v.p + '%'; },
    lifesteal: function (v) { return '造成傷害的 ' + v.p + '% 轉為自己的 HP'; },
    pulse: function (v) { return '戰鬥中每 ' + v.t + ' 秒' + v.name + '一次，對全部敵人造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    reflect: function (v) { return '受到攻擊時 ' + v.c + '% 把這次傷害的 ' + v.p + '% 反彈給攻擊者'; },
    iai: function (v) { return '居合：每 ' + v.t + ' 秒，下一次近距離攻擊傷害 +' + v.p + '%'; },
    control: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標' + v.name + ' ' + v.d + ' 秒（期間它造成的傷害歸零；頭目無效）'; },
    blind: function (v) { return '攻擊命中時 ' + v.c + '% 致盲目標 5 秒：它的攻擊 ' + v.p + '% 落空'; },
    ink: function (v) { return '受到攻擊時 ' + v.c + '% 噴墨，攻擊者 5 秒內的攻擊 ' + v.p + '% 落空'; },
    shield: function (v) { return '戰鬥中每 ' + v.t + ' 秒得到最大 HP ' + v.p + '% 的護盾（不疊加；只有你自己）'; },
    killHp: function (v) { return '打倒怪物時恢復最大 HP ' + v.p + '%'; },
    killMp: function (v) { return '打倒怪物時恢復最大 MP ' + v.p + '%'; },
    teamDmg: function (v) { return '全隊造成的傷害 +' + v.p + '%'; },
    ambush: function (v) { return '伏擊：對每個目標的第一次攻擊傷害 +' + v.p + '%'; },
    perAlly: function (v) { return '隊伍裡每有一名傭兵，造成的傷害 +' + v.p + '%'; },
    bossCut: function (v) { return '受到頭目的傷害 −' + v.p + '%'; },
    res: function (v) { return ({ resWater: '水', resFire: '火', resWind: '風', resEarth: '地' })[v.k] + '屬性抗性 +' + Math.round(v.n); },
    res4: function (v) { return '火、水、風、地屬性抗性各 +' + Math.round(v.n); },
    invuln: function (v) { return '保命：HP 低於 ' + v.th + '% 時無敵 ' + v.d + ' 秒（冷卻 ' + Math.round(v.cd) + ' 秒）'; },
    lastStand: function (v) { return '保命：受到致命傷害時保住 1 HP（冷卻 ' + Math.round(v.cd) + ' 秒），之後 10 秒造成的傷害 +' + v.p + '%（傭兵穿戴時沒有效果）'; },
    revive: function (v) { return '保命：倒下時以最大 HP ' + v.h + '% 站起來（冷卻 ' + Math.round(v.cd) + ' 秒；傭兵穿戴時沒有效果）'; },
    // ── 進階特效（afk-relicevo）用 ──
    petOnly: function (v) { return '寵物造成的傷害 +' + v.p + '%'; },
    summonDmg: function (v) { return '召喚物造成的傷害 +' + v.p + '%'; },
    petPanel: function (v) { return '寵物吃你的面板：寵物每次攻擊追加你近距離、遠距離、魔法傷害裡最高那一項的 ' + v.p + '%'; },
    petTaken: function (v) { return '寵物受到的傷害 −' + v.p + '%'; },
    petHp: function (v) { return '寵物最大 HP +' + v.p + '%'; },
    petHeal: function (v) { return '寵物幫忙回血：寵物在場時，每 ' + v.t + ' 秒全隊恢復最大 HP ' + v.p + '%'; },
    petBreak: function (v) { return '寵物攻擊命中時 ' + v.c + '% 破甲破魔：目標受到的傷害 +' + v.p + '%（8 秒）'; },
    petPoison: function (v) { return '寵物攻擊命中時 ' + v.c + '% 讓目標中毒 8 秒，每秒造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    petCast: function (v) { return '寵物額外施法：每 ' + v.t + ' 秒對目標施放一次，造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    petAura: function (v) { return '寵物在場時，全隊造成的傷害 +' + v.p + '%'; },
    petRevive: function (v) { return '寵物倒下 ' + v.t + ' 秒後自動站起來（每隻冷卻 ' + Math.round(v.cd) + ' 秒）'; },
    healRecv: function (v) { return '受到的治療 +' + v.p + '%'; },
    regenLow: function () { return 'HP 低於 50% 時，每 10 秒恢復的量 ×2'; },
    overShield: function (v) { return '每 10 秒恢復超過最大 HP 的部分轉成護盾（最多最大 HP ' + v.p + '%；只有你自己）'; },
    mpRegen: function (v) { return '每 10 秒恢復最大 MP ' + v.p + '%'; },
    mpRescue: function (v) { return 'MP 低於 ' + v.th + '% 時立刻恢復最大 MP ' + v.p + '%（冷卻 ' + Math.round(v.cd) + ' 秒）'; },
    bigHitCut: function (v) { return '單次受到超過最大 HP ' + v.th + '% 的傷害時，那一下 −' + v.p + '%'; },
    lowHpCut: function (v) { return 'HP 低於 ' + v.th + '% 時，受到的傷害再 −' + v.p + '%'; },
    eleCut: function (v) { return '受到' + v.en + '屬性怪物的傷害 −' + v.p + '%'; },
    eleAbsorb: function (v) { return '受到' + v.en + '屬性怪物攻擊時 ' + v.c + '% 把那一下傷害的 ' + v.p + '% 轉成 HP'; },
    stat: function (v) { return v.label + ' +' + v.n; },
    // ── 補齊遺物 11-19 新機制 ──
    weak: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標陷入' + EN[v.e] + '屬性弱點 5 秒（受到' + EN[v.e] + '屬性傷害 +' + v.p + '%）'; },
    weakAura: function (v) { return '戰鬥中每 ' + v.t + ' 秒讓全部敵人陷入' + (v.e === 'rand' ? '隨機一種' : EN[v.e]) + '屬性弱點 5 秒（受到該屬性傷害 +' + v.p + '%）'; },
    vsWeak: function (v) { return '對屬性弱點中的目標傷害 +' + v.p + '%'; },
    absorb: function (v) { return '受到' + EN[v.e] + '屬性傷害時，把那一下傷害的 ' + v.p + '% 轉成 HP'; },
    chain: function (v) { return '攻擊命中時 ' + v.c + '% 連鎖：再跳到 2 個敵人，各受到這次傷害 ' + v.p + '%'; },
    execute: function (v) { return '攻擊命中時 ' + v.c + '% 斬首：直接打倒 HP 低於 ' + v.p + '% 的目標（頭目無效）'; },
    bomb: function (v) { return '攻擊命中時 ' + v.c + '% 埋下' + (v.name || '印記') + '，5 秒後引爆，造成這 5 秒內你對它傷害的 ' + v.p + '%'; },
    focus: function (v) { return '專注：連續攻擊同一個目標，每下傷害 +' + v.p + '%（最多 ' + v.k + ' 層，換目標歸零）'; },
    killRush: function (v) { return '殺意：打倒怪物後 8 秒內傷害 +' + v.p + '%（最多疊 ' + v.k + ' 層）'; },
    revenge: function (v) { return '復仇：受到的傷害會存起來（最多最大 HP 50%），下一次攻擊追加存量的 ' + v.p + '%'; },
    echo: function (v) { return '迴響：每第 5 次攻擊，再追加一次這下傷害的 ' + v.p + '%'; },
    dmgShield: function (v) { return '血盾：造成傷害的 ' + v.p + '% 轉成護盾（最多最大 HP 10%；只有你自己）'; },
    mirror: function (v) { return '魔鏡：受到魔法時 ' + v.c + '% 把那一下傷害的 ' + v.p + '% 反彈給施法者'; },
    phase: function (v) { return '相位：受到攻擊時 ' + v.c + '% 完全閃開（魔法也算）'; },
    overkill: function (v) { return '溢殺：打倒怪物時多出來的傷害，' + v.p + '% 轉給下一個敵人'; },
    starfall: function (v) { return '戰鬥中每 ' + v.t + ' 秒' + v.name + '落下，打隨機 3 個敵人，各受到你近 5 秒每秒傷害 ' + v.p + '%'; }
  };
  var EN = { fire: '火', water: '水', wind: '風', earth: '地', rand: '隨機' };
  // 武器另有「王者之威」：造成的傷害 +N%（各部位不同，11-13 木人場〔冥皇丹特斯〕對齊現有同部位遺物；×1／1.1／1.2／1.4／1.6）
  var MIGHT_BASE = { sword1: 0, dagger: 0, katana: 12, sword2: 12, spear: 10, blunt2: 30, bow: 15, wand: 15, claw: 15, dual: 15, chainsword: 15 };
  var MIGHT_K = [1, 1.1, 1.2, 1.4, 1.6];
  var might = function (row, s) { var b = MIGHT_BASE[row[1]]; return b ? Math.round(b * MIGHT_K[s]) : 0; };
  var isWpnRow = function (row) { return BASE[row[1]].type === 'wpn'; };
  var FILL = {}, MOBN = {};
  var tag = function (key) { return FILL[key] ? '' : '王者遺物・'; };
  var VSF = [1, 1.2, 1.4, 1.8, 2.2];
  var varLines = function (row, s) { var vn = VARN[row[2]], l = []; if (!vn) return l; row.slice(4).forEach(function (e) { var f = e[0] === 'weakAura' || e[0] === 'vsWeak' ? 'weak' : e[0]; if (VFAM[f] && vn[f] && l.indexOf(VTXT[f][vn[f]]) < 0) l.push(VTXT[f][vn[f]] + (s > 0 ? '（強度 ×' + VSF[s] + '）' : '')); }); return l; };
  var fxText = function (row, s) { return (might(row, s) ? (FILL['relic_boss_' + row[0]] || FILL['relic_' + row[0]] ? '遺物之威' : '王者之威') + '：造成的傷害 +' + might(row, s) + '%；' : '') + row.slice(4).map(function (e) { return TXT[e[0]](val(e[1], s)); }).concat(varLines(row, s)).join('；'); };

  // ── 物品 ──
  var BY = {}, KEYS = [];
  var boss = function (id) { try { return W.__afkMapBoss && W.__afkMapBoss.BY[id]; } catch (e) { return null; } };
  var imgOf = function (k) { try { return getIconUrl(DB.items[k]); } catch (e) { return ''; } };
  LIST2.forEach(function (row) { var key = 'relic_' + row[0]; FILL[key] = 1; MOBN[key] = row[4]; row.splice(4, 1); });
  // ── 11-20 Ping：效果組合完全相同的改掉一項；四大家族拆變化（設計稿 claude/relic-redesign-bossfill.md）──
  var REPL = {
    '工兵長的蟻酸瓶': ['summon', ['acid', { k: 5, p: 2 }]], '空殼騎士的鎧甲': ['revive', ['husk', { cd: 240, d: 3 }]], '火焰之影的魔劍': ['pulse', ['shadow', { t: 10, p: 100 }]],
    '木乃伊王的聖甲蟲': ['curse', ['scarab', { t: 15, p: 50 }]], '小惡魔的火叉耳環': ['ambush', ['forkRush', { p: 30 }]], '吸血鬼的獠牙': ['dmgShield', ['thirst', { p: 100 }]],
    '水精靈王的水滴戒': ['weakAura', ['teamRegen', { t: 5, p: 1 }]], '風精靈王的疾風靴': ['weakAura', ['teamDmg', { p: 3 }]], '火精靈王的焰杖': ['weakAura', ['teamDmg', { p: 3 }]],
    '深淵風靈的風環': ['vsWeak', ['windBlade', { c: 8, p: 40 }]], '深淵火靈的焰環': ['vsWeak', ['burnHit', { c: 8, p: 10 }]], '岩石戰士的石鎚': ['weakAura', ['acid', { k: 10, p: 1 }]],
    '黑暗范德的黑騎士盾': ['reflect', ['vow', { cd: 20 }]]
  };
  LIST.concat(LIST2).forEach(function (row) { var r = REPL[row[2]]; if (!r) return; for (var i = 4; i < row.length; i++) if (Array.isArray(row[i]) && row[i][0] === r[0]) { row[i] = r[1]; break; } });
  var VARL = {
    weak: { spread: '盜賊王的沙暗匕首、羽蛇祭司的羽冠、格利芬王的翼羽弓、潘恩的污染笛、千眼的凝視之眼、鷹獅的翼爪靴、特提斯的觸鬚環、深淵水靈的潮珠、炎魔分身的火影戒、巴列斯的獄炎戟、須曼的湖底鱗帶、巴洛斯的長老戒',
      boom: '潮汐女巫的珠杖、黑鱗幼龍的逆鱗、大王烏賊的墨囊、掘地將軍的礦工腰帶、守墓神官的權杖、盜賊團的咒杖、翼龍的皮靴、深淵風靈的風環、炎魔惡魔的焦爪、火焰之影的魔劍、支配眼魔的眼冠、風龍守護者的風靴',
      focus: '冰狼王的毛皮斗篷、白虎王的牙飾、法老的黃金面具、巨人首領的戰錘、翼魔教官的蝠翼靴、實驗體的火核耳環、小眼魔的眼珠、深淵火靈的焰環、幻象眼魔的幻眼、不死鳥的羽衣、琪娜的長老聖印、風荒龍的翼骨弓',
      drain: '蠍王的尾鉤、狼群首領的頭骨盔、鋼心巨像的水晶心、蛇女祭司的蛇杖、仙人掌狗的尖刺耳飾、沙鰭的雙鰭刃、木乃伊王的聖甲蟲、惡魔司祭的角冠、沙人的砂礫拳套、冰魔的冰核、艾迪爾的長老杖、地荒龍的鱗盾',
      brk: '黑鬍子的燧發短銃、獅身人面的謎之耳環、白蟻的酸囊、閃電球的雷核、小惡魔的火叉耳環、親衛槍兵的焰矛、賀洛斯的鷹眼弓、巴塔斯的長老耳環' },
    block: { thorn: '叛騎士的斷誓劍、監獄長的鎖鍊、守門巨像的石臂甲、甲蟲的硬殼盾、哈蒙將軍的怨劍、佩特拉魔像的岩拳、奧馬爾的傲慢之拳',
      charge: '落武者的居合刀、鋼心巨像的水晶心、空殼騎士的鎧甲、范德的騎士劍、岩石野獸的岩盾、佩特拉守護者的古盾、地荒龍的鱗盾',
      guard: '骨兵長的骨盾、屍骨將的骨刃、教頭的雙刃戟、巴風特親衛的山羊盾、巨大守護者的墓門盾、闇黑范德的黑騎士劍',
      heal: '鐵壁將軍的塔盾、骷髏劍聖的古劍、試作兵器的機械臂、支配范德的斷罪劍、黑暗范德的黑騎士盾' },
    curse: { spread: '大長者的骨杖、食人妖精祭司的骨鈴、白蟻的酸囊、巴風特司祭的骨杖、蕾雅的法令權杖、史塔伯洛的厄運戒',
      deep: '監獄長的鎖鍊、工兵長的蟻酸瓶、混沌司祭的長戟、支配木乃伊王的裹屍布、不死木乃伊王的黃金腰帶、巴洛斯的長老戒',
      back: '法老的黃金面具、蛇女祭司的蛇杖、木乃伊王的聖甲蟲、墮落的黑翼、海露拜的冥法杖、支配木乃伊王的黃金面具',
      drain: '老長老的智慧耳環、守墓神官的權杖、扭曲女王的權杖、混沌的面甲、謀叛賽尼斯的魔女心' },
    absorb: { shield: '深海守護者的鱗甲、土精靈王的岩護腿、惡魔親衛的焦甲、大地魔像的岩甲、須曼的湖底鱗帶、地泥龍的泥鱗帶',
      mp: '果凍王的黏液、水精靈王的水滴戒、狄高的水之心、不死鳥的羽衣、炎魔的獄火鞭、地荒龍的鱗盾',
      charge: '沙漠蜥蜴的鱗片護腿、風精靈王的疾風靴、安加斯的火之心、冰魔的冰核、風龍守護者的風靴',
      share: '實驗體的火核耳環、火精靈王的焰杖、巴薩斯的風之心、風泥龍的鱗脛甲、恐怖安塔瑞斯的龍鱗甲' }
  };
  var VARN = {};   // 名稱 → { weak: 'spread', ... }
  Object.keys(VARL).forEach(function (fam) { Object.keys(VARL[fam]).forEach(function (vn) { VARL[fam][vn].split('、').forEach(function (n) { (VARN[n] = VARN[n] || {})[fam] = vn; }); }); });
  var VTXT = {
    weak: { spread: '弱點傳染：目標倒下時，弱點傳給最近一隻怪', boom: '弱點引爆：同一目標被你上弱點 5 次時引爆（你近 5 秒每秒傷害 100%）', focus: '弱點集火：全隊打有弱點的目標傷害 +3%', drain: '弱點汲取：打有弱點的目標回 MP 0.3%（每秒一次）', brk: '弱點破甲：每次上弱點讓目標 AC +2（最多 10）' },
    block: { thorn: '格擋反刺：格擋時反擊一次（你近 5 秒每秒傷害 60%）', charge: '格擋蓄力：每次格擋 +1 層，滿 5 層下一擊傷害 +50%', guard: '格擋護衛：隊友被物理攻擊時 5% 由你擋下', heal: '格擋回復：格擋時回 HP 0.5%' },
    curse: { spread: '詛咒擴散：被詛咒的怪倒下時，詛咒跳到一隻怪', deep: '詛咒加深：詛咒每 3 秒效果 +5%（最多 +25%）', back: '詛咒反噬：被詛咒的怪攻擊時 5% 打到自己', drain: '詛咒汲取：詛咒中的怪受到你的傷害 1% 回你 HP' },
    absorb: { shield: '吸收護盾：吸收量 30% 變成護盾', mp: '吸收回魔：吸收量 20% 變成 MP', charge: '吸收蓄能：吸收量累積到最大 HP 30% 時放一次元素爆發（全體、累積量 100%）', share: '吸收分享：吸收量一半分給 HP 最低的隊友' }
  };
  var VFAM = { weak: 1, block: 1, curse: 1, absorb: 1 };
  var ALL = LIST.map(function (r) { return ['relic_boss_' + r[0], r]; }).concat(LIST2.map(function (r) { return ['relic_' + r[0], r]; }));
  ALL.forEach(function (pair) {
    var key = pair[0], row = pair[1], B = BASE[row[1]];
    var d = { n: row[2], type: B.type, relic: true, noEnhance: true, req: B.req, p: 10000, gachaWeight: 0, bossRelicKey: key, bossRelic: 0 };
    if (FILL[key]) d.relicFill = 1;   // 補齊遺物：名稱就叫遺物、進時空裂痕結算池、不進黑市自選
    if (B.slot) d.slot = B.slot;
    ['isBow', 'ranged', 'w2h', 'chainsword', 'isWand', 'eff', 'ignHardSkin', 'weakExpose', 'pierceChance'].forEach(function (f) { if (B[f]) d[f] = B[f]; });
    Object.keys(B.s).forEach(function (f) { d[f] = B.s[f]; });
    row.slice(4).forEach(function (e) { if (e[0] === 'res') d[e[1].k] = (d[e[1].k] || 0) + e[1].n; if (e[0] === 'res4') ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (f) { d[f] = (d[f] || 0) + e[1].n; }); });
    d.d = '【遺物】' + row[3] + ' 〔' + tag(key) + STAGE_N[0] + '〕' + fxText(row, 0) + '。';
    d.img = FILL[key] ? 'assets/icons/relic-fill/' + key + '.webp' : 'assets/icons/relic-boss/' + key + '.webp';   // GPT 圖：王者遺物 79 張（11-13）、補齊遺物 150 張（11-19 19:49）
    if (!DB.items[key]) DB.items[key] = d;
    try { if (B.tags && typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS[key]) WEAPON_TAGS[key] = B.tags.slice(); } catch (e) {}
    BY[key] = row; KEYS.push(key);
  });
  // 圖示：GPT 圖到之前借同部位遺物的圖
  try {
    if (typeof getIconUrl === 'function' && !getIconUrl.__afkBossRelic) {
      var oIcon = getIconUrl;
      var nIcon = function (d) { if (d && d.bossRelicKey && !d.img && BASE[BY[d.bossRelicKey][1]]) { var k = BASE[BY[d.bossRelicKey][1]].img; if (DB.items[k]) return oIcon.call(this, DB.items[k]); } return oIcon.apply(this, arguments); };
      nIcon.__afkBossRelic = true; W.getIconUrl = nIcon; try { (0, eval)('getIconUrl = window.getIconUrl'); } catch (e) {}
    }
  } catch (e) {}
  // 遺物收集冊：它的索引在載入時就建好了，這裡把 79 件補進去
  try {
    if (typeof RELIC_CAT_ITEMS !== 'undefined' && typeof equipCatKey === 'function') KEYS.forEach(function (k) {
      var ck = equipCatKey(k, DB.items[k]); if (!ck || !RELIC_CAT_ITEMS[ck] || RELIC_CAT_ITEMS[ck].indexOf(k) >= 0) return;
      RELIC_CAT_ITEMS[ck].push(k); RELIC_ITEM_CAT[k] = ck;
    });
  } catch (e) {}
  // 掉落：跟一般遺物同一條路（MOB_DROPS[王的名字]）
  var addDrops = function () {
    if (typeof MOB_DROPS === 'undefined' || !W.__afkMapBoss) return false;
    LIST.forEach(function (row) {
      var b = boss(row[0]); if (!b) return; var key = 'relic_boss_' + row[0], l = MOB_DROPS[b.n] = MOB_DROPS[b.n] || [];
      if (!l.some(function (x) { return x[0] === key; })) l.push([key, RATE]);
    });
    Object.keys(MOBN).forEach(function (key) { var l = MOBN[key] && (MOB_DROPS[MOBN[key]] = MOB_DROPS[MOBN[key]] || []); if (l && !l.some(function (x) { return x[0] === key; })) l.push([key, RATE]); });
    return true;
  };
  addDrops(); W.addEventListener('load', function () { addDrops(); setTimeout(addDrops, 0); });   // 11-19：afk-newzones 會在之後重設佩特拉一帶的掉落表，載入完再補一次

  // ── 物品說明（11-19 Ping「說明與介面」）：來歷一行、特效一行一條、再附下一階預覽；合成、詞綴等附加說明照原樣接在後面 ──
  var fxLines = function (key, row, s) {
    var l = []; if (might(row, s)) l.push((FILL[key] ? '遺物之威' : '王者之威') + '：造成的傷害 +' + might(row, s) + '%');
    row.slice(4).forEach(function (e) { if (e[0] === 'res' || e[0] === 'res4') return; l.push(TXT[e[0]](val(e[1], s))); });
    return l.concat(varLines(row, s));
  };
  var tipHtml = function (d) {
    var key = d.bossRelicKey, row = BY[key], s = Math.max(0, Math.min(4, N(d.bossRelic)));
    var head = '【遺物】' + row[3] + ' 〔' + tag(key) + STAGE_N[s] + '〕' + fxText(row, s) + '。', raw = String(d.d || ''), tail = raw.indexOf(head) === 0 ? raw.slice(head.length).trim() : '';
    var h = '<span class="text-slate-300">' + esc(row[3]) + '</span><br><span class="text-amber-300 font-bold">' + (FILL[key] ? '遺物特效' : '王者遺物特效') + '・' + STAGE_N[s] + '</span><br>'
      + fxLines(key, row, s).map(function (x) { return '<span class="text-amber-200">・' + esc(x) + '</span>'; }).join('<br>');
    if (s < 4) h += '<br><span class="text-slate-400" style="font-size:11px">下一階（' + STAGE_N[s + 1] + '）：' + esc(fxLines(key, row, s + 1).join('；')) + '</span>';
    if (tail) h += '<br><span class="text-slate-400">' + esc(tail) + '</span>';
    return h;
  };
  // 原本的 250 件：「【遺物】來歷。特效；特效…〔遺物合成 +10〕」→ 來歷一行、特效一行一條
  var plainRelicTip = function (r) {
    var body = r.slice(4), tail = '', m = body.match(/(\s*〔[^〕]*〕)+\s*$/); if (m) { tail = m[0].trim(); body = body.slice(0, m.index); }
    var cut = body.indexOf('。'); if (cut < 0 || cut > 80) return r;
    var lore = body.slice(0, cut + 1).trim(), fx = body.slice(cut + 1).trim().replace(/。$/, '');
    if (!fx) return r;
    var parts = []; var depth = 0, cur = '';
    for (var i = 0; i < fx.length; i++) { var c = fx[i]; if (c === '（') depth++; else if (c === '）') depth = Math.max(0, depth - 1); if ((c === '；' || c === '／' && fx[i - 1] === ' ') && !depth) { if (cur.trim()) parts.push(cur.trim().replace(/\s*\/$/, '')); cur = ''; continue; } cur += c; }
    if (cur.trim()) parts.push(cur.trim().replace(/^\/\s*/, ''));
    parts = parts.map(function (x) { return x.replace(/^\/\s*/, '').replace(/\s*\/$/, ''); }).filter(Boolean);
    return '<span class="text-slate-300">' + esc(lore) + '</span><br>' + parts.map(function (x) { return '<span class="text-amber-200">・' + esc(x) + '</span>'; }).join('<br>') + (tail ? '<br><span class="text-slate-400">' + esc(tail) + '</span>' : '');
  };
  var hookTip = function () {
    var o = W.tooltipItemDescription; if (typeof o !== 'function' || o.__afkBR) return;
    var f = function (d, id) {
      try { if (d && d.bossRelicKey && BY[d.bossRelicKey]) return tipHtml(d); } catch (e) {}
      var r = o.apply(this, arguments);
      try { if (d && d.relic && typeof r === 'string' && r.indexOf('【遺物】') === 0 && r.indexOf('<') < 0) r = plainRelicTip(r); } catch (e) {}
      return r;
    };
    f.__afkBR = true; W.tooltipItemDescription = f; try { (0, eval)('tooltipItemDescription = window.tooltipItemDescription'); } catch (e) {}
  };
  hookTip(); W.addEventListener('load', hookTip);

  // ── 遺物合成／昇華：寫入階段與該階的說明 ──
  var hookTier = function () {
    var o = W.__afkRelicTier; if (typeof o !== 'function' || o.__afkBossRelic) return false;
    var f = function (d, b, n, asc) {
      var r = o.apply(this, arguments);
      try {
        if (d && b && b.bossRelicKey && BY[b.bossRelicKey]) {
          var s = tier(n, asc), row = BY[b.bossRelicKey];
          d.bossRelicKey = b.bossRelicKey; d.bossRelic = s;
          row.slice(4).forEach(function (e) {
            if (e[0] === 'res') d[e[1].k] = N(d[e[1].k]) - e[1].n + Math.round(val(e[1], s).n);
            if (e[0] === 'res4') ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { d[k] = N(d[k]) - e[1].n + Math.round(val(e[1], s).n); });
          });
          d.d = '【遺物】' + row[3] + ' 〔' + tag(b.bossRelicKey) + STAGE_N[s] + '〕' + fxText(row, s) + '。';
        } else if (d && d.relicBase && EVO[d.relicBase]) {
          var s2 = tier(n, asc); d.relicEvoKey = d.relicBase; d.relicEvoStage = s2;
          if (s2 > 0) {
            EVO[d.relicBase].fx.forEach(function (e) { if (e[0] !== 'stat') return; var o = val(e[1], s2); if (N(o.n)) (o.k === 'res4' ? ['resFire', 'resWater', 'resWind', 'resEarth'] : [o.k]).forEach(function (k) { d[k] = N(d[k]) + N(o.n); }); });
            d.d = (d.d || '') + '〔進階特效・' + STAGE_N[s2] + '〕' + evoText(d.relicBase, s2) + '。';
          }
        }
      } catch (e) {}
      return r;
    };
    f.__afkBossRelic = true; W.__afkRelicTier = f; return true;
  };
  if (!hookTier()) W.addEventListener('load', hookTier);

  // ════════ 效果 ════════
  var on = function () { var p = P(); return !!(p && !p.classicMode); };
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && !a.dead; })); };
  var isPlayer = function (x) { return x && x === P(); };
  var isAlly = function (x) { var p = P(); return !!(x && p && x !== p && (p.allies || []).indexOf(x) >= 0); };
  var hpOf = function (x) { return isPlayer(x) ? N(x.hp) : N(x.curHp); };
  var mhpOf = function (x) { return Math.max(1, N(x.mhp)); };
  var heal = function (x, n) { n = Math.floor(n); if (!(n > 0)) return; if (isPlayer(x)) x.hp = Math.min(x.mhp, N(x.hp) + n); else if (N(x.curHp) > 0) x.curHp = Math.min(mhpOf(x), N(x.curHp) + n); };
  // 近 5 秒每秒傷害（自己直接造成的傷害，不含王者遺物自己的追加傷害）：召喚、砲擊、中毒、反刺都用它算
  var DPS = new WeakMap();
  var dpsAdd = function (x, v) { var t = Math.floor(tk() / 10), o = DPS.get(x); if (!o) { o = { b: [0, 0, 0, 0, 0, 0], t: t }; DPS.set(x, o); } if (t !== o.t) { for (var i = o.t + 1; i <= t && i - o.t <= 6; i++) o.b[i % 6] = 0; o.t = t; } o.b[t % 6] += v; };
  var panel = function (x) { var o = DPS.get(x); if (!o) return 0; var t = Math.floor(tk() / 10); if (t - o.t >= 6) return 0; var sum = 0; for (var i = 1; i <= 5; i++) { if (t - i < o.t - 5 || t - i > o.t) continue; sum += o.b[(t - i + 6) % 6]; } return sum / 5; };
  var alive = function (m) { return m && !m._dead && N(m.curHp) > 0; };
  var mobs = function () { try { return (mapState.mobs || []).filter(alive); } catch (e) { return []; } };
  var target = function () { try { var t = typeof getTarget === 'function' ? getTarget() : null; return alive(t) ? t : mobs()[0] || null; } catch (e) { return null; } };
  var hit = function (m, n) { var x = X(); return x && n > 0 && alive(m) ? x.hitMob(m, n) : 0; };
  // 遺物召喚出來的協戰者（奇古獸的影子、冰狼、骷髏兵…）算召喚物：吃寵物・召喚物・守衛的加成（Ping 11-15）
  //   巔峰「寵物・召喚物・守衛 造成的傷害／追擊」、遺物的召喚物增傷都走 AFK_RELIC_RUNTIME.companionDamage；王者遺物自己的召喚物增傷、全隊增傷照 dealt 的算法
  var SUMENT = new WeakMap();
  var sumEnt = function (a, name) { var m = SUMENT.get(a); if (!m) { m = {}; SUMENT.set(a, m); } return m[name] || (m[name] = { skId: 'relic_summon', n: name, form: name, _relicSummon: 1 }); };
  var sumHit = function (a, m, n, name) {
    if (!(n > 0) || !alive(m)) return 0;
    var R = W.AFK_RELIC_RUNTIME, f = fx(a), mult = 1;
    try {
      if (f) { if (f.allyDmg) mult += f.allyDmg.p / 100; if (f.petDmg) mult += f.petDmg.p / 100; if (f.summonDmg) mult += f.summonDmg.p / 100; }
      mult += (Math.min(20, teamSum('teamDmg')) + Math.min(15, petAuraOn() ? teamSum('petAura') : 0)) / 100;
      n = n * mult;
      if (R && typeof R.companionDamage === 'function') n = R.companionDamage(a, sumEnt(a, name), m, n, { source: 'relic-summon' });
    } catch (e) {}
    var r = hit(m, n);
    try { if (R && typeof R.flushCompanionHits === 'function') R.flushCompanionHits(a); } catch (e) {}
    return r;
  };

  // 身上的王者遺物 → 各種效果（同一種相加；保命只取階段最高的一件）
  var CACHE = new WeakMap(), GEN = 0;
  // 換裝、重算能力時清掉快取（同一刻內換裝也立刻生效）
  var hookGen = function () {
    ['calcStats', 'recomputeStats'].forEach(function (fn) {
      var o = W[fn]; if (typeof o !== 'function' || o.__afkBossRelicGen) return;
      var f = function () { GEN++; return o.apply(this, arguments); }; f.__afkBossRelicGen = true; W[fn] = f;
      try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
    });
  };
  hookGen(); W.addEventListener('load', hookGen);
  // 同一種效果相加（間隔取短、層數取多）
  var merge = function (v, k, o) {
    v.has = true;
    if (LISTK[k]) { (v[k] = v[k] || []).push(o); return; }
    var cur = v[k];
    if (!cur) { v[k] = Object.assign({}, o); return; }
    if (o.p != null) cur.p = r1(N(cur.p) + o.p);
    if (o.c != null) cur.c = Math.min(100, r1(N(cur.c) + o.c));
    if (o.n != null && k === 'mpSteal') cur.n += o.n;
    if (o.k != null) cur.k = Math.max(cur.k, o.k);
    if (o.t != null) cur.t = Math.min(cur.t, o.t);
    if (o.d != null) cur.d = Math.max(cur.d, o.d);
    if (o.cd != null) cur.cd = Math.min(cur.cd, o.cd);
    if (o.th != null) cur.th = Math.max(cur.th, o.th);
  };
  var LISTK = { summon: 1, pulse: 1, weak: 1, weakAura: 1, absorb: 1, starfall: 1 };   // 這幾種每件各算各的
  var EVO = {};
  var evoInto = function (v, key, s) {
    EVO[key].fx.forEach(function (e) {
      var k = e[0]; if (k === 'stat') return; var o = val(e[1], s);
      if (!Object.keys(o).some(function (k2) { return k2 !== 'th' && typeof o[k2] === 'number' && o[k2] > 0; })) return;   // 這一階還沒有
      if (k === 'eleCut' || k === 'eleAbsorb') { var l = v[k] = v[k] || []; l.push(o); v.has = true; return; }
      merge(v, k, o);
    });
  };
  var evoText = function (key, s) {
    return EVO[key].fx.map(function (e) { var o = val(e[1], s); if (!Object.keys(o).some(function (k2) { return k2 !== 'th' && typeof o[k2] === 'number' && o[k2] > 0; })) return ''; return TXT[e[0]] ? TXT[e[0]](o) : ''; }).filter(Boolean).join('；');
  };
  // 已經建好的合成物品定義（存檔載入時就建了）重建一次，才帶得到進階特效
  var rebuildEvo = function () {
    var D = W.__afkRelicData; if (!D || !D.parseId || !D.ensure) return;
    Object.getOwnPropertyNames(DB.items).forEach(function (id) { var q = D.parseId(id); if (!q || !EVO[q.base]) return; var d = DB.items[id]; if (d && d.relicEvoKey) return; try { delete DB.items[id]; D.ensure(id); } catch (e) {} });
    GEN++;
  };
  var addEvo = function (map) { Object.keys(map).forEach(function (k) { if (DB.items[k]) EVO[k] = map[k]; }); rebuildEvo(); };
  W.addEventListener('load', function () { setTimeout(rebuildEvo, 0); });
  // 同一種效果疊很多件時的上限
  var CAPS = { vsWeak: 80, focus: 10, killRush: 15, revenge: 150, echo: 300, dmgShield: 15, overkill: 100, execute: 50, petOnly: 150, petPanel: 100, petHp: 200, petHeal: 8, petCast: 120, petPoison: 6, summonDmg: 150, healRecv: 100, mpRegen: 15, regen: 10, guard: 30, magicCut: 40, physCut: 40, lowHpCut: 40, double: 60, atk: 80, magicDmg: 80, hunt: 80, ambush: 300, gold: 50 };
  var CCAPS = { phase: 25, execute: 30, chain: 60, mirror: 60 };   // 機率上限
  var paC = { t: -1, v: false };
  var petAuraOn = function () { var t = tk(); if (paC.t === t) return paC.v; paC.t = t; try { paC.v = (typeof petsOutList === 'function' ? petsOutList() : []).some(function (pt) { return pt && !pt._downed && N(pt.hp) > 0; }); } catch (e) { paC.v = false; } return paC.v; };
  // 寵物受到的傷害、寵物最大 HP（核心函式包一層）
  var hookPet = function () {
    var o1 = W.petArmorDmgReduceMult;
    if (typeof o1 === 'function' && !o1.__afkEvo) { var f1 = function (pt) { var m = o1.apply(this, arguments); try { if (on()) { var f = fx(P()); if (f && f.petTaken) m *= 1 - Math.min(60, f.petTaken.p) / 100; } } catch (e) {} return m; }; f1.__afkEvo = true; W.petArmorDmgReduceMult = f1; try { (0, eval)('petArmorDmgReduceMult = window.petArmorDmgReduceMult'); } catch (e) {} }
    var o2 = W.petMhpEff;
    if (typeof o2 === 'function' && !o2.__afkEvo) { var f2 = function (pt) { var m = o2.apply(this, arguments); try { if (on()) { var f = fx(P()); if (f && f.petHp) m = Math.floor(m * (1 + f.petHp.p / 100)); } } catch (e) {} return m; }; f2.__afkEvo = true; W.petMhpEff = f2; try { (0, eval)('petMhpEff = window.petMhpEff'); } catch (e) {} }
    var o3 = W.foulWaterHealMult;   // 受到的治療
    if (typeof o3 === 'function' && !o3.__afkEvo) { var f3 = function (tg) { var m = o3.apply(this, arguments); try { if (on() && tg && (isPlayer(tg) || isAlly(tg))) { var f = fx(tg); if (f && f.healRecv) m *= 1 + f.healRecv.p / 100; } } catch (e) {} return m; }; f3.__afkEvo = true; W.foulWaterHealMult = f3; try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {} }
  };
  hookPet(); W.addEventListener('load', hookPet);
  var fx = function (x) {
    if (!x || !x.eq) return null;
    var t = tk() + ':' + GEN, c = CACHE.get(x); if (c && c.t === t) return c.v;
    var v = { has: false }, save = null;
    Object.keys(x.eq).forEach(function (slot) {
      var it = x.eq[slot], d = it && DB.items[it.id]; if (!d) return;
      if (slot === 'wpn2' || /^rem_|^doll|^mio/.test(slot)) return;
      if (d.relicEvoKey && EVO[d.relicEvoKey] && N(d.relicEvoStage) > 0) { evoInto(v, d.relicEvoKey, N(d.relicEvoStage)); return; }
      if (!d.bossRelicKey || !BY[d.bossRelicKey]) return;
      var s = Math.max(0, Math.min(4, N(d.bossRelic))), row = BY[d.bossRelicKey];
      if (slot === 'wpn' && might(row, s)) { v.has = true; v.might = N(v.might) + might(row, s); }
      var vn = VARN[row[2]]; if (vn) row.slice(4).forEach(function (e) { var f0 = e[0] === 'weakAura' || e[0] === 'vsWeak' ? 'weak' : e[0]; if (VFAM[f0] && vn[f0]) { var kk = 'vr_' + f0 + '_' + vn[f0]; v[kk] = Math.max(N(v[kk]), VSF[s]); v.has = true; } });
      row.slice(4).forEach(function (e) {
        var k = e[0], o = val(e[1], s); v.has = true;
        if (SAVES[k]) { if (!save || s > save.s) save = { k: k, s: s, o: o, key: d.bossRelicKey }; return; }
        if (LISTK[k]) { (v[k] = v[k] || []).push(o); return; }
        var cur = v[k];
        if (!cur) { v[k] = Object.assign({}, o); return; }
        if (o.p != null) cur.p = r1(N(cur.p) + o.p);
        if (o.c != null) cur.c = Math.min(100, r1(N(cur.c) + o.c));
        if (o.n != null && k === 'mpSteal') cur.n += o.n;
        if (o.k != null) cur.k = Math.max(cur.k, o.k);
        if (o.t != null) cur.t = Math.min(cur.t, o.t);
        if (o.d != null) cur.d = Math.max(cur.d, o.d);
      });
    });
    // 寵物身上的寵物裝備（寵物專用遺物）算在你身上
    if (x === P()) { try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) { if (!pt || !pt.eq) return; Object.keys(pt.eq).forEach(function (k) { var e = pt.eq[k], d = e && DB.items[e.id]; if (d && d.relicEvoKey && EVO[d.relicEvoKey] && N(d.relicEvoStage) > 0) evoInto(v, d.relicEvoKey, N(d.relicEvoStage)); }); }); } catch (e) {} }
    if (save) v.save = save;
    Object.keys(CAPS).forEach(function (k) { if (v[k] && v[k].p > CAPS[k]) v[k].p = CAPS[k]; if (v[k] && k === 'double' && v[k].c > CAPS[k]) v[k].c = CAPS[k]; });
    Object.keys(CCAPS).forEach(function (k) { if (v[k] && v[k].c > CCAPS[k]) v[k].c = CCAPS[k]; });
    CACHE.set(x, { t: t, v: v.has ? v : null }); return v.has ? v : null;
  };
  // 每人的計時器、冷卻
  var ST = new WeakMap();
  var st = function (x) { var s = ST.get(x); if (!s) { s = { icd: {}, stealthAt: -1e9, iaiAt: -1e9, saveCd: -1e9, invUntil: 0, lsUntil: 0, blockReady: false, shieldAt: -1e9, regenAt: 0, sumAt: 0, pulseAt: {} }; ST.set(x, s); } return s; };
  var proc = function (x, key, c) { var s = st(x), t = tk(); if ((s.icd[key] || -1e9) > t - 5) return false; if (Math.random() * 100 >= c) return false; s.icd[key] = t; return true; };
  // 怪物身上的標記
  var MK_ = new WeakMap();
  var mk = function (m) { var o = MK_.get(m); if (!o) { o = { dots: [] }; MK_.set(m, o); } return o; };
  var marked = function (m) { var o = MK_.get(m), t = tk(); return !!(o && ((o.ent || 0) > t || (o.curse || 0) > t || o.dots.some(function (d) { return d.until > t; }))); };
  var note = function (key, h) { try { var x = X(); if (x) x.note('br_' + key, h); } catch (e) {} };
  var popFx = function (key, txt) { try { var x = X(); if (x) x.pop('br_' + key, '', txt, '#fcd34d'); } catch (e) {} };

  // 全隊加總（寵物光環、全隊增傷…）：每次傷害都會問，改成同一拍只算一次（11-15 效能）
  var TS = { t: -1, g: -1, v: {} };
  var teamSum = function (k) { var t = tk(); if (TS.t !== t || TS.g !== GEN) { TS.t = t; TS.g = GEN; TS.v = {}; } var c = TS.v[k]; if (c !== undefined) return c; var n = 0; party().forEach(function (a) { var f = fx(a); if (f && f[k]) n += N(f[k].p); }); TS.v[k] = n; return n; };

  var TV = { t: -1, g: -1, v: {} };
  var teamVar = function (k) { var t = tk(); if (TV.t !== t || TV.g !== GEN) { TV.t = t; TV.g = GEN; TV.v = {}; } if (TV.v[k] !== undefined) return TV.v[k]; var n = 0; party().forEach(function (a) { var f = fx(a); if (f && f[k]) n = Math.max(n, N(f[k])); }); TV.v[k] = n; return n; };
  // ── 屬性弱點（遺物執行層的狀態：fireVulnerability…，跟覺醒技、血脈同一套）──
  var RAPI = function () { var R = W.AFK_RELIC_RUNTIME; return R && R.api; };
  var ELES = ['fire', 'water', 'wind', 'earth'];
  var setWeak = function (m, e, p) { try { var a = RAPI(); if (a && a.status && alive(m)) a.status(m, (e === 'rand' ? ELES[Math.floor(Math.random() * 4)] : e) + 'Vulnerability', 5, p / 100); } catch (e2) {} };
  var hasWeak = function (m) { try { var a = RAPI(); return !!(a && a.hasStatus && m && ELES.some(function (e) { return a.hasStatus(m, e + 'Vulnerability'); })); } catch (e) { return false; } };
  var others = function (m, n) { var l = mobs().filter(function (x) { return x !== m; }); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), q = l[i]; l[i] = l[j]; l[j] = q; } return l.slice(0, n); };

  // ── 造成傷害 ──
  var dealt = function (actor, tgt, v, opt) {
    if (!on() || !(v > 0) || !tgt || !actor || typeof actor !== 'object') return v;
    var p = P(), kind = opt && opt.kind, main = kind === 'melee' || kind === 'ranged' || kind === 'magic', t = tk();
    var src = null; try { src = typeof _combatSrc !== 'undefined' ? _combatSrc : null; } catch (e) {}
    var comp = src === 'pet' || src === 'summon';   // 寵物、召喚物的傷害在核心是記在你身上（actor＝你）
    var mine = !comp && (isPlayer(actor) || isAlly(actor));
    if (mine) dpsAdd(actor, v);
    var pf = fx(p), mult = 1, om0 = MK_.get(tgt);
    if (om0 && (om0.curse || 0) > t) { mult += Math.min(60, N(om0.curseP)) / 100; var dpf = teamVar('vr_curse_deep'); if (dpf && om0.curseAt) mult += Math.min(25, Math.floor((t - om0.curseAt) / 30) * 5) * dpf / 100; }   // 詛咒、破甲破魔：目標受到的傷害增加；11-20 詛咒加深
    var fcf = teamVar('vr_weak_focus'); if (fcf && hasWeak(tgt)) mult += 0.03 * fcf;   // 11-20 弱點集火
    var aura = Math.min(15, petAuraOn() ? teamSum('petAura') : 0), team = Math.min(20, teamSum('teamDmg'));
    if (!mine) {   // 寵物、召喚物
      if (pf) {
        if (pf.allyDmg) mult += pf.allyDmg.p / 100; if (pf.petDmg) mult += pf.petDmg.p / 100;
        if (src === 'pet' && pf.petOnly) mult += pf.petOnly.p / 100;
        if (src === 'summon' && pf.summonDmg) mult += pf.summonDmg.p / 100;
      }
      mult += (team + aura) / 100;
      v = v * mult;
      if (src === 'pet' && pf) {
        if (pf.petPanel) { var dd = p.d || {}; v += Math.max(N(dd.meleeDmg), N(dd.rangedDmg), N(dd.magicDmg)) * pf.petPanel.p / 100; }
        var o3 = mk(tgt);
        if (pf.petBreak && proc(p, 'pbk', pf.petBreak.c)) { o3.curse = t + 80; o3.curseP = Math.max(N(o3.curseP), pf.petBreak.p); }
        if (pf.petPoison && proc(p, 'ppo', pf.petPoison.c)) {   // 寵物的毒最多 3 層，滿了只刷新時間
          var pl = o3.dots.filter(function (d) { return d.k === 'ppo' && d.until > t; });
          if (pl.length < 3) o3.dots.push({ src: p, k: 'ppo', until: t + 80, per: panel(p) * pf.petPoison.p / 100 }); else { pl.sort(function (a, b) { return a.until - b.until; }); pl[0].until = t + 80; pl[0].per = panel(p) * pf.petPoison.p / 100; }
        }
      }
      return v;
    }
    mult += aura / 100;
    if (isAlly(actor) && pf && pf.allyDmg) mult += pf.allyDmg.p / 100;
    if (team) mult += team / 100;
    var f = fx(actor);
    if (!f) return mult !== 1 ? v * mult : v;
    var s = st(actor), add = N(f.might);
    if (f.ranged && kind === 'ranged') add += f.ranged.p;
    if (f.melee && kind === 'melee') add += f.melee.p;
    if (f.atk && (kind === 'melee' || kind === 'ranged')) add += f.atk.p;
    if (f.magicDmg && kind === 'magic') add += f.magicDmg.p;
    if (f.berserk && hpOf(actor) < mhpOf(actor) * 0.5) add += f.berserk.p;
    if (f.hunt && N(tgt.curHp) < N(tgt.hp) * 0.5) add += f.hunt.p;
    if (f.vsMarked && marked(tgt)) add += f.vsMarked.p;
    if (f.perAlly && p) add += f.perAlly.p * Math.min(15, (p.allies || []).filter(function (a) { return a && !a._downed; }).length);
    if (s.lsUntil > t && s.lsP) add += s.lsP;
    if (f.vsWeak && hasWeak(tgt)) add += f.vsWeak.p;
    if (f.killRush && s.krUntil > t) add += f.killRush.p * N(s.krN);
    if (f.focus && main) { if (s.fT === tgt) s.fN = Math.min(f.focus.k, N(s.fN) + 1); else { s.fT = tgt; s.fN = 0; } add += f.focus.p * N(s.fN); }
    if (main) {
      if (f.stealth && t - s.stealthAt >= f.stealth.t * 10) { add += f.stealth.p; s.stealthAt = t; popFx('st', '隱身'); }
      if (f.iai && kind === 'melee' && t - s.iaiAt >= f.iai.t * 10) { add += f.iai.p; s.iaiAt = t; popFx('iai', '居合'); }
      if (f.blockNext && s.blockReady) { add += f.blockNext.p; s.blockReady = false; }
      if (f.ambush) { var o = mk(tgt); o.amb = o.amb || []; if (o.amb.indexOf(actor) < 0) { o.amb.push(actor); add += f.ambush.p; } }
      if (f.forkRush) { var ofr = mk(tgt); ofr.fr = ofr.fr || new Map(); var nfr = ofr.fr.get(actor) || 0; if (nfr < 3) { ofr.fr.set(actor, nfr + 1); add += f.forkRush.p; } }
      if (f.vr_block_charge && N(s.bc) >= 5) { s.bc = 0; add += 50 * f.vr_block_charge; popFx('bc', '蓄力一擊'); }
      if (f.thirst && hpOf(actor) < mhpOf(actor) * 0.3) s.thirstOn = true; else s.thirstOn = false;
    }
    mult += add / 100; v = v * mult;
    if (!main) return v;
    // 命中時的觸發
    var o2 = mk(tgt);
    if (f.entangle && proc(actor, 'ent', f.entangle.c)) { o2.ent = t + 50; o2.entP = Math.max(o2.ent > t ? N(o2.entP) : 0, f.entangle.p); }
    if (f.curse && proc(actor, 'cur', f.curse.c)) { if (!((o2.curse || 0) > t)) o2.curseAt = t; o2.curse = t + 80; o2.curseP = Math.max(N(o2.curseP), f.curse.p); }
    if (f.vr_curse_drain && (o2.curse || 0) > t) heal(actor, v * 0.01 * f.vr_curse_drain);
    if (f.blind && proc(actor, 'bli', f.blind.c)) { o2.blind = t + 50; o2.blindP = Math.max(N(o2.blindP), f.blind.p); }
    if (f.control && !tgt.boss && proc(actor, 'ctl', f.control.c)) { o2.ctl = t + Math.round(f.control.d * 10); }
    if (f.poison && proc(actor, 'poi', f.poison.c)) {
      var mine2 = o2.dots.filter(function (d) { return d.src === actor && d.k === 'poi' && d.until > t; });
      if (mine2.length < f.poison.k) o2.dots.push({ src: actor, k: 'poi', until: t + 80, per: panel(actor) * f.poison.p / 100 });
      else { mine2.sort(function (a, b) { return a.until - b.until; }); mine2[0].until = t + 80; }
    }
    if (f.mpSteal && isPlayer(actor) && proc(actor, 'mps', f.mpSteal.c)) actor.mp = Math.min(N(actor.mmp), N(actor.mp) + Math.round(f.mpSteal.n));
    if (f.lifesteal) heal(actor, v * f.lifesteal.p / 100 * (s.thirstOn ? 1 + f.thirst.p / 100 : 1));
    if (f.acid) { o2.acid = N(o2.acid); if (o2.acid < f.acid.k) { o2.acid++; tgt.ac = N(tgt.ac) + f.acid.p; } }
    if (f.windBlade && proc(actor, 'wbl', f.windBlade.c)) { var wbv = v * f.windBlade.p / 100; setTimeout(function () { hit(tgt, wbv); }, 0); }
    if (f.burnHit && proc(actor, 'brn', f.burnHit.c)) o2.dots.push({ src: actor, k: 'brn', until: t + 50, per: panel(actor) * f.burnHit.p / 100 });
    if (f.vr_weak_drain && hasWeak(tgt) && isPlayer(actor) && t - N(s.wdAt) >= 10) { s.wdAt = t; actor.mp = Math.min(N(actor.mmp), N(actor.mp) + Math.floor(N(actor.mmp) * 0.003 * f.vr_weak_drain)); }
    if (f.double && (kind === 'melee' || kind === 'ranged') && proc(actor, 'dbl', f.double.c)) { var dv = Math.floor(v); setTimeout(function () { hit(tgt, dv); }, 0); }
    if (f.splash && kind === 'magic' && proc(actor, 'spl', f.splash.c)) { var sv = v * f.splash.p / 100; setTimeout(function () { mobs().forEach(function (m) { if (m !== tgt) hit(m, sv); }); }, 0); }
    // ── 補齊遺物 11-19 新機制 ──
    if (f.revenge && s.rev > 0) { v += s.rev * f.revenge.p / 100; s.rev = 0; popFx('rev', '復仇'); }
    if (f.weak) f.weak.forEach(function (o) { if (proc(actor, 'wk' + o.e, o.c)) { setWeak(tgt, o.e, o.p);
      if (f.vr_weak_boom) { o2.wkN = N(o2.wkN) + 1; if (o2.wkN >= 5) { o2.wkN = 0; var bv = panel(actor) * f.vr_weak_boom; setTimeout(function () { hit(tgt, bv); }, 0); popFx('wkb', '弱點引爆'); } }
      if (f.vr_weak_brk) { var cap = Math.round(10 * f.vr_weak_brk), cur = N(o2.wkAc); if (cur < cap) { var addAc = Math.min(cap - cur, Math.round(2 * f.vr_weak_brk)); o2.wkAc = cur + addAc; tgt.ac = N(tgt.ac) + addAc; } } } });
    if (f.execute && !tgt.boss && N(tgt.curHp) - v <= N(tgt.hp) * f.execute.p / 100 && N(tgt.curHp) > v && proc(actor, 'exe', f.execute.c)) { v = N(tgt.curHp); popFx('exe', '斬首'); }
    var bl = o2.bomb; if (bl) for (var bi = 0; bi < bl.length; bi++) if (bl[bi].src === actor) bl[bi].acc += v;
    if (f.bomb && proc(actor, 'bmb', f.bomb.c) && !(bl && bl.some(function (b) { return b.src === actor; }))) { (o2.bomb = o2.bomb || []).push({ src: actor, until: t + 50, acc: 0, p: f.bomb.p, name: f.bomb.name }); BOMB_MOBS.add(tgt); }
    if (f.chain && proc(actor, 'chn', f.chain.c)) { var cv = v * f.chain.p / 100; setTimeout(function () { others(tgt, 2).forEach(function (m) { hit(m, cv); }); }, 0); }
    if (f.echo) { s.echoN = N(s.echoN) + 1; if (s.echoN >= 5) { s.echoN = 0; var ev = v * f.echo.p / 100; setTimeout(function () { hit(tgt, ev); }, 0); } }
    if (f.dmgShield && isPlayer(actor)) { try { X().shield.add(v * f.dmgShield.p / 100, Math.floor(mhpOf(actor) * 0.1)); } catch (e) {} }
    if (f.overkill && v > N(tgt.curHp)) { var ov = (v - N(tgt.curHp)) * f.overkill.p / 100; setTimeout(function () { var nx = others(tgt, 1)[0]; if (nx) hit(nx, ov); }, 0); }
    return v;
  };

  // ── 受到傷害 ──
  var taken = function (ent, dmg, mob, kind) {
    if (!on() || !(dmg > 0) || !ent) return dmg;
    if (!isPlayer(ent) && !isAlly(ent)) return dmg;
    var t = tk(), s = st(ent), p = P();
    if (s.invUntil > t) return 0;
    var raw = dmg;
    if (mob) {
      var o = MK_.get(mob);
      if (o) {
        if ((o.ctl || 0) > t) return 0;
        if ((o.blind || 0) > t && Math.random() * 100 < o.blindP) return 0;
        if ((o.ink || 0) > t && Math.random() * 100 < o.inkP) return 0;
        if ((o.ent || 0) > t) dmg *= 1 - Math.min(60, N(o.entP)) / 100;
        if ((o.web || 0) > t) dmg *= 1 - Math.min(60, N(o.webP)) / 100;
      }
    }
    var pf = fx(p);
    if (isAlly(ent) && pf) {
      if (pf.vr_block_guard && kind === 'phys' && Math.random() * 100 < 5 * pf.vr_block_guard) { popFx('bgd', '護衛格擋'); return 0; }
      if (pf.vow && hpOf(ent) < mhpOf(ent) * 0.3 && t - N(st(p).vowAt) >= pf.vow.cd * 10) { st(p).vowAt = t; p.hp = Math.max(1, N(p.hp) - dmg); popFx('vow', '黑騎士之誓'); return 0; }
    }
    if (mob) { var omc = MK_.get(mob), cbf = teamVar('vr_curse_back'); if (cbf && omc && (omc.curse || 0) > t && Math.random() * 100 < 5 * cbf) { var cbv = dmg; setTimeout(function () { hit(mob, cbv); }, 0); popFx('cbk', '詛咒反噬'); return 0; } }
    // 全隊：你的 HP 每少 25%
    if (pf && pf.lowHpTeam) { var steps = Math.min(3, Math.floor((1 - hpOf(p) / mhpOf(p)) * 4 + 1e-9)); if (steps > 0) dmg *= 1 - pf.lowHpTeam.p * steps / 100; }
    var f = fx(ent);
    if (!f) return dmg;
    if (f.phase && proc(ent, 'pha', f.phase.c)) { popFx('pha', '相位'); return 0; }
    if (f.block && kind === 'phys' && proc(ent, 'blk', f.block.c)) {
      s.blockReady = true; popFx('blk', '格擋');
      if (f.vr_block_thorn && mob && alive(mob)) { var btv = panel(ent) * 0.6 * f.vr_block_thorn; setTimeout(function () { hit(mob, btv); }, 0); }
      if (f.vr_block_charge) s.bc = Math.min(5, N(s.bc) + 1);
      if (f.vr_block_heal) heal(ent, mhpOf(ent) * 0.005 * f.vr_block_heal);
      return 0;
    }
    var cut = 0;
    if (f.share) cut += f.share.p;
    if (f.guard) cut += f.guard.p;
    if (f.physCut && kind === 'phys') cut += f.physCut.p;
    if (f.magicCut && kind === 'magic') cut += f.magicCut.p;
    if (f.bossCut && mob && mob.boss) cut += f.bossCut.p;
    var me = mob && (mob.ele || mob.e);
    if (f.eleCut && me) f.eleCut.forEach(function (o) { if (o.e === me || o.e === 'all') cut += o.p; });
    if (f.lowHpCut && hpOf(ent) < mhpOf(ent) * f.lowHpCut.th / 100) cut += f.lowHpCut.p;
    if (cut) dmg *= 1 - Math.min(50, cut) / 100;
    if (f.bigHitCut && dmg > mhpOf(ent) * f.bigHitCut.th / 100) dmg *= 1 - Math.min(60, f.bigHitCut.p) / 100;
    if (f.eleAbsorb && me) f.eleAbsorb.forEach(function (o) { if ((o.e === me || o.e === 'all') && proc(ent, 'eab' + o.e, o.c)) { var hv = dmg * o.p / 100; setTimeout(function () { heal(ent, hv); }, 0); } });
    if (f.absorb) { var ae = kind === 'magic' ? (W.__afkTakenEle && W.__afkTakenEle !== 'none' ? W.__afkTakenEle : me) : me; if (ae) f.absorb.forEach(function (o) { if (o.e === ae) { var av = dmg * o.p / 100; setTimeout(function () { heal(ent, av); }, 0);
      if (f.vr_absorb_shield && isPlayer(ent)) { try { X().shield.add(av * 0.3 * f.vr_absorb_shield, Math.floor(mhpOf(ent) * 0.2)); } catch (e) {} }
      if (f.vr_absorb_mp && isPlayer(ent)) ent.mp = Math.min(N(ent.mmp), N(ent.mp) + Math.floor(av * 0.2 * f.vr_absorb_mp));
      if (f.vr_absorb_charge) { s.absAcc = N(s.absAcc) + av * f.vr_absorb_charge; if (s.absAcc >= mhpOf(ent) * 0.3) { var aav = s.absAcc; s.absAcc = 0; setTimeout(function () { mobs().forEach(function (m) { hit(m, aav); }); }, 0); popFx('abc', '元素爆發'); } }
      if (f.vr_absorb_share) { var lw = party().filter(function (x) { return x !== ent; }).sort(function (x, y) { return hpOf(x) / mhpOf(x) - hpOf(y) / mhpOf(y); })[0]; if (lw) { var shv = av * 0.5 * f.vr_absorb_share; setTimeout(function () { heal(lw, shv); }, 0); } } } }); }
    if (f.revenge) s.rev = Math.min(mhpOf(ent) * 0.5, N(s.rev) + dmg);
    if (mob && alive(mob)) {
      var om = mk(mob);
      if (f.mirror && kind === 'magic' && proc(ent, 'mir', f.mirror.c)) { var mv = raw * f.mirror.p / 100; setTimeout(function () { hit(mob, mv); }, 0); popFx('mir', '魔鏡'); }
      if (f.thorn && kind === 'phys' && proc(ent, 'thn', f.thorn.c)) om.dots.push({ src: ent, k: 'thn', until: t + 50, per: panel(ent) * f.thorn.p / 100 });
      if (f.reflect && proc(ent, 'ref', f.reflect.c)) { var rv = raw * f.reflect.p / 100; setTimeout(function () { hit(mob, rv); }, 0); }
      if (f.ink && proc(ent, 'ink', f.ink.c)) { om.ink = t + 50; om.inkP = Math.max(N(om.inkP), f.ink.p); }
      if (f.web && proc(ent, 'web', f.web.c)) { om.web = t + 50; om.webP = Math.max(N(om.webP), f.web.p); }
    }
    return dmg;
  };

  // ── 每一刻 ──
  var DOT_MOBS = new Set(), BOMB_MOBS = new Set();
  var tick = function () {
    if (!on()) return;
    var t = tk(), fight = false; try { fight = X().inCombat(); } catch (e) {}
    party().forEach(function (a) {
      var f = fx(a); if (!f) return; var s = st(a);
      if ((f.regen || f.mpRegen) && t - s.regenAt >= 100) {
        s.regenAt = t;
        if (f.regen && hpOf(a) > 0) {
          var amt = mhpOf(a) * f.regen.p / 100 * (f.regenLow && hpOf(a) < mhpOf(a) * 0.5 ? 2 : 1), over = hpOf(a) + amt - mhpOf(a);
          heal(a, amt);
          if (f.overShield && isPlayer(a) && over > 0) { try { var cap0 = Math.floor(mhpOf(a) * f.overShield.p / 100); X().shield.add(over, cap0); } catch (e) {} }
        }
        if (f.mpRegen && isPlayer(a) && N(a.mmp) > 0) a.mp = Math.min(N(a.mmp), N(a.mp) + Math.floor(N(a.mmp) * f.mpRegen.p / 100));
      }
      if (f.mpRescue && isPlayer(a) && N(a.mmp) > 0 && N(a.mp) < N(a.mmp) * f.mpRescue.th / 100 && t - (s.mpResAt || -1e9) >= f.mpRescue.cd * 10) { s.mpResAt = t; a.mp = Math.min(N(a.mmp), N(a.mp) + Math.floor(N(a.mmp) * f.mpRescue.p / 100)); popFx('mpr', '魔力湧泉'); }
      if (f.save && f.save.k === 'invuln' && hpOf(a) > 0 && hpOf(a) < mhpOf(a) * f.save.o.th / 100 && t - s.saveCd >= f.save.o.cd * 10) {
        s.saveCd = t; s.invUntil = t + Math.round(f.save.o.d * 10); popFx('inv' + (isPlayer(a) ? 'p' : 'a'), '無敵');
        note('inv', '<span class="text-amber-300 font-bold">【王者遺物】' + esc(isPlayer(a) ? '你' : (a._allyName || '隊友')) + '短暫無敵 ' + f.save.o.d + ' 秒。</span>');
      }
      if (!fight) return;
      if (f.summon && t - s.sumAt >= 30) {
        s.sumAt = t; var tg = target(), pv = panel(a);
        if (tg && pv > 0) f.summon.forEach(function (o) { sumHit(a, tg, pv * o.p / 100, o.name); });
      }
      if (f.pulse) f.pulse.forEach(function (o, i) {
        var at = s.pulseAt[i] || 0; if (t - at < o.t * 10) return; s.pulseAt[i] = t;
        var pv = panel(a); if (pv > 0) { mobs().forEach(function (m) { hit(m, pv * o.p / 100); }); popFx('pl' + i, o.name); }
      });
      if (f.weakAura) f.weakAura.forEach(function (o, i) {
        s.waAt = s.waAt || {}; if (t - (s.waAt[i] || 0) < o.t * 10) return; s.waAt[i] = t;
        mobs().forEach(function (m) { setWeak(m, o.e, o.p); }); popFx('wa' + i, '弱點領域');
      });
      if (f.starfall) f.starfall.forEach(function (o, i) {
        s.sfAt = s.sfAt || {}; if (t - (s.sfAt[i] || 0) < o.t * 10) return; s.sfAt[i] = t;
        var pv = panel(a); if (pv > 0) { var l = mobs(); for (var j = l.length - 1; j > 0; j--) { var q = Math.floor(Math.random() * (j + 1)), w = l[j]; l[j] = l[q]; l[q] = w; } l.slice(0, 3).forEach(function (m) { hit(m, pv * o.p / 100); }); popFx('sf' + i, o.name); }
      });
      if (f.shadow && t - N(s.shdAt) >= f.shadow.t * 10) { s.shdAt = t; var tgS = target(), pvS = panel(a); if (tgS && pvS > 0) { hit(tgS, pvS * f.shadow.p / 100); popFx('shd', '影分身斬'); } }
      if (f.scarab && t - N(s.scrAt) >= f.scarab.t * 10) { s.scrAt = t; var pvC = panel(a); if (pvC > 0) { mobs().forEach(function (m) { hit(m, pvC * f.scarab.p / 100); setWeak(m, 'rand', 10); }); popFx('scr', '聖甲蟲群'); } }
      if (f.shield && isPlayer(a) && t - s.shieldAt >= f.shield.t * 10) {
        s.shieldAt = t; try { var cap = Math.floor(mhpOf(a) * f.shield.p / 100); X().shield.add(cap, cap); } catch (e) {}
      }
    });
    party().forEach(function (a) { var f = fx(a); if (!f || !f.teamRegen) return; var s = st(a); if (t - N(s.trAt) < f.teamRegen.t * 10) return; s.trAt = t; party().forEach(function (b) { heal(b, mhpOf(b) * f.teamRegen.p / 100); }); });
    // 寵物：幫忙回血、額外施法、自動站起來
    var pf2 = fx(P());
    if (pf2 && (pf2.petHeal || pf2.petCast || pf2.petRevive)) {
      var pets = []; try { pets = typeof petsOutList === 'function' ? petsOutList() : []; } catch (e) {}
      var up = pets.filter(function (pt) { return pt && !pt._downed && N(pt.hp) > 0; }), sP = st(P());
      if (pf2.petHeal && up.length && t - (sP.petHealAt || 0) >= pf2.petHeal.t * 10) { sP.petHealAt = t; party().forEach(function (a) { heal(a, mhpOf(a) * pf2.petHeal.p / 100); }); }
      if (pf2.petCast && up.length && fight && t - (sP.petCastAt || 0) >= pf2.petCast.t * 10) { sP.petCastAt = t; var tg2 = target(), pv2 = panel(P()); if (tg2 && pv2 > 0) { hit(tg2, pv2 * pf2.petCast.p / 100); popFx('pcast', '寵物施法'); } }
      if (pf2.petRevive) pets.forEach(function (pt) {
        if (!pt || !pt._downed) return; var ps = st(pt);
        if (!ps.downAt) ps.downAt = t;
        if (t - ps.downAt >= pf2.petRevive.t * 10 && t - (ps.revAt || -1e9) >= pf2.petRevive.cd * 10) { ps.revAt = t; ps.downAt = 0; try { _petReviveDone(pt, '遺物的力量'); } catch (e) {} }
      });
      pets.forEach(function (pt) { if (pt && !pt._downed) { var ps2 = ST.get(pt); if (ps2) ps2.downAt = 0; } });
    }
    // 印記引爆（5 秒後）
    if (BOMB_MOBS.size && t % 2 === 0) BOMB_MOBS.forEach(function (m) {
      var o = MK_.get(m); if (!o || !o.bomb || !o.bomb.length || !alive(m)) { BOMB_MOBS.delete(m); return; }
      o.bomb = o.bomb.filter(function (b) { if (b.until > t) return true; if (b.acc > 0) { hit(m, b.acc * b.p / 100); popFx('bomb', (b.name || '印記') + '引爆'); } return false; });
      if (!o.bomb.length) BOMB_MOBS.delete(m);
    });
    // 中毒每秒
    if (t % 10 === 0) mobs().forEach(function (m) {
      var o = MK_.get(m); if (!o || !o.dots.length) return;
      o.dots = o.dots.filter(function (d) { return d.until > t; });
      var sum = 0; o.dots.forEach(function (d) { sum += d.per; });
      if (sum > 0) hit(m, sum);
    });
  };

  // ── 打倒怪物、保命 ──
  var kill = function (m0) {
    if (!on()) return; var p = P();
    try { if (m0) { var sp = teamVar('vr_weak_spread'); if (sp && hasWeak(m0)) { var nx = others(m0, 1)[0]; if (nx) setWeak(nx, 'rand', 20 * sp); } var csp = teamVar('vr_curse_spread'), oc = MK_.get(m0), t0 = tk(); if (csp && oc && (oc.curse || 0) > t0) { var nc = others(m0, 1)[0]; if (nc) { var ocn = mk(nc); ocn.curse = t0 + 80; ocn.curseP = Math.max(N(ocn.curseP), N(oc.curseP)); ocn.curseAt = t0; } } } } catch (e) {}
    var f = fx(p); if (!f) return;
    if (f.killHp) heal(p, mhpOf(p) * f.killHp.p / 100);
    if (f.killRush) { var s = st(p), t = tk(); s.krN = s.krUntil > t ? Math.min(f.killRush.k, N(s.krN) + 1) : 1; s.krUntil = t + 80; }
    if (f.killMp && N(p.mmp) > 0) p.mp = Math.min(N(p.mmp), N(p.mp) + Math.floor(N(p.mmp) * f.killMp.p / 100));
  };
  var death = function () {
    if (!on()) return false; var p = P(), f = fx(p); if (!f || !f.save) return false;
    var s = st(p), t = tk(), sv = f.save;
    if (sv.k === 'invuln' || t - s.saveCd < sv.o.cd * 10) return false;
    s.saveCd = t;
    if (sv.k === 'lastStand') { p.hp = 1; s.lsUntil = t + 100; s.lsP = sv.o.p; s.invUntil = t + 5; popFx('ls', '不滅'); note('ls', '<span class="text-amber-300 font-bold">【王者遺物】你撐住了最後一口氣！</span>'); return true; }
    if (sv.k === 'husk') { p.hp = 1; s.invUntil = t + Math.round(N(sv.o.d) * 10); popFx('hk', '空殼替身'); note('hk', '<span class="text-amber-300 font-bold">【王者遺物】空殼替你擋住了這一下！</span>'); return true; }
    if (sv.k === 'revive') { p.hp = Math.max(1, Math.floor(mhpOf(p) * sv.o.h / 100)); s.invUntil = t + 5; popFx('rv', '再起'); note('rv', '<span class="text-amber-300 font-bold">【王者遺物】你重新站了起來！</span>'); return true; }
    return false;
  };
  var bind = function () {
    var x = X(); if (!x || bind.done) return; bind.done = true;
    x.on('dealt', dealt); x.on('taken', taken); x.on('tick', tick); x.on('kill', kill); x.on('death', death);
  };
  bind(); W.addEventListener('load', bind);

  // ── 金幣、經驗 ──
  var hookEco = function () {
    if (typeof W.dollFieldVal === 'function' && !W.dollFieldVal.__afkBossRelic) {
      var oD = W.dollFieldVal;
      var nD = function (field) { var r = oD.apply(this, arguments); try { if (field === 'goldBonus' && on()) { var f = fx(P()); if (f && f.gold) r = N(r) + f.gold.p; } } catch (e) {} return r; };
      nD.__afkBossRelic = true; W.dollFieldVal = nD; try { (0, eval)('dollFieldVal = window.dollFieldVal'); } catch (e) {}
    }
    var oE = W.__afkTtmiExpMult;
    if (!(oE && oE.__afkBossRelic)) {
      var nE = function (a) { var r = typeof oE === 'function' ? N(oE.apply(this, arguments)) || 1 : 1; try { if (on()) { var f = fx(P()); if (f && f.exp) r *= 1 + f.exp.p / 100; } } catch (e) {} return r; };
      nE.__afkBossRelic = true; W.__afkTtmiExpMult = nE;
    }
  };
  hookEco(); W.addEventListener('load', hookEco);

  W.__afkBossRelic = { LIST2: LIST2, MOBN: MOBN, FILL: FILL, _tick: tick, _kill: kill, _panel: panel, addEvo: addEvo, EVO: EVO, evoText: evoText, _death: death, _taken: taken, _dealt: dealt, LIST: LIST, BASE: BASE, BY: BY, KEYS: KEYS, tier: tier, val: val, fx: fx, text: fxText, STAGE_N: STAGE_N, TXT: TXT, RATE: RATE };
})();
