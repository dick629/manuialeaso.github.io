'use strict';
window.GiranRadar=(()=>{
  function scene(){
    if(typeof mapState==='undefined')return null;
    const id=mapState.current;
    if(/^town_/.test(id)){
      const town=window.GiranTown,t=town?.terrain;
      return t?.key===id && t.camera && !t.pending && !t.resolving ? town : null;
    }
    const field=window.GiranCombat?.field;
    return field?.map===id&&field.ready()?field:null;
  }
  const charts=new WeakMap();
  function draw(canvas){
    const f=scene(),t=f?.terrain,p=f?.leader,surface=t?.canvas?.parentElement;
    if(!p||t?.kind!=='tiles'||!surface?.isConnected){
      if(charts.delete(canvas))canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      return;
    }
    const w=t.world,d=w.map.d,W=canvas.width,H=canvas.height,range=W>240?30:20,s=W/(range*4+2),v=s*.62;
    const stamp=[t.key,t.generation,w.groundRevision,W,H,t.loadingProgress?.done].join('/');
    let cached=charts.get(canvas);
    const project=(x,y)=>[W/2+((x-p.x)+(y-p.y))*s,H/2+((y-p.y)-(x-p.x))*v];
    if(cached?.stamp!==stamp||Math.max(Math.abs(p.x-cached.x),Math.abs(p.y-cached.y))>6){
      const base=cached?.base||document.createElement('canvas');
      const margin=7,mx=Math.ceil(2*margin*s),my=Math.ceil(2*margin*v);
      base.width=W+2*mx;base.height=H+2*my;
      const g=base.getContext('2d'),floor=new Path2D(),walls=new Path2D();
      g.fillStyle='#151b18';g.fillRect(0,0,base.width,base.height);
      g.translate(mx,my);
      for(let dy=-range-margin;dy<=range+margin;dy++)for(let dx=-range-margin;dx<=range+margin;dx++){
        const x=p.x+dx,y=p.y+dy,lx=x-d.gameX0,ly=y-d.gameY0;
        if(!w.hasGround(lx,ly))continue;
        const shape=w.pass(lx,ly)?floor:walls;const [cx,cy]=project(x,y);
        shape.moveTo(cx-s,cy);shape.lineTo(cx,cy-v);shape.lineTo(cx+s,cy);shape.lineTo(cx,cy+v);shape.closePath();
      }
      g.fillStyle='#2e382f';g.fill(walls);g.fillStyle='#52614b';g.fill(floor);
      cached={stamp,base,x:p.x,y:p.y,mx,my};charts.set(canvas,cached);
    }
    const g=canvas.getContext('2d');
    g.fillStyle='#151b18';g.fillRect(0,0,W,H);g.save();
    g.beginPath();g.moveTo(W/2,H/2-(2*range+1)*v);g.lineTo(W/2+(2*range+1)*s,H/2);
    g.lineTo(W/2,H/2+(2*range+1)*v);g.lineTo(W/2-(2*range+1)*s,H/2);g.closePath();g.clip();
    const [ox,oy]=project(cached.x,cached.y);
    g.drawImage(cached.base,ox-W/2-cached.mx,oy-H/2-cached.my);g.restore();
    const dot=(a,color,size)=>{if(!a)return;const [x,y]=project(a.fx??a.x,a.fy??a.y);g.fillStyle=color;g.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);};
    if(f===window.GiranTown){for(const u of f.units.values())if(!GiranPartyView.mobile()||u.el)dot(u.actor,'#88bfac',3);}
    else{
      for(const m of mapState.mobs)if(m&&!m._dead)dot(f.point(m),m.boss?'#ff9e60':'#dc7963',4);
      const allies=GiranPartyView.mobile()?GiranPartyView.visibleAllies():GiranPartyView.combatAllies();
      for(const a of allies)dot(f.point(a),'#88bfac',3);
    }
    for(const door of surface.querySelectorAll('.g-native-gate[data-map-x]')){
      const [x,y]=project(+door.dataset.mapX,+door.dataset.mapY);
      g.save();g.translate(x,y);g.rotate(Math.PI/4);g.strokeStyle='#91d7e4';g.lineWidth=1.5;g.strokeRect(-2,-2,4,4);g.restore();
    }
    g.save();g.translate(W/2,H/2);g.rotate(Math.PI/4);g.fillStyle='#ffe49c';g.strokeStyle='#2c230e';g.fillRect(-3,-3,6,6);g.strokeRect(-3,-3,6,6);g.restore();
  }
  function walk(canvas,event){
    const f=scene(),p=f?.leader;if(!p||f.terrain?.kind!=='tiles'||!f.terrain.canvas?.isConnected||document.body.classList.contains('giran-guest'))return;
    const rect=canvas.getBoundingClientRect(),W=canvas.width,H=canvas.height,s=W/((W>240?30:20)*4+2);
    const xx=((event.clientX-rect.left)*W/rect.width-W/2)/s,yy=((event.clientY-rect.top)*H/rect.height-H/2)/(s*.62);
    const to=[p.x+Math.round((xx-yy)/2),p.y+Math.round((xx+yy)/2)],w=f.terrain.world,d=w.map.d;
    if(!w.pass(to[0]-d.gameX0,to[1]-d.gameY0))return;
    if(f===window.GiranTown)f.command(to);
    else{if(GiranRoam.manual())GiranRoam.choose(null);f.walkTo(to);GiranHunt.anchor(to);}
    GiranUI.pane(null);
  }
  function mountDrops(radar) {
    const create=(tag,cls,text)=>{
      const el=document.createElement(tag);
      if(cls)el.className=cls;
      if(text!=null)el.textContent=text;
      return el;
    };
    const dock=create('div');dock.id='ga-radar-dock';
    const trigger=create('button','','本區掉寶');
    trigger.id='ga-area-drop-toggle';trigger.type='button';trigger.hidden=true;
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','ga-area-drops');
    const panel=create('section','ga-area-drops');panel.id='ga-area-drops';panel.hidden=true;
    panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','ga-area-drop-title');
    const header=create('header'),title=create('h2');title.id='ga-area-drop-title';
    const close=create('button','','×');close.type='button';close.setAttribute('aria-label','關閉本區掉寶');
    header.append(title,close);
    const list=create('div','ga-area-list');list.tabIndex=0;list.setAttribute('aria-label','怪物與掉落物');
    panel.append(header,create('p','ga-area-note','怪物基礎能力與專屬掉落率'),list);
    dock.append(radar,trigger);document.body.append(dock,panel);
    let key='',seen=new Map(),rows=[];
    function hide(focus){
      panel.hidden=true;trigger.setAttribute('aria-expanded','false');
      if(focus && !trigger.hidden)trigger.focus({preventScroll:true});
    }
    function paint(){
      const fragment=document.createDocumentFragment();
      for(const {mob,drops} of rows){
        const card=create('article','ga-area-monster'),stats=create('p','ga-area-stats');
        const data=[];
        if(mob.lv!=null)data.push('Lv.'+mob.lv);
        const size={S:'小型',M:'中型',L:'大型'}[mob.s];if(size)data.push(size);
        const weak=['fire','water','earth','wind'].find(el=>isElementCounter(el,mob.e));
        if(weak)data.push('弱'+({fire:'火',water:'水',earth:'地',wind:'風'}[weak]));
        if(mob.ac!=null)data.push('AC '+mob.ac);
        if(mob.hp!=null)data.push('HP '+mob.hp.toLocaleString());
        stats.textContent=data.join(' · ');
        card.append(create('h3','',mob.n),stats);
        const items=create('ul');
        for(const [id,name,pct,note,fixed] of drops){
          const li=create('li'),img=create('img');
          img.alt='';img.width=26;img.height=26;img.loading='lazy';img.decoding='async';
          img.addEventListener('error',()=>{img.style.visibility='hidden';},{once:true});
          img.src=getIconUrl(DB.items[id]);
          const desc=create('span','ga-area-item',name);
          const forced=typeof trialForced100==='function' && trialForced100(id);
          const notes=[note,forced?'對應試煉收集階段，尚未集滿':fixed?'固定機率':''].filter(Boolean);
          if(notes.length)desc.append(create('small','',notes.join(' · ')));
          li.append(img,desc,create('b','ga-area-rate',(forced?100:pct).toLocaleString('zh-TW',{maximumFractionDigits:10})+'%'));
          items.append(li);
        }
        card.append(items);fragment.append(card);
      }
      list.replaceChildren(fragment);
    }
    function sync(opening=false) {
      const map=mapState.current,api=window.AFK_DEX_API;
      const signature=map+'|'+(document.getElementById('battle-view')?.dataset.dmScene||'');
      const changed=key!==signature;
      if(changed){key=signature;seen.clear();list.scrollTop=0;}
      if(!map || /^town_/.test(map) || !api?.areaDrops){
        trigger.hidden=true;if(!panel.hidden)hide(false);return;
      }
      if(!opening && !changed && panel.hidden && !trigger.hidden)return;
      let added=false;
      for(const m of mapState.mobs || []){
        if(!m || m._dead || m.trollPlayer || seen.has(m.n))continue;
        seen.set(m.n,m);added=true;
      }
      if(!opening && !changed && !added)return;
      rows=api.areaDrops(map,seen.values(),opening);
      trigger.hidden=!rows.length;
      if(!rows.length){hide(false);return;}
      if(opening||!panel.hidden){
        title.textContent=(window.GiranUI?.placeName(map)||mapDisplayName(map))+' · 本區掉寶';
        paint();
      }
    }
    trigger.onclick=()=>{
      if(!panel.hidden){hide(true);return;}
      sync(true);if(trigger.hidden)return;
      panel.hidden=false;trigger.setAttribute('aria-expanded','true');close.focus({preventScroll:true});
    };
    close.onclick=()=>hide(true);
    return {sync,close:()=>hide(false)};
  }
  return {draw,walk,scene,mountDrops};
})();
