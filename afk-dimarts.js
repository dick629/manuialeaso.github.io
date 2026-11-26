/* ============================================================================
 * afk-dimarts.js — 次元藝能（次元精通；Ping 11-18，設計稿 Projects claude/dim-arts-design.md v2）
 *
 *   席琳神殿「藝能的守門人」：
 *     ‧入場六個單人副本（副本本體在 afk-riftdungeons 的 art_*；六種材料各 50 個（11-18 由 100 降））→ 打倒「你的倒影」必掉失落的次元藝能
 *     ‧解放：失落的次元藝能 1＋次元精華 10＋次元至暗星塵 5（每個角色永久）
 *     ‧升星：同名失落的次元藝能 ★1 3、★2 5、★3 8，另付次元精華 10＋次元至暗星塵 5；效果 ×1.25／×1.5／×2
 *     ‧次元精通欄：第一格 解命石 5,000、第二格 破空石 5,000；最多兩格、不能放同一個；村莊免費切換
 *     ‧兌換：地獄精華 100 → 次元精華 1；至暗星塵 50 → 次元至暗星塵 1
 *   只算你本人（傭兵沒有）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, K = W.__afkNpcKit;
  if (typeof DB === 'undefined' || !DB.items || !K) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var now = function () { return Number(S().ticks) || 0; };
  var esc = K.esc || function (s) { return String(s); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, 'player-special'); } catch (e) {} };
  var cnt = function (id) { try { return typeof questCountId === 'function' ? questCountId(id) : 0; } catch (e) { return 0; } };
  var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
  var nm = function (id) { return (DB.items[id] && DB.items[id].n) || id; };

  var ART = {
    horn: { n: '號角', perm: '造成的傷害 +12%', act: '每 45 秒吹響號角：15 秒內全隊造成的傷害 +25%、你的攻擊速度 +15%' },
    light: { n: '殘光', perm: '受到的傷害 −15%、受到的治療 +30%', act: '每 45 秒清除光蝕 5 層；次元裂縫裡侵蝕扣血每秒少 1.5%' },
    ember: { n: '熾燼', perm: '對燃燒中的目標傷害 +15%', act: '命中時 20% 點燃（每秒該次傷害 25%，6 秒，最多疊 3 層）' },
    ink: { n: '深淵墨', perm: '對有減益的目標傷害 +15%', act: '命中時 15% 讓目標中墨汁（造成的傷害 −40%、受到的傷害 +10%，6 秒）；受到中墨汁的敵人傷害再 −20%' },
    sea: { n: '海神', perm: '火水風地抗性各 +150、受到的魔法傷害與屬性傷害 −20%', act: '武器屬性詞綴給的額外傷害 +60%；次元裂縫裡抗性被侵蝕時最低保留 +200' },
    hardin: { n: '哈汀', perm: '技能傷害 +30%、施法間隔 −15%', act: '每 15 秒下一個攻擊技能傷害 ×3' }
  };
  var KEYS = Object.keys(ART), MULT = [1, 1.3, 1.6, 2.2]   /* 11-18 20:30：兩格 ★3 目標曲線 155（原 1.25／1.5／2） */, STAR_NEED = [0, 3, 5, 8];
  var ESS = 'afk_dim_essence', STD = 'afk_dim_stardust', SLOT_COST = [['afk_fate_unlock', 5000], ['afk_void_stone', 5000]];
  // ── 道具 ──
  var item = function (id, n, c, d) { if (!DB.items[id]) DB.items[id] = { n: n, type: 'etc', p: 0, gachaWeight: 0, weight: 0, noUse: true, noSell: true, c: c, img: 'assets/icons/items/原石碎片.png', d: d }; };
  item(ESS, '次元精華', 'text-fuchsia-300', '把一百份地獄精華熬成一滴的次元精華。解放、升星次元藝能要用（席琳神殿「藝能的守門人」用地獄精華 100 換 1）。');
  item(STD, '次元至暗星塵', 'text-violet-300', '比至暗星塵更暗的塵。解放、升星次元藝能要用（席琳神殿「藝能的守門人」用至暗星塵 50 換 1）。');
  KEYS.forEach(function (k) { item('afk_art_' + k, '失落的次元藝能・' + ART[k].n, 'text-cyan-200', '在藝能賦予副本裡從你的倒影身上取回的藝能。常駐：' + ART[k].perm + '；' + ART[k].act + '。交給席琳神殿「藝能的守門人」解放（再加次元精華 10、次元至暗星塵 5）；同名的可以拿來升星。'); });

  // ── 資料 ──
  var rec = function (p) { p = p || P(); if (!p) return null; var r = p.afkArts; if (!r || typeof r !== 'object') r = p.afkArts = { un: {}, slot: [null, null], open: 0 }; r.un = r.un || {}; r.slot = r.slot || [null, null]; return r; };
  var act = function (p, k) { var r = p && p.afkArts; if (!r || !r.slot) return 0; for (var i = 0; i < Math.min(2, r.open || 0); i++) if (r.slot[i] === k && r.un[k] != null) return MULT[r.un[k]] || 1; return 0; };   // 回傳倍數（0＝沒裝）

  // ── 動作 ──
  var A = {
    swap: function (kind) {
      if (kind === 'ess') { if (cnt('afk_hell_essence') < 100) return '地獄精華不夠 100 個。'; take('afk_hell_essence', 100); gainItem(ESS, 1, true, true); return null; }
      if (cnt('afk_dark_stardust') < 50) return '至暗星塵不夠 50 個。'; take('afk_dark_stardust', 50); gainItem(STD, 1, true, true); return null;
    },
    unlock: function (k) {
      var r = rec(); if (!ART[k]) return '沒有這個藝能。'; if (r.un[k] != null) return '已經解放了。';
      if (cnt('afk_art_' + k) < 1 || cnt(ESS) < 10 || cnt(STD) < 5) return '需要失落的次元藝能・' + ART[k].n + ' 1、次元精華 10、次元至暗星塵 5。';
      take('afk_art_' + k, 1); take(ESS, 10); take(STD, 5); r.un[k] = 0; sys('<span class="text-cyan-200 font-bold">次元藝能「' + ART[k].n + '」解放了。</span>'); return null;
    },
    star: function (k) {
      var r = rec(), s = r.un[k]; if (s == null) return '先解放。'; if (s >= 3) return '已經是 ★3。';
      var need = STAR_NEED[s + 1]; if (cnt('afk_art_' + k) < need || cnt(ESS) < 10 || cnt(STD) < 5) return '需要失落的次元藝能・' + ART[k].n + ' ' + need + '、次元精華 10、次元至暗星塵 5。';
      take('afk_art_' + k, need); take(ESS, 10); take(STD, 5); r.un[k] = s + 1; sys('<span class="text-cyan-200 font-bold">次元藝能「' + ART[k].n + '」升到 ★' + (s + 1) + '。</span>'); try { calcStats(); } catch (e) {} return null;
    },
    open: function () {
      var r = rec(), i = r.open || 0; if (i >= 2) return '已經開滿兩格。'; var c = SLOT_COST[i];
      if (cnt(c[0]) < c[1]) return '需要' + nm(c[0]) + ' ' + c[1].toLocaleString() + '。'; take(c[0], c[1]); r.open = i + 1; return null;
    },
    set: function (i, k) {
      var r = rec(); if (!(i >= 0 && i < (r.open || 0))) return '這一格還沒開。';
      if (typeof mapState !== 'undefined' && !/^town_/.test(String(mapState.current || ''))) return '只能在村莊切換。';
      if (k && r.un[k] == null) return '還沒解放。'; if (k && r.slot[1 - i] === k) return '兩格不能放同一個。';
      r.slot[i] = k || null; try { calcStats(); } catch (e) {} return null;
    }
  };

  // ── 介面（席琳神殿「藝能的守門人」）──
  var NPC = 'npc_afk_artgate', NPC_N = '藝能的守門人';
  var render = function (div) {
    if (!div) return; var p = P(), r = rec(p); if (!r) return; var RD = W.__afkRiftDg, K = W.__afkNpcKit;
    if (!K) return;
    // 11-18 Ping「介面改一下 讓他跟其他 npc 介面相同」：改用裂縫之門同一套列（名稱、說明、需求、右側按鈕）
    K.css();
    var h = '<div class="afk-ax"><div class="ax-lore">「你在裂縫裡丟掉的東西，有些會變成你自己的樣子，在這裡等你。」</div>';
    h += '<div class="ax-h">次元精通欄</div>';
    [0, 1].forEach(function (i) {
      var opened = i < (r.open || 0), c = SLOT_COST[i];
      h += K.rowHtml({ key: 'slot' + i, name: '第 ' + (i + 1) + ' 格' + (opened ? '：' + (r.slot[i] ? esc(ART[r.slot[i]].n) + '　<span style="color:#86efac">★' + (r.un[r.slot[i]] || 0) + '</span>' : '<span style="color:#94a3b8">空</span>') : '　<span style="color:#94a3b8">未開</span>'),
        color: '#fde68a', note: opened ? '只算你本人；在村莊裡免費切換。' : '開啟：' + nm(c[0]) + ' ' + c[1].toLocaleString() + '（持有 ' + cnt(c[0]).toLocaleString() + '）',
        why: !opened && i > (r.open || 0) ? '先開第 ' + i + ' 格' : '', btns: opened ? (r.slot[i] ? [['set:' + i + ':', '拿下', true]] : []) : [['open', '開啟', cnt(c[0]) >= c[1]]] }, 'data-art');
    });
    h += '<div class="ax-h">次元藝能</div>';
    KEYS.forEach(function (k) {
      var a = ART[k], s = r.un[k], d = RD && RD.BYID['art_' + k], why = d && RD.canEnter ? RD.canEnter(d) : '';
      var res = (function () { var R2 = W.__afkArtRes, L = R2 ? R2.txt(p, k) : []; return L.map(function (x) { return '<br><span style="color:#67e8f9">職業共鳴・' + esc(x.cls) + '「' + esc(x.n) + '」' + (x.k !== 1 ? '（×' + x.k + '）' : '') + '：</span>' + esc(x.d); }).join(''); })();
      var btns = [['go:' + k, '進入', !why, why]];
      if (s == null) btns.push(['unlock:' + k, '解放', true]); else if (s < 3) btns.push(['star:' + k, '升到 ★' + (s + 1), true]);
      if (s != null) [0, 1].filter(function (i) { return i < (r.open || 0); }).forEach(function (i) { btns.push(['set:' + i + ':' + (r.slot[i] === k ? '' : k), r.slot[i] === k ? '拿下第 ' + (i + 1) + ' 格' : '放第 ' + (i + 1) + ' 格', true]); });
      h += K.rowHtml({ key: 'art' + k, name: esc(a.n) + (s != null ? '　<span style="color:#86efac">★' + s + '</span>' : '　<span style="color:#94a3b8">未解放</span>'), color: '#67e8f9',
        desc: '常駐：' + a.perm + '<br>主動：' + a.act + res,
        note: '副本「' + (d ? esc(d.n) : '') + '」入場：' + (d ? nm(d.fee.items[0][0]) + ' ×' + d.fee.items[0][1] : '') + '　失落的次元藝能・' + a.n + '：' + cnt('afk_art_' + k) + (s == null ? '（解放要 1）' : s < 3 ? '（★' + (s + 1) + ' 要 ' + STAR_NEED[s + 1] + '）' : ''),
        btns: btns }, 'data-art');
    });
    h += '<div class="ax-h">材料交換</div>';
    h += K.rowHtml({ key: 'swess', name: '次元精華', color: '#fde68a', note: '地獄精華 100 → 次元精華 1（持有 ' + cnt('afk_hell_essence').toLocaleString() + '／' + cnt(ESS).toLocaleString() + '）', btns: [['swap:ess', '交換', true]] }, 'data-art');
    h += K.rowHtml({ key: 'swstd', name: '次元至暗星塵', color: '#fde68a', note: '至暗星塵 50 → 次元至暗星塵 1（持有 ' + cnt('afk_dark_stardust').toLocaleString() + '／' + cnt(STD).toLocaleString() + '）', btns: [['swap:std', '交換', true]] }, 'data-art');
    h += '</div>';
    var top = div.scrollTop; div.innerHTML = h; div.scrollTop = top;
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-art]'); if (!b) return;
    var a = String(b.dataset.art).split(':'), err = null;
    if (a[0] === 'go') { if (W.__afkRiftDg) W.__afkRiftDg.enter('art_' + a[1]); return; }
    if (a[0] === 'swap') err = A.swap(a[1]); else if (a[0] === 'unlock') err = A.unlock(a[1]); else if (a[0] === 'star') err = A.star(a[1]); else if (a[0] === 'open') err = A.open(); else if (a[0] === 'set') err = A.set(Number(a[1]), a[2] || null);
    if (err) sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(err) + '</span>');
    try { render(document.getElementById('interaction-content')); } catch (e2) {}
  }, true);
  var addNpc = function () { try { var tw = DB.towns && DB.towns.town_sherine; if (!tw || (tw.npcs || []).some(function (x) { return x && x.id === NPC; })) return; K.addNpc('town_sherine', { id: NPC, n: NPC_N, title: '次元藝能', type: 'quest', classicHide: true, d: '六個藝能賦予副本的入口；解放、升星次元藝能，開次元精通欄。' }); if (K.hookNpc && !addNpc.h) { addNpc.h = 1; K.hookNpc(NPC, NPC_N, '次元藝能', render); } } catch (e) {} };
  addNpc(); W.addEventListener('load', function () { addNpc(); setTimeout(addNpc, 2000); });

  // ── 效果 ──
  // 11-19 01:47 Ping「偏低的黑暗妖精、暗黑騎士、幻術士 可以提升 約比最強的弱 0.9」：裝著次元藝能時，這三個職業自己的出手傷害 ×CF（實測校正）
  var CF = { dark: 1, darkknight: 1, illusion: 1 };
  var anyArt = function (p) { var r = p && p.afkArts; if (!r || !r.slot) return false; for (var i = 0; i < r.slot.length; i++) if (r.slot[i] && act(p, r.slot[i])) return true; return false; };
  var B = { horn: 0, hornCd: 0, lightCd: 0, hardinCd: 0, hardin: false };
  var debuffed = function (m) { if (!m) return false; var t = now(); if ((m._dimInk || 0) > t || (m._artBurn && m._artBurn.until > t) || (m._dimBurn && m._dimBurn.until > t)) return true; var st = m.st || {}; return Object.keys(st).some(function (k) { return Number(st[k]) > 0 && k !== 'mrhalf'; }); };
  var hookOut = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkArts) return; C.__afkArts = true;
    var o = C.damage, depth = 0;
    C.damage = function (actor, target, amount, opt) {
      if (depth > 0) return o.apply(this, arguments);   // 巢狀（追擊、連鎖、觸發）不再乘一次
      depth++; try { return outerD.apply(this, arguments); } finally { depth--; }
    };
    var outerD = function (actor, target, amount, opt) {
      var p = P();
      try {
        if (p && amount > 0 && target && !target._isAlly && target !== p && !(target.cls && target.eq)) {
          var t = now();
          if (actor === p) {
            var mul = 1, m;
            if ((m = act(p, 'horn'))) mul += 0.12 * m;
            if ((m = act(p, 'ember')) && ((target._artBurn && target._artBurn.until > t) || (target._dimBurn && target._dimBurn.until > t))) mul += 0.15 * m;
            if ((m = act(p, 'ink')) && debuffed(target)) mul += 0.15 * m;
            var skill = opt && !opt.packet && (opt.kind === 'magic' || opt.kind === 'mag' || opt.skillId);
            if ((m = act(p, 'hardin')) && skill) { mul += 0.30 * m; if (B.hardin) { B.hardin = false; mul *= 3; clog('<span class="font-bold" style="color:#a78bfa">【哈汀】</span>這一招 ×3。'); } }
            if ((target._artInk || 0) > t) mul += 0.10;
            var cf = CF[p.cls]; if (cf && cf !== 1 && anyArt(p)) mul *= cf;   // 11-19 Ping：偏低職業的藝能補正
            amount *= mul;
          }
          if (B.horn > t && (actor === p || (p.allies || []).indexOf(actor) >= 0) && act(p, 'horn')) amount *= 1 + 0.25 * act(p, 'horn');
        }
      } catch (e) {}
      var r = o.call(this, actor, target, amount, opt);
      try {
        if (p && actor === p && r > 0 && target && !target._isAlly && !(opt && opt._dimNested)) {
          var t2 = now(), m2;
          if ((m2 = act(p, 'ember')) && Math.random() < 0.20) { var b = target._artBurn && target._artBurn.until > t2 ? target._artBurn : (target._artBurn = { n: 0, per: 0, until: 0 }); b.n = Math.min(3, b.n + 1); var cap = 0; try { cap = W.__afkArtRes && W.__afkArtRes.S.ema > 0 ? W.__afkArtRes.S.ema * 2 : 0; } catch (e8) {} b.per = Math.max(b.per, (cap > 0 ? Math.min(r, cap) : r) * 0.25 * m2);   /* 11-18 21:04 調到兩格 ★3 ≈ ×3：50%／5 層 → 25%／3 層；燃燒以「那一擊」算，但一擊最多算平均傷害的 2 倍（大招、觸發魔法不會讓燃燒爆掉） */ b.until = t2 + 60; }
          if ((m2 = act(p, 'ink')) && Math.random() < 0.15) { target._dimInk = t2 + 60; target._dimInkK = Math.max(target._dimInkK || 0, 0.4); target._artInk = t2 + 60; }
        }
      } catch (e) {}
      return r;
    };
  };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    var p = P(); if (!p || ent !== p) return 1; var k = 1, m;
    if ((m = act(p, 'light'))) k -= 0.15 * m;
    if ((m = act(p, 'ink')) && mob && (mob._dimInk || 0) > now()) k -= 0.20 * m;
    return Math.max(0, k);
  });
  var hookIn = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.incoming !== 'function' || R.__afkArts) return; R.__afkArts = true;
    var o = R.incoming;
    R.incoming = function (target, damage, attacker, opts) { var out = o.apply(this, arguments); try { var p = P(), m; if (p && target === p && typeof out === 'number' && (m = act(p, 'sea')) && opts && /mag/.test(String(opts.kind || opts.type || ''))) out *= 1 - Math.min(0.9, 0.20 * m); } catch (e) {} return out; };
  };
  if (typeof W.foulWaterHealMult === 'function') {
    var oF = W.foulWaterHealMult;
    W.foulWaterHealMult = function (t) { var v = oF.apply(this, arguments); try { var m; if (t === P() && (m = act(t, 'light'))) v *= 1 + 0.30 * m; } catch (e) {} return v; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  if (typeof W.recomputeStats === 'function') {
    var oR = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oR.apply(this, arguments);
      try {
        var p = P(), m; if (!p || !p.d) return r;
        if ((m = act(p, 'sea'))) {
          ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + Math.round(150 * m); });
          var ad = 0; try { ['wpn', 'offwpn'].forEach(function (sl) { var e = p.eq && p.eq[sl], a = e && typeof getAttrAffix === 'function' ? getAttrAffix(e.attr) : null; if (a) ad += Number(a.dmg) || 0; }); } catch (e3) {}
          if (ad > 0) p.d.extraDmg = (Number(p.d.extraDmg) || 0) + Math.round(ad * 0.6 * m);   // 屬性段（屬性詞綴的額外傷害）+50%
        }
        if ((m = act(p, 'horn')) && B.horn > now()) { var o0 = Number(p.d.atkSpdPct) || 0, add = 15 * m; p.d.atkSpdPct = o0 + add; if (p.d.aspd > 0) p.d.aspd *= (1 + o0 / 100) / (1 + (o0 + add) / 100); }
      } catch (e) {}
      return r;
    };
  }
  // 施法間隔（哈汀）：走新特效引擎的「施法速度」
  var regNew = function () { if (regNew.done || !W.__afkNewFx || !W.__afkNewFx.add) return; regNew.done = true; W.__afkNewFx.add(function (ent) { var m = act(ent, 'hardin'); return m && ent === P() ? [['cast', 0.15 * m]] : []; }); };
  regNew(); W.addEventListener('load', regNew);
  // 次元裂縫：侵蝕扣血減免（殘光）、抗性最低保留（海神）
  var riftHook = function () {
    var DR = W.__afkDimRift; if (!DR || !DR.REDUCE || DR.REDUCE.__afkArts) return; DR.REDUCE.__afkArts = true;
    var st = function (p) { var r = p && p.afkArts; return r && r.un ? r.un.light : null; };
    DR.REDUCE.push(['次元藝能・殘光', 1.5, function (p) { return act(p, 'light') > 0; }]);
    DR.REDUCE.push(['次元藝能・殘光★1', 0.45, function (p) { return act(p, 'light') > 0 && st(p) >= 1; }]);
    DR.REDUCE.push(['次元藝能・殘光★2', 0.45, function (p) { return act(p, 'light') > 0 && st(p) >= 2; }]);
    DR.REDUCE.push(['次元藝能・殘光★3', 0.9, function (p) { return act(p, 'light') > 0 && st(p) >= 3; }]);
  };
  W.addEventListener('load', riftHook); setTimeout(riftHook, 3000);
  var oFloor = W.__afkEroFloorEle;
  W.__afkSeaEleCut = function (ent) { try { var m = ent === P() ? act(ent, 'sea') : 0; return m ? Math.min(0.9, 0.20 * m) : 0; } catch (e) { return 0; } };   // 受到的屬性傷害 −15%（afk-mobmagic 的屬性段用）
  W.__afkEroFloorEle = function (p, k) { var v = 0; try { v = typeof oFloor === 'function' ? Number(oFloor(p, k)) || 0 : 0; var m = act(p, 'sea'); if (m && /^res(Fire|Water|Wind|Earth)$/.test(k)) v += 200 * m; } catch (e) {} return v; };
  // 每秒：號角、殘光、熾燼燃燒、哈汀
  if (typeof W.tick === 'function') {
    var oT = W.tick;
    W.tick = function () {
      var t0 = now(), r = oT.apply(this, arguments);
      try {
        var t = now(), p = P(); if (!p || p.dead || t === t0 || t % 10) return r;
        var fight = (typeof mapState !== 'undefined' && !/^town_/.test(String(mapState.current || ''))) && (mapState.mobs || []).some(function (m) { return m && !m._dead && m.curHp > 0; });
        if (act(p, 'horn') && fight && t >= B.hornCd) { B.hornCd = t + 450; B.horn = t + 150; try { if (W.__afkArtsHorn) W.__afkArtsHorn(p, t); } catch (e9) {} try { calcStats(); } catch (e) {} setTimeout(function () { try { calcStats(); } catch (e) {} }, 15100); clog('<span class="font-bold" style="color:#fbbf24">【號角】</span>15 秒內全隊造成的傷害 +' + Math.round(25 * act(p, 'horn')) + '%。'); }
        if (act(p, 'light') && t >= B.lightCd) { B.lightCd = t + 450; var dr = p.afkDimRift; if (dr && dr.light > 0) { dr.light = Math.max(0, dr.light - 5); try { calcStats(); } catch (e) {} } }
        if (act(p, 'hardin') && !B.hardin && t >= B.hardinCd) { B.hardin = true; B.hardinCd = t + 150; }
        (mapState.mobs || []).forEach(function (m, i) {
          var b = m && !m._dead && m.curHp > 0 && m._artBurn; if (!b || b.until <= t) return;
          var d = Math.floor(b.per * b.n); if (d <= 0) return;
          try { var C = W.AFK_CARD_COMBAT; if (C) d = Math.floor(C.damage(p, m, d, { kind: 'magic', _dimNested: true })) || d; } catch (e) {}
          m.curHp -= d; if (m.curHp <= 0 && typeof killMob === 'function') killMob(i);
        });
      } catch (e) {}
      return r;
    };
  }
  var hookAll = function () { hookOut(); hookIn(); };
  hookAll(); W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); });
  W.__afkDimArts = { ART: ART, act: act, rec: rec, A: A, render: render, B: B, MULT: MULT, CF: CF };
})();
