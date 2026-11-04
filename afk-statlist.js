/* ============================================================================
 * afk-statlist.js — 「能力」分頁條列式：拿掉經典背景圖，改成放大好點的卡片版面
 *
 * 上游的「能力」分頁是一張 400×825 的經典資訊欄底圖(assets/ui/能力.png),
 * 六大能力/詳細能力/狀態全部用絕對定位貼在圖上,字級跟 ± 按鈕都跟著圖縮(2.x cqw),
 * 手機上又小又難點。本外掛比照背包條列式的思路,把同一份 DOM 重新排版:
 *   ・六大能力:2 欄卡片,能力名稱(原本印在背景圖裡)用 CSS ::before 補回來,
 *     ± 按鈕放大到好按的尺寸。
 *   ・詳細能力:左右兩張卡片(近戰/遠程 | 魔法/抗性),字級拉到 14px。
 *   ・狀態(增益)與重置配點列改為一般卡片,不再釘在圖的固定位置。
 *
 * 作法:以 CSS 為主——給 #tab-stats 加一個 class,整套規則都掛在它底下;
 *   DOM 結構、id(dt-*)、核心的 updateUI/配點流程完全不動。
 *   唯一的 JS 是包 updateUI 後幫「按下去不會有反應的 ± 按鈕」加一個灰化 class 與說明(不攔點擊),
 *   並在每個能力值上掛「基本值＋其他加成」的說明(title)。
 *   關閉外掛(或本檔沒載到)= class 不加,原版圖面原封不動。
 *   afk-statpts 的「點數來源」區塊插在 shell 後面,不受影響。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-statlist.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'statlist', name: '能力面板條列式', group: '遊戲介面', def: true,
      desc: '「能力」分頁改成大字卡片，數字看得比較清楚'
    });
    if (!AFK_TOGGLES.enabled('statlist')) return;
  }

  var CARD = 'background:#0f172a;border:1px solid #334155;border-radius:8px;';
  var css = [
    '#tab-stats.afk-sl{align-items:stretch !important;}',
    '#tab-stats.afk-sl .ability-window-shell{background:none;aspect-ratio:auto;height:auto;max-width:560px;width:100%;margin:0 auto;overflow:visible;container-type:normal;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 6px;padding:8px 8px 14px;box-sizing:border-box;}',

    /* ── 六大能力(2 欄 × 3 列;名稱原本印在背景圖裡,用 ::before 補回) ──
       ± 欄用 auto:按鈕平常是 .hidden,固定寬會讓窄面板(桌機分頁區約 300px)爆版
       min-height 撐到「有按鈕」那一版的高度(按鈕 30 ＋ 上下 padding 12 ＋ 邊框 2),
       否則卡片會隨 ±(.hidden 切換)忽高忽低 */
    '#tab-stats.afk-sl .ability-primary-control{position:static;width:auto;height:auto;min-height:44px;box-sizing:border-box;min-width:0;grid-template-columns:auto auto minmax(0,1fr) auto;gap:4px;' + CARD + 'padding:6px 8px;font:600 16px/1 Arial,"Microsoft JhengHei",sans-serif;text-shadow:none;white-space:nowrap;}',
    '#tab-stats.afk-sl .ability-primary-control::before{grid-column:1;grid-row:1;font:700 14px/1 "Microsoft JhengHei",Arial,sans-serif;white-space:nowrap;}',
    '#tab-stats.afk-sl .ability-primary-str::before{content:"力量"}',
    '#tab-stats.afk-sl .ability-primary-dex::before{content:"敏捷"}',
    '#tab-stats.afk-sl .ability-primary-con::before{content:"體質"}',
    '#tab-stats.afk-sl .ability-primary-int::before{content:"智力"}',
    '#tab-stats.afk-sl .ability-primary-wis::before{content:"精神"}',
    '#tab-stats.afk-sl .ability-primary-cha::before{content:"魅力"}',
    '#tab-stats.afk-sl .ability-primary-control > span{grid-column:3;}',
    '#tab-stats.afk-sl .ability-primary-control .alloc-minus{grid-column:2;grid-row:1;}',
    '#tab-stats.afk-sl .ability-primary-control .alloc-plus{grid-column:4;grid-row:1;}',
    '#tab-stats.afk-sl .ability-primary-control button{width:32px;height:30px;font:700 17px/1 Arial,sans-serif;border-radius:6px;}',
    /* 按不動的 ±(＋滿上限、−退到底):核心 adjAlloc 會安靜吞掉,這裡至少讓玩家看得出來 */
    '#tab-stats.afk-sl .ability-primary-control button.afk-sl-cap{filter:grayscale(1);opacity:.4;cursor:not-allowed;}',
    '#tab-stats.afk-sl .ability-primary-control button.afk-sl-cap:hover{border-color:#71644d;filter:grayscale(1);}',
    '#tab-stats.afk-sl .ability-primary-str{grid-column:1;grid-row:1}',
    '#tab-stats.afk-sl .ability-primary-dex{grid-column:1;grid-row:2}',
    '#tab-stats.afk-sl .ability-primary-con{grid-column:1;grid-row:3}',
    '#tab-stats.afk-sl .ability-primary-int{grid-column:2;grid-row:1}',
    '#tab-stats.afk-sl .ability-primary-wis{grid-column:2;grid-row:2}',
    '#tab-stats.afk-sl .ability-primary-cha{grid-column:2;grid-row:3}',

    /* ── 詳細能力(兩張全寬卡片直列;面板本身不寬,硬排兩欄會擠爆) ── */
    '#tab-stats.afk-sl .ability-detail-column{position:static;left:auto;top:auto;width:auto;height:auto;display:block;' + CARD + 'padding:8px 12px;font:500 14px/1.4 "Microsoft JhengHei",Arial,sans-serif;text-shadow:none;}',
    '#tab-stats.afk-sl .ability-detail-left{grid-column:1/-1;grid-row:4}',
    '#tab-stats.afk-sl .ability-detail-right{grid-column:1/-1;grid-row:5}',
    '#tab-stats.afk-sl .ability-detail-column > div{grid-template-columns:1fr auto;min-height:auto;padding:3px 0;}',
    '#tab-stats.afk-sl .ability-detail-column span{padding-left:0;overflow:visible;}',
    '#tab-stats.afk-sl .ability-detail-column strong{height:auto;padding-right:0;font:600 14px/1.2 Arial,sans-serif;}',
    '#tab-stats.afk-sl .ability-detail-column .ability-magic-crit-dmg span{top:0;}',
    '#tab-stats.afk-sl .ability-detail-column > .ability-detail-spacer{height:10px;}',

    /* ── 狀態(增益)卡片 ── */
    '#tab-stats.afk-sl .ability-buffs{position:static;left:auto;top:auto;width:auto;height:auto;grid-column:1/-1;' + CARD + 'padding:8px 12px;overflow:visible;font:600 13.5px/1.6 "Microsoft JhengHei",Arial,sans-serif;text-shadow:none;}',
    '#tab-stats.afk-sl .ability-buffs:empty{display:none;}',

    /* ── 重置配點(原版是壓在圖上的 overlay;:not(.hidden) 免得把收起狀態撐開) ──
       配點中(is-respec)六大能力改單欄直排:面板窄,2 欄塞不下「− 值 ＋」;配點列固定排最上面 */
    '#tab-stats.afk-sl.is-respec .ability-window-shell{grid-template-columns:1fr;}',
    '#tab-stats.afk-sl.is-respec .ability-primary-control{grid-column:1 !important;grid-row:auto !important;}',
    '#tab-stats.afk-sl.is-respec .ability-detail-left,#tab-stats.afk-sl.is-respec .ability-detail-right{grid-column:1;grid-row:auto;}',
    '#tab-stats.afk-sl .ability-respec-overlay{grid-column:1/-1;}',
    '#tab-stats.afk-sl .ability-respec-overlay:not(.hidden){position:static;inset:auto;pointer-events:auto;grid-row:1;display:flex;flex-direction:column;gap:8px;background:#1b1610;border:1px solid #8b7446;border-radius:8px;padding:10px 12px;}',
    '#tab-stats.afk-sl .ability-respec-points{position:static;left:auto;top:auto;width:auto;height:auto;justify-content:flex-start;font:700 18px/1 Arial,sans-serif;}',
    '#tab-stats.afk-sl .ability-respec-points::before{content:"剩餘點數：";font:600 14px/1 "Microsoft JhengHei",Arial,sans-serif;color:#cfc7b7;margin-right:4px;}',
    '#tab-stats.afk-sl .ability-respec-actions{position:static;left:auto;top:auto;width:auto;min-height:0;padding:0;border:none;background:none;box-shadow:none;font:500 13.5px/1.5 "Microsoft JhengHei",Arial,sans-serif;gap:8px;}',
    '#tab-stats.afk-sl .ability-respec-actions > div{gap:12px;}',
    '#tab-stats.afk-sl .ability-respec-actions button{min-width:96px;padding:9px 16px;font:700 15px/1 "Microsoft JhengHei",Arial,sans-serif;border-radius:6px;}',

    /* ── 極窄螢幕(<340px):六大能力也改單欄直排 ── */
    '@media (max-width:339px){',
    '#tab-stats.afk-sl .ability-window-shell{grid-template-columns:1fr;}',
    '#tab-stats.afk-sl .ability-primary-str,#tab-stats.afk-sl .ability-primary-dex,#tab-stats.afk-sl .ability-primary-con,#tab-stats.afk-sl .ability-primary-int,#tab-stats.afk-sl .ability-primary-wis,#tab-stats.afk-sl .ability-primary-cha{grid-column:1;grid-row:auto;}',
    '#tab-stats.afk-sl .ability-detail-left,#tab-stats.afk-sl .ability-detail-right{grid-column:1;grid-row:auto;}',
    '}'
  ].join('\n');

  /* ── 按不動的 ± 灰化＋說明 ──
     核心 adjAlloc/adjBonusStat 的上限是「自然值(base+配點+萬能藥,不含裝備/buff) < __afkAllocCap()」
     (一般 60、轉生 200、經典 35;回憶蠟燭重配也一樣,補丁 patchRespecCap),滿了就什麼都不做、也不給訊息。
     這裡補視覺＋說明(title,手機長按由 afk-touchtip 顯示;按下去也在系統訊息說一次),不攔點擊。
     ⚠️ 上限不可寫死 60:轉生角色自然值 60～199 還能配,寫死會把按得動的＋灰掉(玩家回報:智力＋灰掉不能點)。
     ＋:一般狀態比 naturalStat;蠟燭重置中核心比的是「Lv1 基礎＋草稿」,而那個值就是 updateUI
        剛寫進 #dt-<s> 的數字,直接讀(textContent 不觸發 layout)最不會跟核心算法走鐘。
     −:只有重置中才出現,核心條件是「草稿 > 0」→ 顯示值退到職業起始值(createBase)就按不動。
     能力值那格的 title:基本值(出生＋配點＋萬能藥)＋其他加成(裝備、套裝、遺物、buff、血盟、勝者的榮耀…)＝面板數字;
        超過能力值上限(一般 100、轉生 200)時另外說超過的點數算不算。 */
  var STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var NAME = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
  // 轉生後超過上限的部分仍算進這些公式(afk-rebirth 的 useRaw);其他能力超過上限沒有效果
  var OVER_USE = { str: '近距離傷害、命中、爆擊', dex: '遠距離傷害、命中、爆擊', int: '魔法傷害、命中、爆擊、額外魔法點數' };
  var btns = null;      // s -> { ctl, plus, minus }(靜態 DOM,查一次重用)
  var lastSig = null;

  function n0(o, s) { return (o && Number(o[s])) || 0; }
  function naturalOf(s) {
    if (typeof naturalStat === 'function') return naturalStat(s);
    return n0(player.base, s) + n0(player.alloc, s) + n0(player.panacea, s);
  }
  function allocCap() { try { if (typeof window.__afkAllocCap === 'function') return window.__afkAllocCap(); } catch (e) {} return 60; }
  function attrCap() { try { if (typeof window.__afkAttrCap === 'function') return window.__afkAttrCap(); } catch (e) {} return 100; }
  function totalOf(s) {   // 面板上的總值(含超過上限、被夾掉的部分);沒有轉生外掛就是 d[s]
    try { if (typeof window.__afkStatTotal === 'function') return window.__afkStatTotal(s); } catch (e) {}
    return n0(player.d, s);
  }
  function capText(s, cap, respecOn) { return NAME[s] + (respecOn ? '已達上限 ' : '的基本值（出生＋配點＋萬能藥）已達上限 ') + cap; }
  function valueText(s, nat, tot, aCap) {
    var add = tot - nat, t = '基本值 ' + nat + (add >= 0 ? '＋其他加成 ' + add : '－' + (-add)) + '＝' + tot;
    if (tot > aCap) {
      // 夾上限之後才加的(套裝、席琳夢域的魅力)照樣有效 → 沒效果的只有被夾掉的那段
      var over = tot - aCap, lost = Math.min(over, tot - Math.max(aCap, n0(player.d, s))), reb = !!(player.rebirth > 0);
      t += '，能力值上限 ' + aCap + '：超過的 ' + over + ' 點' + (reb && OVER_USE[s] ? '仍算進' + OVER_USE[s]
        : (lost < over ? '中 ' + lost + ' 點' : '') + '沒有效果');
    }
    if (s === 'int') { var nx = intNext(tot, aCap); if (nx) t += '。' + nx; }
    return t;
  }
  // 智力的魔法傷害／額外魔法點數是階梯表(js/01 getIntMagicDmg/getIntExtraMp):不是每 1 點都加,
  //   轉生後 100 以上照 80→100 那段延伸＝每 2 點 +1(afk-rebirth)。玩家回報「智力 +1 魔法傷害沒增加」→ 說還差幾點。
  //   查表用「戰鬥實際拿去查的值」:沒轉生夾在 100、轉生夾在 200,超過 200 的部分轉生後照算(夾上限前的總值)。
  var INT_FX = [['getIntMagicDmg', '魔法傷害'], ['getIntExtraMp', '額外魔法點數']];
  function intNext(tot, aCap) {
    var reb = !!(player.rebirth > 0), cur = reb ? tot : Math.min(tot, aCap), parts = [], same = null;
    INT_FX.forEach(function (f) {
      var fn = window[f[0]]; if (typeof fn !== 'function') return;
      var v0 = fn(cur);
      for (var n = 1; n <= 30; n++) {
        if (!reb && cur + n > aCap) return;   // 沒轉生：超過上限不會再加
        var dv = fn(cur + n) - v0;
        if (dv > 0) { parts.push([n, f[1] + ' +' + dv]); return; }
      }
    });
    if (!parts.length) return '';
    if (parts.length === 2 && parts[0][0] === parts[1][0]) return '再 ' + parts[0][0] + ' 點智力：' + parts[0][1] + '、' + parts[1][1];
    return parts.map(function (x) { return '再 ' + x[0] + ' 點智力：' + x[1]; }).join('；');
  }

  // updateUI 戰鬥中每秒被叫上百次 → 用簽章短路,值沒變就零 DOM 返回
  function syncCaps(tab) {
    if (typeof player === 'undefined' || !player || !player.base || !player.d) return;
    var respecOn = tab.classList.contains('is-respec');
    // 重置中的下限＝該職業起始值;讀不到 createBase 就不灰化 −(維持原樣,不亂猜)
    var floors = null;
    if (respecOn && typeof createBase !== 'undefined' && player.cls) floors = createBase[player.cls] || null;
    var cap = allocCap(), aCap = attrCap();
    var vals = [], nats = [], tots = [], sig = (respecOn ? 'r' : 'n') + (floors ? player.cls : '') + '|' + cap + '|' + aCap + '|' + (player.rebirth > 0 ? 1 : 0) + (player.classicMode ? 'c' : '');
    for (var i = 0; i < STATS.length; i++) {
      var k = STATS[i], el = respecOn ? document.getElementById('dt-' + k) : null;
      var nat = naturalOf(k), tot = respecOn ? 0 : totalOf(k);
      var v = respecOn ? (parseInt(el && el.textContent, 10) || 0) : nat;
      vals.push(v); nats.push(nat); tots.push(tot); sig += '|' + v + ',' + tot;
    }
    if (sig === lastSig) return;
    lastSig = sig;
    if (!btns) {
      btns = {};
      STATS.forEach(function (s) {
        var ctl = tab.querySelector('.ability-primary-' + s);
        btns[s] = { ctl: ctl, plus: ctl && ctl.querySelector('.alloc-plus'), minus: ctl && ctl.querySelector('.alloc-minus') };
      });
    }
    STATS.forEach(function (s, i) {
      var b = btns[s], capped = vals[i] >= cap;
      if (b.plus) {
        b.plus.classList.toggle('afk-sl-cap', capped);
        var pt = capped ? capText(s, cap, respecOn) : '';
        if (pt) b.plus.title = pt; else b.plus.removeAttribute('title');
      }
      if (b.minus) b.minus.classList.toggle('afk-sl-cap', !!floors && vals[i] <= (floors[s] || 0));
      if (b.ctl) {
        var vt = (respecOn || player.classicMode) ? '' : valueText(s, nats[i], tots[i], aCap);   // 經典模式能力值只有角色本身（其他加成全封印），不用說明
        if (vt) b.ctl.title = vt; else b.ctl.removeAttribute('title');
      }
    });
  }

  // 按到已滿的＋:核心什麼都不做,這裡在系統訊息說一次為什麼(不攔點擊,核心照樣自己擋)
  function onCapClick(e) {
    var b = e.target && e.target.closest && e.target.closest('.alloc-plus.afk-sl-cap');
    if (!b || !b.title || typeof logSys !== 'function') return;
    try { logSys('<span class="text-amber-300">' + b.title + '。</span>'); } catch (err) {}
  }

  function hookUpdateUI(tab) {
    if (typeof window.updateUI !== 'function') return false;
    if (window.updateUI.__afkStatlist) return true;
    var orig = window.updateUI;
    window.updateUI = function () {
      var r = orig.apply(this, arguments);
      if (typeof catchupActive === 'function' && catchupActive()) return r;   // 離線補跑期間畫面沒人看
      try { syncCaps(tab); } catch (e) {}
      return r;
    };
    window.updateUI.__afkStatlist = true;
    return true;
  }

  function init() {
    var tab = document.getElementById('tab-stats');
    if (!tab || !tab.querySelector('.ability-window-shell')) {
      console.warn('[AFK-statlist] 找不到能力分頁的 DOM(#tab-stats/.ability-window-shell),條列式停用。');
      return;
    }
    var st = document.createElement('style');
    st.id = 'afk-statlist-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    tab.classList.add('afk-sl');
    tab.addEventListener('click', onCapClick, true);

    var tries = 0;
    (function tryHook() {
      if (hookUpdateUI(tab)) { try { syncCaps(tab); } catch (e) {} return; }
      if (++tries < 40) setTimeout(tryHook, 250);
      else console.warn('[AFK-statlist] 找不到 updateUI,配點上限灰化停用(版面照常)。');
    })();

    console.log('[AFK-statlist] hooks OK — 能力分頁已改為條列式版面。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
