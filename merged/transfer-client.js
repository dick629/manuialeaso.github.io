(function(){
  'use strict';
  const format=/^[A-HJKMNP-Z2-9]{8}$/;
  const normalize=code=>String(code||'').toUpperCase().replace(/[\s-]/g,'');
  const excluded=new Set(['afk_hb_id','afk_mkt_jr','afk_mkt_done','afk_clock_v1','fb5_active_role_sessions_v1','lineage_growth_transaction_backup_v1','lineage_admin_receipts_v1']);
  function forCode(keys) {
    return Object.fromEntries(Object.entries(keys).filter(([k])=>!excluded.has(k)&&!k.startsWith('afk_diag_')));
  }
  function receive(pack,storage) {
    if(!pack?.keys||Array.isArray(pack.keys)||typeof pack.keys!=='object'||(pack.keyCount!=null&&Object.keys(pack.keys).length!==pack.keyCount))throw Error('轉移存檔不完整');
    const keys=forCode(pack.keys);
    for(const name of ['afk_hb_id','afk_mkt_jr','afk_mkt_done']){
      const existing=storage.getItem(name);
      if(existing!==null)keys[name]=existing;
    }
    return {...pack,keyCount:Object.keys(keys).length,keys};
  }
  async function error(res) {
    const data=await res.json().catch(()=>({}));
    return Object.assign(new Error(data.error||'連線服務回應 '+res.status),{status:res.status});
  }
  async function identityHeaders() {
    const id=await window.AFK_HEARTBEAT?.ensureId();
    if(!id?.uid||!id.token)throw Object.assign(Error('無法取得旅人身分，請稍後再試。'),{status:401});
    return {'x-hb-uid':id.uid,'x-hb-token':id.token};
  }
  async function packBody(text) {
    const plain=new Blob([text],{type:'application/octet-stream'});
    return typeof CompressionStream==='undefined'?plain:await new Response(plain.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  async function unpackText(res) {
    const bytes=new Uint8Array(await res.arrayBuffer());
    if(bytes[0]!==31||bytes[1]!==139)return new TextDecoder().decode(bytes);
    if(typeof DecompressionStream==='undefined')throw Error('瀏覽器無法解開壓縮存檔，請更新瀏覽器');
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function put(text) {
    const headers={'Content-Type':'application/octet-stream',...await identityHeaders(),
      'x-save-summary':LineageSaveSummary.bundle(JSON.parse(text))};
    const res=await fetch(LineageSite.traveler+'/xfer/put',{method:'POST',credentials:'omit',headers,body:await packBody(text)});
    if(!res.ok)throw await error(res);
    const code=normalize((await res.json()).code);
    if(!format.test(code))throw Error('伺服器傳回的轉移碼格式有誤');
    return code;
  }
  async function get(input) {
    const code=normalize(input);
    if(!format.test(code))throw Error('請輸入 8 碼轉移碼');
    const res=await fetch(LineageSite.traveler+'/xfer/get?code='+code,{cache:'no-store',credentials:'omit'});
    if(res.status===404)throw Object.assign(new Error('找不到轉移碼，請確認代碼、有效時間與使用次數'),{status:404});
    if(!res.ok)throw await error(res);
    return unpackText(res);
  }
  window.LineageTransfer=Object.freeze({put,get,identityHeaders,packBody,unpackText,error,normalize,valid:code=>format.test(normalize(code)),forCode,receive});
})();
