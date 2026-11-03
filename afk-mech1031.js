/* ============================================================================
 * afk-mech1031.js — 戰鬥機制調整（玩家 2026-10-31 01:56；02:50 改數值並歸入隱藏規則）
 *   開關：併入「隱藏規則」hiddenbonus（afk-toggles 的 MERGED 表）；經典模式不套用。隱藏規則，不寫進小百科。
 *
 *   一、深蝕：王身上的中毒或出血疊到 5 層，持續 20 秒後發動——之後每 5 秒，王的火、水、風、地抗性
 *       與魔防各 −5，最多各 −100（魔防最低到 0）。層數掉到 5 層以下就暫停（已扣的保留到王倒下），重新疊到 5 層再從 20 秒算起。
 *   二、戰士左右手都拿鈍器：造成的暈眩時間 ×1.5。
 *   三、妖精拿弓：幻影箭——每一發遠距離攻擊（每一支箭）10% 機率再射出一支幻影箭，對場上所有敵人造成這一發 30% 的傷害；
 *       這一發打的是王時改成 5% 機率、15% 傷害（04:46 調整）。
 *   四、王暈眩破綻：王被暈住時發動，10 秒內 AC +50、受到的物理傷害 +50%、被爆擊時爆擊傷害再 +50%（加在攻擊者的爆擊傷害上）。
 *       發動後冷卻 45 秒，冷卻中被暈住就只是單純不能動。
 *   五、轉生騎士衝擊之暈（場上只有一隻怪）：那隻怪 AC +50、破壞盔甲 5 秒；5 秒內牠在暈眩中受到的傷害 +20%
 *       （本體在 afk-knight-shock.js，共用這裡的 AC 減益 W.__afkAcDebuff 與 _afkKsVuln 標記）
 *   六、暈眩弱化（玩家 2026-11-02 23:58）：怪物每被暈住一次疊 1 層，最多 5 層；每層 AC +5（更容易被命中）、魔防 −5（最低到 0）、
 *       火水風地無五種屬性抗性各 −10。最後一次被暈住後 10 秒內沒有再被暈，所有層數一起消失。王、一般怪都算；可以和王暈眩破綻疊加。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mech1031', name: '戰鬥機制調整', group: '隱藏規則', seal: true, desc: '（內容不公開）' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var on = function () { if (W.__afkTestNoMech) return false; try { return (!T || T.enabled('mech1031')) && !!(P() && !P().classicMode); } catch (e) { return false; } };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState && mapState.mobs) || []; };
  var live = function (m) { return !!(m && !m._dead && m.curHp > 0); };
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'magic'); } catch (e) {} };
  var nm = function (m) { try { return '<span class="' + getMobColor(m.lv) + '">' + m.n + '</span>'; } catch (e) { return m.n; } };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };
  var item = function (inst) { return inst && typeof DB !== 'undefined' ? DB.items[inst.id] : null; };
  var tags = function (inst) { try { return inst && typeof getWeaponTags === 'function' ? getWeaponTags(inst.id) : []; } catch (e) { return []; } };
  var PHYS = { melee: 1, ranged: 1, phys: 1 };

  // ── AC 減益（同一隻怪可同時有多個來源，各自計時）──
  var acDebuff = function (m, key, amt, ticks) {
    if (!m) return;
    var b = m._afkAcDb || (m._afkAcDb = {}), cur = b[key];
    if (cur) { cur.until = Math.max(cur.until, tk() + ticks); return; }
    b[key] = { amt: amt, until: tk() + ticks };
    m.ac = (Number(m.ac) || 0) + amt;
  };
  var acStep = function (m) {
    var b = m && m._afkAcDb; if (!b) return;
    Object.keys(b).forEach(function (k) { if (tk() > b[k].until) { m.ac = (Number(m.ac) || 0) - b[k].amt; delete b[k]; } });
  };
  W.__afkAcDebuff = acDebuff;

  // ── 一、深蝕 ──
  var DS = { stacks: 5, wait: 200, iv: 50, step: 5, max: 100 }, RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var full = function (m) {
    var st = m.st || {};
    if (m.bleeds && m.bleeds.length >= DS.stacks) return true;
    if ((st.poison || 0) > 0 && (st.poisonStacks || 0) >= DS.stacks) return true;
    return false;
  };
  var deepStep = function (m, t) {
    if (!m.boss) return;
    if (!full(m)) { m._afkDsFull = 0; return; }
    if (!m._afkDsFull) { m._afkDsFull = t; return; }
    if (t - m._afkDsFull < DS.wait) return;
    var cut = m._afkDsCut || 0; if (cut >= DS.max) return;
    if (m._afkDsNext && t < m._afkDsNext) return;
    m._afkDsNext = t + DS.iv;
    var add = Math.min(DS.step, DS.max - cut);
    RES4.forEach(function (k) { m[k] = (Number(m[k]) || 0) - add; });
    var mr = Number(m.mr) || 0, mrCut = Math.min(add, Math.max(0, mr)); m.mr = mr - mrCut;
    m._afkDsCut = cut + add; m._afkDsMr = (m._afkDsMr || 0) + mrCut;
    if (cut === 0) clog(tag('深蝕', '#a3e635') + '毒血滲進 ' + nm(m) + ' 的骨髓，抗性與魔防開始崩解。');
  };

  // ── 二、戰士雙鈍器：暈眩 ×1.5 ──
  var BLUNT = /鈍器/;
  var dualBlunt = function (a) {
    if (!a || a.cls !== 'warrior' || !a.eq || !a.eq.wpn || !a.eq.offwpn) return false;
    return tags(a.eq.wpn).some(function (x) { return BLUNT.test(x); }) && tags(a.eq.offwpn).some(function (x) { return BLUNT.test(x); });
  };
  var lastHit = function (m) { var h = m && m._afkHitBy; return h && tk() - h.t <= 1 ? h.a : null; };
  var stunScale = function (list) {   // list＝[[怪, tick 前的暈眩]]；這一拍新上的暈眩（比自然遞減多）且最後打它的是雙鈍器戰士 → ×1.5
    for (var k = 0; k < list.length; k++) {
      var a = list[k][0], s0 = list[k][1], s1 = a.st ? (a.st.stun || 0) : 0;
      if (s1 > Math.max(0, s0 - 1) && live(a) && !(W.__afkHalted && W.__afkHalted(a)) && dualBlunt(lastHit(a))) a.st.stun = Math.round(s1 * 1.5);
    }
  };

  // ── 三、妖精拿弓：幻影箭 ──
  var PH = { chance: 0.10, pct: 0.30, bossChance: 0.05, bossPct: 0.15 };   // 2026-10-31 04:46：30%／50%、王 15%／35% → 10%／30%、王 5%／15%
  var bowElf = function (a) { var d = a && a.cls === 'elf' && a.eq && item(a.eq.wpn); return !!(d && (d.isBow || (tags(a.eq.wpn) || []).indexOf('弓') >= 0)); };
  var phantomLog = new WeakMap();

  // ── 四、王暈眩破綻 ──
  var BR = { dur: 100, cd: 450, ac: 50, phys: 1.5, critAdd: 50 };
  var breached = function (m) { return !!(m && m._afkBreachUntil && tk() <= m._afkBreachUntil); };
  var breachStep = function (m, t) {
    if (!m.boss) return;
    var stun = !!(m.st && m.st.stun > 0) || !!(W.__afkHalted && W.__afkHalted(m));
    if (!stun || breached(m) || t < (m._afkBreachCd || 0)) return;
    m._afkBreachUntil = t + BR.dur; m._afkBreachCd = t + BR.cd;
    acDebuff(m, 'breach', BR.ac, BR.dur);
    clog(tag('破綻', '#fbbf24') + nm(m) + ' 被暈住，露出了破綻！');
  };
  // 被爆擊時爆擊傷害 +50%：物理看這一下有沒有爆擊；魔法無從得知單下是否爆擊 → 照攻擊者魔法爆擊率換算成期望值
  var critBoost = function (actor, target, kind, c) {
    var d = (actor && actor.d) || {}, add = BR.critAdd / 100;
    if (PHYS[kind]) {
      if (!(c && c.t === target && c.at === tk())) return 1;
      var cd = Math.max(0, Number(kind === 'ranged' ? d.rangedCritDmg : d.meleeCritDmg) || 0) / 100;
      return (1 + cd + add) / (1 + cd);
    }
    if (kind === 'magic') {
      var m = 1 + Math.max(0, Number(d.magicCritDmg) || 0) / 100, p = Math.min(0.8, Math.max(0, Number(d.magicCrit) || 0) / 100);
      return (1 + p * (m + add - 1)) / (1 + p * (m - 1));
    }
    return 1;
  };

  // ── 六、暈眩弱化 ──
  var SW = { max: 5, ac: 5, mr: 5, res: 10, dur: 100 }, RES5 = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  var swAdd = function (m) {
    var w = m._afkStunWk || (m._afkStunWk = { n: 0, until: 0, mr: 0 });
    w.until = tk() + SW.dur;
    if (w.n >= SW.max) return;
    w.n++;
    m.ac = (Number(m.ac) || 0) + SW.ac;
    var mr = Number(m.mr) || 0, cut = Math.min(SW.mr, Math.max(0, mr)); m.mr = mr - cut; w.mr += cut;
    RES5.forEach(function (k) { m[k] = (Number(m[k]) || 0) - SW.res; });
  };
  var swStep = function (m) {
    var w = m && m._afkStunWk; if (!w || !w.n || tk() <= w.until) return;
    m.ac = (Number(m.ac) || 0) - SW.ac * w.n;
    m.mr = (Number(m.mr) || 0) + w.mr;
    RES5.forEach(function (k) { m[k] = (Number(m[k]) || 0) + SW.res * w.n; });
    m._afkStunWk = null;
  };
  var swScan = function (list) {
    for (var k = 0; k < list.length; k++) {
      var a = list[k][0], s0 = list[k][1], s1 = a.st ? (a.st.stun || 0) : 0;
      if (s1 > Math.max(0, s0 - 1) && live(a)) swAdd(a);
    }
  };

  // ── 傷害掛點（排在其他卡片／符文倍率之外）──
  var C = W.AFK_CARD_COMBAT, inner = false;
  var reflected = function (o) { return !!(o && (o.reflection || o.redirected || o.origin === 'reflection' || o.origin === 'self' || o.origin === 'redirect')); };
  var phantom = function (self, actor, target, v) {
    var boss = !!target.boss, ch = boss ? PH.bossChance : PH.chance;
    if (!(Math.random() < ch)) return;
    var amt = Math.floor(v * (boss ? PH.bossPct : PH.pct) * (typeof W.__afkRapidPhantom === 'function' ? W.__afkRapidPhantom() : 1) * (typeof W.__afkPhantomDecay === 'function' ? W.__afkPhantomDecay(actor) : 1)); if (!(amt > 0)) return;   // 平衡 C：1 秒內連發遞減（afk-balance1102）   // 隱藏規則：連射觸發的 −50%
    var ms = mobs(), hit = 0;
    inner = true;
    try {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i]; if (!live(m)) continue;
        var v2 = 0; try { v2 = Math.floor(oDmg.call(self, actor, m, amt, { kind: 'ranged', second: true }) || 0); } catch (e) {}
        if (!(v2 > 0)) continue;
        if (m === target) { m._afkPhantomPend = (m._afkPhantomPend || 0) + v2; hit++; continue; }   // 主目標：交給外層一起扣（避免在外層扣血前就倒下）
        m.curHp -= v2; hit++;
        if (m.curHp <= 0 && typeof killMob === 'function') { var idx = ms.indexOf(m); if (idx >= 0) try { killMob(idx); } catch (e) {} }
      }
    } finally { inner = false; }
    var lt = phantomLog.get(actor) || -1e9;
    if (hit && tk() - lt >= 50) { phantomLog.set(actor, tk()); clog(tag('幻影箭', '#67e8f9') + (actor === P() ? '你' : (actor._allyName || '妖精')) + ' 的箭影一分為眾，掃過 ' + hit + ' 個敵人。'); }
  };
  if (C && typeof C.damage === 'function') {
    var oDmg = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var crit0 = actor && actor._afkCrit;
      var v = oDmg.apply(this, arguments);
      try { if (!inner && v > 0 && opt && opt.kind === 'ranged' && typeof W.__afkTripleArrowMult === 'function') { var tm = W.__afkTripleArrowMult(actor, opt); if (tm < 1) v = Math.max(1, Math.floor(v * tm)); } } catch (e) {}   // 平衡 C：夢域鏡三重矢遞減（afk-balance1102）
      try {
        if (!on() || inner || !(v > 0) || !actor || !actor.cls || !target || reflected(opt)) return v;
        var kind = opt && opt.kind;
        var hb = { a: actor, t: tk() };   // 不可列舉：a 是整個角色物件，存進存檔會讓存檔暴增（2026-11-01）
        var hd = Object.getOwnPropertyDescriptor(target, '_afkHitBy');
        if (hd && !hd.enumerable) target._afkHitBy = hb;
        else { if (hd) { try { delete target._afkHitBy; } catch (e) {} } Object.defineProperty(target, '_afkHitBy', { value: hb, writable: true, configurable: true, enumerable: false }); }
        if (kind === 'dot') return v;
        if (breached(target)) {
          if (PHYS[kind]) v *= BR.phys;
          v *= critBoost(actor, target, kind, crit0);
        }
        if (target._afkKsVuln && tk() <= target._afkKsVuln && target.st && target.st.stun > 0) v *= 1.2;   // 騎士單體衝暈：暈眩中受到的傷害 +20%（5 秒）
        v = Math.floor(v);
        if (kind === 'ranged' && !(opt && opt.second) && bowElf(actor)) {
          phantom(this, actor, target, v);
          if (target._afkPhantomPend) { v += target._afkPhantomPend; target._afkPhantomPend = 0; }
        }
      } catch (e) {}
      return v;
    };
  }

  // ── 每個 tick：深蝕、破綻、AC 減益到期、雙鈍器延長暈眩 ──
  var snap = [];
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), ms = mobs();
      snap.length = 0;
      if (on()) for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m && m.st) snap.push([m, m.st.stun || 0]); }
      var r = oTick.apply(this, arguments);
      try {
        var t = tk(); if (t === t0) return r;
        ms = mobs();
        for (var j = 0; j < ms.length; j++) { var x = ms[j]; if (x) { acStep(x); swStep(x); } }
        if (!on()) return r;
        stunScale(snap);
        swScan(snap);
        for (var n = 0; n < ms.length; n++) { var b = ms[n]; if (!live(b)) continue; deepStep(b, t); breachStep(b, t); }
      } catch (e) {}
      return r;
    };
  }

  W.__afkMech1031 = { on: on, full: full, dualBlunt: dualBlunt, bowElf: bowElf, breached: breached, critBoost: critBoost, DS: DS, BR: BR, PH: PH,
    SW: SW, _swAdd: swAdd, _swStep: swStep, _deep: deepStep, _breach: breachStep, _stunScale: stunScale, _acStep: acStep, _inner: function (v) { inner = !!v; } };
})();
