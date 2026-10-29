/* ============================================================================
 * afk-saint-cloth.js — 聖衣的光輝、雅典娜祝福、聖衣升星（玩家 2026-10-29）
 *
 *   外觀：解除封印＝有翅膀；封印型態（或失去光輝、或在副本裡）＝沒有翅膀（assets/morphanim/<聖衣>・封{,2,F}）。
 *   封印型態也能變身；30 分鐘冷卻期間不能穿任何聖衣（afk-card-ascension 原本就擋）。
 *   解除封印的效果（afk-card-combat RULES.samsaraOpen）：六項能力 +75、五屬性抗性 +250、爆擊傷害 +100%、開啟星座能力。
 *   光輝：已解除封印的聖衣，每「以解除封印的樣子穿上一次」算一次，五次之後失去光輝，回到封印型態；
 *     用「雅典娜祝福」恢復光輝（再五次）。
 *   聖衣光輝碎片：十二件聖衣都收集到（封印型態也算）後，10 張多餘的怪物鑽石卡合成 1 片。
 *   升星：5 片光輝碎片，隨機替一件聖衣升 1 星（最多 3 星）；穿著那件聖衣時，每星對最終頭目（死亡女神 席琳與冥界的使徒）
 *     造成的傷害 +10%、受到的傷害 −10%。
 *   雅典娜祝福：15 張多餘的怪物鑽石卡換 1 張。
 * 紀錄：actor.cardAscension.cloth = { <聖衣 id>: { uses: 0～5, dim: true|false } }、clothStars = { <id>: 0～3 }、clothOn（正在穿的那件）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'saintcloth', name: '聖衣光輝與升星', group: '遊戲玩法', parent: 'card-ascension',
    desc: '解除封印的聖衣穿上 5 次會失去光輝（要雅典娜祝福恢復）；收集滿聖衣後用鑽石卡合成光輝碎片替聖衣升星（對最終頭目更強）；封印型態沒有翅膀' });
  if (T && !T.enabled('saintcloth')) return;
  var A = W.AFK_CARD_ASCENSION;
  if (!A || !A.catalog || !A.catalog.samsara) { console.warn('[AFK-saint-cloth] 找不到聖衣，略過'); return; }
  var USES = 5, SHARD_COST = 10, SHARD_NEED = 5, STAR_MAX = 3, BLESS_COST = 15, STAR_PCT = 0.10;
  var SHARD = 'afk_cloth_shard', BLESS = 'afk_athena_bless';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var rows = function () { return A.catalog.samsara.filter(function (r) { return !r.unique; }); };
  var rowById = function (id) { return rows().filter(function (r) { return r.id === id; })[0] || null; };
  var nameSet = {}; rows().forEach(function (r) { nameSet[r.form.n] = r; });
  var data = function (actor) {
    var s = actor && actor.cardAscension; if (!s || typeof s !== 'object') return null;
    if (!s.cloth || typeof s.cloth !== 'object') s.cloth = {};
    if (!s.clothStars || typeof s.clothStars !== 'object') s.clothStars = {};
    return s;
  };
  var origSealed = A.sealed;
  var dim = function (id, actor) { var s = data(actor || P()); return !!(s && s.cloth[id] && s.cloth[id].dim); };
  var usesOf = function (id, actor) { var s = data(actor || P()); return s && s.cloth[id] ? Math.max(0, Number(s.cloth[id].uses) || 0) : 0; };
  var starsOf = function (id, actor) { var s = data(actor || P()); return s ? Math.max(0, Math.min(STAR_MAX, Number(s.clothStars[id]) || 0)) : 0; };
  // 失去光輝的聖衣＝封印型態（數值、星座能力、外觀全部跟著走）
  A.sealed = function (id, actor) { return origSealed.apply(this, arguments) || (rowById(id) ? (A.owned(id, actor || P()) && dim(id, actor)) : false); };
  var inDungeon = function () { var C = W.AFK_CARD_COMBAT; return !!(C && C.inDungeon && C.inDungeon()); };
  var wornRow = function (actor) { try { var r = A.active(actor); return r && r.tier === 'samsara' ? r : null; } catch (e) { return null; } };

  // ── 光輝的消耗：以解除封印的樣子穿上（換上這件）算一次 ──
  var checkWear = function () {
    var p = P(), s = data(p); if (!s) return;
    var r = wornRow(p);
    if (!r) { if (s.clothOn) s.clothOn = null; return; }
    if (s.clothOn === r.id) return;
    s.clothOn = r.id;
    if (origSealed(r.id, p) || inDungeon()) return;
    var c = s.cloth[r.id] = s.cloth[r.id] || { uses: 0, dim: false };
    if (c.dim) { sys('<span class="text-slate-300">' + esc(r.n) + ' 已經失去光輝，只能以封印的樣子穿上。用「雅典娜祝福」可以恢復。</span>'); return; }
    c.uses = (Number(c.uses) || 0) + 1;
    if (c.uses > USES) { c.dim = true; c.uses = USES; sys('<span class="text-slate-300">' + esc(r.n) + ' 的光輝耗盡了，回到封印的樣子。用「雅典娜祝福」可以恢復。</span>'); try { calcStats(); } catch (e) {} return; }
    sys('<span class="text-amber-200">' + esc(r.n) + ' 綻放光輝（解除封印 ' + c.uses + '／' + USES + ' 次' + (c.uses === USES ? '，這是最後一次' : '') + '）。</span>');
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { var t = (typeof state !== 'undefined' && state.ticks) || 0; if (t % 10 === 0) checkWear(); } catch (e) {} return r; };
  }

  // ── 外觀：封印型態沒有翅膀 ──
  if (typeof W._actorBattleForm === 'function') {
    var oForm = W._actorBattleForm;
    W._actorBattleForm = function (actor) {
      var f = oForm.apply(this, arguments);
      try {
        if (!f || typeof f.key !== 'string' || f.key.indexOf('morph:') !== 0) return f;
        var m = String(f.domKey || '').slice(6), row = nameSet[m]; if (!row) return f;
        if (!(A.sealed(row.id, actor) || inDungeon())) return f;
        var sfx = f.key.slice(6 + m.length), sm = m + '・封';
        return { key: 'morph:' + sm + sfx, domKey: 'morph:' + sm, base: 'assets/morphanim/' + encodeURIComponent(sm + sfx) + '/', wpn: f.wpn || null };
      } catch (e) { return f; }
    };
  }

  // ── 升星：對最終頭目 ──
  var finalMob = function (m) { return !!(m && (m._afkFinal || m._afkApostle)); };
  var starMult = function (actor) { var r = actor && wornRow(actor); return r ? starsOf(r.id, actor) : 0; };
  var hooked = false;   // 只包一次（之後別的外掛再包 C.damage，外層就沒有旗標了）
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function' || C.damage.__afkCloth) return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) { var v = o.apply(this, arguments); try { var k = finalMob(target) ? starMult(actor) : 0; if (k && v > 0) v = Math.floor(v * (1 + STAR_PCT * k)); } catch (e) {} return v; };
    C.damage.__afkCloth = true;
  };
  hook(); W.addEventListener('load', hook);
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { var k = finalMob(mob) ? starMult(ent) : 0; return k ? Math.max(0, 1 - STAR_PCT * k) : 1; });
  // 最終決戰的百分比招式（潮汐之嘆、擁抱…）不走受傷掛點，另外在真實傷害減免那一層扣
  var oCut = W.__afkTrueCut;
  W.__afkTrueCut = function (t, dmg) {
    var v = typeof oCut === 'function' ? oCut.apply(this, arguments) : dmg;
    try { if (typeof mapState !== 'undefined' && mapState && mapState.current === 'afk_final_sea') { var k = starMult(t); if (k) v = Math.max(1, Math.floor(v * (1 - STAR_PCT * k))); } } catch (e) {}
    return v;
  };

  // ── 道具 ──
  DB.items[SHARD] = { n: '聖衣光輝碎片', type: 'misc', p: 0, gachaWeight: 0, c: 'text-yellow-300', img: 'assets/icons/items/品質鑽石.png', noUse: true,
    d: '從十二件聖衣的光芒裡剝落的碎片。十二件聖衣都收集到後，用 ' + SHARD_COST + ' 張多餘的怪物鑽石卡合成；' + SHARD_NEED + ' 片可以隨機替一件聖衣升 1 星（最多 ' + STAR_MAX + ' 星）。在變身卡合成的「聖衣光輝」那一欄操作。' };
  DB.items[BLESS] = { n: '雅典娜祝福', type: 'misc', p: 0, gachaWeight: 0, c: 'text-amber-200', img: 'assets/icons/items/伊娃的祝福.png', eff: 'afk_athena_bless',
    d: '女神的祝福能讓黯淡的聖衣重新發光。使用後，恢復一件失去光輝的聖衣（優先恢復正在穿的那件），可以再解除封印 ' + USES + ' 次。用 ' + BLESS_COST + ' 張多餘的怪物鑽石卡換取。' };
  [SHARD, BLESS].forEach(function (id) { try { var k = miscCatKey(id, DB.items[id]); if (k && MISC_CAT_ITEMS[k] && !MISC_ITEM_CAT[id]) { MISC_CAT_ITEMS[k].push(id); MISC_ITEM_CAT[id] = k; if (typeof OBTAINABLE_MISC !== 'undefined') OBTAINABLE_MISC[id] = true; } } catch (e) {} });
  var invCount = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (n, it) { return n + (it && it.id === id && !it.lock ? (it.cnt == null ? 1 : Number(it.cnt) || 0) : 0); }, 0) : 0; };
  var take = function (id, n) { var p = P(); for (var i = 0; i < p.inv.length && n > 0; i++) { var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue; var c = it.cnt == null ? 1 : it.cnt, q = Math.min(n, c); it.cnt = c - q; n -= q; } p.inv = p.inv.filter(function (it) { return !it || it.cnt == null || it.cnt > 0; }); };
  var diamondCards = function () {
    var p = P(); if (!p) return [];
    return (p.inv || []).filter(function (it) { var d = it && DB.items[it.id]; return !!(d && d.eff === 'card' && d.cardTier === 5 && !it.lock && (it.cnt == null ? 1 : it.cnt) > 0 && A.diamondOwned(d.cardMob, p)); });
  };
  var diamondCount = function () { return diamondCards().reduce(function (n, it) { return n + (it.cnt == null ? 1 : it.cnt); }, 0); };
  var takeDiamonds = function (n) {
    if (diamondCount() < n) return false;
    diamondCards().forEach(function (it) { var c = it.cnt == null ? 1 : it.cnt, q = Math.min(n, c); it.cnt = c - q; n -= q; });
    var p = P(); p.inv = p.inv.filter(function (it) { return !it || it.cnt == null || it.cnt > 0; });
    return true;
  };
  var allCloth = function () { var p = P(); return !!p && rows().length > 0 && rows().every(function (r) { return A.owned(r.id, p); }); };
  var done = function (msg) { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} try { renderTabs(true); updateUI(); } catch (e) {} try { saveGame(); } catch (e) {} if (msg) sys(msg); redraw(); return { ok: true, msg: msg }; };
  var fail = function (msg) { sys('<span class="text-amber-300">' + msg + '</span>'); return { ok: false, msg: msg }; };
  var API = {
    craftShard: function () {
      if (!allCloth()) return fail('要先收集到十二件聖衣（封印型態也算）。');
      if (!takeDiamonds(SHARD_COST)) return fail('需要 ' + SHARD_COST + ' 張多餘的怪物鑽石卡（圖鑑已登錄、背包裡、未上鎖）。');
      gainItem(SHARD, 1, true, true);
      return done('<span class="text-yellow-300">十張鑽石卡的光芒凝成了一片聖衣光輝碎片。</span>');
    },
    lightStar: function () {
      var p = P(); if (invCount(SHARD) < SHARD_NEED) return fail('需要 ' + SHARD_NEED + ' 片聖衣光輝碎片。');
      var pool = rows().filter(function (r) { return A.owned(r.id, p) && starsOf(r.id, p) < STAR_MAX; });
      if (!pool.length) return fail('所有聖衣都已經是 ' + STAR_MAX + ' 星了。');
      take(SHARD, SHARD_NEED);
      var r = pool[Math.floor(Math.random() * pool.length)], s = data(p); s.clothStars[r.id] = starsOf(r.id, p) + 1;
      return done('<span class="text-yellow-300 font-bold">' + esc(r.n) + ' 被點亮了：' + s.clothStars[r.id] + ' 星</span><span class="text-amber-200">（穿著時對最終頭目造成的傷害 +' + s.clothStars[r.id] * 10 + '%、受到的傷害 −' + s.clothStars[r.id] * 10 + '%）。</span>');
    },
    craftBless: function () {
      if (!takeDiamonds(BLESS_COST)) return fail('需要 ' + BLESS_COST + ' 張多餘的怪物鑽石卡（圖鑑已登錄、背包裡、未上鎖）。');
      gainItem(BLESS, 1, true, true);
      return done('<span class="text-amber-200">十五張鑽石卡化為女神的祝福：得到雅典娜祝福。</span>');
    },
    bless: function (id) {
      var p = P(), s = data(p); if (!s) return fail('請先進入遊戲。');
      var dims = rows().filter(function (r) { return dim(r.id, p); }); if (!dims.length) return fail('目前沒有失去光輝的聖衣。');
      var w = wornRow(p), r = (id && rowById(id) && dim(id, p)) ? rowById(id) : (w && dim(w.id, p) ? w : dims[0]);
      if (invCount(BLESS) < 1) return fail('需要雅典娜祝福。');
      take(BLESS, 1); s.cloth[r.id] = { uses: 0, dim: false };
      if (w && w.id === r.id) s.clothOn = null;   // 正在穿的那件：下一次檢查會重新算成解除封印的第 1 次
      return done('<span class="text-amber-200 font-bold">雅典娜的祝福降臨，' + esc(r.n) + ' 恢復了光輝（可以再解除封印 ' + USES + ' 次）。</span>');
    }
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }), d = it && DB.items[it.id];
      if (d && d.eff === 'afk_athena_bless') { if (!it.lock) API.bless(); try { if (typeof closeModal === 'function') closeModal(); } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
  }

  // ── 介面：變身卡合成下方的「聖衣光輝」 ──
  var host = null;
  var panelHtml = function () {
    var p = P(); if (!p) return '';
    var list = rows().map(function (r) {
      var own = A.owned(r.id, p), se = own && origSealed(r.id, p), dm = own && dim(r.id, p), st = starsOf(r.id, p);
      var tag = !own ? '<span style="color:#7a7168">未取得</span>' : se ? '<span style="color:#fca5a5">封印</span>' : dm ? '<span style="color:#94a3b8">失去光輝</span>' : '<span style="color:#fde047">光輝 ' + (USES - usesOf(r.id, p)) + '／' + USES + '</span>';
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid #33415555"><span>' + esc(r.n) + ' ' + (st ? '<span style="color:#fde047">' + '★'.repeat(st) + '</span>' : '') + '</span>' + tag + '</div>';
    }).join('');
    var dc = diamondCount(), sh = invCount(SHARD), bl = invCount(BLESS), full = allCloth();
    var btn = function (act, label, ok) { return '<button type="button" class="btn" data-cloth-act="' + act + '"' + (ok ? '' : ' disabled') + ' style="margin:2px">' + label + '</button>'; };
    return '<section id="afk-cloth-panel" class="afk-ca-panel"><h3>聖衣光輝</h3>'
      + '<p class="afk-lore">「聖衣的光不會永遠亮著。每一次解開封印，都在消耗它的光輝。」</p>'
      + '<p>解除封印的聖衣每穿上一次（以解除封印的樣子）算一次，' + USES + ' 次後失去光輝、回到封印型態，用雅典娜祝福恢復。封印型態沒有翅膀，也能變身；冷卻中不能穿聖衣。</p>'
      + '<p>多餘的鑽石卡 ' + dc + ' 張｜聖衣光輝碎片 ' + sh + '｜雅典娜祝福 ' + bl + '</p>'
      + '<div>' + btn('shard', '合成光輝碎片（鑽石卡 ' + SHARD_COST + '）', full && dc >= SHARD_COST) + btn('star', '點亮聖衣（碎片 ' + SHARD_NEED + '）', sh >= SHARD_NEED) + btn('bless', '換雅典娜祝福（鑽石卡 ' + BLESS_COST + '）', dc >= BLESS_COST) + btn('use', '使用雅典娜祝福', bl > 0 && rows().some(function (r) { return dim(r.id, p); })) + '</div>'
      + (full ? '' : '<p style="color:#94a3b8">光輝碎片要先收集到十二件聖衣（封印型態也算）。</p>')
      + '<p style="color:#94a3b8">升星：每星對最終頭目（死亡女神 席琳與冥界的使徒）造成的傷害 +10%、受到的傷害 −10%（穿著那件聖衣時），最多 ' + STAR_MAX + ' 星。</p>'
      + '<div style="font-size:12px;margin-top:4px">' + list + '</div></section>';
  };
  var redraw = function () {
    if (!host || !host.isConnected) return;
    var old = host.querySelector('#afk-cloth-panel'); if (old) old.remove();
    host.insertAdjacentHTML('beforeend', panelHtml());
    host.querySelectorAll('[data-cloth-act]').forEach(function (b) {
      b.onclick = function () { var a = b.dataset.clothAct; if (a === 'shard') API.craftShard(); else if (a === 'star') API.lightStar(); else if (a === 'bless') API.craftBless(); else if (a === 'use') API.bless(); };
    });
  };
  var oRender = A.renderSynth;
  A.renderSynth = function (div) {
    var r = oRender.apply(this, arguments);
    try { var unlocked = P() && rows().some(function (x) { return A.owned(x.id, P()); }); if (div && unlocked) { host = div; redraw(); } } catch (e) {}
    return r;
  };
  W.__afkSaintCloth = Object.assign(API, { dim: dim, usesOf: usesOf, starsOf: starsOf, allCloth: allCloth, diamondCount: diamondCount, checkWear: checkWear, rows: rows, USES: USES, ITEMS: { shard: SHARD, bless: BLESS } });
})();
