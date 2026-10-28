/* ============================================================================
 * afk-rebirth2.js — 二轉（第二次轉生）與二轉決戰（玩家 2026-10-26 指定）
 *
 * 條件：已轉生一次、集齊八職業「不屈的命運」，並挑戰過「二轉決戰：死亡女神 席琳」（每個角色一次）。
 *   二轉決戰：規則同第一次最終決戰（席琳夢域鏡中、席琳神殿祈禱視窗進入、20 分鐘、中途離開＝失敗），但席琳方所有傷害 +5%。
 * 結果：
 *   ‧打贏 → 光環「次元突破者」：得到 GM 道具（萬象支配者・GM 武器／神甲）、取得天堂XXX 的資格（建設中）。
 *       代價：不能當別人的傭兵，也不能招募傭兵——只能自己一個人。
 *       單人試煉（2026-10-26 改成只有一次）：席琳方傷害 −100%、席琳的 AC／減傷／魔防／抗性 −50%。
 *         打贏：可以再當別人的傭兵，也可以招募傭兵；打輸：永遠不能當傭兵，但可以開始招募別人（次元突破者以外的角色）。
 *   ‧打輸 → 光環「封印輪迴」：失去進入席琳夢域鏡的資格（仍然可以當傭兵）；不屈者意志也無法再賦予。
 *   ‧兩種結果都會開放冥王域的第二次轉生。
 * 二轉：消耗八顆不屈的命運（每職業一顆）、需 Lv150（滿等）；等級回 1、經驗歸零，保留目前的等級 HP／MP；
 *   面板能力再 +50（近／遠／魔傷害與命中、額外魔法點數、四屬性抗性、魔防、迴避 +50，AC −50）、等級上限 150 → 200。
 * ========================================================================== */
