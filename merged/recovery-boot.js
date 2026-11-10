(function(){'use strict';
 const events=[];
 function record(type,source,line){events.push({type,source:String(source||'').split('?')[0].split('/').pop(),line:line||0});if(events.length>40)events.shift();try{sessionStorage.setItem('lineage.merge.events',JSON.stringify(events));}catch{}}
 addEventListener('error',e=>{const t=e.target;if(t&&t!==window&&['SCRIPT','LINK'].includes(t.tagName))record('resource',t.src||t.href,0);else if(e.filename)record('runtime',e.filename,e.lineno);},true);
 addEventListener('unhandledrejection',()=>record('promise','game',0));
 function leaveSafely(){
  try{
   if(typeof player!=='undefined'&&player&&player.cls&&typeof state!=='undefined'&&state.running){
    window.__fb5CloseFlush=true;let saved;try{saved=typeof saveGame==='function'&&saveGame();}finally{window.__fb5CloseFlush=false;}
    if(saved!==true){alert('目前進度尚未成功保存。請保留這個遊戲分頁，另開修復頁面下載已保存資料；不要直接清除瀏覽器資料。');return false;}
    state.running=false;if(typeof _roleSessionForget==='function')_roleSessionForget();
   }
   return true;
  }catch{alert('目前進度尚未成功保存，請先保留備份再離開遊戲。');return false;}
 }
 function goRecovery(){if(leaveSafely())location.assign(new URL('recovery.html',location.href));}
 function mountToolsEntry(){
  const panel=document.getElementById('tab-automation');if(!panel)return;
  let row=document.getElementById('m-afk-navrow');
  if(!row){
   row=document.createElement('div');row.id='m-afk-navrow';row.className='bg-slate-800 p-3 rounded-lg border border-slate-700';
   row.innerHTML='<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap"></div>';panel.append(row);
  }
  let a=document.getElementById('merge-recovery-game-entry');
  if(!a){a=document.createElement('a');a.id='merge-recovery-game-entry';a.href='recovery.html';a.dataset.mergeRecovery='';a.className='btn py-2 text-sm font-bold';a.textContent='存檔與修復';a.style.cssText='display:block;width:100%;margin-top:8px;text-align:center;text-decoration:none';}
  // Other tools may mount later. Keep recovery visually last without a polling loop.
  row.style.display='flex';row.style.flexDirection='column';a.style.order='1';
  if(a.parentNode!==row)row.append(a);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountToolsEntry,{once:true});else mountToolsEntry();
 document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('[data-merge-recovery]');if(a&&!leaveSafely())e.preventDefault();
 });
 window.LineageBoot={events,goRecovery};
})();
