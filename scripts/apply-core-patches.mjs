/**
 * apply-core-patches.mjs — 在「拉進上游原版核心」之後，自動把加掛版必要的核心鉤子補回去。
 *
 * 設計原則（給自動更新流程用，取代舊的整檔合併）：
 *   - 冪等：已補過就跳過（可重複跑）。
 *   - 錨點式：靠「函式/註解特徵字串」定位，不寫死行號 → 上游小改版大多仍插得進去。
 *   - 失敗大聲：錨點找不到就 throw（exit 1）→ CI 紅，讓人知道要修錨點，而不是默默讓離線壞掉。
 *
 * 目前的核心補丁（越少越好）：
 *   1. maybeSpawnMobs — 把 js/03 tick() 內「出怪排程」那一塊 { } 抽成具名函式，讓離線快速結算
 *      能用「與線上同一份」的出怪排程（出怪延遲/BOSS 節流/後排格/席琳日光加速全照原作）。
 *      其餘離線鉤子（saveGame/loadGame/changeMap/killMob/gainItem 包裝、結算期間靜音渲染）
 *      一律由 afk-offline.js 外掛自己 monkey-patch，不動核心。
 *
 * 用法：node scripts/apply-core-patches.mjs        （--check 只驗證是否已全部補上、不寫檔）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { applyRelicRuntimePatches } from './apply-relic-runtime-patches.mjs';
import { applyRelicWeaponBridgePatches } from './apply-relic-weapon-bridge-patches.mjs';
import { applyRelicCompanionPatches } from './apply-relic-companion-patches.mjs';
import { applyRelicDefensePatches } from './apply-relic-defense-patches.mjs';
import { applyDisplayPatches, applyCastleBadgePatch } from './apply-display-patches.mjs';
import { applyCardCombatPatches } from './apply-card-combat-patches.mjs';
import { applyWebpPatches } from './apply-webp-patches.mjs';

const CHECK = process.argv.includes('--check');
let changed = 0, already = 0;

// ── 小工具：從指定 index 的 '{' 找到配對的 '}'（略過字串/註解外的括號；此處程式碼夠單純故用簡易配對）──
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('matchBrace: 找不到配對的 }（自 index ' + openIdx + '）');
}

// ── 補丁 1：抽出 maybeSpawnMobs ────────────────────────────────
function patchMaybeSpawnMobs() {
  const FILE = 'js/03-combat-core.js';
  let s = readFileSync(FILE, 'utf8');

  if (/function\s+maybeSpawnMobs\s*\(/.test(s)) { already++; return; }   // 冪等

  // 錨點：出怪判定那段的開頭註解（上游原文，穩定）
  const ANCHOR = '// === 出怪判定：以邏輯 tick';
  const aIdx = s.indexOf(ANCHOR);
  if (aIdx < 0) throw new Error(`[${FILE}] 找不到出怪判定錨點「${ANCHOR}」——上游可能改寫了 tick 出怪段，請人工檢查後更新錨點。`);

  // 錨點之後第一個 '{' 就是那塊的開頭；找它的配對 '}'
  const openIdx = s.indexOf('{', aIdx);
  if (openIdx < 0) throw new Error(`[${FILE}] 錨點後找不到出怪塊的 '{'。`);
  const closeIdx = matchBrace(s, openIdx);
  const body = s.slice(openIdx + 1, closeIdx);   // 塊內程式碼（不含外層大括號）

  // 在 function tick() 之前插入具名函式；把原塊替換成呼叫
  const TICK_ANCHOR = 'function tick() {';
  const tIdx = s.indexOf(TICK_ANCHOR);
  if (tIdx < 0) throw new Error(`[${FILE}] 找不到「${TICK_ANCHOR}」錨點。`);

  const fnDef =
    '// 🔌 加掛版補丁(apply-core-patches)：出怪排程抽成具名函式，供 afk-offline 離線快速結算與 tick() 共用同一份排程。\n' +
    'function maybeSpawnMobs() {' + body + '}\n';

  // 先替換塊（用 index 由後往前處理避免位移）
  s = s.slice(0, openIdx) + '{ maybeSpawnMobs(); }' + s.slice(closeIdx + 1);
  // 重新定位 tick 錨點（前面替換過，位置變了，但 tick 在 aIdx 之前，未受影響——保險起見重找）
  const tIdx2 = s.indexOf(TICK_ANCHOR);
  s = s.slice(0, tIdx2) + fnDef + s.slice(tIdx2);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] maybeSpawnMobs 抽取完成（${FILE}）`);
}

// ── 補丁 2：gainItem 自帶強化值鉤子（偽傳統／自動衝裝）────────────
//   上游把傳統模式挖掉後 `let _tEn = 0;` 寫死。改成呼叫外掛鉤子 window.__afkTradRollEn(d, forceNormal, _noAffixCtx)：
//   afk-traditional.js 提供它 → 對「該角色有開偽傳統 + 非商店(forceNormal 假) + 裝備」回傳隨機強化值，其餘回 0。
//   未載外掛/未開 → 恆 0，與原版完全一致。詞綴/疊加/簽章全走上游原路（en 在簽章之前就定好，堆疊正確）。
function patchTradEnHook() {
  const FILE = 'js/08-items-equip.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('__afkTradRollEn')) { already++; return; }

  const ANCHOR = 'let _tEn = 0;   // 🏛️ v3.0.83 傳統模式已取消：掉落自帶強化值停用（任何來源恆 +0·手動強化照常）';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 gainItem 的 _tEn 錨點——上游可能改寫了掉落強化段，請人工檢查後更新錨點。`);

  const REPLACE = "let _tEn = (typeof window.__afkTradRollEn === 'function') ? (window.__afkTradRollEn(d, forceNormal, _noAffixCtx) || 0) : 0;   // 🔌 加掛版補丁：偽傳統(自動衝裝)自帶強化值鉤子（外掛 afk-traditional 提供；未載/未開→0）";
  s = s.replace(ANCHOR, REPLACE);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] gainItem _tEn 偽傳統鉤子（${FILE}）`);
}

// ── 補丁 3：存檔位 8 → 16（加掛版原有功能，上游只有 8 格）──────────
//   上游把格數硬寫死在多處：js/13 匯入時的「同角色重複」掃描、js/06 allySlotList（招募）與傭兵受僱
//   登記的四處掃描、js/05 安塔瑞斯每日通關遷移、js/25 clanScanRoles（血盟成員/盟主判定）、
//   js/28 PVP 挑戰自己其他角色的清單。
//   改成用 SAVE_SLOT_MAX=16（定義於 js/13，執行期全域，afk-loadslots/afk-wiki/afk-diag 的選角面板也讀它）。
//   選角畫面本身不必改核心：上游是分頁式卡片（每頁 4 格），afk-loadslots 自行擴充頁數。
function patch16Slots() {
  // js/13：定義 SAVE_SLOT_MAX + 匯入重複掃描涵蓋全部格
  const F13 = 'js/13-shop-save.js';
  let s13 = readFileSync(F13, 'utf8');
  if (!s13.includes('SAVE_SLOT_MAX')) {
    const A1 = "function slotSummary(n){ return _summaryFromRaw(_lzGet('lineage_idle_save_' + n)); }";
    if (s13.indexOf(A1) < 0) throw new Error(`[${F13}] 找不到 slotSummary 錨點——上游可能改了存檔位邏輯。`);
    s13 = s13.replace(A1,
      "const SAVE_SLOT_MAX = 16;   // 🔌 加掛版補丁：存檔位 8 → 16（匯入重複掃描/傭兵招募/選角面板共用）\n" + A1);
    // 匯入存檔時掃「同一角色是否已存在別格」——沒放大就掃不到第 9~16 格，會讓同角色重複進來
    const A2 = "for(let slotN = 1; slotN <= 8; slotN++){";
    if (s13.indexOf(A2) < 0) throw new Error(`[${F13}] 找不到匯入重複掃描 8 格迴圈錨點。`);
    s13 = s13.replace(A2, "for(let slotN = 1; slotN <= SAVE_SLOT_MAX; slotN++){");
    if (!CHECK) writeFileSync(F13, s13);
    changed++;
    console.log(`[patch] 存檔位 16 格（${F13}）`);
  } else { already++; }

  // js/06：傭兵招募可選存檔位 + 傭兵受僱登記的存檔位掃描
  const F06 = 'js/06-status-allies.js';
  let s06 = readFileSync(F06, 'utf8');
  let dirty06 = false;
  const A3 = "['1','2','3','4','5','6','7','8'].filter(n => n !== String(currentSlot))";
  if (s06.indexOf(A3) >= 0) {
    s06 = s06.replace(A3, "(function(){ let a=[]; for(let n=1;n<=SAVE_SLOT_MAX;n++){ if(String(n)!==String(currentSlot)) a.push(String(n)); } return a; })()");
    dirty06 = true;
    changed++;
    console.log(`[patch] 傭兵招募 16 格（${F06}）`);
  } else if (!s06.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F06}] 找不到 allySlotList 8 格錨點——上游可能改了招募邏輯。`);
  } else { already++; }

  // 傭兵受僱登記（bootstrap 遷移／受僱查詢／選角徽章／獨佔判定）四處各自掃全部存檔位。
  //   漏放大 → 僱主在第 9~16 格時，傭兵不顯示徽章、不受安全區限制、也擋不住被第二位僱主重複招募。
  const A3B_FROM = 'for (let n = 1; n <= 8; n++) {';
  const A3B_TO = 'for (let n = 1; n <= SAVE_SLOT_MAX; n++) {';
  if (s06.indexOf(A3B_FROM) >= 0) {
    s06 = s06.split(A3B_FROM).join(A3B_TO);
    dirty06 = true;
    changed++;
    console.log(`[patch] 傭兵受僱掃描 16 格（${F06}）`);
  } else if (s06.indexOf(A3B_TO) < 0) {
    throw new Error(`[${F06}] 找不到傭兵受僱登記的 8 格迴圈錨點——上游可能改了受僱判定，請確認第 9~16 格仍被掃到。`);
  } else { already++; }
  if (dirty06 && !CHECK) writeFileSync(F06, s06);

  // js/05：不再需要補丁——上游 v3.8.34 把安塔瑞斯每日通關改成「逐參與者（enSeed 身分）各記一把 key」，
  //   原本那個「掃存檔位 1~8 遷移舊資料」的迴圈整段移除，沒有 8 格上限可補。第 9~16 格照樣正常。

  // js/25：血盟成員掃描（成員清單＋貢獻度、clanLeaderRole 找盟主、城鎮 NPC 的「有無君主」判斷都經這裡）
  const F25 = 'js/25-clan-system.js';
  let s25 = readFileSync(F25, 'utf8');
  const A4 = "for (let slot = 1; slot <= 8; slot++) {";
  if (s25.indexOf(A4) >= 0) {
    s25 = s25.replace(A4, "for (let slot = 1; slot <= SAVE_SLOT_MAX; slot++) {");
    if (!CHECK) writeFileSync(F25, s25);
    changed++;
    console.log(`[patch] 血盟成員掃描 16 格（${F25}）`);
  } else if (!s25.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F25}] 找不到 clanScanRoles 8 格迴圈錨點——上游可能改了血盟成員掃描。`);
  } else { already++; }

  // js/28：PVP 面板「挑戰自己其他角色」的候選清單
  const F28 = 'js/28-pvp-arena.js';
  let s28 = readFileSync(F28, 'utf8');
  const A5 = "for (let n = 1; n <= 8; n++) {";
  if (s28.indexOf(A5) >= 0) {
    s28 = s28.replace(A5, "for (let n = 1; n <= SAVE_SLOT_MAX; n++) {");
    if (!CHECK) writeFileSync(F28, s28);
    changed++;
    console.log(`[patch] PVP 對手清單 16 格（${F28}）`);
  } else if (!s28.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F28}] 找不到 PVP 對手清單 8 格迴圈錨點——上游可能改了 PVP 面板。`);
  } else { already++; }
}

// ── 補丁 4：js/22 寵/召 sprite ticker 改「間接呼叫」──────────────
//   上游 setInterval(_petAnimApply, …) 直接捕捉原函式參照 → afk-powersave 的 wrapper 攔不到
//   (關戰鬥動畫後寵物/召喚照樣動)。改箭頭間接呼叫=每次經全域解析,外掛包得住。
function patchPetAnimTicker() {
  const FILE = 'js/22-pets.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('setInterval(() => { _petAnimApply(); }')) { already++; return; }
  const ANCHOR = 'setInterval(_petAnimApply, 1000 / PET_ANIM_FPS);';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 _petAnimApply ticker 錨點——上游可能改寫了寵物動畫排程。`);
  s = s.replace(ANCHOR, 'setInterval(() => { _petAnimApply(); }, 1000 / PET_ANIM_FPS);   // 🔌 加掛版補丁:間接呼叫讓外掛(省電模式)wrapper 攔得住;直接傳參照會被捕死原函式');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 寵/召 sprite ticker 間接呼叫（${FILE}）`);
}

// ── 補丁 5：js/07 迴避頭目 與 外掛「自動找BOSS」互斥 ─────────────
//   afk-bossring 召來的王若被「迴避頭目(瞬移卷軸)」自動逃離立刻瞬移走=功能互咬。
//   逃離條件加 !_huntBoss(讀外掛暴露的 AFK_BOSSRING.huntActive();外掛未載=false 照常)。
function patchBossHuntEscape() {
  const FILE = 'js/07-skills-cast.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('AFK_BOSSRING')) { already++; return; }
  const A1 = "let tChk = document.getElementById('set-teleport');";
  const A2 = 'if (tChk && tChk.checked && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport)';
  if (s.indexOf(A1) < 0 || s.indexOf(A2) < 0) throw new Error(`[${FILE}] 找不到迴避頭目錨點——上游可能改寫了自動瞬移段。`);
  s = s.replace(A1, A1 + "\n        let _huntBoss = !!(window.AFK_BOSSRING && window.AFK_BOSSRING.huntActive && window.AFK_BOSSRING.huntActive());   // 🔌 加掛版補丁:外掛「自動找BOSS」進行中→抑制逃離(否則剛召來的王立刻被瞬移走);外掛未載入=false 照常");
  s = s.replace(A2, 'if (tChk && tChk.checked && !_huntBoss && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport)');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 迴避頭目×自動找BOSS互斥（${FILE}）`);
}

// ── 補丁 6：js/08 useItem 加 keepModal 參數 ─────────────────────
//   外掛自動瞬移(afk-bossring)非 silent 使用卷軸時,上游會 closeModal() 把玩家開著的物品視窗關掉。
//   加第三參數 keepModal 讓自動路徑保留視窗(未傳=false,原行為不變)。
function patchUseItemKeepModal() {
  const FILE = 'js/08-items-equip.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('keepModal')) { already++; return; }
  const A1 = 'function useItem(u, silent = false) {';
  const A2 = "if(!silent && document.getElementById('item-modal').classList.contains('hidden') === false";
  if (s.indexOf(A1) < 0 || s.indexOf(A2) < 0) throw new Error(`[${FILE}] 找不到 useItem 錨點——上游可能改寫了簽名或關窗段。`);
  s = s.replace(A1, 'function useItem(u, silent = false, keepModal = false) {   // 🔌 加掛版補丁 keepModal:自動觸發(如外掛自動瞬移)非 silent 使用時,不關玩家開著的物品視窗');
  s = s.replace(A2, "if(!silent && !keepModal && document.getElementById('item-modal').classList.contains('hidden') === false");
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] useItem keepModal（${FILE}）`);
}

// ── 補丁 7：js/10 「立即賣出」不再無條件強制套規則 ─────────────────
//   上游 sellAutoSellItemsNow 無條件 applyAutoSellRules(true)(force)→玩家把自動販賣總開關關掉後
//   按「立即賣出」,仍當場依規則把沒標過的裝備標成廢品賣掉(玩家回報:武官護鎧被莫名賣掉;舊 main ab230707dc)。
//   改為只有總開關開著才 force;關閉時只賣玩家已手動標記的廢品(applyAutoSellRules(false) 會清規則舊標記)。
function patchSellNowNoForce() {
  const FILE = 'js/10-ui-tabs.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('applyAutoSellRules(player.autoSellOn!==false)')) { already++; return; }
  const ANCHOR = 'function sellAutoSellItemsNow(){_readAutoSellForm();_asBackup=null;applyAutoSellRules(true);';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 sellAutoSellItemsNow 錨點——上游可能改寫了立即賣出,請人工檢查(此補丁防「關閉自動販賣仍被強制套規則賣裝」)。`);
  s = s.replace(ANCHOR, 'function sellAutoSellItemsNow(){_readAutoSellForm();_asBackup=null;applyAutoSellRules(player.autoSellOn!==false);   /* 🔌 加掛版補丁:總開關關閉→不套規則,只賣手動標記的廢品 */');
  s = s.replace('// 🔧 v2.6.91 force=true：即使開關關閉也強制依規則標記後立即賣', '// 🔌 加掛版補丁:開關開著才 force 套規則;關閉時只賣手動標記(上游原為無條件 force)');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 立即賣出不強制套規則（${FILE}）`);
}


// ── 補丁 8：js/05 每殺一隻怪都掃整個背包找「死亡騎士之印記」→ 先判地區再掃 ──────
//   原式:!_kbNoReward && player.inv.some(...印記...) && mapRegionOf(...) === 'rastabad'
//   `.some()` 是 O(背包長度) 且**每次擊殺都跑**,而後面那個地區判斷極便宜、又幾乎總是 false(只有拉斯塔巴德成立)。
//   純粹把 && 的順序對調(兩者都無副作用,短路結果完全相同):大背包玩家離線補跑省下可觀時間(6x 限速實測)。
function patchInsigniaOrder() {
  const FILE = 'js/05-kill-progression.js';
  let s = readFileSync(FILE, 'utf8');
  const FROM = "if (!_kbNoReward && player.inv.some(i => i.id === 'item_dk_insignia') && typeof mapRegionOf === 'function' && mapRegionOf(mapState.current) === 'rastabad')";
  const TO   = "if (!_kbNoReward && typeof mapRegionOf === 'function' && mapRegionOf(mapState.current) === 'rastabad' && player.inv.some(i => i.id === 'item_dk_insignia'))";
  if (s.indexOf(FROM) >= 0) {
    s = s.replace(FROM, TO);
    if (!CHECK) writeFileSync(FILE, s);
    changed++;
    console.log(`[patch] 聖地遺物判斷改先判地區（${FILE}）`);
  } else if (s.indexOf(TO) < 0) {
    throw new Error(`[${FILE}] 找不到聖地遺物(item_dk_insignia)判斷錨點——上游可能改寫了那段掉落。`);
  } else { already++; }
}

// ── 補丁 9：js/05 吉爾塔斯魔杖不再「每殺一隻怪就整個人重算一次」──────────
//   這把杖的效果＝擊殺後 10 秒內依邪惡值加額外魔法點數(js/02:306 的 d.extraMp)。上游作法是每次擊殺
//   都把持有者丟進 _giltasWandTriggered → 玩家走 calcStats()、傭兵走 _allyLevelRecompute()
//   (而後者結尾又叫一次玩家的 calcStats() → **一個傭兵拿杖＝每殺一隻重算兩次**)。
//   但 buff 本來就還在、加成值又沒變時,重算前後的 d 完全一樣＝白算;而每次重算都會經
//   getClanBuffStats() 把整包血盟資料(壓縮 23KB／解開 242KB)重讀＋JSON.parse＋正規化一次。
//   實測(玩家真實存檔·1 小時離線):沒人拿杖 2.4 秒、一個傭兵拿杖 54 秒、兩個傭兵拿杖 91 秒。
//   改法:只有「buff 原本已過期」或「加成值真的變了」才進重算清單——會改變 d 的情況一次都沒少,
//   純粹拿掉重複。上次的加成值記在 _giltasWandBonus(同 _giltasWandFuryUntil 一樣是存檔內的暫時欄位)。
//   到期那側的重算由 js/03 tick 既有的 _giltasWandExpired 負責,不受影響。
//   ⚠ 判準要比「加成值」不能只比「邪惡值」:普通怪每殺一隻邪惡值就 +1(要一路殺到 ±32767 才停),
//     比邪惡值等於幾乎每次都不同 → 完全省不到。而 pvpEvilBonus(20) 是量化過的(每 ~1638 點才跳一階),
//     真正決定 d 的是它。
//   ⚠ 傭兵那側要先把全域 player 暫時換成該傭兵再算:js/02:306 的 pvpEvilBonus() 讀的是**當下的全域
//     player**,而傭兵重算時 player 正是被換成該傭兵(_allyLevelRecompute 的既有做法)。在 killMob 裡
//     不換就算會拿到隊長的值,兩邊比錯。try/finally 保證任何情況都換得回來。
//   實測同一存檔 1 小時離線 54 秒 → 0.9 秒;擊殺數與掉落一致。
function patchGiltasWandRecompute() {
  const FILE = 'js/05-kill-progression.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('_giltasWandBonus')) { already++; return; }

  const SITES = [
    ["{ player._giltasWandFuryUntil = state.ticks + 100; _giltasWandTriggered.push(player); }",
      "{ let _gwB = (typeof pvpEvilBonus === 'function' ? pvpEvilBonus(20) : 0);" +
      ' let _gwSame = player._giltasWandFuryUntil > state.ticks && player._giltasWandBonus === _gwB;' +
      ' player._giltasWandFuryUntil = state.ticks + 100; player._giltasWandBonus = _gwB;' +
      ' if (!_gwSame) _giltasWandTriggered.push(player); }   // 🔌 加掛版補丁:buff 還在且加成值沒變→這次重算不會改變任何衍生值,略過(離線結算的最大熱點)'],
    ["{ a._giltasWandFuryUntil = state.ticks + 100; _giltasWandTriggered.push(a); }",
      '{ let _gwP = player, _gwB = 0; player = a;' +
      "   try { _gwB = (typeof pvpEvilBonus === 'function' ? pvpEvilBonus(20) : 0); } finally { player = _gwP; }" +
      ' let _gwSame = a._giltasWandFuryUntil > state.ticks && a._giltasWandBonus === _gwB;' +
      ' a._giltasWandFuryUntil = state.ticks + 100; a._giltasWandBonus = _gwB;' +
      // ⚠ 這一處在 forEach 的箭頭函式**中間**,後面還接著 `});`——註解只能用 /* */,
      //   用 // 會把同一行後面的 `});` 一起吃掉(語法壞掉,而且只在執行期才看得出來)。
      ' if (!_gwSame) _giltasWandTriggered.push(a); }/* 🔌 加掛版補丁:同上(傭兵路徑更貴——_allyLevelRecompute 內部還會再叫一次玩家的 calcStats);算加成值前先把 player 換成這名傭兵,因為 pvpEvilBonus 讀的是全域 player */'],
  ];
  for (const [from, to] of SITES) {
    if (s.indexOf(from) < 0) throw new Error(`[${FILE}] 找不到吉爾塔斯魔杖擊殺錨點「${from.slice(0, 46)}…」——上游可能改寫了該段,請人工檢查(此補丁是離線結算效能的關鍵)。`);
    s = s.replace(from, to);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 吉爾塔斯魔杖不再每殺必重算（${FILE}）`);
}

