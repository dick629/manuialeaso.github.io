/* Read-only, incremental diagnostics. Repairs remain in the verified-backup recovery flow. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports){module.exports=factory;return;}
 if(!root.LineageRecovery)return;
 const idle=()=>new Promise(resolve=>root.requestIdleCallback?root.requestIdleCallback(resolve,{timeout:3000}):setTimeout(resolve,32));
 const checker=factory(root.LineageRecovery,localStorage,idle);
 let timer=0;
 function display(result){
  const bad=result.issues.some(x=>['critical','warning','repairable'].includes(x.severity));
  const title=bad?'自動檢查發現資料或顯示設定問題，請開啟存檔與修復查看。':'自動檢查完成；可開啟存檔與修復進行完整檢查。';
  ['merge-recovery-entry','merge-recovery-game-entry','lm-recovery'].forEach(id=>{
   const a=document.getElementById(id);if(!a)return;
   a.title=title;a.dataset.saveHealth=bad?'attention':'ok';
   if(id==='lm-recovery'){const label=a.querySelector('span');if(label)label.textContent=bad?'檢查':'存檔';}
   else a.textContent=bad?'存檔與修復 · 待檢查':'存檔與修復';
  });
 }
 async function checkNow(){
  const result=await checker.check();
  if(root.LineageBoot&&root.LineageBoot.events.some(e=>e.type==='resource'))result.issues.push({code:'PROGRAM_RESOURCE',severity:'warning',automatic:false,message:'有程式資源載入失敗，請到修復頁檢查網路與程式版本。'});
  display(result);return result;
 }
 function schedule(delay=60000){if(timer)return;timer=setTimeout(()=>{timer=0;checkNow().catch(()=>{});},delay);}
 const save=root.saveGame;
 if(typeof save==='function')root.saveGame=function(){const result=save.apply(this,arguments);if(result===true)schedule();return result;};
 root.addEventListener('storage',e=>{if(!e.key||checker.accepts(e.key))schedule(3000);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(3000);});
 root.LineageSaveHealth=Object.freeze({checkNow,status:checker.status});
 schedule(4000);
})(typeof globalThis!=='undefined'?globalThis:this,function(recovery,store,yieldTask){
 'use strict';
 yieldTask=yieldTask||(()=>Promise.resolve());
 const accepts=key=>/^lineage_idle_save(?:_\d+)?$/.test(key)||['afk_ui_scale','afk_ui_lite','afk_uiscale_v1'].includes(key);
 const cache=new Map();let pending=null,last={checkedAt:null,roles:0,issues:[],readOnly:true};
 async function run(){
  const issues=[];let roles=0,decoded=0,reused=0;
  try{
   const keys=[];for(let i=0;i<store.length;i++){const key=store.key(i);if(key&&accepts(key))keys.push(key);}
   const live=new Set(keys);for(const key of cache.keys())if(!live.has(key))cache.delete(key);
   for(const key of keys){
    await yieldTask();const raw=store.getItem(key);if(raw===null)continue;
    let entry=cache.get(key);
    if(!entry||entry.raw!==raw){
     const scan=recovery.scan({[key]:raw});entry={raw,roles:scan.roles,issues:scan.issues};
     // A changed record will be revisited on the next save/storage event.
     if(store.getItem(key)!==raw){issues.push({code:'CHANGED_DURING_CHECK',severity:'notice',automatic:false});continue;}
     cache.set(key,entry);decoded++;
    }else reused++;
    roles+=entry.roles;issues.push(...entry.issues.map(({code,severity,automatic,key})=>({code,severity,automatic,key})));
   }
  }catch{issues.push({code:'STORAGE_READ',severity:'critical',automatic:false});}
  // Only codes and slot keys are public. Never expose names, item lists or signed payloads.
  last={checkedAt:new Date().toISOString(),roles,issues,decoded,reused,readOnly:true};return structuredClone(last);
 }
 function check(){if(!pending)pending=run().finally(()=>{pending=null;});return pending;}
 return Object.freeze({check,accepts,status:()=>structuredClone(last)});
});
