'use strict';
window.GiranJournal=(()=>{
  const key='lineage_giran_journal_v1',queue=[];
  const sinks=new Map([['combat-log','戰鬥'],['sys-log','系統'],['exp-log','經驗']]);
  const limits={'戰鬥':400,'系統':600,'掉寶':400,'經驗':400};
  let flushScheduled=false,writeError='',listener=null;
  const template=document.createElement('template');
  function add(entry){queue.push(entry);if(listener)listener(entry);}
  // Keep text searchable and store only the offsets where the native ink changes.
  // [offset, classes, optional color] opens a span and [offset] closes it.
  const inkClass=/^(?:text-(?:(?:slate|gray|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-(?:50|[1-9]00|950)(?:\/\d{1,3})?|white|black)|font-(?:bold|semibold)|crit-hit|log-cat-(?:attack|enemy|skill|dot)|sys-(?:item-gain|drop-(?:rare|legend|relic))|c-[a-z0-9-]+)$/;
  const inkClasses=value=>typeof value==='string'?value.split(/\s+/).filter(c=>inkClass.test(c)).join(' '):'';
  const inkColor=value=>typeof value==='string'&&value.length<=60&&/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,% /]+\)|[a-z]+)$/i.test(value)?value:'';
  function capture(entry,root){
    if(!root)return;
    let text='';
    const marks=[],classes=inkClasses(root.getAttribute('class'));
    if(classes)entry.classes=classes;
    function walk(node){
      if(text.length>=340)return;
      if(node.nodeType===3){
        const part=text.length?node.data:node.data.trimStart();
        text+=part.slice(0,340-text.length);return;
      }
      if(node.nodeType!==1)return;
      if(node.localName==='br'){if(text.length)text+='\n';return;}
      if(node.localName==='script'||node.localName==='style')return;
      let cls=inkClasses(node.getAttribute('class'));
      if(node.localName==='b'||node.localName==='strong')cls=(cls+' font-bold').trim();
      const color=inkColor(node.style?.color),start=marks.length,offset=text.length;
      if(cls||color)marks.push(color?[offset,cls,color]:[offset,cls]);
      for(let child=node.firstChild;child&&text.length<340;child=child.nextSibling)walk(child);
      if(cls||color){
        if(text.length>offset)marks.push([text.length]);
        else marks.length=start;
      }
    }
    for(let child=root.firstChild;child&&text.length<340;child=child.nextSibling)walk(child);
    entry.text=text.trimEnd();
    if(marks.length){for(const mark of marks)mark[0]=Math.min(mark[0],entry.text.length);entry.marks=marks;}
  }
  function paint(el,row){
    el.dataset.tone=tone(row);
    const classes=inkClasses(row.classes);
    if(classes)el.classList.add('log-entry',...classes.split(' '));
    if(!Array.isArray(row.marks)||!row.marks.length){el.textContent=row.text;return;}
    let pos=0,parent=el;
    for(const mark of row.marks){
      if(!Array.isArray(mark))continue;
      const at=mark[0];
      if(!Number.isInteger(at)||at<pos||at>row.text.length)continue;
      if(at>pos)parent.append(row.text.slice(pos,at));
      pos=at;
      if(mark.length===1){if(parent!==el)parent=parent.parentNode;}
      else{
        const span=document.createElement('span');span.className=inkClasses(mark[1]);
        if(mark[2])span.style.color=inkColor(mark[2]);
        parent.append(span);parent=span;
      }
    }
    if(pos<row.text.length)parent.append(row.text.slice(pos));
  }
  function normalize(entry){
    if(entry.html!==undefined){template.innerHTML=entry.html;capture(entry,template.content.firstElementChild);delete entry.html;}
    if(entry.text)entry.kind=category(entry);return entry;
  }
  function subscribe(fn){
    listener=null;
    if(!fn)return [];
    collect(observer.takeRecords());
    let saved=[];try{saved=read();}catch{}
    listener=fn;return saved.concat(queue);
  }
  function scheduleFlush(){
    if(queue.length<96||flushScheduled)return;
    flushScheduled=true;Promise.resolve().then(()=>locked(flush)).catch(()=>{}).finally(()=>{flushScheduled=false;});
  }
  function category(row){
    if(row.kind!=='系統')return row.kind;
    const t=row.text||'';
    if(/留下了\s*.+[×x]\s*\d+|結晶\s*從.+殘骸中浮現/.test(t))return '掉寶';
    if(/^(?:你)?(?:獲得|取得|得到)了?\s*(?:[\d,.萬億]+\s*點?(?:巔峰)?經驗|(?:巔峰)?經驗值?\s*[\d,.萬億]+)/.test(t))return '經驗';
    if(/(?:掉落了|罕見掉落！|掛機期間獲得[：:]|^你獲得了|^獲得物品|^獲得道具|^獲得[：:]|^拾取|^撿到|^.{1,48} 給你 .+ [。！]$)/.test(t))return '掉寶';
    return row.kind;
  }
  function tone(row){
    const type=category(row),t=row.text||'';
    if(type==='掉寶')return 'loot';
    if(type==='經驗')return 'experience';
    if(/^[^：:「」]{1,32}[：:]\s*「/.test(t))return 'dialogue';
    if(type==='戰鬥'){
      if(/暴擊|爆擊|會心/.test(t))return 'critical';
      if(/治癒|治療|恢復.*(?:HP|生命)/i.test(t))return 'healing';
      return 'combat';
    }
    return 'system';
  }
  function markup(id,html){
    const kind=sinks.get(id);
    if(!kind||typeof player==='undefined'||!player?.cls||!html.startsWith('<div'))return html;
    add({at:Date.now(),role:player.name||player.cls,map:mapState.current,kind:kind==='系統'&&html.includes('sys-item-gain')?'掉寶':kind,html});
    scheduleFlush();return html.replace(/^<div\b/,'<div data-giran-recorded');
  }
  function read(){
    const data=JSON.parse(localStorage.getItem(key)||'[]');
    if(!Array.isArray(data))throw Error('本機紀錄格式無法辨識，請先匯出完整備份。');
    return data;
  }
  function retain(rows){
    const ordered=rows.slice().sort((a,b)=>a.at-b.at);
    const recent=new Set(Object.entries(limits).flatMap(([kind,cap])=>ordered.filter(x=>x.kind===kind).slice(-cap)));
    return ordered.filter(x=>recent.has(x));
  }
  function parseFile(text){
    const rows=JSON.parse(text);
    if(!Array.isArray(rows))throw Error('請選擇「下載戰鬥與系統紀錄」匯出的 JSON 檔案。');
    for(const [i,r] of rows.entries()){
      const dated=Number.isSafeInteger(r?.at)&&r.at>=0&&r.at<=8640000000000000;
      if(!r||!Object.hasOwn(limits,r.kind)||!dated&&!(r.at===null&&r.undated===true)||
         typeof r.role!=='string'||typeof r.map!=='string'||typeof r.text!=='string'||!r.text.trim())
        throw Error('第 '+(i+1)+' 筆紀錄的時間、角色、地圖、種類或內容有誤。');
    }
    return rows.map(({at,role,map,kind,text,classes,marks})=>{
      const row={at,role,map,kind,text,...(at===null?{undated:true}:{})};
      const cls=inkClasses(classes);if(cls)row.classes=cls;
      if(Array.isArray(marks)&&marks.length<=1360){
        let pos=0,depth=0;const clean=[];
        for(const mark of marks){
          if(!Array.isArray(mark)||!Number.isInteger(mark[0])||mark[0]<pos||mark[0]>text.length)break;
          pos=mark[0];
          if(mark.length===1){if(!depth)break;depth--;clean.push([pos]);}
          else{depth++;const ink=inkColor(mark[2]);clean.push(ink?[pos,inkClasses(mark[1]),ink]:[pos,inkClasses(mark[1])]);}
        }
        if(clean.length&&clean.length===marks.length&&depth===0)row.marks=clean;
      }
      return row;
    });
  }
  function compare(incoming){
    const current=read(),counts=new Map(),arrivals=[];
    const signature=row=>JSON.stringify([row.at,row.role,row.map,row.kind,row.text]);
    for(const row of current){const sig=signature(row);counts.set(sig,(counts.get(sig)||0)+1);}
    for(const row of incoming){
      const sig=signature(row),remaining=counts.get(sig)||0;
      if(remaining)counts.set(sig,remaining-1);else arrivals.push(row);
    }
    const rows=retain([...current,...arrivals]),kept=new Set(rows);
    return {rows,total:incoming.length,overlap:incoming.length-arrivals.length,
      added:arrivals.filter(x=>kept.has(x)).length,expired:current.length+arrivals.length-rows.length};
  }
  const locked=fn=>navigator.locks?navigator.locks.request('giran-journal-write',fn):Promise.resolve().then(fn);
  function merge(incoming){
    return locked(()=>{
      flush();const result=compare(incoming);
      if(result.added)localStorage.setItem(key,JSON.stringify(result.rows));
      return result;
    });
  }
  function collect(records){
    if(typeof player==='undefined'||!player?.cls)return;
    for(const event of records){
      const kind=sinks.get(event.target.id);if(!kind)continue;
      for(const row of event.addedNodes){
        if(row.nodeType!==1||row.hasAttribute('data-giran-recorded'))continue;
        const entry={at:Date.now(),role:player.name||player.cls,map:mapState.current,kind:row.querySelector('.sys-item-gain')&&kind==='系統'?'掉寶':kind};
        capture(entry,row);if(entry.text)add(entry);
      }
    }
  }
  const observer=new MutationObserver(records=>{collect(records);scheduleFlush();});
  for(const id of sinks.keys()){const panel=document.getElementById(id);if(panel)observer.observe(panel,{childList:true});}
  function flush(){
    collect(observer.takeRecords());
    if(!queue.length)return;
    let raw;
    try{
      const list=read();
      for(const entry of queue){
        normalize(entry);if(entry.text)list.push(entry);
      }
      raw=JSON.stringify(retain(list));localStorage.setItem(key,raw);queue.length=0;writeError='';
    }catch(error){
      writeError=error.message;
      if(queue.length>limits['戰鬥']+limits['系統']){const recent=retain(queue);queue.length=0;queue.push(...recent);}
    }
    return raw;
  }
  function current(){const raw=flush();return raw?JSON.parse(raw):read();}
  if(document.getElementById('combat-log')){
    setInterval(()=>{if(queue.length)locked(flush).catch(()=>{});},4000);window.addEventListener('pagehide',flush);
  }
  return {key,read,current,retain,parseFile,compare,merge,flush,markup,category,tone,subscribe,normalize,paint,get writeError(){return writeError;}};
})();
