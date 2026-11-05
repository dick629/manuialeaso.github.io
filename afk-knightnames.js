/* ============================================================================
 * afk-knightnames.js — 守護騎士譯名：依詩蒂→伊席蘿蒂、朱利安→絲莉安、歐薇→歐文（玩家 2026-11-05）
 *   ＋變身形態譯名：伊詩蒂→伊席蘿蒂（玩家 2026-11-05；只改顯示，形態名照舊當 key，見檔尾「變身形態」一段）
 *
 * 只改玩家看得到的名字與說明，不動數值、掉落、行為。核心 js/00-data.js 不改，載入時在這裡改名：
 *   ‧怪物（依 id 找，名字對得上才改）：esti_enemy／siege_esti／julian_enemy／siege_julian／ovi_enemy／siege_ovi
 *   ‧NPC：DB.towns 裡的 npc_esti（名字與說明）；載入畫面的血盟陣營（js/13 updateLoadInfo 寫死的 esti→依詩蒂）
 *   ‧物品名稱與說明（依詩蒂變身卷軸、修練者英雄變身卷軸(依詩蒂)…天堂透視鏡匯入品，來源資料不改，重產也不會蓋掉）
 * 素材不改名：動畫資料夾、怪物圖示、音效檔都還是舊名字——
 *   ‧img 欄位原樣保留（assets/icons/monsters/<舊名>.png）
 *   ‧MOB_ANIM_NAMES 等名單／MOB_ANIM_ALIAS（新名→舊名所指的資料夾）／MOB_HURT_SFX、MOB_KILL_SFX 補上新名
 *   ‧舊名的條目全部留著（其他外掛或上游用舊名查，照樣找得到）
 * 撞名：「絲莉安」原本就是 Lv90 變身／卡牌形態的名字（RANGED_POLY_FORMS、MORPH_BATTLE_ALIAS、
 *   變身音效 _morphHurtOverride 都用變身名查 MOB_HURT_SFX／MOB_KILL_SFX）。新名字若已經是變身名，
 *   就不把它寫進音效表（否則變身成絲莉安時會改播血盟絲莉安的受傷／死亡音），改由下面包住 playMob* 用舊名查。
 *   變身收集冊的縮圖（afk-poly-codex「同名怪物有動畫就用怪物待機圖」）以 isRenamed() 排除。
 * 存檔：怪物、NPC、血盟陣營在存檔裡都是存 id（pledge:'esti'、bloodPledge），名字只用在顯示；
 *   存檔裡場上的怪（mapState.mobs）帶著名字，但讀檔時 changeMap(true) 會整排清空重生，不會留下舊名。
 * 經典模式一樣改名：經典只記 NPC id 與變身名單，沒有任何規則讀這幾個名字。
 * 不是開關（同 afk-npctext：純顯示文字）。載入順序：afk-castlewar、afk-ttmi-items 之後（它們會建立帶舊名的 NPC／物品），
 *   afk-matprice／afk-poly-codex 之前（它們載入時就把怪名記下來）。window load 時再跑一次，補上之後才加的 NPC／物品。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.mobs || !DB.items) { console.warn('[AFK-knightnames] 找不到 DB，停用'); return; }

  var WORDS = [['依詩蒂', '伊席蘿蒂'], ['朱利安', '絲莉安'], ['歐薇', '歐文']];
  var MOBS = {
    esti_enemy: ['依詩蒂', '伊席蘿蒂'], siege_esti: ['依詩蒂公主', '伊席蘿蒂公主'],
    julian_enemy: ['朱利安', '絲莉安'], siege_julian: ['月光朱利安', '月光絲莉安'],
    ovi_enemy: ['歐薇', '歐文'], siege_ovi: ['月之精靈歐薇', '月之精靈歐文']
  };
  var OLD_RE = /依詩蒂|朱利安|歐薇/;
  var NEW_OF = Object.create(null), OLD_OF = Object.create(null);
  Object.keys(MOBS).forEach(function (id) { NEW_OF[MOBS[id][0]] = MOBS[id][1]; OLD_OF[MOBS[id][1]] = MOBS[id][0]; });
  var tx = function (s) {
    if (typeof s !== 'string' || !OLD_RE.test(s)) return s;
    WORDS.forEach(function (w) { s = s.split(w[0]).join(w[1]); });
    return s;
  };
  var GET = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };

  // 新名字是不是本來就是某個變身的名字（撞名就不寫進以名字查的音效表）
  var isFormName = function (n) {
    try {
      if (typeof MORPH_BATTLE_ALIAS !== 'undefined' && Object.prototype.hasOwnProperty.call(MORPH_BATTLE_ALIAS, n)) return true;
      if (typeof MORPH_BATTLE_ANIM !== 'undefined' && MORPH_BATTLE_ANIM.has && MORPH_BATTLE_ANIM.has(n)) return true;
      if (typeof RANGED_POLY_FORMS !== 'undefined' && RANGED_POLY_FORMS.has && RANGED_POLY_FORMS.has(n)) return true;
      if (typeof POLY_TIERS !== 'undefined') for (var i = 0; i < POLY_TIERS.length; i++) {
        var fs = (POLY_TIERS[i] && POLY_TIERS[i].forms) || [];
        for (var j = 0; j < fs.length; j++) if (fs[j] && fs[j].n === n) return true;
      }
    } catch (e) {}
    return false;
  };

  function renameMobs() {
    Object.keys(MOBS).forEach(function (id) { var d = DB.mobs[id]; if (d && d.n === MOBS[id][0]) d.n = MOBS[id][1]; });
  }

  var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'];
  var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'SIEGE_BUILD_POS'];
  var SFX = ['MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX', 'MOB_SKILL_SFX', 'MOB_ATTACK_SWING'];
  function aliasAssets() {
    Object.keys(NEW_OF).forEach(function (o) {
      var n = NEW_OF[o];
      try {
        var names = GET('MOB_ANIM_NAMES');
        if (names && names.has && names.has(o) && typeof MOB_ANIM_ALIAS !== 'undefined') {
          var dir = MOB_ANIM_ALIAS[o] || o;   // 資料夾維持舊名（或舊名本來就借用的資料夾）
          if (MOB_ANIM_ALIAS[n] !== dir) { MOB_ANIM_ALIAS[n] = dir; try { if (typeof _mobAnimCache !== 'undefined') delete _mobAnimCache[n]; } catch (e) {} }
        }
        SETS.map(GET).forEach(function (s) {
          if (!s) return;
          if (s.has && s.add) { if (s.has(o)) s.add(n); }
          else if (typeof s === 'object' && s[o] != null && s[n] == null) s[n] = s[o];
        });
        OBJS.map(GET).forEach(function (t) { if (t && t[o] != null && t[n] == null) t[n] = t[o]; });
        if (!isFormName(n)) SFX.map(GET).forEach(function (t) { if (t && t[o] != null && t[n] == null) t[n] = t[o]; });
      } catch (e) { console.warn('[AFK-knightnames] 素材別名失敗', o, e); }
    });
  }

  // 物品：名字與說明（重量表、圖示表以物品名為 key → 新名沿用舊名的值）
  function renameItems() {
    Object.keys(DB.items).forEach(function (id) {
      var d = DB.items[id]; if (!d) return;
      var on = d.n, nn = tx(on);
      if (nn !== on) {
        d.n = nn;
        try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[on] != null && ITEM_WEIGHTS[nn] == null) ITEM_WEIGHTS[nn] = ITEM_WEIGHTS[on]; } catch (e) {}
        try { var ic = W.__AFK_TTMI_ICONS; if (ic && ic[on] && !ic[nn]) ic[nn] = ic[on]; } catch (e) {}
      }
      if (typeof d.d === 'string') d.d = tx(d.d);
    });
  }

  function renameNpcs() {
    Object.keys(DB.towns || {}).forEach(function (t) {
      ((DB.towns[t] && DB.towns[t].npcs) || []).forEach(function (x) {
        if (!x) return;
        if (typeof x.n === 'string') x.n = tx(x.n);
        if (typeof x.d === 'string') x.d = tx(x.d);
        if (typeof x.title === 'string') x.title = tx(x.title);
      });
    });
  }

  function applyAll() {
    try { renameMobs(); } catch (e) { console.warn('[AFK-knightnames] 怪物改名失敗', e); }
    try { aliasAssets(); } catch (e) {}
    try { renameItems(); } catch (e) { console.warn('[AFK-knightnames] 物品改名失敗', e); }
    try { renameNpcs(); } catch (e) { console.warn('[AFK-knightnames] NPC 改名失敗', e); }
  }
  applyAll();

  // 音效：用舊名查（撞名的新名不在表上；攻擊音的「子字串借用」也維持跟舊名一樣的結果）
  ['playMobHurt', 'playMobKill', 'playMobAttack', 'playMobSkill'].forEach(function (fn) {
    var orig = W[fn]; if (typeof orig !== 'function') return;
    W[fn] = function (mob) {
      if (mob && typeof mob === 'object' && OLD_OF[mob.n] && mob.race === '血盟') {
        var a = Array.prototype.slice.call(arguments);
        try { a[0] = Object.create(mob, { n: { value: OLD_OF[mob.n], enumerable: true } }); } catch (e) {}
        return orig.apply(this, a);
      }
      return orig.apply(this, arguments);
    };
  });

  // 載入畫面的血盟陣營（核心寫死 esti→依詩蒂）
  var fixLoadInfo = function () {
    try {
      var el = document.getElementById('load-info-pledge'); if (!el) return;
      var t = el.innerText != null ? el.innerText : el.textContent;
      if (t && NEW_OF[t]) { if (el.innerText != null) el.innerText = NEW_OF[t]; else el.textContent = NEW_OF[t]; }   // 只換整格等於舊名的（血盟名是玩家取的，不動）
    } catch (e) {}
  };
  if (typeof W.updateLoadInfo === 'function') {
    var oInfo = W.updateLoadInfo;
    W.updateLoadInfo = function () { var r = oInfo.apply(this, arguments); fixLoadInfo(); return r; };
  }
  fixLoadInfo();

  // ── 變身形態「伊詩蒂」→「伊席蘿蒂」（玩家 2026-11-05）：只改畫面上的字 ──
  //   形態名「伊詩蒂」本身就是 key，到處都用它查東西、存進存檔，所以一律不改：
  //     POLY_TIERS 的 form.n、findPolyForm、變形控制戒指選單的參數、player.poly.n、player._afkPolyPick、
  //     變身收集冊 player.polyDex['伊詩蒂']、卡片道具 id（afk_pcard_<伊詩蒂的編碼>_1~3）與 pcardForm、
  //     神話卡 id（afk_asc_card_mythic_<伊詩蒂的編碼>）與「神話・伊詩蒂」形態名、卷軸 ttmiPolyForm、
  //     MORPH_BATTLE_ALIAS／MORPH_BATTLE_ANIM／MORPH_ANIM_3DIR、動畫資料夾 assets/morphanim/伊詩蒂*、
  //     自製變身圖、GPT 變身檔名單、卡牌特效對照、隊員變身設定。
  //   因為 key 一個都沒動，舊存檔不需要任何轉換，收集進度、已解鎖的神話卡、指定的變身都照舊認得。
  //   顯示分兩層：
  //     1. 物品資料的名字與說明（卡片、卷軸說明、神話卡；搜尋、潘朵拉指定收購用的是這個名字）
  //     2. 畫面文字過濾：其餘由程式組出來的字（變身選單、狀態列、戰鬥訊息、收集冊、卡冊、小百科、掉落查詢、
  //        提示框 title、alert／confirm）在顯示前把「伊詩蒂」換成「伊席蘿蒂」。只改文字節點與 title／placeholder，
  //        onclick、value、src、data-* 都不碰（裡面是 key 或檔名）；輸入框、textarea、script、style、診斷用的 pre 不改。
  //   經典模式一樣只是顯示，沒有規則讀到這個字。
  var POLY_OLD = '伊詩蒂', POLY_NEW = '伊席蘿蒂';
  var ptx = function (s) { return (typeof s === 'string' && s.indexOf(POLY_OLD) >= 0) ? s.split(POLY_OLD).join(POLY_NEW) : s; };
  function renamePolyItems() {
    var changed = 0;
    Object.keys(DB.items).forEach(function (id) {
      var d = DB.items[id]; if (!d) return;
      var on = d.n, nn = ptx(on);
      if (nn !== on) {
        d.n = nn; changed++;
        try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[on] != null && ITEM_WEIGHTS[nn] == null) ITEM_WEIGHTS[nn] = ITEM_WEIGHTS[on]; } catch (e) {}
        try { var ic = W.__AFK_TTMI_ICONS; if (ic && ic[on] && !ic[nn]) ic[nn] = ic[on]; } catch (e) {}
      }
      if (typeof d.d === 'string') d.d = ptx(d.d);
    });
    return changed;
  }
  try { renamePolyItems(); } catch (e) { console.warn('[AFK-knightnames] 變身物品改名失敗', e); }

  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, PRE: 1, TEMPLATE: 1 };
  var ATTRS = ['title', 'placeholder', 'aria-label'];
  var skipEl = function (el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) { if (SKIP_TAG[e.nodeName] || e.isContentEditable) return true; }
    return false;
  };
  var fixText = function (t) {
    var v = t.nodeValue;
    if (v && v.indexOf(POLY_OLD) >= 0 && !skipEl(t.parentNode)) t.nodeValue = v.split(POLY_OLD).join(POLY_NEW);
  };
  var fixAttr = function (el) {
    for (var i = 0; i < ATTRS.length; i++) { var a = el.getAttribute(ATTRS[i]); if (a && a.indexOf(POLY_OLD) >= 0) el.setAttribute(ATTRS[i], a.split(POLY_OLD).join(POLY_NEW)); }
  };
  var ATTR_SEL = ATTRS.map(function (a) { return '[' + a + '*="' + POLY_OLD + '"]'; }).join(',');
  function fixTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipEl(root)) return; fixAttr(root); }
    if (!root.firstChild) return;
    var as = root.querySelectorAll(ATTR_SEL); for (var i = 0; i < as.length; i++) if (!skipEl(as[i])) fixAttr(as[i]);
    var tc = root.textContent; if (!tc || tc.indexOf(POLY_OLD) < 0) return;
    var w = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */), n, list = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf(POLY_OLD) >= 0) list.push(n);
    list.forEach(fixText);
  }
  var polyObserver = null;
  function watchDom() {
    if (polyObserver || !document.body || typeof MutationObserver === 'undefined') return;
    fixTree(document.body);
    // 回呼在微任務裡跑、畫面繪出之前，玩家看不到舊字
    polyObserver = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'characterData') fixText(r.target);
        else if (r.type === 'attributes') { if (!skipEl(r.target)) fixAttr(r.target); }
        else for (var j = 0; j < r.addedNodes.length; j++) fixTree(r.addedNodes[j]);
      }
    });
    polyObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  watchDom();
  if (!polyObserver) document.addEventListener('DOMContentLoaded', watchDom);
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = W[fn]; if (typeof orig !== 'function') return;
    W[fn] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = ptx(msg); return orig.apply(this, a); };
  });

  W.addEventListener('load', function () {
    applyAll(); fixLoadInfo();
    // 變身卡、神話卡是之後的外掛（afk-poly-codex、afk-card-ascension）才建的；掉落查詢在 DOMContentLoaded 就建好了物品搜尋索引 → 有改到名字就請它重建
    try { if (renamePolyItems() && W.AFK_DEX_API && typeof W.AFK_DEX_API.refresh === 'function') W.AFK_DEX_API.refresh(); } catch (e) {}
    watchDom(); fixTree(document.body);
  });

  W.__afkKnightNames = {
    newOf: function (n) { return NEW_OF[n] || null; },
    oldOf: function (n) { return OLD_OF[n] || null; },
    isRenamed: function (n) { return !!OLD_OF[n]; },
    words: WORDS.slice(), mobs: MOBS,
    // 變身形態：key 照舊，只換顯示
    poly: { old: POLY_OLD, shown: POLY_NEW, text: ptx, fixTree: fixTree, observer: function () { return polyObserver; } }
  };
})();
