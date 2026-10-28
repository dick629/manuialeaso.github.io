/* ============================================================================
 * afk-classic-core.js — 經典版：在所有外掛疊上去之前，先記住「原作者原版」的樣子
 *
 * 必須排在 afk-toggles 之後、其他外掛之前。
 *   ‧recomputeStats：原版能力值計算（經典角色只走這一條，外掛疊上去的加成全部不算）
 *   ‧各村莊原本的 NPC 名單：外掛後來加的 NPC 在經典版一律灰掉
 *   ‧原版變身名單（POLY_TIERS，最高 Lv80）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, core = {};
  try { if (typeof W.recomputeStats === 'function') core.recomputeStats = W.recomputeStats; } catch (e) {}
  try {
    core.npcIds = {};
    if (typeof DB !== 'undefined' && DB.towns) Object.keys(DB.towns).forEach(function (t) { ((DB.towns[t] && DB.towns[t].npcs) || []).forEach(function (n) { if (n && n.id) core.npcIds[n.id] = 1; }); });
  } catch (e) {}
  try {
    core.polyNames = {};
    if (typeof POLY_TIERS !== 'undefined') POLY_TIERS.forEach(function (t) { (t.forms || []).forEach(function (f) { if (f && f.n) core.polyNames[f.n] = f.lv || 0; }); });
  } catch (e) {}
  W.__afkClassicCore = core;
  // 等級上限的底線（玩家 2026-10-28：關掉「輪迴轉生」後，核心的存檔檢查把已轉生角色的 Lv150 夾回 100，而且會存檔＝等級永久消失）。
  //   這裡先依存檔裡的轉生次數給一個底線：轉生 1 次 150、2 次 200；afk-rebirth／afk-rebirth2／afk-classic 載入時會照舊覆蓋。
  //   這樣不管哪個外掛被關掉或沒載入成功，都不會把等級往下夾。
  W.__afkLvCap = function (p) { var r = Number(p && p.rebirth) || 0; return r >= 2 ? 200 : r >= 1 ? 150 : 100; };
})();
