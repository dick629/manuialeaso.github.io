/* ============================================================================
 * afk-mobmagic.js — 夢域鏡、次元裂縫的怪物：放魔法＋一般攻擊附帶屬性傷害（Ping 11-18 18:47 提出、18:50 確認數字）
 *
 *   範圍：席琳夢域鏡、次元裂縫世界裡的怪物（含副本）；村莊、木人場、女神戰不算。經典模式沒有。
 *   放魔法：每隻怪每 15 秒放一次，從可用的階數裡抽，放過的不重複、全部放完再洗牌。
 *     一般怪 Lv50 以下只放 1 階、Lv50 以上 1～3 階；頭目 1～10 階。法術池＝法師各階的攻擊魔法。
 *     傷害＝法術基礎傷害（平均骰＋固定值）× 怪物等級 ÷ 10，算魔法傷害（吃魔防），再乘夢域鏡、次元裂縫原本的怪物傷害倍率（__afkTakenMods）。
 *   屬性攻擊：怪物的一般攻擊另外多一段屬性傷害＝該次傷害 30%；屬性用怪物本身的屬性，沒有的出生時隨機一種；
 *     吃對應屬性抗性（每 1 點 −0.5%，最多 −85%）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mobmagic', name: '夢域鏡／次元裂縫的怪物放魔法', group: '遊戲玩法', desc: '夢域鏡、次元裂縫的怪物每 15 秒放一次魔法（依等級 1～10 階），一般攻擊多 30% 屬性傷害' });
  if (T && !T.enabled('mobmagic')) return;
  if (typeof DB === 'undefined' || !DB.skills) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };
  var CFG = { every: 150, lvSplit: 50, lvDiv: 10, ele: 0.30, resPer: 0.005, resMax: 0.85 };
  var ELE = ['fire', 'water', 'wind', 'earth'], RESK = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };
  // 法術池：法師各階攻擊魔法（有傷害骰的）
  var POOL = null;
  var pool = function () {
    if (POOL) return POOL; POOL = {};
    Object.keys(DB.skills).forEach(function (id) { var k = DB.skills[id]; if (!k || k.type !== 'atk' || k.reqM == null || !k.dmgDice || k.procOnly) return; var t = Number(k.tier) || 0; if (t >= 1 && t <= 10) (POOL[t] = POOL[t] || []).push(id); });
    return POOL;
  };
  var scope = function () {
    var p = P(); if (!p || p.classicMode) return false;
    var cur = (typeof mapState !== 'undefined' && mapState.current) || '';
    if (!cur || /^town_/.test(cur) || (DB.towns && DB.towns[cur]) || cur === 'afk_dummy') return false;
    try { if (W.__afkFinalBoss && cur === W.__afkFinalBoss.MAP) return false; } catch (e) {}
    var rift = false; try { rift = !!(W.__afkDimRiftOn && W.__afkDimRiftOn()); } catch (e) {}
    return rift || !!(p.sherineDream && p.sherineMad);
  };
  var foe = function (m) { return !!(m && !m._dead && m.curHp > 0 && !m._isAlly && !m.isAlly && !m._train && m.race !== '建築' && !m.siegeEnemy && !m.pledgeEnemy); };
  var tiersOf = function (m) { if (m.boss) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; return (Number(m.lv) || 1) < CFG.lvSplit ? [1] : [1, 2, 3]; };
  var bag = function (m) {
    if (m._mmBag && m._mmBag.length) return m._mmBag;
    var P0 = pool(), a = []; tiersOf(m).forEach(function (t) { (P0[t] || []).forEach(function (id) { a.push(id); }); });
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return (m._mmBag = a);
  };
  var mods = function (ent, m) { var k = 1; (W.__afkTakenMods || []).forEach(function (f) { try { var v = Number(f(ent, m)); if (isFinite(v)) k *= v; } catch (e) {} }); return k; };
  var hurt = function (t, dmg) { try { if (W.__afkLore && W.__afkLore.boss) return W.__afkLore.boss.hurt(t, dmg, false); } catch (e) {} return 0; };
  var cast = function (m) {
    var b = bag(m), id = b.shift(); if (!id) return; var k = DB.skills[id], p = P(); if (!k || !p || p.dead) return;
    var avg = k.dmgDice[0] * (k.dmgDice[1] + 1) / 2 + (Number(k.dmgBase) || 0);
    var dmg = avg * (Number(m.lv) || 1) / CFG.lvDiv;
    var mrk = 1; try { mrk = (W.mrMultTaken || W.mrMult)(Number(p.d && p.d.mr) || 0); } catch (e) {}
    dmg = dmg * mrk * mods(p, m);
    var got = hurt(p, dmg);
    try { if (got && typeof logCombat === 'function' && !S().ff) logCombat('<span class="text-purple-300">' + m.n + ' 施放「' + k.n + '」，你受到 ' + Math.floor(got).toLocaleString() + ' 點魔法傷害。</span>', 'enemy'); } catch (e) {}
  };
  if (typeof W.tick === 'function') {
    var oT = W.tick;
    W.tick = function () {
      var t0 = now(), r = oT.apply(this, arguments);
      try {
        var t = now(); if (t === t0 || t % 10 || !scope()) return r;
        ((typeof mapState !== 'undefined' && mapState.mobs) || []).forEach(function (m) {
          if (!foe(m)) return;
          if (!m._mmNext) { m._mmNext = t + Math.floor(Math.random() * CFG.every); return; }
          if (t >= m._mmNext) { m._mmNext = t + CFG.every; cast(m); }
        });
      } catch (e) {}
      return r;
    };
  }
  // 屬性攻擊：怪物一般攻擊（非魔法）打中你或隊友時，多一段 30% 屬性傷害
  var eleOf = function (m) { if (ELE.indexOf(m.e) >= 0) return m.e; if (!m._mmEle) m._mmEle = ELE[Math.floor(Math.random() * 4)]; return m._mmEle; };
  var resOf = function (x, e) { var d = x === P() ? x.d : (x.d || x); return Number((d && d[RESK[e]]) || x[RESK[e]] || 0); };
  var hookIn = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.incoming !== 'function' || R.__afkMobMagic) return; R.__afkMobMagic = true;
    var o = R.incoming;
    R.incoming = function (target, damage, attacker, opts) {
      var out = o.apply(this, arguments);
      try {
        if (typeof out === 'number' && out > 0 && attacker && foe(attacker) && scope() && !(opts && (/mag/.test(String(opts.kind || opts.type || '')) || opts.origin === 'reflection'))) {
          var p = P(); if (target === p || (p && (p.allies || []).indexOf(target) >= 0)) {
            var e = eleOf(attacker), cut = Math.min(CFG.resMax, Math.max(0, resOf(target, e)) * CFG.resPer);
            var sc = 0; try { sc = W.__afkSeaEleCut ? Number(W.__afkSeaEleCut(target)) || 0 : 0; } catch (e3) {}
            var add = out * CFG.ele * (1 - cut) * (1 - sc); if (add >= 1) out += add;
          }
        }
      } catch (e2) {}
      return out;
    };
  };
  hookIn(); W.addEventListener('load', function () { hookIn(); setTimeout(hookIn, 3000); });
  W.__afkMobMagic = { CFG: CFG, pool: pool, scope: scope };
})();
