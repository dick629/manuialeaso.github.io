/* ============================================================================
 * afk-relic-newfx.js — 遺物新特效（Ping 11-15 05:23「融合進入次元遺物、舊遺物的升級系統」、05:48 確認數值；設計稿 Projects claude/awaken-transfer-relic-1115.md 第四節）
 *
 *   七種新特效（共通引擎，其他外掛用 W.__afkNewFx.add(來源) 加進來）：
 *     嫉妒 envy（命中時 X% 機率，目標 5 秒內受到的傷害 +Y%；同一隻只取最高）
 *     昏迷命中 stunHit（每 +1 ≈ 昏迷成功率 +5%；全身最多 +20）
 *     施法速度 cast（施法間隔 −X%；全身最多 −30%）
 *     信念 faith（受到攻擊時 X% 機率，3 秒內受到的傷害 −Y%；同時一層）
 *     遠距離減傷 rDR、近距離減傷 mDR（各自全身最多 −30%）
 *     猜忌 doubt（受到攻擊時 X% 機率，攻擊者 2 秒內無法攻擊，頭目 0.5 秒；同一隻 10 秒一次）
 *   舊遺物：12 件防具、飾品多一條新特效，跟著階段（本體／+5／+10／昇華支配／昇華支配 +5）變強；
 *           第二、第三詞綴繼承到這幾件的話，新特效拿本體數值的一半。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'relicnewfx', name: '遺物新特效', group: '遊戲玩法', desc: '嫉妒、昏迷命中、施法速度、信念、近／遠距離減傷、猜忌' });
  if (T && !T.enabled('relicnewfx')) return;
  var N = function (x) { return Number(x) || 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var ms = function () { return Date.now(); };
  var log = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'player-special'); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };
  var CAP = { rDR: 0.30, mDR: 0.30, cast: 0.30, stunHit: 20 };

  // ── 來源 ──
  var SRC = [];
  var add = function (fn) { if (typeof fn === 'function') SRC.push(fn); };
  var cache = new WeakMap();
  var collect = function (ent) {
    if (!ent) return null;
    var key = Math.floor(ms() / 500), c = cache.get(ent); if (c && c.k === key) return c.v;
    var v = { envyC: 0, envyP: 0, stunHit: 0, cast: 0, faithC: 0, faithP: 0, rDR: 0, mDR: 0, doubt: 0 };
    SRC.forEach(function (fn) { var list; try { list = fn(ent) || []; } catch (e) { list = []; } list.forEach(function (e) {
      if (!e) return;
      switch (e[0]) {
        case 'envy': v.envyC += N(e[1]); v.envyP = Math.max(v.envyP, N(e[2])); break;
        case 'faith': v.faithC += N(e[1]); v.faithP = Math.max(v.faithP, N(e[2])); break;
        case 'stunHit': v.stunHit += N(e[1]); break;
        case 'cast': v.cast += N(e[1]); break;
        case 'rDR': v.rDR += N(e[1]); break;
        case 'mDR': v.mDR += N(e[1]); break;
        case 'doubt': v.doubt += N(e[1]); break;
      }
    }); });
    Object.keys(CAP).forEach(function (k) { v[k] = Math.min(CAP[k], v[k]); });
    v.envyC = Math.min(1, v.envyC); v.faithC = Math.min(1, v.faithC); v.doubt = Math.min(1, v.doubt);
    cache.set(ent, { k: key, v: v }); return v;
  };
  var party = function () { var p = P(); return p ? [p].concat(GiranPartyView.combatAllies(p).filter(Boolean)) : []; };
  var inParty = function (e) { var p = P(); return !!(e && p && (e === p || (p.allies || []).indexOf(e) >= 0)); };
  var alive = function (m) { return !!(m && !m._dead && m.curHp > 0); };
  var ranged = function (m) { return !!(m && /弓|射手|弩|投擲|狙擊|槍手/.test(m.n || '')); };

  // ── 嫉妒：命中時上標記；任何人打有標記的目標 +% ──
  var hookEv = function () {
    var g = W.LineageGrowth; if (!g || typeof g.event !== 'function' || g.__afkNewFx) return; var o = g.event;
    g.event = function (name, c) {
      var r = o.apply(this, arguments);
      try {
        if (name === 'afterHit' && c && inParty(c.actor) && alive(c.target)) {
          var v = collect(c.actor); if (v && v.envyC > 0 && Math.random() < v.envyC) { var t = c.target, cur = t._afkEnvy && t._afkEnvy.u > ms() ? t._afkEnvy.p : 0; if (!cur) log(tag('嫉妒', '#4ade80') + (t.n || '') + '受到的傷害 +' + Math.round(v.envyP * 100) + '%（5 秒）。'); t._afkEnvy = { u: ms() + 5000, p: Math.max(cur, v.envyP) }; }
        }
      } catch (e) {}
      return r;
    };
    g.__afkNewFx = true;
  };
  hookEv(); W.addEventListener('load', hookEv);
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkNewFx) return; var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try { var e = target && target._afkEnvy; if (r > 0 && e && e.u > ms() && inParty(actor)) r = Math.floor(r * (1 + e.p)); } catch (er) {}
      return r;
    };
    C.__afkNewFx = true;
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // ── 受到的傷害：近／遠距離減傷、信念、猜忌 ──
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkNewFxTaken) return; W.__afkNewFxTaken = true;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = o.apply(this, arguments);
      try {
        if (!(v > 0) || !inParty(ent)) return v;
        var f = collect(ent); if (!f) return v;
        if (kind !== 'magic') { var dr = ranged(mob) ? f.rDR : f.mDR; if (dr > 0) v = v * (1 - dr); }
        if (ent._afkFaith && ent._afkFaith.u > ms()) v = v * (1 - ent._afkFaith.p);
        else if (f.faithC > 0 && Math.random() < f.faithC) { ent._afkFaith = { u: ms() + 3000, p: f.faithP }; if (ent === P()) log(tag('信念', '#fde68a') + '3 秒內受到的傷害 −' + Math.round(f.faithP * 100) + '%。'); }
        if (f.doubt > 0 && alive(mob) && !((mob._afkDoubtCd || 0) > ms()) && Math.random() < f.doubt) {
          mob._afkDoubtCd = ms() + 10000; var sec = mob.boss ? 0.5 : 2;
          mob._atkCd = Math.max(N(mob._atkCd), sec * 10);
          try { var api = W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; if (api && api.status) api.status(mob, 'attackDelay', sec, 1); } catch (e2) {}
          if (ent === P()) log(tag('猜忌', '#86efac') + (mob.n || '') + ' ' + sec + ' 秒內無法攻擊。');
        }
        v = Math.floor(v);
      } catch (e) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // ── 昏迷命中（你本人的昏迷技能、昏迷特效）──
  if (typeof W.applyMobStatus === 'function') {
    var oAms = W.applyMobStatus;
    W.applyMobStatus = function (m, st) {
      try { if (st && st.kind === 'stun' && !st.force) { var f = collect(P()); if (f && f.stunHit > 0) arguments[1] = Object.assign({}, st, { hitOff: N(st.hitOff) + f.stunHit }); } } catch (e) {}
      return oAms.apply(this, arguments);
    };
  }
  // ── 施法速度 ──
  if (typeof W.getAutoCastInterval === 'function') {
    var oAci = W.getAutoCastInterval;
    W.getAutoCastInterval = function (actor) { var v = oAci.apply(this, arguments); try { var f = collect(actor || P()); if (f && f.cast > 0 && v > 0) v = v * (1 - f.cast); } catch (e) {} return v; };
  }

  // ════════ 舊遺物：12 件多一條新特效 ════════
  //   階段：0 本體、1 +5、2 +10、3 昇華支配、4 昇華支配 +5（照 afk-relic-runtime 的 stageOf）
  var PCT = function (b) { return [b, b * 1.25, b * 1.5, b * 2.4, b * 3.5]; };
  var CH = function (b) { return [b, b * 1.2, b * 1.4, b * 1.8, b * 2.2]; };
  var OLD = {
    relic_kaira_hood: { n: '遠距離減傷', fx: function (s) { return [['rDR', PCT(0.04)[s]]]; }, t: function (s) { return '受到的遠距離傷害 −' + r1(PCT(4)[s]) + '%'; } },
    relic_guardian_riddle: { n: '遠距離減傷', fx: function (s) { return [['rDR', PCT(0.03)[s]]]; }, t: function (s) { return '受到的遠距離傷害 −' + r1(PCT(3)[s]) + '%'; } },
    relic_steel_bulwark: { n: '近距離減傷', fx: function (s) { return [['mDR', PCT(0.04)[s]]]; }, t: function (s) { return '受到的近距離傷害 −' + r1(PCT(4)[s]) + '%'; } },
    relic_high_lizard_armguard: { n: '近／遠距離減傷', fx: function (s) { return [['rDR', PCT(0.03)[s]], ['mDR', PCT(0.03)[s]]]; }, t: function (s) { return '受到的近距離、遠距離傷害各 −' + r1(PCT(3)[s]) + '%'; } },
    relic_kurt_shield: { n: '信念', fx: function (s) { return [['faith', CH(0.02)[s], [0.3, 0.3, 0.35, 0.4, 0.5][s]]]; }, t: function (s) { return '「信念」受到攻擊時 ' + r1(CH(2)[s]) + '% 機率，3 秒內受到的傷害 −' + [30, 30, 35, 40, 50][s] + '%'; } },
    relic_mud_jar: { n: '信念', fx: function (s) { return [['faith', CH(0.02)[s], [0.3, 0.3, 0.35, 0.4, 0.5][s]]]; }, t: function (s) { return '「信念」受到攻擊時 ' + r1(CH(2)[s]) + '% 機率，3 秒內受到的傷害 −' + [30, 30, 35, 40, 50][s] + '%'; } },
    relic_mage_scrap_note: { n: '施法速度', fx: function (s) { return [['cast', PCT(0.04)[s]]]; }, t: function (s) { return '施法間隔 −' + r1(PCT(4)[s]) + '%'; } },
    relic_broken_halfhelm: { n: '施法速度', fx: function (s) { return [['cast', PCT(0.03)[s]]]; }, t: function (s) { return '施法間隔 −' + r1(PCT(3)[s]) + '%'; } },
    relic_goat_demon_feet: { n: '昏迷命中', fx: function (s) { return [['stunHit', [2, 3, 3, 5, 7][s]]]; }, t: function (s) { return '昏迷命中 +' + [2, 3, 3, 5, 7][s]; } },
    relic_orc_gloves: { n: '昏迷命中', fx: function (s) { return [['stunHit', [2, 3, 3, 5, 7][s]]]; }, t: function (s) { return '昏迷命中 +' + [2, 3, 3, 5, 7][s]; } },
    relic_beagle_nose: { n: '嫉妒', fx: function (s) { return [['envy', CH(0.03)[s], PCT(0.10)[s]]]; }, t: function (s) { return '「嫉妒」攻擊命中時 ' + r1(CH(3)[s]) + '% 機率，目標 5 秒內受到的傷害 +' + r1(PCT(10)[s]) + '%'; } },
    relic_ohm_shackle: { n: '猜忌', fx: function (s) { return [['doubt', CH(0.02)[s]]]; }, t: function (s) { return '「猜忌」受到攻擊時 ' + r1(CH(2)[s]) + '% 機率，攻擊者 2 秒內無法攻擊（頭目 0.5 秒）'; } }
  };
  function r1(x) { return Math.round(x * 100) / 100; }
  var stageOf = function (d) { return d && d.relicAsc != null ? (d.relicAsc >= 5 ? 4 : 3) : d && d.relicPlus >= 10 ? 2 : d && d.relicPlus >= 5 ? 1 : 0; };
  var half = function (list) { return list.map(function (e) { var x = e.slice(); if (x[0] === 'stunHit') x[1] = Math.floor(N(x[1]) / 2); else if (x[0] === 'envy' || x[0] === 'faith') x[1] = N(x[1]) / 2; else x[1] = N(x[1]) / 2; return x; }); };
  add(function (ent) {
    var out = [], seen = {};
    Object.keys((ent && ent.eq) || {}).forEach(function (k) {
      var it = ent.eq[k], d = it && DB.items[it.id]; if (!d || it._relicVirtual) return;
      var key = d.relicBase || String(it.id).split('~')[0];
      if (OLD[key] && !seen[key]) { seen[key] = 1; out = out.concat(OLD[key].fx(stageOf(d))); }
      (d.relicInheritedEffects || []).forEach(function (x) { var ik = x && x.key; if (OLD[ik] && !seen['i' + ik]) { seen['i' + ik] = 1; out = out.concat(half(OLD[ik].fx(0))); } });
    });
    return out;
  });
  // 說明文字：遺物目錄的各階段說明後面加上新特效（小百科、物品說明都讀這份）
  try {
    var FIELDS = ['base_effect', 'plus5', 'plus10', 'ascend', 'ascend5'];
    (W.AFK_RELIC_CATALOG || []).forEach(function (c) { var o = OLD[c.key]; if (!o || c._newfx) return; c._newfx = 1; FIELDS.forEach(function (f, i) { if (c[f]) c[f] = String(c[f]).replace(/[。；\s]*$/, '') + '；' + o.t(i) + '。'; }); });
  } catch (e) {}

  W.__afkNewFx = { add: add, collect: collect, OLD: OLD, CAP: CAP };
})();
