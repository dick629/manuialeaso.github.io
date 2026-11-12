/* ============================================================================
 * afk-rift2.js — 時空裂痕重做（玩家 2026-10-29 晚，設計稿 docs/runes-design.md 第三版）
 *
 * 一、時間改用遊戲時間（所有模式）：原本用電腦時鐘，分頁在背景補跑時一整批都算「現在」，
 *     怪物等級、頭目比例、傷害倍率會一口氣跳上去。現在每一下都換算成「開場後經過幾下遊戲時間」。
 * 二、席琳三模式（席琳／瘋狂席琳／夢域鏡席琳）的新規則：
 *   ‧一趟最長 80 分鐘；撐滿 80 分鐘＝完全通關，自動結算。
 *   ‧2026-11-04（玩家）：出怪時間軸（等級 60 分到最高、四大龍 60 分起）、怪物攻擊力曲線（TUNE.dmgCurve）、時空侵蝕（同一隻頭目 180 秒沒倒，暴走再 +15%、每 10 秒再 +15%，抑制劑消不掉）、
 *     裂痕裡小怪代價／王的死亡詛咒／屍爆每秒最多一次（__afkRiftOnce）。
 *   ‧難度目標：撐到 60／70／80 分鐘，大約要曲線 60／70／80 的裝備（遺物 +10＋原版遺骸＋之魂／遺物 +15＋夢域遺骸／昇華支配 +2）。
 *     做法：20 分鐘後怪物 HP 隨時間成長；頭目出場 60 秒還沒倒就「時空暴走」，每秒對全隊造成真實傷害（越拖越重）；
 *           60 分鐘起全場每秒扣最大 HP（第二道壓力牆）。數字在 TUNE，用模擬工具對齊。
 *   ‧不吃任何掉寶加倍（兔腳、隊伍人數、席琳世界 ×3／×5…）；怪物專屬掉落表的遺物 ×10（0.0001% → 0.001%）。
 *     會變身的頭目只有最後一階會掉東西（核心原本就是這樣），所以整條只判定一次。
 *   ‧哀石系列：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉；頭目另有 0.001% 掉該模式的失去光芒的符文石。
 *   ‧結算（取代原本的潘朵拉抽獎）：
 *       席琳：失去光芒的符文石（階段一）
 *       瘋狂：0～12 分階段一；12～76 分階段二；76 分以上或完全通關階段三
 *       夢域：0～12 分階段一；12～60 分階段二；60～76 分階段三；76 分以上或完全通關瘴骸·破材料（隨機一種）
 *       （玩家 2026-11-06）撐過 12 分鐘另給隨機遺物：瘋狂 +5、夢域 +10；每個角色每天最多 5 件（兩模式合計），超過改給階段一。
 *       夢域鏡模式的時空裂痕要一轉以上才能進入。
 *   ‧完全通關另給：瘴氣魔石 100／骸骨魔石 50／破空石 10。
 * 2026-11-03：席琳三模式的裂痕裡，場上有頭目時自動鎖定最早出場（暴走計時最久）的頭目（包 getTarget；原本變身頭目每一階都鎖在同一格，
 *   另一隻同時在場的頭目只吃到濺射、暴走一直疊 → 團滅）。暴走抑制劑（afk-riftsupply）用 calm() 把暴走層數歸零。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'rift2', name: '時空裂痕重做（席琳三模式）', group: '遊戲玩法',
    desc: '時空裂痕改用遊戲時間；席琳三模式一趟 80 分鐘、越後面越難（頭目 60 秒沒倒會暴走、60 分鐘起全場扣血），掉哀石系列與失去光芒的符文石，撐滿 80 分鐘給瘴骸·破材料' });
  var ON = !T || T.enabled('rift2');
  var RD = W.__afkRuneData;
  if (typeof W.enterRift !== 'function' || typeof W.spawnRiftMob !== 'function' || !RD) { console.warn('[AFK-rift2] 找不到時空裂痕，略過'); return; }
  var S = function () { return typeof state !== 'undefined' ? state : {}; };
  // ── 變身鏈後段不單獨進裂痕池（2026-11-03 fixD，修 bug；不跟 rift2 開關）──
  //   核心 _TRANSFORM_STAGE_IDS（js/05）在核心載入時就算好，外掛後來加的變身階段（afk-corrupt 的 cr_*_d2～d7、安塔瑞斯 s4～s7…）不在裡面
  //   → 最終階（例：深淵的時空巴拉卡斯）會直接在裂痕出場。這裡把所有 transformTo 的目標補進去；
  //   名字含四大龍的變身鏈：第一階補進 RIFT_DRAGONS（30 分鐘後才入池、場上最多 1 隻），整條的名字補進 RIFT_DRAGON_NAMES（任何一階在場都算「有龍」）。
  var DRAGON_RE = /安塔瑞斯|法利昂|巴拉卡斯|林德拜爾/;
  var fixStages = function () {
    try {
      if (typeof DB === 'undefined' || !DB.mobs) return;
      var g = function (n) { try { return (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : null'); } catch (e) { return null; } };
      var set = g('_TRANSFORM_STAGE_IDS'), ids = g('RIFT_DRAGONS'), names = g('RIFT_DRAGON_NAMES');
      var tgt = {};
      Object.keys(DB.mobs).forEach(function (id) { var t = DB.mobs[id] && DB.mobs[id].transformTo; if (t) tgt[t] = 1; });
      if (set && set.add) Object.keys(tgt).forEach(function (id) { set.add(id); });
      if (!ids || !names) return;
      Object.keys(DB.mobs).forEach(function (id) {
        var m = DB.mobs[id]; if (!m || tgt[id] || !m.transformTo) return;
        var chain = [], cur = id, guard = 0;
        while (cur && DB.mobs[cur] && guard++ < 20) { chain.push(DB.mobs[cur].n); cur = DB.mobs[cur].transformTo; }
        if (!chain.some(function (n) { return DRAGON_RE.test(n || ''); })) return;
        if (ids.indexOf(id) < 0) ids.push(id);
        chain.forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); });
      });
    } catch (e) { console.warn('[AFK-rift2] stages', e); }
  };
  fixStages(); W.addEventListener('load', fixStages);
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  // ── 副本／專屬頭目不進席琳三模式的裂痕池（玩家 2026-11-04：例 異界祭壇的半身／真‧吉爾塔斯）──
  //   判準（一條規則，不列名單）：頭目必須出現在至少一張「一般狩獵地圖」的出怪表裡才可以進池。
  //   一般狩獵地圖＝地圖選單的 野外／地監／傲慢之塔／海賊島／時空裂痕領域 分類＋風木地監（城堡）＋象牙塔隱藏區域＋遺忘之島，
  //   但去掉：外掛自建地圖（afk_*，副本／事件／任務）、支配者傲慢之塔（dom_tower*）、純頭目房、軍王之室與祭壇（KING_ROOMS）、
  //   四龍副本（ANTHARAS_AREA_BOSS）、不能離線掛機的地圖（__afkNoOfflineMaps）、攻城區、新兵修練場、夢幻之島。
  //   只靠程式叫出來、不在任何出怪表的頭目（任務、世界事件、地區頭目、最終決戰）自然也被排除。
  //   例外：核心的四大龍（安塔瑞斯／法利昂／巴拉卡斯／林德拜爾）本來就是裂痕設計的一部分，照舊 lvFull 分鐘後入池。
  var CORE_DRAGONS = ['antaras', 'fafurion', 'valakas', 'lindvior'];
  var banCache = null;
  var g0 = function (n) { try { return (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : null'); } catch (e) { return null; } };
  var openMap = function (id, cat) {
    if (!id || /^afk_|^dom_tower|^town_/.test(id) || id === 'rift_battle' || id === 'training' || id === 'dream_island') return false;
    var PB = g0('PURE_BOSS_MAPS') || [], KR = g0('KING_ROOMS') || {}, AA = g0('ANTHARAS_AREA_BOSS') || {};
    if (PB.indexOf(id) >= 0 || KR[id] || AA[id] || (W.__afkNoOfflineMaps || []).indexOf(id) >= 0) return false;
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false; } catch (e) {}
    return !!cat[id];
  };
  var riftBan = function () {
    if (banCache) return banCache;
    var ban = {}, ok = {}, cat = {};
    try {
      var MC = g0('MAP_CATEGORIES') || {};
      ['wild', 'dungeon', 'tower', 'pirate_island', 'rift'].forEach(function (c) { (MC[c] || []).forEach(function (m) { if (m && m.v) cat[m.v] = 1; }); });
      (g0('CASTLE_EXTRA') || []).forEach(function (id) { cat[id] = 1; });
      var HP = g0('HIDDEN_AREA_PARENT') || {}; Object.keys(HP).forEach(function (k) { cat[HP[k]] = 1; });
      cat.oblivion_island = 1;
      Object.keys(DB.maps || {}).forEach(function (mid) { if (openMap(mid, cat)) (DB.maps[mid] || []).forEach(function (id) { ok[id] = 1; }); });
      Object.keys(DB.mobs).forEach(function (id) { var m = DB.mobs[id]; if (m && m.boss && !ok[id] && CORE_DRAGONS.indexOf(id) < 0) ban[id] = 1; });
    } catch (e) { console.warn('[AFK-rift2] ban', e); }
    if (document.readyState === 'complete') banCache = ban;   // 外掛的地圖與頭目都載完才固定下來
    return ban;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var TUNE = W.__afkRift2Tune = W.__afkRift2Tune || {
    hpFrom: 20, hpRate: { sherine: 0.035, mad: 0.0525, dream: 0.0525 },   // 20 分鐘起怪物 HP ×e^(rate×(分鐘−20))；席琳模式 0.067 → 0.035（玩家 2026-10-29：王族＋7 名轉生傭兵、冥皇套 +15 要能撐滿 80 分鐘；實測原本 63～65 分被頭目暴走團滅）
    hpBase: { sherine: 1, mad: 1, dream: 0.15 },   // 各模式怪物 HP 的基本倍率（夢域鏡本身已經 ×50，用這個把三模式拉到同一條難度線）
    enrageSec: 60, enrageMulti: 90, enragePct: 0.05, enrageStep: 0.05, enrageEvery: 10,   // 頭目 60 秒沒倒：每秒全隊最大 HP 5%，每 10 秒再 +5%
    wallFrom: 60, wallBase: 0.004, wallStep: 0.0025,   // 60 分鐘起全場每秒扣 0.4% 最大 HP，每分鐘再 +0.25%
    clearMin: 80,
    // 出怪時間軸（2026-11-03 23:39）：核心是開場 30 分鐘怪物等級就到上限 100、20 分鐘起一半機率出頭目、30 分鐘起出四大龍。
    //   席琳三模式改成：等級上限 lvFull 分鐘才到 100（四大龍同時才入池），bossHalf 分鐘起一半機率出頭目；之前每 5 分鐘一隻頭目。
    lvFull: 60, bossHalf: 20,
    // 怪物攻擊力（核心 riftDamageMult：30 分起每分鐘 +20%，70 分 ×9、100 分 ×15）。席琳三模式改成分段直線：
    //   [分鐘, 倍率]——開場 ×0.2、63 分 ×0.5、70 分 ×12、74 分 ×30、80 分 ×40（之間直線；80 分以後照最後一段的斜率繼續）
    //   2026-11-04（玩家）：60→67 分的爬升整段往後挪 3 分鐘（原本 60 ×0.5、67 ×12）；74／80 不動 → 每一分鐘都不比原本高
    dmgCurve: [[0, 0.2], [63, 0.5], [70, 12], [74, 30], [80, 40]],
    // 暴走：lateFrom 分鐘以後，每 10 秒的增量改成 enrageStepLate
    enrageLateFrom: 0, enrageStepLate: 0.05,
    // 時空侵蝕（2026-11-04）：同一隻頭目出場滿 erodeFrom 秒還沒倒，暴走再加 erodeStep，之後每 10 秒再加一次；暴走抑制劑消不掉這一段
    erodeFrom: 180, erodeStep: 0.15
  };
  var DROP = { mob: 0.01, bossLow: 0.10, bossHigh: 0.25, bossFrom: 60, box: 0.00001, relicX: 10,
    legend: 0.01, legendPct: 0.15, legendId: 'afk_rune_po_l' };   // 玩家 2026-10-29：席琳模式前 15% 時間（80 分的前 12 分）每次擊殺 1% 掉傳說符文「破」，給新手用；一趟最多一顆
  var SEG = { mad: [[12, 'box1'], [76, 'box2'], [1e9, 'box3']], dream: [[12, 'box1'], [60, 'box2'], [76, 'box3'], [1e9, 'fate']] };
  // 撐過 RELIC.min 分鐘另給隨機遺物（玩家 2026-11-06）：每個角色每天最多 RELIC.day 件，瘋狂與夢域鏡合計
  var RELIC = { min: 12, day: 5, lv: { mad: 5, dream: 10 } };
  // 未滿 12 分鐘（撤離或戰死）改給隨機遺物（玩家 2026-11-06 15:17）：瘋狂 +0、夢域 +5；每個角色每天 3 件，跟上面的 5 件分開算；超過照舊給階段一
  var EARLY = { day: 3, lv: { mad: 0, dream: 5 } };
  // ── GD之子的期待（Ping 11-12 12:00／12:24，設計稿 docs/gd-rift-design.md）──
  //   沒有進場條件；開場就是 60 分鐘的曲線、之後一直往上；只出頭目；吃次元裂縫規則；保底不生效；沒有時間限制、沒有結算。
  var GD = W.__afkGdTune = W.__afkGdTune || {
    from: 60,                      // 曲線從第幾分鐘開始
    lvStart: 1, lvPerMin: 1.5, lvSpan: 10,   // 頭目等級：從最低開始，每分鐘 +1.5 級，取 [L, L+10]
    dropX: 10, rollN: 2,           // 掉落率 ×10；遺物、符文石每隻頭目判定 2 次
    p5: 0.01, p10: 0.000001,       // 掉到遺物的當下：1% 是 +5、0.0001% 是 +10
    s2: 0.00005, s3: 0.000001, dim: 0.0000001,   // 2★ 符文石 0.005%、3★ 0.0001%、次元符文石 0.00001%（每隻頭目）
    resEvery: 5, resStep: 50,      // 五抗每 5 分鐘 −50，沒有下限
    healFrom: 10, healEvery: 10, healStep: 0.1, healMax: 0.8,   // 治療降低（吸血不受影響）
    dmgFrom: 20, dmgEvery: 20, dmgStep: 0.1, dmgMax: 0.8         // 傷害降低
  };
  var gdOn = function () { return !!(ON && S().riftRun && S()._r2Mode === 'gd' && mapState && mapState.current === 'rift_battle'); };
  var gdStep = function (m, from, every, step, max) { return m < from ? 0 : Math.min(max, step * (1 + Math.floor((m - from) / every))); };
  var relicDay = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var relicUsed = function (p) { var r = p && p.afkRift2RelicDay; return r && r.d === relicDay() ? (Number(r.n) || 0) : 0; };
  var earlyUsed = function (p) { var r = p && p.afkRift2EarlyDay; return r && r.d === relicDay() ? (Number(r.n) || 0) : 0; };
  var segTxt = function (mode) {
    var sg = SEG[mode]; if (!sg) return '失去光芒的符文石（階段一）';
    var nm = { box1: '失去光芒的符文石（階段一）', box2: '失去光芒的符文石（階段二）', box3: '失去光芒的符文石（階段三）', fate: '瘴骸·破材料（隨機一種）' };
    var out = [], from = 0;
    sg.forEach(function (x, i) { out.push((i === sg.length - 1 ? from + ' 分以上或完全通關' : from + '～' + x[0] + ' 分') + '：' + nm[x[1]]); from = x[0]; });
    var lv = RELIC.lv[mode];
    var ev = EARLY.lv[mode];
    return out.join('；') + (ev != null ? '；未滿 ' + RELIC.min + ' 分鐘（撤離或戰死）改給隨機遺物 +' + ev + '（每個角色每天最多 ' + EARLY.day + ' 件，瘋狂與夢域鏡合計；超過照舊給階段一）' : '') + (lv ? '；撐過 ' + RELIC.min + ' 分鐘另給隨機遺物 +' + lv + '（每個角色每天最多 ' + RELIC.day + ' 件，瘋狂與夢域鏡合計；超過改給失去光芒的符文石（階段一））' : '');
  };
  // 裂痕裡每秒最多一次（玩家 2026-11-03 23:39）：小怪死亡代價、王的死亡詛咒、屍爆…同一秒好幾隻倒下只算一次。席琳三模式的裂痕才作用；其他地方一律放行。
  var onceAt = {};
  W.__afkRiftOnce = function (key) {
    if (!rule()) return true;
    var t = S().ticks || 0, last = onceAt[key];
    if (last != null && t >= last && t - last < 10) return false;
    onceAt[key] = t; return true;
  };

  // ── 模式與時間 ──
  var modeNow = function () { var p = P(); if (!p || p.classicMode) return 'plain'; if (p.sherineMad && p.sherineDream) return 'dream'; if (p.sherineMad) return 'mad'; if (p.sherineWorld) return 'sherine'; return 'plain'; };
  var inRift = function () { return !!(S().riftRun && !S().dreamStar && mapState && mapState.current === 'rift_battle'); };   // 暗夢星迴不套用（2026-10-31：原本 HP ×0.15、時空暴走也套進去）
  var rule = function () { return ON && inRift() && S()._r2Mode && S()._r2Mode !== 'plain'; };
  var minutes = function () { var s = S(); return s._r2Start == null ? 0 : Math.max(0, ((s.ticks || 0) - s._r2Start) / 600); };
  var sync = function () {
    var s = S(); if (!s.riftRun || s._r2Start == null) return;
    var now = Date.now();
    s.riftStartMs = now - ((s.ticks || 0) - s._r2Start) * 100;
    if (s._r2BossDue != null) s.riftBossDue = now + (s._r2BossDue - (s.ticks || 0)) * 100;
  };
  var oEnter = W.enterRift;
  W.enterRift = function () {
    try {
      var p0 = P();
      if (ON && p0 && !S().dreamStar && modeNow() === 'dream' && !(Number(p0.rebirth) >= 1)) {   // 暗夢星迴也走 enterRift，不擋
        logSys('<span class="text-rose-300">夢域鏡的時空裂痕要一轉以上才能進入。</span>'); return;
      }
    } catch (e) {}
    var r = oEnter.apply(this, arguments);
    afterEnter(false);
    return r;
  };
  var afterEnter = function (gd) {
    var s = S();
    if (s.riftRun) { s._riftRunKey = s.riftStartMs; s._r2Start = s.ticks || 0; s._r2BossDue = s._r2Start + 3000; s._r2World = modeNow(); s._r2Mode = gd ? 'gd' : modeNow(); s._r2Clear = false; s._r2Wall = 0; s._r2Legend = false; s._r2GdRes = 0; sync();
      if (gd) { try { logSys('<span class="font-bold" style="color:#f0abfc;">🌀 GD之子的期待：裂痕從第 ' + GD.from + ' 分鐘的強度開始，而且不會停下來。只會出現頭目；撐得越久，掉落越好。</span>'); } catch (e) {} try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} } }
  };
  // GD之子的期待的入口：沒有進場條件、不用龜裂之核；上一趟的獎勵還沒領也能進（離場時原封不動放回去）
  W.afkGdEnter = function () {
    if (!ON) return;
    var p = P(), s = S(); if (!p || s.riftRun) return;
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked('rift_battle')) return;
    var st = p.statuses || {};
    if (st.stone > 0 || st.paralyze > 0 || st.freeze > 0 || st.stun > 0 || st.sleep > 0) { logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法進入時空裂痕。'); return; }
    var keep = { ms: p.riftRewardMs, info: p.afkRift2Reward || null };
    try { keep.rank = JSON.stringify([p.riftRank || null, p.riftRankSherine || null]); } catch (e) {}
    p._gdKeep = keep;
    s.riftRun = true; s.riftStartMs = Date.now(); s.riftBossDue = Date.now() + 300000;
    enterRiftMap();
    afterEnter(true);
    try { saveGame(); } catch (e) {}
  };
  var oSpawn = W.spawnRiftMob;
  // 核心抽一隻、抽到副本專屬頭目就重抽（拒絕取樣＝在允許的頭目裡一樣平均）
  var pickOk = function (boss, minLv, maxLv, ks) {
    var ban = riftBan();
    for (var k = 0; k < 40; k++) { var id = pickRiftMob(boss, minLv, maxLv, ks); if (!id) return null; if (!ban[id]) return id; }
    return null;
  };
  // 席琳三模式的出怪（照核心 spawnRiftMob，只換時間軸；暗夢星迴不經過這裡——rule() 已排除）
  var spawnMine = function (idx) {
    var s = S(), t = s.ticks || 0, m = minutes(), gd = s._r2Mode === 'gd';
    var ks = (gd ? m + GD.from : m) * 60 * (30 / TUNE.lvFull);   // 換算成核心時間軸的秒數：lvFull 分鐘 ↔ 核心的 30 分鐘
    var inc = Math.floor(ks / 30), minLv = Math.min(40, 1 + inc), maxLv = Math.min(100, 40 + inc);
    if (gd) { var L = Math.min(100, Math.floor(GD.lvStart + GD.lvPerMin * m)); minLv = Math.max(1, Math.min(L, 100 - GD.lvSpan)); maxLv = Math.min(200, L + GD.lvSpan); }
    var isBoss;
    if (gd) isBoss = true;   // GD之子的期待：只出頭目
    else if (m >= TUNE.bossHalf) isBoss = Math.random() < 0.5;
    else if (s._r2BossDue != null && t >= s._r2BossDue) { isBoss = true; s._r2BossDue = t + 3000; }
    else isBoss = false;
    var id = pickOk(isBoss, minLv, maxLv, ks) || (gd ? (pickOk(true, 1, maxLv + 20, ks) || pickOk(true, 1, 999, ks)) : pickOk(!isBoss, minLv, maxLv, ks));
    if (!id) return;
    var base = DB.mobs[id];
    mapState.mobs[idx] = Object.assign({}, base, { curHp: base.hp, uid: uid(), _born: ++_mobBornSeq, _magCd: {}, justHit: false, st: newMobStatus() });
    applySherineBuff(idx);
    if (mapState.mobs[idx].hard) initHardSkin(mapState.mobs[idx]);
    applySherineGrace(idx);
    if (base.boss && typeof vfxBossEntrance === 'function') { try { vfxBossEntrance(mapState.mobs[idx]); } catch (e) {} }
    if (!s.ff && typeof renderMobs === 'function') renderMobs();
  };
  // 怪物攻擊力（席琳三模式）：TUNE.dmgCurve 分段直線，取代核心「30 分起每分鐘 +20%」
  var dmgMult = function (m) {
    var c = TUNE.dmgCurve || []; if (!c.length) return 1;
    if (m <= c[0][0]) return c[0][1];
    for (var i = 1; i < c.length; i++) if (m <= c[i][0]) { var a = c[i - 1], b = c[i]; return a[1] + (b[1] - a[1]) * (m - a[0]) / (b[0] - a[0]); }
    var y = c[c.length - 2], z = c[c.length - 1]; return z[1] + (z[1] - y[1]) / (z[0] - y[0]) * (m - z[0]);
  };
  if (typeof W.riftDamageMult === 'function') {
    var oRDM = W.riftDamageMult;
    W.riftDamageMult = function () { try { if (rule()) return dmgMult(minutes() + (S()._r2Mode === 'gd' ? GD.from : 0)); } catch (e) {} return oRDM.apply(this, arguments); };
    try { (0, eval)('riftDamageMult = window.riftDamageMult'); } catch (e) {}
  }
  W.spawnRiftMob = function (idx) {
    sync();
    try { if (rule() && typeof pickRiftMob === 'function') { spawnMine(idx); sync(); return; } } catch (e) { console.warn('[AFK-rift2] spawn', e); }
    var s = S(), due0 = s.riftBossDue;
    var r = oSpawn.apply(this, arguments);
    if (s.riftBossDue !== due0 && s._r2Start != null) s._r2BossDue = (s.ticks || 0) + Math.round((s.riftBossDue - Date.now()) / 100);
    return r;
  };
  // 停留時間也用遊戲時間（riftEndRun 讀 Date.now()−riftStartMs）
  var oEnd = W.riftEndRun;
  W.riftEndRun = function () {
    var s = S(), p = P();
    if (!s.riftRun) return oEnd.apply(this, arguments);
    sync();
    var info = { mode: s.dreamStar ? 'plain' : (s._r2Mode || 'plain'), min: minutes(), clear: !!s._r2Clear };   // 暗夢星迴沒有裂痕獎勵
    var r = oEnd.apply(this, arguments);
    try { if (ON && p && info.mode !== 'plain' && info.mode !== 'gd') p.afkRift2Reward = info; } catch (e) {}
    if (info.mode === 'gd') {   // GD之子的期待：沒有結算；記最久紀錄
      try { if (p) { var kp = p._gdKeep || {}; p.riftRewardMs = kp.ms != null ? kp.ms : null; p.afkRift2Reward = kp.info || null; if (kp.rank) { try { var rk = JSON.parse(kp.rank); p.riftRank = rk[0] || undefined; p.riftRankSherine = rk[1] || undefined; } catch (e2) {} } delete p._gdKeep; var best = Number(p.afkGdBest) || 0; if (info.min > best) p.afkGdBest = Math.floor(info.min * 10) / 10; logSys('<span class="font-bold" style="color:#f0abfc;">🌀 GD之子的期待：撐了 ' + Math.floor(info.min) + ' 分鐘' + (info.min > best ? '（新紀錄）' : '（最久 ' + Math.floor(best) + ' 分鐘）') + '。這個難度沒有結算獎勵。</span>'); } } catch (e) {}
      s._r2Mode = null; try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {}
    }
    s._r2Start = null; s._r2BossDue = null;
    return r;
  };

  // ── 難度 ──
  var hpMult = function (mode, m) { var rate = (TUNE.hpRate || {})[mode] || 0, base = (TUNE.hpBase || {})[mode] || 1; return base * (m > TUNE.hpFrom ? Math.exp(rate * (m - TUNE.hpFrom)) : 1); };
  var members = function () { var out = []; if (!player.dead) out.push(player); (player.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) out.push(x); }); return out; };
  var hurtAll = function (pct, why) {
    var dead = false;
    members().forEach(function (t) {
      if (dead) return;
      var dmg = Math.max(1, Math.floor((t.mhp || 1) * pct));
      if (typeof W.__afkTrueCut === 'function') dmg = W.__afkTrueCut(t, dmg);   // 符文「骸」
      if (t === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); dead = true; } }
      else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
    });
    return dead;
  };
  // 頭目暴走：出場 sec 秒（兩隻以上 90 秒）還沒倒 → 每秒全隊最大 HP enragePct，每 enrageEvery 秒再 +enrageStep。
  //   暴走抑制劑（afk-riftsupply，玩家 2026-11-03）：把「再 +」的層數歸零——從使用那一刻重新起算（x._r2.calm），仍是 enragePct 起跳。
  var liveBosses = function () { return (mapState.mobs || []).filter(function (x) { return x && x.boss && !x._dead && x.curHp > 0 && x._r2; }); };
  var enrageNow = function () {
    var t = S().ticks || 0, worst = 0, who = null, stacks = 0;
    var bosses = liveBosses();
    var sec = bosses.length >= 2 ? TUNE.enrageMulti : TUNE.enrageSec;   // 玩家 2026-10-29：同時好幾隻王在場時放寬到 90 秒
    bosses.forEach(function (x) {
      var age = (t - x._r2.born) / 10;
      if (age >= sec) {
        var from = Math.max(sec, x._r2.calm != null ? (x._r2.calm - x._r2.born) / 10 : 0);
        var k = Math.floor(Math.max(0, age - from) / TUNE.enrageEvery), e = TUNE.enragePct + (minutes() >= (TUNE.enrageLateFrom || 1e9) ? (TUNE.enrageStepLate || TUNE.enrageStep) : TUNE.enrageStep) * k;
        if (TUNE.erodeFrom && age >= TUNE.erodeFrom) e += (TUNE.erodeStep || 0) * (1 + Math.floor((age - TUNE.erodeFrom) / TUNE.enrageEvery));
        if (e > worst) { worst = e; who = x; stacks = k; }
      }
    });
    return { pct: worst, who: who, stacks: stacks };
  };
  var calm = function () {
    if (!rule()) return 0;
    var t = S().ticks || 0, n = 0;
    liveBosses().forEach(function (x) { x._r2.calm = t; n++; });
    lastLog.enrage = null;
    return n;
  };
  var logC = function (h) { try { if (!S().ff) logCombat(h, 'enemy'); } catch (e) {} };
  var lastLog = {};
  var step = function () {
    var s = S(); if (!rule()) return;
    var m = minutes(), mode = s._r2Mode, t = s.ticks || 0, gd = mode === 'gd';
    if (gd) { mode = s._r2World && s._r2World !== 'plain' ? s._r2World : 'sherine'; m += GD.from; }   // GD：曲線從 60 分鐘起、沒有通關
    // 五抗每 5 分鐘 −50（GD）：階段變了就重算面板
    if (gd) { var rs = Math.floor((m - GD.from) / GD.resEvery); if (rs !== s._r2GdRes) { s._r2GdRes = rs; try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} if (rs > 0) logC('<span class="font-bold" style="color:#f0abfc;">【時空腐蝕】</span>五屬性抗性 −' + (rs * GD.resStep) + '。'); } }
    // 撐滿 80 分鐘：完全通關
    if (!gd && m >= TUNE.clearMin) {
      s._r2Clear = true;
      try { logSys('<span class="font-bold" style="color:#fde68a;">🌀 你在時空裂痕撐滿了 ' + TUNE.clearMin + ' 分鐘——裂痕在你面前閉合（完全通關）。</span>'); } catch (e) {}
      try { W.riftEndRun(); setMapSelectors('town_rift'); changeMap(true); saveGame(); } catch (e) { console.warn('[AFK-rift2] clear', e); }
      return;
    }
    // 新出場的怪：HP 隨時間成長（含變身後的下一階）
    var k = hpMult(mode, m);
    (mapState.mobs || []).forEach(function (x) {
      if (!x || x._r2 || x._dead) return;
      x._r2 = { born: t };
      if (k !== 1) { x.hp = Math.max(1, Math.floor(x.hp * k)); x.curHp = Math.max(1, Math.floor((x.curHp || x.hp) * k)); if (x.curHp > x.hp) x.curHp = x.hp; }
    });
    if (t % 10) return;
    // 頭目暴走
    var en = enrageNow(), worst = en.pct, who = en.who;
    if (worst > 0) {
      if (lastLog.enrage !== who) { lastLog.enrage = who; logC('<span class="font-bold" style="color:#f472b6;">【時空暴走】</span>' + esc(who.n) + ' 拖得太久，扭曲的時空開始撕裂全隊（每秒最大 HP ' + Math.round(worst * 100) + '%，越拖越重）。'); }
      if (hurtAll(worst, '時空暴走')) return;
    }
    // 60 分鐘起：全場壓力牆
    if (m >= TUNE.wallFrom) {
      var w = TUNE.wallBase + TUNE.wallStep * Math.floor(m - TUNE.wallFrom);
      if (s._r2Wall !== Math.floor(m)) { s._r2Wall = Math.floor(m); logC('<span class="font-bold" style="color:#c084fc;">【裂痕崩塌】</span>時空正在崩落，全隊每秒失去最大 HP ' + (Math.round(w * 1000) / 10) + '%。'); }
      if (hurtAll(w, '裂痕崩塌')) return;
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      sync();
      var r = oTick.apply(this, arguments);
      try { step(); } catch (e) { console.warn('[AFK-rift2] tick', e); }
      return r;
    };
  }

  // ── 目標（玩家 2026-11-03 回報「深淵的時空巴拉卡斯打不動」）──
  //   核心 getTarget 只在目前目標死掉時才換人，而會變身的頭目（安塔瑞斯七階…）每一階都在同一格、目標一直鎖著它；
  //   同時在場的另一隻頭目（例：直接出場的深淵的時空巴拉卡斯）就只吃得到濺射與持續傷害，加上夢域頭目每秒回 0.1%，幾乎不掉血，
  //   但牠的暴走計時一直在走（變身的那隻每一階重新計時）→ 時空暴走越疊越高、團滅。
  //   修正：席琳三模式的裂痕裡，場上有頭目時一律鎖定「最早出場（暴走計時最久）」的那隻頭目。
  var oldestBoss = function () { var b = null; liveBosses().forEach(function (x) { if (!b || x._r2.born < b._r2.born) b = x; }); return b; };
  if (typeof W.getTarget === 'function') {
    var oGT = W.getTarget;
    W.getTarget = function () {
      var t = oGT.apply(this, arguments);
      try {
        if (rule()) {
          var f = oldestBoss();
          if (f && f !== t) { var i = mapState.mobs.indexOf(f); if (i >= 0) { mapState.targetIdx = i; if (!S().ff && typeof renderMobs === 'function') renderMobs(); return f; } }
        }
      } catch (e) {}
      return t;
    };
    try { (0, eval)('getTarget = window.getTarget'); } catch (e) {}
  }

  // ── 掉落 ──
  W.__afkRiftDrop = function (itemId, pct, mob) {
    if (!rule()) return null;
    var d = DB.items[itemId], gd = S()._r2Mode === 'gd', x = gd ? GD.dropX : 1;   // GD之子的期待：再 ×10
    var q = (d && d.relic ? pct * DROP.relicX : pct) * x;
    if (gd && d && d.relic) {   // GD：遺物每隻頭目判定 2 次；掉到的當下判定 +5／+10
      for (var i = 0; i < GD.rollN; i++) if (Math.random() < q / 100) gdRelic(itemId, mob);
      return 0;
    }
    return q;   // 不吃任何加倍；遺物 ×10
  };
  ['partyDropRate', '__afkRelicDropMult'].forEach(function (fn) {
    if (typeof W[fn] !== 'function') return;
    var o = W[fn];
    W[fn] = function (x) { if (rule()) return fn === 'partyDropRate' ? x : 1; return o.apply(this, arguments); };
  });
  // GD：掉到遺物的當下判定強化值
  var gdRelic = function (itemId, mob) {
    var R = W.__afkRelicPlus, r = Math.random(), n = r < GD.p10 ? 10 : (r < GD.p10 + GD.p5 ? 5 : 0), id = itemId;
    if (n && R && R.makeId) {
      try { var d = DB.items[itemId]; n = Math.min(n, d && d.type === 'acc' ? 10 : 15); var fx = null;
        if (n >= R.fxAt(itemId)) { var ds = R.donorsFor(itemId); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }
        var nid = R.makeId(itemId, n, fx); if (R.ensure(nid)) { R.remember && R.remember(nid); id = nid; } } catch (e) { id = itemId; }
    }
    gainItem(id, 1, true, true);
    try { logSys('<span class="text-amber-300 font-bold">✦ 極稀有！' + esc(mob && mob.n || '頭目') + ' 留下了 ' + DB.items[id].n + '。</span>'); } catch (e) {}
  };
  // GD：隨機一顆可以升星的符文，指定星數
  var gdRune = function (star) {
    var pool = (RD.list || []).filter(function (r) { return RD.starOk(r) && DB.items[RD.starId(r.id, star)]; });
    if (!pool.length) return null;
    return RD.starId(pool[Math.floor(Math.random() * pool.length)].id, star);
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, on = rule(), mode = S()._r2Mode, mm = minutes(), gd = mode === 'gd';
      if (gd) { mode = S()._r2World && S()._r2World !== 'plain' ? S()._r2World : 'sherine'; mm += GD.from; }
      var r = oKill.apply(this, arguments);
      try {
        if (on && m && m._dead && !m._r2Paid) {
          m._r2Paid = true;
          var dust = RD.DUST[mode], lv = m.lv || 0;
          var rate = !m.boss ? DROP.mob : (mm >= DROP.bossFrom ? 1 : (lv >= 60 ? DROP.bossHigh : DROP.bossLow));
          if (dust && Math.random() < rate) gainItem(dust, 1, true, true);
          var stage = { sherine: 1, mad: 2, dream: 3 }[mode];
          var S0 = S();
          if (!gd && mode === 'sherine' && mm < TUNE.clearMin * DROP.legendPct && !S0._r2Legend && DB.items[DROP.legendId] && Math.random() < DROP.legend) {
            S0._r2Legend = true; gainItem(DROP.legendId, 1, true, true);
            try { logSys('<span class="text-amber-300 font-bold">✦ 傳說！' + esc(m.n) + ' 的殘影裡掉出了 ' + DB.items[DROP.legendId].n + '。</span>'); } catch (e) {}
          }
          for (var bi = 0; bi < (gd ? GD.rollN : 1); bi++)   // GD：符文石箱每隻頭目判定 2 次、機率 ×10
            if (m.boss && stage && Math.random() < DROP.box * (gd ? GD.dropX : 1)) { gainItem(RD.BOX[stage], 1, true, true); try { logSys('<span class="text-amber-300 font-bold">✦ 極稀有！' + esc(m.n) + ' 留下了 ' + DB.items[RD.BOX[stage]].n + '。</span>'); } catch (e) {} }
          if (gd && m.boss) {   // GD：2★／3★ 符文石、次元符文石
            var gx = [[GD.s2, function () { return gdRune(2); }], [GD.s3, function () { return gdRune(3); }], [GD.dim, function () { return DB.items.afk_rune_dim ? 'afk_rune_dim' : null; }]];
            gx.forEach(function (g) { if (Math.random() < g[0]) { var gid = g[1](); if (gid && DB.items[gid]) { gainItem(gid, 1, true, true); try { logSys('<span class="font-bold" style="color:#f0abfc;">✦ 傳說！' + esc(m.n) + ' 的殘影裡掉出了 ' + DB.items[gid].n + '。</span>'); } catch (e) {} } } });
          }
        }
      } catch (e) { console.warn('[AFK-rift2] drop', e); }
      return r;
    };
  }

  // ── 結算 ──
  var randomRelic = function (lv) {
    var R = W.__afkRelicPlus; if (!R) return null;
    var pool = Object.keys(DB.items).filter(function (id) { var d = DB.items[id]; return d && !/~/.test(id) && R.kindOk && R.kindOk(d); });
    if (!pool.length) return null;
    var base = pool[Math.floor(Math.random() * pool.length)], d = DB.items[base];
    var n = Math.min(lv, d.type === 'acc' ? 10 : 15), fx = null;
    if (n >= R.fxAt(base)) { var ds = R.donorsFor(base); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }
    var id = R.makeId(base, n, fx); if (!R.ensure(id)) return null; R.remember(id);
    return id;
  };
  var giveFate = function () { var k = ['sherine', 'mad', 'dream'][Math.floor(Math.random() * 3)], c = RD.CLEAR[k]; gainItem(c[0], c[1], true, true); return DB.items[c[0]].n + ' ×' + c[1]; };
  var reward = function (info) {
    var got = [], add = function (id, n) { if (!id || !DB.items[id]) return; gainItem(id, n || 1, true, true); got.push('<span class="' + (DB.items[id].c || '') + '">' + DB.items[id].n + '</span>' + ((n || 1) > 1 ? ' ×' + n : '')); };
    var m = info.min, mode = info.mode, kind = 'box1';
    if (mode === 'mad' || mode === 'dream') { var seg = SEG[mode], k = info.clear ? 1e9 - 1 : m; for (var i = 0; i < seg.length; i++) if (k < seg[i][0]) { kind = seg[i][1]; break; } }
    var early = EARLY.lv[mode] != null && !info.clear && m < RELIC.min, pe = P(), eid = null;
    if (early && pe && earlyUsed(pe) < EARLY.day) { eid = randomRelic(EARLY.lv[mode]); if (eid) pe.afkRift2EarlyDay = { d: relicDay(), n: earlyUsed(pe) + 1 }; }
    if (eid) add(eid);
    else if (kind === 'fate') got.push(giveFate());
    else add(RD.BOX[Number(kind.slice(3))]);
    if (RELIC.lv[mode] && (info.clear || m >= RELIC.min)) {
      var p = P();
      if (p && relicUsed(p) < RELIC.day) {
        var rid = randomRelic(RELIC.lv[mode]);
        if (rid) { add(rid); p.afkRift2RelicDay = { d: relicDay(), n: relicUsed(p) + 1 }; }
      } else add(RD.BOX[1]);
    }
    if (info.clear && RD.CLEAR[mode]) add(RD.CLEAR[mode][0], RD.CLEAR[mode][1]);
    return got;
  };
  if (typeof W.claimRiftReward === 'function') {
    var oClaim = W.claimRiftReward;
    W.claimRiftReward = function () {
      var p = P(), info = p && p.afkRift2Reward;
      if (!ON || !info || p.riftRewardMs == null) return oClaim.apply(this, arguments);
      var got = reward(info);
      p.riftRewardMs = null; p.afkRift2Reward = null;
      var MN = { sherine: '席琳', mad: '瘋狂席琳', dream: '夢域鏡席琳' };
      try { logSys('<span class="text-amber-300 font-bold">🎁 時空裂痕獎勵（' + MN[info.mode] + '模式，停留 ' + Math.floor(info.min) + ' 分' + (info.clear ? '，完全通關' : '') + '）：</span>' + (got.length ? got.join('、') : '這次什麼也沒有凝聚出來') + '。'); } catch (e) {}
      try { saveGame(); } catch (e) {}
      var c = document.getElementById('interaction-content'); if (c && typeof W.renderRiftEntrance === 'function') { c.innerHTML = ''; W.renderRiftEntrance(c); }
      try { updateUI(); } catch (e) {}
    };
  }
  if (typeof W.renderRiftEntrance === 'function') {
    var oRender = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oRender.apply(this, arguments);
      try {
        if (!ON || !container) return r;
        var mode = modeNow(); if (mode === 'plain') return r;
        var MN = { sherine: '席琳', mad: '瘋狂席琳', dream: '夢域鏡席琳' };
        var rw = segTxt(mode);
        var cl = RD.CLEAR[mode];
        var div = document.createElement('div');
        div.className = 'bg-slate-900/70 border border-violet-700 rounded-lg p-3 text-sm leading-relaxed text-slate-200';
        div.innerHTML = '<div class="font-bold text-violet-300 mb-1">目前：' + MN[mode] + '模式（時空裂痕重做）</div>'
          + '<div>一趟最長 ' + TUNE.clearMin + ' 分鐘，撐滿就是<b>完全通關</b>（另給 ' + DB.items[cl[0]].n + ' ×' + cl[1] + '）。' + TUNE.hpFrom + ' 分鐘後怪物越來越硬、' + TUNE.lvFull + ' 分鐘怪物等級到最高、之後攻擊力大幅上升；頭目出場 ' + TUNE.enrageSec + ' 秒（同時兩隻以上 ' + TUNE.enrageMulti + ' 秒）還沒倒會<b>時空暴走</b>；' + TUNE.wallFrom + ' 分鐘起全場每秒扣血。</div>'
          + '<div>同一隻頭目出場 ' + TUNE.erodeFrom + ' 秒還沒倒會「時空侵蝕」（暴走再 +' + Math.round(TUNE.erodeStep * 100) + '%，每 10 秒再加，暴走抑制劑消不掉）。小怪死亡的代價、王的死亡詛咒、王的殘響：裂痕裡每種每秒最多一次。</div>'
          + '<div>掉落：' + DB.items[RD.DUST[mode]].n + '（一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉）；不吃任何掉寶加倍；遺物 0.001%。' + (mode === 'sherine' ? '前 ' + Math.round(TUNE.clearMin * DROP.legendPct) + ' 分鐘每次擊殺 ' + (DROP.legend * 100) + '% 掉傳說符文「汲」（一趟最多一顆）。' : '') + '</div>'
          + '<div>結算：' + rw + '。</div>';
        (container.firstElementChild || container).appendChild(div);
      } catch (e) {}
      return r;
    };
  }
  W.__afkRift2 = { segTxt: segTxt, RELIC: RELIC, relicUsed: relicUsed, EARLY: EARLY, earlyUsed: earlyUsed, TUNE: TUNE, DROP: DROP, SEG: SEG, minutes: minutes, modeNow: modeNow, rule: rule, reward: reward, hpMult: hpMult, dmgMult: dmgMult, fixStages: fixStages, riftBan: riftBan, enrage: enrageNow, calm: calm, oldestBoss: oldestBoss };
  console.log('[AFK-rift2] 已啟用：時空裂痕改用遊戲時間' + (ON ? '＋席琳三模式新規則' : ''));
})();
