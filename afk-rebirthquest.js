/* ============================================================================
 * afk-rebirthquest.js — 轉生後再跑一次職業任務（玩家 2026-10-28；外掛開關，預設關）
 *
 * 天堂原本每個角色的職業任務只能做一次。開啟後：已轉生的角色，每轉生一次就能把職業任務從頭再做一次——
 *   ‧15／30／45 級試煉、55～80 級專屬劇情、亞丁的陰影（TRIAL_Q 裡屬於這個職業、等級 80 以下的任務）
 *   ‧50 級試煉（player.trialStage 回到未接取；魔族神殿已經開過的維持開放）
 * 做法：角色載入（或和 NPC 對話）時，若「開關開著、已轉生、這一轉還沒重置過」，就把上面那些任務狀態歸零一次，
 *   並記下 player.afkQuestRerun＝目前的轉生次數（二轉之後還能再重置一次）。舊狀態另存在 afkQuestRerunLog。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'rebirth-quest', name: '轉生後再跑一次職業任務', group: '遊戲玩法', def: false,
    desc: '已轉生的角色，每轉生一次可以把職業任務（15／30／45 級試煉、50 級試煉、55～80 級專屬劇情、亞丁的陰影）從頭再做一次、再拿一次獎勵' });
  var on = function () { return !!(T && T.enabled('rebirth-quest')); };
  if (typeof TRIAL_Q === 'undefined') { console.warn('[AFK-rebirthquest] 找不到 TRIAL_Q，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var keysOf = function (p) { return Object.keys(TRIAL_Q).filter(function (k) { var q = TRIAL_Q[k]; return q && q.cls === p.cls && (Number(q.lv) || 0) <= 80; }); };
  var apply = function (p, quiet) {
    p = p || P();
    if (!on() || !p || p.classicMode || !(Number(p.rebirth) >= 1)) return 0;
    if ((Number(p.afkQuestRerun) || 0) >= Number(p.rebirth)) return 0;
    if (typeof currentRoleIsMercenary === 'function') { try { if (currentRoleIsMercenary()) return 0; } catch (e) {} }
    p.trialQ = (p.trialQ && typeof p.trialQ === 'object') ? p.trialQ : {};
    var snap = {}, done = 0;
    keysOf(p).forEach(function (k) { var v = p.trialQ[k]; if (v) { snap[k] = v; if (v === 2) done++; p.trialQ[k] = 0; } });
    if (p.trialStage) { snap._trialStage = p.trialStage; if (p.trialStage > 1) done++; p.trialStage = 0; }
    var log = Array.isArray(p.afkQuestRerunLog) ? p.afkQuestRerunLog : [];
    log.push({ at: Date.now(), rebirth: p.rebirth, states: snap }); while (log.length > 3) log.shift();
    p.afkQuestRerunLog = log; p.afkQuestRerun = Number(p.rebirth);
    if (!quiet) { try { logSys('<span class="text-amber-200 font-bold">轉生之後，職業任務可以再做一次了</span><span class="text-slate-300">（重新開放 ' + done + ' 個已完成的任務；回到各職業的試煉導師那裡接取）。</span>'); } catch (e) {} }
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    return done || 1;
  };
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () { var r = oLoad.apply(this, arguments); try { setTimeout(function () { apply(); }, 0); } catch (e) {} return r; };
  }
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function () { try { apply(); } catch (e) {} return oNpc.apply(this, arguments); };
  }
  W.AFK_REBIRTH_QUEST = { apply: apply, keysOf: keysOf, on: on };
  console.log('[AFK-rebirthquest] 已載入：轉生後再跑一次職業任務（外掛開關，預設關）');
})();
