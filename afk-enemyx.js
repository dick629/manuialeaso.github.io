/* ============================================================================
 * afk-enemyx.js — 敵人變強（Ping 2026-11-13 13:34 提出、13:39 定案；設計稿 docs/enemy-crit-design.md）
 *
 *                     一般世界            次元裂縫
 *   爆擊             50%，×2.5            70%，×3
 *   重擊（物理）     30%，×1.5            50%，×2
 *   追加攻擊         每次 30%，最多 3 次   每次 50%，最多 5 次（中了才判下一次；一般攻擊）
 *   共鳴（施法）     30% 再放一次          50%
 *   魔擊             共鳴放出來的那一下傷害 +100%
 *   穿透武器         —                    無視你 50% 的傷害減免（把被 DR 擋掉的一半加回來）
 *   王               一般攻擊 0.1% 即死（打成致命傷害，「不屈命運」這類免死照樣能擋）；所有攻擊 ×1.5；法術改成無屬性
 *   小怪自我回血     每 5 秒回最大 HP 0.5%，5 秒內被物理打過只回 0.1%
 *   GD之子的期待：機率跟次元裂縫一樣，敵人的傷害再 +100%（×2）。
 *   對象：所有敵人打你和你的傭兵；經典模式不套用。
 *   你的「受到的爆擊傷害 −x%」：W.__afkEnemyCritDef(ent) 回傳百分比（極意壁壘 N3 第一顆）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'enemyx', name: '敵人爆擊、重擊、追加攻擊', group: '遊戲玩法', desc: '敵人會爆擊、重擊、追加攻擊、共鳴魔擊；王的一般攻擊有機率即死；小怪會自我回血。次元裂縫裡更強' });
  if (T && !T.enabled('enemyx')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var on = function () { var p = P(); return !!(p && !p.classicMode); };
  var rift = function () { try { return typeof W.__afkDimRiftOn === 'function' && !!W.__afkDimRiftOn(); } catch (e) { return false; } };
  var R = {
    normal: { crit: .5, critX: 2.5, heavy: .3, heavyX: 1.5, chase: .3, chaseMax: 3, reso: .3, pierce: 0 },
    rift: { crit: .7, critX: 3, heavy: .5, heavyX: 2, chase: .5, chaseMax: 5, reso: .5, pierce: .5 }
  };
  var BOSS_X = 1.5, BOSS_KILL = .001, MAGIC_X = 2;
  // GD之子的期待（Ping 11-13 13:41／13:42）：機率跟次元裂縫一樣，敵人的傷害再 +100%（×2）
  var gd = function () { try { return typeof W.__afkGdRiftOn === 'function' && !!W.__afkGdRiftOn(); } catch (e) { return false; } };
  R.gd = Object.assign({}, R.rift, { dmgX: 2 });
  var cfg = function () { return gd() ? R.gd : rift() ? R.rift : R.normal; };
  var enemy = function (m) { return !!(m && m.curHp != null && !m._isAlly && !m._allyName && m.race !== '建築'); };
  var basic = 0, magicX = 0, chasing = false;
  var tag = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'enemy'); } catch (e) {} };

  // ── 受到的傷害（在其他所有受傷修正之後）──
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkEnemyX) return; W.__afkEnemyX = true;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = o.apply(this, arguments);
      try {
        if (!(v > 0) || !on() || !ent || !enemy(mob) || kind === 'dot' || kind === 'true') return v;
        var c = cfg(), m = 1, txt = [];
        if (c.dmgX) m *= c.dmgX;
        if (mob.boss) m *= BOSS_X;
        if (magicX && kind === 'magic') { m *= MAGIC_X; txt.push('魔擊'); }
        if (Math.random() < c.crit) { var cx = c.critX; try { var cd = N(W.__afkEnemyCritDef && W.__afkEnemyCritDef(ent)); if (cd) cx = cx * (1 - cd / 100); } catch (e) {} m *= cx; txt.push('爆擊'); }
        if (kind !== 'magic' && Math.random() < c.heavy) { m *= c.heavyX; txt.push('重擊'); }
        if (c.pierce && kind !== 'magic' && ent.d) { var dr = N(ent.d.dr) + N(ent.d.dmgReduc); if (dr > 0) v += Math.floor(dr * c.pierce); }
        v = Math.max(1, Math.floor(v * m));
        if (mob.boss && basic && kind !== 'magic' && Math.random() < BOSS_KILL) {
          var hp = ent === P() ? N(ent.hp) : N(ent.curHp != null ? ent.curHp : ent.hp);
          v = Math.max(v, hp + N(ent.mhp));
          tag('<span class="font-bold" style="color:#f87171">【斷命】</span>' + (mob.n || '') + ' 的一擊直取性命！');
        } else if (txt.length && ent === P()) tag('<span style="color:#fca5a5">' + (mob.n || '') + ' ' + txt.join('＋') + '！</span>');
      } catch (e) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // ── 追加攻擊（一般攻擊）──
  if (typeof W.enemyAttackChooseVictim === 'function') {
    var oAtk = W.enemyAttackChooseVictim;
    W.enemyAttackChooseVictim = function (mob) {
      basic++;
      try {
        var r = oAtk.apply(this, arguments);
        if (on() && !chasing && enemy(mob)) {
          var c = cfg(); chasing = true;
          try { for (var i = 0; i < c.chaseMax && mob.curHp > 0 && Math.random() < c.chase; i++) { var p = P(); if (!p || p.dead) break; oAtk.apply(this, arguments); } }
          finally { chasing = false; }
        }
        return r;
      } finally { basic--; }
    };
  }

  // ── 共鳴、魔擊（施法）；王的法術改成無屬性 ──
  if (typeof W.castMobMagic === 'function') {
    var oMag = W.castMobMagic;
    W.castMobMagic = function (mob, sk) {
      if (!on() || !enemy(mob) || !sk) return oMag.apply(this, arguments);
      var args = Array.prototype.slice.call(arguments);
      if (mob.boss && sk.ele && sk.ele !== 'none') args[1] = Object.assign({}, sk, { ele: 'none' });
      var r = oMag.apply(this, args);
      try {
        if (!magicX && mob.curHp > 0 && Math.random() < cfg().reso) {
          magicX++; tag('<span style="color:#c4b5fd">' + (mob.n || '') + ' 共鳴魔擊！</span>');
          try { oMag.apply(this, args); } finally { magicX--; }
        }
      } catch (e) { magicX = 0; }
      return r;
    };
  }

  // ── 小怪自我回血（王原本就會回：每 5 秒 2.5%，被物理打過 0.5%）──
  var lastTick = 0;
  setInterval(function () {
    try {
      if (!on() || typeof state === 'undefined' || !state.running || typeof mapState === 'undefined') return;
      var t = N(state.ticks); if (t - lastTick < 50) return; lastTick = t;
      (mapState.mobs || []).forEach(function (m) {
        if (!enemy(m) || m.boss || m._dead || !(m.curHp > 0) || !(m.curHp < m.hp) || m.siegeEnemy) return;
        var hit = m._lastPhysicalHitTick != null && t - m._lastPhysicalHitTick <= 50;
        var pct = hit ? .001 : .005; if (m.st && N(m.st.muddywater) > 0) pct *= .5;
        m.curHp = Math.min(m.hp, m.curHp + Math.max(1, Math.floor(m.hp * pct)));
      });
    } catch (e) {}
  }, 1000);

  W.__afkEnemyXInfo = { R: R, BOSS_X: BOSS_X, BOSS_KILL: BOSS_KILL, MAGIC_X: MAGIC_X, cfg: cfg };
})();
