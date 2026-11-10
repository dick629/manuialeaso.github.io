/* ============================================================================
 * afk-timeroom.js — 時光屋（Ping 11-11 01:14／01:16）
 *
 *   席琳神殿地區的新地圖「時光屋」：
 *     ‧怪物＝日出之國東之地、西之地、北之地的一般怪（不出王）。
 *     ‧怪物經驗 ×1.5；能進次元裂縫的角色 ×2。
 *     ‧不掉任何東西（包含地區霸主、世界事件、離線結算），只給金幣。
 *     ‧地區霸主、世界事件出現率 ×2（冷卻照舊）。地區霸主從各地區霸主裡隨機挑一隻（日出之國所在的地區沒有霸主）。
 *   經典模式沒有（席琳神殿地區本來就不開放經典模式）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'timeroom', name: '時光屋', group: '遊戲內容', desc: '席琳神殿地區的練功地圖：日出之國的怪、經驗加成、不掉落只給金幣。' });
  if (T && !T.enabled('timeroom')) return;
  if (typeof DB === 'undefined' || !DB.maps || typeof MAP_CATEGORIES === 'undefined' || typeof MAP_REGIONS === 'undefined') return;
  var MAP = 'time_room', SRC = ['sunrise_east', 'sunrise_west', 'sunrise_north'];
  var ids = [];
  SRC.forEach(function (m) { (DB.maps[m] || []).forEach(function (id) { var d = DB.mobs[id]; if (d && !d.boss && ids.indexOf(id) < 0) ids.push(id); }); });
  if (!ids.length) { console.warn('[AFK-timeroom] 找不到日出之國的怪物，略過'); return; }
  DB.maps[MAP] = ids;
  (MAP_CATEGORIES.wild = MAP_CATEGORIES.wild || []).push({ v: MAP, t: '時光屋', c: '#fde68a', classicHide: true });
  var reg = MAP_REGIONS.filter(function (r) { return r.key === 'sherine'; })[0];
  if (reg) reg.maps.push({ v: MAP, t: '時光屋' });
  try { if (typeof SPECIAL_AREA_BG !== 'undefined') SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/日出之國西之地.jpg'; } catch (e) {}

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var here = function () { return typeof mapState !== 'undefined' && mapState && mapState.current === MAP; };
  var riftOK = function () { try { var p = P(), R = W.__afkDimRift; return !!(p && R && typeof R.canOpen === 'function' && !R.canOpen(p)); } catch (e) { return false; } };
  var mult = function () { return riftOK() ? 2 : 1.5; };

  // 經驗：生出來的怪直接乘（地區霸主、世界事件的怪不另外乘）
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = here() && mapState.mobs && mapState.mobs[idx];
        if (m && !m._afkTr && !m.boss && !m._afkRb && !m._afkWe) { m._afkTr = true; m.exp = Math.round((Number(m.exp) || 0) * mult()); }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }

  // 不掉落：擊殺結算（含地區霸主、世界事件）與離線結算時，道具與龍之鑽石都不給；金幣照給
  var killing = 0;
  var blocked = function () {
    if (!here()) return false;
    if (killing > 0) return true;
    try { return typeof W.__afkOfflineNow === 'function' && !!W.__afkOfflineNow(); } catch (e) { return false; }
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function () { killing++; try { return oKill.apply(this, arguments); } finally { killing--; } };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  if (typeof W.gainItem === 'function') {
    var oGain = W.gainItem;
    W.gainItem = function () { if (blocked()) return undefined; return oGain.apply(this, arguments); };
    try { (0, eval)('gainItem = window.gainItem'); } catch (e) {}
  }
  if (typeof W.pandoraAdjustSharedDiamonds === 'function') {
    var oDia = W.pandoraAdjustSharedDiamonds;
    W.pandoraAdjustSharedDiamonds = function (n) { if (Number(n) > 0 && blocked()) return 0; return oDia.apply(this, arguments); };
  }

  // 地區霸主、世界事件：出現率 ×2；地區霸主從各地區隨機挑
  W.__afkEventRateMult = function (mapId) { return mapId === MAP ? 2 : 1; };
  W.__afkRbRegionOf = function (mapId, keys) { return mapId === MAP && keys && keys.length ? keys[Math.floor(Math.random() * keys.length)] : null; };

  W.__afkTimeRoom = { MAP: MAP, mobs: ids, mult: mult, blocked: blocked };
})();
