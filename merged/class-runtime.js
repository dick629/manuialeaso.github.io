(function(W){
 'use strict';
 const C=W.LineageClassCore,KEY='lineage_character_souls_v1';let busy=false,failedBackup=null;
 const P=()=>typeof player==='undefined'?null:player;
 function vault(){const raw=localStorage.getItem(KEY);if(!raw)return C.freshVault();let v;try{v=JSON.parse(raw);}catch{}if(!C.validVault(v))throw Error('魂魄簿資料異常，請使用存檔與修復，沒有覆蓋原資料。');return v;}
 const identity=p=>C.sourceIdentity(p,_roleFingerprint(p));
 function legacyUsed(){const v=JSON.parse(localStorage.getItem('afk_evo_used_v1')||'[]');if(!Array.isArray(v))throw Error('舊制進化消耗紀錄異常，未封魂');return v;}
 function candidates(){const out=[],v=vault();for(let slot=1;slot<=(typeof SAVE_SLOT_MAX==='number'?SAVE_SLOT_MAX:16);slot++){if(slot===currentSlot)continue;const p=_roleReadSavePlayer(slot);if(!p||!!p.classicMode!==!!P()?.classicMode)continue;const id=identity(p);out.push({slot,name:p.name||'冒險者',cls:p.cls,level:p.lv,rebirth:p.rebirth||0,identity:id,sealed:!!v.sealed[id]||legacyUsed().includes(p.enSeed),employed:(P()?.allies||[]).some(a=>a&&Number(a._slot)===slot)});}return out;}
 function packed(doc){return 'LZ1:'+LZString.compressToUTF16(_saveWrap(JSON.stringify(doc)));}
 function change(changes,key,after){changes.push({key,before:localStorage.getItem(key),after,reason:'CLASS_PROGRESSION'});}
 function safe(){return !_roleOtherActiveSessions().length;}
 async function commit(label,prepare){
  const p=P(),slot=currentSlot;if(busy||!p?.cls||p.dead)throw Error('目前不能變更職業');if(!safe())throw Error('請先讓其他遊戲分頁回到首頁');
  if(!/^town_/.test(mapState.current||''))throw Error('請回村或席琳神殿再進行永久變更');
  const running=state.running;state.running=false;busy=true;
  try{const doc=JSON.parse(saveStateJson()),v=vault(),changes=[],prepared=prepare(C.copy(doc.p),C.copy(v),changes);
   if(prepared.player){if(!C.valid(prepared.player))throw Error('職業資料檢查失敗');doc.p=prepared.player;change(changes,'lineage_idle_save_'+slot,packed(doc));}
   if(prepared.vault){if(!C.validVault(prepared.vault))throw Error('魂魄資料檢查失敗');change(changes,KEY,JSON.stringify(prepared.vault));}
   // Cancel only queued representation changes for our keys. The immediate signed
   // raw save is already durable; an old compression reply must not race the backup.
   if(typeof _lzWorkerRev!=='undefined')for(const c of changes)_lzWorkerRev[c.key]=(_lzWorkerRev[c.key]||0)+1;
   const rec=await W.LineageRecovery.transact(localStorage,changes,s=>W.LineageBackups.save({...s,label},'class-progression'),{integrity:'class',canWrite:()=>P()===p&&currentSlot===slot&&safe()});
   if(prepared.player)p.classPath=prepared.player.classPath;
   if(typeof _petRosterKey!=='undefined')_petRosterKey=null;W.LineageClassCombat?.reset(p);calcStats();updateUI();return rec;
  }catch(e){failedBackup=e.backupId||null;throw e;}finally{busy=false;state.running=running;}
 }
 async function seal(slot){const entry=candidates().find(x=>x.slot===slot);if(!entry)throw Error('來源存檔已變更');if(entry.employed)throw Error('請先解除此角色的傭兵僱用');
  return commit('扎爾封存角色魂魄',(p,v,changes)=>{const source=_roleReadSavePlayer(slot);if(!source||identity(source)!==entry.identity)throw Error('來源存檔已變更');if(source.cls===p.cls&&identity(source)===identity(p))throw Error('不能消耗自己或自己的複本');
   for(let n=1;n<=(typeof SAVE_SLOT_MAX==='number'?SAVE_SLOT_MAX:16);n++){const role=n===currentSlot?p:_roleReadSavePlayer(n);if(role&&(role.allies||[]).some(a=>a&&Number(a._slot)===slot))throw Error('此角色仍在隊伍中，請先解除傭兵僱用');}
   if(typeof _mercLedgerOutbox!=='undefined'&&_mercLedgerOutbox.some(r=>r&&String(r.slot)===String(slot)))throw Error('來源角色尚有待結算傭兵經驗，請先登入該角色領取');
   if(typeof _mercLedgerRead==='function'&&_mercLedgerRead().some(r=>r&&!r.claimed&&String(r.slot)===String(slot)))throw Error('來源角色尚有待領傭兵經驗，請先登入該角色領取');
   const used=legacyUsed();if(source.enSeed&&used.includes(source.enSeed))throw Error('這個角色已被舊制進化消耗，不能再次封魂');if(source.enSeed)change(changes,'afk_evo_used_v1',JSON.stringify(used.concat(source.enSeed)));
   const souls=C.seal(v,source,{id:crypto.randomUUID(),identity:entry.identity,slot,at:Date.now()});
   if(typeof PET_ROSTER_KEY!=='undefined')for(const key of [PET_ROSTER_KEY,PET_ROSTER_KEY+'_classic']){
    const raw=_lzGet(key);if(!raw)continue;const u=_saveUnwrap(raw);if(!u?.ok)throw Error('寵物名冊驗證失敗，未封魂');const list=JSON.parse(u.payload);if(!Array.isArray(list))throw Error('寵物名冊格式不符');let changed=false;
    const owner=typeof _petOwnerKeyFor==='function'?_petOwnerKeyFor(source):null;
    for(const pet of list)if(pet&&(owner&&String(pet.outOwner||'')===owner||!pet.outOwner&&String(pet.outSlot)===String(slot))){pet.outOwner=null;pet.outSlot=null;pet.outV=typeof _petNowStamp==='function'?_petNowStamp():Date.now()*1024;changed=true;}
    if(changed)change(changes,key,'LZ1:'+LZString.compressToUTF16(_saveWrap(JSON.stringify(list))));
   }
   change(changes,'lineage_idle_save_'+slot,null);change(changes,'lineage_idle_save_'+slot+'_bak',null);
   const guardKey='fb5_deleted_role_guards_v1',guards=JSON.parse(localStorage.getItem(guardKey)||'{}');guards[_roleFingerprint(source)]=Date.now();change(changes,guardKey,JSON.stringify(guards));
   return {player:p,vault:souls};
  });
 }
 async function release(soulId){return commit('解除魂魄',(p,v)=>({vault:C.release(v,soulId)}))}
 async function advance(route,soul,ult,breach){return commit('職業進化／融合轉職',(p,v)=>C.advance(p,v,route,soul,ult,breach));}
 async function convert(route){return commit('舊制進化一次轉換',p=>({player:C.convert(p,route,W.__afkEvolve?.S[p.afkEvo?.school])}));}
 async function choose(id){return commit('永久選定大絕',p=>({player:C.chooseUltimate(p,id)}));}
 async function configure(id,kind){return commit('職業技能設定',p=>{if(!C.canUse(p,id))throw Error('尚未開放此技能');const s=C.skills.get(id);if(s.type==='被動')throw Error('被動常駐生效');const key=kind==='aura'?'auras':'auto';if(key==='auras'&&s.type!=='光環'||key==='auto'&&s.type==='光環')throw Error('技能類型不符');const list=p.classPath[key]||[];if(list.includes(id))p.classPath[key]=list.filter(x=>x!==id);else{if(list.length>=(key==='auras'?2:8))throw Error('自動技能最多八招，光環最多兩個');p.classPath[key]=list.concat(id);}return {player:p};});}
 const save=W.saveGame;W.saveGame=function(){if(busy)return false;return save.apply(this,arguments);};
 // Ordinary old evolution keeps working until its owner accepts the one-time migration.
 if(W.__afkEvolve)W.__afkEvolve.evolve=function(){W.LineageClassUI?.open('route');};
 W.LineageClasses={C,KEY,vault,candidates,identity,seal,release,advance,convert,choose,configure,commit,isBusy:()=>busy,failedBackup:()=>failedBackup};
})(window);
