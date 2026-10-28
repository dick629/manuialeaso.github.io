/* ============================================================================
 * afk-lowend.js — 低階電腦自動偵測（玩家 2026-10-27：8G 記憶體的電腦也要順跑）
 *
 * 第一次在這台裝置開遊戲時，看 CPU 核心數／記憶體／是否有 GPU 加速，符合「低階」就自動套用省電模式的
 * 「流暢顯示」預設（關光暈濾鏡＋關戰鬥特效；docs/perf-battery.md 實測各省 22～25%、16～17%），並把動畫
 * 圖片快取預算縮小。只做一次（記在 localStorage），玩家之後在首頁「省電模式」改回去就不再動。
 *
 * 判定（任一成立＝低階）：
 *   ‧navigator.hardwareConcurrency ≤ 4
 *   ‧navigator.deviceMemory ≤ 4（Chrome 回報上限是 8，所以 8G 機器回 8；4 以下才算）
 *   ‧WebGL 拿不到硬體加速（SwiftShader／沒有 GPU）且核心數 ≤ 6
 *   自動化測試（navigator.webdriver）不套用
 * 另外：所有裝置都把「切到背景時的 sprite ticker」交給核心既有的 hidden 守衛，這裡不重複做。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'lowend', name: '低階電腦自動省電', desc: '偵測到 4 核以下／4G 以下／無 GPU 加速時，第一次自動套用「流暢顯示」', group: '效能' });
  var on = function () { return !T || T.enabled('lowend'); };
  var KEY = 'afk_lowend_done';
  var gpuOk = function () {
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      if (/swiftshader|llvmpipe|software/i.test(r)) return false;
      return true;
    } catch (e) { return true; }
  };
  var detect = function () {
    var cores = Number(navigator.hardwareConcurrency) || 0, mem = Number(navigator.deviceMemory) || 0;
    var low = (cores > 0 && cores <= 4) || (mem > 0 && mem <= 4) || (cores > 0 && cores <= 6 && !gpuOk());   // 沒 GPU 加速：只有在核心數也偏少時才算（headless／自動化測試不算）
    return { low: low, cores: cores, mem: mem };
  };
  var apply = function () {
    if (!on()) return;
    if (navigator.webdriver) return;   // 自動化測試環境不套用
    try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
    var d = detect();
    try { localStorage.setItem(KEY, d.low ? '1' : '0'); } catch (e) {}
    if (!d.low) return;
    try { if (W.AFK_POWERSAVE && AFK_POWERSAVE.preset) AFK_POWERSAVE.preset('smooth'); } catch (e) {}
    try { if (W.AFK_PERF_MEM && AFK_PERF_MEM.setBudget) AFK_PERF_MEM.setBudget(96 * 1048576); } catch (e) {}
    var msg = '偵測到這台裝置比較吃力（' + (d.cores ? d.cores + ' 核' : '') + (d.mem ? '／' + d.mem + 'G' : '') + '），已自動改用「流暢顯示」（關閉光暈濾鏡與戰鬥特效）。想改回來：首頁 ⚙ 其他功能 → 🔋 省電模式。';
    try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">🔋 ' + msg + '</span>'); } catch (e) {}
    try { if (W.AFK_TOAST && AFK_TOAST.show) AFK_TOAST.show(msg); } catch (e) {}
  };
  if (document.readyState === 'complete') setTimeout(apply, 1500); else W.addEventListener('load', function () { setTimeout(apply, 1500); });
  W.AFK_LOWEND = { detect: detect, apply: apply };
})();