// ── 補丁 10：js/10 裝備分頁的部位條列補上「魔眼」欄 ──────────────────
//   上游把魔眼欄(slot:'eye'·地龍之魔眼)只加進 js/19 的圖形裝備視窗第 2 頁,js/10 renderTabs 裡
//   那份寫死的部位清單 _baseSlots 沒跟上 → 條列式看不到這個欄位。
//   上游看不出問題(圖形視窗蓋在條列上面),但加掛版的 afk-eqlist 預設就是走條列 → 玩家裝上魔眼後
//   整個介面都找不到它,只能從背包點回去才知道有沒有裝上(玩家回報 2026-08-09)。
//   清單是 renderTabs 內的區域 const,外掛包不住;自己在 DOM 補一列則要複製整段列渲染(套裝發光/
//   角標/點擊開視窗),故走錨點補丁改那個字面值——同一個 forEach 畫出來,行為與其他欄位完全一致。
//   ⚠ 第一頁是 4×6=24 格,補進去後一般裝備欄 21(戰士雙斧 22)格,仍在 24 內 → 遺骸 8 格照樣落在第 25 格起。
function patchEyeSlotInEquipList() {
  const FILE = 'js/10-ui-tabs.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes("{k:'eye',n:'魔眼'}")) { already++; return; }

  const FROM = "{k:'doll',n:'魔法娃娃'},{k:'arrow',n:'箭矢'}]";
  const TO = "{k:'doll',n:'魔法娃娃'},{k:'arrow',n:'箭矢'},{k:'eye',n:'魔眼'}]";
  if (s.indexOf(FROM) < 0) throw new Error(`[${FILE}] 找不到裝備分頁部位清單(_baseSlots)的錨點——上游可能改寫了該清單,請人工檢查魔眼欄是否已由上游補上。`);
  s = s.replace(FROM, TO);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 裝備條列補上魔眼欄（${FILE}）`);
}

// ── 補丁 11：gainItem 遺物詞綴鉤子 ──────────────────────────────────
//   上游把遺物寫死排除在詞綴分支外（`!isRelic(d)`），而那是全遊戲產生詞綴的唯一入口。
//   外掛從外面包 gainItem 攔不到：等它跑完，物品已依「白板簽章」併進既有那一疊、掉落訊息
//   也印完了 → 事後改會改到整疊，要正確就得自己重寫核心的堆疊/日誌邏輯。
//   故比照補丁 2（__afkTradRollEn）加一個問外掛的鉤子：afk-relicaffix.js 提供 __afkRelicAffix，
//   決定這件遺物要不要帶祝福/遠古系/屬性。未載外掛/未開 → 回 null（或函式不存在）＝與原版一致。
//   forceNormal（潘朵拉遺物布告欄）與 _noAffixCtx（寵物白板）沿用核心語意：兩者一律不問鉤子。
function patchRelicAffixHook() {
  const FILE = 'js/08-items-equip.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('__afkRelicAffix')) { already++; return; }

  const ANCHOR = '    // 🔮 席琳套裝詞綴：';   // 席琳那段註解＋`let seteff = false;` 是一體的，插在它前面才不會把註解跟它解釋的那行拆開
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 gainItem 的席琳套裝詞綴錨點——上游可能改寫了詞綴段，請人工檢查後更新錨點。`);

  const EOL = s.includes('\r\n') ? '\r\n' : '\n';   // 核心是上游原檔鏡像（CRLF），插入行要跟著，否則整檔混行尾
  const INSERT = [
    "    // 🔌 加掛版補丁：遺物詞綴鉤子（外掛 afk-relicaffix 提供；未載/未開→null＝完全同原版）",
    "    if (!forceNormal && !_noAffixCtx && typeof window.__afkRelicAffix === 'function') {",
    "        let _ra = window.__afkRelicAffix(d, id);",
    "        if (_ra) { bless = _ra.bless || false; anc = _ra.anc || false; attr = _ra.attr || false; }",
    "    }",
    "",
  ].join(EOL) + EOL;
  s = s.replace(ANCHOR, INSERT + ANCHOR);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] gainItem 遺物詞綴鉤子（${FILE}）`);
}

// ── 補丁 12：武器內建魔法補上幻覺套裝鉤子（js/03＋js/04＋js/06，共 4 處）─────────
//   幻覺套裝的說明（js/01 `SHERINE_SET_TEXT`，資訊欄顯示給玩家看的那份）白紙黑字寫著
//   「魔爆及**武器內建**／免費觸發魔法…」，上游也確實把 spellProc／procSkill／立方／魔爆／
//   紅惡靈逆襲全接上了 `illusionMagicDmg()`。只有兩種武器內建魔法沒接上（玩家與傭兵各一處）：
//     ・`qiguProc` — 共鳴奇古獸「幻影衝擊」／寒冰奇古獸「心靈破壞」
//     ・`procDualSkill` — 解除封印的巴風特魔杖「熾焰地裂術」
//   兩者都走 magicBaseDamage × weaponMagicDamageCoef × 魔抗，正是說明講的那一類。判斷是「漏接」
//   而非「刻意排除」的依據：上游刻意不給的三種（一般傷害法術／共鳴／反射）都是**有呼叫、但傳
//   canTrigger=false** 並附註解說明理由；這兩處是連呼叫都沒有。
//   外掛包不住——傷害在函式內部算完就直接扣血，中間值攔不到（wrapper 只能事後比 HP 差，遇到
//   這一擊擊殺就整個錯）。故走錨點補丁，但行為仍問外掛 `__afkIlluWpnFix()`（afk-wpnfix 提供，
//   受它的 wpnfix 開關管）；未載外掛／關掉＝與原版位元組等價。
//   ⚠ 插在最後一個乘數之後、扣血與 logCombat 之前 → 戰鬥訊息印的數字跟實際扣的血一致。
function patchIllusionSetWpnProc() {
  const ON = "(typeof window.__afkIlluWpnFix === 'function' && window.__afkIlluWpnFix())";
  // [檔, 錨點(插在它前面), 要插入的敘述, 說明]
  const SITES = [
    ['js/03-combat-core.js',
      "target.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(target, dmg, 'magic');",
      `dmg = ${ON} ? illusionMagicDmg(dmg, true) : dmg;   /* 🔌 加掛版補丁:奇古獸內建魔法(幻影衝擊/心靈破壞)補上幻覺套裝 2/5 件 */ `,
      '奇古獸特效·玩家'],
    ['js/06-status-allies.js',
      "t.curHp -= pd; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, pd, 'magic');",
      `pd = ${ON} ? _allyIllusionMagicDmg(ally, pd) : pd;   /* 🔌 加掛版補丁:同上(傭兵) */ `,
      '奇古獸特效·傭兵'],
    ['js/04-combat-attack.js',
      "_dt.curHp -= _tot; _dt.justHit = 'fire'; mobWake(_dt);",
      `_tot = ${ON} ? illusionMagicDmg(_tot, true) : _tot;   /* 🔌 加掛版補丁:解除封印的巴風特魔杖(熾焰地裂術)補上幻覺套裝 2/5 件 */ `,
      '熾焰地裂術·玩家'],
    ['js/06-status-allies.js',
      // 傭兵這側扣血在 _allyDamageMob，錨在它前面的特效行 → 插入點仍落在 logCombat 之前
      "if (typeof playSpellFx === 'function') { try { playSpellFx(_pd.skn || '熾焰地裂術', _dt, ally); } catch (e) {} }",
      `_tot = ${ON} ? _allyIllusionMagicDmg(ally, _tot) : _tot;   /* 🔌 加掛版補丁:同上(傭兵) */ `,
      '熾焰地裂術·傭兵'],
  ];
  for (const [FILE, anchor, stmt, label] of SITES) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(stmt.trim())) { already++; continue; }   // 冪等（每處的敘述各自不同，可逐處判斷）
    if (s.indexOf(anchor) < 0) throw new Error(`[${FILE}] 找不到「${label}」的錨點「${anchor.slice(0, 46)}…」——上游可能改寫了該段，請人工確認幻覺套裝是否已由上游自己接上。`);
    s = s.replace(anchor, stmt + anchor);
    if (!CHECK) writeFileSync(FILE, s);
    changed++;
    console.log(`[patch] 武器內建魔法吃幻覺套裝 — ${label}（${FILE}）`);
  }
}

// ── 補丁 13：js/24 收購 NPC 的強化值判定改由外掛決定「這一件能不能交」 ──────────
//   上游 _findMatches 只認「強化值完全相等」,所以收 +6 的單,手上只有 +15 就交不了。
//   為什麼不能純外掛包:_findMatches 關在 js/24 的 IIFE 裡拿不到;唯一的替代路是
//   「暫時把某件的 en 改成需求值騙過核心」,而成交後核心自己會 saveGame() → 整疊 +15 會被
//   真的寫成 +6(玩家的裝備安靜變質)。故走錨點補丁,只開一個判斷鉤子。
//   鉤子回 null(或外掛沒載/被關掉)→ 完全等同原版嚴格相等;回 true/false 才由外掛決定。
//   「挑哪一件」100% 留在外掛層(afk-buyercompat.js),核心只回答「這一件通不通過」。
function patchBuyerEnHook() {
  const FILE = 'js/24-pandora-relic-market.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('__afkBuyerEnMatch')) { already++; return; }   // 冪等
  const ANCHOR = 'if (req.en != null && Math.floor(Number(it.en) || 0) !== Math.floor(Number(req.en) || 0)) continue;';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到收購強化值判定錨點——上游可能改寫了 _findMatches,請人工檢查(此補丁供「收購向下兼容」外掛決定要交哪一件)。`);
  const REPLACEMENT =
    'if (req.en != null) {\n' +
    '                        /* 🔌 加掛版補丁:讓外掛決定「這一件能不能交」(向下兼容:收 +6 也可以繳 +15)。 */\n' +
    '                        /*    回 null 或外掛未載/已關 → 走下面的原版嚴格相等,行為與上游完全一致。 */\n' +
    '                        let _afkOk = (typeof window !== \'undefined\' && typeof window.__afkBuyerEnMatch === \'function\')\n' +
    '                            ? window.__afkBuyerEnMatch(it, req, source.name) : null;\n' +
    '                        if (_afkOk == null) { if (Math.floor(Number(it.en) || 0) !== Math.floor(Number(req.en) || 0)) continue; }\n' +
    '                        else if (!_afkOk) continue;\n' +
    '                    }';
  s = s.replace(ANCHOR, REPLACEMENT);
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 收購強化值判定開放給外掛（${FILE}）`);
}

// ── 補丁 14：js/24 收購 NPC 生成鉤子＋公開目前叫賣者清單 ─────────────────────
//   玩家指定的新收購規則（裝備依安定值定價、+10 以上／8 級以上法術書／卡片改收龍鑽、
//   收購物品每小時換一輪、依 6 區塊輪替）需要在「叫賣者剛生成」時改寫內容；_makeWanderer 關在 IIFE 裡。
//   鉤子回 false＝這輪不生成；沒載外掛／外掛關掉＝完全等同原版。
//   另外公開 pandoraListWanderers()，讓世界頻道外掛能讓目前在場的收購者講話（唯讀）。
function patchWandererMakeHook() {
  const FILE = 'js/24-pandora-relic-market.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('__afkWandererMake')) { already++; return; }   // 冪等
  const ANCHOR = '        return buyer;\n    }\n\n    function _activeSignature(';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 _makeWanderer 結尾錨點——上游可能改寫了收購 NPC 生成，請人工檢查。`);
  s = s.replace(ANCHOR,
    '        /* 🔌 加掛版補丁:收購 NPC 生成後交給外掛改寫內容(物品/強化值/報酬/停留時間);回 false＝這輪不生成。 */\n' +
    '        if (typeof window !== \'undefined\' && typeof window.__afkWandererMake === \'function\') {\n' +
    '            try {\n' +
    '                let _afkR = window.__afkWandererMake(buyer, { rand: tag => _rand(st, tag), safeValue: _safeValue, isEnhanceable: _isEnhanceableDef });\n' +
    '                if (_afkR === false) return null;\n' +
    '            } catch (e) { try { console.warn(\'[afk] __afkWandererMake 失敗，改用原版內容\', e); } catch (e2) {} }\n' +
    '        }\n' + ANCHOR);
  const EXP = '    window.pandoraRestoreSharedDiamonds = pandoraRestoreSharedDiamonds;\n';
  if (s.indexOf(EXP) < 0) throw new Error(`[${FILE}] 找不到 window 匯出錨點。`);
  s = s.replace(EXP, EXP + '    window.pandoraListWanderers = function () { return _readState().wanderers.filter(w => _wandererPresent(w)); };   // 🔌 加掛版補丁:唯讀清單（世界頻道外掛用）\n');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 收購 NPC 生成鉤子＋叫賣者清單（${FILE}）`);
}

// ── 補丁 15：出血傷害比例開放給「強化遺物」加成（js/04＋js/06＋js/10＋js/14）─────────────
//   遺物合成（afk-relicplus）每 +5 讓遺物特效 +5%，匕首／單手矛的「出血每秒 20%」也算在內。
//   出血比例寫死在 applyBleed 的呼叫端，故在玩家／傭兵兩處把傷害乘上 (20+加成)/20；
//   tooltip 兩處的「20%」改成實際數字。沒有 relicBleedBonus 的武器＝乘 1，與原版完全相同。
function patchRelicBleedBonus() {
  const edits = [
    ['js/04-combat-attack.js', "applyBleed(target, result.dmg, hasMastery('d_bleed') ? 10 : 5, hasMastery('d_bleed'));",
      "applyBleed(target, result.dmg * (20 + ((DB.items[_bleedWpnId] || {}).relicBleedBonus || 0)) / 20, hasMastery('d_bleed') ? 10 : 5, hasMastery('d_bleed'));   /* 🔌 加掛版補丁:強化遺物出血加成 */"],
    ['js/06-status-allies.js', "applyBleed(t, res.dmg, allyHasMastery(ally, 'd_bleed') ? 10 : 5,",
      "applyBleed(t, res.dmg * (20 + ((DB.items[wpnInst.id] || {}).relicBleedBonus || 0)) / 20, allyHasMastery(ally, 'd_bleed') ? 10 : 5,"],
    ['js/10-ui-tabs.js', "if (typeof weaponHasBleed === 'function' && weaponHasBleed(item.id)) _eff.push('出血（命中疊加8秒流血，每秒造成該次傷害20%）');",
      "if (typeof weaponHasBleed === 'function' && weaponHasBleed(item.id)) _eff.push('出血（命中疊加8秒流血，每秒造成該次傷害' + (20 + ((DB.items[item.id] || {}).relicBleedBonus || 0)) + '%）');   /* 🔌 加掛版補丁:強化遺物出血加成 */"],
    ['js/14-craft-pandora.js', "if(typeof weaponHasBleed === 'function' && weaponHasBleed(id)) _eff.push('出血（命中疊加8秒流血，每秒造成該次傷害20%）');",
      "if(typeof weaponHasBleed === 'function' && weaponHasBleed(id)) _eff.push('出血（命中疊加8秒流血，每秒造成該次傷害' + (20 + ((DB.items[id] || {}).relicBleedBonus || 0)) + '%）');"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) { continue; }
    if (s.indexOf(A) < 0 && s.includes('relicBleedBonus')) continue;   // 已補過、之後又被補丁 17 疊加改寫（例如加上 20 層判斷）
    if (s.indexOf(A) < 0) throw new Error(`[${FILE}] 找不到出血錨點——上游可能改寫了出血呼叫，請人工檢查（此補丁供強化遺物的出血加成）。`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  if (any) { changed++; console.log('[patch] 出血比例開放給強化遺物加成（js/04、js/06、js/10、js/14）'); } else already++;
}

// ── 補丁 16：強化遺物的特殊效果分級＋幸運暴走兔腳可戴兩個（js/02＋js/04＋js/05＋js/08＋js/10＋js/27）─────
//   百變的透明內衣 highestAttrPlus：原本 true＝+1 → 也接受數字（+5 起由 afk-relicplus 改成 2、3…）
//   火熱愛意 fireNullify：免疫冷卻原本寫死 100 ticks → 讀 fireNullifyTicks（沒有就 100）
//   幸運暴走兔腳：耳環「同名不能戴兩個」對它開例外；遺物掉落判定次數改由 window.__afkRelicDropMult()（戴兩個＝×4）
//   沒有載外掛時所有值都退回原本的 1／100／×2，行為與上游相同。
function patchRelicSpecialScale() {
  const edits = [
    ['js/02-stats-recompute.js', "if (_hd && _hd.highestAttrPlus) { _hap = true; break; }",
      "if (_hd && _hd.highestAttrPlus) { _hap = Math.max(+_hap || 0, _hd.highestAttrPlus === true ? 1 : (Number(_hd.highestAttrPlus) || 1)); }   /* 🔌 加掛版補丁:強化遺物分級 */"],
    ['js/02-stats-recompute.js', "        if (d.str === _mx) d.str += 1; if (d.dex === _mx) d.dex += 1; if (d.con === _mx) d.con += 1;\n        if (d.int === _mx) d.int += 1; if (d.wis === _mx) d.wis += 1; if (d.cha === _mx) d.cha += 1; } }",
      "        if (d.str === _mx) d.str += +_hap; if (d.dex === _mx) d.dex += +_hap; if (d.con === _mx) d.con += +_hap;\n        if (d.int === _mx) d.int += +_hap; if (d.wis === _mx) d.wis += +_hap; if (d.cha === _mx) d.cha += +_hap; } }"],
    ['js/02-stats-recompute.js', "if(ed.fireNullify) d.fireNullify = true;",
      "if(ed.fireNullify) { d.fireNullify = true; d.fireNullifyTicks = Math.min(d.fireNullifyTicks || 100, ed.fireNullifyTicks || 100); }   /* 🔌 加掛版補丁:強化遺物分級 */"],
    ['js/04-combat-attack.js', "            player._fireNullCd = state.ticks + 100;\n", "            player._fireNullCd = state.ticks + (player.d.fireNullifyTicks || 100);\n"],
    ['js/04-combat-attack.js', "        ally._fireNullCd = state.ticks + 100;\n", "        ally._fireNullCd = state.ticks + (d.fireNullifyTicks || 100);\n"],
    ['js/04-combat-attack.js', "            ally._fireNullCd = state.ticks + 100;\n", "            ally._fireNullCd = state.ticks + (d.fireNullifyTicks || 100);\n"],
    ['js/04-combat-attack.js', "            player._fireNullCd = state.ticks + 100;   // 10 秒", "            player._fireNullCd = state.ticks + (player.d.fireNullifyTicks || 100);   // 10 秒"],
    ['js/10-ui-tabs.js', "if (d.fireNullify) out.push('火焰化解（每10秒可免疫一次火屬性傷害）');",
      "if (d.fireNullify) out.push((d.fireNullifyTicks || 100) <= 1 ? '火焰化解（免疫火屬性傷害）' : '火焰化解（每' + ((d.fireNullifyTicks || 100) / 10) + '秒可免疫一次火屬性傷害）');"],
    ['js/10-ui-tabs.js', "if (d.highestAttrPlus) out.push('主屬性強化（目前最高的六維屬性+1；並列皆增加）');",
      "if (d.highestAttrPlus) out.push('主屬性強化（目前最高的六維屬性+' + (d.highestAttrPlus === true ? 1 : d.highestAttrPlus) + '；並列皆增加）');"],
    ['js/05-kill-progression.js', "let _relicX2 = (DB.items[itemId].relic && typeof mainPlayerHasEquippedEffect === 'function' && mainPlayerHasEquippedEffect('relicDropX2')) ? 2 : 1;",
      "let _relicX2 = !DB.items[itemId].relic ? 1 : (typeof window.__afkRelicDropMult === 'function' ? window.__afkRelicDropMult() : ((typeof mainPlayerHasEquippedEffect === 'function' && mainPlayerHasEquippedEffect('relicDropX2')) ? 2 : 1));   /* 🔌 加掛版補丁:兔腳可戴兩個 */"],
    ['js/04-combat-attack.js', "let _relicX2 = (typeof mainPlayerHasEquippedEffect === 'function' && mainPlayerHasEquippedEffect('relicDropX2')) ? 2 : 1;",
      "let _relicX2 = (typeof window.__afkRelicDropMult === 'function') ? window.__afkRelicDropMult() : ((typeof mainPlayerHasEquippedEffect === 'function' && mainPlayerHasEquippedEffect('relicDropX2')) ? 2 : 1);   /* 🔌 加掛版補丁:兔腳可戴兩個 */"],
    ['js/27-offline-rewards.js', "            if (ed && ed.relicDropX2) return 2;",
      "            if (ed && ed.relicDropX2) return (typeof window.__afkRelicDropMult === 'function') ? window.__afkRelicDropMult() : 2;   /* 🔌 加掛版補丁:兔腳可戴兩個 */"],
    ['js/08-items-equip.js', "if (_other && DB.items[_other.id] && DB.items[_other.id].n === d.n) {",
      "if (_other && DB.items[_other.id] && DB.items[_other.id].n === d.n && !(d.relicDropX2 && typeof window.__afkRelicDropMult === 'function')) {   /* 🔌 加掛版補丁:兔腳可戴兩個 */"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    const n = s.split(A).length - 1;
    if (n < 1) throw new Error(`[${FILE}] 找不到強化遺物分級錨點：${A.slice(0, 60)}…`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  if (any) { changed++; console.log('[patch] 強化遺物特殊效果分級＋兔腳可戴兩個'); } else already++;
}

// ── 補丁 17：+10 以上遺物的出血規則＋持續傷害每秒上限（js/04＋js/06）──────────────────
//   ‧遺物 +10 以上（relicPlus ≥ 10）的匕首／單手矛：出血每一下必定觸發（原本力量÷60）、層數上限 20
//     （疊滿 20 層時持續 30 秒由 afk-relicplus 包 applyBleed 處理）
//   ‧持續傷害上限：中毒＋出血對同一隻怪，每秒最多造成牠最大 HP 的 1%（window.__afkDotCap；外掛沒載＝不限制）
function patchRelicDotRules() {
  const edits = [
    ['js/04-combat-attack.js', "let _bleedChance = _canBleed ? ((player.d.str || 0) / 60) : 0;",
      "let _bleedChance = _canBleed ? (((DB.items[_bleedWpnId] || {}).relicPlus >= 10) ? 1 : ((player.d.str || 0) / 60)) : 0;   /* 🔌 加掛版補丁:+10 遺物出血必中 */"],
    ['js/04-combat-attack.js', "/ 20, hasMastery('d_bleed') ? 10 : 5, hasMastery('d_bleed'));   /* 🔌 加掛版補丁:強化遺物出血加成 */",
      "/ 20, ((DB.items[_bleedWpnId] || {}).relicPlus >= 10) ? 20 : (hasMastery('d_bleed') ? 10 : 5), hasMastery('d_bleed'));   /* 🔌 加掛版補丁:強化遺物出血加成＋+10 遺物 20 層 */"],
    ['js/06-status-allies.js', "let _bleedChance = _allyCanBleed ? ((d.str||0)/60) : 0;",
      "let _bleedChance = _allyCanBleed ? (((DB.items[wpnInst.id] || {}).relicPlus >= 10) ? 1 : ((d.str||0)/60)) : 0;   /* 🔌 加掛版補丁:+10 遺物出血必中 */"],
    ['js/06-status-allies.js', "/ 20, allyHasMastery(ally, 'd_bleed') ? 10 : 5, allyHasMastery(ally, 'd_bleed'), _dpsAllySrc(ally));",
      "/ 20, ((DB.items[wpnInst.id] || {}).relicPlus >= 10) ? 20 : (allyHasMastery(ally, 'd_bleed') ? 10 : 5), allyHasMastery(ally, 'd_bleed'), _dpsAllySrc(ally));"],
    ['js/06-status-allies.js', "            let _pdc = _teamDotCrit(s.poisonDmg);   // 🏺 v3.1.80 永不終止的夢魘：中毒 DoT 可爆擊\n",
      "            let _pdc = _teamDotCrit(s.poisonDmg);   // 🏺 v3.1.80 永不終止的夢魘：中毒 DoT 可爆擊\n            if (typeof window.__afkDotCap === 'function') _pdc.dmg = window.__afkDotCap(m, _pdc.dmg);   /* 🔌 加掛版補丁:持續傷害每秒上限 */\n"],
    ['js/06-status-allies.js', "            let _bdc = _teamDotCrit(bleedTotal);   // 🏺 v3.1.80 永不終止的夢魘：出血 DoT 可爆擊\n",
      "            let _bdc = _teamDotCrit(bleedTotal);   // 🏺 v3.1.80 永不終止的夢魘：出血 DoT 可爆擊\n            if (typeof window.__afkDotCap === 'function') _bdc.dmg = window.__afkDotCap(m, _bdc.dmg);   /* 🔌 加掛版補丁:持續傷害每秒上限 */\n"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    if (s.indexOf(A) < 0) throw new Error(`[${FILE}] 找不到持續傷害錨點：${A.slice(0, 60)}…`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  if (any) { changed++; console.log('[patch] +10 遺物出血規則＋持續傷害每秒上限'); } else already++;
}

// ── 補丁 18：瘋狂席琳夢艷地獄模式的核心掛點（js/03＋js/04＋js/05）─────────────────────
//   ‧掉落倍率：夢艷地獄怪（mob._dream）×8（玩家 2026-10-29：原本 ×50）
//   ‧席琳結晶掉率：夢艷地獄 ×5（瘋狂 ×3）
//   ‧出怪等待：window.__afkSpawnDelayAdj(delay)（夢艷地獄 −3 秒，下限 0.5 秒）
//   ‧血壁型免疫支援 kind:'phys'（近距離＋遠距離都算），供夢艷地獄小怪出生 10 秒隨機免疫物理或魔法
//   沒有夢艷地獄怪、外掛沒載時全部等同原版。
function patchDreamHell() {
  const edits = [
    ['js/05-kill-progression.js', "let _dropBase = (mob._grace ? 10 : (mob._sherine ? (mob._sherineMad ? 5 : 3) : 1));",
      "let _dropBase = (mob._dream ? 8 : (mob._grace ? 10 : (mob._sherine ? (mob._sherineMad ? 5 : 3) : 1)));   /* 🔌 加掛版補丁:夢艷地獄 ×8 */"],
    ['js/05-kill-progression.js', "let _cr = (mob.boss ? 0.0001 : 0.00001) * (mob.lv || 1) * (mob._sherineMad ? 3 : 1);",
      "let _cr = (mob.boss ? 0.0001 : 0.00001) * (mob.lv || 1) * (mob._dream ? 5 : (mob._sherineMad ? 3 : 1));   /* 🔌 加掛版補丁:夢艷地獄結晶 ×5 */"],
    ['js/03-combat-core.js', "                    delay = Math.max(5, Math.round(50 * _mv));                       // 🚧 下限 5 tick＝0.5 秒\n",
      "                    delay = Math.max(5, Math.round(50 * _mv));                       // 🚧 下限 5 tick＝0.5 秒\n                    if (typeof window.__afkSpawnDelayAdj === 'function') delay = window.__afkSpawnDelayAdj(delay);   /* 🔌 加掛版補丁:夢艷地獄出怪 −3 秒 */\n"],
    ['js/04-combat-attack.js', "    if (rw.kind !== kind) return;\n",
      "    if (rw.kind !== kind && !(rw.kind === 'phys' && (kind === 'melee' || kind === 'ranged'))) return;   /* 🔌 加掛版補丁:phys＝近距離＋遠距離 */\n"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    if (s.indexOf(A) < 0) throw new Error(`[${FILE}] 找不到夢艷地獄錨點：${A.slice(0, 60)}…`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  // 免疫訊息的類型名稱補上「物理」
  { const FILE = 'js/04-combat-attack.js'; let s = readFileSync(FILE, 'utf8');
    const A = "{ melee: '近距離', ranged: '遠距離', magic: '魔法' }", B = "{ melee: '近距離', ranged: '遠距離', magic: '魔法', phys: '物理' }";
    if (s.includes(A)) { s = s.split(A).join(B); if (!CHECK) writeFileSync(FILE, s); any = true; } }
  if (any) { changed++; console.log('[patch] 瘋狂席琳夢艷地獄模式掛點'); } else already++;
}

// ── 補丁 19：昇華支配武器的屬性魔法 5 星（js/04＋js/08＋js/11）──────────────────────
//   ‧屬性魔法星數上限：昇華支配遺物（relicAsc 有值）5 星，其餘維持 3 星
//   ‧5 星時改由 window.__afkAttr5(target, inst, wpn, proc) 處理（轉換成四種新魔法）
//   ‧免費觸發法術傷害倍率開放 window.__afkSpellMult（新魔法 ×1.5 用；沒設＝1，同原版）
function patchAscAttrStar() {
  const edits = [
    ['js/08-items-equip.js', "let star = Math.max(1, Math.min(3, Math.floor(Number(item.attrMagicStar) || 1)));",
      "let star = Math.max(1, Math.min(((DB.items[item.id] || {}).relicAsc != null) ? 5 : 3, Math.floor(Number(item.attrMagicStar) || 1)));   /* 🔌 加掛版補丁:昇華支配 5 星 */"],
    ['js/11-world-map.js', "let nextStar = sameMagic ? Math.min(3, oldStar + 1) : 1;",
      "let nextStar = sameMagic ? Math.min(((DB.items[item.id] || {}).relicAsc != null) ? 5 : 3, oldStar + 1) : 1;   /* 🔌 加掛版補丁:昇華支配 5 星 */"],
    ['js/04-combat-attack.js', "    let proc = (typeof getAttrMagicProc === 'function') ? getAttrMagicProc(inst) : null;\n    if (!proc || Math.random() * 100 >= proc.rate) return;\n",
      "    let proc = (typeof getAttrMagicProc === 'function') ? getAttrMagicProc(inst) : null;\n    if (proc && proc.star >= 5 && typeof window.__afkAttr5 === 'function') { window.__afkAttr5(target, inst, wpn, proc); return; }   /* 🔌 加掛版補丁:5 星新魔法 */\n    if (!proc || Math.random() * 100 >= proc.rate) return;\n"],
    ['js/04-combat-attack.js', "        : magicDamageCoef(player.d, magicAttrDefense(t, sk.ele || 'none'), sk.tier);\n    let mageDmgMult = 1.0;\n    let critMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;",
      "        : magicDamageCoef(player.d, magicAttrDefense(t, sk.ele || 'none'), sk.tier);\n    let mageDmgMult = (typeof window !== 'undefined' && window.__afkSpellMult) || 1.0;   /* 🔌 加掛版補丁:免費觸發法術倍率 */\n    let critMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 昇華支配 5 星錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 60)}…`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  if (any) { changed++; console.log('[patch] 昇華支配武器屬性魔法 5 星'); } else already++;
}

