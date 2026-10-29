/* ============================================================================
 * afk-dropcap.js — 掉落種類上限（玩家 2026-10-29；需核心補丁 68）
 *   怪物掉落表（MOB_DROPS，含透視鏡匯入、時空裂痕的掉落）每次擊殺先全部擲一遍，擲中的再挑：
 *     一般怪：隨機 1～3 種；頭目：隨機 3～5 種。
 *     必掉的（這一下的機率 ≥ 100%，例如頭目必掉的材料、各種倍率疊滿的）不算在上限裡，照樣全給。
 *   其他掉落（卡片、萬能藥、遺物額外判定、副本專屬獎勵…）不受影響。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dropcap', name: '掉落種類上限', group: '遊戲玩法',
    desc: '每次擊殺從怪物掉落表擲中的物品，一般怪最多隨機 1～3 種、頭目 3～5 種；必掉的不算' });
  if (T && !T.enabled('dropcap')) return;
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  W.__afkDropCap = function (bag, mob) {
    var must = [], rest = [];
    bag.forEach(function (x) { (x[1] >= 1 ? must : rest).push(x[0]); });
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    var cap = mob && mob.boss ? rint(3, 5) : rint(1, 3);
    must.concat(rest.slice(0, cap)).forEach(function (id) { gainItem(id, 1); });
  };
  W.__afkDropCapInfo = { normal: [1, 3], boss: [3, 5] };
})();
