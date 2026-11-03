/* ============================================================================
 * afk-screen.js — 掛機模式（手機省電掛機；玩家 2026-10-28）
 *
 * 手機瀏覽器切到背景約 30 秒就會凍結網頁，記憶體不夠還會直接清掉分頁（下次載入只能走 70% 離線結算）。
 * 網頁沒辦法在背景跑，所以改成「留在前景、但盡量省電」：
 *   ‧螢幕常亮（Screen Wake Lock；iOS 16.4+ Safari、Android Chrome 支援）：不會自動鎖定、不會被凍結
 *   ‧全黑畫面：OLED 螢幕顯示黑色幾乎不耗電；只留很暗的小字（等級、經驗、金幣、擊殺數、HP、地圖），每分鐘換位置防烙印
 *   ‧遊戲照常 100% 戰鬥（gameLoop 不動），但畫面不重畫：
 *       主畫面隱藏（瀏覽器不繪製）、戰鬥特效與傷害數字關閉、角色逐幀動畫暫停、
 *       畫面更新（_updateUIImpl／_renderMobsImpl）改成每 5 秒一次（保留畫面更新裡的任何附帶邏輯）
 *   ‧點兩下螢幕（或「結束掛機」）回到正常畫面，立刻完整重畫一次
 * 入口：熱鍵列左上角的 🌙；也可以 AFK_SCREEN.start()／stop()。同一個分頁自動重新整理後會回到掛機模式。
 * 不改存檔、不改任何戰鬥數值；只是暫停「畫」。
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'screen', name: '掛機模式（省電）', desc: '熱鍵列的 🌙：螢幕常亮、全黑省電畫面，戰鬥照常進行', group: '遊戲介面' });
  if (__T && !__T.enabled('screen')) { console.log('[AFK] 外掛開關「掛機模式（省電）」已關閉'); return; }
  var W = window;
  if (W.AFK_SCREEN) return;
  var on = false, lock = null, ov = null, timer = 0, moveTimer = 0, start = null, kills = 0, lastTap = 0, saved = {};
  var THROTTLE = 5000;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var fmt = function (n) { n = Math.floor(Number(n) || 0); return n.toLocaleString(); };
  var dur = function (ms) { var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ' 小時 ' : '') + m + ' 分'; };

  // ── 畫面更新節流：掛機中每 5 秒才真的畫一次 ──
  var lastDraw = { ui: 0, mobs: 0 };
  var wrapDraw = function (name, key) {
    var o = W[name]; if (typeof o !== 'function' || o.__afkScreen) return;
    var w = function () { if (on) { var t = Date.now(); if (t - lastDraw[key] < THROTTLE) return; lastDraw[key] = t; } return o.apply(this, arguments); };
    w.__afkScreen = true; W[name] = w;
  };
  // ── 逐幀動畫：掛機中不動 ──
  var wrapSkip = function (name) {
    var o = W[name]; if (typeof o !== 'function' || o.__afkScreen) return;
    var w = function () { if (on) return; return o.apply(this, arguments); };
    w.__afkScreen = true; W[name] = w;
  };
  var install = function () {
    wrapDraw('_updateUIImpl', 'ui'); wrapDraw('_renderMobsImpl', 'mobs');
    ['_playerMorphApply', '_allySpritesApply', '_petAnimApply'].forEach(wrapSkip);
  };
  // 擊殺計數
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = null; try { m = mapState.mobs[idx]; } catch (e) {}
      var alive = !!(m && !m._dead);
      var r = oKill.apply(this, arguments);
      try { if (on && alive) kills++; } catch (e) {}
      return r;
    };
  }

  // ── 螢幕常亮 ──
  var wakeOk = function () { return !!(navigator.wakeLock && navigator.wakeLock.request); };
  var acquire = function () {
    if (!on || !wakeOk()) return;
    try { navigator.wakeLock.request('screen').then(function (l) { lock = l; try { l.addEventListener('release', function () { lock = null; }); } catch (e) {} paint(); }).catch(function () { lock = null; paint(); }); } catch (e) {}
  };
  document.addEventListener('visibilitychange', function () { if (on && document.visibilityState === 'visible' && !lock) acquire(); });

  // ── 畫面 ──
  var css = function () {
    if (document.getElementById('afk-screen-css')) return;
    var s = document.createElement('style'); s.id = 'afk-screen-css';
    s.textContent = 'body.afk-screen-on #app-stage,body.afk-screen-on #creation-screen{visibility:hidden!important}'
      + '#afk-screen{position:fixed;inset:0;z-index:2147483000;background:#000;color:#3a3a3a;font:13px/1.7 system-ui,sans-serif;user-select:none;-webkit-user-select:none;touch-action:manipulation;overflow:hidden}'
      + '#afk-screen .as-box{position:absolute;max-width:86vw;padding:10px 12px;transition:none}'
      + '#afk-screen .as-t{color:#4a4a4a;font-weight:700;margin-bottom:2px}#afk-screen b{color:#5a5a5a;font-weight:600}'
      + '#afk-screen .as-warn{color:#6b4a2a}#afk-screen .as-hp{color:#5a3434}'
      + '#afk-screen .as-exit{position:absolute;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));color:#3a3a3a;border:1px solid #222;border-radius:6px;padding:6px 10px;background:#000;font-size:12px}';
    (document.head || document.documentElement).appendChild(s);
  };
  var paint = function () {
    if (!on || !ov) return;
    var p = P(), box = ov.querySelector('.as-box'); if (!p || !box) return;
    var hp = Math.max(0, Math.floor(p.hp || 0)), mhp = Math.max(1, Math.floor(p.mhp || 1)), req = 0;
    try { req = getExpReq(p.lv); } catch (e) {}
    var pct = isFinite(req) && req > 0 ? Math.min(100, (p.exp || 0) / req * 100).toFixed(2) + '%' : '—';
    var map = ''; try { map = (typeof mapDisplayName === 'function' && mapDisplayName(mapState.current)) || mapState.current || ''; } catch (e) {}
    var el = start ? Date.now() - start.t : 0, dl = (p.lv || 1) - (start ? start.lv : 0), dg = (p.gold || 0) - (start ? start.gold : 0);
    var low = hp / mhp < 0.3, dead = !!p.dead;
    box.innerHTML = '<div class="as-t">🌙 掛機中・' + dur(el) + '</div>'
      + '<div>' + (p.n || p.name || '') + '　Lv <b>' + (p.lv || 1) + '</b>' + (dl > 0 ? '（+' + dl + '）' : '') + '　經驗 <b>' + pct + '</b></div>'
      + '<div class="' + (low || dead ? 'as-hp' : '') + '">HP <b>' + fmt(hp) + '</b> / ' + fmt(mhp) + (dead ? '　已死亡' : '') + '</div>'
      + '<div>擊殺 <b>' + fmt(kills) + '</b>　金幣 <b>' + (dg >= 0 ? '+' : '') + fmt(dg) + '</b></div>'
      + '<div>' + map + '</div>'
      + (!wakeOk() ? '<div class="as-warn">這個瀏覽器不支援螢幕常亮：請到手機設定把「自動鎖定」改成「永不」，否則鎖螢幕後會停住。</div>' : (!lock ? '<div class="as-warn">螢幕常亮未啟用（點一下畫面重試）</div>' : ''))
      + '<div style="margin-top:4px">點兩下螢幕回到遊戲</div>';
  };
  var move = function () {
    if (!ov) return; var box = ov.querySelector('.as-box'); if (!box) return;
    box.style.left = Math.floor(Math.random() * 30 + 4) + 'vw'; box.style.top = Math.floor(Math.random() * 55 + 10) + 'vh';
  };

  function startMode() {
    if (on) return; var p = P(); if (!p) return;
    install(); css();
    on = true; kills = 0; start = { t: Date.now(), lv: p.lv || 1, gold: p.gold || 0 };
    saved = { vfx: W.__vfxOff, num: W.__vfxNumOff };
    W.__vfxOff = true; W.__vfxNumOff = true;
    document.body.classList.add('afk-screen-on');
    ov = document.createElement('div'); ov.id = 'afk-screen';
    ov.innerHTML = '<div class="as-box"></div><div class="as-exit">結束掛機</div>';
    ov.addEventListener('click', function (e) {
      if (e.target.closest('.as-exit')) { stopMode(); return; }
      var t = Date.now(); if (t - lastTap < 400) { stopMode(); return; } lastTap = t;
      if (!lock) acquire();
    });
    document.body.appendChild(ov);
    move(); paint(); acquire();
    try { sessionStorage.setItem('afk_screen_on', '1'); } catch (e) {}
    timer = setInterval(paint, THROTTLE); moveTimer = setInterval(move, 60000);
    try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">🌙 進入掛機模式：螢幕常亮、畫面全黑省電，戰鬥照常進行。點兩下螢幕回來。</span>'); } catch (e) {}
  }
  function stopMode() {
    if (!on) return;
    on = false; clearInterval(timer); clearInterval(moveTimer);
    try { sessionStorage.removeItem('afk_screen_on'); } catch (e) {}
    try { if (lock) lock.release(); } catch (e) {} lock = null;
    W.__vfxOff = saved.vfx; W.__vfxNumOff = saved.num;
    document.body.classList.remove('afk-screen-on');
    if (ov) { ov.remove(); ov = null; }
    var el = start ? Date.now() - start.t : 0;
    try { if (typeof _updateUIImpl === 'function') _updateUIImpl(); if (typeof _renderMobsImpl === 'function') _renderMobsImpl(); if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">🌙 結束掛機模式（' + dur(el) + '，擊殺 ' + fmt(kills) + '）。</span>'); } catch (e) {}
  }

  // 自動重新整理（更新版本、定時釋放記憶體）後回到掛機模式：同一個分頁內記住狀態
  try { if (sessionStorage.getItem('afk_screen_on') === '1') { var tries = 0, iv = setInterval(function () { tries++; var p = P(); if (p && document.getElementById('game-screen') && !document.getElementById('game-screen').classList.contains('hidden')) { clearInterval(iv); startMode(); } else if (tries > 120) { clearInterval(iv); try { sessionStorage.removeItem('afk_screen_on'); } catch (e) {} } }, 1000); } } catch (e) {}
  W.AFK_SCREEN = { start: startMode, stop: stopMode, on: function () { return on; }, wakeLock: function () { return !!lock; }, supported: wakeOk };
  console.log('[AFK-screen] 已啟用：掛機模式（熱鍵列 🌙）');
})();