function patchCardRebirth() {
  const edits = [
    ['js/15-cards.js', "    let bonusLine = [1, 2, 3].map(tt => {",
      "    let bonusLine = CARD_TIERS.map(x => x.t).map(tt => {   /* 🔌 加掛版補丁:白金／鑽石卡 */"],
    ['js/15-cards.js', "收集 普${cP} / 銀${cS} / 金${cG}　共 ${total} 種",
      "收集 普${cP} / 銀${cS} / 金${cG}${CARD_TIERS.length > 3 ? ' / 白金' + names.filter(n => cardDexTier(n) >= 4).length + ' / 鑽石' + names.filter(n => cardDexTier(n) >= 5).length : ''}　共 ${total} 種"],
    ['js/02-stats-recompute.js', "    { let _ATTR_CAP = 100;",
      "    { let _ATTR_CAP = (typeof window.__afkAttrCap === 'function') ? window.__afkAttrCap() : 100;   /* 🔌 加掛版補丁:輪迴轉生屬性上限 */"],
    ['js/13-shop-save.js', "    let capN = 60;   // 屬性配點上限",
      "    let capN = (typeof window.__afkAllocCap === 'function') ? window.__afkAllocCap() : 60;   /* 🔌 加掛版補丁:輪迴轉生 */   // 屬性配點上限"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 白金卡／轉生錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 60)}…`);
    s = s.replace(A, B);
    if (!CHECK) writeFileSync(FILE, s);
    any = true;
  }
  if (any) { changed++; console.log('[patch] 白金／鑽石卡圖鑑顯示＋輪迴轉生屬性上限'); } else already++;
}

function patchPetHostRect() {
  const FILE = 'js/22-pets.js';
  const A = "        let hostRect = host.getBoundingClientRect();";
  const B = "        let hostRect = (typeof window.__afkHostRect === 'function') ? window.__afkHostRect(host) : host.getBoundingClientRect();   /* 🔌 加掛版補丁:戰場大小快取 */";
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(B)) { already++; return; }
  const n = s.split(A).length - 1;
  if (n !== 1) throw new Error(`[${FILE}] 寵物圖層 hostRect 錨點應出現 1 次，實際 ${n} 次`);
  s = s.replace(A, B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 寵物圖層戰場大小快取');
}

function patchBarrierCdSkip() {
  const FILE = 'js/07-skills-cast.js';
  const A = "        if (document.getElementById(cfg.id).checked && (player.buffs[cfg.b] || 0) <= 0) {";
  const B = "        if (document.getElementById(cfg.id).checked && (player.buffs[cfg.b] || 0) <= 0 && !(cfg.b === 'sk_magic_shield' && (player.magicShieldCd || 0) > 0)) {   /* 🔌 加掛版補丁:屏障冷卻中不每 tick 掃背包 */";
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(B)) { already++; return; }
  const n = s.split(A).length - 1;
  if (n !== 1) throw new Error(`[${FILE}] 自動 buff 迴圈錨點應出現 1 次，實際 ${n} 次`);
  s = s.replace(A, B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 魔法屏障冷卻中跳過自動使用');
}

function patchNoOfflineMaps() {
  const FILE = 'js/27-offline-rewards.js';
  const A = "        if (/^antharas_(?:nest_[123]|lair)$/.test(String(map))) return false;";
  const B = "        if (/^antharas_(?:nest_[123]|lair)$/.test(String(map))) return false;\n        if (typeof window !== 'undefined' && Array.isArray(window.__afkNoOfflineMaps) && window.__afkNoOfflineMaps.indexOf(String(map)) >= 0) return false;   /* 🔌 加掛版補丁:外掛副本禁止離線掛機 */";
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(B)) { already++; return; }
  const n = s.split(A).length - 1;
  if (n !== 1) throw new Error(`[${FILE}] 離線地圖錨點應出現 1 次，實際 ${n} 次`);
  s = s.replace(A, B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 外掛副本禁止離線掛機');
}

function patchEvoHooks() {
  const FILE = 'js/02-stats-recompute.js';
  const edits = [
    ["    p._setPoly = null;   // 套裝變身僅在穿著時生效",
     "    if (typeof window.__afkSetBoost === 'function') { try { window.__afkSetBoost(p, setCheck); } catch (e) {} }   /* 🔌 加掛版補丁:至高的支配套裝特效 */\n    p._setPoly = null;   // 套裝變身僅在穿著時生效"],
    ["    { let _ATTR_CAP = ",
     "    if (typeof window.__afkAttrBoost === 'function') { try { window.__afkAttrBoost(p, d); } catch (e) {} }   /* 🔌 加掛版補丁:至高的支配全能力 */\n    { let _ATTR_CAP = "],
  ];
  let s = readFileSync(FILE, 'utf8'), any = false;
  for (const [A, B] of edits) {
    if (s.includes(B)) continue;
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 至高的支配錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 40)}`);
    s = s.replace(A, B); any = true;
  }
  if (any) { if (!CHECK) writeFileSync(FILE, s); changed++; console.log('[patch] 至高的支配套裝／全能力掛點'); } else already++;
}

