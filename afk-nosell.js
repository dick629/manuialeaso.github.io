/* ============================================================================
 * afk-nosell.js — 系統專屬道具不能賣（玩家 2026-11-03；外掛開關 nosell，預設開；經典模式不套用）
 *
 *   各系統給的專屬道具（聖紋、手環、密奧之卡、聖物、靈魂石、符文石、席琳遺骸、各系統的專屬材料……）
 *   一律不會被自動賣出，也不能手動販賣、全部賣出、一鍵賣出、快速廢品。
 *   判斷集中在 W.__afkUnsellable(item)，所有販賣路徑都問它：
 *     sellItem（物品視窗的「販賣／全部賣出」）、autoSellJunk（自動賣出／一鍵賣出）、_autoSellDecision（自動販賣規則）、
 *     toggleJunk（標成廢品）、_qjCanSelect（快速廢品勾選）；物品視窗裡的販賣鈕改成灰色「不能販賣」。
 *   分類（W.__afkUnsellable.list() 可以看到目前判定成專屬的物品數）：
 *     ‧欄位：聖紋（sigil）、手環（bracelet）、密奧之卡（mio）、聖物（holy）、遠征徽記（engrave）、席琳遺骸（remains）
 *     ‧id 開頭：見 PREFIX（靈魂石、失去光芒的武器、符文石、席琳結晶、夢域／地獄／滅魔／哀石／魔石／解命石、昇華支配、龍印、
 *       祝福賦予卷軸、失去光輝的碎片、次元鑰匙、意志精華、胤魂石、回夢、聖衣碎片、雅典娜祝福、特殊收藏、劇情道具、卡片自選券……）
 *     ‧其他：外掛定義（afk_ 開頭）、沒有售價（p 0）的材料或道具（etc／misc），變身卡除外
 *     ‧原本就標 noSell 的照舊不能賣
 *   不算專屬：遺物（另有遺物整理換龍鑽的賣法）、有售價的外掛裝備（反王、闇龍獵人、冒險者套裝……）、地區霸主的戰利品。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'nosell', name: '系統專屬道具不能賣', group: '遊戲介面', def: true,
    desc: '聖紋、手環、密奧之卡、聖物、靈魂石、符文石、席琳遺骸和各系統的專屬材料不會被自動賣出，也不能販賣' });
  if (typeof DB === 'undefined' || !DB.items) { console.warn('[AFK-nosell] 找不到 DB，停用'); return; }
  var on = function () { return !T || T.enabled('nosell'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function') return false; var o = W[name]; W[name] = mk(o); try { (0, eval)(name + ' = window.' + name); } catch (e) {} return true; };

  var SLOTS = { sigil: 1, bracelet: 1, mio: 1, holy: 1, engrave: 1 };
  var PREFIX = ['afk_sigil_', 'afk_brace_', 'afk_mio_', 'afk_scarab', 'afk_engrave_', 'afk_soul_', 'afk_dull_', 'afk_rune_', 'afk_runebox_',
    'rem_', 'sherine_crystal', 'afk_dream_', 'afk_hell_', 'afk_contempt_', 'afk_ts_', 'afk_dark_', 'afk_abyss_', 'afk_lament_', 'afk_miasma_',
    'afk_bone_', 'afk_void_', 'afk_fate_', 'afk_asc_', 'afk_dmark_', 'afk_dres_', 'afk_bless_', 'afk_lost_', 'afk_gt_', 'afk_will_', 'afk_yin_',
    'afk_reverie_', 'afk_cloth_', 'afk_athena_', 'afk_cs_', 'afk_q_', 'afk_aq_', 'afk_card_', 'afk_kurt_order', 'afk_kurt_guard', 'afk_star_',
    'afk_cancel_', 'afk_matgift_'];
  var cache = {};
  var classify = function (id) {
    if (cache[id] !== undefined) return cache[id];
    var d = DB.items[id], s = String(id), r = false;
    if (d) {
      if (d.relic) r = false;
      else if (d.remains || SLOTS[d.slot] || /^rem_/.test(String(d.slot || ''))) r = true;
      else if (PREFIX.some(function (x) { return s.indexOf(x) === 0; })) r = true;
      else if (/^afk_/.test(s) && !/^afk_pcard_/.test(s) && !d.card && (d.type === 'etc' || d.type === 'misc') && !(Number(d.p) > 0)) r = true;
    }
    cache[id] = r;
    return r;
  };
  var unsellable = function (it) {
    var d = it && DB.items[it.id]; if (!d) return false;
    if (d.noSell) return true;   // 原本就不能賣的
    if (!on()) return false;
    var p = P(); if (p && p.classicMode) return false;
    return classify(it.id);
  };
  unsellable.classify = classify;
  unsellable.list = function () { return Object.keys(DB.items).filter(classify); };
  W.__afkUnsellable = unsellable;
  var say = function (h) { try { logSys(h); } catch (e) {} };
  var MSG = '<span class="text-amber-300">這是系統給的專屬道具，不能販賣。</span>';
  var clearJunk = function () {
    var p = P(); if (!p || !Array.isArray(p.inv)) return 0; var n = 0;
    p.inv.forEach(function (i) { if (i && (i.junk || i._ruleJunk) && unsellable(i)) { i.junk = false; delete i.junkSince; delete i._autoSellQty; i._ruleJunk = false; n++; } });
    return n;
  };
  W.__afkUnsellable.clearJunk = clearJunk;

  wrapG('sellItem', function (o) { return function (uid) { var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }); if (it && unsellable(it)) { say(MSG); return; } return o.apply(this, arguments); }; });
  wrapG('autoSellJunk', function (o) { return function () { clearJunk(); return o.apply(this, arguments); }; });
  wrapG('applyAutoSellRules', function (o) { return function () { var r = o.apply(this, arguments); clearJunk(); return r; }; });
  wrapG('_autoSellDecision', function (o) { return function (i) { if (i && unsellable(i)) return { sell: false }; return o.apply(this, arguments); }; });
  wrapG('_qjCanSelect', function (o) { return function (d, i) { if (i && unsellable(i)) return false; return o.apply(this, arguments); }; });
  wrapG('toggleJunk', function (o) {
    return function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && !it.junk && unsellable(it)) { say(MSG); return; }
      return o.apply(this, arguments);
    };
  });
  wrapG('runQuickJunk', function (o) { return function () { var r = o.apply(this, arguments); clearJunk(); return r; }; });
  // 物品視窗：販賣鈕改成「不能販賣」
  wrapG('openModal', function (o) {
    return function (item) {
      var r = o.apply(this, arguments);
      try {
        if (item && unsellable(item)) {
          var m = document.getElementById('item-modal'), bs = m ? m.querySelectorAll('button[onclick^="sellItem("]') : [];
          for (var k = 0; k < bs.length; k++) { var b = bs[k]; if (k > 0) { b.remove(); continue; } b.disabled = true; b.removeAttribute('onclick'); b.classList.add('opacity-50', 'cursor-not-allowed', 'col-span-2'); b.textContent = '不能販賣'; }
        }
      } catch (e) {}
      return r;
    };
  });
  console.log('[AFK-nosell] 已啟用：系統專屬道具不能賣');
})();
