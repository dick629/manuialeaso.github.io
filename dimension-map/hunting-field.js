(() => {
'use strict';
const {World,mediaBase}=window.AFK_DIMENSION_VIEW;
const assets=new URL('../',mediaBase);
const routes=window.AFK_HUNTING_FIELDS;
const themes={
  hall:   {floor:'#51464c',joint:'#706575',art:'中央寺院',outline:[[.11,.52],[.33,.31],[.68,.30],[.90,.53],[.80,.80],[.52,.91],[.20,.80]]},
  cave:   {floor:'#50453a',joint:'#736254',art:'地監',outline:[[.10,.57],[.33,.32],[.68,.29],[.88,.48],[.84,.75],[.57,.91],[.20,.84]]},
  forest: {floor:'#45573b',joint:'#64724b',art:'森林',outline:[[.09,.54],[.25,.32],[.55,.25],[.88,.38],[.91,.66],[.78,.85],[.34,.91],[.09,.78]]},
  desert: {floor:'#997b4c',joint:'#ba9d63',art:'沙漠',outline:[[.07,.46],[.34,.26],[.80,.30],[.95,.52],[.86,.84],[.47,.91],[.10,.81]]},
  ice:    {floor:'#657c8d',joint:'#90aab5',art:'水晶洞穴',outline:[[.12,.58],[.33,.34],[.68,.26],[.88,.50],[.82,.83],[.34,.90],[.13,.76]]},
  coast:  {floor:'#676b53',joint:'#8b9479',art:'海賊島',outline:[[.09,.50],[.37,.31],[.71,.29],[.90,.50],[.79,.79],[.44,.91],[.12,.80]]},
  keep:   {floor:'#605d52',joint:'#878175',art:'國境要塞',outline:[[.11,.55],[.30,.35],[.67,.31],[.89,.50],[.86,.78],[.53,.91],[.17,.80]]},
};
// Normalized to the original Dimension paintings. The entrance and passable ground are
// traced separately on each plate; foreground objects use their foot line for depth.
const paintings={
  sunrise_castle:{start:[.52,.55],outline:[[.11,.48],[.21,.36],[.35,.26],[.54,.22],[.71,.29],[.82,.45],[.94,.53],[.90,.66],[.96,.87],[.84,.98],[.47,.92],[.36,.80],[.29,.83],[.13,.93],[.06,.77]],holes:[[[.12,.58],[.23,.51],[.29,.58],[.26,.69],[.16,.75]]],front:[[[.15,.46],[.23,.45],[.30,.57],[.28,.66],[.17,.74],[.13,.67]],[[.28,.88],[.39,.76],[.49,.93],[.52,1],[.23,1]]]},
  sunrise_east:{start:[.49,.63],outline:[[.09,.57],[.20,.43],[.40,.48],[.48,.47],[.51,.35],[.48,.22],[.50,.13],[.57,.14],[.60,.26],[.68,.32],[.77,.26],[.88,.28],[.88,.35],[.67,.43],[.57,.60],[.61,.70],[.70,.58],[.82,.49],[.92,.53],[.94,.71],[.81,.77],[.69,.77],[.63,.86],[.52,.98],[.48,.94],[.51,.78],[.44,.68],[.31,.72],[.17,.74]],holes:[[[.31,.47],[.42,.42],[.49,.49],[.47,.55],[.37,.54]]],front:[[[.30,.26],[.35,.28],[.41,.36],[.42,.45],[.39,.49],[.34,.47],[.31,.40]],[[.54,.69],[.61,.69],[.64,.76],[.61,.84],[.54,.83]]]},
  sunrise_west:{start:[.55,.58],outline:[[.13,.60],[.19,.44],[.32,.32],[.47,.26],[.65,.24],[.73,.19],[.78,.24],[.76,.32],[.88,.35],[.92,.60],[.86,.70],[.72,.68],[.61,.75],[.51,.77],[.36,.89],[.20,.99],[.09,.98],[.20,.83],[.26,.76],[.22,.68]],holes:[[[.36,.29],[.42,.27],[.43,.33],[.37,.35]]],front:[[[.02,.55],[.12,.48],[.17,.50],[.18,.57],[.10,.65],[.02,.67]],[[.76,.73],[.86,.59],[.91,.59],[.92,.68],[.87,.79],[.78,.84]]]},
  sunrise_north:{start:[.55,.53],outline:[[.07,.73],[.16,.58],[.23,.51],[.27,.40],[.36,.43],[.44,.48],[.51,.41],[.51,.31],[.58,.30],[.59,.43],[.66,.50],[.73,.49],[.82,.40],[.88,.40],[.89,.46],[.76,.56],[.69,.63],[.79,.70],[.86,.78],[.85,.91],[.69,.97],[.59,.88],[.56,.72],[.56,.64],[.48,.61],[.39,.59],[.37,.72],[.31,.86],[.21,.92],[.08,.88]],holes:[[[.39,.56],[.44,.54],[.49,.59],[.46,.63],[.39,.64]]],front:[[[.39,.55],[.40,.45],[.45,.43],[.49,.50],[.51,.57],[.48,.64],[.42,.66]],[[.39,.76],[.41,.64],[.48,.62],[.56,.70],[.60,.83],[.55,.91],[.46,.92]],[[.50,.21],[.61,.19],[.61,.24],[.58,.25],[.58,.33],[.56,.34],[.56,.25],[.53,.26],[.53,.34],[.51,.34],[.51,.26]]]},
  rift_battle:{start:[.49,.58],outline:[[.11,.57],[.18,.42],[.29,.35],[.38,.24],[.50,.21],[.59,.19],[.69,.27],[.78,.29],[.82,.39],[.91,.46],[.90,.61],[.83,.69],[.81,.80],[.72,.83],[.67,.92],[.55,.86],[.49,.88],[.42,.78],[.34,.79],[.30,.72],[.21,.76],[.18,.70],[.11,.72]],holes:[[[.19,.65],[.24,.60],[.27,.64],[.25,.69],[.21,.70]],[[.70,.32],[.72,.27],[.76,.31],[.74,.36]]],front:[[[.19,.64],[.22,.52],[.24,.61],[.27,.57],[.26,.67],[.22,.70]],[[.70,.33],[.70,.24],[.72,.18],[.73,.27],[.76,.22],[.75,.33],[.72,.36]],[[.71,.80],[.73,.67],[.75,.63],[.76,.72],[.79,.68],[.77,.81],[.74,.83]]]}
};
// These Dimension locations have their own plates. The named native maps previously used
// for them (Thebes, Shadow Temple, Aden Crypt and others) are different places.
// Coordinates below are percentages on the shipped plate, measured before viewport scaling.
const points = pairs => pairs.map(([x,y])=>[x/100,y/100]);
function registerPlate(keys,outline,start,front=[],holes=[]){
  for(const key of keys.split(' '))paintings[key]={
    outline:points(outline),start:[start[0]/100,start[1]/100],
    front:front.map(points),holes:holes.map(points)
  };
}
const chamber=[[24,27],[46,19],[62,22],[82,32],[94,47],[88,70],[69,85],[53,94],[36,83],[16,76],[5,56],[9,39]];
const ruins=[[10,38],[26,22],[42,26],[54,18],[78,26],[91,40],[93,60],[81,74],[70,79],[62,91],[41,89],[33,80],[18,77],[12,63],[5,55]];
const pillars=[[[4,75],[9,55],[13,57],[15,71],[15,80],[9,84]],[[77,86],[80,76],[86,71],[91,73],[86,83]]];
registerPlate('time_room afk_solo_central',chamber,[50,56],[[[0,79],[6,74],[17,84],[18,91],[12,91],[3,84]]]);
registerPlate('afk_solo_belief1 afk_solo_belief2 afk_solo_belief3 afk_solo_belief4',chamber,[50,56],pillars);
registerPlate('afk_solo_ruin1 afk_solo_ruin2 afk_solo_ruin3 afk_solo_ruin4 afk_soul_room afk_solo_soul',ruins,[50,55],pillars);
registerPlate('petra_baobab',[[4,43],[14,35],[18,38],[25,27],[37,22],[47,23],[55,29],[72,21],[82,27],[79,35],[88,47],[96,62],[89,80],[71,79],[60,88],[38,91],[23,83],[13,73],[12,60]],[53,56],
  [[[0,57],[9,50],[17,66],[22,75],[18,78],[8,72],[2,74]]]);
registerPlate('petra_oasis',[[5,36],[18,31],[28,39],[46,44],[59,49],[69,47],[77,41],[83,37],[91,41],[96,50],[88,63],[77,66],[72,80],[59,92],[43,90],[32,79],[18,80],[13,71],[16,57],[7,54]],[52,64],
  [[[2,64],[6,53],[9,55],[11,69],[7,73]],[[80,71],[84,54],[90,48],[96,53],[91,65],[86,72]]]);
registerPlate('petra_dry',[[6,38],[17,30],[28,33],[40,24],[51,16],[63,29],[74,32],[86,38],[92,52],[86,62],[88,74],[73,84],[60,88],[46,83],[32,89],[22,77],[16,73],[11,59],[4,54]],[52,56],pillars);
registerPlate('petra_canyon',[[43,4],[58,4],[57,15],[64,23],[69,31],[84,43],[91,58],[86,68],[79,70],[77,84],[67,96],[44,98],[35,88],[18,83],[13,70],[15,61],[7,52],[17,43],[21,35],[37,23]],[50,54],
  [[[1,65],[12,51],[14,52],[16,62],[12,68],[8,76]]]);
registerPlate('petra_bandit',[[4,47],[15,30],[30,28],[35,21],[56,25],[68,20],[76,29],[89,32],[90,45],[86,53],[96,60],[90,72],[78,74],[70,86],[54,97],[40,90],[28,83],[15,79],[14,68],[5,64]],[51,56],pillars);
registerPlate('petra_nemesis petra_sandhell petra_ruins',ruins,[52,57],pillars);
registerPlate('snow_sanctum snow_lava snow_collapse afk_flame_depth afk_halpas_nest',ruins,[52,57],pillars);
registerPlate('icequeen_palace afk_solo_ice',chamber,[52,56],pillars);
// Crystal ridges, rock walls and lava cut the paths in the three dragon approaches.
registerPlate('antharas_nest_1',[[3,66],[17,48],[34,40],[48,29],[59,26],[72,30],[88,20],[96,25],[91,39],[77,50],[66,54],[56,73],[43,80],[24,80],[15,89],[7,88]],[48,52]);
registerPlate('antharas_nest_2',[[8,29],[22,32],[37,43],[48,41],[54,30],[64,25],[79,21],[89,28],[84,42],[71,49],[58,52],[49,61],[40,68],[32,86],[20,86],[27,66],[34,55],[23,45]],[50,49]);
registerPlate('antharas_nest_3 riftdg_dragons_安塔瑞斯',[[8,64],[18,47],[28,45],[36,35],[52,29],[58,21],[72,24],[83,33],[71,45],[60,51],[50,63],[36,69],[25,79],[14,78]],[48,47]);
registerPlate('cr_fafurion_nest_1',[[4,43],[14,38],[26,43],[36,33],[44,29],[49,14],[59,7],[70,14],[70,30],[80,33],[90,27],[97,38],[89,52],[76,54],[73,74],[64,78],[60,65],[45,62],[30,67],[21,81],[12,84],[5,75]],[52,49]);
registerPlate('cr_fafurion_nest_2',[[3,28],[13,33],[32,49],[39,46],[44,33],[50,24],[57,24],[53,40],[47,52],[48,58],[65,65],[75,66],[86,72],[92,72],[93,82],[80,82],[64,76],[47,68],[32,64],[22,70],[15,69],[25,54],[10,43]],[44,56]);
registerPlate('cr_fafurion_nest_3 riftdg_dragons_法利昂',[[5,53],[17,47],[21,36],[36,34],[45,40],[53,45],[66,41],[77,40],[89,47],[89,59],[81,67],[69,65],[63,57],[54,56],[45,63],[40,73],[27,71],[20,61],[10,67]],[48,51]);
registerPlate('cr_valakas_nest_1',[[8,52],[23,45],[31,31],[39,32],[34,46],[45,48],[56,35],[68,25],[74,27],[65,41],[55,53],[65,60],[76,66],[78,73],[68,71],[54,64],[44,57],[30,56],[18,67],[8,63]],[46,53]);
registerPlate('cr_valakas_nest_2',[[6,38],[23,32],[43,37],[60,29],[77,34],[92,48],[87,65],[70,70],[58,81],[39,79],[23,68],[12,62]],[49,55]);
registerPlate('cr_valakas_nest_3 riftdg_dragons_巴拉卡斯',[[5,31],[18,32],[35,42],[49,49],[62,39],[78,30],[90,31],[76,43],[64,51],[74,59],[93,68],[93,74],[79,70],[60,60],[50,57],[35,68],[18,77],[10,75],[21,63],[36,53],[24,44],[8,39]],[49,53]);
registerPlate('cr_lindvior_nest_1',[[7,30],[14,20],[25,26],[32,37],[48,41],[59,34],[76,36],[91,47],[87,60],[72,65],[63,62],[54,67],[39,65],[30,78],[16,84],[8,75],[16,56],[18,44]],[52,52]);
registerPlate('cr_lindvior_nest_2',[[13,35],[23,27],[39,31],[52,24],[64,25],[69,37],[77,39],[75,50],[70,61],[75,73],[62,81],[48,77],[41,68],[29,65],[23,54],[15,52]],[50,52]);
registerPlate('cr_lindvior_nest_3 riftdg_dragons_林德拜爾',[[8,48],[18,36],[29,38],[35,27],[51,25],[59,31],[71,29],[83,21],[91,29],[83,44],[71,46],[64,61],[59,74],[46,78],[31,68],[24,59],[13,62]],[52,54]);
registerPlate('cr_lindvior_lair wind_dragon_lair',[[9,65],[18,53],[34,48],[44,39],[51,24],[67,20],[74,27],[62,39],[57,50],[71,53],[81,66],[77,73],[62,67],[48,60],[40,68],[30,81],[20,82]],[49,52]);

// The rift plates already have individual paths in the field catalogue.
const riftFront={
  rift_hardin:[[[0,65],[4,60],[7,74],[17,81],[23,91],[12,86],[5,80]]],
  rift_clock:[[[77,87],[85,78],[93,68],[98,58],[100,62],[98,73],[85,86]]],
  rift_ship:[[[74,83],[87,69],[94,57],[98,48],[100,51],[97,67],[90,80],[79,91]]],
  rift_mirror:[[[0,73],[4,63],[10,73],[13,81],[26,90],[22,93],[6,85]]],
  art_sea:[[[2,76],[8,64],[10,70],[15,69],[15,78],[23,82],[17,89],[7,87]]],
  art_horn:[[[83,65],[88,49],[92,42],[95,45],[93,60],[96,67],[94,73],[87,70]]],
  art_hardin:[[[1,70],[6,63],[9,68],[12,70],[15,79],[11,84],[4,77]]]
};
for(const [key,entry] of Object.entries(routes)){
  if(!entry.outline || paintings[key] || !key.startsWith('riftdg_') &&
     !['afk_final_sea','afk_guard_dg_moon','afk_guard_dg_magic','afk_starroad','afk_zodiac','afk_riftdg','afk_awq_echo','afk_raid'].includes(key))continue;
  paintings[key]={outline:entry.outline,start:entry.start,front:(riftFront[entry.art]||[]).map(points),holes:[]};
}
function family(name) {
  if (/冰|雪|水晶/.test(name)) return 'ice';
  if (/沙漠|金字塔|底比斯|荒地/.test(name)) return 'desert';
  if (/港|船|海底|海賊|水之|地底湖/.test(name)) return 'coast';
  if (/要塞|堡|關口|城墎|攻城|外門|內城|PvP|競技|決鬥/i.test(name)) return 'keep';
  if (/塔|神殿|殿堂|王之室|之室|祭壇|實驗室|研究所|遺跡|裂痕/.test(name)) return 'hall';
  if (/洞|地監|隧道|通道|墓|巢穴|窟/.test(name)) return 'cave';
  return 'forest';
}
function definition(key,label) {
  const entry=routes[key] || {};
  const theme=entry.theme || family(label+' '+key);
  return { ...entry,theme,art:entry.art || themes[theme].art };
}
function inside(x,y,polygon) {
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [ax,ay]=polygon[i],[bx,by]=polygon[j];
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) yes=!yes;
  }
  return yes;
}
// Custom areas have their own isometric artwork. Rasterize the floor boundary into the same
// two direction bits that World.canStep and World.findPathNear use on original tile maps.
class HuntingField extends World {
  constructor() { super(); this.images=new Map(); this.patterns=new Map(); }
  select(key,label,artOverride) {
    const spec={...definition(key,label),...paintings[key]};
    const art=artOverride || (spec.art.includes('/')?spec.art:'assets/area/1920x1080/'+spec.art+'.jpg');
    this.theme=themes[spec.theme];
    this.asset=art;
    this.image=this.loadImage(art);
    this.painting=paintings[key];this.viewScale=1;
    const span=97,w=1536,h=864;
    const start=spec.start || [.50,.58],poly=spec.outline || this.theme.outline;
    const holes=spec.holes || [];
    this.map={id:key,reg:[],d:{gameX0:-48,gameY0:-48,cw:span,ch:span,ox:Math.round(w*start[0])-48*48,oy:Math.round(h*start[1]),ww:w,wh:h,cs:256,cx:Math.ceil(w/256),cy:Math.ceil(h/256)}};
    this.cells=new Uint8Array(span*span);
    for(let y=0;y<span;y++) for(let x=0;x<span;x++) {
      const [px,py]=this.worldPos(x-48,y-48),u=px/w,v=py/h;
      if (inside(u,v,poly) && !holes.some(p=>inside(u,v,p))) this.cells[y*span+x]=3;
    }
  }
  fitViewport(width,height) {
    // Keep one undistorted world on ultrawide and tall displays. Coordinates stay in native cells.
    const scale=Math.max(1,width/1536,height/864);
    if(scale===this.viewScale)return false;
    this.viewScale=scale;this.map.d.ww=Math.ceil(1536*scale);this.map.d.wh=Math.ceil(864*scale);
    this.groundRevision++;return true;
  }
  worldPos(x,y) {
    const p=super.worldPos(x,y);
    return this.viewScale===1?p:p.map(v=>v*this.viewScale);
  }
  screenToCell(x,y,cam) {
    const scale=this.viewScale;
    return super.screenToCell((x+cam[0])/scale,(y+cam[1])/scale,[0,0]);
  }
  loadImage(path) {
    let im=this.images.get(path);
    if (!im) {
      im=new Image();
      im.onerror=()=>{if(this.images.get(path)===im)this.images.delete(path);};
      im.src=new URL(path,assets).href;
      if(this.images.size>=4)this.images.delete(this.images.keys().next().value);
      this.images.set(path,im);
    }
    return im;
  }
  release() {this.flushChunks();this.map=null;this.cells=null;this.painting=null;this.image=null;}
  hasGround(x,y) {return !!this.flags(x,y);}
  prepare(){return {need:1,done:this.image?.naturalWidth?1:0};}
  flags(x,y) {
    const d=this.map?.d;
    return d && x>=0 && y>=0 && x<d.cw && y<d.ch ? this.cells[y*d.cw+x] : 0;
  }
  pass(x,y) { return this.flags(x,y) & 3; }
  // Draw a ground layer immediately, including while the location's artwork is decoding.
  floor(ctx) {
    const theme=this.theme;
    if (this.patterns.has(theme))return this.patterns.get(theme);
    const c=document.createElement('canvas');c.width=192;c.height=96;
    const g=c.getContext('2d');g.fillStyle=theme.floor;g.fillRect(0,0,c.width,c.height);
    g.strokeStyle=theme.joint;g.lineWidth=1;g.globalAlpha=.46;
    for(let y=0;y<=96;y+=12) for(let x=-24+(y%24?24:0);x<216;x+=48) {
      g.beginPath();g.moveTo(x-24,y);g.lineTo(x,y-12);g.lineTo(x+24,y);g.stroke();
    }
    const pattern=ctx.createPattern(c,'repeat');this.patterns.set(theme,pattern);return pattern;
  }
  camFor(center,w,h,opts) {
    const d=this.map.d,cam=super.camFor(center,w,h,opts);
    cam[0]=Math.min(Math.max(0,d.ww-w),Math.max(0,cam[0]));
    // The phone dock can cover the lower half of the window. At the southern edge keep the captain on visible ground.
    const visible=h*(window.AFK_DIMENSION_VIEW.visibleFieldFraction??1);
    cam[1]=Math.min(Math.max(0,d.wh-visible),Math.max(0,cam[1]));
    return cam;
  }
  draw(ctx,w,h,center,actors,now,opts) {
    const cam=this.camFor(center,w,h,opts),d=this.map.d;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    if(this.image?.complete && this.image.naturalWidth && w<=d.ww && h<=d.wh) {
      // The authored ground is one decoded image. Sample the same world rectangle as actors and hit testing.
      const sx=this.image.naturalWidth/d.ww,sy=this.image.naturalHeight/d.wh;
      const groundHeight=Math.min(h,d.wh-cam[1]);
      if(groundHeight<h){ctx.fillStyle=this.theme.floor;ctx.fillRect(0,groundHeight,w,h-groundHeight);}
      ctx.drawImage(this.image,cam[0]*sx,cam[1]*sy,w*sx,groundHeight*sy,0,0,w,groundHeight);
    } else {
      ctx.fillStyle=this.floor(ctx);ctx.fillRect(0,0,w,h);
      if(this.image?.complete && this.image.naturalWidth)ctx.drawImage(this.image,-cam[0],-cam[1],d.ww,d.wh);
    }
    ctx.restore();
    return cam;
  }
}
Object.assign(window.AFK_DIMENSION_VIEW,{HuntingField,paintings,fieldDefinition:definition});
})();
