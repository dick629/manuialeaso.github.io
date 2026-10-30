/* ============================================================================
 * afk-lore-kit.js — 劇情任務線與新 Boss 的共用工具（玩家 2026-10-29；企劃 docs/lore-expansion-plan.md）
 *
 *   W.__afkLore.defineLine(line)：一條劇情任務線（沿用試煉接取制 TRIAL_Q：達等級接取 → 指定怪 100% 掉任務道具 → 一次交付）
 *     line = { id, name, hostIds:[npcId…]（掛在現有 NPC 下面）, hostN, intro, outro, chapters:[{
 *       lv, title, story, map,
 *       reqs:[{ id, n, img, d, need, mobs:[怪物名…] }…],
 *       rewards:{ all:[物品 id…], royal:[…], knight:[…] … }（交付時每件給 1 個）,
 *       first:[[物品 id 或 'gold', 數量]…]（第一次完成另外給）
 *     }…] }
 *     每章每職業一份 TRIAL_Q（key＝afkL_<line>_<章>_<職業>），要照順序；任務道具不能存倉庫。
 *   W.__afkLore.addItem(id, def)、addMob(id, def, animFrom)、aliasAnim(新名, 原名)
 *   W.__afkLore.defineSet({ ids, name, tiers:[[件數, { mhp, mmp, extraDmg, extraHit, mr, ac, dr, er, hpR, mpR, mdmg }]…] })
 *   W.__afkLore.boss：summon(怪 id, 數量, opt)、hurt(目標, 傷害)、party()、royals()
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs || typeof TRIAL_Q === 'undefined') { console.warn('[AFK-lore-kit] 缺少任務系統，略過'); return; }
  var CLASSES = ['knight', 'mage', 'elf', 'dark', 'illusion', 'warrior', 'dragon', 'royal'];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };

  // ── 物品、怪物 ──
  var addItem = function (id, def) {
    if (DB.items[id]) return DB.items[id];
    var d = Object.assign({ p: 0, gachaWeight: 0, weight: 0 }, def);
    DB.items[id] = d;
    return d;
  };
  var GET = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
  var aliasAnim = function (n, src) {
    try {
      var names = GET('MOB_ANIM_NAMES'); if (!names || !names.has(src)) return false;
      var target = (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[src]) || src;
      if (typeof MOB_ANIM_ALIAS !== 'undefined') MOB_ANIM_ALIAS[n] = target;
      ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(GET).forEach(function (s) { if (s && s.has && s.has(src)) s.add(n); });
      ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(GET).forEach(function (o) { if (o && o[src] != null && o[n] == null) o[n] = o[src]; });
      return true;
    } catch (e) { return false; }
  };
  var addMob = function (id, def, animFrom) {
    if (!DB.mobs[id]) DB.mobs[id] = def;
    var src = animFrom && Object.keys(DB.mobs).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && m.n === animFrom; })[0];
    if (src && !DB.mobs[id].img && src.img) DB.mobs[id].img = src.img;
    if (animFrom) aliasAnim(DB.mobs[id].n, animFrom);
    return DB.mobs[id];
  };

  // ── 套裝 ──
  var sets = [];
  var defineSet = function (s) { sets.push(s); };
  var countOf = function (p, ids) { var n = 0; Object.keys((p && p.eq) || {}).forEach(function (k) { var it = p.eq[k]; if (it && ids.indexOf(it.id) >= 0) n++; }); return n; };
  var bonusOf = function (p) {
    var out = {};
    sets.forEach(function (s) { var n = countOf(p, s.ids); s.tiers.forEach(function (t) { if (n >= t[0]) Object.keys(t[1]).forEach(function (k) { out[k] = (out[k] || 0) + t[1][k]; }); }); });
    return out;
  };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { var b = bonusOf(p); if (b.mhp) p.mhp = (p.mhp || 0) + b.mhp; if (b.mmp) p.mmp = (p.mmp || 0) + b.mmp; });
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(); if (p && p.d && sets.length) { var b = bonusOf(p); ['extraDmg', 'extraHit', 'mr', 'dr', 'er', 'hpR', 'mpR'].forEach(function (k) { if (b[k]) p.d[k] = (p.d[k] || 0) + b[k]; }); if (b.ac) p.d.ac = (p.d.ac || 0) - b.ac; if (b.mdmg) p.d.magicDmg = (p.d.magicDmg || 0) + b.mdmg; } } catch (e) {}
      return r;
    };
  }

  // ── 劇情任務線 ──
  var LINES = {}, KEYS = {};   // KEYS[key] = { line, i }
  var keyOf = function (line, i, cls) { return 'afkL_' + line.id + '_' + (i + 1) + '_' + cls; };
  var prevDone = function (line, i, p) { return i === 0 || trialQStateFor(p, keyOf(line, i - 1, p.cls)) === 2; };
  var defineLine = function (line) {
    LINES[line.id] = line;
    line.chapters.forEach(function (ch, i) {
      ch.reqs.forEach(function (q) {
        addItem(q.id, { n: q.n, type: 'etc', c: 'text-amber-300', img: q.img || 'assets/icons/items/古代的卷軸.png', noUse: true, noSell: true, questItem: true,
          d: q.d + '（劇情「' + line.name + '」第 ' + (i + 1) + ' 章任務道具）' });
        try { if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(q.id) < 0) WH_NO_STORE.push(q.id); } catch (e) {}
        try { if (typeof TRIAL_ITEM_CLASS !== 'undefined') TRIAL_ITEM_CLASS[q.id] = CLASSES.slice(); } catch (e) {}
        try { if (typeof MOB_DROPS !== 'undefined') (q.mobs || []).forEach(function (mn) { MOB_DROPS[mn] = MOB_DROPS[mn] || []; if (!MOB_DROPS[mn].some(function (x) { return x[0] === q.id; })) MOB_DROPS[mn].push([q.id, 1]); }); } catch (e) {}
      });
      CLASSES.forEach(function (cls) {
        var k = keyOf(line, i, cls); KEYS[k] = { line: line, i: i };
        if (TRIAL_Q[k]) return;
        var rw = ((ch.rewards && ch.rewards.all) || []).concat((ch.rewards && ch.rewards[cls]) || []).filter(function (id) { return !!DB.items[id]; });
        TRIAL_Q[k] = { cls: cls, lv: ch.lv, npc: line.hostN, reqs: ch.reqs.map(function (q) { return [q.id, q.need]; }), rewards: rw, afkLore: line.id };
        ch.reqs.forEach(function (q) { try { var L = (TRIAL_ITEM_Q[q.id] = TRIAL_ITEM_Q[q.id] || []); if (L.indexOf(k) < 0) L.push(k); } catch (e) {} });
      });
    });
    var rr = 'afkLoreRender_' + line.id;
    W[rr] = function (div) { render(line, div); };
    return line;
  };
  var html = function (line, p) {
    var rr = 'afkLoreRender_' + line.id;
    var h = '<div id="afk-lore-' + line.id + '" class="mt-3 text-sm space-y-2"><div class="font-bold" style="color:#fca5a5">📜 劇情「' + esc(line.name) + '」</div>'
      + (line.intro ? '<div class="text-slate-300 text-xs">' + line.intro + '</div>' : '');
    line.chapters.forEach(function (ch, i) {
      var k = keyOf(line, i, p.cls), st = trialQStateFor(p, k);
      h += '<div class="p-2 rounded border border-slate-700 bg-slate-900/40"><div class="font-bold text-amber-300">' + esc(line.name) + ' ' + (i + 1) + '／' + line.chapters.length + '・' + esc(ch.title) + '（Lv' + ch.lv + '）</div>'
        + '<div class="text-xs text-slate-400 my-1">' + ch.story + '</div>'
        + '<div class="text-xs text-slate-400 mb-1">地點：' + esc(ch.map) + '</div>'
        + (ch.first && ch.first.length ? '<div class="text-xs text-slate-400 mb-1">第一次完成另送：' + ch.first.map(function (x) { return (x[0] === 'gold' ? '金幣' : (DB.items[x[0]] || {}).n) + ' ×' + Number(x[1]).toLocaleString(); }).join('、') + '</div>' : '');
      if (st !== 2 && !prevDone(line, i, p)) h += '<div class="text-xs text-slate-500">完成「' + esc(line.chapters[i - 1].title) + '」後才能接取。</div></div>';
      else h += (typeof trialQHTML === 'function' ? trialQHTML(k, rr).replace(/⚔️ \d+ 級試煉/, '任務進度').replace(/接取試煉任務/g, '接取任務').replace(/完成試煉（獲得全部獎勵）/g, '交付任務（獲得全部獎勵）').replace(/試煉/g, '任務') : '') + '</div>';
    });
    if (line.outro && line.chapters.every(function (ch, i) { return trialQStateFor(p, keyOf(line, i, p.cls)) === 2; })) h += '<div class="text-xs text-fuchsia-300">' + line.outro + '</div>';
    return h + '</div>';
  };
  var render = function (line, div) {
    var p = P(); if (!p || !div) return;
    var old = div.querySelector('#afk-lore-' + line.id), box = document.createElement('div'); box.innerHTML = html(line, p);
    if (old) old.replaceWith(box.firstChild); else div.appendChild(box.firstChild);
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        var div = document.getElementById('interaction-content'); if (!div) return r;
        Object.keys(LINES).forEach(function (id) { var L = LINES[id]; if ((L.hostIds || []).indexOf(npcId) >= 0) { if (L.own === npcId && !div.querySelector('#afk-lore-' + id)) div.innerHTML = ''; render(L, div); } });
      } catch (e) { console.warn('[AFK-lore-kit] ui', e); }
      return r;
    };
  }
  if (typeof W.trialQAccept === 'function') {
    var oAcc = W.trialQAccept;
    W.trialQAccept = function (key) {
      var x = KEYS[key], p = P();
      if (x && p && !prevDone(x.line, x.i, p)) { sys('<span class="text-amber-300">' + esc(x.line.hostN) + '：先把「' + esc(x.line.chapters[x.i - 1].title) + '」的事辦完。</span>'); return; }
      return oAcc.apply(this, arguments);
    };
  }
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var x = KEYS[key], before = x ? trialQState(key) : 0;
      var r = oDone.apply(this, arguments);
      try {
        if (x && before === 1 && trialQState(key) === 2) {
          var ch = x.line.chapters[x.i], got = [];
          (ch.first || []).forEach(function (f) { if (f[0] === 'gold') { player.gold = (Number(player.gold) || 0) + f[1]; got.push('金幣 ×' + Number(f[1]).toLocaleString()); } else if (DB.items[f[0]]) { gainItem(f[0], f[1], true, true); got.push(DB.items[f[0]].n + ' ×' + f[1]); } });
          if (got.length) sys('<span class="text-amber-200">' + esc(x.line.hostN) + '另外交給你：' + got.join('、') + '</span>');
          if (typeof ch.onDone === 'function') ch.onDone(player);
          try { saveGame(); } catch (e) {}
        }
      } catch (e) { console.warn('[AFK-lore-kit] done', e); }
      return r;
    };
  }
  var addNpc = function (town, def, spr, pos) {
    try {
      var t = DB.towns[town]; if (!t) return;
      t.npcs = t.npcs || []; if (!t.npcs.some(function (n) { return n.id === def.id; })) t.npcs.push(def);
      if (spr && typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[def.id]) NPC_SPR_FIXED[def.id] = spr;
      if (pos && typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE[town] = TOWN_NPC_POS_OVERRIDE[town] || {})[def.id] = pos;
    } catch (e) {}
  };

  // ── Boss 小工具 ──
  var party = function () { var p = P(); if (!p) return []; var out = []; if (!p.dead) out.push(p); (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); }); return out; };
  var hurt = function (t, dmg, trueDmg) {
    var p = P(); if (!t || !(dmg > 0)) return 0;
    if (trueDmg !== false && typeof W.__afkTrueCut === 'function') dmg = W.__afkTrueCut(t, dmg);
    if (typeof W.__afkIncomingMod === 'function') { try { dmg = W.__afkIncomingMod(t, dmg); } catch (e) {} }   // 隱藏規則「命運」等：受到的傷害（afk-fate.js）
    dmg = Math.max(1, Math.floor(dmg));
    if (t === p) { p.hp -= dmg; if (p.hp <= 0 && !p.dead) { try { killPlayer(); } catch (e) {} } }
    else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
    return dmg;
  };
  var place = function (idx, base, extra) {
    var o = Object.assign(JSON.parse(JSON.stringify(base)), extra || {});
    mapState.mobs[idx] = Object.assign(o, { curHp: o.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
    try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
    var m = mapState.mobs[idx];
    try { if (m.hard && typeof initHardSkin === 'function') initHardSkin(m); } catch (e) {}
    return m;
  };
  var summon = function (id, n, extra) {
    var base = DB.mobs[id]; if (!base) return 0;
    var got = 0;
    for (var i = 0; i < n; i++) {
      var ms = mapState.mobs, j = -1;
      for (var q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
      if (j < 0) break;
      place(j, base, Object.assign({ mobId: id }, extra || {})); got++;
    }
    try { if (got && !S().ff) renderMobs(); } catch (e) {}
    return got;
  };
  var halted = function (m) { return !!(W.__afkHalted && W.__afkHalted(m)); };

  W.__afkLore = { CLASSES: CLASSES, defineLine: defineLine, lines: LINES, keyOf: keyOf, addItem: addItem, addMob: addMob, aliasAnim: aliasAnim, addNpc: addNpc,
    defineSet: defineSet, setBonus: bonusOf, render: render, html: html, esc: esc, sys: sys, clog: clog,
    boss: { party: party, hurt: hurt, place: place, summon: summon, halted: halted } };
})();
