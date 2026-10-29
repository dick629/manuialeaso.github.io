/* ============================================================================
 * afk-classtweak.js — 職業技能微調（玩家 2026-10-29）
 *   ‧幻術士「立方：和諧」：每次觸發全隊回復的 MP 5 → 15（20 秒內每秒一次，整段約 300 MP）。傷害不變。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'classtweak', name: '職業技能微調', group: '遊戲玩法',
    desc: '幻術士「立方：和諧」每次觸發全隊回 MP 5 → 15' });
  if (T && !T.enabled('classtweak')) return;
  if (typeof DB === 'undefined' || !DB.skills) return;
  var sk = DB.skills.sk_illu_cube_harmony;
  if (sk && sk.cube && sk.cube.kind === 'dmgmp') sk.cube.val = 15;
  W.__afkClassTweak = { harmonyMp: sk && sk.cube ? sk.cube.val : null };
})();
