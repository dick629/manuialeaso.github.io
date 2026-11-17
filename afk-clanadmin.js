/* ============================================================================
 * afk-clanadmin.js — 盟主讓位、解散血盟（Ping 11-17）
 *
 *   血盟頁面（自己是盟主時）多兩個按鈕：
 *     ‧讓位：把盟主交給同模式（一般／經典）下自己的另一個王族角色，免費。
 *     ‧解散血盟：確認兩次後，刪掉這個模式的血盟（名字、陣營、城堡、成員貢獻、血盟增益）。
 *       血盟等級（全模式共用的血盟經驗）保留；解散後可以重新花 30,000 金幣創盟。
 *   原本「血盟不會解散」的說明一併拿掉。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return typeof clanEsc === 'function' ? clanEsc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var after = function () {
    if (typeof SAVE_SLOT_MAX !== 'undefined' && typeof _clanScanCache !== 'undefined') try { _clanScanCache.at = 0; } catch (e) {}
    try { clanSyncCurrentPlayer(); } catch (e) {}
    if (typeof saveGame === 'function') saveGame();
    if (typeof updateUI === 'function') updateUI();
    try { renderClanTab(); } catch (e) {}
  };
  var heirs = function (p) {
    var me = clanRoleId(p);
    return clanScanRoles(clanModeKey(p)).filter(function (r) { return r.id !== me && r.player && r.player.cls === 'royal'; });
  };
  W.afkClanTransfer = function () {
    var p = P(); if (!p || !clanIsLeaderRole(p)) { alert('只有盟主可以讓位。'); return; }
    var sel = document.getElementById('afk-clan-heir'); var id = sel ? sel.value : '';
    var r = heirs(p).filter(function (x) { return x.id === id; })[0];
    if (!r) { alert('請選擇要接任的王族角色。'); return; }
    if (!confirm('把盟主讓給「' + (r.player.name || '王族') + '」？\n讓位後你仍是血盟成員。')) return;
    var mode = clanModeKey(p), me = clanRoleId(p);
    var res = _clanWithLock(function (st) {
      var info = st.modes[mode]; if (!info) return { commit: false, error: '你尚未加入血盟。' };
      if (info.leaderId !== me) return { commit: false, error: '你已經不是盟主了。' };
      info.leaderId = r.id;
      if (!st.members[r.id]) st.members[r.id] = { mode: mode, contribution: 0, buffOn: false, buffAt: 0 };
      return {};
    });
    if (!res.ok) { alert(res.error || '讓位失敗。'); return; }
    if (typeof logSys === 'function') logSys('<span class="text-amber-300 font-bold">盟主已讓給「' + esc(r.player.name || '王族') + '」。</span>');
    after();
  };
  W.afkClanDisband = function () {
    var p = P(); if (!p || !clanIsLeaderRole(p)) { alert('只有盟主可以解散血盟。'); return; }
    var info = clanGetModeInfo(p); if (!info) return;
    if (!confirm('確定要解散血盟「' + info.name + '」？\n血盟名字、陣營、城堡、所有成員的貢獻與血盟增益都會清除（血盟等級保留）。')) return;
    var typed = prompt('再確認一次：請輸入血盟名字「' + info.name + '」才會解散。');
    if (typed == null) return;
    if (String(typed).trim() !== info.name) { alert('名字不符，沒有解散。'); return; }
    var mode = clanModeKey(p), me = clanRoleId(p);
    var res = _clanWithLock(function (st) {
      var cur = st.modes[mode]; if (!cur) return { commit: false, error: '血盟已不存在。' };
      if (cur.leaderId !== me) return { commit: false, error: '你已經不是盟主了。' };
      st.modes[mode] = null;
      Object.keys(st.members).forEach(function (id) { if (st.members[id] && st.members[id].mode === mode) delete st.members[id]; });
      return {};
    });
    if (!res.ok) { alert(res.error || '解散失敗。'); return; }
    p.bloodPledge = null; p.clanName = null;
    if (typeof logSys === 'function') logSys('<span class="text-red-300 font-bold">血盟「' + esc(info.name) + '」已解散。</span>');
    after();
  };
  var paint = function () {
    var p = P(), div = document.getElementById('tab-clan'); if (!p || !div) return;
    try {
      var walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT), n;
      while ((n = walker.nextNode())) if (n.nodeValue.indexOf('・血盟不會解散') >= 0) n.nodeValue = n.nodeValue.replace('・血盟不會解散', '');
    } catch (e) {}
    if (div.querySelector('.afk-clan-admin') || !clanGetModeInfo(p) || !clanIsLeaderRole(p)) return;
    var hs = heirs(p);
    var box = document.createElement('div');
    box.className = 'afk-clan-admin border-t border-slate-700 pt-3';
    box.innerHTML = '<div class="text-slate-100 font-bold mb-2">盟主管理</div>'
      + '<div class="flex gap-2 mb-2">'
      + (hs.length ? '<select id="afk-clan-heir" class="min-w-0 flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded">' + hs.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.player.name || '王族') + '（Lv' + (r.player.lv || 1) + '）</option>'; }).join('') + '</select>'
        + '<button class="btn px-3 py-2 font-bold bg-amber-800 border-amber-500 text-amber-100" onclick="afkClanTransfer()">讓位</button>'
        : '<div class="flex-1 text-slate-400 text-sm py-2">同模式下沒有其他王族角色可以接任。</div>')
      + '</div>'
      + '<button class="btn w-full py-2 font-bold bg-red-950 border-red-700 text-red-200" onclick="afkClanDisband()">解散血盟</button>'
      + '<div class="text-xs text-slate-400 mt-2">讓位免費。解散會清除血盟名字、陣營、城堡、成員貢獻與增益；血盟等級保留，之後可以重新創盟。</div>';
    var inp = document.getElementById('clan-rename-input');
    var anchor = inp && inp.closest('.border-t');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else (div.firstElementChild || div).appendChild(box);
  };
  var hook = function () {
    if (typeof W.renderClanTab !== 'function' || W.renderClanTab.__afkAdmin) return;
    var o = W.renderClanTab;
    var f = function () { var v = o.apply(this, arguments); try { paint(); } catch (e) {} return v; };
    f.__afkAdmin = true; W.renderClanTab = f;
  };
  hook(); W.addEventListener('load', hook);
})();
