/* ============================================================================
 * afk-dimrelic24.js — 次元遺物 +2／+4 新特效（Ping 11-18 18:24；設計稿 Projects claude/dimension-relic-24-design.md）
 *
 *   +2＝原本的部位特性＋「部位特效」；+4＝原本的角色主題招牌＋「主題特效」。只算你本人。
 *   效果資料直接接到 afk-dimrelic 的效果表（fx().sum(...) 讀得到），說明欄同步改寫。
 *   新效果種類（d 開頭）：dSpell 攻擊施法、dRes 共鳴、dBurst 幻影衝擊、dChain 鎖鏈閃光、dBuff 受擊增益、dCleanse 異常抵抗、
 *   dCounter 迴避反擊、dReflMag 反彈魔法、dMs 魔擊、dHpHeal 受擊回血、dNoMp 不耗 MP、dMpShield 魔力護盾、
 *   dAoe 次元崩裂、dPartyHeal 全部治癒術、dJudge 審判、dBreak 破甲、dKillNext 擊殺後下一擊、dClone 鏡像分身、dInkAll 墨潮、dTimeStop 時停。
 *   內建冷卻：攻擊施法類每次觸發後 0.5 秒（同遺物攻擊施法）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, DRX = W.__afkDimRelic;
  if (!DRX || !DRX.LIST || typeof DB === 'undefined') return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var live = function () { return mobs().filter(function (m) { return m && !m._dead && m.curHp > 0 && !m.isAlly && !m._isAlly; }); };
  var clog = function (h) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, 'player-special'); } catch (e) {} };
  var tag = function (t) { return '<span class="font-bold" style="color:#67e8f9;">【' + t + '】</span>'; };

  // ── 資料 ──
  var NEW2 = {
    '匕首': ['命中時 8% 施放「暗影衝擊」', ['dSpell', 0.08, 'sk_dark_shadowstun', 'hit']],
    '單手劍': ['命中時 8% 施放「烈炎術」', ['dSpell', 0.08, 'sk_blaze', 'hit']],
    '雙手劍': ['命中時 6% 施放「火風暴」', ['dSpell', 0.06, 'sk_fire_storm', 'hit']],
    '武士刀': ['爆擊時 15% 施放「極道落雷」', ['dSpell', 0.15, 'sk_thunder', 'crit']],
    '單手鈍器': ['命中時 6% 施放「衝擊之暈」', ['dSpell', 0.06, 'sk_shock_stun', 'hit']],
    '雙手鈍器': ['命中時 6% 施放「地裂術」', ['dSpell', 0.06, 'sk_earthquake', 'hit']],
    '矛': ['命中時 8% 施放「冰錐」', ['dSpell', 0.08, 'sk_ice_spike', 'hit']],
    '弓': ['命中時 8% 施放「三重矢」', ['dSpell', 0.08, 'sk_elf_triple', 'hit']],
    '魔杖': ['共鳴（同共鳴魔杖，機率＝智力 ÷ 60）', ['dRes', 1]],
    '奇古獸': ['命中時 10% 「幻影衝擊」：再打該次傷害的 150%', ['dBurst', 0.10, 1.5, '幻影衝擊']],
    '十字弓': ['命中時 8% 施放「寒冰氣息」', ['dSpell', 0.08, 'sk_chill', 'hit']],
    '鋼爪': ['命中時 8% 施放「吸血鬼之吻」', ['dSpell', 0.08, 'sk_vampire', 'hit']],
    '雙刀': ['命中時 10% 「雙擊」再打一次', ['copy', 0.10]],
    '鎖鏈劍': ['命中時 8% 「鎖鏈閃光」：另外兩個敵人各受該次傷害 60%', ['dChain', 0.08, 0.6]],
    '頭盔': ['受到魔法傷害時 6% 「聖結界」：8 秒內受到的魔法傷害 −30%', ['dBuff', 0.06, 'holy', 'hurtMag']],
    '盔甲': ['受到傷害時 5% 「鋼鐵防護」：8 秒內傷害減免 +30', ['dBuff', 0.05, 'steel', 'hurt']],
    '內衣': ['陷入異常狀態時 20% 立刻解除', ['dCleanse', 0.2]],
    '斗篷': ['迴避成功時 15% 反擊（你一般攻擊的 100%）', ['dCounter', 0.15]],
    '手套': ['命中時 6% 施放「光箭」', ['dSpell', 0.06, 'sk_lightarrow', 'hit']],
    '長靴': ['受到傷害時 5% 「風之疾走＋神聖疾走」：8 秒攻擊速度 +50%', ['dBuff', 0.05, 'dash', 'hurt']],
    '脛甲': ['受到傷害時 5% 「大地屏障」：8 秒內受到的物理傷害 −30%', ['dBuff', 0.05, 'earth', 'hurt']],
    '盾牌': ['受到魔法傷害時 8% 反彈該次傷害 50%', ['dReflMag', 0.08, 0.5]],
    '戒指': ['命中時 5% 「魔擊」', ['dMs', 0.05]],
    '項鍊': ['受到傷害時 5% 回復最大 HP 5%（10 秒冷卻）', ['dHpHeal', 0.05, 0.05, 10]],
    '耳環': ['施法時 8% 不消耗 MP', ['dNoMp', 0.08]],
    '腰帶': ['受到傷害時 5% 「魔力護盾」：吸收最大 MP 30% 的傷害（8 秒）', ['dMpShield', 0.05, 0.3]]
  };
  var NEW4 = {
    rift: ['命中時 4% 「次元崩裂」：全體敵人受該次傷害 300%', ['dAoe', 0.04, 3]],
    crit: ['爆擊時 10% 施放「流星雨」', ['dSpell', 0.10, 'sk_meteor', 'crit']],
    heal: ['受到傷害時 5% 「全部治癒術」：全隊回復最大 HP 20%（10 秒冷卻）', ['dPartyHeal', 0.05, 0.2, 10]],
    true: ['命中時 3% 「審判」：目標最大 HP 1% 的真實傷害（頭目 0.1%）', ['dJudge', 0.03, 0.01, 0.001]],
    boss: ['打頭目時 5% 「破甲」：頭目 5 秒內受到的傷害 +10%', ['dBreak', 0.05, 0.10, 5]],
    stack: ['打倒怪物時 30% 讓下一擊 ×2', ['dKillNext', 0.30, 2]],
    mirror: ['受到傷害時 5% 召喚「鏡像分身」10 秒（每秒打一次你一般攻擊的 30%）', ['dClone', 0.05, 10, 0.3]],
    fire: ['命中時 5% 施放「火風暴」', ['dSpell', 0.05, 'sk_fire_storm', 'hit']],
    ink: ['命中時 5% 「墨潮」：全體敵人中墨汁 3 秒', ['dInkAll', 0.05, 3]],
    speed: ['每 60 秒「時停」：全體敵人停 1 秒（頭目無效）', ['dTimeStop', 60, 1]]
  };
  // 接到效果表（同部位／同主題共用同一個陣列，只加一次），說明欄同步
  var done = typeof WeakSet === 'function' ? new WeakSet() : null;
  var addTo = function (arr, nw) { if (!arr || !nw || (done && done.has(arr))) return; if (done) done.add(arr); arr[0] = arr[0] + '；' + nw[0]; arr.push(nw[1]); };
  DRX.LIST.forEach(function (row) {
    addTo(row.fx[1], NEW2[row.slotName]);
    addTo(row.fx[3], NEW4[row.ch && row.ch[1]]);
    var d = DB.items[row.id]; if (!d || !d.d) return;
    d.d = d.d.replace(/\n\+2：[^\n]*/, '\n+2：' + row.fx[1][0]).replace(/\n\+4：[^\n]*/, '\n+4：' + row.fx[3][0]);
  });

  // ── 執行 ──
  var fx = function () { try { return DRX.fx(); } catch (e) { return null; } };
  var sum = function (k) { var f = fx(); return f && f.sum ? f.sum(k) : []; };
  var B = { cd: {}, buf: {}, nextMul: 0, shield: 0, clone: 0, cloneK: 0 };
  var on = function (k) { return (B.buf[k] || 0) > now(); };
  var C = function () { return W.AFK_CARD_COMBAT; };
  var hurt = function (m, v, kind) {
    if (!m || m._dead || !(m.curHp > 0) || !(v > 0)) return;
    var p = P(), d = v;
    try { var c = C(); if (c) d = c.damage(p, m, v, { kind: kind || 'magic', _dimNested: true }); } catch (e) {}
    d = Math.max(0, Math.floor(Number(d) || 0)); if (!d) return;
    m.curHp -= d; m.justHit = kind === 'phys' ? true : 'magic';
    if (m.curHp <= 0 && typeof killMob === 'function') { var i = mobs().indexOf(m); if (i >= 0) killMob(i); }
  };
  var icd = function (k, sec) { var t = now(); if ((B.cd[k] || 0) > t) return false; B.cd[k] = t + sec * 10; return true; };
  var castOn = function (m, skId) { if (!DB.skills || !DB.skills[skId] || typeof W.procFreeMagicSkill !== 'function') return; try { W.procFreeMagicSkill(m, skId, 5, false, null); } catch (e) {} };
  var buff = function (k, sec, txt) { B.buf[k] = now() + sec * 10; if (k === 'dash') { try { calcStats(); } catch (e) {} setTimeout(function () { try { calcStats(); } catch (e) {} }, sec * 1000 + 50); } if (txt) clog(tag(txt) + '發動。'); };

  // 命中
  var onHit = function (p, m, v, crit) {
    if (!m || m._dead) return;
    sum('dSpell').forEach(function (e) { if ((e[3] === 'crit' ? crit : true) && Math.random() < e[1] && icd('sp' + e[2], 0.5)) castOn(m, e[2]); });
    sum('dBurst').forEach(function (e) { if (Math.random() < e[1]) { hurt(m, v * e[2], 'magic'); clog(tag(e[3]) + '再打一次。'); } });
    sum('dChain').forEach(function (e) { if (Math.random() < e[1]) live().filter(function (x) { return x !== m; }).slice(0, 2).forEach(function (x) { hurt(x, v * e[2], 'magic'); }); });
    sum('dMs').forEach(function (e) { if (Math.random() < e[1] && typeof W.procMagicStrike === 'function') { try { W.procMagicStrike(m); } catch (er) {} } });
    sum('dAoe').forEach(function (e) { if (Math.random() < e[1]) { live().forEach(function (x) { hurt(x, v * e[2], 'magic'); }); clog(tag('次元崩裂') + '全體受到 ' + Math.round(e[2] * 100) + '% 傷害。'); } });
    sum('dJudge').forEach(function (e) { if (Math.random() < e[1] && m.curHp > 0) { var d = Math.floor((m.hp || 0) * (m.boss ? e[3] : e[2])); if (d > 0) { m.curHp -= d; if (m.curHp <= 0 && typeof killMob === 'function') { var i = mobs().indexOf(m); if (i >= 0) killMob(i); } } } });
    if (m.boss) sum('dBreak').forEach(function (e) { if (Math.random() < e[1]) { m._dimBreak = now() + e[3] * 10; m._dimBreakK = e[2]; } });
    sum('dInkAll').forEach(function (e) { if (Math.random() < e[1]) { var t = now(); live().forEach(function (x) { x._dimInk = t + e[2] * 10; x._dimInkK = Math.max(x._dimInkK || 0, 0.3); }); clog(tag('墨潮') + '全體敵人中了墨汁。'); } });
  };
  var hookOut = function () {
    var c = C(); if (!c || typeof c.damage !== 'function' || c.__afkDim24) return; c.__afkDim24 = true;
    var o = c.damage;
    c.damage = function (actor, target, amount, opt) {
      var p = P();
      try {
        if (p && actor === p && target && amount > 0 && !(opt && opt._dimNested) && target.curHp > 0) {
          if ((target._dimBreak || 0) > now()) amount *= 1 + (target._dimBreakK || 0);
          if (B.nextMul && opt && opt.packet) { amount *= B.nextMul; B.nextMul = 0; }
        }
      } catch (e) {}
      var r = o.call(this, actor, target, amount, opt);
      try {
        if (p && actor === p && target && r > 0 && !(opt && opt._dimNested) && !target._isAlly) {
          var crit = !!(opt && opt.packet && opt.packet.crit), v = r;
          if (sum('dSpell').length || sum('dBurst').length || sum('dChain').length || sum('dMs').length || sum('dAoe').length || sum('dJudge').length || sum('dBreak').length || sum('dInkAll').length)
            setTimeout(function () { try { onHit(p, target, v, crit); } catch (e) {} }, 0);
        }
      } catch (e) {}
      return r;
    };
  };
  // 受擊
  var hookIn = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.incoming !== 'function' || R.__afkDim24) return; R.__afkDim24 = true;
    var o = R.incoming;
    R.incoming = function (target, damage, attacker, opts) {
      var out = o.apply(this, arguments);
      try {
        var p = P(); if (!p || target !== p || typeof out !== 'number' || !(out > 0)) return out;
        var mag = !!(opts && /mag/.test(String(opts.kind || opts.type || ''))), t = now();
        if (mag && on('holy')) out *= 0.7;
        if (!mag && on('earth')) out *= 0.7;
        if (on('steel')) out = Math.max(0, out - 30);
        if (B.shield > 0 && on('mpshield')) { var a = Math.min(B.shield, out); B.shield -= a; out -= a; }
        sum('dBuff').forEach(function (e) { if ((e[3] === 'hurtMag' ? mag : true) && !on(e[2]) && Math.random() < e[1]) buff(e[2], 8, { holy: '聖結界', steel: '鋼鐵防護', dash: '風之疾走＋神聖疾走', earth: '大地屏障' }[e[2]]); });
        if (mag && attacker && attacker !== p && mobs().indexOf(attacker) >= 0) sum('dReflMag').forEach(function (e) { if (Math.random() < e[1]) hurt(attacker, out * e[2], 'magic'); });
        sum('dHpHeal').forEach(function (e) { if (Math.random() < e[1] && icd('hpheal', e[3])) p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * e[2])); });
        sum('dMpShield').forEach(function (e) { if (!on('mpshield') && Math.random() < e[1]) { B.shield = Math.floor((p.mmp || 0) * e[2]); buff('mpshield', 8, '魔力護盾'); } });
        sum('dPartyHeal').forEach(function (e) { if (Math.random() < e[1] && icd('pheal', e[3])) { p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * e[2])); (p.allies || []).forEach(function (a) { if (a && !a._downed && a.curHp > 0) a.curHp = Math.min(a.mhp || a.curHp, a.curHp + Math.floor((a.mhp || 0) * e[2])); }); clog(tag('全部治癒術') + '全隊回復 ' + Math.round(e[2] * 100) + '% HP。'); } });
        sum('dClone').forEach(function (e) { if (!on('clone') && Math.random() < e[1]) { B.cloneK = e[3]; buff('clone', e[2], '鏡像分身'); } });
      } catch (e) {}
      return out;
    };
  };
  // 異常：內衣 20% 抵抗
  var hookRes = function () {
    if (typeof W.playerStatusResisted !== 'function' || W.__afkDim24Res) return; W.__afkDim24Res = true;
    var o = W.playerStatusResisted;
    W.playerStatusResisted = function () { try { var c = 0; sum('dCleanse').forEach(function (e) { c = Math.max(c, e[1]); }); if (c && Math.random() < c) return true; } catch (e) {} return o.apply(this, arguments); };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  };
  // 迴避反擊、擊殺
  var hookProc = function () {
    var H = W.__afkProc; if (!H || !H.on || hookProc.done) return; hookProc.done = true;
    H.on('evade', function (mob) { var p = P(); if (!p || !mob || mob._dead) return; sum('dCounter').forEach(function (e) { if (Math.random() < e[1]) { var d = Number(p.d && (p.d.meleeDmg || p.d.dmg)) || 50; hurt(mob, d * 3, 'phys'); clog(tag('反擊') + '閃開之後順勢還擊。'); } }); });
  };
  if (typeof W.killMob === 'function' && !W.__afkDim24Kill) {
    W.__afkDim24Kill = true;
    var oK = W.killMob;
    W.killMob = function (idx) { var m = mobs()[idx], was = !!(m && m._dead), r = oK.apply(this, arguments); try { if (m && !was && m._dead && P()) sum('dKillNext').forEach(function (e) { if (Math.random() < e[1]) B.nextMul = Math.max(B.nextMul, e[2]); }); } catch (e) {} return r; };
  }
  // 不耗 MP（耳環）
  if (typeof W.castSkill === 'function' && !W.__afkDim24Cast) {
    W.__afkDim24Cast = true;
    var oC = W.castSkill;
    W.castSkill = function () { var p = P(), mp0 = p ? p.mp : 0, r = oC.apply(this, arguments); try { if (p && r && p.mp < mp0) { var c = 0; sum('dNoMp').forEach(function (e) { c = Math.max(c, e[1]); }); if (c && Math.random() < c) p.mp = mp0; } } catch (e) {} return r; };
    try { (0, eval)('castSkill = window.castSkill'); } catch (e) {}
  }
  // 攻擊速度（長靴）
  if (typeof W.recomputeStats === 'function' && !W.__afkDim24Re) {
    W.__afkDim24Re = true;
    var oR = W.recomputeStats;
    W.recomputeStats = function () { var r = oR.apply(this, arguments); try { var p = P(); if (p && p.d && on('dash')) { var o0 = Number(p.d.atkSpdPct) || 0; p.d.atkSpdPct = o0 + 50; if (p.d.aspd > 0) p.d.aspd *= (1 + o0 / 100) / (1 + (o0 + 50) / 100); } } catch (e) {} return r; };
  }
  // 每秒：鏡像分身、時停
  if (typeof W.tick === 'function' && !W.__afkDim24Tick) {
    W.__afkDim24Tick = true;
    var oT = W.tick;
    W.tick = function () {
      var t0 = now(), r = oT.apply(this, arguments);
      try {
        var t = now(), p = P(); if (!p || p.dead || t === t0 || t % 10) return r;
        if (on('clone')) { var m = live()[0]; if (m) hurt(m, (Number(p.d && (p.d.meleeDmg || p.d.dmg)) || 50) * 3 * B.cloneK, 'phys'); }
        sum('dTimeStop').forEach(function (e) { if (live().length && icd('tstop', e[1])) { live().forEach(function (x) { if (!x.boss) { var st = x.st || (x.st = {}); st.stun = Math.max(st.stun || 0, e[2] * 10); } }); clog(tag('時停') + '敵人的時間停了一秒。'); } });
      } catch (e) {}
      return r;
    };
  }
  // 魔杖 +2 共鳴（afk-relicmix 的 isResonanceWeapon 看這個）
  W.__afkDimRes = function (id) { try { var p = P(), it = p && p.eq && p.eq.wpn; if (!it || it.id !== id || !(DRX.BY[id] || DRX.BY[it.dimV]) || (Number(it.dimEn) || 0) < 2) return false; return sum('dRes').length > 0; } catch (e) { return false; } };
  var hookAll = function () { hookOut(); hookIn(); hookRes(); hookProc(); };
  hookAll(); W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); });
})();
