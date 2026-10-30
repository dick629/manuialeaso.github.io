/* ============================================================================
 * afk-hidden.js — 隱藏條件（玩家 2026-10-29）
 *
 *   一、謀叛三人組：隊伍剛好三個人＝王子、男騎士、男法師（王族、騎士、法師各一，三人都是男性角色），
 *       在「謀叛者的低語」裡：對該副本造成的傷害 +50%、受到該副本的傷害 −50%。多一個人、少一個人或有女性角色都不算。
 *   二、王族之敵：男性的王族、騎士、法師，對傲慢之塔（含支配者傲慢之塔）的「反王肯恩」「賽尼斯(首領)」造成的傷害 +10%。
 *   三、騎士的負重（玩家 2026-10-29 21:07）：騎士（你或騎士傭兵）每 10 秒一次，物理攻擊的基礎傷害加上「負重上限 ×0.05」（加在卡片倍率等之前）。
 *   都不寫在任何說明裡（小百科只寫「有隱藏條件」）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'hiddenbonus', name: '隱藏條件（謀叛三人組、王族之敵、騎士的負重）', group: '隱藏規則',
    desc: '特定職業與性別的組合，在特定副本或對特定頭目有額外效果' });
  if (T && !T.enabled('hiddenbonus')) return;
  var KNIGHT_LOAD = 0.05, KNIGHT_CD = 100;
  var TRAITOR_MAP = 'afk_traitor_whisper', TRIO = ['royal', 'knight', 'mage'], FOES = { '反王肯恩': 1, '賽尼斯(首領)': 1 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var male = function (a) { var v = String(a && a.avatar || ''); return v === '王子' || v.charAt(0) === '男'; };
  var trio = function () {
    var p = P(); if (!p) return false;
    var party = [p].concat(p.allies || []).filter(Boolean);
    if (party.length !== 3 || !party.every(male)) return false;
    var cls = party.map(function (a) { return a.cls; }).sort();
    return cls.join(',') === TRIO.slice().sort().join(',');
  };
  var inTraitor = function () { return typeof mapState !== 'undefined' && mapState && mapState.current === TRAITOR_MAP; };
  var isMember = function (a) { var p = P(); return !!(p && a && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var kingFoe = function (actor, target) {
    if (!actor || !target || !FOES[target.n] || !male(actor) || TRIO.indexOf(actor.cls) < 0) return false;
    var m = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
    return m.indexOf('pride') === 0 || !!(typeof state !== 'undefined' && state && state.prideClimb);
  };
  var hooked = false;   // 只包一次（之後別的外掛再包 C.damage，外層就沒有旗標了）
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function' || C.damage.__afkHidden) return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      try {   // 騎士的負重：每 10 秒一次，基礎傷害 + 負重上限×0.05
        var kd = opt && opt.kind;
        if (amount > 0 && actor && actor.cls === 'knight' && isMember(actor) && (kd === 'melee' || kd === 'ranged')) {
          var t = (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0;
          if (!W.__afkTestNoKnightLoad && t >= (Number(actor._afkLoadAt) || 0)) {
            var cap = Number(actor.d && actor.d.weightCapacity) || 0, add = Math.floor(cap * KNIGHT_LOAD);
            if (add > 0) { actor._afkLoadAt = t + KNIGHT_CD; arguments[2] = amount + add; }
          }
        }
      } catch (e) {}
      var v = o.apply(this, arguments);
      try {
        if (v > 0 && isMember(actor)) {
          if (inTraitor() && trio()) v = Math.floor(v * 1.5);
          if (kingFoe(actor, target)) v = Math.floor(v * 1.1);
        }
      } catch (e) {}
      return v;
    };
    C.damage.__afkHidden = true;
  };
  hook(); W.addEventListener('load', hook);
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (mob && isMember(ent) && inTraitor() && trio()) ? 0.5 : 1; });
  W.__afkHidden = { trio: trio, male: male, kingFoe: kingFoe, KNIGHT_LOAD: KNIGHT_LOAD, KNIGHT_CD: KNIGHT_CD };
})();
