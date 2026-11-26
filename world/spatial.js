(function (root) {
'use strict';
const directions = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const distance = (a,b) => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y));
function visible(world,a,b,projectile) {
  if (!world || !a || !b) return false;
  let x=a.x, y=a.y;
  const dx=Math.abs(b.x-x), dy=Math.abs(b.y-y);
  const sx=Math.sign(b.x-x), sy=Math.sign(b.y-y);
  let error=dx-dy;
  while (x!==b.x || y!==b.y) {
    const twice=2*error;
    let hx=0, hy=0;
    if (twice > -dy) { error-=dy; hx=sx; }
    if (twice < dx) { error+=dx; hy=sy; }
    const heading=hy<0?(hx<0?7:hx>0?1:0):hy>0?(hx<0?5:hx>0?3:4):hx<0?6:2;
    const nx=x+hx, ny=y+hy;
    // A visually close tile may belong to the far side of a cliff or battlement.
    // Use the physical edges in both directions, even when the arrow mask has gaps.
    if (heading<0 || !world.canStep(x,y,heading) || !world.canStep(nx,ny,(heading+4)%8)) return false;
    if (projectile && world.arrowStep && (!world.arrowStep(x,y,heading) || !world.arrowStep(nx,ny,(heading+4)%8))) return false;
    x+=hx; y+=hy;
  }
  return true;
}
function canHit(world,a,b,reach) {
  if(!a || !b || !(reach>0))return false;
  const edge=reach<=2?(a.footprint||0)+(b.footprint||0):0;
  return distance(a,b)<=reach+edge && visible(world,a,b,reach>2);
}
function chooseSeat(world,board,actor,target,reach,formation) {
  if (!formation && canHit(world,actor,target,reach)) return [actor.x,actor.y];
  const edge=reach<=2?(actor.footprint||0)+(target.footprint||0):0;
  const blocked=board.blockers?board.blockers(actor):(x,y)=>board.occupied(actor,x,y);
  const goals=new Map();
  for(const other of board.members)if(other!==actor&&Number.isFinite(other.goalX)){
    const id=other.goalX*131072+other.goalY;goals.set(id,(goals.get(id)||0)+1);
  }
  let choices=[];
  for (const [x,y] of board.attackCells ? board.attackCells(target,reach+edge) : board.floor) {
    const pos={x,y}, gap=distance(pos,target)-edge;
    if (gap<1 || gap>reach || blocked(x,y)) continue;
    let score=distance(pos,actor)*2 + Math.abs(gap-(reach===1?1:reach-1));
    if(formation){
      const dx=x-target.x,dy=y-target.y;
      const px=24*(dx+dy)-formation[0]*(1+edge),py=12*(dy-dx)-formation[1]*(1+edge);
      score+=Math.hypot(px/24,py/14)*1.65;
      if(x===actor.x&&y===actor.y)score-=1.5;
    }
    score+=15*(goals.get(x*131072+y)||0);
    if (actor.goalX===x && actor.goalY===y) score-=1.5;
    choices.push({x,y,score});
  }
  choices.sort((a,b)=>a.score-b.score);
  const start=actor.step || [actor.x,actor.y];
  actor.seatRoute=null;
  const firstIndex=choices.findIndex(seat=>visible(world,seat,target,reach>2));
  if(firstIndex<0)return null;
  const first=choices[firstIndex];
  if(first.x===actor.x&&first.y===actor.y)return [first.x,first.y];
  const direct=world.findPath?.(...start,first.x,first.y,blocked,6);
  if(direct){const to=[first.x,first.y];actor.seatRoute={to,path:direct};return to;}
  // One local flood covers every alternative, including the far side of a crowded boss.
  const [sx,sy]=start,margin=12;
  const radius=reach+edge;
  const minX=Math.min(sx,target.x-radius)-margin,maxX=Math.max(sx,target.x+radius)+margin;
  const minY=Math.min(sy,target.y-radius)-margin,maxY=Math.max(sy,target.y+radius)+margin;
  const width=maxX-minX+1,id=(x,y)=>(y-minY)*width+x-minX;
  const parent=new Map([[id(sx,sy),-1]]),queue=[id(sx,sy)],best=id(first.x,first.y);
  for(let i=0;i<queue.length&&i<3200&&!parent.has(best);i++){
    const index=queue[i],x=index%width+minX,y=Math.floor(index/width)+minY;
    for(let h=0;h<8;h++){
      const [dx,dy]=directions[h],nx=x+dx,ny=y+dy,k=id(nx,ny);
      if(nx<minX||nx>maxX||ny<minY||ny>maxY||parent.has(k)||blocked(nx,ny)||
         !world.canStep(x,y,h)||!world.canStep(nx,ny,(h+4)%8))continue;
      parent.set(k,h);queue.push(k);
    }
  }
  for(let i=firstIndex;i<choices.length;i++){
    const seat=choices[i],{x,y}=seat;
    if(!parent.has(id(x,y))||i!==firstIndex&&!visible(world,seat,target,reach>2))continue;
    const path=[];let px=x,py=y;
    while(px!==sx||py!==sy){const h=parent.get(id(px,py));path.push(h);px-=directions[h][0];py-=directions[h][1];}
    const to=[x,y];actor.seatRoute={to,path:path.reverse()};return to;
  }
  return null;
}
const api={directions,distance,visible,canHit,chooseSeat};
if(typeof module==='object' && module.exports)module.exports=api;
else root.GiranGeometry=api;
})(globalThis);
