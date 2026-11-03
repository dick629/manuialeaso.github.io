/* ============================================================================
 * afk-guardup.js — 佐姆格：守衛強化（玩家 2026-11-02 22:15 提出，23:58 確認設計通關）
 *
 *   亞丁的佐姆格用靈魂石（哪一隻頭目的都可以）強化你的城堡護衛；六種生存能力各自 0～10 階。
 *   每階費用：從 n 階升到 n+1 階要 1 + 2n 顆（1、3、5…19），一種升滿 100 顆，六種全滿 600 顆。
 *   扣靈魂石：先扣持有數量最多的那一種，上鎖的不扣。
 *   每個角色各自記錄（player.afkGuardUp），換城、遣散都不會消失。經典模式不開放。
 *   套用：七城部隊、聖十字近衛、聖十字禁衛軍、禁衛長密令招來的近衛。
 *
 *   一、堅韌體魄：最大 HP 每階 +5%（10 階 +50%）
 *   二、鐵壁：受到的物理傷害每階 −2%（10 階 −20%）
 *   三、魔法護符：受到的魔法傷害每階 −2%（10 階 −20%）
 *   四、戰地急救：每 5 秒回復最大 HP 每階 1%（10 階 10%）；倒下時不回復
 *   五、不屈意志：受到致命傷害時留 1 HP；冷卻 65 − 5 × 階數 秒（1 階 60 秒、10 階 15 秒），每名守衛各自計算
 *   六、迅速歸隊：倒下後回來的時間每階 −2 秒（30 → 10 秒），回來時滿血
 *   禁衛軍的聖十字之盾替你擋傷害時，扣在禁衛軍身上的量吃鐵壁與魔法護符的平均減免；不屈意志發動時多出來的傷害不轉給你。
 *   禁衛軍代死（你受到致命傷害時禁衛軍代替你倒下）不會被不屈意志擋掉。
 *   2026-11-03：不屈意志多兩段（player.afkGuardUp.undyStage，1～3）：
 *     第一段 不屈意志＝原本的效果；第二段 無妄意志＝效果 ×3，第三段 星途意志＝效果 ×5。
 *     「效果 ×N」＝發動頻率 ×N：冷卻 ÷N（10 階：15 秒 → 5 秒 → 3 秒；1 階：60 → 20 → 12 秒）；留下 1 HP 不變。
 *     進第二段：破空石 ×5＋解命石 ×5；進第三段：殷海薩的憎恨 ×1，而且要用完星途遠征的星門次數，或兩項基本能力已達 200（fixE）。不屈意志至少 1 階才能進段。
 *     2026-11-03 21:57 改：「星途遠征」條件＝目前世界的星門次數用完（喬斯達「我只能為你開啟 N 次星門」：一般 50／瘋狂席琳 80／席琳夢域鏡 110，
 *       已開啟＝該世界喝過的星辰藥水 afkStar.pts[世界]）；原本是 afkStar.clears ≥ 1。殷海薩的憎恨照舊（二轉決戰必掉一次）。
 *     殷海薩的憎恨：二轉決戰（第二次轉生前的死亡女神）打倒席琳時必掉 1 個。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'guardup', name: '佐姆格守衛強化', group: '遊戲內容', seal: true,
    desc: '亞丁的佐姆格用靈魂石強化城堡護衛：堅韌體魄、鐵壁、魔法護符、戰地急救、不屈意志、迅速歸隊，各 10 階' });
  var on = function () { var p = P(); return (!T || T.enabled('guardup')) && !!(p && !p.classicMode); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h) { try { if (!(typeof state !== 'undefined' && state && state.ff) && typeof logCombat === 'function') logCombat(h, 'magic', 'summon'); } catch (e) {} };

  var MAX = 10, NPC = 'npc_zomg';
  var ABIL = [
    { k: 'hp', n: '堅韌體魄', per: 5, unit: '%', d: function (l) { return '最大 HP +' + (5 * l) + '%'; } },
    { k: 'phys', n: '鐵壁', per: 2, d: function (l) { return '受到的物理傷害 −' + (2 * l) + '%'; } },
    { k: 'magic', n: '魔法護符', per: 2, d: function (l) { return '受到的魔法傷害 −' + (2 * l) + '%'; } },
    { k: 'heal', n: '戰地急救', per: 1, d: function (l) { return '每 5 秒回復最大 HP ' + l + '%'; } },
    { k: 'undying', n: '不屈意志', d: function (l, st) { return '受到致命傷害時留下 1 HP（冷卻 ' + undyCdS(l, st) + ' 秒）'; } },
    { k: 'rally', n: '迅速歸隊', d: function (l) { return '倒下後 ' + rallySec(l) + ' 秒回來（滿血）'; } }
  ];
  var undyCd = function (l) { return 65 - 5 * l; };
  // 不屈意志的三段：效果 ×1／×3／×5（冷卻 ÷N）
  var STAGE = [null, { n: '不屈意志', k: 1 }, { n: '無妄意志', k: 3, cost: [['afk_void_stone', 5], ['afk_fate_unlock', 5]] }, { n: '星途意志', k: 5, cost: [['afk_einhasad_hate', 1]], star: true }];
  var HATE = 'afk_einhasad_hate';
  var stageOf = function (p) { p = p || P(); if (!p || !on()) return 1; var v = Math.floor(Number(p.afkGuardUp && p.afkGuardUp.undyStage) || 1); return Math.max(1, Math.min(3, v)); };
  var undyCdS = function (l, st) { var k = STAGE[st || stageOf()].k; return Math.round(undyCd(l) / k * 10) / 10; };
  var rallySec = function (l) { return 30 - 2 * l; };
  var costOf = function (lv) { return 1 + 2 * lv; };   // 從 lv 升到 lv+1
  var store = function (p) {
    p = p || P(); if (!p) return null;
    if (!p.afkGuardUp || typeof p.afkGuardUp !== 'object') p.afkGuardUp = {};
    ABIL.forEach(function (a) { var v = Math.floor(Number(p.afkGuardUp[a.k]) || 0); p.afkGuardUp[a.k] = Math.max(0, Math.min(MAX, v)); });
    p.afkGuardUp.undyStage = Math.max(1, Math.min(3, Math.floor(Number(p.afkGuardUp.undyStage) || 1)));
    return p.afkGuardUp;
  };
  var lvOf = function (k) { if (!on()) return 0; var s = store(); return s ? s[k] || 0 : 0; };

  // ── 靈魂石：任何一種都可以，先扣最多的那種 ──
  var isStone = function (id) { var d = id && DB.items[id]; return !!(d && d.eff === 'afk_soulstone' && d.soulBoss && !d.soulLegacy); };
  var stoneCounts = function () {
    var p = P(), o = {}; if (!p) return o;
    (p.inv || []).forEach(function (it) { if (it && !it.lock && isStone(it.id)) o[it.id] = (o[it.id] || 0) + Math.max(1, Math.floor(Number(it.cnt) || 1)); });
    return o;
  };
  var stoneTotal = function () { var o = stoneCounts(); return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); };
  var takeStones = function (n) {
    var p = P(); if (!p || stoneTotal() < n) return false;
    var used = {};
    while (n > 0) {
      var o = stoneCounts(), best = null;
      Object.keys(o).forEach(function (id) { if (!best || o[id] > o[best]) best = id; });
      if (!best) return false;
      for (var j = p.inv.length - 1; j >= 0; j--) {
        var it = p.inv[j]; if (!it || it.id !== best || it.lock) continue;
        it.cnt = Math.max(1, Math.floor(Number(it.cnt) || 1)) - 1; if (it.cnt <= 0) p.inv.splice(j, 1);
        used[best] = (used[best] || 0) + 1; n--; break;
      }
    }
    return used;
  };
  var upgrade = function (k) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (!on()) return { ok: false, msg: p.classicMode ? '經典模式不開放守衛強化。' : '守衛強化目前關閉。' };
    var a = ABIL.filter(function (x) { return x.k === k; })[0]; if (!a) return { ok: false, msg: '沒有這項能力。' };
    var s = store(p), lv = s[k];
    if (lv >= MAX) return { ok: false, msg: a.n + '已經是 ' + MAX + ' 階（最高）。' };
    var c = costOf(lv);
    if (stoneTotal() < c) return { ok: false, msg: '靈魂石不夠：升 ' + (lv + 1) + ' 階要 ' + c + ' 顆（目前 ' + stoneTotal() + ' 顆，上鎖的不算）。' };
    var used = takeStones(c); if (!used) return { ok: false, msg: '靈魂石不夠。' };
    s[k] = lv + 1;
    try { if (typeof castleGuardSync === 'function') castleGuardSync(true); } catch (e) {}
    try { saveGame(); } catch (e) {}
    var what = Object.keys(used).map(function (id) { return esc((DB.items[id] || {}).n || id) + ' ×' + used[id]; }).join('、');
    var msg = '佐姆格把靈魂石熔進護衛的盔甲：' + a.n + ' 升到 ' + (lv + 1) + ' 階（' + a.d(lv + 1) + '）。用掉 ' + what + '。';
    sys('<span class="text-amber-300 font-bold">' + msg + '</span>');
    return { ok: true, msg: msg, lv: lv + 1 };
  };

  // ── 不屈意志進段 ──
  var bagCnt = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (a, i) { return a + (i && i.id === id && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  var bagTake = function (id, n) { var p = P(); for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), u = Math.min(c, n); n -= u; if (c - u <= 0) p.inv.splice(j, 1); else it.cnt = c - u; } };
  var nmOf = function (id) { return (DB.items[id] && DB.items[id].n) || id; };
  // 星途遠征的星門次數：目前世界已開啟／上限（喬斯達「我只能為你開啟 N 次星門」）
  var starInfo = function (p) { var SR = W.__afkStarRoad; try { if (!SR || !SR.store || !SR.worldOf || !SR.CFG) return null; var w = SR.worldOf(p), cap = Number(SR.CFG.cap[w]) || 0; return { used: Number(SR.store(p).pts[w]) || 0, cap: cap }; } catch (e) { return null; } };
  // 2026-11-03 fixE：兩項基本能力已到 200（星辰藥水不再掉、星門開不出藥水）也算打通星途
  var statsMax = function (p) { var SR = W.__afkStarRoad; try { return !!(SR && SR.noDrop && SR.noDrop(p || P())); } catch (e) { return false; } };
  var starDone = function (p) { var s = starInfo(p); return !!(s && s.cap > 0 && s.used >= s.cap) || statsMax(p); };
  var stageWhy = function (p) {
    p = p || P(); if (!p) return '請先進入遊戲。';
    if (!on()) return p.classicMode ? '經典模式不開放守衛強化。' : '守衛強化目前關閉。';
    var st = stageOf(p), nx = STAGE[st + 1]; if (!nx) return '已經是最後一段。';
    if (!(store(p).undying >= 1)) return '不屈意志至少要 1 階。';
    if (nx.star && !starDone(p)) { var si = starInfo(p); return '要先用完星途遠征的星門次數' + (si ? '（目前 ' + si.used + '／' + si.cap + '）' : '') + '，或兩項基本能力已達 200。'; }
    var miss = nx.cost.filter(function (c) { return bagCnt(c[0]) < c[1]; }).map(function (c) { return nmOf(c[0]) + '還差 ' + (c[1] - bagCnt(c[0])); });
    return miss.length ? miss.join('、') + '。' : '';
  };
  var upStage = function () {
    var p = P(), why = stageWhy(p); if (why) return { ok: false, msg: why };
    var st = stageOf(p), nx = STAGE[st + 1];
    nx.cost.forEach(function (c) { bagTake(c[0], c[1]); });
    store(p).undyStage = st + 1;
    try { saveGame(); } catch (e) {}
    var msg = '佐姆格把' + nx.cost.map(function (c) { return nmOf(c[0]) + ' ×' + c[1]; }).join('、') + '熔進護衛的意志：不屈意志進到第 ' + (st + 1) + ' 段「' + nx.n + '」（效果 ×' + nx.k + '）。';
    sys('<span class="text-amber-300 font-bold">' + msg + '</span>');
    return { ok: true, msg: msg, stage: st + 1 };
  };
  // 殷海薩的憎恨：二轉決戰打倒席琳必掉
  if (typeof DB !== 'undefined' && DB.items && !DB.items[HATE]) DB.items[HATE] = { n: '殷海薩的憎恨', type: 'etc', p: 0, gachaWeight: 0, weight: 0, c: 'text-rose-300', noUse: true, noSell: true, img: 'assets/icons/items/失去光明的靈魂.png',
    d: '光之女神殷海薩對長女席琳的恨意，在席琳倒下的那一刻從死亡之海浮了上來，握在手裡是冰冷的光。二轉決戰打倒死亡女神 席琳時必定得到。亞丁的佐姆格用它把護衛的不屈意志推到最後一段「星途意志」。' };
  try { if (W.AFK_DEX_EXTRA) { W.AFK_DEX_EXTRA.drop('死亡女神 席琳', HATE, 100, '二轉決戰才掉', true); W.AFK_DEX_EXTRA.acq(HATE, '二轉決戰（席琳神殿，席琳夢域鏡的世界）打倒死亡女神 席琳時必掉 1 個。用途：亞丁的佐姆格把守衛強化「不屈意志」推到第三段「星途意志」。'); } } catch (e) {}
  var hookHate = function () {
    var R2 = W.__afkRebirth2; if (!R2 || typeof R2.finish !== 'function' || R2.finish.__afkHate) return;
    var oF = R2.finish;
    R2.finish = function (md, result) {
      var r = oF.apply(this, arguments);
      try { if (md === 'second' && result === 'win' && P() && DB.items[HATE]) { gainItem(HATE, 1, true, true); sys('<span class="font-bold text-rose-300">席琳倒下的地方浮起了一團冰冷的光——你得到「殷海薩的憎恨」。</span>'); } } catch (e) { console.warn('[AFK-guardup] hate', e); }
      return r;
    };
    R2.finish.__afkHate = true;
  };
  hookHate(); W.addEventListener('load', hookHate);

  // ── 一、堅韌體魄 ──
  W.__afkGuardHpMult = function () { return 1 + 0.05 * lvOf('hp'); };

  // ── 二、三：受傷減免（核心的受擊會乘 teamDmgReduceMult，期間暫時再乘一層）──
  var withReduce = function (mult, fn, self, args) {
    if (!(mult < 1)) return fn.apply(self, args);
    var had = Object.prototype.hasOwnProperty.call(W, 'teamDmgReduceMult'), t = W.teamDmgReduceMult;
    W.teamDmgReduceMult = function () { return (typeof t === 'function' ? t.apply(this, arguments) : 1) * mult; };
    try { return fn.apply(self, args); } finally { if (had) W.teamDmgReduceMult = t; else delete W.teamDmgReduceMult; }
  };
  var physMult = function () { return 1 - 0.02 * lvOf('phys'); }, magMult = function () { return 1 - 0.02 * lvOf('magic'); };
  ['enemyAttackGuard', 'applyMobMagicToGuard'].forEach(function (name, i) {
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function () { return withReduce(i === 0 ? physMult() : magMult(), o, this, arguments); };
  });
  W.__afkGuardCoverMult = function () { return 1 - 0.01 * (lvOf('phys') + lvOf('magic')); };   // 盾牌：兩項平均

  // ── 五、不屈意志（每名守衛各自冷卻）──
  W.__afkGuardUndying = function (g) {
    var l = lvOf('undying'); if (!l || !g || g._guSac) return false;
    var now = Date.now(); if (g._guUndyAt && now < g._guUndyAt) return false;
    g._guUndyAt = now + undyCdS(l) * 1000;
    clog('<span class="font-bold" style="color:#fcd34d">【' + STAGE[stageOf()].n + '】</span>' + esc(g.form) + ' 咬牙撐住了致命一擊。');
    return true;
  };
  // ── 五、六：倒下時 ──
  if (typeof W._guardDown === 'function') {
    var oDown = W._guardDown;
    W._guardDown = function (s) {
      if (!on() || !s) return oDown.apply(this, arguments);
      if (!s._guSac && W.__afkGuardUndying(s)) { s.hp = 1; s._downed = false; return; }
      var l = lvOf('rally');
      if (!l) return oDown.apply(this, arguments);
      var sec = rallySec(l);
      s.hp = 0; s._downed = true; s._diedAt = Date.now(); s._reviveAt = Date.now() + sec * 1000;
      try { if (typeof _petAnimAct === 'function') _petAnimAct(s, 'death'); } catch (e) {}
      clog('<span class="text-cyan-300">' + esc(s.form) + '</span> 倒下了，將於 ' + sec + ' 秒後自動歸隊。');
    };
    try { (0, eval)('_guardDown = window._guardDown'); } catch (e) {}
  }

  // ── 四、戰地急救：每 5 秒 ──
  if (typeof W.tick === 'function') {
    var oTick = W.tick, lastHeal = 0;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var l = lvOf('heal'), p = P(), t = (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0;
        if (l && p && t - lastHeal >= 50) {
          lastHeal = t; var any = false;
          (p.guardsV2 || []).forEach(function (g) { if (g && !g._downed && g.hp > 0 && g.hp < g.mhp) { g.hp = Math.min(g.mhp, g.hp + Math.max(1, Math.floor(g.mhp * 0.01 * l))); any = true; } });
          if (any) { try { renderGuardPanel(); } catch (e) {} }
        } else if (t < lastHeal) lastHeal = t;
      } catch (e) {}
      return r;
    };
  }

  // ── 佐姆格介面 ──
  var CSS = '#afk-gu{margin-top:12px;padding:10px;border:1px solid #6b5a3a;border-radius:10px;background:rgba(20,18,26,.92);font-size:13px;color:#d6d3d1}'
    + '#afk-gu .hd{font-weight:bold;color:#f5d28a;font-size:15px}#afk-gu .sub{font-size:12px;color:#a8a29e;margin-top:2px}'
    + '#afk-gu .row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:6px;padding:7px 8px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85)}'
    + '#afk-gu .nm{font-weight:bold;color:#fde68a}#afk-gu .lv{color:#f5d28a;font-size:12px;margin-left:4px}#afk-gu .ef{font-size:12px;color:#cbd5e1}#afk-gu .nx{font-size:11.5px;color:#94a3b8}'
    + '#afk-gu .pips{display:inline-flex;gap:2px;margin-left:6px;vertical-align:middle}#afk-gu .pips u{width:7px;height:7px;border:1px solid #f5d28a;transform:rotate(45deg);display:inline-block}#afk-gu .pips u.f{background:#f5d28a}'
    + '#afk-gu button{padding:5px 12px;border-radius:8px;font-weight:bold;border:1px solid #fcd34d;background:linear-gradient(#d97706,#92400e);color:#fffbeb;white-space:nowrap}'
    + '#afk-gu button[disabled]{border-color:#3f3a46;background:#1c1a22;color:#57534e}';
  var pips = function (l) { var h = '<span class="pips">'; for (var i = 1; i <= MAX; i++) h += '<u class="' + (i <= l ? 'f' : '') + '"></u>'; return h + '</span>'; };
  var html = function () {
    var p = P(); if (!p || !on()) return '';
    var s = store(p), have = stoneTotal();
    var h = '<div id="afk-gu"><div class="hd">守衛強化</div><div class="sub">「把靈魂石熔進盔甲裡，你的護衛就不會那麼容易倒下。哪一隻頭目的靈魂石都行。」<br>持有靈魂石 <b class="text-amber-200">' + have + '</b> 顆（上鎖的不算；先用數量最多的那一種）。強化對你所有城堡護衛有效，每個角色各自記錄。</div>';
    ABIL.forEach(function (a) {
      var l = s[a.k], c = costOf(l), und = a.k === 'undying', st = und ? stageOf(p) : 1;
      h += '<div class="row"><div><span class="nm">' + (und ? STAGE[st].n : a.n) + '</span><span class="lv">' + l + ' 階' + (und ? '・第 ' + st + ' 段' : '') + '</span>' + pips(l)
        + '<div class="ef">' + (l ? '目前：' + a.d(l) : '尚未強化') + '</div>'
        + (l < MAX ? '<div class="nx">下一階：' + a.d(l + 1) + '（靈魂石 ' + c + ' 顆）</div>' : '<div class="nx">已達最高階</div>') + '</div>'
        + '<button data-gu="' + a.k + '"' + (l < MAX && have >= c ? '' : ' disabled') + '>' + (l < MAX ? '強化' : '已滿') + '</button></div>';
      if (und) {
        var nx = STAGE[st + 1], why = stageWhy(p);
        h += '<div class="row"><div><span class="nm">意志進段</span><span class="lv">' + STAGE.slice(1).map(function (x, i) { return (i + 1 === st ? '<b>' : '') + x.n + '（×' + x.k + '）' + (i + 1 === st ? '</b>' : ''); }).join(' → ') + '</span>'
          + (nx ? '<div class="nx">下一段「' + nx.n + '」：效果 ×' + nx.k + '（' + (l ? '冷卻 ' + undyCdS(l, st + 1) + ' 秒' : '冷卻變成原本的 1／' + nx.k) + '）；需要 ' + nx.cost.map(function (c2) { return nmOf(c2[0]) + ' ×' + c2[1] + '（持有 ' + bagCnt(c2[0]) + '）'; }).join('、') + (nx.star ? (function () { var si = starInfo(P()); return '，並用完星門次數' + (si ? '（' + si.used + '／' + si.cap + '）' : '') + '，或兩項基本能力已達 200' + (starDone(P()) ? '（已達成）' : ''); })() : '') + '</div>'
            + (why ? '<div class="nx" style="color:#fca5a5">' + esc(why) + '</div>' : '') : '<div class="nx">已是最後一段</div>') + '</div>'
          + '<button data-gu-stage="1"' + (nx && !why ? '' : ' disabled') + '>' + (nx ? '進段' : '已滿') + '</button></div>';
      }
    });
    return h + '</div>';
  };
  var render = function (div) {
    if (!div || !on()) return;
    if (!document.getElementById('afk-gu-css')) { var st = document.createElement('style'); st.id = 'afk-gu-css'; st.textContent = CSS; document.head.appendChild(st); }
    var old = div.querySelector('#afk-gu'); if (old) old.remove();
    var box = document.createElement('div'); box.innerHTML = html(); var el = box.firstElementChild; if (!el) return;
    div.appendChild(el);
    el.querySelectorAll('[data-gu-stage]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var r = upStage(); if (!r.ok) sys('<span class="text-red-400">' + esc(r.msg) + '</span>'); render(div); });
    });
    el.querySelectorAll('[data-gu]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var r = upgrade(b.getAttribute('data-gu')); if (!r.ok) sys('<span class="text-red-400">' + esc(r.msg) + '</span>'); render(div); });
    });
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC) render(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-guardup]', e); }
      return r;
    };
  }
  // 佐姆格的 NPC 說明
  try { Object.keys(DB.towns || {}).forEach(function (t) { (DB.towns[t].npcs || []).forEach(function (n) { if (n.id === NPC && String(n.d).indexOf('靈魂石') < 0) n.d += '也收靈魂石，替你強化城堡護衛的生存能力。'; }); }); } catch (e) {}

  W.__afkGuardUp = { ABIL: ABIL, MAX: MAX, costOf: costOf, upgrade: upgrade, store: store, lvOf: lvOf, stoneTotal: stoneTotal, takeStones: takeStones, render: render, undyCd: undyCd, rallySec: rallySec, STAGE: STAGE, HATE: HATE, stageOf: stageOf, undyCdS: undyCdS, upStage: upStage, stageWhy: stageWhy, starDone: starDone, starInfo: starInfo, statsMax: statsMax };
})();
