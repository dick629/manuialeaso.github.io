(function(W){'use strict';
 const C=W.LineageArcadeCore,H=W.__afkGameHall,G=W.LineageGrowth;
 const NAMES={tian:'四人打天九',bj:'21 點',pin:'柏青哥機台'};
 const STAKES={tian:{gold:[10000,50000,100000,500000,1000000],dia:[20,100,200,1000,2000],blood:[2,10,20,100,200]},bj:{gold:[10000,50000,100000,500000,1000000],dia:[20,100,200,1000,2000],blood:[2,10,20,100,200]},pin:{gold:[50000],dia:[100],blood:[10]}};
 const P=()=>typeof player!=='undefined'&&player&&player.cls?player:null;
 let busy=false,blocked=false;
 function data(){const p=P();if(!p)throw Error('請先進入角色');if(p.afkArcade===undefined)p.afkArcade={v:1,seq:0,round:null,frac:{gold:0,dia:0,blood:0},history:[],stats:{},banker:{normal:0,expert:0},shoes:{}};
  const d=p.afkArcade;if(!d||d.v!==1||!d.frac||!d.history||!d.stats||!d.banker||!d.shoes)throw Error('小遊戲資料版本異常，請保留存檔並使用存檔修復');return d;
 }
 function seed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}
 function active(){const r=data().round;return r&&!r.settled?r:null;}
 function check(){if(blocked)throw Error('交易回復尚未完成，請先下載交易備份');const p=P();if(!p||p.dead||p.classicMode)throw Error('請使用存活的非經典角色');if(busy)throw Error('正在保存上一個操作');return p;}
 function transact(label,fn){check();
  const disk=_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot));
  if(disk.signed&&!disk.ok)throw Error('存檔完整性檢查失敗，未進行交易');
  if(disk.payload){const stored=JSON.parse(disk.payload).p.afkArcade,live=data();if(JSON.stringify(stored)!==JSON.stringify(live)&&!(stored===undefined&&live.seq===0&&!live.round))throw Error('角色的小遊戲資料已被其他分頁更新，請重新讀取角色');}
  busy=true;const log=W.logSys;
  // A saved action for every NPC move should not cover the phone header with success toasts.
  if(typeof log==='function')W.logSys=function(message){if(message==='遊戲進度已儲存。')return;return log.apply(this,arguments);};
  try{return G.transaction(label,fn,(disk,p)=>JSON.stringify(disk.p.afkArcade)===JSON.stringify(p.afkArcade)&&disk.p.gold===p.gold&&JSON.stringify(disk.p.inv)===JSON.stringify(p.inv));}
  catch(e){if(/回復失敗/.test(e.message))blocked=true;throw e;}
  finally{if(typeof log==='function')W.logSys=log;busy=false;}
 }
 function settle(d,r){if(r.settled)return;const raw=r.game==='tian'?r.reserve+r.g.scores[0]*r.stake:r.game==='bj'?r.reserve+r.g.pNet*r.stake:r.g.v===2?r.g.s.balls*r.stake/100:r.stake*r.g.mult;
  if(!Number.isFinite(raw)||raw<0||raw>Number.MAX_SAFE_INTEGER/100)throw Error('派彩金額超出安全範圍');
  const cents=Math.round(raw*100)+(d.frac[r.cur]||0),pay=Math.floor(cents/100);d.frac[r.cur]=cents%100;
  if(pay&&!H.credit(r.cur,pay))throw Error('派彩入帳失敗');r.settled=true;r.returned=pay;r.finished=Date.now();
  const key=r.game+':'+r.mode+':'+r.cur,s=d.stats[key]||(d.stats[key]={rounds:0,net:0,win:0,playerPoints:0,aiPoints:0});s.rounds++;s.net+=raw-r.reserve;if(raw>r.reserve)s.win++;
  if(r.game==='bj'){s.playerPoints+=r.g.pNet;s.aiPoints+=r.g.nNet;}if(r.game==='tian')d.banker[r.mode]=r.g.lastWinner;
  const bet=r.game==='bj'?r.stake*r.g.pMult:r.reserve,won=r.game==='bj'?r.g.pReturn*bet:raw;
  H.statAdd('arcade-'+r.game+'-'+r.mode,r.cur,bet,won,bet?won/bet:0,true);
  d.history.unshift({id:r.id,game:r.game,mode:r.mode,cur:r.cur,net:raw-r.reserve,at:r.finished});d.history=d.history.slice(0,30);
 }
 function start(game,mode,cur,stake,power=55,machine='p99'){check();if(active())throw Error('請先完成目前已付款的牌局');if(!NAMES[game]||!(game==='pin'?!!W.LineagePachinkoCore.MACHINES[machine]:['normal','expert'].includes(mode))||!STAKES[game][cur]?.includes(stake))throw Error('下注選項不符');if(game==='pin')mode=machine;
  const reserve=stake*(game==='tian'?256:game==='bj'?2:1);if(!H.curReady(cur)||H.balance(cur)<reserve)throw Error('餘額不足，本局需預留 '+reserve.toLocaleString()+' '+H.CURS[cur]);
  const d=C.copy(data()),randomSeed=seed(),rng=C.seeded(randomSeed),r={id:Date.now().toString(36)+'-'+(++d.seq)+'-'+randomSeed,game,mode,cur,stake,reserve,created:Date.now(),settled:false};
  if(game==='tian')r.g=C.tianNew(rng,d.banker[mode]||0);
  if(game==='bj'){let shoe=d.shoes[mode];if(!shoe||shoe.cards.length-shoe.pos<60)shoe=d.shoes[mode]=C.bjShoe(rng);r.g=C.bjNew(shoe,mode);if(r.g.dealerNatural||C.bjValue(r.g.player).natural)C.bjFinish(r.g,shoe);}
  if(game==='pin')r.g={v:2,phase:'playing',s:W.LineagePachinkoCore.create(machine,randomSeed),batch:null};
  d.round=r;
  return transact('開始'+NAMES[game],()=>{if(!H.debit(cur,reserve))throw Error('扣款失敗');P().afkArcade=d;if(r.g.phase==='done')settle(d,r);return r;});
 }
 function act(id,action,extra){check();const d=C.copy(data()),r=d.round;if(!r||r.id!==id||r.settled)throw Error('這局已結算或不屬於目前角色');
  if(r.game==='tian'){if(action!=='play')throw Error('未知操作');C.tianPlay(r.g,extra.seat,extra.ids,extra.up);}
  if(r.game==='bj')C.bjAct(r.g,d.shoes[r.mode],action);
  let debit=0;
  if(r.game==='pin'){
    if(r.g.v!==2){if(action!=='finish')throw Error('請先結算舊版落球紀錄');r.g.phase='done';}
    else if(action==='batch'){
      if(r.g.batch)throw Error('上一批演出尚未完成');
      const before=C.copy(r.g.s),power=Math.max(0,Math.min(100,Number(extra?.power)||0)),shoot=!!extra?.shoot;
      r.g.s=W.LineagePachinkoCore.streamBatch(before,power,shoot).state;r.g.batch={before,power,shoot,flow:1};
    }else if(action==='ack-batch'){if(!r.g.batch)throw Error('這批已完成');r.g.batch=null;}
    else if(action==='lend'){if(r.g.batch)throw Error('請先停止發射');if(r.stake!==STAKES.pin[r.cur]?.[0])throw Error('這局沿用舊球價，請先結束兌回持球，再以新球價入座');debit=STAKES.pin[r.cur][0];if(!H.curReady(r.cur)||H.balance(r.cur)<debit)throw Error('借球餘額不足');W.LineagePachinkoCore.add(r.g.s,100);r.reserve+=debit;}
    else if(action==='finish'){if(r.g.batch)throw Error('請等這批球完成');if((W.LineagePachinkoCore.busy(r.g.s)||r.g.s.mode!=='normal')&&!extra?.forfeit)throw Error('尚有抽選或連莊機會，請確認結束');r.g.phase='done';}
    else throw Error('未知操作');
  }
  return transact('保存'+NAMES[r.game]+'牌局',()=>{if(debit&&!H.debit(r.cur,debit))throw Error('借球扣款失敗');P().afkArcade=d;if(r.g.phase==='done')settle(d,r);return r;});
 }
 W.LineageArcadeRuntime={NAMES,STAKES,data,active,start,act,transact,balance:H.balance,currencies:H.CURS,seed,backup:G.downloadBackup};
})(window);
