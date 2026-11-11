/* ============================================================================
 * afk-dreamquest.js — 夢域鏡任務線「水面下的證詞」（7 章；設計稿 docs/story-design.md 第三節 a、第七節；Ping 11-07 05:18「劇情現在開始實作」）
 *
 *   開放：世界是席琳夢域鏡，而且挑戰過終焉第一階層（輸贏都算，player.afkFinal 有紀錄）。
 *   接取人：伊奧（1、7）、扎爾（2）、魔法師 喬（3）、迷幻森林之母（4）、奧拉奇里亞（5）、無名的說書人（6，新 NPC，席琳神殿，完成第 5 章後才出現）。
 *   每位接取人都看得到整條任務線（共用 afk-lore-kit 的卡片介面）。
 *   任務道具只在夢域鏡世界、接取中、還沒集滿時掉（不走 MOB_DROPS，改由 killMob 判斷，才能限定世界與「一般怪」）。
 *   額外條件：
 *     第 3 章：要先完成「知識與背叛」第 7 章。
 *     第 5 章：要打贏終焉第二階層（afkFinalTier.t2 === 'win'）。
 *     第 6 章：八位長老各算一次、第 5 章四條龍各算一次（同一隻重複打不會多給）。
 *     第 7 章：暗夢星迴的試煉頭目 ×3；時空裂痕（夢域鏡）撐過 60 分鐘 → 光之楔的碎片；交付時身上要裝著粹煉過的之魂。
 *   獎勵一律在第一次交付時給（每個角色每章只做一次）。
 *   經典模式沒有；外掛開關 dreamquest。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.AFK_TOGGLES && W.AFK_TOGGLES.register) W.AFK_TOGGLES.register({ id: 'dreamquest', name: '劇情「水面下的證詞」', desc: '夢域鏡任務線 7 章（伊奧、扎爾、喬、迷幻森林之母、奧拉奇里亞、無名的說書人）', group: '劇情', def: true });
  if (W.AFK_TOGGLES && !W.AFK_TOGGLES.enabled('dreamquest')) return;
  var L = W.__afkLore;
  if (!L || typeof DB === 'undefined' || typeof TRIAL_Q === 'undefined') { console.warn('[AFK-dreamquest] 缺少 afk-lore-kit，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = L.esc, sys = L.sys;
  var classic = function (p) { return !!(p && p.classicMode); };
  var dreamOn = function (p) { p = p || P(); return !!(p && p.sherineDream && p.sherineMad); };
  var triedFinal = function (p) { return !!(p && p.afkFinal && typeof p.afkFinal === 'object'); };
  var LINE_ID = 'dreamq';
  var STORY_NPC = 'npc_afk_storyteller', STORY_N = '無名的說書人';
  var IMG = 'assets/icons/items/';

  // ── 任務道具 ──
  var Q = {
    drop: { id: 'afk_dq_drop', n: '倒映金光的水滴', img: IMG + '原石碎片.png', d: '伊娃王國的水滴，本該是黑色的夢裡，卻浮著一點會灼手的金光。' },
    grace: { id: 'afk_dq_grace', n: '灼痕恩賜殘片', img: IMG + '原石碎片.png', d: '從怪物身上剝下的「席琳的恩賜」，邊緣留著聖光的灼痕。' },
    ledger: { id: 'afk_dq_ledger', n: '死神的收魂簿', img: IMG + '古老的交易文件.png', d: '鐮刀死神的簿子。上面寫的亡魂歸處不是冥界，而是「天上」。' },
    plan: { id: 'afk_dq_plan', n: '鏡門的設計稿', img: IMG + '古代的卷軸.png', d: '象牙塔學者畫的鏡門草圖，落款不是名字，而是一道光。' },
    note: { id: 'afk_dq_note', n: '老師的批註', img: IMG + '古代的卷軸.png', d: '哈汀之影留下的一行字：「這扇門只能從外面開。」' },
    dew: { id: 'afk_dq_dew', n: '發光的生命之露', img: IMG + '原石碎片.png', d: '提卡爾深處被截下的生命之露，正發著不屬於世界之樹的光。' },
    book: { id: 'afk_dq_book', n: '祭壇的供奉帳', img: IMG + '妖魔搜索文件.png', d: '庫庫爾坎祭壇的帳冊，收件人一欄寫的不是庫庫爾坎。' },
    scar: { id: 'afk_dq_scar', n: '龍的夢痕', img: IMG + '原石碎片.png', d: '四龍做著同一個夢：母親在一座很高的塔上，被光切成兩半。' },
    echo: { id: 'afk_dq_echo', n: '裂痕的核心殘響', img: IMG + '原石碎片.png', d: '吉爾塔斯撕開的裂痕裡，有一道是連到天上的。' },
    stair: { id: 'afk_dq_stair', n: '斷裂的天梯石', img: IMG + '原石碎片.png', d: '傲慢之塔頂端掉落的石塊，表面刻著通往神界的階梯紋。' },
    sutra: { id: 'afk_dq_sutra', n: '被改寫的經文', img: IMG + '古代的卷軸.png', d: '長老們藏著的經文，一頁之中有兩種不同時代的筆跡。' },
    eye: { id: 'afk_dq_eye', n: '投影背後的金色眼睛', img: IMG + '原石碎片.png', d: '暗夢星迴的投影倒下時，背後留下一隻還在轉動的金色眼睛。' },
    wedge: { id: 'afk_dq_wedge', n: '光之楔的碎片', img: IMG + '原石碎片.png', d: '把夢域鏡釘在某人視線底下的楔子碎片。' }
  };
  L.addItem('afk_dq_lens', { n: '無光的鏡片', type: 'etc', c: 'text-fuchsia-300', img: IMG + '原石碎片.png', noUse: true, noSell: true, questItem: true,
    d: '映不出任何光的鏡片。伊奧說：帶著它沉進死亡之海，你會看見一直在看你的東西。（不會消耗）' });

  var DREAM_TAIL = '（只在席琳夢域鏡世界掉落）';
  var PRIDE_TOP = ['艾莉絲', '木乃伊王', '土精靈王', '水精靈王', '風精靈王', '火精靈王', '騎士范德'];
  var ELDERS = ['長老．琪娜', '長老．安迪斯', '長老．巴塔斯', '長老．巴洛斯', '長老．巴陸德', '長老．拉曼斯', '長老．泰瑪斯', '長老．艾迪爾'];
  var DRAGONS = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'];
  // 掉落規則：maps＝在這些地圖打倒一般怪；names＝打倒這些名字的怪（含頭目）；uniq＝同一種只算一次
  var RULE = {
    afk_dq_drop: { maps: ['eva_kingdom'] },
    afk_dq_grace: { maps: ['pride_91_100'], normalOnly: true },
    afk_dq_ledger: { names: ['邪惡的鐮刀死神', '邪惡的鐮刀死神(支配)'] },
    afk_dq_plan: { maps: ['zone_41'] },
    afk_dq_note: { names: ['哈汀之影'] },
    afk_dq_dew: { maps: ['tikal_deep'] },
    afk_dq_book: { names: ['提卡爾杰弗雷庫(雄)', '提卡爾杰弗雷庫(雌)'], uniqCap: 2 },
    afk_dq_scar: { dragon: true },
    afk_dq_echo: { names: ['真‧吉爾塔斯'] },
    afk_dq_stair: { maps: ['pride_91_100'], normalOnly: true },
    afk_dq_sutra: { names: ELDERS, uniq: true },
    afk_dq_eye: { dreamStar: true }
  };

  var ch = function (o) { return o; };
  var line = L.defineLine({
    id: LINE_ID, name: '水面下的證詞', hostIds: ['npc_io', 'npc_afk_zal', 'npc_afk_joe', 'npc_mother', 'npc_orachilia', STORY_NPC], hostN: '伊奧',
    intro: '「女神的夢裡從來不下雨。最近，水面上卻浮著光。」——你在死亡之海打倒的席琳，真的是你以為的那個人嗎？（只在席琳夢域鏡世界接取、掉落；要先挑戰過終焉第一階層）',
    outro: '「戴上之魂。它比我們都更早知道。」之魂發出低語：「……終於，沒有光在看了。」帶著無光的鏡片，再沉進死亡之海一次吧。',
    chapters: [
      ch({ lv: 80, title: '不會乾的淚', map: '伊娃王國（任一怪物）・接取：席琳神殿 伊奧',
        story: '伊奧：「女神的夢裡從來不下雨。最近，水面上卻浮著光。」伊娃王國是水之都，席琳原本的水之權柄就在這裡。夢裡的水本來該是黑的——去伊娃王國看看，水是從那裡開始變亮的。',
        reqs: [Object.assign({ need: 30, mobs: [] }, Q.drop, { d: Q.drop.d + DREAM_TAIL })],
        first: [['sherine_crystal', 30], ['afk_dream_crystal', 100], ['afk_mio_shard', 20]] }),
      ch({ lv: 80, title: '恩賜的顏色', map: '傲慢之塔 91～100 樓（一般怪＋邪惡的鐮刀死神）・接取：席琳神殿 扎爾',
        story: '扎爾：「我收了一輩子的魂，從沒見過會發光的。」怪物身上的「席琳的恩賜」帶著聖光的灼痕；鐮刀死神的收魂簿上寫著：歸處——天上。冥界的女主人，什麼時候改住到天上了？',
        reqs: [Object.assign({ need: 40, mobs: [] }, Q.grace, { d: Q.grace.d + DREAM_TAIL }), Object.assign({ need: 3, mobs: [] }, Q.ledger, { d: Q.ledger.d + DREAM_TAIL })],
        first: [['afk_hell_essence', 10], ['afk_asc_shard', 3], ['mat_soulstone_shard', 50]] }),
      ch({ lv: 80, title: '象牙塔的鏡門', map: '象牙塔 8 樓（一般怪）＋哈汀之影・接取：象牙塔 魔法師 喬（要先完成「知識與背叛」）',
        story: '喬：「你每次沉進死亡之海，是誰開的門？你想過嗎？」象牙塔很久以前造過「邊緣卡瑪洛卡」，能讓人傳送進別人的夢。最近有人帶著殷海薩的神諭，要學者造一扇直通神明之夢的鏡門——塔拉斯拒絕了，被逐出塔的那批學者答應了。',
        reqs: [Object.assign({ need: 25, mobs: [] }, Q.plan, { d: Q.plan.d + DREAM_TAIL }), Object.assign({ need: 1, mobs: [] }, Q.note, { d: Q.note.d + DREAM_TAIL })],
        first: [['afk_reverie_crystal', 5], ['ttmi_7102', 500], ['afk_cancel_scroll', 20]] }),
      ch({ lv: 80, title: '被截下的露水', map: '提卡爾神廟地區深處（一般怪）＋庫庫爾坎祭壇 杰弗雷庫・接取：妖精森林 迷幻森林之母',
        story: '迷幻森林之母：「哈爾巴斯睡了，樹卻還在變輕。」生命之露被截下供奉庫庫爾坎，帳上寫的收件人卻不是庫庫爾坎；祭壇上供奉的不是神像，是一面鏡子。世界之樹正在被吸，吸的人不是哈爾巴斯。',
        reqs: [Object.assign({ need: 30, mobs: [] }, Q.dew, { d: Q.dew.d + DREAM_TAIL }), Object.assign({ need: 4, mobs: [] }, Q.book, { d: Q.book.d + '（杰弗雷庫雄、雌各 2 本）' + DREAM_TAIL })],
        first: [['afk_void_stone', 2], ['afk_lament_gem', 50]], dia: 200 }),
      ch({ lv: 80, title: '母親被切開的那一夜', map: '四龍巢穴（任一階的四條龍各一次）＋異界祭壇 真‧吉爾塔斯・接取：燃柳村 奧拉奇里亞（要打贏終焉第二階層）',
        story: '奧拉奇里亞：「第一次諸神之戰，我求過母親住手。這一次……我想求的是另一位。」四龍做著同一個夢：母親在一座很高的塔上被光切成兩半。吉爾塔斯的殘響證明，他撕開的裂痕有一道是連到天上的。',
        reqs: [Object.assign({ need: 4, mobs: [] }, Q.scar, { d: Q.scar.d + '（安塔瑞斯、法利昂、巴拉卡斯、林德拜爾各一次）' + DREAM_TAIL }), Object.assign({ need: 1, mobs: [] }, Q.echo, { d: Q.echo.d + DREAM_TAIL })],
        first: [['afk_fate_unlock', 1], ['afk_asc_stone_wpn', 1], ['afk_hp_scale', 5]] }),
      ch({ lv: 80, title: '拜溫的天梯', map: '傲慢之塔 91～100 樓（一般怪）＋格蘭肯神殿．長老之室 八位長老・接取：席琳神殿 無名的說書人',
        story: '說書人：「人類改寫過一次神話，我笑了。這一次改寫的是神自己，我笑不出來。」拜溫的塔頂還連著神界的門。天使阿納金帶著席琳走上這座塔，對她說「母親願意讓妳回來」。她走到第九十九層，門裡映著一片沒有見過的天空——那是她最後一次完整地回頭。',
        reqs: [Object.assign({ need: 40, mobs: [] }, Q.stair, { d: Q.stair.d + DREAM_TAIL }), Object.assign({ need: 8, mobs: [] }, Q.sutra, { d: Q.sutra.d + '（八位長老各一頁）' + DREAM_TAIL })],
        first: [['afk_abyss_key', 3], ['afk_dark_stardust', 20], ['afk_asc_stone_arm', 1]] }),
      ch({ lv: 80, title: '監視之眼', map: '暗夢星迴（試煉頭目）＋時空裂痕（夢域鏡，撐過 60 分鐘）・接取：席琳神殿 伊奧（交付時要裝著粹煉過的之魂）',
        story: '伊奧：「你一直以為天上那個是月亮吧？死亡之海沒有月亮。」暗夢星迴的夢境者投影，是有人用來觀察強者、記錄戰法的眼睛；光之楔把夢域鏡釘在她的視線底下。打碎眼睛、拿回楔片，戴上之魂——它比我們都更早知道。',
        reqs: [Object.assign({ need: 3, mobs: [] }, Q.eye, { d: Q.eye.d + DREAM_TAIL }), Object.assign({ need: 1, mobs: [] }, Q.wedge, { d: Q.wedge.d + '（席琳夢域鏡的時空裂痕撐過 60 分鐘，結算時取得）' })],
        first: [['afk_runebox_3', 1], ['afk_dream_dust', 100], ['afk_fate_unlock', 1], ['afk_dq_lens', 1]] })
    ]
  });

  var keyOf = function (i, p) { return L.keyOf(line, i, (p || P() || {}).cls || ''); };
  var chIndexOfKey = function (key) { var m = /^afkL_dreamq_(\d+)_/.exec(String(key || '')); return m ? Number(m[1]) - 1 : -1; };
  var have = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var state = function (p) { p.afkDreamQ = p.afkDreamQ && typeof p.afkDreamQ === 'object' ? p.afkDreamQ : {}; return p.afkDreamQ; };
  var soulRefined = function (p) { var e = p && p.eq && p.eq.rem_soul; return !!(e && typeof e.seteff === 'string' && e.seteff.charAt(e.seteff.length - 1) === '夢'); };
  var hardinDone = function (p) { return trialQStateFor(p, 'afkL_hardin_7_' + p.cls) === 2; };
  var tier2Won = function (p) { return !!(p.afkFinalTier && p.afkFinalTier.t2 === 'win'); };

  // 每一章額外的接取條件（回傳不能接的原因）
  var gate = function (i, p) {
    if (classic(p)) return '經典模式沒有這條劇情。';
    if (!dreamOn(p)) return '只有在席琳夢域鏡世界才能接取（向席琳祈禱開啟）。';
    if (!triedFinal(p)) return '先去死亡之海挑戰一次終焉第一階層。';
    if (i === 2 && !hardinDone(p)) return '魔法師 喬：「先把老師的事了結。」（要先完成「知識與背叛」第 7 章）';
    if (i === 4 && !tier2Won(p)) return '奧拉奇里亞：「你還沒見過幻影背後的她。」（要先打贏終焉第二階層）';
    return '';
  };

  if (typeof W.trialQAccept === 'function') {
    var oAcc = W.trialQAccept;
    W.trialQAccept = function (key) {
      var i = chIndexOfKey(key), p = P();
      if (i >= 0 && p) { var why = gate(i, p); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; } }
      return oAcc.apply(this, arguments);
    };
  }
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var i = chIndexOfKey(key), p = P(), before = i >= 0 ? trialQState(key) : 0;
      if (i === 6 && p && !soulRefined(p)) { sys('<span class="text-amber-300">伊奧：「戴上粹煉過的之魂再來。」（要裝著粹煉過的之魂才能交付）</span>'); return; }
      var r = oDone.apply(this, arguments);
      try {
        if (i >= 0 && p && before === 1 && trialQState(key) === 2) {
          var c = line.chapters[i];
          if (c.dia && typeof W.pandoraAdjustSharedDiamonds === 'function') { W.pandoraAdjustSharedDiamonds(c.dia); sys('<span class="text-amber-200">另外得到 龍之鑽石 ×' + c.dia + '</span>'); }
          if (i === 6) sys('<span class="text-fuchsia-300 font-bold">之魂發出低語：「……終於，沒有光在看了。」</span>');
          try { saveGame(); } catch (e) {}
        }
      } catch (e) { console.warn('[AFK-dreamquest] done', e); }
      return r;
    };
  }

  // ── 掉落 ──
  var giveOne = function (p, id, why) {
    try { gainItem(id, 1, true, true); } catch (e) { return; }
    var d = DB.items[id] || {};
    sys('<span class="text-fuchsia-300">✦ 水面下的證詞：取得 ' + esc(d.n || id) + '（' + Math.min(have(id), needOf(id)) + '／' + needOf(id) + '）' + (why ? '・' + esc(why) : '') + '</span>');
  };
  var NEED = {};
  line.chapters.forEach(function (c, i) { c.reqs.forEach(function (r) { NEED[r.id] = { need: r.need, i: i }; }); });
  var needOf = function (id) { return (NEED[id] || {}).need || 0; };
  var activeFor = function (id, p) { var x = NEED[id]; if (!x) return false; return trialQStateFor(p, keyOf(x.i, p)) === 1 && have(id) < x.need; };
  var dragonOf = function (n) { n = String(n || ''); for (var j = 0; j < DRAGONS.length; j++) if (n.indexOf(DRAGONS[j]) >= 0) return DRAGONS[j]; return ''; };
  function onKill(m) {
    var p = P(); if (!p || !m || classic(p) || !dreamOn(p)) return;
    var map = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '', n = m.n || '';
    Object.keys(RULE).forEach(function (id) {
      if (!activeFor(id, p)) return;
      var r = RULE[id], st = state(p), hit = false, why = '';
      if (r.maps && r.maps.indexOf(map) >= 0 && !(r.normalOnly && m.boss)) hit = true;
      // 玩家 11-11：夢域鏡裡怪名可能加了前後綴 → 用「包含」比對；供奉帳的雄雌計數若跟手上本數對不起來（掉了、被賣、交過）就重算
      if (r.uniqCap && st.altar) { var tot = 0; for (var an in st.altar) tot += st.altar[an] || 0; if (tot > have(id)) st.altar = {}; }
      var nm = r.names ? r.names.filter(function (x) { return n === x || n.indexOf(x) >= 0; })[0] : null;
      var nn = nm || n;
      if (r.names && r.names.indexOf(nn) >= 0) {
        if (r.uniq) { st.elders = st.elders || {}; if (!st.elders[nn]) { st.elders[nn] = 1; hit = true; why = nn; } }
        else if (r.uniqCap) { st.altar = st.altar || {}; var c = st.altar[nn] || 0; if (c < r.uniqCap) { st.altar[nn] = c + 1; hit = true; why = nn; } }
        else hit = true;
      }
      if (r.dragon && m.boss) { var dg = dragonOf(n); st.dragons = st.dragons || {}; if (dg && !st.dragons[dg]) { st.dragons[dg] = 1; hit = true; why = dg; } }
      if (r.dreamStar && m._dreamStar) hit = true;
      if (hit) giveOne(p, id, why);
    });
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = null;
      try { m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null; if (m && (m._dead || m.curHp > 0 && !m._dqDying)) { /* 照常處理 */ } } catch (e) {}
      var snap = m ? { n: m.n, boss: !!m.boss, _dreamStar: !!m._dreamStar, dead: !!m._dead } : null;
      var r = oKill.apply(this, arguments);
      try { if (snap && !snap.dead) onKill(snap); } catch (e) { console.warn('[AFK-dreamquest] kill', e); }
      return r;
    };
  }
  // 光之楔的碎片：夢域鏡的時空裂痕撐過 60 分鐘，結算時給
  if (typeof W.riftEndRun === 'function') {
    var oEnd = W.riftEndRun;
    W.riftEndRun = function () {
      var r = oEnd.apply(this, arguments);
      try {
        var p = P(), info = p && p.afkRift2Reward;
        if (p && info && info.mode === 'dream' && info.min >= 60 && activeFor('afk_dq_wedge', p) && info !== state(p).lastRift) { state(p).lastRift = info; giveOne(p, 'afk_dq_wedge', '撐過 ' + Math.floor(info.min) + ' 分鐘'); }
      } catch (e) { console.warn('[AFK-dreamquest] rift', e); }
      return r;
    };
  }

  // ── 無名的說書人（席琳神殿；夢域鏡世界、完成第 5 章後才會開口）──
  L.addNpc('town_sherine', { id: STORY_NPC, n: STORY_N, title: '劇情', type: 'quest', classicHide: true,
    d: '高大的老人，影子比他本人大很多。他說自己只是個講故事的人，講的卻總是眾神的事。' }, '1254', [60, 72]);   // Ping 11-12 席琳神殿重排
  var storyVisible = function (p) { return !!(p && !classic(p) && dreamOn(p) && trialQStateFor(p, keyOf(4, p)) === 2); };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        if (npcId === STORY_NPC) {
          var div = document.getElementById('interaction-content'), p = P();
          if (div && p && !storyVisible(p)) div.innerHTML = '<div class="text-sm text-slate-400">說書人看了你一眼，沒有說話。</div>';
        }
      } catch (e) {}
      return r;
    };
  }

  W.AFK_DREAMQ = { line: line, keyOf: keyOf, gate: gate, rule: RULE, onKill: onKill, soulRefined: soulRefined };
  console.log('[AFK-dreamquest] 已啟用：夢域鏡任務線「水面下的證詞」7 章');
})();
