'use strict';
(()=>{
  const section=document.getElementById('giran-compare');
  const source=section.querySelector('#gc-source'),target=section.querySelector('#gc-target'),run=section.querySelector('#gc-run'),
    status=section.querySelector('output'),detail=section.querySelector('ul'),download=section.querySelector('#gc-download');
  const groups={lineage_giran_journal_v1:'戰鬥與系統紀錄',lineage_giran_events_v1:'世界除錯事件',
    lineage_idle_warehouse:'共用倉庫',lineage_giran_source_v1:'封存的奇岩舊檔'};
  const labels={'p.gold':'金幣','p.lv':'等級','p.exp':'經驗','p.hp':'生命','p.mp':'魔力','p.name':'角色名','p.cls':'職業',
    'p.eq':'穿戴裝備','p.inv':'背包內容','p.allies':'跟隨隊員','p.skills':'已學技能','p.equipDex':'裝備與娃娃圖鑑',
    'p.questFlags':'任務進度','p.trialQ':'試煉任務','p.giranHunt':'狩獵設定','p.giranWorld':'隊伍座標',
    'p.giranBookmarks':'位置書籤','ms.current':'所在地圖','ms.mobs':'場上怪物',ticks:'遊戲時間'};
  const format=value=>value==null?'無':typeof value==='number'?value.toLocaleString('zh-TW'):value===true?'是':value===false?'否':String(value);
  let revision=0,report=null;
  function reset(){
    revision++;report=null;run.disabled=!source.files.length;download.disabled=true;detail.replaceChildren();status.textContent='';
  }
  source.addEventListener('change',reset);target.addEventListener('change',reset);
  function localBackup(){
    const keys=LineageRecovery.capture(localStorage);
    if(!LineageSaveBridge.roleKeys(keys).length)return null;
    return JSON.stringify(LineageSaveBridge.pack(keys));
  }
  async function read(file){
    if(file.size>LineageSaveBridge.MAX_TEXT)throw Error('檔案超過可讀大小');
    return file.text();
  }
  const brief=row=>row?{name:row.name,level:row.level,party:row.party,items:row.items,equipment:row.equipment}:null;
  const title=row=>row?row.name+' Lv.'+row.level+'，背包 '+row.items+' 格、穿戴 '+row.equipment+' 件':'沒有這個欄位';
  function line(text){const li=document.createElement('li');li.textContent=text;detail.append(li);}
  run.onclick=async()=>{
    const id=++revision;run.disabled=true;download.disabled=true;report=null;detail.replaceChildren();status.textContent='正在核對…';
    try{
      const [first,second]=await Promise.all([read(source.files[0]),target.files.length?read(target.files[0]):localBackup()]);
      if(id!==revision)return;
      const api=GiranSaveComparison,a=api.inspect(first,undefined,true),b=second?api.inspect(second,undefined,true):{format:'full',roles:[],shared:{}};
      if(a.format!==b.format)throw Error('請用兩份完整備份，或兩份單一角色檔來核對。');
      const diff=api.compare(a,b),left=new Map(a.roles.map(r=>[r.slot,r])),right=new Map(b.roles.map(r=>[r.slot,r]));
      const different=diff.roles.map(slot=>({slot,source:brief(left.get(slot)),target:brief(right.get(slot)),
        fields:api.fields(left.get(slot)?.record,right.get(slot)?.record)}));
      const same=!different.length&&!diff.shared.length;
      const result={equal:same,sourceRoles:a.roles.length,targetRoles:b.roles.length,sharedCompared:new Set([...Object.keys(a.shared),...Object.keys(b.shared)]).size,
        roles:different,shared:diff.shared,scope:a.format==='full'?'完整備份':'單一角色'};
      if(a.format==='full'){
        status.textContent=same?'兩端 '+a.roles.length+' 個角色與 '+result.sharedCompared+' 項共用資料內容一致。':
          '來源 '+a.roles.length+' 人、目的地 '+b.roles.length+' 人。'+different.length+' 個角色欄位與 '+diff.shared.length+' 項共用資料有差異。';
      }else status.textContent=same?'兩份角色檔內容一致。':'這兩份角色檔有差異。';
      for(const row of different){
        const slot=row.slot.match(/_(\d+)$/);
        line((slot?'第 '+slot[1]+' 欄':'角色')+'　來源 '+title(row.source)+'　目的地 '+title(row.target));
        if(!row.source||!row.target)continue;
        const items=document.createElement('ul');detail.lastElementChild.append(items);
        for(const field of row.fields.slice(0,10)){
          const li=document.createElement('li');li.textContent=(labels[field.path]||field.path)+
            (Object.hasOwn(field,'source')?'　'+format(field.source)+' → '+format(field.target):'　內容有變更');items.append(li);
        }
        if(row.fields.length>10){const li=document.createElement('li');li.textContent='另有 '+(row.fields.length-10)+' 個欄位，完整差異可下載。';items.append(li);}
        else if(!row.fields.length){const li=document.createElement('li');li.textContent='角色資料的儲存格式不同。';items.append(li);}
      }
      for(const key of diff.shared)line((groups[key]||key)+'　'+(!Object.hasOwn(a.shared,key)?'僅目的地有':!Object.hasOwn(b.shared,key)?'僅來源有':'兩端內容不同'));
      report=result;download.disabled=false;
    }catch(error){if(id===revision)status.textContent=error.message||'無法讀取備份';}
    finally{if(id===revision)run.disabled=!source.files.length;}
  };
  download.onclick=()=>{
    if(!report)return;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    a.download='奇岩搬家比對結果.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
})();
