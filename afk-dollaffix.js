/* ============================================================================
 * afk-dollaffix.js — 詞條娃娃合成（玩家 2026-10-29 20:11；外掛開關 dollaffix，預設開）
 *
 *   問題：打到的魔法娃娃會帶詞條（祝福的／昇華的祝福／至高的祝福、遠古／永恆／不朽／太初（含覺醒的、創世的）、屬性），
 *         開盒子、袋子得到的沒有詞條。原本的「魔法娃娃合成」不分有沒有詞條一起吃掉，做出來的是沒有詞條的娃娃。
 *   改成：
 *     ‧一般合成、6 階重組只用「沒有詞條」的娃娃（有詞條的不計入、不會被消耗）。
 *     ‧魔法娃娃商人另開「詞條娃娃合成」專區：
 *         放入 2 個同階、有詞條的娃娃 → 成功率 5%、沒有保底，成功得到 1 個高一階的娃娃（隨機一隻）；
 *         失敗退還其中 1 個（隨機，詞條原封不動）。
 *         成品的詞條：每一類（祝福系、遠古系、屬性）從兩個材料裡隨機挑一個來源繼承（挑到的那個沒有就沒有），
 *         但一律回到一階：昇華的祝福／至高的祝福 → 祝福的；覺醒的／創世的 → 原名；屬性 2～5 階 → 同屬性 1 階；屬性魔法星數 → 1 星。
 *         6 階不能再升（四隻六階互換請用一般的 6 階重組，只收沒有詞條的）。
 *   不改核心：包 dollTierCount／dollSynth／dollSynthAll／dollRerollT6／dollRerollT6All（執行時暫時把有詞條的娃娃當成鎖定）、
 *   包 renderCardSynth 加專區。亂數用核心的 _dollRng（跟一般合成一樣，存讀檔不會重抽）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dollaffix', name: '詞條娃娃合成', group: '遊戲玩法',
    desc: '有詞條（祝福／遠古系／屬性）的魔法娃娃不會被一般合成吃掉；魔法娃娃商人另開專區：2 個同階有詞條的娃娃 → 5% 升一階（沒有保底），詞條隨機繼承但全部回到一階' });
  if (T && !T.enabled('dollaffix')) return;
  if (typeof DB === 'undefined' || typeof W.renderCardSynth !== 'function' || typeof DOLL_BY_TIER === 'undefined') return;
  var RATE = 5, PAIR = 2;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var isDoll = function (it) { var d = it && DB.items[it.id]; return !!(d && d.doll && d.dollTier); };
  var attrOk = function (a) { try { return !!(a && typeof getAttrAffix === 'function' && getAttrAffix(a)); } catch (e) { return false; } };
  var hasAff = function (it) { return !!(it && (it.bless || it.anc || attrOk(it.attr))); };
  var rng = function (tag, seq) { try { return _dollRng(tag, seq); } catch (e) { return Math.random(); } };
  var nm = function (it) { try { return getItemFullName(it); } catch (e) { return (DB.items[it.id] || {}).n || it.id; } };

  // ── 一般合成：暫時把有詞條的娃娃當成鎖定（存檔延到結束後，鎖定旗標不會被寫進存檔）──
  var busy = 0, savePending = false;
  if (typeof W.saveGame === 'function') {
    var oSave = W.saveGame;
    W.saveGame = function () { if (busy) { savePending = true; return; } return oSave.apply(this, arguments); };
  }
  var shield = function (fn, save) {
    return function () {
      var p = P(); if (!p) return fn.apply(this, arguments);
      var marked = [];
      (p.inv || []).forEach(function (it) { if (isDoll(it) && hasAff(it) && !it.lock) { it.lock = true; marked.push(it); } });
      busy++;
      try { return fn.apply(this, arguments); }
      finally {
        marked.forEach(function (it) { it.lock = false; });
        busy--;
        if (!busy && savePending) { savePending = false; if (save !== false) { try { W.saveGame(); } catch (e) {} } }
        if (marked.length && save !== false) { try { var c = document.getElementById('interaction-content'); if (c && c.querySelector('#afk-dollaffix')) W.renderCardSynth(c); } catch (e) {} }
      }
    };
  };
  ['dollSynth', 'dollSynthAll', 'dollRerollT6', 'dollRerollT6All'].forEach(function (f) { if (typeof W[f] === 'function') W[f] = shield(W[f]); });
  if (typeof W.dollTierCount === 'function') W.dollTierCount = shield(W.dollTierCount, false);

  // ── 詞條娃娃 ──
  var units = function (tier) {
    var p = P(), out = []; if (!p) return out;
    (p.inv || []).forEach(function (it) {
      if (!isDoll(it) || it.lock || !hasAff(it) || DB.items[it.id].dollTier !== tier) return;
      var c = Math.max(0, Math.floor(Number(it.cnt == null ? 1 : it.cnt)));
      for (var k = 0; k < c; k++) out.push(it);
    });
    return out;
  };
  var count = function (tier) { return units(tier).length; };
  var snap = function (it) { var o = { id: it.id, bless: it.bless || false, anc: it.anc || false, attr: it.attr || false }; ['blessLv', 'ancLv', 'attrMagic', 'attrMagicStar'].forEach(function (k) { if (it[k] != null) o[k] = it[k]; }); return o; };
  var take = function (it) { it.cnt = (it.cnt == null ? 1 : it.cnt) - 1; };
  var clean = function () { var p = P(); p.inv = p.inv.filter(function (it) { return it.cnt == null || it.cnt > 0; }); };
  var tier1Attr = function (a) { var c = null; try { c = attrCanon(a); } catch (e) {} if (!c) return false; var base = c.replace(/\d+$/, '') + '1'; return (typeof ATTR_AFFIX !== 'undefined' && ATTR_AFFIX[base]) ? base : c; };
  var give = function (o) {   // o：{ id, bless, anc, attr, blessLv?, ancLv?, attrMagic?, attrMagicStar? }
    var p = P(), it = { id: o.id, en: 0, bless: o.bless || false, anc: o.anc || false, attr: o.attr || false, seteff: false };
    ['blessLv', 'ancLv', 'attrMagic', 'attrMagicStar'].forEach(function (k) { if (o[k] != null) it[k] = o[k]; });
    var ex = null; try { ex = p.inv.find(function (i) { return !i.gw && sameItemSig(i, it); }); } catch (e) {}
    if (ex) ex.cnt = (ex.cnt || 1) + 1;
    else p.inv.push(Object.assign({ uid: uid(), cnt: 1, lock: false, junk: false }, it));
    try { if (typeof registerEquipObtained === 'function') registerEquipObtained(o.id); } catch (e) {}
    return it;
  };
  // 成品詞條：每一類從隨機一個材料繼承，回到一階
  var inherit = function (mats, seq) {
    var a = mats[Math.floor(rng('afxB', seq) * mats.length)] || mats[0];
    var b = mats[Math.floor(rng('afxA', seq) * mats.length)] || mats[0];
    var c = mats[Math.floor(rng('afxE', seq) * mats.length)] || mats[0];
    var o = { bless: a.bless ? (a.bless === 'cursed' ? 'cursed' : true) : false, anc: b.anc || false, attr: c.attr && attrOk(c.attr) ? tier1Attr(c.attr) : false };
    if (o.attr && c.attrMagic) { o.attrMagic = c.attrMagic; o.attrMagicStar = 1; }
    return o;
  };
  var once = function (tier, seq, mats) {
    var p = P();
    if (rng('afxS', seq) * 100 < RATE) {
      var pool = DOLL_BY_TIER[tier + 1] || [];
      var pick = pool[Math.floor(rng('afxR', seq) * pool.length)] || pool[0];
      var o = inherit(mats, seq); o.id = pick;
      return { ok: true, item: give(o) };
    }
    var back = mats[Math.floor(rng('afxF', seq) * mats.length)] || mats[0];
    return { ok: false, item: give(back) };
  };
  var synth = function (tier, all) {
    var p = P(); tier = +tier; if (!p || !(tier >= 1 && tier <= 5)) return null;
    var list = units(tier), n = all ? Math.floor(list.length / PAIR) : (list.length >= PAIR ? 1 : 0);
    if (!n) { try { logSys('<span class="text-red-400 font-bold">第 ' + tier + ' 階有詞條的魔法娃娃不足 ' + PAIR + ' 個（未鎖定）。</span>'); } catch (e) {} return null; }
    if (p.dollSeq == null) p.dollSeq = 0;
    var groups = [];
    for (var g = 0; g < n; g++) { var mats = list.slice(g * PAIR, g * PAIR + PAIR); groups.push(mats.map(snap)); mats.forEach(take); }
    clean();
    var res = { tries: 0, ok: 0, made: [], back: 0 };
    groups.forEach(function (mats) { var r = once(tier, p.dollSeq++, mats); res.tries++; if (r.ok) { res.ok++; res.made.push(r.item); } else res.back++; });
    try {
      if (!all) {
        var r0 = res.made[0];
        logSys(r0 ? '<span class="text-amber-200 font-bold">🪆 詞條娃娃合成成功！</span>獲得 ' + nm(r0) + '（詞條回到一階）。'
          : '<span class="text-slate-400">🪆 詞條娃娃合成失敗…</span>退還其中 1 個。');
      } else {
        logSys('<span class="text-amber-200 font-bold">🪆 詞條娃娃全部合成完成！</span><span class="text-slate-300">第 ' + tier + ' 階每次 ' + PAIR + ' 個，共 ' + res.tries + ' 次，成功 ' + res.ok + ' 次'
          + (res.made.length ? '：' + res.made.slice(0, 6).map(nm).join('、') + (res.made.length > 6 ? ' 等' : '') : '') + '；失敗 ' + res.back + ' 次各退還 1 個。</span>');
      }
    } catch (e) {}
    try { if (typeof calcStats === 'function') calcStats(); renderTabs(true); updateUI(); W.saveGame(); } catch (e) {}
    try { var c = document.getElementById('interaction-content'); if (c) W.renderCardSynth(c); } catch (e) {}
    return res;
  };

  // ── 魔法娃娃商人：專區 ──
  var ui = { tier: 1 };
  var section = function () {
    var p = P(); if (!p) return '';
    var counts = [1, 2, 3, 4, 5].map(count), cur = counts[ui.tier - 1], can = cur >= PAIR;
    var btn = function (on, cls) { return 'btn ' + (on ? cls : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed'); };
    return '<div id="afk-dollaffix" class="px-4 pb-3 pt-2 border-t border-slate-700/60">'
      + '<div class="text-sm text-slate-300 mb-2">✨ <b>詞條娃娃合成</b> <span class="text-xs text-slate-400">（打到的娃娃帶詞條，跟開盒子得到的不一樣，請在這裡合成）</span></div>'
      + '<div class="text-xs text-amber-200/90 mb-2 space-y-1">'
      + '<div>‧有詞條（祝福的／昇華的祝福／至高的祝福、遠古／永恆／不朽／太初、屬性）的娃娃<b>不會被上面的一般合成、6 階重組吃掉</b>。</div>'
      + '<div>‧放入 <b>2 個同階、有詞條</b>的娃娃 → 成功率 <b>' + RATE + '%</b>、<b>沒有保底</b>；成功得到 1 個高一階的娃娃（隨機一隻），失敗退還其中 1 個（詞條不變）。</div>'
      + '<div>‧成品的詞條從兩個材料裡<b>隨機繼承</b>，但<b>全部回到一階</b>：昇華的祝福、至高的祝福 → 祝福的；覺醒的、創世的 → 原名；屬性 2～5 階 → 同屬性 1 階。例：4 階＋4 階成功 → 5 階娃娃，詞條都是一階。</div>'
      + '<div>‧6 階不能再升；想保留的娃娃先在背包「鎖定」。</div></div>'
      + '<div class="bg-slate-900/60 border border-slate-700 rounded p-3 text-sm space-y-2">'
      + '<div>來源階級：<span class="inline-flex gap-1 ml-1 flex-wrap">' + [1, 2, 3, 4, 5].map(function (t) { return '<button type="button" data-afx-tier="' + t + '" class="btn px-2 py-0.5 text-xs ' + (ui.tier === t ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600') + '">' + t + '階（' + counts[t - 1] + '）</button>'; }).join('') + '</span></div>'
      + '<div class="flex justify-between text-xs text-slate-400"><span>第 ' + ui.tier + ' 階有詞條可合成：<span class="' + (can ? 'text-green-400' : 'text-red-400') + ' font-bold">' + cur + '</span> 個<span class="text-slate-500">（未鎖定）</span></span><span>成功率：<b class="text-amber-300">' + RATE + '%</b>　保底：<b class="text-slate-500">無</b></span></div>'
      + '<div class="grid grid-cols-2 gap-2">'
      + '<button type="button" data-afx-go="1" class="' + btn(can, 'bg-fuchsia-800 hover:bg-fuchsia-700 border-fuchsia-500') + ' w-full py-2 text-sm font-bold"' + (can ? '' : ' disabled') + '>合成</button>'
      + '<button type="button" data-afx-go="all" class="' + btn(can, 'bg-fuchsia-900 hover:bg-fuchsia-800 border-fuchsia-500') + ' w-full py-2 text-sm font-bold"' + (can ? '' : ' disabled') + '>全部合成</button>'
      + '</div></div></div>';
  };
  var oRender = W.renderCardSynth;
  W.renderCardSynth = function (div) {
    var r = oRender.apply(this, arguments);
    try {
      if (!div) return r;
      var old = div.querySelector('#afk-dollaffix'); if (old) old.remove();
      var box = document.createElement('div'); box.innerHTML = section(); var el = box.firstChild; if (!el) return r;
      var anchor = null;
      Array.prototype.forEach.call(div.querySelectorAll('div'), function (d) { if (!anchor && d.parentNode && /魔法娃娃合成/.test(d.textContent || '') && /6 階重組/.test(d.textContent || '') === false && d.querySelector('[onclick^="dollSynthAll"]')) anchor = d; });
      while (anchor && anchor.parentNode && anchor.parentNode !== div && div.contains(anchor.parentNode)) anchor = anchor.parentNode;
      if (anchor && anchor.parentNode === div) {
        var after = anchor.nextElementSibling;   // 6 階重組那塊
        if (after && /6 階重組/.test(after.textContent || '')) anchor = after;
        anchor.insertAdjacentElement('afterend', el);
      } else div.appendChild(el);
      if (!div.__afkAfxBound) {
        div.__afkAfxBound = true;
        div.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-afx-tier],[data-afx-go]'); if (!b || b.disabled || !div.querySelector('#afk-dollaffix')) return;
          if (b.hasAttribute('data-afx-tier')) { ui.tier = +b.getAttribute('data-afx-tier'); W.renderCardSynth(div); return; }
          synth(ui.tier, b.getAttribute('data-afx-go') === 'all');
        });
      }
    } catch (e) { console.warn('[AFK-dollaffix] ui', e); }
    return r;
  };
  W.__afkDollAffix = { RATE: RATE, PAIR: PAIR, hasAff: hasAff, count: count, synth: synth, inherit: inherit, tier1Attr: tier1Attr };
})();
