/* ============================================================================
 * afk-hidden.js — 隱藏條件（玩家 2026-10-29）
 *
 *   一、謀叛三人組：隊伍剛好三個人＝王子、男騎士、男法師（王族、騎士、法師各一，三人都是男性角色），
 *       在「謀叛者的低語」裡：對該副本造成的傷害 +50%、受到該副本的傷害 −50%。多一個人、少一個人或有女性角色都不算。
 *   二、王族之敵：男性的王族、騎士、法師，對傲慢之塔（含支配者傲慢之塔）的「反王肯恩」「賽尼斯(首領)」造成的傷害 +10%。
 *   三、騎士的負重（玩家 2026-10-29 21:07）：騎士（你或騎士傭兵）每 10 秒一次，物理攻擊的基礎傷害加上「負重上限 ×0.05」（加在卡片倍率等之前）。
 *   四、撼動（玩家 2026-10-30 20:43）：帶著亞丁禁衛軍（聖十字近衛／聖十字禁衛軍）進「謀叛者的低語」，禁衛軍沒有作用——不攻擊、不補血、不代扣傷害、不代死。
 *   五、不動怒威（同上）：謀叛者的低語裡的反王肯恩、魔女賽尼斯，HP 第一次掉到 50% 以下時發動：5 秒內造成的傷害 +50%、受到的傷害 −50%。
 *   六、觸發者（玩家 2026-10-31 02:50）：16 人隊伍（你＋15 名傭兵），八個職業各 2 人，而且 16 人的轉生技藝全部不同（＝16 門技藝都到齊）
 *       → 觸發者光環，只在一般區域（副本、時空裂痕、暗夢星迴、攀登、最終決戰不算）：全隊造成的傷害 +30%、受到的傷害 −30%；
 *       對手是王（打王、被王打）時改成 +10%／−10%。2026-10-31 12:53：席琳夢域鏡裡全部區域都算（副本、裂痕、暗夢星迴、攀登、最終決戰）。
 *   七、戰士的臂力（玩家 2026-10-31 04:05）：轉生後的戰士，雙手武器當單手用（可以和盾牌一起裝），也可以裝盾牌。
 *       可用的武器種類照原本戰士的規則（鈍器、開放清單），只是不再算雙手；經典模式不套用。
 *       （轉生角色本來就不限職業，所以武器種類、盾牌其實全部都能用。）
 *   八、轉生者的單手（玩家 2026-10-31 12:53，跟七合併）：所有職業轉生後，雙手武器（含弓、遺物雙手武器）都當單手用，可以另外裝盾牌或副手；經典模式不套用。
 *   九、暗影雙刃（玩家 2026-11-01 18:23）：轉生後的黑暗妖精可以雙持匕首——主手是匕首時，再裝一把匕首會放到副手，
 *       副手有自己的攻擊節奏（跟戰士迅猛雙斧的副手同一套：獨立命中、獨立計時）。只限匕首（副手不能放別的）；傭兵一樣；經典模式不套用。
 *   十、法術的副目標與連發（玩家 2026-11-01 22:22）：範圍魔法（有 3 秒冷卻的那些）冷卻改 3.5 秒（afk-balance1101 問這裡）；
 *       同一發打到的怪：主目標（目前鎖定的目標，沒鎖定就第一隻）照算，其他目標傷害 ×0.8 而且不會爆擊。
 *       迴響精通的連發、魔法精通（王族）的追加施放不會爆擊——除非施法者同時裝了符文「雷」和「裂」。玩家與傭兵一樣；經典模式不套用。
 *       （核心補丁 81 在每個目標算傷害時呼叫 __afkSpellRoll。）
 *   十一、雅典娜之杖（玩家 2026-11-01 22:22）：身上（背包或裝備）帶著雅典娜之杖（ttmi_5413）去打一轉女神（初次輪迴）：
 *       女神受到的傷害 +15%；女神與使徒打你、傭兵、警衛、寵物、召喚物的傷害 −30%。
 *   十二、夢域鏡的隊伍人數不加掉寶（afk-fix1102 問 hiddenbonus）。
 *   十三、幻術士的攻擊魔法（sk_illu_ 開頭的攻擊技能：幻想、混亂、恐慌、粉碎能量…）傷害 −30%（玩家 2026-11-02 02:56；玩家與傭兵；走 __afkSpellRoll）。
 *   十四、妖精的連射也會觸發幻影箭，但連射觸發的幻影箭傷害 −50%（afk-mech1031 問 __afkRapidPhantom）。
 *   十五、殷海薩眷屬：你每次一般攻擊，出戰的寵物、召喚物（含屬性精靈）也追加攻擊一次，5 秒冷卻。
 *   都不寫在任何說明裡（小百科只寫「有隱藏條件」）。
 *   開關：隱藏規則全部合併成一個開關 hiddenbonus「隱藏規則」（玩家 2026-10-30：以後新的隱藏規則也放進來；命運 afk-fate 也看這個開關）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'hiddenbonus', name: '隱藏規則', group: '隱藏規則',
    desc: '隊伍的組成、職業與性別、帶進副本的部隊……都可能左右戰局（內容不公開）。' });
  if (T && !T.enabled('hiddenbonus')) return;
  var KNIGHT_LOAD = 0.05, KNIGHT_CD = 100;
  var TRAITOR_MAP = 'afk_traitor_whisper', TRIO = ['royal', 'knight', 'mage'], FOES = { '反王肯恩': 1, '賽尼斯(首領)': 1 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var male = function (a) { var v = String(a && a.avatar || ''); return v === '王子' || v.charAt(0) === '男'; };
  var trio = function () {
    var p = P(); if (!p) return false;
    var party = [p].concat(p.allies || []).filter(Boolean);
    if (party.length !== 3 || !party.every(male)) return false;
    var cls = party.map(function (a) { return a.cls; }).sort();
    return cls.join(',') === TRIO.slice().sort().join(',');
  };
  var inTraitor = function () { return typeof mapState !== 'undefined' && mapState && mapState.current === TRAITOR_MAP; };
  var isMember = function (a) { var p = P(); return !!(p && a && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var kingFoe = function (actor, target) {
    if (!actor || !target || !FOES[target.n] || !male(actor) || TRIO.indexOf(actor.cls) < 0) return false;
    var m = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
    return m.indexOf('pride') === 0 || !!(typeof state !== 'undefined' && state && state.prideClimb);
  };
  var hooked = false;   // 只包一次（之後別的外掛再包 C.damage，外層就沒有旗標了）
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function' || C.damage.__afkHidden) return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      try {   // 騎士的負重：每 10 秒一次，基礎傷害 + 負重上限×0.05
        var kd = opt && opt.kind;
        if (amount > 0 && actor && actor.cls === 'knight' && isMember(actor) && (kd === 'melee' || kd === 'ranged')) {
          var t = (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0;
          if (!W.__afkTestNoKnightLoad && t >= (Number(actor._afkLoadAt) || 0)) {
            var cap = Number(actor.d && actor.d.weightCapacity) || 0, add = Math.floor(cap * KNIGHT_LOAD);
            if (add > 0) { actor._afkLoadAt = t + KNIGHT_CD; arguments[2] = amount + add; }
          }
        }
      } catch (e) {}
      var v = o.apply(this, arguments);
      try {
        if (v > 0 && isMember(actor)) {
          if (inTraitor() && trio()) v = Math.floor(v * 1.5);
          if (kingFoe(actor, target)) v = Math.floor(v * 1.1);
        }
        if (v > 0 && wrath(target)) v = Math.floor(v * 0.5);   // 不動怒威：受到的傷害 −50%
      } catch (e) {}
      return v;
    };
    C.damage.__afkHidden = true;
  };
  hook(); W.addEventListener('load', hook);
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (mob && isMember(ent) && inTraitor() && trio()) ? 0.5 : 1; });
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return wrath(mob) ? 1.5 : 1; });   // 不動怒威：造成的傷害 +50%

  // ── 撼動：謀叛者的低語裡亞丁禁衛軍沒有作用（afk-castle-guards 問這個）──
  W.__afkGuardShaken = function (g) { return !!(g && g.city === 'aden_elite' && inTraitor()); };
  // ── 不動怒威 ──
  var WRATH = { '反王肯恩(謀叛)': 1, '魔女賽尼斯(謀叛)': 1 }, WRATH_T = 50;
  var tk = function () { return (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0; };
  function wrath(m) { return !!(m && m._afkWrathUntil && tk() <= m._afkWrathUntil); }
  var shakeLog = false;
  var step = function () {
    if (!inTraitor()) { shakeLog = false; return; }
    var p = P(); if (!p) return;
    if (!shakeLog && (p.guardsV2 || []).some(function (g) { return g && g.city === 'aden_elite'; })) {
      shakeLog = true;
      try { if (typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#94a3b8">【撼動】</span>亞丁禁衛軍望著謀叛者的旗幟，遲遲沒有舉起武器……', 'magic'); } catch (e) {}
    }
    (mapState.mobs || []).forEach(function (m) {
      if (!m || m._dead || !WRATH[m.n] || m._afkWrathDone || !(m.curHp > 0) || m.curHp > (m.hp || 0) * 0.5) return;
      m._afkWrathDone = true; m._afkWrathUntil = tk() + WRATH_T;
      try { if (typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#f97316">【不動怒威】</span>' + m.n + ' 的怒氣化成了鎧甲——5 秒內造成的傷害 +50%、受到的傷害 −50%！', 'enemy'); } catch (e) {}
    });
  };
  // ── 觸發者 ──
  var TRIG = { n: 16, perCls: 2, k: 0.30, bossK: 0.10 }, CLS8 = ['royal', 'knight', 'elf', 'mage', 'dark', 'dragon', 'illusion', 'warrior'];
  var DG_PLUGIN = { afk_traitor_whisper: 1, afk_hardin_time: 1, afk_giltas_altar: 1, afk_flame_depth: 1, afk_halpas_nest: 1, afk_final_sea: 1 };
  var trigT = -1, trigOk = false;
  var artOf = function (a) { var A = W.__afkArts && W.__afkArts.ARTS, id = a && a.rebirth > 0 && a.rebirthArt; return (id && A && A[id] && A[id].cls === a.cls) ? id : null; };
  var trigger = function () {
    var t = tk(); if (t === trigT) return trigOk;
    trigT = t; trigOk = false;
    var p = P(); if (!p) return false;
    var party = [p].concat(p.allies || []).filter(Boolean);
    if (party.length !== TRIG.n) return false;
    var cnt = {}, arts = {};
    for (var i = 0; i < party.length; i++) {
      var a = party[i], c = a.cls, art = artOf(a);
      if (CLS8.indexOf(c) < 0 || !art || arts[art]) return false;
      cnt[c] = (cnt[c] || 0) + 1; arts[art] = 1;
    }
    trigOk = CLS8.every(function (c) { return cnt[c] === TRIG.perCls; });
    return trigOk;
  };
  var dreamWorld = function () { var p = P(); return !!(p && !p.classicMode && p.sherineDream && p.sherineMad); };
  var normalArea = function () {
    var key = (typeof mapState !== 'undefined' && mapState && mapState.current) || '';
    if (!key || /^town_/.test(key)) return false;
    if (dreamWorld()) return true;   // 2026-10-31 12:53：席琳夢域鏡裡全部區域都算（副本、時空裂痕、暗夢星迴、攀登、最終決戰）
    if (DG_PLUGIN[key]) return false;
    try { var C = W.AFK_CARD_COMBAT; if (C && C.inDungeon && C.inDungeon()) return false; } catch (e) {}
    try { if (state.riftRun || state.dreamStar || state.prideClimb) return false; } catch (e) {}
    return true;
  };
  var trigK = function (foe) { if (T && !T.enabled('hiddenbonus')) return 0; return (trigger() && normalArea()) ? (foe && foe.boss ? TRIG.bossK : TRIG.k) : 0; };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { var k = isMember(ent) ? trigK(mob) : 0; return k ? 1 - k : 1; });
  var hookTrig = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkTrig) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && isMember(actor) && !(opt && opt.kind === 'dot')) { var k = trigK(target); if (k) v = Math.floor(v * (1 + k)); } } catch (e) {}
      return v;
    };
    C.damage.__afkTrig = true;
  };
  hookTrig();
  var trigLog = null;
  var trigStep = function () {
    var key = (typeof mapState !== 'undefined' && mapState && mapState.current) || '', on2 = trigger() && normalArea();
    if (on2 && trigLog !== key) {
      trigLog = key;
      try { if (typeof logCombat === 'function' && !state.ff) logCombat('<span class="font-bold" style="color:#e879f9">【觸發者】</span>十六門技藝在隊伍裡共鳴，光環展開。', 'magic'); } catch (e) {}
    } else if (!on2) trigLog = null;
  };

  // ── 戰士的臂力 ──
  var mightyWarrior = function () { var p = P(); return !!(p && p.cls === 'warrior' && p.rebirth > 0 && !p.classicMode); };
  // 八、轉生者的單手（2026-10-31 12:53）：所有轉生角色的雙手武器（含弓）都當單手用，可以另外裝盾牌或副手。
  var rebornOneHand = function () { var p = P(); return !!(p && p.rebirth > 0 && !p.classicMode && (!T || T.enabled('hiddenbonus'))); };
  if (typeof W.effTwoHanded === 'function') {
    var oTwo = W.effTwoHanded;
    W.effTwoHanded = function (d, id) { if (rebornOneHand() && d && d.type === 'wpn' && !d.isArrow) return false; return oTwo.apply(this, arguments); };
    try { effTwoHanded = W.effTwoHanded; } catch (e) {}
  }
  if (typeof W.warriorEquipOk === 'function') {
    var oWar = W.warriorEquipOk;
    W.warriorEquipOk = function (d, id) {
      if (oWar.apply(this, arguments)) return true;
      return !!(mightyWarrior() && d && d.type === 'arm' && d.slot === 'shield' && !d.reqAvatar);
    };
    try { warriorEquipOk = W.warriorEquipOk; } catch (e) {}
  }

  // ── 九、暗影雙刃：轉生黑暗妖精雙持匕首 ──
  var isDagger = function (id) { try { return !!id && getWeaponTags(id).indexOf('匕首') >= 0; } catch (e) { return false; } };
  var darkDual = function (a) { return !!(a && a.cls === 'dark' && a.rebirth > 0 && !a.classicMode && (!T || T.enabled('hiddenbonus'))); };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function') return; var o = W[name]; W[name] = mk(o); try { (0, eval)(name + ' = window.' + name); } catch (e) {} };
  wrapG('warriorDualWieldWpnOk', function (o) { return function (id) { var p = P(); if (p && p.cls === 'dark') return darkDual(p) && isDagger(id) && !(DB.items[id] && DB.items[id].relicMandatoryTwoHand); return o.apply(this, arguments); }; });
  wrapG('dualWieldOffhandOk', function (o) { return function () { var p = P(); if (p && p.cls === 'dark') return !!(darkDual(p) && p.eq && p.eq.wpn && isDagger(p.eq.wpn.id)); return o.apply(this, arguments); }; });
  wrapG('allyWarriorDualWieldWpnOk', function (o) { return function (a, id) { if (a && a.cls === 'dark') return darkDual(a) && isDagger(id) && !(DB.items[id] && DB.items[id].relicMandatoryTwoHand); return o.apply(this, arguments); }; });
  wrapG('allyDualWieldOffhandOk', function (o) { return function (a) { if (a && a.cls === 'dark') return !!(darkDual(a) && a.eq && a.eq.wpn && isDagger(a.eq.wpn.id)); return o.apply(this, arguments); }; });
  // 戰鬥紀錄：黑暗妖精的副手追擊不叫「迅猛雙斧」（呼叫期間暫時換掉 logCombat，結束換回）
  ['dualWieldOffhandAttack', 'allyDualWieldOffhandAttack'].forEach(function (fn, i) {
    wrapG(fn, function (o) { return function () {
      var a = i ? arguments[0] : P(); if (!(a && a.cls === 'dark') || typeof W.logCombat !== 'function') return o.apply(this, arguments);
      var oL = W.logCombat, sw = function (msg) { if (typeof msg === 'string') arguments[0] = msg.replace(/迅猛雙斧/g, '暗影雙刃'); return oL.apply(this, arguments); };
      W.logCombat = sw; try { (0, eval)('logCombat = window.logCombat'); } catch (e) {}
      try { return o.apply(this, arguments); } finally { if (W.logCombat === sw) { W.logCombat = oL; try { (0, eval)('logCombat = window.logCombat'); } catch (e) {} } }
    }; });
  });

  // ── 十、法術的副目標與連發 ──
  var hOn = function (a) { var p = P(); return !!(a && !a.classicMode && !(p && p.classicMode) && (!T || T.enabled('hiddenbonus'))); };
  var EV = function (x) { try { return (0, eval)(x); } catch (e) { return undefined; } };
  var SPLASH = 0.8, AOE_CD_HIDDEN = 35;
  var isAoeSk = function (sk) { var b = W.__afkBalance1101; return b && b.isAoe ? b.isAoe(sk) : !!(sk && sk.type === 'atk' && sk.dmgType === 'magic' && sk.target === 'all'); };
  var freeCast = function (a, ally) {
    if (ally) return !!(a._echoing || EV('typeof _allyRoyalFreeCast !== "undefined" && _allyRoyalFreeCast'));
    return !!(EV('typeof _echoFree !== "undefined" && _echoFree') || EV('typeof _royalFreeCast !== "undefined" && _royalFreeCast'));
  };
  var runeCrit = function (a) { var R = W.__afkRuneFx; try { return !!(R && R.N(a, '雷') > 0 && R.N(a, '裂') > 0); } catch (e) { return false; } };
  var ILLU_CUT = 0.7, illuSet = null;
  var illuSk = function (sk) { if (!illuSet) { illuSet = new Set(); Object.keys(DB.skills).forEach(function (k) { var x = DB.skills[k]; if (/^sk_illu_/.test(k) && x && x.type === 'atk' && (x.dmgDice || x.multiDmg)) illuSet.add(x); }); } return illuSet.has(sk); };
  W.__afkSpellRoll = function (a, t, sk, targets, ally) {
    if (!hOn(a) || !t || !sk) return null;
    var r = { mult: 1, noCrit: false };
    if (isAoeSk(sk) && targets && targets.length > 1) {
      var main = null; try { main = getTarget(); } catch (e) {}
      if (!main || targets.indexOf(main) < 0) main = targets[0];
      if (t !== main) { r.mult = SPLASH; r.noCrit = true; }
    }
    if (!r.noCrit && freeCast(a, ally) && !runeCrit(a)) r.noCrit = true;
    if (illuSk(sk)) r.mult *= ILLU_CUT;   // 十三
    return r;
  };
  // 範圍魔法冷卻長度（afk-balance1101、afk-hotbar 問這裡）：規則開著 3.5 秒，沒開回傳 0＝照原本
  W.__afkHiddenAoeCd = function (sk, a) { return (hOn(a || P()) && isAoeSk(sk)) ? AOE_CD_HIDDEN : 0; };

  // ── 十一、雅典娜之杖 ──
  var ATHENA = 'ttmi_5413', ATH_DEALT = 1.15, ATH_TAKEN = 0.7;
  var carryAthena = function () {
    var p = P(); if (!p) return false;
    if ((p.inv || []).some(function (i) { return i && i.id === ATHENA; })) return true;
    var eq = p.eq || {}; for (var k in eq) { var e = eq[k]; if (e && e.id === ATHENA) return true; }
    return false;
  };
  var noviceFight = function () { var s = (typeof state !== 'undefined' && state) || {}; return !!(s._afkFinal && s._afkFinalNovice && (s._afkFinalMode || 'first') === 'first'); };
  var athOn = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('hiddenbonus')) && noviceFight() && carryAthena()); };
  var goddess = function (m) { return !!(m && m._afkFinal); };
  var godSide = function (m) { return !!(m && (m._afkFinal || m._afkApostle)); };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (godSide(mob) && isMember(ent) && athOn()) ? ATH_TAKEN : 1; });
  // 女神的百分比招式（潮汐之嘆…）走 __afkIncomingMod
  var prevIn = W.__afkIncomingMod;
  W.__afkIncomingMod = function (t, dmg) {
    var v = typeof prevIn === 'function' ? prevIn.apply(this, arguments) : dmg;
    try { if (isMember(t) && athOn()) v = v * ATH_TAKEN; } catch (e) {}
    return v;
  };
  var athHooked = { card: false, comp: false, rt: false };
  var athHook = function () {
    var C = W.AFK_CARD_COMBAT;
    if (!athHooked.card && C && typeof C.damage === 'function' && !C.damage.__afkAthena) {
      athHooked.card = true; var oD = C.damage;
      C.damage = function (actor, target) { var v = oD.apply(this, arguments); try { if (v > 0 && goddess(target) && athOn()) v = Math.floor(v * ATH_DEALT); } catch (e) {} return v; };
      C.damage.__afkAthena = true;
    }
    var R = W.AFK_RELIC_RUNTIME;
    if (!athHooked.rt && R && typeof R.companionDamage === 'function' && !R.companionDamage.__afkAthena) {
      athHooked.rt = true; var oCD = R.companionDamage;
      R.companionDamage = function (owner, ent, target) { var v = oCD.apply(this, arguments); try { if (v > 0 && goddess(target) && athOn()) v = Math.floor(v * ATH_DEALT); } catch (e) {} return v; };
      R.companionDamage.__afkAthena = true;
    }
    var M = W.AFK_RELIC_COMPANIONS;   // 寵物、召喚物受到的傷害
    if (!athHooked.comp && M && typeof M.incoming === 'function' && !M.incoming.__afkAthena) {
      athHooked.comp = true; var oIn = M.incoming;
      M.incoming = function (e, amount, enemy) { var v = oIn.apply(this, arguments); try { if (v > 0 && godSide(enemy) && athOn()) v = Math.max(1, Math.floor(v * ATH_TAKEN)); } catch (x) {} return v; };
      M.incoming.__afkAthena = true;
    }
  };
  athHook(); W.addEventListener('load', athHook);
  // 警衛沒有受傷掛點：打完把多扣的 30% 退回（倒下的那一下照算）
  ['enemyAttackGuard', 'applyMobMagicToGuard'].forEach(function (fn) {
    wrapG(fn, function (o) { return function (mob) {
      var g = arguments[arguments.length - 1];
      if (!godSide(mob) || !g || !athOn()) return o.apply(this, arguments);
      var before = Number(g.hp) || 0, r = o.apply(this, arguments);
      try { var lost = before - (Number(g.hp) || 0); if (lost > 0 && !g._downed && g.hp > 0) g.hp += Math.floor(lost * (1 - ATH_TAKEN)); } catch (e) {}
      return r;
    }; });
  });

  // ── 十四、連射觸發的幻影箭 −50% ──
  var rapidDepth = 0;
  W.__afkRapidPhantom = function () { return rapidDepth > 0 && (!T || T.enabled('hiddenbonus')) ? 0.5 : 1; };
  ['rapidfireProc', 'allyRapidfire'].forEach(function (fn) { wrapG(fn, function (o) { return function () { rapidDepth++; try { return o.apply(this, arguments); } finally { rapidDepth--; } }; }); });

  // ── 十五、殷海薩眷屬：一般攻擊帶寵物、召喚物追擊 ──
  var EIN_CD = 50, einAt = -1e9;
  var einOn = function (p) { return !!(p && p.rebirth > 0 && p.rebirthArt === 'e_einhasad' && p.cls === 'elf' && !p.classicMode && (!T || T.enabled('hiddenbonus'))); };
  var einFollow = function () {
    var p = P(); if (!einOn(p) || tk() - einAt < EIN_CD) return 0;
    var n = 0;
    try { if (typeof petsOutList === 'function') petsOutList().forEach(function (pt) { if (!pt || pt._downed) return; var d = petDerive(pt), t = _petPickTarget(pt); if (d && t) { petAttackOnce(pt, d, t); n++; } }); } catch (e) {}
    try { if (typeof summonV2List === 'function') summonV2List().forEach(function (s) { if (!s || s._downed || !(s.hp > 0)) return; var t = typeof _petPickTarget === 'function' ? _petPickTarget(s) : getTarget(); if (!t) return; if (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2') spiritAttackOnce(s, t); else summonV2AttackOnce(s, _sumDeriveAny(s), t); n++; }); } catch (e) {}
    if (n) einAt = tk();
    return n;
  };
  wrapG('playerAttack', function (o) { return function () { var r = o.apply(this, arguments); try { einFollow(); } catch (e) {} return r; }; });

  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) {} try { trigStep(); } catch (e) {} } return r; };
  }
  W.__afkHidden = { mightyWarrior: mightyWarrior, rebornOneHand: rebornOneHand, dreamWorld: dreamWorld, trigger: trigger, normalArea: normalArea, trigK: trigK, TRIG: TRIG, trio: trio, male: male, kingFoe: kingFoe, darkDual: darkDual, carryAthena: carryAthena, illuSk: illuSk, ILLU_CUT: ILLU_CUT, einFollow: einFollow, EIN_CD: EIN_CD, athOn: athOn, ATHENA: ATHENA, ATH_DEALT: ATH_DEALT, ATH_TAKEN: ATH_TAKEN, SPLASH: SPLASH, AOE_CD_HIDDEN: AOE_CD_HIDDEN, runeCrit: runeCrit, KNIGHT_LOAD: KNIGHT_LOAD, KNIGHT_CD: KNIGHT_CD, wrath: wrath, step: step, WRATH: WRATH };
})();
