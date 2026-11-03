/* ============================================================================
 * afk-charm.js — 迷魅術改版（玩家 2026-11-03；外掛開關 charmrework，預設開；經典模式照原版）
 *
 * 一、學習：所有職業都能學（同一本「魔法書(迷魅術)」）
 *     法師、王族 Lv20；其他職業（騎士、妖精、黑暗妖精、幻術士、龍騎士、戰士）Lv40。
 * 二、施放：只能手動施放。MP 200、冷卻 5 秒；同時最多 1 隻被迷魅的怪物；持續 15 分鐘。
 * 三、成功率：v ＝ 魅力 ＋ ⌊智力÷3⌋ ＋ ⌊精神÷5⌋ − 怪物魔防
 *     v 是負數 → 取絕對值；v 大於 100 → 去掉百位數（v mod 100，例：250 → 50、1234 → 34；剛好 100 不變）
 *     先擲 5% 怪物抵抗（一定有），沒抵抗再擲 v% 成功。
 *     頭目（王／首領）：成功率固定 5%。
 *     不能迷魅：帶「不可迷魅」的怪、攻城區、其他玩家角色、終焉的女神與使徒、木人場（afk-training 另擋）。
 * 四、被迷魅的怪物離開敵方、替你作戰（沿用原版的僕人：不會被打、照牠的攻擊速度攻擊）。
 * 五、迷魅頭目：
 *     ‧牠的一般攻擊會波及你方角色：你與每名傭兵受到牠這次造成傷害的 30%
 *     ‧牠會繼續施放自己的技能：傷害型技能同時打到敵人與你方全體（你、傭兵、寵物、召喚物、城堡護衛）；
 *       控制、異常類技能只落在你方全體
 *     ‧每 3 分鐘 15% 機率殺死隊伍中隨機一名角色（含你）；15 分鐘結束時若一個都沒殺，結束時殺一名
 *       被殺的角色不能復活、被送回村莊；傭兵要等你回到村莊才會恢復；被殺的是你 → 迷魅隨之解除
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'charmrework', name: '迷魅術改版', group: '遊戲玩法', seal: true,
    desc: '所有職業都能學迷魅術；成功率看魅力、智力、精神與怪物魔防；可以迷魅頭目（5%），但頭目會反噬你的隊伍' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };
  var on = function () { var p = P(); return (!T || T.enabled('charmrework')) && !!(p && !p.classicMode); };
  // 規則是否套用（不需要已載入角色：小百科、技能說明用）；已載入經典模式角色時不套用
  var ruleOn = function () { var p = P(); return (!T || T.enabled('charmrework')) && !(p && p.classicMode); };
  var SK = 'sk_charm';
  var CFG = { mp: 200, cdTicks: 50, durTicks: 9000, resist: 5, bossRate: 5, splash: 0.30, killEvery: 1800, killPct: 15,
    lvMain: 20, lvOther: 40, mainCls: { mage: 1, royal: 1 } };
  var clog = function (h, kind) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, kind || 'magic'); } catch (e) {} };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var mobName = function (m) { return '<span class="' + (typeof getMobColor === 'function' ? getMobColor(m.lv) : '') + '">' + m.n + '</span>'; };

  // ── 成功率公式 ──
  var charmValue = function (cha, int, wis, mr) {
    var v = Math.floor(Number(cha) || 0) + Math.floor((Number(int) || 0) / 3) + Math.floor((Number(wis) || 0) / 5) - Math.floor(Number(mr) || 0);
    if (v < 0) v = -v;
    while (v > 100) v = v % 100;
    return v;
  };
  var rateFor = function (p, t) {
    if (t && t.boss) return CFG.bossRate;
    var d = (p && p.d) || {};
    return charmValue(d.cha, d.int, d.wis, t ? t.mr : 0);
  };
  // 擲骰：回傳 'ok'｜'resist'｜'fail'
  var rollCharm = function (p, t) {
    if (t.boss) return Math.random() * 100 < CFG.bossRate ? 'ok' : 'fail';
    if (Math.random() * 100 < CFG.resist) return 'resist';
    return Math.random() * 100 < rateFor(p, t) ? 'ok' : 'fail';
  };
  var blockedTarget = function (t) {
    if (!t) return '沒有目標。';
    if (t.noCharm) return '這個目標無法被迷魅。';
    if (t.trollPlayer || t._pvpDuelFoe || t._afkFinal || t._afkApostle) return '這個目標無法被迷魅。';
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(mapState.current)) return '攻城區無法使用迷魅術。'; } catch (e) {}
    return '';
  };

  // ── 學習等級：所有職業 ──
  var reqLv = function (cls) { return CFG.mainCls[cls] ? CFG.lvMain : CFG.lvOther; };
  if (typeof W.skillReqLv === 'function') {
    var oReq = W.skillReqLv;
    W.skillReqLv = function (sk, skId) {
      if ((skId === SK || (sk && DB.skills[SK] === sk)) && on()) return reqLv(P().cls);
      return oReq.apply(this, arguments);
    };
  }

  // ── 技能資料：改版時顯示 MP 200 與說明（經典模式照原版） ──
  var DESC = '只能手動施放；冷卻 5 秒、持續 15 分鐘，同時只能有 1 隻僕人。成功率看魅力、智力、精神與目標的魔防（魅力影響最大），目標另有 5% 機率抵抗；對頭目固定 5%。被迷魅的頭目一般攻擊照原本的傷害、同時波及你方角色 30%、施放技能也會打到你方全體，而且可能殺死隊伍中的一名角色；15 分鐘一到迷魅一定解除。';
  try {
    var skd = DB.skills[SK];
    if (skd) {
      var baseMp = skd.mp;
      Object.defineProperty(skd, 'mp', { configurable: true, enumerable: true, get: function () { return ruleOn() ? CFG.mp : baseMp; }, set: function () {} });
      Object.defineProperty(skd, 'desc', { configurable: true, enumerable: true, get: function () { return ruleOn() ? DESC : undefined; }, set: function () {} });
    }
  } catch (e) { console.warn('[AFK-charm] skill data', e); }

  // ── 施放 ──
  var snapMob = function (t) {
    var o = {};
    try {
      Object.keys(t).forEach(function (k) {
        if (k.charAt(0) === '_' || k === 'st') return;
        var v = t[k]; if (typeof v === 'function') return;
        o[k] = v;
      });
      o = JSON.parse(JSON.stringify(o));
    } catch (e) { o = { n: t.n, lv: t.lv, boss: true, hp: t.hp, mr: t.mr, dmg: t.dmg, db: t.db, e: t.e }; }
    o.curHp = o.hp || 1; o.uid = 'afk-charm-' + (t.uid || now()); o._afkCharmSnap = true;
    return o;
  };
  var cast = function () {
    var p = P(), sk = DB.skills[SK];
    if (!p || !sk || (p.skills || []).indexOf(SK) < 0) return;
    if (typeof inAbsBarrier === 'function' && inAbsBarrier()) { sys('絕對屏障期間與世界隔絕，無法行動。'); return; }
    var st = p.statuses || {};
    if (st.silence > 0 || st.magicseal > 0) { sys('你被沉默／魔法封印，無法施放魔法。'); return; }
    if (st.stun > 0 || st.freeze > 0 || st.stone > 0 || st.paralyze > 0 || st.sleep > 0) { sys('你目前無法行動。'); return; }
    var granted = p.grantedSkills && p.grantedSkills.indexOf(SK) >= 0;
    if (!granted && p.lv < reqLv(p.cls)) { sys('等級不足，無法使用此技能。'); return; }
    if ((p.manualCd[SK] || 0) > 0) { sys('技能冷卻中。'); return; }
    if (p.d && p.d.charmOnHit) { sys('裝備斯克巴女皇的魅惑之吻時，迷魅術會改為命中後自動施展。'); return; }
    if (p.charmed) { sys('你已經有一隻被迷魅的僕人了（同時只能有 1 隻）。'); return; }
    var t = (typeof getTarget === 'function') ? getTarget() : null;
    var why = blockedTarget(t); if (why) { sys(why); return; }
    if ((p.mp || 0) < CFG.mp) { sys('MP 不足（需要 ' + CFG.mp + '）。'); return; }
    var mp0 = p.mp;
    p.mp -= CFG.mp;
    p.manualCd[SK] = CFG.cdTicks;
    var r = rollCharm(p, t);
    if (r === 'ok') {
      var idx = mapState.mobs.findIndex(function (m) { return m && m.uid === t.uid; });
      p.buffs = p.buffs || {};
      p.buffs[SK] = Math.ceil(CFG.durTicks / 10);
      p.charmed = {
        skId: SK, n: '迷魅：' + t.n, dmgDice: t.dmg && t.dmg[1] ? t.dmg : [1, 4],
        interval: Math.max(10, Math.floor((t.atkSpd || 2) * 10)), ele: 'none', kind: 'melee',
        hitBonus: (t.hit || 0), proc: null, cd: 10, endTick: now() + CFG.durTicks + 10,
        _afkC: { boss: !!t.boss, el: 0, killed: 0, db: Number(t.db) || 0 }
      };
      if (t.boss) p.charmed._afkMob = snapMob(t);
      clog(mobName(t) + ' 成為你的僕人。' + (t.boss ? '<span class="text-rose-400 font-bold">牠的力量也在侵蝕你的隊伍……</span>' : ''));
      try { if (typeof playSpellFx === 'function') playSpellFx(sk.n, t); } catch (e) {}
      if (idx !== -1) { mapState.mobs[idx] = null; try { renderMobs(); } catch (e) {} }
    } else clog(r === 'resist' ? mobName(t) + ' 抵抗了迷魅術。' : '迷魅術失敗了。', 'miss');
    try { if (typeof manaMasteryRefund === 'function' && (typeof _afkM === 'function' ? _afkM(p, 'i_mana') : p.mastery === 'i_mana')) manaMasteryRefund(mp0 - p.mp); } catch (e) {}
    try { calcStats(); updateUI(); } catch (e) {}
  };
  if (typeof W.manualCast === 'function') {
    var oMC = W.manualCast;
    W.manualCast = function (skId) {
      if (skId !== SK || !on()) return oMC.apply(this, arguments);
      try { if (mapState && mapState.current === 'afk_dummy') return oMC.apply(this, arguments); } catch (e) {}   // 木人場：交給木人場自己擋
      return cast();
    };
  }

  // ── 隊伍 ──
  var party = function () {
    var p = P(), out = []; if (!p) return out;
    if (!p.dead && p.hp > 0) out.push(p);
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); });
    return out;
  };
  var who = function (x) { return x === P() ? '你' : '協力·' + (x._allyName || '傭兵'); };

  // ── 頭目的一般攻擊波及你方角色 30% ──
  if (typeof W.summonAttack === 'function') {
    var oSA = W.summonAttack;
    W.summonAttack = function (sm) {
      var p = P();
      if (!p || !sm || sm !== p.charmed || !sm._afkC || !sm._afkC.boss || !on()) return oSA.apply(this, arguments);
      var before = [];
      try { (mapState.mobs || []).forEach(function (m) { if (m && !m._dead && m.curHp > 0) before.push([m, m.curHp]); }); } catch (e) {}
      // 被迷魅的王，普攻照王原本的傷害（骰＋傷害加值）：暫時把加值算進目標減傷的反向，打完還原
      var db = Number(sm._afkC.db) || 0, adj = [];
      if (db) before.forEach(function (b) { adj.push([b[0], b[0].dr]); b[0].dr = (Number(b[0].dr) || 0) - db; });
      var r;
      try { r = oSA.apply(this, arguments); }
      finally { adj.forEach(function (a) { if (a[1] === undefined) delete a[0].dr; else a[0].dr = a[1]; }); }
      try {
        var dealt = 0;
        before.forEach(function (b) { dealt += Math.max(0, b[1] - Math.max(0, Number(b[0].curHp) || 0)); });
        if (dealt > 0) splash(Math.floor(dealt * CFG.splash), sm);
      } catch (e) { console.warn('[AFK-charm] splash', e); }
      return r;
    };
  }
  var splash = function (dmg, sm) {
    if (!(dmg > 0)) return;
    var p = P(), hit = [];
    party().forEach(function (x) {
      if (x === p) {
        p.hp -= dmg; hit.push('你');
        if (p.hp <= 0 && typeof killPlayer === 'function') killPlayer();
      } else {
        x.curHp -= dmg; hit.push(who(x));
        if (x.curHp <= 0) { x.curHp = 0; x._downed = true; x._reviveCd = 150; }
      }
    });
    if (hit.length) clog('<span class="text-rose-300">' + (sm.n || '僕人') + ' 的攻擊波及了你的隊伍：</span>' + hit.join('、') + (hit.length > 1 ? ' 各' : ' ') + '受到 ' + dmg + ' 點傷害。', 'enemy');
    try { updateUI(); } catch (e) {}
  };

  // ── 頭目繼續施放自己的技能 ──
  var MAGK = ['mag', 'mag2', 'mag3', 'mag4', 'mag5'];
  var HARM = ['stone', 'paralyze', 'silence', 'magicseal', 'freeze', 'sleep', 'scald', 'stun', 'slowatk', 'poison', 'burn', 'bleed', 'frost_breath', 'weaken', 'disease', 'potionfrost', 'foulwater'];
  var castBossSkill = function (sm, mob, sk) {
    var p = P(); if (!p || p.dead) return;
    if (!(sk.dmg || HARM.indexOf(sk.type) >= 0)) return;   // 自我增益、治療、召喚等不放
    // 敵方：傷害型技能也打到畫面上所有敵人
    if (sk.dmg && sk.dmg[1]) {
      var hit = 0;
      (mapState.mobs || []).forEach(function (m, i) {
        if (!m || m._dead || !(m.curHp > 0)) return;
        var d = Math.max(1, (typeof roll === 'function' ? roll(sk.dmg[0], sk.dmg[1]) : sk.dmg[0]) + (Number(sk.db) || 0));
        m.curHp -= d; hit++;
        try { if (typeof mobWake === 'function') mobWake(m); } catch (e) {}
        if (m.curHp <= 0 && typeof killMob === 'function') killMob(i);
      });
      if (hit) { try { renderMobs(); } catch (e) {} }
    }
    // 你方全體
    var skn = sk.skn || '技能', set = (typeof MOB_PARTY_AOE_SKILLS !== 'undefined') ? MOB_PARTY_AOE_SKILLS : null;
    var had = set ? set.has(skn) : true, sk2 = sk.skn ? sk : Object.assign({}, sk, { skn: skn });
    if (set && !had) set.add(skn);
    mob.curHp = mob.hp || 1;
    if (!mob.st) mob.st = (typeof newMobStatus === 'function') ? newMobStatus() : {};
    clog('<span class="text-rose-400 font-bold">【' + esc(mob.n) + '】</span>被迷魅的頭目施放 ' + esc(skn) + '，力量不分敵我地擴散！', 'enemy');
    try { if (typeof castMobMagic === 'function') castMobMagic(mob, sk2); }
    catch (e) { console.warn('[AFK-charm] boss skill', e); }
    finally { if (set && !had) set.delete(skn); }
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var bossSkillTick = function (sm) {
    var mob = sm._afkMob; if (!mob) return;
    var cd = mob._magCd || (mob._magCd = {});
    MAGK.forEach(function (mk) {
      var sk = mob[mk]; if (!sk || !(sk.cd > 0)) return;
      if (sk.reqAlign != null) return;
      if (cd[mk] == null) cd[mk] = sk.cd;
      if (--cd[mk] > 0) return;
      cd[mk] = sk.cd;
      if (sk.chance !== undefined && Math.random() > sk.chance) return;
      castBossSkill(sm, mob, sk);
    });
  };

  // ── 頭目反噬：每 3 分鐘 15%；15 分鐘結束時沒殺過就殺一名 ──
  var doomKill = function (sm, reason) {
    var p = P(), list = party(); if (!p || !list.length) return null;
    var v = list[Math.floor(Math.random() * list.length)];
    var nm = (sm && sm.n ? sm.n.replace(/^迷魅：/, '') : '頭目');
    if (sm && sm._afkC) sm._afkC.killed = (sm._afkC.killed || 0) + 1;
    if (v === p) {
      sys('<span class="text-red-500 font-bold">' + esc(nm) + (reason === 'end' ? ' 在迷魅消散的瞬間' : ' 掙脫了片刻的束縛，') + '奪走了你的性命！</span>你被送回村莊，迷魅也隨之解除。');
      var rift = !!S().riftRun;
      p._afkCharmDoomed = true;
      try { if (typeof killPlayer === 'function') killPlayer(); } catch (e) { console.warn('[AFK-charm] kill', e); }
      p._afkCharmDoomed = false;
      p.charmed = null; if (p.buffs) p.buffs[SK] = 0;
      if (!rift && typeof revive === 'function') { try { revive(); } catch (e) { console.warn('[AFK-charm] revive', e); } }
    } else {
      v.curHp = 0; v._downed = true; v._reviveCd = 150; v._afkCharmDoom = true;
      sys('<span class="text-red-500 font-bold">' + esc(nm) + (reason === 'end' ? ' 在迷魅消散的瞬間' : ' 掙脫了片刻的束縛，') + '殺死了' + who(v) + '！</span>這場戰鬥無法再復活牠，要回到村莊才會恢復。');
      try { if (typeof renderSquadPanel === 'function') renderSquadPanel(); } catch (e) {}
    }
    try { updateUI(); } catch (e) {}
    return v;
  };
  var endCharm = function (p, sm) {
    p.charmed = null; if (p.buffs) p.buffs[SK] = 0;
    clog('<span class="text-purple-300">' + esc(sm.n) + '</span> 的迷魅效果結束，消失了。');
  };
  var charmTick = function () {
    var p = P(); if (!p || p.dead) return;
    var sm = p.charmed; if (!sm || !sm._afkC) return;
    var c = sm._afkC;
    c.el = (Number(c.el) || 0) + 1;
    var left = CFG.durTicks - c.el;
    if (left <= 0) {
      endCharm(p, sm);
      if (c.boss && !c.killed) doomKill(sm, 'end');
      return;
    }
    sm.endTick = now() + left + 10;
    if (p.buffs) p.buffs[SK] = Math.ceil(left / 10) + 1;
    if (!c.boss || !on()) return;
    bossSkillTick(sm);
    if (p.charmed !== sm || p.dead) return;
    if (c.el % CFG.killEvery === 0 && Math.random() * 100 < CFG.killPct) doomKill(sm, 'roll');
  };

  // ── 被殺的角色不能復活 ──
  var doomed = function (a) { return !!(a && a._afkCharmDoom); };
  var inTown = function () { try { return String(mapState.current || '').indexOf('town_') === 0; } catch (e) { return false; } };
  if (typeof W.reviveMercenary === 'function') {
    var oRM = W.reviveMercenary;
    W.reviveMercenary = function (slotN) {
      var p = P(), a = p && (p.allies || []).find(function (x) { return x && String(x._slot) === String(slotN); });
      if (doomed(a) && !inTown()) { sys('<span class="text-slate-400">' + esc(a._allyName || '傭兵') + ' 被頭目奪走了性命，這場戰鬥無法復活；回到村莊就會恢復。</span>'); return; }
      return oRM.apply(this, arguments);
    };
  }
  if (typeof W.tryAutoReviveMercScroll === 'function') {
    var oTAR = W.tryAutoReviveMercScroll;
    W.tryAutoReviveMercScroll = function (a) { if (doomed(a) && !inTown()) return false; return oTAR.apply(this, arguments); };
  }
  if (typeof W._reviveAllyDone === 'function') {
    var oRAD = W._reviveAllyDone;
    W._reviveAllyDone = function (a) { if (doomed(a) && !inTown()) return; return oRAD.apply(this, arguments); };
  }
  if (typeof W.reviveDownedMercsAtTown === 'function') {
    var oRDT = W.reviveDownedMercsAtTown;
    W.reviveDownedMercsAtTown = function () {
      try { var p = P(); (p && p.allies || []).forEach(function (a) { if (a) delete a._afkCharmDoom; }); } catch (e) {}
      return oRDT.apply(this, arguments);
    };
  }
  if (typeof W.reviveInPlace === 'function') {
    var oRIP = W.reviveInPlace;
    W.reviveInPlace = function () { var p = P(); if (p && p._afkCharmDoomed) return; return oRIP.apply(this, arguments); };
  }

  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = now();
      try { return oTick.apply(this, arguments); }
      finally {
        try {
          if (now() !== t0) charmTick();
          var p = P();
          if (p && inTown()) (p.allies || []).forEach(function (a) { if (a && a._afkCharmDoom) { delete a._afkCharmDoom; } });
          if (p && !inTown()) (p.allies || []).forEach(function (a) { if (a && a._afkCharmDoom && !a._downed) { a.curHp = 0; a._downed = true; a._reviveCd = 150; } });
        } catch (e) { console.warn('[AFK-charm] tick', e); }
      }
    };
  }

  W.__afkCharm = { CFG: CFG, on: on, ruleOn: ruleOn, charmValue: charmValue, rateFor: rateFor, rollCharm: rollCharm, reqLv: reqLv, cast: cast, doomKill: doomKill, charmTick: charmTick, splash: splash, castBossSkill: castBossSkill, snapMob: snapMob };
  console.log('[AFK-charm] 迷魅術改版已啟用（所有職業可學、頭目 5%、15 分鐘）');
})();
