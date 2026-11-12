/* ============================================================================
 * afk-gdrift.js — 時空裂痕新難度「GD之子的期待」的規則與新的裂痕補給（Ping 11-12 12:00／12:06／12:15／12:24；設計稿 docs/gd-rift-design.md）
 *
 *   難度本體（入口、只出頭目、60 分鐘起的曲線、沒有結算、掉落）在 afk-rift2.js；這裡是進場後的規則：
 *   ‧吃次元裂縫的規則：afk-dimrift 的 on() 會問 window.__afkGdRiftOn()。
 *   ‧保底不生效：afk-mio、afk-starcard 的保底問 window.__afkNoFloor()。
 *   ‧五屬性抗性：每 5 分鐘 −50（無屬性、火、水、風、地），沒有下限（afk-rift2 換階段時重算面板）。
 *   ‧治療降低：進場 10 分鐘起 −10%，每 10 分鐘再 −10%，最多 −80%。吸血不受影響。
 *       掛點：foulWaterHealMult（治療魔法、遺物治療）、AFK_RELIC_RUNTIME.foreignHeal 的藥水、AFK_RELIC_COMPANIONS.regenAmount 的 HP 自然恢復、
 *       js/03 團隊持續回復、afk-riftsupply 的兩種治癒藥水，都乘 window.__afkGdHealMult()。
 *   ‧傷害降低：進場 20 分鐘起 −10%，每 20 分鐘再 −10%，最多 −80%（AFK_CARD_COMBAT.damage：隊伍打怪）。
 *
 *   新的裂痕補給（所有時空裂痕都能用；離場消失；各自冷卻，不佔一般藥水冷卻）：見下面 SUP 表。
 *   自動使用：頭目時空暴走時，鐵壁藥劑、生命之泉沒效果就自動用；復活之羽帶著就在倒下時自動生效（每一場一次）。其他手動。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.enabled && !T.enabled('rift2')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (h, silent) { try { if (!silent && typeof logSys === 'function' && !S().ff) logSys(h); } catch (e) {} };
  var GD = function () { return W.__afkGdTune || {}; };
  var R2 = function () { return W.__afkRift2 || null; };
  var inRift = function () { var s = S(); return !!(s.riftRun && typeof mapState !== 'undefined' && mapState && mapState.current === 'rift_battle'); };
  var gdOn = function () { return inRift() && S()._r2Mode === 'gd'; };
  // 次元裂縫規則、保底不生效只套在能進次元裂縫的角色（Ping 11-12 17:13）
  W.__afkGdRiftOn = function () { return gdOn() && !!S()._r2GdElite; };
  W.__afkNoFloor = function () { return W.__afkGdRiftOn(); };
  var mins = function () { var r = R2(); try { return r && r.minutes ? r.minutes() : 0; } catch (e) { return 0; } };
  var step = function (m, from, every, st, max) { return m < from ? 0 : Math.min(max, st * (1 + Math.floor((m - from) / every))); };

  // ── 補給的效果計時：p._gdSup = { buf: {key: 到期 tick}, cd: {key: 到期 tick} }（離場清掉）──
  var rec = function (p) { var r = p._gdSup; if (!r || typeof r !== 'object') r = p._gdSup = { buf: {}, cd: {} }; r.buf = r.buf || {}; r.cd = r.cd || {}; return r; };
  var buf = function (k, p) { p = p || P(); if (!p || !inRift()) return false; var b = (p._gdSup && p._gdSup.buf) || {}; return (b[k] || 0) > tk(); };

  // ── 治療降低、傷害降低 ──
  var healCut = function () { if (!gdOn()) return 0; var g = GD(), c = step(mins(), g.healFrom, g.healEvery, g.healStep, g.healMax); if (!c) return 0; if (buf('holy2') || buf('purify')) return 0; if (buf('holy1')) c /= 2; return c; };
  var dmgCut = function () { if (!gdOn()) return 0; var g = GD(), c = step(mins(), g.dmgFrom, g.dmgEvery, g.dmgStep, g.dmgMax); if (!c) return 0; if (buf('will2')) return 0; if (buf('will1')) c /= 2; return c; };
  W.__afkGdHealMult = function () { return 1 - healCut(); };
  W.__afkGdCuts = function () { return { heal: healCut(), dmg: dmgCut(), res: gdOn() ? Math.floor(mins() / (GD().resEvery || 5)) * (GD().resStep || 50) : 0 }; };
  var party = function (t) { var p = P(); if (!p || !t) return false; if (t === p) return true; if ((p.allies || []).indexOf(t) >= 0) return true; try { if (typeof petsOutList === 'function' && petsOutList().indexOf(t) >= 0) return true; } catch (e) {} return false; };

  if (typeof W.foulWaterHealMult === 'function') {
    var oFw = W.foulWaterHealMult;
    W.foulWaterHealMult = function (t) { var m = oFw.apply(this, arguments); try { var c = healCut(); if (c && party(t)) m *= 1 - c; } catch (e) {} return m; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  var hookObj = function () {
    var RR = W.AFK_RELIC_RUNTIME;
    if (RR && typeof RR.foreignHeal === 'function' && !RR.foreignHeal.__gd) {
      var oF = RR.foreignHeal, f = function (actor, amount, source) { var v = oF.apply(this, arguments); try { var c = healCut(); if (c && source === 'potion' && v > 0) v = Math.max(1, Math.floor(v * (1 - c))); } catch (e) {} return v; };
      f.__gd = true; try { RR.foreignHeal = f; } catch (e) {}
    }
    var RC = W.AFK_RELIC_COMPANIONS;
    if (RC && typeof RC.regenAmount === 'function' && !RC.regenAmount.__gd) {
      var oR = RC.regenAmount, g = function (owner, value, kind) { var v = oR.apply(this, arguments); try { var c = healCut(); if (c && kind === 'hp' && v > 0) v = v * (1 - c); } catch (e) {} return v; };
      g.__gd = true; try { RC.regenAmount = g; } catch (e) {}
    }
    var C = W.AFK_CARD_COMBAT;
    if (C && typeof C.damage === 'function' && !C.damage.__gd) {
      var oD = C.damage, h = function (actor, target, amount, opt) {
        try {
          if (inRift() && actor && !actor.mobId && target && target.mobId && amount > 0) {
            var k = 1 - dmgCut(); if (buf('rage')) k *= 1 + SUP.rage.v;
            if (k !== 1) amount = Math.max(1, Math.floor(amount * k));
          }
        } catch (e) {}
        return oD.call(this, actor, target, amount, opt);
      };
      h.__gd = true; C.damage = h;
    }
  };
  hookObj(); W.addEventListener('load', hookObj);

  // ── 五屬性抗性每 5 分鐘 −50（沒有下限）──
  var RES5 = ['resNone', 'resFire', 'resWater', 'resWind', 'resEarth'];
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(); if (p && p.d && gdOn()) { var cut = W.__afkGdCuts().res; if (cut) RES5.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) - cut; }); } } catch (e) {}
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }

  // ── 新的裂痕補給 ──
  //   c＝戰勳、sec＝效果秒數、cd＝冷卻秒數、v＝數值
  var SUP = {
    iron:   { id: 'afk_rift_iron',   n: '鐵壁藥劑',   c: 150,  sec: 30, cd: 60,  v: 0.30, d: '30 秒內，你與傭兵受到的傷害 −30%。冷卻 60 秒。頭目時空暴走時會自動使用。' },
    ward:   { id: 'afk_rift_ward',   n: '時之庇護',   c: 400,  sec: 3,  cd: 120,          d: '你與傭兵無敵 3 秒（真實傷害也擋）。冷卻 120 秒。' },
    spring: { id: 'afk_rift_spring', n: '生命之泉',   c: 200,  sec: 30, cd: 60,  v: 0.03, d: '30 秒內，你與傭兵每秒回復最大 HP 的 3%。冷卻 60 秒。頭目時空暴走時會自動使用。' },
    cut:    { id: 'afk_rift_cut',    n: '裂隙斬殺符', c: 300,            cd: 30,           d: '直接擊殺目前的目標（只能對一般怪物用，不能對頭目用）。冷卻 30 秒。' },
    bcut:   { id: 'afk_rift_bcut',   n: '頭目斬殺符', c: 1000,           cd: 300, v: 0.30, w: 0.20, d: '目前的目標是頭目時：HP 30% 以下直接擊殺；30% 以上扣它最大 HP 的 20%。冷卻 300 秒。' },
    rage:   { id: 'afk_rift_rage',   n: '狂戰藥劑',   c: 250,  sec: 30, cd: 90,  v: 0.30, d: '30 秒內，你與傭兵造成的傷害 +30%。冷卻 90 秒。' },
    flow:   { id: 'afk_rift_flow',   n: '魔力洪流',   c: 150,  sec: 30, cd: 90,           d: '30 秒內施放技能不消耗 MP。冷卻 90 秒。' },
    purify: { id: 'afk_rift_purify', n: '淨化之光',   c: 300,  sec: 10, cd: 120,          d: '清除負面狀態，10 秒內免疫負面狀態；這 10 秒內「GD之子的期待」的治療降低不生效。冷卻 120 秒。' },
    glass:  { id: 'afk_rift_glass',  n: '時之沙漏',   c: 350,  sec: 30, cd: 120,          d: '頭目的時空暴走歸零，30 秒內不再累積。冷卻 120 秒。' },
    feather:{ id: 'afk_rift_feather',n: '復活之羽',   c: 800,                             d: '你倒下時，以 50% HP 原地站起來一次（帶著就會自動生效；每一場最多一次）。' },
    will1:  { id: 'afk_rift_will1',  n: '不屈戰意',   c: 1000, sec: 60, cd: 180,          d: '60 秒內，「GD之子的期待」的傷害降低減半。冷卻 180 秒。' },
    will2:  { id: 'afk_rift_will2',  n: '破界戰意',   c: 2000, sec: 60, cd: 300,          d: '60 秒內，「GD之子的期待」的傷害降低不生效。冷卻 300 秒。' },
    holy1:  { id: 'afk_rift_holy1',  n: '聖泉祝福',   c: 1000, sec: 60, cd: 180,          d: '60 秒內，「GD之子的期待」的治療降低減半。冷卻 180 秒。' },
    holy2:  { id: 'afk_rift_holy2',  n: '聖泉恩典',   c: 2000, sec: 60, cd: 300,          d: '60 秒內，「GD之子的期待」的治療降低不生效。冷卻 300 秒。' }
  };
  var ORDER = ['iron', 'ward', 'spring', 'cut', 'bcut', 'rage', 'flow', 'purify', 'glass', 'feather', 'will1', 'will2', 'holy1', 'holy2'];
  var BY_ID = {}; ORDER.forEach(function (k) { BY_ID[SUP[k].id] = k; });
  var A = function () { return W.AFK_TTMI_ITEMS || null; };
  (function define() {
    var a = A(), img = function (sid) { try { var id = a && a.resolve ? a.resolve(sid) : null, d = id && DB.items[id]; return (d && d.img) || ''; } catch (e) { return ''; } };
    var IMG = { iron: 12035, ward: 12038, spring: 12030, cut: 12038, bcut: 12038, rage: 12031, flow: 12034, purify: 12038, glass: 12033, feather: 12029, will1: 12032, will2: 12032, holy1: 12030, holy2: 12030 };
    ORDER.forEach(function (k) {
      var s = SUP[k];
      if (!DB.items[s.id]) DB.items[s.id] = { n: s.n + '（裂痕專用）', type: 'misc', req: 'all', gachaWeight: 0, p: 0, ttmiRiftOnly: true, noTrade: true, eff: 'ttmi_item', c: 'text-violet-300', img: img(IMG[k]) };
      DB.items[s.id].d = s.d + ' 僅限時空裂痕內使用，離場後消失。';
      DB.items[s.id].ttmiCost = s.c; DB.items[s.id].img = 'assets/icons/rift-supply/rift_' + k + '.webp';   // GPT 11-12 新圖
      if (a && typeof a.addRift === 'function') a.addRift(s.id);
    });
  })();
  var cdLeft = function (p, k) { var c = rec(p).cd; return Math.max(0, (c[k] || 0) - tk()); };
  var consume = function (p, it) { it.cnt = (it.cnt || 1) - 1; if (it.cnt <= 0) p.inv.splice(p.inv.indexOf(it), 1); };
  var target = function (boss) {
    var ms = (typeof mapState !== 'undefined' && mapState && mapState.mobs) || [], i = mapState.targetIdx;
    var ok = function (m) { return m && !m._dead && (m.curHp || 0) > 0 && m.race !== '建築' && !!m.boss === boss; };
    if (i >= 0 && ok(ms[i])) return i;
    for (var j = 0; j < ms.length; j++) if (ok(ms[j])) return j;
    return -1;
  };
  var finish = function (idx) { var m = mapState.mobs[idx]; m.curHp = 0; try { if (typeof W.killMob === 'function') W.killMob(idx); } catch (e) { console.warn('[AFK-gdrift] kill', e); } };
  var use = function (it, silent) {
    var p = P(), k = it && BY_ID[it.id]; if (!k || !p) return null;
    var s = SUP[k], r = rec(p), t = tk();
    if (!inRift()) { say('<span class="text-amber-300">' + s.n + '只能在時空裂痕裡使用。</span>', silent); return false; }
    if (p.dead) return false;
    if (k === 'feather') { say('<span class="text-amber-300">復活之羽帶著就會在你倒下時自動生效。</span>', silent); return false; }
    var left = cdLeft(p, k); if (left > 0) { say('<span class="text-amber-300">' + s.n + '還在冷卻（' + Math.ceil(left / 10) + ' 秒）。</span>', silent); return false; }
    if (k === 'cut' || k === 'bcut') {
      var idx = target(k === 'bcut'); if (idx < 0) { say('<span class="text-amber-300">' + (k === 'bcut' ? '目前沒有頭目可以用。' : '目前沒有一般怪物可以用（不能對頭目用）。') + '</span>', silent); return false; }
      var m = mapState.mobs[idx];
      if (k === 'cut' || (m.curHp || 0) <= (m.hp || 1) * s.v) { finish(idx); say('<span class="font-bold" style="color:#f0abfc;">✦ ' + s.n + '：' + esc(m.n) + ' 被直接斬殺了。</span>', silent); }
      else { m.curHp = Math.max(1, Math.floor((m.curHp || 0) - (m.hp || 0) * s.w)); say('<span class="font-bold" style="color:#f0abfc;">✦ ' + s.n + '：' + esc(m.n) + ' 被削去最大 HP 的 ' + Math.round(s.w * 100) + '%。</span>', silent); }
    } else if (k === 'glass') {
      var R = R2(); try { if (R && R.calm) R.calm(); } catch (e) {}
      r.buf[k] = t + s.sec * 10;
    } else if (k === 'purify') {
      try { var RS = W.__afkRiftSupply; var st = p.statuses || {}; Object.keys(st).forEach(function (x) { if (/^(stun|freeze|stone|paralyze|sleep|silence|magicseal|poison|venom|deadlyPoison|burn|scald|evilAura|weaken|disease|blind|potionFrost|foulWater|slow|slowAtk|bind|bleed|curse|fear|confuse|mrDown|acDown)$/.test(x) && st[x] > 0) st[x] = 0; }); } catch (e) {}
      p._afkRiftImmune = Math.max(p._afkRiftImmune || 0, t + s.sec * 10);   // afk-riftsupply 的「免疫負面狀態」
      r.buf[k] = t + s.sec * 10;
    } else {
      r.buf[k] = t + s.sec * 10;
    }
    if (s.cd) r.cd[k] = t + s.cd * 10;
    consume(p, it);
    try { if (typeof renderTabs === 'function' && !silent) renderTabs(); } catch (e) {}
    say('使用了 ' + DB.items[it.id].n + '。', silent);
    return true;
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uidv, silent) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uidv; });
      if (it && BY_ID[it.id]) { try { return use(it, silent); } catch (e) { console.warn('[AFK-gdrift]', e); return false; } }
      return oUse.apply(this, arguments);
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  // 鐵壁藥劑：受到的傷害 −30%；時之庇護：無敵
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { if (!party(ent)) return 1; if (buf('ward')) return 0; return buf('iron') ? 1 - SUP.iron.v : 1; });
  var hookTrue = function () {
    var o = W.__afkTrueCut; if (o && o.__gd) return;
    var f = function (t, dmg) { var v = typeof o === 'function' ? o.apply(this, arguments) : dmg; try { if (v > 0 && party(t) && buf('ward')) v = 0; } catch (e) {} return v; };
    if (o) Object.keys(o).forEach(function (k) { f[k] = o[k]; });   // 保留裡面那幾層的標記（聖衣光輝、骸之護符）
    f.__gd = true; W.__afkTrueCut = f;
  };
  hookTrue(); W.addEventListener('load', hookTrue);
  // 復活之羽：倒下時以 50% HP 站起來（每一場一次）
  if (typeof W.killPlayer === 'function') {
    var oKill = W.killPlayer;
    W.killPlayer = function () {
      try {
        var p = P(), s = S();
        if (p && inRift() && s._gdFeather !== s.riftStartMs) {
          var it = (p.inv || []).find(function (x) { return x && x.id === SUP.feather.id && !x.lock && x.cnt > 0; });
          if (it) {
            s._gdFeather = s.riftStartMs; consume(p, it);
            p.hp = Math.max(1, Math.floor((p.mhp || 1) * 0.5)); p.dead = false;
            say('<span class="font-bold" style="color:#f0abfc;">🪶 復活之羽燃燒起來——你以一半的 HP 重新站了起來。</span>');
            try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
            return;
          }
        }
      } catch (e) { console.warn('[AFK-gdrift] feather', e); }
      return oKill.apply(this, arguments);
    };
    try { (0, eval)('killPlayer = window.killPlayer'); } catch (e) {}
  }
  // 每秒：生命之泉回血、魔力洪流補滿 MP、時之沙漏壓住暴走、自動使用；離場清掉
  var find = function (p, k) { var id = SUP[k].id; return (p.inv || []).find(function (x) { return x && x.id === id && !x.lock && x.cnt > 0; }); };
  var second = function (p) {
    var R = R2(), en = null; try { en = R && R.enrage ? R.enrage() : null; } catch (e) {}
    if (en && en.pct > 0) ['iron', 'spring'].forEach(function (k) { if (!buf(k, p) && cdLeft(p, k) <= 0) { var it = find(p, k); if (it) use(it, true); } });
    if (buf('spring', p)) {
      var hm = W.__afkGdHealMult();
      [p].concat(p.allies || []).forEach(function (t) {
        if (!t || t._downed || t.dead) return; var mh = Number(t.mhp) || 0, add = Math.max(1, Math.floor(mh * SUP.spring.v * hm));
        if (t === p) p.hp = Math.min(p.mhp, (p.hp || 0) + add); else if ((t.curHp || 0) > 0) t.curHp = Math.min(mh, (t.curHp || 0) + add);
      });
    }
    if (buf('glass', p)) { try { if (en && en.pct > 0 && R.calm) R.calm(); } catch (e) {} }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var p = P(); if (!p) return r;
        if (!inRift()) { if (p._gdSup) delete p._gdSup; return r; }
        if (buf('flow', p)) p.mp = p.mmp;   // 魔力洪流：效果中 MP 一直是滿的
        if (!p.dead && tk() % 10 === 0) second(p);
      } catch (e) { console.warn('[AFK-gdrift] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 時空裂痕入口：GD之子的期待 ──
  if (typeof W.renderRiftEntrance === 'function') {
    var oRender = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oRender.apply(this, arguments);
      try {
        if (!container || typeof W.afkGdEnter !== 'function') return r;
        var p = P(), g = GD(), best = p && Number(p.afkGdBest) || 0;
        var div = document.createElement('div');
        div.className = 'rounded-lg p-3 text-sm leading-relaxed text-slate-200';
        div.style.cssText = 'background:#1a0b24cc;border:1px solid #c026d3';
        var elite = (function () { try { var D = W.__afkDimRift; return !!(D && D.canOpen && p && D.canOpen(p) === ''); } catch (e) { return false; } })();
        div.innerHTML = '<button type="button" id="afk-gd-enter" class="btn w-full py-3 text-lg font-bold text-white" style="background:#701a75;border:1px solid #f0abfc">🌀 GD之子的期待</button>'
          + '<div class="mt-2">不需要任何條件或材料。裂痕從第 ' + g.from + ' 分鐘的強度開始，之後一直變強、沒有上限，也沒有時間限制，倒下或撤離才結束。只出現頭目，從等級最低的地區霸主、首領開始。</div>'
          + '<div class="text-fuchsia-200">' + (elite ? '你能進次元裂縫：進場套用次元裂縫的規則、保底不生效，頭目掉落率 ×' + g.dropX + '。' : '你還不能進次元裂縫：不套次元裂縫的規則，掉落率維持正常。（能進次元裂縫後，這裡會變難、掉落率 ×' + g.dropX + '）') + '</div>'
          + '<div>五屬性抗性每 ' + g.resEvery + ' 分鐘 −' + g.resStep + '（沒有下限）。'
          + '進場 ' + g.healFrom + ' 分鐘起治療 −' + Math.round(g.healStep * 100) + '%、每 ' + g.healEvery + ' 分鐘再 −' + Math.round(g.healStep * 100) + '%（最多 −' + Math.round(g.healMax * 100) + '%，吸血不受影響）；'
          + g.dmgFrom + ' 分鐘起造成的傷害 −' + Math.round(g.dmgStep * 100) + '%、每 ' + g.dmgEvery + ' 分鐘再 −' + Math.round(g.dmgStep * 100) + '%（最多 −' + Math.round(g.dmgMax * 100) + '%）。</div>'
          + '<div>沒有結算獎勵，只能靠打：遺物、符文石每隻頭目判定 ' + g.rollN + ' 次；掉到的遺物有 ' + (g.p5 * 100) + '% 是 +5、' + (g.p10 * 100).toFixed(4).replace(/0+$/, '') + '% 是 +10；'
          + '另有 2★ 符文石 ' + (g.s2 * 100).toFixed(3).replace(/0+$/, '') + '%、3★ 符文石 ' + (g.s3 * 100).toFixed(4).replace(/0+$/, '') + '%、次元符文石 ' + (g.dim * 100).toFixed(5).replace(/0+$/, '') + '%（每隻頭目）。</div>'
          + '<div class="text-fuchsia-300">最久紀錄：' + (best ? Math.floor(best) + ' 分鐘' : '還沒有') + '</div>';
        (container.firstElementChild || container).appendChild(div);
        var b = div.querySelector('#afk-gd-enter'); if (b) b.onclick = function () { W.afkGdEnter(); };
      } catch (e) { console.warn('[AFK-gdrift] entrance', e); }
      return r;
    };
  }

  W.__afkGdRift = { SUP: SUP, ORDER: ORDER, use: use, healCut: healCut, dmgCut: dmgCut, buf: buf };
})();
