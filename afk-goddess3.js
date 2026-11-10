/* ============================================================================
 * afk-goddess3.js — 女神與四龍的新機制（玩家 2026-11-03：「先設計這樣 用看看 再來討論怎修改」）
 *   外掛開關 goddess3（預設開；經典模式不套用），底下四個子選項各自可關：
 *
 * 一、永久雙免疫（子選項 g3immune）
 *   ‧席琳夢域鏡的四龍副本：四龍（最終龍七階的每一階）永久免疫物理與魔法傷害。
 *   ‧女神（一轉女神、終焉第一階層、二轉決戰、終焉第二／三階層）：永久免疫物理與魔法傷害。
 *     次元突破者的單人試煉不套用（CFG.soloImmune；女神在那一場不出手，一個人沒有汙濁之水／粉碎能量就永遠打不動）。
 *   ‧任何隊員施放「汙濁之水」→ 物理免疫解除 30 秒；施放「粉碎能量」→ 魔法免疫解除 30 秒（重放刷新 30 秒）。
 *   ‧只擋直接傷害（近距離／遠距離／魔法，含寵物、召喚物）；持續傷害（毒、出血、灼燒）與真實傷害照常。
 *
 * 二、斬殺（子選項 g3execute；所有女神戰）
 *   ‧一轉女神（還沒轉生、第一次打席琳）：隊員 HP 低於 30% 直接斬殺；全隊每 60 秒最多一次（挑 HP 比例最低的人）。
 *   ‧二轉一階段（二轉決戰、終焉第一階層「席琳夢境」轉生後）：HP 低於 40% → 立刻變成 1（這一下不會死），
 *     1 秒內沒補回 50% 以上就斬殺。
 *   ‧二轉二階段（終焉第二階層「席琳幻影」）：低於 50% → 1 HP，1 秒內要回到 60%。
 *   ‧二轉三階段（終焉第三階層「席琳伴身」）：低於 60% → 1 HP，1 秒內要回到 70%。
 *
 * 三、幽影與狂暴（子選項 g3shadow；只有二轉一階段）
 *   ‧席琳 HP 降到 70%／40%／10% 時進入「幽影」：不受任何傷害、每秒回復最大 HP 0.2%（CFG.shadow.regen）；
 *     每秒吸走每名隊員最大 HP 5%，並讓他五屬性抗性 −10、魔防 −10、AC +10、命中 −10（幽影期間每秒疊加，幽影結束就恢復）。
 *     身上帶著雅典娜之杖（背包或裝備）的人不受吸取與降能力；席琳照樣回血。
 *   ‧幽影時她喚出「被侵蝕的時空四龍」四隻（場上最多兩隻，倒一隻補一隻）；四隻都倒下，幽影才結束。
 *     幽影中席琳隱沒在影子裡，目標會自動換到時空四龍身上（不然全隊會一直打不受傷的席琳，四龍永遠打不完）。
 *     時空四龍：外觀借四龍，能力借冥界的使徒，HP＝使徒的 CFG.shadow.dragonHpK 倍；沒有經驗、金幣與掉落。
 *   ‧第三次幽影（10%）結束後，席琳再降到 10% → 「狂暴」直到戰鬥結束：每秒強制吸走 5% HP、同樣每秒降能力（雅典娜之杖擋不住）。
 *
 * 四、次元裂縫：龍之護甲（子選項 g3rift，預設關）
 *   ‧遊戲裡還沒有叫「次元裂縫」的模式；先做成子選項：開啟時，席琳夢域鏡的四龍副本裡最終龍每 40 秒施放「龍之護甲」，
 *     10 秒內每一下受到的傷害先扣 5000（真實防禦，連持續傷害、真實傷害都扣）；跟一、二、三與夢域鏡規則疊加。
 *
 * 量測與測試：window.__afkGoddess3（cfg、stage()、stats、reset）；scripts/test-goddess3.mjs。
 * 須排在 afk-finalboss、afk-rebirth2、afk-finaltiers、afk-corrupt、afk-debuff-rules、afk-illufix、afk-hidden 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) {
    T.register({ id: 'goddess3', name: '女神與四龍新機制（免疫、斬殺、幽影）', group: '遊戲玩法', seal: true,
      desc: '女神與夢域鏡四龍永久免疫物理與魔法（汙濁之水、粉碎能量各解除 30 秒）；女神戰低血量斬殺；二轉女神 70／40／10% 進入幽影並召喚時空四龍' });
    T.register({ id: 'g3immune', parent: 'goddess3', name: '永久免疫（汙濁之水／粉碎能量解除 30 秒）', group: '遊戲玩法', seal: true,
      desc: '女神與夢域鏡四龍免疫物理與魔法傷害；隊員施放汙濁之水解除物理免疫 30 秒、粉碎能量解除魔法免疫 30 秒' });
    T.register({ id: 'g3execute', parent: 'goddess3', name: '女神斬殺', group: '遊戲玩法', seal: true,
      desc: '一轉女神：HP 低於 30% 斬殺（每分鐘一次）；二轉女神：HP 低於 40／50／60% 變成 1，1 秒內沒補到 50／60／70% 就斬殺' });
    T.register({ id: 'g3shadow', parent: 'goddess3', name: '二轉女神的幽影與狂暴', group: '遊戲玩法', seal: true,
      desc: '女神 70／40／10% 進入幽影（無敵、回血、每秒吸血降能力，召喚時空四龍）；最後 10% 狂暴' });
    // 次元裂縫（g3rift）：玩家 2026-11-03——是之後才會有的「夢域鏡之上」難度，現在還不存在 → 不登錄開關、不給玩家看；
    //   只有 window.__afkG3Rift = true（測試／之後做難度時）才會作用。
  }
  var on = function (id) { return !T || T.enabled(id); };
  if (!on('goddess3')) return;
  var FB = W.__afkFinalBoss;
  if (!FB || typeof FB.mode !== 'function' || typeof W.tick !== 'function') { console.warn('[AFK-goddess3] 找不到最終頭目，略過'); return; }

  var CFG = W.__afkG3Cfg = W.__afkG3Cfg || {
    offSec: 30,                       // 汙濁之水／粉碎能量解除免疫的秒數
    soloImmune: false,                // 單人試煉要不要也免疫
    exec1: { pct: 0.30, cd: 60 },     // 一轉女神：低於 30% 斬殺，全隊 60 秒一次
    exec2: { r2a: [0.40, 0.50], r2b: [0.50, 0.60], r2c: [0.60, 0.70] }, execWin: 1,   // 二轉：[觸發, 1 秒內要補到]
    shadow: { at: [0.70, 0.40, 0.10], regen: 0.002, drain: 0.05, res: 10, mr: 10, ac: 10, hit: 10, dragons: 4, field: 2, dragonHpK: 1, dragonImmune: false, rage: 0.10 },
    armor: { every: 40, sec: 10, val: 5000 }
  };
  var STAGE_N = { r1: '一轉女神', r2a: '二轉一階段', r2b: '二轉二階段', r2c: '二轉三階段', solo: '單人試煉' };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return S().ticks || 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var log = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + (c || '#e879f9') + ';">【' + t + '】</span>'; };
  var nameOf = function (x) { return x === player ? '你' : '協力·' + (x._allyName || '傭兵'); };

  // ── 現在是哪一場 ──
  // 一轉女神＝'first' 且還沒轉生（初次輪迴）；二轉一階段＝'second'（二轉決戰）與 'first' 已轉生（終焉第一階層）；
  // 二轉二／三階段＝終焉第二／三階層（'tier2'／'tier3'）；'solo'＝次元突破者單人試煉
  var stage = function () {
    try {
      if (!FB.on() || classic() || !S()._afkFinalSpawned) return null;
      var md = FB.mode();
      if (md === 'first') return S()._afkFinalNovice ? 'r1' : 'r2a';
      return { second: 'r2a', tier2: 'r2b', tier3: 'r2c', solo: 'solo' }[md] || null;
    } catch (e) { return null; }
  };
  var dragonDungeon = function () {
    try {
      if (classic()) return false;
      var s = S(); if (!s.antharas || typeof ANTHARAS_AREA_BOSS === 'undefined' || !ANTHARAS_AREA_BOSS[mapState.current]) return false;
      return !!(player && player.sherineDream && player.sherineMad);
    } catch (e) { return false; }
  };
  var bossOf = function () { return (mapState.mobs || []).filter(function (m) { return m && m._afkFinal && !m._dead && m.curHp > 0; })[0] || null; };
  var members = function () { var out = [], p = P(); if (!p) return out; if (!p.dead) out.push(p); (p.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) out.push(x); }); return out; };
  var pctOf = function (x) { return x === player ? (player.hp || 0) / (player.mhp || 1) : (x.curHp || 0) / (x.mhp || 1); };

  // ── 量測用統計（不存檔）──
  var ST = { blocked: { phys: 0, magic: 0, shadow: 0 }, breaks: { phys: 0, magic: 0 }, breakAt: { phys: [], magic: [] }, exec: [], marked: 0, saved: 0,
    shadows: [], berserkAt: null, drainHits: 0, athenaSkip: 0, dragonsKilled: 0, armorCasts: 0, armorAbsorbed: 0 };
  var resetStats = function () { var f = JSON.parse(JSON.stringify(ST)); Object.keys(ST).forEach(function (k) { ST[k] = f[k]; }); ST.blocked = { phys: 0, magic: 0, shadow: 0 }; ST.breaks = { phys: 0, magic: 0 }; ST.breakAt = { phys: [], magic: [] }; ST.exec = []; ST.shadows = []; ST.berserkAt = null; ST.drainHits = 0; ST.athenaSkip = 0; ST.dragonsKilled = 0; ST.armorCasts = 0; ST.armorAbsorbed = 0; ST.marked = 0; ST.saved = 0; };
  var fightAge = function () { var m = bossOf(); return m && m._fbBorn != null ? Math.round((tk() - m._fbBorn) / 10) : Math.round(tk() / 10); };

  // ── 一、免疫 ──
  var off = { map: null, phys: 0, magic: 0, was: { phys: true, magic: true } };   // 解除到第幾 tick
  var syncOff = function () { var mp = (typeof mapState !== 'undefined' && mapState.current) || null; if (off.map !== mp) { off.map = mp; off.phys = 0; off.magic = 0; off.was = { phys: true, magic: true }; } };
  var immCtx = function () {
    if (!on('g3immune')) return false;
    var st = stage(); if (st) return st !== 'solo' || !!CFG.soloImmune;
    return dragonDungeon();
  };
  var immTarget = function (m) {
    if (!m || !immCtx()) return false;
    if (m._afkFinal) return !!stage();
    if (m._afkDragonStage) return dragonDungeon();
    if (m._g3Dragon) return !!CFG.shadow.dragonImmune;
    return false;
  };
  var immOn = function (kind) { syncOff(); return tk() >= (off[kind] || 0); };
  var KIND = { melee: 'phys', ranged: 'phys', phys: 'phys', magic: 'magic' };
  var breakImm = function (kind, who) {
    if (!immCtx()) return;
    syncOff();
    var was = immOn(kind);
    off[kind] = tk() + CFG.offSec * 10; off.was[kind] = false;
    ST.breaks[kind]++; if (ST.breakAt[kind].length < 200) ST.breakAt[kind].push(fightAge());
    if (was) log(tag(kind === 'phys' ? '汙濁之水' : '粉碎能量', kind === 'phys' ? '#7dd3fc' : '#e879f9') + who + '打破了' + (kind === 'phys' ? '物理' : '魔法') + '免疫（' + CFG.offSec + ' 秒）。');
  };
  var restoreLog = function () {
    if (!immCtx()) return;
    ['phys', 'magic'].forEach(function (k) {
      var now = immOn(k);
      if (now && !off.was[k]) log(tag('免疫', '#a78bfa') + (k === 'phys' ? '物理' : '魔法') + '免疫恢復了。');
      off.was[k] = now;
    });
  };
  // 施放偵測：汙濁之水看冷卻有沒有開始（afk-debuff-rules 冷卻中會改放三重矢，那次不算）；粉碎能量看施放成功
  var FOUL = 'sk_elf_muddywater', CRUSH = 'sk_illu_crush';
  var isFoul = function (s) { return s === FOUL || (s && typeof DB !== 'undefined' && DB.skills && s === DB.skills[FOUL]); };
  var isCrush = function (s) { return s === CRUSH || (s && typeof DB !== 'undefined' && DB.skills && (s === DB.skills[CRUSH] || s.n === '粉碎能量')); };
  var foulCast = function (who, before, r) { return r !== false && r != null && r !== 0 && (who._afkFoulCdUntil !== before || typeof W.__afkFoulCd !== 'function'); };
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      if (!(isFoul(skId) || isCrush(skId)) || !P()) return oCast.apply(this, arguments);
      var b = player._afkFoulCdUntil, r = oCast.apply(this, arguments);
      try { if (isFoul(skId) ? foulCast(player, b, r) : r) breakImm(isFoul(skId) ? 'phys' : 'magic', '你'); } catch (e) {}
      return r;
    };
  }
  if (typeof W.allyCastMagic === 'function') {
    var oAM = W.allyCastMagic;
    W.allyCastMagic = function (ally, s) {
      if (!ally || !(isFoul(s) || isCrush(s))) return oAM.apply(this, arguments);
      var b = ally._afkFoulCdUntil, r = oAM.apply(this, arguments);
      try { if (isFoul(s) ? foulCast(ally, b, r) : (r !== false && r != null)) breakImm(isFoul(s) ? 'phys' : 'magic', nameOf(ally)); } catch (e) {}
      return r;
    };
  }
  // 傭兵的汙濁之水走 allyCastNonDamage（純狀態技；目標身上已經有汙濁才不重放），不經 allyCastMagic
  if (typeof W.allyCastNonDamage === 'function') {
    var oND = W.allyCastNonDamage;
    W.allyCastNonDamage = function (ally, sk) {
      var r = oND.apply(this, arguments);
      try { if (r === true && ally && isFoul(sk)) breakImm('phys', nameOf(ally)); } catch (e) {}
      return r;
    };
  }
  if (typeof W.allyCastCrush === 'function') {
    var oAC = W.allyCastCrush;
    W.allyCastCrush = function (ally, s) {
      var r = oAC.apply(this, arguments);
      try { if (r && isCrush(s)) breakImm('magic', nameOf(ally)); } catch (e) {}
      return r;
    };
  }

  // ── 傷害掛點：免疫、幽影無敵、龍之護甲（包在最外層；別人後來再包也只算一次）──
  var busy = 0;
  var shadowOn = function (m) { return !!(m && m._afkFinal && F.sh && F.sh.on && on('g3shadow') && stage() === 'r2a'); };
  var armorOn = function (m) { return !!(m && m._afkDragonStage && (!!W.__afkG3Rift && on('goddess3')) && dragonDungeon() && tk() < (A.until || 0)); };
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__g3) return;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      if (busy) return o.apply(this, arguments);
      busy++;
      try {
        if (target && !(target === player || target.eq)) {
          if (shadowOn(target)) { ST.blocked.shadow += Number(amount) || 0; return 0; }
          var k = KIND[opt && opt.kind];
          if (k && immTarget(target) && immOn(k)) { ST.blocked[k] += Number(amount) || 0; return 0; }
        }
        var r = o.apply(this, arguments);
        if (r > 0 && armorOn(target)) { var cut = Math.min(r, CFG.armor.val); ST.armorAbsorbed += cut; r -= cut; }
        return r;
      } finally { busy--; }
    };
    f.__g3 = true; C.damage = f;
  };
  hookDamage();
  try { W.addEventListener('load', hookDamage); } catch (e) {}

  // ── 二、斬殺 ──
  var F = { born: null, nextExec: 0, marks: null, sh: null };   // 每場重置
  var newFight = function (m) { F.born = m ? m._fbBorn : null; F.nextExec = 0; F.marks = new Map(); F.sh = null; };
  var execute = function (x, why) {
    ST.exec.push([fightAge(), x === player ? 'leader' : (x.cls || 'ally'), why]);
    log(tag('斬殺', '#ef4444') + '死亡女神的鐮刃落下——' + nameOf(x) + '被斬殺了（' + why + '）。');
    if (x === player) { player.hp = 0; if (typeof killPlayer === 'function') killPlayer(); }
    else { x.curHp = 0; x._downed = true; x._reviveCd = 150; }
  };
  var execStep = function (st) {
    if (!on('g3execute')) return;
    var t = tk();
    if (st === 'r1') {
      if (t < F.nextExec) return;
      var c = members().filter(function (x) { return pctOf(x) < CFG.exec1.pct; }).sort(function (a, b) { return pctOf(a) - pctOf(b); })[0];
      if (c) { F.nextExec = t + CFG.exec1.cd * 10; execute(c, 'HP 低於 ' + Math.round(CFG.exec1.pct * 100) + '%'); }
      return;
    }
    var th = CFG.exec2[st]; if (!th) return;
    var ms = members();
    F.marks.forEach(function (v, x) { if (ms.indexOf(x) < 0) F.marks.delete(x); });
    ms.forEach(function (x) {
      var p = pctOf(x), mk = F.marks.get(x);
      if (mk != null) {
        if (p >= th[1]) { F.marks.delete(x); ST.saved++; log(tag('斬殺', '#22c55e') + nameOf(x) + '及時被救回，躲過了鐮刃。'); }
        else if (t >= mk) { F.marks.delete(x); execute(x, '1 秒內沒補到 ' + Math.round(th[1] * 100) + '%'); }
        return;
      }
      if (p < th[0]) {
        if (x === player) player.hp = 1; else x.curHp = 1;
        F.marks.set(x, t + CFG.execWin * 10); ST.marked++;
        log(tag('斬殺預告', '#f97316') + nameOf(x) + '的生命被壓到 1——' + CFG.execWin + ' 秒內補到 ' + Math.round(th[1] * 100) + '% 以上，否則斬殺。');
      }
    });
  };

  // ── 三、幽影與狂暴 ──
  var RES = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'], HITS = ['meleeHit', 'rangedHit', 'magicHit'];
  var ATHENA = 'ttmi_5413';
  var holdsAthena = function (x) {
    if (x === player) { try { return !!(W.__afkHidden && W.__afkHidden.carryAthena && W.__afkHidden.carryAthena()); } catch (e) { return false; } }
    var eq = x && x.eq || {}; for (var k in eq) { var e = eq[k]; if (e && e.id === ATHENA) return true; }
    return (x && x.inv || []).some(function (i) { return i && i.id === ATHENA; });
  };
  var applyDeb = function (x) {
    if (x === player) { try { recomputeStats(); } catch (e) {} return; }
    var d = x.d; if (!d) return;
    var k = x._g3Stk || 0, ap = x._g3Ap; if (ap && ap.d !== d) ap = null;   // 面板重建過＝舊的扣減已經不在了
    var dk = k - (ap ? ap.k : 0); if (!dk) return;
    var sh = CFG.shadow;
    RES.forEach(function (q) { d[q] = (Number(d[q]) || 0) - sh.res * dk; });
    d.mr = (Number(d.mr) || 0) - sh.mr * dk; d.ac = (Number(d.ac) || 0) + sh.ac * dk;
    HITS.forEach(function (q) { d[q] = (Number(d[q]) || 0) - sh.hit * dk; });
    x._g3Ap = k ? { d: d, k: k } : null;
  };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var k = player && player._g3Stk;
        if (k > 0 && player.d) {
          var d = player.d, sh = CFG.shadow;
          RES.forEach(function (q) { d[q] = (Number(d[q]) || 0) - sh.res * k; });
          d.mr = (Number(d.mr) || 0) - sh.mr * k; d.ac = (Number(d.ac) || 0) + sh.ac * k;
          HITS.forEach(function (q) { d[q] = (Number(d[q]) || 0) - sh.hit * k; });
        }
      } catch (e) {}
      return r;
    };
  }
  var clearDeb = function () {
    var p = P(); if (!p) return;
    [p].concat(p.allies || []).forEach(function (x) { if (!x || !x._g3Stk) return; x._g3Stk = 0; applyDeb(x); });
  };
  var drain = function (forced) {
    var dead = false;
    members().forEach(function (x) {
      if (dead) return;
      if (!forced && holdsAthena(x)) { ST.athenaSkip++; return; }
      var dmg = Math.max(1, Math.floor((x.mhp || 1) * CFG.shadow.drain)); ST.drainHits++;
      x._g3Stk = (x._g3Stk || 0) + 1; applyDeb(x);
      if (x === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); dead = true; } }
      else { x.curHp -= dmg; if (x.curHp <= 0) { x.curHp = 0; x._downed = true; x._reviveCd = 150; } }
    });
    return dead;
  };
  var DRAGONS = [['被侵蝕的時空安塔瑞斯', 'earth'], ['破滅的時空法利昂', 'water'], ['深淵的時空巴拉卡斯', 'fire'], ['災厄的時空林德拜爾', 'wind']];
  var dName = function (i) { return '時空四龍・' + DRAGONS[i][0].replace(/^.*的時空/, ''); };
  // 外觀：借四龍最終型態的動畫（名字不同，才不會掉四龍的寶）
  try {
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(get);
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(get);
    DRAGONS.forEach(function (d, i) {
      var src = d[0], dst = dName(i);
      if (typeof MOB_ANIM_ALIAS === 'undefined') return;
      MOB_ANIM_ALIAS[dst] = MOB_ANIM_ALIAS[src] || src;
      SETS.forEach(function (s) { if (s && s.has && s.has(src)) s.add(dst); });
      OBJS.forEach(function (o) { if (o && o[src] != null && o[dst] == null) o[dst] = o[src]; });
    });
  } catch (e) {}
  var spawnDragon = function (sh) {
    var base = DB.mobs.afk_final_apostle; if (!base) return false;
    for (var i = 0; i < mapState.mobs.length; i++) {
      var x = mapState.mobs[i]; if (x && !x._dead && x.curHp > 0) continue;
      var m = Object.assign(JSON.parse(JSON.stringify(base)), { curHp: base.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
      mapState.mobs[i] = m;
      try { applySherineBuff(i); } catch (e) {}
      m = mapState.mobs[i];
      var di = sh.n % 4, scale = S()._afkFinalScale || 1, tierK = (FB.tierK && FB.tierK()) || 1;
      m.n = dName(di); m.e = DRAGONS[di][1]; m._g3Dragon = true; m.boss = false;
      m.hp = m.curHp = Math.max(1, Math.round(((FB.cfg && FB.cfg.addHp) || 8000000) * scale * tierK * CFG.shadow.dragonHpK));
      m.exp = 0; m.goldMin = 0; m.goldMax = 0; m.noGold = true;
      sh.list.push(m); sh.n++;
      return true;
    }
    return false;
  };
  var dragonDead = function (m) { return !m || m._dead || !(m.curHp > 0) || mapState.mobs.indexOf(m) < 0; };
  var shadowStep = function (m) {
    if (!on('g3shadow')) return;
    var sh = F.sh || (F.sh = { i: 0, on: false, n: 0, list: [], killed: 0, floor: 0, rage: false, enterAt: 0 });
    var t = tk(), age = t - (m._fbBorn || t), pct = m.curHp / (m.hp || 1), at = CFG.shadow.at;
    if (!sh.on && sh.i < at.length && pct <= at[sh.i]) {
      sh.on = true; sh.floor = Math.max(m.curHp, Math.ceil(m.hp * at[sh.i])); m.curHp = sh.floor;
      sh.i++; sh.n = 0; sh.list = []; sh.killed = 0; sh.enterAt = t;
      ST.shadows.push({ at: Math.round(at[sh.i - 1] * 100), start: Math.round(age / 10), end: null, hpEnd: null });
      log(tag('幽影', '#a855f7') + '席琳沉進自己的影子裡，喚出被侵蝕的時空四龍——幽影中她不受任何傷害、慢慢回血，每秒吸走全隊 5% 生命（雅典娜之杖擋得住）。');
    }
    if (sh.on) {
      m.curHp = Math.max(m.curHp, sh.floor);
      sh.list.forEach(function (d) { if (!d._g3Counted && dragonDead(d)) { d._g3Counted = true; sh.killed++; ST.dragonsKilled++; } });
      var alive = sh.list.filter(function (d) { return !dragonDead(d); }).length;
      while (sh.n < CFG.shadow.dragons && alive < CFG.shadow.field && spawnDragon(sh)) alive++;
      // 目標：席琳隱沒在影子裡 → 換到時空四龍
      try { var cur = mapState.mobs[mapState.targetIdx]; if (!cur || cur === m || cur._dead) { var j = mapState.mobs.findIndex(function (d) { return d && d._g3Dragon && !dragonDead(d); }); if (j >= 0 && j !== mapState.targetIdx) mapState.targetIdx = j; } } catch (e) {}
      if ((t - sh.enterAt) % 10 === 0 && t > sh.enterAt) {
        m.curHp = Math.min(m.hp, m.curHp + Math.floor(m.hp * CFG.shadow.regen)); sh.floor = m.curHp;
        if (drain(false)) return;
      }
      if (sh.killed >= CFG.shadow.dragons) {
        sh.on = false; clearDeb();
        var rec = ST.shadows[ST.shadows.length - 1]; if (rec) { rec.end = Math.round(age / 10); rec.hpEnd = Math.round(m.curHp / m.hp * 1000) / 10; }
        log(tag('幽影', '#a855f7') + '時空四龍全數倒下，席琳被逼出了影子（HP ' + Math.round(m.curHp / m.hp * 100) + '%）。');
        try { if (typeof renderMobs === 'function' && !S().ff) renderMobs(); } catch (e) {}
      }
      return;
    }
    if (!sh.rage && sh.i >= at.length && pct <= CFG.shadow.rage) {
      sh.rage = true; sh.rageAt = t; ST.berserkAt = Math.round(age / 10);
      log(tag('狂暴', '#ef4444') + '席琳不再躲藏——每秒吸走全隊 5% 生命並削弱能力，直到戰鬥結束（雅典娜之杖也擋不住）。');
    }
    if (sh.rage && (t - sh.rageAt) % 10 === 0 && t > sh.rageAt) drain(true);
  };
  // 幽影中任何路徑打到 0 都不算倒下
  if (typeof W.killMob === 'function') {
    var oKM = W.killMob;
    W.killMob = function (idx) {
      try { var m = mapState.mobs && mapState.mobs[idx]; if (shadowOn(m)) { m.curHp = Math.max(1, F.sh.floor); m._dead = false; return; } } catch (e) {}
      return oKM.apply(this, arguments);
    };
  }

  // ── 四、龍之護甲 ──
  var A = { map: null, next: 0, until: 0 };
  var armorStep = function () {
    if (!(!!W.__afkG3Rift && on('goddess3'))) return;
    var t = tk();
    if (A.map !== mapState.current) { A.map = mapState.current; A.next = 0; A.until = 0; }
    var d = (mapState.mobs || []).filter(function (m) { return m && m._afkDragonStage && !m._dead && m.curHp > 0; })[0];
    if (!d) return;
    if (!A.next) A.next = t + CFG.armor.every * 10;   // 龍登場後第一次在 40 秒
    if (t >= A.next) {
      A.next = t + CFG.armor.every * 10; A.until = t + CFG.armor.sec * 10; ST.armorCasts++;
      log(tag('龍之護甲', '#fbbf24') + d.n + '的龍鱗硬化成護甲——' + CFG.armor.sec + ' 秒內每一下傷害 −' + CFG.armor.val + '。');
    }
  };

  // ── 主迴圈 ──
  var wasCtx = false;
  var step = function () {
    hookDamage();
    var st = stage(), dd = !st && dragonDungeon();
    if (!(st || dd)) { if (wasCtx) { clearDeb(); F.sh = null; wasCtx = false; } return; }
    wasCtx = true;
    restoreLog();
    if (st) {
      var m = bossOf();
      if (m && F.born !== m._fbBorn) newFight(m);
      if (st !== 'solo') execStep(st);
      if (m && st === 'r2a') shadowStep(m);
    }
    if (dd) armorStep();
  };
  var oTick = W.tick;
  W.tick = function () {
    var t0 = tk(), r = oTick.apply(this, arguments);
    if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-goddess3] tick', e); } }
    return r;
  };

  W.__afkGoddess3 = { cfg: CFG, stage: stage, stageName: function () { return STAGE_N[stage()] || ''; }, dragonDungeon: dragonDungeon, immOn: immOn, immTarget: immTarget,
    breakImm: breakImm, stats: ST, resetStats: resetStats, fight: F, armor: A, holdsAthena: holdsAthena, step: step };
  console.log('[AFK-goddess3] 已啟用：女神與四龍新機制');
})();
