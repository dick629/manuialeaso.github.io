(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f(require('./sherine-catalog'));else r.LineageSherineCore=f(r.LineageSherineCatalog);})(globalThis,function(D){
 'use strict';
 const fresh=new Map(D.fresh.map(x=>[x.name,x])),old=new Set(D.legacy.map(x=>x.name)),mixes=new Map(D.mixes.map(x=>[x.id,x]));
 const COST=Object.freeze({forge:50,refine:100,unlock:200}),group=e=>String(e?.seteff||'').replace(/夢$/,'');
 function counts(p,defs,cut=0){const base={},rift={},seen=new Set();if(!p||p.classicMode)return{base,rift,cut:0};
  for(const [slot,e] of Object.entries(p.eq||{})){if(!e||e.id==='rem_soul'||!defs[e.id]?.remains||!e.uid||seen.has(e.uid)||slot!==e.id)continue;seen.add(e.uid);const g=group(e);if(!fresh.has(g)&&!old.has(g))continue;base[g]=(base[g]||0)+1;if(e.riftRef===1&&String(e.seteff).endsWith('夢'))rift[g]=(rift[g]||0)+1;}
  return{base,rift,cut:Math.min(2,Math.max(0,Number(cut)||0))};
 }
 function tiers(c){return Object.fromEntries([...fresh].map(([g])=>[g,(c.base[g]||0)>0?[2,3,5].filter(n=>c.base[g]+c.cut>=n):[]]));}
 function active(p,c){const s=p?.sherineMixed,m=mixes.get(s?.active);return m&&s?.unlocked?.[m.id]===true&&(c.rift[m.old]||0)>0&&(c.rift[m.new]||0)>0&&c.rift[m.old]+c.cut>=5&&c.rift[m.new]+c.cut>=5?m:null;}
 function valid(p){const s=p?.sherineMixed;if(s==null)return true;return s.schema===1&&s.unlocked&&typeof s.unlocked==='object'&&!Array.isArray(s.unlocked)&&Object.entries(s.unlocked).every(([k,v])=>mixes.has(k)&&v===true)&&(!s.active||mixes.has(s.active)&&s.unlocked[s.active]===true);}
 return{D,COST,fresh,old,mixes,group,counts,tiers,active,valid};
});
