/* ============================================================================
 * afk-craftlock.js — 暫停「用到次元裂縫材料」的製作（Ping 11-12 22:30）
 *
 *   次元裂縫的材料、次元裂縫副本掉落的材料、二轉後才打得到的材料：用到它們的製作、強化、合成、兌換先全部關閉，
 *   等之後重新決定材料比例再開。只關「製作」，副本入場（無盡的裂縫、時光副本、召喚阿納金）照常。
 *   外掛開關 craftlock（預設開＝暫停中）。11-18 起解除（on() 回 false）。各製作模組在動作開頭呼叫 __afkCraftLock.stop(用到的材料)。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  // 11-18 19:18 Ping：材料比例定案，解除暫停 → 開關拿掉，on() 一律回 false（各模組的 stop() 呼叫留著，之後要再暫停只要改這裡）
  var IDS = ['afk_rift_shard', 'afk_dim_crystal', 'afk_star_dust', 'afk_alien_dust', 'afk_split_dust', 'afk_star_core', 'afk_mio_dim', 'afk_anakin_horn', 'afk_rune_dim',
    'afk_rd_sand', 'afk_rd_water', 'afk_rd_scale', 'afk_rd_feather', 'afk_rd_echo', 'afk_rd_thread', 'afk_rd_remnant', 'afk_rd_pick', 'afk_rd_mirror',
    'afk_rd_ember', 'afk_rd_ink', 'afk_rd_neptune', 'afk_rd_eclipse', 'afk_rd_hmark', 'afk_rd_dfrag',
    'afk_dim_xcrystal', 'afk_merge_dust', 'afk_dimlib_stone', 'afk_time_mirror', 'afk_rune_dim2', 'afk_rune_dim3',
    // 守護者之戒自己的裂縫材料（afk-guardring）
    'afk_guard_dimcrystal', 'afk_guard_shard', 'afk_guard_oath_fire', 'afk_guard_oath_water', 'afk_guard_oath_wind', 'afk_guard_oath_earth',
    'afk_guard_rift_glim', 'afk_guard_rift_memory', 'afk_guard_rift_thread', 'afk_guard_rift_sand', 'afk_guard_rift_scale'];
  var SET = {}; IDS.forEach(function (id) { SET[id] = 1; });
  var MSG = '這項製作用到次元裂縫的材料，目前暫停中，等材料比例重新調整後再開放。';
  var on = function () { return false; };
  var hit = function (ids) { if (!ids) return true; return [].concat(ids).some(function (x) { var id = x && typeof x === 'object' ? x.id : x; return !!SET[id]; }); };
  // stop(用到的材料)：暫停中而且有用到 → 回 true 並在系統訊息說明（不給材料清單＝整個動作都算）
  var stop = function (ids) {
    if (!on() || !hit(ids)) return false;
    try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">' + MSG + '</span>'); } catch (e) {}
    return true;
  };
  W.__afkCraftLock = { on: on, stop: stop, hit: hit, IDS: IDS, MSG: MSG };
})();
