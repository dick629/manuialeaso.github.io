(function(W){'use strict';
 const C=W.LineagePachinkoCore,R=W.LineageArcadeRuntime;
 let machine='p99',power=56,running=false,frame=0,timer=0,token=0,ctx=null,wantExit=false;
 const fmt=n=>Number(n).toLocaleString(),btn=(a,t,disabled=false)=>'<button type="button" class="arc-btn" data-pachi="'+a+'"'+(disabled?' disabled':'')+'>'+t+'</button>';
 const rules='每 100 顆球固定為 50,000 金幣／100 龍鑽／10 血龍鑽，三種幣別擇一支付，三台機器價格相同。按一次「開始連續發射」就會持續射出持球，直到用完或按下停止；入賞獲得的賞球也會接著發射，不會自動花錢借球。結束時依本局球價兌回剩餘持球，零頭累積。一般狀態左打，始動口入賞退 3 球並抽一次；變動中最多保留 4 球，滿保留後入賞只退賞球、不追加抽選。側入賞退 5 球。大當請右打：大入賞口每 R 最多接 10 球，10 秒未滿也關閉該 R。ST／時短右打電動始動口，入賞退 1 球；ST 使用各機台高機率，時短沿用通常機率。每次抽選獨立，連輸不提高下次機率；演出不改變結果。這是原創柏青哥規格與入賞模型，不宣稱任何商用實機的精確還原。關窗會保存進度並暫停發射，回來後可繼續。';
 function spec(id){const m=C.MACHINES[id];return '通常 1/'+m.den+' · ST 1/'+m.stDen+'（'+m.st+' 回）\n初當 '+m.first+'R／ST 大當 '+m.later+'R · 每入賞 '+m.prize+' 球\n初當 '+Math.round(m.enter*100)+'% 進 ST；否則時短 '+m.chance+' 回';}
 function html(r,options){
  ctx={...ctx,...options};
  if(r&&!r.settled&&r.g.v!==2)return '<div class="arc-status">這是前版已付款的落球紀錄，先依原結果結清後即可選擇新機台。</div>'+btn('legacy','結算舊紀錄');
  const active=r&&!r.settled,s=active?r.g.s:null,oldPrice=active&&r.stake!==R.STAKES.pin[r.cur][0];if(s)machine=s.machine;
  const picker=active?'':'<div class="pachi-machines">'+Object.entries(C.MACHINES).map(([id,m])=>'<button type="button" data-pachi="machine:'+id+'" class="pachi-machine '+(machine===id?'on':'')+'"><strong>'+m.name+'</strong><b>1 / '+m.den+'</b><small>'+(id==='p99'?'甘デジ':id==='p199'?'輕中量':'重型')+'</small></button>').join('')+'</div>';
  return picker+'<div class="pachi-spec">'+spec(machine).replaceAll('\n','<br>')+'</div><div class="pachi-layout"><div class="pachi-cabinet"><canvas id="pachi-board" width="420" height="560" aria-label="柏青哥盤面、中央抽選螢幕、四格保留與右側大入賞口"></canvas><div class="pachi-tray"><span>持球 <b id="pachi-balls">'+fmt(s?.balls||0)+'</b></span><span>大當 <b id="pachi-hits">'+(s?.hits||0)+'</b></span><span>回轉 <b id="pachi-spins">'+(s?.rotations||0)+'</b></span></div></div><div class="pachi-operation"><p id="pachi-state" role="status">'+(s?.last||'選擇機台與幣別，借球後開始遊玩。')+'</p><label class="pachi-handle">發射旋鈕 <b id="pachi-power">'+power+'%</b><input id="pachi-handle" type="range" min="0" max="100" value="'+power+'" aria-label="柏青哥發射力度"></label><div class="pachi-aim">'+btn('left','↖ 左打')+btn('right','右打 ↗')+'</div><div class="arc-controls pachi-controls">'+(active?btn('fire',running?'停止連續發射':'開始連續發射',!running&&!s.balls&&!C.busy(s))+btn('lend','借球 +100',!!r.g.batch||running||oldPrice)+btn('exit','結束並兌回持球'):btn('enter','借 100 球・入座',options.blocked))+'</div><p class="arc-note">按一次持續發射至持球用完，可中途停止。一般左打；大當／ST／時短請右打。用完不自動借球，關窗暫停並保存。</p>'+(oldPrice?'<p class="arc-note">這局保留舊球價：每 100 顆 '+fmt(r.stake)+' '+R.currencies[r.cur]+'。請先結束兌回，再以新球價借球。</p>':'')+(r?.settled?'<div class="arc-result">上一場已兌回 '+fmt(r.returned)+' '+R.currencies[r.cur]+'</div>':'')+'</div></div>';
 }
 function suspend(){token++;running=false;wantExit=false;cancelAnimationFrame(frame);clearTimeout(timer);frame=0;timer=0;}
 function valid(){return !!ctx?.valid?.()&&!document.hidden;}
 function round(){const r=R.data().round;return r?.game==='pin'&&!r.settled?r:null;}
 function fail(e){running=false;ctx?.error(e);}
 function invoke(action,extra){const r=round();if(!r)throw Error('請先入座');return R.act(r.id,action,extra);}
 function exit(){
  const r=round();if(!r)return;running=false;wantExit=true;clearTimeout(timer);
  if(r.g.batch)return;
  wantExit=false;
  const finish=()=>{if(!valid()||round()?.id!==r.id)return;try{invoke('finish',{forfeit:true});ctx.render();}catch(e){fail(e);}};
  if(C.busy(r.g.s)||r.g.s.mode!=='normal'){
    W.AFK_UI.confirm({title:'結束柏青哥',message:'持球會兌回。尚未完成的抽選、大當或 ST／時短機會將結束，確定離席？',onOk:finish});
  }else finish();
 }
 function draw(canvas,s,clock){
  const x=canvas.getContext('2d'),m=C.MACHINES[s.machine];x.clearRect(0,0,420,560);
  const bg=x.createRadialGradient(210,230,20,210,250,300);bg.addColorStop(0,'#23463c');bg.addColorStop(1,'#080f12');x.fillStyle=bg;x.fillRect(0,0,420,560);
  x.lineWidth=7;x.strokeStyle='#847346';x.beginPath();x.ellipse(210,275,199,259,0,0,Math.PI*2);x.stroke();x.lineWidth=2;x.strokeStyle='#d3c7a4';x.stroke();
  x.textAlign='center';x.font='bold 25px Georgia,serif';x.fillStyle=m.color;x.fillText(m.name,210,62);x.font='11px Arial';x.fillStyle='#bfb895';x.fillText('P A C H I N K O  ・  '+m.den,210,83);
  for(const p of C.PINS){x.fillStyle='#e1d8ab';x.beginPath();x.arc(p.x,p.y,2.4,0,Math.PI*2);x.fill();}
  x.fillStyle='#b39c60';x.fillRect(102,130,216,209);x.fillStyle='#071415';x.fillRect(107,135,206,199);
  const bonus=!!s.bonus,reach=s.spin&&s.spin.ticket.reels[0]===s.spin.ticket.reels[1];
  x.fillStyle=bonus?'#623a16':s.mode==='st'?'#331a39':'#11332b';x.fillRect(112,140,196,188);
  x.font='bold 15px serif';x.fillStyle=bonus?'#ffe5a1':m.color;x.fillText(bonus?'大 當 ・ '+s.chain+' 連莊':s.mode==='st'?'確 變 S T':s.mode==='chance'?'時 短':'通 常',210,165);
  const reels=s.spin?s.spin.ticket.reels:s.reels,elapsed=s.spin?clock-s.spin.start:Infinity;
  for(let i=0;i<3;i++){const changing=!!s.spin&&elapsed<650+i*650,v=changing?1+(Math.floor(clock/90)+i*3)%9:reels[i];x.fillStyle='#0b1010';x.fillRect(121+i*61,189,55,78);x.strokeStyle=reach?'#d9b362':'#668779';x.strokeRect(121+i*61,189,55,78);x.font='bold 50px Georgia';x.fillStyle=v===7?'#f3d775':i===1?'#eec6a6':'#cce9dc';x.fillText(v,148+i*61,246);}
  x.font='bold 15px serif';x.fillStyle='#f2d798';x.fillText(bonus?s.bonus.round+' / '+s.bonus.rounds+' R　'+s.bonus.accepted+'/10':reach?'REACH ・ 聽牌':s.mode==='normal'?'始動口入賞 → 抽選':'剩餘 '+s.remaining+' 回',210,294);
  for(let i=0;i<4;i++){x.beginPath();x.arc(172+i*25,317,6,0,Math.PI*2);x.fillStyle=i<s.queue.length?m.color:'#283c37';x.fill();x.strokeStyle='#b8ae83';x.lineWidth=1;x.stroke();}
  const mouth=(xx,yy,w,label,on)=>{x.fillStyle=on?'#7b511f':'#172521';x.fillRect(xx-w/2,yy,w,17);x.strokeStyle=on?'#ffe4a2':'#8f967d';x.strokeRect(xx-w/2,yy,w,17);x.fillStyle='#e8dfb5';x.font='11px Arial';x.fillText(label,xx,yy-7);};
  mouth(200,442,32,'始動口',!s.bonus);mouth(327,362,30,'電動始動口',s.mode==='st'||s.mode==='chance');mouth(331,444,62,'大入賞口',bonus);mouth(43,430,18,'入賞',true);
  x.fillStyle='#020606';x.fillRect(176,503,68,15);x.font='11px Arial';x.fillStyle='#73877e';x.fillText('OUT',210,516);
  x.font='bold 18px serif';x.fillStyle=bonus||s.mode!=='normal'?'#ffd97c':'#a2d2b4';x.fillText(bonus||s.mode!=='normal'?'右打 ▶':'◀ 左打',210,381);
  if(bonus){x.font='12px Arial';x.fillText('剩餘 '+Math.max(0,(s.bonus.until-clock)/1000).toFixed(1)+' 秒',210,405);}
  for(const b of s.flight){const p=C.position(b,clock),g=x.createRadialGradient(p.x-1,p.y-1,.1,p.x,p.y,4);g.addColorStop(0,'#fff');g.addColorStop(.35,'#d9e9eb');g.addColorStop(1,'#566975');x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,4,0,Math.PI*2);x.fill();}
 }
 function mount(r,options){
  ctx={...ctx,...options};cancelAnimationFrame(frame);clearTimeout(timer);frame=0;timer=0;
  const canvas=document.getElementById('pachi-board');if(!canvas)return;
  const scale=Math.min(2,W.devicePixelRatio||1);canvas.width=420*scale;canvas.height=560*scale;canvas.getContext('2d').setTransform(scale,0,0,scale,0,0);
  const active=r&&!r.settled&&r.g.v===2,s=active?r.g.s:C.create(machine,1),b=active?r.g.batch:null;
  draw(canvas,b?b.before:s,(b?b.before:s).clock);
  if(!valid()||!active)return;
  if(!b&&running&&!s.balls&&!C.busy(s)){running=false;document.getElementById('pachi-state').textContent='持球已用完，已停止發射。可借球繼續或結束離席。';const fire=document.querySelector('[data-pachi="fire"]');if(fire){fire.textContent='持球已用完';fire.disabled=true;}const lend=document.querySelector('[data-pachi="lend"]');if(lend)lend.disabled=r.stake!==R.STAKES.pin[r.cur][0];}
  if(b){const replay=(b.flow===2?C.fastBatch:b.flow===1?C.streamBatch:C.batch)(b.before,b.power,b.shoot,true),start=performance.now(),epoch=token,id=r.id;let last=0;
    const animate=now=>{if(!valid()||epoch!==token)return;const elapsed=Math.max(0,now-start),view=replay.frames[Math.min(replay.frames.length-1,Math.floor(elapsed/100))];
      if(now-last>=30){draw(canvas,view,view.clock+elapsed%100);last=now;for(const [key,value] of [['balls',view.balls],['hits',view.hits],['spins',view.rotations]])document.getElementById('pachi-'+key).textContent=fmt(value);document.getElementById('pachi-state').textContent=view.last;}
      if(elapsed<replay.duration)frame=requestAnimationFrame(animate);else{frame=0;try{if(round()?.id!==id)return;invoke('ack-batch');if(wantExit){ctx.render();clearTimeout(timer);exit();}else ctx.render();}catch(e){fail(e);}}
    };frame=requestAnimationFrame(animate);
  }else if(!wantExit&&(running&&s.balls>0||C.busy(s))){timer=setTimeout(()=>{timer=0;if(!valid())return;try{invoke('batch',{power,shoot:running&&s.balls>0});ctx.render();}catch(e){fail(e);}},0);}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('#afk-gh-win [data-pachi]');if(!b||b.disabled||!valid())return;const a=b.dataset.pachi;
  try{
    if(a.startsWith('machine:')){if(R.active())return;machine=a.split(':')[1];ctx.render();}
    else if(a==='enter'){R.start('pin','normal',ctx.cur,ctx.stake,0,machine);running=false;ctx.render();}
    else if(a==='legacy'){invoke('finish');ctx.render();}
    else if(a==='left'||a==='right'){power=a==='left'?56:94;document.getElementById('pachi-handle').value=power;document.getElementById('pachi-power').textContent=power+'%';}
    else if(a==='fire'){running=!running;wantExit=false;b.textContent=running?'停止連續發射':round()?.g.batch?'正在停止…':'開始連續發射';if(!round()?.g.batch)ctx.render();}
    else if(a==='lend'){invoke('lend');ctx.render();}
    else if(a==='exit')exit();
  }catch(err){fail(err);}
 });
 document.addEventListener('input',e=>{if(e.target.id==='pachi-handle'){power=Number(e.target.value);document.getElementById('pachi-power').textContent=power+'%';}});
 W.LineagePachinkoUI={html,mount,suspend,rules,debug:()=>({running,animation:!!frame,machine,power})};
})(window);
