/* Pure, versioned progression rules. No storage or combat side effects. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LineageGrowthCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const directions={melee:'近戰',ranged:'遠攻',magic:'法術',defense:'守禦',support:'協律',minions:'馭靈',movement:'移動'};
  const sections={A:[5,1],B:[5,1],N1:[5,2],N2:[5,2],N3:[3,3],K:[1,5]};
  // One source for combat values and node tooltips. Enhanced nodes replace,
  // rather than add to, that node's ordinary grant. Existing node IDs stay valid.
  const smallNodes={
    melee:{A:[{meleeDirect:.5},{meleeDirect:3,meleeCritDmg:5}],B:[{meleeHit:1},{meleeHit:3,meleeCritDmg:5}],N1:[{meleeSkill:2},{meleeSkill:6,meleeCritDmg:5}],N2:[{meleeCrit:.5},{meleeCrit:1.5,meleeCritDmg:5}]},
    ranged:{A:[{rangedDirect:.5},{rangedDirect:3,rangedCritDmg:5}],B:[{rangedHit:1},{rangedHit:3,rangedCritDmg:5}],N1:[{rangedSkill:2},{rangedSkill:6,rangedCritDmg:5}],N2:[{rangedCrit:.5},{rangedCrit:1.5,rangedCritDmg:5}]},
    magic:{A:[{magicDirect:1},{magicDirect:3,magicCritDmg:5}],B:[{mp:1},{mp:3,mpRegen:2}],N1:[{magicSkill:2},{magicSkill:6,magicCritDmg:5}],N2:[{mpRegen:2},{mpRegen:6,mp:1}]},
    defense:{A:[{hp:1},{hp:3,mr:2}],B:[{mr:2},{mr:6,hp:1}],N1:[{normalReduction:.5},{normalReduction:1.5,mr:2}],N2:[{resist:2},{resist:6,hp:1}]},
    support:{A:[{healing:1.5},{healing:4.5,buffDuration:2}],B:[{buffDuration:2},{buffDuration:6,healing:1.5}],N1:[{buffPower:1},{buffPower:3,healing:1.5}],N2:[{healCost:1},{healCost:3,healing:1.5}]},
    minions:{A:[{petDamage:1.5},{petDamage:4.5,petHit:1}],B:[{petHp:2},{petHp:6,petHit:1}],N1:[{petHit:1},{petHit:3,petDamage:1.5}],N2:[{petAreaReduction:1},{petAreaReduction:3,petHp:2}]},
    movement:{A:[{speed:1},{speed:3,weight:2}],B:[{weight:2},{weight:6,speed:1}],N1:[{speed:2},{speed:6,weight:2}],N2:[{killSpeed:2},{killSpeed:6,weight:2}]}
  };
  const nodeLabels={meleeDirect:['近戰直接傷害','%'],rangedDirect:['遠攻直接傷害','%'],magicDirect:['法術直接傷害','%'],meleeSkill:['近戰攻擊技能傷害','%'],rangedSkill:['遠攻攻擊技能傷害','%'],magicSkill:['攻擊魔法傷害','%'],meleeHit:['近戰命中',''],rangedHit:['遠攻命中',''],meleeCrit:['近戰爆擊率',' 百分點'],rangedCrit:['遠攻爆擊率',' 百分點'],meleeCritDmg:['近戰爆擊傷害',' 百分點'],rangedCritDmg:['遠攻爆擊傷害',' 百分點'],magicCritDmg:['法術爆擊傷害',' 百分點'],hp:['HP 上限','%'],mp:['MP 上限','%'],mpRegen:['MP 自然恢復量','%'],mr:['魔防',''],resist:['火／水／風／地抗性各',''],normalReduction:['受到普攻傷害','%',true],healing:['自己施放的治療量','%'],buffDuration:['自己施放的增益持續時間','%'],buffPower:['自己施放的數值增益效果','%'],healCost:['治療技能 MP 成本','%',true],petDamage:['自己召喚物／寵物傷害','%'],petHp:['自己召喚物／寵物 HP','%'],petHit:['自己召喚物／寵物命中',''],petAreaReduction:['自己召喚物／寵物受到範圍傷害','%',true],speed:['移動速度','%'],weight:['負重上限','%'],killSpeed:['擊殺後 3 秒移速','%（重複擊殺只刷新時間）']};
  function enhanced(id){const n=node(id);return !!(n&&smallNodes[n.direction][n.section]&&n.index===(n.section==='A'||n.section==='B'?5:1));}
  function nodeEffects(id){const n=node(id),p=n&&smallNodes[n.direction][n.section];return p?{...p[enhanced(id)?1:0]}:{};}
  function nodeDescription(id){return Object.entries(nodeEffects(id)).map(([k,v])=>{const [label,unit,negative]=nodeLabels[k];return label+' '+(negative?'−':'+')+v+unit;}).join('、');}
  function talentEffects(t){const result={};for(const id of new Set(t.nodes))for(const[k,v]of Object.entries(nodeEffects(id)))result[k]=(result[k]||0)+v;return result;}
  const paragon={
    movement:{name:'移動',step:1.5,cap:150},trueDamage:{name:'真實傷害',step:.2,cap:15},trueDefense:{name:'真實減傷',step:.2,cap:15},
    hp:{name:'堅韌',step:.4,cap:15},mp:{name:'心智',step:.4,cap:15},physical:{name:'武勇',step:.2,cap:8},magic:{name:'秘法',step:.2,cap:8},
    companions:{name:'羈絆',step:.3,cap:15},healing:{name:'祝禱',step:.2,cap:15},curse:{name:'抑咒',step:.5,cap:Infinity}
  };
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function fresh(level){return {v:1,maxLevel:Math.max(1,Math.min(200,Math.floor(Number(level)||1))),unlocked:false,talent:{order:[],nodes:[],j:false},paragon:{level:0,xp:0,points:{}}};}
  function earned(g,rebirth){return Math.max(0,Math.min(100,g.maxLevel-100))+(rebirth>=1?15:0)+(rebirth>=2?20:0);}
  function reconcile(p){const g=p.growth||fresh(Math.max(Number(p.lv)||1,p.rebirth>=2?150:p.rebirth>=1?100:1));const candidate={...g,maxLevel:Math.max(g.maxLevel,Math.min(200,Math.floor(Number(p.lv)||1))),unlocked:!!g.unlocked||Number(p.lv)>=100};return valid(candidate,Number(p.rebirth)||0)?candidate:null;}
  function node(id){const m=/^(melee|ranged|magic|defense|support|minions|movement)\.(A|B|N1|N2|N3|K)\.([1-5])$/.exec(id);if(!m||+m[3]>sections[m[2]][0])return null;return {id,direction:m[1],section:m[2],index:+m[3],cost:sections[m[2]][1]};}
  function spent(t){return t.nodes.reduce((n,id)=>n+(node(id)||{cost:Infinity}).cost,0)+(t.j?3:0);}
  function complete(t,d,s){return Array.from({length:sections[s][0]},(_,i)=>`${d}.${s}.${i+1}`).every(id=>t.nodes.includes(id));}
  function canAdd(t,id){
    const n=node(id);if(!n||t.nodes.includes(id))return false;
    const pos=t.order.indexOf(n.direction);
    if(pos<0){if(t.order.length>=3||t.order.length&&!complete(t,t.order[t.order.length-1],'K'))return false;}
    if(pos>=0&&t.order.slice(0,pos).some(d=>!complete(t,d,'K')))return false;
    if(n.index>1&&!t.nodes.includes(`${n.direction}.${n.section}.${n.index-1}`))return false;
    const pre={N1:['A'],N2:['B'],N3:['A','B','N1','N2'],K:['N3']}[n.section]||[];
    return pre.every(s=>complete(t,n.direction,s));
  }
  function add(t,id){if(!canAdd(t,id))throw Error('尚未滿足前置節點');const out=copy(t),n=node(id);if(!out.order.includes(n.direction))out.order.push(n.direction);out.nodes.push(id);return out;}
  function validTalent(t){
    if(!t||!Array.isArray(t.order)||!Array.isArray(t.nodes)||typeof t.j!=='boolean'||new Set(t.order).size!==t.order.length||t.order.length>3)return false;
    let q={order:[],nodes:[],j:false};try{for(const id of t.nodes)q=add(q,id);}catch(e){return false;}
    return JSON.stringify(q.order)===JSON.stringify(t.order)&&(!t.j||t.order.length===3&&t.order.every(d=>complete(t,d,'K')));
  }
  function valid(g,rebirth){
    if(!g||g.v!==1||!integer(g.maxLevel)||g.maxLevel<1||g.maxLevel>200||!validTalent(g.talent)||spent(g.talent)>earned(g,rebirth))return false;
    const p=g.paragon;if(!p||!integer(p.level)||p.level>700||!Number.isFinite(p.xp)||p.xp<0||!p.points||Array.isArray(p.points))return false;
    return Object.keys(p.points).every(k=>paragon[k]&&integer(p.points[k])&&p.points[k]<=Math.min(700,Math.ceil(paragon[k].cap/paragon[k].step)))&&Object.values(p.points).reduce((a,b)=>a+b,0)<=p.level;
  }
  function value(g,k){const d=paragon[k];return d?Math.min(d.cap,(g.paragon.points[k]||0)*d.step):0;}
  function xpCost(rebirth,e100){if(!Number.isSafeInteger(e100)||e100<=0)throw Error('E100 無效');return e100*(rebirth>=2?3:2);}
  function gain(g,amount,rebirth,level,e100){
    if(rebirth<1||level<100||g.paragon.level>=700||!Number.isFinite(amount)||amount<=0)return 0;
    const cost=xpCost(rebirth,e100),p=g.paragon;const total=p.xp+amount;
    const n=Math.min(700-p.level,Math.floor(total/cost));p.level+=n;p.xp=p.level===700?0:total-n*cost;return n;
  }
  function trueAmount(weaponMax,primaryConverted,panelDamage,panelPrimary,rate){return Math.max(0,Math.floor((Math.max(0,weaponMax)+primaryConverted+(panelDamage-panelPrimary))*rate/100));}
  function movement(g){const t=g.talent,e=talentEffects(t),n=['movement.N3.1','movement.N3.2'].filter(id=>t.nodes.includes(id)).length;return {speed:(e.speed||0)+n*10+value(g,'movement'),weight:(e.weight||0)+n*3,shortcut:t.nodes.includes('movement.N3.3'),killSpeed:e.killSpeed||0,core:complete(t,'movement','K')};}
  function dayKey(now){return new Date(now+8*3600000).toISOString().slice(0,10);}
  function quota(saved,now){const day=dayKey(now);if(!saved)return {day,used:0};if(saved.day>day)throw Error('系統時間早於副本紀錄，請校正時間');if(saved.day!==day)return {day,used:0};if(!Number.isFinite(saved.used)||saved.used<0||saved.used>1800000)throw Error('副本時間紀錄異常');return {...saved};}
  return {directions,sections,paragon,fresh,earned,reconcile,node,spent,complete,canAdd,add,validTalent,valid,value,xpCost,gain,trueAmount,movement,dayKey,quota,copy,enhanced,nodeEffects,nodeDescription,talentEffects};
});
