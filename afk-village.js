/* ============================================================================
 * afk-village.js — 村長與地區聲望（玩家 2026-11-02 18:08 提出、18:24 確認；外掛開關 village，預設開；經典模式沒有）
 *
 *   地區：跟地區霸主一樣的 15 個地區。每個地區各自的聲望，上限 1000。
 *   累積：在該地區（野外、地監、傲慢之塔；城鎮、副本、時空裂痕、攻城、木人場不算）打倒 1,000 隻怪 +1；
 *         打倒 200 隻該地區的地區霸主 +1。你和傭兵打倒的都算，離線補跑也算。
 *   下降：連續 4 小時沒有在該地區打怪，−5；之後每 4 小時再 −5，最低 0（離線的時間也算）。村長地區不會下降（2026-11-03）。
 *   村長：聲望最高的地區（> 0；同分維持原本的村長地區）。
 *     在村長地區：對一般怪物的傷害 +20%（全隊）；出怪變慢（出怪等待時間 ×2）；商店再打 5 折（攻城勝利 8 折之後）。
 *   懸殊：（村長地區聲望 − 這個地區聲望）÷ 1000，每 10% 一級，最多 50%：
 *     一般怪物的 HP、傷害、命中、魔防各 +10%／級；地區霸主出現率 +5 個百分點／級（afk-region-boss 問 __afkRbRateAdd）。
 *   王都傳令 米恩：每個村莊一位，看聲望。收藏 → 特殊收藏也有一節「地區聲望」（不算進特殊收藏的完成度）。
 *
 *   隱藏稱號（隱藏規則，開關 hiddenbonus；不寫進小百科）：W.__afkTitles
 *     政治手腕：血盟持有七座城＋你有村長地區；知曉歷史：特殊收藏的劇情與職業試煉全部完成（轉生後重置的任務也要再做完）；
 *     轉生者：轉生過。每個稱號在亞丁城多招 1 名聖十字近衛（未融合）；三個都有 → 這 3 名可以融合成 1 名聖十字禁衛軍
 *     （afk-castle-guards 的 hidden 名冊）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'village', name: '村長與地區聲望', group: '遊戲內容', seal: true,
    desc: '在各地區打怪、打地區霸主累積聲望（上限 1000）；聲望最高的地區是你的村長地區（對一般怪 +20%、出怪變慢、商店 5 折）；其他地區聲望落後越多，怪越強、霸主越常出現。各村莊的王都傳令 米恩可以查看。' });
  var on = function () { return !T || T.enabled('village'); };
  var hidden = function () { return !T || T.enabled('hiddenbonus'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function (p) { p = p || P(); return !!(p && p.classicMode); };
  var act = function () { var p = P(); return on() && !!p && !classic(p); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function') return false; var o = W[name]; W[name] = mk(o); try { (0, eval)(name + ' = window.' + name); } catch (e) {} return true; };
  var logSys = function (h) { try { if (typeof W.logSys === 'function') W.logSys(h); else if (typeof W.logCombat === 'function') W.logCombat(h, 'sys'); } catch (e) {} };

  var CFG = { cap: 1000, killPer: 1000, bossPer: 200, decayMs: 4 * 3600 * 1000, decay: 5, step: 0.10, gapMax: 0.50, chiefDmg: 0.20, spawnSlow: 2, shop: 0.5, rbPerStep: 0.05 };
  var RB = function () { return W.__afkRegionBoss || null; };
  var LABEL = {}; try { (MAP_REGIONS || []).forEach(function (r) { LABEL[r.key] = r.label; }); } catch (e) {}
  LABEL.tower = LABEL.tower || '傲慢之塔'; LABEL.rastabad = LABEL.rastabad || '拉斯塔巴德';
  var KEYS = (function () {
    var b = RB(); if (b && b.LIST) return b.LIST.map(function (x) { return x.r; });
    return ['silverknight', 'fairyforest', 'talkingisland', 'burningwillow', 'gludin', 'kent', 'windwood', 'heine', 'giran', 'dragonvalley', 'witon', 'oren', 'aden', 'tower', 'rastabad'];
  })();
  var labelOf = function (k) { var b = RB(); if (b && b.BY && b.BY[k] && b.BY[k].label) return b.BY[k].label; return LABEL[k] || k; };

  // ── 這張地圖算哪個地區（不算的回 null）──
  var huntRegion = function (mapId) {
    if (!mapId) return null;
    var b = RB();
    if (b && b.okMap && b.regionOf) { try { return b.okMap(mapId) ? b.regionOf(mapId) : null; } catch (e) { return null; } }
    if (/^town_|^afk_|^rift|training/.test(mapId)) return null;
    try { var k = typeof mapRegionOf === 'function' ? mapRegionOf(mapId) : null; return KEYS.indexOf(k) >= 0 ? k : null; } catch (e) { return null; }
  };
  var placeRegion = function (mapId) {   // 商店與出怪看的「你在哪個地區」（城鎮也算）
    try { var k = typeof mapRegionOf === 'function' ? mapRegionOf(mapId) : null; return KEYS.indexOf(k) >= 0 ? k : null; } catch (e) { return null; }
  };
  var curMap = function () { return (typeof mapState !== 'undefined' && mapState) ? mapState.current : null; };

  // ── 存檔（角色上）──
  var store = function (p) {
    p = p || P(); if (!p) return { r: {}, chief: null };
    if (!p.afkVil || typeof p.afkVil !== 'object') p.afkVil = { r: {}, chief: null };
    if (!p.afkVil.r || typeof p.afkVil.r !== 'object') p.afkVil.r = {};
    return p.afkVil;
  };
  var reg = function (k, p) { var s = store(p).r; return s[k] || (s[k] = { rep: 0, k: 0, b: 0, last: 0, dec: 0 }); };
  var repOf = function (k, p) { var s = store(p).r[k]; return s ? Math.max(0, Math.min(CFG.cap, Number(s.rep) || 0)) : 0; };

  // 村長：聲望最高的地區（> 0），同分維持原本的
  var chiefOf = function (p) {
    var s = store(p), best = null, bv = 0;
    KEYS.forEach(function (k) { var v = repOf(k, p); if (v > bv) { bv = v; best = k; } });
    if (best && s.chief && s.chief !== best && repOf(s.chief, p) >= bv) best = s.chief;
    return best;
  };
  var syncChief = function (quiet) {
    var p = P(); if (!p) return null;
    var s = store(p), c = chiefOf(p);
    if (c !== s.chief) {
      var old = s.chief; s.chief = c;
      if (!quiet && c) logSys('<span class="font-bold" style="color:#fcd34d">🏘 ' + esc(labelOf(c)) + '的居民推舉你為村長！</span>' + (old ? '（原本是' + esc(labelOf(old)) + '）' : ''));
    }
    return c;
  };
  var gapOf = function (k, p) {
    var c = chiefOf(p); if (!c || c === k) return 0;
    var g = (repOf(c, p) - repOf(k, p)) / CFG.cap;
    return Math.max(0, Math.min(CFG.gapMax, Math.floor(g * 10 + 1e-9) / 10));
  };

  // ── 村長俸祿（玩家 2026-11-03 04:25）：當村長期間每 5 小時（現實時間）給龍之鑽石 1,000，離線也算；一次最多補 7 天 ──
  var STIPEND = { every: 5 * 3600 * 1000, dia: 1000, maxN: 34 };
  var stipend = function (now) {
    var p = P(); if (!p || classic(p) || !on()) return;
    now = now || Date.now();
    var s = store(p);
    if (!s.chief) { s.stipAt = null; return; }
    if (!s.stipAt) { s.stipAt = now; return; }
    var n = Math.floor((now - s.stipAt) / STIPEND.every); if (n <= 0) return;
    var give = Math.min(n, STIPEND.maxN) * STIPEND.dia, ok = false;
    try { ok = !!(W.pandoraAdjustSharedDiamonds(give) || {}).ok; } catch (e) {}
    if (!ok) return;
    s.stipAt += n * STIPEND.every;
    try { if (typeof logSys === 'function') logSys('<span class="text-amber-300 font-bold">王都送來村長的俸祿：龍之鑽石 ' + give.toLocaleString() + '。</span>'); } catch (e) {}
    try { saveGame(); } catch (e) {}
  };

  // ── 下降：連續 4 小時沒打 −5 ──
  var decayAll = function (now) {
    var p = P(); if (!p) return;
    now = now || Date.now(); var changed = false;
    var chief = store(p).chief;
    KEYS.forEach(function (k) {
      var s = store(p).r[k]; if (!s || !(s.rep > 0)) return;
      if (k === chief) { s.dec = now; return; }   // 2026-11-03：村長地區的聲望不會下降（之後不是村長了，從那時起重新計 4 小時）
      var anchor = Math.max(Number(s.last) || 0, Number(s.dec) || 0); if (!anchor) { s.dec = now; return; }
      var n = Math.floor((now - anchor) / CFG.decayMs); if (n <= 0) return;
      s.rep = Math.max(0, (Number(s.rep) || 0) - CFG.decay * n); s.dec = anchor + n * CFG.decayMs; changed = true;
    });
    if (changed) syncChief(false);
  };

  // ── 打倒怪物 ──
  var onKill = function (m) {
    if (!act() || !m) return;
    var k = huntRegion(curMap()); if (!k) return;
    var s = reg(k), now = Date.now();
    s.last = now;
    if (m._rbBoss && m._afkRb === k && !m._rbSwarmCopy) { s.b = (Number(s.b) || 0) + 1; while (s.b >= CFG.bossPer) { s.b -= CFG.bossPer; if (s.rep < CFG.cap) s.rep++; } }
    else if (!m._rbBoss) { s.k = (Number(s.k) || 0) + 1; while (s.k >= CFG.killPer) { s.k -= CFG.killPer; if (s.rep < CFG.cap) s.rep++; } }
    syncChief(false);
  };
  (function () { var X = W.__afkProc; if (X && X.on) X.on('kill', onKill); })();

  var chiefHere = function () { var p = P(); if (!act()) return false; var c = store(p).chief; return !!(c && placeRegion(curMap()) === c); };

  // ── 村長：對一般怪 +20% ──
  var hooked = false, hookC = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { if (v > 0 && target && !target.boss && actor && actor.cls && !(opt && (opt.reflection || opt.redirected)) && chiefHere()) v = Math.floor(v * (1 + CFG.chiefDmg)); } catch (e) {}
      return v;
    };
  };
  hookC(); W.addEventListener('load', hookC);
  // ── 村長：出怪變慢（等待時間 ×2；核心補丁讀 window.__afkSpawnDelayAdj）──
  (function () {
    var o = W.__afkSpawnDelayAdj;
    W.__afkSpawnDelayAdj = function (d) { var v = typeof o === 'function' ? o(d) : d; try { if (chiefHere()) v = Math.round(v * CFG.spawnSlow); } catch (e) {} return v; };
  })();
  // ── 村長：商店再 5 折 ──
  wrapG('shopPrice', function (o) { return function (base) { var v = o.apply(this, arguments); try { if (chiefHere()) v = Math.floor(v * CFG.shop); } catch (e) {} return v; }; });
  // ── 懸殊：地區霸主出現率 ──
  W.__afkRbRateAdd = function (r) { if (!act()) return 0; var g = gapOf(r); return g > 0 ? Math.round(g * 10) * CFG.rbPerStep : 0; };
  // ── 懸殊：一般怪 HP、傷害、命中、魔防 ──
  var gapHere = function () { if (!act()) return 0; var k = huntRegion(curMap()); return k ? gapOf(k) : 0; };
  var scaleMob = function (m, f) {
    if (!m || m.boss || m._train || !(Number(m.hp) > 0)) return;
    var f0 = Number(m._afkVilF) || 1; if (Math.abs(f0 - f) < 1e-9) return;
    var hp0 = Number(m.hp), cur = Number(m.curHp) || 0, nh = Math.max(1, Math.round(hp0 / f0 * f));
    m.hp = nh; if (cur > 0) m.curHp = Math.max(1, Math.min(nh, Math.round(cur / hp0 * nh)));
    ['hit', 'mr'].forEach(function (key) { if (typeof m[key] === 'number') m[key] = Math.round(m[key] / f0 * f); });
    m._afkVilF = f;
  };
  var lastDecay = 0;
  wrapG('tick', function (o) {
    return function () {
      var r = o.apply(this, arguments);
      try {
        if (!act()) return r;
        var now = Date.now(); if (now - lastDecay > 60000) { lastDecay = now; decayAll(now); stipend(now); }
        if (typeof mapState === 'undefined' || !mapState || !mapState.mobs) return r;
        var f = 1 + gapHere();
        for (var i = 0; i < mapState.mobs.length; i++) { var m = mapState.mobs[i]; if (m && !m._dead && m.curHp > 0) scaleMob(m, f); }
      } catch (e) {}
      return r;
    };
  });
  if (typeof W.__afkTaken === 'function') {
    var oT = W.__afkTaken;
    W.__afkTaken = function (ent, dmg, mob, kind) {
      var v = oT.apply(this, arguments);
      try { if (v > 0 && mob && !mob.boss && act()) { var f = Number(mob._afkVilF) || 1; if (f > 1) v = v * f; } } catch (e) {}
      return v;
    };
  }

  // ── 隱藏稱號（隱藏規則）──
  var TITLES = [
    { id: 'politics', n: '政治手腕', c: '#fcd34d' },
    { id: 'history', n: '知曉歷史', c: '#93c5fd' },
    { id: 'reborn', n: '轉生者', c: '#f0abfc' }
  ];
  var heldN = function () { try { var c = W.__afkCastleWar; return c && c.held ? c.held().length : 0; } catch (e) { return 0; } };
  var historyDone = function (p) {
    var SC = W.__afkSpecialCollection; if (!SC || !SC.progress) return false;
    var pr = SC.progress(p), st = pr.find(function (x) { return x.k === 'story'; }), q = pr.find(function (x) { return x.k === 'quest'; });
    return !!(st && q && st.b > 0 && q.b > 0 && st.a >= st.b && q.a >= q.b);
  };
  var has = function (id, p) {
    p = p || P(); if (!p || classic(p)) return false;
    if (id === 'reborn') return Number(p.rebirth) > 0;
    if (id === 'politics') return on() && heldN() >= 7 && !!chiefOf(p);
    if (id === 'history') { try { return historyDone(p); } catch (e) { return false; } }
    return false;
  };
  var titleList = function (p) { return TITLES.filter(function (t) { return has(t.id, p); }); };
  W.__afkTitles = {
    TITLES: TITLES, has: has, list: titleList,
    guardCount: function (p) { return hidden() ? titleList(p).length : 0; }   // 亞丁城多招的聖十字近衛（隱藏規則）
  };

  // ── 王都傳令 米恩（每個村莊）──
  var NPC_ID = 'npc_afk_mien', NPC_N = '米恩', NPC_T = '王都傳令';
  var css = function () {
    if (document.getElementById('afk-vil-css')) return;
    var st = document.createElement('style'); st.id = 'afk-vil-css';
    st.textContent = '.afk-vil{font-size:14px;color:#e2e8f0}.afk-vil .vn{color:#a39a8e;font-size:12.5px;margin:4px 0 8px;line-height:1.5}'
      + '.afk-vil table{width:100%;border-collapse:collapse}.afk-vil th,.afk-vil td{padding:5px 6px;border-bottom:1px solid #334155;text-align:left;font-variant-numeric:tabular-nums}'
      + '.afk-vil th{color:#fde68a;font-size:12.5px;font-weight:700}.afk-vil tr.chief td{color:#fde68a;background:rgba(234,179,8,.08)}.afk-vil .bar{display:inline-block;width:64px;height:6px;border-radius:3px;background:#334155;overflow:hidden;vertical-align:middle;margin-left:6px}'
      + '.afk-vil .bar i{display:block;height:100%;background:#f59e0b}.afk-vil .gap{color:#fca5a5}.afk-vil .sm{color:#94a3b8;font-size:12px}'
      + '@media (max-width:640px){.afk-vil th.hm,.afk-vil td.hm{display:none}.afk-vil .bar{width:40px}}';
    document.head.appendChild(st);
  };
  var hm = function (ms) { if (!(ms > 0)) return '—'; var h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000); if (m === 60) { h++; m = 0; } return (h ? h + ' 小時 ' : '') + m + ' 分'; };
  var tableHtml = function (p) {
    var s = store(p), c = chiefOf(p), now = Date.now();
    var rows = KEYS.map(function (k) {
      var x = s.r[k] || { rep: 0, k: 0, b: 0 }, rep = repOf(k, p), g = gapOf(k, p), anchor = Math.max(Number(x.last) || 0, Number(x.dec) || 0);
      var next = rep > 0 && anchor ? anchor + CFG.decayMs - now : 0;
      return '<tr class="' + (k === c ? 'chief' : '') + '"><td>' + (k === c ? '🏘 ' : '') + esc(labelOf(k)) + '</td>'
        + '<td>' + rep + '<span class="bar"><i style="width:' + (rep / CFG.cap * 100).toFixed(1) + '%"></i></span></td>'
        + '<td class="hm sm">' + (Number(x.k) || 0) + '／' + CFG.killPer + '・霸主 ' + (Number(x.b) || 0) + '／' + CFG.bossPer + '</td>'
        + '<td class="sm">' + (k === c ? '村長' : g > 0 ? '<span class="gap">懸殊 ' + Math.round(g * 100) + '%：怪 +' + Math.round(g * 100) + '%、霸主 +' + Math.round(g * 10 * CFG.rbPerStep * 100) + '%</span>' : '—') + '</td>'
        + '<td class="hm sm">' + (k === c ? '不會下降' : rep > 0 ? hm(next) : '—') + '</td></tr>';
    }).join('');
    return '<table><thead><tr><th>地區</th><th>聲望</th><th class="hm">下一點</th><th>狀態</th><th class="hm">下次下降</th></tr></thead><tbody>' + rows + '</tbody></table>';
  };
  var noteHtml = function () {
    return '<div class="vn">在地區的野外、地監、傲慢之塔打倒 ' + CFG.killPer.toLocaleString() + ' 隻怪 +1 聲望，打倒 ' + CFG.bossPer + ' 隻該地區的霸主 +1；上限 ' + CFG.cap + '。'
      + '連續 4 小時沒有在那個地區打怪，聲望 −' + CFG.decay + '（之後每 4 小時再 −' + CFG.decay + '）；村長地區的聲望不會下降。<br>'
      + '聲望最高的地區是你的<b>村長地區</b>：對一般怪物的傷害 +20%、出怪變慢、商店再打 5 折；當村長期間每 5 小時（離線也算）王都送來龍之鑽石 ' + STIPEND.dia.toLocaleString() + '。'
      + '其他地區落後村長地區越多（每 10% 一級，最多 50%），那裡的一般怪物 HP、傷害、命中、魔防越高，地區霸主也越常出現。</div>';
  };
  var panel = function (div) {
    if (!div) return; css();
    var p = P();
    if (!p) { div.innerHTML = '<p>請先進入遊戲。</p>'; return; }
    if (classic(p)) { div.innerHTML = '<div class="afk-vil"><div class="vn">「經典模式的世界裡，王都的傳令還沒有來到這裡。」</div></div>'; return; }
    if (!on()) { div.innerHTML = '<div class="afk-vil"><div class="vn">「各地的聲望紀錄暫停中。」</div></div>'; return; }
    decayAll(); syncChief(true);
    var c = store(p).chief;
    var h = '<div class="afk-vil"><div class="vn">「王都要我記下每一位冒險者在各地的名聲。」' + (c ? '目前你是<b style="color:#fde68a">' + esc(labelOf(c)) + '</b>的村長。' : '你還沒有在任何地區累積聲望。') + '</div>'
      + noteHtml() + tableHtml(p);
    div.innerHTML = h + '</div>';
  };
  try {
    var K = W.__afkNpcKit;
    var def = { id: NPC_ID, n: NPC_N, title: NPC_T, type: 'quest', d: '從王都派來的傳令官米恩，記錄每一位冒險者在各地區的聲望，也知道誰是哪個地區的村長。' };
    Object.keys(DB.towns || {}).forEach(function (t) {
      if (/_castle$|^town_rift$|^town_pride$|^town_flame_audience$|^town_elder_council$/.test(t)) return;
      if (K && K.addNpc) K.addNpc(t, def); else { var tw = DB.towns[t]; if (tw && Array.isArray(tw.npcs) && !tw.npcs.some(function (x) { return x.id === NPC_ID; })) tw.npcs.push(def); }
    });
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '914';
    if (K && K.hookNpc) K.hookNpc(NPC_ID, NPC_N, NPC_T, panel);
  } catch (e) { console.warn('[AFK-village] NPC', e); }

  // ── 特殊收藏：地區聲望（不算完成度）──
  wrapG('collectionOpenSpecial', function (o) {
    return function () {
      var r = o.apply(this, arguments);
      try {
        var p = P(), body = document.querySelector('#afk-special-book [data-body]');
        if (p && body && act() && !body.querySelector('#afk-vil-sec')) {
          css(); decayAll(); syncChief(true); stipend();
          var c = store(p).chief, got = KEYS.filter(function (k) { return repOf(k, p) > 0; }).length;
          var d = document.createElement('details'); d.className = 'afk-sc-sec'; d.id = 'afk-vil-sec';
          d.innerHTML = '<summary><b>🏘 地區聲望</b><span class="afk-sc-cnt">' + (c ? '村長：' + esc(labelOf(c)) : got + '／' + KEYS.length + ' 個地區') + '</span></summary>'
            + '<div class="afk-sc-body afk-vil">' + noteHtml() + tableHtml(p) + '</div>';
          body.appendChild(d);
        }
      } catch (e) { console.warn('[AFK-village] collection', e); }
      return r;
    };
  });

  W.__afkVillage = { on: on, CFG: CFG, STIPEND: STIPEND, stipend: stipend, KEYS: KEYS, labelOf: labelOf, store: store, reg: reg, repOf: repOf, chiefOf: chiefOf, syncChief: syncChief, gapOf: gapOf,
    decayAll: decayAll, onKill: onKill, huntRegion: huntRegion, chiefHere: chiefHere, scaleMob: scaleMob, panel: panel, NPC_ID: NPC_ID };
})();
