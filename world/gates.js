'use strict';
window.GiranGates=(()=>{
  let gates={}, next=null, crossing=null, generation=0,checking=null;
  function takeCrossing(key){
    const c=crossing;crossing=null;
    if(c&&c.key!==key){c.world.dispose();return null;}
    return c;
  }
  fetch('world/portals.json').then(r=>{if(!r.ok)throw Error('無法載入傳點資料');return r.json();})
    .then(rows=>{gates=rows;generation++;}).catch(error=>window.GiranDiagnostics?.record('傳點',error.message));
  function destination(key){
    if(next && next.key===key){const result=next;next=null;return result;}
    const saved=typeof player!=='undefined' && player?.giranWorld;
    return saved?.key===key && Number.isSafeInteger(saved.x) && Number.isSafeInteger(saved.y)?saved:null;
  }
  function remember(terrain,leader){
    if(typeof player==='undefined'||!player?.cls||!leader||!terrain.camera||terrain.resolving||terrain.pending || (terrain.hasTileEntry && terrain.kind!=='tiles'))return;
    if(mapState.current!==terrain.key)return;
    const map=terrain.world.map.id,prev=player.giranWorld;
    const sheltered=!terrain.key.startsWith('town_')&&!huntingGround(terrain,leader);
    if(!prev||prev.map!==map||prev.sourceMap!==terrain.sourceMap||prev.key!==terrain.key||prev.x!==leader.x||prev.y!==leader.y||prev.sheltered!==sheltered)
      player.giranWorld={key:terrain.key,map,sourceMap:terrain.sourceMap,x:leader.x,y:leader.y,sheltered};
  }
  function allowed(key){
    if(/^pride_f\d+$/.test(key))return !!DB.maps[key]&&(mapState.current===key||key==='pride_f2'&&mapState.current==='town_pride');
    const city=Object.values(SIEGE_CITY).find(c=>c.castle===key||c.outer===key||c.inner===key);
    if(city){
      if(key===city.castle)return ownsCastle(city.key);
      return !!(player.siege?.active&&siegeCityCfg()?.key===city.key&&getSiegeAreas().some(m=>m.v===key&&!mapOptDisabled(m)));
    }
    const def=mapEntryOf(key)||getCastleAreas().find(r=>r.v===key);
    checking=key;
    try{return !!(def && !(def.classicHide&&player.classicMode) && !mapOptDisabled(def));}
    finally{checking=null;}
  }
  const castleFloors={15:'kent',29:'windwood',52:'giran',64:'heine',66:'dwarf_castle',300:'aden'};
  function localGate(g,terrain){
    const city=SIEGE_CITY[castleFloors[g.sourceMap??g.map]];
    if(city){
      const key=ownsCastle(city.key)?city.castle:city.inner;
      return {...g,key,title:'→ '+(key===city.castle?city.castleName:city.innerName)};
    }
    const from=SIEGE_CITY[castleFloors[terrain.sourceMap??terrain.world.map.id]];
    if(from&&(g.sourceMap??g.map)===4){
      const at={x:g.tx,y:g.ty};
      const map4=terrain.areas;
      const name=allowed(from.outer)?from.outer:Object.keys(map4).filter(k=>map4[k].map===4&&DB.maps[k]?.length&&mapCategoryOf(k)==='wild'&&allowed(k)).sort((a,b)=>distance(map4[a],at)-distance(map4[b],at))[0];
      if(name)return {...g,key:name,title:'→ '+(name===from.outer?from.outerName:mapDisplayName(name))};
    }
    return g;
  }
  function travel(g,terrain){
    if(player.dead||!allowed(g.key))return false;
    const dest={key:g.key,map:g.map,sourceMap:g.sourceMap,x:g.tx,y:g.ty};next=dest;
    if(g.key===mapState.current){terrain?.select(g.key,mapDisplayName(g.key));return true;}
    if(g.key==='pride_f2'&&mapState.current==='town_pride'){startPrideClimb(false);if(mapState.current!==g.key){next=null;return false;}return true;}
    checking=g.key;
    try{setMapSelectors(g.key);changeMap();}finally{checking=null;}
    if(mapState.current!==g.key){next=null;return false;}
    if(g.key.startsWith('giran_floor_')){
      player.giranVisits ||= {};player.giranVisits[g.key]=true;
    }
    return true;
  }
  function useDoor(g,terrain,leader){
    if(g.arrivals){
      let nearest=g.cells[0],distance=Infinity;
      for(const cell of g.cells){
        const gap=Math.hypot(cell[0]-leader.x,cell[1]-leader.y);
        if(gap<distance){nearest=cell;distance=gap;}
      }
      const cell=g.arrivals.find(p=>p[0]===nearest[0]&&p[1]===nearest[1]);
      if(cell)g={...g,tx:cell[2],ty:cell[3]};
    }
    return travel(g,terrain);
  }

  const townLists=new WeakMap();
  function geography(terrain){
    if(!terrain.areas||terrain.kind!=='tiles'||terrain.areas[terrain.key]?.castleInterior)return null;
    let all=townLists.get(terrain.areas);
    if(!all){
      all=new Map();
      for(const [key,entry] of Object.entries(terrain.areas)){
        if(key.startsWith('giran_floor_')||entry.instance)continue;
        const town=key.startsWith('town_');
        if(!town&&(!DB.maps[key]?.length||mapCategoryOf(key)!=='wild'))continue;
        const map=entry.sourceMap??entry.map;
        if(!all.has(map))all.set(map,{towns:[],wilds:[]});
        const place={...entry,key};
        if(town){
          place.npcs=Object.values(window.GiranTownPlaces?.[key]||{});
          place.extent=place.npcs.reduce((r,[x,y])=>Math.max(r,Math.abs(x-place.x)+7,Math.abs(y-place.y)+7),26);
        }
        all.get(map)[town?'towns':'wilds'].push(place);
      }
      townLists.set(terrain.areas,all);
    }
    return all.get(terrain.sourceMap??terrain.world.map.id);
  }
  const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const villageMargin=3;
  const WILD_RADIUS=150;
  function inDistrict(t,x,y,margin=0){
    const dist=Math.max(Math.abs(x-t.x),Math.abs(y-t.y));
    return dist<=26+margin||dist<=t.extent+margin&&t.npcs.some(([px,py])=>Math.max(Math.abs(x-px),Math.abs(y-py))<=7+margin);
  }
  function landingArea(terrain){
    const places=geography(terrain),key=terrain.key,world=terrain.world;
    const town=places?.towns.find(t=>t.key===key),wild=places?.wilds.find(w=>w.key===key);
    const doors=new Set((gates[terrain.sourceMap??world.map.id]||[]).flatMap(g=>g.cells.map(p=>p.join(','))));
    const occupied=new Set(Object.values(window.GiranTownPlaces?.[key]||{}).map(p=>p.join(',')));
    function contains(x,y){
      if(town&&places.wilds.length)return inDistrict(town,x,y);
      if(!wild)return true;
      if(places.towns.some(t=>inDistrict(t,x,y)))return false;
      const point={x,y},from=distance(point,wild);
      return !places.wilds.some(w=>distance(point,w)<from);
    }
    return {contains,open(x,y){
      return contains(x,y)&&!doors.has(x+','+y)&&!occupied.has(x+','+y)&&
        !(wild&&places.towns.length&&world.safeZone(x,y));
    }};
  }
  function groundReady(terrain,x,y,margin){
    const d=terrain.world.map.d,lx=x-d.gameX0,ly=y-d.gameY0;
    return terrain.world.viewReady([lx-margin,ly-margin,lx+margin,ly+margin],true);
  }
  function safeWilderness(terrain,x,y,margin=0){
    if(terrain.instance)return true;
    const regions=geography(terrain);
    if(!regions?.wilds.length||!regions.towns.length)return true;
    if(regions.towns.some(t=>inDistrict(t,x,y,margin)))return false;
    if(!groundReady(terrain,x,y,margin))return false;
    for(let dx=-margin;dx<=margin;dx++)for(let dy=-margin;dy<=margin;dy++){
      if(terrain.world.safeZone(x+dx,y+dy))return false;
    }
    return true;
  }
  function huntingGround(terrain,{x,y}){
    return outsideVillage(terrain,x,y);
  }
  // A doorway or a decoration inside a native safety zone can carry a single normal
  // tile flag. Only a contiguous patch of normal ground can be a village exit or spawn.
  const checkedGround=new WeakMap();
  function outsideVillage(terrain,x,y){
    const world=terrain.world;
    let saved=checkedGround.get(terrain);
    if(!saved||saved.world!==world||saved.key!==terrain.key||saved.revision!==world.groundRevision){
      saved={world,key:terrain.key,revision:world.groundRevision,cells:new Map()};checkedGround.set(terrain,saved);
    }
    const cell=x*131072+y;
    if(!saved.cells.has(cell)){
      if(saved.cells.size>=18000)saved.cells.clear();
      saved.cells.set(cell,safeWilderness(terrain,x,y,villageMargin));
    }
    return saved.cells.get(cell);
  }
  const nonVillage=new Set(['town_rift','town_pride','town_sherine','town_ivory_tower','town_elder_council','town_flame_audience']);
  function kentField(key=mapState.current){
    return !DB.towns[key]&&(mapRegionOf(key)==='kent'||key===SIEGE_CITY.kent.outer||key===SIEGE_CITY.kent.inner);
  }
  let fixedAreas;
  if(document.documentElement.dataset.playMode==='dimension'){
    fetch('dimension-map/areas.json').then(r=>{if(r.ok)return r.json();})
      .then(areas=>{fixedAreas=areas;}).catch(()=>{});
  }
  function nearestVillage(){
    const key=mapState.current,scene=key?.startsWith('town_')?window.GiranTown:window.GiranCombat?.field;
    const terrain=scene?.terrain, areas=terrain?.areas||window.GiranTown?.terrain?.areas||(fixedAreas&&kentField(key)?fixedAreas:{});
    const castleKeys=new Set(Object.values(SIEGE_CITY).map(c=>c.castle));
    const village=k=>DB.towns[k]&&!castleKeys.has(k)&&!DB.towns[k].castle&&!nonVillage.has(k)&&allowed(k);
    const villages=Object.entries(areas).filter(([k,e])=>k.startsWith('town_')&&!e.instance&&village(k));
    const saved=player.giranWorld?.key===key?player.giranWorld:null;
    const start=terrain?.key===key&&scene.leader?{map:terrain.sourceMap??terrain.world?.map?.id,x:scene.leader.x,y:scene.leader.y}:
      (kentField(key)&&Number.isSafeInteger(saved?.x)&&Number.isSafeInteger(saved?.y)?saved:areas[key]||saved);
    if(start){
      const source=start.sourceMap??start.map;
      let frontier=[{...start,map:source,cost:0}],visited=new Set([source]);
      while(frontier.length){
        const found=[],next=new Map();
        for(const at of frontier){
          for(const [k,v] of villages)if((v.sourceMap??v.map)===at.map)found.push([k,at.cost+distance(at,v)]);
          for(const g of gates[at.map]||[]){
            const map=g.sourceMap??g.map;if(visited.has(map))continue;
            const cost=at.cost+distance(at,g)+1,entry=[map,g.tx,g.ty].join('/');
            if(!next.has(entry)||cost<next.get(entry).cost)next.set(entry,{map,x:g.tx,y:g.ty,cost});
          }
        }
        if(found.length)return found.sort((a,b)=>a[1]-b[1])[0][0];
        frontier=[...next.values()];for(const n of frontier)visited.add(n.map);
      }
    }
    const region=mapRegionOf(key);
    return regionMapList(region).find(m=>village(m.v))?.v||(!castleKeys.has(player.lastTownVisited)&&village(player.lastTownVisited)?player.lastTownVisited:getHomeTown());
  }
  const villageCastles = {
    town_giran_kent:'kent', town_giran_windwood:'windwood', town_heine:'heine', town_giran:'giran',
    town_aden:'aden', town_gludio:'orc_fortress', town_witon:'dwarf_castle'
  };
  function unownedCastleVillage(key){
    if(!SIEGE_CASTLES.includes(key))return null;
    const city=Object.values(SIEGE_CITY).find(c=>c.castle===key);
    if(!city||ownsCastle(city.key))return null;
    const village=Object.keys(villageCastles).find(k=>villageCastles[k]===city.key);
    return DB.towns[village]?village:getHomeTown();
  }
  function homeDestination(savedTown){
    const kent=kentField();
    if(kent&&ownsCastle('kent'))return SIEGE_CITY.kent.castle;
    if(savedTown&&DB.towns[savedTown])return unownedCastleVillage(savedTown)||savedTown;
    const village=nearestVillage();
    if(kent)return village;
    const city=SIEGE_CITY[villageCastles[village]];
    return city&&ownsCastle(city.key)?city.castle:village;
  }
  function outside(terrain,from){
    const areas=geography(terrain);
    if(!areas?.wilds.length)return null;
    const region=mapRegionOf(terrain.key);
    return areas.wilds.filter(w=>allowed(w.key)).sort((a,b)=>{
      const score=w=>distance(w,from)+(mapRegionOf(w.key)===region?0:180);
      return score(a)-score(b);
    })[0]||null;
  }
  function walkOut(terrain,leader){
    const origin=terrain.areas?.[terrain.key],wild=origin&&outside(terrain,origin);
    if(!wild||!leader)return null;
    const world=terrain.world,start=leader.step||[leader.x,leader.y];
    // Search connected walkable cells. A wall or coastline can put the geometric exit on the wrong side.
    const steps=GiranGeometry.directions,queue=[start],seen=new Set([start.join()]),choices=[];
    let waypoint=null,best=Math.hypot(start[0]-wild.x,start[1]-wild.y);
    for(let i=0;i<queue.length&&i<18000;i++){
      const [x,y]=queue[i],radius=distance({x,y},origin);
      if(radius>=28&&outsideVillage(terrain,x,y)){choices.push([x,y]);if(choices.length>=32)break;continue;}
      const fromStart=Math.max(Math.abs(x-start[0]),Math.abs(y-start[1])),score=Math.hypot(x-wild.x,y-wild.y);
      if(fromStart>=8&&fromStart<=24&&score<best){best=score;waypoint=[x,y];}
      if(Math.max(Math.abs(x-start[0]),Math.abs(y-start[1]))>96)continue;
      for(let h=0;h<steps.length;h++){
        const xx=x+steps[h][0],yy=y+steps[h][1],k=xx+','+yy;
        if(!seen.has(k)&&world.canStep(x,y,h)){seen.add(k);queue.push([xx,yy]);}
      }
    }
    choices.sort((a,b)=>Math.hypot(a[0]-wild.x,a[1]-wild.y)+.45*Math.hypot(a[0]-start[0],a[1]-start[1])-
      Math.hypot(b[0]-wild.x,b[1]-wild.y)-.45*Math.hypot(b[0]-start[0],b[1]-start[1]));
    return choices[0]||waypoint;
  }
  function sceneHasTalk(){return !!window.GiranTown?.approaching;}
  function boundary(terrain,leader,old){
    const places=geography(terrain),from=terrain.areas?.[terrain.key];
    if(!places?.wilds.length||!from||mapState.current!==terrain.key)return false;
    let dest;
    // 11-27 Ping：地圖名稱要跟腳下的地方一致。狩獵區只算到中心 WILD_RADIUS 格內；走到兩個狩獵區之間的路上
    // （例：奇岩城外的花園）不再沿用遠處狩獵區的名字和怪，改成最近的村莊（沒有怪），走進下一個狩獵區才開打。
    const nearestWild=(p,skip)=>places.wilds.filter(w=>w.key!==skip&&distance(w,p)<=WILD_RADIUS&&allowed(w.key))
      .sort((a,b)=>distance(a,p)-distance(b,p))[0]||null;
    if(terrain.key.startsWith('town_')){
      if(outsideVillage(terrain,leader.x,leader.y)&&!sceneHasTalk())dest=nearestWild(leader);
    }else if(places.wilds.some(w=>w.key===terrain.key)){
      if(!outsideVillage(terrain,leader.x,leader.y)&&groundReady(terrain,leader.x,leader.y,villageMargin)){
        dest=places.towns.filter(t=>inDistrict(t,leader.x,leader.y,villageMargin)||
          distance(leader,t)<=Math.max(t.nativeSafetyRadius??96,t.extent)+villageMargin)
          .sort((a,b)=>distance(a,leader)-distance(b,leader)).find(t=>allowed(t.key));
      }
      if(!dest){
        const here=distance(leader,from),closest=nearestWild(leader,terrain.key);
        if(closest&&distance(leader,closest)+30<here)dest=closest;
        else if(here>WILD_RADIUS&&groundReady(terrain,leader.x,leader.y,villageMargin))
          dest=places.towns.filter(t=>allowed(t.key)).sort((a,b)=>distance(a,leader)-distance(b,leader))[0];
      }
    }
    if(!dest)return false;
    const fromTown=terrain.key.startsWith('town_'),toTown=dest.key.startsWith('town_');
    const scene=fromTown?window.GiranTown:window.GiranCombat?.field;
    const copy=a=>a&&({x:a.x,y:a.y,fx:a.fx,fy:a.fy,heading:a.heading,step:a.step?.slice()||null,
      progress:a.progress,path:a.path.slice(),walking:a.walking,goalX:a.goalX,goalY:a.goalY});
    const party=new Map();
    for(const ally of GiranPartyView.combatAllies()){
      if(!ally)continue;
      const a=fromTown?scene.units.get('a'+ally._slot)?.actor:scene.point(ally);
      if(a)party.set(String(ally._slot),copy(a));
    }
    const c={key:dest.key,world:terrain.world,areas:terrain.areas,sourceMap:terrain.sourceMap,focus:terrain.focus.slice(),
      captain:copy(leader),party,goal:scene.walkGoal?.slice()||null};
    const pool=DB.maps[dest.key]||[];
    const slots=!fromTown&&!toTown&&mapState.mobs.map(m=>m?._giranSpawn&&!m._dead&&pool.includes(m.mobId)?m:null),locked=slots&&slots.includes(GiranRoam.locked())&&GiranRoam.locked();
    if(slots)for(const m of slots){const a=m&&scene.point(m);if(a)m._giranSpawn.cell=[a.x,a.y];}
    if(!travel({key:dest.key,map:terrain.world.map.id,sourceMap:terrain.sourceMap,tx:leader.x,ty:leader.y},terrain))return false;
    terrain.tiles=null;crossing=c;
    if(fromTown&&!toTown)GiranRoam.leaveVillage(c.world);
    if(slots){mapState.mobs=slots;GiranRoam.choose(locked||null);renderMobs();}
    return true;
  }
  function layer(host,command){
    const container=document.createElement('div');container.className='g-field-exits';host.append(container);
    let last='',buttons=[],previous=null;
    return function draw(terrain,leader,enabled){
      if(!host.contains(container))host.append(container);
      const originalRoom=terrain.world && GiranBossRooms.room(terrain.key,terrain.world.map?.id);
      if(!enabled||terrain.instance&&!originalRoom||terrain.kind!=='tiles'||!leader||!terrain.camera){previous=null;if(last){container.replaceChildren();last='';buttons=[];}return;}
      const map=terrain.sourceMap??terrain.world.map.id, grid=8;
      const sig=[map,terrain.revision,Math.floor(leader.x/grid),Math.floor(leader.y/grid),generation].join('/');
      if(sig!==last){
        last=sig;buttons=[];container.replaceChildren();
        const rows=(gates[map]||[]).filter(g=>Math.max(Math.abs(g.x-leader.x),Math.abs(g.y-leader.y))<42).map(g=>localGate(g,terrain)).filter(g=>allowed(g.key));
        for(const g of rows){
          const button=document.createElement('button');button.type='button';button.className='g-world-gate g-native-gate';button.dataset.destination=g.key;
          button.dataset.mapX=g.x;button.dataset.mapY=g.y;
          const icon=document.createElement('span');icon.textContent='↳';const label=document.createElement('b');label.textContent=g.title.replace(/^[↑↓→←↔]\s*/,'');
          button.append(icon,label);container.append(button);
          button.onclick=e=>{
            e.stopPropagation();
            const gap=(x,y)=>Math.min(...g.cells.map(c=>Math.max(Math.abs(c[0]-x),Math.abs(c[1]-y))));
            const arrive=()=>{if(gap(leader.x,leader.y)<=3)useDoor(g,terrain,leader);};
            if(gap(leader.x,leader.y)<=3){arrive();return;}
            const from=leader.step||[leader.x,leader.y],candidates=[];
            for(const [x,y] of g.cells)for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)candidates.push([x+dx,y+dy]);
            candidates.sort((a,b)=>Math.hypot(a[0]-from[0],a[1]-from[1])-Math.hypot(b[0]-from[0],b[1]-from[1]));
            for(const c of candidates){
              const d=terrain.world.map.d;
              if(!terrain.world.pass(c[0]-d.gameX0,c[1]-d.gameY0))continue;
              const route=terrain.world.findPathNear(...from,...c);
              if(route?.to && gap(...route.to)<=3){command(route.to,arrive);return;}
            }
          };
          buttons.push([g,button]);
        }
      }
      const old=previous;
      previous={revision:terrain.revision,x:leader.x,y:leader.y};
      if(old?.revision===terrain.revision&&(old.x!==leader.x||old.y!==leader.y)&&!leader.step){
        const entered=buttons.find(([g])=>g.cells.some(([x,y])=>x===leader.x&&y===leader.y)&&!g.cells.some(([x,y])=>x===old.x&&y===old.y));
        if(entered&&useDoor(entered[0],terrain,leader)||boundary(terrain,leader,old))return [];
      }
      for(const [g,button] of buttons){
        const [x,y]=terrain.project(g.x,g.y);button.style.left=x+'px';button.style.top=y+'px';
        button.hidden=x<24||y<40||x>terrain.width-24||y>terrain.height-10;
      }
      return buttons.filter(([,b])=>!b.hidden).map(([g])=>g);
    };
  }
  function accessible(key){return checking===key||key===mapState.current||!!player?.giranVisits?.[key];}
  function known(key){return !!(mapEntryOf(key)||SIEGE_CASTLES.includes(key)||/^pride_f\d+$/.test(key)&&DB.maps[key]);}
  return {destination,takeCrossing,remember,layer,accessible,known,allowed,travel,landingArea,safeWilderness,outsideVillage,huntingGround,walkOut,outside,kentField,nearestVillage,homeDestination,unownedCastleVillage};
})();
