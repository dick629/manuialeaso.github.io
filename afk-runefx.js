/* ============================================================================
 * afk-runefx.js — 符文石與符文之語的效果（玩家 2026-10-29 晚，設計稿 docs/runes-design.md 第三版）
 *
 * 算法：
 *   ‧主手武器、8 件防具、戒指／耳環／項鍊、腰帶的孔裡的符文都算；副手、背包不算。
 *   ‧同名符文全身最多算 2 顆。
 *   ‧符文之語照孔的順序比對：武器相鄰兩孔或三孔；防具同一件的 1→2 孔；三符文之語成立時裡面的兩符文之語不另外算；
 *     同名符文之語全身最多 2 次。
 * 目前生效的：
 *   補助：穗（材料 +15%）、豐（金幣 +25%、經驗 +10%）、尋（遺物 +25%）、拾（夢域材料 +25%）——時空裂痕裡不算
 *   藥水：泉（回復 +25%）、瞬（每次 25% 不進冷卻）、逆（不受死亡藥水）、飲（三罐）；甘露、湧泉、解咒、聖域
 *   減傷：盾、罩、淨（怪物的屬性魔法）、骸（真實傷害）；壁壘、無垢
 *   寵物：鬃（寵物能力 +15%）、契（繼承 30% → 40／50%）
 *   套裝：夢、魘、魂（跟之魂疊加）、冥；夢魘、冥契、永夢、席琳的眷顧
 *   攻擊：雷（魔法二次傷害）、濺（濺射 A）、破、斬；碎陣（濺射 B）、天崩（濺射 C）、雷裂、雷霆審判、弒王、獵夢、屠龍、冥河
 * 製作中（說明上有標）：牙、裂（含「二次傷害鎖爆擊」）、八顆職業符文與指定技能、獸王、同心、專精、覺醒、極意、王道
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var RD = W.__afkRuneData;
  if (!RD) return;
  var on = function () { return !T || T.enabled('runes'); };
  var S = function () { return typeof state !== 'undefined' ? state : {}; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var KEY = {}; RD.list.forEach(function (r) { KEY[r.ch] = r; });
  var LINE_ARMOR = ['armor', 'helm', 'cloak', 'gloves', 'boots', 'shin', 'tshirt', 'shield'];
  var ARMOR = ['armor', 'shield', 'helm', 'cloak', 'gloves', 'boots', 'shin', 'tshirt'], ACC = ['ring1', 'ring2', 'ring3', 'ring4', 'ear1', 'ear2', 'amulet', 'belt'];
  var runeOf = function (id) { return id ? RD.byId[id] : null; };
  var matchSeq = function (ids, seq) {
    if (ids.length !== seq.length) return false;
    for (var i = 0; i < seq.length; i++) { var r = runeOf(ids[i]); if (!r) return false; if (seq[i] === '職' ? r.cat !== 'class' : r.ch !== seq[i]) return false; }
    return true;
  };
  // 一件裝備上成立的符文之語
  var wordsOn = function (socks, where) {
    var out = [], s = socks || [];
    if (where === 'weapon') {
      var used = {};
      if (s.length >= 3) RD.WORDS.forEach(function (w) { if (w.where === 'weapon' && w.seq.length === 3 && matchSeq(s.slice(0, 3), w.seq)) { out.push(w); used[0] = used[1] = used[2] = true; } });
      [[0, 1], [1, 2]].forEach(function (pr) {
        if (used[pr[0]] && used[pr[1]]) return;
        RD.WORDS.forEach(function (w) { if (w.where === 'weapon' && w.seq.length === 2 && s.length > pr[1] && matchSeq([s[pr[0]], s[pr[1]]], w.seq)) out.push(w); });
      });
    } else if (where === 'armor') {
      RD.WORDS.forEach(function (w) { if (w.where === 'armor' && s.length >= 2 && matchSeq([s[0], s[1]], w.seq)) out.push(w); });
    }
    return out;
  };
  var wordsOf = function (it) {
    var d = it && DB.items[it.id], kd = W.__afkRunes && W.__afkRunes.kindOf ? W.__afkRunes.kindOf(d) : null;
    return kd === 'weapon' || kd === 'armor' ? wordsOn(it.sockets, kd) : [];
  };
  // 一個角色身上的符文（每下快取）
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null, ver = 0;
  var bump = function () { ver++; };
  var stateOf = function (a) {
    if (!a || !a.eq || !on()) return { n: {}, w: {}, cls: null };
    var t = S().ticks || 0, c = cache && cache.get(a);
    if (c && c.t === t && c.v === ver) return c;
    var n = {}, w = {}, cls = null;
    var add = function (id) { var r = runeOf(id); if (!r) return; if (r.cat === 'class') { if (!cls) cls = r; return; } var k = r.nk || r.ch; n[k] = Math.min(r.unique ? 1 : 2, (n[k] || 0) + 1); };   // 傳說符文全身只算 1 顆
    var addW = function (list) { list.forEach(function (x) { w[x.id] = Math.min(2, (w[x.id] || 0) + 1); }); };
    var wp = a.eq.wpn; if (wp && Array.isArray(wp.sockets)) { wp.sockets.forEach(add); addW(wordsOn(wp.sockets, 'weapon')); }
    ARMOR.forEach(function (k) { var it = a.eq[k]; if (it && Array.isArray(it.sockets)) { it.sockets.forEach(add); addW(wordsOn(it.sockets, 'armor')); } });
    ACC.forEach(function (k) { var it = a.eq[k]; if (it && Array.isArray(it.sockets)) it.sockets.forEach(add); });
    // 三符文連線（防具、飾品）：依固定順序把孔排成一列，連續三孔照順序就成立；同名連線全身算一次
    var line = function (slots) { var out = []; slots.forEach(function (k) { var it = a.eq[k]; if (it && Array.isArray(it.sockets)) it.sockets.forEach(function (x) { out.push(x || null); }); }); return out; };
    [['armorline', line(LINE_ARMOR)], ['accline', line(ACC)]].forEach(function (pr) {
      var arr = pr[1]; if (arr.length < 3) return;
      RD.WORDS.forEach(function (wd) { if (wd.where !== pr[0] || w[wd.id]) return; for (var i = 0; i + 3 <= arr.length; i++) if (matchSeq(arr.slice(i, i + 3), wd.seq)) { w[wd.id] = 1; break; } });
    });
    c = { t: t, v: ver, n: n, w: w, cls: cls };
    if (cache) cache.set(a, c);
    return c;
  };
  var N = function (a, ch) { return stateOf(a).n[ch] || 0; };
  var Wd = function (a, id) { return stateOf(a).w[id] || 0; };
  var inRift = function () { return !!(W.__afkRift2 && W.__afkRift2.rule && W.__afkRift2.rule()); };
  var floor = Math.floor;

  // ── 減傷 ──
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    if (!ent || !ent.eq) return 1;
    var m = 1;
    var vj = 0.04 * Wd(ent, 'vajra');
    if (kind === 'magic') { m *= 1 - 0.06 * N(ent, '罩') - 0.03 * Wd(ent, 'bulwark') - vj; m *= 1 - 0.08 * N(ent, '淨') - 0.05 * Wd(ent, 'pure') - vj; }
    else m *= 1 - 0.06 * N(ent, '盾') - 0.03 * Wd(ent, 'bulwark') - vj;
    if (Wd(ent, 'soulreturn')) m *= 0.95;
    if (N(ent, '冥')) m *= 0.95;
    if (Wd(ent, 'grace')) m *= 0.95;
    return Math.max(0.05, m);
  });
  // 真實傷害（時空裂痕暴走／崩塌、最終頭目的百分比傷害…）由各處呼叫
  W.__afkTrueCut = function (ent, dmg) { if (!ent || !ent.eq || !(dmg > 0)) return dmg; var m = 1 - 0.10 * N(ent, '骸') - 0.05 * Wd(ent, 'pure') - 0.08 * Wd(ent, 'adamant'); return Math.max(1, floor(dmg * Math.max(0.5, m))); };
  W.__afkRuneImmune = function (t, k) { if (!t || !t.eq) return false; if (k === 'pot') return N(t, '逆') > 0; if (k === 'heal') return Wd(t, 'uncurse') > 0; return false; };
  W.__afkRuneHalfHeal = function (t) { return Wd(t, 'sanct') > 0 ? 0.75 : 0.5; };

  // ── 寵物 ──
  W.__afkPetInheritRate = function (r0) { var p = P(); return r0 + 0.10 * (p ? N(p, '契') : 0) + 0.05 * (p ? Wd(p, 'menagerie') : 0); };
  if (typeof W.petDerive === 'function') {
    var oDerive = W.petDerive;
    W.petDerive = function () {
      var d = oDerive.apply(this, arguments);
      try {
        var p = P(), k = p ? 0.15 * N(p, '鬃') + 0.15 * Wd(p, 'menagerie') : 0;
        if (k > 0 && d) { var s = d._afkInherit || {}; ['hit', 'flat', 'skillFlat', 'dr', 'er', 'mr'].forEach(function (f) { var own = (Number(d[f]) || 0) - (Number(s[f === 'flat' ? 'dmg' : f === 'skillFlat' ? 'mdmg' : f]) || 0); d[f] = (Number(d[f]) || 0) + floor(own * k); }); }
      } catch (e) {}
      return d;
    };
  }

  // ── 套裝 ──
  W.__afkRuneSetCut = function (p) { return N(p, '魂') > 0 ? 1 : 0; };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      bump();
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (!p) return r;
        var fx = p._sdreamFx; if (!fx) return r;
        var boost = 0.2 * Math.min(1, N(p, '夢')) + 0.1 * Math.min(1, Wd(p, 'nightmare')) + 0.15 * Math.min(1, Wd(p, 'eternal'));
        if (boost > 0) {
          Object.keys(fx.out).forEach(function (k) { fx.out[k] = 1 + (fx.out[k] - 1) * (1 + boost); });
          fx.taken = 1 - (1 - fx.taken) * (1 + boost);
          fx.leech = fx.leech * (1 + boost);
        }
        var lm = 1; if (N(p, '冥')) lm *= 1.5; if (Wd(p, 'pact')) lm *= 1.3; if (Wd(p, 'soulreturn')) lm *= 1.3; if (Wd(p, 'grace')) lm = Math.max(lm, 2);
        fx.leech *= lm;
        // 魘：夢域套裝的能力加成（固定數值）×1.5
        if (N(p, '魘') && W.__afkSherineDream) {
          var SD = W.__afkSherineDream, tiers = SD.dreamTiers(p), d = p.d;
          Object.keys(tiers).forEach(function (g) { (tiers[g] || []).forEach(function (t) { var e = SD.DREAM[g] && SD.DREAM[g][t]; if (e && e.s) Object.keys(e.s).forEach(function (k) { d[k] = (Number(d[k]) || 0) + e.s[k] * 0.5; }); }); });
        }
      } catch (e) { console.warn('[AFK-runefx] recompute', e); }
      return r;
    };
  }

  // ── 攻擊 ──
  var DRAGON = /安塔瑞斯|法利昂|巴拉卡斯|林德拜爾/;
  var C = W.AFK_CARD_COMBAT, extra = false, poCd = new WeakMap(), PO_CD = 30;
  if (C && typeof C.damage === 'function') {
    var oDmg = C.damage;
    C.damage = function (actor, target, amount, opt) {
      if (actor && actor.eq && target && amount > 0 && !extra) {
        var mult = 1;
        if (target.boss) mult *= 1 + 0.15 * Math.min(1, N(actor, '斬')) + 0.10 * Math.min(1, Wd(actor, 'regicide'));
        if (target._dream && Wd(actor, 'dreamhunt')) mult *= 1.15;
        if (DRAGON.test(String(target.n || '')) && Wd(actor, 'dragonslay')) mult *= 1.25;
        var add = N(actor, '破') ? 0.2 * (Number(target.dr) || 0) : 0;
        var bal = RD.BAL || {}; Object.keys(bal).forEach(function (k) { var c = N(actor, k); if (c && bal[k]) mult *= Math.max(0, 1 + bal[k] / 100 * c); });   // 平衡點數：每點 ±1%
        if (mult !== 1 || add) amount = floor(amount * mult + add);
      }
      var v = oDmg.call(this, actor, target, amount, opt);
      try {
        // 傳說「破」：吸收 MP＝面板的近距離／遠距離／魔法傷害 ×100%（看這一擊的種類），冷卻 3 秒
        if (v > 0 && actor && actor.eq && opt && !opt.second && (N(actor, 'po_l') || W.__afkPoForce)) {
          var kd = opt.kind === 'ranged' ? 'rangedDmg' : opt.kind === 'magic' ? 'magicDmg' : (opt.kind === 'melee' || opt.kind === 'phys') ? 'meleeDmg' : null, t0 = S().ticks || 0;
          if (kd && !(t0 < (poCd.get(actor) || -1e9))) {
            var gain = Math.max(0, floor(Number(actor.d && actor.d[kd]) || 0)), mx = Number(actor.mmp) || 0;
            if (gain > 0 && mx > 0) { poCd.set(actor, t0 + PO_CD); actor.mp = Math.min(mx, (Number(actor.mp) || 0) + gain); }
          }
        }
        // 雷：魔法二次傷害（不會爆擊）
        if (!extra && v > 0 && actor && actor.eq && opt && opt.kind === 'magic' && N(actor, '雷') && target && target.curHp > 0) {
          var ch = Wd(actor, 'thunder') ? 0.35 : 0.20;
          if (Math.random() < ch) {
            extra = true;
            var amt = floor(v * (Wd(actor, 'judgment') ? 1 : 0.5));
            var v2 = 0; try { v2 = oDmg.call(this, actor, target, amt, { kind: 'magic', second: true }); } finally { extra = false; }
            if (v2 > 0) { target.curHp -= v2; if (target.curHp <= 0) { var i = (mapState.mobs || []).indexOf(target); if (i >= 0) try { killMob(i); } catch (e) {} } }
          }
        }
      } catch (e) {}
      return v;
    };
  }
  // 濺射 A／B／C（afk-caps 的 W.__afkSplashRule）
  W.__afkSplashRule = function (actor, rc, base) {
    var b = base(actor, rc);
    if (rc >= 80) { if (b && Wd(actor, 'skyfall')) b.keep = true; return b; }
    if (Wd(actor, 'shatter')) return { pct: 0.35, keep: false };
    if (N(actor, '濺')) return { pct: 0.20, keep: false };
    return b;
  };
  // 冥河：擊殺時回復 3% 最大 HP（全隊有這個符文之語的人）
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var p = P(), m = mapState.mobs ? mapState.mobs[idx] : null, alive = !!(m && !m._dead);
      var g0 = p ? Number(p.gold) || 0 : 0, rift = inRift();
      var r = oKill.apply(this, arguments);
      try {
        if (alive && m && m._dead && p) {
          [p].concat(p.allies || []).forEach(function (a) { if (a && Wd(a, 'styx')) { if (a === p) p.hp = Math.min(p.mhp, p.hp + floor(p.mhp * 0.03)); else if (!a._downed) a.curHp = Math.min(a.mhp, (a.curHp || 0) + floor(a.mhp * 0.03)); } });
          if (!rift) { var gk = 0.25 * N(p, '豐') + 0.10 * Wd(p, 'harvest'); var dg = (Number(p.gold) || 0) - g0; if (gk && dg > 0) p.gold += floor(dg * gk); }
        }
      } catch (e) {}
      return r;
    };
  }
  if (typeof W.__afkTtmiExpMult === 'function') {
    var oExp = W.__afkTtmiExpMult;
    W.__afkTtmiExpMult = function (p) { var v = oExp.apply(this, arguments); try { if (p && !inRift()) v *= 1 + 0.10 * N(p, '豐') + 0.10 * Wd(p, 'gleaner'); } catch (e) {} return v; };
  }
  // 掉落：擊殺期間拿到的材料／遺物，依符文多給（期望值 +15%／+25%；時空裂痕裡不算）
  var DREAM_MATS = { afk_dream_dust: 1, afk_reverie_incense: 1, afk_dres_shard: 1, rem_soul: 1 };
  var isMat = function (d, id) { return d && !d.relic && (d.type === 'etc' || d.type === 'mat' || /^mat_/.test(id)) && !RD.byId[id] && !d.eff; };
  if (typeof W.gainItem === 'function') {
    var oGain = W.gainItem, depth = 0;
    W.gainItem = function (id, qty) {
      var r = oGain.apply(this, arguments);
      try {
        if (depth || inRift() || !(typeof _lootMobInfo !== 'undefined' && _lootMobInfo)) return r;
        var p = P(), d = DB.items[id]; if (!p || !d) return r;
        var k = 0;
        if (DREAM_MATS[id]) k = 0.25 * N(p, '拾') + 0.20 * Wd(p, 'gleaner');
        else if (d.relic) k = 0.25 * N(p, '尋') + 0.10 * Wd(p, 'harvest');
        else if (isMat(d, id)) k = 0.15 * N(p, '穗') + 0.10 * Wd(p, 'harvest');
        if (k > 0) { var q = Number(qty) || 1, more = floor(q * k) + (Math.random() < (q * k) % 1 ? 1 : 0); if (more > 0) { depth++; try { oGain.call(this, id, more, true, true); } finally { depth--; } } }
      } catch (e) {}
      return r;
    };
  }
  // ── 藥水（玩家自己喝的治癒藥水）──
  var HEAL_POT = function (id) { return !!id && (id.indexOf('potion_heal') >= 0 || id === 'potion_strong' || id === 'potion_ult'); };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === u; });
      if (!it || !HEAL_POT(it.id) || !on() || (p.cds && p.cds.pot > 0)) return oUse.apply(this, arguments);
      var id = it.id, h0 = p.hp, c0 = (p.inv || []).filter(function (x) { return x.id === id; }).reduce(function (n, x) { return n + (x.cnt || 1); }, 0);
      var r = oUse.apply(this, arguments);
      try {
        var gain = p.hp - h0, used = c0 - (p.inv || []).filter(function (x) { return x.id === id; }).reduce(function (n, x) { return n + (x.cnt || 1); }, 0);
        if (used > 0 && gain > 0) {
          var mult = 1 + 0.25 * N(p, '泉') + 0.25 * Wd(p, 'lifespring');
          if (N(p, '飲')) {   // 一次喝三罐：再扣 2 瓶（甘露只再扣 1 瓶），回復 ×3
            var more = Wd(p, 'nectar') ? 1 : 2, haveMore = c0 - used;
            if (haveMore >= more && W.__afkNpcKit) { W.__afkNpcKit.take(id, more); mult *= 3; }
          }
          if (mult > 1) p.hp = Math.min(p.mhp, h0 + floor(gain * mult));
          if (Wd(p, 'phoenix')) p.hp = Math.min(p.mhp, p.hp + floor(p.mhp * 0.03));
        }
        if (used > 0 && p.cds && p.cds.pot > 0) { var skip = 0.25 * N(p, '瞬') + 0.2 * Math.min(1, Wd(p, 'spring')); if (skip > 0 && Math.random() < skip) p.cds.pot = 0; }
      } catch (e) {}
      return r;
    };
  }
  W.__afkRuneFx = { bump: bump, stateOf: stateOf, wordsOf: wordsOf, wordsOn: wordsOn, N: N, Wd: Wd };
})();
