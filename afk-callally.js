/* ============================================================================
 * afk-callally.js — 王族「呼喚盟友」冷卻（玩家 2026-10-30 14:55；外掛開關 callallycd，預設開）
 *
 *   原因：呼喚盟友（所有上場傭兵立刻各多打一次一般攻擊）沒有冷卻，攻擊速度到上限、MP 回得比花得快時每秒放 10 次，
 *         傭兵每秒多打 10 下（實測 10-30 存檔：王族每秒「造成」約 36 萬，幾乎全是這招）。
 *   改法（兩道限制同時生效）：
 *     ‧施放者冷卻 3 秒（玩家王族、王族傭兵各自計算）；冷卻中的王族傭兵改成一般攻擊。
 *     ‧每名傭兵被呼喚最多一秒一次（被叫過 1 秒內，下一次呼喚不會讓他再多打一下）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'callallycd', name: '呼喚盟友冷卻', group: '遊戲玩法', desc: '王族「呼喚盟友」冷卻 3 秒，每名傭兵被呼喚最多一秒一次' });
  var on = function () { return !T || T.enabled('callallycd'); };
  var CD = 30, PER = 10;   // tick（0.1 秒）
  var tk = function () { try { return Number(state.ticks) || 0; } catch (e) { return 0; } };
  var isCall = function (id) { var sk = id && DB.skills && DB.skills[id]; return !!(sk && sk.callAllies); };
  var ready = function (ent) { return !((Number(ent && ent._afkCallCd) || 0) > tk()); };
  var inCall = 0, st = { casts: 0, blocked: 0, skippedAllies: 0 };
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (id) {
      if (!on() || !isCall(id)) return oCast.apply(this, arguments);
      if (!ready(player)) { st.blocked++; return false; }
      inCall++; var r;
      try { r = oCast.apply(this, arguments); } finally { inCall--; }
      if (r) { player._afkCallCd = tk() + CD; st.casts++; }
      return r;
    };
  }
  if (typeof W.allyRoyalAct === 'function') {
    var oAct = W.allyRoyalAct;
    W.allyRoyalAct = function (ally) {
      if (!on() || !ally || !isCall(ally._atkSkill)) return oAct.apply(this, arguments);
      if (!ready(ally)) {   // 冷卻中：照一般攻擊（同核心「沒有目標」那條路）
        st.blocked++;
        try { allyAttackOnce(ally); if (typeof allyRapidfire === 'function') allyRapidfire(ally); } catch (e) {}
        return false;
      }
      inCall++; var r;
      try { r = oAct.apply(this, arguments); } finally { inCall--; }
      if (r) { ally._afkCallCd = tk() + CD; st.casts++; }
      return r;
    };
  }
  if (typeof W.allyAttackOnce === 'function') {
    var oAtk = W.allyAttackOnce;
    W.allyAttackOnce = function (a) {
      if (inCall && on() && a) {
        var last = Number(a._afkCalledAt); if (Number.isFinite(last) && tk() - last < PER) { st.skippedAllies++; return; }
        a._afkCalledAt = tk();
      }
      return oAtk.apply(this, arguments);
    };
  }
  W.__afkCallAlly = { CD: CD, PER: PER, stats: function () { return Object.assign({}, st); } };
})();
