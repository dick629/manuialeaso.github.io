(() => {
'use strict';
// Change the spawned practice opponent itself, before its first combat tick.
// Monster templates, damage rolls and kill rewards stay with the game.
function trainingHealth(available) {
  let enabled = false;
  let requested = false;
  const originals = new WeakMap();

  function apply(mob) {
    if (enabled && !available()) return;
    if (!mob || mob._dead || mob.curHp <= 0 || mob.boss || mob._pvpAvatar) return;
    if (!originals.has(mob)) {
      if (!enabled || mapState.current !== 'training') return;
      originals.set(mob, mob.hp);
    }
    const base = originals.get(mob);
    if (enabled && mob.hp !== base) return;
    let hp = base;
    if (enabled) {
      const party = [player, ...(player.allies || [])].filter(who => who && !who._downed);
      let damagePerSecond = 0;
      for (const who of party) {
        const stats = who.d || {};
        const hit = Math.max(4, stats.meleeDmg || 0, stats.rangedDmg || 0, stats.magicDmg || 0) + 5;
        // High-level builds add class, equipment and relic bursts to these base stats.
        const lateGame = 1 + Math.max(0, (who.lv || 1) - 20) / 5;
        damagePerSecond += hit * lateGame / Math.max(0.08, stats.aspd || 1);
      }
      // Coordinated party bursts can combine several attacks and spells on one tick.
      const reserve = 20 + 5 * Math.max(0, party.length - 1);
      hp = Math.max(base * 16, Math.ceil(damagePerSecond * reserve));
    }
    const remaining = mob.curHp / mob.hp;
    mob.hp = hp;
    mob.curHp = Math.max(1, Math.min(hp, Math.round(hp * remaining)));
    if (!enabled) originals.delete(mob);
  }

  const spawn = window.spawnMob;
  if (typeof spawn === 'function') {
    window.spawnMob = function(index) {
      const result = spawn.apply(this, arguments);
      if (enabled && mapState.current === 'training') apply(mapState.mobs[index]);
      return result;
    };
  }
  // Instant death bypasses HP entirely. Let it finish a practice target only in
  // the last tenth of its bar; the original effect still resolves the execution.
  const execute=window.tryInstakill;
  if (typeof execute==='function') {
    window.tryInstakill=function(mob) {
      if (enabled && available() && mapState.current==='training' && originals.has(mob) && mob.curHp>mob.hp*0.1) return false;
      return execute.apply(this,arguments);
    };
  }
  function suspend() {
    if (!enabled) return;
    enabled = false;
    if (typeof mapState !== 'undefined') mapState.mobs.forEach(apply);
  }
  function resume() {
    if (enabled || !requested || !available()) return;
    enabled = true;
    mapState.mobs.forEach(apply);
  }
  return {
    get enabled() { return enabled; },
    apply, suspend, resume,
    reset() { requested = false; suspend(); },
    toggle() {
      requested = !requested;
      if (requested) resume(); else suspend();
      if (typeof renderMobs === 'function') renderMobs();
    },
  };
}

Object.assign(window.AFK_DIMENSION_VIEW, {trainingHealth});
})();
