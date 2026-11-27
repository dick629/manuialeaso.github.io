'use strict';
window.LineagePlayMode = (() => {
  const current = document.documentElement.dataset.playMode;
  const picker = document.getElementById('play-mode');
  // 11-27 Ping：預設改成舊版次元（固定站位），自由走動要玩家自己選；換新鍵，讓上線頭幾個小時自動記下的「融合版」不再生效
  const preference = 'giran.playMode.v2';
  const entries = {fusion:'index.html', dimension:'dimension.html'};
  const url = new URL(location.href);
  const roomKey = 'giran.room.v1';
  if (!LineageSite.roomsEnabled) {
    try { sessionStorage.removeItem(roomKey); } catch {}
  }
  function hasRoom() {
    if (!LineageSite.roomsEnabled) return false;
    try { return !!JSON.parse(sessionStorage.getItem(roomKey))?.session?.token; }
    catch { return false; }
  }
  // The room client settles temporary party slots when the leader or guest leaves.
  if (current === 'dimension' && hasRoom()) {
    const room = new URL('index.html', location.href);
    room.search = url.search;
    room.searchParams.delete('selectCharacter');
    location.replace(room.href);
    return;
  }
  let preferred = 'dimension';
  try {
    const saved = localStorage.getItem(preference);
    if (Object.hasOwn(entries, saved)) preferred = saved;
  } catch {}
  // 11-27 Ping：自由走動暫停開放，只有帶測試口令的裝置能選。口令只存雜湊，開一次「網址#tester=口令」後記在這台裝置。
  const testerKey = 'giran.tester.v1', testerHash = 'c7ff2d65a1b82d566dd4fef8aebca877d3288f9cfcf8967a30b43feb6ff7bce9';
  const fusionOption = picker.querySelector('option[value="fusion"]');
  let tester = false, loaded = false;
  document.addEventListener('DOMContentLoaded', () => { loaded = true; }, {once:true});
  fusionOption.disabled = true;
  fusionOption.textContent = '融合版（自由走動）暫停開放';
  picker.value = 'dimension';
  function toDimension() {
    const target = new URL(entries.dimension, location.href);
    target.searchParams.set('selectCharacter', '1');
    location.replace(target.href);
  }
  const verified = (async () => {
    try {
      const given = /^#tester=(.+)$/.exec(location.hash);
      if (given) {
        localStorage.setItem(testerKey, decodeURIComponent(given[1]));
        url.hash = '';
        history.replaceState(history.state, '', location.pathname + location.search);
      }
      const phrase = localStorage.getItem(testerKey);
      if (!phrase) return false;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase));
      return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') === testerHash;
    } catch { return false; }
  })().then(ok => {
    tester = ok;
    if (ok) {
      fusionOption.disabled = false;
      fusionOption.textContent = '融合版（自由走動）';
      picker.value = url.searchParams.get('selectCharacter') === '1' ? current : preferred;
    }
    return ok;
  });
  window.addEventListener('hashchange', () => { if (/^#tester=/.test(location.hash)) location.reload(); });
  if (current === 'fusion') {
    for (const name of ['openLoadSelect', 'loadEnterSelected']) {
      const original = window[name];
      if (typeof original === 'function') window[name] = function () {
        if (!tester) { verified.then(ok => ok ? original.apply(this, arguments) : toDimension()); return; }
        return original.apply(this, arguments);
      };
    }
  }

  function start() {
    const mode = picker.value === 'fusion' && !tester ? 'dimension' : picker.value;
    if (!Object.hasOwn(entries, mode)) return;
    if (mode === 'dimension' && hasRoom()) {
      picker.value = current;
      alert('請先在多人會所離隊，完成隊員結算後即可切換舊版次元。');
      return;
    }
    try { localStorage.setItem(preference, mode); } catch {}
    if (mode === current) return openLoadSelect();
    const target = new URL(entries[mode], location.href);
    target.search = location.search;
    target.hash = location.hash;
    target.searchParams.set('selectCharacter', '1');
    location.assign(target.href);
  }

  if (url.searchParams.get('selectCharacter') === '1') {
    picker.value = current;
    url.searchParams.delete('selectCharacter');
    history.replaceState(history.state, '', url.href);
    const open = () => window.openLoadSelect();
    if (loaded) open(); else document.addEventListener('DOMContentLoaded', open, {once:true});
  }
  return {start};
})();
