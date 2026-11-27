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
    if (fusion) return FUSION_CAP;
    return mobile() ? 7 : allyCap(leader);
  }
  // 11-27 Ping：自由走動一次只上場隊長＋3 人，其餘留在隊上待命，玩家在「隊伍」自己選誰上場（player.giranDeploy＝上場的 _slot）。舊版次元不受影響。
  const fusion = document.documentElement.dataset.playMode === 'fusion';
  const FUSION_CAP = 3;
  let deployOwner = null, deploySig = '', deployList = empty;
  function deployed(leader) {
    const roster = leader?.allies || empty, pick = Array.isArray(leader?.giranDeploy) ? leader.giranDeploy : null;
    let sig = pick ? pick.join(',') : '-';
    for (const ally of roster) if (ally) sig += '|' + ally._slot;
    if (leader === deployOwner && sig === deploySig) return deployList;
    const live = roster.filter(Boolean);
    deployOwner = leader; deploySig = sig;
    deployList = (pick ? live.filter(a => pick.includes(String(a._slot))) : live).slice(0, FUSION_CAP);
    return deployList;
  }
  function setDeployed(slot, on) {
    if (!fusion || !player?.cls) return false;
    const now = deployed(player).map(a => String(a._slot)), key = String(slot);
    const next = on ? (now.includes(key) || now.length >= FUSION_CAP ? null : now.concat(key)) : now.filter(s => s !== key);
    if (!next) return false;
    player.giranDeploy = next;
    try { saveGame(); } catch (e) {}
    return true;
  }

  // Keep the complete saved roster. Only the occupied front slots take part in combat.
  function combatAllies(leader = player) {
    if (fusion) return deployed(leader);
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
    if (fusion) return deployed(player);
    return (player?.allies || empty).filter(Boolean).slice(0, (mobile() ? 4 : 8) - 1);
  }
  function within(who, limit, leader) {
    if (!who || who === leader) return true;
    if (fusion && leader?.allies?.includes(who)) return deployed(leader).includes(who);
    let rank = 1;
    for (const ally of leader?.allies || empty) {
      if (!ally) continue;
      if (ally === who) return rank < limit;
      rank++;
    }
    return true; // Pets, summons and monsters have their own field rules.
  }
  if (fusion) {
    // 隊伍分頁每張隊員卡加「上場／改為待命」。名單由原作重畫，這裡只在每次重畫後補按鈕。
    const style = document.createElement('style');
    style.textContent = '#squad-tab-team .ga-reserve{opacity:.55}#squad-tab-team [data-giran-deploy]{margin-left:4px}#squad-tab-team [data-giran-deploy]:disabled{opacity:.45;cursor:not-allowed}';
    document.head.append(style);
    const decorate = () => {
      const box = document.getElementById('squad-tab-team'); if (!box || typeof player === 'undefined') return;
      const on = deployed(player).map(a => String(a._slot)), full = on.length >= FUSION_CAP;
      for (const card of box.querySelectorAll('[data-squad-slot]')) {
        const slot = card.dataset.squadSlot, active = on.includes(slot);
        let b = card.querySelector('[data-giran-deploy]');
        if (!b) {
          b = document.createElement('button'); b.type = 'button'; b.dataset.giranDeploy = slot; b.className = 'ga-mini-action';
          (card.querySelector('[data-member-buffs]')?.parentElement || card).append(b);
        }
        const text = active ? '改為待命' : '上場';
        if (b.textContent !== text) b.textContent = text;
        b.disabled = !active && full;
        b.title = b.disabled ? '上場已滿 ' + (FUSION_CAP + 1) + ' 人，先讓一位改為待命' : '';
        card.classList.toggle('ga-reserve', !active);
      }
    };
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-giran-deploy]'); if (!b) return;
      e.stopPropagation(); e.preventDefault();
      const slot = b.dataset.giranDeploy, active = deployed(player).some(a => String(a._slot) === slot);
      if (setDeployed(slot, !active)) { decorate(); try { renderSquadPanel(); } catch (err) {} }
    }, true);
    const hook = () => {
      const original = window.renderSquadPanel;
      if (typeof original !== 'function' || original.__giranDeploy) return;
      const wrapped = function () { const r = original.apply(this, arguments); try { decorate(); } catch (err) {} return r; };
      wrapped.__giranDeploy = true; window.renderSquadPanel = wrapped;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook, { once: true }); else hook();
    window.addEventListener('load', hook);
  }
  return {
    phonePreview, mobile, allyCap, fusionCap: fusion ? FUSION_CAP : 0, deployed: () => deployed(player), setDeployed,
    get limit() { return fusion ? FUSION_CAP + 1 : mobile() ? 4 : 8; },
    get combatLimit() { return combatCap(player) + 1; },
    visibleAllies, combatAllies,
    shows(who) { return within(who, mobile() ? 4 : 8, player); },
    canFight(who, leader = player) {
      return !who || who === leader || (who._slot == null && !who.cls) || within(who, combatCap(leader) + 1, leader);
    }
  };
})();
