/* ============================================================================
 * afk-dualele.js — 雙屬性武器：本身帶屬性的武器再賦予「不同」屬性時，兩種屬性同時有效
 *
 * 原版（js/08 getWpnEle → resolveWeaponElement）：武器有屬性卷軸詞綴就用詞綴的屬性，
 *   武器本身的屬性（DB def.ele，目前只有遺物；+15 遺物可在碧恩上屬性卷軸，見 afk-relicplus）被整個蓋掉。
 *
 * 本外掛的規則（玩家 2026-11-04）：
 *   - 武器本身屬性 A ≠ 卷軸屬性 B → 這把武器同時是 A＋B。
 *   - 一般攻擊的屬性剋制倍率：取 A、B 對目標「比較有利」的那個（×1.4 / ×1 / ×0.6 取大）。
 *   - 跟屬性有關的加成（潮濕吃風 ×2、火屬性弱點 +30%、四之牙臂甲對應屬性 ×1.2、遺物的屬性印記與屬性易傷）：A 或 B 符合就算。
 *   - 觸發：武器本身的觸發照舊用 A；卷軸附加魔法照舊用 B（兩者本來就各算各的）。
 *   - 遺物自己的機制看的是武器本身的屬性 A（不再被卷軸蓋成 B）。
 *   - 同一種屬性（A＝B）→ 沒有額外效果。卷軸以外的情況（沒有本身屬性、沒有卷軸）完全不變。
 *   - 經典模式、關掉本開關 → 回到原版（卷軸屬性蓋掉本身屬性）。
 *   - 傭兵拿這種武器同樣適用。
 *
 * 掛接：
 *   - 包 getWpnEle：雙屬性時回本身屬性 A（遺物機制、傭兵路徑都用這個當主屬性）。
 *   - window.__afkDualEleMult / __afkDualEleHas / __afkDualElePartner：給核心補丁 93（js/03、js/04、js/06 的一般攻擊屬性判斷）
 *     與 afk-relic-runtime（印記／易傷）、afk-relic-weapon-bridge（傭兵雙擊等）呼叫；沒有雙屬性時一律原樣回傳。
 *   - 包 buildItemDescHTML：說明多一行【屬性：A＋B】。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dualele', name: '雙屬性武器', group: '遊戲玩法', seal: true, def: true,
    desc: '本身有屬性的武器再賦予不同屬性時，兩種屬性同時有效' });
  function on() { return !T || T.enabled('dualele'); }

  var ELES = { fire: '火', water: '水', wind: '風', earth: '地' };
  var P = function () { return typeof player !== 'undefined' ? player : null; };

  // 回傳 { a: 本身屬性, b: 卷軸屬性 } 或 null。inst＝武器實例（含 attr），省略時用 owner（或玩家）的主手。
  function pairOf(owner, inst, def) {
    if (!on()) return null;
    var p = P(); if (p && p.classicMode) return null;
    if (!inst) { var o = owner || p; inst = o && o.eq && o.eq.wpn; }
    if (!inst || typeof DB === 'undefined') return null;
    var d = DB.items[inst.id]; if (!d || d.type !== 'wpn') return null;
    if (def && def !== d) return null;   // 揮的是另一把武器
    var a = d.ele;
    if (!ELES[a] || typeof getAttrAffix !== 'function') return null;
    var aff = getAttrAffix(inst.attr), b = aff && aff.ele;
    if (!ELES[b] || a === b) return null;
    return { a: a, b: b };
  }
  function ecm(e, te) { return typeof elementCounterMult === 'function' ? elementCounterMult(e, te) : 1; }

  // 一般攻擊的屬性剋制：取兩種屬性裡較有利的倍率
  W.__afkDualEleMult = function (m, owner, inst, defEle) {
    var pr = pairOf(owner, inst); if (!pr) return m;
    return Math.max(m, ecm(pr.a, defEle), ecm(pr.b, defEle));
  };
  // 這一擊的屬性 ele 是否也算 want（雙屬性武器的 A、B 互相算）
  W.__afkDualEleHas = function (ele, want, owner, inst) {
    if (ele === want) return true;
    var pr = pairOf(owner, inst); if (!pr) return false;
    return (ele === pr.a || ele === pr.b) && (want === pr.a || want === pr.b);
  };
  // 另一個屬性（ele 是 A 回 B、是 B 回 A；不是雙屬性回 null）
  W.__afkDualElePartner = function (ele, owner, inst, def) {
    var pr = pairOf(owner, inst, def); if (!pr) return null;
    return ele === pr.a ? pr.b : ele === pr.b ? pr.a : null;
  };
  W.__afkDualElePair = function (inst) { return pairOf(null, inst); };

  // 主屬性＝武器本身的屬性（遺物機制看這個，不再被卷軸蓋掉）
  if (typeof W.getWpnEle === 'function') {
    var oEle = W.getWpnEle;
    W.getWpnEle = function (wpnInst, wpnBase, owner) {
      var r = oEle.apply(this, arguments);
      try { var pr = wpnInst && pairOf(owner, wpnInst, wpnBase); if (pr && r === pr.b) return pr.a; } catch (e) {}
      return r;
    };
  } else console.warn('[afk-dualele] 找不到 getWpnEle，停用');

  // 說明：【屬性：火＋風】
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (item) {
      var h = oDesc.apply(this, arguments);
      try {
        var pr = item && pairOf(null, item);
        if (pr && typeof h === 'string') {
          h = h.replace('一般攻擊轉為' + ELES[pr.b] + '屬性', '一般攻擊再加上' + ELES[pr.b] + '屬性');
          h += '<br><span class="text-amber-200 font-bold">【屬性：' + ELES[pr.a] + '＋' + ELES[pr.b] + '】</span>'
            + '<span class="text-amber-100">兩種屬性同時有效：打怪的屬性剋制取對你較有利的一種，兩種屬性的弱點加成都吃得到。</span>';
        }
      } catch (e) {}
      return h;
    };
  }
})();
