/* ============================================================================
 * afk-npctext.js — NPC／物品說明文字校正（只改顯示用的 d，不動任何數值與功能）
 *
 * 核心 js/00-data.js 不能直接改，這裡在載入時覆寫幾段寫得不清楚或跟實際規則不符的說明：
 *   ‧芬／喬爾／萊恩「提供物品製作服務」→ 列出實際能做的成品（取自 CRAFT_RECIPES[npc.id]）
 *   ‧拉達爾：製作畫面跟莫莉共用 CRAFT_RECIPES.npc_moli（js/14 renderMoliCraft），列出那份成品
 *   ‧倉庫 NPC「四個存檔角色共用」→ 倉庫依模式分桶（js/12 whKey／modeSuffix：一般、經典各一個），所有存檔位共用
 *   ‧魔法娃娃商人：卡片合成實際是「同階已開圖鑑卡任意湊 10 張」可跨怪（js/15 _cardSynthGreedy），另有銀／金卡兌換與娃娃合成
 *   ‧希米哲：SHIMIZHE_REWARDS 五件藍海賊裝備任選一件（js/12 shimizheEx）
 *   ‧賦予武器／盔甲／飾品祝福卷軸：沒有任何用途（noUse、無配方／任務使用、p:0）
 * 不是開關；經典模式也套用（經典只記 NPC id，不還原說明文字）。
 * 載入順序：放在 js/00-data.js、js/14-craft-pandora.js 之後即可；載入當下跑一次，window load 時再跑一次，
 *   讓之後才加進 DB.towns 的倉庫 NPC 也套到。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var itemN = function (id) { try { var d = DB.items[id]; return d && d.n ? d.n : null; } catch (e) { return null; } };
  var recipeNames = function (key) {
    try {
      var rs = (typeof CRAFT_RECIPES !== 'undefined' && CRAFT_RECIPES[key]) || [], out = [];
      rs.forEach(function (r) { var n = r && itemN(r.result); if (n && out.indexOf(n) < 0) out.push(n); });
      return out;
    } catch (e) { return []; }
  };
  var CRAFT = {
    npc_finn: ['芬在工坊裡敲打不停，', 'npc_finn'],
    npc_joel: ['喬爾是個沉默而可靠的老匠人，', 'npc_joel'],
    npc_ryan: ['萊恩在爐火旁默默打磨成品，', 'npc_ryan'],
    npc_ladal: ['拉達爾揉皮裁料樣樣精通，', 'npc_moli']
  };
  var WH_TAIL = '所有存檔角色共用（經典模式的角色另外共用一個倉庫）。';
  var apply = function () {
    if (typeof DB === 'undefined' || !DB.towns) return;
    Object.keys(DB.towns).forEach(function (t) {
      ((DB.towns[t] && DB.towns[t].npcs) || []).forEach(function (npc) {
        if (!npc || !npc.id) return;
        var c = CRAFT[npc.id];
        if (c) {
          var names = recipeNames(c[1]);
          if (names.length) npc.d = c[0] + '能用材料製作：' + names.join('、') + '。';
          return;
        }
        if (npc.type === 'warehouse' && typeof npc.d === 'string') {
          npc.d = npc.d.replace(/(四個|所有)存檔角色共用。?$/, WH_TAIL);
          return;
        }
        if (npc.id === 'npc_doll_merchant') {
          npc.d = '蒐羅怪物卡片的魔法娃娃商人。卡片合成：已開通圖鑑的同階卡片（普卡或銀卡）任意湊滿 10 張，就換 1 張高一階的卡片——不同怪物的卡可以混著湊，換出來的是你持有最多張的那隻怪物（上鎖的卡不會被拿去用）。'
            + '圖鑑已開到金階的怪物，多出來的銀卡 1 張換 1 個魔法娃娃的袋子、金卡 1 張換 1 個高級魔法娃娃的盒子。這裡也能合成魔法娃娃。';
          return;
        }
        if (npc.id === 'npc_shimizhe') {
          var rw = []; try { rw = (typeof SHIMIZHE_REWARDS !== 'undefined' ? SHIMIZHE_REWARDS : []).map(itemN).filter(Boolean); } catch (e) {}
          if (rw.length) npc.d = '希米哲在岸邊久候，盼著尋回亡子的遺物。帶來 兒子的信、兒子的遺骸、兒子的肖像畫 各一，可從 ' + rw.join('、') + ' 中任選一件兌換。';
        }
      });
    });
    ['new_item_bless_wpn', 'new_item_bless_arm', 'new_item_bless_acc'].forEach(function (id) {
      try { if (DB.items && DB.items[id]) DB.items[id].d = '很久以前的祝福卷軸，現在已經沒有任何用途。'; } catch (e) {}
    });
  };
  apply();
  try { W.addEventListener('load', apply); } catch (e) {}
})();
