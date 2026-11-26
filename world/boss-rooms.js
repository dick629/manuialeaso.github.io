'use strict';
window.GiranBossRooms = (() => {
  const rooms = new Map(), pendingEntrances = new WeakMap();
  const distance = (a,b) => Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for (const [key, data] of Object.entries(GiranBossRoutes)) {
    const corridor = new Set(), homes = [];
    for (const [id,boss] of Object.entries(data.bosses)) {
      let [x,y] = data.entry;
      const path = [{x,y}];
      for (const direction of boss.steps) {
        const [dx,dy] = GiranGeometry.directions[Number(direction)];
        x+=dx; y+=dy; path.push({x,y});
      }
      for (const cell of path) {
        for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)corridor.add((cell.x+dx)+','+(cell.y+dy));
      }
      homes.push({id, name:DB.mobs[id]?.n || boss.name, sourceId:boss.id, x:boss.x, y:boss.y, path});
    }
    rooms.set(key,{map:data.map, entry:data.entry, homes, corridor});
  }
  // Dimension's seventh-floor encounter has its own boss and loot on the final Dragon Valley floor.
  const dragon = rooms.get('antaras_lair');
  rooms.set('dv_dungeon_7',{...dragon,homes:dragon.homes.map(h=>({...h,id:'afk_ttmi_22',name:DB.mobs.afk_ttmi_22?.n || '恐怖的安塔瑞斯'}))});
  const forms=['ant_antharas_eroded','ant_antharas_fury','ant_antharas_mad','ant_antharas_s4','ant_antharas_s5','ant_antharas_s6','ant_antharas_s7'];
  rooms.set('antharas_lair',{...dragon,encounter:true,homes:[{...dragon.homes[0],id:forms[0],forms,riftDragon:true}]});
  // Doorway and guardian positions on each authored plate, as fractions of its artwork.
  const nestEnds={
    antharas_nest_1:[[.15,.81],[.83,.32]],
    antharas_nest_2:[[.26,.76],[.76,.33]],
    antharas_nest_3:[[.20,.68],[.71,.38]]
  };
  function preparePainting(key,world){
    if(!nestEnds[key])return null;
    if(rooms.has(key))return rooms.get(key);
    const d=world.map.d;
    const [entry,seat]=nestEnds[key].map(([u,v])=>world.screenToCell(u*d.ww,v*d.wh,[0,0]));
    const steps=world.findPath(...entry,...seat,null);
    if(!steps?.length)throw Error('地龍副本入口無法通往守衛 '+key);
    let [x,y]=entry;
    const path=[{x,y}];
    for(const step of steps){
      const [dx,dy]=GiranGeometry.directions[step];
      x+=dx;y+=dy;path.push({x,y});
    }
    const id=ANTHARAS_AREA_BOSS[key];
    const result={map:key,entry,encounter:true,homes:[{id,name:DB.mobs[id].n,x,y,path}]};
    rooms.set(key,result);return result;
  }
  function matches(h,mob){
    return h.id===mob.mobId || h.name===mob.n || (h.riftDragon&&mob._rdBoss) ||
      h.forms?.some(id=>id===mob.mobId||DB.mobs[id]?.n===mob.n);
  }
  function room(key,map) {
    const r=rooms.get(key);
    return r && (map===undefined || r.map===map) ? r : null;
  }
  function home(terrain,mob) {
    return mob && room(terrain?.key,terrain?.world?.map?.id)?.homes.find(h=>matches(h,mob));
  }
  function nearest(terrain,leader) {
    const current=room(terrain.key,terrain.world?.map?.id),homes=current?.homes;
    if(!homes?.length || !leader)return null;
    const active=homes.filter(h=>mapState.mobs.some(m=>m && !m._dead && m.curHp>0 && matches(h,m)));
    const candidates=active.length||current.encounter?active:homes;
    if(!candidates.length)return null;
    return candidates.reduce((a,b)=>distance(a,leader)<=distance(b,leader)?a:b);
  }
  function nextStep(terrain,leader,h) {
    if(distance(leader,h)<=5)return null;
    let closest=0;
    for(let i=1;i<h.path.length;i++)if(distance(leader,h.path[i])<=distance(leader,h.path[closest]))closest=i;
    const next=h.path[Math.min(h.path.length-1,closest+(distance(leader,h.path[closest])<5?9:0))];
    return [next.x,next.y];
  }
  function intent(h,mob,actor,nearest) {
    if (distance(h,actor)>8 || distance(h,nearest)>12) {
      actor.alert=false;
      return distance(actor,h)>1 ? [h.x,h.y] : null;
    }
    if(distance(actor,nearest)<=6 || mob.curHp<mob.hp)actor.alert=true;
    return actor.alert?'engage':null;
  }
  function unseen(key,mob){
    const field=window.GiranCombat?.field;
    const scene=key==='afk_riftdg'?window.__afkRiftDg?.earthField?.(window.__afkRiftDg.run()):key;
    const known=rooms.get(scene)?.homes.some(h=>matches(h,mob)) ||
      (nestEnds[scene] && mob.n===DB.mobs[ANTHARAS_AREA_BOSS[scene]]?.n);
    return !!known && (field?.map!==key || !field.ready() || !field.point(mob));
  }
  function deferEntrance(key,mob,options){
    if(!unseen(key,mob))return false;
    pendingEntrances.set(mob,options);
    return true;
  }
  function showEntrance(mob){
    if(!pendingEntrances.has(mob))return;
    const options=pendingEntrances.get(mob);pendingEntrances.delete(mob);
    vfxBossEntrance(mob,options);
  }
  function singleSlot(key,pool){
    const r=rooms.get(key);
    return r?.homes.length===1 && pool?.length===1 && !!DB.mobs[pool[0]]?.boss;
  }
  return {room,home,nearest,nextStep,intent,singleSlot,unseen,deferEntrance,showEntrance,preparePainting};
})();
