/* ============================================================================
 * afk-explog.js — 經驗日誌（Ping 11-17 22:39：先做給我看，再決定上線）
 *
 *   戰鬥日誌／系統日誌旁邊多一個「經驗日誌」分頁：每打倒一隻怪記一行
 *     「你獲得了經驗值 354。下次升級還差 12,345 經驗。」
 *   升級時另外記一行。一轉 Lv100 以後的巔峰經驗也一起顯示（離下一級巔峰還差多少）。
 *   外掛開關 explog（設定裡可以關掉，關掉就整個分頁不出現）。打太快（快轉／補跑）也照記不漏，先排隊再一次寫進畫面，最多留 200 行。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'explog', name: '經驗日誌分頁', group: '介面', desc: '戰鬥日誌、系統日誌旁邊多一個「經驗日誌」分頁：每次打倒怪物顯示得到多少經驗、離下次升級還差多少' });
  if (T && !T.enabled('explog')) return;
  var MAX = 200;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  // 11-21 效能：toLocaleString 很慢（補跑每隻怪都會叫），改成自己加千分位（結果一樣）
  var fmt = function (n) { return String(Math.max(0, Math.floor(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (p) { try { return typeof W.__afkLvCap === 'function' ? W.__afkLvCap(p) : 100; } catch (e) { return 100; } };
  var req = function (lv) { try { return typeof getExpReq === 'function' ? Number(getExpReq(lv)) || 0 : 0; } catch (e) { return 0; } };
  var on = false;   // 目前是否在經驗分頁
  // 巔峰（一轉 Lv100 以後另外累積的經驗）
  var pcost = function (p, lv) { try { var C = W.LineageGrowthCore; return C.xpCost(Number(p.rebirth) || 0, req(100), lv); } catch (e) { return 0; } };
  var par = function (p) {
    try {
      var G = W.LineageGrowth, C = W.LineageGrowthCore; if (!p || !G || !C) return null;
      var g = G.read(p); if (!g || !g.paragon) return null;
      var lv = Number(g.paragon.level) || 0, mx = lv >= C.PMAX;
      return { lv: lv, xp: Number(g.paragon.xp) || 0, cost: mx ? 0 : pcost(p, lv + 1), max: mx };
    } catch (e) { return null; }
  };

  // ── 畫面：分頁按鈕＋日誌框 ──
  var mount = function () {
    if (document.getElementById('logtab-btn-exp')) return true;
    var bs = document.getElementById('logtab-btn-sys'), sl = document.getElementById('sys-log');
    if (!bs || !sl) return false;
    var b = document.createElement('button');
    b.id = 'logtab-btn-exp'; b.type = 'button'; b.className = 'logtab-btn'; b.textContent = '經驗日誌';
    b.addEventListener('click', function () { show(true); });
    bs.parentNode.insertBefore(b, bs.nextSibling);
    var box = document.createElement('div');
    box.id = 'exp-log'; box.className = 'hidden flex-1 p-4 overflow-y-auto log-bg rounded-b-xl shadow-inner text-base';
    sl.parentNode.insertBefore(box, sl.nextSibling);
    return true;
  };
  var show = function (yes) {
    if (!mount()) return;
    on = !!yes;
    var box = document.getElementById('exp-log'), b = document.getElementById('logtab-btn-exp');
    if (on) {
      try { W.switchLogTab('combat'); } catch (e) {}
      on = true;
      ['combat-log', 'sys-log', 'combat-log-unlock', 'sys-log-unlock'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.add('hidden'); });
      var pills = document.getElementById('combat-filter-pills'); if (pills) pills.classList.add('hidden');
      ['logtab-btn-combat', 'logtab-btn-sys'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.remove('logtab-on'); });
      box.classList.remove('hidden'); b.classList.add('logtab-on'); document.body.classList.add('afk-explog-on');
      box.scrollTop = box.scrollHeight;
    } else {
      box.classList.add('hidden'); b.classList.remove('logtab-on'); document.body.classList.remove('afk-explog-on');
    }
  };
  if (typeof W.switchLogTab === 'function') {
    var oSw = W.switchLogTab;
    W.switchLogTab = function () { if (on) { on = false; var box = document.getElementById('exp-log'), b = document.getElementById('logtab-btn-exp'); if (box) box.classList.add('hidden'); if (b) b.classList.remove('logtab-on'); document.body.classList.remove('afk-explog-on'); } return oSw.apply(this, arguments); };
    try { (0, eval)('switchLogTab = window.switchLogTab'); } catch (e) {}
  }
  // 11-18（Ping）：打太快時不能漏——補跑／前景跟不上（state.ff）也照記，先放佇列，下一個空檔一次寫進畫面（只留最後 MAX 行）
  var Q = [], flushT = 0;
  var flush = function () {
    flushT = 0;
    if (!Q.length || !mount()) { if (Q.length) flushT = setTimeout(flush, 1000); return; }
    var box = document.getElementById('exp-log');
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    var list = Q.splice(0, Q.length);
    if (list.length > MAX) list = list.slice(-MAX);
    box.insertAdjacentHTML('beforeend', list.map(function (h) { return '<div class="log-entry text-slate-100">' + h + '</div>'; }).join(''));
    while (box.children.length > MAX) box.removeChild(box.firstChild);
    if (atBottom) box.scrollTop = box.scrollHeight;
  };
  var add = function (html) {
    Q.push(html);
    if (Q.length > MAX * 2) Q.splice(0, Q.length - MAX);
    if (!flushT) flushT = setTimeout(flush, 120);
  };

  // ── 記錄：包 killMob，比對打倒前後的等級與經驗 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var p = P(), m = null, lv0 = 0, ex0 = 0, pg0 = par(p);
      try { m = mapState.mobs[idx]; if (p) { lv0 = Number(p.lv) || 1; ex0 = Number(p.exp) || 0; } } catch (e) {}
      var r = oKill.apply(this, arguments);
      try {
        if (!p || p !== P() || !m) return r;
        var lv1 = Number(p.lv) || 1, ex1 = Number(p.exp) || 0, gain;
        if (lv1 === lv0) gain = ex1 - ex0;
        else { gain = Math.max(0, req(lv0) - ex0); for (var l = lv0 + 1; l < lv1; l++) gain += req(l); gain += ex1; }
        var name = esc(m.n || '怪物'), atCap = lv1 >= cap(p), need = req(lv1) - ex1, pg1 = par(p);
        var pgain = 0;
        if (pg0 && pg1) { if (pg1.lv === pg0.lv) pgain = pg1.xp - pg0.xp; else { pgain = Math.max(0, pg0.cost - pg0.xp) + pg1.xp; for (var q = pg0.lv + 1; q < pg1.lv; q++) pgain += pcost(p, q + 1); } }
        if (!(gain > 0) && !(pgain > 0)) {
          // 11-18（Ping）：滿等（巔峰也滿或沒開）也要顯示：給這隻怪的經驗（參考值）
          if (!atCap) return r;
          var ref = 0;
          try { ref = Math.floor(N(m.exp) * (1 + (typeof partyExpBonusPct === 'function' ? N(partyExpBonusPct()) : 0) / 100) * (1 + (typeof dollFieldVal === 'function' ? N(dollFieldVal('expBonus')) : 0) / 100)); } catch (e) {}
          if (!(ref > 0)) return r;
          add('擊殺 <span class="text-amber-100">' + name + '</span>　獲得經驗 <b class="text-amber-200">' + fmt(ref) + '</b>' + '<br><span class="text-slate-400">已滿等（Lv.' + lv1 + '）' + (pg1 && pg1.max ? '，巔峰也已滿' : '') + '</span>');
          return r;
        }
        // 格式（Ping 11-17 22:44）：擊殺 怪物名稱　獲得經驗 xxxx ／ 下次升級所需 yyyy！
        var line = '擊殺 <span class="text-amber-100">' + name + '</span>';
        if (gain > 0) line += '　獲得經驗 <b class="text-amber-200">' + fmt(gain) + '</b>';
        if (pgain > 0) line += '　' + (gain > 0 ? '巔峰經驗' : '獲得巔峰經驗') + ' <b class="text-fuchsia-200">' + fmt(pgain) + '</b>';
        if (gain > 0 && !atCap) line += '<br><span class="text-sky-300">下次升級所需 ' + fmt(need) + '！</span>';
        else if (pgain > 0) line += pg1.max ? '<br><span class="text-slate-400">巔峰已滿</span>' : '<br><span class="text-fuchsia-300">下次巔峰升級（P' + (pg1.lv + 1) + '）所需 ' + fmt(pg1.cost - pg1.xp) + '！</span>';
        add(line);
        if (lv1 > lv0) add('<span class="text-yellow-300 font-bold">升級了！目前 Lv.' + lv1 + '。</span>');
        if (pg0 && pg1 && pg1.lv > pg0.lv) add('<span class="text-fuchsia-300 font-bold">巔峰升級了！目前 P' + pg1.lv + '。</span>');
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  try { var cs = document.createElement('style'); cs.textContent = 'body.afk-explog-on #lm-log-options,body.afk-explog-on #lm-log-empty{display:none!important}'; document.head.appendChild(cs); } catch (e) {}   // 手機：經驗分頁不顯示戰鬥訊息篩選
  var tryMount = function () { if (!mount()) setTimeout(tryMount, 1000); };
  tryMount();
  W.__afkExpLog = { show: show, add: add };
})();
