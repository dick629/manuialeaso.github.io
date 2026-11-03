/* ============================================================================
 * afk-allypoly.js — 隊伍與夥伴 → 技能設定：幫隊員選變身（玩家 2026-11-01 06:06「這裡可以製作控制隊友變身嗎？這樣我就可以不用切換角色」）
 *   外掛開關 allypoly，預設開。
 *
 * 每位隊員的技能設定卡片多一列「變身」：
 *   ‧「選擇」打開跟自己用變形卷軸一樣的變身選單，但列表照「那位隊員」算——他的等級、他身上的武器、
 *     他有沒有戴變形控制戒指、他的變身收集冊／鑽石卡（同一套規則，只是換成隊員的角色）。
 *   ‧選好後花一張變形卷軸：隊長背包有就用一張，沒有就照商店價自動買（跟隊員變身到期自動續買同一套，攻城折扣照算）。
 *   ‧變身會一直維持（到期自動續買卷軸，原本的機制）；同時寫回隊員自己的存檔，之後在村莊重新整理隊伍也不會掉。
 *   ‧「取消」：解除變身、不再自動續買。
 *   ‧隊員角色正在其他分頁開著時只改隊伍裡的這份（不寫回他的存檔，避免互相覆蓋）。
 * 不需要在村莊：直接改隊伍裡的隊員，HP／MP 不會被補滿。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'allypoly', name: '幫隊員選變身', group: '遊戲介面', seal: true,
    desc: '隊伍與夥伴 → 技能設定：每位隊員多一列「變身」，可以直接幫他選變身（照他的等級、武器、收集冊），不用切換角色' });
  if (T && !T.enabled('allypoly')) return;
  if (typeof W.openPolySelect !== 'function' || typeof W.confirmPolySelect !== 'function' || typeof W._allyAutoBuffChips !== 'function') { console.warn('[AFK-allypoly] 缺少變身或隊伍介面，略過'); return; }

  var TOKEN = '__afkAllyPoly';
  var target = null;   // 正在幫哪位隊員選（存檔位）
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var allyOf = function (slot) { var p = P(); return p && (p.allies || []).find(function (a) { return a && String(a._slot) === String(slot); }) || null; };
  var nameOf = function (a) { return (a && (a._allyName || a.name)) || '隊員'; };
  var polyOn = function (a) { return !!(a && a.poly && a.poly.n && a.buffs && (a.buffs.poly || 0) > 0); };

  // 隊員自己的存檔（不限村莊；角色在其他分頁開著就不寫回）
  var readSource = function (slot) {
    try {
      if (typeof _allySourceOpenElsewhere === 'function' && _allySourceOpenElsewhere(String(slot))) return null;
      var stored = _saveUnwrap(_lzGet('lineage_idle_save_' + slot));
      if (!stored || !stored.payload || (stored.signed && !stored.ok)) return null;
      var doc = JSON.parse(stored.payload), src = doc && doc.p, a = allyOf(slot);
      if (!src || !src.cls || (a && a.enSeed && src.enSeed && a.enSeed !== src.enSeed)) return null;
      src.inv = Array.isArray(src.inv) ? src.inv : []; src.eq = src.eq || {}; src.buffs = src.buffs || {};
      return { doc: doc, src: src };
    } catch (e) { return null; }
  };
  var writeSource = function (slot, ctx) {
    try { return !!_lzSet('lineage_idle_save_' + slot, _saveWrap(JSON.stringify(ctx.doc))); } catch (e) { return false; }
  };
  // 以隊員的角色身分執行（等級、裝備、戒指、收集冊都讀他的）
  var asAlly = function (a, ctx, work) {
    var who = ctx ? ctx.src : a;
    if (typeof _withAllyEquipmentContext === 'function') {
      var lead = P(), borrowed = false;
      if (lead && !who.cardDex) { who.cardDex = lead.cardDex; who.equipDex = lead.equipDex; who.miscDex = lead.miscDex; borrowed = true; }   // 收集冊是同模式共用桶（同 buildAlly）
      try { return _withAllyEquipmentContext(who, work); }
      finally { if (borrowed) { delete who.cardDex; delete who.equipDex; delete who.miscDex; } }
    }
    return work();
  };

  var rerender = function () {
    try { (0, eval)("_squadSigSkill = ''"); } catch (e) {}
    try { if (typeof renderSquadPanel === 'function') renderSquadPanel(); } catch (e) {}
  };

  // ── 技能設定卡片多一列 ──
  var CSS = '.afk-apoly{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:2px;padding:3px 6px;border:1px solid #6b4e36;border-radius:4px;background:rgba(40,30,24,.45)}'
    + '.afk-apoly .lab{color:#e7b96a;font-weight:700;flex:0 0 auto}'
    + '.afk-apoly .curw{flex:1;min-width:0;overflow:hidden}.afk-apoly .cur{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e2d6c2}'
    + '.afk-apoly .cur.none{color:#8f877d}'
    + '.afk-apoly button{flex:0 0 auto;padding:2px 7px;border-radius:4px;border:1px solid #8d6846;background:linear-gradient(180deg,#4a3828,#2a2019);color:#f1d9a6;font-weight:700;cursor:pointer}'
    + '.afk-apoly button.x{border-color:#5b4a3e;color:#bfb2a0;background:#221d1d}';
  var css = function () { if (document.getElementById('afk-apoly-css')) return; var st = document.createElement('style'); st.id = 'afk-apoly-css'; st.textContent = CSS; document.head.appendChild(st); };
  var curText = function (a) {
    if (!polyOn(a)) return '<span class="cur none">沒有變身</span>';
    var m = Math.ceil((a.buffs.poly || 0) / 60);
    return '<span class="cur"><span class="' + esc(a.poly.c || '') + '">' + esc(a.poly.n) + '</span>' + (a._mercPolyAuto ? '（自動）' : '（剩 ' + m + ' 分）') + '</span>';
  };
  var rowHtml = function (a) {
    if (!a || a._slot == null) return '';
    css();
    var s = esc(a._slot);
    return '<div class="afk-apoly" data-apoly="' + s + '"><span class="lab">變身</span><span class="curw" id="afk-apoly-cur-' + s + '">' + curText(a) + '</span>'
      + '<button type="button" onclick="__afkAllyPoly.pick(\'' + s + '\')">選擇</button>'
      + (polyOn(a) ? '<button type="button" class="x" onclick="__afkAllyPoly.cancel(\'' + s + '\')">取消</button>' : '') + '</div>';
  };
  var oChips = W._allyAutoBuffChips;
  W._allyAutoBuffChips = function (a) {
    var h = oChips.apply(this, arguments);
    try { h = rowHtml(a) + h; } catch (e) {}
    return h;
  };
  try { (0, eval)('_allyAutoBuffChips = window._allyAutoBuffChips'); } catch (e) {}
  setInterval(function () {   // 變身名稱／剩餘時間（技能分頁只在名單變動時重建，這裡另外更新）
    try { var p = P(); if (!p) return; (p.allies || []).forEach(function (a) { var el = a && document.getElementById('afk-apoly-cur-' + a._slot); if (el) el.innerHTML = curText(a); }); } catch (e) {}
  }, 2000);

  // ── 選擇：用隊員的身分打開原本的變身選單 ──
  var pick = function (slot) {
    var a = allyOf(slot);
    if (!a) return;
    if (a._downed) { sys('<span class="text-amber-300">' + esc(nameOf(a)) + ' 倒地中，先復活再變身。</span>'); return; }
    target = String(slot);
    var ctx = readSource(slot);
    try { asAlly(a, ctx, function () { W.openPolySelect(TOKEN); }); } catch (e) { console.warn('[AFK-allypoly] open', e); }
    try {
      var modal = document.getElementById('poly-modal'), h = modal && modal.querySelector('.panel-header');
      if (h) h.textContent = '幫 ' + nameOf(a) + ' 選擇變身（Lv' + (a.lv || 1) + '）';
      var back = document.getElementById('afk-card-poly-back'); if (back) back.remove();   // 那顆是改「隊長自己」的指定變身，這裡不適用
      var note = document.getElementById('afk-apoly-note');
      if (!note && modal) { note = document.createElement('div'); note.id = 'afk-apoly-note'; note.style.cssText = 'font-size:12px;color:#cdb991;margin:0 0 8px'; var anchor = h && h.nextSibling; if (h && h.parentNode) h.parentNode.insertBefore(note, anchor); }
      if (note) note.textContent = '照 ' + nameOf(a) + ' 的等級、武器、變形控制戒指與收集冊列出。花一張變形卷軸（背包沒有就照商店價自動買），之後到期自動續買。';
    } catch (e) {}
  };
  var scrollPrice = function () { var d = DB.items.scroll_poly || {}; return (typeof shopPrice === 'function') ? shopPrice(d.p || 0) : (d.p || 0); };
  var takeScroll = function () {
    var p = P(); if (!p) return false;
    var it = (p.inv || []).find(function (x) { var d = x && DB.items[x.id]; return d && d.eff === 'poly' && !x.lock && (x.cnt || 1) > 0; });
    if (it) { try { consume(it); } catch (e) { return false; } return '一張變形卷軸'; }
    var price = scrollPrice();
    if ((p.gold || 0) < price) return null;
    p.gold -= price; return price.toLocaleString() + ' 金幣（買一張變形卷軸）';
  };
  var buildState = function (name) {   // 在隊員身分下呼叫
    var base = typeof findPolyForm === 'function' ? findPolyForm(name) : null, CA = W.AFK_CARD_ASCENSION, f = null, color = base && base.color;
    var cardOn = !!(CA && typeof CA.resolve === 'function' && (!T || T.enabled('card-ascension')));
    if (cardOn) { f = CA.resolve(base ? base.form : { n: name }, player); }
    if (!f && base) {
      var bf = base.form;
      if ((player.lv || 1) < (bf.lv || 0)) return { err: '等級不夠（需 Lv' + bf.lv + '）' };
      if (bf.controlOnly && !(typeof hasPolyRing === 'function' && hasPolyRing())) return { err: '要戴變形控制戒指' };
      f = bf;
    }
    if (!f) return { err: '還不能變成「' + name + '」' };
    if (typeof polyFormMatchesEquippedWeapon === 'function' && !polyFormMatchesEquippedWeapon(f)) return { err: '目前的武器不能用這個變身' };
    var st = typeof makePolyState === 'function' ? makePolyState(JSON.parse(JSON.stringify(f)), color || f.c || 'c-card-diamond') : Object.assign({ c: color || f.c }, JSON.parse(JSON.stringify(f)));
    return { st: st };
  };
  var apply = function (name) {
    var slot = target, a = allyOf(slot); target = null;
    try { closePolyModal(); } catch (e) {}
    if (!a) return false;
    var ctx = readSource(slot), r = null;
    try { r = asAlly(a, ctx, function () { return buildState(name); }); } catch (e) { r = { err: '變身資料讀取失敗' }; }
    if (!r || r.err) { sys('<span class="text-red-300">' + esc(nameOf(a)) + '：' + esc((r && r.err) || '無法變身') + '。</span>'); return false; }
    var paid = takeScroll();
    if (!paid) { sys('<span class="text-red-300">金幣不夠買變形卷軸（需 ' + scrollPrice().toLocaleString() + '）。</span>'); return false; }
    var dur = Math.max(1, Math.floor((DB.items.scroll_poly && DB.items.scroll_poly.dur) || 1800));
    a.buffs = a.buffs || {};
    a.poly = JSON.parse(JSON.stringify(r.st)); a.buffs.poly = dur; a._mercPolyAuto = true; a._mercPolyNoGoldWarned = false; a._afkPolyPick = name;
    try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(a); } catch (e) {}
    var wrote = false;
    if (ctx) { ctx.src.poly = JSON.parse(JSON.stringify(r.st)); ctx.src.buffs.poly = dur; ctx.src._afkPolyPick = name; wrote = writeSource(slot, ctx); }
    sys('<span class="text-emerald-300">' + esc(nameOf(a)) + ' 變身為 <span class="' + esc(r.st.c || '') + '">' + esc(r.st.n) + '</span>（花費 ' + paid + '）；到期會自動續買卷軸維持。'
      + (wrote ? '' : '（他的角色正在其他分頁開著，這次只改隊伍裡的設定）') + '</span>');
    try { saveGame(); } catch (e) {}
    try { updateUI(); } catch (e) {}
    rerender();
    return true;
  };
  var cancel = function (slot) {
    var a = allyOf(slot); if (!a) return;
    var was = a.poly && a.poly.n;
    a.poly = null; if (a.buffs) a.buffs.poly = 0; a._mercPolyAuto = false; delete a._afkPolyPick;
    try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(a); } catch (e) {}
    var ctx = readSource(slot);
    if (ctx) { ctx.src.poly = null; ctx.src.buffs.poly = 0; delete ctx.src._afkPolyPick; writeSource(slot, ctx); }
    sys('<span class="text-slate-300">' + esc(nameOf(a)) + ' 解除變身' + (was ? '（' + esc(was) + '）' : '') + '，不再自動續買卷軸。</span>');
    try { saveGame(); } catch (e) {}
    try { updateUI(); } catch (e) {}
    rerender();
  };

  // 選單按鈕呼叫 confirmPolySelect(TOKEN, 名稱) → 轉給隊員；其他照原本
  var oConfirm = W.confirmPolySelect;
  W.confirmPolySelect = function (uid, name) {
    if (uid === TOKEN) return apply(name);
    return oConfirm.apply(this, arguments);
  };
  try { (0, eval)('confirmPolySelect = window.confirmPolySelect'); } catch (e) {}
  var oClose = W.closePolyModal;
  if (typeof oClose === 'function') {
    W.closePolyModal = function () { var n = document.getElementById('afk-apoly-note'); if (n) n.remove(); return oClose.apply(this, arguments); };
    try { (0, eval)('closePolyModal = window.closePolyModal'); } catch (e) {}
  }

  W.__afkAllyPoly = { pick: pick, cancel: cancel, apply: apply, row: rowHtml, _target: function (s) { target = s == null ? null : String(s); } };
})();
