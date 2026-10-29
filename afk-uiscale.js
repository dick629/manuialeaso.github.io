/* ============================================================================
 * afk-uiscale.js — 畫面調整（玩家 2026-10-29；外掛開關，預設關；只限電腦版）
 *
 *   ‧整體縮放：60%～100%，每格 5%，開啟時預設 80%（「重設」也回到 80%）。
 *     只縮放遊戲主畫面（#game-screen）；登入、創角、選角畫面維持原本比例。
 *   ‧每個框都能拖：
 *       左欄｜中間｜右欄 的寬度（兩條直線）
 *       中間的 冒險地圖／日誌列 的高度（一條橫線）
 *       日誌列裡 戰鬥日誌｜世界頻道 的寬度比例（一條直線）
 *     用滑鼠拖，或點一下線後用方向鍵調整；雙擊線＝這條線回到預設。
 *   ‧設定記在這台裝置（localStorage），不跟著存檔走。
 *   ‧手機版禁用：手機（含平板手機版面）或視窗寬度不到 900 時，什麼都不套用，也不出現按鈕。
 *   ‧左下角的「🖥 80%」按鈕打開調整面板。
 * 想法參考自其他天堂放置專案的「UI 縮放＋可拖曳欄寬」，程式自己寫。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'uiscale', name: '畫面調整（縮放與框大小，電腦版）', group: '遊戲介面', def: false,
    desc: '遊戲畫面整體縮放 60%～100%（預設 80%），左右欄、地圖／日誌、戰鬥日誌／世界頻道都能拖曳調整大小；選角畫面不受影響；手機版不套用。設定只存在這台裝置' });
  if (T && !T.enabled('uiscale')) return;
  var KEY = 'afk_uiscale_v1';
  var DEF = { scale: 0.8, left: 340, right: 380, log: 0, split: 50 };   // log：日誌列高度（0＝原本的自動）；split：戰鬥日誌佔日誌列的 %
  var MIN = 0.6, MAX = 1, STEP = 0.05, WMIN = 240, WMAX = 640, HMIN = 140, HMAX = 900, SMIN = 20, SMAX = 80;
  var num = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
  var load = function () {
    var o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    o = o && typeof o === 'object' ? o : {};
    return { scale: num(o.scale, DEF.scale) || DEF.scale, left: num(o.left, DEF.left) || DEF.left, right: num(o.right, DEF.right) || DEF.right, log: num(o.log, DEF.log), split: num(o.split, DEF.split) || DEF.split };
  };
  var cfg = load();
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var mobile = function () {
    try { if (W.__afkm && typeof W.__afkm.isMobile === 'function' && W.__afkm.isMobile()) return true; } catch (e) {}
    return W.innerWidth < 900 || document.documentElement.classList.contains('m-mobile') || (document.body && document.body.classList.contains('m-mobile'));
  };
  var $ = function (id) { return document.getElementById(id); };
  var css = document.createElement('style'); css.id = 'afk-uiscale-css';
  css.textContent = '.afk-ui-gutter{flex:0 0 8px;align-self:stretch;cursor:col-resize;border-radius:4px;background:transparent;outline:none;margin:0 -6px;position:relative;z-index:5}'
    + '.afk-ui-gutter::after{content:"";position:absolute;top:0;bottom:0;left:3px;width:2px;background:#47556966;border-radius:2px}'
    + '.afk-ui-gutter.h{flex:0 0 8px;cursor:row-resize;margin:-6px 0;align-self:auto;width:100%}'
    + '.afk-ui-gutter.h::after{top:3px;bottom:auto;left:0;right:0;width:auto;height:2px}'
    + '.afk-ui-gutter:hover::after,.afk-ui-gutter:focus::after,.afk-ui-gutter.drag::after{background:#fbbf24}'
    + 'body.afk-ui-dragging{user-select:none}body.afk-ui-dragging.col{cursor:col-resize}body.afk-ui-dragging.row{cursor:row-resize}'
    + 'body.afk-ui-on #game-screen #map-view-panel.afk-ui-maph{flex:1 1 0 !important;min-height:0 !important}'
    + 'body.afk-ui-on #game-screen #log-row.afk-ui-logh{flex:0 0 var(--afk-ui-log) !important;min-height:0 !important}'
    + 'body.afk-ui-on #game-screen #combat-log-panel.afk-ui-split{flex:0 0 calc(var(--afk-ui-split) - 8px) !important}'
    + '#afk-ui-btn{position:fixed;left:8px;bottom:8px;z-index:60;font-size:12px;padding:3px 8px;border-radius:6px;background:#0f172acc;border:1px solid #475569;color:#e2e8f0;cursor:pointer}'
    + '#afk-ui-pop{position:fixed;left:8px;bottom:38px;z-index:61;background:#0f172af2;border:1px solid #64748b;border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:13px;min-width:250px;box-shadow:0 6px 24px #000a}'
    + '#afk-ui-pop input[type=range]{width:100%}#afk-ui-pop .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px}#afk-ui-pop button{padding:2px 8px;border:1px solid #64748b;border-radius:5px;background:#1e293b;color:#e2e8f0;cursor:pointer}';
  document.head.appendChild(css);

  var inGame = function () { var gs = $('game-screen'); return !!(gs && !gs.classList.contains('hidden')); };
  var apply = function () {
    var gs = $('game-screen'), L = $('col-left'), R = $('col-right'), M = $('map-view-panel'), LR = $('log-row'), CL = $('combat-log-panel');
    var on = !mobile();
    document.body.classList.toggle('afk-ui-on', on);
    if (gs) gs.style.zoom = on && cfg.scale !== 1 ? String(cfg.scale) : '';
    if (L) { L.style.width = on ? cfg.left + 'px' : ''; L.style.flex = on ? '0 0 ' + cfg.left + 'px' : ''; }
    if (R) { R.style.width = on ? cfg.right + 'px' : ''; R.style.flex = on ? '0 0 ' + cfg.right + 'px' : ''; }
    var lh = on && cfg.log > 0;
    if (gs) gs.style.setProperty('--afk-ui-log', cfg.log + 'px');
    if (M) M.classList.toggle('afk-ui-maph', lh);
    if (LR) LR.classList.toggle('afk-ui-logh', lh);
    if (gs) gs.style.setProperty('--afk-ui-split', cfg.split + '%');
    if (CL) CL.classList.toggle('afk-ui-split', on && cfg.split !== DEF.split);
    document.querySelectorAll('.afk-ui-gutter').forEach(function (g) { g.style.display = on ? '' : 'none'; });
    var b = $('afk-ui-btn'); if (b) { b.textContent = '🖥 ' + Math.round(cfg.scale * 100) + '%'; b.style.display = on && inGame() ? '' : 'none'; }
    if (!on) { var p = $('afk-ui-pop'); if (p) p.remove(); }
    try { W.dispatchEvent(new Event('resize')); } catch (e) {}
  };
  // 每條線：key＝要改的設定、axis＝x／y、sign＝往右（下）拖時數值變大(+1)或變小(-1)
  var SPEC = {
    left: { axis: 'x', sign: 1, min: WMIN, max: WMAX, label: '調整左欄寬度' },
    right: { axis: 'x', sign: -1, min: WMIN, max: WMAX, label: '調整右欄寬度' },
    log: { axis: 'y', sign: -1, min: HMIN, max: HMAX, label: '調整地圖與日誌的高度' },
    split: { axis: 'x', sign: 1, min: SMIN, max: SMAX, label: '調整戰鬥日誌與世界頻道的寬度', pct: true }
  };
  var gutter = function (key) {
    var sp = SPEC[key], g = document.createElement('div');
    g.className = 'afk-ui-gutter' + (sp.axis === 'y' ? ' h' : ''); g.tabIndex = 0; g.dataset.side = key;
    g.setAttribute('role', 'separator'); g.setAttribute('aria-orientation', sp.axis === 'y' ? 'horizontal' : 'vertical'); g.setAttribute('aria-label', sp.label + '（雙擊回到預設）');
    var start = 0, startV = 0, span = 1;
    var cur = function () {   // 日誌高度 0＝自動：開始拖的時候先量現在的高度
      if (key === 'log' && !(cfg.log > 0)) { var lr = $('log-row'); return lr ? Math.round(lr.getBoundingClientRect().height / (cfg.scale || 1)) : 340; }
      return cfg[key];
    };
    var move = function (ev) {
      var d = ((sp.axis === 'y' ? ev.clientY : ev.clientX) - start) / (cfg.scale || 1);
      if (sp.pct) d = d / span * 100;
      cfg[key] = clamp(Math.round(startV + sp.sign * d), sp.min, sp.max); apply();
    };
    var up = function () { g.classList.remove('drag'); document.body.classList.remove('afk-ui-dragging', 'col', 'row'); W.removeEventListener('pointermove', move); W.removeEventListener('pointerup', up); save(); };
    g.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); start = sp.axis === 'y' ? ev.clientY : ev.clientX; startV = cur();
      if (sp.pct) { var lr = $('log-row'); span = lr ? Math.max(1, lr.getBoundingClientRect().width / (cfg.scale || 1)) : 1; }
      g.classList.add('drag'); document.body.classList.add('afk-ui-dragging', sp.axis === 'y' ? 'row' : 'col');
      W.addEventListener('pointermove', move); W.addEventListener('pointerup', up);
    });
    g.addEventListener('dblclick', function () { cfg[key] = DEF[key]; apply(); save(); });
    g.addEventListener('keydown', function (ev) {
      var k = ev.key, d = 0;
      if (sp.axis === 'x') d = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0; else d = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (!d) return;
      ev.preventDefault(); cfg[key] = clamp(cur() + sp.sign * d * (sp.pct ? 2 : 10), sp.min, sp.max); apply(); save();
    });
    return g;
  };
  var pop = function () {
    var old = $('afk-ui-pop'); if (old) { old.remove(); return; }
    var p = document.createElement('div'); p.id = 'afk-ui-pop';
    p.innerHTML = '<b>畫面調整</b><div class="row"><span>整體縮放</span><span id="afk-ui-val"></span></div>'
      + '<input type="range" id="afk-ui-range" min="' + MIN * 100 + '" max="' + MAX * 100 + '" step="' + STEP * 100 + '" aria-label="整體縮放">'
      + '<div class="row"><span id="afk-ui-sz" style="color:#cbd5e1"></span></div>'
      + '<div class="row"><button type="button" id="afk-ui-reset">全部重設（80%、預設大小）</button><button type="button" id="afk-ui-close">關閉</button></div>'
      + '<div style="color:#94a3b8;font-size:12px;margin-top:6px">框的大小：拖曳框與框中間的細線，或點一下細線後用方向鍵；雙擊細線＝那條線回到預設。只縮放遊戲畫面，選角畫面不變。</div>';
    document.body.appendChild(p);
    var r = p.querySelector('#afk-ui-range'), sync = function () {
      r.value = Math.round(cfg.scale * 100); p.querySelector('#afk-ui-val').textContent = Math.round(cfg.scale * 100) + '%';
      p.querySelector('#afk-ui-sz').textContent = '左欄 ' + cfg.left + '／右欄 ' + cfg.right + '／日誌高 ' + (cfg.log > 0 ? cfg.log : '自動') + '／戰鬥日誌 ' + cfg.split + '%';
    };
    r.addEventListener('input', function () { cfg.scale = clamp(Math.round(Number(r.value) / 5) * 5 / 100, MIN, MAX); apply(); sync(); save(); });
    p.querySelector('#afk-ui-reset').onclick = function () { cfg = { scale: DEF.scale, left: DEF.left, right: DEF.right, log: DEF.log, split: DEF.split }; apply(); sync(); save(); };
    p.querySelector('#afk-ui-close').onclick = function () { p.remove(); };
    sync();
  };
  var install = function () {
    var gs = $('game-screen'), L = $('col-left'), C = $('col-center'), R = $('col-right'), LR = $('log-row'), SY = $('syslog-panel');
    if (!gs || !L || !C || !R || document.querySelector('.afk-ui-gutter')) return;
    gs.insertBefore(gutter('left'), C); gs.insertBefore(gutter('right'), R);
    if (LR && LR.parentNode === C) C.insertBefore(gutter('log'), LR);
    if (LR && SY && SY.parentNode === LR) LR.insertBefore(gutter('split'), SY);
    var b = document.createElement('button'); b.type = 'button'; b.id = 'afk-ui-btn'; b.title = '畫面調整'; b.onclick = pop; document.body.appendChild(b);
    apply();
    // 進出遊戲畫面（選角 ↔ 遊戲）時切換按鈕顯示
    try { new MutationObserver(function () { var bb = $('afk-ui-btn'); if (bb) bb.style.display = !mobile() && inGame() ? '' : 'none'; if (!inGame()) { var pp = $('afk-ui-pop'); if (pp) pp.remove(); } }).observe(gs, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  var rt = 0, last = null;
  W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var m = mobile(); if (m !== last) { last = m; apply(); } }, 150); });
  W.__afkUiScale = { cfg: function () { return cfg; }, apply: apply, mobile: mobile, DEF: DEF, set: function (o) { Object.assign(cfg, o || {}); cfg.scale = clamp(cfg.scale, MIN, MAX); apply(); save(); } };
})();
