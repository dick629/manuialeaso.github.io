/* ============================================================================
 * afk-reflectcap.js — 血壁空間（反彈）減弱（玩家 2026-11-03 核准上線；開關 reflectcap，預設開；經典模式不套用）
 *
 * 核心 reflectWallOnDamage（js/04:1801）：怪物張開血壁空間（吉爾塔斯的反擊屏障、夢域鏡王登場的 1 秒反彈、四龍的龍鱗反射…）時，
 * 打過去的傷害原數彈回打的人。實測 11-01 存檔在時空裂痕 30 分被吉爾塔斯一秒彈十幾下、滿血歸零（NOTES-fixD）。
 * 改成：
 *   ‧反彈的傷害 −30%（×0.7，無條件捨去）；
 *   ‧同一隻怪每秒最多反彈 5 次（第 6 下起這一秒不反彈）；
 *   ‧同一個角色（你或傭兵）每秒被反彈的總量最多是他最大 HP 的 20%（超過的部分不反彈）。
 *   「每秒」＝遊戲時間 10 下（state.ticks / 10 取整）。免疫型的血壁（block：恐怖的面貌、夢域小怪出生免疫）不受影響、照舊。
 * 作法：包 reflectWallOnDamage（最外層，排在 afk-arts、afk-dreamhell、afk-training 之後），只改傳進去的傷害；
 *   這一下不反彈時，暫時拿掉怪物的 _reflectWall 再呼叫原函式（反擊屏障等其他判定照跑），呼叫完放回去。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'reflectcap', name: '血壁空間減弱', group: '遊戲玩法', seal: true,
    desc: '怪物反彈的傷害 −30%；同一隻怪每秒最多反彈 5 次；每個角色每秒被反彈的總量最多是自己最大 HP 的 20%' });
  var CFG = { mult: 0.7, perSec: 5, hpCap: 0.20 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && !W.__afkTestNoReflectCap && (!T || T.enabled('reflectcap'))); };   // __afkTestNoReflectCap：只給測試用（量反彈精確數字的測試）
  var sec = function () { return Math.floor(((typeof state !== 'undefined' && state && state.ticks) || 0) / 10); };
  var taken = new WeakMap();   // 角色 → { s: 秒, sum: 這一秒已反彈 }
  var matches = function (rw, kind) {
    if (!rw || rw.block) return false;
    var k = rw.kind === 'all' ? kind : rw.kind;
    return k === kind || (k === 'phys' && (kind === 'melee' || kind === 'ranged'));
  };
  if (typeof W.reflectWallOnDamage !== 'function') { try { console.warn('[AFK-reflectcap] 找不到 reflectWallOnDamage，未啟用'); } catch (e) {} return; }
  var o = W.reflectWallOnDamage;
  W.reflectWallOnDamage = function (mob, dmg, kind, ally) {
    var plan = null;   // null＝照原本；{ v }＝改成反彈 v；{ skip }＝這一下不反彈
    try {
      var rw = mob && mob._reflectWall, t = (typeof state !== 'undefined' && state) ? state.ticks : 0;
      if (on() && dmg > 0 && matches(rw, kind) && t <= rw.until && mob.curHp > 0 && !mob._dead) {
        var who = ally || P(), s = sec();
        var c = mob._afkRwCap; if (!c || c.s !== s) c = mob._afkRwCap = { s: s, n: 0 };
        var g = taken.get(who); if (!g || g.s !== s) { g = { s: s, sum: 0 }; taken.set(who, g); }
        var room = Math.max(0, Math.floor((Number(who.mhp) || 0) * CFG.hpCap) - g.sum);
        var v = Math.min(Math.floor(dmg * CFG.mult), room);
        if (c.n >= CFG.perSec || !(v > 0)) plan = { skip: rw };
        else { c.n++; g.sum += v; plan = { v: v }; }
      }
    } catch (e) { plan = null; }
    if (!plan) return o.apply(this, arguments);
    if (plan.v) return o.call(this, mob, plan.v, kind, ally);
    mob._reflectWall = null;
    try { return o.call(this, mob, dmg, kind, ally); } finally { if (!mob._reflectWall) mob._reflectWall = plan.skip; }
  };
  try { (0, eval)('reflectWallOnDamage = window.reflectWallOnDamage'); } catch (e) {}
  W.__afkReflectCap = { CFG: CFG, on: on };
})();