function patchRebirthMastery() {
  // 轉生角色同時擁有該職業全部四種精通：把「p.mastery === 'x'」比較改成可被外掛覆寫的判斷（外掛沒載入時行為與原版相同）
  const FILES = ['js/02-stats-recompute.js', 'js/03-combat-core.js', 'js/04-combat-attack.js', 'js/07-skills-cast.js', 'js/10-ui-tabs.js', 'js/11-world-map.js', 'js/23-summons.js', 'js/01-drops-config.js'];
  const RE = /(?<!typeof )(?<!: )\b(p|player)\.mastery (===|!==) '([a-z][a-z0-9_]*)'/g;
  let any = false;
  for (const FILE of FILES) {
    let s = readFileSync(FILE, 'utf8');
    const out = s.replace(RE, (m0, who, op, id) => (op === '===' ? '' : '!') + `(typeof _afkM === 'function' ? _afkM(${who}, '${id}') : ${who}.mastery === '${id}')`);
    if (out !== s) { any = true; if (!CHECK) writeFileSync(FILE, out); }
  }
  if (any) { changed++; console.log('[patch] 轉生四精通判斷'); } else already++;
}

function patchLevelCap() {
  const edits = [
    ['js/02-stats-recompute.js', "p.lv = Math.max(1, Math.min(100, Math.floor(p.lv) || 1));",
      "p.lv = Math.max(1, Math.min((typeof window.__afkLvCap === 'function' ? window.__afkLvCap(p) : 100), Math.floor(p.lv) || 1));   /* 🔌 加掛版補丁:轉生等級上限 150 */"],
    ['js/05-kill-progression.js', "    while(player.lv < 100 && player.exp >= getExpReq(player.lv)) {",
      "    while(player.lv < (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(player) : 100) && player.exp >= getExpReq(player.lv)) {   /* 🔌 加掛版補丁:轉生等級上限 150 */"],
    ['js/01-drops-config.js', "player.lv   = Math.max(1, Math.min(100, Math.floor(fin(player.lv, 1)) || 1));   // 等級 [1,100]",
      "player.lv   = Math.max(1, Math.min((typeof window.__afkLvCap === 'function' ? window.__afkLvCap(player) : 100), Math.floor(fin(player.lv, 1)) || 1));   // 等級 [1,100]   /* 🔌 加掛版補丁:轉生等級上限 150（存檔前夾值） */"],
    ["js/06-status-allies.js", "while ((ctx.source.lv || 1) < 100 && ctx.source.exp >= getExpReq(ctx.source.lv)) {",
      "while ((ctx.source.lv || 1) < (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(ctx.source) : 100) && ctx.source.exp >= getExpReq(ctx.source.lv)) {   /* 🔌 加掛版補丁 */"],
    ["js/06-status-allies.js", "if ((ctx.source.lv || 1) >= 100) ctx.source.exp = 0;",
      "if ((ctx.source.lv || 1) >= (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(ctx.source) : 100)) ctx.source.exp = 0;   /* 🔌 加掛版補丁 */"],
    ["js/06-status-allies.js", "while ((player.lv || 1) < 100 && player.exp >= getExpReq(player.lv)) { player.exp -= getExpReq(player.lv); player.lv++;",
      "while ((player.lv || 1) < (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(player) : 100) && player.exp >= getExpReq(player.lv)) { player.exp -= getExpReq(player.lv); player.lv++;   /* 🔌 加掛版補丁 */"],
    ["js/06-status-allies.js", "if ((player.lv || 1) >= 100) player.exp = 0;   // 滿等不留溢出經驗",
      "if ((player.lv || 1) >= (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(player) : 100)) player.exp = 0;   // 滿等不留溢出經驗   /* 🔌 加掛版補丁 */"],
    ["js/05-kill-progression.js", "while ((a.lv || 1) < 100 && a.exp >= getExpReq(a.lv)) {",
      "while ((a.lv || 1) < (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(a) : 100) && a.exp >= getExpReq(a.lv)) {   /* 🔌 加掛版補丁 */"],
    ["js/05-kill-progression.js", "if ((a.lv || 1) >= 100) a.exp = 0;",
      "if ((a.lv || 1) >= (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(a) : 100)) a.exp = 0;   /* 🔌 加掛版補丁 */"],
    ['js/08-items-equip.js', "let pct = player.lv >= 100 ? 100 :",
      "let pct = player.lv >= (typeof window.__afkLvCap === 'function' ? window.__afkLvCap(player) : 100) ? 100 :   /* 🔌 加掛版補丁 */"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 等級上限錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 50)}`);
    s = s.replace(A, B); if (!CHECK) writeFileSync(FILE, s); any = true;
  }
  if (any) { changed++; console.log('[patch] 轉生等級上限 150'); } else already++;
}

// 27. 血盟城堡擴張（afk-castlewar.js）：①四座新城走舊制攻城流程 ②宣戰時強制在場上出敵對血盟 NPC
function patchCastleWar() {
  const edits = [
    ['js/30-siege-v2.js', "        if (LEGACY_CASTLES.has(city)) return old.startSiege ? old.startSiege(faction, city) : undefined;",
      "        if (LEGACY_CASTLES.has(city) || (global.__afkLegacyCastles && global.__afkLegacyCastles.has(city))) return old.startSiege ? old.startSiege(faction, city) : undefined;   /* 🔌 加掛版補丁:新城走舊制攻城 */"],
    ['js/03-combat-core.js', "    let _actualPlayerEncounter = mapState._trollSpawn && DB.mobs[mobId] && DB.mobs[mobId].trollPlayer;",
      "    if (typeof window.__afkForceTroll === 'function' && !_antharasDungeon) { try { let _ft = window.__afkForceTroll(idx, mobId); if (_ft && _ft.spawn && DB.mobs[_ft.mobId] && DB.mobs[_ft.mobId].trollPlayer) { mobId = _ft.mobId; mapState._trollSpawn = _ft.spawn; } } catch (e) {} }   /* 🔌 加掛版補丁:宣戰強制敵對 NPC */\n    let _actualPlayerEncounter = mapState._trollSpawn && DB.mobs[mobId] && DB.mobs[mobId].trollPlayer;"],
  ];
  let any = false;
  for (const [FILE, A, B] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes('/* 🔌 加掛版補丁:新城走舊制攻城 */') && FILE.includes('30-')) continue;
    if (s.includes('/* 🔌 加掛版補丁:宣戰強制敵對 NPC */') && FILE.includes('03-')) continue;
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 城堡擴張錨點應出現 1 次，實際 ${n} 次`);
    s = s.replace(A, B); if (!CHECK) writeFileSync(FILE, s); any = true;
  }
  if (any) { changed++; console.log('[patch] 血盟城堡擴張'); } else already++;
}

