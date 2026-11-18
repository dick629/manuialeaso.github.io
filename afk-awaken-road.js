/* ============================================================================
 * afk-awaken-road.js — 覺醒之路：五個覺醒職業各一條五章的職業劇情（2026-11-16，Ping 確認內容）
 *
 *   ‧引路人站在本職試煉 NPC 旁邊（多文、塔拉斯、瑞奇、倫得、普洛凱爾）。伊瑟拉的覺醒導師面板多一頁「覺醒之路」。
 *   ‧五章跟著等級開：Lv15／30／45／60／80，要照順序做，每個角色每章一次。
 *     1 打倒指定地圖 100 隻＋10 個回憶碎片 → 覺醒職業專屬武器 +7（不能強化，Lv60 以下用）＋ 金幣 50 萬
 *     2 打倒指定王 1 次 → 一般技能書 3 本（還沒學、從便宜的開始）＋ 覺醒披風（AC −3、主屬性 +1）
 *     3 指定地監打倒 300 隻＋20 個輪迴的聲音 → 英雄技能書 1 本（自己選）＋ 龍之鑽石 300
 *     4 打倒兩隻指定王 → 覺醒披風升級（AC −5、主屬性 +2、最大 HP +300）
 *     5 單人打倒「本職的殘影」→ 稱號「醒來的〇〇」（造成的傷害 +3%、受到的傷害 −3%，覺醒職業才有效）
 *   ‧殘影：本職外觀（有 assets/anim/<名字> 就用新圖，沒有就借玩家動畫＋暗色）、本職技能，HP 約同級王 ×3。
 *     隊員在門外等（暫時倒地、離開就回來）。打輸不扣經驗、直接回村，隔天再來。
 *   ‧進度存在 player.awkRoad。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs || !DB.maps || !W.__afkAwaken) { console.warn('[AFK-awaken-road] 缺少覺醒系統，略過'); return; }
  var A = W.__afkAwaken, CLS = A.CLS, SK = A.SK;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function' && !S().ff) logSys(h); } catch (e) {} };
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var mapN = function (id) { try { return (typeof mapDisplayName === 'function' && mapDisplayName(id)) || id; } catch (e) { return id; } };
  var isAw = function (p) { return !!(p && CLS[p.cls]); };

  // ── 五條路 ──
  var LV = [15, 30, 45, 60, 80];
  var CH_N = ['醒來的第一天', '舊的武器', '聲音', '兩個名字', '本職的殘影'];
  var ROAD = {
    berserker: { guide: { id: 'npc_awq_berserker', n: '斷斧的瓦爾格', town: 'town_heine', near: 'npc_duwen' }, baseN: '戰士', echo: '戰士的殘影', main: 'str', mainN: '力量',
      line: '「斧頭斷了，人還在，那就繼續砍。」',
      c1: ['elf_forest'], c2: '巴土瑟', c3: ['rastabad_beast'], c4: ['巴風特', '古代巨人'],
      wpn: { src: 'wpn_giantaxe', n: '覺醒的裂地巨斧' },
      story: [
        '你醒來的時候手裡是空的。當戰士那幾世的回憶碎成了片，散在妖魔森林——妖魔聞得到你身上的舊血，搶著把它們吞下去。打倒牠們，把碎片撿回來。',
        '你當戰士時用的那把斧頭，被古魯丁地監的巴土瑟撿走，掛在牠的王座上當戰利品。去拿回來。不是為了再用它，是為了跟它道別。',
        '魔獸訓練場的吼聲裡混著別的聲音：前三世的你在喊。收集二十聲，你會聽懂自己當初為什麼要拿起斧頭。',
        '巴風特記得你當戰士時的名字，古代巨人記得你現在的名字。兩個都打倒，兩個名字才會合成一個。',
        '最後一個擋在你面前的，是當年那個戰士。他不會讓路——因為他就是你。'
      ], end: '瓦爾格把斷斧插進土裡：「好了，你現在只是你自己。」' },
    thunder: { guide: { id: 'npc_awq_thunder', n: '雷鳴的伊格涅', town: 'town_ivory_tower', near: 'npc_taras', pos: [27, 32] }, baseN: '法師', echo: '法師的殘影', main: 'int', mainN: '智力',
      line: '「法術是借來的，雷是你自己的。」',
      c1: ['windwood'], c2: '伊弗利特', c3: ['zone_39', 'zone_40', 'zone_41'], c4: ['冰魔', '風龍的謝托雷'],
      wpn: { src: 'wpn_spear_rasta', n: '覺醒的落雷之矛', cast: true },
      story: [
        '覺醒那一刻，你當法師時背下的咒文全散了，被風木的風捲走，落在那裡的怪物身上。把那些咒文的碎片找回來——你不會再用它們，但你得記得自己是從哪裡走來的。',
        '火龍窟的伊弗利特吞過一根法杖，那是你當法師時的法杖。打倒牠，讓那根法杖燒乾淨。',
        '象牙塔的高樓層，到處都是你前幾世留下的低語。收集二十聲，你會聽見第一道雷是怎麼落下的。',
        '冰魔讓你想起法師時的冷靜，風龍的謝托雷讓你想起雷神的暴烈。兩個都打倒，你才不必再選。',
        '最後擋在你面前的，是當年那個法師。他會用你最熟的法術對付你。'
      ], end: '伊格涅仰頭看著塔頂的雷雲：「聽到了嗎？那是你的聲音。」' },
    paladin: { guide: { id: 'npc_awq_paladin', n: '守誓者 卡西安', town: 'town_silver_knight', near: 'npc_ricky' }, baseN: '騎士', echo: '騎士的殘影', main: 'str', mainN: '力量',
      line: '「劍是誓言，盾是誓言被遵守的證明。」',
      c1: ['gludio'], c2: '卡士柏', c3: ['zone_08', 'zone_09', 'zone_10'], c4: ['死亡騎士', '深淵之主'],
      wpn: { src: 'wpn_2hsword', n: '覺醒的守誓大劍' },
      story: [
        '你當騎士時立過很多誓，覺醒時它們一句一句散了，落在古魯丁的怪物身上。去把那些誓言的碎片撿回來——守不住的誓，也該親手放下。',
        '卡士柏拿著一把騎士劍，劍柄上刻著你從前的名字。打倒牠，把劍從牠手上拿回來。',
        '古魯丁地監深處，回音裡有你前幾世立誓的聲音。收集二十聲，你會想起第一個誓是對誰立的。',
        '死亡騎士是騎士守不住誓的樣子，深淵之主是神聖劍士最怕成為的樣子。兩個都打倒，你就知道自己站在哪一邊。',
        '最後擋在你面前的，是當年那個騎士。他立過的誓，你都還記得。'
      ], end: '卡西安把盾放在你腳邊：「從今天起，你不必再向誰證明了。」' },
    darkknight: { guide: { id: 'npc_awq_darkknight', n: '影縫的莉瑟', town: 'town_silent', near: 'npc_runde' }, baseN: '黑暗妖精', echo: '黑暗妖精的殘影', main: 'str', mainN: '力量',
      line: '「黑暗不是藏身處，是戰場。」',
      c1: ['silent_outer'], c2: '馬庫爾', c3: ['demon_temple'], c4: ['混沌', '死亡'],
      wpn: { src: 'wpn_greatsword', n: '覺醒的影縫大劍' },
      story: [
        '你當黑暗妖精時藏在影子裡的那些記憶，覺醒時全被扯了出來，散在沉默洞穴外面。把它們撿回來——從今以後，你不再躲。',
        '馬庫爾手上那對雙刀，是你當黑暗妖精時的武器。打倒牠，讓那對刀回到影子裡。',
        '魔族神殿裡有很多聲音在喊你的舊名字。收集二十聲，你會明白影子為什麼一直跟著你。',
        '混沌與死亡是暗影神殿的兩位主人。一位知道你過去躲在哪裡，一位知道你未來會走到哪裡。兩個都打倒。',
        '最後擋在你面前的，是當年那個黑暗妖精。他從來不正面出手——這一次你要逼他現身。'
      ], end: '莉瑟從影子裡走出來：「你看，光照到你了，影子還在。」' },
    runeblade: { guide: { id: 'npc_awq_runeblade', n: '符石匠 歐坦', town: 'town_behemoth', near: 'npc_procel' }, baseN: '龍騎士', echo: '龍騎士的殘影', main: 'str', mainN: '力量',
      line: '「龍給你力量，符石讓你記得怎麼用它。」',
      c1: ['dragon_valley'], c2: '飛龍', c3: ['zone_30', 'zone_31'], c4: ['火焰之影', '不死鳥'],
      wpn: { src: 'wpn_longsword', n: '覺醒的符文長劍', cast: true },
      story: [
        '覺醒時，你身上的龍血退了一半，退掉的那一半成了碎片，散在龍之谷。把碎片撿回來，我替你刻進符石。',
        '龍之谷的飛龍叼走了你當龍騎士時的劍。打倒牠，把劍拿回來，那上面的龍鱗紋路還用得到。',
        '龍之谷地監深處的龍吼裡有你前幾世的聲音。收集二十聲，符石才會記得它該記的事。',
        '火焰之影燒過龍騎士的血，不死鳥燒不死。兩個都打倒，你的血和符石才會合在一起。',
        '最後擋在你面前的，是當年那個龍騎士。他身上有完整的龍血——你沒有，但你有符石。'
      ], end: '歐坦把最後一顆符石按進你的劍柄：「刻好了。這一顆，刻的是你自己。」' }
  };
  var ORDER = ['berserker', 'thunder', 'paladin', 'darkknight', 'runeblade'];
  var C1_KILLS = 100, C1_ITEMS = 10, C1_RATE = 0.12, C3_KILLS = 300, C3_ITEMS = 20, C3_RATE = 0.08, GOLD1 = 500000, DIA3 = 300, EN1 = 7, BOOK_GOLD = 100000;
  var itemN1 = function (r) { return r.baseN + '的回憶碎片'; };
  var ITEM3 = '輪迴的聲音';

  // ── 道具：專屬武器、覺醒披風（兩階）──
  var wpnId = function (cls) { return 'afk_awq_wpn_' + cls; };
  var cloakId = function (cls, t) { return 'afk_awq_cloak' + t + '_' + cls; };
  ORDER.forEach(function (cls) {
    var r = ROAD[cls], w = r.wpn, s = DB.items[w.src], id = wpnId(cls);
    if (s && !DB.items[id]) {
      var d = JSON.parse(JSON.stringify(s));
      d.img = typeof getIconUrl === 'function' ? getIconUrl(s) : s.img;
      ['legend', 'relic', 'procSkill', 'procRate', 'procRateBase', 'procRatePerEn', 'spellProc', 'gachaWeight', 'set'].forEach(function (k) { delete d[k]; });
      Object.assign(d, { n: w.n, req: cls, safe: 0, p: 1000, gachaWeight: 0, noTrade: true, noSell: true, noEnhance: true, ttmiMaxLevel: 60, afkQuestWpn: 60, c: 'text-sky-300',
        d: CLS[cls].n + '專用。覺醒之路第 1 章的獎勵，拿到時就是 +' + EN1 + '，不能強化；Lv60 以下才能裝備（等級超過會自動卸下）。不能賣，不需要時可以在背包裡刪除。' });
      d.hit = N(d.hit) + 4; d.dmgBonus = N(d.dmgBonus) + 4;
      if (w.cast) { d.mdmg = N(d.mdmg) + 4; d.magicHit = N(d.magicHit) + 3; }
      DB.items[id] = d;
      try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[w.src] && !WEAPON_TAGS[id]) WEAPON_TAGS[id] = WEAPON_TAGS[w.src].slice ? WEAPON_TAGS[w.src].slice() : WEAPON_TAGS[w.src]; } catch (e) {}
    }
    var src1 = DB.items.arm_official_cloak, img1 = src1 && typeof getIconUrl === 'function' ? getIconUrl(src1) : (src1 && src1.img);
    [[1, 3, 1, 0, '覺醒披風', '第 2 章'], [2, 5, 2, 300, '覺醒披風・真', '第 4 章（升級）']].forEach(function (t) {
      var cid = cloakId(cls, t[0]); if (DB.items[cid]) return;
      var o = { n: t[4], type: 'arm', slot: 'cloak', req: cls, safe: 4, p: 1000, gachaWeight: 0, noTrade: true, noSell: true, ac: t[1], c: t[0] === 2 ? 'text-amber-300' : 'text-sky-300', img: img1,
        d: CLS[cls].n + '專用。覺醒之路' + t[5] + '的獎勵。AC −' + t[1] + '、' + r.mainN + ' +' + t[2] + (t[3] ? '、最大 HP +' + t[3] : '') + '。不能賣，不需要時可以在背包裡刪除。' };
      o[r.main] = t[2]; if (t[3]) o.mhp = t[3];
      DB.items[cid] = o;
    });
  });

  // ── 進度 ──
  //   s：五章狀態（0 未接、1 進行中、2 完成）；k／i：目前這章的擊殺與收集；b：打倒過的王；f5：殘影打輸的日子；t：稱號
  var store = function (p) {
    p = p || P(); if (!p) return null;
    var q = p.awkRoad;
    if (!q || typeof q !== 'object' || q.cls !== p.cls) { q = p.awkRoad = { cls: p.cls, s: [0, 0, 0, 0, 0], k: 0, i: 0, b: {}, f5: 0, t: false }; }
    if (!Array.isArray(q.s) || q.s.length !== 5) q.s = [0, 0, 0, 0, 0];
    if (!q.b || typeof q.b !== 'object') q.b = {};
    return q;
  };
  var cur = function (q) { for (var i = 0; i < 5; i++) if (q.s[i] !== 2) return i; return 5; };
  var need = function (r, i) {
    if (i === 0) return { maps: r.c1, kills: C1_KILLS, items: C1_ITEMS, itemN: itemN1(r) };
    if (i === 1) return { boss: [r.c2] };
    if (i === 2) return { maps: r.c3, kills: C3_KILLS, items: C3_ITEMS, itemN: ITEM3 };
    if (i === 3) return { boss: r.c4 };
    return { echo: true };
  };
  var ready = function (p, q, i) {
    var r = ROAD[p.cls], n = need(r, i);
    if (n.kills) return q.k >= n.kills && q.i >= n.items;
    if (n.boss) return n.boss.every(function (b) { return !!q.b[b]; });
    return false;
  };
  var bossWhere = function (name) {
    var ids = Object.keys(DB.mobs).filter(function (k) { return DB.mobs[k] && DB.mobs[k].n === name; }), out = [];
    Object.keys(DB.maps).forEach(function (m) { if (/^afk_|^town_/.test(m)) return; var L = DB.maps[m]; if (Array.isArray(L) && ids.some(function (x) { return L.indexOf(x) >= 0; })) { var t = mapN(m); if (t && t !== m && out.indexOf(t) < 0) out.push(t); } });
    return out.slice(0, 3).join('／');
  };

  // ── 獎勵 ──
  var give = function (id, n) { try { return gainItem(id, n || 1, true, true); } catch (e) { return null; } };
  var lastOf = function (p, id) { return (p.inv || []).filter(function (x) { return x && x.id === id; }).pop(); };
  var dia = function (n) { try { var r = W.pandoraAdjustSharedDiamonds(n) || {}; return !!r.ok; } catch (e) { return false; } };
  var hasBook = function (p, book) { return (p.inv || []).some(function (x) { return x && x.id === book; }); };
  var bookList = function (p, tier) {
    return Object.keys(SK).filter(function (id) { var s = SK[id]; return s.cls === p.cls && s.tier === tier && s.book && DB.items[s.book]; })
      .sort(function (a, b) { return (N(DB.items[SK[a].book].p) - N(DB.items[SK[b].book].p)) || (SK[a].lv - SK[b].lv); });
  };
  var learned = function (p, id) { return !!(p.skills && p.skills.indexOf(id) >= 0); };
  var reward = function (p, q, i, arg) {
    var r = ROAD[p.cls], got = [];
    if (i === 0) {
      give(wpnId(p.cls), 1); var w = lastOf(p, wpnId(p.cls)); if (w) w.en = EN1;
      p.gold = N(p.gold) + GOLD1;
      got.push(DB.items[wpnId(p.cls)].n + ' +' + EN1, '金幣 ' + GOLD1.toLocaleString());
    } else if (i === 1) {
      var pick = bookList(p, '一般').filter(function (id) { return !learned(p, id) && !hasBook(p, SK[id].book); }).slice(0, 3);
      pick.forEach(function (id) { give(SK[id].book, 1); got.push(DB.items[SK[id].book].n); });
      if (pick.length < 3) { var g = (3 - pick.length) * BOOK_GOLD; p.gold = N(p.gold) + g; got.push('金幣 ' + g.toLocaleString() + '（技能書已經都有了）'); }
      give(cloakId(p.cls, 1), 1); got.push(DB.items[cloakId(p.cls, 1)].n);
    } else if (i === 2) {
      var s = SK[arg]; if (!s || s.cls !== p.cls || s.tier !== '英雄' || !DB.items[s.book]) return null;
      give(s.book, 1); got.push(DB.items[s.book].n);
      if (dia(DIA3)) got.push('龍之鑽石 ' + DIA3); else { p.gold = N(p.gold) + DIA3 * 1000; got.push('金幣 ' + (DIA3 * 1000).toLocaleString() + '（龍之鑽石帳戶暫時無法使用）'); }
    } else if (i === 3) {
      var c1 = cloakId(p.cls, 1), c2 = cloakId(p.cls, 2), done = false, eq = p.eq || {};
      Object.keys(eq).forEach(function (k) { var e = eq[k]; if (!done && e && e.id === c1) { e.id = c2; done = true; } });
      if (!done) (p.inv || []).forEach(function (x) { if (!done && x && x.id === c1) { x.id = c2; done = true; } });
      if (!done) give(c2, 1);
      got.push(DB.items[c2].n + (done ? '（原本的披風直接升級，強化值保留）' : ''));
      try { calcStats(); } catch (e) {}
    } else if (i === 4) {
      q.t = true; got.push('稱號「醒來的' + CLS[p.cls].n + '」');
    }
    return got;
  };

  // ── 接取、交付 ──
  var accept = function (i) {
    var p = P(); if (!isAw(p)) return '覺醒以後才能走這條路。';
    var q = store(p); if (cur(q) !== i || q.s[i] !== 0) return '';
    if (N(p.lv) < LV[i]) return '需要 Lv' + LV[i] + '。';
    q.s[i] = 1; q.k = 0; q.i = 0; q.b = {};
    sys('<span class="text-amber-300 font-bold">' + esc(ROAD[p.cls].guide.n) + '：</span>' + esc(ROAD[p.cls].story[i]));
    try { saveGame(); } catch (e) {}
    return '接下了第 ' + (i + 1) + ' 章「' + CH_N[i] + '」。';
  };
  var complete = function (i, arg) {
    var p = P(); if (!isAw(p)) return '';
    var q = store(p); if (q.s[i] !== 1 || !ready(p, q, i)) return '';
    var got = reward(p, q, i, arg); if (!got) return { err: '請選一本英雄技能書。' };
    q.s[i] = 2; q.k = 0; q.i = 0; q.b = {};
    sys('<span class="c-legend font-bold">覺醒之路第 ' + (i + 1) + ' 章「' + CH_N[i] + '」完成！</span><span class="text-amber-200">獲得：' + got.map(esc).join('、') + '。</span>');
    try { updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    return '第 ' + (i + 1) + ' 章完成：' + got.join('、') + '。';
  };

  // ── 擊殺計數、碎片 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var ms = (typeof mapState !== 'undefined') ? mapState : null, m = ms && ms.mobs ? ms.mobs[idx] : null, was = !!(m && !m._dead), at = ms && ms.current;
      var r = oKill.apply(this, arguments);
      try {
        var p = P(); if (!was || !m || !m._dead || !isAw(p) || m._awqSeen) return r;
        m._awqSeen = true;
        var q = p.awkRoad; if (!q || q.cls !== p.cls) return r;
        var i = cur(q); if (i > 3 || q.s[i] !== 1) return r;
        var R0 = ROAD[p.cls], n = need(R0, i);
        if (n.kills && n.maps.indexOf(at) >= 0 && m.race !== '建築') {
          if (q.k < n.kills) q.k++;
          var rate = i === 0 ? C1_RATE : C3_RATE;
          if (q.i < n.items && Math.random() < rate) { q.i++; sys('<span class="text-amber-200">覺醒之路：拿到「' + esc(n.itemN) + '」（' + q.i + '／' + n.items + '）。</span>'); }
          if (q.k === n.kills && q.i >= n.items) sys('<span class="text-emerald-300">覺醒之路第 ' + (i + 1) + ' 章的目標都完成了，回去找' + esc(R0.guide.n) + '。</span>');
        } else if (n.boss && n.boss.indexOf(m.n) >= 0 && !q.b[m.n]) {
          q.b[m.n] = 1;
          sys('<span class="text-emerald-300">覺醒之路：打倒了「' + esc(m.n) + '」。' + (ready(p, q, i) ? '回去找' + esc(R0.guide.n) + '。' : '') + '</span>');
        }
      } catch (e) { console.warn('[AFK-awaken-road] kill', e); }
      return r;
    };
  }

  // ── 第 5 章：本職的殘影 ──
  var MAP = 'afk_awq_echo', MAPN = '輪迴的迴廊';
  DB.maps[MAP] = [];
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/時空裂痕戰場.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '三段輪迴疊在一起的地方，本職時的自己在這裡等你。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = MAPN; } catch (e) {}
  var ECHO = { hp: 180000, ac: -70, mr: 70, dmg: [5, 60], db: 130, hit: 120, exp: 20000 };
  var TROLL = { berserker: 'troll_warrior', thunder: 'troll_mage', paladin: 'troll_knight', darkknight: 'troll_dark', runeblade: 'troll_dragon' };
  var AVB = { berserker: '戰士', thunder: '法師', paladin: '騎士', darkknight: '黑暗妖精', runeblade: '龍騎士' };
  var hasArt = function (name) { try { return typeof ANIM_MANIFEST !== 'undefined' && !!ANIM_MANIFEST['assets/anim/' + name]; } catch (e) { return false; } };
  var buildEcho = function (p) {
    var r = ROAD[p.cls], t = DB.mobs[TROLL[p.cls]] || DB.mobs.troll_warrior, m = JSON.parse(JSON.stringify(t));
    ['trollPlayer', 'scale', 'wild', 'regenFix'].forEach(function (k) { delete m[k]; });
    var fem = /女|公主/.test(String(p.awkAvatar || p.avatar || ''));
    Object.assign(m, { n: r.echo, lv: 80, race: '不死', beh: '主動', boss: true, e: 'none', hp: ECHO.hp, ac: ECHO.ac, mr: ECHO.mr, dmg: ECHO.dmg.slice(), db: ECHO.db, hit: ECHO.hit,
      exp: ECHO.exp, goldMin: 0, goldMax: 0, noCharm: true, afkAwqEcho: 1 });
    m.atkSpd = Math.max(0.5, Math.min(1.5, N(t.atkSpd) * 3 || 1));
    ['mag', 'mag2', 'mag3', 'mag4', 'mag5'].forEach(function (k) { var g = m[k]; if (!g) return; if (g.dmg) { g.dmg = [5, 60]; g.db = 100 + 40 * (N(g.dbLvMult) || 1); delete g.dbLv; delete g.dbLvMult; } });
    if (m.onHitPoison) m.onHitPoison.d = 120;
    var av = (fem ? '女' : '男') + AVB[p.cls];
    m._pvpAvatar = av; m.img = 'assets/classanim/' + av + 'F/unarmed_idle_0.png';
    try {
      if (typeof MOB_ANIM_NAMES !== 'undefined' && typeof MOB_ANIM_ALIAS !== 'undefined') {
        if (hasArt(m.n)) { if (MOB_ANIM_ALIAS[m.n]) { delete MOB_ANIM_ALIAS[m.n]; try { delete _mobAnimCache[m.n]; } catch (e) {} } MOB_ANIM_NAMES.add(m.n); }
        else {
          var dir = '玩家' + av;
          if (MOB_ANIM_ALIAS[m.n] !== dir) { MOB_ANIM_ALIAS[m.n] = dir; try { if (typeof _mobAnimCache !== 'undefined') delete _mobAnimCache[m.n]; } catch (e) {} }
          MOB_ANIM_NAMES.add(m.n); if (typeof MOB_ANIM_SPRITE_SHADOW !== 'undefined') MOB_ANIM_SPRITE_SHADOW.add(m.n);
        }
      }
    } catch (e) {}
    return m;
  };
  // 沒有專屬圖時：暗色濾鏡
  (function () {
    try {
      var names = ORDER.map(function (c) { return ROAD[c].echo; }).filter(function (n) { return !hasArt(n); });
      if (!names.length) return;
      var css = names.map(function (n) { return '#battle-view .mob-img-inner img[alt="' + n + '"]'; }).join(',') + '{filter:brightness(.55) saturate(.35) hue-rotate(200deg) drop-shadow(0 0 6px rgba(139,92,246,.85))!important}';
      var st = document.createElement('style'); st.id = 'afk-awq-echo-css'; st.textContent = css; (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  })();
  (function () {   // 單人：隊員的戰場身影與隊伍欄藏起來，改顯示「在門外等」
    try {
      var st = document.createElement('style'); st.id = 'afk-awq-solo-css';
      st.textContent = 'body.afk-awq-solo .party-sprite{display:none!important}body.afk-awq-solo #squad-tab-team>div{display:none!important}'
        + 'body.afk-awq-solo #squad-tab-team::before{content:"隊員在門外等你。";display:block;padding:8px;color:#c4b5fd;font-size:13px}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  })();

  // 隊員在門外等：進去時暫時倒地，離開時回來
  var bench = function (p) { (p.allies || []).forEach(function (a) { if (!a || a._awqBench) return; a._awqBench = 1; a.curHp = 0; a._downed = true; a._reviveCd = 99999; }); };
  var unbench = function (p) { (p && p.allies || []).forEach(function (a) { if (!a || !a._awqBench) return; delete a._awqBench; a._downed = false; a._reviveCd = 0; a.curHp = N(a.mhp) || N(a.hp) || 1; if (N(a.mmp)) a.mp = a.mmp; }); };
  var lastMap = null, echoRun = null;
  var watch = function () {
    var c = (typeof mapState !== 'undefined') ? mapState.current : null, p = P();
    if (c !== lastMap) { if (lastMap === MAP && c !== MAP) { unbench(p); echoRun = null; } lastMap = c; }
    try { if (document.body) document.body.classList.toggle('afk-awq-solo', c === MAP); } catch (e) {}
    if (c === MAP && p) (p.allies || []).forEach(function (a) { if (a && a._awqBench) { a._downed = true; a.curHp = 0; a._reviveCd = 99999; } });
    else if (p && (p.allies || []).some(function (a) { return a && a._awqBench; })) unbench(p);
  };
  var goTown = function (p) { try { setMapSelectors(ROAD[p.cls] ? ROAD[p.cls].guide.town : 'town_silver_knight'); changeMap(true); } catch (e) {} };
  var enterEcho = function () {
    var p = P(); if (!isAw(p)) return '覺醒以後才能走這條路。';
    var q = store(p);
    if (q.s[4] !== 1) return '';
    if (q.f5 === dayKey()) return '今天已經跟殘影交手過了，明天（台灣時間 00:00 以後）再來。';
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return '';
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeTownFloatWindow === 'function') closeTownFloatWindow(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    mapState.current = MAP; p.lastBattleMap = MAP; lastMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    S()._kbRespawnAt = null; S()._kbVictory = false;
    echoRun = { spawned: false, done: false };
    bench(p);
    try { calcStats(); p.hp = p.mhp; p.mp = p.mmp; } catch (e) {}
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    sys('<span class="font-bold" style="color:#c4b5fd">【' + MAPN + '】</span>隊員停在門外。迴廊盡頭站著一個熟悉的身影——' + esc(ROAD[p.cls].echo) + '。');
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    return true;
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (typeof mapState === 'undefined' || mapState.current !== MAP) return oSpawn.apply(this, arguments);
      var p = P();
      if (!echoRun) echoRun = { spawned: false, done: false };
      if (idx !== 1 || echoRun.spawned || !p || !ROAD[p.cls]) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }
      var m = buildEcho(p);
      mapState.mobs[idx] = Object.assign(m, { curHp: m.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
      echoRun.spawned = true;
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(mapState.mobs[idx]); } catch (e) {}
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
  }
  if (typeof W.killMob === 'function') {   // 殘影倒下
    var oKill2 = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, was = !!(m && !m._dead);
      var r = oKill2.apply(this, arguments);
      try {
        var p = P();
        if (was && m && m._dead && m.afkAwqEcho && mapState.current === MAP && isAw(p) && echoRun && !echoRun.done) {
          echoRun.done = true;
          var q = store(p);
          if (q.s[4] === 1) {
            var got = reward(p, q, 4); q.s[4] = 2;
            sys('<span class="c-legend font-bold">覺醒之路第 5 章「' + CH_N[4] + '」完成！</span><span class="text-amber-200">' + esc(ROAD[p.cls].echo) + '散成光點，落回你身上。獲得：' + got.map(esc).join('、') + '。</span>');
            sys('<span class="text-amber-200">' + esc(ROAD[p.cls].end) + '</span>');
            sys('<span style="color:#f0c4f5">伊瑟拉的聲音從很遠的地方傳來：「三段輪迴的魂魄，終於只剩下一個你。歡迎醒來。」</span>');
          }
          setTimeout(function () { try { if (mapState.current === MAP) { goTown(P()); saveGame(); } } catch (e) {} }, 1500);
        }
      } catch (e) { console.warn('[AFK-awaken-road] echo', e); }
      return r;
    };
  }
  // 打輸：不扣經驗、直接回村，隔天再來
  var hookDeath = function () {
    if (typeof W.killPlayer !== 'function' || W.killPlayer.__awq) return;
    var oDie = W.killPlayer;
    W.killPlayer = function () {
      var p = P();
      if (!p || typeof mapState === 'undefined' || mapState.current !== MAP) return oDie.apply(this, arguments);
      try {
        var q = store(p); q.f5 = dayKey();
        p.dead = false;
        if (p.statuses) Object.keys(p.statuses).forEach(function (k) { if (typeof p.statuses[k] === 'number') p.statuses[k] = 0; });
        try { document.getElementById('btn-revive').classList.add('hidden'); var ip = document.getElementById('btn-revive-inplace'); if (ip) ip.classList.add('hidden'); } catch (e) {}
        sys('<span class="text-red-400 font-bold">你被' + esc(ROAD[p.cls].echo) + '打倒了……</span><span class="text-slate-300">（覺醒之路：不損失經驗，明天可以再挑戰）</span>');
        echoRun = null; goTown(p);
        try { calcStats(); p.hp = p.mhp; p.mp = p.mmp; updateUI(); saveGame(); } catch (e) {}
      } catch (e) { console.warn('[AFK-awaken-road] death', e); }
    };
    W.killPlayer.__awq = true;
    try { (0, eval)('killPlayer = window.killPlayer'); } catch (e) {}
  };
  hookDeath();
  if (typeof W.reviveMercenary === 'function') {   // 迴廊裡不能把隊員叫進來
    var oRev = W.reviveMercenary;
    W.reviveMercenary = function () { if (typeof mapState !== 'undefined' && mapState.current === MAP) return false; return oRev.apply(this, arguments); };
    try { (0, eval)('reviveMercenary = window.reviveMercenary'); } catch (e) {}
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { try { watch(); } catch (e) {} return oTick.apply(this, arguments); };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 稱號：造成 +3%、受到 −3%（覺醒職業才有效）──
  var titled = function (p) { return !!(isAw(p) && p.awkRoad && p.awkRoad.cls === p.cls && p.awkRoad.t); };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { var p = P(); return (ent && ent === p && titled(p)) ? 0.97 : 1; });
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__awq) return;
    var o = C.damage;
    C.damage = function (actor, target, amount) {
      var r = o.apply(this, arguments);
      try { var p = P(); if (r > 0 && actor && actor === p && titled(p)) r = Math.max(1, Math.floor(r * 1.03)); } catch (e) {}
      return r;
    };
    C.damage.__awq = true;
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // ── 引路人 NPC（站在本職試煉 NPC 旁邊）──
  var spotOf = function (town, id) {
    try {
      var ov = (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined' && TOWN_NPC_POS_OVERRIDE[town]) || {};
      if (ov[id]) return { x: ov[id][0], y: ov[id][1] };
      var t = DB.towns[town], i = t ? (t.npcs || []).findIndex(function (n) { return n && n.id === id; }) : -1;
      var sp = (typeof TOWN_NPC_SPOTS !== 'undefined' && TOWN_NPC_SPOTS[town]) || null;
      if (i < 0 || !sp || !sp.length) return null;
      var s = sp[i % sp.length], wrap = Math.floor(i / sp.length);
      return { x: Math.min(92, s[0] + wrap * 3), y: Math.min(90, s[1] + wrap * 2) };
    } catch (e) { return null; }
  };
  var placed = {};
  var placeGuides = function (only) {
    ORDER.forEach(function (cls) {
      if (only && ROAD[cls].guide.town !== only) return;
      var g = ROAD[cls].guide, t = DB.towns[g.town]; if (!t) return;
      t.npcs = t.npcs || [];
      if (!t.npcs.some(function (n) { return n.id === g.id; })) t.npcs.push({ id: g.id, n: g.n, title: '覺醒之路', type: 'quest', d: CLS[cls].n + '的引路人。' + ROAD[cls].line });
      try {
        if (typeof TOWN_NPC_POS_OVERRIDE === 'undefined') return;
        var ov = TOWN_NPC_POS_OVERRIDE[g.town] || (TOWN_NPC_POS_OVERRIDE[g.town] = {});
        if (g.pos) { ov[g.id] = g.pos.slice(); return; }
        if (ov[g.id] && !placed[g.id]) return;
        var b = spotOf(g.town, g.near); if (!b) return;
        var others = t.npcs.filter(function (n) { return n.id !== g.id && n.id !== g.near; }).map(function (n) { return spotOf(g.town, n.id); }).filter(Boolean);
        var best = null, bestD = -1, pick = null;
        [[8, 0], [-8, 0], [0, 9], [6, 7], [-6, 7], [6, -7], [-6, -7], [11, 3], [-11, 3], [0, -10]].forEach(function (o) {
          if (pick) return;
          var c = { x: b.x + o[0], y: b.y + o[1] }; if (c.x < 6 || c.x > 94 || c.y < 24 || c.y > 90) return;
          var d = others.reduce(function (m, s) { return Math.min(m, Math.hypot((s.x - c.x) * 16 / 9, s.y - c.y)); }, 999);
          if (d >= 9) pick = c; else if (d > bestD) { best = c; bestD = d; }
        });
        best = pick || best;
        if (best) { ov[g.id] = [Math.round(best.x), Math.round(best.y)]; placed[g.id] = 1; }
      } catch (e) {}
    });
  };
  placeGuides();
  if (typeof W.renderTownNPCMap === 'function') {   // 其他模組可能之後才插入 NPC，畫村莊時再對一次位置
    var oTown = W.renderTownNPCMap;
    W.renderTownNPCMap = function (townId) { try { placeGuides(townId); } catch (e) {} return oTown.apply(this, arguments); };
    try { (0, eval)('renderTownNPCMap = window.renderTownNPCMap'); } catch (e) {}
  }

  // ── 畫面 ──
  var STN = ['未接取', '進行中', '已完成'];
  var cnt = function (a, b) { return '<b style="color:' + (a >= b ? '#4ade80' : '#fca5a5') + '">' + Math.min(a, b) + '</b>／' + b; };
  var html = function (p, attr, inGuide) {
    var K = W.__afkNpcKit; if (K && K.css) K.css();
    var h = '';
    if (!isAw(p)) {
      h += '<div class="ax-h">覺醒之路</div><div class="ax-desc">覺醒以後，引路人才會為你帶路。五個覺醒職業的引路人：</div>';
      ORDER.forEach(function (c) { var g = ROAD[c].guide; h += '<div class="ax-note">' + esc(CLS[c].n) + '：' + esc(g.n) + '（' + esc(mapN(g.town)) + '）</div>'; });
      return h;
    }
    var r = ROAD[p.cls], q = store(p), ci = cur(q), btn = function (act, label, ok, arg) { return '<button type="button" ' + attr + '="' + act + '"' + (arg != null ? ' data-aw-arg="' + esc(arg) + '"' : '') + (ok ? '' : ' disabled') + '>' + label + '</button>'; };
    h += '<div class="ax-h">覺醒之路・' + esc(CLS[p.cls].n) + '（' + q.s.filter(function (x) { return x === 2; }).length + '／5 章）</div>';
    if (!inGuide) h += '<div class="ax-note">引路人：' + esc(r.guide.n) + '（' + esc(mapN(r.guide.town)) + '）' + esc(r.line) + '</div>';
    if (q.t) h += '<div class="ax-desc" style="color:#fde68a">稱號「醒來的' + esc(CLS[p.cls].n) + '」：造成的傷害 +3%、受到的傷害 −3%。</div>';
    if (!inGuide) h += '<div class="ax-act" style="margin:6px 0">' + btn('go', '前往' + esc(mapN(r.guide.town)) + '找' + esc(r.guide.n), true) + '</div>';
    for (var i = 0; i < 5; i++) {
      var s = q.s[i], n = need(r, i), lock = i > ci, lvOk = N(p.lv) >= LV[i];
      var body = '<div class="ax-desc">' + esc(r.story[i]) + '</div>', goal = '';
      if (n.kills) goal = '在' + n.maps.map(mapN).map(esc).join('、') + '打倒怪物 ' + (s === 1 ? cnt(q.k, n.kills) : n.kills + ' 隻') + '，收集「' + esc(n.itemN) + '」' + (s === 1 ? cnt(q.i, n.items) : n.items + ' 個');
      else if (n.boss) goal = '打倒 ' + n.boss.map(function (b) { return (s === 1 ? (q.b[b] ? '✅' : '⬜') : '') + '<b>' + esc(b) + '</b><span class="ax-note">（' + esc(bossWhere(b)) + '）</span>'; }).join('、');
      else goal = '單人挑戰「' + esc(r.echo) + '」（隊員在門外等；打輸不扣經驗，隔天可以再打）' + (s === 1 && q.f5 === dayKey() ? '<span class="no">　今天已經挑戰過了</span>' : '');
      var rw = ['', '', '', '', ''];
      rw[0] = esc((DB.items[wpnId(p.cls)] || {}).n) + ' +' + EN1 + '（不能強化，Lv60 以下用）、金幣 ' + GOLD1.toLocaleString();
      rw[1] = '一般技能書 3 本（還沒學的，從便宜的開始）、' + esc((DB.items[cloakId(p.cls, 1)] || {}).n) + '（AC −3、' + esc(r.mainN) + ' +1）';
      rw[2] = '英雄技能書 1 本（自己選）、龍之鑽石 ' + DIA3;
      rw[3] = '覺醒披風升級成「' + esc((DB.items[cloakId(p.cls, 2)] || {}).n) + '」（AC −5、' + esc(r.mainN) + ' +2、最大 HP +300）';
      rw[4] = '稱號「醒來的' + esc(CLS[p.cls].n) + '」（造成的傷害 +3%、受到的傷害 −3%）';
      var act = '';
      if (s === 2) act = '<span class="ok">已完成</span>';
      else if (lock) act = '<span class="ax-note">先完成前一章</span>';
      else if (!lvOk) act = '<span class="no">需要 Lv' + LV[i] + '</span>';
      else if (!inGuide) act = s === 0 ? '<span class="ax-note">到' + esc(r.guide.n) + '那裡接取</span>' : (i === 4 ? '<span class="ax-note">到' + esc(r.guide.n) + '那裡挑戰</span>' : (ready(p, q, i) ? '<span class="ok">回' + esc(r.guide.n) + '那裡交付</span>' : '<span class="ax-note">進行中</span>'));
      else if (s === 0) act = btn('accept', '接取', true, i);
      else if (i === 4) act = btn('echo', '進入' + MAPN, q.f5 !== dayKey());
      else if (i === 2 && ready(p, q, i)) act = '<div class="ax-note" style="width:100%">選一本英雄技能書：</div>' + bookList(p, '英雄').map(function (id) { return btn('done', esc(SK[id].n) + (learned(p, id) ? '（已學）' : ''), true, i + ':' + id); }).join('');
      else act = btn('done', '交付', ready(p, q, i), i);
      h += '<div class="ax-row' + (s === 2 || lock ? ' off' : '') + '" style="display:block"><div class="ax-name">第 ' + (i + 1) + ' 章　' + esc(CH_N[i]) + '　<span class="ax-note">Lv' + LV[i] + '・' + (lock ? '未解鎖' : STN[s]) + '</span></div>'
        + (s === 2 ? '' : body + '<div class="ax-desc">目標：' + goal + '</div>')
        + '<div class="ax-note">獎勵：' + rw[i] + '</div><div class="ax-act" style="margin-top:6px;flex-wrap:wrap;gap:6px">' + act + '</div></div>';
    }
    if (q.s[4] === 2) h += '<div class="ax-desc" style="color:#f0c4f5;margin-top:8px">' + esc(r.end) + '</div>';
    return h;
  };
  var click = function (act, arg) {
    var p = P(); if (!p) return '';
    if (act === 'go') { if (!ROAD[p.cls]) return ''; try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {} goTown(p); return '已經回到' + mapN(ROAD[p.cls].guide.town) + '，' + ROAD[p.cls].guide.n + '就在附近。'; }
    if (act === 'accept') return accept(N(arg));
    if (act === 'done') { var sp = String(arg || '').split(':'); return complete(N(sp[0]), sp[1]); }
    if (act === 'echo') { var r = enterEcho(); return r === true ? '' : r; }
    return '';
  };
  // 伊瑟拉的覺醒導師面板：多一頁
  try { (A.tabs = A.tabs || []).push({ id: 'road', label: '覺醒之路', show: function (p) { return isAw(p); }, render: function (p) { return html(p, 'data-aw-x', false); }, click: function (a, g) { return click(a, g); } }); } catch (e) {}
  // 引路人面板
  var gui = { box: null, msg: '', err: '' };
  var renderGuide = function (cls, box) {
    if (!box) return; var p = P(), r = ROAD[cls];
    var h = '<div class="afk-ax" id="afk-awq"><p class="ax-lore">' + esc(r.line) + '</p>';
    if (!p || p.cls !== cls) h += '<div class="ax-desc">' + esc(r.guide.n) + '看了你一眼：「等你覺醒成' + esc(CLS[cls].n) + '再來。」</div>';
    else h += html(p, 'data-awq', true);
    h += '<div class="ax-err">' + esc(gui.err) + '</div><div class="ax-msg">' + esc(gui.msg) + '</div></div>';
    box.innerHTML = h; gui.box = box; gui.cls = cls; gui.msg = ''; gui.err = '';
  };
  var hookGuides = function () {
    var K = W.__afkNpcKit; if (!K || !K.hookNpc) return;
    ORDER.forEach(function (cls) { var g = ROAD[cls].guide; K.hookNpc(g.id, g.n, '覺醒之路', function (box) { renderGuide(cls, box); }); });
  };
  if (W.__afkNpcKit) hookGuides(); else W.addEventListener('load', hookGuides);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-awq]'); if (!b || !gui.box || !gui.box.contains(b) || b.disabled) return;
    e.preventDefault();
    var m = click(b.getAttribute('data-awq'), b.getAttribute('data-aw-arg'));
    if (m && m.err) gui.err = m.err; else gui.msg = m || '';
    if (document.body.contains(gui.box)) renderGuide(gui.cls, gui.box);
  }, true);

  W.__afkAwakenRoad = { ROAD: ROAD, LV: LV, CH_N: CH_N, MAP: MAP, store: store, cur: cur, ready: ready, accept: accept, complete: complete, enterEcho: enterEcho, buildEcho: buildEcho, wpnId: wpnId, cloakId: cloakId, titled: titled, html: html };
  // ── 黑暗妖精試煉 NPC（倫得、康）：覺醒成暗黑騎士也看得到（Ping 11-18 15:13；試煉本身核心已用 questCls 照本職判斷，只是地圖上被藏起來）──
  try {
    Object.keys(DB.towns || {}).forEach(function (tid) {
      (DB.towns[tid].npcs || []).forEach(function (n) {
        if (!n || !n.darkOnly || n.__afkDarkVis) return;
        Object.defineProperty(n, '__afkDarkVis', { value: true });
        Object.defineProperty(n, 'darkOnly', { configurable: true, enumerable: true,
          get: function () { try { var p = P(); if (p && p.cls !== 'dark' && typeof questCls === 'function' && questCls(p) === 'dark') return false; } catch (e) {} return true; },
          set: function () {} });
      });
    });
  } catch (e) {}

  // ── 新手獎勵可以刪除（Ping 11-18 14:07）：覺醒之路的見習武器、覺醒披風不能賣，背包裡的可以直接刪掉 ──
  var CAN_DEL = /^afk_awq_(wpn|cloak)/;
  W.__afkDelNovice = function (uid) {
    var p = P(); if (!p) return;
    var it = (p.inv || []).find(function (x) { return x && String(x.uid) === String(uid); }), d = it && DB.items[it.id];
    if (!it || !CAN_DEL.test(it.id)) return;
    if (it.lock) { try { logSys('<span class="text-amber-300">這件鎖定中，先解鎖才能刪除。</span>'); } catch (e) {} return; }
    var go = function () {
      p.inv = p.inv.filter(function (x) { return x !== it; });
      try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
      try { logSys('<span class="text-slate-300">刪除了「' + esc(d ? d.n : it.id) + '」。</span>'); } catch (e) {}
      try { if (typeof updateUI === 'function') updateUI(); if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
      try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    };
    var msg = '確定要刪除「' + (d ? d.n : it.id) + '」嗎？刪除後不會退回任何東西，也拿不回來。';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '刪除道具', message: msg, okText: '刪除', cancelText: '取消', onOk: go }); else if (confirm(msg)) go();
  };
  if (typeof W.openModal === 'function' && !W.openModal.__afkDelNov) {
    var oOpen = W.openModal;
    W.openModal = function (item, isEq) {
      var r = oOpen.apply(this, arguments);
      try {
        if (item && !isEq && CAN_DEL.test(item.id || '')) {
          var box = document.getElementById('modal-actions');
          if (box && !box.querySelector('[data-afk-delnov]')) {
            box.insertAdjacentHTML('beforeend', '<button type="button" data-afk-delnov="' + esc(item.uid) + '" class="col-span-2 w-full btn border-rose-800 bg-rose-950 hover:bg-rose-900 py-2 text-base font-bold text-rose-200">🗑 刪除（不能賣的新手獎勵）</button>');
          }
        }
      } catch (e) {}
      return r;
    };
    W.openModal.__afkDelNov = true;
    document.addEventListener('click', function (ev) { var b = ev.target && ev.target.closest && ev.target.closest('[data-afk-delnov]'); if (!b) return; ev.preventDefault(); W.__afkDelNovice(b.getAttribute('data-afk-delnov')); }, true);   // 用委派：別的外掛重畫按鈕列也不會掉
    try { (0, eval)('openModal = window.openModal'); } catch (e) {}
  }
  console.log('[AFK-awaken-road] 已啟用：覺醒之路（五個覺醒職業 × 5 章）');
})();
