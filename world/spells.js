'use strict';
window.GiranSpells=(()=>{
  const {names,entries,sheets}=GiranSpellData,images=new Map();
  function load(id,dir){
    const options=sheets[id];
    const sub=options[dir]?dir:options[dir&3]?dir&3:Number(Object.keys(options)[0]);
    const key=id+'-'+sub;
    if(!images.has(key)){const im=new Image();im.src='world/art/spells/'+key+'.png';images.set(key,im);if(images.size>80)images.delete(images.keys().next().value);}
    return {im:images.get(key),frames:options[sub],sub};
  }
  function blit(ctx,gfx,dir,x,y,ms,scale,opacity,layer){
    const e=entries[gfx];if(!e)return;
    const {im,frames,sub}=load(e.id,dir);
    if(!im.complete||!im.naturalWidth)return;
    const list=e.seq.length?e.seq:frames.map((_,i)=>[i,2]);
    let left=ms,idx=0;
    for(const [i,d] of list){idx=i;if(left<Math.max(1,d)*40)break;left-=Math.max(1,d)*40;}
    const fr=frames[idx]||frames.find(Boolean);if(!fr||!fr[1]||!fr[2])return;
    const dark=e.dark===true||Array.isArray(e.dark)&&e.dark.includes(sub);
    ctx.save();ctx.globalAlpha=layer==='s'?opacity*.5:opacity;
    ctx.globalCompositeOperation=layer==='s'||layer==='n'||dark||!e.screen?'source-over':'screen';
    const [start,w,h,ox,oy]=fr;ctx.drawImage(im,start,0,w,h,Math.round(x-ox*scale),Math.round(y-oy*scale),w*scale,h*scale);ctx.restore();
  }
  function draw(ctx,name,s,t,age,nativeImpact){
    const id=names[name];if(!id||age<100||age>1350||!s)return;
    const e=entries[id],target=t||s,dir=s.actor?.heading??4;
    const offset=age-100,dist=Math.hypot(target.x-s.x,target.y-s.y);
    const travel=s.id!==target.id&&dist>12&&e.fly,flight=travel?Math.min(480,Math.max(190,dist*1.8)):0;
    const castOnly=nativeImpact&&!travel;
    if(castOnly&&offset>440)return;
    const phase=travel&&offset<flight?offset/flight:1;
    const x=castOnly?s.x:s.x+(target.x-s.x)*phase;
    const y=castOnly?s.y-s.h*.45:travel&&phase<1?s.y+(target.y-s.y)*phase-s.h*.5:target.y;
    const gx=travel&&phase===1&&e.follow?e.follow:id,fx=entries[gx],ms=travel&&phase===1?offset-flight:offset;
    if(!fx||ms>1150)return;
    const opacity=Math.min(1,Math.max(0,(1250-ms)/200))*(castOnly?.68:.92);
    const scale=castOnly?.48:.83;
    for(const [g,mode] of fx.layers)if(mode==='s')blit(ctx,g,dir,x,y,ms,scale,opacity,mode);
    blit(ctx,gx,dir,x,y,ms,scale,opacity);
    for(const [g,mode] of fx.layers)if(mode!=='s')blit(ctx,g,dir,x,y,ms,scale,opacity,mode);
  }
  return {draw};
})();
