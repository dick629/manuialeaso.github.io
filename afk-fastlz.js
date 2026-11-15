/* ==========================================================================
 * afk-fastlz.js — 存檔壓縮加速（玩家 2026-10-27：回城卡頓 ~0.5 秒）
 *
 * 回城會結算傭兵經驗並立刻存檔；開著「存檔即時壓縮」時，這次存檔要當場把整份存檔
 * 用 LZString.compressToUTF16 壓一次，量到佔了回城停頓的一半（約 200ms）。
 *
 * 原版 LZString._compress 用「字串當字典鍵」：每讀一個字就串一個新字串去查物件，
 * 大存檔會產生大量暫存字串（又慢又吃 GC）。這裡改用「字典樹」（每個節點用 Map 以字碼查子節點），
 * 演算法、編碼位元與輸出逐位元完全相同——舊存檔照常讀，新存檔原版也讀得回來。
 *
 * 安全網：
 *   ‧輸入含「__proto__」時，原版的物件字典有已知怪癖（那個鍵寫不進去），為了逐位元一致直接交給原版。
 *   ‧載入時用幾段樣本（含中文、表情符號、長重複字串）跟原版比對，任何一段不同就整個不啟用。
 *   ‧只換壓縮；解壓、背景 Worker、存檔格式全部不動。
 * 11-15 第二版：字典樹的節點改用型別陣列（第一個子節點／兄弟／字碼）、輸出先收字碼再一次轉字串；
 *   2.6 MB 存檔 約 600 → 360 毫秒（node）。getCharFromInt 不是單一字元時交回原版。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof LZString === 'undefined' || typeof LZString._compress !== 'function') { console.warn('[AFK-fastlz] 找不到 LZString，略過'); return; }
  if (LZString._compress.__afkFast) return;
  var orig = LZString._compress;

  var BAD = {};
  function fast(uncompressed, bitsPerChar, getCharFromInt) {
    try { return fast0.apply(this, arguments); } catch (e) { if (e === BAD) return orig.apply(this, arguments); throw e; }
  }
  function fast0(uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return '';
    if (uncompressed.indexOf('__proto__') >= 0) return orig.apply(this, arguments);
    // 單字：字碼 → 字典編號（-1＝還沒見過）；pending＝還沒輸出過字面值的單字
    var single = new Int32Array(65536).fill(-1), pending = new Uint8Array(65536);
    // 字典樹改成型別陣列（11-15 第二版）：first＝第一個子節點、sib＝下一個兄弟、chr＝這個節點的最後一個字碼；不夠就加倍
    var cap = 4096; while (cap < (uncompressed.length >> 2)) cap <<= 1; var first = new Int32Array(cap).fill(-1), sib = new Int32Array(cap), chr = new Int32Array(cap);
    var grow = function () { var nc = cap * 2, f2 = new Int32Array(nc).fill(-1), s2 = new Int32Array(nc), c2 = new Int32Array(nc); f2.set(first); s2.set(sib); c2.set(chr); first = f2; sib = s2; chr = c2; cap = nc; };            // (片段編號 × 65536 ＋ 下一字碼) → 新片段編號
    var dictSize = 3, numBits = 2, enlargeIn = 2;
    var lut = new Int32Array(1 << bitsPerChar).fill(-1), out = new Uint16Array(Math.max(1024, uncompressed.length)), on = 0, val = 0, pos = 0, last = bitsPerChar - 1, ch;
    var w = -1, wcc = -1;             // 目前片段的編號；wcc＝片段是單字時的字碼（否則 -1）
    var n = uncompressed.length, i, k, value, cc, code, key, nx;
    for (i = 0; i <= n; i++) {
      if (i < n) {
        cc = uncompressed.charCodeAt(i); code = single[cc];
        if (code < 0) { if (dictSize + 2 >= cap) grow(); code = single[cc] = dictSize++; pending[cc] = 1; }
        if (w < 0) { w = code; wcc = cc; continue; }
        nx = first[w]; while (nx >= 0 && chr[nx] !== cc) nx = sib[nx];
        if (nx >= 0) { w = nx; wcc = -1; continue; }
      } else if (w < 0) break;
      // 輸出目前片段 w
      if (wcc >= 0 && pending[wcc] === 1) {
        if (wcc < 256) {
          for (k = 0; k < numBits; k++) { val = val << 1; if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; }
          value = wcc;
          for (k = 0; k < 8; k++) { val = (val << 1) | (value & 1); if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; value >>= 1; }
        } else {
          value = 1;
          for (k = 0; k < numBits; k++) { val = (val << 1) | value; if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; value = 0; }
          value = wcc;
          for (k = 0; k < 16; k++) { val = (val << 1) | (value & 1); if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; value >>= 1; }
        }
        enlargeIn--; if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
        pending[wcc] = 0;
      } else {
        value = w;
        for (k = 0; k < numBits; k++) { val = (val << 1) | (value & 1); if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; value >>= 1; }
      }
      enlargeIn--; if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      if (i === n) break;
      if (dictSize + 2 >= cap) grow(); nx = dictSize++; chr[nx] = cc; sib[nx] = first[w]; first[w] = nx;
      w = code; wcc = cc;
    }
    // 結束記號（2）
    value = 2;
    for (k = 0; k < numBits; k++) { val = (val << 1) | (value & 1); if (pos === last) { pos = 0; ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; val = 0; } else pos++; value >>= 1; }
    while (true) { val = val << 1; if (pos === last) { ch = lut[val]; if (ch < 0) { var s1 = getCharFromInt(val); if (typeof s1 !== 'string' || s1.length !== 1) throw BAD; ch = lut[val] = s1.charCodeAt(0); } if (on === out.length) { var o2 = new Uint16Array(on * 2); o2.set(out); out = o2; } out[on++] = ch; break; } else pos++; }
    var parts = []; for (k = 0; k < on; k += 8192) parts.push(String.fromCharCode.apply(null, out.subarray(k, Math.min(on, k + 8192)))); return parts.join('');
  }

  // 自我驗證：跟原版逐字比對
  var samples = ['', 'a', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'abababababcabcabcabcd', '{"n":"席琳結晶","cnt":12,"lv":80}',
    '😀😀😀 混合 ascii 和中文 中文中文 ' + Array(60).join('{"id":"wpn_aden_sword","en":9,"bless":true},'),
    JSON.stringify({ a: [1, 2, 3, 'abc', '天堂透視鏡'], b: Array(300).join('xĀy￿z') }),
    (function () { var t = '', x = 7; for (var q = 0; q < 3000; q++) { x = (x * 1103515245 + 12345) & 0x7fffffff; t += String.fromCharCode(32 + (x % 90), 0x4e00 + (x % 40)); } return t; })()];   // 會讓字典樹加倍
  var ok = true;
  try {
    var f16 = function (a) { return String.fromCharCode(a + 32); }, f64 = function (a) { return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.charAt(a); };
    for (var s = 0; s < samples.length && ok; s++) {
      if (fast(samples[s], 15, f16) !== orig(samples[s], 15, f16)) ok = false;
      else if (fast(samples[s], 6, f64) !== orig(samples[s], 6, f64)) ok = false;
      else if (fast(samples[s], 16, String.fromCharCode) !== orig(samples[s], 16, String.fromCharCode)) ok = false;
    }
  } catch (e) { ok = false; }
  if (!ok) { console.warn('[AFK-fastlz] 自我驗證不一致，維持原版壓縮'); return; }
  fast.__afkFast = true;
  LZString._compress = fast;
  window.__afkFastLz = { orig: orig, fast: fast };
  console.log('[AFK-fastlz] 已啟用：存檔壓縮改用型別陣列字典樹（輸出與原版逐位元相同）');
})();
