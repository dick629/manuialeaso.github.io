/* ============================================================================
 * afk-petinherit.js — 寵物繼承主人 30% 面板（玩家 2026-10-26 指定）
 *
 * 出戰中的寵物額外得到主人（你）目前面板的 30%：
 *   命中 ＋ max(近距離命中, 遠距離命中) ×30%      傷害 ＋ (max(近距離傷害, 遠距離傷害) ＋ 額外傷害) ×30%
 *   技能傷害 ＋ 魔法傷害 ×30%                       AC ＋ 你的 AC ×30%（只取負值，越低越好）
 *   傷害減免、迴避、魔防 ＋ 你的 ×30%                最大 HP ＋ 你的最大 HP ×30%、最大 MP ＋ 你的最大 MP ×30%
 * 不改寫寵物存檔的 HP／MP 上限，只在戰鬥、恢復、顯示時加上去。
 * 2026-10-29 21:07（玩家）：出戰寵物每次攻擊，全隊（你與每名傭兵、出戰寵物）回復 5 MP。
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'petinherit', name: '寵物繼承主人能力', desc: '寵物繼承主人 30% 的面板能力與 HP／MP；寵物每次攻擊，全隊回復 5 MP', group: '遊戲玩法' });
  if (__T && !__T.enabled('petinherit')) { console.log('[AFK] 外掛開關「寵物繼承主人能力」已關閉'); return; }
  var W = window, R0 = 0.30;
  if (typeof W.petDerive !== 'function') { console.warn('[AFK-petinherit] 找不到寵物系統，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls && player.d) ? player : null; };
  var n = function (v) { return Number(v) || 0; };
  var share = function () {
    var p = P(); if (!p) return null; var d = p.d;
    var R = R0; try { if (typeof W.__afkPetInheritRate === 'function') R = W.__afkPetInheritRate(R0); } catch (e) {}   // 符文「契」：30% → 40%／50%
    return {
      hit: Math.floor(Math.max(n(d.meleeHit), n(d.rangedHit)) * R),
      dmg: Math.floor((Math.max(n(d.meleeDmg), n(d.rangedDmg)) + n(d.extraDmg)) * R),
      mdmg: Math.floor(n(d.magicDmg) * R),
      ac: Math.floor(Math.min(0, n(d.ac)) * R),
      dr: Math.floor(n(d.dr) * R), er: Math.floor(n(d.er) * R), mr: Math.floor(n(d.mr) * R),
      hp: Math.floor(n(p.mhp) * R), mp: Math.floor(n(p.mmp) * R)
    };
  };
  var oDerive = W.petDerive;
  W.petDerive = function (pet) {
    var d = oDerive.apply(this, arguments);
    try {
      var s = d && share(); if (!s) return d;
      d.hit += s.hit; d.flat += s.dmg; d.skillFlat += s.mdmg; d.ac += s.ac; d.dr += s.dr; d.er += s.er; d.mr += s.mr;
      d.mmpBonus = n(d.mmpBonus) + s.mp; d._afkInherit = s;
    } catch (e) {}
    return d;
  };
  if (typeof W.petMhpEff === 'function') {
    var oMhp = W.petMhpEff;
    W.petMhpEff = function (pet) { var v = oMhp.apply(this, arguments); try { var s = share(); if (s) v += s.hp; } catch (e) {} return v; };
  }
  // 寵物每次攻擊：全隊回 5 MP
  var PET_MP = 5;
  if (typeof W.petAttackOnce === 'function') {
    var oAtk = W.petAttackOnce;
    W.petAttackOnce = function (pet, d, target) {
      var alive = target && target.curHp > 0, r = oAtk.apply(this, arguments);
      try { if (alive && typeof W.teamRecoverMp === 'function') W.teamRecoverMp(PET_MP); } catch (e) {}
      return r;
    };
  }
  W.__afkPetInherit = { rate: R0, share: share, petMp: PET_MP };
  console.log('[AFK-petinherit] 已啟用：寵物繼承主人 30% 面板與 HP／MP');
})();
