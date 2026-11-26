'use strict';
window.GiranPartyView = (() => {
  const layout = matchMedia('(max-width: 820px), (max-width: 1024px) and (max-height: 520px) and (pointer: coarse)');
  const phonePreview = new URLSearchParams(location.search).get('display') === 'phone';
  const handset = navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent);
  let narrow = layout.matches;
  layout.addEventListener('change', event => {
    narrow = event.matches;
    window.dispatchEvent(new Event('giran-party-layout'));
  });
  function mobile() {
    return handset || phonePreview || (narrow && (!window.AFK_TOGGLES || AFK_TOGGLES.enabled('mobile')));
  }
  const empty = [];
  let lastSource = null, lastDeployed = empty;

  function allyCap(leader) {
    return Number(leader?.rebirth) >= 1 ? 15 : 7;
  }
  function combatCap(leader) {
    return mobile() ? 7 : allyCap(leader);
  }

  // Keep the complete saved roster. Only the occupied front slots take part in combat.
  function combatAllies(leader = player) {
    const roster = leader?.allies || empty;
    const cap = combatCap(leader);
    if (roster.length <= cap) return roster;
    // Recruitment can edit the array in place. Compare the first occupied slots
    // so a promotion takes effect immediately, without allocating on every combat hook.
    let count = 0, same = roster === lastSource;
    for (const ally of roster) {
      if (!ally) continue;
      if (lastDeployed[count++] !== ally) same = false;
      if (count === cap) break;
    }
    if (!same || count !== lastDeployed.length) {
      lastSource = roster;
      lastDeployed = roster.filter(Boolean).slice(0, cap);
    }
    return lastDeployed;
  }
  function visibleAllies() {
    return (player?.allies || empty).filter(Boolean).slice(0, (mobile() ? 4 : 8) - 1);
  }
  function within(who, limit, leader) {
    if (!who || who === leader) return true;
    let rank = 1;
    for (const ally of leader?.allies || empty) {
      if (!ally) continue;
      if (ally === who) return rank < limit;
      rank++;
    }
    return true; // Pets, summons and monsters have their own field rules.
  }
  return {
    phonePreview, mobile, allyCap,
    get limit() { return mobile() ? 4 : 8; },
    get combatLimit() { return combatCap(player) + 1; },
    visibleAllies, combatAllies,
    shows(who) { return within(who, mobile() ? 4 : 8, player); },
    canFight(who, leader = player) {
      return !who || who === leader || (who._slot == null && !who.cls) || within(who, combatCap(leader) + 1, leader);
    }
  };
})();
