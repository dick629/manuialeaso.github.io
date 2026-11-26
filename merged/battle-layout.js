/* Shared presentation geometry: enemies above, the party in two rows below. */
(function(root){
 'use strict';
 function party(count,width=400,height=340){
  count=Math.max(1,Math.floor(Number(count)||1));
  const columns=Math.ceil(count/2),front=Math.ceil(count/2),points=[];
  for(let i=0;i<count;i++){
   const row=i<front?0:1,index=row?i-front:i,total=row?count-front:front;
   const span=Math.min(86,Math.max(38,total*11));
   points.push({x:(50+(index-(total-1)/2)*span/Math.max(1,total-1)).toFixed(3)+'%',
    b:Math.round(height*(row?0.11:0.35)),z:row?62:52,row,column:index,cell:width*.88/columns,
    sprite:Math.min(50,width*.88/columns*.72),health:Math.min(36,width*.88/columns*.70)});
  }
  return {P:points[0],A:points.slice(1),points,columns};
 }
 const api={party};root.LineageBattleLayout=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
