/* ============================================================================
 * gen-icon-fix.mjs — 依天堂透視鏡圖示比對結果產生 afk-icon-fix.js（玩家 2026-10-26：道具圖案要跟透視鏡一致）
 *
 * 讀 data/ttmi-icon-check.json（比對結果：ok／fix／need／na），把 status=fix 的道具
 * 改用「跟透視鏡圖案一致的現有圖示」（to）。自創道具（afk_ 開頭、透視鏡沒有的）不在名單內。
 * 另外：data/ttmi-icon-local.json 若存在（{sourceId: 'assets/icons/ttmi/<檔名>.png'}），
 * status=need 的道具改用透視鏡原圖（需要玩家同意下載後才會有這份）。
 * 執行：node scripts/gen-icon-fix.mjs
 * ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const check = JSON.parse(readFileSync(ROOT + 'data/ttmi-icon-check.json', 'utf8'));
const localPath = ROOT + 'data/ttmi-icon-local.json';
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
const map = {};
let fix = 0, orig = 0;
for (const r of check.items) {
  if (r.status === 'fix' && r.to) { map[r.id] = r.to; fix++; }
  else if (r.status === 'need' && local[r.sourceId] && existsSync(ROOT + local[r.sourceId])) { map[r.id] = local[r.sourceId]; orig++; }
}
const js = `/* Generated: node scripts/gen-icon-fix.mjs — 道具圖示對齊天堂透視鏡（比對結果見 data/ttmi-icon-check.json） */
(function () {
  'use strict';
  var MAP = ${JSON.stringify(map)};
  var W = window;
  function apply() {
    if (typeof DB === 'undefined' || !DB.items) return 0;
    var n = 0, ids = Object.keys(DB.items);
    for (var i = 0; i < ids.length; i++) {
      var k = ids[i], base = k.indexOf('~') > 0 ? k.slice(0, k.indexOf('~')) : k, p = MAP[base];
      if (p && DB.items[k] && DB.items[k].img !== p) { DB.items[k].img = p; n++; }
    }
    return n;
  }
  var n = apply();
  W.__afkIconFix = { map: MAP, apply: apply };
  console.log('[AFK-icon-fix] 已對齊透視鏡圖示 ' + n + ' 件');
})();
`;
writeFileSync(ROOT + 'afk-icon-fix.js', js);
console.log('[gen-icon-fix] 改用現有圖 ' + fix + '、透視鏡原圖 ' + orig);
