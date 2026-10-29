/* ============================================================================
 * afk-relicplus.js — 遺物合成（武器／防具 +1～+15、飾品 +1～+10；燃柳村 NPC「哈瑪大師」，玩家 2026-10-20／21 指定）
 *
 * 合成規則
 *   ‧+1～+5：同款同強化值 2 個合成高一級（武器／防具）；+6～+9：本體＋同款 +1 三件（80／70／60／50%）；+10：本體 +9＋同款 +5 三件（玩家 2026-10-26）
 *     費用：做出 +1～+6 每次 500 龍鑽＋5,000 萬，
 *     +7～+10 每高一級再多 100 龍鑽＋1,000 萬（+10＝900／9,000 萬）
 *   ‧原作者強化上限 +5 的道具（戒指、耳環、項鍊、腰帶…）：最高 +10；每級 3 個同級、龍鑽與金幣 ×3、席琳結晶 500 顆
 *   ‧+11～+15：只用一個，每次 50,000 龍鑽，成功率 10%，失敗不會消失；每失敗一次同一階 +2%、最高 50%（保底，2026-10-29 晚）；滿階後開放昇華支配
 *   ‧只看背包（不含倉庫、不含穿在身上的）；上鎖的不列入
 * 每一級的能力
 *   ‧武器：每 +1 大小傷 +1；每 +3 原本的白字能力各 +1
 *   ‧防具／飾品：每 +1 AC-1、MR+1；每 +3 ER+1；每 +5 傷害減免 +1
 *   ‧共通：每 +5 遺物特效 +5%（機率型；「一擊必殺」這類小數機率不加）；匕首／單手矛出血每秒比例同樣 +5%
 *          HP／MP 自然恢復每 +1 多 1（本身 ≥50 的多 10）
 *          主屬性強化（百變的透明內衣）每 +5 再 +1；火焰化解（火熱愛意）+5 每 5 秒、+10 完全免疫
 *   ‧+10 第二詞綴：隨機抽一件同部位的其他遺物，繼承它的特效（只加原本沒有的欄位）；抽到本身沒有特效的 → 四屬性抗性 +3
 *   ‧幸運暴走兔腳：兩邊耳環可以各戴一個，遺物掉落判定 ×2 → ×4
 *   ‧+10 以上：中毒必定觸發；匕首／單手矛出血每一下必中、最多 50 層，持續時間照原本（核心補丁 17＋afk-relicfx）
 *   ‧持續傷害上限：一般來源中毒＋出血共用每秒最大 HP 的 1%；昇華來源只在受過昇華命中的目標上豁免
 *
 * 做法（不改核心戰鬥程式）
 *   +N 遺物是一個「衍生物品」：id＝原遺物 id + "~r" + N（+10 以上再加 "~" + 特效來源 id），
 *   在 DB.items 以「不可列舉」的屬性註冊——所有 DB.items[id] 查詢都拿得到（戰鬥、能力、tooltip 全部照常運作），
 *   但遍歷 DB.items 的地方（黑市、收購、遺物布告欄、圖鑑索引…）看不到它，不會被抽進任何池子。
 *   武器標籤（匕首／矛…）也照原遺物註冊，出血、圖鑑分類跟原遺物一樣。
 *   註冊時機：啟動時（記錄＋掃描所有存檔／倉庫）、讀檔與招募傭兵之前、每次合成成功當下。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  var enabled = function () { return !T || T.enabled('relicplus'); };
  // 遺物武器命中回 MP（玩家 2026-10-29：像魔力短劍一樣，避免新手期 MP 不夠用）：+0 每擊 1 點，每 +3 再 +1，昇華支配再 +1＋昇華值
  if (T && T.register) T.register({ id: 'relicmp', name: '遺物武器命中回 MP', group: '遊戲玩法', def: false,   // 玩家 2026-10-29：預設關（要重新填寫遺物）
    desc: '所有遺物武器都像魔力短劍一樣，一般攻擊命中時回復 MP：+0 每擊 1 點，每 +3 再 +1（+15＝6），昇華支配再 +1＋昇華值' });
  var mpHitOn = function () { return !T || T.enabled('relicmp'); };
  var mpHitAmt = function (n, asc) { return 1 + Math.floor((n || 0) / 3) + (asc != null ? 1 + asc : 0); };
  var mpHitApply = function (d, b, n, asc) { if (!mpHitOn() || !d || !b || b.type !== 'wpn' || b.eff === 'mp_drain' || (b.mpOnHit && !b._afkRelicMp)) return; d.mpOnHit = true; d.mpOnHitAmt = mpHitAmt(n, asc); d._afkRelicMp = true; };
  var disabled = function () { return { ok: false, msg: '遺物合成功能已關閉。' }; };
  if (typeof DB === 'undefined' || !DB.items || typeof isRelic !== 'function') { try { console.warn('[AFK-relicplus] 找不到物品資料，未啟用'); } catch (e) {} return; }

  var MAX = 15;
  try { Object.keys(DB.items).forEach(function (k) { var d = DB.items[k]; if (d && d.relic && !d.gmOnly && k.indexOf('~') < 0) mpHitApply(d, d, 0, null); }); } catch (e) {}
  var REG_KEY = 'afk_relicplus_ids';
  var ID_RE = /(?:relic_|wpn_)[a-z0-9_]+~r\d{1,2}(?:~(?:relic_|wpn_)[a-z0-9_]+)?(?:~a\d)?(?:~e\d)?/g;
  var WHITE = ['hit', 'dmgBonus', 'bowHit', 'bowDmg', 'magicHit', 'mdmg', 'extraDmg', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'mr', 'dr', 'extraMp'];   // 武器每 +3 各 +1（HP/MP 恢復另有規則）
  var RATE_TOP = /^(comboRate|pierceChance|procRateBase|dblStrikeRate|missGrazeRate|heavyRatePct|windSpellProcRate|procFireSkillRate|procPoisonRate)$/;
  // +10 繼承特效時「不算特效」的欄位（基本數值、武器型態、說明文字…）
  var NOT_FX = new Set(['n', 'type', 'slot', 'relic', 'noEnhance', 'dmgS', 'dmgL', 'hit', 'dmgBonus', 'req', 'p', 'gachaWeight', 'd', 'c', 'img',
    'isBow', 'ranged', 'rapidfire', 'rapidMax', 'isWand', 'qigu', 'chainsword', 'oneHand', 'w2h', 'isArrow', 'noConsume', 'eff', 'comboRate', 'ele',
    'extraMp', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'mr', 'mdmg', 'mpR', 'hpR', 'mhp', 'mmp', 'dr', 'magicHit', 'relicRole', 'h', 'classicOk',
    'maxLv', 'noBleed', 'tag', 'bowHit', 'bowDmg', 'extraDmg', 'relicBase', 'relicPlus', 'relicFx', 'relicBleedBonus', 'safe', 'maxEn',
    'ac', 'er', 'resFire', 'resWater', 'resWind', 'resEarth', 'weight', 'fireNullifyTicks', 'armguard', 'cls',
    'relicCatalogId', 'relicStage', 'relicRuntime', 'relicLore', 'relicAsc', 'relicEvo', 'relicFxRes', 'noAscUp', 'gmOnly']);
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var ASC_RES = 2, FX_RES = 3;   // 玩家 2026-10-25 抗性下修：昇華每 +1 四抗 +2；第二、第三詞綴保底四抗 +3（全身昇華 +5 約 500）
  var hasEffect = function (b) { return Object.keys(b).some(function (f) { return !NOT_FX.has(f); }); };
  var KIND_OK = function (d) { return !!(d && isRelic(d) && !d.gmOnly && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) < 0); };
  // 戒指／耳環／項鍊／腰帶等強化上限 +5 的飾品：新增 +6～+10 的設計里程碑
  //   判斷依原作者的強化上限（enhanceCap）：上限 +5 的道具都算這一類
  // 第二詞綴在第幾級抽：飾品 +5、武器防具 +10（玩家 2026-10-23）
  var fxAt = function (base) { var d = DB.items[base]; return d && d.type === 'acc' ? 5 : 10; };
  var maxOf = function (base) { var d = DB.items[base]; if (!d) return 15; var cap = 15; try { cap = enhanceCap(d); } catch (e) { cap = d.type === 'acc' ? 5 : 15; } return cap <= 5 ? 10 : 15; };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var parseId = function (id) {
    var m = /^((?:relic_|wpn_)[a-z0-9_]+)~r(\d{1,2})(?:~((?:relic_|wpn_)[a-z0-9_]+))?(?:~a(\d))?(?:~e(\d))?(?:~g((?:relic_|wpn_)[a-z0-9_]+))?$/.exec(String(id || ''));
    if (!m) return null;
    return { base: m[1], n: Math.min(MAX, parseInt(m[2], 10)), fx: m[3] || null, asc: m[4] != null ? Math.min(5, parseInt(m[4], 10)) : null, evo: m[5] != null ? parseInt(m[5], 10) : null, fx3: m[6] || null };
  };
  var baseOf = function (id) { var p = parseId(id); return p ? p.base : id; };
  var levelOf = function (id) { var p = parseId(id); return p ? p.n : 0; };
  var fxOf = function (id) { var p = parseId(id); return p ? p.fx : null; };
  var ascOf = function (id) { var p = parseId(id); return p ? p.asc : null; };
  var evoOf = function (id) { var p = parseId(id); return p ? p.evo : null; };
  var fx3Of = function (id) { var p = parseId(id); return p ? p.fx3 : null; };
  var makeId = function (base, n, fx, asc, evo, fx3) { return n <= 0 ? base : base + '~r' + n + (fx ? '~' + fx : '') + (asc != null ? '~a' + asc : '') + (evo != null && asc === 5 ? '~e' + evo : '') + (fx3 && evo != null && asc === 5 ? '~g' + fx3 : ''); };
  // 至高的支配（昇華支配 +5 進化）：8 種特效，9＝遺物・司祭苦行套裝（全部 8 種）
  var EVO = [null, '克特套裝', '死亡騎士套裝', '惡魔套裝', '四大軍王套裝', '真．冥皇套裝', '全能力 +30', '面板能力 +50', '四屬性抗性 +100', '全部八種特效'];
  // 武器的至高的支配（玩家 2026-10-27 二改）：不給八種特效，進化時直接附上第三詞綴（10/25 的第三詞綴規則）
  //   evo 0＝武器專用「無特效」（id 為 ~e0）；防具、飾品維持八種特效
  var EVO_WPN_NONE = 0;
  var evoTag = function (e) { return EVO[e] ? '【' + EVO[e] + '】' : ''; };
  var isWpnBase = function (base) { var d = DB.items[base]; return !!(d && d.type === 'wpn'); };
  var catOf = function (id) { try { return equipCatKey(id, DB.items[id]); } catch (e) { return null; } };

  // ── 衍生物品定義 ──
  function buildDef(base, n, fx, asc, evo, fx3) {
    var b = (window.AFK_RELIC_RUNTIME && window.AFK_RELIC_RUNTIME.originalBase(base)) || DB.items[base];
    var d = clone(b);
    d.relicBase = base; d.relicPlus = n; d.relicFx = fx || null; d.relicAsc = (asc != null) ? asc : null; d.relicEvo = (evo != null && asc === 5) ? evo : null;
    d.gachaWeight = 0;
    mpHitApply(d, b, n, asc);
    try { d.img = getIconUrl(b); } catch (e) {}
    var r = Math.floor(n / 5) * 5, k3 = Math.floor(n / 3), k5 = Math.floor(n / 5);
    if (b.type === 'wpn') {
      // 武器：每 +1 大小傷 +1；每 +3 白字各 +1
      d.dmgS = (Number(b.dmgS) || 0) + n;
      d.dmgL = (Number(b.dmgL) || 0) + n;
      if (k3) WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0) d[f] = b[f] + k3; });
    } else {
      // 防具／飾品：每 +1 AC-1、MR+1；每 +3 ER+1；每 +5 傷害減免+1
      d.ac = (Number(b.ac) || 0) + n;
      d.mr = (Number(b.mr) || 0) + n;
      if (k3) d.er = (Number(b.er) || 0) + k3;
      if (k5) d.dr = (Number(b.dr) || 0) + k5;
    }
    // HP／MP 自然恢復：每 +1 多 +1；本身 ≥50 的每 +1 多 +10
    ['hpR', 'mpR'].forEach(function (f) { if (typeof b[f] === 'number' && b[f] > 0) d[f] = b[f] + n * (b[f] >= 50 ? 10 : 1); });
    if (k5) {
      {
        // 每 +5：遺物特效 +5%（沒有特效的遺物這一步沒有東西可加）
        Object.keys(b).forEach(function (f) {
          var v = b[f];
          if (typeof v === 'number' && RATE_TOP.test(f)) d[f] = Math.min(100, v + r);
          else if (v && typeof v === 'object' && !Array.isArray(v) && /^proc/.test(f)) {
            if (typeof v.rate === 'number') d[f].rate = Math.min(100, v.rate + r);
            else if (typeof v.pct === 'number') d[f].pct = Math.min(100, v.pct + r);
          }
        });
        // 特殊效果：每 +5 強化一級
        if (b.highestAttrPlus) d.highestAttrPlus = 1 + k5;                 // 主屬性 +1 → +2 → +3 → +4
        if (b.fireNullify) d.fireNullifyTicks = n >= 10 ? 1 : 50;          // 火焰化解每 10 秒 → +5 每 5 秒 → +10 完全免疫
      }
      try { if (b.type === 'wpn' && typeof weaponHasBleed === 'function' && weaponHasBleed(base)) d.relicBleedBonus = r; } catch (e) {}
    }
    var fxName = '';
    if (fx && DB.items[fx]) {
      // +10 第二詞綴：繼承抽到的遺物特效；抽到「本身沒有特效」的遺物 → 改給四屬性抗性 +3
      // Inheritance uses the original base effect. Runtime metadata and the
      // donor's upgraded stage must never become effects on the recipient.
      var donor = (window.AFK_RELIC_RUNTIME && window.AFK_RELIC_RUNTIME.originalBase(fx)) || DB.items[fx];
      var copied = 0;
      if (hasEffect(donor)) Object.keys(donor).forEach(function (f) { if (!NOT_FX.has(f) && !(f in b)) { d[f] = clone(donor[f]); copied++; } });
      // 抽到沒有特效的遺物，或抽到的特效跟本身完全重複（例如兩把都只有出血）→ 改給四屬性抗性 +3，避免「繼承了卻什麼都沒有」
      if (!copied) { RES4.forEach(function (f) { d[f] = (Number(d[f]) || 0) + FX_RES; }); d.relicFxRes = true; }
      fxName = donor.n;
    }
    // 至高的支配：第三詞綴（玩家 2026-10-25）——同部位再繼承一件遺物的特效；沒有新欄位可繼承 → 四屬性抗性 +3
    var fx3Name = '', fx3Res = false;
    if (fx3 && DB.items[fx3]) {
      var donor3 = (window.AFK_RELIC_RUNTIME && window.AFK_RELIC_RUNTIME.originalBase(fx3)) || DB.items[fx3], copied3 = 0;
      if (hasEffect(donor3)) Object.keys(donor3).forEach(function (f) { if (!NOT_FX.has(f) && !(f in b) && !(f in d)) { d[f] = clone(donor3[f]); copied3++; } });
      if (!copied3) { RES4.forEach(function (f) { d[f] = (Number(d[f]) || 0) + FX_RES; }); fx3Res = true; }
      fx3Name = donor3.n; d.relicFx3 = fx3;
    }
    // +10 以上：中毒必定觸發（出血必中與 50 層上限由遺物戰鬥介面依來源判斷）
    if (n >= 10) {
      Object.keys(d).forEach(function (f) { var v = d[f]; if (v && typeof v === 'object' && /^procPoison$/.test(f) && typeof v.rate === 'number') v.rate = 100; });
      if (typeof d.procPoisonRate === 'number') d.procPoisonRate = 100;
    }
    // 專屬階段先定值，再加共通昇華成長，避免白字增量被覆蓋。
    if (typeof window.__afkRelicTier === 'function') window.__afkRelicTier(d, b, n, asc);
    // 昇華支配：每 +1（玩家 2026-10-21 規格）
    if (asc != null && asc > 0) {
      var A = asc;
      if (b.type === 'wpn') {
        d.dmgS += 10 * A; d.dmgL += 10 * A;
        WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0) d[f] = (Number(d[f]) || 0) + 5 * A; });
      } else {
        if (b.type === 'arm') { d.hpR = (Number(d.hpR) || 0) + 50 * A; d.mpR = (Number(d.mpR) || 0) + 50 * A; }
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + A; });
        d.er = (Number(d.er) || 0) + A; d.ac = (Number(d.ac) || 0) + A; d.mr = (Number(d.mr) || 0) + A; d.dr = (Number(d.dr) || 0) + A;
        RES4.forEach(function (f) { d[f] = (Number(d[f]) || 0) + ASC_RES * A; });   // 玩家 2026-10-25：每 +1 四抗 +10 → +2
      }
    }
    d.d = (d.d || b.d || '') + ' 〔遺物合成 +' + n + '〕' + (asc != null ? '〔昇華支配 +' + asc + '〕' : '') + (fxName ? (d.relicFxRes ? '〔第二詞綴：抽到「' + fxName + '」（無特效）→ 四屬性抗性 +3〕' : '〔第二詞綴：繼承「' + fxName + '」的特效〕') : '') + (asc != null && asc >= 5 ? (d.relicEvo != null ? (EVO[d.relicEvo] ? '〔至高的支配：' + EVO[d.relicEvo] + '〕' : '〔至高的支配〕') : '〔可進化：至高的支配〕') : '');
    if (fx3Name) d.d += fx3Res ? '〔第三詞綴：抽到「' + fx3Name + '」（沒有新特效）→ 四屬性抗性 +3〕' : '〔第三詞綴：繼承「' + fx3Name + '」的特效〕';
    return d;
  }
  function ensure(id) {
    var p = parseId(id), current = DB.items[id], on = enabled();
    if (current && (!p || current._relicDataEnabled === on)) return true;
    if (!p || !KIND_OK(DB.items[p.base]) || p.n > maxOf(p.base)) return false;
    if (p.asc != null && p.n !== maxOf(p.base) && !(DB.items[p.base].type === 'acc' && p.n === 5)) return false; // 舊 +5 昇華飾品存檔仍可讀取
    if (p.evo != null && (p.asc !== 5 || p.evo < 0 || p.evo > 9)) return false;
    if (p.fx3 && (p.evo == null || !DB.items[p.fx3])) return false;
    if (p.fx && !DB.items[p.fx]) p.fx = null;
    // Identity belongs to the save; combat definitions belong to the toggle.
    // Never rewrite the instance ID or affixes when temporarily disabling it.
    var def = on ? buildDef(p.base, p.n, p.fx, p.asc, p.evo, p.fx3) : buildDef(p.base, 0, null, null, null);
    if (!on) def.d = (def.d || '').replace(/ 〔遺物合成 \+0〕$/, '');
    Object.defineProperty(def, '_relicDataEnabled', { value: on, configurable: true });
    Object.defineProperty(DB.items, id, { value: def, writable: true, configurable: true, enumerable: false });
    try {
      if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[p.base] && !WEAPON_TAGS[id])
        Object.defineProperty(WEAPON_TAGS, id, { value: WEAPON_TAGS[p.base], writable: true, configurable: true, enumerable: false });
    } catch (e) {}
    return true;
  }
  var registry = function () { try { var a = JSON.parse(localStorage.getItem(REG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  var remember = function (id) {
    var a = registry(); if (a.indexOf(id) >= 0) return;
    a.push(id); try { localStorage.setItem(REG_KEY, JSON.stringify(a.slice(-2000))); } catch (e) {}
  };
  var scanText = function (s) { if (!s || s.indexOf('~r') < 0) return; var m = String(s).match(ID_RE); if (m) m.forEach(function (id) { if (ensure(id)) remember(id); }); };
  var scanKey = function (key) {
    try { scanText(localStorage.getItem(key)); } catch (e) {}
    try { if (typeof _lsGet === 'function') scanText(_lsGet(key)); } catch (e) {}
    try { var raw = (typeof _lzGet === 'function') ? _lzGet(key) : null; if (raw) { var u = _saveUnwrap(raw); scanText(u && u.ok !== false && u.payload ? u.payload : raw); } } catch (e) {}
  };
  var scanAll = function () {
    registry().forEach(ensure);
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/lineage|wh|warehouse/i.test(k)) scanKey(k); } } catch (e) {}
  };
  function ensureItems(items) { (items || []).forEach(function (it) { if (it && it.id) ensure(it.id); }); }
  function ensureActor(actor) {
    if (!actor) return;
    [actor].concat(actor.allies || []).forEach(function (p) { if (!p) return; ensureItems(p.inv); ensureItems(Object.keys(p.eq || {}).map(function (k) { return p.eq[k]; })); });
  }
  function refreshData() {
    Object.getOwnPropertyNames(DB.items).forEach(function (id) { if (parseId(id)) ensure(id); });
    scanAll();
    var R = window.AFK_RELIC_RUNTIME; if (R && R.invalidate) R.invalidate();
  }
  // This read/identity API is infrastructure, even when crafting is disabled.
  // It is intentionally separate from __afkRelicPlus, which signals availability
  // to the encyclopedia and other feature UIs.
  // 舊存檔：遺物本體帶著一般強化值（en>0，例如測試工具或舊版留下的「+15」），改成遺物合成等級，才能套用分階特效（玩家 2026-10-23）
  function migrateEn(items) {
    var n = 0;
    if (!enabled()) return 0;   // 遺物合成關掉時不動玩家的物品
    (items || []).forEach(function (it) {
      if (!it || !it.id) return;
      if (String(it.id).indexOf('~') >= 0) {   // 已是合成等級但 +10 以上沒有第二詞綴（前一版轉換留下的）→ 補抽
        var pp = parseId(it.id);
        if (pp && pp.evo != null && pp.evo !== EVO_WPN_NONE && isWpnBase(pp.base)) {   // 舊版武器帶著八種特效之一 → 拿掉特效、改附第三詞綴（已有第三詞綴就保留）
          var f3 = pp.fx3 || rollFx3Id(pp.base, pp.fx), wid = makeId(pp.base, pp.n, pp.fx, pp.asc, EVO_WPN_NONE, f3); ensure(wid);
          if (DB.items[wid]) { var oldNm = EVO[pp.evo]; it.id = wid; n++; try { logSys('<span class="text-amber-300">武器的至高的支配改為「第三詞綴」：' + esc(DB.items[pp.base].n) + ' 拿掉【' + oldNm + '】' + (pp.fx3 ? '，保留原本的第三詞綴' : '，改附第三詞綴「' + esc((DB.items[f3] || {}).n || '四屬性抗性 +3') + '」') + '。</span>'); } catch (e) {} }
          return;
        }
        if (pp && pp.n >= fxAt(pp.base) && !pp.fx) { var dd = donorsFor(pp.base); if (dd.length) { var nid = makeId(pp.base, pp.n, dd[Math.floor(Math.random() * dd.length)], pp.asc, pp.evo); ensure(nid); if (DB.items[nid]) { it.id = nid; n++; } } }
        return;
      }
      var d = DB.items[it.id], en = Math.floor(Number(it.en) || 0);
      if (en <= 0 || !KIND_OK(d)) return;
      var lv = Math.min(en, maxOf(it.id)), fx = null;
      if (lv >= fxAt(it.id)) { var ds = donorsFor(it.id); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }   // 跟正常合成一樣：到 +10 抽第二詞綴
      var id = makeId(it.id, lv, fx);
      ensure(id); if (!DB.items[id]) return;
      it.id = id; it.en = 0; n++;
    });
    return n;
  }
  function migrateActor(actor) {
    if (!actor) return 0;
    var n = 0;
    [actor].concat(actor.allies || []).forEach(function (p) { if (!p) return; n += migrateEn(p.inv); n += migrateEn(Object.keys(p.eq || {}).map(function (k) { return p.eq[k]; })); });
    return n;
  }
  var migrateNow = function () {
    try {
      var p = (typeof player !== 'undefined' && player && player.cls) ? player : null; if (!p) return;
      if (migrateActor(p) > 0) { try { calcStats(); } catch (e) {} try { updateUI(); } catch (e) {} try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} }
    } catch (e) {}
  };
  setInterval(migrateNow, 3000);
  window.__afkRelicData = { migrateEn: migrateEn, migrateNow: migrateNow, ensure: ensure, buildDef: buildDef, makeId: makeId, parseId: parseId, scanAll: scanAll, refresh: refreshData, enabled: enabled };
  scanAll();
  // 讀檔／招募傭兵／載入倉庫之前再補一次（匯入其他電腦的存檔時用得到）
  ['loadGame', 'toggleAlly'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { try { scanAll(); if (typeof currentSlot !== 'undefined') scanKey('lineage_idle_save_' + currentSlot); ensureActor(typeof player !== 'undefined' ? player : null); } catch (e) {} return o.apply(this, arguments); };
  });
  if (typeof window.loadWarehouse === 'function') {
    var oWh = window.loadWarehouse;
    window.loadWarehouse = function () { var w = oWh.apply(this, arguments); try { var mig = migrateEn(w && w.items); ensureItems(w && w.items); if (mig > 0 && typeof player !== 'undefined' && player && player.cls && typeof window.saveWarehouse === 'function') window.saveWarehouse(w); } catch (e) {} return w; };   // 倉庫轉換後立刻存回，第二詞綴不會每次重抽
  }
  if (typeof window.purgeOrphanItems === 'function') {
    var oPurge = window.purgeOrphanItems;
    window.purgeOrphanItems = function (warehouse) { ensureActor(typeof player !== 'undefined' ? player : null); ensureItems(warehouse && warehouse.items); return oPurge.apply(this, arguments); };
  }
  if (T && typeof T.set === 'function') {
    var oToggle = T.set;
    T.set = function (id, on) {
      var prior = enabled(), out = oToggle.apply(this, arguments);
      if (id === 'relicplus' && prior !== enabled()) {
        refreshData();
        var p = typeof player !== 'undefined' ? player : null, R = window.AFK_RELIC_RUNTIME;
        if (p && p.cls && R && R.recalc) [p].concat(p.allies || []).forEach(function (actor) { R.recalc(actor); });
        if (!enabled()) { doClose(); ['rp-open','m-afk-nav-relicplus'].forEach(function (key) { var el = document.getElementById(key); if (el) el.remove(); }); }
      }
      return out;
    };
  }
  // 名稱前加 +N
  if (typeof window.getItemFullName === 'function') {
    var oName = window.getItemFullName;
    window.getItemFullName = function (item) {
      if (item && item.id) ensure(item.id);
      var s = oName.apply(this, arguments);
      try {
        var d = item && DB.items[item.id], saved = item && parseId(item.id);
        var level = saved || d && d.relicPlus && { n: d.relicPlus, asc: d.relicAsc, evo: d.relicEvo };
        // The title describes the saved affix. Its active proc still follows
        // the native three-star cap while ascension abilities are disabled.
        if (!enabled() && saved && saved.asc != null && item.attrMagicStar > 3)
          s = s.replace(/^(<span[^>]*>)★+(<\/span>)/, '$1' + '★'.repeat(Math.min(5, Math.floor(item.attrMagicStar))) + '$2');
        if (d && level && level.n) {
          var i = s.lastIndexOf('>' + d.n);
          if (i >= 0) {
            if (level.evo != null) s = s.slice(0, i + 1) + d.n + '至高的支配' + evoTag(level.evo) + s.slice(i + 1 + d.n.length);
            else if (level.asc != null) s = s.slice(0, i + 1) + '+' + level.asc + ' ' + d.n + '昇華支配' + s.slice(i + 1 + d.n.length);   // +15 → 「+0 XXX昇華支配」…最高「+5 XXX昇華支配」
            else s = s.slice(0, i + 1) + '+' + level.n + ' ' + s.slice(i + 1);
          }
        }
      } catch (e) {}
      return s;
    };
  }

  // ── 成本 ──
  var CRYSTAL = 'sherine_crystal';
  // +11～+15 保底（玩家 2026-10-29 晚）：同一個目標強化值每失敗一次 +2%，最高 50%（本身 10% 再加 40%）；成功就歸零
  var PITY = { step: 0.02, max: 0.50 };
  var pityOf = function (target) { var p = typeof P === 'function' ? P() : null; var m = p && p.afkRelicPity; return m && m[target] > 0 ? Math.floor(m[target]) : 0; };
  function costOf(target, base) {   // 做出 +target 的成本
    var c;
    if (target <= 6) c = { dia: 500, gold: 50000000, merge: true, rate: 1 };
    else if (target <= 10) c = { dia: 500 + 100 * (target - 6), gold: 50000000 + 10000000 * (target - 6), merge: true, rate: 1 };
    else c = { dia: 50000, gold: 0, merge: false, rate: Math.min(PITY.max, 0.10 + PITY.step * pityOf(target)) };
    c.need = c.merge ? 2 : 1; c.crystal = 0;
    // 上限 +5 的飾品（戒指、耳環、項鍊、腰帶…）：每次要 3 個同款同強化值、龍鑽與金幣 ×3，另外消耗席琳結晶 500 顆
    //   例：+0→+1＝3 個 +0、1,500 龍鑽、1.5 億金幣、席琳結晶 500 顆
    if (base && DB.items[base] && DB.items[base].type === 'acc') { c.need = 3; c.dia *= 3; c.gold *= 3; c.crystal = 500; }
    // 飾品 +6～+10：改成 2 個同款同強化值合成，成功率 50%；失敗時兩件都還在，只扣龍鑽、金幣、結晶（玩家 2026-10-23）
    if (base && DB.items[base] && DB.items[base].type === 'acc' && target >= 6) { c.need = 2; c.rate = 0.5; }
    // 武器／防具 +6～+10（玩家 2026-10-26 改，取代原本「2 件同級」的翻倍制）：
    //   +6～+9：本體 1 件＋同款 +1 三件，成功率 80%／70%／60%／50%；失敗時本體保留、三件 +1 消耗（龍鑽、金幣照扣）
    //   +10：本體 +9＋同款 +5 三件，100%
    if (base && DB.items[base] && DB.items[base].type !== 'acc' && target >= 6 && target <= 10) {
      c.need = 1; c.matNeed = 3; c.matLv = target === 10 ? 5 : 1; c.rate = [0.8, 0.7, 0.6, 0.5, 1][target - 6];
    }
    return c;
  }
  var crystals = function () { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === CRYSTAL && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  function takeCrystals(k) {   // 回傳還原函式；不夠回 null
    var p = P(); if (crystals() < k) return null;
    var snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== CRYSTAL || it.lock) continue;
      var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), use = Math.min(c, k);
      k -= use; if (c - use <= 0) p.inv.splice(i, 1); else it.cnt = c - use;
    }
    return function () { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); };
  }
  function donorsFor(base) {
    var ck = catOf(base), b = DB.items[base];
    return Object.keys(DB.items).filter(function (id) {
      var d = DB.items[id];
      return id !== base && !!d && isRelic(d) && d.type === b.type && catOf(id) === ck;   // 同部位所有遺物都可能抽到（沒有特效的 → 四屬性抗性 +3）
    });
  }

  // ── 背包資料 ──
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var attrTier = function (it) { try { var a = (typeof getAttrAffix === 'function') ? getAttrAffix(it.attr) : null; return a ? a.tier : (it.attr ? 1 : 0); } catch (e) { return it.attr ? 1 : 0; } };
  var affixScore = function (it) {
    return (it.bless ? 1 + (Number(it.blessLv) || 1) : 0) + (it.anc ? 1 : 0) + attrTier(it) + (it.attrMagic ? 1 + (Number(it.attrMagicStar) || 1) : 0)
      + (it.will ? 2 : 0) + (it.dmark ? 1 + (Number(it.dmarkStar) || 0) : 0) + (it.dscar ? 1 + (Number(it.dscarStar) || 0) : 0) + (it.tree ? 1 : 0) + (it.dres ? 1 : 0);
  };
  // 合成／強化／昇華／進化時，做出來的那件要繼承本體「身上所有的詞綴」（玩家 2026-10-27：屬性階與星數、至高的祝福、
  //   不屈者意志、龍的印記／傷痕與星數、神樹者的讚禮、闇龍的抵抗者…）。不列舉欄位，除了身分與堆疊欄位以外整包照抄，
  //   之後再加新詞綴也不會漏。
  var NO_COPY = { id: 1, uid: 1, cnt: 1, lock: 1, junk: 1, _rpEq: 1 };
  var copyAff = function (it) { var o = {}; for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k) && !NO_COPY[k]) o[k] = it[k]; return o; };
  // 同款、指定強化值、沒昇華的那一組（加料制的材料）
  function matGroup(g, lv) { return groups(true).filter(function (x) { return x.base === g.base && x.n === lv && x.asc == null && x.key !== g.key; }).sort(function (a, b) { return b.cnt - a.cnt; })[0] || null; }
  var keyOf = function (it) {
    var base = baseOf(it.id), n = levelOf(it.id), asc = ascOf(it.id), evo = evoOf(it.id);
    return base + '|' + n + '|' + (fxOf(it.id) || '') + '|' + (asc != null ? asc : '') + '|' + (evo != null ? evo : '') + '|' + (fx3Of(it.id) || '');
  };
  // 身上裝備中、沒有鎖定的遺物（玩家 2026-10-27：裝備在身上的也要能直接強化，而且排前面）
  var eqRelics = function (p) {
    var out = [];
    Object.keys((p && p.eq) || {}).forEach(function (slot) { var it = p.eq[slot]; if (it && !it.lock && it.id && KIND_OK(DB.items[baseOf(it.id)])) out.push({ slot: slot, it: it }); });
    return out;
  };
  // 清單排序（玩家 2026-10-27）：裝備在身上的 → 強化過的（+1 以上、昇華支配、至高的支配）→ 其他；同一層再照昇華、強化值、名稱
  function groups(invOnly) {
    var p = P(); if (!p) return [];
    var map = {};
    var add = function (it, slot) {
      var base = baseOf(it.id), d = DB.items[base];
      if (!KIND_OK(d)) return;
      var key = keyOf(it);
      var g = map[key] || (map[key] = { key: key, base: base, n: levelOf(it.id), fx: fxOf(it.id), asc: ascOf(it.id), evo: evoOf(it.id), fx3: fx3Of(it.id), cnt: 0, stacks: [], eqSlots: [] });
      g.cnt += slot ? 1 : Math.max(1, Math.floor(Number(it.cnt) || 1));
      if (slot) g.eqSlots.push(slot); else g.stacks.push(it);
    };
    (p.inv || []).forEach(function (it) { if (it && !it.lock && it.id) add(it, null); });
    if (!invOnly) eqRelics(p).forEach(function (e) { add(e.it, e.slot); });
    var tier = function (g) { return (g.eqSlots.length ? 2 : 0) + ((g.n > 0 || g.asc != null || g.evo != null) ? 1 : 0); };
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return (tier(b) - tier(a)) || ((b.asc != null ? b.asc + 1 : 0) - (a.asc != null ? a.asc + 1 : 0)) || (b.n - a.n) || ((DB.items[a.base].n || '') < (DB.items[b.base].n || '') ? -1 : 1); });
  }
  // 對「含身上裝備」的那一組動手前，先把那幾件暫時放回背包；做完再穿回去（被合成掉的部位改穿新做出來的那件）
  function withEq(fn) {
    return function (key) {
      var p = P(); if (!p || !p.eq || !p.inv) return fn.apply(this, arguments);
      var moved = eqRelics(p).filter(function (e) { return keyOf(e.it) === key; });
      if (!moved.length) return fn.apply(this, arguments);
      moved.forEach(function (e) { p.eq[e.slot] = null; e.it._rpEq = 1; p.inv.push(e.it); });
      var r;
      try { r = fn.apply(this, arguments); }
      finally {
        var newer = (r && r.ok && r.id) ? p.inv.filter(function (x) { return x && x.id === r.id; }) : [];
        moved.forEach(function (e) {
          delete e.it._rpEq;
          var i = p.inv.indexOf(e.it);
          if (i >= 0) { p.inv.splice(i, 1); p.eq[e.slot] = e.it; return; }
          var nx = newer.pop();
          if (nx) { p.inv.splice(p.inv.indexOf(nx), 1); p.eq[e.slot] = nx; }
        });
        try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {}
        if (r && r.ok) { try { saveGame(); } catch (e) {} }
        try { if (typeof renderTabs === 'function') renderTabs(true); if (typeof updateUI === 'function') updateUI(); } catch (e) {}
      }
      return r;
    };
  }
  var diamonds = function () { try { return Math.max(0, Math.floor(Number(window.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var gold = function () { var p = P(); return p ? Math.max(0, Math.floor(Number(p.gold) || 0)) : 0; };

  // 從某組拿走 k 件，回傳拿到的件（附詞綴）與還原函式
  function take(g, k) {
    var p = P(), got = [], snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    var stacks = g.stacks.slice().sort(function (a, b) { return ((b._rpEq ? 1 : 0) - (a._rpEq ? 1 : 0)) || (affixScore(b) - affixScore(a)); });   // 身上那件先用（做出來的穿回去）
    for (var i = 0; i < stacks.length && got.length < k; i++) {
      var it = stacks[i];
      while (got.length < k && Math.max(1, Math.floor(Number(it.cnt) || 1)) > 0 && p.inv.indexOf(it) >= 0) {
        got.push(copyAff(it));
        var c = Math.max(1, Math.floor(Number(it.cnt) || 1)) - 1;
        if (c <= 0) { p.inv.splice(p.inv.indexOf(it), 1); break; } else it.cnt = c;
      }
    }
    return { got: got, restore: function () { p.inv = snap; snap.forEach(function (x, i) { if (x) x.cnt = cnts[i]; }); } };
  }
  function pushResult(id, aff) {
    var p = P();
    var it = { cnt: 1, en: 0, bless: false, anc: false, attr: false, seteff: false };
    for (var k in (aff || {})) if (!NO_COPY[k]) it[k] = aff[k];
    if (it.attrMagic && !it.attrMagicStar) it.attrMagicStar = 1;   // 屬性魔法與星數一起繼承
    it.id = id; it.uid = (typeof uid === 'function' ? uid() : String(Math.random()).slice(2)); it.cnt = 1; it.lock = false; it.junk = false;
    p.inv.push(it);
  }
  var saveOk = function () { try { return typeof saveGame === 'function' && saveGame() === true; } catch (e) { return false; } };
  var adjustDia = function (delta) { try { var r = window.pandoraAdjustSharedDiamonds(delta) || {}; return r.ok ? { ok: true } : { ok: false, error: r.error || '龍之鑽石不足。' }; } catch (e) { return { ok: false, error: '龍之鑽石系統未就緒。' }; } };

  // 執行一次合成／強化；回傳 { ok, success, msg }
  function upgrade(key) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物，可能已經被移動。' };
    if (g.asc != null) return { ok: false, msg: '這件遺物已昇華，請使用昇華支配強化。' };
    var mx = maxOf(g.base);
    if (g.n >= mx) return { ok: false, msg: '已經是 +' + mx + '（最高）。' };
    var target = g.n + 1, c = costOf(target, g.base);
    if (g.cnt < c.need) return { ok: false, msg: '需要 ' + c.need + ' 個相同的 ' + (g.n ? '+' + g.n : '+0') + '。' };
    var mg = c.matNeed ? matGroup(g, c.matLv) : null;
    if (c.matNeed && (!mg || mg.cnt < c.matNeed)) return { ok: false, msg: '需要 ' + c.matNeed + ' 個同款的 +' + c.matLv + '（目前 ' + (mg ? mg.cnt : 0) + ' 個）。' };
    if (c.crystal && crystals() < c.crystal) return { ok: false, msg: '席琳結晶不足（需要 ' + c.crystal + ' 顆）。' };
    if (diamonds() < c.dia) return { ok: false, msg: '龍之鑽石不足（需要 ' + c.dia.toLocaleString() + '）。' };
    if (gold() < c.gold) return { ok: false, msg: '金幣不足（需要 ' + c.gold.toLocaleString() + '）。' };
    var fx = g.fx;
    if (target === fxAt(g.base) && !fx && mx >= target) { var ds = donorsFor(g.base); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }
    var newId = makeId(g.base, target, fx);
    if (!ensure(newId)) return { ok: false, msg: '無法建立 +' + target + ' 的資料。' };

    var pay = adjustDia(-c.dia); if (!pay.ok) return { ok: false, msg: pay.error };
    var gold0 = p.gold; p.gold = gold0 - c.gold;
    var undoCrystal = null;
    if (c.crystal) { undoCrystal = takeCrystals(c.crystal); if (!undoCrystal) { p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '席琳結晶不足。' }; } }
    var success = (c.merge && !(c.rate < 1)) ? true : (Math.random() < c.rate);
    var tk = null, restoreMats = null;
    if (c.matNeed) {   // 加料制：先扣三件材料（失敗也扣），成功再拿本體
      var tm = take(mg, c.matNeed);
      if (tm.got.length < c.matNeed) { tm.restore(); if (undoCrystal) undoCrystal(); p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
      restoreMats = tm.restore;
      g = groups().filter(function (x) { return x.key === key; })[0];
      if (!g) { restoreMats(); if (undoCrystal) undoCrystal(); p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    }
    if (success) {
      tk = take(g, c.need);
      if (tk.got.length < c.need) { tk.restore(); if (restoreMats) restoreMats(); if (undoCrystal) undoCrystal(); p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
      var best = tk.got.sort(function (a, b) { return affixScore(b) - affixScore(a); })[0];
      pushResult(newId, best);
      remember(newId);
    }
    var pity0 = null;
    if (!c.merge) { if (!p.afkRelicPity || typeof p.afkRelicPity !== 'object') p.afkRelicPity = {}; pity0 = p.afkRelicPity[target] || 0; p.afkRelicPity[target] = success ? 0 : pity0 + 1; }
    if (!saveOk()) {
      if (pity0 != null) p.afkRelicPity[target] = pity0;
      if (tk) { tk.restore(); }
      if (restoreMats) restoreMats();
      if (undoCrystal) undoCrystal();
      p.gold = gold0; adjustDia(c.dia);
      try { saveGame(); } catch (e) {}
      return { ok: false, msg: '存檔失敗，什麼都沒有改變（龍鑽與金幣已退回）。' };
    }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    var nm = (DB.items[g.base] || {}).n;
    var msg = success
      ? '哈瑪大師的鐵鎚落下最後一擊——' + nm + ' +' + target + '。' + (target === fxAt(g.base) && fx ? '「' + DB.items[fx].n + '」的力量也一併烙進了刃中。' : '')
      : '火花熄滅，' + nm + ' 仍停在 +' + g.n + '。（遺物安然無損）' + (!c.merge ? '下一次衝 +' + target + ' 的成功率 ' + Math.round(costOf(target, g.base).rate * 100) + '%。' : '');
    try { logSys('<span class="' + (success ? 'text-amber-300 font-bold' : 'text-slate-300') + '">' + msg + '</span>'); } catch (e) {}
    return { ok: true, success: success, msg: msg, id: success ? newId : null };
  }


  // ── 昇華支配（+15 之後；飾品為 +10 之後，保留舊 +5 昇華物品）──────
  //   +15 → 昇華支配 +0：10 萬龍鑽、席琳結晶 1 萬、夢艷結晶 500、地獄精華 100、四屬性滅魔蔑視水晶各 5、
  //                     四大古代龍鱗盔甲各 1、真．冥皇套裝（名稱以「真．冥皇」開頭的裝備）各 1；成功率 100%
  //   +0→+1～+3→+4：四屬性滅魔蔑視水晶各 20、至暗星塵 5；成功率 100%／50%／30%／10%
  //   +4→+5：至暗星塵 50、境滅亡域鑰匙 1；成功率 100%
  //   夢域塵：每顆成功率 +10%，一次最多 5 顆。失敗時材料消耗、遺物不會消失。
  var CONTEMPT = ['afk_contempt_earth', 'afk_contempt_water', 'afk_contempt_wind', 'afk_contempt_fire'];
  var DRAGON_ARMORS = ['古代地龍鱗盔甲', '古代水龍鱗盔甲', '古代火龍鱗盔甲', '古代風龍鱗盔甲'];
  var mingNames = null;
  function mingSet() {
    if (mingNames) return mingNames;
    var seen = {};
    Object.keys(DB.items).forEach(function (id) { var d = DB.items[id]; if (d && /^真．冥皇/.test(d.n || '') && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && !d.relic) seen[d.n] = 1; });
    mingNames = Object.keys(seen);
    return mingNames;
  }
  function ascCost(A) {
    var c = { dia: 0, items: {}, equip: [], rate: 1 };
    if (A === 0) {
      c.dia = 100000;
      c.items = { sherine_crystal: 10000, afk_dream_crystal: 500, afk_hell_essence: 100 };
      CONTEMPT.forEach(function (id) { c.items[id] = 5; });
      c.equip = DRAGON_ARMORS.concat(mingSet());
    } else if (A <= 4) {
      CONTEMPT.forEach(function (id) { c.items[id] = 20; });
      c.items.afk_dark_stardust = 5;
      c.rate = [1, 0.5, 0.3, 0.1][A - 1];
    } else {
      c.items = { afk_dark_stardust: 50, afk_abyss_key: 1 };
    }
    return c;
  }
  var DUST = 'afk_dream_dust';
  var invCnt = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s2, i) { return s2 + (i && i.id === id && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  var nameCnt = function (nm) { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && !i.lock && DB.items[i.id] && DB.items[i.id].n === nm; }).length : 0; };
  function snapInv() { var p = P(), snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; }); return function () { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); }; }
  function takeId(id, k) {
    var p = P();
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c2 = Math.max(1, Math.floor(Number(it.cnt) || 1)), use = Math.min(c2, k);
      k -= use; if (c2 - use <= 0) p.inv.splice(i, 1); else it.cnt = c2 - use;
    }
    return k <= 0;
  }
  function takeName(nm) {   // 同名裝備拿走 1 件：先拿沒詞綴、強化值低的
    var p = P();
    var cand = p.inv.filter(function (i) { return i && !i.lock && DB.items[i.id] && DB.items[i.id].n === nm; })
      .sort(function (a, b) { return (affixScore(a) - affixScore(b)) || ((Number(a.en) || 0) - (Number(b.en) || 0)); });
    if (!cand.length) return false;
    var it = cand[0], c2 = Math.max(1, Math.floor(Number(it.cnt) || 1));
    if (c2 > 1) it.cnt = c2 - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    return true;
  }
  function ascMissing(c) {
    var miss = [];
    if (c.dia && diamonds() < c.dia) miss.push('龍之鑽石 ' + c.dia.toLocaleString());
    Object.keys(c.items).forEach(function (id) { var h = invCnt(id); if (h < c.items[id]) miss.push(((DB.items[id] || {}).n || id) + ' ' + h + '/' + c.items[id]); });
    c.equip.forEach(function (nm) { if (nameCnt(nm) < 1) miss.push(nm); });
    return miss;
  }
  var dustUse = 0, stoneUse = false;
  var STONE = { wpn: 'afk_asc_stone_wpn', arm: 'afk_asc_stone_arm', acc: 'afk_asc_stone_acc' };
  var stoneOf = function (base) { var d = DB.items[base]; return d ? STONE[d.type] : null; };
  function ascend(key, dust, useStone) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物。' };
    var mx = maxOf(g.base), legacyAscended = mx === 10 && g.n === 5 && g.asc != null;
    if (g.n !== mx && !legacyAscended) return { ok: false, msg: '需要先強化到 +' + mx + '。' };
    var A = g.asc == null ? 0 : g.asc + 1;
    if (g.asc != null && typeof window.__afkRelicNoUp === 'function' && window.__afkRelicNoUp(makeId(g.base, g.n, g.fx, g.asc))) return { ok: false, msg: '這件遺物昇華支配後無法再強化。' };
    if (A > 5) return { ok: false, msg: '已經是昇華支配 +5（最高）。' };
    var c = ascCost(A), miss;
    if (useStone) {
      if (A < 1) return { ok: false, msg: '昇華支配強化石只能用在昇華支配 +1～+5。' };
      var sid = stoneOf(g.base); if (!sid) return { ok: false, msg: '找不到對應的強化石。' };
      c = { dia: 0, items: {}, equip: [], rate: 1 }; c.items[sid] = 1; dust = 0;
    }
    miss = ascMissing(c);
    dust = Math.max(0, Math.min(5, Math.floor(Number(dust) || 0), invCnt(DUST)));
    if (miss.length) return { ok: false, msg: '材料不足：' + miss.join('、') };
    var newId = makeId(g.base, g.n, g.fx, A);
    if (!ensure(newId)) return { ok: false, msg: '無法建立昇華支配資料。' };
    if (c.dia) { var pay = adjustDia(-c.dia); if (!pay.ok) return { ok: false, msg: pay.error }; }
    var undo = snapInv();
    var okTake = Object.keys(c.items).every(function (id) { return takeId(id, c.items[id]); })
      && c.equip.every(function (nm) { return takeName(nm); })
      && (!dust || takeId(DUST, dust));
    if (!okTake) { undo(); if (c.dia) adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    var rate = Math.min(1, c.rate + 0.10 * dust);
    var success = Math.random() < rate;
    if (success) {
      var tk = take(g, 1);
      if (tk.got.length < 1) { undo(); if (c.dia) adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
      pushResult(newId, tk.got[0]);
      remember(newId);
    }
    if (!saveOk()) { undo(); if (c.dia) adjustDia(c.dia); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    var nm = (DB.items[g.base] || {}).n;
    var msg = success ? nm + '浸透了支配的黑光，昇華為 +' + A + '。' + (useStone ? '（使用昇華支配強化石）' : (dust ? '（使用夢域塵 ' + dust + ' 顆）' : ''))
                      : '黑光退散，' + nm + ' 拒絕了支配；材料已化為灰燼。（成功率 ' + Math.round(rate * 100) + '%）';
    try { logSys('<span class="' + (success ? 'text-fuchsia-300 font-bold' : 'text-slate-300') + '">' + msg + '</span>'); } catch (e) {}
    return { ok: true, success: success, msg: msg, rate: rate, id: success ? newId : null };
  }
  // 至暗星塵：地獄精華 20 個合成 1 個，成功率 70%
  function craftStardust(times) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    times = Math.max(1, Math.floor(Number(times) || 1));
    times = Math.min(times, Math.floor(invCnt('afk_hell_essence') / 20));
    if (times < 1) return { ok: false, msg: '地獄精華不足 20 個。' };
    var undo = snapInv();
    if (!takeId('afk_hell_essence', 20 * times)) { undo(); return { ok: false, msg: '背包資料變動。' }; }
    var ok = 0; for (var i = 0; i < times; i++) if (Math.random() < 0.7) ok++;
    if (ok) gainItem('afk_dark_stardust', ok, true, true);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    var msg = '哈瑪大師熔煉了 ' + (20 * times) + ' 個地獄精華：成功 ' + ok + ' 次、失敗 ' + (times - ok) + ' 次，獲得至暗星塵 × ' + ok + '。';
    try { logSys('<span class="text-violet-300">' + msg + '</span>'); } catch (e) {}
    return { ok: true, made: ok, tries: times, msg: msg };
  }


  // ── 至高的支配：昇華支配 +5 進化（材料＝六種時空材料各 1，100% 成功）──
  var TS_MATS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var EVO_MAX_EQUIP = 6;
  var equippedEvo = function (who) {
    if (!enabled()) return [];
    var out = []; var eq = (who || P() || {}).eq || {};
    Object.keys(eq).forEach(function (k) { var e = eq[k]; var d = e && DB.items[e.id]; if (d && d.relicEvo != null) out.push(d.relicEvo); });
    return out;
  };
  // 武器進化：抽一個第三詞綴（同 10/25 第三詞綴規則：隨機另一件同部位遺物，避開第二詞綴）
  var rollFx3Id = function (base, fx) {
    var pool = donorsFor(base).filter(function (id) { return id !== fx && !/~/.test(id); });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };
  function evolve(key) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物。' };
    if (g.asc !== 5 || g.evo != null) return { ok: false, msg: '只有「+5 昇華支配」才能進化。' };
    if (typeof window.__afkRelicNoUp === 'function' && window.__afkRelicNoUp(makeId(g.base, g.n, g.fx, g.asc))) return { ok: false, msg: '這件遺物無法進化。' };
    var miss = TS_MATS.filter(function (id) { return invCnt(id) < 1; });
    if (miss.length) return { ok: false, msg: '材料不足：' + miss.map(function (id) { return (DB.items[id] || {}).n || id; }).join('、') };
    var bd = DB.items[g.base], evo;
    var fx3w = null;
    if (bd && bd.type === 'wpn') { evo = EVO_WPN_NONE; fx3w = rollFx3Id(g.base, g.fx); }   // 武器：沒有特效，直接附第三詞綴
    else if (bd && bd.set === 'priest') evo = 9;   // 遺物・司祭苦行套裝：直接擁有全部八種
    else {
      var have = {}; equippedEvo(p).forEach(function (e) { have[e] = 1; });
      (p.inv || []).forEach(function (it) { var d = it && DB.items[it.id]; if (d && d.relicEvo != null) have[d.relicEvo] = 1; });
      var all8 = [1, 2, 3, 4, 5, 6, 7, 8];
      var pool = all8.filter(function (e) { return !have[e]; });
      if (!pool.length) pool = all8;
      evo = pool[Math.floor(Math.random() * pool.length)];
    }
    var newId = makeId(g.base, g.n, g.fx, 5, evo, fx3w);
    if (!ensure(newId)) return { ok: false, msg: '無法建立至高的支配資料。' };
    var undo = snapInv();
    if (!TS_MATS.every(function (id) { return takeId(id, 1); })) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    var tk = take(g, 1);
    if (tk.got.length < 1) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    pushResult(newId, tk.got[0]); remember(newId);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); updateUI(); } catch (e) {}
    var msg = bd.n + '褪去凡鐵之軀，成為至高的支配' + evoTag(evo) + (fx3w ? '，第三詞綴繼承了「' + DB.items[fx3w].n + '」' : '') + '。';
    try { logSys('<span class="text-yellow-300 font-bold">' + msg + '</span>'); } catch (e) {}
    return { ok: true, id: newId, evo: evo, msg: msg };
  }
  // 特效套用（核心補丁 24 的兩個掛點＋重算後）
  var evoSet = function (p) {
    var s2 = {}; equippedEvo(p).forEach(function (e) { if (e === 9) [1, 2, 3, 4, 5, 6, 7, 8].forEach(function (x) { s2[x] = 1; }); else s2[e] = 1; });
    return s2;
  };
  // 克特／死亡騎士／惡魔套裝會強制套裝變身；身上已是變身卡（神話以上）的型態時不蓋掉它，只給套裝本身的數值（玩家 2026-10-24 模擬發現）
  var hiForm = function (p) {
    try { var A = window.AFK_CARD_ASCENSION; if (!A || !p) return false; var keep = p._setPoly; p._setPoly = null; try { return !!A.active(p); } finally { p._setPoly = keep; } } catch (e) { return false; }
  };
  window.__afkSetBoost = function (p, setCheck) {
    var e = evoSet(p), keepForm = (e[1] || e[2] || e[3]) && hiForm(p);
    p._afkEvoFlat = null;
    if (keepForm) {
      var f = { ac: 0, hpR: 0 };
      if (e[1] && !((setCheck.kurt || 0) >= 4)) f.ac -= 4;
      if (e[2] && !((setCheck.dk || 0) >= 4)) f.ac -= 4;
      if (e[3] && !((setCheck.demon || 0) >= 4)) { f.ac -= 2; f.hpR += 5; }
      p._afkEvoFlat = f;
    } else {
      if (e[1]) setCheck.kurt = Math.max(setCheck.kurt || 0, 4);
      if (e[2]) setCheck.dk = Math.max(setCheck.dk || 0, 4);
      if (e[3]) setCheck.demon = Math.max(setCheck.demon || 0, 4);
    }
    if (e[4]) setCheck.kinglord = Math.max(setCheck.kinglord || 0, 4);
    if (e[5]) setCheck.emperor = Math.max(setCheck.emperor || 0, 5);
  };
  window.__afkAttrBoost = function (p, d) {
    if (!evoSet(p)[6]) return;
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + 30; });
  };
  if (typeof window.recomputeStats === 'function') {
    var oRecomp = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRecomp.apply(this, arguments);
      try {
        var p = P(), e = p && evoSet(p);
        if (p && !p._afkImmortalSeen && equippedEvo(p).length >= EVO_MAX_EQUIP) p._afkImmortalSeen = true;   // 湊滿 6 件 → 開放防具第三詞綴
        if (p && p.d && p._afkEvoFlat) { p.d.ac = (Number(p.d.ac) || 0) + p._afkEvoFlat.ac; p.d.hpR = (Number(p.d.hpR) || 0) + p._afkEvoFlat.hpR; }
        if (e && p.d) {
          if (e[7]) { ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er'].forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + 50; }); p.d.ac = (Number(p.d.ac) || 0) - 50; }
          if (e[8]) RES4.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + 100; });
        }
      } catch (e2) {}
      return r;
    };
  }
  // 最多同時裝備 6 件至高的支配
  if (typeof window.equipItem === 'function') {
    var oEquip = window.equipItem;
    window.equipItem = function (item) {
      var d = item && DB.items[item.id];
      if (d && d.relicEvo != null && equippedEvo().length >= EVO_MAX_EQUIP) {
        try { logSys('<span class="text-amber-300">至高的支配最多同時裝備 ' + EVO_MAX_EQUIP + ' 件，請先卸下一件。</span>'); } catch (e) {}
        return;
      }
      return oEquip.apply(this, arguments);
    };
  }
  // 至暗支配：裝滿 6 件 → 席琳的永生（免疫死亡一次，冷卻 30 秒）
  var immortalAt = 0;
  if (typeof window.killPlayer === 'function') {
    var oKillP = window.killPlayer;
    window.killPlayer = function () {
      try {
        var t = (typeof state !== 'undefined' && state) ? state.ticks : 0;
        if (equippedEvo().length >= EVO_MAX_EQUIP && t >= immortalAt && !player.dead) {
          immortalAt = t + 300;
          player.hp = Math.max(1, player.hp > 0 ? player.hp : 1);
          try { logCombat('<span class="text-yellow-300 font-bold">【至暗支配・席琳的永生】</span>席琳的手攫住了你將逝的靈魂，將它推回人間。（30 秒後可再次觸發）', 'heal'); } catch (e) {}
          try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
          return;
        }
      } catch (e) {}
      return oKillP.apply(this, arguments);
    };
  }

  // 滅魔蔑視水晶碎片 100 → 指定屬性水晶 1；昇華支配碎片 100 → 自選強化石 1；相消術卷軸 10 龍鑽 1 張
  function exchange(kind, arg, times) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    times = Math.max(1, Math.floor(Number(times) || 1));
    var from, to, per, nmTo;
    if (kind === 'shard') { from = 'afk_contempt_shard'; per = 100; to = 'afk_contempt_' + arg; }
    else if (kind === 'ascshard') { from = 'afk_asc_shard'; per = 100; to = STONE[arg]; }
    else if (kind === 'cancel') {
      var cost = 10 * times;
      if (diamonds() < cost) return { ok: false, msg: '龍之鑽石不足 ' + cost + '。' };
      var pay = adjustDia(-cost); if (!pay.ok) return { ok: false, msg: pay.error };
      gainItem('afk_cancel_scroll', times, true, true);
      if (!saveOk()) { try { saveGame(); } catch (e) {} }
      try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
      var m0 = '向哈瑪大師買了相消術卷軸 × ' + times + '（' + cost + ' 龍鑽）。';
      try { logSys('<span class="text-emerald-300">' + m0 + '</span>'); } catch (e) {}
      return { ok: true, msg: m0 };
    } else return { ok: false, msg: '未知的兌換。' };
    if (!DB.items[to]) return { ok: false, msg: '找不到兌換目標。' };
    times = Math.min(times, Math.floor(invCnt(from) / per));
    if (times < 1) return { ok: false, msg: (DB.items[from] || {}).n + '不足 ' + per + ' 個。' };
    var undo = snapInv();
    if (!takeId(from, per * times)) { undo(); return { ok: false, msg: '背包資料變動。' }; }
    gainItem(to, times, true, true);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    nmTo = DB.items[to].n;
    var msg = '哈瑪大師用 ' + (per * times) + ' 個' + DB.items[from].n + '換成了 ' + nmTo + ' × ' + times + '。';
    try { logSys('<span class="text-fuchsia-300">' + msg + '</span>'); } catch (e) {}
    return { ok: true, msg: msg };
  }

  // ── +15 以上遺物武器的屬性卷軸（象牙塔的碧恩；玩家 2026-10-29 晚從哈瑪大師搬過去；裝備在武器欄的那一把）────────────
  //   規則沿用碧恩：每張 7%、同屬性升階、第 5 階同屬性卷軸 1% 附加／重抽魔法；遺物免強化值門檻、原本有觸發特效的也能附加魔法。
  //   昇華支配的遺物魔法最高 5 星（一般 3 星）；5 星時轉換成新魔法（見 __afkAttr5）。
  var inHama = false;
  function relicWpnForAttr() {
    var p = P(); var it = p && p.eq && p.eq.wpn; var d = it && DB.items[it.id];
    if (!d || !d.relicPlus || d.type !== 'wpn' || d.relicPlus < 15) return null;
    return it;
  }
  function hamaAttr(ele) {
    if (!enabled()) return disabled();
    var it = relicWpnForAttr(); if (!it) return { ok: false, msg: '請先在武器欄裝備 +15 以上的遺物武器。' };
    if (typeof doBianAttr !== 'function') return { ok: false, msg: '找不到屬性卷軸功能。' };
    var d = DB.items[it.id];
    // 3 星以上不再抽（玩家 2026-10-27：4、5 星改用固定張數升級），避免一張卷軸把 3 星以上的魔法洗掉
    try { var ca = getAttrAffix(it.attr), cm = getAttrMagicProc(it); if (ca && ca.ele === ele && ca.tier >= 5 && cm && cm.star >= 3) return { ok: false, msg: cm.star >= starCap(it) ? '屬性魔法已經是最高星數。' : '3 星以上改用「升 1 星」：★3→★4 用 ' + STAR_UP[4].toLocaleString() + ' 張、★4→★5 用 ' + STAR_UP[5].toLocaleString() + ' 張同屬性卷軸，必定成功。' }; } catch (e) {}
    var oRel = window.isRelic, oTrig = window.weaponHasBaseTriggeredSkill, oRender = window.renderBianAttr;
    window.isRelic = function (x) { return x === d ? false : oRel.apply(this, arguments); };
    window.weaponHasBaseTriggeredSkill = function (x) { return x === d ? false : oTrig.apply(this, arguments); };
    window.renderBianAttr = function () {};
    inHama = true;
    try { doBianAttr('wpn', ele); } finally { inHama = false; window.isRelic = oRel; window.weaponHasBaseTriggeredSkill = oTrig; window.renderBianAttr = oRender; }
    return { ok: true };
  }
  // ── 一鍵衝星（玩家 2026-10-27）：同屬性卷軸連續使用，先把屬性衝到第 5 階，再衝屬性魔法星數，到目標或卷軸用完就停 ──
  //   規則與碧恩／單張使用完全相同：每張獨立 7% 升一階；第 5 階後每張 1% 抽一種該屬性魔法，
  //   抽到同一種 +1 星、抽到別種變成那種的 1 星。星數上限：昇華支配、至高的支配 5 星；+15 沒昇華 3 星。
  //   一次跑完才重算能力、存檔一次（不會一張一張刷新畫面）。
  var starCap = function (it) { var d = it && DB.items[it.id]; return d && d.relicAsc != null ? 5 : 3; };
  // 星數規則（玩家 2026-10-27 改）：1～3 星照碧恩抽（每張 1%，同一種 +1 星、別種從 1 星重來）；
  //   滿 3 星之後不再抽：★3→★4 固定用 3,000 張、★4→★5 固定用 5,000 張同屬性卷軸，必定成功（只有昇華支配、至高的支配能到 4、5 星）
  var STAR_UP = { 4: 3000, 5: 5000 };
  function autoAttr(target) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var it = relicWpnForAttr(); if (!it) return { ok: false, msg: '請先在武器欄裝備 +15 以上的遺物武器。' };
    if (typeof getAttrAffix !== 'function' || typeof ATTR_MAGIC_SKILLS === 'undefined' || typeof ATTR_SCROLLS === 'undefined' || typeof ATTR_ELE_PREFIX === 'undefined') return { ok: false, msg: '找不到屬性卷軸功能。' };
    var cap = starCap(it); target = Math.max(1, Math.min(cap, Math.floor(Number(target) || cap)));
    var cur = getAttrAffix(it.attr); if (!cur) return { ok: false, msg: '這把武器還沒有屬性：先用任一種屬性卷軸賦予屬性，一鍵衝星會沿用那個屬性。' };
    var ele = cur.ele, sc = ATTR_SCROLLS[ele], pool = ATTR_MAGIC_SKILLS[ele] || [];
    if (!sc || !pool.length) return { ok: false, msg: '這個屬性沒有可附加的魔法。' };
    var mg0 = (typeof getAttrMagicProc === 'function') ? getAttrMagicProc(it) : null;
    if (cur.tier >= 5 && mg0 && mg0.star >= target) return { ok: false, msg: '已經是 ' + '★'.repeat(mg0.star) + '，不用再衝。' };
    var have = invCnt(sc.id); if (have < 1) return { ok: false, msg: '沒有' + sc.n + '。' };
    var tier = cur.tier, mg = mg0 ? mg0.skId : null, star = mg0 ? mg0.star : 0, used = 0, tierUps = 0, hits = 0, resets = 0, bought = 0;
    var tier0 = tier, mgStart = mg, star0 = star, rollTo = Math.min(3, target);
    while (used < have && !(tier >= 5 && mg && star >= rollTo)) {
      used++;
      if (tier < 5) { if (Math.random() < 0.07) { tier++; tierUps++; } continue; }
      if (Math.random() < 0.01) {
        hits++;
        var pk = pool[Math.floor(Math.random() * pool.length)].skId;
        if (mg && pk === mg) star = Math.min(3, star + 1); else { if (mg) resets++; mg = pk; star = 1; }
      }
    }
    var short = 0;
    while (tier >= 5 && mg && star >= 3 && star < target) {
      var cost = STAR_UP[star + 1];
      if (have - used < cost) { short = cost - (have - used); break; }
      used += cost; star++; bought++;
    }
    if (!used) return { ok: false, msg: '卷軸不足：升到 ' + '★'.repeat(star + 1) + ' 需要 ' + STAR_UP[star + 1].toLocaleString() + ' 張' + sc.n + '（目前 ' + have.toLocaleString() + ' 張）。' };
    if (!takeId(sc.id, used)) return { ok: false, msg: '背包資料變動，什麼都沒有改變。' };
    it.attr = ATTR_ELE_PREFIX[ele] + tier;
    if (mg) { it.attrMagic = mg; it.attrMagicStar = star; }
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    saveOk();
    try { if (typeof renderTabs === 'function') renderTabs(true); if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    var skN = function (id) { return (DB.skills[id] && DB.skills[id].n) || id; };
    var done = tier >= 5 && mg && star >= target;
    var msg = '碧恩一口氣用了 ' + used.toLocaleString() + ' 張' + sc.n + '：'
      + (tierUps ? '屬性第 ' + tier0 + ' 階 → 第 ' + tier + ' 階；' : '屬性第 ' + tier + ' 階；')
      + (mg ? (mgStart === mg && star0 ? skN(mg) + ' ' + '★'.repeat(star0) + ' → ' + '★'.repeat(star) : '屬性魔法 ' + skN(mg) + ' ' + '★'.repeat(star)) : '還沒抽到屬性魔法')
      + (hits ? '（刻印回應 ' + hits + ' 次' + (resets ? '，其中 ' + resets + ' 次換成別種魔法、星數重來' : '') + '）' : '')
      + (bought ? '（3 星以上固定升星 ' + bought + ' 次）' : '')
      + (done ? '。達成目標 ' + '★'.repeat(target) + '！' : short ? '。升下一星還差 ' + short.toLocaleString() + ' 張。' : '。卷軸用完了，還差一點。');
    try { logSys('<span class="' + (done ? 'text-yellow-300 font-bold' : 'text-slate-300') + '">' + esc(msg) + '</span>'); } catch (e) {}
    return { ok: true, done: done, used: used, tier: tier, magic: mg, star: star, msg: msg };
  }
  function askAutoAttr(target) {
    var it = relicWpnForAttr(), cur = it && typeof getAttrAffix === 'function' ? getAttrAffix(it.attr) : null;
    if (!it || !cur) { var r0 = autoAttr(target); if (!r0.ok) { try { logSys('<span class="text-red-400">' + esc(r0.msg) + '</span>'); } catch (e) {} } return refreshAttr(); }
    var sc = ATTR_SCROLLS[cur.ele], have = invCnt(sc.id);
    var msg = '用' + sc.n + '一鍵衝到 ' + '★'.repeat(target) + '（' + DB.items[it.id].n + '）。\n'
      + (cur.tier < 5 ? '會先把屬性衝到第 5 階（每張 7%），' : '') + '1～3 星每張 1% 抽一種屬性魔法（抽到同一種 +1 星、抽到別種從 1 星重來）'
      + (target > 3 ? '；滿 3 星後 ★3→★4 固定 ' + STAR_UP[4].toLocaleString() + ' 張、★4→★5 固定 ' + STAR_UP[5].toLocaleString() + ' 張，必定成功' : '') + '。'
      + '\n到達目標或卷軸用完就停；最多用掉全部 ' + have.toLocaleString() + ' 張。';
    var go = function () { var r = autoAttr(target); refreshAttr(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '一鍵 ' + target + ' 星', message: msg, okText: '開始', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  var ATTR5 = {
    fire: { n: '爆炎流星雨', sk: ['sk_meteor'] },
    water: { n: '寒冬冰雪暴', sk: ['sk_fire_storm', 'sk_blizzard'] },
    wind: { n: '靈魂風暴', sk: ['sk_thunder_storm', 'sk_tornado'] },
    earth: { n: '陷陣岩崩', sk: ['sk_earthquake', 'sk_blaze'] }   // 遊戲裡沒有「炎爆術」，以烈炎術代替
  };
  window.__afkAttr5 = function (target, inst, wpn, proc) {
    if (!enabled()) return;
    if (Math.random() * 100 >= 25) return;   // 5% × 5 星
    var cfg = ATTR5[proc.ele]; if (!cfg) return;
    try { logCombat('<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #a21caf">【' + cfg.n + '】</span>支配之力自遺物中奔湧而出。', 'player-special'); } catch (e) {}
    var prev = window.__afkSpellMult; window.__afkSpellMult = 1.5;
    try {
      for (var k = 0; k < 3; k++) cfg.sk.forEach(function (skId) {
        var sk = DB.skills[skId]; if (!sk) return;
        var alive = mapState.mobs.filter(function (m) { return m && m.curHp > 0 && !m._dead; });
        if (!alive.length) return;
        if (sk.target === 'all') procFreeMagicSkill(alive[0], skId, 0, false, wpn);
        else alive.forEach(function (m) { procFreeMagicSkill(m, skId, 0, true, wpn); });
      });
    } finally { window.__afkSpellMult = prev; }
  };

  // ── 能力預覽 ──
  function statLine(d, base) {
    var b = DB.items[base], out = b.type === 'wpn' ? ['小型／大型傷害 ' + d.dmgS + '／' + d.dmgL] : ['防禦 ' + (-(d.ac || 0)) + '、魔法防禦 ' + (d.mr || 0)];
    ['er', 'dr', 'hpR', 'mpR'].forEach(function (f) { if ((d[f] || 0) !== (b[f] || 0)) out.push(f + ' ' + (b[f] || 0) + '→' + d[f]); });
    if ((d.resFire || 0) !== (b.resFire || 0) && !d.relicFxRes) out.push('四屬性抗性 +' + ((d.resFire || 0) - (b.resFire || 0)));
    if (d.highestAttrPlus && d.highestAttrPlus !== b.highestAttrPlus && d.highestAttrPlus !== true) out.push('主屬性強化 +' + d.highestAttrPlus);
    if (d.fireNullifyTicks) out.push(d.fireNullifyTicks <= 1 ? '火焰化解：完全免疫' : '火焰化解每 ' + d.fireNullifyTicks / 10 + ' 秒');
    if (b.type === 'wpn') WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0 && d[f] !== b[f]) out.push(f + ' ' + b[f] + '→' + d[f]); });
    Object.keys(b).forEach(function (f) {
      var v = b[f];
      if (typeof v === 'number' && RATE_TOP.test(f) && d[f] !== v) out.push(f + ' ' + v + '%→' + d[f] + '%');
      else if (v && typeof v === 'object' && /^proc/.test(f)) {
        if (d[f] && typeof v.rate === 'number' && d[f].rate !== v.rate) out.push(f + ' ' + v.rate + '%→' + d[f].rate + '%');
        else if (d[f] && typeof v.pct === 'number' && d[f].pct !== v.pct) out.push(f + ' ' + v.pct + '%→' + d[f].pct + '%');
      }
    });
    if (d.relicBleedBonus) out.push('出血 20%→' + (20 + d.relicBleedBonus) + '%');
    return out.join('、');
  }
  var LABEL = { er: '遠距迴避', dr: '傷害減免', hpR: '生命自然恢復', mpR: '魔力自然恢復', hit: '近距命中', dmgBonus: '近距傷害', bowHit: '遠距命中', bowDmg: '遠距傷害', magicHit: '魔法命中', mdmg: '魔法傷害', extraDmg: '額外傷害',
    str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力', mr: '魔法防禦', extraMp: '額外魔力',
    comboRate: '連擊率', pierceChance: '穿透率', procRateBase: '技能觸發率', procPoison: '中毒率', procStatusSkill: '異常觸發率', procBonusDmg: '追加傷害率', procBurn: '灼燒率', procPoisonPct: '劇毒率', dblStrikeRate: '雙重破壞率', missGrazeRate: '擦傷率', heavyRatePct: '重擊率', windSpellProcRate: '風系法術觸發率', procFireSkillRate: '火系法術觸發率', procPoisonRate: '中毒率' };
  var pretty = function (s) { return s.replace(/([a-zA-Z]+)(?= )/g, function (k) { return LABEL[k] || k; }); };

  // ── 視窗 ──
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var layer = null;
  function css() {
    if (document.getElementById('rp-css')) return;
    var st = document.createElement('style'); st.id = 'rp-css';
    st.textContent = [
      '.rp-open{display:block;width:100%;margin:0 0 12px;padding:9px 12px;border:1px solid #b45309;border-radius:9px;background:linear-gradient(135deg,#3b2105,#6b3a0a);color:#fde68a;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}',
      '.rp-open:hover{filter:brightness(1.15)}',
      '#rp-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9700;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font-size:14px;line-height:1.65}',
      '.rp-box{width:min(760px,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;background:#0b1220;border:2px solid #b45309;border-radius:14px;overflow:hidden;color:#e2e8f0;box-shadow:0 22px 60px rgba(0,0,0,.75)}',
      '.rp-head{display:flex;flex-wrap:wrap;flex-shrink:0;align-items:center;gap:10px;padding:11px 14px;background:#1c1206;border-bottom:1px solid #78350f;font-weight:800;font-size:17px;color:#fcd34d}',
      '.rp-head .rp-bal{margin-left:auto;font-weight:600;font-size:13px;color:#e2e8f0}',
      '.rp-x{border:0;background:#334155;color:#e2e8f0;border-radius:6px;min-width:40px;min-height:40px;padding:2px 10px;cursor:pointer;font-size:18px}',
      '.rp-content{min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '.rp-rule{padding:8px 14px;font-size:13px;color:#cbd5e1;border-bottom:1px solid #1e293b;line-height:1.7;flex-shrink:0}',
      '.rp-rule summary{cursor:pointer;font-weight:700;color:#fde68a}.rp-rule p{margin:8px 0}',
      '.rp-list{padding:8px 10px}',
      '.rp-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px;border:1px solid #1e293b;border-radius:9px;margin-bottom:6px;background:#0f172a}',
      '.rp-row img{width:36px;height:36px;image-rendering:pixelated;flex:0 0 auto}',
      '.rp-eqtag{display:inline-block;font-size:11.5px;font-weight:700;color:#fde68a;border:1px solid rgba(253,230,138,.55);border-radius:3px;padding:0 5px;margin-left:4px;vertical-align:1px}.rp-mid{flex:1 1 180px;min-width:0}.rp-nm{font-weight:800;color:#67e8f9}.rp-sub{font-size:13px;color:#94a3b8;margin-top:2px;overflow-wrap:break-word}',
      '.rp-go{flex:0 1 auto;max-width:100%;min-height:40px;padding:6px 10px;border-radius:8px;border:1px solid #b45309;background:#78350f;color:#fef3c7;font-weight:800;cursor:pointer;font-size:13px;white-space:normal}',
      '.rp-go[disabled]{opacity:.45;cursor:not-allowed}',
      '.rp-empty{padding:30px;text-align:center;color:#64748b}',
      '.rp-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid #1e293b;font-size:13px;color:#cbd5e1}',
      '.rp-tools button,.rp-tools select{font:inherit;min-height:40px;max-width:100%;padding:4px 10px;border-radius:7px;border:1px solid #6d28d9;background:#2e1065;color:#ede9fe;cursor:pointer}',
      '.rp-tools select{font-size:16px}.rp-tools input[type=checkbox]{min-width:18px;min-height:18px}',
      '.rp-tools button[disabled]{opacity:.45;cursor:not-allowed}',
      '.rp-asc{border-color:#a21caf!important;background:#4a044e!important;color:#fae8ff!important}',
      '.rp-miss{color:#fca5a5}',
      '#rp-modal.rp-embed{position:static;inset:auto;background:none;padding:0;z-index:auto;display:block}',
      '.rp-embed .rp-box{width:100%;max-height:none;border:0;border-radius:0;box-shadow:none;background:transparent;font-size:14px}',
      '.rp-embed .rp-head{background:transparent;border-bottom:1px solid #334155;padding:4px 2px 8px;font-size:15px}',
      '.rp-embed .rp-x{display:none}',
      '.rp-embed .rp-content{overflow:visible}',
      '.rp-embed .rp-rule{font-size:14px;color:#cbd5e1;padding:8px 2px}',
      '.rp-embed .rp-tools{font-size:14px;padding:8px 2px}',
      '.rp-embed .rp-sub{font-size:13px}.rp-embed .rp-nm{font-size:15px}',
      '.rp-embed .rp-list{overflow:visible;padding:8px 0}'
    ].join('\n');
    document.head.appendChild(st);
  }
  // 介面（玩家 2026-10-29 晚：比照艾格尼絲——上面材料列、①選遺物（分類＋搜尋＋清單）、選中的那件在下面顯示詳細與按鈕、②其他服務一列一列）
  var ui = { filter: 'all', q: '', sel: '', more: 0 }, PAGE = 60;
  var KIND_N = { all: '全部', wpn: '武器', arm: '防具', acc: '飾品' };
  function build() {
    css(); if (window.__afkNpcKit) window.__afkNpcKit.css();
    var m = document.createElement('div'); m.id = 'rp-modal';
    m.innerHTML = '<div class="rp-box" role="dialog" aria-modal="true" aria-label="哈瑪大師・遺物強化"><div class="rp-head">🔨 哈瑪大師・遺物強化<span class="rp-bal" id="rp-bal"></span><button class="rp-x" type="button" id="rp-x" aria-label="關閉遺物強化">✕</button></div>'
      + '<div class="rp-content afk-ax"><p class="ax-lore">「同源的遺物會互相呼喚。把它們交給爐火，讓沉睡的力量醒來吧。」——哈瑪</p><div id="rp-mats"></div><details class="rp-rule"><summary>合成、昇華與費用說明</summary>'
      + '<div class="rp-doc">'
      + '<h5>武器、防具最高 +15</h5>'
      + '<table class="rp-tbl"><thead><tr><th>目標</th><th>材料</th><th>成功率</th></tr></thead><tbody>'
      + '<tr><td>+1～+5</td><td>2 件同款、同階遺物</td><td>100%</td></tr>'
      + '<tr><td>+6～+9</td><td>本體＋3 件同款 +1</td><td>80%／70%／60%／50%<small>失敗保留本體，3 件 +1 消耗</small></td></tr>'
      + '<tr><td>+10</td><td>本體 +9＋3 件同款 +5</td><td>100%</td></tr>'
      + '<tr><td>+11～+15</td><td>單件</td><td>10%<small>失敗保留遺物；每失敗一次同一階 +2%，最高 50%，成功後歸零</small></td></tr>'
      + '</tbody></table>'
      + '<p class="rp-fee">費用：+1～+6 每次 500 龍鑽＋5,000 萬金幣；+7～+10 每高一階再加 100 龍鑽＋1,000 萬金幣；+11～+15 每次 5 萬龍鑽。</p>'
      + '<h5>戒指、耳環、項鍊、腰帶等飾品最高 +10</h5>'
      + '<table class="rp-tbl"><thead><tr><th>目標</th><th>材料</th><th>成功率</th></tr></thead><tbody>'
      + '<tr><td>+1～+5</td><td>3 件同款、同階遺物</td><td>100%</td></tr>'
      + '<tr><td>+6～+10</td><td>2 件同款、同階遺物</td><td>50%<small>失敗時遺物都還在</small></td></tr>'
      + '</tbody></table>'
      + '<p class="rp-fee">費用：龍鑽與金幣為武器／防具的 3 倍，另需席琳結晶 500 顆。</p>'
      + '<dl class="rp-dl">'
      + '<dt>能力成長</dt><dd>武器每 +1：小型／大型傷害各 +1，每 +3 原有能力各 +1。防具、飾品每 +1：防禦 −1、魔法防禦 +1；每 +3 遠距迴避 +1；每 +5 傷害減免 +1。各件的專屬階段數值優先，完整效果見小百科「遺物進階」。</dd>'
      + '<dt>第二詞綴</dt><dd>武器、防具 +10；飾品 +5。隨機抽同部位另一件遺物，繼承它原始特效中沒重複的欄位；沒有可繼承的效果時，改給四屬性抗性各 +3。</dd>'
      + '<dt>昇華支配</dt><dd>武器、防具 +15，飾品 +10 後開放。每 +1：武器大小型傷害各 +10、原有能力各 +5；防具、飾品六項能力各 +1、防禦 −1、魔法防禦／遠距迴避／減傷各 +1、四屬性抗性各 +2；防具另加生命、魔力自然恢復各 50。</dd>'
      + '<dt>注意</dt><dd>只用背包裡未鎖定的遺物與材料；穿戴中、倉庫內或上鎖的不列入。第 029 件昇華後即達終階；GM 測試道具不能合成。</dd>'
      + '</dl></div></details>'
      + '<div class="ax-h">① 選擇遺物</div><div class="rp-list" id="rp-list"></div>'
      + '<div class="ax-h">② 熔煉與兌換</div><div class="rp-svc" id="rp-tools"></div></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('rp-x').onclick = close;
    var listEl = document.getElementById('rp-list'), qT = 0;
    listEl.addEventListener('click', function (e) {
      var f = e.target.closest('[data-rpf]'); if (f) { ui.filter = f.getAttribute('data-rpf'); ui.more = 0; render(); return; }
      if (e.target.closest('[data-rpmore]')) { ui.more++; render(); return; }
      var pk = e.target.closest('[data-rppick]'); if (pk) { ui.sel = pk.getAttribute('data-rppick'); render(); return; }
      var b = e.target.closest('.rp-go'); if (!b || b.disabled) return;
      if (b.classList.contains('rp-evo')) askEvo(b.getAttribute('data-k'));
      if (b.classList.contains('rp-fx3')) askFx3(b.getAttribute('data-k'));
      else if (b.classList.contains('rp-asc')) askAsc(b.getAttribute('data-k')); else ask(b.getAttribute('data-k'));
    });
    listEl.addEventListener('input', function (e) {
      if (e.target.id !== 'rp-q') return;
      ui.q = e.target.value; ui.more = 0; clearTimeout(qT);
      qT = setTimeout(function () { render(); var q = document.getElementById('rp-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e2) {} } }, 250);
    });
    document.getElementById('rp-tools').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-rpsvc]'); if (!b || b.disabled) return;
      var v = b.getAttribute('data-rpsvc').split(':'), r;
      if (v[0] === 'craft') r = craftStardust(Number(v[1]));
      else if (v[0] === 'ex') r = exchange(v[1], v[2] || null, Number(v[3]) || 1);
      if (r && !r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e2) {} }
      render();
    });
    document.getElementById('rp-tools').addEventListener('change', function (e) { if (e.target.id === 'rp-dust') { dustUse = Number(e.target.value) || 0; render(); } if (e.target.id === 'rp-stone') { stoneUse = !!e.target.checked; render(); } });
  }
  // 一組遺物的下一步：按鈕、說明、清單上的短標籤、材料夠不夠
  function info(g) {
    var bd = DB.items[g.base], cur = DB.items[makeId(g.base, g.n, g.fx, g.asc)] || bd;
    var mx = maxOf(g.base), t = g.n + 1, c = g.asc == null && t <= mx ? costOf(t, g.base) : null, btn, ascTxt = '', label = '', ready = false;
    if (!c) {
      var A = g.asc == null ? 0 : g.asc + 1;
      if (g.asc != null && typeof window.__afkRelicNoUp === 'function' && window.__afkRelicNoUp(makeId(g.base, g.n, g.fx, g.asc))) {
        btn = '<button class="rp-go" disabled>已達終階</button>'; label = '已達終階';
        ascTxt = '<div class="rp-sub">這件遺物昇華支配後即達終階，沒有後續強化。</div>';
      }
      else if (A > 5 && g.evo != null) {
        var lk = fx3Lock(g), f3m = TS_MATS.filter(function (id) { return invCnt(id) < 1; }).length || invCnt('afk_dark_stardust') < FX3_COST.stardust;
        ready = !lk && !f3m; label = lk ? '至高的支配' : (g.fx3 ? '重抽第三詞綴' : '抽第三詞綴');
        btn = lk ? '<button class="rp-go" disabled>至高的支配<br><span style="font-weight:600;font-size:13px">' + esc(EVO[g.evo] || '第三詞綴') + '</span></button>'
          : '<button class="rp-go rp-fx3" type="button" data-k="' + esc(g.key) + '"' + (f3m ? ' disabled' : '') + '>' + (g.fx3 ? '重抽' : '抽取') + '<br><span style="font-weight:600;font-size:13px">第三詞綴</span></button>';
        ascTxt = '<div class="rp-sub" style="color:#fde047">至高的支配' + esc(evoTag(g.evo)) + (g.fx3 ? '；第三詞綴：' + esc((DB.items[g.fx3] || {}).n || g.fx3) : '') + '</div>'
          + '<div class="rp-sub">' + (lk ? esc(lk) : '第三詞綴：消耗六種時空材料各 1、至暗星塵 ' + FX3_COST.stardust + '（至暗星塵 ' + invCnt('afk_dark_stardust') + '）') + '</div>';
      }
      else if (A > 5) {
        var evMiss = TS_MATS.filter(function (id) { return invCnt(id) < 1; });
        ready = !evMiss.length; label = '進化：至高的支配';
        btn = '<button class="rp-go rp-evo" type="button" data-k="' + esc(g.key) + '"' + (evMiss.length ? ' disabled' : '') + '>進化<br><span style="font-weight:600;font-size:13px">至高的支配 100%</span></button>';
        ascTxt = '<div class="rp-sub" style="color:#fde047">進化：隨機獲得一種至高的支配特效（' + (bd.type === 'wpn' ? '武器沒有八種特效，改成進化時直接附上「第三詞綴」：隨機繼承另一件遺物的能力，之後可在這裡重洗' : '克特／死亡騎士／惡魔／四大軍王／真．冥皇套裝、全能力 +30、面板能力 +50、四屬性抗性 +100，不跟你已有的重複') + '）' + (bd.set === 'priest' ? '；遺物・司祭苦行套裝直接擁有全部八種' : '') + '</div>'
          + '<div class="rp-sub">需要：' + TS_MATS.map(function (id) { var h = invCnt(id); return '<span class="' + (h ? '' : 'rp-miss') + '">' + esc((DB.items[id] || {}).n || id) + ' ' + h + '/1</span>'; }).join('、') + '</div>';
      }
      else {
        var ac = ascCost(A), rate = Math.min(1, ac.rate + 0.1 * dustUse);
        if (stoneUse && A >= 1 && stoneOf(g.base)) { ac = { dia: 0, items: {}, equip: [], rate: 1 }; ac.items[stoneOf(g.base)] = 1; rate = 1; }
        var miss = ascMissing(ac);
        ready = !miss.length; label = '昇華支配 +' + A;
        btn = '<button class="rp-go rp-asc" type="button" data-k="' + esc(g.key) + '"' + (miss.length ? ' disabled' : '') + '>昇華支配 +' + A + '<br><span style="font-weight:600;font-size:13px">成功率 ' + Math.round(rate * 100) + '%</span></button>';
        var need = [];
        if (ac.dia) need.push('龍鑽 ' + ac.dia.toLocaleString());
        Object.keys(ac.items).forEach(function (id) { var h = invCnt(id), ok = h >= ac.items[id]; need.push('<span class="' + (ok ? '' : 'rp-miss') + '">' + esc((DB.items[id] || {}).n || id) + ' ' + h + '/' + ac.items[id] + '</span>'); });
        ac.equip.forEach(function (nm) { need.push('<span class="' + (nameCnt(nm) ? '' : 'rp-miss') + '">' + esc(nm) + '</span>'); });
        var nd2 = buildDef(g.base, g.n, g.fx, A);
        ascTxt = '<div class="rp-sub" style="color:#f0abfc">昇華支配 +' + A + '：' + esc(pretty(statLine(nd2, g.base))) + '</div><div class="rp-sub">需要：' + need.join('、') + '</div>';
      }
    } else {
      var mg0 = c.matNeed ? matGroup(g, c.matLv) : null, matHave = mg0 ? mg0.cnt : 0;
      var enough = g.cnt >= c.need && (!c.matNeed || matHave >= c.matNeed) && diamonds() >= c.dia && gold() >= c.gold && (!c.crystal || crystals() >= c.crystal);
      var ap = (!enough && !(g.cnt >= c.need && (!c.matNeed || matHave >= c.matNeed))) ? autoPlan(g) : null, apOk = !!(ap && ap.cost.afford), cs = apOk ? ap.cost : c;
      ready = enough || apOk; label = (c.merge ? '合成 +' : '強化 +') + t;
      btn = '<button class="rp-go" type="button" data-k="' + esc(g.key) + '"' + (enough || apOk ? '' : ' disabled') + (apOk ? ' title="材料不夠，會先用背包裡的低階同款自動合成補上"' : '') + '>'
        + (c.merge ? '合成 +' + t + (c.rate < 1 ? '（' + Math.round(c.rate * 100) + '%）' : '') : '強化 +' + t + '（' + Math.round(c.rate * 100) + '%）') + (apOk ? '<span style="font-size:12px;color:#86efac">（自動補料）</span>' : '') + '<br><span style="font-weight:600;font-size:13px">' + cs.dia.toLocaleString() + ' 鑽' + (cs.gold ? '＋' + (cs.gold / 10000).toLocaleString() + ' 萬' : '') + (cs.crystal ? '＋結晶 ' + cs.crystal : '') + (c.need > 2 ? '（' + c.need + ' 個）' : '') + (c.matNeed ? '＋同款 +' + c.matLv + ' ×' + c.matNeed + '（有 ' + matHave + '）' : '') + '</span></button>';
    }
    var nextTxt = '';
    if (c) { var nid = makeId(g.base, t, g.fx); var nd = DB.items[nid] || buildDef(g.base, t, g.fx); nextTxt = '下一級：' + pretty(statLine(nd, g.base)) + (t === fxAt(g.base) && !g.fx && mx >= t ? '、獲得第二詞綴（隨機同部位遺物特效）' : ''); }
    return { bd: bd, cur: cur, btn: btn, ascTxt: ascTxt, nextTxt: nextTxt, label: label, ready: ready };
  }
  var gName = function (g, bd) { return g.asc != null ? '+' + g.asc + ' ' + esc(bd.n) + '昇華支配' : (g.n ? '+' + g.n + ' ' : '') + esc(bd.n); };
  var gImg = function (bd) { var img = ''; try { img = getIconUrl(bd); } catch (e) {} return img; };
  function render() {
    var K = window.__afkNpcKit;
    var bal = document.getElementById('rp-bal'); if (bal) bal.innerHTML = '';
    var mats = document.getElementById('rp-mats');
    if (mats && K) mats.innerHTML = K.matBar([{ img: 'assets/icons/items/龍之鑽石.png', n: '龍之鑽石', v: diamonds() }, { img: 'assets/icons/items/金幣.png', n: '金幣', v: gold() }, CRYSTAL, 'afk_dark_stardust', DUST, STONE.wpn, STONE.arm, STONE.acc]);
    var tools = document.getElementById('rp-tools');
    if (tools && K) {
      var ess = invCnt('afk_hell_essence'), dustHave = invCnt(DUST);
      if (dustUse > Math.min(5, dustHave)) dustUse = Math.min(5, dustHave);
      var opts = ''; for (var di = 0; di <= Math.min(5, dustHave); di++) opts += '<option value="' + di + '"' + (di === dustUse ? ' selected' : '') + '>夢域塵 ' + di + ' 顆</option>';
      var shard = invCnt('afk_contempt_shard'), ascS = invCnt('afk_asc_shard'), cancel = invCnt('afk_cancel_scroll');
      var ico = function (id) { return DB.items[id] ? K.itemIco(id) : K.icoTag('', '', false); };
      tools.innerHTML = [
        { ico: ico('afk_dark_stardust'), name: '熔煉至暗星塵', color: '#c4b5fd', desc: '20 個地獄精華熔成 1 個至暗星塵，成功率 70%（失敗精華照扣）。', note: '至暗星塵 ' + invCnt('afk_dark_stardust').toLocaleString(),
          req: K.reqTxt(ess, 20, '地獄精華'), btns: [['craft:1', '熔煉 ×1', ess >= 20], ['craft:10', '熔煉 ×10', ess >= 200]] },
        { ico: ico(DUST), name: '昇華支配的輔助', color: '#f0abfc', desc: '昇華支配時每顆夢域塵成功率 +10%（最多 5 顆）；勾選「改用昇華支配強化石」則每次只用 1 顆對應部位的強化石，必定成功。下面清單的昇華按鈕會照這裡的設定。',
          note: '強化石：武器 ' + invCnt(STONE.wpn) + '、防具 ' + invCnt(STONE.arm) + '、飾品 ' + invCnt(STONE.acc),
          pick: '<select id="rp-dust" aria-label="昇華支配使用夢域塵">' + opts + '</select><label class="rp-chk"><input type="checkbox" id="rp-stone"' + (stoneUse ? ' checked' : '') + '><span>改用昇華支配強化石</span></label>', btns: [] },
        { ico: ico('afk_contempt_shard'), name: '滅魔蔑視水晶', color: '#67e8f9', desc: '100 個滅魔蔑視水晶碎片換 1 個指定屬性的蔑視水晶。',
          req: K.reqTxt(shard, 100, '滅魔蔑視水晶碎片'), btns: [['earth', '地'], ['water', '水'], ['wind', '風'], ['fire', '火']].map(function (x) { return ['ex:shard:' + x[0] + ':1', x[1], shard >= 100]; }) },
        { ico: ico('afk_asc_shard'), name: '昇華支配強化石', color: '#f0abfc', desc: '100 個昇華支配碎片換 1 顆指定部位的昇華支配強化石。',
          req: K.reqTxt(ascS, 100, '昇華支配碎片'), btns: [['wpn', '武器'], ['arm', '防具'], ['acc', '飾品']].map(function (x) { return ['ex:ascshard:' + x[0] + ':1', x[1], ascS >= 100]; }) },
        { ico: ico('afk_cancel_scroll'), name: '相消術卷軸', color: '#fde68a', desc: '每張 10 龍之鑽石。帶在身上時，暗夢星迴頭目張開聖結界會自動用掉 1 張。', note: '持有 ' + cancel.toLocaleString(),
          btns: [1, 10, 100].map(function (n) { return ['ex:cancel::' + n, '買 ' + n, diamonds() >= 10 * n]; }) }
      ].map(function (sv) { return K.rowHtml(sv, 'data-rpsvc'); }).join('')
        + '<div class="ax-note">武器屬性卷軸（+15 以上遺物武器的屬性與屬性魔法星數）改到象牙塔的碧恩那裡。</div>';
    }
    var list = document.getElementById('rp-list'); if (!list) return;
    var gs = groups();
    if (!gs.length) { list.innerHTML = '<div class="rp-empty">背包和身上都沒有可合成的遺物。請從倉庫取出，並確認物品未鎖定。</div>'; return; }
    var q = String(ui.q || '').trim();
    var shown = gs.filter(function (g) { var bd = DB.items[g.base]; return (ui.filter === 'all' || bd.type === ui.filter) && (!q || String(bd.n).indexOf(q) >= 0 || gName(g, bd).indexOf(q) >= 0); });
    if (!gs.some(function (g) { return g.key === ui.sel; })) ui.sel = (shown[0] || gs[0]).key;
    var lim = PAGE * (1 + ui.more), part = shown.slice(0, lim);
    var lst = list.querySelector('.ax-list'), lt = lst ? lst.scrollTop : 0;
    var h = '<div class="ax-filter">' + Object.keys(KIND_N).map(function (k) { return '<button type="button" data-rpf="' + k + '"' + (ui.filter === k ? ' class="on"' : '') + '>' + KIND_N[k] + '</button>'; }).join('')
      + '<input id="rp-q" type="search" placeholder="搜尋遺物名稱" aria-label="搜尋遺物名稱" value="' + esc(ui.q) + '" style="flex:1 1 140px;min-width:120px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:13px"></div>';
    h += '<div class="ax-list">' + (part.length ? part.map(function (g) {
      var f = info(g);
      return '<div class="ax-eq' + (g.key === ui.sel ? ' on' : '') + '" data-rppick="' + esc(g.key) + '">' + (K ? K.icoTag(gImg(f.bd), '', false) : '')
        + '<div style="min-width:0"><div class="rp-nm">' + gName(g, f.bd) + ' <span style="color:#94a3b8;font-weight:600">× ' + g.cnt + '</span>' + (g.eqSlots && g.eqSlots.length ? ' <span class="rp-eqtag">裝備中</span>' : '') + '</div>'
        + '<div class="ax-where">' + (f.label ? '下一步：<span class="' + (f.ready ? 'ok' : 'no') + '">' + esc(f.label) + (f.label === '已達終階' ? '' : f.ready ? '（可以做）' : '（材料不足）') + '</span>' : '') + (g.fx && DB.items[g.fx] ? '　・第二詞綴：' + esc(DB.items[g.fx].n) : '') + '</div></div></div>';
    }).join('') + (shown.length > lim ? '<div class="ax-eq ax-where" data-rpmore="1" style="justify-content:center;color:#fde68a">還有 ' + (shown.length - lim).toLocaleString() + ' 組，點這裡多顯示 ' + PAGE + ' 組，或用搜尋縮小範圍</div>' : '') : '<div class="ax-eq ax-where">沒有符合的遺物。</div>') + '</div>';
    var g = gs.filter(function (x) { return x.key === ui.sel; })[0];
    if (g) {
      var f = info(g);
      h += '<div class="ax-h">已選擇</div><div class="rp-row rp-selcard"><img src="' + esc(gImg(f.bd)) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
        + '<div class="rp-mid"><div class="rp-nm">' + gName(g, f.bd) + ' <span style="color:#94a3b8;font-weight:600">× ' + g.cnt + '</span>' + (g.eqSlots && g.eqSlots.length ? ' <span class="rp-eqtag">裝備中</span>' : '') + '</div>'
        + '<div class="rp-sub">目前：' + pretty(statLine(f.cur, g.base)) + (g.fx && DB.items[g.fx] ? (f.cur.relicFxRes ? '、第二詞綴：四屬性抗性 +3' : '、第二詞綴：「' + esc(DB.items[g.fx].n) + '」特效') : '') + '</div>'
        + (f.nextTxt ? '<div class="rp-sub" style="color:#fcd34d">' + esc(f.nextTxt) + '</div>' : '') + f.ascTxt + '</div>' + f.btn + '</div>';
    }
    list.innerHTML = h;
    var nl = list.querySelector('.ax-list'); if (nl) nl.scrollTop = lt;
  }
  // ── 自動補料（玩家 2026-10-27：例如要 +2 但只有一件 +1，背包有 +0 就自動先合成 +1，材料不夠才變灰）──
  //   只用「沒有第二詞綴、沒昇華」的低階同款，且只走成功率 100% 的合成步驟（武器／防具 +5 以下、飾品 +4 以下），
  //   不會動到身上穿的、鎖定的；總花費（龍鑽、金幣、席琳結晶）連同最後一步一起算，夠才亮。
  var plainCnt = function (base) {
    var p = P(), out = {};
    (p && p.inv || []).forEach(function (it) {
      if (!it || it.lock || !it.id || baseOf(it.id) !== base || fxOf(it.id) || ascOf(it.id) != null || evoOf(it.id) != null) return;
      var n = levelOf(it.id); out[n] = (out[n] || 0) + Math.max(1, Math.floor(Number(it.cnt) || 1));
    });
    return out;
  };
  function autoPlan(g) {
    if (!g || g.asc != null || g.evo != null) return null;
    var mx = maxOf(g.base), t = g.n + 1; if (t > mx) return null;
    var c = costOf(t, g.base); if (!c.merge) return null;
    var avail = plainCnt(g.base), steps = [], cost = { dia: c.dia, gold: c.gold, crystal: c.crystal || 0 };
    var safeLv = fxAt(g.base) - 1;   // 做到這一級以內不會跑出第二詞綴
    var produce = function (lv, m) {   // 做出 m 件新的 +lv（沒有詞綴）
      if (m <= 0) return true;
      if (lv <= 0 || lv > safeLv) return false;
      var cc = costOf(lv, g.base);
      if (!cc.merge || cc.matNeed || cc.rate < 1) return false;
      var needLow = m * cc.need, have = avail[lv - 1] || 0, use = Math.min(have, needLow);
      avail[lv - 1] = have - use;
      if (!produce(lv - 1, needLow - use)) return false;
      for (var i = 0; i < m; i++) { steps.push(lv); cost.dia += cc.dia; cost.gold += cc.gold; cost.crystal += cc.crystal || 0; }
      avail[lv] = (avail[lv] || 0) + m;
      return true;
    };
    var ok = true;
    if (c.matNeed) {
      var mg = matGroup(g, c.matLv), have = mg ? mg.cnt : 0, miss = c.matNeed - have;
      if (miss > 0) { if (mg && mg.fx) return null; avail[c.matLv] = 0; ok = produce(c.matLv, miss); }
    } else {
      var missMain = c.need - g.cnt;
      if (missMain > 0) { if (g.fx) return null; avail[g.n] = 0; ok = produce(g.n, missMain); }
    }
    if (!ok || !steps.length) return null;
    cost.afford = diamonds() >= cost.dia && gold() >= cost.gold && (!cost.crystal || crystals() >= cost.crystal);
    return { steps: steps, cost: cost, final: c };
  }
  function runPlan(g, plan) {
    for (var i = 0; i < plan.steps.length; i++) {
      var lv = plan.steps[i], low = groups(true).filter(function (x) { return x.base === g.base && x.n === lv - 1 && !x.fx && x.asc == null && x.evo == null; })[0];
      if (!low) return { ok: false, msg: '自動補料中斷：找不到 +' + (lv - 1) + '。' };
      var r = rawUpgrade(low.key);
      if (!r.ok) return { ok: false, msg: '自動補料中斷：' + r.msg };
    }
    return upgrade(g.key);
  }
  function ask(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var t = g.n + 1, c = costOf(t, g.base), nm = DB.items[g.base].n;
    var msg = c.merge
      ? (c.matNeed ? '用 ' + (g.n ? '+' + g.n + ' ' : '') + nm + '，加上 ' + c.matNeed + ' 個同款 +' + c.matLv + '，衝 +' + t + '，' : '用 ' + c.need + ' 個 ' + (g.n ? '+' + g.n + ' ' : '') + nm + ' 合成 +' + t + '，') + '花費 ' + c.dia.toLocaleString() + ' 龍鑽＋' + c.gold.toLocaleString() + ' 金幣' + (c.crystal ? '＋席琳結晶 ' + c.crystal + ' 顆' : '') + '。' + (c.rate < 1 ? '\n成功率 ' + Math.round(c.rate * 100) + '%，' + (c.matNeed ? '失敗時本體保留，三件 +' + c.matLv + ' 與費用會扣掉。' : '失敗時遺物都還在，費用會扣掉。') : '') + (t === 10 ? '\n+10 會隨機繼承一種同部位遺物的特效。' : '')
      : '強化 +' + g.n + ' ' + nm + ' → +' + t + '，花費 ' + c.dia.toLocaleString() + ' 龍鑽，成功率 ' + Math.round(c.rate * 100) + '%。\n失敗時龍鑽會扣掉，遺物不會消失；每失敗一次，下一次衝 +' + t + ' 的成功率 +2%（最高 50%，成功後歸零）。';
    var direct = g.cnt >= c.need && (!c.matNeed || ((matGroup(g, c.matLv) || {}).cnt || 0) >= c.matNeed), plan = direct ? null : autoPlan(g);
    if (plan) {
      var cnt = {}; plan.steps.forEach(function (lv) { cnt[lv] = (cnt[lv] || 0) + 1; });
      msg = '材料不夠，先自動補料：' + Object.keys(cnt).map(function (lv) { return '合成 +' + lv + ' ×' + cnt[lv]; }).join('、') + '（都是 100%，用背包裡沒詞綴的低階同款）。\n'
        + msg + '\n全部合計：' + plan.cost.dia.toLocaleString() + ' 龍鑽＋' + plan.cost.gold.toLocaleString() + ' 金幣' + (plan.cost.crystal ? '＋席琳結晶 ' + plan.cost.crystal.toLocaleString() + ' 顆' : '') + '。';
    }
    var go = function () { var r = plan ? runPlan(g, plan) : upgrade(key); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '遺物合成', message: msg, okText: '確定', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  function attrPanel() {
    var it = relicWpnForAttr();
    if (!it) return '';
    var cur = (typeof getAttrAffix === 'function') ? getAttrAffix(it.attr) : null, mg = (typeof getAttrMagicProc === 'function') ? getAttrMagicProc(it) : null;
    var cnt = function (id) { return invCnt(id); };
    var html = '<div class="rp-chips"><span>目前屬性 <b>' + (cur ? esc(cur.n) + '（第 ' + cur.tier + ' 階）' : '無') + '</b></span>'
      + (mg ? '<span>屬性魔法 <b>' + '★'.repeat(mg.star) + ' ' + esc((DB.skills[mg.skId] || {}).n || mg.skId) + '</b></span>' : '') + '</div>';
    var cap = starCap(it), sc0 = cur ? ATTR_SCROLLS[cur.ele] : null, h0 = sc0 ? cnt(sc0.id) : 0, st0 = mg ? mg.star : 0;
    html += '<div class="rp-kv"><span>一鍵衝星（沿用目前屬性，到目標或卷軸用完就停）</span></div><div class="rp-btns">'
      + [[3, '一鍵 3 星'], [st0 >= 3 && st0 < 5 ? st0 + 1 : 4, '升 1 星'], [5, '一鍵 5 星']].map(function (x) {
        var n = x[0], up = x[1] === '升 1 星', at5 = cur && cur.tier >= 5;
        var why = !cur ? '先賦予屬性' : n > cap ? '要昇華支配' : (at5 && st0 >= n) ? '已達成' : (up && !(at5 && st0 >= 3)) ? '先滿 3 星' : !h0 ? '沒有卷軸' : (up && h0 < STAR_UP[n]) ? '卷軸不足' : '';
        var sub = up ? (n <= 5 && STAR_UP[n] ? '★' + (n - 1) + '→★' + n + '・' + STAR_UP[n].toLocaleString() + ' 張' : '') : (sc0 ? esc(sc0.n.replace('武器強化卷軸', '')) + ' ' + h0.toLocaleString() : '');
        return '<button type="button" data-autostar="' + n + '"' + (why ? ' disabled title="' + why + '"' : '') + '>' + x[1] + '<small>' + (why ? why + (up && sub ? '・' + sub : '') : sub) + '</small></button>';
      }).join('') + '</div>'
      + '<p class="rp-note">先衝到屬性第 5 階才開始加星。1～3 星每張 1% 抽（同一種 +1 星、別種從 1 星重來）；滿 3 星後 ★3→★4 固定 ' + STAR_UP[4].toLocaleString() + ' 張、★4→★5 固定 ' + STAR_UP[5].toLocaleString() + ' 張同屬性卷軸，必定成功。4、5 星只有昇華支配、至高的支配能升（+15 沒昇華最高 3 星）。昇華、進化時屬性階、星數與其他詞綴都會保留。</p>';
    return html;
  }
  // 碧恩：裝備 +15 以上遺物武器時，上面原本的四顆屬性按鈕直接改走遺物規則；下面多一塊「遺物武器：一鍵衝星」
  var refreshAttr = function () {
    try { if (document.getElementById('rp-list')) render(); } catch (e) {}
    var el = document.getElementById('interaction-content');
    if (el && el.querySelector('#rp-bian') && typeof window.renderBianAttr === 'function') { try { window.renderBianAttr(el); } catch (e) {} }
  };
  if (typeof window.doBianAttr === 'function') {
    var oDoBian = window.doBianAttr;
    window.doBianAttr = function (slotKey, ele) {
      var p = P();
      if (!inHama && enabled() && slotKey === 'wpn' && p && p.eq && p.eq.wpn && relicWpnForAttr() === p.eq.wpn) {
        var r = hamaAttr(ele);
        if (!r.ok) { try { logSys('<span class="text-amber-300">' + esc(r.msg) + '</span>'); } catch (e) {} }
        var el = document.getElementById('interaction-content'); if (el && typeof window.renderBianAttr === 'function') { try { window.renderBianAttr(el); } catch (e) {} }
        return;
      }
      return oDoBian.apply(this, arguments);
    };
  }
  if (typeof window.renderBianAttr === 'function') {
    var oRenderBian = window.renderBianAttr;
    window.renderBianAttr = function (el) {
      var r = oRenderBian.apply(this, arguments);
      try {
        if (!enabled() || !el || !P()) return r;
        css();
        var it = relicWpnForAttr(), wpn = P().eq && P().eq.wpn, wd = wpn && DB.items[wpn.id];
        var host = el.firstElementChild || el, box = document.createElement('div');
        box.id = 'rp-bian'; box.className = 'rp-tools';
        box.innerHTML = '<section class="rp-sec rp-wide"><h4><span>⚔ 遺物武器的屬性</span><small>+15 以上遺物武器</small></h4>'
          + (it ? '<p class="rp-note">你的主手是 +15 以上的遺物武器：上面「武器」那一列的四顆屬性按鈕照樣能用（遺物不受強化值門檻限制、原本有觸發特效也能附加魔法）。下面可以一鍵衝星；昇華支配、至高的支配最高 5 星。</p>' + attrPanel()
            : '<p class="rp-note">遺物武器要先在哈瑪大師那裡強化到 +15，才能在這裡賦予屬性' + (wd && wd.relicPlus ? '（你的主手目前 +' + wd.relicPlus + '）' : '') + '。昇華支配、至高的支配的屬性魔法最高 5 星。</p>')
          + '</section>';
        host.appendChild(box);
        box.addEventListener('click', function (e) {
          var aa = e.target.closest('[data-autostar]'); if (aa && !aa.disabled) { askAutoAttr(Number(aa.getAttribute('data-autostar'))); return; }
          var ab = e.target.closest('[data-attr]'); if (ab && !ab.disabled) { var ar = hamaAttr(ab.getAttribute('data-attr')); if (!ar.ok) { try { logSys('<span class="text-red-400">' + esc(ar.msg) + '</span>'); } catch (e3) {} } refreshAttr(); }
        });
      } catch (e) { console.warn('[AFK-relicplus] bian', e); }
      return r;
    };
  }
  // ── 至高的支配：第三詞綴（玩家 2026-10-25）──
  //   武器：至高的支配就能抽；防具：要先湊滿 6 件至高的支配、發動過「席琳的永生」才開放；飾品（戒指／耳環／項鍊／腰帶）沒有第三詞綴
  //   每次消耗六種時空材料各 1 ＋ 至暗星塵 20，抽到的會取代原本的第三詞綴（可重抽）
  var FX3_COST = { stardust: 20 };
  var fx3Lock = function (g) {
    var d = DB.items[g.base], p = P();
    if (!g || g.evo == null) return '只有至高的支配才能抽第三詞綴。';
    if (!d || d.type === 'acc') return '飾品（戒指、耳環、項鍊、腰帶）沒有第三詞綴，最高就是昇華支配。';
    if (d.type === 'arm' && !(p && p._afkImmortalSeen)) return '防具的第三詞綴：先湊滿 6 件至高的支配、發動過「席琳的永生」才會開放。';
    return null;
  };
  function rollFx3(key) {
    if (!enabled()) return disabled();
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return { ok: false, msg: '找不到這個遺物。' };
    var lock = fx3Lock(g); if (lock) return { ok: false, msg: lock };
    var miss = TS_MATS.filter(function (id) { return invCnt(id) < 1; });
    if (invCnt('afk_dark_stardust') < FX3_COST.stardust) miss.push('至暗星塵 ×' + FX3_COST.stardust);
    if (miss.length) return { ok: false, msg: '材料不足：' + miss.map(function (id) { return (DB.items[id] || {}).n || id; }).join('、') };
    var pool = donorsFor(g.base).filter(function (id) { return id !== g.fx && id !== g.fx3 && !/~/.test(id); });
    if (!pool.length) return { ok: false, msg: '沒有可以繼承的遺物。' };
    var fx3 = pool[Math.floor(Math.random() * pool.length)];
    var newId = makeId(g.base, g.n, g.fx, 5, g.evo, fx3);
    if (!ensure(newId)) return { ok: false, msg: '無法建立第三詞綴資料。' };
    var undo = snapInv();
    if (!TS_MATS.every(function (id) { return takeId(id, 1); }) || !takeId('afk_dark_stardust', FX3_COST.stardust)) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    var tk = take(g, 1);
    if (tk.got.length < 1) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    pushResult(newId, tk.got[0]); remember(newId);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); updateUI(); } catch (e) {}
    var msg = DB.items[g.base].n + '的第三詞綴甦醒了：繼承「' + DB.items[fx3].n + '」' + (DB.items[newId] && DB.items[newId].d && DB.items[newId].d.indexOf('沒有新特效') >= 0 ? '（沒有新特效 → 四屬性抗性 +3）' : '的特效') + '。';
    try { logSys('<span class="text-yellow-300 font-bold">' + esc(msg) + '</span>'); } catch (e) {}
    return { ok: true, id: newId, fx3: fx3, msg: msg };
  }
  function askFx3(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var nm = DB.items[g.base].n;
    var msg = '為「' + nm + '至高的支配」抽第三詞綴：隨機繼承一件同部位遺物的特效（沒有新特效時改為四屬性抗性 +3）。\n消耗六種時空材料各 1 個、至暗星塵 ' + FX3_COST.stardust + ' 個。' + (g.fx3 ? '\n目前的第三詞綴「' + ((DB.items[g.fx3] || {}).n || g.fx3) + '」會被取代。' : '');
    var go = function () { var r = rollFx3(key); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '第三詞綴', message: msg, okText: '抽取', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  function askEvo(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var nm = DB.items[g.base].n;
    var msg = '把「+5 ' + nm + '昇華支配」進化為「' + nm + '至高的支配」，成功率 100%。\n消耗六種時空材料各 1 個，隨機獲得一種至高的支配特效。\n裝滿 6 件至高的支配：發動「至暗支配・席琳的永生」（免疫死亡一次，冷卻 30 秒）。';
    var go = function () { var r = evolve(key); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '至高的支配', message: msg, okText: '進化', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  function askAsc(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var A = g.asc == null ? 0 : g.asc + 1, c = ascCost(A), rate = Math.min(1, c.rate + 0.1 * dustUse), nm = DB.items[g.base].n;
    var st = stoneUse && A >= 1 && stoneOf(g.base);
    if (st) { c = { dia: 0, items: {}, equip: [], rate: 1 }; rate = 1; }
    var msg = (A === 0 ? '把 +' + g.n + ' ' + nm + ' 昇華為「+0 ' + nm + '昇華支配」' : '強化為「+' + A + ' ' + nm + '昇華支配」') + '，成功率 ' + Math.round(rate * 100) + '%'
      + (st ? '（使用 1 顆' + DB.items[stoneOf(g.base)].n + '，不需要其他材料）' : (dustUse ? '（使用夢域塵 ' + dustUse + ' 顆）' : '')) + '。\n會消耗清單上的全部材料' + (c.equip.length ? '（包含四大古代龍鱗盔甲與真．冥皇套裝各 1 件）' : '') + '；失敗時材料消耗、遺物不會消失。';
    var go = function () { var r = ascend(key, dustUse, !!st); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '昇華支配', message: msg, okText: '確定', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
  }
  function open() {
    if (!enabled() || !P()) return;
    if (!document.getElementById('rp-modal')) build();
    var mm = document.getElementById('rp-modal');
    if (mm.classList.contains('rp-embed')) { mm.classList.remove('rp-embed'); document.body.appendChild(mm); }
    mm.style.display = 'flex';
    render();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;
    document.getElementById('rp-x').focus();
  }
  function close() {
    var mm = document.getElementById('rp-modal');
    if (mm && mm.classList.contains('rp-embed')) { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); return; }
    if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose();
  }
  // 從燃柳村 NPC 進來：放進遊戲本身的 NPC 對話框（標題、關閉鈕、字體與其他 NPC 一致）
  function embed(div) {
    if (!enabled() || !P() || !div) return;
    if (!document.getElementById('rp-modal')) build();
    var mm = document.getElementById('rp-modal');
    mm.classList.add('rp-embed'); div.innerHTML = ''; div.appendChild(mm); mm.style.display = 'block';
    render();
  }
  function doClose() { layer = null; var m = document.getElementById('rp-modal'); if (m) m.style.display = 'none'; }

  // 入口只剩燃柳村 NPC「哈瑪大師」（玩家 2026-10-26：遺物收集冊只保留「整理重複遺物」，強化與昇華一律到 NPC）
  // 燃柳村 NPC「哈瑪大師」：點了直接打開遺物強化視窗
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (enabled() && town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === 'npc_hama'; })) {
      town.npcs.push({ id: 'npc_hama', n: '哈瑪大師', title: '遺物強化', type: 'relicsmith',
        d: '爐火映著歲月，哈瑪將同源遺物熔鑄合一，喚醒其中沉睡的力量。武器與防具最高 +15，戒指、耳環等飾品最高 +10，滿階後可昇華支配。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED.npc_hama) NPC_SPR_FIXED.npc_hama = '1768';
    // 碧恩（象牙塔）接手 +15 以上遺物武器的屬性卷軸（玩家 2026-10-29 晚）
    var bian = DB.towns && DB.towns.town_ivory_tower && (DB.towns.town_ivory_tower.npcs || []).filter(function (x) { return x.id === 'npc_bian'; })[0];
    if (enabled() && bian && String(bian.d).indexOf('遺物武器') < 0) bian.d += '+15 以上的遺物武器也能在這裡賦予屬性，昇華支配、至高的支配的屬性魔法最高 5 星。';   // 矮人鐵匠外型（與火焰鐵匠同款）
  } catch (e) {}
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (enabled() && npcId === 'npc_hama') { try { embed(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }


  // （2026-10-22：取消「疊滿 20 層持續 30 秒」；+10 以上出血改為最多 50 層、持續時間照原本，由 afk-relicfx 處理）
  // ── 持續傷害上限：中毒＋出血對同一隻怪，每秒最多扣牠最大 HP 的 1%（核心補丁 17 呼叫；玩家 2026-10-21 選定）──
  //    2026-10-22：被昇華支配遺物打過的怪（_afkAscDot）不受這個上限
  window.__afkDotCap = function (m, dmg) {
    if (!enabled()) return dmg;
    try {
      if (!m || !(dmg > 0)) return dmg;
      if (m._afkAscDot) return dmg;   // 2026-10-22：昇華支配遺物造成的持續傷害不受上限
      var sec = Math.floor(((typeof state !== 'undefined' && state && state.ticks) || 0) / 10);
      if (m._dotSec !== sec) { m._dotSec = sec; m._dotUsed = 0; }
      var cap = Math.max(1, Math.floor((Number(m.hp) || Number(m.curHp) || 0) * 0.01));
      var allow = Math.max(0, Math.min(dmg, cap - (m._dotUsed || 0)));
      m._dotUsed = (m._dotUsed || 0) + allow;
      return allow;
    } catch (e) { return dmg; }
  };

  // 幸運暴走兔腳：可以戴兩個，遺物掉落判定 ×2 → 兩個 ×4（核心補丁 16 讀這個函式）
  window.__afkRelicDropMult = function () {
    if (!enabled()) return 1;
    try {
      if (typeof player === 'undefined' || !player || player._allyName || (typeof _recomputingAlly !== 'undefined' && _recomputingAlly) || !player.eq) return 1;
      var c = 0; for (var k in player.eq) { var it = player.eq[k], d = it && DB.items[it.id]; if (d && d.relicDropX2) c++; }
      return c ? Math.pow(2, c) : 1;
    } catch (e) { return 1; }
  };

  var rawUpgrade = upgrade;
  upgrade = withEq(upgrade); ascend = withEq(ascend); evolve = withEq(evolve); rollFx3 = withEq(rollFx3);
  var featureApi = { autoAttr: autoAttr, rollFx3: rollFx3, fx3Lock: fx3Lock, hamaAttr: hamaAttr, ascend: ascend, ascCost: ascCost, craftStardust: craftStardust, open: open, upgrade: upgrade, groups: groups, ensure: ensure, exchange: exchange, embed: embed, evolve: evolve, equippedEvo: equippedEvo, EVO: EVO, buildDef: buildDef, costOf: costOf, donorsFor: donorsFor, makeId: makeId, parseId: parseId, remember: remember, fxAt: fxAt, kindOk: KIND_OK, select: function (key) { ui.sel = key; render(); }, ui: ui };
  Object.defineProperty(window, '__afkRelicPlus', { configurable: true, get: function () { return enabled() ? featureApi : null; } });
  // ── 遺物・司祭苦行套裝（玩家 2026-10-24）：名稱標上遺物；墮落的司祭一～五階每殺一隻判定一次 0.0001%，中了從五件裡隨機給一件 ──
  (function () {
    var PIECES = ['relic_priest_hood', 'relic_priest_gloves', 'relic_priest_collar', 'relic_priest_robe', 'relic_priest_sandals'];
    PIECES.forEach(function (id) { var d = DB.items[id]; if (d && typeof d.d === 'string' && d.d.indexOf('遺物・司祭苦行套裝') < 0) d.d = d.d.replace('司祭苦行套裝', '遺物・司祭苦行套裝'); });
    try {
      if (typeof MOB_DROPS === 'undefined') return;
      ['一', '二', '三', '四', '五'].forEach(function (k) {
        var key = '墮落的司祭(' + k + '階)', list = MOB_DROPS[key]; if (!list) return;
        var rate = 0;
        for (var i = list.length - 1; i >= 0; i--) { var e = list[i], id = Array.isArray(e) ? e[0] : e; if (PIECES.indexOf(id) >= 0) { rate = Math.max(rate, Number(e[1]) || 0); list.splice(i, 1); } }
        if (!rate) return;
        PIECES.forEach(function (id) { if (DB.items[id]) list.push([id, rate / PIECES.length]); });   // 五件均分＝一次判定、隨機一件
      });
    } catch (e) { console.warn('[AFK-relicplus] 司祭苦行掉落', e); }
  })();
  if (enabled()) console.log('[AFK-relicplus] 已啟用：遺物合成（武器 +1～+15）');
})();
