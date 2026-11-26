(function(){
  'use strict';
  const media=LineageMedia, config=LineageMediaPaths;
  const marker='[data-lm-src],[data-lm-href],[data-lm-poster]';
  const srcNames=['src','href','poster'];
  const nativeSet=Element.prototype.setAttribute;
  const remoteOrigin=media.mediaBase&&new URL(media.mediaBase).origin!==location.origin;
  function isRemote(value) {
    return remoteOrigin&&String(value).startsWith(media.mediaBase+'/')&&media.remoteKey(value);
  }
  function assign(el,name,value) {
    const target=media.active?media.route(value,document.baseURI):null;
    if ((target?.crossOrigin||isRemote(value)) && ('crossOrigin' in el)) el.crossOrigin='anonymous';
    nativeSet.call(el,name,target?target.url:value);
  }
  function hydrate(el) {
    for (const name of srcNames) {
      const value=el.getAttribute('data-lm-'+name);
      if (value===null) continue;
      el.removeAttribute('data-lm-'+name);
      assign(el,name,value);
    }
  }
  for (const [key,value] of Object.entries(config.css)) {
    const url=media.resolve(value);
    document.documentElement.style.setProperty(key,'url('+JSON.stringify(new URL(url,document.baseURI).href)+')');
  }
  // Parser-created elements hold their logical path until we can choose the correct origin.
  const observer=new MutationObserver(records=>{
    for(const record of records) for(const node of record.addedNodes) {
      if(node.nodeType!==1)continue;
      if(node.matches(marker))hydrate(node);
      node.querySelectorAll(marker).forEach(hydrate);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  function finish() {document.querySelectorAll(marker).forEach(hydrate);observer.disconnect();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finish,{once:true});else finish();
  if(!media.active)return;
  const material=/assets\/|art-fix\/|art-v3\/|brace-art\/|guardring-art\/|public\/|dimension-map\/terrain\//;
  function css(text) {
    if(typeof text!=='string'||!material.test(text))return text;
    return text.replace(/url\(\s*(?:(["'])(.*?)\1|([^)"']+))\s*\)/gi,(raw,quote,a,b)=>{
      const target=media.route((a??b).trim(),document.baseURI);
      return target?'url('+JSON.stringify(target.url)+')':raw;
    });
  }
  function property(proto,name,transform,owner=proto) {
    const desc=Object.getOwnPropertyDescriptor(owner,name);
    if(!desc?.set||!desc.configurable)return;
    Object.defineProperty(proto,name,{...desc,set(value){desc.set.call(this,transform.call(this,value));}});
  }
  function source(value) {
    const target=media.route(value,document.baseURI);
    if((target?.crossOrigin||isRemote(value))&&'crossOrigin' in this&&this.crossOrigin!=='anonymous')this.crossOrigin='anonymous';
    return target?target.url:value;
  }
  property(HTMLImageElement.prototype,'src',source);
  property(HTMLMediaElement.prototype,'src',source);
  property(HTMLSourceElement.prototype,'src',source);
  property(HTMLVideoElement.prototype,'poster',source);
  const AudioOriginal=window.Audio;
  if(AudioOriginal)window.Audio=new Proxy(AudioOriginal,{construct(type,args){
    const el=new type();
    if(args.length)el.src=args[0];
    return el;
  },apply(type,that,args){const el=new type();if(args.length)el.src=args[0];return el;}});
  function mediaElement(el,name){
    return (name==='src'&&(el instanceof HTMLImageElement||el instanceof HTMLMediaElement||el instanceof HTMLSourceElement))||
      (name==='poster'&&el instanceof HTMLVideoElement)||(name==='href'&&(el.localName==='image'||el.localName==='link'));
  }
  Element.prototype.setAttribute=function(name,value){
    const key=String(name).toLowerCase();
    if(mediaElement(this,key)){assign(this,key,value);return;}
    return nativeSet.call(this,name,key==='style'?css(value):value);
  };
  const styles=CSSStyleDeclaration.prototype;
  const imageStyles=new Set(['background','backgroundImage','mask','maskImage','webkitMaskImage','borderImage','borderImageSource','listStyle','listStyleImage','content','cursor','cssText']);
  // CSSOM exposes named properties directly on each style object in Chromium.
  const inlineStyles=new WeakMap();
  for(const proto of [HTMLElement.prototype,SVGElement.prototype]){
    const descriptor=Object.getOwnPropertyDescriptor(proto,'style');
    if(!descriptor?.get||!descriptor.configurable)continue;
    Object.defineProperty(proto,'style',{...descriptor,get(){
      const original=descriptor.get.call(this);
      if(!inlineStyles.has(original)){
        const methods=new Map();
        inlineStyles.set(original,new Proxy(original,{
          get(target,key){
            const value=Reflect.get(target,key,target);
            if(typeof value!=='function')return value;
            if(!methods.has(value))methods.set(value,value.bind(target));
            return methods.get(value);
          },
          set(target,key,value){return Reflect.set(target,key,imageStyles.has(key)?css(value):value,target);}
        }));
      }
      return inlineStyles.get(original);
    },set(value){if(descriptor.set)descriptor.set.call(this,css(value));else descriptor.get.call(this).cssText=css(value);}});
  }
  const set=styles.setProperty;
  styles.setProperty=function(name,value,priority){return set.call(this,name,css(value),priority);};
  property(HTMLStyleElement.prototype,'textContent',css,Node.prototype);
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  function markup(value) {
    if(typeof value!=='string'||!material.test(value)||!/<(?:img|audio|video|source|image|link|style)\b|style\s*=/i.test(value))return value;
    const inert=document.createElement('template');
    html.set.call(inert,value);
    for(const el of inert.content.querySelectorAll('img[src],audio[src],video[src],source[src],video[poster],image[href],link[href],[style],style')) {
      for(const key of srcNames)if(el.hasAttribute(key)&&mediaElement(el,key))assign(el,key,el.getAttribute(key));
      if(el.hasAttribute('style'))nativeSet.call(el,'style',css(el.getAttribute('style')));
      if(el.localName==='style')el.textContent=css(el.textContent);
    }
    return html.get.call(inert);
  }
  property(Element.prototype,'innerHTML',markup);
  const adjacent=Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML=function(pos,value){return adjacent.call(this,pos,markup(value));};
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const request=input instanceof Request?input:null;
    const method=(init?.method||request?.method||'GET').toUpperCase();
    if(!['GET','HEAD'].includes(method))return originalFetch(input,init);
    const target=media.route(request?request.url:String(input),document.baseURI);
    if(!target)return originalFetch(input,init);
    const opts=request?new Request(request,init):init||{};
    const options=request?{method:opts.method,headers:opts.headers,signal:opts.signal,cache:opts.cache,redirect:opts.redirect,integrity:opts.integrity}:opts;
    return originalFetch(target.url,{...options,...(target.crossOrigin?{mode:'cors',credentials:'omit'}:{})});
  };
})();
