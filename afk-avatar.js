/* ============================================================================
 * afk-avatar.js — 自訂角色頭像（玩家 2026-11-11 03:29）
 *
 *   電腦版點左上角的「職業」名稱、手機版點頭像圖片：選一張自己的圖片當角色頭像（電腦版左上角的角色圖、手機版上方的頭像都換）。
 *   圖片在本機裁成正方形、縮成 192×192 的 JPEG 存在角色存檔裡（約 10～20 KB），換裝置匯入存檔也會跟著走。
 *   可以隨時換掉或恢復預設。只換畫面上的頭像，跟職業動畫、戰鬥無關。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, SIZE = 192;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var ok = function (s) { return typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 200000; };
  var apply = function () {
    var p = P(), el = document.getElementById('status-panel'); if (!p || !el) return;
    if (ok(p.afkFace)) { var u = 'url("' + p.afkFace + '")'; if (el.style.backgroundImage !== u) el.style.backgroundImage = u; if (!el.classList.contains('afk-face')) el.classList.add('afk-face'); }
    else if (el.classList.contains('afk-face')) el.classList.remove('afk-face');
  };
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} };
  var pick = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 20 * 1024 * 1024) { alert('圖片太大（超過 20MB）。'); return; }
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        try {
          var s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = SIZE;
          var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.drawImage(img, (img.naturalWidth - s) / 2, Math.max(0, (img.naturalHeight - s) / 4), s, s, 0, 0, SIZE, SIZE);
          var d = c.toDataURL('image/jpeg', 0.85), p = P(); if (!p || !ok(d)) return;
          p.afkFace = d; apply(); save();
          try { logSys('<span class="text-amber-200">頭像已更換。</span>'); } catch (e) {}
        } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); alert('讀不到這張圖片，請換一張。'); };
      img.src = url;
    };
    inp.click();
  };
  var menu = function () {
    var p = P(); if (!p) return;
    var cur = ok(p.afkFace) ? p.afkFace : ((document.getElementById('lm-portrait') || {}).src || ('assets/character/' + (p.avatar || '') + '.webp'));
    var old = document.getElementById('afk-face-menu'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'afk-face-menu';
    m.innerHTML = '<div class="afk-face-box"><b>角色頭像</b><img src="' + cur + '" alt=""><button type="button" data-f="pick">' + (ok(p.afkFace) ? '換一張圖片' : '選一張圖片當頭像') + '</button>' + (ok(p.afkFace) ? '<button type="button" data-f="reset">恢復預設頭像</button>' : '') + '<button type="button" data-f="close">關閉</button></div>';
    m.addEventListener('click', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-f');
      if (e.target === m || k === 'close') { m.remove(); return; }
      if (k === 'pick') { m.remove(); pick(); }
      if (k === 'reset') { m.remove(); delete p.afkFace; try { updateUI(); } catch (x) {} apply(); save(); }
    });
    document.body.appendChild(m);
  };
  W.afkAvatarMenu = menu;
  var css = document.createElement('style');
  css.textContent = '.afk-face-btn{font-size:11px;line-height:1;padding:3px 6px;border-radius:5px;border:1px solid #a16207;background:rgba(66,32,6,.75);color:#fde68a;cursor:pointer;margin-left:6px;vertical-align:middle}'
    + '#status-panel.afk-face{background-size:cover!important;background-position:center top!important}'
    + '#afk-face-menu{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}'
    + '#afk-face-menu .afk-face-box{background:#1e1b16;border:1px solid #a16207;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px;align-items:center;min-width:220px;color:#f5e9d0}'
    + '#afk-face-menu img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:2px solid #a16207}'
    + '#afk-face-menu button{width:100%;padding:8px 12px;border-radius:6px;border:1px solid #a16207;background:#422006;color:#fde68a;font-weight:700}';
  document.head.appendChild(css);
  // 玩家 11-11：電腦版點「職業」名稱、手機版點頭像圖片 → 換頭像
  var bound = false;
  var addBtns = function () {
    var c = document.getElementById('st-classname');
    if (c && !c.__afkFace) { c.__afkFace = true; c.style.cursor = 'pointer'; c.title = '點這裡更換角色頭像'; c.addEventListener('click', function (e) { e.stopPropagation(); menu(); }); }
    var m = document.getElementById('lm-player');
    if (m && !m.__afkFace) { m.__afkFace = true; m.setAttribute('aria-label', '更換角色頭像'); m.addEventListener('click', function (e) { e.stopImmediatePropagation(); e.preventDefault(); menu(); }, true); }
  };
  // updateUI 會延後呼叫 _updateUIImpl 才畫頭像，所以兩個都包
  if (typeof W._updateUIImpl === 'function') {
    var oi = W._updateUIImpl;
    W._updateUIImpl = function () { var r = oi.apply(this, arguments); try { apply(); addBtns(); } catch (e) {} return r; };
    try { (0, eval)('_updateUIImpl = window._updateUIImpl'); } catch (e) {}
  }
  if (typeof W.updateUI === 'function') {
    var o = W.updateUI;
    W.updateUI = function () { var r = o.apply(this, arguments); try { apply(); addBtns(); } catch (e) {} return r; };
    try { (0, eval)('updateUI = window.updateUI'); } catch (e) {}
  }
  W.__afkAvatar = { apply: apply, pick: pick, menu: menu, ok: ok };
})();
