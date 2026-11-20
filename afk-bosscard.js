/* ============================================================================
 * afk-bosscard.js — 王者卡冊（地圖王、副本王專屬的卡片收集冊；設計稿 docs/boss-card-design.md，Ping 11-11 15:58 定案）
 *
 *   收錄：afk-mapboss.js 的 79 隻王，分「野外」「地監」兩頁；卡面用每隻王的怪物圖（11-17 起；找不到才用 assets/bosscard/<代號>.png 立繪）。
 *   階級：普／銀／金／白金／鑽石。登錄規則同卡片收集冊：普 1 分、銀 10 分、金 100 分，滿 100 分＝金階；
 *         白金、鑽石直接登錄成該階。還沒到這一階就自動登錄，已經到了就以實體卡進背包。
 *   掉落（每次打倒王；乘隊伍人數，最多 ×8；不吃席琳、夢域鏡的掉落倍率）：
 *         普 5%、銀 1%、金 0.1%；白金 0.02%（只有夢域鏡，次元裂縫不算）；鑽石 0.005%（只有次元裂縫）。
 *   兌換：王之徽章 30 個 → 指定一隻打倒過的王的普卡；300 個 → 銀卡（金卡以上只能打）。
 *   完成加成（每頁取最高一檔）：
 *         野外：對頭目造成的傷害 +1／2／3／4／5%
 *         地監：受到頭目的傷害 −1／2／3／4／5%
 *         79 隻全部金卡以上：達成「王者收藏家」，對頭目造成的傷害再 +2%
 *   王者積分：登錄用掉的卡（普 1、銀 10、金 100、白金 1,000、鑽石 10,000）全部加總，跨角色共用、只增不減。
 *   進度存在 localStorage「lineage_bosscard_v1」（跨角色共用，跟著轉移碼／備份走）。
 *   經典模式沒有；外掛開關 bosscard。之後：鑽石卡以上可以兌換七階以上的魔法娃娃（還沒定案）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bosscard', name: '王者卡冊', group: '遊戲內容', desc: '卡片收集冊多兩個分頁「王者・野外」「王者・地監」，收錄地圖王、副本王（收藏 → 怪物）。', def: true });
  if (T && T.enabled && !T.enabled('bosscard')) return;
  var MB = W.__afkMapBoss;
  if (!MB || typeof DB === 'undefined' || !DB.items) return;

  var KEY = 'lineage_bosscard_v1', BADGE = 'afk_mb_badge';
  var TIERS = [
    { t: 1, k: 'p', n: '普卡', col: 'c-card-common', img: 'assets/icons/items/普卡.png', pts: 1, rate: 0.05, price: 100 },
    { t: 2, k: 's', n: '銀卡', col: 'c-card-silver', img: 'assets/icons/items/銀卡.png', pts: 10, rate: 0.01, price: 1000 },
    { t: 3, k: 'g', n: '金卡', col: 'c-card-gold', img: 'assets/icons/items/金卡.png', pts: 100, rate: 0.001, price: 10000 },
    { t: 4, k: 'w', n: '白金卡', col: 'c-card-plat', img: 'assets/icons/items/白金卡.png', pts: 1000, rate: 0.0002, price: 100000 },
    { t: 5, k: 'd', n: '鑽石卡', col: 'c-card-diamond', img: 'assets/icons/items/鑽石卡.png', pts: 10000, rate: 0.00005, price: 1000000 }
  ];
  var TABS = [
    { k: 'field', n: '野外', stat: '對頭目造成的傷害', vals: [1, 2, 3, 4, 5], sign: '+' },
    { k: 'dungeon', n: '地監', stat: '受到頭目的傷害', vals: [1, 2, 3, 4, 5], sign: '−' }
  ];
  var EX = [{ t: 1, cost: 30 }, { t: 2, cost: 300 }];
  var LIST = MB.LIST.slice();
  var BY = {}; LIST.forEach(function (b) { BY[b.id] = b; });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function () { var p = P(); return !!(p && (p.classicMode || p.traditionalMode)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var cid = function (code, t) { return 'bcard_' + TIERS[t - 1].k + '_' + code; };

  // ── 進度（跨角色共用） ──
  var cache = null;
  var load = function () {
    if (cache) return cache;
    var d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object') d = {};
    d.s = d.s || {}; d.x = d.x || {}; d.k = d.k || {}; d.pts = Number(d.pts) || 0;
    return (cache = d);
  };
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) {} };
  W.addEventListener('storage', function (e) { if (e.key === KEY) cache = null; });
  var score = function (code) { return Math.min(100, Number(load().s[code]) || 0); };
  var tierOf = function (code) { var s = score(code), x = Number(load().x[code]) || 0; var t = s >= 100 ? 3 : s >= 10 ? 2 : s >= 1 ? 1 : 0; return Math.max(t, x); };
  var tabTier = function (k) { var m = 5, any = false; LIST.forEach(function (b) { if (b.type !== k) return; any = true; m = Math.min(m, tierOf(b.id)); }); return any ? m : 0; };
  var allGold = function () { return LIST.every(function (b) { return b.type === 'nz' || tierOf(b.id) >= 3; }); };   // 「王者收藏家」只算原本的 79 隻
  var bonus = function () {
    var out = 0, inn = 0, f = tabTier('field'), d = tabTier('dungeon');
    if (f > 0) out += TABS[0].vals[f - 1]; if (d > 0) inn += TABS[1].vals[d - 1];
    if (TABS[2]) { var z = tabTier('nz'); if (z > 0) out += TABS[2].vals[z - 1]; }   // 新地區的王（afk-newzones 登錄）
    if (allGold()) out += 2;
    return { out: out / 100, inn: inn / 100 };
  };
  var BON = { out: 0, inn: 0 };
  var refresh = function () { BON = bonus(); };

  // ── 卡片道具 ──
  var css = document.createElement('style');
  css.textContent = '.c-card-plat{color:#e2e8f0;text-shadow:0 0 7px #94a3b8}.c-card-diamond{color:#67e8f9;text-shadow:0 0 8px #06b6d4}'
    + '.afk-bcw .bc-h{font-size:26px;font-weight:700;color:#fbbf24}.afk-bcw .bc-h small{font-size:15px;color:#94a3b8;font-weight:400;margin-left:10px}'
    + '.afk-bcw .bc-line{margin:8px 0;color:#e2e8f0;font-size:15px;line-height:1.7}.afk-bcw .bc-line b.ok{color:#fde68a}.afk-bcw .bc-line .dim{color:#64748b}'
    + '.afk-bcw .bc-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:12px}'
    + '.afk-bcw .bc-card{position:relative;width:136px;border:1px solid #334155;border-radius:8px;background:rgba(30,41,59,.7);padding:8px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}'
    + '.afk-bcw .bc-card.t1{border-color:#a8a29e}.afk-bcw .bc-card.t2{border-color:#cbd5e1}.afk-bcw .bc-card.t3{border-color:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,.4)}'
    + '.afk-bcw .bc-card.t4{border-color:#e2e8f0;box-shadow:0 0 10px rgba(226,232,240,.5)}.afk-bcw .bc-card.t5{border-color:#67e8f9;box-shadow:0 0 12px rgba(6,182,212,.6)}'
    + '.afk-bcw .bc-card.sel{outline:3px solid #fbbf24}.afk-bcw .bc-pic{background:radial-gradient(#57534e,#1c1917);border-radius:6px}.afk-bcw .bc-card img{display:block;width:100%;height:120px;object-fit:contain}'
    + '.afk-bcw .bc-pic.mob{background:none;width:64px;height:64px;margin-top:14px;display:flex;align-items:center;justify-content:center}.afk-bcw .bc-pic.mob>*{transform:scale(.68);transform-origin:center bottom}.afk-bcw .bc-pic.mob img{width:64px;height:64px;object-fit:contain}'
    + '.afk-bcw .bc-card img.sil{filter:brightness(0) opacity(.75)}.afk-bcw .bc-nm{font-size:14px;font-weight:700;color:#fff;line-height:1.3}.afk-bcw .bc-sub{font-size:11px;color:#94a3b8;line-height:1.35}.afk-bcw .bc-card .bc-bar{width:100%}'
    + '.afk-bcw .bc-tag{position:absolute;top:4px;left:4px;font-size:10px;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.5);color:#cbd5e1}.afk-bcw .bc-tb{position:absolute;top:4px;right:4px;font-size:10px;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.5);font-weight:700}'
    + '.afk-bcw .bc-tr{font-size:12px;margin-top:2px}.afk-bcw .bc-bar{height:4px;background:#292524;border-radius:2px;margin-top:3px;overflow:hidden}.afk-bcw .bc-bar i{display:block;height:100%;background:#f59e0b}'
    + '.afk-bcw .bc-det{margin-top:12px;padding:12px;border:1px solid #57534e;border-radius:10px;background:#1c1917;color:#e7e5e4;font-size:14px;line-height:1.7}'
    + '.afk-bcw .bc-det button{margin:6px 8px 0 0;padding:8px 14px;border-radius:6px;border:1px solid #b45309;background:#78350f;color:#fde68a;font-weight:700}.afk-bcw .bc-det button:disabled{opacity:.4}'
  css.textContent += '@media (max-width:640px){.afk-bcw .bc-card{width:31%}.afk-bcw .bc-nm{font-size:12px}.afk-bcw .bc-h{font-size:20px}}';
  document.head.appendChild(css);

  var typeN = function (b) { return b.type === 'field' ? '野外' : b.type === 'nz' ? '新地區' : '地監'; };
  var mkItems = function (b) {
    TIERS.forEach(function (x) {
      var id = cid(b.id, x.t);
      DB.items[id] = { n: b.n + ' 的' + x.n, type: 'misc', c: x.col, img: x.img, p: x.price, gachaWeight: 0, noTrade: false, bossCard: b.id, bossCardTier: x.t,
        d: '王者卡片（' + typeN(b) + '王）。這隻王在卡片收集冊的王者分頁已經登錄到這一階以上，多的卡留著收藏或賣掉；之後可以拿來兌換魔法娃娃。' };
    });
  };
  LIST.forEach(mkItems);
  // 其他外掛登錄的王（afk-newzones：新地區的 19 隻王，第三個分頁「王者・新地區」）
  var register = function (arr) {
    (arr || []).forEach(function (b) { if (!b || !b.id || BY[b.id]) return; LIST.push(b); BY[b.id] = b; mkItems(b); });
    if (!TABS.some(function (t) { return t.k === 'nz'; })) TABS.push({ k: 'nz', n: '新地區', stat: '對頭目造成的傷害', vals: [1, 2, 3, 4, 5], sign: '+' });
    refresh();
  };

  // ── 取得卡片（自動登錄或進背包） ──
  var acquire = function (code, t, n, why) {
    n = Math.max(1, n || 1); var b = BY[code], x = TIERS[t - 1], d = load(); if (!b || !x) return;
    var used = 0;
    if (t <= 3) {
      while (used < n && score(code) < 100) { d.s[code] = Math.min(100, score(code) + x.pts); used++; }
    } else if ((Number(d.x[code]) || 0) < t) { d.x[code] = t; used = 1; }
    if (used) {
      d.pts += used * x.pts; save(); refresh();
      sys('<span class="' + x.col + ' font-bold">🎴 卡片收集冊（王者）登錄了「' + esc(b.n) + '」（' + x.n + (used > 1 ? ' ×' + used : '') + '）！</span>' + (why ? '<span class="text-slate-400">（' + why + '）</span>' : ''));
      try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    }
    if (n > used) { try { gainItem(cid(code, t), n - used, true, true); } catch (e) {} sys('<span class="' + x.col + '">得到 ' + esc(b.n) + ' 的' + x.n + ' ×' + (n - used) + '</span>'); }
    if (isOpen()) render();
  };

  // ── 打倒王時 ──
  var rnd = function () { return Math.random(); };
  var dreamOn = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on && W.__afkDreamHell.on()); } catch (e) { return false; } };
  var riftOn = function () { try { return !!(typeof W.__afkDimRiftOn === 'function' && W.__afkDimRiftOn()); } catch (e) { return false; } };
  var partyN = function () { var p = P(); var n = 1 + ((p && p.allies) || []).filter(function (a) { return a && a.enSeed && !a._downed; }).length; return Math.min(8, n); };
  W.__afkBossCardKill = function (b, m) {
    if (!b || classic()) return;
    var d = load(); if (!d.k[b.id]) { d.k[b.id] = 1; save(); }
    var mult = partyN(), rift = riftOn() || !!(m && m._dimRift), dream = dreamOn() && !rift;
    for (var i = TIERS.length - 1; i >= 0; i--) {
      var x = TIERS[i];
      if (x.t === 4 && !dream) continue;
      if (x.t === 5 && !rift) continue;
      if (rnd() < x.rate * mult) { acquire(b.id, x.t, 1, '打倒掉落'); break; }
    }
    if (isOpen()) render();
  };

  // ── 戰鬥加成 ──
  var hookOut = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkBossCard) return;
    var o = C.damage;
    C.damage = function (actor, target, amount) {
      var r = o.apply(this, arguments);
      try { if (r > 0 && BON.out > 0 && target && target.boss && actor && actor.cls && !classic()) r = Math.max(1, Math.floor(r * (1 + BON.out))); } catch (e) {}
      return r;
    };
    C.__afkBossCard = true;
  };
  hookOut(); W.addEventListener('load', hookOut);
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (mob && mob.boss && BON.inn > 0 && !classic()) ? 1 - BON.inn : 1; });

  // ── 兌換 ──
  var badges = function () { try { var p = P(); return (p.inv || []).reduce(function (s, it) { return s + (it && it.id === BADGE ? (Number(it.cnt) || 1) : 0); }, 0); } catch (e) { return 0; } };
  var spendBadges = function (n) {
    var p = P(); if (!p || badges() < n) return false;
    var left = n;
    for (var i = 0; i < p.inv.length && left > 0; i++) {
      var it = p.inv[i]; if (!it || it.id !== BADGE) continue;
      var c = Number(it.cnt) || 1, use = Math.min(c, left); left -= use;
      if (c - use > 0) it.cnt = c - use; else { p.inv.splice(i, 1); i--; }
    }
    return left === 0;
  };
  var exchange = function (code, t) {
    var b = BY[code], e = EX.filter(function (x) { return x.t === t; })[0];
    if (!b || !e || classic()) return;
    if (!load().k[code]) { sys('<span class="text-red-300">還沒打倒過「' + esc(b.n) + '」，不能兌換牠的卡。</span>'); return; }
    if (!spendBadges(e.cost)) { sys('<span class="text-red-300">王之徽章不夠（要 ' + e.cost + ' 個）。</span>'); return; }
    acquire(code, t, 1, '王之徽章 ×' + e.cost + ' 兌換');
    try { if (typeof saveGame === 'function') saveGame(); if (typeof renderTabs === 'function') renderTabs(true); } catch (x) {}
    render();
  };

  // ── 介面：放在「收藏 → 怪物」卡片收集冊裡，多兩個分頁「王者・野外」「王者・地監」（Ping 11-11 16:15） ──
  var ui = { sel: null };
  var curTab = function () { try { var r = String((0, eval)('_cardBookRegion') || ''); if (r.indexOf('boss_') !== 0) return null; r = r.slice(5); return TABS.some(function (t) { return t.k === r; }) ? r : null; } catch (e) { return null; } };
  var isOpen = function () { var el = document.getElementById('card-book'); return !!(el && !el.classList.contains('hidden') && curTab()); };
  // 11-17（Ping）：卡面改成跟其他卡冊一樣用怪物本身的圖（動畫第一張），不用立繪；找不到圖才退回立繪
  var mobPic = function (b, seen) {
    var portrait = b.card || ('assets/bosscard/' + b.id + '.png');
    try {
      var mob = (typeof DB !== 'undefined' && DB.mobs[b.mobId]) || {};
      var mi = typeof mobStillImg === 'function' ? mobStillImg(b.n, mob.img, false) : { src: mob.img || portrait, fb: [] };
      mi = { src: mi.src, fb: (mi.fb || []).concat([portrait]) };
      if (typeof _codexMobThumbHtml === 'function') return _codexMobThumbHtml(b.n, mi, seen ? '' : ' sil');
      return '<img src="' + mi.src + '" alt=""' + (seen ? '' : ' class="sil"') + '>';
    } catch (e) { return '<img src="' + portrait + '" alt=""' + (seen ? '' : ' class="sil"') + '>'; }
  };
  var ELE = { earth: '地', fire: '火', water: '水', wind: '風' };
  var BMC = {};
  var bossMob = function (b) {   // 新地區的王沒有 mobId → 用名字找（找一次記住）
    if (typeof DB === 'undefined' || !DB.mobs) return {};
    if (b.mobId && DB.mobs[b.mobId]) return DB.mobs[b.mobId];
    if (!(b.n in BMC)) { BMC[b.n] = null; for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === b.n) { BMC[b.n] = k; break; } }
    return (BMC[b.n] && DB.mobs[BMC[b.n]]) || {};
  };
  var subInfo = function (b, t) {   // 跟一般卡冊一樣（11-20 Ping）：銅卡起 Lv；銀卡起 HP・屬性（＋種族）；金卡起 AC・MR、出沒
    if (t < 1) return '';
    var mob = bossMob(b), q = function (v) { return v != null ? esc(String(v)) : '?'; };
    var s = '<div class="bc-sub bc-lv">Lv ' + q(mob.lv) + '</div>';
    if (t < 2) return s;
    s += '<div class="bc-sub">HP ' + (mob.hp != null ? esc(Number(mob.hp).toLocaleString()) : '?') + '・屬性 ' + (ELE[b.e] || '無') + '</div>' + (b.race ? '<div class="bc-sub">種族 ' + esc(b.race) + '</div>' : '');
    if (t >= 3) {
      s += '<div class="bc-sub">AC ' + q(mob.ac) + '・MR ' + q(mob.mr) + '</div>';
      var ms = (b.maps || []).map(mapName).slice(0, 3).join('、'); if (ms) s += '<div class="bc-sub">出沒：' + esc(ms) + '</div>';
    }
    return s;
  };
  var mapName = function (k) { try { return (typeof _cardMapName === 'function' && _cardMapName(k)) || k; } catch (e) { return k; } };
  var bodyHtml = function (tk) {
    var tab = TABS.filter(function (t) { return t.k === tk; })[0], list = LIST.filter(function (b) { return b.type === tk; });
    var cnt = [0, 0, 0, 0, 0]; list.forEach(function (b) { var t = tierOf(b.id); for (var i = 0; i < t; i++) cnt[i]++; });
    var tt = tabTier(tk), d = load();
    var h = '<div class="afk-bcw"><div class="bc-h">王者・' + tab.n + '<small>收集 ' + TIERS.map(function (x, i) { return x.n.replace('卡', '') + cnt[i]; }).join(' / ') + '　共 ' + list.length + ' 種</small></div>';
    h += '<div class="bc-line">完成加成（取最高）：' + TIERS.map(function (x, i) { var ok = tt >= x.t; return '<b class="' + (ok ? 'ok' : 'dim') + '">全' + x.n + ' ' + tab.stat + ' ' + tab.sign + tab.vals[i] + '%' + (ok ? ' ✓' : '') + '</b>'; }).join(' / ') + '</div>';
    h += '<div class="bc-line">79 隻王全部金卡以上：<b class="' + (allGold() ? 'ok' : 'dim') + '">達成「王者收藏家」：對頭目造成的傷害再 +2%' + (allGold() ? ' ✓' : '') + '</b></div>';
    h += '<div class="bc-line">王者積分 <b class="ok">' + d.pts.toLocaleString() + '</b>　·　王之徽章 <b class="ok">' + badges() + '</b> 個（30 個換普卡、300 個換銀卡，只能換打倒過的王；點卡片兌換）</div>';
    h += '<div class="bc-grid">';
    list.forEach(function (b) {
      var t = tierOf(b.id), s = score(b.id), seen = t > 0 || !!d.k[b.id], x = TIERS[t - 1];
      h += '<div class="bc-card t' + t + (ui.sel === b.id ? ' sel' : '') + '" data-bc="' + b.id + '"><span class="bc-tag">' + typeN(b) + '</span>'
        + (x ? '<span class="bc-tb ' + x.col + '">' + x.n + '</span>' : '')
        + '<div class="bc-pic mob">' + mobPic(b, seen) + '</div>'
        + '<div class="bc-nm">' + (seen ? esc(b.n) : '？？？') + '</div>'
        + subInfo(b, t)
        + '<div class="bc-tr ' + (x ? x.col : 'text-slate-500') + '">' + (x ? x.n : (d.k[b.id] ? '已打倒、未登錄' : '未遇見')) + '</div>'
        + (t < 3 ? '<div class="bc-bar"><i style="width:' + s + '%"></i></div>' : '') + '</div>';
    });
    h += '</div>';
    var sb = ui.sel && BY[ui.sel];
    if (sb && sb.type === tk) {
      var st = tierOf(sb.id), killed = !!d.k[sb.id];
      h += '<div class="bc-det"><b style="color:#fbbf24;font-size:16px">' + esc(sb.n) + '</b>　' + (st ? '<span class="' + TIERS[st - 1].col + '">' + TIERS[st - 1].n + '</span>' : '未登錄') + '　積分 ' + score(sb.id) + '/100'
        + '<br>出沒：' + (sb.where ? esc(sb.where) : sb.maps.map(mapName).map(esc).join('、') + (sb.type === 'field' ? '（在那張地圖打倒一般怪會遇到）' : '（在那一層打倒一般怪會遇到）'))
        + (killed ? '' : '<br><span style="color:#fca5a5">還沒打倒過這隻王，打倒一次後才能用王之徽章兌換。</span>')
        + '<br>' + EX.map(function (e) { var x = TIERS[e.t - 1]; return '<button type="button" data-ex="' + e.t + '"' + (killed && badges() >= e.cost ? '' : ' disabled') + '>王之徽章 ×' + e.cost + ' → ' + x.n + '</button>'; }).join('')
        + '</div>';
    }
    return h + '</div>';
  };
  var render = function () { try { if (typeof renderCardBook === 'function') renderCardBook(); } catch (e) {} };
  var paint = function () {
    var tabHost = document.getElementById('card-book-tabs'), host = document.getElementById('card-book-body'); if (!tabHost || !host || classic()) return;
    var cur = curTab();
    TABS.forEach(function (t) {
      var tt = tabTier(t.k), on = cur === t.k;
      tabHost.insertAdjacentHTML('beforeend', '<button onclick="cardBookTab(\'boss_' + t.k + '\')" class="btn px-3 py-1.5 text-sm font-bold whitespace-nowrap ' + (on ? 'bg-amber-800 border-amber-500 text-amber-100' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700') + '">👑 王者・' + t.n + (tt > 0 ? '<span class="' + TIERS[tt - 1].col + '"> ●</span>' : '') + '</button>');
    });
    if (cur) { cache = null; refresh(); host.innerHTML = bodyHtml(cur); }
  };
  if (typeof W.renderCardBook === 'function') {
    var oRCB = W.renderCardBook;
    W.renderCardBook = function () { var r = oRCB.apply(this, arguments); try { paint(); } catch (e) { console.warn('[AFK-bosscard]', e); } return r; };
    try { (0, eval)('renderCardBook = window.renderCardBook'); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var host = document.getElementById('card-book-body'); if (!host || !curTab() || !host.contains(e.target)) return;
    var t = e.target;
    var ex = t.closest && t.closest('[data-ex]'); if (ex) { exchange(ui.sel, Number(ex.getAttribute('data-ex'))); return; }
    var c = t.closest && t.closest('[data-bc]'); if (c) { ui.sel = c.getAttribute('data-bc'); render(); var det = host.querySelector('.bc-det'); if (det && det.scrollIntoView) det.scrollIntoView({ block: 'nearest' }); }
  });
  var open = function () { try { (0, eval)("_cardBookRegion = 'boss_field'"); if (typeof openCardBook === 'function') openCardBook(); } catch (e) {} };
  var close = function () { try { if (typeof closeCardBook === 'function') closeCardBook(); } catch (e) {} };

  refresh();
  W.__afkBossCard = { register: register, TIERS: TIERS, TABS: TABS, EX: EX, LIST: LIST, open: open, close: close, acquire: acquire, exchange: exchange, tierOf: tierOf, score: score, tabTier: tabTier, bonus: function () { return BON; }, load: load, cid: cid };
})();
