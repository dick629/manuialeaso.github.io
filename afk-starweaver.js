/* ============================================================================
 * afk-starweaver.js — 稱號「織星者」（玩家 2026-11-04 03:14 定案；外掛開關 starweaver，預設開；經典模式沒有）
 *
 *   下面條件「同時」全部達成時自動得到，得到後永久保留（player.afkStarWeaver = { at }）：
 *     1. 七座城都是你的（統一天下：afk-castle-guards unified）
 *     2. 冒險者公會 S 級（afk-hunter isS）
 *     3. 遠征位階「上位者」（afk-expedition rank ≥ 4）
 *     4. 至少一個地區的村長（afk-village chiefOf）
 *     5. 密奧之卡全部點亮，而且全部升到最高階（馬賽；afk-mio 每張 stage ≥ 3）
 *     6. 擁有織羽手環（afk_brace_weave_3；背包、身上、倉庫任一，afk-bracelet weaveOwned）
 *     7、8. 隱藏稱號「政治手腕」「知曉歷史」（afk-village __afkTitles.has）
 *     9. 轉生過（rebirth ≥ 1）
 *    10. 日輪聖甲蟲滿級（afk-scarab lv ≥ 100）
 *    11. 變身卡冊（神話、天上、時空；afk-card-codex）全部點亮而且全部 7 星
 *        ※ 不含變身收集冊（afk-poly-codex 的普通／銀／金）：「點亮＋星數」是卡冊的規則
 *    12. 星途遠征打通：跟守衛強化「星途意志」同一個判斷（目前世界的星門次數用完，或兩項基本能力 200；afk-guardup starDone）
 *    13. 身上裝滿 6 件至高的支配（relicEvo；afk-relicplus 同時最多只能裝 6 件，所以「全身」＝裝滿這 6 件，部位不限）
 *   任一個系統被關掉（外掛開關）時，那一條算沒達成。
 *   檢查：每 5 秒（補跑離線時不檢查），還沒得到才檢查；得到時系統訊息通知。
 *   效果：目前只有稱號（狀態列、小百科席琳分頁的條件清單）。之後的新難度會用到（window.__afkStarWeaver.has）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'starweaver', name: '稱號：織星者', group: '遊戲內容', seal: true,
    desc: '隱藏稱號' });
  var on = function () { return !T || T.enabled('starweaver'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var classic = function (p) { return !!(p && p.classicMode); };
  var tryB = function (f) { try { return !!f(); } catch (e) { return false; } };
  var EVO_N = 6;   // afk-relicplus EVO_MAX_EQUIP

  var evoCount = function (p) {
    var n = 0; Object.keys((p && p.eq) || {}).forEach(function (k) { var e = p.eq[k], d = e && DB.items[e.id]; if (d && d.relicEvo != null) n++; });
    return n;
  };
  var cardAll = function (p) {
    var A = W.AFK_CARD_ASCENSION, C = W.AFK_CARD_CODEX; if (!A || !A.catalog || !C || !C.bonusOf) return false;
    if (T && !T.enabled('card-ascension')) return false;
    var all = 0; ['mythic', 'celestial', 'spacetime'].forEach(function (t) { all += (A.catalog[t] || []).length; });
    var b = C.bonusOf(p); return all > 0 && b.lit >= all && b.full >= all;
  };
  var mioAll = function (p) {
    var M = W.__afkMio; if (!M || !M.CARDS || (T && !T.enabled('mio'))) return false;
    var top = (M.STAGE && M.STAGE.length - 1) || 3, cards = (p.afkMio && p.afkMio.cards) || {};
    return M.CARDS.length > 0 && M.CARDS.every(function (c, i) { return (Number(cards[i]) || 0) >= top; });
  };
  var starDone = function (p) {
    var G = W.__afkGuardUp; if (G && G.starDone) return G.starDone(p);
    var SR = W.__afkStarRoad; if (!SR || !SR.store || !SR.worldOf || !SR.CFG) return false;   // 守衛強化關掉時：同一套判斷自己算
    var w = SR.worldOf(p), cap = Number(SR.CFG.cap[w]) || 0;
    return (cap > 0 && (Number(SR.store(p).pts[w]) || 0) >= cap) || !!(SR.noDrop && SR.noDrop(p));
  };
  // [id, 玩家看到的條件, 判斷]；倉庫要讀存檔的那條放最後
  var CONDS = [
    ['reborn', '轉生過（一轉以上）', function (p) { return Number(p.rebirth) > 0; }],
    ['castles', '七座城都是你的（統一天下）', function (p) { var C = W.__afkCastleGuards; return !!(C && C.unified && C.unified()); }],
    ['hunter', '冒險者公會 S 級', function (p) { var H = W.__afkHunter; return !!(H && H.isS && H.isS(p)); }],
    ['exped', '遠征位階「上位者」', function (p) { return !!W.__afkExpedition && (!T || T.enabled('expedition')) && !!p.afkExped && Number(p.afkExped.rank) >= 4; }],
    ['chief', '至少一個地區的村長', function (p) { var V = W.__afkVillage; return !!(V && V.on && V.on() && V.chiefOf && V.chiefOf(p)); }],
    ['politics', '隱藏稱號「政治手腕」', function (p) { var Ti = W.__afkTitles; return !!(Ti && Ti.has && Ti.has('politics', p)); }],
    ['history', '隱藏稱號「知曉歷史」', function (p) { var Ti = W.__afkTitles; return !!(Ti && Ti.has && Ti.has('history', p)); }],
    ['mio', '密奧之卡全部點亮，而且全部升到最高階（馬賽）', mioAll],
    ['scarab', '日輪聖甲蟲升到 100 級', function (p) { var SC = W.__afkScarab; return !!SC && (!T || T.enabled('scarab')) && !!p.afkScarab && Number(p.afkScarab.lv) >= 100; }],
    ['cards', '變身卡冊（神話、天上、時空）全部點亮，而且全部 7 星', cardAll],
    ['starroad', '星途遠征打通（目前世界的星門次數用完，或兩項基本能力已達 200）', starDone],
    ['relic', '身上裝滿 ' + EVO_N + ' 件至高的支配', function (p) { return evoCount(p) >= EVO_N; }],
    ['weave', '擁有織羽手環（背包、身上或倉庫）', function (p) { var B = W.__afkBracelet; return !!(B && B.weaveOwned && p === P() && B.weaveOwned() > 0); }]
  ];
  var has = function (p) { p = p || P(); return !!(p && on() && !classic(p) && p.afkStarWeaver && p.afkStarWeaver.at); };
  var progress = function (p) {
    p = p || P(); if (!p) return [];
    return CONDS.map(function (c) { return { id: c[0], n: c[1], ok: !classic(p) && tryB(function () { return c[2](p); }) }; });
  };
  var allMet = function (p) { if (!p || classic(p)) return false; for (var i = 0; i < CONDS.length; i++) if (!tryB(function () { return CONDS[i][2](p); })) return false; return true; };
  var check = function (quiet) {
    var p = P(); if (!p || !on() || classic(p) || has(p)) return false;
    if (!allMet(p)) return false;
    p.afkStarWeaver = { at: Date.now() };
    if (!quiet) try { logSys('<span class="font-bold" style="color:#c4b5fd;">✦ 你得到了稱號「織星者」。</span><span class="afk-lore">「七座城、每一處村落、每一顆星都記得你的名字——你把它們織成了同一片夜空。」</span>'); } catch (e) {}
    try { saveGame(); } catch (e) {}
    return true;
  };
  var last = 0;
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try { if (!S().ff) { var now = Date.now(); if (now - last >= 5000) { last = now; check(); } } } catch (e) {}
      return r;
    };
  }
  W.__afkStarWeaver = { CONDS: CONDS, EVO_N: EVO_N, has: has, progress: progress, allMet: allMet, check: check, evoCount: evoCount, on: on };
  console.log('[AFK-starweaver] 已啟用：稱號「織星者」');
})();
