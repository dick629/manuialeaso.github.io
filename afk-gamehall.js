/* ============================================================================
 * afk-gamehall.js — 🎰 遊戲廳（玩家 2026-11-04；外掛開關 gamehall，預設開）
 *
 *   設定分頁「🔌 外掛」列的入口整併成一個「🎰 遊戲廳」：德州撲克（afk-poker）、百家樂、沙海法老的寶庫（埃及拉霸）、
 *   賽狗場（afk-dograce）。這兩支舊外掛看到 gamehall 開著就不自己放鈕。歐瑞村莊荷官洛蒂的選單也能進百家樂／拉霸。
 *   幣別：金幣、龍之鑽石（跨角色共用）、血龍鑽；每局當下扣款、當下結算、立刻存檔（沒有「錢留在桌上」）。
 *   限額（Ping 定）：
 *     百家樂每局（所有下注格加總）：金幣 5 萬～1 億、龍鑽 10～5,000、血龍鑽 1～1,000。
 *     拉霸每轉：金幣 5 萬～500 萬、龍鑽 10～500、血龍鑽 1～50。
 *   百家樂：8 副牌、剩 16 張換靴、標準補牌表；閒 1:1、莊 1:1 抽 5%、和 1:8（押莊閒退回）、閒對／莊對 1:11。
 *   拉霸：6×5、全盤同圖 8 個以上中獎、消除連鎖、太陽圓盤倍數（×2～×500）、金字塔 4+ 進免費遊戲 15 轉（3+ 再加 5 轉、倍數累積）、
 *         單次下注最多贏 5,000 倍。目標返還率 93.5%（Ping 定）。
 *   零頭：抽佣或小賠率算出來不足 1 的部分記在 player.afkHall.frac（以 1/100 為單位），滿 1 才補發——長期跟算式一模一樣。
 *   大獎（≥ 500 倍）上世界頻道。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'gamehall', name: '遊戲廳（百家樂、沙海法老的寶庫）', group: '遊戲內容', def: true, seal: true,
    desc: '設定分頁「🔌 外掛」列的「🎰 遊戲廳」：德州撲克、百家樂、沙海法老的寶庫（埃及拉霸）、賽狗場集中在一起；用金幣、龍之鑽石或血龍鑽下注' });
  var on = function () { return !T || T.enabled('gamehall'); };
  if (typeof DB === 'undefined' || !DB.items) return;

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var el = function (id) { return document.getElementById(id); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var fmtS = function (n) {
    n = Number(n || 0);
    if (n >= 1e8) return (Math.floor(n / 1e7) / 10) + '億';
    if (n >= 1e4) return (Math.floor(n / 1e3) / 10) + '萬';
    return n.toLocaleString();
  };
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  // ════════════════ 錢 ════════════════
  var BLOOD = 'afk_blood_dia';
  var CURS = { gold: '金幣', dia: '龍之鑽石', blood: '血龍鑽' };
  var CUR_ICON = { gold: '💰', dia: '💎', blood: '🩸' };
  var LIM = {
    bac: { gold: [50000, 100000000], dia: [10, 5000], blood: [1, 1000] },
    slot: { gold: [50000, 5000000], dia: [10, 500], blood: [1, 50] },
    mary: { gold: [50000, 5000000], dia: [1, 500], blood: [1, 50] }   // 小瑪莉每局最少 1 分（單押一格也能開）；金幣 1 分＝5 萬（Ping 2026-11-05）
  };
  var CHIPS = { gold: [50000, 100000, 500000, 1000000, 5000000, 10000000], dia: [10, 50, 100, 500, 1000], blood: [1, 5, 10, 50, 100] };
  var STEPS = { gold: [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000], dia: [10, 20, 50, 100, 200, 500], blood: [1, 2, 5, 10, 20, 50] };
  function diaReady() { return typeof W.pandoraGetSharedDiamonds === 'function' && typeof W.pandoraAdjustSharedDiamonds === 'function'; }
  function bloodHave() { var p = P(); return p ? (p.inv || []).filter(function (x) { return x && x.id === BLOOD && !x.lock; }).reduce(function (n, x) { return n + (Number(x.cnt) || 1); }, 0) : 0; }
  function curReady(cur) { return cur === 'gold' || (cur === 'dia' && diaReady()) || (cur === 'blood' && !!DB.items[BLOOD] && typeof W.gainItem === 'function'); }
  function balance(cur) {
    var p = P(); if (!p) return 0;
    if (cur === 'gold') return Math.max(0, Math.floor(Number(p.gold) || 0));
    if (cur === 'dia') { if (!diaReady()) return 0; try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } }
    if (cur === 'blood') return bloodHave();
    return 0;
  }
  function diaAdjust(n) { var r = null; try { r = W.pandoraAdjustSharedDiamonds(n) || {}; } catch (e) { r = {}; } return !!r.ok; }
  function debit(cur, n) {
    var p = P(); if (!p || !(n > 0) || balance(cur) < n) return false;
    if (cur === 'gold') { p.gold = Math.floor(Number(p.gold) || 0) - n; return true; }
    if (cur === 'dia') return diaAdjust(-n);
    if (cur === 'blood') {
      for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== BLOOD || it.lock) continue; var q = Math.min(n, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
      return true;
    }
    return false;
  }
  function credit(cur, n) {
    var p = P(); if (!(n > 0)) return true; if (!p) return false;
    if (cur === 'gold') { p.gold = Math.floor(Number(p.gold) || 0) + n; return true; }
    if (cur === 'dia') return diaAdjust(n);
    if (cur === 'blood') { if (!DB.items[BLOOD]) return false; W.gainItem(BLOOD, n, true, true); return true; }
    return false;
  }
  function amtTxt(cur, n) { return CURS[cur] + ' ' + fmt(n) + (cur === 'gold' ? '' : ' 顆'); }
  function safeSave() { try { if (typeof saveGame === 'function') saveGame(); } catch (e) { console.warn('[AFK-gamehall] saveGame', e); } }
  function hallData() {
    var p = P(); if (!p) return null;
    var d = p.afkHall; if (!d || typeof d !== 'object') d = p.afkHall = {};
    if (!d.frac) d.frac = { gold: 0, dia: 0, blood: 0 };
    if (!d.st) d.st = {};
    return d;
  }
  function today() { var t = new Date(Date.now() + 8 * 3600000); return t.toISOString().slice(0, 10); }   // 台灣時間
  // 結算：bet＝已扣的本金；ret100＝要還給玩家的總額（以 1/100 為單位）。回傳實際入帳的整數
  function settle(game, cur, bet, ret100, multX, opt) {   // opt：{ noRound 不算一局, noSave 先不存檔（呼叫端自己節流） }
    var d = hallData(); if (!d) return 0;
    var whole = Math.floor(ret100 / 100), rem = ret100 - whole * 100;
    d.frac[cur] = (Number(d.frac[cur]) || 0) + rem;
    if (d.frac[cur] >= 100) { var extra = Math.floor(d.frac[cur] / 100); whole += extra; d.frac[cur] -= extra * 100; }
    if (whole > 0 && !credit(cur, whole)) { console.warn('[AFK-gamehall] 入帳失敗', cur, whole); }
    statAdd(game, cur, bet, whole, multX, !(opt && opt.noRound));
    if (!(opt && opt.noSave)) safeSave();
    return whole;
  }
  function statAdd(game, cur, bet, won, multX, round) {
    var d = hallData(); if (!d) return;
    var key = game + ':' + cur, s = d.st[key] || (d.st[key] = { n: 0, bet: 0, won: 0, best: 0, day: '', tBet: 0, tWon: 0 });
    var td = today(); if (s.day !== td) { s.day = td; s.tBet = 0; s.tWon = 0; }
    if (round) s.n++;
    s.bet += bet; s.won += won; s.tBet += bet; s.tWon += won;
    if (multX && multX > (s.best || 0)) s.best = multX;
  }

  // ════════════════ 百家樂 ════════════════
  var SUIT = ['♠︎', '♥︎', '♦︎', '♣︎'], RTXT = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  var cR = function (c) { return (c >> 2) + 1; }, cS = function (c) { return c & 3; };
  var cV = function (c) { var r = cR(c); return r >= 10 ? 0 : r; };
  var DECKS = 8, CUT = 16;
  var SPOTS = [
    { id: 'P', n: '閒', pay: '1 賠 1' }, { id: 'T', n: '和', pay: '1 賠 8' }, { id: 'B', n: '莊', pay: '1 賠 1（抽 5%）' },
    { id: 'PP', n: '閒對', pay: '1 賠 11' }, { id: 'BP', n: '莊對', pay: '1 賠 11' }
  ];
  function newShoe(rng) {
    var s = [], i, j, t;
    for (i = 0; i < DECKS; i++) for (j = 0; j < 52; j++) s.push(j);
    for (i = s.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = s[i]; s[i] = s[j]; s[j] = t; }
    return { cards: s, pos: 0, road: [] };
  }
  // 依標準補牌表發一局（shoe 會往前走）
  function bacDeal(shoe) {
    var d = function () { return shoe.cards[shoe.pos++]; };
    var p = [d()], b = [d()]; p.push(d()); b.push(d());
    var sum = function (h) { return h.reduce(function (s, c) { return s + cV(c); }, 0) % 10; };
    var pv = sum(p), bv = sum(b), p3 = null;
    if (pv < 8 && bv < 8) {
      if (pv <= 5) { p3 = d(); p.push(p3); }
      var bd;
      if (p3 == null) bd = bv <= 5;
      else {
        var x = cV(p3);
        bd = bv <= 2 || (bv === 3 && x !== 8) || (bv === 4 && x >= 2 && x <= 7) || (bv === 5 && x >= 4 && x <= 7) || (bv === 6 && (x === 6 || x === 7));
      }
      if (bd) b.push(d());
      pv = sum(p); bv = sum(b);
    }
    return { p: p, b: b, pv: pv, bv: bv, win: pv > bv ? 'P' : bv > pv ? 'B' : 'T', pp: cR(p[0]) === cR(p[1]), bp: cR(b[0]) === cR(b[1]) };
  }
  // 依結果算回本（1/100 單位）
  function bacReturn(bets, r) {
    var ret = 0;
    if (bets.P) ret += r.win === 'P' ? bets.P * 200 : r.win === 'T' ? bets.P * 100 : 0;
    if (bets.B) ret += r.win === 'B' ? bets.B * 195 : r.win === 'T' ? bets.B * 100 : 0;
    if (bets.T) ret += r.win === 'T' ? bets.T * 900 : 0;
    if (bets.PP) ret += r.pp ? bets.PP * 1200 : 0;
    if (bets.BP) ret += r.bp ? bets.BP * 1200 : 0;
    return ret;
  }
  function betTotal(bets) { return SPOTS.reduce(function (s, x) { return s + (bets[x.id] || 0); }, 0); }
  // 大路：回傳 { cells: {"c,r": {w, t}}, cols }
  function bigRoad(road) {
    var cells = {}, last = null, col = -1, row = 0, startCol = -1, maxC = 0, pendingTies = 0;
    road.forEach(function (w) {
      if (w === 'T') { if (last) cells[last].t++; else pendingTies++; return; }
      var prev = last ? cells[last].w : null;
      if (prev === w) {
        if (row + 1 < 6 && !cells[col + ',' + (row + 1)]) row++;
        else col++;
      } else { startCol++; col = startCol; row = 0; while (cells[col + ',' + row]) { startCol++; col = startCol; } }
      last = col + ',' + row; cells[last] = { w: w, t: pendingTies }; pendingTies = 0;
      if (col > maxC) maxC = col;
    });
    return { cells: cells, cols: maxC + 1 };
  }

  // ════════════════ 拉霸：沙海法老的寶庫 ════════════════
  var COLS = 6, ROWS = 5, SLOT_CAP = 5000;
  var SLOT_NAME = '沙海法老的寶庫';
  // pay＝[8～9 個, 10～11 個, 12 個以上] 的倍數 ×100；w＝出現權重（基本盤與免費遊戲相同）
  var SYMS = [
    { k: 'pharaoh', n: '法老面具', pay: [1000, 2500, 5000] },
    { k: 'eye', n: '荷魯斯之眼', pay: [250, 1000, 2500] },
    { k: 'ankh', n: '安卡', pay: [200, 500, 1500] },
    { k: 'scarab', n: '聖甲蟲', pay: [150, 200, 1200] },
    { k: 'jar', n: '聖油壺', pay: [100, 150, 1000] },
    { k: 'gy', n: '黃寶石', pay: [80, 120, 800] },
    { k: 'gb', n: '藍寶石', pay: [50, 100, 500] },
    { k: 'gg', n: '綠寶石', pay: [40, 90, 400] },
    { k: 'gr', n: '紅寶石', pay: [25, 75, 200] }
  ];
  // 權重：用真實引擎跑 1,000 萬次下注對準返還率 93.5%（2.02→95.3%、2.05→93.1%、2.06→92.9%，內插取 2.044）。
  var SW_OFF = 2.044;
  SYMS.forEach(function (s, i) { s.w = SW_OFF + i * 0.5; });
  var SC_W = 0.75, MU_W = 0.45, MU_WF = 0.7;
  var MV = [[2, 300], [3, 250], [4, 200], [5, 180], [6, 150], [8, 120], [10, 100], [12, 60], [15, 50], [20, 40], [25, 25], [50, 12], [100, 5], [250, 1.5], [500, 0.5]];
  var MV_TOT = MV.reduce(function (s, x) { return s + x[1]; }, 0);
  var SYM_TOT = SYMS.reduce(function (s, x) { return s + x.w; }, 0);
  var SCAT_PAY = { 4: 300, 5: 500, 6: 10000 };
  function pickMv(rng) { var r = rng() * MV_TOT; for (var i = 0; i < MV.length; i++) { r -= MV[i][1]; if (r < 0) return MV[i][0]; } return 2; }
  function cell(rng, free) {
    var tot = SYM_TOT + SC_W + (free ? MU_WF : MU_W), r = rng() * tot;
    for (var i = 0; i < SYMS.length; i++) { r -= SYMS[i].w; if (r < 0) return { s: i }; }
    r -= SC_W; if (r < 0) return { s: 'S' };
    return { s: 'M', v: pickMv(rng) };
  }
  function cloneGrid(g) { return g.map(function (col) { return col.map(function (x) { return x.s === 'M' ? { s: 'M', v: x.v } : { s: x.s }; }); }); }
  function slotSpin(rng, free) {
    var g = [], c, r;
    for (c = 0; c < COLS; c++) { g.push([]); for (r = 0; r < ROWS; r++) g[c].push(cell(rng, free)); }
    var steps = [], pay100 = 0;
    for (var guard = 0; guard < 60; guard++) {
      var cnt = {}, wins = [];
      for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) { var s = g[c][r].s; if (typeof s === 'number') cnt[s] = (cnt[s] || 0) + 1; }
      for (var k in cnt) if (cnt[k] >= 8) { var sy = SYMS[k], n = cnt[k], p = n >= 12 ? sy.pay[2] : n >= 10 ? sy.pay[1] : sy.pay[0]; wins.push({ sym: +k, n: n, pay100: p }); pay100 += p; }
      steps.push({ grid: cloneGrid(g), wins: wins });
      if (!wins.length) break;
      var hit = {}; wins.forEach(function (w) { hit[w.sym] = 1; });
      for (c = 0; c < COLS; c++) {
        var keep = g[c].filter(function (x) { return !(typeof x.s === 'number' && hit[x.s]); });
        var add = []; while (add.length + keep.length < ROWS) add.push(cell(rng, free));
        g[c] = add.concat(keep);
      }
    }
    var last = steps[steps.length - 1].grid, mults = [], scat = 0;
    for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) { if (last[c][r].s === 'M') mults.push(last[c][r].v); if (last[c][r].s === 'S') scat++; }
    return { steps: steps, pay100: pay100, mults: mults, scat: scat };
  }
  // 一次下注（含整段免費遊戲）。金額以「注額的 1/100」為單位
  function slotPlay(rng) {
    var CAP = SLOT_CAP * 100;
    var b = slotSpin(rng, false), ms = b.mults.reduce(function (s, x) { return s + x; }, 0);
    var basePay = b.pay100 * (b.pay100 > 0 && ms > 0 ? ms : 1);
    var sc = b.scat >= 4 ? SCAT_PAY[Math.min(6, b.scat)] : 0;
    var res = { base: b, baseWin: basePay, scatWin: sc, fs: null, total: basePay + sc, capped: false };
    if (b.scat >= 4 && res.total < CAP) {
      var left = 15, tm = 0, fs = [], fsPay = 0;
      while (left > 0 && res.total + fsPay < CAP) {
        left--;
        var f = slotSpin(rng, true), m2 = f.mults.reduce(function (s, x) { return s + x; }, 0);
        if (f.pay100 > 0) tm += m2;
        var pay = f.pay100 * (f.pay100 > 0 && tm > 0 ? tm : 1);
        var add = f.scat >= 3 ? 5 : 0; left += add;
        fs.push({ spin: f, totMult: tm, pay: pay, add: add, left: left });
        fsPay += pay;
      }
      res.fs = fs; res.total += fsPay;
    }
    if (res.total >= CAP) { res.total = CAP; res.capped = true; }
    return res;
  }
  // ════════════════ 亞丁小瑪莉（水果盤） ════════════════
  var MARY_NAME = '亞丁小瑪莉';
  // 0 BAR 1 77 2 星星 3 西瓜 4 鈴鐺 5 檸檬 6 柳丁 7 蘋果 8 櫻桃
  var MF = [
    { k: 'f_bar', n: 'BAR', odds: 50 }, { k: 'f_77', n: '77', odds: 40 }, { k: 'f_star', n: '星星', odds: 30 }, { k: 'f_melon', n: '西瓜', odds: 20 },
    { k: 'f_bell', n: '鈴鐺', odds: 20 }, { k: 'f_lemon', n: '檸檬', odds: 15 }, { k: 'f_orange', n: '柳丁', odds: 10 }, { k: 'f_apple', n: '蘋果', odds: 5 }, { k: 'f_cherry', n: '櫻桃', odds: 2 }
  ];
  // 一圈 24 格（上排左→右 0～6、右排上→下 7～11、下排右→左 12～18、左排下→上 19～23）：[水果, 小格?]；'O'＝ONCE MORE
  var RING = [[6, 0], [4, 0], [0, 0], [0, 1], [7, 0], [3, 1], [3, 0], 'O', [7, 0], [5, 1], [5, 0], [2, 1], [2, 0], [7, 0], [8, 0], [1, 1], [1, 0], [4, 0], [6, 0], 'O', [7, 0], [4, 1], [5, 0], [8, 0]];
  // 每格停下的機率：解方程讓 9 種水果「單押」的返還率都是 92%（另 1.5% 進 JP，合計 93.5%），押哪一種長期都一樣
  var RING_P = [0.038497,0.016441,0.015207,0.010138,0.037692,0.019581,0.036365,0.052278,0.037692,0.020608,0.019136,0.014071,0.021107,0.037692,0.206217,0.011725,0.017588,0.016441,0.038497,0.052278,0.037692,0.017705,0.019136,0.206217];
  var JP_CELL = 2, MARY_UNIT = { gold: 50000, dia: 1, blood: 1 }, MARY_MAXPT = 99, JP_RATE = 150 /* 1.5%，以萬分之一 */, JP_SEED = { gold: 1000000, dia: 100, blood: 10 };
  var MEV = [['none', 30, '槓龜'], ['re1', 35, '再送一燈'], ['reN', 18, '送燈'], ['train', 9, '開火車'], ['san', 4, '小三元'], ['da', 2.5, '大三元'], ['si', 1.5, '大四喜']];
  var MEV_CELLS = { san: [0, 10, 1], da: [6, 12, 16], si: [4, 8, 13, 20] };
  var DBL_MAX = 5, JP_WIN = 777;
  function cellPay(i, bets) { var c = RING[i]; if (c === 'O') return 0; return (bets[c[0]] || 0) * (c[1] ? 3 : MF[c[0]].odds); }
  function pickCell(rng, noOnce) {
    var tot = 0, i; for (i = 0; i < 24; i++) if (!(noOnce && RING[i] === 'O')) tot += RING_P[i];
    var r = rng() * tot;
    for (i = 0; i < 24; i++) { if (noOnce && RING[i] === 'O') continue; r -= RING_P[i]; if (r < 0) return i; }
    return 23;
  }
  // 一局：回傳 { main, ev, extra:[格], lit:[所有亮的格], pts, jp }
  function maryPlay(rng, bets) {
    var main = pickCell(rng, false), res = { main: main, ev: null, extra: [], pts: 0, jp: false };
    if (RING[main] === 'O') {
      var tot = MEV.reduce(function (a, x) { return a + x[1]; }, 0), r = rng() * tot, ev = MEV[0];
      for (var k = 0; k < MEV.length; k++) { r -= MEV[k][1]; if (r < 0) { ev = MEV[k]; break; } }
      res.ev = ev[0];
      if (ev[0] === 're1') res.extra = [pickCell(rng, true)];
      else if (ev[0] === 'reN') { var n = 2 + Math.floor(rng() * 3); for (var j = 0; j < n; j++) res.extra.push(pickCell(rng, true)); }
      else if (ev[0] === 'train') { var L = 3 + Math.floor(rng() * 5); for (var t = 1; t <= L; t++) res.extra.push((main + t) % 24); }
      else if (MEV_CELLS[ev[0]]) res.extra = MEV_CELLS[ev[0]].slice();
    }
    var lit = [main].concat(res.extra);
    lit.forEach(function (i) { res.pts += cellPay(i, bets); });
    var all = MF.every(function (f, i) { return (bets[i] || 0) > 0; });
    // JP：9 種全押、大 BAR 亮起 → 中間 LED 跳 000～999，開出 777 才中（Ping 2026-11-05 定）
    res.jpNum = null; res.jp = false;
    if (all && lit.indexOf(JP_CELL) >= 0) { res.jpNum = Math.floor(rng() * 1000); res.jp = res.jpNum === JP_WIN; }
    res.lit = lit;
    return res;
  }
  var rng = function () {
    try { var a = new Uint32Array(1); W.crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
  };

  // ── 像素圖示（12×12，粗外框、每張 5 色上下；第一次打開時用 canvas 畫成圖） ──
  var PAL = { k: '#1a1008', y: '#f5c542', Y: '#a8741a', b: '#2f5fd0', B: '#18306e', w: '#fff6d8', s: '#c98a5a', r: '#d23a2a', R: '#7a1712',
    g: '#38b24a', G: '#16602a', o: '#ff9a2a', O: '#b4530f' };
  var GEM = { gy: ['#ffd84a', '#b8860b'], gb: ['#3d8bff', '#16408f'], gg: ['#2fd46a', '#0f6b33'], gr: ['#ff4a5a', '#8f1020'] };
  var ART = {
    pharaoh: ['...kkkkkk...', '..kyYyyYyk..', '.kybyyyybyk.', '.kyyssssyyk.', 'kbyskssksybk', 'kyyssssssyyk', 'kbyssrrssybk', 'kyyksssskyyk', 'kbyykssyyybk', 'kyyyyssyyyyk', '.kbyykkyybk.', '..kkk..kkk..'],
    eye: ['............', '..BBBBBBB...', '.kkkkkkkkkk.', 'kwwwkkkkwwwk', 'kwwkkbbkkwwk', 'kwwkbwbbkwwk', '.kwwkkkkwwk.', '..kkkkkkkk..', '....kb..kk..', '....kb..kbk.', '...kbk..kbk.', '...kk....k..'],
    ankh: ['....kkkk....', '...kyyyyk...', '..kyk..kyk..', '..kyk..kyk..', '...kyyyyk...', 'kkkkkyykkkkk', 'kyyyyyyyyyyk', 'kkkkkyykkkkk', '....kyyk....', '....kyyk....', '....kYYk....', '....kkkk....'],
    scarab: ['...k....k...', '....kkkk....', '...kGGGGk...', '..kgggggGk..', 'kkgwggggggkk', '..kggkkggk..', 'kkgggkkgggkk', '..kggkkggk..', 'kkkggkkggkkk', '..kGGkkGGk..', '...kkkkkk...', '............'],
    jar: ['....kkkk....', '...kssssk...', '...kskksk...', '....kssk....', '..kkkkkkkk..', '.kooooooook.', 'kowooooooook', 'kowoRRRRoook', 'koooRooRoook', '.koooooooRk.', '..kRRRRRRk..', '...kkkkkk...'],
    gy: ['............', '...kkkkkk...', '..kwxxxxxk..', '.kwxxxxxxxk.', 'kkkkkkkkkkkk', '.kxxXxxXxxk.', '..kxXxxXxk..', '...kxxxxk...', '....kXXk....', '.....kk.....', '............', '............'],
    gb: ['............', '...kkkkkk...', '..kwwxxxxk..', '.kwxxxxxxXk.', '.kwxxxxxxXk.', '.kxxxxxxxXk.', '.kxxxxxxxXk.', '.kxxxxxxXXk.', '..kxXXXXXk..', '...kkkkkk...', '............', '............'],
    gg: ['....kkkk....', '...kwxxxk...', '..kwxxxxxk..', '.kwxxxxxxxk.', '.kxxxxxxxxk.', '.kxxxxxxxXk.', '.kxxxxxxxXk.', '.kxxxxxxXXk.', '..kxxxxXXk..', '...kxXXXk...', '....kkkk....', '............'],
    gr: ['............', '..kkk..kkk..', '.kwxxkkxxxk.', 'kwxxxxxxxxXk', 'kxxxxxxxxxXk', 'kxxxxxxxxxXk', '.kxxxxxxxXk.', '..kxxxxxXk..', '...kxxxXk...', '....kxXk....', '.....kk.....', '............'],
    f_bar: ['............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.'],
    f_77: ['............', 'kkkkkk.kkkkk', 'krrrrrkkrrrk', 'kkkkrrkkkrrk', '...krrk.krrk', '...krk..krk.', '..krrk.krrk.', '..krk..krk..', '.krrk.krrk..', '.krk..krk...', '.kkk..kkk...', '............'],
    f_star: ['.....kk.....', '.....kyk....', '....kyyk....', 'kkkkkywykkkk', 'kyyyyyyyyyyk', '.kyyyyyyyyk.', '..kyyyyyyk..', '..kyyYYyyk..', '.kyyYkkYyyk.', '.kyYk..kYyk.', '.kYk....kYk.', '.kk......kk.'],
    f_melon: ['............', '............', 'kkkkkkkkkkkk', 'krrwrrrrrrrk', '.krkrrrkrrk.', '.krrrrrrrrk.', '..krrkrrrk..', '...krrrrk...', '...kwwwwk...', '....kggk....', '.....kk.....', '............'],
    f_bell: ['.....kk.....', '....kyyk....', '...kywyyk...', '..kywyyyyk..', '..kywyyyyk..', '..kyyyyyyk..', '.kyyyyyyyyk.', '.kyyyyyyyYk.', 'kyyyyyyyyYYk', 'kkkkkkkkkkkk', '.....kYk....', '......k.....'],
    f_lemon: ['............', '.......kk...', '.....kkGGk..', '...kkyyykk..', '..kywyyyyyk.', '.kywyyyyyyk.', '.kyyyyyyyyk.', '.kyyyyyyyYk.', '..kyyyyyYk..', '...kkyyYk...', '.....kkk....', '............'],
    f_orange: ['......kk....', '.....kGGk...', '...kkkGkkk..', '..kowooooOk.', '.kowoooooOk.', '.kooooooooOk', '.koooooooOOk', '.kooooooOOk.', '..koooooOOk.', '..kkOOOOkk..', '....kkkk....', '............'],
    f_apple: ['.....kk.....', '......kGk...', '..kkkkGkkk..', '.krrwrrrrrk.', 'krrwrrrrrrRk', 'krwrrrrrrrRk', 'krrrrrrrrrRk', 'krrrrrrrrRRk', '.krrrrrrRRk.', '..krRRrRRk..', '...kk..kk...', '............'],
    f_cherry: ['.......kk...', '......kGk...', '.....kGk....', '....kG.kk...', '...kG...kG..', '..kkk...kGk.', '.krwrk.kkkk.', '.krrrkkrwrrk', '.krrRkkrrrrk', '..kkk.krrRk.', '.......kkk..', '............'],
    S: ['.....kk.....', '....kwYk....', '....kyYk....', '...kwyYYk...', '...kyyYYk...', '..kwyyYYYk..', '..kyyyYYYk..', '.kwyyyYYYYk.', '.kyyyyYYYYk.', 'kwyyyyYYYYYk', 'kkkkkkkkkkkk', '............'],
    M: ['....kkkk....', '..kkoyyokk..', '.koyyyyyyok.', '.kyywyyyyyk.', 'kywwyyyyyyok', 'kyyyyyyyyyok', 'kyyyyyyyyyok', 'koyyyyyyyook', '.koyyyyyook.', '.kooyyyoook.', '..kkooookk..', '....kkkk....']
  };
  var IMG = null;
  function art() {
    if (IMG) return IMG;
    IMG = {};
    Object.keys(ART).forEach(function (k) {
      var rows = ART[k], cv = document.createElement('canvas'), Z = 4; cv.width = 12 * Z; cv.height = 12 * Z;
      var x = cv.getContext('2d'), gem = GEM[k];
      for (var r = 0; r < 12; r++) for (var c = 0; c < 12; c++) {
        var ch = (rows[r] || '')[c] || '.'; if (ch === '.') continue;
        var col = ch === 'x' && gem ? gem[0] : ch === 'X' && gem ? gem[1] : PAL[ch];
        if (!col) continue; x.fillStyle = col; x.fillRect(c * Z, r * Z, Z, Z);
      }
      try { IMG[k] = cv.toDataURL('image/png'); } catch (e) { IMG[k] = ''; }
    });
    return IMG;
  }
  function symKey(cellv) { return cellv.s === 'S' ? 'S' : cellv.s === 'M' ? 'M' : SYMS[cellv.s].k; }

  // ════════════════ 畫面共用 ════════════════
  function css() {
    if (el('afk-gh-css')) return;
    var s = document.createElement('style'); s.id = 'afk-gh-css';
    s.textContent = ''
      + '.gh-win{position:fixed;z-index:75;left:50%;transform:translateX(-50%);top:calc(var(--orig-bar-h,0px) + 6px);width:min(96vw,460px);'
      + 'max-height:calc(100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px) - 12px);max-height:calc(100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px) - 12px);'
      + 'overflow-y:auto;overscroll-behavior:contain;background:#0f172af7;border:2px solid #a16207;border-radius:12px;box-shadow:0 18px 40px #000c;'
      + 'color:#e2e8f0;font-family:Arial,"Microsoft JhengHei",sans-serif;font-size:13px;touch-action:manipulation;box-sizing:border-box}'
      + '.gh-win *{box-sizing:border-box}.gh-win.bac{background:radial-gradient(ellipse at 50% 30%,#14532d,#052e16 80%)}.gh-win.slot{background:radial-gradient(ellipse at 50% 20%,#3b2a10,#120b04 80%)}'
      + '.gh-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#1c1206ee;border-bottom:1px solid #a16207;position:sticky;top:0;z-index:3;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}'
      + '.gh-title{flex:1;min-width:0;font-weight:800;color:#fde68a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gh-title small{color:#d6d3d1;font-weight:600;margin-left:4px}'
      + '.gh-hb{min-width:34px;height:30px;border:1px solid #d9bd70;border-radius:6px;background:#151b25;color:#fff3cf;font-size:13px;font-weight:700;padding:0 8px;cursor:pointer}'
      + '.gh-body{padding:8px}'
      + '.gh-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
      + '.gh-card{border:1px solid #a16207;border-radius:10px;background:linear-gradient(160deg,#1e293b,#0b1220);padding:10px;cursor:pointer;text-align:left;color:#e2e8f0;min-height:92px}'
      + '.gh-card:hover{filter:brightness(1.15)}.gh-card b{display:block;font-size:16px;color:#fde68a;margin-bottom:3px}.gh-card span{font-size:12px;color:#cbd5e1;line-height:1.4}'
      + '.gh-card .ico{font-size:24px;float:right}'
      + '.gh-cur{display:flex;gap:5px;margin-bottom:7px}.gh-cur button{flex:1;min-height:34px;border:1px solid #475569;border-radius:7px;background:#141c28;color:#cbd5e1;font-size:12px;font-weight:800;cursor:pointer;padding:2px 4px;line-height:1.2}'
      + '.gh-cur button.on{border-color:#facc15;background:#3a2f0c;color:#fde68a}.gh-cur button[disabled]{opacity:.35}'
      + '.gh-msg{min-height:20px;margin:6px 0;padding:5px 8px;border-radius:6px;background:#0009;color:#fef3c7;font-size:12.5px;line-height:1.45}'
      + '.gh-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.gh-btns button{flex:1 1 0;min-height:40px;border-radius:8px;border:1px solid #64748b;background:#1e293b;color:#f1f5f9;font-weight:800;font-size:13.5px;cursor:pointer;padding:0 6px}'
      + '.gh-btns button.go{background:#14532d;border-color:#22c55e;color:#dcfce7}.gh-btns button.stop{background:#450a0a;border-color:#ef4444;color:#fecaca}'
      + '.gh-btns button[disabled]{opacity:.4;cursor:not-allowed}'
      + '.gh-sm{font-size:11.5px;color:#94a3b8}'
      + '.gh-tog{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#cbd5e1;cursor:pointer}'
      // 百家樂
      + '.bc-table{display:grid;grid-template-columns:1fr 1fr;gap:6px}'
      + '.bc-side{border-radius:9px;padding:6px;text-align:center;background:#0b1a12d9;border:1px solid #365314;min-height:104px}'
      + '.bc-side.P{border-color:#3b82f6}.bc-side.B{border-color:#ef4444}.bc-side.win{box-shadow:0 0 0 2px #facc15,0 0 14px #facc1588}'
      + '.bc-side h4{margin:0 0 3px;font-size:14px}.bc-side.P h4{color:#93c5fd}.bc-side.B h4{color:#fca5a5}'
      + '.bc-pts{font-size:20px;font-weight:900;color:#fde68a}'
      + '.bc-hand{display:flex;justify-content:center;gap:3px;min-height:54px}'
      + '.bc-c{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:36px;height:52px;border-radius:5px;background:#f8fafc;color:#0f172a;border:1px solid #94a3b8;font-weight:800;line-height:1;box-shadow:0 1px 2px #0008}'
      + '.bc-c b{font-size:15px}.bc-c i{font-style:normal;font-size:16px}.bc-c.r{color:#dc2626}.bc-c.side{margin-left:6px;box-shadow:0 0 0 2px #facc1599}'
      + '.bc-c.in{animation:bc-in .3s ease-out}@keyframes bc-in{from{transform:translateY(-14px) scale(.8);opacity:0}to{opacity:1}}'
      + '.bc-spots{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}'
      + '.bc-spot{position:relative;min-height:56px;border-radius:9px;border:1px solid #64748b;background:#0b1a12e6;color:#e2e8f0;cursor:pointer;padding:4px;text-align:center}'
      + '.bc-spot b{display:block;font-size:15px}.bc-spot small{display:block;font-size:10.5px;color:#a3a3a3}.bc-spot em{display:block;font-style:normal;font-size:12px;color:#fde68a;font-weight:800;min-height:15px}'
      + '.bc-spot.P{border-color:#3b82f6}.bc-spot.B{border-color:#ef4444}.bc-spot.T{border-color:#22c55e}.bc-spot.hit{box-shadow:0 0 0 2px #facc15}'
      + '.bc-spots .bc-spot.PP,.bc-spots .bc-spot.BP{min-height:44px}'
      + '.bc-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.bc-chips button{min-width:46px;height:32px;border-radius:16px;border:2px dashed #d9bd70;background:#3a2f0c;color:#fde68a;font-size:11.5px;font-weight:800;cursor:pointer;padding:0 6px}'
      + '.bc-chips button.on{background:#d9bd70;color:#1c1206;border-style:solid}'
      + '.bc-road{margin-top:8px;display:flex;gap:6px;align-items:flex-start;overflow-x:auto}'
      + '.bc-grid{display:grid;grid-auto-flow:column;grid-template-rows:repeat(6,15px);grid-auto-columns:15px;gap:1px;background:#ffffff14;padding:2px;border-radius:5px;background-color:#f8fafc}'
      + '.bc-grid i{display:block;width:15px;height:15px;border-radius:50%;font-style:normal;font-size:9px;font-weight:900;color:#fff;text-align:center;line-height:15px;position:relative}'
      + '.bc-grid i.P{background:#2563eb}.bc-grid i.B{background:#dc2626}.bc-grid i.T{background:#16a34a}'
      + '.bc-grid.big i{background:transparent;border:2.5px solid transparent;line-height:10px}.bc-grid.big i.P{border-color:#2563eb;background:transparent}.bc-grid.big i.B{border-color:#dc2626;background:transparent}'
      + '.bc-grid.big i u{position:absolute;left:1px;top:5px;width:9px;height:2px;background:#16a34a;transform:rotate(-45deg);text-decoration:none}'
      + '.bc-cnt{font-size:11.5px;line-height:1.6;white-space:nowrap}'
      // 拉霸
      + '.sl-top{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;color:#fde68a;font-weight:800;min-height:18px}'
      + '.sl-grid{position:relative;display:grid;grid-template-columns:repeat(6,1fr);gap:3px;padding:5px;border-radius:10px;background:#2a1c08;border:2px solid #d9bd70;box-shadow:inset 0 0 18px #000}'
      + '.sl-cell{position:relative;aspect-ratio:1/1;border-radius:6px;background:#0f0a04;display:flex;align-items:center;justify-content:center;overflow:hidden}'
      + '.sl-cell img{width:82%;height:82%;image-rendering:pixelated;image-rendering:crisp-edges}'
      + '.sl-cell.hit{background:#5a3d0a;box-shadow:inset 0 0 0 2px #facc15;animation:sl-hit .45s ease-in-out}'
      + '.sl-cell.drop img{animation:sl-drop .28s ease-out}'
      + '.sl-cell .mv{position:absolute;bottom:1px;left:0;right:0;text-align:center;font-size:11px;font-weight:900;color:#fff;text-shadow:0 0 3px #000,0 1px 0 #000}'
      + '@keyframes sl-hit{50%{transform:scale(1.12)}}@keyframes sl-drop{from{transform:translateY(-60%);opacity:.2}}'
      + '.sl-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center;border-radius:10px}'
      + '.sl-ov b{font-size:26px;font-weight:900;color:#fde047;text-shadow:0 2px 0 #7c2d12,0 0 12px #000}.sl-ov span{font-size:16px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000}'
      + '.sl-ov.big{background:#0008;animation:sl-pop .5s ease-out}@keyframes sl-pop{from{transform:scale(.6);opacity:0}}'
      + '.sl-bet{display:flex;align-items:center;gap:6px;margin-top:7px}.sl-bet button{min-width:40px;height:36px;border-radius:8px;border:1px solid #d9bd70;background:#3a2f0c;color:#fde68a;font-size:18px;font-weight:900;cursor:pointer}'
      + '.sl-bet .amt{flex:1;text-align:center;font-weight:900;color:#fde68a;font-size:15px}'
      + '.sl-pay{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:6px}.sl-pay td,.sl-pay th{border:1px solid #3f3f46;padding:2px 4px;text-align:center}.sl-pay img{width:22px;height:22px;image-rendering:pixelated;vertical-align:middle}'
      // 小瑪莉
      + '.gh-win.mary{background:linear-gradient(#5b3a1e,#3b2412);border-color:#d9bd70}'
      + '.my-led{display:flex;gap:8px;justify-content:center;margin-bottom:6px}.my-led div{flex:1;text-align:center;background:#2a0a0a;border:2px solid #f97316;border-radius:8px;padding:2px 4px}'
      + '.my-led small{display:block;font-size:11px;font-weight:900;color:#fdba74;letter-spacing:2px}.my-led b{display:block;font-family:"Courier New",monospace;font-size:20px;color:#ef4444;text-shadow:0 0 6px #ef4444;letter-spacing:2px;line-height:1.1}'
      + '.my-board{display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(7,1fr);gap:2px;padding:4px;background:#f5deb3;border:3px solid #7c4a1e;border-radius:6px;aspect-ratio:1/1}'
      + '.my-cell{position:relative;background:#fff8e7;border:1px solid #c8a26a;border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden}'
      + '.my-cell img{width:80%;height:80%;image-rendering:pixelated}.my-cell.sm img{width:52%;height:52%}.my-cell.sm i{position:absolute;right:1px;bottom:0;font-style:normal;font-size:9px;font-weight:900;color:#b91c1c}'
      + '.my-cell.once{background:#fde68a;font-size:9px;font-weight:900;color:#b91c1c;text-align:center;line-height:1.05}'
      + '.my-cell::after{content:"";position:absolute;top:2px;left:2px;width:6px;height:6px;border-radius:50%;background:#7f1d1d}'
      + '.my-cell.on{background:#fff;box-shadow:inset 0 0 0 3px #ef4444}.my-cell.on::after{background:#ff2d2d;box-shadow:0 0 6px #ff2d2d}'
      + '.my-cell.fl{background:#ecfeff;box-shadow:inset 0 0 0 3px #22d3ee,0 0 10px #22d3ee}.my-cell.fl::after{background:#22d3ee;box-shadow:0 0 6px #22d3ee}.my-cell.lit{background:#fef08a;box-shadow:inset 0 0 0 3px #f59e0b}.my-cell.lit::after{background:#facc15;box-shadow:0 0 6px #facc15}'
      + '.my-center{grid-column:2/7;grid-row:2/7;position:relative;background:linear-gradient(#7dd3fc,#bae6fd 60%,#86efac 60%,#4ade80);border:2px solid #7c4a1e;border-radius:4px;overflow:hidden}'
      + '.my-center img{position:absolute;image-rendering:pixelated;pointer-events:none}'
      + '.my-kn{left:-26%;bottom:-8%;width:112%}.my-sl{right:2%;bottom:10%;width:40%;transform:scaleX(-1)}'
      + '.my-jp{position:absolute;left:0;right:0;top:4%;text-align:center}.my-jp b{display:inline-block;font-size:20px;font-weight:900;color:#dc2626;text-shadow:2px 2px 0 #fde047,-1px -1px 0 #7f1d1d;font-style:italic}'
      + '.my-jp span{display:block;margin:2px auto 0;width:max-content;min-width:60%;background:#2a0a0a;border:2px solid #f97316;border-radius:5px;font-family:"Courier New",monospace;font-size:14px;color:#ef4444;text-shadow:0 0 6px #ef4444;padding:0 6px}'
      + '.my-dig{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);min-width:54px;padding:0 6px;height:54px;background:#2a0a0a;border:3px solid #f97316;border-radius:8px;font-family:"Courier New",monospace;font-size:40px;font-weight:900;color:#ef4444;text-shadow:0 0 8px #ef4444;display:flex;align-items:center;justify-content:center}'
      + '.my-ev{position:absolute;left:0;right:0;top:40%;text-align:center;font-size:22px;font-weight:900;color:#fde047;text-shadow:0 2px 0 #7c2d12,0 0 10px #000;animation:sl-pop .4s ease-out}'
      + '.my-pay{display:grid;grid-template-columns:repeat(9,1fr);gap:2px;margin-top:6px}.my-pay div{text-align:center;background:#1c1917;border:1px solid #78350f;border-radius:4px;padding:1px 0}'
      + '.my-pay small{display:block;font-size:11px;font-weight:900;color:#fde68a;background:#c2410c;border-radius:3px 3px 0 0}.my-pay img{width:22px;height:22px;image-rendering:pixelated;display:block;margin:1px auto}'
      + '.my-pay b{display:block;font-family:"Courier New",monospace;font-size:14px;color:#ef4444;text-shadow:0 0 4px #ef4444}'
      + '.my-keys{display:grid;grid-template-columns:repeat(9,1fr);gap:2px;margin-top:4px}.my-keys button{height:40px;border-radius:6px;border:2px solid #a8a29e;background:linear-gradient(#fafaf9,#d6d3d1);cursor:pointer;padding:0;touch-action:manipulation}'
      + '.my-keys button img{width:24px;height:24px;image-rendering:pixelated}.my-keys button:active{transform:translateY(1px)}.my-keys button[disabled]{opacity:.5}'
      + '.my-ctl{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:6px}.my-ctl button{min-height:40px;border-radius:7px;border:2px solid #78350f;background:linear-gradient(#fde68a,#f59e0b);color:#431407;font-weight:900;font-size:12px;cursor:pointer;padding:0 2px;line-height:1.1}'
      + '.my-ctl button.go{background:linear-gradient(#bae6fd,#3b82f6);color:#0c1a3a}.my-ctl button.out{background:linear-gradient(#fecaca,#ef4444);color:#450a0a}.my-ctl button[disabled]{opacity:.4;cursor:not-allowed}'
      + '.gh-stat{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}.gh-stat td,.gh-stat th{border:1px solid #334155;padding:3px 5px;text-align:right}.gh-stat td:first-child,.gh-stat th:first-child{text-align:left}'
      + '.gh-ball{position:fixed;z-index:75;right:12px;bottom:calc(var(--m-nav-h,0px) + 200px);width:54px;height:54px;border-radius:50%;border:2px solid #d9bd70;'
      + 'background:radial-gradient(circle at 40% 35%,#7c2d12,#1c1206);color:#fde68a;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px #000b;user-select:none;touch-action:none}'
      + '.gh-ball b{font-size:20px;line-height:1}.gh-ball span{font-size:10px;font-weight:800;margin-top:1px}';
    document.head.appendChild(s);
  }

  // 拖曳（同德州撲克：標題列拖、位置記住、雙擊標題回預設）
  var POS = { win: 'afk_gh_winpos', ball: 'afk_gh_ballpos' };
  function barTop() { try { var b = el('_orig_pbar'); if (b) { var h = b.getBoundingClientRect().height; if (h > 0) return Math.ceil(h) + 6; } } catch (e) {} return 0; }
  function usableBottom() { try { var n = el('m-nav'); if (n && getComputedStyle(n).display !== 'none') return n.getBoundingClientRect().top; } catch (e) {} return innerHeight; }
  function clampPos(node, x, y) { var bt = barTop(), w = node.offsetWidth || 60, h = node.offsetHeight || 40; return { x: Math.max(0, Math.min(Math.max(0, innerWidth - w), x)), y: Math.max(bt, Math.min(Math.max(bt, usableBottom() - Math.min(h, 80)), y)) }; }
  function setPos(node, x, y) { node.style.left = x + 'px'; node.style.top = y + 'px'; node.style.right = 'auto'; node.style.bottom = 'auto'; node.style.transform = 'none'; }
  function restorePos(node, key) { var p = null; try { p = JSON.parse(LS(key) || 'null'); } catch (e) {} if (!p || typeof p.left !== 'number') return; var c = clampPos(node, p.left, p.top); setPos(node, c.x, c.y); }
  function makeDraggable(node, sel, key) {
    var drag = null;
    node.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      if (sel && !(e.target.closest && e.target.closest(sel))) return;
      if (e.target.closest && e.target.closest('button,input,select,a,label')) return;
      var r = node.getBoundingClientRect(); drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
      try { node.setPointerCapture(e.pointerId); } catch (er) {}
    });
    node.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
      drag.moved = true; var c = clampPos(node, e.clientX - drag.dx, e.clientY - drag.dy); setPos(node, c.x, c.y); e.preventDefault();
    });
    var end = function (e) { if (!drag || drag.id !== e.pointerId) return; try { node.releasePointerCapture(e.pointerId); } catch (er) {} if (drag.moved) { LS(key, JSON.stringify({ left: parseInt(node.style.left, 10), top: parseInt(node.style.top, 10) })); node._ghDragged = Date.now(); } drag = null; };
    node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
    if (sel) node.addEventListener('dblclick', function (e) {
      if (!(e.target.closest && e.target.closest(sel)) || e.target.closest('button')) return;
      try { localStorage.removeItem(key); } catch (er) {} node.style.left = node.style.top = node.style.right = node.style.bottom = node.style.transform = '';
    });
  }
  W.addEventListener('resize', function () {
    ['afk-gh-win', 'afk-gh-ball'].forEach(function (id) { var n = el(id); if (!n || n.style.display === 'none' || n.style.transform !== 'none') return; var c = clampPos(n, parseInt(n.style.left, 10) || 0, parseInt(n.style.top, 10) || 0); setPos(n, c.x, c.y); });
  });
  function isMobileHidden() { var b = document.body; if (b.classList.contains('m-unified') || !b.classList.contains('m-mobile')) return false; return !b.classList.contains('mview-center') || b.classList.contains('mlog-open'); }
  var visObs = null;
  function updateVis() { var h = isMobileHidden(); ['afk-gh-win', 'afk-gh-ball'].forEach(function (id) { var n = el(id); if (n) n.style.visibility = h ? 'hidden' : ''; }); }
  function toCenter() { try { if (document.body.classList.contains('m-mobile') && W.__afkm && typeof W.__afkm.setView === 'function') W.__afkm.setView('center'); } catch (e) {} }

  var ui = { view: 'home', cur: LS('afk_gh_cur') || 'gold', quick: LS('afk_gh_quick') === '1', msg: '', busy: false, auto: 0, autoLeft: 0, min: false };
  var bac = { shoe: null, bets: {}, last: null, chip: {}, res: null, reveal: 0, hist: [] };
  var sl = { bet: {}, res: null, show: null, fsInfo: '', ov: '' };
  var timers = [], TESTQ = [];   // TESTQ：測試用，先塞好的結果（正式遊玩永遠是空的）
  function later(fn, ms) { var t = setTimeout(function () { timers = timers.filter(function (x) { return x !== t; }); fn(); }, ms); timers.push(t); return t; }
  function stopAnims() { timers.forEach(clearTimeout); timers = []; }

  function win() {
    css();
    var w = el('afk-gh-win');
    if (!w) {
      w = document.createElement('div'); w.id = 'afk-gh-win'; w.className = 'gh-win'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', '遊戲廳');
      document.body.appendChild(w);
      makeDraggable(w, '.gh-head', POS.win);
      w.addEventListener('click', onClick);
      if (!visObs && typeof MutationObserver === 'function') { visObs = new MutationObserver(updateVis); visObs.observe(document.body, { attributes: true, attributeFilter: ['class'] }); }
    }
    return w;
  }
  function open(view) {
    if (!P()) return false;
    toCenter();
    try { if (W.__afkPoker && W.__afkPoker.closeLobby) W.__afkPoker.closeLobby(); } catch (e) {}
    try { var tic = el('town-interaction-container'); if (tic && !tic.classList.contains('hidden') && (tic.querySelector('.pk-tbl')) && typeof W.closeNpcInteraction === 'function') W.closeNpcInteraction(); } catch (e) {}
    var w = win(); w.style.display = ''; ui.min = false; var b = el('afk-gh-ball'); if (b) b.style.display = 'none';
    if (view) go(view); else render();
    restorePos(w, POS.win); updateVis();
    return true;
  }
  function close() {
    if(W.LineageArcadeEntry)W.LineageArcadeEntry.cancel();
    if(W.LineageArcade)W.LineageArcade.suspend();
    stopAuto(); stopAnims(); finishShow(); ui.busy = false; maryCollect(true);
    var w = el('afk-gh-win'), b = el('afk-gh-ball'); if (w) w.style.display = 'none'; if (b) b.style.display = 'none'; ui.min = false;
  }
  function toBall() {
    stopAuto(); stopAnims(); finishShow(); ui.busy = false; maryCollect(true);
    var w = el('afk-gh-win'); if (w) w.style.display = 'none'; ui.min = true;
    var b = el('afk-gh-ball');
    if (!b) { css(); b = document.createElement('div'); b.id = 'afk-gh-ball'; b.className = 'gh-ball'; b.setAttribute('role', 'button'); b.setAttribute('aria-label', '打開遊戲廳'); b.innerHTML = '<b>🎰</b><span>遊戲廳</span>'; document.body.appendChild(b); makeDraggable(b, null, POS.ball); b.addEventListener('click', function () { if (b._ghDragged && Date.now() - b._ghDragged < 350) return; open(); }); }
    b.style.display = ''; restorePos(b, POS.ball); updateVis();
  }
  function go(view) {
    if (ui.busy) return;
    if(W.LineageArcade)W.LineageArcade.suspend();
    if (ui.view === 'mary' && view !== 'mary') maryCollect(true);
    stopAuto(); ui.view = view; ui.msg = '';
    var w = win(); w.className = 'gh-win' + (view === 'bac' ? ' bac' : view === 'slot' ? ' slot' : view === 'mary' ? ' mary' : '') + (w.classList.contains('lm-surface') ? ' lm-surface' : '');
    render();
  }
  function classic() { var p = P(); return !!(p && p.classicMode); }
  function head(title, sub, back) {
    return '<div class="gh-head">' + (back ? '<button type="button" class="gh-hb" data-gh="home" aria-label="回遊戲廳">◀</button>' : '')
      + '<div class="gh-title">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div>'
      + '<button type="button" class="gh-hb" data-gh="min" aria-label="縮小">－</button><button type="button" class="gh-hb" data-gh="close" aria-label="關閉">✕</button></div>';
  }
  // 動畫還沒演完時，畫面上的餘額先停在「扣完注、還沒派彩」那一刻，不然一看餘額就知道結果
  function shownBal(c) { return (ui.busy && ui.hold && ui.hold.cur === c) ? ui.hold.v : balance(c); }
  function curBar(game) {
    var lim = LIM[game];
    return '<div class="gh-cur" role="group" aria-label="幣別">' + ['gold', 'dia', 'blood'].map(function (c) {
      var ok = curReady(c);
      return '<button type="button" data-gh="cur:' + c + '"' + (ui.cur === c ? ' class="on"' : '') + (ok && !ui.busy ? '' : ' disabled') + '>' + CUR_ICON[c] + ' ' + CURS[c] + '<br><span class="gh-sm">' + (ok ? fmtS(shownBal(c)) : '—') + '</span></button>';
    }).join('') + '</div><div class="gh-sm">' + (game === 'bac' ? '每局下注' : '每轉注額') + '：' + fmt(lim[ui.cur][0]) + '～' + fmt(lim[ui.cur][1]) + (ui.cur === 'gold' ? ' 金幣' : ' 顆') + '</div>';
  }
  function render() {
    var w = el('afk-gh-win'); if (!w || w.style.display === 'none') return;
    if (!curReady(ui.cur)) ui.cur = 'gold';
    var h;
    if (ui.view === 'bac' && !classic()) h = renderBac();
    else if (ui.view === 'slot' && !classic()) h = renderSlot();
    else if (ui.view === 'mary' && !classic()) h = renderMary();
    else if (ui.view === 'stats') h = renderStats();
    else h = renderHome();
    w.innerHTML = h;
  }
  function renderHome() {
    var cl = classic(), h = head('🎰 遊戲廳', '荷官洛蒂的遊戲廳', false) + '<div class="gh-body">';
    h += '<div class="gh-cards">';
    if (!cl && W.__afkPoker && W.__afkPoker.on && W.__afkPoker.on()) h += '<button type="button" class="gh-card" data-gh="poker"><span class="ico">♠︎</span><b>德州撲克</b><span>無限注，對 3～5 位 NPC；有超難桌</span></button>';
    if (!cl) h += '<button type="button" class="gh-card" data-gh="go:bac"><span class="ico">🃏</span><b>百家樂</b><span>押莊、閒、和、對子；8 副牌</span></button>';
    if (!cl) h += '<button type="button" class="gh-card" data-gh="go:slot"><span class="ico">🔺</span><b>' + SLOT_NAME + '</b><span>埃及拉霸：消除連鎖、太陽倍數、免費遊戲</span></button>';
    if (!cl && W.__afkFish && W.__afkFish.on()) h += '<button type="button" class="gh-card" data-gh="fish"><span class="ico">🐟</span><b>' + W.__afkFish.NAME + '</b><span>捕魚機：法利昂、幽靈船長、特殊武器、JP 轉盤</span></button>';
    if (!cl) h += '<button type="button" class="gh-card" data-gh="go:mary"><span class="ico">🍒</span><b>' + MARY_NAME + '</b><span>水果盤跑燈、ONCE MORE 送燈、比倍、JP</span></button>';
    if (typeof W.openRaceWindow === 'function') h += '<button type="button" class="gh-card" data-gh="dog"><span class="ico">🐕</span><b>賽狗場</b><span>奇岩賽狗，押冠軍</span></button>';
    if (!cl && W.LineageArcadeEntry) h += '<button type="button" class="gh-card" data-gh="arcade:tian"><span class="ico">🀄</span><b>四人打天九</b><span>傳統文武牌組・一般／超強 AI 桌</span></button><button type="button" class="gh-card" data-gh="arcade:bj"><span class="ico">♠</span><b>21 點</b><span>要牌、停牌、加倍・超強 AI 擂台</span></button><button type="button" class="gh-card" data-gh="arcade:pin"><span class="ico">●</span><b>柏青哥</b><span>三台機器・入賞抽選・大當與 ST</span></button>';
    h += '</div>';
    if (!cl) h += '<div class="gh-btns"><button type="button" data-gh="go:stats">📊 戰績</button></div>';
    else h += '<div class="gh-msg">經典模式只開放賽狗場。</div>';
    return h + '</div>';
  }
  function renderStats() {
    var d = hallData() || { st: {} }, td = today(), h = head('📊 遊戲廳戰績', '', true) + '<div class="gh-body">';
    [['bac', '🃏 百家樂'], ['slot', '🔺 ' + SLOT_NAME], ['mary', '🍒 ' + MARY_NAME], ['fish', '🐟 ' + ((W.__afkFish && W.__afkFish.NAME) || '捕魚機')]].forEach(function (g) {
      h += '<div style="font-weight:800;color:#fde68a;margin:6px 0 2px">' + g[1] + '</div><table class="gh-stat"><tr><th>幣別</th><th>局數</th><th>今日淨輸贏</th><th>累計淨輸贏</th><th>最大一筆</th></tr>';
      ['gold', 'dia', 'blood'].forEach(function (c) {
        var s = d.st[g[0] + ':' + c]; if (!s) return h += '<tr><td>' + CURS[c] + '</td><td colspan="4" class="gh-sm">還沒玩過</td></tr>';
        var tn = s.day === td ? s.tWon - s.tBet : 0, an = s.won - s.bet;
        var col = function (n) { return '<span style="color:' + (n > 0 ? '#4ade80' : n < 0 ? '#f87171' : '#cbd5e1') + '">' + (n > 0 ? '+' : '') + fmt(n) + '</span>'; };
        h += '<tr><td>' + CURS[c] + '</td><td>' + fmt(s.n) + '</td><td>' + col(tn) + '</td><td>' + col(an) + '</td><td>' + (s.best ? '×' + fmt(Math.round(s.best * 100) / 100) : '—') + '</td></tr>';
      });
      h += '</table>';
    });
    return h + '<div class="gh-sm" style="margin-top:6px">「最大一筆」＝贏回金額是當局注額的幾倍。今日以台灣時間 00:00 換日。</div></div>';
  }

  // ── 百家樂畫面 ──
  function chipOf(cur) { var c = bac.chip[cur]; return CHIPS[cur].indexOf(c) >= 0 ? c : CHIPS[cur][0]; }
  function bacCardHtml(c, extra) { var r = cR(c), s = cS(c); return '<span class="bc-c' + (s === 1 || s === 2 ? ' r' : '') + (extra || '') + '"><b>' + (RTXT[r] || r) + '</b><i>' + SUIT[s] + '</i></span>'; }
  function renderBac() {
    if (!bac.shoe) bac.shoe = newShoe(rng);
    var bets = bac.bets, res = bac.res, n = bac.reveal, h = head('🃏 百家樂', '莊抽 5%・剩 ' + (bac.shoe.cards.length - bac.shoe.pos) + ' 張', true) + '<div class="gh-body">';
    h += curBar('bac');
    // 牌
    var order = res ? [['p', 0], ['b', 0], ['p', 1], ['b', 1]].concat(res.p.length > 2 ? [['p', 2]] : []).concat(res.b.length > 2 ? [['b', 2]] : []) : [];
    var shown = { p: 0, b: 0 }; for (var i = 0; i < Math.min(n, order.length); i++) shown[order[i][0]]++;
    var done = res && n >= order.length;
    var side = function (k, nm) {
      var cards = res ? res[k].slice(0, shown[k]) : [], pts = cards.reduce(function (s, c) { return s + cV(c); }, 0) % 10;
      var w = done && res.win === k.toUpperCase();
      return '<div class="bc-side ' + k.toUpperCase() + (w ? ' win' : '') + '"><h4>' + nm + '</h4><div class="bc-hand">' + cards.map(function (c, j) { return bacCardHtml(c, (j === 2 ? ' side' : '') + (j === shown[k] - 1 && !done ? ' in' : '')); }).join('') + '</div><div class="bc-pts">' + (cards.length ? pts + ' 點' : '&nbsp;') + '</div></div>';
    };
    h += '<div class="bc-table">' + side('p', '閒 PLAYER') + side('b', '莊 BANKER') + '</div>';
    h += '<div class="gh-msg" id="gh-msg">' + esc(ui.msg || '選好籌碼，點下注格押注，再按「發牌」。') + '</div>';
    // 下注格
    var hit = function (id) { if (!done) return false; return (id === res.win) || (id === 'PP' && res.pp) || (id === 'BP' && res.bp); };
    h += '<div class="bc-spots">' + SPOTS.map(function (s) {
      return '<button type="button" class="bc-spot ' + s.id + (hit(s.id) ? ' hit' : '') + '" data-gh="bet:' + s.id + '"' + (ui.busy ? ' disabled' : '') + '><b>' + s.n + '</b><small>' + s.pay + '</small><em>' + (bets[s.id] ? fmtS(bets[s.id]) : '') + '</em></button>';
    }).join('') + '</div>';
    var ch = chipOf(ui.cur);
    h += '<div class="bc-chips" role="group" aria-label="籌碼">' + CHIPS[ui.cur].map(function (c) { return '<button type="button" data-gh="chip:' + c + '"' + (c === ch ? ' class="on"' : '') + '>' + fmtS(c) + '</button>'; }).join('') + '</div>';
    var tot = betTotal(bets);
    h += '<div class="gh-sm" style="margin-top:5px">這局押 ' + fmt(tot) + '・你有' + esc(amtTxt(ui.cur, shownBal(ui.cur))) + '</div>';
    if (ui.auto) h += '<div class="gh-btns"><button type="button" class="stop" data-gh="stop">停止自動（剩 ' + ui.autoLeft + ' 局）</button></div>';
    else h += '<div class="gh-btns"><button type="button" class="go" data-gh="deal"' + (ui.busy ? ' disabled' : '') + '>發牌</button><button type="button" data-gh="rebet"' + (ui.busy || !bac.last ? ' disabled' : '') + '>重複上一注</button><button type="button" data-gh="dbl"' + (ui.busy || !tot ? ' disabled' : '') + '>加倍</button><button type="button" data-gh="clear"' + (ui.busy || !tot ? ' disabled' : '') + '>清除</button></div>'
      + '<div class="gh-btns"><button type="button" data-gh="auto:10"' + (ui.busy ? ' disabled' : '') + '>自動 10 局</button><button type="button" data-gh="auto:25"' + (ui.busy ? ' disabled' : '') + '>25 局</button><button type="button" data-gh="auto:50"' + (ui.busy ? ' disabled' : '') + '>50 局</button></div>';
    h += '<div style="margin-top:6px"><label class="gh-tog"><input type="checkbox" data-gh="quick"' + (ui.quick ? ' checked' : '') + '> 快速（不播翻牌動畫）</label></div>';
    // 路單
    var road = bac.shoe.road, bead = road.slice(-60), br = bigRoad(road), cnt = { P: 0, B: 0, T: 0 };
    road.forEach(function (x) { cnt[x]++; });
    var beadH = '<div class="bc-grid" aria-label="珠盤路">' + bead.map(function (x) { return '<i class="' + x + '">' + ({ P: '閒', B: '莊', T: '和' })[x] + '</i>'; }).join('') + '</div>';
    var c0 = Math.max(0, br.cols - 24), big = '';
    for (var c = c0; c < Math.max(br.cols, c0 + 12); c++) for (var r = 0; r < 6; r++) { var x = br.cells[c + ',' + r]; big += x ? '<i class="' + x.w + '">' + (x.t ? '<u></u>' + (x.t > 1 ? x.t : '') : '') + '</i>' : '<i></i>'; }
    h += '<div class="bc-road">' + beadH + '<div class="bc-cnt"><span style="color:#f87171">莊 ' + cnt.B + '</span><br><span style="color:#60a5fa">閒 ' + cnt.P + '</span><br><span style="color:#4ade80">和 ' + cnt.T + '</span></div></div>';
    h += '<div class="bc-road"><div class="bc-grid big" aria-label="大路">' + big + '</div></div>';
    return h + '</div>';
  }
  function bacAdd(id) {
    if (ui.busy) return;
    var lim = LIM.bac[ui.cur], c = chipOf(ui.cur), tot = betTotal(bac.bets);
    if (bac.res && bac.reveal >= 99) { bac.res = null; }
    if (tot + c > lim[1]) { ui.msg = '這局最多押 ' + fmt(lim[1]) + '。'; return render(); }
    bac.bets[id] = (bac.bets[id] || 0) + c; ui.msg = ''; render();
  }
  function bacDealRound(isAuto) {
    if (ui.busy) return false;
    var bets = bac.bets, tot = betTotal(bets), lim = LIM.bac[ui.cur], cur = ui.cur;
    if (!tot) { ui.msg = '先押注再發牌。'; render(); return false; }
    if (tot < lim[0]) { ui.msg = '這局至少要押 ' + fmt(lim[0]) + '。'; render(); return false; }
    if (tot > lim[1]) { ui.msg = '這局最多押 ' + fmt(lim[1]) + '。'; render(); return false; }
    if (balance(cur) < tot) { ui.msg = CURS[cur] + '不夠（這局要 ' + fmt(tot) + '）。'; stopAuto(); render(); return false; }
    if (!bac.shoe || bac.shoe.cards.length - bac.shoe.pos < CUT) { bac.shoe = newShoe(rng); ui.msg = '洛蒂換了一副新牌靴。'; }
    if (!debit(cur, tot)) { ui.msg = '扣款失敗，這局沒有開。'; stopAuto(); render(); return false; }
    ui.hold = { cur: cur, v: balance(cur) };
    var r = bacDeal(bac.shoe), ret = bacReturn(bets, r);
    var got = settle('bac', cur, tot, ret, ret / 100 / tot);
    bac.shoe.road.push(r.win);
    bac.last = { cur: cur, bets: JSON.parse(JSON.stringify(bets)) };
    bac.res = r; bac.result = { tot: tot, got: got, cur: cur };
    var steps = 4 + (r.p.length > 2 ? 1 : 0) + (r.b.length > 2 ? 1 : 0);
    var fin = function () {
      bac.reveal = 99; ui.busy = false;
      var net = got - tot, wn = ({ P: '閒贏', B: '莊贏', T: '和局' })[r.win];
      ui.msg = '閒 ' + r.pv + ' 點、莊 ' + r.bv + ' 點：' + wn + (r.pp ? '・閒對' : '') + (r.bp ? '・莊對' : '') + '。' + (net > 0 ? '你贏了 ' + fmt(net) + '！' : net < 0 ? (got > 0 ? '拿回 ' + fmt(got) + '，' : '') + '輸了 ' + fmt(-net) + '。' : '不輸不贏。');
      bac.bets = {};
      render();
      if (ui.auto) {
        if (got >= tot * 50) { ui.msg += '（贏到 50 倍以上，自動停下）'; stopAuto(); return render(); }
        if (--ui.autoLeft <= 0) { stopAuto(); return render(); }
        later(function () { if (!ui.auto) return; bac.bets = JSON.parse(JSON.stringify(bac.last.bets)); bacDealRound(true); }, ui.quick ? 350 : 900);
      }
    };
    if (ui.quick) { bac.reveal = 99; fin(); return true; }
    ui.busy = true; bac.reveal = 0; render();
    var step = function () { bac.reveal++; render(); if (bac.reveal >= steps) later(fin, 450); else later(step, 420); };
    later(step, 200);
    return true;
  }
  function stopAuto() { ui.auto = 0; ui.autoLeft = 0; }

  // ── 拉霸畫面 ──
  function slBet(cur) { var b = sl.bet[cur]; return STEPS[cur].indexOf(b) >= 0 ? b : STEPS[cur][0]; }
  function cellHtml(cv, hit, drop) {
    var I = art(), k = symKey(cv);
    return '<div class="sl-cell' + (hit ? ' hit' : '') + (drop ? ' drop' : '') + '"><img alt="" src="' + I[k] + '">' + (cv.s === 'M' ? '<span class="mv">×' + cv.v + '</span>' : '') + '</div>';
  }
  function gridHtml(grid, hitSyms, drop) {
    var h = '';
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var cv = grid[c][r]; h += cellHtml(cv, hitSyms && typeof cv.s === 'number' && hitSyms[cv.s], drop); }
    return h;
  }
  var idleGrid = null;
  function renderSlot() {
    var bet = slBet(ui.cur), h = head('🔺 ' + SLOT_NAME, '6×5・8 個以上中獎', true) + '<div class="gh-body">';
    h += curBar('slot');
    var sh = sl.show;
    if (!idleGrid) { idleGrid = slotSpin(rng, false).steps[0].grid; }
    var grid = sh ? sh.grid : idleGrid;
    h += '<div class="sl-top"><span id="sl-info">' + esc(sl.fsInfo || '') + '</span><span id="sl-win">' + (sh && sh.win ? '贏 ' + fmt(sh.win) : '') + '</span></div>';
    h += '<div class="sl-grid" id="sl-grid">' + gridHtml(grid, sh && sh.hit, sh && sh.drop) + (sl.ov ? '<div class="sl-ov' + (sl.ovBig ? ' big' : '') + '">' + sl.ov + '</div>' : '') + '</div>';
    h += '<div class="gh-msg" id="gh-msg">' + esc(ui.msg || '同一種圖示全盤 8 個以上就中獎；中獎的會消掉，上面的掉下來繼續連鎖。') + '</div>';
    h += '<div class="sl-bet"><button type="button" data-gh="bet-"' + (ui.busy || ui.auto ? ' disabled' : '') + ' aria-label="降低注額">－</button><div class="amt">每轉 ' + esc(amtTxt(ui.cur, bet)) + '</div><button type="button" data-gh="bet+"' + (ui.busy || ui.auto ? ' disabled' : '') + ' aria-label="提高注額">＋</button></div>';
    h += '<div class="gh-sm" style="margin-top:4px;text-align:center">你有' + esc(amtTxt(ui.cur, shownBal(ui.cur))) + '</div>';
    if (ui.auto) h += '<div class="gh-btns"><button type="button" class="stop" data-gh="stop">停止自動（剩 ' + ui.autoLeft + ' 轉）</button></div>';
    else h += '<div class="gh-btns"><button type="button" class="go" data-gh="spin"' + (ui.busy ? ' disabled' : '') + ' style="font-size:16px">轉！</button></div>'
      + '<div class="gh-btns"><button type="button" data-gh="sauto:10"' + (ui.busy ? ' disabled' : '') + '>自動 10</button><button type="button" data-gh="sauto:25"' + (ui.busy ? ' disabled' : '') + '>25</button><button type="button" data-gh="sauto:50"' + (ui.busy ? ' disabled' : '') + '>50</button><button type="button" data-gh="sauto:100"' + (ui.busy ? ' disabled' : '') + '>100</button></div>';
    h += '<div style="margin-top:6px"><label class="gh-tog"><input type="checkbox" data-gh="quick"' + (ui.quick ? ' checked' : '') + '> 快轉（跳過消除動畫）</label></div>';
    // 賠率表
    var I = art();
    h += '<details style="margin-top:6px"><summary class="gh-sm" style="cursor:pointer">賠率表（× 每轉注額）</summary><table class="sl-pay"><tr><th>圖示</th><th>8～9</th><th>10～11</th><th>12+</th></tr>'
      + SYMS.map(function (s) { return '<tr><td style="text-align:left"><img alt="" src="' + I[s.k] + '"> ' + s.n + '</td><td>' + s.pay[0] / 100 + '</td><td>' + s.pay[1] / 100 + '</td><td>' + s.pay[2] / 100 + '</td></tr>'; }).join('')
      + '<tr><td style="text-align:left"><img alt="" src="' + I.S + '"> 金字塔</td><td colspan="3">4／5／6 個＝3／5／100 倍，並進入免費遊戲 15 轉</td></tr>'
      + '<tr><td style="text-align:left"><img alt="" src="' + I.M + '"> 太陽圓盤</td><td colspan="3">帶 ×2～×500；這一轉有中獎時，全部倍數相加再乘上獎金</td></tr></table>'
      + '<div class="gh-sm" style="margin-top:4px;line-height:1.5">免費遊戲：3 個以上金字塔再 +5 轉；有中獎時太陽倍數會加進「總倍數」一直累積。每次下注（含整段免費遊戲）最多贏 ' + fmt(SLOT_CAP) + ' 倍注額。</div></details>';
    return h + '</div>';
  }
  function finishShow() { if (sl.tell) { try { sl.tell(); } catch (e) {} sl.tell = null; } if (sl.res && sl.show) { sl.show = { grid: lastGrid(sl.res), win: sl.res.got }; } sl.ov = ''; sl.fsInfo = ''; ui.busy = false; }
  function lastGrid(res) { var s = res.fs && res.fs.length ? res.fs[res.fs.length - 1].spin : res.base; return s.steps[s.steps.length - 1].grid; }
  function tierOf(x) { return x >= 500 ? '傳說大獎' : x >= 100 ? '超級大獎' : x >= 20 ? '大獎' : ''; }
  function announce(x, got, cur) {
    if (x < 500) return;
    try {
      var p = P(), nm = esc((p && p.name) || '冒險者');
      if (typeof W.logWorld === 'function') W.logWorld('<span class="wc-answer">🔺【遊戲廳】<b style="color:#fde047">' + nm + '</b> 在' + SLOT_NAME + '拉到<b style="color:#f59e0b">傳說大獎</b>：' + fmt(Math.floor(x)) + ' 倍，贏得 ' + esc(amtTxt(cur, got)) + '！</span>');
    } catch (e) {}
  }
  function slotRound() {
    if (ui.busy) return false;
    var cur = ui.cur, bet = slBet(cur), lim = LIM.slot[cur];
    if (bet < lim[0] || bet > lim[1]) { ui.msg = '注額超出範圍。'; render(); return false; }
    if (balance(cur) < bet) { ui.msg = CURS[cur] + '不夠（每轉要 ' + fmt(bet) + '）。'; stopAuto(); render(); return false; }
    if (!debit(cur, bet)) { ui.msg = '扣款失敗，這一轉沒有開。'; stopAuto(); render(); return false; }
    ui.hold = { cur: cur, v: balance(cur) };
    var res = (TESTQ.length ? TESTQ.shift() : null) || slotPlay(rng), x = res.total / 100;
    var got = settle('slot', cur, bet, res.total * bet, x);
    res.got = got; res.bet = bet; res.cur = cur; sl.res = res;
    var told = false, tell = function () { if (!told) { told = true; announce(x, got, cur); } };
    sl.tell = tell;
    var endMsg = function () {
      var t = tierOf(x);
      ui.msg = got > 0 ? (t ? '🎉 ' + t + '！' : '') + '贏得 ' + amtTxt(cur, got) + '（' + (Math.round(x * 100) / 100) + ' 倍）' + (res.capped ? '・已達 ' + fmt(SLOT_CAP) + ' 倍上限' : '') : '沒有中獎。';
    };
    var fin = function () {
      tell(); ui.busy = false; sl.fsInfo = res.fs ? '免費遊戲結束・共 ' + res.fs.length + ' 轉' : ''; endMsg();
      var t = tierOf(x); sl.ov = t ? '<b>' + t + '</b><span>' + esc(amtTxt(cur, got)) + '</span>' : ''; sl.ovBig = !!t;
      sl.show = { grid: lastGrid(res), win: got };
      render();
      if (t) later(function () { sl.ov = ''; render(); }, ui.quick ? 900 : 1800);
      if (ui.auto) {
        if (x >= 100) { ui.msg += '（贏到 100 倍以上，自動停下）'; stopAuto(); return render(); }
        if (res.fs) { ui.msg += '（進了免費遊戲，自動停下）'; stopAuto(); return render(); }
        if (--ui.autoLeft <= 0) { stopAuto(); return render(); }
        later(function () { if (ui.auto) slotRound(); }, t ? 1900 : (ui.quick ? 250 : 600));
      }
    };
    if (ui.quick) { fin(); return true; }
    ui.busy = true; ui.msg = ''; sl.ov = ''; sl.fsInfo = '';
    // 動畫：基本盤每一段連鎖 → 金字塔 → 免費遊戲每一轉
    var seq = [];
    var addSpin = function (sp, info, payTxt) {
      sp.steps.forEach(function (st, i) {
        seq.push({ grid: st.grid, drop: true, info: info, win: payTxt ? payTxt(i, false) : 0, wait: 380 });
        if (st.wins.length) { var hs = {}; st.wins.forEach(function (w) { hs[w.sym] = 1; }); seq.push({ grid: st.grid, hit: hs, info: info, win: payTxt ? payTxt(i, true) : 0, wait: 520 }); }
      });
    };
    var acc = function (sp, upto, hitNow) { var s = 0; for (var i = 0; i <= upto && i < sp.steps.length; i++) if (i < upto || hitNow) sp.steps[i].wins.forEach(function (w) { s += w.pay100; }); return s; };
    addSpin(res.base, '', function (i, hn) { return Math.floor(acc(res.base, i, hn) * bet / 100); });
    if (res.base.mults.length && res.base.pay100 > 0) seq.push({ grid: lastGrid({ base: res.base }), info: '太陽倍數 ×' + res.base.mults.reduce(function (a, b) { return a + b; }, 0), win: Math.floor(res.baseWin * bet / 100), wait: 800 });
    if (res.fs) {
      seq.push({ grid: lastGrid({ base: res.base }), info: '🔺 ' + res.base.scat + ' 個金字塔！', ov: '<b>免費遊戲</b><span>15 轉</span>', win: Math.floor((res.baseWin + res.scatWin) * bet / 100), wait: 1500 });
      var run = res.baseWin + res.scatWin;
      res.fs.forEach(function (f, k) {
        var info = '免費遊戲 第 ' + (k + 1) + ' 轉・剩 ' + f.left + '・總倍數 ×' + (f.totMult || 0) + (f.add ? '・＋5 轉！' : '');
        var base = run;
        addSpin(f.spin, info, function (i, hn) { return Math.floor((base + acc(f.spin, i, hn)) * bet / 100); });
        run += f.pay;
        if (f.pay > 0 && f.totMult > 0) seq.push({ grid: f.spin.steps[f.spin.steps.length - 1].grid, info: info, win: Math.floor(run * bet / 100), wait: 600 });
      });
    }
    var i = 0;
    var tick = function () {
      if (i >= seq.length) return fin();
      var s = seq[i++]; sl.show = { grid: s.grid, hit: s.hit, drop: s.drop, win: s.win }; sl.fsInfo = s.info || ''; sl.ov = s.ov || ''; sl.ovBig = !!s.ov;
      render(); later(tick, s.wait);
    };
    tick();
    return true;
  }

  // ── 亞丁小瑪莉畫面 ──
  var my = { bets: [0, 0, 0, 0, 0, 0, 0, 0, 0], last: null, pos: 0, on: -1, lit: [], ev: '', dig: '', knF: 0, slF: 0, slKind: 'idle', anim: null };
  var KN = 'assets/classanim/' + encodeURIComponent('男騎士d6') + '/', SL = 'assets/anim/' + encodeURIComponent('象牙塔果凍怪') + '/';
  var KN_ATK = 7;
  var fr = function (base, kind, i) { return base + kind + '_' + i + (i === 0 ? '.png' : '.webp'); };
  function maryUnit(cur) { return MARY_UNIT[cur]; }
  function maryPts(bets) { return bets.reduce(function (a, b) { return a + b; }, 0); }
  function maryPend() { var d = hallData(); return d && d.mary && d.mary.win > 0 ? d.mary : null; }
  function jpGet(cur) {
    if (cur === 'dia') { var v = Number(LS('afk_gh_jp_dia')); return v > 0 ? v : JP_SEED.dia * 100; }
    var d = hallData(); if (!d) return JP_SEED[cur] * 100; d.jp = d.jp || {}; return d.jp[cur] > 0 ? d.jp[cur] : JP_SEED[cur] * 100;
  }
  function jpSet(cur, v100) { if (cur === 'dia') LS('afk_gh_jp_dia', String(v100)); else { var d = hallData(); if (d) { d.jp = d.jp || {}; d.jp[cur] = v100; } } }
  // 收分：WIN 錶 → 身上
  // 收分：WIN 錶 → 身上。part＝只收一部分（剩下的留在 WIN 錶繼續比倍）
  function maryCollect(quiet, part) {
    var m = maryPend(); if (!m) return 0;
    var cur = m.cur, unit = maryUnit(cur), amt = m.win;
    if (part === 'half') { amt = Math.floor(m.win / unit / 2) * unit; if (amt <= 0 || amt >= m.win) amt = m.win; }
    if (!credit(cur, amt)) return 0;
    m.got = (m.got || 0) + amt;
    var all = amt >= m.win;
    statAdd('mary', cur, 0, amt, all && m.cost ? m.got / m.cost : 0, false);
    var d = hallData();
    if (all) d.mary = null; else m.win -= amt;
    safeSave();
    if (!quiet) ui.msg = '收分 ' + amtTxt(cur, amt) + '。' + (all ? '' : '剩下 ' + fmt(Math.floor(m.win / unit)) + ' 分留在 WIN，可以繼續比倍或收分。');
    return amt;
  }
  function renderMary() {
    var cur = ui.cur, unit = maryUnit(cur), pend = maryPend(), I = art();
    if (pend && pend.cur !== cur) cur = ui.cur = pend.cur;
    var credit_ = Math.floor(shownBal(cur) / unit), win = pend ? Math.floor(pend.win / unit) : 0;
    if (ui.busy && my.showWin != null) win = my.showWin;
    var h = head('🍒 ' + MARY_NAME, '1 分＝' + fmt(unit) + (cur === 'gold' ? ' 金幣' : ' 顆'), true) + '<div class="gh-body">';
    h += curBar('mary');
    h += '<div class="my-led"><div><small>WIN</small><b>' + String(win).padStart(6, '0').slice(-8) + '</b></div><div><small>CREDIT</small><b>' + String(credit_).padStart(6, '0').slice(-8) + '</b></div></div>';
    // 盤面
    var pos = function (i) { if (i <= 6) return [1, i + 1]; if (i <= 11) return [i - 5, 7]; if (i <= 18) return [7, 7 - (i - 12)]; return [7 - (i - 18), 1]; };
    h += '<div class="my-board">';
    for (var i = 0; i < 24; i++) {
      var c = RING[i], rc = pos(i), cls = 'my-cell' + (my.on === i ? ' on' : '') + (my.lit.indexOf(i) >= 0 ? ' lit' : '') + (my.fl && my.fl[i] ? ' fl' : '');
      if (c === 'O') h += '<div class="' + cls + ' once" style="grid-row:' + rc[0] + ';grid-column:' + rc[1] + '">ONCE<br>MORE</div>';
      else h += '<div class="' + cls + (c[1] ? ' sm' : '') + '" style="grid-row:' + rc[0] + ';grid-column:' + rc[1] + '"><img alt="' + MF[c[0]].n + '" src="' + I[MF[c[0]].k] + '">' + (c[1] ? '<i>×3</i>' : '') + '</div>';
    }
    var jp = Math.floor(jpGet(cur) / 100);
    h += '<div class="my-center"><div class="my-jp"><b>JP</b><span>' + fmt(jp) + '</span></div>'
      + '<img class="my-kn" alt="" src="' + fr(KN, my.knAtk ? 'sword2_attack' : 'sword2_idle', my.knF) + '">'
      + (my.slKind !== 'gone' ? '<img class="my-sl" alt="" src="' + fr(SL, my.slKind, my.slF) + '">' : '')
      + (my.dig !== '' ? '<div class="my-dig">' + my.dig + '</div>' : '')
      + (my.ev ? '<div class="my-ev">' + esc(my.ev) + '</div>' : '') + '</div>';
    h += '</div>';
    // 賠率＋押注 LED
    h += '<div class="my-pay">' + MF.map(function (f, i) { return '<div><small>' + f.odds + '</small><img alt="" src="' + I[f.k] + '"><b>' + String(my.bets[i]).padStart(2, '0') + '</b></div>'; }).join('') + '</div>';
    var lock = ui.busy || !!pend || !!ui.auto;
    h += '<div class="my-keys">' + MF.map(function (f, i) { return '<button type="button" data-gh="mb:' + i + '" aria-label="押' + f.n + '"' + (lock ? ' disabled' : '') + '><img alt="" src="' + I[f.k] + '"></button>'; }).join('') + '</div>';
    var dbl = pend && !ui.busy && !ui.auto && (pend.n || 0) < DBL_MAX;
    h += '<div class="my-ctl">'
      + '<button type="button" class="out" data-gh="home">離開</button>'
      + '<button type="button" data-gh="mcol"' + (pend && !ui.busy ? '' : ' disabled') + '>WIN→<br>CREDIT</button>'
      + '<button type="button" data-gh="mcolh"' + (pend && !ui.busy && Math.floor(pend.win / unit) >= 2 ? '' : ' disabled') + '>收一半</button>'
      + '<button type="button" data-gh="mdbl:s"' + (dbl ? '' : ' disabled') + '>比倍<br>小 1-4</button>'
      + '<button type="button" data-gh="mdbl:b"' + (dbl ? '' : ' disabled') + '>比倍<br>大 6-9</button>'
      + (ui.auto ? '<button type="button" class="out" data-gh="stop">停止<br>' + ui.autoLeft + '</button>' : '<button type="button" class="go" data-gh="mgo"' + (ui.busy ? ' disabled' : '') + '>開始</button>')
      + '</div>';
    h += '<div class="gh-msg" id="gh-msg">' + esc(ui.msg || (pend ? '贏分 ' + fmt(Math.floor(pend.win / unit)) + ' 分：可以比倍（猜小 1-4／大 6-9，開 5 莊家通殺），或按 WIN→CREDIT 收分。' : '點下面的水果押分（每種 0～99 分），按「開始」。9 種全押、大 BAR 亮起時開出 777 就中 JP。')) + '</div>';
    var tot = maryPts(my.bets);
    h += '<div class="gh-sm">這局押 ' + tot + ' 分＝' + esc(amtTxt(cur, tot * unit)) + '</div>';
    h += '<div class="gh-btns"><button type="button" data-gh="mall"' + (lock ? ' disabled' : '') + '>全押 +1</button><button type="button" data-gh="mclr"' + (lock ? ' disabled' : '') + '>清除</button><button type="button" data-gh="mre"' + (lock || !my.last ? ' disabled' : '') + '>重複上一局</button>'
      + '<button type="button" data-gh="mauto:10"' + (lock ? ' disabled' : '') + '>自動 10</button><button type="button" data-gh="mauto:25"' + (lock ? ' disabled' : '') + '>25</button><button type="button" data-gh="mauto:50"' + (lock ? ' disabled' : '') + '>50</button></div>';
    h += '<div style="margin-top:6px"><label class="gh-tog"><input type="checkbox" data-gh="quick"' + (ui.quick ? ' checked' : '') + '> 快速（縮短跑燈）</label></div>';
    h += '<details style="margin-top:6px"><summary class="gh-sm" style="cursor:pointer">規則</summary><div class="gh-sm" style="line-height:1.6">'
      + '燈停在哪一格，就賠那種水果押的分數 × 賠率；畫小一號、標 ×3 的格子固定賠 3 倍。<br>'
      + 'ONCE MORE：隨機送燈——再送一燈、送 2～4 燈、開火車（後面 3～7 格一起亮）、小三元（柳丁、檸檬、鈴鐺）、大三元（西瓜、星星、77）、大四喜（4 個蘋果），也可能槓龜。<br>'
      + 'JP：每局押注的 1.5% 進獎池；9 種全押、而且大 BAR 那格亮起時，中間會跳一組 000～999 的號碼，開出 777 就整池給你（不能比倍）。<br>'
      + '比倍：開 1～9，猜中小（1～4）或大（6～9）贏分翻倍，猜錯或開 5 歸零；最多比 ' + DBL_MAX + ' 次。比之前可以先按「收一半」把一半收進來，只拿剩下的去比。<br>中王牌（大格 BAR、77、星星）或頭獎（JP）時會跳燈。</div></details>';
    return h + '</div>';
  }
  function maryAnimSprites(kind) {   // 中間插畫：贏了騎士出拳、果凍怪挨打（大獎打飛）
    var kt = 0, st = 0;
    my.knAtk = true; my.knF = 0; my.slKind = kind === 'big' ? 'death' : 'hurt'; my.slF = 0;
    var n = kind === 'big' ? 11 : 2;
    var step = function () {
      if (my.knF < KN_ATK - 1) my.knF++; else { my.knAtk = false; my.knF = 0; }
      if (my.slF < n - 1) my.slF++; else if (my.slKind === 'death') my.slKind = 'gone';
      render();
      if (++kt < 12) later(step, 90); else { my.slKind = 'idle'; my.slF = 0; my.knAtk = false; my.knF = 0; render(); }
    };
    later(step, 90);
  }
  function maryRound() {
    if (ui.busy) return false;
    if (maryPend()) { ui.msg = '先收分或比倍。'; render(); return false; }
    var cur = ui.cur, unit = maryUnit(cur), pts = maryPts(my.bets), cost = pts * unit, lim = LIM.mary[cur];
    if (!pts) { ui.msg = '先押分。'; stopAuto(); render(); return false; }
    if (cost < lim[0]) { ui.msg = '這局至少要押 ' + fmt(Math.ceil(lim[0] / unit)) + ' 分（' + amtTxt(cur, lim[0]) + '）。'; stopAuto(); render(); return false; }
    if (cost > lim[1]) { ui.msg = '這局最多押 ' + fmt(Math.floor(lim[1] / unit)) + ' 分（' + amtTxt(cur, lim[1]) + '）。'; stopAuto(); render(); return false; }
    if (balance(cur) < cost) { ui.msg = CURS[cur] + '不夠（這局要 ' + fmt(cost) + '）。'; stopAuto(); render(); return false; }
    if (!debit(cur, cost)) { ui.msg = '扣款失敗，這局沒有開。'; stopAuto(); render(); return false; }
    ui.hold = { cur: cur, v: balance(cur) };
    var bets = my.bets.slice(), r = maryPlay(rng, bets), winAmt = r.pts * unit, jpAmt = 0;
    // JP：先抽 1.5% 進池，再看有沒有中
    var pool = jpGet(cur) + cost * JP_RATE / 100;
    if (r.jp) { jpAmt = Math.floor(pool / 100); pool = JP_SEED[cur] * 100 + (pool - jpAmt * 100); }
    jpSet(cur, pool);
    settle('mary', cur, cost, jpAmt * 100, null);
    var d = hallData();
    if (winAmt > 0) d.mary = { cur: cur, win: winAmt, base: winAmt, cost: cost, n: 0 };
    safeSave();
    if (ui.auto && winAmt > 0) maryCollect(true);
    my.last = bets; ui.msg = '';
    var evName = r.ev ? (MEV.filter(function (x) { return x[0] === r.ev; })[0] || [0, 0, ''])[2] : '';
    // 跳燈：王牌（大格 BAR、77、星星有押中）或頭獎（JP）——整圈追燈＋全盤閃
    var trump = r.lit.some(function (i) { var c = RING[i]; return c !== 'O' && !c[1] && c[0] <= 2 && bets[c[0]] > 0; });
    var fin = function () {
      if (!fin.shown && (r.jp || trump)) {
        fin.shown = true; ui.busy = true;
        var laps = r.jp ? 4 : 2, flashes = r.jp ? 12 : 6, k = 0, keepLit = my.lit.slice(), start = my.pos || 0;
        my.ev = r.jp ? '🎰 頭獎 JP！' : '👑 王牌！';
        var chase = function () {
          my.on = (start + k) % 24; my.fl = {}; for (var q = 0; q < 4; q++) my.fl[(start + k - q * 6 + 240) % 24] = 1;
          render();
          if (++k < laps * 24) later(chase, r.jp ? 28 : 36); else { k = 0; my.on = -1; later(flash, 60); }
        };
        var flash = function () {
          my.fl = {}; for (var q = 0; q < 24; q++) if ((q + k) % 2 === 0) my.fl[q] = 1;
          my.lit = k % 2 ? keepLit.slice() : [];
          render();
          if (++k < flashes) later(flash, 150); else { my.fl = null; my.lit = keepLit; fin(); }
        };
        chase();
        return;
      }
      ui.busy = false; my.showWin = null; my.ev = ''; my.on = -1; my.fl = null;
      var big = r.jp || r.pts >= pts * 20;
      if (r.jp) { ui.msg = '🎰 JP！拿走整個獎池 ' + amtTxt(cur, jpAmt) + '！' + (winAmt ? '另外贏分 ' + fmt(r.pts) + ' 分。' : ''); announceJp(cur, jpAmt); }
      else if (winAmt > 0) ui.msg = (evName && r.ev !== 'none' ? evName + '！' : '') + '贏分 ' + fmt(r.pts) + ' 分（' + amtTxt(cur, winAmt) + '）' + (ui.auto ? '，已收分。' : '：可以比倍或收分。');
      else ui.msg = r.ev === 'none' ? 'ONCE MORE……槓龜。' : '沒中。';
      if (r.jpNum != null && !r.jp) ui.msg += '（JP 號碼開出 ' + String(r.jpNum).padStart(3, '0') + '，差一點）';
      if (winAmt > 0 || r.jp) maryAnimSprites(big ? 'big' : 'hit');
      render();
      if (ui.auto) {
        if (r.jp || (r.ev && r.ev !== 'none' && r.ev !== 're1')) { ui.msg += '（中了大獎，自動停下）'; stopAuto(); return render(); }
        if (--ui.autoLeft <= 0) { stopAuto(); return render(); }
        later(function () { if (ui.auto) maryRound(); }, ui.quick ? 300 : 900);
      }
    };
    my.lit = []; my.ev = ''; my.dig = '';
    if (ui.quick) { my.on = r.main; my.lit = r.lit.slice(); my.pos = r.main; fin(); return true; }
    ui.busy = true; my.showWin = 0;
    // 跑燈：至少兩圈，越跑越慢
    var path = function (from, to, laps) { var n = laps * 24 + ((to - from + 24) % 24), a = []; for (var k = 1; k <= n; k++) a.push((from + k) % 24); return a; };
    var seq = [], main = path(my.pos, r.main, 2);
    main.forEach(function (c, k) { var t = k / main.length; seq.push({ on: c, wait: 30 + Math.round(220 * t * t * t) }); });
    seq.push({ lit: r.main, wait: 350 });
    if (r.ev) {
      seq.push({ ev: evName, wait: 900 });
      var at = r.main;
      if (r.ev === 're1' || r.ev === 'reN') r.extra.forEach(function (c) { var pa = path(at, c, 1); pa.forEach(function (x, k) { var t = k / pa.length; seq.push({ on: x, wait: 25 + Math.round(160 * t * t * t) }); }); seq.push({ lit: c, wait: 300 }); at = c; });
      else if (r.ev === 'train') r.extra.forEach(function (c) { seq.push({ on: c, lit: c, wait: 220 }); });
      else r.extra.forEach(function (c) { seq.push({ lit: c, wait: 260 }); });
      seq.push({ ev: '', wait: 10 });
    }
    if (r.jpNum != null) {
      seq.push({ ev: 'JP 號碼', wait: 700 });
      for (var q = 0; q < 14; q++) seq.push({ dig: String(Math.floor(Math.random() * 1000)).padStart(3, '0'), wait: 60 + q * 10 });
      seq.push({ dig: String(r.jpNum).padStart(3, '0'), ev: r.jp ? 'JP！777！' : '沒開到 777', wait: 1300 });
      seq.push({ ev: '', dig: '', wait: 10 });
    }
    var shown = 0;
    var tick = function () {
      var x = seq.shift(); if (!x) { my.pos = r.lit[r.lit.length - 1]; if (r.ev === 'train' || MEV_CELLS[r.ev]) my.pos = r.main; return fin(); }
      if (x.on != null) my.on = x.on;
      if (x.lit != null) { if (RING[x.lit] !== 'O') { my.lit.push(x.lit); shown += cellPay(x.lit, bets); my.showWin = shown; } else my.lit.push(x.lit); }
      if (x.ev != null) my.ev = x.ev;
      if (x.dig != null) my.dig = x.dig;
      render(); later(tick, x.wait);
    };
    tick();
    return true;
  }
  function announceJp(cur, amt) {
    try { var p = P(), nm = esc((p && p.name) || '冒險者'); if (typeof W.logWorld === 'function') W.logWorld('<span class="wc-answer">🍒【遊戲廳】<b style="color:#fde047">' + nm + '</b> 在' + MARY_NAME + '中了 <b style="color:#ef4444">JP</b>，拿走 ' + esc(amtTxt(cur, amt)) + '！</span>'); } catch (e) {}
  }
  function maryDouble(side) {
    var m = maryPend(); if (!m || ui.busy || (m.n || 0) >= DBL_MAX) return;
    var dg = 1 + Math.floor(rng() * 9), ok = side === 's' ? dg <= 4 : dg >= 6;
    var unit = maryUnit(m.cur), cap = LIM.mary[m.cur][1] * 100;
    // 先結算再演
    var before = m.win;
    if (ok) { m.win *= 2; m.n = (m.n || 0) + 1; } else { statAdd('mary', m.cur, 0, 0, 0, false); hallData().mary = null; }
    if (ok && (m.n >= DBL_MAX || m.win >= cap)) { safeSave(); } else safeSave();
    var fin = function () {
      ui.busy = false; my.showWin = null;
      if (ok) {
        ui.msg = '開 ' + dg + '，猜中！贏分翻倍成 ' + fmt(Math.floor(m.win / unit)) + ' 分。';
        if (m.n >= DBL_MAX || m.win >= cap) { var got = maryCollect(true); ui.msg += '已經比到上限，自動收分 ' + amtTxt(m.cur, got) + '。'; }
        maryAnimSprites(m.n >= 3 ? 'big' : 'hit');
      } else ui.msg = '開 ' + dg + (dg === 5 ? '，莊家通殺' : '，猜錯了') + '……贏分歸零。';
      render();
    };
    if (ui.quick) { my.dig = String(dg); fin(); return; }
    ui.busy = true; my.showWin = Math.floor(before / unit); var k = 0;
    var spin = function () { my.dig = String(1 + Math.floor(Math.random() * 9)); render(); if (++k < 12) later(spin, 60 + k * 8); else { my.dig = String(dg); render(); later(fin, 400); } };
    spin();
  }
  function onClick(ev) {
    var t = ev.target.closest('[data-gh]'); if (!t || t.disabled) return;
    var a = t.getAttribute('data-gh'), p = a.split(':');
    if (a === 'close') return close();
    if (a === 'min') return toBall();
    if (a === 'home') { if (ui.busy) { stopAnims(); finishShow(); ui.busy = false; } stopAuto(); return go('home'); }
    if (a === 'quick') { ui.quick = !!t.checked; LS('afk_gh_quick', ui.quick ? '1' : '0'); return; }
    if (a === 'poker') { close(); try { W.__afkPoker.openLobby(); } catch (e) {} return; }
    if (a === 'fish') { close(); try { W.__afkFish.open(); } catch (e) { console.warn(e); } return; }
    if (a === 'dog') { close(); toCenter(); try { W.openRaceWindow(); } catch (e) {} return; }
    if (p[0] === 'arcade' && W.LineageArcadeEntry) return W.LineageArcadeEntry.open(p[1]);
    if (p[0] === 'go') return go(p[1]);
    if (ui.busy && a !== 'stop') return;
    if (p[0] === 'cur') { if (ui.auto) return; maryCollect(true); ui.cur = p[1]; LS('afk_gh_cur', ui.cur); bac.bets = {}; ui.msg = ''; return render(); }
    if (a === 'stop') { stopAuto(); return render(); }
    // 百家樂
    if (p[0] === 'chip') { bac.chip[ui.cur] = Number(p[1]); return render(); }
    if (p[0] === 'bet') return bacAdd(p[1]);
    if (a === 'clear') { bac.bets = {}; ui.msg = ''; return render(); }
    if (a === 'dbl') { var tot = betTotal(bac.bets), lim = LIM.bac[ui.cur]; if (tot * 2 > lim[1]) { ui.msg = '加倍後超過這局上限 ' + fmt(lim[1]) + '。'; return render(); } SPOTS.forEach(function (s) { if (bac.bets[s.id]) bac.bets[s.id] *= 2; }); return render(); }
    if (a === 'rebet') { if (!bac.last) return; if (bac.last.cur !== ui.cur) { ui.msg = '上一注是用' + CURS[bac.last.cur] + '押的，先切換幣別。'; return render(); } bac.bets = JSON.parse(JSON.stringify(bac.last.bets)); return render(); }
    if (a === 'deal') return bacDealRound(false);
    if (p[0] === 'auto') {
      var tt = betTotal(bac.bets);
      if (!tt && bac.last && bac.last.cur === ui.cur) bac.bets = JSON.parse(JSON.stringify(bac.last.bets));
      if (!betTotal(bac.bets)) { ui.msg = '先押好一注，自動會一直用同一注。'; return render(); }
      ui.auto = 1; ui.autoLeft = Number(p[1]);
      if (!bacDealRound(true)) stopAuto();
      return;
    }
    // 小瑪莉
    if (p[0] === 'mb') { var mi = Number(p[1]); if (my.bets[mi] < MARY_MAXPT) my.bets[mi]++; ui.msg = ''; return render(); }
    if (a === 'mall') { for (var q = 0; q < 9; q++) if (my.bets[q] < MARY_MAXPT) my.bets[q]++; ui.msg = ''; return render(); }
    if (a === 'mclr') { my.bets = [0, 0, 0, 0, 0, 0, 0, 0, 0]; ui.msg = ''; return render(); }
    if (a === 'mre') { if (my.last) my.bets = my.last.slice(); return render(); }
    if (a === 'mgo') return maryRound();
    if (a === 'mcol') { maryCollect(false); return render(); }
    if (a === 'mcolh') { maryCollect(false, 'half'); return render(); }
    if (p[0] === 'mdbl') return maryDouble(p[1]);
    if (p[0] === 'mauto') { if (!maryPts(my.bets) && my.last) my.bets = my.last.slice(); ui.auto = 1; ui.autoLeft = Number(p[1]); if (!maryRound()) stopAuto(); return; }
    // 拉霸
    if (a === 'bet-' || a === 'bet+') { var st = STEPS[ui.cur], i = st.indexOf(slBet(ui.cur)); i = Math.max(0, Math.min(st.length - 1, i + (a === 'bet+' ? 1 : -1))); sl.bet[ui.cur] = st[i]; return render(); }
    if (a === 'spin') return slotRound();
    if (p[0] === 'sauto') { ui.auto = 1; ui.autoLeft = Number(p[1]); if (!slotRound()) stopAuto(); return; }
  }

  // ════════════════ 入口 ════════════════
  W.__afkGameHall = {
    on: on, open: open, close: close, go: go, debit: debit, credit: credit, statAdd: statAdd, hallData: hallData, safeSave: safeSave, curReady: curReady, amtTxt: amtTxt, rng: rng, settle: settle, CURS: CURS, LIM: LIM, CHIPS: CHIPS, STEPS: STEPS, SPOTS: SPOTS, SYMS: SYMS, MV: MV, SCAT_PAY: SCAT_PAY,
    SLOT_NAME: SLOT_NAME, SLOT_CAP: SLOT_CAP, DECKS: DECKS, CUT: CUT,
    newShoe: newShoe, bacDeal: bacDeal, bacReturn: bacReturn, bigRoad: bigRoad, slotSpin: slotSpin, slotPlay: slotPlay, settle: settle, balance: balance, art: art, _testQ: TESTQ, MF: MF, RING: RING, RING_P: RING_P, MEV: MEV, maryPlay: maryPlay, MARY_NAME: MARY_NAME, MARY_UNIT: MARY_UNIT, JP_SEED: JP_SEED, JP_WIN: JP_WIN, JP_RATE: JP_RATE, DBL_MAX: DBL_MAX, maryCollect: maryCollect
  };
  if (!on()) return;

  var navTries = 0;
  function injectNav() {
    if (!el('tab-automation')) return false;
    var old = ['m-afk-nav-poker', 'm-afk-nav-dograce']; old.forEach(function (id) { var b = el(id); if (b) b.style.display = 'none'; });
    if (el('m-afk-nav-gamehall')) return true;
    var row = el('m-afk-navrow');
    if (!row) {
      row = document.createElement('div'); row.id = 'm-afk-navrow'; row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      el('tab-automation').appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-gamehall'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%'; b.style.marginTop = '8px';
    b.textContent = '🎰 遊戲廳';
    b.addEventListener('click', function () { open('home'); });
    row.appendChild(b);
    return true;
  }
  (function tryNav() { if (injectNav() && navTries > 6) return; if (++navTries < 40) setTimeout(tryNav, 500); })();   // 多跑幾輪：賽狗場／德州的舊鈕晚一點才放也會被收起來
  // 換角色時關掉（不同角色的錢）
  if (typeof W.loadGame === 'function' && !W.loadGame._afkGh) {
    var oLoad = W.loadGame;
    W.loadGame = function () { try { close(); } catch (e) {} var r = oLoad.apply(this, arguments); setTimeout(function () { try { maryCollect(true); } catch (e) {} }, 1200); return r; };
    W.loadGame._afkGh = true;
  }
  setTimeout(function () { try { if (P()) maryCollect(true); } catch (e) {} }, 3000);
  console.log('[AFK-gamehall] 已啟用：遊戲廳（百家樂、' + SLOT_NAME + '、' + MARY_NAME + '）');
})();
