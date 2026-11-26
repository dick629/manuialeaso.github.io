(() => {
'use strict';
const dx=[0,1,1,1,0,-1,-1,-1],dy=[-1,-1,0,1,1,1,0,-1];
const key=(x,y)=>x+','+y;
const metric=(a,b)=>((24*(a+b))/88)**2+((12*(b-a))/58)**2;
class BattleFormation {
  constructor(terrain){this.terrain=terrain;this.members=new Set();this.floor=[];this.attackRings=new WeakMap();}
  begin(members,leader,replan) {
    this.members=new Set(members);
    const t=this.terrain;
    // Fractional camera pixels change continuously. Ground reachability changes on cell boundaries.
    const stamp=[t.revision,t.world.groundRevision,t.width,t.height,leader.x,leader.y].join('/');
    if(this.floor.length&&this.floorStamp===stamp)return;
    this.floorStamp=stamp;this.revision=t.revision;this.cx=leader.x;this.cy=leader.y;
    const world=t.world,cached=this.reachable;
    // Ground connectivity survives camera movement. Rebuild the flood only when the
    // loaded floor changes or the captain approaches the edge of its cached neighbourhood.
    if(!cached||cached.revision!==t.revision||cached.ground!==world.groundRevision||
       Math.max(Math.abs(leader.x-cached.x),Math.abs(leader.y-cached.y))>5){
      const queue=[[leader.x,leader.y]],seen=new Set([leader.x*131072+leader.y]);
      for(let i=0;i<queue.length;i++){
        const [x,y]=queue[i];
        for(let h=0;h<8;h++){
          const nx=x+dx[h],ny=y+dy[h],k=nx*131072+ny;
          if(Math.abs(nx-leader.x)>22||Math.abs(ny-leader.y)>22||seen.has(k)||
             !world.canStep(x,y,h)||!world.canStep(nx,ny,(h+4)%8))continue;
          queue.push([nx,ny]);seen.add(k);
        }
      }
      this.reachable={x:leader.x,y:leader.y,revision:t.revision,ground:world.groundRevision,queue,cells:seen};
      this.attackRings=new WeakMap();
      this.exits=new Map();
    }
    const field=t.canvas.parentElement;
    if(!this.panelObserver){
      this.panelObserver=new ResizeObserver(()=>{this.panelKey=null;this.floorStamp=null;});
      this.panelNodes=Array.from(field.querySelectorAll('#status-icon-bar,#lm-status-toggle,.dm-field-actions'));
      for(const node of [field,...this.panelNodes])this.panelObserver.observe(node);
    }
    const panelKey=t.width+'/'+t.height;
    if(this.panelKey!==panelKey){
      this.panels=[];const rect=field.getBoundingClientRect();
      if(rect.width&&rect.height)for(const el of this.panelNodes){
        const b=el.getBoundingClientRect();if(!b.width||!b.height)continue;
        this.panels.push([(b.left-rect.left)*t.width/rect.width,(b.top-rect.top)*t.height/rect.height,
          (b.right-rect.left)*t.width/rect.width,(b.bottom-rect.top)*t.height/rect.height]);
      }
      this.panelKey=panelKey;
    }
    const panels=this.panels;
    this.obscured=new Set();const cells=[];
    for(const cell of this.reachable.queue){
      const [x,y]=cell;
      if(Math.abs(x-leader.x)>17||Math.abs(y-leader.y)>17)continue;
      const [px,py]=t.project(x,y);
      if(px<30||px>t.width-30||py<58||py>t.height-25)continue;
      cells.push(cell);
      if(panels.some(([l,top,r,b])=>px+17>l&&px-17<r&&py>top&&py-54<b))this.obscured.add(key(x,y));
    }
    this.floor=cells;
  }
  occupied(actor,x,y){
    for(const other of this.members){
      if(other===actor)continue;
      if((x===other.x && y===other.y) || (x===other.step?.[0] && y===other.step?.[1]))return true;
    }
    return false;
  }
  attackCells(target,radius){
    // A fight may start outside the camera. The formation floor is only the on-screen subset.
    const ground=this.reachable?.cells;
    if(!ground)return [];
    // Several fighters can approach the same target. Cache only the terrain
    // candidates; occupancy and the route are still checked for each attacker.
    let ring=this.attackRings.get(target);
    if(!ring||ring.x!==target.x||ring.y!==target.y){
      ring={x:target.x,y:target.y,cells:new Map()};this.attackRings.set(target,ring);
    }
    if(ring.cells.has(radius))return ring.cells.get(radius);
    const cells=[];
    for(let y=target.y-radius;y<=target.y+radius;y++)for(let x=target.x-radius;x<=target.x+radius;x++){
      if(ground.has(x*131072+y))cells.push([x,y]);
    }
    ring.cells.set(radius,cells);return cells;
  }
  blockers(actor){
    const cells=new Set();
    for(const unit of this.members)if(unit!==actor){
      cells.add(unit.x*131072+unit.y);
      if(unit.step)cells.add(unit.step[0]*131072+unit.step[1]);
    }
    return (x,y)=>cells.has(x*131072+y);
  }
  seat(actor,anchor,offset,allowed){
    const gx=anchor.x+(offset[0]/24-offset[1]/12)/2,gy=anchor.y+(offset[0]/24+offset[1]/12)/2;
    const points=[];
    for(const other of this.members){
      if(other===actor)continue;
      points.push([other.x,other.y]);
      if(other.fx!==other.x||other.fy!==other.y)points.push([other.fx,other.fy]);
      if(other.step)points.push(other.step);
      if(Number.isFinite(other.goalX)&&(other.goalX!==other.x||other.goalY!==other.y))points.push([other.goalX,other.goalY]);
    }
    let best=null,score=Infinity;
    for(const cell of this.floor){
      const [x,y]=cell;
      const base=metric(x-gx,y-gy);
      if(base>score+.35||allowed&&!allowed(x,y))continue;
      const distance=base+(this.obscured.has(key(x,y))?45:0);
      if(distance>score+.35)continue;
      const id=key(x,y);
      if(!this.exits.has(id)){
        let exits=0;
        for(let h=0;h<8;h++)if(this.terrain.world.canStep(x,y,h)&&this.terrain.world.canStep(x+dx[h],y+dy[h],(h+4)%8))exits++;
        this.exits.set(id,exits);
      }
      let clearance=Infinity;
      for(let i=0;i<points.length&&clearance>0;i++){const p=points[i];clearance=Math.min(clearance,metric(x-p[0],y-p[1]));}
      if(clearance===0)continue;
      const restless=actor && (x===actor.goalX && y===actor.goalY || x===actor.x && y===actor.y) ? -.28 : 0;
      const value=distance+Math.max(0,1.25-clearance)*36+Math.max(0,3-this.exits.get(id))*8+restless;
      if(value<score){score=value;best=cell;}
    }
    return best;
  }
  spawn(anchor,offset,allowed){
    const cell=this.seat(null,anchor,offset,allowed);
    if(!cell)return null;
    const unit=window.AFK_DIMENSION_VIEW.walker(...cell);
    unit.goalX=unit.x;unit.goalY=unit.y;
    unit.seated={anchor,x:anchor.x,y:anchor.y,offset,revision:this.terrain.revision,gx:unit.x,gy:unit.y};
    this.members.add(unit);return unit;
  }
}
window.AFK_DIMENSION_VIEW.BattleFormation=BattleFormation;
})();
