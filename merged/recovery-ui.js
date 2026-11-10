(function(){'use strict';
 const B=LineageSaveBridge,R=LineageRecovery,V=LineageBackups,$=id=>document.getElementById(id);
 let lastScan=null,selected=null,selectedText='',busy=false;
 const store=localStorage;
 const transient=new Set(['fb5_active_role_sessions_v1']);
 function status(text,bad=false){$('status').textContent=text;$('status').classList.toggle('error',bad);}
 function button(text,fn){const b=document.createElement('button');b.textContent=text;b.addEventListener('click',()=>run(fn));return b;}
 async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');try{await fn();}catch(e){status(e.message||'操作未完成，請保留備份後再試。',true);}finally{busy=false;document.body.removeAttribute('aria-busy');}}
 async function locked(fn){return navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},fn):fn();}
 function current(){return R.capture(store);}
 function canWrite(){return R.scan(current()).canRepair;}
 function events(){try{const value=JSON.parse(sessionStorage.getItem('lineage.merge.events')||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
 async function refreshProgram(){
  if(!canWrite())throw Error('請先離開其他分頁中的遊戲，再重新下載程式。');
  status('正在重新下載並驗證遊戲程式…');
  const r=await LineageRuntimeHealth.refresh((done,total)=>status('正在驗證遊戲程式 '+done+'／'+total+'…'));
  sessionStorage.removeItem('lineage.merge.events');status('已驗證並更新 '+r.files+' 個程式檔案，請返回遊戲。角色、物品與圖片快取均保留。');
 }
 function display(result){
  lastScan=result;$('report').disabled=false;$('issues').replaceChildren();
  if(!result.issues.length){const li=document.createElement('li');li.className='good';li.textContent='本次檢查未發現可辨識的存檔或顯示設定問題。';$('issues').append(li);}
  for(const item of result.issues){const li=document.createElement('li');li.className=item.severity;li.textContent=(item.key&&/^lineage_idle_save/.test(item.key)?'存檔 '+item.key.replace('lineage_idle_save_','')+'：':'')+item.message;$('issues').append(li);}
  showQuarantine();
  if(events().length){const li=document.createElement('li');li.className='warning';li.textContent='最近一次遊戲載入留下 '+events().length+' 筆錯誤記錄；可下載診斷報告。程式檔載入失敗可重新下載處理。';$('issues').append(li);}
 }
 function showQuarantine(){
  const box=$('quarantine-list');if(!box)return;box.replaceChildren();
  try{const q=R.quarantineData(current());$('export-quarantine').disabled=!q.entries.length;
   if(!q.entries.length){box.textContent='目前沒有隔離紀錄。';return;}
   for(const e of q.entries){const row=document.createElement('p');row.textContent='存檔 '+String(e.roleKey||'').replace('lineage_idle_save_','')+'／原背包第 '+(Number(e.inventoryIndex)+1)+' 格：'+(e.record&&e.record.n||'未命名紀錄')+'（完整資料已封存，未補造物品）';box.append(row);}
  }catch(e){box.textContent=e.message;$('export-quarantine').disabled=true;}
 }
 async function download(text,name){
  if(typeof window.showSaveFilePicker==='function'){
   try{const h=await showSaveFilePicker({suggestedName:name,types:[{description:'JSON 備份檔',accept:{'application/json':['.json']}}]});const w=await h.createWritable();await w.write(text);await w.close();return 'saved';}
   catch(e){if(e.name==='AbortError')return 'cancel';}
  }
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'requested';
 }
 const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
 function notifyDownload(result){if(result==='saved')status('備份已保存。');else if(result==='requested')status('已送出下載，請確認檔案已保存。');}
 async function mutate(changes,kind='repair'){
  return locked(async()=>R.transact(store,changes,s=>V.save(s,kind),{canWrite}));
 }
 $('recover-integrity').onclick=()=>run(async()=>{const r=await locked(()=>LineageIntegrity.recover());status(r.status==='clean'?'沒有中斷的保護交易。':r.status==='committed'?'已確認上次保存完成。':'已回復中斷交易前的資料。');await showBackups();});
 $('scan').onclick=()=>run(async()=>{const r=R.scan(current());display(r);status(r.issues.some(x=>['critical','blocking'].includes(x.severity))?'已完成檢查，請依下方提示處理。':'檢查完成。');});
 $('repair').onclick=()=>run(async()=>{
  status('正在檢查…');const r=R.scan(current());display(r);
  if(!r.canRepair){status('其他遊戲分頁尚未關閉，這次只做檢查。',true);return;}
  if(!r.changes.length){
   if(events().some(e=>e.type==='resource')){await refreshProgram();return;}
   if(r.issues.some(x=>x.severity==='critical')){status('沒有可安全自動修復的項目，請選擇備份還原或下載診斷報告。');return;}
   if(r.roles){await V.save({format:R.ID,schema:1,keys:current(),changes:[]},'checkpoint');await showBackups();status(events().length?'已保留目前進度；程式錯誤無法安全自動修復，請下載診斷報告交由 AI 或開發者檢查。':'未發現需要自動修復的項目，已建立目前進度的還原點。');}
   else status('沒有需要自動修復的項目，目前尚未找到角色存檔。');return;
  }
  status('正在保留修復前備份…');const result=await mutate(r.changes);
  display(R.scan(current()));status('已完成安全修復；修復前資料已保留，可在下方撤銷。');await showBackups();
  if(events().some(e=>e.type==='resource'))await refreshProgram();
 });
 $('reload-program').onclick=()=>run(refreshProgram);
 $('report').onclick=()=>run(async()=>{
  const r=lastScan||R.scan(current());
  const text=JSON.stringify(R.report(r,events()),null,2);notifyDownload(await download(text,'lineage-diagnostic-'+stamp()+'.json'));
 });
 $('export-quarantine').onclick=()=>run(async()=>notifyDownload(await download(JSON.stringify(R.quarantineData(current()),null,2),'lineage-item-quarantine-'+stamp()+'.json')));
 function updateCompatibility(){
  const box=$('compatibility');box.replaceChildren();$('portable').disabled=true;
  if(!selected||selected.kind!=='role')return;
  const check=B.analyzeCompatibility(selected.value,LineageProfiles[$('target').value]);
  const p=document.createElement('p');p.className=check.ok?'good':'bad';p.textContent=check.ok?'本次道具與數值上限檢查通過。':'此存檔暫時無法安全轉往這個版本。';box.append(p);
  if(check.blockers.length){const ul=document.createElement('ul');for(const x of check.blockers.slice(0,8)){const li=document.createElement('li');li.textContent=(x.location?x.location+'：':'')+x.message;ul.append(li);}box.append(ul);}
  $('portable').disabled=!check.ok;
 }
 $('target').onchange=updateCompatibility;
 $('save-file').onchange=()=>run(async()=>{
  selected=null;selectedText='';$('role-options').hidden=true;$('full-options').hidden=true;$('file-info').textContent='';$('replace-consent').checked=false;$('quarantine-consent').checked=false;$('quarantine-option').hidden=true;$('restore-full').disabled=true;
  const file=$('save-file').files[0];if(!file)return;
  if(file.size>B.MAX_TEXT)throw Error('檔案太大，請保留原檔並交由開發者檢查。');
  selectedText=await file.text();selected=B.inspect(selectedText);
  $('file-info').textContent=selected.kind==='role'?'已讀取角色存檔。原始檔不會被修改。':'已讀取完整資料備份。還原前會備份目前資料。';
  if(selected.kind==='role'){$('role-options').hidden=false;updateCompatibility();}else{$('full-options').hidden=false;const n=R.scan(selected.keys).issues.filter(x=>x.code==='MISSING_ITEM_ID').reduce((n,x)=>n+x.count,0);$('quarantine-option').hidden=!n;$('quarantine-count').textContent=n;}
  status('檔案檢查完成。');
 });
 $('portable').onclick=()=>run(async()=>{if(!selected)return;const text=B.exportRole(selectedText,LineageProfiles[$('target').value]);notifyDownload(await download(text,'lineage-compatible-'+$('target').value+'-'+stamp()+'.json'));});
 $('replace-consent').onchange=()=>{$('restore-full').disabled=!$('replace-consent').checked;};
 $('restore-full').onclick=()=>run(async()=>{
  if(!selected||selected.kind!=='full'||!$('replace-consent').checked)return;
  const incoming=R.scan(selected.keys);if(incoming.issues.some(x=>x.severity==='critical'))throw Error('備份內有毀損角色，請保留原檔並先處理問題；尚未寫入任何資料。');
  let keys=selected.keys;const qp=R.quarantinePlan(keys);
  if(qp.count){if(!$('quarantine-consent').checked)throw Error('請勾選「封存異常物品」後再還原；原始檔案不會修改。');keys={...keys};for(const c of qp.changes)keys[c.key]=c.after;}
  for(const key of B.roleKeys(keys)){const d=B.decode(keys[key]);const check=B.analyzeCompatibility(d.value,window.LineageCurrentProfile);if(!check.ok)throw Error('備份含目前無法安全讀取的角色：'+check.blockers[0].message);}
  if(qp.count)await V.save({format:R.ID,schema:1,keys:selected.keys,changes:[]},'import-original');
  const changes=R.fullRestorePlan(keys,current());
  status('正在備份目前資料並還原…');await mutate(changes,'full-restore');display(R.scan(current()));status('完整備份已還原。請返回遊戲選擇角色。');await showBackups();
 });
 $('export-full').onclick=()=>run(async()=>{const keys=current();if(!Object.keys(keys).length)throw Error('目前沒有可匯出的資料。');notifyDownload(await download(JSON.stringify(B.pack(keys)), 'lineage-full-backup-'+stamp()+'.json'));});
 async function restoreSnapshot(id){
  const r=await V.read(id),snapshot=r.snapshot;
  if(!confirm('這會回到 '+new Date(r.createdAt).toLocaleString('zh-TW')+' 的備份狀態。現在的資料會先備份，是否繼續？'))return;
  const now=current(),keys=snapshot.keys,changes=[];
  if(!B.record(keys))throw Error('備份資料不完整。');
  for(const key of new Set([...Object.keys(now),...Object.keys(keys)])){
   if(transient.has(key))continue;
   const before=B.own(now,key)?now[key]:null,after=B.own(keys,key)?keys[key]:null;
   if(before!==after)changes.push({key,before,after,reason:'SNAPSHOT_RESTORE'});
  }
  await mutate(changes,'snapshot-restore');display(R.scan(current()));status('已還原所選備份；還原前資料也已保留。');await showBackups();
 }
 async function showBackups(){
  const list=await V.list(),box=$('backups');box.replaceChildren();
  if(!list.length){box.textContent='目前沒有修復前備份。';return;}
  for(const item of list){
   const row=document.createElement('div');row.className='backup-row';
   const label=document.createElement('div');label.textContent=new Date(item.createdAt).toLocaleString('zh-TW');
   const small=document.createElement('small');small.textContent=({'repair':'安全修復前','checkpoint':'檢查後還原點','before-import':'角色匯入前','full-restore':'完整還原前','snapshot-restore':'備份還原前','undo':'撤銷前'})[item.kind]||'操作前備份';label.append(small);row.append(label);
   const actions=document.createElement('div');actions.className='actions';
   actions.append(button('下載',async()=>{const r=await V.read(item.id);notifyDownload(await download(JSON.stringify(B.pack(r.snapshot.keys)),'lineage-before-change-'+item.id+'.json'));}));
   if(item.kind==='before-import')actions.append(button('原匯入檔',async()=>{const r=await V.read(item.id);if(typeof r.snapshot.originalImport!=='string')throw Error('此備份沒有原匯入檔。');notifyDownload(await download(r.snapshot.originalImport,'lineage-original-import-'+item.id+'.json'));}));
   if(item.changes&&item.kind==='repair')actions.append(button('撤銷修復',async()=>{const r=await V.read(item.id);await mutate(R.undoPlan(r.snapshot,current()),'undo');display(R.scan(current()));status('已撤銷這次修復。');await showBackups();}));
   actions.append(button('還原',()=>restoreSnapshot(item.id)));row.append(actions);box.append(row);
  }
 }
 $('refresh-backups').onclick=()=>run(showBackups);
 window.LineageRecoveryUI={scan:()=>{const r=R.scan(current());display(r);return r;},showBackups};
})();
