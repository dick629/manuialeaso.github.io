/* ============================================================================
 * afk-zodiac.js — 黃道十二宮（副本）與聖衣 EX（設計稿 rift-zodiac-plan 第二、三節；decisions-1107：碎衣在 HP 30%、每天 3 宮選一宮打、EX 數值照稿）
 *
 *   入口：席琳神殿「星鑄師 艾琳娜」。二轉後開放；每天 00:00（台灣時間）用日期挑出 3 宮，選其中一宮打（一天一次）。
 *   副本：3 層 × 5 波，第 5 波是那一宮的小頭目，第 3 層第 5 波是守宮者；時限 15 分鐘；倒下、時間到或離開＝失敗。沒有侵蝕、沒有面板減半。
 *   掉落：每次通關 黃金修復之砂 ×1；每一宮第一次通關 該宮的宮之印 ×1；30% 聖衣光輝碎片 ×1；守宮者 0.5% 黃道星卡（之後設計用途）。
 *   聖衣 EX（艾琳娜鑄造）：碎裂的聖衣＝黃金修復之砂 ×3；其他聖衣＝砂 ×3＋該宮的宮之印 ×1。
 *     穿著 EX 聖衣：在原本「解除封印」之上再加 六項能力 +25、五屬性抗性 +50、爆擊傷害 +20%；永遠不會失去光輝；次元裂縫裡不會碎，抵銷裂縫的傷害懲罰 15%。
 *     ★4：EX 才能升，光輝碎片 ×4＋砂 ×1。
 *   聖衣碎裂（終焉第三階層 HP 30% 碎衣）跟第三階層一起開；這裡先認 actor.cardAscension.cloth[id].broken。
 *   守宮者的 HP、傷害之後用存檔模擬對準曲線 80（ZT 表）。經典模式沒有；外掛開關 zodiac。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit, A = W.AFK_CARD_ASCENSION;
  if (T && T.register) T.register({ id: 'zodiac', name: '黃道十二宮、聖衣 EX', group: '遊戲內容', desc: '席琳神殿 星鑄師 艾琳娜：每天 3 宮選一宮打（二轉後）；鑄造聖衣 EX' });
  if (T && !T.enabled('zodiac')) return;
  if (!L || !K || typeof DB === 'undefined' || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var MAP = 'afk_zodiac', TOWN = 'town_sherine', NPC_ID = 'npc_afk_elena', NPC_N = '星鑄師 艾琳娜';
  var ZT = { timeMs: 15 * 60 * 1000, layers: 3, waves: 5, mobLv: 0, mobHp: 1.0, bossHp: 6, guardHp: 18, dmg: 1.0, REF: 65 };
  var SAND = 'afk_zd_sand', SHARD = 'afk_cloth_shard', STAR_CARD = 'afk_zd_card';
  var IMG = 'assets/icons/items/';

  var H = [
    { k: 'aries', n: '白羊宮', g: '衝角的牧者 伊芙蕾', mech: 'charge', d: '每 20 秒蓄力衝撞：3 秒內打掉牠最大 HP 3% 就會被打斷，否則全隊暈眩 2 秒、受到最大 HP 15% 的傷害' },
    { k: 'taurus', n: '金牛宮', g: '磐石的公牛 葛倫', mech: 'shell', d: '岩殼吸收 80% 的傷害；每 30 秒岩殼碎掉 8 秒' },
    { k: 'gemini', n: '雙子宮', g: '鏡雙子 莉亞與莉歐', mech: 'twin', d: '兩隻同時在場；另一隻還活著時，受到的傷害 −50%' },
    { k: 'cancer', n: '巨蟹宮', g: '潮甲的守衛 卡斯', mech: 'carapace', d: '受到的傷害 −50%；每 15 秒轉身時有 5 秒破綻（不減傷）' },
    { k: 'leo', n: '獅子宮', g: '金鬃獅王 雷恩', mech: 'rage', d: '每損失 10% HP 怒氣 +1，造成的傷害 +6%' },
    { k: 'virgo', n: '處女宮', g: '靜謐的祈禱者 瑟芙', mech: 'silence', d: '每 25 秒讓全隊沉默 4 秒' },
    { k: 'libra', n: '天秤宮', g: '衡量者 艾斯特', mech: 'balance', d: '每 30 秒把全隊的 HP 比例平均' },
    { k: 'scorpio', n: '天蠍宮', g: '毒尾的刺客 薩迦', mech: 'poison', d: '每 10 秒全隊疊 1 層毒（每層每秒最大 HP 0.5%，最多 10 層）' },
    { k: 'sagittarius', n: '射手宮', g: '星矢的獵手 奧瑞', mech: 'far', d: '遠距離與魔法傷害打牠 −30%' },
    { k: 'capricorn', n: '摩羯宮', g: '斷罪的山羊 卡普', mech: 'judge', d: 'HP 70%、40% 時各一次「斷罪」：HP 最高的隊員直接剩 30%' },
    { k: 'aquarius', n: '水瓶宮', g: '寒泉的侍者 阿克亞', mech: 'frost', d: '每 10 秒結冰一塊，冰越多全隊每秒受到的傷害越高（每塊最大 HP 0.3%）' },
    { k: 'pisces', n: '雙魚宮', g: '雙鰭的歌姬 菲絲', mech: 'fins', d: '兩條魚形分身繞場；分身還活著時本體受到的傷害 −90%' }
  ];
  var BYK = {}; H.forEach(function (h, i) { h.i = i; h.seal = 'afk_zd_seal_' + h.k; BYK[h.k] = h; });

  // ── 道具 ──
  L.addItem(SAND, { n: '黃金修復之砂', type: 'misc', c: 'text-yellow-300', img: IMG + '原石碎片.png', p: 0, noSell: true, d: '黃道十二宮的星光凝成的砂。3 個可以在星鑄師 艾琳娜那裡把聖衣鑄造成聖衣 EX。' });
  L.addItem(STAR_CARD, { n: '黃道星卡', type: 'misc', c: 'text-yellow-200', img: IMG + '原石碎片.png', p: 0, noSell: true, d: '守宮者身上留下的星卡。用途之後開放。' });
  H.forEach(function (h) { L.addItem(h.seal, { n: h.n + '之印', type: 'misc', c: 'text-yellow-200', img: IMG + '原石碎片.png', p: 0, noSell: true, d: h.n + '第一次通關得到的印。加上黃金修復之砂 ×3，可以把一件聖衣鑄造成聖衣 EX。' }); });

  // ── 記錄 ──
  var store = function (p) { p = p || P(); if (!p) return {}; var s = p.afkZodiac && typeof p.afkZodiac === 'object' ? p.afkZodiac : (p.afkZodiac = {}); s.first = s.first || {}; return s; };
  var today = function () { var d = dayKey(), a = [], seed = d * 2654435761 % 4294967296; var rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; var pool = H.slice(); while (a.length < 3 && pool.length) a.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return a; };
  var canEnter = function (p) {
    if (!p) return '請先進入遊戲。';
    if (p.classicMode) return '經典模式沒有黃道十二宮。';
    if (Math.floor(p.rebirth || 0) < 2) return '二轉後才能進入。';
    if (store(p).day === dayKey()) return '今天已經挑戰過了，明天再來。';
    var s = S(); if (s.riftRun || s._afkFinal || s.antharas || s.prideClimb) return '你正身在其他副本之中。';
    return '';
  };

  // ── 地圖、出怪 ──
  DB.maps[MAP] = (DB.maps.pride_81_90 || []).slice(0, 1);
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/地監深層.jpg'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = '黃道十二宮'; } catch (e) {}
  var POOL = function () { return (DB.maps.pride_91_100 || []).filter(function (id) { var m = DB.mobs[id]; return m && !m.boss; }); };
  var scale = function (base, Lv, hpMult) {
    var k = Lv / ZT.REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round((base.hp || 1000) * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k * ZT.dmg))];
    m.db = Math.round((base.db || 0) * Math.pow(k, 1.3)); m.hit = Math.round((base.hit || 0) * k);
    m.exp = Math.round((base.exp || 0) * k * k); m.goldMin = Math.round((base.goldMin || 0) * k); m.goldMax = Math.round((base.goldMax || 0) * k);
    return m;
  };
  var guardBase = {}; H.forEach(function (h) {
    var id = 'afk_zd_g_' + h.k;
    L.addMob(id, { n: h.g, lv: ZT.REF, s: 'L', beh: '主動', boss: true, race: '星之守衛', e: 'none', hp: 30000, ac: -70, mr: 100, exp: 8000, goldMin: 5000, goldMax: 9000, atkSpd: 1.6, dmg: [3, 45], db: 45, hit: 85,
      mag: { skn: h.n + '的星擊', cd: 70, chance: 0.4, dmg: [4, 60], db: 80, ele: 'none', alwaysHit: true } }, '闇黑的騎士范德');
    guardBase[h.k] = id;
  });
  var allyN = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };
  var run = null, lastMap = null, leaving = 0;
  var enter = function (k) {
    var p = P(), h = BYK[k], why = canEnter(p); if (!h) return; if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return; }
    if (today().indexOf(h) < 0) { sys('<span class="text-amber-300">今天沒有開這一宮。</span>'); return; }
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    store(p).day = dayKey();
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null]; mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { k: k, layer: 1, wave: 1, alive: 0, pending: true, until: Date.now() + ZT.timeMs, lv: Math.max(60, Math.min(130, Number(p.lv) || 100)) };
    lastMap = MAP;
    sys('<span class="font-bold" style="color:#fde047">✦ 你踏進了' + esc(h.n) + '。星之守衛在三層星階的盡頭等著你。</span>');
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden'); document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden'); document.getElementById('town-view').classList.remove('flex'); mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
  };
  var leave = function (msg) {
    run = null; leaving = Date.now(); if (msg) sys(msg);
    setTimeout(function () { try { if (mapState.current === MAP && run === null) { setMapSelectors(TOWN); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
  };
  var isBossWave = function () { return run.wave === ZT.waves; };
  var spawnWave = function () {
    var h = BYK[run.k], lv = run.lv, hpk = 1 + 0.15 * allyN();
    run.pending = false; run.alive = 0;
    if (isBossWave()) {
      var final = run.layer === ZT.layers, base = DB.mobs[guardBase[h.k]];
      var m = L.boss.place(2, scale(base, lv + (final ? 5 : 0), (final ? ZT.guardHp : ZT.bossHp) * hpk), { mobId: guardBase[h.k], _zd: true, _zdBoss: true, _zdFinal: final, noAutoTeleport: true, noCharm: true });
      if (!final) m.n = h.n + '的星衛';
      run.alive++; run.mech = final ? { t0: tk(), at: tk() + 200, layers: 0, ice: 0, judged: {}, rage: 0 } : null;
      if (final && (h.mech === 'twin' || h.mech === 'fins')) {
        var cnt = h.mech === 'twin' ? 1 : 2;
        for (var j = 0; j < cnt; j++) { var c = L.boss.place(j === 0 ? 1 : 3, scale(base, lv, (h.mech === 'twin' ? ZT.guardHp * 0.6 : ZT.bossHp) * hpk), { mobId: guardBase[h.k], _zd: true, _zdAdd: true, noAutoTeleport: true, noCharm: true }); c.n = h.mech === 'twin' ? '鏡雙子 莉歐' : '魚形分身'; c.boss = false; run.alive++; }
      }
      clog('<span class="font-bold" style="color:#fde047">【' + esc(h.n) + ' 第 ' + run.layer + ' 層】</span>' + esc(m.n) + ' 現身了。' + (final ? '<span class="text-slate-300">（' + esc(h.d) + '）</span>' : ''), 'enemy');
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
    } else {
      var pool = POOL(); for (var i = 0; i < 4 && pool.length; i++) { var id = pool[Math.floor(Math.random() * pool.length)]; L.boss.place(i, scale(DB.mobs[id], lv, ZT.mobHp * 40 * hpk), { mobId: id, _zd: true, noAutoTeleport: true }); run.alive++; }
    }
    try { if (!S().ff) renderMobs(); } catch (e) {}
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (mapState.current === MAP) { if (!mobs()[idx] || mobs()[idx]._dead) mobs()[idx] = null; if (run && run.pending && idx === 0) spawnWave(); return; }
      return oSpawn.apply(this, arguments);
    };
  }
  var victory = function () {
    var p = P(), h = BYK[run.k], s = store(p), got = [];
    gainItem(SAND, 1, true, true); got.push('黃金修復之砂');
    if (!s.first[h.k]) { s.first[h.k] = Date.now(); gainItem(h.seal, 1, true, true); got.push(h.n + '之印'); }
    if (Math.random() < 0.3 && DB.items[SHARD]) { gainItem(SHARD, 1, true, true); got.push(DB.items[SHARD].n); }
    leave('<span class="text-yellow-300 font-bold">🏆 ' + esc(h.n) + ' 的星光安靜了下來。</span><span class="text-amber-200">得到：' + got.map(esc).join('、') + '</span>');
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], was = !!(m && m._dead), r = oKill.apply(this, arguments);
      try {
        if (m && !was && m._dead && m._zd && run && mapState.current === MAP) {
          if (m._zdFinal && Math.random() < 0.005) { gainItem(STAR_CARD, 1, true, true); sys('<span class="text-yellow-200 font-bold">' + esc(m.n) + ' 留下了黃道星卡！</span>'); }
          run.alive = mobs().filter(function (x) { return x && x._zd && !x._dead && x.curHp > 0; }).length;
          if (run.alive <= 0) {
            if (run.wave < ZT.waves) run.wave++; else if (run.layer < ZT.layers) { run.layer++; run.wave = 1; sys('<span style="color:#fde047">第 ' + run.layer + '／' + ZT.layers + ' 層星階亮了起來。</span>'); } else { victory(); return r; }
            run.pending = true;
          }
        }
      } catch (e) { console.warn('[AFK-zodiac] kill', e); }
      return r;
    };
  }

  // ── 守宮者機制 ──
  var party = function () { return L.boss.party().filter(function (x) { return x && !x.dead && !x._downed; }); };
  var mhpOf = function (x) { return x === P() ? (x.mhp || 1) : (x.mhp || 1); };
  var hpOf = function (x) { return x === P() ? x.hp : x.curHp; };
  var setHp = function (x, v) { if (x === P()) x.hp = v; else x.curHp = v; };
  var status = function (x, k, t) { try { var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (B && B.setStatus) B.setStatus(x, k, t, null); else if (x.statuses) x.statuses[k] = t; } catch (e) {} };
  var finalBoss = function () { return mobs().filter(function (x) { return x && x._zdFinal && !x._dead && x.curHp > 0; })[0]; };
  function mech() {
    var b = finalBoss(); if (!b || !run || !run.mech || L.boss.halted(b)) return;
    var h = BYK[run.k], M = run.mech, t = tk();
    switch (h.mech) {
      case 'charge':
        if (!M.charging && t >= M.at) { M.charging = t + 30; M.hpMark = b.curHp; clog('<span class="font-bold" style="color:#fb923c">【蓄力】</span>' + esc(b.n) + ' 壓低了衝角……（3 秒內打掉牠最大 HP 3% 就能打斷）'); }
        else if (M.charging && t >= M.charging) { M.charging = 0; M.at = t + 200; if (M.hpMark - b.curHp >= b.hp * 0.03) clog('<span class="text-emerald-300">衝撞被打斷了。</span>'); else { party().forEach(function (x) { status(x, 'stun', 20); L.boss.hurt(x, mhpOf(x) * 0.15); }); clog('<span class="font-bold" style="color:#f87171">【衝撞】</span>全隊被撞飛——暈眩 2 秒、受到最大 HP 15% 的傷害。'); } }
        break;
      case 'shell': if (t >= M.at) { M.at = t + 300; M.open = t + 80; clog('<span class="font-bold" style="color:#a78bfa">【岩殼碎裂】</span>8 秒內傷害不被吸收！'); } break;
      case 'carapace': if (t >= M.at) { M.at = t + 150; M.open = t + 50; clog('<span class="text-slate-300">' + esc(b.n) + ' 轉身了——5 秒的破綻。</span>'); } break;
      case 'rage': var lost = Math.floor((1 - b.curHp / b.hp) * 10); if (lost > M.rage) { M.rage = lost; clog('<span class="font-bold" style="color:#f87171">【怒氣 ' + lost + '】</span>' + esc(b.n) + ' 造成的傷害 +' + (lost * 6) + '%'); } break;
      case 'silence': if (t >= M.at) { M.at = t + 250; party().forEach(function (x) { status(x, 'silence', 40); }); clog('<span class="font-bold" style="color:#93c5fd">【靜默】</span>全隊沉默 4 秒。'); } break;
      case 'balance': if (t >= M.at) { M.at = t + 300; var ps = party(), avg = ps.reduce(function (s, x) { return s + hpOf(x) / mhpOf(x); }, 0) / Math.max(1, ps.length); ps.forEach(function (x) { setHp(x, Math.max(1, Math.floor(mhpOf(x) * avg))); }); clog('<span class="font-bold" style="color:#fde047">【衡量】</span>全隊的 HP 比例被拉平成 ' + Math.round(avg * 100) + '%。'); } break;
      case 'poison': if (t >= M.at) { M.at = t + 100; M.layers = Math.min(10, M.layers + 1); } if (M.layers && t % 10 === 0) party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.005 * M.layers); }); break;
      case 'judge': [0.7, 0.4].forEach(function (th) { if (!M.judged[th] && b.curHp <= b.hp * th) { M.judged[th] = 1; var ps2 = party().sort(function (a, c) { return hpOf(c) - hpOf(a); }), v = ps2[0]; if (v) { setHp(v, Math.max(1, Math.floor(mhpOf(v) * 0.3))); clog('<span class="font-bold" style="color:#f87171">【斷罪】</span>' + esc(v === P() ? '你' : (v._allyName || v.name || '傭兵')) + ' 的 HP 剩下 30%！'); } } }); break;
      case 'frost': if (t >= M.at) { M.at = t + 100; M.ice = Math.min(20, M.ice + 1); } if (M.ice && t % 10 === 0) party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.003 * M.ice); }); break;
    }
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { if (!mob || !mob._zdFinal || !run || !run.mech) return 1; return BYK[run.k].mech === 'rage' ? 1 + 0.06 * (run.mech.rage || 0) : 1; });
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) {
      try {
        if (run && target && target._zdFinal && run.mech && amount > 0) {
          var h = BYK[run.k], M = run.mech, t = tk(), kind = opt && opt.kind;
          if (h.mech === 'shell' && !((M.open || 0) > t)) amount *= 0.2;
          if (h.mech === 'carapace' && !((M.open || 0) > t)) amount *= 0.5;
          if (h.mech === 'far' && (kind === 'magic' || kind === 'ranged')) amount *= 0.7;
          var adds = mobs().filter(function (x) { return x && x._zdAdd && !x._dead && x.curHp > 0; }).length;
          if (adds && h.mech === 'twin') amount *= 0.5;
          if (adds && h.mech === 'fins') amount *= 0.1;
        }
      } catch (e) {}
      return o.call(this, actor, target, Math.max(1, Math.floor(amount)), opt);
    };
    return true;
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      try {
        var cur = mapState.current; if (cur !== lastMap) { if (lastMap === MAP && run) run = null; lastMap = cur; }
        if (!run && cur === MAP && Date.now() - leaving > 3000) leave('<span class="text-amber-300">十二宮的星光已經熄滅，你回到了席琳神殿。</span>');
        var p = P();
        if (run && cur === MAP && p && p.dead) leave('<span class="text-red-400">你在十二宮倒下了，這次挑戰失敗。</span>');
        else if (run && cur === MAP && tk() !== t0) {
          if (Date.now() > run.until) leave('<span class="text-red-400">時間到，十二宮的星光熄滅了——挑戰失敗。</span>');
          else { if (!run.pending && !mobs().some(function (x) { return x && x._zd && !x._dead && x.curHp > 0; })) run.pending = true; mech(); }
        }
      } catch (e) { console.warn('[AFK-zodiac] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 聖衣 EX ──
  var rows = function () { return A && A.catalog && A.catalog.samsara ? A.catalog.samsara.filter(function (r) { return !r.unique; }) : []; };
  var data = function (p) { return p && p.cardAscension; };
  var cl = function (p, id) { var s = data(p); if (!s) return null; s.cloth = s.cloth || {}; return s.cloth[id] || (s.cloth[id] = { uses: 0, dim: false }); };
  var isEx = function (p, id) { var s = data(p); return !!(s && s.cloth && s.cloth[id] && s.cloth[id].ex); };
  var houseOf = function (r, i) { return H[i % 12]; };
  var cnt = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
  function forge(id) {
    var p = P(), rs = rows(), i = rs.findIndex(function (r) { return r.id === id; }), r = rs[i]; if (!p || !r) return;
    if (!A.owned(id, p)) { sys('<span class="text-amber-300">你還沒有這件聖衣。</span>'); return; }
    var c = cl(p, id); if (c.ex) { sys('<span class="text-amber-300">已經是聖衣 EX。</span>'); return; }
    var h = houseOf(r, i), needSeal = !c.broken;
    if (cnt(SAND) < 3 || (needSeal && cnt(h.seal) < 1)) { sys('<span class="text-amber-300">材料不夠：黃金修復之砂 ×3' + (needSeal ? '＋' + h.n + '之印 ×1' : '') + '。</span>'); return; }
    take(SAND, 3); if (needSeal) take(h.seal, 1);
    c.ex = true; c.broken = false; c.dim = false; c.uses = 0;
    sys('<span class="font-bold" style="color:#fde047">✦ 艾琳娜把星光鍛進了' + esc(r.n) + '——它成了聖衣 EX。</span>');
    try { calcStats(); saveGame(); } catch (e) {}
  }
  function starUp(id) {
    var p = P(), s = data(p), r = rows().filter(function (x) { return x.id === id; })[0]; if (!p || !s || !r) return;
    if (!isEx(p, id)) { sys('<span class="text-amber-300">只有聖衣 EX 能升 ★4。</span>'); return; }
    s.clothStars = s.clothStars || {}; if ((s.clothStars[id] || 0) < 3) { sys('<span class="text-amber-300">要先升到 ★3。</span>'); return; }
    if ((s.clothStars[id] || 0) >= 4) { sys('<span class="text-amber-300">已經是 ★4。</span>'); return; }
    if (cnt(SHARD) < 4 || cnt(SAND) < 1) { sys('<span class="text-amber-300">材料不夠：聖衣光輝碎片 ×4＋黃金修復之砂 ×1。</span>'); return; }
    take(SHARD, 4); take(SAND, 1); s.clothStars[id] = 4;
    sys('<span class="font-bold" style="color:#fde047">✦ ' + esc(r.n) + ' 升到 ★4。</span>'); try { saveGame(); } catch (e) {}
  }
  if (A && typeof A.sealed === 'function') { var oSealed = A.sealed; A.sealed = function (id, actor) { try { if (isEx(actor || P(), id)) return false; } catch (e) {} return oSealed.apply(this, arguments); }; }
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), s = data(p), id = s && s.clothOn;
        var dr = p && p.afkDimRift; if (dr) dr.clothEx = !!(id && isEx(p, id));
        if (p && p.d && id && isEx(p, id)) {
          var c = cl(p, id); c.dim = false; c.uses = 0;
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { if (typeof p.d[k] === 'number') p.d[k] += 25; });
          ['resNone', 'resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + 50; });
          ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + 20; });
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 艾琳娜 ──
  var paint = function (div) {
    var box = div.querySelector('#afk-zd-elena'); if (!box) return;
    var p = P(); if (!p) return;
    var why = canEnter(p), s = store(p), h = '<div class="ax-h">黃道十二宮</div><div class="ax-note">' + '三層星階、每層五波，第五波是那一宮的星衛，最上層是守宮者。時限 15 分鐘；倒下、時間到或離開就失敗。每天從十二宮挑出三宮，選一宮打。</div>';
    h += '<div class="ax-note">每次通關：黃金修復之砂 ×1；每一宮第一次通關：該宮之印 ×1；30% 聖衣光輝碎片；守宮者偶爾留下黃道星卡。</div>';
    today().forEach(function (x) { h += K.rowHtml({ key: x.k, name: x.n + '・' + x.g + (s.first[x.k] ? '（已拿過宮之印）' : ''), color: '#fde047', desc: x.d, why: why || '', btns: [['zd:' + x.k, '進入', !why]] }, 'data-zd'); });
    h += '<div class="ax-h" style="margin-top:10px">聖衣 EX</div><div class="ax-note">碎裂的聖衣：黃金修復之砂 ×3；其他聖衣：砂 ×3＋該宮的宮之印 ×1。EX 在解除封印之上再加六項能力 +25、五屬性抗性 +50、爆擊傷害 +20%，永遠不會失去光輝，次元裂縫裡也不會碎。★4：EX 才能升（光輝碎片 ×4＋砂 ×1）。持有：砂 ' + cnt(SAND) + '、光輝碎片 ' + cnt(SHARD) + '</div>';
    rows().forEach(function (r, i) {
      if (!A.owned(r.id, p)) return; var c = cl(p, r.id), hs = houseOf(r, i), st = ((data(p).clothStars || {})[r.id]) || 0;
      h += K.rowHtml({ key: r.id, name: r.n + (c.ex ? '　EX' : c.broken ? '　（碎裂）' : '') + '　★' + st, color: c.ex ? '#fde047' : '#e2e8f0', desc: c.ex ? '已是聖衣 EX。' : ('鑄造：砂 ×3' + (c.broken ? '' : '＋' + hs.n + '之印 ×1（持有 ' + cnt(hs.seal) + '）')), why: '', btns: c.ex ? [['star:' + r.id, '升 ★4', st === 3]] : [['ex:' + r.id, '鑄造 EX', true]] }, 'data-zd');
    });
    K.repaint(box, h);
  };
  var render = function (div) {
    if (!div) return; K.css();
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">「雅典娜的星座之力散落在十二宮。把砂帶回來，我替你把聖衣鍛回它該有的樣子。」</div></div>';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-zd-elena'; div.appendChild(box); paint(div);
    if (!div.__afkZdBound) { div.__afkZdBound = true; div.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-star],button[data-zd]'); if (!b || b.disabled || !div.querySelector('#afk-zd-elena')) return; var k = b.getAttribute('data-star') || b.getAttribute('data-zd') || ''; if (/^zd:/.test(k)) enter(k.slice(3)); else if (/^ex:/.test(k)) forge(k.slice(3)); else if (/^star:/.test(k)) starUp(k.slice(5)); paint(div); }); }
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: '星鑄師', type: 'quest', classicHide: true, d: '替聖衣鍛進星光的鑄匠。黃道十二宮的入口，也是聖衣 EX 的鑄造處。' });
  K.hookNpc(NPC_ID, NPC_N, '星鑄師', render);

  W.__afkZodiac = { H: H, ZT: ZT, today: today, canEnter: canEnter, enter: enter, run: function () { return run; }, forge: forge, starUp: starUp, isEx: isEx, store: store, MAP: MAP, SAND: SAND };
  try { console.log('[AFK-zodiac] 已載入：黃道十二宮、聖衣 EX'); } catch (e) {}
})();
