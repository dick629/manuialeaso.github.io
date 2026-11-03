/* ============================================================================
 * afk-mio.js — 密奧之卡（塔羅牌 22 張）第二版（玩家 2026-11-02 13:10 定案；設計稿 docs/mio-sigil-design.md 第四版；外掛開關 mio；經典模式沒有）
 *
 *   一、取得：席琳夢域鏡裡一般怪物 0.001%、頭目 0.1% 掉「密奧碎片」，乘隊伍人數（最多 ×16）；
 *       碎片不受隱藏規則十二（夢域鏡隊伍人數不加掉寶）影響。
 *       碎片 ×10 點亮一張還沒點亮的卡（偉特）；×20 升托特；×30 升馬賽。
 *   二、裝備：密奧欄位（裝備視窗第二頁、刻印下面）只能裝一張。
 *       ‧裝著的卡：用它目前階段的特效；托特以上另外有「保底」與「光環」：
 *           保底＝最大 HP、傷害減免、魔防、防禦、迴避、額外傷害、額外命中低於職業標準的補到標準（托特＝曲線 65、馬賽＝曲線 75）
 *           光環＝托特：五屬性抗性 +15；馬賽：五屬性抗性 +25、異常狀態抵抗 +15%
 *       ‧其他點亮的卡：全部一起給偉特的特效（「世界」會放大這些偉特）。
 *   三、收集加成（可疊加）：全部點亮＝最大 HP +5%、五屬性抗性 +10；全部托特以上＝造成傷害 +5%、受到傷害 −5%；
 *       全部馬賽＝造成傷害 +10%、受到傷害 −10%。
 *   觸發時角色頭上浮出卡的小圖和卡名，戰鬥日誌同一張卡每 5 秒最多一行（共用 afk-procfx.js）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mio', name: '密奧之卡（塔羅牌）', group: '遊戲內容', seal: true,
    desc: '席琳夢域鏡掉密奧碎片，點亮 22 張塔羅牌（偉特→托特→馬賽）；每張有自己的特效，裝著的那張托特以上另有保底與光環，其他點亮的卡給偉特特效' });
  if (T && !T.enabled('mio')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var on = function (p) { return !!(p && !p.classicMode); };
  var tk = function () { return (typeof state !== 'undefined' && state) ? (Number(state.ticks) || 0) : 0; };
  var rnd = function () { return api.roll(); };

  var SHARD = 'afk_mio_shard', RATE = { mob: 0.00001, boss: 0.001 }, COST = [10, 20, 30];
  var STAGE = ['', '偉特', '托特', '馬賽'], STAGE_C = ['', '#93c5fd', '#c4b5fd', '#fcd34d'];
  var ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  // 每張卡：名字、各階段數值（[偉特, 托特, 馬賽]）、說明
  var CARDS = [
    ['愚者', { red: [30, 75, 100], cd: [90, 45, 30] }, function (v) { return '每 ' + v.cd + ' 秒，下一次受到的傷害 −' + v.red + '%'; }],
    ['魔術師', { ch: [4, 10, 15] }, function (v) { return '攻擊魔法 ' + v.ch + '% 機率再施放一次（傷害 ×2，不耗 MP）'; }],
    ['女祭司', { pct: [1, 2, 3], dur: [5, 8, 10], cd: [90, 60, 60] }, function (v) { return 'MP 低於 30% 時，' + v.dur + ' 秒內每秒回復最大 MP ' + v.pct + '%（冷卻 ' + v.cd + ' 秒）'; }],
    ['女皇', { pct: [15, 35, 50] }, function (v) { return '喝治癒藥水時，傭兵全隊也回同樣回復量的 ' + v.pct + '%'; }],
    ['皇帝', { pct: [2, 5, 8] }, function (v) { return '傭兵受到的傷害 −' + v.pct + '%'; }],
    ['教皇', { ch: [10, 25, 35], heal: [2, 5, 8] }, function (v) { return '中異常狀態時 ' + v.ch + '% 機率立刻解除，並回復最大 HP ' + v.heal + '%'; }],
    ['戀人', { pct: [2, 5, 8] }, function (v) { return '每 5 秒，你和傭兵裡 HP 比例最低的那位回復最大 HP ' + v.pct + '%'; }],
    ['戰車', { per: [1, 2, 2], max: [5, 8, 10] }, function (v) { return '一般攻擊連續打同一個目標，每下傷害 +' + v.per + '%，最多 ' + v.max + ' 層'; }],
    ['力量', { pct: [10, 25, 40] }, function (v) { return '一般攻擊爆擊時，傷害再 +' + v.pct + '%'; }],
    ['隱者', { per: [0.3, 1, 1.5] }, function (v) { return '比 16 人每少 1 人，造成的傷害 +' + v.per + '%（最多 15 人份）'; }],
    ['命運之輪', { dmg: [4, 9, 12], red: [4, 9, 12], reg: [0.7, 1.5, 2] }, function (v) { return '每 30 秒隨機得到一種，持續 30 秒：造成傷害 +' + v.dmg + '%／受到傷害 −' + v.red + '%／每秒回復最大 HP ' + v.reg + '%'; }],
    ['正義', { pct: [20, 50, 80] }, function (v) { return '受到攻擊時，對攻擊者反擊這次傷害的 ' + v.pct + '%（每秒最多一次）'; }],
    ['吊人', { pct: [10, 25, 35] }, function (v) { return 'HP 低於 30% 時受到的傷害 −' + v.pct + '%'; }],
    ['死神', { pct: [5, 15, 20] }, function (v) { return '一般怪物 HP 低於 ' + v.pct + '% 時直接斬殺（頭目不算）'; }],
    ['節制', { pot: [5, 20, 30], cap: [3, 8, 12] }, function (v) { return '治癒藥水回復量 +' + v.pot + '%；補滿溢出的部分變成護盾（最多最大 HP ' + v.cap + '%）'; }],
    ['惡魔', { leech: [0.5, 2, 3], cost: [0, 5, 3] }, function (v) { return '造成傷害的 ' + v.leech + '% 回復 HP' + (v.cost ? '；受到的傷害 +' + v.cost + '%' : ''); }],
    ['高塔', { pct: [5, 20, 30] }, function (v) { return '頭目的百分比機制傷害（王登場衝擊、時空暴走、裂痕崩塌等）−' + v.pct + '%'; }],
    ['星星', { hp: [15, 35, 50], cd: [15, 8, 5] }, function (v) { return '倒下時立刻以最大 HP ' + v.hp + '% 站起來（每 ' + v.cd + ' 分鐘一次）'; }],
    ['月亮', { er: [2, 8, 12], crit: [0, 1, 1] }, function (v) { return '迴避 +' + v.er + (v.crit ? '；迴避成功後，下一次一般攻擊必定爆擊' : ''); }],
    ['太陽', { pct: [0.5, 2, 3] }, function (v) { return '打倒一般怪物時回復最大 HP 與 MP 各 ' + v.pct + '%'; }],
    ['審判', { pct: [4, 12, 18] }, function (v) { return '頭目 HP 低於 50% 後，對它的傷害 +' + v.pct + '%'; }],
    ['世界', { mult: [1.1, 1.3, 1.5] }, function (v) { return '其他點亮的卡給的偉特效果 ×' + v.mult; }]
  ];
  var K = {}; ['fool', 'magician', 'priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot', 'strength', 'hermit', 'wheel', 'justice', 'hanged', 'death', 'temperance', 'devil', 'tower', 'star', 'moon', 'sun', 'judgement', 'world'].forEach(function (k, i) { K[k] = i; });
  var SET = [
    { n: '22 張全部點亮', txt: '最大 HP +5%、五屬性抗性 +10', fx: { mhpPct: 5, res: 10 } },
    { n: '22 張全部托特以上', txt: '造成的傷害 +5%、受到的傷害 −5%', fx: { dmg: 5, taken: 5 } },
    { n: '22 張全部馬賽', txt: '造成的傷害 +10%、受到的傷害 −10%', fx: { dmg: 10, taken: 10 } }
  ];
  var AURA = [null, null, { res: 15, abn: 0 }, { res: 25, abn: 15 }];
  // 保底（曲線 65／75；最大 HP、傷害減免、魔防、防禦、迴避、額外傷害、額外命中；2026-11-02 量測，新角色未轉生，裝備照曲線對照表）
  var STD = {"65":{"royal":[2081,71,124,-107,48,70,25],"knight":[3382,73,80,-130,66,50,33],"elf":[1846,67,141,-101,69,50,50],"mage":[2163,71,182,-150,43,50,30],"dark":[2020,67,189,-135,55,50,63],"dragon":[2615,73,153,-126,65,83,33],"illusion":[1799,71,225,-153,60,70,50],"warrior":[3357,71,70,-103,62,75,33]},
    "75":{"royal":[2081,121,139,-149,52,70,25],"knight":[3382,104,98,-175,71,50,33],"elf":[1846,97,156,-143,74,50,50],"mage":[2163,102,200,-195,49,50,30],"dark":[2020,97,204,-177,60,50,63],"dragon":[2615,104,171,-171,70,83,33],"illusion":[1799,102,243,-198,66,70,50],"warrior":[3357,101,85,-145,66,75,33]}};
  var STD_N = ['最大 HP', '傷害減免', '魔防', '防禦', '迴避', '額外傷害', '額外命中'];
  var idOf = function (i) { return 'afk_mio_' + (i < 10 ? '0' : '') + i; };
  var idxOf = function (id) { var m = /^afk_mio_(\d\d)$/.exec(id || ''); return m ? Number(m[1]) : -1; };
  var rawVal = function (i, st) { var o = {}, V = CARDS[i][1]; Object.keys(V).forEach(function (k) { o[k] = V[k][Math.max(1, Math.min(3, st)) - 1]; }); return o; };
  var descOf = function (i, st) { return CARDS[i][2](rawVal(i, st)); };
  var auraTxt = function (st) { var a = AURA[st]; return a ? '五屬性抗性 +' + a.res + (a.abn ? '、異常狀態抵抗 +' + a.abn + '%' : '') : ''; };

  // ── 道具 ──
  if (!DB.items[SHARD]) DB.items[SHARD] = { n: '密奧碎片', type: 'etc', eff: 'afk_mio', req: 'all', p: 0, gachaWeight: 0, noJunk: true, noSell: true, c: 'text-fuchsia-300',
    img: 'assets/icons/items/afk_mio_shard.png', d: '從席琳夢域鏡的夢裡剝落的塔羅牌碎片。10 個點亮一張密奧之卡，20 個升到托特，30 個升到馬賽。使用後打開密奧之卡。' };
  CARDS.forEach(function (c, i) {
    var id = idOf(i), d = DB.items[id] || (DB.items[id] = {});
    Object.assign(d, { n: '密奧之卡・' + ROMAN[i] + ' ' + c[0], type: 'acc', slot: 'mio', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, noSell: true, noJunk: true,
      c: 'text-fuchsia-300', img: 'assets/icons/items/' + id + '.png', afkMio: i,
      d: '只能裝一張。偉特：' + descOf(i, 1) + '。托特：' + descOf(i, 2) + '；' + auraTxt(2) + '；基本能力不足時補到托特標準。馬賽：' + descOf(i, 3) + '；' + auraTxt(3) + '；基本能力不足時補到馬賽標準（各職業的標準在密奧之卡介面）。沒裝著的點亮卡只給偉特。' });
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[d.n] == null) ITEM_WEIGHTS[d.n] = 0; } catch (e) {}
  });
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS.indexOf('mio') < 0) WEIGHT_COUNT_SLOTS.push('mio'); } catch (e) {}
  W.__afkMioSlotOn = function (p) { return on(p) && (!T || T.enabled('mio')); };

  // ── 狀態 ──
  var store = function (p) { p.afkMio = p.afkMio || { cards: {} }; p.afkMio.cards = p.afkMio.cards || {}; return p.afkMio; };
  var stageOf = function (p, i) { return Number(store(p).cards[i]) || 0; };
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, it) { return s + (it && it.id === id && !it.lock ? Math.max(1, Number(it.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (count(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var equippedIdx = function (p) { var e = p && p.eq && p.eq.mio; return e ? idxOf(e.id) : -1; };
  // 目前生效的狀態：每張點亮的卡用哪個階段、數值（含「世界」放大）、收集、保底
  var compute = function (p) {
    var o = { act: {}, lit: 0, th: 0, ma: 0, eq: -1, eqSt: 0, set: {} };
    if (!on(p)) return o;
    var s = store(p), eq = equippedIdx(p);
    o.eq = eq; o.eqSt = eq >= 0 ? stageOf(p, eq) : 0;
    var wSt = stageOf(p, K.world), wMult = wSt > 0 ? rawVal(K.world, eq === K.world ? wSt : 1).mult : 1;
    CARDS.forEach(function (c, i) {
      var st = Number(s.cards[i]) || 0; if (st <= 0) return;
      o.lit++; if (st >= 2) o.th++; if (st >= 3) o.ma++;
      var use = i === eq ? st : 1, v = rawVal(i, use);
      if (i !== eq && i !== K.world && wMult !== 1) Object.keys(v).forEach(function (k) { if (k !== 'cd' && k !== 'dur' && k !== 'max' && k !== 'crit') v[k] = Math.round(v[k] * wMult * 100) / 100; });
      o.act[i] = { st: use, v: v };
    });
    var n = CARDS.length;
    [o.lit, o.th, o.ma].forEach(function (c, k) { if (c >= n) Object.keys(SET[k].fx).forEach(function (f) { o.set[f] = (o.set[f] || 0) + SET[k].fx[f]; }); });
    return o;
  };
  var cache = null;
  var cur = function () { var p = P(); if (!cache || cache.p !== p) cache = { p: p, v: compute(p) }; return cache.v; };
  var A = function (k) { var a = cur().act[K[k]]; return a ? a.v : null; };
  var refresh = function () { cache = null; try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var fire = function (k, extra) {
    var i = K[k]; if (!X) return;
    var img = (DB.items[idOf(i)] || {}).img;
    X.pop('mio' + i, img, CARDS[i][0] + (extra ? ' ' + extra : ''), '#f0abfc');
    X.note('mio' + i, '<span style="color:#f0abfc">🃏【' + CARDS[i][0] + '】</span>' + esc(descOf(i, (cur().act[i] || {}).st || 1)));
  };

  // ── 數值類效果：重算時套用（保底、光環、收集、迴避）──
  var RES = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      cache = null;
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (p && p.d && on(p)) {
          var c = cur(), d = p.d, res = c.set.res || 0;
          var moon = A('moon'); if (moon) d.er = (Number(d.er) || 0) + moon.er;
          var aura = AURA[c.eqSt]; if (aura) res += aura.res;
          if (res) RES.forEach(function (k) { d[k] = (Number(d[k]) || 0) + res; });
          var std = c.eqSt >= 2 ? (STD[c.eqSt >= 3 ? '75' : '65'] || {})[p.cls] : null;
          if (std) {
            d.dr = Math.max(Number(d.dr) || 0, std[1]); d.mr = Math.max(Number(d.mr) || 0, std[2]); d.ac = Math.min(Number(d.ac) || 0, std[3]);
            d.er = Math.max(Number(d.er) || 0, std[4]); d.extraDmg = Math.max(Number(d.extraDmg) || 0, std[5]); d.extraHit = Math.max(Number(d.extraHit) || 0, std[6]);
          }
        }
        // 光環的異常狀態抵抗：掛在裝著的那張卡上（密奧欄位在 WEIGHT_COUNT_SLOTS 裡，核心的抵抗判定會掃到）
        CARDS.forEach(function (x, i) { var dd = DB.items[idOf(i)]; if (dd) dd.abnormalResist = 0; });
        if (p && on(p)) { var cc = cur(), a2 = AURA[cc.eqSt]; if (a2 && a2.abn && cc.eq >= 0) DB.items[idOf(cc.eq)].abnormalResist = a2.abn; }
      } catch (e) { console.warn('[AFK-mio]', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  var maxAdd = function (p) {
    if (!p || p !== P() || !on(p)) return;
    var c = compute(p);
    if (c.set.mhpPct) p.mhp = Math.floor((p.mhp || 0) * (1 + c.set.mhpPct / 100));
    var std = c.eqSt >= 2 ? (STD[c.eqSt >= 3 ? '75' : '65'] || {})[p.cls] : null;
    if (std) p.mhp = Math.max(p.mhp || 0, std[0]);
  };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(maxAdd);
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { var t = A('temperance'); if (t) v += t.pot; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  // 高塔：頭目的百分比機制傷害
  var prevIn = W.__afkIncomingMod;
  W.__afkIncomingMod = function (t, dmg) { var v = typeof prevIn === 'function' ? prevIn.apply(this, arguments) : dmg; try { var p = P(), tw = A('tower'); if (tw && t === p && v > 0) { v = v * (1 - tw.pct / 100); fire('tower'); } } catch (e) {} return v; };

  // ── 受到傷害的百分比（核心合併、上限 75%）──
  var wheel = { kind: -1, until: 0, next: 0 };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(); if (!p || !on(p)) return 1;
    var c = cur(), m = 1;
    if (ent === p) {
      if (c.set.taken) m *= 1 - c.set.taken / 100;
      var hg = A('hanged'); if (hg && (p.hp || 0) < (p.mhp || 1) * 0.3) { m *= 1 - hg.pct / 100; fire('hanged'); }
      var dv = A('devil'); if (dv && dv.cost && c.eq === K.devil) m *= 1 + dv.cost / 100;
      var wh = A('wheel'); if (wh && wheel.kind === 1 && tk() < wheel.until) m *= 1 - wh.red / 100;
    } else if ((p.allies || []).indexOf(ent) >= 0) {
      var em = A('emperor'); if (em) m *= 1 - em.pct / 100;
    }
    return m;
  });

  if (X) {
    var fool = { at: 0 }, just = { at: 0 }, star = { at: -1e9 }, chariot = { t: null, n: 0 }, pri = { until: 0, at: -1e9, next: 0 }, lov = { next: 0 };
    // 受到傷害之後（護盾之前）：愚者、正義
    X.on('taken', function (ent, dmg, mob) {
      var p = P(); if (!p || ent !== p || !(dmg > 0) || !on(p)) return dmg;
      var f = A('fool');
      if (f && tk() >= fool.at) { fool.at = tk() + f.cd * 10; dmg = dmg * (1 - f.red / 100); fire('fool'); }
      var j = A('justice');
      if (j && mob && !mob._dead && tk() >= just.at) { just.at = tk() + 10; if (X.hitMob(mob, dmg * j.pct / 100) > 0) fire('justice'); }
      return dmg;
    });
    // 造成傷害
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(); if (!p || actor !== p || !on(p)) return v;
      var c = cur(), m = 1;
      if (c.set.dmg) m *= 1 + c.set.dmg / 100;
      var mg = A('magician'); if (mg && opt.kind === 'magic' && rnd() < mg.ch / 100) { m *= 2; fire('magician'); }
      var ch = A('chariot');
      if (ch && opt.packet) { if (chariot.t === target) chariot.n = Math.min(ch.max, chariot.n + 1); else { chariot.t = target; chariot.n = 0; } if (chariot.n > 0) m *= 1 + ch.per * chariot.n / 100; }
      var sg = A('strength'); if (sg && opt.packet && opt.packet.crit) { m *= 1 + sg.pct / 100; fire('strength'); }
      var hm = A('hermit'); if (hm) m *= 1 + hm.per * Math.max(0, 16 - X.party()) / 100;
      var wh = A('wheel'); if (wh && wheel.kind === 0 && tk() < wheel.until) m *= 1 + wh.dmg / 100;
      var jg = A('judgement'); if (jg && target.boss && target.hp > 0 && target.curHp < target.hp * 0.5) m *= 1 + jg.pct / 100;
      v = v * m;
      var dt = A('death'); if (dt && !target.boss && target.hp > 0 && (target.curHp - v) > 0 && (target.curHp - v) < target.hp * dt.pct / 100) { v = Math.max(v, target.curHp); fire('death'); }
      var dv = A('devil'); if (dv) { var heal = Math.floor(Math.min(v, Math.max(0, target.curHp)) * dv.leech / 100); if (heal > 0) p.hp = Math.min(p.mhp || p.hp, p.hp + heal); }
      return v;
    });
    // 每一刻：女祭司、戀人、命運之輪
    X.on('tick', function () {
      var p = P(); if (!p || !on(p) || p.dead) return;
      var t = tk();
      var pr = A('priestess');
      if (pr) {
        if (t >= pri.at && (p.mp || 0) < (p.mmp || 1) * 0.3 && X.inCombat()) { pri.at = t + pr.cd * 10; pri.until = t + pr.dur * 10; pri.next = t; fire('priestess'); }
        if (t < pri.until && t >= pri.next) { pri.next = t + 10; p.mp = Math.min(p.mmp || p.mp, (p.mp || 0) + Math.floor((p.mmp || 0) * pr.pct / 100)); }
      }
      var lv = A('lovers');
      if (lv && t >= lov.next && X.inCombat()) {
        lov.next = t + 50;
        var best = null, br = 1;
        [p].concat((p.allies || []).filter(function (a) { return a && !a._downed; })).forEach(function (e) { var hp = e === p ? p.hp : e.curHp, mx = e.mhp || 1, r = hp / mx; if (r < br) { br = r; best = e; } });
        if (best && br < 1) { var amt = Math.floor((best.mhp || 0) * lv.pct / 100); if (best === p) p.hp = Math.min(p.mhp, p.hp + amt); else best.curHp = Math.min(best.mhp, best.curHp + amt); fire('lovers'); }
      }
      var wh = A('wheel');
      if (wh && X.inCombat()) {
        if (t >= wheel.next) { wheel.next = t + 300; wheel.until = t + 300; wheel.kind = Math.floor(rnd() * 3) % 3; fire('wheel', ['傷害', '減傷', '回復'][wheel.kind]); }
        if (wheel.kind === 2 && t < wheel.until && t % 10 === 0) p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * wh.reg / 100));
      }
    });
    // 打倒怪物：太陽
    X.on('kill', function (m) {
      var p = P(), s = A('sun'); if (!p || !s || m.boss || !on(p)) return;
      p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * s.pct / 100)); p.mp = Math.min(p.mmp, p.mp + Math.floor(p.mmp * s.pct / 100)); fire('sun');
    });
    // 迴避：月亮（托特以上）
    X.on('evade', function () { var p = P(), mo = A('moon'); if (p && mo && mo.crit && on(p)) { p._darkEvadeCrit = true; fire('moon'); } });
    // 倒下：星星
    X.on('death', function () {
      var p = P(), s = A('star'); if (!p || !s || !on(p)) return false;
      if (tk() - star.at < s.cd * 600) return false;
      star.at = tk(); p.hp = Math.max(1, Math.floor(p.mhp * s.hp / 100)); fire('star'); return true;
    });
    // 治癒藥水：女皇、節制
    X.on('potion', function (d, est, hp0) {
      var p = P(); if (!p || !on(p)) return;
      var e = A('empress');
      if (e) { var a = Math.floor(est * e.pct / 100); (p.allies || []).forEach(function (x) { if (x && !x._downed && x.curHp > 0) x.curHp = Math.min(x.mhp, x.curHp + a); }); fire('empress'); }
      var tp = A('temperance');
      if (tp) { var over = est - Math.max(0, (p.mhp || 0) - hp0); if (over > 0) { X.shield.add(over, Math.floor(p.mhp * tp.cap / 100)); fire('temperance'); } }
    });
    // 異常狀態：教皇
    X.on('resist', function () {
      var p = P(), h = A('hierophant'); if (!p || !h || !on(p)) return false;
      if (rnd() < h.ch / 100) { p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * h.heal / 100)); fire('hierophant'); return true; }
      return false;
    });
  }

  // ── 掉落：夢域鏡；一般怪 0.001%、頭目 0.1%，乘隊伍人數（不受隱藏規則十二影響）──
  var dream = function () { var p = P(); if (!p || p.classicMode) return false; try { if (W.__afkDreamHell && W.__afkDreamHell.on) return !!W.__afkDreamHell.on(); } catch (e) {} return !!(p.sherineDream && p.sherineMad); };
  if (X) X.on('kill', function (m) {
    if (m._afkMioRoll || !dream() || m._train) return; m._afkMioRoll = true;
    var rate = (m.boss ? RATE.boss : RATE.mob) * X.party();
    if (rnd() < rate) { gainItem(SHARD, 1, true, true); sys('<span class="font-bold" style="color:#f0abfc">🃏 ' + esc(m.n) + ' 的夢裡剝落了一片「密奧碎片」。</span>'); }
  });

  // ── 開卡、升階、裝備 ──
  var openCard = function () {
    var p = P(); if (!on(p)) return -1;
    var s = store(p), pool = []; CARDS.forEach(function (c, i) { if (!(Number(s.cards[i]) > 0)) pool.push(i); });
    if (!pool.length) { sys('<span class="text-amber-300">22 張密奧之卡已經全部點亮了。</span>'); return -1; }
    if (!take(SHARD, COST[0])) { sys('<span class="text-amber-300">密奧碎片不夠（要 ' + COST[0] + ' 個）。</span>'); return -1; }
    var i = pool[Math.floor(rnd() * pool.length) % pool.length];
    s.cards[i] = 1; gainItem(idOf(i), 1, true, true);
    sys('<span class="font-bold" style="color:#f0abfc">🃏 碎片拼回了一張牌——密奧之卡「' + ROMAN[i] + ' ' + CARDS[i][0] + '」（偉特）亮了起來。</span>');
    refresh(); try { saveGame(); } catch (e) {}
    return i;
  };
  var upgrade = function (i) {
    var p = P(); if (!on(p) || !CARDS[i]) return false;
    var st = stageOf(p, i); if (st <= 0 || st >= 3) return false;
    var cost = COST[st], DC = window.__afkDiaCost, dc = DC ? DC.COST.mioUp : 0, miss = DC ? DC.check(dc) : null;   // 2026-11-03：升級另收龍鑽 5,000＋金幣
    if (miss) { sys('<span class="text-amber-300">升級密奧之卡要' + DC.txt(dc) + '：' + miss + '。</span>'); return false; }
    if (!take(SHARD, cost)) { sys('<span class="text-amber-300">密奧碎片不夠（要 ' + cost + ' 個）。</span>'); return false; }
    if (DC) DC.pay(dc);
    store(p).cards[i] = st + 1;
    sys('<span class="font-bold" style="color:' + STAGE_C[st + 1] + '">🃏 密奧之卡「' + ROMAN[i] + ' ' + CARDS[i][0] + '」升到' + STAGE[st + 1] + '。</span>');
    refresh(); try { saveGame(); } catch (e) {}
    return true;
  };
  var equipCard = function (i) {
    var p = P(); if (!on(p) || stageOf(p, i) <= 0) return false;
    var id = idOf(i);
    if (p.eq && p.eq.mio && p.eq.mio.id === id) return true;
    var it = (p.inv || []).find(function (x) { return x && x.id === id; });
    if (!it) { gainItem(id, 1, true, true); it = (p.inv || []).find(function (x) { return x && x.id === id; }); }   // 卡片道具不見了就補一張
    if (!it) return false;
    try { equipItem(it); } catch (e) { return false; }
    refresh();
    return !!(p.eq.mio && p.eq.mio.id === id);
  };
  // 目前生效的效果（介面用）
  var summary = function (p) {
    var c = compute(p), out = [];
    Object.keys(c.act).forEach(function (i) { i = Number(i); var a = c.act[i]; out.push({ i: i, st: a.st, t: CARDS[i][2](a.v) }); });
    return { c: c, list: out };
  };
  var ui = { sel: -1 };
  var CSS = '#afk-mio-ov{position:fixed;inset:0;z-index:10040;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:12px}'
    + '#afk-mio{width:min(760px,100%);max-height:min(92vh,100%);overflow-y:auto;background:linear-gradient(160deg,#1e1530,#0f0d16 55%);border:1px solid #8b6db8;border-radius:14px;padding:14px;color:#e7e5e4;font-size:13px;line-height:1.5;box-shadow:0 10px 40px rgba(0,0,0,.7)}'
    + '#afk-mio .hd{display:flex;align-items:center;gap:10px}#afk-mio .hd b{font-size:18px;color:#f5d0fe;letter-spacing:2px}#afk-mio .hd .x{margin-left:auto}'
    + '#afk-mio .lore{color:#a8a29e;font-size:12px;margin-top:4px}'
    + '#afk-mio .bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border:1px solid #4c3d66;border-radius:10px;background:rgba(17,12,28,.8)}'
    + '#afk-mio .bar img{width:28px;height:28px}#afk-mio .bar .n{font-size:16px;font-weight:bold;color:#f0abfc}'
    + '#afk-mio .prog{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}'
    + '#afk-mio .prog div{padding:6px 8px;border:1px solid #3b3150;border-radius:8px;background:rgba(17,12,28,.7);font-size:12px}#afk-mio .prog div.ok{border-color:#fcd34d;box-shadow:0 0 8px rgba(252,211,77,.25) inset}'
    + '#afk-mio .prog b{display:block;font-size:13px}'
    + '#afk-mio .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin-top:10px}'
    + '#afk-mio .cd{position:relative;display:flex;flex-direction:column;align-items:center;padding:6px 2px;border:1px solid #3b3150;border-radius:8px;background:rgba(17,12,28,.8);cursor:pointer;color:inherit;font:inherit}'
    + '#afk-mio .cd img{width:52px;height:52px;border-radius:6px}#afk-mio .cd.off img{filter:grayscale(1) brightness(.35)}#afk-mio .cd span{font-size:11px;white-space:nowrap}'
    + '#afk-mio .cd.sel{border-color:#f0abfc;box-shadow:0 0 0 1px #f0abfc inset,0 0 10px rgba(240,171,252,.35)}#afk-mio .cd i{position:absolute;top:2px;left:4px;font-style:normal;font-size:10px;font-weight:bold}'
    + '#afk-mio .cd u{position:absolute;top:2px;right:4px;text-decoration:none;font-size:10px;color:#86efac}'
    + '#afk-mio .det{margin-top:10px;padding:10px;border:1px solid #8b6db8;border-radius:10px;background:rgba(24,16,38,.9)}'
    + '#afk-mio .det .top{display:flex;gap:12px;align-items:center}#afk-mio .det .top img{width:72px;height:72px;border-radius:8px}'
    + '#afk-mio .det table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}#afk-mio .det td{padding:5px 6px;border-top:1px solid #2e2540}#afk-mio .det td.s{white-space:nowrap;font-weight:bold;width:1%}#afk-mio .det tr.now td{background:rgba(240,171,252,.08)}'
    + '#afk-mio .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}'
    + '#afk-mio button.mb{padding:6px 14px!important;border-radius:8px!important;font-weight:bold;font-size:13px;border:1px solid #f0abfc!important;background:linear-gradient(#a21caf,#581c87)!important;color:#fdf4ff!important;cursor:pointer;white-space:nowrap;opacity:1!important}'
    + '#afk-mio button.mb[disabled]{border-color:#3b3150!important;background:#1c1726!important;color:#57534e!important;cursor:not-allowed}'
    + '#afk-mio .sum{margin-top:10px;font-size:12px;color:#d6d3d1}#afk-mio .sum b{color:#86efac}'
    + '@media (max-width:480px){#afk-mio{padding:10px}#afk-mio .prog{grid-template-columns:1fr}#afk-mio .grid{grid-template-columns:repeat(4,minmax(0,1fr))}#afk-mio .cd img{width:44px;height:44px}}';
  var ico = function (id) { var d = DB.items[id]; try { return d && typeof getIconUrl === 'function' ? getIconUrl(d) : (d && d.img) || ''; } catch (e) { return (d && d.img) || ''; } };
  var close = function () { var o = document.getElementById('afk-mio-ov'); if (o) o.remove(); };
  var render = function () {
    var p = P(), ov = document.getElementById('afk-mio-ov'); if (!p || !ov) return;
    if (!document.getElementById('afk-mio-css')) { var st = document.createElement('style'); st.id = 'afk-mio-css'; st.textContent = CSS; document.head.appendChild(st); }
    var s = store(p), sm = summary(p), v = sm.c, eq = equippedIdx(p), n = CARDS.length, sh = count(SHARD);
    if (ui.sel < 0) ui.sel = eq >= 0 ? eq : 0;
    var h = '<div id="afk-mio"><div class="hd"><img src="' + esc(ico(SHARD)) + '" style="width:36px;height:36px"><b>密奧之卡</b><button class="mb x" data-mio="close">關閉</button></div>'
      + '<div class="lore">夢域鏡的夢裡散落著二十二張牌的碎片。拼回來的牌會一直亮著；裝在身上的那張，才會露出它真正的樣子。</div>'
      + '<div class="bar"><img src="' + esc(ico(SHARD)) + '">密奧碎片 <span class="n">' + sh + '</span><span style="flex:1"></span>'
      + '<button class="mb" data-mio="open"' + (sh >= COST[0] && v.lit < n ? '' : ' disabled') + '>點亮一張（碎片 ×' + COST[0] + '）</button></div>'
      + '<div class="prog">' + SET.map(function (x, k) { var c = [v.lit, v.th, v.ma][k] || 0; return '<div class="' + (c >= n ? 'ok' : '') + '"><b style="color:' + STAGE_C[k + 1] + '">' + ['點亮', '托特以上', '馬賽'][k] + ' ' + c + '／' + n + '</b>' + esc(x.n) + '：' + esc(x.txt) + '</div>'; }).join('') + '</div>'
      + '<div class="grid">' + CARDS.map(function (c, i) {
          var st = Number(s.cards[i]) || 0;
          return '<button type="button" class="cd' + (st ? '' : ' off') + (i === ui.sel ? ' sel' : '') + '" data-mio="sel:' + i + '"><img src="' + esc(ico(idOf(i))) + '">'
            + (st ? '<i style="color:' + STAGE_C[st] + '">' + STAGE[st] + '</i>' : '') + (i === eq ? '<u>裝備中</u>' : '') + '<span>' + ROMAN[i] + ' ' + esc(c[0]) + '</span></button>';
        }).join('') + '</div>';
    var i = ui.sel, c = CARDS[i], st = Number(s.cards[i]) || 0;
    h += '<div class="det"><div class="top"><img src="' + esc(ico(idOf(i))) + '"' + (st ? '' : ' style="filter:grayscale(1) brightness(.4)"') + '><div><div style="font-size:16px;font-weight:bold;color:#f5d0fe">' + ROMAN[i] + ' ' + esc(c[0]) + '</div>'
      + '<div style="color:' + (st ? STAGE_C[st] : '#78716c') + '">' + (st ? '目前：' + STAGE[st] + (i === eq ? '（裝備中，用這個階段）' : '（沒裝著，只給偉特的效果）') : '還沒點亮') + '</div></div></div>'
      + '<table>' + [1, 2, 3].map(function (k) { return '<tr class="' + (k === st ? 'now' : '') + '"><td class="s" style="color:' + STAGE_C[k] + '">' + STAGE[k] + '</td><td>' + esc(descOf(i, k)) + (k >= 2 ? '<div style="color:#a8a29e;font-size:11px">裝著時另有：' + esc(auraTxt(k)) + '；基本能力不足時補到' + (k === 2 ? '托特' : '馬賽') + '標準</div>' : '') + '</td></tr>'; }).join('') + '</table>'
      + '<div class="acts">'
      + (st > 0 && st < 3 ? (function () { var DC = window.__afkDiaCost, d = DC ? DC.COST.mioUp : 0, m = DC ? DC.check(d) : null; return '<button class="mb" data-mio="up:' + i + '"' + (sh >= COST[st] && !m ? '' : ' disabled') + '>升到' + STAGE[st + 1] + '（碎片 ×' + COST[st] + (d ? '＋💎 ' + d.toLocaleString() + '＋金幣 ' + DC.goldOf(d).toLocaleString() : '') + '）</button>' + (sh < COST[st] ? '<div class="mio-miss" style="color:#fca5a5;font-size:12px">密奧碎片還差 ' + (COST[st] - sh) + ' 個</div>' : '') + (m ? '<div class="mio-miss" style="color:#fca5a5;font-size:12px">' + m + '</div>' : ''); })() : '')
      + (st > 0 && i !== eq ? '<button class="mb" data-mio="eq:' + i + '">裝備這張</button>' : '')
      + '</div></div>';
    var std = v.eqSt >= 2 ? (STD[v.eqSt >= 3 ? '75' : '65'] || {})[p.cls] : null;
    h += '<div class="sum"><b style="color:#f5d0fe">目前生效</b>'
      + (sm.list.length ? '<ul style="margin:4px 0 0 18px;list-style:disc">' + sm.list.map(function (x) { return '<li><span style="color:' + STAGE_C[x.st] + '">' + ROMAN[x.i] + ' ' + esc(CARDS[x.i][0]) + '（' + STAGE[x.st] + '）</span>：' + esc(x.t) + '</li>'; }).join('') + '</ul>' : '：還沒有點亮的卡')
      + (std ? '<div style="margin-top:4px">裝著的卡是' + STAGE[v.eqSt] + '：' + esc(auraTxt(v.eqSt)) + '；保底（' + (v.eqSt >= 3 ? '馬賽' : '托特') + '標準）：' + STD_N.map(function (nm, k) { return nm + ' ' + (k === 3 ? '' : '') + std[k].toLocaleString(); }).join('、') + '</div>' : '')
      + (Object.keys(v.set).length ? '<div style="margin-top:4px">收集加成：' + SET.filter(function (x, k) { return [v.lit, v.th, v.ma][k] >= n; }).map(function (x) { return esc(x.txt); }).join('；') + '</div>' : '')
      + '</div>'
      + '<div class="lore" style="margin-top:6px">取得：席琳夢域鏡裡一般怪物 0.001%、頭目 0.1% 掉密奧碎片，乘隊伍人數（最多 ×16）。點亮 10 個、托特 20 個、馬賽 30 個。密奧欄位在裝備視窗第二頁、刻印下面。</div></div>';
    ov.innerHTML = h;
    ov.querySelectorAll('[data-mio]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var a = b.getAttribute('data-mio').split(':');
        if (a[0] === 'close') return close();
        if (a[0] === 'open') { var k = openCard(); if (k >= 0) ui.sel = k; }
        else if (a[0] === 'sel') ui.sel = Number(a[1]);
        else if (a[0] === 'up') upgrade(Number(a[1]));
        else if (a[0] === 'eq') equipCard(Number(a[1]));
        try { if (typeof updateUI === 'function') updateUI(); if (typeof renderTabs === 'function') renderTabs(); } catch (e) {}
        render();
      };
    });
  };
  var open = function () {
    var p = P(); if (!on(p)) return;
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
    close();
    var ov = document.createElement('div'); ov.id = 'afk-mio-ov';
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov); render();
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      var p = P(), it = p && (p.inv || []).find(function (i) { return i && i.uid === u; });
      if (!it || it.id !== SHARD) return oUse.apply(this, arguments);
      if (arguments[1]) return;   // 自動使用不碰
      open();
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  // 卡片的道具視窗多一顆「打開密奧之卡」
  if (typeof W.openModal === 'function') {
    var oModal = W.openModal;
    W.openModal = function (item) {
      var r = oModal.apply(this, arguments);
      try {
        if (item && idxOf(item.id) >= 0 && on(P())) {
          var box = document.getElementById('modal-actions');
          if (box) { var b = document.createElement('button'); b.className = 'col-span-2 w-full btn border-fuchsia-700 bg-fuchsia-900 hover:bg-fuchsia-800 text-fuchsia-100 py-3 text-lg font-bold'; b.textContent = '🃏 打開密奧之卡'; b.onclick = function () { ui.sel = idxOf(item.id); open(); }; box.insertBefore(b, box.firstChild); }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('openModal = window.openModal'); } catch (e) {}
  }

  var api = W.__afkMio = { SHARD: SHARD, RATE: RATE, COST: COST, CARDS: CARDS, K: K, SET: SET, AURA: AURA, STD: STD, STD_N: STD_N, STAGE: STAGE, ROMAN: ROMAN, idOf: idOf, idxOf: idxOf,
    store: store, compute: compute, summary: summary, rawVal: rawVal, descOf: descOf, auraTxt: auraTxt, openCard: openCard, upgrade: upgrade, equipCard: equipCard, open: open, close: close,
    roll: function () { return Math.random(); }, count: count, wheel: wheel, refresh: refresh };
})();
