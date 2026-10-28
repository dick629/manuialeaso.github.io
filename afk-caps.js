/* ============================================================================
 * afk-caps.js — 副手武器的能力也算進去＋爆擊率／迴避率上限 80%（玩家 2026-10-27）
 *
 * ① 副手武器：轉生後任何武器都能雙持，但核心的副手只當「第二攻擊來源」，
 *    只算祝福／遠古／屬性詞綴，武器本身的固定加成（近距離傷害、命中、爆擊率…）完全沒算 → 玩家看到「有裝備沒效果」。
 *    轉生角色的副手武器，比照主手把這些固定加成也算進去：
 *      近／遠距離傷害與命中（依武器是近戰或遠程）、隨等級成長的傷害／命中、魔法傷害、額外傷害、額外魔法點數、
 *      HP／MP 上限、HP／MP 自然恢復、傷害減免、魔防、近距離爆擊率、近距離爆擊傷害、遠距離爆擊率
 *    不算：強化值的固定加成（副手揮擊自己用自己的強化值）、攻擊速度、遺物的觸發特效。
 *    沒轉生的戰士（迅猛雙斧）維持原版規則。
 * ② 上限：近距離／遠距離／魔法爆擊率最高 80%（重算能力值的最後一步夾住）；
 *    迴避率最高 80%（核心補丁 patchEvadeCap：玩家、傭兵、寵物的迴避判定與面板顯示）。
 * 排在所有包 recomputeStats 的外掛之後（最外層），其他外掛加完的爆擊率也會被夾住。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var CAP = 80;
  if (T && T.register) T.register({ id: 'statcap', name: '爆擊率／迴避率上限 80%', desc: '近距離、遠距離、魔法爆擊率與迴避率最高 80%（玩家、傭兵、寵物）；關掉沒有上限', group: '遊戲玩法' });
  var capOn = !T || T.enabled('statcap');
  W.__afkCritCap = capOn ? CAP : null; W.__afkEvadeCap = capOn ? CAP : null;
  if (T && T.register) T.register({ id: 'offhandstats', name: '副手武器能力計入', desc: '轉生後雙持的副手武器，固定加成（傷害、命中、爆擊率…）比照主手算進能力', group: '遊戲玩法' });
  var on = function () { return !T || T.enabled('offhandstats'); };
  var num = function (v) { return Number(v) || 0; };
  function addOffhand(p) {
    var o = p.eq && p.eq.offwpn, d = p.d; if (!o || !d) return;
    var w = DB.items[o.id]; if (!w || w.type !== 'wpn') return;
    var r = !!w.ranged;
    if (r) { d.rangedDmg += num(w.dmgBonus); d.rangedHit += num(w.hit); } else { d.meleeDmg += num(w.dmgBonus); d.meleeHit += num(w.hit); }
    if (w.lvDmgDiv) { var lb = Math.floor((p.lv || 1) / w.lvDmgDiv); if (r) d.rangedDmg += lb; else d.meleeDmg += lb; }
    if (w.lvHitDiv) { var lh = Math.floor((p.lv || 1) / w.lvHitDiv); if (r) d.rangedHit += lh; else d.meleeHit += lh; }
    d.magicDmg += num(w.mdmg); d.extraDmg += num(w.extraDmg); d.extraMp += num(w.extraMp);
    d.mpR += num(w.mpR); d.hpR += num(w.hpR); d.dr += num(w.dr); d.mr += num(w.mr);
    d.meleeCrit += num(w.mcrit); d.meleeCritDmg += num(w.mcritDmg); d.rangedCrit += num(w.rcrit);
    if (w.mhp) p.mhp += num(w.mhp);
    if (w.mmp) p.mmp += num(w.mmp);
  }
  function clamp(p) {
    var d = p && p.d; if (!d || !capOn) return;
    ['meleeCrit', 'rangedCrit', 'magicCrit'].forEach(function (k) { if (num(d[k]) > CAP) d[k] = CAP; });
  }
  if (typeof W.recomputeStats === 'function') {
    var o = W.recomputeStats;
    W.recomputeStats = function () {
      var r = o.apply(this, arguments);
      try {
        var p = (typeof player !== 'undefined') ? player : null;
        if (p && p.d) {
          if (on() && p.rebirth > 0 && p.eq && p.eq.offwpn) addOffhand(p);
          clamp(p);
        }
      } catch (e) { console.warn('[AFK-caps]', e); }
      return r;
    };
  }
  W.AFK_CAPS = { cap: CAP, addOffhand: addOffhand, clamp: clamp };
})();
