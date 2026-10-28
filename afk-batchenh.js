/* ============================================================================
 * afk-batchenh.js — 同款批次強化
 *
 * 玩家在背包點一件武器／防具／飾品，物品視窗多一顆「同款批次強化」：
 *   找出背包裡「完整名稱一模一樣」的同款（同 id、同強化值、同祝福／屬性／遠古／套裝／★
 *   ——以核心 getItemFullName 為準，另比 id 與 en），排除鎖定、遺物、無法強化者，
 *   讓玩家選：數量 N、卷軸（一般／祝福；飾品只有一般）、方式
 *     (a) 每件一張：每件只用一張卷軸；
 *     (b) 逐件衝到 +X：一件衝到目標、爆掉或卷軸用完才換下一件。
 *   設定 → 確認（件數、卷軸持有/需要、會不會爆）→ 執行 → 結果（成功/沒變化/消失、強化值分布、剩餘卷軸）。
 *
 * 🔑 機率一律不自己算：每一張卷軸都呼叫核心 doEnhance（js/08，單抽強化的唯一實作；
 *   成敗走 enhanceRollOutcome、祝福跳級走 blessEnhanceGain、遺物/noEnhance/上限都由它擋）。
 *   作法同 afk-cursebatch：把 doEnhance 的副作用（logSys / calcStats / renderTabs / saveGame /
 *   closeModal）暫時換成空函式，迴圈呼叫 window.doEnhance（含其他外掛的包裝，如亞丁近衛裝備
 *   禁止一般強化），結束後統一 calcStats → renderTabs(true) → saveGame() 一次。
 *   「卷軸沒被扣」＝核心擋下了 → 整批停止，把核心吐的訊息當原因。
 *
 * ⚠️ 背包堆疊（cnt>1）要先自己拆一件出來再交給 doEnhance——核心每次呼叫都會再拆一件，
 *   拿原堆疊 uid 連打會變成拆出 N 件各 +1。跑完把存活件用核心 invMergeBack 併回同簽章堆疊。
 * ⚠️ 補跑中（state.ff）一律拒絕；鎖定、遺物、亞丁近衛裝備不列入同款。
 * ⚠️ 強化值有變的件會清掉廢品標記（避免衝上去的裝備被自動販賣掃走）。
 *
 * 入口：包 window.openModal（js/10），在 #modal-actions 尾端加按鈕（同款可強化 ≥2 件才出現）。
 * 測試：window.AFK_BATCHENH.run(uid, {n, bless, mode:'one'|'target', target}) 不開 UI 直接跑、回傳結果。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-batchenh.js">（排在 afk-ui 之後）。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'batchenh', name: '同款批次強化', group: '遊戲介面', def: true,
      desc: '物品視窗可把背包裡同款裝備一次強化多件'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('batchenh'); }

  var MUTE = ['logSys', 'calcStats', 'renderTabs', 'saveGame', 'closeModal'];
  var EDGE = '#765036', GOLD = '#e8c48a', INK = '#ddd8d2', SUB = '#b3aa9e';

  // ── 資料判斷 ────────────────────────────────────────────────
  function plain(html) { return String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function enOf(it) { return Number(it && it.en) || 0; }
  function fmtEn(en) { return en < 0 ? String(en) : '+' + en; }
  function busy() { return typeof state !== 'undefined' && state && state.ff; }

  // 卷軸 id（與核心 showEnhanceOptions / _quickEnhanceUnit 同一套；飾品沒有祝福卷）
  function scrollIds(d) {
    if (d.type === 'wpn') return { norm: 'scroll_weapon', bless: 'scroll_weapon_b' };
    if (d.type === 'arm') return { norm: 'scroll_armor', bless: 'scroll_armor_b' };
    if (d.type === 'acc') return { norm: 'scroll_acc', bless: null };
    return null;
  }
  function scrollCnt(id) {
    if (!id) return 0;
    var n = 0;
    player.inv.forEach(function (i) { if (i.id === id) n += (i.cnt || 0); });
    return n;
  }
  function scrollStack(id) { return player.inv.find(function (i) { return i.id === id && (i.cnt || 0) > 0; }) || null; }

  // 這件能不能被批次強化（不看鎖定——鎖定在分組時另外排除，讓點到鎖定件也能處理其他同款）
  function enhanceable(it, d) {
    if (!it || !d) return false;
    if (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') return false;
    if (d.isArrow || d.noEnhance || d.afkZomg) return false;
    if (typeof isRelic === 'function' && isRelic(d)) return false;   // 核心：遺物不能用一般強化卷
    if (typeof _qeCanSelect === 'function') {   // 核心「快速強化」的資格判定（單一真相，其他外掛也會包它）
      var t = d.type === 'wpn' ? 'wpn' : 'arm';
      if (!_qeCanSelect(d, Object.assign({}, it, { lock: false }), t)) return false;
    }
    return true;
  }
  function groupKey(it) {
    var nm = '';
    try { nm = getItemFullName(Object.assign({}, it, { cnt: 1 })); } catch (e) { nm = ''; }   // 名稱尾巴的 (數量) 不入鍵
    return it.id + '|' + enOf(it) + '|' + nm;
  }
  // 同款群組：{ item, d, key, entries[], count, en, cap, safe, ids }
  function groupOf(uidOrItem) {
    var it = typeof uidOrItem === 'object' ? uidOrItem : player.inv.find(function (i) { return i.uid === uidOrItem; });
    if (!it || player.inv.indexOf(it) < 0) return null;   // 只處理背包裡的（身上裝備不在 inv）
    var d = DB.items[it.id];
    if (!enhanceable(it, d)) return null;
    var key = groupKey(it);
    var entries = player.inv.filter(function (i) { return !i.lock && i.id === it.id && enhanceable(i, d) && groupKey(i) === key; });
    var count = 0;
    entries.forEach(function (e) { count += (e.cnt || 1); });
    return { item: it, d: d, key: key, entries: entries, count: count, en: enOf(it),
             cap: enhanceCap(d), safe: d.safe || 0, ids: scrollIds(d) };
  }

  // 規劃：數量/卷軸/方式 正規化 + 摘要數字（不擲骰）
  function plan(g, opt) {
    opt = opt || {};
    var n = Math.max(1, Math.min(g.count, Math.floor(Number(opt.n) || g.count)));
    var bless = !!(opt.bless && g.ids.bless && DB.items[g.ids.bless]);
    var sid = bless ? g.ids.bless : g.ids.norm;
    var mode = opt.mode === 'target' ? 'target' : 'one';
    var target = Math.min(g.cap, Math.max(g.en + 1, Math.floor(Number(opt.target) || 0) || Math.max(g.safe, g.en + 1)));
    var steps = mode === 'one' ? 1 : (target - g.en);
    var need = n * steps;                       // 全部成功時的張數（爆掉的件會少用；武器 +9 起「沒變化」會多用）
    var have = scrollCnt(sid);
    var risky = (mode === 'one' ? g.en : target - 1) >= g.safe;   // 有任何一擲落在安定值以上＝可能消失
    var extra = g.d.type === 'wpn' && (mode === 'one' ? g.en : target - 1) >= 9;   // 核心：武器 +9 起有 1/6「沒變化」（卷軸照扣）
    return { n: n, bless: bless, sid: sid, mode: mode, target: target, need: need, have: have, risky: risky, extra: extra,
             atCap: g.en >= g.cap };
  }

  // ── 執行（核心 doEnhance × N）──────────────────────────────
  function run(uidOrItem, opt) {
    var res = { ok: false };
    if (!on()) { res.error = '同款批次強化已關閉。'; return res; }
    if (typeof player === 'undefined' || !player || !player.cls || !Array.isArray(player.inv)) { res.error = '尚未載入角色。'; return res; }
    if (busy()) { res.error = '離線補跑中，請等補跑結束再強化。'; return res; }
    var g = groupOf(uidOrItem);
    if (!g) { res.error = '這件裝備不能批次強化。'; return res; }
    var p = plan(g, opt);
    if (p.atCap) { res.error = '已達強化上限。'; return res; }
    if (p.have <= 0) { res.error = (DB.items[p.sid] ? DB.items[p.sid].n : '強化卷軸') + ' 不足。'; return res; }

    var name0 = plain(getItemFullName(Object.assign({}, g.item, { cnt: 1 })));
    var d = g.d, sid = p.sid, startEn = g.en;
    var queue = g.entries.slice();   // 依序從這些堆疊拆件
    var done = [];                   // 拆出來的單件 uid（全部要併回堆疊）
    var touched = {};                // 真的用到卷軸的單件 uid（只有這些算進結果分布）
    var stats = { success: 0, same: 0, gone: 0, reached: 0, used: 0, untouched: 0 };
    var stop = '', msgs = [];
    var saved = {};
    MUTE.forEach(function (k) { saved[k] = window[k]; });
    window.logSys = function (m) { msgs.push(m); };
    window.calcStats = window.renderTabs = window.saveGame = window.closeModal = function () {};
    var processed = 0;
    try {
      for (var k = 0; k < p.n; k++) {
        // 拆一件出來（堆疊 cnt>1 時；只剩 1 件就直接用它本身）
        var src = null;
        while (queue.length) {
          var q = queue[0];
          if (player.inv.indexOf(q) >= 0 && (q.cnt || 1) > 0 && !q.lock) { src = q; break; }
          queue.shift();
        }
        if (!src) { stop = '同款裝備不夠了。'; break; }
        var unit;
        if ((src.cnt || 1) > 1) {
          src.cnt -= 1;
          unit = Object.assign({}, src, { cnt: 1, uid: uid() });
          player.inv.push(unit);
        } else { unit = src; queue.shift(); }
        done.push(unit.uid);
        processed++;

        var tid = unit.uid, tries = 0, gone = false, blocked = false;
        while (true) {
          var t = player.inv.find(function (i) { return i.uid === tid; });
          if (!t) { gone = true; break; }
          if (p.mode === 'one' ? tries >= 1 : enOf(t) >= p.target) break;
          if (enOf(t) >= g.cap) break;
          var sc = scrollStack(sid);
          if (!sc) { stop = DB.items[sid].n + ' 用完了。'; break; }
          var c0 = sc.cnt;
          msgs.length = 0;
          activeScroll = sc;
          window.doEnhance(tid, false);   // ← 核心單抽強化（機率／祝福跳級／爆裝都在裡面）
          activeScroll = null;
          if (sc.cnt >= c0) { blocked = true; stop = plain(msgs[msgs.length - 1]) || '被擋下了。'; break; }
          tries++; stats.used += c0 - sc.cnt; touched[tid] = true;
        }
        var tN = player.inv.find(function (i) { return i.uid === tid; });
        if (!tN) stats.gone++;
        else if (enOf(tN) > startEn) { stats.success++; if (p.mode === 'target' && enOf(tN) >= p.target) stats.reached++; }
        else if (tries > 0) stats.same++;
        else { stats.untouched++; processed--; }   // 一張都沒用到（卷軸剛好用完 / 被擋）
        if (blocked || (stop && !gone)) break;
      }
    } catch (e) {
      console.warn('[AFK-batchenh] 執行中斷', e);
      stop = '執行中斷。';
    } finally {
      activeScroll = null;
      MUTE.forEach(function (k2) { window[k2] = saved[k2]; });
    }
    stats.untouched += Math.max(0, p.n - processed - stats.untouched);

    // 存活件：清掉變動件的廢品標記 → 併回同簽章堆疊（核心 invMergeBack）
    var dist = {};
    var survivors = [];
    done.forEach(function (u) {
      var it = player.inv.find(function (i) { return i.uid === u; });
      if (!it) return;
      var en = enOf(it);
      if (en !== startEn) { it.junk = false; delete it.junkSince; delete it._autoSellQty; delete it._ruleJunk; }
      if (touched[u]) dist[en] = (dist[en] || 0) + 1;
      survivors.push(it);
    });
    survivors.forEach(function (it) {
      var idx = player.inv.indexOf(it);
      if (idx < 0) return;
      player.inv.splice(idx, 1);
      try { if (!invMergeBack(it)) player.inv.push(it); } catch (e) { player.inv.push(it); }
    });

    try { calcStats(); } catch (e) {}
    try { renderTabs(true); } catch (e) {}
    try { if (player && player.cls) saveGame(); } catch (e) { console.warn('[AFK-batchenh] 存檔失敗', e); }

    var distArr = Object.keys(dist).map(Number).sort(function (a, b) { return a - b; })
      .map(function (en) { return { en: en, cnt: dist[en] }; });
    res = {
      ok: true, name: name0, id: g.item.id, startEn: startEn, mode: p.mode, target: p.mode === 'target' ? p.target : startEn + 1,
      bless: p.bless, scroll: DB.items[sid].n, requested: p.n, processed: processed,
      success: stats.success, reached: stats.reached, same: stats.same, gone: stats.gone, untouched: stats.untouched,
      used: stats.used, left: scrollCnt(sid), dist: distArr,
      distText: distArr.map(function (x) { return fmtEn(x.en) + ' ×' + x.cnt; }).join('、'), stop: stop
    };
    try {
      logSys('<span class="text-amber-300 font-bold">同款批次強化：</span>' + esc(name0) + ' ×' + processed
        + '　成功 ' + res.success + '、沒變化 ' + res.same + '、<span class="text-red-400">消失 ' + res.gone + '</span>'
        + (res.distText ? '　⇒ ' + res.distText : '') + '，用了 ' + res.used + ' 張' + res.scroll + '。'
        + (stop ? '<span class="text-amber-300"> 中止：' + esc(stop) + '</span>' : ''));
    } catch (e) {}
    return res;
  }

  // ── 介面 ────────────────────────────────────────────────────
  var modal = null, card = null, layer = null, CUR = null;

  function injectCss() {
    if (document.getElementById('afk-be-css')) return;
    var PANEL = 'linear-gradient(180deg,var(--lineage-panel,#302f39) 0%,#2a2933 55%,var(--lineage-panel-deep,#24232b) 100%)';
    var BTN = 'linear-gradient(180deg,#332c2c 0%,#211e22 55%,#17161a 100%)';
    var BTN_H = 'linear-gradient(180deg,#493a34 0%,#2c2527 58%,#1b181c 100%)';
    var BTN_ON = 'linear-gradient(180deg,#704b34 0%,#3f2c26 58%,#231b1c 100%)';
    var s = document.createElement('style');
    s.id = 'afk-be-css';
    s.textContent = [
      '#afk-be-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9000;background:rgba(8,6,8,.78);align-items:center;justify-content:center;padding:16px;}',
      '#afk-be-modal.open{display:flex;}',
      '#afk-be-card{width:min(400px,100%);max-height:100%;display:flex;flex-direction:column;background:' + PANEL + ';border:2px solid ' + EDGE + ';border-radius:.35rem;color:' + INK + ';font-size:14px;line-height:1.6;box-shadow:inset 0 0 0 1px rgba(12,10,12,.78),inset 0 1px rgba(220,177,116,.14),0 10px 26px rgba(0,0,0,.7);padding:14px 16px;}',
      '#afk-be-card h3{flex:none;margin:0 0 10px;color:' + GOLD + ';font-size:16px;font-weight:bold;letter-spacing:.06em;text-shadow:1px 1px 0 #000;border-bottom:1px solid #5a3b29;padding-bottom:6px;}',
      '#afk-be-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;}',
      '.afk-be-item{display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#2b2830 0%,#211f26 100%);border:1px solid #4e3526;border-radius:.25rem;padding:6px 8px;margin-bottom:10px;}',
      '.afk-be-item img{width:28px;height:28px;object-fit:contain;flex:none;}',
      '.afk-be-item .nm{font-weight:bold;flex:1;min-width:0;}',
      '.afk-be-item .ct{color:' + SUB + ';white-space:nowrap;}',
      '.afk-be-row{display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap;}',
      '.afk-be-row > label.k{width:44px;flex:none;color:' + SUB + ';}',
      '.afk-be-seg{display:flex;flex:1;gap:6px;min-width:0;}',
      '.afk-be-seg button,.afk-be-btn,.afk-be-row select,.afk-be-row input[type=number]{background:' + BTN + ';border:1px solid ' + EDGE + ';border-radius:.25rem;color:#f1ede8;font-size:14px;font-family:inherit;padding:6px 8px;}',
      '.afk-be-seg button{flex:1;min-width:0;cursor:pointer;white-space:nowrap;}',
      '.afk-be-seg button:hover:not([disabled]),.afk-be-btn:hover:not([disabled]){background:' + BTN_H + ';border-color:#a97a50;}',
      '.afk-be-seg button.on{background:' + BTN_ON + ';border-color:#c0935d;color:#fff3df;font-weight:bold;}',
      '.afk-be-seg button[disabled]{opacity:.4;cursor:not-allowed;}',
      '.afk-be-row input[type=number]{width:72px;font-size:16px;padding:4px 6px;}',
      '.afk-be-row input[type=range]{flex:1;min-width:90px;accent-color:#c0935d;}',
      '.afk-be-row select{padding:4px 6px;}',
      '.afk-be-sum{background:#17161b;border:1px solid #4e3526;border-radius:.25rem;padding:8px 10px;margin:4px 0 12px;}',
      '.afk-be-sum b{color:' + GOLD + ';font-variant-numeric:tabular-nums;}',
      '.afk-be-sum .bad{color:#f87171;}.afk-be-sum .good{color:#86efac;}.afk-be-sum .warn{color:#fbbf24;}',
      '.afk-be-btns{flex:none;display:flex;gap:8px;margin-top:4px;}',
      '.afk-be-btn{flex:1;padding:9px;font-weight:bold;cursor:pointer;}',
      '.afk-be-btn.go{background:' + BTN_ON + ';border-color:#c0935d;color:#fff3df;}',
      '.afk-be-btn.danger{background:linear-gradient(180deg,#6b2a26 0%,#43201d 58%,#251515 100%);border-color:#b2504a;color:#ffe2dc;}',
      '.afk-be-btn[disabled]{opacity:.4;cursor:not-allowed;}',
      '.afk-be-res{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;text-align:center;}',
      '.afk-be-res div{background:#17161b;border:1px solid #4e3526;border-radius:.25rem;padding:6px 2px;}',
      '.afk-be-res b{display:block;font-size:20px;color:' + GOLD + ';font-variant-numeric:tabular-nums;}',
      '.afk-be-res .g b{color:#86efac;}.afk-be-res .r b{color:#f87171;}',
      '.afk-be-res span{color:' + SUB + ';font-size:13px;}',
      // 開關按鈕（物品視窗內，沿用核心按鈕 class，只補銅金配色）
      '.afk-be-open{border-color:' + EDGE + '!important;background:linear-gradient(180deg,#493a34 0%,#2c2527 58%,#1b181c 100%)!important;color:' + GOLD + '!important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }
  function build() {
    injectCss();
    modal = document.createElement('div');
    modal.id = 'afk-be-modal';
    modal.innerHTML = '<div id="afk-be-card"></div>';
    document.body.appendChild(modal);
    card = modal.querySelector('#afk-be-card');
    modal.addEventListener('click', function (e) { if (e.target === modal && CUR && CUR.view !== 'running') close(); });
  }
  function show() {
    if (!modal) build();
    if (!modal.classList.contains('open')) {
      modal.classList.add('open');
      layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(hide) : null;   // 返回鍵 / ESC 關閉
    }
  }
  function hide() { if (modal) modal.classList.remove('open'); layer = null; CUR = null; }
  function close() { if (layer && window.AFK_UI && AFK_UI.closeLayer) AFK_UI.closeLayer(layer); else hide(); }

  function itemHead(g, cntText) {
    var icon = '';
    try { icon = '<img src="' + getIconUrl(g.d) + '" onerror="this.style.display=\'none\'">'; } catch (e) {}
    var nm = getItemFullName(Object.assign({}, g.item, { cnt: 1 }));
    return '<div class="afk-be-item">' + icon + '<span class="nm">' + nm + '</span><span class="ct">' + cntText + '</span></div>';
  }

  function renderSetup() {
    var g = groupOf(CUR.uid);
    if (!g) { close(); return; }
    var o = CUR.opt;
    var p = plan(g, o);
    o.n = p.n; o.bless = p.bless; o.target = p.target;
    var normN = scrollCnt(g.ids.norm), blessN = g.ids.bless ? scrollCnt(g.ids.bless) : 0;
    var tOpts = '';
    for (var t = g.en + 1; t <= g.cap; t++) tOpts += '<option value="' + t + '"' + (t === p.target ? ' selected' : '') + '>' + fmtEn(t) + (t <= g.safe ? '（安定）' : '') + '</option>';

    var h = '<h3>同款批次強化</h3><div id="afk-be-body">' + itemHead(g, '背包 ' + g.count + ' 件');
    h += '<div class="afk-be-row"><label class="k">數量</label>'
      + '<input type="range" id="afk-be-n-r" min="1" max="' + g.count + '" value="' + p.n + '">'
      + '<input type="number" id="afk-be-n" min="1" max="' + g.count + '" value="' + p.n + '"></div>';
    h += '<div class="afk-be-row"><label class="k">卷軸</label><div class="afk-be-seg">'
      + '<button type="button" data-bless="0" class="' + (!p.bless ? 'on' : '') + '">一般（' + normN + '）</button>'
      + (g.ids.bless ? '<button type="button" data-bless="1" class="' + (p.bless ? 'on' : '') + '"' + (blessN > 0 ? '' : ' disabled') + '>祝福（' + blessN + '）</button>' : '')
      + '</div></div>';
    h += '<div class="afk-be-row"><label class="k">方式</label><div class="afk-be-seg">'
      + '<button type="button" data-mode="one" class="' + (p.mode === 'one' ? 'on' : '') + '">每件一張</button>'
      + '<button type="button" data-mode="target" class="' + (p.mode === 'target' ? 'on' : '') + '">逐件衝到</button>'
      + '</div><select id="afk-be-t"' + (p.mode === 'target' ? '' : ' disabled style="opacity:.4"') + '>' + tOpts + '</select></div>';
    h += '<div class="afk-be-sum">' + sumHTML(g, p) + '</div>';
    h += '</div><div class="afk-be-btns"><button type="button" class="afk-be-btn" data-act="cancel">取消</button>'
      + '<button type="button" class="afk-be-btn go" data-act="next"' + (p.have > 0 ? '' : ' disabled') + '>下一步</button></div>';
    card.innerHTML = h;

    var nR = card.querySelector('#afk-be-n-r'), nI = card.querySelector('#afk-be-n');
    var setN = function (v, from) {
      v = Math.max(1, Math.min(g.count, Math.floor(Number(v) || 1)));
      o.n = v; if (from !== nR) nR.value = v; if (from !== nI) nI.value = v;
      card.querySelector('.afk-be-sum').innerHTML = sumHTML(g, plan(g, o));
    };
    nR.addEventListener('input', function () { setN(nR.value, nR); });
    nI.addEventListener('change', function () { setN(nI.value, nI); });
    card.querySelectorAll('[data-bless]').forEach(function (b) { b.addEventListener('click', function () { o.bless = b.getAttribute('data-bless') === '1'; renderSetup(); }); });
    card.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { o.mode = b.getAttribute('data-mode'); renderSetup(); }); });
    card.querySelector('#afk-be-t').addEventListener('change', function () { o.target = Number(this.value); renderSetup(); });
    card.querySelector('[data-act="cancel"]').addEventListener('click', close);
    card.querySelector('[data-act="next"]').addEventListener('click', function () { CUR.view = 'confirm'; renderConfirm(); });
  }

  function sumHTML(g, p) {
    var sn = DB.items[p.sid].n;
    var s = '強化 <b>' + p.n + '</b> 件，' + (p.mode === 'one' ? '每件一張 → ' + fmtEn(g.en + 1) + (p.bless ? ' 起' : '') : '逐件衝到 <b>' + fmtEn(p.target) + '</b>') + '<br>'
      + sn + '：需要' + (p.mode === 'one' ? ' ' : '最多 ') + '<b>' + p.need + '</b> 張，持有 <b' + (p.have < p.need ? ' class="bad"' : '') + '>' + p.have + '</b> 張';
    if (p.have <= 0) s += '<br><span class="bad">沒有' + sn + '。</span>';
    else if (p.have < p.need) s += '<br><span class="warn">卷軸不夠，用完就停。</span>';
    if (p.extra) s += '<br><span class="warn">武器 +9 起可能「沒變化」，卷軸照扣。</span>';
    s += '<br>' + (p.risky
      ? '<span class="bad">超過安定值 ' + fmtEn(g.safe) + '，失敗的裝備會消失。</span>'
      : '<span class="good">都在安定值 ' + fmtEn(g.safe) + ' 內，必定成功。</span>');
    return s;
  }

  function renderConfirm() {
    var g = groupOf(CUR.uid);
    if (!g) { close(); return; }
    var p = plan(g, CUR.opt);
    var h = '<h3>確認強化</h3><div id="afk-be-body">' + itemHead(g, '× ' + p.n)
      + '<div class="afk-be-sum">' + sumHTML(g, p) + '</div></div>'
      + '<div class="afk-be-btns"><button type="button" class="afk-be-btn" data-act="back">返回</button>'
      + '<button type="button" class="afk-be-btn ' + (p.risky ? 'danger' : 'go') + '" data-act="go">開始強化</button></div>';
    card.innerHTML = h;
    card.querySelector('[data-act="back"]').addEventListener('click', function () { CUR.view = 'setup'; renderSetup(); });
    card.querySelector('[data-act="go"]').addEventListener('click', function () {
      if (busy()) { renderError('離線補跑中，請等補跑結束再強化。'); return; }
      CUR.view = 'running';
      var r = run(CUR.uid, CUR.opt);
      if (!r.ok) { renderError(r.error); return; }
      CUR.view = 'result';
      renderResult(r);
    });
  }

  function renderResult(r) {
    var h = '<h3>強化結果</h3><div id="afk-be-body">'
      + '<div class="afk-be-item"><span class="nm">' + esc(r.name) + '</span><span class="ct">× ' + r.processed + '</span></div>'
      + '<div class="afk-be-res">'
      + (r.mode === 'target'
        ? '<div class="g"><b>' + r.reached + '</b><span>達標 ' + fmtEn(r.target) + '</span></div>'
          + '<div><b>' + (r.success - r.reached + r.same) + '</b><span>沒到目標</span></div>'
        : '<div class="g"><b>' + r.success + '</b><span>成功</span></div>'
          + '<div><b>' + r.same + '</b><span>沒變化</span></div>')
      + '<div class="r"><b>' + r.gone + '</b><span>消失</span></div></div>'
      + '<div class="afk-be-sum">'
      + (r.distText ? '現在：<b>' + esc(r.distText) + '</b><br>' : '全部消失了。<br>')
      + '用了 <b>' + r.used + '</b> 張' + esc(r.scroll) + '，剩 <b>' + r.left + '</b> 張'
      + (r.untouched ? '<br><span class="warn">' + r.untouched + ' 件沒強化到' + (r.stop ? '：' + esc(r.stop) : '。') + '</span>'
                     : (r.stop ? '<br><span class="warn">' + esc(r.stop) + '</span>' : ''))
      + '</div></div>'
      + '<div class="afk-be-btns"><button type="button" class="afk-be-btn go" data-act="ok">關閉</button></div>';
    card.innerHTML = h;
    card.querySelector('[data-act="ok"]').addEventListener('click', close);
  }
  function renderError(msg) {
    card.innerHTML = '<h3>同款批次強化</h3><div id="afk-be-body"><div class="afk-be-sum"><span class="bad">' + esc(msg) + '</span></div></div>'
      + '<div class="afk-be-btns"><button type="button" class="afk-be-btn" data-act="ok">關閉</button></div>';
    card.querySelector('[data-act="ok"]').addEventListener('click', close);
  }

  function open(uid0, opt) {
    if (!on()) return false;
    if (busy()) { try { logSys('<span class="text-amber-300">離線補跑中，請等補跑結束再強化。</span>'); } catch (e) {} return false; }
    var g = groupOf(uid0);
    if (!g) return false;
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
    CUR = { uid: g.item.uid, view: 'setup', opt: Object.assign({ n: g.count, bless: false, mode: 'one', target: Math.max(g.safe, g.en + 1) }, opt || {}) };
    show();
    renderSetup();
    return true;
  }

  window.AFK_BATCHENH = {
    group: function (u) { var g = groupOf(u); return g ? { key: g.key, count: g.count, en: g.en, safe: g.safe, cap: g.cap, uids: g.entries.map(function (e) { return e.uid; }) } : null; },
    plan: function (u, opt) { var g = groupOf(u); return g ? plan(g, opt) : null; },
    run: run,     // 不開 UI 直接跑：run(uid, {n, bless, mode:'one'|'target', target}) → 結果物件
    open: open,
    close: close
  };

  // ── 入口：物品視窗加按鈕 ─────────────────────────────────────
  function init() {
    var missing = ['openModal', 'doEnhance', 'getItemFullName', 'enhanceCap', 'invMergeBack', 'logSys', 'saveGame', 'calcStats', 'renderTabs', 'closeModal', 'uid']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length) {
      console.warn('[AFK-batchenh] 缺少核心函式（' + missing.join(',') + '），同款批次強化停用。');
      return;
    }
    var orig = window.openModal;
    window.openModal = function (item, isEq, slot) {
      var r = orig.apply(this, arguments);
      try {
        if (!on() || isEq || !item || busy()) return r;
        var g = groupOf(item.uid);
        if (!g || g.count < 2 || g.en >= g.cap) return r;
        var act = document.getElementById('modal-actions');
        if (!act) return r;
        injectCss();
        var html = '<button class="col-span-2 w-full btn afk-be-open py-3 text-lg font-bold mt-2" onclick="AFK_BATCHENH.open(\'' + g.item.uid + '\')">同款批次強化（' + g.count + ' 件）</button>';
        var enhBtn = act.querySelector('button[onclick^="showEnhanceOptions"]');   // 緊貼核心「強化」鈕下方；找不到就放最後
        if (enhBtn) enhBtn.insertAdjacentHTML('afterend', html);
        else act.insertAdjacentHTML('beforeend', html);
      } catch (e) {}
      return r;
    };
    console.log('[AFK-batchenh] hooks OK — 同款批次強化就緒。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
