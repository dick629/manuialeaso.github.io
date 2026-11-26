'use strict';
(() => {
  const panel=GiranUI.tools;
  if(!LineageSite.roomsEnabled){
    panel.textContent='功能暫未啟用';
    return;
  }
  panel.innerHTML='<h2>多人小隊</h2><div class="g-connect"><button id="gr-create">建立隊伍</button><input id="gr-code" aria-label="隊伍邀請碼" placeholder="隊長邀請碼" maxlength="12"><button id="gr-join">以目前隊長加入</button></div><output id="gr-status" aria-live="polite"></output><div id="gr-members"></div><div class="g-social" hidden><div id="gr-chat"></div><input id="gr-text" aria-label="隊伍訊息" maxlength="240" placeholder="隊伍訊息"><button id="gr-say">傳送</button><button id="gr-leave">離隊</button></div>';
  const $=id=>document.getElementById(id), status=text=>{$('gr-status').textContent=text;};
  const recipients=document.createElement('select');recipients.id='gr-recipient';recipients.setAttribute('aria-label','訊息收件人');recipients.add(new Option('全隊頻道',''));
  $('gr-chat').after(recipients);
  const friends=document.createElement('details');friends.className='g-friends';
  friends.innerHTML='<summary>好友名單</summary><div><input id="gr-friend-name" maxlength="32" aria-label="好友名稱" placeholder="角色名稱"><button id="gr-friend-add" type="button">加入好友</button></div><ul id="gr-friends"></ul>';
  panel.append(friends);
  const mirror=document.createElement('div');mirror.id='giran-peer';mirror.hidden=true;mirror.innerHTML='<div class="g-peer-field"><img class="g-peer-ground" alt=""><div class="g-peer-actors"></div><b></b></div>';document.body.append(mirror);
  let session=null,busy=false,seq=-1,lastGround=0,ground='',map='',hostSlots=new Map(),savedLocal='',ownSlot=0;
  const checkpointInterval=5*60_000, settledAt=new Map();
  let ver=-1,lastRoom=null,leaveRequested=false,closing=false,tickDone=Promise.resolve();
  const link='giran.room.v1';let checkpoint='',resuming=false,hostIdentity='',temporary=new Map();
  window.GiranGuestSlot=slot=>[...temporary.values()].some(entry=>String(entry.slot)===String(slot));
  const friendKey='lineage_giran_friends_v1';let contacts=[],contactState='',friendState='';
  function friendBook(){
    const actor=session&&!session.host?LineageSaveBridge.decode(savedLocal).value.p:player;
    const owner=JSON.stringify([actor?.enSeed||currentSlot,actor?.cls]);
    const all=JSON.parse(localStorage.getItem(friendKey)||'{}');
    return {all,owner,names:Array.isArray(all[owner])?all[owner]:[]};
  }
  function editFriend(name,add){
    name=String(name||'').trim().slice(0,32);if(!name)return;
    const {all,owner,names}=friendBook(),next=names.filter(n=>n!==name);
    if(add){if(next.length>=50){status('每位角色最多可加入 50 位好友');return;}next.push(name);}
    all[owner]=next;localStorage.setItem(friendKey,JSON.stringify(all));drawFriends();
  }
  function drawFriends(){
    if(!friends.open)return;
    const box=$('gr-friends'),{names}=friendBook();
    const stamp=JSON.stringify([names,contacts]);if(stamp===friendState)return;friendState=stamp;
    box.replaceChildren();
    for(const name of names){
      const contact=contacts.find(c=>c.name===name),li=document.createElement('li'),label=document.createElement('span');
      label.textContent=name+(contact?'　隊中':'　未在本隊');li.append(label);
      if(contact){const whisper=document.createElement('button');whisper.type='button';whisper.textContent='密語';whisper.onclick=()=>{recipients.value=contact.id;window.dispatchEvent(new Event('giran-open-room-chat'));$('gr-text').focus();};li.append(whisper);}
      const remove=document.createElement('button');remove.textContent='移除';remove.type='button';remove.onclick=()=>editFriend(name,false);li.append(remove);box.append(li);
    }
    if(!names.length){const row=document.createElement('li');row.textContent='尚無好友';box.append(row);}
  }
  friends.ontoggle=()=>{if(friends.open){friendState='';drawFriends();}};
  $('gr-friend-add').onclick=()=>{const input=$('gr-friend-name');editFriend(input.value,true);input.value='';};
  function setContacts(data){
    const members=data.people.filter(p=>p.status==='joined'&&p.id!==data.self?.id).map(p=>({id:p.id,name:p.name}));
    if(!session.host)members.unshift({id:'host',name:data.host});
    const stamp=JSON.stringify(members);if(stamp===contactState)return;
    contacts=members;contactState=stamp;const previous=recipients.value;
    recipients.replaceChildren(new Option('全隊頻道',''));for(const m of members)recipients.add(new Option('密語給 '+m.name,m.id));
    if(members.some(m=>m.id===previous))recipients.value=previous;drawFriends();
  }
  function persist(){sessionStorage.setItem(link,JSON.stringify({session,ownSlot,savedLocal,checkpoint,hostIdentity,leaveRequested,slots:[...hostSlots],temporary:[...temporary],settledAt:[...settledAt]}));}
  function guestView(){document.body.classList.add('giran-guest');mirror.hidden=false;panel.hidden=false;show();}
  async function api(action,params={},summary){
    const headers={'Content-Type':'application/json'};
    if(action==='create'||action==='join')Object.assign(headers,await LineageTransfer.identityHeaders());
    if(summary)headers['x-save-summary']=summary;
    const res=await fetch(LineageSite.rooms+'/'+action,{method:'POST',credentials:'omit',headers,body:JSON.stringify({...session,...params})});
    const value=await res.json();if(!res.ok)throw Object.assign(Error(value.error||'連線失敗'),{status:res.status});return value;
  }
  function show(){panel.querySelector('.g-connect').hidden=!!session;panel.querySelector('.g-social').hidden=!session;window.dispatchEvent(new Event('giran-room-change'));}
  async function replaceSlot(n,before,after,type){
    const key='lineage_idle_save_'+n;
    const job=()=>LineageRecovery.transact(localStorage,[{key,before,after,reason:type}],s=>LineageBackups.save(s,type));
    return navigator.locks?navigator.locks.request('lineage-merged-save-write',job):job();
  }
  function roomState(){
    const town=mapState.current.startsWith('town_'),view=town?$('town-npc-map'):$('battle-view');
    const terrain=town?GiranTown.terrain:GiranCombat.field?.terrain;
    const canvas=terrain?.canvas;if(!canvas?.width)return null;
    const signature=mapState.current+'/'+terrain.kind;
    if(!ground || signature!==map || performance.now()-lastGround>1800){
      const small=document.createElement('canvas');small.width=Math.min(920,canvas.width);small.height=Math.round(canvas.height*small.width/canvas.width);small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
      ground=small.toDataURL('image/webp',.66);map=signature;lastGround=performance.now();
    }
    const rect=view.getBoundingClientRect(), units=[];
    if(!rect.width || !rect.height)return null;
    const matches=town?'.g-town-unit,.town-npc,.g-world-gate':'#player-morph-sprite,.party-sprite,.mob-target[data-uid],#pet-layer [data-pet],.dm-action-trail';
    const partySlots=new Map([['hero',0]]);
    GiranPartyView.visibleAllies().forEach((ally,index)=>partySlots.set('a'+ally._slot,index+1));
    for(const [i,el] of [...view.querySelectorAll(matches)].entries()){
      const slot=el.classList.contains('g-town-unit')?el.dataset.slot:el.id==='player-morph-sprite'?'hero':el.classList.contains('party-sprite')?'a'+el.dataset.memberSlot:null;
      if(slot!=null&&!partySlots.has(slot))continue;
      let im=el.matches('.dm-walking,.dm-performing')?el.querySelector('.stride-body'):null;
      im||=el.querySelector('.pm-body,.pet-body,.tn-body,.mob-img-inner img:not([class*="shadow"]):not([class*="weapon"]),img');
      const source=im?.dmSourceFrame||im;
      if(!source?.naturalWidth)continue;
      const b=im.getBoundingClientRect();if(!b.width||!b.height)continue;
      const frame=source.dmFrameUrl||source.currentSrc||source.src;
      const src=new URL(window.__afkFrameSource?.(frame)||frame,location.href);
      let scenePath=src.pathname;
      if(src.origin!==location.origin){
        const key=LineageMedia.remoteKey(src);
        if(!key)continue;
        scenePath=new URL(key.split('/').map(encodeURIComponent).join('/'),LineageMedia.site).pathname;
      }
      const u={id:slot!=null?'party/'+slot:el.id||el.dataset.worldNpc||el.dataset.pet||el.dataset.uid||'unit'+i,src:scenePath,x:(b.left-rect.left)/rect.width,y:(b.top-rect.top)/rect.height,w:b.width/rect.width,h:b.height/rect.height};
      u.partyIndex=slot==null?null:partySlots.get(slot);
      units.push(u);
    }
    const lead=town?GiranTown.leader:GiranCombat.field?.leader;
    const pos=lead&&terrain.world&&terrain.camera?terrain.project(lead.fx,lead.fy):null;
    const cap=view.querySelector('.g-captain-mark');
    const captain=pos?{name:player.name,x:pos[0]/view.clientWidth,y:pos[1]/view.clientHeight,
      height:(parseFloat(cap?.style.getPropertyValue('--captain-head'))||72)/view.clientHeight}:null;
    return {place:GiranUI.placeName(mapState.current),key:mapState.current,ground,units,captain};
  }
  function paint(scene){
    if(!scene)return;
    const field=mirror.firstChild,actors=field.children[1];if(field.firstChild.src!==scene.ground)field.firstChild.src=scene.ground;
    field.lastChild.textContent=scene.place;
    const keep=new Set(),existing=new Map([...actors.children].map(n=>[n.dataset.id,n]));
    const legacyCaptain=scene.units?.some(u=>u.id==='player-morph-sprite');
    let legacyIndex=legacyCaptain?1:0;
    for(const u of scene.units||[]){
      if(!u.src?.startsWith('/') || u.src.startsWith('//'))continue;
      const key=String(u.id);
      // Older room snapshots did not label humans. Their captain and unnamed party sprites used these IDs.
      const index=Object.hasOwn(u,'partyIndex')?u.partyIndex:(key==='player-morph-sprite'?0:/^unit\d+$/.test(key)?legacyIndex++:null);
      if(index!=null&&index>=GiranPartyView.limit)continue;
      let im=existing.get(key);
      if(!im){im=new Image();im.dataset.id=key;actors.append(im);}keep.add(im);
      if(im.dataset.scenePath!==u.src){im.src=u.src;im.dataset.scenePath=u.src;}
      Object.assign(im.style,{left:u.x*100+'%',top:u.y*100+'%',width:u.w*100+'%',height:u.h*100+'%'});
    }
    let mark=actors.querySelector('.g-peer-captain');
    const captain=scene.captain;
    if(captain&&Number.isFinite(captain.x)&&Number.isFinite(captain.y)){
      if(!mark){mark=document.createElement('div');mark.className='g-peer-captain';mark.append(document.createElement('b'));actors.append(mark);}
      mark.firstChild.textContent='♛ 隊長・'+String(captain.name||'隊長');
      Object.assign(mark.style,{left:captain.x*100+'%',top:captain.y*100+'%'});
      mark.style.setProperty('--captain-head',Math.max(32,captain.height*field.clientHeight)+'px');keep.add(mark);
    }
    for(const im of [...actors.children])if(!keep.has(im))im.remove();
  }
  async function admit(p){
    const guest=LineageSaveBridge.decode(p.raw).value.p;
    let free=0;const identity=JSON.stringify([guest.enSeed,guest.cls,guest.name]);
    const staged=temporary.get(p.id);
    for(let i=1;i<=SAVE_SLOT_MAX;i++){
      if(String(i)===String(currentSlot))continue;
      const raw=localStorage.getItem('lineage_idle_save_'+i);
      if(!raw){if(!free)free=i;continue;}
      if(isAllyActive(i)&&i!==staged?.slot){
        const actor=LineageSaveBridge.decode(raw).value.p;
        if(JSON.stringify([actor.enSeed,actor.cls,actor.name])===identity){await api('member',{member:p.id,status:'declined'});return;}
      }
    }
    const slot=staged?.slot||free;
    if(!slot || !!guest.classicMode!==!!player.classicMode || (!isAllyActive(slot) && player.allies.filter(Boolean).length>=allyActiveCap())){await api('member',{member:p.id,status:'declined'});return;}
    const before=localStorage.getItem('lineage_idle_save_'+slot);
    if(!staged){if(before)throw Error('隊員暫存欄正在使用');await replaceSlot(slot,null,p.raw,'多人加入');temporary.set(p.id,{slot,identity});persist();}
    if(!isAllyActive(slot))toggleAlly(String(slot));
    if(!isAllyActive(slot)){await releaseGuest(p.id);await api('member',{member:p.id,status:'declined'});return;}
    hostSlots.set(p.id,slot);saveGame();persist();
    await api('member',{member:p.id,status:'joined',slot,raw:localStorage.getItem('lineage_idle_save_'+slot)});
    settledAt.set(p.id,Date.now());persist();
  }
  async function releaseGuest(id){
    const entry=temporary.get(id);if(!entry)return;
    const raw=localStorage.getItem('lineage_idle_save_'+entry.slot);
    if(raw){
      const actor=LineageSaveBridge.decode(raw).value.p;
      if(JSON.stringify([actor.enSeed,actor.cls,actor.name])!==entry.identity)throw Error('隊員暫存欄已有不同角色，保留原檔');
      await replaceSlot(entry.slot,raw,null,'隊員離隊後收回暫存欄');
    }
    temporary.delete(id);hostSlots.delete(id);settledAt.delete(id);persist();
  }
  async function settle(id,slot,leave){
    const who=player.allies?.find(a=>a?._slot===String(slot));
    if(who && _settleAllyExpDirect(who,'多人結算')===null)throw Error('隊員結算暫時失敗');
    if(leave && who)toggleAlly(String(slot));
    if(leave)saveGame();
    const raw=localStorage.getItem('lineage_idle_save_'+slot);
    if(!raw)throw Error('找不到隊員的結算存檔');
    await api('member',{member:id,status:leave?'settled':'joined',slot,raw});
    if(leave){await releaseGuest(id);hostSlots.delete(id);settledAt.delete(id);}else settledAt.set(id,Date.now());
    persist();
  }
  function end(){clearTimeout(pollTimer);sessionStorage.removeItem(link);session=null;seq=-1;ver=-1;lastRoom=null;leaveRequested=false;settledAt.clear();resuming=false;checkpoint='';hostSlots.clear();temporary.clear();contacts=[];contactState='';friendState='';friends.open=false;mirror.hidden=true;document.body.classList.remove('giran-guest');panel.hidden=true;show();}
  function packedRole(role){
    return 'LZ1:'+LineageLegacyCodec.compress(LineageSaveBridge.encodeRole(role));
  }
  async function finishGuest(self){
    if(self.reply && self.reply!==savedLocal){
      const incoming=LineageSaveBridge.decode(self.reply).value,original=LineageSaveBridge.decode(savedLocal).value;
      const next=incoming.p,prior=original.p;
      if(next.enSeed!==prior.enSeed || next.cls!==prior.cls)throw Error('隊員身分不符，請保留連線及備份');
      const current=localStorage.getItem('lineage_idle_save_'+ownSlot);
      // Guest squad slots are local to the guest's browser. Only the captain traveled.
      if(Object.hasOwn(prior,'allies'))next.allies=prior.allies;else delete next.allies;
      if(current!==savedLocal){
        const local=LineageSaveBridge.decode(current).value;
        const project=role=>{const p={...role.p};for(const name of ['_devSeq','_saveSeq','_savedAt','mercLedgerOutbox'])delete p[name];return JSON.stringify({...role,p});};
        if(project(local)!==project(original))throw Error('這個角色另有遊戲進度，已保留本機與隊伍存檔');
        const ledger=new Map();for(const row of [...(next.mercLedgerOutbox||[]),...(local.p.mercLedgerOutbox||[])])if(row?.uid)ledger.set(row.uid,row);
        next.mercLedgerOutbox=[...ledger.values()];next._devSeq={...(next._devSeq||{})};
        for(const [id,n] of Object.entries(local.p._devSeq||{}))next._devSeq[id]=Math.max(Number(n)||0,Number(next._devSeq[id])||0);
        next._saveSeq=Math.max(next._saveSeq||0,local.p._saveSeq||0);next._savedAt=Math.max(next._savedAt||0,local.p._savedAt||0);
      }
      const after=packedRole(incoming);
      await replaceSlot(ownSlot,current,after,'多人進度同步');savedLocal=after;
    }
    end();if(typeof renderLoadSelect==='function')renderLoadSelect();
  }
  let pollTimer=0, lastPollAt=0, refreshQueued=false;
  function schedulePoll(){
    clearTimeout(pollTimer);
    if(!session||busy||closing)return;
    const roomVisible=!document.hidden&&panel.getClientRects().length>0;
    const interval=roomVisible?10_000:60_000;
    const elapsed=performance.now()-lastPollAt;
    pollTimer=setTimeout(tick,Math.max(0,interval-elapsed));
  }
  function refreshRoom(){
    if(busy){refreshQueued=true;return;}
    return tick();
  }
  const roomVisibility=new MutationObserver(schedulePoll);
  roomVisibility.observe(panel,{attributes:true,attributeFilter:['hidden']});
  roomVisibility.observe(document.body,{attributes:true,attributeFilter:['data-giran-pane']});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)schedulePoll();
    else if(session)refreshRoom();
  });
  async function tick(){
    if(!session || busy || closing)return;
    let finishTick;tickDone=new Promise(resolve=>{finishTick=resolve;});
    clearTimeout(pollTimer);busy=true;lastPollAt=performance.now();
    const current=session;
    try{
      const reply=await api('poll',{seq,ver});if(session!==current)return;
      // Keep pending members available for admission when the captain returns to town.
      const data=reply.same?{...lastRoom,scene:null}:reply;
      if(!reply.same)lastRoom=reply;
      seq=reply.seq;ver=Number.isInteger(reply.ver)?reply.ver:-1;
      if(Array.isArray(data.people))setContacts(data);
      if(Array.isArray(data.roster))$('gr-members').textContent=data.roster.map(v=>v.name+'　'+v.hp+' / '+v.max).join('\n');
      const log=$('gr-chat'), messages=data.chat||[], signature=JSON.stringify(messages);
      if(Array.isArray(data.chat)&&log._chatSignature!==signature){
        const pinned=log.scrollHeight-log.scrollTop-log.clientHeight<30;
        log._chatSignature=signature;
        log.replaceChildren(...messages.map(c=>{
          const line=document.createElement('div');
          line.className=c.to?'ga-whisper':'ga-party-say';
          line.textContent=(c.to?'〔密語〕':'')+c.name+'　'+c.text;
          return line;
        }));
        if(pinned)log.scrollTop=log.scrollHeight;
      }
      if(session.host){
        if(resuming){
          if(!player?.cls||String(currentSlot)!==String(ownSlot)||document.getElementById('game-screen').classList.contains('hidden')){
            const raw=localStorage.getItem('lineage_idle_save_'+ownSlot);
            if(!raw||String(LineageSaveBridge.decode(raw).value.p.enSeed)!==hostIdentity){end();return;}
            if(!document.getElementById('main-menu').classList.contains('hidden'))openLoadSelect();
            loadSetPage(Math.ceil(ownSlot/4));loadSelectSlot(ownSlot);loadEnterSelected();return;
          }
          if(String(player.enSeed)!==hostIdentity){end();return;}
          resuming=false;status('隊伍邀請碼　'+session.id);
        }
        for(const p of data.people||[]) {
          if((p.status==='joined'||p.status==='leaving') && p.slot)hostSlots.set(p.id,p.slot);
          if(p.status==='waiting'&&mapState.current.startsWith('town_')){await admit(p);refreshQueued=true;}
          if(p.status==='leaving'&&hostSlots.has(p.id)){await settle(p.id,hostSlots.get(p.id),true);refreshQueued=true;}
          if(p.status==='settled' && temporary.has(p.id))await releaseGuest(p.id);
        }
        for(const [id,slot] of hostSlots){
          if(Date.now()-(settledAt.get(id)||0)>=checkpointInterval)await settle(id,slot,false);
        }
        const scene=hostSlots.size?roomState():null;if(scene)await api('publish',{scene,roster:[player,...GiranPartyView.combatAllies()].filter(Boolean).map(p=>({name:p.name||p.cls,hp:Math.floor(p===player?p.hp:p.curHp),max:p.mhp||p.d?.mhp||1}))});
      }else if(data.self){
        const me=data.self;
        if(me.reply && checkpoint!==me.reply){checkpoint=me.reply;persist();}
        if(me.status==='settled' || me.status==='declined'){await finishGuest(me);return;}
        // A checkpoint already in transit can acknowledge "joined" after our leave request.
        if(leaveRequested){
          if(me.status==='joined'||me.status==='waiting')await api('leave');
          status('等候隊長結算角色經驗');return;
        }
        status(me.status==='waiting'?'等候隊長在村莊接應':'跟隨 '+data.host+'　隊員自動作戰');paint(data.scene);
      }
    }catch(e){
      status(e.message);window.GiranDiagnostics?.record('多人',e.message);
      if(session && (e.status===404 || e.status===410)){
        if(session.host)end();
        else try{await finishGuest({reply:checkpoint});}catch(error){status(error.message);}
      }
    }finally{
      busy=false;finishTick();
      if(refreshQueued){refreshQueued=false;if(session)void tick();}
      else schedulePoll();
    }
  }
  function click(id,fn){$(id).onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await fn();}catch(err){status(err.message);}finally{b.disabled=false;}};}
  click('gr-create',async()=>{
    if(!mapState.current.startsWith('town_'))throw Error('請在村莊集結隊伍');
    if(!saveGame())throw Error('建立房間前存檔失敗');
    session=await api('create',{name:player.name});ownSlot=Number(currentSlot);hostIdentity=String(player.enSeed);persist();
    show();status('隊伍邀請碼　'+session.id);await refreshRoom();
  });
  click('gr-join',async()=>{
    if(!mapState.current.startsWith('town_') || !saveGame())throw Error('請先回村並成功存檔');
    ownSlot=Number(currentSlot);const invite=$('gr-code').value.trim(),name=player.name;
    returnToCharacterSelect();window.GiranPartyGuestPending=true;savedLocal=localStorage.getItem('lineage_idle_save_'+ownSlot);
    let answer;
    try{
      const role=LineageSaveBridge.inspect(savedLocal).value;
      role.p.allies=[];
      const identity=JSON.stringify([role.p.enSeed,role.p.cls,role.p.name]);
      answer=await api('join',{id:invite,raw:packedRole(role),name,identity},LineageSaveSummary.role(role));
    }
    catch(error){window.GiranPartyGuestPending=false;loadSelectSlot(ownSlot);loadEnterSelected();GiranUI.pane('room');throw error;}
    session=answer;persist();status('等候隊長在村莊接應');guestView();window.GiranPartyGuestPending=false;await refreshRoom();
  });
  click('gr-say',async()=>{const text=$('gr-text').value;if(text){await api('chat',{text,to:recipients.value});$('gr-text').value='';await refreshRoom();}});
  click('gr-leave',async()=>{
    if(session.host){
      closing=true;clearTimeout(pollTimer);
      try{
        await tickDone;
        if(!session)return;
        for(const [id,slot] of hostSlots)await settle(id,slot,true);
        await api('close');end();GiranUI.pane(null);
      }finally{closing=false;schedulePoll();}
    }
    else{leaveRequested=true;persist();await api('leave');status('等候隊長結算角色經驗');await refreshRoom();}
  });
  try{
    const saved=JSON.parse(sessionStorage.getItem(link)||'null');
    if(saved?.session?.id && saved.session.token){
      session=saved.session;ownSlot=saved.ownSlot;savedLocal=saved.savedLocal;checkpoint=saved.checkpoint||'';hostIdentity=saved.hostIdentity;leaveRequested=!!saved.leaveRequested;
      for(const [id,time] of saved.settledAt||[])settledAt.set(id,time);
      hostSlots=new Map(saved.slots||[]);temporary=new Map(saved.temporary||[]);resuming=!!session.host;
      if(session.host)show();else guestView();
    }
  }catch{end();}
  if(session)void tick();
})();
