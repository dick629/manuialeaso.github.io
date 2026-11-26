'use strict';
window.GiranFieldUI=(()=>{
  const panel=document.getElementById('map-view-panel');
  const tools=document.createElement('div');tools.className='g-field-orders';tools.setAttribute('role','group');tools.setAttribute('aria-label','隊長攻擊方式');
  const buttons=new Map();
  for(const [value,title,tip] of [['manual','選怪攻擊','點一隻怪物，全隊追擊。擊倒後停手。'],['auto','自動狩獵','隊長會巡行、尋敵並帶隊交戰。']]){
    const b=document.createElement('button');b.type='button';b.dataset.huntMode=value;b.textContent=title;b.title=tip;
    b.onclick=e=>{e.stopPropagation();GiranRoam.mode(value);};
    tools.append(b);buttons.set(value,b);
  }
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='ga-hunt-toggle';toggle.setAttribute('aria-label','自動狩獵');
  const icon=document.createElement('i');icon.className='ga-ico ga-hunt-icon';icon.setAttribute('aria-hidden','true');
  const caption=document.createElement('span');toggle.append(icon,caption);
  toggle.onclick=()=>GiranRoam.mode(GiranRoam.manual()?'auto':'manual');
  tools.append(toggle);
  const target=document.createElement('output');target.className='g-field-focus';tools.append(target);
  const progress=document.createElement('span');progress.className='g-stream';progress.setAttribute('role','status');progress.hidden=true;
  panel.append(tools,progress);
  function refresh(){
    if(typeof player==='undefined'||!player?.cls)return;
    const manual=GiranRoam.manual();
    buttons.forEach((b,key)=>{const pressed=String((key==='manual')===manual);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);});
    if(toggle.getAttribute('aria-pressed')!==String(!manual)){
      toggle.setAttribute('aria-pressed',String(!manual));caption.textContent=manual?'選怪':'自動';
      toggle.title=manual?'切換為自動狩獵':'切換為選怪攻擊';
    }
    const m=typeof mapState==='object'&&mapState.mobs?.[mapState.targetIdx];
    const name=!mapState.current?.startsWith('town_')&&m&&!m._dead&&m.curHp>0?m.n:'';
    const info=name?'鎖定 '+name:!mapState.current?.startsWith('town_')?(GiranCombat.field?.followingBoss?'前往首領棲地':manual?'點選地圖上的怪物':'巡行尋敵'):(manual?'出城後選怪攻擊':'出城後自動狩獵');
    if(target.textContent!==info)target.textContent=info;
    if(target.hidden!==!info)target.hidden=!info;
  }
  function update(terrain){
    refresh();
    const entering=!!(terrain.kind==='loading'||terrain.pending||terrain.resolving),info=terrain.loadingProgress,busy=!!(entering||info?.need&&info.done<info.need);
    panel.classList.toggle('g-entering',entering);
    if(panel.getAttribute('aria-busy')!==String(busy))panel.setAttribute('aria-busy',String(busy));
    const label=busy?(info?.failed||terrain.loadFailure?'重新讀取地形':info?.need?'載入地形 '+info.done+' / '+info.need:'載入地圖'):'';
    if(progress.textContent!==label)progress.textContent=label;
    if(progress.hidden!==!busy)progress.hidden=!busy;
  }
  const marks=new WeakMap();
  function clearMark(host){marks.get(host)?.remove();}
  function mark(host,terrain,actor,height,visible,labelBands){
    let node=marks.get(host);
    if(!node){node=document.createElement('div');node.className='g-captain-mark';node.append(document.createElement('b'));marks.set(host,node);}
    if(node.parentNode!==host)host.append(node);
    const name='♛ 隊長・'+(player.name||DB.classes?.[player.cls]?.n||'冒險者');
    if(node.firstChild.textContent!==name){node.firstChild.textContent=name;node.setAttribute('aria-label',name);}
    const [x,y]=terrain.project(actor.fx,actor.fy);
    const dx=Math.round(x),dy=Math.round(y);
    const head=Math.max(1,Math.round(height)||64);
    _renderCaptainVitals(node,head,visible);
    let bottom=y-(node.captainVitals?head+20:Math.max(30,Math.min(125,head))+6);
    if(labelBands)for(const nameBottom of labelBands.sort((a,b)=>b-a)){
      if(bottom>nameBottom-24&&bottom-25<nameBottom)bottom=nameBottom-26;
    }
    const labelHeight=Math.round(y-bottom);
    if(node.dmX!==dx){node.style.left=dx+'px';node.dmX=dx;}
    if(node.dmY!==dy){node.style.top=dy+'px';node.dmY=dy;}
    if(node.dmHead!==labelHeight){node.style.setProperty('--captain-head',labelHeight+'px');node.dmHead=labelHeight;}
  }
  return {update,refresh,mark,clearMark,tools};
})();
