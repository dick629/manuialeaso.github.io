/* ============================================================================
 * afk-relicmech.js — 遺物新機制（Ping 11-20 21:19 定案：完整製作，先內部測試，不上線）
 *   設計稿（Projects）：relic-redesign-index.md、relic-tier-framework.md、relic-redesign-numbers-1.md、
 *     relic-element-series.md、echo-relic-stages-design.md、echo-relic-assign.md、relic-redesign-weapons-1/2.md
 *   一、119 件重做（原 afk-relicevo 的模板效果拿掉，換成各自的招牌機制）
 *   二、回響遺物（原作者 v3.9 的 100 件）：四階招牌、五屬性機制（+10 解鎖、昇華 +5 強化）、原主之仇
 *   三、種族獵手：+10 第二詞綴 20% 是獵手詞綴；同系共鳴（來源同一系 2／4／6 件）
 *   四、原作者設計表 26 件：昇華支配 +5 的新行為
 *   規則：原本特效不動，只加；倍率依取得難度（T1～T6）只乘在新機制的機率、百分比上；說明只寫效果。
 *   階段：本體 0／+5 1／+10 2／昇華支配 3／昇華支配 +5 4。次元遺物（it.dimV）＝那件至高的支配本身，照常生效。
 *   掛點：afk-procfx 的 dealt／taken／tick／kill／death／evade；格擋 window.__afkOnBlock（核心補丁 patchBlockHook1120）。
 *   外掛開關 relicmech；經典模式沒有。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'relicmech', name: '遺物新機制', group: '遊戲內容', desc: '遺物強化、昇華後的新機制（回響遺物、種族獵手、屬性機制）' });
  if (T && !T.enabled('relicmech')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var X = function () { return W.__afkProc; };
  var RA = function () { var R = W.AFK_RELIC_RUNTIME; return R && R.api; };
  var tk = function () { try { return Number(state.ticks) || 0; } catch (e) { return 0; } };
  var on = function () { var p = P(); return !!(p && !p.classicMode); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var STAGE_N = ['本體', '+5', '+10', '昇華支配', '昇華支配 +5'];
  var tier = function (n, a) { return a != null ? (a >= 5 ? 4 : 3) : n >= 10 ? 2 : n >= 5 ? 1 : 0; };

  // ── 共用：隊伍、怪物、傷害、治療 ──
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && !a.dead && N(a.curHp) > 0; })); };
  var isPlayer = function (x) { return !!x && x === P(); };
  var isAlly = function (x) { var p = P(); return !!(x && p && x !== p && (p.allies || []).indexOf(x) >= 0); };
  var hpOf = function (x) { return isPlayer(x) ? N(x.hp) : N(x.curHp); };
  var mhpOf = function (x) { return Math.max(1, N(x.mhp)); };
  var mpOf = function (x) { return isPlayer(x) ? N(x.mp) : N(x.curMp != null ? x.curMp : x.mp); };
  var setMp = function (x, v) { tr(); if (isPlayer(x)) x.mp = Math.max(0, Math.min(N(x.mmp), v)); else if (x.curMp != null) x.curMp = Math.max(0, Math.min(N(x.mmp), v)); };
  var heal = function (x, n) { n = Math.floor(n); if (!(n > 0) || !x) return 0; tr(); var b = hpOf(x); if (isPlayer(x)) { if (x.dead) return 0; x.hp = Math.min(x.mhp, N(x.hp) + n); return x.hp - b; } if (N(x.curHp) > 0) { x.curHp = Math.min(mhpOf(x), N(x.curHp) + n); return x.curHp - b; } return 0; };
  var shield = function (x, n, capPct) { if (!(n > 0)) return; tr(); if (isPlayer(x)) { try { X().shield.add(n, Math.floor(mhpOf(x) * (capPct || 20) / 100)); } catch (e) {} } else heal(x, n * 0.5); };
  var alive = function (m) { return m && !m._dead && N(m.curHp) > 0; };
  var mobs = function () { try { return (mapState.mobs || []).filter(alive); } catch (e) { return []; } };
  var target = function () { try { var t = typeof getTarget === 'function' ? getTarget() : null; return alive(t) ? t : mobs()[0] || null; } catch (e) { return null; } };
  var others = function (m, n) { var l = mobs().filter(function (x) { return x !== m; }); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), q = l[i]; l[i] = l[j]; l[j] = q; } return l.slice(0, n); };
  var nearest = function (m) { return others(m, 1)[0] || null; };
  var hit = function (m, n) { var x = X(); if (x && n > 0 && alive(m)) { tr(); return x.hitMob(m, n); } return 0; };
  var later = function (fn, ms) { var k = CURK; setTimeout(function () { var pk = CURK; CURK = k; try { fn(); } catch (e) { if (W.__afkRMErr) W.__afkRMErr.push((k || '?') + ' later ' + e.message); } CURK = pk; }, ms || 0); };
  var panel = function (a) { var v = 0; try { v = N(W.__afkPanelDmg(a)); } catch (e) {} if (!(v > 0)) { try { var d = a.d || {}; v = Math.max(N(d.meleeDmg), N(d.rangedDmg), N(d.magicDmg)) || 50; } catch (e2) { v = 50; } } return v; };
  var roll = function (c) { return Math.random() * 100 < c; };
  var pop = function (key, txt) { tr(); try { X().pop('rm_' + key, '', txt, '#a5f3fc'); } catch (e) {} };
  var note = function (key, h) { try { X().note('rm_' + key, '<span style="color:#a5f3fc">' + h + '</span>'); } catch (e) {} };
  // 內部測試用：W.__afkRMTrace = {} 時記錄每件遺物的機制實際做了幾次事
  var CURK = null; var tr = function () { var T0 = W.__afkRMTrace; if (T0 && CURK) T0[CURK] = (T0[CURK] || 0) + 1; };
  var HARD = { stun: 1, freeze: 1, stone: 1, sleep: 1, paralyze: 1 };
  var bossDelay = function (m) { var o = mk(m), t = tk(); if ((o.bdAt || -1e9) > t - 100) return false; o.bdAt = t; try { var a = RA(); if (a && a.status) a.status(m, 'attackDelay', 0.3, 1); else m._atkCd = N(m._atkCd) + 3; } catch (e) {} return true; };
  var stat = function (m, kind, sec) {
    if (!alive(m)) return false; tr();
    if (m.boss && HARD[kind]) return bossDelay(m);
    try { var a = RA(); if (a && a.status) return a.status(m, kind, sec, 1); } catch (e) {}
    m.st = m.st || {}; m.st[kind] = Math.max(N(m.st[kind]), Math.round(sec * 10)); return true;
  };
  var hasHard = function (m) { var s = m && m.st; return !!(s && (s.freeze > 0 || s.stun > 0 || s.stone > 0 || s.sleep > 0 || s.paralyze > 0)); };

  // ── 怪物身上的標記：易傷、AC、層數、持續傷害 ──
  var MK_ = new WeakMap();
  var mk = function (m) { var o = MK_.get(m); if (!o) { o = { vul: [], dots: [], st: {} }; MK_.set(m, o); } return o; };
  var DOTM = new Set();
  var vuln = function (m, src, p, sec) { if (!alive(m)) return; tr(); var o = mk(m), t = tk(), u = t + Math.round(sec * 10); var e = o.vul.find(function (x) { return x.src === src; }); if (e) { e.p = Math.max(e.until > t ? e.p : 0, p); e.until = Math.max(e.until, u); } else o.vul.push({ src: src, p: p, until: u }); };
  var vulnOf = function (m) { var o = MK_.get(m); if (!o || !o.vul.length) return 0; var t = tk(), s = 0; o.vul = o.vul.filter(function (x) { return x.until > t; }); o.vul.forEach(function (x) { s += x.p; }); return Math.min(60, s); };
  var acShred = function (m, n, cap) { if (!alive(m)) return; tr(); var o = mk(m); var cur = N(o.ac), nx = Math.min(cap, cur + n); if (nx > cur) { m.ac = N(m.ac) + (nx - cur); o.ac = nx; } return o.ac; };
  var dot = function (m, src, key, per, sec, maxLayers) {
    if (!alive(m) || !(per > 0)) return 0; tr(); var o = mk(m), t = tk(), u = t + Math.round(sec * 10);
    var mine = o.dots.filter(function (d) { return d.src === src && d.k === key && d.until > t; });
    if (mine.length < (maxLayers || 1)) o.dots.push({ src: src, k: key, per: per, until: u });
    else { mine.sort(function (a, b) { return a.until - b.until; }); mine[0].until = u; mine[0].per = Math.max(mine[0].per, per); }
    DOTM.add(m); return Math.min(maxLayers || 1, mine.length + 1);
  };
  var dotLayers = function (m, key, src) { var o = MK_.get(m); if (!o) return 0; var t = tk(); return o.dots.filter(function (d) { return d.k === key && d.until > t && (!src || d.src === src); }).length; };
  var dotLeft = function (m, key, src) { var o = MK_.get(m); if (!o) return 0; var t = tk(); return o.dots.filter(function (d) { return d.k === key && d.until > t && (!src || d.src === src); }).reduce(function (s, d) { return s + d.per * (d.until - t) / 10; }, 0); };
  var clearDots = function (m, key, src) { var o = MK_.get(m); if (o) o.dots = o.dots.filter(function (d) { return !(d.k === key && (!src || d.src === src)); }); };

  // ── 每人每件的狀態 ──
  var STS = new WeakMap();
  var S = function (a, key) { var m = STS.get(a); if (!m) { m = {}; STS.set(a, m); } return m[key] || (m[key] = {}); };
  var cd = function (o, k, sec) { var t = tk(); if ((o[k] || -1e9) > t - sec * 10) return false; o[k] = t; return true; };

  // ── 取得難度等級（倍率只乘在新機制的機率、百分比）──
  var RACEF = { '人形': ['人形', '亞人', '強盜', '黑暗妖精', '拉斯塔巴德', '黑騎士', '侏儒', '歐姆', '長老', '長者', '法師', '黑暗精靈'], '不死': ['不死', '殭屍', '巫妖', '死神', '吸血鬼'], '惡魔': ['惡魔', '思克巴'], '元素': ['元素', '不死鳥'], '野獸': ['動物', '野獸', '狼人', '蜥蜴人', '奇美拉', '邪惡蜥蜴'], '龍': ['龍', '飛龍'], '蟲蛛': ['昆蟲', '蜘蛛', '毒蠍', '螞蟻'], '魔造': ['魔法生物', '高崙', '變形怪', '眼魔', '墳墓守護者'], '巨人': ['巨人', '食人妖精', '牛人', '歐吉'], '妖怪': ['妖怪'], '異域': ['底比斯', '提卡爾', '喀瑪', '異界生物', '蛇女'], '妖魔': ['妖魔', '哥布林', '卡司特'] };
  var FAMS = Object.keys(RACEF), R2F = {}; FAMS.forEach(function (f) { RACEF[f].forEach(function (r) { R2F[r] = f; }); });
  var famOf = function (m) { return m ? (R2F[m.race] || null) : null; };
  var TMUL = {}, SRCF = {}, SRCMOB = {};
  var calcTier = function () {
    try {
      var byName = {}; Object.keys(DB.mobs).forEach(function (id) { var m = DB.mobs[id]; (byName[m.n] = byName[m.n] || []).push(m); });
      Object.keys(MOB_DROPS).forEach(function (mn) { (MOB_DROPS[mn] || []).forEach(function (e) {
        var id = e[0], d = DB.items[id]; if (!d || !d.relic || /~/.test(id)) return;
        (byName[mn] || []).forEach(function (m) {
          var cur = SRCMOB[id]; var easier = !cur || (N(cur.boss ? 1 : 0) > (m.boss ? 1 : 0)) || ((!!cur.boss === !!m.boss) && N(m.lv) < N(cur.lv));
          if (easier) SRCMOB[id] = m;
        });
      }); });
      Object.getOwnPropertyNames(DB.items).forEach(function (id) {
        var d = DB.items[id]; if (!d || !d.relic || /~/.test(id)) return;
        var m = d.relicEcho && DB.mobs[d.relicSourceId] ? DB.mobs[d.relicSourceId] : SRCMOB[id], t = 1.15;
        if (d.bossRelicKey && !d.relicFill) t = 1.45;
        else if (m) t = m.boss ? (N(m.lv) >= 70 ? 1.7 : 1.55) : (N(m.lv) >= 65 ? 1.3 : N(m.lv) >= 40 ? 1.15 : 1.0);
        TMUL[id] = t; if (m) SRCF[id] = famOf(m);
      });
    } catch (e) { console.warn('[AFK-relicmech] tier', e); }
  };
  var SC = { c: 1, p: 1, h: 1, x: 1 };   // 只放大機率 c、百分比 p、治療 h、傷害倍率 x
  var scale = function (o, mul) { if (!o || mul === 1) return o; var r = {}; Object.keys(o).forEach(function (k) { var v = o[k]; r[k] = SC[k] && typeof v === 'number' ? (k === 'c' ? Math.min(100, r1(v * mul)) : k === 'x' && v <= 5 ? (v <= 1 ? v : Math.round((1 + (v - 1) * mul) * 100) / 100) : r1(v * mul)) : v;   /* 11-21：倍率型 x（×1.2、×2…）只縮放超出 1 的部分，避免縮成 ×1 */ }); return r; };

  // ════════ 一、119 件重做（數字＝T2 基準；s1～s4＝+5／+10／昇華支配／昇華支配 +5） ════════
  var M = {};
  var def = function (id, v, h) { h.v = v; M[id] = h; };
  // ---- 寵物 ----
  var petsUp = function () { try { return (typeof petsOutList === 'function' ? petsOutList() : []).filter(function (pt) { return pt && !pt._downed && N(pt.hp) > 0; }); } catch (e) { return []; } };
  var sums = function () { try { return (typeof summonV2List === 'function' ? summonV2List() : []).filter(function (s) { return s && !s._dead && N(s.hp != null ? s.hp : 1) > 0; }); } catch (e) { return []; } };
  def('relic_tamer_petarm', [{ p: 15 }, { p: 20, tn: 2 }, { p: 25, tn: 3, cut: 20 }, { p: 30, tn: 3, cut: 20, last: 50 }], {
    t: function (o) { return '寵物替隊友擋下的傷害 ' + o.p + '%' + (o.tn ? '；寵物每 20 秒嘲諷身邊 ' + o.tn + ' 隻怪' : '') + (o.cut ? '；寵物受到的傷害 −' + o.cut + '%' : '') + (o.last ? '；寵物倒下前把剩下 HP 的 ' + o.last + '% 變成全隊護盾' : ''); },
    taken: function (a, o, c) { if (!isPlayer(a) && !isAlly(a)) return c.dmg; var pt = petsUp()[0]; if (!pt) return c.dmg; var mv = c.dmg * (o.p - 10) / 100; if (mv <= 0) return c.dmg; pt.hp = Math.max(1, N(pt.hp) - mv * (1 - N(o.cut) / 100)); return c.dmg - mv; },
    tick: function (a, o, c) { if (!o.tn || !c.fight || !isPlayer(a)) return; var s = S(a, 'tamer'); if (!cd(s, 'tn', 20)) return; var pt = petsUp()[0]; if (!pt) return; mobs().slice(0, o.tn).forEach(function (m) { try { if (typeof ironGuardTaunt === 'function') ironGuardTaunt(m, pt); } catch (e) {} }); pop('tamer', '寵物嘲諷'); }
  });
  def('relic_imp_fang', [{ p: 5 }, { p: 8 }, { p: 12, mp: 1 }, { p: 15, mp: 1, ks: 1 }], {
    t: function (o) { return '寵物造成傷害的 ' + o.p + '% 回到你身上' + (o.mp ? '（HP 滿時改回 MP）' : '') + (o.ks ? '；寵物打倒怪物後 5 秒吸血 ×2' : ''); },
    comp: function (a, o, c) { if (c.src !== 'pet') return 0; var s = S(a, 'imp'), m = (s.ksUntil || 0) > tk() ? 2 : 1, v = c.v * o.p / 100 * m; if (o.mp && hpOf(a) >= mhpOf(a)) setMp(a, mpOf(a) + v * 0.2); else heal(a, v); return 0; },
    kill: function (a, o, c) { if (o.ks && c.bySrc === 'pet') S(a, 'imp').ksUntil = tk() + 50; }
  });
  def('relic_hellhound_chain', [{ c: 10, d: 0.5 }, { c: 15, d: 1 }, { c: 20, d: 1, p: 10 }, { c: 25, d: 1.5, p: 20 }], {
    t: function (o) { return '寵物命中時 ' + o.c + '% 鎖住目標 ' + o.d + ' 秒' + (o.p ? '；被鎖住的怪受到全隊傷害 +' + o.p + '%' : ''); },
    compHit: function (a, o, c) { if (c.src !== 'pet' || !roll(o.c)) return; if (stat(c.tgt, 'stun', o.d) && o.p) vuln(c.tgt, 'chain', o.p, o.d + 2); }
  });
  def('relic_shepherd_boots', [{ p: 1 }, { p: 2 }, { p: 3 }, { p: 3, rush: 200 }], {
    t: function (o) { return '場上每多一隻寵物或召喚物，全隊造成的傷害 +' + o.p + '%（最多 5 層）' + (o.rush ? '；滿 5 層時每 30 秒寵物、召喚物一起衝鋒，打全體一次' : ''); },
    team: function (a, o) { return o.p * Math.min(5, petsUp().length + sums().length); },
    tick: function (a, o, c) { if (!o.rush || !c.fight || !isPlayer(a) || petsUp().length + sums().length < 5) return; var s = S(a, 'shep'); if (!cd(s, 'r', 30)) return; var v = panel(a) * o.rush / 100; mobs().forEach(function (m) { hit(m, v); }); pop('shep', '牧群衝鋒'); }
  });
  def('relic_collie_fur', [{ c: 10, h: 50 }, { c: 15, h: 70 }, { c: 20, h: 100 }, { c: 25, h: 100, rez: 1 }], {
    t: function (o) { return '寵物攻擊時 ' + o.c + '% 治療 HP 最低的隊友（' + o.h + '% 寵物攻擊）' + (o.rez ? '；有人倒下時寵物 3 秒後把他拉起來（HP 20%，冷卻 90 秒）' : ''); },
    compHit: function (a, o, c) { if (c.src !== 'pet' || !roll(o.c)) return; var low = party().sort(function (x, y) { return hpOf(x) / mhpOf(x) - hpOf(y) / mhpOf(y); })[0]; if (low) heal(low, c.v * o.h / 100); },
    tick: function (a, o, c) { if (!o.rez || !isPlayer(a) || !petsUp().length) return; var s = S(a, 'collie'); var dn = (a.allies || []).find(function (x) { return x && x._downed; }); if (!dn) { s.downAt = 0; return; } if (!s.downAt) s.downAt = tk(); if (tk() - s.downAt >= 30 && cd(s, 'rz', 90)) { try { dn._downed = false; dn.curHp = Math.floor(mhpOf(dn) * 0.2); } catch (e) {} s.downAt = 0; pop('collie', '寵物救援'); } }
  });
  def('relic_doberman_fang', [{ p: 15 }, { p: 20 }, { p: 30 }, { p: 30, crit: 1 }], {
    t: function (o) { return '你和寵物打同一個目標時，寵物傷害 +' + o.p + '%' + (o.crit ? '；你爆擊後寵物下一擊傷害 ×1.5' : ''); },
    comp: function (a, o, c) { if (c.src !== 'pet') return 0; var s = S(a, 'dob'), add = 0; if (c.tgt === target()) add += o.p; if (s.crit) { s.crit = 0; add += 50; } return add; },
    hit: function (a, o, c) { if (o.crit && c.crit) S(a, 'dob').crit = 1; }
  });
  def('relic_cat_paw', [{ p: 20 }, { p: 30 }, { p: 40 }, { p: 50, inv: 1 }], {
    t: function (o) { return '寵物倒下時你得到護盾（寵物最大 HP ' + o.p + '%）' + (o.inv ? '；寵物站起來時 5 秒內不會倒下' : ''); },
    tick: function (a, o) { if (!isPlayer(a)) return; var s = S(a, 'paw'); s.seen = s.seen || new WeakSet(); (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) { if (!pt) return; if (pt._downed && !s.seen.has(pt)) { s.seen.add(pt); shield(a, mhpOf(pt) * o.p / 100, 30); pop('paw', '肉球護符'); } if (!pt._downed && s.seen.has(pt)) { s.seen.delete(pt); if (o.inv) pt._rmInv = tk() + 50; } }); }
  });
  def('relic_fox_scarf', [{ p: 10 }, { p: 15 }, { p: 20 }, { p: 25, mat: 1 }], {
    t: function (o) { return '寵物在場時，打倒怪物的金幣 +' + o.p + '%' + (o.mat ? '；打倒怪物 1% 多拿一個那張地圖的素材' : ''); },
    gold: function (a, o) { return petsUp().length ? o.p : 0; },
    kill: function (a, o, c) { if (!o.mat || !petsUp().length || !roll(1)) return; try { var l = (MOB_DROPS[c.m.n] || []).filter(function (e) { var d = DB.items[e[0]]; return d && (d.type === 'material' || d.type === 'etc') && !d.relic; }); var e = l[Math.floor(Math.random() * l.length)]; if (e) gainItem(e[0], 1, true, true); } catch (e2) {} }
  });
  // ---- 召喚（召喚物＝核心的召喚術；臨時夥伴＝遺物自己的影子，算進召喚物傷害） ----
  var tempHit = function (a, m, n) { if (!(n > 0)) return; hit(m, n); };
  def('relic_croc_soul', [{ p: 30 }, { p: 40 }, { p: 50, wet: 1 }, { p: 70, wet: 1, x: 2 }], {
    t: function (o) { return '召喚物消失時化成水柱，周圍敵人受到它最大 HP ' + o.p + '% 的傷害' + (o.wet ? '並濕身 5 秒' : '') + (o.x ? '；每 30 秒第一次水柱 ×2' : ''); },
    tick: function (a, o) { if (!isPlayer(a)) return; var s = S(a, 'croc'); var now = sums(); s.prev = s.prev || []; s.prev.forEach(function (sm) { if (now.indexOf(sm) < 0) { var mul = o.x && cd(s, 'x', 30) ? 2 : 1, v = N(sm.mhp || sm.hp || 500) * o.p / 100 * mul; mobs().forEach(function (m) { hit(m, v); if (o.wet) wet(m, 5); }); pop('croc', '水柱'); } }); s.prev = now.slice(); }
  });
  def('relic_dream_mushroom_soul', [{ c: 10, p: 1 }, { c: 15, p: 1, jump: 1 }, { c: 20, p: 1.5, jump: 2 }, { c: 25, p: 2, jump: 2, sprout: 3 }], {
    t: function (o) { return '召喚物命中時 ' + o.c + '% 讓目標中孢子毒（每秒你傷害的 ' + o.p + '%，8 秒）' + (o.jump ? '，毒會跳到旁邊 ' + o.jump + ' 隻' : '') + (o.sprout ? '；中毒的怪倒下時長出蘑菇，20 秒內幫你打（最多 3 隻）' : ''); },
    compHit: function (a, o, c) { if (c.src !== 'summon' || !roll(o.c)) return; var per = panel(a) * o.p / 100; dot(c.tgt, a, 'spore', per, 8, 1); if (o.jump) others(c.tgt, o.jump).forEach(function (m) { dot(m, a, 'spore', per, 8, 1); }); },
    kill: function (a, o, c) { if (!o.sprout || !dotLayers(c.m, 'spore', a)) return; var s = S(a, 'mush'); s.l = (s.l || []).filter(function (x) { return x > tk(); }); if (s.l.length < o.sprout) { s.l.push(tk() + 200); pop('mush', '蘑菇長出來了'); } },
    tick: function (a, o, c) { if (!o.sprout || !c.fight) return; var s = S(a, 'mush'); var n = (s.l || []).filter(function (x) { return x > tk(); }).length; if (n && tk() % 20 === 0) { var tg = target(); if (tg) tempHit(a, tg, panel(a) * 0.2 * n); } }
  });
  def('relic_dream_flamesoul', [{ p: 2 }, { p: 3 }, { p: 4 }, { p: 5, giant: 1 }], {
    t: function (o) { return '場上每隻召喚物讓你的魔法傷害 +' + o.p + '%（最多 5 隻）' + (o.giant ? '；滿 5 隻時每 60 秒合體成火炎巨靈 10 秒（每 3 秒火風暴）' : ''); },
    dmg: function (a, o, c) { return c.kind === 'magic' ? o.p * Math.min(5, sums().length) : 0; },
    tick: function (a, o, c) { if (!o.giant || !c.fight || !isPlayer(a)) return; var s = S(a, 'flame'); if (sums().length >= 5 && cd(s, 'g', 60)) { s.until = tk() + 100; pop('flame', '火炎巨靈'); } if ((s.until || 0) > tk() && tk() % 30 === 0) mobs().forEach(function (m) { hit(m, panel(a) * 1.5); }); }
  });
  def('relic_mini_darkelf', [{ x: 1 }, { x: 1, bl: 2 }, { x: 1, bl: 3 }, { x: 1, bl: 3, hide: 1 }], {
    t: function (o) { return '召喚物對每個目標的第一擊傷害 ×2' + (o.bl ? '並致盲 ' + o.bl + ' 秒（攻擊 30% 落空）' : '') + (o.hide ? '；召喚物每 20 秒隱身 3 秒，期間傷害 ×2' : ''); },
    comp: function (a, o, c) { if (c.src !== 'summon') return 0; var m = mk(c.tgt), add = 0; if (!m.de) { m.de = 1; add += 100; if (o.bl) m.blind = tk() + o.bl * 10; } if (o.hide) { var s = S(a, 'de'); if (cd(s, 'h', 20)) s.until = tk() + 30; if ((s.until || 0) > tk()) add += 100; } return add; }
  });
  def('relic_zombie_shin', [{ c: 5, n: 2, d: 20 }, { c: 8, n: 3, d: 20 }, { c: 10, n: 4, d: 30 }, { c: 12, n: 5, d: 30, bite: 200 }], {
    t: function (o) { return '打倒的一般怪 ' + o.c + '% 復活成殭屍跟著打 ' + o.d + ' 秒（最多 ' + o.n + ' 隻）' + (o.bite ? '；殭屍倒下時咬周圍的怪' : ''); },
    kill: function (a, o, c) { if (c.m.boss || !roll(o.c)) return; var s = S(a, 'zom'); s.l = (s.l || []).filter(function (x) { return x > tk(); }); if (s.l.length < o.n) { s.l.push(tk() + o.d * 10); pop('zom', '殭屍爬起來了'); } },
    tick: function (a, o, c) { var s = S(a, 'zom'); if (!s.l || !s.l.length) return; var t = tk(), live = s.l.filter(function (x) { return x > t; }); if (o.bite && live.length < s.l.length) mobs().forEach(function (m) { hit(m, panel(a) * 0.4 * (s.l.length - live.length)); }); s.l = live; if (c.fight && live.length && t % 20 === 0) { var tg = target(); if (tg) tempHit(a, tg, panel(a) * 0.15 * live.length); } }
  });
  def('relic_beholder_gaze', [{ c: 20 }, { c: 30 }, { c: 40 }, { c: 50, gaze: 1 }], {
    t: function (o) { return '你的控制打中時，召喚物 ' + o.c + '% 在同一目標再補一次（時間延長 1 秒）' + (o.gaze ? '；每 15 秒凝視全體 1 秒石化（頭目改成短暫硬直）' : ''); },
    hit: function (a, o, c) { if (!sums().length || !hasHard(c.tgt) || !roll(o.c)) return; var s = c.tgt.st; ['stun', 'freeze', 'stone', 'paralyze'].forEach(function (k) { if (s[k] > 0) s[k] += 10; }); },
    tick: function (a, o, c) { if (!o.gaze || !c.fight || !sums().length) return; if (cd(S(a, 'gaze'), 'g', 15)) { mobs().forEach(function (m) { stat(m, 'stone', 1); }); pop('gaze', '凝視'); } }
  });
  def('relic_giantant_antenna', [{ n: 1, egg: 0 }, { n: 1, egg: 20 }, { n: 2, egg: 30 }, { n: 2, egg: 100, two: 1 }], {
    t: function (o) { return '小兵蟻：召喚物在場時每 3 秒對目標攻擊 ' + o.n + ' 次（你傷害的 15%）' + (o.egg ? '；召喚物消失時 ' + o.egg + '% 再生出 ' + (o.two ? 2 : 1) + ' 隻小兵蟻（10 秒）' : ''); },
    tick: function (a, o, c) { if (!isPlayer(a)) return; var s = S(a, 'ant'), now = sums(); s.prev = s.prev || []; if (o.egg) s.prev.forEach(function (sm) { if (now.indexOf(sm) < 0 && roll(o.egg)) { s.l = (s.l || []); s.l.push(tk() + 100); if (o.two) s.l.push(tk() + 100); } }); s.prev = now.slice(); if (!c.fight || tk() % 30) return; var tg = target(); if (!tg) return; var k = (now.length ? o.n : 0) + (s.l || []).filter(function (x) { return x > tk(); }).length; if (k) tempHit(a, tg, panel(a) * 0.15 * k); }
  });
  // ---- 治療者、魔力 ----
  var lowest = function () { return party().sort(function (x, y) { return hpOf(x) / mhpOf(x) - hpOf(y) / mhpOf(y); })[0]; };
  def('relic_doro_vitality', [{ p: 20 }, { p: 30 }, { p: 40, cap: 15 }, { p: 50, cap: 20, burst: 1 }], {
    t: function (o) { return '你的治療超過的部分 ' + o.p + '% 變成護盾' + (o.burst ? '；護盾被打破時對周圍敵人造成護盾量的傷害' : ''); },
    healOut: function (a, o, c) { if (c.over > 0) { shield(c.to, c.over * o.p / 100, o.cap || 10); if (o.burst) S(a, 'doro').sh = c.over * o.p / 100; } }
  });
  def('relic_troll_regen_ring', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, big: 1 }], {
    t: function (o) { return 'HP 每少 10%，每 5 秒回復最大 HP 的 ' + r1(o.p / 10) + '%' + (o.big ? '；HP 低於 20% 時 3 秒內回最大 HP 50%（冷卻 120 秒）' : ''); },
    tick: function (a, o) { var s = S(a, 'troll'), t = tk(); if (t % 50 === 0) { var miss = Math.floor((1 - hpOf(a) / mhpOf(a)) * 10); if (miss > 0) heal(a, mhpOf(a) * o.p / 1000 * miss); } if (o.big && hpOf(a) > 0 && hpOf(a) < mhpOf(a) * 0.2 && cd(s, 'b', 120)) { s.bu = t + 30; pop('troll', '再生'); } if ((s.bu || 0) > t) heal(a, mhpOf(a) * 0.5 / 30); }
  });
  def('relic_crescent_earring', [{ p: 10 }, { p: 15 }, { p: 20 }, { p: 30, cave: 30 }], {
    t: function (o) { return '你治療別人時，自己回那個量的 ' + o.p + '%' + (o.cave ? '；洞窟、地下城裡你的治療量 +30%' : ''); },
    healOut: function (a, o, c) { if (c.to !== a && c.amt > 0) heal(a, c.amt * o.p / 100); },
    healMul: function (a, o) { if (!o.cave) return 0; var k = String((typeof mapState !== 'undefined' && mapState.current) || ''); return /cave|dungeon|tower|tomb|lair|hell|abyss|洞|塔/.test(k) ? o.cave : 0; }
  });
  def('relic_kasta_hump', [{ p: 10 }, { p: 15 }, { p: 20, x: 1.2 }, { p: 20, x: 1.2, steal: 1 }], {
    t: function (o) { return '你受到的治療 ' + o.p + '% 分給 HP 最低的隊友' + (o.x ? '（分出去的量 ×' + o.x + '）' : '') + (o.steal ? '；隊友倒下時把他的增益吸到你身上' : ''); },
    healIn: function (a, o, c) { var l = party().filter(function (x) { return x !== a; }).sort(function (x, y) { return hpOf(x) / mhpOf(x) - hpOf(y) / mhpOf(y); })[0]; if (l && c.amt > 0) heal(l, c.amt * o.p / 100 * (o.x || 1)); }
  });
  def('relic_black_gale', [{ c: 10, p: 5 }, { c: 15, p: 8 }, { c: 20, p: 10 }, { c: 25, p: 10, all: 15 }], {
    t: function (o) { return '一般攻擊命中時 ' + o.c + '% 治療 HP 最低的隊友（你傷害的 ' + o.p + '%）' + (o.all ? '；每打 15 下全體治療（你傷害的 30%）' : ''); },
    hit: function (a, o, c) { if (c.kind === 'magic') return; if (roll(o.c)) { var l = lowest(); if (l) heal(l, c.v * o.p / 100); } if (o.all) { var s = S(a, 'gale'); s.n = N(s.n) + 1; if (s.n >= o.all) { s.n = 0; party().forEach(function (x) { heal(x, c.v * 0.3); }); pop('gale', '疾風治療'); } } }
  });
  def('relic_bear_vitality', [{ p: 1 }, { p: 1.5 }, { p: 2 }, { p: 3, full: 10 }], {
    t: function (o) { return '全隊每 10 秒回復你最大 HP 的 ' + o.p + '%' + (o.full ? '；你 HP 全滿時全隊受到的傷害 −10%' : ''); },
    tick: function (a, o) { if (tk() % 100 === 0) party().forEach(function (x) { heal(x, mhpOf(a) * o.p / 100); }); },
    teamCut: function (a, o) { return o.full && hpOf(a) >= mhpOf(a) ? o.full : 0; }
  });
  def('relic_bandit_token', [{ p: 1 }, { p: 1.5, c: 10 }, { p: 2, c: 15 }, { p: 2, c: 20, team: 1 }], {
    t: function (o) { return '打倒怪物回 HP ' + o.p + '%' + (o.c ? '；' + o.c + '% 搶到戰利品：' + (o.team ? '全隊' : '你') + ' 10 秒傷害 +10%' : ''); },
    kill: function (a, o) { heal(a, mhpOf(a) * o.p / 100); if (o.c && roll(o.c)) { var s = S(a, 'band'); s.until = tk() + 100; s.team = !!o.team; pop('band', '搶到了'); } },
    dmg: function (a, o) { var s = S(a, 'band'); return (s.until || 0) > tk() ? 10 : 0; },
    team: function (a, o) { var s = S(a, 'band'); return s.team && (s.until || 0) > tk() ? 10 : 0; }
  });
  def('relic_mermaid_tear', [{ p: 5 }, { p: 8 }, { p: 10 }, { p: 10, song: 15 }], {
    t: function (o) { return '你的治療也幫目標回 MP（治療量的 ' + o.p + '%）' + (o.song ? '；每 30 秒全隊回 MP 15%' : ''); },
    healOut: function (a, o, c) { if (c.amt > 0) setMp(c.to, mpOf(c.to) + c.amt * o.p / 100); },
    tick: function (a, o) { if (o.song && cd(S(a, 'mer'), 's', 30)) party().forEach(function (x) { setMp(x, mpOf(x) + N(x.mmp) * 0.15); }); }
  });
  def('relic_mana_spring_boots', [{ p: 5 }, { p: 8 }, { p: 10 }, { p: 12, free: 1 }], {
    t: function (o) { return 'MP 滿的時候每 5 秒得到護盾（最大 MP ' + o.p + '%）' + (o.free ? '；護盾被打破時回 MP 15%' : ''); },
    tick: function (a, o) { if (!isPlayer(a) || N(a.mmp) <= 0) return; if (mpOf(a) >= N(a.mmp) && tk() % 50 === 0) shield(a, N(a.mmp) * o.p / 100, 25); }
  });
  def('relic_evilchest_relic', [{ t: 30 }, { t: 20 }, { t: 15 }, { t: 15, jack: 10 }], {
    t: function (o) { return '每 ' + o.t + ' 秒開寶箱：隨機一個增益 10 秒（傷害 +10%、減傷 +10%、回 HP 5%、回 MP 5%）' + (o.jack ? '；10% 開出大獎，四種同時生效' : ''); },
    tick: function (a, o, c) { var s = S(a, 'chest'); if (!c.fight || !cd(s, 'o', o.t)) return; var all = o.jack && roll(o.jack), r = Math.floor(Math.random() * 4); s.until = tk() + 100; s.dmg = all || r === 0; s.cut = all || r === 1; if (all || r === 2) heal(a, mhpOf(a) * 0.05); if (all || r === 3) setMp(a, mpOf(a) + N(a.mmp) * 0.05); pop('chest', all ? '大獎！' : '開寶箱'); },
    dmg: function (a) { var s = S(a, 'chest'); return s.dmg && (s.until || 0) > tk() ? 10 : 0; },
    cut: function (a) { var s = S(a, 'chest'); return s.cut && (s.until || 0) > tk() ? 10 : 0; }
  });
  def('relic_paper_cloak', [{ x: 1, cd: 120 }, { x: 1.5, cd: 90 }, { x: 2, cd: 60 }, { x: 2, cd: 60, decoy: 1 }], {
    t: function (o) { return '受到致命傷時改扣 MP（每 1 MP 擋 ' + o.x + ' HP，冷卻 ' + o.cd + ' 秒）' + (o.decoy ? '；擋下後 3 秒紙人幫你吸引攻擊（受到的傷害 −50%）' : ''); },
    taken: function (a, o, c) { if (!isPlayer(a) || c.dmg < hpOf(a)) return c.dmg; var s = S(a, 'paper'); if (!cd(s, 'u', o.cd)) return c.dmg; var need = (c.dmg - hpOf(a) + 1) / o.x, mp = mpOf(a); if (mp <= 0) return c.dmg; var use = Math.min(mp, need); setMp(a, mp - use); if (o.decoy) s.decoy = tk() + 30; pop('paper', '紙替身'); return Math.max(0, c.dmg - use * o.x); },
    cut: function (a, o) { return o.decoy && (S(a, 'paper').decoy || 0) > tk() ? 50 : 0; }
  });
  def('relic_wither_amulet', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 15, low: 50 }], {
    t: function (o) { return 'MP 低於 20% 時，每 3 秒用 HP 2% 換 MP 4%；這時魔法傷害 +' + o.p + '%' + (o.low ? '；HP 低於 30% 時魔法傷害再 +50%' : ''); },
    tick: function (a, o) { if (!isPlayer(a) || N(a.mmp) <= 0 || tk() % 30) return; if (mpOf(a) < N(a.mmp) * 0.2 && hpOf(a) > mhpOf(a) * 0.1) { a.hp -= Math.floor(mhpOf(a) * 0.02); setMp(a, mpOf(a) + N(a.mmp) * 0.04); } },
    dmg: function (a, o, c) { if (c.kind !== 'magic') return 0; var add = mpOf(a) < N(a.mmp) * 0.2 ? o.p : 0; if (o.low && hpOf(a) < mhpOf(a) * 0.3) add += o.low; return add; }
  });
  def('relic_dark_manaball', [{ p: 10 }, { p: 15 }, { p: 20 }, { p: 30, blast: 1 }], {
    t: function (o) { return '被魔法打中時，那一下的 ' + o.p + '% 變成 MP' + (o.blast ? '；MP 滿時把吸收量轟回全體敵人（冷卻 20 秒）' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'magic') return c.dmg; var v = c.dmg * o.p / 100, s = S(a, 'mball'); setMp(a, mpOf(a) + v); s.acc = N(s.acc) + v; if (o.blast && mpOf(a) >= N(a.mmp) && cd(s, 'b', 20)) { var bv = s.acc; s.acc = 0; mobs().forEach(function (m) { hit(m, bv); }); pop('mball', '魔力反轟'); } return c.dmg; }
  });
  def('relic_orin_ring', [{ p: 10 }, { p: 15 }, { p: 20 }, { p: 20, oath: 1 }], {
    t: function (o) { return '和第一位傭兵互相分享 ' + o.p + '% 的治療' + (o.oath ? '；其中一人倒下時另一人 10 秒傷害 ×2，並把他拉起來（HP 30%，每張地圖一次）' : ''); },
    healIn: function (a, o, c) { var p = P(), mate = isPlayer(a) ? (p.allies || [])[0] : p; if (mate && mate !== a && c.amt > 0) heal(mate, c.amt * o.p / 100); },
    tick: function (a, o) { if (!o.oath || !isPlayer(a)) return; var s = S(a, 'orin'), mate = (a.allies || [])[0], mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; s.used = 0; } if (mate && mate._downed && !s.used) { s.used = 1; s.until = tk() + 100; try { mate._downed = false; mate.curHp = Math.floor(mhpOf(mate) * 0.3); } catch (e) {} pop('orin', '誓約'); } },
    dmg: function (a) { return (S(a, 'orin').until || 0) > tk() ? 100 : 0; }
  });
  def('relic_lizard_scale', [{ t: 60, p: 5 }, { t: 45, p: 8 }, { t: 30, p: 10 }, { t: 30, p: 10, husk: 1 }], {
    t: function (o) { return '每 ' + o.t + ' 秒蛻皮：解除異常狀態、回 MP ' + o.p + '%' + (o.husk ? '；蛻皮後 2 秒受到的傷害 −50%' : ''); },
    tick: function (a, o, c) { var s = S(a, 'liz'); if (!c.fight || !cd(s, 'm', o.t)) return; cleanse(a, 9); setMp(a, mpOf(a) + N(a.mmp) * o.p / 100); if (o.husk) s.husk = tk() + 20; pop('liz', '蛻皮'); },
    cut: function (a, o) { return o.husk && (S(a, 'liz').husk || 0) > tk() ? 50 : 0; }
  });
  def('relic_cyclops_dollsuit', [{ p: 20 }, { p: 30 }, { p: 40 }, { p: 50, skill: 1 }], {
    t: function (o) { return '魔法娃娃在身上時，你造成的傷害 +' + r1(o.p / 10) + '%、受到的傷害 −' + r1(o.p / 10) + '%' + (o.skill ? '；娃娃每 20 秒出手一次（攻擊型追擊、輔助型全隊回 HP 3%）' : ''); },
    dmg: function (a, o) { return dollOn(a) ? o.p / 10 : 0; }, cut: function (a, o) { return dollOn(a) ? o.p / 10 : 0; },
    tick: function (a, o, c) { if (!o.skill || !c.fight || !dollOn(a) || !cd(S(a, 'doll'), 's', 20)) return; var tg = target(); if (tg && roll(50)) hit(tg, panel(a) * 1.5); else party().forEach(function (x) { heal(x, mhpOf(x) * 0.03); }); pop('doll', '娃娃出手'); }
  });
  var dollOn = function (a) { try { return !!(a && a.eq && Object.keys(a.eq).some(function (k) { return /^doll/.test(k) && a.eq[k]; })); } catch (e) { return false; } };
  var cleanse = function (a, n) { var s = isPlayer(a) ? a.statuses : (a.st || a.statuses); if (!s) return 0; var k = 0; ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'slow', 'silence', 'magicseal', 'poison', 'blind', 'confuse', 'panic', 'curse'].forEach(function (x) { if (k < n && s[x] > 0) { s[x] = 0; k++; } }); return k; };

  // ---- 坦、減傷 ----
  def('relic_troll_belly', [{ th: 15, d: 2 }, { th: 15, d: 3 }, { th: 15, d: 3, hx: 1.5 }, { th: 15, d: 4, hx: 2 }], {
    t: function (o) { return '單次超過最大 HP ' + o.th + '% 的傷害，改成 ' + o.d + ' 秒內分次扣' + (o.hx ? '；分次扣的期間受到的治療 ×' + o.hx : ''); },
    taken: function (a, o, c) { if (c.dmg <= mhpOf(a) * o.th / 100) return c.dmg; var s = S(a, 'belly'); s.q = (s.q || []); s.q.push({ per: c.dmg / (o.d * 10), until: tk() + o.d * 10 }); return 0; },
    tick: function (a, o) { var s = S(a, 'belly'); if (!s.q || !s.q.length) return; var t = tk(), sum = 0; s.q = s.q.filter(function (x) { if (x.until <= t) return false; sum += x.per; return true; }); if (sum > 0) { if (isPlayer(a)) { a.hp -= Math.floor(sum); if (a.hp <= 0) { a.hp = 0; try { killPlayer(); } catch (e) {} } } else { a.curHp -= Math.floor(sum); } } },
    healMulIn: function (a, o) { var s = S(a, 'belly'); return o.hx && s.q && s.q.length ? (o.hx - 1) * 100 : 0; }
  });
  def('relic_slave_shirt', [{ k: 10, p: 20 }, { k: 10, p: 30 }, { k: 20, p: 40 }, { k: 20, p: 50, team: 15 }], {
    t: function (o) { return '每受到一次傷害 +1 層忍耐（最多 ' + o.k + ' 層），滿層下一擊追加累積受傷量的 ' + o.p + '%' + (o.team ? '；滿層時全隊 5 秒傷害 +15%' : ''); },
    taken: function (a, o, c) { var s = S(a, 'slave'); s.n = Math.min(o.k, N(s.n) + 1); s.acc = N(s.acc) + c.dmg; if (s.n >= o.k && o.team && !s.tm) { s.tm = 1; s.tu = tk() + 50; } return c.dmg; },
    hit: function (a, o, c) { var s = S(a, 'slave'); if (N(s.n) >= o.k) { var v = s.acc * o.p / 100; s.n = 0; s.acc = 0; s.tm = 0; later(function () { hit(c.tgt, v); }); pop('slave', '忍耐爆發'); } },
    team: function (a, o) { return (S(a, 'slave').tu || 0) > tk() ? N(o.team) : 0; }
  });
  def('relic_arrowfur_cloak', [{ c: 30, p: 10 }, { c: 50, p: 15 }, { c: 70, p: 20 }, { c: 100, p: 30, volley: 10 }], {
    t: function (o) { return '遠距離的怪 ' + o.c + '% 改打你；受到的遠距離傷害 −' + o.p + '%' + (o.volley ? '；每擋 10 支箭回射一輪（全體、你傷害的 100%）' : ''); },
    taken: function (a, o, c) { if (!c.mob || !c.mob.ranged) return c.dmg; var s = S(a, 'arrow'); if (o.volley) { s.n = N(s.n) + 1; if (s.n >= 10) { s.n = 0; var v = panel(a); mobs().forEach(function (m) { hit(m, v); }); pop('arrow', '回射'); } } return c.dmg * (1 - o.p / 100); },
    tick: function (a, o, c) { if (!c.fight || tk() % 20) return; mobs().forEach(function (m) { if (m.ranged && roll(o.c)) { try { ironGuardTaunt(m, a); } catch (e) {} } }); }
  });
  def('relic_ohm_heavyarmor', [{ p: 5 }, { p: 8, stun: 1 }, { p: 12, stun: 1 }, { p: 15, stun: 1, still: 20 }], {
    t: function (o) { return '受到的傷害 −' + o.p + '%' + (o.stun ? '；不會被暈眩' : '') + (o.still ? '；持續被打 5 秒以上進入不動：受到的傷害再 −20%' : ''); },
    cut: function (a, o) { var s = S(a, 'ohm'), add = o.p; if (o.still && s.since && tk() - s.since >= 50 && tk() - N(s.last) < 20) add += o.still; return add; },
    taken: function (a, o, c) { var s = S(a, 'ohm'), t = tk(); if (!s.last || t - s.last > 20) s.since = t; s.last = t; return c.dmg; },
    resist: function (a, o, k) { return !!(o.stun && k === 'stun'); }
  });
  def('relic_dragonturtle_shell', [{ d: 1, cd: 90 }, { d: 2, cd: 75 }, { d: 3, cd: 60 }, { d: 3, cd: 60, ram: 50 }], {
    t: function (o) { return 'HP 低於 30% 時縮殼：' + o.d + ' 秒不受傷害（冷卻 ' + o.cd + ' 秒）' + (o.ram ? '；縮殼結束把擋下的傷害 50% 撞回去' : ''); },
    taken: function (a, o, c) { var s = S(a, 'turtle'), t = tk(); if ((s.until || 0) > t) { s.acc = N(s.acc) + c.dmg; return 0; } if (hpOf(a) - c.dmg < mhpOf(a) * 0.3 && cd(s, 'u', o.cd)) { s.until = t + o.d * 10; s.acc = c.dmg; s.mob = c.mob; pop('turtle', '縮殼'); return 0; } return c.dmg; },
    tick: function (a, o) { var s = S(a, 'turtle'); if (o.ram && s.acc && (s.until || 0) <= tk()) { var v = s.acc * o.ram / 100; s.acc = 0; var m = alive(s.mob) ? s.mob : target(); if (m) hit(m, v); } }
  });
  def('relic_giant_clubfrag', [{ c: 10, d: 0.5 }, { c: 15, d: 1 }, { c: 20, d: 1 }, { c: 25, d: 1, wave: 10 }], {
    t: function (o) { return '格擋成功時 ' + o.c + '% 讓攻擊者暈 ' + o.d + ' 秒' + (o.wave ? '；每格擋 10 次，下一次盾擊打全體' : ''); },
    block: function (a, o, c) { var s = S(a, 'club'); s.n = N(s.n) + 1; var all = o.wave && s.n >= o.wave; if (all) s.n = 0; if (all) mobs().forEach(function (m) { stat(m, 'stun', o.d); }); else if (roll(o.c)) stat(c.mob, 'stun', o.d); }
  });
  def('relic_ogre_mawashi', [{ c: 5 }, { c: 8 }, { c: 10 }, { c: 12, p: 20 }], {
    t: function (o) { return '被近戰攻擊時 ' + o.c + '% 打斷那隻怪的下一招（延後 1.5 秒）' + (o.p ? '；被打斷的怪 3 秒受到傷害 +20%' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'phys' || !c.mob || c.mob.ranged || !roll(o.c)) return c.dmg; c.mob._atkCd = N(c.mob._atkCd) + 15; if (o.p) vuln(c.mob, 'mawashi', o.p, 3); return c.dmg; }
  });
  def('relic_panda_eyes', [{ s: 5, p: 30 }, { s: 4, p: 40 }, { s: 3, p: 50 }, { s: 3, p: 50, nap: 2 }], {
    t: function (o) { return o.s + ' 秒沒被打，下一次受到的傷害 −' + o.p + '%' + (o.nap ? '；打瞌睡時每秒回 HP 2%' : ''); },
    taken: function (a, o, c) { var s = S(a, 'panda'), t = tk(), ready = t - N(s.last) >= o.s * 10; s.last = t; return ready ? c.dmg * (1 - o.p / 100) : c.dmg; },
    tick: function (a, o) { if (!o.nap || tk() % 10) return; var s = S(a, 'panda'); if (tk() - N(s.last) >= o.s * 10) heal(a, mhpOf(a) * o.nap / 100); }
  });
  def('relic_dullahan_ember', [{ s: 2 }, { s: 3 }, { s: 4 }, { s: 5, rise: 20 }], {
    t: function (o) { return '倒下後 ' + o.s + ' 秒內還能戰鬥（每張地圖一次）' + (o.rise ? '；這段時間打倒怪物就站起來（HP 20%）' : ''); },
    death: function (a, o) { var s = S(a, 'dull'), mp = String(mapState.current || ''); if (s.map === mp) return false; s.map = mp; s.until = tk() + o.s * 10; a.hp = 1; pop('dull', '餘火'); return true; },
    taken: function (a, o, c) { var s = S(a, 'dull'); if ((s.until || 0) > tk()) return 0; return c.dmg; },
    tick: function (a, o) { var s = S(a, 'dull'); if (s.until && s.until <= tk()) { s.until = 0; if (isPlayer(a) && !s.rose) { a.hp = 0; try { killPlayer(); } catch (e) {} } s.rose = 0; } },
    kill: function (a, o) { var s = S(a, 'dull'); if (o.rise && (s.until || 0) > tk()) { s.until = 0; s.rose = 1; a.hp = Math.floor(mhpOf(a) * 0.2); pop('dull', '重新站起'); } }
  });
  def('relic_yeti_foot', [{ k: 20, d: 0.5 }, { k: 15, d: 1 }, { k: 10, d: 1 }, { k: 10, d: 1.5, p: 25 }], {
    t: function (o) { return '被打一下累積 1 層寒氣，' + o.k + ' 層時凍住周圍敵人 ' + o.d + ' 秒' + (o.p ? '；凍住的怪受到傷害 +25%' : ''); },
    taken: function (a, o, c) { var s = S(a, 'yeti'); s.n = N(s.n) + 1; if (s.n >= o.k) { s.n = 0; mobs().forEach(function (m) { if (stat(m, 'freeze', o.d) && o.p) vuln(m, 'yeti', o.p, o.d + 1); }); pop('yeti', '寒氣爆發'); } return c.dmg; }
  });
  def('relic_bear_fur', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, share: 1 }], {
    t: function (o) { return '受到的魔法傷害 ' + o.p + '% 變成護盾' + (o.share ? '；同時給 HP 最低的隊友回復同樣的量' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'magic') return c.dmg; var v = c.dmg * o.p / 100; shield(a, v, 10); if (o.share) { var l = lowest(); if (l && l !== a) heal(l, v); } return c.dmg; }
  });
  def('relic_darkspirit_shroud', [{ p: 30 }, { p: 100 }, { p: 100, er: 15 }, { p: 100, er: 30, d: 1.5 }], {
    t: function (o) { return '迴避成功後下一擊' + (o.p >= 100 ? '必定爆擊' : '爆擊率 +' + o.p + '%') + (o.er ? '；迴避後 ' + (o.d || 1) + ' 秒內受到的傷害 −' + o.er + '%' : ''); },
    evade: function (a, o) { var s = S(a, 'shroud'); s.ready = 1; s.until = tk() + (o.d || 1) * 10; },
    dmg: function (a, o, c) { var s = S(a, 'shroud'); if (s.ready && c.kind !== 'magic') { s.ready = 0; return o.p >= 100 ? 50 : o.p / 2; } return 0; },
    cut: function (a, o) { return o.er && (S(a, 'shroud').until || 0) > tk() ? o.er : 0; }
  });
  def('relic_red_wraith', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 15, back: 1 }], {
    t: function (o) { return '受到的傷害 ' + o.p + '% 由背後靈吃下，5 秒後在攻擊者身上爆開' + (o.back ? '，並回你同樣的 HP' : ''); },
    taken: function (a, o, c) { var v = c.dmg * o.p / 100, m = c.mob; if (v > 0) later(function () { if (alive(m)) hit(m, v); if (o.back) heal(a, v); }, 5000); return c.dmg - v; }
  });
  def('relic_bat_wing', [{ c: 5, p: 30 }, { c: 8, p: 40 }, { c: 10, p: 50 }, { c: 15, p: 60, team: 1 }], {
    t: function (o) { return '受擊時 ' + o.c + '% 放出蝙蝠吸攻擊者的血（你傷害的 ' + o.p + '%）' + (o.team ? '，吸的血分給全隊' : '') ; },
    taken: function (a, o, c) { if (!c.mob || !roll(o.c)) return c.dmg; var v = panel(a) * o.p / 100; hit(c.mob, v); if (o.team) party().forEach(function (x) { heal(x, v / party().length); }); else heal(a, v); return c.dmg; }
  });
  def('relic_bara_wing', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 15, ff: 10 }], {
    t: function (o) { return '攻擊你的怪 5 秒內攻擊有 ' + o.p + '% 落空' + (o.ff ? '；中鱗粉的怪 10% 打到自己人' : ''); },
    taken: function (a, o, c) { if (!c.mob) return c.dmg; var m = mk(c.mob), t = tk(); var had = (m.dust || 0) > t; m.dust = t + 50; m.dustP = o.p; if (had && o.ff && roll(o.ff)) { var nx = nearest(c.mob); if (nx) hit(nx, c.dmg); return 0; } return c.dmg; }
  });
  def('relic_frost_stone_shield', [{ p: 10 }, { p: 20 }, { p: 30 }, { p: 30, shatter: 10 }], {
    t: function (o) { return '格擋時凍住攻擊者的武器：攻擊速度 −' + o.p + '%（3 秒）' + (o.shatter ? '；被凍住的怪倒下時碎裂，周圍受到它最大 HP 10%' : ''); },
    block: function (a, o, c) { try { var r = RA(); if (r) r.status(c.mob, 'attackSlow', 3, o.p / 100); } catch (e) {} mk(c.mob).frost = tk() + 30; },
    kill: function (a, o, c) { if (!o.shatter || (mk(c.m).frost || 0) <= tk()) return; var v = N(c.m.hp) * o.shatter / 100; mobs().forEach(function (m) { hit(m, v); }); }
  });
  def('relic_dwarf_chainmail', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, all: 1 }], {
    t: function (o) { return '替 HP 最低的隊友承受 ' + o.p + '% 傷害' + (o.all ? '；他 HP 低於 20% 時你替他吃 100%（3 秒，冷卻 60 秒）' : ''); },
    guard: function (a, o, who, c) { if (who === a) return c.dmg; var l = lowest(); if (l !== who) return c.dmg; var s = S(a, 'dwarf'), p = o.p; if (o.all && hpOf(who) < mhpOf(who) * 0.2) { if ((s.until || 0) > tk() || cd(s, 'u', 60)) { if (!s.until || s.until < tk()) s.until = tk() + 30; p = 100; } } var mv = c.dmg * p / 100; if (isPlayer(a)) a.hp = Math.max(1, a.hp - mv); else a.curHp = Math.max(1, N(a.curHp) - mv); return c.dmg - mv; }
  });
  def('relic_metalshell_shin', [{ p: 5, k: 2 }, { p: 8, k: 3 }, { p: 10, k: 4 }, { p: 12, k: 5, x: 20 }], {
    t: function (o) { return '反彈物理傷害 ' + o.p + '%，攻擊者 AC +' + o.k + '（最多 5 層）' + (o.x ? '；疊滿的怪受到全隊物理傷害 +20%' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'phys' || !c.mob) return c.dmg; hit(c.mob, c.dmg * o.p / 100); var n = acShred(c.mob, o.k, o.k * 5); if (o.x && n >= o.k * 5) vuln(c.mob, 'metal', o.x, 5); return c.dmg; }
  });
  def('relic_gatekeeper_boots', [{ s: 2, p: 10 }, { s: 3, p: 15 }, { s: 4, p: 20 }, { s: 5, p: 30, h: 0.5 }], {
    t: function (o) { return '每場戰鬥開始嘲諷全部敵人，' + o.s + ' 秒內受到的傷害 −' + o.p + '%' + (o.h ? '；這段時間每擋一下全隊回 HP 0.5%' : ''); },
    tick: function (a, o, c) { var s = S(a, 'gate'); if (!c.fight) { s.started = 0; return; } if (!s.started) { s.started = 1; s.until = tk() + o.s * 10; mobs().forEach(function (m) { try { ironGuardTaunt(m, a); } catch (e) {} }); pop('gate', '守門'); } },
    taken: function (a, o, c) { var s = S(a, 'gate'); if ((s.until || 0) > tk()) { if (o.h) party().forEach(function (x) { heal(x, mhpOf(x) * o.h / 100); }); return c.dmg * (1 - o.p / 100); } return c.dmg; }
  });
  def('relic_soldierant_carapace', [{ p: 0.5 }, { p: 1 }, { p: 1.5 }, { p: 2, half: 1 }], {
    t: function (o) { return '隊伍每多一人，你受到的傷害 −' + o.p + '%' + (o.half ? '；這部分減傷的一半分給全隊' : ''); },
    cut: function (a, o) { return o.p * Math.max(0, party().length - 1); },
    teamCut: function (a, o) { return o.half ? o.p * Math.max(0, party().length - 1) / 2 : 0; }
  });
  def('relic_heavy_belt', [{ s: 2 }, { s: 3 }, { s: 4 }, { s: 5, p: 15 }], {
    t: function (o) { return '攻擊你的頭目被鎖住，' + o.s + ' 秒內只能打你（冷卻 30 秒）' + (o.p ? '；鎖鏈期間頭目受到傷害 +15%' : ''); },
    taken: function (a, o, c) { if (!c.mob || !c.mob.boss) return c.dmg; var s = S(a, 'belt'); if (cd(s, 'l', 30)) { try { ironGuardTaunt(c.mob, a); } catch (e) {} if (o.p) vuln(c.mob, 'belt', o.p, o.s); pop('belt', '鎖鏈'); } return c.dmg; }
  });
  def('relic_ska_armguard', [{ t: 40, k: 1 }, { t: 30, k: 2 }, { t: 25, k: 3 }, { t: 20, k: 3, rock: 5 }], {
    t: function (o) { return '每 ' + o.t + ' 秒長出一層石膚，擋下一次攻擊（最多 ' + o.k + ' 層）' + (o.rock ? '；石膚破掉時碎石打全體（你最大 HP 5%）' : ''); },
    tick: function (a, o) { var s = S(a, 'ska'); if (cd(s, 'g', o.t)) s.n = Math.min(o.k, N(s.n) + 1); },
    taken: function (a, o, c) { var s = S(a, 'ska'); if (N(s.n) > 0) { s.n--; if (o.rock) mobs().forEach(function (m) { hit(m, mhpOf(a) * o.rock / 100); }); pop('ska', '石膚'); return 0; } return c.dmg; }
  });
  def('relic_teo_footprint', [{ k: 20, p: 5 }, { k: 15, p: 5 }, { k: 10, p: 8 }, { k: 10, p: 10, stun: 1 }], {
    t: function (o) { return '每被打 ' + o.k + ' 下踏地一次：全體敵人受到你最大 HP ' + o.p + '% 的傷害' + (o.stun ? '並暈 0.5 秒' : ''); },
    taken: function (a, o, c) { var s = S(a, 'teo'); s.n = N(s.n) + 1; if (s.n >= o.k) { s.n = 0; var v = mhpOf(a) * o.p / 100; mobs().forEach(function (m) { hit(m, v); if (o.stun) stat(m, 'stun', 0.5); }); pop('teo', '震地'); } return c.dmg; }
  });
  def('relic_remnant_barrier', [{ p: 10 }, { p: 20 }, { p: 30 }, { p: 40, refill: 1 }], {
    t: function (o) { return '受到傷害的 ' + o.p + '% 改扣 MP（1 MP 擋 1 HP）' + (o.refill ? '；MP 低於 20% 時回 30%（冷卻 60 秒）' : ''); },
    taken: function (a, o, c) { var mv = Math.min(mpOf(a), c.dmg * o.p / 100); if (mv > 0) setMp(a, mpOf(a) - mv); if (o.refill && N(a.mmp) > 0 && mpOf(a) < N(a.mmp) * 0.2 && cd(S(a, 'rem'), 'r', 60)) setMp(a, mpOf(a) + N(a.mmp) * 0.3); return c.dmg - mv; }
  });
  def('relic_wisp_thought', [{ p: 10 }, { p: 15 }, { p: 20 }, { p: 30, swap: 1 }], {
    t: function (o) { return '隊友倒下時，你 30 秒內造成的傷害 +' + o.p + '%' + (o.swap ? '；這段時間你倒下時改由那名隊友站起來（HP 30%）' : ''); },
    tick: function (a, o) { var s = S(a, 'wisp'), p = P(), dn = (p.allies || []).filter(function (x) { return x && x._downed; }).length; if (dn > N(s.dn)) { s.until = tk() + 300; s.who = (p.allies || []).find(function (x) { return x && x._downed; }); } s.dn = dn; },
    dmg: function (a, o) { return (S(a, 'wisp').until || 0) > tk() ? o.p : 0; },
    death: function (a, o) { var s = S(a, 'wisp'); if (!o.swap || (s.until || 0) <= tk() || !s.who || !s.who._downed) return false; s.who._downed = false; s.who.curHp = Math.floor(mhpOf(s.who) * 0.3); s.until = 0; return false; }
  });
  def('relic_ohm_hidepants', [{ p: 20 }, { p: 30 }, { p: 40 }, { p: 50, x: 2 }], {
    t: function (o) { return '中毒、流血、燃燒對你的傷害 −' + o.p + '%，減掉的量回流給來源' + (o.x ? '（×2）' : ''); },
    dotIn: function (a, o, c) { var cut = c.dmg * o.p / 100; var m = target(); if (m) hit(m, cut * (o.x || 1)); return c.dmg - cut; }
  });
  def('relic_sr_aooni_shirt', [{ p: 1 }, { p: 2 }, { p: 3 }, { p: 4, crit: 1 }], {
    t: function (o) { return 'HP 每少 10%，造成的傷害 +' + o.p + '%' + (o.crit ? '；HP 低於 20% 時傷害再 +50%' : ''); },
    dmg: function (a, o) { var miss = Math.floor((1 - hpOf(a) / mhpOf(a)) * 10), add = o.p * miss; if (o.crit && hpOf(a) < mhpOf(a) * 0.2) add += 50; return add; }
  });
  def('relic_blackmane_coat', [{ c: 5 }, { c: 8 }, { c: 12 }, { c: 15, sure: 1 }], {
    t: function (o) { return '攻擊你的怪 ' + o.c + '% 下一招落空' + (o.sure ? '；威嚇成功時全隊下一擊傷害 +30%' : ''); },
    taken: function (a, o, c) { if (!c.mob || !roll(o.c)) return c.dmg; mk(c.mob).miss = 1; if (o.sure) party().forEach(function (x) { S(x, 'mane').next = 1; }); return 0; },
    dmg: function (a, o) { var s = S(a, 'mane'); if (s.next) { s.next = 0; return 30; } return 0; }
  });
  // ---- 五屬性 ----
  var eleOfMob = function (m) { return m && (m.e || m.ele) || 'none'; };
  var wet = function (m, sec) { if (alive(m)) mk(m).wet = tk() + sec * 10; };
  var isWet = function (m) { return (mk(m).wet || 0) > tk(); };
  def('relic_earth_barrier', [{ c: 10 }, { c: 15 }, { c: 20 }, { c: 25, slow: 1 }], {
    t: function (o) { return '受到地屬性怪物攻擊時 ' + o.c + '% 生成石牆，擋下那一次' + (o.slow ? '；石牆碎掉時周圍敵人攻速變慢 3 秒' : ''); },
    taken: function (a, o, c) { if (eleOfMob(c.mob) !== 'earth' || !roll(o.c)) return c.dmg; if (o.slow) mobs().forEach(function (m) { try { RA().status(m, 'attackSlow', 3, 0.3); } catch (e) {} }); pop('eb', '石牆'); return 0; }
  });
  def('relic_water_barrier', [{ c: 10 }, { c: 20 }, { c: 30 }, { c: 30, team: 1 }], {
    t: function (o) { return '受到水屬性怪物攻擊時，那一下 ' + o.c + '% 轉成治療' + (o.team ? '；全隊受到的水屬性傷害一起轉' : ''); },
    taken: function (a, o, c) { if (eleOfMob(c.mob) !== 'water') return c.dmg; var v = c.dmg * o.c / 100; later(function () { heal(a, v); }); return c.dmg - v; },
    teamTaken: function (a, o, who, c) { if (!o.team || who === a || eleOfMob(c.mob) !== 'water') return c.dmg; var v = c.dmg * o.c / 100; later(function () { heal(who, v); }); return c.dmg - v; }
  });
  def('relic_fire_barrier', [{ c: 10 }, { c: 15 }, { c: 20 }, { c: 25, cut: 30 }], {
    t: function (o) { return '被火屬性怪物打到時 ' + o.c + '% 讓攻擊者燃燒 5 秒' + (o.cut ? '；燃燒中的怪對你的傷害 −30%' : ''); },
    taken: function (a, o, c) { if (!c.mob) return c.dmg; var m = mk(c.mob); if (o.cut && (m.burnA || 0) > tk()) c.dmg *= 0.7; if (eleOfMob(c.mob) === 'fire' && roll(o.c)) { dot(c.mob, a, 'burn', panel(a) * 0.1, 5, 1); m.burnA = tk() + 50; } return c.dmg; }
  });
  def('relic_wind_barrier', [{ c: 10 }, { c: 15 }, { c: 20 }, { c: 25, spd: 20 }], {
    t: function (o) { return '風屬性怪物的攻擊 ' + o.c + '% 被吹散（不受傷）' + (o.spd ? '；吹散時 5 秒傷害 +20%' : ''); },
    taken: function (a, o, c) { if (eleOfMob(c.mob) !== 'wind' || !roll(o.c)) return c.dmg; if (o.spd) S(a, 'wb').until = tk() + 50; pop('wb', '吹散'); return 0; },
    dmg: function (a, o) { return o.spd && (S(a, 'wb').until || 0) > tk() ? o.spd : 0; }
  });
  def('relic_azt_prism', [{ s: 4 }, { s: 6 }, { s: 8, p: 15 }, { s: 8, p: 30 }], {
    t: function (o) { return '受到某屬性怪物攻擊後 ' + o.s + ' 秒內，你對剋制那個屬性的怪傷害 +' + (o.p || 10) + '%'; },
    taken: function (a, o, c) { var e = eleOfMob(c.mob); if (e !== 'none') { var s = S(a, 'prism'); s.e = e; s.until = tk() + o.s * 10; } return c.dmg; },
    dmg: function (a, o, c) { var s = S(a, 'prism'); if ((s.until || 0) <= tk()) return 0; return eleOfMob(c.tgt) === s.e ? (o.p || 10) : 0; }
  });
  def('relic_soldier_medal', [{ p: 3 }, { p: 5 }, { p: 8 }, { p: 10, hard: 1 }], {
    t: function (o) { return '對無屬性怪造成的傷害 +' + o.p + '%、受到的傷害 −' + o.p + '%' + (o.hard ? '；打無屬性怪時無視硬皮' : ''); },
    dmg: function (a, o, c) { var add = eleOfMob(c.tgt) === 'none' ? o.p : 0; if (o.hard && add && N(c.tgt.hardSkin) > 0) add += 15; return add; },
    taken: function (a, o, c) { return eleOfMob(c.mob) === 'none' ? c.dmg * (1 - o.p / 100) : c.dmg; }
  });
  def('relic_sr_kappa_plate', [{ c: 10, p: 10 }, { c: 15, p: 15 }, { c: 20, p: 20 }, { c: 25, p: 20, arc: 1 }], {
    t: function (o) { return '命中時 ' + o.c + '% 讓目標濕身 5 秒：受到的魔法傷害 +' + o.p + '%' + (o.arc ? '；濕身的怪被魔法打中時導電給旁邊 1 隻（30%）' : ''); },
    hit: function (a, o, c) { if (roll(o.c)) wet(c.tgt, 5); if (o.arc && c.kind === 'magic' && isWet(c.tgt)) { var nx = nearest(c.tgt); if (nx) hit(nx, c.v * 0.3); } },
    dmg: function (a, o, c) { return c.kind === 'magic' && isWet(c.tgt) ? o.p : 0; }
  });
  def('relic_sr_kettle_lid', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, burn: 10 }], {
    t: function (o) { return '擋下火或水屬性攻擊時噴蒸氣：周圍敵人 5 秒攻擊 ' + o.p + '% 落空' + (o.burn ? '；蒸氣裡的怪每秒受到你傷害的 10%' : ''); },
    taken: function (a, o, c) { var e = eleOfMob(c.mob); if (e !== 'fire' && e !== 'water') return c.dmg; var s = S(a, 'kettle'); if (cd(s, 'st', 3)) mobs().forEach(function (m) { var k = mk(m); k.dust = tk() + 50; k.dustP = o.p; if (o.burn) dot(m, a, 'steam', panel(a) * o.burn / 100, 5, 1); }); return c.dmg; }
  });
  def('relic_sr_old_umbrella', [{ p: 5, m: 5 }, { p: 10, m: 8 }, { p: 15, m: 12 }, { p: 20, m: 15, arc: 1 }], {
    t: function (o) { return '全隊受到的火屬性傷害 −' + o.p + '%；你的魔法傷害 +' + o.m + '%' + (o.arc ? '；你的魔法打中濕身的怪會導電給旁邊 1 隻' : ''); },
    teamTaken: function (a, o, who, c) { return eleOfMob(c.mob) === 'fire' ? c.dmg * (1 - o.p / 100) : c.dmg; },
    dmg: function (a, o, c) { return c.kind === 'magic' ? o.m : 0; },
    hit: function (a, o, c) { if (o.arc && c.kind === 'magic' && isWet(c.tgt)) { var nx = nearest(c.tgt); if (nx) hit(nx, c.v * 0.3); } }
  });
  def('relic_maid_gift', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, shatter: 3 }], {
    t: function (o) { return '對冰凍中的怪傷害 +' + o.p + '%' + (o.shatter ? '；冰凍結束時碎裂（它最大 HP 3%，頭目 0.3%）' : ''); },
    dmg: function (a, o, c) { var f = c.tgt.st && c.tgt.st.freeze > 0; if (f && o.shatter) mk(c.tgt).iced = a; return f ? o.p : 0; },
    tick: function (a, o) { if (!o.shatter || tk() % 5) return; mobs().forEach(function (m) { var k = mk(m); if (k.iced === a && !(m.st && m.st.freeze > 0)) { k.iced = null; hit(m, N(m.hp) * (m.boss ? 0.003 : 0.03)); } }); }
  });
  def('relic_fireegg_orb', [{ t: 6, n: 1 }, { t: 4, n: 1 }, { t: 3, n: 1 }, { t: 3, n: 3 }], {
    t: function (o) { return '炎球環繞：每 ' + o.t + ' 秒燒附近 ' + o.n + ' 隻怪（你傷害的 50%）'; },
    tick: function (a, o, c) { if (!c.fight || !cd(S(a, 'orb'), 'o', o.t)) return; var tg = target(), l = [tg].concat(others(tg, o.n - 1)).filter(alive); l.forEach(function (m) { hit(m, panel(a) * 0.5); }); }
  });
  def('relic_burning_love', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 15, m: 30 }], {
    t: function (o) { return '被火屬性怪物打到時回 MP（那一下的 ' + o.p + '%）' + (o.m ? '；你的魔法傷害 +30%' : ''); },
    taken: function (a, o, c) { if (eleOfMob(c.mob) === 'fire') setMp(a, mpOf(a) + c.dmg * o.p / 100); return c.dmg; },
    dmg: function (a, o, c) { return o.m && c.kind === 'magic' ? o.m : 0; }
  });
  def('relic_deepfish_skin', [{ c: 5, d: 0.5 }, { c: 8, d: 1 }, { c: 12, d: 1 }, { c: 15, d: 1, arc: 1 }], {
    t: function (o) { return '被近戰攻擊時 ' + o.c + '% 麻痺攻擊者 ' + o.d + ' 秒' + (o.arc ? '，並導電給旁邊 1 隻' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'phys' || !c.mob || c.mob.ranged || !roll(o.c)) return c.dmg; stat(c.mob, 'paralyze', o.d); if (o.arc) { var nx = nearest(c.mob); if (nx) stat(nx, 'paralyze', o.d); } return c.dmg; }
  });
  def('relic_caveman_webbing', [{ p: 5 }, { p: 8 }, { p: 12 }, { p: 15, ev: 20 }], {
    t: function (o) { return '水屬性怪多的地圖，你造成的傷害 +' + o.p + '%' + (o.ev ? '，受到的傷害 −20%' : ''); },
    waterMap: function () { var l = mobs(); return l.length && l.filter(function (m) { return eleOfMob(m) === 'water'; }).length * 2 >= l.length; },
    dmg: function (a, o) { return M.relic_caveman_webbing.waterMap() ? o.p : 0; },
    cut: function (a, o) { return o.ev && M.relic_caveman_webbing.waterMap() ? o.ev : 0; }
  });
  def('relic_thunder_crown', [{ t: 20 }, { t: 15 }, { t: 10 }, { t: 10, wet: 2 }], {
    t: function (o) { return '每 ' + o.t + ' 秒對 HP 最高的怪落雷（你傷害的 200%）' + (o.wet ? '；打到濕身的怪 ×2' : ''); },
    tick: function (a, o, c) { if (!c.fight || !cd(S(a, 'crown'), 'l', o.t)) return; var m = mobs().sort(function (x, y) { return N(y.curHp) - N(x.curHp); })[0]; if (m) { hit(m, panel(a) * 2 * (o.wet && isWet(m) ? 2 : 1)); pop('crown', '落雷'); } }
  });
  def('relic_scarab_shin', [{ s: 5, h: 10 }, { s: 4, h: 20 }, { s: 3, h: 30 }, { s: 3, h: 30, blind: 1 }], {
    t: function (o) { return '倒下時化為聖甲蟲，' + o.s + ' 秒後站起來（HP ' + o.h + '%，每張地圖一次）' + (o.blind ? '；站起來時周圍敵人 3 秒攻擊 50% 落空' : ''); },
    death: function (a, o) { var s = S(a, 'scarab'), mp = String(mapState.current || ''); if (s.map === mp) return false; s.map = mp; a.hp = 1; s.until = tk() + o.s * 10; pop('scarab', '聖甲蟲'); return true; },
    taken: function (a, o, c) { var s = S(a, 'scarab'); return (s.until || 0) > tk() ? 0 : c.dmg; },
    tick: function (a, o) { var s = S(a, 'scarab'); if (s.until && s.until <= tk()) { s.until = 0; a.hp = Math.max(1, Math.floor(mhpOf(a) * o.h / 100)); if (o.blind) mobs().forEach(function (m) { var k = mk(m); k.dust = tk() + 30; k.dustP = 50; }); } }
  });
  def('relic_seawater_shirt', [{ t: 30 }, { t: 20 }, { t: 15 }, { t: 15, sh: 1 }], {
    t: function (o) { return '每 ' + o.t + ' 秒擋下一次火屬性傷害' + (o.sh ? '，擋下的量變成護盾' : ''); },
    taken: function (a, o, c) { if (eleOfMob(c.mob) !== 'fire' || !cd(S(a, 'sea'), 'f', o.t)) return c.dmg; if (o.sh) shield(a, c.dmg, 20); return 0; }
  });
  def('relic_pirate_bandana', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 20, chest: 3 }], {
    t: function (o) { return '打倒水屬性怪的金幣 +' + o.p + '%' + (o.chest ? '；3% 撿到海賊錢袋（那隻怪金幣 ×5）' : ''); },
    kill: function (a, o, c) { if (eleOfMob(c.m) !== 'water' || !isPlayer(a)) return; var g = Math.floor((N(c.m.goldMin) + N(c.m.goldMax)) / 2 * o.p / 100); if (o.chest && roll(o.chest)) g += Math.floor((N(c.m.goldMin) + N(c.m.goldMax)) / 2 * 5); if (g > 0) a.gold = N(a.gold) + g; }
  });
  // ---- 武器 ----
  def('relic_goblin_blade', [{ k: 20, p: 100 }, { k: 15, p: 100 }, { k: 10, p: 150 }, { k: 10, p: 200, ac: 10 }], {
    t: function (o) { return '打倒怪物撿 1 片石片，' + o.k + ' 片時投出打全體（你傷害的 ' + o.p + '%）' + (o.ac ? '；打中的怪 AC +10' : ''); },
    kill: function (a, o) { var s = S(a, 'gob'); s.n = N(s.n) + 1; if (s.n >= o.k) { s.n = 0; var v = panel(a) * o.p / 100; mobs().forEach(function (m) { hit(m, v); if (o.ac) acShred(m, 10, 10); }); pop('gob', '投石'); } }
  });
  def('relic_gladiator_scimitar', [{ p: 1, k: 10 }, { p: 1, k: 20 }, { p: 2, k: 30 }, { p: 2, k: 30, crit: 5 }], {
    t: function (o) { return '只有一隻敵人時，連打同一目標每下 +' + o.p + '%（最多 ' + o.k + '%）' + (o.crit ? '；疊滿後每 5 下傷害 ×1.5' : ''); },
    dmg: function (a, o, c) { var s = S(a, 'glad'); if (mobs().length > 1) { s.n = 0; return 0; } if (s.t === c.tgt) s.n = Math.min(o.k / o.p, N(s.n) + 1); else { s.t = c.tgt; s.n = 0; } var add = s.n * o.p; if (o.crit && add >= o.k) { s.c = N(s.c) + 1; if (s.c >= o.crit) { s.c = 0; add += 50; } } return add; }
  });
  def('relic_orc_nail', [{ c: 3, d: 1 }, { c: 5, d: 2 }, { c: 8, d: 2 }, { c: 10, d: 2, gas: 1 }], {
    t: function (o) { return '命中時 ' + o.c + '% 讓目標發臭 ' + o.d + ' 秒：旁邊的怪去打它（頭目無效）' + (o.gas ? '；臭到倒下的怪爆出毒霧' : ''); },
    hit: function (a, o, c) { if (c.tgt.boss || !roll(o.c)) return; var m = mk(c.tgt); m.stink = tk() + o.d * 10; m.stinkA = a; stat(c.tgt, 'confuse', o.d); },
    tick: function (a, o) { if (tk() % 10) return; mobs().forEach(function (m) { var k = MK_.get(m); if (k && k.stinkA === a && (k.stink || 0) > tk()) others(m, 1).forEach(function (x) { hit(m, N(x.lv) * 3); }); }); },
    kill: function (a, o, c) { var k = MK_.get(c.m); if (o.gas && k && k.stinkA === a && (k.stink || 0) > tk()) mobs().forEach(function (m) { dot(m, a, 'gas', panel(a) * 0.1, 5, 1); }); }
  });
  def('relic_orc_cleaver', [{ c: 1 }, { c: 2 }, { c: 3 }, { c: 3, team: 1 }], {
    t: function (o) { return '打倒怪物 ' + o.c + '% 做出一道料理：' + (o.team ? '全隊' : '你') + ' 30 秒隨機一項 +10%（傷害、減傷、回 HP）'; },
    kill: function (a, o) { if (!roll(o.c)) return; var s = S(a, 'cook'); s.until = tk() + 300; s.k = Math.floor(Math.random() * 3); s.team = !!o.team; pop('cook', '料理完成'); },
    dmg: function (a) { var s = S(a, 'cook'); return (s.until || 0) > tk() && s.k === 0 ? 10 : 0; },
    cut: function (a) { var s = S(a, 'cook'); return (s.until || 0) > tk() && s.k === 1 ? 10 : 0; },
    team: function (a) { var s = S(a, 'cook'); return s.team && (s.until || 0) > tk() && s.k === 0 ? 10 : 0; },
    tick: function (a) { var s = S(a, 'cook'); if ((s.until || 0) > tk() && s.k === 2 && tk() % 50 === 0) (s.team ? party() : [a]).forEach(function (x) { heal(x, mhpOf(x) * 0.02); }); }
  });
  def('relic_hobgoblin_grinder', [{ k: 10 }, { k: 15 }, { k: 20 }, { k: 20, ign: 1 }], {
    t: function (o) { return '每下讓目標 AC +1（最多 ' + o.k + ' 層）' + (o.ign ? '；疊滿時 5 秒內你的物理傷害 +25%' : ''); },
    hit: function (a, o, c) { if (c.kind === 'magic') return; var n = acShred(c.tgt, 1, o.k); if (o.ign && n >= o.k) { var m = mk(c.tgt); if (!m.ground || m.ground < tk()) m.ground = tk() + 50; } },
    dmg: function (a, o, c) { var m = MK_.get(c.tgt); return o.ign && m && (m.ground || 0) > tk() && c.kind !== 'magic' ? 25 : 0; }
  });
  def('relic_orc_butcher', [{ th: 5 }, { th: 8 }, { th: 12 }, { th: 15, rush: 1 }], {
    t: function (o) { return '一般怪 HP 低於 ' + o.th + '% 時直接斬殺' + (o.rush ? '；斬殺時回 HP 5%' : ''); },
    hit: function (a, o, c) { var m = c.tgt; if (m.boss || !alive(m) || N(m.curHp) > N(m.hp) * o.th / 100) return; later(function () { if (alive(m)) { hit(m, N(m.curHp)); if (o.rush) heal(a, mhpOf(a) * 0.05); } }); }
  });
  def('relic_venom_fang', [{ k: 2 }, { k: 3 }, { k: 4 }, { k: 5, boom: 1.5 }], {
    t: function (o) { return '命中時 15% 讓目標中毒（每層每秒你傷害的 5%，8 秒，最多 ' + o.k + ' 層）' + (o.boom ? '；疊滿時引爆剩下的毒傷 ×1.5' : ''); },
    hit: function (a, o, c) { if (!roll(15 * (M.relic_venom_fang._mul || 1))) return; var n = dot(c.tgt, a, 'venom', panel(a) * 0.05, 8, o.k); if (o.boom && n >= o.k) { var left = dotLeft(c.tgt, 'venom', a); clearDots(c.tgt, 'venom', a); hit(c.tgt, left * o.boom); pop('venom', '毒爆'); } }
  });
  def('relic_parrot_beak', [{ c: 5 }, { c: 8 }, { c: 12 }, { c: 15, all: 1 }], {
    t: function (o) { return '被魔法打中時 ' + o.c + '% 用同樣的力量回敬' + (o.all ? '（打全體）' : ''); },
    taken: function (a, o, c) { if (c.kind !== 'magic' || !c.mob || !roll(o.c)) return c.dmg; var v = c.dmg; (o.all ? mobs() : [c.mob]).forEach(function (m) { later(function () { hit(m, v); }); }); pop('parrot', '模仿'); return c.dmg; }
  });
  def('relic_pirate_scimitar', [{ c: 2 }, { c: 3, buff: 1 }, { c: 4, buff: 1 }, { c: 5, buff: 1, team: 1 }], {
    t: function (o) { return '命中時 ' + o.c + '% 搶金幣（那隻怪金幣的 10%）' + (o.buff ? '，並讓' + (o.team ? '全隊' : '你') + ' 5 秒傷害 +10%' : ''); },
    hit: function (a, o, c) { if (!roll(o.c)) return; if (isPlayer(a)) a.gold = N(a.gold) + Math.floor((N(c.tgt.goldMin) + N(c.tgt.goldMax)) / 20); if (o.buff) { var s = S(a, 'pir'); s.until = tk() + 50; s.team = !!o.team; } },
    dmg: function (a) { return (S(a, 'pir').until || 0) > tk() ? 10 : 0; },
    team: function (a) { var s = S(a, 'pir'); return s.team && (s.until || 0) > tk() ? 10 : 0; }
  });
  def('relic_whirlwind_xbow', [{ c: 30, n: 1 }, { c: 40, n: 1 }, { c: 50, n: 2 }, { c: 100, n: 9, inc: 10 }], {
    t: function (o) { return o.n >= 9 ? '遠距離攻擊穿透所有怪，每穿過一隻 +10%' : '遠距離攻擊 ' + o.c + '% 穿過去打後面 ' + o.n + ' 隻（50% 傷害）'; },
    hit: function (a, o, c) { if (c.kind !== 'ranged' || !roll(o.c)) return; var l = others(c.tgt, o.n), v = c.v * 0.5; l.forEach(function (m, i) { later(function () { hit(m, v * (1 + (o.inc ? o.inc * (i + 1) / 100 : 0))); }); }); }
  });
  def('relic_modded_crossbow', [{ k: 10 }, { k: 8 }, { k: 5 }, { k: 5, all: 1 }], {
    t: function (o) { return '每 ' + o.k + ' 下換一種彈：火（燃燒）、冰（攻速變慢）、毒、爆（範圍 30%）' + (o.all ? '；每 60 秒四種同時裝填 10 秒' : ''); },
    hit: function (a, o, c) { if (c.kind === 'magic') return; var s = S(a, 'mod'); s.n = N(s.n) + 1; if (s.n % o.k === 0) s.b = (N(s.b) + 1) % 4; var all = o.all && ((s.allU || 0) > tk() || cd(s, 'all', 60) && (s.allU = tk() + 100)); var ks = all ? [0, 1, 2, 3] : [N(s.b)], m = c.tgt, v = c.v; ks.forEach(function (k) { if (k === 0) dot(m, a, 'mburn', v * 0.1, 3, 1); else if (k === 1) { try { RA().status(m, 'attackSlow', 3, 0.2); } catch (e) {} } else if (k === 2) dot(m, a, 'mpoi', v * 0.08, 5, 1); else others(m, 3).forEach(function (x) { later(function () { hit(x, v * 0.3); }); }); }); }
  });
  def('relic_handy_quiver', [{ k: 10 }, { k: 8 }, { k: 5 }, { k: 5, jump: 1 }], {
    t: function (o) { return '每 ' + o.k + ' 箭一發追蹤箭（再打一次 100%）' + (o.jump ? '，追蹤箭會再跳到第二隻' : ''); },
    hit: function (a, o, c) { if (c.kind !== 'ranged') return; var s = S(a, 'quiv'); s.n = N(s.n) + 1; if (s.n < o.k) return; s.n = 0; var v = c.v, m = c.tgt; later(function () { hit(m, v); if (o.jump) { var nx = nearest(m); if (nx) hit(nx, v); } }); }
  });
  def('relic_yuka_quiver', [{ p: 0.5, k: 10 }, { p: 1, k: 20 }, { p: 1, k: 30 }, { p: 1, k: 30, keep: 1 }], {
    t: function (o) { return '連續打同一目標，每下傷害 +' + o.p + '%（最多 ' + o.k + '%）' + (o.keep ? '；換目標時保留一半' : ''); },
    dmg: function (a, o, c) { var s = S(a, 'yuka'); if (s.t === c.tgt) s.v = Math.min(o.k, N(s.v) + o.p); else { s.t = c.tgt; s.v = o.keep ? N(s.v) / 2 : 0; } return s.v; }
  });
  def('relic_bk_lance', [{ x: 50, d: 0.5 }, { x: 100, d: 0.5 }, { x: 150, d: 1 }, { x: 200, d: 1, chain: 1 }], {
    t: function (o) { return '每場第一擊必定暈眩 ' + o.d + ' 秒，傷害 +' + o.x + '%' + (o.chain ? '；打倒目標後對下一隻再衝鋒（冷卻 5 秒）' : ''); },
    dmg: function (a, o, c) { var s = S(a, 'lance'); if (c.kind === 'magic') return 0; if (!s.used) { s.used = 1; stat(c.tgt, 'stun', o.d); pop('lance', '衝鋒'); return o.x; } return 0; },
    tick: function (a, o, c) { if (!c.fight) S(a, 'lance').used = 0; },
    kill: function (a, o) { if (o.chain && cd(S(a, 'lance'), 'c', 5)) S(a, 'lance').used = 0; }
  });
  def('relic_powder_arrow', [{ c: 5, p: 30 }, { c: 8, p: 40 }, { c: 12, p: 50 }, { c: 15, p: 50, fire: 10 }], {
    t: function (o) { return '命中時 ' + o.c + '% 爆炸，周圍受到 ' + o.p + '% 傷害' + (o.fire ? '，並燒 3 秒（每秒 10%）' : ''); },
    hit: function (a, o, c) { if (c.kind === 'magic' || !roll(o.c)) return; var v = c.v * o.p / 100, m = c.tgt; mobs().forEach(function (x) { if (x !== m) later(function () { hit(x, v); }); if (o.fire) dot(x, a, 'powder', c.v * 0.1, 3, 1); }); }
  });
  def('relic_elmore_greatsword', [{ p: 1, k: 10 }, { p: 1, k: 20 }, { p: 2, k: 30 }, { p: 2, k: 30, fall: 1 }], {
    t: function (o) { return '戰鬥每 10 秒 +' + o.p + '% 傷害（最多 ' + o.k + '%，換地圖歸零）' + (o.fall ? '；隊友倒下時直接疊滿' : ''); },
    tick: function (a, o, c) { var s = S(a, 'elm'), mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; s.v = 0; } if (c.fight && tk() % 100 === 0) s.v = Math.min(o.k, N(s.v) + o.p); if (o.fall && (P().allies || []).some(function (x) { return x && x._downed; })) s.v = o.k; },
    dmg: function (a) { return N(S(a, 'elm').v); }
  });
  // ---- 防具、飾品 ----
  def('relic_mushroom_cap', [{ c: 3, d: 1 }, { c: 5, d: 2 }, { c: 8, d: 2 }, { c: 10, d: 2, wake: 1 }], {
    t: function (o) { return '被打時 ' + o.c + '% 讓攻擊者睡 ' + o.d + ' 秒（頭目無效）' + (o.wake ? '；叫醒那一下傷害 ×2' : ''); },
    taken: function (a, o, c) { if (!c.mob || !roll(o.c)) return c.dmg; if (stat(c.mob, 'sleep', o.d) && o.wake) mk(c.mob).wake = 1; return c.dmg; },
    dmg: function (a, o, c) { var m = MK_.get(c.tgt); if (m && m.wake && c.tgt.st && c.tgt.st.sleep > 0) { m.wake = 0; return 100; } return 0; }
  });
  def('relic_gnomeearth_tshirt', [{ p: 5 }, { p: 10 }, { p: 15 }, { p: 15, root: 1 }], {
    t: function (o) { return '攻擊你的怪攻速 −' + o.p + '%（3 秒）' + (o.root ? '；疊 3 次定身 2 秒（頭目無效）' : ''); },
    taken: function (a, o, c) { if (!c.mob) return c.dmg; try { RA().status(c.mob, 'attackSlow', 3, o.p / 100); } catch (e) {} if (o.root) { var m = mk(c.mob); m.mud = N(m.mud) + 1; if (m.mud >= 3) { m.mud = 0; stat(c.mob, 'stun', 2); } } return c.dmg; }
  });
  def('relic_wolf_shawl', [{ p: 0.5 }, { p: 1 }, { p: 1.5 }, { p: 1.5, full: 5 }], {
    t: function (o) { return '隊伍每多一人，全隊傷害 +' + o.p + '%' + (o.full ? '；滿 8 人再 +5%' : ''); },
    team: function (a, o) { var n = party().length; return o.p * Math.max(0, n - 1) + (o.full && n >= 8 ? 5 : 0); }
  });
  def('relic_dwarf_sheet', [{ sh: 0 }, { sh: 10 }, { sh: 20 }, { sh: 20, exp: 3 }], {
    t: function (o) { return '換地圖後第一場戰鬥 HP、MP 全滿' + (o.sh ? '並有護盾（最大 HP ' + o.sh + '%）' : '') + (o.exp ? '；連續掛網 1 小時後全隊經驗 +3%' : ''); },
    tick: function (a, o, c) { var s = S(a, 'sheet'), mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; s.done = 0; } if (c.fight && !s.done) { s.done = 1; if (isPlayer(a)) { a.hp = a.mhp; a.mp = a.mmp; } else { a.curHp = a.mhp; } if (o.sh) shield(a, mhpOf(a) * o.sh / 100, o.sh); } }
  });
  def('relic_bear_fishbone', [{ x: 1.2 }, { x: 1.3 }, { x: 1.5 }, { x: 1.5, cut: 20 }], {
    t: function (o) { return '喝治癒藥水回復 ×' + o.x + (o.cut ? '；喝藥水後 3 秒受到的傷害 −20%' : ''); },
    potion: function (a, o, c) { heal(a, c.est * (o.x - 1)); if (o.cut) S(a, 'fish').until = tk() + 30; },
    cut: function (a, o) { return o.cut && (S(a, 'fish').until || 0) > tk() ? o.cut : 0; }
  });
  def('relic_eye_crystal', [{ p: 5 }, { p: 8 }, { p: 12 }, { p: 15, team: 1 }], {
    t: function (o) { return '打剋制屬性（你的攻擊屬性剋制對方）時傷害 +' + o.p + '%' + (o.team ? '；全隊同享' : ''); },
    weak: function (a, m) { try { var r = W.AFK_RELIC_RUNTIME; var w = a && a.eq && a.eq.wpn, e = (w && typeof getWpnEle === 'function' ? getWpnEle(w, DB.items[w.id], a) : null) || 'none';   /* 11-21 修：原本讀不存在的 a.d.atkEle，永遠不觸發 */ return r && r.api && e !== 'none' && r.api.weakTo(m, e); } catch (e2) { return false; } },
    dmg: function (a, o, c) { return M.relic_eye_crystal.weak(a, c.tgt) ? o.p : 0; },
    team: function (a, o, c) { return o.team && c && c.tgt && M.relic_eye_crystal.weak(a, c.tgt) ? o.p : 0; }
  });
  def('relic_monsterhand_skin', [{ c: 2 }, { c: 3 }, { c: 4 }, { c: 5, x: 2 }], {
    t: function (o) { return '命中時 ' + o.c + '% 偷走力量：' + (o.x ? 10 : 5) + ' 秒傷害 +10%、目標傷害 −10%'; },
    hit: function (a, o, c) { if (!roll(o.c)) return; S(a, 'hand').until = tk() + (o.x ? 100 : 50); try { RA().status(c.tgt, 'directDamageDown', o.x ? 10 : 5, 0.1); } catch (e) {} },
    dmg: function (a) { return (S(a, 'hand').until || 0) > tk() ? 10 : 0; }
  });
  def('relic_croc_tshirt', [{ c: 10 }, { c: 15 }, { c: 20, ct: 100 }, { c: 30, ct: 100, team: 1 }], {
    t: function (o) { return '被控制時 ' + o.c + '% 立刻掙脫' + (o.ct ? '並反擊（你傷害的 100%）' : '') + (o.team ? '；掙脫時全隊 3 秒不受控制' : ''); },
    tick: function (a, o) { var s = a.statuses || a.st; if (!s || tk() % 3) return; if ((s.stun > 0 || s.freeze > 0 || s.stone > 0 || s.paralyze > 0 || s.sleep > 0) && roll(o.c)) { cleanse(a, 5); if (o.ct) { var tg = target(); if (tg) hit(tg, panel(a)); } if (o.team) party().forEach(function (x) { S(x, 'croc').imm = tk() + 30; }); pop('croct', '掙脫'); } },
    resist: function (a, o, k) { return HARD[k] && (S(a, 'croc').imm || 0) > tk(); }
  });
  def('relic_orcmage_cloth', [{ p: 2 }, { p: 3 }, { p: 5 }, { p: 5, x: 3 }], {
    t: function (o) { return '宴會：全隊傷害 +' + o.p + '%' + (o.x ? '；身上有增益藥水時再 +3%' : ''); },
    team: function (a, o) { var add = o.p; if (o.x) { try { var b = P().buffs || {}; if (Object.keys(b).some(function (k) { return /haste|brave|elf|wis|potion|sk_haste/.test(k) && b[k] > 0; })) add += o.x; } catch (e) {} } return add; }
  });
  def('relic_roach_shell', [{ cd: 300 }, { cd: 240 }, { cd: 180 }, { cd: 120, h: 50 }], {
    t: function (o) { return '受到致命傷時保住 1 HP（冷卻 ' + o.cd + ' 秒）' + (o.h ? '；之後 3 秒回 HP 50%' : ''); },
    death: function (a, o) { var s = S(a, 'roach'); if (!cd(s, 'u', o.cd)) return false; a.hp = 1; if (o.h) s.hu = tk() + 30; pop('roach', '打不死'); return true; },
    tick: function (a, o) { var s = S(a, 'roach'); if ((s.hu || 0) > tk()) heal(a, mhpOf(a) * 0.5 / 30); }
  });
  def('relic_ungoliant_plate', [{ c: 3 }, { c: 5 }, { c: 8 }, { c: 10, p: 15 }], {
    t: function (o) { return '攻擊你的怪 ' + o.c + '% 被黏住（攻速變慢 3 秒）' + (o.p ? '；被黏住的怪受到傷害 +15%' : ''); },
    taken: function (a, o, c) { if (!c.mob || !roll(o.c)) return c.dmg; try { RA().status(c.mob, 'attackSlow', 3, 0.3); } catch (e) {} if (o.p) vuln(c.mob, 'web', o.p, 3); return c.dmg; }
  });
  def('relic_darkremnant_boots', [{ p: 3 }, { p: 5 }, { p: 8 }, { p: 10, ult: 1 }], {
    t: function (o) { return '傭兵造成的傷害 +' + o.p + '%' + (o.ult ? '；傭兵受到的傷害 −10%' : ''); },
    allyDmg: function (a, o) { return o.p; }, allyCut: function (a, o) { return o.ult ? 10 : 0; }
  });
  def('relic_wornout_underwear', [{ k: 200, m: 5 }, { k: 150, m: 10 }, { k: 100, m: 15 }, { k: 100, m: 20, team: 1 }], {
    t: function (o) { return '這張地圖每打倒 ' + o.k + ' 隻怪 +1% 傷害（最多 ' + o.m + '%）' + (o.team ? '；疊滿時全隊同享' : ''); },
    kill: function (a, o) { var s = S(a, 'vet'), mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; s.n = 0; } s.n = N(s.n) + 1; },
    dmg: function (a, o) { var s = S(a, 'vet'); return Math.min(o.m, Math.floor(N(s.n) / o.k)); },
    team: function (a, o) { var s = S(a, 'vet'); return o.team && Math.floor(N(s.n) / o.k) >= o.m ? o.m : 0; }
  });
  def('relic_blackmage_pants', [{ p: 3 }, { p: 5 }, { p: 8 }, { p: 10, free: 5 }], {
    t: function (o) { return '施放的魔法 MP 消耗 −' + o.p + '%' + (o.free ? '；每 5 個魔法有 1 個不耗 MP' : ''); },
    mpCost: function (a, o) { var s = S(a, 'bmp'); s.n = N(s.n) + 1; if (o.free && s.n % o.free === 0) return 100; return o.p; }
  });
  def('relic_shapeshifter_underwear', [{ p: 5 }, { p: 8 }, { p: 12 }, { p: 15, swap: 1 }], {
    t: function (o) { return '變身中造成的傷害 +' + o.p + '%、受到的傷害 −' + o.p + '%' + (o.swap ? '；變身中每 30 秒回 HP 10%' : ''); },
    poly: function (a) { return !!(a && (a.poly || a.morph || a.polyId || (a.buffs && Object.keys(a.buffs).some(function (k) { return /^poly|morph/.test(k) && a.buffs[k] > 0; })))); },
    dmg: function (a, o) { return M.relic_shapeshifter_underwear.poly(a) ? o.p : 0; }, cut: function (a, o) { return M.relic_shapeshifter_underwear.poly(a) ? o.p : 0; },
    tick: function (a, o) { if (o.swap && M.relic_shapeshifter_underwear.poly(a) && cd(S(a, 'shape'), 'h', 30)) heal(a, mhpOf(a) * 0.1); }
  });
  def('relic_charm_heart', [{ c: 1, d: 3 }, { c: 2, d: 3 }, { c: 3, d: 5 }, { c: 3, d: 5, h: 3 }], {
    t: function (o) { return '命中時 ' + o.c + '% 讓一般怪幫你打 ' + o.d + ' 秒' + (o.h ? '；被魅惑的怪倒下時全隊回 HP 3%' : ''); },
    hit: function (a, o, c) { if (c.tgt.boss || !roll(o.c)) return; var m = mk(c.tgt); m.charm = tk() + o.d * 10; m.charmA = a; stat(c.tgt, 'confuse', o.d); },
    tick: function (a, o) { if (tk() % 10) return; mobs().forEach(function (m) { var k = MK_.get(m); if (k && k.charmA === a && (k.charm || 0) > tk()) { var nx = nearest(m); if (nx) hit(nx, N(m.lv) * 5); } }); },
    kill: function (a, o, c) { var k = MK_.get(c.m); if (o.h && k && k.charmA === a && (k.charm || 0) > tk()) party().forEach(function (x) { heal(x, mhpOf(x) * 0.03); }); }
  });
  def('relic_lycan_swiftlegs', [{ p: 10 }, { p: 20 }, { p: 30 }, { p: 30, exp: 1 }], {
    t: function (o) { return '換地圖後第一場戰鬥 5 秒內傷害 +' + o.p + '%' + (o.exp ? '，這段時間打倒的怪多給一次經驗' : ''); },
    tick: function (a, o, c) { var s = S(a, 'lyc'), mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; s.done = 0; } if (c.fight && !s.done) { s.done = 1; s.until = tk() + 50; } },
    dmg: function (a, o) { return (S(a, 'lyc').until || 0) > tk() ? o.p : 0; },
    kill: function (a, o, c) { if (o.exp && isPlayer(a) && (S(a, 'lyc').until || 0) > tk()) { try { gainExp(N(c.m.exp)); } catch (e) {} } }
  });
  def('relic_redscorpion_ring', [{ c: 5, p: 10 }, { c: 8, p: 10 }, { c: 12, p: 10 }, { c: 15, p: 10, back: 10 }], {
    t: function (o) { return '被近戰攻擊時 ' + o.c + '% 讓攻擊者中毒（每秒你傷害的 10%，5 秒）' + (o.back ? '；中毒的怪打你時回你那一下 10% HP' : ''); },
    taken: function (a, o, c) { if (!c.mob) return c.dmg; if (o.back && dotLayers(c.mob, 'scorp', a)) heal(a, c.dmg * 0.1); if (c.kind === 'phys' && !c.mob.ranged && roll(o.c)) dot(c.mob, a, 'scorp', panel(a) * o.p / 100, 5, 1); return c.dmg; }
  });
  def('relic_griffin_feather', [{ c: 20, p: 60 }, { c: 30, p: 60 }, { c: 40, p: 80 }, { c: 50, p: 100, crit: 1 }], {
    t: function (o) { return '迴避後 ' + o.c + '% 反擊（你傷害的 ' + o.p + '%）' + (o.crit ? '，反擊傷害 ×1.5' : ''); },
    evade: function (a, o, c) { if (!c.mob || !roll(o.c)) return; hit(c.mob, panel(a) * o.p / 100 * (o.crit ? 1.5 : 1)); }
  });
  def('relic_rabbit_foot', [{ c: 5 }, { c: 10 }, { c: 15 }, { c: 25, drop: 1 }], {
    t: function (o) { return '受到致命傷時 ' + o.c + '% 免死（冷卻 60 秒）' + (o.drop ? '；免死後 5 秒內打倒的怪多判定一次掉寶' : ''); },
    death: function (a, o) { var s = S(a, 'rab'); if (!roll(o.c) || !cd(s, 'u', 60)) return false; a.hp = 1; if (o.drop) s.until = tk() + 50; pop('rab', '幸運！'); return true; }
  });
  def('relic_sr_akaoni_pants', [{ t: 40, p: 5 }, { t: 30, p: 8 }, { t: 20, p: 10 }, { t: 20, p: 10, ls: 5 }], {
    t: function (o) { return '每 ' + o.t + ' 秒號令：全隊 5 秒傷害 +' + o.p + '%' + (o.ls ? '，期間打中回 HP（傷害的 5%）' : ''); },
    tick: function (a, o, c) { if (c.fight && cd(S(a, 'aka'), 'c', o.t)) { S(a, 'aka').until = tk() + 50; pop('aka', '鬼神號令'); } },
    team: function (a, o) { return (S(a, 'aka').until || 0) > tk() ? o.p : 0; },
    teamHit: function (a, o, who, c) { if (o.ls && (S(a, 'aka').until || 0) > tk()) heal(who, c.v * o.ls / 100); }
  });
  // 幼龍的爪印、長首妖怪的圍巾 → 種族獵手（龍系、妖怪系）
  var HUNTER_ITEM = { relic_drake_pawprint: '龍', relic_sr_neck_scarf: '妖怪' };
  // 補齊 3 件
  def('relic_boss_recruit', [{ p: 1, k: 5 }, { p: 1, k: 10 }, { p: 1, k: 15 }, { p: 1, k: 20, keep: 1 }], {
    t: function (o) { return '隊伍打倒的怪都算進你的連殺；每 50 連殺全隊傷害 +1%（最多 ' + o.k + '%）' + (o.keep ? '；換地圖不歸零（倒下才歸零）' : ''); },
    kill: function (a, o) { var s = S(a, 'rec'); s.n = N(s.n) + 1; },
    tick: function (a, o) { var s = S(a, 'rec'), mp = String(mapState.current || ''); if (isPlayer(a) && a.dead) s.n = 0; if (s.map !== mp) { s.map = mp; if (!o.keep) s.n = 0; } },
    team: function (a, o) { return Math.min(o.k, Math.floor(N(S(a, 'rec').n) / 50)); }
  });
  def('relic_boss_gate', [{ p: 25 }, { p: 25 }, { p: 35 }, { p: 40, x: 15 }], {
    t: function (o) { return '頭目施放魔法時自動舉盾，全隊受到那一下 −' + o.p + '%（冷卻 30 秒）' + (o.x ? '；舉盾成功時頭目 3 秒受到傷害 +15%' : ''); },
    teamTaken: function (a, o, who, c) { if (!c.mob || !c.mob.boss || c.kind !== 'magic') return c.dmg; var s = S(a, 'gate2'); if ((s.until || 0) <= tk()) { if (!cd(s, 'u', 30)) return c.dmg; s.until = tk() + 5; if (o.x) vuln(c.mob, 'gate2', o.x, 3); pop('gate2', '舉盾'); } return c.dmg * (1 - o.p / 100); }
  });
  def('relic_fill_b27', [{ p: 50 }, { p: 50 }, { p: 70 }, { p: 100, boss: 1 }], {
    t: function (o) { return '格擋後下一拳把目標打飛（延後 2 秒），撞到旁邊的怪造成 ' + o.p + '%' + (o.boss ? '；頭目也會被打斷（冷卻 20 秒）' : ''); },
    block: function (a, o) { S(a, 'fist').ready = 1; },
    hit: function (a, o, c) { var s = S(a, 'fist'); if (!s.ready || c.kind === 'magic') return; s.ready = 0; var m = c.tgt; if (!m.boss || (o.boss && cd(s, 'b', 20))) m._atkCd = N(m._atkCd) + 20; var nx = nearest(m); if (nx) hit(nx, c.v * o.p / 100); }
  });
  // 本體（+0）就有效果的（只限本次新增，避免舊遺物 +0 改變）：無

  // ════════ 二、回響遺物 ════════
  var EFAM = { fireball: 'spell', flame: 'spell', thunder: 'spell', earthquake: 'spell', vampire: 'spell', firestorm: 'spell', collapse: 'spell', stun: 'status', freeze: 'status', slow: 'status', silence: 'status', stone: 'status', broken: 'status', disease: 'status', poison: 'poison', mend: 'mend', spines: 'spines', bastion: 'spines', mirror: 'mirror', purify: 'purify', coldguard: 'purify', rebirth: 'purify', spirit: 'spirit', stormguard: 'spirit', flameguard: 'guard', emberguard: 'guard' };
  var ST_OF = { stun: 'stun', freeze: 'freeze', slow: 'slow', silence: 'silence', stone: 'stone', broken: 'attackSlow', disease: 'healReduction' };
  var ECHO = {
    spell: { v: [{ e: 30 }, { e: 40, trace: 1 }, { e: 40, trace: 1, up: 6 }, { e: 40, trace: 1, up: 6, lord: 60 }],
      t: function (o, d) { return '原本的攻擊施法觸發後 1 秒再響一次（' + o.e + '% 傷害）' + (o.trace ? '；留下 3 秒屬性痕跡（灼燒／感電／裂地／血霧）' : '') + (o.up ? '；每觸發 ' + o.up + ' 次改放一次強力版（打全體）' : '') + (o.lord ? '；每 ' + o.lord + ' 秒原主的幻影現身，對全體施放一次（你傷害的 300%）' : ''); },
      hit: function (a, o, c, d) { var rate = (d.procSkill2 && d.procSkill2.rate) || 5; if (!roll(rate)) return; var m = c.tgt, v = c.v, s = S(a, 'ec_' + d._b); later(function () { hit(m, v * o.e / 100); }, 1000); if (o.trace) { var k = d.relicEffectKey; if (/fire|flame|firestorm/.test(k)) dot(m, a, 'trace', v * 0.2, 3, 1); else if (k === 'thunder') vuln(m, 'tr_' + d._b, 20, 3); else if (/earth|collapse/.test(k)) { try { RA().status(m, 'attackSlow', 3, 0.2); } catch (e) {} } else heal(a, v * 0.1); } if (o.up) { s.n = N(s.n) + 1; if (s.n >= o.up) { s.n = 0; mobs().forEach(function (x) { later(function () { hit(x, v); }); }); pop('ecup', '強力施法'); } } if (o.lord && cd(s, 'lord', o.lord)) { var pv = panel(a) * 3; mobs().forEach(function (x) { hit(x, pv); }); pop('eclord', (DB.mobs[d.relicSourceId] || {}).n || '原主'); } } },
    status: { v: [{ p: 8 }, { p: 12, sp: 25 }, { p: 12, sp: 35, ex: 3 }, { p: 12, sp: 35, ex: 4, boss: 1 }],
      t: function (o) { return '原本的異常觸發時，目標 6 秒受到你的傷害 +' + o.p + '%' + (o.sp ? '；' + o.sp + '% 同時傳給旁邊 1 隻' : '') + (o.ex ? '；打中這個目標時 10% 追加它最大 HP ' + o.ex + '%（頭目 0.3%）' : '') + (o.boss ? '；頭目也會被短暫打斷（同一頭目 10 秒一次）' : ''); },
      hit: function (a, o, c, d) { var rate = (d.procStatusSkill && d.procStatusSkill.rate) || 3, m = c.tgt, k = ST_OF[d.relicEffectKey] || 'slow', mm = mk(m); if (roll(rate)) { vuln(m, 'es_' + d._b, o.p, 6); mm.esA = a; mm.esU = tk() + 60; if (o.sp && roll(o.sp)) { var nx = nearest(m); if (nx) stat(nx, k, 2); } if (o.boss && m.boss) bossDelay(m); } if (o.ex && mm.esA === a && (mm.esU || 0) > tk() && roll(10)) { var v = N(m.hp) * (m.boss ? 0.003 : o.ex / 100); later(function () { hit(m, v); }); } } },
    poison: { v: [{ k: 2 }, { k: 3, fog: 1 }, { k: 3, fog: 1, cor: 50 }, { k: 3, fog: 1, cor: 50, boom: 1.5 }],
      t: function (o) { return '中毒可疊 ' + o.k + ' 層（每層每秒你傷害的 4%）' + (o.fog ? '；中毒的怪倒下時炸出毒霧' : '') + (o.cor ? '；中毒的怪受到的治療 −50%、AC +10' : '') + (o.boom ? '；疊滿時引爆剩下的毒傷 ×1.5' : ''); },
      hit: function (a, o, c, d) { var rate = (d.procPoison && d.procPoison.rate) || 10; if (!roll(rate)) return; var m = c.tgt, n = dot(m, a, 'ep_' + d._b, panel(a) * 0.04, 8, o.k); if (o.cor) { try { RA().status(m, 'healReduction', 8, 0.5); } catch (e) {} acShred(m, 10, 10); } if (o.boom && n >= o.k) { var left = dotLeft(m, 'ep_' + d._b, a); clearDots(m, 'ep_' + d._b, a); hit(m, left * o.boom); } },
      kill: function (a, o, c, d) { if (o.fog && dotLayers(c.m, 'ep_' + d._b, a)) mobs().forEach(function (m) { dot(m, a, 'ep_' + d._b, panel(a) * 0.04, 8, o.k); }); } },
    mend: { v: [{ sh: 10 }, { sh: 10, cl: 1 }, { sh: 10, cl: 1, sh2: 1 }, { sh: 15, cl: 1, sh2: 1, last: 1 }],
      t: function (o) { return '原本的受傷回血觸發時，多一層護盾（最大 HP ' + o.sh + '%）' + (o.cl ? '並解除一個異常' : '') + (o.sh2 ? '；HP 最低的隊友回最大 HP 5%' : '') + (o.last ? '；HP 低於 20% 時必定觸發並 2 秒不受傷害（冷卻 90 秒）' : ''); },
      taken: function (a, o, c, d) { var s = S(a, 'em_' + d._b), cdS = N(d.onDmgHealCd) || 5, low = o.last && hpOf(a) - c.dmg < mhpOf(a) * 0.2; if (low && cd(s, 'last', 90)) { s.inv = tk() + 20; pop('emlast', '最後一口氣'); } if ((s.inv || 0) > tk()) return 0; if (!cd(s, 'u', cdS)) return c.dmg; shield(a, mhpOf(a) * o.sh / 100, o.sh); if (o.cl) cleanse(a, 1); if (o.sh2) { var l = lowest(); if (l) heal(l, mhpOf(l) * 0.05); } return c.dmg; } },
    spines: { v: [{ k: 10, p: 50 }, { k: 10, p: 50, back: 2 }, { k: 10, p: 50, back: 2, net: 1 }, { k: 10, p: 50, back: 2, net: 1, wall: 1 }],
      t: function (o) { return '被打一下累積 1 層怒刺（最多 ' + o.k + '），滿層下一擊追加累積受傷量的 ' + o.p + '%' + (o.back ? '；同時被 3 隻以上的怪圍住時受到的傷害 −15%' : '') + (o.net ? '；反傷打所有攻擊你的怪' : '') + (o.wall ? '；受到致命傷時保住 1 HP 並把那一下全部反彈（每張地圖一次）' : ''); },
      taken: function (a, o, c, d) { var s = S(a, 'esp_' + d._b); s.n = Math.min(o.k, N(s.n) + 1); s.acc = N(s.acc) + c.dmg; var dmg = c.dmg; if (o.back && mobs().length >= 3) dmg *= 0.85; if (o.net && c.mob && d.thorns) mobs().forEach(function (m) { if (m !== c.mob) hit(m, c.dmg * N(d.thorns) / 100); }); if (o.wall && dmg >= hpOf(a)) { var mp = String(mapState.current || ''); if (s.map !== mp) { s.map = mp; if (c.mob) hit(c.mob, c.dmg); return Math.max(0, hpOf(a) - 1); } } return dmg; },
      hit: function (a, o, c, d) { var s = S(a, 'esp_' + d._b); if (N(s.n) >= o.k) { var v = N(s.acc) * o.p / 100; s.n = 0; s.acc = 0; later(function () { hit(c.tgt, v); }); } } },
    mirror: { v: [{ mg: 1 }, { mg: 1, half: 1 }, { mg: 1, half: 1, clone: 8 }, { mg: 1, half: 1, clone: 8, perf: 30 }],
      t: function (o) { return '魔法傷害也能反彈' + (o.half ? '；反彈的傷害再分一半打另一隻' : '') + (o.clone ? '；反彈時 8% 召喚鏡中分身 6 秒（每秒打你傷害的 40%）' : '') + (o.perf ? '；每 30 秒第一次受到的魔法傷害完全反彈、自己不受傷' : ''); },
      taken: function (a, o, c, d) { if (c.kind !== 'magic' || !c.mob) return c.dmg; var s = S(a, 'emi_' + d._b), rv = c.dmg * N(d.dmgReflect) / 100, perf = o.perf && cd(s, 'pf', o.perf); if (perf) rv = c.dmg; hit(c.mob, rv); if (o.half) { var nx = nearest(c.mob); if (nx) hit(nx, rv / 2); } if (o.clone && roll(o.clone)) s.clone = tk() + 60; return perf ? 0 : c.dmg; },
      tick: function (a, o, c, d) { var s = S(a, 'emi_' + d._b); if ((s.clone || 0) > tk() && tk() % 10 === 0) { var tg = target(); if (tg) hit(tg, panel(a) * 0.4); } } },
    purify: { v: [{ im: 3 }, { im: 3, tr: 30 }, { im: 3, tr: 30, ally: 1 }, { im: 3, tr: 30, ally: 1, cap: 1 }],
      t: function (o, d) { var k = d.relicEffectKey; return '原本的異常回血觸發時，3 秒內不再中同一種異常' + (o.tr ? '；' + o.tr + '% 把異常轉給攻擊你的怪' : '') + (o.ally ? '；同時解除一名隊友的異常' : '') + (o.cap ? (k === 'rebirth' ? '；倒下時 5 秒後站起來（HP 30%，每張地圖一次）' : k === 'coldguard' ? '；解除時凍住目標 1 秒' : '；每解除一次全隊 10 秒傷害 +5%（最多 5 層）') : ''); },
      tick: function (a, o, c, d) { if (tk() % 3) return; var st0 = a.statuses || a.st; if (!st0) return; var got = ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'poison', 'slow', 'silence', 'magicseal'].filter(function (k) { return st0[k] > 0; }); if (!got.length) return; var s = S(a, 'epu_' + d._b); if (!cd(s, 'u', 3)) return; got.forEach(function (k) { st0[k] = 0; s['im_' + k] = tk() + o.im * 10; }); var tg = target(); if (o.tr && tg && roll(o.tr)) stat(tg, got[0] === 'magicseal' ? 'silence' : got[0], 2); if (o.ally) { var al = (P().allies || []).find(function (x) { return x && !x._downed && x.st && ['stun', 'freeze', 'stone', 'paralyze'].some(function (k) { return x.st[k] > 0; }); }); if (al) cleanse(al, 3); } if (o.cap) { var key = d.relicEffectKey; if (key === 'coldguard' && tg) stat(tg, 'freeze', 1); if (key === 'purify') { s.pn = Math.min(5, ((s.pu || 0) > tk() ? N(s.pn) : 0) + 1); s.pu = tk() + 100; } } },
      resist: function (a, o, k, d) { var s = S(a, 'epu_' + d._b); return (s['im_' + k] || 0) > tk(); },
      team: function (a, o, c, d) { var s = S(a, 'epu_' + d._b); return o.cap && d.relicEffectKey === 'purify' && (s.pu || 0) > tk() ? 5 * N(s.pn) : 0; },
      death: function (a, o, d) { if (!o.cap || d.relicEffectKey !== 'rebirth') return false; var s = S(a, 'epu_' + d._b), mp = String(mapState.current || ''); if (s.map === mp) return false; s.map = mp; a.hp = 1; s.rise = tk() + 50; pop('reb', '重生之息'); return true; },
      taken2: function (a, o, c, d) { var s = S(a, 'epu_' + d._b); if ((s.rise || 0) > tk()) return 0; if (s.rise && s.rise <= tk()) { s.rise = 0; a.hp = Math.floor(mhpOf(a) * 0.3); } return c.dmg; } },
    spirit: { v: [{ ov: 3 }, { ov: 3, gale: 1 }, { ov: 3, gale: 1, share: 1 }, { ov: 3, gale: 1, share: 1, tide: 20 }],
      t: function (o, d) { return 'MP 滿的時候每秒累積下一次魔法傷害 +' + o.ov + '%（最多 30%）' + (o.gale ? (d.relicEffectKey === 'stormguard' ? '；被打時 10% 得到風之疾走（5 秒傷害 +15%）' : '；你的持續傷害每跳 5% 延長 1 秒') : '') + (o.share ? '；每 10 秒分給 MP 最低的隊友 5% MP' : '') + (o.tide ? '；每 20 秒回 MP 15%' : ''); },
      tick: function (a, o, c, d) { var s = S(a, 'esi_' + d._b), t = tk(); if (t % 10 === 0 && N(a.mmp) > 0 && mpOf(a) >= N(a.mmp)) s.ov = Math.min(30, N(s.ov) + o.ov); if (o.share && t % 100 === 0) { var l = party().filter(function (x) { return x !== a && N(x.mmp) > 0; }).sort(function (x, y) { return mpOf(x) / N(x.mmp) - mpOf(y) / N(y.mmp); })[0]; if (l) setMp(l, mpOf(l) + N(l.mmp) * 0.05); } if (o.tide && cd(s, 'tide', o.tide)) setMp(a, mpOf(a) + N(a.mmp) * 0.15); },
      dmg: function (a, o, c, d) { var s = S(a, 'esi_' + d._b), add = 0; if (c.kind === 'magic' && N(s.ov) > 0) { add += s.ov; s.ov = 0; } if ((s.gu || 0) > tk()) add += 15; return add; },
      taken: function (a, o, c, d) { if (o.gale && d.relicEffectKey === 'stormguard' && roll(10)) S(a, 'esi_' + d._b).gu = tk() + 50; return c.dmg; } },
    guard: { v: [{ eat: 15 }, { eat: 20, back: 15 }, { eat: 25, back: 20, fuel: 1 }, { eat: 30, back: 25, fuel: 1, avatar: 1 }],
      t: function (o, d) { var e = d._ge || 'fire', w = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' }[e]; return '受到' + w + '屬性攻擊時，那一下 ' + o.eat + '% 轉成 HP' + (o.back ? '；' + o.back + '% 回敬攻擊者（燃燒／濕身／吹開／緩速／沉默）' : '') + (o.fuel ? '；每擋一次你的攻擊 +3%（最多 10 層，15 秒）' : '') + (o.avatar ? '；全隊受到的' + w + '屬性傷害 −30%' : ''); },
      taken: function (a, o, c, d) { var e = d._ge || 'fire'; if (eleOfMob(c.mob) !== e && !(c.kind === 'magic' && W.__afkTakenEle === e)) return c.dmg; var s = S(a, 'eg_' + d._b); heal(a, c.dmg * o.eat / 100); if (o.back && c.mob && roll(o.back)) { if (e === 'fire') dot(c.mob, a, 'egb', panel(a) * 0.1, 5, 1); else if (e === 'water') wet(c.mob, 5); else if (e === 'wind') c.mob._atkCd = N(c.mob._atkCd) + 10; else if (e === 'earth') { try { RA().status(c.mob, 'attackSlow', 3, 0.3); } catch (x) {} } else stat(c.mob, 'silence', 1); } if (o.fuel) { s.n = Math.min(10, ((s.u || 0) > tk() ? N(s.n) : 0) + 1); s.u = tk() + 150; } return c.dmg * (1 - o.eat / 100); },
      dmg: function (a, o, c, d) { var s = S(a, 'eg_' + d._b); return o.fuel && (s.u || 0) > tk() ? 3 * N(s.n) : 0; },
      teamTaken: function (a, o, who, c, d) { var e = d._ge || 'fire'; return o.avatar && eleOfMob(c.mob) === e ? c.dmg * 0.7 : c.dmg; } }
  };
  // 原主之仇（本體起）＋種族獵手剋星（階段越高越強）
  var HUNT = {
    '人形': { t: function (s) { return '繳械：命中 ' + [2, 3, 5, 8, 10][s] + '% 讓牠 5 秒傷害 −30%'; }, hit: function (a, s, m) { if (roll([2, 3, 5, 8, 10][s])) { try { RA().status(m, 'directDamageDown', 5, 0.3); } catch (e) {} } } },
    '不死': { t: function (s) { return '淨化：被你打中後 ' + [2, 3, 5, 8, 10][s] + ' 秒受到的治療 −100%'; }, hit: function (a, s, m) { try { RA().status(m, 'healReduction', [2, 3, 5, 8, 10][s], 1); } catch (e) {} } },
    '惡魔': { t: function (s) { return '封印：命中 ' + [2, 3, 5, 8, 10][s] + '% 打斷牠的魔法'; }, hit: function (a, s, m) { if (roll([2, 3, 5, 8, 10][s])) stat(m, 'silence', 2); } },
    '元素': { t: function (s) { return '瓦解：命中 ' + [3, 5, 8, 12, 15][s] + '% 讓牠 5 秒受到的傷害 +20%'; }, hit: function (a, s, m) { if (roll([3, 5, 8, 12, 15][s])) vuln(m, 'hunt_ele', 20, 5); } },
    '野獸': { t: function (s) { return '馴服：一般怪 HP 低於 20% 時 ' + [1, 1, 2, 3, 5][s] + '% 被你馴服（直接倒下）'; }, hit: function (a, s, m) { if (!m.boss && N(m.curHp) < N(m.hp) * 0.2 && roll([1, 1, 2, 3, 5][s])) later(function () { if (alive(m)) hit(m, N(m.curHp)); }); } },
    '龍': { t: function (s) { return '屠龍：對龍系頭目傷害再 +' + [2, 3, 5, 8, 10][s] + '%'; }, dmg: function (a, s, m) { return m.boss ? [2, 3, 5, 8, 10][s] : 0; } },
    '蟲蛛': { t: function (s) { return '殺蟲：你對牠的持續傷害 ×' + [1.1, 1.2, 1.4, 1.6, 2][s]; }, dotX: function (a, s) { return [1.1, 1.2, 1.4, 1.6, 2][s]; } },
    '魔造': { t: function (s) { return '拆解：打牠時傷害再 +' + [3, 5, 8, 12, 15][s] + '%（無視硬皮）'; }, dmg: function (a, s, m) { return [3, 5, 8, 12, 15][s]; } },
    '巨人': { t: function (s) { return '撼動：依牠的體型傷害最多 +' + [5, 5, 10, 15, 20][s] + '%'; }, dmg: function (a, s, m) { return Math.min([5, 5, 10, 15, 20][s], N(m.hp) / 2000); } },
    '妖怪': { t: function (s) { return '除妖：不會被牠混亂、魅惑；對牠傷害再 +' + [2, 3, 5, 8, 10][s] + '%'; }, dmg: function (a, s) { return [2, 3, 5, 8, 10][s]; } },
    '異域': { t: function (s) { return '解咒：牠造成的傷害 −' + [5, 10, 15, 20, 25][s] + '%'; }, cut: function (a, s) { return [5, 10, 15, 20, 25][s]; } },
    '妖魔': { t: function (s) { return '威壓：一般怪 HP 低於 25% 時 ' + [3, 5, 10, 20, 30][s] + '% 嚇跑（直接倒下）'; }, hit: function (a, s, m) { if (!m.boss && N(m.curHp) < N(m.hp) * 0.25 && roll([3, 5, 10, 20, 30][s])) later(function () { if (alive(m)) hit(m, N(m.curHp)); }); } }
  };
  // 五屬性系列：role × ele，idx 0＝+10、1＝昇華 +5
  var ELEX = {
    atk: { fire: function (a, o, c) { if (roll(o[0])) dot(c.tgt, a, 'xburn', c.v * o[1] / 100, 5, 1); }, water: function (a, o, c) { if (roll(o[0])) wet(c.tgt, 5); }, wind: function (a, o, c) { if (roll(o[0])) { var v = c.v * o[1] / 100; later(function () { hit(c.tgt, v); }); } }, earth: function (a, o, c) { if (roll(o[0])) acShred(c.tgt, o[1], o[1]); }, none: function (a, o, c) { if (roll(o[0])) { var v = c.v * o[1] / 100; later(function () { hit(c.tgt, v); }); } } },
    atkV: { fire: [[8, 10], [15, 15]], water: [[8, 15], [15, 25]], wind: [[8, 40], [15, 60]], earth: [[8, 5], [15, 10]], none: [[8, 30], [15, 50]] },
    grdV: { fire: [[10], [20]], water: [[3], [6]], wind: [[10], [20]], earth: [[20, 8], [12, 15]], none: [[10], [20]] },
    auraV: { fire: [3, 6], water: [1, 2], wind: [3, 6], earth: [3, 6], none: [5, 10] },
    petV: { fire: [15, 30], water: [2, 4], wind: [15, 30], earth: [15, 30], none: [10, 20] },
    sumV: { fire: [30, 60], water: [1, 2], wind: [30, 30], earth: [20, 40], none: [10, 20] },
    healV: { fire: [10, 20], water: [5, 10], wind: [10, 20], earth: [5, 10], none: [10, 20] }
  };
  var EW = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' };
  var eleText = function (role, e, i) {
    var v;
    if (role === 'atk') { v = ELEX.atkV[e][i]; return { fire: '命中 ' + v[0] + '% 燃燒 5 秒（每秒 ' + v[1] + '%）', water: '命中 ' + v[0] + '% 濕身 5 秒', wind: '命中 ' + v[0] + '% 追加風刃（' + v[1] + '%）', earth: '命中 ' + v[0] + '% 讓目標 AC +' + v[1], none: '命中 ' + v[0] + '% 追加虛擊（' + v[1] + '%）' }[e]; }
    if (role === 'grd') { v = ELEX.grdV[e][i]; return { fire: '被近戰打到 ' + v[0] + '% 讓攻擊者燃燒', water: '受到傷害的 ' + v[0] + '% 轉成治療', wind: v[0] + '% 完全閃開一下', earth: '每 ' + v[0] + ' 秒得到最大 HP ' + v[1] + '% 的護盾', none: '受到的屬性傷害 −' + v[0] + '%' }[e]; }
    if (role === 'aura') { v = ELEX.auraV[e][i]; return { fire: '全隊傷害 +' + v + '%', water: '全隊每 5 秒回 HP ' + v + '%', wind: '全隊傷害 +' + v + '%（順風）', earth: '全隊受到的傷害 −' + v + '%', none: '全體敵人魔法傷害 −' + v + '%' }[e]; }
    if (role === 'pet') { v = ELEX.petV[e][i]; return { fire: '寵物傷害 +' + v + '%（附加火焰）', water: '寵物造成傷害的 ' + (v / 2) + '% 回你 MP', wind: '寵物傷害 +' + v + '%（風狼）', earth: '寵物替你擋下 ' + (v / 3) + '% 傷害', none: '寵物傷害 +' + v + '%（影獸）' }[e]; }
    if (role === 'sum') { v = ELEX.sumV[e][i]; return { fire: '召喚物消失時爆炸（它最大 HP ' + v + '%）', water: '召喚物在場時每 5 秒回 MP ' + v + '%', wind: '召喚物傷害 +' + v + '%（旋風）', earth: '召喚物在場時你受到的傷害 −' + (v / 4) + '%', none: '召喚物傷害 +' + v + '%（虛影）' }[e]; }
    v = ELEX.healV[e][i]; return { fire: '你治療時 ' + v + '% 同時燒周圍敵人', water: '你的治療量 +' + v + '%', wind: '你的治療 ' + v + '% 跳到第二個隊友', earth: '被你治療的人 5 秒受到的傷害 −' + v + '%', none: '你的治療 ' + v + '% 同時給 3 秒不中異常' }[e];
  };
  var ACCI = null;
  var accIdx = function (b) { if (!ACCI) { ACCI = {}; try { (W.__afkEchoRelic.KEYS || []).filter(function (k) { return DB.items[k] && DB.items[k].type === 'acc'; }).forEach(function (k, i) { ACCI[k] = i; }); } catch (e) {} } return N(ACCI[b]); };
  var ROLE_OF = function (d, idx) { if (d.type === 'wpn') return (d.relicEffectKey === 'vampire' || d.relicEffectKey === 'mend') ? 'heal' : 'atk'; if (d.type === 'arm') return (d.relicEffectKey === 'purify' || d.relicEffectKey === 'rebirth') ? 'heal' : 'grd'; return ['aura', 'pet', 'sum'][idx % 3]; };

  // ════════ 三、種族獵手詞綴、同系共鳴 ════════
  var hashS = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  var hunterAffix = function (base, fx) { if (!fx) return null; var h = hashS(base + '|' + fx); return h % 5 === 0 ? FAMS[Math.floor(h / 5) % FAMS.length] : null; };

  // ════════ 四、原作者設計表 26 件：昇華支配 +5 的新行為 ════════
  var CAT = {};
  var cat = function (name, h) { CAT[name] = h; };
  cat('來自陰影的刺劍', { t: '打倒帶流血的怪時，牠身上你造成的流血轉到另一隻怪', kill: function (a, c) { try { var r = RA(); var nx = nearest(c.m); if (r && nx && r.dotLayers(c.m, 'bleed') > 0) r.transferDots(c.m, nx, { owner: a, kinds: ['bleed'] }); } catch (e) {} } });
  cat('刺針', { t: '蛛絲：同一目標每次命中 +1 層（最多 10），每層受到你的傷害 +4%', dmg: function (a, c) { var s = S(a, 'cat_sp'); if (s.t === c.tgt) s.n = Math.min(10, N(s.n) + 1); else { s.t = c.tgt; s.n = 0; } return 4 * s.n; } });
  cat('殺人蜂的尾刺', { t: '近戰命中時 30% 立刻再次加速', hit: function (a, c) { if (c.kind === 'melee' && roll(30)) { try { if (a.buffs) a.buffs.sk_haste = Math.max(N(a.buffs.sk_haste), 30); } catch (e) {} } } });
  cat('艾庫卡伊拉的毒牙', { asc: 1, t: '又中毒又出血的目標，你對牠傷害 +30%；中毒的怪倒下時毒傳給周圍 2 隻', dmg: function (a, c) { try { var r = RA(); return r && r.hasStatus(c.tgt, 'poison') && r.hasStatus(c.tgt, 'bleed') ? 30 : 0; } catch (e) { return 0; } }, kill: function (a, c, s) { if (s < 4) return; try { var r = RA(); if (r && r.hasStatus(c.m, 'poison')) others(c.m, 2).forEach(function (m) { r.status(m, 'poison', 8, 1); }); } catch (e) {} } });
  cat('變種蛇女的詭異鱗片', { t: '麻痺中的怪受到全隊傷害 +15%', hit: function (a, c) { if (c.tgt.st && c.tgt.st.paralyze > 0) vuln(c.tgt, 'cat_snake', 15, 2); } });
  cat('鯊魚的千刃牙', { t: '水屬性攻擊讓目標濕身（受到的魔法傷害 +25%），對濕身的目標傷害 +30%', hit: function (a, c) { wet(c.tgt, 5); }, dmg: function (a, c) { return isWet(c.tgt) ? (c.kind === 'magic' ? 25 : 0) + 30 : 0; } });
  cat('兇殘惡鬼的毒牙', { t: '受到近戰攻擊時反擊全體敵人（每隻你傷害的 50%，冷卻 3 秒）', taken: function (a, c) { if (c.kind === 'phys' && cd(S(a, 'cat_gh'), 'c', 3)) { var v = panel(a) * 0.5; mobs().forEach(function (m) { hit(m, v); }); } return c.dmg; } });
  cat('大地碎裂劍', { t: '命中時 15% 讓目標石化 1 秒（頭目改成短暫硬直）', hit: function (a, c) { if (roll(15)) stat(c.tgt, 'stone', 1); } });
  cat('灰燼戰士的火焰長劍', { t: '每 10 次命中，下一擊追加一次烈炎（你傷害的 200%）', hit: function (a, c) { var s = S(a, 'cat_ash'); s.n = N(s.n) + 1; if (s.n >= 10) { s.n = 0; var v = c.v * 2; later(function () { hit(c.tgt, v); }); } } });
  cat('復仇者的十字弩弓', { t: '身上有出血也有中毒的目標，你對牠傷害 +25%', dmg: function (a, c) { try { var r = RA(); return r && r.hasStatus(c.tgt, 'poison') && r.hasStatus(c.tgt, 'bleed') ? 25 : 0; } catch (e) { return 0; } } });
  cat('冰原十字鎬', { t: '打中冰凍中的怪會碎裂：牠最大 HP 3%（頭目 0.3%）', hit: function (a, c) { if (c.tgt.st && c.tgt.st.freeze > 0 && cd(S(a, 'cat_ice'), 'c', 1)) { var v = N(c.tgt.hp) * (c.tgt.boss ? 0.003 : 0.03); later(function () { hit(c.tgt, v); }); } } });
  cat('強韌的大腿骨', { t: '擋下致死攻擊後 5 秒，對不死系傷害 ×2', death: function (a) { S(a, 'cat_bone').until = tk() + 50; return false; }, dmg: function (a, c) { return (S(a, 'cat_bone').until || 0) > tk() && famOf(c.tgt) === '不死' ? 100 : 0; } });
  cat('業火鍛造鎚', { t: '把硬皮打到 0 的怪熔甲 10 秒：全隊對牠的傷害 +20%', hit: function (a, c) { if (N(c.tgt.hardSkin) <= 0 && c.tgt._hardSkinMax > 0) vuln(c.tgt, 'cat_melt', 20, 10); } });
  cat('牛頭人的流星鎚', { t: '同一隻怪被打 10 次後暈 3 秒（頭目改成短暫硬直）', hit: function (a, c) { var m = mk(c.tgt); m.minot = N(m.minot) + 1; if (m.minot >= 10) { m.minot = 0; stat(c.tgt, 'stun', 3); } } });
  cat('阿茲特獻祭亡靈', { t: '打倒的一般怪化為亡靈替你打 10 秒（最多 3 隻，你傷害的 30%）', kill: function (a, c) { if (c.m.boss) return; var s = S(a, 'cat_azt'); s.l = (s.l || []).filter(function (x) { return x > tk(); }); if (s.l.length < 3) s.l.push(tk() + 100); }, tick: function (a, c) { var s = S(a, 'cat_azt'); var n = (s.l || []).filter(function (x) { return x > tk(); }).length; if (n && c.fight && tk() % 10 === 0) { var tg = target(); if (tg) hit(tg, panel(a) * 0.3 * n); } } });
  cat('傑克的彈弓', { t: '對巨人系與 HP 很高的怪，遠距離傷害 +30%', dmg: function (a, c) { return c.kind === 'ranged' && (famOf(c.tgt) === '巨人' || N(c.tgt.hp) > 50000) ? 30 : 0; } });
  cat('地精靈王的抗拒', { t: '受到攻擊時 10% 讓攻擊者石化 0.5 秒；地精靈王在場時受到的傷害 −15%', taken: function (a, c) { if (c.mob && roll(10)) stat(c.mob, 'stone', 0.5); return c.dmg * (sums().length ? 0.85 : 1); } });
  cat('屍毒之針', { t: '麻痺中的怪，你對牠的遠距離傷害 +40%', dmg: function (a, c) { return c.kind === 'ranged' && c.tgt.st && c.tgt.st.paralyze > 0 ? 40 : 0; } });
  cat('水靈的琴弦', { t: '命中時 20% 讓目標濕身 5 秒；對濕身的目標傷害 +25%', hit: function (a, c) { if (roll(20)) wet(c.tgt, 5); }, dmg: function (a, c) { return isWet(c.tgt) ? 25 : 0; } });
  cat('灼熱蜥蜴長舌', { t: '命中時 10% 把灼燒傳給周圍 2 隻', hit: function (a, c) { if (!roll(10)) return; others(c.tgt, 2).forEach(function (m) { dot(m, a, 'cat_tongue', c.v * 0.2, 5, 1); }); } });
  cat('嗜血騎士的雙刀', { t: '打倒怪物時 10 秒傷害 +10%（可疊 3 層）', kill: function (a) { var s = S(a, 'cat_bk'); s.n = Math.min(3, ((s.u || 0) > tk() ? N(s.n) : 0) + 1); s.u = tk() + 100; }, dmg: function (a) { var s = S(a, 'cat_bk'); return (s.u || 0) > tk() ? 10 * N(s.n) : 0; } });
  cat('長老的雷電能量', { t: '同一目標連續被你的魔法打中 3 次時麻痺 1 秒（頭目改成短暫硬直）', hit: function (a, c) { if (c.kind !== 'magic') return; var s = S(a, 'cat_eld'); if (s.t === c.tgt) s.n = N(s.n) + 1; else { s.t = c.tgt; s.n = 1; } if (s.n >= 3) { s.n = 0; stat(c.tgt, 'paralyze', 1); } } });
  cat('風精靈王的狂嘯', { t: '魔法打中時 10% 讓目標浮空 1 秒（不能攻擊，頭目無效）；對浮空的怪傷害 +50%', hit: function (a, c) { if (c.kind === 'magic' && !c.tgt.boss && roll(10)) { stat(c.tgt, 'stun', 1); mk(c.tgt).air = tk() + 10; } }, dmg: function (a, c) { return (mk(c.tgt).air || 0) > tk() ? 50 : 0; } });
  cat('火之牙的餘燼', { t: '命中時 15% 點燃地面 3 秒（每秒那一下的 30%）', hit: function (a, c) { if (roll(15)) dot(c.tgt, a, 'cat_ember', c.v * 0.3, 3, 1); } });
  cat('風之牙的微風', { t: '打倒怪物時再分裂 2 道風刃（你傷害的 50%）', kill: function (a, c) { var v = panel(a) * 0.5; others(c.m, 2).forEach(function (m) { hit(m, v); }); } });
  cat('蜥蜴領主的王冠', { t: '打倒怪物時全隊寵物 10 秒傷害 +30%', kill: function (a) { S(a, 'cat_liz').u = tk() + 100; }, comp: function (a, c) { return c.src === 'pet' && (S(a, 'cat_liz').u || 0) > tk() ? 30 : 0; } });
  var CATKEY = {};   // key → 名稱
  var catInit = function () { try { (W.AFK_RELIC_CATALOG || []).forEach(function (x) { if (CAT[x.name]) CATKEY[x.key] = x.name; }); } catch (e) {} };

  // ════════ 收集：身上每件 → 效果清單（快取，換裝重算）════════
  var GEN = 0, CACHE = new WeakMap();
  var hookGen = function () { ['calcStats', 'recomputeStats'].forEach(function (fn) { var o = W[fn]; if (typeof o !== 'function' || o.__afkRM) return; var f = function () { return o.apply(this, arguments); };   /* 11-21：不再每次重算屬性就清快取（裝備改由編號比對） */ f.__afkRM = true; W[fn] = f; try { (0, eval)(fn + ' = window.' + fn); } catch (e) {} }); };
  var sigOf = function (a) { var s = []; for (var k in a.eq) { var e = a.eq[k]; s.push(e ? e.id : ''); } if (a === P()) { try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) { if (pt && pt.eq) for (var k2 in pt.eq) { var e2 = pt.eq[k2]; s.push(e2 ? e2.id : ''); } s.push('|'); }); } catch (e) {} } return s; };
  var sameSig = function (x, y) { if (!x || x.length !== y.length) return false; for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; };
  var stageOf = function (it) { var d = it && DB.items[it.id]; if (!d || !d.relic) return null; var base = d.relicBase || it.id, n = N(d.relicPlus), asc = d.relicAsc != null ? d.relicAsc : null; return { d: d, base: base, s: n > 0 || asc != null ? tier(n, asc) : 0, fx: d.relicFx || null }; };
  var collect = function (a) {
    if (!a || !a.eq) return null;
    // 11-21 效能：同一刻直接用快取；換刻時只比對裝備（含出戰寵物）編號，沒變就沿用，不再每刻重掃
    var t0 = tk(), c = CACHE.get(a); if (c && c.t === t0 && c.g === GEN) return c.v;
    var sg = sigOf(a); if (c && c.g === GEN && sameSig(c.sig, sg)) { c.t = t0; return c.v; }
    var L = [], fam = {};
    var add = function (h, o, s, d, slot) { var e = { o: o, s: s, d: d, slot: slot }; if (h && h.v) e.h = h; else if (h) Object.keys(h).forEach(function (k) { e[k] = h[k]; }); L.push(e); };
    var take = function (it, slot) {
      var q = stageOf(it); if (!q) return; var d = q.d, b = q.base, bd = DB.items[b] || d, s = q.s, mul = (TMUL[b] || 1.15) / 1.15;
      if (SRCF[b]) fam[SRCF[b]] = N(fam[SRCF[b]]) + 1;
      if (M[b] && s >= 1) add(M[b], scale(M[b].v[s - 1], mul), s, d, slot);
      if (HUNTER_ITEM[b] && s >= 1) add({ hunt: HUNTER_ITEM[b] }, null, s, d, slot);
      if (bd.relicEcho) {
        var fk = EFAM[bd.relicEffectKey], E = ECHO[fk]; var dd = Object.create(d); dd._b = b; dd.relicEffectKey = bd.relicEffectKey; dd.relicSourceId = bd.relicSourceId; dd._ge = fk === 'guard' ? (eleOfMob(DB.mobs[bd.relicSourceId]) === 'wind' ? (/神官|書/.test(bd.n) ? 'none' : 'wind') : 'fire') : null;
        if (E && s >= 1) add(E, scale(E.v[s - 1], mul), s, dd, slot);
        var sm = DB.mobs[bd.relicSourceId], f0 = famOf(sm);
        if (f0) add({ hunt: f0, grudge: 1 }, null, s, d, slot);
        if (s >= 2) { var e = eleOfMob(sm), role = ROLE_OF(bd, accIdx(b)); add({ ele: e, role: role }, null, s >= 4 ? 1 : 0, d, slot); }
      }
      var hf = s >= 2 ? hunterAffix(b, q.fx) : null; if (hf) add({ hunt: hf, affix: 1 }, null, Math.min(4, s), d, slot);
      // 11-21（Ping 選 B）：第二、第三詞綴抽到原本沒特效、但有新機制的遺物 → 帶它的新機制（強化 +5 那一階）
      (W.__afkRelicMechAllTest ? [d.relicFx, d.relicFx3] : [d.relicFxMech, d.relicFx3Mech]).forEach(function (k) {   /* AllTest＝內部評估做法 C 用，遊戲內不開 */ if (!k || !M[k] || k === b) return; var dd = Object.create(d); dd._b = k; add(M[k], scale(M[k].v[0], (TMUL[k] || 1.15) / 1.15), 1, dd, slot); });
      if (s >= 4 && CATKEY[b]) add({ cat: CAT[CATKEY[b]] }, null, s, d, slot);
      if (s >= 3 && CATKEY[b] && CAT[CATKEY[b]].asc) add({ cat: CAT[CATKEY[b]] }, null, s, d, slot);
    };
    Object.keys(a.eq).forEach(function (slot) { if (slot === 'wpn2' || /^rem_|^doll|^mio/.test(slot)) return; take(a.eq[slot], slot); });
    if (a === P()) { try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) { if (pt && pt.eq) Object.keys(pt.eq).forEach(function (k) { take(pt.eq[k], 'pet'); }); }); } catch (e) {} }
    // 同系共鳴 2／4／6 件
    var reso = {}; Object.keys(fam).forEach(function (f) { var n = fam[f]; if (n >= 2) reso[f] = n >= 6 ? 15 : n >= 4 ? 10 : 5; });
    var v = { L: L, reso: reso, six: Object.keys(fam).filter(function (f) { return fam[f] >= 6; }) };
    CACHE.set(a, { t: t0, g: GEN, sig: sg, v: v }); return v;
  };
  var keyOf = function (x) { var d = x.d || {}; return (d._b || d.relicBase || '?') + ':' + (x.h ? 'M' : x.hunt ? (x.grudge ? 'G' : x.affix ? 'A' : 'H') : x.ele ? 'E' : x.cat ? 'C' : '?'); };
  var each = function (a, fn) { var v = collect(a); if (!v) return; for (var i = 0; i < v.L.length; i++) { var pk = CURK; if (W.__afkRMTrace) CURK = keyOf(v.L[i]); try { fn(v.L[i]); } catch (e) { if (W.__afkRMErr) W.__afkRMErr.push(keyOf(v.L[i]) + ' ' + e.message); if (!each.warned) { each.warned = 1; console.warn('[AFK-relicmech]', e); } } CURK = pk; } };

  // ════════ 掛點 ════════
  // 11-21 效能：全隊的「團隊型」條目每刻只整理一次（原本每一下傷害都把全隊 8 人的遺物全部掃一遍）
  var TIDX = { k: null, v: null }, TKEYS = ['team', 'teamHit', 'guard', 'teamTaken', 'teamCut'];
  var teamIdx = function () {
    var key = tk() + ':' + GEN; if (TIDX.k === key) return TIDX.v;
    var o = { aura: [] }; TKEYS.forEach(function (k) { o[k] = []; });
    party().forEach(function (a) { var c = collect(a); if (!c) return; c.L.forEach(function (x) { if (x.h) TKEYS.forEach(function (k) { if (x.h[k]) o[k].push([a, x]); }); if (x.ele && x.ele.role === 'aura' && x.ele.e === 'earth') o.aura.push([a, x]); }); });
    TIDX.k = key; TIDX.v = o; return o;
  };
  var eachT = function (k, fn) { var L = teamIdx()[k]; for (var i = 0; i < L.length; i++) { var pk = CURK; if (W.__afkRMTrace) CURK = keyOf(L[i][1]); try { fn(L[i][0], L[i][1]); } catch (e) { if (W.__afkRMErr) W.__afkRMErr.push(keyOf(L[i][1]) + ' ' + e.message); } CURK = pk; } };
  var teamPct = function (k, ctx) { var n = 0; eachT(k, function (a, x) { var tv = N(x.h[k](a, x.o, ctx, x.d)); if (tv) { n += tv; tr(); } }); return n; };
  var dealt = function (actor, tgt, v, opt) {
    if (!on() || !(v > 0) || !tgt || !actor || typeof actor !== 'object' || !alive(tgt)) return v;
    var kind = opt && opt.kind, main = kind === 'melee' || kind === 'ranged' || kind === 'magic', src = null;
    try { src = typeof _combatSrc !== 'undefined' ? _combatSrc : null; } catch (e) {}
    var comp = src === 'pet' || src === 'summon', p = P(), add = 0, ctx = { tgt: tgt, kind: kind, v: v, src: src, crit: !!(opt && opt.crit) };
    add += vulnOf(tgt);
    add += Math.min(30, teamPct('team', ctx));
    if (comp) {
      each(p, function (x) { if (x.h && x.h.comp) { var cpv = N(x.h.comp(p, x.o, ctx, x.d)); if (cpv) { add += cpv; tr(); } } if (x.cat && x.cat.comp) { var ccv = N(x.cat.comp(p, ctx, x.s)); if (ccv) { add += ccv; tr(); } } if (x.ele && x.ele.role === 'pet' && src === 'pet') { var pv = ELEX.petV[x.ele.e][x.s]; if (x.ele.e === 'water') setMp(p, mpOf(p) + v * pv / 200); else if (x.ele.e !== 'earth') add += pv; } if (x.ele && x.ele.role === 'sum' && src === 'summon' && (x.ele.e === 'wind' || x.ele.e === 'none')) add += ELEX.sumV[x.ele.e][x.s]; if (x.cat && x.cat.comp) add += N(x.cat.comp(p, ctx)); });
      v = v * (1 + add / 100);
      each(p, function (x) { if (x.h && x.h.compHit) x.h.compHit(p, x.o, { tgt: tgt, v: v, src: src }, x.d); });
      return v;
    }
    if (!isPlayer(actor) && !isAlly(actor)) return v * (1 + add / 100);
    if (isAlly(actor)) each(p, function (x) { if (x.h && x.h.allyDmg) add += N(x.h.allyDmg(p, x.o)); });
    var f = famOf(tgt), cv = collect(actor);
    if (cv && f && cv.reso[f]) add += cv.reso[f];
    each(actor, function (x) {
      if (x.h && x.h.dmg) { var dv = N(x.h.dmg(actor, x.o, ctx, x.d)); if (dv) { add += dv; tr(); } }
      if (x.hunt && x.hunt === f) { if (x.grudge) add += 5; else if (x.affix) add += 10; else add += [0, 5, 8, 12, 15][x.s] || 0; var H = HUNT[f]; if (H && H.dmg) add += N(H.dmg(actor, x.s, tgt)); }
      if (x.cat && x.cat.dmg) { var cv2 = N(x.cat.dmg(actor, ctx, x.s)); if (cv2) { add += cv2; tr(); } }
    });
    v = v * (1 + Math.min(200, add) / 100);
    if (!main) return v;
    ctx.v = v;
    each(actor, function (x) {
      if (x.h && x.h.hit) x.h.hit(actor, x.o, ctx, x.d);
      if (x.hunt && x.hunt === f) { var H = HUNT[f]; if (H && H.hit) { var six = cv && cv.six.indexOf(f) >= 0; H.hit(actor, x.s, tgt); if (six) H.hit(actor, x.s, tgt); } }
      if (x.ele && x.ele.role === 'atk') ELEX.atk[x.ele.e](actor, ELEX.atkV[x.ele.e][x.s], ctx);
      if (x.cat && x.cat.hit) x.cat.hit(actor, ctx, x.s);
    });
    eachT('teamHit', function (a, x) { x.h.teamHit(a, x.o, actor, ctx, x.d); });
    return v;
  };
  var taken = function (ent, dmg, mob, kind) {
    if (!on() || !(dmg > 0) || !ent || (!isPlayer(ent) && !isAlly(ent))) return dmg;
    var t = tk(), mm = mob && MK_.get(mob);
    if (mm) { if (mm.miss) { mm.miss = 0; return 0; } if ((mm.dust || 0) > t && roll(N(mm.dustP))) return 0; if ((mm.blind || 0) > t && roll(30)) return 0; }
    var c = { dmg: dmg, raw: dmg, mob: mob, kind: kind };
    // 隊友幫忙擋、全隊減傷
    eachT('guard', function (a, x) { if (a !== ent) c.dmg = x.h.guard(a, x.o, ent, c, x.d); }); eachT('teamTaken', function (a, x) { c.dmg = x.h.teamTaken(a, x.o, ent, c, x.d); }); eachT('aura', function (a, x) { c.dmg *= 1 - ELEX.auraV.earth[x.s] / 100; });
    var tc = Math.min(20, teamPct('teamCut', c)); if (tc) c.dmg *= 1 - tc / 100;
    if (isAlly(ent)) each(P(), function (x) { if (x.h && x.h.allyCut) c.dmg *= 1 - N(x.h.allyCut(P(), x.o)) / 100; });
    var cut = 0, f = famOf(mob);
    each(ent, function (x) {
      if (x.h && x.h.cut) { var ct = N(x.h.cut(ent, x.o, c, x.d)); if (ct) { cut += ct; tr(); } }
      if (x.hunt && x.hunt === f) { if (x.grudge) cut += 5; var H = HUNT[f]; if (H && H.cut) cut += N(H.cut(ent, x.s)); }
      if (x.ele && x.ele.role === 'grd') { var g = ELEX.grdV[x.ele.e][x.s]; if (x.ele.e === 'none' && mob && eleOfMob(mob) !== 'none') cut += g[0]; if (x.ele.e === 'wind' && roll(g[0])) c.dmg = 0; if (x.ele.e === 'water') heal(ent, c.dmg * g[0] / 100); if (x.ele.e === 'fire' && kind === 'phys' && mob && roll(g[0])) dot(mob, ent, 'xgb', panel(ent) * 0.1, 5, 1); }
      if (x.ele && x.ele.role === 'sum' && x.ele.e === 'earth' && sums().length) cut += ELEX.sumV.earth[x.s] / 4;
      if (x.ele && x.ele.role === 'pet' && x.ele.e === 'earth' && petsUp().length) cut += ELEX.petV.earth[x.s] / 3;
    });
    if (cut) c.dmg *= 1 - Math.min(50, cut) / 100;
    each(ent, function (x) { var d0 = c.dmg; if (x.h && x.h.taken) c.dmg = Math.max(0, N(x.h.taken(ent, x.o, c, x.d))); if (c.dmg !== d0) tr(); if (x.h && x.h.taken2) c.dmg = Math.max(0, N(x.h.taken2(ent, x.o, c, x.d))); if (x.cat && x.cat.taken) c.dmg = Math.max(0, N(x.cat.taken(ent, c))); });
    return c.dmg;
  };
  var DOT_T = 0;
  var tick = function () {
    if (!on()) return;
    var t = tk(), fight = false; try { fight = X().inCombat(); } catch (e) {}
    var ctx = { fight: fight };
    party().forEach(function (a) {
      each(a, function (x) {
        if (x.h && x.h.tick) x.h.tick(a, x.o, ctx, x.d);
        if (x.cat && x.cat.tick) x.cat.tick(a, ctx);
        if (x.ele && fight) {
          var e = x.ele.e, i = x.s, s = S(a, 'ele_' + x.ele.role + e);
          if (x.ele.role === 'aura' && e === 'water' && t % 50 === 0) party().forEach(function (y) { heal(y, mhpOf(y) * ELEX.auraV.water[i] / 100); });
          if (x.ele.role === 'grd' && e === 'earth' && cd(s, 'sh', ELEX.grdV.earth[i][0])) shield(a, mhpOf(a) * ELEX.grdV.earth[i][1] / 100, 20);
          if (x.ele.role === 'sum' && e === 'water' && sums().length && t % 50 === 0) setMp(a, mpOf(a) + N(a.mmp) * ELEX.sumV.water[i] / 100);
          if (x.ele.role === 'sum' && e === 'fire' && isPlayer(a)) { var now = sums(); s.prev = s.prev || []; s.prev.forEach(function (sm) { if (now.indexOf(sm) < 0) { var v = N(sm.mhp || sm.hp || 500) * ELEX.sumV.fire[i] / 100; mobs().forEach(function (m) { hit(m, v); }); } }); s.prev = now.slice(); }
        }
      });
    });
    // 遺物持續傷害：每秒
    if (t % 10 === 0 && DOTM.size) DOTM.forEach(function (m) {
      var o = MK_.get(m); if (!o || !alive(m)) { DOTM.delete(m); return; }
      o.dots = o.dots.filter(function (d) { return d.until > t; }); if (!o.dots.length) { DOTM.delete(m); return; }
      var sum = 0, f = famOf(m); o.dots.forEach(function (d) { var mul = 1; if (d.src && f === '蟲蛛') each(d.src, function (x) { if (x.hunt === '蟲蛛') mul = Math.max(mul, HUNT['蟲蛛'].dotX(d.src, x.s)); }); sum += d.per * mul; });
      if (sum > 0) { try { if (typeof W.__afkDotCap === 'function') sum = Math.max(0, N(W.__afkDotCap(m, sum, 'relicmech'))) || sum; } catch (e) {} hit(m, sum); }
    });
  };
  var kill = function (m) {
    if (!on() || !m) return; var src = null; try { src = typeof _combatSrc !== 'undefined' ? _combatSrc : null; } catch (e) {}
    party().forEach(function (a) { each(a, function (x) { var c = { m: m, bySrc: src }; if (x.h && x.h.kill) x.h.kill(a, x.o, c, x.d); if (x.cat && x.cat.kill) x.cat.kill(a, c, x.s); }); });
    try { MK_.delete(m); DOTM.delete(m); } catch (e) {}
  };
  var death = function () {
    if (!on()) return false; var p = P(), saved = false;
    each(p, function (x) { if (saved) return; if (x.h && x.h.death && x.h.death(p, x.o, x.d)) saved = true; else if (x.cat && x.cat.death && x.cat.death(p)) saved = true; });
    if (saved && p.hp <= 0) p.hp = 1;
    return saved;
  };
  var evade = function (mob) { if (!on()) return; var p = P(); each(p, function (x) { if (x.h && x.h.evade) x.h.evade(p, x.o, { mob: mob }, x.d); }); };
  var resist = function (k) { if (!on()) return false; var p = P(), r = false; each(p, function (x) { if (!r && x.h && x.h.resist && x.h.resist(p, x.o, k, x.d)) r = true; }); return r; };
  var potion = function (def0, est) { if (!on()) return; var p = P(); each(p, function (x) { if (x.h && x.h.potion) x.h.potion(p, x.o, { est: est }, x.d); }); };
  W.__afkOnBlock = (function (prev) { return function (ent, mob) { try { if (typeof prev === 'function') prev(ent, mob); } catch (e) {} if (!on()) return; each(ent, function (x) { if (x.h && x.h.block) x.h.block(ent, x.o, { mob: mob }, x.d); }); }; })(W.__afkOnBlock);
  // 治療：你施放的治療（治療者遺物）、你受到的治療
  var hookHeal = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || !R.observe || hookHeal.done) return; hookHeal.done = true;
    var o = W.foulWaterHealMult;
    if (typeof o === 'function' && !o.__afkRM) { var f = function (tg) { var m = o.apply(this, arguments); try { if (on() && tg && (isPlayer(tg) || isAlly(tg))) { var add = 0; each(tg, function (x) { if (x.h && x.h.healMulIn) add += N(x.h.healMulIn(tg, x.o)); }); var p = P(); each(p, function (x) { if (x.h && x.h.healMul) add += N(x.h.healMul(p, x.o)); if (x.ele && x.ele.role === 'heal' && x.ele.e === 'water') add += ELEX.healV.water[x.s]; }); if (add) m *= 1 + add / 100; } } catch (e) {} return m; }; f.__afkRM = true; W.foulWaterHealMult = f; try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {} }
  };
  // 你的治療命中（看全隊 HP 上升）：每 0.5 秒比對，歸給「最近施法的你」
  var HPS = new WeakMap();
  var healWatch = function () {
    if (!on() || tk() % 5) return; var p = P(); if (!p) return;
    party().forEach(function (a) {
      var before = HPS.get(a), now = hpOf(a); HPS.set(a, now);
      if (before == null || now <= before || a.dead) return;
      var amt = now - before, over = 0;
      each(a, function (x) { if (x.h && x.h.healIn) x.h.healIn(a, x.o, { amt: amt }, x.d); });
      if (amt > mhpOf(a) * 0.02) each(p, function (x) {
        if (x.h && x.h.healOut) x.h.healOut(p, x.o, { to: a, amt: amt, over: now >= mhpOf(a) ? amt * 0.3 : 0 }, x.d);
        if (x.ele && x.ele.role === 'heal') { var e = x.ele.e, hv = ELEX.healV[e][x.s]; if (e === 'fire' && roll(hv)) mobs().forEach(function (m) { hit(m, amt * 0.5); }); if (e === 'wind' && roll(hv)) { var l = party().filter(function (y) { return y !== a; })[0]; if (l) heal(l, amt * 0.5); } if (e === 'earth') S(a, 'xheal').cut = tk() + 50; if (e === 'none' && roll(hv)) S(a, 'xheal').imm = tk() + 30; }
      });
    });
  };
  var bind = function () {
    var x = X(); if (!x || bind.done) return; bind.done = true;
    x.on('dealt', dealt); x.on('taken', taken); x.on('tick', tick); x.on('tick', healWatch); x.on('kill', kill); x.on('death', death); x.on('evade', evade); x.on('resist', resist); x.on('potion', potion);
  };
  // 金幣、MP 消耗、寵物光環以外：金幣
  var hookEco = function () {
    if (typeof W.dollFieldVal === 'function' && !W.dollFieldVal.__afkRM) {
      var oD = W.dollFieldVal;
      var nD = function (field) { var r = oD.apply(this, arguments); try { if (field === 'goldBonus' && on()) { var p = P(); each(p, function (x) { if (x.h && x.h.gold) r = N(r) + N(x.h.gold(p, x.o)); }); } } catch (e) {} return r; };
      nD.__afkRM = true; W.dollFieldVal = nD; try { (0, eval)('dollFieldVal = window.dollFieldVal'); } catch (e) {}
    }
  };

  // ════════ 說明文字（合成、昇華時寫進衍生物品）════════
  var textFor = function (base, d, s, fxId) {
    var out = [], bd = DB.items[base] || d, mul = (TMUL[base] || 1.15) / 1.15;
    if (M[base] && s >= 1) out.push(M[base].t(scale(M[base].v[s - 1], mul)));
    if (HUNTER_ITEM[base] && s >= 1) out.push('對' + HUNTER_ITEM[base] + '系' + HUNT[HUNTER_ITEM[base]].t(s));
    if (bd.relicEcho) {
      var fk = EFAM[bd.relicEffectKey], E = ECHO[fk]; var dd = Object.create(bd); dd._b = base; dd._ge = fk === 'guard' ? (eleOfMob(DB.mobs[bd.relicSourceId]) === 'wind' ? (/神官|書/.test(bd.n) ? 'none' : 'wind') : 'fire') : null;
      if (E && s >= 1) out.push(E.t(scale(E.v[s - 1], mul), dd));
      if (s >= 2) { var sm = DB.mobs[bd.relicSourceId]; out.push(EW[eleOfMob(sm)] + '之力：' + eleText(ROLE_OF(bd, accIdx(base)), eleOfMob(sm), s >= 4 ? 1 : 0)); }
    }
    var hf = s >= 2 ? hunterAffix(base, fxId) : null; if (hf) out.push('種族獵手（' + hf + '系）：對' + hf + '系傷害 +10%；' + HUNT[hf].t(Math.min(4, s)));
    if (s >= 4 && CATKEY[base]) out.push(CAT[CATKEY[base]].t);
    else if (s >= 3 && CATKEY[base] && CAT[CATKEY[base]].asc) out.push(CAT[CATKEY[base]].t.split('；')[0]);
    return out.filter(Boolean).join('；');
  };
  var hookTier = function () {
    var o = W.__afkRelicTier; if (typeof o !== 'function' || o.__afkRM) return false;
    var f = function (d, b, n, asc) {
      var r = o.apply(this, arguments);
      try { var base = d && d.relicBase; if (base && on()) { var s = tier(n, asc), tx = textFor(base, d, s, d.relicFx); if (tx) { d.d = String(d.d || '').replace(/\u200b〔[^〕]*〕[^\u200b]*$/, '') + '\u200b〔' + (s < 3 ? '強化 ' : '') + STAGE_N[s] + '〕' + tx + '。'; } } } catch (e) {}
      return r;
    };
    f.__afkRM = true; W.__afkRelicTier = f; return true;
  };
  // 回響遺物本體：原主之仇寫進說明
  var baseText = function () {
    try { (W.__afkEchoRelic && W.__afkEchoRelic.KEYS || []).forEach(function (k) { var d = DB.items[k], sm = d && DB.mobs[d.relicSourceId], f = famOf(sm); if (!d || !f || /原主之仇/.test(d.d || '')) return; d.d = String(d.d || '') + '〔原主之仇〕對' + f + '系傷害 +5%、受到的傷害 −5%；' + HUNT[f].t(0) + '。'; }); } catch (e) {}
  };
  // 已經建好的衍生物品重建一次，說明才帶得到
  var rebuild = function () {
    var D = W.__afkRelicData; if (!D || !D.parseId || !D.ensure) return;
    Object.getOwnPropertyNames(DB.items).forEach(function (id) { var q = D.parseId(id); if (!q) return; var b = q.base, bd = DB.items[b]; if (!(M[b] || HUNTER_ITEM[b] || (bd && bd.relicEcho) || CATKEY[b] || q.fx)) return; var d = DB.items[id]; if (d && /〔新機制/.test(d.d || '') && !(d.relicEvoKey && M[b])) return; try { delete DB.items[id]; D.ensure(id); } catch (e) {} });
    GEN++;
  };

  // ── 啟動 ──
  var dropEvo = function () { try { var B = W.__afkBossRelic; if (B && B.EVO) Object.keys(M).concat(Object.keys(HUNTER_ITEM)).forEach(function (k) { delete B.EVO[k]; }); } catch (e) {} };
  // 11-21 補接：MP 消耗（黑法師的修身褲）與持續傷害打你（歐姆的粗皮褲）原本沒有掛點
  var hookRT = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R) return;
    if (R.castCost && !R.castCost._rm) {
      var oc = R.castCost;
      R.castCost = function (actor, skill, id, cost) {
        var c = oc.apply(this, arguments);
        try { if (on() && isPlayer(actor) && c > 0 && c < Number.MAX_SAFE_INTEGER && skill && (skill.dmgType || 'magic') === 'magic') { var pc = 0; each(actor, function (x) { if (x.h && x.h.mpCost) { pc = Math.max(pc, N(x.h.mpCost(actor, x.o))); if (pc) tr(); } }); if (pc) c = Math.max(0, Math.floor(c * (1 - Math.min(100, pc) / 100))); } } catch (e) {}
        return c;
      };
      R.castCost._rm = 1;
    }
    if (R.incoming && !R.incoming._rm) {
      var oi = R.incoming;
      R.incoming = function (ent, dmg, src, opt) {
        var v = oi.apply(this, arguments);
        try { if (on() && opt && opt.kind === 'dot' && /^(poison|burn|bleed)$/.test(opt.dotKind || '') && v > 0 && (isPlayer(ent) || isAlly(ent))) each(ent, function (x) { if (x.h && x.h.dotIn) { var d0 = v; v = Math.max(0, N(x.h.dotIn(ent, x.o, { dmg: v, kind: opt.dotKind }))); if (v !== d0) tr(); } }); } catch (e) {}
        return v;
      };
      R.incoming._rm = 1;
    }
  };
  var init = function () { if (init.done) return; init.done = true; dropEvo(); calcTier(); catInit(); hookGen(); hookHeal(); hookEco(); hookRT(); bind(); hookTier(); baseText(); rebuild(); };
  hookGen(); bind(); hookTier();
  W.addEventListener('load', function () { setTimeout(init, 0); setTimeout(function () { hookHeal(); hookEco(); rebuild(); }, 800); });
  W.__afkRelicMechHas = function (k) { return !!M[k]; };
  W.__afkRelicMechTxt = function (k) { var h = M[k]; if (!h) return ''; try { return h.t(scale(h.v[0], (TMUL[k] || 1.15) / 1.15)); } catch (e) { return ''; } };
  W.__afkRelicMech = { M: M, ECHO: ECHO, HUNT: HUNT, CAT: CAT, CATKEY: CATKEY, TMUL: TMUL, SRCF: SRCF, collect: collect, textFor: textFor, hunterAffix: hunterAffix, tier: tier, _dealt: dealt, _taken: taken, _tick: tick, _kill: kill, _death: death, init: init, scale: scale, bump: function () { GEN++; } };
})();
