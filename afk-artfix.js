/* ============================================================================
 * afk-artfix.js — 圖檔修復版（玩家 2026-11-06：「把圖檔更換修復過去 舊的先保留 製作開關」）
 *
 *   玩家提供的修復包（裝備／道具圖示＋法術特效逐格）：3,322 個原圖路徑 → art-fix/ 底下的 WebP。
 *     圖示：art-fix/icons/<雜湊>.webp（同一張新圖共用）；特效：原本的圖集切成每格一張（尺寸與原圖完全相同，錨點不變）。
 *   對照表 afk-artfix-data.js（scripts/build-artfix.py 產生）。原圖都保留，不刪。
 *   開關 artfix（預設關）：開啟時，圖示網址（getIconUrl）與 <img>／new Image() 設定網址的當下，把原圖換成修復版；
 *     關掉＝之後設定的網址回到原圖。已經載入畫面的圖、法術特效預載的格子要重新整理才全部換掉。
 *   跟「GPT新美術」（art-v3）的裝備圖示修補同時開時，這裡優先（這支比 afk-gptart-icons 晚載，包在它外面）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, M = W.AFK_ARTFIX;
  if (T && T.register) T.register({ id: 'artfix', name: '圖檔修復版', group: '遊戲介面', def: false,
    desc: '把裝備、道具圖示與法術特效換成修復過光影的新版（只換外觀；原圖保留，關掉就換回）。切換後重新整理一次才會全部換掉。' });
  if (!M || typeof HTMLImageElement === 'undefined') return;
  var on = function () { return !!T && T.enabled('artfix'); };
  var hits = 0, back = null;
  // GPT新美術（art-v3）把 assets/icons/<類>/<名>.png 換成 assets/icons/gpt/eq<編號>.webp；反查回原圖（同編號的別名原圖本來就相同）
  var gptBack = function () {
    if (back) return back; back = {};
    var G = W.AFK_GPT_ICONS || {};
    for (var c in G) for (var n in G[c]) { var k = G[c][n] + '.webp'; if (!back[k]) back[k] = 'icons/' + c + '/' + n + '.png'; }
    return back;
  };
  var map = function (u) {
    if (typeof u !== 'string' || u.indexOf('assets/') < 0 || !on()) return u;
    var q = '', qi = u.search(/[?#]/); if (qi >= 0) { q = u.slice(qi); u = u.slice(0, qi); }
    var raw = u, p = u;
    if (p.indexOf('%') >= 0) { try { p = decodeURIComponent(p); } catch (e) { return raw + q; } }
    var at = p.indexOf('assets/'); if (at < 0) return raw + q;
    var rest = p.slice(at + 7);
    if (rest.indexOf('icons/gpt/eq') === 0) { var o = gptBack()[rest.slice(12)]; if (!o) return raw + q; rest = o; }   // 已被 art-v3 換掉的 → 找回原圖
    var sl = rest.lastIndexOf('/'), dot = rest.lastIndexOf('.');
    if (sl < 0 || dot < sl) return raw + q;
    var ext = rest.slice(dot), g = M[rest.slice(0, sl)]; if (!g) return raw + q;
    var id = g[rest.slice(sl + 1, dot) + (ext === '.png' ? '' : ext)]; if (!id) return raw + q;
    hits++;
    return p.slice(0, at) + 'art-fix/' + (id.charAt(0) === 'f' ? 'fx/' : 'icons/') + id.slice(1) + '.webp';
  };
  if (typeof W.getIconUrl === 'function') {
    var oIcon = W.getIconUrl;
    W.getIconUrl = function () { return map(oIcon.apply(this, arguments)); };
  }
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.configurable) Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, map(v)); }
    });
  } catch (e) { console.warn('[AFK-artfix] 無法掛上 <img> 網址轉換', e); }
  W.__afkArtFix = { map: map, hits: function () { return hits; }, size: function () { var n = 0; for (var k in M) n += Object.keys(M[k]).length; return n; } };
})();
