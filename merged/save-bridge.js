/* Portable save boundary. Never execute imported text, guess lost progress, or bypass SIG2. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./legacy-codec.js'));
 else root.LineageSaveBridge=factory(root.LineageLegacyCodec);
})(typeof globalThis!=='undefined'?globalThis:this,function(codec){
 'use strict';
 const FORMAT='idle-lineage-full',SCHEMA=1,MAX_TEXT=32*1024*1024;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 class SaveError extends Error{constructor(code,message){super(message);this.name='SaveError';this.code=code;}}
 function fail(code,message){throw new SaveError(code,message);}
 function safeTree(value){
  let count=0;const todo=[[value,0]];
  while(todo.length){const [v,depth]=todo.pop();if(++count>600000||depth>80)fail('LIMIT','檔案內容過於複雜，請保留原檔並交由開發者檢查。');
   if(v&&typeof v==='object')for(const key of Object.keys(v)){
    if(['__proto__','prototype','constructor'].includes(key))fail('UNSAFE_KEY','檔案含有不安全的欄位，未寫入任何資料。');
    todo.push([v[key],depth+1]);
   }
  }
 }
 function parse(text){let obj;try{obj=JSON.parse(text);}catch{fail('JSON','檔案不完整或格式錯誤，請改用先前備份。');}safeTree(obj);return obj;}
 function decode(input){
  if(typeof input!=='string'||!input.length)fail('EMPTY','檔案是空的，請重新匯出。');
  if(input.length>MAX_TEXT)fail('LIMIT','檔案超過可處理範圍，請保留原檔並交由開發者檢查。');
  let text=input.replace(/^\uFEFF/,'').trimStart(),compressed=false,signed=false;
  if(text.startsWith('LZ1:')){
   compressed=true;try{text=codec.decompress(text.slice(4));}catch{fail('COMPRESSION','壓縮資料毀損，請改用先前備份。');}
   if(typeof text!=='string'||!text.length||text.length>MAX_TEXT)fail('COMPRESSION','無法完整解開存檔，請改用先前備份。');
  }
  if(text.startsWith('SIG2:'))fail('DESKTOP','這是安裝版專用存檔，請回到原安裝版匯出或還原。');
  let payload=text;
  if(text.startsWith('SIG1:')){
   signed=true;const split=text.indexOf(':',5);if(split<0)fail('SIGNATURE','存檔完整性檢查失敗，請改用先前備份。');
   payload=text.slice(split+1);const sig=text.slice(5,split);
   if(codec.sign(payload)!==sig){
    // Text editors may append a newline to a payload whose signed JSON already ended in spaces.
    const candidates=[payload.replace(/[\r\n]+$/,''),payload.trimEnd()];
    const valid=candidates.find(x=>codec.sign(x)===sig);
    if(valid===undefined)fail('SIGNATURE','存檔完整性檢查失敗，請改用先前備份。');payload=valid;
   }
  }
  const value=parse(payload);
  if(record(value)&&value.format==='idle-lineage-desktop-save')fail('DESKTOP','安裝版資料需要原安裝版處理。');
  return {value,payload,signed,compressed,portable:signed?codec.wrap(payload):payload};
 }
 function validateRole(value){
  if(!record(value)||!record(value.p)||typeof value.p.cls!=='string'||!value.p.cls)fail('ROLE','找不到完整角色資料。');
  if(!Array.isArray(value.p.inv)||!record(value.p.eq)||!record(value.ms))fail('ROLE','角色背包、裝備或地圖資料不完整，未修改存檔。');
  if(!['knight','mage','elf','dark','illusion','dragon','warrior','royal'].includes(value.p.cls))fail('NEW_CLASS','這個職業尚未驗證，請先更新合併版。');
  return value;
 }
 function inspect(input){
  const d=decode(input),v=d.value;
  if(record(v)&&v.format===FORMAT){
   if(v.schema!==SCHEMA)fail('SCHEMA','此備份版本尚未支援，請先更新合併版。');
   if(!record(v.keys))fail('PACK','完整備份缺少資料。');
   const names=Object.keys(v.keys);
   if(!names.length||!Number.isInteger(v.keyCount)||v.keyCount!==names.length)fail('PACK','備份項目不完整，請重新匯出。');
   for(const k of names)if(typeof v.keys[k]!=='string')fail('PACK','備份項目格式不正確。');
   return {...d,kind:'full',keys:v.keys,roles:names.filter(k=>/^lineage_idle_save(?:_\d+)?$/.test(k))};
  }
  validateRole(v);return {...d,kind:'role',roles:[v.p.cls]};
 }
 function pack(keys){
  const out=Object.create(null);for(const k of Object.keys(keys)){if(typeof keys[k]!=='string')fail('PACK','備份讀取失敗。');out[k]=keys[k];}
  safeTree(out);return {format:FORMAT,schema:SCHEMA,exportedAt:new Date().toISOString(),keyCount:Object.keys(out).length,keys:out};
 }
 function itemDefinition(profile,id){
  if(own(profile.items,id))return profile.items[id];
  if(profile.derivedRelics!==1)return null;
  const p=/^((?:relic_|wpn_)[a-z0-9_]+)~r(\d{1,2})(?:~((?:relic_|wpn_)[a-z0-9_]+))?(?:~a([0-5]))?(?:~e([0-9]))?(?:~g((?:relic_|wpn_)[a-z0-9_]+))?$/.exec(id);
  if(!p||!own(profile.items,p[1]))return null;
  const base=profile.items[p[1]],n=Number(p[2]),asc=p[4]==null?null:Number(p[4]);
  if(!base.relic||!Number.isInteger(base.relicMax)||n<1||n>base.relicMax)return null;
  if(asc!==null&&n!==base.relicMax&&!(base.type==='acc'&&n===5))return null;
  if(p[5]!=null&&asc!==5||p[6]&&p[5]==null)return null;
  if([p[3],p[6]].some(key=>key&&!own(profile.items,key)))return null;
  return base;
 }
 function analyzeCompatibility(value,profile){
  validateRole(value);const blockers=[],warnings=[];
  if(!profile||!record(profile.items))return {ok:false,blockers:[{code:'NO_PROFILE',message:'目標版本尚未完成驗證。'}],warnings};
  if(value.p.classPath&&profile.classSystem!==1)blockers.push({code:'CLASS_SYSTEM',message:'目標版本沒有新版職業傳承，不能安全保留已固定的流派與大絕。'});
  if(value.p.sherineMixed&&profile.sherineSystem!==1)blockers.push({code:'SHERINE_SYSTEM',message:'目標版本不支援席琳新舊界約，不能安全轉出。'});
  if(!Number.isInteger(value.p.lv)||value.p.lv<1||!Number.isFinite(value.p.exp)||value.p.exp<0||!Number.isFinite(value.p.gold)||value.p.gold<0||value.p.gold>Number.MAX_SAFE_INTEGER)blockers.push({code:'PROGRESS_INVALID',message:'角色等級、經驗或金幣資料異常，不能直接轉換。'});
  const maxLevel=Array.isArray(profile.rebirthCaps)?profile.rebirthCaps[Math.min(profile.rebirthCaps.length-1,Math.max(0,Math.floor(Number(value.p.rebirth)||0)))]:profile.maxLevel;
  if(Number(value.p.lv)>maxLevel)blockers.push({code:'LEVEL_CAP',message:'角色等級超過此版本可保留的上限。'});
  if(Array.isArray(profile.maps)&&typeof value.ms.current==='string'&&!profile.maps.includes(value.ms.current))blockers.push({code:'UNKNOWN_MAP',message:'此版本沒有角色目前所在的地圖，請先在來源版本回到共通城鎮再匯出。'});
  if(Array.isArray(profile.skills)&&Array.isArray(value.p.skills)&&value.p.skills.some(id=>!profile.skills.includes(id)))blockers.push({code:'UNKNOWN_SKILL',message:'此版本沒有角色已學會的技能，暫時不能安全轉換。'});
  const checkItem=(item,location)=>{
   if(item===null||item===undefined)return;
   if(!record(item)||typeof item.id==='undefined'){blockers.push({code:'ITEM_SHAPE',location,message:'物品資料不完整。'});return;}
   if(profile.sherineSystem!==1&&/^(潮誓|葬星|裂鎧|冥契|破曉|鏡潮|星祭|封夢|噬影|界織|祖誓|燼心)夢?$/.test(item.seteff||'')){blockers.push({code:'SHERINE_SYSTEM',location,message:'目標版本沒有這件席琳新系的套裝效果，不能安全轉出。'});return;}
   const def=itemDefinition(profile,String(item.id));
   if(!def){blockers.push({code:'UNKNOWN_ITEM',location,message:'無法辨識物品 '+String(item.id)+'，已停止以免遺失物品或效果；請更新程式與物品資料後再試。'});return;}
   if(def.cap!==null&&Number.isFinite(def.cap)&&Number(item.en)>def.cap)blockers.push({code:'ENCHANT_CAP',location,message:'此版本會降低這件裝備的強化值。'});
  };
  value.p.inv.forEach((x,i)=>checkItem(x,'背包 '+(i+1)));
  Object.keys(value.p.eq).forEach(k=>checkItem(value.p.eq[k],'裝備 '+k));
  if(value.wh){if(!record(value.wh)||!Array.isArray(value.wh.items))blockers.push({code:'WAREHOUSE',message:'倉庫資料不完整。'});else value.wh.items.forEach((x,i)=>checkItem(x,'倉庫 '+(i+1)));}
  if(Array.isArray(value.pets))for(const pet of value.pets)if(pet&&record(pet.eq))Object.keys(pet.eq).forEach(k=>checkItem(pet.eq[k],'寵物裝備 '+k));
  warnings.push({code:'RULES',message:'存檔欄位會保留；目標版本沒有的玩法與效果不會因此啟用。'});
  return {ok:!blockers.length,blockers,warnings};
 }
 function exportRole(input,profile){const d=inspect(input);if(d.kind!=='role')fail('SELECT_ROLE','完整備份請先還原至合併版，再匯出選定角色。');const a=analyzeCompatibility(d.value,profile);if(!a.ok)fail('INCOMPATIBLE',a.blockers[0].message);return codec.wrap(d.payload);}
 function roleKeys(keys){return Object.keys(keys).filter(k=>/^lineage_idle_save(?:_\d+)?$/.test(k));}
 function encodeRole(value){safeTree(value);validateRole(value);return codec.wrap(JSON.stringify(value));}
 return Object.freeze({decode,inspect,parse,pack,validateRole,analyzeCompatibility,exportRole,roleKeys,SaveError,MAX_TEXT,own,record,encodeRole});
});
