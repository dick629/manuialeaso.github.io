/* ============================================================================
 * afk-limitbreak.js — 限界解放（Ping 2026-11-13 03:42 設計；03:54／04:26 定案；設計稿 docs/limit-break-design.md）
 *
 *   二轉後生效（你與同職業的傭兵；經典模式沒有）。數字都會再乘「限界解放效果提升」（巔峰第二組，之後上線；先 ×1）。
 *     法師   造成的傷害 ×(1＋0.5×目前MP／MP上限)
 *     騎士   受到的傷害 ×(1－0.5×目前HP／HP上限)（不吃減傷上限 75%，在全部減傷算完後另外相乘）
 *     戰士   造成的傷害 ×(1＋0.3×已損失HP／HP上限)
 *     龍騎士 弱點曝光層數上限 ＋min(10, floor((每秒攻擊次數－1)×5))（只有你自己；傭兵沒有弱點曝光）
 *     幻術士 幻覺系攻擊法術 ×(1＋min(30%, 差距÷200 %))；差距＝(大傷＋強化)×(智力＋150)－(小傷＋強化)×(精神＋50)
 *     王族   受到的傷害 ×(1－0.15×min(8,隊伍人數)÷8)（隊伍人數＝你＋還活著的傭兵；跟其他百分比減傷一起算 75% 上限）
 *     妖精   遠距離攻擊 ＋min(15%, 敏捷÷30 %)；寵物、召喚物 ＋min(15%, 精神÷30 %)
 *     黑妖   持續傷害（中毒、流血…）＋min(50%, 力量÷10 %)
 *   能力值用面板總值（超過 200 的部分也算）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'limitbreak', name: '限界解放', group: '遊戲玩法',
    desc: '二轉後每個職業各有一個依狀態變強的被動（法師看 MP、騎士看 HP、戰士看損失的 HP、龍騎士看攻速、幻術士看武器、王族看隊伍人數、妖精看敏捷與精神、黑暗妖精看力量）' });
  if (T && !T.enabled('limitbreak')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var boost = function (a) { try { return 1 + Math.max(0, N(W.__afkLimitBreakBoost && W.__afkLimitBreakBoost(a))) / 100; } catch (e) { return 1; } };
  var on = function (a) { return !!(a && a.cls && !a.classicMode && N(a.rebirth) >= 2 && !(P() && P().classicMode)); };
  var isPlayer = function (a) { return a === P(); };
  var hpOf = function (a) { var m = N(a.mhp); if (m <= 0) return 1; return Math.max(0, Math.min(1, (isPlayer(a) ? N(a.hp) : N(a.curHp != null ? a.curHp : a.hp)) / m)); };
  var mpOf = function (a) { var m = N(a.mmp); if (m <= 0) return 0; return Math.max(0, Math.min(1, N(a.mp) / m)); };
  var stat = function (a, k) {
    try { if (isPlayer(a) && typeof W.__afkStatTotal === 'function') { var v = N(W.__afkStatTotal(k)); if (v > 0) return v; } } catch (e) {}
    var d = a.d || {}; return Math.max(N(d._raw && d._raw[k]), N(d[k]));
  };
  var party = function () { try { return typeof partyActiveMemberCount === 'function' ? N(partyActiveMemberCount()) : 1; } catch (e) { return 1; } };
  var illusionGap = function (a) {
    var w = a.eq && a.eq.wpn, d = w && typeof DB !== 'undefined' && DB.items[w.id]; if (!d) return 0;
    var en = N(w.en), big = N(d.dmgL) + en, small = N(d.dmgS) + en;
    return big * (stat(a, 'int') + 150) - small * (stat(a, 'wis') + 50);
  };
  var dragonLayers = function () {
    try { var t = typeof playerAttackIntervalTicks === 'function' ? N(playerAttackIntervalTicks(false)) : 0; if (t <= 0) return 0; var aps = 10 / t; return Math.max(0, Math.min(10, Math.floor((aps - 1) * 5))); } catch (e) { return 0; }
  };
  var illuSet = null;
  var illuSk = function (sk) { if (!illuSet) { illuSet = new Set(); Object.keys(DB.skills).forEach(function (k) { var x = DB.skills[k]; if (/^sk_illu_/.test(k) && x && x.type === 'atk' && (x.dmgDice || x.multiDmg)) illuSet.add(x); }); } return illuSet.has(sk); };

  // 數值（百分比；已含效果提升）
  var LB = {
    mage: function (a) { return 50 * mpOf(a) * boost(a); },
    knight: function (a) { return 50 * hpOf(a) * boost(a); },
    warrior: function (a) { return 30 * (1 - hpOf(a)) * boost(a); },
    dragon: function (a) { return isPlayer(a) ? Math.floor(dragonLayers() * boost(a)) : 0; },
    illusion: function (a) { return Math.min(30, Math.max(0, illusionGap(a)) / 200) * boost(a); },
    royal: function (a) { return 15 * Math.min(8, party()) / 8 * boost(a); },
    elfBow: function (a) { return Math.min(15, stat(a, 'dex') / 30) * boost(a); },
    elfPet: function (a) { return Math.min(15, stat(a, 'wis') / 30) * boost(a); },
    dark: function (a) { return Math.min(50, stat(a, 'str') / 10) * boost(a); }
  };

  // ── 造成的傷害：法師、戰士、妖精（弓）、黑妖（持續傷害）──
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkLB) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        if (r > 0 && on(actor)) {
          var k = (opt && opt.kind) || '', m = 1;
          if (actor.cls === 'mage' && k !== 'true') m = 1 + LB.mage(actor) / 100;
          else if (actor.cls === 'warrior' && k !== 'true') m = 1 + LB.warrior(actor) / 100;
          else if (actor.cls === 'elf' && k === 'ranged') m = 1 + LB.elfBow(actor) / 100;
          else if (actor.cls === 'dark' && k === 'dot') m = 1 + LB.dark(actor) / 100;
          if (m !== 1) r = Math.max(1, Math.floor(r * m));
        }
      } catch (e) {}
      return r;
    };
    C.__afkLB = true;   // 標在 C 上：之後別的外掛再包一層也不會重複掛
  };
  hookDamage(); W.addEventListener('load', hookDamage);

  // ── 幻術士：幻覺系攻擊法術 ──
  var hookSpell = function () {
    var o = W.__afkSpellRoll; if (typeof o !== 'function' || W.__afkLBSpell) return; W.__afkLBSpell = true;
    var f = function (a, t, sk) {
      var r = o.apply(this, arguments);
      try { if (a && a.cls === 'illusion' && on(a) && sk && illuSk(sk)) { var b = LB.illusion(a); if (b > 0) { r = r || { mult: 1 }; r.mult = (r.mult == null ? 1 : r.mult) * (1 + b / 100); } } } catch (e) {}
      return r;
    };
    f.__afkLB = true; W.__afkSpellRoll = f;
  };
  hookSpell(); W.addEventListener('load', hookSpell);

  // ── 妖精：寵物、召喚物 ──
  var hookComp = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.companionDamage !== 'function' || R.__afkLB) return;
    var o = R.companionDamage;
    R.companionDamage = function (owner) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && owner && owner.cls === 'elf' && on(owner)) v = Math.max(1, Math.floor(v * (1 + LB.elfPet(owner) / 100))); } catch (e) {}
      return v;
    };
    R.__afkLB = true;
  };
  hookComp(); W.addEventListener('load', hookComp);

  // ── 受到的傷害：王族（一般減傷，吃 75% 上限）、騎士（另外相乘）──
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { return (ent && ent.cls === 'royal' && on(ent)) ? 1 - LB.royal(ent) / 100 : 1; });
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkLBTaken) return; W.__afkLBTaken = true;
    var f = function (ent, dmg) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && ent && ent.cls === 'knight' && on(ent)) v = Math.max(0, Math.floor(v * (1 - LB.knight(ent) / 100))); } catch (e) {}
      return v;
    };
    f.__afkLB = true; W.__afkTaken = f;
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // ── 龍騎士：弱點曝光層數上限 ──
  if (typeof W.weakExposeMaxLayers === 'function' && !W.weakExposeMaxLayers.__afkLB) {
    var oW = W.weakExposeMaxLayers;
    var fW = function () { var v = oW.apply(this, arguments); try { var p = P(); if (p && p.cls === 'dragon' && on(p)) v += LB.dragon(p); } catch (e) {} return v; };
    fW.__afkLB = true; W.weakExposeMaxLayers = fW; try { (0, eval)('weakExposeMaxLayers = window.weakExposeMaxLayers'); } catch (e) {}
  }

  // ── 給畫面用：目前的效果文字 ──
  var fmt = function (x) { return (Math.round(x * 10) / 10).toString(); };
  var describe = function (a) {
    a = a || P(); if (!a) return null;
    var base = { mage: '法師', knight: '騎士', warrior: '戰士', dragon: '龍騎士', illusion: '幻術士', royal: '王族', elf: '妖精', dark: '黑暗妖精' };
    var rule = {
      mage: 'MP 越多，造成的傷害越高（MP 滿 +50%）',
      knight: 'HP 越高，受到的傷害越少（HP 滿 −50%，另外計算、不受減傷上限限制）',
      warrior: 'HP 越少，造成的傷害越高（最多 +30%）',
      dragon: '攻擊速度越快，弱點曝光層數上限越高（最多 +10 層）',
      illusion: '武器大傷×(智力＋150) 與 小傷×(精神＋50) 差距越大，幻覺系法術傷害越高（最多 +30%）',
      royal: '隊伍人數越多，受到的傷害越少（8 人 −15%）',
      elf: '敏捷越高，遠距離攻擊傷害越高（最多 +15%）；精神越高，寵物與召喚物傷害越高（最多 +15%）',
      dark: '力量越高，中毒、流血等持續傷害越高（最多 +50%）'
    }[a.cls];
    if (!rule) return null;
    var now = '';
    if (on(a)) {
      if (a.cls === 'mage') now = '造成的傷害 +' + fmt(LB.mage(a)) + '%';
      else if (a.cls === 'knight') now = '受到的傷害 −' + fmt(LB.knight(a)) + '%';
      else if (a.cls === 'warrior') now = '造成的傷害 +' + fmt(LB.warrior(a)) + '%';
      else if (a.cls === 'dragon') now = '弱點曝光上限 +' + LB.dragon(a) + ' 層';
      else if (a.cls === 'illusion') now = '幻覺系法術 +' + fmt(LB.illusion(a)) + '%';
      else if (a.cls === 'royal') now = '受到的傷害 −' + fmt(LB.royal(a)) + '%';
      else if (a.cls === 'elf') now = '遠距離 +' + fmt(LB.elfBow(a)) + '%、寵物與召喚物 +' + fmt(LB.elfPet(a)) + '%';
      else if (a.cls === 'dark') now = '持續傷害 +' + fmt(LB.dark(a)) + '%';
    }
    return { cls: base[a.cls], rule: rule, active: on(a), now: now };
  };
  W.__afkLimitBreak = { on: on, value: LB, describe: describe, boost: boost };
})();
