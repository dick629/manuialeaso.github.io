/* ============================================================================
 * afk-scarab.js — 成長型遺物「日輪聖甲蟲」（玩家 2026-11-02 13:56 定案；設計稿 docs/scarab-relic-design.md 第二版；外掛開關 scarab；經典模式沒有）
 *
 *   一、取得：說話之島「新手指導員 莉娜」每個角色免費給一個；不能交易、賣、強化。
 *   二、欄位：裝備視窗第二頁的聖物格（有聖甲蟲就開；其他聖物還是要轉生）。只有裝著時才會成長、才有效果。
 *   三、等級 1～100，三個型態（等級到了在莉娜那裡免費進化；沒進化時等級停在 39／69，經驗先存著）：
 *       第一型態「沉睡的聖甲蟲」Lv1～39（銅）→ 第二型態「展翅的聖甲蟲」Lv40～69（銀）→ 第三型態「日輪聖甲蟲」Lv70～100（金）
 *   四、效果（照等級累計）：
 *       力量、敏捷、體質、智力、精神、魅力：每 10 級各 +1；火水風地抗性：每級 +0.3；最大 HP：每級 +5
 *       第二型態起：寵物與召喚物的傷害、命中＋（等級 − 39）× 0.2；寵物的傷害減免＋（等級 − 39）× 0.1
 *       第三型態起：異常狀態抵抗＋（等級 − 69）× 0.5%
 *   五、成長經驗：打倒怪物＝怪物等級（頭目 ×20；時空裂痕、攻城、木人場不算）；里程碑一次性（舊角色有紀錄的會補算）；
 *       升級需要 1,900 × 等級^1.2（Lv1→2 要 1,900、Lv99→100 要約 47 萬，滿級共約 2,140 萬）。
 *       校準：滿編隊伍在野外的擊殺速度上限約每小時 5,700 隻，最快大約 72 小時滿級；一般新手大約到 144 小時。
 *   圖示：玩家提供的銅、銀、金三張（assets/icons/items/afk_scarab_1～3.png）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'scarab', name: '成長型遺物：日輪聖甲蟲', group: '遊戲內容', seal: true,
    desc: '莉娜免費給的新手遺物，裝在聖物格，打怪與完成任務成長到 100 級，加基礎屬性、四屬性抗性、HP，進化後再加寵物召喚物與異常抵抗' });
  if (T && !T.enabled('scarab')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var on = function (p) { return !!(p && !p.classicMode); };
  var tk = function () { return (typeof state !== 'undefined' && state) ? (Number(state.ticks) || 0) : 0; };

  var ID = 'afk_scarab', NPC_ID = 'npc_afk_novice';
  var FORM = [null, { n: '沉睡的聖甲蟲', max: 39, c: '#d97706' }, { n: '展翅的聖甲蟲', max: 69, c: '#cbd5e1' }, { n: '日輪聖甲蟲', max: 100, c: '#fbbf24' }];
  var K = 1900, POW = 1.2, BOSS_X = 20;
  var MS = { novice: 12500, trial: 25000, story: 7500, mastery: 15000, rank: 20000, region: 15000, event: 3750, eventDay: 5 };
  var need = function (lv) { return Math.round(K * Math.pow(lv, POW)); };
  var STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'], RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var fx = function (s) {
    var lv = s.lv, o = { stat: Math.floor(lv / 10), res: Math.round(lv * 0.3 * 10) / 10, mhp: lv * 5, pet: 0, petDr: 0, abn: 0 };
    if (s.form >= 2) { o.pet = Math.round(Math.max(0, lv - 39) * 0.2 * 10) / 10; o.petDr = Math.floor(Math.max(0, lv - 39) * 0.1); }
    if (s.form >= 3) o.abn = Math.round(Math.max(0, lv - 69) * 0.5 * 10) / 10;
    return o;
  };
  var fxText = function (o) {
    var t = ['力量、敏捷、體質、智力、精神、魅力各 +' + o.stat, '火水風地抗性各 +' + o.res, '最大 HP +' + o.mhp];
    if (o.pet) t.push('寵物與召喚物的傷害、命中各 +' + o.pet); if (o.petDr) t.push('寵物傷害減免 +' + o.petDr);
    if (o.abn) t.push('異常狀態抵抗 +' + o.abn + '%');
    return t.join('、');
  };

  // ── 道具 ──
  if (!DB.items[ID]) DB.items[ID] = { n: '日輪聖甲蟲', type: 'acc', slot: 'holy', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, noSell: true, noJunk: true, afkScarab: true,
    c: 'text-amber-300', img: 'assets/icons/items/afk_scarab_1.png', d: '說話之島莉娜給的成長型遺物。裝在聖物格（裝備視窗第二頁左下），打倒怪物、完成任務會成長到 100 級；Lv40、Lv70 時在莉娜那裡免費進化。' };
  try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[DB.items[ID].n] == null) ITEM_WEIGHTS[DB.items[ID].n] = 0; } catch (e) {}
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS.indexOf('holy') < 0) WEIGHT_COUNT_SLOTS.push('holy'); } catch (e) {}

  var store = function (p) { if (!p.afkScarab || typeof p.afkScarab !== 'object') p.afkScarab = { got: false, lv: 1, exp: 0, form: 1, ms: 0, weSeen: -1, weDay: '', weToday: 0 }; return p.afkScarab; };
  var owns = function (p) { if (!p) return false; if (p.eq && p.eq.holy && p.eq.holy.id === ID) return true; return (p.inv || []).some(function (i) { return i && i.id === ID; }); };
  var equipped = function (p) { return !!(p && on(p) && p.eq && p.eq.holy && p.eq.holy.id === ID); };
  W.__afkScarabOwns = function (p) { return on(p) && owns(p); };   // 聖物格的判斷在 afk-expedition（__afkHolySlotOn）

  // 道具數值照「目前角色」的聖甲蟲填（重算前）
  var sync = function () {
    var p = P(), d = DB.items[ID]; if (!d) return;
    STATS.concat(RES4, ['mhp', 'petDmgAll', 'petHitAll', 'summonDmg', 'summonHit', 'abnormalResist']).forEach(function (k) { delete d[k]; });
    if (!p || !on(p)) return;
    var s = store(p), o = fx(s);
    STATS.forEach(function (k) { if (o.stat) d[k] = o.stat; });
    RES4.forEach(function (k) { if (o.res) d[k] = Math.floor(o.res); });
    if (o.mhp) d.mhp = o.mhp;
    if (o.pet) { d.petDmgAll = Math.floor(o.pet); d.petHitAll = Math.floor(o.pet); d.summonDmg = Math.floor(o.pet); d.summonHit = Math.floor(o.pet); }
    if (o.abn) d.abnormalResist = o.abn;
    d.img = 'assets/icons/items/afk_scarab_' + s.form + '.png';
    d.n = FORM[s.form].n + ' Lv' + s.lv;
    d.d = '成長型遺物。裝在聖物格（裝備視窗第二頁左下）才會成長、才有效果。目前：' + fxText(o) + '。' + (s.form < 3 ? 'Lv' + FORM[s.form].max + ' 時在說話之島莉娜那裡免費進化。' : '');
  };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () { try { sync(); } catch (e) {} return oRe.apply(this, arguments); };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (typeof W.petDerive === 'function') {
    var oPD = W.petDerive;
    W.petDerive = function () { var r = oPD.apply(this, arguments); try { var p = P(); if (r && equipped(p)) { var o = fx(store(p)); if (o.petDr) r.dr = (r.dr || 0) + o.petDr; } } catch (e) {} return r; };
    try { (0, eval)('petDerive = window.petDerive'); } catch (e) {}
  }

  // ── 成長 ──
  var fire = function (text) { var p = P(); if (X && p) X.pop('scarab', 'assets/icons/items/afk_scarab_' + store(p).form + '.png', text, FORM[store(p).form].c); };
  var levelUp = function (p) {
    var s = store(p), up = 0;
    while (s.lv < FORM[s.form].max && s.exp >= need(s.lv)) { s.exp -= need(s.lv); s.lv++; up++; }
    if (up) {
      fire('Lv ' + s.lv);
      sys('<span style="color:' + FORM[s.form].c + ';font-weight:bold">🪲 ' + FORM[s.form].n + '升到 Lv' + s.lv + '。</span>' + (s.lv >= FORM[s.form].max && s.form < 3 ? '<span class="text-amber-300">（可以到說話之島莉娜那裡進化了）</span>' : ''));
      try { recomputeStats(); } catch (e) {}
    }
    return up;
  };
  var addExp = function (p, n) { if (!p || !(n > 0)) return; var s = store(p); s.exp += Math.floor(n); levelUp(p); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  // 里程碑：目前應得的總量（只算有紀錄的）
  var CLS_TRIAL = /^(royal|knight|elf|mage|dark|dragon|illusion|warrior)\d+$/;
  var msTotal = function (p) {
    var n = 0, det = { novice: 0, trial: 0, story: 0, mastery: 0, rank: 0, region: 0 };
    try { if (p.afkNovQ && p.afkNovQ.st === 2) det.novice = 1; } catch (e) {}
    try { Object.keys(p.trialQ || {}).forEach(function (k) { if (p.trialQ[k] === 2) { if (CLS_TRIAL.test(k)) det.trial++; else det.story++; } }); } catch (e) {}
    try { if (p.mastery) det.mastery = 1; } catch (e) {}
    try { var H = W.__afkHunter, pts = Number(p.afkHunter && p.afkHunter.pts) || 0; if (H && H.RANKS) H.RANKS.forEach(function (r, i) { if (i > 0 && pts >= r[1]) det.rank++; }); } catch (e) {}
    try { var st = p.afkRb && p.afkRb.stats; if (st) Object.keys(st).forEach(function (k) { if (st[k] && st[k].kills > 0) det.region++; }); } catch (e) {}
    n = det.novice * MS.novice + det.trial * MS.trial + det.story * MS.story + det.mastery * MS.mastery + det.rank * MS.rank + det.region * MS.region;
    return { n: n, det: det };
  };
  var weKills = function (p) { var st = p.afkWe && p.afkWe.stats, n = 0; if (st) Object.keys(st).forEach(function (k) { n += (st[k] && st[k].kills) || 0; }); return n; };
  var checkMs = function (p) {
    if (!p || !on(p) || !store(p).got) return;
    var s = store(p), m = msTotal(p).n;
    if (m > s.ms) { var d = m - s.ms; s.ms = m; addExp(p, d); sys('<span style="color:#fbbf24">🪲 聖甲蟲從你完成的事蹟得到成長經驗 ' + d.toLocaleString() + '。</span>'); }
    var wk = weKills(p);
    if (s.weSeen < 0) s.weSeen = wk;
    if (wk > s.weSeen) {
      if (s.weDay !== today()) { s.weDay = today(); s.weToday = 0; }
      var c = Math.min(wk - s.weSeen, Math.max(0, MS.eventDay - s.weToday)); s.weSeen = wk;
      if (c > 0) { s.weToday += c; addExp(p, c * MS.event); }
    }
  };
  if (X) {
    X.on('kill', function (m) {
      var p = P(); if (!equipped(p) || !m || m._train || m.siegeEnemy || m.pledgeEnemy || (typeof state !== 'undefined' && state.riftRun)) return;
      addExp(p, (Number(m.lv) || 1) * (m.boss ? BOSS_X : 1));
    });
    var nextMs = 0;
    X.on('tick', function () { var t = tk(); if (t < nextMs) return; nextMs = t + 600; try { checkMs(P()); } catch (e) {} });
  }

  // ── 領取、進化 ──
  var claim = function () {
    var p = P(); if (!on(p)) return false; var s = store(p);
    if (s.got && owns(p)) return false;
    s.got = true; gainItem(ID, 1, true, true);
    sys('<span style="color:#fbbf24;font-weight:bold">🪲 莉娜把一隻沉睡的聖甲蟲放到你手上：「裝在聖物格，牠會跟你一起長大。」</span>');
    checkMs(p); try { recomputeStats(); saveGame(); } catch (e) {}
    return true;
  };
  var evolve = function () {
    var p = P(); if (!on(p)) return false; var s = store(p);
    if (s.form >= 3 || s.lv < FORM[s.form].max) return false;
    s.form++; levelUp(p);
    fire(FORM[s.form].n);
    sys('<span style="color:' + FORM[s.form].c + ';font-weight:bold">🪲 聖甲蟲展開了翅膀——進化成「' + FORM[s.form].n + '」。</span>');
    try { recomputeStats(); saveGame(); } catch (e) {}
    return true;
  };

  // ── 莉娜的頁面多一塊「日輪聖甲蟲」──
  var section = function (p) {
    var s = store(p), o = fx(s), f = FORM[s.form], nx = s.form < 3 ? fx({ lv: FORM[s.form].max + 1, form: s.form + 1 }) : null, m = msTotal(p).det;
    var pct = s.lv >= 100 ? 100 : Math.min(100, Math.floor(s.exp / need(s.lv) * 100));
    var btn = function (act, label, ok) { return '<button class="btn ' + (ok ? 'bg-amber-800 hover:bg-amber-700' : 'bg-slate-700 opacity-60') + ' py-1.5 px-3 font-bold" data-afk-sc="' + act + '"' + (ok ? '' : ' disabled') + '>' + label + '</button>'; };
    var h = '<div id="afk-scarab-box" style="margin:10px 16px;padding:10px 12px;border:1px solid #8a6a2a;border-radius:8px;background:linear-gradient(135deg,rgba(120,80,20,.25),rgba(30,27,36,.9) 60%)">'
      + '<div style="font-weight:bold;color:#fde68a;margin-bottom:6px">🪲 日輪聖甲蟲（成長型遺物）</div>';
    if (!s.got || !owns(p)) return h + '<div class="text-sm text-slate-300">給新手用的成長型聖物：裝在聖物格（裝備視窗第二頁左下），打怪、完成任務會一起成長到 100 級。</div><div class="mt-2">' + btn('claim', s.got ? '再領一隻（原本的不見了）' : '領取日輪聖甲蟲', true) + '</div></div>';
    h += '<div style="display:flex;gap:10px;align-items:center"><img src="assets/icons/items/afk_scarab_' + s.form + '.png" style="width:56px;height:56px;border-radius:10px">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:bold;color:' + f.c + '">' + f.n + '　Lv' + s.lv + (s.lv >= f.max && s.form < 3 ? '（可以進化）' : '') + '</div>'
      + '<div style="height:8px;border-radius:4px;background:#1f2937;overflow:hidden;margin-top:4px"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#b45309,#fbbf24)"></div></div>'
      + '<div class="text-xs text-slate-400 mt-1">' + (s.lv >= 100 ? '已經滿級' : '成長經驗 ' + Math.floor(s.exp).toLocaleString() + '／' + need(s.lv).toLocaleString()) + (equipped(p) ? '' : '　<span class="text-rose-300">（沒裝在聖物格，不會成長）</span>') + '</div></div></div>'
      + '<div class="text-sm mt-2">目前：' + esc(fxText(o)) + '</div>'
      + (nx ? '<div class="text-xs text-slate-400 mt-1">進化後（Lv' + (FORM[s.form].max + 1) + '）：' + esc(fxText(nx)) + '</div>' : '')
      + (s.form < 3 ? '<div class="mt-2">' + btn('evolve', '進化成「' + FORM[s.form + 1].n + '」', s.lv >= f.max) + '</div>' : '')
      + '<div class="text-xs text-slate-300 mt-2">成長經驗：打倒怪物＝怪物等級（頭目 ×' + BOSS_X + '）。里程碑：新手任務 ' + (m.novice ? '✅' : '⬜') + '、職業試煉 ' + m.trial + ' 個、劇情 ' + m.story + ' 章、精通任務 ' + (m.mastery ? '✅' : '⬜') + '、冒險者等級 ' + m.rank + ' 級、地區霸主首殺 ' + m.region + ' 個地區、世界事件今天 ' + (s.weDay === today() ? s.weToday : 0) + '／' + MS.eventDay + ' 次。</div>'
      + '</div>';
    return h;
  };
  var paint = function () {
    var p = P(), host = document.getElementById('interaction-content'); if (!p || !host || !on(p)) return;
    var old = host.querySelector('#afk-scarab-box'); if (old) old.remove();
    checkMs(p);
    var wrap = document.createElement('div'); wrap.innerHTML = section(p); var box = wrap.firstChild; host.appendChild(box);
    box.querySelectorAll('[data-afk-sc]').forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-afk-sc'); if (a === 'claim') claim(); else if (a === 'evolve') evolve(); paint(); }; });
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) { var r = oNpc.apply(this, arguments); try { if (npcId === NPC_ID) paint(); } catch (e) { console.warn('[AFK-scarab]', e); } return r; };
  }
  W.__afkScarab = { ID: ID, FORM: FORM, MS: MS, K: K, POW: POW, BOSS_X: BOSS_X, need: need, fx: fx, fxText: fxText, store: store, owns: owns, equipped: equipped, claim: claim, evolve: evolve, addExp: addExp, msTotal: msTotal, checkMs: checkMs, sync: sync, paint: paint };
})();
