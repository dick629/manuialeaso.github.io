'use strict';
window.GiranDirectory = (() => {
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const guest = () => document.body.classList.contains('giran-guest');
  function searchBox(label) {
    const input = el('input', '', 'ga-directory-search');
    input.type = 'search';
    input.placeholder = label;
    input.setAttribute('aria-label', label);
    return input;
  }
  function lockReason(map) {
    if (guest()) return '由隊長帶隊';
    if (!mapOptDisabled(map)) return '';
    if (map.giranFloor && !GiranGates.accessible(map.v)) return '先從相連的樓梯或入口抵達';
    if (!map.v.startsWith('town_') && typeof mercRoleSafeAreaOnly === 'function' && mercRoleSafeAreaOnly()) return '受僱期間僅能停留在安全區';
    if (map.classicHide && player.classicMode) return '此角色使用經典規則';
    const zone = window.__afkNewZones;
    if (zone?.ZBY[map.v]) {
      const why = zone.gateWhy(player, zone.ZBY[map.v]);
      if (why) return why;
    }
    const missing = id => id && !player.inv.some(it => it.id === id && (it.cnt ?? 1) > 0);
    if (map.questReq === 'demonTemple' && !player.demonTempleOpen) return '先完成職業 50 級試煉的神殿階段';
    if (missing(map.keyHoldReq)) return '須持有' + (DB.items[map.keyHoldReq]?.n || '地圖鑰匙');
    if (map.affinityReq && (player.flameAffinity || 0) < map.affinityReq) return '須提升炎魔友好度';
    if (map.prideReq === 'jenis' && !player.prideBeatJenis) return '先擊敗潔尼斯女王';
    if (typeof map.prideReq === 'number' && !prideHasTalisman(map.prideReq)) return '須有對應樓層的傳送符、支配符或移動卷軸';
    if (missing(map.needKey)) return '須有' + (DB.items[map.needKey]?.n || '地圖鑰匙');
    if (map.disabled && /內城/.test(map.t)) return '先攻破外城門';
    return '目前無法直接傳送';
  }

  const guideNames = {
    _rift_entrance: '時空裂痕（時空裂縫）', npc_afk_joe: '哈汀副本',
    npc_afk_riftgate: '次元裂縫副本', npc_afk_goddess: '女神席琳挑戰',
    _pride_entrance: '傲慢之塔攀登', npc_traitor_ira: '謀叛副本', npc_traitor_ira_town: '謀叛副本',
    npc_afk_timeguide: '時光副本', npc_afk_doomgrave: '屠龍者的劍塚'
  };
  // Use the same resident list and map entries as the world. Instance admission stays with the NPC.
  function guideRows() {
    const maps = new Map();
    rebuildMapCategoryOptions();
    for (const option of document.getElementById('map-category').options) {
      for (const m of regionMapList(option.value)) {
        if (DB.towns[m.v] && !(m.classicHide && player.classicMode)) maps.set(m.v, m);
      }
    }
    const rows = [], here = mapState.current, remoteNames = (window.__afkRiftDg?.D || [])
      .filter(d => !d.npc).map(d => d.n).filter(Boolean);
    for (const map of maps.values()) {
      const buyers=typeof getWanderingBuyersForTown==='function'?getWanderingBuyersForTown(map.v):[];
      for (const npc of [...townResidentsForMap(map.v),...buyers]) {
        const item=npc._wanderer&&DB.items[npc.itemId];
        const name = npc._wanderer?(npc.title||'裝備收購')+'・'+npc.n:guideNames[npc.id] || npc.n;
        const dungeons = npc.id === 'npc_afk_riftgate' ? remoteNames : [];
        const tags = [name,npc.n,npc.title,npc.d,npc._wanderer?'收裝備 裝備收購 收購者 潘朵拉':'',item?.n,DB.towns[map.v].n,...dungeons];
        if (dungeons.length) tags.push('沉默鐘樓');
        rows.push({map,npc,name,dungeons,terms:tags.join(' ').toLocaleLowerCase(),challenge:!!guideNames[npc.id]});
      }
    }
    return rows.sort((a,b) => Number(b.map.v === here) - Number(a.map.v === here));
  }
  function guides(host) {
    const controls = el('div', '', 'ga-search'), group = el('select');
    group.setAttribute('aria-label', '人物與入口分類');
    for (const [id, name] of [['challenge','副本與挑戰'],['here','目前城鎮'],['buyers','裝備收購'],['all','各城人物']]) group.add(new Option(name,id));
    const input = searchBox('搜尋任務、副本、人物或城鎮');
    const count = el('p','','ga-guide-count'), list = el('div','','ga-guide-list');
    count.setAttribute('aria-live','polite');controls.append(group,input);host.append(controls,count,list);
    function render() {
      const rows=guideRows();
      const term = input.value.trim().toLocaleLowerCase(), filter = group.value, frag = document.createDocumentFragment();
      let total = 0;
      for (const row of rows) {
        if (term ? !row.terms.includes(term) : (filter==='challenge' && !row.challenge || filter==='buyers'&&!row.npc._wanderer || filter==='here' && row.map.v!==mapState.current)) continue;
        const {map,npc} = row, b = el('button'), info = el('span'), town = DB.towns[map.v].n;
        b.type = 'button';b.dataset.npc = npc.id;b.dataset.town = map.v;
        const why = map.v===mapState.current?'':GiranBookmarks.mapReason(map), item=npc._wanderer&&DB.items[npc.itemId], detail = [town,item?('收購 '+(npc.en?'+'+npc.en+' ':'')+item.n):npc.n===row.name?npc.title:npc.n,why].filter(Boolean).join(' · ');
        const match = term && row.dungeons.find(name=>name.includes(term)||name.replaceAll('的','').includes(term));
        info.append(el('strong',match||row.name),el('small',detail));b.append(info,el('i',why?'—':'›'));
        b.disabled = !!why;b.title = why || '帶隊前往'+town+'與'+npc.n+'交談';
        b.onclick = () => {
          if (guest()||map.v!==mapState.current&&GiranBookmarks.mapReason(map)) {render();return;}
          if (mapState.current !== map.v) {
            GiranBookmarks.goToMap(map);
            if (mapState.current !== map.v) {count.textContent='目前無法離開所在地，請到世界頻道選擇「系統訊息」查看原因。';return;}
          }
          if (GiranTown.approachNpc(map.v,npc.id,npc.n)) GiranUI.pane(null);
        };
        frag.append(b);total++;
      }
      list.replaceChildren(frag);
      count.textContent = total ? total+' 個地點'+(term?'符合搜尋':'') : filter==='here'&&!term?'目前沒有城鎮人物。':filter==='buyers'?'目前各城沒有正在收裝備的旅人。':'沒有符合的地點。';
    }
    input.oninput=render;group.onchange=()=>{input.value='';render();};render();
  }

  const areas = {
    '冒險與成長':['m-afk-nav-wiki','m-afk-nav-dex','m-afk-nav-novel','m-afk-nav-train','m-afk-nav-gamehall'],
    '裝備與收藏':['btn-collection','m-afk-nav-relicbatch','m-afk-nav-junkmgr','btn-autosell'],
    '社群':['pvp'],
    '設定與存檔':['automation','afk-toggles-entry','display','recovery','logout']
  };
  function features(host, handlers) {
    const source = window.LineageMobile;
    const entries = new Map(source.menuEntries.map(([name,description,id])=>[id,{name,description}]));
    for(const id of ['guides','growth','weapons','armors','giran-party','giran-room','clan','giran-map','audit'])entries.delete(id);
    if(handlers.quickSettings)entries.delete('automation');
    const input = searchBox('搜尋功能'), list = el('div');
    host.append(input,list);
    function open(id) {
      if (['automation','clan','pvp'].includes(id)) return handlers.character(id);
      GiranUI.pane(null);
      if (id==='recovery') return LineageBoot.goRecovery();
      if (id==='afk-toggles-entry') return window.AFK_TOGGLES.openPanel();
      source.openMenuAction(id);
    }
    function render() {
      const term=input.value.trim().toLocaleLowerCase(), frag=document.createDocumentFragment(), used=new Set();
      const groups={...areas,'其他功能':[...entries.keys()].filter(id=>id!=='giran-map'&&!Object.values(areas).some(group=>group.includes(id)))};
      for (const [section,ids] of Object.entries(groups)) {
        const grid=el('div','','ga-feature-group');
        for (const id of ids) {
          const item=entries.get(id);
          if (!item || used.has(id) || id==='display'&&!window.AFK_MOBILE_SCALE || ![section,item.name,item.description].join(' ').toLocaleLowerCase().includes(term)) continue;
          used.add(id);
          const b=el('button');b.type='button';b.dataset.feature=id;if(id==='recovery')b.id='giran-recovery';b.title=item.description;
          const art=source.menuArt[id];
          if(art){const image=el('img');image.src=art;image.alt='';b.append(image);}
          b.append(el('span',item.name));
          const native=document.getElementById(id);
          if(id==='afk-toggles-entry')b.disabled=!window.AFK_TOGGLES?.openPanel;
          if(id.startsWith('m-afk-nav-')){
            b.disabled=(!native || native.disabled || native.hidden || native.style.display==='none') && !(id==='m-afk-nav-novel'&&window.__afkNovel);
            if(b.disabled)b.title='此功能目前未啟用';
          }
          b.onclick=()=>open(id);grid.append(b);
        }
        if(grid.children.length)frag.append(el('h3',section,'ga-subhead'),grid);
      }
      if(!frag.childNodes.length)frag.append(el('p','找不到符合的功能。','ga-empty'));
      list.replaceChildren(frag);
    }
    input.oninput=render;render();
  }
  return {guides,features,lockReason};
})();
