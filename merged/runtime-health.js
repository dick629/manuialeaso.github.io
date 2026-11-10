/* Repair only application resources. Player storage and image caches are never cleared. */
(function(){'use strict';
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 async function refresh(progress=()=>{}){
  if(!crypto.subtle||!window.caches)throw Error('此環境無法驗證程式，請使用 HTTPS 或本機伺服器開啟。');
  const base=new URL('./',location.href),nonce=Date.now().toString(36);
  const response=await fetch(new URL('merged/program-manifest.json?repair='+nonce,base),{cache:'no-store'});
  if(!response.ok)throw Error('無法取得程式清單，請檢查網路後再試；現有資料已保留。');
  const manifest=await response.json();
  if(manifest.schema!==1||!Array.isArray(manifest.files)||manifest.files.length>600)throw Error('程式清單不完整，請先更新合併版。');
  let next=0,done=0,failed=null;const ready=[];
  const worker=async()=>{while(!failed&&next<manifest.files.length){const item=manifest.files[next++];
   try{
    if(typeof item.url!=='string'||!(/^[a-zA-Z0-9_./?=&-]+$/).test(item.url)||item.url.startsWith('/')||item.url.split('/').includes('..')||!(/^[a-f0-9]{64}$/).test(item.sha256))throw Error('程式清單格式異常。');
    const url=new URL(item.url,base),fresh=new URL(url);fresh.searchParams.set('__merge_repair',nonce);
    const r=await fetch(fresh,{cache:'no-store'});if(!r.ok)throw Error('程式下載失敗，請檢查網路後再試。');
    const bytes=await r.arrayBuffer();if(await digest(bytes)!==item.sha256)throw Error('程式版本正在更新或檔案不完整，請稍後再試。');
    ready.push([url.href,new Response(bytes,{status:200,headers:{'Content-Type':item.type}})]);progress(++done,manifest.files.length);
   }catch(e){failed=e;}
  }};
  await Promise.all(Array.from({length:4},worker));if(failed)throw failed;
  // All downloads pass their hashes before replacing any cache entry.
  const cache=await caches.open('code-v1');for(const [url,value] of ready)await cache.put(url,value);
  try{const registration=await navigator.serviceWorker.getRegistration(base.href);if(registration)await registration.update();}catch{}
  return {files:ready.length,build:manifest.build};
 }
 window.LineageRuntimeHealth=Object.freeze({refresh});
})();
