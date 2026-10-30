/* ============================================================================
 * afk-hunter.js — 魔物獵人模式：冒險者公會、冒險者等級、狩獵委託（玩家 2026-10-30 定案）
 *
 *   冒險者等級：F → E → D → C → B → A → S，每個角色各自計算（存在角色上），經典模式不開放。
 *     累積點數：F 0、E 100、D 300、C 600、B 1000、A 1500、S 2000。
 *     點數來源：完成委託（討伐 10、霸主／世界事件委託 25）；不在委託裡打倒地區霸主、世界事件頭目也各 +15。
 *     只做討伐委託、每天做滿 8 個：25 天到 S（4 週內）。
 *   等級加成（每升一級，E＝1…S＝6）：最大 HP +30、最大 MP +15、掉落機率 ×（1＋3%）——S 級合計 HP +180、MP +90、掉落 +18%。
 *   公會委託：每天（本機日期）刷新；一天最多接 8 個；接一個之後要等 1 小時才能接下一個；身上最多同時 3 個。
 *     委託板永遠有 4 個可選：3 個討伐（依你的等級挑地圖與怪物）、1 個霸主或世界事件。
 *     完成就直接領獎（不用回公會）：點數、金幣（等級×300）、狩獵徽章（討伐 1、霸主／世界事件 3）。
 *   冒險者套裝（公會用狩獵徽章換）：帽子 E 級／10 枚、手套 D 級／20 枚、長靴 C 級／30 枚、斗篷 B 級／40 枚。
 *     套裝效果：2 件 最大 HP +50、魔防 +5；4 件 再加 傷害減免 +2、命中 +3。
 *   S 級冒險者在終焉第二、三階層（每個隊員自己是 S 才有）：受到的傷害 −10%、造成的傷害 +10%、
 *     「席琳的凝視」造成的傷害下降減半、每 15 秒抵銷下一次「單次超過最大 HP 10%」的傷害（護盾圖示）。第二階層要 S 級才能挑戰。
 *   公會接待員：說話之島、奇岩、亞丁、歐瑞。外掛開關 hunter（預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'hunter', name: '魔物獵人模式（冒險者公會）', group: '遊戲內容',
    desc: '冒險者公會的狩獵委託與冒險者等級 F～S（每個角色各自計算，經典模式不開放）；S 級才能挑戰終焉第二階層' });
  if (T && !T.enabled('hunter')) return;
  if (!L || typeof DB === 'undefined' || !DB.towns) return;

  var RANKS = [['F', 0, '#94a3b8'], ['E', 100, '#a3e635'], ['D', 300, '#4ade80'], ['C', 600, '#38bdf8'], ['B', 1000, '#818cf8'], ['A', 1500, '#f472b6'], ['S', 2000, '#fbbf24']];
  var DAY_MAX = 8, CD_MS = 60 * 60 * 1000, ACTIVE_MAX = 3, BOARD_N = 4;
  var PTS = { kill: 10, rb: 25, we: 25 }, BADGE = { kill: 1, rb: 3, we: 3 }, BONUS_PTS = 15;
  var PER_RANK = { mhp: 30, mmp: 15, drop: 0.03 };
  var S_BUFF = { dr: 0.10, atk: 0.10, gazeCut: 0.5, shieldPct: 0.10, shieldSec: 15 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var IC = function (p) { return 'assets/icons/' + p + '.png'; };
  var classic = function (p) { return !!(p && p.classicMode); };

  // ── 角色資料 ──
  var store = function (p) {
    p = p || P(); if (!p) return null;
    if (!p.afkHunter || typeof p.afkHunter !== 'object') p.afkHunter = { pts: 0, done: 0, badges: 0, day: '', today: 0, nextAt: 0, board: [], active: [], seq: 0, kinds: {} };
    var h = p.afkHunter; ['board', 'active'].forEach(function (k) { if (!Array.isArray(h[k])) h[k] = []; }); if (!h.kinds) h.kinds = {};
    return h;
  };
  var rankIdx = function (p) { if (!p || classic(p)) return 0; var h = p.afkHunter, pts = (h && Number(h.pts)) || 0, r = 0; for (var i = 0; i < RANKS.length; i++) if (pts >= RANKS[i][1]) r = i; return r; };
  var rankOf = function (p) { return RANKS[rankIdx(p)]; };
  var isS = function (p) { return !!p && !classic(p) && rankIdx(p) >= RANKS.length - 1; };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // ── 等級加成 ──
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    if (!p || classic(p) || !p.afkHunter) return; var r = rankIdx(p); if (!r) return;
    p.mhp = (Number(p.mhp) || 0) + PER_RANK.mhp * r; p.mmp = (Number(p.mmp) || 0) + PER_RANK.mmp * r;
  });
  if (typeof W.partyDropRate === 'function') {
    var oDrop = W.partyDropRate;
    W.partyDropRate = function (rate) { var p = P(), r = (p && !classic(p)) ? rankIdx(p) : 0; return oDrop.call(this, r ? (Number(rate) || 0) * (1 + PER_RANK.drop * r) : rate); };
  }

  // ── 冒險者套裝 ──
  var SET = [
    { id: 'afk_hunter_helm', n: '冒險者的帽子', slot: 'helm', img: 'armors/皮帽子', ac: 2, rank: 1, cost: 10 },
    { id: 'afk_hunter_gloves', n: '冒險者的手套', slot: 'gloves', img: 'armors/手套', ac: 2, rank: 2, cost: 20 },
    { id: 'afk_hunter_boots', n: '冒險者的長靴', slot: 'boots', img: 'armors/放牧者的皮靴', ac: 2, rank: 3, cost: 30 },
    { id: 'afk_hunter_cloak', n: '冒險者的斗篷', slot: 'cloak', img: 'armors/狼皮斗篷', ac: 2, rank: 4, cost: 40, mr: 3 }
  ];
  var SET_TXT = '冒險者套裝：2 件 最大 HP +50、魔防 +5；4 件 再加 傷害減免 +2、命中 +3。';
  SET.forEach(function (x) {
    L.addItem(x.id, Object.assign({ n: x.n, type: 'arm', slot: x.slot, ac: x.ac, req: 'all', safe: 4, p: 5000, c: 'text-lime-300', img: IC(x.img), afkHunterSet: true,
      d: '冒險者公會發給 ' + RANKS[x.rank][0] + ' 級以上冒險者的裝備，用狩獵徽章 ' + x.cost + ' 枚交換。' + SET_TXT }, x.mr ? { mr: x.mr } : {}));
  });
  L.defineSet({ ids: SET.map(function (x) { return x.id; }), tiers: [[2, { mhp: 50, mr: 5 }], [4, { dr: 2, extraHit: 3 }]] });

  // ── 委託 ──
  var okMap = function (id) { try { if (W.__afkKurtHunt && W.__afkKurtHunt.okMap) return W.__afkKurtHunt.okMap(id); } catch (e) {} return !!(DB.maps[id] && DB.maps[id].length) && !/^town_|^afk_/.test(id); };
  var mapName = function (v) {
    try { for (var i = 0; i < MAP_REGIONS.length; i++) { var m = MAP_REGIONS[i].maps.find(function (x) { return x.v === v; }); if (m) return m.t; } } catch (e) {}
    try { var e = mapEntryOf(v); if (e) return e.t || e.n || v; } catch (e2) {}
    return v;
  };
  var mapPool = null;
  var maps = function () {
    if (mapPool) return mapPool;
    var seen = {}; mapPool = [];
    try { MAP_REGIONS.forEach(function (r) { r.maps.forEach(function (m) { if (seen[m.v]) return; seen[m.v] = 1; if (!okMap(m.v)) return;
      var mobs = (DB.maps[m.v] || []).map(function (k) { return DB.mobs[k]; }).filter(function (x) { return x && !x.boss && !x.noAttack; });
      if (!mobs.length) return;
      var avg = Math.round(mobs.reduce(function (a, x) { return a + (Number(x.lv) || 1); }, 0) / mobs.length);
      mapPool.push({ v: m.v, avg: avg, mobs: mobs.map(function (x) { return x.n; }).filter(function (n, i, a) { return a.indexOf(n) === i; }) }); }); }); } catch (e) {}
    return mapPool;
  };
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var newKill = function (p, h) {
    var lv = Number(p.lv) || 1, all = maps(), lo = lv - 12, hi = lv + 3;
    var c = all.filter(function (m) { return m.avg >= lo && m.avg <= hi; });
    if (!c.length) c = all.filter(function (m) { return m.avg <= hi; }).sort(function (a, b) { return b.avg - a.avg; }).slice(0, 6);
    if (!c.length) c = all.slice(0, 6);
    var m = c[Math.floor(Math.random() * c.length)]; if (!m) return null;
    var mob = m.mobs[Math.floor(Math.random() * m.mobs.length)];
    var need = Math.max(6, Math.min(30, Math.round(rint(50, 70) / m.mobs.length)));
    return { id: ++h.seq, kind: 'kill', mob: mob, map: m.v, mapN: mapName(m.v), need: need, got: 0 };
  };
  var newSpecial = function (p, h) {
    var rbOk = !!W.__afkRegionBoss, weOk = !!(W.__afkWorldEvents || W.__afkKurtHunt);
    var k = rbOk && weOk ? (Math.random() < 0.5 ? 'rb' : 'we') : rbOk ? 'rb' : weOk ? 'we' : null;
    if (!k) return newKill(p, h);
    return { id: ++h.seq, kind: k, need: 1, got: 0 };
  };
  var fillBoard = function (p, h) {
    var kills = h.board.filter(function (x) { return x.kind === 'kill'; }).length, sp = h.board.length - kills;
    while (kills < BOARD_N - 1) { var c = newKill(p, h); if (!c) break; h.board.push(c); kills++; }
    if (sp < 1) { var s2 = newSpecial(p, h); if (s2) h.board.push(s2); }
  };
  var roll = function (p) {
    p = p || P(); var h = store(p); if (!h) return h;
    var d = today();
    if (h.day !== d) { h.day = d; h.today = 0; h.board = []; }
    fillBoard(p, h);
    return h;
  };
  var title = function (c) {
    if (c.kind === 'kill') return '討伐：' + c.mob + ' ×' + c.need + '（' + c.mapN + '）';
    if (c.kind === 'rb') return '霸主討伐：打倒任一地區的霸主';
    return '世界事件：打倒世界事件的頭目（克特、魔女賽尼斯、冰之女王…，或幽靈船長）';
  };
  var canAccept = function (p) {
    var h = roll(p); if (!h) return '請先進入遊戲';
    if (classic(p)) return '冒險者公會不受理經典模式的冒險者';
    if (h.today >= DAY_MAX) return '今天的 ' + DAY_MAX + ' 個委託都接完了，明天再來';
    if (h.active.length >= ACTIVE_MAX) return '身上最多同時 ' + ACTIVE_MAX + ' 個委託';
    var left = (Number(h.nextAt) || 0) - Date.now(); if (left > 0) return '下一個委託要再等 ' + Math.ceil(left / 60000) + ' 分鐘';
    return '';
  };
  var accept = function (id) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲' };
    var why = canAccept(p); if (why) return { ok: false, msg: why };
    var h = store(p), i = h.board.findIndex(function (x) { return x.id === id; }); if (i < 0) return { ok: false, msg: '這個委託已經不在委託板上了' };
    var c = h.board.splice(i, 1)[0]; c.at = Date.now(); h.active.push(c);
    h.today++; h.nextAt = Date.now() + CD_MS;
    fillBoard(p, h);
    sys('<span class="text-lime-300">接下委託：' + esc(title(c)) + '。</span>');
    try { saveGame(); } catch (e) {}
    return { ok: true };
  };
  var abandon = function (id) {
    var p = P(), h = store(p); if (!h) return;
    var i = h.active.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
    var c = h.active.splice(i, 1)[0];
    sys('<span class="text-slate-300">放棄委託：' + esc(title(c)) + '（今天的次數與冷卻不會退回）。</span>');
    try { saveGame(); } catch (e) {}
  };
  var addPts = function (p, n, why) {
    var h = store(p); if (!h || classic(p)) return;
    var r0 = rankIdx(p); h.pts = (Number(h.pts) || 0) + n; var r1 = rankIdx(p);
    if (r1 > r0) {
      sys('<span class="font-bold" style="color:' + RANKS[r1][2] + ';text-shadow:0 0 8px #000">🏅 冒險者等級提升為 ' + RANKS[r1][0] + ' 級！</span>'
        + (r1 === RANKS.length - 1 ? '<span class="text-amber-200">（S 級冒險者：可以挑戰終焉第二階層，並在第二、三階層得到 S 級加成）</span>' : ''));
      try { recomputeStats(); } catch (e) {}
    }
  };
  var complete = function (p, c) {
    var h = store(p), i = h.active.indexOf(c); if (i >= 0) h.active.splice(i, 1);
    var gold = Math.max(1000, (Number(p.lv) || 1) * 300);
    h.done = (h.done || 0) + 1; h.kinds[c.kind] = (h.kinds[c.kind] || 0) + 1; h.badges = (h.badges || 0) + BADGE[c.kind];
    p.gold = (Number(p.gold) || 0) + gold;
    sys('<span class="font-bold text-lime-300">✔ 委託完成：' + esc(title(c)) + '</span><span class="text-amber-200">（冒險點數 +' + PTS[c.kind] + '、金幣 +' + gold.toLocaleString() + '、狩獵徽章 +' + BADGE[c.kind] + '）</span>');
    addPts(p, PTS[c.kind]);
    try { updateUI(); saveGame(); } catch (e) {}
  };
  var isWeBoss = function (m) { return !!(m && (m._weBoss || (m._afkKurt && m.boss) || m.mobId === 'afk_gs_captain' || m.n === '幽靈船長')); };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, r = oKill.apply(this, arguments);
      try {
        var p = P();
        if (p && !classic(p) && m && m._dead && !m._afkHunted) {
          m._afkHunted = true;
          var h = store(p), rb = !!m._rbBoss, we = isWeBoss(m), usedBonus = false;
          h.active.slice().forEach(function (c) {
            if (c.kind === 'kill' && m.n === c.mob) { c.got++; if (c.got >= c.need) complete(p, c); }
            else if ((c.kind === 'rb' && rb) || (c.kind === 'we' && we)) { c.got = 1; usedBonus = true; complete(p, c); }
          });
          if ((rb || we) && !usedBonus) { addPts(p, BONUS_PTS); sys('<span class="text-lime-300">冒險點數 +' + BONUS_PTS + '（打倒' + (rb ? '地區霸主' : '世界事件的頭目') + '）。</span>'); }
        }
      } catch (e) { console.warn('[AFK-hunter] kill', e); }
      return r;
    };
  }

  // ── S 級冒險者：終焉第二、三階層 ──
  var allyS = {};
  var sOf = function (ent) {
    var p = P(); if (!ent || !p) return false;
    if (ent === p) return isS(p);
    if (ent.afkHunter) return isS(ent);
    var slot = ent._slot; if (slot == null) return false;
    var c = allyS[slot], now = Date.now();
    if (!c || now - c.at > 30000) {
      var v = false; try { var sp = typeof _roleReadSavePlayer === 'function' ? _roleReadSavePlayer(slot) : null; v = !!(sp && isS(sp)); } catch (e) {}
      c = allyS[slot] = { v: v, at: now };
    }
    return c.v;
  };
  var tierOn = function () { var FB = W.__afkFinalBoss; try { if (!FB || !FB.on()) return false; var md = FB.mode(); return md === 'tier2' || md === 'tier3'; } catch (e) { return false; } };
  var tk = function () { return Number(S().ticks) || 0; };
  var whoN = function (t) { return t === P() ? '你' : '協力·' + esc(t._allyName || '傭兵'); };
  var shield = function (t, dmg, label) {
    var mx = t === P() ? (Number(t.mhp) || 1) : (Number(t.mhp) || Number(t.curHp) || 1);
    if (!(dmg >= mx * S_BUFF.shieldPct)) return dmg;
    if ((t._afkSShieldAt || 0) > tk()) return dmg;
    t._afkSShieldAt = tk() + S_BUFF.shieldSec * 10;
    clog('<span class="font-bold" style="color:#fbbf24">【S 級冒險者】</span>' + whoN(t) + '的護盾擋下了' + (label ? '「' + esc(label) + '」' : '這一擊') + '（' + Math.floor(dmg).toLocaleString() + ' 點）。', 'player');
    shieldBadge();
    return 0;
  };
  W.__afkFbOutMod = function (actor, target, r) { return (tierOn() && sOf(actor)) ? r * (1 + S_BUFF.atk) : r; };
  W.__afkFbGazeMod = function (actor, pct) { return (tierOn() && sOf(actor)) ? pct * S_BUFF.gazeCut : pct; };
  W.__afkFbHurtMod = function (t, dmg, why) { if (!tierOn() || !sOf(t)) return dmg; return shield(t, dmg * (1 - S_BUFF.dr), why); };
  var hookIncoming = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.incoming !== 'function' || R.incoming.__afkHunter) return;
    var o = R.incoming;
    R.incoming = function (actor, amount, attacker, opts) {
      var r = o.apply(this, arguments);
      try {
        if (r > 0 && attacker && (attacker._afkFinal || attacker._afkApostle) && tierOn() && sOf(actor)) {
          r = Math.max(1, Math.floor(r * (1 - S_BUFF.dr)));
          r = shield(actor, r, opts && opts.skill && opts.skill.skn);
        }
      } catch (e) {}
      return r;
    };
    R.incoming.__afkHunter = true;
  };
  hookIncoming(); W.addEventListener('load', hookIncoming);
  // 護盾圖示（狀態列）：亮＝可用、灰＝冷卻中
  var shieldBadge = function () {
    try {
      var el = document.getElementById('afk-sshield-badge'), p = P();
      if (!tierOn() || !isS(p)) { if (el) el.remove(); return; }
      var host = document.getElementById('afk-ev-badges');
      if (!host) { var sa = document.getElementById('status-alerts'); if (!sa || !sa.parentNode) return; host = document.createElement('span'); host.id = 'afk-ev-badges'; host.className = 'text-sm'; host.style.cssText = 'font-weight:bold;font-variant-numeric:tabular-nums;white-space:nowrap'; sa.parentNode.insertBefore(host, sa.nextSibling); }
      if (!el) { el = document.createElement('span'); el.id = 'afk-sshield-badge'; el.style.cssText = 'font-weight:bold;margin-left:6px'; host.appendChild(el); }
      var left = Math.max(0, Math.ceil(((p._afkSShieldAt || 0) - tk()) / 10));
      var tx = left ? '🛡 S 護盾 ' + left + 's' : '🛡 S 護盾'; if (el.textContent !== tx) el.textContent = tx;
      el.style.color = left ? '#64748b' : '#fbbf24'; el.style.opacity = left ? '0.7' : '1';
      el.title = 'S 級冒險者：每 15 秒抵銷下一次單次超過最大 HP 10% 的傷害';
    } catch (e) {}
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { if (tk() % 10 === 0) shieldBadge(); } catch (e) {} return r; };
  }

  // ── 公會 NPC ──
  var NPC_ID = 'npc_afk_guild', NPC_N = '冒險者公會 接待員 米雅';
  var NPC_D = '冒險者公會的接待員。替各地的委託人張貼狩獵委託，也替冒險者評定等級（F～S）。';
  [['town_talking', [84, 40]], ['town_giran', [84, 40]], ['town_aden', [84, 40]], ['town_oren', [84, 40]]].forEach(function (x) {
    L.addNpc(x[0], { id: NPC_ID, n: NPC_N, title: '冒險者公會', type: 'quest', classicHide: true, d: NPC_D }, '949', x[1]);
  });
  var bar = function (a, b, color) { var pc = b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 100; return '<div style="height:8px;border-radius:4px;background:#1e293b;overflow:hidden"><div style="width:' + pc + '%;height:100%;background:' + color + '"></div></div>'; };
  var render = function (div) {
    var p = P(); if (!p || !div) return;
    if (classic(p)) { div.innerHTML = '<div class="text-sm text-slate-300">「抱歉，冒險者公會不受理經典模式的冒險者。」</div>'; return; }
    var h = roll(p), ri = rankIdx(p), rk = RANKS[ri], nx = RANKS[ri + 1], why = canAccept(p);
    var hh = '<div class="text-sm space-y-3" id="afk-guild">'
      + '<div class="text-slate-300">「歡迎來到冒險者公會。委託每天換新，一天最多接 ' + DAY_MAX + ' 個；接了一個，請休息一小時再來接下一個。」</div>'
      + '<div class="p-3 rounded border border-slate-600 bg-slate-900/60"><div class="flex items-center justify-between"><b style="font-size:20px;color:' + rk[2] + '">冒險者等級 ' + rk[0] + '</b><span class="text-slate-300">點數 ' + (h.pts || 0).toLocaleString() + (nx ? '／' + nx[1].toLocaleString() + '（下一級 ' + nx[0] + '）' : '（最高）') + '</span></div>'
      + bar((h.pts || 0) - rk[1], nx ? nx[1] - rk[1] : 1, rk[2])
      + '<div class="text-xs text-slate-400 mt-1">今天已接 ' + h.today + '／' + DAY_MAX + '・完成委託 ' + (h.done || 0) + ' 個・狩獵徽章 ' + (h.badges || 0) + ' 枚'
      + (ri ? '・等級加成：最大 HP +' + PER_RANK.mhp * ri + '、最大 MP +' + PER_RANK.mmp * ri + '、掉落機率 +' + Math.round(PER_RANK.drop * ri * 100) + '%' : '') + '</div>'
      + (ri === RANKS.length - 1 ? '<div class="text-xs mt-1" style="color:#fde68a">S 級冒險者：可以挑戰終焉第二階層；在第二、三階層受到的傷害 −10%、造成的傷害 +10%、凝視的傷害下降減半，每 15 秒抵銷一次大傷害。</div>' : '') + '</div>';
    hh += '<div class="font-bold text-lime-300">進行中的委託（' + h.active.length + '／' + ACTIVE_MAX + '）</div>';
    hh += h.active.length ? h.active.map(function (c) {
      return '<div class="p-2 rounded border border-lime-800 bg-slate-900/40"><div class="flex justify-between gap-2"><span>' + esc(title(c)) + '</span><span class="text-lime-300">' + c.got + '／' + c.need + '</span></div>' + bar(c.got, c.need, '#84cc16')
        + '<div class="text-right mt-1"><button type="button" class="btn px-2 py-0.5 text-xs" data-hq="drop:' + c.id + '">放棄</button></div></div>';
    }).join('') : '<div class="text-slate-400 text-xs">（沒有）</div>';
    hh += '<div class="font-bold text-amber-300">委託板</div>' + (why ? '<div class="text-xs text-amber-200">' + esc(why) + '</div>' : '');
    hh += h.board.map(function (c) {
      return '<div class="p-2 rounded border border-slate-600 bg-slate-900/40 flex items-center justify-between gap-2"><span>' + esc(title(c)) + '<br><small class="text-slate-400">冒險點數 ' + PTS[c.kind] + '・狩獵徽章 ' + BADGE[c.kind] + '・金幣 ' + Math.max(1000, (Number(p.lv) || 1) * 300).toLocaleString() + '</small></span>'
        + '<button type="button" class="btn px-3 py-1 text-sm font-bold" style="white-space:nowrap;flex-shrink:0"' + (why ? ' disabled' : '') + ' data-hq="take:' + c.id + '">接取</button></div>';
    }).join('');
    hh += '<div class="font-bold text-sky-300">冒險者套裝（狩獵徽章 ' + (h.badges || 0) + ' 枚）</div><div class="text-xs text-slate-400">' + SET_TXT + '</div>';
    hh += SET.map(function (x) {
      var lock = ri < x.rank ? RANKS[x.rank][0] + ' 級以上' : (h.badges || 0) < x.cost ? '徽章不足' : '';
      return '<div class="p-2 rounded border border-slate-700 flex items-center justify-between gap-2"><span><img src="' + IC(x.img) + '" style="width:28px;height:28px;display:inline-block;vertical-align:middle;margin-right:6px">' + esc(x.n) + ' <small class="text-slate-400">AC ' + x.ac + (x.mr ? '、魔防 +' + x.mr : '') + '・' + RANKS[x.rank][0] + ' 級・' + x.cost + ' 枚</small></span>'
        + '<button type="button" class="btn px-3 py-1 text-sm" style="white-space:nowrap;flex-shrink:0"' + (lock ? ' disabled title="' + lock + '"' : '') + ' data-hq="buy:' + x.id + '">' + (lock || '交換') + '</button></div>';
    }).join('');
    hh += '<details class="text-xs text-slate-300"><summary class="cursor-pointer">等級表</summary>' + RANKS.map(function (r, i) { return '<div><b style="color:' + r[2] + '">' + r[0] + '</b>：' + r[1].toLocaleString() + ' 點' + (i ? '（HP +' + PER_RANK.mhp * i + '、MP +' + PER_RANK.mmp * i + '、掉落 +' + Math.round(PER_RANK.drop * i * 100) + '%）' : '') + '</div>'; }).join('')
      + '<div class="mt-1">點數：討伐委託 ' + PTS.kill + '、霸主／世界事件委託 ' + PTS.rb + '；不在委託裡打倒地區霸主或世界事件的頭目也 +' + BONUS_PTS + '。</div></details>';
    div.innerHTML = hh + '</div>';
    div.onclick = function (e) {
      var b = e.target.closest('[data-hq]'); if (!b || b.disabled) return;
      var v = b.getAttribute('data-hq').split(':'), r;
      if (v[0] === 'take') { r = accept(Number(v[1])); if (!r.ok) sys('<span class="text-amber-300">' + esc(r.msg) + '</span>'); }
      else if (v[0] === 'drop') abandon(Number(v[1]));
      else if (v[0] === 'buy') { r = buy(v[1]); if (!r.ok) sys('<span class="text-amber-300">' + esc(r.msg) + '</span>'); }
      render(div);
    };
  };
  var buy = function (id) {
    var p = P(), h = store(p), x = SET.filter(function (s) { return s.id === id; })[0];
    if (!p || !x) return { ok: false, msg: '沒有這件裝備' };
    if (classic(p)) return { ok: false, msg: '經典模式不開放' };
    if (rankIdx(p) < x.rank) return { ok: false, msg: '要 ' + RANKS[x.rank][0] + ' 級以上冒險者' };
    if ((h.badges || 0) < x.cost) return { ok: false, msg: '狩獵徽章不足' };
    h.badges -= x.cost; gainItem(x.id, 1, true, true);
    sys('<span class="text-sky-300">用狩獵徽章 ' + x.cost + ' 枚換到「' + esc(x.n) + '」。</span>');
    try { renderTabs(); updateUI(); saveGame(); } catch (e) {}
    return { ok: true };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) { var div = document.getElementById('interaction-content'); if (div) { div.onclick = null; render(div); } } } catch (e) { console.warn('[AFK-hunter] ui', e); }
      return r;
    };
  }

  W.__afkHunter = { RANKS: RANKS, DAY_MAX: DAY_MAX, CD_MS: CD_MS, ACTIVE_MAX: ACTIVE_MAX, PTS: PTS, BADGE: BADGE, BONUS_PTS: BONUS_PTS, PER_RANK: PER_RANK, S_BUFF: S_BUFF, SET: SET, SET_TXT: SET_TXT, NPC_ID: NPC_ID,
    store: store, rankIdx: rankIdx, rankOf: rankOf, isS: isS, sOf: sOf, roll: roll, accept: accept, abandon: abandon, buy: buy, canAccept: canAccept, addPts: addPts, title: title, render: render, tierOn: tierOn, maps: maps,
    _resetAllyCache: function () { allyS = {}; } };
  try { console.log('[AFK-hunter] 已載入：魔物獵人模式'); } catch (e) {}
})();
