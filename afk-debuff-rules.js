/* ============================================================================
 * afk-debuff-rules.js — 負面效果規則統一＋妖精「污濁之水」改版（玩家 2026-10-26 指定）
 *
 * 1. 所有負面效果都計算抗性：原本標了 force（跳過魔抗命中判定）的異常，也要先過「魔法命中 vs 魔防」判定，
 *    沒過就是「抵抗了」。固定機率型（pct）的照樣先擲機率，擲中後再判定抵抗。
 * 2. 頭目也會中：取消頭目對冰凍、暈眩、石化、沉睡、麻痺、束縛的免疫（BOSS_IMMUNE 清空），任何難度都一樣。
 *    鈍擊暈眩（afk-stun）也計算抗性，但頭目仍保留 50% 完全免疫（玩家 2026-10-26 二）。
 *    其他直接寫入怪物狀態的來源（武器毒、黑妖附加劇毒、月光碎裂、固定機率狀態技、寒流冰凍、寵物冰凍、召喚中毒、
 *    遺物系統的狀態與中毒）由核心補丁 48 與 afk-relic-runtime／afk-relicfx 一起改成計算抵抗。
 * 3. 污濁之水：
 *    ‧對畫面中全體敵人施放（不再限頭目），持續 15 秒；附帶的八種魔法系負面狀態（afk-rebirth-rules）也是 15 秒
 *    ‧每個目標各自判定抵抗
 *    ‧冷卻 30 秒（從施放成功起算），冷卻中不能再放；屬於攻擊技能——設成自動攻擊技能時，
 *      冷卻中會改放「三重矢」（沒學三重矢或沒拿弓就這一輪不放）
 * 4. 頭目的汙濁之水（玩家 2026-10-28）：頭目級怪物也會對玩家與傭兵施放汙濁之水（受到的治癒減半）。
 *    ‧頭目一般攻擊命中後 25% 機率施放，同一隻頭目 30 秒最多一次；必中
 *    ‧不會自己消失：要靠隊友（或自己）的魔法相消術解除；畫面上沒有存活的頭目時（打倒、離開）自動散去
 *    ‧經典模式不施放
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  // 玩家 2026-10-28：兩項改成外掛開關（預設開）
  if (T && T.register) {
    T.register({ id: 'debuffresist', name: '負面效果一律計算抵抗、頭目不免疫', desc: '所有對怪物的負面效果都先過「魔法命中 vs 魔防」判定；頭目也會被冰凍、暈眩、石化、沉睡、麻痺、束縛。關掉照原版（部分效果必中、頭目免疫）', group: '遊戲玩法' });
    T.register({ id: 'bossfoul', name: '頭目施放汙濁之水', desc: '頭目一般攻擊命中後 25% 對被打的人施放汙濁之水（治癒減半），要用魔法相消術解除，沒有存活頭目時散去', group: '遊戲玩法' });
  }
  var resistOn = !T || T.enabled('debuffresist'), foulOn = !T || T.enabled('bossfoul');
  W.__afkDebuffAllOff = !resistOn;   // 核心補丁 48／63：直接寫入狀態的來源看這個旗標
  var FOUL = 'sk_elf_muddywater', TRIPLE = 'sk_elf_triple', DUR = 15, CD = 300;   // CD 單位 tick（0.1 秒）
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };

  // ── 三重矢：在席琳夢域鏡（原席琳夢域鏡）中一次射出 10 箭，其他地方維持 3 箭；每箭各自判定命中與爆擊，仍只消耗 1 支箭（玩家 2026-10-27）──
  try {
    if (DB.skills[TRIPLE]) Object.defineProperty(DB.skills[TRIPLE], 'hits', { configurable: true, enumerable: true,
      get: function () { try { return (W.__afkDreamHell && W.__afkDreamHell.on()) ? 10 : 3; } catch (e) { return 3; } }, set: function () {} });
  } catch (e) {}

  // ── 傭兵會魔法相消術就自動施放（玩家 2026-10-28）：不必等來源角色勾「自動施放」；隊伍面板對這名傭兵明確關掉才不放 ──
  if (typeof W._mercAutoOn === 'function') {
    var oMAO = W._mercAutoOn;
    W._mercAutoOn = function (ally, sid) {
      if (sid === 'sk_cancel' && ally && !(ally._autoBuff && Object.prototype.hasOwnProperty.call(ally._autoBuff, sid) && !ally._autoBuff[sid])) return true;
      return oMAO.apply(this, arguments);
    };
  }

  // ── 2. 頭目不再免疫 ──
  try { if (resistOn && typeof BOSS_IMMUNE !== 'undefined' && Array.isArray(BOSS_IMMUNE)) BOSS_IMMUNE.length = 0; } catch (e) {}

  // ── 1. force 也要過抵抗判定 ──
  if (resistOn && typeof W.applyMobStatus === 'function') {
    var oApply = W.applyMobStatus;
    W.applyMobStatus = function (m, st, skillName) {
      if (m && st && st.force && typeof abnormalMagicHit === 'function') {
        if (st.pct != null && Math.random() * 100 >= st.pct) return;
        if (!abnormalMagicHit(m, undefined, st.hitOff)) {
          try { if (!S().ff) logCombat('<span class="' + getMobColor(m.lv) + '">' + m.n + '</span> 抵抗了' + (skillName || '異常狀態') + '。', 'miss'); } catch (e) {}
          return;
        }
        var st2 = {}; for (var k in st) st2[k] = st[k]; delete st2.pct;
        arguments[1] = st2;
      }
      return oApply.apply(this, arguments);
    };
  }
  // 抵抗判定（給外掛用）：actor 是傭兵時用傭兵自己的魔法命中
  W.__afkDebuffResist = function (m, actor) {
    if (!resistOn) return true;
    try {
      if (actor && typeof player !== 'undefined' && actor !== player && typeof allyAbnormalMagicHit === 'function' && actor._allyName) return allyAbnormalMagicHit(actor, m);
      return typeof abnormalMagicHit !== 'function' || abnormalMagicHit(m);
    } catch (e) { return true; }
  };

  // ── 3. 污濁之水 ──
  var sk = DB && DB.skills && DB.skills[FOUL];
  if (sk) {
    delete sk.bossOnly; sk.target = 'all';
    sk.status = { kind: 'muddywater', dur: DUR };
    sk.desc = '對畫面中全體敵人施放（各自判定抵抗），持續 15 秒：頭目 HP 自然恢復減半，並同時染上緩速、石化、損壞、疾病、弱化、目盲、魔抗減半、魔法封印；冷卻 30 秒，冷卻中自動攻擊改放三重矢';
  }
  var cdLeft = function (a) {
    var u = Number(a && a._afkFoulCdUntil) || 0, t = now();
    if (u - t > CD) { a._afkFoulCdUntil = 0; return 0; }   // 讀檔後 tick 重算，避免卡住
    return Math.max(0, u - t);
  };
  // 汙濁之水打破物理免疫（玩家 2026-10-30 03:05）：施放成功時，畫面上帶「物理免疫」的敵人（夢域地獄小怪出生 10 秒、巨大骷髏「恐怖的面貌」選到近／遠距離）全部解除
  var PHYS = { phys: 1, melee: 1, ranged: 1 };
  var breakPhys = function (who) {
    var n = 0, t = (typeof state !== 'undefined' && state) ? state.ticks : 0;
    try {
      (mapState.mobs || []).forEach(function (m) {
        var w = m && !m._dead && m.curHp > 0 && m._reflectWall;
        if (w && w.block && PHYS[w.kind] && t <= (w.until || 0)) { m._reflectWall = null; n++; }
      });
      if (n && typeof logCombat === 'function') logCombat('<span class="text-sky-300 font-bold">【污濁之水】</span>' + (who || '你') + '的污濁之水沖散了 ' + n + ' 隻敵人的物理免疫。', 'magic');
      if (n && typeof renderMobs === 'function') renderMobs();
    } catch (e) {}
    return n;
  };
  W.__afkFoulBreak = breakPhys;
  try { if (sk && sk.desc && sk.desc.indexOf('物理免疫') < 0) sk.desc += '施放時沖散畫面上敵人的物理免疫。'; } catch (e) {}
  W.__afkFoulCd = function (a) { return cdLeft(a || (typeof player !== 'undefined' ? player : null)); };
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      if (skId !== FOUL || typeof player === 'undefined' || !player) return oCast.apply(this, arguments);
      if (cdLeft(player) > 0) {
        var tri = DB.skills[TRIPLE];
        if (tri && (player.skills || []).indexOf(TRIPLE) >= 0) return oCast.call(this, TRIPLE);
        return false;
      }
      var r = oCast.apply(this, arguments);
      if (r) { player._afkFoulCdUntil = now() + CD; breakPhys('你'); }
      return r;
    };
  }
  if (typeof W.allyCastMagic === 'function') {
    var oAlly = W.allyCastMagic;
    W.allyCastMagic = function (ally, s) {
      var isFoul = s === FOUL || (s && DB.skills[FOUL] === s);
      if (!isFoul || !ally) return oAlly.apply(this, arguments);
      if (cdLeft(ally) > 0) return false;
      var r = oAlly.apply(this, arguments);
      if (r !== false) { ally._afkFoulCdUntil = now() + CD; breakPhys('協力·' + (ally._allyName || '傭兵')); }
      return r;
    };
  }
  // ── 4. 頭目的汙濁之水 ──
  var BF = { cd: 300, chance: 0.25, ticks: 36000 };   // 冷卻 30 秒（tick）；狀態 3600 秒＝等同不會自己消失
  var PL = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var bossAlive = function () { try { return (mapState.mobs || []).some(function (m) { return m && m.boss && !m._dead && m.curHp > 0; }); } catch (e) { return false; } };
  var stOf = function (t) { var p = PL(); return t === p ? p.statuses : (t.statuses || (t.statuses = {})); };
  var nameOf = function (t) { return t === PL() ? '你' : '協力·' + (t._allyName || '傭兵'); };
  var bossFoul = function (mob, t) {
    var p = PL(); if (!p || !mob || !mob.boss || mob._dead || !(mob.curHp > 0) || !t) return false;
    if (p.classicMode) return false;
    if (t === p ? p.dead : (t._downed || !(t.curHp > 0))) return false;
    var st = stOf(t); if (!st || (st.foulWater || 0) > 0) return false;
    var at = Number(mob._afkFoulAt); if (isFinite(at) && now() - at < BF.cd) return false;
    if (Math.random() >= BF.chance) return false;
    mob._afkFoulAt = now();
    if (W.AFK_RELIC_DEFENSE_BRIDGE && W.AFK_RELIC_DEFENSE_BRIDGE.setStatus) W.AFK_RELIC_DEFENSE_BRIDGE.setStatus(t, 'foulWater', BF.ticks, mob); else st.foulWater = BF.ticks;
    if (!((st.foulWater || 0) > 0)) return false;
    t._afkBossFoul = true;
    try { if (!S().ff && typeof logCombat === 'function') logCombat('<span class="' + (typeof getMobColor === 'function' ? getMobColor(mob.lv) : '') + '">' + mob.n + '</span> 施放汙濁之水，' + nameOf(t) + '陷入了<span class="font-bold" style="color:#67e8f9;">汙濁之水</span>！（受到的治癒效果減半，需要魔法相消術解除）', 'enemy'); } catch (e) {}
    return true;
  };
  var clearBossFoul = function () {
    var p = PL(); if (!p) return;
    [p].concat(p.allies || []).forEach(function (t) { if (!t || !t._afkBossFoul) return; var st = stOf(t); if (st) st.foulWater = 0; t._afkBossFoul = false; });
  };
  var sweep = function () {
    var p = PL(); if (!p) return;
    [p].concat(p.allies || []).forEach(function (t) { if (t && t._afkBossFoul && !((stOf(t) || {}).foulWater > 0)) t._afkBossFoul = false; });   // 被相消掉了
    if (!bossAlive()) clearBossFoul();
  };
  if (foulOn && typeof W.enemyPhysicalAttack === 'function') {
    var oEPA = W.enemyPhysicalAttack;
    W.enemyPhysicalAttack = function (mob) { var r = oEPA.apply(this, arguments); try { if (mob && mob.boss) bossFoul(mob, PL()); } catch (e) {} return r; };
  }
  if (foulOn && typeof W.enemyAttackAlly === 'function') {
    var oEAA = W.enemyAttackAlly;
    W.enemyAttackAlly = function (mob, ally) { var r = oEAA.apply(this, arguments); try { if (mob && mob.boss) bossFoul(mob, ally); } catch (e) {} return r; };
  }
  if (foulOn && typeof W.killMob === 'function') {
    var oKM = W.killMob;
    W.killMob = function () { var r = oKM.apply(this, arguments); try { var p = PL(); if (p && (p._afkBossFoul || (p.allies || []).some(function (a) { return a && a._afkBossFoul; }))) sweep(); } catch (e) {} return r; };
  }
  try { if (foulOn) setInterval(function () { try { sweep(); } catch (e) {} }, 2000); } catch (e) {}

  W.AFK_DEBUFF_RULES = { foulDur: DUR, foulCdTicks: CD, bossFoul: bossFoul, bossFoulSweep: sweep, bossFoulCfg: BF };
  console.log('[AFK-debuff-rules] 已啟用：負面效果一律計算抵抗、頭目不再免疫；污濁之水改全體 15 秒、冷卻 30 秒（冷卻中改三重矢）；頭目會對隊伍施放汙濁之水');
})();
