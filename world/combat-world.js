'use strict';
// The game tick and the world renderer resolve the same live objects. No combat copies.
window.GiranCombat = (() => {
  const game=document.getElementById('game-screen');
  let field=null, suspendedField=null;
  let pinned=null;
  const pending=new Map();
  function offline() {
    if(document.hidden || window.__afkOfflineNow?.())return true;
    // The running map keeps its positions when the visible tab catches up after a slow frame.
    if(typeof _ffAcc!=='undefined' && _ffAcc?.spatial)return false;
    return state.ff || (typeof catchupActive==='function' && catchupActive());
  }
  function inWorld() {
    return document.documentElement.dataset.playMode!=='dimension' && typeof state==='object' && typeof mapState==='object' && !!mapState.current &&
      !mapState.current.startsWith('town_') && !offline() && !game.classList.contains('hidden');
  }
  function attach(value,paused=null) { field=value; suspendedField=paused; pending.clear(); }
  function earthRaid(){
    if(document.documentElement.dataset.playMode==='dimension')return false;
    const key=mapState.current;
    return !!state.antharas && (key==='antharas_lair'||key?.startsWith('antharas_nest_')) ||
      key==='afk_riftdg' && !!window.__afkRiftDg?.earthField?.(window.__afkRiftDg.run());
  }
  function usesBow(who) {
    const w=DB.items[who?.eq?.wpn?.id];
    return !!(w?.isBow || w?.animFam==='bow' || who?.ranged || (!who?.cls && /弓箭手|弓箭兵|弓手|弓兵|神射手|弩手|弩兵|弓騎兵/.test(who?.n||'')));
  }
  function reach(who,mode) {
    if(mode==='magic')return 7;
    if(mode==='ranged')return 6;
    // A mercenary mage's ordinary attack in giranAllyImpact is a magic bolt.
    if(who?.cls==='mage' && player?.allies?.includes(who))return 7;
    const gear=who?.eq?.wpn?.id, w=gear && DB.items[gear];
    if (usesBow(who) || who?.range>=4) return 6;
    if (w?.animFam==='spear' || (w?.n && /長矛|長槍|騎士長槍/.test(w.n))) return 2;
    return 1;
  }
  function point(who) { return field?.point(who); }
  function permits(who,to,mode) {
    if(to&&mapState.mobs.includes(to)){
      if(window.GiranRoam?.manual()){
        const selected=GiranRoam.locked();
        if(!inWorld()||!selected||(to!==selected&&to!==window.__afkHardin?.protectingClone?.(selected)))return false;
      }else if(player.giranHunt&&!GiranHunt.allows(to))return false;
    }
    return onTerrain(who,to,mode);
  }
  function onTerrain(who,to,mode){
    if(!GiranPartyView.canFight(who)||!GiranPartyView.canFight(to))return false;
    const live=inWorld();
    if(!live && !earthRaid())return true;
    const positionField=live?field:field||suspendedField;
    if (!positionField?.ready() || !who || !to || positionField.hold(who) || who._downed || who.dead || to._dead || to._downed) return false;
    return GiranGeometry.canHit(positionField.terrain.world,positionField.point(who),positionField.point(to),reach(who,mode));
  }
  function target(who,preferred,mode) {
    if(!GiranPartyView.canFight(who))return null;
    if(window.GiranRoam?.manual()){
      const choice=inWorld()?GiranRoam.locked():null;
      return choice?(window.__afkHardin?.protectingClone?.(choice)||choice):null;
    }
    if(!inWorld() || who===player) return preferred;
    if(!field?.ready()) return null;
    const boss=player.giranHunt?.bossFirst&&mapState.mobs[mapState.targetIdx];
    if(boss?.boss&&!boss._dead&&boss.curHp>0&&GiranHunt.allows(boss))return boss;
    if(permits(who,preferred,mode))return preferred;
    const from=point(who),world=field.terrain.world;
    if(!from || field.hold(who) || who?._downed || who?.dead)return null;
    const range=reach(who,mode);
    let nearest=null,best=Infinity;
    for(const mob of mapState.mobs) {
      if(!mob || mob._dead || mob._downed || mob.curHp<=0)continue;
      const pos=point(mob);if(!pos)continue;
      const d=GiranGeometry.distance(from,pos);
      if(d>=best||d>range+(range<=2?(from.footprint||0)+(pos.footprint||0):0))continue;
      if(player.giranHunt && !GiranHunt.allows(mob))continue;
      if(GiranGeometry.visible(world,from,pos,range>2)){best=d;nearest=mob;}
    }
    return nearest;
  }
  function bind(to,fn) {
    const mobs=mapState.mobs,impactSlot=mobs.indexOf(to);
    if(impactSlot<0)return;
    const previous=pinned,selection=mapState.targetIdx,focus=mobs[selection];
    pinned=to;mapState.targetIdx=impactSlot;
    try{return fn();}
    finally{
      pinned=previous;
      if(mobs===mapState.mobs&&selection!==impactSlot){
        if(selection<0 || (focus&&mobs[selection]===focus&&!focus._dead&&focus.curHp>0))mapState.targetIdx=selection;
        else if(mapState.targetIdx===impactSlot)mapState.targetIdx=-1;
      }
    }
  }
  // Arm a single strike per actor. Native cooldowns, rolls, loot, and experience run once at contact.
  function strike(who,aim,perform,label) {
    if(!GiranPartyView.canFight(who))return;
    if(!inWorld()){
      if(window.GiranRoam?.manual())return;
      if(!earthRaid())return perform();
      if(aim&&permits(who,aim,'basic'))return bind(aim,perform);
      return;
    }
    if(pending.has(who))return;
    const victim=target(who,aim,'basic');
    if(!victim || !permits(who,victim,'basic'))return;
    const origin=field, key=mapState.current;
    const a=point(who),b=point(victim);
    const dist=GiranGeometry.distance(a,b);
    const heading=GiranGeometry.directions.findIndex(([x,y])=>x===Math.sign(b.x-a.x)&&y===Math.sign(b.y-a.y));
    if(heading>=0){a.heading=heading;who._faceD=heading;}
    window.__dimMapNative?.(who,label,victim,'basic');
    pending.set(who,{victim,origin,key,perform,ally:player.allies?.includes(who),land:performance.now()+Math.min(450,145+dist*34)});
  }
  function update(now) {
    for(const [who,hit] of pending) {
      if(hit.land>now)continue;
      pending.delete(who);
      if(hit.origin!==field || hit.key!==mapState.current || !state.running || (hit.ally&&!GiranPartyView.combatAllies().includes(who)) || !mapState.mobs.includes(hit.victim) ||
         hit.victim.curHp<=0 || !permits(who,hit.victim,'basic'))continue;
      bind(hit.victim,hit.perform);
    }
  }
  const exploring=()=>field?.map===mapState.current && !offline() && (!!field.commanded || !!window.GiranRoam?.manual());
  return {exploring,attach,point,reach,usesBow,permits,onTerrain,target,strike,update,bind,get pinned(){return pinned;},get field(){return field;},get suspendedField(){return suspendedField;},inWorld,offline};
})();
