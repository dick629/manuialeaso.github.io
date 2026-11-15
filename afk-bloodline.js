/* ============================================================================
 * afk-bloodline.js — 巔峰「命脈」（職業血脈）與「繼承繁星」（Ping 2026-11-15 03:38／04:02；設計稿 Projects claude/bloodline-design.md）
 *
 *   命脈：巔峰點數 65 點開啟（growth-core 的 bloodline），依職業自動給血脈；傭兵照他自己的職業也有效果（你開了命脈就算）。
 *   繼承繁星：要先開命脈；投入 1～4 點＝0～3 階（growth-core 的 starInherit），只對你自己。
 *     0 階：密奧卡光環 ×1.2（afk-mio 讀 W.__afkMioAuraMult）
 *     1 階：聖物「太陽神凱布利」進化成「拉」（要先有凱布利）：一般攻擊命中 5% 施放火系法術，傷害＝（智力＋精神）×1.5＋100
 *     2 階：流派技能（含覺醒技能）傷害 +15%、冷卻 −1 秒（大絕、龍魔法除外）
 *     3 階：得到一件神聖衣（變身效果），全部變身卡點亮（0 星；已點亮、已有星的不補償）
 *   妖精、黑暗妖精的血脈還沒定（Ping 沒寫）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bloodline', name: '巔峰「命脈」與「繼承繁星」', group: '遊戲玩法', desc: '巔峰點數開啟職業血脈；繼承繁星四階' });
  if (T && !T.enabled('bloodline')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var G = function () { return W.LineageGrowth; };
  var C = function () { return W.AFK_CARD_COMBAT; };
  var R = function () { return W.AFK_RELIC_RUNTIME; };
  var tk = function () { return (typeof state !== 'undefined' && state) ? N(state.ticks) : 0; };
  var log = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'player-special'); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };

  // ── 點數 ──
  var pts = function (k) { try { var p = P(), g = p && G() && G().read(p); return g && g.paragon ? N(g.paragon.points[k]) : 0; } catch (e) { return 0; } };
  var opened = function () { return pts('bloodline') >= 65; };
  var starLv = function () { return opened() ? pts('starInherit') - 1 : -1; };   // −1＝沒點；0～3 階
  var party = function () { var p = P(); return p ? [p].concat((p.allies || []).filter(Boolean)) : []; };
  var inParty = function (e) { var p = P(); return !!(e && p && (e === p || (p.allies || []).indexOf(e) >= 0)); };
  var has = function (e, cls) { return !!(e && e.cls === cls && opened() && inParty(e)); };

  var INFO = {
    mage: ['術法血脈', '法術傷害的 5% 改成真實傷害（不吃魔防）；召喚物自己造成的傷害 50% 改成真實傷害。'],
    knight: ['意的極致', '受到的傷害 30% 反彈給攻擊者（照對方的減傷算）；力量 50 點起就照 200 點的曲線算；負重上限 +5,000。'],
    royal: ['血脈沸騰・鮮血皇帝', '每 5 秒吸收全隊（你、傭兵、寵物、召喚物、守衛）最大 HP 15%，吸多少就對全部敵人各造成一次物理、一次魔法傷害；HP 不夠會倒下。'],
    illusion: ['抑制信仰', '對女神傷害 +15%。技藝「織命術士」：受到傷害的 50% 轉成治療全隊（含寵物、召喚物、守衛）。技藝「幻刃術士」：幻覺系法術算召喚物，傷害 +15%，並吃寵物・召喚物的加成。'],
    dragon: ['光龍祝福', '弱點曝光會擴散到全部敵人；弱點曝光對全部龍騎士技能有效（每層 +10%，最多 5 層）。'],
    warrior: ['神聖光榮', '對四龍傷害 +100%；不受次元裂縫四龍副本的房間傷害；打法利昂（水龍）時每一下 5% 直接打掉目前這一階段。'],
    berserker: ['戰術精通', '直接擁有戰士技藝「血怒狂斧」的效果（跟自己的技藝並存）：AC +300、每 10 秒失去最大 HP 30%、魔防 −500、四屬性抗性 −500；一般攻擊吸血 10%、濺射 10% 到其他敵人；受到法利昂（水龍）的傷害 +200%；面對巴拉卡斯（火龍）時 HP 每秒 −10%、造成的傷害 +100%。'],
    elf: ['棲息者', '拿弓時造成的傷害 +5%、遠距離爆擊傷害 +50%。屬性精靈強化：每 3 秒施放自己屬性最強的單體魔法（火：烈炎術、水：寒冰尖刺、風：致命落雷、地：地裂術，傷害照妖精自己的智力、精神算），打中的目標陷入「屬性弱點」5 秒（受到該屬性傷害 +20%）；精靈每一下多妖精面板傷害的 15%。'],
    dark: ['破壞神', '對人形怪物爆擊傷害 +100%；目標身上有屬性弱點時，那一下傷害 +50%；爆擊時 5% 機率追擊再打一下，追擊也會爆擊、也能再追擊，最多連打 5 下（跟其他追擊效果分開算，可以疊）。'],
    darkknight: ['復仇種子', '覺醒進化後技能傷害 +100%；吸血的治療量 +50%。'],
    paladin: ['古龍守護者', '對龍系怪物傷害 +50%、受到龍系傷害 −15%；技能命中龍系強制暈眩 1 秒；當傭兵時團隊經驗 +15%。'],
    thunder: ['追擊者', '對林德拜爾（風龍）傷害 +100%，而且全部算屬性弱點；林德拜爾對雷神的傷害 +50%。'],
    runeblade: ['沙漠的守護者', '在野外地圖造成的傷害、受到的治療 +15%；連續打同一隻怪，每一下多 100 真實傷害並累加（沒有上限，換目標歸零）。']
  };
  var desc = function (p) {
    p = p || P(); var x = p && INFO[p.cls];
    return (x ? '<img src="assets/ui/bloodline/blood_' + p.cls + '.webp" alt="" style="float:left;width:44px;height:44px;margin:0 8px 4px 0">' : '') + '花 65 點開啟你這個職業的血脈；傭兵照他自己的職業也有效果。' + (x ? '你的血脈「' + x[0] + '」：' + x[1] : '你的職業血脈還沒有開放。');
  };

  // ── 怪物分類 ──
  var DRAGON4 = /安塔瑞斯|法利昂|林德拜爾|巴拉卡斯/;
  var isFour = function (m) { return !!(m && DRAGON4.test(m.n || '')); };
  var isWater = function (m) { return !!(m && /法利昂/.test(m.n || '')); };
  var isFire = function (m) { return !!(m && /巴拉卡斯/.test(m.n || '')); };
  var isWind = function (m) { return !!(m && /林德拜爾/.test(m.n || '')); };
  var isDragon = function (m) { return !!(m && (isFour(m) || /^(龍|飛龍|龍龜)$/.test(m.race || ''))); };
  var isGoddess = function (m) { return !!(m && (m._afkFinal || /席琳|女神/.test(m.n || ''))); };
  var mobs = function () { try { return (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0 && !m._isAlly && !m._allyName && m.race !== '建築'; }); } catch (e) { return []; } };
  var field = function () { try { var c = mapState.current || ''; if (/^(town_|afk_)/.test(c)) return false; return typeof mapCategoryOf === 'function' ? mapCategoryOf(c) === 'wild' : false; } catch (e) { return false; } };
  var killIfDead = function (t) { try { if (t && t.curHp <= 0 && !t._dead) { var i = mapState.mobs.indexOf(t); if (i >= 0 && typeof killMob === 'function') killMob(i); } } catch (e) {} };
  var trueHit = function (t, v) { v = Math.floor(v); if (!(v > 0) || !t || t._dead || !(t.curHp > 0)) return 0; t.curHp -= v; killIfDead(t); return v; };
  var mrm = function (t) { try { return typeof mrMult === 'function' ? Math.max(0.01, mrMult(N(t && t.mr))) : 1; } catch (e) { return 1; } };
  var artOf = function (e) { try { return W.__afkArts && W.__afkArts.art ? W.__afkArts.art(e) : null; } catch (er) { return null; } };
  var gp = function (k) { try { var p = P(); return p && G() ? N(G().pct(p, k)) : 0; } catch (e) { return 0; } };

  // ════════ 造成的傷害（AFK_CARD_COMBAT.damage：一般攻擊、法術、技能都會經過）════════
  var rbTarget = new WeakMap();
  var hookDmg = function () {
    var c = C(); if (!c || typeof c.damage !== 'function' || c.__afkBlood) return;
    var o = c.damage;
    c.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        if (!(r > 0) || !actor || !target || !inParty(actor) || !opened()) return r;
        var cls = actor.cls, kind = opt && opt.kind;
        if (cls === 'warrior' && isFour(target)) r *= 2;
        if (cls === 'paladin' && isDragon(target)) r *= 1.5;
        if (cls === 'thunder' && isWind(target)) { r *= 2; if (typeof ELEM_COUNTER_UP !== 'undefined') r *= N(ELEM_COUNTER_UP) || 1; }
        if (cls === 'berserker' && fireNear()) r *= 2;
        if (cls === 'illusion' && isGoddess(target)) r *= 1.15;
        if (cls === 'runeblade' && field()) r *= 1.15;
        if (cls === 'illusion' && kind === 'magic' && artOf(actor) === 'i_sorc') {   // 幻刃術士：幻覺系法術算召喚物
          r *= 1.15 * (1 + gp('minDmg') / 100);
        }
        if (cls === 'mage' && kind === 'magic') { var part = r * .05; r = r - part + part / mrm(target); }   // 5% 改成不吃魔防的真實傷害
        r = Math.max(1, Math.floor(r));
        if (cls === 'warrior' && isWater(target) && Math.random() < .05 && target.curHp > r) { log(tag('神聖光榮', '#fde68a') + '斬斷了' + (target.n || '') + '這一階段的生命！'); r = target.curHp + 1; }
        if (cls === 'runeblade') {   // 越打越強：同一隻每一下 +100 真實傷害並累加
          var s = rbTarget.get(actor); if (!s || s.t !== target) { s = { t: target, n: 0 }; rbTarget.set(actor, s); }
          s.n++; r += 100 * s.n;
        }
      } catch (e) {}
      return r;
    };
    c.__afkBlood = true;
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // 召喚物（法師）：50% 改成真實傷害
  var hookComp = function () {
    var Rt = R(); if (!Rt || typeof Rt.companionDamage !== 'function' || Rt.companionDamage.__afkBlood) return;
    var o = Rt.companionDamage;
    var f = function (owner, ent, target, dmg, opt) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && has(owner, 'mage') && opt && opt.kind === 'summon') { var half = v * .5; v = Math.floor(v - half + half / mrm(target)); } } catch (e) {}
      return v;
    };
    f.__afkBlood = true; Object.keys(o).forEach(function (k) { f[k] = o[k]; }); Rt.companionDamage = f;
  };
  hookComp(); W.addEventListener('load', hookComp);

  // ── 技能（AFK_RELIC_RUNTIME.api.damage，origin 'class'：流派技能、覺醒技能）──
  var skillType = function (src) { try { var s = W.LineageClassCore && W.LineageClassCore.skills && W.LineageClassCore.skills.get(src); return s ? s.type : ''; } catch (e) { return ''; } };
  var forceStun = function (t) { try { if (!t || t._dead) return; t.st = t.st || (typeof newMobStatus === 'function' ? newMobStatus() : {}); t.st.stun = Math.max(N(t.st.stun), 10); } catch (e) {} };
  var weakMult = function (t) { var n = Math.min(5, N(t && t.weakExpose)); return n > 0 ? 1 + .1 * n : 1; };
  var hookApi = function () {
    var Rt = R(), api = Rt && Rt.api; if (!api || typeof api.damage !== 'function' || api.damage.__afkBlood) return;
    var o = api.damage;
    var f = function (target, amount, opt) {
      try {
        var a = opt && opt.actor;
        if (a && amount > 0 && opt.origin === 'class' && inParty(a) && opened()) {
          var src = String(opt.source || ''), ty = skillType(src), notUlt = ty !== '大絕' && ty !== '龍魔法' && !/ult/i.test(src);
          if (a === P() && starLv() >= 2 && notUlt) amount *= 1.15;   // 繼承繁星 2 階
          if (a.cls === 'darkknight' && a.awkEvo && N(a.awkEvo.stage) >= 1) amount *= 2;   // 復仇種子
          if (a.cls === 'dragon') amount *= weakMult(target);   // 光龍祝福
          if (a.cls === 'paladin' && isDragon(target)) forceStun(target);   // 古龍守護者
          arguments[1] = amount;
        }
      } catch (e) {}
      return o.apply(this, arguments);
    };
    f.__afkBlood = true; api.damage = f;
  };
  hookApi(); W.addEventListener('load', hookApi);
  // 核心技能（一般法術）：龍騎士弱點曝光、神聖劍士暈眩
  var hookSpell = function () {
    var Rt = R(); if (!Rt || typeof Rt.spellDamage !== 'function' || Rt.spellDamage.__afkBlood) return;
    var o = Rt.spellDamage;
    var f = function (actor, target, dmg) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && has(actor, 'dragon')) v = Math.floor(v * weakMult(target)); if (has(actor, 'paladin') && isDragon(target)) forceStun(target); } catch (e) {}
      return v;
    };
    f.__afkBlood = true; Rt.spellDamage = f;
  };
  hookSpell(); W.addEventListener('load', hookSpell);
  // 弱點曝光擴散
  if (typeof W.applyPlayerWeakExpose === 'function') {
    var oWE = W.applyPlayerWeakExpose;
    W.applyPlayerWeakExpose = function (t) {
      var r = oWE.apply(this, arguments);
      try { if (t && has(P(), 'dragon') && N(t.weakExpose) > 0) mobs().forEach(function (m) { if (m !== t) m.weakExpose = Math.max(N(m.weakExpose), N(t.weakExpose)); }); } catch (e) {}
      return r;
    };
  }
  // 冷卻：繼承繁星 2 階（−1 秒，大絕、龍魔法除外）
  var oCdr = W.__afkCdrMult;
  W.__afkCdrMult = function (p, s) {
    var m = typeof oCdr === 'function' ? oCdr.apply(this, arguments) : 1;
    try { if (p === P() && s && s.type !== '大絕' && s.type !== '龍魔法' && starLv() >= 2 && s.plan && N(s.plan.cd) > 0) m = Math.max(0.001, m - 1 / N(s.plan.cd)); } catch (e) {}
    return m;
  };

  // ════════ 受到的傷害 ════════
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkBloodTaken) return; W.__afkBloodTaken = true;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = o.apply(this, arguments);
      try {
        if (!(v > 0) || !ent || !inParty(ent) || !opened() || !mob) return v;
        var cls = ent.cls;
        if (cls === 'paladin' && isDragon(mob)) v = Math.floor(v * .85);
        if (cls === 'berserker' && isWater(mob)) v = Math.floor(v * 3);
        if (cls === 'thunder' && isWind(mob)) v = Math.floor(v * 1.5);
        if (cls === 'knight' && mob.curHp > 0 && !mob._dead && G() && G().secondaryHit && kind !== 'dot' && kind !== 'true') G().secondaryHit(ent, mob, Math.floor(v * .3), 'phys');
        if (cls === 'illusion' && artOf(ent) === 'i_life') healAll(Math.floor(v * .5), ent);
      } catch (e) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // ── 治療全隊（含寵物、召喚物、守衛）──
  var minions = function () {
    var out = [];
    try { if (typeof petsOutList === 'function') petsOutList().forEach(function (x) { if (x && !x._downed && x.hp > 0) out.push(x); }); } catch (e) {}
    try { if (typeof summonV2List === 'function') summonV2List().forEach(function (x) { if (x && !x._downed && x.hp > 0) out.push(x); }); } catch (e) {}
    try { if (typeof guardAliveList === 'function') guardAliveList().forEach(function (x) { out.push(x); }); } catch (e) {}
    return out;
  };
  var maxOf = function (x) { return N(x.mhp || x.maxHp || x.hpMax || (W.AFK_RELIC_COMPANIONS && W.AFK_RELIC_COMPANIONS.maxHp && W.AFK_RELIC_COMPANIONS.maxHp(x))); };
  var healAll = function (n, src) {
    if (!(n > 0)) return; var p = P();
    party().forEach(function (e) { if (e === src) return; if (e === p) { if (!p.dead && p.hp > 0) p.hp = Math.min(N(p.mhp), N(p.hp) + n); } else if (!e._downed && e.curHp > 0) e.curHp = Math.min(N(e.mhp), N(e.curHp) + n); });
    minions().forEach(function (x) { var mx = maxOf(x); if (mx > 0) x.hp = Math.min(mx, N(x.hp) + n); });
  };

  // ════════ 每秒、每 5 秒 ════════
  var fireNear = function () { return mobs().some(isFire); };
  var lastSec = 0, royalAt = 0;
  setInterval(function () {
    try {
      var p = P(); if (!p || p.dead || !opened() || typeof state === 'undefined' || !state.running) return;
      var t = tk(); if (t - lastSec < 10) return; lastSec = t;
      var ms = mobs(); if (!ms.length || /^town_/.test(mapState.current || '')) return;
      // 狂戰士：面對火龍時 HP 每秒 −10%（會倒下）
      if (ms.some(isFire)) party().forEach(function (e) {
        if (e.cls !== 'berserker') return; var cut = Math.floor(N(e.mhp) * .1);
        if (e === p) { p.hp -= cut; if (p.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); } }
        else if (!e._downed) { e.curHp -= cut; if (e.curHp <= 0) { e.curHp = 0; e._downed = true; e._reviveCd = 150; } }
      });
      // 王族：每 5 秒吸收全隊 HP 15%
      if (party().some(function (e) { return e.cls === 'royal' && (e === p ? !p.dead : !e._downed); }) && t - royalAt >= 50) {
        royalAt = t; var total = 0, deaths = [];
        party().forEach(function (e) {
          if (e === p) { if (p.dead) return; var a = Math.floor(N(p.mhp) * .15); total += Math.min(a, N(p.hp)); p.hp -= a; if (p.hp <= 0) deaths.push(p); }
          else if (!e._downed) { var b = Math.floor(N(e.mhp) * .15); total += Math.min(b, N(e.curHp)); e.curHp -= b; if (e.curHp <= 0) { e.curHp = 0; e._downed = true; e._reviveCd = 150; } }
        });
        minions().forEach(function (x) { var mx = maxOf(x); if (!(mx > 0)) return; var c = Math.floor(mx * .15); total += Math.min(c, N(x.hp)); x.hp -= c; if (x.hp <= 0) { x.hp = 0; try { if (typeof _petDown === 'function' && x.form && PET_BOOK && PET_BOOK[x.form]) _petDown(x); else if (typeof _guardDown === 'function' && typeof CASTLE_GUARD_BOOK !== 'undefined' && guardV2List().indexOf(x) >= 0) _guardDown(x); else { x._downed = true; x._diedAt = Date.now(); } } catch (er) { x._downed = true; } } });
        if (total > 0 && G() && G().secondaryHit) {
          log(tag('鮮血皇帝', '#f87171') + '吸收全隊 ' + total.toLocaleString() + ' 點生命，化為血之暴雨。');
          var actor = p.dead ? null : p;
          if (actor) ms.forEach(function (m) { G().secondaryHit(actor, m, total, 'phys'); G().secondaryHit(actor, m, total, 'magic'); });
        }
        if (deaths.indexOf(p) >= 0 && typeof killPlayer === 'function') killPlayer();
      }
    } catch (e) {}
  }, 250);

  // ════════ 能力（重算之後）：騎士力量曲線、負重 ════════
  var strFlag = false;
  ['getStrMeleeDmg', 'getStrMeleeHit', 'getStrMeleeCrit'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function (str) { if (strFlag && N(str) >= 50 && N(str) < 200) arguments[0] = 200; return o.apply(this, arguments); };
  });
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () { var p = P(); strFlag = has(p, 'knight'); try { var r = oRe.apply(this, arguments); try { raName(); } catch (e) {} return r; } finally { strFlag = false; } };
  }
  if (typeof W._allyLevelRecompute === 'function') {
    var oAl = W._allyLevelRecompute;
    W._allyLevelRecompute = function (ally) { strFlag = has(ally, 'knight'); try { return oAl.apply(this, arguments); } finally { strFlag = false; } };
  }
  var hookWeight = function () {
    var g = G(); if (!g || typeof g.weight !== 'function' || g.__afkBlood) return; var o = g.weight;
    g.weight = function (p, base) { var v = o.apply(this, arguments); try { if (has(p, 'knight')) v += 5000; } catch (e) {} return v; };
    g.__afkBlood = true;
  };
  hookWeight(); W.addEventListener('load', hookWeight);
  // 神聖劍士：當傭兵時團隊經驗 +15%
  if (typeof W.partyExpBonusPct === 'function') {
    var oPx = W.partyExpBonusPct;
    W.partyExpBonusPct = function () { var v = oPx.apply(this, arguments); try { var p = P(); if (opened() && p && (p.allies || []).some(function (a) { return a && a.cls === 'paladin' && !a._downed; })) v += 15; } catch (e) {} return v; };
  }
  // 暗黑騎士：吸血的治療 +50%；魔劍士：野外受到的治療 +15%
  var hookHeal = function () {
    var Rt = R(); if (!Rt || typeof Rt.heal !== 'function' || Rt.heal.__afkBlood) return; var o = Rt.heal;
    var f = function (target, amount, opt) {
      try {
        var src = String((opt && opt.source) || '');
        if (amount > 0 && has(target, 'darkknight') && /leech|vamp|drain|steal|吸血/i.test(src)) arguments[1] = amount * 1.5;
        if (amount > 0 && has(target, 'runeblade') && field()) arguments[1] = N(arguments[1]) * 1.15;
      } catch (e) {}
      return o.apply(this, arguments);
    };
    f.__afkBlood = true; Rt.heal = f; if (Rt.api && Rt.api.heal === o) Rt.api.heal = f;
  };
  hookHeal(); W.addEventListener('load', hookHeal);
  // 戰士：不受四龍副本・裂縫的房間傷害（afk-riftdungeons 讀）
  W.__afkBloodRoomImmune = function (x) { return has(x, 'warrior'); };
  // 狂戰士：血怒狂斧（afk-arts 讀）；副作用 ×2
  W.__afkBloodFaf = function (x) { return has(x, 'berserker'); };

  // ════════ 繼承繁星 ════════
  W.__afkMioAuraMult = function () { return starLv() >= 0 ? 1.2 : 1; };
  // 1 階：拉
  var ra = function (p) {
    try { var S = W.__afkScarab; if (!S || starLv() < 1 || !S.equipped(p)) return false; var s = S.store(p); return s.lv >= 100 && s.form >= 3 && !!((W.__afkDimRiftOn && W.__afkDimRiftOn()) || (p.afkDimRift && p.afkDimRift.khepriEver)); } catch (e) { return false; }
  };
  var raName = function () { var p = P(), S = W.__afkScarab; if (!p || !S || !ra(p)) return; var d = DB.items[S.ID]; if (d && /^太陽神凱布利/.test(d.n || '')) { d.n = d.n.replace('太陽神凱布利', '太陽神拉'); d.img = 'assets/icons/items/afk_scarab_ra.png'; d.d = (d.d || '') + '（繼承繁星：一般攻擊命中時 5% 施放炎爆術、火球術、流星雨或火風暴，傷害＝（智力＋精神）×1.5＋100）'; } };
  var RA_SP = [['炎爆術', false], ['火球術', false], ['流星雨', true], ['火風暴', true]];
  var hookEv = function () {
    var g = G(); if (!g || g.__afkBloodEv) return; var o = g.event;
    g.event = function (name, c) {
      var r = o.apply(this, arguments);
      try {
        var p = P();
        if (name === 'afterHit' && c && c.actor === p && c.target && !c.generated && ['normal', 'auto'].indexOf(c.origin || 'normal') >= 0 && ra(p) && Math.random() < .05) {
          var sp = RA_SP[Math.floor(Math.random() * RA_SP.length)], d = p.d || {}, base = (N(d.int) + N(d.wis)) * 1.5 + 100;
          var ts = sp[1] ? mobs() : [c.target];
          ts.forEach(function (t) { var v = base * (typeof elementCounterMult === 'function' ? elementCounterMult('fire', t.e) : 1); g.secondaryHit(p, t, Math.floor(v), 'magic'); });
          log(tag('太陽神拉', '#fbbf24') + '降下' + sp[0] + '！');
        }
      } catch (e) {}
      return r;
    };
    g.__afkBloodEv = true;
  };
  hookEv(); W.addEventListener('load', hookEv);
  // 3 階：神聖衣＋全變身卡點亮（只給一次）
  var grantCards = function () {
    var p = P(), A = W.AFK_CARD_ASCENSION; if (!p || !A || !A.catalog || starLv() < 3) return;
    var b = p.afkBlood || (p.afkBlood = {}); if (b.cards) return;
    var s = p.cardAscension; if (!s || typeof s !== 'object') s = p.cardAscension = {};
    s.owned = s.owned || {}; s.copies = s.copies || {}; s.sealed = s.sealed || {}; s.cloth = s.cloth || {};
    var lit = 0;
    ['mythic', 'celestial', 'spacetime', 'samsara'].forEach(function (t) { (A.catalog[t] || []).forEach(function (row) { if (s.owned[row.id]) return; s.owned[row.id] = true; s.copies[row.id] = 1; if (t === 'samsara') s.sealed[row.id] = true; lit++; }); });
    var cl = (A.catalog.samsara || []).filter(function (row) { return !(s.cloth[row.id] && s.cloth[row.id].ex); });
    var pick = cl.length ? cl[Math.floor(Math.random() * cl.length)] : null;
    if (pick) { s.owned[pick.id] = true; delete s.sealed[pick.id]; s.copies[pick.id] = Math.max(2, N(s.copies[pick.id])); s.cloth[pick.id] = Object.assign({ uses: 0 }, s.cloth[pick.id] || {}, { ex: true }); }
    b.cards = 1;
    try { if (typeof logSys === 'function') logSys(tag('繼承繁星', '#fde68a') + '點亮了 ' + lit + ' 張變身卡' + (pick ? '，並得到神聖衣「' + pick.n + '」' : '') + '。'); } catch (e) {}
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
  };
  setInterval(function () { try { grantCards(); } catch (e) {} }, 3000);

  // ════════ 妖精「棲息者」、黑暗妖精「破壞神」（Ping 11-15 04:53）════════
  var isBow = function (e) { try { var w = e && e.eq && e.eq.wpn, d = w && DB.items[w.id]; return !!(d && d.isBow); } catch (er) { return false; } };
  var HUMAN = /^(玩家|血盟|黑暗妖精|黑暗精靈|亞人|妖魔|拉斯塔巴德|黑騎士|長老|蜥蜴人|狼人|食人妖精|牛人|卡司特|喀瑪|巨人|思克巴|蛇女|人形)$/;
  var isHuman = function (m) { return !!(m && (HUMAN.test(m.race || '') || /罪犯|盜賊|騎士|戰士|法師|弓手|將軍|王子|公主|女皇|女王/.test(m.n || ''))); };
  var WEAK = ['fireVulnerability', 'waterVulnerability', 'windVulnerability', 'earthVulnerability'];
  var hasWeak = function (m) { try { var api = R() && R().api; return !!(m && api && api.hasStatus && WEAK.some(function (k) { return api.hasStatus(m, k); })); } catch (e) { return false; } };
  // 拿弓 +5%（造成的傷害）；屬性弱點 +50%（黑暗妖精）
  var hookDmg2 = function () {
    var c = C(); if (!c || typeof c.damage !== 'function' || c.__afkBlood2) return; var o = c.damage;
    c.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try { if (r > 0 && actor && inParty(actor) && opened()) { if (actor.cls === 'elf' && isBow(actor)) r = Math.floor(r * 1.05); if (actor.cls === 'dark' && !(opt && opt.kind === 'true') && hasWeak(target)) r = Math.floor(r * 1.5); } } catch (e) {}
      return r;
    };
    c.__afkBlood2 = true;
  };
  hookDmg2(); W.addEventListener('load', hookDmg2);
  // 妖精拿弓：遠距離爆擊傷害 +50（重算之後加）
  var bowCrit = function (e) { try { if (e && e.d && has(e, 'elf') && isBow(e)) e.d.rangedCritDmg = N(e.d.rangedCritDmg) + 50; } catch (er) {} };
  if (typeof W.recomputeStats === 'function') { var oRe2 = W.recomputeStats; W.recomputeStats = function () { var r = oRe2.apply(this, arguments); bowCrit(P()); return r; }; }
  if (typeof W._allyLevelRecompute === 'function') { var oAl2 = W._allyLevelRecompute; W._allyLevelRecompute = function (ally) { var r = oAl2.apply(this, arguments); bowCrit(ally); return r; }; }
  // 黑暗妖精：對人形怪物爆擊傷害 +100%；爆擊時 5% 追擊（最多 5 下）
  var chasing = false;
  var hookEv2 = function () {
    var g = G(); if (!g || g.__afkBloodEv2) return; var o = g.event;
    g.event = function (name, c) {
      try {
        if (name === 'beforeHit' && c && c.critical && c.actor && c.target && has(c.actor, 'dark') && isHuman(c.target)) {
          var k = (c.kind === 'ranged' ? 'ranged' : c.kind === 'magic' ? 'magic' : 'melee') + 'CritDmg', cd = N(c.actor.d && c.actor.d[k]);
          c.damage = N(c.damage) * (200 + cd) / (100 + cd);
        }
      } catch (e) {}
      var r = o.apply(this, arguments);
      try {
        if (name === 'afterHit' && !chasing && c && c.critical && c.actor && c.target && has(c.actor, 'dark') && N(c.damage) > 0) {
          chasing = true; var n = 1, t = c.target, a = c.actor, k2 = (c.kind === 'ranged' ? 'ranged' : c.kind === 'magic' ? 'magic' : 'melee') + 'Crit';
          try {
            while (n < 5 && Math.random() < .05 && t.curHp > 0 && !t._dead) {
              n++; var v = N(c.damage);
              if (Math.random() * 100 < N(a.d && a.d[k2])) { var cd2 = N(a.d && a.d[k2 + 'Dmg']); v = v * (1 + (cd2 + (isHuman(t) ? 100 : 0)) / 100) / (1 + cd2 / 100); }
              trueHit(t, v);
            }
            if (n > 1) log(tag('破壞神', '#a78bfa') + '追擊 ' + (n - 1) + ' 下！');
          } finally { chasing = false; }
        }
      } catch (e) { chasing = false; }
      return r;
    };
    g.__afkBloodEv2 = true;
  };
  hookEv2(); W.addEventListener('load', hookEv2);
  // 妖精：屬性精靈每 3 秒施放最強單體魔法＋屬性弱點；精靈每下 +15% 面板
  var ELF_SP = { fire: 'sk_blaze', water: 'sk_frost_spike', wind: 'sk_holy_lightning', earth: 'sk_earthquake' };
  var isSpirit = function (x) { return !!(x && (x.skId === 'sk_elf_summon' || x.skId === 'sk_elf_summon2')); };
  var spiritsOf = function (e) {
    var p = P(), out = [];
    try { if (e === p) summonV2List().forEach(function (x) { if (isSpirit(x) && !x._downed && x.hp > 0) out.push(x); }); else if (e && isSpirit(e.summon) && !(e.summon._downed) && !(e.summon.hp <= 0)) out.push(e.summon); } catch (er) {}
    return out;
  };
  var panel = function (e) { var d = (e && e.d) || {}; return Math.max(N(d.rangedDmg), N(d.meleeDmg)) + N(d.extraDmg); };
  var hookComp2 = function () {
    var Rt = R(); if (!Rt || typeof Rt.companionDamage !== 'function' || Rt.companionDamage.__afkBlood2) return; var o = Rt.companionDamage;
    var f = function (owner, ent, target, dmg, opt) { var v = o.apply(this, arguments); try { if (v > 0 && has(owner, 'elf') && isSpirit(ent)) v = Math.floor(v + panel(owner) * .15); } catch (e) {} return v; };
    f.__afkBlood2 = true; Object.keys(o).forEach(function (k) { f[k] = o[k]; }); Rt.companionDamage = f;
  };
  hookComp2(); W.addEventListener('load', hookComp2);
  var elfAt = 0;
  setInterval(function () {
    try {
      var p = P(); if (!p || p.dead || !opened() || typeof state === 'undefined' || !state.running) return;
      var t = tk(); if (t - elfAt < 30) return; elfAt = t;
      var ms = mobs(); if (!ms.length || /^town_/.test(mapState.current || '')) return;
      var api = R() && R().api; if (!api || !api.cast) return;
      party().forEach(function (e) {
        if (e.cls !== 'elf' || (e === p ? p.dead : e._downed)) return;
        spiritsOf(e).forEach(function (sp) {
          var ele = sp.ele || 'water', sk = ELF_SP[ele] || ELF_SP.water, tg = ms.filter(function (m) { return m.curHp > 0 && !m._dead; });
          if (!tg.length) return; var m = tg[Math.floor(Math.random() * tg.length)];
          api.cast(m, sk, { actor: e, source: 'blood-elf' });
          if (m.curHp > 0 && !m._dead) api.status(m, ele + 'Vulnerability', 5, .2);
        });
      });
    } catch (e) {}
  }, 250);

  W.LineageBloodline = { isHuman: isHuman, hasWeak: hasWeak, isBow: isBow, INFO: INFO, desc: desc, opened: opened, starLv: starLv, has: has, isDragon: isDragon, isFour: isFour, ra: ra, grantCards: grantCards };
})();
