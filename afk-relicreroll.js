/* ============================================================================
 * afk-relicreroll.js — 銀騎士村 艾彼迪爾：重洗遺物的第二詞綴（玩家 2026-10-29 晚）
 *
 * 第二詞綴（武器、防具 +10；飾品 +5 時隨機繼承同部位另一件遺物的特效）抽到不喜歡的，可以到這裡重洗：
 *   ‧每次消耗：任意一件 +10 遺物（背包、未上鎖、沒昇華，不能是要洗的那件）＋ 回夢水晶 1 個
 *   ‧從同部位的遺物裡重新抽一件（不會抽到原本那件、也不會抽到第三詞綴那件）
 *   ‧抽完先給你看：「保留」原本的，或「替換」成新的；決定前不能再洗同一件（材料在抽的時候就扣了）
 *   ‧強化值、昇華、至高的支配、第三詞綴與身上所有詞綴（祝福、屬性、龍的印記…）都不會動，只換第二詞綴
 * 材料：
 *   ‧回夢香塵：席琳夢域鏡（瘋狂席琳＋夢域）裡的四龍巢穴——各區頭目 2 個、最終龍 5 個，一般怪 1% 掉 1 個
 *   ‧回夢水晶：回夢香塵 20 個在艾彼迪爾那裡換 1 個
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'relicreroll', name: '艾彼迪爾：遺物第二詞綴重洗', group: '遊戲玩法',
    desc: '銀騎士村的艾彼迪爾用一件 +10 遺物＋回夢水晶重洗遺物的第二詞綴，洗完可選保留或替換；回夢香塵在席琳夢域鏡的四龍巢穴掉落，20 個換 1 個回夢水晶' });
  if (T && !T.enabled('relicreroll')) return;
  var K = W.__afkNpcKit;
  if (!K || !DB || !DB.items) { console.warn('[AFK-relicreroll] 需要 afk-npc-kit，略過'); return; }

  var NPC_ID = 'npc_epidir', NPC_N = '艾彼迪爾';
  var DUST = 'afk_reverie_incense', CRY = 'afk_reverie_crystal', COST = { dust: 20, crystal: 1, plus: 10 };
  var DROP = { boss: 2, final: 5, mob: 0.01 };
  var ITEMS = {};
  ITEMS[DUST] = { n: '回夢香塵', c: 'text-amber-200', img: 'assets/icons/items/回夢香塵.png',
    d: '四條龍在夢裡燃盡時落下的香灰，聞起來像很久以前的某個早晨。只在席琳夢域鏡的四龍巢穴掉落（各區頭目 ' + DROP.boss + ' 個、最終龍 ' + DROP.final + ' 個、一般怪 1%）。' + COST.dust + ' 個可以在銀騎士村的艾彼迪爾那裡換 1 個回夢水晶。' };
  ITEMS[CRY] = { n: '回夢水晶', c: 'text-rose-300', img: 'assets/icons/items/完整召喚球.png',
    d: '艾彼迪爾把 ' + COST.dust + ' 個回夢香塵凝成的水晶，裡面映著遺物還沒醒來時做的夢。交給銀騎士村的艾彼迪爾，加上一件 +10 遺物，就能重洗另一件遺物的第二詞綴。' };
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, img: x.img, noUse: true, gachaWeight: 0, d: x.d };
    try { if (typeof miscCatKey === 'function' && typeof MISC_CAT_ITEMS !== 'undefined') { var k = miscCatKey(id, DB.items[id]); if (k && MISC_CAT_ITEMS[k] && !MISC_ITEM_CAT[id]) { MISC_CAT_ITEMS[k].push(id); MISC_ITEM_CAT[id] = k; if (typeof OBTAINABLE_MISC !== 'undefined') OBTAINABLE_MISC[id] = true; } } } catch (e) {}
  });

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var R = function () { return W.__afkRelicPlus || null; };
  var esc = K.esc;
  var uid = function () { return 'RR' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36); };
  var nm = function (id) { return (DB.items[id] || {}).n || id; };
  var parse = function (it) { var r = R(); return r && it && it.id ? r.parseId(it.id) : null; };

  // ── 掉落：席琳夢域鏡的四龍巢穴 ──
  var NEST = /^(?:antharas|cr_[a-z]+)_(?:nest_[123]|lair)$/;
  var dreamOn = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad && !p.classicMode); };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, map = (typeof mapState !== 'undefined') ? mapState.current : '';
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && !m._afkRrPaid && P() && dreamOn() && NEST.test(String(map || ''))) {
          m._afkRrPaid = true;
          var k = m.boss ? (/_lair$/.test(map) ? DROP.final : DROP.boss) : (Math.random() < DROP.mob ? 1 : 0);
          if (k) { gainItem(DUST, k, true); if (m.boss) { try { logSys('<span class="text-amber-200">' + esc(m.n) + ' 燃盡的地方落下 ' + k + ' 個回夢香塵。</span>'); } catch (e) {} } }
        }
      } catch (e) { console.warn('[AFK-relicreroll] drop', e); }
      return r;
    };
  }

  // ── 清單 ──
  var KIND = { all: '全部', wpn: '武器', arm: '防具', acc: '飾品' };
  var ui = { filter: 'all', sel: '', q: '', more: 0, sac: '', err: '', msg: '' }, PAGE = 60;
  // 有第二詞綴的遺物（裝備中、背包未上鎖）
  var targets = function () {
    var p = P(), out = []; if (!p || !R()) return out;
    Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k], q = parse(it); if (q && q.fx && !it.lock) out.push({ ref: 'eq:' + k, it: it, q: q, where: '裝備中' }); });
    (p.inv || []).forEach(function (it) { var q = parse(it); if (q && q.fx && !it.lock) out.push({ ref: 'inv:' + it.uid, it: it, q: q, where: '背包' + ((Number(it.cnt) || 1) > 1 ? ' ×' + it.cnt : '') }); });
    return out;
  };
  // 可以拿來當材料的 +10 遺物（背包、未上鎖、沒昇華、不是要洗的那件）
  var sacrifices = function (exceptUid) {
    var p = P(), out = []; if (!p || !R()) return out;
    (p.inv || []).forEach(function (it) {
      if (!it || it.lock || it.uid === exceptUid) return;
      var q = parse(it); if (!q || q.n !== COST.plus || q.asc != null) return;
      out.push({ it: it, q: q });
    });
    return out.sort(function (a, b) { return nm(a.q.base) < nm(b.q.base) ? -1 : 1; });
  };
  var findUid = function (u) {
    var p = P(); if (!p || !u) return null;
    for (var k in (p.eq || {})) if (p.eq[k] && p.eq[k].uid === u) return { it: p.eq[k], slot: k };
    var it = (p.inv || []).find(function (x) { return x && x.uid === u; });
    return it ? { it: it, slot: null } : null;
  };
  var plain = function (it) { try { return getItemFullName(it).replace(/<[^>]+>/g, ''); } catch (e) { return nm(it.id); } };
  var selOf = function () { var c = targets(); for (var i = 0; i < c.length; i++) if (c[i].ref === ui.sel) return c[i]; return null; };
  var fxText = function (q, fx) {
    var r = R(); if (!r || !fx) return '';
    var def = null; try { def = r.buildDef(q.base, q.n, fx, q.asc, q.evo, q.fx3); } catch (e) {}
    if (def && def.relicFxRes) return '「' + esc(nm(fx)) + '」→ 沒有可繼承的效果，改給四屬性抗性各 +3';
    var dd = DB.items[fx] && DB.items[fx].d ? String(DB.items[fx].d).replace(/<[^>]+>/g, '').replace(/\s*〔[^〕]*〕\s*$/, '') : '';
    return '「' + esc(nm(fx)) + '」的特效' + (dd ? '<div class="ax-note">' + esc(dd.length > 120 ? dd.slice(0, 120) + '…' : dd) + '</div>' : '');
  };
  var done = function (msg) {
    try { logSys(msg); } catch (e) {}
    try { if (typeof recomputeStats === 'function') recomputeStats(); else calcStats(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { saveGame(); } catch (e) {} try { updateUI(); } catch (e) {}
  };
  var pending = function () { var p = P(); var x = p && p._afkReroll; if (!x) return null; var f = findUid(x.uid); if (!f) { delete p._afkReroll; return null; } var q = parse(f.it); if (!q || q.fx !== x.oldFx) { delete p._afkReroll; return null; } return { x: x, f: f, q: q }; };

  // ── 操作（錯誤回傳訊息，成功回傳 null）──
  var lastRef = '';
  var ACT = {
    exchange: function (all) {
      var h = K.have(DUST), n = all ? Math.floor(h / COST.dust) : Math.min(1, Math.floor(h / COST.dust));
      if (n < 1) return '需要 ' + COST.dust + ' 個回夢香塵。';
      if (!K.take(DUST, n * COST.dust)) return '背包資料變動，什麼都沒有改變。';
      gainItem(CRY, n, true);
      done('<span class="text-rose-300 font-bold">' + NPC_N + '把 ' + (n * COST.dust) + ' 個回夢香塵凝成了 ' + n + ' 個回夢水晶。</span>');
      return null;
    },
    roll: function (ref, sacUid) {
      var p = P(), r = R(); if (!p) return '請先進入遊戲。'; if (!r) return '遺物合成功能已關閉。';
      if (typeof state !== 'undefined' && state && state.ff) return '補跑中，請稍候再試。';
      if (pending()) return '先決定上一次重洗的結果（保留或替換）。';
      var c = targets().filter(function (x) { return x.ref === ref; })[0];
      if (!c) return '先選一件有第二詞綴的遺物。';
      if (K.have(CRY) < COST.crystal) return '需要回夢水晶 ' + COST.crystal + ' 個。';
      var pool = r.donorsFor(c.q.base).filter(function (id) { return id !== c.q.fx && id !== c.q.fx3 && !/~/.test(id); });
      if (!pool.length) return '這件遺物沒有別的詞綴可以抽。';
      // 一疊裡拆一件出來洗
      var it = c.it;
      if (ref.indexOf('inv:') === 0 && (Number(it.cnt) || 1) > 1) { it.cnt = (Number(it.cnt) || 1) - 1; var one = Object.assign({}, it, { uid: uid(), cnt: 1 }); p.inv.push(one); it = one; }
      var sac = sacrifices(it.uid).filter(function (x) { return x.it.uid === sacUid; })[0] || null;
      if (!sac) { if (it !== c.it) { p.inv.splice(p.inv.indexOf(it), 1); c.it.cnt = (Number(c.it.cnt) || 1) + 1; } return '選一件 +' + COST.plus + ' 遺物當材料（背包、未上鎖、沒昇華）。'; }
      lastRef = ref.indexOf('eq:') === 0 ? ref : 'inv:' + it.uid;
      // 扣材料：+10 遺物一件、回夢水晶
      var s = sac.it; if ((Number(s.cnt) || 1) > 1) s.cnt = (Number(s.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(s), 1);
      K.take(CRY, COST.crystal);
      var fx = pool[Math.floor(Math.random() * pool.length)];
      p._afkReroll = { uid: it.uid, oldFx: c.q.fx, newFx: fx, at: Date.now() };
      done('<span class="text-amber-200">' + NPC_N + '把「+' + COST.plus + ' ' + esc(nm(sac.q.base)) + '」和回夢水晶一起放進香爐：' + esc(nm(c.q.base)) + '的第二詞綴在夢裡換成了「' + esc(nm(fx)) + '」。要保留原本的「' + esc(nm(c.q.fx)) + '」還是換成新的？</span>');
      return null;
    },
    decide: function (replace) {
      var p = P(), r = R(), pd = pending(); if (!p || !pd) return '沒有等待決定的重洗結果。'; if (!r) return '遺物合成功能已關閉。';
      var q = pd.q, it = pd.f.it, x = pd.x;
      delete p._afkReroll;
      lastRef = pd.f.slot ? 'eq:' + pd.f.slot : 'inv:' + it.uid;
      if (!replace) { done('<span class="text-slate-300">' + esc(nm(q.base)) + '保留原本的第二詞綴「' + esc(nm(x.oldFx)) + '」。</span>'); return null; }
      var id = r.makeId(q.base, q.n, x.newFx, q.asc, q.evo, q.fx3);
      if (!r.ensure(id)) { p._afkReroll = x; return '無法建立新的遺物資料，什麼都沒有改變。'; }
      r.remember(id);
      it.id = id;
      done('<span class="text-yellow-300 font-bold">' + esc(nm(q.base)) + '的第二詞綴換成了「' + esc(nm(x.newFx)) + '」。</span>');
      return null;
    }
  };

  // ── 面板 ──
  var render = function (box) {
    var p = P(); if (!box || !p) return;
    if (!R()) { box.innerHTML = '<p class="ax-lore">「遺物的夢現在很安靜……」（遺物合成功能已關閉）</p>'; return; }
    var pd = pending();
    if (pd) ui.sel = pd.f.slot ? 'eq:' + pd.f.slot : 'inv:' + pd.f.it.uid;
    var x = selOf(); if (!x) ui.sel = '';
    var sacAll = sacrifices(x ? x.it.uid : '');
    var h = '<p class="ax-lore">「遺物也會做夢。第二個詞綴就是它夢見的另一件遺物——讓它再睡一次，說不定會夢到你想要的那件。」——' + NPC_N + '</p>'
      + K.matBar([DUST, CRY, { img: K.iconUrl(DB.items[(sacAll[0] && sacAll[0].it.id) || CRY]), n: '+' + COST.plus + ' 遺物（可當材料）', v: sacrifices('').length }])
      + '<div class="ax-h">① 選擇遺物（有第二詞綴的）</div>'
      + '<div class="ax-filter">' + Object.keys(KIND).map(function (k) { return '<button type="button" data-rrf="' + k + '"' + (ui.filter === k ? ' class="on"' : '') + '>' + KIND[k] + '</button>'; }).join('')
      + '<input id="afk-rr-q" type="search" placeholder="搜尋遺物名稱" aria-label="搜尋遺物名稱" value="' + esc(ui.q) + '" style="flex:1 1 140px;min-width:120px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:13px"></div>';
    var q = String(ui.q || '').trim();
    var all = targets().filter(function (c) { var d = DB.items[c.q.base]; return (ui.filter === 'all' || (d && d.type === ui.filter)) && (!q || plain(c.it).indexOf(q) >= 0); });
    var lim = PAGE * (1 + ui.more), list = all.slice(0, lim);
    h += '<div class="ax-list">' + (list.length ? list.map(function (c) {
      return '<div class="ax-eq' + (c.ref === ui.sel ? ' on' : '') + '" data-rrsel="' + esc(c.ref) + '">' + K.invIco(c.it, c.ref.indexOf('eq:') === 0 ? 'eq' : 'inv')
        + '<div style="min-width:0"><div>' + K.fullName(c.it) + '</div><div class="ax-where">' + esc(c.where) + '　・第二詞綴：' + esc(nm(c.q.fx)) + '</div></div></div>';
    }).join('') + (all.length > lim ? '<div class="ax-eq ax-where" data-rrmore="1" style="justify-content:center;color:#fde68a">還有 ' + (all.length - lim).toLocaleString() + ' 件，點這裡多顯示 ' + PAGE + ' 件，或用搜尋縮小範圍</div>' : '') : '<div class="ax-eq ax-where">沒有帶第二詞綴的遺物（武器、防具 +10、飾品 +5 才有；上鎖的不會列出）。</div>') + '</div>';
    if (x) {
      h += '<div class="ax-h">已選擇</div><div class="ax-sel">' + K.invIco(x.it, x.ref.indexOf('eq:') === 0 ? 'eq' : 'inv') + '<div style="min-width:0"><div>' + K.fullName(x.it) + '</div><div class="ax-where">' + esc(x.where) + '</div>'
        + '<div class="ax-desc">目前第二詞綴：' + fxText(x.q, x.q.fx) + '</div>' + (x.q.fx3 ? '<div class="ax-note">第三詞綴「' + esc(nm(x.q.fx3)) + '」不會變。</div>' : '') + '</div></div>';
    }
    if (pd) {
      h += '<div class="ax-h">夢醒了：要哪一個？</div><div class="ax-pick">'
        + '<div class="ax-row" style="flex:1 1 260px"><div class="ax-main"><div style="min-width:0"><div class="ax-name" style="color:#94a3b8">保留原本</div><div class="ax-desc">' + fxText(pd.q, pd.x.oldFx) + '</div></div></div><div class="ax-act"><button type="button" data-rr="keep">保留</button></div></div>'
        + '<div class="ax-row" style="flex:1 1 260px;border-color:#f59e0b"><div class="ax-main"><div style="min-width:0"><div class="ax-name" style="color:#fde047">換成新的</div><div class="ax-desc">' + fxText(pd.q, pd.x.newFx) + '</div></div></div><div class="ax-act"><button type="button" data-rr="replace">替換</button></div></div>'
        + '</div><div class="ax-note">材料在重洗時已經扣掉了；關掉視窗也會記住，下次來再決定。</div>';
    }
    h += '<div class="ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + ui.msg + '</div>';
    h += '<div class="ax-h">② 服務</div>';
    if (!sacAll.some(function (s) { return s.it.uid === ui.sac; })) ui.sac = sacAll[0] ? sacAll[0].it.uid : '';
    var pick = '<select id="afk-rr-sac" aria-label="當材料的 +10 遺物">' + (sacAll.length ? sacAll.map(function (s) { return '<option value="' + esc(s.it.uid) + '"' + (s.it.uid === ui.sac ? ' selected' : '') + '>+' + COST.plus + ' ' + esc(nm(s.q.base)) + ((Number(s.it.cnt) || 1) > 1 ? ' ×' + s.it.cnt : '') + '</option>'; }).join('') : '<option value="">沒有 +' + COST.plus + ' 遺物</option>') + '</select>';
    h += K.rowHtml({ key: 'roll', ico: K.itemIco(CRY), name: '重洗第二詞綴', color: '#fde047',
      desc: '從同部位的遺物裡重新抽一件來繼承（不會抽到原本那件、也不會抽到第三詞綴那件；沒有可繼承效果的會改給四屬性抗性 +3）。抽完可以選保留或替換；強化值、昇華與身上其他詞綴都不會動。',
      note: '當材料的 +10 遺物：背包、未上鎖、沒昇華的任何一件。',
      req: K.reqTxt(K.have(CRY), COST.crystal, '回夢水晶') + '　' + K.reqTxt(sacAll.length ? 1 : 0, 1, '件 +' + COST.plus + ' 遺物'),
      why: pd ? '先決定上一次的結果' : !x ? '先在上面選一件遺物' : '', pick: pick, btns: [['roll', '重洗', K.have(CRY) >= COST.crystal && sacAll.length > 0]] }, 'data-rr');
    h += K.rowHtml({ key: 'exchange', ico: K.itemIco(DUST), name: '回夢水晶', color: '#fda4af',
      desc: COST.dust + ' 個回夢香塵換 1 個回夢水晶。回夢香塵只在席琳夢域鏡的四龍巢穴掉落：各區頭目 ' + DROP.boss + ' 個、最終龍 ' + DROP.final + ' 個、一般怪 1%。',
      req: K.reqTxt(K.have(DUST), COST.dust, '回夢香塵'), btns: [['ex1', '換 1 個', K.have(DUST) >= COST.dust], ['exAll', '全部換', K.have(DUST) >= COST.dust]] }, 'data-rr');
    K.repaint(box, h, '.ax-list');
  };
  var bind = function (host) {
    host.addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-rrf]'); if (f) { ui.filter = f.getAttribute('data-rrf'); ui.more = 0; ui.err = ''; render(host); return; }
      if (ev.target.closest('[data-rrmore]')) { ui.more++; render(host); return; }
      var s = ev.target.closest('[data-rrsel]'); if (s) { if (!pending()) { ui.sel = s.getAttribute('data-rrsel'); ui.err = ''; ui.msg = ''; } render(host); return; }
      var b = ev.target.closest('button[data-rr]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-rr'), err = null; lastRef = '';
      if (a === 'ex1' || a === 'exAll') err = ACT.exchange(a === 'exAll');
      else if (a === 'roll') err = ACT.roll(ui.sel, ui.sac);
      else if (a === 'keep' || a === 'replace') err = ACT.decide(a === 'replace');
      ui.err = err || ''; ui.msg = err ? '' : '完成了。';
      if (!err && lastRef) ui.sel = lastRef;
      render(host);
    });
    host.addEventListener('change', function (ev) { if (ev.target.id === 'afk-rr-sac') ui.sac = ev.target.value; });
    var t = 0;
    host.addEventListener('input', function (ev) {
      if (ev.target.id !== 'afk-rr-q') return;
      ui.q = ev.target.value; ui.more = 0; clearTimeout(t);
      t = setTimeout(function () { render(host); var q = host.querySelector('#afk-rr-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }, 250);
    });
  };
  var embed = function (div) {
    if (!div) return; K.css();
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-rr-embed';
    div.innerHTML = ''; div.appendChild(host);
    ui.err = ''; ui.msg = '';
    render(host); bind(host);
  };
  K.addNpc('town_silver_knight', { id: NPC_ID, n: NPC_N, title: '遺物重洗', type: 'relicreroll',
    d: '銀騎士村的解夢人艾彼迪爾，說遺物也會做夢。用一件 +10 遺物和回夢水晶，替別的遺物重洗第二詞綴，洗完可以選保留或替換。' });
  K.hookNpc(NPC_ID, NPC_N, '遺物重洗', embed);
  W.__afkRelicReroll = { NPC_ID: NPC_ID, DUST: DUST, CRY: CRY, COST: COST, DROP: DROP, act: ACT, ui: ui, embed: embed, targets: targets, sacrifices: sacrifices, pending: pending };
  console.log('[AFK-relicreroll] 已啟用：銀騎士村艾彼迪爾（遺物第二詞綴重洗、回夢香塵／回夢水晶）');
})();
