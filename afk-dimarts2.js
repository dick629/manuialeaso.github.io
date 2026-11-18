/* ============================================================================
 * afk-dimarts2.js — 次元藝能 第三版「職業共鳴」（Ping 11-18 20:30 開始製作；設計稿 Projects claude/dim-arts-v3-design.md）
 *
 *   每個藝能除了共通效果（afk-dimarts），再依職業多一條共鳴（8 本職＋5 覺醒職業）。
 *   倍數：藝能星數（afk-dimarts MULT）×職業倍數：
 *     職業進化（同職業路線）×1.25；職業轉職（融合外職）本職、外職兩條都有，各 ×0.9；職業覺醒 ×1.15；都沒有 ×1。
 *   機率、冷卻、次數上限不跟著乘；只算你本人。
 *   「攻擊力 N%」＝你最近打出的傷害（移動平均）× N%。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined') return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S0 = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S0().ticks) || 0; };
  var rnd = function () { return Math.random(); };
  var mobs = function () { return ((typeof mapState !== 'undefined' && mapState.mobs) || []).filter(function (m) { return m && !m._dead && m.curHp > 0 && !m._isAlly && !m.isAlly; }); };
  var tgt = function () { var t = null; try { t = typeof getTarget === 'function' ? getTarget() : null; } catch (e) {} return t && !t._dead && t.curHp > 0 ? t : mobs()[0] || null; };
  var clog = function (h) { try { if (typeof logCombat === 'function' && !S0().ff) logCombat(h, 'player-special'); } catch (e) {} };
  var tag = function (n, t) { return '<span class="font-bold" style="color:#67e8f9">【' + n + '】</span>' + (t || ''); };
  var R = function () { return W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; };
  var X = function () { return W.__afkProc; };
  var DA = function () { return W.__afkDimArts; };

  // ── 職業與倍數 ──
  var CN = { '王族': 'royal', '騎士': 'knight', '妖精': 'elf', '法師': 'mage', '黑暗妖精': 'dark', '龍騎士': 'dragon', '幻術士': 'illusion', '戰士': 'warrior' };
  var AWK = { thunder: 1, berserker: 1, paladin: 1, darkknight: 1, runeblade: 1 };
  var routeOf = function (p) { try { var r = p.classPath && p.classPath.route, C = W.LineageClassCore; return r && C && C.trees ? C.trees.get(r) : null; } catch (e) { return null; } };
  var RK = null, RKp = null, RKt = -1;
  var resList = function (p) {   // [[職業, 倍數], …]
    var t = now(); if (RK && RKp === p && RKt === t) return RK;
    var c = p.cls, out;
    if (AWK[c]) out = [[c, 1.15]];
    else {
      var tr = routeOf(p);
      if (tr && tr.requiresFusionTransfer && CN[tr.partner]) out = [[c, 0.9], [CN[tr.partner], 0.9]];
      else if (tr && (p.classPath.stage || 0) > 0) out = [[c, 1.25]];
      else out = [[c, 1]];
    }
    RK = out; RKp = p; RKt = t; return out;
  };
  // 共鳴倍數：沒裝這個藝能、或職業不符 → 0
  var M = function (art, cls) {
    var p = P(), D = DA(); if (!p || !D || p.classicMode) return 0; var a = D.act(p, art); if (!a) return 0;
    var k = 0; resList(p).forEach(function (x) { if (x[0] === cls) k = x[1]; }); return a * k * RS;
  };

  var RS = 0.6;   // 11-18 21:04 Ping：兩格 ★3＝目前輸出 ×3 → 共鳴的數值整體 ×0.6（說明文字照 ★0 設計值）
  // ── 狀態 ──
  var S = { ema: 0, mapAt: '', once: {}, cd: {}, horn: 0, hornEnd: 0 };
  var resetFight = function () { var cur = (typeof mapState !== 'undefined' && mapState.current) || ''; if (cur !== S.mapAt) { S.mapAt = cur; S.once = {}; } };
  var cdOk = function (k, ticks) { var t = now(); if ((S.cd[k] || 0) > t) return false; S.cd[k] = t + ticks; return true; };
  var atk = function (p) { var v = S.ema; if (!(v > 0)) { var d = p.d || {}; v = (Number(d.meleeDmg) || 0) + (Number(d.extraDmg) || 0) + 20; } return v; };
  var inner = 0;
  var hurt = function (m, amt, type) {   // 直接打（不再觸發共鳴）
    var p = P(), api = R(); if (!p || !m || m._dead || !(m.curHp > 0) || !(amt > 0)) return 0;
    inner++;
    try {
      // 直接扣血：不走出手流程（不會觸發武器特效、遺物追擊、轉生技藝的追加），只套魔防（魔法）或傷害減免（物理）
      var d = Math.floor(amt);
      if (type === 'magic') { try { d = Math.floor(d * ((W.mrMult || function () { return 1; })(Number(m.mr) || 0))); } catch (e) {} }
      else if (type !== 'true') d = Math.max(1, d - (Number(m.dr) || 0));
      return X() ? X().hitMob(m, d) : 0;
    } catch (e) { return 0; } finally { inner--; }
  };
  var stun = function (m, sec) { var api = R(); if (!api || !m || m.boss) return; try { api.status(m, 'stun', sec, 1); } catch (e) {} };
  var heal = function (e, n) { if (!e || !(n > 0)) return; var p = P(); if (e === p) p.hp = Math.min(p.mhp, (p.hp || 0) + Math.floor(n)); else if (!e._downed && e.curHp > 0) e.curHp = Math.min(e.mhp, e.curHp + Math.floor(n)); };
  var party = function (p) { return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && a.curHp > 0; })); };
  var allyOf = function (a) { var p = P(); return !!(p && a && (p.allies || []).indexOf(a) >= 0); };
  var burning = function (m) { var t = now(); return !!(m && ((m._artBurn && m._artBurn.until > t) || (m._dimBurn && m._dimBurn.until > t) || (m._art2Fire || 0) > t)); };
  var inked = function (m) { return !!(m && ((m._artInk || 0) > now() || (m._dimInk || 0) > now())); };
  var ignite = function (m, per) { var t = now(), b = m._artBurn && m._artBurn.until > t ? m._artBurn : (m._artBurn = { n: 0, per: 0, until: 0 }); b.n = Math.min(5, b.n + 1); b.per = Math.max(b.per, per); b.until = t + 60; };
  var ink = function (m) { m._artInk = now() + 60; m._dimInk = now() + 60; m._dimInkK = Math.max(m._dimInkK || 0, 0.4); };
  var isNight = function () { var h = new Date(Date.now() + 8 * 3600000).getUTCHours(); return h >= 18 || h < 6; };
  var moving = function (p) { try { var mv = W.AFK_RELIC_RUNTIME.state(p, '_movement'); return !!(mv && mv.moving); } catch (e) { return false; } };
  var skillHit = function (opt) { return !!(opt && !opt.packet && (opt.kind === 'magic' || opt.kind === 'mag' || opt.skillId || opt.kind === 'skill')); };
  var holyEnt = function (m) { return m && /不死|惡魔|黑暗/.test(String(m.race || '')) || (m && m.un); };
  var classSkill = function (opt, re) { var id = (opt && (opt.skillId || opt.skill)) || S.lastSk; var sk = id && DB.skills[id]; return !!(sk && re.test(String(sk.n || ''))); };

  // ── 號角吹響（afk-dimarts 呼叫）──
  W.__afkArtsHorn = function (p, t) {
    S.horn = t; S.hornEnd = t + 150; S.drum = 0; var ms = mobs(), x;
    if ((x = M('horn', 'royal'))) { S.guard = t + 150; clog(tag('王者凱旋', '三名亡靈近衛從你的傭兵影子裡站起來。')); }
    if ((x = M('horn', 'knight'))) { ms.forEach(function (m) { stun(m, 2); hurt(m, Math.min((m.boss || m._train ? 0.015 : 0.15) * (m.hp || m.curHp), atk(p) * 10) * x, 'physical'); }); clog(tag('衝鋒號', '一路衝過整個戰場。')); }
    if ((x = M('horn', 'mage'))) S.chant = 3;
    if ((x = M('horn', 'dark'))) { S.assassin = x; clog(tag('暗殺號令', '你消失在陰影裡。')); }
    if ((x = M('horn', 'illusion'))) { S.confuse = t + 50; ms.forEach(function (m) { if (!m.boss) stun(m, 5); }); clog(tag('幻聽', '敵人開始互相攻擊。')); }
    if ((x = M('horn', 'thunder'))) { for (var i = 0; i < 10 && ms.length; i++) { var m0 = ms[Math.floor(rnd() * ms.length)]; hurt(m0, atk(p) * 2 * x, 'magic'); m0._art2Mark = (m0._art2Mark || 0) + 1; } clog(tag('雷鳴', '十道雷落下。')); }
    if ((x = M('horn', 'berserker'))) { if (p.hp > p.mhp * 0.3) p.hp = Math.floor(p.mhp * 0.3); S.howl = t + 150; clog(tag('狂嚎')); }
    if ((x = M('horn', 'paladin'))) { S.angel = t + 150; clog(tag('天使之號', '三名光之天使降下。')); }
    if ((x = M('horn', 'darkknight'))) { var n = (S.deaths || []).filter(function (d) { return d > t - 100; }).length; S.ghost = { n: Math.min(10, n), until: t + 150 }; if (n) clog(tag('亡者號角', n + ' 隻亡靈站了起來。')); }
    if ((x = M('horn', 'runeblade'))) { S.swords = t + 150; clog(tag('劍之號令', '六把飛劍環繞在你身邊。')); }
    if (M('horn', 'dragon')) S.dragonForm = t + 150;
  };

  // ── 造成傷害 ──
  var hookOut = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkArts2) return; C.__afkArts2 = true;
    var o = C.damage, depth = 0;
    C.damage = function (actor, target, amount, opt) {
      var p = P(); opt = opt || {};
      if (depth > 0) return o.apply(this, arguments);   // 巢狀（追擊、連鎖、觸發）不再乘一次，免得倍率疊上去
      depth++; try { return outer.apply(this, arguments); } finally { depth--; }
    };
    var outer = function (actor, target, amount, opt) {
      var p = P(); opt = opt || {};
      if (inner || opt._dimNested || !p || !(amount > 0) || !target || target === p || target._isAlly || (target.cls && target.eq)) {
        // 傭兵、亡靈近衛類：王族密詔／燃燒中焦土／王冠
        if (!inner && p && actor && allyOf(actor) && amount > 0 && target && !target._isAlly) {
          var t0 = now(), mm = 1;
          if ((S.crown || 0) > t0) mm *= 2;
          if ((S.scorch || 0) > t0 && M('ember', 'royal')) mm *= 1 + 0.3 * M('ember', 'royal');
          if (S.envoy && S.envoy.a === actor && S.envoy.until > t0) mm *= 1.6;
          amount *= mm;
        }
        var r0 = o.apply(this, [actor, target, amount, opt]);
        try { if (!inner && p && actor && allyOf(actor) && r0 > 0 && S.envoy && S.envoy.a === actor && S.envoy.until > now()) heal(p, r0 * 0.3 * (M('ink', 'royal') || 1)); } catch (e) {}
        return r0;
      }
      var t = now(), x, mul = 1, add = 0, normal = !!opt.packet, skill = skillHit(opt) || (!normal && (S.lastSkAt || -9) === t);
      try {
        if (actor === p) {
          if ((x = M('horn', 'dark')) && S.assassin && normal) { mul *= 1 + 3 * S.assassin; S.assassin = 0; clog(tag('暗殺號令', '背後一擊。')); }
          if ((x = M('ink', 'dark')) && S.inkHideEnd && t >= S.inkHideEnd && normal) { mul *= 1 + 2 * x; S.inkHideEnd = 0; }
          if ((x = M('hardin', 'berserker'))) { var lo = S.minHp == null ? 1 : S.minHp; mul *= 1 + Math.min(0.9, Math.max(0, 1 - lo)) * x; }
          if ((x = M('horn', 'berserker')) && (S.howl || 0) > t) mul *= 1 + 0.5 * x;   /* 測試後下修：×2 → ×(1＋0.5×倍數) */
          if ((x = M('ember', 'berserker')) && S.bloodStack) mul *= 1 + Math.min(0.6 * x, S.bloodStack * 0.03 * x);
          if ((x = M('hardin', 'warrior'))) mul *= 1 + Math.min(0.3, Math.floor((S.kills || 0) / 100) * 0.01) * x;
          if ((x = M('horn', 'warrior')) && (S.hornEnd || 0) > t && normal) { S.drum = Math.min(20, (S.drum || 0) + 1); mul *= 1 + S.drum * 0.02 * x; }
          if ((x = M('ink', 'warrior')) && (target._art2Armor || 0) > t && !skill) mul *= 1 + 0.3 * x;
          if ((x = M('ember', 'illusion')) && (target._art2Fire || 0) > t) mul *= 1 + 0.15 * x;
          if ((x = M('light', 'paladin'))) { var lt = (p.afkDimRift && p.afkDimRift.light) || 0; if (lt > 0) mul *= 1 + 0.03 * lt * x; }
          if ((x = M('hardin', 'paladin')) && (S.blessing || 0) > t) mul *= 1 + 0.3 * x;
          if ((x = M('hardin', 'darkknight')) && target._art2Grim && target._art2Grim.until > t) mul *= 1 + Math.min(0.5, target._art2Grim.n * 0.05) * x;
          if ((x = M('sea', 'runeblade')) && target.e && target.e !== 'none') mul *= 1 + 0.2 * x;
          if ((x = M('hardin', 'runeblade')) && normal) { var nm = (p.skills || []).filter(function (id) { var k = DB.skills[id]; return k && k.reqM != null && k.type === 'atk'; }).length; mul *= 1 + Math.min(0.4, nm * 0.01) * x; if (S.runeNext) { add += S.runeNext; S.runeNext = 0; } }
          if ((x = M('sea', 'mage')) && S.ebb && skill) { mul *= 1 + x; S.ebb = false; clog(tag('潮汐魔力', '退潮——這一招 ×' + (1 + x).toFixed(1) + '。')); }
          if ((x = M('hardin', 'thunder'))) { S.tCount = (S.tCount || 0) + 1; if (S.tCount >= 10) { S.tCount = 0; mul *= 1 + 4 * x; clog(tag('審判之雷')); } }
          if ((x = M('ink', 'mage')) && (target._art2Seal || 0) > t) mul *= 1 + (target.boss ? 0.25 : 0.5) * x;
          if ((x = M('ink', 'thunder')) && (target._art2Black || 0) > t) mul *= 1 + 0.3 * x;
          if ((x = M('ink', 'dragon')) && (target._art2DragonInk || 0) > t) mul *= 1 + 0.3 * x;
          if (target._art2Dream && target._art2Dream.until > t && M('ink', 'illusion')) target._art2Dream.acc += amount * 0.5 * M('ink', 'illusion');
        }
      } catch (e) {}
      var r = o.apply(this, [actor, target, amount * mul + add, opt]);
      if (!(r > 0) || actor !== p) return r;
      try {
        var mm2 = mobs().filter(function (m) { return m !== target; });
        if (normal || skill) S.ema = S.ema ? S.ema * 0.95 + r * 0.05 : r;
        if (skill) S.castAt = now();
        if (normal && opt.packet.crit) { S.crits = (S.crits || []).concat([r]).slice(-5); }
        // 騎士：破浪
        if ((x = M('sea', 'knight')) && normal) { var w = r * 0.2 * x; mm2.slice(0, 3).forEach(function (m) { hurt(m, w); w *= 0.7; }); }
        // 妖精：森林迴聲、元素譜系
        if ((x = M('horn', 'elf')) && normal) { S.arrows = (S.arrows || 0) + 1; if (S.arrows >= 11) { S.arrows = 0; var all = mobs(); for (var i = 0; i < 10 && all.length; i++) hurt(all[Math.floor(rnd() * all.length)], r * 0.4 * x); clog(tag('森林迴聲', '第 11 箭分裂成 10 支追蹤箭。')); } }
        var skE = S.lastSk && DB.skills[S.lastSk] ? (DB.skills[S.lastSk].ele || DB.skills[S.lastSk].reqEle || '') : '';
        if ((x = M('hardin', 'elf')) && skill && (opt.element || skE)) { S.ele = S.ele || {}; S.ele[opt.element || skE] = 1; if (['fire', 'water', 'wind', 'earth'].every(function (e) { return S.ele[e]; })) { S.ele = {}; for (var j = 0; j < 4; j++) mobs().forEach(function (m) { hurt(m, atk(p) * 3 * x, 'magic'); }); clog(tag('四元素合奏')); } }
        if ((x = M('ink', 'elf')) && isNight()) target._art2Blind = now() + 30;
        // 法師
        if ((x = M('horn', 'mage')) && S.chant > 0 && skill) { S.chant--; mm2.forEach(function (m) { hurt(m, r, 'magic'); }); }
        if ((x = M('light', 'mage')) && skill && (S.echoAt || 0) !== now()) { S.echoAt = now(); (S.echo = S.echo || []).push({ at: now() + 60, m: target, v: r * 0.4 * x }); }
        if ((x = M('ink', 'mage')) && skill && rnd() < 0.15) { target._art2Seal = now() + 30; stun(target, 3); }
        // 黑暗妖精：殘影
        if ((x = M('light', 'dark')) && normal && S.shadows) { S.shadows = S.shadows.filter(function (u) { return u > now(); }); S.shadows.forEach(function () { hurt(target, r * 0.5 * x); }); }
        // 龍騎士：龍吼
        if ((x = M('horn', 'dragon')) && normal && (S.dragonForm || 0) > now()) mm2.slice(0, 2).forEach(function (m) { hurt(m, r * x); });
        if ((x = M('sea', 'dragon')) && (S.waterDragon || 0) > now()) hurt(target, r * 2 * x, 'magic');
        if ((x = M('hardin', 'dragon')) && skill && classSkill(opt, /龍|屠宰|血之渴望|奪命|岩漿|護衛毀滅|恐懼|驚悚/)) { S.words = (S.words || 0) + 1; if (S.words >= 4) { S.words = 0; mobs().forEach(function (m) { stun(m, 2); m._art2DragonInk = now() + 100; }); clog(tag('真龍語', '全場暈眩 2 秒。')); } }
        // 幻術士：幻火
        if ((x = M('ember', 'illusion'))) target._art2Fire = now() + 60;
        // 戰士：熔鐵斧、墨甲破碎
        if ((x = M('ember', 'warrior')) && normal && p.eq && p.eq.offwpn) { target._art2Alt = (target._art2Alt || 0) + 1; if (target._art2Alt >= 6) { target._art2Alt = 0; hurt(target, atk(p) * 6 * x, 'magic'); clog(tag('熔鐵斧')); } }
        if ((x = M('ink', 'warrior')) && normal && opt.packet.crit && rnd() < 0.3) target._art2Armor = now() + 100;
        if ((x = M('sea', 'warrior')) && normal && S.wave) { S.wave = false; mobs().forEach(function (m) { hurt(m, atk(p) * 3 * x); }); clog(tag('怒濤')); }
        // 雷神：雷火、黑雷、雷雨
        if ((x = M('ember', 'thunder')) && skill && target._artBurn && target._artBurn.until > now() && (target._art2Boom || 0) <= now()) { target._art2Boom = now() + 100; var b = target._artBurn, left = Math.max(0, (b.until - now()) / 10); hurt(target, b.per * b.n * left, 'magic');   /* 測試後下修：剩下的燃燒一次打完（不再 ×1.5） */ target._artBurn = null; clog(tag('雷火', '燃燒一次引爆。')); }
        if ((x = M('ink', 'thunder'))) { target._art2Mark = (target._art2Mark || 0) + 1; if (target._art2Mark >= 5) { target._art2Mark = 0; target._art2Black = now() + 50; if (!target.boss) { try { R().status(target, 'silence', 3, 1); } catch (e) {} } } }
        if ((x = M('sea', 'thunder')) && (S.rain || 0) > now() && skill) mm2.slice(0, 2).forEach(function (m) { hurt(m, r * 0.5 * x, 'magic'); });
        // 狂戰士、熾燼：燃血；吸血
        if ((x = M('horn', 'berserker')) && (S.howl || 0) > now()) heal(p, r * 0.1 * x);
        if ((x = M('light', 'berserker')) && p.hp < p.mhp * 0.2) heal(p, r * 0.5 * x);
        if ((x = M('light', 'warrior')) && (S.unfall || 0) > now()) heal(p, r * 0.3 * x);
        // 神聖劍士：聖火
        if ((x = M('ember', 'paladin')) && holyEnt(target) && burning(target)) hurt(target, r * 0.5 * x, 'magic');
        if ((x = M('hardin', 'paladin')) && skill) { S.pages = (S.pages || 0) + 1; if (S.pages >= 7) { S.pages = 0; S.blessing = now() + 100; clog(tag('聖典', '神的祝福降在全隊身上。')); } }
        // 暗黑騎士：深淵契約
        if ((x = M('ink', 'darkknight')) && S.abyss && S.abyss.until > now() && normal && S.abyss.pool > 0) { var a1 = Math.min(S.abyss.pool, S.abyss.per); S.abyss.pool -= a1; hurt(target, a1, 'magic'); }
        // 魔劍士：飛劍、熔劍、墨刃、魔劍典籍
        if ((x = M('horn', 'runeblade')) && (S.swords || 0) > now() && normal) for (var s1 = 0; s1 < 6; s1++) hurt(target, r * 0.3 * x);
        if ((x = M('ember', 'runeblade')) && skill) (S.melt = S.melt || []).push({ at: now() + 30, m: target, v: atk(p) * 0.8 * x });
        if ((x = M('ink', 'runeblade')) && S.inkBlade > 0) { S.inkBlade--; ink(target); }
        if ((x = M('hardin', 'runeblade')) && skill) S.runeNext = Math.min(r, (S.ema || r) * 2) * 0.5 * x;   /* 一招最多算平均傷害 2 倍 */
        // 號角：王族亡靈近衛（每次你打中都跟著打）
        if ((x = M('horn', 'royal')) && (S.guard || 0) > now() && normal) for (var g = 0; g < 3; g++) hurt(target, r * 0.5 * x);
        // 亡者號角
        if ((x = M('horn', 'darkknight')) && S.ghost && S.ghost.until > now() && normal) for (var g2 = 0; g2 < S.ghost.n; g2++) hurt(target, r * 0.3 * x);
      } catch (e) { console.warn('[AFK-dimarts2] out', e); }
      return r;
    };
  };

  // ── 受到傷害 ──
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    var p = P(); if (!p || !ent) return 1; var t = now(), k = 1, x;
    try {
      if (ent === p) {
        if ((S.unfall || 0) > t) return 0;
        if ((S.waterDragon || 0) > t) return 0;
        if ((S.inkHide || 0) > t) return 0;
        if (mob && (mob._art2Mute || 0) > t) return 0;
        if (mob && (mob._art2Blind || 0) > t && isNight() && M('ink', 'elf')) return mob.boss ? 0.5 : 0;
        if (mob && (S.confuse || 0) > t && mob.boss && M('horn', 'illusion')) return 0;
        if ((x = M('sea', 'elf')) && (S.song || 0) > t && moving(p)) k *= 1 - 0.3 * x;
        if ((x = M('horn', 'dragon')) && (S.dragonForm || 0) > t) k *= 1 - Math.min(0.6, 0.2 * x);
        if ((x = M('light', 'dragon')) && S.scales) k *= 1 - Math.min(0.6, S.scales * 0.02 * x);
        if ((x = M('sea', 'darkknight'))) k *= 1 - Math.min(0.5, 0.2 * x);
        if ((x = M('hardin', 'knight')) && mob) { var key = (mob.n || '') + '|' + (mob._lastKind || ''); if (S.book && S.book[key]) k *= 0.5; }
        if ((x = M('hardin', 'paladin')) && (S.blessing || 0) > t) k *= 1 - Math.min(0.6, 0.3 * x);
      } else if (allyOf(ent)) {
        if ((S.crown || 0) > t) return 0;
        if ((x = M('hardin', 'paladin')) && (S.blessing || 0) > t) k *= 1 - Math.min(0.6, 0.3 * x);
      }
    } catch (e) {}
    return Math.max(0, k);
  });
  var hookX = function () {
    var x0 = X(); if (!x0 || hookX.done) return; hookX.done = true;
    x0.on('taken', function (ent, dmg, mob, kind) {
      var p = P(); if (!p || ent !== p || !(dmg > 0)) return dmg; var t = now(), x;
      try {
        if (mob) mob._lastKind = kind || '';
        if ((x = M('light', 'darkknight')) && mob && (mob.e === 'light' || /光|神聖|天使/.test(String(mob.n || '')))) { heal(p, dmg); return 0; }
        if ((x = M('hardin', 'knight')) && mob) { S.book = S.book || {}; var key = (mob.n || '') + '|' + (kind || ''); if (!S.book[key] && Object.keys(S.book).length < 5) S.book[key] = 1; }
        if ((x = M('ember', 'knight'))) { S.heat = (S.heat || 0) + dmg * 0.2; if (S.heat >= p.mhp * 0.5) { var h = S.heat; S.heat = 0; mobs().forEach(function (m) { hurt(m, h * 3 * x, 'magic'); }); clog(tag('熔爐盾', '熱量爆開。')); } }
        if ((x = M('ink', 'knight')) && mob && rnd() < 0.15) { mob._art2InkN = (mob._art2InkN || 0) + 1; if (mob._art2InkN >= 5) { mob._art2InkN = 0; mob._art2Mute = t + 50; clog(tag('黑盾', esc0(mob.n) + ' 5 秒內打不出傷害。')); } }
        if ((x = M('light', 'illusion')) && rnd() < 0.2) { S.shards = (S.shards || 0) + 1; if (S.shards >= 10) { S.shards = 0; S.phantom = t + 200; clog(tag('夢的碎片', '幻影的你站了起來。')); } }
        if ((x = M('sea', 'illusion')) && mob && /mag/.test(String(kind || ''))) hurt(mob, dmg * 0.15 * x, 'magic');
        if ((x = M('light', 'dragon'))) S.scales = Math.min(10, (S.scales || 0) + 1);
        if ((x = M('light', 'thunder'))) { S.charge = (S.charge || 0) + dmg * 0.2; if (S.charge >= p.mhp * 0.5) { var c = S.charge; S.charge = 0; mobs().forEach(function (m) { hurt(m, c * 2 * x, 'magic'); }); clog(tag('導雷針', '電荷放出。')); } }
        if ((x = M('ink', 'berserker'))) mobs().slice(0, 4).forEach(function (m) { hurt(m, dmg * 0.5 * x); ink(m); });
        if ((x = M('sea', 'warrior'))) { S.waveAcc = (S.waveAcc || 0) + dmg; if (S.waveAcc >= p.mhp * 0.25) { S.waveAcc = 0; S.wave = true; } }
        if ((x = M('light', 'runeblade')) && mob && S.runeLight) { S.runeLight = false; hurt(mob, dmg * 2 * x, 'magic'); clog(tag('符文之光', '反彈。')); }
        if ((S.oath || 0) > t) S.oathAcc = (S.oathAcc || 0) + dmg;
        S.tookAt = t; S.takenSum = (S.takenSum || 0) + dmg;
      } catch (e) {}
      return dmg;
    });
    x0.on('death', function () {
      var p = P(); if (!p) return false; resetFight(); var t = now(), x;
      if ((x = M('light', 'knight')) && !S.once.oath) { S.once.oath = 1; S.oath = t + 120; S.oathAcc = 0; p.hp = 1; clog(tag('不滅誓言', '你化成了光之騎士。')); return true; }
      if ((S.oath || 0) > t) { p.hp = 1; return true; }
      if ((x = M('light', 'warrior')) && cdOk('unfall', 900)) { S.unfall = t + 50; p.hp = 1; clog(tag('不倒者')); return true; }
      if ((S.unfall || 0) > t) { p.hp = 1; return true; }
      if ((x = M('light', 'royal')) && !S.once.crown) { S.once.crown = 1; S.crown = t + 100; S.crownKills = 0; p.hp = 1; clog(tag('王冠的餘暉', '王冠留在原地——10 秒內傭兵打倒 5 隻怪，你就回來。')); return true; }
      if ((S.crown || 0) > t) { p.hp = 1; return true; }
      return false;
    });
    x0.on('evade', function (mob) {
      var p = P(); if (!p) return; var x;
      if ((x = M('light', 'dark'))) { S.shadows = (S.shadows || []).filter(function (u) { return u > now(); }); if (S.shadows.length < 3) S.shadows.push(now() + 50); }
      if ((x = M('hardin', 'darkknight')) && mob) { var g = mob._art2Grim && mob._art2Grim.until > now() ? mob._art2Grim : (mob._art2Grim = { n: 0, until: 0 }); g.n = Math.min(10, g.n + 1); g.until = now() + 100; }
    });
    x0.on('kill', function (m) {
      var p = P(); if (!p || !m) return; var t = now(), x;
      S.kills = (S.kills || 0) + 1; (S.deaths = S.deaths || []).push(t); if (S.deaths.length > 30) S.deaths.shift();
      if ((S.crown || 0) > t) { S.crownKills = (S.crownKills || 0) + 1; if (S.crownKills >= 5) { S.crown = 0; p.hp = Math.max(p.hp, Math.floor(p.mhp * 0.5)); clog(tag('王冠的餘暉', '你重新戴上王冠。')); } }
      if ((x = M('ember', 'royal'))) S.scorch = t + 80;
      if ((x = M('ember', 'mage')) && m._artBurn && m._artBurn.until > t) { var b = m._artBurn; mobs().filter(function (y) { return y !== m; }).slice(0, 2).forEach(function (y) { y._artBurn = { n: b.n, per: b.per, until: t + 60 }; }); }
      if ((x = M('ember', 'dark')) && m.st && m.st.poison > 0) mobs().slice(0, 3).forEach(function (y) { try { R().status(y, 'poison', 5, 1); } catch (e) {} });
      if ((x = M('ink', 'paladin')) && inked(m)) party(p).forEach(function (e) { heal(e, e.mhp * 0.03 * x); });
      if ((x = M('ink', 'dragon')) && m.st && (m.st.expose || 0) > 0) { var y0 = mobs()[0]; if (y0) { y0.st = y0.st || {}; y0.st.expose = Math.min(3, (y0.st.expose || 0) + m.st.expose); } }
      if ((x = M('sea', 'berserker'))) { heal(p, p.mhp * 0.05 * x); S.streak = (S.lastKill && t - S.lastKill <= 50) ? (S.streak || 0) + 1 : 1; S.lastKill = t; if (S.streak >= 10) { S.streak = 0; party(p).forEach(function (e) { heal(e, e.mhp * 0.3 * x); }); clog(tag('血潮')); } }
      if ((x = M('ember', 'paladin')) && holyEnt(m)) party(p).forEach(function (e) { heal(e, e.mhp * 0.02 * x); });
    });
  };

  // ── 每秒 ──
  var tickSec = function () {
    var p = P(); if (!p || p.dead || p.classicMode) return; resetFight(); var t = now(), x, ms = mobs(), fight = ms.length > 0, T = tgt();
    // 狂戰士之書：最低 HP
    if (M('hardin', 'berserker')) { var r0 = p.hp / Math.max(1, p.mhp); S.minHp = S.minHp == null || !fight ? r0 : Math.min(S.minHp, r0); }
    if (!fight) return;
    // 王族
    if ((x = M('ember', 'royal')) && (S.scorch || 0) > t) ms.forEach(function (m) { hurt(m, p.mhp * 0.03 * x, 'magic'); });
    if ((x = M('ink', 'royal')) && cdOk('envoy', 300)) { var al = party(p).slice(1); if (al.length) { S.envoy = { a: al[Math.floor(rnd() * al.length)], until: t + 100 }; clog(tag('密詔', '密使出發了。')); } }
    if ((x = M('sea', 'royal')) && cdOk('tide', 600)) { party(p).forEach(function (e) { if (e !== p) { e.curHp = e.mhp; e.statuses = {}; } }); p.statuses = {}; S.immune = t + 50; clog(tag('潮汐徵召', '漲潮了。')); }
    if ((x = M('hardin', 'royal')) && T && cdOk('library', 100)) { var sks = []; (p.allies || []).forEach(function (a) { (a.skills || []).forEach(function (id) { var k = DB.skills[id]; if (k && k.type === 'atk' && k.dmgDice) sks.push(k); }); }); if (sks.length) { var k0 = sks[Math.floor(rnd() * sks.length)]; hurt(T, atk(p) * 2 * x, 'magic'); clog(tag('王室藏書', '你施放了「' + esc0(k0.n) + '」。')); } }
    if ((S.crown || 0) && S.crown <= t && S.crown > t - 10 && S.crownKills < 5) { S.crown = 0; p.hp = 0; try { if (typeof killPlayer === 'function') killPlayer(); } catch (e) {} }
    // 騎士：不滅誓言結束
    if (S.oath && S.oath <= t && S.oathAcc != null) { var acc = Math.min(S.oathAcc, p.mhp * 3) * (M('light', 'knight') || 1); S.oathAcc = null; S.oath = 0; if (T && acc > 0) { hurt(T, acc); clog(tag('不滅誓言', '光之騎士的一擊。')); } }
    // 妖精
    if ((x = M('light', 'elf')) && cdOk('sprout', 200)) { S.sprout = t + 100; var st0 = ms.find(function (m) { return !m.boss; }); if (st0) stun(st0, 2); }
    if ((x = M('light', 'elf')) && (S.sprout || 0) > t) party(p).forEach(function (e) { heal(e, e.mhp * 0.03 * x); });
    if ((x = M('ember', 'elf')) && cdOk('fireSpirit', 300)) { ms.forEach(function (m) { hurt(m, atk(p) * 3 * x, 'magic'); }); clog(tag('火之契約', '精靈爆開，又以火精靈重生。')); }
    if ((x = M('sea', 'elf')) && cdOk('song', 300)) S.song = t + 60;
    if ((x = M('sea', 'elf')) && (S.song || 0) > t) party(p).forEach(function (e) { heal(e, e.mhp * 0.02 * x); });
    // 法師
    if ((x = M('light', 'mage')) && S.echo && S.echo.length) S.echo = S.echo.filter(function (e) { if (e.at > t) return true; if (e.m && !e.m._dead) hurt(e.m, e.v, 'magic'); return false; });
    if ((x = M('sea', 'mage'))) { if (p.mp < p.mmp * 0.5) p.mp = Math.min(p.mmp, p.mp + Math.floor(p.mmp * 0.05 * x)); else if (p.mp >= p.mmp) S.ebb = true; }
    if ((x = M('hardin', 'mage')) && cdOk('forbid', 600)) { S.forbid = t + 300; clog(tag('禁書', '你翻開了一頁禁書。')); }
    if ((x = M('hardin', 'mage')) && (S.forbid || 0) > t && t % 30 === 0 && T) hurt(T, atk(p) * 2 * x, 'magic');
    // 黑暗妖精
    if ((x = M('ember', 'dark'))) ms.forEach(function (m) { if (m.st && m.st.poison > 0) hurt(m, atk(p) * 0.3 * x, 'magic'); });
    if ((x = M('ink', 'dark')) && cdOk('inkHide', 200)) { S.inkHide = t + 40; S.inkHideEnd = t + 40; }
    if ((x = M('sea', 'dark')) && cdOk('undertow', 100)) ms.slice(0, 3).forEach(function (m) { hurt(m, atk(p) * x); });
    if ((x = M('hardin', 'dark')) && cdOk('shadowBook', 300) && S.crits && S.crits.length && T) { var avg = S.crits.reduce(function (a, b) { return a + b; }, 0) / S.crits.length; for (var i = 0; i < 5; i++) hurt(T, avg * x, 'true'); clog(tag('影之書')); }
    // 龍騎士
    if ((x = M('light', 'dragon')) && S.scales && cdOk('scales', 300) && T) { for (var j = 0; j < S.scales; j++) hurt(T, atk(p) * x); S.scales = 0; clog(tag('光龍的鱗', '光鱗全部射出。')); }
    if ((x = M('ember', 'dragon')) && (S.castAt || -99) >= t - 10) { var drop = (S.lastHp != null ? S.lastHp - p.hp : 0) - (S.takenSum || 0); if (drop > 0) ms.forEach(function (m) { hurt(m, drop * 3 * x, 'magic'); }); }
    if ((x = M('sea', 'dragon')) && p.hp < p.mhp * 0.3 && cdOk('waterDragon', 600)) { S.waterDragon = t + 60; clog(tag('水龍的記憶', '水龍的幻影擋在你前面。')); }
    // 幻術士
    if ((x = M('light', 'illusion')) && (S.phantom || 0) > t && T) hurt(T, atk(p) * 0.6 * x);
    if ((x = M('ink', 'illusion')) && cdOk('inkDream', 50) && T) { if (T._art2Dream && T._art2Dream.until <= t) { hurt(T, T._art2Dream.acc, 'magic'); T._art2Dream = null; } else if (!T._art2Dream) T._art2Dream = { until: t + 30, acc: 0 }; }
    ms.forEach(function (m) { if (m._art2Dream && m._art2Dream.until <= t) { hurt(m, m._art2Dream.acc, 'magic'); m._art2Dream = null; } });
    if ((x = M('hardin', 'illusion')) && cdOk('fiction', 250)) {
      var pick = Math.floor(rnd() * 4);
      if (pick === 0) ms.forEach(function (m) { hurt(m, atk(p) * 4 * x, 'magic'); });
      else if (pick === 1) S.inkHide = t + 20;
      else if (pick === 2) ms.forEach(function (m) { stun(m, 3); });
      else { try { var cd = p.cds || {}; Object.keys(cd).forEach(function (k) { if (typeof cd[k] === 'number') cd[k] = 0; }); } catch (e) {} }
      clog(tag('虛構的魔法', ['全場 400%', '全隊無敵 2 秒', '全場定身 3 秒', '冷卻全部歸零'][pick]));
    }
    // 戰士
    if ((x = M('horn', 'warrior')) && S.drum && (S.hornEnd || 0) <= t) { var dn = S.drum; S.drum = 0; ms.forEach(function (m) { hurt(m, atk(p) * dn * 0.5 * x); }); clog(tag('戰鼓', '震地 ×' + dn + '。')); }
    // 雷神
    if ((x = M('sea', 'thunder')) && cdOk('rain', 600)) { S.rain = t + 200; clog(tag('雷雨', '下雨了。')); }
    // 狂戰士：燃血
    if ((x = M('ember', 'berserker'))) { if (p.hp >= p.mhp) S.bloodStack = 0; else { var c1 = Math.floor(p.mhp * 0.01); if (p.hp > c1 + 1) { p.hp -= c1; S.bloodStack = Math.min(20, (S.bloodStack || 0) + 1); } } }
    // 神聖劍士
    if ((x = M('horn', 'paladin')) && (S.angel || 0) > t && t % 30 === 0) for (var a2 = 0; a2 < 3; a2++) { var lowest = party(p).sort(function (a, b) { return a.curHp / a.mhp - b.curHp / b.mhp; })[0]; if (lowest) heal(lowest, lowest.mhp * 0.05 * x); if (T) hurt(T, atk(p) * 1.5 * x, 'magic'); }
    if ((x = M('sea', 'paladin')) && cdOk('baptism', 400)) { party(p).forEach(function (e) { e.statuses = {}; }); S.immune = t + 50; clog(tag('洗禮')); }
    // 暗黑騎士
    if ((x = M('ink', 'darkknight')) && cdOk('abyss', 300)) { var sac = Math.floor(p.hp * 0.1); p.hp -= sac; S.abyss = { until: t + 100, pool: sac * 3 * x, per: sac * 3 * x / 10 }; clog(tag('深淵契約', '你獻祭了 ' + sac.toLocaleString() + ' HP。')); }
    if ((x = M('ember', 'darkknight'))) ms.forEach(function (m) { if (burning(m)) { if (m._art2Hp != null && m.curHp > m._art2Hp) { var up = Math.min(m.curHp - m._art2Hp, atk(p) * 2 * x); m.curHp -= up; hurt(m, up, 'magic'); } m._art2Hp = m.curHp; } });
    // 魔劍士
    if ((x = M('light', 'runeblade')) && cdOk('runeLight', 150)) S.runeLight = true;
    if ((x = M('ember', 'runeblade')) && S.melt && S.melt.length) S.melt = S.melt.filter(function (e) { if (e.at > t) return true; if (e.m && !e.m._dead) hurt(e.m, e.v, 'magic'); return false; });
    if ((x = M('ink', 'runeblade'))) { var ele = ''; try { ele = typeof getWpnEle === 'function' ? getWpnEle(p) : ''; } catch (e) {} if (S.lastEle != null && ele !== S.lastEle) S.inkBlade = 5; S.lastEle = ele; }
    S.lastHp = p.hp; S.takenSum = 0;
  };
  // 異常免疫（潮汐徵召、洗禮）
  var hookResist = function () {
    var o = W.playerStatusResisted; if (typeof o !== 'function' || o.__afkArts2) return;
    var f = function () { if ((S.immune || 0) > now()) return true; return o.apply(this, arguments); };
    f.__afkArts2 = true; W.playerStatusResisted = f; try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  };
  // 瀕死之光：HP 低於 20% 受到的治療 ×3
  if (typeof W.foulWaterHealMult === 'function') {
    var oF = W.foulWaterHealMult;
    W.foulWaterHealMult = function (t) { var v = oF.apply(this, arguments); try { var p = P(), x; if (t === p && (x = M('light', 'berserker')) && p.hp < p.mhp * 0.2) v *= 1 + 2 * x; } catch (e) {} return v; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  var esc0 = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  if (typeof W.tick === 'function') {
    var oT = W.tick;
    W.tick = function () {
      var t0 = now(), r = oT.apply(this, arguments);
      try { var t = now(); if (t !== t0 && t % 10 === 0) tickSec(); } catch (e) { console.warn('[AFK-dimarts2] tick', e); }
      return r;
    };
  }
  // 施放技能：記下是哪一招（核心的傷害結算沒有帶技能名稱）
  var hookCast = function () {
    var o = W.castSkill; if (typeof o !== 'function' || o.__afkArts2) return;
    var f = function (id) { try { S.lastSk = id; S.lastSkAt = now(); var k = DB.skills[id]; if (k && k.type === 'atk') S.castAt = now(); } catch (e) {} return o.apply(this, arguments); };
    f.__afkArts2 = true; W.castSkill = f; try { (0, eval)('castSkill = window.castSkill'); } catch (e) {}
  };
  var hookAll = function () { hookOut(); hookX(); hookResist(); hookCast(); };
  hookAll(); W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); });

  // ── 說明文字（設計稿第四節）──
  var CLS_N = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士', thunder: '雷神', berserker: '狂戰士', paladin: '神聖劍士', darkknight: '暗黑騎士', runeblade: '魔劍士' };
  var TXT = {
    royal: { horn: ['王者凱旋', '號角響起時，三名亡靈近衛跟著你出手 15 秒（每名你那一擊的 50%）'], light: ['王冠的餘暉', '倒下時王冠留在原地 10 秒，傭兵全員無敵、傷害 ×2；10 秒內傭兵打倒 5 隻怪你就復活（每場一次）'], ember: ['焦土詔令', '打倒的怪留下 8 秒焦土：傭兵傷害 +30%，敵人每秒受到你最大 HP 3% 的傷害'], ink: ['密詔', '每 30 秒指定一名傭兵當密使 10 秒：傷害 ×1.6，傷害的 30% 轉成你的 HP'], sea: ['潮汐徵召', '每 60 秒漲潮：傭兵 HP 回滿、減益全部清除，你 5 秒免疫異常'], hardin: ['王室藏書', '每 10 秒施放一招傭兵會的攻擊魔法（攻擊力 200%）'] },
    knight: { horn: ['衝鋒號', '號角響起時全場暈眩 2 秒，受到最大 HP 15%（頭目 1.5%）的傷害'], light: ['不滅誓言', '每場第一次受到致命傷時化成光之騎士 12 秒：不會倒下，受到的傷害累積成下一擊（最多你最大 HP 300%）'], ember: ['熔爐盾', '受到傷害的 20% 存成熱量，存滿你最大 HP 50% 時爆炸，全場受到熱量 ×3'], ink: ['黑盾', '被打中時 15% 留墨痕，滿 5 層時那隻怪 5 秒打不出傷害'], sea: ['破浪', '一般攻擊的傷害 20% 傳給後面 3 隻怪（每傳一隻 −30%）'], hardin: ['戰術手冊', '記住打中你的招式（每場最多 5 招），之後同一招傷害 −50%'] },
    elf: { horn: ['森林迴聲', '每第 11 次一般攻擊分裂成 10 支追蹤箭（各 40%）'], light: ['世界樹的露', '每 20 秒種下光芽 10 秒：全隊每秒回 3% HP，一隻怪暈眩 2 秒'], ember: ['火之契約', '每 30 秒精靈爆開，全場攻擊力 300%，再以火精靈重生'], ink: ['夜影弓', '夜晚（台灣時間 18:00～06:00）命中的目標 3 秒內打不到你（頭目 −50%）'], sea: ['水精靈之歌', '每 30 秒唱 6 秒：全隊每秒回 2% HP，移動中受到的傷害 −30%'], hardin: ['元素譜系', '放過火水風地四種魔法後，全場 4 段各 300%'] },
    mage: { horn: ['詠唱號角', '號角響起後 3 個攻擊魔法同時打全場'], light: ['光之殘響', '施法 6 秒後同一個魔法再打一次（40%）'], ember: ['餘燼法典', '燃燒中的敵人死亡時，燃燒跳到最近 2 隻（層數保留）'], ink: ['黑墨封咒', '攻擊魔法 15% 把目標封進墨裡 3 秒：暈眩、受到的傷害 +50%（頭目只有 +25%）'], sea: ['潮汐魔力', 'MP 低於 50% 每秒回 5% MP；MP 滿時下一個魔法 ×2'], hardin: ['禁書', '每 60 秒翻開禁書 30 秒：每 3 秒多放一招他職業的攻擊（攻擊力 200%）'] },
    dark: { horn: ['暗殺號令', '號角響起時下一次一般攻擊 ×4'], light: ['殘影', '迴避成功留下殘影（最多 3 個，5 秒），跟著你的一般攻擊（50%）'], ember: ['燼毒', '中毒的敵人每秒受到攻擊力 30% 火傷，死亡時把毒傳給周圍 3 隻'], ink: ['墨隱', '每 20 秒墨隱 4 秒：不受傷害，結束後第一擊 ×3'], sea: ['暗流', '每 10 秒穿過 3 隻怪，各打一次攻擊力 100%'], hardin: ['影之書', '每 30 秒用最近 5 次爆擊的平均打 5 下真實傷害'] },
    dragon: { horn: ['龍吼', '號角期間一般攻擊同時打 2 隻、受到的傷害 −20%'], light: ['光龍的鱗', '每受到一次傷害長一片光鱗（最多 10 片，每片受傷 −2%），每 30 秒全部射出（每片攻擊力 100%）'], ember: ['熔岩之血', '技能消耗的 HP ×300% 變成全場火傷'], ink: ['闇龍之契', '打倒有弱點的怪時，弱點層數轉給下一隻'], sea: ['水龍的記憶', 'HP 低於 30% 時水龍替你擋 6 秒（每 60 秒一次），期間每擊附加 200% 水傷'], hardin: ['龍語辭典', '每 4 次龍語技能發動真龍語：全場暈眩 2 秒、10 秒內受到的傷害 +30%'] },
    illusion: { horn: ['幻聽', '號角響起時一般怪暈眩 5 秒，頭目 5 秒打不中你'], light: ['夢的碎片', '受到傷害 20% 掉碎片，10 片召出幻影的你 20 秒（每秒攻擊力 60%）'], ember: ['幻火', '你打過的敵人算燃燒中 6 秒，受到的傷害 +15%'], ink: ['墨夢', '每 5 秒把目標拉進墨夢 3 秒，期間受到的傷害醒來時再加 50% 一次結算'], sea: ['鏡湖', '受到的魔法 15% 照回施法者'], hardin: ['虛構的魔法', '每 25 秒隨機一種：全場 400%、無敵 2 秒、全場定身 3 秒、冷卻全部歸零'] },
    warrior: { horn: ['戰鼓', '號角期間每次一般攻擊疊一層（最多 20，每層傷害 +2%），結束時震地（每層 50%）'], light: ['不倒者', 'HP 歸零時改成留 1 點、5 秒不受傷害，期間傷害的 30% 回成 HP（每 90 秒一次）'], ember: ['熔鐵斧', '雙持時對同一目標每 6 次一般攻擊爆發 600% 火傷'], ink: ['墨甲破碎', '一般攻擊爆擊時 30% 讓目標 10 秒受到的物理傷害 +30%'], sea: ['怒濤', '每受到最大 HP 25% 的傷害，下一擊變成全場 300%'], hardin: ['戰史', '每打倒 100 隻怪傷害 +1%（最多 30%，這次登入期間）'] },
    thunder: { horn: ['雷鳴', '號角響起時落下 10 道雷（每道攻擊力 200%）'], light: ['導雷針', '受到傷害的 20% 存成電荷，存滿最大 HP 50% 時全場雷擊（電荷 ×2）'], ember: ['雷火', '技能打中燃燒中的目標時，剩下的燃燒一次打完（同一隻每 10 秒一次）'], ink: ['黑雷', '同一目標打中 5 次時沉默 3 秒（頭目改成受到的傷害 +30%）'], sea: ['雷雨', '每 60 秒下雨 20 秒：技能連鎖 2 隻（50%）'], hardin: ['雷霆經典', '每第 10 次攻擊 ×5'] },
    berserker: { horn: ['狂嚎', '號角響起時 HP 扣到 30%，15 秒傷害 ×1.5、吸血 10%'], light: ['瀕死之光', 'HP 低於 20% 時受到的治療 ×3、傷害的 50% 回成 HP'], ember: ['燃血', '沒滿血時每秒扣 1% HP，換傷害 +3%（最多 +60%）'], ink: ['黑血', '被打中時周圍 4 隻受到這次傷害的 50% 並中墨汁'], sea: ['血潮', '打倒怪回 5% HP，連續 10 隻時全隊回 30%'], hardin: ['狂戰士之書', '這場戰鬥 HP 最低到多少，傷害就加多少（最多 +90%）'] },
    paladin: { horn: ['天使之號', '號角期間每 3 秒三名天使各治療 HP 最低的隊友 5%、打 150%'], light: ['殷海薩的殘光', '每層光蝕傷害 +3%'], ember: ['聖火', '對燃燒中的不死、惡魔再打 50%；燒死牠們時全隊回 2% HP'], ink: ['贖罪', '中墨汁的敵人被打倒時全隊回 3% HP'], sea: ['洗禮', '每 40 秒全隊清除減益、你 5 秒免疫異常'], hardin: ['聖典', '每 7 次技能全隊「神的祝福」10 秒：傷害 +30%、受到的傷害 −30%'] },
    darkknight: { horn: ['亡者號角', '號角響起時，最近 10 秒死掉的怪化成亡靈，跟著你一般攻擊 15 秒（每隻 30%）'], light: ['墮光', '受到光屬性、神聖的傷害改成回血'], ember: ['黑焰', '燃燒中的敵人回的血改成傷害'], ink: ['深淵契約', '每 30 秒獻祭 10% HP，10 秒內一般攻擊附加獻祭量 ×3'], sea: ['死海', '受到的傷害 −20%'], hardin: ['黑魔導書', '迴避一次，10 秒內對那隻怪傷害 +5%（最多 +50%）'] },
    runeblade: { horn: ['劍之號令', '號角期間每次一般攻擊六把飛劍一起打（各 30%）'], light: ['符文之光', '每 15 秒下一次受到的傷害反彈 200%'], ember: ['熔劍', '技能命中留熔痕，3 秒後爆炸（攻擊力 80%）'], ink: ['墨刃', '換武器屬性時接下來 5 擊附帶墨汁'], sea: ['水之刃', '對有屬性的目標傷害 +20%'], hardin: ['魔劍典籍', '每個攻擊魔法讓一般攻擊 +1%（最多 40%）；放魔法後下一次一般攻擊附帶它的 50%'] }
  };
  W.__afkArtRes = { M: M, resList: resList, TXT: TXT, CLS_N: CLS_N, S: S, txt: function (p, art) {
    p = p || P(); if (!p) return []; return resList(p).map(function (x) { var t = TXT[x[0]] && TXT[x[0]][art]; return t ? { cls: CLS_N[x[0]], k: x[1], n: t[0], d: t[1] } : null; }).filter(Boolean);
  } };
})();
