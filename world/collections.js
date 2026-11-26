'use strict';
window.GiranCollections=(()=>{
  // Previously purchased bonuses remain readable in existing character saves.
  const regions=[['hp',20],['resWater',4],['mr',2],['weight',4],['mp',20],['resFire',4],['xp',2],['ac',-1],['extraHit',1],['hpR',1]];
  const floors=[
    {hp:30},{hp:50},{hp:50,mp:50},{hp:30,ac:-3},{hp:30,extraHit:3},
    {hp:30,extraDmg:2},{hp:30,mr:10},{hp:100},{hp:30,dr:2},{hp:30,extraDmg:2,extraMp:2}
  ];
  const groups=[
    {slots:3,tiers:[[4,{hp:30,ac:-1}],[6,{hp:50,ac:-2,meleeDmg:1}]]},
    {slots:2,tiers:[[6,{meleeDmg:2,rangedDmg:2}]]}
  ];
  const towers=new Set(MAP_REGIONS.flatMap(r=>r.maps).filter(m=>/傲慢之塔|傲塔/.test(m.t)).map(m=>m.v));
  const inTower=map=>towers.has(map)||/^pride_/.test(map||'');
  const amount=(lv,i)=>i<7?Math.max(0,lv):Math.ceil(Math.max(0,lv)/2);
  function bonus(p,map){
    const c=p?.giranCollections;if(!c)return {};
    const out={};
    const add=(k,v)=>{out[k]=(out[k]||0)+v;};
    regions.forEach(([stat,step],i)=>{const n=c.hunt?.[i]??-1;if(n>0)add(stat,step*amount(n,i));});
    if(inTower(map))floors.forEach((f,i)=>{
      const n=c.tower?.[i]??-1;if(n>=0)for(const [k,v] of Object.entries(f))add(k,Math.trunc(v*(10+n)/10));
    });
    groups.forEach((g,i)=>{
      const ranks=c.gear?.[i]||[];
      const rank=Math.min(...Array.from({length:g.slots},(_,j)=>ranks[j]??-1));
      const tier=g.tiers.filter(([n])=>rank>=n).at(-1);
      if(tier)for(const [k,v] of Object.entries(tier[1]))add(k,v);
    });
    return out;
  }
  function apply(p,d,map){
    const b=bonus(p,map);d.giranBookXp=b.xp||0;d.giranBookWeight=b.weight||0;
    for(const [k,v] of Object.entries(b)){
      if(k==='hp')p.mhp+=v;else if(k==='mp')p.mmp+=v;else if(k!=='xp'&&k!=='weight')d[k]=(d[k]||0)+v;
    }
  }
  function changedMap(before,after){
    if(inTower(before)===inTower(after)||!player?.cls)return;
    for(const ally of player.allies||[])if(ally?.giranCollections?.tower)_allyLevelRecompute(ally);
    if(player.giranCollections?.tower)recomputeStats();
  }
  return {bonus,apply,changedMap};
})();
