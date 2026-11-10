(function(W){'use strict';
 let loading=null,request=0;
 function assets(){if(W.LineageArcade)return Promise.resolve();if(loading)return loading;
  loading=(async()=>{const t=document.getElementById('arcade-assets');if(!t)throw Error('遊戲檔案清單遺失');
   for(const item of t.content.querySelectorAll('link,script')){
    const url=item.getAttribute('src')||item.getAttribute('href');
    if(document.head.querySelector('[data-arcade-asset="'+url+'"]'))continue;
    await new Promise((resolve,reject)=>{const el=document.createElement(item.tagName.toLowerCase());el.dataset.arcadeAsset=url;
     if(item.tagName==='SCRIPT'){el.src=url;el.async=false;}else{el.rel='stylesheet';el.href=url;}
     el.onload=resolve;el.onerror=()=>{el.remove();reject(Error('遊戲檔案載入失敗，請重試'));};document.head.appendChild(el);
    });
   }
  })().catch(e=>{loading=null;throw e;});return loading;
 }
 W.LineageArcadeEntry={cancel(){request++;},async open(game){const p=typeof player==='undefined'?null:player;if(!p||!p.cls||p.classicMode)return;
  const n=++request,w=document.getElementById('afk-gh-win');let note=w&&w.querySelector('.arcade-loading');if(w&&!note){note=document.createElement('p');note.className='gh-msg arcade-loading';w.appendChild(note);}if(note)note.textContent='正在載入牌桌…';
  try{await assets();if(n===request&&player===p&&(!w||w.style.display!=='none'))W.LineageArcade.open(game);}
  catch(e){if(note&&n===request)note.textContent=e.message;}
  finally{if(note&&W.LineageArcade)note.remove();}
 }};
})(window);