// 28. 登入／讀檔／創角畫面的逐幀動畫迴圈：進遊戲後不再每一幀空轉（afk-perf ⑦ 提供 __afkIdleRaf）
function patchIdleRaf() {
  const MARK = '/* 🔌 加掛版補丁:進遊戲後動畫迴圈降頻 */';
  const edits = [
    ['js/13-shop-save.js', "        requestAnimationFrame(tick);\n    }\n    requestAnimationFrame(tick);\n})();",
      "        (window.__afkIdleRaf || requestAnimationFrame)(tick);   " + MARK + "\n    }\n    requestAnimationFrame(tick);\n})();", 2],
    ['index.html', "          requestAnimationFrame(animateLogin);\n        }",
      "          (window.__afkIdleRaf || requestAnimationFrame)(animateLogin);   " + MARK + "\n        }", 1],
  ];
  let any = false;
  for (const [FILE, A, B, N] of edits) {
    let s = readFileSync(FILE, 'utf8');
    if (s.split(MARK).length - 1 >= N) continue;
    const n = s.split(A).length - 1;
    if (n !== N) throw new Error(`[${FILE}] 動畫迴圈錨點應出現 ${N} 次，實際 ${n} 次`);
    s = s.split(A).join(B); if (!CHECK) writeFileSync(FILE, s); any = true;
  }
  if (any) { changed++; console.log('[patch] 進遊戲後動畫迴圈降頻'); } else already++;
}

// 29. 轉生保留 HP／MP、技藝加的 HP／MP：直接在核心重算裡、夾 HP 之前加進上限（afk-rebirth／afk-arts 提供 __afkMaxAdd）
function patchMaxAdd() {
  const FILE = 'js/02-stats-recompute.js', MARK = '/* 🔌 加掛版補丁:上限加成在夾 HP 之前 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "    p.hp = Math.min(p.hp, p.mhp);\n    p.mp = Math.min(p.mp, p.mmp);\n}";
  const n = s.split(A).length - 1;
  if (n !== 1) throw new Error(`[${FILE}] 上限加成錨點應出現 1 次，實際 ${n} 次`);
  s = s.replace(A, "    if (typeof window.__afkMaxAdd === 'function') { try { window.__afkMaxAdd(p); } catch (e) {} }   " + MARK + "\n" + A);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 上限加成在夾 HP 之前');
}

// 30. 侵蝕安塔瑞斯改七階（afk-corrupt）：通關判定改認 window.__afkAntFinal（新的最終階名字）
function patchAntFinal() {
  const FILE = 'js/05-kill-progression.js', MARK = '/* 🔌 加掛版補丁:安塔瑞斯最終階 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const F = "(window.__afkAntFinal || '被侵蝕的瘋狂安塔瑞斯')";
  const edits = [
    ["mob.n === '被侵蝕的瘋狂安塔瑞斯' &&", "mob.n === " + F + " &&   " + MARK + "\n       "],
    ["    if (bossName === '被侵蝕的瘋狂安塔瑞斯') {", "    if (bossName === " + F + ") {   " + MARK],
    ["🏆 你擊敗了被侵蝕的瘋狂安塔瑞斯，淨化了巢穴！", "🏆 你擊敗了' + " + F + " + '，淨化了巢穴！"],
  ];
  for (const [A, B] of edits) {
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 安塔瑞斯最終階錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 40)}`);
    s = s.replace(A, B);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 安塔瑞斯最終階');
}

// 31. 抗性新制（afk-resist）：屬性抗性改查表（0＝受傷 +50%、500＝-80%，溢出到 +500 免疫）、百分比減傷上限 75%、無屬性抗性減物理傷害
//     插件沒載入時 window.__afkEleMult／__afkNoneRes 不存在，行為與原版完全相同
function patchEleRes() {
  const FILE = 'js/04-combat-attack.js', MARK = '/* 🔌 加掛版補丁:抗性新制 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const edits = [
    // 玩家受一般攻擊（帶屬性的怪）
    ["        if(mob.e === 'wind' && player.d.resWind) resFactor -= effResistPct(player.d.resWind)/100;\n\n        resFactor = Math.max(0, Math.min(1, resFactor));\n",
     "        if(mob.e === 'wind' && player.d.resWind) resFactor -= effResistPct(player.d.resWind)/100;\n\n        resFactor = Math.max(0, Math.min(1, resFactor));\n        if (window.__afkEleMult && mob.e && mob.e !== 'none') resFactor = window.__afkEleMult(player.d, mob.e, true);   " + MARK + "\n"],
    // 玩家：百分比減傷上限 75%
    ["          totalDmg = Math.max(0, Math.floor(totalDmg * _drMult)); }",
     "          if (window.__afkNoneRes) _drMult = Math.max(0.25, _drMult);   " + MARK + "\n          totalDmg = Math.max(0, Math.floor(totalDmg * _drMult)); }"],
    // 玩家：最後扣無屬性抗性
    ["        player.hp -= totalDmg;\n        if (isBasicAttack && totalDmg > 0) corrosiveJellySkinOnBasicHit(mob, player);",
     "        if (window.__afkNoneRes) totalDmg = window.__afkNoneRes(player.d, totalDmg);   " + MARK + "\n        player.hp -= totalDmg;\n        if (isBasicAttack && totalDmg > 0) corrosiveJellySkinOnBasicHit(mob, player);"],
    // 傭兵受一般攻擊
    ["    totalDmg = Math.floor(totalDmg * Math.max(0, Math.min(1, resFactor)));\n",
     "    totalDmg = Math.floor(totalDmg * ((window.__afkEleMult && mob.e && mob.e !== 'none') ? window.__afkEleMult(d, mob.e, true) : Math.max(0, Math.min(1, resFactor))));   " + MARK + "\n"],
    ["    ally.curHp -= totalDmg;\n    if (isBasicAttack && totalDmg > 0) corrosiveJellySkinOnBasicHit(mob, ally);",
     "    if (window.__afkNoneRes) totalDmg = window.__afkNoneRes(d, totalDmg);   " + MARK + "\n    ally.curHp -= totalDmg;\n    if (isBasicAttack && totalDmg > 0) corrosiveJellySkinOnBasicHit(mob, ally);"],
    // 傭兵受魔法
    ["        resF = Math.max(0, Math.min(1, resF));\n",
     "        resF = Math.max(0, Math.min(1, resF));\n        if (window.__afkEleMult && sk.ele && sk.ele !== 'none') resF = window.__afkEleMult(d, sk.ele, false);   " + MARK + "\n"],
    // 玩家受魔法
    ["        if((!sk.ele || sk.ele === 'none') && player.d.resNone) resFactor -= effResistPct(player.d.resNone)/100;",
     "        if((!sk.ele || sk.ele === 'none') && player.d.resNone) resFactor -= effResistPct(player.d.resNone)/100;\n        const __afkEleM = (window.__afkEleMult && sk.ele && sk.ele !== 'none') ? window.__afkEleMult(player.d, sk.ele, false) : null;   " + MARK],
    ["        resFactor = Math.max(0, Math.min(1, resFactor));\n        // 🏺 遺物 火熱愛意：免疫受到的火屬性傷害",
     "        resFactor = Math.max(0, Math.min(1, resFactor));\n        if (__afkEleM != null) resFactor = __afkEleM;   " + MARK + "\n        // 🏺 遺物 火熱愛意：免疫受到的火屬性傷害"],
  ];
  for (const [A, B] of edits) {
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 抗性新制錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 60)}`);
    s = s.replace(A, B);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 抗性新制');
}

