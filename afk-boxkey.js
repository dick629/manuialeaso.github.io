/* ============================================================================
 * afk-boxkey.js — 歐西里斯／庫庫爾坎寶箱：碎片 100 個合成、席琳結晶也能開（玩家 2026-10-29）
 *
 *   ‧巴特爾合成「上鎖的○○初級／高級寶箱」：原本上、下碎片各 1 → 各 50（合計 100 個碎片）。
 *   ‧開箱：原本每個只能用龜裂之核 1 顆；現在也可以改用席琳結晶 50 顆（背包優先，不足扣共用倉庫）。開箱視窗多一個鑰匙選單。
 *   不改核心：改 CRAFT_RECIPES.npc_bartel 的數量、包 openOsirisBox（視窗）與 doOpenOsirisBox（席琳結晶模式時先借龜裂之核給核心流程，用完還原）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'boxkey', name: '寶箱碎片 100 個合成、席琳結晶開箱', group: '遊戲玩法',
    desc: '歐西里斯／庫庫爾坎寶箱要上、下碎片各 50 個才能合成；開箱除了龜裂之核 1 顆，也可以用席琳結晶 50 顆' });
  if (T && !T.enabled('boxkey')) return;
  if (typeof DB === 'undefined' || !DB.items || typeof W.doOpenOsirisBox !== 'function') return;
  var HALF = 50, CRYSTAL = 'sherine_crystal', CRYSTAL_N = 50, CORE = 'mat_crack_core';
  var BOXES = ['item_osiris_box_basic', 'item_osiris_box_high', 'item_kukulkan_box_basic', 'item_kukulkan_box_high'];
  // 合成數量
  try {
    (CRAFT_RECIPES.npc_bartel || []).forEach(function (r) { if (BOXES.indexOf(r.result) >= 0) (r.req || []).forEach(function (q) { if (/_(up|down)$/.test(q.id)) q.cnt = HALF; }); });
    Object.keys(DB.items).forEach(function (id) { var d = DB.items[id]; if (/^mat_(osiris|kukulkan)_(basic|high)_(up|down)$/.test(id) && d && d.d) d.d = String(d.d).replace(/與[上下]半碎片各 1 個/, function (m) { return m.replace('各 1 個', '各 ' + HALF + ' 個'); }).replace(/由巴特爾與[上下]半碎片接合即可還原寶箱/, function (m) { return m + '（上、下各 ' + HALF + ' 個）'; }); });
    BOXES.forEach(function (id) { var d = DB.items[id]; if (d && d.d) d.d = String(d.d).replace('每開啟 1 個消耗 1 顆 龜裂之核', '每開啟 1 個消耗 1 顆 龜裂之核（或席琳結晶 ' + CRYSTAL_N + ' 顆）'); });
  } catch (e) {}
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var crystals = function () { try { return typeof questCountId === 'function' ? questCountId(CRYSTAL) : 0; } catch (e) { return 0; } };
  var cores = function () { return typeof playerCoreCount === 'function' ? playerCoreCount() : 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var mode = 'core';
  // 視窗：鑰匙選單＋數量
  W.openOsirisBox = function (uid) {
    var p = P(); if (!p) return;
    var item = p.inv.find(function (i) { return i.uid === uid; }); if (!item) return;
    var d = DB.items[item.id]; if (!d) return;
    var nc = cores(), ns = crystals(), cnt = item.cnt || 1;
    if (nc < 1 && ns < CRYSTAL_N) { logSys('<span class="text-red-400">開啟' + esc(d.n) + '每個需要 龜裂之核 1 顆（巴特爾用時空裂痕碎片×100 製作）或 席琳結晶 ' + CRYSTAL_N + ' 顆，兩種都不夠。</span>'); return; }
    if (mode === 'core' && nc < 1) mode = 'crystal'; if (mode === 'crystal' && ns < CRYSTAL_N) mode = 'core';
    var maxOf = function (m) { return Math.min(cnt, m === 'crystal' ? Math.floor(ns / CRYSTAL_N) : nc); };
    var modal = document.getElementById('osiris-box-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'osiris-box-modal'; modal.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center'; document.body.appendChild(modal); }
    modal.innerHTML = '<div class="absolute inset-0 bg-black/60" onclick="closeOsirisBoxModal()"></div>'
      + '<div class="panel border-amber-500 p-5 relative w-[440px] flex flex-col">'
      + '<div class="panel-header rounded-md mb-3">' + esc(d.n) + ' — 選擇鑰匙與數量</div>'
      + '<div class="text-sm text-slate-300 mb-2">持有寶箱 <span class="text-amber-300">' + cnt + '</span> 個、龜裂之核 <span class="text-amber-300">' + nc + '</span> 顆、席琳結晶 <span class="c-sherine">' + ns + '</span> 顆</div>'
      + '<select id="afk-boxkey-mode" class="w-full mb-2 px-2 py-1 rounded bg-slate-800 border border-slate-600" aria-label="用什麼開箱">'
      + '<option value="core"' + (mode === 'core' ? ' selected' : '') + (nc < 1 ? ' disabled' : '') + '>龜裂之核 1 顆／個（可開 ' + maxOf('core') + '）</option>'
      + '<option value="crystal"' + (mode === 'crystal' ? ' selected' : '') + (ns < CRYSTAL_N ? ' disabled' : '') + '>席琳結晶 ' + CRYSTAL_N + ' 顆／個（可開 ' + maxOf('crystal') + '）</option></select>'
      + '<input id="osiris-box-qty" type="number" min="1" max="' + maxOf(mode) + '" value="' + maxOf(mode) + '" class="w-full mb-3 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-center text-lg">'
      + '<div class="flex gap-2"><button class="btn flex-1 bg-amber-800 hover:bg-amber-700 font-bold" onclick="confirmOsirisBox(\'' + esc(uid) + '\')">開啟</button><button class="btn flex-1" onclick="closeOsirisBoxModal()">取消</button></div></div>';
    modal.querySelector('#afk-boxkey-mode').addEventListener('change', function () { mode = this.value; var q = modal.querySelector('#osiris-box-qty'); q.max = maxOf(mode); q.value = maxOf(mode); });
    modal.classList.remove('hidden');
    try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
  };
  // 席琳結晶模式：先扣結晶、借 n 顆龜裂之核給核心流程；沒用完的龜裂之核收回、結晶退還
  var oDo = W.doOpenOsirisBox;
  W.doOpenOsirisBox = function (uid, n) {
    var p = P();
    if (!p || mode !== 'crystal') return oDo.apply(this, arguments);
    n = Math.max(1, Math.floor(Number(n) || 1));
    var item = p.inv.find(function (i) { return i.uid === uid; }); if (!item) return oDo.apply(this, arguments);
    n = Math.min(n, item.cnt || 1, Math.floor(crystals() / CRYSTAL_N));
    if (n < 1) { logSys('<span class="text-red-400">席琳結晶不夠（每個寶箱 ' + CRYSTAL_N + ' 顆）。</span>'); try { closeOsirisBoxModal(); } catch (e) {} return; }
    questConsumeId(CRYSTAL, n * CRYSTAL_N);
    var tmp = { id: CORE, uid: 'afkboxkey_' + Date.now(), cnt: n, en: 0, lock: false, junk: false, _afkBoxKeyTmp: true };
    p.inv.unshift(tmp);   // 放最前面：核心 find 會先用到借的，不會動到玩家自己的龜裂之核
    var r;
    try { r = oDo.call(this, uid, n); }
    finally {
      var left = p.inv.find(function (i) { return i._afkBoxKeyTmp; });
      if (left) { p.inv.splice(p.inv.indexOf(left), 1); if (left.cnt > 0) gainItem(CRYSTAL, left.cnt * CRYSTAL_N, true, true); }
      try { renderTabs(true); updateUI(); saveGame(); } catch (e) {}
    }
    return r;
  };
  W.__afkBoxKey = { HALF: HALF, CRYSTAL_N: CRYSTAL_N, mode: function (m) { if (m) mode = m; return mode; } };
})();
