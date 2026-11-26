'use strict';
window.GiranTraining=(()=>{
 const stats={str:'力量',dex:'敏捷',con:'體質',int:'智力',wis:'精神',cha:'魅力'};
 const escape=val=>String(val??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function books(source,inventory){
  const available=new Map();
  _withAllyEquipmentContext(source,()=>{
   for(const item of inventory){
    const d=DB.items[item.id];
    if(!d||d.type!=='skillbk'||item.lock||!(item.cnt>0)||available.has(d.sk)||!DB.skills[d.sk]||skillBookIssue(d.sk))continue;
    available.set(d.sk,{item,skill:d.sk,name:DB.skills[d.sk].n});
   }
  });
  return [...available.values()];
 }
 function controls(ctx){
  if(window.GiranGuestSlot?.(ctx.slotN))return '';
  const p=ctx.source,choices=books(p,player.inv),bonus=Number(p.bonus)||0;
  if(!choices.length&&!bonus)return '';
  let html='<details class="g-training"><summary>隊員研習與配點</summary>';
  if(choices.length)html+='<div><select aria-label="要教給隊員的技能書" data-team-book>'+choices.map(v=>'<option value="'+escape(v.skill)+'">'+escape(v.name)+'</option>').join('')+(choices.length>1?'<option value="*">全部可學的技能書（'+choices.length+'）</option>':'')+'</select><button type="button" class="btn ag-btn" data-team-learn>使用隊長的技能書</button></div>';
  if(bonus)html+='<div><select aria-label="隊員能力配點" data-team-stat>'+Object.entries(stats).map(([k,n])=>'<option value="'+k+'">'+n+' '+((p.base?.[k]||0)+(p.alloc?.[k]||0)+(p.panacea?.[k]||0))+'</option>').join('')+'</select><button type="button" class="btn ag-btn" data-team-spend>投入 1 點（剩 '+bonus+'）</button></div>';
  return html+'</details>';
 }
 function apply(slot,request){
  if(window.GiranGuestSlot?.(slot))throw Error('連線隊員的養成由本人管理');
  const leader=player,ctx=_allyManagerSource(slot,true);if(!ctx)throw Error('這位隊員目前無法在安全區管理');
  const source=ctx.source,learned=[],assigned={};
  const action=()=>{
   if(request.skill){
    for(const row of books(source,leader.inv)){
     if(row.skill!==request.skill&&request.skill!=='*')continue;
     if(!_allyConsumeLeaderItem(leader,row.item,1))throw Error('技能書數量已變更');
     source.skills.push(row.skill);learned.push(row.skill);
    }
   }
   _withAllyEquipmentContext(source,()=>{
    for(const [key,amount] of Object.entries(request.points||{})){
     if(!Object.hasOwn(stats,key)||!Number.isSafeInteger(amount)||amount<1)continue;
     for(let i=0;i<Math.min(amount,100);i++){
      const before=source.bonus||0;if(!before)break;
      adjBonusStat(key);if(source.bonus===before)break;assigned[key]=(assigned[key]||0)+1;
     }
    }
   });
   if(!learned.length&&!Object.keys(assigned).length)throw Error('目前沒有可用的技能書或能力點數');
   if(!_lzSet('lineage_idle_save_'+ctx.slotN,_saveWrap(JSON.stringify(ctx.doc))))throw Error('隊員存檔寫入失敗');
   const updated=refreshAllyOnce(ctx.slotN);
   if(updated?.kind!=='refresh')throw Error('隊員資料未能刷新');
  };
  LineageGrowth.transaction('隊員研習與配點',action,disk=>{
   const role=_readAllySource(slot,false),companion=disk.p.allies.find(a=>String(a?._slot)===String(slot));
   return !!role&&!!companion&&learned.every(id=>role.source.skills.includes(id)&&companion.skills.includes(id))&&
    Object.keys(assigned).every(k=>role.source.alloc[k]===source.alloc[k])&&JSON.stringify(disk.p.inv)===JSON.stringify(leader.inv);
  });
  return {learned,assigned};
 }
 function click(event,slot,div){
  const learn=event.target.closest('[data-team-learn]'),spend=event.target.closest('[data-team-spend]');
  if(!learn&&!spend)return false;
  try{
   const request=learn?{skill:div.querySelector('[data-team-book]').value}:{points:{[div.querySelector('[data-team-stat]').value]:1}};
   const result=apply(slot,request);logSys(learn?'隊員學會了'+result.learned.map(k=>DB.skills[k].n).join('、')+'。':'隊員已投入 1 點能力。');
   openAllyEquipmentManager(slot);const detail=div.querySelector('.g-training');if(detail)detail.open=true;
  }catch(e){logSys(escape(e.message));}
  return true;
 }
 return {controls,apply,click,books};
})();
