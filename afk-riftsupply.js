/* ============================================================================
 * afk-riftsupply.js — 裂痕補給大幅增強（玩家 2026-11-01 23:44；外掛開關 riftsupply，預設開；經典模式不套用）
 *
 *   時空裂痕的「裂痕專用」補給（用裂痕戰勳換）：
 *   ‧1／2／3 段加速藥水（裂痕專用）、魔力藥水（裂痕專用）：效果是一般版的 2 倍，而且跟一般版分開算、可以疊加。
 *       1 段：攻擊與移動速度 +66%（一般加速 +33%）　2 段：攻擊速度 +66%（一般勇敢藥水 +33%）
 *       3 段：攻擊、移動與施法速度 +30%（一般三段加速 +15%）　魔力藥水：MP 自然恢復量 +50%（2026-11-03 23:44 改；一般魔力藥水另外照算）
 *   ‧治癒藥水（裂痕專用，1 戰勳）：恢復 5,000 HP，15 秒冷卻。
 *   ‧瞬間治癒藥水（裂痕專用，5 戰勳）：恢復最大 HP 30%，自己的 10 秒冷卻（2026-11-03 21:57 改；原本 5,000 HP、跟治癒藥水共用冷卻）。
 *   ‧魔力恢復劑（裂痕專用）：恢復 200 MP。
 *   ‧解毒藥水（裂痕專用）：清除身上所有負面狀態，並在 5 秒內免疫負面狀態。
 *   ‧治癒、魔力恢復劑、解毒各 15 秒冷卻，都不佔一般藥水的冷卻。
 *   ‧2026-11-03 新增（本檔自己定義物品 afk_rift_calm／afk_rift_bone，經 AFK_TTMI_ITEMS.addRift 放進裂痕補給清單、離場清掉）：
 *       暴走抑制劑（20 戰勳）：時空暴走「每 10 秒再 +5%」的層數歸零（從現在重新起算，仍從 5% 起跳；afk-rift2 calm），60 秒冷卻；
 *         沒有頭目在暴走時不能用（不會白白消耗）。
 *       骸之護符（15 戰勳）：60 秒內你與傭兵受到的真實傷害 −20%（包 __afkTrueCut：時空暴走、裂痕崩塌、王登場衝擊、王的殘響…）；
 *         效果中不能再用。
 *   ‧自動使用：HP 低於「藥水」設定時先喝瞬間治癒藥水、還是太低再喝治癒藥水（兩個冷卻各算）；
 *       時空暴走疊到 2 層以上（每秒 15% 以上）喝暴走抑制劑；有時空暴走或裂痕崩塌時、護符沒效果就戴骸之護符。
 *   ‧裂痕裡身上有這些藥水時自動使用：HP 低於「藥水」設定的百分比喝治癒藥水、MP 低於 30% 喝魔力恢復劑、
 *     被暈眩／冰凍／石化／麻痺／沉睡／沉默／魔法封印時喝解毒藥水；加速與魔力藥水沒有效果時自動喝。
 *   離開裂痕時這些效果一起消失（補給本身原本就會消失）。
 *   2026-11-03（子開關 riftout）：1／2／3 段加速藥水與魔力藥水（裂痕專用）離開裂痕不會消失，在一般地圖也能用，
 *     每用一次收龍之鑽石 10（＋等比例金幣，afk-diacost）；效果照裂痕裡（一般版的 2 倍、可疊加）。不會自動喝。
 *     在一般地圖喝的效果，進出裂痕都不會被清掉；在裂痕裡喝的，離開時照舊清掉。其他裂痕補給照舊只能在裂痕裡用、離場消失。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'riftsupply', name: '裂痕補給增強', group: '遊戲玩法', seal: true,
    desc: '裂痕專用的加速藥水效果 2 倍、魔力藥水 MP 自然恢復 +50%，都可跟一般版疊加；治癒藥水恢復 5000 HP、瞬間治癒藥水恢復 30% HP、魔力恢復劑 200 MP、解毒藥水清除所有負面狀態並免疫 5 秒；新增暴走抑制劑、骸之護符；裂痕裡自動使用' });
  if (T && T.register) T.register({ id: 'riftout', name: '裂痕加速與魔力藥水帶出裂痕', group: '遊戲玩法', parent: 'riftsupply', seal: true,
    desc: '裂痕專用的 1／2／3 段加速藥水與魔力藥水離開裂痕不會消失，在一般地圖每用一次收龍之鑽石 10' });
  var on = function () { return !T || (T.enabled('riftsupply') && T.enabled('ttmi-items')); };
  var outOn = function () { var p = P(); return !!(p && !p.classicMode && on() && (!T || T.enabled('riftout'))); };
  var OUT = { h1: 1, h2: 1, h3: 1, blue: 1 }, OUT_FEE = 10;   // 古物與材料工坊關掉時補給本身也停用
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var A = function () { return W.AFK_TTMI_ITEMS || null; };
  var R = function (sid) { var a = A(); try { return a && a.resolve ? a.resolve(sid) : null; } catch (e) { return null; } };
  var inRift = function () { var a = A(); try { return !!(a && a.inRift && a.inRift()); } catch (e) { return false; } };
  var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
  var say = function (h, silent) { try { if (!silent && typeof logSys === 'function' && !(state && state.ff)) logSys(h); } catch (e) {} };
  var active = function (p) { p = p || P(); return !!(p && on() && !p.classicMode && inRift()); };

  var HEAL = 5000, HEAL2_PCT = 0.30, MPV = 200, CD = 150, IMMUNE = 50;   // CD／免疫以 tick 計（0.1 秒）
  var CDS = { heal: 150, heal2: 100, mp: 150, anti: 150, calm: 600 };
  var BONE_SEC = 60, BONE_CUT = 0.20, CALM_STACKS = 2;
  var BUFF = { h1: 'afk_rift_h1', h2: 'afk_rift_h2', h3: 'afk_rift_h3', blue: 'afk_rift_blue', bone: 'afk_rift_bone' };
  var BLUE_K = 1.5;
  var K1 = 1 + 0.33 * 2, K2 = 1 + 0.33 * 2, K3 = 1 + 0.15 * 2;
  var NAMES = {}; NAMES[BUFF.h1] = '裂痕加速（1 段×2）'; NAMES[BUFF.h2] = '裂痕加速（2 段×2）'; NAMES[BUFF.h3] = '裂痕加速（3 段×2）'; NAMES[BUFF.blue] = '裂痕魔力（+50%）'; NAMES[BUFF.bone] = '骸之護符';
  if (typeof BUFF_NAMES !== 'undefined') Object.keys(NAMES).forEach(function (k) { BUFF_NAMES[k] = NAMES[k]; });
  // ── 新的裂痕補給（2026-11-03）：暴走抑制劑、骸之護符 ──
  var CALM_ID = 'afk_rift_calm', BONE_ID = 'afk_rift_bone';
  (function defineNew() {
    if (typeof DB === 'undefined' || !DB.items) return;
    var img = function (sid, fb) { var id = R(sid), d = id && DB.items[id]; return (d && d.img) || fb || ''; };
    var amulet = ''; try { var k = Object.keys(DB.items).find(function (id) { var d = DB.items[id]; return d && d.img && /護符/.test(d.n || '') && d.type === 'acc'; }); amulet = k ? DB.items[k].img : ''; } catch (e) {}
    var lim = ' 僅限時空裂痕內使用，離場後消失。';
    if (!DB.items[CALM_ID]) DB.items[CALM_ID] = { n: '暴走抑制劑（裂痕專用）', type: 'misc', req: 'all', gachaWeight: 0, p: 0, ttmiRiftOnly: true, noTrade: true, eff: 'ttmi_item', c: 'text-violet-300', img: img(12038),
      d: '把頭目時空暴走越疊越重的部分歸零（從每秒 5% 重新算起）。冷卻 60 秒；沒有頭目在暴走時用不了。' + lim };
    if (!DB.items[BONE_ID]) DB.items[BONE_ID] = { n: '骸之護符（裂痕專用）', type: 'misc', req: 'all', gachaWeight: 0, p: 0, ttmiRiftOnly: true, noTrade: true, eff: 'ttmi_item', c: 'text-violet-300', img: amulet || img(12035),
      d: '60 秒內，你與傭兵受到的真實傷害（時空暴走、裂痕崩塌等）−20%。效果還在時不能再用。' + lim };
    if (on()) { DB.items[CALM_ID].ttmiCost = 20; DB.items[BONE_ID].ttmiCost = 15; }
    var a = A(); if (a && typeof a.addRift === 'function') { a.addRift(CALM_ID); a.addRift(BONE_ID); }
  })();
  // 物品 id：用透視鏡編號換成本作 id（afk-ttmi-items 的 resolve）
  var ID = {};
  var ids = function () {
    if (ID.ok) return ID;
    var m = { heal1: 12029, heal2: 12030, h1: 12031, h2: 12032, h3: 12033, blue: 12034, mp: 12035, anti: 12038 };
    Object.keys(m).forEach(function (k) { ID[k] = R(m[k]); });
    ID.calm = CALM_ID; ID.bone = BONE_ID;
    ID.ok = !!ID.heal1; return ID;
  };
  var kindOf = function (id) { var I = ids(); for (var k in I) if (k !== 'ok' && I[k] === id) return k; return null; };

  // 冷卻：p._afkRiftCd = { heal: 到期 tick, mp: …, anti: … }
  var cdOf = function (k) { return CDS[k] || CD; };
  var cdLeft = function (p, k) { var c = p._afkRiftCd || {}; var v = (c[k] || 0) - tk(); if (v > cdOf(k)) { c[k] = 0; return 0; } return Math.max(0, v); };
  var setCd = function (p, k) { (p._afkRiftCd = p._afkRiftCd || {})[k] = tk() + cdOf(k); };
  var DEBUFF = ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'silence', 'magicseal', 'poison', 'venom', 'deadlyPoison', 'poisonDmg', 'poisonTick', 'poisonStacks',
    'burn', 'burnStacks', 'scald', 'evilAura', 'weaken', 'disease', 'blind', 'potionFrost', 'foulWater', 'slow', 'slowAtk', 'bind', 'bleed', 'bleedStacks', 'curse', 'fear', 'confuse', 'mrDown', 'acDown'];
  var HARD = ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'silence', 'magicseal'];
  var cleanse = function (p) {
    var st = p.statuses || {}, n = 0;
    DEBUFF.forEach(function (k) { if (st[k] > 0) { st[k] = 0; n++; } });
    if (PLAYER_DEBUFF_NAME_SAFE()) Object.keys(PLAYER_DEBUFF_NAME).forEach(function (k) { if (st[k] > 0) { st[k] = 0; n++; } });
    return n;
  };
  var PLAYER_DEBUFF_NAME_SAFE = function () { return typeof PLAYER_DEBUFF_NAME !== 'undefined' && PLAYER_DEBUFF_NAME; };
  var immune = function (p) { return !!(p && (p._afkRiftImmune || 0) > tk() && active(p)); };

  var consume = function (p, it) { it.cnt = (it.cnt || 1) - 1; if (it.cnt <= 0) p.inv.splice(p.inv.indexOf(it), 1); };
  var recalc = function () { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} };
  var DUR = function (id) { var d = DB.items[id]; return Number(d && d.dur) || 600; };
  // 用一份裂痕補給；回傳 true＝已使用（呼叫端不再往下走）、false＝不能用、null＝不是這支外掛管的
  var use = function (it, silent) {
    var p = P(); if (!p || !it) return null;
    var k = kindOf(it.id); if (!k) return null;
    var outside = !active(p) && OUT[k] && outOn() && !inRift();
    if (!active(p) && !outside) return null;
    if (p.dead || it.lock || !(it.cnt > 0)) return false;
    if (outside) {
      var DC = W.__afkDiaCost, miss = DC ? DC.check(OUT_FEE) : null;
      if (miss) { say('<span class="text-amber-300">在裂痕外使用要' + DC.txt(OUT_FEE) + '：' + miss + '。</span>', false); return false; }
      if (DC && !DC.pay(OUT_FEE)) { say('<span class="text-amber-300">龍之鑽石帳戶暫時無法寫入，沒有使用。</span>', false); return false; }
      p._afkRiftOut = p._afkRiftOut || {}; p._afkRiftOut[k] = 1;
    } else if (p._afkRiftOut) delete p._afkRiftOut[k];
    var d = DB.items[it.id];
    if (k === 'heal1') {
      if (cdLeft(p, 'heal') > 0) return false;
      p.hp = Math.min(p.mhp, (p.hp || 0) + HEAL); setCd(p, 'heal');
    } else if (k === 'heal2') {
      if (cdLeft(p, 'heal2') > 0) return false;
      p.hp = Math.min(p.mhp, (p.hp || 0) + Math.floor((Number(p.mhp) || 0) * HEAL2_PCT)); setCd(p, 'heal2');
    } else if (k === 'calm') {
      var R2 = W.__afkRift2, en = R2 && R2.enrage ? R2.enrage() : null;
      if (cdLeft(p, 'calm') > 0) return false;
      if (!en || !(en.pct > 0)) { say('<span class="text-amber-300">現在沒有頭目在時空暴走。</span>', silent); return false; }
      R2.calm(); setCd(p, 'calm');
    } else if (k === 'bone') {
      if (p.buffs[BUFF.bone] > 0) { say('<span class="text-amber-300">骸之護符的效果還在。</span>', silent); return false; }
      p.buffs[BUFF.bone] = BONE_SEC;
    } else if (k === 'mp') {
      if (cdLeft(p, 'mp') > 0) return false;
      p.mp = Math.min(p.mmp, (p.mp || 0) + MPV); setCd(p, 'mp');
    } else if (k === 'anti') {
      if (cdLeft(p, 'anti') > 0) return false;
      cleanse(p); p._afkRiftImmune = tk() + IMMUNE; setCd(p, 'anti');
    } else {
      p.buffs[BUFF[k]] = DUR(it.id); recalc();
    }
    consume(p, it);
    try { if (typeof renderTabs === 'function' && !silent) renderTabs(); } catch (e) {}
    say('使用了 ' + (d ? d.n : '裂痕補給') + '。', silent);
    return true;
  };

  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uidv, silent) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uidv; });
      if (it) { var r = null; try { r = use(it, silent); } catch (e) { console.warn('[AFK-riftsupply]', e); } if (r !== null) return r; }
      return oUse.apply(this, arguments);
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }

  // ── 效果：攻速、施法、移動、MP 恢復 ──
  var bf = function (p, k) { return !!(p && p.buffs && p.buffs[BUFF[k]] > 0 && (active(p) || (OUT[k] && outOn()))); };
  var anyOut = function (p) { return Object.keys(OUT).some(function (k) { return bf(p, k); }); };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (!p || !p.d || !(active(p) || anyOut(p))) return r;
        var d = p.d, a = 1, c = 1;
        if (bf(p, 'h1')) a *= K1;
        if (bf(p, 'h2')) a *= K2;
        if (bf(p, 'h3')) { a *= K3; c *= K3; }
        if (a > 1 && d.aspd) d.aspd /= a;
        if (c > 1) { if (d.castLock) d.castLock /= c; if (d.supportCastLock) d.supportCastLock /= c; }
        if (bf(p, 'blue')) d.mpR = Math.ceil((Number(d.mpR) || 0) * BLUE_K);   // 玩家 2026-11-03 23:44：改成 MP 自然恢復 +50%
      } catch (e) {}
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (typeof W.playerMoveDelayMultiplier === 'function') {
    var oMv = W.playerMoveDelayMultiplier;
    W.playerMoveDelayMultiplier = function () {
      var r = oMv.apply(this, arguments);
      try { var p = P(), m = 1; if (bf(p, 'h1')) m *= K1; if (bf(p, 'h3')) m *= K3; if (m > 1) r = r / m; } catch (e) {}
      return r;
    };
    try { (0, eval)('playerMoveDelayMultiplier = window.playerMoveDelayMultiplier'); } catch (e) {}
  }
  // 免疫負面狀態：抵抗判定一律擋下，tick 後也把新上身的負面狀態清掉
  if (typeof W.playerStatusResisted === 'function') {
    var oRes = W.playerStatusResisted;
    W.playerStatusResisted = function () { if (immune(P())) return true; return oRes.apply(this, arguments); };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }

  // 骸之護符：你與傭兵受到的真實傷害 −20%（效果掛在你身上；裂痕裡才有效）
  var boneOn = function () { var p = P(); return !!(p && p.buffs && p.buffs[BUFF.bone] > 0 && active(p)); };
  var party = function (t) { var p = P(); return !!(p && t && (t === p || (p.allies || []).indexOf(t) >= 0)); };
  var hookCut = function () {
    var o = W.__afkTrueCut; if (o && o.__afkBone) return;
    var f = function (t, dmg) {
      var v = typeof o === 'function' ? o.apply(this, arguments) : dmg;
      try { if (v > 0 && boneOn() && party(t)) v = Math.max(1, Math.floor(v * (1 - BONE_CUT))); } catch (e) {}
      return v;
    };
    f.__afkBone = true; W.__afkTrueCut = f;
  };
  hookCut();

  // ── 自動使用、離場清除 ──
  var find = function (p, k) { var id = ids()[k]; return id ? (p.inv || []).find(function (x) { return x && x.id === id && !x.lock && x.cnt > 0; }) : null; };
  var potThr = function () { try { var el = document.getElementById('set-hp-pot'); var v = el ? parseInt(el.value, 10) : NaN; return Number.isFinite(v) && v > 0 ? v : 60; } catch (e) { return 60; } };
  var auto = function () {
    var p = P(); if (!p || p.dead || !active(p)) return;
    var st = p.statuses || {};
    if (HARD.some(function (k) { return st[k] > 0; }) && cdLeft(p, 'anti') <= 0) { var a = find(p, 'anti'); if (a) use(a, true); }
    var low = function () { return p.hp / Math.max(1, p.mhp) * 100 <= potThr(); };
    if (low() && cdLeft(p, 'heal2') <= 0) { var h2 = find(p, 'heal2'); if (h2) use(h2, true); }
    if (low() && cdLeft(p, 'heal') <= 0) { var h1 = find(p, 'heal1'); if (h1) use(h1, true); }
    var R2 = W.__afkRift2, en = null; try { en = R2 && R2.enrage ? R2.enrage() : null; } catch (e) {}
    if (en && en.pct > 0 && en.stacks >= CALM_STACKS && cdLeft(p, 'calm') <= 0) { var c = find(p, 'calm'); if (c) use(c, true); }
    var wall = false; try { wall = !!(R2 && R2.rule && R2.rule() && R2.minutes() >= R2.TUNE.wallFrom); } catch (e) {}
    if (((en && en.pct > 0) || wall) && !(p.buffs[BUFF.bone] > 0)) { var b = find(p, 'bone'); if (b) use(b, true); }
    if (p.mp / Math.max(1, p.mmp) < 0.3 && cdLeft(p, 'mp') <= 0) { var m = find(p, 'mp'); if (m) use(m, true); }
    ['h1', 'h2', 'h3', 'blue'].forEach(function (k) { if (!(p.buffs[BUFF[k]] > 0)) { var b = find(p, k); if (b) use(b, true); } });
  };
  // keepOut：在裂痕外喝的（_afkRiftOut 記著）留著，只清裂痕裡喝的
  var wipe = function (p, keepOut) {
    var any = false, out = p._afkRiftOut || {};
    Object.keys(BUFF).forEach(function (k) { if (keepOut && OUT[k] && out[k] && outOn()) return; if (p.buffs && p.buffs[BUFF[k]] > 0) { p.buffs[BUFF[k]] = 0; any = true; } if (out[k]) delete out[k]; });
    delete p._afkRiftCd; delete p._afkRiftImmune;
    if (any) recalc();
  };
  // 離開裂痕不消失的補給（afk-ttmi-items 的 clearRift 問這裡）
  var keep = function (id) { var k = kindOf(id); return !!(k && OUT[k] && outOn()); };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var p = P(); if (!p) return r;
        if (!inRift() || !on()) {
          var out = p._afkRiftOut || {}, stray = Object.keys(BUFF).some(function (k) { return p.buffs && p.buffs[BUFF[k]] > 0 && !(OUT[k] && out[k] && outOn()); });
          if (p._afkRiftCd || p._afkRiftImmune || stray) wipe(p, true);
          return r;
        }
        if (immune(p)) cleanse(p);
        auto();
      } catch (e) { console.warn('[AFK-riftsupply] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 說明文字（裂痕補給清單、物品視窗讀 DB.items 的 d）──
  var texts = function () {
    var I = ids(); if (!I.ok) return;
    var outT = (!T || T.enabled('riftout')) ? ' 離開時空裂痕不會消失；在裂痕外每用一次要龍之鑽石 ' + OUT_FEE + '（＋金幣 ' + (OUT_FEE * 100000).toLocaleString() + '）。' : ' 僅限時空裂痕內使用，離場後消失。';
    var put = function (k, t, out) { var d = I[k] && DB.items[I[k]]; if (!d) return; if (d._afkRiftOrig == null) d._afkRiftOrig = d.d; d.d = on() ? t + (out ? outT : ' 僅限時空裂痕內使用，離場後消失。') : d._afkRiftOrig; };
    put('heal1', '恢復 5,000 HP，冷卻 15 秒（不佔一般藥水冷卻）。');
    put('heal2', '恢復最大 HP 的 30%，冷卻 10 秒（跟治癒藥水分開算，不佔一般藥水冷卻）。');
    put('mp', '恢復 200 MP，冷卻 15 秒。');
    put('anti', '清除身上所有負面狀態，並在 5 秒內免疫負面狀態。冷卻 15 秒。');
    put('h1', '攻擊與移動速度 +66%（一般加速的 2 倍），可以跟一般加速疊加。持續 1,800 秒。', true);
    put('h2', '攻擊速度 +66%（一般勇敢藥水的 2 倍），可以跟一般二段加速疊加。持續 600 秒。', true);
    put('h3', '攻擊、移動與施法速度 +30%（一般三段加速的 2 倍），可以跟一般三段加速疊加。持續 600 秒。', true);
    put('blue', 'MP 自然恢復量 +50%，可以跟一般魔力藥水疊加。持續 1,800 秒。', true);
  };
  texts(); W.addEventListener('load', texts);

  W.__afkRiftSupply = { use: use, ids: ids, BUFF: BUFF, CDS: CDS, HEAL2_PCT: HEAL2_PCT, BONE_SEC: BONE_SEC, BONE_CUT: BONE_CUT, CALM_STACKS: CALM_STACKS, boneOn: boneOn, K1: K1, K2: K2, K3: K3, HEAL: HEAL, MPV: MPV, CD: CD, IMMUNE: IMMUNE, cdLeft: cdLeft, immune: immune, auto: auto, wipe: wipe, NAMES: NAMES, keep: keep, OUT: OUT, OUT_FEE: OUT_FEE, outOn: outOn };
})();
