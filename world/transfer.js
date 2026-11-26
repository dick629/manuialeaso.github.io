'use strict';
(() => {
  const box=document.createElement('section');box.className='panel';box.id='giran-transfer';
  box.innerHTML='<h2>轉移角色與紀錄</h2><p>在來源瀏覽器產生轉移碼，在目的地輸入。轉移碼有效 24 小時。也可以直接匯出完整備份。</p><div class="actions"><button id="g-send">產生轉移碼</button><input id="g-code" aria-label="轉移碼" maxlength="12" placeholder="輸入 8 碼轉移碼"><button id="g-get">檢查此存檔</button><button id="g-debug">下載世界除錯紀錄</button></div><output aria-live="polite"></output>';
  const panels=document.querySelectorAll('main section');(panels[1]||document.body.lastElementChild).after(box);
  const travelerNote=document.createElement('p');
  travelerNote.textContent='旅人聊天、寄賣、討伐和狀態回報存放在共用資料庫。若兩台電腦使用不同資料夾，先用遊戲目錄的「旅人資料庫搬家」匯出，再還原到新位置，接著用這裡的完整備份帶回旅人身分與角色。';
  if(LineageSite.localServer)box.querySelector('p').after(travelerNote);
  const result=box.querySelector('output');
  const journal=document.createElement('button');journal.type='button';journal.textContent='下載戰鬥與系統紀錄';box.querySelector('.actions').append(journal);
  journal.onclick=()=>{
    let rows;try{rows=GiranJournal.current();}catch(e){result.textContent=e.message;return;}
    const file=new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(file);a.download='奇岩戰鬥與系統紀錄.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    result.textContent='已匯出 '+rows.length+' 筆，最多保留最近 400 筆戰鬥與 600 筆系統紀錄';
  };
  const sync=document.createElement('section');sync.className='panel';sync.id='giran-sync';
  sync.innerHTML='<h2>持續同步遊戲進度</h2><p>遊戲每 10 分鐘同步有變更的存檔，切走或關閉分頁時也會補傳。每包上限 10 MB，每個同步庫每天最多上傳 150 次。另一端首次輸入同步碼核對角色，之後停在選角畫面就會先備份、再讀回新版進度。兩端若各有新進度，系統會暫停同步並保留兩份。</p><div class="actions"><button id="gs-create">建立同步庫</button><input id="gs-id" maxlength="12" aria-label="同步庫代碼" placeholder="12 碼同步碼"><button id="gs-preview">讀取並核對</button><button id="gs-upload">立即同步</button><button id="gs-off">停止此瀏覽器同步</button></div><p aria-live="polite"></p>';box.after(sync);
  const info=sync.querySelector('p:last-child'), code=sync.querySelector('input');
  async function showSync(){
    const s=await GiranSync.settings();
    if(s)code.value=s.id;
    info.textContent=s?'同步庫 '+s.id+'　版本 '+s.revision+'　'+(s.paused?'兩邊進度不同，請先下載本機完整備份，再核對同步庫版本。':s.quotaUntil>Date.now()?'今天的同步次數已用完':'上次同步 '+new Date(s.updated).toLocaleString('zh-TW')):'尚未連結同步庫';
    document.getElementById('gs-upload').disabled=!s||s.paused;document.getElementById('gs-off').disabled=!s;
  }
  sync.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    button.disabled=true;
    try{
      if(button.id==='gs-create')await GiranSync.create();
      if(button.id==='gs-upload')await GiranSync.upload();
      if(button.id==='gs-off')await GiranSync.disconnect();
      if(button.id==='gs-preview'){
        const entry=await GiranSync.preview(code.value.trim().toUpperCase());
        info.textContent='讀取版本 '+entry.revision+'。請在「檢查與轉移存檔」核對後還原，這個瀏覽器就會連結同步庫。';
        document.getElementById('full-options').scrollIntoView({block:'center'});return;
      }
      await showSync();
    }catch(error){info.textContent=error.message;}
    finally{if(button.id!=='gs-upload'&&button.id!=='gs-off')button.disabled=false;
      else{const s=await GiranSync.settings();button.disabled=!s||(button.id==='gs-upload'&&s.paused);}}
  });
  window.addEventListener('giran-sync-updated',()=>showSync().catch(e=>{info.textContent=e.message;}));
  showSync().catch(e=>{info.textContent=e.message;});
  async function legacyLocalRequest(path,body){const res=await fetch('/api/transfer/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
  function handle(btn,fn){box.querySelector(btn).onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await fn();}catch(err){result.textContent=err.message;}finally{b.disabled=false;}};}
  handle('#g-send',async()=>{
    const keys=LineageRecovery.capture(localStorage);
    if(!LineageSaveBridge.roleKeys(keys).length)throw Error('沒有可以同步的角色');
    const code=await LineageTransfer.put(JSON.stringify(LineageSaveBridge.pack(LineageTransfer.forCode(keys))));
    box.querySelector('#g-code').value=code;result.textContent='轉移碼　'+code;
  });
  handle('#g-get',async()=>{
    const code=LineageTransfer.normalize(box.querySelector('#g-code').value);
    const bundle=LineageSite.localServer&&/^[A-F0-9]{12}$/.test(code)?(await legacyLocalRequest('get',{code})).bundle:LineageTransfer.receive(JSON.parse(await LineageTransfer.get(code)),localStorage);
    const info=LineageSaveBridge.inspect(JSON.stringify(bundle)), transfer=new DataTransfer();
    const roles=info.roles.map(key=>{const p=LineageSaveBridge.decode(info.keys[key]).value.p;return (p.name||p.cls)+' Lv.'+p.lv;});
    transfer.items.add(new File([JSON.stringify(bundle)],'奇岩本機同步.json',{type:'application/json'}));
    const target=document.getElementById('save-file');target.files=transfer.files;target.dispatchEvent(new Event('giran-transfer-reset'));await LineageRecoveryUI.inspectTransfer(target.files[0]);
    result.textContent='已讀取 '+roles.length+' 個角色　'+roles.join('、')+'。在上方核對後按還原，系統會先備份。';
    document.getElementById('full-options').scrollIntoView({block:'center'});
  });
  handle('#g-debug',async()=>{
    let events=[];try{events=JSON.parse(localStorage.getItem('lineage_giran_events_v1')||'[]');}catch{}
    const scan=LineageRecovery.scan(LineageRecovery.capture(localStorage));
    const health=LineageSite.localServer?await fetch('/api/health').then(r=>r.json()):{version:(await (await fetch('version.json')).json()).build,app:'次元融合'};
    const report=LineageRecovery.report(scan,[],health.version);report.worldEvents=events;report.application=health.app;
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));link.download='奇岩世界診斷.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);result.textContent='已產生診斷檔';
  });
})();
