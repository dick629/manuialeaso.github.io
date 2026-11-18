/* ============================================================================
 * afk-awaken.js — 覺醒職業（Ping 2026-11-14 03:43／03:50 定案；設計稿 Projects claude/new-classes-design.md v2）
 *
 *   五個覺醒職業：戰士→狂戰士、法師→雷神、騎士→神聖劍士、黑暗妖精→暗黑騎士、龍騎士→魔劍士。
 *   ‧覺醒：席琳神殿「覺醒導師 伊瑟拉」，交出本職 0 轉 Lv100 魂魄五顆（Ping 11-15 05:48；魂魄簿共用）。
 *     覺醒後 Lv1、0 轉，本職技能／魔法／精通／職業進化全部移除；背包與裝備保留，本職裝備照樣能穿。
 *   ‧技能：第一期「一般」（覺醒導師賣）＋「英雄」（王掉落）。主動技能自動施放，被動常駐。
 *   ‧全域：覺醒職業的昏迷打到王不會昏，改成王 3 秒內受到的全部傷害 ×1.5 再 +10%（×1.65）。
 *   ‧外觀與攻速：借本職或相近職業的人物（雷神、神聖劍士、暗黑騎士借騎士；魔劍士借黑暗妖精；狂戰士借戰士）。
 *   ‧經典模式沒有；外掛開關 awaken（預設關，本機測試版才打開）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  // 魂魄簿要認得覺醒職業（覺醒職業的魂魄只能拿來交覺醒轉職；Ping 11-15 05:48）；放在開關之前，關掉覺醒時魂魄簿也不會壞
  var extCC = function (cc) { try { var c0 = cc && cc.CLS; if (c0 && !Object.isFrozen(c0)) [['berserker', '狂戰士'], ['thunder', '雷神'], ['paladin', '神聖劍士'], ['darkknight', '暗黑騎士'], ['runeblade', '魔劍士']].forEach(function (x) { if (!c0[x[0]]) c0[x[0]] = x[1]; }); } catch (e) {} };
  if (W.LineageClassCore) extCC(W.LineageClassCore);
  else try { var ccHold; Object.defineProperty(W, 'LineageClassCore', { configurable: true, enumerable: true, get: function () { return ccHold; }, set: function (v) { ccHold = v; extCC(v); } }); } catch (e) {}   // merged/class-core.js 比這支晚載入
  if (W.AFK_TOGGLES && W.AFK_TOGGLES.register) W.AFK_TOGGLES.register({ id: 'awaken', name: '覺醒職業', group: '遊戲內容', def: true, desc: '席琳神殿 覺醒導師：交出本職 0 轉 Lv100 魂魄五顆，覺醒成狂戰士／雷神／神聖劍士／暗黑騎士／魔劍士' });
  if (W.AFK_TOGGLES && !W.AFK_TOGGLES.enabled('awaken')) return;
  if (typeof DB === 'undefined') return;

  var N = function (x) { return Number(x) || 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var now = function () { return N(typeof state !== 'undefined' && state.ticks) / 10; };

  // ── 職業 ──
  //   av：借用的人物（攻速、硬直、施法速度、動畫都跟著它）
  //   g：等級成長（hp/mp 基礎與每級、魔防、AC、迴避、額外傷害、額外命中；數字是「每幾級 +1」）
  var CLS = {
    berserker: { n: '狂戰士', base: 'warrior', av: ['男戰士', '女戰士'], main: '力量', icon: '狂戰士',
      g: { hp0: 17, hpI: 10, mp0: 1, mpI: 0.6, mr0: 0, mr: 10, ac: 8, er: 4, xd: 3, xh: 3 },
      start: { str: 17, dex: 12, con: 16, int: 8, wis: 8, cha: 8, pts: 6, put: 'str' } },
    thunder: { n: '雷神', base: 'mage', av: ['男騎士', '女騎士'], main: '智力', icon: '雷神',
      g: { hp0: 14, hpI: 7.5, mp0: 4, mpI: 3, mr0: 15, mr: 3, ac: 7, er: 5, xd: 4, xh: 3 },
      start: { str: 10, dex: 10, con: 13, int: 14, wis: 11, cha: 8, pts: 9, put: 'int' } },
    paladin: { n: '神聖劍士', base: 'knight', av: ['男騎士', '女騎士'], main: '力量、智力、精神', icon: '神聖劍士',
      g: { hp0: 16, hpI: 8.5, mp0: 3, mpI: 2.5, mr0: 10, mr: 3, ac: 6, er: 5, xd: 4, xh: 3 },
      start: { str: 14, dex: 10, con: 14, int: 11, wis: 11, cha: 8, pts: 7, put: 'str' } },
    darkknight: { n: '暗黑騎士', base: 'dark', av: ['男騎士', '女騎士'], main: '力量、敏捷', icon: '暗黑騎士',
      g: { hp0: 15, hpI: 9.5, mp0: 2, mpI: 1.5, mr0: 10, mr: 3, ac: 6, er: 4, xd: 4, xh: 3 },
      start: { str: 14, dex: 13, con: 12, int: 9, wis: 9, cha: 8, pts: 10, put: 'str' } },
    runeblade: { n: '魔劍士', base: 'dragon', av: ['男黑暗妖精', '女黑暗妖精'], main: '力量、敏捷、智力', icon: '魔劍士',
      g: { hp0: 15, hpI: 8, mp0: 3, mpI: 2.5, mr0: 15, mr: 3, ac: 7, er: 4, xd: 4, xh: 3 },
      start: { str: 13, dex: 12, con: 13, int: 11, wis: 10, cha: 8, pts: 8, put: 'str' } }
  };
  var BY_BASE = {}; Object.keys(CLS).forEach(function (k) { BY_BASE[CLS[k].base] = k; });
  var isAw = function (p) { return !!(p && CLS[p.cls]); };
  var BASE_N = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };
  W.__awkName = function (c) { return CLS[c] ? CLS[c].n : null; };
  if (typeof W._summaryFromRaw === 'function') { var oSum = W._summaryFromRaw; W._summaryFromRaw = function () { var r = oSum.apply(this, arguments); if (r && CLS[r.cls]) r.cls = CLS[r.cls].n; return r; }; }

  // ── 武器判斷 ──
  var fam = function (id) { try { return typeof atkSpdFamily === 'function' ? atkSpdFamily(id) : null; } catch (e) { return null; } };
  var wpnFam = function (p) { return p && p.eq && p.eq.wpn ? fam(p.eq.wpn.id) : null; };
  var isSpear = function (f) { return f === '單手矛' || f === '雙手矛'; };
  var offEn = function (p) {   // 副手（盾、臂甲）強化值；遺物副手先用強化值，昇華支配另外規劃
    var s = p && p.eq && p.eq.shield; return s ? Math.max(0, N(s.en)) : -1;
  };
  var hasOff = function (p) { return !!(p && p.eq && p.eq.shield); };
  var wpnEn = function (p) { return p && p.eq && p.eq.wpn ? Math.max(0, N(p.eq.wpn.en)) : 0; };
  var WEAPONS = {   // 覺醒職業額外能拿的武器種類
    berserker: ['雙手鈍器', '雙手矛', '單手鈍器', '雙斧'],
    thunder: ['單手劍', '單手矛', '雙手矛'],
    paladin: ['單手劍', '雙手劍'],
    darkknight: ['單手劍', '雙手劍'],
    runeblade: ['單手劍']
  };

  // ── 技能資料 ──
  //   k：主動 act／被動 pas／增益 buf；lv：學習等級；tier：一般／英雄
  //   跑在引擎裡的函式：run(p,t,S)（主動）、stat(p,d,S)（常駐數值）、hit(p,t,v,o,S)（自己的一般攻擊命中後）、
  //   taken(p,dmg,mob,kind,S)（受傷，回傳新傷害）、evade(p,mob,S)、kill(p,mob,S)、tick(p,S)
  var SK = {};
  var ICON = function (cls, name) { return 'assets/icons/awaken/' + CLS[cls].icon + '_' + String(name).replace(/：/g, '_').replace(/（/g, '(').replace(/）/g, ')').replace(/\s/g, '') + '.webp'; };
  var add = function (cls, key, def) {
    def.cls = cls; def.key = key; def.id = 'sk_aw_' + cls + '_' + key;
    if (def.icon !== false) def.img = ICON(cls, def.iconName || def.n);
    SK[def.id] = def; return def;
  };

  // ── 共用小工具（引擎）──
  var R = function () { return W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; };
  var STATE = new WeakMap(), MOB = new WeakMap();
  var st = function (p) { var s = STATE.get(p); if (!s) { s = { cd: {}, buf: {}, cnt: {}, lastCast: -9 }; STATE.set(p, s); } return s; };
  var ms = function (m) { var s = MOB.get(m); if (!s) { s = { mark: 0, markAt: 0, deb: {} }; MOB.set(m, s); } return s; };
  var alive = function (m) { return !!(m && !m._dead && N(m.curHp) > 0); };
  var foes = function () { return ((typeof mapState !== 'undefined' && mapState.mobs) || []).filter(alive); };
  var target = function () { var t = null; try { t = typeof getTarget === 'function' ? getTarget() : null; } catch (e) {} return alive(t) ? t : foes()[0] || null; };
  var near = function (t, n) { var xs = foes(); if (t) xs = [t].concat(xs.filter(function (x) { return x !== t; })); return xs.slice(0, n); };
  var mine = function (a) { var p = P(); return !!(a && p && (a === p || (p.allies || []).indexOf(a) >= 0)); };   // 自己或自己的傭兵
  var learned = function (p, id) { return !!(p && p.skills && p.skills.indexOf(id) >= 0); };
  var buffOn = function (p, k) { return N(st(p).buf[k]) > now(); };
  var has = function (p, cls, key) { return p.cls === cls && learned(p, 'sk_aw_' + cls + '_' + key); };
  // 基本傷害：一般攻擊平均（武器平均＋近距離傷害＋額外傷害），比面板移動平均小就用面板
  var base = function (p) {
    var d = p.d || {}, w = p.eq && p.eq.wpn ? DB.items[p.eq.wpn.id] : null, en = wpnEn(p);
    var avg = w ? (N(w.dmgS) + 1) / 2 : 2;
    var v = avg + en + N(d.meleeDmg) + N(d.extraDmg);
    var pv = N(st(p).panel);   // 只看自己的一般攻擊（技能傷害不算進來，不然會越滾越大）
    return Math.max(1, Math.min(Math.max(v, pv), v * 4));
  };
  var SKM = { thunder: 6.5, darkknight: 1.5, paladin: 2.5, runeblade: 2.5, berserker: 5.5 };   // 各職業技能傷害倍率（木樁校準）
  var skillPct = function (p, src) { return (SKM[p.cls] || 1) * (1 + N(st(p).skillPct)) * modsMul('skillMult', p, src); };
  // 傷害（魔法吃魔防＋屬性相剋；物理扣傷害減免）
  var deal = function (p, t, scale, o) {
    o = o || {}; var api = R(); if (!api || !alive(t)) return 0;
    var magic = o.magic, amt = base(p) * scale * skillPct(p, o.src) * (o.mult || 1);
    if (magic) {
      amt *= 1 + N(p.d && p.d.magicDmg) * 0.02;
      if (typeof mrMult === 'function') amt *= mrMult(N(t.mr) * (1 - N(o.pierceMr)));
      if (o.ele && typeof elementCounterMult === 'function') amt *= elementCounterMult(o.ele, t.e);
    } else amt = Math.max(1, amt - N(t.dr) * (1 - N(o.ignoreDr)));
    if (o.crit && Math.random() < o.crit) amt *= 1.5;
    var v = api.damage(t, Math.floor(amt), { actor: p, source: 'awk:' + (o.src || 'skill'), type: magic ? 'magic' : 'physical', element: o.ele || 'none', origin: 'class', generated: true, direct: true, settle: true });
    if (v > 0 && !state.ff && typeof vfxText === 'function' && o.show !== false) try { vfxText(t, String(Math.floor(v)), o.color || (magic ? '#93c5fd' : '#fde68a')); } catch (e) {}
    return v || 0;
  };
  var heal = function (p, n) { if (!(n > 0)) return 0; var api = R(); if (api) return api.heal(p, Math.floor(n), { owner: p, source: 'awk:heal', prepaid: true }) || 0; var b = p.hp; p.hp = Math.min(p.mhp, p.hp + n); return p.hp - b; };
  // 昏迷：王不會昏，改成 3 秒易傷 ×1.65（Ping 03:43／03:50）
  var VULN = 1.5 * 1.1, VULN_SEC = 3, VULN_CD = 12;   // 同一隻王每 12 秒最多一次
  var stun = function (p, t, sec) {
    if (!alive(t)) return false;
    if (t.boss) { var s = ms(t); if (N(s.vulnCd) > now()) return true; s.vuln = now() + VULN_SEC; s.vulnCd = now() + VULN_CD; pop(p, 'vuln', '王易傷 ×1.65', '#fca5a5'); return true; }
    var api = R(); if (!api) return false;
    return api.status(t, 'stun', sec, 1) !== false;
  };
  var silence = function (t, sec) { var api = R(); if (api && alive(t) && !t.boss) api.status(t, 'silence', sec, 1); };
  var deb = function (t, key, val, sec) { if (!alive(t)) return; ms(t).deb[key] = { v: val, until: now() + sec }; };
  var debV = function (t, key) { var d = t && MOB.has(t) && ms(t).deb[key]; return d && d.until > now() ? d.v : 0; };
  var pop = function (p, key, text, color) { try { if (p === P() && W.__afkProc && W.__afkProc.pop) W.__afkProc.pop('awk:' + key, null, text, color); } catch (e) {} };
  var note = function (key, html) { try { if (W.__afkProc && W.__afkProc.note) W.__afkProc.note('awk:' + key, html); } catch (e) {} };
  var chance = function (x) { return Math.random() < x; };
  var mast = function (p, id) { try { return typeof _afkM === 'function' ? !!_afkM(p, id) : p.mastery === id; } catch (e) { return p && p.mastery === id; } };
  var MODS = [], H_TITAN = null;   // afk-awaken-ext.js 掛進來的：技藝、技能強化、覺醒進化（dealt／taken／tick／stat／skill／cd）
  var modsRun = function (k, a, b, c, d, e) { var v; for (var i = 0; i < MODS.length; i++) { var f = MODS[i][k]; if (f) try { var r = f(a, b, c, d, e); if (r !== undefined) v = r; } catch (er) { console.warn('[AFK-awaken] mod', k, er); } } return v; };
  var modsMul = function (k, a, b, c, d) { var m = 1; for (var i = 0; i < MODS.length; i++) { var f = MODS[i][k]; if (f) try { var r = f(a, b, c, d); if (r > 0) m *= r; } catch (er) {} } return m; };
  var LV = function (p) { return N(p.lv) || 1; };

  // ============================================================== 雷神 ==
  // 閃電標誌：疊 3 層觸電（100% 傷害＋昏迷 1.5 秒），每層讓目標防禦 -2；累積疊 5 個發動超載充能
  var mark = function (p, t, n) {
    if (!alive(t)) return; var s = ms(t), S = st(p);
    if (now() - s.markAt > 12) s.mark = 0;
    s.mark += n || 1; s.markAt = now();
    S.cnt.marks = N(S.cnt.marks) + (n || 1);
    if (s.mark >= (mast(p, 'awt_mark') ? 2 : 3)) {
      s.mark = 0;
      deal(p, t, 1.0, { magic: true, ele: 'wind', src: 'shock' });
      var shk = (has(p, 'thunder', 'mark2') ? 2 : 1.5) + N(W.__awkShockAdd && W.__awkShockAdd(p)); s.shockUntil = now() + shk;   // 覺醒轉職（幻雷術士）：觸電時間 +2 秒
      stun(p, t, shk);
      pop(p, 'shock', '觸電', '#93c5fd');
    }
    if (has(p, 'thunder', 'overload') && S.cnt.marks >= 5 && N(S.cd.overload) <= now()) {
      S.cnt.marks = 0; S.cd.overload = now() + 30;
      heal(p, N(p.mhp) * 0.10); S.buf.overload = now() + (has(p, 'thunder', 'overload2') ? 15 : 10); if (has(p, 'thunder', 'overload2')) S.cd['sk_aw_thunder_stun'] = 0;
      if (typeof recomputeStats === 'function') try { recomputeStats(); } catch (e) {}
      pop(p, 'overload', '超載充能', '#60a5fa');
    }
  };
  var chainCount = function (p) {
    var e = offEn(p), n = e < 0 ? 2 : e >= 9 ? 6 : e >= 7 ? 5 : e >= 5 ? 4 : 3;
    if (mast(p, 'awt_chain')) n += 2;
    if (has(p, 'thunder', 'valkyrie') && isSpear(wpnFam(p))) n += 1;
    if (isSpear(wpnFam(p))) n += 1;   // 拿矛：多打 1 隻（女武神的射程改成這個）
    try { if (W.__awkChainAdd) n += N(W.__awkChainAdd(p)); } catch (e) {}   // 覺醒轉職（風雷射手）
    return n;
  };
  add('thunder', 'mark', { n: '閃雷標記', tier: '一般', lv: 1, k: 'pas', desc: '一般攻擊有 25% 機率疊 1 層閃電標誌（每層防禦 -2）。疊到 3 層觸電：造成 100% 雷擊並昏迷 1.5 秒（王改成 3 秒內受到的傷害 ×1.65）。',
    hit: function (p, t) { var c = has(p, 'thunder', 'mark2') ? 0.35 : 0.25; if (chance(c)) mark(p, t, 1); } });
  add('thunder', 'mastery', { n: '武器精通', tier: '一般', lv: 5, k: 'pas', desc: '矛和單手劍的傷害 +2（Lv50 起 +4）；拿矛時攻速 +5%。',
    stat: function (p, d) { var f = wpnFam(p); if (f === '單手劍' || isSpear(f)) d.meleeDmg += LV(p) >= 50 ? 4 : 2; if (isSpear(f)) d.atkSpdPct += 5 + (mast(p, 'awt_valk') ? 15 : 0); } });
  add('thunder', 'potential', { n: '電位', tier: '一般', lv: 10, k: 'pas', desc: '武器自己會打出的雷擊（例如雷雨之劍）變成打周圍 3 隻，傷害 +30%。' });
  add('thunder', 'bolt', { n: '落雷', tier: '一般', lv: 15, k: 'pas', desc: '攻擊時有 10% 機率落雷，造成 150% 雷擊。',
    hit: function (p, t) { var up = has(p, 'thunder', 'bolt2'); if (chance(up ? 0.15 : 0.10)) deal(p, t, up ? 2.0 : 1.5, { magic: true, ele: 'wind', src: 'bolt' }); } });
  add('thunder', 'arrow', { n: '雷電箭', tier: '一般', lv: 20, k: 'act', mp: 10, cd: 4, desc: '造成 120% 雷擊並疊 1 層標誌，20% 機率讓目標僵直 1 秒。',
    run: function (p, t) { deal(p, t, 1.2, { magic: true, ele: 'wind', src: 'arrow' }); mark(p, t, 1); if (chance(0.2)) stun(p, t, 1); if (has(p, 'thunder', 'chain2')) chainHit(p, t); return true; } });
  add('thunder', 'plasma', { n: '等離子體推進器', tier: '一般', lv: 25, k: 'pas', desc: '二段加速：攻速 +30%。', stat: function (p, d) { d.atkSpdPct += 30; } });
  add('thunder', 'stun', { n: '雷電昏迷', tier: '一般', lv: 30, k: 'act', mp: 20, cd: 12, desc: '目標昏迷 2 秒（王改成易傷），傷害減免 -10%，持續 6 秒。',
    run: function (p, t) { stun(p, t, 2); deb(t, 'drDown', 0.10, 6); return true; } });
  add('thunder', 'static', { n: '靜態場', tier: '一般', lv: 35, k: 'act', mp: 15, cd: 6, desc: '周圍範圍 100% 雷擊；連續施放疊加，最多 3 層（第 3 層 ×1.5）。',
    run: function (p, t) { var S = st(p); S.cnt.static = now() - N(S.cnt.staticAt) < 15 ? Math.min(3, N(S.cnt.static) + 1) : 1; S.cnt.staticAt = now(); var m = S.cnt.static >= 3 ? 1.5 : 1; near(t, 6).forEach(function (x) { deal(p, x, 1.0 * m, { magic: true, ele: 'wind', src: 'static' }); }); return true; } });
  add('thunder', 'strike', { n: '閃電攻擊', tier: '一般', lv: 38, k: 'pas', desc: '近距離命中 +3、近距離傷害 +3（Lv60 起各 +6）。', stat: function (p, d) { var v = LV(p) >= 60 ? 6 : 3; d.meleeHit += v; d.meleeDmg += v; } });
  add('thunder', 'crit', { n: '閃電爆擊', tier: '一般', lv: 40, k: 'pas', desc: '武器每強化 +1，近距離爆擊 +0.5%，最多 +7.5%。', stat: function (p, d) { d.meleeCrit += Math.min(7.5, wpnEn(p) * 0.5); } });
  add('thunder', 'armorhp', { n: '雷霆盔甲', tier: '一般', lv: 42, k: 'pas', desc: '最大 HP + 等級×3。', hp: function (p) { return LV(p) * 3; } });
  var chainHit = function (p, t) { var cm = has(p, 'thunder', 'valkyrie') ? 1.2 : 1; near(t, chainCount(p)).forEach(function (x, i) { deal(p, x, 0.6 * cm, { ignoreDr: 0.5, magic: true, ele: 'wind', src: 'chain', show: i < 3 }); }); };
  add('thunder', 'chain', { n: '鎖鏈閃光', tier: '一般', lv: 45, k: 'pas', desc: '攻擊有 15% 機率打出連鎖閃電，每隻 60% 雷擊。隻數看副手強化值：沒副手 2、+0～4 是 3、+5～6 是 4、+7～8 是 5、+9 以上 6；拿矛多 1 隻。',
    hit: function (p, t) { if (chance(has(p, 'thunder', 'chain2') ? 0.20 : 0.15)) chainHit(p, t); } });
  add('thunder', 'armor', { n: '雷電鎧甲', tier: '一般', lv: 48, k: 'buf', mp: 20, cd: 1200, dur: 1200, desc: '持續 20 分鐘：迴避 +5，迴避成功時有 30% 機率對攻擊者造成 80% 電擊。',
    run: function (p) { st(p).buf.tarmor = now() + 1200; return true; }, stat: function (p, d) { if (buffOn(p, 'tarmor')) d.er += 5; },
    evade: function (p, m) { if (buffOn(p, 'tarmor') && chance(0.3)) deal(p, m, 0.8, { magic: true, ele: 'wind', src: 'tarmor' }); } });
  add('thunder', 'flash', { n: '雷電一閃', tier: '英雄', lv: 55, k: 'act', mp: 25, cd: 15, desc: '衝到目標面前，造成 250% 傷害並疊 1 層標誌，30% 機率沉默 3 秒。',
    run: function (p, t) { var lost = has(p, 'thunder', 'flash2') ? Math.max(0, 1 - N(t.curHp) / Math.max(1, N(t.mhp || t.hp))) * 2 : 0; deal(p, t, 2.5 + lost, { magic: true, ele: 'wind', src: 'flash' }); if (has(p, 'thunder', 'flash2') && !alive(t)) st(p).cd['sk_aw_thunder_flash'] = 0; mark(p, t, 1); if (chance(0.3)) silence(t, 3); return true; } });
  add('thunder', 'overload', { n: '超載充能', tier: '英雄', lv: 60, k: 'pas', desc: '累積疊滿 5 個標誌時自動發動：回 10% HP，攻速 +15%、近距離爆擊 +5%，持續 10 秒（冷卻 30 秒）。',
    stat: function (p, d) { if (buffOn(p, 'overload')) { d.atkSpdPct += 15; d.meleeCrit += has(p, 'thunder', 'overload2') ? 10 : 5; } } });
  add('thunder', 'guard', { n: '雷霆防護', tier: '英雄', lv: 65, k: 'pas', desc: '傷害減免 + 等級÷15。', stat: function (p, d) { d.dr += Math.floor(LV(p) / 15); } });
  add('thunder', 'mark2', { n: '雷霆標記（神秘）', tier: '英雄', lv: 70, k: 'pas', desc: '閃電標誌觸發率 25% → 35%；觸電昏迷 1.5 → 2 秒。' });
  add('thunder', 'bolt2', { n: '落雷（神秘）', tier: '英雄', lv: 75, k: 'pas', desc: '落雷機率 10% → 15%，傷害 150% → 200%。' });
  add('thunder', 'chain2', { n: '鎖鏈閃光（神秘）', tier: '英雄', lv: 78, k: 'pas', desc: '鎖鏈閃光機率 15% → 20%，雷電箭也會打出鎖鏈閃光。' });

  // ============================================================ 暗黑騎士 ==
  add('darkknight', 'dk', { n: '黑暗騎士', tier: '一般', lv: 1, k: 'pas', desc: '每次攻擊追加「近距離命中 ×0.5」點暗屬性魔法傷害（物理轉魔法）。',
    hit: function (p, t) { var v = Math.max(1, Math.floor(N(p.d && p.d.meleeHit) * 0.5 * (mast(p, 'awk_dark') ? 2 : 1) * (has(p, 'darkknight', 'dk2') ? 2 : 1))); var api = R(); if (api && alive(t)) api.damage(t, Math.floor(v * (typeof mrMult === 'function' ? mrMult(N(t.mr)) : 1)), { actor: p, source: 'awk:dk', type: 'magic', element: 'none', origin: 'class', generated: true, direct: true, settle: true }); } });
  add('darkknight', 'body', { n: '暗黑防護', tier: '一般', lv: 5, k: 'pas', desc: '體質 +1（Lv50 起 +2）。', attr: function (p, d) { d.con += LV(p) >= 50 ? 2 : 1; } });
  add('darkknight', 'sword', { n: '暗黑之劍', tier: '一般', lv: 10, k: 'pas', desc: '每次攻擊多一道劍氣，造成 35% 傷害。',
    hit: function (p, t) { var n = mast(p, 'awk_wave') ? 2 : 1; near(t, n).forEach(function (x) { deal(p, x, 0.35, { src: 'swordwave', show: false }); }); } });
  add('darkknight', 'impact', { n: '暗黑衝擊', tier: '一般', lv: 15, k: 'pas', desc: '攻擊時有 15% 機率追加 50% 傷害。', hit: function (p, t) { if (chance(0.15)) deal(p, t, 0.5, { src: 'impact' }); } });
  add('darkknight', 'fatal', { n: '暗黑致命', tier: '一般', lv: 20, k: 'pas', desc: '近距離爆擊 + 等級÷10 %。', stat: function (p, d) { d.meleeCrit += Math.floor(LV(p) / 10); } });
  add('darkknight', 'stun', { n: '暗黑之暈', tier: '一般', lv: 30, k: 'act', mp: 20, cd: 12, desc: '要拿單手劍和盾或臂甲。昏迷 2 秒（王改成易傷），目標傷害減免 -10%、魔防 -10，持續 6 秒。',
    can: function (p) { return wpnFam(p) === '單手劍' && hasOff(p); },
    run: function (p, t) { var up = has(p, 'darkknight', 'stun2'); stun(p, t, 2); deb(t, 'drDown', up ? 0.2 : 0.10, up ? 8 : 6); deb(t, 'mrDown', 10, up ? 8 : 6); return true; } });
  add('darkknight', 'guard', { n: '黑暗守護', tier: '一般', lv: 35, k: 'pas', desc: 'AC -5、魔防 +5。', stat: function (p, d) { d.ac -= 5; d.mr += 5; } });
  add('darkknight', 'soul', { n: '暗黑之魂', tier: '一般', lv: 40, k: 'pas', desc: '擊殺時回 3% HP、3% MP；20% 機率得到 1 隻虛空的使魔（最多存 2 隻），存滿自動放出，打周圍 200%。',
    kill: function (p, m) { heal(p, N(p.mhp) * 0.03); p.mp = Math.min(N(p.mmp), N(p.mp) + N(p.mmp) * 0.03); var S = st(p), cap = has(p, 'darkknight', 'soul2') ? 3 : 2; if (chance(mast(p, 'awk_imp') ? 0.4 : 0.2)) { S.cnt.imp = N(S.cnt.imp) + 1; if (S.cnt.imp >= cap) { S.cnt.imp = 0; var t = target(); near(t, 6).forEach(function (x) { deal(p, x, 2.0, { magic: true, src: 'imp' }); }); pop(p, 'imp', '虛空的使魔', '#c084fc'); } } } });
  add('darkknight', 'mirror', { n: '黑暗之鏡', tier: '一般', lv: 42, k: 'pas', desc: '5% 機率把昏迷、恐怖反射回去（副手每 +1 再加 1%，最多 15%）。' });
  add('darkknight', 'revenge', { n: '暗黑復仇', tier: '一般', lv: 45, k: 'pas', desc: '近距離傷害 + 等級÷10；近距離命中 + 等級÷10。', stat: function (p, d) { d.meleeDmg += Math.floor(LV(p) / 10); d.meleeHit += Math.floor(LV(p) / 10); } });
  add('darkknight', 'barrier', { n: '復仇屏障', tier: '英雄', lv: 55, k: 'buf', mp: 30, cd: 600, desc: '持續 10 分鐘：受到攻擊時 8% 機率完全迴避；每迴避 5 次放一次「復仇之劍」，造成 300% 傷害。',
    run: function (p) { st(p).buf.barrier = now() + 600; return true; },
    taken: function (p, dmg, mob) { if (buffOn(p, 'barrier') && dmg > 0 && chance(0.08 + (mast(p, 'awk_rev') ? 0.04 : 0) + (has(p, 'darkknight', 'myth_barrier') ? 0.04 : 0))) { var S = st(p); S.cnt.ev = N(S.cnt.ev) + 1; pop(p, 'barrier', '復仇屏障', '#c084fc'); if (S.cnt.ev >= 5) { S.cnt.ev = 0; var t = alive(mob) ? mob : target(); if (t) deal(p, t, 3.0 * (has(p, 'darkknight', 'myth_barrier') ? 2 : 1), { src: 'revsword' }); } return 0; } return dmg; } });
  add('darkknight', 'eye', { n: '暗黑之眼', tier: '英雄', lv: 60, k: 'pas', desc: '目標 HP 低於 30% 時，近距離爆擊 +15%；攻擊無視目標 10% 傷害減免。' });
  add('darkknight', 'hand', { n: '黑手', tier: '英雄', lv: 65, k: 'act', mp: 25, cd: 20, desc: '目標受到的近距離傷害 +10%，持續 10 秒。', run: function (p, t) { deb(t, 'meleeVuln', 0.10, 10); return true; } });
  add('darkknight', 'nether', { n: '幽冥防護', tier: '英雄', lv: 70, k: 'pas', desc: '傷害減免 +3；副手每 +1 再加 0.5，最多 +8。', stat: function (p, d) { d.dr += Math.min(8, 3 + Math.max(0, offEn(p)) * 0.5); } });
  add('darkknight', 'soul2', { n: '暗黑之魂（復仇者）', tier: '英雄', lv: 75, k: 'pas', desc: '爆擊時吸血，回復 15% 爆擊傷害；虛空的使魔最多存 3 隻。' });

  // ============================================================ 神聖劍士 ==
  add('paladin', 'raid', { n: '神聖狂襲', tier: '一般', lv: 1, k: 'pas', desc: '每攻擊 7 次，有 80% 機率追加一次 150% 的爆擊。',
    hit: function (p, t) { var S = st(p), n = has(p, 'paladin', 'raid2') ? 2 : 7, c = has(p, 'paladin', 'raid2') ? 0.5 : 0.8; S.cnt.raid = N(S.cnt.raid) + 1; if (S.cnt.raid >= n) { S.cnt.raid = 0; if (chance(c)) deal(p, t, 1.5 * (mast(p, 'awp_raid') ? 1.5 : 1), { src: 'raid', color: '#fef08a' }); } } });
  add('paladin', 'recover', { n: '神聖回復', tier: '一般', lv: 5, k: 'pas', desc: '迴避成功時回復 HP，量是「智力 ×2 + 等級」，冷卻 3 秒。',
    evade: function (p) { var S = st(p); if (N(S.cd.recover) > now()) return; S.cd.recover = now() + (has(p, 'paladin', 'recover2') ? 1.5 : 3); heal(p, N(p.d && p.d.int) * 2 + LV(p)); } });
  add('paladin', 'ench1', { n: '附魔武器：狂襲 Lv1', tier: '一般', lv: 10, k: 'pas', desc: '近距離攻擊有 8% 機率追加 120% 光屬性魔法傷害。',
    hit: function (p, t) { var up = has(p, 'paladin', 'ench3'); if (chance(up ? 0.15 : 0.08)) deal(p, t, 1.2 * (up ? 2 : 1), { magic: true, src: 'ench', color: '#fef9c3', pierceMr: up ? 1 : 0 }); } });
  add('paladin', 'chaos1', { n: '附魔武器：混亂 Lv1', tier: '一般', lv: 12, k: 'pas', desc: '近距離攻擊有 8% 機率讓目標的傷害 -5%，持續 5 秒。',
    hit: function (p, t) { if (chance(0.08)) deb(t, 'weak', 0.05, 5); } });
  add('paladin', 'brave', { n: '神聖勇猛', tier: '一般', lv: 15, k: 'pas', desc: '二段加速：攻速 +25%。', stat: function (p, d) { d.atkSpdPct += 25; } });
  add('paladin', 'master', { n: '神聖劍之精通', tier: '一般', lv: 20, k: 'pas', desc: '拿單手劍時，有 10% 機率追加 50% 傷害（Lv60 起 15%）；近距離命中 + 等級÷10。',
    stat: function (p, d) { d.meleeHit += Math.floor(LV(p) / 10); },
    hit: function (p, t) { if (wpnFam(p) === '單手劍' && chance(LV(p) >= 60 ? 0.15 : 0.10)) deal(p, t, 0.5, { src: 'master', show: false }); } });
  add('paladin', 'storm', { n: '神聖風暴', tier: '一般', lv: 25, k: 'act', mp: 18, cd: 6, desc: '周圍範圍 140% 光屬性傷害。',
    run: function (p, t) { near(t, 6).forEach(function (x) { deal(p, x, 1.4, { magic: true, src: 'storm', color: '#fef9c3' }); }); return true; } });
  add('paladin', 'stun', { n: '神聖衝暈', tier: '一般', lv: 30, k: 'act', mp: 20, cd: 12, desc: '要拿單手劍。昏迷 2 秒（王改成易傷），期間目標不能回血。',
    can: function (p) { return wpnFam(p) === '單手劍'; },
    run: function (p, t) { var sec = (has(p, 'paladin', 'stun2') ? 2.5 : 2) + (has(p, 'paladin', 'stun3') ? 1 : 0); stun(p, t, sec); deb(t, 'noHeal', 1, sec); if (has(p, 'paladin', 'stun3')) deb(t, 'meleeVuln', 0.15, sec); return true; } });
  add('paladin', 'judge', { n: '審判', tier: '一般', lv: 33, k: 'act', mp: 15, cd: 10, desc: '要有盾。造成 130% 傷害，目標受到的傷害 +8%（盾每 +1 再加 0.5%），持續 8 秒；擊殺時冷卻重置。',
    can: function (p) { return hasOff(p); },
    run: function (p, t) { deal(p, t, 1.3, { magic: true, src: 'judge', color: '#fef9c3' }); deb(t, 'vuln', 0.08 + Math.max(0, offEn(p)) * 0.005, 8); if (!alive(t)) st(p).cd[SK['sk_aw_paladin_judge'].id] = 0; return true; } });
  add('paladin', 'pray', { n: '神聖祝禱', tier: '一般', lv: 36, k: 'pas', desc: '對不死系、黑暗系怪物的傷害 +15%；打不死系時 3% 機率直接消滅（王無效）。' });
  add('paladin', 'defense', { n: '神聖防禦', tier: '一般', lv: 40, k: 'pas', desc: '頭盔、盔甲、手套、斗篷、T 恤、長靴，每件的強化值換成最大 HP + 強化值 ×10。',
    hp: function (p) { var n = 0; ['helm', 'armor', 'gloves', 'cloak', 'tshirt', 'boots'].forEach(function (k) { var e = p.eq && p.eq[k]; if (e) n += Math.max(0, N(e.en)) * 10; }); return n; } });
  add('paladin', 'bless', { n: '神聖祝福', tier: '一般', lv: 43, k: 'pas', desc: '防具強化值換成的 AC 再 -20%（防具越強越硬）。',
    stat: function (p, d) { var n = 0; ['helm', 'armor', 'gloves', 'cloak', 'tshirt', 'boots', 'shield'].forEach(function (k) { var e = p.eq && p.eq[k]; if (e) n += Math.max(0, N(e.en)); }); d.ac -= Math.floor(n * 0.2); } });
  add('paladin', 'time', { n: '時間消除', tier: '一般', lv: 45, k: 'act', mp: 40, cd: 120, desc: '把一般技能的冷卻全部重置。',
    can: function (p) { var S = st(p), busy = 0; Object.keys(S.cd).forEach(function (k) { var d = SK[k]; if (d && d.tier === '一般' && N(S.cd[k]) - now() > 4) busy++; }); return busy >= 2; },
    run: function (p) { var S = st(p); Object.keys(S.cd).forEach(function (k) { var d = SK[k]; if (d && d.tier === '一般' && d.key !== 'time') S.cd[k] = 0; }); pop(p, 'time', '時間消除', '#a5f3fc'); return true; } });
  add('paladin', 'unity', { n: '團結', tier: '英雄', lv: 50, k: 'pas', desc: '自己和隊伍（含傭兵）經驗 +5%；每多 1 個隊員再 +1.75%，最多 +12%。' });
  add('paladin', 'protect', { n: '神聖保護', tier: '英雄', lv: 55, k: 'pas', desc: '受到的傷害 - 等級÷8。', taken: function (p, dmg) { return Math.max(0, dmg - Math.floor(LV(p) / 8) * (mast(p, 'awp_guard') ? 2 : 1)); } });
  add('paladin', 'grace', { n: '神聖恩典', tier: '英雄', lv: 60, k: 'act', mp: 30, cd: 30, ctrl: true, desc: '為隊伍中 HP 比例最低的成員（自己、隊長、傭兵、寵物、召喚物、守衛）立即回復最大 HP 20%，之後 8 秒內自己的藥水回復量 +30%；昏迷中也能用。',
    can: function (p) { var t = healPick(p); return !!t && t.pct < 0.6; }, run: function (p) { var t = healPick(p); healAny(p, t ? t.m : p, 0.2); st(p).buf.grace = now() + 8; return true; } });
  add('paladin', 'cross', { n: '神聖十字架', tier: '英雄', lv: 65, k: 'pas', desc: '每 6 秒落下光之十字架，範圍 120%。盾 +0～4 落 1 個、+5～8 落 2 個、+9 以上落 3 個。',
    tick: function (p) { var S = st(p); if (N(S.cd.cross) > now()) return; var t = target(); if (!t) return; S.cd.cross = now() + 6; var e = Math.max(0, offEn(p)), n = !hasOff(p) ? 1 : e >= 9 ? 3 : e >= 5 ? 2 : 1; for (var i = 0; i < n; i++) near(t, 4).forEach(function (x) { deal(p, x, 1.2, { magic: true, src: 'cross', color: '#fef9c3', show: i === 0 }); }); } });
  add('paladin', 'stun2', { n: '絕世衝暈', tier: '英雄', lv: 70, k: 'pas', desc: '昏迷命中 +8；神聖衝暈昏迷 2 → 2.5 秒。' });
  add('paladin', 'raid2', { n: '神聖狂襲（預言）', tier: '英雄', lv: 75, k: 'pas', desc: '神聖狂襲改成每 2 次攻擊判定一次，機率 50%。' });

  // ============================================================== 魔劍士 ==
  //   LFE（生命）＝體質＋等級÷5
  var LFE = function (p) { return Math.floor((N(p.d && p.d.con) + Math.floor(LV(p) / 5)) * (mast(p, 'awr_life') ? 1.2 : 1) * modsMul('lfeMult', p)); };
  var adaptMax = function (p) { var l = LV(p); return l >= 70 ? 7 : l >= 45 ? 5 : 3; };
  add('runeblade', 'master', { n: '符石精通', tier: '一般', lv: 1, k: 'pas', desc: '拿單手劍（都算符石劍）時，近距離傷害 + LFE÷10。LFE＝體質＋等級÷5。',
    stat: function (p, d) { if (wpnFam(p) === '單手劍') d.meleeDmg += Math.floor(LFE(p) / 10); } });
  add('runeblade', 'speed', { n: '以太推進', tier: '一般', lv: 5, k: 'pas', desc: '二段加速：攻速 +25%。', stat: function (p, d) { d.atkSpdPct += 25; } });
  add('runeblade', 'life', { n: '以太防禦', tier: '一般', lv: 10, k: 'pas', desc: '最大 HP + 等級×3。', hp: function (p) { return LV(p) * 3; } });
  add('runeblade', 'weapon', { n: '以太武器', tier: '一般', lv: 15, k: 'pas', desc: '攻擊適應：連續攻擊同一目標，每 3 下升 1 階（每階近距離命中 +1、近距離傷害 +1）。上限 Lv15 是 3 階、Lv45 是 5 階、Lv70 是 7 階；換目標歸零。',
    hit: function (p, t) { var S = st(p); if (S.cnt.adT !== t) { S.cnt.adT = t; S.cnt.adHits = 0; S.cnt.adapt = 0; } S.cnt.adHits = N(S.cnt.adHits) + 1; var lv = Math.min(adaptMax(p), Math.floor(S.cnt.adHits / (mast(p, 'awr_adapt') ? 2 : 3))); if (lv !== S.cnt.adapt) { S.cnt.adapt = lv; S.dirty = true; } },
    stat: function (p, d) { var a = N(st(p).cnt.adapt); d.meleeHit += a; d.meleeDmg += a; } });
  add('runeblade', 'phalanx', { n: '方陣', tier: '一般', lv: 20, k: 'pas', desc: '防禦適應：每次被打升 1 階（每階傷害減免 +1），上限同以太武器；5 秒沒被打就歸零。',
    taken: function (p, dmg) { var S = st(p); S.cnt.defAt = now(); var v = Math.min(adaptMax(p), N(S.cnt.def) + 1); if (v !== S.cnt.def) { S.cnt.def = v; S.dirty = true; } return dmg; },
    tick: function (p) { var S = st(p); if (N(S.cnt.def) > 0 && now() - N(S.cnt.defAt) > 5) { S.cnt.def = 0; S.dirty = true; } },
    stat: function (p, d) { var a = N(st(p).cnt.def); d.dr += a; if (has(p, 'runeblade', 'phalanx2')) { d.er += a; d.mr += a; } } });
  add('runeblade', 'strike', { n: '符石打擊', tier: '一般', lv: 25, k: 'pas', desc: '攻擊時有 12% 機率追加 60% 傷害。', hit: function (p, t) { if (chance(0.12)) deal(p, t, 0.6, { src: 'rstrike' }); } });
  add('runeblade', 'burst', { n: '符石爆裂', tier: '一般', lv: 28, k: 'act', mp: 20, cd: 5, desc: '造成 100% + LFE×3 的魔法傷害。',
    run: function (p, t) { var api = R(); deal(p, t, (1.0 + LFE(p) * 3 / Math.max(1, base(p))) * (has(p, 'runeblade', 'burst2') ? 1.6 : 1), { magic: true, src: 'rburst', color: '#86efac' }); if (mast(p, 'awr_rune')) deal(p, t, 1.0 + LFE(p) * 3 / Math.max(1, base(p)), { magic: true, src: 'rburst', show: false }); if (has(p, 'runeblade', 'cycle')) heal(p, LFE(p) * 2); return true; } });
  add('runeblade', 'cycle', { n: '生命期', tier: '一般', lv: 30, k: 'pas', desc: '用符石爆裂或沙子風暴時，回復 LFE×2 的 HP。' });
  add('runeblade', 'stun', { n: '符石昏迷', tier: '一般', lv: 33, k: 'act', mp: 20, cd: 12, desc: '昏迷 2 秒（王改成易傷）。', run: function (p, t) { stun(p, t, 2); return true; } });
  add('runeblade', 'armor', { n: '以太盔甲', tier: '一般', lv: 36, k: 'pas', desc: 'AC -3；副手每 +1，傷害減免 +0.5，最多 +5。', stat: function (p, d) { d.ac -= 3; if (hasOff(p)) d.dr += Math.min(5, Math.max(0, offEn(p)) * 0.5); } });
  add('runeblade', 'illusion', { n: '幻覺反擊', tier: '一般', lv: 40, k: 'pas', desc: '連續迴避 2 次時，幻影反擊一次，造成 200% 傷害。',
    evade: function (p, m) { var S = st(p); S.cnt.ev = N(S.cnt.ev) + 1; if (S.cnt.ev >= Math.max(1, (mast(p, 'awr_ill') ? 1 : 2) - N(W.__awkIllMinus && W.__awkIllMinus(p)))) { S.cnt.ev = 0; var t = alive(m) ? m : target(); if (t) deal(p, t, 2.0 * (has(p, 'runeblade', 'illusion2') ? 1.75 : 1), { src: 'illusion' }); } },
    taken: function (p, dmg) { if (dmg > 0) st(p).cnt.ev = 0; return dmg; } });
  add('runeblade', 'sand', { n: '沙子風暴', tier: '一般', lv: 43, k: 'pas', desc: '攻擊時有 10% 機率捲起沙塵暴，打周圍範圍 120%。',
    hit: function (p, t) { if (chance(0.10)) { near(t, 5).forEach(function (x) { deal(p, x, 1.2, { src: 'sand', show: false }); }); if (has(p, 'runeblade', 'cycle')) heal(p, LFE(p) * 2); } } });
  add('runeblade', 'sonic', { n: '聲波刀刃', tier: '一般', lv: 45, k: 'act', mp: 15, cd: 8, desc: '造成 150% 傷害；30% 機率再打 1 次。',
    run: function (p, t) { var n = has(p, 'runeblade', 'super') ? Math.min(4, 1 + Math.floor(LFE(p) / 100)) : 1; for (var i = 0; i < n; i++) deal(p, t, 1.5, { src: 'sonic' }); if (chance(0.3)) deal(p, t, 1.5, { src: 'sonic' }); return true; } });
  add('runeblade', 'super', { n: '超級聲波', tier: '英雄', lv: 55, k: 'pas', desc: '聲波刀刃連打次數 = 1 + LFE÷100，最多 4 次。' });
  add('runeblade', 'trinity', { n: '三位一體', tier: '英雄', lv: 60, k: 'act', mp: 30, cd: 20, desc: '造成 250% 傷害，接著 8 秒連擊：每次攻擊 +1 段，最多 10 段，每段傷害 +3%；打滿 10 段時目標昏迷 1.5 秒（王改成易傷）。',
    run: function (p, t) { deal(p, t, 2.5, { src: 'trinity' }); var S = st(p); S.buf.combo = now() + 8; S.cnt.combo = 0; S.cnt.comboT = t; return true; },
    hit: function (p, t) { var S = st(p); if (!buffOn(p, 'combo')) return; S.cnt.combo = Math.min(10, N(S.cnt.combo) + 1); if (S.cnt.combo === 10) { S.buf.combo = 0; stun(p, t, 1.5); pop(p, 'combo', '十連擊', '#86efac'); } } });
  add('runeblade', 'phalanx2', { n: '方陣（王牌）', tier: '英雄', lv: 65, k: 'pas', desc: '防禦適應每階再加 迴避 +1、魔防 +1。' });
  add('runeblade', 'weapon2', { n: '以太武器（王牌）', tier: '英雄', lv: 70, k: 'pas', desc: '攻擊適應每階再加 無視傷害減免 +0.5。' });
  add('runeblade', 'fly', { n: '飛劍', tier: '英雄', lv: 75, k: 'pas', desc: '攻速 +10%、昏迷技能冷卻 -2 秒。', stat: function (p, d) { d.atkSpdPct += 10; } });

  // ============================================================== 狂戰士 ==
  add('berserker', 'crush', { n: '粉碎', tier: '一般', lv: 5, k: 'pas', desc: '攻擊時有 10% 機率追加 80% 傷害。', hit: function (p, t) { if (chance(0.10)) deal(p, t, 0.8, { src: 'bcrush' }); } });
  add('berserker', 'roar', { n: '咆哮', tier: '一般', lv: 15, k: 'act', mp: 15, cd: 8, desc: '周圍範圍 120%。', run: function (p, t) { near(t, 6).forEach(function (x) { deal(p, x, 1.2, { src: 'roar' }); }); return true; } });
  add('berserker', 'body', { n: '體能強化', tier: '一般', lv: 20, k: 'pas', desc: '最大 HP + 等級×2。', hp: function (p) { return LV(p) * 2 * (has(p, 'berserker', 'body2') ? 1 : 1); } });
  add('berserker', 'speed', { n: '速度提升', tier: '一般', lv: 25, k: 'pas', desc: '二段加速：攻速 +30%。', stat: function (p, d) { d.atkSpdPct += 30; } });
  add('berserker', 'slayer', { n: '屠戮者', tier: '一般', lv: 30, k: 'pas', desc: '拿雙手斧或雙手矛也能帶盾，攻速 +10%。拿斧：8% 機率「鎧甲突襲」造成 180% 傷害並讓目標防禦 -5（5 秒）；拿矛：8% 機率「雙重靈魂」連打 2 下。武器每 +1，機率再 +0.5%。',
    stat: function (p, d) { var f = wpnFam(p); if (f === '雙手鈍器' || f === '雙手矛') d.atkSpdPct += 10; },
    hit: function (p, t) { var f = wpnFam(p), c = 0.08 + wpnEn(p) * 0.005; if (f === '雙手鈍器' && chance(c * (mast(p, 'awb_axe') ? 2 : 1))) { deal(p, t, 1.8, { src: 'raid' }); deb(t, 'acDown', 5, 5); } else if (isSpear(f) && chance(c)) { for (var k = 0; k < (mast(p, 'awb_spear') ? 3 : 2); k++) deal(p, t, 1.0, { src: 'soul2', show: k === 0 }); } } });
  add('berserker', 'warrior', { n: '戰士', tier: '一般', lv: 32, k: 'pas', desc: '近距離命中和近距離傷害各 + 力量÷10。', stat: function (p, d) { var v = Math.floor(N(d.str) / 10); d.meleeHit += v; d.meleeDmg += v; } });
  add('berserker', 'blood', { n: '力量之血', tier: '一般', lv: 35, k: 'buf', mp: 25, cd: 60, desc: '持續 60 秒：攻擊吸血，回復 3% 傷害（武器每 +1 再 +0.3%）。', run: function (p) { st(p).buf.blood = now() + 60; return true; } });
  add('berserker', 'potion', { n: '雙重藥水', tier: '一般', lv: 38, k: 'pas', desc: '喝治癒藥水時有 20% 機率效果 ×2。' });
  add('berserker', 'guard', { n: '鎧甲守衛', tier: '一般', lv: 40, k: 'pas', desc: '傷害減免 + 盾強化值÷2。', stat: function (p, d) { if (hasOff(p)) d.dr += Math.floor(Math.max(0, offEn(p)) / 2); } });
  add('berserker', 'pressure', { n: '壓力', tier: '一般', lv: 43, k: 'pas', desc: '累積受到最大 HP 30% 的傷害時反擊一次，傷害等於累積量。',
    taken: function (p, dmg, mob) { var S = st(p); S.cnt.press = N(S.cnt.press) + dmg; if (S.cnt.press >= N(p.mhp) * 0.3) { var v = S.cnt.press; S.cnt.press = 0; var t = alive(mob) ? mob : target(); var api = R(); if (t && api) { api.damage(t, Math.floor(v), { actor: p, source: 'awk:press', type: 'physical', origin: 'class', generated: true, direct: true, settle: true }); pop(p, 'press', '壓力反擊', '#fca5a5'); } } return dmg; } });
  add('berserker', 'arrow', { n: '箭矢防護', tier: '一般', lv: 45, k: 'pas', desc: '迴避 +5；受到的遠距離傷害 - 等級÷10。', stat: function (p, d) { d.er += 5; },
    taken: function (p, dmg, mob, kind) { return kind === 'ranged' ? Math.max(0, dmg - Math.floor(LV(p) / 10)) : dmg; } });
  add('berserker', 'heavy', { n: '泰坦：重擊', tier: '英雄', lv: 55, k: 'pas', desc: '攻擊無視目標傷害減免 +5。' });
  add('berserker', 'limit', { n: '力量突破', tier: '英雄', lv: 60, k: 'pas', desc: '力量 +3。', attr: function (p, d) { d.str += 3; } });
  add('berserker', 'bind', { n: '拘束移動', tier: '英雄', lv: 62, k: 'act', mp: 20, cd: 15, desc: '目標被定身 3 秒（王改成易傷），期間受到的近距離傷害 +10%。',
    run: function (p, t) { stun(p, t, 3); deb(t, 'meleeVuln', 0.10, 3); return true; } });
  add('berserker', 'axes', { n: '印地安戰斧', tier: '英雄', lv: 65, k: 'act', mp: 30, cd: 10, desc: '要拿斧。一次丟出多把斧頭，打 4 隻，各 140%。', can: function (p) { var f = wpnFam(p); return f === '雙手鈍器' || f === '單手鈍器' || f === '雙斧'; },
    run: function (p, t) { near(t, 4).forEach(function (x) { deal(p, x, 1.4, { src: 'axes' }); }); return true; } });
  add('berserker', 'body2', { n: '體能強化（上升）', tier: '英雄', lv: 70, k: 'pas', desc: '最大 HP +10%。' });

  // ============================================================ 第二期：傳說（王掉落書＋時空材料才能學）／第三期：神話（次元裂縫掉書＋次元材料）
  // 單體治療也能補別人（Ping 11-15）：隊伍受益池（玩家、傭兵、出戰寵物、召喚物、傭兵召喚物、城堡守衛）裡 HP 比例最低的
  var healPool = function (p) { try { if (typeof W.healBeneficiaries === 'function') { var a = W.healBeneficiaries(); if (a && a.length) return a; } } catch (e) {} return [p]; };
  var hpOf = function (m) { return typeof W._supHp === 'function' ? W._supHp(m) : N(m.curHp != null ? m.curHp : m.hp); };
  var mhpOf = function (m) { return typeof W._supMhp === 'function' ? W._supMhp(m) : N(m.mhp) || 1; };
  var healPick = function (p) { var best = null; healPool(p).forEach(function (m) { var mx = mhpOf(m); if (!(mx > 0)) return; var pc = hpOf(m) / mx; if (!best || pc < best.pct) best = { m: m, pct: pc }; }); return best; };
  var healAny = function (p, m, frac) {
    var amt = mhpOf(m) * frac, P0 = P();
    if (m === p || m === P0 || (P0 && (P0.allies || []).indexOf(m) >= 0)) return heal(m, amt);
    var b = hpOf(m); if (typeof W._supHeal === 'function') W._supHeal(m, Math.floor(amt)); else m.hp = Math.min(mhpOf(m), N(m.hp) + Math.floor(amt)); return hpOf(m) - b;
  };
  var areaHeal = function (p, frac) { [p].concat((p === P() ? (p.allies || []) : [])).forEach(function (a) { if (a && !a._downed && !a.dead) heal(a, N(a.mhp) * frac); }); };
  // 雷神
  add('thunder', 'plasma2', { n: '等離子電場', tier: '傳說', lv: 80, k: 'act', mp: 30, cd: 60, ctrl: true, desc: '解除自己的昏迷、凍結等控制，回復 20% HP，5 秒內受到的傷害 -50%；昏迷中也能放。',
    can: function (p) { return controlled(p) || N(p.hp) < N(p.mhp) * 0.5; },
    run: function (p) { var z = p.statuses || {}; ['stun', 'freeze', 'stone', 'sleep', 'paralyze'].forEach(function (k) { if (z[k]) z[k] = 0; }); heal(p, N(p.mhp) * 0.2); st(p).buf.plasma = now() + 5; return true; },
    taken: function (p, dmg) { return buffOn(p, 'plasma') ? dmg * 0.5 : dmg; } });
  add('thunder', 'valkyrie', { n: '女武神', tier: '傳說', lv: 80, k: 'pas', desc: '拿矛時鎖鏈閃光再多打 1 隻；雷電昏迷、鎖鏈閃光的傷害 +20%，攻擊無視傷害減免 5。',
    stat: function (p, d) { d.meleeHit += 5; } });
  add('thunder', 'flash2', { n: '雷電一閃（神秘）', tier: '傳說', lv: 80, k: 'pas', desc: '雷電一閃依目標失去的 HP 比例追加最多 200% 傷害；擊殺目標時雷電一閃冷卻重置。' });
  add('thunder', 'overload2', { n: '超載充能（神秘）', tier: '傳說', lv: 80, k: 'pas', desc: '超載充能持續 10 → 15 秒、爆擊再 +5%；發動時雷電昏迷冷卻重置。' });
  add('thunder', 'tempest', { n: '暴風雨', tier: '神話', lv: 90, k: 'act', mp: 50, cd: 30, desc: '在全場每隻敵人身上疊 1 層閃電標誌，並落下 3 道雷，各造成 150% 雷擊。',
    run: function (p, t) { near(t, 8).forEach(function (x) { mark(p, x, 1); for (var i = 0; i < 3; i++) deal(p, x, 1.5, { magic: true, ele: 'wind', src: 'tempest', show: i === 0 }); }); return true; } });
  add('thunder', 'ragnarok', { n: '諸神黃昏', tier: '神話', lv: 90, k: 'act', mp: 60, cd: 45, desc: '對目標造成 600% 雷擊並昏迷 3 秒（王改成易傷）；周圍 3 隻敵人陷入恐懼，造成的傷害 -20%，持續 8 秒。',
    run: function (p, t) { deal(p, t, 6.0, { magic: true, ele: 'wind', src: 'ragnarok' }); stun(p, t, 3); near(t, 4).slice(1).forEach(function (x) { deb(x, 'weak', 0.2, 8); }); return true; } });
  // 暗黑騎士
  add('darkknight', 'mimic', { n: '變形怪王', tier: '傳說', lv: 80, k: 'buf', mp: 40, cd: 120, desc: '30 秒內攻速 +20%；攻擊有 12% 機率發出衝擊波浪，打目標與周圍 2 隻各 200%，並回復造成傷害的 10%。',
    run: function (p) { st(p).buf.mimic = now() + 30; return true; }, stat: function (p, d) { if (buffOn(p, 'mimic')) d.atkSpdPct += 20; },
    hit: function (p, t) { if (buffOn(p, 'mimic') && chance(0.12)) { var sum = 0; near(t, 3).forEach(function (x) { sum += deal(p, x, 2.0, { magic: true, src: 'wave' }); }); heal(p, sum * 0.1); } } });
  add('darkknight', 'stun2', { n: '暗黑之暈（復仇者）', tier: '傳說', lv: 80, k: 'pas', desc: '暗黑之暈的傷害減免下降 10% → 20%，持續 6 → 8 秒。' });
  add('darkknight', 'illusion', { n: '幻覺', tier: '傳說', lv: 80, k: 'act', mp: 30, cd: 90, ctrl: true, desc: 'HP 低於 40% 時召喚幻影分身：回復 25% HP，5 秒內受到的傷害 -60%；昏迷中也能放。',
    can: function (p) { return N(p.hp) < N(p.mhp) * 0.4; }, run: function (p) { heal(p, N(p.mhp) * 0.25); st(p).buf.phantom = now() + 5; return true; },
    taken: function (p, dmg) { return buffOn(p, 'phantom') ? dmg * 0.4 : dmg; } });
  add('darkknight', 'dk2', { n: '黑暗騎士（復仇者）', tier: '傳說', lv: 80, k: 'pas', desc: '黑暗騎士的魔法追加 ×2；攻速 +5%。', stat: function (p, d) { d.atkSpdPct += 5; } });
  add('darkknight', 'calypso', { n: '卡呂普索', tier: '神話', lv: 90, k: 'act', mp: 60, cd: 40, desc: '召喚隕石，對全場造成 500% 暗屬性魔法傷害，敵人 8 秒內造成的傷害 -15%。',
    run: function (p, t) { near(t, 8).forEach(function (x) { deal(p, x, 5.0, { magic: true, src: 'calypso' }); deb(x, 'weak', 0.15, 8); }); return true; } });
  add('darkknight', 'myth_barrier', { n: '復仇屏障（黑魔王）', tier: '神話', lv: 90, k: 'pas', desc: '復仇屏障迴避率再 +4%，復仇之劍傷害 ×2；迴避時 15% 機率對周圍 2 隻造成 150%。',
    evade: function (p, m) { if (chance(0.15)) near(alive(m) ? m : target(), 2).forEach(function (x) { deal(p, x, 1.5, { magic: true, src: 'undead' }); }); } });
  // 神聖劍士
  add('paladin', 'stun3', { n: '神聖衝暈（預言）', tier: '傳說', lv: 80, k: 'pas', desc: '神聖衝暈多 1 秒；暈住的目標受到的近距離傷害 +15%。' });
  add('paladin', 'chaser', { n: '神聖追趕者', tier: '傳說', lv: 80, k: 'act', mp: 25, cd: 20, desc: '瞬間衝向目標，造成 300% 光屬性傷害並昏迷 1 秒（王改成易傷）。',
    run: function (p, t) { deal(p, t, 3.0, { magic: true, src: 'chaser', color: '#fef9c3' }); stun(p, t, 1); return true; } });
  add('paladin', 'recover2', { n: '神聖回復（預言）', tier: '傳說', lv: 80, k: 'pas', desc: '迴避 +5；神聖回復冷卻 3 → 1.5 秒。', stat: function (p, d) { d.er += 5; } });
  add('paladin', 'ench3', { n: '附魔武器：狂襲 Lv3', tier: '傳說', lv: 80, iconName: '附魔武器：狂襲 Lv3', k: 'pas', desc: '附魔武器：狂襲 Lv1 的機率 8% → 15%，傷害 ×2，無視魔防。' });
  add('paladin', 'sanction', { n: '神聖制裁', tier: '神話', lv: 90, k: 'act', mp: 60, cd: 40, desc: '召喚魔法陣：全隊回復 20% HP；目標受到 400% 光屬性傷害並昏迷 2 秒（王改成易傷）。',
    run: function (p, t) { areaHeal(p, 0.2); deal(p, t, 4.0, { magic: true, src: 'sanction', color: '#fef9c3' }); stun(p, t, 2); return true; } });
  add('paladin', 'avatar', { n: '化身', tier: '神話', lv: 90, k: 'buf', mp: 50, cd: 120, desc: '30 秒內攻速 +15%；一般攻擊削減目標 MP，5% 機率「懲罰」讓目標昏迷 2 秒（王改成易傷）。',
    run: function (p) { st(p).buf.avatar = now() + 30; return true; }, stat: function (p, d) { if (buffOn(p, 'avatar')) d.atkSpdPct += 15; },
    hit: function (p, t) { if (!buffOn(p, 'avatar')) return; if (N(t.mp) > 0) t.mp = Math.max(0, N(t.mp) - 20); if (chance(0.05)) stun(p, t, 2); } });
  // 魔劍士
  add('runeblade', 'flow', { n: '生命流', tier: '傳說', lv: 80, k: 'act', mp: 40, cd: 45, desc: '回復全隊 LFE×20 的 HP。', can: function (p) { return N(p.hp) < N(p.mhp) * 0.8; },
    run: function (p) { [p].concat(p === P() ? (p.allies || []) : []).forEach(function (a) { if (a && !a._downed) heal(a, LFE(p) * 20); }); return true; } });
  add('runeblade', 'illusion2', { n: '幻覺反擊（傳說）', tier: '傳說', lv: 80, k: 'pas', desc: '幻覺反擊的傷害 200% → 350%。' });
  add('runeblade', 'burst2', { n: '符石爆裂（王牌）', tier: '傳說', lv: 80, k: 'pas', desc: '符石爆裂的傷害 ×1.6。' });
  add('runeblade', 'master2', { n: '符石精通（傳說）', tier: '傳說', lv: 80, k: 'pas', desc: '符石精通的近距離傷害改成 LFE÷6；攻擊無視傷害減免 5。',
    stat: function (p, d) { if (wpnFam(p) === '單手劍') d.meleeDmg += Math.floor(LFE(p) / 6) - Math.floor(LFE(p) / 10); } });
  add('runeblade', 'dance', { n: '刀劍飛舞', tier: '神話', lv: 90, k: 'act', mp: 50, cd: 35, desc: '連斬 6 下，每下 100% + LFE×2，目標定身 3 秒（王改成易傷）。',
    run: function (p, t) { for (var i = 0; i < 6; i++) deal(p, t, 1.0 + LFE(p) * 2 / Math.max(1, base(p)), { src: 'dance', show: i === 0 }); stun(p, t, 3); return true; } });
  add('runeblade', 'myth_strike', { n: '符石打擊（神話）', tier: '神話', lv: 90, k: 'pas', desc: '攻擊時 5% 機率召喚符石魔法陣，對周圍 3 隻造成 250% 並昏迷 1 秒（王改成易傷）。',
    hit: function (p, t) { if (chance(0.05)) near(t, 3).forEach(function (x) { deal(p, x, 2.5, { magic: true, src: 'runecircle' }); stun(p, x, 1); }); } });
  // 狂戰士
  add('berserker', 'outlaw', { n: '亡命之徒', tier: '傳說', lv: 80, k: 'act', mp: 25, cd: 20, desc: '擲出斧頭把目標拉過來，造成 300% 傷害；目標 10 秒內受到的近距離傷害 +15%。',
    run: function (p, t) { deal(p, t, 3.0, { src: 'outlaw' }); deb(t, 'meleeVuln', 0.15, 10); return true; } });
  add('berserker', 'crisis', { n: '泰坦：危急', tier: '傳說', lv: 80, iconName: '泰坦：危急', k: 'pas', desc: '近距離爆擊 +5%；攻擊時 3% 機率粉碎護盾，追加 100% 傷害。',
    stat: function (p, d) { d.meleeCrit += 5; }, hit: function (p, t) { if (chance(0.03)) deal(p, t, 1.0, { src: 'shatter' }); } });
  add('berserker', 'gaia', { n: '蓋亞', tier: '傳說', lv: 80, k: 'act', mp: 30, cd: 60, ctrl: true, desc: 'HP 低於 50% 時：立即回復 20% HP，之後 10 秒每秒再回 2%；昏迷中也能放。',
    can: function (p) { return N(p.hp) < N(p.mhp) * 0.5; }, run: function (p) { heal(p, N(p.mhp) * 0.2); st(p).buf.gaia = now() + 10; return true; },
    tick: function (p) { var S = st(p); if (buffOn(p, 'gaia') && now() - N(S.cnt.gaiaAt) >= 1) { S.cnt.gaiaAt = now(); heal(p, N(p.mhp) * 0.02); } } });
  add('berserker', 'heart', { n: '燃燒之心', tier: '傳說', lv: 80, k: 'pas', desc: '受到致命傷害時保留 1 HP，5 秒內不會倒下，期間近距離傷害 + 最大 HP 的 1%（每 120 秒一次）。',
    taken: function (p, dmg) { var S = st(p); if (buffOn(p, 'heart')) return Math.min(dmg, Math.max(0, N(p.hp) - 1)); if (dmg >= N(p.hp) && N(S.cd.heart) <= now()) { S.cd.heart = now() + 120; S.buf.heart = now() + 5; pop(p, 'heart', '燃燒之心', '#f87171'); try { recomputeStats(); } catch (e) {} return Math.max(0, N(p.hp) - 1); } return dmg; },
    stat: function (p, d) { if (buffOn(p, 'heart')) d.meleeDmg += Math.floor(N(p.mhp) * 0.01); } });
  add('berserker', 'titanstun', { n: '泰坦之暈', tier: '神話', lv: 90, k: 'act', mp: 40, cd: 30, desc: '造成 400% 傷害並昏迷 3 秒（王改成易傷），回復 10% HP。',
    run: function (p, t) { deal(p, t, 4.0, { src: 'titanstun' }); stun(p, t, 3); heal(p, N(p.mhp) * 0.1); return true; } });
  add('berserker', 'golden', { n: '黃金盔甲', tier: '神話', lv: 90, k: 'buf', mp: 50, cd: 90, desc: '15 秒內受到的傷害 -40%，被打時反擊 50% 傷害。',
    run: function (p) { st(p).buf.golden = now() + 15; return true; },
    taken: function (p, dmg, mob) { if (!buffOn(p, 'golden')) return dmg; if (alive(mob)) { var api = R(); if (api) api.damage(mob, Math.floor(dmg * 0.5), { actor: p, source: 'awk:golden', type: 'physical', origin: 'class', generated: true, direct: true, settle: true }); } return dmg * 0.6; } });

  // ── 掛進 DB ──
  var LABEL = { act: '主動', pas: '被動', buf: '增益' };
  var LEG_COST = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'].map(function (id) { return [id, 300]; });
  var MYTH_COST = [['afk_dim_xcrystal', 500], ['afk_rift_shard', 1000]];   // 11-18 19:18 Ping：異化次元結晶 500＋裂縫碎光 1,000
  var BOOK_P = function (lv) { return Math.round((5000 + lv * lv * 120) / 1000) * 1000; };
  Object.keys(SK).forEach(function (id) {
    var s = SK[id], c = CLS[s.cls];
    DB.skills[id] = { n: s.n, type: s.k === 'act' ? 'atk' : s.k === 'buf' ? 'buff' : 'passive', dmgType: 'physical', label: LABEL[s.k], tier: 1, awAct: s.k !== 'pas', awCls: s.cls, awLv: s.lv, awTier: s.tier, mp: s.mp || 0, img: s.img,
      desc: s.desc + (s.k === 'act' ? '（MP ' + s.mp + '，冷卻 ' + s.cd + ' 秒，自動施放）' : s.k === 'buf' ? '（MP ' + s.mp + '，自動維持）' : '') };
    var bk = 'bk_aw_' + s.cls + '_' + s.key;
    DB.items[bk] = { type: 'skillbk', n: c.n + '技能書(' + s.n + ')', p: s.tier === '一般' ? BOOK_P(s.lv) : 0, sk: id, gachaWeight: 0, img: s.img, noShop: true,
      d: '覺醒職業「' + c.n + '」的' + s.tier + '技能書。' + ({ 一般: '席琳神殿的覺醒導師有賣。', 英雄: '由王掉落。', 傳說: '由王掉落；學習時另外消耗轉生用時空材料六種各 300。', 神話: '只有次元裂縫難度的副本會掉落；學習時另外消耗異化次元結晶 500、裂縫碎光 1,000。' }[s.tier] || '') };
    if (s.tier === '傳說') DB.items[bk].awCost = LEG_COST; else if (s.tier === '神話') DB.items[bk].awCost = MYTH_COST;
    s.book = bk;
  });
  try { if (typeof createBase !== 'undefined') Object.keys(CLS).forEach(function (k) { var a = CLS[k].start; createBase[k] = { str: a.str, dex: a.dex, con: a.con, int: a.int, wis: a.wis, cha: a.cha, pts: a.pts }; }); } catch (e) {}
  try { if (typeof ATK_AV_BY_CLS !== 'undefined') Object.keys(CLS).forEach(function (k) { ATK_AV_BY_CLS[k] = CLS[k].av[0]; }); } catch (e) {}
  try { if (typeof CLAN_CLASS_NAMES !== 'undefined') Object.keys(CLS).forEach(function (k) { if (!CLAN_CLASS_NAMES[k]) CLAN_CLASS_NAMES[k] = CLS[k].n; }); } catch (e) {}

  // 英雄技能書：Lv60～80 的王（Ping 再挑）
  var HERO_DROP = {
    thunder: { flash: '冥法軍王海露拜', overload: '巴列斯', guard: '冰魔', mark2: '冰之女王', bolt2: '不滅的巫妖', chain2: '不死鳥' },
    darkknight: { barrier: '暗殺軍王史雷佛', eye: '地獄的黑豹', hand: '恐怖的吸血鬼', nether: '闇黑的騎士范德', soul2: '邪惡的鐮刀死神' },
    paladin: { unity: '巴風特', protect: '死亡騎士', grace: '不死的木乃伊王', cross: '底比斯 阿努比斯', stun2: '底比斯 賀洛斯', raid2: '法令軍王蕾雅' },
    runeblade: { super: '變形怪首領', trinity: '古代巨人', phalanx2: '冷酷的艾莉絲', weapon2: '長老．琪娜', fly: '不幸的幻象眼魔' },
    berserker: { heavy: '魔獸軍王巴蘭卡', limit: '喀瑪王', bind: '巨蟻女皇', axes: '克特', body2: '墮落' }
  };
  var HERO_RATE = 2;   // %
  try {
    if (typeof MOB_DROPS !== 'undefined') Object.keys(HERO_DROP).forEach(function (c) { Object.keys(HERO_DROP[c]).forEach(function (k) { var boss = HERO_DROP[c][k], bk = 'bk_aw_' + c + '_' + k; if (!DB.items[bk]) return; var row = MOB_DROPS[boss] || (MOB_DROPS[boss] = []); if (!row.some(function (e) { return e[0] === bk; })) row.push([bk, HERO_RATE]); }); });
  } catch (e) { console.warn('[AFK-awaken] drops', e); }

  // 傳說技能書：Lv80 以上的王（1%）
  var LEG_DROP = {
    thunder: { plasma2: '林德拜爾', valkyrie: '長老．泰瑪斯', flash2: '長老．安迪斯', overload2: '林德拜爾' },
    darkknight: { mimic: '吉爾塔斯', stun2: '被侵蝕的狂怒安塔瑞斯', illusion: '長老．巴塔斯', dk2: '巨大骷髏' },
    paladin: { stun3: '法利昂', chaser: '長老．拉曼斯', recover2: '長老．巴洛斯', ench3: '真‧死亡騎士 冥皇丹特斯' },
    runeblade: { flow: '長老．巴陸德', illusion2: '牛鬼', burst2: '被侵蝕的安塔瑞斯', master2: '白面金毛九尾狐・殺生石' },
    berserker: { outlaw: '安塔瑞斯', crisis: '巴拉卡斯', gaia: '被侵蝕的瘋狂安塔瑞斯', heart: '巴拉卡斯' }
  };
  try {
    if (typeof MOB_DROPS !== 'undefined') Object.keys(LEG_DROP).forEach(function (c) { Object.keys(LEG_DROP[c]).forEach(function (k) { var boss = LEG_DROP[c][k], bk = 'bk_aw_' + c + '_' + k; if (!DB.items[bk]) return; var row = MOB_DROPS[boss] || (MOB_DROPS[boss] = []); if (!row.some(function (e) { return e[0] === bk; })) row.push([bk, 1]); }); });
  } catch (e) {}
  // 掉落查詢：一般技能書（覺醒導師賣）、神話技能書（程式發的）不在掉落表 → 登記取得方式（Ping 11-15 上線檢查）
  var dexReg = function () {
    var X = W.AFK_DEX_EXTRA; if (!X || !X.acq) return;
    Object.keys(SK).forEach(function (id) {
      var sk = SK[id], bk = sk.book; if (!bk || !DB.items[bk] || X.acquire[bk]) return;
      if (sk.tier === '一般') X.acq(bk, '席琳神殿「覺醒導師 伊瑟拉」販售（' + (DB.items[bk].p || 0).toLocaleString() + ' 金幣）。');
      else if (sk.tier === '神話') X.acq(bk, '次元裂縫難度的副本（次元裂縫的多人副本、單人副本的次元裂縫難度）：王 1%、一般怪 0.01%（覺醒職業掉自己職業的書）；也可以在覺醒導師用失去光芒的覺醒職業 神話法術書 10 本＋神話技能秘笈 1 本兌換。學習時另外消耗異化次元結晶 500、裂縫碎光 1,000。');
      else if (sk.tier === '傳說') X.acq(bk, '由王掉落（見掉落查詢）；也可以在覺醒導師用失去光芒的覺醒職業 神話法術書 10 本＋傳說技能秘笈 1 本兌換。學習時另外消耗時空材料六種各 300。');
    });
  };
  if (document.readyState === 'complete') setTimeout(dexReg, 0); else W.addEventListener('load', dexReg);
  // 神話技能書：只有次元裂縫的副本會掉（裂縫多人副本、單人副本的次元裂縫難度；王 1%、一般 0.01%）；覺醒職業掉自己職業的，其他人隨機（Ping 11-14 23:37：野外裂縫不再掉）
  var MYTH_BOOKS = Object.keys(SK).filter(function (id) { return SK[id].tier === '神話'; }).map(function (id) { return SK[id].book; });
  if (typeof W.killMob === 'function') {
    var oKillM = W.killMob;
    W.killMob = function (idx) {
      var m = typeof mapState !== 'undefined' && mapState.mobs ? mapState.mobs[idx] : null, was = !!(m && m._dead);
      var r = oKillM.apply(this, arguments);
      try {
        if (m && !was && m._dead && (m._rd || (m._solo && typeof W.__afkDimRiftOn === 'function' && W.__afkDimRiftOn())) && Math.random() < ((m.boss || m._rdBoss || m._nzBoss) ? 0.01 : 0.0001)) {
          var p = P(), pool = MYTH_BOOKS.filter(function (b) { return !isAw(p) || b.indexOf('bk_aw_' + p.cls + '_') === 0; });
          var bk = pool[Math.floor(Math.random() * pool.length)]; if (bk) { gainItem(bk, 1, true, true); sys('<span class="text-fuchsia-300 font-bold">🌀 副本掉落：' + esc(DB.items[bk].n) + '</span>'); }
        }
      } catch (e) {}
      return r;
    };
  }
  // 傳說、神話技能書：學的時候另外扣材料（材料不夠就不讓用）
  var invCount = function (p, id) { return (p.inv || []).reduce(function (a, it) { return a + (it && it.id === id && !it.lock ? Math.max(1, N(it.cnt)) : 0); }, 0); };
  var invTake = function (p, id, n) { for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); } };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }), d = it && DB.items[it.id];
      if (d && d.awCost && p) {
        if (p.skills && p.skills.indexOf(d.sk) >= 0) return oUse.apply(this, arguments);
        if (skillReqLv(DB.skills[d.sk], d.sk) == null || LV(p) < skillReqLv(DB.skills[d.sk], d.sk)) return oUse.apply(this, arguments);   // 職業或等級不符：交給核心顯示原本的訊息
        try { var MW = W.__afkMatWh; if (MW && MW.on && MW.on()) d.awCost.forEach(function (x) { var lack = x[1] - invCount(p, x[0]); if (lack > 0) try { MW.pull(x[0], lack); } catch (e) {} }); } catch (e) {}
        var miss = d.awCost.filter(function (x) { return invCount(p, x[0]) < x[1]; }).map(function (x) { return ((DB.items[x[0]] || {}).n || x[0]) + ' ' + invCount(p, x[0]).toLocaleString() + '/' + x[1].toLocaleString(); });
        if (miss.length) { sys('<span class="text-amber-300">學習「' + esc(DB.skills[d.sk].n) + '」還缺：' + esc(miss.join('、')) + '</span>'); return; }
        var before = (p.skills || []).length, r = oUse.apply(this, arguments);
        if ((p.skills || []).length > before) d.awCost.forEach(function (x) { invTake(p, x[0], x[1]); });
        return r;
      }
      return oUse.apply(this, arguments);
    };
  }

  // 職業精通（威頓村 漢，打飛龍後四選一）
  var MAST = {
    thunder: { awt_mark: ['雷電精通', 'top', '閃電標誌疊 2 層就觸電'], awt_chain: ['鎖鏈精通', 'left', '鎖鏈閃光再多打 2 隻'], awt_valk: ['女武神精通', 'right', '拿矛時攻速再 +15%'], awt_mag: ['電磁精通', 'bottom', '雷神技能的 MP 消耗 -30%'] },
    berserker: { awb_axe: ['斧精通', 'top', '鎧甲突襲的機率 ×2'], awb_spear: ['矛精通', 'left', '雙重靈魂改成連打 3 下'], awb_titan: ['泰坦精通', 'right', 'HP 低於 40% 時受到的傷害 -10'], awb_blood: ['血之精通', 'bottom', '力量之血的吸血 ×2'] },
    paladin: { awp_stun: ['衝暈精通', 'top', '神聖衝暈冷卻 -4 秒'], awp_guard: ['守護精通', 'left', '神聖保護的減傷 ×2'], awp_raid: ['狂襲精通', 'right', '神聖狂襲的傷害 ×1.5'], awp_bless: ['祝福精通', 'bottom', '團結的經驗加成上限 12% → 18%'] },
    darkknight: { awk_rev: ['復仇精通', 'top', '復仇屏障的迴避率 +4%'], awk_wave: ['劍氣精通', 'left', '暗黑之劍的劍氣變成打 2 隻'], awk_imp: ['使魔精通', 'right', '虛空的使魔出現機率 ×2'], awk_dark: ['黑暗精通', 'bottom', '黑暗騎士的魔法追加 ×2'] },
    runeblade: { awr_adapt: ['適應精通', 'top', '攻擊適應每 2 下升一階'], awr_rune: ['符石精通', 'left', '符石爆裂多打 1 次'], awr_ill: ['幻影精通', 'right', '迴避 1 次就發動幻覺反擊'], awr_life: ['生命精通', 'bottom', 'LFE +20%'] }
  };
  try {
    if (typeof MASTERY_DATA !== 'undefined') Object.keys(MAST).forEach(function (c) {
      var list = {}; Object.keys(MAST[c]).forEach(function (id) { var m = MAST[c][id]; list[id] = { n: m[0], pos: m[1], msg: m[2], d: m[2] + '。' }; });
      var first = Object.keys(SK).find(function (id) { return SK[id].cls === c; });
      MASTERY_DATA[c] = { logo: SK[first].img, boss: '飛龍', list: list };
    });
  } catch (e) { console.warn('[AFK-awaken] mastery', e); }
  H_TITAN = function (p, dmg) { return p.cls === 'berserker' && mast(p, 'awb_titan') && N(p.hp) < N(p.mhp) * 0.4 ? Math.max(0, dmg - 10) : dmg; };

  // ── 學習條件 ──
  if (typeof W.skillReqLv === 'function') {
    var oReq = W.skillReqLv;
    W.skillReqLv = function (sk, id) {
      var p = P(); if (sk && sk.awCls) return p && p.cls === sk.awCls ? sk.awLv : undefined;
      if (isAw(p)) return KEEP[id] != null ? KEEP[id] : undefined;   // 覺醒後只能學日光術、迷魅術
      return oReq.apply(this, arguments);
    };
  }
  // 熱鍵、技能設定「攻擊技能」、自動輔助都會叫 castSkill → 核心的 castSkillInner；覺醒技能在這裡接走
  if (typeof W.castSkillInner === 'function') {
    var oCast = W.castSkillInner;
    W.castSkillInner = function (id) {
      var sk = DB.skills[id]; if (!(sk && sk.awCls)) return oCast.apply(this, arguments);
      var p = P(); if (!p) return false;
      var r = castNow(p, id, null, true);
      if (r !== true && !(typeof _autoCastNow !== 'undefined' && _autoCastNow)) sys('<span class="text-slate-400">' + esc(sk.n) + '：' + esc(r) + '</span>');
      return r === true;
    };
  }
  var KEEP = { sk_sunlight: 1, sk_charm: 20 };   // 覺醒後保留、也能再學：日光術、迷魅術（Ping 11-14 05:13）
  if (typeof W.classicSkillClassLabel === 'function') { var oLab = W.classicSkillClassLabel; W.classicSkillClassLabel = function () { var p = P(); return isAw(p) ? CLS[p.cls].n + '技能' : oLab.apply(this, arguments); }; }
  if (typeof W.classicSkillIsClassSkill === 'function') { var oIs = W.classicSkillIsClassSkill; W.classicSkillIsClassSkill = function (sk) { var p = P(); if (isAw(p)) return !!(sk && sk.awCls === p.cls); return oIs.apply(this, arguments); }; }

  // ── 裝備 ──
  var asBase = function (p, fn) {   // 用本職身分判斷（本職裝備照樣能穿）
    var c = p.cls, av = p.avatar; p.cls = CLS[c].base; if (p.awkAvatar) p.avatar = p.awkAvatar;
    try { return fn(); } finally { p.cls = c; p.avatar = av; }
  };
  if (typeof W.checkCanEquip === 'function') {
    var oCan = W.checkCanEquip;
    W.checkCanEquip = function (item) {
      var p = P(); if (!isAw(p) || !item) return oCan.apply(this, arguments);
      var self = this, args = arguments;
      var d0 = DB.items[item.id];
      if (p.cls === 'darkknight' && d0 && d0.type === 'wpn' && !d0.isArrow && /雙刀|鋼爪/.test(fam(item.id))) return false;   // Ping 11-17：暗黑騎士不能拿雙刀、鋼爪
      if (asBase(p, function () { return oCan.apply(self, args); })) return true;
      var d = DB.items[item.id]; if (!d) return false;
      if (d.reqAvatar && d.reqAvatar !== p.awkAvatar) return false;
      if (d.type === 'wpn' && !d.isArrow) return WEAPONS[p.cls].indexOf(fam(item.id)) >= 0;
      if (d.armguard || d.slot === 'shield') return true;   // 盾、臂甲都能用
      return false;
    };
  }
  // 已經拿著雙刀、鋼爪的暗黑騎士：自動卸下放回背包（Ping 11-17）
  setInterval(function () {
    try {
      var p = P(); if (!p || p.cls !== 'darkknight' || !p.eq || !p.eq.wpn) return;
      if (!/雙刀|鋼爪/.test(fam(p.eq.wpn.id) || '')) return;
      var n = (DB.items[p.eq.wpn.id] || {}).n || '';
      if (typeof unequipItem === 'function') unequipItem('wpn');
      if (typeof logSys === 'function') logSys('<span class="text-amber-300">暗黑騎士不能使用雙刀、鋼爪，' + n + ' 已卸下放回背包。</span>');
    } catch (e) {}
  }, 5000);
  if (typeof W.effTwoHanded === 'function') {
    var oTwo = W.effTwoHanded;
    W.effTwoHanded = function (d, id) {
      var p = P(); if (p && p.cls === 'berserker' && learned(p, 'sk_aw_berserker_slayer') && d && d.type === 'wpn') { var f = fam(id || ''); if (f === '雙手鈍器' || f === '雙手矛') return false; }
      return oTwo.apply(this, arguments);
    };
  }

  // ── 數值 ──
  //   核心把不認得的職業當法師算：這裡把法師那一段換成覺醒職業自己的
  var growth = function (p, d) {
    var c = CLS[p.cls], g = c.g, lv = LV(p);
    d.mr += (g.mr0 + Math.floor(lv / g.mr)) - (15 + Math.floor(lv / 8));
    d.ac += -Math.floor(lv / g.ac) + Math.floor(lv / 8);
    d.er += Math.floor(lv / g.er) - Math.floor(lv / 10);
    d.extraDmg += Math.floor(lv / g.xd); d.extraHit += Math.floor(lv / g.xh);
    try {
      var conInc = typeof getConGrowth === 'function' ? getConGrowth(d.con, p.cls) : 0, wisInc = typeof getWisGrowth === 'function' ? getWisGrowth(d.wis) : 0;
      var conMage = typeof getConGrowth === 'function' ? getConGrowth(d.con, 'mage') : 0;
      p.mhp += (g.hp0 - 12) + (lv - 1) * ((g.hpI + conInc) - (4.3 + conMage));
      p.mmp += (g.mp0 - 6) + (lv - 1) * (g.mpI - 4.5);
    } catch (e) {}
    if (p.cls === 'thunder' && typeof getStrMeleeDmg === 'function') {   // 雷神吃智力：近距離傷害、命中用智力算
      d.meleeDmg += getStrMeleeDmg(d.int) - getStrMeleeDmg(d.str);
      if (typeof getStrMeleeHit === 'function') d.meleeHit += getStrMeleeHit(d.int) - getStrMeleeHit(d.str);
    }
    if (p.cls === 'darkknight' && typeof getStrMeleeHit === 'function') d.meleeCrit += Math.floor(Math.max(0, N(d.dex) - 12) / 6);   // 暗黑騎士：敏捷加近距離爆擊
    if (p.cls === 'paladin') { d.mpR += Math.floor(Math.max(0, N(d.wis) - 10) / 4); }
  };
  var passives = function (p, d) {
    var hp = 0;
    (p.skills || []).forEach(function (id) { var s = SK[id]; if (!s || s.cls !== p.cls) return; try { if (s.stat) s.stat(p, d, st(p)); if (s.hp) hp += s.hp(p); } catch (e) {} });
    if (has(p, 'berserker', 'body2')) hp += N(p.mhp) * 0.10;
    var xhp = modsRun('stat', p, d); if (xhp > 0) hp += xhp;
    p.mhp += hp;
  };
  if (typeof W.__afkOwnStats === 'function' || true) {
    var oOwn = W.__afkOwnStats;
    W.__afkOwnStats = function (p, d) {
      if (typeof oOwn === 'function') try { oOwn.apply(this, arguments); } catch (e) {}
      if (!isAw(p)) return;
      (p.skills || []).forEach(function (id) { var s = SK[id]; if (s && s.attr && s.cls === p.cls) try { s.attr(p, d); } catch (e) {} });
      if (p.cls === 'runeblade') d.int += Math.floor(LV(p) / 3);   // 魔劍士：智力 + 等級÷3
    };
  }
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var p0 = P(), hp0 = p0 ? N(p0.hp) : 0, mp0 = p0 ? N(p0.mp) : 0;   // 核心重算時會先用「沒有覺醒成長」的上限把 HP／MP 截掉，先記下來
      var r = oRe.apply(this, arguments), p = P();
      if (isAw(p) && !p.classicMode) {
        try { if (p === p0 && !p.dead) { p.hp = Math.max(N(p.hp), hp0); p.mp = Math.max(N(p.mp), mp0); } growth(p, p.d); passives(p, p.d); p.mhp = Math.max(1, p.mhp); p.mmp = Math.max(0, p.mmp); if (p.hp > p.mhp) p.hp = Math.floor(p.mhp); if (p.mp > p.mmp) p.mp = Math.floor(p.mmp); } catch (e) { console.warn('[AFK-awaken] stats', e); }
      }
      return r;
    };
  }
  // 魔劍士負重 + 等級÷10 %
  var hookWeight = function () { var G = W.LineageGrowth; if (!G || typeof G.weight !== 'function' || hookWeight.done) return; hookWeight.done = true; var oW = G.weight; G.weight = function (p, v) { var r = oW.apply(this, arguments); return p && p.cls === 'runeblade' ? Math.floor(r * (1 + LV(p) / 1000)) : r; }; };
  hookWeight(); W.addEventListener('load', hookWeight);

  // ── 戰鬥引擎 ──
  var ownHit = function (o) { var src = String((o && o.source) || ''); return !/^awk:/.test(src) && (!o || !o.origin || o.origin === 'normal' || o.origin === 'main'); };
  var hookProc = function () {
    var H = W.__afkProc; if (!H || hookProc.done) return false; hookProc.done = true;
    H.on('dealt', function (actor, t, v, o) {
      if (!t || !(v > 0)) return v;
      var s = MOB.has(t) ? ms(t) : null, m = 1;
      if (s && s.vuln > now()) m *= VULN;                          // 王易傷（任何人打都算）
      if (s) { var vv = debV(t, 'vuln'); if (vv) m *= 1 + vv; if ((o.kind === 'melee') && debV(t, 'meleeVuln')) m *= 1 + debV(t, 'meleeVuln'); if (debV(t, 'drDown') && o.kind !== 'magic') m *= 1 + debV(t, 'drDown'); }
      var p = actor;
      if (isAw(p) && mine(p)) {
        m *= modsMul('dealt', p, t, v, o);
        if (p.cls === 'paladin' && has(p, 'paladin', 'pray') && t.race && /不死|惡魔|黑暗/.test(String(t.race))) m *= 1.15;
        if (p.cls === 'darkknight' && has(p, 'darkknight', 'eye') && N(t.curHp) < N(t.mhp || t.hp) * 0.3 && o.kind === 'melee' && chance(0.15)) m *= 1.5;
        if (p.cls === 'runeblade' && has(p, 'runeblade', 'weapon2')) m *= 1 + N(st(p).cnt.adapt) * 0.01;
        if (p.cls === 'berserker' && has(p, 'berserker', 'heavy') && o.kind !== 'magic') m *= 1.04;
        if (buffOn(p, 'combo')) m *= 1 + N(st(p).cnt.combo) * 0.03;
        var out = v * m;
        if (o.kind === 'melee' && ownHit(o)) {
          var S0 = st(p); S0.panel = S0.panel ? S0.panel * 0.9 + v * 0.1 : v;
          if (p.cls === 'berserker' && buffOn(p, 'blood')) heal(p, out * (0.03 + wpnEn(p) * 0.003) * (mast(p, 'awb_blood') ? 2 : 1));
          if (p.cls === 'darkknight' && has(p, 'darkknight', 'soul2') && o.crit) heal(p, out * 0.15);
          modsRun('hit', p, t, out, o);
          (p.skills || []).forEach(function (id) { var s2 = SK[id]; if (s2 && s2.hit && s2.cls === p.cls) try { s2.hit(p, t, out, o, st(p)); } catch (e) { console.warn('[AFK-awaken] hit', id, e); } });
        }
        return out;
      }
      return v * m;
    });
    H.on('taken', function (ent, dmg, mob, kind) {
      if (mob && MOB.has(mob) && dmg > 0) { var wk = debV(mob, 'weak'); if (wk) dmg *= 1 - Math.min(0.6, wk); }
      var p = ent; if (!isAw(p) || !mine(p) || !(dmg > 0)) return dmg;
      var md = modsRun('taken', p, dmg, mob, kind); if (md >= 0 && md !== undefined) dmg = md;
      if (H_TITAN) dmg = H_TITAN(p, dmg);
      (p.skills || []).forEach(function (id) { var s = SK[id]; if (s && s.taken && s.cls === p.cls) try { dmg = s.taken(p, dmg, mob, kind, st(p)); } catch (e) {} });
      return dmg;
    });
    H.on('evade', function (mob) { var p = P(); if (!isAw(p)) return; (p.skills || []).forEach(function (id) { var s = SK[id]; if (s && s.evade && s.cls === p.cls) try { s.evade(p, mob, st(p)); } catch (e) {} }); });
    H.on('kill', function (mob) { var p = P(); if (!isAw(p)) return; (p.skills || []).forEach(function (id) { var s = SK[id]; if (s && s.kill && s.cls === p.cls) try { s.kill(p, mob, st(p)); } catch (e) {} }); });
    H.on('potion', function (def, est) { var p = P(); if (p && p.cls === 'berserker' && has(p, 'berserker', 'potion') && chance(0.2)) { heal(p, N(est)); pop(p, 'dpot', '雙重藥水', '#86efac'); } if (p && p.cls === 'paladin' && buffOn(p, 'grace')) heal(p, N(est) * 0.3); });
    H.on('tick', tick);
    return true;
  };
  var controlled = function (p) { var z = p.st || p.statuses || {}; return ['stun', 'freeze', 'stone', 'sleep', 'paralyze', 'paralysis'].some(function (k) { return N(z[k]) > 0; }); };
  var silenced = function (p) { var z = p.st || p.statuses || {}; return N(z.magicseal) > 0 || N(z.silence) > 0; };
  var ACT_ORDER = null;
  var tick = function () {
    var me = P(); if (!me || me.classicMode) return;
    [me].concat(me.allies || []).forEach(function (p) {
      if (!isAw(p) || p.dead || p._downed) return;
      try { tickOne(p, p === me); } catch (e) { console.warn('[AFK-awaken] tick', e); }
    });
  };
  var tickOne = function (p, isMe) {
    var S = st(p);
    if (!isMe && p._atkSkill && DB.skills[p._atkSkill] && DB.skills[p._atkSkill].awCls) p._atkSkill = '';   // 傭兵：核心不會放覺醒技能，交給這裡
    (p.skills || []).forEach(function (id) { var s = SK[id]; if (s && s.tick && s.cls === p.cls) try { s.tick(p, S); } catch (e) {} });
    modsRun('tick', p, S, isMe);
    if (S.dirty && isMe) { S.dirty = false; try { recomputeStats(); } catch (e) {} }
    var inFight = W.__afkProc && W.__afkProc.inCombat ? W.__afkProc.inCombat() : true;
    if (!inFight || now() - S.lastCast < 1.2) return;
    var t = target(); if (!t) return;
    if (!ACT_ORDER) ACT_ORDER = Object.keys(SK).filter(function (id) { return SK[id].run; }).sort(function (a, b) { return SK[b].lv - SK[a].lv; });
    var auto = p.awkAuto || {};
    for (var i = 0; i < ACT_ORDER.length; i++) {
      var id = ACT_ORDER[i]; if (SK[id].cls !== p.cls || auto[id] === false) continue;
      if (castNow(p, id, t, false) === true) break;
    }
  };
  var BUFKEY = { armor: 'tarmor', barrier: 'barrier', blood: 'blood' };
  // 施放一個覺醒技能：自動、技能設定的攻擊技能、熱鍵都走這裡；回傳 true＝放出去了，不然回傳原因
  var castNow = function (p, id, t, manual) {
    var s = SK[id], S = st(p); if (!s || !s.run || s.cls !== p.cls) return '不是你的技能';
    if (!learned(p, id)) return '還沒學會';
    if (N(S.cd[id]) > now()) return '冷卻中（' + Math.ceil(N(S.cd[id]) - now()) + ' 秒）';
    if ((controlled(p) || silenced(p)) && !s.ctrl) return '目前無法施放';
    if (s.k === 'buf' && s.key && S.buf[BUFKEY[s.key]] > now() && !manual) return '效果還在';
    if (s.can && !s.can(p)) return '條件不符（武器或副手）';
    t = t || target(); if (!t && s.k === 'act' && !s.ctrl) return '沒有目標';
    var cost = Math.ceil(N(s.mp) * (p.cls === 'thunder' && mast(p, 'awt_mag') ? 0.7 : 1)); if (N(p.mp) < cost) return 'MP 不足';
    var ok = false; try { ok = s.run(p, t, S); } catch (e) { console.warn('[AFK-awaken] cast', id, e); }
    if (!ok) return '條件不符';
    p.mp = Math.max(0, N(p.mp) - cost);
    var cd = N(s.cd); if (p.cls === 'runeblade' && has(p, 'runeblade', 'fly') && /stun/.test(s.key)) cd = Math.max(1, cd - 2);
    if (p.cls === 'paladin' && s.key === 'stun' && mast(p, 'awp_stun')) cd = Math.max(1, cd - 4);
    var cdm = modsRun('cd', p, s, cd); if (cdm > 0) cd = cdm;
    S.cd[id] = now() + cd; S.lastCast = now();
    if (s.k === 'buf') { try { p.buffs = p.buffs || {}; p.buffs[id] = Math.round(N(s.cd) * 10); if (p === P()) recomputeStats(); } catch (e) {} }
    pop(p, 'cast', s.n, '#fde68a');
    return true;
  };
  if (!hookProc()) W.addEventListener('load', hookProc);

  // 雷雨之劍：電位讓它的雷擊變範圍（weaponSpellProc 打一下後，對其他敵人補打）
  if (typeof W.procWeaponSpell === 'function') {
    var oPWS = W.procWeaponSpell;
    W.procWeaponSpell = function (t, sp, en) {
      var r = oPWS.apply(this, arguments), p = P();
      try { if (p && p.cls === 'thunder' && has(p, 'thunder', 'potential') && sp && sp.ele === 'wind' && !procWeaponSpell.inside) { procWeaponSpell.inside = true; near(t, 3).slice(1).forEach(function (x) { deal(p, x, 0.8, { magic: true, ele: 'wind', src: 'potential', show: false }); }); } } catch (e) {} finally { procWeaponSpell.inside = false; }
      return r;
    };
  }
  // 團結：經驗 +5%，每多一個隊員 +1.75%，最多 +12%
  W.__awkExpMult = function () { var p = P(); if (!p || p.cls !== 'paladin' || !has(p, 'paladin', 'unity')) return 1; var n = (p.allies || []).filter(function (a) { return a && !a._downed; }).length; return 1 + Math.min(mast(p, 'awp_bless') ? 0.18 : 0.12, 0.05 + n * 0.0175) + N(modsRun('unityAdd', p)); };
  if (typeof W.partyExpBonusPct === 'function') { var oPE = W.partyExpBonusPct; W.partyExpBonusPct = function () { var r = oPE.apply(this, arguments); return r + Math.round((W.__awkExpMult() - 1) * 1000) / 10; }; }

  // ── 戰鬥動畫：GPT 做的八方向序列幀（assets/classanim/awk_<外觀><方向>/：main_idle|walk|attack|hurt_N、skill_N、death_N）──
  var ANIM = { berserker: 'berserker', paladin: 'holy', darkknight: 'dark', runeblade: 'spell', thunder: 'thunder' };
  var animVar = function (p) {
    var g = /女|公主/.test(String(p.awkAvatar || p.avatar || '')) ? 'f' : 'm', v = ANIM[p.cls] + '_' + g;
    if (p.cls === 'thunder') v += isSpear(wpnFam(p)) ? '_spear' : '_swordshield';
    return v;
  };
  var hookAnim = function () {
    if (typeof W._classForm !== 'function' || W._classForm._awk) return;
    var o = W._classForm;
    var f = function (p, allyGrp, morphPfx) {
      if (!morphPfx && isAw(p)) {
        var v = 'awk_' + animVar(p), dir = (p._faceD != null ? p._faceD : 2);
        var sfx = typeof _animDirSfx === 'function' ? _animDirSfx(dir, true) : '', folder = v + sfx;
        return { key: 'class:' + folder + ':main', domKey: 'class:' + v + ':main', base: 'assets/classanim/' + encodeURIComponent(folder) + '/', wpn: 'main' };
      }
      return o.apply(this, arguments);
    };
    f._awk = true; W._classForm = f; try { (0, eval)('_classForm = window._classForm'); } catch (e) {}
  };
  hookAnim(); W.addEventListener('load', hookAnim);
  // 覺醒角色在戰場上一律顯示覺醒職業的動畫（變身、怪物卡的能力照樣有效，只是不換外觀）
  var hookForm = function () {
    if (typeof W._actorBattleForm !== 'function' || W._actorBattleForm._awk) return;
    var o = W._actorBattleForm;
    var f = function (actor, allyGrp) { if (isAw(actor) && typeof W._classForm === 'function') { try { var cf = W._classForm(actor, !!allyGrp); if (cf) return cf; } catch (e) {} } return o.apply(this, arguments); };
    f._awk = true; W._actorBattleForm = f; try { (0, eval)('_actorBattleForm = window._actorBattleForm'); } catch (e) {}
  };
  hookForm(); W.addEventListener('load', function () { setTimeout(hookForm, 0); });

  // ── 立繪：assets/character/男雷神.webp 這種；還沒放圖就用借來的人物 ──
  var PORT = {};
  var portrait = function (p) {
    var name = (/女|公主/.test(String(p.awkAvatar || p.avatar || '')) ? '女' : '男') + CLS[p.cls].n, url = 'assets/character/' + name + '.webp';
    if (PORT[url] === undefined) { PORT[url] = null; var im = new Image(); im.onload = function () { PORT[url] = true; applyPort(); }; im.onerror = function () { PORT[url] = false; }; im.src = url; }
    return PORT[url] ? url : null;
  };
  // updateUI 會延後呼叫 _updateUIImpl 才畫頭像，所以兩個都包（不然會被本職頭像蓋回去）
  var applyPort = function () {
    var p = P();
    try { if (isAw(p) && !p.afkFace) { var u = portrait(p); if (u) { var sp = document.getElementById('status-panel'), v = "url(\"" + u + "\")"; if (sp && sp.style.backgroundImage !== v) sp.style.backgroundImage = v; var lm = document.getElementById('lm-portrait'); if (lm && lm.getAttribute('src') !== u) lm.setAttribute('src', u); } } } catch (e) {}
  };
  ['_updateUIImpl', 'updateUI'].forEach(function (fn) {
    if (typeof W[fn] !== 'function') return;
    var o = W[fn];
    W[fn] = function () { var r = o.apply(this, arguments); applyPort(); return r; };
    try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
  });

  // ── 選角畫面（存檔位）：覺醒角色用 GPT 角色動畫的正面待機（assets/start/aw_<職業>_<m|f>/0..12.webp）──
  try {
    if (typeof CREATION_CLASS_ANIM_FRAMES !== 'undefined') Object.keys(CLS).forEach(function (c) { ['m', 'f'].forEach(function (g) { CREATION_CLASS_ANIM_FRAMES['aw_' + c + '_' + g] = [0, 71]; }); });
    if (typeof W.loadStartKeyFromSummary === 'function') {
      var oKey = W.loadStartKeyFromSummary;
      W.loadStartKeyFromSummary = function (sum) { if (sum && CLS[sum.rawCls]) return 'aw_' + sum.rawCls + '_' + (/女|公主/.test(String(sum.avatar || '')) ? 'f' : 'm'); return oKey.apply(this, arguments); };
      (0, eval)('loadStartKeyFromSummary = window.loadStartKeyFromSummary');
    }
    // 站姿換過圖（11-14 GPT 版），加版本號避免瀏覽器拿到舊的快取
    if (typeof W.loadFrameSrc === 'function') {
      var oSrc = W.loadFrameSrc;
      W.loadFrameSrc = function (key) { var u = oSrc.apply(this, arguments); return /^aw_/.test(String(key)) ? u + '?v=vid1114d' : u; };
      (0, eval)('loadFrameSrc = window.loadFrameSrc');
    }
  } catch (e) {}

  // ── 覺醒 ──
  var NPC_ID = 'npc_afk_awaken', TOWN = 'town_sherine', NPC_SPR = 'awaken';   // GPT 立繪縮成的站姿（assets/npc/awaken）
  try {
    var npc = { id: NPC_ID, n: '覺醒導師 伊瑟拉', title: '職業覺醒', type: 'quest', classicHide: true,
      d: '守著席琳神殿深處的古老祭壇。她說，三段輪迴的魂魄疊在一起，就能讓一個職業醒來，成為另一種存在。' };
    var L = W.__afkLore; if (L && L.addNpc) L.addNpc(TOWN, npc, NPC_SPR, null); else if (DB.towns && DB.towns[TOWN]) DB.towns[TOWN].npcs.push(npc);
    try { (0, eval)("if (typeof NPC_SPR !== 'undefined' && !NPC_SPR.awaken) NPC_SPR.awaken = { g: 'awaken', f: 1 };"); } catch (e) {}
    if (typeof NPC_SPR_FIXED !== 'undefined') NPC_SPR_FIXED[NPC_ID] = NPC_SPR;
  } catch (e) {}

  var need = function (p) { var b = p.cls; return [0, 0, 0, 0, 0].map(function (r) { return { cls: b, rebirth: r, level: 100 }; }); };   // Ping 11-15 05:48：本職 0 轉 Lv100 魂魄 5 顆
  var pickSouls = function (p, v) {
    var used = {}, out = [];
    need(p).forEach(function (q) {
      var s = (v.souls || []).find(function (x) { return !used[x.id] && x.cls === q.cls && N(x.rebirth) === q.rebirth && N(x.level) >= q.level && !!x.classic === !!p.classicMode; });
      if (s) used[s.id] = true; out.push(s || null);
    });
    return out;
  };
  var gate = function (p) {
    if (!p) return '請先進入遊戲。';
    if (p.classicMode) return '經典模式沒有職業覺醒。';
    if (isAw(p)) return '已經覺醒了。';
    if (!BY_BASE[p.cls]) return BASE_N[p.cls] + '目前沒有覺醒職業。';
    if (p.dead) return '死亡時不能覺醒。';
    if ((p.allies || []).length) return '請先解除所有傭兵僱用。';

    return '';
  };
  var awaken = function () {
    var p = P(), g = gate(p); if (g) return Promise.reject(Error(g));
    var LC = W.LineageClasses; if (!LC || !LC.commit) return Promise.reject(Error('魂魄簿還沒準備好，請重新整理。'));
    var to = BY_BASE[p.cls], C = CLS[to];
    return LC.commit('職業覺醒：' + C.n, function (q, v) {
      var souls = pickSouls(q, v); if (souls.some(function (s) { return !s; })) throw Error('魂魄不足：需要' + BASE_N[q.cls] + ' 0 轉 Lv100 魂魄 5 顆。');
      var ids = souls.map(function (s) { return s.id; });
      v.souls = v.souls.filter(function (s) { return ids.indexOf(s.id) < 0; }); ids.forEach(function (id) { v.spent[id] = Date.now(); }); v.revision = N(v.revision) + 1;
      var female = /女|公主/.test(String(q.avatar || ''));
      q.awkFrom = q.cls; q.awkAvatar = q.avatar; q.awkAt = Date.now();
      q.cls = to; q.avatar = C.av[female ? 1 : 0];
      var a = C.start; q.base = { str: a.str, dex: a.dex, con: a.con, int: a.int, wis: a.wis, cha: a.cha }; q.base[a.put] += a.pts;
      q.alloc = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      q.lv = 1; q.exp = 0; q.rebirth = 0; q.rebirthHpKeep = 0; q.rebirthMpKeep = 0;
      if (q.afkFinal) { q.afkFinalPreAwk = q.afkFinal; q.afkFinal = null; }   // Ping 11-17：覺醒後一轉女神挑戰重來（舊紀錄留在 afkFinalPreAwk）
      q.skills = (q.skills || []).filter(function (x) { return KEEP[x] != null; }); q.mastery = null; q.classPath = null; q.afkEvo = null; q.afkSkillUp = null; q.md = null; q.masteries = null;
      if (q.config) { q.config.selAtkSkill = ''; q.config.selHealSkill = ''; } q.elfEle = null; q.summon = null; q.buffs = q.buffs || {}; q.growth = null;   // 成長（天賦、巔峰）跟著轉生一起重來
      return { player: q, vault: v };
    }).then(function (rec) {
      // commit 只把 classPath 帶回目前的角色；其餘欄位這裡自己帶
      var doc = null; try { doc = JSON.parse(saveStateJson()); } catch (e) {}
      try { if (typeof loadGame === 'function' && typeof currentSlot !== 'undefined') loadGame(currentSlot); } catch (e) { console.warn('[AFK-awaken] reload', e); }
      sys('<span class="text-amber-300 font-bold">✨ 覺醒成功！你成為了「' + C.n + '」。等級回到 1，重新開始吧。</span>');
      return rec;
    });
  };
  // 11-17 之前就覺醒的角色：一轉女神挑戰紀錄是覺醒前打的 → 清掉一次，重新挑戰（Ping：覺醒後應該重來）
  var fixFinal = function () {
    try {
      var p = P(); if (!p || !isAw(p) || p.classicMode || N(p.rebirth) > 0) return;
      var r = p.afkFinal; if (!r || typeof r !== 'object' || r.pending) return;
      if (N(r.at) && N(p.awkAt) && N(r.at) > N(p.awkAt)) return;   // 覺醒後自己打的，保留
      p.afkFinalPreAwk = r; p.afkFinal = null;
      sys('<span class="text-amber-300">覺醒後重新開始：死亡女神的一轉挑戰要再打一次（覺醒前的紀錄已清除）。</span>');
      try { calcStats(); updateUI(); saveGame(); } catch (e) {}
    } catch (e) {}
  };
  setInterval(fixFinal, 3000);
  // Ping 11-17 20:06（選 B）：覺醒角色本來就轉生過，配點上限、能力上限直接保留 200，不因覺醒歸零（女神挑戰照樣要重打）
  var hookCaps = function () {
    ['__afkAllocCap', '__afkAttrCap'].forEach(function (k) {
      var o = W[k]; if (typeof o !== 'function' || o.__afkAwk) return;
      var f = function () { var p = P(); if (p && isAw(p) && !p.classicMode) return Math.max(200, N(o.apply(this, arguments))); return o.apply(this, arguments); };
      f.__afkAwk = true; W[k] = f;
    });
  };
  hookCaps(); W.addEventListener('load', function () { hookCaps(); setTimeout(hookCaps, 2000); });
  W.__afkAwaken = { CLS: CLS, SK: SK, HERO_DROP: HERO_DROP, LEG_DROP: LEG_DROP, MAST: MAST, awaken: awaken, gate: gate, pickSouls: pickSouls, st: st, ms: ms, isAw: isAw, VULN: VULN,
    MODS: MODS, api: { deal: deal, stun: stun, heal: heal, near: near, target: target, has: has, learned: learned, base: base, buffOn: buffOn, deb: deb, debV: debV, now: now, pop: pop, LV: LV, LFE: LFE, mast: mast, alive: alive, wpnFam: wpnFam, offEn: offEn, hasOff: hasOff, mine: mine, areaHeal: areaHeal, invCount: invCount, invTake: invTake, need: need, BASE_N: BASE_N, P: P, esc: esc, sys: sys, render: function () { if (ui.box) render(ui.box); } },
    tabs: [] };

  // 導師面板
  var ui = { tab: 'awaken', msg: '', err: '' };
  var XT = function () { return (W.__afkAwaken && W.__afkAwaken.tabs) || []; };
  var TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // 測試工具：只有本機測試版看得到
  var gm = function (act, arg) {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (act === 'souls') {
      var v = W.LineageClasses.vault(), base = isAw(p) ? CLS[p.cls].base : p.cls, n = 0;
      (isAw(p) ? [0, 1, 2] : [0, 0, 0, 0, 0]).forEach(function (r, ix) {
        if (!isAw(p) && pickSouls({ cls: base, classicMode: p.classicMode }, v)[ix]) return;
        if (isAw(p) && (v.souls || []).some(function (x) { return x.cls === base && N(x.rebirth) === r; })) return;
        if (v.souls.length >= 8) return;
        var id = 'gm-' + Date.now() + '-' + ix, idt = 'gm|' + id;
        v.sealed[idt] = id; v.souls.push({ id: id, identity: idt, name: '測試魂魄' + r + '轉', cls: base, level: 100, rebirth: r, classic: !!p.classicMode, sealedAt: Date.now(), sourceSlot: 0 }); n++;
      });
      v.revision = N(v.revision) + 1; localStorage.setItem(W.LineageClasses.KEY, JSON.stringify(v));
      return '補了 ' + n + ' 顆測試魂魄（' + BASE_N[base] + '）。' + (v.souls.length >= 8 ? '魂魄簿滿了的話先解除一些。' : '');
    }
    if (act === 'lv' || act === 'gold') {   // 等級、金幣要寫進存檔再重讀（直接改會在存檔時被還原）
      var lv = N(arg);
      return W.LineageClasses.commit('測試工具：' + (act === 'lv' ? '等級 ' + lv : '金幣'), function (q) {
        if (act === 'gold') q.gold = N(q.gold) + 100000000;
        else { q.lv = lv; q.exp = 0; var spent = 0; Object.keys(q.alloc || {}).forEach(function (k) { spent += N(q.alloc[k]); }); q.bonus = Math.max(0, Math.max(0, lv - 49) - spent); }
        return { player: q };
      }).then(function () { try { loadGame(currentSlot); } catch (e) {} var r = P(); try { calcStats(); r.hp = r.mhp; r.mp = r.mmp; } catch (e) {} return act === 'lv' ? '等級設為 ' + lv + '（可分配點數 ' + r.bonus + '）。' : '金幣 +1 億。'; });
    }
    if (act === 'learn') { if (!isAw(p)) return '要先覺醒。'; var c = 0; Object.keys(SK).forEach(function (id) { if (SK[id].cls === p.cls && p.skills.indexOf(id) < 0) { p.skills.push(id); c++; } }); calcStats(); try { renderTabs(); renderSkillSelects(); } catch (e) {} return '學會 ' + c + ' 個技能。'; }
    if (act === 'books') { var cls = isAw(p) ? p.cls : BY_BASE[p.cls]; if (!cls) return '這個職業沒有覺醒。'; Object.keys(SK).forEach(function (id) { if (SK[id].cls === cls) gainItem(SK[id].book, 1); }); return '給了' + CLS[cls].n + '的全部技能書。'; }
    if (act === 'full') { calcStats(); p.hp = p.mhp; p.mp = p.mmp; return 'HP、MP 回滿。'; }
    if (act === 'unaw') { return '要取消覺醒，請在測試版重新匯入備份。'; }
    return '';
  };
  var render = function (box) {
    if (!box) return; var K = W.__afkNpcKit; if (K && K.css) K.css();
    if (!document.getElementById('afk-awk-css')) { var cs = document.createElement('style'); cs.id = 'afk-awk-css'; cs.textContent = '#afk-awk .ax-filter button{cursor:pointer}#afk-awk .ax-filter button.on{background:#854d0e!important;border-color:#f59e0b!important;color:#fef3c7!important;font-weight:700}#afk-awk .ax-filter button:not(.on):hover{background:#334155}'; document.head.appendChild(cs); }
    // 11-15：跟其他 NPC 面板一樣只放一行台詞（立繪已經在村莊裡）
    var p = P();
    if (!isAw(p) && (ui.tab === 'books' || ui.tab === 'auto')) ui.tab = 'awaken';   // 11-15：技能書分頁覺醒後才顯示
    var h = '<div class="afk-ax" id="afk-awk"><p class="ax-lore">「三段輪迴的魂魄疊在一起，就能讓一個職業醒來。」</p>';
    h += '<div class="ax-filter">' + [['awaken', '職業覺醒']].concat(isAw(p) ? [['books', '技能書'], ['auto', '自動施放']] : []).concat(XT().filter(function (x) { return !x.show || x.show(p); }).map(function (x) { return [x.id, x.label]; })).concat(TEST ? [['gm', '測試工具']] : []).map(function (x) { return '<button type="button" data-aw-tab="' + x[0] + '"' + (ui.tab === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>';
    if (ui.tab === 'awaken') {
      h += '<div class="ax-h">可以覺醒的職業</div>';
      Object.keys(CLS).forEach(function (k) { var c = CLS[k]; h += '<div class="ax-row' + (p && p.cls === c.base ? '' : ' off') + '"><div class="ax-main"><div><div class="ax-name">' + esc(BASE_N[c.base]) + ' → ' + esc(c.n) + '</div><div class="ax-desc">主要屬性：' + esc(c.main) + '；能拿：' + esc(WEAPONS[k].join('、')) + '、盾、臂甲（本職裝備也能穿）</div></div></div></div>'; });
      var g = gate(p);
      if (!g) {
        var v = null, souls = []; try { v = W.LineageClasses.vault(); souls = pickSouls(p, v); } catch (e) { g = e.message; }
        h += '<div class="ax-h">需要的魂魄（魂魄簿）</div>';
        need(p).forEach(function (q, i) { var s = souls[i]; h += '<div class="ax-desc">' + esc(BASE_N[q.cls]) + ' ' + q.rebirth + ' 轉 Lv100：' + (s ? '<span class="ok">✔ ' + esc(s.name) + '（Lv' + s.level + '）</span>' : '<span class="no">✘ 沒有</span>') + '</div>'; });
        h += '<div class="ax-note">覺醒後：等級回到 1、0 轉，本職技能、魔法（日光術、迷魅術保留）、精通、職業進化、天賦與巔峰全部移除；背包與裝備保留。五顆魂魄會用掉。這個角色如果正被別人僱用為傭兵，會以覺醒後的樣子出戰（第一期傭兵還沒有覺醒技能）。</div>';
        var ready = souls.length === 5 && souls.every(Boolean);
        h += '<div class="ax-act" style="margin-top:8px"><button type="button" data-aw-go="1"' + (ready ? '' : ' disabled') + '>' + (ui.arm ? '再按一次確認覺醒成「' + esc(CLS[BY_BASE[p.cls]].n) + '」' : '覺醒成「' + esc(CLS[BY_BASE[p.cls]].n) + '」') + '</button></div>';
      }
      if (g) h += '<div class="ax-err">' + esc(g) + '</div>';
    } else if (XT().some(function (x) { return x.id === ui.tab; })) {
      try { h += XT().find(function (x) { return x.id === ui.tab; }).render(p); } catch (er) { h += '<div class="ax-err">' + esc(er.message) + '</div>'; }
    } else if (ui.tab === 'auto') {
      var au = p.awkAuto || {};
      h += '<div class="ax-h">自動施放（打勾的主動、增益技能在戰鬥中自動放）</div><div class="ax-note">也可以放進 F5～F12 熱鍵手動按，或在技能設定選成「攻擊技能」。</div>';
      Object.keys(SK).filter(function (id) { return SK[id].cls === p.cls && SK[id].run && learned(p, id); }).sort(function (a, b) { return SK[a].lv - SK[b].lv; }).forEach(function (id) {
        var s = SK[id]; h += '<label class="ax-row" style="cursor:pointer"><div class="ax-main"><div class="ax-ico sm"><img src="' + esc(s.img) + '"></div><div><div class="ax-name">' + esc(s.n) + '</div><div class="ax-note">MP ' + s.mp + '，冷卻 ' + s.cd + ' 秒</div></div></div><input type="checkbox" data-aw-auto="' + esc(id) + '"' + (au[id] === false ? '' : ' checked') + ' style="width:20px;height:20px"></label>';
      });
    } else if (ui.tab === 'gm') {
      h += '<div class="ax-h">測試工具（只有本機測試版有）</div><div class="ax-act" style="flex-wrap:wrap;gap:6px">'
        + '<button type="button" data-aw-gm="souls">補魂魄</button><button type="button" data-aw-gm="books">給全部技能書</button><button type="button" data-aw-gm="learn">學會全部技能</button>'
        + [1, 30, 50, 60, 70, 80, 100].map(function (l) { return '<button type="button" data-aw-gm="lv" data-aw-arg="' + l + '">等級 ' + l + '</button>'; }).join('')
        + '<button type="button" data-aw-gm="gold">金幣 +1 億</button><button type="button" data-aw-gm="full">HP／MP 回滿</button></div>'
        + '<div class="ax-note">補魂魄後回「職業覺醒」分頁就能覺醒。設等級會把經驗歸零，Lv50 以上給對應的可分配點數。</div>';
    } else {
      var cls = isAw(p) ? p.cls : BY_BASE[p && p.cls] || 'thunder';
      h += '<div class="ax-h">' + esc(CLS[cls].n) + '的一般技能書</div>';
      Object.keys(SK).filter(function (id) { return SK[id].cls === cls && SK[id].tier === '一般'; }).sort(function (a, b) { return SK[a].lv - SK[b].lv; }).forEach(function (id) {
        var s = SK[id], it = DB.items[s.book], got = learned(p, id);
        h += '<div class="ax-row"><div class="ax-main"><div class="ax-ico"><img src="' + esc(s.img) + '"></div><div><div class="ax-name">' + esc(s.n) + ' <span class="ax-note">Lv' + s.lv + '・' + esc({ act: '主動', pas: '被動', buf: '增益' }[s.k]) + '</span></div><div class="ax-desc">' + esc(s.desc) + '</div></div></div><div class="ax-act">' + (got ? '<span class="ok">已學會</span>' : '<button type="button" data-aw-buy="' + esc(s.book) + '">' + it.p.toLocaleString() + ' 金幣</button>') + '</div></div>';
      });
      h += '<div class="ax-h">英雄技能書（王掉落）</div>';
      Object.keys(HERO_DROP[cls]).forEach(function (k) { var s = SK['sk_aw_' + cls + '_' + k]; if (s) h += '<div class="ax-desc">' + esc(s.n) + '（Lv' + s.lv + '）：' + esc(HERO_DROP[cls][k]) + '</div>'; });
      h += '<div class="ax-h">傳說技能書（Lv80 以上的王掉落；學習另外消耗時空材料六種各 300）</div>';
      Object.keys(LEG_DROP[cls]).forEach(function (k) { var s = SK['sk_aw_' + cls + '_' + k]; if (s) h += '<div class="ax-desc">' + esc(s.n) + '（Lv' + s.lv + '）：' + esc(LEG_DROP[cls][k]) + (learned(p, s.id) ? ' <span class="ok">已學會</span>' : '') + '</div>'; });
      h += '<div class="ax-h">神話技能書（只有次元裂縫難度的副本會掉；學習另外消耗異化次元結晶 500、裂縫碎光 1,000）</div>';
      Object.keys(SK).filter(function (id) { return SK[id].cls === cls && SK[id].tier === '神話'; }).forEach(function (id) { var s = SK[id]; h += '<div class="ax-desc">' + esc(s.n) + '（Lv' + s.lv + '）：' + esc(s.desc) + (learned(p, id) ? ' <span class="ok">已學會</span>' : '') + '</div>'; });
    }
    h += '<div class="ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + esc(ui.msg) + '</div></div>';
    box.innerHTML = (W.__afkDmgLabel && W.__afkDmgLabel.html ? W.__afkDmgLabel.html(h) : h); ui.box = box;   // 11-18：技能說明也標〔近戰〕〔魔法〕等
  };
  var hook = function () {
    var K = W.__afkNpcKit;
    if (K && K.hookNpc) K.hookNpc(NPC_ID, '覺醒導師 伊瑟拉', '職業覺醒', render);
  };
  if (W.__afkNpcKit) hook(); else W.addEventListener('load', hook);
  document.addEventListener('click', function (e) {
    var cb = e.target.closest && e.target.closest('[data-aw-auto]');
    if (cb && ui.box && ui.box.contains(cb)) { var pp = P(); if (pp) { pp.awkAuto = pp.awkAuto || {}; var aid = cb.getAttribute('data-aw-auto'); setTimeout(function () { if (cb.checked) delete pp.awkAuto[aid]; else pp.awkAuto[aid] = false; try { saveGame(); } catch (er) {} }, 0); } return; }
    var xb = e.target.closest && e.target.closest('[data-aw-x]');
    if (xb && ui.box && ui.box.contains(xb)) {
      e.preventDefault(); ui.err = ''; ui.msg = '';
      var tb = XT().find(function (x) { return x.id === ui.tab; });
      var done2 = function (m) { if (m && m.err) ui.err = m.err; else ui.msg = m || ''; try { updateUI(); saveGame(); } catch (er) {} render(ui.box); };
      try { var rr = tb && tb.click(xb.getAttribute('data-aw-x'), xb.getAttribute('data-aw-arg'), xb); if (rr && rr.then) rr.then(done2, function (er) { ui.err = er.message || String(er); render(ui.box); }); else done2(rr); } catch (er) { ui.err = er.message; render(ui.box); }
      return;
    }
    var b = e.target.closest && e.target.closest('[data-aw-tab],[data-aw-go],[data-aw-buy],[data-aw-gm]'); if (!b || !ui.box || !ui.box.contains(b)) return;
    e.preventDefault(); ui.err = ''; ui.msg = '';
    if (b.hasAttribute('data-aw-tab')) { ui.tab = b.getAttribute('data-aw-tab'); ui.arm = false; render(ui.box); return; }
    if (b.hasAttribute('data-aw-gm') && TEST) {
      var done = function (m) { ui.msg = m; try { updateUI(); saveGame(); } catch (er) {} render(ui.box); };
      try { var r = gm(b.getAttribute('data-aw-gm'), b.getAttribute('data-aw-arg')); if (r && r.then) { ui.msg = '處理中…'; render(ui.box); r.then(done, function (er) { ui.err = er.message || String(er); render(ui.box); }); } else done(r); } catch (er) { ui.err = er.message; render(ui.box); }
      return;
    }
    if (b.hasAttribute('data-aw-buy')) {
      var id = b.getAttribute('data-aw-buy'), it = DB.items[id], p = P();
      if (!p || !it) return;
      if (N(p.gold) < it.p) { ui.err = '金幣不足。'; render(ui.box); return; }
      p.gold -= it.p; try { gainItem(id, 1); } catch (er) {}
      ui.msg = '買了「' + it.n + '」，在背包裡使用就能學會。'; try { updateUI(); } catch (er) {} render(ui.box); return;
    }
    if (b.hasAttribute('data-aw-go')) {
      if (!ui.arm) { ui.arm = true; render(ui.box); setTimeout(function () { ui.arm = false; }, 5000); return; }
      ui.arm = false; b.disabled = true;
      awaken().then(function () { ui.msg = '覺醒完成。'; render(ui.box); }, function (er) { ui.err = er.message || String(er); render(ui.box); });
    }
  }, true);
})();
