/* afk-summoncloth.js — 召喚儀式的魔術布（遺物 189）改版（Ping 11-15）
 *   召喚控制戒指放背包就有效 → 布不再給召喚控制，改成所有召喚物都強化：
 *   法師召喚上限 +1／+1／+2／+3（至少 8）／+6（至少 11）；妖精屬性精靈 +1／+1／+1／+2／+2 隻；
 *   席琳眷屬：一口氣召喚 20＋布的加成 隻後立刻融合（融合魔獸傷害 ×隻數÷20，在 afk-arts）。
 *   生命、傷害、魔力、修復在 afk-relic-defense（onCompanionStats／summonLimit／beforeCast／tick）。
 *   這支要放在 afk-relic-runtime 之後、afk-arts 之前：精靈分身要在殷海薩眷屬 ×5、遺物生命同步之前做好。 */
(function (W) {
  'use strict';
  var R = W.AFK_RELIC_RUNTIME; if (!R) return;
  var on = function () { return !W.AFK_TOGGLES || W.AFK_TOGGLES.enabled('relicfx'); };
  var P = function () { return typeof player !== 'undefined' ? player : null; };
  var CNT = [1, 1, 2, 3, 6], SP = [1, 1, 1, 2, 2];
  var src = function (o) { try { return R.sources(o).find(function (x) { return x.catalogId === 189; }) || (R.inheritedSource ? R.inheritedSource(o, 189, 'summonCtrl') : null) || null; } catch (e) { return null; } };
  var stage = function (o) { var s = on() && o && src(o); return s ? Math.max(0, Math.min(4, Number(s.stage) || 0)) : -1; };
  W.__afkSummonCloth = { stage: stage, extraSummon: function (o) { var s = stage(o); return s < 0 ? 0 : CNT[s]; }, extraSpirit: function (o) { var s = stage(o); return s < 0 ? 0 : SP[s]; } };

  try { var d = DB.items.relic_summon_cloth; if (d) { d.req = 'mage,elf'; d.relicRole = '法師召喚物、妖精屬性精靈用脛甲，兼具精神加成'; } } catch (e) {}

  // 物品說明：布不再給召喚控制（戒指放背包就有效），拿掉核心自動加上的那一行
  if (typeof W.relicPurposeLabels === 'function') {
    var oRL = W.relicPurposeLabels;
    W.relicPurposeLabels = function (d) { var r = oRL.apply(this, arguments); try { if (d && d.summonCtrl && d.relic) r = r.filter(function (x) { return !/^召喚控制/.test(x); }); } catch (e) {} return r; };
    try { (0, eval)('relicPurposeLabels = window.relicPurposeLabels'); } catch (e) {}
  }

  // 妖精：屬性精靈多召喚幾隻（只有玩家自己；傭兵精靈走抽象模型）
  if (typeof W.summonV2CastFor === 'function') {
    var oSC = W.summonV2CastFor;
    W.summonV2CastFor = function (skId) {
      var r = oSC.apply(this, arguments);
      try {
        var p = P();
        if (r && p && (skId === 'sk_elf_summon' || skId === 'sk_elf_summon2')) {
          var n = W.__afkSummonCloth.extraSpirit(p), L = p.summonsV2 || [], base = L[0];
          if (n > 0 && base) {
            for (var i = 1; i <= n; i++) { var c = Object.assign({}, base); c.uid = (typeof uid === 'function') ? uid() : (base.uid + '_c' + i); c._atkCd = (base._atkCd || 5) + i * 3; L.push(c); }
            if (typeof logCombat === 'function') logCombat('召喚儀式的魔術布：多召喚了 ' + n + ' 隻屬性精靈。', 'magic', 'summon');
            try { if (typeof renderSummonPanel === 'function') renderSummonPanel(true); } catch (e) {}
          }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('summonV2CastFor = window.summonV2CastFor'); } catch (e) {}
  }

  // 席琳眷屬：20 隻＋布的加成（要包在最外層，所有腳本載入後才裝）
  var installCount = function () {
    if (typeof W._sumCountFor !== 'function' || W._sumCountFor.__cloth) return;
    var oC = W._sumCountFor;
    var f = function (name, owner) {
      var o = owner || P(), n = oC.apply(this, arguments);
      try { if (n > 0 && W.__afkArtOf && W.__afkArtOf(o) === 'm_shilen') return 20 + W.__afkSummonCloth.extraSummon(o); } catch (e) {}
      return n;
    };
    f.__cloth = 1; W._sumCountFor = f;
    try { (0, eval)('_sumCountFor = window._sumCountFor'); } catch (e) {}
  };
  if (document.readyState === 'complete') setTimeout(installCount, 0); else W.addEventListener('load', function () { setTimeout(installCount, 0); });
})(window);
