/* Unified phone navigation. Game data and native action handlers stay authoritative. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body;
  const game = $('game-screen');
  if (!game) return;
  const nativeSwitch = window.switchTab;
  const oldMobile = window.__afkm || {};
  const groups = {
    adventure: {title:'冒險', icon:'swords', tabs:[]},
    character: {title:'角色', icon:'person', tabs:[['stats','能力'],['equip','裝備'],['skill','技能'],['team','隊伍']]},
    bag: {title:'背包', icon:'bag', tabs:[['items','道具'],['weapons','武器'],['armors','防具']]},
    logs: {title:'日誌', icon:'log', tabs:[['combat','戰鬥'],['sys','系統'],['world','世界']]},
    more: {title:'更多', icon:'grid', tabs:[]}
  };
  const paths = {
    compass:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2 6-6 2 2-6 6-2Z',
    person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
    bag:'M5 7h14l1 14H4L5 7Zm4 0V5a3 3 0 0 1 6 0v2M9 11h6',
    log:'M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4',
    grid:'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    swords:'M4 3l5 2 11 13-3 3L5 8 4 3Zm16 0-5 2-4 5m-3 4-4 4 3 3 4-5M3 17l5 5m8-1 5-5',
    book:'M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1m0-15c3-2 7-2 9-1v15c-3-1-6-1-9 1V5Z',
    shield:'M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Zm-3 9 2 2 4-5'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
  let enabled = false, page = 'adventure', tab = '', mainLayer = null, switching = false;
  let raf = 0, syncQueued = false, surfaceSerial = 0;
  const rememberedTabs = new Map();
  const scroll = new Map(), registered = new Map(), stack = [];
  const stats = {navigation:0, reconciliations:0, discoveries:0, layouts:0};
  const header = document.createElement('header');
  header.id = 'lm-header';
  header.innerHTML = '<div class="lm-hud"><button type="button" id="lm-player" aria-label="查看角色能力"><span class="lm-avatar"><img id="lm-portrait" alt="">'+icon('person')+'</span></button>'+
    '<div class="lm-hud-data"><div class="lm-identity"><button type="button" id="lm-rename" aria-label="修改角色名稱"><strong id="lm-player-name">冒險者</strong><span>改名</span></button><small id="lm-player-level">Lv —</small></div>'+
    '<div class="lm-status-summary"><button type="button" id="lm-castle" aria-label="城堡與統一狀態">城堡 —</button><span id="lm-classic" hidden>經典</span></div><div class="lm-defenses" role="group" aria-label="防禦與魔法防禦"><span aria-label="防禦 AC">AC <b id="lm-ac">—</b></span><span aria-label="魔法防禦 MR">魔防 <b id="lm-mr">—</b></span><span aria-label="正義值">正義 <b id="lm-law">—</b></span></div></div>'+
    '<a id="lm-recovery" href="recovery.html" aria-label="存檔與修復">'+icon('shield')+'<span>存檔</span></a></div>'+
    '<div class="lm-vitals-row"><div class="lm-vitals"><div class="lm-vital lm-hp" role="group" aria-label="生命 HP"><i id="lm-hp-fill"></i><span><b id="lm-hp-text">—</b></span></div><div class="lm-vital lm-mp" role="group" aria-label="魔力 MP"><i id="lm-mp-fill"></i><span><b id="lm-mp-text">—</b></span></div></div></div>'+
    '<div class="lm-worldbar"><div class="lm-world-events"><span>世界事件</span><span id="lm-event-text">目前沒有事件</span></div></div>'+
    '<div class="lm-currencies" aria-label="持有貨幣"><div class="lm-currency"><span><img src="assets/icons/items/金幣.png" alt="">金幣</span><strong id="lm-gold">—</strong></div><div class="lm-currency lm-diamond"><span><img src="assets/icons/items/龍之鑽石.png" alt="">龍鑽</span><strong id="lm-diamonds">—</strong></div><div class="lm-currency lm-blood"><span><img src="assets/icons/items/龍之鑽石.png" alt="">血龍鑽</span><strong id="lm-blood-diamonds">—</strong></div></div>'+
    '<div class="lm-experience"><span>EXP</span><div><i id="lm-exp-fill"></i></div><b id="lm-exp-text">—</b></div>';
  const equipmentFrame=$('equipment-window-frame');
  if(equipmentFrame){const back=document.createElement('button');back.id='lm-equipment-back';back.type='button';back.setAttribute('aria-label','返回角色能力');back.addEventListener('click',()=>go('character','stats'));equipmentFrame.appendChild(back);}
  const subnav = document.createElement('nav');
  subnav.id = 'lm-subnav'; subnav.setAttribute('aria-label','功能分類');
  const nav = document.createElement('nav');
  nav.id = 'lm-nav'; nav.setAttribute('aria-label','遊戲主選單');
  const navArt = {
    character:'assets/logo/王族icon.webp', bag:'assets/icons/items/上鎖的歐西里斯初級寶箱.png',
    adventure:'assets/icons/weapons/長劍.png', logs:'assets/icons/items/古代的卷軸.png',
    more:'assets/icons/items/甘地妖魔魔法書.png'
  };
  ['character','bag','adventure','logs','more'].forEach(id => {
    const group=groups[id];
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.page = id;
    b.innerHTML = '<span class="lm-nav-icon"><img src="'+navArt[id]+'" alt=""></span><span>'+group.title+'</span>';
    b.addEventListener('click', () => go(id));
    nav.appendChild(b);
  });
  const more = document.createElement('section');
  more.id = 'lm-more'; more.setAttribute('aria-label','更多功能');
  more.innerHTML = '<label class="lm-menu-search">'+icon('grid')+'<input id="lm-menu-search" type="search" placeholder="搜尋功能、收藏、小說…" aria-label="搜尋功能"></label>'+
    '<section class="lm-menu-group" data-menu-group="adventure"><h3>冒險與收藏</h3><div class="lm-menu-items lm-menu-grid"></div></section>'+
    '<section class="lm-menu-group" data-menu-group="idle"><h3>掛機與整理</h3><div class="lm-menu-items lm-menu-list"></div></section>'+
    '<section class="lm-menu-group" data-menu-group="system"><h3>系統</h3><div class="lm-menu-items lm-menu-list"></div></section>'+
    '<p id="lm-menu-empty" hidden>沒有符合的功能，試試其他關鍵字。</p>';
  const menu = [
    ['收藏圖鑑','卡片、裝備與冒險收藏','btn-collection'],
    ['自動販賣','整理規則與出售預覽','btn-autosell'],
    ['統計與存檔','冒險紀錄、匯出進度','audit'],
    ['社交','互動與角色資訊','pvp'],
    ['血盟','血盟成員與共同冒險','clan'],
    ['遊戲設定','自動戰鬥與功能選項','automation'],
    ['介面設定','顯示與操作偏好','afk-toggles-entry'],
    ['冒險小百科','規則、道具與玩法查詢','m-afk-nav-wiki'],
    ['次元裂縫小說','閱讀故事，保留閱讀進度','m-afk-nav-novel'],
    ['遊戲廳','前往遊戲廳與休閒活動','m-afk-nav-gamehall'],
    ['手機顯示','字體大小與輕量模式','display'],
    ['存檔與修復','備份、檢查與安全復原','recovery'],
    ['切換角色／登出','儲存進度後回到首頁','logout']
  ];
  const menuArt={
    'btn-collection':'assets/icons/items/古代的卷軸.png',
    'pvp':'art-fix/icons/9ec8e6997b2fb9.webp',
    'clan':'assets/logo/王族icon.webp',
    'audit':'assets/icons/items/品質鑽石.png',
    'm-afk-nav-gamehall':'assets/icons/items/勇敢藥水.png',
    'btn-autosell':'assets/icons/items/金幣.png',
    'automation':'assets/icons/items/上鎖的歐西里斯初級寶箱.png',
    'afk-toggles-entry':'assets/icons/items/古代的卷軸.png',
    'm-afk-nav-wiki':'assets/icons/items/甘地妖魔魔法書.png',
    'm-afk-nav-novel':'assets/icons/items/古代的卷軸.png',
    'display':'assets/logo/王族icon.webp',
    'recovery':'assets/icons/items/品質鑽石.png',
    'logout':'assets/icons/items/瞬間移動卷軸.png'
  };
  function openMenuAction(action){
    if(action==='recovery'){$('lm-recovery').click();return;}
    if(action==='display'){window.AFK_MOBILE_SCALE?.open();return;}
    if(action==='logout'){if(oldMobile.logout)oldMobile.logout();return;}
    const original=$(action);if(original)original.click();
    else if(action==='m-afk-nav-novel'&&window.__afkNovel)window.__afkNovel.open();
    else if(nativeButton(action))chooseTab(action);
    else if(typeof window.alert==='function')window.alert('這個功能目前未啟用，請先在外掛選項確認。');
  }
  menu.forEach(([label, desc, action]) => {
    const b = document.createElement('button'); b.type='button'; b.dataset.action=action;
    const title=document.createElement('strong'); title.textContent=label;
    const small=document.createElement('span'); small.textContent=desc;
    const mark=document.createElement('span');mark.className='lm-menu-icon';
    mark.innerHTML=icon(action.includes('novel')||action==='m-afk-nav-wiki'?'book':action==='recovery'?'shield':action==='display'?'person':action==='audit'?'log':'compass');
    if(menuArt[action]){
      const art=document.createElement('img');art.src=menuArt[action];art.alt='';
      art.addEventListener('load',()=>mark.classList.add('has-art'));
      art.addEventListener('error',()=>{art.remove();mark.classList.remove('has-art');});
      mark.appendChild(art);
    }
    b.append(mark,title,small);
    b.addEventListener('click',()=>openMenuAction(action));
    const category=['display','recovery','logout'].includes(action)?'system':
      ['btn-autosell','automation','afk-toggles-entry'].includes(action)?'idle':'adventure';
    more.querySelector('[data-menu-group="'+category+'"] .lm-menu-items').appendChild(b);
  });
  const logs = document.createElement('section'); logs.id='lm-logs';
  logs.setAttribute('aria-label','冒險日誌');
  const combatLog=$('combat-log'),filterKeys=['enemy','player','mercenary','summon','pet'];
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-market-section]');
    if(!enabled||!button)return;
    const section=button.dataset.marketSection;
    if(!['pandora-market-grid','pandora-buy-box','pandora-relic-board'].includes(section))return;
    button.closest('.pandora-market-panel')?.querySelector('.'+section)?.scrollIntoView({block:'start'});
  });
  if(combatLog){
    const options=document.createElement('details');options.id='lm-log-options';
    options.innerHTML='<summary>戰鬥訊息篩選</summary><div class="lm-log-filter-buttons"></div>';
    const empty=document.createElement('div');empty.id='lm-log-empty';empty.innerHTML='<span>目前已隱藏全部戰鬥訊息</span><button type="button">顯示全部</button>';
    const refresh=()=>{
      for(const key of filterKeys)options.querySelector('[data-log-filter="'+key+'"]').setAttribute('aria-pressed',String(!combatLog.classList.contains('cf-hide-'+key)));
      empty.hidden=!filterKeys.every(key=>combatLog.classList.contains('cf-hide-'+key));
    };
    for(const key of filterKeys){const source=$('cf-btn-'+key),button=document.createElement('button');button.type='button';button.dataset.logFilter=key;button.textContent=source?.textContent||key;button.addEventListener('click',()=>{source?.click();refresh();});options.lastElementChild.append(button);}
    empty.querySelector('button').addEventListener('click',()=>{for(const key of filterKeys)if(combatLog.classList.contains('cf-hide-'+key))$('cf-btn-'+key)?.click();refresh();});
    combatLog.before(options,empty);new MutationObserver(refresh).observe(combatLog,{attributes:true,attributeFilter:['class']});refresh();
  }
  const detail = document.createElement('section'); detail.id='lm-detail';
  detail.setAttribute('role','dialog'); detail.setAttribute('aria-modal','true');
  detail.setAttribute('aria-labelledby','lm-detail-title');
  detail.innerHTML='<header id="lm-detail-header"><button type="button" id="lm-back">‹ 返回</button><h2 id="lm-detail-title"></h2><button type="button" id="lm-home">回主頁</button></header><div id="lm-detail-body"></div>';
  body.append(header,subnav,nav,detail); game.append(more,logs);
  $('lm-player').addEventListener('click',()=>go('character','stats'));
  $('lm-rename').addEventListener('click',openRename);
  $('lm-castle').addEventListener('click',()=>openMenuAction('clan'));
  function openRename(){
    if(!enabled||stack.length||window._editingName||typeof window.startEditName!=='function')return;
    window.startEditName();
    const input=$('name-edit-input');if(!input)return;
    const modal=document.createElement('section');modal.id='lm-rename-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-label','修改角色名稱');
    modal.innerHTML='<form class="lm-rename-form"><label for="name-edit-input">角色名稱</label><p>最多 12 個字；留白可恢復未取名。</p><div class="lm-rename-actions"><button type="button" data-rename-cancel>取消</button><button type="submit">確認修改</button></div></form>';
    input.removeAttribute('onkeydown');input.removeAttribute('onclick');input.setAttribute('autocomplete','off');
    const form=modal.querySelector('form');form.insertBefore(input,form.querySelector('p'));
    const close=()=>{window.cancelEditName?.();modal.remove();queueHud();scheduleSync();};
    form.addEventListener('submit',event=>{event.preventDefault();window.confirmEditName();modal.remove();queueHud();scheduleSync();});
    modal.querySelector('[data-rename-cancel]').addEventListener('click',close);
    input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
    body.appendChild(modal);discover(modal);sync();input.focus();input.select();
  }
  const squad=$('squad-panel');
  function syncTeam(){
    if(!squad)return;const empty=squad.style.display==='none';squad.dataset.mobileEmpty=String(empty);
    let note=$('lm-team-empty');if(!note){note=document.createElement('p');note.id='lm-team-empty';note.textContent='目前沒有出戰的隊友、召喚物、寵物或守衛。';squad.querySelector('#squad-body')?.appendChild(note);}note.hidden=!empty;
  }
  if(squad){new MutationObserver(syncTeam).observe(squad,{attributes:true,attributeFilter:['style']});syncTeam();}
  $('lm-menu-search').addEventListener('input',e=>{
    const query=e.target.value.trim().toLocaleLowerCase();let matches=0;
    more.querySelectorAll('[data-action]').forEach(button=>{
      button.hidden=!button.textContent.toLocaleLowerCase().includes(query);
      if(!button.hidden)matches++;
    });
    more.querySelectorAll('[data-menu-group]').forEach(group=>{
      group.hidden=![...group.querySelectorAll('[data-action]')].some(button=>!button.hidden);
    });
    $('lm-menu-empty').hidden=matches>0;
  });
  // Mirror native HUD fields. Currency uses the native read-only API and inventory,
  // throttled to once per second; never write saves or rebuild inventory.
  let hudFrame=0,currencyUpdatedAt=0;
  function updateHud(){
    hudFrame=0;if(!enabled||document.hidden)return;
    const text=(dest,source,fallback)=>{
      const value=$(source)?.textContent.trim()||fallback;
      if($(dest).textContent!==value)$(dest).textContent=value;
    };
    if(!window._editingName)text('lm-player-name','st-class','冒險者');
    const level='Lv '+($('st-lv')?.textContent.trim()||'—')+' · '+($('st-classname')?.textContent.trim()||'');
    if($('lm-player-level').textContent!==level)$('lm-player-level').textContent=level;
    text('lm-gold','st-gold','—');text('lm-hp-text','txt-hp','—');text('lm-mp-text','txt-mp','—');
    text('lm-exp-text','txt-exp','—');
    text('lm-ac','st-ac','—');text('lm-mr','st-mr','—');{const el=$('lm-law');if(el&&typeof player!=='undefined'&&player){const v=typeof pvpClampAlignment==='function'?pvpClampAlignment(player.alignmentValue):Math.round(Number(player.alignmentValue)||0),t=Number(v).toLocaleString('en-US');if(el.textContent!==t){el.textContent=t;try{el.style.color=typeof pvpAlignmentColor==='function'?pvpAlignmentColor(v):'';}catch(e){}}}}
    if(Date.now()-currencyUpdatedAt>=1000){
      currencyUpdatedAt=Date.now();
      const amount=(id,value)=>{const node=$(id),n=Number(value),label=Number.isFinite(n)?Math.max(0,Math.floor(n)).toLocaleString():'—';if(node.textContent!==label)node.textContent=label;};
      try{amount('lm-diamonds',window.pandoraGetSharedDiamonds?.());}catch{amount('lm-diamonds',undefined);}
      const inventory=typeof player!=='undefined'&&Array.isArray(player?.inv)?player.inv:null;
      amount('lm-blood-diamonds',inventory?inventory.reduce((sum,item)=>sum+(item?.id==='afk_blood_dia'?(Number(item.cnt)||1):0),0):undefined);
    }
    const shown=node=>node&&!node.hidden&&node.style.display!=='none'&&(!!node.style.display||!node.classList.contains('hidden'));
    const nativeCastle=$('victory-badge'),castle=$('lm-castle'),castleText=shown(nativeCastle)?$('victory-badge-text')?.textContent.trim()||nativeCastle.textContent.trim():'';
    if(castle.textContent!==(castleText||'城堡 —'))castle.textContent=castleText||'城堡 —';
    castle.disabled=!castleText;castle.title=castleText?(nativeCastle.title||castleText):'尚未持有城堡';
    $('lm-classic').hidden=!shown($('classic-badge'));
    const events=$('afk-ev-badges'),eventText=events?[...events.children].filter(shown).map(el=>el.textContent.trim()).filter(Boolean).join(' · '):'';
    if($('lm-event-text').textContent!==(eventText||'目前沒有事件'))$('lm-event-text').textContent=eventText||'目前沒有事件';
    $('lm-event-text').classList.toggle('is-active',!!eventText);
    for(const kind of ['hp','mp','exp']){
      const value=parseFloat($('bar-'+kind)?.style.width);
      const width=(Number.isFinite(value)?Math.max(0,Math.min(100,value)):0)+'%';
      if($('lm-'+kind+'-fill').style.width!==width)$('lm-'+kind+'-fill').style.width=width;
    }
    const source=$('status-panel')?.style.backgroundImage||'';
    const portrait=source.match(/url\(["']?(assets\/character\/[^/\\"'()]+\.(?:webp|png))["']?\)/)?.[1]||source.match(/url\("?(data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+\/=]+)"?\)/)?.[1]||'';
    const image=$('lm-portrait');
    if((image.getAttribute('src')||'')!==portrait){
      image.parentElement.classList.remove('has-portrait');
      if(portrait)image.setAttribute('src',portrait);else image.removeAttribute('src');
    }
  }
  function queueHud(){if(enabled&&!document.hidden&&!hudFrame)hudFrame=requestAnimationFrame(updateHud);}
  const hudObserver=new MutationObserver(queueHud);
  for(const id of ['st-class','st-classname','st-lv','st-gold','st-ac','st-mr','txt-hp','txt-mp','bar-hp','bar-mp','bar-exp','txt-exp','status-panel','victory-badge','classic-badge','status-alerts']){
    const node=id==='status-alerts'?$(id)?.parentElement:$(id);if(node)hudObserver.observe(node,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style','class','title','hidden']});
  }
  $('lm-portrait').addEventListener('load',()=>{$('lm-portrait').parentElement.classList.add('has-portrait');});
  $('lm-portrait').addEventListener('error',()=>{$('lm-portrait').parentElement.classList.remove('has-portrait');});
  document.addEventListener('visibilitychange',queueHud);
  $('lm-back').addEventListener('click',back);
  $('lm-home').addEventListener('click',()=>{
    if(stack.length && window.AFK_NAV) AFK_NAV.pop(stack[0].layer);
    else for(const r of [...stack].reverse())nativeClose(r);
    scheduleSync();
  });
  $('lm-recovery').addEventListener('click',e=>{
    if(window.LineageBoot && LineageBoot.goRecovery) {e.preventDefault();LineageBoot.goRecovery();}
  });
  let logHome = null;
  // Keep the explicit preview URL; normal play selects its layout automatically.
  // No floating layout switch: it covered desktop ability values and controls.
  const phoneDisplay = /(?:[?&])display=phone(?:&|$)/.test(window.location?.search||'');
  function mobile() {
    return phoneDisplay || (!window.AFK_TOGGLES || AFK_TOGGLES.enabled('mobile')) &&
      (innerWidth<=820 || (innerWidth<=1024 && innerHeight<=520 && matchMedia('(pointer:coarse)').matches));
  }
  function inGame() {return !game.classList.contains('hidden');}
  function scrollKey(){return page+':'+tab;}
  function nativeButton(id) {
    return [...document.querySelectorAll('#col-right > .tab-bar button')].find(b=>(b.getAttribute('onclick')||'').includes("switchTab('"+id+"'"));
  }
  function chooseTab(id) {
    const group=['stats','equip','skill','team'].includes(id)?'character':
      ['items','weapons','armors'].includes(id)?'bag':'more';
    go(group,id);
  }
  function setMainLayer() {
    if(!window.AFK_NAV)return;
    if(page!=='adventure'&&!mainLayer) mainLayer=AFK_NAV.push(()=>{
      mainLayer=null; if(enabled && page!=='adventure') go('adventure','',true);
    });
    else if(page==='adventure'&&mainLayer) {
      const h=mainLayer; mainLayer=null; AFK_NAV.pop(h);
    }
  }
  function go(id,nextTab,fromBack) {
    if(!enabled||!groups[id]||stack.length)return;
    scroll.set(scrollKey(),game.scrollTop);
    page=id; tab=nextTab===undefined?(rememberedTabs.get(id)||groups[id].tabs[0]?.[0]||''):nextTab;
    if(id!=='more')rememberedTabs.set(id,tab);
    body.dataset.mobilePage=page; body.dataset.mobileTab=tab;
    body.classList.remove('mview-left','mview-center','mview-right','mlog-open');
    game.setAttribute('aria-label',groups[id].title);
    for(const b of nav.children) {
      const on=b.dataset.page===page;
      b.classList.toggle('is-active',on);
      if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    }
    subnav.replaceChildren();
    const entries=groups[id].tabs.length?groups[id].tabs:
      (id==='more'&&tab?[['','功能總覽'],[tab,menu.find(x=>x[2]===tab)?.[0]||'內容']]:[]);
    for(const [value,label] of entries){
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.dataset.tab=value;b.setAttribute('aria-pressed',String(value===tab));
      b.addEventListener('click',()=>go(id,value));subnav.appendChild(b);
    }
    subnav.hidden=!entries.length;
    switching=true;
    try {
      const b=nativeButton(tab);
      if(b) nativeSwitch(tab,b);
      if(typeof window.setEquipmentPanelEmbedded==='function')window.setEquipmentPanelEmbedded(page==='character'&&tab==='equip');
      if(page==='character'&&tab==='team'){
        window.renderSquadPanel?.();window.switchSquadTab?.('team');syncTeam();
      }
      if(page==='logs'){
        if(typeof switchLogTab==='function' && tab!=='world')switchLogTab(tab==='sys'?'sys':'combat');
        body.dataset.mobileLog=tab;
      }
    } finally {switching=false;}
    if(!fromBack)setMainLayer();
    game.scrollTop=scroll.get(scrollKey())||0;
    stats.navigation++;
    measure();
    scheduleSync();
  }
  window.switchTab=function(t,b){
    if(enabled&&!switching) {chooseTab(t);return;}
    return nativeSwitch.apply(this,arguments);
  };
  function measure(){
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;if(!enabled)return;
      const headerHeight=header.getBoundingClientRect().height;
      const h=Math.ceil(headerHeight+subnav.getBoundingClientRect().height);
      const n=Math.ceil(nav.getBoundingClientRect().height);
      // 先集中量測，再只寫入有變更的值，避免額外的版面重算。
      [[body,'--lm-header-h',Math.ceil(headerHeight)], [body,'--lm-top',h], [document.documentElement,'--m-nav-h',n]].forEach(([el,key,value])=>{
        const next=value+'px';if(el.style.getPropertyValue(key)!==next)el.style.setProperty(key,next);
      });
      stats.layouts++;
    });
  }
  const sized=new ResizeObserver(measure);sized.observe(header);sized.observe(subnav);sized.observe(nav);
  function activate() {
    const next=mobile()&&inGame();
    body.classList.toggle('lm-phone-display',phoneDisplay&&inGame());
    if(next===enabled){if(next)measure();return;}
    enabled=next;
    body.classList.toggle('m-unified',enabled);
    if(enabled){
      queueHud();
      const row=$('log-row');
      if(row&&!logHome){logHome=document.createComment('mobile-log-home');row.before(logHome);logs.appendChild(row);}
      oldMobile.closeLog?.();
      go(page,tab||undefined);
      stack.forEach(mount);
      scheduleSync();
    }else{
      for(const r of stack)unmount(r);
      body.classList.remove('lm-detail-open');
      game.inert=false;header.inert=false;nav.inert=false;subnav.inert=false;
      if(logHome){logHome.replaceWith($('log-row'));logHome=null;}
      document.documentElement.style.setProperty('--m-nav-h','0px');
      // The legacy responsive handler may reset its active tab during resize.
      // Restore the selected phone subpage before fitting the desktop surface.
      const selected=nativeButton(tab);if(selected)nativeSwitch(tab,selected);
      if(typeof setEquipmentPanelEmbedded==='function')setEquipmentPanelEmbedded(page==='character'&&tab==='equip');
    }
    window.AFK_MOBILE_SCALE?.refresh?.();
    window.AFK_HOTBAR?.render();
  }
  const extra = '#afk-radio-menu,#collection-panel,#item-modal,#town-interaction-container,#warehouse-window,#afk-alert-modal,#afk-confirm-modal,#m-logout-modal,#m-stat-modal,#afk-toggles-overlay,#afk-ms-overlay,#afk-ps-overlay,#rb-modal,#rp-modal,.afk-ca-overlay,#afk-novel,#afk-gd-ov';
  const known=(window.AFK_BANNER?.MODAL_HOSTS||'')+','+extra;
  const discoverSelector=known.replace(/^,/,'')+',[role="dialog"],[id$="-modal"],[id$="-overlay"],[id$="-book"]';
  const excludes=new Set(['equipment-window','load-select-overlay','m-logout-overlay','lm-detail','growth-overlay','class-overlay','attribute-help','afk-plugin-panel']);
  const closeFunctions={
    'item-modal':'closeModal','town-interaction-container':'closeNpcInteraction',
    'warehouse-window':'closeWarehouseWindow','collection-panel':'closeCollectionPanel',
    'card-book':'closeCardBook','equip-book':'closeEquipBook','misc-book':'closeMiscBook',
    'relic-book':'closeRelicBook'
  };
  const titles={'item-modal':'物品詳情','town-interaction-container':'城鎮對話','warehouse-window':'共用倉庫',
    'collection-panel':'收藏圖鑑','card-book':'卡片圖鑑','equip-book':'裝備圖鑑','misc-book':'道具圖鑑',
    'afk-hb-modal':'旅人頻道','relic-book':'遺物圖鑑','afk-poly-book':'變身收藏','afk-special-book':'特殊收藏','autosell-rule-modal':'自動販賣','autosell-preview-modal':'出售預覽',
    'm-logout-modal':'角色與登出','m-stat-modal':'角色資訊','afk-confirm-modal':'確認操作','afk-alert-modal':'提示',
    'afk-radio-menu':'遊戲電台','m-wiki-modal':'冒險小百科','afk-toggles-overlay':'介面設定','afk-ms-overlay':'手機顯示',
    'afk-novel':'次元裂縫 · 小說','afk-gd-ov':'守護者之誓'};
  let recentLayers=[];
  if(window.AFK_NAV){
    const push=AFK_NAV.push;
    AFK_NAV.push=function(fn){
      const layer=push.call(this,fn);
      recentLayers.push(layer);scheduleSync();return layer;
    };
  }
  function visibleOwn(el) {
    return el.isConnected&&!el.hidden&&!el.classList.contains('hidden')&&
      el.style.display!=='none'&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  }
  function register(el) {
    if(!(el instanceof HTMLElement)||registered.has(el)||excludes.has(el.id)||el.closest('#growth-overlay,#class-overlay,#attribute-help')||el.closest('#lm-header,#lm-nav,#lm-subnav')||
      [...registered.keys()].some(p=>p!==el&&p.contains(el)))return;
    // Named overlay assets and nested cards are not application windows.
    if(!['DIV','SECTION','ASIDE','DIALOG'].includes(el.tagName))return;
    const r={el,active:false,layer:null,placeholder:null,wrapper:null,focus:null,order:++surfaceSerial};
    r.observer=new MutationObserver(scheduleSync);
    r.observer.observe(el,{attributes:true,attributeFilter:['class','style','hidden']});
    registered.set(el,r);stats.discoveries++;
  }
  function discover(root) {
    if(!(root instanceof Element))return;
    if(root.matches(discoverSelector))register(root);
    if(root.childElementCount)root.querySelectorAll(discoverSelector).forEach(register);
  }
  function nativeClose(r) {
    if(r.el.id==='afk-gh-win'&&window.__afkGameHall?.close){window.__afkGameHall.close();return;}
    if(r.el.id==='afk-radio-menu'&&window.__afkRadio?.close){window.__afkRadio.close();return;}
    const settingsClose={'afk-toggles-overlay':'afk-tg-close','afk-ms-overlay':'afk-ms-close'}[r.el.id];
    if(settingsClose&&$(settingsClose)){$(settingsClose).click();return;}
    if(r.el.id==='afk-hb-modal'&&window.AFK_HEARTBEAT){window.AFK_HEARTBEAT.close();return;}
    if(r.el.id==='afk-novel'&&window.__afkNovel){window.__afkNovel.close();return;}
    const fn=closeFunctions[r.el.id];
    if(fn&&typeof window[fn]==='function'){window[fn]();return;}
    const b=[...r.el.querySelectorAll('button,[role="button"]')].find(b=>{
      const label=((b.getAttribute('aria-label')||'')+' '+b.textContent).trim();
      return /^(取消|關閉|返回|Close|Cancel|✕|×|✖|X)(\s|$|視窗|頁面)/i.test(label);
    });
    if(b){b.click();return;}
    // Last resort is UI-only. Never run a confirm/purchase/restore action as a close handler.
    r.el.classList.remove('open');r.el.classList.add('hidden');
    r.el.setAttribute('aria-hidden','true');
  }
  function mount(r){
    if(!enabled||r.wrapper)return;
    r.placeholder=document.createComment('mobile-surface-home');r.el.before(r.placeholder);
    r.wrapper=document.createElement('div');r.wrapper.className='lm-detail-page';
    $('lm-detail-body').appendChild(r.wrapper);r.wrapper.appendChild(r.el);
    r.el.classList.add('lm-surface');
  }
  function unmount(r){
    if(!r.wrapper)return;
    r.el.classList.remove('lm-surface');
    if(!r.el.isConnected)r.placeholder?.remove();
    else if(r.placeholder?.isConnected)r.placeholder.replaceWith(r.el);
    else body.appendChild(r.el);
    r.wrapper.remove();r.placeholder=null;r.wrapper=null;
  }
  function renderStack(){
    const top=stack[stack.length-1],on=enabled&&!!top;
    body.classList.toggle('lm-detail-open',on);
    game.inert=on;header.inert=on;nav.inert=on;subnav.inert=on;
    for(const r of stack)if(r.wrapper){r.wrapper.hidden=r!==top;r.wrapper.inert=r!==top;}
    if(top){
      const label=(top.el.id==='town-interaction-container'&&top.el.querySelector('.pandora-market-panel')?'黑市 · 潘朵拉':'')||titles[top.el.id]||top.el.getAttribute('aria-label')||
        top.el.querySelector('h1,h2,h3')?.textContent.trim()||'功能詳情';
      $('lm-detail-title').textContent=label.slice(0,36);
    }
  }
  function sync(){
    syncQueued=false;stats.reconciliations++;
    if(!enabled){recentLayers=[];return;}
    let changed=false,lastFocus=null;
    for(const r of [...stack].reverse()){
      if(visibleOwn(r.el))continue;
      const idx=stack.indexOf(r);stack.splice(idx,1);r.active=false;
      lastFocus=r.focus;unmount(r);changed=true;
      // Pop only our own fallback. Native windows retire their own history handle.
      if(r.owned&&r.layer&&window.AFK_NAV)(AFK_NAV.drop||AFK_NAV.pop)(r.layer);   // 11-11：上面若已經有新開的視窗，不要連它一起關
      r.layer=null;
    }
    for(const [el,r] of registered){
      if(!el.isConnected&&!r.active){r.observer.disconnect();registered.delete(el);continue;}
      if(r.active||!visibleOwn(el))continue;
      r.active=true;r.focus=document.activeElement;
      const current=window.AFK_NAV?.top();
      const used=stack.some(x=>x.layer===current)||current===mainLayer;
      r.layer=(!used&&current&&(recentLayers.includes(current)||!stack.length))?current:null;
      r.owned=!r.layer;
      if(!r.layer&&window.AFK_NAV)r.layer=AFK_NAV.push(()=>{nativeClose(r);scheduleSync();});
      stack.push(r);mount(r);changed=true;
      $('lm-back').focus({preventScroll:true});
    }
    recentLayers=[];
    renderStack();
    if(changed&&!stack.length&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  }
  function scheduleSync(){
    if(syncQueued)return;syncQueued=true;queueMicrotask(sync);
  }
  function back(){
    const r=stack[stack.length-1];if(!r)return;
    if(r.layer&&window.AFK_NAV)AFK_NAV.pop(r.layer);else nativeClose(r);
    scheduleSync();
  }
  document.addEventListener('keydown',e=>{
    if(!enabled||!stack.length||e.key!=='Tab')return;
    const focusable=[...detail.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')]
      .filter(el=>!el.disabled&&!el.closest('[hidden],[inert]')&&el.getClientRects().length);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  },true);
  const discoveryObserver=new MutationObserver(records=>{
    // Some upstream windows (notably the guardian oath) close by removing their
    // root node. Attribute observers cannot see removal; retire the detail layer.
    let added=stack.some(r=>!r.el.isConnected);
    for(const record of records)for(const n of record.addedNodes){
      if(n.nodeType!==1||n.closest('#lm-detail'))continue;
      const count=registered.size;discover(n);if(registered.size!==count)added=true;
    }
    if(added)scheduleSync();
  });
  discoveryObserver.observe(body,{childList:true,subtree:true});
  discover(body);
  new MutationObserver(activate).observe(game,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',activate,{passive:true});
  window.addEventListener('pageshow',activate);
  window.__afkm=Object.assign({},oldMobile,{
    version:'4.1.0',isMobile:mobile,
    setView:id=>{if(enabled)go(({center:'adventure',left:'character',right:'bag'})[id]||id);else oldMobile.setView?.(id);},
    openLog:()=>{if(enabled)go('logs','sys');else oldMobile.openLog?.();},
    setLog:which=>{if(enabled)go('logs',which==='sys'?'sys':'combat');else oldMobile.setLog?.(which);}
  });
  window.LineageMobile={
    go,back,
    pendingScroll:()=>switching?(scroll.get(scrollKey())||0):null,
    status:()=>({enabled,page,tab,depth:stack.length,active:stack.at(-1)?.el.id||null,
      registered:registered.size,...stats})
  };
  activate();
})();