(function () {
  'use strict';
  var FB = window.__afkFinalBoss, DS = window.__afkDreamStar;
  if (!FB || !DS) { console.warn('[AFK-rebirth2] 找不到最終頭目或暗夢星迴，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var rec2 = function (p) { p = p || P(); return p && p.afkFinal2 && typeof p.afkFinal2 === 'object' ? p.afkFinal2 : null; };
  var breaker = function (p) { var r = rec2(p); return !!(r && r.result === 'win' && !r.pending); };
  var soloDone = function (p) { var r = rec2(p); return !!(r && r.solo && !r.solo.pending); };
  var locked = function (p) { var r = rec2(p); return breaker(p) && !(r.solo && r.solo.result === 'win' && !r.solo.pending); };   // 不能當傭兵
  var noHire = function (p) { return breaker(p) && !soloDone(p); };   // 不能招募（單人試煉前）
  var sealedR = function (p) { var r = rec2(p); return !!(r && r.result === 'lose' && !r.pending); };
  var fates = function () { try { return DS.fateHave(); } catch (e) { return 0; } };
  var firstDone = function (p) { var r = p && p.afkFinal; return !!(r && !r.pending); };
  var GM = ['99999', '99998'];

  // ── 挑戰前公告：最低需求（2026-10-26 實測：二轉決戰模擬）──
  var NEED = '席琳的血量依進場時的隊伍人數調整（人數 ÷ 16），不需要湊滿 16 人。建議配備（實測）：全員時空變身（或聖衣）、全身昇華支配 +1 以上（+1 約 19 分鐘、+3 約 16 分鐘、+5 約 13 分鐘）。'
    + '只有神話變身的隊伍，就算全身昇華 +5、神話卡冊全滿也打不完（以上是 16 人的實測；人數少時血量同比例降低）。';
  var TIER_N = { mythic: '神話', celestial: '天上', spacetime: '時空', samsara: '聖衣' };
  var readiness = function (p) {
    var party = 1 + (p.allies || []).filter(function (a) { return a && !a._downed; }).length;
    var f = p.poly && p.buffs && p.buffs.poly > 0 ? (TIER_N[p.poly.cardAscensionTier] || '一般') : '沒有變身';
    var asc = null; Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k]; if (!it || !it.id || k === 'doll' || k === 'pet') return; var m = String(it.id).match(/~a(\d)/), v = m ? Number(m[1]) : -1; asc = asc == null ? v : Math.min(asc, v); });
    var ok = (f === '時空' || f === '聖衣') && asc != null && asc >= 1;
    return { ok: ok, text: '你目前：隊伍 ' + party + ' 人（席琳 HP ' + Math.round(Math.min(1, party / 16) * 100) + '%）、變身 ' + f + '、全身最低 ' + (asc == null ? '—' : asc < 0 ? '未昇華' : '昇華支配 +' + asc) + (ok ? '（達到建議配備）' : '（未達建議配備）') };
  };

  // ── 二轉決戰／單人重打 ──
  var canSecond = function (p) { return !!p && p.rebirth >= 1 && p.rebirth < 2 && firstDone(p) && !rec2(p) && fates() >= 8; };
  window.afkFinalEnter2 = function () {
    var p = P(); if (!p) return;
    if (!FB.dreamOn()) { sys('<span class="text-red-400">只有在「瘋狂席琳＋席琳夢域鏡」的世界裡，才能走進死亡之海。</span>'); return; }
    if (rec2(p)) { sys('<span class="text-slate-300">二轉決戰每個角色只有一次。</span>'); return; }
    if (!canSecond(p)) { sys('<span class="text-red-400">二轉決戰需要：已轉生一次、第一次最終決戰已挑戰過、集齊八職業的不屈的命運（目前 ' + fates() + '／8）。</span>'); return; }
    if (typeof state !== 'undefined' && (state.antharas || state.riftRun || state.prideClimb)) { sys('<span class="text-amber-300">你正身在其他副本之中。</span>'); return; }
    var go = function () {
      p.afkFinal2 = { result: 'lose', pending: true, at: Date.now() };
      FB.startMode('second', '<span class="font-bold" style="color:#f0abfc;">八顆不屈的命運在胸口發燙。死亡之海比上一次更冷——席琳記得你。</span><span class="text-amber-200">二轉決戰：席琳方所有傷害 +5%；區內無法傳送，20 分鐘內打倒她。</span>');
    };
    var rd = readiness(p);
    var msg = '⚠ 二轉決戰：死亡女神 席琳\n\n' + NEED + '\n' + rd.text + '\n\n每個角色只有一次——進場就算用掉，倒下、回村或中途重新整理都算失敗。席琳方所有傷害 +5%。\n打倒：光環「次元突破者」——得到 GM 道具、天堂XXX 的資格（建設中）；但不能當傭兵、也不能招募傭兵，要自己單人再打倒一次席琳才能再當別人的傭兵。\n失敗：光環「封印輪迴」——失去進入席琳夢域鏡的資格（仍可當傭兵）。\n兩種結果都會開放冥王域的第二次轉生。\n\n確定要進入嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '二轉決戰', message: msg, okText: '沉入死亡之海', cancelText: '再準備一下', danger: true, onOk: go });
    else if (confirm(msg)) go();
  };
  window.afkFinalSolo = function () {
    var p = P(); if (!p) return;
    if (!breaker(p)) { sys('<span class="text-slate-300">只有次元突破者需要這場試煉。</span>'); return; }
    if (soloDone(p)) { sys('<span class="text-slate-300">單人試煉只有一次，你已經面對過了。</span>'); return; }
    if (typeof state !== 'undefined' && (state.antharas || state.riftRun || state.prideClimb)) { sys('<span class="text-amber-300">你正身在其他副本之中。</span>'); return; }
    (p.allies || []).length && (p.allies = []);
    var go = function () {
    rec2(p).solo = { result: 'lose', pending: true, at: Date.now() };
    FB.startMode('solo', '<span class="font-bold" style="color:#a5f3fc;">你一個人沉入死亡之海。席琳看著你，沒有出手。</span><span class="afk-lore">「次元的彼端只有你自己。讓我看看，你一個人能走多遠。」</span><span class="text-amber-200">單人試煉：席琳方傷害 −100%、席琳的 AC／減傷／魔防／抗性 −50%；20 分鐘內打倒她（只有一次）。</span>');
    };
    var msg = '⚠ 單人試煉：死亡女神 席琳\n\n只有一次——進場就算用掉，回村或中途重新整理都算失敗。\n席琳打不痛你（傷害 −100%），她的 AC、減傷、魔防、四屬性抗性 −50%，HP 一樣 4.5 億、20 分鐘時限。\n打贏：可以再當別人的傭兵，也可以招募傭兵。\n打輸：永遠不能當傭兵，但可以開始招募別人（次元突破者以外的角色）。\n\n確定要進入嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '單人試煉', message: msg, okText: '一個人沉入死亡之海', cancelText: '再準備一下', danger: true, onOk: go });
    else if (confirm(msg)) go();
  };
  var finish = function (md, result, why) {
    var p = P(); if (!p) return;
    if (md === 'solo') {
      var r = rec2(p) || (p.afkFinal2 = { result: 'win' });
      r.solo = { result: result, pending: false, at: Date.now(), why: why || '' };
      if (result === 'win') sys('<span class="font-bold" style="color:#a5f3fc;">🏆 你一個人打倒了死亡女神。</span><span class="afk-lore">「……原來次元的彼端，也有人願意回頭伸出手。」</span><span class="text-amber-200">次元突破者：可以再當別人的傭兵，也可以招募傭兵了。</span>');
      else sys('<span class="text-slate-300">單人試煉失敗（' + (why || '挑戰失敗') + '）。</span><span class="afk-lore">「你選擇了一個人走。那就一直一個人走吧——但你可以帶著別人。」</span><span class="text-amber-200">你永遠不能當別人的傭兵了，但從現在起可以招募傭兵（次元突破者以外的角色）。</span>');
      return;
    }
    var r2 = p.afkFinal2 = p.afkFinal2 || {};
    r2.result = result; r2.pending = false; r2.at = Date.now(); r2.why = why || '';
    if (result === 'win') {
      var got = [];
      GM.forEach(function (id) { var hasIt = (p.inv || []).some(function (x) { return x && String(x.id) === id; }) || Object.keys(p.eq || {}).some(function (k) { return p.eq[k] && String(p.eq[k].id) === id; }); if (DB.items[id] && !hasIt) { p.inv.push({ id: id, uid: uid(), cnt: 1, en: 0 }); got.push(DB.items[id].n); } });
      (p.allies || []).length && (p.allies = []);
      sys('<span class="font-bold" style="color:#f0abfc;">🌌 席琳的身影碎成無數次元的裂縫。</span><span class="afk-lore">「你已經不屬於這個世界了。走吧——去另一個天堂。」</span>'
        + '<span class="text-fuchsia-200">得到光環「次元突破者」' + (got.length ? '與 GM 道具（' + got.join('、') + '）' : '') + '；天堂XXX 的資格（建設中）。從現在起不能當傭兵、也不能招募傭兵；自己單人再打倒一次席琳，才能再當別人的傭兵。冥王域的第二次轉生已開放。</span>');
    } else {
      p.sherineDream = false; try { applySherineTheme(); } catch (e) {}
      sys('<span class="font-bold text-slate-200">你再一次倒在沉沒神殿（' + (why || '挑戰失敗') + '）。</span><span class="afk-lore">「輪迴不是給你一次次重來的。這一次，我把門關上了。」</span>'
        + '<span class="text-fuchsia-200">得到光環「封印輪迴」：失去進入席琳夢域鏡的資格（仍然可以當傭兵）。冥王域的第二次轉生已開放。</span>');
    }
  };
  var card = function () {
    var p = P(); if (!p || !(p.rebirth >= 1)) return '';
    var r = rec2(p), f = fates(), dream = FB.dreamOn(), st, btn = '';
    if (r && !r.pending) st = r.result === 'win' ? '<span class="text-fuchsia-300">次元突破者' + (!soloDone(p) ? '（尚未單人試煉）' : r.solo.result === 'win' ? '（單人試煉通過）' : '（單人試煉失敗）') + '</span>' : '<span class="text-slate-300">封印輪迴</span>';
    else st = canSecond(p) ? '<span class="text-sky-300">可挑戰一次</span>' : '<span class="text-slate-400">不屈的命運 ' + f + '／8' + (firstDone(p) ? '' : '、需先完成第一次決戰') + '</span>';
    if (!r) { var ok = canSecond(p) && dream; btn = '<button type="button" class="btn py-3 text-base font-bold ' + (ok ? 'bg-fuchsia-950 hover:bg-fuchsia-900 border-fuchsia-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed') + '" ' + (ok ? '' : 'disabled') + ' onclick="afkFinalEnter2()">' + (ok ? '🌌 二轉決戰：沉入死亡之海' : (dream ? '條件未達成' : '需在席琳夢域鏡中')) + '</button>'; }
    else if (breaker(p) && !soloDone(p)) btn = '<button type="button" class="btn py-3 text-base font-bold bg-cyan-950 hover:bg-cyan-900 border-cyan-500" onclick="afkFinalSolo()">🗡️ 單人試煉：再次打倒席琳（只有一次；席琳方傷害 −100%）</button>';
    if (breaker(p)) btn += '<button type="button" class="btn py-2 font-bold bg-slate-800 border-slate-600 text-slate-300" onclick="afkLineageW()">🌐 前往天堂XXX（建設中）</button>';
    return '<div id="afk-final2-card" class="bg-slate-950/80 border border-fuchsia-800 rounded p-3 text-sm leading-relaxed">'
      + '<div class="font-bold mb-1 text-fuchsia-300">🌌 二轉決戰：死亡女神 席琳（' + st + '）</div>'
      + '<div class="afk-lore">「又是你。輪迴一次還不夠嗎？」</div>'
      + (!r ? '<div class="text-amber-300 text-xs font-bold">⚠ ' + NEED + '</div><div class="text-xs ' + (readiness(p).ok ? 'text-emerald-300' : 'text-red-300') + '">' + readiness(p).text + '</div>' : '')
      + '<div class="text-slate-200 text-xs">已轉生、第一次決戰已挑戰過、集齊八職業不屈的命運才能進入；席琳方所有傷害 +5%，每個角色一次。打倒＝「次元突破者」（GM 道具、天堂XXX 資格；不能當傭兵也不能招募，直到單人試煉：打贏＝恢復傭兵身分、打輸＝永遠不能當傭兵但可以招募）；失敗＝「封印輪迴」（失去席琳夢域鏡資格）。兩種結果都開放冥王域的第二次轉生。</div></div>' + btn;
  };
  window.afkLineageW = function () { sys('<span class="text-fuchsia-200">次元的裂縫另一頭隱約傳來別的世界的聲音……天堂XXX 還在建設中，敬請期待。</span>'); };

  // ── 冥王域：第二次轉生 ──
  var oHades = window.enterHades;
  window.enterHades = function () {
    var p = P(); if (!p || !(p.rebirth >= 1)) return oHades.apply(this, arguments);
    if (p.rebirth >= 2) { sys('<span class="text-slate-300">你已經走過兩次輪迴，冥王域不再為你開門。</span>'); return; }
    if (fates() < 8) return oHades.apply(this, arguments);
    var r = rec2(p);
    if (!r || r.pending) { sys('<span class="text-red-400">冥王域的門扉後傳來低語：「再來見我一次。」——先到席琳神殿（席琳夢域鏡）完成二轉決戰，才能第二次轉生。</span>'); return; }
    if ((p.lv || 1) < 150) { sys('<span class="text-red-400">第二次轉生需要 Lv150（滿等；你目前 Lv' + (p.lv || 1) + '）。</span>'); return; }
    if (typeof state !== 'undefined' && state.riftRun) { sys('<span class="text-amber-300">你仍身在時空裂痕之中，先離開才能走向冥王域。</span>'); return; }
    var go = function () { doRebirth2(); };
    var msg = '⚰️ 第二次轉生\n\n消耗八顆不屈的命運。等級回到 1、經驗歸零（保留目前的等級 HP／MP，屬性、技能、裝備、背包都保留），傳送回說話之島。\n獲得：面板能力再 +50、等級上限 200。\n確定要進入嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '⚰️ 第二次轉生', message: msg, okText: '進入冥王域', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
  };
  window.unlockHades = window.enterHades;
  var doRebirth2 = function () {
    var p = P(); if (!p || p.rebirth >= 2) return { ok: false };
    var ids = DS.FATE_IDS || [];
    if (!ids.every(function (id) { return p.inv.some(function (x) { return x && x.id === id && (x.cnt == null || x.cnt > 0); }); })) { sys('<span class="text-red-400">八職業的不屈的命運不齊。</span>'); return { ok: false }; }
    ids.forEach(function (id) { var it = p.inv.find(function (x) { return x && x.id === id && (x.cnt == null || x.cnt > 0); }); if (it) it.cnt = (it.cnt == null ? 1 : it.cnt) - 1; });
    p.inv = p.inv.filter(function (x) { return !(x && x.cnt != null && x.cnt <= 0); });
    var lvNow = p.lv || 1, hpA = 0, mpA = 0, hp1 = 0, mp1 = 0;
    try { calcStats(); hpA = p.mhp; mpA = p.mmp; p.lv = 1; calcStats(); hp1 = p.mhp; mp1 = p.mmp; } catch (e) {}
    p.rebirthHpKeep = (Number(p.rebirthHpKeep) || 0) + Math.max(0, Math.round(hpA - hp1));
    p.rebirthMpKeep = (Number(p.rebirthMpKeep) || 0) + Math.max(0, Math.round(mpA - mp1));
    p.rebirth = 2; p.lv = 1; p.exp = 0;
    try { calcStats(); } catch (e) {}
    p.hp = p.mhp; p.mp = p.mmp;
    sys('<span class="c-sherine font-bold">第二次輪迴已畢。</span><span class="text-fuchsia-200">八顆不屈的命運化成光，嵌進你的靈魂——回到 Lv1（保留 Lv' + lvNow + ' 的等級 HP／MP），面板能力再 +50、等級上限 200。</span>');
    try { setMapSelectors('town_talking'); changeMap(true); } catch (e) {}
    try { updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    return { ok: true };
  };
  // 時空裂痕入口的冥王域按鈕文字
  if (typeof window.renderRiftEntrance === 'function') {
    var oEnt = window.renderRiftEntrance;
    window.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try {
        var b = container && container.querySelector('#afk-hades-btn'), p = P();
        if (b && p && p.rebirth >= 1) {
          var r2 = rec2(p);
          b.textContent = p.rebirth >= 2 ? '⚰️ 時空裂痕-冥王域（已完成第二次轉生）'
            : '⚰️ 時空裂痕-冥王域・第二次轉生（不屈的命運 ' + fates() + '／8、二轉決戰' + (r2 && !r2.pending ? '已完成' : '未完成') + '、需 Lv150）';
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 二轉效果：面板再 +50、等級上限 200 ──
  var oRe = window.recomputeStats;
  window.recomputeStats = function () {
    var r = oRe.apply(this, arguments);
    try {
      var p = typeof player !== 'undefined' ? player : null;
      if (p && p.rebirth >= 2 && p.d) {
        var d = p.d;
        ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er'].forEach(function (k) { d[k] = (Number(d[k]) || 0) + 50; });
        d.ac = (Number(d.ac) || 0) - 50; d.itemSp = (Number(d.itemSp) || 0) + 50;
      }
    } catch (e) {}
    return r;
  };
  var oCap = window.__afkLvCap;
  window.__afkLvCap = function (p) { return (p && p.rebirth >= 2) ? 200 : (oCap ? oCap(p) : 100); };
  if (typeof window.getExpReq === 'function') {
    var oReq = window.getExpReq;
    window.getExpReq = function (lv) { if (lv >= 150 && lv < 200) { var b = oReq(99); return isFinite(b) ? Math.floor(b * (1 + 0.1 * (lv - 99))) : b; } return oReq.apply(this, arguments); };
  }
  if (typeof window.getExpGainMult === 'function') {
    var oGain = window.getExpGainMult;
    window.getExpGainMult = function (lv) { if (lv >= 150 && lv < 200) return 1; return oGain.apply(this, arguments); };
  }

  // ── 次元突破者：不能招募、也不能被招募（單人打倒席琳後可再當傭兵）──
  // 存檔原文沒變就沿用上次判定（回城刷新 7 名隊員時，每名都要整份 JSON.parse 一次）
  var lockCache = {};
  var slotLocked = function (slotN) {
    try {
      var raw = _saveUnwrap(_lzGet('lineage_idle_save_' + slotN)).payload; if (!raw) return false;
      var c = lockCache[slotN]; if (c && c.raw === raw) return c.v;
      var v = locked(JSON.parse(raw).p); lockCache[slotN] = { raw: raw, v: v }; return v;
    } catch (e) { return false; }
  };
  if (typeof window.toggleAlly === 'function') {
    var oToggle = window.toggleAlly;
    window.toggleAlly = function (slotN) {
      var p = P();
      var active = p && (p.allies || []).some(function (a) { return a && String(a._slot) === String(slotN); });
      if (p && !active) {
        if (noHire(p)) { sys('<span class="text-red-400">次元突破者只能靠自己——單人試煉之前不能招募傭兵。</span>'); return; }
        if (slotLocked(slotN)) { sys('<span class="text-red-400">存檔 ' + slotN + ' 的角色是次元突破者，不能當別人的傭兵（單人試煉打贏才行）。</span>'); return; }
      }
      return oToggle.apply(this, arguments);
    };
  }
  if (typeof window.buildAlly === 'function') {
    var oBuild = window.buildAlly;
    window.buildAlly = function (slotN) { var p = P(); if ((p && noHire(p)) || slotLocked(slotN)) return null; return oBuild.apply(this, arguments); };
  }
  if (typeof window.allyActiveCap === 'function') {
    var oAC = window.allyActiveCap;
    window.allyActiveCap = function () { var p = P(); return p && noHire(p) ? 0 : oAC.apply(this, arguments); };
  }
  // ── 封印輪迴：不能開啟席琳夢域鏡 ──
  if (typeof window.toggleSherineDream === 'function') {
    var oDream = window.toggleSherineDream;
    window.toggleSherineDream = function () {
      var p = P();
      if (p && sealedR(p) && !p.sherineDream) { sys('<span class="text-slate-300">封印輪迴的光環鎖住了夢的入口——你再也進不了席琳夢域鏡。</span>'); return; }
      return oDream.apply(this, arguments);
    };
  }
  setInterval(function () {
    try {
      var p = P(); if (!p) return;
      if (sealedR(p) && p.sherineDream) { p.sherineDream = false; try { applySherineTheme(); } catch (e) {} }
      if (noHire(p) && (p.allies || []).length) { p.allies = []; sys('<span class="text-fuchsia-200">次元突破者只能靠自己——傭兵已全部解散。</span>'); try { calcStats(); updateUI(); } catch (e) {} }
      var r2 = rec2(p); if (r2 && r2.solo && r2.solo.pending && !(typeof state !== 'undefined' && state._afkFinal)) finish('solo', 'lose', '中途離開');
    } catch (e) {}
  }, 1000);

  window.__afkRebirth2 = { soloDone: soloDone, noHire: noHire, finish: finish, card: card, rec2: rec2, breaker: breaker, locked: locked, sealed: sealedR, canSecond: canSecond, doRebirth2: doRebirth2 };
  console.log('[AFK-rebirth2] 已啟用：二轉決戰、次元突破者／封印輪迴、第二次轉生');
})();
