/* ============================================================================
 * afk-novice-econ.js — 新手曲線：掉落、金幣、NPC 收費（玩家 2026-10-29）
 *
 *   一、無用掉落物降機率：掉落表上有、但沒有任何 NPC 收、不能製作、不能使用、也沒有說明的東西（甘地／羅孚／都達瑪拉／阿吐巴／那魯加圖騰、
 *       邪惡蜥蜴之鱗；全部掉落物逐一比對過：其他寫著「交給○○」「兌換」「製作材料」的，程式裡都真的有那條路）→ 掉落機率 ×0.2。
 *   二、金幣：Lv30 以下的一般怪每次都掉金幣（原本 70% 機率；頭目本來就 100%）。Lv31 起照舊。
 *   三、魔物追蹤收費依等級：Lv²×10 金幣，最低 2,000、最高 100,000（Lv20 → 4,000；Lv50 → 25,000；Lv100 起 10 萬，跟原本一樣）。
 *   其他收費（材料工坊提煉 100 金幣、傳送 82、遺忘之島船費 10 萬、更換精通 300 萬）沒動。
 * 需要排在 afk-classic（它設 __afkGoldRate）與 afk-ttmi-items（掉落表匯入）之後、afk-bosstrack 之前也可以（它執行時才讀 __afkTrackCost）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'noviceecon', name: '新手曲線（掉落、金幣、追蹤收費）', group: '遊戲玩法',
    desc: '沒用的掉落物機率 ×0.2；Lv30 以下的怪每次都掉金幣；魔物追蹤收費依等級 Lv²×10（最低 2,000、最高 100,000）' });
  if (T && !T.enabled('noviceecon')) return;
  var USELESS = { new_item_148: 1, new_item_149: 1, new_item_147: 1, new_item_145: 1, new_item_146: 1, new_item_232: 1 };
  var CUT = 0.2, GOLD_LV = 30, TRACK_MIN = 2000, TRACK_MAX = 100000;
  var cut = 0;
  try {
    if (typeof MOB_DROPS !== 'undefined') Object.keys(MOB_DROPS).forEach(function (n) { (MOB_DROPS[n] || []).forEach(function (e) { if (USELESS[e[0]] && !e._afkCut) { e[1] = e[1] * CUT; e._afkCut = true; cut++; } }); });
    Object.keys(USELESS).forEach(function (id) { var d = DB.items[id]; if (d && !/用途/.test(String(d.d || ''))) d.d = (d.d ? d.d + ' ' : '') + '（目前沒有 NPC 收、也沒有用途，只能賣給商店；掉落機率已調低。）'; });
  } catch (e) {}
  var oRate = W.__afkGoldRate;
  W.__afkGoldRate = function (mob) {
    var r = typeof oRate === 'function' ? oRate.apply(this, arguments) : 0.7;
    try { if (mob && !mob.boss && (Number(mob.lv) || 1) <= GOLD_LV) return 1; } catch (e) {}
    return r;
  };
  W.__afkTrackCost = function (p) { var lv = Math.max(1, Number(p && p.lv) || 1); return Math.max(TRACK_MIN, Math.min(TRACK_MAX, lv * lv * 10)); };
  W.__afkNoviceEcon = { USELESS: USELESS, CUT: CUT, GOLD_LV: GOLD_LV, cut: cut,
    trackCostText: function () { return 'Lv²×10（最低 ' + TRACK_MIN.toLocaleString() + '、最高 ' + TRACK_MAX.toLocaleString() + '）'; } };
  // 奧貝勒的對話與按鈕上的 10 萬改成目前等級的價錢
  if (typeof W.renderObelNPC === 'function') {
    var oR = W.renderObelNPC;
    W.renderObelNPC = function (div) {
      var r = oR.apply(this, arguments);
      try { var c = W.__afkTrackCost(player).toLocaleString(); div.querySelectorAll('button, div').forEach(function (x) { if (x.children.length === 0 && /100,000 金幣/.test(x.textContent)) x.textContent = x.textContent.replace('100,000 金幣', c + ' 金幣（Lv' + player.lv + '）'); }); } catch (e) {}
      return r;
    };
  }
})();
