/* ============================================================================
 * afk-fishing.js — 🐟 海音深海獵場（捕魚機；玩家 2026-11-05；外掛開關 fishing，預設開；經典模式沒有）
 *
 *   遊戲廳裡的一台捕魚機。用遊戲裡現有的天堂水中怪物圖當魚（assets/anim/<怪物名>/idle_n、death_n）。
 *   2026-11-05 Ping：獎勵下修——大魚、黃金魚、Boss 倍數大降（單隻最多 100 倍；原法利昂最高 800 倍），返還率不變（倍數降、捕獲率跟著升）。
 *   2026-11-05 15:00 Ping：再下修——基本返還 0.92→0.85、Boss 再降（法利昂 40～60）、雷電最多 8 隻、炸彈範圍縮小、雷射 6 次、鑽頭 8 次。
 *   每發子彈當下扣錢；子彈一定會打到一條魚（碰牆反彈、12 秒沒打到就退錢），打到時判定一次：
 *     捕獲機率＝0.85 ÷ 倍數（Boss 用平均倍數；特殊魚另外加上「效果的期望值」），所以打哪一種長期都一樣。
 *     另 1.5% 進 JP 獎池；抓到水龍法利昂時轉 JP 轉盤。合計返還率約 86.5%（Ping 2026-11-05 下修）。
 *   砲台（Ping 定）：金幣 5 萬起、龍鑽 100 起、血龍鑽 10 起，六個等級，子彈外觀依等級不同。
 *   特殊魚：雷電水精靈（全場同種魚一起判定）、炸彈蟹人（範圍內判定）、雷射海星（送雷射砲：一條線上 8 次判定）、
 *           鑽頭龍龜（送鑽頭砲：亂彈 10 次判定）。拿到沒用的特殊砲存進存檔。
 *   NPC 漁夫八位（下面 4、上面 4）：只打 2～5 倍的小魚，純熱鬧（他們打到的不影響你的錢與機率）。
 *   魚從上下左右四邊進場（Boss 只走左右），畫面約 65 條；魚潮 20 秒內 ×1.2～1.5。跑不動時自動少放魚、關發光。
 *   效能：canvas 一張畫完、最多 100 條魚／你的子彈 60 顆＋NPC 子彈 40 顆、30 幀；視窗關掉、縮小、切到別的畫面就停。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fishing', name: '海音深海獵場（捕魚機）', group: '遊戲內容', def: true, seal: true,
    desc: '遊戲廳裡的捕魚機：用金幣、龍之鑽石或血龍鑽射天堂的水中怪物，有特殊武器、Boss（法利昂、幽靈船長、海賊王德雷克）與 JP 轉盤' });
  var on = function () { return !T || T.enabled('fishing'); };
  var NAME = '海音深海獵場';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var el = function (id) { return document.getElementById(id); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var fmtS = function (n) { n = Number(n || 0); if (n >= 1e8) return (Math.floor(n / 1e7) / 10) + '億'; if (n >= 1e4) return (Math.floor(n / 1e3) / 10) + '萬'; return n.toLocaleString(); };
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var G = function () { return W.__afkGameHall; };

  // ════════════════ 數值 ════════════════
  var R0 = 0.85, JP_RATE = 0.015;   // 2026-11-05 15:00 Ping：收益再下修（原 0.92；合計返還率約 86.5%）
  var CURS = { gold: '金幣', dia: '龍之鑽石', blood: '血龍鑽' }, ICON = { gold: '💰', dia: '💎', blood: '🩸' };
  var LEVELS = { gold: [50000, 100000, 200000, 300000, 500000, 1000000], dia: [100, 200, 300, 500, 800, 1000], blood: [10, 20, 30, 50, 80, 100] };
  var BULLET_LOOK = [['#e2e8f0', 4], ['#7dd3fc', 5], ['#4ade80', 5], ['#facc15', 6], ['#f472b6', 6], ['#f97316', 7]];   // 依等級：顏色、半徑
  var JP_SEED = { gold: 1000000, dia: 2000, blood: 200 };   // 2026-11-05 Ping：獎勵下修（原 500 萬／1 萬／1,000）
  var WHEEL = [['迷你', 0.05, 60], ['小獎', 0.15, 25], ['大獎', 0.40, 12], ['超級 JP', 1.00, 3]];
  var FIRE_MS = 200, BULLET_LIFE = 12000, BULLET_SPEED = 520, MAX_FISH = 100, MAX_BULLETS = 60, MAX_NPC_BULLETS = 40, FISH_TARGET = 65;
  // 魚：n 名稱、img 圖資料夾、m 倍數 [下, 上]、sz 畫面高度、sp 速度、w 出現權重、tint 染色、sp2 特殊、boss
  var FISH = [
    { id: 'star', n: '海星', img: '海星', fr: 8, df: 8, m: [2, 2], sz: 38, sp: 55, w: 22 },
    { id: 'crab', n: '蟹人', img: '蟹人', fr: 6, df: 11, m: [3, 3], sz: 44, sp: 52, w: 18 },
    { id: 'croc', n: '鱷魚', img: '鱷魚', fr: 10, df: 8, m: [4, 4], sz: 40, sp: 60, w: 15 },
    { id: 'sailor', n: '溺死的水手', img: '溺死的水手', fr: 12, df: 12, m: [5, 5], sz: 52, sp: 48, w: 12 },
    { id: 'mermaid', n: '人魚', img: '人魚', fr: 10, df: 13, m: [8, 8], sz: 62, sp: 46, w: 8 },
    { id: 'lamia', n: '蛇女', img: '蛇女', fr: 14, df: 10, m: [10, 10], sz: 66, sp: 42, w: 6 },
    { id: 'spirit', n: '水屬性精靈', img: '水屬性精靈', sub: 'd2/', fr: 10, df: 10, m: [12, 12], sz: 56, sp: 50, w: 5 },
    { id: 'turtle', n: '龍龜', img: '龍龜', fr: 11, df: 8, m: [15, 15], sz: 66, sp: 36, w: 4 },
    { id: 'abyss', n: '深淵水靈', img: '深淵水靈', fr: 19, df: 16, m: [20, 20], sz: 76, sp: 40, w: 3 },
    { id: 'shark', n: '鯊魚', img: '鯊魚', fr: 8, df: 16, m: [25, 25], sz: 96, sp: 44, w: 2 },
    { id: 'gcroc', n: '巨大鱷魚', img: '巨大鱷魚', fr: 10, df: 8, m: [30, 30], sz: 82, sp: 34, w: 1.2 },
    { id: 'gturtle', n: '黃金龍龜', img: '龍龜', fr: 11, df: 8, m: [30, 30], sz: 84, sp: 32, w: 0.5, tint: 'rgba(255,200,40,.55)', glow: '#facc15' },
    { id: 'gshark', n: '黃金鯊魚', img: '鯊魚', fr: 8, df: 16, m: [40, 40], sz: 112, sp: 38, w: 0.3, tint: 'rgba(255,200,40,.55)', glow: '#facc15' },
    // 特殊魚
    { id: 'bolt', n: '雷電水精靈', img: '強力水屬性精靈', sub: 'd2/', fr: 10, df: 9, m: [15, 15], sz: 62, sp: 46, w: 0.45, sp2: 'bolt', badge: '⚡', glow: '#60a5fa' },
    { id: 'bomb', n: '炸彈蟹人', img: '蟹人', fr: 6, df: 11, m: [10, 10], sz: 54, sp: 46, w: 0.45, sp2: 'bomb', badge: '💣', tint: 'rgba(255,40,40,.45)', glow: '#ef4444' },
    { id: 'laser', n: '雷射海星', img: '海星', fr: 8, df: 8, m: [8, 8], sz: 48, sp: 50, w: 0.4, sp2: 'laser', badge: '🔫', tint: 'rgba(170,80,255,.5)', glow: '#c084fc' },
    { id: 'drill', n: '鑽頭龍龜', img: '龍龜', fr: 11, df: 8, m: [10, 10], sz: 70, sp: 36, w: 0.4, sp2: 'drill', badge: '🌀', tint: 'rgba(40,220,230,.5)', glow: '#22d3ee' },
    // Boss（定時出場）
    { id: 'ghost', n: '幽靈船長', img: '幽靈船長', fr: 12, df: 12, m: [20, 40], sz: 150, sp: 22, boss: 300, glow: '#a78bfa' },
    { id: 'drake', n: '沉沒的海賊王 德雷克', img: '沉沒的海賊王 德雷克', fr: 12, df: 12, m: [25, 50], sz: 160, sp: 20, boss: 480, glow: '#34d399' },
    { id: 'fafu', n: '水龍 法利昂', img: '法利昂', fr: 16, df: 27, m: [40, 60], sz: 250, sp: 16, boss: 900, glow: '#38bdf8', jp: true }
  ];
  var FBY = {}; FISH.forEach(function (f) { FBY[f.id] = f; f.avg = (f.m[0] + f.m[1]) / 2; });
  var NORMAL = FISH.filter(function (f) { return !f.boss; }), NW = NORMAL.reduce(function (a, f) { return a + f.w; }, 0);
  var LASER_N = 6, DRILL_N = 8, BOMB_R = 110, BOLT_MAX = 8;

  // ════════════════ 圖 ════════════════
  var imgCache = {};
  function frameUrl(f, kind, i) { return 'assets/anim/' + encodeURIComponent(f.img) + '/' + (f.sub || '') + kind + '_' + i + (i === 0 ? '.png' : '.webp'); }
  function getImg(url) {
    var o = imgCache[url]; if (o) return o;
    o = imgCache[url] = { im: new Image(), ok: false, bb: null };
    o.im.onload = function () { o.ok = true; }; o.im.src = url;
    return o;
  }
  // 不透明像素的範圍（讓不同怪物在畫面上大小一致）；file:// 讀不到就用整張圖
  var bbCache = {};
  function bbox(f) {
    var k = f.img + (f.sub || ''); if (bbCache[k]) return bbCache[k];
    var o = getImg(frameUrl(f, 'idle', 0)); if (!o.ok) return null;
    var w = o.im.naturalWidth, h = o.im.naturalHeight, b = { x: 0, y: 0, w: w, h: h };
    try {
      var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.drawImage(o.im, 0, 0);
      var d = x.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (var yy = 0; yy < h; yy += 2) for (var xx = 0; xx < w; xx += 2) if (d[(yy * w + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (yy < y0) y0 = yy; if (xx > x1) x1 = xx; if (yy > y1) y1 = yy; }
      if (x1 > x0 && y1 > y0) b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    } catch (e) {}
    return (bbCache[k] = b);
  }
  var tintCache = {};
  function tinted(f, o, key) {
    if (!f.tint) return o.im;
    var t = tintCache[key]; if (t) return t;
    var c = document.createElement('canvas'); c.width = o.im.naturalWidth; c.height = o.im.naturalHeight;
    var x = c.getContext('2d'); x.drawImage(o.im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = f.tint; x.fillRect(0, 0, c.width, c.height);
    return (tintCache[key] = c);
  }
  function preload() { FISH.forEach(function (f) { for (var i = 0; i < f.fr; i++) getImg(frameUrl(f, 'idle', i)); }); }

  // ════════════════ 狀態 ════════════════
  var VW = 800, VH = 500;
  var st = null;
  function newState() {
    return { fish: [], bullets: [], fx: [], npc: [{ x: 110, top: 0, n: '阿德' }, { x: 255, top: 0, n: '茉莉' }, { x: 545, top: 0, n: '老彼得' }, { x: 690, top: 0, n: '小翠' }, { x: 110, top: 1, n: '海音漁夫 卡洛' }, { x: 300, top: 1, n: '漁家女 蓮' }, { x: 500, top: 1, n: '老船長 葛雷' }, { x: 690, top: 1, n: '學徒 小奇' }].map(function (n) { n.ang = n.top ? Math.PI / 2 : -Math.PI / 2; n.cd = Math.random() * 1500; return n; }), t: 0, nextSpawn: 0, nextWave: 60000,
      boss: { ghost: 120000, drake: 300000, fafu: 600000 }, aim: -Math.PI / 2, firing: false, lastShot: 0, auto: false, lock: null, lockMode: false,
      lv: 0, cur: 'gold', won: 0, spent: 0, uid: 1, wheel: null, weapon: null, msg: '', dirty: 0 };
  }
  function hall() { var g = G(); return g && g.hallData ? g.hallData() : null; }
  function balance(cur) { var g = G(); return g ? g.balance(cur) : 0; }
  function bet() { return LEVELS[st.cur][st.lv]; }
  function jpGet(cur) {
    if (cur === 'dia') { var v = Number(LS('afk_fish_jp_dia')); return v > 0 ? v : JP_SEED.dia * 100; }
    var d = hall(); if (!d) return JP_SEED[cur] * 100; d.fjp = d.fjp || {}; return d.fjp[cur] > 0 ? d.fjp[cur] : JP_SEED[cur] * 100;
  }
  function jpSet(cur, v) { if (cur === 'dia') LS('afk_fish_jp_dia', String(Math.floor(v))); else { var d = hall(); if (d) { d.fjp = d.fjp || {}; d.fjp[cur] = Math.floor(v); } } }
  function weapons() { var d = hall(); if (!d) return []; if (!Array.isArray(d.fishW)) d.fishW = []; return d.fishW; }
  var saveT = 0;
  function markSave(now) { st.dirty = 1; if (!saveT) saveT = setTimeout(flushSave, 2000); if (now) flushSave(); }
  function flushSave() { if (saveT) { clearTimeout(saveT); saveT = 0; } if (st && st.dirty) { st.dirty = 0; var g = G(); if (g) g.safeSave(); } }
  function pay(cur, amount100, multX) {   // 入帳（1/100 單位，零頭累積）
    var g = G(); if (!g) return 0;
    var got = g.settle('fish', cur, 0, amount100, multX, { noRound: true, noSave: true });
    return got;
  }

  // ════════════════ 魚的生成與移動 ════════════════
  function spawnFish(def, opts) {
    if (st.fish.length >= MAX_FISH && !def.boss) return null;
    opts = opts || {};
    var sp = def.sp * (0.85 + Math.random() * 0.3), f;
    // 上下也出怪（Boss 只從左右進場）：上面進來往下游、下面進來往上游，帶一點斜
    var side = opts.side || (def.boss || opts.fromLeft != null ? 'h' : (Math.random() < 0.3 ? 'v' : 'h'));
    if (side === 'v') {
      var fromTop = opts.fromTop != null ? opts.fromTop : Math.random() < 0.5, x = opts.x != null ? opts.x : 60 + Math.random() * (VW - 120);
      f = { uid: st.uid++, d: def, x: x, y: fromTop ? -def.sz * 0.6 : VH + def.sz * 0.6, vx: (Math.random() - 0.5) * sp * 0.8, vy: (fromTop ? 1 : -1) * sp * 0.8, vert: true,
        ph: Math.random() * 6, fi: Math.random() * def.fr, dead: 0, disp: def.m[0] };
    } else {
      var fromLeft = opts.fromLeft != null ? opts.fromLeft : Math.random() < 0.5;
      var y = opts.y != null ? opts.y : 50 + Math.random() * (VH - 120);
      f = { uid: st.uid++, d: def, x: fromLeft ? -def.sz : VW + def.sz, y: y, vx: fromLeft ? sp : -sp, vy: (Math.random() - 0.5) * 12,
        ph: Math.random() * 6, fi: Math.random() * def.fr, dead: 0, disp: def.m[0] };
    }
    st.fish.push(f); return f;
  }
  // 目標魚量：平常 65、魚潮時 ×1.2～1.5；再乘上效能係數（電腦跑不動時自動少放一點魚）
  function cap() { return Math.round(FISH_TARGET * (st.wave ? st.wave.k : 1) * (st.perf || 1)); }
  function pickNormal() { var r = Math.random() * NW; for (var i = 0; i < NORMAL.length; i++) { r -= NORMAL[i].w; if (r < 0) return NORMAL[i]; } return NORMAL[0]; }
  function spawnTick(dt) {
    st.nextSpawn -= dt;
    if (st.nextSpawn <= 0) {
      var live = st.fish.filter(function (f) { return !f.dead; }).length;
      st.nextSpawn = live < cap() * 0.85 ? 50 + Math.random() * 70 : 110 + Math.random() * 160;   // 差比較多時補快一點
      if (live < cap()) {
        var d = pickNormal(), n = d.m[0] <= 5 ? 2 + Math.floor(Math.random() * 5) : d.m[0] <= 12 ? 1 + Math.floor(Math.random() * 2) : 1;
        if (Math.random() < 0.3) { var top = Math.random() < 0.5, x0 = 80 + Math.random() * (VW - 160); for (var i = 0; i < n; i++) { var fv = spawnFish(d, { side: 'v', fromTop: top, x: x0 + (i % 2) * 24 }); if (fv) fv.y += (top ? -1 : 1) * i * 36; } }
        else { var left = Math.random() < 0.5, y = 50 + Math.random() * (VH - 120); for (var j = 0; j < n; j++) { var fh = spawnFish(d, { fromLeft: left, y: y + (j % 2) * 22 }); if (fh) fh.x += (left ? -1 : 1) * j * 40; } }
      }
    }
    st.nextWave -= dt;
    if (st.wave) { st.wave.left -= dt; if (st.wave.left <= 0) st.wave = null; }
    if (st.nextWave <= 0) {   // 魚潮
      // 魚潮：接下來 20 秒魚量提高到平常的 1.2～1.5 倍，開頭先灌一大排小魚
      st.nextWave = 90000; st.wave = { k: 1.2 + Math.random() * 0.3, left: 20000 }; st.banner = { t: '🌊 魚潮來了！', life: 2200 };
      var lf = Math.random() < 0.5, extra = Math.round(FISH_TARGET * (st.wave.k - 1));
      for (var k = 0; k < extra; k++) { var w = spawnFish(NORMAL[k % 4], { fromLeft: lf, y: 50 + (k % 8) * 42 }); if (w) w.x += (lf ? -1 : 1) * Math.floor(k / 8) * 70; }
    }
    ['ghost', 'drake', 'fafu'].forEach(function (id) {
      st.boss[id] -= dt;
      if (st.boss[id] <= 0) {
        var def = FBY[id]; st.boss[id] = def.boss * 1000 * (0.85 + Math.random() * 0.3);
        if (st.fish.some(function (f) { return f.d.boss && !f.dead; })) { st.boss[id] = 30000; return; }   // 一次只來一隻 Boss
        spawnFish(def, { y: 60 + Math.random() * (VH - 320) });
        st.banner = { t: (id === 'fafu' ? '⚠️ 警報！' : '👑 ') + def.n + ' 出現了！', life: 2800, big: id === 'fafu' };
      }
    });
  }
  function moveFish(dt) {
    var s = dt / 1000;
    st.fish.forEach(function (f) {
      if (f.dead) { f.dead += dt; return; }
      f.ph += s * 1.6;
      if (f.vert) { f.x += (f.vx + Math.sin(f.ph) * 14) * s; f.y += f.vy * s; if (f.x < 30) f.vx = Math.abs(f.vx); if (f.x > VW - 30) f.vx = -Math.abs(f.vx); }
      else { f.x += f.vx * s; f.y += (f.vy + Math.sin(f.ph) * 14) * s; if (f.y < 30) f.vy = Math.abs(f.vy); if (f.y > VH - 70) f.vy = -Math.abs(f.vy); }
      f.fi = (f.fi + s * 10) % f.d.fr;
      if (f.d.boss && Math.random() < 0.08) f.disp = f.d.m[0] + Math.floor(Math.random() * (f.d.m[1] - f.d.m[0] + 1) / 5) * 5;
    });
    st.fish = st.fish.filter(function (f) {
      if (f.dead) return f.dead < 900;
      if (f.vert) return f.y > -f.d.sz * 1.2 && f.y < VH + f.d.sz * 1.2;
      return f.x > -f.d.sz * 1.5 && f.x < VW + f.d.sz * 1.5;
    });
  }
  function hitR(f) { return f.d.sz * 0.36; }

  // ════════════════ 子彈與判定 ════════════════
  var CANNON = { x: VW / 2, y: VH - 18 };
  function fire(now) {
    var g = G(); if (!g || st.wheel) return false;
    if (st.bullets.filter(function (x) { return x.own; }).length >= MAX_BULLETS) return false;
    var b = bet(), cur = st.cur;
    if (balance(cur) < b) { st.msg = CURS[cur] + '不夠（每發 ' + fmt(b) + '）。'; st.auto = false; st.firing = false; hud(); return false; }
    if (!g.debit(cur, b)) return false;
    jpSet(cur, jpGet(cur) + b * JP_RATE * 100);
    g.statAdd('fish', cur, b, 0, 0, true);
    st.spent += b;
    var ang = st.aim;
    if (st.lockMode && st.lock && !lockFish()) retarget();
    var tf = st.lock ? lockFish() : null;
    if (tf) { ang = Math.atan2(tf.y - CANNON.y, tf.x - CANNON.x); st.aim = Math.min(-0.08, Math.max(-Math.PI + 0.08, ang)); }
    else if (st.lock) st.lock = null;
    st.bullets.push({ x: CANNON.x + Math.cos(ang) * 30, y: CANNON.y + Math.sin(ang) * 30, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, b: b, cur: cur, lv: st.lv, born: now, lock: st.lock, own: true });
    st.lastShot = now; markSave(false);
    return true;
  }
  function lockFish() { var u = st.lock; if (!u) return null; for (var i = 0; i < st.fish.length; i++) { var f = st.fish[i]; if (f.uid === u) return alive(f) ? f : null; } return null; }
  // 鎖定的魚沒了：先找同一種最近的，沒有就找畫面上倍數最高的
  function retarget() {
    var old = st.lockKind, cand = st.fish.filter(function (f) { return alive(f) && f.y < VH - 60; });
    var same = cand.filter(function (f) { return f.d.id === old; });
    var pool = same.length ? same : cand; if (!pool.length) { st.lock = null; return; }
    pool.sort(function (a, b) { return same.length ? Math.hypot(a.x - CANNON.x, a.y - CANNON.y) - Math.hypot(b.x - CANNON.x, b.y - CANNON.y) : (b.d.avg - a.d.avg); });
    st.lock = pool[0].uid; st.lockKind = pool[0].d.id;
  }
  function lockBest() {
    var cand = st.fish.filter(function (f) { return alive(f) && f.y < VH - 60; }); if (!cand.length) return;
    cand.sort(function (a, b) { return b.d.avg - a.d.avg; });
    st.lockMode = true; st.lock = cand[0].uid; st.lockKind = cand[0].d.id; st.auto = true; st.msg = '鎖定畫面上最大的「' + cand[0].d.n + '」。'; hud();
  }
  // 特殊魚的「效果期望值」（以注額為單位）：捕獲率＝R0 ÷（倍數＋期望值），長期返還率不變
  function specialE(f) {
    var sp = f.d.sp2; if (!sp) return 0;
    if (sp === 'bolt') return targetsBolt(f).length * R0;
    if (sp === 'bomb') return targetsBomb(f).length * R0;
    if (sp === 'laser') return LASER_N * R0;
    if (sp === 'drill') return DRILL_N * R0;
    return 0;
  }
  function alive(f, ex) { return !f.dead && f !== ex && f.x > 0 && f.x < VW && f.y > 0 && f.y < VH; }
  function targetsBolt(f) {   // 全場數量最多的一種一般魚
    var cnt = {}; st.fish.forEach(function (x) { if (alive(x, f) && !x.d.boss && !x.d.sp2) cnt[x.d.id] = (cnt[x.d.id] || 0) + 1; });
    var best = null; for (var k in cnt) if (!best || cnt[k] > cnt[best]) best = k;
    return best ? st.fish.filter(function (x) { return alive(x, f) && x.d.id === best; }).slice(0, BOLT_MAX) : [];
  }
  function targetsBomb(f) { return st.fish.filter(function (x) { return alive(x, f) && !x.d.sp2 && Math.hypot(x.x - f.x, x.y - f.y) < BOMB_R; }); }
  // 一次判定：回傳贏了幾 /100
  function trial(f, b, cur, src) {
    var d = f.d, p, mult;
    if (d.boss) { p = R0 / d.avg; mult = d.m[0] + Math.floor(Math.random() * (d.m[1] - d.m[0] + 1)); }
    else if (d.sp2) { p = R0 / (d.m[0] + specialE(f)); mult = d.m[0]; }
    else { p = R0 / d.m[0]; mult = d.m[0]; }
    var rr = G().rng();
    if (rr >= p) { st.fx.push({ k: 'net', x: f.x, y: f.y, r: 26, life: 300, c: BULLET_LOOK[src.lv || 0][0] }); return 0; }
    capture(f, b, cur, mult, src);
    return mult;
  }
  function capture(f, b, cur, mult, src) {
    f.dead = 1;
    var got = pay(cur, mult * b * 100, mult);
    st.won += got;
    st.fx.push({ k: 'coin', x: f.x, y: f.y - 20, t: '+' + fmtS(got), life: 1300, big: mult >= 30 });
    if (mult >= 50) st.banner = { t: f.d.n + ' ×' + mult + '！' + amtTxt(cur, got), life: 2200, big: mult >= 100 };
    markSave(mult >= 30);
    var sp = f.d.sp2;
    if (sp === 'bolt') { var ts = targetsBolt(f); st.fx.push({ k: 'bolt', x: f.x, y: f.y, ts: ts.map(function (t) { return [t.x, t.y]; }), life: 600 }); ts.forEach(function (t) { trial(t, b, cur, src); }); st.banner = { t: '⚡ 雷電！' + ts.length + ' 隻一起判定', life: 1800 }; }
    else if (sp === 'bomb') { var tb = targetsBomb(f); st.fx.push({ k: 'boom', x: f.x, y: f.y, r: BOMB_R, life: 600 }); tb.forEach(function (t) { trial(t, b, cur, src); }); st.banner = { t: '💣 爆炸！' + tb.length + ' 隻一起判定', life: 1800 }; }
    else if (sp === 'laser' || sp === 'drill') { weapons().push({ k: sp, b: b, cur: cur, lv: src.lv || 0 }); markSave(true); st.banner = { t: (sp === 'laser' ? '🔫 拿到雷射砲！' : '🌀 拿到鑽頭砲！') + '（下方按鈕發射）', life: 2200 }; hud(); }
    if (f.d.jp) startWheel(cur);
  }
  function amtTxt(cur, n) { return CURS[cur] + ' ' + fmt(n) + (cur === 'gold' ? '' : ' 顆'); }
  // JP 轉盤
  function startWheel(cur) {
    var tot = WHEEL.reduce(function (a, x) { return a + x[2]; }, 0), r = G().rng() * tot, k = 0;
    for (; k < WHEEL.length; k++) { r -= WHEEL[k][2]; if (r < 0) break; }
    if (k >= WHEEL.length) k = 0;
    var pool = jpGet(cur), take = Math.floor(pool * WHEEL[k][1] / 100) * 100;
    var rest = pool - take; if (k === 3) rest = JP_SEED[cur] * 100 + rest;
    jpSet(cur, rest);
    var got = pay(cur, take, 0); st.won += got; markSave(true);
    st.wheel = { k: k, got: got, cur: cur, t: 0, spin: 2600 };
    if (k === 3) { try { var p = P(); if (typeof W.logWorld === 'function') W.logWorld('<span class="wc-answer">🐟【遊戲廳】<b style="color:#fde047">' + esc((p && p.name) || '冒險者') + '</b> 在' + NAME + '打倒水龍法利昂，轉出<b style="color:#ef4444">超級 JP</b>：' + esc(amtTxt(cur, got)) + '！</span>'); } catch (e) {} }
  }
  // 特殊砲
  function fireWeapon(i, angIn) {
    var ws = weapons(), w = ws[i]; if (!w || st.weapon || st.wheel) return;
    ws.splice(i, 1); markSave(true); st.aimW = null;
    var ang = angIn != null ? angIn : st.aim;
    if (w.k === 'laser') {
      var hit = st.fish.filter(function (f) { return alive(f); }).map(function (f) {
        var dx = f.x - CANNON.x, dy = f.y - CANNON.y, along = dx * Math.cos(ang) + dy * Math.sin(ang), perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
        return { f: f, along: along, perp: perp };
      }).filter(function (o) { return o.along > 0 && o.perp < hitR(o.f) + 14; }).sort(function (a, b) { return a.along - b.along; });
      var n = 0;
      hit.forEach(function (o) { if (n < LASER_N) { n++; trial(o.f, w.b, w.cur, w); } });
      var rest = st.fish.filter(function (f) { return alive(f); });
      while (n < LASER_N && rest.length) { var t = rest[Math.floor(Math.random() * rest.length)]; n++; trial(t, w.b, w.cur, w); rest = rest.filter(function (x) { return alive(x); }); }   // 線上不夠 8 隻：餘下的判定給畫面上隨機的魚
      st.fx.push({ k: 'laser', ang: ang, life: 700 });
      st.banner = { t: '🔫 雷射砲！', life: 1200 };
    } else {
      st.weapon = { k: 'drill', x: CANNON.x, y: CANNON.y - 30, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, left: DRILL_N, b: w.b, cur: w.cur, lv: w.lv, t: 0, hitSet: {} };
      st.banner = { t: '🌀 鑽頭砲！', life: 1200 };
    }
    hud();
  }
  function stepBullets(dt, now) {
    var s = dt / 1000;
    st.bullets = st.bullets.filter(function (bl) {
      if (bl.lock) { var tf = st.fish.filter(function (f) { return f.uid === bl.lock && !f.dead; })[0]; if (tf) { var a = Math.atan2(tf.y - bl.y, tf.x - bl.x); bl.vx = Math.cos(a) * BULLET_SPEED; bl.vy = Math.sin(a) * BULLET_SPEED; } else bl.lock = null; }
      bl.x += bl.vx * s; bl.y += bl.vy * s;
      if (bl.x < 4) { bl.x = 4; bl.vx = Math.abs(bl.vx); } if (bl.x > VW - 4) { bl.x = VW - 4; bl.vx = -Math.abs(bl.vx); }
      if (bl.y < 4) { bl.y = 4; bl.vy = Math.abs(bl.vy); } if (bl.y > VH - 4) { bl.y = VH - 4; bl.vy = -Math.abs(bl.vy); }
      for (var i = 0; i < st.fish.length; i++) {
        var f = st.fish[i]; if (f.dead) continue;
        if (bl.lock && f.uid !== bl.lock) continue;
        if (Math.hypot(f.x - bl.x, f.y - bl.y) < hitR(f)) {
          if (bl.own) trial(f, bl.b, bl.cur, bl);
          else if (f.d.m[0] <= 5 && Math.random() < 0.25 / f.d.m[0]) { f.dead = 1; st.fx.push({ k: 'coin', x: f.x, y: f.y - 20, t: 'NPC', life: 900, npc: true }); }
          else st.fx.push({ k: 'net', x: f.x, y: f.y, r: 20, life: 250, c: '#94a3b8' });
          return false;
        }
      }
      if (now - bl.born > BULLET_LIFE) {   // 一直沒打到：退錢（自己的子彈）
        if (bl.own) { G().credit(bl.cur, bl.b); G().statAdd('fish', bl.cur, -bl.b, 0, 0, false); st.spent -= bl.b; markSave(false); }
        return false;
      }
      return true;
    });
    var wp = st.weapon;
    if (wp) {
      wp.t += dt; wp.x += wp.vx * s; wp.y += wp.vy * s;
      if (wp.x < 20 || wp.x > VW - 20) wp.vx = -wp.vx; if (wp.y < 20 || wp.y > VH - 20) wp.vy = -wp.vy;
      for (var j = 0; j < st.fish.length && wp.left > 0; j++) {
        var ff = st.fish[j]; if (ff.dead || wp.hitSet[ff.uid]) continue;
        if (Math.hypot(ff.x - wp.x, ff.y - wp.y) < hitR(ff) + 16) { wp.hitSet[ff.uid] = 1; wp.left--; trial(ff, wp.b, wp.cur, wp); }
      }
      if (wp.left <= 0 || wp.t > 8000) {
        var rest2 = st.fish.filter(function (f) { return alive(f); });
        while (wp.left > 0 && rest2.length) { var t2 = rest2[Math.floor(Math.random() * rest2.length)]; wp.left--; trial(t2, wp.b, wp.cur, wp); rest2 = rest2.filter(function (x) { return alive(x); }); }
        if (wp.left > 0) { G().credit(wp.cur, Math.round(wp.b * R0 * wp.left)); }   // 畫面上沒魚了：剩下的判定照期望值給
        st.fx.push({ k: 'boom', x: wp.x, y: wp.y, r: 90, life: 500 }); st.weapon = null; hud();
      }
    }
    // NPC 漁夫：純熱鬧
    st.npc.forEach(function (n) {
      n.cd -= dt; if (n.cd > 0) return; n.cd = 700 + Math.random() * 1100;
      if (st.bullets.length - st.bullets.filter(function (x) { return x.own; }).length >= MAX_NPC_BULLETS) return;
      var small = st.fish.filter(function (f) { return alive(f) && f.d.m[0] <= 5; }); if (!small.length) return;
      var cy = n.top ? 18 : VH - 18, t = small[Math.floor(Math.random() * small.length)], a = Math.atan2(t.y - cy, t.x - n.x); n.ang = a;
      st.bullets.push({ x: n.x + Math.cos(a) * 24, y: cy + Math.sin(a) * 24, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, born: now, own: false, lv: 0 });
    });
  }

  // ════════════════ 畫 ════════════════
  var cv = null, ctx = null, raf = 0, lastT = 0, acc = 0;
  function drawFish(f, now) {
    var d = f.d, b = bbox(d); if (!b) return;
    var kind = f.dead ? 'death' : 'idle', i = f.dead ? Math.min(d.df - 1, Math.floor(f.dead / 900 * d.df)) : Math.floor(f.fi);
    var o = getImg(frameUrl(d, kind, i)); if (!o.ok) { o = getImg(frameUrl(d, 'idle', 0)); if (!o.ok) return; }
    var sc = d.sz / Math.max(b.h, b.w * 0.6), w = o.im.naturalWidth * sc, h = o.im.naturalHeight * sc;
    var ox = (b.x + b.w / 2) * sc, oy = (b.y + b.h / 2) * sc;
    var img = tinted(d, o, d.id + kind + i);
    ctx.save(); ctx.translate(f.x, f.y);
    if (d.glow && !f.dead && (!st.lowFx || d.boss)) { ctx.shadowColor = d.glow; ctx.shadowBlur = d.boss ? 26 : 14; }
    if (f.vx > 0) ctx.scale(-1, 1);
    if (f.dead) ctx.globalAlpha = Math.max(0, 1 - f.dead / 900);
    ctx.drawImage(img, -ox, -oy, w, h);
    ctx.restore();
    if (!f.dead && (d.m[0] >= 20 || d.sp2 || d.boss)) {
      ctx.font = 'bold ' + (d.boss ? 15 : 12) + 'px Arial,"Microsoft JhengHei",sans-serif'; ctx.textAlign = 'center';
      var lab = (d.badge ? d.badge + ' ' : '') + (d.boss ? d.n + ' ×' + f.disp : '×' + d.m[0]);
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(lab, f.x, f.y - d.sz * 0.55); ctx.fillStyle = d.boss ? '#fde047' : '#fff'; ctx.fillText(lab, f.x, f.y - d.sz * 0.55);
    }
    if (st.lock === f.uid && !f.dead) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, hitR(f) + 8, 0, 6.29); ctx.stroke(); ctx.beginPath(); ctx.moveTo(f.x - hitR(f) - 14, f.y); ctx.lineTo(f.x + hitR(f) + 14, f.y); ctx.moveTo(f.x, f.y - hitR(f) - 14); ctx.lineTo(f.x, f.y + hitR(f) + 14); ctx.stroke(); }
  }
  function draw(now) {
    var g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#0e4f7a'); g.addColorStop(0.6, '#08304f'); g.addColorStop(1, '#041a2c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#bae6fd';   // 光束
    for (var k = 0; k < 4; k++) { var x0 = 120 + k * 190 + Math.sin(now / 3000 + k) * 30; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 60, 0); ctx.lineTo(x0 + 140, VH); ctx.lineTo(x0 + 40, VH); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c2a36b'; ctx.beginPath(); ctx.moveTo(0, VH); for (var sx = 0; sx <= VW; sx += 40) ctx.lineTo(sx, VH - 22 - Math.sin(sx / 70) * 8); ctx.lineTo(VW, VH); ctx.fill();
    st.fish.forEach(function (f) { if (f.d.boss) drawFish(f, now); });
    st.fish.forEach(function (f) { if (!f.d.boss) drawFish(f, now); });
    st.bullets.forEach(function (bl) { var L = BULLET_LOOK[bl.lv || 0]; ctx.fillStyle = bl.own ? L[0] : '#94a3b8'; ctx.shadowColor = L[0]; ctx.shadowBlur = bl.own ? 8 : 0; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.own ? L[1] : 3, 0, 6.29); ctx.fill(); });
    ctx.shadowBlur = 0;
    if (st.weapon) { var wp = st.weapon; ctx.save(); ctx.translate(wp.x, wp.y); ctx.rotate(now / 80); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16; ctx.beginPath(); for (var q = 0; q < 6; q++) { var a = q * Math.PI / 3; ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a + 0.5) * 7, Math.sin(a + 0.5) * 7); } ctx.fill(); ctx.restore(); ctx.shadowBlur = 0; }
    // 特效
    st.fx = st.fx.filter(function (e) {
      e.age = (e.age || 0) + 33; var t = e.age / e.life; if (t >= 1) return false;
      if (e.k === 'net') { ctx.strokeStyle = e.c; ctx.globalAlpha = 1 - t; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.6 + t * 0.6), 0, 6.29); ctx.stroke(); for (var a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * e.r * (0.6 + t * 0.6), e.y + Math.sin(a) * e.r * (0.6 + t * 0.6)); ctx.stroke(); } }
      else if (e.k === 'coin') { ctx.globalAlpha = 1 - t * t; ctx.font = 'bold ' + (e.big ? 22 : 15) + 'px Arial,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(e.t, e.x, e.y - t * 40); ctx.fillStyle = e.npc ? '#cbd5e1' : '#fde047'; ctx.fillText(e.t, e.x, e.y - t * 40); }
      else if (e.k === 'boom') { ctx.globalAlpha = (1 - t) * 0.7; var rg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.4 + t)); rg.addColorStop(0, '#fff7ae'); rg.addColorStop(0.5, '#f97316'); rg.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + t), 0, 6.29); ctx.fill(); }
      else if (e.k === 'bolt') { ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 3; ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 12; e.ts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(e.x, e.y); var mx = (e.x + p[0]) / 2 + (Math.random() - 0.5) * 40, my = (e.y + p[1]) / 2 + (Math.random() - 0.5) * 40; ctx.lineTo(mx, my); ctx.lineTo(p[0], p[1]); ctx.stroke(); }); ctx.shadowBlur = 0; }
      else if (e.k === 'laser') { ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 10 * (1 - t) + 2; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(CANNON.x, CANNON.y); ctx.lineTo(CANNON.x + Math.cos(e.ang) * 1200, CANNON.y + Math.sin(e.ang) * 1200); ctx.stroke(); ctx.shadowBlur = 0; }
      ctx.globalAlpha = 1; return true;
    });
    // 砲台
    var drawCannon = function (x, ang, lv, me, top) { ctx.save(); ctx.translate(x, top ? 18 : VH - 18); ctx.fillStyle = me ? '#1e293b' : '#334155'; ctx.beginPath(); if (top) ctx.arc(0, 0, 18, 0, Math.PI); else ctx.arc(0, 0, me ? 26 : 18, Math.PI, 0); ctx.fill(); ctx.rotate(ang + Math.PI / 2); ctx.fillStyle = me ? BULLET_LOOK[lv][0] : '#64748b'; ctx.fillRect(-(me ? 7 + lv : 5), -(me ? 44 : 30), (me ? 14 + lv * 2 : 10), me ? 40 : 26); ctx.restore(); };
    st.npc.forEach(function (n) { drawCannon(n.x, n.ang, 0, false, n.top); });
    var lf = st.lock ? lockFish() : null;
    if (lf) { ctx.save(); ctx.strokeStyle = 'rgba(239,68,68,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(CANNON.x, CANNON.y); ctx.lineTo(lf.x, lf.y); ctx.stroke(); ctx.restore(); }
    if (st.aimW != null) { var aw = weapons()[st.aimW]; ctx.save(); ctx.strokeStyle = aw && aw.k === 'laser' ? 'rgba(216,180,254,.9)' : 'rgba(103,232,249,.9)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(CANNON.x, CANNON.y); ctx.lineTo(CANNON.x + Math.cos(st.aim) * 900, CANNON.y + Math.sin(st.aim) * 900); ctx.stroke(); ctx.restore();
      ctx.textAlign = 'center'; ctx.font = 'bold 18px Arial,"Microsoft JhengHei",sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; var tt = (aw && aw.k === 'laser' ? '🔫 雷射砲' : '🌀 鑽頭砲') + '：點畫面選方向發射'; ctx.strokeText(tt, VW / 2, VH - 70); ctx.fillStyle = '#fde68a'; ctx.fillText(tt, VW / 2, VH - 70); }
    drawCannon(CANNON.x, st.aim, st.lv, true);
    ctx.font = 'bold 12px Arial,"Microsoft JhengHei",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#cbd5e1';
    st.npc.forEach(function (n) { ctx.fillText(n.n, n.x, n.top ? 46 : VH - 2); });
    ctx.fillStyle = '#fde68a'; ctx.fillText(fmtS(bet()) + (st.cur === 'gold' ? '' : ' 顆') + '／發', CANNON.x, VH - 2);
    // JP 與橫幅
    ctx.textAlign = 'left'; ctx.font = 'bold 14px Arial,"Microsoft JhengHei",sans-serif'; ctx.fillStyle = '#fca5a5'; ctx.fillText('JP ' + fmt(Math.floor(jpGet(st.cur) / 100)), 10, 20);
    ctx.textAlign = 'right'; ctx.fillStyle = '#86efac'; ctx.fillText('本場 ' + (st.won - st.spent >= 0 ? '+' : '') + fmtS(st.won - st.spent), VW - 10, 20);
    if (st.banner && !st.wheel) {
      st.banner.life -= 33; if (st.banner.life <= 0) st.banner = null;
      else { ctx.textAlign = 'center'; ctx.font = 'bold ' + (st.banner.big ? 30 : 22) + 'px Arial,"Microsoft JhengHei",sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(st.banner.t, VW / 2, 70); ctx.fillStyle = st.banner.big ? '#f87171' : '#fde047'; ctx.fillText(st.banner.t, VW / 2, 70); }
    }
    if (st.wheel) drawWheel();
  }
  function drawWheel() {
    var w = st.wheel; w.t += 33;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, VW, VH);
    var cx = VW / 2, cy = VH / 2 - 10, R = 130, n = WHEEL.length, cols = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];
    var target = -Math.PI / 2 - (w.k + 0.5) * (Math.PI * 2 / n), prog = Math.min(1, w.t / w.spin), ease = 1 - Math.pow(1 - prog, 3), rot = target - Math.PI * 2 * 5 * (1 - ease);
    for (var i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, rot + i * Math.PI * 2 / n, rot + (i + 1) * Math.PI * 2 / n); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot + (i + 0.5) * Math.PI * 2 / n); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial,"Microsoft JhengHei",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(WHEEL[i][0], R * 0.62, 6); ctx.restore(); }
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(cx - 12, cy - R - 16); ctx.lineTo(cx + 12, cy - R - 16); ctx.lineTo(cx, cy - R + 8); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial,"Microsoft JhengHei",sans-serif'; ctx.fillStyle = '#fde047'; ctx.fillText('🐉 法利昂 JP 轉盤', cx, 40);
    if (prog >= 1) { ctx.font = 'bold 26px Arial,"Microsoft JhengHei",sans-serif'; ctx.fillStyle = w.k === 3 ? '#f87171' : '#fff'; ctx.fillText(WHEEL[w.k][0] + '！' + amtTxt(w.cur, w.got), cx, cy + R + 44); }
    if (w.t > w.spin + 2600) { st.wheel = null; hud(); }
  }
  function loop(now) {
    raf = 0;
    if (!visible()) { lastT = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!lastT) lastT = now;
    var dt = now - lastT; acc += dt; lastT = now;
    if (acc < 33) return;
    var step = Math.min(acc, 100); acc = 0;
    var t0 = performance.now();
    if (!st.wheel) {
      spawnTick(step); moveFish(step); stepBullets(step, now);
      if ((st.firing || st.auto) && now - st.lastShot >= FIRE_MS) fire(now);
    }
    draw(now);
    perfGuard(performance.now() - t0, now);
    if (now - (st.hudT || 0) > 500) { st.hudT = now; hudBal(); }
  }
  // 效能保護：每格的運算＋繪圖平均超過 20ms（掉到 30 幀以下）就把魚量係數往下調，順了再慢慢加回來；也會先關掉發光
  function perfGuard(ms, now) {
    st.pAvg = st.pAvg == null ? ms : st.pAvg * 0.9 + ms * 0.1;
    if (now - (st.pT || 0) < 2000) return; st.pT = now;
    if (!st.perf) st.perf = 1;
    if (st.pAvg > 20) { st.lowFx = true; st.perf = Math.max(0.55, st.perf - 0.1); }
    else if (st.pAvg < 11) { st.perf = Math.min(1, st.perf + 0.05); if (st.perf >= 1) st.lowFx = false; }
  }
  function visible() {
    var w = el('afk-fish-win'); if (!w || w.style.display === 'none' || document.hidden) return false;
    var b = document.body; if (b.classList.contains('m-mobile') && !b.classList.contains('m-unified') && (!b.classList.contains('mview-center') || b.classList.contains('mlog-open'))) return false;
    return true;
  }
  function kick() { if (!raf && visible()) { lastT = 0; raf = requestAnimationFrame(loop); } }

  // ════════════════ 視窗 ════════════════
  function css() {
    if (el('afk-fish-css')) return;
    var s = document.createElement('style'); s.id = 'afk-fish-css';
    s.textContent = '.fh-win{position:fixed;z-index:76;left:50%;transform:translateX(-50%);top:calc(var(--orig-bar-h,0px) + 6px);width:min(98vw,820px);max-height:calc(100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px) - 12px);overflow-y:auto;'
      + 'background:#06243b;border:2px solid #38bdf8;border-radius:12px;box-shadow:0 18px 40px #000c;color:#e2e8f0;font-family:Arial,"Microsoft JhengHei",sans-serif;font-size:13px;box-sizing:border-box}'
      + '.fh-win *{box-sizing:border-box}.fh-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#0c3553;border-bottom:1px solid #38bdf8;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}'
      + '.fh-title{flex:1;font-weight:800;color:#bae6fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fh-hb{min-width:34px;height:30px;border:1px solid #7dd3fc;border-radius:6px;background:#0f172a;color:#e0f2fe;font-weight:700;cursor:pointer}'
      + '.fh-cv{display:block;width:100%;aspect-ratio:16/10;touch-action:none;cursor:crosshair;background:#041a2c}'
      + '.fh-bar{display:flex;flex-wrap:wrap;gap:5px;padding:6px}.fh-bar button{min-height:36px;border-radius:7px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-weight:800;font-size:12.5px;cursor:pointer;padding:0 9px}'
      + '.fh-bar button.on{border-color:#facc15;background:#3a2f0c;color:#fde68a}.fh-bar button[disabled]{opacity:.4}.fh-bar .lv{display:flex;align-items:center;gap:4px;font-weight:900;color:#fde68a}'
      + '.fh-bar .sp{flex:1}.fh-msg{padding:0 8px 6px;color:#fde68a;font-size:12px;min-height:16px}.fh-w{background:#3b0764!important;border-color:#c084fc!important}';
    document.head.appendChild(s);
  }
  function win() {
    css();
    var w = el('afk-fish-win');
    if (!w) {
      w = document.createElement('div'); w.id = 'afk-fish-win'; w.className = 'fh-win'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', NAME);
      w.innerHTML = '<div class="fh-head"><button type="button" class="fh-hb" data-fh="hall" aria-label="回遊戲廳">◀</button><div class="fh-title">🐟 ' + NAME + '<span style="color:#94a3b8;font-weight:600;font-size:12px">　點畫面射擊・按住連發</span></div><button type="button" class="fh-hb" data-fh="close" aria-label="關閉">✕</button></div>'
        + '<canvas class="fh-cv" id="afk-fish-cv" width="800" height="500"></canvas><div class="fh-bar" id="afk-fish-bar"></div><div class="fh-msg" id="afk-fish-msg"></div>';
      document.body.appendChild(w);
      cv = el('afk-fish-cv'); ctx = cv.getContext('2d');
      var pt = function (e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; };
      cv.addEventListener('pointerdown', function (e) {
        var p = pt(e); st.aim = Math.min(-0.08, Math.max(-Math.PI + 0.08, Math.atan2(p.y - CANNON.y, p.x - CANNON.x)));
        if (st.aimW != null) { fireWeapon(st.aimW, st.aim); return; }   // 特殊砲：點哪裡就往哪裡打
        if (st.lockMode) {   // 鎖定：點到哪隻（或最靠近點的那隻，80 範圍內）就鎖哪隻，並自動開火
          var best = null, bd = 1e9; st.fish.forEach(function (f) { if (!alive(f)) return; var d = Math.hypot(f.x - p.x, f.y - p.y) - hitR(f); if (d < 80 && d < bd) { bd = d; best = f; } });
          if (best) { st.lock = best.uid; st.lockKind = best.d.id; st.auto = true; st.msg = '鎖定「' + best.d.n + '」，子彈會追著打；牠沒了會自動換下一隻。'; hud(); }
          return;
        }
        st.firing = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        if (performance.now() - st.lastShot >= FIRE_MS) fire(performance.now());
      });
      cv.addEventListener('pointermove', function (e) { var p = pt(e); if (st.firing || st.aimW != null || e.pointerType === 'mouse') st.aim = Math.min(-0.08, Math.max(-Math.PI + 0.08, Math.atan2(p.y - CANNON.y, p.x - CANNON.x))); });
      var up = function () { st.firing = false; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
      w.addEventListener('click', onClick);
      drag(w);
      if (typeof MutationObserver === 'function') new MutationObserver(function () { kick(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('visibilitychange', function () { if (document.hidden) flushSave(); else kick(); });
    }
    return w;
  }
  function drag(w) {
    var d = null;
    w.addEventListener('pointerdown', function (e) { if (!e.target.closest('.fh-head') || e.target.closest('button')) return; var r = w.getBoundingClientRect(); d = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top }; try { w.setPointerCapture(e.pointerId); } catch (er) {} });
    w.addEventListener('pointermove', function (e) { if (!d || d.id !== e.pointerId) return; var x = Math.max(0, Math.min(innerWidth - w.offsetWidth, e.clientX - d.dx)), y = Math.max(0, Math.min(innerHeight - 60, e.clientY - d.dy)); w.style.left = x + 'px'; w.style.top = y + 'px'; w.style.transform = 'none'; });
    var end = function (e) { if (!d || d.id !== e.pointerId) return; d = null; LS('afk_fish_pos', JSON.stringify({ l: parseInt(w.style.left, 10), t: parseInt(w.style.top, 10) })); };
    w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
    w.addEventListener('dblclick', function (e) { if (!e.target.closest('.fh-head') || e.target.closest('button')) return; try { localStorage.removeItem('afk_fish_pos'); } catch (er) {} w.style.left = w.style.top = w.style.transform = ''; });
  }
  function hudBal() { var b = el('afk-fish-bal'); if (b) b.textContent = ICON[st.cur] + ' ' + fmtS(balance(st.cur)); }
  function hud() {
    var bar = el('afk-fish-bar'); if (!bar) return;
    var g = G(), ws = weapons(), h = '';
    h += ['gold', 'dia', 'blood'].map(function (c) { var ok = g && g.curReady(c); return '<button type="button" data-fh="cur:' + c + '"' + (st.cur === c ? ' class="on"' : '') + (ok ? '' : ' disabled') + '>' + ICON[c] + ' ' + CURS[c] + '</button>'; }).join('');
    h += '<span class="lv"><button type="button" data-fh="lv-" aria-label="降低砲台等級">－</button>Lv' + (st.lv + 1) + '・' + fmtS(bet()) + '<button type="button" data-fh="lv+" aria-label="提高砲台等級">＋</button></span>';
    h += '<button type="button" data-fh="auto"' + (st.auto ? ' class="on"' : '') + '>' + (st.auto ? '⏸ 停止自動' : '▶ 自動射擊') + '</button>';
    h += '<button type="button" data-fh="lock"' + (st.lockMode ? ' class="on"' : '') + '>🎯 鎖定' + (st.lockMode ? '（點魚換目標・再按關閉）' : '') + '</button>';
    h += '<button type="button" data-fh="lockbest">👑 鎖最大隻</button>';
    ws.forEach(function (w, i) { h += '<button type="button" class="fh-w' + (st.aimW === i ? ' on' : '') + '" data-fh="wp:' + i + '"' + (st.weapon || st.wheel ? ' disabled' : '') + '>' + (st.aimW === i ? '✖ 取消瞄準' : (w.k === 'laser' ? '🔫 雷射砲' : '🌀 鑽頭砲')) + '（' + fmtS(w.b) + (w.cur === 'gold' ? '' : '顆') + '）</button>'; });
    h += '<span class="sp"></span><span id="afk-fish-bal" style="align-self:center;font-weight:800;color:#fde68a"></span>';
    bar.innerHTML = h; hudBal();
    var m = el('afk-fish-msg'); if (m) m.textContent = st.msg || '每發 ' + amtTxt(st.cur, bet()) + '；倍數越高越難抓。抓到水龍法利昂會轉 JP 轉盤。';
  }
  function onClick(e) {
    var t = e.target.closest('[data-fh]'); if (!t || t.disabled) return;
    var a = t.getAttribute('data-fh'), p = a.split(':');
    if (a === 'close') return close();
    if (a === 'hall') { close(); try { G().open('home'); } catch (er) {} return; }
    if (p[0] === 'cur') { st.cur = p[1]; st.lv = 0; LS('afk_fish_cur', st.cur); st.msg = ''; return hud(); }
    if (a === 'lv-' || a === 'lv+') { st.lv = Math.max(0, Math.min(LEVELS[st.cur].length - 1, st.lv + (a === 'lv+' ? 1 : -1))); st.msg = ''; return hud(); }
    if (a === 'auto') { st.auto = !st.auto; if (!st.auto) st.lock = null; st.msg = ''; return hud(); }
    if (a === 'lock') { st.lockMode = !st.lockMode; if (!st.lockMode) { st.lock = null; st.auto = false; st.msg = ''; } else st.msg = '點一隻魚鎖定（點空白處附近也會抓最近的那隻）。'; return hud(); }
    if (a === 'lockbest') return lockBest();
    if (p[0] === 'wp') { var wi = Number(p[1]); st.aimW = st.aimW === wi ? null : wi; st.msg = st.aimW != null ? '移動滑鼠／手指瞄準，點畫面發射。' : ''; return hud(); }
  }
  function open() {
    var p = P(); if (!p || p.classicMode || !on() || !G()) return false;
    try { if (document.body.classList.contains('m-mobile') && W.__afkm && typeof W.__afkm.setView === 'function') W.__afkm.setView('center'); } catch (e) {}
    if (!st) { st = newState(); var c = LS('afk_fish_cur'); if (c && CURS[c] && G().curReady(c)) st.cur = c; }
    st.msg = '';
    var w = win(); w.style.display = '';
    var pos = null; try { pos = JSON.parse(LS('afk_fish_pos') || 'null'); } catch (e) {}
    if (pos && typeof pos.l === 'number') { w.style.left = Math.max(0, Math.min(innerWidth - 100, pos.l)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 100, pos.t)) + 'px'; w.style.transform = 'none'; }
    preload();
    if (!st.fish.length) for (var k = 0; k < 50; k++) { var f = spawnFish(pickNormal()); if (f) { f.x = 60 + Math.random() * (VW - 120); f.y = 60 + Math.random() * (VH - 140); } }   // 一打開畫面就有魚
    hud(); kick();
    return true;
  }
  function close() { var w = el('afk-fish-win'); if (w) w.style.display = 'none'; if (st) { st.firing = false; st.auto = false; } flushSave(); }

  W.__afkFish = { on: on, open: open, close: close, NAME: NAME, FISH: FISH, LEVELS: LEVELS, R0: R0, JP_RATE: JP_RATE, WHEEL: WHEEL, JP_SEED: JP_SEED, LASER_N: LASER_N, DRILL_N: DRILL_N,
    _st: function () { return st; }, _trial: function (id, b, cur) { var f = { d: FBY[id], x: 400, y: 200, uid: -1 }; return trial(f, b, cur || 'gold', { lv: 0 }); } };
  if (!on()) return;
  if (typeof W.loadGame === 'function' && !W.loadGame._afkFish) {
    var oLoad = W.loadGame;
    W.loadGame = function () { try { close(); st = null; } catch (e) {} return oLoad.apply(this, arguments); };
    W.loadGame._afkFish = true;
  }
  W.addEventListener('pagehide', function () { try { flushSave(); } catch (e) {} });
  console.log('[AFK-fishing] 已啟用：' + NAME);
})();
