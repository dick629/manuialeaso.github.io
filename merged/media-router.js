(function(root){
  'use strict';
  const site=new URL('./',root.document?.baseURI||root.registration?.scope||root.location.href);
  function base(value) {
    if (!value) return '';
    const url=new URL(value,site);
    if (!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash) throw Error('部署網址格式錯誤');
    return url.href.replace(/\/+$/,'');
  }
  const mediaBase=base(root.LINEAGE_MEDIA_BASE), remote=mediaBase?new URL(mediaBase+'/'):site;
  const localServer=!!root.LINEAGE_LOCAL_SERVER;
  const data=root.LineageMediaPaths, locals=new Set(data.local), sets=new Map();
  const native=/^(?:assets|public|art-fix|art-v3|brace-art|guardring-art)\//;
  function has(key) {
    const pos=key.lastIndexOf('/'), dir=key.slice(0,pos);
    if (!Object.hasOwn(data.dirs,dir)) return false;
    const id=data.dirs[dir];
    let files=sets.get(id);
    if (!files) {files=new Set(data.sets[id].split('\n'));sets.set(id,files);}
    return files.has(key.slice(pos+1));
  }
  function keyFor(key) {
    if (locals.has(key)) return null;
    let found=key;
    if (!has(key)) {
      if (!native.test(key)||!/\.(?:png|webp)$/i.test(key)) return null;
      const stem=key.replace(/\.[^.]+$/,'');
      found=[stem+'.png',stem+'.webp',...(/^assets\/area\/1920x1080\//.test(key)?[stem+'.jpg']:[])].find(has);
      if (!found) return null;
    }
    return data.actual[found]||found;
  }
  function underneath(url,dir) {
    if (url.origin!==dir.origin||!url.pathname.startsWith(dir.pathname)) return null;
    try {return decodeURIComponent(url.pathname.slice(dir.pathname.length));} catch {return null;}
  }
  function route(value,relativeTo=site) {
    if (value instanceof URL)value=value.href;
    if (typeof value!=='string'||!value||/^(?:data:|blob:|#)/i.test(value)) return null;
    let u;
    try {u=new URL(value,relativeTo);} catch {return null;}
    const input=underneath(u,site) ?? (u.origin===site.origin?underneath(u,new URL('/',site)):null);
    if (!input) return null;
    const key=keyFor(input);
    if (!key) return null;
    const target=new URL(key.split('/').map(encodeURIComponent).join('/'),remote);
    target.search=u.search;target.hash=u.hash;
    return {url:target.href,key,crossOrigin:target.origin!==site.origin};
  }
  function resolve(value,relativeTo) {
    const r=route(value,relativeTo);return r?r.url:value;
  }
  function remoteKey(value) {
    let url;try{url=new URL(value,site);}catch{return null;}
    const key=underneath(url,remote);
    if (!key) return null;
    return has(key)||Object.values(data.actual).includes(key)?key:null;
  }
  root.LineageMedia=Object.freeze({route,resolve,keyFor,remoteKey,site:site.href,mediaBase,active:!!mediaBase||!localServer});
  const traveler=base(root.LINEAGE_TRAVELER_BASE)||(localServer?site.origin+'/api/traveler':'https://lineage-heartbeat.manuialeaso.workers.dev');
  const serviceBase=localServer?site.origin+'/api':traveler;
  root.LineageSite=Object.freeze({localServer,traveler,sync:serviceBase+'/sync',
    rooms:base(root.LINEAGE_ROOMS_BASE)||serviceBase+'/rooms',roomsEnabled:root.LINEAGE_ROOMS_ENABLED===true});
})(self);
