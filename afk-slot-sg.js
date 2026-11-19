/* ============================================================================
 * afk-slot-sg.js — 遊戲廳拉霸機「沙暴之神的祭壇」的引擎（Ping 2026-11-19 04:13 定；畫面在 afk-gamehall.js）
 *
 *   6 輪 × 5 列、全盤同圖 8 個以上中獎、消除連鎖、倍數球（×2～×10,000，免費遊戲裡較常出現）。
 *   分散符號 4／5／6 個＝3／5／100 倍並進入免費遊戲 15 轉；免費遊戲中 3 個以上 +5 轉；免費遊戲的倍數累加到結束。
 *   （11-19 Ping：拿掉購買免費遊戲的按鈕；引擎保留 buy 參數但畫面不再提供）加倍下注：每轉多付 25%，進免費遊戲的機率 ×2；開著時不能購買。
 *   單次下注最多贏 25,000 倍注額。11-19 改成每轉約 97% 會中獎（紅寶石大量出現、獎金很小）；一般、加倍的返還率對準 91.5%（各 200 萬轉：91.2%、91.8%）（scripts/sim-slot-sg.mjs 跑模擬調權重）。
 *   金額單位：注額的 1/100（跟 afk-gamehall 的沙海法老的寶庫相同）。
 *   瀏覽器：window.__afkSlotSG；node：module.exports（模擬用）。
 * ========================================================================== */
