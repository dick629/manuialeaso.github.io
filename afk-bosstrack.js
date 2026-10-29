/* ============================================================================
 * afk-bosstrack.js — 魔物追蹤 24 小時＋BOSS 追蹤（玩家 2026-10-29）
 *
 *   一、魔物追蹤（城堡的追蹤 NPC 奧貝勒／赫特／帝倫）：效期 8 小時 → 24 小時，費用不變（10 萬金幣）。
 *   二、BOSS 追蹤（同一個 NPC 視窗下方）：指定地圖裡的一隻頭目。
 *       ‧開始：消耗任意 1 件遺物（背包、未上鎖；自動挑最便宜的那件：強化值最低、價格最低），追蹤 8 小時。
 *       ‧延長：每次 +8 小時，消耗的遺物比上一次多 1 件（第 1 次延長 2 件、第 2 次 3 件…），剩餘時間最多 24 小時。
 *       ‧效果：在那張圖、場上沒有這隻頭目時，每次出怪 50% 機率（裝備小獵犬的追蹤鼻 70%）改成這隻頭目；
 *         出場走原本的出王流程（席琳強化、登場衝擊、掉落都照舊）。
 * 紀錄：player.bossTracking = { map, mob, until, ext }
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bosstrack', name: '魔物追蹤 24 小時＋BOSS 追蹤', group: '遊戲玩法',
    desc: '奧貝勒等追蹤 NPC：魔物追蹤效期 8 → 24 小時；新增 BOSS 追蹤（消耗任意遺物追蹤 8 小時，每延長一次多 1 件，最多 24 小時）' });
  if (T && !T.enabled('bosstrack')) return;
  if (typeof W.renderObelNPC !== 'function' || typeof W.spawnMob !== 'function') { console.warn('[AFK-bosstrack] 找不到追蹤 NPC，略過'); return; }

  var H = 3600 * 1000, TRACK_H = 24, BOSS_H = 8, BOSS_MAX_H = 24;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hm = function (ms) { var h = Math.floor(ms / H), m = Math.floor((ms % H) / 60000); return h + ' 時 ' + m + ' 分'; };
  var sel = { map: '', mob: '' };

  // ── 一、魔物追蹤 24 小時 ──
  W.obelStartTracking = function () {
    if (typeof _obelSel === 'undefined' || !_obelSel.mob || !_obelSel.map) return;
    var COST = 100000;
    if ((player.gold || 0) < COST) { alert('金幣不足，追蹤需要 ' + COST.toLocaleString() + ' 金幣。'); return; }
    player.gold -= COST;
    player.tracking = { map: _obelSel.map, mob: _obelSel.mob, until: Date.now() + TRACK_H * H };
    _obelSel = { map: '', mob: '' };
    try { renderTabs(); } catch (e) {} try { saveGame(); } catch (e) {}
    logSys('花費 ' + COST.toLocaleString() + ' 金幣，奧貝勒開始追蹤 <span class="text-amber-300 font-bold">' + esc((DB.mobs[player.tracking.mob] || {}).n) + '</span>，持續 ' + TRACK_H + ' 小時。');
    var el = document.getElementById('interaction-content'); if (el) W.renderObelNPC(el);
    try { updateUI(); } catch (e) {}
  };

  // ── 二、BOSS 追蹤 ──
  var rec = function () { var p = P(); var t = p && p.bossTracking; return t && t.until > Date.now() ? t : null; };
  var bossMaps = function () {
    var list = typeof W.obelMapList === 'function' ? W.obelMapList() : [];
    return list.filter(function (x) { return (DB.maps[x.v] || []).some(function (id) { return DB.mobs[id] && DB.mobs[id].boss; }); });
  };
  var equipped = function (p, uid) { return Object.keys(p.eq || {}).some(function (k) { return p.eq[k] && p.eq[k].uid === uid; }); };
  var relicPool = function () {
    var p = P(); if (!p) return [];
    return (p.inv || []).filter(function (it) { var d = it && DB.items[it.id]; return d && d.relic && !d.gmOnly && !it.lock && !equipped(p, it.uid); })
      .sort(function (a, b) { var da = DB.items[a.id], db = DB.items[b.id]; return ((da.relicPlus || 0) - (db.relicPlus || 0)) || ((Number(da.p) || 0) - (Number(db.p) || 0)); });
  };
  var relicCount = function () { return relicPool().reduce(function (n, it) { return n + (it.cnt || 1); }, 0); };
  var takeRelics = function (n) {
    var p = P(), list = relicPool(), names = [];
    for (var i = 0; i < list.length && n > 0; i++) {
      var it = list[i], k = Math.min(n, it.cnt || 1);
      names.push(DB.items[it.id].n + (k > 1 ? ' ×' + k : ''));
      if ((it.cnt || 1) > k) it.cnt -= k; else p.inv.splice(p.inv.indexOf(it), 1);
      n -= k;
    }
    return names;
  };
  var nextCost = function () { var t = rec(); return t ? (t.ext || 0) + 2 : 1; };
  W.afkBossTrackPick = function (kind, v) { if (kind === 'map') { sel.map = v; sel.mob = ''; } else sel.mob = sel.mob === v ? '' : v; redraw(); };
  W.afkBossTrackStart = function () {
    var p = P(); if (!p || !sel.map || !sel.mob || rec()) return;
    if (relicCount() < 1) { logSys('<span class="text-red-400">BOSS 追蹤要消耗 1 件遺物（背包裡、未上鎖、沒有裝備著的）。</span>'); return; }
    var used = takeRelics(1);
    p.bossTracking = { map: sel.map, mob: sel.mob, until: Date.now() + BOSS_H * H, ext: 0 };
    sel = { map: '', mob: '' };
    logSys('交出 <span class="text-amber-200">' + esc(used.join('、')) + '</span>，奧貝勒開始追蹤頭目 <span class="text-red-300 font-bold">' + esc((DB.mobs[p.bossTracking.mob] || {}).n) + '</span>，持續 ' + BOSS_H + ' 小時。');
    try { saveGame(); } catch (e) {} try { renderTabs(); } catch (e) {}
    redraw();
  };
  W.afkBossTrackExtend = function () {
    var p = P(), t = rec(); if (!p || !t) return;
    if (t.until - Date.now() + BOSS_H * H > BOSS_MAX_H * H + 60000) { logSys('<span class="text-amber-300">BOSS 追蹤最多只能累積 ' + BOSS_MAX_H + ' 小時。</span>'); return; }
    var need = nextCost();
    if (relicCount() < need) { logSys('<span class="text-red-400">延長要消耗 ' + need + ' 件遺物（背包裡、未上鎖、沒有裝備著的）。</span>'); return; }
    var used = takeRelics(need);
    t.until = Math.min(t.until + BOSS_H * H, Date.now() + BOSS_MAX_H * H); t.ext = (t.ext || 0) + 1;
    logSys('交出 <span class="text-amber-200">' + esc(used.join('、')) + '</span>，BOSS 追蹤延長 ' + BOSS_H + ' 小時（剩 ' + hm(t.until - Date.now()) + '）。');
    try { saveGame(); } catch (e) {} try { renderTabs(); } catch (e) {}
    redraw();
  };
  W.afkBossTrackCancel = function () {
    var p = P(); if (!p || !rec()) return;
    if (!confirm('確定要取消 BOSS 追蹤嗎？（交出的遺物不會退還）')) return;
    p.bossTracking = null; try { saveGame(); } catch (e) {}
    logSys('已取消 BOSS 追蹤。'); redraw();
  };
  var redraw = function () { var el = document.getElementById('interaction-content'); if (el) W.renderObelNPC(el); };
  var panel = function () {
    var t = rec(), h = '<div class="mt-3 bg-slate-900/70 border border-red-800 rounded p-3 text-sm leading-relaxed"><div class="font-bold text-red-300 mb-1">👑 BOSS 追蹤</div>';
    if (t) {
      var left = t.until - Date.now(), mapName = (bossMaps().find(function (x) { return x.v === t.map; }) || {}).t || t.map, need = nextCost(), canExt = left + BOSS_H * H <= BOSS_MAX_H * H + 60000;
      h += '<div class="text-slate-200">追蹤頭目：<span class="text-red-300 font-bold">' + esc((DB.mobs[t.mob] || {}).n || t.mob) + '</span><br>追蹤地區：<span class="text-sky-300">' + esc(mapName) + '</span><br>剩餘時間：<span class="text-green-400 font-bold">' + hm(left) + '</span></div>'
        + '<div class="text-xs text-slate-400 mt-1">在該地區、場上沒有這隻頭目時，每次出怪有 50% 機率（小獵犬的追蹤鼻 70%）變成牠。</div>'
        + '<div class="flex gap-2 mt-2 flex-wrap"><button class="btn ' + (canExt ? 'bg-red-800 hover:bg-red-700 border-red-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed') + ' py-1 px-3 font-bold" ' + (canExt ? '' : 'disabled') + ' onclick="afkBossTrackExtend()">延長 ' + BOSS_H + ' 小時（遺物 ×' + need + '）</button>'
        + '<button class="btn bg-slate-700 hover:bg-slate-600 border-slate-500 py-1 px-3" onclick="afkBossTrackCancel()">取消</button></div>'
        + (canExt ? '' : '<div class="text-xs text-amber-300 mt-1">剩餘時間最多 ' + BOSS_MAX_H + ' 小時。</div>');
    } else {
      var maps = bossMaps(), mobs = sel.map ? (DB.maps[sel.map] || []).filter(function (id) { return DB.mobs[id] && DB.mobs[id].boss; }) : [];
      var seen = {}; mobs = mobs.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
      h += '<div class="text-slate-300">交出 1 件遺物（背包裡、未上鎖、沒有裝備著的，自動挑最便宜的），我替你盯住一隻頭目 ' + BOSS_H + ' 小時；每延長一次多交 1 件，最多累積 ' + BOSS_MAX_H + ' 小時。</div>'
        + '<select class="w-full mt-2 bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded text-sm" onchange="afkBossTrackPick(\'map\', this.value)"><option value="">— 選擇地區 —</option>'
        + maps.map(function (x) { return '<option value="' + esc(x.v) + '"' + (sel.map === x.v ? ' selected' : '') + '>' + esc(x.t) + '</option>'; }).join('') + '</select>';
      if (sel.map) h += '<div class="bg-slate-800/40 border border-slate-700 rounded p-2 mt-2 max-h-48 overflow-y-auto flex flex-col gap-0.5">' + (mobs.length ? mobs.map(function (id) {
        var mb = DB.mobs[id], on = sel.mob === id;
        return '<label class="flex items-center gap-2 cursor-pointer py-1 px-2 rounded ' + (on ? 'bg-red-900/50' : '') + '"><input type="checkbox" ' + (on ? 'checked' : '') + ' onclick="afkBossTrackPick(\'mob\', \'' + id + '\')"> <span class="' + (typeof getMobColor === 'function' ? getMobColor(mb.lv) : '') + '">' + esc(mb.n) + '</span> <span class="text-xs text-slate-500">Lv' + mb.lv + '</span></label>';
      }).join('') : '<span class="text-slate-500 text-sm">此地區沒有頭目</span>') + '</div>';
      var n = relicCount(), ok = !!sel.mob && n >= 1;
      h += '<button class="btn mt-2 w-full ' + (ok ? 'bg-red-800 hover:bg-red-700 border-red-500' : 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed') + ' py-2 px-4 font-bold" ' + (ok ? '' : 'disabled') + ' onclick="afkBossTrackStart()">開始 BOSS 追蹤（遺物 ×1；可用 ' + n + ' 件）</button>';
    }
    return h + '</div>';
  };
  var oRender = W.renderObelNPC;
  W.renderObelNPC = function (div) {
    var r = oRender.apply(this, arguments);
    try {
      var box = div.querySelector('.flex.flex-col.gap-3') || div;
      box.querySelectorAll('.text-xs.text-slate-400').forEach(function (x) { if (/50% 機率為追蹤目標/.test(x.textContent)) x.textContent = '前往該地區時，每次出怪有 50% 機率為追蹤目標（魔物追蹤一次 ' + TRACK_H + ' 小時）。'; });
      box.insertAdjacentHTML('beforeend', panel());
    } catch (e) { console.warn('[AFK-bosstrack] panel', e); }
    return r;
  };

  // 出怪：在追蹤地圖、場上沒有這隻頭目時，50%（追蹤鼻 70%）走原本的出王流程，而且王池只放這一隻
  var oSpawn = W.spawnMob;
  W.spawnMob = function (idx) {
    var t = rec(), cur = typeof mapState !== 'undefined' ? mapState.current : null, pool = cur && DB.maps[cur];
    if (!t || t.map !== cur || !pool || pool.indexOf(t.mob) < 0 || !DB.mobs[t.mob] || (mapState.mobs || []).some(function (m) { return m && m.boss && m.n === DB.mobs[t.mob].n && !m._dead && m.curHp > 0; }))
      return oSpawn.apply(this, arguments);
    var rate = 0.5;
    try { var p = P(); for (var k in p.eq) { var e = p.eq[k]; if (e && DB.items[e.id] && DB.items[e.id].trackBoost) { rate = 0.7; break; } } } catch (e) {}
    if (Math.random() >= rate) return oSpawn.apply(this, arguments);
    var saved = DB.maps[cur], hadForce = mapState.forceBoss;
    DB.maps[cur] = saved.filter(function (id) { return !(DB.mobs[id] && DB.mobs[id].boss) || id === t.mob; });
    mapState.forceBoss = true;
    try { return oSpawn.apply(this, arguments); }
    finally { DB.maps[cur] = saved; if (mapState.forceBoss) mapState.forceBoss = hadForce; }
  };
  W.__afkBossTrack = { rec: rec, relicCount: relicCount, nextCost: nextCost, sel: function () { return sel; }, H: { track: TRACK_H, boss: BOSS_H, max: BOSS_MAX_H } };
  console.log('[AFK-bosstrack] 已啟用：魔物追蹤 24 小時＋BOSS 追蹤');
})();
