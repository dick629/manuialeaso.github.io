/* ============================================================================
 * afk-gm-skills.js — 一般模式：裝備 GM 專屬武器（萬象支配者・GM 武器，99999）就自動學會全部魔法與技能
 *
 * ‧只在一般（魔改）模式；經典模式沒有這個效果
 * ‧學會的魔法、技能直接寫進角色的技能清單，卸下武器也不會遺忘
 * ‧範圍：所有職業可學的魔法與技能（有職業學習條件的那些）；裝備附帶、遺物、怪物專用的技能不算
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, GM_WPN = '99999';
  var LEARN_KEYS = ['reqM', 'reqE', 'reqK', 'reqI', 'reqDk', 'reqD', 'reqW', 'reqRoy'];
  var learnable = null;
  var allSkills = function () {
    if (learnable) return learnable;
    learnable = Object.keys(DB.skills || {}).filter(function (id) { var sk = DB.skills[id]; return sk && LEARN_KEYS.some(function (k) { return sk[k] != null; }); });
    return learnable;
  };
  var check = function () {
    var p = (typeof player !== 'undefined') ? player : null;
    if (!p || !p.cls || p.classicMode) return;
    if (typeof _recomputingAlly !== 'undefined' && _recomputingAlly) return;
    p.skills = p.skills || [];
    // 已經學過的：就算是武器附帶、卸下後被收回的那幾招，也補回來（不遺忘）
    if (Array.isArray(p._afkGmLearned) && p._afkGmLearned.length) {
      var hv = {}; p.skills.forEach(function (s) { hv[s] = 1; });
      p._afkGmLearned.forEach(function (id) { if (!hv[id] && DB.skills[id]) p.skills.push(id); });
    }
    if (!p.eq || !p.eq.wpn || String(p.eq.wpn.id) !== GM_WPN) return;
    if (!Array.isArray(p._afkGmLearned) || p._afkGmLearned.length < allSkills().length) p._afkGmLearned = allSkills().slice();
    var have = {}; p.skills.forEach(function (s) { have[s] = 1; });
    var add = allSkills().filter(function (id) { return !have[id]; });
    if (!add.length) return;
    Array.prototype.push.apply(p.skills, add);
    try { if (typeof logSys === 'function') logSys('<span class="text-fuchsia-300 font-bold">萬象支配者的力量湧入腦海——你學會了 ' + add.length + ' 種魔法與技能（卸下武器也不會遺忘）。</span>'); } catch (e) {}
    try { if (typeof saveGame === 'function') setTimeout(function () { try { saveGame(); } catch (e) {} }, 0); } catch (e) {}
  };
  if (typeof W.recomputeStats === 'function') {
    var o = W.recomputeStats;
    W.recomputeStats = function () { var r = o.apply(this, arguments); try { check(); } catch (e) {} return r; };
  }
  W.AFK_GM_SKILLS = { check: check, list: allSkills };
  console.log('[AFK-gm-skills] 已啟用：裝備 GM 專屬武器自動學會全部魔法與技能');
})();
