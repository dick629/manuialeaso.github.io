/* ============================================================================
 * afk-partylead.js — 隊伍換隊長（玩家 2026-11-03；外掛開關 partylead，預設開；經典模式沒有）
 *
 *   傭兵管理（招募傭兵的 NPC 畫面）每位隊員多一顆「當隊長」：那位隊員變成你操作的角色（隊長），
 *   原本的隊長回到那位隊員原本的位置當隊員；其他隊員與順序不變，不用解散再一個一個招募。
 *   做法（全部走核心原本的流程，不直接改存檔）：
 *     1. 每位隊員照「解散」結算經驗（_settleAllyExp，帳本制）並記住喝水／技能設定（snapshotMercPrefs）→ 清空隊伍、存檔、更新僱傭表
 *     2. returnToCharacterSelect（最終存檔、停計時器）→ currentSlot＝新隊長 → loadGame
 *     3. 新隊長照原本順序 toggleAlly 把大家招回來（舊隊長放在新隊長原本的位置）
 *   只能在安全區；離線結算中不能換。招不回來的隊員（模式不同、次元突破者的限制…）照核心原本的提示。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'partylead', name: '隊伍換隊長', group: '遊戲介面', seal: true,
    desc: '傭兵管理畫面可以指定任一隊員當隊長，原本的隊長變成隊員，不用解散重組' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('partylead'))); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var inTown = function () { return !!(typeof mapState !== 'undefined' && mapState && String(mapState.current || '').indexOf('town_') === 0); };
  var busy = function () {
    try { if (W.__afk && typeof W.__afk.busy === 'function' && W.__afk.busy()) return true; } catch (e) {}
    try { if (typeof catchupActive === 'function' && catchupActive()) return true; } catch (e) {}
    return false;
  };

  var swap = function (slotN) {
    var p = P(); slotN = String(slotN);
    if (!p || !on()) return { ok: false, msg: '目前不能換隊長。' };
    if (!inTown()) return { ok: false, msg: '只能在安全區換隊長。' };
    if (busy()) return { ok: false, msg: '離線結算中，結束後才能換隊長。' };
    if (typeof state !== 'undefined' && state && (state.riftRun || state.antharas || state._afkFinal)) return { ok: false, msg: '副本裡不能換隊長。' };
    var allies = (p.allies || []).filter(Boolean), idx = -1;
    allies.forEach(function (a, i) { if (String(a._slot) === slotN) idx = i; });
    if (idx < 0) return { ok: false, msg: '這個角色不在隊伍裡。' };
    if (typeof slotSummary === 'function' && !slotSummary(slotN)) return { ok: false, msg: '存檔 ' + slotN + ' 沒有角色。' };
    var oldSlot = String(currentSlot), oldName = p.name || ('存檔 ' + oldSlot), newName = allies[idx]._allyName || ('存檔 ' + slotN);
    var order = allies.map(function (a) { return String(a._slot); }); order[idx] = oldSlot;
    // 1. 照解散結算
    allies.forEach(function (a) {
      try { if (typeof snapshotMercPrefs === 'function') snapshotMercPrefs(a); } catch (e) {}
      try { if (typeof _settleAllyExp === 'function') _settleAllyExp(a, 'dismiss'); } catch (e) {}
    });
    p.allies = [];
    try { saveGame(); } catch (e) {}
    try { if (typeof syncMercenaryEmploymentRegistry === 'function') syncMercenaryEmploymentRegistry(true); } catch (e) {}
    // 2. 換角色
    try { if (W.__afk && W.__afk.stamp) W.__afk.stamp(); } catch (e) {}
    var left = false;
    try { left = (typeof returnToCharacterSelect === 'function') && returnToCharacterSelect(); } catch (e) {}
    if (!left) { try { saveGame(); } catch (e) {} }
    currentSlot = Number(slotN);
    W.loadGame();
    var np = P();
    if (!np || String(currentSlot) !== slotN) return { ok: false, msg: '換隊長失敗：讀不到存檔 ' + slotN + '。' };
    // 新隊長存檔裡留著的舊隊伍先照解散結算清掉（不然下面 toggleAlly 會把同一個人解散掉）
    if ((np.allies || []).length) {
      np.allies.filter(Boolean).forEach(function (a) {
        try { if (typeof snapshotMercPrefs === 'function') snapshotMercPrefs(a); } catch (e) {}
        try { if (typeof _settleAllyExp === 'function') _settleAllyExp(a, 'dismiss'); } catch (e) {}
      });
      np.allies = [];
      try { saveGame(); } catch (e) {}
      try { if (typeof syncMercenaryEmploymentRegistry === 'function') syncMercenaryEmploymentRegistry(true); } catch (e) {}
    }
    // 3. 照原本順序招回來
    var back = 0;
    order.forEach(function (s) {
      try { toggleAlly(s); } catch (e) { console.warn('[AFK-partylead] toggleAlly', e); }
      if ((np.allies || []).some(function (a) { return a && String(a._slot) === s; })) back++;
    });
    var msg = esc(newName) + ' 成為隊長，' + esc(oldName) + ' 回到隊員的位置' + (back < order.length ? '（' + (order.length - back) + ' 名隊員沒有回到隊伍，看上面的訊息）' : '') + '。';
    sys('<span class="text-emerald-300 font-bold">' + msg + '</span>');
    try { updateUI(); renderTabs(true); } catch (e) {}
    return { ok: true, msg: msg, back: back, order: order };
  };
  W.afkPartyLeader = function (slotN) {
    var p = P(); if (!p) return;
    var a = (p.allies || []).find(function (x) { return x && String(x._slot) === String(slotN); });
    if (!a) return;
    var go = function () { var r = swap(slotN); if (!r.ok) sys('<span class="text-red-400">' + esc(r.msg) + '</span>'); };
    var m = '讓 ' + (a._allyName || ('存檔 ' + slotN)) + ' 當隊長？\n你現在的角色會換成他，原本的你回到他的位置當隊員；其他隊員不變。';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '換隊長', message: m, okText: '換隊長', cancelText: '取消', onOk: go });
    else if (confirm(m)) go();
  };

  if (typeof W.renderAllyNPC === 'function') {
    var oR = W.renderAllyNPC;
    W.renderAllyNPC = function (div) {
      var r = oR.apply(this, arguments);
      try {
        if (!on() || !div) return r;
        div.querySelectorAll('button[onclick^="dismissAlly("]').forEach(function (b) {
          var m = /dismissAlly\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''); if (!m || b.parentElement.querySelector('[data-afk-lead]')) return;
          var nb = document.createElement('button');
          nb.type = 'button'; nb.className = 'btn py-1 px-3 text-sm font-bold bg-violet-950 border-violet-700 text-violet-100';
          nb.setAttribute('data-afk-lead', m[1]); nb.textContent = '當隊長';
          nb.addEventListener('click', function (e) { e.stopPropagation(); W.afkPartyLeader(m[1]); });
          b.parentElement.insertBefore(nb, b);
        });
      } catch (e) { console.warn('[AFK-partylead] ui', e); }
      return r;
    };
    try { (0, eval)('renderAllyNPC = window.renderAllyNPC'); } catch (e) {}
  }
  W.__afkPartyLead = { swap: swap };
})();
