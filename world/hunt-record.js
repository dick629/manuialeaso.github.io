'use strict';
window.GiranHuntRecord=(()=>{
  // Stored with the character. Only game ticks that actually ran count as hunting time.
  const empty=()=>({ms:0,awayMs:0,kills:0,levels:0,exp:0,gold:0,items:{}});
  let awayOwner=null,awayId=0,remainingMs=0,lastAwayTick=-1;
  const hunting=key=>!!key&&!key.startsWith('town_');
  function ledger(){
    return player.giranHuntRecord||={maps:{},recent:''};
  }
  function entry(){
    if(!player?.cls||!state.running||window.__afk?.busy()||!hunting(mapState.current))return null;
    const log=ledger(),map=mapState.current;
    log.recent=map;
    return log.maps[map]||=empty();
  }
  function beginAway(){
    if(!player?.cls||!state.running)return;
    awayOwner=player;awayId=Date.now();remainingMs=0;lastAwayTick=-1;
    ledger().away={id:awayId,maps:{}};
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)beginAway();});
  function resume(ms){
    if(awayOwner!==player||!awayId)beginAway();
    remainingMs=Math.max(0,Number(ms)||0);
  }
  function handover(map,closeTs){
    if(awayOwner!==player||!awayId)beginAway();
    remainingMs=0;
    ledger().away.batch={map,closeTs};
  }
  function away(map){
    const log=ledger();
    if(log.away?.id!==awayId)log.away={id:awayId,maps:{}};
    return log.away.maps[map]||=empty();
  }
  function tick(ms){
    if(awayOwner!==player){awayId=0;remainingMs=0;lastAwayTick=-1;awayOwner=player;}
    if(window.__afk?.busy())return;
    if(document.hidden&&!awayId)beginAway();
    const background=document.hidden||remainingMs>=ms;
    remainingMs=Math.max(0,remainingMs-ms);
    lastAwayTick=background?state.ticks+1:-1;
    const row=entry();if(!row)return;
    row.ms+=ms;
    if(background){row.awayMs+=ms;away(mapState.current).ms+=ms;}
  }
  function kill(exp,levels,gold){
    const row=entry();if(!row)return;
    function count(r){r.kills++;r.exp+=exp;r.levels+=levels;r.gold+=gold;}
    count(row);
    if(awayOwner===player&&state.ticks===lastAwayTick)count(away(mapState.current));
  }
  function gain(id,count){
    const row=entry();if(!row)return;
    row.items[id]=(row.items[id]||0)+count;
    if(awayOwner===player&&state.ticks===lastAwayTick){
      const items=away(mapState.current).items;items[id]=(items[id]||0)+count;
    }
  }
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const time=ms=>{
    if(!Number.isFinite(ms))return '未記錄';
    const s=Math.floor(ms/1000);
    return (s>=3600?Math.floor(s/3600)+' 時 ':'')+(s>=60?Math.floor(s/60)%60+' 分 ':'')+s%60+' 秒';
  };
  function history(){
    try{
      const history=JSON.parse(localStorage.getItem('afk_hist_'+currentSlot)||'[]');
      return history.filter(r=>r&&(!r.roleSeed||r.roleSeed===player.enSeed));
    }catch{return [];}
  }
  function itemList(list,items){
    if(!items.length){list.replaceChildren(el('li','尚無道具紀錄','ga-empty'));return;}
    const existing=new Map(Array.from(list.children,n=>[n.dataset.id,n]));let previous=null;
    for(const item of items){
      const id=String(item.id||item.name),data=DB.items[item.id];
      let cell=existing.get(id);
      if(!cell){
        cell=el('li');cell.dataset.id=id;
        if(data){const url=getIconUrl(data);if(url){const icon=el('img');icon.src=url;icon.alt='';icon.loading='lazy';cell.append(icon);}}
        cell.append(el('span',data?.n||item.name),el('b'));
      }
      existing.delete(id);
      const count='× '+item.count.toLocaleString();if(cell.lastChild.textContent!==count)cell.lastChild.textContent=count;
      if(!previous&&list.firstChild!==cell)list.prepend(cell);
      else if(previous&&previous.nextSibling!==cell)previous.after(cell);
      previous=cell;
    }
    for(const node of existing.values())node.remove();
  }
  function mount(host,placeName){
    const shell=el('section',null,'ga-hunt-record'),toolbar=el('div',null,'ga-hunt-tools');
    const mode=el('select'),maps=el('select'),reset=el('button','重置本圖統計','ga-action');
    reset.type='button';mode.setAttribute('aria-label','掛機紀錄期間');maps.setAttribute('aria-label','掛機紀錄地圖');
    for(const [value,label] of [['live','本次狩獵'],['away','離開期間'],['offline','上次離線掛機']])mode.add(new Option(label,value));
    const report=el('div'),batch=el('div');toolbar.append(mode,maps);shell.append(toolbar,report,batch,reset);host.append(shell);
    let key='',signature='',itemSignature='';
    reset.onclick=()=>{
      const data=ledger();if(!Object.hasOwn(data.maps,key))return;
      data.maps[key]=empty();
      signature='';update();
    };
    mode.onchange=()=>{key='';signature='';update();};
    maps.onchange=()=>{key=maps.value;signature='';update();};
    function update(){
      const log=player.giranHuntRecord,batches=history(),ref=log?.away?.batch;
      const fast=ref&&batches.find(r=>r.source==='background'&&r.closeTs===ref.closeTs);
      const offline=mode.value==='offline',background=mode.value==='away';
      const records=(background?log?.away?.maps:log?.maps)||{},keys=Object.keys(records);
      if(background&&fast&&!keys.includes(ref.map))keys.push(ref.map);
      const preferred=hunting(mapState.current)?mapState.current:log?.recent;
      if(!keys.includes(key))key=keys.includes(preferred)?preferred:keys.at(-1)||'';
      const opts=keys.join('|');
      if(maps.dataset.keys!==opts){maps.replaceChildren(...keys.map(k=>new Option(placeName(k),k)));maps.dataset.keys=opts;}
      maps.hidden=offline||keys.length<2;if(key)maps.value=key;
      const native=batches.find(r=>r.source!=='background'),record=offline?native:records[key];
      const map=offline?native?.map:key?placeName(key):null;
      const fastMatch=background&&fast&&ref.map===key;
      if(fastMatch){
        const stamp=[fast.closeTs,fast.settledMs,fast.checkpoint].join('/');
        if(batch.dataset.stamp!==stamp){
          batch.dataset.stamp=stamp;
          const stats=el('dl',null,'ga-hunt-stats'),items=el('ul',null,'ga-hunt-items');
          const metric=(label,value)=>{const pair=el('div');pair.append(el('dt',label),el('dd',value));stats.append(pair);};
          metric('結算時間',time(fast.settledMs));metric('擊殺',fast.kills.reduce((n,r)=>n+r.cnt,0).toLocaleString());
          metric('經驗',fast.exp.toLocaleString());metric('金幣淨額',fast.gold.toLocaleString());
          metric('升級',fast.lv.toLocaleString());metric('狀態',fast.checkpoint?'結算中':fast.died?'陣亡':'已結算');
          itemList(items,fast.items.map(r=>({id:r.id,name:r.n,count:r.cnt})));
          batch.replaceChildren(el('h3',placeName(ref.map)+'・離開期間快轉','ga-hunt-phase'),stats,el('h4','背包淨增加道具'),items);
        }
      }else if(batch.childElementCount){batch.replaceChildren();delete batch.dataset.stamp;}
      reset.hidden=mode.value!=='live'||!record;
      if(!record){
        const emptyKey=mode.value+'/empty';
        if(fastMatch){signature='';itemSignature='';report.replaceChildren();return;}
        if(signature!==emptyKey){signature=emptyKey;itemSignature='';report.replaceChildren(el('p',offline?'此存檔尚無離線結算紀錄。':background?'尚無離開畫面後的狩獵紀錄。':'進入狩獵地圖後開始記錄。','ga-empty'));}
        return;
      }
      const ms=offline?record.settledMs:record.ms;
      const kills=offline?(record.kills||[]).reduce((sum,r)=>sum+r.cnt,0):record.kills;
      const levels=offline?record.lv:record.levels;
      const drops=offline?(record.items||[]).map(r=>({id:r.id,name:r.n,count:r.cnt})):
        Object.entries(record.items).map(([id,count])=>({id,count,name:id})).sort((a,b)=>b.count-a.count);
      const status=offline?(record.died?'陣亡':record.checkpoint?'結算中':record.source?'已結算':'舊版結算'):
        background?(document.hidden?'進行中':'已結算'):key===mapState.current&&state.running&&!player.dead?'進行中':'已暫停';
      const next=JSON.stringify([mode.value,map,Math.floor(ms/1000),kills,levels,record.exp,record.gold,Math.floor((record.awayMs||0)/1000),status,drops]);
      if(signature===next)return;signature=next;
      const heading=el('div',null,'ga-hunt-heading'),stats=el('dl',null,'ga-hunt-stats');
      heading.append(el('h3',map||'地圖未記'),el('span',status));
      const stat=(label,value)=>{const pair=el('div');pair.append(el('dt',label),el('dd',value));stats.append(pair);};
      const number=n=>Number.isFinite(n)?n.toLocaleString():'未記錄';
      const rate=n=>ms>0&&Number.isFinite(n)?number(Math.round(n*600000/ms)):'—';
      stat(offline?'結算時間':'狩獵時間',time(ms));
      if(offline)stat(record.source?'實際離線時間':'紀錄時長',time(record.realMs));
      else if(!background)stat('其中離開畫面',time(record.awayMs));
      stat('擊殺',number(kills));stat('升級',number(levels));stat('獲得經驗',number(record.exp));stat(offline?'金幣淨額':'掉落金幣',number(record.gold));
      stat('每 10 分鐘經驗',rate(record.exp));stat('每 10 分鐘金幣',rate(record.gold));
      if(report.querySelector('.ga-hunt-stats')){
        report.children[0].replaceWith(heading);report.children[1].replaceWith(stats);
      }else report.replaceChildren(heading,stats,el('h4'),el('ul',null,'ga-hunt-items'));
      const itemKey=mode.value+'/'+JSON.stringify(drops);
      if(itemSignature!==itemKey){
        itemSignature=itemKey;report.children[2].textContent=offline?'背包淨增加道具':'獲得道具';
        itemList(report.children[3],drops);
      }
    }
    update();return update;
  }
  return {tick,kill,gain,resume,handover,mount};
})();
