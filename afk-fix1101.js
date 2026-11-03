/* ============================================================================
 * afk-fix1101.js — 實測回報修正（玩家 2026-11-01 15:45；外掛開關 fix1101，預設開）
 *
 *   一、四龍副本最後一層（頭目棲息地）的背景改成野外同一條龍的地圖：
 *       侵蝕的安塔瑞斯棲息地 → 安塔瑞斯棲息地、破滅的法利昂棲息地 → 法利昂洞穴、深淵的巴拉卡斯棲息地 → 巴拉卡斯巢穴；
 *       林德拜爾野外（風龍棲息地）本來就用災厄的林德拜爾棲息地那張，不變。前三層照舊。
 *   二、從 NPC 進副本後，NPC 視窗還浮在戰鬥畫面上：進副本（四龍副本與其他直接進圖的副本）時關掉 NPC 視窗與浮動倉庫。
 *   三、被雇用中的角色不能轉生：這個角色正被別的角色雇用為傭兵時，輪迴轉生（一轉）與冥王域（二轉）都擋下，並說明是被誰雇用、要怎麼解除。
 *   四、暗夢星迴連續挑戰：進場時（龜裂之核夠兩場以上）問「連續挑戰」或「只打一次」。
 *       連續挑戰：打倒夢境者後自動再進下一場，直到龜裂之核不夠 1000 顆、隊伍打輸（全倒或 15 分鐘自爆）、或你自己離開為止；
 *       結束時在系統訊息寫總共打了幾場。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fix1101', name: '修正：四龍背景、副本視窗、被雇用轉生、星迴連續挑戰', group: '系統與其他', seal: true,
    desc: '四龍副本最後一層用野外同一張龍地圖；進副本自動關 NPC 視窗；被雇用中不能轉生；暗夢星迴可選連續挑戰' });
  var on = function () { return !T || T.enabled('fix1101'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ── 一、四龍副本最後一層背景 ──
  var LAIR_BG = {
    antharas_lair: '安塔瑞斯棲息地',
    cr_fafurion_lair: '法利昂洞穴',
    cr_valakas_lair: '巴拉卡斯巢穴',
    cr_lindvior_lair: '災厄的林德拜爾棲息地'
  };
  if (typeof W.applyAreaBackground === 'function') {
    var oBg = W.applyAreaBackground;
    W.applyAreaBackground = function () {
      var r = oBg.apply(this, arguments);
      try {
        var nm = on() && typeof mapState !== 'undefined' && LAIR_BG[mapState.current];
        var bv = nm && document.getElementById('battle-view');
        if (bv) { bv.style.backgroundImage = 'url("assets/area/1920x1080/' + nm + '.jpg")'; bv.style.backgroundSize = 'cover'; bv.classList.add('area-fit'); bv.classList.add('has-bg'); }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('applyAreaBackground = window.applyAreaBackground'); } catch (e) {}
  }

  // ── 二、進副本關掉 NPC 視窗 ──
  if (typeof W.enterOblivionMap === 'function') {
    var oEnter = W.enterOblivionMap;
    W.enterOblivionMap = function () {
      var r = oEnter.apply(this, arguments);
      try {
        var cur = typeof mapState !== 'undefined' ? String(mapState.current || '') : '';
        if (on() && cur && cur.indexOf('town_') !== 0) {
          if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
          if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow();
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('enterOblivionMap = window.enterOblivionMap'); } catch (e) {}
  }

  // ── 三、被雇用中不能轉生 ──
  var hiredBy = function () {
    try { return (typeof currentRoleMercenaryEmployer === 'function') ? currentRoleMercenaryEmployer() : null; } catch (e) { return null; }
  };
  var hiredMsg = function (em) {
    return '這個角色正被「' + (em.employerName || '未命名') + '」（存檔 ' + em.employerSlot + '）雇用為傭兵，被雇用期間不能轉生。'
      + '請先切換到「' + (em.employerName || '雇主') + '」，在隊伍裡解散這個角色，再回來轉生。';
  };
  var blockRebirth = function () {
    if (!on()) return null;
    var em = hiredBy(); if (!em) return null;
    var m = hiredMsg(em);
    sys('<span class="text-red-400 font-bold">無法轉生：</span><span class="text-red-300">' + esc(m) + '</span>');
    try { if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '無法轉生', message: m, okText: '知道了', cancelText: '關閉' }); } catch (e) {}
    return m;
  };
  var wrapRebirth = function () {
    if (typeof W.doRebirth === 'function' && !W.doRebirth.__afkHire) {
      var oR = W.doRebirth;
      W.doRebirth = function () { var m = blockRebirth(); if (m) return { ok: false, msg: m, hired: true }; return oR.apply(this, arguments); };
      W.doRebirth.__afkHire = true;
    }
    if (typeof W.enterHades === 'function' && !W.enterHades.__afkHire) {
      var oH = W.enterHades;
      W.enterHades = function () { if (blockRebirth()) return; return oH.apply(this, arguments); };
      W.enterHades.__afkHire = true;
      if (W.unlockHades && !W.unlockHades.__afkHire) W.unlockHades = W.enterHades;
    }
  };
  wrapRebirth();
  W.addEventListener('load', wrapRebirth);

  // ── 四、暗夢星迴連續挑戰 ──
  var CORES = 1000;
  var rep = { on: false, runs: 0, wins: 0 };
  var coreN = function () { var m = W.__afkMatWh; return (m && m.on()) ? m.total('mat_crack_core') : invCnt('mat_crack_core'); };   // 背包＋倉庫（afk-matwh）
  var invCnt = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  var stopRep = function (why) {
    if (!rep.on) return;
    rep.on = false;
    sys('<span class="text-fuchsia-300">暗夢星迴連續挑戰結束：共 ' + rep.runs + ' 場（擊倒 ' + rep.wins + ' 場）' + (why ? '，' + esc(why) : '') + '。</span>');
  };
  var wrapDS = function () {
    if (typeof W.enterDreamStar !== 'function' || W.enterDreamStar.__afkRep) return;
    var oDS = W.enterDreamStar;
    var go = function (mode) { var before = !!(S().dreamStar && S().riftRun); oDS(mode); var now = !!(S().dreamStar && S().riftRun); if (now && !before && rep.on) rep.runs++; };
    W.enterDreamStar = function (mode) {
      if (!on() || mode === 'multi') return oDS.apply(this, arguments);
      if (mode === 'force' || mode === '__auto') return go(mode === '__auto' ? 'force' : mode);
      var have = coreN(), n = Math.floor(have / CORES);
      if (n < 2 || !(W.AFK_UI && AFK_UI.confirm)) { rep.on = false; return go(mode); }
      AFK_UI.confirm({
        title: '暗夢星迴',
        message: '身上有 ' + have.toLocaleString() + ' 顆龜裂之核，夠挑戰 ' + n + ' 場（每場 ' + CORES + ' 顆）。\n\n'
          + '連續挑戰：打倒夢境者後自動再進下一場，直到龜裂之核不夠、隊伍打輸（全倒或 15 分鐘自爆）、或你自己離開為止。\n'
          + '只打一次：打完就回到時空裂痕入口。',
        okText: '連續挑戰（最多 ' + n + ' 場）', cancelText: '只打一次',
        onOk: function () { rep = { on: true, runs: 0, wins: 0 }; go(mode); if (!(S().dreamStar && S().riftRun)) rep.on = false; },
        onCancel: function () { rep.on = false; go(mode); },
        onDismiss: function () {}   // 按 ESC／點背景＝都不進
      });
    };
    W.enterDreamStar.__afkRep = true;
  };
  wrapDS();
  W.addEventListener('load', wrapDS);
  if (typeof W.riftEndRun === 'function') {
    var oEnd = W.riftEndRun;
    W.riftEndRun = function () {
      var ds = !!(S().dreamStar && S().riftRun), won = ds && !!S()._dsOver;
      var r = oEnd.apply(this, arguments);
      if (ds && rep.on) {
        if (!won) stopRep('這一場沒有擊倒夢境者（打輸或自己離開）');
        else {
          rep.wins++;
          setTimeout(function () {   // 原本打倒後 300ms 回到入口；再等一下讓回村流程跑完
            try {
              if (!rep.on) return;
              var p = P();
              if (!p || p.dead) { stopRep('角色倒下了'); return; }
              if (coreN() < CORES) { stopRep('龜裂之核用完了'); return; }
              if (typeof mapState !== 'undefined' && mapState.current !== 'town_rift') { stopRep('你離開了時空裂痕入口'); return; }
              W.enterDreamStar('__auto');
              if (!(S().dreamStar && S().riftRun)) stopRep('無法再次進入');
            } catch (e) { stopRep('進場失敗'); }
          }, 1500);
        }
      }
      return r;
    };
    try { (0, eval)('riftEndRun = window.riftEndRun'); } catch (e) {}
  }

  W.__afkFix1101 = { LAIR_BG: LAIR_BG, hiredBy: hiredBy, rep: function () { return rep; }, stopRep: stopRep };
})();
