/* ============================================================================
 * afk-uiscale.js — 畫面調整（玩家 2026-10-29；外掛開關，預設關）
 *
 *   ‧整體縮放：60%～100%，每格 5%，開啟時預設 80%（「重設」也回到 80%）。
 *   ‧欄寬：左欄（狀態）與右欄（清單）中間各有一條拖曳線，可以用滑鼠拖，或點一下後用 ← → 鍵調整；中間的戰鬥畫面自動填滿。
 *   ‧設定記在這台裝置（localStorage），不跟著存檔走。手機版（窄螢幕）不套用。
 *   ‧左下角的「🖥 80%」按鈕打開調整面板。
 * 想法參考自其他天堂放置專案的「UI 縮放＋可拖曳欄寬」，程式自己寫。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'uiscale', name: '畫面調整（縮放與欄寬）', group: '遊戲介面', def: false,
    desc: '整體縮放 60%～100%（預設 80%），左右欄可以拖曳調整寬度；左下角按鈕打開設定。設定只存在這台裝置' });
  if (T && !T.enabled('uiscale')) return;
  var KEY = 'afk_uiscale_v1', DEF = { scale: 0.8, left: 340, right: 380 }, MIN = 0.6, MAX = 1, STEP = 0.05, WMIN = 240, WMAX = 640;
  var load = function () { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') return { scale: Number(o.scale) || DEF.scale, left: Number(o.left) || DEF.left, right: Number(o.right) || DEF.right }; } catch (e) {} return { scale: DEF.scale, left: DEF.left, right: DEF.right }; };
  var cfg = load();
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var narrow = function () { return W.innerWidth < 900 || document.documentElement.classList.contains('m-mobile') || document.body.classList.contains('m-mobile'); };
  var css = document.createElement('style'); css.id = 'afk-uiscale-css';
  css.textContent = '.afk-ui-gutter{flex:0 0 8px;align-self:stretch;cursor:col-resize;border-radius:4px;background:transparent;outline:none;margin:0 -6px;position:relative;z-index:5}'
    + '.afk-ui-gutter::after{content:"";position:absolute;top:0;bottom:0;left:3px;width:2px;background:#47556966;border-radius:2px}'
    + '.afk-ui-gutter:hover::after,.afk-ui-gutter:focus::after,.afk-ui-gutter.drag::after{background:#fbbf24}'
    + '#afk-ui-btn{position:fixed;left:8px;bottom:8px;z-index:60;font-size:12px;padding:3px 8px;border-radius:6px;background:#0f172acc;border:1px solid #475569;color:#e2e8f0;cursor:pointer}'
    + '#afk-ui-pop{position:fixed;left:8px;bottom:38px;z-index:61;background:#0f172af2;border:1px solid #64748b;border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:13px;min-width:230px;box-shadow:0 6px 24px #000a}'
    + '#afk-ui-pop input[type=range]{width:100%}#afk-ui-pop .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px}#afk-ui-pop button{padding:2px 8px;border:1px solid #64748b;border-radius:5px;background:#1e293b;color:#e2e8f0;cursor:pointer}';
  document.head.appendChild(css);
  var apply = function () {
    var stage = document.getElementById('app-stage'), L = document.getElementById('col-left'), R = document.getElementById('col-right');
    var on = !narrow();
    if (stage) stage.style.zoom = on && cfg.scale !== 1 ? String(cfg.scale) : '';
    if (L) { L.style.width = on ? cfg.left + 'px' : ''; L.style.flex = on ? '0 0 ' + cfg.left + 'px' : ''; }
    if (R) { R.style.width = on ? cfg.right + 'px' : ''; R.style.flex = on ? '0 0 ' + cfg.right + 'px' : ''; }
    document.querySelectorAll('.afk-ui-gutter').forEach(function (g) { g.style.display = on ? '' : 'none'; });
    var b = document.getElementById('afk-ui-btn'); if (b) { b.textContent = '🖥 ' + Math.round(cfg.scale * 100) + '%'; b.style.display = on ? '' : 'none'; }
    try { W.dispatchEvent(new Event('resize')); } catch (e) {}
  };
  var gutter = function (side) {
    var g = document.createElement('div'); g.className = 'afk-ui-gutter'; g.tabIndex = 0; g.dataset.side = side;
    g.setAttribute('role', 'separator'); g.setAttribute('aria-label', side === 'left' ? '調整左欄寬度' : '調整右欄寬度');
    var startX = 0, startW = 0;
    var move = function (ev) { var dx = (ev.clientX - startX) / (cfg.scale || 1); cfg[side] = clamp(Math.round(startW + (side === 'left' ? dx : -dx)), WMIN, WMAX); apply(); };
    var up = function () { g.classList.remove('drag'); W.removeEventListener('pointermove', move); W.removeEventListener('pointerup', up); save(); };
    g.addEventListener('pointerdown', function (ev) { ev.preventDefault(); startX = ev.clientX; startW = cfg[side]; g.classList.add('drag'); W.addEventListener('pointermove', move); W.addEventListener('pointerup', up); });
    g.addEventListener('keydown', function (ev) {
      var d = ev.key === 'ArrowLeft' ? -10 : ev.key === 'ArrowRight' ? 10 : 0; if (!d) return;
      ev.preventDefault(); cfg[side] = clamp(cfg[side] + (side === 'left' ? d : -d), WMIN, WMAX); apply(); save();
    });
    return g;
  };
  var pop = function () {
    var old = document.getElementById('afk-ui-pop'); if (old) { old.remove(); return; }
    var p = document.createElement('div'); p.id = 'afk-ui-pop';
    p.innerHTML = '<b>畫面調整</b><div class="row"><span>整體縮放</span><span id="afk-ui-val"></span></div>'
      + '<input type="range" id="afk-ui-range" min="' + MIN * 100 + '" max="' + MAX * 100 + '" step="' + STEP * 100 + '" aria-label="整體縮放">'
      + '<div class="row"><span>左欄 <span id="afk-ui-lw"></span>／右欄 <span id="afk-ui-rw"></span></span></div>'
      + '<div class="row"><button type="button" id="afk-ui-reset">重設（80%、預設欄寬）</button><button type="button" id="afk-ui-close">關閉</button></div>'
      + '<div style="color:#94a3b8;font-size:12px;margin-top:6px">欄寬：拖曳欄與欄中間的細線，或點一下細線後用 ← → 鍵。</div>';
    document.body.appendChild(p);
    var r = p.querySelector('#afk-ui-range'), sync = function () { r.value = Math.round(cfg.scale * 100); p.querySelector('#afk-ui-val').textContent = Math.round(cfg.scale * 100) + '%'; p.querySelector('#afk-ui-lw').textContent = cfg.left; p.querySelector('#afk-ui-rw').textContent = cfg.right; };
    r.addEventListener('input', function () { cfg.scale = clamp(Math.round(Number(r.value) / 5) * 5 / 100, MIN, MAX); apply(); sync(); save(); });
    p.querySelector('#afk-ui-reset').onclick = function () { cfg = { scale: DEF.scale, left: DEF.left, right: DEF.right }; apply(); sync(); save(); };
    p.querySelector('#afk-ui-close').onclick = function () { p.remove(); };
    sync();
  };
  var install = function () {
    var gs = document.getElementById('game-screen'), L = document.getElementById('col-left'), C = document.getElementById('col-center'), R = document.getElementById('col-right');
    if (!gs || !L || !C || !R || document.querySelector('.afk-ui-gutter')) return;
    gs.insertBefore(gutter('left'), C); gs.insertBefore(gutter('right'), R);
    var b = document.createElement('button'); b.type = 'button'; b.id = 'afk-ui-btn'; b.title = '畫面調整'; b.onclick = pop; document.body.appendChild(b);
    apply();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  var rt = 0; W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var s = document.getElementById('app-stage'); if (s && (narrow() ? s.style.zoom : !s.style.zoom && cfg.scale !== 1)) apply(); }, 150); });
  W.__afkUiScale = { cfg: function () { return cfg; }, apply: apply, set: function (o) { Object.assign(cfg, o || {}); cfg.scale = clamp(cfg.scale, MIN, MAX); apply(); save(); } };
})();
