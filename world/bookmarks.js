'use strict';
window.GiranBookmarks=(()=>{
  const panel=document.getElementById('giran-bookmarks');
  let escaping=false,arrived=false,flight=null;
  function terrain(){return mapState.current.startsWith('town_')?GiranTown.terrain:GiranCombat.field?.terrain;}
  function acceptKey(key){
    if(typeof key!=='string'||/^pride_f\d/.test(key)||key==='rift_battle'||KING_ROOMS[key]||PURE_BOSS_MAPS.includes(key))return false;
    const castle=Object.values(SIEGE_CITY).find(c=>c.castle===key);
    if(castle)return GiranGates.allowed(key);
    const entry=mapEntryOf(key);
    return !!entry&&(!/^afk_|^siege_|^cr_|^dom_|^hidden_/.test(key)||/^dom_tower_/.test(key));
  }
  function canTravel(){
    return !player.dead&&!document.body.classList.contains('giran-guest')&&!prideTeleportBlocked()&&!KING_ROOMS[mapState.current]&&!state.antharas&&!state.oblivion&&!window.pvpArenaTravelLocked?.();
  }
  function restrained(){
    return inAbsBarrier()||['stone','paralyze','freeze','stun','sleep'].some(k=>player.statuses?.[k]>0);
  }
  function enterPassage(target){
    if(canTravel()&&!restrained()&&target&&HIDDEN_AREA_PARENT[mapState.current]===target)enterHiddenArea(target);
  }
  function add(label){
    const g=player.giranWorld,labelText=String(label||'').trim().slice(0,32);
    if(!labelText)throw Error('請為這個地點取名。');
    const t=terrain();
    if(!canTravel()||!acceptKey(mapState.current)||!g||g.key!==mapState.current||!t?.camera||t.resolving||t.pending||t.hasTileEntry&&t.kind!=='tiles')throw Error('請在可自由探索的地圖站穩後再記憶位置。');
    const list=player.giranBookmarks||=[];
    if(list.some(p=>p.name===labelText))throw Error('已經有同名書籤。');
    list.push({id:LineageClientCrypto.uuid(),name:labelText,color:0,...g});
    saveGame();
  }
  function owned(id){return player.giranBookmarks?.find(b=>b.id===id);}
  function travel(id){
    const b=owned(id);
    if(!canTravel()||restrained()||!b||!acceptKey(b.key)||!GiranGates.allowed(b.key))throw Error('目前無法傳送至這個位置。');
    if(terrain()?.key!==mapState.current||!terrain()?.camera)throw Error('請等候目前地圖載入。');
    if(!GiranGates.travel({...b,tx:b.x,ty:b.y},terrain()))throw Error('目前無法傳送至這個位置。');
    player.giranWorld={key:b.key,map:b.map,sourceMap:b.sourceMap,x:b.x,y:b.y};
    playTeleportFx();
    saveGame();return b;
  }
  function selectable(entry){
    if(!entry?.v)return false;
    const group=mapRegionOf(entry.v);
    return !!group && regionMapList(group).some(row=>row.v===entry.v && !mapOptDisabled(row));
  }
  function mapReason(entry,fromRegionList=false){
    if(!entry||mapOptDisabled(entry)||document.body.classList.contains('giran-guest'))return entry&&GiranDirectory.lockReason(entry)||'此地無法直達';
    if(!canTravel())return player.dead?'請先復活':'目前挑戰中無法傳送';
    if(restrained())return '目前無法行動';
    if(!fromRegionList&&!selectable(entry))return '此地目前未開放傳送';
    return '';
  }
  function goToMap(entry){
    const why=mapReason(entry);if(why){logSys(why);return false;}
    if(entry.v===mapState.current)return false;
    setMapSelectors(entry.v);changeMap();
    if(mapState.current!==entry.v)return false;
    playTeleportFx();saveGame();return true;
  }
  function activate(){
    if(!escaping)return false;
    arrived=doTeleport(false)!==false;return arrived;
  }
  function escapeSpell(){
    escaping=true;arrived=false;
    try{manualCast('sk_teleport');return arrived;}finally{escaping=false;}
  }
  function randomScroll(item, silent, finish){
    const key=mapState.current,owner=player,town=key.startsWith('town_');
    if(!canTravel()||restrained())return false;
    if(document.documentElement.dataset.playMode==='dimension'){
      if(!town&&HIDDEN_AREA_PARENT[key]&&!silent)enterHiddenArea(HIDDEN_AREA_PARENT[key]);
      else {
        const forceBoss=!silent&&hasTeleportRing();
        doTeleport(forceBoss);
        if(!silent)logSys('使用瞬間移動卷軸，當前的怪物消失了'+(forceBoss?'；傳送控制戒指引動了強敵的氣息……':'')+'。');
      }
      finish();saveGame();return true;
    }
    const scene=town?GiranTown:GiranCombat.field,t=scene?.terrain;
    if(silent&&GiranCombat.offline()){
      // Catch-up simulates encounters without loading a viewport.
      doTeleport(false);finish();return true;
    }
    if(!scene?.leader||t?.key!==key||!t.camera||t.pending||t.resolving||t.kind!=='tiles'||(!town&&scene.map!==key)){
      if(!silent)logSys('地圖載入中，請稍後再使用瞬間移動卷軸。');return false;
    }
    const generation=t.generation;
    if(flight?.owner===owner&&flight.terrain===t&&flight.generation===generation)return false;
    const trip=flight={owner,terrain:t,generation,key};
    const current=()=>flight===trip&&owner===player&&mapState.current===key&&t.generation===generation&&
      !document.hidden&&state.running&&canTravel()&&!restrained()&&player.inv.includes(item)&&item.cnt>0;
    trip.done=(async()=>{
      try{
        let cell;
        try{cell=await t.randomLanding(scene.leader,GiranGates.landingArea(t),current);}
        catch(error){
          window.GiranDiagnostics?.record('瞬間移動',error.message);
          if(current()&&!silent)logSys('落點地形載入失敗，已保留卷軸。');
          return false;
        }
        if(!cell||!current()){
          if(current()&&!silent)logSys('此處找不到可行走的落點，已保留卷軸。');
          return false;
        }
        const forceBoss=!town&&!silent&&hasTeleportRing();
        if(!scene.relocate(cell))return false;
        finish();
        try{
          if(town)playTeleportFx();else doTeleport(forceBoss,true);
          if(!silent)logSys('使用瞬間移動卷軸，抵達'+GiranUI.placeName(key)+'（'+cell.join('，')+'）'+(forceBoss?'，傳送控制戒指引動了強敵的氣息。':'。'));
        }finally{saveGame();}
        return true;
      }finally{if(flight===trip)flight=null;}
    })();
    return trip.done;
  }
  function draw(){
    if(!panel||typeof player==='undefined'||!player?.cls)return;
    const container=panel.querySelector('ul');container.replaceChildren();
    for(const b of player.giranBookmarks||[]){
      const row=document.createElement('li'),label=document.createElement('span'),go=document.createElement('button'),remove=document.createElement('button');
      label.textContent=b.name+'　'+(DB.towns[b.key]?.n||mapDisplayName(b.key));go.type=remove.type='button';go.textContent='傳送';remove.textContent='移除';
      go.onclick=()=>run(()=>{travel(b.id);return '隊伍已傳送至「'+b.name+'」。';});
      remove.onclick=()=>run(()=>{player.giranBookmarks=player.giranBookmarks.filter(x=>x.id!==b.id);saveGame();return '已移除「'+b.name+'」。';});
      row.append(label,go,remove);container.append(row);
    }
  }
  function run(action){const msg=panel.querySelector('output');try{msg.textContent=action();draw();}catch(e){msg.textContent=e.message;}}
  if(panel){
    panel.addEventListener('toggle',()=>{if(panel.open)draw();});
    panel.querySelector('button').onclick=()=>run(()=>{const input=panel.querySelector('input');add(input.value);input.value='';return '已記住所站的位置。';});
  }
  return {add,travel,mapReason,goToMap,activate,escapeSpell,randomScroll,canTravel,enterPassage,draw,get pending(){return escaping;},
    get scrollFlight(){return flight?.owner===player&&flight.key===mapState.current?flight.done:null;}};
})();
