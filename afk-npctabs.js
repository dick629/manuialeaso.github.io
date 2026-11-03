/* ============================================================================
 * afk-npctabs.js — 多功能 NPC 分頁（玩家 2026-11-01 02:31：「有些 NPC 有多重功能，把每個功能切成分頁。
 *   例如甘特有王的劇情、又有主線劇情、又有職業劇情，分開頁面點選比較好區別」；外掛開關 npctabs，預設開）
 *
 * 做法：NPC 視窗（#interaction-content）畫完之後，認出各外掛接在後面的功能區塊，在最上面加一排分頁，一次只顯示一塊。
 *   ‧認得的區塊（RULES）：職業專屬劇情、各條劇情線（紅獅之誓、知識與背叛、闇龍的低語…）、克特的追殺令、闇龍的低語挑戰、
 *     轉生技藝、哈汀的時空、碎片熔鑄、遺物強化、變身收集冊、高階變身卡合成、聖衣光輝、變身卡冊。
 *   ‧沒被認出的內容（NPC 原本的功能，例如甘特的試煉）合成一頁，放在第一個分頁。
 *   ‧開場白（id 以 -intro 結尾、或沒有 id 的 .afk-ax 對話）固定在分頁上面，不切。
 *   ‧只有兩頁以上才加分頁；同一個 NPC 記住上次看的分頁（同一次遊戲期間）。
 *   ‧內容重畫（接任務、交付、製作後）會自動重新套用，停在原本的分頁。
 *   不改任何功能本身，只是藏起來／顯示出來。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'npctabs', name: 'NPC 多功能分頁', group: '遊戲介面', seal: true,
    desc: '同一個 NPC 有好幾種功能（試煉、劇情、職業劇情、挑戰、合成…）時分成分頁，一次只看一種' });
  if (T && !T.enabled('npctabs')) return;

  var loreName = function (el) {
    var t = el.querySelector('.alq-title'), s = String((t && t.textContent) || '').replace(/^\s*📜\s*/, '').replace(/^劇情/, '').replace(/[「」]/g, '').trim();
    return s || '劇情';
  };
  // [選擇器, 鍵, 標籤（字串或函式）]
  var RULES = [
    ['.afk-saga-sec', 'saga', '職業劇情'],
    ['.alq', 'lore', loreName],
    ['#afk-kurt-gunter', 'kurt', '克特的追殺令'],
    ['#afk-hp-panel', 'halpas', '闇龍挑戰'],
    ['#afk-arts-embed', 'arts', '轉生技藝'],
    ['#afk-rb-fix', 'rbfix', '轉生點數校正'],
    ['#afk-hd-joe', 'hardin', '哈汀的時空'],
    ['#afk-lost-panel', 'lost', '碎片熔鑄'],
    ['#rp-modal', 'relicplus', '遺物強化'],
    ['#afk-poly-codex', 'poly', '變身收集冊'],
    ['#afk-card-ascension-synth', 'synth', '高階變身卡合成'],
    ['#afk-cloth-panel', 'cloth', '聖衣光輝'],
    ['#afk-codex', 'codex', '變身卡冊']
  ];
  // NPC 本身的功能就是某個外掛區塊時（哈瑪大師＝遺物強化），那一頁排第一、預設打開
  var PRIMARY = { relicsmith: 'relicplus', rebirtharts: 'arts' };
  var TYPE_LABEL = { quest: '任務', craft: '製作', shop: '商店', relicsmith: '遺物', warehouse: '倉庫' };
  var current = { npc: null, type: null }, chosen = Object.create(null);

  var classify = function (el) {
    if (!el || el.nodeType !== 1 || el.id === 'afk-npctabs') return null;
    if (/-intro$/.test(el.id || '') || (el.classList.contains('afk-ax') && !el.id && el.querySelector && !el.querySelector('button,.alq'))) return { pin: true };
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (el.matches(r[0])) {
        var key = r[1] === 'lore' ? 'lore:' + (el.id || loreName(el)) : r[1];
        return { key: key, label: typeof r[2] === 'function' ? r[2](el) : r[2] };
      }
    }
    return null;
  };
  var coreLabel = function (els) {
    var txt = els.map(function (e) { return e.textContent || ''; }).join(' ').slice(0, 200);
    if (/試煉/.test(txt)) return '試煉';
    return TYPE_LABEL[current.type] || '主要功能';
  };

  var CSS_ID = 'afk-npctabs-css';
  var css = function () {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    var B = '#interaction-content #afk-npctabs button.nt';   // 遊戲的按鈕樣式選擇器比較強，提高權重並加 !important
    st.textContent = '#afk-npctabs{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:6px;padding:6px 2px 8px;margin-bottom:8px;'
      + 'background:linear-gradient(180deg,#25232a 85%,rgba(37,35,42,0));border-bottom:1px solid #594638}'
      + B + '{padding:6px 14px!important;font-size:15px!important;font-weight:700;border-radius:6px 6px 3px 3px!important;border:1px solid #5b4632!important;'
      + 'background:linear-gradient(180deg,#3a3238,#1d1a1f)!important;color:#a8936c!important;cursor:pointer;line-height:1.3;box-shadow:none!important}'
      + B + ':hover{border-color:#a67c52!important;color:#e7d2a7!important}'
      + B + '.on{background:linear-gradient(180deg,#8a5f32,#4a3220)!important;border-color:#e0ad62!important;color:#fff4d6!important;box-shadow:0 0 0 1px #e0ad62 inset,0 0 10px rgba(224,173,98,.45)!important}'
      + '@media (max-width:640px){' + B + '{padding:6px 10px!important;font-size:14px!important}}';
    document.head.appendChild(st);
  };

  var applying = false, obs = null, box = null;
  var show = function (el, on) {
    if (on) { if (el.getAttribute('data-afk-nthid')) { el.style.display = el.getAttribute('data-afk-ntdisp') === '-' ? '' : el.getAttribute('data-afk-ntdisp'); el.removeAttribute('data-afk-nthid'); el.removeAttribute('data-afk-ntdisp'); } }
    else if (!el.getAttribute('data-afk-nthid')) { el.setAttribute('data-afk-ntdisp', el.style.display || '-'); el.setAttribute('data-afk-nthid', '1'); el.style.display = 'none'; }
  };
  var apply = function () {
    var c = box || document.getElementById('interaction-content'); if (!c) return;
    applying = true; if (obs) obs.disconnect();
    try {
      var old = c.querySelector(':scope > #afk-npctabs'); if (old) old.remove();
      var kids = Array.prototype.slice.call(c.children), core = [], tabs = [], firstNonPin = null;
      kids.forEach(function (el) {
        var k = classify(el);
        if (k && k.pin) return;
        if (!firstNonPin) firstNonPin = el;
        if (k) tabs.push({ key: k.key, label: k.label, els: [el] });
        else core.push(el);
      });
      var coreHas = core.some(function (e) { return (e.textContent || '').trim() || e.querySelector('img,button,input'); });
      if (coreHas) tabs.unshift({ key: 'core', label: coreLabel(core), els: core });
      else { var pk = PRIMARY[current.type], pi = -1; tabs.forEach(function (t, i) { if (pi < 0 && t.key === pk) pi = i; }); if (pi > 0) tabs.unshift(tabs.splice(pi, 1)[0]); }
      if (tabs.length < 2) { kids.forEach(function (el) { show(el, true); }); return; }
      css();
      var want = chosen[current.npc] && tabs.some(function (t) { return t.key === chosen[current.npc]; }) ? chosen[current.npc] : tabs[0].key;
      tabs.forEach(function (t) { t.els.forEach(function (el) { show(el, t.key === want); }); });
      var bar = document.createElement('div'); bar.id = 'afk-npctabs';
      bar.innerHTML = tabs.map(function (t) { return '<button type="button" class="nt' + (t.key === want ? ' on' : '') + '" data-nt="' + String(t.key).replace(/"/g, '&quot;') + '">' + String(t.label).replace(/[&<>]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]; }) + '</button>'; }).join('');
      bar.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-nt]'); if (!b) return;
        chosen[current.npc] = b.getAttribute('data-nt');
        apply();
        try { c.scrollTop = 0; } catch (e) {}
      });
      c.insertBefore(bar, firstNonPin || c.firstChild);
    } catch (e) { console.warn('[AFK-npctabs]', e); }
    finally { applying = false; if (obs) obs.observe(c, { childList: true }); }
  };
  var queued = false;
  var schedule = function () { if (queued || applying) return; queued = true; Promise.resolve().then(function () { queued = false; apply(); }); };

  var init = function () {
    box = document.getElementById('interaction-content'); if (!box || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(function () { if (!applying) schedule(); });
    obs.observe(box, { childList: true });
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId, townId) {
      current.npc = npcId;
      try { var t = DB.towns[townId || (typeof mapState !== 'undefined' && mapState.current)]; var n = t && (t.npcs || []).find(function (x) { return x.id === npcId; }); current.type = n ? n.type : null; } catch (e) { current.type = null; }
      var r = oNpc.apply(this, arguments);
      schedule();
      return r;
    };
    try { (0, eval)('interactNPC = window.interactNPC'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  W.__afkNpcTabs = { apply: apply, chosen: chosen, current: current, RULES: RULES };
})();
