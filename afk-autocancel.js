/* ============================================================================
 * afk-autocancel.js — 相消術卷軸自動解控（Ping 11-12 15:05）
 *
 *   被暈眩、冰凍、石化、麻痺、沉睡其中一種控住時，身上有相消術卷軸就自動用 1 張：
 *   清除自己身上所有負面狀態，之後 3 秒免疫負面狀態。30 秒一次（遊戲時間）。只解自己，不解傭兵。
 *   外掛面板「玩法選項」可以關（想把卷軸留著打暗夢星迴的聖結界時）。
 *   卷軸原本的用途（暗夢星迴的聖結界、次元裂縫的光蝕、裂縫副本）不受影響。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'autocancel', name: '相消術卷軸自動解控', group: '玩法選項',
    desc: '被暈眩、冰凍、石化、麻痺、沉睡控住時，自動用 1 張相消術卷軸：清除自己的負面狀態、3 秒內免疫（30 秒一次）' });
  if (typeof DB === 'undefined' || !DB.items) return;
  var ID = 'afk_cancel_scroll', CD = 300, IMM = 30;   // tick（0.1 秒）
  var HARD = ['stun', 'freeze', 'stone', 'paralyze', 'sleep'];
  var DEBUFF = ['stun', 'freeze', 'stone', 'paralyze', 'sleep', 'silence', 'magicseal', 'poison', 'venom', 'deadlyPoison', 'poisonDmg', 'poisonTick', 'poisonStacks',
    'burn', 'burnDmg', 'burnTick', 'burnStacks', 'scald', 'scaldDmg', 'scaldTick', 'evilAura', 'weaken', 'disease', 'blind', 'potionFrost', 'foulWater', 'slow', 'slowAtk',
    'bind', 'bleed', 'bleedDmg', 'bleedTick', 'bleedStacks', 'curse', 'fear', 'confuse', 'mrDown', 'acDown'];
  var on = function () { return !T || T.enabled('autocancel'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
  var have = function () { try { return typeof questCountId === 'function' ? questCountId(ID) : 0; } catch (e) { return 0; } };
  var immune = function (p) { return !!(p && (p._afkCxImm || 0) > tk()); };
  var cleanse = function (p) {
    var st = p.statuses || {};
    DEBUFF.forEach(function (k) { if (st[k] > 0) st[k] = 0; });
    try { if (typeof PLAYER_DEBUFF_NAME !== 'undefined' && PLAYER_DEBUFF_NAME) Object.keys(PLAYER_DEBUFF_NAME).forEach(function (k) { if (st[k] > 0) st[k] = 0; }); } catch (e) {}
  };
  var check = function () {
    var p = P(); if (!p || p.dead || !on()) return;
    var st = p.statuses || {};
    if (!HARD.some(function (k) { return st[k] > 0; })) return;
    var t = tk(), cd = Number(p._afkCxCd) || 0;
    if (cd > t + CD) cd = 0;   // 讀檔後 tick 歸零：舊的冷卻作廢
    if (cd > t || have() < 1) return;
    try { questConsumeId(ID, 1); } catch (e) { return; }
    cleanse(p); p._afkCxImm = t + IMM; p._afkCxCd = t + CD;
    try { if (typeof logSys === 'function' && !(state && state.ff)) logSys('<span style="color:#86efac">你撕開一張相消術卷軸，身上的負面狀態全部消散了（3 秒內免疫；剩 ' + have() + ' 張）。</span>'); } catch (e) {}
    try { if (typeof updateUI === 'function' && !(state && state.ff)) updateUI(); } catch (e) {}
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { check(); if (immune(P())) cleanse(P()); } catch (e) { console.warn('[AFK-autocancel]', e); } return r; };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }
  if (typeof W.playerStatusResisted === 'function') {
    var oRes = W.playerStatusResisted;
    W.playerStatusResisted = function () { if (immune(P())) return true; return oRes.apply(this, arguments); };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }
  // 說明文字：物品視窗、哈瑪大師的清單讀 DB.items 的 d
  var d = DB.items[ID];
  if (d && !/控住時/.test(d.d || '')) d.d = (d.d || '') + '另外，被暈眩、冰凍、石化、麻痺、沉睡控住時也會自動用 1 張：清除自己身上所有負面狀態，3 秒內免疫（30 秒一次；外掛面板「玩法選項」可以關）。';
  W.__afkAutoCancel = { check: check, CD: CD, IMM: IMM, HARD: HARD };
})();
