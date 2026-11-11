/* afk-reloadguard.js — 同一個角色讀回自己的舊存檔（Ping 11-11 21:37 定案：1 選 C、2 次數單純記錄、3 只限同一個角色）
 *   ‧讀回的規則在 merged/save-gate.js（reloadWhy）與 merged/integrity-core.js（plan kind 'reload'）。
 *   ‧這裡只做帳本：每個角色「存進倉庫的次數」與「讀回舊存檔的次數」。
 *     存進倉庫（物品或金幣變多）時，角色身上的 afkWhPut +1，帳本也記一樣的數字；
 *     讀回時如果舊存檔的 afkWhPut 比帳本小＝那份存檔之後有存過倉庫 → 不准讀回（防倉庫裡的東西變成兩份）。
 *   ‧帳本只記在這個瀏覽器（localStorage lineage_reload_ledger_v1）；完整資料備份還原時會跟著一起回到備份的樣子。
 *   ‧不顯示給玩家（隱藏規則只寫 formulas）。
 */
(function () {
  'use strict';
  var W = window, KEY = 'lineage_reload_ledger_v1';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var idOf = function (p) { try { var IC = W.LineageIntegrityCore; if (IC) { var q = Object.assign({}, p); q.enSeed = IC.seed(p); return IC.identity(q); } } catch (e) {} return String(p && (p.enSeed || ((p.name || '') + '|' + p.cls)) || ''); };
  var load = function () { try { var d = JSON.parse(localStorage.getItem(KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } };
  var save = function (d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  var rec = function (d, p) { var id = idOf(p); var r = d[id]; if (!r || typeof r !== 'object') r = d[id] = { wh: 0, n: 0 }; return r; };
  var api = W.__afkReloadLedger = {
    KEY: KEY,
    wh: function (p) { return Number(rec(load(), p).wh) || 0; },
    count: function (p) { return Number(rec(load(), p).n) || 0; },
    bump: function (p) { var d = load(), r = rec(d, p); r.n = (Number(r.n) || 0) + 1; r.at = Date.now(); save(d); return r.n; },
    noteDeposit: function (p) { p = p || P(); if (!p) return; p.afkWhPut = (Number(p.afkWhPut) || 0) + 1; var d = load(), r = rec(d, p); r.wh = Math.max(Number(r.wh) || 0, p.afkWhPut); save(d); }
  };
  // 存進倉庫：跟目前存著的倉庫比，物品（同 uid 數量變多或新出現）或金幣變多就算一次
  var readWh = function () { try { var k = whKey(); var s = typeof _lzGet === 'function' ? _lzGet(k) : localStorage.getItem(k); if (!s) return { items: [], gold: 0 }; var w = JSON.parse(s); return { items: w.items || [], gold: Number(w.gold) || 0 }; } catch (e) { return null; } };
  var grew = function (old, w) {
    if (!old || !w) return false;
    if ((Number(w.gold) || 0) > old.gold) return true;
    var m = {}; old.items.forEach(function (it) { if (it && it.uid != null) m[it.uid] = Number(it.cnt) || 1; });
    return (w.items || []).some(function (it) { return it && (m[it.uid] == null || (Number(it.cnt) || 1) > m[it.uid]); });
  };
  if (typeof W.saveWarehouse === 'function') {
    var oSave = W.saveWarehouse;
    W.saveWarehouse = function (w) {
      var p = P(), old = p ? readWh() : null;
      var r = oSave.apply(this, arguments);
      try { if (r !== false && p && grew(old, w)) api.noteDeposit(p); } catch (e) {}
      return r;
    };
    try { (0, eval)('saveWarehouse = window.saveWarehouse'); } catch (e) {}
  }
})();