// 32. 傭兵受一般攻擊：百分比減傷特效（鐵衛／化身／聖結界等／重擊減傷／祭祀陶罐）合計上限 75%（afk-resist 載入時才生效）
function patchAllyDrCap() {
  const FILE = 'js/04-combat-attack.js', MARK = '/* 🔌 加掛版補丁:傭兵減傷上限 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const edits = [
    ["    if (ally._setIron3) totalDmg = Math.floor(totalDmg * 0.8);",
     "    const __afkDr0 = totalDmg;   " + MARK + "\n    if (ally._setIron3) totalDmg = Math.floor(totalDmg * 0.8);"],
    ["ally._physDrCd = state.ticks + 30; }",
     "ally._physDrCd = state.ticks + 30; }\n    if (window.__afkNoneRes && __afkDr0 > 0) totalDmg = Math.max(totalDmg, Math.floor(__afkDr0 * 0.25));   " + MARK],
  ];
  for (const [A, B] of edits) {
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 傭兵減傷上限錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 60)}`);
    s = s.replace(A, B);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 傭兵減傷上限');
}

// 33. 傭兵受擊硬直：延後量改由 afk-hitstun 決定（最多行動間隔的 40%）；插件沒載入時照原本 d.hitstun
function patchAllyHitstun() {
  const FILE = 'js/04-combat-attack.js', MARK = '/* 🔌 加掛版補丁:傭兵硬直上限 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "ally._atkCd = (ally._atkCd || 0) + ((ally.d && ally.d.hitstun) || 0); ally._stunCycle = true; }";
  const B = "ally._atkCd = (ally._atkCd || 0) + (window.__afkHitstunFor ? window.__afkHitstunFor(ally) : ((ally.d && ally.d.hitstun) || 0)); ally._stunCycle = true; }   " + MARK;
  const n = s.split(A).length - 1;
  if (n !== 2) throw new Error(`[${FILE}] 傭兵硬直錨點應出現 2 次，實際 ${n} 次`);
  s = s.split(A).join(B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 傭兵硬直上限');
}

// 34. 新套裝（afk-sets）：在「套裝變身清除」之後呼叫 window.__afkSetLate(p, setCheck, d)，讓新套裝能給防禦／HP 等效果與套裝變身
function patchSetLate() {
  const FILE = 'js/02-stats-recompute.js', MARK = '/* 🔌 加掛版補丁:新套裝效果 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "    p._setPoly = null;   // 套裝變身僅在穿著時生效；每次重算先清除，卸下套裝即消失\n";
  const n = s.split(A).length - 1;
  if (n !== 1) throw new Error(`[${FILE}] 新套裝錨點應出現 1 次，實際 ${n} 次`);
  s = s.replace(A, A + "    if (typeof window.__afkSetLate === 'function') { try { window.__afkSetLate(p, setCheck, d); } catch (e) {} }   " + MARK + "\n");
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 新套裝效果');
}

// 35. 遺物強化特效（afk-relicfx）：一般攻擊扣血前後的掛點（玩家＋傭兵），以及連射箭數／每箭傷害可由武器指定
function patchRelicFx() {
  const MARK = '/* 🔌 加掛版補丁:遺物強化特效 */';
  const edits = [
    ['js/04-combat-attack.js', "        target.curHp -= result.dmg;\n",
     "        if (window.__afkRelicDmg) result.dmg = window.__afkRelicDmg(player, target, result.dmg, wpn);   " + MARK + "\n        target.curHp -= result.dmg;\n        if (window.__afkRelicHit) window.__afkRelicHit(player, target, result.dmg, wpn);   " + MARK + "\n"],
    ['js/06-status-allies.js', "        t.curHp -= dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn, ally);",
     "        if (window.__afkRelicDmg) dmg = window.__afkRelicDmg(ally, t, dmg, wpn);   " + MARK + "\n        t.curHp -= dmg; if (window.__afkRelicHit) window.__afkRelicHit(ally, t, dmg, wpn); t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn, ally);"],
    ['js/03-combat-core.js', "    let _rfN = wpn.rapidMax ? _rfMax : roll(1, _rfMax);",
     "    let _rfN = wpn.rapidCount ? (wpn.rapidFixed ? wpn.rapidCount : roll(1, Math.max(_rfMax, wpn.rapidCount))) : (wpn.rapidMax ? _rfMax : roll(1, _rfMax));   " + MARK],
    ['js/03-combat-core.js', "        let _rfMult = player._setGale5 ? (hasMastery('e_rapid') ? 1.00 : 0.80) : (hasMastery('e_rapid') ? 0.50 : 0.30);",
     "        let _rfMult = player._setGale5 ? (hasMastery('e_rapid') ? 1.00 : 0.80) : (hasMastery('e_rapid') ? 0.50 : 0.30);\n        if (wpn.rapidArrowPct) _rfMult = Math.max(_rfMult, wpn.rapidArrowPct / 100);   " + MARK],
    ['js/06-status-allies.js', "    let n = (wpn && wpn.rapidMax) ? _allyRfMax : roll(1, _allyRfMax);",
     "    let n = (wpn && wpn.rapidCount) ? (wpn.rapidFixed ? wpn.rapidCount : roll(1, Math.max(_allyRfMax, wpn.rapidCount))) : ((wpn && wpn.rapidMax) ? _allyRfMax : roll(1, _allyRfMax));   " + MARK],
    ['js/06-status-allies.js', "    let _rfMult = ally._setGale5 ? (_allyRapid ? 1.00 : 0.80) : (_allyRapid ? 0.50 : 0.30);",
     "    let _rfMult = ally._setGale5 ? (_allyRapid ? 1.00 : 0.80) : (_allyRapid ? 0.50 : 0.30);\n    if (wpn && wpn.rapidArrowPct) _rfMult = Math.max(_rfMult, wpn.rapidArrowPct / 100);   " + MARK],
  ];
  let any = false;
  const files = {};
  for (const [FILE, A, B] of edits) {
    let s = files[FILE] != null ? files[FILE] : readFileSync(FILE, 'utf8');
    // The complete runtime extends this exact hook with result metadata and
    // moves its post-hit event after reflection. Recognize that replacement
    // without inserting the old pre-reflection hook a second time.
    if (A.includes('target.curHp -= result.dmg') && s.includes('/* relic-runtime:main-result-context */') && s.includes('window.__afkRelicDmg(player, target, result.dmg, wpn, result)') && s.includes('window.__afkRelicHit(player,target,result.dmg,wpn)')) { files[FILE]=s; continue; }
    if (A.includes('t.curHp -= dmg; t.justHit') && s.includes('/* relic-runtime:ally-result-context */') && s.includes('window.__afkRelicDmg(ally, t, dmg, wpn,') && s.includes('window.__afkRelicHit(ally,t,dmg,wpn)')) { files[FILE]=s; continue; }
    if (s.includes(B)) { files[FILE] = s; continue; }
    const n = s.split(A).length - 1;
    if (n !== 1) throw new Error(`[${FILE}] 遺物強化特效錨點應出現 1 次，實際 ${n} 次：${A.slice(0, 60)}`);
    s = s.replace(A, B); files[FILE] = s; any = true;
  }
  if (any) { if (!CHECK) for (const f in files) writeFileSync(f, files[f]); changed++; console.log('[patch] 遺物強化特效'); } else already++;
}

// 36. 傑克的彈弓 昇華支配 +5：連射每箭改為真實傷害（不吃防禦；以武器傷害＋遠距離傷害計）
function patchRapidTrue() {
  const FILE = 'js/03-combat-core.js', MARK = '/* 🔌 加掛版補丁:連射真實傷害 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "        let _rfDmg = Math.max(1, Math.floor(_res.dmg * _rfMult));\n";
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 連射真實傷害錨點應出現 1 次`);
  s = s.replace(A, A + "        if (wpn.rapidTrue) _rfDmg = Math.max(_rfDmg, Math.floor(((_t.s === 'L' ? wpn.dmgL : wpn.dmgS) + (wpn.dmgBonus || 0) + ((player.d && player.d.rangedDmg) || 0)) * _rfMult));   " + MARK + "\n");
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 連射真實傷害');
}

// 44. 頭目每 5 秒的 HP 自然恢復：帶 _noBossRegen 的頭目不回血（暗夢星迴・星迴試煉，玩家 2026-10-24）
function patchNoBossRegen() {
  const FILE = 'js/03-combat-core.js', MARK = '/* 🔌 加掛版補丁:頭目不回血旗標 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "        if (m.boss && !m.siegeEnemy && m.race !== '建築' && state.ticks % 50 === 0 && m.curHp > 0 && m.curHp < m.hp) {";
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 頭目回血錨點應出現 1 次`);
  s = s.replace(A, "        if (m.boss && !m.siegeEnemy && !m._noBossRegen && m.race !== '建築' && state.ticks % 50 === 0 && m.curHp > 0 && m.curHp < m.hp) {   " + MARK);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 頭目不回血旗標');
}


// 45. 裝備變身：穿著指定裝備時變身（天堂透視鏡的變身帽、披風、項鍊；玩家 2026-10-26）
function patchEquipPoly() {
  const FILE = 'js/02-stats-recompute.js', MARK = '/* 🔌 加掛版補丁:裝備變身 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "\n    // ===== 🔮 席琳套裝效果：";
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 裝備變身錨點應出現 1 次`);
  s = s.replace(A, "\n    if (!p._setPoly && typeof window.__afkEquipPoly === 'function') { try { window.__afkEquipPoly(p); } catch (e) {} }   " + MARK + A);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 裝備變身');
}


// 46. 受到的傷害：小數連乘、最後才取整；扣血前提供受傷掛點 window.__afkTaken（玩家 2026-10-26 審查建議 6、7）
//   四條路徑：玩家受物理、傭兵受物理、傭兵受魔法、玩家受魔法。
//   ‧倍率一律小數連乘（原本每乘一次就 floor，約 10 次 floor），到魔法娃娃減免之前才 floor 一次
//   ‧在遺物 incoming 之前呼叫 window.__afkTaken(對象, 傷害, 怪物, 'phys'|'magic') 回傳新的傷害（技藝減傷、最終減傷、龍的傷痕、席琳模式）
function patchTakenHook() {
  const FILE = 'js/04-combat-attack.js', MARK = '/* 🔌 加掛版補丁:受傷掛點 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const SEGS = [
    { start: 'function enemyPhysicalAttack(', end: '        totalDmg = dollDamageReduced(totalDmg);', v: 'totalDmg', relic: "        if (window.AFK_RELIC_RUNTIME) totalDmg = window.AFK_RELIC_RUNTIME.incoming(player,totalDmg,mob,{kind:'melee'", who: 'player', kind: 'phys' },
    { start: 'function enemyAttackAlly(', end: '    totalDmg = allyDollDamageReduced(ally, totalDmg);', v: 'totalDmg', relic: "    if (window.AFK_RELIC_RUNTIME) totalDmg = window.AFK_RELIC_RUNTIME.incoming(ally,totalDmg,mob,{kind:'melee'", who: 'ally', kind: 'phys' },
    { start: 'function applyMobMagicToAlly(', end: '        dmg = allyDollDamageReduced(ally, dmg);', v: 'dmg', relic: "        if (window.AFK_RELIC_RUNTIME) dmg = window.AFK_RELIC_RUNTIME.incoming(ally,dmg,mob,{kind:'magic'", who: 'ally', kind: 'magic' },
    { start: 'function applyMobMagic(', end: '        dmg = dollDamageReduced(dmg);', v: 'dmg', relic: "        if (window.AFK_RELIC_RUNTIME) dmg = window.AFK_RELIC_RUNTIME.incoming(player,dmg,mob,{kind:'magic'", who: 'player', kind: 'magic' }
  ];
  for (const g of SEGS) {
    const a = s.indexOf(g.start); if (a < 0) throw new Error(`[${FILE}] 找不到 ${g.start}`);
    const b = s.indexOf(g.end, a); if (b < 0) throw new Error(`[${FILE}] ${g.start} 之後找不到 ${g.end.trim()}`);
    let seg = s.slice(a, b);
    const n0 = seg.length;
    seg = seg.split('Math.floor(' + g.v + ' * ').join('(' + g.v + ' * ')
             .split('Math.floor(Math.max(1, ' + g.v + ') * ').join('(Math.max(1, ' + g.v + ') * ')
             .split('Math.floor(Math.floor((baseMagicDmg + extraMagicDmg) * resFactor) * mrFactor)').join('((baseMagicDmg + extraMagicDmg) * resFactor * mrFactor)')
             .split('Math.floor(Math.floor((baseM + extra) * resF) * mrMult(mr))').join('((baseM + extra) * resF * mrMult(mr))')
             .split('blockReduced = _before - totalDmg;').join('blockReduced = Math.round(_before - totalDmg);');
    if (seg.includes('Math.floor(' + g.v + ' *')) throw new Error(`[${FILE}] ${g.start} 還有沒換掉的 floor`);
    s = s.slice(0, a) + seg + '        ' + g.v + ' = Math.floor(' + g.v + ');   ' + MARK + '\n' + s.slice(b);
    const r = s.indexOf(g.relic); if (r < 0 || s.indexOf(g.relic, r + 1) >= 0) throw new Error(`[${FILE}] 遺物 incoming 錨點（${g.who}/${g.kind}）應出現 1 次`);
    const ind = g.relic.match(/^\s*/)[0];
    s = s.slice(0, r) + ind + 'if (typeof window.__afkTaken === \'function\') ' + g.v + ' = window.__afkTaken(' + g.who + ', ' + g.v + ', mob, \'' + g.kind + '\');   ' + MARK + '\n' + s.slice(r);
  }
  s = '/* 🔌 加掛版補丁:受傷掛點 */ window.__afkTakenPatched = true;\n' + s;
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 受傷掛點＋小數連乘');
}

// 47. NPC 血盟數量 20 → 30（玩家 2026-10-26：敵對血盟增加到 30 個）
function patchNpcClanCount() {
  const FILE = 'js/25-clan-system.js', MARK = '/* 🔌 加掛版補丁:NPC血盟30 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = 'const NPC_CLAN_WORLD_COUNT = 20;';
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] NPC 血盟數量錨點應出現 1 次`);
  s = s.replace(A, 'const NPC_CLAN_WORLD_COUNT = 30;   ' + MARK);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] NPC 血盟 30 個');
}

// 48. 負面效果一律計算抵抗（玩家 2026-10-26：直接寫入怪物狀態、沒經過 applyMobStatus 的來源也要判定）
//     玩家端用 abnormalMagicHit（魔法命中 vs 魔防），傭兵端用 allyAbnormalMagicHit。
function patchDebuffResist() {
  const MARK = '/* 🔌 加掛版補丁:負面效果抵抗 */';
  const R = (t) => "(typeof abnormalMagicHit !== 'function' || abnormalMagicHit(" + t + "))";
  const RA = (t) => "(typeof allyAbnormalMagicHit !== 'function' || allyAbnormalMagicHit(ally, " + t + "))";
  const edits = {
    'js/04-combat-attack.js': [
      ['if (wpn && wpn.procPoisonPct && target.curHp > 0 && result.dmg > 0) {', 'if (wpn && wpn.procPoisonPct && target.curHp > 0 && result.dmg > 0 && ' + R('target') + ') { ' + MARK],
      ["if (player.buffs && player.buffs.sk_dark_poison > 0 && target.curHp > 0 && Math.random() < (hasMastery('d_poison') ? 1 : 0.5)) {", "if (player.buffs && player.buffs.sk_dark_poison > 0 && target.curHp > 0 && Math.random() < (hasMastery('d_poison') ? 1 : 0.5) && " + R('target') + ") { " + MARK],
      ['    let _pd = Math.max(1, Math.floor(roll(pp.dmg[0], pp.dmg[1])', '    if (!' + R('t') + ') return;   ' + MARK + '\n    let _pd = Math.max(1, Math.floor(roll(pp.dmg[0], pp.dmg[1])'],
    ],
    'js/06-status-allies.js': [
      ['    let firstApply = !(target.st.shatter > 0);', '    if (!(owner === player ? ' + R('target') + ' : (typeof allyAbnormalMagicHit !== \'function\' || allyAbnormalMagicHit(owner, target)))) return false;   ' + MARK + '\n    let firstApply = !(target.st.shatter > 0);'],
      ['if (wpn && wpn.procPoisonPct && t.curHp > 0 && dmg > 0) {', 'if (wpn && wpn.procPoisonPct && t.curHp > 0 && dmg > 0 && ' + RA('t') + ') { ' + MARK],
      ["if (ally.cls === 'dark' && ally.skills && ally.skills.includes('sk_dark_poison') && t.curHp > 0 && Math.random() < (allyHasMastery(ally, 'd_poison') ? 1 : 0.5)) {", "if (ally.cls === 'dark' && ally.skills && ally.skills.includes('sk_dark_poison') && t.curHp > 0 && Math.random() < (allyHasMastery(ally, 'd_poison') ? 1 : 0.5) && " + RA('t') + ") { " + MARK],
      ['    if (Math.random() < fs.chance) {\n        if (!t.st) t.st = newMobStatus();\n        t.st[fs.kind] = (fs.dur || 16) * 10;', '    if (Math.random() < fs.chance && ' + RA('t') + ') { ' + MARK + '\n        if (!t.st) t.st = newMobStatus();\n        t.st[fs.kind] = (fs.dur || 16) * 10;'],
    ],
    'js/07-skills-cast.js': [
      ['            if (Math.random() < fs.chance) {\n                if (!t.st) t.st = newMobStatus();\n                t.st[fs.kind] = (fs.dur || 16) * 10;', '            if (Math.random() < fs.chance && ' + R('t') + ') { ' + MARK + '\n                if (!t.st) t.st = newMobStatus();\n                t.st[fs.kind] = (fs.dur || 16) * 10;'],
      ['Math.random() * 100 < _wfW.waterFreezeProc.pct) {', 'Math.random() * 100 < _wfW.waterFreezeProc.pct && ' + R('t') + ') { ' + MARK],
    ],
    'js/22-pets.js': [
      ['Math.random() * 100 < sk.freezeCh && ', 'Math.random() * 100 < sk.freezeCh && ' + R('m') + ' /* 🔌 加掛版補丁:負面效果抵抗 */ && '],
    ],
    'js/23-summons.js': [
      ["            if (pr.kind === 'poison') {   // 單體中毒", "            if (pr.kind === 'poison' && !" + R('t') + ") { " + MARK + " } else if (pr.kind === 'poison') {   // 單體中毒"],
      ['all.forEach(m => { m.st = m.st || newMobStatus(); m.st.poison = 150;', 'all.filter(m => ' + R('m') + ').forEach(m => { ' + MARK + ' m.st = m.st || newMobStatus(); m.st.poison = 150;'],
    ],
  };
  for (const FILE of Object.keys(edits)) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(MARK)) { already++; continue; }
    for (const [a, b] of edits[FILE]) {
      const n = s.split(a).length - 1;
      if (n !== 1) throw new Error(`[${FILE}] 負面效果抵抗錨點應出現 1 次（實際 ${n}）：${a.slice(0, 60)}`);
      s = s.replace(a, b);
    }
    if (!CHECK) writeFileSync(FILE, s);
    changed++; console.log('[patch] 負面效果抵抗 ' + FILE);
  }
}

// 49. 幻術師幻覺（歐吉／巫妖／鑽石高崙）：基礎傷害加上額外魔法點數（魔法傷害原本就有），近戰幻象改成也吃魔抗（玩家 2026-10-26 三）
function patchPolyPickOverride() {
  const FILE = 'js/02-stats-recompute.js', MARK = '/* 🔌 加掛版補丁:指定變身優先 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = '    if(window.AFK_RELIC_GM) window.AFK_RELIC_GM.mergeForms(p);';
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 指定變身錨點應出現 1 次`);
  s = s.replace(A, "    if (typeof window.__afkPolyOverride === 'function') { try { if (window.__afkPolyOverride(p)) p._setPoly = null; } catch (e) {} }   " + MARK + "\n" + A);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 指定變身優先於裝備變身');
}

