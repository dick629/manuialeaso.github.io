/* ============================================================================
 * afk-poker.js — 德州撲克（歐瑞村莊 荷官 洛蒂；玩家 2026-11-04；外掛開關 poker，預設開；經典模式看不到）
 *
 *   無限注德州撲克：玩家 1 人 對 3～5 位 NPC（各有個性：謹慎／穩健／兇狠／莽撞／愛跟）。
 *   牌桌（買入＝換成籌碼，1 籌碼＝1 單位該幣別）：
 *     金幣小桌 1,000／2,000，買入 4 萬～20 萬；金幣大桌 10 萬／20 萬，買入 400 萬～2,000 萬；
 *     龍鑽桌 1／2，買入 40～200 顆龍之鑽石；血龍鑽桌 1／2，買入 40～200 顆血龍鑽。
 *     無上限桌（買入只有下限；NPC 帶你目前籌碼的 0.6～1.5 倍、至少買入下限的 1.2～3 倍）：
 *       金幣 25 萬／50 萬 買入 500 萬起（盲注比大桌大，下限＝10 個大盲）；龍鑽 10／20 買入 1,000 顆起；血龍鑽 1／2 買入 100 顆起（＝50 個大盲）。
 *   入口：歐瑞村莊的洛蒂，或設定分頁「🔌 外掛」列的「♠︎ 德州撲克」（賽狗場旁，不用走回村莊；開關關掉／經典模式沒有）。
 *       一個座位最多 100 兆（STACK_CAP，只為了讓所有金額都是精確整數）；「補到…」補回買入下限。
 *   抽水 3%（2026-11-04 Ping）：每個池子發給贏家前先抽 3%（捨去零頭）；沒翻牌就結束的那手不抽（no flop no drop）；沒人跟到的下注先原數退回、不抽。NPC 贏也抽。
 *   NPC 的籌碼由莊家出（NPC 輸光就換一位新的坐下）。
 *   超難桌（入座前選「對手：一般／超難」）：全桌 hardDecide。不偷看——只用自己的牌、公牌、這手的下注、這張桌上記下的打法
 *     （入池率、加注率、翻牌後被下注時棄牌率、攤牌時看到的詐唬比例）。依打法推估對手範圍再算勝率、被跟注時的勝率決定要不要下注拿價值、
 *     對常棄牌的人加大詐唬、位置、對短籌碼逼全下。強度量測：scripts/sim-poker.cjs（數字見 NOTES-poker2.md）。
 *
 *   帳務（防複製）：
 *     - 入座時立刻扣幣別；離座才把籌碼換回去。桌上的籌碼只記一份「我還剩多少」（不含這手已經推進去的）。
 *     - 金幣／血龍鑽跟角色存檔在同一份 → 記在 player.afkPoker，每次玩家籌碼變動（盲注、下注、一手結束）就存檔。
 *     - 龍之鑽石在潘朵拉的跨角色共用資料（另一份）→ 記在自己的 localStorage 鍵 afk_poker_dia（每次變動立刻寫），
 *       跟龍鑽帳戶一樣是「立刻落盤」，兩邊不會因為角色存檔沒存到而對不上。另一個分頁開著同一桌時（心跳 2 分鐘內）不會被搶著退款。
 *     - 牌局中途重新整理／換角色＝這一手棄牌：已經推進底池的籌碼不退，桌上剩下的籌碼在下次讀檔時自動換回。
 *   NPC 決策：只看自己的底牌與公牌（模擬時剩下的牌從「整副牌扣掉自己看得到的」隨機抽），用勝率＋底池賠率＋個性＋隨機。
 *   不擋掛機：牌桌是浮動視窗（可縮成小球），遊戲照常進行。
 *   測試：scripts/test-poker.mjs
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'poker', name: '德州撲克（歐瑞村莊）', group: '遊戲內容', def: true, seal: true,
    desc: '歐瑞村莊的荷官洛蒂開德州撲克桌：用金幣、龍之鑽石或血龍鑽買籌碼，跟 3～5 位 NPC 對賭；設定分頁「🔌 外掛」列也能直接開牌桌' });
  var on = function () { return !T || T.enabled('poker'); };
  if (typeof DB === 'undefined' || !DB.items) return;

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var fmtS = function (n) {   // 座位上用的短格式
    n = Number(n || 0);
    if (n >= 1e12) return (Math.floor(n / 1e11) / 10) + '兆';
    if (n >= 1e8) return (Math.floor(n / 1e7) / 10) + '億';
    if (n >= 1e5) return (Math.floor(n / 1e3) / 10) + '萬';
    return n.toLocaleString();
  };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  // ════════════════ 牌與牌型 ════════════════
  // 牌＝0..51：點數 (c>>2)+2（2..14），花色 c&3（0♠ 1♥ 2♦ 3♣）
  var SUIT = ['♠︎', '♥︎', '♦︎', '♣︎'];
  var RANK_TXT = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  var cRank = function (c) { return (c >> 2) + 2; };
  var cSuit = function (c) { return c & 3; };
  var cardTxt = function (c) { var r = cRank(c); return (RANK_TXT[r] || String(r)) + SUIT[cSuit(c)]; };
  var CAT_N = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順'];
  var B5 = 1048576, B4 = 65536;   // 16^5、16^4
  function straightHigh(mask) {
    if (mask & (1 << 14)) mask |= 2;   // A 也當 1（A-2-3-4-5）
    for (var h = 14; h >= 5; h--) { var need = 31 << (h - 4); if ((mask & need) === need) return h; }
    return 0;
  }
  function score(cat, ks) { var s = cat; for (var i = 0; i < 5; i++) s = s * 16 + (ks[i] || 0); return s; }
  // 5～7 張牌 → 可比大小的分數（越大越好；相等＝平手）
  function evaluate(cards) {
    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sm = [0, 0, 0, 0], sc = [0, 0, 0, 0], mask = 0, i, r;
    for (i = 0; i < cards.length; i++) { var c = cards[i]; r = cRank(c); var s = cSuit(c); cnt[r]++; sm[s] |= 1 << r; sc[s]++; mask |= 1 << r; }
    var fs = -1; for (i = 0; i < 4; i++) if (sc[i] >= 5) fs = i;
    if (fs >= 0) { var sf = straightHigh(sm[fs]); if (sf) return score(8, [sf]); }
    var quads = [], trips = [], pairs = [], singles = [];
    for (r = 14; r >= 2; r--) { if (cnt[r] === 4) quads.push(r); else if (cnt[r] === 3) trips.push(r); else if (cnt[r] === 2) pairs.push(r); else if (cnt[r] === 1) singles.push(r); }
    if (quads.length) { var q = quads[0], k = 0; for (r = 14; r >= 2; r--) if (r !== q && cnt[r]) { k = r; break; } return score(7, [q, k]); }
    if (trips.length && (trips.length > 1 || pairs.length)) return score(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
    if (fs >= 0) { var fl = []; for (r = 14; r >= 2 && fl.length < 5; r--) if (sm[fs] & (1 << r)) fl.push(r); return score(5, fl); }
    var st = straightHigh(mask); if (st) return score(4, [st]);
    if (trips.length) return score(3, [trips[0], singles[0], singles[1]]);
    if (pairs.length >= 2) return score(2, [pairs[0], pairs[1], Math.max(pairs[2] || 0, singles[0] || 0)]);
    if (pairs.length === 1) return score(1, [pairs[0], singles[0], singles[1], singles[2]]);
    return score(0, singles.slice(0, 5));
  }
  var catOf = function (s) { return Math.floor(s / B5); };
  var handName = function (s) { var c = catOf(s); return (c === 8 && Math.floor(s / B4) % 16 === 14) ? '皇家同花順' : CAT_N[c]; };
  function shuffled(rng) { var d = [], i; for (i = 0; i < 52; i++) d.push(i); for (i = 51; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t; } return d; }

  // ════════════════ 牌桌設定 ════════════════
  var BLOOD = 'afk_blood_dia';
  var CURS = { gold: '金幣', dia: '龍之鑽石', blood: '血龍鑽' };
  // 無上限桌（2026-11-04 Ping）：買入只有下限，沒有上限（龍鑽／血龍鑽桌下限＝50 個大盲；金幣無上限桌 500 萬＝10 個大盲）。
  //   STACK_CAP 只是「數字安全」的天花板，不是遊戲規則：一個座位最多 100 兆，6 個座位（NPC 最多帶你的 1.5 倍）
  //   全推進一個池子也只有 ~9e14，離 Number.MAX_SAFE_INTEGER（~9e15）還差 10 倍 → 底池、抽水、退回全是精確整數。
  var STACK_CAP = 1e14;
  var TABLES = [
    { id: 'g1', cur: 'gold', n: '金幣小桌', sb: 1000, bb: 2000, min: 40000, max: 200000 },
    { id: 'g2', cur: 'gold', n: '金幣大桌', sb: 100000, bb: 200000, min: 4000000, max: 20000000 },
    // 金幣無上限桌（2026-11-04 Ping）：盲注要比大桌（10 萬／20 萬）大 → 25 萬／50 萬；買入下限照 Ping 定的 500 萬（＝10 個大盲）
    { id: 'g3', cur: 'gold', n: '金幣無上限桌', sb: 250000, bb: 500000, min: 5000000, max: STACK_CAP, nomax: true },
    { id: 'd1', cur: 'dia', n: '龍鑽桌', sb: 1, bb: 2, min: 40, max: 200 },
    { id: 'd2', cur: 'dia', n: '龍鑽無上限桌', sb: 10, bb: 20, min: 1000, max: STACK_CAP, nomax: true },
    { id: 'b1', cur: 'blood', n: '血龍鑽桌', sb: 1, bb: 2, min: 40, max: 200 },
    { id: 'b2', cur: 'blood', n: '血龍鑽無上限桌', sb: 1, bb: 2, min: 100, max: STACK_CAP, nomax: true }
  ];
  var TBL = {}; TABLES.forEach(function (t) { TBL[t.id] = t; });
  // 個性：tight＝出手門檻（越大越挑牌）、aggr＝有好牌時加注的機率、bluff＝詐唬機率、callMul＝跟注時要求的勝率倍數
  var PERS = {
    rock: { tag: '謹慎', tight: 1.25, aggr: 0.3, bluff: 0.02, callMul: 1.3 },
    std: { tag: '穩健', tight: 1.0, aggr: 0.45, bluff: 0.06, callMul: 1.05 },
    tag: { tag: '兇狠', tight: 1.12, aggr: 0.75, bluff: 0.1, callMul: 1.1 },
    lag: { tag: '莽撞', tight: 0.85, aggr: 0.7, bluff: 0.2, callMul: 0.9 },
    fish: { tag: '愛跟', tight: 0.75, aggr: 0.15, bluff: 0.03, callMul: 0.7 }
  };
  var NPCS = [
    { n: '格倫', p: 'rock' }, { n: '老礦工 布魯', p: 'fish' }, { n: '傭兵 卡爾', p: 'lag' }, { n: '黑妖 薇拉', p: 'tag' },
    { n: '騎士 雷恩', p: 'std' }, { n: '法師 艾琳', p: 'tag' }, { n: '醉漢 多布', p: 'fish' }, { n: '海賊 傑克', p: 'lag' },
    { n: '商人 漢斯', p: 'rock' }, { n: '妖精 菲莉', p: 'std' }
  ];
  // 超難桌：職業牌手（只靠看得到的資訊：自己的牌、公牌、大家下過的注與過去的打法紀錄）
  PERS.hard = { tag: '超難', tight: 1, aggr: 0.6, bluff: 0.1, callMul: 1 };
  var HARD_NPCS = [{ n: '賭神 維克多', p: 'hard' }, { n: '冷面 賽琳', p: 'hard' }, { n: '職業牌手 奧斯卡', p: 'hard' }, { n: '鐵面 卡珊', p: 'hard' },
    { n: '狐狸 雷文', p: 'hard' }, { n: '莊家之子 洛克', p: 'hard' }, { n: '算牌師 伊芙', p: 'hard' }];
  var RAKE = 0.03;   // 抽水 3%：每個池子（有翻牌才抽；沒人跟的下注先退回、不抽）
  // 抽水用整數算：floor(amt×3/100)＝(amt 的百位以上)×3 ＋ 零頭×3/100 捨去。不寫 amt*0.03——0.03 不是精確的二進位小數，
  //   池子上億之後 floor 可能差 1；也不寫 amt*3（無上限桌的池子再大一點就會超過精確整數範圍）。
  function rakeOf(amt) { amt = Math.floor(amt); var q = Math.floor(amt / 100), r = amt - q * 100; return q * 3 + Math.floor(r * 3 / 100); }

  // ════════════════ 牌局引擎（純邏輯，測試直接呼叫） ════════════════
  function newSeat(o) { return Object.assign({ stack: 0, bet: 0, total: 0, folded: false, allIn: false, out: false, hole: [], acted: false, actedAt: -1, last: '', won: 0 }, o); }
  function nextIdx(tb, from, pred) { var n = tb.seats.length; for (var k = 1; k <= n; k++) { var i = ((from + k) % n + n) % n; if (pred(tb.seats[i], i)) return i; } return -1; }
  var inHand = function (s) { return !s.out && !s.folded; };
  var canAct = function (s) { return !s.out && !s.folded && !s.allIn; };
  function needsAction(tb, s) { return canAct(s) && (!s.acted || s.bet < tb.hand.cur); }
  function potTotal(tb) { var t = 0; tb.seats.forEach(function (s) { t += s.total; }); return t; }
  function put(s, amt) { amt = Math.max(0, Math.min(s.stack, Math.floor(amt))); s.stack -= amt; s.bet += amt; s.total += amt; if (s.stack === 0) s.allIn = true; return amt; }
  function startHand(tb) {
    var live = tb.seats.filter(function (s) { return s.stack > 0; });
    if (live.length < 2) return null;
    tb.seats.forEach(function (s) { s.bet = 0; s.total = 0; s.allIn = false; s.hole = []; s.acted = false; s.actedAt = -1; s.last = ''; s.won = 0; s.out = s.stack <= 0; s.folded = s.out; s.score = 0; });
    tb.button = nextIdx(tb, tb.button < 0 ? -1 : tb.button, function (s) { return !s.out; });
    var H = tb.hand = { no: ++tb.handNo, deck: shuffled(tb.rng), board: [], street: 0, cur: 0, minRaise: tb.def.bb, fr: 0, toAct: -1, done: false, result: null, log: [],
      hist: tb.seats.map(function () { return { vp: false, pr: false, agg: [0, 0, 0, 0], call: [0, 0, 0, 0] }; }) };
    tb.seats.forEach(function (s) { if (!s.out) modelOf(tb, s).h++; });
    var heads = live.length === 2;
    var sbI = heads ? tb.button : nextIdx(tb, tb.button, function (s) { return !s.out; });
    var bbI = nextIdx(tb, sbI, function (s) { return !s.out; });
    H.sbI = sbI; H.bbI = bbI;
    put(tb.seats[sbI], tb.def.sb); tb.seats[sbI].last = '小盲 ' + fmtS(tb.seats[sbI].bet);
    put(tb.seats[bbI], tb.def.bb); tb.seats[bbI].last = '大盲 ' + fmtS(tb.seats[bbI].bet);
    H.cur = Math.max(tb.def.bb, tb.seats[sbI].bet, tb.seats[bbI].bet);
    for (var round = 0; round < 2; round++) {
      var i = tb.button;
      for (var k = 0; k < tb.seats.length; k++) { i = (i + 1) % tb.seats.length; if (!tb.seats[i].out) tb.seats[i].hole.push(H.deck.pop()); }
    }
    H.toAct = nextIdx(tb, bbI, function (s) { return needsAction(tb, s); });
    if (H.toAct < 0) advance(tb);
    return H;
  }
  function legal(tb, i) {
    var H = tb.hand, s = tb.seats[i];
    var toCall = Math.max(0, H.cur - s.bet), maxTo = s.bet + s.stack;
    var others = tb.seats.filter(function (o, j) { return j !== i && canAct(o); }).length;
    // 已經行動過、之後只出現「不足一次加注」的全下 → 只能跟或棄（不能再加注）
    var canRaise = s.stack > toCall && others > 0 && !(s.acted && s.actedAt === H.fr);
    return { toCall: toCall, callAmt: Math.min(toCall, s.stack), canCheck: toCall === 0, canRaise: canRaise, minTo: Math.min(H.cur + H.minRaise, maxTo), maxTo: maxTo, cur: H.cur };
  }
  function act(tb, i, type, to) {
    var H = tb.hand; if (!H || H.done) return { ok: false, err: '這手已經結束' };
    if (i !== H.toAct) return { ok: false, err: '還沒輪到' };
    var s = tb.seats[i], L = legal(tb, i), lbl = '';
    if (type === 'allin') {
      if (L.canRaise && L.maxTo > H.cur) { type = 'raise'; to = L.maxTo; }
      else if (L.toCall > 0) type = 'call'; else type = 'check';
    }

    if (type === 'fold') { s.folded = true; lbl = '棄牌'; }
    else if (type === 'check') { if (!L.canCheck) return { ok: false, err: '要跟注才能繼續' }; lbl = '過牌'; }
    else if (type === 'call') { if (L.toCall <= 0) return { ok: false, err: '不用跟注' }; put(s, L.callAmt); lbl = s.allIn ? '全下 ' + fmtS(s.bet) : '跟注 ' + fmtS(s.bet); }
    else if (type === 'raise') {
      to = Math.floor(Number(to));
      if (!L.canRaise) return { ok: false, err: '現在不能加注' };
      if (!(to > H.cur) || to > L.maxTo || (to < L.minTo && to !== L.maxTo)) return { ok: false, err: '加注金額不對' };
      var wasBet = H.cur === 0;
      put(s, to - s.bet);
      var size = to - H.cur;
      if (size >= H.minRaise) {
        H.minRaise = size; H.fr++;
        tb.seats.forEach(function (o, j) { if (j !== i && canAct(o)) o.acted = false; });
      }
      H.cur = to;
      lbl = s.allIn ? '全下 ' + fmtS(s.bet) : (wasBet ? '下注 ' : '加注到 ') + fmtS(s.bet);
    } else return { ok: false, err: '不認得的動作' };
    observe(tb, i, type, L);
    s.acted = true; s.actedAt = H.fr; s.last = lbl;
    H.log.push(s.name + ' ' + lbl);
    advance(tb);
    return { ok: true };
  }
  function advance(tb) {
    var H = tb.hand;
    for (var guard = 0; guard < 10; guard++) {
      var alive = tb.seats.filter(inHand);
      if (alive.length === 1) return finish(tb, false);
      var nxt = nextIdx(tb, H.toAct < 0 ? H.bbI : H.toAct, function (s) { return needsAction(tb, s); });
      if (nxt >= 0) { H.toAct = nxt; return; }
      if (H.street >= 3) return finish(tb, true);
      // 下一條街
      H.street++;
      tb.seats.forEach(function (s) { s.bet = 0; s.acted = false; if (inHand(s) && !s.allIn) s.last = ''; });
      H.cur = 0; H.minRaise = tb.def.bb; H.fr++;
      H.deck.pop();   // 燒一張
      var n = H.street === 1 ? 3 : 1;
      for (var k = 0; k < n; k++) H.board.push(H.deck.pop());
      if (tb.seats.filter(canAct).length <= 1) tb.seats.forEach(function (s) { if (canAct(s)) s.acted = true; });   // 沒人能跟你賭了：直接發完
      H.toAct = -1;
      var first = nextIdx(tb, tb.button, function (s) { return needsAction(tb, s); });
      if (first >= 0) { H.toAct = first; return; }
    }
  }
  // 依每人「這手總共推進多少」切主池／邊池
  function buildPots(seats) {
    var levels = [];
    seats.forEach(function (s) { if (inHand(s) && s.total > 0 && levels.indexOf(s.total) < 0) levels.push(s.total); });
    levels.sort(function (a, b) { return a - b; });
    var pots = [], prev = 0;
    levels.forEach(function (L) {
      var amt = 0; seats.forEach(function (s) { amt += Math.max(0, Math.min(s.total, L) - Math.min(s.total, prev)); });
      var el = []; seats.forEach(function (s, i) { if (inHand(s) && s.total >= L) el.push(i); });
      var cn = seats.filter(function (s) { return s.total > prev; }).length;
      if (amt > 0) {
        var last = pots[pots.length - 1];
        if (last && last.el.join() === el.join()) { last.amt += amt; last.n = Math.max(last.n, cn); } else pots.push({ amt: amt, el: el, n: cn });
      }
      prev = L;
    });
    var all = 0; seats.forEach(function (s) { all += s.total; });
    var sum = pots.reduce(function (a, p) { return a + p.amt; }, 0);
    if (all > sum && pots.length) pots[pots.length - 1].amt += all - sum;   // 理論上不會發生（棄牌者推得比所有人多）
    return pots;
  }
  function finish(tb, showdown) {
    var H = tb.hand, seats = tb.seats, res = { showdown: showdown, pots: [], rake: 0, returned: 0, retTo: -1 };
    var flopped = H.board.length >= 3 || showdown;   // 沒有翻牌就結束的那手不抽水
    if (showdown) {
      while (H.board.length < 5) { H.deck.pop(); H.board.push(H.deck.pop()); }
      seats.forEach(function (s) { if (inHand(s)) s.score = evaluate(s.hole.concat(H.board)); });
      learnShowdown(tb);
    }
    // 沒有人跟到的那一截下注，原數退回（不算贏、不抽水）
    var tops = seats.map(function (s) { return s.total; }).sort(function (a, b) { return b - a; });
    if (tops[0] > (tops[1] || 0)) {
      var ti = seats.findIndex(function (s) { return s.total === tops[0]; }), ex = tops[0] - (tops[1] || 0);
      seats[ti].total -= ex; seats[ti].stack += ex; res.returned = ex; res.retTo = ti;
    }
    var pots;
    if (showdown) pots = buildPots(seats);
    else {   // 其他人都棄牌：整池給剩下那位
      var w = seats.findIndex(inHand);
      pots = [{ amt: potTotal(tb), el: [w], n: seats.filter(function (s) { return s.total > 0; }).length }];
    }
    var n = seats.length;
    pots.forEach(function (p) {
      if (!(p.amt > 0)) return;
      var win = p.el;
      if (p.el.length > 1) {
        var best = -1; p.el.forEach(function (i) { if (seats[i].score > best) best = seats[i].score; });
        win = p.el.filter(function (i) { return seats[i].score === best; });
      }
      var rk = flopped && p.n >= 2 ? rakeOf(p.amt) : 0, net = p.amt - rk;
      res.rake += rk;
      // 平分；除不盡的零頭從莊家左手邊開始一人一枚
      var order = win.slice().sort(function (a, b) { return ((a - tb.button - 1 + n) % n) - ((b - tb.button - 1 + n) % n); });
      var share = Math.floor(net / win.length), rem = net - share * win.length;
      order.forEach(function (i, k) { var g = share + (k < rem ? 1 : 0); seats[i].stack += g; seats[i].won += g; });
      res.pots.push({ amt: p.amt, net: net, rake: rk, el: p.el.slice(), win: order, hand: showdown && p.el.length > 1 ? handName(seats[win[0]].score) : '' });
    });
    seats.forEach(function (s) { s.bet = 0; });
    H.done = true; H.toAct = -1; H.result = res;
    return res;
  }

  // ════════════════ NPC 決策（只用自己看得到的牌） ════════════════
  function equity(hole, board, nOpp, iters, rng) {
    var used = {}, rest = [], i;
    hole.concat(board).forEach(function (c) { used[c] = 1; });
    for (i = 0; i < 52; i++) if (!used[i]) rest.push(i);
    var needB = 5 - board.length, need = needB + nOpp * 2, win = 0, R = rest.length;
    for (var it = 0; it < iters; it++) {
      for (i = 0; i < need; i++) { var j = i + Math.floor(rng() * (R - i)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      var b = board.concat(rest.slice(0, needB));
      var me = evaluate(hole.concat(b)), best = 0, ties = 0, lose = false;
      for (var o = 0; o < nOpp; o++) {
        var sc = evaluate([rest[needB + o * 2], rest[needB + o * 2 + 1]].concat(b));
        if (sc > me) { lose = true; break; }
        if (sc === me) ties++;
        if (sc > best) best = sc;
      }
      if (!lose) win += 1 / (ties + 1);
    }
    return win / iters;
  }
  function roundTo(tb, v) { var u = tb.def.sb; return Math.max(u, Math.round(v / u) * u); }
  function sizeTo(tb, i, frac) {
    var H = tb.hand, L = legal(tb, i), pot = potTotal(tb);
    var to = H.cur + Math.max(H.minRaise, roundTo(tb, (pot + L.toCall) * frac));
    to = Math.max(L.minTo, Math.min(L.maxTo, to));
    if (L.maxTo - to < (L.maxTo - tb.seats[i].bet) * 0.3) to = L.maxTo;   // 剩下不多就直接推
    return { t: 'raise', to: to };
  }
  function npcDecide(tb, i) {
    var H = tb.hand, s = tb.seats[i], pr = PERS[s.pers] || PERS.std, rng = tb.rng, L = legal(tb, i);
    var opp = tb.seats.filter(function (o, j) { return j !== i && inHand(o); }).length;
    var e = equity(s.hole, H.board, Math.max(1, opp), H.street === 0 ? 120 : 180, rng);
    var rel = e * (opp + 1) * (1 + (rng() - 0.5) * 0.3);   // 1＝平均水準
    var strong = rel / pr.tight, pot = potTotal(tb);
    if (L.canCheck) {
      if (L.canRaise && strong > 1.35 && rng() < 0.3 + pr.aggr) return sizeTo(tb, i, strong > 2.2 ? 0.75 + rng() * 0.4 : 0.45 + rng() * 0.3);
      if (L.canRaise && rng() < pr.bluff) return sizeTo(tb, i, 0.5);
      return { t: 'check' };
    }
    var potOdds = L.callAmt / (pot + L.callAmt);
    if (L.canRaise && strong > 1.6 && rng() < pr.aggr) return sizeTo(tb, i, strong > 2.4 ? 0.9 + rng() * 0.5 : 0.6 + rng() * 0.3);
    var need = potOdds * pr.callMul;
    if (L.callAmt >= s.stack * 0.5) need *= 1.15;   // 要賭上大半籌碼時再保守一點
    if (e >= need || (H.street === 0 && L.toCall <= tb.def.bb && strong > 0.85)) return { t: 'call' };
    if (L.canRaise && H.street > 0 && rng() < pr.bluff * 0.4) return sizeTo(tb, i, 0.7);
    return { t: 'fold' };
  }
  // ════════════════ 超難 AI（不偷看：只用自己的牌、公牌、這手大家怎麼下注、以及這張桌上過去的打法紀錄） ════════════════
  function modelOf(tb, s) { var m = tb.model || (tb.model = {}); return m[s.name] || (m[s.name] = { h: 0, vpip: 0, pfr: 0, agg: 0, calls: 0, checks: 0, fb: 0, ftb: 0, pfb: 0, pftb: 0, sdAgg: 0, sdBluff: 0 }); }
  // 攤牌時大家都看得到的牌：記下「下注／加注過的人攤出來是真牌還是詐唬」
  function learnShowdown(tb) {
    var H = tb.hand; if (!H || !H.hist || H.board.length < 5) return;
    tb.seats.forEach(function (s, j) { var h = H.hist[j]; if (!h || !inHand(s) || !(h.agg[1] + h.agg[2] + h.agg[3])) return; var m = modelOf(tb, s); m.sdAgg++; if (strength(s.hole, H.board) < 2) m.sdBluff++; });
  }
  function observe(tb, i, type, L) {
    var H = tb.hand, s = tb.seats[i], m = modelOf(tb, s), h = H.hist && H.hist[i]; if (!h) return;
    if (H.street === 0) {
      if ((type === 'call' || type === 'raise') && !h.vp) { h.vp = true; m.vpip++; }
      if (type === 'raise') { if (!h.pr) m.pfr++; h.pr = (h.pr || 0) + 1; }
      if (H.cur > tb.def.bb) { m.pfb++; if (type === 'fold') m.pftb++; }   // 面對加注時棄牌的比例
    } else {
      if (type === 'raise') { m.agg++; h.agg[H.street]++; if (L.toCall > 0) h.rz = (h.rz || 0) + 1; }
      else if (type === 'call') { m.calls++; h.call[H.street]++; }
      else if (type === 'check') m.checks++;
      if (L.toCall > 0) { m.fb++; if (type === 'fold') m.ftb++; }
    }
  }
  var rate = function (x, n, prior, w) { return (x + prior * w) / (n + w); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function lcg(seed) { var n = seed >>> 0; return function () { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
  var PF = null;   // 169 種起手牌的強弱百分位（0＝最強）
  var pfKey = function (c1, c2) { var a = cRank(c1), b = cRank(c2); if (b > a) { var t = a; a = b; b = t; } return a * 16 + b + (a !== b && cSuit(c1) === cSuit(c2) ? 256 : 0); };
  function pfTable() {
    if (PF) return PF;
    var rng = lcg(20261104), cls = [], a, b;
    for (a = 14; a >= 2; a--) for (b = a; b >= 2; b--) for (var su = 0; su < (a === b ? 1 : 2); su++) {
      var c1 = (a - 2) * 4, c2 = (b - 2) * 4 + (su ? 0 : 1);
      cls.push({ k: pfKey(c1, c2), e: equity([c1, c2], [], 2, 260, rng), n: a === b ? 6 : (su ? 4 : 12) });
    }
    cls.sort(function (x, y) { return y.e - x.e; });
    PF = {}; var cum = 0;
    cls.forEach(function (c) { PF[c.k] = (cum + c.n / 2) / 1326; cum += c.n; });
    return PF;
  }
  var pfPct = function (h) { return pfTable()[pfKey(h[0], h[1])]; };
  // 手上的牌在這個牌面算什麼：0 什麼都沒有、1 聽牌或小對子、2 頂對／超對、3 兩對以上（有用到手牌）
  function strength(hole, board) {
    if (board.length < 3) return 0;
    var all = catOf(evaluate(hole.concat(board))), bd = catOf(evaluate(board));
    if (all > bd) {
      if (all >= 2) return all >= 3 || bd === 0 ? 3 : 2;
      var top = 0; board.forEach(function (c) { top = Math.max(top, cRank(c)); });
      var r0 = cRank(hole[0]), r1 = cRank(hole[1]);
      var pr = r0 === r1 ? r0 : (board.some(function (c) { return cRank(c) === r0; }) ? r0 : r1);
      return pr >= top ? 2 : 1;
    }
    if (board.length >= 5) return 0;
    var cards = hole.concat(board), sc = [0, 0, 0, 0], mask = 0;
    cards.forEach(function (c) { sc[cSuit(c)]++; mask |= 1 << cRank(c); });
    for (var q = 0; q < 4; q++) if (sc[q] >= 4 && (cSuit(hole[0]) === q || cSuit(hole[1]) === q)) return 1;
    if (mask & (1 << 14)) mask |= 2;
    for (var lo = 1; lo <= 10; lo++) if (((mask >> lo) & 15) === 15) return 1;   // 兩頭順
    return 0;
  }
  function oppParams(tb, j) {
    var H = tb.hand, m = modelOf(tb, tb.seats[j]), h = H.hist[j];
    var range = 1;
    if (h.pr >= 2) range = clamp(rate(m.pfr, m.h, 0.15, 8) * 0.4, 0.03, 0.25);
    else if (h.pr) range = clamp(rate(m.pfr, m.h, 0.15, 8) * 1.1, 0.05, 0.6);
    else if (h.vp) range = clamp(rate(m.vpip, m.h, 0.3, 8), 0.12, 0.95);
    var af = rate(m.agg, m.agg + m.calls + m.checks, 0.3, 10);
    var bl = rate(m.sdBluff, m.sdAgg, clamp(af * 0.5, 0.05, 0.3), 5);
    return { j: j, range: range, aggN: h.agg[1] + h.agg[2] + h.agg[3], rz: h.rz || 0, callN: h.call[1] + h.call[2] + h.call[3], bluff: clamp(bl, 0.03, 0.6) };
  }
  // 依對手「這手怎麼下注」與過去打法推估他們可能拿的牌，再算勝率
  // ifCalled＝假設對手只用「會跟注的牌」繼續（用來判斷值不值得下注拿價值）
  function rangeEquity(tb, i, iters, ifCalled) {
    var H = tb.hand, me = tb.seats[i], board = H.board, rng = tb.rng, pf = pfTable();
    var ps = []; tb.seats.forEach(function (o, j) { if (j !== i && inHand(o)) { var q = oppParams(tb, j), m = modelOf(tb, o); q.fold = rate(m.ftb, m.fb, 0.4, 6); ps.push(q); } });
    if (!ps.length) return 1;
    var used = new Uint8Array(52), deck = [], c;
    me.hole.concat(board).forEach(function (x) { used[x] = 1; });
    for (c = 0; c < 52; c++) if (!used[c]) deck.push(c);
    var D = deck.length, cache = {}, win = 0, taken = new Uint8Array(52);
    var stOf = function (c1, c2) { var k = c1 * 52 + c2; if (!(k in cache)) cache[k] = strength([c1, c2], board); return cache[k]; };
    var accept = function (p, c1, c2) {
      if (pf[pfKey(c1, c2)] > p.range && rng() > 0.03) return false;
      if (ifCalled && board.length >= 3) {
        var s2 = stOf(c1, c2);
        if (p.fold > 0.45 ? (s2 < 2 && !(s2 === 1 && rng() < 0.3)) : (s2 < 1 && rng() > 0.4)) return false;
      }
      if (board.length >= 3 && (p.aggN || p.callN)) {
        var st = stOf(c1, c2);
        if (p.rz) return st >= 3 || rng() < p.bluff * 0.5;   // 加注我的下注：多半是兩對以上
        if (p.aggN) return st >= 2 || rng() < (st === 1 ? Math.max(p.bluff, 0.35) : p.bluff);
        return st >= 1 || rng() < 0.3;
      }
      return true;
    };
    for (var it = 0; it < iters; it++) {
      taken.fill(0);
      var hands = [];
      for (var q = 0; q < ps.length; q++) {
        var c1 = -1, c2 = -1;
        for (var t = 0; t < 30; t++) {
          var a = deck[Math.floor(rng() * D)], b = deck[Math.floor(rng() * D)];
          if (a === b || taken[a] || taken[b]) { t--; continue; }
          c1 = a; c2 = b;
          if (accept(ps[q], a, b)) break;
        }
        taken[c1] = taken[c2] = 1; hands.push([c1, c2]);
      }
      var bd = board.slice();
      while (bd.length < 5) { var x = deck[Math.floor(rng() * D)]; if (taken[x]) continue; taken[x] = 1; bd.push(x); }
      var mine = evaluate(me.hole.concat(bd)), lose = false, ties = 0;
      for (q = 0; q < hands.length; q++) { var sc = evaluate(hands[q].concat(bd)); if (sc > mine) { lose = true; break; } if (sc === mine) ties++; }
      if (!lose) win += 1 / (ties + 1);
    }
    return win / iters;
  }
  function allIn(tb, i) { var L = legal(tb, i); return L.canRaise ? { t: 'raise', to: L.maxTo } : (L.toCall > 0 ? { t: 'call' } : { t: 'check' }); }
  function hardDecide(tb, i) {
    var H = tb.hand, s = tb.seats[i], L = legal(tb, i), rng = tb.rng, bb = tb.def.bb, pot = potTotal(tb), n = tb.seats.length;
    var opps = []; tb.seats.forEach(function (o, j) { if (j !== i && inHand(o)) opps.push(j); });
    var maxOpp = 0; opps.forEach(function (j) { maxOpp = Math.max(maxOpp, tb.seats[j].stack + tb.seats[j].bet); });
    var effBB = Math.min(s.stack + s.bet, maxOpp) / bb;
    var dist = function (j) { return (j - tb.button - 1 + n) % n; };
    var actLeft = tb.seats.filter(function (o, j) { return j !== i && canAct(o) && dist(j) > dist(i); }).length;   // 翻牌後還在我後面行動的人
    var inPos = actLeft === 0;
    var foldR = 0, cnt = 0; opps.forEach(function (j) { var m = modelOf(tb, tb.seats[j]); foldR += H.street === 0 ? rate(m.pftb, m.pfb, 0.55, 6) : rate(m.ftb, m.fb, 0.4, 6); cnt++; });
    foldR = cnt ? foldR / cnt : 0.4;
    var shortOpp = opps.some(function (j) { return tb.seats[j].stack + tb.seats[j].bet <= 18 * bb; });
    var potOdds = L.callAmt / (pot + L.callAmt);
    if (H.street === 0) {
      var pct = pfPct(s.hole), raised = H.cur > bb;
      var after = tb.seats.filter(function (o, j) { return j !== i && !o.out && !o.folded && dist(j) > dist(i); }).length;   // 翻牌前還沒行動的人數（含盲注）
      if (!raised) {
        var limpers = tb.seats.filter(function (o, j) { return j !== i && H.hist[j].vp; }).length;
        var open = [0.45, 0.36, 0.26, 0.19, 0.15, 0.13][Math.min(5, after)] + (foldR > 0.6 ? 0.08 : 0) - limpers * 0.03;

        if (pct <= open && L.canRaise) {
          if (effBB <= 15 || (shortOpp && pct <= open * 0.7 && effBB <= 25)) return allIn(tb, i);
          return { t: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, roundTo(tb, bb * (2.5 + limpers)))) };
        }
        if (L.canCheck) return { t: 'check' };
        if (H.sbI === i && pct <= 0.45 && limpers === 0 && rng() < 0.3) return { t: 'call' };
        return { t: 'fold' };
      }
      var rj = -1, best = -1; tb.seats.forEach(function (o, j) { if (j !== i && inHand(o) && o.bet === H.cur) rj = j; });
      var rm = rj >= 0 ? modelOf(tb, tb.seats[rj]) : null, rRange = rm ? clamp(rate(rm.pfr, rm.h, 0.15, 8), 0.05, 0.6) : 0.15;
      var e0 = rangeEquity(tb, i, 220);
      var reraised = rj >= 0 && H.hist[rj].pr >= 2;
      if (L.canRaise && (pct <= rRange * (reraised ? 0.25 : 0.4) || pct <= 0.025)) {
        if (effBB <= 35 || reraised) return allIn(tb, i);
        return { t: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, roundTo(tb, H.cur * (inPos ? 3 : 3.6)))) };
      }
      if (L.canRaise && !reraised && pct <= rRange * 1.1 && pct > rRange * 0.4 && rng() < 0.12 + (foldR > 0.6 ? 0.1 : 0)) {
        if (effBB <= 30) return allIn(tb, i);
        return { t: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, roundTo(tb, H.cur * 3.2))) };
      }
      if (effBB <= 20) return e0 > potOdds + 0.08 ? allIn(tb, i) : { t: 'fold' };
      var setMine = cRank(s.hole[0]) === cRank(s.hole[1]) && L.callAmt <= (s.stack + s.bet) / 15;
      if ((e0 >= potOdds + 0.04 && L.callAmt <= s.stack * 0.3) || setMine) return { t: 'call' };
      return { t: 'fold' };
    }
    var e = rangeEquity(tb, i, 320), st = strength(s.hole, H.board), spr = s.stack / Math.max(1, pot);
    var draw = st === 1 && H.street < 3 && e > 0.28;
    if (L.canCheck) {
      var eC = L.canRaise ? rangeEquity(tb, i, 240, true) : 0;   // 被跟注時的勝率
      if (eC > 0.55 && L.canRaise) {
        if (spr < 1.2 || (shortOpp && e > 0.7)) return allIn(tb, i);
        var f = foldR < 0.35 ? 0.85 + rng() * 0.4 : (eC > 0.7 ? 0.7 : 0.5) + rng() * 0.25;
        if (!inPos && e < 0.85 && opps.length === 1 && modelOf(tb, tb.seats[opps[0]]).agg > 3 && rng() < 0.2) return { t: 'check' };   // 對愛打的人偶爾過牌設陷阱
        return sizeTo(tb, i, f);
      }
      if (e > 0.5 && eC > 0.45 && L.canRaise && (inPos || opps.length === 1) && rng() < 0.55) return sizeTo(tb, i, 0.45);
      // 詐唬：對手越常棄牌越常打，尺寸做到讓他的小牌也跟不下去
      var bf = foldR > 0.5 ? 0.9 : 0.75, need = bf / (1 + 2 * bf);
      var pB = foldR > need + 0.12 ? 0.9 : foldR > need + 0.04 ? 0.6 : 0.2;
      if (draw) pB = Math.max(pB, 0.55);
      if (!inPos) pB *= 0.7;
      if (opps.length === 2) pB *= foldR > 0.55 ? 0.7 : 0.35;
      if (L.canRaise && opps.length <= 2 && rng() < pB) return sizeTo(tb, i, bf);
      return { t: 'check' };
    }
    if (e > 0.75 && L.canRaise) { if (spr < 2.5 || shortOpp) return allIn(tb, i); return sizeTo(tb, i, 0.8 + rng() * 0.4); }
    var implied = draw ? 0.06 : 0;
    if (e + implied >= potOdds + 0.02) {
      if (e > 0.62 && L.canRaise && rng() < 0.3) return sizeTo(tb, i, 0.9);
      return { t: 'call' };
    }
    if (L.canRaise && H.street < 3 && opps.length === 1 && foldR > 0.55 && (draw || rng() < 0.08)) return sizeTo(tb, i, 1);
    return { t: 'fold' };
  }
  function npcAct(tb, i) {
    var d = tb.seats[i].pers === 'hard' ? hardDecide(tb, i) : npcDecide(tb, i), r = act(tb, i, d.t, d.to);
    if (!r.ok) { tb.illegal = (tb.illegal || 0) + 1; console.warn('[AFK-poker] NPC 動作不合法', d, r.err); r = act(tb, i, legal(tb, i).canCheck ? 'check' : 'fold'); }
    return d;
  }
  var npcUsed = function (tb) { return tb.seats.map(function (s) { return s.name; }); };
  function newNpc(tb) {
    var src = tb.hard ? HARD_NPCS : NPCS, pool = src.filter(function (x) { return npcUsed(tb).indexOf(x.n) < 0; });
    var d = pool[Math.floor(tb.rng() * pool.length)] || src[0];
    var bbs = 60 + Math.floor(tb.rng() * 91);   // 60～150 個大盲
    // 無上限桌的底：買入下限的 1.2～3 倍（下限＝50 個大盲的龍鑽／血龍鑽桌剛好就是 60～150 個大盲；
    //   金幣無上限桌下限只有 10 個大盲 → 600 萬～1,500 萬，不會一坐下就面對比你多 6～15 倍的人）
    var st = tb.def.nomax ? Math.max(tb.def.bb, Math.round(tb.def.min * bbs / 50 / tb.def.bb) * tb.def.bb) : tb.def.bb * bbs;
    // 無上限桌：NPC 帶的籌碼跟你差不多（你目前籌碼的 0.6～1.5 倍，至少是上面的底）→ 你帶再多上桌也有得贏、有得輸
    var me = tb.seats[0], hs = me && me.human ? me.stack : 0;
    if (tb.def.nomax && hs > 0) st = Math.max(st, Math.min(STACK_CAP, Math.round(hs * (0.6 + tb.rng() * 0.9) / tb.def.bb) * tb.def.bb));
    return newSeat({ name: d.n, pers: d.p, stack: st, human: false });
  }
  function newTable(def, humanStack, nNpc, rng, hard) {
    var tb = { def: def, seats: [], button: -1, handNo: 0, hand: null, rng: rng || Math.random, hard: !!hard, model: {} };
    tb.seats.push(newSeat({ name: '你', human: true, stack: humanStack }));
    for (var k = 0; k < nNpc; k++) tb.seats.push(newNpc(tb));
    tb.button = Math.floor(tb.rng() * tb.seats.length) - 1;
    return tb;
  }
  // 一手結束後：輸光的 NPC 離桌、換新的坐下
  function refillNpcs(tb) {
    var msgs = [];
    tb.seats.forEach(function (s, i) {
      if (s.human || s.stack > 0) return;
      var nn = newNpc(tb); msgs.push(s.name + ' 輸光離桌，' + nn.name + ' 坐了下來');
      tb.seats[i] = nn;
    });
    return msgs;
  }

  // ════════════════ 幣別 ════════════════
  function diaReady() { return typeof W.pandoraGetSharedDiamonds === 'function' && typeof W.pandoraAdjustSharedDiamonds === 'function'; }
  function bloodHave() { var p = P(); return p ? (p.inv || []).filter(function (x) { return x && x.id === BLOOD && !x.lock; }).reduce(function (n, x) { return n + (Number(x.cnt) || 1); }, 0) : 0; }
  function balance(cur) {
    var p = P(); if (!p) return 0;
    if (cur === 'gold') return Math.max(0, Math.floor(Number(p.gold) || 0));
    if (cur === 'dia') { if (!diaReady()) return 0; try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } }
    if (cur === 'blood') return bloodHave();
    return 0;
  }
  function curReady(cur) { return cur === 'gold' || (cur === 'dia' && diaReady()) || (cur === 'blood' && !!DB.items[BLOOD] && typeof W.gainItem === 'function'); }
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
  function credit(cur, n, p) {
    p = p || P(); if (!(n > 0)) return true; if (!p) return false;
    if (cur === 'gold') { p.gold = Math.floor(Number(p.gold) || 0) + n; return true; }
    if (cur === 'dia') return diaAdjust(n);
    if (cur === 'blood') { if (!DB.items[BLOOD] || p !== P()) return false; gainItem(BLOOD, n, true, true); return true; }
    return false;
  }
  function amtTxt(cur, n) { return CURS[cur] + ' ' + fmt(n) + (cur === 'gold' ? '' : ' 顆'); }

  // ════════════════ 座位帳（防複製） ════════════════
  var DIA_KEY = 'afk_poker_dia', STALE_MS = 120000;
  var TAB_ID = (function () { var k = 'afk_poker_tab'; try { var t = sessionStorage.getItem(k); if (!t) { t = Math.random().toString(36).slice(2, 10); sessionStorage.setItem(k, t); } return t; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
  function readDia() { try { var s = localStorage.getItem(DIA_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function writeDia(o) { try { if (o) localStorage.setItem(DIA_KEY, JSON.stringify(o)); else localStorage.removeItem(DIA_KEY); return true; } catch (e) { return false; } }
  function safeSave() { try { return typeof saveGame === 'function' && saveGame() === true; } catch (e) { console.warn('[AFK-poker] saveGame', e); return false; } }
  var tb = null;   // 目前的牌桌（一次只坐一桌）
  function persist() {
    if (!tb) return;
    var rec = { t: tb.def.id, stack: tb.seats[0].stack, hb: Date.now(), tab: TAB_ID };
    if (tb.def.cur === 'dia') { if (!writeDia(rec)) console.warn('[AFK-poker] 籌碼紀錄寫不進去'); }
    else if (tb.owner) { tb.owner.afkPoker = rec; if (tb.owner === P()) safeSave(); }
  }
  var hbTimer = null;
  function heartbeat(onOff) {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    if (onOff) hbTimer = setInterval(function () { if (tb && tb.def.cur === 'dia') { var d = readDia(); if (d && d.tab === TAB_ID) { d.hb = Date.now(); writeDia(d); } } }, 30000);
  }
  // 上次沒離座就關掉遊戲／換角色：桌上剩下的籌碼換回去
  function refundStale() {
    var out = [], p = P();
    if (p && p.afkPoker && !(tb && tb.owner === p && tb.def.cur !== 'dia')) {
      var r = p.afkPoker, def = TBL[r.t], n = Math.max(0, Math.floor(Number(r.stack) || 0));
      if (def && def.cur !== 'dia' && credit(def.cur, n, p)) { delete p.afkPoker; safeSave(); if (n > 0) out.push(amtTxt(def.cur, n)); }
      else if (!def || def.cur === 'dia') delete p.afkPoker;
    }
    var d = readDia();
    if (d && !(tb && tb.def.cur === 'dia') && (d.tab === TAB_ID || Date.now() - (Number(d.hb) || 0) > STALE_MS) && diaReady()) {
      var m = Math.max(0, Math.floor(Number(d.stack) || 0));
      if (!m || diaAdjust(m)) { writeDia(null); if (m > 0) out.push(amtTxt('dia', m)); }
    }
    if (out.length) { sys('<span class="text-amber-300">🃏 上次離開牌桌時沒有離座，這手算棄牌；桌上剩下的籌碼已換回：' + out.join('、') + '。</span>'); try { if (typeof updateUI === 'function') updateUI(); } catch (e) {} }
    return out;
  }
  function hasPending() { var p = P(); var d = readDia(); return !!((p && p.afkPoker && !(tb && tb.owner === p)) || (d && !(tb && tb.def.cur === 'dia'))); }

  var cfg = { delay: 750, next: 3500, nNpc: null };   // 測試可改
  function whyNotSit(def, amt) {
    var p = P();
    if (!p) return '請先進入遊戲';
    if (p.classicMode) return '經典模式不開放';
    if (!on()) return '牌桌今天不開';
    if (tb) return '你已經坐在' + tb.def.n;
    if (!curReady(def.cur)) return CURS[def.cur] + '暫時不能用';
    if (hasPending()) { refundStale(); if (hasPending()) return '上一桌的籌碼還在結算，請稍後再試'; }
    amt = Math.floor(Number(amt));
    if (def.nomax) { if (!(amt >= def.min)) return '買入至少 ' + fmt(def.min); if (amt > def.max) return '買入最多 ' + fmt(def.max); }
    else if (!(amt >= def.min && amt <= def.max)) return '買入要在 ' + fmt(def.min) + '～' + fmt(def.max) + ' 之間';
    if (balance(def.cur) < amt) return CURS[def.cur] + '不夠（你有 ' + fmt(balance(def.cur)) + '）';
    return '';
  }
  function buyIn(tableId, amt, opt) {
    var def = TBL[tableId]; if (!def) return { ok: false, msg: '沒有這一桌' };
    var why = whyNotSit(def, amt); if (why) return { ok: false, msg: why };
    amt = Math.floor(Number(amt));
    var p = P();
    if (!debit(def.cur, amt)) return { ok: false, msg: CURS[def.cur] + '扣不下來，沒有入座' };
    var nNpc = (opt && opt.nNpc) || cfg.nNpc || (3 + Math.floor(Math.random() * 3));
    tb = newTable(def, amt, nNpc, opt && opt.rng, !!(opt && opt.hard));
    tb.owner = p;
    if (def.cur === 'dia') {
      if (!writeDia({ t: def.id, stack: amt, hb: Date.now(), tab: TAB_ID })) { diaAdjust(amt); tb = null; return { ok: false, msg: '籌碼紀錄寫不進去，龍之鑽石已退回' }; }
      heartbeat(true);
    } else { p.afkPoker = { t: def.id, stack: amt, hb: Date.now(), tab: TAB_ID }; safeSave(); }
    sys('<span class="text-emerald-300">🃏 在' + esc(tblName()) + '用' + esc(amtTxt(def.cur, amt)) + '換了籌碼入座。</span>');
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    return { ok: true, table: tb };
  }
  // 補籌碼（兩手之間）
  function topUp(amt) {
    if (!tb || (tb.hand && !tb.hand.done)) return { ok: false, msg: '這手打完才能補' };
    var def = tb.def, s = tb.seats[0], p = P();
    amt = Math.floor(Number(amt));
    if (!p || tb.owner !== p) return { ok: false, msg: '請先進入遊戲' };
    if (!(amt > 0) || s.stack + amt > def.max) return { ok: false, msg: '桌上最多 ' + fmt(def.max) };
    if (balance(def.cur) < amt) return { ok: false, msg: CURS[def.cur] + '不夠' };
    if (!debit(def.cur, amt)) return { ok: false, msg: CURS[def.cur] + '扣不下來' };
    s.stack += amt;
    if (def.cur === 'dia' && !writeDia({ t: def.id, stack: s.stack, hb: Date.now(), tab: TAB_ID })) { s.stack -= amt; diaAdjust(amt); return { ok: false, msg: '籌碼紀錄寫不進去，龍之鑽石已退回' }; }
    persist();
    return { ok: true };
  }
  // 離座：這手還沒棄牌就先棄牌，剩下的籌碼換回去
  function cashOut() {
    if (!tb) return { ok: false, msg: '你沒有坐在牌桌' };
    var p = P(), def = tb.def, s = tb.seats[0];
    if (!p || tb.owner !== p) { closeTable(); return { ok: false, msg: '角色已經換了，籌碼會在讀檔時換回' }; }
    stopTimer();
    if (tb.hand && !tb.hand.done && inHand(s)) { s.folded = true; s.last = '棄牌'; }
    if (tb.hand && !tb.hand.done) tb.hand.abandoned = true;
    var n = s.stack;
    if (def.cur === 'dia') {
      if (!credit('dia', n)) { persist(); return { ok: false, msg: '龍之鑽石帳戶忙碌中，請再按一次離座' }; }
      writeDia(null); heartbeat(false);
    } else {
      if (!credit(def.cur, n, p)) { persist(); return { ok: false, msg: CURS[def.cur] + '暫時換不回來，請再按一次離座' }; }
      delete p.afkPoker; safeSave();
    }
    sys('<span class="text-emerald-300">🃏 離開' + esc(def.n) + '，籌碼換回' + esc(amtTxt(def.cur, n)) + '。</span>');
    try { if (typeof updateUI === 'function') updateUI(); if (typeof renderTabs === 'function' && def.cur === 'blood') renderTabs(); } catch (e) {}
    closeTable();
    return { ok: true, n: n };
  }
  // 「補到…」的目標：一般桌補到買入上限；無上限桌補回買入下限（不會一按就把全身的錢推上桌）
  function topTarget(def) { return def.nomax ? def.min : def.max; }
  function tblName() { return tb ? tb.def.n + (tb.hard ? '・超難' : '') : ''; }
  function closeTable() { stopTimer(); heartbeat(false); tb = null; hideWin(); }

  // ════════════════ 牌局推進（計時） ════════════════
  var timer = null;
  function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function later(fn, ms) { stopTimer(); timer = setTimeout(function () { timer = null; try { fn(); } catch (e) { console.warn('[AFK-poker]', e); } }, ms); }
  var ui = { raise: false, to: 0, msg: '', min: false, autoNext: 0 };
  function ownerOk() { if (tb && tb.owner !== P()) { closeTable(); return false; } return !!tb; }
  function dealNext() {
    if (!ownerOk()) return;
    if (tb.hand && !tb.hand.done) return;
    var me = tb.seats[0];
    if (me.stack <= 0) { render(); return; }
    ui.raise = false; ui.msg = '';
    if (!startHand(tb)) { render(); return; }
    persist();   // 盲注已經推出去
    render(); pump();
  }
  function pump() {
    if (!ownerOk() || !tb.hand) return;
    var H = tb.hand;
    if (H.done) return handEnd();
    var s = tb.seats[H.toAct];
    if (!s) return;
    if (s.human) { render(); return; }
    later(function () { if (!ownerOk() || tb.hand !== H || H.done) return; npcAct(tb, H.toAct); render(); pump(); }, cfg.delay);
  }
  function handEnd() {
    var H = tb.hand, res = H.result, lines = [];
    res.pots.forEach(function (pt, k) {
      var names = pt.win.map(function (i) { return tb.seats[i].name; }).join('、');
      if (pt.el.length === 1) lines.push(names + (k === 0 ? ' 贏得底池 ' : ' 拿下邊池 ') + fmt(pt.net));
      else lines.push(names + (pt.win.length > 1 ? ' 以' + pt.hand + '平分' : ' 以' + pt.hand + '贏得') + (k === 0 ? '底池 ' : '邊池 ') + fmt(pt.net));
    });
    if (res.rake > 0) lines.push('抽水 ' + fmt(res.rake));
    var fresh = refillNpcs(tb);
    ui.msg = lines.concat(fresh).join('；');
    persist();
    render();
    if (tb.seats[0].stack > 0 && cfg.next >= 0) later(dealNext, cfg.next);
  }
  function humanAct(type, to) {
    if (!ownerOk() || !tb.hand || tb.hand.done || tb.hand.toAct !== 0) return { ok: false };
    var r = act(tb, 0, type, to);
    if (!r.ok) { ui.msg = r.err; render(); return r; }
    ui.raise = false;
    persist();
    render(); pump();
    return r;
  }

  // ════════════════ 畫面 ════════════════
  function css() {
    if (document.getElementById('afk-poker-css')) return;
    var s = document.createElement('style'); s.id = 'afk-poker-css';
    s.textContent = ''
      + '.pk-win{position:fixed;z-index:75;left:50%;transform:translateX(-50%);top:calc(var(--orig-bar-h,0px) + 6px);width:min(96vw,440px);'
      + 'max-height:calc(100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px) - 12px);max-height:calc(100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px) - 12px);'
      + 'overflow-y:auto;overscroll-behavior:contain;background:radial-gradient(ellipse at 50% 35%,#14532d,#052e16 75%);border:2px solid #a16207;border-radius:12px;box-shadow:0 18px 40px #000c;'
      + 'color:#e2e8f0;font-family:Arial,"Microsoft JhengHei",sans-serif;font-size:13px;touch-action:manipulation;box-sizing:border-box}'
      + '.pk-win *{box-sizing:border-box}'
      + '.pk-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#1c1206e6;border-bottom:1px solid #a16207;position:sticky;top:0;z-index:2}'
      + '.pk-title{flex:1;min-width:0;font-weight:800;color:#fde68a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.pk-title small{color:#d6d3d1;font-weight:600;margin-left:4px}'
      + '.pk-hb{min-width:34px;height:30px;border:1px solid #d9bd70;border-radius:6px;background:#151b25;color:#fff3cf;font-size:13px;font-weight:700;padding:0 8px;cursor:pointer}'
      + '.pk-opps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:7px}'
      + '.pk-seat{position:relative;background:#0b1a12d9;border:1px solid #365314;border-radius:8px;padding:4px 5px;min-height:74px}'
      + '.pk-seat.turn{border-color:#facc15;box-shadow:0 0 0 1px #facc15,0 0 10px #facc1588}'
      + '.pk-seat.fold{opacity:.45}.pk-seat.win{border-color:#f59e0b;background:#422006d9}'
      + '.pk-nm{font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:16px}'
      + '.pk-tag{font-size:10px;color:#a3e635;font-weight:700;margin-left:3px}'
      + '.pk-stk{font-size:11.5px;color:#fde68a}'
      + '.pk-last{font-size:11px;color:#cbd5e1;min-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.pk-hn{font-size:11px;color:#fbbf24;font-weight:700}'
      + '.pk-d{position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;background:#f8fafc;color:#0f172a;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center}'
      + '.pk-cards{display:flex;gap:2px;margin:2px 0}'
      + '.pk-c{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:40px;height:56px;border-radius:5px;background:#f8fafc;color:#0f172a;border:1px solid #94a3b8;font-weight:800;line-height:1;box-shadow:0 1px 2px #0008;flex:0 0 auto}'
      + '.pk-c b{font-size:17px}.pk-c i{font-style:normal;font-size:18px;margin-top:1px}.pk-c.r{color:#dc2626}'
      + '.pk-c.bk{background:repeating-linear-gradient(45deg,#7f1d1d 0 4px,#991b1b 4px 8px);border-color:#fca5a5}'
      + '.pk-c.em{background:#ffffff0d;border:1px dashed #ffffff40;box-shadow:none}'
      + '.pk-c.sm{width:24px;height:33px;border-radius:4px}.pk-c.sm b{font-size:11px}.pk-c.sm i{font-size:11px}'
      + '.pk-c.lg{width:50px;height:70px}.pk-c.lg b{font-size:21px}.pk-c.lg i{font-size:22px}'
      + '.pk-mid{text-align:center;padding:4px 6px 6px}'
      + '.pk-board{display:flex;justify-content:center;gap:4px}'
      + '.pk-pot{margin-top:5px;font-weight:800;color:#fde68a}'
      + '.pk-msg{margin:4px 8px;min-height:18px;padding:4px 7px;border-radius:6px;background:#0008;color:#fef3c7;font-size:12.5px;line-height:1.45}'
      + '.pk-me{display:flex;align-items:center;gap:8px;margin:0 7px 6px;padding:6px 8px;border-radius:9px;background:#0b1a12e6;border:1px solid #4d7c0f}'
      + '.pk-me.turn{border-color:#facc15;box-shadow:0 0 0 1px #facc15}.pk-me.win{border-color:#f59e0b;background:#422006e6}'
      + '.pk-me .pk-info{flex:1;min-width:0}'
      + '.pk-acts{display:flex;gap:6px;padding:0 7px 8px;flex-wrap:wrap}'
      + '.pk-acts button,.pk-rz button{flex:1 1 0;min-height:42px;border-radius:8px;border:1px solid #64748b;background:#1e293b;color:#f1f5f9;font-weight:800;font-size:14px;cursor:pointer;padding:0 6px}'
      + '.pk-acts button.f{background:#450a0a;border-color:#b91c1c;color:#fecaca}'
      + '.pk-acts button.c{background:#14532d;border-color:#22c55e;color:#dcfce7}'
      + '.pk-acts button.r{background:#713f12;border-color:#f59e0b;color:#fef3c7}'
      + '.pk-acts button[disabled]{opacity:.4;cursor:not-allowed}'
      + '.pk-rz{padding:0 7px 8px}.pk-rz .row{display:flex;gap:5px;margin-bottom:6px}.pk-rz .row button{min-height:36px;font-size:12.5px}'
      + '.pk-rz input[type=range]{width:100%;margin:2px 0 6px}'
      + '.pk-rz .amt{text-align:center;font-weight:800;color:#fde68a;font-size:15px}'
      + '.pk-ball{position:fixed;z-index:75;right:12px;bottom:calc(var(--m-nav-h,0px) + 140px);width:54px;height:54px;border-radius:50%;border:2px solid #d9bd70;'
      + 'background:radial-gradient(circle at 40% 35%,#166534,#052e16);color:#fde68a;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px #000b;user-select:none}'
      + '.pk-ball b{font-size:20px;line-height:1}.pk-ball span{font-size:10px;font-weight:800;margin-top:1px}'
      + '.pk-ball.turn{border-color:#facc15;box-shadow:0 0 12px #facc15cc;animation:pk-pulse .9s ease-in-out infinite}'
      + '@keyframes pk-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}'
      + '.pk-lobby{background:#0f172af7}.pk-lobby-body{padding:8px}'
      + '#afk-pk-lobby .afk-ax.pk-tbl .pk-lv button{background:#1e293b;border-color:#475569;color:#cbd5e1;padding:6px 10px}#afk-pk-lobby .afk-ax.pk-tbl .pk-lv button.on{background:#7f1d1d;border-color:#f87171;color:#fff}#afk-pk-lobby .afk-ax.pk-tbl .pk-lv button.n.on{background:#166534;border-color:#4ade80}'
      + '.afk-ax.pk-tbl .pk-lv{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:#cbd5e1}#interaction-content .afk-ax.pk-tbl .pk-lv button{background:#1e293b;border-color:#475569;color:#cbd5e1;padding:6px 10px}#interaction-content .afk-ax.pk-tbl .pk-lv button.on{background:#7f1d1d;border-color:#f87171;color:#fff}#interaction-content .afk-ax.pk-tbl .pk-lv button.n.on{background:#166534;border-color:#4ade80}'
      + '.afk-ax.pk-tbl input{width:110px;background:#0f172a;color:#fde68a;border:1px solid #475569;border-radius:6px;padding:6px 8px;font-size:14px}';
    document.head.appendChild(s);
  }
  function cardHtml(c, cls) {
    if (c == null) return '<span class="pk-c em ' + (cls || '') + '"></span>';
    if (c === 'back') return '<span class="pk-c bk ' + (cls || '') + '"></span>';
    var r = cRank(c), su = cSuit(c);
    return '<span class="pk-c ' + (su === 1 || su === 2 ? 'r ' : '') + (cls || '') + '" aria-label="' + esc(cardTxt(c)) + '"><b>' + (RANK_TXT[r] || r) + '</b><i>' + SUIT[su] + '</i></span>';
  }
  var el = function (id) { return document.getElementById(id); };
  function isMobileHidden() {
    var b = document.body;
    if (!b.classList.contains('m-mobile')) return false;
    return !b.classList.contains('mview-center') || b.classList.contains('mlog-open');
  }
  var visObs = null;
  function updateVis() {
    var hide = isMobileHidden(), w = el('afk-pk-win'), b = el('afk-pk-ball'), l = el('afk-pk-lobby');
    if (w) w.style.visibility = hide ? 'hidden' : '';
    if (b) b.style.visibility = hide ? 'hidden' : '';
    if (l) l.style.visibility = hide ? 'hidden' : '';
  }
  function watchVis() { if (!visObs && typeof MutationObserver === 'function') { visObs = new MutationObserver(updateVis); visObs.observe(document.body, { attributes: true, attributeFilter: ['class'] }); } }
  function ensureWin() {
    css();
    var w = el('afk-pk-win');
    if (!w) {
      w = document.createElement('div'); w.id = 'afk-pk-win'; w.className = 'pk-win';
      w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', '德州撲克');
      document.body.appendChild(w);
      w.addEventListener('click', onClick);
      w.addEventListener('input', function (ev) {
        if (ev.target.id !== 'pk-rz-range') return;
        ui.to = Math.floor(Number(ev.target.value)); var L = tb && tb.hand && legal(tb, 0);
        if (L && ui.to > L.maxTo - tb.def.sb) ui.to = L.maxTo;
        var a = el('pk-rz-amt'); if (a && L) a.textContent = rzLabel(L, ui.to);
      });
    }
    watchVis();
    return w;
  }
  function rzLabel(L, to) { return (to >= L.maxTo ? '全下 ' : (L.cur === 0 ? '下注 ' : '加注到 ')) + fmt(to); }
  function hideWin() { var w = el('afk-pk-win'), b = el('afk-pk-ball'); if (w) w.style.display = 'none'; if (b) b.style.display = 'none'; ui.min = false; }
  function openWin() {
    if (!tb) return;
    closeLobby();
    try { if (document.body.classList.contains('m-mobile') && W.__afkm && typeof W.__afkm.setView === 'function') W.__afkm.setView('center'); } catch (e) {}
    try { var tic = el('town-interaction-container'); if (tic && !tic.classList.contains('hidden') && tic.querySelector('.pk-tbl') && typeof W.closeNpcInteraction === 'function') W.closeNpcInteraction(); } catch (e) {}
    ui.min = false; var w = ensureWin(); w.style.display = ''; var b = el('afk-pk-ball'); if (b) b.style.display = 'none';
    render(); updateVis();
  }
  function toBall() {
    ui.min = true; var w = el('afk-pk-win'); if (w) w.style.display = 'none';
    var b = el('afk-pk-ball');
    if (!b) { css(); b = document.createElement('div'); b.id = 'afk-pk-ball'; b.className = 'pk-ball'; b.setAttribute('role', 'button'); b.setAttribute('aria-label', '打開牌桌'); document.body.appendChild(b); b.addEventListener('click', openWin); }
    b.style.display = ''; render(); updateVis();
  }
  function seatHtml(i) {
    var H = tb.hand, s = tb.seats[i], res = H && H.done && H.result, show = res && res.showdown && inHand(s);
    var cls = 'pk-seat' + (H && !H.done && H.toAct === i ? ' turn' : '') + (s.folded || s.out ? ' fold' : '') + (s.won > 0 && H && H.done ? ' win' : '');
    var cards = '';
    if (H && !s.out && s.hole.length) cards = s.hole.map(function (c) { return cardHtml(show ? c : (s.folded ? null : 'back'), 'sm'); }).join('');
    var last = H && H.done ? (s.won > 0 ? '贏得 ' + fmtS(s.won) : (s.folded ? '棄牌' : '')) : (s.last || '');
    return '<div class="' + cls + '">' + (tb.button === i ? '<span class="pk-d">D</span>' : '')
      + '<div class="pk-nm">' + esc(s.name) + '<span class="pk-tag">' + esc((PERS[s.pers] || {}).tag || '') + '</span></div>'
      + '<div class="pk-stk">' + fmtS(s.stack) + '</div>'
      + '<div class="pk-cards">' + cards + '</div>'
      + '<div class="pk-last">' + esc(last) + '</div>'
      + (show ? '<div class="pk-hn">' + esc(handName(s.score)) + '</div>' : '') + '</div>';
  }
  function render() {
    if (!tb) return;
    var b = el('afk-pk-ball');
    if (ui.min) {
      if (b) { var turn = tb.hand && !tb.hand.done && tb.hand.toAct === 0; b.className = 'pk-ball' + (turn ? ' turn' : ''); b.innerHTML = '<b>♠︎</b><span>' + (turn ? '輪到你' : fmtS(tb.seats[0].stack)) + '</span>'; }
      return;
    }
    var w = el('afk-pk-win'); if (!w || w.style.display === 'none') return;
    var def = tb.def, H = tb.hand, me = tb.seats[0], i;
    var h = '<div class="pk-head"><div class="pk-title">♠︎ ' + esc(tblName()) + '<small>盲注 ' + fmtS(def.sb) + '／' + fmtS(def.bb) + '・抽水 3%</small></div>'
      + '<button type="button" class="pk-hb" data-pk="min" aria-label="縮小">－</button><button type="button" class="pk-hb" data-pk="leave">離座</button></div>';
    h += '<div class="pk-opps">'; for (i = 1; i < tb.seats.length; i++) h += seatHtml(i); h += '</div>';
    var board = []; for (i = 0; i < 5; i++) board.push(cardHtml(H ? H.board[i] : null));
    h += '<div class="pk-mid"><div class="pk-board">' + board.join('') + '</div><div class="pk-pot">底池 ' + fmt(H ? potTotal(tb) : 0) + '</div></div>';
    h += '<div class="pk-msg" id="pk-msg">' + esc(ui.msg || (H && H.log.length ? H.log[H.log.length - 1] : '')) + '</div>';
    var myTurn = H && !H.done && H.toAct === 0, won = H && H.done && me.won > 0;
    var myHand = H && me.hole.length && !me.out ? (H.board.length >= 3 ? handName(evaluate(me.hole.concat(H.board))) : (cRank(me.hole[0]) === cRank(me.hole[1]) ? '一對' : '')) : '';
    h += '<div class="pk-me' + (myTurn ? ' turn' : '') + (won ? ' win' : '') + '"><div class="pk-cards">' + (H && me.hole.length ? me.hole.map(function (c) { return cardHtml(c, 'lg'); }).join('') : cardHtml(null, 'lg') + cardHtml(null, 'lg')) + '</div>'
      + '<div class="pk-info"><div class="pk-nm">你' + (tb.button === 0 ? '　(D)' : '') + '</div><div class="pk-stk">籌碼 ' + fmt(me.stack) + '</div>'
      + '<div class="pk-last">' + esc(H && H.done ? (won ? '贏得 ' + fmt(me.won) : (me.folded ? '棄牌' : '')) : (me.last || '')) + '</div>'
      + (myHand ? '<div class="pk-hn">' + esc(myHand) + '</div>' : '') + '</div></div>';
    if (myTurn) {
      var L = legal(tb, 0);
      if (ui.raise && L.canRaise) {
        var pot = potTotal(tb), pre = function (f) { return Math.max(L.minTo, Math.min(L.maxTo, H.cur + Math.max(H.minRaise, roundTo(tb, (pot + L.toCall) * f)))); };
        if (!(ui.to >= L.minTo && ui.to <= L.maxTo)) ui.to = L.minTo;
        h += '<div class="pk-rz"><div class="amt" id="pk-rz-amt">' + rzLabel(L, ui.to) + '</div>'
          + '<input type="range" id="pk-rz-range" min="' + L.minTo + '" max="' + L.maxTo + '" step="' + def.sb + '" value="' + ui.to + '" aria-label="加注金額">'
          + '<div class="row"><button type="button" data-pk="to:' + L.minTo + '">最小</button><button type="button" data-pk="to:' + pre(0.5) + '">半池</button><button type="button" data-pk="to:' + pre(1) + '">一池</button><button type="button" data-pk="to:' + L.maxTo + '">全下</button></div>'
          + '<div class="row"><button type="button" data-pk="rzno">取消</button><button type="button" class="r" data-pk="rzok" style="background:#713f12;border-color:#f59e0b;color:#fef3c7">確定</button></div></div>';
      } else {
        h += '<div class="pk-acts"><button type="button" class="f" data-pk="fold">棄牌</button>'
          + (L.canCheck ? '<button type="button" class="c" data-pk="check">過牌</button>' : '<button type="button" class="c" data-pk="call">' + (L.callAmt >= me.stack ? '全下 ' : '跟注 ') + fmtS(L.callAmt) + '</button>')
          + (L.canRaise ? '<button type="button" class="r" data-pk="raise">' + (L.canCheck ? '下注' : '加注') + '</button>' : '') + '</div>';
      }
    } else if (!H || H.done) {
      if (me.stack <= 0 || me.stack < def.min) {
        var room = topTarget(def) - me.stack, can = Math.min(room, balance(def.cur));
        h += '<div class="pk-acts">' + (can > 0 && me.stack + can >= def.min ? '<button type="button" class="c" data-pk="topup">補到 ' + fmtS(me.stack + can) + '</button>' : '')
          + (me.stack > 0 ? '<button type="button" data-pk="next">下一手</button>' : '') + '<button type="button" class="f" data-pk="leave">離座</button></div>';
      } else h += '<div class="pk-acts"><button type="button" class="c" data-pk="next">下一手</button></div>';
    }
    w.innerHTML = h;
  }
  function onClick(ev) {
    var b = ev.target.closest('[data-pk]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-pk');
    if (a === 'min') return toBall();
    if (a === 'leave') {
      var mid = tb && tb.hand && !tb.hand.done && inHand(tb.seats[0]);
      if (mid && !b.hasAttribute('data-sure')) { b.setAttribute('data-sure', '1'); b.textContent = '確定離座'; ui.msg = '這手還沒打完，現在離座就算棄牌。'; var m = el('pk-msg'); if (m) m.textContent = ui.msg; return; }
      var r = cashOut(); if (!r.ok) { ui.msg = r.msg; render(); } return;
    }
    if (a === 'next') { stopTimer(); return dealNext(); }
    if (a === 'topup') { var def = tb.def, amt = Math.min(topTarget(def) - tb.seats[0].stack, balance(def.cur)); var t = topUp(amt); ui.msg = t.ok ? '補好了籌碼。' : t.msg; render(); if (t.ok && cfg.next >= 0) later(dealNext, cfg.next); return; }
    if (a === 'fold' || a === 'check' || a === 'call') return humanAct(a);
    if (a === 'raise') { ui.raise = true; ui.to = legal(tb, 0).minTo; return render(); }
    if (a === 'rzno') { ui.raise = false; return render(); }
    if (a.indexOf('to:') === 0) { ui.to = Math.floor(Number(a.slice(3))); return render(); }
    if (a === 'rzok') return humanAct('raise', ui.to);
  }

  // ════════════════ 不用走回村莊：浮動牌桌清單（設定分頁「♠︎ 德州撲克」開的；內容跟洛蒂的面板同一份） ════════════════
  function closeLobby() { var l = el('afk-pk-lobby'); if (l) l.style.display = 'none'; }
  // 經典模式的角色看不到入口（換角色時重新判斷）
  function syncNav() { var b = el('m-afk-nav-poker'), p = P(); if (b) b.style.display = (p && p.classicMode) ? 'none' : ''; }
  function openLobby() {
    var p = P();
    if (!p || p.classicMode || !on()) return false;
    // 入口在設定分頁；手機上浮動視窗只在戰鬥畫面露出 → 先切回戰鬥畫面（跟賽狗場一樣），不然按了像沒反應
    try { if (document.body.classList.contains('m-mobile') && W.__afkm && typeof W.__afkm.setView === 'function') W.__afkm.setView('center'); } catch (e) {}
    css();
    var l = el('afk-pk-lobby');
    if (!l) {
      l = document.createElement('div'); l.id = 'afk-pk-lobby'; l.className = 'pk-win pk-lobby';
      l.setAttribute('role', 'dialog'); l.setAttribute('aria-label', '德州撲克牌桌');
      l.innerHTML = '<div class="pk-head"><div class="pk-title">♠︎ 德州撲克<small>荷官洛蒂的牌桌</small></div><button type="button" class="pk-hb" data-pkl="close" aria-label="關閉">✕</button></div><div class="pk-lobby-body" id="afk-pk-lobby-body"></div>';
      l.querySelector('[data-pkl="close"]').addEventListener('click', closeLobby);
      document.body.appendChild(l);
    }
    watchVis();
    l.style.display = '';
    panel(el('afk-pk-lobby-body'));
    updateVis();
    return true;
  }

  // ════════════════ 荷官 NPC（歐瑞村莊） ════════════════
  var NPC_ID = 'npc_afk_poker', NPC_N = '洛蒂', NPC_T = '德州撲克';
  var sel = {}, selHard = {};   // 各桌輸入的買入金額、對手難度
  function panel(div) {
    if (!div) return;
    var K = W.__afkNpcKit; if (K && K.css) K.css();
    css();
    var p = P();
    if (!p || p.classicMode || !on()) { div.innerHTML = '<div class="afk-ax"><p class="ax-lore">「今天不開桌。」</p></div>'; return; }
    refundStale();
    var h = '<div class="afk-ax pk-tbl"><p class="ax-lore">洛蒂俐落地洗著牌：「無限注德州撲克，輸贏都算你自己的。籌碼在離座時換回來；牌打到一半走人，那手就當你棄牌。」</p>';
    if (tb) h += '<div class="ax-row"><div class="ax-main"><div><div class="ax-name">你正坐在' + esc(tblName()) + '</div><div class="ax-desc">籌碼 ' + fmt(tb.seats[0].stack) + '</div></div></div><div class="ax-act"><button type="button" data-pkn="open">回到牌桌</button></div></div>';
    TABLES.forEach(function (t) {
      if (!curReady(t.cur)) return;
      var bal = balance(t.cur), v = sel[t.id] != null ? sel[t.id] : (t.nomax ? t.min : Math.max(t.min, Math.min(t.max, bal)));   // 無上限桌預設填下限，不預設全押
      var why = tb ? '' : whyNotSit(t, v);
      h += '<div class="ax-row" data-row="' + t.id + '"><div class="ax-main"><div style="min-width:0"><div class="ax-name">' + esc(t.n) + '</div>'
        + '<div class="ax-desc">盲注 ' + fmt(t.sb) + '／' + fmt(t.bb) + '　買入 ' + (t.nomax ? fmt(t.min) + ' 起，無上限' : fmt(t.min) + '～' + fmt(t.max)) + '　抽水 3%</div>'
        + '<div class="ax-note">你有' + esc(amtTxt(t.cur, bal)) + '</div>'
        + (why && !tb ? '<div class="ax-req"><span class="no" style="font-size:12px">' + esc(why) + '</span></div>' : '') + '</div></div>'
        + (tb ? '' : '<div class="ax-act"><span class="pk-lv" role="group" aria-label="對手">對手：<button type="button" data-pkn="lv:' + t.id + ':0" class="n' + (selHard[t.id] ? '' : ' on') + '">一般</button><button type="button" data-pkn="lv:' + t.id + ':1"' + (selHard[t.id] ? ' class="on"' : '') + '>超難</button></span><input type="number" inputmode="numeric" min="' + t.min + '"' + (t.nomax ? '' : ' max="' + t.max + '"') + ' step="' + t.bb + '" value="' + v + '" data-pkin="' + t.id + '" aria-label="' + esc(t.n) + '買入金額">'
          + '<button type="button" data-pkn="set:' + t.id + ':min">最少</button><button type="button" data-pkn="set:' + t.id + ':max">最多</button>'
          + '<button type="button" data-pkn="sit:' + t.id + '"' + (why ? ' disabled' : '') + '>入座</button></div>') + '</div>';
    });
    h += '<div class="ax-err" id="pk-npc-err"></div></div>';
    div.innerHTML = h;
    div.oninput = function (ev) { var id = ev.target.getAttribute && ev.target.getAttribute('data-pkin'); if (!id) return; sel[id] = ev.target.value; var t = TBL[id], btn = div.querySelector('[data-pkn="sit:' + id + '"]'); if (btn) btn.disabled = !!whyNotSit(t, sel[id]); };
    div.onclick = function (ev) {
      var bt = ev.target.closest('[data-pkn]'); if (!bt || bt.disabled) return;
      var a = bt.getAttribute('data-pkn').split(':');
      if (a[0] === 'open') return openWin();
      if (a[0] === 'set') { var t = TBL[a[1]], bal = balance(t.cur); sel[a[1]] = a[2] === 'min' ? t.min : Math.max(t.min, Math.min(t.max, bal)); return panel(div); }
      if (a[0] === 'lv') { selHard[a[1]] = a[2] === '1'; return panel(div); }
      if (a[0] === 'sit') {
        var r = buyIn(a[1], sel[a[1]] != null ? sel[a[1]] : (div.querySelector('[data-pkin="' + a[1] + '"]') || {}).value, { hard: !!selHard[a[1]] });
        if (!r.ok) { var e = div.querySelector('#pk-npc-err'); if (e) e.textContent = r.msg; return; }
        panel(div); openWin(); dealNext();
      }
    };
  }

  // ── 讀檔：先收掉上一個角色的牌桌（籌碼已記在那邊），再把沒離座的籌碼換回 ──
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () {
      try { if (tb) closeTable(); } catch (e) {}
      var r = oLoad.apply(this, arguments);
      setTimeout(function () { try { refundStale(); } catch (e) { console.warn('[AFK-poker] refund', e); } try { closeLobby(); syncNav(); } catch (e) {} }, 800);
      return r;
    };
  }
  W.__afkPoker = {
    TABLES: TABLES, TBL: TBL, PERS: PERS, NPCS: NPCS, CURS: CURS, DIA_KEY: DIA_KEY, BLOOD: BLOOD, NPC_ID: NPC_ID, cfg: cfg,
    evaluate: evaluate, handName: handName, catOf: catOf, cardTxt: cardTxt,
    newTable: newTable, newSeat: newSeat, startHand: startHand, act: act, legal: legal, buildPots: buildPots, potTotal: potTotal,
    equity: equity, npcDecide: npcDecide, npcAct: npcAct, refillNpcs: refillNpcs,
    hardDecide: hardDecide, rangeEquity: rangeEquity, pfPct: pfPct, strength: strength, modelOf: modelOf, RAKE: RAKE, rakeOf: rakeOf, STACK_CAP: STACK_CAP, HARD_NPCS: HARD_NPCS,
    balance: balance, buyIn: buyIn, cashOut: cashOut, topUp: topUp, refundStale: refundStale, humanAct: humanAct, dealNext: dealNext,
    table: function () { return tb; }, openWin: openWin, toBall: toBall, panel: panel, render: render, on: on, openLobby: openLobby, closeLobby: closeLobby
  };
  setTimeout(function () { try { if (P()) refundStale(); } catch (e) {} }, 3000);
  if (!on()) return;   // 關掉時只留「把沒離座的籌碼換回去」

  try {
    var L = W.__afkLore, def = { id: NPC_ID, n: NPC_N, title: NPC_T, type: 'poker', classicHide: true,
      d: '在歐瑞村莊開牌桌的荷官洛蒂。用金幣、龍之鑽石或血龍鑽換籌碼，跟各路冒險者玩無限注德州撲克。' };
    if (L && L.addNpc) L.addNpc('town_oren', def, '6804', [58, 80]);
    else if (DB.towns && DB.towns.town_oren) DB.towns.town_oren.npcs.push(def);
    var K = W.__afkNpcKit; if (K && K.hookNpc) K.hookNpc(NPC_ID, NPC_N, NPC_T, panel);
  } catch (e) { console.warn('[AFK-poker] NPC', e); }
  // ── 設定分頁「🔌 外掛」列：「♠︎ 德州撲克」排在「🐕 賽狗場」旁邊，在哪裡都能開牌桌清單 ──
  var navTries = 0;
  function injectNav() {
    if (!el('tab-automation')) return false;
    if (el('m-afk-nav-poker')) return true;
    var dg = el('m-afk-nav-dograce');
    if (!dg && T && T.enabled && T.enabled('dograce') && navTries < 20) return false;   // 等賽狗場的鈕先放好
    var row = el('m-afk-navrow');
    if (!row) {
      row = document.createElement('div'); row.id = 'm-afk-navrow'; row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      el('tab-automation').appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-poker'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%'; b.style.marginTop = '8px';
    b.textContent = '♠︎ 德州撲克';
    b.addEventListener('click', function () { openLobby(); });
    if (dg && dg.parentNode) dg.parentNode.insertBefore(b, dg.nextSibling); else row.appendChild(b);
    syncNav();
    return true;
  }
  (function tryNav() { if (injectNav()) return; if (++navTries < 40) setTimeout(tryNav, 500); })();
  console.log('[AFK-poker] 已啟用：歐瑞村莊 德州撲克');
})();
