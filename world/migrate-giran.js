'use strict';
window.GiranMigration=(()=>{
 const classes=['royal','knight','elf','mage','dark'],avatars=[['王子','公主'],['男騎士','女騎士'],['男妖精','女妖精'],['男法師','女法師'],['男黑暗妖精','女黑暗妖精']];
 const table=[0];for(let lv=1;lv<=99;lv++)table[lv]=lv<5?(lv-1)*15:lv<10?Math.floor(lv**2.7):lv<30?Math.floor(lv**3.3):lv<50?Math.floor(lv**3.85):table[lv-1]+Math.floor(lv**3.6*(lv>=65?2.5:1.5));
 const uint=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(label+'數值超出可讀範圍，請保留原始檔。');return v;};
 async function convert(text){
  const original=LineageSaveBridge.decode(text).value;
  if(!Array.isArray(original.chars)||!original.chars.length||!Array.isArray(original.warehouse||[]))throw Error('請選擇奇岩城 characters.json。');
  if(original.chars.length>16)throw Error('新版有 16 個角色欄位，請先在來源端分成兩份再匯入。');
  const load=async u=>{const r=await fetch(u);if(!r.ok)throw Error('轉移對照資料載入失敗');return r.json();};
  const [schema,areas]=await Promise.all([load('world/giran-migration.json'),load('dimension-map/areas.json')]);
  const defs=LineageCurrentProfile.items,keys=Object.create(null),notes=[],rows=[],warehouse={items:[],gold:0};
  const note=(owner,detail)=>notes.push({owner,detail});
  function moveDolls(p,record){
   if(!record)return;
   const make=(id,cnt)=>({id,uid:LineageClientCrypto.uuid(),cnt,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false});
   const seen=p.equipDex||={};
   for(const id of Array.isArray(record.seen)?record.seen:[]){
    if(Object.hasOwn(schema.dolls,id))seen[schema.dolls[id]]=true;else note(p.name,'娃娃圖鑑編號 '+id+' 保留在原檔');
   }
   for(const [number,amount] of Object.entries(record.own||{})){
    const count=uint(amount,0,Number.MAX_SAFE_INTEGER,p.name+'的娃娃數量');if(!count)continue;
    const id=Object.hasOwn(schema.dolls,number)?schema.dolls[number]:null;
    if(!id){note(p.name,'娃娃編號 '+number+' ×'+count+' 保留在原檔');continue;}
    seen[id]=true;
    const worn=String(record.worn)===number;
    if(worn){if(p.eq.doll)p.inv.push(p.eq.doll);p.eq.doll=make(id,1);}
    const rest=count-(worn?1:0);if(rest)p.inv.push(make(id,rest));
   }
   if(record.worn&&!p.eq.doll)note(p.name,'已召喚的娃娃缺少持有資料，穿戴狀態保留在原檔');
   if(record.bag2)note(p.name,'精緻魔法娃娃的袋子 ×'+uint(record.bag2,0,Number.MAX_SAFE_INTEGER,'娃娃袋數量')+' 保留在原檔');
   for(const [field,id] of [['bag','doll_bag'],['box','doll_box_high']]){
    const count=uint(record[field]??0,0,Number.MAX_SAFE_INTEGER,p.name+'的娃娃袋盒');
    if(count){const stack=p.inv.find(it=>it.id===id);if(stack)stack.cnt=uint(stack.cnt+count,0,Number.MAX_SAFE_INTEGER,p.name+'的娃娃袋盒');else p.inv.push(make(id,count));}
   }
  }
  function readItem(it,owner,dest,account){
   if(!it||typeof it!=='object')throw Error(owner+' 的物件資料不完整。');
   const amount=uint(it.count??1,1,Number.MAX_SAFE_INTEGER,owner+'的數量');
   if(it.itemId===40308){account.gold=uint(account.gold+amount,0,Number.MAX_SAFE_INTEGER,'金幣');return;}
   const id=GiranAtlasData.itemIds[it.itemId],d=id&&defs[id];
   if(!d){note(owner,'道具編號 '+it.itemId+' 保留在原檔');return;}
   const en=Number(it.ench??0);
   if(!Number.isSafeInteger(en)||en<0||(Number.isFinite(d.cap)&&en>d.cap)){note(owner,d.name+' 的強化值 '+en+' 保留在原檔');return;}
   if(it.bless===2){note(owner,'詛咒物品「'+d.name+'」保留在原檔');return;}
   const wearable=['wpn','arm','acc'].includes(d.type),copies=wearable?amount:1;
   if(copies>2000)throw Error(owner+' 的單筆裝備數量太大，請先在原版整理。');
   for(let i=0;i<copies;i++){
    const item={id,uid:LineageClientCrypto.uuid(),cnt:wearable?1:amount,en,bless:it.bless===0,anc:false,attr:false,seteff:false,lock:false,junk:false};
    const eq=account.eq;
    let slot=d.type==='wpn'?'wpn':d.slot;
    if(slot==='ring'&&eq)slot=['ring1','ring2'].find(s=>!eq[s]);
    if((slot==='ear'||slot==='earring')&&eq)slot=(!eq.ear1?'ear1':account.lv>=59&&!eq.ear2?'ear2':null);
    if(it.equipped&&wearable&&eq&&Object.hasOwn(eq,slot)&&!eq[slot]&&i===0)eq[slot]=item;
    else dest.push(item);
   }
  }
  const effectKeys={43:'haste',54:'haste',79:'sk_soul_up',115:'giran_iron_morale',148:'giran_fire_ward',149:'giran_wind_ward',151:'giran_earth_guard',158:'giran_life_spring',160:'giran_water_guard',1001:'haste',1002:'blue',1004:'cautious'};
  const now=Date.now();
  function carryEffects(ch,p){
   if(!ch.effects||typeof ch.effects!=='object')return;
   const timers=p.buffs||={};
   for(const key of ['giran_iron_morale','giran_earth_guard','giran_life_spring','giran_water_guard'])timers[key]=0;
   for(const [id,expires] of Object.entries(ch.effects)){
    if(Number.isSafeInteger(expires)&&expires>=0&&expires<=now)continue;
    const key=Object.hasOwn(effectKeys,id)?effectKeys[id]:null;
    if(!key||!Number.isSafeInteger(expires)||expires<0){note(p.name,'狀態編號 '+id+' 保留在原檔');continue;}
    timers[key]=Math.max(timers[key]||0,Math.ceil((expires-now)/1000));
   }
  }
  const mapKeys=new Set(LineageCurrentProfile.maps),places=Object.entries(areas).filter(([key])=>mapKeys.has(key));
  function position(map,x,y){
   if(![map,x,y].every(Number.isSafeInteger))return null;
   let best=null,distance=Infinity;
   for(const [key,a] of places){
    if((a.sourceMap??a.map)!==map)continue;
    const offset=a.offset||[0,0],tx=x+offset[0],ty=y+offset[1],d=(tx-a.x)**2+(ty-a.y)**2;
    if(d<distance){distance=d;best={key,map:a.map,sourceMap:map,x:tx,y:ty};}
   }
   return best;
  }
  for(const [i,ch] of original.chars.entries()){
   const c=uint(ch.type,0,4,'職業'),lv=uint(ch.level,1,99,'等級'),exp=uint(ch.exp,0,Number.MAX_SAFE_INTEGER,'經驗');
   if(typeof ch.name!=='string'||!ch.name.trim()||ch.name.length>64||/[<>\u0000-\u001f]/.test(ch.name)||!Array.isArray(ch.inv))throw Error('第 '+(i+1)+' 位角色的姓名或背包格式不相容。');
   const p=structuredClone(schema.player),ms=structuredClone(schema.map),name=ch.name;
   Object.assign(p,{name,cls:classes[c],avatar:avatars[c][ch.sex===1?1:0],lv,expMigV:3,classicMode:false,gold:0,inv:[],skills:[],allies:[],dead:false,_roleEpoch:LineageClientCrypto.uuid()});
   p.exp=lv===99?0:Math.floor(Math.max(0,Math.min(1-Number.EPSILON,(exp-table[lv])/(table[lv+1]-table[lv])))*schema.requirements[lv]);
   p.base=Object.fromEntries(['str','dex','con','wis','cha','int'].map(k=>[k,uint(ch[k],1,255,name+' '+k)]));
   p.hp=uint(ch.hp??ch.maxHp,0,Number.MAX_SAFE_INTEGER,name+' HP');p.mp=uint(ch.mp??ch.maxMp,0,Number.MAX_SAFE_INTEGER,name+' MP');p.mhp=ch.maxHp;p.mmp=ch.maxMp;
   p.alignmentValue=Number(ch.lawful)||0;
   carryEffects(ch,p);
   const books={};
   for(const [legacy,field] of [['huntLv','hunt'],['toiLv','tower']]){
    const values=ch[legacy];if(values==null)continue;
    if(Array.isArray(values)&&values.length===10&&values.every(n=>Number.isInteger(n)&&n>=-1&&n<=10))books[field]=field==='tower'?[values[9],...values.slice(0,9)]:values;
    else note(name,legacy+' 圖鑑等級格式保留在原檔');
   }
   if(ch.collectDone&&typeof ch.collectDone==='object'){
    const ranks=[[6,4,6],[6,6]],gear={};
    for(const [k,flag] of Object.entries(ch.collectDone)){
     const match=/^([12]):([012])$/.exec(k),i=match?Number(match[1])-1:-1,j=match?Number(match[2]):-1;
     if(flag===true&&ranks[i]?.[j]){const slots=gear[i]||=Array(ranks[i].length).fill(-1);slots[j]=ranks[i][j];}
     else if(flag)note(name,'蒐藏登錄 '+k+' 保留在原檔');
    }
    if(Object.keys(gear).length)books.gear=gear;
   }
   if(Object.keys(books).length)p.giranCollections=books;
   const hunt=GiranHunt.importLegacy(ch.autoSettings,GiranAtlasData.mobs);
   if(hunt)p.giranHunt=hunt;
   for(const it of ch.inv)readItem(it,name,p.inv,p);
   moveDolls(p,ch.dolls);
   for(const sid of ch.skills||[]){const sk=schema.skills[sid];if(sk){if(!p.skills.includes(sk))p.skills.push(sk);}else note(name,'技能編號 '+sid+' 保留在原檔');}
   const where=position(ch.mapId,ch.x,ch.y);ms.current=where?.key||'town_silver_knight';ms.mobs=[null,null,null,null,null];
   if(where)p.giranWorld=where;else note(name,'原地圖位置保留在原檔，從銀騎士村莊接續');
   p.giranBookmarks=[];
   for(const b of Array.isArray(ch.bookmarks)?ch.bookmarks:[]){
    const point=b&&position(b.map,b.x,b.y);
    if(!point||typeof b.name!=='string'||!b.name.trim()){note(name,'有一個地點書籤保留在原檔');continue;}
    p.giranBookmarks.push({id:LineageClientCrypto.uuid(),name:b.name.trim().slice(0,32),color:Number(b.color)||0,...point});
   }
   const role={v:2,p,ms,ticks:0},check=LineageSaveBridge.analyzeCompatibility(role,LineageCurrentProfile);
   if(!check.ok)throw Error(name+'　'+check.blockers[0].message);
   keys['lineage_idle_save_'+(i+1)]=LineageSaveBridge.encodeRole(role);
   rows.push({name,level:lv,skills:p.skills.length,items:p.inv.length+Object.values(p.eq).filter(Boolean).length,gold:p.gold});
  }
  for(const it of original.warehouse||[])readItem(it,'共用倉庫',warehouse.items,warehouse);
  keys.lineage_idle_warehouse=JSON.stringify(warehouse);
  const ledger={schema:1};
  if(Array.isArray(original.mails)){
   const valid=original.mails.every(m=>m&&Number.isSafeInteger(m.id)&&typeof m.title==='string'&&Array.isArray(m.atts)&&m.atts.every(a=>a&&typeof a==='object'));
   if(valid)ledger.messages=original.mails;
   else note('共用信箱','有未對應的信件格式，完整信箱保留在原檔');
  }
  if(original.signin&&Number.isInteger(original.signin.next)&&original.signin.next>=1&&original.signin.next<=8){
   const date=String(original.signin.lastDay||'').replace(/^(\d{4})(\d\d)(\d\d)$/,'$1-$2-$3');
   ledger.signin={next:original.signin.next,lastDay:/^\d{4}-\d\d-\d\d$/.test(date)?date:''};
  }
  if(ledger.messages||ledger.signin)keys.lineage_giran_mail_v1=JSON.stringify(ledger);
  if(Array.isArray(original.history)){
   const history=[];let unmatched=0;
   for(const row of original.history){
    if(typeof row==='string'&&row.trim())history.push({at:null,undated:true,role:'',map:'',kind:'系統',text:row});
    else if(row&&typeof row==='object'&&typeof row.text==='string'&&row.text.trim()){
     let at=row.at;
     if(Number.isSafeInteger(at)&&at>=1e9&&at<1e10)at*=1000;
     if(typeof at==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(at))at=Date.parse(at);
     if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)at=null;
     history.push({at,...(at===null?{undated:true}:{}),role:typeof row.role==='string'?row.role:'',map:typeof row.map==='string'?row.map:'',kind:row.kind==='戰鬥'?'戰鬥':'系統',text:row.text});
    }else unmatched++;
   }
   if(history.length)keys.lineage_giran_journal_v1=JSON.stringify(GiranJournal.retain(history));
   if(unmatched)note('歷史紀錄',unmatched+' 筆未對應的舊格式保留在原檔');
  }
  keys.lineage_giran_source_v1=text;
  return {bundle:LineageSaveBridge.pack(keys),rows,notes,warehouse};
 }
 return {convert};
})();
