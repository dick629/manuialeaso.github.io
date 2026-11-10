/* Reuses the real map selectors and their existing handlers. No game-state writes. */
(function(){
 'use strict';
 function mount(root,options={}){
  const query=selector=>root.querySelector(selector),panel=query('#map-view-panel'),category=query('#map-category'),maps=query('#map-select');
  if(!panel||!category||!maps)return null;
  if(panel.dataset.mobileMapMounted==='true')return null;
  panel.dataset.mobileMapMounted='true';
  const controls=maps.parentElement;controls.id='lm-map-controls';
  category.setAttribute('aria-label','地區');maps.setAttribute('aria-label','目的地');
  function refresh(){
   panel.dataset.safeArea=String(String(maps.value||'').startsWith('town_'));
  }
  for(const select of [category,maps])select.addEventListener('change',refresh);
  if(options.observe!==false&&typeof MutationObserver!=='undefined'){
   const observer=new MutationObserver(refresh);observer.observe(category,{childList:true,subtree:true});observer.observe(maps,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});
  }
  refresh();return {refresh};
 }
 function mountStatus(root,options={}){
  const bar=root.querySelector('#status-icon-bar');if(!bar)return null;
  const stage=bar.parentElement,doc=bar.ownerDocument;
  if(stage.querySelector('#lm-status-toggle'))return null;
  const toggle=doc.createElement('button');toggle.type='button';toggle.id='lm-status-toggle';
  toggle.setAttribute('aria-label','角色狀態');toggle.setAttribute('aria-controls','status-icon-bar');toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML='<span aria-hidden="true">✧</span><small>0</small>';stage.appendChild(toggle);
  bar.setAttribute('role','group');bar.setAttribute('aria-label','目前角色狀態');
  function setExpanded(open){stage.classList.toggle('lm-status-expanded',open);toggle.setAttribute('aria-expanded',String(open));}
  function refresh(){const count=bar.querySelectorAll('.status-icon').length;toggle.querySelector('small').textContent=String(count);toggle.setAttribute('aria-label','角色狀態，'+count+' 項');bar.dataset.empty=String(!count);}
  toggle.addEventListener('click',()=>setExpanded(toggle.getAttribute('aria-expanded')!=='true'));
  // Keep the native nodes and their titles: the combat renderer owns buff durations.
  bar.addEventListener('click',event=>{const icon=event.target.closest('.status-icon');if(!icon)return;bar.dataset.selectedStatus=icon.getAttribute('title')||icon.querySelector('img')?.alt||'';bar.querySelectorAll('.status-icon').forEach(el=>el.classList.toggle('lm-status-selected',el===icon));});
  stage.addEventListener('keydown',event=>{if(event.key==='Escape'){setExpanded(false);toggle.focus();}});
  if(options.observe!==false&&typeof MutationObserver!=='undefined')new MutationObserver(refresh).observe(bar,{childList:true});
  refresh();return {refresh,setExpanded};
 }
 window.LineageAdventure={mount,mountStatus};
 if(!window.__LINEAGE_PREVIEW__){mount(document);mountStatus(document);}
})();
