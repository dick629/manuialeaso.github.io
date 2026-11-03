/* ============================================================================
 * afk-riftchain.js — 時空裂痕連續挑戰（玩家 2026-11-03；外掛開關 riftchain，預設開；經典模式沒有）
 *
 *   時空裂痕入口選 1～10 趟按「連續挑戰」：每一趟結束（倒下、撐滿完全通關）自動領取獎勵，1.5 秒後自動再進下一趟，
 *   直到趟數打完、龜裂之核不夠、或你自己離開（切換地圖、撤離）為止。最後一趟結束也會自動領獎。
 *   暗夢星迴不算在這裡（它有自己的連續挑戰：afk-fix1101）。
 *   狀態只放在 state（不存檔）：重新整理就停止。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'riftchain', name: '時空裂痕連續挑戰', group: '遊戲玩法', seal: true,
    desc: '時空裂痕入口可以設定連續挑戰 1～10 趟：每趟結束自動領取獎勵，再自動進下一趟' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('riftchain'))); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var MAX = 10, ENTRY = 'town_rift';
  var chain = function () { return S()._afkRiftChain || null; };
  var stop = function (why) {
    var c = chain(); if (!c) return;
    S()._afkRiftChain = null;
    sys('<span class="text-violet-300">時空裂痕連續挑戰結束：完成 ' + c.run + '／' + c.total + ' 趟' + (why ? '（' + why + '）' : '') + '。</span>');
    redraw();
  };
  var redraw = function () { try { var c = document.getElementById('interaction-content'); if (c && c.querySelector('#afk-rc-box') && typeof W.renderRiftEntrance === 'function') { c.innerHTML = ''; W.renderRiftEntrance(c); } } catch (e) {} };
  var claim = function () { var p = P(); if (p && p.riftRewardMs != null && typeof W.claimRiftReward === 'function') { try { W.claimRiftReward(); } catch (e) { console.warn('[AFK-riftchain] claim', e); } } };
  var enter = function () { try { W.enterRift(); } catch (e) { console.warn('[AFK-riftchain] enter', e); } return !!S().riftRun; };

  W.afkRiftChainStart = function () {
    var p = P(); if (!p || !on()) return;
    if (S().riftRun) { sys('<span class="text-amber-300">你已經在時空裂痕裡。</span>'); return; }
    var sel = document.getElementById('afk-rc-n'), n = Math.max(1, Math.min(MAX, Math.floor(Number(sel && sel.value) || 1)));
    try { localStorage.setItem('afk_riftchain_n', String(n)); } catch (e) {}
    claim();
    S()._afkRiftChain = { total: n, run: 0, manual: false };
    if (!enter()) { S()._afkRiftChain = null; return; }
    chain().run = 1;
    sys('<span class="text-violet-300 font-bold">時空裂痕連續挑戰開始：第 1／' + n + ' 趟。</span>');
  };
  W.afkRiftChainStop = function () { stop('你按了停止'); };

  // 自己離開＝停止（切換地圖、撤離）；倒下與完全通關會繼續
  if (typeof W.changeMap === 'function') {
    var oCM = W.changeMap;
    W.changeMap = function (force) {
      try { var c = chain(); if (c && !force && S().riftRun) { var el = document.getElementById('map-select'); if (el && el.value !== mapState.current) c.manual = true; } } catch (e) {}
      return oCM.apply(this, arguments);
    };
    try { (0, eval)('changeMap = window.changeMap'); } catch (e) {}
  }
  if (typeof W.riftEvacuate === 'function') {
    var oEv = W.riftEvacuate;
    W.riftEvacuate = function () { try { var c = chain(); if (c && S().riftRun) c.manual = true; } catch (e) {} return oEv.apply(this, arguments); };
    try { (0, eval)('riftEvacuate = window.riftEvacuate'); } catch (e) {}
  }
  var next = function (tries) {
    var c = chain(); if (!c) return;
    var p = P(); if (!p) { S()._afkRiftChain = null; return; }
    if (S().riftRun) return;
    if (p.dead || (typeof mapState !== 'undefined' && mapState.current !== ENTRY)) {
      if (tries < 5) { setTimeout(function () { next(tries + 1); }, 1500); return; }
      stop('你不在時空裂痕入口'); return;
    }
    claim();
    if (c.run >= c.total) { S()._afkRiftChain = null; sys('<span class="text-violet-300 font-bold">時空裂痕連續挑戰完成：共 ' + c.total + ' 趟。</span>'); redraw(); return; }
    if (!enter()) { stop('沒辦法再進入，龜裂之核可能不夠了'); return; }
    c.run++;
    sys('<span class="text-violet-300 font-bold">時空裂痕連續挑戰：第 ' + c.run + '／' + c.total + ' 趟。</span>');
  };
  if (typeof W.riftEndRun === 'function') {
    var oEnd = W.riftEndRun;
    W.riftEndRun = function () {
      var was = !!S().riftRun, ds = !!S().dreamStar;
      var r = oEnd.apply(this, arguments);
      try {
        var c = chain();
        if (c && was && !ds && !S().riftRun) {
          if (c.manual) stop('你自己離開了時空裂痕');
          else setTimeout(function () { next(0); }, 1500);
        }
      } catch (e) { console.warn('[AFK-riftchain] end', e); }
      return r;
    };
    try { (0, eval)('riftEndRun = window.riftEndRun'); } catch (e) {}
  }

  // 入口：趟數＋按鈕
  if (typeof W.renderRiftEntrance === 'function') {
    var oEnt = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try {
        if (!on() || !container || container.querySelector('#afk-rc-box')) return r;
        var btn = container.querySelector('button[onclick="enterRift()"]'); if (!btn) return r;
        var c = chain(), def = 3; try { def = Math.max(1, Math.min(MAX, Number(localStorage.getItem('afk_riftchain_n')) || 3)); } catch (e) {}
        var opts = ''; for (var i = 1; i <= MAX; i++) opts += '<option value="' + i + '"' + (i === def ? ' selected' : '') + '>' + i + ' 趟</option>';
        var h = '<div id="afk-rc-box" class="flex items-center gap-2 bg-slate-900/70 border border-violet-700 rounded-lg p-2 text-sm text-slate-200">'
          + (c ? '<span class="flex-1">連續挑戰中：第 ' + c.run + '／' + c.total + ' 趟</span><button type="button" class="btn py-1 px-3 font-bold bg-red-950 border border-red-700 text-red-200" onclick="afkRiftChainStop()">停止</button>'
            : '<span class="flex-1">連續挑戰（每趟結束自動領獎、再進下一趟）</span><select id="afk-rc-n" class="bg-slate-800 border border-slate-600 rounded px-1 py-1">' + opts + '</select>'
              + '<button type="button" class="btn py-1 px-3 font-bold bg-violet-800 border border-violet-400 text-white" onclick="afkRiftChainStart()">連續挑戰</button>')
          + '</div>';
        btn.insertAdjacentHTML('afterend', h);
      } catch (e) { console.warn('[AFK-riftchain] ui', e); }
      return r;
    };
  }
  W.__afkRiftChain = { chain: chain, stop: stop, next: next, MAX: MAX };
})();
