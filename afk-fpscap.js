/* ============================================================================
 * afk-fpscap.js — 畫面幀率上限（玩家 2026-10-29 23:44：固定 FPS 15／30／60，手機省電）
 *
 * 為什麼不是「降低更新頻率」：docs/perf-battery.md 實測，掛機的耗電大頭是瀏覽器每秒照樣合成約 57 幀，
 *   推它的是 ①requestAnimationFrame 迴圈 ②CSS 動畫／過場（HP 條寬度、光暈、閃爍…）③Web Animations（命中粒子、傷害數字）。
 *   遊戲邏輯少算幾次省不到電，要讓「畫面沒理由每幀重畫」才有用。
 * 做法（只影響畫面，戰鬥 0.1 秒一跳的邏輯、計時、離線補跑都不動）：
 *   ① requestAnimationFrame：排隊，每 1000/N 毫秒才放行一次（一次放行全部）。
 *   ② CSS 動畫／過場與 Web Animations：每 1000/N 毫秒掃一次 document.getAnimations()，
 *      把正在跑的暫停，改由這裡手動把時間往前推；跑完的照常結束（finish → animationend／onfinish 照常觸發）。
 *      暫停的動畫不會讓瀏覽器每幀重畫，畫面就只在這 N 次更新。
 *   ③ 捲動、點擊、輸入不受影響（瀏覽器本身處理）。
 * 設定存本機（每台裝置自己的效能偏好，不進存檔）：localStorage afk_ps_fps = 0（不限制）／60／30／15。
 * 外掛開關 fpscap（預設開；沒選上限＝完全照原版）。入口：首頁「⚙ 其他功能 → 🔋 省電模式」。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fpscap', name: '畫面幀率上限（省電模式）', group: '效能',
    desc: '在省電模式選 15／30／60 FPS：動畫與特效只用這個頻率更新，手機與高更新率螢幕更省電；戰鬥計算不受影響' });
  if (T && !T.enabled('fpscap')) return;

  var CAPS = [0, 60, 30, 15], KEY = 'afk_ps_fps';
  var cap = 0, hz = 60, active = false;   // active＝真的要限（上限低於螢幕更新率；60 FPS 上限在 60Hz 螢幕上什麼都不做，免得白白多花 CPU）
  try { var v = Number(localStorage.getItem(KEY)); if (CAPS.indexOf(v) > 0) cap = v; } catch (e) {}
  var now = function () { return (W.performance && performance.now) ? performance.now() : Date.now(); };

  // ── ① requestAnimationFrame ──
  var nRAF = W.requestAnimationFrame ? W.requestAnimationFrame.bind(W) : null;
  var nCAF = W.cancelAnimationFrame ? W.cancelAnimationFrame.bind(W) : null;
  var queue = new Map(), seq = 1e9, armed = false, lastFlush = 0, rafCalls = 0, flushes = 0;
  var flush = function (ts) {
    armed = false; lastFlush = now(); flushes++;
    var list = queue; queue = new Map();
    list.forEach(function (cb) { try { cb(ts); } catch (e) { setTimeout(function () { throw e; }, 0); } });
  };
  var arm = function () {
    if (armed) return; armed = true;
    var wait = lastFlush + 1000 / cap - now() - 1;
    if (wait <= 0) nRAF(flush); else setTimeout(function () { nRAF(flush); }, wait);
  };
  if (nRAF && nCAF) {
    W.requestAnimationFrame = function (cb) {
      rafCalls++;
      if (!active || typeof cb !== 'function') return nRAF(cb);
      var id = ++seq; queue.set(id, cb); arm(); return id;
    };
    W.cancelAnimationFrame = function (id) { if (queue.has(id)) { queue.delete(id); return; } nCAF(id); };
  }

  // ── ② CSS 動畫／過場、Web Animations ──
  //   接手的時機：動畫一開始（animationstart／transitionrun 事件、Element.animate）就接手，之後每一步只推進自己手上的，
  //   不再每一步掃整個文件（掃描會逼瀏覽器重算全部樣式，實測樣式重算 ×11、CPU 反而 +20%）；每 2 秒補掃一次漏網的。
  var owned = new Set(), timer = null, sweepT = null, lastPump = 0, pumps = 0;
  var canAnim = typeof document !== 'undefined' && typeof document.getAnimations === 'function';
  var endOf = function (a) { try { var t = a.effect && a.effect.getComputedTiming(); return t ? Number(t.endTime) : Infinity; } catch (e) { return Infinity; } };
  var targetOf = function (a) { try { return a.effect && a.effect.target; } catch (e) { return null; } };
  var adopt = function (a) {
    if (!active || !a || owned.has(a)) return;
    try {
      if (a.playState !== 'running') return;
      var ct = Number(a.currentTime) || 0, rate = Number(a.playbackRate) || 1, end = endOf(a);
      a.pause(); a.currentTime = ct;
      a.__afkFps = true; a.__afkCt = ct; a.__afkRate = rate; a.__afkEnd = end; owned.add(a);
    } catch (e) {}
  };
  var adoptOn = function (el, match) {
    if (!active || !el || typeof el.getAnimations !== 'function') return;
    try { el.getAnimations().forEach(function (a) { if (match(a)) adopt(a); }); } catch (e) {}
  };
  if (canAnim) {
    document.addEventListener('animationstart', function (e) { adoptOn(e.target, function (a) { return a.animationName === e.animationName; }); }, true);
    document.addEventListener('transitionrun', function (e) { adoptOn(e.target, function (a) { return a.transitionProperty === e.propertyName; }); }, true);
    if (W.Element && Element.prototype.animate) {
      var oAnimate = Element.prototype.animate;
      Element.prototype.animate = function () { var a = oAnimate.apply(this, arguments); if (active) adopt(a); return a; };
    }
  }
  var pump = function () {
    if (!active || !canAnim) return;
    if (document.hidden) { lastPump = now(); return; }
    var t = now(), dt = lastPump ? Math.min(250, t - lastPump) : 0; lastPump = t; pumps++;
    owned.forEach(function (a) {
      var tg = targetOf(a);
      if (!a.__afkFps || (tg && !tg.isConnected)) { owned.delete(a); a.__afkFps = false; return; }   // 元素拿掉了
      var ct = a.__afkCt + dt * a.__afkRate;
      if (a.__afkRate > 0 && isFinite(a.__afkEnd) && ct >= a.__afkEnd) { owned.delete(a); a.__afkFps = false; try { a.play(); a.finish(); } catch (e) {} return; }
      a.__afkCt = ct; try { a.currentTime = ct; } catch (e) { owned.delete(a); }
    });
  };
  var sweep = function () {   // 補掃：被別人重新播放、取消的放手；漏接的接手
    if (!active || !canAnim || document.hidden) return;
    var list; try { list = document.getAnimations(); } catch (e) { return; }
    var seen = new Set();
    list.forEach(function (a) { seen.add(a); if (owned.has(a) && a.playState !== 'paused') { owned.delete(a); a.__afkFps = false; } });
    owned.forEach(function (a) { if (!seen.has(a)) { owned.delete(a); a.__afkFps = false; } });
    list.forEach(function (a) { if (!owned.has(a)) adopt(a); });
  };
  var release = function () {
    owned.forEach(function (a) { try { if (a.__afkFps && a.playState === 'paused') a.play(); a.__afkFps = false; } catch (e) {} });
    owned.clear();
  };
  var apply = function () {
    if (timer) { clearInterval(timer); timer = null; } if (sweepT) { clearInterval(sweepT); sweepT = null; }
    active = !!cap && cap < hz * 0.9;
    if (!active) { release(); if (queue.size && nRAF) { var q = queue; queue = new Map(); q.forEach(function (cb) { nRAF(cb); }); } return; }
    lastPump = 0;
    if (canAnim) { timer = setInterval(pump, Math.round(1000 / cap)); sweepT = setInterval(sweep, 2000); sweep(); }
  };
  // 量螢幕更新率：原生 rAF 連續 40 幀，取「比較短的那一段間隔」（第 25 百分位）——幀只會遲到、不會早到，
  //   載入中或忙的時候平均值會被拉長（實測載入中量到 19～30Hz），短的那段才是螢幕真正的更新間隔。
  var measure = function (done) {
    if (!nRAF) { done && done(); return; }
    var last = 0, gaps = [];
    var step = function (ts) {
      if (last) gaps.push(ts - last); last = ts;
      if (gaps.length < 40) { nRAF(step); return; }
      gaps.sort(function (a, b) { return a - b; });
      var g = gaps[Math.floor(gaps.length * 0.25)]; if (g > 2) hz = Math.round(1000 / g);
      done && done();
    };
    nRAF(step);
  };
  var set = function (n) {
    n = Number(n) || 0; if (CAPS.indexOf(n) < 0) n = 0;
    cap = n; try { localStorage.setItem(KEY, String(n)); } catch (e) {}
    apply(); return cap;
  };
  apply();   // 先照 60Hz 假設套用，載入完 3 秒再量實際更新率
  W.addEventListener('load', function () { setTimeout(function () { measure(apply); }, 3000); });
  try { document.addEventListener('visibilitychange', function () { if (!document.hidden && cap) measure(apply); }); } catch (e) {}

  W.AFK_FPS = { CAPS: CAPS, get: function () { return cap; }, set: set, pump: pump, sweep: sweep,
    hz: function () { return hz; }, active: function () { return active; },
    _setHz: function (h) { hz = h; apply(); },   // 測試用（無頭瀏覽器的更新率不一定是 60）
    stats: function () { return { cap: cap, hz: hz, active: active, rafCalls: rafCalls, flushes: flushes, pumps: pumps, owned: owned.size, queued: queue.size }; } };
  try { console.log('[AFK-fpscap] 已載入：畫面幀率上限 ' + (cap ? cap + ' FPS' : '不限制')); } catch (e) {}
})();
