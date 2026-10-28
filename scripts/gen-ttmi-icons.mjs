/* ============================================================================
 * gen-ttmi-icons.mjs — 天堂透視鏡匯入道具的圖示對照（玩家 2026-10-26：圖片搞錯）
 *
 * 匯入的 2465 件道具大多沒有自己的圖，舊作法是「同類型第一張圖」（變形魔杖顯示成變形卷軸…）。
 * 這裡依名稱找最像的現有圖示：
 *   1. 同名圖；2. 去掉 受祝福的／被詛咒的／古代／(...)／等級前綴 後同名；
 *   3. 名稱結尾相同（魔杖、戒指、斗篷、項鍊…，越長越優先），同資料夾優先；
 *   4. 名稱中出現的最長相同片段（至少 2 字）。
 * 0. （2026-10-27 起）透視鏡原圖優先：data/ttmi-icon-map.json（sourceId → assets/icons/ttmi/檔名），玩家同意後下載。
 * 都找不到就維持舊作法。輸出 afk-ttmi-icons-data.js（window.__AFK_TTMI_ICONS = {名稱: 路徑}）。
 * 執行：node scripts/gen-ttmi-icons.mjs
 * ========================================================================== */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const src = readFileSync(ROOT + 'afk-ttmi-items-data.js', 'utf8');
const data = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
const FOLDERS = ['items', 'weapons', 'armors', 'accessories'];
const pool = [];
for (const f of FOLDERS) for (const x of readdirSync(ROOT + 'assets/icons/' + f)) if (x.endsWith('.png')) pool.push({ n: x.slice(0, -4), f });
const byName = new Map(pool.map(p => [p.n, p]));
const pref = t => t === 'wpn' ? 'weapons' : t === 'arm' ? 'armors' : t === 'acc' ? 'accessories' : 'items';
const clean = n => n.replace(/[（(][^）)]*[）)]/g, '').replace(/^(受祝福的|被詛咒的|祝福的|詛咒的|古代的?|封印的|強化|高級|初級|中級|上級|特製|改良的?|閃耀的|神聖的|\+\d+|Lv\.?\d+)/g, '').replace(/\s+/g, '').trim();
const STOP = new Set(['卷軸', '之書', '寶箱', '箱子', '袋子', '藥水', '碎片', '證明', '鑰匙', '材料']);

const SLOT_KW = { tshirt: ['T恤'], helm: ['頭盔', '帽', '頭巾', '髮帶', '王冠', '面具', '頭飾'], cloak: ['斗篷', '披風'], boots: ['靴', '鞋'], gloves: ['手套'],
  shield: ['盾', '臂甲'], armor: ['盔甲', '鎧甲', '長袍', '皮衣', '板甲', '鏈甲', '外套', '袍', '甲'], ring: ['戒指'], amulet: ['項鍊', '項鏈', '護身符', '鍊', '鏈'],
  ear: ['耳環'], belt: ['腰帶'], shin: ['脛甲'], doll: ['魔法娃娃'] };
// 關鍵字優先（名稱含這些字直接用指定圖）
const KW = [[/魔杖/, 'items/神秘魔杖'], [/變身|變形/, 'items/變形卷軸'], [/^魔法卷軸/, 'items/魔法卷軸(魔法屏障)'], [/瞬間移動|傳送/, 'items/瞬間移動卷軸'], [/武器.*(強化|施法)卷軸/, 'items/對武器施法的卷軸'],
  [/(盔甲|防具).*(強化|施法)卷軸/, 'items/對盔甲施法的卷軸'], [/飾品.*(強化|施法)卷軸/, 'items/對飾品施法的卷軸'], [/解除封印/, 'items/解除封印卷軸'], [/復活/, 'items/復活卷軸'], [/卷軸$/, 'items/古代的卷軸']];
