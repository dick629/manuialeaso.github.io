'use strict';
(() => {
  const $=id=>document.getElementById(id),dock=$('giran-dock'),place=$('giran-location'),tools=GiranUI.tools;
  const make=(tag,cls,words)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(words!=null)el.textContent=words;return el;};
  const button=(text,fn,cls='')=>{const b=make('button',cls,text);b.type='button';b.onclick=fn;return b;};
  const titles={map:'世界地圖',chat:'對話',party:'遠征隊伍',menu:'角色手冊',log:'紀錄',room:'多人會所',bag:'道具背包',skills:'技能書',clan:'血盟',functions:'功能',settings:'遊戲設定'};
  const glyph={map:'⌖',chat:'✉',party:'♜',log:'☷',room:'⚑',functions:'⚙',clan:'♛',market:'◆'};
  const names={party:'隊伍',menu:'角色',log:'紀錄',room:'多人',clan:'血盟',market:'黑市',functions:'功能'};
  const tabs=make('div','ga-tabs'),content=make('div','ga-content'),bar=make('header','ga-heading');
  const win=make('section','ga-window');win.id='giran-console';win.hidden=true;win.setAttribute('role','dialog');win.setAttribute('aria-labelledby','ga-title');
  const title=make('h2');title.id='ga-title';const close=$('giran-close');close.textContent='×';close.setAttribute('aria-label','關閉視窗');
  const emblem=make('i','ga-emblem');emblem.setAttribute('aria-hidden','true');bar.append(emblem,title,close);win.append(bar,tabs,content);document.body.append(win);
  const quick=make('div','ga-commands'),extra=make('div','ga-secondary');
  const compact=matchMedia('(max-width:1100px), (max-height:520px) and (max-width:1100px)');
  extra.id='ga-more-actions';extra.setAttribute('aria-label','更多操作');
  let drawerOpen=false;
  function drawer(open,returnFocus=false){
    drawerOpen=!!open && (compact.matches||GiranPartyView.mobile());
    dock.classList.toggle('ga-more-open',drawerOpen);
    more.setAttribute('aria-expanded',String(drawerOpen));
    if(drawerOpen)extra.querySelector('button')?.focus({preventScroll:true});
    else if(returnFocus)more.focus({preventScroll:true});
  }
  const more=button('更多',()=>{
    if(!drawerOpen && document.body.dataset.giranPane)GiranUI.pane(null);
    drawer(!drawerOpen);
  },'ga-more');
  const dots=make('i','ga-ico ga-more-icon','•••');dots.setAttribute('aria-hidden','true');more.prepend(dots);
  more.setAttribute('aria-label','更多');
  more.setAttribute('aria-controls',extra.id);more.setAttribute('aria-expanded','false');
  for(const [id,title] of Object.entries(names)){
    const b=$('giran-'+id);if(!b)continue;
    const icon=make('i','ga-ico ico-'+id,glyph[id]||'');icon.setAttribute('aria-hidden','true');
    b.replaceChildren(icon,make('span','',title));b.setAttribute('aria-label',id==='menu'?'角色選單':title);(id==='party'||id==='log'?quick:extra).append(b);
  }
  dock.append(quick,extra,more);
  const profile=make('span','ga-portrait');profile.setAttribute('aria-hidden','true');dock.prepend(profile);
  const pilot=make('div','ga-pilot'),identity=make('div','ga-pilot-info');
  const xpBar=$('bar-exp').parentElement;xpBar.title='角色經驗進度';xpBar.setAttribute('aria-label','角色經驗進度');
  dock.prepend(pilot);identity.append($('giran-vitals').firstElementChild,xpBar);pilot.append(profile,identity);
  const orders=GiranFieldUI.tools;dock.insertBefore(orders,quick);
  const actions=make('div','ga-quick-actions');
  const bag=button('道具',()=>GiranUI.pane('bag'),'ga-bag'),skills=button('技能',()=>GiranUI.pane('skills'),'ga-skills');
  bag.prepend(make('i','ga-ico ico-bag'));skills.prepend(make('i','ga-ico ico-skills'));actions.append(bag,skills);dock.insertBefore(actions,quick);
  const nav=make('div','ga-nav-keys');nav.setAttribute('role','group');nav.setAttribute('aria-label','冒險功能');dock.insertBefore(nav,actions);nav.append(actions,quick,extra);
  for(const [id,label] of [['map','地圖'],['chat','對話']]){
    const launch=button(label,()=>GiranUI.pane(id),'ga-phone-action');
    launch.dataset.pane=id;launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-controls',win.id);
    const icon=make('i','ga-ico',glyph[id]);icon.setAttribute('aria-hidden','true');launch.prepend(icon);actions.append(launch);
  }
  const hotDock=make('div','ga-hot-dock');hotDock.id='ga-hot-dock';dock.insertBefore(hotDock,nav);
  const journey=button('出發',()=>{
    if(player.dead||document.body.classList.contains('giran-guest'))return;
    if(GiranPartyView.mobile()&&document.body.dataset.giranPane)GiranUI.pane(null);
    if(state.riftRun&&mapState.current==='rift_battle')riftEvacuate();
    else if(mapState.current.startsWith('town_'))departToLastBattle();
    else returnToTown();
  },'ga-journey');journey.id='giran-journey';dock.insertBefore(journey,nav);
  const recovery=make('section','ga-recovery'),deathHint=make('p'),deathButtons=make('div');
  const localRevive=$('btn-revive-inplace'),townRevive=$('btn-revive');
  recovery.hidden=true;recovery.setAttribute('aria-label','隊長倒地');recovery.setAttribute('role','group');
  deathButtons.append(localRevive,townRevive);recovery.append(make('strong','','隊長倒地'),deathHint,deathButtons);
  document.body.append(recovery);
  function recoveryControls(downed){
    recovery.hidden=!downed;journey.hidden=downed;
    if(!downed)return;
    updateReviveInPlaceBtn();
    const canRevive=!localRevive.classList.contains('hidden')&&!player._afkCharmDoomed;
    localRevive.disabled=!canRevive;
    const skill=DB.skills.sk_resurrection,mp=skill?player.d.getMpCost(skill.mp,skill.tier):Infinity;
    const useSkill=player.skills.includes('sk_resurrection')&&player.mp>=mp;
    const home=reviveTownDestination();
    townRevive.classList.remove('hidden');townRevive.textContent='回城復活';
    localRevive.textContent=useSkill?'施放返生術':'使用復活卷軸';
    const cost=useSkill?'消耗 '+mp+' MP':'消耗 1 張復活卷軸';
    const cause=player._afkCharmDoomed?'迷魅反噬須回城復活。':window.__afkRevive?.blocked()?'此地的原地復活次數已用完。':player.reviveScrollCd>0?'復活仍在冷卻。':'目前沒有可用的返生術或復活卷軸。';
    deathHint.textContent=(canRevive?'原地復活'+cost+'。':cause)+'回城可在'+GiranUI.placeName(home)+'免費復活倒地隊員。';
  }
  if(window.AFK_SCREEN){
    const sleep=button('',()=>AFK_SCREEN.start(),'ga-phone-action ga-sleep');
    sleep.setAttribute('aria-label','休眠掛網');sleep.title='休眠掛網';
    const moon=make('i','','☾');moon.setAttribute('aria-hidden','true');
    sleep.append(moon);$('giran-vitals').prepend(sleep);
  }
  const character=$('giran-menu'),party=$('giran-party'),record=$('giran-log');
  const settings=button('',()=>GiranUI.pane('settings'),'ga-phone-action');
  settings.dataset.pane='settings';settings.setAttribute('aria-expanded','false');settings.setAttribute('aria-controls',win.id);
  const potionIcon=make('img','ga-ico ga-potion-icon');potionIcon.alt='';potionIcon.src='assets/icons/items/紅色藥水.png';
  settings.append(potionIcon,make('span','','設定'));settings.title='遊戲設定';
  content.addEventListener('change',e=>{
    if(pane==='settings'&&e.target.matches('#set-pot,#set-hp-pot,#set-auto-buy-pot'))saveGame();
  });
  function arrangePhone(){
    const hadQuickSettings=settings.isConnected;
    arrangeStatuses();
    if(GiranPartyView.mobile()){
      if(character.parentElement!==actions){
        extra.prepend(skills,party,record);
        actions.append(character,bag,settings);
      }
    }else{
      if(character.parentElement===actions){
        settings.remove();
        actions.prepend(bag,skills);quick.append(party,record);extra.prepend(character);
      }
      if(pane==='chat'||pane==='settings')GiranUI.pane(null);
    }
    if(pane==='map')mapPage();
    if(pane==='functions' && hadQuickSettings!==settings.isConnected)show('functions');
    drawer(false);
  }
  compact.addEventListener('change',()=>drawer(false));
  document.addEventListener('pointerdown',e=>{if(drawerOpen&&!extra.contains(e.target)&&!more.contains(e.target))drawer(false);},true);
  document.addEventListener('keydown',e=>{
    if(drawerOpen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();drawer(false,true);}
  },true);
  extra.addEventListener('click',e=>{if(e.target.closest('button'))drawer(false);});
  const radar=$('giran-map');radar.replaceChildren();radar.className='ga-radar';radar.setAttribute('aria-label','展開附近地圖');radar.title='世界地圖（M）';
  const mini=make('canvas');mini.width=224;mini.height=139;const coord=make('small');radar.append(mini,coord);
  const areaDrops=GiranRadar.mountDrops(radar);
  const panel=$('map-view-panel');let pane='',tab='',expandedChart=null,mapRegion='',lastFocus=null;
  const portrait=make('img','ga-face');portrait.alt='';portrait.hidden=true;
  portrait.onload=()=>{portrait.hidden=false;};portrait.onerror=()=>{portrait.hidden=true;};profile.append(portrait);
  const homes=[];
  function mount(el,where,extra=''){
    if(!el)return;
    const holder=document.createComment('giran control');el.before(holder);homes.push({el,holder,extra});where.append(el);
    if(extra)el.classList.add(extra);
  }
  function restore(){
    const doll=$('equipment-window');
    if(content.contains($('tab-audit')))$('tab-audit').classList.add('hidden');
    if(content.contains(doll)){doll.classList.add('hidden');doll.setAttribute('aria-hidden','true');}
    while(homes.length){const {el,holder,extra}=homes.pop();if(extra)el.classList.remove(extra);if(holder.parentNode)holder.replaceWith(el);}expandedChart=null;}
  function reset(next=''){restore();tab=next;tabs.replaceChildren();content.replaceChildren();content.scrollTop=0;}
  function selectTabs(choices,selected,fn){
    tabs.replaceChildren();for(const [id,n] of choices){const b=button(n,()=>fn(id));b.dataset.section=id;b.setAttribute('aria-pressed',String(id===selected));tabs.append(b);}
  }
  function locationName(k){
    return DB.towns?.[k]?.n||mapEntryOf(k)?.t||AFK_HUNTING_FIELDS[k]?.art||((v)=>v!==k?v:'冒險區域')(mapDisplayName(k));
  }
  function label(value,word){const box=make('div','ga-readout');box.append(make('small','',word),make('b','',value));return box;}
  function subsection(text){return make('h3','ga-subhead',text);}
  function simpleAction(title,func){return button(title,func,'ga-action');}
  function mapPage(){
    reset('world');mapTabs('world');
    const f=GiranRadar.scene(),land=make('div','ga-atlas');expandedChart=make('canvas');expandedChart.width=440;expandedChart.height=176;
    expandedChart.setAttribute('aria-label','附近地形，點可走的地面帶隊前進');expandedChart.onclick=e=>GiranRadar.walk(expandedChart,e);
    const legend=make('div','ga-legend');legend.append(make('span','captain','◆ 隊長'),make('span','ally','▪ 隊員'),make('span','enemy','▪ 怪物'));
    legend.append(make('span','gate','◇ 出口'));land.append(expandedChart,legend);content.append(land);
    const current=make('div','ga-locline');current.append(make('strong','',locationName(mapState.current)),make('span','',f?.leader?f.leader.x+'，'+f.leader.y:''));content.append(current);
    if(GiranPartyView.mobile()){land.before(current);mount($('ga-area-drop-toggle'),current);areaDrops.sync();}
    GiranRadar.draw(expandedChart);
    const home=f?.terrain && f.leader && window.GiranBossRooms?.nearest(f.terrain,f.leader);
    if(home && f.followBoss && !document.body.classList.contains('giran-guest')){
      const guide=simpleAction('帶隊前往'+home.name+'棲地',()=>{if(f.followBoss())GiranUI.pane(null);});
      guide.dataset.bossGuide=home.id;content.append(guide);
    }
    const host=f?.terrain.canvas.parentElement;
    if(host && f.leader && !document.body.classList.contains('giran-guest')){
      const linked=[...host.querySelectorAll('.g-native-gate[data-map-x]')].map(b=>({b,dist:Math.max(Math.abs(+b.dataset.mapX-f.leader.x),Math.abs(+b.dataset.mapY-f.leader.y))})).sort((a,b)=>a.dist-b.dist).slice(0,4);
      const exits=make('div','ga-actions'),walk=b=>{GiranUI.pane(null);b.click();};
      if(f===window.GiranTown && GiranGates.outside(f.terrain,f.leader)){
        const status=make('output');status.hidden=true;
        exits.append(simpleAction('步行出村',()=>{
          if(f.walkOut()){GiranUI.pane(null);return;}
          status.textContent='附近暫時找不到出村路線，可以點地面移動或選擇下方目的地。';status.hidden=false;
        }),status);
      }
      for(const {b,dist} of linked){const name=b.querySelector('b').textContent;
        exits.append(simpleAction('走向'+name+'（'+dist+' 格）',()=>walk(b)));}
      if(exits.children.length)content.append(subsection('附近出口'),exits);
    }
    const travelActions=make('div','ga-actions');
    if(GiranBookmarks.canTravel()){
      travelActions.append(simpleAction('使用瞬間移動卷軸',()=>playerTeleport(true)));
      const hidden=HIDDEN_AREA_PARENT[mapState.current];
      if(hidden)travelActions.append(simpleAction('進入'+HIDDEN_AREA_NAMES[hidden],()=>GiranBookmarks.enterPassage(hidden)));
    }
    const held=window.__afkCastleWar?.held()||[],homeCastle=window.__afkCastleWar?.homeCity();
    if(homeCastle&&held.length&&!player.dead&&!document.body.classList.contains('giran-guest')){
      if(held.length>1){const castles=make('select');castles.setAttribute('aria-label','回城堡的目的地');
        for(const city of held)castles.add(new Option(SIEGE_CITY[city].castleName,city));castles.value=homeCastle;
        castles.onchange=()=>{if(window.__afkCastleWar.setHome(castles.value))mapPage();};travelActions.append(castles);}
      travelActions.append(simpleAction('回自選城堡・'+SIEGE_CITY[homeCastle].castleName,()=>returnToTown(true)));
    }content.append(travelActions);
    travelActions.addEventListener('click',event=>{if(event.target.closest('button'))GiranUI.pane(null);},true);
    const destinations=make('section','ga-travel-list'),destinationTitle=make('h3','','地區與目的地');
    destinationTitle.id='ga-destination-title';destinations.setAttribute('aria-labelledby',destinationTitle.id);
    destinations.append(destinationTitle);content.append(destinations);
    const filters=make('div','ga-search'),region=make('select'),find=make('input');region.setAttribute('aria-label','選擇地區');find.type='search';find.placeholder='搜尋村莊、地監或戰場';find.setAttribute('aria-label','搜尋地圖');
    rebuildMapCategoryOptions();const regions=[...$('map-category').options].map(o=>({key:o.value,label:o.textContent}));
    region.add(new Option('全部地區',''));for(const r of regions)region.add(new Option(r.label,r.key));
    region.value=mapRegion||mapRegionOf(mapState.current)||'';filters.append(region,find);destinations.append(filters);
    const rows=make('div','ga-destinations');destinations.append(rows);
    function list(){
      rows.replaceChildren();const term=find.value.trim(),rs=term?regions:regions.filter(r=>!region.value||r.key===region.value);
      for(const group of rs){for(const m of regionMapList(group.key)){
        if(!m?.v||(m.classicHide&&player.classicMode)||(term&&!m.t.includes(term)))continue;
        const active=m.v===mapState.current,reason=GiranBookmarks.mapReason(m,true),locked=!!reason;
        const b=button('',()=>{if(active||document.body.classList.contains('giran-guest')||mapOptDisabled(m))return;if(GiranBookmarks.goToMap(m))GiranUI.pane(null);});
        b.dataset.to=m.v;b.disabled=active||!!locked;b.classList.toggle('ga-current',active);
        b.append(make('span','',m.t),make('small','',active?'所在位置':locked?reason:'直接前往'));rows.append(b);
      }}
      if(!rows.children.length)rows.append(make('p','ga-empty','找不到符合的地點。'));
    }
    region.onchange=()=>{mapRegion=region.value;list();};find.oninput=list;list();GiranRadar.draw(expandedChart);
  }
  function mapTabs(selected){selectTabs([['world','地圖與出口'],['guides','任務與副本']],selected,id=>id==='world'?mapPage():guidePage());}
  function guidePage(){
    reset('guides');mapTabs('guides');GiranDirectory.guides(content);
  }
  function className(p){return DB.classes?.[p.cls]?.n||DB.classes?.[p.cls]?.name||({royal:'王族',knight:'騎士',elf:'妖精',mage:'法師',dark:'黑暗妖精',dragon:'龍騎士',illusion:'幻術士',warrior:'戰士'})[p.cls]||'隊員';}
  let selectedMember=null, gearPage=0;
  function paintMember(){
    const gear=window.__afkAllyGear;
    if(!selectedMember || !gear)return;
    for(const section of content.querySelectorAll('.ga-member-detail details[open]')){
      const body=section.lastElementChild;
      const html=section.dataset.section==='member-gear'?gear.gearHtml(selectedMember,gearPage):gear.abilityHtml(selectedMember,false);
      if(body.lastHtml!==html){body.lastHtml=html;body.innerHTML=html;}
    }
  }
  function inspectMember(slot){
    const who=slot==='hero'||String(slot)===String(currentSlot)?player:player.allies.find(p=>p&&String(p._slot)===String(slot));
    if(who){if(pane!=='party')GiranUI.pane('party');teamPage('buffs',who);}
  }
  const pickPixel=document.createElement('canvas');pickPixel.width=pickPixel.height=1;
  const pickContext=pickPixel.getContext('2d',{willReadFrequently:true});
  panel.addEventListener('click',e=>{
    if(!document.body.classList.contains('giran-running')||document.body.classList.contains('giran-guest')||
       e.target.closest('button,input,select,a,.town-npc,.mob-target,.g-field-exits'))return;
    const scene=e.target.closest('#town-npc-map,#battle-view');if(!scene)return;
    // Keep NPCs, doors and attack targets native hit targets. Only a click on
    // painted character pixels can replace the ordinary ground movement order.
    const hits=[];
    for(const img of scene.querySelectorAll('.g-town-unit>img,.party-sprite>.pm-body,#player-morph-sprite>.pm-body')){
      const r=img.getBoundingClientRect();
      if(!img.naturalWidth||!r.width||!r.height||e.clientX<r.left||e.clientX>=r.right||e.clientY<r.top||e.clientY>=r.bottom)continue;
      const x=Math.floor((e.clientX-r.left)*img.naturalWidth/r.width),y=Math.floor((e.clientY-r.top)*img.naturalHeight/r.height);
      pickContext.clearRect(0,0,1,1);pickContext.drawImage(img,x,y,1,1,0,0,1,1);
      if(pickContext.getImageData(0,0,1,1).data[3]>=128)hits.push(img.parentElement);
    }
    const unit=hits.sort((a,b)=>(Number(b.style.zIndex)||0)-(Number(a.style.zIndex)||0))[0];if(!unit)return;
    const slot=unit.dataset.memberSlot||unit.dataset.slot?.replace(/^a/,'')||'hero';
    e.preventDefault();e.stopPropagation();inspectMember(slot);
  },true);
  const teamChoices=[['roster','隊伍成員'],['buffs','隊員資料與增益'],['orders','技能指令']];
  function teamPage(id='roster',member=null){
    reset(id);selectedMember=member;selectTabs(teamChoices,id,teamPage);
    if(id==='buffs'){
      const picker=make('select');picker.setAttribute('aria-label','查看增益的隊員');picker.add(new Option('全隊',''));
      const members=[player,...(player.allies||[]).filter(Boolean)];
      for(const [i,p] of members.entries()){picker.add(new Option((i?'':'♛ ')+(p.name||p._allyName||className(p)),String(i)));if(p===member)picker.value=String(i);}
      picker.onchange=()=>teamPage('buffs',picker.value===''?null:members[Number(picker.value)]);
      content.append(picker);
      if(member){
        gearPage=0;
        const detail=make('div','ga-member-detail');
        for(const [key,label] of [['member-stats','能力'],['member-gear','裝備']]){
          const section=make('details');section.dataset.section=key;
          section.append(make('summary','',label),make('div'));
          section.ontoggle=paintMember;detail.append(section);
        }
        detail.onclick=e=>{const b=e.target.closest('[data-pi-page]');if(b){gearPage=Number(b.dataset.piPage);paintMember();}};
        content.append(detail,subsection('生效增益'));
      }
      const list=make('div','ga-bufflist');content.append(list);GiranPartyEffects.paint(list,member);
      if(member&&member!==player&&_allyManagerInTown())content.append(simpleAction('管理隊員裝備',()=>{
        const el=$('interaction-content');reset('gear');selectTabs([['buffs','返回隊員增益']],'',()=>teamPage('buffs',member));
        mount(el,content,'ga-native-body');openAllyEquipmentManager(member._slot);
      }));return;
    }
    const kind=id==='orders'?'skill':'team';
    if(kind==='team'){
      const heading=make('div','ga-locline ga-party-lineup');
      heading.append(make('strong'),make('span'));
      content.append(heading);
      const lead=make('div','ga-unit is-captain');lead.append(make('strong','','♛ '+(player.name||className(player))+'　隊長'),make('div','ga-unit-info',className(player)+'　Lv. '+player.lv),make('small','ga-lead-vitals'),button('查看隊長',()=>inspectMember('hero'),'ga-mini-action'));content.append(lead);
      updateCaptain();
    }
    switchSquadTab(kind);renderSquadPanel();const el=$('squad-tab-'+kind);mount(el,content,'ga-native-body');
    if(kind==='skill'&&!el?.children.length)content.append(make('p','ga-empty','編入隊員後可設定技能指令。'));
  }
  function updateCaptain(){
    const heading=content.querySelector('.ga-party-lineup'),stats=content.querySelector('.ga-lead-vitals');
    if(heading){
      const count=1+(player.allies||[]).filter(Boolean).length,shown=Math.min(count,GiranPartyView.limit),active=Math.min(count,GiranPartyView.combatLimit);
      const total=active+' / '+GiranPartyView.combatLimit+' 人',detail='顯示 '+shown+' 人・參戰 '+active+' 人'+(count>active?'・後備 '+(count-active)+' 人':'');
      if(heading.firstChild.textContent!==total)heading.firstChild.textContent=total;
      if(heading.lastChild.textContent!==detail)heading.lastChild.textContent=detail;
    }
    if(stats)stats.textContent='HP '+player.hp+' / '+player.mhp+'　MP '+player.mp+' / '+player.mmp;
  }
  $('squad-tab-team').addEventListener('click',e=>{
    const link=e.target.closest('[data-member-buffs]');if(!link)return;
    e.stopPropagation();inspectMember(link.dataset.memberBuffs);
  });
  function nativeTab(t){
    const old=[...document.querySelectorAll('.tab-bar button')].find(b=>(b.getAttribute('onclick')||'').includes("switchTab('"+t+"'"));
    if(old)old.click();else switchTab(t,tabs.firstElementChild||quick.firstElementChild);
    const original=$('tab-'+t);mount(original,content,'ga-native-body');
    if(t==='skill')window.LineageClassUI?.tabSkills();
  }
  const charTabs=[['summary','能力'],['equip','穿戴']];
  function balances(){
    const dragon=window.pandoraGetSharedDiamonds?.()??0;
    const blood=(player.inv||[]).filter(it=>it.id==='afk_blood_dia').reduce((sum,it)=>sum+(it.cnt??1),0);
    for(const [key,value] of [['dragon',dragon],['blood',blood]]){
      const b=content.querySelector('[data-wallet="'+key+'"] b');
      if(b&&b.textContent!==value.toLocaleString())b.textContent=value.toLocaleString();
    }
  }
  function equipment(){
    const controls=make('div','ga-equip-views');controls.setAttribute('aria-label','穿戴顯示方式');
    const use=mode=>{player.giranEquipmentView=mode;saveGame();characterPage('equip');};
    const mode=player.giranEquipmentView==='doll'?'doll':'list';
    for(const [id,word] of [['list','清單'],['doll','紙娃娃']]){
      const b=button(word,()=>use(id));b.dataset.equipView=id;b.setAttribute('aria-pressed',String(mode===id));controls.append(b);
    }
    content.append(controls);nativeTab('equip');const el=$('tab-equip');el.dataset.layout=mode;
    window.setEquipmentPanelEmbedded(false);
    if(mode==='doll'){
      const doll=$('equipment-window');mount(doll,content);
      doll.classList.remove('hidden');doll.setAttribute('aria-hidden','false');
      window.refreshEquipmentWindow();
    }
  }
  const bagTabs=[['items','道具'],['weapons','武器'],['armors','防具']];
  function bagPage(id='items'){reset(id);selectTabs(bagTabs,id,bagPage);nativeTab(id);}
  let lastBagWheel=0;
  tabs.addEventListener('wheel',event=>{
    if(pane!=='bag'||event.ctrlKey||event.metaKey)return;
    const delta=event.deltaY||event.deltaX;if(!delta)return;
    event.preventDefault();
    const now=performance.now(),previous=lastBagWheel;lastBagWheel=now;
    if(previous&&now-previous<160)return;
    const index=bagTabs.findIndex(([id])=>id===tab),next=bagTabs[index+Math.sign(delta)];
    if(next)bagPage(next[0]);
  },{passive:false});
  function characterPage(id='summary'){
    reset(id);selectTabs(charTabs,id,characterPage);
    if(id==='summary'){
      const header=make('div','ga-character');header.append(make('i','ico-menu'),make('div'));
      if(!portrait.hidden)header.firstChild.append(portrait.cloneNode());
      header.lastChild.append(make('small','','隊長　'+className(player)),make('h3','',player.name),make('span','','Lv. '+player.lv));content.append(header);
      const grid=make('div','ga-stats');for(const [k,n] of [['st-ac','防禦 AC'],['st-mr','抗魔 MR'],['txt-hp','生命 HP'],['txt-mp','魔力 MP'],['txt-exp','經驗'],['st-gold','金幣']])grid.append(label($(k)?.textContent||'0',n));
      for(const [key,word] of [['dragon','龍鑽'],['blood','血龍鑽']]){const box=label('0',word);box.dataset.wallet=key;grid.append(box);}content.append(grid);balances();
      const shortcuts=make('div','ga-actions');

      if(window.__afkAvatar?.menu)shortcuts.append(simpleAction('更換頭像',()=>{GiranUI.pane(null);window.__afkAvatar.menu();}));
      content.append(shortcuts);nativeTab('stats');
    }else if(id==='equip'){equipment();
    }else nativeTab(id);
  }
  function openCharacter(id){if(['items','weapons','armors'].includes(id)){if(pane!=='bag')GiranUI.pane('bag');bagPage(id);return;}if(id==='skill'){if(pane!=='skills')GiranUI.pane('skills');return;}if(pane!=='menu')GiranUI.pane('menu');characterPage(id);}
  function show(id){
    areaDrops.close();
    const was=pane;if(drawerOpen)drawer(false);restore();pane=id||'';win.hidden=!pane;
    if(was==='chat'&&pane!=='chat'){if(channel.value==='traveler')window.AFK_HEARTBEAT?.hide();syncFeed();}
    if(!pane){if(was){const focus=lastFocus?.getClientRects().length?lastFocus:more;focus?.focus({preventScroll:true});}return;}
    if(!was)lastFocus=document.activeElement;
    if(id!=='chat'&&id!=='map'&&typeof _updateUIImpl==='function')_updateUIImpl(true);
    title.textContent=titles[id]||'';emblem.textContent=glyph[id]||'✦';win.dataset.panel=id;
    if(id==='settings')emblem.replaceChildren(potionIcon.cloneNode());
    if(id==='map')mapPage();else if(id==='party')teamPage();else if(id==='menu')characterPage();else if(id==='log'){reset('audit');nativeTab('audit');}else if(id==='bag')bagPage();else if(id==='skills'){reset('skill');nativeTab('skill');window.LineageClassUI?.tabSkills();}
    else if(id==='functions'){reset('functions');GiranDirectory.features(content,{quickSettings:settings.isConnected,character:key=>{reset(key);nativeTab(key);}});}
    else if(id==='settings'){reset('automation');nativeTab('automation');}
    else if(id==='clan'){reset('clan');nativeTab('clan');}
    else if(id==='room'){reset('room');mount(tools,content,'ga-room');tools.hidden=false;}
    else if(id==='chat'){reset('chat');mount(chat,content);setChatFold(false);syncChat();}
    close.focus({preventScroll:true});
  }
  function refresh(){
    if(document.hidden||!document.body.classList.contains('giran-running'))return;
    GiranFieldUI.refresh();syncChat();
    const town=mapState.current.startsWith('town_'),rift=state.riftRun&&mapState.current==='rift_battle';
    const instance=rift||state.prideClimb||state.oblivion||state.antharas||state._afkFinal||(!town&&/^(?:afk_|cr_|riftdg_)/.test(mapState.current));
    const action=town?'出發':instance?'撤離':'回城';
    recoveryControls(!!player.dead&&!document.body.classList.contains('giran-guest')&&!(typeof pvpArenaDeathExempt==='function'&&pvpArenaDeathExempt()));
    if(journey.textContent!==action)journey.textContent=action;journey.dataset.retreat=String(action==='撤離');journey.title=rift?'撤離裂痕並結算本次獎勵':instance?'依此副本規則離場':town?'出發到上次狩獵地點':'回到最近村莊，血盟持有當地城堡時回城堡';journey.disabled=!!player.dead||document.body.classList.contains('giran-guest');
    if(pane==='menu'&&tab==='summary')balances();
    if(!GiranPartyView.mobile()){
      areaDrops.sync();
      const f=GiranRadar.scene(),lead=f?.leader;
      const loc=lead&&f.terrain.kind==='tiles'?lead.x+' · '+lead.y:'';
      if(coord.textContent!==loc)coord.textContent=loc;
      GiranRadar.draw(mini);
    }else if(expandedChart)areaDrops.sync();
    if(expandedChart)GiranRadar.draw(expandedChart);
    if(pane==='party'&&tab==='buffs'){GiranPartyEffects.paint(content.querySelector('.ga-bufflist'),selectedMember);paintMember();}
    if(pane==='party'&&tab==='roster')updateCaptain();
    if(!phoneStatus.isConnected&&expanded){if(typeof renderStatusIconBar==='function')renderStatusIconBar();GiranPartyEffects.markIcons(statusIcons);}
    const short=(player.name||className(player));profile.title=short+'・'+className(player);
    const source=$('status-panel')?.style.backgroundImage||'';
    if(profile._portraitSource!==source){
      profile._portraitSource=source;const u=/^url\(["']?(.+?)["']?\)$/.exec(source)?.[1];
      portrait.hidden=true;if(u)portrait.setAttribute('src',u);else portrait.removeAttribute('src');
    }
  }
  const statusIcons=$('status-icon-bar');
  const statusStage=statusIcons.parentElement,phoneStatus=make('div','ga-phone-status');
  const buffToggle=make('button','ga-buff-toggle');
  buffToggle.type='button';buffToggle.setAttribute('aria-controls',statusIcons.id);
  function showBuffs(expanded){
    statusIcons.classList.toggle('ga-buffs-hidden',!expanded);
    buffToggle.textContent=expanded?'收合增益':'展開增益';
    buffToggle.setAttribute('aria-expanded',String(expanded));
  }
  let expanded=true;
  try{
    const collapsed=localStorage.getItem('giran-buffs-collapsed');
    const oldSize=localStorage.getItem('giran-buff-size');
    expanded=collapsed!==null?collapsed!=='1':oldSize!=='0';
  }catch{}
  const events=make('div','ga-world-events'),badges=$('afk-ev-badges')||make('span');
  badges.id='afk-ev-badges';
  events.setAttribute('aria-label','世界事件');
  events.append(make('span','ga-event-label','世界事件'),badges,make('span','ga-no-events','目前沒有事件'));
  place.append(events);
  function arrangeStatuses(){
    if(GiranPartyView.mobile()){
      if(phoneStatus.isConnected)return;
      document.body.append(phoneStatus);
      buffToggle.remove();statusIcons.classList.remove('ga-buffs-hidden');
      LineageAdventure.status.moveTo(phoneStatus);
    }else{
      if(statusIcons.parentElement===place)return;
      LineageAdventure.status.moveTo(statusStage);phoneStatus.remove();
      place.append(buffToggle,statusIcons);showBuffs(expanded);
    }
    if(typeof player!=='undefined'&&player?.cls)renderStatusIconBar();
  }
  buffToggle.onclick=()=>{
    expanded=buffToggle.getAttribute('aria-expanded')!=='true';
    showBuffs(expanded);try{localStorage.setItem('giran-buffs-collapsed',expanded?'0':'1');}catch{}
    if(expanded){renderStatusIconBar();GiranPartyEffects.markIcons(statusIcons);}
  };
  statusIcons.addEventListener('click',e=>{
    if(phoneStatus.isConnected)return;
    const icon=e.target.closest('.status-icon');if(!icon)return;
    if(!icon.dataset.effectId)GiranPartyEffects.markIcons(statusIcons);
    if(!icon.dataset.effectId)return;
    e.preventDefault();
    const id=icon.dataset.effectId,member=icon.dataset.scope==='self'?player:null;
    if(pane!=='party')GiranUI.pane('party');teamPage('buffs',member);
    const entry=[...content.querySelectorAll('[data-effect]')].find(row=>row.dataset.effect===id);
    if(entry){entry.open=true;GiranPartyEffects.paint(content.querySelector('.ga-bufflist'),member);entry.scrollIntoView({block:'nearest'});}
  });
  const chat=make('section','ga-chat'),chatTitle=make('header'),channel=make('select'),fold=button('−',()=>setChatFold(!chat.classList.contains('ga-folded')));
  chat.setAttribute('aria-label','冒險對話');channel.setAttribute('aria-label','聊天頻道');channel.add(new Option('世界頻道','world'));channel.add(new Option('小隊頻道','room'));channel.add(new Option('旅人頻道','traveler'));
  channel.add(new Option('綜合日誌','journal'));channel.add(new Option('戰鬥日誌','combat'));channel.add(new Option('掉落日誌','loot'));
  if(window.__afkExpLog)channel.add(new Option('經驗日誌','experience'));
  channel.add(new Option('系統訊息','system'));
  chatTitle.append(channel,fold);const worldChat=make('div','ga-chat-channel'),roomChat=make('div','ga-chat-channel'),roomInput=make('div','ga-room-input');
  const travelerChat=make('div','ga-chat-channel');
  travelerChat.id='ga-traveler';travelerChat.hidden=true;
  const journalChat=make('div','ga-chat-channel'),feed=make('div');feed.id='ga-chat-feed';
  const latest=button('回到最新',()=>{feed.scrollTop=feed.scrollHeight;latest.hidden=true;},'ga-feed-latest');
  latest.hidden=true;
  feed.addEventListener('scroll',()=>{latest.hidden=!feed.clientHeight||feed.scrollHeight-feed.clientHeight-feed.scrollTop<=4;},{passive:true});
  journalChat.hidden=true;journalChat.append(feed,latest);
  chat.append(chatTitle,worldChat,roomChat,travelerChat,journalChat);document.body.append(chat);
  worldChat.append($('world-log'),$('world-log-unlock'),$('world-input-row'));
  let linked=false,shownChannel='';
  const narrowChat=matchMedia('(max-width:1100px)');
  function chatShown(){
    if(document.body.classList.contains('giran-running')&&GiranPartyView.mobile())return pane==='chat';
    return !(pane&&narrowChat.matches);
  }
  function syncFeed(){
    const selected=channel.value,isLog=!journalChat.hidden;
    const showLog=isLog&&!document.hidden&&!chat.classList.contains('ga-folded')&&chatShown();
    GiranMessageFeed.show(feed,showLog?selected:'');
  }
  function syncChat(){
    const social=tools.querySelector('.g-social'),next=!!social&&!social.hidden;
    if(next!==linked){
      linked=next;
      if(linked){if(document.body.classList.contains('giran-guest'))channel.value='room';roomChat.append($('gr-chat'),roomInput);roomInput.append($('gr-recipient'),$('gr-text'),$('gr-say'));}
      else{social?.prepend($('gr-chat'),$('gr-recipient'),$('gr-text'),$('gr-say'));if(channel.value==='room')channel.value='world';}
    }
    if(channel.options[1].disabled===linked)channel.options[1].disabled=!linked;
    if(shownChannel!==channel.value){
      shownChannel=channel.value;chat.dataset.channel=shownChannel;latest.hidden=true;
      worldChat.hidden=shownChannel!=='world';roomChat.hidden=shownChannel!=='room';travelerChat.hidden=shownChannel!=='traveler';
      journalChat.hidden=!worldChat.hidden||!roomChat.hidden||!travelerChat.hidden;
    }
    syncFeed();
  }
  function setChatFold(on){
    chat.classList.toggle('ga-folded',on);
    if(channel.value==='traveler'){if(on)window.AFK_HEARTBEAT?.hide();else window.AFK_HEARTBEAT?.open();}
    fold.textContent=on?'＋':'−';fold.setAttribute('aria-expanded',String(!on));
    fold.setAttribute('aria-label',on?'展開對話':'收合對話');
    syncFeed();
  }
  function chooseChannel(value){
    const option=[...channel.options].find(entry=>entry.value===value&&!entry.disabled);
    channel.value=option?option.value:'world';
    if(document.body.classList.contains('giran-running')&&GiranPartyView.mobile()&&pane!=='chat')GiranUI.pane('chat');
    syncChat();
    if(channel.value!=='traveler')window.AFK_HEARTBEAT?.hide();
    setChatFold(false);
  }
  channel.onchange=()=>chooseChannel(channel.value);
  document.addEventListener('visibilitychange',syncFeed);
  const history=$('world-log');history.addEventListener('click',e=>{if(e.target.closest('a,button,input'))return;const row=e.target.closest('.log-entry');if(row&&history.contains(row))row.classList.toggle('ga-chat-expanded');});
  if(typeof window.GIRAN_DESKTOP_ZOOM!=='number')window.GIRAN_DESKTOP_ZOOM=.75;
  function measureFieldFocus(){
    if(!panel.clientHeight)return;
    const rect=panel.getBoundingClientRect();
    const narrow=GiranPartyView.mobile()||window.innerWidth<=650;
    const hudTop=(narrow?$('giran-vitals'):dock).getBoundingClientRect().top;
    if(GiranPartyView.mobile()&&!pane&&hudTop>0){
      const bottom=Math.ceil(window.innerHeight-hudTop)+'px';
      if(panel.style.getPropertyValue('--ga-field-bottom')!==bottom)panel.style.setProperty('--ga-field-bottom',bottom);
    }
    if(pane&&GiranPartyView.mobile())return;
    const clear=(hudTop-rect.top)/rect.height;
    AFK_DIMENSION_VIEW.portraitFocus=narrow?Math.min(.58,Math.max(.23,clear*.68)):.58;
    AFK_DIMENSION_VIEW.visibleFieldFraction=narrow?Math.max(.2,Math.min(1,clear)):1;
  }
  const bounds=new ResizeObserver(entries=>{
    for(const {target,contentRect} of entries){
      if(target===dock)continue;
      if(target===statusIcons){document.body.style.setProperty('--ga-buffs-end',Math.ceil(statusIcons.getBoundingClientRect().bottom)+'px');continue;}
      if(target===chat){document.body.style.setProperty('--ga-channel-h',Math.ceil(chat.getBoundingClientRect().height)+'px');continue;}
      const scale=Math.min(2.65,Math.max(1.06,contentRect.height*.102/56),Math.max(1.06,contentRect.width/282));
      // 11-27 Ping：電腦版鏡頭拉遠（原本 1440 高的螢幕放大約 1.6 倍、2K 螢幕 2.6 倍，走路一步跨很多像素，看起來又快又卡）。手機不動。
      const zoom=Number((GiranPartyView.mobile()?scale:Math.max(1,scale*window.GIRAN_DESKTOP_ZOOM)).toFixed(3));
      panel.style.setProperty('--ga-world-scale',zoom);
      panel.style.setProperty('--ga-field-height',Math.max(1,(contentRect.height-6)/zoom)+'px');
    }
    requestAnimationFrame(measureFieldFocus);
  });
  bounds.observe(panel);bounds.observe(chat);bounds.observe(dock);bounds.observe(statusIcons);
  roomChat.hidden=true;setChatFold(false);syncChat();
  window.addEventListener('giran-room-change',syncChat);
  window.addEventListener('giran-open-room-chat',()=>{if(!linked)return;chooseChannel('room');});
  document.body.classList.add('giran-chrome');
  function escapeWindow(){
    const visible=el=>!!el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
    // Use the window's existing cancel/close control so each subsystem restores its state.
    const candidates=[...document.querySelectorAll('dialog[open], [role="dialog"], #ga-area-drops:not([hidden]), [id$="-modal"].open, [id$="-modal"]:not(.hidden), #town-interaction-container, [id$="-window"]:not(.hidden)')].filter(el=>el!==win&&!win.contains(el)&&visible(el));
    const stack=el=>{let z=0;for(let n=el;n&&n!==document.body;n=n.parentElement){const v=parseInt(getComputedStyle(n).zIndex,10);if(Number.isFinite(v))z=Math.max(z,v);}return z;};
    candidates.sort((a,b)=>stack(b)-stack(a));
    for(const dialog of candidates){
      const cancel=[...dialog.querySelectorAll('button,[role=button]')].find(b=>visible(b)&&!b.disabled&&(/^(取消|關閉|返回|×|✕|✖)/.test(b.textContent.trim())||/關閉/.test(b.getAttribute('aria-label')||'')||/[-_]close$/.test(b.id)));
      if(cancel){cancel.click();return true;}
      if(dialog.matches('dialog[open]')){dialog.close();return true;}
    }
    if(drawerOpen){drawer(false,true);return true;}
    if(pane==='party'&&tab.startsWith('member-')){teamPage('roster');return true;}
    if(pane){GiranUI.pane(null);return true;}
    return false;
  }
  function nativeSquadHidden(){return document.body.classList.contains('giran-running') && (pane!=='party'||(tab!=='roster'&&tab!=='orders'));}
  window.GiranPanels={show,refresh,openCharacter,inspectMember,escapeWindow,nativeSquadHidden,chooseChannel,traveler:{active:()=>chatShown()&&channel.value==='traveler'&&!chat.classList.contains('ga-folded'),show:()=>chooseChannel('traveler'),back:()=>chooseChannel('world')}};
  arrangePhone();window.addEventListener('giran-mobile-layout',arrangePhone);
  function resumeHUD(){if(!document.hidden){GiranUI.display();refresh();}}
  document.addEventListener('visibilitychange',resumeHUD);
  window.addEventListener('pageshow',resumeHUD);
  setInterval(refresh,650);
})();
