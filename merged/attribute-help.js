(function(W){
 'use strict';
 const names={str:'力量',dex:'敏捷',con:'體質',int:'智力',wis:'精神',cha:'魅力'};
 // Evaluate the live game lookup functions, including rebirth extensions.
 // No allocation, recomputation, save write or mutation of the active actor.
 const specs={
  str:[['getStrMeleeDmg','近距離傷害','',true],['getStrMeleeHit','近距離命中','',true],['getStrMeleeCrit','近距離爆擊率','%',true]],
  dex:[['getDexRangedDmg','遠距離傷害','',true],['getDexRangedHit','遠距離命中','',true],['getDexRangedCrit','遠距離爆擊率','%',true],['getDexAC','防禦 AC',''],['getDexER','迴避 ER','']],
  int:[['getIntMagicDmg','魔法傷害','',true],['getIntExtraMp','額外魔法點數','',true],['getIntMagicHit','魔法命中','',true],['getIntMagicCrit','魔法爆擊率','%',true],['getIntMpReduce','MP 消耗減少','%']],
  con:[['getConGrowth','每級 HP 成長',''],['getConHpRegenMax','HP 自然恢復量上限',''],['getConPotionPct','藥水恢復加成','%']],
  wis:[['getWisGrowth','每級 MP 成長',''],['getWisMpRegen','MP 自然恢復量',''],['getWisMR','魔法防禦 MR',''],['getWisBlueBonus','藍色藥水回魔加成',''],['wisMpRegenIntervalTicks','自然回魔間隔','秒']],cha:[]
 };
 const fmt=n=>String(Math.round(n*10000)/10000),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function describe(stat){
  if(!names[stat]||typeof player==='undefined'||!player?.d)return null;
  const p=player,cap=W.__afkAttrCap?W.__afkAttrCap():100,nat=typeof naturalStat==='function'?naturalStat(stat):0;
  const total=W.__afkStatTotal?W.__afkStatTotal(stat):p.d[stat],effective=Number(p.d[stat])||0;
  const entries=(specs[stat]||[]).map(([key,label,unit,overflow])=>({key,label,unit,overflow,fn:v=>W[key](v,p.cls)})).filter(e=>typeof W[e.key]==='function');
  if(stat==='cha'){
   const owner=v=>({...p,d:{...p.d,cha:v}});
   if(W.petCharmCombatBonus)entries.push({key:'petCharmCombatBonus',label:'每隻寵物基礎傷害／命中',unit:'',fn:v=>W.petCharmCombatBonus(owner(v)).dmg});
   if(p.cls==='royal'&&W.allyActiveCap)entries.push({key:'allyActiveCap',label:'可出戰傭兵上限',unit:'人',fn:v=>W.allyActiveCap(owner(v))});
   if(W._sumDefaultForm&&W._sumCountFor){const form=p.summon?.n||W._sumDefaultForm(p);if(form)entries.push({key:'summonCount',label:form+'召喚數量上限',unit:'隻',fn:v=>W._sumCountFor(form,owner(v))});}
  }
  const rows=entries.map(e=>{
   const uncapped=!!(p.rebirth>0&&!p.classicMode&&e.overflow),current=uncapped?total:effective,limit=uncapped?current+100:Math.max(effective,cap);
   const scale=e.key==='wisMpRegenIntervalTicks'?10:1,base=e.fn(current)/scale;let next=null;
   for(let add=1;add<=100&&current+add<=limit;add++){const gain=e.fn(current+add)/scale-base;if(Math.abs(gain)>1e-8){next={points:add,at:current+add,gain};break;}}
   return {key:e.key,label:e.label,unit:e.unit,current,base,next};
  });
  return{stat,name:names[stat],natural:nat,total,effective,cap,allocationCap:W.__afkAllocCap?W.__afkAllocCap():60,rows};
 }
 let modal=null,layer=null,previous=null;
 function dismiss(){modal?.remove();modal=null;layer=null;previous?.focus?.({preventScroll:true});}
 function close(){if(layer&&W.AFK_UI)W.AFK_UI.closeLayer(layer);else dismiss();}
 function open(stat){const data=describe(stat);if(!data)return;if(modal)return;previous=document.activeElement;
  modal=document.createElement('div');modal.id='attribute-help';modal.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="attribute-help-title"><header><h2 id="attribute-help-title">'+esc(data.name)+'・下一個能力門檻</h2><button type="button" aria-label="關閉屬性說明">關閉</button></header><div class="attribute-layout"><aside class="attribute-portrait"><img src="assets/ui/interface-v6/attribute-'+stat+'.svg" alt=""><b>'+esc(data.name)+' '+fmt(data.total)+'</b><small>角色能力・成長門檻</small></aside><div class="attribute-help-body"><p>基本值 '+fmt(data.natural)+' ＋ 其他加成 '+fmt(data.total-data.natural)+' ＝ 總值 '+fmt(data.total)+'</p><p>以目前角色與裝備的屬性公式計算；以下增益為屬性本身的基礎加成，套裝與戰鬥倍率另計。</p>'+data.rows.map(r=>'<article><b>'+esc(r.label)+'</b><span>'+(r.next?'再增加 <strong>'+r.next.points+' 點'+esc(data.name)+'</strong>：'+(r.next.gain>0?'+':'')+fmt(r.next.gain)+esc(r.unit)+'<small>屬性達 '+fmt(r.next.at)+'；目前此項基礎加成 '+fmt(r.base)+esc(r.unit)+'</small>':'目前此項基礎加成 '+fmt(r.base)+esc(r.unit)+'<small>目前公式與屬性上限內，沒有更高門檻。</small>')+'</span></article>').join('')+(data.natural>=data.allocationCap?'<p class="attribute-help-note">基本值已達配點上限 '+data.allocationCap+'。仍可查看裝備與增益能達到的門檻。</p>':'')+(document.querySelector('#tab-stats.is-respec')?'<p>目前正在重新配點；本說明顯示確認配點前的角色數值。</p>':'')+'<p>每項「再增加」都從目前數值起算，不是接續上一列加點。</p></div></div></section>';
  modal.querySelector('button').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close();});modal.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();modal.querySelector('button').focus();}if(e.key==='Escape'&&!W.AFK_UI){e.preventDefault();close();}});document.body.append(modal);layer=W.AFK_UI?.openLayer(dismiss);modal.querySelector('button').focus();
 }
 function statOf(el){return Object.keys(names).find(s=>el.classList.contains('ability-primary-'+s));}
 function init(){const tab=document.getElementById('tab-stats');if(!tab)return;tab.querySelectorAll('.ability-primary-control').forEach(el=>{const s=statOf(el);el.tabIndex=0;el.setAttribute('aria-label',names[s]+'，查看下一個能力門檻');el.setAttribute('aria-haspopup','dialog');});
  tab.addEventListener('click',e=>{if(e.target.closest('button,input,select'))return;const el=e.target.closest('.ability-primary-control');if(el)open(statOf(el));});
  tab.addEventListener('keydown',e=>{if(e.target.matches('.ability-primary-control')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(statOf(e.target));}});
 }
 const style=document.createElement('style');style.textContent='#attribute-help{position:fixed;inset:0;z-index:104000;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:#05070bd9}#attribute-help section{width:500px;max-width:100%;max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:linear-gradient(140deg,#29313a,#12171e);border:1px solid #a49162;box-shadow:inset 0 0 0 3px #181b21,0 15px 50px #000;color:#d9d7c7}#attribute-help header{display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #766846;flex:none}#attribute-help h2{font:600 19px Georgia,"PMingLiU",serif;color:#dcc58e;margin:0;flex:1}#attribute-help button{background:#292722;color:#e5d9b4;border:1px solid #9f8c63;padding:9px 14px;cursor:pointer}#attribute-help .attribute-help-body{padding:14px;overflow:auto;overscroll-behavior:contain;min-height:0;font:14px/1.7 "Microsoft JhengHei",sans-serif}#attribute-help p{margin:0 0 12px;color:#b3b5b0}#attribute-help article{border:1px solid #48525d;background:#101a23;padding:12px;margin-bottom:8px}#attribute-help b,#attribute-help span,#attribute-help small{display:block}#attribute-help b{color:#d3bd85}#attribute-help strong{color:#89d9c4}#attribute-help small{color:#9da7ac;font-size:12px}#attribute-help .attribute-help-note{color:#e0bf80}.ability-primary-control[aria-haspopup="dialog"]{cursor:help}.ability-primary-control[aria-haspopup="dialog"]:focus-visible{outline:2px solid #d3bd85;outline-offset:2px}@media(max-width:820px){#attribute-help section{background:linear-gradient(140deg,#263930,#101d18)}#attribute-help article{background:#10251d;border-color:#465e50}}';document.head.append(style);
 W.LineageAttributeHelp={describe,open,close};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
