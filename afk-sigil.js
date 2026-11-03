/* ============================================================================
 * afk-sigil.js — 聖紋 第二版（玩家 2026-11-02 13:10 定案；設計稿 docs/mio-sigil-design.md 第四版；外掛開關 sigil；經典模式沒有）
 *
 *   借鑑《死神》聖文字「一個字母一種力量」的概念：26 個字母，各配一個首字母相同的單字和一種特效。
 *   一、欄位：裝備視窗第二頁「項鍊」的位置（聖紋欄位），只能裝一個；不能強化、沒有升階；不需要轉生。強度照曲線 40～70。
 *   二、取得：副本裡的怪物、靈魂石訓練所叫出來的王、靈魂石名單上的 27 隻王（在哪裡出現都算）；
 *       每個字母各自的機率在 0.0005%～0.001% 之間（越強越難掉，不另外標分級），乘隊伍人數（照一般掉寶規則）。
 *   三、圖示：玩家提供的 26 張花體字圖（assets/icons/items/afk_sigil_<字母>.png）。
 *   11-02 13:56：E 改成 Echo；15:20 定為「施放範圍攻擊技能時 10% 機率免 3 秒冷卻」；T 回到「面板魔法傷害」；M 寫成「吸收自身最大 MP 的 3%」。
 *   觸發時角色頭上閃一下字母圖，戰鬥日誌同一個聖紋每 5 秒最多一行（共用 afk-procfx.js）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'sigil', name: '聖紋（項鍊位置）', group: '遊戲內容', seal: true,
    desc: '副本怪物與靈魂石王掉聖紋（26 個字母各一種特效），裝在裝備視窗第二頁項鍊的位置，只能裝一個' });
  if (T && !T.enabled('sigil')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var on = function (p) { return !!(p && !p.classicMode); };
  var tk = function () { return (typeof state !== 'undefined' && state) ? (Number(state.ticks) || 0) : 0; };
  var rnd = function () { return api.roll(); };

  // [字母, 單字, 中文, 說明, 道具數值, 掉率（每次擊殺）]
  var LIST = [
    ['A', 'Arrow', '箭雨', '遠距離一般攻擊 12% 機率多射一箭（這一擊傷害 ×2）', {}, 0.00001],
    ['B', 'Blood', '血契', '造成傷害的 2% 回復 HP', {}, 0.0000075],
    ['C', 'Chain', '連鎖', '攻擊魔法 15% 機率彈到另一隻怪物，造成這一擊 50% 的傷害', {}, 0.0000075],
    ['D', 'Dread', '震懾', '攻擊 5% 機率讓一般怪物暈眩 1 秒', {}, 0.00001],
    ['E', 'Echo', '回響', '施放範圍攻擊技能時 10% 機率免 3 秒冷卻', {}, 0.0000075],
    ['F', 'Frost', '霜凍', '攻擊 10% 機率讓目標緩速 3 秒（攻擊間隔 +1 秒）', {}, 0.00001],
    ['G', 'Guard', '守護', '每 20 秒得到最大 HP 5% 的護盾（不疊加）', {}, 0.0000075],
    ['H', 'Hunt', '狩獵', '打倒怪物後 5 秒內，造成的傷害 +10%', {}, 0.00001],
    ['I', 'Iron', '鋼鐵', '受到的物理傷害 −6%', {}, 0.00001],
    ['J', 'Judgment', '裁決', '對頭目的傷害 +8%', {}, 0.0000075],
    ['K', 'Knight', '騎士', '傭兵受到的傷害 −10%；你的傷害減免 +3', { dr: 3 }, 0.0000075],
    ['L', 'Life', '生命', 'HP 自然回復量 ×1.5', {}, 0.00001],
    ['M', 'Mana', '魔力', '造成傷害時 5% 機率吸收自身最大 MP 的 3%（回復 MP）', {}, 0.00001],
    ['N', 'Night', '夜幕', '迴避成功時回復最大 HP 2%', {}, 0.00001],
    ['O', 'Oath', '誓約', '每場戰鬥第一次 HP 低於 20% 時，回復最大 HP 30%', {}, 0.000005],
    ['P', 'Pierce', '穿透', '攻擊無視目標 15% 的傷害減免', {}, 0.000005],
    ['Q', 'Quake', '震地', '一般攻擊 8% 機率對其他所有怪物造成這一擊 30% 的傷害', {}, 0.0000075],
    ['R', 'Rage', '狂怒', 'HP 每少 10%，造成的傷害 +2%（最多 +18%）', {}, 0.0000075],
    ['S', 'Swift', '疾風', '移動速度 +15%、迴避 +4', { moveSpeedPct: 15, er: 4 }, 0.00001],
    ['T', 'Thunder', '雷擊', '攻擊 8% 機率追加一道雷，造成等於面板魔法傷害的傷害', {}, 0.0000075],
    ['U', 'Undying', '不屈', '受到致命傷時保留 1 HP（每 5 分鐘一次）', {}, 0.000005],
    ['V', 'Venom', '劇毒', '攻擊 15% 機率讓目標中毒 5 秒，每秒受到這一擊 20% 的傷害', {}, 0.00001],
    ['W', 'Ward', '結界', '受到的魔法傷害 −8%', {}, 0.00001],
    ['X', 'Execute', '處決', '對 HP 低於 25% 的敵人傷害 +15%', {}, 0.000005],
    ['Y', 'Yield', '豐收', '打倒怪物時金幣 +10%、經驗 +5%', {}, 0.00001],
    ['Z', 'Zeal', '熱忱', '戰鬥中每 10 秒造成的傷害 +2%（最多 +12%），離開戰鬥歸零', {}, 0.0000075]
  ];
  var idOf = function (L) { return 'afk_sigil_' + L; };
  var BY = {};
  LIST.forEach(function (s) {
    var id = idOf(s[0]), d = DB.items[id] || (DB.items[id] = {});
    BY[id] = s;
    ['mr', 'resFire', 'resWater', 'resWind', 'resEarth', 'resNone', 'extraHit', 'mdmg', 'mhp', 'extraDmg', 'dr', 'abnormalResist', 'potionBonus', 'mmp', 'meleeDmg', 'rangedDmg', 'er', 'atkSpdPct', 'str', 'dex', 'con', 'int', 'wis', 'magicHit', 'weightCap', 'moveSpeedPct', 'rangedHit'].forEach(function (k) { delete d[k]; });   // 第一版的數值拿掉
    Object.assign(d, { n: '聖紋「' + s[0] + '」' + s[1] + '・' + s[2], type: 'acc', slot: 'sigil', req: 'all', safe: 0, p: 3000, gachaWeight: 0, noEnhance: true, c: 'text-sky-300',
      img: 'assets/icons/items/' + id + '.png', afkSigil: s[0],
      d: '刻著一個字母的聖紋。裝在聖紋欄位（裝備視窗第二頁、項鍊的位置），只能裝一個，不能強化。效果：' + s[3] + '。' }, s[4]);
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[d.n] == null) ITEM_WEIGHTS[d.n] = 0; } catch (e) {}
  });
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS.indexOf('sigil') < 0) WEIGHT_COUNT_SLOTS.push('sigil'); } catch (e) {}
  W.__afkSigilSlotOn = function (p) { return on(p) && (!T || T.enabled('sigil')); };

  var cur = function () { var p = P(), e = p && on(p) && p.eq && p.eq.sigil, s = e && BY[e.id]; return s ? s[0] : null; };
  var fire = function (L) {
    if (!X) return; var s = BY[idOf(L)]; if (!s) return;
    X.pop('sig' + L, (DB.items[idOf(L)] || {}).img, '「' + L + '」' + s[2], '#7dd3fc');
    X.note('sig' + L, '<span style="color:#7dd3fc">✠【' + s[0] + ' ' + s[2] + '】</span>' + esc(s[3]));
  };

  // ── 回響：施放範圍攻擊魔法時 10% 機率這一次不進 3 秒冷卻（玩家 2026-11-02 15:20；冷卻本身在 afk-balance1101）──
  (function () {
    var o = W.__afkAoeCdFree;
    W.__afkAoeCdFree = function (sk, x) {
      try { if (o && o(sk, x)) return true; } catch (e) {}
      try { if (x && x === P() && cur() === 'E' && rnd() < 0.10) { fire('E'); return true; } } catch (e) {}
      return false;
    };
  })();
  // ── 受到傷害的百分比：鋼鐵、結界、騎士 ──
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(), L = cur(); if (!p || !L) return 1;
    if (ent === p) { if (L === 'I' && kind === 'phys') return 0.94; if (L === 'W' && kind === 'magic') return 0.92; return 1; }
    if (L === 'K' && (p.allies || []).indexOf(ent) >= 0) return 0.9;
    return 1;
  });
  // ── 生命：HP 自然回復 ×1.5 ──
  if (typeof W._regenHP === 'function') {
    var oReg = W._regenHP;
    W._regenHP = function () { var p = P(), h0 = p ? p.hp : 0; var r = oReg.apply(this, arguments); try { if (p && cur() === 'L' && p.hp > h0) p.hp = Math.min(p.mhp, p.hp + Math.floor((p.hp - h0) * 0.5)); } catch (e) {} return r; };
    try { (0, eval)('_regenHP = window._regenHP'); } catch (e) {}
  }
  // ── 豐收：金幣、經驗 ──
  if (typeof W.dollFieldVal === 'function') {
    var oDoll = W.dollFieldVal;
    W.dollFieldVal = function (f) { var v = oDoll.apply(this, arguments); try { if (f === 'goldBonus' && cur() === 'Y') v = (Number(v) || 0) + 10; } catch (e) {} return v; };
    try { (0, eval)('dollFieldVal = window.dollFieldVal'); } catch (e) {}
  }
  if (typeof W.__afkTtmiExpMult === 'function') {
    var oExp = W.__afkTtmiExpMult;
    W.__afkTtmiExpMult = function (p) { var v = oExp.apply(this, arguments); try { if (p && p === P() && cur() === 'Y') v *= 1.05; } catch (e) {} return v; };
  }

  if (X) {
    var hunt = { until: 0 }, guard = { next: 0 }, oath = { used: false }, und = { at: -1e9 }, zeal = { start: -1 }, dots = [];
    var others = function (t) { return (mapState.mobs || []).filter(function (m) { return m && m !== t && !m._dead && m.curHp > 0; }); };
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(), L = cur(); if (!p || actor !== p || !L) return v;
      var m = 1, pk = opt.packet;
      if (L === 'A' && pk && pk.ranged && rnd() < 0.12) { m *= 2; fire('A'); }
      if (L === 'H' && tk() < hunt.until) m *= 1.10;
      if (L === 'J' && target.boss) m *= 1.08;
      if (L === 'R') m *= 1 + Math.min(0.18, Math.floor((1 - (p.hp || 0) / (p.mhp || 1)) * 10) * 0.02);
      if (L === 'X' && target.hp > 0 && target.curHp < target.hp * 0.25) m *= 1.15;
      if (L === 'Z' && zeal.start >= 0) m *= 1 + Math.min(0.12, Math.floor((tk() - zeal.start) / 100) * 0.02);
      v = v * m;
      if (L === 'P' && target.dr > 0) v += Math.floor(target.dr * 0.15);
      if (L === 'B') { var heal = Math.floor(Math.min(v, Math.max(0, target.curHp)) * 0.02); if (heal > 0) p.hp = Math.min(p.mhp, p.hp + heal); }
      if (L === 'M' && rnd() < 0.05) { p.mp = Math.min(p.mmp, (p.mp || 0) + Math.floor((p.mmp || 0) * 0.03)); fire('M'); }
      if (L === 'D' && !target.boss && target.st && rnd() < 0.05) { target.st.stun = Math.max(target.st.stun || 0, 10); fire('D'); }
      if (L === 'F' && target.st && rnd() < 0.10) { target.st.slow = Math.max(target.st.slow || 0, 30); fire('F'); }
      var base = v;
      if (L === 'C' && opt.kind === 'magic' && rnd() < 0.15) { var o = others(target); if (o.length) { X.hitMob(o[Math.floor(rnd() * o.length) % o.length], base * 0.5); fire('C'); } }
      if (L === 'Q' && pk && rnd() < 0.08) { var os = others(target); if (os.length) { os.forEach(function (x) { X.hitMob(x, base * 0.3); }); fire('Q'); } }
      if (L === 'T' && rnd() < 0.08) { var md = Math.floor(Number(p.d && p.d.magicDmg) || 0); if (md > 0) { v += md; fire('T'); } }
      if (L === 'V' && rnd() < 0.15) { dots.push({ m: target, left: 5, per: base * 0.2, next: tk() + 10 }); fire('V'); }
      return v;
    });
    X.on('kill', function () { if (cur() === 'H') hunt.until = tk() + 50; });
    X.on('evade', function () { var p = P(); if (p && cur() === 'N') { p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * 0.02)); fire('N'); } });
    X.on('death', function () {
      var p = P(); if (!p || cur() !== 'U' || tk() - und.at < 3000) return false;
      und.at = tk(); p.hp = 1; fire('U'); return true;
    });
    X.on('tick', function () {
      var p = P(), L = cur(), t = tk(), fight = X.inCombat();
      if (!fight) { oath.used = false; zeal.start = -1; }
      else if (zeal.start < 0) zeal.start = t;
      if (!p || !L || p.dead) { dots.length = 0; return; }
      if (L === 'G' && t >= guard.next) { guard.next = t + 200; if (fight) { X.shield.add(p.mhp * 0.05, Math.floor(p.mhp * 0.05)); fire('G'); } }
      if (L === 'O' && fight && !oath.used && p.hp > 0 && p.hp < p.mhp * 0.2) { oath.used = true; p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * 0.3)); fire('O'); }
      for (var i = dots.length - 1; i >= 0; i--) {
        var d = dots[i]; if (!d.m || d.m._dead || !(d.m.curHp > 0) || d.left <= 0) { dots.splice(i, 1); continue; }
        if (t >= d.next) { d.next = t + 10; d.left--; X.hitMob(d.m, d.per); }
      }
    });
  }

  // ── 掉落：副本怪物、靈魂石訓練所的王、靈魂石名單上的王；乘隊伍人數 ──
  var soulNames = null;
  var isSoulBoss = function (m) {
    if (m._afkSoul) return true;
    if (!soulNames) { soulNames = {}; try { (W.__afkSoulStone ? W.__afkSoulStone.bosses() : []).forEach(function (id) { var d = DB.mobs[id]; if (d && d.n) soulNames[d.n] = 1; }); } catch (e) {} }
    return !!(m.boss && soulNames[m.n]);
  };
  var inDungeon = function () { try { return !!(W.AFK_CARD_COMBAT && W.AFK_CARD_COMBAT.inDungeon && W.AFK_CARD_COMBAT.inDungeon()); } catch (e) { return false; } };
  var TOTAL = LIST.reduce(function (s, x) { return s + x[5]; }, 0);
  if (X) X.on('kill', function (m) {
    var p = P(); if (!on(p) || m._afkSigilRoll || m._train || m.siegeEnemy || m.pledgeEnemy) return;
    m._afkSigilRoll = true;
    if (!(inDungeon() || isSoulBoss(m))) return;
    var mult = 1; try { mult = typeof partyRewardMult === 'function' ? partyRewardMult() : 1; } catch (e) {}
    if (rnd() >= TOTAL * mult) return;
    var r = rnd() * TOTAL, s = LIST[0];
    for (var i = 0; i < LIST.length; i++) { r -= LIST[i][5]; if (r < 0) { s = LIST[i]; break; } }
    gainItem(idOf(s[0]), 1, true, true);
    sys('<span class="font-bold" style="color:#7dd3fc">✠ ' + esc(m.n) + ' 身上浮出一枚聖紋——「' + s[0] + '」' + s[1] + '・' + s[2] + '（' + esc(s[3]) + '）。</span>');
  });

  // ── 裝上、拆下收費（玩家 2026-11-03 04:25）：裝上 龍鑽 50,000＋金幣、拆下 10,000＋金幣 ──
  var fee = function (kind) { var DC = W.__afkDiaCost; return DC ? DC.COST[kind === 'on' ? 'sigilOn' : 'sigilOff'] : 0; };
  var feeMiss = function (kind) { var DC = W.__afkDiaCost, d = fee(kind); var m = DC && d ? DC.check(d) : null; return m ? (kind === 'on' ? '裝上聖紋' : '拆下聖紋') + '要' + DC.txt(d) + '：' + m + '。' : null; };
  if (typeof W.equipItem === 'function') {
    var oEqS = W.equipItem;
    W.equipItem = function (item) {
      var p = P(), d = item && DB.items[item.id];
      if (!p || !on(p) || !d || d.slot !== 'sigil' || !p.eq) return oEqS.apply(this, arguments);
      if (p.eq.sigil && p.eq.sigil.uid === item.uid) return oEqS.apply(this, arguments);
      var m = feeMiss('on'); if (m) { sys('<span class="text-amber-300">' + m + '</span>'); return; }
      var before = p.eq.sigil, r = oEqS.apply(this, arguments);
      if (p.eq.sigil && p.eq.sigil !== before) W.__afkDiaCost.pay(fee('on'));
      return r;
    };
    try { (0, eval)('equipItem = window.equipItem'); } catch (e) {}
  }
  if (typeof W.unequipItem === 'function') {
    var oUnS = W.unequipItem;
    W.unequipItem = function (slot) {
      var p = P();
      if (slot !== 'sigil' || !p || !on(p) || !p.eq || !p.eq.sigil) return oUnS.apply(this, arguments);
      var m = feeMiss('off'); if (m) { sys('<span class="text-amber-300">' + m + '</span>'); return; }
      var r = oUnS.apply(this, arguments);
      if (!p.eq.sigil) W.__afkDiaCost.pay(fee('off'));
      return r;
    };
    try { (0, eval)('unequipItem = window.unequipItem'); } catch (e) {}
  }

  var api = W.__afkSigil = { LIST: LIST, TOTAL: TOTAL, idOf: idOf, cur: cur, inDungeon: inDungeon, isSoulBoss: isSoulBoss, roll: function () { return Math.random(); } };
})();