function patchIllusionDamage() {
  const FILE = 'js/07-skills-cast.js', MARK = '/* 🔌 加掛版補丁:幻覺吃魔傷魔點 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = 'let baseRoll = roll(c.dice[0], c.dice[1]) + Math.floor((d.int || 0) / 5) * (1 + owner.lv / c.div);';
  const B = 'dmg = Math.max(1, Math.floor(base) - (t.dr || 0));';
  for (const x of [A, B]) if (s.split(x).length - 1 !== 1) throw new Error(`[${FILE}] 幻覺錨點應出現 1 次：${x.slice(0, 40)}`);
  s = s.replace(A, 'let baseRoll = roll(c.dice[0], c.dice[1]) + Math.floor((d.int || 0) / 5) * (1 + owner.lv / c.div) + Math.max(0, Number(d.extraMp) || 0);   ' + MARK);
  s = s.replace(B, "{ let _ieMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr; if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) _ieMr -= 10; dmg = Math.max(1, Math.floor(base * mrMult(Math.max(0, _ieMr)))); }   " + MARK);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 幻覺吃魔傷魔點');
}

function patchClassicDarkWeapons() {
  const MARK = '/* 🔌 加掛版補丁:經典三部曲黑妖武器 */';
  const G = "(typeof window.__afkClassicDE === 'function' && window.__afkClassicDE())";
  const jobs = [
    ['js/03-combat-core.js', "if (_natRoll && !heavy && !graze && !player.classicMode && getWeaponTags(_swingId).includes('鋼爪')", "if (_natRoll && !heavy && !graze && (!player.classicMode || " + G + ") && getWeaponTags(_swingId).includes('鋼爪')"],
    ['js/03-combat-core.js', "if (_natRoll && !graze && !player.classicMode && getWeaponTags(_swingId).includes('雙刀')", "if (_natRoll && !graze && (!player.classicMode || " + G + ") && getWeaponTags(_swingId).includes('雙刀')"],
    ['js/06-status-allies.js', "if (!heavy && !_grazeA && !ally.classicMode && ally.eq && ally.eq.wpn && getWeaponTags(ally.eq.wpn.id).includes('鋼爪')", "if (!heavy && !_grazeA && (!ally.classicMode || " + G + ") && ally.eq && ally.eq.wpn && getWeaponTags(ally.eq.wpn.id).includes('鋼爪')"],
    ['js/06-status-allies.js', "if (!_grazeA && !ally.classicMode && ally.eq && ally.eq.wpn && getWeaponTags(ally.eq.wpn.id).includes('雙刀')", "if (!_grazeA && (!ally.classicMode || " + G + ") && ally.eq && ally.eq.wpn && getWeaponTags(ally.eq.wpn.id).includes('雙刀')"],
  ];
  const files = {};
  for (const [f] of jobs) files[f] = files[f] || readFileSync(f, 'utf8');
  if (Object.values(files).every(s => s.includes(MARK))) { already++; return; }
  for (const [f, a, b] of jobs) {
    if (files[f].split(a).length - 1 !== 1) throw new Error(`[${f}] 黑妖武器錨點應出現 1 次：${a.slice(0, 50)}`);
    const i = files[f].indexOf(a), eol = files[f].indexOf('\n', i);
    files[f] = files[f].slice(0, i) + b + files[f].slice(i + a.length, eol) + '   ' + MARK + files[f].slice(eol);
  }
  if (!CHECK) for (const f in files) writeFileSync(f, files[f]);
  changed++; console.log('[patch] 經典三部曲：鋼爪爆擊、雙刀雙擊');
}

function patchClassicOrigin() {
  const MARK = '/* 🔌 加掛版補丁:經典原版經驗死亡掉落 */';
  const jobs = [
    ['js/04-combat-attack.js',
     "        let _lossCap = Math.floor((getExpReq(player.lv) || 0) * 0.05);\n        let _before = player.exp;\n        player.exp = Math.max(0, player.exp - _lossCap);\n        let _actualLoss = _before - player.exp;",
     "        let _actualLoss;   " + MARK + "\n        if (typeof window.__afkClassicDeath === 'function') _actualLoss = window.__afkClassicDeath(player);\n        else { let _lossCap = Math.floor((getExpReq(player.lv) || 0) * 0.05); let _before = player.exp; player.exp = Math.max(0, player.exp - _lossCap); _actualLoss = _before - player.exp; }"],
    ['js/05-kill-progression.js', "let _goldDropRate = mob.boss ? 1 : 0.7;",
     "let _goldDropRate = mob.boss ? 1 : ((typeof window.__afkGoldRate === 'function') ? window.__afkGoldRate(mob) : 0.7);   " + MARK],
    ['js/05-kill-progression.js', "    player.exp += _playerExpGain;\n",
     "    if (typeof window.__afkExpShare === 'function') _playerExpGain = Math.floor(_playerExpGain * window.__afkExpShare(player));   " + MARK + "\n    player.exp += _playerExpGain;\n"],
    ['js/05-kill-progression.js', "let _gain = Math.floor(_expEach * getExpGainMult(a.lv || 1));",
     "let _gain = Math.floor(_expEach * getExpGainMult(a.lv || 1) * (typeof window.__afkExpShare === 'function' ? window.__afkExpShare(a) : 1));   " + MARK],
  ];
  const files = {};
  for (const [f] of jobs) files[f] = files[f] || readFileSync(f, 'utf8');
  const W11 = 'js/11-world-map.js'; files[W11] = readFileSync(W11, 'utf8');
  if (Object.values(files).every(x => x.includes(MARK))) { already++; return; }
  for (const [f, a, b] of jobs) {
    if (files[f].split(a).length - 1 !== 1) throw new Error(`[${f}] 經典原版錨點應出現 1 次：${a.slice(0, 50)}`);
    files[f] = files[f].replace(a, b);
  }
  const C = 'let cost = (r.lv || 1) * (r.lv || 1) * 1000;';
  if (files[W11].split(C).length - 1 !== 2) throw new Error(`[${W11}] 買回經驗費用錨點應出現 2 次`);
  files[W11] = files[W11].split(C).join("let cost = (typeof window.__afkBuybackCost === 'function') ? window.__afkBuybackCost(r) : (r.lv || 1) * (r.lv || 1) * 1000;   " + MARK);
  if (!CHECK) for (const f in files) writeFileSync(f, files[f]);
  changed++; console.log('[patch] 經典原版：死亡經驗、掉錢率、組隊分配、買回費用');
}

