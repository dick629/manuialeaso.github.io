'use strict';
(() => {
  const game=document.getElementById('game-screen');
  const hud=document.createElement('nav');hud.id='giran-dock';hud.setAttribute('aria-label','冒險操作');
  const status=document.createElement('div');status.id='giran-vitals';status.innerHTML='<strong></strong><div><small>HP</small><meter min="0"></meter><span></span></div><div><small>MP</small><meter min="0"></meter><span></span></div>';
  status.children[1].className='ga-hp';status.children[2].className='ga-mp';
  status.children[1].querySelector('meter').setAttribute('aria-label','生命');
  status.children[2].querySelector('meter').setAttribute('aria-label','魔力');
  const captain=status.firstElementChild,meters=[...status.querySelectorAll("meter")];
  const nameButton=document.createElement('button'),nameEditor=document.createElement('span');
  nameButton.id='ga-captain-name';nameButton.type='button';nameButton.setAttribute('aria-label','修改角色名稱');
  nameEditor.hidden=true;captain.append(nameButton,nameEditor);
  nameButton.onclick=()=>{
    if(window._editingName)return;
    nameButton.hidden=true;nameEditor.hidden=false;startEditName(nameEditor);
  };
  for(const m of meters){
    const track=document.createElement('i');track.className='ga-vital-track';track.setAttribute('aria-hidden','true');m.before(track);
  }
  hud.append(status);
  const name=document.createElement('div');name.id='giran-location';name.innerHTML='<strong></strong><small></small>';document.body.append(name);
  const tools=document.createElement('div');tools.id='giran-tools';tools.className='g-window';tools.hidden=true;document.body.append(tools);
  let openedMap='';
  function pane(which){
    const same=document.body.dataset.giranPane===which;
    delete document.body.dataset.giranPane;
    if(!same && which)document.body.dataset.giranPane=which;
    openedMap=document.body.dataset.giranPane==='map'?mapState.current:'';
    for(const b of document.querySelectorAll('#giran-dock [data-pane],.ga-radar[data-pane]'))b.setAttribute('aria-expanded',String(document.body.dataset.giranPane===b.dataset.pane));
    tools.hidden=document.body.dataset.giranPane!=='room';
    window.GiranPanels?.show(document.body.dataset.giranPane||'');
  }
  const close=document.createElement('button');close.id='giran-close';close.type='button';close.textContent='關閉 ✕';close.onclick=()=>pane(null);document.body.append(close);
  function button(title,action,id,hotkey){
    const b=document.createElement('button');b.type='button';b.textContent=title;b.id=id;b.title=hotkey?title+'（'+hotkey+'）':title;b.onclick=action;hud.append(b);return b;
  }
  for(const [title,id,k] of [['地圖','map','M'],['隊伍','party','P'],['角色選單','menu','I'],['紀錄','log','L'],['多人','room','O'],['血盟','clan'],['功能','functions']]){
    const b=button(title,()=>pane(id),'giran-'+id,k);b.dataset.pane=id;b.setAttribute('aria-expanded','false');
  }
  button('黑市',()=>openPandoraShortcut(),'giran-market');
  document.body.append(hud);
  let lastKey='';
  function setText(el,text){if(el.textContent!==text)el.textContent=text;}
  function display(){
    if(document.hidden)return;
    const playing=!game.classList.contains('hidden') && typeof player!=='undefined' && !!player?.cls;
    document.body.classList.toggle('giran-running',playing);
    if(!playing){if(lastKey){pane(null);lastKey='';}return;}
    const key=mapState.current||'';
    if(key!==lastKey){if(document.body.dataset.giranPane==='map' && key!==openedMap)pane(null);lastKey=key;}
    setText(name.firstChild,placeName(key));
    setText(name.children[1],(1+GiranPartyView.combatAllies().filter(Boolean).length)+' / '+GiranPartyView.combatLimit+' 人');
    if(!nameEditor.hidden&&!window._editingName){
      nameEditor.replaceChildren();nameEditor.hidden=true;nameButton.hidden=false;
    }
    setText(nameButton,'隊長 '+(player.name||'點擊取名')+'　Lv.'+player.lv);
    for(const [i,cur,max] of [[1,player.hp,player.mhp||player.d?.mhp],[2,player.mp,player.mmp||player.d?.mmp]]){
      const m=meters[i-1],row=m.parentElement,limit=Math.max(1,max||cur||1);
      const value=Math.min(limit,Math.max(0,cur||0));
      if(m.max!==limit || m.value!==value || !row.style.getPropertyValue('--ga-fill')){
        m.max=limit;m.value=value;row.style.setProperty('--ga-fill',String(value/limit));
      }
      setText(row.lastChild,Math.floor(cur||0)+' / '+Math.floor(max||cur||0));
    }
  }
  window.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('giran-running') || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input,textarea,select,[contenteditable=true]'))return;
    const key=e.key.toLowerCase(),mapping={m:'map',p:'party',i:'menu',l:'log',o:'room'};
    if(mapping[key]){e.preventDefault();pane(mapping[key]);}
  });
  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.isComposing||e.repeat||!document.body.classList.contains('giran-running'))return;
    if(window.GiranPanels?.escapeWindow()){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('click',e=>{if(e.target.matches('#town-interaction-close'))pane(null);});
  new MutationObserver(display).observe(game,{attributes:true,attributeFilter:['class']});setInterval(display,450);
  window.GiranDiagnostics={record(type,message){
    try{
      const key='lineage_giran_events_v1';let log=[];
      try{const rows=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(rows))log=rows;}catch{}
      message=String(message).replace(/\b[A-F0-9]{12,36}\b/gi,'〔代碼〕').slice(0,300);
      const last=log.at(-1),now=Date.now();
      if(last?.type===type&&last.message===message&&now-Date.parse(last.time)<60000)return;
      log.push({time:new Date(now).toISOString(),type,message});localStorage.setItem(key,JSON.stringify(log.slice(-100)));
    }catch{}
  }};
  window.addEventListener('error',e=>{if(e.message)GiranDiagnostics.record('執行',e.message);});
  window.addEventListener('unhandledrejection',e=>GiranDiagnostics.record('非同步',e.reason?.message||e.reason));
  function placeName(key){
    const field=document.getElementById('battle-view'),native=mapDisplayName(key);
    return DB.towns[key]?.n || (field.dataset.dmMap===key&&field.dataset.giranPlace) ||
      (native!==key&&native) || window.AFK_HUNTING_FIELDS[key]?.art || '冒險區域';
  }
  window.GiranUI={pane,tools,display,placeName};display();
})();
