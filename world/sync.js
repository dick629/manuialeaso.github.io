'use strict';
window.GiranSync=(()=>{
  let database, profileReady, pendingRestore=null, linked, queue=Promise.resolve();
  const pendingKey='giran.sync.pending', quotaMessage='今天的同步次數已用完';
  function openSettings(){
    return database ||= new Promise((resolve,reject)=>{
      const req=indexedDB.open('giran-sync-settings',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('link');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{database=null;reject(req.error);};
    });
  }
  async function settings(value){
    const db=await openSettings();
    return new Promise((resolve,reject)=>{
      const isWrite=value!==undefined,tx=db.transaction('link',isWrite?'readwrite':'readonly'),store=tx.objectStore('link');
      const req=!isWrite?store.get('current'):value===null?store.delete('current'):store.put(value,'current');
      tx.oncomplete=()=>{const result=isWrite?value:req.result;linked=!!result;resolve(result);};
      tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('未能儲存同步設定'));
    });
  }
  async function request(action,data,leaving=false){
    const url=new URL(LineageSite.sync+'/'+action,location.href);
    if(data.id)url.searchParams.set('id',data.id);
    if(action==='read'){
      if(data.meta)url.searchParams.set('meta','1');
      const res=await fetch(url,{cache:'no-store',credentials:'omit'});
      if(!res.ok)throw await LineageTransfer.error(res);
      if(data.meta)return res.json();
      const revision=Number(res.headers.get('x-sync-revision')), updated=res.headers.get('x-sync-updated');
      if(!Number.isSafeInteger(revision)||revision<1||!Number.isFinite(Date.parse(updated)))throw Error('同步庫未提供有效的版本與時間，請稍後再試。');
      return {id:data.id,revision,updated,bundle:JSON.parse(await LineageTransfer.unpackText(res))};
    }
    if(action==='write')url.searchParams.set('revision',String(data.revision));
    const headers={'Content-Type':'application/octet-stream',...await LineageTransfer.identityHeaders(),
      'x-save-summary':LineageSaveSummary.bundle(data.bundle)};
    const body=await LineageTransfer.packBody(JSON.stringify(data.bundle));
    if(body.size>10*1024*1024)throw Object.assign(Error('同步存檔超過 10 MB'),{status:413});
    const res=await fetch(url,{method:'POST',credentials:'omit',headers,body,keepalive:leaving&&body.size<=60*1024});
    if(!res.ok)throw await LineageTransfer.error(res);
    return res.json();
  }
  function captured(legacy=false){
    window.GiranJournal?.flush();
    const keys=LineageRecovery.capture(localStorage);
    if(!LineageSaveBridge.roleKeys(keys).length)throw Error('這個瀏覽器尚未有角色存檔');
    if(!legacy)return LineageTransfer.forCode(keys);
    for(const k of Object.keys(keys))if(/^afk_diag_/.test(k)||['fb5_active_role_sessions_v1','lineage_admin_receipts_v1','lineage_growth_transaction_backup_v1'].includes(k))delete keys[k];
    return keys;
  }
  async function checksum(keys){
    const raw=JSON.stringify(Object.keys(keys).sort().map(k=>[k,keys[k]]));
    return LineageClientCrypto.sha256(raw);
  }
  async function currentLink(){
    const link=await settings();
    if(!link||link.digestVersion===2)return link;
    const old=captured(true), filtered=LineageTransfer.forCode(old);
    const digest=await checksum(old)===link.digest?await checksum(filtered):link.digest;
    return settings({...link,digest,digestVersion:2,quotaUntil:0});
  }
  function committed(reply,digest){
    const next={id:reply.id,revision:reply.revision,updated:reply.updated,digest,digestVersion:2,paused:false};
    if(reply.left===0){
      const offset=8*3600_000,day=86_400_000;
      next.quotaUntil=(Math.floor((Date.parse(reply.updated)+offset)/day)+1)*day-offset;
    }
    return settings(next);
  }
  function exclusive(fn){
    if(navigator.locks)return navigator.locks.request('giran-sync-revision',fn);
    const next=queue.then(fn);
    queue=next.catch(()=>{});
    return next;
  }
  function profile(){
    if(window.LineageCurrentProfile)return Promise.resolve(window.LineageCurrentProfile);
    return profileReady||=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='merged/current-profile.js';
      script.onload=()=>resolve(window.LineageCurrentProfile);script.onerror=()=>{profileReady=null;reject(Error('無法載入存檔版本對照'));};
      document.head.append(script);
    });
  }
  function atMenu(){
    const menu=document.getElementById('load-select-panel'),game=document.getElementById('game-screen');
    return !!menu&&!menu.classList.contains('hidden')&&game?.classList.contains('hidden')&&
      !document.hidden&&!document.body.classList.contains('giran-guest')&&!window.GiranPartyGuestPending;
  }
  function canReceive(){return atMenu()&&LineageRecovery.scan(LineageRecovery.capture(localStorage)).canRepair;}
  async function receive(local,entry){
    const save=LineageSaveBridge.inspect(JSON.stringify(LineageTransfer.receive(entry.bundle,localStorage)));
    if(save.kind!=='full'||LineageRecovery.scan(save.keys).issues.some(row=>row.severity==='critical')||LineageRecovery.quarantinePlan(save.keys).count)throw Error('同步庫需要人工核對，請開啟存檔工具。');
    const rules=await profile();
    for(const key of save.roles){
      const role=LineageSaveBridge.decode(save.keys[key]);
      if(!LineageSaveBridge.analyzeCompatibility(role.value,rules).ok)throw Error('新版角色需要人工核對，請開啟存檔工具。');
    }
    async function apply(){
      if(!canReceive()||await checksum(captured())!==local.digest)return local;
      const current=LineageRecovery.capture(localStorage),changes=LineageRecovery.fullRestorePlan(save.keys,current);
      await LineageRecovery.transact(localStorage,changes,s=>LineageBackups.save(s,'同步前還原點'),{canWrite:canReceive});
      const result=await committed(entry,await checksum(captured()));
      if(typeof renderLoadSelect==='function'&&document.getElementById('game-screen'))renderLoadSelect();
      window.dispatchEvent(new Event('giran-sync-updated'));return result;
    }
    return navigator.locks?navigator.locks.request('lineage-merged-save-write',apply):apply();
  }
  async function create(){
    return exclusive(async()=>{
      const keys=captured(),reply=await request('create',{bundle:LineageSaveBridge.pack(keys)});
      return committed(reply,await checksum(keys));
    });
  }
  async function checkMenu(){
    if(!atMenu())return;
    return exclusive(async()=>{
      const local=await currentLink();
      if(!local||local.paused||local.inFlight||!atMenu())return;
      const info=await request('read',{id:local.id,meta:true});
      if(info.revision>local.revision&&canReceive()&&await checksum(captured())===local.digest){
        return receive(local,await request('read',{id:local.id}));
      }
    });
  }
  async function upload(leaving=false){
    return exclusive(async()=>{
      let local=await currentLink();if(!local||local.paused)return local;
      if(local.inFlight){
        // A suspended page can lose the reply after the server has committed its write.
        const info=await request('read',{id:local.id,meta:true});
        if(info.revision!==local.revision){
          const entry=await request('read',{id:local.id});
          const remoteDigest=await checksum(LineageTransfer.forCode(entry.bundle.keys));
          if(entry.revision!==local.revision+1||(remoteDigest!==local.inFlight&&await checksum(entry.bundle.keys)!==local.inFlight)){
            await settings({...local,paused:true});
            throw Error('同步庫已有其他進度，請核對兩邊存檔。');
          }
          local=await committed(entry,remoteDigest);
        }else local=await settings({...local,inFlight:null});
      }
      const keys=captured(),digest=await checksum(keys);
      if(digest===local.digest)return local;
      if(local.quotaUntil>Date.now())throw Error(quotaMessage);
      const bundle=LineageSaveBridge.pack(keys);
      await settings({...local,inFlight:digest});
      try{
        const reply=await request('write',{id:local.id,revision:local.revision,bundle},leaving);
        return committed(reply,digest);
      }catch(error){
        if(error.status>=400&&error.status<500){
          await settings({...local,inFlight:null,paused:error.status===409});
          if(typeof logSys==='function')logSys(error.message);
        }
        throw error;
      }
    });
  }
  async function preview(id){
    const result=await request('read',{id});
    result.bundle=LineageTransfer.receive(result.bundle,localStorage);
    LineageSaveBridge.inspect(JSON.stringify(result.bundle));
    const transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(result.bundle)],'奇岩同步庫.json',{type:'application/json'}));
    const target=document.getElementById('save-file');
    pendingRestore=null;target.files=transfer.files;await LineageRecoveryUI.inspectTransfer(target.files[0]);
    pendingRestore=result;
    return result;
  }
  document.getElementById('save-file')?.addEventListener('change',()=>{pendingRestore=null;});
  document.getElementById('save-file')?.addEventListener('giran-transfer-reset',()=>{pendingRestore=null;});
  window.addEventListener('lineage-full-restored',async()=>{
    if(!pendingRestore)return;
    const {id,revision,updated}=pendingRestore;pendingRestore=null;
    try{await exclusive(async()=>committed({id,revision,updated},await checksum(captured())));window.dispatchEvent(new Event('giran-sync-updated'));}
    catch(error){window.GiranDiagnostics?.record('同步設定',error.message);}
  });
  if(document.getElementById('game-screen')){
    const report=error=>window.GiranDiagnostics?.record('進度同步',error.message);
    let pending=false,away=false;
    async function flush(leaving=false){
      if(pending)return;
      pending=true;
      const mark=localStorage.getItem(pendingKey);
      try{
        await upload(leaving);
        if(mark&&localStorage.getItem(pendingKey)===mark)localStorage.removeItem(pendingKey);
      }catch(error){report(error);}
      finally{
        pending=false;
        const later=localStorage.getItem(pendingKey);
        if(later&&later!==mark)void flush(away);
      }
    }
    function leave(){
      if(linked===false)return;
      away=true;
      localStorage.setItem(pendingKey,Date.now()+'-'+Math.random());
      void flush(true);
    }
    const menu=document.getElementById('load-select-panel'),check=()=>checkMenu().catch(report);
    if(menu)new MutationObserver(check).observe(menu,{attributes:true,attributeFilter:['class']});
    setInterval(check,15_000);
    setInterval(flush,600_000);
    function resume(){
      away=false;
      if(localStorage.getItem(pendingKey))void flush();
      check();
    }
    settings().then(resume).catch(report);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)leave();else resume();});
    window.addEventListener('pagehide',leave);
    window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
  }
  return {settings,create,upload,preview,disconnect:()=>exclusive(()=>settings(null))};
})();
