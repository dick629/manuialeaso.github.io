/* ============================================================================
 * afk-skillup.js — 技能強化（玩家 2026-11-06 18:22 選 B 方案、18:33 同意開工；設計稿 docs/skill-upgrade-design.md B 方案第二版）
 *   外掛開關 skillup（預設開；經典模式沒有）。狀態：測試版，Ping 試玩確認後才上線。
 *
 *   NPC：席琳神殿「技藝導師 薇爾娜」。每個角色各自升級（player.afkSkillUp＝0～3），照順序、必定成功：
 *     一：席琳結晶 100,000          → 全部職業技能 +5%，招牌技能第一段
 *     二：夢艷結晶 100,000          → 再 +5%（累計 +10%），招牌技能第二段
 *     三：轉生用時空材料六種各 1,000 → 再 +10%（累計 +20%），招牌技能第三段
 *   傭兵：吃「他自己的」階段。傭兵是招募當下的快照，所以來源角色升級後要重新招募才生效（Ping 18:33）。
 *
 *   這一版做到的（其餘見 SIG_TODO，下一批做）：
 *     ‧+%：施放職業技能當下造成的傷害（玩家 castSkill、傭兵各種施技函式）、立方與冰雪颶風這類持續技能的每一跳、治療技能的回復量。
 *     ‧招牌技能：施放當下讀技能資料的那些數值（發數、骰數、持續、HP／MP 消耗、追加傷害、箭數、刀數），
 *       施放那一下暫時把 DB.skills 換成「施放者自己的階段」的數值，放完立刻還原（玩家、傭兵各算各的）。
 *     ‧面板：增幅防禦的傷害減免、鏡像的迴避（recomputeStats 之後補差額；傭兵重算時 player 會暫時換成傭兵，所以同一套）。
 *     ‧隱藏規則連動（都不寫進任何說明）：
 *         幻術士做過技能強化（≥ 一）→ 取消隱藏規則十三的攻擊魔法 −30%；
 *         流星雨二：副目標 ×0.8 → ×1.0；流星雨三：範圍冷卻 3.5 → 2 秒；
 *         呼喚盟友一：冷卻 3 → 2.5 秒。
 *   HP 消耗「降到 0」一律做成 1：龍血 5 件的「HP 消耗技傷害 +20%」看 sk.hpCost 有沒有值，0 會把這個加成弄掉。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'skillup', name: '技能強化', group: '遊戲內容',
    desc: '席琳神殿「技藝導師 薇爾娜」：用席琳結晶、夢艷結晶、轉生用時空材料強化職業技能（三個階段）' });
  if (T && !T.enabled('skillup')) return;
  if (typeof DB === 'undefined' || !DB.skills) { console.warn('[AFK-skillup] 找不到 DB.skills，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var sys = function (h) { try { logSys(h); } catch (e) {} };

  // ── 階段 ──
  var PCT = [0, 0.05, 0.10, 0.20];
  var stageOf = function (a) {
    if (!a || a.classicMode) return 0;
    var me = P(); if (me && me.classicMode) return 0;
    var s = Math.floor(Number(a.afkSkillUp) || 0);
    return Math.max(0, Math.min(3, s));
  };
  var pctOf = function (a) { return PCT[stageOf(a)] || 0; };

  // ── 費用 ──
  var SHER = 'sherine_crystal', DREAM = 'afk_dream_crystal';
  var TS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var COST = [null, [[SHER, 100000]], [[DREAM, 100000]], TS.map(function (id) { return [id, 1000]; })];
  var nameOf = function (id) { try { return (DB.items[id] && DB.items[id].n) || id; } catch (e) { return id; } };
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, it) { return s + (it && it.id === id && !it.lock ? Math.max(1, Number(it.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (count(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var pullWh = function (list) {   // 倉庫裡的材料先搬到背包
    try { var MW = W.__afkMatWh; if (MW && MW.on && MW.on()) list.forEach(function (x) { var lack = x[1] - count(x[0]); if (lack > 0) { try { MW.pull(x[0], lack); } catch (e) {} } }); } catch (e) {}
  };
  var lacks = function (st) { return (COST[st] || []).filter(function (x) { return count(x[0]) < x[1]; }).map(function (x) { return nameOf(x[0]) + '還差 ' + (x[1] - count(x[0])).toLocaleString(); }); };
  var upgrade = function () {
    var p = P(); if (!p || p.classicMode) return false;
    var st = stageOf(p) + 1; if (st > 3) return false;
    pullWh(COST[st]);
    var miss = lacks(st);
    if (miss.length) { sys('<span class="text-amber-300">技能強化第' + '一二三'.charAt(st - 1) + '階段：' + miss.join('；') + '。</span>'); return false; }
    COST[st].forEach(function (x) { take(x[0], x[1]); });
    p.afkSkillUp = st;
    sys('<span class="font-bold" style="color:#fde68a">📖 薇爾娜替你重新磨亮了技藝——技能強化第' + '一二三'.charAt(st - 1) + '階段完成。</span>');
    try { calcStats(); } catch (e) {}
    try { saveGame(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    return true;
  };

  // ── 招牌技能（施放當下讀的數值）──
  //   每一筆：{ 階段: function (sk) → 要暫時換上的欄位 }；階段越高，前面階段的也一起套。
  var rep = function (arr, n) { var out = []; for (var i = 0; i < n; i++) out.push((arr[i % arr.length] || arr[0]).slice()); return out; };
  var SIG = {
    // 騎士
    sk_shock_stun:      { 1: function (sk) { return { skillAddDmg: (sk.skillAddDmg || 0) + 300 }; } },       // +500 真實 → +800
    sk_counter_barrier: { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; } },                        // 64 → 128
    // 法師
    sk_meteor:          { 1: function (sk) { return { multiDmg: rep(sk.multiDmg || [[2, 9]], 15) }; },        // 12 → 15 發
                          3: function (sk) { return { mp: 45 }; } },                                          // MP 60 → 45
    sk_blizzard_storm:  { 1: function (sk) { return { dur: Math.round((sk.dur || 32) * 1.5) }; } },          // 32 → 48
    // 妖精
    sk_elf_triple:      { 1: function (sk) { var dream = false; try { dream = !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) {} return { hits: (sk.hits || 3) + (dream ? 2 : 1) }; } },   // 3 → 4 箭（夢域鏡 10 → 12）
    sk_elf_preciseshot: { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; } },                        // 64 → 128
    // 龍騎士
    sk_dragon_slaughter:      { 2: function (sk) { return { hits: (sk.hits || 3) + 1 }; },                    // 3 → 4 刀
                                3: function () { return { hpCost: 1 }; } },                                   // 16 → 1
    sk_dragon_deathlightning: { 1: function (sk) { var d = (sk.multiDmg && sk.multiDmg[0]) || [8, 8]; return { multiDmg: [[d[0] + 3, d[1]]] }; },   // 8 顆骰 → 11 顆
                                2: function () { return { hpCost: 20 }; } },                                  // 35 → 20
    sk_dragon_bloodlust:      { 2: function (sk) { return { dur: (sk.dur || 300) * 2 }; },                    // 300 → 600
                                3: function () { return { hpCost: 1 }; } },                                   // 30 → 1
    // 幻術士
    sk_illu_pain:       { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; },                          // 64 → 128
                          2: function () { return { hpCost: 1 }; } },                                         // 40 → 1
    sk_illu_cube_burn:    { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },        // 20 → 30
    sk_illu_cube_quake:   { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    sk_illu_cube_shock:   { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    sk_illu_cube_harmony: { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    // 王族
    sk_royal_precise:   { 1: function (sk) { return { dur: (sk.dur || 16) * 2 }; } }                         // 16 → 32
  };
  // 這一版還沒做、要改戰鬥內部算法的（下一批）：
  var SIG_TODO = ['衝擊之暈：暈眩率上限 70%、暈眩 8 秒、暈住頭目全隊傷害 +10%', '反擊屏障：×2.5、必定爆擊', '增幅防禦三：HP<30% 減免 ×2',
    '流星雨二以外的範圍冷卻細節', '冰雪颶風：每 3 秒一次、冰凍命中、凍住受傷 +15%', '魔法屏障三段', '三重矢：夢域鏡 12 箭與遞減、最後一箭必爆', '精準射擊：爆擊率、無視硬皮',
    '召喚強力屬性精靈三段', '會心一擊三段', '雙重破壞三段', '暗隱術三段', '屠宰者：每層 +15', '奪命之雷三：王的易傷', '血之渴望：攻速 +20%',
    '疼痛的歡愉三：反彈 +30%', '鏡像：反擊、擋攻擊', '立方：間隔 −1 秒、同時兩種', '粉碎、狂暴、泰坦三段', '呼喚盟友：×1.3、寵物／召喚物／護衛也補一下',
    '精準目標：等級÷8、對頭目 ×1.5', '勇猛意志三段', '增益數值與異常機率的全域 +%'];

  var patchFor = function (actor, sk) {
    var id = sk && sk._afkSuId; if (!id || !SIG[id]) return null;
    var st = stageOf(actor); if (!st) return null;
    var out = null;
    for (var s = 1; s <= st; s++) { var f = SIG[id][s]; if (f) { var o = f(sk); out = Object.assign(out || {}, o); } }
    return out;
  };
  Object.keys(SIG).forEach(function (id) { if (DB.skills[id]) { try { Object.defineProperty(DB.skills[id], '_afkSuId', { value: id, enumerable: false }); } catch (e) {} } });

  // ── 施放情境：誰在放哪一招 ──
  var stack = [];
  var cur = function () { return stack.length ? stack[stack.length - 1] : null; };
  // 暫時換欄位：有的欄位是別的外掛裝的 getter（例：三重矢的 hits），所以存「描述子」、換成一般欄位、用完把描述子裝回去
  var applyPatch = function (sk, patch) {
    var saved = [];
    Object.keys(patch).forEach(function (k) {
      var d = Object.getOwnPropertyDescriptor(sk, k);
      try { Object.defineProperty(sk, k, { value: patch[k], writable: true, configurable: true, enumerable: d ? d.enumerable : true }); saved.push([k, d]); } catch (e) {}
    });
    return function () {
      for (var i = saved.length - 1; i >= 0; i--) {
        var k = saved[i][0], d = saved[i][1];
        try { if (d) Object.defineProperty(sk, k, d); else delete sk[k]; } catch (e) {}
      }
    };
  };
  var withCtx = function (actor, sk, fn, self, args) {
    var patch = sk ? patchFor(actor, sk) : null, undo = patch ? applyPatch(sk, patch) : null;
    stack.push({ actor: actor, sk: sk });
    try { return fn.apply(self, args); }
    finally { stack.pop(); if (undo) undo(); }
  };
  var isMember = function (x) { var p = P(); return !!(p && x && (x === p || (p.allies || []).indexOf(x) >= 0)); };

  // 玩家施技
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      var p = P(), sk = DB.skills[skId];
      if (!p || !sk || !stageOf(p)) return oCast.apply(this, arguments);
      var before = (p._afkCallCd || 0), r = withCtx(p, sk, oCast, this, arguments);
      if (r && sk.callAllies && stageOf(p) >= 1 && (p._afkCallCd || 0) > before && (p._afkCallCd || 0) > tk()) p._afkCallCd -= 5;   // 呼喚盟友一：3 → 2.5 秒
      return r;
    };
  }
  // 傭兵施技（第一個參數是傭兵；sk 在第二個參數，沒有的用 null）
  var wrapAlly = function (name, skArg) {
    var o = W[name]; if (typeof o !== 'function' || o._afkSu) return;
    var f = function (ally) {
      if (!ally || !stageOf(ally)) return o.apply(this, arguments);
      var sk = skArg != null ? arguments[skArg] : null;
      return withCtx(ally, (sk && typeof sk === 'object') ? sk : null, o, this, arguments);
    };
    f._afkSu = true; W[name] = f;
  };
  [['allyCastMagic', 1], ['allyCastNonDamage', 1], ['allyCastPhysicalSkill', 1], ['allyCastCrush', 1], ['allyCastFixedStatus', 1],
    ['allyCastSlaughter', 1], ['allyCastMpDmg', 1], ['allyStormTick', 1], ['allyDarkCrit', null], ['allyCubeTick', null]].forEach(function (x) { wrapAlly(x[0], x[1]); });
  // 傭兵三重矢：核心固定射 3 箭，一階再補 1 箭
  if (typeof W.allyTripleShot === 'function') {
    var oTri = W.allyTripleShot;
    W.allyTripleShot = function (ally) {
      if (!ally || !stageOf(ally)) return oTri.apply(this, arguments);
      return withCtx(ally, null, function () {
        var r = oTri.apply(this, arguments);
        try { var t = getTarget(); if (t && t.curHp > 0 && typeof allyAttackOnce === 'function') allyAttackOnce(ally, 270); } catch (e) {}
        return r;
      }, this, arguments);
    };
  }
  // 傭兵自己維持增益（持續、HP 消耗照他自己的階段）：逐招套數值
  if (typeof W.allyMaintainBuffs === 'function') {
    var oMB = W.allyMaintainBuffs;
    W.allyMaintainBuffs = function (ally) {
      if (!ally || !stageOf(ally)) return oMB.apply(this, arguments);
      var undos = [];
      try {
        (ally.skills || []).forEach(function (sid) {
          var sk = DB.skills[sid], patch = sk ? patchFor(ally, sk) : null; if (patch) undos.push(applyPatch(sk, patch));
        });
        return oMB.apply(this, arguments);
      } finally {
        for (var i = undos.length - 1; i >= 0; i--) undos[i]();
      }
    };
  }
  // 傭兵呼喚盟友冷卻
  if (typeof W.allyRoyalAct === 'function') {
    var oRA = W.allyRoyalAct;
    W.allyRoyalAct = function (ally) {
      var before = ally ? (ally._afkCallCd || 0) : 0, r = oRA.apply(this, arguments);
      try { if (ally && stageOf(ally) >= 1 && (ally._afkCallCd || 0) > before && (ally._afkCallCd || 0) > tk()) ally._afkCallCd -= 5; } catch (e) {}
      return r;
    };
  }
  // 玩家的持續技能（立方每一跳、冰雪颶風這類增益每一跳）
  if (typeof W.cubeTick === 'function') {
    var oCube = W.cubeTick;
    W.cubeTick = function () { var p = P(); if (!p || !stageOf(p)) return oCube.apply(this, arguments); return withCtx(p, null, oCube, this, arguments); };
  }
  if (typeof W.stormBuffTick === 'function') {
    var oStorm = W.stormBuffTick;
    W.stormBuffTick = function (sk, noMageBonus) {
      var p = P(); if (!p || !stageOf(p) || noMageBonus) return oStorm.apply(this, arguments);   // noMageBonus＝魔女套裝觸發的冰雪暴，不是職業技能
      return withCtx(p, null, oStorm, this, arguments);
    };
  }

  // ── +%：傷害 ──
  var dmgHooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (dmgHooked) return true; if (!C || typeof C.damage !== 'function') return false; dmgHooked = true;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      var c = cur();
      if (c && actor && actor === c.actor && target && !isMember(target) && amount > 0) {
        var k = pctOf(actor); if (k > 0) amount = Math.max(1, Math.floor(amount * (1 + k)));
      }
      return o.call(this, actor, target, amount, opt);
    };
    f._afkSu = true; C.damage = f; return true;
  };
  var dmgOk = function () { return dmgHooked; };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }

  // ── +%：治療 ──
  if (typeof W.rollHealingSpell === 'function') {
    var oHeal = W.rollHealingSpell;
    W.rollHealingSpell = function (sk, dStats, caster, target) {
      var v = oHeal.apply(this, arguments);
      try { var k = pctOf(caster); if (k > 0 && v > 0 && !(sk && sk.fullRestore)) v = Math.floor(v * (1 + k)); } catch (e) {}
      return v;
    };
  }

  // ── 面板：增幅防禦、鏡像 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), st = stageOf(p); if (!p || !st || !p.d) return r;
        var b = p.buffs || {};
        if (b.sk_reduction_armor > 0) {
          var lv = Math.max(1, Number(p.lv) || 1), base = Math.floor(lv / 10), now = st >= 3 ? Math.floor(lv / 6) : Math.floor(lv / 8);
          if (now > base) p.d.dr = (Number(p.d.dr) || 0) + (now - base);
        }
        if (b.sk_illu_mirror > 0) p.d.er = (Number(p.d.er) || 0) + 10;   // 鏡像 +25 → +35
      } catch (e) {}
      return r;
    };
  }

  // ── 隱藏規則連動（不寫進任何說明）──
  var linkHidden = function () {
    var H = W.__afkHidden;
    if (typeof W.__afkSpellRoll === 'function' && !W.__afkSpellRoll._afkSu) {
      var oRoll = W.__afkSpellRoll;
      var f = function (a, t, sk, targets, ally) {
        var r = oRoll.apply(this, arguments);
        try {
          if (!r || !a) return r;
          var st = stageOf(a);
          if (st >= 1 && a.cls === 'illusion' && H && H.illuSk && H.illuSk(sk) && H.ILLU_CUT) r.mult = r.mult / H.ILLU_CUT;   // 十三：幻術士做過技能強化就取消
          if (st >= 2 && sk && sk._afkSuId === 'sk_meteor' && H && H.SPLASH && r.noCrit && Math.abs(r.mult - H.SPLASH) < 1e-9) r.mult = 1;   // 流星雨二：副目標 ×1.0（仍不爆擊）
        } catch (e) {}
        return r;
      };
      f._afkSu = true; W.__afkSpellRoll = f;
    }
    if (typeof W.__afkHiddenAoeCd === 'function' && !W.__afkHiddenAoeCd._afkSu) {
      var oCd = W.__afkHiddenAoeCd;
      var g = function (sk, a) {
        var v = oCd.apply(this, arguments);
        try { var who = a || P(); if (v > 0 && sk && sk._afkSuId === 'sk_meteor' && stageOf(who) >= 3) v = Math.min(v, 20); } catch (e) {}   // 流星雨三：3.5 → 2 秒
        return v;
      };
      g._afkSu = true; W.__afkHiddenAoeCd = g;
    }
  };
  linkHidden(); try { document.addEventListener('DOMContentLoaded', linkHidden); } catch (e) {}

  // ── NPC：席琳神殿 技藝導師 薇爾娜 ──
  var NPC_ID = 'npc_afk_skillup', TOWN = 'town_sherine';
  try {
    var def = { id: NPC_ID, n: '技藝導師 薇爾娜', title: '技能強化', type: 'quest', classicHide: true,
      d: '在席琳神殿替冒險者重新磨亮技藝的導師。她說，技藝不會因為輪迴而消失，只會被遺忘。' };
    var L = W.__afkLore; if (L && L.addNpc) L.addNpc(TOWN, def, null, null); else if (DB.towns && DB.towns[TOWN]) DB.towns[TOWN].npcs.push(def);
  } catch (e) {}

  var STAGE_TXT = [
    null,
    { n: '第一階段', all: '全部職業技能 +5%', sig: '招牌技能的數值強化（例：衝擊之暈的追加傷害提高、流星雨 15 發、三重矢 4 箭、精準射擊與反擊屏障持續加倍、奪命之雷骰數增加、疼痛的歡愉持續加倍、立方持續 30 秒、鏡像迴避 +35、精準目標持續加倍、增幅防禦的減免提高、呼喚盟友冷卻縮短）' },
    { n: '第二階段', all: '全部職業技能累計 +10%', sig: '招牌技能的追加效果（例：流星雨範圍更強、屠宰者 4 刀、奪命之雷 HP 消耗降低、血之渴望持續加倍、疼痛的歡愉不再消耗 HP）' },
    { n: '第三階段', all: '全部職業技能累計 +20%', sig: '招牌技能的質變（例：流星雨消耗 MP 降低、冷卻更短，屠宰者、血之渴望幾乎不消耗 HP，增幅防禦的減免再提高）' }
  ];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var render = function (box) {
    var p = P(); if (!box || !p) return;
    var st = stageOf(p), h = '<p class="afk-lore">「技藝不會因為輪迴而消失，只會被遺忘。把材料拿來，我幫你想起來。」</p>';
    h += '<p class="note">目前：' + (st ? STAGE_TXT[st].n + '（' + STAGE_TXT[st].all + '）' : '還沒強化') + '。每個角色各自計算，照順序升級，一定成功。傭兵要「重新招募」才會用到新的階段。</p>';
    for (var s = 1; s <= 3; s++) {
      var done = st >= s, next = st + 1 === s, T2 = STAGE_TXT[s];
      var cost = COST[s].map(function (x) { var have = count(x[0]); return esc(nameOf(x[0])) + ' ×' + x[1].toLocaleString() + (next ? '（背包 ' + have.toLocaleString() + '）' : ''); }).join('、');
      h += '<div class="card' + (done ? ' on' : '') + '"><b>' + T2.n + (done ? '（完成）' : '') + '</b><p>' + T2.all + '；' + T2.sig + '</p><p class="note">材料：' + cost + '</p>' +
        (next ? '<button type="button" data-su="1">強化</button>' : '') + '</div>';
    }
    box.innerHTML = h;
  };
  var css = function () {
    if (document.getElementById('afk-skillup-css')) return;
    var s = document.createElement('style'); s.id = 'afk-skillup-css';
    s.textContent = '.afk-su{color:#e2e8f0;font-size:14px;line-height:1.7}.afk-su p{margin:6px 0}.afk-su .note{color:#cbd5e1}' +
      '.afk-su .card{border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:10px 0;background:rgba(15,23,42,.6)}' +
      '.afk-su .card.on{border-color:#facc15;box-shadow:0 0 8px rgba(161,98,7,.6)}.afk-su .card b{color:#fde68a;font-size:15px}' +
      '.afk-su button{padding:6px 14px;border-radius:6px;background:#6d28d9;color:#fff;border:1px solid #a78bfa;font-size:14px;font-weight:bold}';
    document.head.appendChild(s);
  };
  var embed = function (div) {
    if (!div) return; css();
    div.innerHTML = '<div class="afk-su"><div class="box"></div></div>';
    var host = div.querySelector('.afk-su');
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || !b.dataset.su) return;
      var go = function () { upgrade(); render(host.querySelector('.box')); };
      var msg = '確定要進行技能強化嗎？材料會直接扣掉，不能還原。';
      if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '技能強化', message: msg, okText: '強化', cancelText: '取消', onOk: go }); else if (confirm(msg)) go();
    });
    render(host.querySelector('.box'));
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (npcId === NPC_ID) { try { embed(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }

  W.__afkSkillUp = { dmgOk: dmgOk, stageOf: stageOf, pctOf: pctOf, upgrade: upgrade, SIG: SIG, SIG_TODO: SIG_TODO, COST: COST, patchFor: patchFor, NPC_ID: NPC_ID,
    _set: function (n) { var p = P(); if (p) { p.afkSkillUp = Math.max(0, Math.min(3, n | 0)); try { calcStats(); } catch (e) {} } } };
  console.log('[AFK] 已啟用：技能強化（席琳神殿 技藝導師 薇爾娜）');
})();
