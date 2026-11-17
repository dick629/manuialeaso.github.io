/* ============================================================================
 * afk-dmglabel.js — 增傷效果的種類標示（Ping 11-17 20:49「開始製作」）
 *
 *   裝備、遺物、卡片、魔法娃娃的說明裡，提升傷害的字樣前面加上種類：
 *     〔近戰〕近距離傷害、近距離爆擊傷害
 *     〔遠程〕遠距離傷害、遠距離爆擊傷害
 *     〔魔法〕魔法傷害、攻擊魔法造成的傷害、額外魔法點數、魔法爆擊傷害
 *     〔屬性〕火／水／風／地屬性傷害、屬性傷害
 *     〔通用〕額外傷害（近戰、遠程、魔法都吃）、造成的傷害、對頭目傷害、最終傷害、爆擊傷害
 *   「受到的…傷害」「傷害減免」「反彈」「吸收」這類防禦字樣不標。
 *   作法：包 buildItemDescHTML（全遊戲的物品說明都走它：背包、裝備欄、倉庫、黑市、圖鑑、百科），
 *   只改標籤以外的文字，不動數值、不改資料。技能、光環：遊戲的浮動說明框（.game-tooltip）內容一變就補標；百科的能力名稱表一起標。
 *   標籤卡（卡片鑲嵌）之後跟卡片系統一起做。外掛開關 dmglabel。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dmglabel', name: '增傷種類標示', group: '介面', desc: '物品說明裡提升傷害的字樣前面標上〔近戰〕〔遠程〕〔魔法〕〔屬性〕〔通用〕' });
  if (T && !T.enabled('dmglabel')) return;

  var RX = /(近\/遠\/魔法爆擊傷害|近距離爆擊傷害|近距離傷害|近戰傷害|遠距離爆擊傷害|遠距離傷害|遠程傷害|攻擊魔法造成的傷害|魔法爆擊傷害|魔法傷害|法術傷害|額外魔法點數|[火水風地]屬性(?:魔法)?傷害|屬性傷害|額外傷害|最終傷害|所有傷害|對頭目(?:造成的)?傷害|造成的傷害|爆擊傷害)(?!減免|抗性|吸收)/g;
  var NO = /受到|減免|承受|反彈|吸收|抵銷|免疫|敵人|怪物|對你|不受|不吃|不算|無視/;
  var KIND = function (w) {
    if (/^近\/遠/.test(w)) return 'all';
    if (/^近/.test(w)) return 'melee';
    if (/^遠/.test(w)) return 'ranged';
    if (/^[火水風地]屬性|^屬性/.test(w)) return 'ele';
    if (/魔法|法術/.test(w)) return 'magic';
    return 'all';
  };
  var NAME = { melee: '近戰', ranged: '遠程', magic: '魔法', ele: '屬性', all: '通用' };
  var tagText = function (s, html) {
    return s.replace(RX, function (w, _g, off, str) {
      var pre = str.slice(Math.max(0, off - 8), off);
      if (/〕\s*$/.test(pre) || NO.test(pre)) return w;
      if (/^\s*(?:[−\-－]|歸零|減半|魔法|影響|的傷害)/.test(str.slice(off + w.length, off + w.length + 4))) return w;   // 降低傷害的不標
      var k = KIND(w);
      return (html ? '<span class="afk-dl afk-dl-' + k + '">〔' + NAME[k] + '〕</span>' : '〔' + NAME[k] + '〕') + w;
    });
  };
  // HTML：只改標籤之外的文字（屬性值、title 不動）
  var tagHtml = function (h) {
    if (!h || typeof h !== 'string' || h.indexOf('傷害') < 0 && h.indexOf('魔法點數') < 0) return h;
    return h.replace(/(<[^>]*>)|([^<]+)/g, function (all, tag, txt, off, str) {
      if (tag) return tag;
      if (/〕<\/span>$/.test(str.slice(Math.max(0, off - 8), off))) return txt.charAt(0) + tagText(txt.slice(1), true);   // 已標過（被包了兩層時）
      return tagText(txt, true);
    });
  };
  var css = function () {
    if (document.getElementById('afk-dl-css')) return;
    var s = document.createElement('style'); s.id = 'afk-dl-css';
    s.textContent = '.afk-dl{font-size:.85em;font-weight:700;letter-spacing:0}.afk-dl-melee{color:#fb923c}.afk-dl-ranged{color:#4ade80}.afk-dl-magic{color:#a78bfa}.afk-dl-ele{color:#fbbf24}.afk-dl-all{color:#cbd5e1}';
    (document.head || document.documentElement).appendChild(s);
  };
  try { css(); } catch (e) {}
  var hook = function () {
    var o = W.buildItemDescHTML; if (typeof o !== 'function' || o.__afkDL || o.__afkDLin) return;
    var f = function () { var r = o.apply(this, arguments); try { return tagHtml(r); } catch (e) { return r; } };
    f.__afkDL = true; W.buildItemDescHTML = f;
    try { (0, eval)('buildItemDescHTML = window.buildItemDescHTML'); } catch (e) {}
  };
  hook(); try { W.addEventListener('load', function () { hook(); setTimeout(hook, 2000); }); } catch (e) {}
  // 11-17（Ping）：技能、光環的說明也標——遊戲的浮動說明框（技能頁滑鼠移上去那個）內容一變就補上標籤
  var SEL = '.game-tooltip,#pandora-tooltip';
  var watched = typeof WeakSet === 'function' ? new WeakSet() : null;
  var fix = function (el) { try { var h = el.innerHTML, n = tagHtml(h); if (n !== h) el.innerHTML = n; } catch (e) {} };
  var watch = function () {
    if (!watched || typeof MutationObserver !== 'function') return;
    document.querySelectorAll(SEL).forEach(function (el) {
      if (watched.has(el)) return; watched.add(el);
      var busy = false, mo = new MutationObserver(function () { if (busy) return; busy = true; fix(el); busy = false; mo.takeRecords(); });
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      fix(el);
    });
  };
  setInterval(watch, 1500);
  W.__afkDmgLabel = { text: function (s) { return tagText(String(s == null ? '' : s), false); }, html: tagHtml, NAME: NAME };
})();
