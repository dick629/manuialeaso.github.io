/* Shared castle payouts: serialize tabs, then save rewards and claim cursor together. */
(function(W){'use strict';
 const G=W.LineageGrowth;let pending=0,blocked=false;
 const P=()=>typeof player!=='undefined'?player:null;
 function count(id){return(P().inv||[]).filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt==null?1:Number(x.cnt)||0),0);}
 function give(id,n){if(!DB.items[id])throw Error('獎勵物品不存在：'+id);const before=count(id);gainItem(id,n,true,true);if(count(id)!==before+n)throw Error('獎勵物品未完整入帳');}
 function diamonds(n){const r=W.pandoraAdjustSharedDiamonds(n);if(!r||!r.ok)throw Error('龍鑽入帳失敗');}
 async function settle(label,prepare){
  const owner=P(),slot=currentSlot;if(blocked||!owner||owner.dead)return{ok:false,busy:true};
  pending++;
  try{
   if(!navigator.locks)throw Error('瀏覽器不支援安全領獎鎖，請使用 HTTPS 或本機網址');
   return await navigator.locks.request('lineage-clan-rewards',{mode:'exclusive'},()=>{
    if(blocked||P()!==owner||currentSlot!==slot||owner.dead) return{ok:false,cancelled:true};
    const job=prepare();if(!job)return{ok:true,skipped:true};
    const log=W.logSys,lines=[];let value;
    W.logSys=function(){lines.push(Array.from(arguments));};
    try{value=G.transaction(label,job,(disk,p)=>disk.p.gold===p.gold&&JSON.stringify(disk.p.inv)===JSON.stringify(p.inv));}
    finally{W.logSys=log;}
    lines.forEach(args=>log.apply(W,args));
    return{ok:true,value};
   });
  }catch(e){if(/回復失敗/.test(e.message))blocked=true;logSys('<span class="text-red-300">'+clanEsc(label+'未完成：'+e.message)+'。請從天賦巔峰下載最近交易備份。</span>');return{ok:false,error:e.message};}
  finally{pending--;}
 }
 function income(){return settle('城堡收成',()=>{
  const CW=W.__afkCastleWar,n=CW.held().length,d=CW.data(),now=Date.now(),hour=3600000;
  if(n<3||!d.lastPay){d.lastPay=now;CW.save(d);return null;}
  const elapsed=Math.floor((now-d.lastPay)/hour);if(elapsed<=0)return null;
  const hours=Math.min(elapsed,168),gold=(n>=7?10000000:5000000)*hours,dia=n>=5?100*hours:0,cry=n>=7?100*hours:0;
  return()=>{P().gold+=gold;if(dia)diamonds(dia);if(cry)give('sherine_crystal',cry);
   // Discard time beyond the seven-day cap, not another claimable backlog.
   d.lastPay+=elapsed*hour;CW.save(d);if(CW.data().lastPay!==d.lastPay)throw Error('收成時間保存失敗');return{hours,gold,dia,cry};};
 }).then(r=>{if(r.ok&&r.value)logSys('<span class="text-yellow-300">城堡收成已入帳並保存（'+r.value.hours+' 小時）。</span>');return r;});}
 W.LineageClanRewards={settle,income,give,diamonds,status:()=>({busy:pending>0,blocked})};
})(window);
