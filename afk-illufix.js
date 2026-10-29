/* ============================================================================
 * afk-illufix.js — 幻術士修補（玩家 2026-10-29 21:07；外掛開關 illufix，預設開）
 *
 *   疼痛的歡愉（你與幻術士傭兵都算）：
 *     ‧受到的傷害 −50%（走受傷倍率掛點，跟其他百分比減傷一起算，合計最多 75%）。
 *     ‧反彈：一般／席琳／瘋狂席琳＝反彈「沒被這 50% 減掉之前」的傷害 100%（＝實際受到的 2 倍）；
 *            席琳夢域鏡＝反彈「減傷之後實際受到」的傷害 100%。
 *     ‧不論模式，被反彈的怪物都掛上「蝕刻」印記（10 秒，下一次任何屬性傷害 ×1.5）。
 *     反彈量由核心補丁 69（window.__afkPainRf）交給這支決定；關掉開關＝原本的「受到多少反多少」、沒有減傷。
 *   立方：燃燒：
 *     ‧20 秒內每 2 秒（原本 4 秒）對全場各造成 5～50 火傷（5D10，吃魔法傷害與屬性加成，照原本的立方算法）。
 *     ‧每次傷害：被打的怪掛上「灼熱」印記（10 秒，下一次水屬性傷害 ×2）；施放者回復這次傷害 2 倍的 HP、回復 1 MP。
 *   粉碎能量：命中時打破目標的「魔法免疫」（夢域地獄小怪出生 10 秒、巨大骷髏「恐怖的面貌」選到魔法），之後全隊的魔法就打得進去（玩家 2026-10-30 03:05）。
 *   立方：和諧：每次觸發全隊回復的 MP 5 → 15（20 秒內每秒一次，整段約 300 MP）。傷害不變。
 *     （原本是獨立的外掛開關「職業技能微調」afk-classtweak.js；玩家 2026-10-30 01:20：兩個都是幻術士的，併成一個開關）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'illufix', name: '幻術士修補（疼痛的歡愉、立方：燃燒、立方：和諧、粉碎能量）', group: '遊戲玩法',
    desc: '疼痛的歡愉：受到傷害 −50%、反彈 100%（夢域鏡反彈減傷後的傷害），並掛蝕刻印記；立方：燃燒：每 2 秒 5～50 火傷、掛灼熱印記，傷害的 2 倍變成補血、每次回 1 MP；立方：和諧：每次觸發全隊回 MP 5 → 15；粉碎能量：打破目標的魔法免疫' });
  if (T && !T.enabled('illufix')) return;
  if (typeof DB === 'undefined' || !DB.skills) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { return (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0; };
  var dream = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  var markOn = function (m, key) { if (m && m.curHp > 0) m[key] = Math.max(Number(m[key]) || 0, tk() + 100); };

  // ── 疼痛的歡愉 ──
  var pain = function (ent) { return !!(ent && ent.buffs && ent.buffs.sk_illu_pain > 0); };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { return pain(ent) ? 0.5 : 1; });
  W.__afkPainRf = function (ent, taken, mob) {
    markOn(mob, '_afkExpose');   // 蝕刻
    return dream() ? taken : taken * 2;
  };

  // ── 立方：和諧（原「職業技能微調」）──
  var harmony = DB.skills.sk_illu_cube_harmony;
  if (harmony && harmony.cube && harmony.cube.kind === 'dmgmp') harmony.cube.val = 15;
  W.__afkClassTweak = { harmonyMp: harmony && harmony.cube ? harmony.cube.val : null };   // 舊名稱留著，給還在讀它的地方

  // ── 粉碎能量：打破魔法免疫 ──
  var breakMagic = function (t, who) {
    var w = t && t._reflectWall, tk2 = (typeof state !== 'undefined' && state) ? state.ticks : 0;
    if (!w || !w.block || w.kind !== 'magic' || tk2 > (w.until || 0)) return false;
    t._reflectWall = null;
    try { if (typeof logCombat === 'function') logCombat('<span class="text-fuchsia-300 font-bold">【粉碎能量】</span>' + who + '粉碎了 ' + (t.n || '目標') + ' 的魔法免疫。', 'magic'); if (typeof renderMobs === 'function') renderMobs(); } catch (e) {}
    return true;
  };
  var curTarget = function () { try { return typeof getTarget === 'function' ? getTarget() : null; } catch (e) { return null; } };
  if (typeof W.castSkill === 'function') {
    var oCastC = W.castSkill;
    W.castSkill = function (skId) {
      if (skId !== 'sk_illu_crush') return oCastC.apply(this, arguments);
      var t = curTarget(), r = oCastC.apply(this, arguments);
      if (r) breakMagic(t, '你');
      return r;
    };
  }
  if (typeof W.allyCastCrush === 'function') {
    var oAllyC = W.allyCastCrush;
    W.allyCastCrush = function (ally, s) {
      var isCrush = s && (s === DB.skills.sk_illu_crush || s.n === '粉碎能量');
      var t = isCrush ? curTarget() : null, r = oAllyC.apply(this, arguments);
      if (isCrush && r) breakMagic(t, '協力·' + ((ally && ally._allyName) || '傭兵'));
      return r;
    };
  }
  W.__afkCrushBreak = breakMagic;
  try { var cr = DB.skills.sk_illu_crush; if (cr && cr.d && cr.d.indexOf('魔法免疫') < 0) cr.d += '命中時打破目標的魔法免疫。'; } catch (e) {}

  // ── 立方：燃燒 ──
  var sk = DB.skills.sk_illu_cube_burn, DICE = [5, 10];
  if (sk && sk.cube) { sk.cube.iv = 20; sk.cube.dice = DICE; }
  var pending = null;
  if (typeof W.summonElementDamage === 'function') {
    var oSed = W.summonElementDamage;
    W.summonElementDamage = function (dice, ele, target) { if (dice === DICE) pending = target; return oSed.apply(this, arguments); };
  }
  var afterBurn = function (actor, target, v) {
    markOn(target, '_afkScorch');   // 灼熱
    var p = P(); if (!actor || !(v > 0)) return;
    if (actor === p) { p.hp = Math.min(p.mhp || p.hp, (p.hp || 0) + v * 2); p.mp = Math.min(p.mmp || p.mp, (p.mp || 0) + 1); }
    else if (!actor._downed) { actor.curHp = Math.min(actor.mhp || actor.curHp, (actor.curHp || 0) + v * 2); if (actor.mmp != null) actor.mp = Math.min(actor.mmp, (actor.mp || 0) + 1); }
  };
  var hooked = false;
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { if (pending && target === pending && opt && opt.kind === 'dot') { pending = null; afterBurn(actor, target, v); } } catch (e) {}
      return v;
    };
  };
  hook(); W.addEventListener('load', hook);

  // 小百科：立方：燃燒的說明跟著改
  W.__afkIlluFix = { pain: pain, painRf: W.__afkPainRf, burnDice: DICE, burnIv: 20, afterBurn: afterBurn, harmonyMp: W.__afkClassTweak.harmonyMp };
})();
