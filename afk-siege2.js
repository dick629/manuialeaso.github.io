/* ============================================================================
 * afk-siege2.js — 攻城、守城戰第二版（設計稿 docs/castle-defense-design.md，玩家 2026-11-03 確認；外掛開關 siege2，預設開）
 *
 * 一、時間：固定每週五 台灣時間 20:00～21:00（玩家 11-04 03:58）。只有持有城堡的帳號（一般模式）會遇到；血盟頁可以關掉守城戰。
 * 二、流程：20:00 跳出集結訊息 → 20:03 跳出「是否回防」→ 20:06 前要回應 → 20:30 前要進場（30 分鐘，最晚 21:00 打完）
 * 放棄城堡（攻城頁）：失去那座城；所有對你宣戰的血盟停戰、NPC 血盟的仇恨歸零，7 天內不會再結仇或被宣戰（自己宣戰就結束）；
 *     追殺你的紅人散去、之後不再追殺（同女神嘆息信徒 京）。城全部放掉時守城難度歸零。
 *     ‧不回防／3 分鐘內沒回應（不在線上、在副本裡）→ 擲骰：30% 失 1 座、50% 失 2 座、20% 沒事
 *     ‧被打的城隨機挑，主城（回城選的那座）最後才挑
 * 三、守城戰（副本）：30 分鐘、5 輪×5 波＝25 波，每波 8 名鏡像敵人（八職業各 1）；強度見 CFG.def.mult／roundAtk（治療規則改窄後：第 1～3 輪 ×0.6～2，第 4 輪 4.5～7.3、第 5 輪 7.5～10.3，後兩輪傷害 ×0.5／0.4）
 *     ‧倒下：全隊（你＋傭兵，每人每次倒下都算）合計只能倒下 5 次（CFG.downs），第 6 次＝失守。
 *       5 次以內你倒下：原地滿血復活，同一波改成「攻城模式」重打（奪回第 N 波）；打贏後下一波回到守城。30 分鐘照走
 *     ‧30 分鐘到還沒守完 25 波、或按「放棄守城」→ 失去被打的那座城
 *     ‧中途離開戰場（讀檔、關掉遊戲）：進度保留，計時不停；回來從那一波重打。還沒進場就到 21:00＝失守
 *     ‧守住：龍之鑽石 5,000、滅魔蔑視水晶四種各 20、至暗星塵 5、骸骨魔石 5、破空石 1、隨機靈魂石 10、密奧碎片 10
 * 四、失城：該城 7 天內不能宣戰（每座各自算）；城陷之恥 1 天（現實時間）：在狩獵區六項能力與四屬性抗性 −50（副本、村莊不算）
 * 五、奪回戰：7 天後對失去的城宣戰＝奪回戰（自己的副本）：5 波×8 名鏡像敵人（八職業各 1），強度 ×0.7→×1.5，第 2 波起放職業技能；
 *     你倒下＝奪回戰失敗；傭兵倒下照常復活，但全隊合計倒下第 6 次也算失敗；
 *     30 分鐘；贏＝拿回城＋龍之鑽石 5,000；輸＝照攻城戰敗 30 分鐘不能宣戰。鏡像敵人照遺物掉落率掉昇華支配 +0 遺物。
 * 六、豁免：身上裝滿 6 件至高的支配 → 不會被集結，也不會遇到敵對血盟（宣戰／強制宣戰）的人；自己宣戰照舊。
 * 七、守城戰流程中（集結～結算）不能宣戰；開關打開時，afk-castlewar 的「離線跨午夜 5% 失城」不再判定。經典模式沒有。
 * 鏡像敵人：開戰當下複製你的面板（最大 HP、一般攻擊傷害、命中、AC、迴避、魔防、傷害減免、四屬性抗性、攻擊速度、等級），
 *   乘上這一波的強度；遺物的觸發效果不複製。HP ×1（CFG.hpK）；迴避最多 50%（CFG.erCap）；
 *   一般攻擊的命中率最少 50%（CFG.hitFloor：含你的迴避在內，打你和傭兵都算）。
 *   隊伍人數：HP 再 ×(1 + 0.35 ×(人數 − 1))（CFG.partyStep）、傷害與命中再 ×(1 + 0.04 ×(人數 − 1))（CFG.partyAtkStep）；隊伍＝你＋進場當下的傭兵。
 *   守城戰、奪回戰裡傭兵造成的傷害 ×0.6、受到鏡像敵人的傷害 ×1.15（CFG.allyDealt／allyTaken）。
 *   治療：守城戰、奪回戰裡傭兵、城堡護衛回復的 HP 減半（CFG.healK，你自己不減半）；被鏡像敵人的技能打中的人 3 秒內無法治療（CFG.noHealSec，每次打中重新計時）。
 *   守城難度：每守住一次下一次 +1 級（最多 5 級，每級影子 HP +30%、傷害 +3%）；守城失敗（含不回防而失城）歸零。帳號共用。
 *   統一天下（全體血盟投降過）：Lv 0～10，起點 HP ×0.85、傷害 ×0.9，每級 HP +16.5%、傷害 +2.5%，Lv10＝一般 Lv5 的強度。
 *   第 5 輪裡 30 分鐘到＝撐住，算守城成功。
 *   越拖越強：每隻在場上每活 10 秒傷害 +10%，最多 +100%（CFG.rampEvery／rampStep／rampCap）。
 *   「物理、魔法反射」（取代遺物效果）：受到直接的物理／魔法攻擊時，把那一下傷害的 10% 反彈給攻擊者（你或那名傭兵），
 *   每隻 1 秒最多一次（CFG.reflectPct／reflectCdMs）。持續傷害、寵物、召喚物、武器特效不觸發；反彈的傷害不會再被反彈。
 * 測試：window.__afkSiege2（now 可覆寫、各步驟可強制觸發）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'siege2', name: '每週守城戰（攻城守城第二版）', group: '遊戲內容', seal: true, def: true,
    desc: '每週五 20:00～21:00 有血盟來攻你的城：回防進守城戰副本（30 分鐘 25 波），不回防就可能失去 1～2 座城；失去的城 7 天後可以打回來' });
  if (T && !T.enabled('siege2')) return;
  if (typeof DB === 'undefined' || !DB.mobs || typeof SIEGE_CITY === 'undefined' || !W.__afkCastleWar) { console.warn('[AFK-siege2] 找不到攻城／七城系統，略過'); return; }

  var CW = W.__afkCastleWar;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var cityName = function (c) { return (SIEGE_CITY[c] && SIEGE_CITY[c].name) || c; };

  // ── 設定（煙霧測試調整用的旋鈕都在這裡）──
  var CFG = {
    // 排程（玩家 11-04 03:58）：固定每週五（台灣時間）20:00 集結 → 20:03 宣戰問回防 → 20:06 前要回應 → 20:30 前要進場；
    //   守城戰 30 分鐘，最晚 21:00 打完。day：0＝週日…5＝週五
    tz: 8 * 3600000, day: 5, startH: 20, endH: 21, entryMin: 30, askDelay: 3 * 60000, answerWindow: 3 * 60000,
    peaceMs: 7 * 86400000,   // 放棄城堡後的和平期（現實時間）
    loss: [[0.30, 1], [0.50, 2], [0.20, 0]],
    lockMs: 7 * 86400000, shameMs: 86400000, shameVal: 50,
    // 守城戰：rounds 輪 × perRound 波；每波 size 名（八職業各 1）。強度：
    //   mult(w) = roundStart[r] + waveSteps[r] × k，r＝floor((w−1) ÷ perRound)（0 起算）、k＝(w−1) mod perRound
    //   11-03 11:19 原版：每輪起點 2、3、4、5、6，每波 +0.5（第 25 波 ×8）
    //   治療規則改窄後：第 1 輪 0.6～1、第 2 輪 1～1.4、第 3 輪 1.4～2、第 4 輪 4.5～7.3、第 5 輪 7.5～10.3（後兩輪 HP 高、傷害 ×0.5／0.4）
    //   roundAtk[r]：這一輪的傷害（不含 HP、命中）再 × roundAtk[r]——後兩輪 HP 照表升高、傷害壓低，打得慢的隊伍靠「越拖越強」被拖垮
    def: { rounds: 5, perRound: 5, size: 8, roundStart: [0.6, 1, 1.4, 4.5, 7.5], waveSteps: [0.1, 0.1, 0.15, 0.7, 0.7], roundAtk: [1, 1, 1, 0.5, 0.4],
      limitTicks: 18000, pause: 30, flipPause: 30,
      mult: function (w) { var D = CFG.def, r = Math.min(D.rounds - 1, Math.floor((w - 1) / D.perRound)), k = (w - 1) % D.perRound; return D.roundStart[r] + D.waveSteps[r] * k; },
      atkMult: function (w) { var D = CFG.def, r = Math.min(D.rounds - 1, Math.floor((w - 1) / D.perRound)); return (D.roundAtk && D.roundAtk[r] != null) ? D.roundAtk[r] : 1; } },
    retake: { waves: 5, size: 8, from: 0.7, to: 1.5, limitTicks: 18000, pause: 30, dia: 5000 },
    // 全隊（你＋傭兵）合計能倒下的次數；超過＝失守／奪回戰失敗（玩家 11-03 11:19）
    downs: 5,
    // 鏡像敵人「物理、魔法反射」：受到直接物理／魔法攻擊時反彈 10% 給攻擊者，每隻 1 秒最多一次（玩家 11-03 11:19）
    reflectPct: 0.10, reflectCdMs: 1000,
    // 隊伍人數（玩家 11-03 11:40）：鏡像敵人的 HP × (1 + partyStep × (隊伍人數 − 1))、傷害與命中 × (1 + partyAtkStep × (隊伍人數 − 1))（隊伍＝你＋進場當下的傭兵；8 人 HP ×3.45、傷害 ×1.28）
    //   守城戰、奪回戰裡傭兵造成的傷害 × allyDealt、受到的傷害 × allyTaken
    //   11:59 調整：HP 與傷害／命中分開（partyStep＝HP、partyAtkStep＝傷害與命中）
    // 鏡像越拖越強（玩家 11-03 核准）：每隻鏡像敵人在場上每活 rampEvery 秒，傷害 +rampStep，最多 +rampCap（守城戰、奪回戰都算）
    rampEvery: 10, rampStep: 0.10, rampCap: 1.0,
    // 守城難度（玩家 11-04）：每守住一次，下一次守城戰難度 +1 級（最多 lvMax 級）；守城失敗（含不回防而失城）歸零。
    //   每級鏡像敵人 HP +lvStep、傷害 +lvAtkStep（Lv5＝HP ×2.5、傷害 ×1.15）。帳號共用（跟城堡一樣存在帳號資料）。奪回戰不受影響。
    //   HP 加得多、傷害加得少：打得慢的隊伍在 30 分鐘內打不到第 5 輪，打得快的隊伍也不會被一下子打垮（11-04 模擬）
    lvMax: 5, lvStep: 0.3, lvAtkStep: 0.03,
    // 統一天下（七城統一後連續擊殺 1 萬名敵對 NPC、全體血盟投降；afk-castlewar 的 allWarDone，帳號共用）：起點較低、每級升得慢，
    //   但最高級跟一般的 Lv5 一樣強（終究守不住）：HP × (uHp0 + uHpStep × Lv)、傷害 × (uAtk0 + uAtkStep × Lv)，Lv 0～uMax
    uMax: 10, uHp0: 0.85, uHpStep: 0.165, uAtk0: 0.9, uAtkStep: 0.025,
    // 第 5 輪（第五階段）裡 30 分鐘到＝撐住了，算守城成功（玩家 11-04）；第 5 輪以前時間到照算失守
    holdRound: 5,
    // 治療（玩家 11-03 核准、同日改窄）：守城戰、奪回戰裡傭兵、城堡護衛回復的 HP × healK（你自己不減半）；
    //   被鏡像敵人的「技能」打中的人（含你）noHealSec 秒內完全不能回復 HP（每次打中重新計時；一般攻擊、戰士濺射不算）。復活不受影響。
    healK: 0.5, noHealSec: 3,
    partyStep: 0.35, partyAtkStep: 0.04, allyDealt: 0.6, allyTaken: 1.15,
    // 鏡像敵人的額外倍率（玩家 11-03 11:19：HP 回到 ×1；09:46：迴避上限 50%、命中率保底 50%）
    hpK: 1, atkK: 1, hitK: 1, erCap: 50, hitFloor: 0.5, skillFrom: 2,
    cd: { knight: 150, mage: 120, elf: 120, dark: 100, illusion: 150, dragon: 120 },
    knightStun: 0.80, dragonStun: 0.20, meteorK: 0.6, meteorN: 3, thunderK: 1.2, elfShots: 3, critK: 3, painSec: 64, painK: 0.30, painCap: 0.10, splash: 0.30,
    reward: { dia: 5000, contempt: 20, stardust: 5, bone: 5, void: 1, soul: 10, mio: 10 }
  };
  var CLASSES = ['royal', 'knight', 'elf', 'mage', 'dark', 'illusion', 'dragon', 'warrior'];
  var CLS_N = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士' };
  var AV = { royal: ['王子', '公主'], knight: ['男騎士', '女騎士'], elf: ['男妖精', '女妖精'], mage: ['男法師', '女法師'], dark: ['男黑暗妖精', '女黑暗妖精'], illusion: ['男幻術士', '女幻術士'], dragon: ['男龍騎士', '女龍騎士'], warrior: ['男戰士', '女戰士'] };
  var SKILL_N = { royal: '', knight: '全體衝擊之暈', elf: '三重矢', mage: '流星雨', dark: '會心一擊', illusion: '疼痛的歡愉', dragon: '奪命之雷', warrior: '' };
  var DEF_MAP = 'afk_siege2_def', RET_MAP = 'afk_siege2_retake';
  var MY_MAPS = {}; MY_MAPS[DEF_MAP] = '守城戰'; MY_MAPS[RET_MAP] = '奪回戰';

  // ── 時鐘（台灣時間；測試可覆寫 __afkSiege2.now）──
  var api = {};
  api.now = function () { return Date.now(); };
  var now = function () { return api.now(); };
  var dayNum = function (t) { return Math.floor((t + CFG.tz) / 86400000); };
  var dayStart = function (dn) { return dn * 86400000 - CFG.tz; };
  var dow = function (t) { return (dayNum(t) + 4) % 7; };   // 0＝週日（1970-01-01 是週四）
  var weekOf = function (t) { return dayNum(t) - dow(t); };   // 這一週週日的日序號＝週次

  // ── 存檔（帳號共用、只有一般模式；localStorage）──
  var KEY = 'afk_siege2_v1';
  var read = function () { try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  var store = function () {
    var o = read();
    o.lost = (o.lost && typeof o.lost === 'object') ? o.lost : {};
    o.shameUntil = Number(o.shameUntil) || 0;
    return o;
  };
  var write = function (o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  var unifiedAll = function () { try { var d = CW.data(); return !!(d && d.allWarDone); } catch (e) { return false; } };
  var lvMax = function () { return unifiedAll() ? CFG.uMax : CFG.lvMax; };
  var lvOf = function (o) { return Math.max(0, Math.min(lvMax(), Math.floor(Number((o || store()).level) || 0))); };
  var lvText = function (n) { return '守城難度 Lv ' + n + '／' + lvMax() + (unifiedAll() ? '（統一天下：守城難度起點降低、每級升得慢）' : ''); };
  var lvK = function (n) { n = Math.max(0, n || 0); return unifiedAll() ? CFG.uHp0 + CFG.uHpStep * n : 1 + CFG.lvStep * n; };
  var lvA = function (n) { n = Math.max(0, n || 0); return unifiedAll() ? CFG.uAtk0 + CFG.uAtkStep * n : 1 + (CFG.lvAtkStep || 0) * n; };

  var on = function () { return !(T && !T.enabled('siege2')); };
  W.__afkSiege2On = function () { return on(); };   // afk-castlewar：開著時不判定「離線跨午夜 5% 失城」
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var held = function () { try { return CW.held() || []; } catch (e) { return []; } };
  var homeCity = function () { try { return CW.homeCity(); } catch (e) { return null; } };
  var exempt = function (p) {
    p = p || P(); if (!p) return false;
    try { var RP = W.__afkRelicPlus; if (RP && RP.equippedEvo) return RP.equippedEvo(p).length >= 6; } catch (e) {}
    var n = 0; try { Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k], d = it && DB.items[it.id]; if (d && d.relicEvo != null) n++; }); } catch (e) {}
    return n >= 6;
  };

  // ── 週排程 ──
  var newWeek = function (wk, t, first) {
    var base = dayStart(wk + CFG.day), at = base + CFG.startH * 3600000;
    var c = { week: wk, day: CFG.day, assembleAt: at, askAt: at + CFG.askDelay, deadline: at + CFG.askDelay + CFG.answerWindow, endAt: at + CFG.entryMin * 60000, status: 'none' };
    if (first && t >= c.deadline) c.status = 'skip';   // 第一次開啟（或剛打開守城戰）時這週五已經過了：這週不算
    if (read().off) c.status = 'off';
    return c;
  };
  var ensureWeek = function (o) {
    var t = now(), wk = weekOf(t);
    if (!o.cur) { o.cur = newWeek(wk, t, true); return true; }
    if (o.cur.week !== wk) {
      settlePast(o, true);
      o.cur = newWeek(wk, t, false);
      return true;
    }
    return false;
  };

  // ── 失城 ──
  var rollCount = function () {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < CFG.loss.length; i++) { acc += CFG.loss[i][0]; if (r < acc) return CFG.loss[i][1]; }
    return 0;
  };
  var pickTargets = function (n, first) {
    var h = held(), home = homeCity(), out = [];
    if (first && h.indexOf(first) >= 0) out.push(first);
    var rest = h.filter(function (c) { return c !== home && out.indexOf(c) < 0; });
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = rest[i]; rest[i] = rest[j]; rest[j] = x; }
    rest.forEach(function (c) { if (out.length < n) out.push(c); });
    if (out.length < n && home && h.indexOf(home) >= 0 && out.indexOf(home) < 0) out.push(home);
    return out.slice(0, n);
  };
  var loseCastle = function (city, o, why) {
    var p = P(), d = CW.data();
    if (d.castles.indexOf(city) < 0) {
      var main0 = null; try { main0 = clanGetCastleCity(p); } catch (e) {}
      if (main0 !== city) return false;
    }
    var was = d.castles.length;
    if (d.npcOwners) delete d.npcOwners[city];
    d.castles = d.castles.filter(function (c) { return c !== city; });
    var main = null; try { main = clanGetCastleCity(p); } catch (e) {}
    if (main === city) {
      var next = d.castles.length ? d.castles[d.castles.length - 1] : null;
      try { var mk = (typeof clanModeKey === 'function') ? clanModeKey(p) : 'normal'; _clanWithLock(function (st) { var info = st.modes[mk]; if (!info) return { commit: false }; info.castle = next; return {}; }); } catch (e) {}
      try { rememberCastleOwnerCity(next); } catch (e) {}
    }
    if (d.home === city) d.home = null;
    if (was >= 7 && d.everUnified && !d.allWarDone) d.allWarDone = true;
    CW.save(d);
    try { if (typeof W.castleGuardsOnCastleLost === 'function') W.castleGuardsOnCastleLost(city); } catch (e) {}
    var t = now();
    o.lost[city] = { at: t, lockUntil: t + CFG.lockMs };
    o.shameUntil = Math.max(o.shameUntil || 0, t + CFG.shameMs);
    sys('<span class="text-red-400 font-bold">🏴 ' + esc(why || '敵軍') + '攻破了' + esc(cityName(city)) + '——你的血盟失去了這座城。</span><span class="text-slate-300">7 天內不能對它宣戰；你身上多了「城陷之恥」（1 天：在狩獵區六項能力與四屬性抗性 −50）。</span>');
    return true;
  };
  var afterLoss = function () { try { CW.syncWar(true); } catch (e) {} try { calcStats(); updateUI(); saveGame(); } catch (e) {} };
  // 不回防／沒回應：擲骰
  var noDefense = function (o, why) {
    var c = o.cur; if (!c) return 0;
    var n = rollCount(), lost = [];
    if (n > 0 && held().length) pickTargets(n, c.target).forEach(function (city) { if (loseCastle(city, o, c.clan ? '「' + c.clan + '」' : '')) lost.push(city); });
    c.status = 'resolved'; c.result = lost.length ? 'lost' : 'spared'; c.lostCities = lost; c.why = why || 'no';
    if (lost.length && lvOf(o)) { o.level = 0; sys('<span class="text-slate-300">城被攻破，守城難度歸零。</span>'); }
    if (!lost.length) sys('<span class="text-amber-200">' + (c.clan ? '「' + esc(c.clan) + '」' : '敵軍') + '在城下僵持了一陣，最後收兵離去——這次沒有失去任何城。</span>');
    write(o); if (lost.length) afterLoss();
    return lost.length;
  };
  // 上一週沒處理完的（離線、關掉遊戲）：補結算
  var settlePast = function (o, weekOver) {
    var c = o.cur; if (!c || c.status === 'resolved' || c.status === 'skip' || c.status === 'exempt' || c.status === 'off') return;
    if (o.off && c.status === 'none') { c.status = 'off'; return; }
    var t = now();
    if (c.status === 'none') {
      if (t < c.deadline && !weekOver) return;
      if (!eligible()) { c.status = 'skip'; return; }
      if (!c.clan) c.clan = clanName(); if (!c.target) c.target = pickTargets(1)[0] || null;
      noDefense(o, 'offline'); return;
    }
    if (c.status === 'assembled' || c.status === 'asked') { if (t >= c.deadline || weekOver) noDefense(o, 'noanswer'); return; }
    if (c.status === 'defending' && !run && (defExpired(c, t) || weekOver)) { if (defExpired(c, t)) timeUpOff(o, '時間到'); else defenseFail(o, '時間到'); }
  };
  var eligible = function () { var p = P(); return !!(p && !p.classicMode && held().length && !exempt(p)); };
  var clanName = function () {
    try { var w = npcClanGetWorld(P()); var cl = (w && w.clans || []).filter(Boolean); if (cl.length) return cl[Math.floor(Math.random() * cl.length)].name; } catch (e) {}
    return '黑旗';
  };

  // ── 每秒檢查 ──
  // 守城戰（不在戰場上時）：進過場＝30 分鐘照走（離開的時間也算）；還沒進過場＝21:00
  var defExpired = function (c, t) {
    if (c.prog) return (c.prog.used || 0) + Math.max(0, t - (c.prog.at || t)) / 100 >= CFG.def.limitTicks;
    return t >= c.endAt;
  };
  var step = function () {
    var p = P();
    if (run && p && p.dead && onMap()) onDeath();
    else if (run && (!p || !onMap())) finish(p && p.dead ? 'lose' : 'leave', p && p.dead ? '倒下' : '離開戰場');
    if (run && run.kind === 'def') saveProg();
    if (!p || classic()) { ui(); return; }
    var o = store(), changed = ensureWeek(o), c = o.cur, t = now();
    if (c && c.status === 'none' && o.off) { c.status = 'off'; changed = true; }
    if (c && c.status === 'none' && t >= c.assembleAt) {
      if (!held().length) { c.status = 'skip'; changed = true; }
      else if (exempt(p)) { c.status = 'exempt'; changed = true; }
      else if (t < c.deadline) { assemble(o); changed = false; }
      else { settlePast(o, false); changed = false; }
    }
    c = o.cur;
    if (c && c.status === 'assembled' && t >= c.askAt) { c.status = 'asked'; write(o); changed = false; }
    if (c && c.status === 'asked') {
      if (t >= c.deadline) { closePop(); noDefense(o, 'noanswer'); changed = false; }
      else if (!busy() && !popShown()) showPop();
    }
    if (c && c.status === 'defending' && !run && defExpired(c, t)) { if (c.prog) timeUpOff(o, '時間到'); else defenseFail(o, '21:00 前沒有進場'); changed = false; }
    if (changed) write(o);
    shameWatch();
    ui();
  };
  var assemble = function (o, force) {
    var c = o.cur; if (!c) return false;
    if (!force && !eligible()) return false;
    c.clan = c.clan || clanName(); c.target = c.target || pickTargets(1)[0] || null;
    if (force) { var t = now(); c.assembleAt = t; c.askAt = t + CFG.askDelay; c.deadline = c.askAt + CFG.answerWindow; c.endAt = Math.max(c.endAt || 0, t + 3600000); }
    c.status = 'assembled'; write(o);
    sys('<span class="text-red-400 font-bold">⚔ 「' + esc(c.clan) + '」血盟正在集結，目標是你的城堡……</span><span class="text-slate-300">（3 分鐘後宣戰）</span>');
    try { if (typeof showToast === 'function') showToast('⚔ 「' + c.clan + '」血盟正在集結，目標是你的城堡……'); } catch (e) {}
    return true;
  };
  var answer = function (yes) {
    var o = store(), c = o.cur; if (!c || (c.status !== 'asked' && c.status !== 'assembled')) return false;
    closePop();
    if (!yes) { noDefense(o, 'refuse'); ui(); return true; }
    c.status = 'defending'; c.lvl = lvOf(o); write(o);
    sys('<span class="text-amber-200 font-bold">🏰 你決定回防' + esc(cityName(c.target)) + '！</span><span class="text-slate-300">守城戰：30 分鐘內擋下 25 波敵軍。全隊合計只能倒下 5 次——你倒下會原地復活、改成攻城把那一波奪回來；第 6 次倒下、30 分鐘到還沒守完、或放棄，就會失去這座城。</span>');
    if (!busy()) enterDefense();
    ui(); return true;
  };
  var defenseFail = function (o, why) {
    var c = o.cur; if (!c) return;
    var city = c.target && held().indexOf(c.target) >= 0 ? c.target : pickTargets(1)[0];
    var ok = city ? loseCastle(city, o, c.clan ? '「' + c.clan + '」' : '') : false;
    c.status = 'resolved'; c.result = ok ? 'lost' : 'spared'; c.lostCities = ok ? [city] : []; c.why = why;
    var was = lvOf(o); o.level = 0;
    sys('<span class="text-red-300 font-bold">守城失敗' + (was ? '，' + lvText(0).replace('守城難度 ', '守城難度歸零（') + '）' : '') + '。</span>');
    write(o); if (ok) afterLoss();
  };
  // 不在戰場上時 30 分鐘到：進度已經在第 5 輪＝撐住了（守城成功），否則失守
  var timeUpOff = function (o, why) {
    var c = o.cur; if (!c) return;
    if (c.prog && Math.floor((c.prog.wave | 0) / CFG.def.perRound) + 1 >= CFG.holdRound) {
      var nl = Math.min(lvMax(), (c.lvl || 0) + 1);
      c.status = 'resolved'; c.result = 'defended'; c.why = '第 ' + CFG.holdRound + ' 輪撐到時間到'; delete c.prog; o.level = nl; write(o);
      sys('<span class="text-yellow-300 font-bold">🏆 守城成功！' + esc(cityName(c.target)) + '撐到了最後（第 ' + CFG.holdRound + ' 輪時間到）。</span><span class="text-orange-300 font-bold">　' + ((c.lvl || 0) >= lvMax() ? '守城難度維持 Lv ' + lvMax() + '（最高）' : '下次守城難度提升到 Lv ' + nl) + '</span>');
      grantDefense(); return;
    }
    defenseFail(o, why);
  };
  // ── 守城戰開關（血盟頁；帳號共用）：關掉＝不會被集結、沒有守城戰、不會因守城戰失城。守城難度保留。──
  var setOff = function (v) {
    var o = store(); ensureWeek(o); var c = o.cur;
    if (c && (c.status === 'assembled' || c.status === 'asked' || c.status === 'defending')) return '守城戰進行中，現在不能切換。';
    o.off = !!v;
    if (c) {
      if (v && c.status === 'none') c.status = 'off';
      else if (!v && c.status === 'off') c.status = now() < c.assembleAt ? 'none' : 'skip';   // 這週五已經開始或過了＝這週不算
    }
    write(o);
    sys(v ? '<span class="text-slate-300">🏰 你關掉了守城戰：之後不會有血盟來攻你的城（守城難度 Lv ' + lvOf(o) + ' 保留）。</span>'
          : '<span class="text-amber-200">🏰 你打開了守城戰：每週五 20:00～21:00 會有血盟來攻你的城。</span>');
    return null;
  };
  // ── 和平期（放棄城堡後）：NPC 血盟不結仇、不宣戰，七城宣戰與強制宣戰停止；自己宣戰就結束 ──
  var peaceLeft = function () { return Math.max(0, (Number(store().peaceUntil) || 0) - now()); };
  W.__afkClanPeace = function () { try { return on() && !classic() && peaceLeft() > 0; } catch (e) { return false; } };
  var endPeace = function (why) { var o = store(); if ((o.peaceUntil || 0) > now()) { o.peaceUntil = 0; write(o); sys('<span class="text-slate-300">和平期結束了（' + esc(why) + '）。</span>'); } };
  if (typeof W._npcClanApplyHatredLocked === 'function') {
    var oHate = W._npcClanApplyHatredLocked;
    W._npcClanApplyHatredLocked = function (clan, delta) { if (delta > 0 && W.__afkClanPeace()) return; return oHate.apply(this, arguments); };
    try { (0, eval)('_npcClanApplyHatredLocked = window._npcClanApplyHatredLocked'); } catch (e) {}
  }
  if (typeof W.npcClanSetWar === 'function') {
    var oSetWar = W.npcClanSetWar;
    W.npcClanSetWar = function (clanId, onWar) { var r = oSetWar.apply(this, arguments); try { if (onWar && W.__afkClanPeace()) endPeace('你對其他血盟宣戰'); } catch (e) {} return r; };
    try { (0, eval)('npcClanSetWar = window.npcClanSetWar'); } catch (e) {}
  }
  if (typeof W.pvpMarkForChase === 'function') {
    var oChase = W.pvpMarkForChase;
    W.pvpMarkForChase = function () { if (W.__afkClanPeace()) return; return oChase.apply(this, arguments); };
    try { (0, eval)('pvpMarkForChase = window.pvpMarkForChase'); } catch (e) {}
  }
  var makePeace = function () {
    var p = P(), cleared = 0, gone = 0;
    try {
      var mk = (typeof clanModeKey === 'function') ? clanModeKey(p) : 'normal';
      if (typeof _clanWithLock === 'function') _clanWithLock(function (st) {
        var w = st.npcWorlds && st.npcWorlds[mk]; if (!w || !Array.isArray(w.clans)) return { commit: false };
        w.clans.forEach(function (c) { if (!c) return; if (c.war || c.hostile) cleared++; c.war = false; c.warStartedAt = 0; c.hostile = false; c.hatred = 0; c.counterWarChance = 0; c.mercy = null; });
        return {};
      });
      try { (0, eval)('typeof _npcClanWarCache !== "undefined" && delete _npcClanWarCache[' + JSON.stringify(mk) + ']'); } catch (e) {}
    } catch (e) {}
    try { var d = CW.data(); d.warIds = []; d.forced = null; CW.save(d); } catch (e) {}
    try {   // 追殺你的紅人散去，之後不再追殺（同女神嘆息信徒 京的永久解除）
      var ch = (p.trollPlayers || []).filter(Boolean); gone = ch.length;
      ch.forEach(function (t) { try { if (typeof pvpReleaseAlignLock === 'function') pvpReleaseAlignLock(t.n); } catch (e) {} });
      p.trollPlayers = [];
      (mapState.mobs || []).forEach(function (m, i) { if (m && m.trollPlayer) mapState.mobs[i] = null; });
      (p.pvpKillWhispers || []).forEach(function (w) { if (w) { w.awaitingRevenge = false; w.revengeCount = 99; w.expiresAt = Date.now(); w.nextCheckAt = 0; } });
      p.afkRedGuardUntil = Number.MAX_SAFE_INTEGER;
    } catch (e) {}
    var o = store(); o.peaceUntil = now() + CFG.peaceMs; write(o);
    try { CW.syncWar(true); } catch (e) {}
    return { clans: cleared, chasers: gone };
  };
  // ── 放棄城堡（攻城頁）──
  var abandon = function (city) {
    var p = P(); if (!p || classic()) return '經典模式沒有這個功能。';
    if (flowActive()) return '守城戰進行中，現在不能放棄城堡。';
    try { if (p.siege && p.siege.active) return '攻城戰進行中，現在不能放棄城堡。'; } catch (e) {}
    if (held().indexOf(city) < 0) return '你沒有這座城。';
    var d = CW.data(), was = d.castles.length;
    if (d.npcOwners) delete d.npcOwners[city];
    d.castles = d.castles.filter(function (c) { return c !== city; });
    var main = null; try { main = clanGetCastleCity(p); } catch (e) {}
    if (main === city) {
      var next = d.castles.length ? d.castles[d.castles.length - 1] : null;
      try { var mk = (typeof clanModeKey === 'function') ? clanModeKey(p) : 'normal'; _clanWithLock(function (st) { var info = st.modes[mk]; if (!info) return { commit: false }; info.castle = next; return {}; }); } catch (e) {}
      try { rememberCastleOwnerCity(next); } catch (e) {}
    }
    if (d.home === city) d.home = null;
    if (was >= 7 && d.everUnified && !d.allWarDone) d.allWarDone = true;
    CW.save(d);
    try { if (typeof W.castleGuardsOnCastleLost === 'function') W.castleGuardsOnCastleLost(city); } catch (e) {}
    var o = store(), lv0 = lvOf(o), reset = !held().length && lv0 > 0;
    if (!held().length) { o.level = 0; write(o); }
    var r = makePeace();
    sys('<span class="text-amber-200 font-bold">🏳 你放棄了' + esc(cityName(city)) + '。</span><span class="text-slate-300">'
      + (r.clans ? '對你宣戰的 ' + r.clans + ' 個血盟收兵停戰，' : '') + 'NPC 血盟的仇恨一筆勾銷，' + Math.round(CFG.peaceMs / 86400000) + ' 天內不會再跟你結仇或宣戰（你自己宣戰就結束）；'
      + (r.chasers ? '追殺你的 ' + r.chasers + ' 名紅人散去，' : '') + '之後也不會再有紅人追殺你。' + (reset ? '城全部放掉了，守城難度歸零。' : '') + '</span>');
    afterLoss();
    return null;
  };
  var giveUp = function () {
    var o = store(), c = o.cur; if (!c || c.status !== 'defending') return false;
    if (run) finish('lose', '放棄守城', true);
    o = store(); defenseFail(o, '放棄守城'); ui(); return true;
  };

  // ── 城陷之恥：在狩獵區六項能力、四屬性抗性 −50 ──
  var DUNGEON_RX = /^(afk_traitor_whisper|afk_hardin_time|afk_giltas_altar|afk_flame_depth|afk_halpas_nest|afk_final_sea|afk_soul_room|rift_battle)$/;
  var inHunt = function () {
    try {
      var c = (typeof mapState !== 'undefined' && mapState) ? mapState.current || '' : ''; if (!c || /^town_/.test(c) || MY_MAPS[c] || DUNGEON_RX.test(c)) return false;
      if (!(Array.isArray(DB.maps[c]) && DB.maps[c].length)) return false;
      if (typeof isSiegeArea === 'function' && isSiegeArea(c)) return false;
      if (typeof SIEGE_CASTLES !== 'undefined' && SIEGE_CASTLES.indexOf(c) >= 0) return false;
      if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[c]) return false;
      if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(c) >= 0) return false;
      if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[c]) return false;
      var s = S(); if (s.antharas || s.riftRun || s.dreamStar || s.prideClimb || s.oblivion || s._afkFinal || s.pvpDuel) return false;
      var C = W.AFK_CARD_COMBAT; if (C && C.inDungeon && C.inDungeon()) return false;
      return true;
    } catch (e) { return false; }
  };
  var shameLeft = function () { if (!on() || classic()) return 0; return Math.max(0, store().shameUntil - now()); };
  var shameOn = function () { return shameLeft() > 0 && inHunt(); };
  var shameKey = null;
  var shameWatch = function () { var k = shameOn(); if (shameKey !== null && k !== shameKey) { try { calcStats(); } catch (e) {} } shameKey = k; };
  var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'], RES = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var hookStats = function () {   // 等所有外掛都包完再包在最外層（不然被其他外掛加回去）
    var oBoost = W.__afkAttrBoost;
    W.__afkAttrBoost = function (p, d) {
      var r; if (typeof oBoost === 'function') r = oBoost.apply(this, arguments);
      try {
        if (p === player && d && shameOn()) {
          var cap = (typeof W.__afkAttrCap === 'function') ? W.__afkAttrCap() : 100;
          ABIL.forEach(function (k) { d[k] = Math.max(1, Math.min(cap, Number(d[k]) || 0) - CFG.shameVal); });
        }
      } catch (e) {}
      return r;
    };
    if (typeof W.recomputeStats === 'function') {
      var oRe = W.recomputeStats;
      W.recomputeStats = function () {
        var r = oRe.apply(this, arguments);
        try { if (player && player.d && shameOn()) RES.forEach(function (k) { player.d[k] = (Number(player.d[k]) || 0) - CFG.shameVal; }); } catch (e) {}
        return r;
      };
      try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
    }
  };
  if (document.readyState === 'complete') hookStats(); else W.addEventListener('load', hookStats);

  // ── 豁免：不會遇到敵對血盟（宣戰、強制宣戰）的人 ──
  ['__afkWantHostile', '__afkForceTroll'].forEach(function (nm) {
    var o = W[nm]; if (typeof o !== 'function') return;
    W[nm] = function () { try { if (on() && !classic() && exempt()) return nm === '__afkWantHostile' ? false : null; } catch (e) {} return o.apply(this, arguments); };
  });

  // ── 副本：共用 ──
  DB.maps[DEF_MAP] = []; DB.maps[RET_MAP] = [];
  W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([DEF_MAP, RET_MAP]);
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') { SANCTUARY_MAP_NAMES[DEF_MAP] = '守城戰'; SANCTUARY_MAP_NAMES[RET_MAP] = '奪回戰'; } } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined') { MAP_DESC[DEF_MAP] = '敵對血盟的軍隊正在攻城。30 分鐘內擋下 25 波敵軍就守住了；全隊合計只能倒下 5 次，你倒下會轉為攻城，把那一波奪回來。'; MAP_DESC[RET_MAP] = '奪回被攻下的城堡：擊退 5 波守軍。'; } } catch (e) {}
  var run = null;   // { kind:'def'|'ret', city, t0, wave, waves, queue, pauseUntil, snap, mode:'def'|'atk', flips, flipNext }
  var onMap = function () { return !!(typeof mapState !== 'undefined' && mapState && MY_MAPS[mapState.current]); };
  var busy = function () {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (p.dead) return '倒下的狀態不能進場。';
    var s = S(), cur = (typeof mapState !== 'undefined' && mapState) ? mapState.current || '' : '';
    if (run || MY_MAPS[cur]) return '你已經在戰場上了。';
    if (s.riftRun || s.dreamStar || s.prideClimb || s.oblivion || s.antharas || s._afkFinal || s.pvpDuel) return '正在進行副本或挑戰，先結束再說。';
    if (p.siege && p.siege.active) return '攻城戰進行中。';
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(cur)) return '攻城戰進行中。'; } catch (e) {}
    if (DUNGEON_RX.test(cur)) return '副本裡不能離開。';
    try { var C = W.AFK_CARD_COMBAT; if (C && C.inDungeon && C.inDungeon()) return '副本裡不能離開。'; } catch (e) {}
    var ps = p.statuses || {};
    if (ps.stone > 0 || ps.paralyze > 0 || ps.freeze > 0 || ps.stun > 0 || ps.sleep > 0) return '目前無法行動。';
    return null;
  };
  var showBattle = function () {
    if (S().ff) return;
    try {
      var tv = document.getElementById('town-view'), mapPanel = tv.parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      tv.classList.add('hidden'); tv.classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
  };
  var slots = function () { try { return backSlotsActive() ? 5 : 3; } catch (e) { return 3; } };
  var tk = function () { return S().ticks || 0; };

  // ── 鏡像敵人 ──
  var snapPanel = function () {
    var p = P(); if (!p || !p.d) return null;
    var d = p.d, w = p.eq && p.eq.wpn, wd = w && DB.items[w.id];
    var die = wd ? ((Number(wd.dmgS) || 1) + 1) / 2 + (Number(w.en) || 0) : 2;
    var atk = die + Math.max(Number(d.meleeDmg) || 0, Number(d.rangedDmg) || 0) + (Number(d.extraDmg) || 0);
    var iv = 1; try { iv = (typeof playerAttackIntervalTicks === 'function') ? playerAttackIntervalTicks() / 10 : 1; } catch (e) {}
    var fem = /^女|公主/.test(String(p.avatar || ''));
    return { lv: p.lv || 1, hp: p.mhp || 1000, atk: Math.max(1, atk), hit: Math.max(Number(d.meleeHit) || 0, Number(d.rangedHit) || 0), ac: Number(d.ac) || 0, er: Number(d.er) || 0,
      mr: Number(d.mr) || 0, dr: Number(d.dr) || 0, resFire: Number(d.resFire) || 0, resWater: Number(d.resWater) || 0, resWind: Number(d.resWind) || 0, resEarth: Number(d.resEarth) || 0,
      spd: Math.max(0.3, iv), fem: fem };
  };
  var effEr = function (v) { try { return effResistPct(v); } catch (e) { return v <= 50 ? Math.max(0, v) : 50 + Math.floor((v - 50) / 5); } };
  var partyK = function (n, step) { return 1 + (step == null ? CFG.partyStep : step) * Math.max(0, (n || 1) - 1); };
  var partySize = function () { var p = P(); return 1 + ((p && p.allies) || []).filter(Boolean).length; };
  var buildMirror = function (cls, k, wave, pn, pk, pa, ak) {   // ak：只乘傷害的額外倍率（守城戰後段）   // pk：HP 的隊伍倍率；pa：傷害、命中的隊伍倍率（沒給＝pk）
    pn = pn || snapPanel(); if (!pn) return null;
    pk = pk || 1; pa = pa || pk;
    var base = DB.mobs['troll_' + cls] || DB.mobs.troll_warrior;
    var m = JSON.parse(JSON.stringify(base));
    ['trollPlayer', 'scale', 'mag', 'mag2', 'mag3', 'mag4', 'mag5', 'regenFix', 'onHitPoison', 'magicMelee', 'doubleDestroy', 'wild'].forEach(function (x) { delete m[x]; });
    var av = AV[cls][pn.fem ? 1 : 0];
    m.n = CLS_N[cls] + '之影'; m.race = '玩家'; m.beh = '主動'; m.boss = false; m.e = 'none';
    m.noCharm = true;   // 玩家的影子：迷魅術（核心、afk-charm 改版）對它無效
    m.lv = pn.lv; m.exp = 0; m.goldMin = 0; m.goldMax = 0; m.noGold = true; m.regenHp = 0;
    var hp = Math.max(1, Math.round(pn.hp * k * pk * CFG.hpK));
    m.hp = hp; m.curHp = hp;
    var e = Math.max(1, Math.round(pn.atk * k * pa * (ak || 1) * CFG.atkK));
    m.dmg = [1, Math.max(1, Math.round(e * 0.4))]; m.db = Math.max(0, Math.round(e * 0.8));
    m.hit = Math.round(pn.hit * k * pa * CFG.hitK); m.ac = Math.round(pn.ac * k); m.mr = Math.round(pn.mr * k); m.dr = Math.max(0, Math.round(pn.dr * k));
    var cap = (typeof W.__afkEvadeCap === 'number') ? Math.min(W.__afkEvadeCap, CFG.erCap) : CFG.erCap;
    m.er = Math.max(0, Math.min(cap, effEr(Math.round(pn.er * k))));
    RES.forEach(function (r) { m[r] = Math.round(pn[r] * k); });
    m.atkSpd = pn.spd;
    m._s2Cls = cls; m._s2Wave = wave; m._s2K = k; m._s2Mirror = true; m._s2PK = pk; m._pvpAvatar = av; m._s2Atk = e;
    m._s2cd = Math.floor((CFG.cd[cls] || 100) * (0.4 + Math.random() * 0.6));
    m.img = 'assets/classanim/' + av + 'F/unarmed_idle_0.png';
    return m;
  };
  var placeMirror = function (idx, m) {
    try {
      if (typeof MOB_ANIM_NAMES !== 'undefined' && typeof MOB_ANIM_ALIAS !== 'undefined') {
        var dir = '玩家' + m._pvpAvatar;
        if (MOB_ANIM_ALIAS[m.n] !== dir) { MOB_ANIM_ALIAS[m.n] = dir; try { if (typeof _mobAnimCache !== 'undefined') delete _mobAnimCache[m.n]; } catch (e) {} }
        MOB_ANIM_NAMES.add(m.n); if (typeof MOB_ANIM_SPRITE_SHADOW !== 'undefined') MOB_ANIM_SPRITE_SHADOW.add(m.n);
      }
    } catch (e) {}
    m._s2At = tk(); m._s2Ramp = 0; m._s2Base = { d: m.dmg.slice(), db: m.db, atk: m._s2Atk };
    Object.assign(m, { uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
    mapState.mobs[idx] = m;
    return m;
  };
  var waveMult = function (kind, w) {   // w：0 起算
    if (kind === 'ret') { var R = CFG.retake; return R.from + (R.to - R.from) * w / Math.max(1, R.waves - 1); }
    return CFG.def.mult(w + 1);
  };
  var defWaves = function () { return CFG.def.rounds * CFG.def.perRound; };
  var waveClasses = function (kind, w) {
    var size = kind === 'ret' ? CFG.retake.size : CFG.def.size, out = [];
    for (var i = 0; i < size; i++) out.push(CLASSES[(w * size + i) % CLASSES.length]);
    for (var j = out.length - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)); var x = out[j]; out[j] = out[r]; out[r] = x; }
    return out;
  };

  // ── 職業技能（第 2 波起）──
  var members = function () {
    var out = []; var p = P(); if (!p) return out;
    if (!p.dead) out.push(p);
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); });
    return out;
  };
  var hurt = function (t, dmg) {
    dmg = Math.max(1, Math.floor(dmg));
    if (t === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); return true; } return false; }
    if (isAlly(t)) dmg = Math.floor(dmg * CFG.allyTaken);
    t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; }
    return false;
  };
  var magicSk = function (m, skn, k, ele) { var e = m._s2Atk * k; return { skn: skn, dmg: [1, Math.max(1, Math.round(e * 0.4))], db: Math.round(e * 0.8), ele: ele || 'none', alwaysHit: true }; };
  try { if (typeof MOB_PARTY_AOE_SKILLS !== 'undefined') ['流星雨', '奪命之雷', '全體衝擊之暈'].forEach(function (n) { MOB_PARTY_AOE_SKILLS.add(n); }); } catch (e) {}
  var stunAll = function (m, pct, skn) {
    members().forEach(function (t) {
      if (m.curHp <= 0 || player.dead) return;
      var mr = (t.d && Number(t.d.mr)) || 0, sk = { type: 'stun', skn: skn, pbase: pct * 200 + mr };
      try { if (t === player) applyMobMagic(m, sk); else applyMobMagicToAlly(m, sk, t); } catch (e) {}
    });
  };
  var tag = function (m, t) { return '<span class="font-bold text-red-300">【' + t + '】</span>' + esc(m.n) + ' '; };
  var castSkill = function (m, idx) {
    var prev = casting; casting = m;
    try { castSkill0(m, idx); } finally { casting = prev; }
  };
  var castSkill0 = function (m, idx) {
    var cls = m._s2Cls;
    if (typeof api.onCast === 'function') { try { api.onCast(m); } catch (e) {} }
    if (cls === 'knight') { clog(tag(m, SKILL_N.knight) + '一記重擊震盪整個戰場！'); stunAll(m, CFG.knightStun, SKILL_N.knight); }
    else if (cls === 'mage') { clog(tag(m, SKILL_N.mage) + '召來 ' + CFG.meteorN + ' 道流星！'); for (var i = 0; i < CFG.meteorN; i++) { if (player.dead || m.curHp <= 0) break; try { castMobMagic(m, magicSk(m, '流星雨', CFG.meteorK, 'fire')); } catch (e) {} } }
    else if (cls === 'elf') {
      clog(tag(m, SKILL_N.elf) + '連射 ' + CFG.elfShots + ' 次，箭雨落向全隊！');
      for (var s = 0; s < CFG.elfShots; s++) members().forEach(function (t) { if (player.dead || m.curHp <= 0) return; try { if (t === player) enemyPhysicalAttack(m, idx); else enemyAttackAlly(m, t); } catch (e) {} });
    }
    else if (cls === 'dark') {
      var d0 = m.dmg, b0 = m.db; m.dmg = [d0[0], Math.round(d0[1] * CFG.critK)]; m.db = Math.round(b0 * CFG.critK);
      clog(tag(m, SKILL_N.dark) + '凝聚全身之力，致命一擊！');
      try { enemyAttackChooseVictim(m, idx); } catch (e) {} finally { m.dmg = d0; m.db = b0; }
    }
    else if (cls === 'illusion') { m._s2PainUntil = tk() + CFG.painSec; clog(tag(m, SKILL_N.illusion) + '迎向疼痛——' + (CFG.painSec / 10) + ' 秒內打它的人會被反噬。'); }
    else if (cls === 'dragon') {
      clog(tag(m, SKILL_N.dragon) + '落雷劈向全隊！');
      try { castMobMagic(m, magicSk(m, '奪命之雷', CFG.thunderK, 'wind')); } catch (e) {}
      if (!player.dead && m.curHp > 0) stunAll(m, CFG.dragonStun, SKILL_N.dragon);
    }
  };
  // 戰士：一般攻擊濺射全隊 30%
  if (typeof W.enemyAttackChooseVictim === 'function') {
    var oEACV = W.enemyAttackChooseVictim;
    W.enemyAttackChooseVictim = function (mob, idx) {
      if (!(mob && mob._s2Mirror && mob._s2Cls === 'warrior' && mob._s2Wave >= CFG.skillFrom - 1 && onMap())) return oEACV.apply(this, arguments);
      var ms = members(), before = ms.map(function (t) { return t === player ? player.hp : t.curHp; });
      var r = oEACV.apply(this, arguments);
      try {
        var hitAmt = 0, victim = null;
        ms.forEach(function (t, i) { var now1 = t === player ? player.hp : t.curHp; var dd = before[i] - now1; if (dd > hitAmt) { hitAmt = dd; victim = t; } });
        if (hitAmt > 0) ms.forEach(function (t) { if (t !== victim && !player.dead) { if (t !== player && (t._downed || t.curHp <= 0)) return; var sp = hitAmt * CFG.splash; if (W.__afkPetTank) sp = W.__afkPetTank.split(t, Math.max(1, Math.floor(sp))); if (sp > 0) hurt(t, sp); } });   // 寵物頑強抵抗：濺射由出戰寵物分擔（afk-pettank.js）
      } catch (e) {}
      return r;
    };
    try { (0, eval)('enemyAttackChooseVictim = window.enemyAttackChooseVictim'); } catch (e) {}
  }
  // 命中率保底（玩家 11-03 09:46）：鏡像敵人的一般攻擊（打你、打傭兵）最少 CFG.hitFloor 打中。
  //   先估這一下自然的命中率 p＝(1 − 對方有效迴避) × d20 命中率；p 不到保底時，以 (保底 − p) ÷ (1 − p) 的機率直接打中
  //   （這一下不能迴避、d20 當 2、命中 +1000），合起來剛好＝保底。暗隱術的必定迴避、恐懼落空等照舊。
  var forceRoll = null;
  if (typeof W.roll === 'function') {
    var oRoll = W.roll;
    W.roll = function (n, s) {
      var f = forceRoll;
      if (f && n === 1) {
        if (s === 100 && !f.ev) { f.ev = true; return 101; }
        if (s === 20) { forceRoll = null; return 2; }
      }
      return oRoll(n, s);
    };
    try { (0, eval)('roll = window.roll'); } catch (e) {}
  }
  var natHit = function (mob, t) {
    try {
      var me = t === player, d = (me ? player.d : t.d) || {}, lv = me ? player.lv : (t.lv || 1);
      var cap = W.__afkEvadeCap || 100, ev = d.noEvade ? 0 : Math.min(cap, effResistPct(Number(d.er) || 0)) / 100;
      var raw = (Number(mob.lv) || 1) + (Number(mob.hit) || 0) - (lv || 1) + ((Number(d.ac) || 0) - (typeof teamAcBonus === 'function' ? teamAcBonus(t) : 0));
      var hv = Math.max(1, Math.min(20, stretchedHitExpectedValue(raw)));
      return Math.max(0, Math.min(1, (1 - ev) * (1 + Math.max(0, Math.min(18, hv - 1))) / 20));
    } catch (e) { return 0; }
  };
  var floorChance = function (mob, t) { var p = natHit(mob, t), fl = CFG.hitFloor; return p >= fl ? 0 : (fl - p) / (1 - p); };
  var withFloor = function (nm, victim) {
    var orig = W[nm]; if (typeof orig !== 'function') return;
    W[nm] = function (mob) {
      if (!(mob && mob._s2Mirror && CFG.hitFloor > 0 && onMap())) return orig.apply(this, arguments);
      var t = victim(arguments); if (!t || !(Math.random() < floorChance(mob, t))) return orig.apply(this, arguments);
      var h0 = mob.hit; forceRoll = { ev: false }; mob.hit = Math.max(0, Number(h0) || 0) + 1000;
      if (typeof api.onForce === 'function') { try { api.onForce(mob, t); } catch (e) {} }
      try { return orig.apply(this, arguments); } finally { forceRoll = null; mob.hit = h0; }
    };
    try { (0, eval)(nm + ' = window.' + nm); } catch (e) {}
  };
  withFloor('enemyPhysicalAttack', function () { return player; });
  withFloor('enemyAttackAlly', function (a) { return a[1]; });
  var isAlly = function (a) { return !!(a && typeof player !== 'undefined' && a !== player && (player.allies || []).indexOf(a) >= 0); };
  // 傭兵受到鏡像敵人的傷害 × allyTaken（核心打傭兵的路徑都先過遺物受傷處理；技能濺射另外在 hurt 乘）
  var hookedIn = false;
  var hookIncoming = function () {
    var RT = W.AFK_RELIC_RUNTIME; if (hookedIn || !RT || typeof RT.incoming !== 'function') return;
    hookedIn = true; var oI = RT.incoming;
    RT.incoming = function (actor, amount, attacker) {
      var a = arguments;
      try { if (run && onMap() && attacker && attacker._s2Mirror && isAlly(actor) && amount > 0 && CFG.allyTaken !== 1) { a = Array.prototype.slice.call(arguments); a[1] = Math.floor(amount * CFG.allyTaken); } } catch (e) {}
      var r = oI.apply(this, a);
      try { var op = arguments[3] || {}; if (run && onMap() && casting && attacker && attacker._s2Mirror && attacker === casting && r > 0 && op.origin !== 'reflection') markNoHeal(actor); } catch (e) {}
      return r;
    };
  };
  // ── 治療減半、無法治療：把我方的 HP 欄位換成 getter／setter，回血時打折（戰鬥結束換回一般欄位）──
  var healBypass = false, healed = [], casting = null;   // casting：正在放技能的鏡像敵人（只有技能打中才「無法治療」）
  var markNoHeal = function (t) { if (t && CFG.noHealSec > 0) t._s2NoHeal = tk() + Math.round(CFG.noHealSec * 10); };
  var noHealOn = function (t) { return !!(t && (t._s2NoHeal || 0) > tk()); };
  var healFilter = function (o, cur, v) {
    if (healBypass || !run || !onMap() || typeof v !== 'number' || typeof cur !== 'number' || !(v > cur) || !(cur > 0)) return v;
    if (o === player && player.dead) return v;
    if (o._downed) return v;
    var inc = noHealOn(o) ? 0 : (o === player ? (v - cur) : (v - cur) * CFG.healK);   // 減半只算傭兵、城堡護衛；你自己不減半
    if (typeof api.onHeal === 'function') { try { api.onHeal(o, v - cur, inc); } catch (e) {} }
    return cur + inc;
  };
  var guardHp = function (o, key) {
    if (!o || typeof o !== 'object' || o.__s2HealKey) return;
    var d = Object.getOwnPropertyDescriptor(o, key); if (!d || !('value' in d) || !d.configurable) return;
    var val = d.value;
    Object.defineProperty(o, key, { configurable: true, enumerable: true, get: function () { return val; }, set: function (v) { val = healFilter(o, val, v); } });
    Object.defineProperty(o, '__s2HealKey', { configurable: true, enumerable: false, writable: true, value: key });
    healed.push(o);
  };
  var unguardAll = function () {
    healed.forEach(function (o) { try { var key = o.__s2HealKey, v = o[key]; delete o[key]; o[key] = v; delete o.__s2HealKey; delete o._s2NoHeal; } catch (e) {} });
    healed = [];
  };
  var guardParty = function () {
    if (!(CFG.healK < 1 || CFG.noHealSec > 0)) return;
    var p = P(); if (!p) return;
    guardHp(p, 'hp');
    (p.allies || []).forEach(function (a) { guardHp(a, 'curHp'); });
    try { if (typeof guardV2List === 'function') guardV2List().forEach(function (g) { guardHp(g, 'hp'); }); } catch (e) {}
  };
  // 幻術士：疼痛的歡愉（反噬：受到的傷害 30%，每下最多攻擊者最大 HP 10%）
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return;
    hooked = true; var oD = C.damage;
    C.damage = function (actor, target, amount) {
      var r = oD.apply(this, arguments);
      try { if (r > 0 && run && target && target._s2Mirror && isAlly(actor) && CFG.allyDealt !== 1) r = Math.max(1, Math.floor(r * CFG.allyDealt)); } catch (e) {}   // 傭兵造成的傷害 × allyDealt
      try {
        if (r > 0 && target && target._s2Mirror && (target._s2PainUntil || 0) > tk() && actor && (actor === player || (player.allies || []).indexOf(actor) >= 0)) {
          var mhp = actor === player ? player.mhp : (actor.mhp || 1);
          if (actor === player ? !player.dead : !actor._downed) hurt(actor, Math.min(r * CFG.painK, mhp * CFG.painCap));
        }
      } catch (e) {}
      return r;
    };
  };

  // 鏡像敵人：物理、魔法反射（核心的直擊掛點 reflectWallOnDamage：一般攻擊主擊、主動技能直擊；ally＝出手的傭兵）
  //   反彈傷害走核心血壁空間同一條路（遺物的受傷處理 origin:'reflection'）；反彈給你／傭兵的傷害本來就不經過這個掛點，加上 busy 旗標，不會來回反彈。
  var reflecting = false, curAlly = null;
  if (typeof W.processAllyStatusTick === 'function') {   // 傭兵回合裡有些直擊掛點沒帶 ally（同 afk-dreamcost）：記下正在行動的傭兵
    var oPAS = W.processAllyStatusTick;
    W.processAllyStatusTick = function (ally) { curAlly = ally || null; return oPAS.apply(this, arguments); };
    try { (0, eval)('processAllyStatusTick = window.processAllyStatusTick'); } catch (e) {}
  }
  var actingAlly = function () { try { return (curAlly && !curAlly._downed && typeof _dpsAllyTurn !== 'undefined' && _dpsAllyTurn) ? curAlly : null; } catch (e) { return null; } };
  if (typeof W.reflectWallOnDamage === 'function') {
    var oRWD = W.reflectWallOnDamage;
    W.reflectWallOnDamage = function (mob, dmg, kind, ally) {
      var r = oRWD.apply(this, arguments);
      try { if (mob && mob._s2Mirror) mirrorReflect(mob, dmg, kind, ally); } catch (e) {}
      return r;
    };
    try { (0, eval)('reflectWallOnDamage = window.reflectWallOnDamage'); } catch (e) {}
  }
  var mirrorReflect = function (mob, dmg, kind, ally) {
    if (reflecting || !run || !onMap() || !(CFG.reflectPct > 0) || !(dmg > 0) || mob._dead || mob.curHp <= 0) return 0;
    if (kind !== 'melee' && kind !== 'ranged' && kind !== 'magic') return 0;
    var t = tk(), cd = Math.max(0, Math.round((CFG.reflectCdMs || 0) / 100));
    if (mob._s2RefAt != null && t - mob._s2RefAt < cd) return 0;
    if (!ally) ally = actingAlly();
    var who = ally && ally !== player ? ally : player;
    if (who === player ? player.dead : (who._downed || (who.curHp || 0) <= 0)) return 0;
    mob._s2RefAt = t;
    var v = Math.max(1, Math.floor(dmg * CFG.reflectPct)), RT = W.AFK_RELIC_RUNTIME, kn = kind === 'magic' ? '魔法' : '物理';
    reflecting = true;
    try {
      if (RT && RT.incoming) v = RT.incoming(who, v, mob, { kind: kind, origin: 'reflection', main: false, direct: true });
      v = Math.max(0, Math.floor(Number(v) || 0));
      if (who === player) {
        player.hp -= v;
        try { if (RT && RT.afterIncoming) RT.afterIncoming(player, v, mob); } catch (e) {}
        clog('<span class="font-bold" style="color:#f87171">【物理、魔法反射】</span>' + esc(mob.n) + ' 反彈了' + kn + '傷害，你受到 ' + v + ' 點傷害！');
        if (player.hp <= 0 && typeof killPlayer === 'function') killPlayer();
      } else {
        who.curHp -= v;
        try { if (RT && RT.afterIncoming) RT.afterIncoming(who, v, mob); } catch (e) {}
        clog('<span class="font-bold" style="color:#f87171">【物理、魔法反射】</span>' + esc(mob.n) + ' 反彈了' + kn + '傷害，協力·' + esc(who._allyName || '') + ' 受到 ' + v + ' 點傷害！');
        if (who.curHp <= 0) { who.curHp = 0; who._downed = true; who._reviveCd = 150; try { if (!S().ff) renderSquadPanel(); } catch (e) {} }
      }
    } finally { reflecting = false; }
    if (typeof api.onReflect === 'function') { try { api.onReflect(mob, who, v, kind); } catch (e) {} }
    return v;
  };

  // ── 副本流程 ──
  var cityBg = function (city, atk) {   // 守城＝內城；攻城模式＝外門區（城門、守護塔那一帶）
    try {
      var cfg = SIEGE_CITY[city]; if (!cfg) return null;
      return atk ? (SPECIAL_AREA_BG[cfg.outer] || SPECIAL_AREA_BG[cfg.inner]) : (SPECIAL_AREA_BG[cfg.inner] || SPECIAL_AREA_BG[cfg.outer]);
    } catch (e) { return null; }
  };
  var setBg = function (map, city, atk) {
    try { var bg = cityBg(city, atk); if (bg) SPECIAL_AREA_BG[map] = bg; } catch (e) {}
    try { if (!S().ff && typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
  };
  var enterMap = function (map, city) {
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    try { var bg = cityBg(city, false); if (bg) SPECIAL_AREA_BG[map] = bg; } catch (e) {}
    mapState.current = map;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false; mapState.suppressSiegeBoss = true;
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
    showBattle();
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { recomputeStats(); if (!S().ff) { renderMobs(); syncMapSelectors(); updateUI(); } } catch (e) {}
  };
  var startRun = function (kind, city, prog) {
    hookDamage(); hookIncoming();
    var R = kind === 'ret' ? CFG.retake : CFG.def;
    run = { kind: kind, city: city, t0: tk(), wave: -1, waves: kind === 'ret' ? R.waves : defWaves(), queue: [], pauseUntil: tk() + 20,
      snap: null, killed: 0, limit: R.limitTicks, mode: 'def', flips: 0, flipNext: false, hpMin: 1, downs: 0, downed: [] };
    if (prog) {   // 接續上次的進度：從那一波重打，計時照算（離開的時間也算）
      run.t0 = tk() - Math.round(prog.used || 0); run.wave = Math.max(-1, (prog.wave | 0) - 1); run.waiting = run.wave >= 0; run.flips = prog.flips || 0; run.flipNext = prog.mode === 'atk'; run.downs = prog.downs || 0;
    }
    enterMap(kind === 'ret' ? RET_MAP : DEF_MAP, city);   // 先進戰場再複製面板（城陷之恥只在狩獵區）
    run.snap = snapPanel();
    guardParty();
    run.lvl = 0; if (kind === 'def') { var oc = store().cur; run.lvl = (oc && oc.lvl != null) ? oc.lvl : lvOf(); }
    run.lk = kind === 'def' ? lvK(run.lvl) : 1; run.la = kind === 'def' ? lvA(run.lvl) : 1;
    run.party = partySize(); run.pk = partyK(run.party); run.pa = partyK(run.party, CFG.partyAtkStep);   // 隊伍人數照進場（或回到戰場）當下
    return run;
  };
  // 守城戰進度（存在 o.cur.prog）：wave＝正在打的那一波（0 起算）、used＝已用掉的 tick、at＝最後記錄的現實時間
  var saveProg = function (r) {
    r = r || run; if (!r || r.kind !== 'def') return;
    var o = store(), c = o.cur; if (!c || c.status !== 'defending') return;
    c.prog = { wave: Math.max(0, r.waiting || r.wave < 0 ? r.wave + 1 : r.wave), used: tk() - r.t0, at: now(), flips: r.flips, downs: r.downs || 0, mode: r.waiting || r.wave < 0 ? (r.flipNext ? 'atk' : 'def') : r.mode };
    write(o);
  };
  var enterDefense = function () {
    var why = busy(); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    var o = store(), c = o.cur; if (!c || c.status !== 'defending') { sys('<span class="text-slate-300">現在沒有需要回防的城。</span>'); return false; }
    var prog = null;
    if (c.prog) {
      prog = { wave: c.prog.wave, used: (c.prog.used || 0) + Math.max(0, now() - (c.prog.at || now())) / 100, flips: c.prog.flips, downs: c.prog.downs || 0, mode: c.prog.mode };
      if (prog.used >= CFG.def.limitTicks) { timeUpOff(o, '時間到'); ui(); return false; }
    }
    startRun('def', c.target, prog);
    var left = mmss((CFG.def.limitTicks - (prog ? prog.used : 0)) * 100);
    if (prog) sys('<span class="text-amber-200 font-bold">🏰 回到守城戰：' + esc(cityName(c.target)) + '</span><span class="text-slate-300">　從第 ' + ((prog.wave | 0) + 1) + '／' + defWaves() + ' 波繼續，剩 ' + left + '，還能倒下 ' + downsLeft() + ' 次，' + lvText(run.lvl) + '。</span>');
    else sys('<span class="text-amber-200 font-bold">🏰 守城戰：' + esc(cityName(c.target)) + '</span><span class="text-slate-300">　30 分鐘內擋下 ' + CFG.def.rounds + ' 輪 ' + defWaves() + ' 波敵軍（每波八個職業的影子各一名，強度 ×' + waveMult('def', 0).toFixed(1) + ' → ×' + waveMult('def', defWaves() - 1).toFixed(1) + '）。全隊合計只能倒下 ' + CFG.downs + ' 次（你倒下會原地復活、轉為攻城把那一波奪回來），第 ' + (CFG.downs + 1) + ' 次＝失守；撐到第 ' + CFG.holdRound + ' 輪時間到也算守住。</span><span class="text-orange-300 font-bold">　' + lvText(run.lvl) + '（影子 HP ×' + (+run.lk.toFixed(2)) + '、傷害 ×' + (+run.la.toFixed(2)) + '）' + '</span>');
    saveProg();
    try { saveGame(); } catch (e) {}
    return true;
  };
  var nextWave = function () {
    run.wave++;
    if (run.wave >= run.waves) { finish('win'); return; }
    var k = waveMult(run.kind, run.wave);
    var w = run.wave;
    if (run.kind === 'def') {
      var atk = !!run.flipNext; run.flipNext = false;
      if (atk !== (run.mode === 'atk')) setBg(DEF_MAP, run.city, atk);
      run.mode = atk ? 'atk' : 'def';
      var ak = CFG.def.atkMult ? CFG.def.atkMult(w + 1) : 1;
      run.queue = waveClasses('def', w).map(function (cls, i) { return { cls: cls, k: k, ak: ak, pos: atk ? (i % 2 ? 'tower' : 'gate') : null }; });
      var PR = CFG.def.perRound, L = Math.floor(w / PR) + 1, wi = w % PR + 1;
      if (atk) {
        var tx = '轉為攻城：奪回第 ' + (w + 1) + ' 波';
        sys('<span class="text-orange-300 font-bold">⚔ ' + tx + '</span><span class="text-slate-300">　敵軍佔住了城門與守護塔（強度 ×' + k.toFixed(2) + '）；打下來就回到守城。</span>');
        try { if (!S().ff && typeof showToast === 'function') showToast('⚔ ' + tx); } catch (e) {}
      } else {
        if (wi === 1) sys('<span class="text-amber-200 font-bold">🏰 第 ' + L + '／' + CFG.def.rounds + ' 輪</span>' + (L === 1 ? '' : '<span class="text-slate-300">　敵軍增援，強度再升一階。</span>'));
        clog('<span class="text-red-300 font-bold">第 ' + L + ' 輪 第 ' + wi + ' 波（' + (w + 1) + '／' + run.waves + '，強度 ×' + k.toFixed(2) + '）</span>' + (w === CFG.skillFrom - 1 ? '　敵人開始施放職業技能！' : ''));
      }
      saveProg();
    } else {
      run.queue = waveClasses(run.kind, w).map(function (cls) { return { cls: cls, k: k }; });
      sys('<span class="text-red-300 font-bold">奪回戰 第 ' + (w + 1) + '／' + run.waves + ' 波（強度 ×' + k.toFixed(2) + '）</span>' + (w === CFG.skillFrom - 1 ? '<span class="text-slate-300">　守軍開始施放職業技能！</span>' : ''));
    }
  };
  var fieldAlive = function () { return (mapState.mobs || []).filter(function (m) { return m && m._s2Mirror && !m._dead && m.curHp > 0; }).length; };
  // 守城戰倒下：原地滿血復活（傭兵一起），同一波改成攻城模式重打；計時不停
  var revive = function () {
    healBypass = true; try { revive0(); } finally { healBypass = false; }
  };
  var revive0 = function () {
    var p = player;
    p.dead = false; p.hp = p.mhp; p.mp = p.mmp;
    var st = p.statuses || {}; Object.keys(st).forEach(function (k) { st[k] = 0; }); p.statuses = st;
    (p.allies || []).forEach(function (a) { if (a) { a._downed = false; a.curHp = a.mhp; a.mp = a.mmp; a._reviveCd = 0; a.statuses = {}; } });
    try { document.getElementById('btn-revive').classList.add('hidden'); var ip = document.getElementById('btn-revive-inplace'); if (ip) ip.classList.add('hidden'); } catch (e) {}
    try { calcStats(); p.hp = p.mhp; p.mp = p.mmp; } catch (e) {}
  };
  // 全隊倒下次數（你＋傭兵，每人每次都算）：傭兵從「站著」變成「倒下」記一次；over()＝超過 CFG.downs
  var downsLeft = function (r) { r = r || run; return Math.max(0, CFG.downs - ((r && r.downs) || 0)); };
  var scanDowns = function () {
    var r = run; if (!r) return;
    var p = P(), list = (p && p.allies) || [], was = r.downed || [], now1 = [];
    list.forEach(function (a) { if (a && (a._downed || (a.curHp != null && a.curHp <= 0))) { now1.push(a); if (was.indexOf(a) < 0) { r.downs++; downMsg(a._allyName ? '協力·' + a._allyName : '傭兵'); } } });
    r.downed = now1;
  };
  var downMsg = function (who) { var r = run; if (!r) return; var left = CFG.downs - r.downs; sys('<span class="text-red-300">' + esc(who) + ' 倒下（全隊第 ' + r.downs + ' 次）</span><span class="text-slate-300">' + (left >= 0 ? '　還能倒下 ' + left + ' 次。' : '') + '</span>'); };
  var overDowns = function () { return !!(run && run.downs > CFG.downs); };
  var onDeath = function () {
    var r = run; if (!r) return;
    scanDowns(); r.downs++; downMsg('你');
    if (r.kind !== 'def') { finish('lose', '倒下'); return; }
    if (overDowns()) { finish('lose', '全隊倒下第 ' + r.downs + ' 次'); return; }
    r.flips++;
    var inWave = r.wave >= 0 && !r.waiting;   // 正在打的那一波＝重打；兩波之間倒下＝下一波改成攻城
    (mapState.mobs || []).forEach(function (m, i) { if (m && m._s2Mirror) mapState.mobs[i] = null; });
    if (inWave) r.wave--;
    r.queue = []; r.waiting = true; r.pauseUntil = tk() + CFG.def.flipPause; r.flipNext = true;
    revive(); r.downed = [];
    sys('<span class="text-red-300 font-bold">你倒下了——城門被攻破！</span><span class="text-slate-300">你在城外重整旗鼓（HP 全滿），' + (CFG.def.flipPause / 10) + ' 秒後轉為攻城，奪回第 ' + (r.wave + 2) + ' 波。計時不停；還能倒下 ' + downsLeft(r) + ' 次。</span>');
    if (typeof api.onFlip === 'function') { try { api.onFlip(r); } catch (e) {} }
    saveProg();
    try { if (!S().ff) { renderMobs(); updateUI(); } } catch (e) {}
  };
  var timeline = function () {
    if (!run) return;
    var t = tk();
    if (player.dead) { onDeath(); return; }
    if (!onMap()) { finish('leave', '離開戰場'); return; }
    if (t - run.t0 >= run.limit) {
      var cw = (run.waiting || run.wave < 0) ? run.wave + 1 : run.wave;   // 正在打（或下一個要打）的那一波，0 起算
      if (run.kind === 'def' && Math.floor(cw / CFG.def.perRound) + 1 >= CFG.holdRound) finish('win', '撐到第 ' + CFG.holdRound + ' 輪結束時間到');
      else finish('lose', '時間到');
      return;
    }
    if (player.mhp) run.hpMin = Math.min(run.hpMin, player.hp / player.mhp);
    scanDowns();
    if (overDowns()) { finish('lose', '全隊倒下第 ' + run.downs + ' 次'); return; }
    guardParty();
    // 清掉倒下的
    for (var i = 0; i < mapState.mobs.length; i++) { var x = mapState.mobs[i]; if (x && (x._dead || x.curHp <= 0) && x._s2Mirror && !x._s2Counted) { x._s2Counted = true; run.killed++; } }
    if (!run.queue.length && !fieldAlive()) {
      if (run.wave >= 0 && !run.waiting) { run.waiting = true; run.pauseUntil = t + (run.kind === 'ret' ? CFG.retake.pause : CFG.def.pause); if (run.kind === 'def') saveProg(); }
      if (t < run.pauseUntil) return;
      run.waiting = false; nextWave();
      if (!run) return;
    }
    // 補位
    var n = slots(), placed = false;
    for (var j = 0; j < n && run.queue.length; j++) {
      var y = mapState.mobs[j]; if (y && !y._dead && y.curHp > 0) continue;
      var q = run.queue.shift(); var m = buildMirror(q.cls, q.k, run.wave, run.snap, run.pk * (run.lk || 1), run.pa, (q.ak || 1) * (run.la || 1)); if (!m) continue;
      if (q.pos) { var cf = SIEGE_CITY[run.city] || {}; m.n = CLS_N[q.cls] + '之影（' + (q.pos === 'tower' ? (cf.tower || '守護塔') : (cf.gate || '城門')) + '）'; }
      placeMirror(j, m); placed = true;
    }
    if (placed && !S().ff) { try { renderMobs(); } catch (e) {} }
    rampTick();
    // 技能
    if (run.wave >= CFG.skillFrom - 1) {
      for (var k2 = 0; k2 < mapState.mobs.length; k2++) {
        var mm = mapState.mobs[k2]; if (!mm || !mm._s2Mirror || mm._dead || mm.curHp <= 0 || !SKILL_N[mm._s2Cls]) continue;
        if (--mm._s2cd > 0) continue;
        mm._s2cd = CFG.cd[mm._s2Cls] || 100;
        var blocked = false; try { blocked = mobActDisabled(mm) || (mm.st && (mm.st.vacuum > 0 || mm.st.magicseal > 0 || mm.st.confuse > 0)); } catch (e) {}
        if (blocked) continue;
        castSkill(mm, k2);
        if (player.dead || !run) return;
      }
    }
  };
  // 鏡像越拖越強：活越久傷害越高（一般攻擊骰、加值、技能基準一起放大）
  var rampOf = function (m) { if (!m || m._s2At == null || !(CFG.rampEvery > 0)) return 0; return Math.min(CFG.rampCap, CFG.rampStep * Math.floor((tk() - m._s2At) / (CFG.rampEvery * 10))); };
  var rampTick = function () {
    (mapState.mobs || []).forEach(function (m) {
      if (!m || !m._s2Mirror || m._dead || m.curHp <= 0 || !m._s2Base) return;
      var r = rampOf(m); if (r === m._s2Ramp) return;
      m._s2Ramp = r; var f = 1 + r, B = m._s2Base;
      m.dmg = [B.d[0], Math.max(1, Math.round(B.d[1] * f))]; m.db = Math.round(B.db * f); m._s2Atk = Math.round(B.atk * f);
      if (r > 0 && Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 && Math.round(r * 100) % 50 === 0) clog('<span class="text-orange-300">' + esc(m.n) + ' 越戰越狂（傷害 +' + Math.round(r * 100) + '%）</span>');
    });
  };
  // result：'win'、'lose'（守城戰＝失守；奪回戰＝攻城戰敗）、'leave'（離開戰場：守城戰保留進度、奪回戰算輸）
  var finish = function (result, why, quiet) {
    var r = run; if (!r) return;
    if (result === 'leave' && r.kind === 'def') saveProg(r);
    run = null; unguardAll();
    try { (mapState.mobs || []).forEach(function (m, i) { if (m && m._s2Mirror) mapState.mobs[i] = null; }); } catch (e) {}
    var o = store(), c = o.cur;
    W.__afkSiege2Last = { kind: r.kind, result: result, why: why || '', wave: r.wave, cleared: result === 'win' && !why ? r.waves : Math.max(0, r.waiting ? r.wave + 1 : r.wave), waves: r.waves, ticks: tk() - r.t0, killed: r.killed,
      flips: r.flips, downs: r.downs || 0, party: r.party, pk: r.pk, pa: r.pa, lvl: r.lvl || 0, lk: r.lk || 1, mode: r.mode, hpMin: Math.round(r.hpMin * 100) };
    if (r.kind === 'def') {
      if (result === 'win') {
        var nl = Math.min(lvMax(), (r.lvl || 0) + 1);
        if (c && c.status === 'defending') { c.status = 'resolved'; c.result = 'defended'; delete c.prog; o.level = nl; write(o); }
        sys('<span class="text-yellow-300 font-bold">🏆 守城成功！' + esc(cityName(r.city)) + '的城牆上，你的旗幟依然飄揚。</span>' + (why ? '<span class="text-amber-200">（' + esc(why) + '）</span>' : '') + (r.flips ? '<span class="text-slate-300">（途中轉為攻城 ' + r.flips + ' 次）</span>' : '')
          + '<span class="text-orange-300 font-bold">　' + ((r.lvl || 0) >= lvMax() ? '守城難度維持 Lv ' + lvMax() + '（最高）' : '下次守城難度提升到 Lv ' + nl) + '</span>');
        grantDefense();
      } else if (result === 'leave') {
        if (c && c.status === 'defending') sys('<span class="text-amber-300 font-bold">你離開了守城戰場（' + esc(why || '') + '）。</span><span class="text-slate-300">進度保留在第 ' + (W.__afkSiege2Last.cleared + 1) + ' 波，但 30 分鐘的計時不會停；回到戰場就能接著打。</span>');
      } else if (c && c.status === 'defending' && !quiet) {
        sys('<span class="text-red-300 font-bold">守城戰結束（' + esc(why || '') + '，擋下 ' + W.__afkSiege2Last.cleared + '／' + r.waves + ' 波）。</span>');
        defenseFail(o, why);
      }
    } else {
      if (result === 'win') retakeWin(r.city);
      else {
        try { localStorage.setItem('afk_siege_lose_until', String(Date.now() + 30 * 60000)); } catch (e) {}
        sys('<span class="text-red-300 font-bold">奪回戰失敗（' + esc(why || '') + '，擊退 ' + Math.max(0, r.wave) + '／' + r.waves + ' 波）。</span><span class="text-slate-300">30 分鐘內，帳號裡所有角色都不能宣戰。</span>');
      }
    }
    try {
      if (!player.dead && MY_MAPS[mapState.current]) { var dest = (typeof getLastTown === 'function') ? getLastTown() : 'town_talking'; setMapSelectors(dest); changeMap(true); }
    } catch (e) {}
    try { calcStats(); if (!S().ff) updateUI(); saveGame(); } catch (e) {}
  };

  // ── 獎勵 ──
  var give = function (id, n) { if (!DB.items[id] || !(n > 0)) return null; try { gainItem(id, n, true, true); return DB.items[id].n + ' ×' + n; } catch (e) { return null; } };
  var addDia = function (n) { try { if (typeof W.pandoraAdjustSharedDiamonds === 'function') { W.pandoraAdjustSharedDiamonds(n); return '龍之鑽石 ' + n.toLocaleString(); } } catch (e) {} return null; };
  var grantDefense = function () {
    var R = CFG.reward, got = [];
    got.push(addDia(R.dia));
    ['earth', 'water', 'wind', 'fire'].forEach(function (e) { got.push(give('afk_contempt_' + e, R.contempt)); });
    got.push(give('afk_dark_stardust', R.stardust)); got.push(give('afk_bone_stone', R.bone)); got.push(give('afk_void_stone', R.void));
    var SS = W.__afkSoulStone;
    if (SS && SS.randomStone) { var bag = {}; for (var i = 0; i < R.soul; i++) { var id = SS.randomStone(); bag[id] = (bag[id] || 0) + 1; } Object.keys(bag).forEach(function (id) { got.push(give(id, bag[id])); }); }
    got.push(give('afk_mio_shard', R.mio));
    got = got.filter(Boolean);
    sys('<span class="text-amber-300 font-bold">守城的謝禮：</span>' + esc(got.join('、')));
    return got;
  };
  var retakeWin = function (city) {
    var r = null; try { r = W.clanSetCastle(city); } catch (e) {}
    var o = store(); delete o.lost[city]; write(o);
    if (r && r.ok) { try { rememberCastleOwnerCity(city); } catch (e) {} }
    try { var d = CW.data(); if (d.castles.indexOf(city) < 0 && d.castles.length < 7) { d.castles.push(city); CW.save(d); } r = r || {}; r.ok = true; } catch (e) {}
    var dia = addDia(CFG.retake.dia);
    sys('<span class="text-yellow-300 font-bold">🏆 奪回了' + esc(cityName(city)) + '！</span>' + (dia ? '<span class="text-amber-300">（' + esc(dia) + '）</span>' : '') + (r && r.ok ? '' : '<span class="text-red-300">城堡共用資料寫入失敗，請再宣戰一次。</span>'));
    try { CW.syncWar(true); } catch (e) {}
  };
  // 奪回戰的鏡像敵人：照遺物掉落率掉昇華支配 +0 遺物
  var relicBases = null;
  var ascRelic = function () {
    var RP = W.__afkRelicPlus; if (!RP) return null;
    if (!relicBases) relicBases = Object.keys(DB.items).filter(function (id) { var d = DB.items[id]; return d && !/~/.test(id) && typeof isRelic === 'function' && isRelic(d) && !d.relicPlus && !d.isArrow && !d.gmOnly && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) < 0; });
    for (var i = 0; i < 20 && relicBases.length; i++) {
      var b = relicBases[Math.floor(Math.random() * relicBases.length)], cap = 15;
      try { cap = enhanceCap(DB.items[b]) <= 5 ? 10 : 15; } catch (e) { cap = DB.items[b].type === 'acc' ? 10 : 15; }
      var id = RP.makeId(b, cap, null, 0); if (RP.ensure(id)) return id;
    }
    return null;
  };
  var relicRate = function () {
    var x2 = 1; try { x2 = (typeof W.__afkRelicDropMult === 'function') ? W.__afkRelicDropMult() : ((typeof mainPlayerHasEquippedEffect === 'function' && mainPlayerHasEquippedEffect('relicDropX2')) ? 2 : 1); } catch (e) {}
    var r = 0.00001 * x2; try { r *= classicDropMult(); } catch (e) {}
    try { if (typeof partyDropRate === 'function') r = partyDropRate(r); } catch (e) {}
    return r;
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs && mapState.mobs[idx], was = !!(m && m._s2Mirror && !m._dead);
      if (!was) return oKill.apply(this, arguments);
      var gI = W.gainItem, aC = W.acquireCard, r;   // 鏡像敵人沒有一般掉落（其他外掛的額外掉落也不算），只掉下面的遺物
      W.gainItem = function () { return false; }; if (typeof aC === 'function') W.acquireCard = function () { return false; };
      try { r = oKill.apply(this, arguments); } finally { W.gainItem = gI; if (typeof aC === 'function') W.acquireCard = aC; }
      try {
        if (m._dead && run && !m._s2Counted) { m._s2Counted = true; run.killed++; }
        if (was && m._dead && run && run.kind === 'ret' && Math.random() < api.relicRate()) {
          var id = ascRelic();
          if (id) { var info = gainItem(id, 1, true, false); var it = info || { id: id, en: 0, cnt: 1 }; sys('<span class="text-amber-300 font-bold">✦ 極稀有！</span>' + esc(m.n) + ' 掉落了遺物 <span class="font-bold">' + esc(typeof getItemFullName === 'function' ? getItemFullName(it) : DB.items[id].n) + '</span>！'); }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }

  // 鏡像敵人是玩家的影子：即死（骰子匕首、起死回生術、遺物處決等走 tryInstakill 的效果）對它無效（11-03 11:40 調整時發現 8 人隊伍靠即死秒殺整波）
  if (typeof W.tryInstakill === 'function') {
    var oIK = W.tryInstakill;
    W.tryInstakill = function (m) { if (m && m._s2Mirror) return false; return oIK.apply(this, arguments); };
    try { (0, eval)('tryInstakill = window.tryInstakill'); } catch (e) {}
  }

  // 守城戰／奪回戰裡倒下不會噴裝（紅名的死亡掉落）
  if (typeof W.pvpChaoticDeathItemLoss === 'function') {
    var oCDL = W.pvpChaoticDeathItemLoss;
    W.pvpChaoticDeathItemLoss = function () { if (onMap()) return; return oCDL.apply(this, arguments); };
    try { (0, eval)('pvpChaoticDeathItemLoss = window.pvpChaoticDeathItemLoss'); } catch (e) {}
  }

  // ── 出怪、傳送、讀檔 ──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) { if (onMap()) return; return oSpawn.apply(this, arguments); };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  if (typeof W.doTeleport === 'function') {
    var oTp = W.doTeleport;
    W.doTeleport = function () { if (onMap()) { sys('<span class="text-amber-300">戰場上無法傳送。</span>'); return; } return oTp.apply(this, arguments); };
    try { (0, eval)('doTeleport = window.doTeleport'); } catch (e) {}
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    var lastT = null;
    W.tick = function () {
      try { return oTick.apply(this, arguments); }
      finally {
        try {
          var t = tk();
          if (run && P() && player.dead && onMap()) onDeath();   // 倒下時核心不推進 tick：不能只靠 tick 變化判定
          else if (run && P() && !onMap()) finish(player.dead ? 'lose' : 'leave', player.dead ? '倒下' : '離開戰場');
          else if (run && t !== lastT) { lastT = t; timeline(); }
          else if (!run && onMap() && P()) leaveStray();
        } catch (e) { console.warn('[AFK-siege2] tick', e); }
      }
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  var leaveStray = function () {   // 讀檔後還留在戰場地圖（沒有進行中的戰鬥）
    try { (mapState.mobs || []).forEach(function (m, i) { if (m && m._s2Mirror) mapState.mobs[i] = null; }); setMapSelectors((typeof getLastTown === 'function') ? getLastTown() : 'town_talking'); changeMap(true); } catch (e) {}
  };
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () {
      var hadRun = run; if (hadRun && hadRun.kind === 'def') { try { saveProg(hadRun); } catch (e) {} }   // 守城戰：進度保留、計時不停
      run = null; unguardAll();
      var r = oLoad.apply(this, arguments);
      try {
        if (onMap()) setTimeout(function () { try { if (!run && onMap()) { leaveStray(); sys('<span class="text-slate-300">戰場已經散去，你回到了村莊。</span>'); } } catch (e) {} }, 0);
      } catch (e) {}
      return r;
    };
    try { (0, eval)('loadGame = window.loadGame'); } catch (e) {}
  }

  // ── 宣戰：守城戰流程中不能宣戰；失去的城 7 天內不能打，之後＝奪回戰 ──
  var lostInfo = function (city) { var o = store(); return o.lost[city] || null; };
  var flowActive = function () { var c = store().cur; return !!(run || (c && (c.status === 'assembled' || c.status === 'asked' || c.status === 'defending'))); };
  var daysLeft = function (ms) { return Math.max(1, Math.ceil(ms / 86400000)); };
  var startRetake = function (city, skipConfirm) {
    var why = busy(); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    var go = function () {
      var r = startRun('ret', city, 0);
      sys('<span class="text-red-300 font-bold">⚔ 奪回戰：' + esc(cityName(city)) + '</span><span class="text-slate-300">　守軍是照著你的樣子造出來的影子（八個職業），5 波、強度 ×0.7 → ×1.5，第 2 波起會放職業技能，受到攻擊會反彈 10% 傷害。限時 30 分鐘；你倒下、或全隊合計倒下第 ' + (CFG.downs + 1) + ' 次就失敗。</span>');
      try { saveGame(); } catch (e) {}
      return r;
    };
    if (skipConfirm) return !!go();
    var msg = '奪回' + cityName(city) + '？\n守軍是你自己的影子（八個職業），5 波；限時 30 分鐘。你倒下、或全隊合計倒下第 ' + (CFG.downs + 1) + ' 次就失敗，打輸 30 分鐘內不能宣戰。';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '奪回戰', message: msg, okText: '出兵', cancelText: '再準備一下', onOk: go });
    else if (W.confirm(msg)) go();
    return true;
  };
  if (typeof W.startSiege === 'function') {
    var oStart = W.startSiege;
    W.startSiege = function (faction, city) {
      try {
        var p = P();
        if (p && !p.classicMode) {
          if (flowActive()) { sys('<span class="text-amber-300">守城戰還沒結束，現在不能宣戰。</span>'); return; }
          var li = city && lostInfo(city);
          if (li) {
            var left = li.lockUntil - now();
            if (left > 0) { var tx = cityName(city) + '剛被攻下，' + daysLeft(left) + ' 天後才能宣戰奪回。'; sys('<span class="text-amber-300">' + esc(tx) + '</span>'); try { if (typeof showToast === 'function') showToast(tx); } catch (e) {} return; }
            try { if (W.__afkSiegeLose && W.__afkSiegeLose.left() > 0) { sys('<span class="text-amber-300">' + esc(W.__afkSiegeLose.text()) + '</span>'); return; } } catch (e) {}
            if (held().indexOf(city) < 0) { startRetake(city); return; }
          }
        }
      } catch (e) {}
      try { if (W.__afkClanPeace()) endPeace('你宣戰攻城'); } catch (e) {}
      return oStart.apply(this, arguments);
    };
    try { (0, eval)('startSiege = window.startSiege'); } catch (e) {}
  }
  if (typeof W.openSiegeSelect === 'function') {
    var oSel = W.openSiegeSelect;
    W.openSiegeSelect = function (faction, targetEl) {
      var r = oSel.apply(this, arguments);
      try {
        var el = targetEl || document.getElementById('interaction-content'), grid = el && el.querySelector('.siege-castle-grid'); if (!grid || classic()) return r;
        var o = store(), t = now();
        grid.querySelectorAll('[data-castle]').forEach(function (b) {
          var c = b.getAttribute('data-castle'), li = o.lost[c], st = b.querySelector('.siege-castle-status'); if (!li || held().indexOf(c) >= 0) return;
          if (li.lockUntil > t) { b.disabled = true; b.removeAttribute('onclick'); b.classList.remove('is-open'); b.classList.add('is-locked'); if (st) st.textContent = '失守・' + daysLeft(li.lockUntil - t) + ' 天後可奪回'; }
          else if (st) st.textContent = '奪回戰';
        });
        var note = el.querySelector('.border-t.border-slate-700');
        if (note) note.textContent = '七座城都可以宣戰，最多持有 7 座。每週五 20:00～21:00 會有血盟來攻你的城（守城戰，可以在血盟頁關掉）；失去的城 7 天後可以打回來。持有越多城，攻城越難。3 座以上每小時有收成；持有 2 座以上會有血盟對你宣戰。';
        // 放棄城堡：只列自己持有的城
        var h = held(), old = el.querySelector('#afk-s2-abandon'); if (old) old.remove();
        if (h.length) {
          var box = document.createElement('div'); box.id = 'afk-s2-abandon';
          box.className = 'mt-2 p-2 rounded border border-slate-600 bg-slate-900/70 text-sm text-slate-200';
          var pl = peaceLeft();
          box.innerHTML = '<div class="font-bold text-amber-200 mb-1">🏳 放棄城堡</div>'
            + '<div class="text-xs text-slate-400 mb-2">放棄一座城：失去那座城，所有對你宣戰的血盟停戰，NPC 血盟的仇恨一筆勾銷，' + Math.round(CFG.peaceMs / 86400000) + ' 天內不會再跟你結仇或宣戰（你自己宣戰就結束）；追殺你的紅人散去、之後不再追殺。城全部放掉時守城難度歸零。'
            + (pl > 0 ? '<span class="text-emerald-300">（和平期還有 ' + daysLeft(pl) + ' 天）</span>' : '') + '</div>'
            + '<div class="flex flex-wrap gap-2">' + h.map(function (c) { return '<button type="button" data-s2abandon="' + esc(c) + '" class="px-2 py-1 rounded border border-red-700 bg-red-950/60 text-red-200">放棄' + esc(cityName(c)) + '</button>'; }).join('') + '</div>';
          box.addEventListener('click', function (ev) {
            var c = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-s2abandon'); if (!c) return;
            var msg = '放棄' + cityName(c) + '？\n這座城會失去（之後可以再攻下來）；對你宣戰的血盟全部停戰，' + Math.round(CFG.peaceMs / 86400000) + ' 天內 NPC 血盟不會跟你結仇或宣戰；追殺你的紅人散去。';
            var go = function () { var why = abandon(c); if (why) sys('<span class="text-amber-300">' + esc(why) + '</span>'); try { W.openSiegeSelect(faction, targetEl); } catch (e) {} };
            if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '放棄城堡', message: msg, okText: '放棄', cancelText: '再想想', danger: true, onOk: go });
            else if (W.confirm(msg)) go();
          });
          grid.parentNode.insertBefore(box, grid.nextSibling);
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('openSiegeSelect = window.openSiegeSelect'); } catch (e) {}
  }

  // ── 血盟頁：守城戰開關 ──
  if (typeof W.renderClanTab === 'function') {
    var oClanTab = W.renderClanTab;
    W.renderClanTab = function () {
      var r = oClanTab.apply(this, arguments);
      try {
        var div = document.getElementById('tab-clan'); if (!div || classic() || !P()) return r;
        var old = div.querySelector('#afk-s2-switch'); if (old) old.remove();
        var o = store(), off = !!o.off, row = document.createElement('div'); row.id = 'afk-s2-switch';
        row.className = 'mt-2 p-2 rounded border border-amber-700/60 bg-slate-900/70 text-sm text-slate-200 flex flex-wrap items-center gap-2';
        row.innerHTML = '<span class="text-amber-200 font-bold">🛡️ 守城戰</span><button type="button" class="px-2 py-1 rounded border ' + (off ? 'border-slate-500 bg-slate-800 text-slate-300' : 'border-amber-500 bg-amber-900/60 text-amber-100') + '">' + (off ? '已關閉（點一下打開）' : '已開啟（點一下關閉）') + '</button>'
          + '<span class="text-xs text-slate-400">' + (off ? '關閉中：不會有血盟來攻你的城，也不會因此失去城堡。' : '每週五 20:00～21:00 會有血盟來攻你的城。') + lvText(lvOf(o)) + (peaceLeft() > 0 ? '　和平期還有 ' + daysLeft(peaceLeft()) + ' 天' : '') + '</span>';
        row.querySelector('button').onclick = function () { var why = setOff(!off); if (why) sys('<span class="text-amber-300">' + esc(why) + '</span>'); try { W.renderClanTab(); } catch (e) {} };
        var anchor = div.firstElementChild; if (anchor) anchor.appendChild(row); else div.appendChild(row);
      } catch (e) {}
      return r;
    };
    try { (0, eval)('renderClanTab = window.renderClanTab'); } catch (e) {}
  }

  // ── 介面：狀態列與回防視窗 ──
  var css = '#afk-s2-bar{position:fixed;left:50%;top:calc(var(--orig-bar-h,0px) + 6px);transform:translateX(-50%);z-index:9000;max-width:calc(100vw - 16px);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:6px 10px;border-radius:8px;background:rgba(40,8,8,.92);border:1px solid #b91c1c;color:#fecaca;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.5)}'
    + '#afk-s2-bar.hidden,#afk-s2-pop.hidden{display:none}#afk-s2-bar button,#afk-s2-pop button{padding:3px 10px;border-radius:6px;border:1px solid #f59e0b;background:#451a03;color:#fde68a;font-weight:700;cursor:pointer}'
    + '#afk-s2-bar button.s2-no,#afk-s2-pop button.s2-no{border-color:#64748b;background:#1e293b;color:#cbd5e1}'
    + '#afk-s2-pop{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}#afk-s2-pop .s2-box{width:min(420px,calc(100vw - 32px));background:#1c0a0a;border:2px solid #dc2626;border-radius:10px;padding:16px;color:#fee2e2;text-align:center}'
    + '#afk-s2-pop .s2-t{font-size:18px;font-weight:700;color:#fca5a5;margin-bottom:8px}#afk-s2-pop .s2-btns{display:flex;gap:10px;justify-content:center;margin-top:12px}#afk-s2-pop .s2-btns button{padding:8px 18px;font-size:15px}';
  var bar = null, pop = null;
  var ensureDom = function () {
    if (bar || !document.body) return !!bar;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bar = document.createElement('div'); bar.id = 'afk-s2-bar'; bar.className = 'hidden'; document.body.appendChild(bar);
    bar.addEventListener('click', function (ev) { var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-s2'); if (a) act(a); });
    pop = document.createElement('div'); pop.id = 'afk-s2-pop'; pop.className = 'hidden'; document.body.appendChild(pop);
    pop.addEventListener('click', function (ev) { var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-s2'); if (a) act(a); });
    return true;
  };
  var act = function (a) {
    if (a === 'yes') answer(true); else if (a === 'no') answer(false);
    else if (a === 'enter') enterDefense();
    else if (a === 'giveup') {
      var msg = '放棄守城就會失去' + cityName((store().cur || {}).target) + '（7 天內不能打回來，城陷之恥 1 天）。';
      if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '放棄守城', message: msg, okText: '放棄', cancelText: '再想想', danger: true, onOk: giveUp });
      else if (W.confirm(msg)) giveUp();
    }
    ui();
  };
  var mmss = function (ms) { ms = Math.max(0, ms); var m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m + ':' + (s < 10 ? '0' : '') + s; };
  var popShown = function () { return !!(pop && !pop.classList.contains('hidden')); };
  var showPop = function () {
    if (S().ff || !ensureDom()) return;
    var c = store().cur; if (!c) return;
    pop.innerHTML = '<div class="s2-box"><div class="s2-t">⚔ 「' + esc(c.clan) + '」血盟向你宣戰！</div><div>目標：' + esc(cityName(c.target)) + '。是否回防？</div><div style="font-size:13px;color:#fdba74;margin-top:4px">' + lvText(lvOf()) + '</div>'
      + '<div style="font-size:12px;color:#fca5a5;margin-top:6px">不回防：可能失去 1～2 座城。3 分鐘內沒回應＝不回防。</div>'
      + '<div class="s2-btns"><button type="button" data-s2="yes">回防</button><button type="button" class="s2-no" data-s2="no">不回防</button></div></div>';
    pop.classList.remove('hidden');
  };
  var closePop = function () { if (pop) pop.classList.add('hidden'); };
  var ui = function () {
    if (S().ff || !ensureDom()) return;
    var p = P(), h = '';
    if (p && on() && !p.classicMode) {
      var c = store().cur, t = now();
      if (run) {
        var left = run.limit - (tk() - run.t0), w = Math.max(0, run.wave);
        if (run.kind === 'def') {
          var nx = run.waiting || run.wave < 0, wv = nx ? run.wave + 1 : w, atkM = nx ? run.flipNext : run.mode === 'atk';
          h = (atkM ? '⚔ 攻城模式：奪回第 ' + (wv + 1) + ' 波' : '🏰 守城戰　第 ' + (Math.floor(wv / CFG.def.perRound) + 1) + ' 輪 第 ' + (wv % CFG.def.perRound + 1) + ' 波')
            + '（' + (wv + 1) + '／' + run.waves + '）　剩 ' + mmss(left * 100) + '　還能倒下 ' + downsLeft() + ' 次　' + lvText(run.lvl) + (run.flips ? '　轉攻城 ' + run.flips + ' 次' : '') + '<button type="button" class="s2-no" data-s2="giveup">放棄守城</button>';
        } else h = '⚔ 奪回' + esc(cityName(run.city)) + '　第 ' + (w + 1) + '／' + run.waves + ' 波　剩 ' + mmss(left * 100) + '　還能倒下 ' + downsLeft() + ' 次';
      } else if (c && c.status === 'assembled') h = '⚔ 「' + esc(c.clan) + '」正在集結（' + mmss(c.askAt - t) + ' 後宣戰）';
      else if (c && c.status === 'asked') h = '⚔ 「' + esc(c.clan) + '」宣戰！（' + mmss(c.deadline - t) + '）<button type="button" data-s2="yes">回防</button><button type="button" class="s2-no" data-s2="no">不回防</button>';
      else if (c && c.status === 'defending') h = '🏰 回防' + esc(cityName(c.target)) + (c.prog ? '（第 ' + ((c.prog.wave | 0) + 1) + ' 波，剩 ' + mmss((CFG.def.limitTicks - (c.prog.used || 0)) * 100 - Math.max(0, t - (c.prog.at || t))) + '，還能倒下 ' + Math.max(0, CFG.downs - (c.prog.downs || 0)) + ' 次，' + lvText(c.lvl || 0) + '）' : '（21:00 前進場，' + mmss(c.endAt - t) + '，' + lvText(c.lvl != null ? c.lvl : lvOf()) + '）') + '<button type="button" data-s2="enter">' + (c.prog ? '回到戰場' : '進入守城戰') + '</button><button type="button" class="s2-no" data-s2="giveup">放棄守城</button>';
      else { var sl = shameLeft(); if (sl > 0) h = '🏴 城陷之恥（狩獵區六項能力、四屬性抗性 −50）剩 ' + Math.floor(sl / 3600000) + ' 小時 ' + Math.floor(sl % 3600000 / 60000) + ' 分'; }
    }
    if (h) { if (bar.innerHTML !== h) bar.innerHTML = h; bar.classList.remove('hidden'); } else bar.classList.add('hidden');
  };
  setInterval(function () { try { step(); } catch (e) { console.warn('[AFK-siege2] step', e); } }, 1000);

  // ── 測試與除錯 ──
  api.CFG = CFG; api.CLASSES = CLASSES; api.KEY = KEY; api.DEF_MAP = DEF_MAP; api.RET_MAP = RET_MAP;
  api.on = on; api.store = store; api.write = write; api.step = step; api.ensureWeek = function () { var o = store(); ensureWeek(o); write(o); return o.cur; };
  api.weekOf = weekOf; api.dayNum = dayNum; api.dow = dow; api.dayStart = dayStart; api.newWeek = newWeek;
  api.assemble = function () { var o = store(); ensureWeek(o); return assemble(o, true); };
  api.ask = function () { var o = store(); if (o.cur && o.cur.status === 'assembled') { o.cur.status = 'asked'; o.cur.askAt = now(); o.cur.deadline = now() + CFG.answerWindow; write(o); } return o.cur; };
  api.answer = answer; api.noAnswer = function () { var o = store(); closePop(); return noDefense(o, 'noanswer'); };
  api.rollCount = rollCount; api.pickTargets = pickTargets; api.loseCastle = function (c) { var o = store(); var ok = loseCastle(c, o); write(o); afterLoss(); return ok; };
  api.enterDefense = enterDefense; api.startRetake = function (c) { return startRetake(c, true); }; api.giveUp = giveUp; api.finish = finish; api.timeline = timeline;
  api.run = function () { return run; }; api.waveMult = waveMult; api.defWaves = defWaves; api.onDeath = onDeath; api.natHit = natHit; api.mirrorReflect = mirrorReflect; api.partyK = partyK; api.markNoHeal = markNoHeal; api.setOff = setOff; api.abandon = abandon; api.makePeace = makePeace; api.peaceLeft = peaceLeft; api.endPeace = endPeace; api.lvOf = lvOf; api.lvK = lvK; api.lvA = lvA; api.lvMax = lvMax; api.lvText = lvText; api.unifiedAll = unifiedAll; api.timeUpOff = timeUpOff; api.asCaster = function (m, fn) { var pv = casting; casting = m; try { return fn(); } finally { casting = pv; } }; api.noHealOn = noHealOn; api.guardParty = guardParty; api.rampOf = rampOf; api.rampTick = rampTick; api.placeMirror = placeMirror; api.partySize = partySize; api.isAlly = isAlly; api.scanDowns = scanDowns; api.downsLeft = downsLeft; api.floorChance = floorChance; api.defExpired = defExpired; api.waveClasses = waveClasses; api.buildMirror = buildMirror; api.snapPanel = snapPanel; api.castSkill = castSkill;
  api.exempt = exempt; api.inHunt = inHunt; api.shameOn = shameOn; api.shameLeft = shameLeft; api.grantDefense = grantDefense; api.relicRate = relicRate; api.ascRelic = ascRelic;
  api.flowActive = flowActive; api.ui = ui; api.lostInfo = lostInfo;
  W.__afkSiege2 = api;
  console.log('[AFK-siege2] 已啟用：每週守城戰、奪回戰');
})();
