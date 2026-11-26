'use strict';
(() => {
  const {mobs, nativeMobs, nativeFallback, floors, retiredItems} = GiranAtlasData;
  const rabbitHat = DB.items[GiranAtlasData.itemIds[20344]];
  if (rabbitHat) rabbitHat.ttmiEquipPoly = '胡蘿蔔曼波兔';
  const retired = new Set(retiredItems);
  const isRetired = id => retired.has(id);
  const isRetiredNumber = number => retired.has('giran_item_' + number) || retired.has('giran_forge_' + number);

  // Preserve the complete old item, including its UID and enhancement, outside playable inventory.
  function archiveActor(actor) {
    if (!actor) return false;
    let changed = false;
    function keep(item, slot) {
      (actor.giranRetiredItems ||= []).push({slot, item});
      changed = true;
    }
    if (Array.isArray(actor.inv) && actor.inv.some(item => isRetired(item?.id))) {
      actor.inv = actor.inv.filter(item => {
        if (!isRetired(item?.id)) return true;
        keep(item, 'inv');
        return false;
      });
    }
    for (const [slot,item] of Object.entries(actor.eq || {})) {
      if (isRetired(item?.id)) {
        keep(item, slot);
        actor.eq[slot] = null;
      }
    }
    delete actor.giranExperience;
    return changed;
  }

  function mobKey(id) {
    const native = nativeMobs[id];
    if (native && native[1]) return native[1];
    return mobs[id] || nativeFallback[id] ? 'giran_mob_' + id : null;
  }
  function monsterName(id) {
    return nativeMobs[id]?.[0] || mobs[id]?.name;
  }
  for (const [id, data] of Object.entries({...mobs,...nativeFallback})) {
    const base = DB.mobs[data.template];
    const average = Math.max(1, Math.floor(data.lv * .9));
    const mob = {
      n:data.name, lv:data.lv, hp:Math.max(1,data.hp), ac:data.ac, mr:data.mr, dr:data.dr,
      exp:Math.max(0,data.exp), goldMin:data.gold[0], goldMax:data.gold[1],
      s:data.large?'L':'S', race:base?.race || '一般', e:base?.e || 'none',
      dmg:base?.dmg || [1,average], db:base?.db || 0, hit:base?.hit || 0, atkSpd:base?.atkSpd || 2,
      beh:data.aggro?'主動':'被動', un:data.undead, _giranGeneralLoot:true
    };
    const art = GiranBossArt.ids[id];
    if (art) mob._giranArt = art;
    DB.mobs['giran_mob_' + id] = mob;
    if (!MOB_ANIM_NAMES.has(data.name)) {
      MOB_ANIM_NAMES.add(data.name);
      if (art || data.skin && data.skin !== data.name) MOB_ANIM_ALIAS[data.name] = art || data.skin;
      const frames = ANIM_MANIFEST['assets/anim/' + data.skin];
      if (art || frames?.['d6/idle_']) MOB_ANIM_8DIR.add(data.name);
      if (frames?.idle_s_) MOB_ANIM_SPRITE_SHADOW.add(data.name);
      if (frames?.idle_w_) MOB_ANIM_WEAPON_FX.add(data.name);
    }
  }

  // Keep map source IDs for coordinates but give combat and drops the actual Dimension monster key.
  const entries = [];
  for (const [key,[name,ids]] of Object.entries(floors)) {
    DB.maps[key] = [...new Set(ids.map(mobKey).filter(Boolean))];
    entries.push({v:key, t:name, giranFloor:true});
  }
  if (window.document?.documentElement.dataset.playMode==='dimension') {
    for (const [key,ids] of Object.entries(GiranAtlasData.fixedFallbackEncounters)) {
      const pool=DB.maps[key];
      if (pool) for (const id of ids) {
        const mob=mobKey(id);
        if (mob && !pool.includes(mob)) pool.push(mob);
      }
    }
  }
  MAP_CATEGORIES.dungeon.push(...entries);
  MAP_REGIONS.push({key:'giran_floors',label:'地界',maps:entries});
  window.GiranAtlas = {mobKey, monsterName, archiveActor, isRetired, isRetiredNumber};
})();
