'use strict';
window.GiranTravel=(()=>{
  const stations=window.GiranTravelData;
  // The second and third exported poses are recoil frames. The guide stands in pose zero.
  NPC_SPR['6377']={g:'6377',f:1,shadow:false};
  for(const [key,station] of Object.entries(stations)){
    if(!DB.towns[key]){
      DB.towns[key]={n:station.label,npcs:[]};
      TOWN_BG_1920[key]=key.endsWith('kent')?'肯特':'風木';
      const entry={v:key,t:station.label},region=key.endsWith('kent')?'kent':'windwood';
      MAP_CATEGORIES.village.push(entry);MAP_REGIONS.find(r=>r.key===region).maps.push(entry);
    }
    // 11-27 Ping：傳送師（付金幣的長串傳送清單）關閉；要移動用地圖選單的瞬移／飛行
    // __afkLore.addNpc(key,{id:'npc_giran_travel_'+key,n:station.name,title:'傳送師',type:'guide'},'6377',[62,42]);
  }
  function reason(town,route){
    if(!route||!route.to)return '原圖未提供落點';
    if(mapState.current!==town||player.dead||document.body.classList.contains('giran-guest'))return '須由隊長到站交談';
    if(!GiranGates.allowed(route.to.key))return '尚未取得目的地資格';
    return player.gold<route.price?'金幣不足':'';
  }
  function travel(town,index){
    const route=stations[town]?.entries[index],why=reason(town,route);if(why)throw Error(why);
    const terrain=window.GiranTown?.terrain;
    if(document.documentElement.dataset.playMode!=='dimension'&&!terrain?.camera)throw Error('地圖載入中');
    player.gold-=route.price;
    try{if(!GiranGates.travel(route.to,terrain))throw Error('目前無法進入目的地');}
    catch(error){player.gold+=route.price;throw error;}
    // Commit arrival and cost together even if the player closes during the terrain load.
    player.giranWorld={key:route.to.key,map:route.to.map,sourceMap:route.to.sourceMap,x:route.to.tx,y:route.to.ty};
    closeNpcInteraction();logSys(stations[town].name+' 將隊伍傳送至「'+route.title+'」，車資 '+route.price.toLocaleString()+' 金幣。');saveGame();return route.to;
  }
  function show(town){
    const host=document.getElementById('interaction-content');host.replaceChildren();
    const box=document.createElement('div');box.className='g-travel';
    const search=document.createElement('input'),balance=document.createElement('span'),list=document.createElement('div'),notice=document.createElement('output');
    search.type='search';search.placeholder='搜尋目的地';search.setAttribute('aria-label','搜尋傳送目的地');notice.setAttribute('aria-live','polite');
    box.append(search,balance,notice,list);host.append(box);
    function draw(){
      balance.textContent='持有 '+player.gold.toLocaleString()+' 金幣';list.replaceChildren();
      const text=search.value.trim();
      stations[town].entries.forEach((r,i)=>{
        if(text&&!r.title.includes(text))return;
        const b=document.createElement('button'),name=document.createElement('b'),fare=document.createElement('span');
        b.type='button';b.dataset.route=String(i);name.textContent=r.title;const why=reason(town,r);
        fare.textContent=why||(!r.price?'免費':r.price.toLocaleString()+' 金幣');b.disabled=!!why;b.append(name,fare);
        b.onclick=()=>{try{travel(town,i);}catch(e){notice.textContent=e.message;draw();}};list.append(b);
      });
      if(!list.childElementCount)list.textContent='沒有符合的目的地。';
    }
    search.oninput=draw;draw();
  }
  const prior=window.interactNPC;
  window.interactNPC=function(id,town){
    const r=prior.apply(this,arguments);if(stations[town]&&id==='npc_giran_travel_'+town&&town===mapState.current)show(town);
    return r;
  };
  return {stations,reason,travel};
})();
