/* ============================================================================
 * afk-awaken-transfer.js — 覺醒轉職（方案 B；Ping 11-15 05:23 選 B、05:48 定魂魄與數值；設計稿 Projects claude/awaken-transfer-relic-1115.md）
 *
 *   ‧覺醒導師 伊瑟拉 →「覺醒轉職」：五個覺醒職業各 3 條融合流派，每條三段；每段一個被動＋一招大絕（戰鬥中自動施放，冷卻 60 秒）。
 *   ‧條件：第一段 Lv50、第二段 1 轉、第三段 2 轉（跟覺醒進化一樣）。跟覺醒進化永久二選一，選定流派後不能換。
 *   ‧每段魂魄：本職 0 轉、1 轉、2 轉 Lv100 各一顆，再加這個覺醒職業 Lv100 魂魄一顆（第一段 0 轉、第二段 1 轉、第三段 2 轉）。
 *     覺醒職業的魂魄只能拿來交覺醒轉職。
 *   ‧被動、大絕走 afk-awaken-ext 的進化引擎（ext 的 evo() 會讀這裡的 TROUTES）。
 *   ‧要 afk-awaken.js、afk-awaken-ext.js 先載入。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, A = W.__afkAwaken, E = W.__afkAwakenExt;
  if (!A || !A.api || !E || !E.TROUTES) return;
  var X = A.api, N = function (v) { return Number(v) || 0; }, esc = X.esc, P = X.P, st = E.st, now = X.now;
  var CLS = A.CLS;

  // ── 小工具 ──
  var area = function (t) { return X.near(t, 8); };
  var dealArea = function (p, t, sc, o) { var tot = 0; area(t).forEach(function (x, i) { tot += X.deal(p, x, sc, Object.assign({ src: 'transfer', show: i === 0 }, o || {})); }); return tot; };
  var dealOne = function (p, t, sc, o) { return X.deal(p, t, sc, Object.assign({ src: 'transfer' }, o || {})); };
  var B = function (p, k, sec, v) { st(p)['t_' + k] = { u: now() + sec, v: v == null ? 1 : v }; };
  var Bv = function (p, k) { var b = st(p)['t_' + k]; return b && b.u > now() ? b.v : 0; };
  var ranged = function (m) { return !!(m && /弓|射手|弩|投擲|狙擊|槍手/.test(m.n || '')); };
  var meleeHit = function (m, kind) { return kind !== 'magic' && !ranged(m); };
  var isDragon = function (m) { return !!(m && (/安塔瑞斯|法利昂|林德拜爾|巴拉卡斯/.test(m.n || '') || /^(龍|飛龍|龍龜)$/.test(m.race || ''))); };
  var api = function () { return W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; };
  var WEAKS = ['fire', 'water', 'wind', 'earth'];
  var weak = function (m, ele, sec) { try { var a = api(); if (a && X.alive(m)) a.status(m, ele + 'Vulnerability', sec || 5, 0.2); } catch (e) {} };
  var hasWeak = function (m) { try { var a = api(); return !!(a && m && WEAKS.some(function (e) { return a.hasStatus(m, e + 'Vulnerability'); })); } catch (e) { return false; } };
  var shocked = function (t) { try { return !!(t && A.ms(t).shockUntil > now()); } catch (e) { return false; } };
  var THUNDER_SRC = /^(chain|bolt|shock|arrow|static|flash|tempest|ragnarok|potential|storm|transfer)$/;
  var party = function (p) { var me = P(); return me ? [me].concat((me.allies || []).filter(Boolean)) : [p]; };
  var healParty = function (p, frac) { party(p).forEach(function (a) { if (a && !a._downed && !a.dead) X.heal(a, N(a.mhp) * frac); }); };
  var counter = function (p, mob, sc) { if (X.alive(mob)) dealOne(p, mob, sc, { show: false }); };

  // 每個流派的「全隊」被動（給 afk-procfx 的 dealt／taken 讀）
  var S = function (p, u, ult, ex) { var o = { p: p, u: u, ult: ult }; if (ex) Object.keys(ex).forEach(function (k) { o[k] = ex[k]; }); return o; };

  var ROUTES = {
    berserker: {
      iron: { n: '鐵血破城者', donor: 'knight', d: '坦', s: [
        S('HP 每少 10%，受到的每一下傷害少 2 點（最多 16）', '城牆粉碎：全場 400%，昏迷 2 秒（王改成易傷）',
          function (p, t) { area(t).forEach(function (x, i) { dealOne(p, x, 4, { show: i === 0 }); X.stun(p, x, 2); }); },
          { taken: function (p, dmg) { var k = Math.min(16, 2 * Math.floor((1 - N(p.hp) / Math.max(1, N(p.mhp))) * 10)); return Math.max(0, dmg - Math.max(0, k)); } }),
        S('受到的近距離傷害 −10%', '鐵血壁壘：12 秒內受到的傷害 −40%，被打就反擊 100%',
          function (p) { B(p, 'taken', 12, 0.4); B(p, 'counter', 12, 1); },
          { taken: function (p, dmg, mob, kind) { return meleeHit(mob, kind) ? dmg * 0.9 : dmg; } }),
        S('最大 HP +15%；HP 低於 30% 時每一下再少 10 點', '破城者：單體 800%，目標 10 秒內受到的物理傷害 +20%',
          function (p, t) { dealOne(p, t, 8); X.deb(t, 'drDown', 0.2, 10); },
          { stat: function (p) { return N(p.mhp) * 0.15; }, taken: function (p, dmg) { return N(p.hp) < N(p.mhp) * 0.3 ? Math.max(0, dmg - 10) : dmg; } })] },
      banner: { n: '血戰旗主', donor: 'royal', d: '全隊', s: [
        S('全隊近距離攻擊每下 +5 傷害', '血旗衝鋒：全場 350%，全隊 10 秒內造成的傷害 +15%',
          function (p, t) { dealArea(p, t, 3.5); B(p, 'pdmg', 10, 0.15); }, { party: { melee: 5 } }),
        S('戰鬥中每 10 秒，HP 沒滿就疊 1 層：全隊造成的傷害 +3%（最多 5 層，離開戰鬥歸零）', '戰旗高舉：15 秒內全隊造成的傷害 +25%',
          function (p) { B(p, 'pdmg2', 15, 0.25); }, { party: { banner: 1 } }),
        S('全隊吸血 3%', '王的血誓：全隊回復最大 HP 30%，10 秒內全隊受到的傷害 −20%',
          function (p) { healParty(p, 0.3); B(p, 'ptaken', 10, 0.2); }, { party: { leech: 0.03 } })] },
      dragon: { n: '龍血狂斧', donor: 'dragon', d: '吸血爆發', s: [
        S('一般攻擊吸血 5%', '龍血旋風：全場 400%，傷害的 20% 轉成 HP',
          function (p, t) { X.heal(p, dealArea(p, t, 4) * 0.2); }, { hit: function (p, t, v) { X.heal(p, v * 0.05); } }),
        S('對龍系 +20%', '龍血沸騰：10 秒內造成的傷害 ×1.6，每秒失去最大 HP 3%',
          function (p) { B(p, 'dmg', 10, 0.6); B(p, 'drain', 10, 0.03); }, { dealt: function (p, t) { return isDragon(t) ? 1.2 : 1; } }),
        S('近距離爆擊傷害 +30%', '屠龍斧：單體 800%，對龍系再 ×1.5',
          function (p, t) { dealOne(p, t, isDragon(t) ? 12 : 8); }, { stat: function (p, d) { d.meleeCritDmg = N(d.meleeCritDmg) + 30; } })] }
    },
    thunder: {
      wind: { n: '風雷射手', donor: 'elf', d: '風雷連鎖', s: [
        S('拿矛時近距離傷害 +10', '天雷之矢：單體 600% 風屬性',
          function (p, t) { dealOne(p, t, 6, { magic: true, ele: 'wind' }); }, { stat: function (p, d) { if (/矛/.test(X.wpnFam(p) || '')) d.meleeDmg += 10; } }),
        S('鎖鏈閃光多打 1 隻', '疾風連射：5 秒內每秒對隨機 3 隻 150%',
          function (p) { B(p, 'volley', 5, 1); }, { chain: 1 }),
        S('近距離爆擊 +10%', '風神之怒：全場 500%，打中的目標風屬性弱點 5 秒',
          function (p, t) { area(t).forEach(function (x, i) { dealOne(p, x, 5, { magic: true, ele: 'wind', show: i === 0 }); weak(x, 'wind', 5); }); }, { stat: function (p, d) { d.meleeCrit += 10; } })] },
      sage: { n: '雷霆賢者', donor: 'mage', d: '魔法', s: [
        S('雷系技能傷害 +20%', '萬雷審判：全場 400% 雷擊 2 次',
          function (p, t) { for (var i = 0; i < 2; i++) dealArea(p, t, 4, { magic: true, ele: 'wind' }); }, { skillf: function (p, src) { return THUNDER_SRC.test(src) ? 1.2 : 1; } }),
        S('魔法爆擊 +10%', '雷之魔導：12 秒內技能冷卻 −50%',
          function (p) { B(p, 'cdhalf', 12, 1); }, { stat: function (p, d) { d.magicCrit = N(d.magicCrit) + 10; } }),
        S('施法間隔 −10%', '天譴：全場 800%，觸電的目標再 ×1.5',
          function (p, t) { area(t).forEach(function (x, i) { dealOne(p, x, shocked(x) ? 12 : 8, { magic: true, ele: 'wind', show: i === 0 }); }); }, { cast: 0.10 })] },
      phantom: { n: '幻雷術士', donor: 'illusion', d: '幻影追擊', s: [
        S('打觸電的目標時 20% 機率幻影追擊 100%', '雷幻分身：召喚 2 個分身 15 秒，各複製你一般攻擊的 50%',
          function (p) { B(p, 'clone', 15, 0.5); },
          { hit: function (p, t) { var lv = stageN(p); if (shocked(t) && Math.random() < (lv >= 3 ? 0.35 : 0.2)) dealOne(p, t, lv >= 3 ? 1.5 : 1, { magic: true, ele: 'wind', show: false }); } }),
        S('觸電持續時間 +2 秒', '幻雷迴響：全場 350%，3 秒後再打一次',
          function (p, t) { dealArea(p, t, 3.5, { magic: true, ele: 'wind' }); st(p).t_echoAt = now() + 3; }, { shock: 2 }),
        S('幻影追擊改成 35% 機率、150% 傷害', '鏡雷：12 秒內雷系技能傷害 ×1.5',
          function (p) { B(p, 'mirror', 12, 0.5); })] }
    },
    paladin: {
      oath: { n: '聖誓統帥', donor: 'royal', d: '隊伍光環', s: [
        S('全隊受到的傷害 −5%', '聖誓之陣：12 秒內全隊受到的傷害 −35%',
          function (p) { B(p, 'ptaken', 12, 0.35); }, { party: { taken: 0.05 } }),
        S('你的異常狀態抵抗 +10%', '聖光號令：全隊回復最大 HP 25%，解除負面狀態',
          function (p) { healParty(p, 0.25); party(p).forEach(cleanse); }, { abn: 10 }),
        S('團結的經驗加成 +3%', '天使降臨：15 秒內全隊造成的傷害 +20%、受到的傷害 −20%',
          function (p) { B(p, 'pdmg', 15, 0.2); B(p, 'ptaken', 15, 0.2); }, { unity: 0.03 })] },
      spirit: { n: '精靈聖騎', donor: 'elf', d: '屬性劍', s: [
        S('一般攻擊附加該下 30% 的屬性傷害（照武器屬性）', '四元聖劍：單體四屬性各 200%',
          function (p, t) { WEAKS.forEach(function (e, i) { dealOne(p, t, 2, { magic: true, ele: e, show: i === 0 }); }); },
          { hit: function (p, t, v) { try { var a = api(), e = (typeof getWpnEle === 'function' && p.eq && p.eq.wpn) ? getWpnEle(p.eq.wpn, DB.items[p.eq.wpn.id], p) : 'none'; if (a && X.alive(t)) a.damage(t, Math.floor(v * 0.3), { actor: p, source: 'awk:transfer', type: 'magic', element: e || 'none', origin: 'class', generated: true, direct: true, settle: true }); } catch (er) {} } }),
        S('對屬性弱點的目標 +15%', '元素審判：全場 400%，每隻隨機陷入一種屬性弱點 5 秒',
          function (p, t) { area(t).forEach(function (x, i) { dealOne(p, x, 4, { magic: true, show: i === 0 }); weak(x, WEAKS[Math.floor(Math.random() * 4)], 5); }); }, { dealt: function (p, t) { return hasWeak(t) ? 1.15 : 1; } }),
        S('四屬性抗性 +50', '精靈王之劍：15 秒內一般攻擊全部算屬性弱點',
          function (p) { B(p, 'elem', 15, 1); }, { stat: function (p, d) { ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { d[k] = N(d[k]) + 50; }); } })] },
      radiant: { n: '光輝術劍', donor: 'mage', d: '聖光魔法', s: [
        S('審判傷害 +30%', '天光審判：全場 450% 魔法',
          function (p, t) { dealArea(p, t, 4.5, { magic: true }); }, { skillf: function (p, src) { return src === 'judge' ? 1.3 : 1; } }),
        S('魔法傷害 +10%', '聖光之雨：8 秒內每秒全場 120% 魔法',
          function (p) { B(p, 'rain', 8, 1.2); }, { dealt: function (p, t, v, o) { return o && o.kind === 'magic' ? 1.1 : 1; } }),
        S('對不死、惡魔 +30%', '神罰：單體 900% 魔法，昏迷 2 秒（王改成易傷）',
          function (p, t) { dealOne(p, t, 9, { magic: true }); X.stun(p, t, 2); }, { dealt: function (p, t) { return t && /不死|惡魔/.test(String(t.race || '')) ? 1.3 : 1; } })] }
    },
    darkknight: {
      steel: { n: '黑鋼守衛', donor: 'knight', d: '反擊', s: [
        S('迴避成功時反擊 150%', '黑鋼反擊：10 秒內被打就反擊 200%',
          function (p) { B(p, 'counter', 10, 2); }, { evade: 1.5 }),
        S('受到的近距離傷害 −10%', '鋼之意志：12 秒內受到的傷害 −40%',
          function (p) { B(p, 'taken', 12, 0.4); }, { taken: function (p, dmg, mob, kind) { return meleeHit(mob, kind) ? dmg * 0.9 : dmg; } }),
        S('反擊的傷害 ×1.5', '黑鋼斷罪：單體 700%，對剛打過你的目標再 ×1.5',
          function (p, t) { dealOne(p, t, st(p).t_lastMob === t ? 10.5 : 7); })] },
      curse: { n: '闇咒劍士', donor: 'mage', d: '闇魔法劍氣', s: [
        S('暗黑之劍的劍氣傷害 +30%', '深淵劍雨：全場 400% 魔法',
          function (p, t) { dealArea(p, t, 4, { magic: true }); }, { skillf: function (p, src) { return /^(swordwave|revsword)$/.test(src) ? 1.3 : 1; } }),
        S('魔法命中 +10', '闇之詛咒：全場 10 秒內受到的傷害 +20%',
          function (p, t) { area(t).forEach(function (x) { X.deb(x, 'vuln', 0.2, 10); }); }, { stat: function (p, d) { d.magicHit = N(d.magicHit) + 10; } }),
        S('一般攻擊時劍氣多打 1 隻（35%）', '終焉劍：全場 700% 魔法',
          function (p, t) { dealArea(p, t, 7, { magic: true }); }, { hit: function (p, t) { var o = X.near(t, 2)[1]; if (o) X.deal(p, o, 0.35, { src: 'swordwave', show: false }); } })] },
      drake: { n: '闇龍劍魂', donor: 'dragon', d: '吸血龍魔法', s: [
        S('吸血 4%', '闇龍吐息：全場 400%，傷害 15% 轉成 HP',
          function (p, t) { X.heal(p, dealArea(p, t, 4, { magic: true }) * 0.15); }, { hit: function (p, t, v) { X.heal(p, v * 0.04 * (Bv(p, 'leech2') ? 2 : 1)); } }),
        S('對龍系 +20%', '龍魂附身：12 秒內造成的傷害 ×1.5、吸血 ×2',
          function (p) { B(p, 'dmg', 12, 0.5); B(p, 'leech2', 12, 1); }, { dealt: function (p, t) { return isDragon(t) ? 1.2 : 1; } }),
        S('HP 低於 50% 時造成的傷害 +20%', '闇龍天降：單體 900%',
          function (p, t) { dealOne(p, t, 9); }, { dealt: function (p) { return N(p.hp) < N(p.mhp) * 0.5 ? 1.2 : 1; } })] }
    },
    runeblade: {
      rune: { n: '符文大師', donor: 'mage', d: '符石魔法', s: [
        S('符石爆裂傷害 +30%', '符文風暴：全場 400% 魔法',
          function (p, t) { dealArea(p, t, 4, { magic: true }); }, { skillf: function (p, src) { return src === 'rburst' ? 1.3 : 1; } }),
        S('符石爆裂多放 1 次（傷害 ×2）', '符文刻印：全場 10 秒內受到的傷害 +20%',
          function (p, t) { area(t).forEach(function (x) { X.deb(x, 'vuln', 0.2, 10); }); }, { skillf: function (p, src) { return src === 'rburst' ? 2 : 1; } }),
        S('施法間隔 −10%', '古符解放：符石爆裂立刻連放 5 次',
          function (p, t) { var sc = 1 + X.LFE(p) * 3 / Math.max(1, X.base(p)); for (var i = 0; i < 5; i++) X.deal(p, t, sc, { magic: true, src: 'rburst', show: i === 0 }); }, { cast: 0.10 })] },
      shadow: { n: '影刃舞者', donor: 'dark', d: '迴避連擊', s: [
        S('迴避 +5', '影刃千斬：單體 10 段各 70%',
          function (p, t) { for (var i = 0; i < 10; i++) dealOne(p, t, 0.7, { show: i === 0 }); }, { stat: function (p, d) { d.er = N(d.er) + 5; } }),
        S('迴避成功後下一擊 +50%', '影遁：5 秒內必定迴避一般攻擊',
          function (p) { B(p, 'dodge', 5, 1); }, { evadeNext: 0.5 }),
        S('近距離爆擊 +10%', '影舞：全場 500%，每隻 30% 機率再打一次',
          function (p, t) { area(t).forEach(function (x, i) { dealOne(p, x, 5, { show: i === 0 }); if (Math.random() < 0.3) dealOne(p, x, 5, { show: false }); }); }, { stat: function (p, d) { d.meleeCrit += 10; } })] },
      mirror: { n: '幻劍師', donor: 'illusion', d: '幻影分身', s: [
        S('幻覺反擊傷害 +50%', '鏡花劍舞：召喚 2 個幻影 15 秒，各打你一般攻擊的 40%',
          function (p) { B(p, 'clone', 15, 0.4); }, { skillf: function (p, src) { return src === 'illusion' ? 1.5 : 1; } }),
        S('幻覺反擊需要的連續迴避次數 −1', '幻境：全場 10 秒內造成的傷害 −30%',
          function (p, t) { area(t).forEach(function (x) { X.deb(x, 'weak', 0.3, 10); }); }, { ill: 1 }),
        S('幻影存在時你受到的傷害 −15%', '千影劍：全場 600%',
          function (p, t) { dealArea(p, t, 6); }, { taken: function (p, dmg) { return Bv(p, 'clone') ? dmg * 0.85 : dmg; } })] }
    }
  };
  // 掛進 ext 的引擎
  Object.keys(ROUTES).forEach(function (c) { E.TROUTES[c] = ROUTES[c]; });

  var trOf = function (p) { var e = p && p.awkTransfer, r = e && ROUTES[p.cls] && ROUTES[p.cls][e.route]; return r && N(e.stage) > 0 ? { r: r, n: Math.min(3, N(e.stage)) } : null; };
  var stageN = function (p) { var x = trOf(p); return x ? x.n : 0; };
  var stagesOf = function (p) { var x = trOf(p); return x ? x.r.s.slice(0, x.n) : []; };
  var sumKey = function (p, k) { return stagesOf(p).reduce(function (v, s) { return v + N(s[k]); }, 0); };
  var cleanse = function (a) { try { var z = a === P() ? a.statuses : (a.statuses || a._statuses); if (!z) return; ['stun', 'freeze', 'stone', 'sleep', 'paralyze', 'poison', 'blind', 'curse', 'slow', 'silence', 'magicseal', 'burn'].forEach(function (k) { if (N(z[k]) > 0) z[k] = 0; }); } catch (e) {} };

  // 第一段的被動外面再包一層：自己身上的計時增益（受到的傷害、反擊、影遁）
  Object.keys(ROUTES).forEach(function (c) {
    Object.keys(ROUTES[c]).forEach(function (k) {
      var s0 = ROUTES[c][k].s[0], o = s0.taken;
      s0.taken = function (p, dmg, mob, kind) {
        if (o) dmg = o(p, dmg, mob, kind);
        if (X.alive(mob)) st(p).t_lastMob = mob;
        if (Bv(p, 'dodge') && kind !== 'magic') return 0;
        var tk = Bv(p, 'taken'); if (tk) dmg *= 1 - tk;
        var ct = Bv(p, 'counter'); if (ct && X.alive(mob)) counter(p, mob, ct * (sumKey(p, 'counterX') || 1) * (stageN(p) >= 3 && ROUTES[c][k].n === '黑鋼守衛' ? 1.5 : 1));
        return dmg;
      };
      // 其他段：技能倍率函式（ext 讀 x.skill[src]，這裡另外接 skillf）
    });
  });

  // ── 不在 ext 引擎裡的東西：用另一個 MOD 處理（全部是乘法或不回傳，不會蓋掉 ext 的結果）──
  A.MODS.push({
    skillMult: function (p, src) {
      var m = 1; stagesOf(p).forEach(function (s) { if (s.skillf) m *= s.skillf(p, src) || 1; });
      if (Bv(p, 'mirror') && THUNDER_SRC.test(src)) m *= 1.5;
      return m;
    },
    lfeMult: function () { return 1; },
    dealt: function (p, t, v, o) {
      var m = 1 + N(Bv(p, 'dmg'));
      if (Bv(p, 'elem') && o && o.kind === 'melee' && typeof ELEM_COUNTER_UP !== 'undefined') m *= N(ELEM_COUNTER_UP) || 1;
      var S0 = st(p); if (S0.t_next && o && o.kind !== 'magic') { m *= 1 + S0.t_next; S0.t_next = 0; }
      return m;
    },
    tick: function (p) {
      var x = trOf(p); if (!x) return;
      var S0 = st(p), t = X.target(), n = now();
      var inFight = W.__afkProc && W.__afkProc.inCombat ? W.__afkProc.inCombat() : true;
      if (!inFight) { S0.t_banner = 0; return; }
      if (!t) return;
      if (N(S0.t_sec) > n) return; S0.t_sec = n + 1;   // 下面都是每秒一次
      var cl = Bv(p, 'clone'); if (cl) for (var i = 0; i < 2; i++) X.deal(p, t, cl, { src: 'transfer', show: false });
      if (Bv(p, 'volley')) for (var j = 0; j < 3; j++) { var xs = X.near(t, 8); var m = xs[Math.floor(Math.random() * xs.length)]; if (m) dealOne(p, m, 1.5, { magic: true, ele: 'wind', show: false }); }
      var rn = Bv(p, 'rain'); if (rn) dealArea(p, t, rn, { magic: true });
      var dr = Bv(p, 'drain'); if (dr) p.hp = Math.max(1, N(p.hp) - Math.floor(N(p.mhp) * dr));
      if (S0.t_echoAt && S0.t_echoAt <= n) { S0.t_echoAt = 0; dealArea(p, t, 3.5, { magic: true, ele: 'wind' }); }
      if (sumKey(p, 'banner') && N(S0.t_bannerAt) <= n) { S0.t_bannerAt = n + 10; if (N(p.hp) < N(p.mhp)) S0.t_banner = Math.min(5, N(S0.t_banner) + 1); }
    }
  });
  // 冷卻：雷之魔導（12 秒內 −50%）
  var oCdr = W.__afkCdrMult;
  W.__afkCdrMult = function (p, s) { var m = typeof oCdr === 'function' ? oCdr.apply(this, arguments) : 1; try { if (p && Bv(p, 'cdhalf')) m *= 0.5; } catch (e) {} return m; };
  // 施法間隔
  if (typeof W.getAutoCastInterval === 'function') {
    var oAci = W.getAutoCastInterval;
    W.getAutoCastInterval = function (actor) { var v = oAci.apply(this, arguments); try { var c = sumKey(actor || P(), 'cast'); if (c > 0 && v > 0) v = v * (1 - c); } catch (e) {} return v; };
  }
  // 鎖鏈閃光、觸電時間、幻覺反擊次數（afk-awaken 讀）
  W.__awkChainAdd = function (p) { return sumKey(p, 'chain'); };
  W.__awkShockAdd = function (p) { return sumKey(p, 'shock'); };
  W.__awkIllMinus = function (p) { return sumKey(p, 'ill'); };
  // 異常狀態抵抗（只有你本人）
  if (typeof W.playerStatusResisted === 'function') {
    var oPsr = W.playerStatusResisted;
    W.playerStatusResisted = function (kind) { if (oPsr.apply(this, arguments)) return true; try { var a = sumKey(P(), 'abn'); return a > 0 && Math.random() * 100 < a; } catch (e) { return false; } };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }
  // 迴避：反擊（黑鋼守衛）、下一擊 +50%（影刃舞者）
  var hookProc = function () {
    var H = W.__afkProc; if (!H || hookProc.done) return; hookProc.done = true;
    H.on('evade', function (mob) { var p = P(); if (!trOf(p)) return; var c = sumKey(p, 'evade'); if (c && X.alive(mob)) counter(p, mob, c * (stageN(p) >= 3 ? 1.5 : 1)); var nx = sumKey(p, 'evadeNext'); if (nx) st(p).t_next = nx; });
    // 全隊效果：看隊伍裡每個有覺醒轉職的人（你或傭兵）
    var owners = function () { var me = P(); if (!me) return []; return [me].concat(me.allies || []).filter(function (a) { return a && !a._downed && trOf(a); }); };
    var pv = function (k) { return owners().reduce(function (v, a) { return v + stagesOf(a).reduce(function (w, s) { return w + N(s.party && s.party[k]); }, 0); }, 0); };
    var bv = function (k) { return owners().reduce(function (v, a) { return Math.max(v, N(Bv(a, k))); }, 0); };
    var bannerV = function () { return owners().reduce(function (v, a) { return Math.max(v, stagesOf(a).some(function (s) { return s.party && s.party.banner; }) ? N(st(a).t_banner) * 0.03 : 0); }, 0); };
    H.on('dealt', function (actor, t, v, o) {
      if (!(v > 0) || !X.mine(actor)) return v;
      var add = (o && o.kind === 'melee') ? pv('melee') : 0;
      var m = 1 + bv('pdmg') + bv('pdmg2') + bannerV();
      var out = (v + add) * m;
      var lc = pv('leech'); if (lc > 0 && o && (o.kind === 'melee' || o.kind === 'ranged')) X.heal(actor, out * lc);
      return out;
    });
    H.on('taken', function (ent, v) { if (!(v > 0) || !X.mine(ent)) return v; var r = Math.min(0.8, pv('taken') + bv('ptaken')); return r > 0 ? v * (1 - r) : v; });
  };
  hookProc(); W.addEventListener('load', hookProc);

  // ── 轉職（魂魄）──
  var REQ = [{ lv: 50, rb: 0 }, { lv: 1, rb: 1 }, { lv: 1, rb: 2 }];
  var gate = function (p, id) {
    if (!p || !ROUTES[p.cls] || p.classicMode) return '要先成為覺醒職業。';
    if (p.awkEvo && N(p.awkEvo.stage) > 0) return '已選擇覺醒進化，不能轉職（只能二選一）。';
    var e = p.awkTransfer || {}, i = N(e.stage);
    if (i >= 3) return '三段都完成了。';
    if (i && e.route !== id) return '轉職流派已經選定。';
    var q = REQ[i]; if (N(p.rebirth) < q.rb || (q.rb === 0 && N(p.lv) < q.lv)) return '第' + '一二三'.charAt(i) + '段需要 ' + (i === 0 ? 'Lv50' : i + ' 轉') + '。';
    return '';
  };
  var souls = function (p, v, i) {
    var base = CLS[p.cls].base, used = {}, cl = !!p.classicMode;
    var pick = function (cls, rb) { var s = (v.souls || []).find(function (x) { return !used[x.id] && x.cls === cls && N(x.rebirth) === rb && N(x.level) >= 100 && !!x.classic === cl; }); if (s) used[s.id] = 1; return s || null; };
    return [pick(base, 0), pick(base, 1), pick(base, 2), pick(p.cls, i)];
  };
  var advance = function (id) {
    var p = P(), r = p && ROUTES[p.cls] && ROUTES[p.cls][id], why = gate(p, id);
    if (!r || why) return Promise.reject(Error(why || '找不到流派。'));
    var LC = W.LineageClasses; if (!LC || !LC.commit) return Promise.reject(Error('魂魄簿還沒準備好。'));
    var i = N((p.awkTransfer || {}).stage);
    return LC.commit('覺醒轉職：' + r.n + ' 第' + '一二三'.charAt(i) + '段', function (q, v) {
      var g = gate(q, id); if (g) throw Error(g);
      var ss = souls(q, v, i); if (!ss.every(Boolean)) throw Error('魂魄不夠：要' + X.BASE_N[CLS[q.cls].base] + ' 0 轉、1 轉、2 轉 Lv100 各一顆，加上' + CLS[q.cls].n + ' ' + i + ' 轉 Lv100 一顆。');
      var ids = ss.map(function (s) { return s.id; });
      v.souls = v.souls.filter(function (s) { return ids.indexOf(s.id) < 0; }); ids.forEach(function (sid) { v.spent[sid] = Date.now(); }); v.revision = N(v.revision) + 1;
      q.awkTransfer = { route: id, stage: i + 1 };
      return { player: q, vault: v };
    }).then(function () { try { loadGame(currentSlot); } catch (e) {} return '覺醒轉職：' + r.n + ' 第' + '一二三'.charAt(i) + '段完成。'; });
  };
  A.tabs.push({ id: 'transfer', label: '覺醒轉職', show: function (p) { return !!(p && ROUTES[p.cls]); },
    render: function (p) {
      var e = p.awkTransfer || {}, i = N(e.stage), base = X.BASE_N[CLS[p.cls].base];
      var h = '<div class="ax-h">覺醒轉職（三條融合流派選一條，共三段）</div><div class="ax-note">每段交' + esc(base) + ' 0 轉、1 轉、2 轉 Lv100 魂魄各一顆，加上' + esc(CLS[p.cls].n) + ' Lv100 魂魄一顆（第一段 0 轉、第二段 1 轉、第三段 2 轉）。條件：第一段 Lv50、第二段 1 轉、第三段 2 轉。每段給一個被動，並學會一招大絕（戰鬥中自動施放，冷卻 60 秒）。跟覺醒進化只能二選一，選定後不能換。</div>';
      var v = null, ss = null; try { v = W.LineageClasses.vault(); if (i < 3) ss = souls(p, v, i); } catch (er) {}
      if (ss) h += '<div class="ax-desc">這一段要的魂魄：' + ['0 轉', '1 轉', '2 轉'].map(function (t, k) { return esc(base) + ' ' + t + (ss[k] ? ' <span class="ok">✔</span>' : ' <span class="no">✘</span>'); }).join('、') + '、' + esc(CLS[p.cls].n) + ' ' + i + ' 轉' + (ss[3] ? ' <span class="ok">✔</span>' : ' <span class="no">✘</span>') + '</div>';
      var ready = ss && ss.every(Boolean);
      Object.keys(ROUTES[p.cls]).forEach(function (id) {
        var r = ROUTES[p.cls][id], why = gate(p, id), mine = e.route === id;
        h += '<div class="ax-row' + (why && /選定|二選一/.test(why) ? ' off' : '') + '"><div class="ax-main"><div class="ax-ico"><img src="assets/icons/awaken/' + encodeURIComponent('轉職_' + r.n) + '.webp" alt=""></div><div><div class="ax-name">' + esc(r.n) + '（' + esc(r.d) + '）' + (mine ? ' <span class="ok">第 ' + i + ' 段</span>' : '') + '</div><div class="ax-note">融合對象：' + esc(X.BASE_N[r.donor]) + '</div>';
        r.s.forEach(function (s, k) { h += '<div class="ax-desc">' + (mine && i > k ? '✔ ' : '') + '第' + '一二三'.charAt(k) + '段：' + esc(s.p) + '；大絕「' + esc(s.u) + '」</div>'; });
        h += '</div></div><div class="ax-act">' + (why ? '<span class="ax-note">' + esc(why) + '</span>' : '<button type="button" data-aw-x="transfer" data-aw-arg="' + id + '"' + (ready ? '' : ' disabled') + '>' + (ready ? '轉職（用四顆魂魄）' : '魂魄不夠') + '</button>') + '</div></div>';
      });
      return h;
    },
    click: function (act, id) { if (act === 'transfer') return advance(id); }
  });
  W.__afkAwakenTransfer = { ROUTES: ROUTES, gate: gate, souls: souls, advance: advance, stageN: stageN, trOf: trOf };
})();
