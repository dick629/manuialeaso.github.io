(function(W){'use strict';
 const C=W.LineageSherineCore,K=W.__afkNpcKit,crystal='afk_dim_crystal',esc=K.esc;
 const dimKeys=['rift','eclipse','tide','seam','fallen','endless','mirror','ember','ink','pendulum'];
 const dimKey=name=>dimKeys[C.D.dimensions.indexOf(name)];
 let selectedOld=C.D.legacy[0].name,selectedNew=C.D.fresh[0].name;
 const entries=()=>Object.values(player.eq||{}).concat(player.inv||[]).filter(Boolean);
 function state(){if(!C.valid(player))throw Error('席琳界約資料異常，請使用存檔與修復保留備份');return player.sherineMixed||{schema:1,unlocked:{},active:''};}
 function check(){if(!player?.cls||player.dead||player.classicMode||!/^town_/.test(mapState.current))throw Error('請在非經典模式的村莊操作');const why=W.__afkDimRift.canOpen(player);if(why)throw Error(why);state();}
 const count=()=>player.inv.filter(e=>e.id===crystal&&!e.lock).reduce((s,e)=>s+(e.cnt==null?1:Number(e.cnt)),0);
 function pay(n){if(!Number.isSafeInteger(n)||n<=0||count()<n)throw Error('未上鎖的次元結晶不足：需要 '+n);for(const e of player.inv){if(e.id!==crystal||e.lock)continue;const take=Math.min(n,e.cnt==null?1:e.cnt);e.cnt=(e.cnt==null?1:e.cnt)-take;n-=take;if(!n)break;}player.inv=player.inv.filter(e=>e.id!==crystal||e.cnt!==0);if(n)throw Error('材料扣除失敗');}
 function item(id){const all=entries().filter(e=>e.uid===id);if(all.length!==1)throw Error('物品識別重複或不存在');const e=all[0],d=DB.items[e.id];if(!d?.remains||e.id==='rem_soul'||e.lock||!C.old.has(C.group(e))&&!C.fresh.has(C.group(e)))throw Error('請選擇未上鎖、有套裝的遺骸（之魂除外）');return e;}
 function one(e){const n=e.cnt==null?1:e.cnt;if(!Number.isSafeInteger(n)||n<1)throw Error('遺骸數量異常');if(n===1)return e;if(!player.inv.includes(e))throw Error('裝備欄數量異常');e.cnt--;const copy=JSON.parse(JSON.stringify(e));copy.uid=uid();copy.cnt=1;player.inv.push(copy);return copy;}
 function tx(label,fn){check();return W.LineageGrowth.transactionAsync(label,fn,(disk,p)=>JSON.stringify(disk.p.eq)===JSON.stringify(p.eq)&&JSON.stringify(disk.p.inv)===JSON.stringify(p.inv)&&JSON.stringify(disk.p.sherineMixed)===JSON.stringify(p.sherineMixed));}
 function forge(id,name){return tx('席琳新系淬鍊',()=>{const e=item(id);if(!C.fresh.has(name)||!C.old.has(C.group(e)))throw Error('新系淬鍊需使用舊系遺骸');pay(C.COST.forge);const x=one(e);x.seteff=name+'夢';return x.uid;});}
 function refine(id){return tx('席琳裂縫淬鍊',()=>{const e=item(id);if(!String(e.seteff).endsWith('夢')||e.riftRef)throw Error('需使用尚未裂縫淬鍊的夢域遺骸');pay(C.COST.refine);const x=one(e);x.riftRef=1;return x.uid;});}
 function media(m){const found=new Set();for(const e of entries())if(e.uid&&!found.has(e.uid)&&DB.items[e.id]?.dimRelic&&Number(e.dimEn)>=3&&e.dimSet===dimKey(m.dimension))found.add(e.uid);return found.size;}
 function unlock(id){return tx('席琳界約解鎖',()=>{const m=C.mixes.get(id),s=state();if(!m||s.unlocked[id])throw Error('配方不存在或已解鎖');if(media(m)<3)throw Error('需要持有三件不同的「'+m.dimension+'」次元套裝，各 +3 以上；不消耗成品');pay(C.COST.unlock);player.sherineMixed={schema:1,unlocked:{...s.unlocked,[id]:true},active:id};return id;});}
 function select(id){return tx('席琳界約切換',()=>{const s=state();if(!C.mixes.has(id)||!s.unlocked[id])throw Error('尚未解鎖此界約');player.sherineMixed={...s,active:id};return id;});}
 function description(){return '<p>同一舊系 5 件＋同一新系 5 件。之魂與符文「魂」各減少 1 件需求，最多減 2，兩邊分別計算；最低實穿 3 舊＋3 新。計入混搭的每件均須裂縫淬鍊。新新、舊舊沒有混搭加成。</p><p>每次僅啟用一個界約，共用 20 秒觸發冷卻。解鎖需持有對應次元套裝三件各 +3（不消耗），並支付 200 次元結晶。之後在村莊可免費切換已解鎖界約。</p>';}
 function style(){if(document.getElementById('sherine-forge-style'))return;const el=document.createElement('style');el.id='sherine-forge-style';el.textContent='#sherine-forge{padding:10px 0;min-width:0;line-height:1.7}#sherine-forge .sf-ul{margin:0;padding-left:4px;list-style:none}#sherine-forge .sf-ul li{margin:3px 0}#sherine-forge .sf-rule{margin:8px 0}#sherine-forge select{min-height:30px}#sherine-forge p{margin:6px 0}#sherine-forge select{font:inherit;max-width:100%;min-height:32px;padding:4px 10px;border:1px solid #85724e;border-radius:4px;background:#0f172a;color:#e8d8b6}#sherine-forge summary{cursor:pointer;padding:6px 0;color:#e0ce9e}@media(max-width:800px){#sherine-forge button{min-height:36px}}';document.head.appendChild(el);}
 function mount(div){K.css();style();let box=div.querySelector('#sherine-forge');if(!box){box=document.createElement('section');box.id='sherine-forge';box.className='afk-ax';div.appendChild(box);box.addEventListener('click',async e=>{const b=e.target.closest('[data-sherine]');if(!b||b.disabled)return;const [op,id]=b.dataset.sherine.split('|');b.disabled=true;try{if(op==='forge'){if(!await W.confirm('將這一件遺骸淬鍊成'+selectedNew+'？消耗50次元結晶，原套裝效果會被替換。'))return;await forge(id,selectedNew);}if(op==='refine')await refine(id);if(op==='unlock')await unlock(id);if(op==='select')await select(id);}catch(err){await W.alert(err.message);}finally{paint(box);}});box.addEventListener('change',e=>{if(e.target.name==='sherineOld')selectedOld=e.target.value;if(e.target.name==='sherineNew')selectedNew=e.target.value;paint(box);});}paint(box);}
 function paint(box){const s=state(),v=W.LineageSherine.view(player),m=C.D.mixes.find(m=>m.old===selectedOld&&m.new===selectedNew),f=C.fresh.get(selectedNew),need=5-v.c.cut,md=media(m),ro=v.c.rift[m.old]||0,rn=v.c.rift[m.new]||0;
 // 玩家 11-11：比照其他 NPC 的面板排版
 const sel=(name,list,cur)=>'<select name="'+name+'">'+list.map(x=>'<option '+(x.name===cur?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select>';
 let h='<div class="ax-h" style="margin-top:0">① 選一組舊系＋新系</div><div class="ax-row"><div class="ax-main"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label class="ax-desc">舊系 '+sel('sherineOld',C.D.legacy,selectedOld)+'</label><span class="ax-note">＋</span><label class="ax-desc">新系 '+sel('sherineNew',C.D.fresh,selectedNew)+'</label></div></div><div class="ax-note">目前生效：<b style="color:#fde68a">'+esc(v.mix?.name||'無')+'</b></div></div>';
 h+='<div class="ax-h">新系「'+esc(f.name)+'」的套裝效果</div><div class="ax-row"><div class="ax-main"><ul class="ax-note sf-ul"><li><b>2 件</b>　'+esc(f.tier2)+'</li><li><b>3 件</b>　'+esc(f.tier3)+'</li><li><b>5 件</b>　'+esc(f.tier5)+'</li></ul></div></div>';
 const act=s.active===m.id,un=!!s.unlocked[m.id];
 h+='<div class="ax-h">② 界約「'+esc(m.name)+'」</div>'+K.rowHtml({key:m.id,name:esc(m.name)+(act?'　<span style="color:#86efac;font-size:13px">生效中</span>':un?'　<span style="color:#93c5fd;font-size:13px">已解鎖</span>':''),color:'#f0abfc',desc:esc(m.effect).replaceAll('1.2P','每秒基準傷害的1.2倍').replaceAll('0.6H','施放者最大生命的60%'),
  req:'<span class="ax-req"><span class="'+(md>=3?'ok':'no')+'">'+md+'</span>/3 件 '+esc(m.dimension)+' +3（媒介，不消耗）</span>　<span class="ax-req"><span class="'+(ro>=need?'ok':'no')+'">'+ro+'</span>/'+need+' 舊系</span>　<span class="ax-req"><span class="'+(rn>=need?'ok':'no')+'">'+rn+'</span>/'+need+' 新系（裂縫淬鍊過的遺骸）</span>'+(un?'':'　'+K.reqTxt(count(),200,'次元結晶')),
  btns:[[(un?'select':'unlock')+'|'+m.id,act?'已選定':un?'啟用界約':'解鎖界約',!act]]},'data-sherine');
 h+='<details class="sf-rule"><summary>材料與混搭規則</summary><div class="ax-note">'+description()+'</div></details>';
 h+='<div class="ax-h">③ 遺骸淬鍊</div><div class="ax-note" style="margin-bottom:6px">舊系遺骸轉成新系「'+esc(selectedNew)+'」：次元結晶 50（原套裝效果會被替換）；夢域淬鍊過的遺骸再做裂縫淬鍊：次元結晶 100。</div>';
 const list=entries().filter(e=>DB.items[e.id]?.remains&&e.id!=='rem_soul');
 if(!list.length)h+=K.rowHtml({key:'none',name:'沒有席琳遺骸',color:'#94a3b8',off:true,btns:[]},'data-sherine');
 for(const e of list){const canF=!e.lock&&C.old.has(C.group(e)),canR=!e.lock&&String(e.seteff).endsWith('夢')&&!e.riftRef;
  h+=K.rowHtml({key:e.uid,ico:K.invIco(e,'inv',true),name:K.fullName(e),color:'#f87171',desc:esc(C.group(e))+(e.riftRef?'・<span style="color:#86efac">已裂縫淬鍊</span>':'')+(e.lock?'・已上鎖':''),btns:[].concat(canF?[['forge|'+e.uid,'轉為'+esc(selectedNew)+'（50）',count()>=50]]:[],canR?[['refine|'+e.uid,'裂縫淬鍊（100）',count()>=100]]:[])},'data-sherine');}
 box.innerHTML=h;
 }
 const desc=W.buildItemDescHTML;W.buildItemDescHTML=function(e){const g=C.fresh.get(C.group(e));if(g&&DB.items[e.id]?.remains)return '<b>'+esc(g.name)+' · 席琳新系</b><br>'+[2,3,5].map(n=>n+'件：'+esc(g['tier'+n])).join('<br>')+'<br>'+(e.riftRef?'已裂縫淬鍊，可計入新舊界約。':'裂縫淬鍊需100次元結晶。');return desc.apply(this,arguments);};
 const sig=W.itemSig;W.itemSig=function(e){return sig.apply(this,arguments)+(e?.riftRef?'|riftRef:1':'');};
 W.LineageSherineForge={forge,refine,unlock,select,media,mount,description,dimKey,count};
})(window);