(function (root, factory) {
  var E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E;
  else root.__afkSlotSG = E;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var COLS = 6, ROWS = 5, CAP_X = 25000, BUY_X = 100, ANTE = 1.25, FS_N = 15, FS_ADD = 5;
  var NAME = '沙暴之神的祭壇';
  // pay＝[8～9 個, 10～11 個, 12 個以上] 的倍數 ×100
  var SYMS = [
    { k: 'mask', n: '神的面具', pay: [1000, 2500, 5000] },
    { k: 'scepter', n: '雷霆權杖', pay: [250, 1000, 2500] },
    { k: 'scarab', n: '青金聖甲蟲', pay: [200, 500, 1500] },
    { k: 'hourglass', n: '金沙漏', pay: [150, 200, 1200] },
    { k: 'gem_p', n: '紫寶石', pay: [100, 150, 1000] },
    { k: 'gem_g', n: '綠寶石', pay: [80, 120, 800] },
    { k: 'gem_y', n: '黃寶石', pay: [50, 100, 500] },
    { k: 'gem_o', n: '橙寶石', pay: [40, 90, 400] },
    { k: 'gem_r', n: '紅寶石', pay: [5, 10, 20] }   // 11-19（Ping）：每轉約 97% 會中獎——紅寶石大量出現、獎金很小
  ];
  // 調權重的旋鈕（模擬結果填在這裡）
  // 11-19 模擬對準（scripts/sim-slot-sg.mjs；每組 400 萬轉×4 種子）：每轉中獎 97.2%；
  //   一般約 91.4%（線獎 68.5%＋免費遊戲，約 430 轉進一次）、加倍約 91.2%（約 200 轉進一次）；不再提供購買免費遊戲
  var K = {
    off: 2.29,     // 一般盤：符號權重＝off＋i×0.5（越大越難湊到 8 個）
    offF: 2.0,     // 免費遊戲的符號權重
    sc: 0.71,     // 一般盤分散符號權重
    scA: 0.875,    // 加倍下注時的分散符號權重（進免費遊戲機率約 ×2）
    scF: 0.75,     // 免費遊戲裡的分散符號權重（3 個以上 +5 轉）
    mu: 0.252,     // 一般盤倍數球權重（11-19 每轉都會中獎後倍數球幾乎每轉都乘得到 → 調低）
    muF: 0.27,     // 免費遊戲倍數球權重
    dom: 23.5,     // 紅寶石（最後一個符號）的權重：每轉約 97% 會中獎
    domF: 23.5     // 紅寶石：免費遊戲
  };
  var SCAT_PAY = { 4: 300, 5: 500, 6: 10000 };
  // 倍數球：[倍數, 一般盤權重, 免費遊戲權重]
  var MV = [[2, 300, 260], [3, 250, 230], [4, 200, 200], [5, 180, 180], [6, 150, 150], [8, 120, 130], [10, 100, 110], [12, 60, 70], [15, 50, 60],
    [20, 40, 50], [25, 25, 32], [50, 12, 16], [100, 5, 7], [250, 1.5, 2.2], [500, 0.5, 0.8], [5000, 0.012, 0.03], [10000, 0.004, 0.012]];
  var mvTot = [0, 0];
  function tables() {
    mvTot = [MV.reduce(function (s, x) { return s + x[1]; }, 0), MV.reduce(function (s, x) { return s + x[2]; }, 0)];
  }
  tables();
  function orbTier(v) { return v >= 500 ? 5 : v >= 100 ? 4 : v >= 20 ? 3 : v >= 8 ? 2 : 1; }
  function pickMv(rng, free) {
    var j = free ? 2 : 1, r = rng() * mvTot[free ? 1 : 0];
    for (var i = 0; i < MV.length; i++) { r -= MV[i][j]; if (r < 0) return MV[i][0]; }
    return 2;
  }
  // mode：'b' 一般盤、'a' 加倍下注的一般盤、'f' 免費遊戲
  function cell(rng, mode) {
    var free = mode === 'f', off = free ? K.offF : K.off, sc = free ? K.scF : mode === 'a' ? K.scA : K.sc, mu = free ? K.muF : K.mu, dom = free ? K.domF : K.dom;
    var n1 = SYMS.length - 1, symTot = n1 * off + 0.5 * n1 * (n1 - 1) / 2 + dom;
    var r = rng() * (symTot + sc + mu);
    for (var i = 0; i < n1; i++) { r -= off + i * 0.5; if (r < 0) return { s: i }; }
    r -= dom; if (r < 0) return { s: n1 };
    r -= sc; if (r < 0) return { s: 'S' };
    return { s: 'M', v: pickMv(rng, free) };
  }
  function cloneGrid(g) { return g.map(function (col) { return col.map(function (x) { return x.s === 'M' ? { s: 'M', v: x.v } : { s: x.s }; }); }); }
  // 一轉（含消除連鎖）。forceScat＝購買時保證盤面上 4 個分散符號
  function spin(rng, mode, forceScat) {
    var g = [], c, r;
    for (c = 0; c < COLS; c++) { g.push([]); for (r = 0; r < ROWS; r++) g[c].push(cell(rng, mode)); }
    if (forceScat) {
      var n0 = 0; for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) if (g[c][r].s === 'S') n0++;
      var cols = [0, 1, 2, 3, 4, 5];
      for (var t = 0; n0 < forceScat && t < 200; t++) {
        c = cols[Math.floor(rng() * COLS)]; r = Math.floor(rng() * ROWS);
        if (g[c][r].s !== 'S') { g[c][r] = { s: 'S' }; n0++; }
      }
    }
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
        var add = []; while (add.length + keep.length < ROWS) add.push(cell(rng, mode));
        g[c] = add.concat(keep);
      }
    }
    var last = steps[steps.length - 1].grid, mults = [], scat = 0;
    for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) { if (last[c][r].s === 'M') mults.push(last[c][r].v); if (last[c][r].s === 'S') scat++; }
    return { steps: steps, pay100: pay100, mults: mults, scat: scat };
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  // 一次下注。opt：{ ante: 加倍下注, buy: 購買免費遊戲 }。回傳的 total 以「注額的 1/100」為單位（注額＝不含加倍的那個數字）
  //   cost：這一注實際扣的倍數（1、1.25 或 100）
  function play(rng, opt) {
    opt = opt || {};
    var buy = !!opt.buy, ante = !buy && !!opt.ante, CAP = CAP_X * 100;
    var b = spin(rng, ante ? 'a' : 'b', buy ? 4 : 0), ms = sum(b.mults);
    var basePay = b.pay100 * (b.pay100 > 0 && ms > 0 ? ms : 1);
    var sc = b.scat >= 4 ? SCAT_PAY[Math.min(6, b.scat)] : 0;
    var res = { base: b, baseWin: basePay, scatWin: sc, fs: null, total: basePay + sc, capped: false, buy: buy, ante: ante, cost: buy ? BUY_X : ante ? ANTE : 1 };
    if (b.scat >= 4 && res.total < CAP) {
      var left = FS_N, tm = 0, fs = [], fsPay = 0;
      while (left > 0 && res.total + fsPay < CAP) {
        left--;
        var f = spin(rng, 'f', 0), m2 = sum(f.mults);
        if (f.pay100 > 0) tm += m2;
        var pay = f.pay100 * (f.pay100 > 0 && tm > 0 ? tm : 1);
        var add = f.scat >= 3 ? FS_ADD : 0; left += add;
        fs.push({ spin: f, totMult: tm, pay: pay, add: add, left: left });
        fsPay += pay;
      }
      res.fs = fs; res.total += fsPay;
    }
    if (res.total >= CAP) { res.total = CAP; res.capped = true; }
    return res;
  }
  function lastGrid(res) { var s = res.fs && res.fs.length ? res.fs[res.fs.length - 1].spin : res.base; return s.steps[s.steps.length - 1].grid; }
  return {
    NAME: NAME, COLS: COLS, ROWS: ROWS, CAP_X: CAP_X, BUY_X: BUY_X, ANTE: ANTE, FS_N: FS_N, FS_ADD: FS_ADD, SYMS: SYMS, MV: MV, SCAT_PAY: SCAT_PAY, K: K,
    tables: tables, orbTier: orbTier, cell: cell, spin: spin, play: play, lastGrid: lastGrid
  };
});
