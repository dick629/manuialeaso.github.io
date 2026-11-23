/* ============================================================================
 * afk-cjcharm.js — 蘑菇秘境的掉落（Ping 11-19 12:12）
 *
 *   ‧蘑菇秘境的蘑菇不再沿用一般「蘑菇」的掉落（蘑菇汁、菌菇傘帽都不掉）。
 *   ‧改掉新遺物「CJ的幸運符」：每隻 0.0001%（跟其他遺物一樣吃遺物掉落加成）。
 *   ‧CJ的幸運符：耳環，遺物掉落判定 ×4（等於戴兩個幸運暴走兔腳；跟兔腳的效果不疊加，取比較高的；兩個幸運符也只算一次）。
 *     不能強化、不能合成／昇華／進化、黑市遺物自選不賣，也不會從其他遺物隨機池（玩家 NPC、攻城）出現。
 *   規則本體：afk-relicplus __afkRelicDropMult 讀 relicNoStack；afk-relicshop sellable、afk-siege2 relicBases 排除 relicNoStack。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var ID = 'relic_cj_charm', MAP = 'growth_mushroom', RATE = 0.0001;
  if (!DB.items[ID]) DB.items[ID] = {
    n: 'CJ的幸運符', type: 'acc', slot: 'ear', relic: true, noEnhance: true, ac: 0,
    relicDropX2: true, relicNoStack: true, req: 'all', p: 10000, gachaWeight: 0,
    img: 'assets/icons/gpt/cj_charm.webp',
    d: '【遺物】蘑菇秘境深處撿到的幸運符，背面歪歪扭扭刻著「CJ」。遺物掉落判定 ×4。效果只算一個：戴兩個不會加倍，也不跟幸運暴走兔腳疊加（取比較高的）。'
  };
  // 蘑菇秘境：整張掉落表換成只有 CJ的幸運符（包在最外層：載入時包一次，load 後再確認一次）
  var wrap = function () {
    var oF = W.__afkDropListFilter; if (oF && oF.__afkCj) return;
    var f = function (mob, list) {
      var r = typeof oF === 'function' ? (oF.apply(this, arguments) || list) : list;
      try { if (typeof mapState !== 'undefined' && mapState && mapState.current === MAP) return [[ID, RATE]]; } catch (e) {}
      return r;
    };
    f.__afkCj = true; if (oF && oF.__afkDimOnly) f.__afkDimOnly = true; W.__afkDropListFilter = f;
  };
  wrap(); W.addEventListener('load', function () { setTimeout(function () { var o = W.__afkDropListFilter; if (o && !o.__afkCj) wrap(); }, 50); });
  // 物品說明：兔腳的「×2」字樣換成 ×4
  if (typeof W.relicPurposeLabels === 'function') {
    var oRL = W.relicPurposeLabels;
    W.relicPurposeLabels = function (d) { var r = oRL.apply(this, arguments); try { if (d && d.relicNoStack && Array.isArray(r)) r = r.map(function (x) { return /^遺物尋寶/.test(x) ? '遺物尋寶（遺物掉落判定次數×4；戴兩個不會加倍，不跟幸運暴走兔腳疊加）' : x; }); } catch (e) {} return r; };
    try { (0, eval)('relicPurposeLabels = window.relicPurposeLabels'); } catch (e) {}
  }
  // 11-19 16:13 Ping：秘境只給經驗、金幣、CJ的幸運符——其他系統在打倒怪物時直接塞進背包的東西（次元結晶（戒）、夢艷結晶…）也擋掉
  var inKill = 0, onMap = function () { try { return typeof mapState !== 'undefined' && mapState && mapState.current === MAP; } catch (e) { return false; } };
  var wrapKill = function () {
    var o = W.killMob; if (typeof o !== 'function' || o.__afkCj) return;
    var f = function () { if (!onMap()) return o.apply(this, arguments); inKill++; try { return o.apply(this, arguments); } finally { inKill--; } };
    f.__afkCj = true; W.killMob = f; try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  };
  var wrapGain = function () {
    var o = W.gainItem; if (typeof o !== 'function' || o.__afkCj) return;
    var f = function (id) { if (inKill > 0 && id !== ID && onMap()) return null; return o.apply(this, arguments); };
    f.__afkCj = true; W.gainItem = f; try { (0, eval)('gainItem = window.gainItem'); } catch (e) {}
    var oL = W.logSys;
    if (typeof oL === 'function' && !oL.__afkCj) { var g = function (h) { if (inKill > 0 && onMap() && /留下了/.test(String(h)) && String(h).indexOf(DB.items[ID].n) < 0) return; return oL.apply(this, arguments); }; g.__afkCj = true; W.logSys = g; try { (0, eval)('logSys = window.logSys'); } catch (e) {} }
  };
  W.addEventListener('load', function () { setTimeout(function () { wrapKill(); wrapGain(); }, 80); });
  // 玩家 NPC 的「全部遺物等機率抽」不放這件
  if (typeof W.allRelicIds === 'function') {
    var oAll = W.allRelicIds;
    W.allRelicIds = function () { return (oAll.apply(this, arguments) || []).filter(function (id) { var d = DB.items[id]; return !(d && d.relicNoStack); }); };
  }
})();
