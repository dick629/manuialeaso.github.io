/* ==========================================================================
 * afk-resist.js — 抗性新制（玩家 2026-10-21 指定；需要核心補丁 31）
 *   2026-10-25：只在瘋狂席琳席琳夢域鏡有效，其他地方照原版抗性計算（百分比減傷 75% 上限照舊）
 *
 * 火／水／風／地屬性抗性（你、傭兵、怪物受到屬性傷害時都一樣）——中間依兩端點等比例內插：
 *   抗性    0 → 受到的屬性傷害 +50%      抗性  50 → 正常
 *   抗性  100 → 減傷 20%   150 → 30%   200 → 40%   250 → 50%   300 → 60%   400 → 70%   500 → 80%
 *   抗性上限 500；超出的部分面板顯示成「500(+X)」：
 *   500(+100) → 85%   500(+200) → 90%   500(+300) → 99%
 *   500(+500) → 屬性傷害免疫，改當成物理傷害計算（一般攻擊照物理流程；魔法改吃無屬性抗性的物理減傷）
 *
 * 無屬性抗性：減少受到的物理傷害，在整個傷害公式算完、百分比減傷特效（上限 75%）之後才套用：
 *   每 1 點減少 1 點傷害（最多算 500 點），另外依門檻再減百分比：
 *   100 → 1%   200 → 3%   300 → 5%   400 → 7%   500 → 10%
 *   500(+100) → 15%   500(+200) → 20%   500(+300) → 25%   500(+400) → 30%   500(+500) → 減 20% 再減 20%（共 36%）
 *   無屬性魔法照舊吃原本的無屬性抗性折減。
 *   百分比減傷特效（你和傭兵）合計上限 75%（核心補丁 31、32）。
 *
 * 滿抗轉物理（2026-11-04 03:14 玩家；子開關 res1000，預設開；經典模式照舊）：
 *   ‧火水風地抗性的總上限 800 → 1000（無屬性抗性 2026-11-05 起跟火水風地同一個上限）。你與傭兵都一樣（傭兵重算能力時也走這裡夾）。
 *   ‧抗性到 1000（滿抗）：那個屬性的傷害改當成物理傷害——不再吃屬性抗性，改吃防禦（AC 隨機減傷）、傷害減免等物理的減傷。
 *       席琳夢域鏡：原本就寫好的「1000 屬性免疫」（一般攻擊走純物理、魔法改吃無屬性抗性的物理減傷比例）現在打得到了。
 *       其他地方：原版曲線 300 起就是 100% 減傷；滿 1000 時改成倍率 1（物理），一般攻擊照物理流程、魔法照扣傷害減免與魔防。
 *   ‧1000 以下照原本的表／原版曲線，只是上限變高（夢域鏡 800～999 都是 −99%；原版 300～999 都是 −100%）。
 *   ‧2026-11-04（玩家）滿抗的代價改小：轉成物理、走完整條物理減傷後的傷害 P，只受 50%（P×0.5），另外回復 P×10% 的 HP（淨 40%）。
 *       你與傭兵、夢域鏡與其他地方都一樣。做法：抗性倍率被叫到（1000 起）時記下「這一下要轉換」，在受傷掛點 __afkTaken 的最外層（window load 後包）
 *       把那一下打五折＋回血（不算進百分比減傷 75% 上限）。外掛自己算的屬性傷害（夢域鏡房間、暗夢星迴究極魔法）傳第 4 參數 direct，直接回淨倍率 0.4。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'res1000', parent: 'dreamhell', name: '屬性抗性上限 1000（滿抗轉物理）', group: '遊戲玩法', seal: true,
    desc: '火水風地抗性上限從 800 提高到 1000；抗性滿 1000 時，那個屬性的傷害改當物理、只受一半，另外回復 10%' });
  if (T && !T.enabled('resist')) return;
  // 經典模式照舊：傭兵重算能力時全域 player 暫時換成傭兵（_recomputingAlly），這時看最近一次的真正角色
  var lastReal = null;
  var realP = function () {
    try { if (typeof _recomputingAlly !== 'undefined' && _recomputingAlly && lastReal) return lastReal; } catch (e) {}
    var p = typeof player !== 'undefined' ? player : null;
    if (p && p.cls && !p._allyName) lastReal = p;
    return p;
  };
  var fullOn = function () { if (T && !T.enabled('res1000')) return false; var p = realP(); return !(p && p.classicMode); };

  var CAP = 500, IMMUNE = 1000;
  // 次元裂縫（Ping 11-07）：火水風地滿抗門檻 1000 → 2000（減傷曲線照新門檻等比例拉長）；無屬性維持 1000
  var riftOn = function () { try { return !!(window.__afkDimRiftOn && window.__afkDimRiftOn()); } catch (e) { return false; } };
  var IMM = function () { return riftOn() ? 2000 : IMMUNE; };
  var RIFT_K = 2;
  var CONV = { take: 0.5, heal: 0.1 };   // 滿抗轉物理：只受 50%、回復 10%
  var ELE_KEY = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };
  // [抗性, 受到傷害倍率]
  var PTS = [[0, 1.5], [50, 1.0], [100, 0.8], [150, 0.7], [200, 0.6], [250, 0.5], [300, 0.4], [400, 0.3], [500, 0.2], [600, 0.15], [700, 0.10], [800, 0.01]];
  var eleFactor = function (v) {
    v = Math.max(0, Number(v) || 0);
    if (v >= PTS[PTS.length - 1][0]) return PTS[PTS.length - 1][1];
    for (var i = 1; i < PTS.length; i++) {
      if (v <= PTS[i][0]) { var a = PTS[i - 1], b = PTS[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); }
    }
    return 1;
  };
  // 無屬性抗性的百分比部分 → 受到傷害倍率
  var nonePctMult = function (v) {
    v = Math.max(0, Number(v) || 0);
    if (v >= 1000) return 0.8 * 0.8;
    var tbl = [[900, 0.30], [800, 0.25], [700, 0.20], [600, 0.15], [500, 0.10], [400, 0.07], [300, 0.05], [200, 0.03], [100, 0.01]];
    for (var i = 0; i < tbl.length; i++) if (v >= tbl[i][0]) return 1 - tbl[i][1];
    return 1;
  };
  // 2026-10-26：曲線統一到 afk-curves（一份表、一個內插函式）
  if (window.AFK_CURVES) {
    var CV = window.AFK_CURVES;
    eleFactor = function (v) { return CV.lerp(CV.ELE_DREAM, Math.max(0, Number(v) || 0)); };
    nonePctMult = function (v) { return CV.step(CV.NONE_DREAM, Math.max(0, Number(v) || 0)); };
  }
  window.__afkEleFactor = eleFactor;
  window.__afkResFull = { on: function () { return fullOn(); }, IMMUNE: IMMUNE, CAP4_OLD: 800, CAP4_NEW: 1000, CONV: CONV, last: null };
  // 玩家 2026-10-25：抗性新制只在瘋狂席琳席琳夢域鏡有效；其他地方回到原版抗性（核心看不到這兩個掛點就走原本的算法）
  var dreamOn = function () { try { return !!(typeof player !== 'undefined' && player && player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  // 滿抗轉物理（1000 起）：記下這一下，受傷掛點再打五折＋回血；direct＝外掛自己扣血的屬性傷害，直接回淨倍率
  var pend = null;
  var conv = function (d, isPhys, base, direct) {
    if (direct) return base * (CONV.take - CONV.heal);
    pend = { d: d, kind: isPhys ? 'phys' : 'magic', t: (typeof state !== 'undefined' && state) ? state.ticks : 0 };
    return base;
  };
  var eleMult = function (d, ele, isPhys, direct) {
    var key = ELE_KEY[ele]; if (!key || !d) return 1;
    var v = Number(d[key]) || 0;
    if (v >= IMM()) return conv(d, isPhys, isPhys ? 1 : nonePctMult(d.resNone), direct);   // 屬性免疫：一般攻擊當純物理；魔法改吃物理減傷
    return eleFactor(riftOn() ? v / RIFT_K : v);
  };
  var noneRes = function (d, dmg) {
    if (!dreamOn()) return dmg;   // 席琳夢域鏡以外：物理不吃無屬性抗性（原版行為）；百分比減傷 75% 上限照舊
    if (!(dmg > 0) || !d) return dmg;
    var v = Number(d.resNone) || 0; if (v <= 0) return dmg;
    var out = Math.floor(dmg * nonePctMult(v)) - Math.min(CAP, Math.floor(v));
    return Math.max(1, out);
  };

  // 席琳夢域鏡以外（滿抗轉物理開著時）：1000 以下照原版 1 − 抗性換算%（夾 0～1）；1000 起倍率 1＝當物理算
  var eleMultOrig = function (d, ele, isPhys, direct) {
    var key = ELE_KEY[ele]; if (!key || !d) return 1;
    var v = Number(d[key]) || 0;
    if (v >= IMMUNE) return conv(d, isPhys, 1, direct);
    if (!v) return 1;
    var pct = typeof effResistPct === 'function' ? effResistPct(v) : v;
    return Math.max(0, Math.min(1, 1 - pct / 100));
  };
  Object.defineProperty(window, '__afkEleMult', { configurable: true, get: function () { return dreamOn() ? eleMult : (fullOn() ? eleMultOrig : undefined); }, set: function () {} });
  // 受傷掛點最外層：被記下的那一下（同一個人、同一個 tick、同一種傷害）只受 50%，另外回復轉換後傷害的 10%
  var installConv = function () {
    var o = window.__afkTaken; if (typeof o !== 'function' || o.__afkResConv) return;
    var w = function (ent, dmg, mob, kind) {
      var v = o.apply(this, arguments), p = pend; pend = null;
      try {
        if (!p || !ent || !(v > 0) || p.d !== ent.d || p.kind !== kind || p.t !== ((typeof state !== 'undefined' && state) ? state.ticks : 0)) return v;
        var take = Math.floor(v * CONV.take), heal = Math.floor(v * CONV.heal);
        if (heal > 0) { if (ent === player) player.hp += heal; else ent.curHp = (ent.curHp || 0) + heal; }   // 扣血前先加：扣完＝受 50%、回 10%（不會超過上限）
        window.__afkResFull.last = { raw: v, take: take, heal: heal };
        return take;
      } catch (e) { return v; }
    };
    w.__afkResConv = true; window.__afkTaken = w;
  };
  window.addEventListener('load', installConv);
  Object.defineProperty(window, '__afkNoneRes', { configurable: true, get: function () { return noneRes; }, set: function () {} });

  // 怪物也套同一張表（你和傭兵、召喚、寵物打怪物的屬性魔法）：抗性 0 的怪物受到屬性魔法 +50%
  //   核心 magicAttrDefense 回傳「減免比例」（0～1）→ 改回傳 1−倍率（可以是負的＝受傷增加）；
  //   magicDamageCoef 原本把它夾在 0～1，負的部分在外面補回去
  if (typeof window.magicAttrDefense === 'function') {
    var oMAD = window.magicAttrDefense;
    window.magicAttrDefense = function (target, ele) {
      var key = ELE_KEY[ele]; if (!key || !target || !dreamOn()) return oMAD.apply(this, arguments);
      var d = target.d || target, v = Number(d[key]) || 0;
      var fr = target === player || (player && (player.allies || []).indexOf(target) >= 0), rk = riftOn() && fr;
      var f = v >= (rk ? 2000 : IMMUNE) ? nonePctMult(d.resNone) : eleFactor(rk ? v / RIFT_K : v);
      return 1 - f;
    };
  }
  if (typeof window.magicDamageCoef === 'function') {
    var oMDC = window.magicDamageCoef;
    window.magicDamageCoef = function (dStats, attrDefense, spellTier) {
      var r = oMDC.apply(this, arguments), a = Number(attrDefense) || 0;
      if (a < 0) r += (-a) * (spellTier == null ? 1 : (typeof magicTierMult === 'function' ? magicTierMult(spellTier) : 1));
      return r;
    };
  }

  // 能力面板：超過 500 顯示「500(+X)」
  if (typeof window._updateUIImpl === 'function') {
    var oUI = window._updateUIImpl;
    window._updateUIImpl = function () {
      var r = oUI.apply(this, arguments);
      try {
        var d = player && player.d; if (!d || !dreamOn()) return r;
        [['dt-resfire', 'resFire'], ['dt-reswater', 'resWater'], ['dt-reswind', 'resWind'], ['dt-researth', 'resEarth'], ['dt-resnone', 'resNone']].forEach(function (a) {
          var el = document.getElementById(a[0]), v = Math.round(d[a[1]] || 0); if (!el || v <= CAP) return;
          var t = CAP + '(+' + (v - CAP) + ')'; if (el.textContent !== t) el.textContent = t;
        });
      } catch (e) {}
      return r;
    };
  }

  // ── 抗性總上限（玩家 2026-10-25）：火水風地各最多 800、無屬性最多 300（所有來源加總後才夾）──
  //   2026-11-04：滿抗轉物理（res1000）開著時火水風地改成 1000
  //   2026-11-05 20:09（玩家）：無屬性抗性超過 300 也有效，上限跟火水風地一樣（800／1000）；席琳夢域鏡照無屬性的表（400→7%、500→10%、500(+X)…）
  var ELE4 = ['resFire', 'resWater', 'resWind', 'resEarth'], CAP4_OLD = 800, CAP4_NEW = 1000;
  var TOTAL_CAP = { resFire: CAP4_OLD, resWater: CAP4_OLD, resWind: CAP4_OLD, resEarth: CAP4_OLD, resNone: CAP4_OLD };
  window.__afkResCap = TOTAL_CAP;
  var clampRes = function () {
    try {
      var c4 = fullOn() ? CAP4_NEW : CAP4_OLD; ELE4.forEach(function (k) { TOTAL_CAP[k] = riftOn() ? 2000 : c4; }); TOTAL_CAP.resNone = c4;
      var d = typeof player !== 'undefined' && player && player.d; if (!d) return;
      for (var k in TOTAL_CAP) if ((Number(d[k]) || 0) > TOTAL_CAP[k]) { d['_raw_' + k] = d[k]; d[k] = TOTAL_CAP[k]; } else d['_raw_' + k] = d[k];
    } catch (e) {}
  };
  var installCap = function () {
    if (typeof window.recomputeStats !== 'function' || window.recomputeStats.__afkResCap) return;
    var oR = window.recomputeStats;
    window.recomputeStats = function () { var r = oR.apply(this, arguments); clampRes(); return r; };
    window.recomputeStats.__afkResCap = true;
  };
  installCap();
  window.addEventListener('load', function () { window.recomputeStats && (window.recomputeStats.__afkResCap = false); installCap(); });
  console.log('[AFK-resist] 已啟用：屬性抗性查表（0＝+50%、500＝-80%、溢出 +500 免疫）、無屬性抗性減物理傷害');
})();
