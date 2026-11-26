'use strict';
window.LineagePlayMode = (() => {
  const current = document.documentElement.dataset.playMode;
  const picker = document.getElementById('play-mode');
  const preference = 'giran.playMode';
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
  let preferred = current;
  try {
    const saved = localStorage.getItem(preference);
    if (Object.hasOwn(entries, saved)) preferred = saved;
  } catch {}
  picker.value = preferred;

  function start() {
    const mode = picker.value;
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
    document.addEventListener('DOMContentLoaded', openLoadSelect, {once:true});
  }
  return {start};
})();
