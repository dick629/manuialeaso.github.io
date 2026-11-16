/* ============================================================================
 * afk-diagreport.js — 回報角色狀態給管理員（Ping 11-17）
 *
 *   旅人頻道視窗下方多一顆「📮 回報狀態」：玩家按下、確認後才送。
 *   送出內容（不送整份存檔）：角色名、職業、等級、轉生、模式（席琳／瘋狂／夢域鏡／次元裂縫／經典）、所在地圖、
 *     面板數值、身上裝備（名稱＋強化）、傭兵人數、版本、最近打怪的統計（打中次數、平均與最高傷害）、戰鬥訊息最後 20 行。
 *   伺服器：POST /diag（要旅人身分；每人每小時 6 次；保留 7 天）；管理頁「狀態回報」分頁看。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { var n = Number(x); return isFinite(n) ? n : 0; };
  // 最近 200 下打到怪的傷害（只記玩家自己）
  var hits = [];
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkDiag) return;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try { if (actor && actor === P() && v >= 0) { hits.push([Math.floor(N(v)), (opt && opt.kind) || '', target && target.n || '']); if (hits.length > 200) hits.shift(); } } catch (e) {}
      return v;
    };
    f.__afkDiag = true; C.damage = f;
  };
  hook(); W.addEventListener('load', function () { hook(); setTimeout(hook, 4000); });
  var nm = function (it) { if (!it || typeof it !== 'object') return ''; var d = (typeof DB !== 'undefined' && DB.items[it.id]) || {}; return ((it.en ? '+' + it.en + ' ' : '') + (d.n || it.id)).slice(0, 30); };
  function collect() {
    var p = P(); if (!p) throw new Error('請先進入遊戲（選好角色）。');
    var d = p.d || {}, eq = {};
    Object.keys(p.eq || {}).forEach(function (k) { var s = nm(p.eq[k]); if (s) eq[k] = s; });
    var pick = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'ac', 'mr', 'dr', 'er', 'meleeCrit', 'rangedCrit', 'magicCrit', 'resFire', 'resWater', 'resWind', 'resEarth', 'weightPct', 'atkSpeed'];
    var panel = {}; pick.forEach(function (k) { if (d[k] != null) panel[k] = Math.round(N(d[k]) * 100) / 100; });
    panel.mhp = N(p.mhp); panel.mmp = N(p.mmp); panel.hp = N(p.hp);
    var sum = 0, mx = 0; hits.forEach(function (h) { sum += h[0]; if (h[0] > mx) mx = h[0]; });
    var tail = [];
    try { var L = document.querySelectorAll('#combat-log > *, #log-combat > *'); for (var i = Math.max(0, L.length - 20); i < L.length; i++) tail.push(String(L[i].textContent || '').slice(0, 90)); } catch (e) {}
    var misses = tail.filter(function (s) { return /未命中|迴避/.test(s); }).length;
    var ver = ''; try { ver = String((document.querySelector('meta[name="afk-version"]') || {}).content || W.__AFK_VERSION || ''); } catch (e) {}
    return {
      v: 1, at: Date.now(), ver: ver, ua: String(navigator.userAgent || '').slice(0, 120),
      ch: { name: String(p.name || '').slice(0, 12), cls: p.cls, awk: p.awkFrom ? p.cls : '', lv: N(p.lv), rebirth: N(p.rebirth), art: p.rebirthArt || '' },
      mode: { sherine: !!p.sherineWorld, mad: !!p.sherineMad, dream: !!(W.__afkDreamHell && W.__afkDreamHell.on && W.__afkDreamHell.on()), rift: !!(W.__afkDimRiftOn && W.__afkDimRiftOn()), classic: !!p.classicMode, map: (typeof mapState !== 'undefined' && mapState.current) || '' },
      panel: panel, eq: eq, allies: (p.allies || []).length,
      recent: { hits: hits.length, avg: hits.length ? Math.round(sum / hits.length) : 0, max: mx, ones: hits.filter(function (h) { return h[0] <= 1; }).length, missLines: misses, last: hits.slice(-10) },
      log: tail
    };
  }
  W.__afkDiagReport = function (note) {
    var H = W.AFK_HEARTBEAT; if (!H || !H.api || !H.api()) return Promise.reject(new Error('旅人伺服器還沒開通。'));
    var data; try { data = collect(); } catch (e) { return Promise.reject(e); }
    return H.ensureId().then(function (id) {
      return fetch(H.api() + '/diag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: id.uid, token: id.token, name: data.ch.name, note: String(note || '').slice(0, 200), data: data }) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 404) throw new Error('伺服器還沒更新到有這個功能，請告訴管理員。');
        if (!r.ok) throw new Error(d.error || ('送出失敗（' + r.status + '）'));
        return '已送給管理員，謝謝！（回報編號 #' + (d.id || '?') + '）';
      });
    });
  };
  W.__afkDiagCollect = collect;
})();
