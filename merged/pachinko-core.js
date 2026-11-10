(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LineagePachinkoCore=factory();})(typeof window==='object'?window:globalThis,function(){'use strict';
 const MACHINES={
  p99:{name:'翠玉物語',den:99,stDen:39,st:30,chance:20,enter:.5,first:4,later:8,prize:8,color:'#6ec49c'},
  p199:{name:'黃金騎士',den:199,stDen:59,st:45,chance:30,enter:.55,first:4,later:10,prize:10,color:'#e5c779'},
  p319:{name:'赤龍降臨',den:319,stDen:89,st:70,chance:50,enter:.6,first:4,later:10,prize:15,color:'#ed8a79'}
 };
 const copy=x=>JSON.parse(JSON.stringify(x));
 function random(s){s.rng=(s.rng+0x6d2b79f5)>>>0;let t=s.rng;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
 function create(machine,seed){if(!MACHINES[machine])throw Error('未知柏青哥機台');return{v:2,machine,rng:seed>>>0,clock:0,balls:100,bought:100,spent:0,earned:0,mode:'normal',remaining:0,queue:[],spin:null,bonus:null,flight:[],reels:[1,2,3],last:'調整旋鈕至左打區，始動口入賞後才抽選。',hits:0,chain:0,maxChain:0,rotations:0,seq:0};}
 function add(s,n){if(n!==100)throw Error('每次借球 100 顆');s.balls+=n;s.bought+=n;}
 const PINS=[];for(let row=0;row<9;row++)for(let col=0;col<8;col++){const x=45+col*44+(row%2)*15,y=110+row*38;if(x<115||x>285||y>350)PINS.push({x,y});}
 function award(s,n){s.balls+=n;s.earned+=n;}
 function ticket(s){if(s.queue.length>=4)return;const m=MACHINES[s.machine],den=s.mode==='st'?m.stDen:m.den;
  const hit=random(s)<1/den,digit=1+Math.floor(random(s)*9);s.queue.push({hit,high:s.mode==='st',reels:hit?[digit,digit,digit]:[digit,random(s)<.24?digit:digit%9+1,(digit+1)%9+1]});
 }
 function launch(s,power){if(!s.balls)return;const right=power>=78,aim=Math.max(0,1-Math.abs(power-56)/42),r=random(s);let target='out';
  if(right&&s.bonus)target=r<.83?'attacker':'out';
  else if(right&&['st','chance'].includes(s.mode))target=r<.7?'electric':'out';
  else if(!right&&power>=18&&!s.bonus)target=r<.105*aim?'start':r<.105*aim+.045?'side':'out';
  const x=target==='start'?200:target==='electric'?327:target==='attacker'?331:target==='side'?(right?360:43):55+random(s)*290;
  s.balls--;s.spent++;s.flight.push({id:++s.seq,start:s.clock,end:s.clock+1350+Math.floor(random(s)*250),right,target,x,wiggle:random(s)*Math.PI*2});
 }
 function finishBonus(s){const m=MACHINES[s.machine],high=s.bonus.high;s.bonus=null;
  if(high||random(s)<m.enter){s.mode='st';s.remaining=m.st;s.last='確變 ST！請右打・剩餘 '+m.st+' 回轉';}
  else{s.mode='chance';s.remaining=m.chance;s.last='時短！請右打・剩餘 '+m.chance+' 回轉';}
 }
 function nextRound(s){const b=s.bonus;if(++b.round>b.rounds){finishBonus(s);return;}b.accepted=0;b.until=s.clock+10000;s.last='大當 '+b.round+' / '+b.rounds+' R・右打大入賞口';}
 function arrive(s,b){
  if(b.target==='attacker'&&s.bonus){award(s,MACHINES[s.machine].prize);if(++s.bonus.accepted>=10)nextRound(s);}
  else if(b.target==='start'&&!s.bonus){award(s,3);ticket(s);}
  else if(b.target==='electric'&&!s.bonus&&['st','chance'].includes(s.mode)){award(s,1);ticket(s);}
  else if(b.target==='side')award(s,5);
 }
 function tick(s,ms){
  s.clock+=ms;
  const landed=s.flight.filter(b=>b.end<=s.clock);s.flight=s.flight.filter(b=>b.end>s.clock);landed.forEach(b=>arrive(s,b));
  if(s.bonus&&s.clock>=s.bonus.until)nextRound(s);
  if(s.spin&&s.clock>=s.spin.until){const t=s.spin.ticket;s.reels=t.reels;s.spin=null;s.rotations++;
    if(t.hit){const m=MACHINES[s.machine];s.hits++;s.chain++;s.maxChain=Math.max(s.chain,s.maxChain);s.mode='bonus';s.bonus={round:1,rounds:t.high?m.later:m.first,accepted:0,until:s.clock+10000,high:t.high};s.last='大當！'+s.chain+' 連莊・請右打';}
    else {s.last='未中獎';if(['st','chance'].includes(s.mode)&&s.remaining<=0){s.mode='normal';s.chain=0;s.last='回到通常・請左打';}}
  }
  if(!s.spin&&!s.bonus&&s.queue.length){const t=s.queue.shift();s.spin={ticket:t,start:s.clock,until:s.clock+(s.mode==='normal'?2300:1100)};if(['st','chance'].includes(s.mode))s.remaining=Math.max(0,s.remaining-1);s.last=t.reels[0]===t.reels[1]?'REACH・聽牌演出':'圖柄變動中';}
 }
 // Replay old saved batches with their original timing. New batches carry balls
 // still in flight into the next checkpoint, maintaining one launch every 600 ms.
 function batch(before,power,shoot=true,trace=false,continuous=false){
  const s=copy(before);if(s.v!==2||!MACHINES[s.machine])throw Error('機台存檔版本不符');
  power=Math.max(0,Math.min(100,Number(power)||0));const frames=[];
  const steps=continuous?60:96;
  for(let i=0;i<steps;i++){if(shoot&&i%12===0&&i<60)launch(s,power);tick(s,50);if(trace&&i%2===0)frames.push(copy(s));}
  return{state:s,frames,duration:steps*50};
 }
 function streamBatch(before,power,shoot=true,trace=false){return batch(before,power,shoot,trace,true);}
 function position(b,clock){const t=Math.max(0,Math.min(1,(clock-b.start)/(b.end-b.start))),side=b.right?345:55;
  if(t<.35){const u=t/.35;return{x:375+(side-375)*u,y:485-435*Math.sin(u*Math.PI/2)};}
  const u=(t-.35)/.65,edge=b.right?335:65,endY={start:450,electric:370,attacker:452,side:438,out:510}[b.target]||510,y=50+(endY-50)*u;
  const spread=u<.7?edge:edge+(b.x-edge)*(u-.7)/.3;
  return{x:spread+Math.sin(u*35+b.wiggle)*9*Math.sin(Math.PI*u),y};
 }
 function busy(s){return !!(s.spin||s.queue.length||s.flight.length||s.bonus);}
 return{MACHINES,PINS,create,add,batch,streamBatch,position,busy,copy};
});
