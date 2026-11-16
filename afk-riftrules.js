/* ============================================================================
 * afk-riftrules.js — 次元裂縫、夢域鏡的王與小怪新規則（Ping 11-17 04:19「上線」）
 *
 *   次元裂縫（含 GD、無盡的裂縫）／夢域鏡（削弱版）：
 *     ‧王的魔法屏障：出場帶最大 HP 15%／10% 的護盾；1 分鐘內沒打死再補一次（只補一次）
 *     ‧王的死亡傷害：王倒下時全隊扣最大 HP 10%／5%；出場 30 秒內打死改 15%／8%
 *     ‧王的近戰、遠程、魔法減傷：先減 5%／3% 再算其他
 *     ‧70 等以上地區的小怪：出場帶 10%／5% 護盾；死亡時全隊扣最大 HP 5%／3%
 *   死亡傷害直接扣最大 HP 的百分比（不吃減傷），最少留 1 HP，不會因此倒下。
 *   王的法術爆擊：afk-enemyx 本來就讓敵人的法術也會爆擊（夢域鏡 50%、×2.5；次元裂縫 70%、×3），這裡不再重複擲。
 *   無盡的裂縫另外的規則（面板再壓 25%、光環與王的傷害 ×2）在 afk-dimrift。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var tk = function () { return (typeof state !== 'undefined' && state && state.ticks) || 0; };
  var rift = function () { try { return typeof W.__afkDimRiftOn === 'function' && !!W.__afkDimRiftOn(); } catch (e) { return false; } };
  var dream = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on && W.__afkDreamHell.on()); } catch (e) { return false; } };
  var CFG = {
    rift: { barrier: 0.15, death: 0.10, deathFast: 0.15, bossDr: 0.05, mobDeath: 0.05, mobShield: 0.10 },
    dream: { barrier: 0.10, death: 0.05, deathFast: 0.08, bossDr: 0.03, mobDeath: 0.03, mobShield: 0.05 }
  };
  var mode = function () { var p = P(); if (!p || p.classicMode) return null; return rift() ? CFG.rift : dream() ? CFG.dream : null; };
  var enemy = function (m) { return !!(m && m.curHp != null && !m._isAlly && !m._allyName && m.race !== '建築' && m.race !== '血盟' && !m._dummy && !m.afkRaid); };   // 多人討伐的吞噬者不套
  var inTown = function () { try { return typeof mapState !== 'undefined' && /^town_/.test(String(mapState.current || '')); } catch (e) { return true; } };
  var log = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'enemy'); } catch (e) {} };
  // 地區等級：那張地圖一般怪的最高等級
  var LVC = {};
  var mapLv = function () {
    var k = String((typeof mapState !== 'undefined' && mapState.current) || ''); if (LVC[k] != null) return LVC[k];
    var pool = (typeof DB !== 'undefined' && DB.maps && DB.maps[k]) || [], mx = 0;
    pool.forEach(function (id) { var m = DB.mobs[id]; if (m && !m.boss) mx = Math.max(mx, N(m.lv)); });
    return (LVC[k] = mx);
  };
  var members = function () { var p = P(), out = []; if (!p) return out; if (!p.dead && p.hp > 0) out.push(p); (p.allies || []).forEach(function (a) { if (a && !a._downed && N(a.curHp) > 0) out.push(a); }); return out; };
  var hurtAll = function (pct) {
    var p = P(); members().forEach(function (x) {
      var mx = x === p ? N(p.mhp) : N(x.mhp), dmg = Math.floor(mx * pct);
      if (!(dmg > 0)) return;
      if (x === p) p.hp = Math.max(1, N(p.hp) - dmg); else x.curHp = Math.max(1, N(x.curHp) - dmg);
    });
  };
  var shieldOf = function (m) { return N(m._rrShield); };
  // ── 出場與 1 分鐘補盾 ──
  var scan = function () {
    var c = mode(); if (!c || inTown()) return;
    var t = tk(), L = (typeof mapState !== 'undefined' && mapState.mobs) || [], lv = null;
    for (var i = 0; i < L.length; i++) {
      var m = L[i]; if (!enemy(m) || m._dead || m.curHp <= 0) continue;
      if (!m._rrBorn) {
        m._rrBorn = t || 1;
        if (m.boss) { m._rrShield = Math.floor(N(m.hp) * c.barrier); m._rrBar = 1; log('<span class="font-bold" style="color:#93c5fd">【魔法屏障】</span>' + (m.n || '王') + ' 張開了屏障（' + Math.round(c.barrier * 100) + '% 最大 HP）。'); }
        else { if (lv === null) lv = mapLv(); if (lv >= 70) m._rrShield = Math.floor(N(m.hp) * c.mobShield); }
      } else if (m.boss && m._rrBar === 1 && t - m._rrBorn >= 600) {
        m._rrBar = 2; m._rrShield = shieldOf(m) + Math.floor(N(m.hp) * c.barrier);
        log('<span class="font-bold" style="color:#93c5fd">【魔法屏障】</span>' + (m.n || '王') + ' 再次張開屏障。');
      }
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); try { if (tk() !== t0) scan(); } catch (e) {} return r; };
  }
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function () { var r = oSpawn.apply(this, arguments); try { scan(); } catch (e) {} return r; };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  // ── 打到怪：王先減 5%／3%，再被護盾吸收 ──
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkRR) return;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        var c = mode(); if (!c || !(v > 0) || !enemy(target)) return v;
        if (target.boss && !(opt && opt.kind === 'true')) v = Math.max(1, Math.floor(v * (1 - c.bossDr)));
        var s = shieldOf(target);
        if (s > 0) { var a = Math.min(s, v); target._rrShield = s - a; v -= a; if (target._rrShield <= 0 && target.boss) log('<span style="color:#93c5fd">' + (target.n || '王') + ' 的屏障破了。</span>'); }
      } catch (e) {}
      return v;
    };
    f.__afkRR = true; C.damage = f;
  };
  hookDmg(); W.addEventListener('load', function () { hookDmg(); setTimeout(hookDmg, 2000); });
  // ── 倒下時的傷害 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = null; try { m = mapState.mobs[idx]; } catch (e) {}
      var r = oKill.apply(this, arguments);
      try {
        var c = mode();
        if (c && enemy(m) && (m._dead || N(m.curHp) <= 0) && !m._rrDeathDone && !inTown()) {
          m._rrDeathDone = 1;
          if (m.boss) {
            var fast = m._rrBorn && tk() - m._rrBorn <= 300, pct = fast ? c.deathFast : c.death;
            hurtAll(pct);
            log('<span class="font-bold" style="color:#fca5a5">【臨終的反噬】</span>' + (m.n || '王') + ' 倒下時反噬全隊：最大 HP −' + Math.round(pct * 100) + '%' + (fast ? '（30 秒內擊倒）' : '') + '。');
          } else if (mapLv() >= 70) hurtAll(c.mobDeath);
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  W.__afkRiftRules = { CFG: CFG, mode: mode, mapLv: mapLv };
  try { console.log('[AFK-riftrules] 已啟用：次元裂縫／夢域鏡的王屏障、死亡反噬、王減傷、70 等以上小怪'); } catch (e) {}
})();