function pick(n, type, slot) {
  if (byName.has(n)) return byName.get(n);
  if (type !== 'wpn' && type !== 'arm' && type !== 'acc') for (const [re, path] of KW) if (re.test(n)) { const [f, nm] = path.split('/'); return { f, n: nm }; }
  const kw = SLOT_KW[slot];
  if (kw) { const all = pool; const sub = all.filter(p => kw.some(k => p.n.includes(k))); if (sub.length) { const r = pickIn(n, type, sub); if (r) return r; } }
  return pickIn(n, type, pool);
}
function pickIn(n, type, pool) {
  if (byName.has(n)) return byName.get(n);
  const c = clean(n);
  if (c && byName.has(c)) return byName.get(c);
  const want = pref(type);
  // 結尾相同
  for (let k = Math.min(c.length, 6); k >= 2; k--) {
    const suf = c.slice(-k);
    let cand = pool.filter(p => p.n.endsWith(suf));
    if (!cand.length) continue;
    const same = cand.filter(p => p.f === want);
    if (type !== 'misc' && type !== 'etc' && type !== 'pot' && type !== 'scroll' && !same.length && k <= 2) continue;
    cand = same.length ? same : cand;
    cand.sort((a, b) => a.n.length - b.n.length || (a.n < b.n ? -1 : 1));
    return cand[0];
  }
  // 最長相同片段
  let best = null, bl = 1;
  for (let i = 0; i < c.length; i++) for (let j = i + bl + 1; j <= c.length; j++) {
    const s = c.slice(i, j); if (STOP.has(s)) continue;
    const cand = pool.filter(p => p.n.includes(s));
    if (!cand.length) break;
    const same = cand.filter(p => p.f === want);
    best = (same.length ? same : cand).sort((a, b) => a.n.length - b.n.length)[0]; bl = s.length;
  }
  if (best && (best.f === want || want === 'items')) return best;
  return null;
}

const out = {};
const ORIG = existsSync(ROOT + 'data/ttmi-icon-map.json') ? JSON.parse(readFileSync(ROOT + 'data/ttmi-icon-map.json', 'utf8')).map : {};
let exact = 0, guess = 0, none = 0, orig = 0;
const FB = {};   // 原圖載不到（部署中、網路斷）時的近似圖：檔名 → 本地現有圖
for (const r of data.items) {
  const d = r.def, o = ORIG[r.sourceId];
  const p = pick(d.n, d.type, d.slot);
  if (o && existsSync(ROOT + 'assets/icons/ttmi/' + o)) { out[d.n] = 'assets/icons/ttmi/' + o; orig++; if (p && !FB[o]) FB[o] = 'assets/icons/' + p.f + '/' + p.n + '.png'; continue; }
  if (!p) { none++; continue; }
  if (p.n === d.n) exact++; else guess++;
  out[d.n] = 'assets/icons/' + p.f + '/' + p.n + '.png';
}
const FB_JS = "(function(){var FB=window.__AFK_TTMI_ICON_FB;if(typeof document==='undefined')return;document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG'||t.getAttribute('data-ttmi-fb'))return;var s=t.getAttribute('src')||'';if(s.indexOf('assets/icons/ttmi/')<0)return;var f=s.split('/').pop().split('?')[0];t.setAttribute('data-ttmi-fb','1');t.src=FB[f]||'assets/icons/items/古代的卷軸.png';},true);})();";
writeFileSync(ROOT + 'afk-ttmi-icons-data.js', '/* Generated: node scripts/gen-ttmi-icons.mjs — 透視鏡匯入道具的圖示對照（透視鏡原圖優先，其次同名或名稱最像的現有圖示）；原圖載不到時自動換近似圖 */\nwindow.__AFK_TTMI_ICONS = ' + JSON.stringify(out) + ';\nwindow.__AFK_TTMI_ICON_FB = ' + JSON.stringify(FB) + ';\n' + FB_JS + '\n');
console.log('[gen-ttmi-icons] 透視鏡原圖 ' + orig + '、同名 ' + exact + '、相近 ' + guess + '、沿用類型圖 ' + none);
