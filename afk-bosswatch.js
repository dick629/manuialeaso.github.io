/* ============================================================================
 * afk-bosswatch.js — 頭目卡住保險（玩家 2026-11-04「謀反者副本 會有王卡住問題」；Ping 核准；外掛開關 bosswatch，預設開）
 *
 *   只看「頭目」（boss 或謀叛者的低語各層的怪），不看一般怪、建築（攻城塔、城門、樓梯）、攻城區、木人場、玩家對手。
 *   一、HP 0 卻沒倒下：某些扣血路徑扣完沒有呼叫 killMob（或 killMob 過程丟例外），頭目就停在 0 HP、打不到也不會死，
 *       副本等不到牠倒下就卡住。HP ≤ 0 持續 3 秒（30 tick）→ 走正常的 killMob（經驗、掉落、各外掛的擊殺結算照跑）。
 *       刻意不死的狀態一律交給 killMob 自己的包裝決定（女神幽影、三段變身、安塔瑞斯通關寫入失敗回 1 HP…），
 *       它們把 HP 拉回來或不讓牠死，這裡就不再動（同一隻每 10 秒最多再試一次）。
 *       HP 變成 NaN／不是數字：換回上一次的正常 HP（沒有就回滿），不當成死亡。
 *   二、打不動：你鎖定的頭目 60 秒 HP 完全沒變 → 清掉「過期或時間不合理」的免疫／反彈屏障（_reflectWall：結束時間不是數字、
 *       已經過期、或還要超過 5 分鐘）。仍在有效期間內的免疫、女神與夢域鏡四龍的永久免疫（規則本身，不是旗標）、
 *       幽影、時空四龍、攻城鏡像都不碰。
 *   三、要王倒下才會推進的副本裡，王不能迷魅（2026-11-04 Ping：所有副本都會王卡住）：迷魅成功會把怪直接從場上拿走、
 *       不經過 killMob，謀叛者／異界祭壇的層數、火焰之影與哈爾巴斯、幽靈船長、安塔瑞斯巢穴的下一區、傲慢之塔的樓梯都等不到。
 *       範圍：安塔瑞斯巢穴、時空裂痕、暗夢星迴、傲慢之塔攀登與外掛副本（軍王之室、祭壇、龍窟、聖地會自己重生，不受影響）。
 *   玩家看不到任何訊息（強制擊殺時 killMob 本來就會記「擊敗了…」）；診斷寫在 console 與 window.__afkBossWatch.log。
 *   要排在所有包 tick、killMob 的外掛之後（放 afk-intdmg 前一支）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bosswatch', name: '頭目卡住保險', group: '系統與其他',
    desc: '頭目 HP 歸零卻沒倒下時自動結算擊殺；過期的免疫屏障卡住時自動清掉；要打倒王才會前進的副本裡，王不能被迷魅' });
  var on = function () { return !T || T.enabled('bosswatch'); };
  var P0 = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var CFG = { zombieTicks: 30, retryTicks: 100, stallTicks: 600, maxWall: 3000 };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : null; };
  var tk = function () { var s = S(); return (s && Number(s.ticks)) || 0; };
  var LOG = [];
  var note = function (msg) { LOG.push([tk(), msg]); if (LOG.length > 50) LOG.shift(); try { console.warn('[AFK-bosswatch] ' + msg); } catch (e) {} };

  var skipMap = function (cur) {
    if (!cur || /^town_/.test(cur) || cur === 'training') return true;
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(cur)) return true; } catch (e) {}
    return false;
  };
  var watched = function (m) {
    if (!m || m._dead || typeof m !== 'object') return false;
    if (!(m.boss || m._afkTrLayer)) return false;
    if (m.race === '建築' || m.trollPlayer || m._pvpDuelFoe || m._afkCharmSnap) return false;
    return true;
  };
  // 要「王倒下」才會推進的副本：安塔瑞斯巢穴、時空裂痕、暗夢星迴、傲慢之塔攀登與外掛副本。這些地方的王被迷魅會直接從場上消失、
  //   不經過 killMob → 層數／波數／船長／下一區永遠等不到（王卡住）。軍王之室、底比斯／提卡爾祭壇、龍窟、聖地是空格 5 秒後重生
  //   （雙王祭壇另有「兩隻都不在＝全滅」的核心保險），迷魅不會卡住，照原本規則可以迷魅。
  var PLUGIN_DG = { afk_traitor_whisper: 1, afk_hardin_time: 1, afk_giltas_altar: 1, afk_flame_depth: 1, afk_halpas_nest: 1, afk_final_sea: 1,
    afk_soul_room: 1, afk_ghostship: 1, afk_starroad: 1, rift_battle: 1,
    afk_guard_dg_moon: 1, afk_guard_dg_steel: 1, afk_guard_dg_swan: 1, afk_guard_dg_shadow: 1, afk_guard_dg_magic: 1 };   // 守護者之戒的五個騎士副本（afk-guardring）
  var instanceMap = function (cur) {
    if (!cur || /^town_/.test(cur)) return false;
    if (PLUGIN_DG[cur]) return true;
    try { if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[cur]) return true; } catch (e) {}
    var s = S(); return !!(s && (s.dreamStar || s.prideClimb || s.antharas || s.riftRun));
  };
  // 永久免疫是規則本身的頭目：打不動是設計，不清任何東西
  var designedImmune = function (m) { return !!(m._afkFinal || m._afkApostle || m._g3Dragon || m._afkDragonStage); };

  var fixNaN = function (m) {
    if (typeof m.curHp === 'number' && !isNaN(m.curHp)) return false;
    var b = Number(m._afkWdHp); m.curHp = (b > 0 && isFinite(b)) ? b : (Number(m.hp) > 0 ? Number(m.hp) : 1);
    note(m.n + ' 的 HP 不是數字，已還原為 ' + m.curHp);
    return true;
  };
  var forceKill = function (idx, m) {
    var t = tk();
    if (m._afkWdTry != null && t - m._afkWdTry < CFG.retryTicks && t >= m._afkWdTry) return;
    m._afkWdTry = t;
    note(m.n + ' HP ' + m.curHp + ' 卻沒倒下 ' + CFG.zombieTicks + ' tick 以上，強制結算擊殺');
    try { killMob(idx); } catch (e) { note('killMob 丟例外：' + (e && e.message)); }
    if (!m._dead && !(m.curHp > 0)) note(m.n + ' 仍未倒下（' + m.curHp + '），稍後再試');
  };
  var staleWall = function (m, t) {
    var w = m._reflectWall; if (!w) return false;
    var u = Number(w.until);
    return !isFinite(u) || u < t || u - t > CFG.maxWall;
  };
  var unstick = function (m) {
    var t = tk(), cleared = [];
    if (staleWall(m, t)) { cleared.push('_reflectWall(until=' + m._reflectWall.until + ')'); m._reflectWall = null; }
    if (cleared.length) note(m.n + ' HP ' + CFG.stallTicks + ' tick 沒變，清掉過期的狀態：' + cleared.join('、'));
    return cleared;
  };

  var step = function () {
    var s = S(); if (!s || typeof mapState === 'undefined' || !mapState || !mapState.mobs) return;
    if (typeof player === 'undefined' || !player || !player.cls) return;
    var cur = mapState.current; if (skipMap(cur)) return;
    var t = tk(), ms = mapState.mobs, dg = instanceMap(cur);
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; if (!watched(m)) continue;
      if (dg && !m.noCharm) { m.noCharm = true; m._afkWdNoCharm = true; }
      if (dg && !m.noAutoTeleport) { m.noAutoTeleport = true; m._afkWdNoTp = true; }   // 四、副本裡勾「迴避頭目」不會用瞬移卷軸把王甩掉（甩掉＝沒倒下就消失，層數／下一道門等不到；玩家 2026-11-05）   // 三、副本裡的王不能迷魅（迷魅只能手動、在兩刻之間施放，每一刻結束時標上就來得及）
      if (fixNaN(m)) continue;
      // 一、HP 0 卻沒倒下
      if (!(m.curHp > 0)) {
        if (m._afkWdZ == null || t < m._afkWdZ) m._afkWdZ = t;
        else if (t - m._afkWdZ >= CFG.zombieTicks) forceKill(i, m);
        continue;
      }
      m._afkWdZ = null;
      // 二、鎖定中、HP 一直沒變
      if (m._afkWdHp !== m.curHp || m._afkWdAt == null || t < m._afkWdAt) { m._afkWdHp = m.curHp; m._afkWdAt = t; continue; }
      if (mapState.targetIdx !== i || player.dead || designedImmune(m)) { m._afkWdAt = t; continue; }
      if (t - m._afkWdAt >= CFG.stallTicks) { m._afkWdAt = t; unstick(m); }
    }
  };

  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      if (tk() !== t0 && on()) { try { step(); } catch (e) { try { console.warn('[AFK-bosswatch]', e); } catch (e2) {} } }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  // 五、要打倒王才會前進的副本裡不能瞬移（玩家 2026-11-05 01:24「使用瞬移會卡住不出怪」）：瞬移＝把場上的王直接清掉、沒有倒下，
  //   下一道門／下一層永遠等不到。擋在瞬間移動卷軸與傳送術最前面：不消耗卷軸、不扣 MP。
  var tpBlocked = function () { var p = P0(); if (!on() || !p || p.classicMode) return false; var cur = (typeof mapState !== 'undefined' && mapState) ? mapState.current : ''; return !!(cur && !/^town_/.test(cur) && cur !== 'training' && instanceMap(cur)); };
  var tpMsg = function (what) { try { if (typeof logSys === 'function') logSys('<span class="text-red-400">副本裡的空間被封住了，無法使用' + what + '。</span>'); } catch (e) {} };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      try {
        if (tpBlocked()) { var it = (P0().inv || []).find(function (x) { return x && x.uid === u; }), d = it && DB.items[it.id];
          if (d && d.eff === 'teleport_scroll') { if (!arguments[1]) tpMsg('瞬間移動卷軸'); return; } }
      } catch (e) {}
      return oUse.apply(this, arguments);
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  if (typeof W.manualCast === 'function') {
    var oCast = W.manualCast;
    W.manualCast = function (sid) {
      try { if (tpBlocked() && DB.skills[sid] && DB.skills[sid].mEff === 'teleport') { tpMsg('傳送術'); return; } } catch (e) {}
      return oCast.apply(this, arguments);
    };
    try { (0, eval)('manualCast = window.manualCast'); } catch (e) {}
  }
  W.__afkBossWatch = { CFG: CFG, step: step, instanceMap: instanceMap, tpBlocked: tpBlocked, watched: watched, staleWall: staleWall, unstick: unstick, log: LOG };
})();