function patchClassicOwnStats() {
  const FILE = 'js/02-stats-recompute.js', MARK = '/* 🔌 加掛版補丁:經典能力值壓縮 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = '    d.cha = (b.cha || 0) + (a.cha || 0) + (pn.cha||0);';
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 經典能力值錨點應出現 1 次`);
  const i = s.indexOf(A), eol = s.indexOf('\n', i);
  s = s.slice(0, eol) + "\n    if (typeof window.__afkOwnStats === 'function') { try { window.__afkOwnStats(p, d); } catch (e) {} }   " + MARK + s.slice(eol);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 經典能力值壓縮掛點');
}

// ── 補丁：裝備分頁的「副手武器」列不只限戰士（轉生後任何職業都能雙持；玩家 2026-10-27：副手顯示空白、看不到左右手各拿什麼）──
function patchOffwpnRow() {
  const FILE = 'js/10-ui-tabs.js', MARK = '/* 🔌 加掛版補丁:副手武器列 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const A = "...((player.cls === 'warrior' && (player.skills.includes('sk_warrior_dualaxe') || player.eq.offwpn)) ? [{k:'offwpn',n:'副手武器'}] : [])";
  if (s.split(A).length - 1 !== 1) throw new Error(`[${FILE}] 副手武器列錨點應出現 1 次`);
  const B = "...(((player.cls === 'warrior' && player.skills.includes('sk_warrior_dualaxe')) || player.eq.offwpn || (typeof dualWieldOffhandOk === 'function' && dualWieldOffhandOk())) ? [{k:'offwpn',n:'副手武器'}] : []) " + MARK;
  s = s.replace(A, B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 裝備分頁副手武器列');
}

// ── 補丁：迴避率上限 80%（玩家 2026-10-27）：玩家、傭兵、寵物的迴避判定與面板顯示都夾在 window.__afkEvadeCap（預設 80）──
function patchEvadeCap() {
  const MARK = '/* 🔌 加掛版補丁:迴避上限 */';
  const EDITS = [
    ['js/04-combat-attack.js', "roll(1, 100) <= effResistPct(player.d.er + _titanEr)", "roll(1, 100) <= Math.min(window.__afkEvadeCap || 100, effResistPct(player.d.er + _titanEr)) " + MARK],
    ['js/04-combat-attack.js', "roll(1, 100) <= effResistPct((d.er || 0) + _titanEr + _evStack)", "roll(1, 100) <= Math.min(window.__afkEvadeCap || 100, effResistPct((d.er || 0) + _titanEr + _evStack)) " + MARK],
    ['js/22-pets.js', "if (roll(1, 100) <= effResistPct(d.er))", "if (roll(1, 100) <= Math.min(window.__afkEvadeCap || 100, effResistPct(d.er)) " + MARK + ")"],
    ['js/08-items-equip.js', "document.getElementById('dt-er').innerText = `${effResistPct(player.d.er)}%`;", "document.getElementById('dt-er').innerText = `${Math.min(window.__afkEvadeCap || 100, effResistPct(player.d.er))}%`; " + MARK]
  ];
  const files = {};
  for (const [f] of EDITS) if (!files[f]) files[f] = readFileSync(f, 'utf8');
  let done = 0;
  for (const [f, a, b] of EDITS) {
    if (files[f].includes(b)) { done++; continue; }
    if (files[f].split(a).length - 1 !== 1) throw new Error(`[${f}] 迴避上限錨點應出現 1 次：${a}`);
    files[f] = files[f].replace(a, b);
  }
  if (done === EDITS.length) { already++; return; }
  if (!CHECK) for (const f in files) writeFileSync(f, files[f]);
  changed++; console.log('[patch] 迴避率上限');
}

// ── 補丁：回全隊 MP（立方：和諧等）不再把寵物 MP 砍回基礎上限（玩家 2026-10-27：開場寵物 MP 瞬間掉光）──
//   寵物的有效 MP 上限＝基礎 mmp＋防具精神加成（mmpBonus，可到好幾千）；teamRecoverMp 只夾基礎 mmp，
//   幻術士傭兵的「立方：和諧」一跳就把 6,000 多的 MP 夾回 400 多。改成夾有效上限，而且回魔永遠不會讓 MP 變少。
function patchPetMpCap() {
  const FILE = 'js/06-status-allies.js', MARK = '/* 🔌 加掛版補丁:回魔不砍寵物MP */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const EDITS = [
    ["if (player) player.mp = Math.min(player.mmp || 0, (player.mp || 0) + amount);", "if (player) player.mp = Math.max(player.mp || 0, Math.min(player.mmp || 0, (player.mp || 0) + amount)); " + MARK],
    ["if (a && !a._downed) a.mp = Math.min(a.mmp || 0, (a.mp || 0) + amount); });", "if (a && !a._downed) a.mp = Math.max(a.mp || 0, Math.min(a.mmp || 0, (a.mp || 0) + amount)); });"],
    ["if (p && !p._downed && p.mmp != null) p.mp = Math.min(p.mmp || 0, (p.mp || 0) + amount); });", "if (p && !p._downed && p.mmp != null) { let _pm = (p.mmp || 0) + (((typeof petDerive === 'function' && petDerive(p)) || {}).mmpBonus || 0); p.mp = Math.max(p.mp || 0, Math.min(_pm, (p.mp || 0) + amount)); } });"]
  ];
  for (const [a, b] of EDITS) {
    if (s.split(a).length - 1 !== 1) throw new Error(`[${FILE}] 回魔錨點應出現 1 次：${a}`);
    s = s.replace(a, b);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 回全隊 MP 不砍寵物 MP');
}

// ── 補丁：收購 NPC（遊走的玩家收購者）不出現在城堡裡（玩家 2026-10-27）──
//   原本只排除肯特／風木／海音三城；外掛新增的奇岩城、妖魔堡、侏儒城、亞丁城（id 結尾 _castle）一律排除，已經站在城裡的也不顯示
function patchNoCastleBuyers() {
  const FILE = 'js/24-pandora-relic-market.js', MARK = '/* 🔌 加掛版補丁:城堡無收購 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const EDITS = [
    ["if (!t || EXCLUDED_TOWNS.has(id)) return false;", "if (!t || EXCLUDED_TOWNS.has(id) || /_castle$/.test(id)) return false; " + MARK],
    [".filter(w => w && w.townId === townId && _wandererPresent(w))", ".filter(w => w && w.townId === townId && !/_castle$/.test(String(townId)) && _wandererPresent(w))"]
  ];
  for (const [a, b] of EDITS) {
    if (s.split(a).length - 1 !== 1) throw new Error(`[${FILE}] 城堡收購錨點應出現 1 次：${a}`);
    s = s.replace(a, b);
  }
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 城堡不出現收購 NPC');
}

// 64. 倉庫上限 5000 → 20000（玩家 2026-10-28）
function patchWhMax() {
  const FILE = 'js/12-npc-quests.js', MARK = '/* 🔌 加掛版補丁:倉庫兩萬格 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const a = 'const WH_MAX = 5000;';
  if (s.split(a).length - 1 !== 1) throw new Error(`[${FILE}] 倉庫上限錨點應出現 1 次`);
  s = s.replace(a, 'const WH_MAX = 20000; ' + MARK);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 倉庫上限 20000');
}

// 65. 裝備視窗第二頁加「之魂」遺骸格（玩家 2026-10-28 晚；afk-sherine-dream）
function patchSoulSlot() {
  const FILE = 'js/19-equipment-window.js', MARK = '/* 🔌 加掛版補丁:之魂 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(MARK)) { already++; return; }
  const a = "{ k: 'rem_eye',   x: 50.0, y: 15.81, w: 19.67, h: 8.82 },";
  if (s.split(a).length - 1 !== 1) throw new Error(`[${FILE}] 之魂錨點應出現 1 次`);
  s = s.replace(a, a + "\n            { k: 'rem_soul',  x: 80.1, y: 15.81, w: 19.67, h: 8.82 }, " + MARK);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 裝備視窗之魂格');
}

// 66. 命中率上限 80%（判定值最多 15：2～15＋19 擦傷＋20 重擊＝16/20）＋爆擊記錄給濺射用（玩家 2026-10-29）
function patchHitCapCrit() {
  const TAG = '/* 🔌 加掛版補丁:命中上限 */', HV = 'Math.min(window.__afkHitHv || 20, ';
  const EDITS = [
    ['js/03-combat-core.js', "if (player.buffs && player.buffs.sk_warrior_outlaw > 0) hitValue = Math.max(hitValue, 10);", "if (player.buffs && player.buffs.sk_warrior_outlaw > 0) hitValue = Math.max(hitValue, 10); hitValue = Math.min(hitValue, window.__afkHitHv || 20); " + TAG, 1],
    ['js/06-status-allies.js', "if (ally.buffs && ally.buffs.sk_warrior_outlaw > 0) hv = Math.max(hv, 10);", "if (ally.buffs && ally.buffs.sk_warrior_outlaw > 0) hv = Math.max(hv, 10); hv = Math.min(hv, window.__afkHitHv || 20); " + TAG, 2],
    ['js/22-pets.js', "let hv = stretchHitValue(rawHit);", "let hv = " + HV + "stretchHitValue(rawHit)); " + TAG, 1],
    ['js/23-summons.js', "const hv = stretchHitValue(d.hit + _sgb.hit + (_ia ? _ia.eh : 0) - t.lv + mobEffAC(t));", "const hv = " + HV + "stretchHitValue(d.hit + _sgb.hit + (_ia ? _ia.eh : 0) - t.lv + mobEffAC(t))); " + TAG, 1],
    ['js/07-skills-cast.js', "    return stretchHitValue(raw);", "    return " + HV + "stretchHitValue(raw)); " + TAG, 1],
    ['js/31-castle-guards.js', "let hv = stretchHitValue(d.hit + (_ia ? (_ia.eh || 0) : 0) - t.lv + mobEffAC(t));", "let hv = " + HV + "stretchHitValue(d.hit + (_ia ? (_ia.eh || 0) : 0) - t.lv + mobEffAC(t))); " + TAG, 1],
    ['js/03-combat-core.js', "let critMult = isCrit ? (1 + critDmg / 100) : 1;", "let critMult = isCrit ? (1 + critDmg / 100) : 1; if (isCrit && !probe && target) player._afkCrit = { t: target, at: state.ticks, r: !!isRanged }; " + TAG, 1],
    ['js/06-status-allies.js', "let critMult = isCrit ? (1 + critD/100) : 1;", "let critMult = isCrit ? (1 + critD/100) : 1; if (isCrit && t) ally._afkCrit = { t: t, at: state.ticks }; " + TAG, 2]
  ];
  const files = {};
  for (const [f] of EDITS) if (!files[f]) files[f] = readFileSync(f, 'utf8');
  let done = 0;
  for (const [f, a, b, n] of EDITS) {
    if (files[f].includes(b)) { done++; continue; }
    if (files[f].split(a).length - 1 !== n) throw new Error(`[${f}] 命中上限錨點應出現 ${n} 次：${a}`);
    files[f] = files[f].split(a).join(b);
  }
  if (done === EDITS.length) { already++; return; }
  if (!CHECK) for (const f in files) writeFileSync(f, files[f]);
  changed++; console.log('[patch] 命中率上限＋爆擊記錄');
}

// 67. 時空裂痕掉落掛點（玩家 2026-10-29 晚）：怪物專屬掉落表每一項先問 window.__afkRiftDrop(物品, 機率%, 怪)；
//     回傳數字＝改用這個機率%（不吃任何加倍），回傳 null／undefined＝照原本算
function patchRiftDrop() {
  const FILE = 'js/05-kill-progression.js', TAG = '/* 🔌 加掛版補丁:時空裂痕掉落 */';
  const A = "        if(Math.random() < partyDropRate((ratePct * _dropBase * _clMult * _relicX2) / 100)) gainItem(itemId, 1);";
  const B = "        { let _rr = (typeof window.__afkRiftDrop === 'function') ? window.__afkRiftDrop(itemId, ratePct, mob) : null; if (_rr != null) { if (_rr > 0 && Math.random() < _rr / 100) gainItem(itemId, 1); return; } } " + TAG + "\n" + A;
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(TAG)) { already++; return; }
  if (s.split(A).length - 1 !== 1) throw new Error('[時空裂痕掉落] 錨點應出現 1 次');
  s = s.replace(A, B);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 時空裂痕掉落掛點');
}

// 68. 掉落種類上限（玩家 2026-10-29：一般怪隨機 1～3 種、王 3～5 種，必掉的不算）：怪物掉落表先收集，再交給 window.__afkDropCap 決定要給哪些
function patchDropCap() {
  const FILE = 'js/05-kill-progression.js', TAG = '/* 🔌 加掛版補丁:掉落種類上限 */';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes(TAG)) { already++; return; }
  const A1 = "    dropList.forEach(entry => {";
  const B1 = "    let _afkDropBag = (typeof window.__afkDropCap === 'function') ? [] : null; " + TAG + "\n" + A1;
  const A2 = "if (_rr > 0 && Math.random() < _rr / 100) gainItem(itemId, 1); return; }";
  const B2 = "if (_rr > 0 && Math.random() < _rr / 100) { if (_afkDropBag) _afkDropBag.push([itemId, _rr / 100, ratePct]); else gainItem(itemId, 1); } return; }";
  const A3 = "        if(Math.random() < partyDropRate((ratePct * _dropBase * _clMult * _relicX2) / 100)) gainItem(itemId, 1);\n    });";
  const B3 = "        { let _pp = partyDropRate((ratePct * _dropBase * _clMult * _relicX2) / 100); if(Math.random() < _pp) { if (_afkDropBag) _afkDropBag.push([itemId, _pp, ratePct]); else gainItem(itemId, 1); } }\n    });\n    if (_afkDropBag) { try { window.__afkDropCap(_afkDropBag, mob); } catch (e) { _afkDropBag.forEach(x => gainItem(x[0], 1)); } }";
  for (const [a, n] of [[A1, '開頭'], [A2, '裂痕'], [A3, '一般']]) if (s.split(a).length - 1 !== 1) throw new Error('[掉落種類上限] 錨點（' + n + '）應出現 1 次');
  s = s.replace(A1, B1).replace(A2, B2).replace(A3, B3);
  if (!CHECK) writeFileSync(FILE, s);
  changed++; console.log('[patch] 掉落種類上限');
}

// 63. 負面效果抵抗改成外掛開關（玩家 2026-10-28）：補丁 48 寫進核心的判定，在 window.__afkDebuffAllOff 為真時一律放行
function patchDebuffResistToggle() {
  const FILES = ['js/04-combat-attack.js', 'js/06-status-allies.js', 'js/07-skills-cast.js', 'js/22-pets.js', 'js/23-summons.js'];
  const TAG = '加掛版補丁:負面效果抵抗 */', OFF = 'window.__afkDebuffAllOff || ';
  let any = false;
  for (const FILE of FILES) {
    let s = readFileSync(FILE, 'utf8');
    const lines = s.split('\n'); let n = 0;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (!L.includes(TAG) || L.includes('__afkDebuffAllOff')) continue;
      const L2 = L.split("(typeof abnormalMagicHit !== 'function' ||").join('(' + OFF + "typeof abnormalMagicHit !== 'function' ||")
                  .split("(typeof allyAbnormalMagicHit !== 'function' ||").join('(' + OFF + "typeof allyAbnormalMagicHit !== 'function' ||");
      if (L2 !== L) { lines[i] = L2; n++; }
    }
    if (!n) continue;
    any = true;
    if (!CHECK) writeFileSync(FILE, lines.join('\n'));
    console.log('[patch] 負面效果抵抗開關 ' + FILE + '（' + n + ' 處）');
  }
  if (any) changed++; else already++;
}

// 69. 疼痛的歡愉反射量掛點（玩家 2026-10-29 21:07：幻術士修補，外掛 afk-illufix）：反射的傷害交給 window.__afkPainRf 決定（沒有掛點＝原本的「受到多少反多少」）
function patchPainReflect() {
  const TAG = '/* 🔌 加掛版補丁:疼痛的歡愉 */';
  const SITES = [
    ['js/04-combat-attack.js', "if(player.buffs.sk_illu_pain > 0 && mob && mob.curHp > 0 && totalDmg > 0) {   // 🔮 疼痛的歡愉：受傷時對攻擊者反射等量（損失HP）的無屬性魔法傷害\n            let _rf = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));",
      "if(player.buffs.sk_illu_pain > 0 && mob && mob.curHp > 0 && totalDmg > 0) {   // 🔮 疼痛的歡愉：受傷時對攻擊者反射等量（損失HP）的無屬性魔法傷害\n            let _rf = Math.max(1, Math.floor((window.__afkPainRf ? window.__afkPainRf(player, totalDmg, mob) : totalDmg) * fragileMult(mob))); " + TAG],
    ['js/04-combat-attack.js', "if(player.buffs.sk_illu_pain > 0 && dmg > 0 && mob.curHp > 0) {\n            let _rf = Math.max(1, Math.floor(dmg * fragileMult(mob)));",
      "if(player.buffs.sk_illu_pain > 0 && dmg > 0 && mob.curHp > 0) {\n            let _rf = Math.max(1, Math.floor((window.__afkPainRf ? window.__afkPainRf(player, dmg, mob) : dmg) * fragileMult(mob))); " + TAG],
    ['js/06-status-allies.js', "if (b.sk_illu_pain > 0 && mob.curHp > 0) {   // 疼痛的歡愉：100%\n        let _rf = Math.max(1, Math.floor(dmgTaken * _fm));",
      "if (b.sk_illu_pain > 0 && mob.curHp > 0) {   // 疼痛的歡愉：100%\n        let _rf = Math.max(1, Math.floor((window.__afkPainRf ? window.__afkPainRf(ally, dmgTaken, mob) : dmgTaken) * _fm)); " + TAG]
  ];
  let any = false;
  for (const [FILE, A, B] of SITES) {
    let s = readFileSync(FILE, 'utf8');
    if (s.includes(B)) continue;
    if (s.split(A).length - 1 !== 1) throw new Error('[疼痛的歡愉] 錨點應出現 1 次：' + FILE);
    s = s.replace(A, B); any = true;
    if (!CHECK) writeFileSync(FILE, s);
  }
  if (any) { changed++; console.log('[patch] 疼痛的歡愉反射量掛點'); } else already++;
}

const PATCHES = [patchPainReflect, patchNoCastleBuyers, patchPetMpCap, patchEvadeCap, patchOffwpnRow, patchClassicDarkWeapons, patchPolyPickOverride, patchIllusionDamage, patchDebuffResist, patchNpcClanCount, patchEquipPoly, patchNoBossRegen, patchMaybeSpawnMobs, patchTradEnHook, patch16Slots, patchPetAnimTicker, patchBossHuntEscape, patchUseItemKeepModal, patchSellNowNoForce, patchInsigniaOrder, patchGiltasWandRecompute, patchEyeSlotInEquipList, patchRelicAffixHook, patchIllusionSetWpnProc, patchBuyerEnHook, patchWandererMakeHook, patchRelicBleedBonus, patchRelicSpecialScale, patchRelicDotRules, patchDreamHell, patchAscAttrStar, patchCardRebirth, patchPetHostRect, patchBarrierCdSkip, patchNoOfflineMaps, patchEvoHooks, patchRebirthMastery, patchLevelCap, patchCastleWar, patchIdleRaf, patchMaxAdd, patchAntFinal, patchEleRes, patchAllyDrCap, patchAllyHitstun, patchSetLate, patchRelicFx, patchRapidTrue];

try {
  for (const p of PATCHES) p();
  applyRelicRuntimePatches(CHECK);
  applyRelicWeaponBridgePatches(CHECK);
  applyRelicCompanionPatches(CHECK);
  applyRelicDefensePatches(CHECK);
  applyDisplayPatches(CHECK);
  applyCastleBadgePatch(CHECK);
  applyCardCombatPatches(CHECK);
  { const w = applyWebpPatches(CHECK); changed += w.changed; if (w.changed === 0) already++; }   // 介面大圖改 WebP（計為 1 個補丁）
  patchTakenHook();   // 錨點是遺物 incoming 行，必須在遺物補丁之後
  patchClassicOrigin();   // 經典原版：放最後，避免動到其他補丁的錨點
  patchClassicOwnStats();
  patchDebuffResistToggle();   // 要在補丁 48 之後
  patchWhMax();
  patchSoulSlot();
  patchHitCapCrit();
  patchRiftDrop();
  patchDropCap();
} catch (e) {
  console.error('❌ apply-core-patches 失敗：' + e.message);
  process.exit(1);
}

if (CHECK) {
  if (changed > 0) { console.error(`❌ --check：有 ${changed} 個核心補丁尚未套用（請跑 node scripts/apply-core-patches.mjs）`); process.exit(1); }
  console.log(`✅ --check：全部 ${already} 個核心補丁均已就位。`);
} else {
  console.log(`✅ apply-core-patches 完成：新套用 ${changed}、已存在 ${already}。`);
}
