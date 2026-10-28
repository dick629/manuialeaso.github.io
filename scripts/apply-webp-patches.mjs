/** apply-webp-patches.mjs — 介面大圖改用 WebP（玩家 2026-10-27：參考舒適版，首頁＋進遊戲下載量從約 14MB 降到約 3MB）
 *  圖檔：public/assets/login/*.png（含 EQ UI）、assets/background/background.png、assets/character/*.png、assets/logo/*.png
 *  → 同名 .webp（scripts/build-webp.py 產生；原 .png 保留，上游同步不受影響）。
 *  這裡只把核心檔案裡的引用路徑從 .png 換成 .webp；冪等、錨點找不到就失敗。 */
import { readFileSync, writeFileSync } from 'node:fs';

const EDITS = {
  'index.html': [
    ['public/assets/login/310.png', 'public/assets/login/310.webp', 1],
    ['public/assets/login/273.png', 'public/assets/login/273.webp', 1],
    ["p.src=base+n+'.png';", "p.src=base+n+'.webp';", 1],
    ["img.src=base+frame+'.png';", "img.src=base+frame+'.webp';", 1],
    ['public/assets/login/load.png', 'public/assets/login/load.webp', 1],
    ['public/assets/login/load1.png', 'public/assets/login/load1.webp', 1],
    ['public/assets/login/824.png', 'public/assets/login/824.webp', 1],
    [/(assets\/logo\/[^"'<>]+?logo)\.png/g, '$1.webp', 8]
  ],
  'css/style.css': [
    ["url('../assets/background/background.png')", "url('../assets/background/background.webp')", 4],
    ["url('../assets/character/血條底圖.png')", "url('../assets/character/血條底圖.webp')", 1]
  ],
  'js/08-items-equip.js': [["url('assets/character/${bgImageName}.png')", "url('assets/character/${bgImageName}.webp')", 1]],
  'js/10-ui-tabs.js': [['<img src="assets/logo/${nm}icon.png"', '<img src="assets/logo/${nm}icon.webp"', 1]],
  'js/19-equipment-window.js': [
    ["encodeURIComponent('原圖.png')", "encodeURIComponent('原圖.webp')", 2],
    ["cls + '.png')", "cls + '.webp')", 1]
  ],
  'js/01-drops-config.js': [[/(logo: 'assets\/logo\/[^']+?logo)\.png'/g, "$1.webp'", 8]]
};

export function applyWebpPatches(check = false) {
  let changed = 0, already = 0;
  for (const [file, edits] of Object.entries(EDITS)) {
    let s = readFileSync(file, 'utf8'), dirty = false;
    for (const [from, to, n] of edits) {
      const re = typeof from === 'string' ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : from;
      const hits = (s.match(re) || []).length;
      const doneRe = typeof from === 'string' ? to : null;
      if (hits === 0) {
        const done = doneRe ? s.split(doneRe).length - 1 : (s.match(new RegExp(re.source.replace('\\.png', '\\.webp').replace(')\\.png', ').webp'), 'g')) || []).length;
        if (doneRe ? done >= n : true) { already++; continue; }
        throw new Error(`[${file}] WebP 錨點找不到：${from}`);
      }
      if (hits !== n) throw new Error(`[${file}] WebP 錨點應出現 ${n} 次，實際 ${hits}：${from}`);
      s = s.replace(re, typeof from === 'string' ? () => to : to); dirty = true; changed++;
    }
    if (dirty && !check) writeFileSync(file, s);
  }
  if (changed) console.log(`[webp-patch] ${check ? '待套用' : '已改'} ${changed} 處`);
  return { changed, already };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = applyWebpPatches(process.argv.includes('--check'));
  if (process.argv.includes('--check') && r.changed) { console.error('❌ WebP 引用尚未套用'); process.exit(1); }
}
