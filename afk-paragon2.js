/* ============================================================================
 * afk-paragon2.js — 巔峰 1000／2000 等的新能力（Ping 2026-11-13 03:42；設計稿 docs/limit-break-design.md 第二節）
 *
 *   點數表在 merged/growth-core（paragon.spread…leech，need＝開放等級）；這裡只做效果，只有你自己（巔峰本來就只有玩家）。
 *   造成的傷害（AFK_CARD_COMBAT.damage，攻擊者是你）：
 *     對負面狀態／對流血中毒／對屬性弱點／對頭目：條件成立的相加 → ×(1＋合計)；再 ×(1＋最終傷害)
 *     傷害轉換 HP：結算後回復那一下的 x%
 *     傷害擴散：主目標那一下的 x% 打到其他每一隻（LineageGrowth.secondaryHit：吃目標的防禦，不觸發特效，不再擴散；持續傷害不擴散）
 *   受到的傷害：頭目減傷走 __afkTakenMods（跟其他百分比減傷一起算 75% 上限）；最終減傷在 __afkTaken 全部算完後另外 ×(1－x)
 *   六項能力：__afkAttrBoost（在能力換算之前加）；爆擊傷害：__afkMaxAdd 加到近／遠／法術爆擊傷害
 *   施法冷卻（Ⅰ＋Ⅱ，最多 10%）：getAutoCastInterval（一般技能）、流派技能（class-combat 讀 __afkCdrMult）；大絕不算
 *   追擊：playerAttack 結束後 x% 機率再打一次（追擊那一下不會再追擊）
 *   限界解放提升：W.__afkLimitBreakBoost（afk-limitbreak 讀）
 *   巔峰 3000（Ping 11-15）：異常狀態持續時間、異常狀態抵抗機率、造成的傷害、最終傷害 Ⅱ；寵物・召喚物・守衛的受到的傷害、造成的傷害、追擊、施放第二次法術、最終減傷
 *   巔峰 4000：受到的傷害、抗暴（敵人爆擊率 −百分點）、受到的重擊傷害、受到的爆擊傷害、最終減傷 Ⅱ、施法冷卻 Ⅲ（三項冷卻合計最多 15%）；
 *     寵物・召喚物・守衛的重擊、爆擊、抗暴三項：afk-enemyx 讀（11-15 起敵人也會對牠們爆擊、重擊）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'paragon2', name: '巔峰新能力', group: '遊戲玩法', desc: '巔峰 1000 等、2000 等開放的新能力（擴散、對頭目、冷卻、追擊、最終傷害…）' });
  if (T && !T.enabled('paragon2')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var G = function () { return W.LineageGrowth; };
  var pct = function (p, k) { try { return p && p === P() && !p.classicMode && G() ? N(G().pct(p, k)) : 0; } catch (e) { return 0; } };
  var ticks = function () { return (typeof state !== 'undefined' && state) ? N(state.ticks) : 0; };

  var cc = function (t) { var L = W.LineageClassCombat; return L && typeof L.mobState === 'function' ? L.mobState(t) : null; };
  var hasDebuff = function (t) {
    var s = t && t.st; if (s) for (var k in s) { if (k === 'poisonTick' || k === 'poisonDmg' || k === 'poisonStacks' || k === 'poisonUnit' || k === 'blindVal') continue; if (N(s[k]) > 0) return true; }
    if (t && t.bleeds && t.bleeds.length) return true;
    try { var M = cc(t); if (M && M.debuffs) for (var k2 in M.debuffs) { var d2 = M.debuffs[k2]; if (d2 && N(d2.until) > Date.now()) return true; } } catch (e) {}
    return false;
  };
  var hasDot = function (t) { return !!(t && ((t.st && N(t.st.poison) > 0) || (t.bleeds && t.bleeds.length))); };
  var hasWeak = function (p, t) {
    if (!t) return false;
    if (N(t._fireVulnUntil) > ticks() || t._afkMagicRift) return true;
    try { var M = cc(t); if (M && M.debuffs) for (var k2 in M.debuffs) { var d2 = M.debuffs[k2]; if (d2 && N(d2.until) > Date.now() && /^(eleRes|eleVuln)/.test(String(d2.key))) return true; } } catch (e) {}
    try { var w = p.eq && p.eq.wpn, d = w && DB.items[w.id], e = typeof getWpnEle === 'function' ? getWpnEle(w, d, p) : null; if (e && typeof elementCounterMult === 'function' && elementCounterMult(e, t.e) > 1) return true; } catch (e) {}
    return false;
  };

  // ── 造成的傷害 ──
  var spreading = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkP2) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (!(r > 0) || !p || actor !== p || p.classicMode || !target) return r;
        var add = 0, x;
        if ((x = pct(p, 'debuff')) && hasDebuff(target)) add += x;
        if ((x = pct(p, 'dot')) && hasDot(target)) add += x;
        if ((x = pct(p, 'weak')) && hasWeak(p, target)) add += x;
        if ((x = pct(p, 'boss')) && target.boss) add += x;
        add += pct(p, 'dmgAll');   // 巔峰 3000：造成的傷害
        var m = (1 + add / 100) * (1 + pct(p, 'finalDmg') / 100) * (1 + pct(p, 'finalDmg2') / 100);
        if (m !== 1) r = Math.max(1, Math.floor(r * m));
        if ((x = pct(p, 'leech')) && !p.dead && N(p.mhp) > 0) p.hp = Math.min(N(p.mhp), N(p.hp) + Math.floor(r * x / 100));
        var kind = (opt && opt.kind) || '';
        if (!spreading && kind !== 'dot' && (x = pct(p, 'spread')) && G() && typeof G().secondaryHit === 'function' && typeof mapState !== 'undefined') {
          var amt = Math.floor(r * x / 100);
          if (amt > 0) {
            spreading = true;
            try { (mapState.mobs || []).slice().forEach(function (m2) { if (m2 && m2 !== target && m2.curHp > 0 && !m2._dead) G().secondaryHit(p, m2, amt, kind === 'magic' ? 'magic' : 'phys'); }); }
            finally { spreading = false; }
          }
        }
      } catch (e) {}
      return r;
    };
    C.__afkP2 = true;
  };
  hookDamage(); W.addEventListener('load', hookDamage);

  // ── 受到的傷害 ──
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { var p = P(); return (ent && ent === p && mob && mob.boss) ? 1 - pct(p, 'bossDef') / 100 : 1; });
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { var p = P(); return (ent && ent === p) ? 1 - pct(p, 'dmgTaken') / 100 : 1; });   // 巔峰 4000：受到的傷害
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkP2Taken) return; W.__afkP2Taken = true;
    W.__afkTaken = function (ent) { var v = o.apply(this, arguments); try { var p = P(), x; if (v > 0 && ent === p && (x = pct(p, 'finalDef') + pct(p, 'finalDef2'))) v = Math.max(0, Math.floor(v * (1 - pct(p, 'finalDef') / 100) * (1 - pct(p, 'finalDef2') / 100))); } catch (e) {} return v; };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // ── 六項能力、爆擊傷害 ──
  var oAttr = W.__afkAttrBoost;
  W.__afkAttrBoost = function (actor, d) {
    var r = oAttr ? oAttr.apply(this, arguments) : undefined;
    try { var x = pct(actor, 'stats'); if (x && d) ['str', 'dex', 'int', 'wis', 'con', 'cha'].forEach(function (k) { d[k] = N(d[k]) + x; }); } catch (e) {}
    return r;
  };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { var x = pct(p, 'critDmg'); if (!x || !p.d) return; ['melee', 'ranged', 'magic'].forEach(function (k) { p.d[k + 'CritDmg'] = N(p.d[k + 'CritDmg']) + x; }); });
  // 巔峰 4000：抗暴、受到的重擊傷害、受到的爆擊傷害（afk-enemyx 讀）
  W.__afkMinionCritRateDef = function () { var p = P(); return p ? pct(p, 'minAntiCrit') : 0; };
  W.__afkMinionCritDef = function () { var p = P(); return p ? pct(p, 'minCritDef') : 0; };
  W.__afkMinionHeavyDef = function () { var p = P(); return p ? pct(p, 'minHeavyDef') : 0; };
  var oCR = W.__afkEnemyCritRateDef; W.__afkEnemyCritRateDef = function (ent) { var v = typeof oCR === 'function' ? N(oCR(ent)) : 0; return ent && ent === P() ? v + pct(ent, 'antiCrit') : v; };
  var oHV = W.__afkEnemyHeavyDef; W.__afkEnemyHeavyDef = function (ent) { var v = typeof oHV === 'function' ? N(oHV(ent)) : 0; return ent && ent === P() ? v + pct(ent, 'heavyDef') : v; };
  var oCD = W.__afkEnemyCritDef; W.__afkEnemyCritDef = function (ent) { var v = typeof oCD === 'function' ? N(oCD(ent)) : 0; return ent && ent === P() ? v + pct(ent, 'critDef') : v; };

  // ── 施法冷卻 ──
  var cdrMult = function (p) { var x = Math.min(15, pct(p, 'cdr1') + pct(p, 'cdr2') + pct(p, 'cdr3')); return 1 - x / 100; };   // 11-15：加施法冷卻 Ⅲ，合計上限 10% → 15%
  W.__afkCdrMult = function (p, sk) { if (sk && sk.type === '大絕') return 1; return cdrMult(p); };
  if (typeof W.getAutoCastInterval === 'function' && !W.getAutoCastInterval.__afkP2) {
    var oCast = W.getAutoCastInterval;
    var fCast = function (actor) { var v = oCast.apply(this, arguments); try { if (actor === P() && v > 0) { var m = cdrMult(actor); if (m < 1) v = v * m; } } catch (e) {} return v; };
    fCast.__afkP2 = true; W.getAutoCastInterval = fCast;
  }

  // ── 追擊 ──
  var chasing = false;
  if (typeof W.playerAttack === 'function' && !W.playerAttack.__afkP2) {
    var oAtk = W.playerAttack;
    var fAtk = function () {
      var r = oAtk.apply(this, arguments);
      try { var p = P(), x; if (!W.__afkChasing && p && !p.dead && (x = pct(p, 'chase')) && Math.random() * 100 < x) { W.__afkChasing = true; try { oAtk.apply(this, arguments); } finally { W.__afkChasing = false; } } } catch (e) { W.__afkChasing = false; }
      return r;
    };
    fAtk.__afkP2 = true; W.playerAttack = fAtk;
  }

  // ── 巔峰 3000：異常狀態持續時間（你打在怪物身上的）、異常狀態抵抗機率 ──
  if (typeof W.applyMobStatus === 'function' && !W.applyMobStatus.__afkP2) {
    var oAms = W.applyMobStatus;
    var fAms = function (m, st2) { try { var p = P(), x = p && pct(p, 'abnDur'); if (x && st2 && typeof st2 === 'object' && N(st2.dur) > 0) arguments[1] = Object.assign({}, st2, { dur: st2.dur * (1 + x / 100) }); } catch (e) {} return oAms.apply(this, arguments); };
    fAms.__afkP2 = true; W.applyMobStatus = fAms;
  }
  if (typeof W.playerStatusResisted === 'function' && !W.playerStatusResisted.__afkP2) {
    var oRes = W.playerStatusResisted;
    var fRes = function () { var r = oRes.apply(this, arguments); try { var p = P(), x; if (!r && p && (x = pct(p, 'abnRes')) && Math.random() * 100 < x) return true; } catch (e) {} return r; };
    fRes.__afkP2 = true; W.playerStatusResisted = fRes;
  }
  // ── 巔峰 3000：寵物、召喚物、守衛 ──
  //   受到的傷害、最終減傷：teamDmgReduceMult(true)（寵物、召喚物、守衛受傷都會乘這個）
  if (typeof W.teamDmgReduceMult === 'function' && !W.teamDmgReduceMult.__afkP2) {
    var oTdr = W.teamDmgReduceMult;
    var fTdr = function (forMinion) { var m = oTdr.apply(this, arguments); try { var p = P(); if (forMinion && p) m = m * (1 - pct(p, 'minDef') / 100) * (1 - pct(p, 'minFinalDef') / 100); } catch (e) {} return m; };
    fTdr.__afkP2 = true; W.teamDmgReduceMult = fTdr;
  }
  //   造成的傷害、追擊（再打一下同樣的傷害）、施放第二次法術（技能那一下再來一次）：寵物、召喚物走 AFK_RELIC_RUNTIME.companionDamage
  var minExtra = false;
  var hookComp = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.companionDamage !== 'function' || R.companionDamage.__afkP2) return;
    var o = R.companionDamage;
    var f = function (owner, ent, target, dmg, opt) {
      var v = o.apply(this, arguments);
      try {
        var p = P(); if (!(v > 0) || !p || owner !== p || minExtra) return v;
        var x = pct(p, 'minDmg'); if (x) v = Math.floor(v * (1 + x / 100));
        var again = 0, c = pct(p, 'minChase'), rc = pct(p, 'minRecast');
        if (c && Math.random() * 100 < c) again++;
        if (rc && opt && opt.skillId && Math.random() * 100 < rc) again++;
        if (again && G() && typeof G().secondaryHit === 'function' && target && target.curHp > v) {
          minExtra = true; try { for (var i = 0; i < again; i++) G().secondaryHit(p, target, v, opt && opt.skillId ? 'magic' : 'phys'); } finally { minExtra = false; }
        }
      } catch (e) { minExtra = false; }
      return v;
    };
    f.__afkP2 = true; R.companionDamage = f;
  };
  hookComp(); W.addEventListener('load', hookComp);
  //   守衛：傷害照比例放大（guardDerive 的每擊傷害）；追擊＝這一下之後有機率再攻擊一次
  if (typeof W.guardDerive === 'function' && !W.guardDerive.__afkP2) {
    var oGd = W.guardDerive;
    var fGd = function () { var d = oGd.apply(this, arguments); try { var p = P(), x = p && pct(p, 'minDmg'); if (x && d) { d = Object.assign({}, d); d.flat = Math.round(N(d.flat) * (1 + x / 100)); d.dice = Math.max(1, Math.round(N(d.dice) * (1 + x / 100))); } } catch (e) {} return d; };
    fGd.__afkP2 = true; W.guardDerive = fGd;
  }
  if (typeof W.guardAttackOnce === 'function' && !W.guardAttackOnce.__afkP2) {
    var oGa = W.guardAttackOnce, gChasing = false;
    var fGa = function (s2, d2, t2) { var r = oGa.apply(this, arguments); try { var p = P(), c = p && pct(p, 'minChase'); if (!gChasing && c && t2 && t2.curHp > 0 && Math.random() * 100 < c) { gChasing = true; try { oGa.apply(this, arguments); } finally { gChasing = false; } } } catch (e) { gChasing = false; } return r; };
    fGa.__afkP2 = true; W.guardAttackOnce = fGa;
  }

  // ── 限界解放提升 ──
  W.__afkLimitBreakBoost = function (a) { return a && a === P() ? pct(a, 'lbUp') : 0; };
})();
