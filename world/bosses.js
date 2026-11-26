'use strict';
window.GiranWorldBosses=(()=>{
  const points=GiranAtlasData.bossPoints,range=22,respawn=600000;
  const fallbackPoints=Object.fromEntries(Object.entries(points).map(([map,rows])=>
    [map,rows.filter(([id])=>Object.hasOwn(GiranAtlasData.nativeFallback,id))]));
  const onWorld=()=>GiranCombat.inWorld()&&!player.dead&&GiranCombat.field?.ready()&&GiranCombat.field.terrain.kind==='tiles'&&GiranCombat.field.map===mapState.current;
  function eligible(){
    const key=mapState.current;
    if(window.TwistedSpace?.here())return false;
    if(GiranCombat.field?.terrain.instance || GiranBossRooms.room(key))return false;
    if(!onWorld()||KING_ROOMS[key]||PURE_BOSS_MAPS.includes(key)||(typeof ANTHARAS_AREA_BOSS!=='undefined'&&ANTHARAS_AREA_BOSS[key]))return false;
    if(typeof npcClanGroupBattleActive==='function'&&npcClanGroupBattleActive()||typeof wcMassTauntGroupBattleActive==='function'&&wcMassTauntGroupBattleActive())return false;
    const terrain=GiranCombat.field.terrain;
    return key.startsWith('giran_floor_')||!!fallbackPoints[terrain.sourceMap??terrain.world.map.id]?.length;
  }
  const namesByMap=new Map(Object.entries(points).map(([id,rows])=>[Number(id),
    new Set(rows.map(row=>GiranAtlas.monsterName(row[0])).filter(Boolean))]));
  function fieldPool(pool){
    if(!mapState.current.startsWith('giran_floor_')||!eligible())return pool;
    const names=namesByMap.get(GiranCombat.field.terrain.sourceMap);
    return names?pool.filter(id=>!names.has(DB.mobs[id]?.n)):pool;
  }
  function nearby(terrain,leader,now){
    const map=terrain.sourceMap??terrain.world.map.id,result=[];
    const rows=(terrain.key||mapState.current).startsWith('giran_floor_')?points[map]:fallbackPoints[map];
    for(const [id,x,y,lv] of rows||[]){
      const distance=Math.max(Math.abs(x-leader.x),Math.abs(y-leader.y)),key=[map,id,x,y].join('/');
      if(distance>range||(player.giranBossRecovery?.[key]||0)>now||mapState.mobs.some(m=>m?._giranSpawn?.key===key&&!m._dead))continue;
      result.push({id,x,y,lv,key,distance});
    }
    return result.sort((a,b)=>a.distance-b.distance);
  }
  function seat(terrain,p,board,allowed){
    const w=terrain.world,d=w.map.d;
    for(let r=0;r<=3;r++)for(let x=p.x-r;x<=p.x+r;x++)for(let y=p.y-r;y<=p.y+r;y++){
      if(Math.max(Math.abs(x-p.x),Math.abs(y-p.y))===r&&w.pass(x-d.gameX0,y-d.gameY0)&&(!board||!board.occupied(null,x,y))&&(!allowed||allowed(x,y)))return [x,y];
    }
    return null;
  }
  function spawn(idx){
    if(window.GiranRoam?.spawning||!eligible()||mapState.mobs[idx]&&!mapState.mobs[idx]._dead)return false;
    if(state.prideClimb && idx===1)return false;
    const field=GiranCombat.field;
    if(!GiranGates.huntingGround(field.terrain,field.leader))return false;
    for(const p of nearby(field.terrain,field.leader,Date.now())){
      if(!GiranGates.outsideVillage(field.terrain,p.x,p.y))continue;
      const id=GiranAtlas.mobKey(p.id),base=DB.mobs[id],cell=seat(field.terrain,p,field.board,(x,y)=>GiranGates.outsideVillage(field.terrain,x,y));if(!base||!cell)continue;
      const original=GiranAtlasData.nativeMobs[p.id]?.[1];
      const mob={...base,curHp:base.hp,boss:original?!!base.boss:true,uid:uid(),_born:++_mobBornSeq,_bornMs:Date.now(),_magCd:{},justHit:false,st:newMobStatus(),_giranSpawn:{key:p.key,cell}};
      mob.mobId=id;
      if(GiranAtlasData.nativeFallback[p.id])mob._giranSpawn.sourceFallback=true;
      mob._giranSpawn.home=[p.x,p.y];
      // This physical spawn follows its source's single-life reward and ten-minute respawn rule.
      if(!original)delete mob.transformTo;
      mapState.mobs[idx]=mob;
      if(mob.hard&&typeof initHardSkin==='function')initHardSkin(mob);
      if(typeof vfxBossEntrance==='function')vfxBossEntrance(mob);
      logSys('首領「'+mob.n+'」出現在附近。');return true;
    }
    return false;
  }
  function ordinaryNear(terrain,leader,now=Date.now(),includeActive=false,radius=20,includeRecovering=false){
    const data=window.GiranHuntingData;
    if(!data||(terrain.sourceMap??terrain.world.map.id)!==data.map)return [];
    const {x,y}=leader;
    if(data.villages.some(([cx,cy])=>Math.abs(cx-x)<=26&&Math.abs(cy-y)<=26))return [];
    if(terrain.areas&&!GiranGates.huntingGround(terrain,leader))return [];
    const active=new Set(mapState.mobs.filter(m=>m&&!m._dead&&m._giranSpawn).map(m=>m._giranSpawn.key));
    const result=[];
    for(let cx=(x-radius)>>4;cx<=(x+radius)>>4;cx++){
      for(let cy=(y-radius)>>4;cy<=(y+radius)>>4;cy++){
        for(const [id,px,py] of data.buckets[cx+','+cy]||[]){
          const distance=Math.max(Math.abs(px-x),Math.abs(py-y)),key=[data.map,id,px,py].join('/');
          if(distance<=radius&&(includeActive||!active.has(key))&&(includeRecovering||!(player.giranHuntRecovery?.[key]>now))&&
             (!terrain.areas||GiranGates.outsideVillage(terrain,px,py)))
            result.push({id,x:px,y:py,key,distance});
        }
      }
    }
    return result.sort((a,b)=>a.distance-b.distance);
  }
  function ordinary(idx){
    const requested=window.GiranRoam?.given(idx);
    if(requested!==undefined)return requested;
    if((idx!==0&&idx!==3)||!eligible())return null;
    const field=GiranCombat.field,candidates=ordinaryNear(field.terrain,field.leader);
    if(!candidates.length)return null;
    const available=new Set(field.board.floor.map(([x,y])=>x+','+y));
    for(const p of candidates){
      if(!available.has(p.x+','+p.y)||field.board.occupied(null,p.x,p.y))continue;
      const id=GiranAtlas.mobKey(p.id);if(!id)continue;
      return {id,point:{key:p.key,cell:[p.x,p.y],kind:'ordinary'}};
    }
    return null;
  }
  function defeated(mob,now=Date.now()){
    window.GiranRoam?.defeated(mob);
    if(!mob?._giranSpawn)return;
    const ordinary=mob._giranSpawn.kind==='ordinary'||mob._giranSpawn.kind==='event';
    const cache=ordinary?(player.giranHuntRecovery||={}):(player.giranBossRecovery||={});
    for(const k of Object.keys(cache))if(cache[k]<=now)delete cache[k];
    let cooldown=ordinary?10000:respawn;
    if(mob._giranSpawn.kind==='ordinary'&&mob._giranSpawn.key.startsWith('field/')){
      cooldown=[10000,10000,6000,3500,2000][GiranHunt.activePopulation(player.giranHunt)-1];
    }
    cache[mob._giranSpawn.key]=now+cooldown;
  }
  return {nearby,seat,spawn,fieldPool,ordinaryNear,ordinary,defeated};
})();
