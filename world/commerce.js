'use strict';
window.GiranCommerce=(()=>{
  const key='lineage_giran_mail_v1';
  const supplies=[['potion_ult',200],['potion_haste',10],['ttmi_7003',10],['scroll_poly',10],['scroll_teleport',10]];
  const tiers={7:'iron',14:'mythic',21:'celestial',28:'spacetime'};
  const labels={iron:'一般變身鐵卡',mythic:'神話變身卡',celestial:'天上變身卡',spacetime:'時空變身卡'};
  const cycleDay=n=>(n-1)%28+1;
  function starterItems(){
    return supplies.map(([id,count])=>({id,count,name:DB.items[id].n,en:0,got:false}));
  }
  function welcome(){
    const now=Math.floor(Date.now()/1000);
    return {id:1,kind:'starter',sent:now-600,expire:now+30*86400,read:false,unc:true,
      atts:[{id:40308,name:'金幣',count:300000,got:false},{id:49142,name:'回憶蠟燭',count:3,got:false},...starterItems()]};
  }
  const isStarter=m=>m.id===1&&(m.kind==='starter'||m.title==='歡迎來到奇岩城');
  function read(){
    const raw=localStorage.getItem(key);
    if(raw===null)return {schema:1,messages:[welcome()]};
    const ledger=JSON.parse(raw);
    if(ledger.schema===1&&ledger.messages===undefined&&ledger.signin)ledger.messages=[welcome()];
    if(ledger.schema!==1||!Array.isArray(ledger.messages))throw Error('信箱格式無法讀取，請使用存檔工具檢查。');
    return ledger;
  }
  const put=ledger=>localStorage.setItem(key,JSON.stringify(ledger));
  function itemFor(a){
    if(!a||!Number.isSafeInteger(a.count)||a.count<1)return null;
    if(a.cardTier){
      const d=DB.items[a.id];
      if(a.count!==1||!d||!window.AFK_CARD_CODEX?.isOpen(player))return null;
      if(a.cardTier==='iron'){
        if(d.eff!=='afk_pcard'||d.pcardTier!==3||excludedForm(d.pcardForm))return null;
      }else if(!['mythic','celestial','spacetime'].includes(a.cardTier)||!AFK_CARD_ASCENSION.catalog[a.cardTier].some(row=>row.itemId===a.id&&!row.unique&&!excludedForm(row.n)))return null;
      return a;
    }
    if(a.id==='diamonds'||(supplies.some(([id])=>id===a.id)||['doll_bag','doll_box_high','afk_blood_dia'].includes(a.id))&&DB.items[a.id])return {id:a.id,count:a.count,en:0};
    if(!Number.isSafeInteger(a.id))return null;
    if(a.id===40308)return {id:'gold',count:a.count,en:0};
    const id=GiranAtlasData.itemIds[a.id],en=a.en??0;
    if(!DB.items[id]||!Number.isSafeInteger(en)||en<0||en>15)return null;
    return {id,count:a.count,en};
  }
  function deliver(id,count,en,bless=false){
    if(id==='gold'){
      if(!Number.isSafeInteger(player.gold+count))throw Error('金幣數量已達上限');
      player.gold+=count;return;
    }
    const def=DB.items[id];
    if(!def||!Number.isSafeInteger(count)||count<1)throw Error('找不到這件道具');
    if(!en&&!bless){
      const received=gainItem(id,count,true,true,false,true);
      if(received?.cnt!==count)throw Error(def.n+' 已達持有上限');
    }else{
      if(def.maxHold && player.inv.reduce((s,it)=>s+(it.id===id?it.cnt:0),0)+count>def.maxHold)throw Error(def.n+' 已達持有上限');
      const item={id,uid:uid(),cnt:count,en,bless,anc:false,attr:false,seteff:false,lock:false,junk:false};
      invAddOrStack(item);registerEquipObtained(id);registerMiscObtained(id);registerRelicObtained(id);
      if(typeof auditTrackGain==='function')auditTrackGain(item);
    }
  }
  function captain(){
    if(typeof player==='undefined'||!player?.cls||!currentSlot||player.dead||document.body.classList.contains('giran-guest'))
      throw Error('請使用自己的隊長進入遊戲');
  }
  function finish(ledger){
    const p=ledger.pending;
    if(!p)return [];
    const raw=_lzGet('lineage_idle_save_'+p.slot);
    const saved=raw&&LineageSaveBridge.inspect(raw).value.p;
    if(!saved||saved._roleEpoch!==p.epoch)throw Error('領信中的角色存檔已變更，請先從備份恢復該角色。');
    const committed=saved.giranMailReceipt===p.receipt;
    if(committed){
      // Gold and items are already saved with the captain. Finish the shared
      // wallet independently, including after a reload between the two writes.
      if(p.diamonds){
        const result=pandoraAdjustSharedDiamonds(p.diamonds,p.receipt);
        if(!result?.ok)throw Error('龍鑽尚未入帳，請稍後再領。');
      }
      for(const [i,j] of p.items){
        ledger.messages[i].atts[j].got=true;
        ledger.messages[i].read=true;
        ledger.messages[i].unc=ledger.messages[i].atts.some(a=>!a.got);
      }
    }
    delete ledger.pending;put(ledger);return committed?p.items:[];
  }
  function change(action){
    return LineageLocalActionLock('giran-mail-account',()=>{
      captain();const ledger=read(),recovered=finish(ledger);
      for(const message of ledger.messages){
        if(isStarter(message)&&Array.isArray(message.atts)){
          message.kind='starter';delete message.title;delete message.body;
          const proof=message.atts.findIndex(a=>a.id===49238&&!a.got);
          if(message.unc&&proof>=0)message.atts.splice(proof,1,...starterItems());
        }
        const dayNumber=/^第 ([1-7]) 天簽到補給$/.exec(message.title||'');
        if(dayNumber&&String(message.id).startsWith('signin-')){
          if(!message.signinDay&&message.unc&&message.atts?.length&&message.atts.every(a=>!a.got))Object.assign(message,signInGift(Number(dayNumber[1])));
          if(message.body?.startsWith('奇岩商會送來第 '))message.body='次元聯合'+message.body.slice(4);
        }
        for(const a of message.atts||[]){
          if(!a.got && !itemFor(a) && (GiranAtlas.isRetired(a.id) || GiranAtlas.isRetiredNumber(a.id))){a.retired=true;a.got=true;}
        }
        if(message.atts?.some(a=>a.retired))message.unc=message.atts.some(a=>!a.got);
      }
      const result=action(ledger,recovered);put(ledger);return result;
    });
  }
  function claim(id){
    return change((ledger,recovered)=>{
      const items=[];
      ledger.messages.forEach((m,i)=>{
        if(!m.unc||(id!==null&&m.id!==id))return;
        (m.atts||[]).forEach((a,j)=>{if(!a.got&&itemFor(a))items.push([i,j]);});
      });
      const resumed=recovered.filter(([i])=>id===null||ledger.messages[i].id===id).length;
      if(!items.length){if(resumed)return resumed;throw Error('沒有可領取的附件');}
      if(!player._roleEpoch){if(!saveGame()||!player._roleEpoch)throw Error('角色身分尚未保存');}
      const receipt=LineageClientCrypto.uuid();
      const diamonds=items.reduce((sum,[i,j])=>{const a=ledger.messages[i].atts[j];return sum+(a.id==='diamonds'?a.count:0);},0);
      ledger.pending={slot:currentSlot,epoch:player._roleEpoch,receipt,items,diamonds};put(ledger);
      const cardResults=[];
      try{
        LineageGrowth.transaction('次元聯合領信',()=>{
          for(const [i,j] of items){
            const a=itemFor(ledger.messages[i].atts[j]);
            if(a.cardTier&&a.cardTier!=='iron')cardResults.push(AFK_CARD_ASCENSION.grantSignInCard(a.cardTier,DB.items[a.id].cardAscensionId));
            else if(a.id!=='diamonds')deliver(a.id,a.count,a.en);
          }
          player.giranMailReceipt=receipt;
        },disk=>disk.p.giranMailReceipt===receipt&&disk.p.gold===player.gold&&JSON.stringify(disk.p.inv)===JSON.stringify(player.inv)&&JSON.stringify(disk.p.cardAscension)===JSON.stringify(player.cardAscension));
      }finally{finish(ledger);}
      window.__afkTpAbsorb?.();
      for(const text of cardResults)logSys(text);
      logSys('次元聯合信箱：領取 '+(items.length+resumed)+' 份附件。');return items.length+resumed;
    });
  }
  function excludedForm(name){return String(name).replace(/\s/g,'').includes('支配者吉爾塔斯');}
  function drawCard(tier){
    const book=window.AFK_POLY_CODEX;
    const pool=tier==='iron'
      ?book.forms.filter(f=>!excludedForm(f.n)).map(f=>book.itemId(f.n,3))
      :AFK_CARD_ASCENSION.catalog[tier].filter(row=>!row.unique&&!excludedForm(row.n)).map(row=>row.itemId);
    if(!pool.length)throw Error('目前無法讀取'+labels[tier]+'的卡池，請稍後再簽到。');
    const id=pool[Math.floor(Math.random()*pool.length)];
    return {id,name:DB.items[id].n,count:1,cardTier:tier};
  }
  function signInGift(n){
    const atts=[{id:40308,name:'金幣',count:5000000},{id:'diamonds',name:'龍鑽',count:1000}];
    if(n===7)atts.push({id:'afk_blood_dia',name:'血龍鑽',count:50});
    const tier=tiers[n],eligible=!!tier&&window.AFK_CARD_CODEX?.isOpen(player);
    if(eligible)atts.push(drawCard(tier));
    const note=tier&&!eligible?' 這次簽到時尚未開啟神話變身卡冊。':'';
    return {signinDay:n,body:'次元聯合送來第 '+n+' 天的簽到補給。'+note,atts};
  }
  const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  async function signIn(){
    const today=day(),id='signin-'+today,slot=currentSlot;
    const completed=await change((l,recovered)=>{
      const entry=l.signin||={next:1,lastDay:''};
      if(entry.lastDay===today){
        if(recovered.some(([i])=>l.messages[i].id===id)&&!l.messages.find(m=>m.id===id)?.unc)return true;
        if(l.messages.some(m=>m.id===id&&m.unc))return;
        throw Error('今天已經領過簽到補給');
      }
      if(entry.lastDay>today||l.messages.some(m=>m.id===id))throw Error('這個日期已經簽到，請在下一個簽到日再來。');
      const n=cycleDay(entry.next);
      const stamp=Math.floor(Date.now()/1000);
      l.messages.push({id,title:'第 '+n+' 天簽到補給',read:false,unc:true,sent:stamp,...signInGift(n)});
      entry.next++;entry.lastDay=today;
    });
    if(slot!==currentSlot)return '簽到補給已放入信箱';
    if(!completed)await claim(id);return '簽到補給已入帳';
  }
  function render(box){
    let mode='mail',selected=null;
    const section=document.createElement('section');section.className='g-commerce';box.append(section);
    const controls=document.createElement('nav'),body=document.createElement('div'),status=document.createElement('output');
    status.setAttribute('aria-live','polite');section.append(controls,status,body);
    const element=(tag,content)=>{const el=document.createElement(tag);el.textContent=content;return el;};
    function button(parent,label,action){
      const b=element('button',label);b.type='button';b.onclick=async()=>{
        b.disabled=true;
        try{const message=await action();status.textContent=message||'';}catch(e){status.textContent=e.message;}
        finally{b.disabled=false;draw();}
      };parent.append(b);return b;
    }
    const modes=[['mail','系統信箱'],['signin','每日簽到']];
    for(const [id,name] of modes)button(controls,name,()=>{mode=id;});
    function draw(){
      body.replaceChildren();[...controls.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(mode===modes[i][0])));
      if(mode==='signin'){
        const l=read(),s=l.signin||{next:1,lastDay:''};
        const today=day(),signed=s.lastDay===today,ordinal=signed?s.next-1:s.next;
        body.append(element('p','第 '+(Math.floor((ordinal-1)/28)+1)+' 輪 · 第 '+cycleDay(ordinal)+' / 28 天'),
          element('p','每天 500 萬金幣與 1,000 龍鑽。第 7 天另有 50 血龍鑽。台灣時間午夜換日。'),
          element('p','神話變身卡冊開啟後，第 7 天抽一般變身鐵卡，第 14 天抽神話卡，第 21 天抽天上卡，第 28 天抽時空卡。每次一張，第 28 天後回到第 1 天。'));
        if(!window.AFK_CARD_CODEX?.isOpen(player))body.append(element('p','目前尚未開啟神話變身卡冊。可先在一般變身收集冊登錄 5 種鐵卡。'));
        const pending=l.messages.some(m=>m.id==='signin-'+today&&m.unc&&m.atts.some(a=>!a.got&&itemFor(a)));
        const b=button(body,pending?'領取今天的附件':signed?'今日已領':'簽到領補給',signIn);
        b.disabled=signed&&!pending;return;
      }
      let ledger;try{ledger=read();}catch(e){status.textContent=e.message;return;}
      const onlyStarter=ledger.messages.length===1&&isStarter(ledger.messages[0]);
      if(ledger.messages.length&&!onlyStarter)body.append(element('p','這個瀏覽器的角色共用次元聯合補給。領取時，金幣與道具交給目前的隊長，龍鑽存入共用餘額。'));
      if(!ledger.messages.length)body.append(element('p','信箱是空的。'));
      let any=false;
      for(const m of ledger.messages){
        const row=document.createElement('article'),attachments=Array.isArray(m.atts)?m.atts:[];
        if(isStarter(m)){
          const gifts=element('ul','');gifts.className='g-starter-gifts';
          for(const a of attachments){
            const gift=element('li',''),item=itemFor(a),name=a.name||'道具 '+a.id;
            const src=item?.id==='gold'?'assets/icons/items/金幣.png':item&&DB.items[item.id]?getIconUrl(DB.items[item.id]):null;
            const quantity='×'+a.count.toLocaleString('zh-TW'),received=a.got||!m.unc;
            gift.title=name+' '+quantity+(received?'　已領取':'');
            if(src){const img=document.createElement('img');img.src=src;img.alt=name;gift.append(img);}
            else gift.append(document.createTextNode(name));
            gift.append(element('span',quantity));
            if(received){const mark=element('span','✓');mark.setAttribute('aria-label','已領取');gift.append(mark);}
            gifts.append(gift);
          }
          row.append(gifts);
        }else{
          const readable=button(row,(m.read?'':'未讀 · ')+m.title,async()=>{
            await change(l=>{const entry=l.messages.find(v=>v.id===m.id);if(entry)entry.read=true;});
            selected=selected===m.id?null:m.id;
          });readable.setAttribute('aria-expanded',String(selected===m.id));
          if(selected===m.id){row.append(element('p',m.body||''));for(const a of attachments)row.append(element('small',(a.name||'道具 '+a.id)+' ×'+a.count+(!m.unc||a.got?'　已領取':!itemFor(a)?(a.cardTier?'　需開啟神話變身卡冊':'　保留於原檔'):'')));}
        }
        if(m.unc&&attachments.some(a=>!a.got&&itemFor(a))){any=true;button(row,'領取附件',async()=> '已領取 '+await claim(m.id)+' 份附件');}
        body.append(row);
      }
      if(any&&!onlyStarter)button(body,'全部領取',async()=>'已領取 '+await claim(null)+' 份附件');
      if(ledger.messages.some(m=>!m.unc))button(body,'清除已領信件',async()=>{await change(l=>{l.messages=l.messages.filter(m=>m.unc);});return '已清除已領信件';});
    }
    change(()=>{}).then(draw,e=>{status.textContent=e.message;});
  }
  (window.__afkMarketTabs||=[]).push({id:'giran-commerce',label:'次元聯合',show:()=>typeof player!=='undefined'&&!!player?.cls,render});
  return {claim,key,read,signIn};
})();
