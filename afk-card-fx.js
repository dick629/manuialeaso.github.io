/* ==========================================================================
 * afk-card-fx.js — 高階變身的動態特效層（玩家 2026-10-26：「自我特效可以加入」）
 *
 * 不改圖檔，在變身角色身上即時疊 SVG＋CSS 動畫（前層＋後層），每張卡依自己的主題：
 *   神話：八主題——烈焰（火舌＋火星）、暗黑（暗煙漩渦）、雷神（閃電）、冰霜（環繞冰晶＋寒霧）、
 *         翠玉（旋葉）、血月（背後血月＋紅霧）、黃金（旋轉光芒）、月銀（新月＋銀光）
 *   天上：背後展開的大光翼（拍動）＋天降光柱＋光環
 *   時空：腳下旋轉的時鐘魔法陣＋漂浮的時間碎片＋殘光
 *   聖衣：腳下星座陣（12 宮刻度）＋星座連線＋金色星芒
 * 主題對照由 scripts/forge-style.py 的分配產生（與圖檔上色一致）。
 * 開關：外掛開關「變身光環」；省電模式／背景分頁暫停動畫；「關閉光暈」時隱藏。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var MAP = {"神話・巴列斯": {"t": "mythic", "k": "烈焰", "look": "烈焰・巴列斯"}, "神話・艾莉絲": {"t": "mythic", "k": "暗黑", "look": "暗黑・艾莉絲"}, "神話・吸血鬼": {"t": "mythic", "k": "雷神", "look": "雷神・吸血鬼"}, "神話・炎魔": {"t": "mythic", "k": "冰霜", "look": "冰霜・炎魔"}, "神話・黑暗巡守": {"t": "mythic", "k": "翠玉", "look": "翠玉・黑暗巡守"}, "神話・黑暗法師": {"t": "mythic", "k": "血月", "look": "血月・黑暗法師"}, "神話・黑暗騎士": {"t": "mythic", "k": "黃金", "look": "黃金・黑暗騎士"}, "神話・銀光巡守": {"t": "mythic", "k": "月銀", "look": "月銀・銀光巡守"}, "神話・銀光法師": {"t": "mythic", "k": "烈焰", "look": "烈焰・銀光法師"}, "神話・銀光騎士": {"t": "mythic", "k": "暗黑", "look": "暗黑・銀光騎士"}, "神話・騎士范德": {"t": "mythic", "k": "雷神", "look": "雷神・騎士范德"}, "神話・惡魔": {"t": "mythic", "k": "冰霜", "look": "冰霜・惡魔"}, "神話・黃金巡守": {"t": "mythic", "k": "血月", "look": "血月・黃金巡守"}, "神話・黃金法師": {"t": "mythic", "k": "翠玉", "look": "翠玉・黃金法師"}, "神話・黃金騎士": {"t": "mythic", "k": "月銀", "look": "月銀・黃金騎士"}, "神話・白金巡守": {"t": "mythic", "k": "黃金", "look": "黃金・白金巡守"}, "神話・白金法師": {"t": "mythic", "k": "暗黑", "look": "暗黑・白金法師"}, "神話・白金騎士": {"t": "mythic", "k": "烈焰", "look": "烈焰・白金騎士"}, "神話・死亡": {"t": "mythic", "k": "雷神", "look": "雷神・死亡"}, "神話・反王肯恩": {"t": "mythic", "k": "冰霜", "look": "冰霜・反王肯恩"}, "神話・烈焰的死亡騎士": {"t": "mythic", "k": "翠玉", "look": "翠玉・烈焰的死亡騎士"}, "神話・莉絲安": {"t": "mythic", "k": "血月", "look": "血月・莉絲安"}, "神話・焚焰死亡騎士": {"t": "mythic", "k": "雷神", "look": "雷神・焚焰死亡騎士"}, "神話・黃金死亡騎士": {"t": "mythic", "k": "冰霜", "look": "冰霜・黃金死亡騎士"}, "神話・雷霆死亡騎士": {"t": "mythic", "k": "血月", "look": "血月・雷霆死亡騎士"}, "神話・闇黑死亡騎士": {"t": "mythic", "k": "黃金", "look": "黃金・闇黑死亡騎士"}, "神話・真夏納": {"t": "mythic", "k": "月銀", "look": "月銀・真夏納"}, "神話・伊詩蒂": {"t": "mythic", "k": "烈焰", "look": "烈焰・伊詩蒂"}, "神話・格利特": {"t": "mythic", "k": "暗黑", "look": "暗黑・格利特"}, "神話・特羅斯": {"t": "mythic", "k": "翠玉", "look": "翠玉・特羅斯"}, "神話・喬": {"t": "mythic", "k": "黃金", "look": "黃金・喬"}, "神話・絲莉安": {"t": "mythic", "k": "月銀", "look": "月銀・絲莉安"}, "天上・曙光聖騎": {"t": "celestial", "h": 48}, "天上・月羽神弓": {"t": "celestial", "h": 220}, "天上・熾光聖賢": {"t": "celestial", "h": 32}, "天上・天穹劍聖": {"t": "celestial", "h": 200}, "天上・雷霆天將": {"t": "celestial", "h": 210}, "天上・金輝守護": {"t": "celestial", "h": 45}, "天上・焚天戰神": {"t": "celestial", "h": 12}, "天上・夜幕天刃": {"t": "celestial", "h": 272}, "天上・天律裁決": {"t": "celestial", "h": 52}, "天上・星海魔導": {"t": "celestial", "h": 250}, "天上・雲端劍豪": {"t": "celestial", "h": 178}, "天上・天羽獵星": {"t": "celestial", "h": 125}, "天上・天影忍神": {"t": "celestial", "h": 300}, "天上・天命陰陽": {"t": "celestial", "h": 285}, "天上・曦光射手": {"t": "celestial", "h": 15}, "天上・天籟法師": {"t": "celestial", "h": 330}, "天上・天雷武士": {"t": "celestial", "h": 200}, "天上・天威大名": {"t": "celestial", "h": 0}, "天上・天弓姬武": {"t": "celestial", "h": 340}, "天上・蒼穹拳聖": {"t": "celestial", "h": 195}, "天上・天狼王": {"t": "celestial", "h": 30}, "時空・永劫騎士": {"t": "spacetime", "h": 0}, "時空・裂星獵手": {"t": "spacetime", "h": 212}, "時空・萬象先知": {"t": "spacetime", "h": 280}, "時空・虛空劍帝": {"t": "spacetime", "h": 15}, "時空・逆時雷霆": {"t": "spacetime", "h": 190}, "時空・終焉守門": {"t": "spacetime", "h": 45}, "時空・時砂暴君": {"t": "spacetime", "h": 25}, "時空・輪迴劍鬼": {"t": "spacetime", "h": 262}, "時空・次元裁判": {"t": "spacetime", "h": 55}, "時空・混沌魔尊": {"t": "spacetime", "h": 300}, "時空・時空劍豪": {"t": "spacetime", "h": 220}, "時空・星界弓神": {"t": "spacetime", "h": 185}, "時空・永夜忍皇": {"t": "spacetime", "h": 265}, "時空・時之巫女": {"t": "spacetime", "h": 320}, "白羊座聖衣": {"t": "samsara", "h": 5}, "金牛座聖衣": {"t": "samsara", "h": 120}, "雙子座聖衣": {"t": "samsara", "h": 200}, "巨蟹座聖衣": {"t": "samsara", "h": 185}, "獅子座聖衣": {"t": "samsara", "h": 30}, "處女座聖衣": {"t": "samsara", "h": 300}, "天秤座聖衣": {"t": "samsara", "h": 160}, "天蠍座聖衣": {"t": "samsara", "h": 340}, "射手座聖衣": {"t": "samsara", "h": 15}, "摩羯座聖衣": {"t": "samsara", "h": 260}, "水瓶座聖衣": {"t": "samsara", "h": 195}, "雙魚座聖衣": {"t": "samsara", "h": 220}};
  var NS = 'http://www.w3.org/2000/svg';
  var hsl = function (h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; };
  var THEME_HUE = { '烈焰': 22, '暗黑': 275, '雷神': 205, '冰霜': 190, '翠玉': 145, '血月': 355, '黃金': 45, '月銀': 225 };
  function wings(c1, c2, edge, span, cls) {
    var out = '';
    ['L', 'R'].forEach(function (sd) {
      var sg = sd === 'L' ? -1 : 1, g = '<g class="cf-wing cf-wing-' + sd + (cls ? ' ' + cls : '') + '">';
      for (var f = 0; f < 6; f++) { var ang = -70 + f * 22, len = (42 - f * 3) * span; g += '<path d="M50 52 q' + (sg * len * 0.5) + ' ' + (-len * 0.35 + ang * 0.1) + ' ' + (sg * len) + ' ' + (ang * 0.32) + ' q' + (-sg * 6) + ' 5 ' + (-sg * len) + ' ' + (-ang * 0.32 + 6) + 'Z" fill="' + (f % 2 ? c1 : c2) + '" stroke="' + edge + '" stroke-width=".4"/>'; }
      out += g + '</g>';
    });
    return out;
  }
  // viewBox 0 0 100 120：身體約在 x 30~70、腳底 y=108
  function kit(info) {
    var t = info.t, k = info.k, h = info.h != null ? info.h : THEME_HUE[k] || 45, back = '', front = '', i;
    if (t === 'mythic') {
      back += wings(hsl(h, 85, 60, 0.45), hsl(h, 90, 75, 0.35), hsl(h, 100, 80, 0.8), 0.8, 'cf-wing-small');
      if (k === '烈焰') {
        back += '<ellipse cx="50" cy="70" rx="30" ry="42" fill="url(#cfg-heat)" class="cf-pulse"/><g style="filter:blur(.5px)">';
        var FL = [[30, 66], [36, 50], [43, 40], [50, 34], [57, 42], [64, 52], [70, 68], [26, 84], [74, 82]];
        FL.forEach(function (q, j) { var x = q[0], top = q[1], wd = 4 + (j % 3); back += '<path class="cf-flame" style="animation-delay:' + (-j * 0.13) + 's;animation-duration:' + (0.55 + (j % 4) * 0.12) + 's" d="M' + (x - wd) + ' 108 C' + (x - wd - 2) + ' ' + (top + 30) + ' ' + (x - 2) + ' ' + (top + 12) + ' ' + (x + (j % 2 ? 2 : -2)) + ' ' + top + ' C' + (x + 3) + ' ' + (top + 14) + ' ' + (x + wd + 2) + ' ' + (top + 28) + ' ' + (x + wd) + ' 108Z" fill="url(#cfg-fire)"/>'; });
        back += '</g>';
        for (i = 0; i < 9; i++) front += '<circle class="cf-rise" style="animation-delay:' + (-i * 0.37) + 's" cx="' + (28 + (i * 37) % 46) + '" cy="104" r="' + (0.9 + (i % 3) * 0.4) + '" fill="#ffd27a"/>';
      } else if (k === '暗黑') {
        for (i = 0; i < 5; i++) back += '<ellipse class="cf-spin" style="animation-duration:' + (6 + i) + 's;animation-delay:' + (-i) + 's" cx="50" cy="' + (60 + i * 9) + '" rx="' + (26 + i * 2) + '" ry="7" fill="none" stroke="url(#cfg-dark)" stroke-width="' + (5 - i * 0.6) + '"/>';
        back += '<ellipse cx="50" cy="106" rx="30" ry="6" fill="' + hsl(275, 70, 18, 0.7) + '" class="cf-pulse"/>';
        front += '<circle class="cf-blink" cx="45" cy="34" r="0.9" fill="#d8b4fe"/><circle class="cf-blink" cx="55" cy="34" r="0.9" fill="#d8b4fe"/>';
      } else if (k === '雷神') {
        back += '<ellipse cx="50" cy="70" rx="30" ry="44" fill="url(#cfg-glow)" class="cf-pulse"/>';
        var bolts = ['M30 20 L38 44 L31 46 L42 74', 'M70 28 L62 52 L69 54 L58 86', 'M24 70 L36 82 L30 86 L40 104', 'M76 66 L64 80 L71 83 L60 102'];
        bolts.forEach(function (d, j) { front += '<path class="cf-bolt" style="animation-delay:' + (j * 0.31) + 's" d="' + d + '" fill="none" stroke="#e0f2fe" stroke-width="1.6" stroke-linejoin="bevel"/>'; });
      } else if (k === '冰霜') {
        back += '<ellipse cx="50" cy="106" rx="32" ry="7" fill="' + hsl(190, 90, 85, 0.35) + '" class="cf-pulse"/>';
        front += '<g class="cf-orbit">';
        for (i = 0; i < 6; i++) { var a = i * 60 * Math.PI / 180, cx = 50 + Math.cos(a) * 30, cy = 66 + Math.sin(a) * 10; front += '<path d="M' + cx + ' ' + (cy - 4) + ' L' + (cx + 2) + ' ' + cy + ' L' + cx + ' ' + (cy + 4) + ' L' + (cx - 2) + ' ' + cy + 'Z" fill="#e0fbff" stroke="#67e8f9" stroke-width=".5"/>'; }
        front += '</g>';
      } else if (k === '翠玉') {
        front += '<g class="cf-orbit" style="animation-duration:5s">';
        for (i = 0; i < 7; i++) { var b = i * 51 * Math.PI / 180, lx = 50 + Math.cos(b) * 28, ly = 72 + Math.sin(b) * 12 - i * 3; front += '<ellipse cx="' + lx + '" cy="' + ly + '" rx="2.6" ry="1.1" fill="' + hsl(140, 70, 55, 0.9) + '" transform="rotate(' + (i * 40) + ' ' + lx + ' ' + ly + ')"/>'; }
        front += '</g>'; back += '<ellipse cx="50" cy="106" rx="30" ry="6" fill="none" stroke="' + hsl(145, 80, 55, 0.6) + '" stroke-width="1.5" class="cf-pulse"/>';
      } else if (k === '血月') {
        back += '<circle cx="50" cy="34" r="24" fill="url(#cfg-moon)" class="cf-pulse"/><ellipse cx="50" cy="106" rx="34" ry="7" fill="' + hsl(355, 80, 30, 0.45) + '" class="cf-pulse"/>';
        for (i = 0; i < 5; i++) front += '<ellipse class="cf-fall" style="animation-delay:' + (-i * 0.5) + 's" cx="' + (32 + i * 9) + '" cy="40" rx=".7" ry="1.4" fill="#ef4444"/>';
      } else if (k === '黃金') {
        back += '<g class="cf-spin" style="animation-duration:14s">';
        for (i = 0; i < 12; i++) back += '<polygon points="50,62 ' + (50 + 4) + ',' + 4 + ' ' + (50 - 4) + ',' + 4 + '" fill="' + hsl(45, 100, 70, 0.22) + '" transform="rotate(' + (i * 30) + ' 50 62)"/>';
        back += '</g>';
        for (i = 0; i < 8; i++) front += '<path class="cf-twinkle" style="animation-delay:' + (-i * 0.4) + 's" d="M' + (26 + (i * 29) % 50) + ' ' + (30 + (i * 23) % 70) + ' l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1z" fill="#fff4c2"/>';
      } else {   // 月銀
        back += '<path d="M62 14 A20 20 0 1 0 62 54 A15 15 0 1 1 62 14Z" fill="' + hsl(225, 60, 88, 0.55) + '" class="cf-pulse"/>';
        for (i = 0; i < 8; i++) front += '<circle class="cf-rise" style="animation-delay:' + (-i * 0.45) + 's" cx="' + (27 + (i * 31) % 48) + '" cy="104" r="1" fill="#eef2ff"/>';
      }
    } else if (t === 'celestial') {
      var c1 = hsl(h, 70, 85, 0.75), c2 = hsl(48, 100, 92, 0.85);
      back += '<rect x="40" y="-40" width="20" height="150" fill="url(#cfg-pillar)" class="cf-pulse"/>';
      back += wings(c1, c2, hsl(48, 100, 80, 0.9), 1);
      front += '<ellipse cx="50" cy="12" rx="11" ry="3" fill="none" stroke="#fff3c4" stroke-width="1.4" class="cf-pulse"/>';
      for (i = 0; i < 6; i++) front += '<ellipse class="cf-fall" style="animation-delay:' + (-i * 0.6) + 's" cx="' + (26 + (i * 37) % 48) + '" cy="30" rx="1.6" ry=".7" fill="' + c1 + '"/>';
    } else if (t === 'spacetime') {
      var cc = hsl(h, 90, 70, 0.85);
      back += wings(hsl(h, 90, 70, 0.28), hsl((h + 40) % 360, 90, 80, 0.22), hsl(h, 100, 85, 0.9), 0.95, 'cf-wing-crystal');
      back += '<g transform="translate(50 106) scale(1 .32)"><g class="cf-spin" style="animation-duration:9s"><circle r="34" fill="none" stroke="' + cc + '" stroke-width="1.6"/><circle r="27" fill="none" stroke="' + cc + '" stroke-width=".8" stroke-dasharray="2 3"/>';
      for (i = 0; i < 12; i++) back += '<rect x="-.8" y="-34" width="1.6" height="' + (i % 3 ? 4 : 8) + '" fill="' + cc + '" transform="rotate(' + (i * 30) + ')"/>';
      back += '<line x1="0" y1="0" x2="0" y2="-24" stroke="#fff" stroke-width="1.4"/><line x1="0" y1="0" x2="16" y2="0" stroke="#fff" stroke-width="1.2"/></g></g>';
      for (i = 0; i < 6; i++) front += '<polygon class="cf-float" style="animation-delay:' + (-i * 0.7) + 's" points="' + (24 + (i * 41) % 52) + ',' + (30 + (i * 17) % 60) + ' ' + (27 + (i * 41) % 52) + ',' + (27 + (i * 17) % 60) + ' ' + (29 + (i * 41) % 52) + ',' + (32 + (i * 17) % 60) + '" fill="' + hsl(h, 80, 80, 0.8) + '" stroke="#fff" stroke-width=".3"/>';
    } else if (t === 'samsara') {
      var zc = hsl(h, 85, 65, 0.9);
      back += '<g transform="translate(50 106) scale(1 .3)"><g class="cf-spin" style="animation-duration:16s"><circle r="36" fill="none" stroke="#fcd34d" stroke-width="1.8"/><circle r="30" fill="none" stroke="' + zc + '" stroke-width="1"/>';
      for (i = 0; i < 12; i++) back += '<circle cx="0" cy="-33" r="2" fill="' + (i % 2 ? '#fde68a' : zc) + '" transform="rotate(' + (i * 30) + ')"/>';
      back += '</g></g><ellipse cx="50" cy="66" rx="34" ry="48" fill="url(#cfg-gold)" class="cf-pulse"/>';
      var pts = [[30, 30], [38, 22], [50, 26], [60, 18], [70, 28]];
      front += '<polyline class="cf-pulse" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" fill="none" stroke="' + zc + '" stroke-width=".5"/>';
      pts.forEach(function (p, j) { front += '<circle class="cf-twinkle" style="animation-delay:' + (-j * 0.5) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="1.3" fill="#fffbe6"/>'; });
    }
    return { back: back, front: front, hue: h };
  }
  var DEFS = function (h) {
    return '<defs>' +
      '<linearGradient id="cfg-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b91c1c" stop-opacity=".0"/><stop offset=".12" stop-color="#ff4d1a" stop-opacity=".75"/><stop offset=".55" stop-color="#ffa53a" stop-opacity=".6"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="cfg-heat"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".28"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="cfg-dark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e0538" stop-opacity="0"/><stop offset=".5" stop-color="#7e22ce" stop-opacity=".75"/><stop offset="1" stop-color="#1e0538" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="cfg-glow"><stop offset="0" stop-color="#bae6fd" stop-opacity=".35"/><stop offset="1" stop-color="#0ea5e9" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="cfg-moon"><stop offset="0" stop-color="#fca5a5" stop-opacity=".85"/><stop offset=".7" stop-color="#b91c1c" stop-opacity=".55"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="cfg-gold"><stop offset="0" stop-color="#fde68a" stop-opacity=".22"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="cfg-pillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffbeb" stop-opacity="0"/><stop offset=".5" stop-color="#fffbeb" stop-opacity=".35"/><stop offset="1" stop-color="#fffbeb" stop-opacity="0"/></linearGradient>' +
      '</defs>';
  };
  var css = document.createElement('style'); css.id = 'afk-card-fx-style';
  css.textContent = [
    '.afk-cfx{position:absolute;pointer-events:none;overflow:visible}',
    '.afk-cfx svg{width:100%;height:100%;overflow:visible;display:block}',
    '.afk-cfx-back{z-index:0}.afk-cfx-front{z-index:4}',
    '.afk-cfx *{transform-box:fill-box;transform-origin:center}',
    '.cf-flame{transform-origin:bottom;animation:cf-flick .7s ease-in-out infinite alternate}',
    '@keyframes cf-flick{0%{transform:scaleY(.75) skewX(-4deg);opacity:.65}100%{transform:scaleY(1.12) skewX(4deg);opacity:1}}',
    '.cf-rise{animation:cf-rise 2.4s linear infinite}@keyframes cf-rise{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-80px);opacity:0}}',
    '.cf-fall{animation:cf-fall 3s linear infinite}@keyframes cf-fall{0%{transform:translateY(-10px) rotate(0);opacity:0}20%{opacity:1}100%{transform:translateY(70px) rotate(160deg);opacity:0}}',
    '.cf-spin{transform-box:view-box;transform-origin:50px 62px;animation:cf-spin 8s linear infinite}g[transform] > .cf-spin{transform-origin:0 0;transform-box:view-box}',
    '@keyframes cf-spin{to{transform:rotate(360deg)}}',
    '.cf-orbit{transform-box:view-box;transform-origin:50px 68px;animation:cf-orbit 4s linear infinite}@keyframes cf-orbit{0%{transform:rotateY(0) rotate(0)}100%{transform:rotate(360deg)}}',
    '.cf-pulse{animation:cf-pulse 2.6s ease-in-out infinite}@keyframes cf-pulse{0%,100%{opacity:.55}50%{opacity:1}}',
    '.cf-blink{animation:cf-blink 3s steps(1) infinite}@keyframes cf-blink{0%,90%{opacity:1}95%{opacity:0}}',
    '.cf-bolt{opacity:0;filter:drop-shadow(0 0 2px #38bdf8);animation:cf-bolt 1.3s steps(1) infinite}@keyframes cf-bolt{0%{opacity:1}8%{opacity:.2}12%{opacity:1}20%,100%{opacity:0}}',
    '.cf-twinkle{animation:cf-tw 1.8s ease-in-out infinite}@keyframes cf-tw{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.2)}}',
    '.cf-float{animation:cf-float 3.2s ease-in-out infinite}@keyframes cf-float{0%,100%{transform:translateY(0) rotate(0);opacity:.5}50%{transform:translateY(-6px) rotate(180deg);opacity:1}}',
    '.cf-wing{transform-box:view-box;animation:cf-flap 2.4s ease-in-out infinite}.cf-wing-crystal{animation-duration:3.4s;filter:drop-shadow(0 0 2px rgba(255,255,255,.5))}.cf-wing-small{animation-duration:1.8s}.cf-wing-L{transform-origin:50px 52px}.cf-wing-R{transform-origin:50px 52px;animation-delay:0s}',
    '@keyframes cf-flap{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.82) translateY(2px)}}',
    '.afk-card-aura-downed .afk-cfx{opacity:.15}.afk-card-aura-downed .afk-cfx *{animation:none!important}',
    'body.afk-no-glow .afk-cfx{display:none}',
    'body.afk-no-animation .afk-cfx *,body.afk-card-background .afk-cfx *{animation-play-state:paused!important}',
    '@media(prefers-reduced-motion:reduce){.afk-cfx *{animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);
  function clear(el) { el.querySelectorAll(':scope > .afk-cfx').forEach(function (n) { n.remove(); }); el.removeAttribute('data-cfx'); }
  W.__afkCardFx = function (el, actor, f, tier, geometry, down) {
    if (!el) return;
    if (!tier || tier === 'diamond' || tier === 'mythic' || (T && !T.enabled('card-aura'))) { clear(el); return; }   // 神話只換色，不疊特效（玩家 2026-10-26）
    var info = MAP[f && f.n] || MAP[f && f.n && f.n.replace(/^輪迴・/, '')];
    if (!info) { clear(el); return; }
    if (!geometry) return;
    var bh = geometry.height / 1.35, w = Math.round(bh * 1.25), hgt = Math.round(bh * 1.5);
    var key = f.n + '|' + w + 'x' + hgt;
    if (el.getAttribute('data-cfx') !== key) {
      clear(el); el.setAttribute('data-cfx', key);
      var k = kit(info);
      ['back', 'front'].forEach(function (layer) {
        if (!k[layer]) return;
        var span = document.createElement('span'); span.className = 'afk-cfx afk-cfx-' + layer; span.setAttribute('aria-hidden', 'true');
        span.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 100 120" preserveAspectRatio="none">' + DEFS(k.hue) + k[layer] + '</svg>';
        if (layer === 'back') el.prepend(span); else el.appendChild(span);
      });
    }
    var cx = geometry.hx != null ? geometry.hx : geometry.left;
    el.querySelectorAll(':scope > .afk-cfx').forEach(function (s) {
      s.style.width = w + 'px'; s.style.height = hgt + 'px';
      s.style.left = Math.round(cx - w / 2) + 'px';
      s.style.bottom = Math.round(geometry.bottom - hgt * (12 / 120)) + 'px';
    });
  };
  // 卡片說明加上外觀造型（參照月畔天堂的變身卡設計）
  var addLook = function () { try {
    var A = W.AFK_CARD_ASCENSION;
    if (A && A.catalog) ['mythic', 'celestial', 'spacetime', 'samsara'].forEach(function (t) { (A.catalog[t] || []).forEach(function (row) { var info = MAP[row.n]; if (info && info.look && row.desc && row.desc.indexOf('外觀造型：') < 0) row.desc += ' 外觀造型：' + info.look + '。'; }); });
  } catch (e) {} };
  addLook(); W.addEventListener('load', addLook);
  W.__afkClothBaked = true;   // 聖衣的星座背翼已畫進圖檔（scripts/forge-style.py bake_wings），不再即時疊一層
  W.__afkCardFxMap = MAP;
  console.log('[AFK-card-fx] 已啟用：高階變身動態特效 ' + Object.keys(MAP).length + ' 種');
})();
