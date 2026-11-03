/* ============================================================================
 * afk-update.js — 有新版本時提示更新（玩家 2026-10-27：修好的東西玩家那邊「看起來沒有效果」，其實還在跑舊版）
 *
 * 為什麼：網站發新版後，已經開著的分頁還在跑舊程式；掛機玩家常常好幾天不重新整理，
 *   回報的問題其實早就修好了。
 * 做法：
 *   1. 開頁時讀一次 version.json（不吃快取）記下「目前這頁的版本」，之後每 10 分鐘再讀一次。
 *   2. 版本不同 → 畫面上方出現一條提示「遊戲有新版本」，按「立即更新」＝存檔、重新整理、自動回到同一格角色。
 *   3. 同時通知自動重新整理（afk-autoreload）：在安全時機（沒在操作、沒在打副本／攻城…）自動更新，
 *      不用等滿 4 小時。2026-10-29 起要另外打開外掛開關「有新版本時自動更新」（autoupdate，預設關）；
 *      關著或關掉「定時自動重新整理」的玩家只看得到提示，不會被自動重整。
 * 讀不到 version.json（離線、本機測試）就什麼都不做。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'updatenotice', name: '新版本提示', desc: '網站發布新版本時，畫面上方提示更新（按一下存檔並重新整理，自動回到原角色）', group: '遊戲介面' });
  if (T && T.register) T.register({ id: 'autoupdate', name: '有新版本時自動更新', desc: '網站發布新版本時，在安全時機（閒置 30 分鐘或切到背景、沒在打副本／攻城）自動存檔、重新整理並回到原角色。關著時只顯示更新提示，不會在掛機中途自動更新', group: '系統與其他', def: false });   // 玩家 2026-10-29：掛機時會自動更新 → 改成開關、預設關
  var on = function () { return !T || T.enabled('updatenotice'); };
  var FLAG = 'afk_autoreload_resume';
  var POLL_MS = 10 * 60 * 1000;
  try { var pm = Number(localStorage.getItem('afk_update_poll_ms')); if (pm >= 1000 && pm < POLL_MS) POLL_MS = pm; } catch (e) {}   // 測試用
  var mine = null, latest = null, dismissed = null;

  var read = function () {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  };
  var fmt = function (j) { return (j && (j.buildAt || j.build)) || ''; };

  var bar = null;
  var css = function () {
    if (document.getElementById('afk-update-css')) return;
    var st = document.createElement('style'); st.id = 'afk-update-css';
    st.textContent = '#afk-update-bar{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;'
      + 'max-width:calc(100vw - 32px);padding:8px 12px;border:1px solid #a8823f;border-radius:4px;background:linear-gradient(#2a2118,#17120d);color:#e9cf98;'
      + 'font-size:14px;line-height:1.4;box-shadow:0 4px 14px rgba(0,0,0,.6);text-shadow:1px 1px 0 #000}'
      + '#afk-update-bar small{color:#a39a8e;font-size:12px}'
      + '#afk-update-bar button{font:inherit;font-size:13px;font-weight:700;padding:3px 10px;border-radius:3px;cursor:pointer;border:1px solid #a8823f;background:#4a3820;color:#fde68a}'
      + '#afk-update-bar button.ghost{background:transparent;color:#a39a8e;border-color:#5b4a33}'
      + '#afk-update-bar button:focus-visible{outline:2px solid #fde68a;outline-offset:1px}';
    (document.head || document.documentElement).appendChild(st);
  };
  var inGame = function () {
    var gs = document.getElementById('game-screen');
    return !!(gs && !gs.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls);
  };
  var reloadNow = function () {
    try {
      if (inGame()) {
        if (typeof saveGame === 'function') saveGame();
        sessionStorage.setItem(FLAG, JSON.stringify({ slot: currentSlot, at: Date.now(), hours: 0, update: true }));
      }
    } catch (e) {}
    location.reload();
  };
  var show = function () {
    if (!on() || !document.body || dismissed === latest.code) return;
    css();
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'afk-update-bar'; bar.setAttribute('role', 'status');
      document.body.appendChild(bar);
    }
    var auto = !!(W.__afkAutoReload) && !!(T && T.enabled('autoupdate'));
    bar.innerHTML = '<span>🔔 遊戲有新版本</span><small>' + (fmt(latest) ? '（' + fmt(latest) + ' 發布）' : '') + (auto ? '・閒置 30 分鐘（或切到背景）時會自動更新' : '') + '</small>'
      + '<button type="button" data-u="go">立即更新</button><button type="button" class="ghost" data-u="later">稍後</button>';
    bar.querySelector('[data-u="go"]').onclick = reloadNow;
    bar.querySelector('[data-u="later"]').onclick = function () { dismissed = latest.code; if (bar) { bar.remove(); bar = null; } };
  };
  var check = function () {
    read().then(function (j) {
      if (!j || !j.code) return;
      if (mine == null) { mine = j.code; return; }
      if (j.code === mine) return;
      latest = j; W.__afkUpdateDue = true;
      show();
    });
  };
  check();
  setInterval(check, POLL_MS);
  if (T && typeof T.set === 'function') { var oSet = T.set; T.set = function () { var r = oSet.apply(this, arguments); if (!on() && bar) { bar.remove(); bar = null; } else if (on() && latest) show(); return r; }; }
  W.AFK_UPDATE = { check: check, status: function () { return { 目前版本: mine, 最新版本: latest && latest.code, 要更新: !!W.__afkUpdateDue }; }, reloadNow: reloadNow };
})();
