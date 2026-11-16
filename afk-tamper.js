/* ============================================================================
 * afk-tamper.js — 11-16 21:36 Ping：#791「偵測直接改資料」整個移除（誤鎖太多）。
 *   這支只剩清除：讀檔時把舊的標記（p.afkTp、道具上的 _tq）全部拿掉，之後不再偵測、不再懲罰。
 *   原本的程式備份在 git 歷史（#791～#806）。
 * ========================================================================== */
(function (W) {
  'use strict';
  var strip = function (it) { if (it && typeof it === 'object' && it._tq) delete it._tq; };
  var clean = function () {
    try {
      var p = (typeof player !== 'undefined' && player) ? player : null; if (!p) return;
      var had = !!p.afkTp; if (p.afkTp) delete p.afkTp;
      var eq = p.eq || {}; Object.keys(eq).forEach(function (k) { strip(eq[k]); });
      (p.inv || []).forEach(strip);
      if (had) { try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} try { if (W.__afkMioRefresh) W.__afkMioRefresh(); } catch (e) {} }
    } catch (e) {}
  };
  var wrapLoad = function () {
    var o = W.loadGame; if (typeof o !== 'function' || o.__afkTpClean) return;
    var f = function () { var r = o.apply(this, arguments); clean(); return r; };
    f.__afkTpClean = true; W.loadGame = f;
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  };
  W.addEventListener('load', function () { wrapLoad(); clean(); setTimeout(function () { wrapLoad(); clean(); }, 3000); });
  wrapLoad();
})(window);
