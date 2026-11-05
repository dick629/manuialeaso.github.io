/* ============================================================================
 * afk-guardmats.js — 守護者之戒的材料先開始掉（玩家 2026-11-05 15:23：製作需求的材料改為正常掉落在正確的副本與怪物上；
 *   守護者之戒本身之後才開放；開關 guardmats，預設開；經典模式沒有）
 *
 *   四龍眼淚（地／火／水／風龍之渴望的眼淚）：
 *     ‧原本由各地怪物零星掉落 → 改成不掉。
 *     ‧改在席琳夢域鏡的四龍副本，小怪每隻 55% 掉 1 個（安塔瑞斯＝地、法利昂＝水、巴拉卡斯＝火、林德拜爾＝風）；
 *       實測一場約 50～90 個（11-05 用 6 號存檔各打一場）。
 *     ‧古物學者的常駐委託不再抽四龍眼淚（劇情委託的排序清單不動）。
 *   其他材料要等對應的內容開放才掉：誓約紋章與專屬信物＝五騎士副本；次元結晶、斷誓的環片、龍誓結晶＝次元裂縫。
 *   守護者之戒上線時（afk-guardring）看到 window.__afkGuardMats 就不再自己處理四龍眼淚，避免重複。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'guardmats', name: '四龍眼淚改在四龍副本掉', group: '遊戲內容', seal: true,
    desc: '地／火／水／風龍之渴望的眼淚只在席琳夢域鏡的四龍副本，由小怪掉落' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return (!T || T.enabled('guardmats')) && !(p && p.classicMode); };
  var TEAR = { earth: 'ttmi_9636', fire: 'ttmi_9637', water: 'ttmi_9638', wind: 'ttmi_9639' }, RATE = 0.55;
  var ALL = {}; Object.keys(TEAR).forEach(function (k) { ALL[TEAR[k]] = 1; });
  var eleOf = function (mp) { mp = String(mp || ''); if (/^antharas_/.test(mp)) return 'earth'; if (/^cr_fafurion_/.test(mp)) return 'water'; if (/^cr_valakas_/.test(mp)) return 'fire'; if (/^cr_lindvior_/.test(mp)) return 'wind'; return null; };
  var dreamOn = function (p) { return !!(p && !p.classicMode && p.sherineDream && p.sherineMad); };
  // 1) 原本的掉落拿掉
  var prevDF = W.__afkDropListFilter;
  W.__afkDropListFilter = function (mob, list) {
    if (typeof prevDF === 'function') list = prevDF(mob, list) || list;
    try { if (!on() || !list || !list.length || !list.some(function (x) { return x && ALL[x[0]]; })) return list; return list.filter(function (x) { return !(x && ALL[x[0]]); }); } catch (e) { return list; }
  };
  // 2) 古物學者常駐委託不抽
  var prevSkip = W.__afkBountySkip;
  W.__afkBountySkip = function (id) { try { if (typeof prevSkip === 'function' && prevSkip(id)) return true; } catch (e) {} return on() && !!ALL[id]; };
  // 3) 四龍副本（夢域鏡）小怪掉
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try {
        var p = P();
        if (m && m._dead && !m._gmTear && on() && p && !m.boss && !m._train && !m.siegeEnemy && !m.trollPlayer && dreamOn(p)) {
          m._gmTear = true;
          var ele = eleOf(mapState.current);
          if (ele && Math.random() < RATE) gainItem(TEAR[ele], 1, true, true);
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  // 物品說明補一句來源
  var note = function () { try { Object.keys(TEAR).forEach(function (k) { var d = DB.items[TEAR[k]]; if (d && String(d.d || '').indexOf('四龍副本') < 0) d.d = String(d.d || '') + '（席琳夢域鏡的四龍副本，小怪掉落）'; }); } catch (e) {} };
  if (on()) { note(); W.addEventListener('load', note); }
  W.__afkGuardMats = { TEAR: TEAR, RATE: RATE, on: on, eleOf: eleOf };
})();
