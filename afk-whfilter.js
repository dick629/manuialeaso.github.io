/* ============================================================================
 * afk-whfilter.js — 倉庫「條件存入」（玩家 2026-10-28：倉庫比照快速廢品，可以依祝福、卡片、卷軸、防具部位等條件存）
 *
 * 倉庫面板的分類列下面多一列「🔎 條件存入」：
 *   類別：全部／武器（可選單一類型）／防具（可選單一部位）／飾品（可選單一部位）／道具（卡片、材料、藥水、增益道具、卷軸、技能書、任務物品、其他）
 *     ‧部位分組沿用遊戲的 EQUIP_CATEGORIES；道具種類沿用快速廢品的分類（window.__afkQuickJunk.itemCat，不另寫一份）
 *   篩選：詞條（2026-10-29 改成完整清單，同 afk-itemguard：祝福三階、屬性、遠古系、龍紋、套裝、傳說、遺物、符文孔…）、+N 以上（勾選的條件全部都要符合）
 *   🛡 物品保護設定成「不能存」的物品不會存。
 *   「存入符合的 N 件」：走 afk-whall 的批次存入（核心交易保護 whTxnSnapshot → 搬移 → whTxnCommit 一次；合併、倉庫上限同核心）
 *     鎖定物品、不可存入（WH_NO_STORE）照原規則不存；已裝備的不在背包，本來就不會動。整疊存入（不看「數量」欄）。
 * 條件記在本機（每台裝置自己的偏好，不進存檔）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('warehouse')) return;   // 跟倉庫擴充（afk-warehouse／afk-whall）同一個開關
  if (typeof window.renderWarehouseNPC !== 'function' || typeof window.whDepositShown !== 'function') { console.warn('[AFK-whfilter] 找不到倉庫批次存入，略過'); return; }

  var KEY = 'afk_whfilter_v1';
  var st = { cat: 'all', bless: false, attr: false, anc: false, en: -1, open: false, affix: null, axOpen: false };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv && typeof sv === 'object') Object.keys(st).forEach(function (k) { if (sv[k] !== undefined) st[k] = sv[k]; }); } catch (e) {}
  // 2026-10-29：詞條改成完整清單（afk-itemguard 的 AFFIX）；舊的祝福／屬性／遠古三格搬進去
  if (!st.affix || typeof st.affix !== 'object') { st.affix = {}; if (st.bless) st.affix.bless = true; if (st.attr) st.affix.attr = true; if (st.anc) st.affix.anc = true; }
  var IG = function () { return window.__afkItemGuard || null; };
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  var CATS = (typeof EQUIP_CATEGORIES !== 'undefined') ? EQUIP_CATEGORIES : [];
  var GROUP_OF = {}; CATS.forEach(function (c) { GROUP_OF[c.key] = c.group; });
  var QJ = function () { return window.__afkQuickJunk || null; };
  var catOf = function (it, d) { try { return equipCatKey(it.id, d); } catch (e) { return ''; } };
  var isGear = function (d) { return d && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc'); };

  // 選單內容：[value, 顯示文字, 是否為群組標題]
  var options = function () {
    var o = [['all', '全部類別']];
    [['武器', 'g:武器', '武器（全部）'], ['防具', 'g:防具', '防具（全部）'], ['飾品', 'g:飾品', '飾品（全部）']].forEach(function (g) {
      o.push([g[1], g[2]]);
      CATS.filter(function (c) { return c.group === g[0]; }).forEach(function (c) { o.push(['cat:' + c.key, '　' + g[0] + '・' + c.name]); });
    });
    var q = QJ();
    if (q && q.itemCats) { o.push(['item', '道具（全部）']); q.itemCats.forEach(function (c) { o.push(['ic:' + c[0], '　道具・' + c[1]]); }); }
    else o.push(['item', '道具（全部）']);
    return o;
  };

  var match = function (it) {
    if (!it) return false;
    var d = DB.items[it.id]; if (!d) return false;
    var c = st.cat;
    if (c !== 'all') {
      if (c === 'item') { if (isGear(d)) return false; }
      else if (c.indexOf('ic:') === 0) { if (isGear(d)) return false; var q = QJ(); if (!q || !q.itemCat || 'ic:' + q.itemCat(d, it.id) !== c) return false; }
      else {
        if (!isGear(d)) return false;
        var ck = catOf(it, d);
        if (c.indexOf('g:') === 0) { if (GROUP_OF[ck] !== c.slice(2)) return false; }
        else if (c.indexOf('cat:') === 0) { if (ck !== c.slice(4)) return false; }
      }
    }
    var ig = IG();
    if (ig) { for (var k in st.affix) if (st.affix[k] && !ig.has(it, k)) return false; }
    else {
      if (st.affix.bless && it.bless !== true) return false;
      if (st.affix.attr && !it.attr) return false;
      if (st.affix.anc && !it.anc) return false;
    }
    if (st.en >= 0 && (Number(it.en) || 0) < st.en) return false;
    return true;
  };
  var depositable = function () {
    var noStore = (typeof WH_NO_STORE !== 'undefined') ? WH_NO_STORE : [];
    var ig = IG();
    return (player.inv || []).filter(function (it) { return it && !it.lock && noStore.indexOf(it.id) < 0 && !(ig && ig.blocked(it, 'store')) && match(it); });
  };

  var redraw = function () { try { window.renderWarehouseNPC(document.getElementById('interaction-content')); } catch (e) {} };
  window.whFilterSet = function (k, v) {
    if (k === 'cat') st.cat = String(v); else if (k === 'en') st.en = Number(v); else if (k === 'open') st.open = !!v; else if (k === 'axOpen') st.axOpen = !!v; else if (k.indexOf('ax:') === 0) { if (v) st.affix[k.slice(3)] = true; else delete st.affix[k.slice(3)]; } else st[k] = !!v;
    persist(); if (k !== 'open' && k !== 'axOpen') redraw();
  };
  window.whFilterDeposit = function () { window.whDepositShown(match); };

  var rowHTML = function () {
    var n = depositable().length;
    var sel = 'class="bg-slate-900 border border-slate-600 text-white rounded py-1 px-2 text-sm"';
    var en = '<option value="-1"' + (st.en < 0 ? ' selected' : '') + '>強化不限</option>';
    for (var k = 1; k <= 15; k++) en += '<option value="' + k + '"' + (st.en === k ? ' selected' : '') + '>+' + k + ' 以上</option>';
    var cb = function (key, label, color) { return '<label class="flex items-center gap-1 whitespace-nowrap"><input type="checkbox"' + (st[key] ? ' checked' : '') + ' onchange="whFilterSet(\'' + key + '\',this.checked)"><span' + (color ? ' style="color:' + color + '"' : '') + '>' + label + '</span></label>'; };
    var AX = IG() ? IG().AFFIX : [['bless', '祝福的（含昇華／至高）', '#fcd34d'], ['attr', '有屬性', '#7dd3fc'], ['anc', '遠古系詞綴', '#c4b5fd']];
    var axOn = AX.filter(function (a) { return st.affix[a[0]]; });
    var axHTML = function () {
      return '<details class="relative"' + (st.axOpen ? ' open' : '') + ' ontoggle="whFilterSet(\'axOpen\',this.open)"><summary class="cursor-pointer select-none bg-slate-900 border border-slate-600 rounded px-2 py-1 whitespace-nowrap">詞條：' + (axOn.length ? axOn.map(function (a) { return a[1]; }).join('、') : '不限') + ' ▾</summary>'
        + '<div class="mt-1 p-2 bg-slate-900 border border-cyan-800 rounded grid gap-1" style="grid-template-columns:repeat(2,minmax(0,max-content));column-gap:14px">'
        + AX.map(function (a) { return '<label class="flex items-center gap-1 whitespace-nowrap"><input type="checkbox"' + (st.affix[a[0]] ? ' checked' : '') + ' onchange="whFilterSet(\'ax:' + a[0] + '\',this.checked)"><span style="color:' + a[2] + '">' + a[1] + '</span></label>'; }).join('')
        + '<div class="text-slate-400" style="grid-column:1/-1;white-space:normal">勾了幾個就要全部都有才存</div></div></details>'
        + (window.openItemGuard ? '<button type="button" onclick="openItemGuard()" class="btn px-2 text-xs h-8" style="background:#1e293b;color:#fcd34d;border-color:#b45309" title="設定哪些詞條的物品不能存倉庫">🛡 物品保護</button>' : '');
    };
    return '<details id="afk-whfilter"' + (st.open ? ' open' : '') + ' ontoggle="whFilterSet(\'open\',this.open)" class="bg-slate-800/60 border border-cyan-900 rounded p-2 text-sm">'
      + '<summary class="cursor-pointer select-none text-cyan-300 font-bold">🔎 條件存入（比照快速廢品：依類別、部位、詞條、強化值挑選）</summary>'
      + '<div class="flex items-center gap-2 flex-wrap mt-2">'
      + '<select ' + sel + ' onchange="whFilterSet(\'cat\',this.value)">' + options().map(function (o) { return '<option value="' + o[0] + '"' + (st.cat === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'
      + '<select ' + sel + ' onchange="whFilterSet(\'en\',this.value)">' + en + '</select>'
      + axHTML()
      + '<button type="button" onclick="whFilterDeposit()" class="btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center ms-auto"' + (n ? '' : ' disabled')
      + ' style="background:linear-gradient(135deg,#0c4a5e,#0e7490);color:#a5f3fc;border-color:#0891b2" title="整疊存入；鎖定、不可存入的物品不會存">存入符合的 ' + n + ' 件</button>'
      + '</div><div class="text-xs text-slate-400 mt-1">勾選的條件要全部符合才會存；鎖定、不可存入、🛡 物品保護設定成不能存的物品不會存。與上面的「物品分類」無關。</div></details>';
  };

  var oRender = window.renderWarehouseNPC;
  window.renderWarehouseNPC = function () {
    var r = oRender.apply(this, arguments);
    try {
      var root = document.getElementById('warehouse-window-content') || document.getElementById('interaction-content');
      var grid = root && root.querySelector('#wh-inv-list');
      grid = grid && grid.closest('.grid');
      if (grid && !root.querySelector('#afk-whfilter')) {
        var box = document.createElement('div'); box.innerHTML = rowHTML();
        grid.parentNode.insertBefore(box.firstChild, grid);
      }
    } catch (e) { console.warn('[AFK-whfilter] ui', e); }
    return r;
  };
  window.__afkWhFilter = { match: match, state: st, depositable: depositable };
  console.log('[AFK-whfilter] 已啟用：倉庫條件存入');
})();
