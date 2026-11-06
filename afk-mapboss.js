/* ============================================================================
 * afk-mapboss.js — 地圖王、副本王（設計稿 rift-zodiac-plan 第六節；Ping 11-07 05:18「全部製作」）
 *
 *   地圖王（野外）：在那張地圖打倒 300 隻一般怪後出現；倒下後要再打 300 隻。離開地圖時牠會回去，回來就再出現。
 *   副本王（地監）：進入那一層、待滿 10 分鐘（遊戲時間）後出現；倒下後 30 分鐘（現實時間）才會再出現。
 *   等級＝那張地圖一般怪的最高等級 +5；HP＝同等級地區霸主的 1.5 倍（再 ×(1＋0.15×傭兵數)）。
 *   每隻王兩種招式（見 MECH_D）；打倒得到原型怪的掉落、經驗與金幣 ×3、「王之徽章」×1（收集 30 個換地圖王卡片：之後設計）。
 *   設計稿裡的「獨眼巨人地區」「黑龍的傷痕」「盜賊地區」「沉船之墓」遊戲裡沒有這幾張圖，改放到最接近的地圖；大王烏賊留給次元裂縫副本 D。
 *   次元裂縫的裂縫版（多一個機制、掉次元密奧卡）跟裂縫本體一起做。
 *   經典模式沒有；外掛開關 mapboss。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'mapboss', name: '地圖王、副本王', group: '遊戲內容', desc: '野外打倒 300 隻怪出現地圖王；地監待滿 10 分鐘出現副本王（倒下 30 分鐘重生）；掉王之徽章' });
  if (T && !T.enabled('mapboss')) return;
  if (!L || typeof DB === 'undefined' || !DB.mobs || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var REF = 65, KILLS = 300, DUNGEON_WAIT = 6000, RESPAWN_MS = 30 * 60 * 1000, DUR_MAX = 18000;

  // ── 名單 ── type: field／dungeon；mech 兩個；proto＝外觀與掉落來源；minion＝手下
  var K = [
    { id: 'gorun', type: 'field', maps: ['talking_island'], n: '島嶼的老樹精 哥倫', proto: '石頭高崙', minion: '地靈', race: '植物', e: 'earth', mech: ['summon', 'regen'], lore: '說話之島最老的一棵樹。牠先讓小樹精出來擋路，教冒險者要先清掉小怪。' },
    { id: 'dela', type: 'field', maps: ['zone_01'], n: '墮落的樹妖 黛菈', proto: '卡司特王', minion: '那魯加妖魔', race: '植物', e: 'earth', mech: ['root', 'summon'], lore: '被妖魔森林的汙泥染黑的樹妖，藤蔓會把人纏在原地。' },
    { id: 'sarna', type: 'field', maps: ['elf_forest'], n: '叢林的巨蟒 薩爾納', proto: '蛇女', minion: '萊肯', race: '動物', e: 'earth', mech: ['root', 'poison'], lore: '從奇岩叢林游進妖魔森林的巨蟒，纏住獵物之後慢慢注毒。' },
    { id: 'odi', type: 'field', maps: ['gludio'], n: '叛逃的騎士 歐迪', proto: '黑騎士搜索隊', minion: '骷髏', race: '人類', e: 'none', mech: ['block', 'enrage'], lore: '從古魯丁守備隊叛逃的騎士，盾牌擋下一半的刀劍。' },
    { id: 'kajie', type: 'field', maps: ['windwood'], n: '沙塵的盜賊王 卡傑', proto: '哈維', minion: '蜥蜴人', race: '人類', e: 'wind', mech: ['ambush', 'steal'], lore: '風木一帶的盜賊王。消失在沙塵裡，再從背後出手。' },
    { id: 'kentgen', type: 'field', maps: ['kent'], n: '肯特的斷劍將軍', proto: '長老', minion: '侏儒戰士', race: '人類', e: 'none', mech: ['summon', 'adds'], lore: '肯特城破時沒有撤退的將軍。衛兵還站著，他就不會倒。' },
    { id: 'scar', type: 'field', maps: ['giran'], n: '盜賊團長 刀疤', proto: '強盜頭目', minion: '強盜', race: '人類', e: 'none', mech: ['steal', 'summon'], lore: '奇岩外圍的盜賊團長。會順手摸走一名隊員的金幣，打倒他才拿得回來。' },
    { id: 'melo', type: 'field', maps: ['heine'], n: '潮汐的女巫 梅洛', proto: '蛇女', minion: '鱷魚', race: '亞人', e: 'water', mech: ['quake', 'shieldM'], lore: '海音沼澤的女巫，每隔一陣子就掀起水柱。' },
    { id: 'polly', type: 'field', maps: ['zone_02'], n: '獨眼巨人之王 波利', proto: '獨眼巨人', minion: '冰原狼人', race: '巨人', e: 'earth', mech: ['ambush', 'enrage'], lore: '從奇岩深山走到歐瑞的獨眼巨人之王，投出的巨石能砸倒一名戰士。' },
    { id: 'fenris', type: 'field', maps: ['zone_03'], n: '雪原的冰狼王 芬里斯', proto: '冰原老虎', minion: '冰原狼人', race: '動物', e: 'water', mech: ['summon', 'adds'], lore: '歐瑞雪原的冰狼王，狼群全倒之前，牠不會正面迎戰。' },
    { id: 'saka', type: 'field', maps: ['desert'], n: '流沙的蠍王 薩卡', proto: '毒蠍', minion: '毒蠍', race: '動物', e: 'earth', mech: ['invuln', 'poison'], lore: '沙漠流沙下的蠍王，鑽進沙裡時刀槍不入，出來時一尾巴就是劇毒。' },
    { id: 'karan', type: 'field', maps: ['zone_04', 'zone_05'], n: '不散的戰魂 卡蘭', proto: '艾爾摩將軍', minion: '艾爾摩士兵', race: '不死', e: 'none', mech: ['revive', 'summon'], lore: '艾爾摩激戰地上不肯散去的戰魂，第一次倒下時會再站起來。' },
    { id: 'wag', type: 'field', maps: ['silver_knight'], n: '銀色的狼人 瓦格', proto: '萊肯', minion: '狼人', race: '狼人', e: 'none', mech: ['enrage', 'regen'], lore: '銀騎士村外的狼人頭目，傷口一轉眼就會癒合。' },
    { id: 'red', type: 'field', maps: ['pirate_wild'], n: '海賊船長 黑鬍子雷德', proto: '高等蜥蜴人', minion: '狂暴蜥蜴人', race: '人類', e: 'fire', mech: ['quake', 'steal'], lore: '海賊島的船長，開砲轟得整片海灘都在冒煙。' },
    { id: 'isfi', type: 'field', maps: ['eva_kingdom'], n: '深海的守護者 伊斯菲', proto: '奎斯坦修', minion: '人魚', race: '亞人', e: 'water', mech: ['regen', 'shieldP'], lore: '伊娃王國的守護者，在水裡會一直回復。' },
    { id: 'sphinx', type: 'field', maps: ['thebes_desert'], n: '沙暴的獅身人面', proto: '底比斯 斯芬克斯(黑)', minion: '底比斯 尖碑石奴', race: '底比斯', e: 'earth', mech: ['shieldM', 'shieldP'], lore: '底比斯沙漠的守謎者，輪流張開兩種屏障，答錯的人寸步難行。' },
    { id: 'kuku', type: 'field', maps: ['tikal_area'], n: '羽蛇的祭司 庫庫', proto: '提卡爾艾庫艾托', minion: '提卡爾艾庫阿茲特', race: '提卡爾', e: 'wind', mech: ['invuln', 'summon'], lore: '提卡爾神廟的祭司，祭壇燃起時誰也傷不了他。' },
    { id: 'ronin', type: 'field', maps: ['sunrise_castle'], n: '無名的落武者', proto: '鎌鼬長兄', minion: '嗚釜', race: '妖怪', e: 'none', mech: ['ambush', 'block'], lore: '日出之國城墎裡的落武者。拔刀的那一瞬間，就是最大 HP 的四成。' },
    { id: 'drake', type: 'field', maps: ['dragon_valley'], n: '黑鱗的幼龍', proto: '幼龍', minion: '思克巴', race: '龍', e: 'fire', mech: ['quake', 'enrage'], lore: '龍之谷深處孵出的黑鱗幼龍，吐息一掃就是一整排。' },
    // 副本王
    { id: 'spiderq', type: 'dungeon', maps: ['zone_07'], n: '地底的蜘蛛女王', proto: '楊果里恩', minion: '楊果里恩', race: '蜘蛛', e: 'earth', mech: ['root', 'summon'], lore: '古魯丁地監的蜘蛛女王，蛛網會把人黏在原地。' },
    { id: 'keeper', type: 'dungeon', maps: ['zone_14'], n: '被遺忘的守墓人', proto: '骷髏斧手', minion: '骷髏', race: '不死', e: 'none', mech: ['summon', 'revive'], lore: '說話之島地監最深處的守墓人，一直在召回骷髏。' },
    { id: 'one', type: 'dungeon', maps: ['zone_17'], n: '夢魘的幼龍 歐涅', proto: '幼龍', minion: '那魯加妖魔', race: '龍', e: 'none', mech: ['root', 'enrage'], lore: '眠龍洞穴裡做惡夢的幼龍，會讓一名隊員沉睡。' },
    { id: 'warden', type: 'dungeon', maps: ['zone_21'], n: '奇岩的監獄長', proto: '黑暗精靈', minion: '地獄犬', race: '黑暗妖精', e: 'none', mech: ['curse', 'block'], lore: '奇岩地監的監獄長，鎖鏈會讓整隊一起痛。' },
    { id: 'pharaoh', type: 'dungeon', maps: ['zone_25'], n: '法老的影子', proto: '食人妖精王', minion: '食人妖精', race: '不死', e: 'earth', mech: ['curse', 'summon'], lore: '沙漠地監裡的法老殘影，詛咒讓生命一點一點流走。' },
    { id: 'bone', type: 'dungeon', maps: ['zone_31'], n: '龍骨的守衛', proto: '阿魯巴', minion: '思克巴', race: '不死', e: 'fire', mech: ['shieldP', 'quake'], lore: '龍之谷地監最深處的骨盾守衛。' },
    { id: 'antguard', type: 'dungeon', maps: ['zone_33'], n: '巨蟻的近衛長', proto: '巨大強化白螞蟻', minion: '巨大突擊螞蟻', race: '昆蟲', e: 'earth', mech: ['adds', 'summon'], lore: '螞蟻洞窟的近衛長，兵蟻還活著時幾乎打不動。' },
    { id: 'rat', type: 'dungeon', maps: ['zone_36'], n: '下水道的毒鼠王', proto: '鼠人', minion: '鼠人', race: '動物', e: 'none', mech: ['poison', 'summon'], lore: '地下通道的毒鼠王，毒會一層一層疊上去。' },
    { id: 'golem', type: 'dungeon', maps: ['zone_41'], n: '失控的魔導人偶', proto: '活鎧甲', minion: '影魔', race: '高崙', e: 'none', mech: ['shieldM', 'shieldP'], lore: '象牙塔 8 樓失控的魔導人偶，在物理與魔法護盾之間切換。' },
    { id: 'watcher', type: 'dungeon', maps: ['rastabad_cave3'], n: '暗影的監視者', proto: '黑暗精靈使', minion: '黑暗妖精殘兵(劍)', race: '黑暗妖精', e: 'none', mech: ['ambush', 'curse'], lore: '拉斯塔巴德地下洞穴的監視者，從暗處出手。' }
  ];
  var MECH_N = { summon: '召喚', enrage: '狂暴', quake: '震地', regen: '再生', shieldM: '魔法屏障', shieldP: '物理屏障', root: '纏繞', block: '格擋', ambush: '伏擊', adds: '護衛', steal: '偷竊', revive: '不散', poison: '疊毒', invuln: '遁形', curse: '詛咒' };
  var MECH_D = {
    summon: '每 45 秒，手下少於 2 名時叫 2 名', enrage: 'HP 30% 以下：攻擊速度 ×1.5、造成的傷害 ×1.3', quake: '每 30 秒全隊受到最大 HP 6% 的傷害', regen: '每 10 秒回復最大 HP 2%',
    shieldM: '每 40 秒張開 6 秒：魔法傷害無效', shieldP: '每 40 秒張開 6 秒：物理傷害無效', root: '每 25 秒讓隊伍裡一個人暈眩 3 秒', block: '一般攻擊打牠時 50% 被格擋（傷害減半）',
    ambush: '每 25 秒消失 3 秒，接著對一名隊員造成最大 HP 30% 的傷害', adds: '手下還活著時，受到的傷害 −50%', steal: '每 60 秒偷走你身上 2% 的金幣（最多 100 萬），打倒牠全部拿回',
    revive: '第一次倒下時以 30% HP 站起來', poison: '每 10 秒全隊疊 1 層毒（每層每秒最大 HP 0.3%，最多 10 層），打倒牠就解除', invuln: '每 30 秒遁形 3 秒，期間不受傷害', curse: '每 20 秒全隊受到最大 HP 8% 的傷害'
  };

  // ── 怪物資料 ──
  var protoOf = function (n) { var hit = null; for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n) { hit = k; if (!DB.mobs[k].afkTtmi) break; } return hit; };
  var mobIdByName = function (n) { for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n && !DB.mobs[k].boss) return k; return null; };
  var BADGE = 'afk_mb_badge', BYMAP = {}, BY = {};
  L.addItem(BADGE, { n: '王之徽章', type: 'misc', c: 'text-amber-300', img: 'assets/icons/items/法令軍王徽印.png', p: 0, noSell: true,
    d: '打倒地圖王、副本王得到的徽章。收集 30 個可以換一張地圖王卡片（之後開放）。' });
  K.forEach(function (b) {
    b.mobId = 'afk_mb_' + b.id;
    var pk = protoOf(b.proto), base = pk ? JSON.parse(JSON.stringify(DB.mobs[pk])) : {};
    ['n', 'afkTtmi', 'hard', 'img', 'boss', 'mag', 'mag2', 'mag3', 'transformTo'].forEach(function (k) { delete base[k]; });
    L.addMob(b.mobId, Object.assign(base, { s: 'L', beh: '主動', lv: REF }, { n: b.n, boss: true, race: b.race, e: b.e, hp: 30000, ac: -65, mr: 90, exp: 5000, goldMin: 3000, goldMax: 7000,
      atkSpd: 1.6, dmg: [3, 40], db: 40, hit: 80, afkMb: b.id,
      mag: { skn: b.n.split(' ').pop() + '的重擊', cd: 70, chance: 0.4, dmg: [4, 60], db: 80, ele: b.e, alwaysHit: true } }), b.proto);
    try { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[b.n] && MOB_DROPS[b.proto]) MOB_DROPS[b.n] = MOB_DROPS[b.proto].filter(function (x) { return !(DB.items[x[0]] && DB.items[x[0]].questItem); }).map(function (x) { return x.slice(); }); } catch (e) {}
    b.maps.forEach(function (m) { BYMAP[m] = b; });
    BY[b.id] = b;
  });
  var mapMaxLv = function (id) { var ls = (DB.maps[id] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && !m.boss; }).map(function (m) { return Number(m.lv) || 1; }); return ls.length ? Math.max.apply(null, ls) : 30; };
  var scale = function (base, Lv, hpMult) {
    var k = Lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3))); m.hit = Math.round((base.hit || 0) * k); m.ac = Math.round((base.ac || 0) * k); m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2'].forEach(function (f) { var s = m[f]; if (!s) return; if (Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * k))]; s.db = Math.round((s.db || 0) * Math.pow(k, 1.3)); } });
    m.exp = Math.round((base.exp || 0) * k * k * 3); m.goldMin = Math.round((base.goldMin || 0) * k * 3); m.goldMax = Math.round((base.goldMax || 0) * k * 3);
    return m;
  };
  var allyCount = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };

  // ── 狀態 ──
  var act = null;
  var store = function () { var p = P(); if (!p) return { kills: {}, next: {}, stats: {} }; var s = p.afkMb && typeof p.afkMb === 'object' ? p.afkMb : (p.afkMb = {}); s.kills = s.kills || {}; s.next = s.next || {}; s.stats = s.stats || {}; return s; };
  var stat = function (id) { var s = store().stats; return s[id] || (s[id] = { met: 0, kills: 0 }); };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var busy = function () {
    try { if (W.__afkWorldEvents && W.__afkWorldEvents.active && W.__afkWorldEvents.active()) return true; } catch (e) {}
    try { if (W.__afkRegionBoss && W.__afkRegionBoss.active && W.__afkRegionBoss.active()) return true; } catch (e) {}
    try { if (typeof W.__afkOfflineNow === 'function' && W.__afkOfflineNow()) return true; } catch (e) {}
    var s = S(); return !!(s.riftRun || s._afkFinal || s.antharas || s.prideClimb);
  };
  var onField = function (role) { return (mapState.mobs || []).map(function (m, i) { return [m, i]; }).filter(function (x) { var m = x[0]; return m && act && m._afkMb === act.id && !m._dead && m.curHp > 0 && (role === 'boss' ? m._mbBoss : role === 'minion' ? m._mbMinion : true); }); };
  var has = function (k) { return act && BY[act.id].mech.indexOf(k) >= 0; };
  var slotFor = function () { var ms = mapState.mobs || [], i; for (i = 0; i < ms.length; i++) if (!ms[i] || ms[i]._dead) return i; for (i = 0; i < ms.length; i++) if (ms[i] && !ms[i].boss) return i; return -1; };
  var start = function (b) {
    var idx = slotFor(); if (idx < 0) return false;
    var Lv = Math.max(10, Math.min(130, mapMaxLv(mapState.current) + 5));
    var m = scale(DB.mobs[b.mobId], Lv, 1.5 * (1 + 0.15 * allyCount()));
    var mob = L.boss.place(idx, m, { mobId: b.mobId, _afkMb: b.id, _mbBoss: true, _mbL: Lv });
    if (!mob) return false;
    var t = tk();
    act = { id: b.id, map: mapState.current, born: t, summonAt: t + 150, quakeAt: t + 300, regenAt: t + 100, shieldAt: t + 200, shieldKind: 0, rootAt: t + 250, ambushAt: t + 250, stealAt: t + 600, poisonAt: t + 100, invulnAt: t + 300, curseAt: t + 200, layers: 0, stolen: 0, revived: false, enraged: false };
    stat(b.id).met++;
    try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(mob); } catch (e) {}
    try { if (!S().ff) renderMobs(); } catch (e) {}
    sys('<span class="font-bold" style="color:#fcd34d;text-shadow:0 0 8px #000">👑 ' + (b.type === 'field' ? '地圖王' : '副本王') + '「' + esc(b.n) + '」出現了！</span><span class="text-slate-300">（Lv' + Lv + '，' + b.mech.map(function (k) { return MECH_N[k]; }).join('、') + '）</span>');
    return true;
  };
  var giveBack = function () { var p = P(); if (p && act && act.stolen > 0) { p.gold = (Number(p.gold) || 0) + act.stolen; sys('<span class="text-amber-200">拿回被偷走的金幣 ' + act.stolen.toLocaleString() + '。</span>'); act.stolen = 0; } };
  var end = function (why) {
    if (!act) return;
    var b = BY[act.id];
    onField().forEach(function (x) { if (why !== 'kill' || !x[0]._mbBoss) mapState.mobs[x[1]] = null; });
    try { if (!S().ff) renderMobs(); } catch (e) {}
    if (why === 'kill') giveBack();
    if (why === 'leave') { sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 回到了巢穴。</span>'); if (b.type === 'field') store().kills[b.id] = KILLS; }
    if (why === 'time') sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 不再理會你們，回到了巢穴。</span>');
    act = null;
  };

  // 野外：打倒一般怪計數
  var countKill = function (m) {
    if (!m || m.boss || m._afkMb || classic()) return;
    var b = BYMAP[mapState.current]; if (!b || b.type !== 'field') return;
    var s = store(); s.kills[b.id] = Math.min(KILLS, (s.kills[b.id] || 0) + 1);
  };
  var tryStart = function () {
    if (act || classic() || busy()) return;
    var p = P(); if (!p || p.dead) return;
    var b = BYMAP[mapState.current]; if (!b) return;
    var s = store();
    if (b.type === 'field') { if ((s.kills[b.id] || 0) >= KILLS && start(b)) s.kills[b.id] = 0; return; }
    if (Date.now() < (s.next[b.id] || 0)) return;
    if (S()._mbEnterMap !== mapState.current) { S()._mbEnterMap = mapState.current; S()._mbEnterAt = tk(); return; }
    if (tk() - (S()._mbEnterAt || 0) >= DUNGEON_WAIT) start(b);
  };

  // ── 招式 ──
  var party = function () { return L.boss.party().filter(function (x) { return x && !x.dead && !x._downed; }); };
  var mhpOf = function (x) { return x === P() ? (x.mhp || 1) : (x.mhp || x.curHp || 1); };
  var stun = function (x, ticks) { try { var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (B && B.setStatus) B.setStatus(x, 'stun', ticks, null); else if (x.statuses) x.statuses.stun = ticks; } catch (e) {} };
  var skills = function (m) {
    var t = tk(), b = BY[act.id];
    if (L.boss.halted(m)) { ['summonAt', 'quakeAt', 'regenAt', 'shieldAt', 'rootAt', 'ambushAt', 'stealAt', 'poisonAt', 'invulnAt', 'curseAt'].forEach(function (k) { act[k]++; }); return; }
    if (has('enrage') && !act.enraged && m.curHp <= m.hp * 0.3) { act.enraged = true; m._mbEnraged = true; m.atkSpd = Math.max(0.3, (Number(m.atkSpd) || 1.6) / 1.5); clog('<span class="font-bold" style="color:#f87171">【狂暴】</span>' + esc(m.n) + ' 怒吼起來——攻擊速度 ×1.5、傷害 ×1.3！'); }
    if (has('summon') && t >= act.summonAt) { act.summonAt = t + 450; var mid = mobIdByName(b.minion); if (mid && onField('minion').length < 2) { var n = L.boss.summon(mid, 2, { _afkMb: act.id, _mbMinion: true }); if (n) clog('<span class="font-bold" style="color:#fcd34d">【召喚】</span>' + esc(m.n) + ' 叫來了 ' + n + ' 名' + esc(b.minion) + '。'); } }
    if (has('quake') && t >= act.quakeAt) { act.quakeAt = t + 300; party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.06); }); clog('<span class="font-bold" style="color:#fb923c">【震地】</span>' + esc(m.n) + '——全隊受到最大 HP 6% 的傷害。'); }
    if (has('curse') && t >= act.curseAt) { act.curseAt = t + 200; party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.08); }); clog('<span class="font-bold" style="color:#c084fc">【詛咒】</span>' + esc(m.n) + '——全隊受到最大 HP 8% 的傷害。'); }
    if (has('regen') && t >= act.regenAt) { act.regenAt = t + 100; if (m.curHp < m.hp) m.curHp = Math.min(m.hp, m.curHp + Math.ceil(m.hp * 0.02)); }
    if ((has('shieldM') || has('shieldP')) && t >= act.shieldAt) {
      act.shieldAt = t + 400; var kinds = ['shieldM', 'shieldP'].filter(has), k = kinds[act.shieldKind++ % kinds.length], magic = k === 'shieldM';
      m._reflectWall = { kind: magic ? 'magic' : 'phys', until: t + 60, block: true, afkRb: true };
      clog('<span class="font-bold" style="color:#a78bfa">【' + MECH_N[k] + '】</span>' + esc(m.n) + ' 張開了' + MECH_N[k] + '——6 秒內' + (magic ? '魔法' : '物理') + '傷害無效。');
    }
    if (has('root') && t >= act.rootAt) { act.rootAt = t + 250; var ps = party(), v = ps[Math.floor(Math.random() * ps.length)]; if (v) { stun(v, 30); clog('<span class="font-bold" style="color:#86efac">【纏繞】</span>' + esc(m.n) + ' 困住了 ' + esc(v === P() ? '你' : (v._allyName || '傭兵')) + '（3 秒）。'); } }
    if (has('ambush')) {
      if (!act.hideUntil && t >= act.ambushAt) { act.hideUntil = t + 30; clog('<span class="font-bold" style="color:#94a3b8">【伏擊】</span>' + esc(m.n) + ' 消失了……'); }
      else if (act.hideUntil && t >= act.hideUntil) { act.hideUntil = 0; act.ambushAt = t + 250; var ps2 = party(), v2 = ps2[Math.floor(Math.random() * ps2.length)]; if (v2) { L.boss.hurt(v2, mhpOf(v2) * 0.3); clog('<span class="font-bold" style="color:#f87171">【伏擊】</span>' + esc(m.n) + ' 從背後出手——' + esc(v2 === P() ? '你' : (v2._allyName || '傭兵')) + ' 受到最大 HP 30% 的傷害！'); } }
    }
    if (has('steal') && t >= act.stealAt) { act.stealAt = t + 600; var p = P(), g = Math.min(1000000, Math.floor((Number(p.gold) || 0) * 0.02)); if (g > 0) { p.gold -= g; act.stolen += g; clog('<span class="font-bold" style="color:#fcd34d">【偷竊】</span>' + esc(m.n) + ' 摸走了 ' + g.toLocaleString() + ' 金幣（打倒牠就拿得回來）。'); } }
    if (has('poison')) {
      if (t >= act.poisonAt) { act.poisonAt = t + 100; act.layers = Math.min(10, act.layers + 1); }
      if (act.layers && t % 10 === 0) party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.003 * act.layers); });
    }
    if (has('invuln') && t >= act.invulnAt) { act.invulnAt = t + 300; act.invulnUntil = t + 30; clog('<span class="font-bold" style="color:#94a3b8">【遁形】</span>' + esc(m.n) + ' 遁形了——3 秒內不受傷害。'); }
  };
  var step = function () {
    if (!act) { if (tk() % 10 === 0) tryStart(); return; }
    if (mapState.current !== act.map) { end('leave'); return; }
    var bb = onField('boss')[0]; if (!bb) { end('leave'); return; }
    if (tk() - act.born > DUR_MAX) { end('time'); return; }
    skills(bb[0]);
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-mapboss] tick', e); } } return r; };
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return mob && mob._mbEnraged && mob._afkMb ? 1.3 : 1; });
  // 對王造成的傷害：格擋、護衛、遁形、伏擊中
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) {
      try {
        if (target && target._mbBoss && act && target._afkMb === act.id && amount > 0) {
          var t = tk();
          if ((act.invulnUntil || 0) > t || (act.hideUntil || 0) > t) amount = 1;
          else {
            if (has('block') && opt && opt.packet && Math.random() < 0.5) amount = amount * 0.5;
            if (has('adds') && onField('minion').length) amount = amount * 0.5;
          }
        }
      } catch (e) {}
      return o.call(this, actor, target, Math.max(1, Math.floor(amount)), opt);
    };
    return true;
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }
  // 擊殺
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, wasDead = !!(m && m._dead);
      if (m && !wasDead && m._mbBoss && act && m._afkMb === act.id && has('revive') && !act.revived) {
        act.revived = true; m.curHp = Math.ceil(m.hp * 0.3);
        clog('<span class="font-bold" style="color:#fcd34d">【不散】</span>' + esc(m.n) + ' 又站了起來！'); return;
      }
      var r = oKill.apply(this, arguments);
      try {
        if (m && !wasDead) countKill(m);
        if (m && m._dead && m._mbBoss && !m._mbPaid && act && m._afkMb === act.id) {
          m._mbPaid = true; var b = BY[act.id];
          gainItem(BADGE, 1, true, true); stat(act.id).kills++;
          if (b.type === 'dungeon') store().next[b.id] = Date.now() + RESPAWN_MS;
          sys('<span class="font-bold" style="color:#fcd34d">👑 ' + esc(b.n) + ' 倒下了！</span><span class="text-amber-300">得到 王之徽章 ×1</span>');
          end('kill');
        }
      } catch (e) { console.warn('[AFK-mapboss] kill', e); }
      return r;
    };
  }

  W.__afkMapBoss = { LIST: K, BY: BY, BYMAP: BYMAP, MECH_N: MECH_N, MECH_D: MECH_D, KILLS: KILLS, active: function () { return act; }, store: store, stats: stat, start: function (id) { var b = BY[id]; return b ? start(b) : false; }, end: end, step: step };
  try { console.log('[AFK-mapboss] 已載入：地圖王 ' + K.filter(function (x) { return x.type === 'field'; }).length + ' 隻、副本王 ' + K.filter(function (x) { return x.type === 'dungeon'; }).length + ' 隻'); } catch (e) {}
})();
