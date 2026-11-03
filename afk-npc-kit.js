/* ============================================================================
 * afk-npc-kit.js — NPC 服務面板共用的外觀與小工具（玩家 2026-10-29：哈瑪大師、佐爾頓、艾彼迪爾都比照艾格尼絲的面板）
 *
 * 不是開關：只提供樣式與 HTML 小零件，各 NPC 外掛自己決定要不要出現。
 *   css()                 注入 .afk-ax 面板樣式（艾格尼絲原本的那一套，搬到這裡共用）
 *   icoTag / itemIco      48px 圖示框（帶物品 tooltip）
 *   reqTxt                「持有／需要」紅綠字
 *   fullName              物品完整名稱（含強化值、詞綴顏色）
 *   matBar(list)          面板最上面的材料列：[物品 id] 或 {img, n, v, tip}
 *   rowHtml(s, attr)      一列服務：圖示、名稱、說明、需求、按鈕（按鈕帶 attr="動作"）
 *   addNpc(town, def, spr)把 NPC 放進城鎮
 *   hookNpc(id, title, fn)點 NPC 時開城鎮浮動視窗，fn(div) 畫內容
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var css = function () {
    if (document.getElementById('afk-ax-css')) return;
    var s = document.createElement('style'); s.id = 'afk-ax-css';
    s.textContent = '.afk-ax{color:#e2e8f0;font-size:14px;line-height:1.6}'
      + '.afk-ax .ax-lore{color:#94a3b8;font-size:13px;font-style:italic;margin:0 0 8px}'
      + '.afk-ax .ax-h{color:#fde68a;font-weight:700;font-size:15px;margin:12px 0 6px}'
      + '.afk-ax .ax-ico{width:48px;height:48px;flex:0 0 48px;background:#0f172a;border:1px solid #475569;border-radius:6px;display:flex;align-items:center;justify-content:center}'
      + '.afk-ax .ax-ico img{width:40px;height:40px;object-fit:contain;pointer-events:none}'
      + '.afk-ax .ax-ico.sm{width:32px;height:32px;flex:0 0 32px}.afk-ax .ax-ico.sm img{width:26px;height:26px}'
      + '.afk-ax .ax-mats{display:flex;flex-wrap:wrap;gap:8px}'
      + '.afk-ax .ax-mat{display:flex;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:4px 8px 4px 4px;font-size:13px}'
      + '.afk-ax .ax-mat b{color:#fde68a}'
      + '.afk-ax .ax-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}'
      + '.afk-ax .ax-filter button{padding:4px 12px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;font-size:13px}'
      + '#interaction-content .afk-ax .ax-filter button.on{background:#854d0e;border-color:#f59e0b;color:#fef3c7}'
      + '.afk-ax .ax-list{max-height:240px;overflow-y:auto;border:1px solid #334155;border-radius:8px;background:rgba(15,23,42,.6)}'
      + '.afk-ax .ax-eq{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #1e293b;cursor:pointer}'
      + '.afk-ax .ax-eq:hover{background:#334155}.afk-ax .ax-eq.on{background:#422006;box-shadow:inset 3px 0 0 #f59e0b}'
      + '.afk-ax .ax-eq .ax-where{font-size:12px;color:#94a3b8}'
      + '.afk-ax .ax-sel{display:flex;gap:12px;align-items:flex-start;border:1px solid #a16207;border-radius:8px;padding:10px 12px;background:rgba(66,32,6,.35)}'
      + '.afk-ax .ax-sel ul{margin:4px 0 0;padding-left:18px;font-size:13px}.afk-ax .ax-sel li{margin:1px 0}'
      + '.afk-ax .ax-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:8px}'
      + '.afk-ax .ax-row:hover{background:#273449}.afk-ax .ax-row.off{opacity:.75}'
      + '.afk-ax .ax-main{display:flex;gap:12px;align-items:flex-start;min-width:0;flex:1 1 280px}'
      + '.afk-ax .ax-name{font-weight:700;font-size:16px;line-height:1.3}'
      + '.afk-ax .ax-desc{color:#cbd5e1;font-size:13px}.afk-ax .ax-note{color:#94a3b8;font-size:12px}'
      + '.afk-ax .ax-req{font-size:13px;font-weight:700}.afk-ax .ok{color:#4ade80}.afk-ax .no{color:#f87171}'
      + '.afk-ax .ax-act{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
      + '.afk-ax .ax-act button{padding:7px 14px;border-radius:6px;background:#a16207;color:#fff;border:1px solid #f59e0b;font-weight:700;font-size:13px;white-space:nowrap}'
      + '.afk-ax .ax-act button[disabled]{opacity:.4;cursor:not-allowed}'
      + '.afk-ax .ax-act select{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:6px;font-size:13px}'
      + '.afk-ax .ax-err{color:#fca5a5;font-size:13px;min-height:1.2em;margin:4px 0}'
      + '.afk-ax .ax-msg{color:#86efac;font-size:13px;min-height:1.2em;margin:4px 0}'
      + '.afk-ax .ax-socks{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}'
      + '.afk-ax .ax-sock{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;border:1px solid #475569;background:#0f172a;font-size:12px;color:#94a3b8}'
      + '.afk-ax .ax-sock.open{border-color:#a855f7;color:#e9d5ff;background:#2e1065}.afk-ax .ax-sock.filled{border-color:#f59e0b;color:#fde68a;background:#422006}.afk-ax .ax-sock.lock{opacity:.55}'
      + '.afk-ax .ax-pick{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}'
      + '.afk-ax .ax-pick label{display:flex;align-items:center;gap:6px;background:#0f172a;border:1px solid #475569;border-radius:8px;padding:6px 10px;cursor:pointer}'
      + '.afk-ax .ax-pick label.on{border-color:#f59e0b;background:#422006}';
    document.head.appendChild(s);
  };
  var iconUrl = function (d) { try { return typeof getIconUrl === 'function' ? getIconUrl(d) : (d && d.img) || ''; } catch (e) { return (d && d.img) || ''; } };
  var icoTag = function (url, tip, sm) { return '<div class="ax-ico' + (sm ? ' sm' : '') + (tip ? ' tip-host' : '') + '"' + (tip || '') + '><img src="' + esc(url || '') + '" alt="" onerror="this.style.visibility=\'hidden\'"></div>'; };
  var itemIco = function (id, sm) { var d = DB.items[id]; return icoTag(iconUrl(d), ' data-tip-id="' + esc(id) + '"', sm); };
  var invIco = function (it, src, sm) { var d = it && DB.items[it.id]; return icoTag(iconUrl(d), ' data-tip-uid="' + esc(it && it.uid) + '" data-tip-src="' + (src || 'inv') + '"', sm); };
  var reqTxt = function (have, need, label) { return '<span class="ax-req"><span class="' + (have >= need ? 'ok' : 'no') + '">' + Number(have || 0).toLocaleString() + '</span>/' + Number(need || 0).toLocaleString() + ' ' + label + '</span>'; };
  var fullName = function (it) { try { return '<span class="' + esc(typeof getItemColor === 'function' ? getItemColor(it) : '') + ' font-bold">' + getItemFullName(it) + '</span>'; } catch (e) { var d = it && DB.items[it.id]; return esc(d ? d.n : ''); } };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var have = function (id) { var p = P(); return p ? (p.inv || []).filter(function (it) { return it && it.id === id && !it.lock; }).reduce(function (n, it) { return n + (Number(it.cnt) || 1); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (!p || have(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var matBar = function (list) {
    return '<div class="ax-mats">' + list.map(function (m) {
      if (typeof m === 'string') { var d = DB.items[m]; return d ? '<div class="ax-mat">' + itemIco(m, true) + '<span>' + esc(d.n) + ' <b>' + have(m).toLocaleString() + '</b></span></div>' : ''; }
      return '<div class="ax-mat">' + icoTag(m.img, m.tip || '', true) + '<span>' + esc(m.n) + ' <b>' + (typeof m.v === 'number' ? m.v.toLocaleString() : esc(m.v)) + '</b></span></div>';
    }).join('') + '</div>';
  };
  // s: { ico, name, color, desc, note, req, why, off, pick, btns: [[動作, 文字, 可按]] }
  var rowHtml = function (s, attr) {
    var blocked = !!s.why;
    return '<div class="ax-row' + (s.off ? ' off' : '') + '"' + (s.key ? ' data-row="' + esc(s.key) + '"' : '') + '><div class="ax-main">' + (s.ico || '')
      + '<div style="min-width:0"><div class="ax-name" style="color:' + (s.color || '#fde68a') + ';">' + s.name + '</div>'
      + (s.desc ? '<div class="ax-desc">' + s.desc + '</div>' : '')
      + (s.note ? '<div class="ax-note">' + s.note + '</div>' : '')
      + ((s.req || s.why) ? '<div>' + (s.req || '') + (s.why ? '　<span class="no" style="font-size:12px">' + esc(s.why) + '</span>' : '') + '</div>' : '') + '</div></div>'
      + '<div class="ax-act">' + (s.pick || '') + (s.btns || []).map(function (b) { return '<button type="button" ' + attr + '="' + esc(b[0]) + '"' + (b[2] && !blocked ? '' : ' disabled') + (b[3] ? ' title="' + esc(b[3]) + '"' : '') + '>' + b[1] + '</button>'; }).join('') + '</div></div>';
  };
  var addNpc = function (townId, def, spr) {
    try {
      var town = DB.towns && DB.towns[townId];
      if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === def.id; })) town.npcs.push(def);
      if (spr && typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[def.id]) NPC_SPR_FIXED[def.id] = spr;
      return true;
    } catch (e) { return false; }
  };
  var hookNpc = function (npcId, name, title, fn) {
    if (typeof W.interactNPC !== 'function') return;
    var o = W.interactNPC;
    W.interactNPC = function (id) {
      if (id === npcId && typeof W.openTownFloatWindow === 'function') { try { W.openTownFloatWindow(name, title, fn); return; } catch (e) { console.warn('[AFK-npc-kit]', npcId, e); } }
      var r = o.apply(this, arguments);
      if (id === npcId) { try { fn(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-npc-kit]', npcId, e); } }
      return r;
    };
  };
  // 保留捲動位置重畫
  var repaint = function (box, html, listSel) {
    var top = box.scrollTop, lst = listSel && box.querySelector(listSel), lt = lst ? lst.scrollTop : 0;
    box.innerHTML = html;
    box.scrollTop = top; var nl = listSel && box.querySelector(listSel); if (nl) nl.scrollTop = lt;
  };
  W.__afkNpcKit = { css: css, esc: esc, iconUrl: iconUrl, icoTag: icoTag, itemIco: itemIco, invIco: invIco, reqTxt: reqTxt, fullName: fullName, have: have, take: take, matBar: matBar, rowHtml: rowHtml, addNpc: addNpc, hookNpc: hookNpc, repaint: repaint };
})();
