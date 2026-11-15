/* ============================================================================
 * afk-awaken-ext.js — 覺醒職業的附屬系統（Ping 11-14 13:03「繼續製作到完成」；提案 Projects claude/awaken-systems-plan.md）
 *
 *   ‧技藝精通（燃柳村 奧拉奇里亞，1 轉後二選一）：每職業兩門，掛進 afk-arts 的 ARTS。
 *   ‧技能強化（席琳神殿 薇爾娜）：覺醒技能也吃三個階段的 +5／+10／+20%；三個招牌技能每階段再 +15%，第三階段冷卻 -20%。
 *   ‧覺醒進化（覺醒導師 伊瑟拉）：兩條流派三段；每段交一顆本職魂魄（0／1／2 轉 Lv100），
 *     條件 Lv50／1 轉／2 轉。每段給被動，並學會一招大絕（自動施放）。
 *   ‧要 afk-awaken.js 先載入。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, A = W.__afkAwaken; if (!A || !A.api) return;
  var X = A.api, SK = A.SK, CLS = A.CLS, N = function (x) { return Number(x) || 0; };
  var esc = X.esc, P = X.P;
  var awk = function (p) { return !!(p && CLS[p.cls]); };

  // ================================================================ 技藝精通 ==
  var ARTS = {
    aw_t_storm: { cls: 'thunder', n: '風暴之神', mult: 4, d: '造成的傷害 ×4。每 6 秒在全場落雷，每隻敵人受到 300% 雷擊並疊 1 層閃電標誌；觸電的敵人 3 秒內受到全隊的傷害 +10%。', lore: '站在暴風中心的人，聽不見雷聲，因為雷就是他的心跳。' },
    aw_t_drive: { cls: 'thunder', n: '極限驅動', mult: 3.5, d: '造成的傷害 ×3.5。雷神技能（雷擊、落雷、鎖鏈閃光）的傷害再 ×2；鎖鏈閃光的機率 ×2。', lore: '把全身的電流推過極限，連影子都追不上自己。' },
    aw_b_heart: { cls: 'berserker', n: '燃燒之心', mult: 3.5, d: '造成的傷害 ×3.5。HP 低於 30% 時不死 5 秒（每 60 秒一次），期間近距離傷害 + 最大 HP 的 2%。一般攻擊造成傷害的 3% 轉為 HP。', lore: '心臟燒起來的那一刻，死亡就得排隊等候。' },
    aw_b_hercules: { cls: 'berserker', n: '海克力斯', mult: 4, d: '造成的傷害 ×4。力量 +30；咆哮、印地安戰斧的傷害再 ×2；受到的傷害 -15%。', lore: '十二道試煉之後，世上已沒有能讓他低頭的重量。' },
    aw_p_seraph: { cls: 'paladin', n: '熾天使', mult: 3.5, d: '造成的傷害 ×3.5。受到的傷害 -25%；每 10 秒淨化自己的一種異常狀態；攻擊時 10% 機率追加翼擊（200%）。倒下前保留 1 HP 一次（每 90 秒）。', lore: '六翼展開時，連死神也只能在門外等待。' },
    aw_p_avatar: { cls: 'paladin', n: '化身之誓', mult: 4, d: '造成的傷害 ×4。神聖衝暈、審判、神聖風暴的冷卻 -30%；暈住的敵人受到的傷害再 +10%。', lore: '殷海薩借出祂的雙手，他的每一劍都是審判。' },
    aw_k_wave: { cls: 'darkknight', n: '黑暗浪潮', mult: 4, d: '造成的傷害 ×4。攻擊時 12% 機率發出黑暗浪潮，打目標與周圍 3 隻各 300%。', lore: '浪頭過後，沙灘上只留下影子。' },
    aw_k_dim: { cls: 'darkknight', n: '次元之劍', mult: 3.5, d: '造成的傷害 ×3.5。暗黑之劍的劍氣打全場；攻擊無視目標 20% 的傷害減免；爆擊時回復 5% 傷害。', lore: '劍從另一個次元刺來，沒有任何盾牌來得及轉身。' },
    aw_r_dance: { cls: 'runeblade', n: '刀劍飛舞', mult: 4, d: '造成的傷害 ×4。每 8 秒自動刀劍飛舞：連斬 4 下，每下 200% + LFE×5，目標定身 2 秒（王改成易傷）。', lore: '劍舞到最快時，時間會忘記流動。' },
    aw_r_flow: { cls: 'runeblade', n: '生命之流', mult: 3.5, d: '造成的傷害 ×3.5。每 10 秒回復全隊 10% HP；HP 低於 40% 時傷害減免 +20。LFE +30%。', lore: '世界樹的根穿過他的血管，生命在他身上永不乾涸。' }
  };
  var artOf = function (p) { try { return W.__afkArts && W.__afkArts.art ? W.__afkArts.art(p) : null; } catch (e) { return null; } };
  try {
    var AR = W.__afkArts;
    if (AR && AR.ARTS) Object.keys(ARTS).forEach(function (id) { AR.ARTS[id] = { cls: ARTS[id].cls, n: ARTS[id].n, d: ARTS[id].d }; if (AR.LORE) AR.LORE[id] = ARTS[id].lore; });
  } catch (e) { console.warn('[AFK-awaken-ext] arts', e); }

  // ================================================================ 技能強化 ==
  var SIGS = {
    thunder: ['chain', 'flash', 'static', '鎖鏈閃光', '雷電一閃', '靜態場'],
    berserker: ['roar', 'axes', 'raid', '咆哮', '印地安戰斧', '屠戮者（鎧甲突襲）'],
    paladin: ['storm', 'judge', 'cross', '神聖風暴', '審判', '神聖十字架'],
    darkknight: ['swordwave', 'revsword', 'imp', '暗黑之劍', '復仇之劍', '虛空的使魔'],
    runeblade: ['rburst', 'trinity', 'sonic', '符石爆裂', '三位一體', '聲波刀刃']
  };
  try {
    var SU = W.__afkSkillUp;
    if (SU && SU.CLS_TXT) Object.keys(SIGS).forEach(function (c) {
      var g = SIGS[c], t = function (k) { return [g[3] + k, g[4] + k, g[5] + k]; };
      SU.CLS_TXT[c] = [null, t('：傷害 +15%'), t('：傷害 +30%'), t('：傷害 +50%、冷卻 -20%')];
    });
  } catch (e) {}
  var suStage = function (p) { try { return W.__afkSkillUp ? W.__afkSkillUp.stageOf(p) : 0; } catch (e) { return 0; } };
  var suPct = function (p) { try { return W.__afkSkillUp ? W.__afkSkillUp.pctOf(p) : 0; } catch (e) { return 0; } };

  // ================================================================ 覺醒進化 ==
  //   每段：被動（stat／dealt／taken）＋大絕（ult：自動施放，冷卻 60 秒）
  var ROUTES = {
    berserker: {
      titan: { n: '泰坦', d: '坦', s: [
        { p: '傷害減免 +5、最大 HP +10%', stat: function (p, d) { d.dr += 5; return N(p.mhp) * 0.1; }, u: '泰坦之怒：400% 並昏迷 3 秒（王改成易傷）', ult: function (p, t) { X.deal(p, t, 4, { src: 'evo' }); X.stun(p, t, 3); } },
        { p: '受到攻擊時 10% 機率反射 100% 傷害', taken: function (p, dmg, mob) { if (X.alive(mob) && Math.random() < 0.1) reflect(p, mob, dmg); return dmg; }, u: '黃金壁壘：10 秒內受到的傷害 -50%', ult: function (p) { st(p).evoBuf = X.now() + 10; } },
        { p: 'HP 低於 30% 時受到的傷害再 -20%', taken: function (p, dmg) { return N(p.hp) < N(p.mhp) * 0.3 ? dmg * 0.8 : dmg; }, u: '泰坦覺醒：15 秒內反射 50% 近距離傷害、受到的傷害 -30%', ult: function (p) { st(p).evoBuf = X.now() + 15; st(p).evoReflect = X.now() + 15; } }] },
      rage: { n: '狂襲', d: '輸出', s: [
        { p: '近距離傷害 +10', stat: function (p, d) { d.meleeDmg += 10; }, u: '亡命一擊：單體 500%', ult: function (p, t) { X.deal(p, t, 5, { src: 'evo' }); } },
        { p: '攻速 +10%', stat: function (p, d) { d.atkSpdPct += 10; }, u: '狂暴旋風：全場 400%', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 4, { src: 'evo' }); }); } },
        { p: '近距離爆擊 +10%', stat: function (p, d) { d.meleeCrit += 10; }, u: '海克力斯之怒：10 秒內造成的傷害 ×1.5', ult: function (p) { st(p).evoRage = X.now() + 10; } }] }
    },
    thunder: {
      storm: { n: '雷霆', d: '群攻', s: [
        { p: '鎖鏈閃光的傷害 +30%', skill: { chain: 1.3 }, u: '暴雷：全場 300% 雷擊 3 次', ult: function (p, t) { X.near(t, 8).forEach(function (x) { for (var i = 0; i < 3; i++) X.deal(p, x, 3, { magic: true, ele: 'wind', src: 'evo', show: i === 0 }); }); } },
        { p: '落雷、靜態場的傷害 +30%', skill: { bolt: 1.3, static: 1.3 }, u: '雷霆領域：10 秒內每秒全場 100% 雷擊', ult: function (p) { st(p).evoField = X.now() + 10; } },
        { p: '靜態場冷卻 -3 秒', cd: { static: 3 }, u: '諸神黃昏・極：全場 800% 雷擊並昏迷（王改成易傷）', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 8, { magic: true, ele: 'wind', src: 'evo' }); X.stun(p, x, 2); }); } }] },
      valk: { n: '女武神', d: '單體', s: [
        { p: '雷電一閃冷卻 -5 秒', cd: { flash: 5 }, u: '雷神之槍：單體 600% 雷擊', ult: function (p, t) { X.deal(p, t, 6, { magic: true, ele: 'wind', src: 'evo' }); } },
        { p: '對王的傷害 +10%', dealt: function (p, t) { return t.boss ? 1.1 : 1; }, u: '等離子護身：回復 30% HP、解除控制', ult: function (p) { X.heal(p, N(p.mhp) * 0.3); var z = p.statuses || {}; ['stun', 'freeze', 'stone', 'sleep'].forEach(function (k) { if (z[k]) z[k] = 0; }); } },
        { p: '近距離爆擊 +10%', stat: function (p, d) { d.meleeCrit += 10; }, u: '女武神審判：單體 1500% 雷擊', ult: function (p, t) { X.deal(p, t, 15, { magic: true, ele: 'wind', src: 'evo' }); } }] }
    },
    paladin: {
      judge: { n: '審判', d: '控場', s: [
        { p: '造成的傷害 +5%', dealt: function () { return 1.05; }, u: '神聖制裁・陣：全場 300%，全隊回復 10% HP', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 3, { magic: true, src: 'evo' }); }); X.areaHeal(p, 0.1); } },
        { p: '審判的易傷再 +4%', skill: { judge: 1.2 }, u: '懲罰：400% 並昏迷 3 秒（王改成易傷）', ult: function (p, t) { X.deal(p, t, 4, { magic: true, src: 'evo' }); X.stun(p, t, 3); } },
        { p: '造成的傷害 +10%', dealt: function () { return 1.1; }, u: '審判之光：全場 800%', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 8, { magic: true, src: 'evo' }); }); } }] },
      guard: { n: '守護', d: '隊伍', s: [
        { p: '全隊受到的傷害 -5%', taken: function (p, dmg) { return dmg * 0.95; }, u: '神聖恩典・群：全隊回復 25% HP', ult: function (p) { X.areaHeal(p, 0.25); } },
        { p: '神聖十字架多落 1 個（傷害 +50%）', skill: { cross: 1.5 }, u: '神聖屏障：8 秒內受到的傷害 -40%', ult: function (p) { st(p).evoBuf = X.now() + 8; } },
        { p: '團結的經驗上限 +5%', unity: 0.05, u: '化身降臨：15 秒內造成的傷害 ×1.5、每秒回 3% HP', ult: function (p) { st(p).evoRage = X.now() + 15; st(p).evoRegen = X.now() + 15; } }] }
    },
    darkknight: {
      avenger: { n: '復仇者', d: '反擊', s: [
        { p: '受到攻擊時 5% 機率完全迴避', taken: function (p, dmg) { return Math.random() < 0.05 ? 0 : dmg; }, u: '復仇昏迷：300% 並昏迷 2 秒（王改成易傷）', ult: function (p, t) { X.deal(p, t, 3, { src: 'evo' }); X.stun(p, t, 2); } },
        { p: '復仇之劍的傷害 +50%', skill: { revsword: 1.5 }, u: '幻影迴避：10 秒內受到的傷害 -50%', ult: function (p) { st(p).evoBuf = X.now() + 10; } },
        { p: '造成的傷害 +10%', dealt: function () { return 1.1; }, u: '卡呂普索・墜：全場 900%', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 9, { magic: true, src: 'evo' }); }); } }] },
      demon: { n: '黑魔王', d: '吸血', s: [
        { p: '一般攻擊吸取 2% 傷害', hit: function (p, t, v) { X.heal(p, v * 0.02); }, u: '深淵黑手：目標 15 秒內受到的傷害 +20%', ult: function (p, t) { X.deb(t, 'vuln', 0.2, 15); } },
        { p: '擊殺時回復 5% HP', kill: 0.05, u: '變形怪王・醒：15 秒內攻速 +20%、吸血 5%', ult: function (p) { st(p).evoLeech = X.now() + 15; } },
        { p: '爆擊時再吸取 10% 傷害', hit: function (p, t, v, o) { if (o && o.crit) X.heal(p, v * 0.1); }, u: '虛空吞噬：單體 1200%，回復造成傷害的 30%', ult: function (p, t) { var v = X.deal(p, t, 12, { magic: true, src: 'evo' }); X.heal(p, v * 0.3); } }] }
    },
    runeblade: {
      ace: { n: '王牌', d: '連擊', s: [
        { p: '攻擊適應上限 +2 階（傷害 +4%）', dealt: function () { return 1.04; }, u: '符石陣：全場 300% 並昏迷 1 秒（王改成易傷）', ult: function (p, t) { X.near(t, 8).forEach(function (x) { X.deal(p, x, 3, { magic: true, src: 'evo' }); X.stun(p, x, 1); }); } },
        { p: '三位一體冷卻 -5 秒', cd: { trinity: 5 }, u: '刀劍亂舞：單體連斬 8 下各 120%', ult: function (p, t) { for (var i = 0; i < 8; i++) X.deal(p, t, 1.2, { src: 'evo', show: i === 0 }); } },
        { p: '造成的傷害 +10%', dealt: function () { return 1.1; }, u: '三位一體・極：單體 1000%', ult: function (p, t) { X.deal(p, t, 10, { src: 'evo' }); } }] },
      life: { n: '生命', d: '回復', s: [
        { p: 'LFE +15%', lfe: 1.15, u: '生命流・湧：全隊回復 20% HP', ult: function (p) { X.areaHeal(p, 0.2); } },
        { p: '最大 HP +10%', stat: function (p) { return N(p.mhp) * 0.1; }, u: '生命護盾：10 秒內受到的傷害 -40%', ult: function (p) { st(p).evoBuf = X.now() + 10; } },
        { p: 'HP 低於 40% 時受到的傷害 -15', taken: function (p, dmg) { return N(p.hp) < N(p.mhp) * 0.4 ? Math.max(0, dmg - 15) : dmg; }, u: '世界樹之息：全隊回滿 HP，10 秒內受到的傷害 -30%', ult: function (p) { X.areaHeal(p, 1); st(p).evoBuf = X.now() + 10; } }] }
    }
  };
  var ST = new WeakMap(); var st = function (p) { var s = ST.get(p); if (!s) { s = {}; ST.set(p, s); } return s; };
  var reflect = function (p, mob, dmg) { try { var api = W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; if (api && X.alive(mob)) api.damage(mob, Math.floor(dmg), { actor: p, source: 'awk:reflect', type: 'physical', origin: 'class', generated: true, direct: true, settle: true }); } catch (e) {} };
  // 覺醒轉職（afk-awaken-transfer.js 填 TROUTES）：跟覺醒進化共用同一套被動、大絕的引擎；兩者永久二選一
  var TROUTES = {};
  var evo = function (p) {
    if (!awk(p)) return null;
    var tr = p.awkTransfer; if (tr && N(tr.stage) > 0) { var tq = TROUTES[p.cls] && TROUTES[p.cls][tr.route]; return tq ? { route: tq, stage: Math.max(0, Math.min(3, N(tr.stage))), transfer: true } : null; }
    var e = p.awkEvo; if (!e || !ROUTES[p.cls] || !ROUTES[p.cls][e.route]) return null; return { route: ROUTES[p.cls][e.route], stage: Math.max(0, Math.min(3, N(e.stage))) };
  };
  var stages = function (p) { var e = evo(p); return e ? e.route.s.slice(0, e.stage) : []; };

  // ================================================================ 效果 ==
  A.MODS.push({
    skillMult: function (p, src) {
      var m = 1;
      var g = SIGS[p.cls], s = suStage(p); m *= 1 + suPct(p);
      if (g && s && g.slice(0, 3).indexOf(src) >= 0) m *= 1 + [0, 0.15, 0.30, 0.50][s];
      var a = artOf(p); if (a === 'aw_t_drive' && /^(chain|bolt|shock|arrow|static|flash|tempest|ragnarok|potential)$/.test(src)) m *= 2;
      if (a === 'aw_b_hercules' && /^(roar|axes)$/.test(src)) m *= 2;
      stages(p).forEach(function (x) { if (x.skill && x.skill[src]) m *= x.skill[src]; });
      return m;
    },
    lfeMult: function (p) { var m = artOf(p) === 'aw_r_flow' ? 1.3 : 1; stages(p).forEach(function (x) { if (x.lfe) m *= x.lfe; }); return m; },
    unityAdd: function (p) { var v = 0; stages(p).forEach(function (x) { if (x.unity) v += x.unity; }); return v; },
    cd: function (p, s, cd) {
      var g = SIGS[p.cls]; if (g && suStage(p) >= 3 && SK[s.id] && g.slice(0, 3).some(function (k) { return s.key === k || (k === 'imp' && false); })) cd *= 0.8;
      if (artOf(p) === 'aw_p_avatar' && /^(stun|judge|storm)$/.test(s.key)) cd *= 0.7;
      stages(p).forEach(function (x) { if (x.cd && x.cd[s.key]) cd = Math.max(1, cd - x.cd[s.key]); });
      return cd;
    },
    dealt: function (p, t, v, o) {
      var m = 1, a = artOf(p);
      if (a && ARTS[a] && ARTS[a].cls === p.cls) m *= ARTS[a].mult;
      if (a === 'aw_p_avatar' && t && X.debV(t, 'noHeal')) m *= 1.1;
      if (a === 'aw_k_dim' && o.kind !== 'magic') m *= 1.08;
      if (a === 'aw_t_storm' && t && st(t).shockUntil > X.now()) m *= 1.1;
      stages(p).forEach(function (x) { if (x.dealt) m *= x.dealt(p, t, v, o) || 1; });
      if (st(p).evoRage > X.now()) m *= 1.5;
      return m;
    },
    taken: function (p, dmg, mob, kind) {
      var a = artOf(p), S = st(p);
      if (a === 'aw_p_seraph') dmg *= 0.75;
      if (a === 'aw_b_hercules') dmg *= 0.85;
      if (a === 'aw_r_flow' && N(p.hp) < N(p.mhp) * 0.4) dmg = Math.max(0, dmg - 20);
      if ((a === 'aw_b_heart' || a === 'aw_p_seraph') && dmg >= N(p.hp)) {
        var cdk = a === 'aw_b_heart' ? 60 : 90;
        if (N(S.lastStand) <= X.now()) { S.lastStand = X.now() + cdk; S.undying = X.now() + (a === 'aw_b_heart' ? 5 : 0.1); X.pop(p, 'stand', ARTS[a].n, '#fca5a5'); }
      }
      if (S.undying > X.now()) dmg = Math.min(dmg, Math.max(0, N(p.hp) - 1));
      if (a === 'aw_b_heart' && N(p.hp) < N(p.mhp) * 0.3 && N(S.lastStand) <= X.now()) { S.lastStand = X.now() + 60; S.undying = X.now() + 5; }
      stages(p).forEach(function (x) { if (x.taken) dmg = x.taken(p, dmg, mob, kind); });
      if (S.evoBuf > X.now()) dmg *= S.evoReflect > X.now() ? 0.7 : 0.5;
      if (S.evoReflect > X.now() && X.alive(mob) && kind !== 'magic') reflect(p, mob, dmg * 0.5);
      return dmg;
    },
    hit: function (p, t, v, o) {
      var a = artOf(p);
      if (a === 'aw_b_heart') X.heal(p, v * 0.03);
      if (a === 'aw_p_seraph' && Math.random() < 0.1) X.deal(p, t, 2, { magic: true, src: 'wing' });
      if (a === 'aw_k_wave' && Math.random() < 0.12) X.near(t, 4).forEach(function (x) { X.deal(p, x, 3, { magic: true, src: 'darkwave', show: false }); });
      if (a === 'aw_k_dim') { X.near(t, 8).slice(1).forEach(function (x) { X.deal(p, x, 0.35, { src: 'swordwave', show: false }); }); if (o && o.crit) X.heal(p, v * 0.05); }
      if (a === 'aw_t_drive' && Math.random() < 0.15) { try { X.near(t, 3).forEach(function (x) { X.deal(p, x, 0.6, { magic: true, ele: 'wind', src: 'chain', show: false }); }); } catch (e) {} }
      if (st(p).evoLeech > X.now()) X.heal(p, v * 0.05);
      stages(p).forEach(function (x) { if (x.hit) x.hit(p, t, v, o); });
    },
    stat: function (p, d) {
      var hp = 0, a = artOf(p), S = st(p);
      if (a === 'aw_b_hercules') d.meleeDmg += 0;   // 力量在 attr 那邊加（見下）
      if (a === 'aw_b_heart' && S.undying > X.now()) d.meleeDmg += Math.floor(N(p.mhp) * 0.02);
      if (st(p).evoLeech > X.now()) d.atkSpdPct += 20;
      stages(p).forEach(function (x) { if (x.stat) { var r = x.stat(p, d); if (r > 0) hp += r; } });
      return hp;
    },
    tick: function (p, S0, isMe) {
      var a = artOf(p), S = st(p), now = X.now(), t = X.target();
      if (a === 'aw_t_storm' && t && N(S.storm) <= now) { S.storm = now + 6; X.near(t, 8).forEach(function (x) { X.deal(p, x, 3, { magic: true, ele: 'wind', src: 'stormgod', show: false }); st(x).shockUntil = now + 3; }); X.pop(p, 'stormgod', '風暴之神', '#93c5fd'); }
      if (a === 'aw_r_dance' && t && N(S.dance) <= now) { S.dance = now + 8; for (var i = 0; i < 4; i++) X.deal(p, t, 2 + X.LFE(p) * 5 / Math.max(1, X.base(p)), { src: 'dance', show: i === 0 }); X.stun(p, t, 2); }
      if (a === 'aw_r_flow' && N(S.flow) <= now) { S.flow = now + 10; X.areaHeal(p, 0.1); }
      if (a === 'aw_p_seraph' && N(S.purge) <= now) { S.purge = now + 10; var z = p.statuses || {}; var k = Object.keys(z).find(function (x) { return N(z[x]) > 0 && /poison|blind|curse|slow|silence|stun|freeze|paralyze|sleep/.test(x); }); if (k) z[k] = 0; }
      if (S.evoField > now && t && N(S.field) <= now) { S.field = now + 1; X.near(t, 8).forEach(function (x) { X.deal(p, x, 1, { magic: true, ele: 'wind', src: 'evo', show: false }); }); }
      if (S.evoRegen > now && N(S.regenAt) <= now) { S.regenAt = now + 1; X.heal(p, N(p.mhp) * 0.03); }
      // 覺醒進化大絕：戰鬥中自動放，最高段優先，各自冷卻 60 秒
      var e = evo(p); if (!e || !t) return;
      var inFight = W.__afkProc && W.__afkProc.inCombat ? W.__afkProc.inCombat() : true; if (!inFight) return;
      S.ucd = S.ucd || {};
      for (var j = e.stage - 1; j >= 0; j--) { if (N(S.ucd[j]) > now) continue; S.ucd[j] = now + 60; try { e.route.s[j].ult(p, t); } catch (er) { console.warn('[AFK-awaken-ext] ult', er); } X.pop(p, 'ult', e.route.s[j].u.split('：')[0], '#fbbf24'); break; }
    }
  });
  // 擊殺回血（黑魔王第二段）
  try { if (W.__afkProc) W.__afkProc.on('kill', function () { var p = P(); stages(p).forEach(function (x) { if (x.kill) X.heal(p, N(p.mhp) * x.kill); }); }); } catch (e) {}
  // 海克力斯：力量 +30
  var oOwn = W.__afkOwnStats; W.__afkOwnStats = function (p, d) { if (typeof oOwn === 'function') try { oOwn.apply(this, arguments); } catch (e) {} if (awk(p) && artOf(p) === 'aw_b_hercules') d.str += 30; };

  // ================================================================ 覺醒進化：導師面板 ==
  var REQ = [{ lv: 50, rb: 0 }, { lv: 1, rb: 1 }, { lv: 1, rb: 2 }];
  var reqTxt = function (i) { return i === 0 ? 'Lv50' : i + ' 轉'; };
  var nextGate = function (p, route) {
    if (!awk(p)) return '要先覺醒。';
    if (N(p.awkTransfer && p.awkTransfer.stage) > 0) return '已選擇覺醒轉職，不能進化（只能二選一）。';
    var e = p.awkEvo || {}, i = N(e.stage); if (i >= 3) return '三段都完成了。';
    if (i > 0 && e.route !== route) return '流派已經選定。';
    var q = REQ[i]; if (N(p.rebirth) < q.rb || (q.rb === 0 && N(p.lv) < q.lv)) return '第' + '一二三'.charAt(i) + '段需要 ' + reqTxt(i) + '。';
    return '';
  };
  // Ping 11-15 05:48：每一段都要本職 0 轉、1 轉、2 轉 Lv100 魂魄各一顆（三顆）
  var soulsFor = function (p, v) { var base = CLS[p.cls].base, used = {}; return [0, 1, 2].map(function (r) { var s = (v.souls || []).find(function (x) { return !used[x.id] && x.cls === base && N(x.rebirth) === r && N(x.level) >= 100 && !!x.classic === !!p.classicMode; }); if (s) used[s.id] = 1; return s || null; }); };
  var soulFor = function (p, v) { var a = soulsFor(p, v); return a.every(Boolean) ? a : null; };
  var advance = function (route) {
    var p = P(), g = nextGate(p, route); if (g) return Promise.reject(Error(g));
    var LC = W.LineageClasses, i = N((p.awkEvo || {}).stage);
    return LC.commit('覺醒進化：' + ROUTES[p.cls][route].n + ' 第' + '一二三'.charAt(i) + '段', function (q, v) {
      var g2 = nextGate(q, route); if (g2) throw Error(g2);
      var ss = soulFor(q, v); if (!ss) throw Error('需要' + X.BASE_N[CLS[q.cls].base] + ' 0 轉、1 轉、2 轉 Lv100 魂魄各一顆。');
      var ids = ss.map(function (x) { return x.id; });
      v.souls = v.souls.filter(function (x) { return ids.indexOf(x.id) < 0; }); ids.forEach(function (id) { v.spent[id] = Date.now(); }); v.revision = N(v.revision) + 1;
      q.awkEvo = { route: route, stage: i + 1 };
      return { player: q, vault: v };
    }).then(function () { try { loadGame(currentSlot); } catch (e) {} return '覺醒進化：' + ROUTES[P().cls][route].n + ' 第' + '一二三'.charAt(i) + '段完成。'; });
  };
  A.tabs.push({
    id: 'evo', label: '覺醒進化', show: function (p) { return awk(p); },
    render: function (p) {
      var e = p.awkEvo || {}, h = '<div class="ax-h">覺醒進化（兩條流派選一條，共三段）</div><div class="ax-note">每段交' + esc(X.BASE_N[CLS[p.cls].base]) + ' 0 轉、1 轉、2 轉 Lv100 魂魄各一顆（每段三顆）。跟覺醒轉職只能二選一。條件：第一段 Lv50、第二段 1 轉、第三段 2 轉。每段給一個被動，並學會一招大絕（戰鬥中自動施放，冷卻 60 秒）。</div>';
      var v = null; try { v = W.LineageClasses.vault(); } catch (er) {}
      Object.keys(ROUTES[p.cls]).forEach(function (rk) {
        var r = ROUTES[p.cls][rk], mine = e.route === rk, lock = e.stage > 0 && !mine;
        h += '<div class="ax-row' + (lock ? ' off' : '') + '"><div class="ax-main"><div class="ax-ico"><img src="assets/icons/awaken/' + encodeURIComponent('進化_' + r.n) + '.webp" alt=""></div><div><div class="ax-name">' + esc(r.n) + '（' + esc(r.d) + '）' + (mine ? ' <span class="ok">第 ' + e.stage + ' 段</span>' : '') + '</div>';
        r.s.forEach(function (x, i) { var done = mine && e.stage > i; h += '<div class="ax-desc">' + (done ? '✔ ' : '') + '第' + '一二三'.charAt(i) + '段（' + reqTxt(i) + '）：' + esc(x.p) + '；大絕「' + esc(x.u) + '」</div>'; });
        var g = nextGate(p, rk), sl = v && N(e.stage) < 3 ? soulFor(p, v) : null;
        h += '</div></div><div class="ax-act">' + (g ? '<span class="ax-note">' + esc(g) + '</span>' : '<button type="button" data-aw-x="evo" data-aw-arg="' + rk + '"' + (sl ? '' : ' disabled') + '>' + (sl ? '進化（用三顆魂魄）' : '缺魂魄（0／1／2 轉 Lv100 各一）') + '</button>') + '</div></div>';
      });
      return h;
    },
    click: function (act, arg) { if (act === 'evo') return advance(arg); }
  });

  // ── 薇爾娜「職業進化」「職業轉職」分頁：覺醒職業改顯示覺醒進化（同一套，跟覺醒導師那頁一樣）──
  var evoTab = function () { return (A.tabs || []).filter(function (t) { return t.id === 'evo'; })[0]; };
  var paintVerna = function () {
    var p = P(), host = document.getElementById('class-overlay'); if (!host || !awk(p)) return;
    var pg = host.dataset.page, main = host.querySelector('main'); if (!main || (pg !== 'route' && pg !== 'transfer')) return; vernaMsg = vernaMsg || '';
    var t = evoTab(), h;
    if (pg === 'transfer') h = '<div class="ax-note">覺醒職業的轉職請到席琳神殿「覺醒導師 伊瑟拉」的「覺醒轉職」分頁。</div>';
    else h = t ? t.render(p) : '';
    main.innerHTML = '<div class="afk-ax" data-aw-verna="1">' + (vernaMsg ? '<div class="ax-note" style="color:#fbbf24">' + esc(vernaMsg) + '</div>' : '') + h + '</div>';
  };
  var vernaMsg = '';
  // 薇爾娜面板內部重畫不經過匯出的 render，所以用 MutationObserver 看面板內容換了就補畫
  var vernaBusy = false;
  var watchVerna = new MutationObserver(function () {
    if (vernaBusy) return; var host = document.getElementById('class-overlay'), main = host && host.querySelector('main');
    if (!main || main.querySelector('[data-aw-verna]') || !awk(P())) return;
    vernaBusy = true; try { paintVerna(); } catch (e) {} vernaBusy = false;
  });
  var vernaHost = null, attachVerna = function () { var h = document.getElementById('class-overlay'); if (h && h !== vernaHost) { vernaHost = h; watchVerna.observe(h, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-page'] }); } if (h) setTimeout(function () { var m = h.querySelector('main'); if (m && !m.querySelector('[data-aw-verna]') && awk(P())) { vernaBusy = true; try { paintVerna(); } catch (e) {} vernaBusy = false; } }, 0); };
  attachVerna(); new MutationObserver(attachVerna).observe(document.body, { childList: true });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-aw-verna] [data-aw-x]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); var t = evoTab(); if (!t) return;
    var fin = function (m) { vernaMsg = (m && m.err) || m || ''; try { updateUI(); saveGame(); } catch (er) {} try { paintVerna(); } catch (er) {} };
    try { var r = t.click(b.getAttribute('data-aw-x'), b.getAttribute('data-aw-arg')); if (r && r.then) r.then(fin, function (er) { fin(er.message || String(er)); }); else fin(r); } catch (er) { fin(er.message); }
  }, true);

  W.__afkAwakenExt = { ARTS: ARTS, SIGS: SIGS, ROUTES: ROUTES, TROUTES: TROUTES, evo: evo, advance: advance, st: st, reflect: reflect, stages: stages };
})();
