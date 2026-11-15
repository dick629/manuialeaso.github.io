/* ============================================================================
 * afk-talent4.js — 天賦「神聖衣」（Ping 2026-11-14 14:39／14:44 定案；設計稿 Projects claude/paragon5000-design.md v3）
 *
 *   開放：巔峰 1000 等。點數：巔峰 1000 等以後每 3 等 1 點，最多 334 點（2002 等拿滿）。
 *   點法跟極意、匣之一樣：六系選三系；A／B 5 顆×2 點、N1／N2 5 顆×5 點、N3 3 顆×6 點、K 15 點（一系 103 點）；
 *     三系 K 都點了才能點融會（3 點），升星 ★1／★2／★3 各 5／7／10 點；融會效果 ×1／1.2／1.5／2。
 *   效果只在「變身中」生效（任何變身卡都算，不用穿聖衣）。紀錄：player.afkTal4 = { o, n, j }。只有你自己。
 *   設計稿的數值是每一段的合計，這裡平均分到每一顆（A 六項能力 +20＝每顆 +4）。
 *   「變身卡○○效果 +x%」＝目前那張變身卡（afk-card-combat 的 ruleFor）給的那一項再多 x%。
 *   真實傷害、真實減傷跟巔峰、聖衣相加，總上限 30%。洗點 50,000 血龍鑽。
 *   20 種融會的內容設計稿沒有寫，這裡先訂（要 Ping 確認）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'talent4', name: '天賦「神聖衣」', group: '遊戲玩法', desc: '巔峰 1000 等開放的天賦：六系選三系，效果在變身中生效（任何變身卡都算）' });
  if (T && !T.enabled('talent4')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var G = function () { return W.LineageGrowth; };
  var C = function () { return W.AFK_CARD_COMBAT; };
  var now = function () { return Date.now(); };
  var OPEN_LV = 1000, PER = 3, MAXPTS = 334;   // Ping 11-15 02:15：2000 → 1000 等開放
  var pLv = function (p) { try { var g = G() && G().read(p); return g && g.paragon ? N(g.paragon.level) : 0; } catch (e) { return 0; } };
  var opened = function (p) { return !!(p && !p.classicMode && N(p.rebirth) >= 1 && pLv(p) >= OPEN_LV); };
  var morphed = function (p) { return !!(p && p.buffs && N(p.buffs.poly) > 0 && p.poly); };
  var rule = function (p) { try { var c = C(), row = c && c.active && c.active(p); return row && c.ruleFor ? c.ruleFor(row, p) : null; } catch (e) { return null; } };

  // ── 樹的資料 ──
  var SEC = [['A', 5, 2], ['B', 5, 2], ['N1', 5, 5], ['N2', 5, 5], ['N3', 3, 6], ['K', 1, 15]];
  var STAR_COST = [3, 5, 7, 10], STAR_MULT = [1, 1.2, 1.5, 2];
  var five = function (o) { return o; };
  var DIRS = {
    holyarmor: { name: '聖鎧', sub: '能力、抗性', color: '#f5e6b8', icon: 'glory', A: { st: 4 }, B: { res: 12 }, N1: { st: 6 }, N2: { res: 18 }, N3: [{ cardBase: 5 }, { cardBase: 5 }, { cardBase: 5 }], K: { morphHp: 10 }, kName: '聖鎧', kText: '變身中 HP 上限 +10%' },
    holystrike: { name: '聖擊', sub: '爆擊、傷害', color: '#ffb35c', icon: 'burst', A: { critDmg: 4 }, B: { dmg: .6 }, N1: { critDmg: 6 }, N2: { crit: .6 }, N3: [{ dmg: 2 }, { dmg: 2 }, { dmg: 1 }], K: { strikeK: 1 }, kName: '聖擊', kText: '爆擊時 20% 機率追加一次 100% 傷害' },
    starguard: { name: '星守', sub: '防守', color: '#cfe3ff', icon: 'sanct', A: { finalDR: 20 }, B: { critDef: 1 }, N1: { trueDef: .4 }, N2: { heavyDef: 1 }, N3: [{ trueDef: 1 }, { trueDef: 1 }, { trueDef: 1 }], K: { guardK: 1 }, kName: '星守', kText: 'HP 低於 30% 時，5 秒內受到的傷害 −50%（60 秒一次）' },
    divine: { name: '神威', sub: '頭目、最終頭目', color: '#ff7a6b', icon: 'end', A: { boss: 1 }, B: { trueDmg: .4 }, N1: { finalBoss: 2 }, N2: { finalBossDef: 2 }, N3: [{ trueDmg: 1 }, { trueDmg: 1 }, { trueDmg: 1 }], K: { finalCrit: 50 }, kName: '神威', kText: '對最終頭目的爆擊傷害 +50%' },
    avatar: { name: '化身', sub: '變身卡攻擊效果', color: '#7fa7ff', icon: 'zodiac', A: { cMult: 2 }, B: { cCrit: 2 }, N1: { cCd: 4 }, N2: { cSt: 4 }, N3: [{ cAtk: 4 }, { cAtk: 3 }, { cAtk: 3 }], K: { morphBurst: 20 }, kName: '化身', kText: '變身後 10 秒內造成的傷害 +20%（60 秒一次）' },
    phantom: { name: '幻體', sub: '變身卡防禦效果', color: '#7fe0c4', icon: 'soul', A: { cRes: 4 }, B: { cFdr: 4 }, N1: { morphHp: 1 }, N2: { atkSpd: 1 }, N3: [{ cDef: 4 }, { cDef: 3 }, { cDef: 3 }], K: { phantomK: 1 }, kName: '幻體', kText: '變身結束（被打斷）時無敵 3 秒（90 秒一次）' }
  };
  var ORDER = ['holyarmor', 'holystrike', 'starguard', 'divine', 'avatar', 'phantom'];
  var LABEL = {
    st: ['六項能力', ''], res: ['五屬性抗性', ''], cardBase: ['變身卡給的六項能力、抗性', '%'], morphHp: ['變身中 HP 上限', '%'],
    critDmg: ['爆擊傷害', '%'], dmg: ['造成的傷害（傷害倍率）', '%'], crit: ['爆擊率', ' 百分點'],
    finalDR: ['最終減傷', ''], critDef: ['受到的爆擊傷害', '%', true], trueDef: ['真實減傷', '%'], heavyDef: ['受到的重擊傷害', '%', true],
    boss: ['對頭目傷害', '%'], trueDmg: ['真實傷害', '%'], finalBoss: ['對最終頭目傷害', '%'], finalBossDef: ['受到最終頭目的傷害', '%', true], finalCrit: ['對最終頭目的爆擊傷害', '%'],
    cMult: ['變身卡的傷害倍率效果', '%'], cCrit: ['變身卡的爆擊率效果', '%'], cCd: ['變身卡的爆擊傷害效果', '%'], cSt: ['變身卡的六項能力效果', '%'], cAtk: ['變身卡的全部攻擊效果', '%'],
    cRes: ['變身卡的五屬性抗性效果', '%'], cFdr: ['變身卡的最終減傷效果', '%'], atkSpd: ['變身中攻擊速度', '%'], cDef: ['變身卡的全部防禦效果', '%'],
    cAll: ['變身卡的全部效果', '%'], dr: ['受到的傷害', '%', true], bossDef: ['受到頭目的傷害', '%', true]
  };
  var COMBO = {
    'holyarmor+holystrike+starguard': ['聖戰士', '造成的傷害 +5%、受到的傷害 −5%', { dmg: 5, dr: 5 }],
    'holyarmor+holystrike+divine': ['神聖裁決', '對頭目傷害 +8%', { boss: 8 }],
    'holyarmor+holystrike+avatar': ['化身之鎧', '變身卡的全部效果 +10%', { cAll: 10 }],
    'holyarmor+holystrike+phantom': ['幻甲', '爆擊傷害 +20%', { critDmg: 20 }],
    'holyarmor+starguard+divine': ['不落之城', '受到頭目的傷害 −10%', { bossDef: 10 }],
    'holyarmor+starguard+avatar': ['守護化身', '變身中 HP 上限 +10%', { morphHp: 10 }],
    'holyarmor+starguard+phantom': ['幻影壁壘', '最終減傷 +200', { finalDR: 200 }],
    'holyarmor+divine+avatar': ['神之軀', '六項能力 +30', { st: 30 }],
    'holyarmor+divine+phantom': ['神影', '五屬性抗性 +150', { res: 150 }],
    'holyarmor+avatar+phantom': ['雙生之形', '變身卡的全部效果 +15%', { cAll: 15 }],
    'holystrike+starguard+divine': ['審判之盾', '真實傷害 +2%、真實減傷 +2%', { trueDmg: 2, trueDef: 2 }],
    'holystrike+starguard+avatar': ['戰形', '造成的傷害 +5%', { dmg: 5 }],
    'holystrike+starguard+phantom': ['鏡刃', '爆擊率 +3 百分點', { crit: 3 }],
    'holystrike+divine+avatar': ['神罰化身', '對最終頭目傷害 +15%', { finalBoss: 15 }],
    'holystrike+divine+phantom': ['幻神擊', '對最終頭目的爆擊傷害 +30%', { finalCrit: 30 }],
    'holystrike+avatar+phantom': ['百變', '爆擊傷害 +30%', { critDmg: 30 }],
    'starguard+divine+avatar': ['神佑', '受到最終頭目的傷害 −10%', { finalBossDef: 10 }],
    'starguard+divine+phantom': ['星界', '真實減傷 +3%', { trueDef: 3 }],
    'starguard+avatar+phantom': ['不壞之身', '受到的傷害 −8%', { dr: 8 }],
    'divine+avatar+phantom': ['神化', '造成的傷害 +8%', { dmg: 8 }]
  };
  var comboKey = function (o) { return o.slice().sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).join('+'); };

  // ── 規則（同極意、匣之）──
  var parse = function (id) { var m = /^(\w+)\.(A|B|N1|N2|N3|K)\.(\d)$/.exec(id || ''); if (!m || !DIRS[m[1]]) return null; var s = SEC.filter(function (x) { return x[0] === m[2]; })[0]; if (+m[3] < 1 || +m[3] > s[1]) return null; return { d: m[1], s: m[2], i: +m[3], cost: s[2] }; };
  var fresh = function () { return { o: [], n: [], j: -1 }; };
  var data = function (p) { p = p || P(); if (!p) return null; var t = p.afkTal4; if (!t || typeof t !== 'object' || !Array.isArray(t.o) || !Array.isArray(t.n)) t = p.afkTal4 = fresh(); if (t.j == null) t.j = -1; return t; };
  var complete = function (t, d, s) { var n = SEC.filter(function (x) { return x[0] === s; })[0][1]; for (var i = 1; i <= n; i++) if (t.n.indexOf(d + '.' + s + '.' + i) < 0) return false; return true; };
  var spent = function (t) { var s = 0; t.n.forEach(function (id) { var x = parse(id); s += x ? x.cost : 0; }); for (var k = 0; k <= t.j; k++) s += STAR_COST[k]; return s; };
  var earned = function (p) { return opened(p) ? Math.max(0, Math.min(MAXPTS, Math.floor((pLv(p) - OPEN_LV) / PER))) : 0; };
  var canAdd = function (t, id) {
    var x = parse(id); if (!x || t.n.indexOf(id) >= 0) return false;
    var pos = t.o.indexOf(x.d);
    if (pos < 0) { if (t.o.length >= 3 || (t.o.length && !complete(t, t.o[t.o.length - 1], 'K'))) return false; }
    else if (t.o.slice(0, pos).some(function (d) { return !complete(t, d, 'K'); })) return false;
    if (x.i > 1 && t.n.indexOf(x.d + '.' + x.s + '.' + (x.i - 1)) < 0) return false;
    var pre = { N1: ['A'], N2: ['B'], N3: ['A', 'B', 'N1', 'N2'], K: ['N3'] }[x.s] || [];
    return pre.every(function (s) { return complete(t, x.d, s); });
  };
  var allK = function (t) { return t.o.length === 3 && t.o.every(function (d) { return complete(t, d, 'K'); }); };
  var nodeEff = function (id) { var x = parse(id); if (!x) return {}; var def = DIRS[x.d][x.s]; if (Array.isArray(def)) return def[x.i - 1] || {}; return def; };
  var sig = '', cache = {};
  var effAll = function (p) {
    var t = data(p); if (!t || !t.n.length) return {};
    var s = t.n.join(',') + '|' + t.j + '|' + t.o.join(','); if (s === sig) return cache;
    var e = {}; t.n.forEach(function (id) { var v = nodeEff(id); for (var k in v) e[k] = (e[k] || 0) + v[k]; });
    if (t.j >= 0 && allK(t)) { var c = COMBO[comboKey(t.o)]; if (c) { var m = STAR_MULT[t.j]; for (var k2 in c[2]) e[k2] = (e[k2] || 0) + c[2][k2] * m; } }
    sig = s; cache = e; return e;
  };
  // 實際生效：開放、你自己、變身中
  var eff = function (p) { p = p || P(); if (!p || p !== P() || !opened(p) || !morphed(p)) return {}; return effAll(p); };
  var E = function (k, p) { return N(eff(p)[k]); };

  // ── 操作 ──
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var addNode = function (id) {
    var p = P(), t = data(p); if (!p || !t) throw Error('沒有角色'); if (!opened(p)) throw Error('巔峰 1000 等開放');
    var x = parse(id); if (!x || !canAdd(t, id)) throw Error('還沒滿足前置節點'); if (spent(t) + x.cost > earned(p)) throw Error('神聖衣點數不夠');
    if (t.o.indexOf(x.d) < 0) t.o.push(x.d); t.n.push(id); sig = ''; save();
  };
  var starUp = function () { var p = P(), t = data(p); if (!allK(t)) throw Error('三系的核心都點了才能點融會'); if (t.j >= 3) throw Error('融會已經 ★3'); var c = STAR_COST[t.j + 1]; if (spent(t) + c > earned(p)) throw Error('神聖衣點數不夠（需要 ' + c + ' 點）'); t.j++; sig = ''; save(); };
  var wash = function () { var p = P(), t = data(p); if (!t.n.length && t.j < 0) throw Error('神聖衣還沒有配點'); var g = G(); if (!g) throw Error('目前不能洗點'); return g.transaction('神聖衣洗點', function () { g.spendBlood(g.WASH || 50000); p.afkTal4 = fresh(); sig = ''; }); };

  // ── 畫面（跟匣之一樣用星圖；圖示先借匣之的）──
  var fmtEff = function (e) { return Object.keys(e).map(function (k) { var L = LABEL[k]; if (!L) return ''; return L[0] + ' ' + (L[2] ? '−' : '+') + (Math.round(e[k] * 100) / 100) + L[1]; }).filter(Boolean).join('、'); };
  var nodeText = function (id) { var x = parse(id); if (!x) return ''; if (x.s === 'K') return DIRS[x.d].kName + '：' + DIRS[x.d].kText; return fmtEff(nodeEff(id)); };
  var view = { dir: 'holyarmor' };
  var T4IMG = { holyarmor: 'armor', holystrike: 'strike', starguard: 'guard', divine: 'might', avatar: 'avatar', phantom: 'phantom' };
  var ICON = function (d) { return 'assets/ui/growth-v5/tal4/tal4_icon_' + T4IMG[d] + '.webp'; };
  var BGI = function (d) { return 'assets/ui/growth-v5/tal4/tal4_bg_' + T4IMG[d] + '.webp'; };
  var xState = function (t, pts, used, op, id) { var x = parse(id); if (!x) return 'locked'; if (t.n.indexOf(id) >= 0) return 'lit'; return op && canAdd(t, id) && used + x.cost <= pts ? 'available' : 'locked'; };
  var xReason = function (st) { return st === 'lit' ? '已點亮' : st === 'available' ? '可點亮 · 點擊圓點配置' : '需先完成前置節點，或點數不夠；每系完成核心後才能選下一系（最多三系）。'; };
  var xInspect = function (id) {
    var p = P(), t = data(p); if (!p || !t) return ''; var x = parse(id); if (!x) return ''; var D = DIRS[x.d], st = xState(t, earned(p), spent(t), opened(p), id);
    return '<span class="growth-eyebrow">' + D.name + ' · ' + (x.s === 'K' ? '核心' : x.s + ' · ' + x.i) + '</span><div class="growth-insignia" style="--branch:' + D.color + '"><span class="growth-emblem" style="background-image:url(' + ICON(x.d) + ')"></span></div><h3>' + D.name + ' · ' + (x.s === 'K' ? '核心 K' : x.s + ' 節點 ' + x.i) + '</h3><p class="growth-effect">' + esc(nodeText(id)) + '</p><div class="growth-detail-cost"><span>點亮消耗</span><b>' + x.cost + ' 點</b></div><p class="growth-state ' + st + '">' + xReason(st) + '</p><div class="growth-inspect-rule">A／B 每顆 2 點、N1／N2 每顆 5 點<br>N3 每顆 6 點、核心 15 點<br>A → N1 · B → N2<br>四組全滿 → N3 → 核心<br>每系 103 點 · 三系核心後點融會<br>效果在變身中有效（任何變身卡）</div>';
  };
  var xTree = function (t, pts, used, op) {
    var V = W.LineageGrowthViews; if (!V || !V.constellation) return '';
    return V.constellation({ cmd: 'ext:t4|', dirs: ORDER.map(function (d) { return { k: d, name: DIRS[d].name, sub: DIRS[d].sub, color: DIRS[d].color, icon: ICON(d), bg: BGI(d) }; }), dir: view.dir, order: t.o,
      costs: { A: SEC[0][2], B: SEC[1][2], N1: SEC[2][2], N2: SEC[3][2], N3: SEC[4][2], K: SEC[5][2] }, state: function (id) { return xState(t, pts, used, op, id); }, desc: nodeText, inspect: xInspect, selected: view.sel,
      coreLabel: function (d) { return DIRS[d].kName + ' · 核心 ' + SEC[5][2] + ' 點'; } });
  };
  var render = function () {
    var p = P(), t = data(p); if (!p || !t) return '';
    var op = opened(p), pts = earned(p), used = spent(t);
    var h = '<div class="growth-heading"><div><span class="growth-eyebrow">HOLY CLOTH</span><h3>神聖衣</h3></div><div class="growth-balance"><b>' + Math.max(0, pts - used) + '</b><span>可用神聖衣點<small>已配置 ' + used + ' / ' + pts + '（最多 ' + MAXPTS + '）</small></span></div></div>';
    h += '<p class="t2-note">' + (op ? '巔峰 1000 等以後每 3 等得到 1 點，2002 等拿滿 334 點。效果在變身中有效（任何變身卡都算）。' + (morphed(p) ? '' : '<b>（現在沒有變身，效果不生效）</b>') : '巔峰 1000 等開放。') + '</p>';
    h += xTree(t, pts, used, op);
    var ck = t.o.length === 3 ? COMBO[comboKey(t.o)] : null;
    h += '<div class="t2-fuse"><span class="growth-eyebrow">FUSION</span><b>融會' + (ck ? '・' + esc(ck[0]) : '') + (t.j >= 0 ? ' ' + (t.j ? '★'.repeat(t.j) : '☆') : '') + '</b>';
    if (!ck) h += '<small>選滿三系後才知道是哪一種融會（六系選三共 20 種）。</small>';
    else { h += '<small>' + esc(ck[1]) + '</small><small>倍率：☆ ×1、★1 ×1.2、★2 ×1.5、★3 ×2；目前 ' + (t.j >= 0 ? '×' + STAR_MULT[t.j] : '未點') + '</small>'; var nx = t.j + 1, c2 = allK(t) && nx <= 3 && used + STAR_COST[nx] <= pts; if (nx <= 3) h += '<button type="button" class="growth-primary" data-growth="ext:t4|star|1" ' + (c2 ? '' : 'disabled') + '>' + (nx === 0 ? '點亮融會（3 點）' : '升到 ★' + nx + '（' + STAR_COST[nx] + ' 點）') + '</button>'; }
    h += '</div><div class="growth-bottom"><p class="growth-note">神聖衣的點數來自巔峰 1000 等以後的等級，跟極意、匣之分開配點、分開洗點。</p><div class="growth-actions"><button type="button" class="growth-primary" data-growth="ext:t4|wash|1">洗點（50,000 血龍鑽）</button></div></div>';
    return h;
  };
  var click = function (cmd, arg) { if (cmd === 'dir') { view.dir = arg; view.sel = arg + '.A.1'; return; } if (cmd === 'node') { view.sel = arg; var p0 = P(), t0 = data(p0); if (xState(t0, earned(p0), spent(t0), opened(p0), arg) === 'available') addNode(arg); return; } if (cmd === 'star') { starUp(); return; } if (cmd === 'wash') { if (!confirm('花 50,000 血龍鑽洗掉神聖衣目前的全部點數？\n點數會全部退還，讓你重新配一次。')) return; return wash(); } };
  (W.LineageGrowthExtraTabs = W.LineageGrowthExtraTabs || {}).t4 = { name: '神聖衣', order: 3, visible: function () { return opened(P()); }, view: render, click: click, inspect: xInspect };

  // ════════ 效果 ════════
  // 六項能力、抗性、爆擊、爆擊傷害、HP、攻速（重算之後加上去，做法同匣之）
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (!p || !p.d) return r; var e = eff(p); if (!Object.keys(e).length) return r;
        var R = rule(p) || {}, all = N(e.cAll);
        var st = N(e.st) + N(R.stat) * (N(e.cardBase) + N(e.cSt) + all) / 100;
        var res = N(e.res) + N(R.resist) * (N(e.cardBase) + N(e.cRes) + N(e.cDef) + all) / 100;
        var cr = N(e.crit) + N(R.crit) * (N(e.cCrit) + N(e.cAtk) + all) / 100;
        var cd = N(e.critDmg) + N(R.critDamage) * (N(e.cCd) + N(e.cAtk) + all) / 100;
        if (st) ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { if (typeof p.d[k] === 'number') p.d[k] += Math.round(st); });
        if (res) ['resNone', 'resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + Math.round(res); });
        if (cr) ['meleeCrit', 'rangedCrit', 'magicCrit'].forEach(function (k) { p.d[k] = N(p.d[k]) + cr; });
        if (cd) ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'].forEach(function (k) { p.d[k] = N(p.d[k]) + cd; });
        if (e.morphHp) p.mhp = Math.floor(N(p.mhp) * (1 + e.morphHp / 100));
        if (e.atkSpd) p.d.atkSpdPct = N(p.d.atkSpdPct) + e.atkSpd;
      } catch (er) {}
      return r;
    };
  }
  // 最終減傷（afk-arts 讀 AFK_CARD_COMBAT.finalDR）
  var hookFinalDR = function () {
    var c = C(); if (!c || typeof c.finalDR !== 'function' || c.__afkT4) return; var o = c.finalDR;
    c.finalDR = function (actor) { var v = N(o.apply(this, arguments)); try { if (actor === P()) { var e = eff(actor); if (Object.keys(e).length) { var R = rule(actor) || {}; v += N(e.finalDR) + N(R.finalDR) * (N(e.cFdr) + N(e.cDef) + N(e.cAll)) / 100; } } } catch (er) {} return v; };
    c.__afkT4 = true;
  };
  hookFinalDR(); W.addEventListener('load', hookFinalDR);
  // 真實傷害、真實減傷（總上限 30%）
  var hookPct = function () {
    var g = G(); if (!g || g.__afkT4Pct) return; var o = g.pct;
    g.pct = function (p, k) { var v = o.apply(this, arguments); try { if ((k === 'trueDamage' || k === 'trueDefense') && p && p === P()) { var add = k === 'trueDamage' ? E('trueDmg', p) : E('trueDef', p); if (add) v = Math.min(30, N(v) + add); } } catch (e) {} return v; };
    g.__afkT4Pct = true;
  };
  hookPct(); W.addEventListener('load', hookPct);

  var st = function (p) { return p._afkT4s || (p._afkT4s = { guardAt: 0, guardUntil: 0, burstAt: 0, burstUntil: 0, phantomAt: 0, invulnUntil: 0, was: false }); };
  var finalMob = function (m) { return !!(m && (m._afkFinal || m._afkApostle)); };
  // 造成的傷害
  var hookDamage = function () {
    var c = C(); if (!c || typeof c.damage !== 'function' || c.__afkT4Dmg) return;
    var o = c.damage;
    c.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (!(r > 0) || !p || actor !== p || !target) return r; var e = eff(p); if (!Object.keys(e).length) return r;
        var add = N(e.dmg); if (target.boss) add += N(e.boss); if (finalMob(target)) add += N(e.finalBoss);
        if (now() < st(p).burstUntil) add += N(e.morphBurst);
        if (add) r = Math.max(1, Math.floor(r * (1 + add / 100)));
        // 變身卡的傷害倍率效果（第一下的倍率）再多 x%
        var cm = N(e.cMult) + N(e.cAtk) + N(e.cAll), R = cm && rule(p);
        if (R && N(R.mult) > 1 && amount > 0 && r >= amount * N(R.mult) * .95) r = Math.floor(r * (1 + cm / 100));
      } catch (er) {}
      return r;
    };
    c.__afkT4Dmg = true;
  };
  hookDamage(); W.addEventListener('load', hookDamage);
  // 爆擊：對最終頭目的爆擊傷害、聖擊 K
  var hookEvent = function () {
    var g = G(); if (!g || g.__afkT4Ev) return; var o = g.event;
    g.event = function (name, c2) {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (!p || !c2 || c2.actor !== p) return r; var e = eff(p); if (!Object.keys(e).length) return r; var t = c2.target;
        if (name === 'beforeHit' && t && c2.critical && finalMob(t) && e.finalCrit) c2.damage *= 1 + e.finalCrit / 100;
        if (name === 'afterHit' && t && c2.critical && e.strikeK && Math.random() < .2 && g.secondaryHit && t.curHp > 0 && !t._dead) g.secondaryHit(p, t, N(c2.actualDamage || c2.damage), 'phys');
      } catch (er) {}
      return r;
    };
    g.__afkT4Ev = true;
  };
  hookEvent(); W.addEventListener('load', hookEvent);
  // 受到的傷害
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    var p = P(); if (!p || ent !== p) return 1; var e = eff(p); if (!Object.keys(e).length) return 1;
    var cut = N(e.dr); if (mob && mob.boss) cut += N(e.bossDef); if (finalMob(mob)) cut += N(e.finalBossDef);
    return Math.max(0, 1 - cut / 100);
  });
  var oCritT4 = W.__afkEnemyCritDef; W.__afkEnemyCritDef = function (ent) { var v = typeof oCritT4 === 'function' ? N(oCritT4(ent)) : 0; try { if (ent === P()) v += E('critDef', ent); } catch (e) {} return v; };
  var oHvT4 = W.__afkEnemyHeavyDef; W.__afkEnemyHeavyDef = function (ent) { var v = typeof oHvT4 === 'function' ? N(oHvT4(ent)) : 0; try { if (ent === P()) v += E('heavyDef', ent); } catch (e) {} return v; };
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkT4Taken) return; W.__afkT4Taken = true;
    W.__afkTaken = function (ent) {
      var v = o.apply(this, arguments);
      try {
        var p = P(); if (!(v > 0) || ent !== p) return v; var S = st(p);
        if (now() < S.invulnUntil) return 0;
        var e = eff(p); if (!Object.keys(e).length) return v;
        if (e.guardK) {
          if (now() < S.guardUntil) v = Math.floor(v * .5);
          else if ((N(p.hp) - v) / Math.max(1, N(p.mhp)) < .3 && now() >= S.guardAt) { S.guardAt = now() + 60000; S.guardUntil = now() + 5000; v = Math.floor(v * .5); try { logCombat('<span class="font-bold" style="color:#cfe3ff">【星守】</span>5 秒內受到的傷害 −50%。', 'heal'); } catch (er) {} }
        }
      } catch (er) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);
  // 每 0.5 秒：變身開始（化身 K）、變身結束（幻體 K）
  setInterval(function () {
    try {
      var p = P(); if (!p || p.dead || !opened(p)) return; var S = st(p), m = morphed(p), e = effAll(p);
      if (m && !S.was && e.morphBurst && now() >= S.burstAt) { S.burstAt = now() + 60000; S.burstUntil = now() + 10000; }
      if (!m && S.was && e.phantomK && now() >= S.phantomAt) { S.phantomAt = now() + 90000; S.invulnUntil = now() + 3000; try { logCombat('<span class="font-bold" style="color:#7fe0c4">【幻體】</span>變身解除，3 秒內無敵。', 'heal'); } catch (er) {} }
      if (m !== S.was) { S.was = m; try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (er) {} }
    } catch (er) {}
  }, 500);

  W.LineageTalent4 = { DIRS: DIRS, COMBO: COMBO, data: data, eff: eff, effAll: effAll, spent: spent, earned: earned, opened: opened, morphed: morphed, canAdd: canAdd, addNode: addNode, starUp: starUp, wash: wash, comboKey: comboKey, nodeText: nodeText, MAXPTS: MAXPTS };
})();
