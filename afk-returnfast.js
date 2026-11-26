/* ==========================================================================
 * afk-returnfast.js — 回城不卡（玩家 2026-10-27：回城畫面停 ~0.5 秒）
 *
 * 量測（玩家存檔、7 名傭兵）：回城的 changeMap 裡，「依最新存檔刷新全部隊員」（refreshAllAllies）
 * 佔了九成——逐名讀來源存檔重建戰力快照、結算傭兵經驗，最後當場存檔（開著存檔即時壓縮時還要壓一次）。
 * 這些都跟「畫面切到村莊」無關，卻跟換畫面擠在同一段，於是整個畫面停住。
 *
 * 做法：玩家「主動」回城／傳送進安全區時（changeMap 沒帶 force），先把村莊畫面換好、讓瀏覽器畫出來，
 * 下一個空檔再刷新隊員（內容與時機點以外完全照舊：結算後立刻存檔、刷新完重算一次能力與畫面）。
 *   ‧載入存檔、死亡復活等內部流程（force）照舊同步刷新，不改變任何既有順序。
 *   ‧排程期間如果已經離開安全區，就不刷新——等下次進安全區再一起結算（經驗留在帳上，不會遺失也不會重複）。
 *   ‧排程期間關分頁：刷新還沒做＝經驗還沒結算，存檔裡仍是未結算的帳，下次照常結算（不會重複入帳）。
 *
 * 2026-10-30 13:18（玩家：回城回村還是有點卡）：延後之後，刷新本身仍是一整塊 180～240 毫秒
 *   （7 名隊員重建 ~120、存檔 ~95、重算能力 ~65）一次跑完，畫面在進村後停一下。
 *   → 拆成好幾段、每段之間讓瀏覽器喘口氣：每名隊員各一段 → 收尾（雙重受僱檢查）＋存檔一段 → 重算能力與畫面一段。
 *   ‧一旦開始就一定跑到存檔那一段（中途離開安全區也照跑），結算過的經驗一定會存進去；中途關分頁有核心的關閉存檔兜底。
 *   ‧找不到核心的單名刷新函式時，退回原本一次跑完。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof W.changeMap !== 'function' || typeof W.refreshAllAllies !== 'function') { console.warn('[AFK-returnfast] 找不到 changeMap / refreshAllAllies，略過'); return; }
  if (W.changeMap.__afkReturnFast) return;
  var inTown = function () { try { return typeof mapState !== 'undefined' && String(mapState.current || '').indexOf('town_') === 0; } catch (e) { return false; } };
  var deferOn = 0, pending = false, st = { deferred: 0, ran: 0, skipped: 0, sliced: 0, slices: 0 };

  var oRefresh = W.refreshAllAllies;
  var next = function (fn) { try { if (typeof MessageChannel === 'function') { var mc = new MessageChannel(); mc.port1.onmessage = function () { fn(); }; mc.port2.postMessage(0); return; } } catch (e) {} setTimeout(fn, 0); };
  var canSlice = function () {
    return typeof W.refreshAllyOnce === 'function' && typeof W.mercEmploymentMap === 'function' && typeof W.mercClaimLosesTo === 'function'
      && typeof W.snapshotMercPrefs === 'function' && typeof W._settleAllyExp === 'function';
  };
  var finishUi = function () {
    try { if (player && player.allies) player.allies.forEach(function (a) { if (a) a.mp = a.mmp; }); } catch (e) {}   // 照 changeMap 安全區分支：隊員 MP 補滿
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
  };
  // 分段版：內容與 js/06 refreshAllAllies 相同，只是拆開跑
  var runSliced = function () {
    var slots = ((player && player.allies) || []).map(function (a) { return a && a._slot; }).filter(function (x) { return x != null; });
    if (!slots.length) { finishUi(); return; }
    var n = 0, i = 0; st.sliced++;
    var stepAlly = function () {
      if (i < slots.length) {
        try { var r = W.refreshAllyOnce(slots[i]); if (r && r.msg) logSys(r.msg); if (r && r.kind === 'refresh') n++; } catch (e) {}
        i++; st.slices++; next(stepAlly); return;
      }
      next(stepSave);
    };
    var stepSave = function () {
      try {
        var hired = W.mercEmploymentMap();
        (player.allies || []).slice().forEach(function (a) {
          if (!a || a._slot == null) return;
          var rival = hired[String(a._slot)];
          if (!rival || !W.mercClaimLosesTo(a, rival)) return;
          W.snapshotMercPrefs(a);
          var m2 = W._settleAllyExp(a, 'dismiss');
          player.allies = player.allies.filter(function (x) { return x !== a; });
          logSys('<span class="text-amber-300">' + (a._allyName || ('存檔 ' + a._slot)) + ' 已受僱於 ' + rival.employerName + '，同一個角色不能同時受僱於兩位僱主，已自動解散。</span>' + (m2 ? ' ' + m2 : ''));
        });
      } catch (e) {}
      try { saveGame(); } catch (e) {}
      st.slices++;
      next(stepUi);
    };
    var stepUi = function () {
      try { if (typeof W.syncMercenaryEmploymentRegistry === 'function') W.syncMercenaryEmploymentRegistry(true); } catch (e) {}
      try { if (n > 0) logSys('<span class="text-sky-300">已依最新存檔更新 ' + n + ' 名隊員的資料。</span>'); } catch (e) {}
      finishUi(); st.slices++; st.ran++; running = false;
    };
    running = true;
    stepAlly();
  };
  var running = false;
  var run = function () {
    pending = false;
    if (!inTown()) { st.skipped++; return; }
    if (canSlice()) { if (!running) runSliced(); return 0; }
    var n = 0;
    try { n = oRefresh.apply(W, []); } catch (e) {}
    st.ran++;
    finishUi();
    return n;
  };
  W.refreshAllAllies = function () {
    if (!deferOn) return oRefresh.apply(this, arguments);
    if (!pending) {
      pending = true; st.deferred++;
      // 先讓這一幀畫出村莊，再在下一個空檔刷新
      var go = function () { setTimeout(run, 0); };
      try { if (typeof requestAnimationFrame === 'function' && !document.hidden) requestAnimationFrame(go); else go(); } catch (e) { go(); }
    }
    return 0;
  };
  W.refreshAllAllies.__afkReturnFast = true;

  var oCM = W.changeMap;
  W.changeMap = function (force) {
    if (force) return oCM.apply(this, arguments);
    deferOn++;
    try { return oCM.apply(this, arguments); } finally { deferOn--; }
  };
  W.changeMap.__afkReturnFast = true;

  W.__afkReturnFast = { stats: function () { return Object.assign({ pending: pending, running: running }, st); }, flush: function () { if (pending) return run(); } };
  console.log('[AFK-returnfast] 已啟用：回城先換畫面，隊員刷新延到下一個空檔');
})();

/* ==========================================================================
 * 回城目的地（Ping 11-23 11:00／11:19）：
 *   ‧目前地圖所屬地區有「自己血盟的城堡」→ 回那座城堡
 *   ‧否則回該地區的村莊（就算血盟在別的地區有城堡也一樣）
 *   ‧地區沒有村莊（副本、裂縫、攀塔、攻城區…）→ 照原本規則（有城堡回城堡，否則回上一個村莊）
 *   做法：包 returnToTown，只把它第一次 setMapSelectors 的目的地換掉；其他限制（石化、裂痕、軍王之室…）照舊。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var destOf = function () {
    try {
      var cur = mapState.current; if (!cur || /^town_/.test(cur)) return null;
      // 肯特由共用回村流程依持城與當前座標決定，保留它選好的目的地。
      if (W.GiranGates?.kentField(cur)) return null;
      var key = typeof mapRegionOf === 'function' ? mapRegionOf(cur) : null; if (!key) return null;
      var reg = (typeof MAP_REGIONS !== 'undefined' ? MAP_REGIONS : []).filter(function (r) { return r && r.key === key; })[0]; if (!reg) return null;
      if (typeof siegeVictoryActive === 'function' && siegeVictoryActive()) { var cs = victoryCityCfg().castle; if (cs && (mapRegionOf(cs) === key || reg.castleCity === victoryCityCfg().key)) return cs; }   // 這個地區有自己血盟的城堡
      // 11-27 Ping：有城堡回城堡——這個地區的城堡只要是自己血盟持有（不限主城）就回那座城堡
      try { if (typeof SIEGE_CITY !== 'undefined' && typeof ownsCastle === 'function') { for (var ck in SIEGE_CITY) { var sc = SIEGE_CITY[ck]; if (sc && sc.castle && ownsCastle(sc.key || ck) && (mapRegionOf(sc.castle) === key || reg.castleCity === (sc.key || ck))) return sc.castle; } } } catch (e2) {}
      var towns = (reg.maps || []).map(function (m) { return m && m.v; }).filter(function (v) { return typeof v === 'string' && /^town_/.test(v) && !/_castle$/.test(v) && (DB.towns[v] || DB.maps[v]); });
      var last = player && player.lastTownVisited;   // 地區有好幾個村莊：上一個待過的村莊在這個地區就回那裡，否則回地區的第一個村莊
      var town = towns.indexOf(last) >= 0 ? last : towns[0];
      return town || null;
    } catch (e) { return null; }
  };
  var oRet = W.returnToTown;
  if (typeof oRet !== 'function') return;
  W.returnToTown = function () {
    var dest = destOf();
    if (!dest || typeof W.setMapSelectors !== 'function') return oRet.apply(this, arguments);
    var oSel = W.setMapSelectors, once = true;
    W.setMapSelectors = function (v) { var a = Array.prototype.slice.call(arguments); if (once) { once = false; a[0] = dest; } return oSel.apply(this, a); };
    try { return oRet.apply(this, arguments); } finally { W.setMapSelectors = oSel; }
  };
  W.__afkReturnDest = destOf;
})();
