/* ============================================================================
 * afk-killlog.js — 擊殺掉落合併成一行（只改顯示）
 *
 * 問題：
 *   核心 gainItem（js/08）在擊殺掉落期間（killMob 設好 _lootMobInfo）每拿到一件物品就寫一行系統日誌：
 *     「<怪名> 給你 <物品名> 。」
 *   打一隻掉很多東西的怪（頭目、席琳夢域鏡、席琳世界×N 倍率…）一口氣洗掉十幾行，
 *   系統日誌只留 50 行，其他訊息（升級、卡片登錄、罕見掉落…）馬上被擠掉。
 *
 * 做法（不改核心、不碰掉落機率／背包／自動販賣，只改「怎麼印」）：
 *   ‧包 killMob（本檔排在外掛層最後面＝最外層，其他外掛在擊殺後補發的掉落也包得到）：
 *     結算期間開一個「本次擊殺」暫存框。
 *   ‧包 logSys：只有在暫存框開著時，才把符合核心掉落格式的那一行攔下
 *     （<span class="sys-item-gain"><span class="怪色">怪名</span> 給你 物品HTML 。</span>），
 *     其餘訊息（經驗、升級、卡片登錄、罕見掉落、幼龍蛋、席琳結晶…）一律照原樣立刻印出。
 *   ‧killMob 結束時把攔下的掉落合併成一行：
 *     「擊敗 <怪名>：物品A ×2、物品B、物品C ×3」
 *     物品沿用核心產生的 HTML（遺物／傳說亮點、祝福／遠古／屬性等顏色都保留），
 *     完全相同的物品 HTML 才合併成 ×N；外層一樣包 sys-item-gain，配色規則跟原本一致，長了會自然換行。
 *     稀有未讀點：這一行帶最高稀有度（遺物 > 傳說），跟原本逐行時一樣會亮。
 *   ‧補跑（state.ff）期間核心本來就不寫日誌，交給 afk-droplog 原樣暫存；本檔此時完全不插手，
 *     等 droplog 在補跑結束時逐行補印（行首 ⏩）的那一段，再把同一隻怪的補印掉落併成一行
 *     「⏩ 擊敗 <怪名>：…」。長補跑的「補跑期間擊敗 N 隻…掉落」彙整與核心「掛機補跑完成」照常印出。
 *
 * 相容：afk-perf 的批次寫入、afk-toast、afk-dropcount（走 auditTrackGain，不看日誌）都不受影響。
 * 關掉開關（遊戲介面 → 擊殺掉落合併成一行）＝立刻恢復逐行顯示。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T) T.register({
    id: 'killlog', name: '擊殺掉落合併成一行', group: '遊戲介面', def: true,
    desc: '同一隻怪掉的東西在系統日誌合併成一行「擊敗 怪名：物品A ×2、物品B」，不再一件一行洗版；只改顯示。'
  });
  if (T && !T.enabled('killlog')) return;
  if (typeof window.killMob !== 'function' || typeof window.logSys !== 'function' || typeof window.logCombat !== 'function') {
    try { console.warn('[AFK-killlog] 找不到核心函式，未啟用'); } catch (e) {}
    return;
  }
  if (window.killMob.__afkKillLog) return;   // 冪等：重複載入不疊包

  var on = function () { return !T || T.enabled('killlog'); };
  var inFF = function () { return typeof state !== 'undefined' && state && state.ff; };

  // 核心 js/08 gainItem 的擊殺掉落行（逐字對照）：
  //   `<span class="sys-item-gain"><span class="${_mc}">${_lootMobInfo.n}</span> 給你 ${_nameHtml} 。</span>`
  var DROP_RE = /^<span class="sys-item-gain"><span class="([^"]*)">([^<]*)<\/span> 給你 ([\s\S]*) 。<\/span>$/;
  // afk-droplog 補印時加在行首的記號（逐字對照）
  var MARK = '<span class="text-slate-400" title="卡頓或背景補跑期間發生">⏩</span> ';
  var RANK = { relic: 2, legend: 1 };

  var parse = function (msg) {
    if (typeof msg !== 'string') return null;
    var m = DROP_RE.exec(msg);
    return m ? { cls: m[1], n: m[2], item: m[3] } : null;
  };

  // 首領判定：擊殺當下的掉落來源（核心 _lootMobInfo.boss）優先；補印時沒有上下文 → 依怪名查 DB.mobs，名字有「首領」也算
  var bossByName = null;
  var isBoss = function (n) {
    try { if (typeof _lootMobInfo !== 'undefined' && _lootMobInfo && _lootMobInfo.n === n) return !!_lootMobInfo.boss || /首領/.test(n); } catch (e) {}
    if (!bossByName) { bossByName = {}; try { for (var k in DB.mobs) { var m = DB.mobs[k]; if (m && m.n && m.boss) bossByName[m.n] = 1; } } catch (e) {} }
    return !!bossByName[n] || /首領/.test(n);
  };

  // 一個暫存框＝一隻怪的掉落；groups 依怪名分（同一次結算理論上只有一個怪名，保險起見分開）
  var newBox = function () { return { groups: [], byKey: {} }; };
  var addTo = function (box, d, rare) {
    var key = d.cls + '|' + d.n;
    var g = box.byKey[key];
    if (!g) { g = box.byKey[key] = { cls: d.cls, n: d.n, boss: isBoss(d.n), items: [], byItem: {}, rare: '' }; box.groups.push(g); }
    var it = g.byItem[d.item];
    if (!it) { it = g.byItem[d.item] = { html: d.item, k: 0 }; g.items.push(it); }
    it.k++;
    if ((RANK[rare] || 0) > (RANK[g.rare] || 0)) g.rare = rare;
  };
  try { if (!document.getElementById('afk-killlog-css')) { var kcss = document.createElement('style'); kcss.id = 'afk-killlog-css'; kcss.textContent = '.sys-item-gain .afk-kl-mob{color:#7dd3fc!important;font-weight:700}.sys-item-gain .afk-kl-boss{color:#fbbf24!important}.sys-item-gain .afk-kl-kill{color:#f87171!important;font-weight:700}'; (document.head || document.documentElement).appendChild(kcss); } } catch (e) {}
  var emit = function (box, prefix) {
    var out = 0;
    for (var i = 0; i < box.groups.length; i++) {
      var g = box.groups[i];
      if (!g.items.length) continue;
      var list = g.items.map(function (it) { return it.html + (it.k > 1 ? ' ×' + it.k : ''); }).join('、');
      // 玩家 2026-10-27：「擊敗」紅色；怪名一般怪淺藍、首領（頭目）金色，跟物品分得開
      var html = (prefix || '') + '<span class="sys-item-gain"><span class="afk-kl-kill" style="color:#f87171!important;font-weight:700">擊敗</span> <span class="afk-kl-mob' + (g.boss ? ' afk-kl-boss' : '') + '" style="color:' + (g.boss ? '#fbbf24' : '#7dd3fc') + '!important;font-weight:700">' + g.n + '</span>：' + list + '</span>';
      try { if (g.rare) window.logSys(html, g.rare); else window.logSys(html); out++; } catch (e) {}
    }
    return out;
  };

  var stack = [];          // 即時擊殺的暫存框（巢狀擊殺各自一框）
  var replayBox = null;    // droplog 補印期間的暫存框
  var inFinish = 0;        // 是否在 _ffFinishCatchup（droplog 補印）裡
  var st = { kills: 0, merged: 0, lines: 0, replayMerged: 0 };

  var flushReplay = function () {
    if (!replayBox) return;
    var b = replayBox; replayBox = null;
    st.replayMerged += emit(b, MARK);
  };

  // ── logSys：只在擊殺結算中／補印中攔掉落行 ──
  var oSys = window.logSys;
  var wSys = function (msg, rare) {
    if (!inFF()) {
      if (stack.length) {
        var d = parse(msg);
        if (d) { addTo(stack[stack.length - 1], d, rare); st.lines++; return; }
      } else if (inFinish) {
        if (typeof msg === 'string' && msg.indexOf(MARK) === 0) {
          var d2 = parse(msg.slice(MARK.length));
          if (d2) {
            // 換了一隻怪（名字不同）→ 先把上一隻印出來
            if (replayBox && !replayBox.byKey[d2.cls + '|' + d2.n]) flushReplay();
            if (!replayBox) replayBox = newBox();
            addTo(replayBox, d2, rare);
            return;
          }
          // 同一隻怪補印的其他訊息（卡片登錄等）：照印、不切斷
        } else {
          flushReplay();   // 非補印訊息（droplog 標頭、核心「掛機補跑完成」、彙整…）：先把暫存的印出來，保持前後順序
        }
      }
    }
    return oSys.apply(this, arguments);
  };
  wSys.__afkKillLog = true;
  window.logSys = wSys;

  // ── logCombat：補印期間，戰鬥日誌的「擊敗了…」代表下一隻開始 → 結束上一隻 ──
  var oCom = window.logCombat;
  var wCom = function () {
    if (inFinish && replayBox && !inFF()) flushReplay();
    return oCom.apply(this, arguments);
  };
  wCom.__afkKillLog = true;
  window.logCombat = wCom;

  // ── killMob：即時（非補跑）結算期間開暫存框，結束合併印出 ──
  var oKill = window.killMob;
  var wKill = function (idx) {
    if (inFF() || !on()) return oKill.apply(this, arguments);
    var box = newBox();
    stack.push(box);
    try { return oKill.apply(this, arguments); }
    finally {
      var i = stack.lastIndexOf(box);
      if (i >= 0) stack.splice(i, 1);
      st.kills++;
      st.merged += emit(box, '');
    }
  };
  wKill.__afkKillLog = true;
  window.killMob = wKill;

  // ── 補跑收尾：afk-droplog 在這裡逐行補印 → 本檔把同一隻怪的掉落併行 ──
  if (typeof window._ffFinishCatchup === 'function') {
    var oFinish = window._ffFinishCatchup;
    window._ffFinishCatchup = function () {
      if (!on()) return oFinish.apply(this, arguments);
      inFinish++;
      try { return oFinish.apply(this, arguments); }
      finally { inFinish--; if (!inFinish) flushReplay(); }
    };
  }

  window.__afkKillLog = { stats: function () { return Object.assign({ open: stack.length }, st); }, isBoss: isBoss };
  console.log('[AFK-killlog] 已啟用：同一隻怪的掉落合併成一行');
})();
