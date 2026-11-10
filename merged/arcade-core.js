/* Deterministic rules shared by the browser and regression tests. No storage or UI. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LineageArcadeCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function seeded(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
 function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 const TILES=[];
 const civ=[[6,6,'天'],[1,1,'地'],[4,4,'人'],[3,1,'和'],[5,5,'梅'],[3,3,'長三'],[2,2,'板凳'],[6,5,'斧頭'],[6,4,'紅頭十'],[6,1,'高腳七'],[5,1,'大頭六']];
 civ.forEach(([a,b,name],i)=>{for(let n=0;n<2;n++)TILES.push({id:TILES.length,a,b,name,suit:'c',rank:11-i,group:i<4?4-i:0});});
 [[6,3,'雜九',6,4],[5,4,'雜九',6,4],[6,2,'雜八',5,3],[5,3,'雜八',5,3],[5,2,'雜七',4,2],[4,3,'雜七',4,2],[4,1,'雜五',3,1],[3,2,'雜五',3,1],[4,2,'大六',2,0],[2,1,'細三',1,0]].forEach(([a,b,name,rank,group])=>TILES.push({id:TILES.length,a,b,name,suit:'m',rank,group}));
 function combo(ids){
  if(!Array.isArray(ids)||!ids.length||ids.length>4||new Set(ids).size!==ids.length)return null;
  const t=ids.map(i=>TILES[i]);if(t.some(x=>!x))return null;const c=t.filter(x=>x.suit==='c'),m=t.filter(x=>x.suit==='m'),n=t.length;
  if(n===1)return{n,key:t[0].suit,rank:t[0].rank,name:t[0].name};
  if(n===2&&ids.includes(30)&&ids.includes(31))return{n,key:'supreme',rank:1,name:'至尊'};
  if(n===2&&c.length===2&&c[0].rank===c[1].rank)return{n,key:'cc',rank:c[0].rank,name:'雙'+c[0].name};
  if(n===2&&m.length===2&&m[0].rank===m[1].rank)return{n,key:'mm',rank:m[0].rank,name:'雙'+m[0].name};
  if(c.length&&m.length&&t[0].group>0&&t.every(x=>x.group===t[0].group))return{n,key:'mix'+c.length+m.length,rank:t[0].group,name:({2:'文武',3:'三張',4:'四張'})[n]+['','和五','人七','地八','天九'][t[0].group]};
  return null;
 }
 function beats(a,b){return!!a&&!!b&&a.key===b.key&&a.rank>b.rank;}
 function subsets(a,n){const out=[];function go(start,b){if(b.length===n){out.push(b);return;}for(let i=start;i<a.length;i++)go(i+1,b.concat(a[i]));}go(0,[]);return out;}
 function legalLeads(hand){return[1,2,3,4].flatMap(n=>subsets(hand,n)).filter(x=>combo(x));}
 function tianNew(rng,banker=0){const deck=shuffle(TILES.map(t=>t.id),rng);return{hands:[0,1,2,3].map(i=>deck.slice(i*8,i*8+8)),banker,turn:banker,leader:banker,columns:[0,0,0,0],scores:[0,0,0,0],seen:[],trick:[],best:null,winner:banker,history:[],phase:'playing',plays:0};}
 function transfer(g,w,l,n){const v=n*((w===g.banker||l===g.banker)?2:1);g.scores[w]+=v;g.scores[l]-=v;}
 function tianPlay(g,seat,ids,up=true){
  if(g.phase!=='playing'||seat!==g.turn)throw Error('尚未輪到這個座位');
  const hand=g.hands[seat];if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!hand.includes(id)))throw Error('手牌不符');
  const c=combo(ids),lead=!g.trick.length,n=lead?ids.length:g.best.n;
  if(ids.length!==n)throw Error('須跟出相同張數');
  const early=!lead&&hand.length===1&&g.columns[seat]===0;
  if(lead&&(!up||!c))throw Error('請選擇合法的領出牌組');
  if(!lead&&up&&(early||!beats(c,g.best)))throw Error(early?'前七張未取棟，最後單張須墊牌':'牌型不同或不大於目前牌組，請墊牌');
  g.hands[seat]=hand.filter(id=>!ids.includes(id));g.plays++;
  if(up){g.best=c;g.winner=seat;g.seen.push(...ids);}
  g.trick.push({seat,ids:up?ids.slice():null,n,up});
  if(g.trick.length<4){g.turn=(seat+1)%4;return g;}
  const w=g.winner,best=g.best;g.columns[w]+=n;
  if(best.key==='supreme'||n===4)for(let l=0;l<4;l++)if(l!==w)transfer(g,w,l,best.key==='supreme'?2:4);
  g.history.push({winner:w,n,name:best.name,plays:copy(g.trick)});
  if(!g.hands[0].length){
   let factor=(n===4||best.key==='supreme'||best.key==='m'&&best.rank===1)?2:1;
   if(g.columns[w]===8)factor*=2;
   const last=g.trick.find(x=>x.seat===g.leader),smallLed=n===1&&last.up&&last.ids[0]===31;
   for(let l=0;l<4;l++)if(l!==w){const amount=g.columns[l]===0?5:4-g.columns[l];
    // Big-six captures a led little-three: little-three covers the other losers' positive payments.
    if(smallLed&&best.key==='m'&&best.rank===2&&l!==g.leader&&amount>0){const v=amount*factor*((l===g.banker||w===g.banker)?2:1);g.scores[w]+=v;g.scores[g.leader]-=v;}
    else transfer(g,w,l,amount*factor);
   }
   g.phase='done';g.lastWinner=w;g.lastFactor=factor;
  }else{g.turn=w;g.leader=w;g.trick=[];g.best=null;}
  return g;
 }
 const tileCost=id=>{const t=TILES[id];return t.rank+(t.group?2:0)+(id===31?1:0);};
 function tianActions(g,seat){const h=g.hands[seat],lead=!g.trick.length;
  if(lead)return legalLeads(h).map(ids=>({ids,up:true}));
  const groups=subsets(h,g.best.n),canWin=!(h.length===1&&!g.columns[seat]);
  const wins=canWin?groups.filter(ids=>beats(combo(ids),g.best)).map(ids=>({ids,up:true})):[];
  const burns=groups.sort((a,b)=>a.reduce((s,id)=>s+tileCost(id),0)-b.reduce((s,id)=>s+tileCost(id),0)).slice(0,3).map(ids=>({ids,up:false}));
  return wins.concat(burns);
 }
 function quickScore(g,seat,a){const h=g.hands[seat],cost=a.ids.reduce((s,id)=>s+tileCost(id),0),last=h.length===a.ids.length,c=combo(a.ids);
  return (a.up?last?100:!g.columns[seat]?25:7:0)+(a.up&&a.ids.length>1?8*a.ids.length:0)+(c&&c.key==='supreme'&&a.up?22:0)-cost*(last?.05:.7);
 }
 function greedy(g,seat,rng){const actions=tianActions(g,seat);actions.sort((a,b)=>quickScore(g,seat,b)-quickScore(g,seat,a));return actions[0];}
 // Information boundary: opponent hands, shoe order and face-down discards are never passed to AI.
 function tianView(g,seat){const v=copy(g);v.hands=g.hands.map((h,i)=>i===seat?h.slice():h.map(()=>null));v.seat=seat;return v;}
 function aiSearch(view,rng=seeded(1)){
  const seat=view.seat,choices=tianActions(view,seat).sort((a,b)=>quickScore(view,seat,b)-quickScore(view,seat,a)).slice(0,16),sums=choices.map(()=>0),counts=choices.map(()=>0);let iteration=0;
  const known=new Set(view.hands[seat].concat(view.seen)),unknown=TILES.map(t=>t.id).filter(id=>!known.has(id));
  return{step(samples=1){for(let z=0;z<samples;z++){
    const ci=iteration++%choices.length,sim=copy(view),pool=shuffle(unknown,rng);let at=0;
    sim.hands=sim.hands.map((h,i)=>i===seat?h:pool.slice(at,(at+=h.length)));
    try{tianPlay(sim,seat,choices[ci].ids,choices[ci].up);let guard=0;while(sim.phase!=='done'&&guard++<32){const a=greedy(sim,sim.turn,rng);tianPlay(sim,sim.turn,a.ids,a.up);}sums[ci]+=sim.scores[seat];counts[ci]++;}catch{counts[ci]++;sums[ci]-=256;}
   }return iteration;},best(){let best=0;for(let i=1;i<choices.length;i++)if(counts[i]&&(sums[i]/counts[i]>sums[best]/Math.max(1,counts[best])))best=i;return choices[best];},choices:choices.length};
 }
 function normalTian(view){return greedy(view,view.seat);}

 const rank=c=>Math.floor(c/4)+1, val=c=>Math.min(10,rank(c));
 function bjValue(cards){let total=cards.reduce((n,c)=>n+val(c),0),soft=cards.some(c=>rank(c)===1)&&total+10<=21;if(soft)total+=10;return{total,soft,bust:total>21,natural:cards.length===2&&total===21};}
 function bjShoe(rng){return{cards:shuffle(Array.from({length:312},(_,i)=>i%52),rng),pos:0,seen:[]};}
 function draw(shoe,publicCard=true){if(shoe.pos>=shoe.cards.length)throw Error('牌靴已空');const c=shoe.cards[shoe.pos++];if(publicCard)shoe.seen.push(c);return c;}
 function bjNew(shoe,mode){const g={player:[],npc:[],dealer:[],mode,pMult:1,nMult:1,phase:'player',npcLog:[]};g.player.push(draw(shoe));g.npc.push(draw(shoe));g.dealer.push(draw(shoe));g.player.push(draw(shoe));g.npc.push(draw(shoe));g.dealer.push(draw(shoe,false));g.dealerNatural=bjValue(g.dealer).natural;return g;}
 function bjReturn(cards,dealer){const a=bjValue(cards),b=bjValue(dealer);if(a.bust)return 0;if(b.natural)return a.natural?1:0;if(a.natural)return 2.5;return b.bust||a.total>b.total?2:a.total===b.total?1:0;}
 function unseen(shoe){const n=Array(11).fill(24);n[0]=0;n[10]=96;for(const c of shoe.seen)n[val(c)]--;return n;}
 function bjAdvice(cards,up,counts,canDouble){
  const all=counts.slice(),total=all.reduce((a,b)=>a+b,0)||312,p=all.map(n=>n/total),memoD=new Map(),memoP=new Map();
  function add(v,s,n){let t=v+n,soft=s;if(n===1&&t+10<=21){t+=10;soft=true;}if(t>21&&soft){t-=10;soft=false;}return[t,soft];}
  function dealer(t,s){const key=t+':'+s;if(memoD.has(key))return memoD.get(key);const result=Array(23).fill(0);if(t>=17){result[t>21?22:t]=1;return result;}for(let n=1;n<=10;n++)if(p[n]){const[v,b]=add(t,s,n),next=dealer(v,b);for(let k=17;k<=22;k++)result[k]+=p[n]*next[k];}memoD.set(key,result);return result;}
  const dist=Array(23).fill(0);let denom=0;const uv=val(up),ut=uv===1?11:uv;
  for(let n=1;n<=10;n++){if(uv===1&&n===10||uv===10&&n===1)continue;denom+=p[n];const[t,s]=add(ut,uv===1,n),d=dealer(t,s);for(let k=17;k<=22;k++)dist[k]+=p[n]*d[k];}
  for(let k=17;k<=22;k++)dist[k]/=denom||1;
  const stand=t=>t>21?-1:dist[22]+dist.slice(17,22).reduce((s,n,i)=>s+n*(t>i+17?1:t<i+17?-1:0),0);
  function best(t,s){if(t>21)return-1;const key=t+':'+s;if(memoP.has(key))return memoP.get(key);let hit=0;for(let n=1;n<=10;n++)if(p[n]){const[v,b]=add(t,s,n);hit+=p[n]*best(v,b);}const v=Math.max(stand(t),hit);memoP.set(key,v);return v;}
  const v=bjValue(cards);if(v.total>=21)return{action:'stand',stand:stand(v.total),hit:-1,double:-2};
  let hit=0,dbl=0;for(let n=1;n<=10;n++)if(p[n]){const[t,s]=add(v.total,v.soft,n);hit+=p[n]*best(t,s);dbl+=p[n]*stand(t)*2;}
  const choices=[['stand',stand(v.total)],['hit',hit]];if(canDouble)choices.push(['double',dbl]);choices.sort((a,b)=>b[1]-a[1]);return{action:choices[0][0],stand:stand(v.total),hit,double:dbl};
 }
 function bjFinish(g,shoe){if(g.phase==='done')return;
  if(!g.dealerNatural&&!bjValue(g.npc).natural){let n=0;while(!bjValue(g.npc).bust&&n++<18){const v=bjValue(g.npc),a=g.mode==='expert'?bjAdvice(g.npc,g.dealer[0],unseen(shoe),g.npc.length===2).action:(v.total<17?'hit':'stand');g.npcLog.push(a);if(a==='stand')break;g.npc.push(draw(shoe));if(a==='double'){g.nMult=2;break;}}}
  shoe.seen.push(g.dealer[1]);if(!g.dealerNatural)while(bjValue(g.dealer).total<17)g.dealer.push(draw(shoe));
  g.pReturn=bjReturn(g.player,g.dealer);g.nReturn=bjReturn(g.npc,g.dealer);g.pNet=(g.pReturn-1)*g.pMult;g.nNet=(g.nReturn-1)*g.nMult;g.phase='done';
 }
 function bjAct(g,shoe,action){if(g.phase!=='player')throw Error('牌局已結束');if(!['hit','stand','double'].includes(action))throw Error('未知操作');if(action==='double'&&g.player.length!==2)throw Error('只有起手兩張可以加倍');
  if(action!=='stand')g.player.push(draw(shoe));if(action==='double')g.pMult=2;
  if(action!=='hit'||bjValue(g.player).total>=21)bjFinish(g,shoe);return g;
 }

 const PIN_W=400,PIN_H=500,PINS=[];
 for(let row=0;row<11;row++)for(let col=0;col<9;col++){const x=30+col*42+(row%2?21:0);if(x<377)PINS.push({x,y:80+row*31});}
 const POCKETS=[0,0,.5,1,3,1,.5,0,0];
 function ball(seed,power,trace=false){const rng=seeded(seed);power=Math.max(0,Math.min(100,Number(power)||0));let x=389,y=455,vx=0,vy=-920-power*1.5,steps=0,path=[],launched=false;
  const dt=1/120;for(;steps<2400&&y<480;steps++){
   vy+=840*dt;x+=vx*dt;y+=vy*dt;
   if(x<8){x=8;vx=Math.abs(vx)*.7;}if(x>392){x=392;vx=-Math.abs(vx)*.7;}if(y<10){y=10;vy=Math.abs(vy)*.65;}
   if(!launched&&y<55){launched=true;vx=-90-power*1.8+(rng()-.5)*24;}
   if(launched)for(const pin of PINS){if(Math.abs(y-pin.y)>10||Math.abs(x-pin.x)>10)continue;let dx=x-pin.x,dy=y-pin.y,d=Math.hypot(dx,dy);if(d<9){if(d<.01){dx=1;dy=-1;d=Math.SQRT2;}const nx=dx/d,ny=dy/d,dot=vx*nx+vy*ny;x=pin.x+nx*9.1;y=pin.y+ny*9.1;if(dot<0){vx-=1.65*dot*nx;vy-=1.65*dot*ny;}vx+=(rng()-.5)*9;}}
   if(steps%4===0&&trace)path.push([+x.toFixed(2),+y.toFixed(2)]);
  }
  // Bounded physical simulation: a stalled ball is returned, never assigned a fabricated pocket.
  const stalled=y<480,index=stalled?-1:Math.min(8,Math.max(0,Math.floor(x/(400/9)))),jackpot=!stalled&&index===4&&rng()<.02,mult=stalled?1:POCKETS[index]+(jackpot?20:0);
  if(trace)path.push([x,Math.min(y,480)]);return{index,jackpot,mult,stalled,path,steps};
 }
 function pachinko(seed,power,trace=false){const rng=seeded(seed),balls=Array.from({length:10},()=>ball(Math.floor(rng()*4294967296),power,trace));return{balls,mult:balls.reduce((s,b)=>s+b.mult,0)/10};}
 return{copy,seeded,shuffle,TILES,combo,beats,legalLeads,tianNew,tianPlay,tianActions,tianView,aiSearch,normalTian,bjValue,bjShoe,bjNew,bjAct,bjFinish,bjReturn,bjAdvice,unseen,rank,val,PINS,POCKETS,PIN_W,PIN_H,ball,pachinko};
});
