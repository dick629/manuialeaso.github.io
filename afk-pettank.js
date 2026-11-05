/* ============================================================================
 * afk-pettank.js — 寵物被動「頑強抵抗」（玩家 2026-11-05 14:31～15:14 定案；開關 pettank，預設開；經典模式不套用）
 *
 * 規則：
 *   ‧出戰寵物替隊伍其他人（玩家、傭兵、其他寵物、召喚物）承受怪物這一下的 10%：
 *     從「被保護者減傷前的原始傷害」切（玩家 15:14 選 B）——10% 交給承受者寵物，用寵物自己的防禦／減傷算；
 *     被保護者吃剩下的 90%，再照自己的防禦／減傷算。
 *   ‧承受者 AC ≤ −800 且魔防 ≥ 800（petDerive 的 ac／mr，即隊伍面板顯示的數字）：改切 20%，交給寵物的那一份先減 200（不低於 0）；
 *     被保護者吃 80%。
 *   ‧寵物那一份照 js/22 寵物受傷的寫法算（就像這隻怪對寵物打了這麼多）：
 *       物理：− 傷害減免 − AC 隨機減傷 − 堅硬，至少 1，× 化身減傷 × 夥伴精通 × 寵物專用盔甲，鐵衛嘲諷 ×0.9，× 時空裂痕倍率
 *       魔法：× 魔防倍率 − 傷害減免 − 堅硬（固定傷害的魔法略過這步），× 席琳倍率，至少 1，× 同上三項，× 時空裂痕倍率
 *       復活後的「珍愛夥伴的執念」無敵期間：0
 *   ‧外掛頭目的百分比技能（原本就無視防禦）：直接切，寵物那一份不吃防禦。
 *   ‧承受者：出戰中、沒倒地、HP ≥ 最大 HP 30% 的寵物裡挑一隻——先比能不能拿 20%，再比目前 HP、再比最大 HP。每刻重新挑；
 *     同一刻內承受者掉到 30% 以下就停止承受（下一刻重挑）。承受者自己被打不轉移。
 *   ‧掛點：
 *       核心（scripts/apply-core-patches.mjs「頑強抵抗」補丁）：怪物普攻／連擊打你、傭兵、寵物、召喚物，物理在席琳倍率之後、
 *         屬性與防禦之前；怪物魔法在傷害公式之前（骰值與加值一起乘）→ window.__afkPetTankRaw 回傳被保護者要吃的比例
 *       外掛頭目：afk-lore-kit 的 boss.hurt（哈爾巴斯、哈汀、地區頭目、世界事件、幽靈船…共用）、
 *         afk-finalboss、afk-dreamstar、afk-kurt-hunt、afk-siege2（濺射）的 hurt 呼叫 __afkPetTank.split
 *   ‧不轉移：持續傷害（毒、燒、燙、流血）、血壁空間、疼痛的歡愉等反彈（反彈的是自己打出去的傷害；afk-dreamboss 用 noTank 包）、
 *     夢域／副本侵蝕、王的殘響、屍爆、時空暴走與裂痕崩塌、二轉女神的吸取、迷魅僕人的波及、施法的 HP 代價、死亡藥水。
 *   ‧寵物那一份在怪物命中、算傷害時就扣：之後被保護者若靠閃避以外的方式免掉這一下（例如魅魔女皇的誘惑反射、火熱愛意），
 *     寵物那一份仍然算。不呼叫遺物受傷事件（寵物那一份不觸發受擊類效果、不硬直），經驗、掉落等其他結果不變。
 * 戰鬥日誌：不逐次印；有承受時最多每 10 秒一行摘要（補跑期間 logCombat 本來就不印）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'pettank', name: '寵物頑強抵抗', group: '遊戲玩法', seal: true,
    desc: '出戰寵物替隊伍其他人承受怪物傷害的 10%（AC −800、魔防 800 以上：20%，承受的那份先減 200）；寵物 HP 低於 30% 就停止' });
  if (typeof W.petsOutList !== 'function' || typeof W.petDerive !== 'function') { console.warn('[AFK-pettank] 找不到寵物系統，略過'); return; }
  var CFG = { pct: 0.10, pctHi: 0.20, cut: 200, ac: -800, mr: 800, stop: 0.30, logEvery: 100 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('pettank'))); };
  var num = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var mhpOf = function (pt) { return Math.max(1, typeof W.petMhpEff === 'function' ? num(W.petMhpEff(pt)) : num(pt.mhp)); };
  var stats = { moved: 0, taken: 0, hits: 0, downs: 0 };
  var win = { taken: 0, saved: 0, at: 0 };

  // ── 承受者：每刻挑一次 ──
  var pickCache = { t: -1, n: -1, v: null };
  var eligible = function (pt) { return !!(pt && !pt._downed && num(pt.hp) > 0 && num(pt.hp) >= mhpOf(pt) * CFG.stop); };
  var pick = function () {
    var t = tk(), outs = W.petsOutList() || [];
    if (pickCache.t === t && pickCache.n === outs.length) {
      var c = pickCache.v;
      return (c && eligible(c.pet) && outs.indexOf(c.pet) >= 0) ? c : null;   // 同一刻內掉到 30% 以下 → 這一刻停止承受
    }
    var best = null;
    for (var i = 0; i < outs.length; i++) {
      var pt = outs[i]; if (!eligible(pt)) continue;
      var d = null; try { d = W.petDerive(pt); } catch (e) {}
      if (!d) continue;
      var hi = num(d.ac) <= CFG.ac && num(d.mr) >= CFG.mr, hp = num(pt.hp), mh = mhpOf(pt);
      if (!best || (hi && !best.hi) || (hi === best.hi && (hp > best.hp || (hp === best.hp && mh > best.mh)))) best = { pet: pt, d: d, hi: hi, hp: hp, mh: mh };
    }
    pickCache = { t: t, n: outs.length, v: best };
    return best;
  };

  // ── 寵物那一份：照 js/22 寵物受傷的寫法算 ──
  var petTake = function (c, load, kind, mob) {
    var pt = c.pet, d = c.d, v;
    var mult = (typeof W.teamDmgReduceMult === 'function' ? W.teamDmgReduceMult(true) : 1)
      * (typeof W.petMasteryTakenMult === 'function' ? W.petMasteryTakenMult() : 1)
      * (typeof W.petArmorDmgReduceMult === 'function' ? W.petArmorDmgReduceMult(pt) : 1);
    var harden = typeof W.petHardenDr === 'function' ? num(W.petHardenDr(pt)) : 0;
    var rift = typeof W.riftDamageMult === 'function' ? num(W.riftDamageMult()) || 1 : 1;
    if (kind === 'phys') {   // 原始傷害已含席琳倍率（核心掛點在席琳倍率之後）
      v = load - num(d.dr) - (typeof W.petRandomPhysicalDr === 'function' ? num(W.petRandomPhysicalDr(pt, d)) : 0) - harden;
      v = Math.floor(Math.max(1, v) * mult);
      if (mob && typeof W.ironGuardTauntWeakensAttack === 'function' && W.ironGuardTauntWeakensAttack(mob)) v = Math.floor(v * 0.9);
      v = Math.max(1, Math.floor(v * rift));
    } else if (kind === 'magic' || kind === 'fixed') {   // 原始傷害＝技能骰值＋加值（席琳倍率在這裡乘，同寵物原本的魔法受傷）
      var sh = mob ? (mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1) : 1;
      v = kind === 'fixed' ? load : Math.floor(load * (typeof W.mrMult === 'function' ? W.mrMult(num(d.mr)) : 1)) - num(d.dr) - harden;
      v = Math.max(1, Math.floor(Math.max(1, v * sh) * mult));
      v = Math.max(1, Math.floor(v * rift));
    } else v = Math.floor(load);   // 外掛頭目的百分比技能：原本就無視防禦
    if (typeof W.petDevotionGuardOn === 'function' && W.petDevotionGuardOn(pt)) v = 0;
    return Math.max(0, Math.floor(v));
  };
  var hitPet = function (c, got) {
    var pt = c.pet;
    pt.hp = num(pt.hp) - got;
    if (pt.hp <= 0) { stats.downs++; if (typeof W._petDown === 'function') W._petDown(pt, '頑強抵抗'); else { pt.hp = 0; pt._downed = true; pt._reviveCd = 50; } }
    if (typeof W.petMarkDirty === 'function') W.petMarkDirty();
  };

  // 核心：t 這一下的原始傷害 raw → 寵物那一份直接打在承受者身上；回傳被保護者要吃的比例
  var busy = 0;
  var take = function (t, raw, kind, mob) {
    if (busy || !(raw > 0) || !t || !on()) return 1;
    var c = pick(); if (!c || c.pet === t) return 1;
    var pct = c.hi ? CFG.pctHi : CFG.pct, share = raw * pct;
    var load = c.hi ? Math.max(0, share - CFG.cut) : share, got = 0;
    busy++;
    try { if (load > 0) { got = petTake(c, load, kind, mob); if (got > 0) hitPet(c, got); } }
    catch (e) { console.warn('[AFK-pettank] take', e); }
    finally { busy--; }
    stats.moved += share; stats.taken += got; stats.hits++;
    win.saved += share; win.taken += got;
    return 1 - pct;
  };

  // 戰鬥日誌摘要：最多每 10 秒一行
  var flush = function () {
    var t = tk();
    if (t - win.at < CFG.logEvery) return;
    win.at = t;
    if (!(win.saved > 0)) return;
    if (!(typeof state !== 'undefined' && state && state.ff) && typeof W.logCombat === 'function') {
      var c = pickCache.v, nm = c && c.pet ? c.pet.form : '寵物';
      try { W.logCombat('<span class="font-bold" style="color:#fbbf24">【頑強抵抗】</span>寵物 ' + nm + ' 這 10 秒替隊伍分擔了 ' + Math.round(win.saved) + ' 點傷害，自己受到 ' + win.taken + ' 點。', 'player-special'); } catch (e) {}
    }
    win.saved = 0; win.taken = 0;
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { if (win.saved > 0 || tk() - win.at >= CFG.logEvery) flush(); } catch (e) {} return r; };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  var isParty = function (a) { var p = P(); return !!(p && a && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var isMob = function (m) { return !!(m && typeof m === 'object' && m.curHp != null && !isParty(m)); };

  // ── 核心掛點（補丁「頑強抵抗」）：怪物打你、傭兵、寵物、召喚物，減傷前 ──
  W.__afkPetTankRaw = function (t, raw, mob, kind) {
    try { return isMob(mob) ? take(t, num(raw), kind === 'phys' || kind === 'magic' || kind === 'fixed' ? kind : 'phys', mob) : 1; } catch (e) { return 1; }
  };
  // ── 外掛頭目的百分比技能（原本就無視防禦）：回傳 t 要吃的量 ──
  var split = function (t, dmg) {
    if (!(dmg > 0)) return dmg;
    var m = take(t, dmg, 'true', null);
    return m === 1 ? dmg : Math.max(0, Math.floor(dmg * m));
  };
  // 外掛頭目共用的 boss.hurt（afk-lore-kit）
  var hookLore = function () {
    var L = W.__afkLore, B = L && L.boss; if (!B || typeof B.hurt !== 'function' || B.hurt.__afkPetTank) return;
    var o = B.hurt;
    B.hurt = function (t, dmg) {
      if (!(dmg > 0) || !isParty(t)) return o.apply(this, arguments);
      var a = Array.prototype.slice.call(arguments);
      a[1] = split(t, dmg);
      if (!(a[1] > 0)) return 0;
      return o.apply(this, a);
    };
    B.hurt.__afkPetTank = true;
  };
  if (document.readyState === 'complete') hookLore(); else W.addEventListener('load', hookLore);
  hookLore();

  W.__afkPetTank = {
    CFG: CFG, stats: stats, pick: pick, on: on,
    split: function (t, dmg) { try { return isParty(t) ? split(t, dmg) : dmg; } catch (e) { return dmg; } },
    // 反彈類（自己打出去的傷害被彈回來）走共用扣血點時，包在這裡面就不轉移
    noTank: function (fn) { busy++; try { return fn(); } finally { busy--; } },
    _petTake: petTake,
    _reset: function () { pickCache = { t: -1, n: -1, v: null }; stats.moved = stats.taken = stats.hits = stats.downs = 0; win.saved = win.taken = 0; }
  };
  console.log('[AFK-pettank] 已啟用：寵物頑強抵抗');
})();
