/* ============================================================================
 * afk-lore-main.js — 主線劇情「紅獅之誓」（Lv10～55）＋通緝犯 庫傑（玩家 2026-10-29；企劃 docs/lore-expansion-plan.md B1、C1）
 *
 *   「紅獅之誓」：說話之島 甘特 發派 7 章（企劃原本 5～7 章由各城特羅斯發派；特羅斯是血盟 NPC，改成甘特轉達，同一個視窗看完整條線）。
 *     1 Lv10 紅獅的遺劍　　說話之島周邊／妖魔部落　妖魔鬥士、妖魔法師、妖魔槍兵　　生鏽的紅獅紋章 ×5　　→ 紅獅見習披風
 *     2 Lv15 血的誓約　　　墓園　　　　　　　　　　士兵的怨靈、怨靈(男)、怨靈(女)　誓約騎士的遺書 ×6　　→ 紅獅王的守護
 *     3 Lv20 黑騎士的影子　黑騎士前哨基地　　　　　黑騎士、精英黑騎士　　　　　　　黑騎士團的處刑名冊 ×5 → 紅獅王的守護（＋金幣 5 萬）
 *     4 Lv25 港口的幽靈船　船舶之墓　　　　　　　　深海殭屍、船舶之墓殭屍、惡靈　　幽靈船的航海日誌 ×5  → 血盟徽記
 *     5 Lv35 月光騎士　　　鏡子森林　　　　　　　　變形怪、多眼怪、蛇女　　　　　　月光花瓣 ×5　　　　　→ 月光騎士手套
 *     6 Lv45 王后的眼淚　　傲慢之塔 41～50 樓　　　火焰之魔法師、骨龍、幼龍　　　　佳蒂亞的書信 ×5　　 → 紅獅王的守護
 *     7 Lv55 王子歸來　　　傲慢之塔 41～60 樓　　　反王肯恩　　　　　　　　　　　　反王的王冠碎片 ×1　　→ 紅獅王的指環（王族另得 紅獅王冠）
 *     紅獅套裝（見習披風、血盟徽記、月光騎士手套、紅獅王的指環）：2 件 最大 HP +60；3 件 再 額外命中 +2、魔防 +5；4 件 再 額外傷害 +2、最大 HP +80
 *     （比亞丁近衛裝好：同部位數值較高，可一般強化）
 *   通緝犯 庫傑（Lv22 頭目，說話之島周邊或北島，每 30 分鐘出現一次、只在其中一張圖）：
 *     偷襲（出場 3 秒內傷害 ×2）、煙霧彈（每 20 秒，5 秒內打他的傷害 −30%）、逃跑（HP 30% 消失 10 秒，回來時 HP +10%，一次）
 *     掉落：懸賞金 5 萬金幣、庫傑的匕首 20%、強盜頭目的掉落表
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'loremain', name: '主線劇情「紅獅之誓」與通緝犯庫傑', group: '遊戲內容',
    desc: '說話之島甘特發派的王族主線 Lv10～55（7 章，獎勵紅獅套裝）；說話之島周邊／北島每 30 分鐘出現通緝犯庫傑' });
  if (T && !T.enabled('loremain')) return;
  if (!L) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var IC = function (p) { return 'assets/icons/' + p + '.png'; };

  // ── 獎勵裝備 ──
  var SET_TXT = '【紅獅套裝】2 件：最大 HP +60；3 件：再 額外命中 +2、魔防 +5；4 件：再 額外傷害 +2、最大 HP +80。';
  var gear = {
    afk_lion_cloak: { n: '紅獅見習披風', type: 'arm', slot: 'cloak', ac: 4, mr: 8, hpR: 3, safe: 6, req: 'all', img: IC('armors/保護者斗篷'), d: '杜克‧德比年輕時穿過的見習騎士披風，繡著紅髮獅子。AC 4、魔防 +8、HP 自然恢復 +3。' },
    afk_lion_badge: { n: '血盟徽記', type: 'acc', slot: 'amulet', ac: 2, mr: 6, mhp: 80, extraHit: 1, safe: 5, req: 'all', img: IC('accessories/守護項鍊'), d: '五名誓約騎士立下血的誓約時佩戴的徽記。AC 2、魔防 +6、最大 HP +80、額外命中 +1。' },
    afk_lion_gloves: { n: '月光騎士手套', type: 'arm', slot: 'gloves', ac: 4, extraHit: 3, er: 2, safe: 6, req: 'all', img: IC('armors/影子手套'), d: '朱利安留給特羅斯的手套，滿月時會微微發光。AC 4、額外命中 +3、迴避 +2。' },
    afk_lion_ring: { n: '紅獅王的指環', type: 'acc', slot: 'ring', ac: 2, mr: 5, mhp: 100, extraDmg: 2, extraHit: 2, safe: 5, req: 'all', img: IC('accessories/哈維戒指'), d: '杜克‧德比的王者指環，特羅斯把它交給了一路保護他的人。AC 2、魔防 +5、最大 HP +100、額外傷害 +2、額外命中 +2。' },
    afk_lion_crown: { n: '紅獅王冠', type: 'arm', slot: 'helm', ac: 5, mr: 10, mhp: 120, extraHit: 2, safe: 4, req: 'royal', img: IC('armors/騎士面甲'), d: '亞丁王族的王冠——只有真正的王族戴得上。王族專用：AC 5、魔防 +10、最大 HP +120、額外命中 +2。' }
  };
  Object.keys(gear).forEach(function (id) { var g = gear[id]; g.c = 'text-red-300'; g.p = 50000; if (id !== 'afk_lion_crown') g.d += SET_TXT; L.addItem(id, g); });
  L.defineSet({ name: '紅獅套裝', ids: ['afk_lion_cloak', 'afk_lion_badge', 'afk_lion_gloves', 'afk_lion_ring'], tiers: [[2, { mhp: 60 }], [3, { extraHit: 2, mr: 5 }], [4, { extraDmg: 2, mhp: 80 }]] });
  var GUARD = DB.items.afk_kurt_guard ? 'afk_kurt_guard' : null;

  // ── 紅獅之誓 ──
  L.defineLine({
    id: 'redlion', name: '紅獅之誓', hostIds: ['npc_gunter'], hostN: '甘特',
    intro: '「杜克‧德比——紅髮的獅子——是我這輩子唯一的王。他死後，篡位者奪走了一切，連他的血脈都要斬盡。你願意聽完這個故事嗎？」',
    outro: '「特羅斯已經回到亞丁。肯恩逃進了王城地底的密室——亞丁的近衛隊長雷歐正在追查他，去亞丁找雷歐吧（亞丁的陰影）。」',
    chapters: [
      { lv: 10, title: '紅獅的遺劍', map: '說話之島周邊、妖魔部落', story: '甘特說起紅髮的獅子杜克‧德比：他結束了戰亂，卻在王子特羅斯三歲那年早逝。島上的妖魔拾走了紅獅騎士團留下的紋章——先把它們找回來。',
        reqs: [{ id: 'afk_q_lion_crest', n: '生鏽的紅獅紋章', img: IC('items/法令軍團印記'), d: '杜克‧德比的紅獅騎士團紋章，被妖魔當成戰利品掛在腰上。', need: 5, mobs: ['妖魔鬥士', '妖魔法師', '妖魔槍兵'] }],
        rewards: { all: ['afk_lion_cloak'] }, first: [['scroll_armor_b', 1]] },
      { lv: 15, title: '血的誓約', map: '墓園', story: '杜克與五名騎士立下「血的誓約」——流盡最後一滴血才結束。篡位之後，誓約騎士一個接一個死於魔女賽尼斯的詛咒。墓園的怨靈手裡，還握著他們沒寄出的遺書。',
        reqs: [{ id: 'afk_q_lion_will', n: '誓約騎士的遺書', img: IC('items/兒子的信'), d: '誓約騎士臨死前寫下的遺書，紙上留著乾掉的血。', need: 6, mobs: ['士兵的怨靈', '怨靈(男)', '怨靈(女)'] }],
        rewards: { all: GUARD ? [GUARD] : [] }, first: [['scroll_armor_b', 2]] },
      { lv: 20, title: '黑騎士的影子', map: '黑騎士前哨基地', story: '遺書裡反覆出現同一個名字：黑騎士隊長克特。他奉反王之命，要把亞丁王族的血脈斬盡。黑騎士們身上帶著處刑名冊——把它搶回來，看看還有誰在名單上。',
        reqs: [{ id: 'afk_q_lion_list', n: '黑騎士團的處刑名冊', img: IC('items/古老的交易文件'), d: '寫滿王族與忠臣名字的處刑名冊，最後一行是克特的簽名。', need: 5, mobs: ['黑騎士', '精英黑騎士'] }],
        rewards: { all: GUARD ? [GUARD] : [] }, first: [['gold', 50000], ['scroll_weapon_b', 1]] },
      { lv: 25, title: '港口的幽靈船', map: '船舶之墓（說話之島港口外海）', story: '每當有新的王族誕生，說話之島港口外就會出現一艘幽靈船——那是克特的船。沉在船舶之墓的亡者，還留著幽靈船的航海日誌。',
        reqs: [{ id: 'afk_q_lion_log', n: '幽靈船的航海日誌', img: IC('items/古代的卷軸'), d: '被海水泡爛的航海日誌，記著幽靈船每次靠岸的日期——每一天都有一名王族失蹤。', need: 5, mobs: ['深海殭屍', '船舶之墓殭屍(男)', '船舶之墓殭屍(女)', '惡靈'] }],
        rewards: { all: ['afk_lion_badge'] }, first: [['scroll_armor_b', 2]] },
      { lv: 35, title: '月光騎士', map: '鏡子森林', story: '保護特羅斯長大的，是半妖精的月光騎士朱利安。受詛咒的他會在月圓時化成月光仙子歐薇。鏡子森林的魔物吞了月光花——把花瓣帶回來，解開朱利安的詛咒。',
        reqs: [{ id: 'afk_q_lion_petal', n: '月光花瓣', img: IC('items/光明的鱗片'), d: '只在滿月下盛開的花瓣，散發著歐薇身上的氣味。', need: 5, mobs: ['變形怪', '多眼怪', '蛇女'] }],
        rewards: { all: ['afk_lion_gloves'] }, first: [['scroll_weapon_b', 1]] },
      { lv: 45, title: '王后的眼淚', map: '傲慢之塔 41～50 樓', story: '王后佳蒂亞嫁給了篡位者。可她愛的是那個叫阿斯泰的男人，不是王座上的反王。肯恩把她的書信鎖進傲慢之塔——帶回來，交給她的兒子。',
        reqs: [{ id: 'afk_q_lion_letter', n: '佳蒂亞的書信', img: IC('items/感謝信'), d: '王后寫給阿斯泰、從未寄出的書信，字跡被淚水暈開。', need: 5, mobs: ['火焰之魔法師', '骨龍', '幼龍'] }],
        rewards: { all: GUARD ? [GUARD] : [] }, first: [['scroll_weapon_b', 2]] },
      { lv: 55, title: '王子歸來', map: '傲慢之塔 41～60 樓（反王肯恩）', story: '十六歲的特羅斯表明了身分，率領血盟回到亞丁。最後一步：在傲慢之塔擊倒反王肯恩，奪回他頭上的王冠碎片。',
        reqs: [{ id: 'afk_q_lion_crown', n: '反王的王冠碎片', img: IC('items/原石碎片'), d: '從反王肯恩頭上打落的王冠碎片。', need: 1, mobs: ['反王肯恩'] }],
        rewards: { all: ['afk_lion_ring'], royal: ['afk_lion_crown'] }, first: [['scroll_armor_b', 3], ['scroll_weapon_b', 2]] }
    ]
  });

  // ── 通緝犯 庫傑 ──
  var KUZE = 'afk_kuze', KUZE_N = '通緝犯 庫傑', MAPS = ['talking_island', 'ti_north'], EVERY = 30 * 60 * 1000;
  var bb = DB.mobs.bandit_boss || {};
  L.addMob(KUZE, { n: KUZE_N, lv: 22, s: 'S', beh: '主動', race: '人形', boss: true, e: 'none', hp: 4000, ac: -25, mr: 25, exp: 1800, goldMin: 300, goldMax: 900,
    atkSpd: 1, dmg: [2, 18], db: 12, hit: 30, img: bb.img, afkKuze: true,
    mag: { skn: '飛刀', cd: 60, chance: 0.4, dmg: [2, 25], db: 20, ele: 'none' } }, '強盜頭目');
  L.addItem('afk_kuze_dagger', (function () {
    var s = DB.items.wpn_dagger_rasta || DB.items.wpn_dagger2 || {}, d = JSON.parse(JSON.stringify(s));
    ['legend', 'relic', 'p', 'd', 'gachaWeight'].forEach(function (k) { delete d[k]; });
    return Object.assign(d, { n: '庫傑的匕首', type: 'wpn', dmgS: 9, dmgL: 8, hit: 4, extraDmg: 2, spd: 0.6, req: 'all', safe: 6, p: 20000, c: 'text-amber-300', img: IC('weapons/拉斯塔巴德短劍'),
      d: '通緝犯庫傑的愛刀，刀柄上刻著黑騎士團的徽記——他果然是逃兵。小／大傷 9／8、命中 +4、額外傷害 +2。' });
  })());
  try { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[KUZE_N]) MOB_DROPS[KUZE_N] = (MOB_DROPS['強盜頭目'] || []).filter(function (x) { return !/^ttmi_/.test(x[0]) && !((W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items) || []).some(function (id) { return id === x[0]; }); }).map(function (x) { return [x[0], x[1]]; }); } catch (e) {}   // 天堂透視鏡道具不複製
  try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS.wpn_dagger_rasta && !WEAPON_TAGS.afk_kuze_dagger) WEAPON_TAGS.afk_kuze_dagger = WEAPON_TAGS.wpn_dagger_rasta.slice ? WEAPON_TAGS.wpn_dagger_rasta.slice() : WEAPON_TAGS.wpn_dagger_rasta; } catch (e) {}
  var kuzeOn = function () { return (mapState.mobs || []).some(function (m) { return m && m.afkKuze && !m._dead && m.curHp > 0; }); };
  var sched = function (p) { if (!p.afkKuze || typeof p.afkKuze !== 'object') p.afkKuze = { next: Date.now() + 5 * 60 * 1000, map: MAPS[Math.floor(Math.random() * MAPS.length)] }; return p.afkKuze; };
  var away = null;   // { hp, back }：逃跑中
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var p = P(), cur = mapState.current, m = mapState.mobs && mapState.mobs[idx];
        if (p && m && !m.boss && MAPS.indexOf(cur) >= 0 && !kuzeOn() && !away) {
          var s = sched(p);
          if (s.map === cur && Date.now() >= s.next) {
            s.next = Date.now() + EVERY; s.map = MAPS[Math.floor(Math.random() * MAPS.length)];
            var k = L.boss.place(idx, DB.mobs[KUZE], { mobId: KUZE, _kzBorn: tk(), _kzSmokeAt: tk() + 200 });
            L.sys('<span class="font-bold" style="color:#fbbf24">📜 懸賞告示上的通緝犯「庫傑」出現了！（懸賞金 5 萬金幣）</span>');
            try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(k); } catch (e) {}
            try { if (!S().ff) renderMobs(); } catch (e) {}
          }
        }
      } catch (e) { console.warn('[AFK-lore-main] kuze', e); }
      return r;
    };
  }
  var kzTick = function () {
    var t = tk();
    if (away && t >= away.back) {
      if (MAPS.indexOf(mapState.current) >= 0) {
        var ms = mapState.mobs, j = -1, q; for (q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
        if (j < 0) for (q = 0; q < ms.length; q++) if (ms[q] && !ms[q].boss) { j = q; break; }
        if (j >= 0) { var k = L.boss.place(j, DB.mobs[KUZE], { mobId: KUZE, _kzFled: true, _kzBorn: -999, _kzSmokeAt: t + 200 }); k.curHp = Math.min(k.hp, away.hp + Math.round(k.hp * 0.1)); L.clog('<span class="font-bold" style="color:#fbbf24">【逃跑】</span>庫傑從草叢裡跳了出來：「懸賞金？想得美！」'); try { if (!S().ff) renderMobs(); } catch (e) {} }
      }
      away = null;
    }
    (mapState.mobs || []).forEach(function (m, i) {
      if (!m || !m.afkKuze || m._dead || !(m.curHp > 0)) return;
      if (L.boss.halted(m)) { m._kzSmokeAt++; return; }
      if (t >= m._kzSmokeAt) { m._kzSmokeAt = t + 200; m._kzSmokeUntil = t + 50; L.clog('<span class="font-bold" style="color:#a3a3a3">【煙霧彈】</span>庫傑丟出煙霧彈——5 秒內很難打中他（傷害 −30%）。'); }
      if (!m._kzFled && m.curHp <= m.hp * 0.3) { away = { hp: m.curHp, back: t + 100 }; mapState.mobs[i] = null; L.clog('<span class="font-bold" style="color:#fbbf24">【逃跑】</span>庫傑一個翻滾鑽進了草叢——10 秒後他會回來。'); try { if (!S().ff) renderMobs(); } catch (e) {} }
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { kzTick(); } catch (e) { console.warn('[AFK-lore-main] tick', e); } } return r; };
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (mob && mob.afkKuze && mob._kzBorn != null && tk() - mob._kzBorn <= 30) ? 2 : 1; });
  var hooked = false;
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) { var v = o.apply(this, arguments); try { if (v > 0 && target && target.afkKuze && tk() < (target._kzSmokeUntil || 0)) v = Math.floor(v * 0.7); } catch (e) {} return v; };
  };
  hookDmg(); W.addEventListener('load', hookDmg);
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m.afkKuze && !m._kzPaid) {
          m._kzPaid = true; var p = P(); p.gold = (Number(p.gold) || 0) + 50000;
          var got = ['懸賞金 50,000 金幣'];
          if (Math.random() < 0.2) { gainItem('afk_kuze_dagger', 1, true, true); got.push(DB.items.afk_kuze_dagger.n); }
          L.sys('<span class="text-amber-300 font-bold">通緝犯庫傑落網！</span><span class="text-amber-200">' + got.join('、') + '</span>');
        }
      } catch (e) { console.warn('[AFK-lore-main] kuze kill', e); }
      return r;
    };
  }
  W.__afkLoreMain = { KUZE: KUZE, MAPS: MAPS, sched: sched, tick: kzTick, away: function () { return away; } };
})();
