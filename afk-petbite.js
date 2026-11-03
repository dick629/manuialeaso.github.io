/* ============================================================================
 * afk-petbite.js — 寵物「傷口撕咬」（玩家 2026-11-03 核准上線；開關 petbite，預設開；經典模式不套用）
 *
 * 寵物的一般攻擊（petAttackOnce 沒帶技能名；熊貓爆擊、勾爪這類技能追擊不算）打中怪物時，替那隻怪疊 1 層「傷口撕咬」：
 *   每層 AC +5（更容易被命中）、魔防 −5（最低到 0）、火水風地四種屬性抗性各 −1；最多 5 層。
 *   持續 5 秒，每次打中都重新計時；5 秒內沒被寵物打中，所有層數一起消失（還原時照實際扣掉的量加回）。
 *   可以和暈眩弱化（afk-mech1031 六）、王暈眩破綻等疊加——作法同暈眩弱化：直接改怪物的 ac／mr／res*，記住扣了多少，到期加回。
 * 判定「打中」：包 petAttackOnce，在它的命中分支呼叫 _petAfterDamage(target) 時記一層（未命中不會呼叫）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'petbite', name: '寵物傷口撕咬', group: '遊戲玩法', seal: true,
    desc: '寵物一般攻擊打中怪物時疊 1 層：AC +5、魔防 −5、火水風地抗性 −1，最多 5 層，持續 5 秒（打中就重新計時）' });
  var CFG = { max: 5, ac: 5, mr: 5, res: 1, dur: 50 }, RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('petbite'))); };
  var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
  var add = function (m) {
    if (!m || m._dead || !(m.curHp > 0)) return;
    var w = m._afkPetBite || (m._afkPetBite = { n: 0, until: 0, mr: 0 });
    w.until = tk() + CFG.dur;
    if (w.n >= CFG.max) return;
    w.n++;
    m.ac = (Number(m.ac) || 0) + CFG.ac;
    var mr = Number(m.mr) || 0, cut = Math.min(CFG.mr, Math.max(0, mr)); m.mr = mr - cut; w.mr += cut;
    RES4.forEach(function (k) { m[k] = (Number(m[k]) || 0) - CFG.res; });
  };
  var expire = function (m, force) {
    var w = m && m._afkPetBite; if (!w || !w.n || (!force && tk() <= w.until)) return;
    m.ac = (Number(m.ac) || 0) - CFG.ac * w.n;
    m.mr = (Number(m.mr) || 0) + w.mr;
    RES4.forEach(function (k) { m[k] = (Number(m[k]) || 0) + CFG.res * w.n; });
    m._afkPetBite = null;
  };
  var cur = null;   // 正在結算的寵物一般攻擊
  if (typeof W.petAttackOnce === 'function') {
    var oA = W.petAttackOnce;
    W.petAttackOnce = function (p, d, target, forceCrit, addDmg, skName) {
      var prev = cur; cur = (!skName && on()) ? { t: target } : null;
      try { return oA.apply(this, arguments); } finally { cur = prev; }
    };
    try { (0, eval)('petAttackOnce = window.petAttackOnce'); } catch (e) {}
  }
  if (typeof W._petAfterDamage === 'function') {
    var oAf = W._petAfterDamage;
    W._petAfterDamage = function (m) {
      try { if (cur && m && m === cur.t) { cur = null; add(m); } } catch (e) {}
      return oAf.apply(this, arguments);
    };
    try { (0, eval)('_petAfterDamage = window._petAfterDamage'); } catch (e) {}
  }
  if (typeof W.tick === 'function') {
    var oT = W.tick;
    W.tick = function () {
      var r = oT.apply(this, arguments);
      try { var ms = (typeof mapState !== 'undefined' && mapState.mobs) || []; for (var i = 0; i < ms.length; i++) if (ms[i] && ms[i]._afkPetBite) expire(ms[i], !on()); } catch (e) {}
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  W.__afkPetBite = { CFG: CFG, on: on, add: add, expire: expire };
})();
