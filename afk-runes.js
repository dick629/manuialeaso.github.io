/* ============================================================================
 * afk-runes.js — 符文師佐爾頓（說話之島）：武器的「星蝕·解」符文孔（玩家 2026-10-29 晚）
 *
 * 原本叫「蝕刻」，跟無屬性印記的「蝕刻」撞名，改名「星蝕·解」，並從艾格尼絲那裡獨立出來交給符文師。
 * 每把武器三個孔，依序打開：
 *   第一孔「墜蝕·解」：消耗同一組原版席琳遺骸 8 套（爪、眼、血、肉、心、骨、牙、鱗各 8 件）
 *                       → 刻上那一組；裝在主手時該組直接算滿 5 件
 *   第二孔「刻解·骸」：要先開第一孔；消耗同一組夢域遺骸 8 套
 *                       → 刻上那一組夢域；裝在主手時該組算滿 5 件，2／3／5 段都是夢域效果
 *   第三孔「瘴骸·破」：鎖定中
 * 已經開的孔可以改刻別組（材料照扣）。孔裡將來要鑲的符文石（32 顆）設計稿審核中，這裡先留位置。
 * 計件、說明、物品簽章都在 afk-sherine-dream（W.__afkSherineDream）；這支只管 NPC 與開孔。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'runes', name: '符文師佐爾頓（星蝕·解）', group: '遊戲玩法',
    desc: '說話之島的符文師佐爾頓替武器開「星蝕·解」符文孔：第一孔消耗原版席琳遺骸 8 套、第二孔消耗夢域遺骸 8 套，主手時刻上的套裝直接算滿 5 件；第三孔鎖定中' });
  if (T && !T.enabled('runes')) return;
  var K = W.__afkNpcKit, SD = W.__afkSherineDream;
  if (!K || !SD || !DB || !DB.items) { console.warn('[AFK-runes] 需要 afk-npc-kit 與 afk-sherine-dream，略過'); return; }

  var NPC_ID = 'npc_zoldon', NPC_N = '佐爾頓';
  var NAMES = SD.SOCKET_NAMES, PER = SD.ETCH_PER;
  var GROUPS = Object.keys(SD.DN);   // 12 組原版名稱
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = K.esc;
  var uid = function () { return 'RN' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36); };
  var sets = function (p, seteff) { return Math.floor(SD.etchReady(p, seteff) / PER); };
  var isWpn = function (it) { var d = it && DB.items[it.id]; return !!(d && d.type === 'wpn'); };

  // ── 選擇武器 ──
  var ui = { sel: '', q: '', more: 0, g1: '', g2: '', err: '', msg: '' }, PAGE = 60;
  var candidates = function () {
    var p = P(), out = []; if (!p) return out;
    [['wpn', '主手'], ['offwpn', '副手']].forEach(function (s) { var it = p.eq && p.eq[s[0]]; if (isWpn(it)) out.push({ ref: 'eq:' + s[0], it: SD.migrate(it), where: '裝備中・' + s[1] }); });
    (p.inv || []).forEach(function (it) { if (isWpn(it) && !it.lock) out.push({ ref: 'inv:' + it.uid, it: SD.migrate(it), where: '背包' + ((Number(it.cnt) || 1) > 1 ? ' ×' + it.cnt : '') }); });
    // 裝備中的排最前面，其次是已經開孔的
    var rank = function (c) { return (c.ref.indexOf('eq:') === 0 ? 10 : 0) + (c.it.sockets || []).length; };
    return out.map(function (c, i) { c._i = i; return c; }).sort(function (a, b) { return (rank(b) - rank(a)) || (a._i - b._i); });
  };
  var plain = function (it) { try { return getItemFullName(it).replace(/<[^>]+>/g, ''); } catch (e) { return (DB.items[it.id] || {}).n || ''; } };
  var selOf = function () { var c = candidates(); for (var i = 0; i < c.length; i++) if (c[i].ref === ui.sel) return c[i]; return null; };
  var lastRef = '';
  var resolve = function (ref) {
    var p = P(); if (!p || !ref) return null;
    if (ref.indexOf('eq:') === 0) { lastRef = ref; return p.eq[ref.slice(3)] || null; }
    var u = ref.slice(4), it = p.inv.find(function (x) { return x && x.uid === u; });
    if (!it) return null;
    if ((Number(it.cnt) || 1) > 1) { it.cnt = (Number(it.cnt) || 1) - 1; var one = Object.assign({}, it, { uid: uid(), cnt: 1 }); p.inv.push(one); it = one; }
    lastRef = 'inv:' + it.uid;
    return it;
  };
  var done = function (msg) {
    try { logSys(msg); } catch (e) {}
    try { calcStats(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { saveGame(); } catch (e) {} try { updateUI(); } catch (e) {}
  };

  // ── 開孔（回傳錯誤訊息，成功回傳 null）──
  var ACT = {
    open1: function (ref, g) {
      var p = P(); if (!p) return '請先進入遊戲。';
      if (GROUPS.indexOf(g) < 0) return '請選一組席琳套裝。';
      var c = ui.sel === ref ? selOf() : candidates().filter(function (x) { return x.ref === ref; })[0];
      if (!c) return '先選一把武器。';
      if (c.it.etch === g) return '第一孔已經刻著「' + g + '」。';
      if (sets(p, g) < 1) return '需要「' + g + '」席琳遺骸 8 套（八個部位各 ' + PER + ' 件，未上鎖）。';
      var it = resolve(ref); if (!it) return '找不到這把武器。';
      SD.migrate(it);
      SD.etchTake(p, g);
      var re = !!it.etch;
      it.etch = g; it._starV = 1;
      if (!Array.isArray(it.sockets)) it.sockets = [];
      if (it.sockets.length < 1) it.sockets.push(null);
      done('<span class="c-sherine font-bold">' + NPC_N + '把 8 套「' + esc(g) + '」席琳遺骸碾成星屑，' + (re ? '重新刻進' : '鑿開了') + '武器的第一個符文孔「' + NAMES[0] + '」</span>→ ' + (function () { try { return getItemFullName(it); } catch (e) { return ''; } })() + '。主手時「' + esc(g) + '」套裝直接算滿 5 件。');
      return null;
    },
    open2: function (ref, g) {
      var p = P(); if (!p) return '請先進入遊戲。';
      if (GROUPS.indexOf(g) < 0) return '請選一組夢域席琳套裝。';
      var c = candidates().filter(function (x) { return x.ref === ref; })[0];
      if (!c) return '先選一把武器。';
      if (!c.it.etch) return '要先開第一孔「' + NAMES[0] + '」。';
      var se = g + '夢';
      if (c.it.etchD === se) return '第二孔已經刻著「' + SD.etchName(se) + '」。';
      if (sets(p, se) < 1) return '需要夢域「' + SD.DN[g] + '」席琳遺骸 8 套（八個部位各 ' + PER + ' 件，未上鎖）。';
      var it = resolve(ref); if (!it) return '找不到這把武器。';
      SD.migrate(it);
      SD.etchTake(p, se);
      var re = !!it.etchD;
      it.etchD = se; it._starV = 1;
      if (!Array.isArray(it.sockets)) it.sockets = [];
      while (it.sockets.length < 2) it.sockets.push(null);
      done('<span class="c-sherine-dream font-bold">夢域的遺骸在' + NPC_N + '手裡發出紅光，' + (re ? '重新刻進' : '鑿開了') + '第二個符文孔「' + NAMES[1] + '」</span>→ ' + (function () { try { return getItemFullName(it); } catch (e) { return ''; } })() + '。主手時「' + esc(SD.DN[g]) + '」算滿 5 件，2／3／5 段都是夢域效果。');
      return null;
    }
  };

  // ── 面板 ──
  var sockChips = function (it) {
    var n = (it.sockets || []).length;
    return '<div class="ax-socks">' + NAMES.map(function (nm, i) {
      var g = i === 0 ? it.etch : i === 1 ? it.etchD : null;
      if (i === 2) return '<span class="ax-sock lock">🔒 ' + nm + '（鎖定中）</span>';
      if (i < n && g) return '<span class="ax-sock filled">◆ ' + nm + '：' + esc(SD.etchName(g)) + '</span>';
      return '<span class="ax-sock">◇ ' + nm + '（未開）</span>';
    }).join('') + '</div>';
  };
  var groupSelect = function (id, dream, cur) {
    var p = P();
    var opts = GROUPS.map(function (g) {
      var n = sets(p, dream ? g + '夢' : g);
      return { g: g, n: n, t: (dream ? SD.DN[g] + '（夢域・' + g + '）' : g) + '　可做 ' + n + ' 次' };
    }).sort(function (a, b) { return b.n - a.n; });
    if (!cur || !opts.some(function (o) { return o.g === cur; })) cur = opts[0] && opts[0].n > 0 ? opts[0].g : (opts[0] || {}).g;
    return { cur: cur, html: '<select id="' + id + '" aria-label="選擇套裝">' + opts.map(function (o) { return '<option value="' + o.g + '"' + (o.g === cur ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select>' };
  };
  var remIco = function (dream) { var d = DB.items.rem_heart || DB.items.rem_claw; return K.icoTag(K.iconUrl(d), '', false); };
  var render = function (box) {
    var p = P(); if (!box || !p) return;
    var x = selOf(); if (!x) ui.sel = '';
    var total = GROUPS.reduce(function (n, g) { return n + sets(p, g); }, 0), totalD = GROUPS.reduce(function (n, g) { return n + sets(p, g + '夢'); }, 0);
    var h = '<p class="ax-lore">「星辰墜落時會在大地刻下傷痕，席琳的遺骸也一樣。把它們交給我，我替你的武器鑿出能容納星蝕的孔。」——符文師 ' + NPC_N + '</p>'
      + K.matBar([{ img: K.iconUrl(DB.items.rem_heart), n: '原版席琳遺骸（整 8 套）', v: total }, { img: K.iconUrl(DB.items.rem_heart), n: '夢域席琳遺骸（整 8 套）', v: totalD }])
      + '<div class="ax-h">① 選擇武器</div>'
      + '<div class="ax-filter"><input id="afk-zo-q" type="search" placeholder="搜尋武器名稱" aria-label="搜尋武器名稱" value="' + esc(ui.q) + '" style="flex:1 1 140px;min-width:120px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:13px"></div>';
    var q = String(ui.q || '').trim(), all = candidates().filter(function (c) { return !q || plain(c.it).indexOf(q) >= 0; });
    var lim = PAGE * (1 + ui.more), list = all.slice(0, lim);
    h += '<div class="ax-list">' + (list.length ? list.map(function (c) {
      var n = (c.it.sockets || []).length;
      return '<div class="ax-eq' + (c.ref === ui.sel ? ' on' : '') + '" data-zosel="' + esc(c.ref) + '">' + K.invIco(c.it, c.ref.indexOf('eq:') === 0 ? 'eq' : 'inv')
        + '<div style="min-width:0"><div>' + K.fullName(c.it) + '</div><div class="ax-where">' + esc(c.where) + (n ? '　・星蝕孔 ' + n + '／3' : '') + '</div></div></div>';
    }).join('') + (all.length > lim ? '<div class="ax-eq ax-where" data-zomore="1" style="justify-content:center;color:#fde68a">還有 ' + (all.length - lim).toLocaleString() + ' 把，點這裡多顯示 ' + PAGE + ' 把，或用搜尋縮小範圍</div>' : '') : '<div class="ax-eq ax-where">沒有武器（上鎖的不會列出）。</div>') + '</div>';
    if (x) {
      h += '<div class="ax-h">已選擇</div><div class="ax-sel">' + K.invIco(x.it, x.ref.indexOf('eq:') === 0 ? 'eq' : 'inv') + '<div style="min-width:0"><div>' + K.fullName(x.it) + '</div><div class="ax-where">' + esc(x.where) + '</div>'
        + sockChips(x.it) + (x.ref !== 'eq:wpn' && (x.it.etch || x.it.etchD) ? '<div class="ax-note">要裝在主手，刻上的套裝才會生效。</div>' : '') + '</div></div>';
    }
    h += '<div class="ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + ui.msg + '</div>';
    h += '<div class="ax-h">② 星蝕·解</div>';
    var noSel = '先在上面選一把武器', it = x && x.it;
    var s1 = groupSelect('afk-zo-g1', false, ui.g1); ui.g1 = s1.cur;
    var s2 = groupSelect('afk-zo-g2', true, ui.g2); ui.g2 = s2.cur;
    var have1 = sets(p, ui.g1), have2 = sets(p, ui.g2 + '夢');
    h += K.rowHtml({ key: 'open1', ico: remIco(false), name: '第一孔「' + NAMES[0] + '」', color: '#4ade80',
      desc: '消耗同一組原版席琳遺骸 8 套（爪、眼、血、肉、心、骨、牙、鱗各 ' + PER + ' 件），把那一組刻進武器。裝在主手時，該組套裝直接算滿 5 件（2／3／5 段全開）。已經開過可以改刻別組，材料照扣。',
      req: K.reqTxt(have1, 1, '套 × 8（' + esc(ui.g1) + '）'), why: !x ? noSel : (it.etch === ui.g1 ? '已經刻著這一組' : ''),
      pick: s1.html, btns: [['open1', it && it.etch ? '改刻' : '開孔', have1 >= 1]] }, 'data-zo');
    h += K.rowHtml({ key: 'open2', ico: remIco(true), name: '第二孔「' + NAMES[1] + '」', color: '#fb7185',
      desc: '要先開第一孔。消耗同一組夢域席琳遺骸 8 套，把那一組夢域刻進武器。裝在主手時，該組算滿 5 件，而且 2／3／5 段都是夢域效果。可以跟第一孔刻同一組，也可以刻別組；已經開過可以改刻。',
      req: K.reqTxt(have2, 1, '套 × 8（夢域' + esc(SD.DN[ui.g2] || '') + '）'), why: !x ? noSel : !it.etch ? '要先開第一孔「' + NAMES[0] + '」' : (it.etchD === ui.g2 + '夢' ? '已經刻著這一組' : ''), off: !!(x && !it.etch),
      pick: s2.html, btns: [['open2', it && it.etchD ? '改刻' : '開孔', have2 >= 1]] }, 'data-zo');
    h += K.rowHtml({ key: 'open3', ico: K.icoTag('', '', false), name: '第三孔「' + NAMES[2] + '」', color: '#94a3b8',
      desc: '瘴氣封住了最後一個孔，現在還打不開。', why: '鎖定中', off: true, btns: [['open3', '開孔', false]] }, 'data-zo');
    h += K.rowHtml({ key: 'rune', ico: K.icoTag('', '', false), name: '鑲嵌符文石', color: '#c4b5fd',
      desc: '開好的孔將來可以鑲嵌符文石（共 32 顆：補助、減傷、藥水、套裝、攻擊、寵物、職業七類），設計稿審核中。', why: '尚未開放', off: true, btns: [['rune', '鑲嵌', false]] }, 'data-zo');
    h += '<div class="ax-note">只用背包裡未上鎖的遺骸。刻上的套裝只在武器裝備在主手時生效；跟身上穿的同組遺骸不會重複計算，件數取較高的那個。</div>';
    K.repaint(box, h, '.ax-list');
  };
  var bind = function (host) {
    host.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-zomore]')) { ui.more++; render(host); return; }
      var s = ev.target.closest('[data-zosel]'); if (s) { ui.sel = s.getAttribute('data-zosel'); ui.err = ''; ui.msg = ''; render(host); return; }
      var b = ev.target.closest('button[data-zo]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-zo'), err = null; lastRef = '';
      if (a === 'open1') err = ACT.open1(ui.sel, ui.g1);
      else if (a === 'open2') err = ACT.open2(ui.sel, ui.g2);
      ui.err = err || ''; ui.msg = err ? '' : '完成了。';
      if (!err && lastRef) ui.sel = lastRef;
      render(host);
    });
    host.addEventListener('change', function (ev) {
      if (ev.target.id === 'afk-zo-g1') { ui.g1 = ev.target.value; render(host); }
      else if (ev.target.id === 'afk-zo-g2') { ui.g2 = ev.target.value; render(host); }
    });
    var t = 0;
    host.addEventListener('input', function (ev) {
      if (ev.target.id !== 'afk-zo-q') return;
      ui.q = ev.target.value; ui.more = 0; clearTimeout(t);
      t = setTimeout(function () { render(host); var q = host.querySelector('#afk-zo-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }, 250);
    });
  };
  var embed = function (div) {
    if (!div) return; K.css();
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-zo-embed';
    div.innerHTML = ''; div.appendChild(host);
    ui.err = ''; ui.msg = '';
    if (!ui.sel) { var p = P(); if (p && p.eq && isWpn(p.eq.wpn)) ui.sel = 'eq:wpn'; }
    render(host); bind(host);
  };
  K.addNpc('town_talking', { id: NPC_ID, n: NPC_N, title: '符文師', type: 'runesmith',
    d: '流浪到說話之島的符文師佐爾頓，能用席琳的遺骸替武器鑿出「星蝕·解」符文孔，刻上的套裝在主手時直接算滿 5 件。' });
  K.hookNpc(NPC_ID, NPC_N, '符文師', embed);
  W.__afkRunes = { NPC_ID: NPC_ID, act: ACT, ui: ui, embed: embed, render: render, candidates: candidates };
  console.log('[AFK-runes] 已啟用：說話之島符文師佐爾頓（星蝕·解）');
})();
