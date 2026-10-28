/* ============================================================================
 * afk-dragon-npcs.js — 四龍 NPC 分村、米米製作改版、四龍盔甲（玩家 2026-10-26 指定）
 *
 * 一、四龍副本入口改到「該龍所在區域的村莊」：
 *   ‧地龍 安塔瑞斯：沉默洞穴（多魯嘉貝爾、萊利的輔佐官從威頓村搬過去）
 *   ‧火龍 巴拉卡斯：威頓村（新 NPC 深淵守望者 伊格尼）
 *   ‧水龍 法利昂：海音（新 NPC 破滅守望者 瑪琳）
 *   ‧風龍 林德拜爾：亞丁（新 NPC 災厄守望者 希爾芙）
 *   每個入口只列自己那條龍的巢穴；助戰者設定四位共用。通關／放棄後回到該龍的村莊。
 *
 * 二、威頓村 米米 製作重新規劃（四段）：
 *   1. 魔眼解封（地龍之魔眼，照舊）
 *   2. 古代龍鱗盔甲 ×4（照舊）
 *   3. 四龍盔甲 ×16：安塔瑞斯／法利昂／巴拉卡斯／林德拜爾 的 力量・魅惑・泉源・霸氣
 *      統一配方：該屬性古代龍鱗盔甲 1＋該龍之心 2＋之鱗 5＋之骨 5＋之血 5＋金幣 1,000 萬
 *      （安塔瑞斯原本要的 500 個雜項材料改成龍專屬材料，四龍一致）
 *
 * 三、四龍盔甲數值（以遊戲現有的安塔瑞斯四件為基準，四龍同等級）：
 *   共通：同職業限制、同 AC、HP／MP 自然恢復、兩項 +1 能力、傷害減免 +3（+7 起每 +1 再 +1，最多 +3）、對應屬性抗性 +50
 *   安塔瑞斯（地）：免疫中毒（原本）
 *   巴拉卡斯（火）：免疫灼燒（原本是透視鏡匯入的低數值版，提升到同等級）
 *   法利昂（水）：HP／MP 上限（力量 HP+50、魅惑 MP+50、泉源 HP+20 MP+30、霸氣 HP+30 MP+20）；
 *                受到攻擊時 5% 施展「法利昂的治癒守護」：恢復 3% 最大 HP＋30（+7～+9 每 +1 再 +1%）
 *   林德拜爾（風）：受到攻擊時 5% 施展「林德拜爾的魔力守護」：恢復 3% 最大 MP＋20（+7～+9 每 +1 再 +1%）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.towns || !DB.items) return;
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ── 一、NPC 分村 ──
  var VILLAGE = { antharas: 'town_silent', valakas: 'town_witon', fafurion: 'town_heine', lindvior: 'town_aden' };
  var GUARD = {
    valakas: { id: 'npc_dragon_valakas', town: 'town_witon', n: '深淵守望者 伊格尼', pos: [56, 66], d: '守在火山口邊緣的守望者伊格尼，身上的鎧甲被熔岩烤得通紅。由此進入「深淵的巴拉卡斯巢穴」（每個角色每日通關 1 次）。' },
    fafurion: { id: 'npc_dragon_fafurion', town: 'town_heine', n: '破滅守望者 瑪琳', pos: [40, 60], d: '海音港口的守望者瑪琳，夜夜聽著海底傳來的龍吟。由此進入「破滅的法利昂巢穴」（每個角色每日通關 1 次）。' },
    lindvior: { id: 'npc_dragon_lindvior', town: 'town_aden', n: '災厄守望者 希爾芙', pos: [54, 58], d: '從風之谷來到王都的守望者希爾芙，衣角總被看不見的風拉扯著。由此進入「災厄的林德拜爾巢穴」（每個角色每日通關 1 次）。' }
  };
  var moveNpc = function (id, from, to, pos, d) {
    var a = DB.towns[from], b = DB.towns[to]; if (!a || !b) return;
    var i = (a.npcs || []).findIndex(function (x) { return x.id === id; }); if (i < 0) return;
    var npc = a.npcs.splice(i, 1)[0]; if (d) npc.d = d;
    b.npcs = b.npcs || []; if (!b.npcs.some(function (x) { return x.id === id; })) b.npcs.push(npc);
    if (pos && typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE[to] = TOWN_NPC_POS_OVERRIDE[to] || {})[id] = pos;
  };
  moveNpc('npc_doruga_bell', 'town_witon', 'town_silent', [47, 68], '多魯嘉家族的守望者，世代看守著被侵蝕的地龍巢穴。可由此進入「侵蝕的安塔瑞斯巢穴」（每個角色每日通關 1 次）；助戰者設定四座龍之巢穴共用。');
  moveNpc('npc_riley_aide', 'town_witon', 'town_silent', [80, 84]);
  Object.keys(GUARD).forEach(function (k) {
    var g = GUARD[k], t = DB.towns[g.town]; if (!t) return;
    t.npcs = t.npcs || [];
    if (!t.npcs.some(function (x) { return x.id === g.id; })) t.npcs.push({ id: g.id, n: g.n, title: '副本', type: 'dungeon', d: g.d });
    if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE[g.town] = TOWN_NPC_POS_OVERRIDE[g.town] || {})[g.id] = g.pos;
    try { if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[g.id]) NPC_SPR_FIXED[g.id] = NPC_SPR_FIXED.npc_doruga_bell || '7618'; } catch (e) {}
  });

  // 入口畫面：多魯嘉貝爾只剩安塔瑞斯；三位守望者只列自己那條龍
  var npcKey = null;
  if (typeof W.renderDorugaBell === 'function') {
    var oBell = W.renderDorugaBell;
    W.renderDorugaBell = function (div) {
      var r = oBell.apply(this, arguments);
      try {
        var key = npcKey || 'antharas', box = div.querySelector('.text-sm.space-y-3') || div;
        var cb = box.querySelectorAll('button[onclick^="afkCorruptEnter"]'), cBox = cb.length ? cb[0].parentElement : null, mine = null;
        cb.forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf("'" + key + "'") >= 0) mine = b; });
        if (key !== 'antharas') {
          var ant = box.querySelector('button[onclick^="antharasEnter"]');
          if (ant && mine) ant.replaceWith(mine);
          var intro = box.firstElementChild;
          var C = { valakas: ['深淵', '巴拉卡斯', '火'], fafurion: ['破滅', '法利昂', '水'], lindvior: ['災厄', '林德拜爾', '風'] }[key];
          if (intro && C) intro.innerHTML = C[0] + '的' + C[1] + '巢穴（' + C[2] + '屬性）就在這片土地的深處。每個角色每天可擔任主戰或傭兵通關一次；成功時主戰與所有出戰傭兵都會消耗次數（每天 00:00（台灣時間）重置）。區內無法選擇地圖與傳送，擊敗各區頭目將自動深入。';
        }
        if (cBox && cBox !== box) cBox.remove();
      } catch (e) { console.warn('[AFK-dragon-npcs] ui', e); }
      return r;
    };
  }
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      var key = Object.keys(GUARD).filter(function (k) { return GUARD[k].id === npcId; })[0];
      if (key) {
        var div = document.getElementById('interaction-content');
        if (div && typeof W.renderDorugaBell === 'function') { npcKey = key; try { div.innerHTML = ''; W.renderDorugaBell(div); } finally { npcKey = null; } }
      }
      return r;
    };
  }
  // 通關／放棄後回到該龍的村莊（原本一律回威頓村）
  var retTown = null;
  if (typeof W.setMapSelectors === 'function') {
    var oSel = W.setMapSelectors;
    W.setMapSelectors = function (k) { if (k === 'town_witon' && retTown) { arguments[0] = retTown; } return oSel.apply(this, arguments); };
  }
  // 通關訊息裡寫死的「威頓村」也換成實際回去的村莊（玩家 2026-10-26：每個副本要對應正確的村莊）
  var TOWN_N = { town_silent: '沉默洞穴', town_witon: '威頓村', town_heine: '海音', town_aden: '亞丁' };
  if (typeof W.logSys === 'function') {
    var oLogSys = W.logSys;
    W.logSys = function (h) { if (retTown && retTown !== 'town_witon' && typeof h === 'string' && h.indexOf('威頓村') >= 0) arguments[0] = h.replace(/威頓村/g, TOWN_N[retTown] || '村莊'); return oLogSys.apply(this, arguments); };
  }
  var dragonNow = function () { var s = S(); return s._afkDragon || (s.antharas ? 'antharas' : null); };
  ['antharasOnBossKill', 'killMob'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function () {
      var k = dragonNow(), keep = retTown; retTown = k ? VILLAGE[k] : null;
      try { return o.apply(this, arguments); } finally { retTown = keep; }
    };
  });

  // ── 三、四龍盔甲 ──
  var ANT = { power: 'arm_antharas_power', charm: 'arm_antharas_charm', spring: 'arm_antharas_spring', majesty: 'arm_antharas_majesty' };
  var PIECE_N = { power: '力量', charm: '魅惑', spring: '泉源', majesty: '霸氣' };
  var FAF_HPMP = { power: [50, 0], charm: [0, 50], spring: [20, 30], majesty: [30, 20] };
  var VAL_ID = { power: 'ttmi_9657', charm: 'ttmi_9658', spring: 'ttmi_9659', majesty: 'ttmi_9660' };
  var VAL_STAT = { power: ['str', 'con'], charm: ['int', 'wis'], spring: ['dex', 'str'], majesty: ['str', 'cha'] };
  var STAT_N = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
  var tmpl = function (piece) { var a = DB.items[ANT[piece]]; return a ? JSON.parse(JSON.stringify(a)) : null; };
  var statTxt = function (d) { return ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(function (k) { return d[k]; }).map(function (k) { return STAT_N[k] + ' +' + d[k]; }).join('；'); };
  var regenTxt = function (d) { return 'HP 自然恢復量 +' + (d.hpR || 0) + (d.mpR ? '；MP 自然恢復量 +' + d.mpR : ''); };
  var DR_TXT = '傷害減免 +3（強化 +7 起每 +1 再增加 1，最高 +6）';
  Object.keys(ANT).forEach(function (piece) {
    var a = tmpl(piece); if (!a) return;
    var base = function () { var d = tmpl(piece); delete d.resEarth; delete d.immPoison; d.legend = true; d.gachaWeight = 0; return d; };
    // 法利昂
    var f = base(), hm = FAF_HPMP[piece]; f.n = '法利昂的' + PIECE_N[piece]; f.resWater = 50; if (hm[0]) f.mhp = hm[0]; if (hm[1]) f.mmp = hm[1]; f.afkDragonGuard = 'fafurion';
    try { f.img = getIconUrl(DB.items[ANT[piece]]); } catch (e) {}
    f.d = '以法利昂的水之力鍛成的' + (piece === 'charm' ? '長袍' : '盔甲') + '，潮聲在甲片間低迴。水屬性抗性 +50；' + (hm[0] ? 'HP 上限 +' + hm[0] + '；' : '') + (hm[1] ? 'MP 上限 +' + hm[1] + '；' : '') + regenTxt(f) + '；' + statTxt(f) + '；' + DR_TXT + '。受到攻擊時 5% 施展「法利昂的治癒守護」：恢復 3% 最大 HP＋30（強化 +7～+9 每 +1 再 +1%）。';
    DB.items['arm_fafurion_' + piece] = f;
    // 林德拜爾
    var l = base(); l.n = '林德拜爾的' + PIECE_N[piece]; l.resWind = 50; l.afkDragonGuard = 'lindvior';
    try { l.img = getIconUrl(DB.items[ANT[piece]]); } catch (e) {}
    l.d = '以林德拜爾的風之力鍛成的' + (piece === 'charm' ? '長袍' : '盔甲') + '，穿上後連呼吸都輕盈起來。風屬性抗性 +50；' + regenTxt(l) + '；' + statTxt(l) + '；' + DR_TXT + '。受到攻擊時 5% 施展「林德拜爾的魔力守護」：恢復 3% 最大 MP＋20（強化 +7～+9 每 +1 再 +1%）。';
    DB.items['arm_lindvior_' + piece] = l;
    // 巴拉卡斯（透視鏡匯入的那件提升到同等級；沒有匯入就新建）
    var vid = DB.items[VAL_ID[piece]] ? VAL_ID[piece] : 'arm_valakas_' + piece, old = DB.items[vid] || {};
    var v = base(); ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { delete v[k]; }); VAL_STAT[piece].forEach(function (k) { v[k] = (v[k] || 0) + 1; });
    v.n = '巴拉卡斯的' + PIECE_N[piece]; v.resFire = 50; v.immBurn = true;
    ['ttmiSourceId', 'ttmiWeight', 'ttmiMinLevel', 'img', 'c'].forEach(function (k) { if (old[k] != null) v[k] = old[k]; });
    if (!v.img) try { v.img = getIconUrl(DB.items[ANT[piece]]); } catch (e) {}
    v.d = '以巴拉卡斯的烈焰鍛成的' + (piece === 'charm' ? '長袍' : '盔甲') + '，餘溫久久不散。火屬性抗性 +50；免疫灼燒；' + regenTxt(v) + '；' + statTxt(v) + '；' + DR_TXT + '。';
    DB.items[vid] = v; VAL_ID[piece] = vid;
  });
  // 守護特效：受到傷害後判定（核心補丁 46 的 __afkTaken 掛點）
  var guardOf = function (ent) { var e = ent && ent.eq && ent.eq.armor, d = e && DB.items[e.id]; return d && d.afkDragonGuard ? { kind: d.afkDragonGuard, en: Number(e.en) || 0, n: d.n } : null; };
  var GUARD_RATE = 0.05;
  var guardProc = function (ent) {
    var g = guardOf(ent); if (!g || Math.random() >= GUARD_RATE) return;
    var isP = typeof player !== 'undefined' && ent === player, bonus = Math.max(0, Math.min(3, g.en - 6)) / 100;
    if (g.kind === 'fafurion') {
      var mh = isP ? player.mhp : ent.mhp, v = Math.floor(mh * (0.03 + bonus)) + 30;
      if (isP) player.hp = Math.min(player.mhp, player.hp + v); else if (!ent._downed) ent.curHp = Math.min(ent.mhp, (ent.curHp || 0) + v);
      try { if (!S().ff && isP) logCombat('<span class="font-bold" style="color:#38bdf8;">【法利昂的治癒守護】</span>潮水般的治癒之力湧上，恢復 ' + v + ' HP。', 'heal'); } catch (e) {}
    } else if (g.kind === 'lindvior') {
      var mm = isP ? player.mmp : ent.mmp, w = Math.floor(mm * (0.03 + bonus)) + 20;
      if (isP) player.mp = Math.min(player.mmp, player.mp + w); else ent.mp = Math.min(ent.mmp, (ent.mp || 0) + w);
      try { if (!S().ff && isP) logCombat('<span class="font-bold" style="color:#4ade80;">【林德拜爾的魔力守護】</span>疾風捲起魔力，恢復 ' + w + ' MP。', 'heal'); } catch (e) {}
    }
  };
  if (typeof W.__afkTaken === 'function') {
    var oTaken = W.__afkTaken;
    W.__afkTaken = function (ent, dmg) { var v = oTaken.apply(this, arguments); try { if (v > 0) guardProc(ent); } catch (e) {} return v; };
  }

  // ── 四、三大龍的魔眼（玩家 2026-10-26 二）：比照地龍之魔眼（被石化時觸發），裝在同一個魔眼欄 ──
  //   受封印的魔眼：各龍巢穴的最終龍掉落（掉率同受封印 地龍之魔眼）；威頓村 米米 收 100 萬金幣解封
  //   觸發後 10 分鐘內免疫該狀態並獲得增益，每 1 小時最多觸發 1 次
  var EYES = {
    water: { dragon: 'fafurion', n: '水龍之魔眼', kind: 'freeze', kindN: '冰凍', c: '#38bdf8', bonus: { mr: 10, magicHit: 5, extraMp: 3 }, bonusTxt: '魔防 +10、魔法命中 +5、額外魔法點數 +3', lore: '封印著水龍魔力的魔眼，深處像有海潮在翻湧。' },
    fire: { dragon: 'valakas', n: '火龍之魔眼', kind: 'burn', kindN: '灼燒', c: '#f97316', bonus: { extraDmg: 5, dr: 3 }, bonusTxt: '額外傷害 +5、傷害減免 +3', lore: '封印著火龍魔力的魔眼，摸上去還是燙的。' },
    wind: { dragon: 'lindvior', n: '風龍之魔眼', kind: 'stun', kindN: '暈眩', c: '#4ade80', bonus: { er: 10, extraHit: 5 }, bonusTxt: '遠距離迴避 +10、額外命中 +5', lore: '封印著風龍魔力的魔眼，裡頭的風從未停過。' }
  };
  var eyeImg = (function () { try { return getIconUrl(DB.items.acc_earth_dragon_eye); } catch (e) { return ''; } })();
  var sealImg = (function () { try { return getIconUrl(DB.items.item_sealed_earth_eye); } catch (e) { return ''; } })();
  Object.keys(EYES).forEach(function (k) {
    var E = EYES[k], sid = 'item_sealed_' + k + '_eye', aid = 'acc_' + k + '_dragon_eye';
    if (!DB.items[sid]) DB.items[sid] = { n: '受封印 ' + E.n, type: 'etc', p: 1000, c: 'text-purple-300', noUse: true, gachaWeight: 0, img: sealImg, d: E.lore + '帶去威頓村找「米米」，支付 100 萬金幣便能解開封印。' };
    if (!DB.items[aid]) DB.items[aid] = { n: E.n, type: 'acc', slot: 'eye', relic: false, noEnhance: true, req: 'all', safe: 0, p: 100000, gachaWeight: 0, img: eyeImg, afkDragonEye: k,
      d: '解開封印的' + E.n + '，裝備於魔眼欄。裝備者陷入' + E.kindN + '時觸發：立即解除' + E.kindN + '，接下來 10 分鐘內免疫' + E.kindN + '，並且' + E.bonusTxt + '。每 1 小時最多觸發 1 次。' };
    E.sealed = sid; E.item = aid;
  });
  // 掉落：三座龍巢穴的最終龍
  try {
    if (typeof MOB_DROPS !== 'undefined') Object.keys(EYES).forEach(function (k) {
      var E = EYES[k], fid = Object.keys(DB.mobs).filter(function (id) { return id.indexOf(E.dragon) >= 0 && /d7$/.test(id); })[0], fn = fid && DB.mobs[fid].n;
      if (fn && MOB_DROPS[fn] && !MOB_DROPS[fn].some(function (x) { return x[0] === E.sealed; })) MOB_DROPS[fn].push([E.sealed, 8]);
    });
  } catch (e) {}
  var eyeOf = function () { try { var e = player && player.eq && player.eq.eye, d = e && DB.items[e.id]; return d && d.afkDragonEye ? EYES[d.afkDragonEye] : null; } catch (e) { return null; } };
  var eyeState = function () { var p = (typeof player !== 'undefined') ? player : null; if (!p) return null; if (!p._afkEye || typeof p._afkEye !== 'object') p._afkEye = {}; return p._afkEye; };
  var tnow = function () { return Number(S().ticks) || 0; };
  var eyeActive = function (k) { var st = eyeState(); return !!(st && st[k] && st[k].until > tnow() && st[k].until - tnow() <= 6000); };
  var eyeTick = function () {
    var E = eyeOf(), p = player; if (!p || !p.statuses) return;
    Object.keys(EYES).forEach(function (k) {
      var X = EYES[k], cur = p.statuses[X.kind] || 0; if (!(cur > 0)) return;
      if (eyeActive(k)) { p.statuses[X.kind] = 0; return; }   // 觸發期間免疫
      if (E !== X) return;
      var st = eyeState(); st[k] = st[k] || {};
      if ((st[k].cd || 0) > tnow() && st[k].cd - tnow() <= 36000) return;
      p.statuses[X.kind] = 0; if (X.kind === 'burn') { p.statuses.burnDmg = 0; }
      st[k].until = tnow() + 6000; st[k].cd = tnow() + 36000;
      try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
      try { if (!S().ff) logCombat('<span class="font-bold" style="color:' + X.c + ';text-shadow:0 0 6px ' + X.c + ';">【' + X.n + '】</span>魔眼睜開，' + X.kindN + '瞬間崩解！10 分鐘內免疫' + X.kindN + '，' + X.bonusTxt + '。', 'player-special'); } catch (e) {}
    });
  };
  if (typeof W.tick === 'function') { var oTickE = W.tick; W.tick = function () { var r = oTickE.apply(this, arguments); try { eyeTick(); } catch (e) {} return r; }; }
  if (typeof W.recomputeStats === 'function') {
    var oReE = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oReE.apply(this, arguments);
      try { var p = player; if (p && p.d) Object.keys(EYES).forEach(function (k) { if (eyeActive(k)) { var b = EYES[k].bonus; Object.keys(b).forEach(function (f) { p.d[f] = (Number(p.d[f]) || 0) + b[f]; }); } }); } catch (e) {}
      return r;
    };
  }

  // ── 五、龍副本第七階段（玩家 2026-10-26 三）：最後一隻龍（第 7 階）上場時把小怪清掉、之後不再出怪，場上只剩那隻龍 ──
  // 2026-10-28：七階只在席琳夢域鏡；其他時候第 3 階就是最後一隻龍
  var isFinalStage = function (m) { if (!m) return false; if (m._afkDragonStage === 7) return true; var dream = false; try { dream = !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) {} return m._afkDragonStage === 3 && !dream && !m.transformTo; };
  var finalDragonUp = function () { try { return (mapState.mobs || []).some(function (m) { return m && !m._dead && m.curHp > 0 && isFinalStage(m); }); } catch (e) { return false; } };
  if (typeof W.doMobTransform === 'function') {
    var oTransF = W.doMobTransform;
    W.doMobTransform = function (idx) {
      var r = oTransF.apply(this, arguments);
      try {
        var m = mapState.mobs[idx];
        if (m && isFinalStage(m) && !m._afkFinalClear) {
          m._afkFinalClear = true; var n = 0;
          mapState.mobs.forEach(function (x, i) { if (i !== idx && x && !x._dead) { mapState.mobs[i] = null; n++; } });
          try { if (!S().ff) { logCombat('<span class="font-bold" style="color:#f472b6;">' + m.n + ' 的咆哮震碎了整座巢穴——' + (n ? '其餘的魔物全數退散，' : '') + '只剩牠與你們對峙。</span>', 'enemy'); renderMobs(); } } catch (e) {}
        }
      } catch (e) {}
      return r;
    };
  }
  if (typeof W.spawnMob === 'function') {
    var oSpawnF = W.spawnMob;
    W.spawnMob = function (idx) { if (finalDragonUp()) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; } return oSpawnF.apply(this, arguments); };
  }

  // ── 二、米米配方 ──
  var DRAGON_ORDER = [['antharas', '安塔瑞斯（地）', 'earth', ANT], ['fafurion', '法利昂（水）', 'water', null], ['valakas', '巴拉卡斯（火）', 'fire', null], ['lindvior', '林德拜爾（風）', 'wind', null]];
  var SECTIONS = [];
  if (typeof CRAFT_RECIPES !== 'undefined' && CRAFT_RECIPES.npc_mimi) {
    var old = CRAFT_RECIPES.npc_mimi, keep = old.filter(function (r) { return r.result === 'acc_earth_dragon_eye' || /^arm_ancient_dragonscale_/.test(r.result); });
    var eye = keep.filter(function (r) { return r.result === 'acc_earth_dragon_eye'; }), scales = keep.filter(function (r) { return r.result !== 'acc_earth_dragon_eye'; });
    var list = [];
    SECTIONS.push([list.length, '魔眼解封']); list.push.apply(list, eye);
    Object.keys(EYES).forEach(function (k) { var E = EYES[k]; list.push({ result: E.item, req: [{ id: E.sealed, cnt: 1 }, { id: 'gold', cnt: 1000000 }] }); });
    SECTIONS.push([list.length, '古代龍鱗盔甲（四龍盔甲的底材）']); list.push.apply(list, scales);
    DRAGON_ORDER.forEach(function (x) {
      var key = x[0];
      SECTIONS.push([list.length, x[1] + '的盔甲']);
      Object.keys(PIECE_N).forEach(function (piece) {
        var id = key === 'antharas' ? ANT[piece] : key === 'valakas' ? VAL_ID[piece] : 'arm_' + key + '_' + piece;
        if (!DB.items[id]) return;
        list.push({ result: id, req: [{ id: 'arm_ancient_dragonscale_' + x[2], cnt: 1 }, { id: 'mat_' + key + '_heart', cnt: 2 }, { id: 'mat_' + key + '_scale', cnt: 5 }, { id: 'mat_' + key + '_bone', cnt: 5 }, { id: 'mat_' + key + '_blood', cnt: 5 }, { id: 'gold', cnt: 10000000 }] });
      });
    });
    CRAFT_RECIPES.npc_mimi = list;
    try { if (typeof RECIPE_BY_RESULT !== 'undefined') RECIPE_BY_RESULT = null; } catch (e) {}
    var mimi = (DB.towns.town_witon.npcs || []).find(function (x) { return x.id === 'npc_mimi'; });
    if (mimi) mimi.d = '精通龍鱗鍛造的工匠米米。能解開四大龍魔眼（地、水、火、風）的封印、重鑄四種古代龍鱗盔甲，再以四大龍的心、鱗、骨、血鍛出安塔瑞斯、法利昂、巴拉卡斯、林德拜爾的盔甲（各 4 件）。';
  }
  if (typeof W.renderUniversalCraft === 'function') {
    var oCraft = W.renderUniversalCraft;
    W.renderUniversalCraft = function (div, npcId) {
      var r = oCraft.apply(this, arguments);
      if (npcId === 'npc_mimi') try {
        var rows = div.querySelectorAll('.list-item');
        SECTIONS.slice().reverse().forEach(function (s) { var row = rows[s[0]]; if (!row) return; var h = document.createElement('div'); h.className = 'afk-mimi-sec'; h.style.cssText = 'font-weight:800;color:#fcd34d;margin:12px 0 6px;border-bottom:1px solid #78350f;padding-bottom:3px'; h.textContent = s[1]; row.before(h); });
        var tip = document.createElement('div'); tip.className = 'afk-mimi-sec'; tip.style.cssText = 'font-size:12px;color:#a8a29e;margin-bottom:6px';
        tip.textContent = '四龍盔甲統一配方：該屬性的古代龍鱗盔甲＋該龍之心 2、之鱗 5、之骨 5、之血 5＋金幣 1,000 萬。四龍素材在各龍的巢穴副本掉落。';
        if (rows[0]) rows[0].parentElement.insertBefore(tip, rows[0].parentElement.firstChild);
      } catch (e) {}
      return r;
    };
  }

  W.AFK_DRAGON_NPCS = { eyes: EYES, eyeActive: eyeActive, eyeTick: eyeTick, village: VILLAGE, guards: GUARD, valakasIds: VAL_ID, sections: SECTIONS, guardRate: GUARD_RATE, guardProc: guardProc };
  console.log('[AFK-dragon-npcs] 已啟用：四龍入口分村（沉默洞穴／威頓村／海音／亞丁）、米米四龍盔甲');
})();
