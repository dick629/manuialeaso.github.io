/* afk-dollrift.js — 魔法娃娃 7～10 階（次元裂縫，32 隻）
 *   設計稿 docs/mio-doll-rift-design.md 第二節；圖 assets/doll/rift/doll_<階>_<路線>.webp（GPT 柔暗版 v3，11-11 20:45 交件）。
 *   取得：王之徽章 1,000 → 隨機一隻七階；王者鑽石卡 10 張抽一次 → 30% 隨機八階（連續 9 次沒中，第 10 次必中）。
 *   合成：同階 2 隻 → 高一階隨機路線；7→8 50%、8→9 30%、9→10 10%；失敗吃 1 隻退 1 隻；同階連續失敗 9 次，第 10 次必中。
 *   哈瑪不算在裡面（不是材料、不在名單）。核心的 DOLL_BY_TIER 不放這 32 隻，避免被一般合成、六階重組、袋子拿去用。
 *   不做滑鼠游標（Ping 11-11 19:58）。經典模式沒有；外掛開關 dollrift。
 */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dollrift', name: '魔法娃娃 7～10 階', group: '遊戲內容', desc: '次元裂縫的魔法娃娃：王之徽章換七階、王者鑽石卡抽八階、往上合成（魔法娃娃商人）' });
  if (T && !T.enabled('dollrift')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var inRift = function () { try { return !!(W.__afkDimRift && W.__afkDimRift.on()); } catch (e) { return false; } };
  var BADGE = 'afk_mb_badge', BADGE_N = 1000, DRAW_N = 10, DRAW_RATE = 30, PITY = 10;
  var RATE = { 7: 50, 8: 30, 9: 10 };
  var CN = { 7: '七階', 8: '八階', 9: '九階', 10: '十階' }, COL = { 7: 'c-doll7', 8: 'c-doll8', 9: 'c-doll9', 10: 'c-doll10' };
  var BASE = { hpR: [25, 30, 35, 40], mpR: [12, 15, 18, 20], mhp: [200, 300, 400, 500], mr: [12, 15, 18, 20] };
  // 路線：平常的能力（items 上的數值、或 fx 動態）＋裂縫專屬
  var R = [
    { k: 'rule', n: '統御', cls: '王族', st: {}, fx: { ally: [4, 6, 8, 10] }, rift: { allyEro: [10, 15, 20, 25] },
      txt: function (i) { return '傭兵、召喚物造成的傷害 +' + this.fx.ally[i] + '%'; }, rtxt: function (i) { return '傭兵受到的地圖侵蝕扣血 −' + this.rift.allyEro[i] + '%'; } },
    { k: 'wall', n: '堅壁', cls: '騎士', st: { dr: [12, 15, 18, 22] }, fx: {}, rift: { ero: [8, 12, 16, 20] },
      txt: function (i) { return '傷害減免 +' + this.st.dr[i]; }, rtxt: function (i) { return '你受到的地圖侵蝕扣血 −' + this.rift.ero[i] + '%'; } },
    { k: 'arrow', n: '遠矢', cls: '妖精', st: { rangedDmg: [5, 6, 8, 10], rangedHit: [10, 12, 15, 20] }, fx: {}, rift: { light: [60, 50, 40, 30] },
      txt: function (i) { return '遠距離傷害 +' + this.st.rangedDmg[i] + '、遠距離命中 +' + this.st.rangedHit[i]; }, rtxt: function (i) { return '光蝕每 ' + this.rift.light[i] + ' 秒自動少 1 層'; } },
    { k: 'star', n: '星詠', cls: '法師', st: { mdmg: [6, 8, 10, 12], magicHit: [3, 4, 5, 6] }, fx: {}, rift: { magic: [5, 8, 11, 15] },
      txt: function (i) { return '魔法傷害 +' + this.st.mdmg[i] + '、魔法命中 +' + this.st.magicHit[i]; }, rtxt: function (i) { return '攻擊魔法造成的傷害 +' + this.rift.magic[i] + '%'; } },
    { k: 'shade', n: '影刃', cls: '黑暗妖精', st: {}, fx: { crit: [2, 3, 4, 5] }, rift: { boss: [4, 6, 8, 10] },
      txt: function (i) { return '近距離爆擊率 +' + this.fx.crit[i] + '%'; }, rtxt: function (i) { return '對頭目造成的傷害 +' + this.rift.boss[i] + '%'; } },
    { k: 'breath', n: '龍息', cls: '龍騎士', st: { meleeDmg: [5, 6, 8, 10], resFire: [15, 20, 25, 30], resWater: [15, 20, 25, 30], resWind: [15, 20, 25, 30], resEarth: [15, 20, 25, 30] }, fx: {}, rift: { eroStat: [10, 20, 30, 40] },
      txt: function (i) { return '近距離傷害 +' + this.st.meleeDmg[i] + '、火水風地抗性 +' + this.st.resFire[i]; }, rtxt: function (i) { return '地圖侵蝕造成的 AC、魔防、抗性下降 −' + this.rift.eroStat[i] + '%'; } },
    { k: 'dream', n: '幻夢', cls: '幻術士', st: { mdmg: [5, 6, 8, 10], abnormalResist: [5, 8, 11, 15] }, fx: {}, rift: { weight: [800, 1200, 1600, 2000] },
      txt: function (i) { return '魔法傷害 +' + this.st.mdmg[i] + '、異常狀態抵抗 +' + this.st.abnormalResist[i] + '%'; }, rtxt: function (i) { return '負重上限 +' + this.rift.weight[i].toLocaleString(); } },
    { k: 'will', n: '不屈', cls: '戰士', st: { meleeHit: [10, 12, 15, 20] }, fx: { mhpPct: [3, 4, 5, 6] }, rift: { heal: [6, 9, 12, 15] },
      txt: function (i) { return '最大 HP 再 +' + this.fx.mhpPct[i] + '%、近距離命中 +' + this.st.meleeHit[i]; }, rtxt: function (i) { return '受到的治療 +' + this.rift.heal[i] + '%'; } }
  ];
  var NAMES = {
    7: ['縫口的學徒', '天梯守衛', '搜尋之光', '監視之眼', '時之蛀蟲', '燃燼的礦工', '呼喊者', '守門影'],
    8: ['鏽蝕的鐘匠', '鐘擺守衛', '墜星', '裂痕的窺視者', '漂流墓船的船長', '熔岩挖掘者 博格', '映照者 米菈', '冬至夜的守門影'],
    9: ['無盡的守門者', '停擺之主 克羅諾斯塔', '星蝕者 艾斯崔亞', '最早的那一點光', '你的倒影', '深淵的大王烏賊', '次元裂隙', '時之沙的旅人'],
    10: ['縫口', '第一世的你', '織星者', '說書人', '第二世的你', '墮光天使 阿納金', '歸一之光', '縫天之人']
  };
  var ACT = { 9: 90, 10: 60 };   // 裂縫主動：秒
  var idOf = function (t, k) { return 'doll_rift_' + t + '_' + k; };
  var imgOf = function (t, k, big) { return 'assets/doll/rift/doll_' + t + '_' + k + (big ? '_256' : '') + '.webp'; };
  var BY = {}, LIST = [], TIER_IDS = { 7: [], 8: [], 9: [], 10: [] };

  try { if (!document.getElementById('afk-dollrift-css')) { var cs = document.createElement('style'); cs.id = 'afk-dollrift-css';
    cs.textContent = '.c-doll8{color:#cbd5e1!important;text-shadow:0 0 1px #000,0 0 6px rgba(203,213,225,.55)}.c-doll9{color:#fcd34d!important;text-shadow:0 0 1px #000,0 0 7px rgba(252,211,77,.6)}.c-doll10{color:#e9d5ff!important;text-shadow:0 0 1px #000,0 0 6px rgba(168,85,247,.8),0 0 10px rgba(56,189,248,.45)}'
      + '.afk-dr-sec{margin:0 16px 12px;border:1px solid #6d28d9;border-radius:8px;background:rgba(15,10,30,.6);padding:10px 12px}.afk-dr-sec h4{font-weight:700;color:#c4b5fd;margin:0 0 6px}.afk-dr-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;background:rgba(2,6,23,.5);border:1px solid #334155;border-radius:6px;padding:7px 10px;margin:6px 0;font-size:13px}'
      + '.afk-dr-row button{padding:4px 10px;font-size:12px;font-weight:700;border-radius:6px;border:1px solid #7c3aed;background:#4c1d95;color:#f5f3ff}.afk-dr-row button:disabled{opacity:.45;cursor:not-allowed;background:#334155;border-color:#475569}'
      + '.afk-dr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px;margin-top:6px}.afk-dr-cell{text-align:center;font-size:11px;line-height:1.25;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:4px 2px;background:#0b1020}.afk-dr-cell img{width:64px;height:64px;display:block;margin:0 auto 2px}.afk-dr-cell.off img{filter:grayscale(1) brightness(.45)}.afk-dr-cell b{display:block;color:#94a3b8;font-weight:400}.afk-dr-note{font-size:12px;color:#94a3b8;margin:2px 0}';
    (document.head || document.documentElement).appendChild(cs); } } catch (e) {}

  // ── 道具 ──
  [7, 8, 9, 10].forEach(function (t) {
    var i = t - 7;
    R.forEach(function (r, ri) {
      var id = idOf(t, r.k), name = NAMES[t][ri];
      var d = { n: '魔法娃娃：' + name, type: 'acc', slot: 'doll', req: 'all', safe: 0, p: 0, doll: true, dollTier: t, noEnhance: true, gachaWeight: 0, c: COL[t], img: imgOf(t, r.k), afkRiftDoll: { t: t, k: r.k } };
      Object.keys(BASE).forEach(function (s) { d[s] = BASE[s][i]; });
      Object.keys(r.st).forEach(function (s) { d[s] = (d[s] || 0) + r.st[s][i]; });
      var parts = ['HP 恢復 +' + BASE.hpR[i], 'MP 恢復 +' + BASE.mpR[i], '最大 HP +' + BASE.mhp[i], '魔防 +' + BASE.mr[i], r.txt(i)];
      var rp = [r.rtxt(i)]; if (ACT[t]) rp.push('每 ' + ACT[t] + ' 秒自動發動「縫光」：全隊光蝕 −3 層、5 秒內地圖侵蝕暫停'); if (t === 10) rp.push('造成的傷害 +6%、受到的傷害 −6%');
      d.d = CN[t] + '魔法娃娃（次元裂縫・' + r.n + '）。' + parts.join('、') + '。在次元裂縫裡另外有：' + rp.join('；') + '。';
      if (!DB.items[id]) DB.items[id] = d;
      var row = { id: id, t: t, i: i, k: r.k, r: r, n: name };
      BY[id] = row; LIST.push(row); TIER_IDS[t].push(id);
    });
  });

  // ── 存檔資料 ──
  var store = function (p) { p = p || P(); if (!p) return { pity: {}, draw: 0 }; var s = p.afkDollRift && typeof p.afkDollRift === 'object' ? p.afkDollRift : (p.afkDollRift = {}); if (!s.pity || typeof s.pity !== 'object') s.pity = {}; s.draw = Number(s.draw) || 0; s.seen = s.seen || {}; return s; };
  var cnt = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var invTier = function (t) { var p = P(); if (!p) return []; return (p.inv || []).filter(function (it) { var r = it && BY[it.id]; return r && r.t === t && !it.lock && (it.cnt || 1) > 0; }); };
  var tierCount = function (t) { return invTier(t).reduce(function (s, it) { return s + (it.cnt || 1); }, 0); };
  var takeTier = function (t, n) {   // 只吃背包、未鎖定；回傳吃掉的 id
    var p = P(), out = [];
    for (var j = 0; j < p.inv.length && out.length < n; j++) { var it = p.inv[j], r = BY[it.id]; if (!r || r.t !== t || it.lock) continue; var c = it.cnt || 1, k = Math.min(c, n - out.length); for (var q = 0; q < k; q++) out.push(it.id); it.cnt = c - k; }
    p.inv = p.inv.filter(function (it) { return it.cnt == null || it.cnt > 0; });
    return out;
  };
  var diaCards = function () { var p = P(); if (!p) return 0; return (p.inv || []).reduce(function (s, it) { return s + (it && /^bcard_d_/.test(it.id) && !it.lock ? (it.cnt || 1) : 0); }, 0); };
  var takeDia = function (n) { var p = P(); for (var j = 0; j < p.inv.length && n > 0; j++) { var it = p.inv[j]; if (!/^bcard_d_/.test(it.id) || it.lock) continue; var k = Math.min(it.cnt || 1, n); it.cnt = (it.cnt || 1) - k; n -= k; } p.inv = p.inv.filter(function (it) { return it.cnt == null || it.cnt > 0; }); };
  var pick = function (t) { var a = TIER_IDS[t]; return a[Math.floor(Math.random() * a.length)]; };
  var give = function (id) { try { gainItem(id, 1, true, true); } catch (e) {} store().seen[id] = 1; };
  var nameHtml = function (id) { var d = DB.items[id] || {}; return '<span class="' + (d.c || '') + ' font-bold">' + esc(d.n || id) + '</span>'; };
  var after = function () { try { if (typeof _dollAfterChange === 'function') _dollAfterChange(); else { calcStats(); renderTabs(true); updateUI(); saveGame(); } } catch (e) {} var c = document.getElementById('interaction-content'); if (c && c.querySelector('#afk-dollrift')) try { W.renderCardSynth(c); } catch (e) {} };
  var ok = function () { var p = P(); return !!(p && !p.classicMode); };

  var exchange = function () {
    if (!ok()) return; if (cnt(BADGE) < BADGE_N) { sys('<span class="text-red-400">王之徽章不夠（要 ' + BADGE_N.toLocaleString() + ' 個）。</span>'); return; }
    questConsumeId(BADGE, BADGE_N); var id = pick(7); give(id);
    sys('<span class="text-violet-300 font-bold">🪆 王之徽章 ×' + BADGE_N.toLocaleString() + ' 換到了 </span>' + nameHtml(id) + '！'); after();
  };
  var draw = function () {
    if (!ok()) return; if (diaCards() < DRAW_N) { sys('<span class="text-red-400">王者鑽石卡不夠（要 ' + DRAW_N + ' 張）。</span>'); return; }
    takeDia(DRAW_N); var s = store(), sure = s.draw >= PITY - 1, win = sure || Math.random() * 100 < DRAW_RATE;
    if (win) { s.draw = 0; var id = pick(8); give(id); sys('<span class="text-slate-200 font-bold">🎴 王者鑽石卡 ×' + DRAW_N + '：抽中了 </span>' + nameHtml(id) + '！' + (sure ? '<span class="text-amber-300 text-xs">（保底）</span>' : '')); }
    else { s.draw++; sys('<span class="text-slate-400">🎴 王者鑽石卡 ×' + DRAW_N + '：沒有抽中……</span><span class="text-amber-300 text-xs">（保底 ' + s.draw + '/' + (PITY - 1) + '）</span>'); }
    after();
  };
  var synth = function (t) {
    t = +t; if (!ok() || !RATE[t]) return; if (tierCount(t) < 2) { sys('<span class="text-red-400">' + CN[t] + '魔法娃娃不足 2 隻（未鎖定、在背包）。</span>'); return; }
    var used = takeTier(t, 2), s = store(), pit = Number(s.pity[t]) || 0, sure = pit >= PITY - 1, win = sure || Math.random() * 100 < RATE[t];
    if (win) { s.pity[t] = 0; var id = pick(t + 1); give(id); sys('<span class="text-amber-200 font-bold">🪆 合成成功！</span>得到 ' + nameHtml(id) + '。' + (sure ? '<span class="text-amber-300 text-xs">（保底）</span>' : '')); }
    else { s.pity[t] = pit + 1; var back = used[Math.floor(Math.random() * used.length)]; give(back); sys('<span class="text-slate-400">🪆 合成失敗……</span>退還 ' + nameHtml(back) + '。<span class="text-amber-300 text-xs">（' + CN[t] + '保底 ' + s.pity[t] + '/' + (PITY - 1) + '）</span>'); }
    after();
  };

  // ── 面板（魔法娃娃商人） ──
  var panel = function () {
    if (!ok()) return '';
    var s = store(), b = cnt(BADGE), dc = diaCards(), h = '<div id="afk-dollrift" class="afk-dr-sec"><h4>🌀 七～十階魔法娃娃（次元裂縫）</h4>';
    h += '<div class="afk-dr-note">32 隻，每階 8 條路線。平常就有能力，在次元裂縫裡另外再多一種效果；九階以上會自動發動「縫光」。七階以上只能這裡換、抽、往上合成（哈瑪不算在內）。</div>';
    h += '<div class="afk-dr-row"><span>👑 王之徽章 ' + BADGE_N.toLocaleString() + ' 個 → 隨機一隻<span class="c-doll7 font-bold">七階</span>　持有 <b class="' + (b >= BADGE_N ? 'text-green-400' : 'text-red-400') + '">' + b.toLocaleString() + '</b></span><button type="button" onclick="__afkDollRift.exchange()"' + (b >= BADGE_N ? '' : ' disabled') + '>兌換</button></div>';
    h += '<div class="afk-dr-row"><span>🎴 王者鑽石卡 ' + DRAW_N + ' 張抽一次 → ' + DRAW_RATE + '% 隨機一隻<span class="c-doll8 font-bold">八階</span>　持有 <b class="' + (dc >= DRAW_N ? 'text-green-400' : 'text-red-400') + '">' + dc + '</b>　保底 ' + s.draw + '/' + (PITY - 1) + '</span><button type="button" onclick="__afkDollRift.draw()"' + (dc >= DRAW_N ? '' : ' disabled') + '>抽一次</button></div>';
    [7, 8, 9].forEach(function (t) {
      var n = tierCount(t), p = Number(s.pity[t]) || 0;
      h += '<div class="afk-dr-row"><span>🪆 <span class="' + COL[t] + ' font-bold">' + CN[t] + '</span> 2 隻 → <span class="' + COL[t + 1] + ' font-bold">' + CN[t + 1] + '</span>（路線隨機）成功率 ' + RATE[t] + '%　可用 <b class="' + (n >= 2 ? 'text-green-400' : 'text-red-400') + '">' + n + '</b>　保底 ' + p + '/' + (PITY - 1) + '</span><button type="button" onclick="__afkDollRift.synth(' + t + ')"' + (n >= 2 ? '' : ' disabled') + '>合成</button></div>';
    });
    h += '<div class="afk-dr-note">失敗會吃掉 1 隻、退還 1 隻。同一階連續失敗 9 次，第 10 次必定成功（抽卡也一樣）。鎖定的、放在倉庫的娃娃不會被拿去合成。</div>';
    [7, 8, 9, 10].forEach(function (t) {
      h += '<div class="afk-dr-note" style="margin-top:8px"><span class="' + COL[t] + ' font-bold">' + CN[t] + '</span></div><div class="afk-dr-grid">';
      TIER_IDS[t].forEach(function (id) { var r = BY[id], have = s.seen[id] || tierHas(id); h += '<div class="afk-dr-cell' + (have ? '' : ' off') + '" title="' + esc(DB.items[id].d) + '"><img src="' + imgOf(t, r.k) + '" alt="" loading="lazy">' + esc(r.n) + '<b>' + r.r.n + '</b></div>'; });
      h += '</div>';
    });
    return h + '</div>';
  };
  var tierHas = function (id) { var p = P(); if (!p) return false; if (p.eq && p.eq.doll && p.eq.doll.id === id) return true; return (p.inv || []).some(function (it) { return it && it.id === id; }); };
  if (typeof W.renderCardSynth === 'function') {
    var oR = W.renderCardSynth;
    W.renderCardSynth = function (div) {
      var r = oR.apply(this, arguments);
      try { if (div && ok()) { var old = div.querySelector('#afk-dollrift'); if (old) old.remove(); div.insertAdjacentHTML('beforeend', panel()); } } catch (e) { console.warn('[AFK-dollrift] panel', e); }
      return r;
    };
    try { (0, eval)('renderCardSynth = window.renderCardSynth'); } catch (e) {}
  }

  // ── 能力 ──
  var cur = function () { var p = P(); if (!ok() || !p.eq || !p.eq.doll) return null; return BY[p.eq.doll.id] || null; };
  var V = function (row, grp, k) { return row && row.r[grp][k] ? row.r[grp][k][row.i] : 0; };
  // 不做游標：裝著這 32 隻時清掉核心換上的游標
  if (typeof W.applyDollCursor === 'function') {
    var oCur = W.applyDollCursor;
    W.applyDollCursor = function () {
      var r = oCur.apply(this, arguments);
      try { if (cur()) { document.body.style.cursor = ''; document.body.classList.remove('has-doll-cursor'); var g = document.getElementById('doll-cursor-glow'); if (g) g.classList.remove('active'); } } catch (e) {}
      return r;
    };
    try { (0, eval)('applyDollCursor = window.applyDollCursor'); } catch (e) {}
  }
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      // 幻夢：裂縫裡的負重上限掛在娃娃身上（核心算負重時會讀娃娃欄的 weightCap）
      try { LIST.forEach(function (x) { if (x.k === 'dream') DB.items[x.id].weightCap = 0; }); var c0 = cur(); if (c0 && c0.k === 'dream' && inRift()) DB.items[c0.id].weightCap = V(c0, 'rift', 'weight'); } catch (e) {}
      var r = oRe.apply(this, arguments);
      try { var p = P(), c = cur(); if (p && p.d && c) { var cr = V(c, 'fx', 'crit'); if (cr) p.d.meleeCrit = (Number(p.d.meleeCrit) || 0) + cr; } } catch (e) {}
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { if (p !== P()) return; var c = cur(), v = V(c, 'fx', 'mhpPct'); if (v) p.mhp = Math.floor((p.mhp || 0) * (1 + v / 100)); });
  // 次元裂縫：侵蝕扣血（afk-dimrift 的 __afkErodeCuts）、侵蝕下降、暫停
  (W.__afkErodeCuts = W.__afkErodeCuts || []).push(function (p, x) {
    var c = cur(); if (!c || !inRift()) return 0;
    if (x === p) return V(c, 'rift', 'ero') / 100;
    return V(c, 'rift', 'allyEro') / 100;
  });
  W.__afkEroMult = function (p) { var c = cur(); return c && inRift() ? 1 - V(c, 'rift', 'eroStat') / 100 : 1; };
  var g = { lightAt: 0, actAt: 0, pauseUntil: 0 };
  W.__afkErodePaused = function () { return tk() < g.pauseUntil; };
  if (typeof W.foulWaterHealMult === 'function') {
    var oHeal = W.foulWaterHealMult;
    W.foulWaterHealMult = function (target) { var m = oHeal.apply(this, arguments); try { var c = cur(), p = P(); if (c && target === p && inRift()) m *= 1 + V(c, 'rift', 'heal') / 100; } catch (e) {} return m; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  var lightRec = function () { try { var D = W.__afkDimRift, p = P(); return D && D.rec ? D.rec(p) : null; } catch (e) { return null; } };
  if (X) {
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(), c = cur(); if (!p || !c || !(v > 0)) return v;
      opt = opt || {};
      if (actor !== p) { var al = V(c, 'fx', 'ally'); return al ? v * (1 + al / 100) : v; }
      if (!inRift()) return v;
      var m = 1;
      var mg = V(c, 'rift', 'magic'); if (mg && opt.kind === 'magic') m *= 1 + mg / 100;
      var bs = V(c, 'rift', 'boss'); if (bs && target && target.boss) m *= 1 + bs / 100;
      if (c.t === 10) m *= 1.06;
      return v * m;
    });
    X.on('taken', function (ent, dmg) { var p = P(), c = cur(); if (!p || ent !== p || !c || c.t !== 10 || !inRift() || !(dmg > 0)) return dmg; return dmg * 0.94; });
    X.on('tick', function () {
      var p = P(), c = cur(); if (!p || !c || p.dead || !inRift()) return;
      var t = tk(), rc = lightRec();
      var lt = V(c, 'rift', 'light');
      if (lt && rc) { if (!g.lightAt) g.lightAt = t + lt * 10; if (t >= g.lightAt) { g.lightAt = t + lt * 10; if ((rc.light || 0) > 0) { rc.light--; try { calcStats(); } catch (e) {} } } }
      var a = ACT[c.t];
      if (a && X.inCombat()) {
        if (!g.actAt) g.actAt = t + a * 10;
        if (t >= g.actAt) {
          g.actAt = t + a * 10; g.pauseUntil = t + 50;
          if (rc && (rc.light || 0) > 0) { rc.light = Math.max(0, rc.light - 3); try { calcStats(); } catch (e) {} }
          try { X.pop('dollrift', imgOf(c.t, c.k), '縫光', '#c4b5fd'); X.note('dollrift', '<span style="color:#c4b5fd">🪆【縫光】</span>' + esc(c.n) + '：全隊光蝕 −3 層，5 秒內地圖侵蝕暫停。'); } catch (e) {}
        }
      }
    });
  }

  W.__afkDollRift = { R: R, NAMES: NAMES, LIST: LIST, BY: BY, TIER_IDS: TIER_IDS, RATE: RATE, BADGE_N: BADGE_N, DRAW_N: DRAW_N, DRAW_RATE: DRAW_RATE, PITY: PITY, ACT: ACT, CN: CN, COL: COL, BASE: BASE,
    idOf: idOf, imgOf: imgOf, store: store, exchange: exchange, draw: draw, synth: synth, panel: panel, cur: cur, tierCount: tierCount };
  try { console.log('[AFK-dollrift] 已載入：魔法娃娃 7～10 階（32 隻）'); } catch (e) {}
})();
