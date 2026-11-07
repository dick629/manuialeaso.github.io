/* ============================================================================
 * afk-breakskills.js — 破防技能（Ping 11-07 18:54）
 *
 *   幻術士「粉碎能量」：一定命中；打中的目標魔防 −150（30 秒，再打中刷新時間；魔防最低到 0）。你和傭兵施放都算。
 *   妖精「污濁之水」：一定命中（原本就是 force）；狀態維持期間目標 AC +150（AC 越高越好打）。
 *   經典模式沒有；外掛開關 breakskills。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'breakskills', name: '破防技能：粉碎能量、污濁之水', group: '遊戲平衡',
    desc: '粉碎能量打中的目標魔防 −150（30 秒）；污濁之水維持期間目標 AC +150；兩招都一定命中' });
  if (T && !T.enabled('breakskills')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { return (typeof state !== 'undefined' && state && state.ticks) || 0; };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var CRUSH = { mr: 150, ticks: 300 }, MUDDY = { ac: 150 };
  W.__afkBreakSkills = { CRUSH: CRUSH, MUDDY: MUDDY };
  try { var c0 = DB.skills.sk_illu_crush; if (c0 && !/魔防 −150/.test(c0.d || '')) c0.d = (c0.d || '') + '打中的目標魔防 −150（30 秒）。'; } catch (e) {}
  try { var m0 = DB.skills.sk_elf_muddywater; if (m0 && !/AC \+150/.test(m0.d || '')) m0.d = (m0.d || '') + '一定命中；狀態維持期間目標 AC +150。'; } catch (e) {}

  var crushHit = function (t) {
    if (!t || t._dead || !(t.curHp > 0) || classic()) return;
    if (!(t._crushUntil > tk())) { var cut = Math.min(CRUSH.mr, Math.max(0, Number(t.mr) || 0)); t._crushMr = cut; t.mr = (Number(t.mr) || 0) - cut; }
    t._crushUntil = tk() + CRUSH.ticks;
  };
  var tgt = function () { try { return typeof getTarget === 'function' ? getTarget() : null; } catch (e) { return null; } };
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      if (skId !== 'sk_illu_crush') return oCast.apply(this, arguments);
      var p = P(), t = tgt(), mp0 = p ? p.mp : 0, hp0 = t ? t.curHp : 0;
      var r = oCast.apply(this, arguments);
      try { if (p && t && (p.mp < mp0 || t.curHp < hp0)) crushHit(t); } catch (e) {}
      return r;
    };
  }
  if (typeof W.allyCastCrush === 'function') {
    var oAlly = W.allyCastCrush;
    W.allyCastCrush = function (ally, sk) { var t = tgt(), r = oAlly.apply(this, arguments); try { if (r) crushHit(t); } catch (e) {} return r; };
    try { (0, eval)('allyCastCrush = window.allyCastCrush'); } catch (e) {}
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var t = tk(); if (t % 5) return r;
        ((typeof mapState !== 'undefined' && mapState.mobs) || []).forEach(function (m) {
          if (!m) return;
          if (m._crushMr && !(m._crushUntil > t)) { m.mr = (Number(m.mr) || 0) + m._crushMr; m._crushMr = 0; }
          var mw = !!(m.st && (m.st.muddywater || 0) > 0 && !m._dead);
          if (mw && !m._mwAc && !classic()) { m.ac = (Number(m.ac) || 0) + MUDDY.ac; m._mwAc = true; }
          else if (!mw && m._mwAc) { m.ac = (Number(m.ac) || 0) - MUDDY.ac; m._mwAc = false; }
        });
      } catch (e) {}
      return r;
    };
  }
  try { console.log('[AFK-breakskills] 已載入：粉碎能量魔防 −150、污濁之水 AC +150'); } catch (e) {}
})();
