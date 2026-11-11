/* afk-starcard.js — 黃道星卡（星卡格；星卡 → 裂界 → 歸一）
 *   玩家 2026-11-11 19:16 確認上線（設計稿 docs/mio-doll-rift-design.md 第四節）。
 *   取得：黃道十二宮的守宮者 0.5% 掉「該宮」的星卡（afk-zodiac）。舊的不分宮「黃道星卡」可以在艾琳娜那裡換成任一宮。
 *   星卡格：一次一張，不算裝備（不佔裝備欄、不算重量、不能強化）。在星鑄師 艾琳娜登錄（用掉 1 張）、選要放哪一張。
 *   升級：裂界＝同宮星卡 ×3＋黃金修復之砂 10＋次元密奧卡 500；歸一＝同宮星卡 ×5＋砂 30＋星蝕之核 3＋次元密奧卡 1,000。
 *   保底：星卡 曲線 95、裂界 105、歸一 110（Ping 11-12 提升）（HP、減傷、魔防、AC、迴避取較好的一邊）。
 *   效果：只算放在星卡格的那一張；在次元裂縫裡 ×1.5。經典模式沒有；外掛開關 starcard。
 */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'starcard', name: '黃道星卡', group: '遊戲內容', desc: '星卡格：放一張黃道星卡（星卡 → 裂界 → 歸一）；席琳神殿 星鑄師 艾琳娜登錄、升級' });
  if (T && !T.enabled('starcard')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var Z = W.__afkZodiac, X = W.__afkProc, L = W.__afkLore; if (!Z || !Z.H) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (L && L.sys) L.sys(h); else if (typeof logSystem === 'function') logSystem(h); } catch (e) {} };
  var cnt = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
  var rnd = function () { return Math.random(); };
  var OLD = 'afk_zd_card', SAND = 'afk_zd_sand', DIM = 'afk_mio_dim', CORE = 'afk_rd_eclipse';
  var idOf = function (k) { return 'afk_zd_card_' + k; };
  var STAGE = ['', '星卡', '裂界', '歸一'], COLOR = ['', '#fde68a', '#c084fc', '#fef3c7'];
  var UP = [null, null, { card: 3, sand: 10, dim: 500 }, { card: 5, sand: 30, core: 3, dim: 1000 }];
  var RIFT = 1.5;

  // ── 12 宮的效果：值是 [星卡, 裂界, 歸一] ──
  var FX = {
    aries: [{ pct: [300, 400, 500] }, function (v) { return '每 20 秒蓄力，下一次一般攻擊變成衝鋒一擊：傷害 ' + v.pct + '%'; }],
    taurus: [{ pct: [10, 15, 20] }, function (v) { return '岩殼吸收最大 HP ' + v.pct + '% 的傷害，每 30 秒重生'; }],
    gemini: [{ ch: [8, 12, 16] }, function (v) { return '一般攻擊 ' + v.ch + '% 機率打兩下'; }],
    cancer: [{ pct: [10, 15, 20] }, function (v) { return '受到頭目的傷害 −' + v.pct + '%'; }],
    leo: [{ per: [3, 4, 5] }, function (v) { return '每損失 10% HP，造成的傷害 +' + v.per + '%'; }],
    virgo: [{ dur: [15, 20, 25] }, function (v) { return '受到的異常狀態持續時間 −' + v.dur + '%，每 25 秒淨化身上的異常狀態一次'; }],
    libra: [{ cap: [20, 30, 40] }, function (v) { return '每 30 秒把全隊 HP 比例往平均補（只補不扣），每人最多補 ' + v.cap + '%'; }],
    scorpio: [{ per: [0.05, 0.08, 0.1] }, function (v) { return '攻擊讓目標疊毒（最多 10 層、5 秒沒打到就消失），每層每秒造成目標最大 HP ' + v.per + '% 的傷害'; }],
    sagittarius: [{ pct: [8, 12, 16] }, function (v) { return '遠距離傷害 +' + v.pct + '%'; }],
    capricorn: [{ pct: [15, 20, 25] }, function (v) { return '頭目 HP 降到 70%、40% 時，10 秒內對它的傷害 +' + v.pct + '%'; }],
    aquarius: [{ pct: [15, 20, 25] }, function (v) { return '次元裂縫的地圖侵蝕扣血 −' + v.pct + '%'; }],
    pisces: [{ pct: [8, 12, 16] }, function (v) { return '召喚物、傭兵造成的傷害 +' + v.pct + '%'; }]
  };
  var HN = {}; Z.H.forEach(function (h) { HN[h.k] = h; });
  var inRift = function () { try { return !!(W.__afkDimRift && W.__afkDimRift.on()); } catch (e) { return false; } };
  var valOf = function (k, st, rift) { var o = {}, V = FX[k][0], m = rift ? RIFT : 1; Object.keys(V).forEach(function (n) { o[n] = Math.round(V[n][Math.max(1, Math.min(3, st)) - 1] * m * 1000) / 1000; }); return o; };
  var descOf = function (k, st, rift) { return FX[k][1](valOf(k, st, rift)); };

  // ── 保底：曲線 95／105／110（105、110 用密奧保底的 80→95 成長率往外推）──
  var STD = (function () {
    var M = W.__afkMio, s95 = M && M.STD && M.STD['95'], s80 = M && M.STD && M.STD['80']; if (!s95 || !s80) return null;
    var o = { 1: s95, 2: {}, 3: {} };
    Object.keys(s95).forEach(function (c) {
      [2, 3].forEach(function (st) {
        o[st][c] = s95[c].map(function (v, i) { if (i >= 5) return v; var r = Math.abs(s80[c][i]) > 0 ? Math.abs(v / s80[c][i]) : 1; return Math.round(v * Math.pow(r, (st === 2 ? 10 : 15) / 15)); });
      });
    });
    return o;
  })();

  // ── 道具 ──
  var IMG = 'assets/icons/items/原石碎片.png';
  Z.H.forEach(function (h) {
    if (!DB.items[idOf(h.k)]) DB.items[idOf(h.k)] = { n: '黃道星卡・' + h.n, type: 'misc', c: 'text-yellow-200', img: IMG, p: 0, gachaWeight: 0, weight: 0, noSell: true,
      d: h.g + '留下的星卡。到席琳神殿 星鑄師 艾琳娜登錄，放進星卡格（不算裝備）。效果（星卡／裂界／歸一）：' + [1, 2, 3].map(function (st) { return descOf(h.k, st); }).join('／') + '；在次元裂縫裡效果 ×1.5。重複的可以拿來升裂界、歸一。' };
  });
  if (DB.items[OLD]) DB.items[OLD].d = '守宮者身上留下的星卡（還沒分宮的舊版）。到席琳神殿 星鑄師 艾琳娜，可以換成任一宮的黃道星卡。';

  // ── 記錄 ──
  var store = function (p) { p = p || P(); if (!p) return { st: {} }; var s = p.afkStarCard && typeof p.afkStarCard === 'object' ? p.afkStarCard : (p.afkStarCard = {}); if (!s.st || typeof s.st !== 'object') s.st = {}; return s; };
  var on = function (p) { return !!(p && !p.classicMode); };
  var curK = function (p) { p = p || P(); if (!on(p)) return null; var s = store(p); return s.eq && FX[s.eq] && (s.st[s.eq] || 0) >= 1 ? s.eq : null; };
  var A = function (k) { var p = P(), c = curK(p); if (!c || c !== k) return null; return valOf(k, store(p).st[k], inRift()); };
  var fire = function (k) { var h = HN[k]; if (!X || !h) return; try { X.pop('zdsc_' + k, IMG, '星卡・' + h.n, '#fde68a'); X.note('zdsc_' + k, '<span style="color:#fde68a">✦【星卡・' + esc(h.n) + '】</span>' + esc(descOf(k, store().st[k], inRift()))); } catch (e) {} };
  var recalc = function () { try { if (typeof recomputeStats === 'function') recomputeStats(); else if (typeof calcStats === 'function') calcStats(); } catch (e) {} };

  // ── 數值：保底、處女的持續時間 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), k = curK(p);
        if (p && p.d && k && STD) {
          var std = (STD[store(p).st[k]] || {})[p.cls], d = p.d;
          if (std) { d.dr = Math.max(Number(d.dr) || 0, std[1]); d.mr = Math.max(Number(d.mr) || 0, std[2]); d.ac = Math.min(Number(d.ac) || 0, std[3]); d.er = Math.max(Number(d.er) || 0, std[4]); d.extraDmg = Math.max(Number(d.extraDmg) || 0, std[5]); d.extraHit = Math.max(Number(d.extraHit) || 0, std[6]); }
        }
      } catch (e) { console.warn('[AFK-starcard]', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    if (!p || p !== P() || !STD) return; var k = curK(p); if (!k) return;
    var std = (STD[store(p).st[k]] || {})[p.cls]; if (std) p.mhp = Math.max(p.mhp || 0, std[0]);
  });
  // 水瓶：侵蝕扣血（afk-dimrift 讀 __afkErodeCut）
  (W.__afkErodeCuts = W.__afkErodeCuts || []).push(function (p) { var a = A('aquarius'); return a ? Math.min(0.9, a.pct / 100) : 0; });

  // ── 戰鬥 ──
  var DEB = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'];
  var g = { ariesAt: 0, charged: false, shell: 0, shellAt: 0, virgoAt: 0, libraAt: 0, lastDeb: {} };
  if (X) {
    X.on('taken', function (ent, dmg, mob) {
      var p = P(); if (!p || ent !== p || !(dmg > 0) || !curK(p)) return dmg;
      var cc = A('cancer'); if (cc && mob && mob.boss) dmg *= 1 - Math.min(90, cc.pct) / 100;
      if (A('taurus') && g.shell > 0) { var ab = Math.min(g.shell, dmg); g.shell -= ab; dmg -= ab; }
      return dmg;
    });
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(); if (!p || !(v > 0) || !target) return v;
      var k = curK(p); if (!k) return v;
      opt = opt || {};
      if (actor !== p) { var pi = A('pisces'); return pi ? v * (1 + pi.pct / 100) : v; }
      var m = 1, t = tk();
      var ar = A('aries'); if (ar && opt.packet && g.charged) { g.charged = false; m *= ar.pct / 100; fire('aries'); }
      var ge = A('gemini'); if (ge && opt.packet && rnd() < ge.ch / 100) { m *= 2; fire('gemini'); }
      var le = A('leo'); if (le && p.mhp > 0) m *= 1 + Math.floor(Math.max(0, 1 - p.hp / p.mhp) * 10) * le.per / 100;
      var sa = A('sagittarius'); if (sa && opt.kind === 'ranged') m *= 1 + sa.pct / 100;
      var cp = A('capricorn');
      if (cp && target.boss && target.hp > 0) {
        var r = (target.curHp - v * m) / target.hp, mk = target._zdCapMk || (target._zdCapMk = {});
        [0.7, 0.4].forEach(function (th) { if (!mk[th] && r <= th) { mk[th] = 1; target._zdCapUntil = t + 100; fire('capricorn'); } });
        if ((target._zdCapUntil || 0) > t) m *= 1 + cp.pct / 100;
      }
      if (A('scorpio') && !target._dead) { target._zdVenom = Math.min(10, (target._zdVenom || 0) + 1); target._zdVenomUntil = t + 50; }
      return v * m;
    });
    X.on('tick', function () {
      var p = P(), k = curK(p); if (!p || !k || p.dead) { g.lastDeb = {}; return; }
      var t = tk(), fight = X.inCombat();
      var ar = A('aries'); if (ar && !g.charged && t >= g.ariesAt) { g.charged = true; g.ariesAt = t + 200; }
      var ta = A('taurus'); if (ta) { if (t >= g.shellAt) { g.shellAt = t + 300; g.shell = Math.floor((p.mhp || 0) * ta.pct / 100); } } else g.shell = 0;
      var vi = A('virgo'), stt = p.statuses;
      if (vi && stt) {
        DEB.forEach(function (d) { var v = Number(stt[d]) || 0, pv = Number(g.lastDeb[d]) || 0; if (v > 0 && v > pv) { v = Math.max(pv, Math.max(1, Math.round(v * (1 - Math.min(90, vi.dur) / 100)))); stt[d] = v; } g.lastDeb[d] = v; });
        if (fight && t >= g.virgoAt) { var any = false; DEB.forEach(function (d) { if ((Number(stt[d]) || 0) > 0) { stt[d] = 0; any = true; } }); if (any) { g.virgoAt = t + 250; g.lastDeb = {}; fire('virgo'); } }
      } else g.lastDeb = {};
      var lb = A('libra');
      if (lb && fight && t >= g.libraAt) {
        g.libraAt = t + 300;
        var ents = [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && a.curHp > 0; }));
        if (ents.length > 1) {
          var rs = ents.map(function (e) { return (e === p ? p.hp : e.curHp) / (e.mhp || 1); }), avg = rs.reduce(function (s, x) { return s + x; }, 0) / rs.length, did = false;
          ents.forEach(function (e, i) { if (rs[i] >= avg) return; var nr = Math.min(avg, rs[i] + lb.cap / 100), hp = Math.floor((e.mhp || 0) * nr); if (e === p) { if (hp > p.hp) { p.hp = Math.min(p.mhp, hp); did = true; } } else if (hp > e.curHp) { e.curHp = Math.min(e.mhp, hp); did = true; } });
          if (did) fire('libra');
        }
      }
      var sc = A('scorpio');
      if (sc && t % 10 === 0) {
        ((typeof mapState !== 'undefined' && mapState.mobs) || []).slice().forEach(function (m) {
          if (!m || m._dead || !(m._zdVenom > 0)) return;
          if ((m._zdVenomUntil || 0) < t) { m._zdVenom = 0; return; }
          X.hitMob(m, (m.hp || 0) * sc.per / 100 * m._zdVenom);
        });
      }
    });
  }
  // 讓 afk-dimrift 的侵蝕扣血吃水瓶（掛在 erodeSecond 之前的乘數）——見 afk-dimrift pctCut

  // ── 登錄、升級、放入、換舊卡 ──
  var act = function (cmd) {
    var p = P(); if (!on(p)) return; var s = store(p), a = String(cmd || '').split(':'), op = a[0], k = a[1];
    if (k && !FX[k]) return; var h = HN[k], nm = h ? h.n : '';
    if (op === 'reg') {
      if ((s.st[k] || 0) >= 1) return; if (cnt(idOf(k)) < 1) { sys('<span class="text-amber-300">沒有黃道星卡・' + esc(nm) + '。</span>'); return; }
      take(idOf(k), 1); s.st[k] = 1; if (!s.eq) s.eq = k;
      sys('<span class="font-bold" style="color:#fde68a">✦ 黃道星卡・' + esc(nm) + ' 登錄好了。</span>');
    } else if (op === 'up') {
      var st = s.st[k] || 0, c = UP[st + 1]; if (!st || !c) return;
      if (cnt(idOf(k)) < c.card || cnt(SAND) < c.sand || cnt(DIM) < c.dim || (c.core && cnt(CORE) < c.core)) { sys('<span class="text-amber-300">材料不夠。</span>'); return; }
      take(idOf(k), c.card); take(SAND, c.sand); take(DIM, c.dim); if (c.core) take(CORE, c.core);
      s.st[k] = st + 1; sys('<span class="font-bold" style="color:' + COLOR[st + 1] + '">✦ 黃道星卡・' + esc(nm) + ' 升到「' + STAGE[st + 1] + '」！</span>');
    } else if (op === 'eq') {
      if ((s.st[k] || 0) < 1) return; s.eq = s.eq === k ? null : k;
      sys(s.eq ? '星卡格放入：黃道星卡・' + esc(nm) + '。' : '星卡格清空了。');
      g.charged = false; g.shell = 0; g.lastDeb = {};
    } else if (op === 'old') {
      if (cnt(OLD) < 1) return; take(OLD, 1); try { gainItem(idOf(k), 1, true, true); } catch (e) {}
      sys('舊的黃道星卡換成了 黃道星卡・' + esc(nm) + '。');
    } else return;
    recalc(); try { saveGame(); } catch (e) {}
  };

  var fm = function (n) { return Number(n || 0).toLocaleString(); };
  var nmI = function (id) { return (DB.items[id] || {}).n || id; };
  var npcHtml = function (p) {
    if (!on(p)) return '';
    var s = store(p), KT = W.__afkNpcKit, rift = inRift(), h = '<div class="ax-h" style="margin-top:10px">✦ 星卡格</div>';
    h += '<div class="ax-note">星卡格一次放一張黃道星卡，不算裝備（不佔裝備欄、不算重量、不能強化）。守宮者偶爾留下自己那一宮的星卡；登錄要用掉 1 張，重複的拿來升級。放著的那張有保底：星卡 曲線 95、裂界 105、歸一 110。在次元裂縫裡效果 ×1.5' + (rift ? '（你現在在裂縫裡）' : '') + '。</div>';
    var oldN = cnt(OLD);
    if (oldN > 0) h += '<div class="ax-note" style="color:#fde68a">你有 ' + oldN + ' 張還沒分宮的舊黃道星卡：在下面各宮按「換這宮」換一張。</div>';
    Z.H.forEach(function (x) {
      var st = s.st[x.k] || 0, have = cnt(idOf(x.k)), c = UP[st + 1], btns = [];
      if (!st) btns.push(['reg:' + x.k, '登錄', have >= 1]);
      else {
        btns.push(['eq:' + x.k, s.eq === x.k ? '取下' : '放入', true]);
        if (c) btns.push(['up:' + x.k, '升' + STAGE[st + 1], have >= c.card && cnt(SAND) >= c.sand && cnt(DIM) >= c.dim && (!c.core || cnt(CORE) >= c.core)]);
      }
      if (oldN > 0) btns.push(['old:' + x.k, '換這宮', true]);
      var req = c && st ? '<span class="ax-desc">升' + STAGE[st + 1] + '：本卡 ' + have + '/' + c.card + '、' + esc(nmI(SAND)) + ' ' + fm(cnt(SAND)) + '/' + c.sand + (c.core ? '、' + esc(nmI(CORE)) + ' ' + cnt(CORE) + '/' + c.core : '') + '、' + esc(nmI(DIM)) + ' ' + fm(cnt(DIM)) + '/' + fm(c.dim) + '</span>' : (st ? '' : '<span class="ax-desc">持有 ' + have + ' 張</span>');
      h += KT.rowHtml({ key: 'sc' + x.k, name: (s.eq === x.k ? '★ ' : '') + '黃道星卡・' + esc(x.n) + (st ? '（' + STAGE[st] + '）' : '（未登錄）'), color: st ? COLOR[st] : '#a8a29e',
        desc: esc(descOf(x.k, Math.max(1, st), rift)) + (st && st < 3 ? '<br><span style="color:#a8a29e">' + STAGE[st + 1] + '：' + esc(descOf(x.k, st + 1, rift)) + '</span>' : ''), req: req, btns: btns }, 'data-sc');
    });
    return h;
  };
  // 艾琳娜面板的按鈕
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest('button[data-sc]'); if (!b || b.disabled) return;
    var box = b.closest('#afk-zd-elena'); if (!box) return;
    ev.stopPropagation(); act(b.getAttribute('data-sc'));
    try { var div = box.parentNode; if (W.__afkZodiac && W.__afkZodiac.repaint) W.__afkZodiac.repaint(div); } catch (e) {}
  }, true);

  W.__afkStarCard = { FX: FX, UP: UP, STAGE: STAGE, STD: STD, RIFT: RIFT, idOf: idOf, valOf: valOf, descOf: descOf, store: store, cur: curK, act: act, npcHtml: npcHtml, OLD: OLD };
  try { console.log('[AFK-starcard] 已載入：黃道星卡'); } catch (e) {}
})();
