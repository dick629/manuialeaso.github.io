/* Derive metadata from the exact characters and shared stores being sent. */
(function (root) {
  'use strict';
  function shortId(value) {
    const text=String(value);
    return encodeURIComponent(JSON.stringify(text).slice(1,-1)).length<=40 ? text : root.LineageIdentityDigest(text).slice(0,40);
  }
  function summary(bundle, singleRole) {
    const bridge=root.LineageSaveBridge, keys=bundle?.keys || {};
    const chars=[], seen=new Set(), duplicates=new Set(), high=new Set();
    const slots=new Set(), allyCopies=new Map(), shared=new Map();
    const ac={quarantine:0,sealed:0};
    function item(it) {
      if (!it || typeof it!=='object') return;
      const def=typeof DB!=='undefined' && DB.items[it.id] || (root.LineageCurrentProfile && bridge.itemDefinition(root.LineageCurrentProfile,String(it.id)));
      const flags=root.LineageItemAudit.item(it,def);
      if(flags.sealed) ac.sealed++;
      if(it.uid==null || it.uid==='') return;
      const id=shortId(it.uid);
      if(seen.has(id) && duplicates.size<20) duplicates.add(id);
      seen.add(id);
      if(flags.high && high.size<100) high.add(id);
    }
    function equipment(actor) {
      Object.values(actor?.eq||{}).forEach(item);
      const mio=actor?.afkMio;
      for(const [slot,rank] of Object.entries(mio?.cards||{}))
        if(Number(rank)>=6 && !root.LineageItemAudit.validStamp(mio.acg?.[slot])) ac.sealed++;
    }
    function role(data,slot) {
      const p=data?.p;
      if(!p?.cls) return;
      const id=shortId(String(p.enSeed??('slot-'+slot))+':'+p.cls);
      chars.push({id,play:Number(p.afkPlay?.ms)||0,lv:Number(p.lv)||0});
      ac.quarantine+=Array.isArray(p.afkAc?.q)?p.afkAc.q.length:0;
      (p.inv||[]).forEach(item);
      equipment(p);
      if(singleRole) return;
      for(const ally of p.allies||[]) {
        if(!ally) continue;
        if(ally._slot==null) equipment(ally);
        else allyCopies.set(String(ally._slot),ally);
      }
      const suffix=p.classicMode?'_classic':'';
      if(data.wh?.items) shared.set('lineage_idle_warehouse'+suffix,data.wh);
      if(Array.isArray(data.pets)) shared.set('fb5_pet_roster'+suffix,data.pets);
    }
    function decoded(raw,key) {
      try {return bridge.decode(raw).value;}
      catch {root.GiranDiagnostics?.record('存檔摘要','無法讀取 '+key);return null;}
    }
    if(singleRole) role(singleRole,'guest');
    else {
      for(const key of bridge.roleKeys(keys)) {
        if(key==='lineage_idle_save' && keys.lineage_idle_save_1) continue;
        const slot=key.split('_')[3]||'1', data=decoded(keys[key],key);
        if(data?.p) {slots.add(slot);role(data,slot);}
      }
      for(const [slot,ally] of allyCopies) if(!slots.has(slot)) equipment(ally);
      for(const key of Object.keys(keys)) {
        if(!/^(?:lineage_idle_warehouse|fb5_pet_roster)(?:_classic|_tradonly|_trad)?$/.test(key)) continue;
        const data=decoded(keys[key],key);
        if(data) shared.set(key,data);
      }
      for(const [key,data] of shared) {
        if(key.startsWith('fb5_pet_roster') && Array.isArray(data)) data.forEach(equipment);
        else if(Array.isArray(data.items)) data.items.forEach(item);
      }
    }
    const value={v:1,chars:chars.slice(0,32),dup:[...duplicates],uids:[...high],ac};
    const encode=()=>encodeURIComponent(JSON.stringify(value));
    let header=encode();
    while(header.length>6000 && (value.uids.length||value.dup.length)) {
      (value.uids.length?value.uids:value.dup).pop();
      header=encode();
    }
    return header;
  }
  root.LineageSaveSummary=Object.freeze({bundle:pack=>summary(pack,null),role:data=>summary(null,data)});
})(window);
