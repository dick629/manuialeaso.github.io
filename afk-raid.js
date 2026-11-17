/* ============================================================================
 * afk-raid.js — 多人討伐（非同步三人一隊；Ping 11-17 04:19）
 *
 *   奇岩村「次元討伐隊長 薇拉」：每期（台灣時間每天 20:00～隔天 20:00）每個角色可以進場一次（Lv80 以上、要連得上旅人伺服器）。
 *   進場順序每 3 人一隊：先進的人打完、後進的人看得到他；每個人都在自己的畫面裡「跟隊友一起打」。
 *   戰場：討伐的戰場，只有一隻「次元的吞噬者」（打不死）；打 5 分鐘，記你這一場打掉的血量（傭兵、召喚物都算）。
 *   時間到、你倒下或離開戰場就結束，自動把傷害回報伺服器。
 *   每天 20:00 結算：同一隊三人的傷害加總 → 獎勵等級 1～5（同隊每人一樣）；回來找薇拉領。
 *     等級門檻（隊伍總傷害）：1 億／10 億／50 億／200 億／1,000 億
 *     獎勵：血龍鑽 300／800／1,500／3,000／5,000，龍之鑽石 50／150／300／600／1,000
 *   伺服器：backend/heartbeat/raid.mjs（/raid/enter、/raid/report、/raid/status、/raid/claim）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, L = W.__afkLore, K = W.__afkNpcKit;
  if (!L || !K || typeof DB === 'undefined') return;
  var MAP = 'afk_raid', MAP_N = '討伐的戰場', TOWN = 'town_giran', NPC_ID = 'afk_npc_raid', NPC_N = '次元討伐隊長 薇拉';
  var BOSS = 'afk_raid_boss', BOSS_N = '次元的吞噬者', PROTO = '巴風特';
  var LV_MIN = 80, FIGHT_MS = 5 * 60 * 1000;
  var TIERS = [1e8, 1e9, 5e9, 2e10, 1e11];
  var REWARD = [null, { bd: 300, dia: 50 }, { bd: 800, dia: 150 }, { bd: 1500, dia: 300 }, { bd: 3000, dia: 600 }, { bd: 5000, dia: 1000 }];
  var CLSN = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士' };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = K.esc, sys = L.sys, clog = L.clog;
  var fmt = function (n) { return Math.floor(Number(n) || 0).toLocaleString(); };
  var big = function (n) { n = Number(n) || 0; return n >= 1e8 ? (Math.floor(n / 1e6) / 100) + ' 億' : n >= 1e4 ? (Math.floor(n / 100) / 100) + ' 萬' : fmt(n); };
  var mmss = function (ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s %= 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; };
  var HB = function () { return W.AFK_HEARTBEAT && W.AFK_HEARTBEAT.api && W.AFK_HEARTBEAT.api() ? W.AFK_HEARTBEAT : null; };
  var req = function (path, extra) {
    var H = HB(); if (!H) return Promise.reject(new Error('旅人伺服器還沒開通，暫時不能參加多人討伐。'));
    return H.ensureId().then(function (id) {
      return fetch(H.api() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: id.uid, token: id.token }, extra || {})) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 404 && !d.error) throw new Error('伺服器還沒更新到有多人討伐，請告訴管理員。');
        if (!r.ok) { var e = new Error(d.error || ('連線失敗（' + r.status + '）')); e.status = r.status; throw e; }
        return d;
      });
    });
  };

  // ── 頭目與地圖 ──
  var protoId = function () { for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === PROTO) return k; return null; };
  (function () {
    var pk = protoId(), base = pk ? JSON.parse(JSON.stringify(DB.mobs[pk])) : {};
    ['n', 'afkTtmi', 'hard', 'img', 'transformTo', 'regenHp', 'regenFix', 'regenEvery'].forEach(function (k) { delete base[k]; });
    L.addMob(BOSS, Object.assign(base, { n: BOSS_N, boss: true, s: 'L', race: '惡魔', e: 'none', lv: 100, hp: 2e12, ac: -80, mr: 100, exp: 0, goldMin: 0, goldMax: 0, noGold: true, beh: '主動', afkRaid: true }), PROTO);
    try { var alias = (0, eval)('MOB_ANIM_ALIAS'), names = (0, eval)('MOB_ANIM_NAMES'); if (alias) alias[BOSS_N] = PROTO; if (names && names.add) names.add(BOSS_N); } catch (e) {}
    if (pk && DB.mobs[pk].img) DB.mobs[BOSS].img = DB.mobs[pk].img;
    DB.maps[MAP] = [BOSS];
    try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
    try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/rift_endless.jpg'; } catch (e) {}
    try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = MAP_N; } catch (e) {}
    try { if (typeof MAP_DESC !== 'undefined') MAP_DESC[MAP] = '次元的裂口在這裡張開。吞噬者打不死，只能在時間內盡量削下牠的力量。'; } catch (e) {}
  })();
  var here = function () { return typeof mapState !== 'undefined' && mapState.current === MAP; };

  // ── 這一場（存在角色上，重新整理也還在）──
  var store = function () { var p = P(); if (!p) return null; if (!p.afkRaid || typeof p.afkRaid !== 'object') p.afkRaid = {}; return p.afkRaid; };
  var run = function () { var s = store(); return s && s.run && !s.run.done ? s.run : null; };
  var bosses = function () { return (mapState.mobs || []).filter(function (m) { return m && m.afkRaid; }); };
  var dealt = function () { return bosses().reduce(function (s, m) { return s + Math.max(0, (Number(m.hp) || 0) - Math.max(0, Number(m.curHp) || 0)); }, 0); };

  var showBattle = function () {
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
  };
  var placeBoss = function () {
    var p = P(), base = JSON.parse(JSON.stringify(DB.mobs[BOSS])), lv = Math.max(LV_MIN, Number(p && p.lv) || LV_MIN), k = lv / 100;
    base.lv = lv;
    if (Array.isArray(base.dmg)) base.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k * 1.2))];
    base.hit = Math.round((base.hit || 60) * k * 1.2); base.db = Math.round((base.db || 0) * k);
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    L.boss.place(2, base, { mobId: BOSS, afkRaid: true });
    try { mapState.targetIdx = 2; } catch (e) {}
  };
  var enter = function (info) {
    var p = P(), s = store(); if (!p || !s) return;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeTownFloatWindow === 'function') closeTownFloatWindow(); } catch (e) {}
    s.run = { cycle: info.cycle, party: info.party, seat: info.seat, members: info.members || [], start: Date.now(), until: Date.now() + FIGHT_MS, dmg: 0, done: false };
    mapState.current = MAP; p.lastBattleMap = MAP; mapState.forceBoss = false;
    placeBoss();
    sys('<span class="font-bold" style="color:#c4b5fd">⚔️ 多人討伐開始！第 ' + info.party + ' 隊。5 分鐘內盡量削下「' + BOSS_N + '」的力量，隊友的傷害會一起算。</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    showBattle(); hud();
  };
  var finish = function (why) {
    var r = run(); if (!r) return;
    if (here()) r.dmg = Math.max(r.dmg || 0, dealt());
    r.done = true; r.why = why;
    var p = P(), s = store();
    sys('<span class="font-bold" style="color:#c4b5fd">⚔️ 討伐結束（' + (why === 'time' ? '時間到' : why === 'dead' ? '你倒下了' : '離開戰場') + '）：你削下了 ' + big(r.dmg) + '。正在回報給討伐隊……</span>');
    report(r);
    if (here()) { try { if (p && !p.dead) { setMapSelectors(TOWN); changeMap(true); } } catch (e) {} }
    hud(); try { saveGame(); } catch (e) {}
  };
  var report = function (r) {
    if (r.reported) return;
    req('/raid/report', { cycle: r.cycle, dmg: Math.floor(r.dmg || 0) }).then(function () {
      r.reported = true; sys('<span style="color:#c4b5fd">傷害已回報。今天 20:00 結算後，回奇岩找薇拉領獎勵。</span>'); try { saveGame(); } catch (e) {}
    }).catch(function (e) {
      if (e.status === 409) { r.reported = true; return; }
      if (e.status === 410) { r.reported = true; sys('<span class="text-rose-300">回報失敗：' + esc(e.message) + '</span>'); return; }
      sys('<span class="text-rose-300">回報失敗（' + esc(e.message) + '），稍後會自動再試。</span>');
    });
  };
  // 沒回報成功的，之後再試
  setInterval(function () { try { var s = store(); if (s && s.run && s.run.done && !s.run.reported && Date.now() - s.run.start < 30 * 60000) report(s.run); } catch (e) {} }, 60000);

  // ── 戰鬥中 ──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) { if (here()) return; return oSpawn.apply(this, arguments); };   // 戰場只有一隻吞噬者
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  var lastFlavor = 0;
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r0 = oTick.apply(this, arguments);
      try {
        var r = run(), p = P();
        if (r && p) {
          if (!here()) finish('leave');
          else {
            if (!bosses().some(function (m) { return !m._dead && m.curHp > 0; })) { r.dmg = Math.max(r.dmg || 0, dealt()); placeBoss(); }
            r.dmg = Math.max(r.dmg || 0, dealt());
            if (p.dead) finish('dead');
            else if (Date.now() >= r.until) finish('time');
            else if (Date.now() - lastFlavor > 12000) { lastFlavor = Date.now(); flavor(r); }
          }
        }
        if (Date.now() - (hud.at || 0) > 1000) hud();
      } catch (e) {}
      return r0;
    };
  }
  var mates = function (r) { return (r.members || []).filter(function (m) { return !m.me; }); };
  var flavor = function (r) {
    var ms = mates(r); if (!ms.length) return;
    var m = ms[Math.floor(Math.random() * ms.length)];
    var acts = ['衝上前斬了吞噬者一刀', '放出一道強力魔法', '替隊伍擋下吞噬者的重擊', '對吞噬者的弱點連續猛攻', '高喊「再撐一下！」'];
    clog('<span style="color:#a5b4fc">【隊友】' + esc(m.name) + '（' + esc(CLSN[m.cls] || m.cls) + ' Lv' + esc(m.lv) + '）' + acts[Math.floor(Math.random() * acts.length)] + '。</span>');
  };
  // 畫面右上：隊伍與傷害
  var hud = function () {
    hud.at = Date.now();
    var box = document.getElementById('afk-raid-hud'), r = run();
    if (!r || !here()) { if (box) box.remove(); return; }
    var bv = document.getElementById('battle-view'); if (!bv) return;
    if (!box) { box = document.createElement('div'); box.id = 'afk-raid-hud'; box.style.cssText = 'position:absolute;top:8px;right:8px;z-index:30;min-width:200px;max-width:46%;background:rgba(15,10,30,.82);border:1px solid #7c3aed;border-radius:10px;padding:8px 10px;color:#e2e8f0;font-size:13px;line-height:1.5;pointer-events:none'; if (getComputedStyle(bv).position === 'static') bv.style.position = 'relative'; bv.appendChild(box); }
    var el = Math.min(1, (Date.now() - r.start) / FIGHT_MS), rows = [], seats = [0, 1, 2];
    var bySeat = {}; (r.members || []).forEach(function (m) { bySeat[m.seat] = m; });
    seats.forEach(function (i) {
      var m = bySeat[i];
      if (!m) { rows.push('<div style="color:#94a3b8">○ 等待之後進場的旅人</div>'); return; }
      var d = m.me ? r.dmg : (m.dmg != null ? m.dmg * el : null);
      rows.push('<div>' + (m.me ? '★ ' : '● ') + '<b style="color:' + (m.me ? '#fde68a' : '#c4b5fd') + '">' + esc(m.me ? '你' : m.name) + '</b> <span style="color:#94a3b8">' + esc(CLSN[m.cls] || '') + ' Lv' + esc(m.lv) + '</span><span style="float:right;margin-left:10px">' + (d == null ? '奮戰中' : big(d)) + '</span></div>');
    });
    box.innerHTML = '<div style="color:#c4b5fd;font-weight:700">⚔️ 多人討伐・第 ' + esc(r.party) + ' 隊 <span style="float:right;color:#fde68a">' + mmss(r.until - Date.now()) + '</span></div>' + rows.join('');
  };
  // 重新整理：還在戰場上就把這一場結算掉（打掉的血量以存檔裡記的為準）
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () {
      var r0 = oLoad.apply(this, arguments);
      try { var r = run(); if (r) setTimeout(function () { finish(Date.now() >= r.until ? 'time' : 'leave'); }, 500); else if (here()) { setMapSelectors(TOWN); changeMap(true); } } catch (e) {}
      return r0;
    };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }

  // ── 薇拉的視窗 ──
  var st = { data: null, err: '', busy: false };
  var tierTxt = function (t) { var R = REWARD[t]; return t ? '等級 ' + t + '（血龍鑽 ' + fmt(R.bd) + '、龍之鑽石 ' + fmt(R.dia) + '）' : '沒有達到獎勵門檻'; };
  var grant = function (t) {
    var R = REWARD[t]; if (!R) return;
    try { gainItem('afk_blood_dia', R.bd, true, true); } catch (e) {}
    try { if (typeof W.pandoraAdjustSharedDiamonds === 'function') W.pandoraAdjustSharedDiamonds(R.dia); } catch (e) {}
    sys('<span class="font-bold" style="color:#fde68a">🎁 多人討伐獎勵 ' + tierTxt(t) + '</span>');
    try { saveGame(); } catch (e) {}
  };
  var refresh = function (div) {
    st.busy = true; paint(div);
    req('/raid/status').then(function (d) { st.data = d; st.err = ''; }).catch(function (e) { st.err = e.message; }).then(function () { st.busy = false; paint(div); });
  };
  var memberRows = function (ms) {
    return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + [0, 1, 2].map(function (i) {
      var m = (ms || []).find(function (x) { return x.seat === i; });
      return '<tr style="border-bottom:1px solid #334155"><td style="padding:3px 4px">' + (i + 1) + '</td><td>' + (m ? (m.me ? '<b style="color:#fde68a">你</b>' : esc(m.name)) + ' <span style="color:#94a3b8">' + esc(CLSN[m.cls] || '') + ' Lv' + esc(m.lv) + '</span>' : '<span style="color:#94a3b8">還沒有人</span>') + '</td><td style="text-align:right">' + (m ? (m.dmg == null ? '<span style="color:#94a3b8">打完還沒回報</span>' : big(m.dmg)) : '') + '</td></tr>';
    }).join('') + '</table>';
  };
  var paint = function (div) {
    if (!div) return; K.css();
    var p = P(), d = st.data, h = '<div class="afk-ax"><p class="ax-lore">「次元的吞噬者打不死。我們能做的，就是輪流上去，把牠的力量一點一點削下來。」</p>';
    h += '<div class="ax-h">規則</div><ul style="margin:0 0 6px;padding-left:18px;font-size:13px">'
      + '<li>每天 20:00 到隔天 20:00 是一期，每期每個角色進場一次（Lv' + LV_MIN + ' 以上）。</li>'
      + '<li>照進場順序每 3 人一隊：先打完的隊友，你會看到他的傷害；之後進場的隊友，也會看到你。</li>'
      + '<li>每場 5 分鐘，記你這一場削下的血量（傭兵、召喚物都算）。倒下或離開戰場就提早結束。</li>'
      + '<li>20:00 結算：全隊傷害加總，到 1 億／10 億／50 億／200 億／1,000 億＝獎勵等級 1～5，同隊每人拿一樣的獎勵。</li></ul>';
    if (st.err) h += '<p style="color:#fca5a5">' + esc(st.err) + '</p>';
    if (st.busy && !d) h += '<p>讀取中……</p>';
    if (d) {
      var left = d.endsAt - d.serverTime;
      h += '<div class="ax-h">這一期（' + esc(d.cycle) + '，距離結算 ' + Math.floor(left / 3600000) + ' 小時 ' + Math.floor(left % 3600000 / 60000) + ' 分）</div>';
      if (d.entered) h += '<p>你在第 <b>' + d.party + '</b> 隊。</p>' + memberRows(d.members);
      else {
        var why = !p ? '請先進入遊戲。' : (Number(p.lv) || 1) < LV_MIN ? '需要 Lv' + LV_MIN + '。' : p.classicMode ? '經典模式不能參加。' : p.dead ? '先復活再進場。' : run() ? '你正在戰場上。' : '';
        h += '<p>' + (d.waiting ? '目前有一隊還差 ' + (3 - d.waiting) + ' 人，你進場會加入那一隊。' : '你進場會開一支新隊伍。') + '</p>'
          + '<p><button type="button" data-raid="enter"' + (why || st.busy ? ' disabled' : '') + '>⚔️ 進場討伐</button>' + (why ? ' <span style="color:#fca5a5">' + esc(why) + '</span>' : '') + '</p>';
      }
      if (d.last) {
        h += '<div class="ax-h">上一期（' + esc(d.last.cycle) + '）</div>' + memberRows(d.last.members) + '<p>全隊合計 <b>' + big(d.last.total) + '</b>：' + (d.last.reported ? tierTxt(d.last.tier) : '你那一次沒有回報傷害，沒有獎勵') + '</p>';
        if (d.last.reported && d.last.tier && !d.last.claimed) h += '<p><button type="button" data-raid="claim" data-cycle="' + esc(d.last.cycle) + '"' + (st.busy ? ' disabled' : '') + '>🎁 領取獎勵</button></p>';
        else if (d.last.claimed) h += '<p style="color:#94a3b8">已經領過了。</p>';
      }
    }
    h += '<p><button type="button" data-raid="refresh"' + (st.busy ? ' disabled' : '') + '>重新整理</button></p></div>';
    div.innerHTML = h;
    div.onclick = function (e) {
      var b = e.target.closest('[data-raid]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-raid'), p = P();
      if (a === 'refresh') refresh(div);
      else if (a === 'enter') {
        if (!p) return;
        if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return;
        st.busy = true; paint(div);
        req('/raid/enter', { name: String(p.name || '旅人').slice(0, 12), cls: CLSN[p.cls] ? p.cls : 'knight', lv: Math.max(1, Math.min(999, Math.floor(Number(p.lv) || 1))) })
          .then(function (info) { st.busy = false; enter(info); })
          .catch(function (er) { st.busy = false; st.err = er.message; paint(div); });
      } else if (a === 'claim') {
        st.busy = true; paint(div);
        req('/raid/claim', { cycle: b.getAttribute('data-cycle') }).then(function (r) { grant(r.tier); }).catch(function (er) { st.err = er.message; }).then(function () { st.busy = false; refresh(div); });
      }
    };
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: '多人討伐', type: 'quest', classicHide: true, d: '帶著次元討伐隊的女騎士。她把每天輪流上陣的冒險者編成三人一隊。' });
  // 11-17（Ping）：多人討伐先暫停，NPC 只顯示建設中（規劃好再打開：BUILDING 改 false）
  var BUILDING = true;
  K.hookNpc(NPC_ID, NPC_N, '多人討伐', function (div) {
    if (BUILDING) { if (div) { K.css(); div.innerHTML = '<div class="afk-ax"><p class="ax-lore">「次元討伐隊還在整編，等人手到齊再找你。」</p><p style="font-size:15px;color:#fde68a;margin-top:10px">🚧 多人討伐建設中，敬請期待。</p></div>'; } return; }
    st.err = ''; paint(div); refresh(div);
  });
  W.__afkRaid = { enter: enter, finish: finish, run: run, TIERS: TIERS, REWARD: REWARD, MAP: MAP, BOSS: BOSS };
  try { console.log('[AFK-raid] 已啟用：多人討伐（奇岩 次元討伐隊長 薇拉）'); } catch (e) {}
})();
