/* ============================================================================
 * afk-mobborn.js — 讀檔後，場上留下來的怪重新排「出生序」（玩家 2026-10-30 11:42：底比斯祭壇 90 分鐘打了 698 隻賀洛斯、阿努比斯一隻都沒死）
 *
 * 原因：自動選目標是「挑出生序最小（在場上最久）的怪」。出生序是每次開遊戲從 0 重新算的計數器，
 *   但場上的怪會跟著存檔保存下來、保留上一次的出生序（玩很久之後會是好幾萬）。
 *   重新整理／重新登入之後，新生出來的怪出生序從 1 開始，永遠比存檔留下來的那隻小 → 自動目標一直挑新怪，
 *   存檔留下來的那隻（這次是阿努比斯）永遠排不到；頭目沒被物理攻擊時每 5 秒回 2.5% HP，只被範圍技能掃到也打不死。
 *   雙頭目祭壇又規定「場上已有的頭目不會再生第二隻」→ 只會一直生賀洛斯，看起來就像阿努比斯卡住了。
 *   跟遺物無關；需要「重新整理前，阿努比斯剛好在場上」才會發生，所以很難重現。
 * 改法：讀檔後依原本的先後順序，把場上的怪重新編進這次的出生序（最舊的仍然最先被打）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var renumber = function () {
    try {
      if (typeof mapState === 'undefined' || !mapState || !Array.isArray(mapState.mobs) || typeof _mobBornSeq === 'undefined') return 0;
      var live = mapState.mobs.filter(function (m) { return m && typeof m === 'object'; });
      if (!live.length) return 0;
      // 出生序比目前計數器還大的＝存檔帶進來的（上一次開遊戲生的），一律排在這次新生的前面；兩組內各自保持原本先後
      var cur = _mobBornSeq, key = function (m) { return m._born != null ? m._born : Infinity; };
      var old = live.filter(function (m) { return !(key(m) <= cur); }).sort(function (a, b) { return key(a) - key(b); });
      var now = live.filter(function (m) { return key(m) <= cur; }).sort(function (a, b) { return key(a) - key(b); });
      old.concat(now).forEach(function (m) { m._born = ++_mobBornSeq; });
      return old.length;
    } catch (e) { return 0; }
  };
  if (typeof W.loadGame === 'function') {
    var o = W.loadGame;
    W.loadGame = function () { var r = o.apply(this, arguments); renumber(); return r; };
  }
  W.__afkMobBorn = { renumber: renumber };
})();
