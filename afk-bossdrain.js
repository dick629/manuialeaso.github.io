/* ============================================================================
 * afk-bossdrain.js — 副本裡王倒下時吸走全隊 MP（玩家 2026-11-03；外掛開關 bossdrain，預設開；經典模式不套用）
 *                    ＋隱藏規則：不死系屍爆（開關 hiddenbonus；不寫進小百科、遊戲裡不出現說明）
 *
 * 一、王的殘響（玩家看得到，寫進小百科）
 *   副本與時空裂痕裡，王（頭目）倒下的瞬間，隊伍裡每個角色（你與傭兵，倒下的不算）：
 *     MP ≥ 最大 MP 10%：失去最大 MP 的 10%；
 *     MP ＜ 最大 MP 10%：改失去最大 HP 的 10%（不會因此倒下，最少留 1 HP）。
 *   副本＝時空裂痕（含暗夢星迴）、龍的巢穴／最終決戰（state.antharas、_afkFinal）、軍王之室與底比斯／提卡爾祭壇（KING_ROOMS）、
 *        純頭目房（PURE_BOSS_MAPS：龍的棲息地、受詛咒的聖地、崩壞的長老會議廳）、黑暗妖精聖地、
 *        外掛副本（afk_ 開頭的地圖：星途遠征、幽靈船、異界祭壇、哈汀的時空、謀叛者的低語、哈爾巴斯…；木人場 afk_dummy 除外）。
 *   時空裂痕裡每秒最多一次（同一秒好幾隻王倒下只算一次；2026-11-03 fixE，上一次的 tick 記在 window.__afkDrainAt，不存檔）。
 * 二、隱藏規則：怪物死亡時屍爆，隊伍裡每個角色受到最大 HP 3% 的真實傷害（只在夢域鏡；會倒下；吃符文「骸」的真實傷害減免）。
 *     11-20：改成 2 秒合併、分 5 秒扣完、每秒最多 3%（CB）。
 *     Ping 11-15：原本只有不死系、5%；改成全部怪物（建築與暗夢星迴自爆的那隻除外）、3%。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossdrain', name: '王的殘響（副本）', group: '遊戲玩法', seal: true,
    desc: '副本與時空裂痕裡王倒下時，全隊失去最大 MP 10%（MP 不到 10% 的人改失去最大 HP 10%）' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var drainOn = function () { var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('bossdrain'))); };
  var hiddenOn = function () { if (W.__afkTestNoCorpse) return false; var p = P(); return !!(p && !p.classicMode && (!T || T.enabled('hiddenbonus'))); };   // 測試瀏覽器預設關（只有 test-fixb 打開）
  var dreamOn = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) { return false; } };
  var CFG = { mp: 0.10, hp: 0.10, corpse: 0.03 };
  var SANCT = ['dark_elf_sanctuary', 'cursed_dark_elf_sanctuary', 'collapsed_elder_council_hall'];
  var instance = function () {
    try {
      var st = S(), c = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
      if (!c || c.indexOf('town_') === 0) return false;
      if (st.riftRun || st.dreamStar || st._afkFinal || st.antharas) return true;
      if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[c]) return true;
      if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(c) >= 0) return true;
      if (SANCT.indexOf(c) >= 0) return true;
      return /^afk_/.test(c) && c !== 'afk_dummy';
    } catch (e) { return false; }
  };
  var members = function () {
    var p = P(), out = []; if (!p) return out;
    if (!p.dead && p.hp > 0) out.push(p);
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); });
    return out;
  };
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };

  var drain = function () {
    var p = P(), n = 0;
    members().forEach(function (t) {
      var self = t === p, mmp = Math.max(0, Number(t.mmp) || 0), mp = Math.max(0, Number(t.mp) || 0);
      if (mmp > 0 && mp >= mmp * CFG.mp) { t.mp = Math.max(0, mp - Math.floor(mmp * CFG.mp)); n++; return; }
      var mhp = Math.max(1, Number(t.mhp) || 1), cut = Math.floor(mhp * CFG.hp);
      if (self) p.hp = Math.max(1, (Number(p.hp) || 1) - cut); else t.curHp = Math.max(1, (Number(t.curHp) || 1) - cut);
      n++;
    });
    if (n) clog('<span class="font-bold" style="color:#a78bfa">【王的殘響】</span>王倒下的餘波掃過全隊：失去最大 MP 的 ' + Math.round(CFG.mp * 100) + '%（MP 不夠的人改失去最大 HP 的 ' + Math.round(CFG.hp * 100) + '%）。');
  };
  var corpse = function (pct) {
    var p = P(), dead = false; pct = pct || CFG.corpse;
    members().forEach(function (t) {
      if (dead) return;
      var dmg = Math.max(1, Math.floor((Number(t.mhp) || 1) * pct));
      if (typeof W.__afkTrueCut === 'function') { try { dmg = W.__afkTrueCut(t, dmg); } catch (e) {} }
      if (typeof W.__afkShieldEat === 'function') dmg = W.__afkShieldEat(t, dmg);   // 11-18 Ping：一般怪的爆炸先扣護盾
      if (!(dmg > 0)) return;
      if (t === p) { p.hp -= dmg; if (p.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); dead = true; } }
      else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
    });
  };

  // 11-20（Ping 13:50）：屍爆改成「2 秒內倒下的合成一次、分 5 秒扣完、每秒最多 3%」——打得快不會被一下炸光
  //   一次的量：第一隻 3%，每多一隻 +0.5%，最多 6%；照樣會倒下、照樣先扣護盾、吃符文「骸」。回村或離開夢域鏡就清掉。
  var CB = { win: 20, dur: 50, first: 0.03, inc: 0.005, cap: 0.06, dps: 0.03, n: 0, until: 0, cur: [] };
  var cbTick = function () {
    var t = Number(S().ticks) || 0;
    if (!hiddenOn() || !dreamOn() || (typeof mapState !== 'undefined' && /^town_/.test(String(mapState.current || '')))) { CB.n = 0; CB.cur.length = 0; return; }
    if (CB.n && t >= CB.until) { var tot = Math.min(CB.cap, CB.first + CB.inc * (CB.n - 1)); CB.cur.push({ ps: tot * 10 / CB.dur, until: t + CB.dur }); CB.n = 0; }
    if (!CB.cur.length || t % 10) return;
    var sum = 0; CB.cur = CB.cur.filter(function (e) { if (e.until > t) { sum += e.ps; return true; } return false; });
    var d = Math.min(CB.dps, sum); if (d > 0 && P() && !P().dead) { corpse(d); CB.pct = (CB.pct || 0) + d; }
  };
  var bindCb = function () { var X = W.__afkProc; if (X && X.on && !bindCb.done) { X.on('tick', cbTick); bindCb.done = true; } };
  bindCb(); W.addEventListener('load', function () { setTimeout(bindCb, 200); });

  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, was = !!(m && m._dead);
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && !was && !m._afkBd && P()) {
          m._afkBd = true;
          if (m.boss && drainOn() && instance()) {
            // 時空裂痕（玩家 2026-11-03 核准）：同一秒有好幾隻王倒下只算一次殘響（20 分鐘後頭目大量、每秒死 1～2 隻會把全隊一直壓在 1 HP）
            var tk0 = Number(S().ticks) || 0, inRift = !!(S().riftRun && mapState.current === 'rift_battle');
            if (!inRift || !(W.__afkDrainAt != null && tk0 - W.__afkDrainAt < 10 && tk0 >= W.__afkDrainAt)) { if (inRift) W.__afkDrainAt = tk0; drain(); }
          }
          if (m.race !== '建築' && !m._dsBlast && hiddenOn() && dreamOn() && !P().dead) { if (!CB.n) CB.until = (Number(S().ticks) || 0) + CB.win; CB.n++; }   // 11-20：改成 2 秒合併（見 CB）
        }
      } catch (e) { console.warn('[AFK-bossdrain]', e); }
      return r;
    };
  }
  W.__afkBossDrain = { CFG: CFG, CB: CB, instance: instance, drain: drain, corpse: corpse };
})();
