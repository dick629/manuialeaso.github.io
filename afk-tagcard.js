/* ============================================================================
 * afk-tagcard.js — 標籤卡（卡片鑲嵌）（Ping 11-18：先做給我看，再決定上線）
 *
 *   ‧資格：裝備那一格穿的是「至高的支配」遺物（DB.items[id].relicEvo != null）才開得了卡洞；不是就鎖住。
 *     效果只在那件裝備穿在身上時才算（跟符文石一樣）。
 *   ‧卡洞：每件 3 個，開一個要解命石 ×5（afk_fate_unlock）。插了卡的裝備不能賣、不能上架。
 *   ‧製作：同一隻怪的鑽石卡（card_d_<怪名>）×10 → 那隻怪的標籤卡 ☆0。
 *   ‧升星（上限 ★3）：★1＝同一張標籤卡 ×2＋鑽石卡 ×10；★2＝×3＋×20；★3＝×5＋×30。
 *   ‧能力：一般卡 4 種（☆0 1、★1～★3 各 +1）；王卡 6 種（☆0 2、★1 1、★2 1、★3 2；★2／★3 另外把法術的施放機率提到 5%／8%）。
 *     能力資料在 afk-tagcard-data.js（W.AFK_TAGCARD_DATA，依怪物等級、種族、屬性、法術產生），文字由這裡從資料組出來。
 *   ‧入口：裝備視窗第二頁「箭筒」那格「卡片標籤」（跟密奧一樣另開視窗）；佩特拉後裔村的卡片工匠「命運」也開同一個視窗。
 *   ‧易傷：標籤卡給的易傷算「卡片」這一類來源，每張 5%，同一種最多 20%（跟命中、技能、遺物、符文、卷軸合計最多 50%；限界突破 +5%）。
 *   外掛開關 tagcard；經典模式沒有。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'tagcard', name: '標籤卡（卡片鑲嵌）', group: '遊戲內容', desc: '至高的支配裝備可以開卡洞、鑲嵌用鑽石卡做成的標籤卡' });
  if (T && !T.enabled('tagcard')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var DATA = W.AFK_TAGCARD_DATA || {};
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return N(S().ticks); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Math.floor(N(n)).toLocaleString(); };
  var classic = function (p) { return !!(p && p.classicMode); };

  var KEY = 'afk_fate_unlock', HOLE_COST = 5, MAKE = 10, HOLES = 3;
  var UP = [null, { same: 2, dia: 10 }, { same: 3, dia: 20 }, { same: 5, dia: 30 }];   // 升到 ★1／★2／★3
  var VULN_EACH = 5, VULN_CAP = 20;
  var EQK = ['wpn', 'shield', 'armor', 'helm', 'cloak', 'gloves', 'boots', 'shin', 'tshirt', 'ring1', 'ring2', 'ring3', 'ring4', 'ear1', 'ear2', 'amulet', 'belt'];
  var SLOTN = { wpn: '武器', shield: '盾牌／副手', armor: '盔甲', helm: '頭盔', cloak: '斗篷', gloves: '手套', boots: '長靴', shin: '脛甲', tshirt: '內衣', ring1: '戒指', ring2: '戒指', ring3: '戒指', ring4: '戒指', ear1: '耳環', ear2: '耳環', amulet: '項鍊', belt: '腰帶' };
  // 紙娃娃座標（跟裝備視窗第一頁一樣）
  var POS = { helm: [50.0, 15.81], ear1: [19.4, 18.01], ear2: [80.1, 18.01], amulet: [50.0, 33.46], gloves: [19.4, 31.50], cloak: [80.1, 31.50], tshirt: [50.0, 42.77],
    wpn: [19.4, 44.98], shield: [80.1, 44.98], armor: [50.0, 52.08], ring1: [19.4, 58.46], ring2: [80.1, 58.46], belt: [50.0, 63.36], ring3: [19.4, 67.77], ring4: [80.1, 67.77], shin: [50.0, 72.67], boots: [50.0, 81.99] };
  var ATTN = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
  var ELN = { fire: '火', water: '水', wind: '風', earth: '地' };
  var STAR = ['☆0', '★1', '★2', '★3'];

  // ── 能力文字 ──
  var pc = function (v) { return (Math.round(N(v) * 10) / 10) + '%'; };
  var TXT = {
    parity: function (f) { return '你的' + ATTN[f.a] + '基礎值為' + (f.odd ? '奇數' : '偶數') + '時，' + ATTN[f.b] + ' +（' + ATTN[f.a] + '÷' + f.n + '）'; },
    size: function (f) { return '對' + (f.s === 'L' ? '大型' : '小型') + '怪傷害 +' + pc(f.v); },
    race: function (f) { return '對' + f.r + '系怪物傷害 +' + pc(f.v); },
    ele: function (f) { return ELN[f.e] + '屬性傷害 +' + pc(f.v); },
    melee: function (f) { return '近距離傷害 +' + pc(f.v); },
    ranged: function (f) { return '遠距離傷害 +' + pc(f.v); },
    magic: function (f) { return '魔法傷害 +' + pc(f.v); },
    boss: function (f) { return '對頭目傷害 +' + pc(f.v); },
    bossLow: function (f) { return '對 HP 50% 以下的頭目傷害 +' + pc(f.v); },
    nextPhys: function (f) { return '命中時 ' + f.c + '% 機率：下一次物理傷害 ×1.5'; },
    chase: function (f) { return '追擊：物理命中時 ' + f.c + '% 機率再打一次（同樣的傷害）'; },
    echo: function (f) { return '共鳴：魔法命中時 ' + f.c + '% 機率再造成一次同樣的傷害'; },
    vuln: function (f) { return '命中時給目標' + (f.t === 'ph' ? '物理' : f.t === 'mg' ? '魔法' : ELN[f.t] + '屬性') + '易傷 +' + f.v + '%（5 秒）'; },
    dual: function (f) { return '命中時給目標' + ELN[f.a] + '、' + ELN[f.b] + '雙屬性易傷（各 +' + f.v + '%，5 秒）'; },
    limit: function (f) { return '限界突破：易傷上限 +' + f.v + '%'; },
    cast: function (f) { return '攻擊時 ' + f.c + '% 機率施放「' + f.sk + '」（傷害＝這一擊的 2 倍）'; },
    castUp: function (f) { return '「' + f.sk + '」施放機率提升到 ' + f.c + '%'; },
    counter: function (f) { return '受到攻擊時 ' + f.c + '% 機率施放「' + f.sk + '」反擊（傷害＝你平常一擊的 3 倍）'; },
    dr: function (f) { return '受到的傷害 −' + pc(f.v); },
    eleDr: function (f) { return '受到' + ELN[f.e] + '屬性怪物的傷害 −' + pc(f.v); },
    bossDr: function (f) { return '受到頭目的傷害 −' + pc(f.v); },
    magDr: function (f) { return '受到的魔法傷害 −' + pc(f.v); },
    physDr: function (f) { return '受到的物理傷害 −' + pc(f.v); },
    lowDr: function (f) { return 'HP 低於 30% 時受到的傷害 −' + pc(f.v); },
    resist: function (f) { return '異常狀態抵抗 +' + f.c + '%'; },
    ero: function (f) { return '次元裂縫侵蝕速度 −' + f.v + '%'; },
    recoil: function (f) { return '怪物倒下時的反噬傷害 −' + f.v + '%'; },
    cheat: function (f) { return '受到致命傷害時保留 1 HP（每 ' + f.cd + ' 秒一次）'; },
    regen: function (f) { return '每 5 秒回復最大 HP 的 ' + pc(f.v); },
    leech: function (f) { return '物理命中時回復最大 HP 的 ' + pc(f.v) + '（每秒最多一次）'; },
    killHeal: function (f) { return '打倒怪物時回復最大 HP 的 ' + pc(f.v); },
    potion: function (f) { return '治癒藥水回復量 +' + pc(f.v); },
    shield: function (f) { return '溢補護盾量 +' + pc(f.v); },
    mpTick: function (f) { return '每 5 秒回復 MP ' + f.v; },
    killMp: function (f) { return '打倒怪物時回復 MP ' + f.v; },
    pet: function (f) { return '寵物傷害 +' + pc(f.v); },
    summon: function (f) { return '召喚物傷害 +' + pc(f.v); },
    petHeal: function (f) { return '寵物攻擊時 ' + f.c + '% 機率替你回復最大 HP 的 1%'; },
    bite: function (f) { return '寵物撕咬易傷層數上限 +' + f.n; }
  };
  var fxText = function (f) { try { return TXT[f.k] ? TXT[f.k](f) : f.k; } catch (e) { return ''; } };
  var dmgLabel = function (h) { try { return W.__afkDmgLabel ? W.__afkDmgLabel.html(h) : h; } catch (e) { return h; } };

  // ── 卡片資料 ──
  var card = function (n) { return DATA[n] || null; };
  var diaId = function (n) { return 'card_d_' + n; };
  var diaIcon = function (n) { try { var d = DB.items[diaId(n)]; return d ? (typeof getIconUrl === 'function' ? getIconUrl(d) : d.img || '') : ''; } catch (e) { return ''; } };
  var mobImg = function (n) {   // 怪物圖（跟怪物卡冊同一套；找不到就用鑽石卡圖示）
    var c = card(n), m = c && DB.mobs && DB.mobs[c.i], fb = [diaIcon(n)];
    try { if (typeof mobStillImg === 'function') { var mi = mobStillImg(n, m && m.img, false); return { src: mi.src, fb: (mi.fb || []).concat(fb) }; } } catch (e) {}
    return { src: (m && m.img) || ('assets/icons/monsters/' + n + '.png'), fb: fb };
  };
  var cardIcon = function (n) { return mobImg(n).src; };
  var lines = function (n, upto) {   // [{s:星, t:文字, f}]，castUp 合併在同一星
    var c = card(n), out = []; if (!c) return out;
    for (var s = 0; s <= 3; s++) (c.s[s] || []).forEach(function (f) { out.push({ s: s, f: f, t: fxText(f), on: upto == null || s <= upto }); });
    return out;
  };

  // ── 背包裡的標籤卡（不佔背包格：p.afkTagBag = { 怪名: [☆0, ★1, ★2, ★3] }）──
  var bag = function (p) { p = p || P(); if (!p) return {}; if (!p.afkTagBag || typeof p.afkTagBag !== 'object') p.afkTagBag = {}; return p.afkTagBag; };
  var bagN = function (p, n, s) { var b = bag(p)[n]; return b ? N(b[s]) : 0; };
  var bagAdd = function (p, n, s, k) { var B = bag(p); var b = B[n] || (B[n] = [0, 0, 0, 0]); b[s] = Math.max(0, N(b[s]) + k); if (!b.some(function (x) { return x > 0; })) delete B[n]; };
  // 鑽石卡：背包＋倉庫都不算，只算背包（跟其他 NPC 一樣用 kit.have／take）
  var kit = function () { return W.__afkNpcKit; };
  var have = function (id) { var K = kit(); if (K) return K.have(id); var p = P(); return p ? (p.inv || []).filter(function (it) { return it && it.id === id && !it.lock; }).reduce(function (a, it) { return a + (N(it.cnt) || 1); }, 0) : 0; };
  var take = function (id, n) { var K = kit(); return K ? K.take(id, n) : false; };

  // ── 裝備的卡洞 ──
  var eligible = function (it) { var d = it && DB.items[it.id]; return !!(d && d.relicEvo != null); };
  var holes = function (it) { return Math.max(0, Math.min(HOLES, Math.floor(N(it && it.afkTagN)))); };
  var socks = function (it) { if (!Array.isArray(it.afkTag)) it.afkTag = [null, null, null]; return it.afkTag; };
  var socketed = function (it) { return !!(it && Array.isArray(it.afkTag) && it.afkTag.some(function (x) { return x && x.n; })); };
  var hasHoles = function (it) { return !!(it && (holes(it) > 0 || socketed(it))); };

  // ── 合計（每個角色 1 秒重算一次；換卡時立刻重算）──
  var VER = 0, AGG = typeof WeakMap === 'function' ? new WeakMap() : null;
  var blank = function () { return { size: { S: 0, L: 0 }, race: {}, ele: {}, melee: 0, ranged: 0, magic: 0, boss: 0, bossLow: 0, nextPhys: 0, chase: 0, echo: 0,
    vuln: {}, limit: 0, casts: [], counters: [], dr: 0, eleDr: {}, bossDr: 0, magDr: 0, physDr: 0, lowDr: 0, resist: 0, ero: 0, recoil: 0, cheat: 0,
    regen: 0, leech: 0, killHeal: 0, potion: 0, shield: 0, mpTick: 0, killMp: 0, pet: 0, summon: 0, petHeal: 0, bite: 0, parity: [], any: false }; };
  var addCard = function (a, n, star) {
    var c = card(n); if (!c) return;
    var castC = {}, castE = c.e;
    for (var s = 0; s <= Math.min(3, star); s++) (c.s[s] || []).forEach(function (f) {
      a.any = true;
      switch (f.k) {
        case 'parity': a.parity.push(f); break;
        case 'size': a.size[f.s === 'L' ? 'L' : 'S'] += N(f.v); break;
        case 'race': a.race[f.r] = (a.race[f.r] || 0) + N(f.v); break;
        case 'ele': a.ele[f.e] = (a.ele[f.e] || 0) + N(f.v); break;
        case 'eleDr': a.eleDr[f.e] = (a.eleDr[f.e] || 0) + N(f.v); break;
        case 'vuln': a.vuln[f.t] = (a.vuln[f.t] || 0) + 1; break;
        case 'dual': a.vuln[f.a] = (a.vuln[f.a] || 0) + 1; a.vuln[f.b] = (a.vuln[f.b] || 0) + 1; break;
        case 'limit': a.limit = Math.max(a.limit, N(f.v)); break;
        case 'cast': case 'castUp': castC[f.sk] = Math.max(castC[f.sk] || 0, N(f.c)); break;
        case 'counter': a.counters.push({ sk: f.sk, c: N(f.c), e: castE, n: n }); break;
        case 'cheat': a.cheat = a.cheat ? Math.min(a.cheat, N(f.cd)) : N(f.cd); break;
        case 'bite': a.bite = Math.max(a.bite, N(f.n)); break;
        case 'nextPhys': case 'chase': case 'echo': case 'resist': case 'petHeal': a[f.k] += N(f.c); break;
        default: if (typeof a[f.k] === 'number') a[f.k] += N(f.v);
      }
    });
    for (var sk in castC) a.casts.push({ sk: sk, c: castC[sk], e: castE, n: n });
  };
  var worn = function (e) {   // [{k, it}]：身上穿著、合資格、有插卡的裝備
    var out = []; if (!e || !e.eq) return out;
    EQK.forEach(function (k) { var it = e.eq[k]; if (it && eligible(it) && socketed(it)) out.push({ k: k, it: it }); });
    return out;
  };
  var agg = function (e) {
    if (!e || !e.eq || classic(P())) return null;
    var t = Math.floor(tk() / 10), c = AGG && AGG.get(e);
    if (c && c.t === t && c.v === VER) return c.a;
    var a = blank();
    worn(e).forEach(function (w) { socks(w.it).forEach(function (x) { if (x && x.n) addCard(a, x.n, N(x.s)); }); });
    if (AGG) AGG.set(e, { t: t, v: VER, a: a });
    return a.any ? a : null;
  };
  var bump = function () {
    VER++;
    var p = P(); if (p) { var a = agg(p); p._afkPetBiteCap = a ? a.bite : 0; p._afkVulnCapUp = a ? a.limit / 100 : 0; }
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
  };

  // ── 戰鬥效果 ──
  var hpOf = function (e) { return e === P() ? N(e.hp) : N(e.curHp != null ? e.curHp : e.hp); };
  var heal = function (e, v) {
    if (!e || !(v > 0)) return;
    try { var RR = W.__afkRebirthRules; if (RR && RR.healWithShield) return RR.healWithShield(e, v); } catch (x) {}
    var mx = N(e.mhp); if (e === P()) e.hp = Math.min(mx, N(e.hp) + Math.floor(v)); else if (e.curHp != null) e.curHp = Math.min(mx, N(e.curHp) + Math.floor(v));
  };
  var Q = [];   // 追加傷害排到下一刻再打（不在別人的傷害結算中途扣血）
  var castEle = null;
  var wpnEle = function (a) { try { var w = a.eq && a.eq.wpn, b = w && DB.items[w.id]; if (!b) return null; var e = typeof getWpnEle === 'function' ? getWpnEle(w, b, a) : b.ele; return ELN[e] ? e : null; } catch (x) { return null; } };
  var hybrid = function () { return W.LineageHybrid || null; };
  var vulnOn = function (a, t) {
    var H = hybrid(); if (!H || !H.cardVuln) return;
    for (var k in a.vuln) H.cardVuln(t, k, Math.min(VULN_CAP, a.vuln[k] * VULN_EACH) / 100);
  };
  var lastLeech = typeof WeakMap === 'function' ? new WeakMap() : null;
  var nextBoost = typeof WeakMap === 'function' ? new WeakMap() : null;
  var popCard = function (n, txt) { var X = W.__afkProc; if (X) X.pop('tag:' + n + txt, cardIcon(n), txt, '#fbbf24'); };
  var logNote = function (key, h) { var X = W.__afkProc; if (X) X.note('tag:' + key, h); };
  var hookProc = function () {
    var X = W.__afkProc; if (!X || X.__tagHooked) return; X.__tagHooked = true;
    X.on('dealt', function (actor, t, v, opt) {
      if (!actor || !actor.eq || !t || t._isAlly || t === P() || (t.cls && t.eq)) return v;
      var a = agg(actor); if (!a) return v;
      var k = opt && opt.kind, phys = k === 'melee' || k === 'ranged', mag = k === 'magic', direct = phys || mag;
      var add = (t.s === 'L' ? a.size.L : a.size.S) + (a.race[t.race] || 0);
      if (t.boss) { add += a.boss; if (N(t.curHp) <= N(t.maxHp || t.hp) * 0.5) add += a.bossLow; }
      if (k === 'melee') add += a.melee; else if (k === 'ranged') add += a.ranged; else if (mag) add += a.magic;
      var e = phys ? wpnEle(actor) : mag ? castEle : null; if (e && a.ele[e]) add += a.ele[e];
      var nv = v * (1 + add / 100);
      if (phys && nextBoost && nextBoost.get(actor)) { nextBoost.delete(actor); nv *= 1.5; }
      if (direct) {
        if (a.nextPhys && Math.random() * 100 < a.nextPhys && nextBoost) nextBoost.set(actor, 1);
        if (phys && a.chase && Math.random() * 100 < a.chase) Q.push({ t: t, d: nv, why: '追擊', a: actor });
        if (mag && a.echo && Math.random() * 100 < a.echo) Q.push({ t: t, d: nv, why: '共鳴', a: actor });
        a.casts.forEach(function (c) { if (Math.random() * 100 < c.c) Q.push({ t: t, d: Math.max(nv, N(W.__afkPanelDmg && W.__afkPanelDmg(actor))) * 2, why: c.sk, n: c.n, a: actor }); });
        vulnOn(a, t);
        if (phys && a.leech && lastLeech) { var lt = lastLeech.get(actor) || -99; if (tk() - lt >= 10 || tk() < lt) { lastLeech.set(actor, tk()); heal(actor, N(actor.mhp) * a.leech / 100); } }
      }
      return nv;
    });
    X.on('taken', function (ent, v, mob, kind) {
      var a = agg(ent); if (!a || !(v > 0)) return v;
      var r = a.dr + (kind === 'magic' ? a.magDr : a.physDr);
      if (mob && mob.e && a.eleDr[mob.e]) r += a.eleDr[mob.e];
      if (mob && mob.boss) r += a.bossDr;
      if (hpOf(ent) < N(ent.mhp) * 0.3) r += a.lowDr;
      r = Math.min(60, r);
      if (mob && !mob._dead && a.counters.length) a.counters.forEach(function (c) { if (Math.random() * 100 < c.c) Q.push({ t: mob, d: N(W.__afkPanelDmg && W.__afkPanelDmg(ent)) * 3, why: c.sk, n: c.n, a: ent }); });
      return v * (1 - r / 100);
    });
    var cheatAt = typeof WeakMap === 'function' ? new WeakMap() : null;
    X.on('death', function () {
      var p = P(), a = agg(p); if (!a || !a.cheat || !cheatAt) return false;
      var last = cheatAt.get(p); if (last != null && tk() >= last && tk() - last < a.cheat * 10) return false;
      cheatAt.set(p, tk()); p.hp = 1; logNote('cheat', '<span class="text-amber-300">【標籤卡】受到致命傷害，保留 1 HP。</span>'); return true;
    });
    X.on('resist', function () { var a = agg(P()); return !!(a && a.resist && Math.random() * 100 < a.resist); });
    X.on('kill', function () {
      var p = P(); if (!p) return;
      [p].concat(p.allies || []).forEach(function (e) {
        if (!e || e._downed || (e === p && p.dead)) return; var a = agg(e); if (!a) return;
        if (a.killHeal) heal(e, N(e.mhp) * a.killHeal / 100);
        if (a.killMp) { if (e === p) p.mp = Math.min(N(p.mmp), N(p.mp) + a.killMp); else if (e.mp != null) e.mp = Math.min(N(e.mmp), N(e.mp) + a.killMp); }
      });
    });
    X.on('potion', function (d, est) { var p = P(), a = agg(p); if (a && a.potion && est > 0) heal(p, est * a.potion / 100); });
    X.on('tick', function () {
      if (Q.length) {
        var list = Q.splice(0, Q.length);
        list.forEach(function (q) {
          if (!q.t || q.t._dead || !(N(q.t.curHp) > 0) || !(q.d > 0)) return;
          var d = X.hitMob(q.t, q.d);
          if (d > 0) {
            if (q.n) popCard(q.n, q.why);
            logNote(q.why, '<span class="text-amber-300">【標籤卡・' + esc(q.why) + '】</span>對 ' + esc(q.t.n || '怪物') + ' 造成 ' + fmt(d) + ' 點傷害。');
          }
        });
      }
      if (tk() % 50 !== 0) return;
      var p = P(); if (!p || p.dead) return;
      [p].concat(p.allies || []).forEach(function (e) {
        if (!e || e._downed) return; var a = agg(e); if (!a) return;
        if (a.regen) heal(e, N(e.mhp) * a.regen / 100);
        if (a.mpTick) { if (e === p) p.mp = Math.min(N(p.mmp), N(p.mp) + a.mpTick); else if (e.mp != null) e.mp = Math.min(N(e.mmp), N(e.mp) + a.mpTick); }
      });
      var pa = agg(p); p._afkPetBiteCap = pa ? pa.bite : 0; p._afkVulnCapUp = pa ? pa.limit / 100 : 0;
    });
  };
  // 魔法傷害的屬性：施法那一下記住技能屬性
  var hookCastEle = function () {
    var wrap = function (name, si) {
      var o = W[name]; if (typeof o !== 'function' || o.__afkTagEle) return;
      var f = function () {
        var sk = arguments[si]; sk = typeof sk === 'string' ? DB.skills[sk] : sk;
        var keep = castEle; castEle = sk && ELN[sk.ele] ? sk.ele : null;
        try { return o.apply(this, arguments); } finally { castEle = keep; }
      };
      f.__afkTagEle = true; W[name] = f; try { (0, eval)(name + ' = window.' + name); } catch (e) {}
    };
    wrap('castSkillInner', 0); wrap('allyCastMagic', 1);
  };
  // 寵物、召喚物
  var hookPet = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.companionDamage !== 'function' || R.__hkTag) return; R.__hkTag = true;
    var o = R.companionDamage;
    R.companionDamage = function (owner, pet, target, dmg, extra) {
      try {
        var a = owner && agg(owner), kd = extra && extra.kind;
        if (a && dmg > 0 && target && !target._isAlly) {
          if (kd === 'pet' && a.pet) dmg = dmg * (1 + a.pet / 100);
          if (kd === 'summon' && a.summon) dmg = dmg * (1 + a.summon / 100);
          if (kd === 'pet' && a.petHeal && Math.random() * 100 < a.petHeal) heal(owner, N(owner.mhp) * 0.01);
          arguments[3] = dmg;
        }
      } catch (e) {}
      return o.apply(this, arguments);
    };
  };
  // 屬性換算（偶數／奇數）：在屬性換算戰鬥數值之前加
  var oBoost = W.__afkAttrBoost;
  W.__afkAttrBoost = function (p, d) {
    try {
      var a = agg(p);
      // 11-18 Ping：換算可以疊加（A→B 加到的點數，B→C 會算進去），但每一條換算只算一次——A→B→C→A 繞一圈就停，不會無限循環。
      //   順序＝裝備部位順序、卡洞順序（agg 收集的順序）。v 是「基礎值＋前面換算加到的」。
      if (a && a.parity.length && p.base) {
        var v = {};
        a.parity.forEach(function (f) {
          [f.a, f.b].forEach(function (k) { if (v[k] == null) v[k] = N(p.base[k]) + N(p.alloc && p.alloc[k]); });
          var A = v[f.a];
          if (A > 0 && (A % 2) === f.odd) { var g = Math.floor(A / f.n); d[f.b] = N(d[f.b]) + g; v[f.b] += g; }
        });
      }
    } catch (e) {}
    if (typeof oBoost === 'function') return oBoost.apply(this, arguments);
  };
  // 侵蝕、反噬、護盾
  var hookMisc = function () {
    var oE = W.__afkEroMult;
    if (!(oE && oE.__afkTag)) {
      var fE = function (p) { var m = typeof oE === 'function' ? N(oE.apply(this, arguments)) || 1 : 1, a = agg(p || P()); return a && a.ero ? m * (1 - Math.min(50, a.ero) / 100) : m; };
      fE.__afkTag = true; W.__afkEroMult = fE;
    }
    var oR = W.__afkRecoilMult;
    if (!(oR && oR.__afkTag)) { var fR = function (x) { var m = typeof oR === 'function' ? N(oR.apply(this, arguments)) || 1 : 1, a = agg(x); return a && a.recoil ? m * (1 - Math.min(60, a.recoil) / 100) : m; }; fR.__afkTag = true; W.__afkRecoilMult = fR; }
    var oS = W.__afkShieldMult;
    if (!(oS && oS.__afkTag)) { var fS = function (x) { var m = typeof oS === 'function' ? N(oS.apply(this, arguments)) || 1 : 1, a = agg(x); return a && a.shield ? m * (1 + a.shield / 100) : m; }; fS.__afkTag = true; W.__afkShieldMult = fS; }
  };

  // ── 不能賣、不能上架 ──
  var MSG = '<span class="text-amber-300">這件裝備插了標籤卡（或開了卡洞），不能販賣。</span>';
  var say = function (h) { try { logSys(h); } catch (e) {} };
  var invIt = function (uid) { var p = P(); return p && (p.inv || []).find(function (x) { return x && x.uid === uid; }); };
  var wrapG = function (name, mk) { if (typeof W[name] !== 'function' || W[name].__afkTag) return; var f = mk(W[name]); f.__afkTag = true; W[name] = f; try { (0, eval)(name + ' = window.' + name); } catch (e) {} };
  var hookSell = function () {
    wrapG('sellItem', function (o) { return function (uid) { var it = invIt(uid); if (it && hasHoles(it)) { say(MSG); return; } return o.apply(this, arguments); }; });
    wrapG('_autoSellDecision', function (o) { return function (i) { if (i && hasHoles(i)) return { sell: false }; return o.apply(this, arguments); }; });
    wrapG('_qjCanSelect', function (o) { return function (d, i) { if (i && hasHoles(i)) return false; return o.apply(this, arguments); }; });
    wrapG('toggleJunk', function (o) { return function (uid) { var it = invIt(uid); if (it && !it.junk && hasHoles(it)) { say(MSG); return; } return o.apply(this, arguments); }; });
    wrapG('openModal', function (o) {
      return function (item) {
        var r = o.apply(this, arguments);
        try {
          if (item && hasHoles(item)) {
            var m = document.getElementById('item-modal'), bs = m ? m.querySelectorAll('button[onclick^="sellItem("]') : [];
            for (var k = 0; k < bs.length; k++) { var b = bs[k]; if (k > 0) { b.remove(); continue; } b.disabled = true; b.removeAttribute('onclick'); b.classList.add('opacity-50', 'cursor-not-allowed'); b.textContent = '不能販賣（有卡洞）'; }
          }
        } catch (e) {}
        return r;
      };
    });
  };
  W.__afkTagHasHoles = hasHoles;
  // 物品說明：列出卡洞
  var hookDesc = function () {
    var o = W.buildItemDescHTML; if (typeof o !== 'function' || o.__afkTagDesc) return;
    var f = function (it) {
      var r = o.apply(this, arguments);
      try {
        if (it && typeof it === 'object' && it.id && eligible(it) && typeof r === 'string') {
          var n = holes(it), sk = socks(it), h = '<div class="mt-1 pt-1 border-t border-slate-600"><div class="text-amber-300 font-bold">標籤卡卡洞 ' + n + '／' + HOLES + '</div>';
          for (var i = 0; i < HOLES; i++) {
            var x = sk[i];
            h += '<div class="text-xs ' + (x && x.n ? 'text-amber-200' : i < n ? 'text-violet-300' : 'text-slate-500') + '">◆ ' + (x && x.n ? esc(x.n) + ' 標籤卡 ' + STAR[N(x.s)] : i < n ? '空卡洞' : '未開孔（卡片工匠「命運」：解命石 ×' + HOLE_COST + '）') + '</div>';
            if (x && x.n) h += lines(x.n, N(x.s)).filter(function (l) { return l.on; }).map(function (l) { return '<div class="text-xs text-slate-300" style="padding-left:1em">' + dmgLabel(esc(l.t)) + '</div>'; }).join('');
          }
          r += h + '</div>';
        }
      } catch (e) {}
      return r;
    };
    f.__afkTagDesc = true; f.__afkDL = o.__afkDL; W.buildItemDescHTML = f;
    try { (0, eval)('buildItemDescHTML = window.buildItemDescHTML'); } catch (e) {}
  };

  // ── 動作 ──
  var MSGBOX = { err: '', ok: '' };
  var say2 = function (ok, t) { MSGBOX.err = ok ? '' : t; MSGBOX.ok = ok ? t : ''; };
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} };
  var after = function () { bump(); try { if (typeof updateUI === 'function') updateUI(); if (typeof refreshEquipmentWindow === 'function') refreshEquipmentWindow(); } catch (e) {} save(); };
  var act = {
    make: function (n) {
      var p = P(); if (!p || !card(n)) return;
      if (have(diaId(n)) < MAKE) return say2(false, n + ' 的鑽石卡不夠（要 ' + MAKE + ' 張）。');
      take(diaId(n), MAKE); bagAdd(p, n, 0, 1);
      say2(true, '做出「' + n + '」標籤卡 ☆0。'); logNote('make', '<span class="text-amber-300">【卡片工匠】</span>用 ' + MAKE + ' 張鑽石卡做出「' + esc(n) + '」標籤卡 ☆0。'); after();
    },
    up: function (n, s) {   // 把一張 s 星升到 s+1
      var p = P(), c = UP[s + 1]; if (!p || !c || !card(n)) return;
      if (bagN(p, n, s) < c.same) return say2(false, '要同一張標籤卡（' + STAR[s] + '）×' + c.same + '。');
      if (have(diaId(n)) < c.dia) return say2(false, n + ' 的鑽石卡不夠（要 ' + c.dia + ' 張）。');
      take(diaId(n), c.dia); bagAdd(p, n, s, -c.same); bagAdd(p, n, s + 1, 1);
      say2(true, '「' + n + '」標籤卡升到 ' + STAR[s + 1] + '！'); after();
    },
    open: function (k) {
      var p = P(), it = p && p.eq[k]; if (!it || !eligible(it)) return;
      if (holes(it) >= HOLES) return say2(false, '卡洞已經全開了。');
      if (have(KEY) < HOLE_COST) return say2(false, '解命石不夠（要 ' + HOLE_COST + ' 顆）。');
      take(KEY, HOLE_COST); it.afkTagN = holes(it) + 1; socks(it);
      say2(true, '開了第 ' + it.afkTagN + ' 個卡洞。'); after();
    },
    put: function (k, i, n, s) {
      var p = P(), it = p && p.eq[k]; if (!it || !eligible(it) || i >= holes(it)) return;
      if (bagN(p, n, s) < 1) return say2(false, '背包裡沒有這張標籤卡。');
      var sk = socks(it), old = sk[i];
      if (old && old.n) bagAdd(p, old.n, N(old.s), 1);
      bagAdd(p, n, s, -1); sk[i] = { n: n, s: s };
      say2(true, '把「' + n + '」' + STAR[s] + ' 插進卡洞。'); after();
    },
    pull: function (k, i) {
      var p = P(), it = p && p.eq[k]; if (!it) return; var sk = socks(it), x = sk[i]; if (!x || !x.n) return;
      bagAdd(p, x.n, N(x.s), 1); sk[i] = null;
      say2(true, '取下「' + x.n + '」' + STAR[N(x.s)] + '，放回卡片背包。'); after();
    }
  };

  // ── 視窗 ──
  var V = { tab: 'doll', slot: 'wpn', pick: null, q: '', own: true };
  var cssDone = false;
  var css = function () {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style'); s.id = 'afk-tc-css';
    s.textContent = '#afk-tc-ov{position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:10px}'
      + '#afk-tc{width:min(1080px,100%);max-height:96vh;display:flex;flex-direction:column;background:#0b1220;border:2px solid #8b6a2f;border-radius:12px;box-shadow:0 20px 50px #000c;color:#e2e8f0;overflow:hidden}'
      + '#afk-tc .tc-hd{display:flex;align-items:center;gap:10px;padding:8px 12px;background:linear-gradient(135deg,#6e511d,#b18a38,#493311);color:#fff7d6}'
      + '#afk-tc .tc-hd b{font-size:17px}#afk-tc .tc-hd small{opacity:.85}#afk-tc .tc-x{margin-left:auto;font-size:22px;line-height:1;background:none;border:0;color:#fff;cursor:pointer;padding:2px 8px}'
      + '#afk-tc .tc-tabs{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap}#afk-tc .tc-tabs button{padding:6px 14px;border-radius:8px 8px 0 0;border:1px solid #475569;border-bottom:0;background:#1e293b;color:#cbd5e1;font-weight:700}'
      + '#afk-tc .tc-tabs button.on{background:#854d0e;border-color:#f59e0b;color:#fef3c7}'
      + '#afk-tc .tc-body{flex:1;overflow:auto;padding:10px 12px;border-top:1px solid #334155}'
      + '#afk-tc .tc-doll-wrap{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}'
      + '#afk-tc .tc-doll{position:relative;width:min(380px,100%);aspect-ratio:1084/1447;flex:0 0 auto}'
      + '#afk-tc .tc-doll>img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;filter:brightness(.8)}'
      + '#afk-tc .tc-s{position:absolute;width:19.67%;height:8.82%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;border-radius:6px;border:2px solid transparent;background:rgba(8,10,8,.35);cursor:pointer;padding:0}'
      + '#afk-tc .tc-s img{width:72%;height:72%;object-fit:contain;filter:drop-shadow(0 2px 3px #000)}'
      + '#afk-tc .tc-s.lock{cursor:pointer;opacity:.55}#afk-tc .tc-s.lock::after{content:"🔒";position:absolute;right:2px;top:0;font-size:12px}'
      + '#afk-tc .tc-s.ok{border-color:#a16207}#afk-tc .tc-s.on{border-color:#facc15;box-shadow:0 0 10px #facc15aa}'
      + '#afk-tc .tc-pips{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);display:flex;gap:2px}'
      + '#afk-tc .tc-pip{width:9px;height:9px;border-radius:50%;border:1px solid #64748b;background:#0f172a}#afk-tc .tc-pip.o{border-color:#a855f7;background:#2e1065}#afk-tc .tc-pip.f{border-color:#f59e0b;background:#f59e0b}'
      + '#afk-tc .tc-side{flex:1 1 360px;min-width:0}'
      + '#afk-tc .tc-sock{display:flex;gap:10px;align-items:flex-start;border:1px solid #334155;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#111a2b}'
      + '#afk-tc .tc-sock.f{border-color:#a16207;background:rgba(66,32,6,.35)}#afk-tc .tc-sock.lockd{opacity:.6}'
      + '#afk-tc .tc-card{width:54px;height:54px;flex:0 0 54px;border-radius:6px;border:1px solid #475569;background:#0f172a;display:flex;align-items:center;justify-content:center;position:relative}'
      + '#afk-tc .tc-card img{width:46px;height:46px;object-fit:contain}#afk-tc .tc-card img.dia{position:absolute;left:-5px;top:-5px;width:18px;height:18px}#afk-tc .tc-card.boss{border-color:#c026d3;box-shadow:0 0 6px #c026d388}#afk-tc .tc-card .st{position:absolute;right:-4px;bottom:-6px;font-size:11px;font-weight:800;color:#fde68a;background:#422006;border:1px solid #f59e0b;border-radius:99px;padding:0 4px}'
      + '#afk-tc .tc-ln{font-size:13px;line-height:1.5}#afk-tc .tc-ln.off{color:#64748b}#afk-tc .tc-ln .sb{display:inline-block;min-width:2.2em;color:#fbbf24;font-weight:700}'
      + '#afk-tc .tc-btn{padding:5px 12px;border-radius:6px;background:#a16207;color:#fff;border:1px solid #f59e0b;font-weight:700;font-size:13px;white-space:nowrap;cursor:pointer}'
      + '#afk-tc .tc-btn.g{background:#334155;border-color:#64748b}#afk-tc .tc-btn[disabled]{opacity:.4;cursor:not-allowed}'
      + '#afk-tc .tc-msg{min-height:1.3em;font-size:13px;margin:4px 0}#afk-tc .tc-msg.e{color:#fca5a5}#afk-tc .tc-msg.k{color:#86efac}'
      + '#afk-tc .tc-list{display:flex;flex-direction:column;gap:8px}'
      + '#afk-tc .tc-row{display:flex;gap:10px;align-items:flex-start;border:1px solid #334155;border-radius:8px;padding:8px 10px;background:#111a2b}'
      + '#afk-tc .tc-row .nm{font-weight:800;color:#fde68a}#afk-tc .tc-row .nm.boss{color:#f0abfc}#afk-tc .tc-row .sub{font-size:12px;color:#94a3b8}'
      + '#afk-tc .tc-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}'
      + '#afk-tc .tc-mats{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;margin-bottom:8px}#afk-tc .tc-mats span{background:#1e293b;border:1px solid #334155;border-radius:6px;padding:3px 8px}#afk-tc .tc-mats b{color:#fde68a}'
      + '#afk-tc .tc-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}#afk-tc .tc-tools input{background:#0f172a;border:1px solid #475569;border-radius:6px;color:#e2e8f0;padding:5px 8px;font-size:13px}'
      + '#afk-tc .tc-note{font-size:12px;color:#94a3b8;line-height:1.6}'
      + '@media (max-width:640px){#afk-tc .tc-doll{width:100%}#afk-tc{max-height:100vh}#afk-tc-ov{padding:0}}';
    document.head.appendChild(s);
  };
  var tplUrl = function () {
    var p = P(), M = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑妖', illusion: '幻術', dragon: '龍騎', warrior: '戰士' }, c = p && M[p.cls];
    if (!c) return 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.webp') + '?v=20260713';
    var av = String(p.avatar || ''), fe = av.indexOf('女') === 0 || av === '公主';
    return 'public/assets/login/EQ%20UI/' + encodeURIComponent((fe ? '女' : '男') + c + '.webp') + '?v=20260713';
  };
  var icoOf = function (it) { try { var d = DB.items[it.id]; return d ? (typeof getIconUrl === 'function' ? getIconUrl(d) : d.img || '') : ''; } catch (e) { return ''; } };
  var nameOf = function (it) { try { return '<span class="' + esc(typeof getItemColor === 'function' ? getItemColor(it) : '') + ' font-bold">' + getItemFullName(it) + '</span>'; } catch (e) { var d = it && DB.items[it.id]; return esc(d ? d.n : ''); } };
  var cardBox = function (n, s) {
    if (!n) return '<div class="tc-card"></div>';
    var mi = mobImg(n), c = card(n);
    return '<div class="tc-card' + (c && c.b ? ' boss' : '') + '"><img src="' + esc(mi.src) + '" data-fb="' + esc(mi.fb.join('|')) + '" alt="" onerror="if(window._mobImgErr)_mobImgErr(this);else this.style.visibility=\'hidden\'"><img class="dia" src="' + esc(diaIcon(n)) + '" alt=""><span class="st">' + STAR[s] + '</span></div>';
  };
  var abilHtml = function (n, upto) {
    return lines(n, upto).map(function (l) { return '<div class="tc-ln' + (l.on ? '' : ' off') + '"><span class="sb">' + STAR[l.s] + '</span>' + dmgLabel(esc(l.t)) + '</div>'; }).join('');
  };
  var msgHtml = function () { return '<div class="tc-msg ' + (MSGBOX.err ? 'e' : 'k') + '">' + esc(MSGBOX.err || MSGBOX.ok) + '</div>'; };
  var mats = function () {
    var p = P(), b = bag(p), tot = 0; for (var n in b) tot += b[n].reduce(function (a, x) { return a + N(x); }, 0);
    return '<div class="tc-mats"><span>解命石 <b>' + fmt(have(KEY)) + '</b></span><span>卡片背包裡的標籤卡 <b>' + fmt(tot) + '</b> 張</span></div>';
  };
  var renderDoll = function () {
    var p = P(), h = mats() + '<div class="tc-doll-wrap"><div class="tc-doll"><img class="bg" src="' + esc(tplUrl()) + '" alt="">';
    Object.keys(POS).forEach(function (k) {
      var it = p.eq[k], ok = it && eligible(it), on = V.slot === k, n = it ? holes(it) : 0, sk = it && ok ? socks(it) : [];
      h += '<button type="button" class="tc-s' + (ok ? ' ok' : ' lock') + (on ? ' on' : '') + '" data-tc="slot:' + k + '" style="left:' + POS[k][0] + '%;top:' + POS[k][1] + '%" title="' + esc(SLOTN[k]) + '">'
        + (it ? '<img src="' + esc(icoOf(it)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' : '')
        + (ok ? '<span class="tc-pips">' + [0, 1, 2].map(function (i) { return '<i class="tc-pip' + (sk[i] && sk[i].n ? ' f' : i < n ? ' o' : '') + '"></i>'; }).join('') + '</span>' : '') + '</button>';
    });
    h += '</div><div class="tc-side">';
    var it = p.eq[V.slot];
    if (!it) h += '<div class="tc-note">這一格（' + esc(SLOTN[V.slot]) + '）沒有穿裝備。</div>';
    else if (!eligible(it)) h += '<div style="font-size:15px">' + nameOf(it) + '</div><div class="tc-note" style="margin-top:6px">🔒 這件不是「至高的支配」狀態的遺物，卡洞是鎖住的。遺物昇華到支配 +5 並完成進化（至高的支配）以後，就能在這裡開卡洞。</div>';
    else {
      var n = holes(it), sk = socks(it);
      h += '<div style="font-size:15px;margin-bottom:6px">' + nameOf(it) + '　<span class="tc-note">卡洞 ' + n + '／' + HOLES + '</span></div>';
      for (var i = 0; i < HOLES; i++) {
        var x = sk[i];
        if (x && x.n) h += '<div class="tc-sock f">' + cardBox(x.n, N(x.s)) + '<div style="flex:1;min-width:0"><div class="nm" style="font-weight:800;color:#fde68a">' + esc(x.n) + ' 標籤卡 ' + STAR[N(x.s)] + '</div>' + abilHtml(x.n, N(x.s)) + '<div class="tc-act"><button type="button" class="tc-btn g" data-tc="pull:' + i + '">取下</button><button type="button" class="tc-btn" data-tc="pick:' + i + '">換一張</button></div></div></div>';
        else if (i < n) h += '<div class="tc-sock">' + cardBox(null) + '<div style="flex:1"><div style="color:#c4b5fd;font-weight:700">空卡洞</div><div class="tc-act"><button type="button" class="tc-btn" data-tc="pick:' + i + '">插入標籤卡</button></div></div></div>';
        else h += '<div class="tc-sock lockd">' + cardBox(null) + '<div style="flex:1"><div style="color:#94a3b8;font-weight:700">未開孔</div>' + (i === n ? '<div class="tc-act"><button type="button" class="tc-btn" data-tc="open"' + (have(KEY) >= HOLE_COST ? '' : ' disabled') + '>開孔（解命石 ×' + HOLE_COST + '）</button></div>' : '<div class="tc-note">要先開前一個卡洞。</div>') + '</div></div>';
      }
      if (V.pick != null && V.pick < n) h += pickList();
    }
    h += msgHtml() + '<div class="tc-note">效果只在這件裝備穿在身上時才算。插了卡（或開了卡洞）的裝備不能賣、不能在交易所上架。取下的卡會回到卡片背包，可以再插。</div></div></div>';
    return h;
  };
  var ownList = function () {   // [{n, s, c}]
    var b = bag(P()), out = [];
    Object.keys(b).forEach(function (n) { for (var s = 3; s >= 0; s--) if (N(b[n][s]) > 0) out.push({ n: n, s: s, c: N(b[n][s]) }); });
    out.sort(function (x, y) { var a = card(x.n), b2 = card(y.n); return (b2 && b2.b) - (a && a.b) || y.s - x.s || (a ? a.lv : 0) - (b2 ? b2.lv : 0); });
    return out;
  };
  var pickList = function () {
    var L = ownList();
    var h = '<div style="margin:8px 0;border:1px solid #a16207;border-radius:8px;padding:8px;background:#140e04"><div style="font-weight:800;color:#fde68a;margin-bottom:6px">選一張標籤卡插進第 ' + (V.pick + 1) + ' 個卡洞</div>';
    if (!L.length) h += '<div class="tc-note">卡片背包裡還沒有標籤卡。到「製作」分頁用鑽石卡做一張。</div>';
    else h += '<div class="tc-list" style="max-height:300px;overflow:auto">' + L.map(function (o) {
      var c = card(o.n);
      return '<div class="tc-row">' + cardBox(o.n, o.s) + '<div style="flex:1;min-width:0"><div class="nm' + (c && c.b ? ' boss' : '') + '">' + esc(o.n) + ' ' + STAR[o.s] + ' <span class="sub">×' + o.c + '</span></div>' + abilHtml(o.n, o.s) + '<div class="tc-act"><button type="button" class="tc-btn" data-tc="put:' + esc(o.n) + ':' + o.s + '">插入</button></div></div></div>';
    }).join('') + '</div>';
    return h + '<div class="tc-act"><button type="button" class="tc-btn g" data-tc="unpick">取消</button></div></div>';
  };
  var renderCards = function () {
    var p = P(), b = bag(p), q = V.q.trim();
    var names = Object.keys(DATA).filter(function (n) {
      if (q && n.indexOf(q) < 0) return false;
      if (V.own) {   // 11-19 Ping：只顯示現在就能製作或升星的
        var dia = have(diaId(n)), cnt = b[n] || [0, 0, 0, 0];
        if (dia >= MAKE) return true;
        for (var s2 = 0; s2 < 3; s2++) { var u = UP[s2 + 1]; if (N(cnt[s2]) >= u.same && dia >= u.dia) return true; }
        return false;
      }
      return true;
    });
    names.sort(function (x, y) { var a = DATA[x], c = DATA[y]; return (c.b - a.b) || (a.lv - c.lv); });
    var h = mats() + '<div class="tc-tools"><input type="search" placeholder="搜尋怪物名稱" value="' + esc(V.q) + '" data-tc-q="1"><label style="font-size:13px"><input type="checkbox" data-tc-own="1"' + (V.own ? ' checked' : '') + '> 只顯示現在能製作或升星的</label><span class="tc-note">共 ' + names.length + ' 種</span></div>' + msgHtml();
    var shown = names.slice(0, 80);
    h += '<div class="tc-list">' + (shown.length ? shown.map(function (n) {
      var c = DATA[n], dia = have(diaId(n)), cnt = b[n] || [0, 0, 0, 0], top = -1; for (var s = 3; s >= 0; s--) if (cnt[s] > 0) { top = s; break; }
      var btns = '<button type="button" class="tc-btn" data-tc="make:' + esc(n) + '"' + (dia >= MAKE ? '' : ' disabled') + '>製作 ☆0（鑽石卡 ×' + MAKE + '）</button>';
      for (var s2 = 0; s2 < 3; s2++) { var u = UP[s2 + 1]; if (cnt[s2] > 0) btns += '<button type="button" class="tc-btn" data-tc="up:' + esc(n) + ':' + s2 + '"' + (cnt[s2] >= u.same && dia >= u.dia ? '' : ' disabled') + '>升到 ' + STAR[s2 + 1] + '（' + STAR[s2] + ' ×' + u.same + '＋鑽石卡 ×' + u.dia + '）</button>'; }
      var own = [0, 1, 2, 3].filter(function (s) { return cnt[s] > 0; }).map(function (s) { return STAR[s] + ' ×' + cnt[s]; }).join('　') || '還沒有';
      return '<div class="tc-row">' + cardBox(n, Math.max(0, top)) + '<div style="flex:1;min-width:0"><div class="nm' + (c.b ? ' boss' : '') + '">' + esc(n) + (c.b ? '（頭目）' : '') + ' <span class="sub">Lv.' + c.lv + (c.r ? '・' + esc(c.r) : '') + (ELN[c.e] ? '・' + ELN[c.e] + '屬性' : '') + '</span></div>'
        + '<div class="sub">鑽石卡 ' + fmt(dia) + ' 張・標籤卡 ' + own + '</div>' + abilHtml(n, Math.max(0, top)) + '<div class="tc-act">' + btns + '</div></div></div>';
    }).join('') : '<div class="tc-note">' + (V.own ? '現在沒有能製作或升星的卡（製作要同一隻怪的鑽石卡 ×' + MAKE + '）。取消上面的勾選可以看全部。' : '沒有符合的怪物。') + '鑽石卡在席琳夢域鏡打怪才會掉（見小百科「標籤卡」）。</div>') + '</div>';
    if (names.length > shown.length) h += '<div class="tc-note" style="margin-top:6px">只列出前 80 種，用搜尋找其他的。</div>';
    return h;
  };
  var renderHelp = function () {
    return '<div class="tc-note" style="font-size:13px;color:#cbd5e1">'
      + '<p>◆ <b>開卡洞</b>：只有「至高的支配」狀態的遺物才開得了，每件最多 3 個，一個要解命石 ×' + HOLE_COST + '。</p>'
      + '<p>◆ <b>製作</b>：同一隻怪的鑽石卡 ×' + MAKE + ' → 那隻怪的標籤卡 ☆0。</p>'
      + '<p>◆ <b>升星</b>（最高 ★3）：★1＝同一張標籤卡 ×2＋鑽石卡 ×10；★2＝×3＋×20；★3＝×5＋×30。</p>'
      + '<p>◆ <b>能力</b>：一般怪的卡 4 種（☆0 一種，每升一星多一種）；頭目的卡 6 種（☆0 兩種、★1 一種、★2 一種、★3 兩種；會放法術的頭目，★2／★3 把施放機率提到 5%／8%）。</p>'
      + '<p>◆ 卡片給的易傷每張 5%，同一種最多 20%（跟其他易傷來源合計最多 50%，「限界突破」再 +5%）。</p>'
      + '<p>◆ 「基礎值」＝角色本身的點數加上配點（不含裝備、魔法、變身）。好幾張卡的換算會疊加：A→B 加到的點數，下一條 B→C 也會算進去；但每一條只算一次，A→B→C→A 繞一圈就停（順序照裝備部位、卡洞順序）。</p></div>';
  };
  var render = function (box) {
    var p = P(); if (!p) return;
    var h = '<div class="tc-hd"><b>卡片標籤</b><small>卡片工匠「命運」</small><button type="button" class="tc-x" data-tc="close" aria-label="關閉">×</button></div>'
      + '<div class="tc-tabs">' + [['doll', '鑲嵌'], ['cards', '製作與升星'], ['help', '說明']].map(function (t) { return '<button type="button" data-tc="tab:' + t[0] + '"' + (V.tab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>'
      + '<div class="tc-body">' + (V.tab === 'doll' ? renderDoll() : V.tab === 'cards' ? renderCards() : renderHelp()) + '</div>';
    var bd = box.querySelector('.tc-body'), top = bd ? bd.scrollTop : 0;
    box.innerHTML = h;
    var nb = box.querySelector('.tc-body'); if (nb) nb.scrollTop = top;
  };
  var view = function () { return document.getElementById('afk-tc'); };
  var refresh = function () { var b = view(); if (b) render(b); };
  // 11-19：手機版的殼會把 #afk-tc（role=dialog）搬進自己的頁面，所以事件掛在 #afk-tc 上、關閉時兩個都拿掉
  var close = function () { var o = document.getElementById('afk-tc-ov'); if (o) o.remove(); var b = document.getElementById('afk-tc'); if (b) b.remove(); };
  var open = function (tab) {
    var p = P(); if (!p || classic(p)) return;
    css(); close(); MSGBOX.err = MSGBOX.ok = ''; V.pick = null; if (tab) V.tab = tab;
    if (!p.eq[V.slot] || !eligible(p.eq[V.slot])) { var f = EQK.filter(function (k) { return p.eq[k] && eligible(p.eq[k]); })[0]; if (f) V.slot = f; }
    var ov = document.createElement('div'); ov.id = 'afk-tc-ov';
    ov.innerHTML = '<div id="afk-tc" role="dialog" aria-label="卡片標籤"></div>';
    var box = ov.firstChild;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-tc]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-tc').split(':');
      MSGBOX.err = MSGBOX.ok = '';
      if (a[0] === 'close') return close();
      if (a[0] === 'tab') { V.tab = a[1]; V.pick = null; }
      else if (a[0] === 'slot') { V.slot = a[1]; V.pick = null; }
      else if (a[0] === 'pick') V.pick = Number(a[1]);
      else if (a[0] === 'unpick') V.pick = null;
      else if (a[0] === 'open') act.open(V.slot);
      else if (a[0] === 'pull') act.pull(V.slot, Number(a[1]));
      else if (a[0] === 'put') { act.put(V.slot, V.pick, a[1], Number(a[2])); V.pick = null; }
      else if (a[0] === 'make') act.make(a[1]);
      else if (a[0] === 'up') act.up(a[1], Number(a[2]));
      refresh();
    });
    box.addEventListener('input', function (e) { if (e.target.getAttribute('data-tc-q')) { V.q = e.target.value; clearTimeout(open._t); open._t = setTimeout(function () { refresh(); var i = document.querySelector('#afk-tc [data-tc-q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });
    box.addEventListener('change', function (e) { if (e.target.getAttribute('data-tc-own')) { V.own = !!e.target.checked; refresh(); } });
    document.body.appendChild(ov); refresh();
    // 手機版：殼把視窗搬走後，留下的空白遮罩（全螢幕、z-index 9000）會擋住整個畫面 → 拿掉
    var drop = function () { if (box.parentNode !== ov && ov.parentNode) ov.remove(); };
    setTimeout(drop, 0); setTimeout(drop, 300); setTimeout(drop, 1000);
  };

  // ── 裝備視窗第二頁「箭筒」位置的格子 ──
  W.__afkTagSlotOn = function (p) { return !!(p && !classic(p) && (!T || T.enabled('tagcard'))); };
  W.__afkTagSlotClick = function () { open('doll'); };
  var decorate = function () {
    try {
      var s = document.querySelector('#equipment-window-slots [data-slot="tagcard"]'); if (!s || s.__tc) return; s.__tc = 1;
      s.innerHTML = '<span style="display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;color:#fde68a;font-weight:800;font-size:clamp(9px,1.6vw,13px);text-shadow:0 1px 2px #000"><img alt="" src="assets/icons/tagcard_slot.webp" style="width:70%;max-width:56px;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 1px 2px #000)" onerror="this.outerHTML=\'<span style=&quot;font-size:2.6em;line-height:1&quot;>🃏</span>\'">卡片標籤</span>';
      s.classList.add('is-filled');
    } catch (e) {}
  };
  if (typeof MutationObserver === 'function') {
    var watch = function () { var host = document.getElementById('equipment-window-slots'); if (!host) return setTimeout(watch, 1500); new MutationObserver(decorate).observe(host, { childList: true }); decorate(); };
    watch();
  }

  // ── NPC：佩特拉後裔村 卡片工匠「命運」 ──
  var NPC_ID = 'npc_afk_tagsmith', NPC_N = '卡片工匠「命運」';
  var addNpc = function () {
    var K = kit(); if (!K) return;
    K.addNpc('town_petra', { id: NPC_ID, n: NPC_N, title: '卡片標籤', type: 'quest', classicHide: true, d: '在沙漠裡替旅人把怪物的命運刻進卡片的工匠。把鑽石卡做成標籤卡，再鑲進「至高的支配」裝備的卡洞。' });
    K.hookNpc(NPC_ID, NPC_N, '卡片標籤', function (box) {
      if (!box) return; K.css();
      box.innerHTML = '<div class="afk-ax"><p class="ax-lore">「每一張鑽石卡，都記著一隻怪物的命運。十張疊在一起，命運就會變成你的。」</p>'
        + '<div class="ax-row"><div class="ax-main"><div><div class="ax-name">卡片標籤</div><div class="ax-desc">製作、升星標籤卡；在「至高的支配」裝備上開卡洞、鑲嵌。</div></div></div><div class="ax-act"><button type="button" data-tcnpc="1">打開卡片標籤</button></div></div></div>';
      var b = box.querySelector('[data-tcnpc]'); if (b) b.onclick = function () { open('doll'); };
      open('doll');
    });
  };

  // 交易所：開了卡洞的裝備不能上架（afk-trade whyNot 呼叫 W.__afkTagHasHoles）

  // ── 小百科 ──
  var wiki = function (u) {
    var wCard = u.wCard, wTbl = u.wTbl, wDesc = u.wDesc;
    var out = '<div class="m-wiki-note">把怪物的鑽石卡做成<b>標籤卡</b>，鑲進「至高的支配」裝備的卡洞，就能得到那隻怪物的能力。可以從裝備視窗第二頁的「卡片標籤」打開，也可以找<b>佩特拉後裔村</b>的卡片工匠「命運」。</div>';
    out += wCard('🃏 怎麼玩', wTbl(['步驟', '說明'], [
      ['1. 開卡洞', '只有「至高的支配」的遺物裝備有卡洞，每件 3 個。開一個要<b>解命石 ×' + HOLE_COST + '</b>。'],
      ['2. 製作', '同一隻怪的<b>鑽石卡 ×' + MAKE + '</b>，做成那隻怪的標籤卡 ☆0。'],
      ['3. 升星', '最高 ★3：' + [1, 2, 3].map(function (s) { return STAR[s] + '＝同一張標籤卡 ×' + UP[s].same + '＋鑽石卡 ×' + UP[s].dia; }).join('；') + '。'],
      ['4. 鑲嵌', '把標籤卡插進卡洞，裝備<b>穿在身上</b>時就有效果。取下來的卡會回到卡片背包，可以再插到別件。']
    ]));
    out += wCard('🃏 星等與能力', wTbl(['卡片', '☆0', '★1', '★2', '★3', '合計'], [
      ['一般怪', '1 種', '+1', '+1', '+1', '4 種'],
      ['頭目', '2 種', '+1（通常是攻擊時有機會施放頭目的法術）', '+1（施放機會提高）', '+2（頭目專屬能力，施放機會再提高）', '6 種']
    ]) + wDesc('頭目 ★3 的專屬能力依頭目而不同：有的會在你被攻擊時施放法術反擊，有的讓目標同時受到兩種屬性易傷；龍族與高等級頭目還多一個「限界突破」，易傷可以疊得更高。')
      + wDesc('每張卡的能力，在「卡片標籤」視窗的「製作與升星」分頁都看得到，還沒升到的星會變暗。'));
    out += wCard('🃏 能力種類', wTbl(['種類', '內容'], [
      ['屬性換算', '依你某項能力值是單數還是雙數，提升另一項能力值。怪物等級越高的卡，加得越多。好幾張卡可以互相串起來。'],
      ['傷害', '對小型／大型怪、對某種族或屬性的怪、近距離／遠距離／魔法、對頭目的傷害提升。'],
      ['觸發', '下一次攻擊加重、追擊、魔法共鳴、施放怪物的法術、被攻擊時反擊。'],
      ['易傷', '命中時讓目標受到的物理、魔法或某屬性傷害提高一段時間。'],
      ['生存', '減少受到的傷害（某屬性、頭目、魔法或物理）、HP 低時減傷、抵抗異常狀態、次元裂縫侵蝕變慢、致命一擊時保留 1 HP。'],
      ['治癒', '定時回血、命中回血、打倒怪物回血回魔、藥水效果提升、溢補護盾、定時回魔。'],
      ['寵物', '寵物與召喚物傷害提升、寵物攻擊時替你回血、寵物撕咬可以疊更多層。']
    ]));
    out += wCard('🃏 材料取得', wTbl(['材料', '取得'], [
      ['鑽石卡', '怪物卡冊的最高階卡片，只有<b>席琳夢域鏡</b>的怪物會掉，非常稀有；組隊和幸運暴走兔腳能提高機會。第一次拿到會先登錄卡冊，之後多的才會留在背包。'],
      ['解命石', '燃柳村的符文師佐爾頓：瘴氣魔石 1,000＋骸骨魔石 500＋破空石 100 換 1 顆。夢域鏡任務線「水面下的證詞」第 5、7 章和終焉第三階層，第一次完成時也各給 1 顆。'],
      ['至高的支配', '遺物昇華支配到 +5，再完成進化。']
    ]));
    out += wCard('🃏 注意', wDesc('開了卡洞或插了卡的裝備，不能賣給商人，也不能在交易所上架。') + wDesc('標籤卡放在「卡片背包」（卡片標籤視窗裡），不佔背包格子。鑽石卡與標籤卡都不能交易。'));
    return out;
  };

  W.__afkTagCard = { DATA: DATA, open: open, close: close, lines: lines, fxText: fxText, agg: agg, bump: bump, eligible: eligible, holes: holes, act: act, bag: bag, wiki: wiki, UP: UP, MAKE: MAKE, HOLE_COST: HOLE_COST };

  var hookAll = function () { hookProc(); hookCastEle(); hookPet(); hookMisc(); hookSell(); hookDesc(); };
  hookAll(); addNpc();
  W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); setTimeout(function () { var p = P(); if (p) bump(); }, 3500); });
})();
