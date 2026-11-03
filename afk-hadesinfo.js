/* ============================================================================
 * afk-hadesinfo.js — 冥王域說明（玩家 2026-11-03；跟著冥王域開關 hades；經典模式沒有冥王域）
 *
 *   時空裂痕入口的冥王域按鈕下面列出轉生要的東西：
 *     ‧還沒轉生：「收集滿材料（共 6 種）就可轉生」＋六種時空材料各自有沒有、Lv100、要先挑戰過死亡女神。
 *     ‧轉生一次：第二次轉生要的八職業不屈的命運（各有沒有）、二轉決戰、Lv150。
 *   第一次跟死亡女神打完（贏或輸、中途離開都算）：提醒去時空裂痕入口的冥王域轉生，順便寫出還缺哪幾種材料（每個角色提醒一次）。
 *   按冥王域時：缺的材料倉庫裡有就先拿進背包（倉庫補足開關 matwh）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var on = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('hades'))); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var DS = W.__afkDreamStarCfg || {};
  var TS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var FATE = [['royal', '王族'], ['knight', '騎士'], ['elf', '妖精'], ['mage', '法師'], ['dark', '黑暗妖精'], ['dragon', '龍騎士'], ['illusion', '幻術師'], ['warrior', '戰士']];
  var inBag = function (id) { var p = P(); return !!(p && (p.inv || []).some(function (x) { return x && x.id === id && (x.cnt == null || x.cnt > 0); })); };
  var MW = function () { var m = W.__afkMatWh; return m && m.on() ? m : null; };
  var has = function (id) { var m = MW(); return inBag(id) || !!(m && m.wh(id) > 0); };   // 倉庫裡的也算（按冥王域時先拿進背包）
  var nm = function (id) { return (DB.items[id] && DB.items[id].n) || id; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var mark = function (ok) { return ok ? '<span class="text-emerald-300">✓</span>' : '<span class="text-red-400">✗</span>'; };
  var firstDone = function (p) { var r = p && p.afkFinal; return !!(r && !r.pending); };
  var R2 = function () { return W.__afkRebirth2 || null; };

  var info = function () {
    var p = P(); if (!p || !on()) return '';
    if (!(p.rebirth > 0)) {
      var got = TS.filter(has).length;
      return '<div id="afk-hades-info" class="text-xs leading-relaxed bg-slate-950/70 border border-rose-900 rounded p-2 text-slate-200">'
        + '<div class="font-bold text-rose-200">收集滿材料（共 ' + TS.length + ' 種）就可轉生（目前 ' + got + '／' + TS.length + '）</div>'
        + TS.map(function (id) { return mark(has(id)) + ' ' + esc(nm(id)); }).join('、')
        + '<div>另外要 ' + mark((p.lv || 1) >= 100) + ' Lv100、' + mark(firstDone(p)) + ' 先挑戰過死亡女神 席琳（席琳神殿，席琳夢域鏡的世界）。' + (MW() ? '' : '材料要放在背包裡。') + '</div></div>';
    }
    if (p.rebirth === 1) {
      var r = R2(), rec = r && r.rec2 ? r.rec2(p) : null, got2 = FATE.filter(function (f) { return has('afk_fate_' + f[0]); }).length;
      return '<div id="afk-hades-info" class="text-xs leading-relaxed bg-slate-950/70 border border-rose-900 rounded p-2 text-slate-200">'
        + '<div class="font-bold text-rose-200">第二次轉生要：八職業的不屈的命運（目前 ' + got2 + '／8）</div>'
        + FATE.map(function (f) { return mark(has('afk_fate_' + f[0])) + ' ' + f[1]; }).join('、')
        + '<div>另外要 ' + mark(!!(rec && !rec.pending)) + ' 挑戰過二轉決戰（席琳神殿，席琳夢域鏡的世界）、' + mark((p.lv || 1) >= 150) + ' Lv150。不屈的命運在暗夢星迴打頭目取得。</div></div>';
    }
    return '';
  };
  if (typeof W.renderRiftEntrance === 'function') {
    var oEnt = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try { var b = container && container.querySelector('#afk-hades-btn'); if (b && !container.querySelector('#afk-hades-info')) { var h = info(); if (h) b.insertAdjacentHTML('afterend', h); } } catch (e) { console.warn('[AFK-hadesinfo]', e); }
      return r;
    };
  }
  // 按冥王域：缺的材料先從倉庫拿
  var wrapHades = function () {
    if (typeof W.enterHades !== 'function' || W.enterHades.__afkHi) return;
    var o = W.enterHades;
    W.enterHades = function () {
      try {
        var p = P(), MW = W.__afkMatWh;
        if (p && on() && MW && MW.on() && !(typeof state !== 'undefined' && state && state.riftRun)) {
          var ids = !(p.rebirth > 0) ? TS : p.rebirth === 1 ? FATE.map(function (f) { return 'afk_fate_' + f[0]; }) : [];
          ids.forEach(function (id) { if (!inBag(id) && MW.wh(id) > 0) MW.pull(id, 1); });
        }
      } catch (e) {}
      return o.apply(this, arguments);
    };
    W.enterHades.__afkHi = true;
    W.unlockHades = W.enterHades;
  };
  wrapHades(); W.addEventListener('load', wrapHades);

  // 第一次跟死亡女神打完：提醒去冥王域
  var hint = function () {
    var p = P(); if (!p || !on() || p.rebirth > 0) return;
    var r = p.afkFinal; if (!r || r.pending || r.hadesHint) return;
    r.hadesHint = true;
    var miss = TS.filter(function (id) { return !has(id); }).map(nm);
    try {
      logSys('<span class="font-bold" style="color:#fda4af;">⚰️ 不論輸贏，輪迴的門已經為你打開——到「時空裂痕入口」按「冥王域」轉生。</span>'
        + '<span class="text-amber-200">要收集滿 ' + TS.length + ' 種時空材料' + (miss.length ? '（還缺：' + esc(miss.join('、')) + '）' : '（已經集齊）') + '，並到 Lv100。</span>');
    } catch (e) {}
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick, n = 0;
    W.tick = function () {
      var res = oTick.apply(this, arguments);
      if (++n % 10 === 0) { try { hint(); } catch (e) {} }
      return res;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  W.__afkHadesInfo = { info: info, hint: hint, TS: TS };
})();
