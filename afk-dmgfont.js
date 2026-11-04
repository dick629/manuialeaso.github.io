/* ============================================================================
 * afk-dmgfont.js — 🔤 傷害字體（玩家 2026-11-05；外掛開關 dmgfont，預設開；經典模式沒有）
 *
 *   潘朵拉黑市多一個分頁「🔤 字體販賣所」：用龍之鑽石買傷害字體，買一次全帳號共用，隨時可換回「經典」。
 *   只換「你這邊打出去的傷害」——遊戲裡所有飄字都畫在怪物身上（你、傭兵、召喚物打出去的），所以整層換；
 *   「未命中」維持原樣。每款只收錄數字與少數字（爆擊、重擊、億、萬…），字型檔 1～4 KB（assets/fonts/dmg/，皆 OFL 授權）。
 *   第一批 8 款＋泡泡彩虹（Ping 定：每款 500 萬龍鑽）。加新款＝在 FONTS 加一筆（id、名稱、說明、價格、字型檔、CSS）。
 *   繁星、泡泡彩虹：數字改用中文單位（1億 2345萬）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dmgfont', name: '傷害字體（潘朵拉黑市・字體販賣所）', group: '介面', def: true, seal: true,
    desc: '潘朵拉黑市多一個「字體販賣所」分頁，用龍之鑽石買傷害數字的字體；關掉一律用經典字體' });
  var on = function () { return !T || T.enabled('dmgfont'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var el = function (id) { return document.getElementById(id); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  var DIR = 'assets/fonts/dmg/';
  var SEL = function (id) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg:not(.vfx-miss),.dmgf-pv.dmgf-' + id + ' .vfx-dmg'; };
  var CRIT = function (id) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg.vfx-crit .vfx-dmg-value,.dmgf-pv.dmgf-' + id + ' .vfx-dmg.vfx-crit .vfx-dmg-value'; };
  var TAG = function (id, col) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg .vfx-dmg-tag,.dmgf-pv.dmgf-' + id + ' .vfx-dmg .vfx-dmg-tag{-webkit-text-fill-color:' + col + '!important;color:' + col + '!important}'; };
  var GRAD = function (g) { return 'background:' + g + ';-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent!important;color:transparent!important;'; };
  // 每一款：id、n 名稱、d 說明、price 龍鑽、fam 字型、css(sel, crit) 回傳這款的樣式
  var FONTS = [
    { id: 'honey', n: '蜜糖彈跳', d: '圓胖的橘黃糖果字，彈出來再往上飄；爆擊變粉紫色、抖一下。', price: 5000000, fam: 'honey', css: function (s, c) {
      return s + '{font-family:"afkdmg-honey",sans-serif!important;' + GRAD('linear-gradient(#fff9c4,#ffd54f 45%,#ff8f00)') + '-webkit-text-stroke:2px #4e2a0c!important;text-shadow:none!important;filter:drop-shadow(0 2px 0 #4e2a0c) drop-shadow(0 0 2px #000);letter-spacing:1px;animation-name:dmgfPop!important}'
        + c + '{' + GRAD('linear-gradient(#ffe4f7,#f472b6 50%,#a21caf)') + 'animation:dmgfShake .35s ease-out}' + TAG('honey', '#fde68a'); } },
    { id: 'pixel', n: '古都像素', d: '白色像素字、粗黑框，直直往上升；爆擊變黃色。', price: 5000000, fam: 'pixel', css: function (s, c) {
      return s + '{font-family:"afkdmg-pixel",monospace!important;color:#fff!important;-webkit-text-stroke:0!important;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,2px 2px #000,-2px -2px #000,2px -2px #000,-2px 2px #000!important;-webkit-font-smoothing:none;animation-name:dmgfRise!important;animation-timing-function:linear!important}'
        + c + '{color:#ffe600!important}'; } },
    { id: 'crystal', n: '水晶之章', d: '白字帶淡藍光，往下掉再小彈兩下；爆擊是金色。', price: 5000000, fam: 'crystal', css: function (s, c) {
      return s + '{font-family:"afkdmg-crystal",monospace!important;font-size:15px!important;color:#fff!important;-webkit-text-stroke:0!important;text-shadow:2px 2px 0 #10204a,0 0 6px #7dd3fc!important;animation:dmgfDrop 1.05s ease-out forwards!important}'
        + 'body.dmgf-crystal #vfx-layer .vfx-dmg.vfx-crit,.dmgf-pv.dmgf-crystal .vfx-dmg.vfx-crit{font-size:22px!important}'
        + c + '{color:#ffe066!important;text-shadow:2px 2px 0 #4a2a00,0 0 8px #facc15!important}'; } },
    { id: 'horde', n: '部落榮光', d: '黃色的奇幻襯線字，往上飄、微微偏一邊；爆擊先爆大再縮回。', price: 5000000, fam: 'horde', css: function (s, c) {
      return s + '{font-family:"afkdmg-horde",serif!important;color:#ffd100!important;-webkit-text-stroke:1.5px #000!important;text-shadow:0 2px 2px #000!important;animation-name:dmgfDrift!important}'
        + 'body.dmgf-horde #vfx-layer .vfx-dmg.vfx-crit,.dmgf-pv.dmgf-horde .vfx-dmg.vfx-crit{animation:dmgfBurst 1.05s ease-out forwards!important}'
        + c + '{color:#ff8a00!important}'; } },
    { id: 'inferno', n: '地獄烈焰', d: '暗紅色的碑文字，慢慢往上飄；爆擊冒出橘色火光、會閃。', price: 5000000, fam: 'inferno', css: function (s, c) {
      return s + '{font-family:"afkdmg-inferno",serif!important;color:#c81e1e!important;-webkit-text-stroke:1px #1a0000!important;text-shadow:0 0 4px #000,0 2px 3px #000!important;letter-spacing:1px}'
        + c + '{color:#ffb020!important;text-shadow:0 0 6px #ff4d00,0 0 12px #ff2200,0 2px 2px #000!important;animation:dmgfFlicker .18s steps(2) 5}'; } },
    { id: 'stellar', n: '恆星', d: '白色襯線字罩著紫色光暈，旁邊閃著星光；爆擊光暈更亮。', price: 5000000, fam: 'stellar', css: function (s, c) {
      return s + '{font-family:"afkdmg-stellar",serif!important;color:#fff!important;-webkit-text-stroke:0!important;text-shadow:0 0 3px #fff,0 0 8px #c084fc,0 0 14px #7c3aed,0 2px 2px #2e1065!important}'
        + s + '::before,' + s + '::after{content:"✦";position:absolute;font-family:sans-serif;color:#fff;-webkit-text-fill-color:#fff;text-shadow:0 0 6px #e9d5ff;pointer-events:none;animation:dmgfTwinkle .5s ease-in-out infinite alternate}'
        + s + '::before{left:-6px;top:-8px;font-size:.45em}' + s + '::after{right:-8px;bottom:-4px;font-size:.38em;animation-delay:.25s}'
        + c + '{text-shadow:0 0 4px #fff,0 0 12px #e879f9,0 0 22px #9333ea!important}'; } },
    { id: 'nova', n: '新星世界', d: '粉紅到淡紫藍的漸層圓體字，白色描邊發光。', price: 5000000, fam: 'nova', css: function (s, c) {
      return s + '{font-family:"afkdmg-nova",sans-serif!important;' + GRAD('linear-gradient(170deg,#ff5fd2 10%,#d18bff 50%,#9cc8ff 90%)') + '-webkit-text-stroke:1.5px #fff!important;text-shadow:none!important;filter:drop-shadow(0 0 3px #f0abfc) drop-shadow(0 1px 1px #4c1d95)}'
        + c + '{' + GRAD('linear-gradient(170deg,#ff2fc1,#b26bff 50%,#6fb2ff)') + 'filter:drop-shadow(0 0 5px #fff)}' + TAG('nova', '#fff0fb'); } },
    { id: 'starry', n: '繁星', d: '紫藍漸層的粗字，數字用中文單位（1億 2345萬），旁邊閃著金色星光。', price: 5000000, fam: 'starry', zh: true, css: function (s, c) {
      return s + '{font-family:"afkdmg-starry",sans-serif!important;' + GRAD('linear-gradient(100deg,#4338ca,#7c3aed 35%,#d946ef 65%,#3b82f6)') + '-webkit-text-stroke:1.5px #fff!important;text-shadow:none!important;filter:drop-shadow(0 0 2px #c4b5fd) drop-shadow(0 2px 1px #1e1b4b)}'
        + s + '::before,' + s + '::after{content:"✦";position:absolute;font-family:sans-serif;color:#fde68a;-webkit-text-fill-color:#fde68a;-webkit-text-stroke:0;pointer-events:none;animation:dmgfTwinkle .45s ease-in-out infinite alternate}'
        + s + '::before{left:-4px;top:-6px;font-size:.5em}' + s + '::after{right:-6px;top:30%;font-size:.4em;animation-delay:.2s}'
        + c + '{' + GRAD('linear-gradient(100deg,#6d28d9,#c026d3 45%,#2563eb)') + '}' + TAG('starry', '#fde68a'); } },
    { id: 'rainbow', n: '泡泡彩虹', d: '粉嫩的彩虹漸層圓體字，像肥皂泡一樣閃著流光；數字用中文單位（1億 2345萬）。', price: 5000000, fam: 'nova', zh: true, css: function (s, c) {
      return s + '{font-family:"afkdmg-nova",sans-serif!important;' + GRAD('linear-gradient(100deg,#ffb3d9,#fff3a8 20%,#b8ffd9 40%,#a8e8ff 60%,#d9b8ff 80%,#ffb3d9)') + 'background-size:200% 100%!important;-webkit-text-stroke:1.5px rgba(255,255,255,.95)!important;text-shadow:none!important;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px #e9d5ff) drop-shadow(0 1px 1px #6b21a8);animation-name:dmgfPop!important}'
        + s + '::before{content:"✦";position:absolute;left:-10px;top:-4px;font-size:.55em;font-family:sans-serif;color:#fff;-webkit-text-fill-color:#fff;-webkit-text-stroke:0;text-shadow:0 0 6px #fbcfe8;pointer-events:none;animation:dmgfTwinkle .4s ease-in-out infinite alternate}'
        + c + '{' + GRAD('linear-gradient(100deg,#ff8fc8,#ffe96b 20%,#7dffbf 40%,#7fd8ff 60%,#c49bff 80%,#ff8fc8)') + 'background-size:200% 100%!important;animation:dmgfShimmer 1s linear infinite}'
        + TAG('rainbow', '#fff0fb'); } }
  ];
  var FBY = {}; FONTS.forEach(function (f) { FBY[f.id] = f; });

  // ── 擁有／使用（全帳號共用：存在 localStorage，跟龍之鑽石一樣不分角色） ──
  var K_OWN = 'afk_dmgfont_own', K_USE = 'afk_dmgfont_use';
  function owned() { try { var a = JSON.parse(LS(K_OWN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function isOwned(id) { return owned().indexOf(id) >= 0; }
  function using() { var u = LS(K_USE) || ''; return FBY[u] && isOwned(u) ? u : ''; }
  function classic() { var p = P(); return !!(p && p.classicMode); }
  function apply() {
    var b = document.body; if (!b) return;
    FONTS.forEach(function (f) { b.classList.remove('dmgf-' + f.id); });
    var u = on() && !classic() ? using() : '';
    if (u) { css(); b.classList.add('dmgf-' + u); }
  }
  function diaReady() { return typeof W.pandoraGetSharedDiamonds === 'function' && typeof W.pandoraAdjustSharedDiamonds === 'function'; }
  function dia() { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } }
  function buy(id) {
    var f = FBY[id]; if (!f) return '沒有這款字體。';
    if (isOwned(id)) return '你已經有這款了。';
    if (!diaReady()) return '龍之鑽石帳戶還沒準備好，稍後再試。';
    if (dia() < f.price) return '龍之鑽石不夠（要 ' + fmt(f.price) + ' 顆）。';
    var r = null; try { r = W.pandoraAdjustSharedDiamonds(-f.price) || {}; } catch (e) { r = {}; }
    if (!r.ok) return '扣款失敗，沒有買成。';
    var a = owned(); a.push(id); LS(K_OWN, JSON.stringify(a));
    LS(K_USE, id); apply();
    return '';
  }

  // ── 樣式 ──
  function css() {
    if (el('afk-dmgfont-css')) return;
    var s = document.createElement('style'); s.id = 'afk-dmgfont-css';
    var t = FONTS.map(function (f) { return '@font-face{font-family:"afkdmg-' + f.fam + '";src:url("' + DIR + f.fam + '.woff2?v=1") format("woff2");font-display:swap}'; }).join('');
    t += '@keyframes dmgfPop{0%{transform:translate(-50%,-50%) scale(.35);opacity:0}14%{transform:translate(-50%,-55%) scale(1.25);opacity:1}28%{transform:translate(-50%,-55%) scale(1)}100%{transform:translate(-50%,-180%) scale(1);opacity:0}}'
      + '@keyframes dmgfRise{0%{transform:translate(-50%,-50%);opacity:1}75%{opacity:1}100%{transform:translate(-50%,-200%);opacity:0}}'
      + '@keyframes dmgfDrop{0%{transform:translate(-50%,-150%);opacity:0}18%{transform:translate(-50%,-50%);opacity:1}30%{transform:translate(-50%,-80%)}42%{transform:translate(-50%,-50%)}52%{transform:translate(-50%,-62%)}62%{transform:translate(-50%,-50%)}85%{opacity:1}100%{transform:translate(-50%,-50%);opacity:0}}'
      + '@keyframes dmgfDrift{0%{transform:translate(-50%,-50%);opacity:1}70%{opacity:1}100%{transform:translate(-20%,-190%);opacity:0}}'
      + '@keyframes dmgfBurst{0%{transform:translate(-50%,-50%) scale(2.2);opacity:.2}12%{transform:translate(-50%,-50%) scale(1);opacity:1}70%{opacity:1}100%{transform:translate(-30%,-170%) scale(1);opacity:0}}'
      + '@keyframes dmgfShake{0%,100%{transform:none}25%{transform:translateX(-3px) rotate(-4deg)}75%{transform:translateX(3px) rotate(4deg)}}'
      + '@keyframes dmgfFlicker{50%{opacity:.55}}@keyframes dmgfShimmer{from{background-position:0 0}to{background-position:200% 0}}'
      + '@keyframes dmgfTwinkle{from{opacity:.25;transform:scale(.6)}to{opacity:1;transform:scale(1.15)}}'
      + '@media (prefers-reduced-motion:reduce){[class*="dmgf-"] .vfx-dmg::before,[class*="dmgf-"] .vfx-dmg::after{animation:none!important}}'
      // 預覽：不飄、不消失
      + '.dmgf-pv{position:relative;height:64px;border-radius:8px;background:linear-gradient(#1e3a5f,#0f172a);display:flex;align-items:center;justify-content:center;gap:22px;overflow:hidden}'
      + '.dmgf-pv .vfx-dmg{position:relative!important;left:auto!important;top:auto!important;transform:none!important;animation:none!important;opacity:1!important}'
      + '.dmgf-pv .vfx-dmg.vfx-crit .vfx-dmg-value{animation:none!important}'
      + '.dmgf-shop{padding:4px 2px;display:flex;flex-direction:column;gap:8px}'
      + '.dmgf-card{border:1px solid #6b21a8;border-radius:10px;background:#0f0a1acc;padding:8px}'
      + '.dmgf-card.on{border-color:#facc15;box-shadow:0 0 0 1px #facc15}'
      + '.dmgf-row{display:flex;align-items:center;gap:8px;margin-top:6px}.dmgf-row .nm{flex:1;min-width:0}.dmgf-row .nm b{color:#f5d0fe;font-size:15px}.dmgf-row .nm span{display:block;font-size:12px;color:#cbd5e1;line-height:1.4}'
      + '.dmgf-row button{min-width:84px;min-height:36px;border-radius:7px;border:1px solid #a855f7;background:#581c87;color:#fdf4ff;font-weight:800;cursor:pointer;padding:0 8px}'
      + '.dmgf-row button.use{background:#14532d;border-color:#22c55e}.dmgf-row button[disabled]{opacity:.45;cursor:not-allowed}'
      + '.dmgf-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#e9d5ff}.dmgf-msg{min-height:18px;font-size:12.5px;color:#fde68a}'
      + '.afk-pd-tabs{display:flex;gap:6px;justify-content:center;margin:4px 0 6px;flex-shrink:0}.afk-pd-tabs button{padding:6px 14px;border-radius:6px;border:1px solid #6b21a8;background:#1e1b2e;color:#d8b4fe;font-weight:700;font-size:14px}'
      + '.afk-bd-tabs button[aria-pressed="true"]{background:#7e22ce;color:#fff;border-color:#c084fc}';
    FONTS.forEach(function (f) { t += f.css(SEL(f.id), CRIT(f.id)); });
    s.textContent = t; document.head.appendChild(s);
  }

  // ── 繁星：中文單位 ──
  function zhNum(n) {
    n = Math.floor(Number(n) || 0);
    if (n >= 1e8) { var a = Math.floor(n / 1e8), b = Math.floor((n % 1e8) / 1e4); return a + '億' + (b ? ' ' + b + '萬' : ''); }
    if (n >= 1e4) { var c = Math.floor(n / 1e4), d = n % 1e4; return c + '萬' + (d ? ' ' + d : ''); }
    return String(n);
  }
  function hookNumber() {
    if (typeof W._vfxNumber !== 'function' || W._vfxNumber._afkDmgf) return typeof W._vfxNumber === 'function';
    var o = W._vfxNumber;
    var nw = function (x, y, dmg, ele, big) {
      var r = o.apply(this, arguments);
      try {
        var cu = using(), u = !!(cu && FBY[cu].zh && document.body.classList.contains('dmgf-' + cu));   // 用中文單位的字體（繁星、泡泡彩虹）
        if (u && ele !== 'miss' && typeof dmg === 'number' && dmg >= 1e4) {
          var L = el('vfx-layer'), n = L && L.lastElementChild;
          if (n && n.classList.contains('vfx-dmg')) { var v = n.querySelector('.vfx-dmg-value'); (v || n).textContent = zhNum(dmg); }
        }
      } catch (e) {}
      return r;
    };
    nw._afkDmgf = true;
    W._vfxNumber = nw;
    try { (0, eval)('_vfxNumber = window._vfxNumber'); } catch (e) {}
    return true;
  }

  // ── 黑市分頁（跟 afk-blooddia 的「商品／血龍鑽兌換」同一排；沒有那排就自己放一排） ──
  var tab = 'market', msg = '';
  function pv(id, extra) {
    var c = id ? ' dmgf-' + id : '';
    var zh = id && FBY[id] && FBY[id].zh, big = zh ? '1億 2345萬' : '123456', nrm = zh ? '2萬 3456' : '23456';
    return '<div class="dmgf-pv' + c + '"' + (extra || '') + '><div class="vfx-dmg" style="font-size:20px;color:#f1f5f9">' + nrm + '</div><div class="vfx-dmg vfx-crit vfx-critical" style="font-size:32px;color:#ff3b30"><span class="vfx-dmg-tag">爆擊</span><span class="vfx-dmg-value">' + big + '</span></div></div>';
  }
  function shopHtml() {
    var u = using();
    var h = '<div class="dmgf-shop"><div class="dmgf-top"><span>🔤 字體販賣所・只換你打出去的傷害數字</span><span>💎 ' + (diaReady() ? fmt(dia()) : '—') + '</span></div>';
    h += '<div class="dmgf-msg" id="dmgf-msg">' + esc(msg) + '</div>';
    h += '<div class="dmgf-card' + (u ? '' : ' on') + '">' + pv('') + '<div class="dmgf-row"><div class="nm"><b>經典</b><span>遊戲原本的傷害字體，永遠免費。</span></div><button type="button" class="use" data-dmgf="use:"' + (u ? '' : ' disabled') + '>' + (u ? '換回' : '使用中') + '</button></div></div>';
    FONTS.forEach(function (f) {
      var own = isOwned(f.id), cur = u === f.id;
      h += '<div class="dmgf-card' + (cur ? ' on' : '') + '">' + pv(f.id) + '<div class="dmgf-row"><div class="nm"><b>' + esc(f.n) + '</b><span>' + esc(f.d) + '</span></div>'
        + (own ? '<button type="button" class="use" data-dmgf="use:' + f.id + '"' + (cur ? ' disabled' : '') + '>' + (cur ? '使用中' : '使用') + '</button>'
          : '<button type="button" data-dmgf="buy:' + f.id + '"' + (diaReady() && dia() >= f.price ? '' : ' disabled') + '>💎 ' + fmt(f.price) + '</button>') + '</div></div>';
    });
    return h + '<div class="gh-sm" style="font-size:11.5px;color:#94a3b8">買一次全帳號共用（所有角色都能用）。「未命中」維持原樣。</div></div>';
  }
  function decorate(div) {
    if (!div || !on() || classic()) return;
    var panel = div.querySelector('.pandora-market-panel'); if (!panel) return;
    css();
    var title = panel.querySelector('.pandora-market-title');
    var tabs = panel.querySelector('.afk-bd-tabs');
    if (!tabs) {
      tabs = document.createElement('div'); tabs.className = 'afk-bd-tabs afk-pd-tabs'; tabs.setAttribute('role', 'tablist');
      tabs.innerHTML = '<button type="button" role="tab" data-pdt="market" aria-pressed="' + (tab === 'market') + '">商品</button>';
      if (title && title.nextSibling) panel.insertBefore(tabs, title.nextSibling); else panel.insertBefore(tabs, panel.firstChild);
    }
    var bx = document.createElement('button'); bx.type = 'button'; bx.setAttribute('role', 'tab'); bx.setAttribute('data-pdt', 'trade'); bx.textContent = '交易所';
    tabs.appendChild(bx);
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-pdt', 'font'); b.textContent = '字體販賣所';
    tabs.appendChild(b);
    tabs.addEventListener('click', function (ev) {   // 按到血龍鑽那邊的分頁 → 我們退回「不是字體頁」
      var t = ev.target.closest('[data-bdtab],[data-pdt]'); if (!t) return;
      if (t.hasAttribute('data-bdtab')) { tab = 'market'; return; }
      ev.stopPropagation(); tab = t.getAttribute('data-pdt'); msg = ''; rerender(div);
    }, true);
    if (tab === 'trade') {   // 交易所：先開分頁，內容之後補（玩家寄賣交易，見設計稿 trade-design）
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === bx)); });
      Array.prototype.forEach.call(panel.children, function (c) { if (c !== title && c !== tabs) c.style.display = 'none'; });
      var tb = document.createElement('div'); tb.className = 'dmgf-shop';
      tb.innerHTML = '<div class="dmgf-card" style="text-align:center;padding:22px 10px"><div style="font-size:30px">🏮</div><b style="color:#f5d0fe;font-size:16px">交易所準備中</b><div style="font-size:12.5px;color:#cbd5e1;margin-top:6px;line-height:1.6">之後可以在這裡跟其他冒險者買賣裝備、遺物、卡片。<br>開放時會在世界頻道公告。</div></div>';
      panel.appendChild(tb);
      bx.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-pressed', 'false');
    } else if (tab === 'font') {
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      Array.prototype.forEach.call(panel.children, function (c) { if (c !== title && c !== tabs) c.style.display = 'none'; });
      var box = document.createElement('div'); box.innerHTML = shopHtml(); var pg = box.firstChild; panel.appendChild(pg);
      pg.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-dmgf]'); if (!t || t.disabled) return;
        var a = t.getAttribute('data-dmgf').split(':');
        if (a[0] === 'buy') {
          var f = FBY[a[1]];
          if (!t.hasAttribute('data-sure')) { t.setAttribute('data-sure', '1'); t.textContent = '確定購買？'; msg = '再按一次確定，花 ' + fmt(f.price) + ' 顆龍之鑽石買「' + f.n + '」。'; var m = el('dmgf-msg'); if (m) m.textContent = msg; return; }
          var e = buy(a[1]); msg = e || ('買好了「' + f.n + '」，已經換上。'); return rerender(div);
        }
        if (a[0] === 'use') { LS(K_USE, a[1] || ''); apply(); msg = a[1] ? '換上「' + FBY[a[1]].n + '」。' : '換回經典字體。'; rerender(div); }
      });
    } else { b.setAttribute('aria-pressed', 'false'); bx.setAttribute('aria-pressed', 'false'); }
  }
  function rerender(div) { try { W.pandoraRenderMarket(div); } catch (e) { console.warn('[AFK-dmgfont]', e); } }
  function hookMarket() {
    if (typeof W.pandoraRenderMarket !== 'function') return false;
    if (W.pandoraRenderMarket._afkDmgf) return true;
    var o = W.pandoraRenderMarket;
    var nw = function (div) { var r = o.apply(this, arguments); try { decorate(div); } catch (e) { console.warn('[AFK-dmgfont] 黑市分頁', e); } return r; };
    nw._afkDmgf = true;
    W.pandoraRenderMarket = nw;
    try { (0, eval)('pandoraRenderMarket = window.pandoraRenderMarket'); } catch (e) {}
    return true;
  }

  W.__afkDmgFont = { FONTS: FONTS, owned: owned, using: using, buy: buy, apply: apply, zhNum: zhNum, on: on };
  if (!on()) return;
  var tries = 0;
  (function boot() {
    var a = hookNumber(), b = hookMarket();
    if (a && b) return;
    if (++tries < 40) setTimeout(boot, 500);
  })();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  if (typeof W.loadGame === 'function' && !W.loadGame._afkDmgf) {
    var oLoad = W.loadGame;
    W.loadGame = function () { var r = oLoad.apply(this, arguments); setTimeout(function () { try { apply(); } catch (e) {} }, 300); return r; };
    W.loadGame._afkDmgf = true;
  }
  setInterval(function () { try { var b = document.body, u = using(); if (u && !classic() && !b.classList.contains('dmgf-' + u)) apply(); } catch (e) {} }, 5000);
  console.log('[AFK-dmgfont] 已啟用：傷害字體 ' + FONTS.length + ' 款');
})();
