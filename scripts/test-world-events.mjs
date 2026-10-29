// test-world-events.mjs — 世界事件第二批（玩家 2026-10-29 21:07）：血的誓約詛咒、暗殺軍團的刺殺令、魔族的獵龍隊、篡位者的懸賞
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const E=__afkWorldEvents,out={on:E.IDS.map(id=>AFK_TOGGLES.enabled(E.EV[id].tog))};
    const fresh=()=>{mapState.current='aden_field';mapState.mobs=[null,null,null,null,null];if(E.active())E.end('time');player.afkWe={cd:{},gap:0,stats:{}};player.afkKurtCd=Date.now()+1e9;};
    // 觸發條件
    __profile({cls:'knight',lv:60});fresh();
    out.can=E.IDS.map(id=>E.canTrigger(id));
    player.lv=29;out.lv29=E.canTrigger('senis');player.lv=60;
    // 一、血的誓約詛咒
    fresh();E.start('senis');const A=E.active();out.senis=!!A&&A.id==='senis';
    const boss=()=>mapState.mobs.find(m=>m&&m._weBoss&&!m._dead);
    out.medium=mapState.mobs.filter(m=>m&&m._weMedium).length;
    const mhp0=player.mhp;state.ticks=A.curseAt;E.step();out.curse=E.active().curse;recomputeStats();out.cut=Math.round((1-player.mhp/mhp0)*100);
    mapState.mobs.forEach((m,i)=>{if(m&&m._weMedium){m.curHp=0;killMob(i);}});E.step();out.lifted=E.active().curse===0&&player.mhp===mhp0;
    // 打倒頭目：戰利品袋
    const b=boss(),bi=mapState.mobs.indexOf(b);b.curHp=0;killMob(bi);out.bag=player.inv.some(i=>i.id===E.BAG);out.ended=!E.active();out.kills=E.stats('senis').kills;
    // 全域間隔：剛結束 10 分鐘內不再觸發
    out.gap=E.canTrigger('senis');
    // 二、暗殺軍團的刺殺令
    __profile({cls:'dark',lv:60});fresh();E.start('slayer');const s=boss();
    const mods=window.__afkTakenMods,mult=(e,m)=>mods.reduce((a,f)=>{const v=Number(f(e,m,'melee'));return v>=0&&isFinite(v)?a*v:a;},1);
    out.ambush=mult(player,s);out.ambush2=mult(player,s);
    state.ticks=E.active().stealthAt;E.step();out.stealth=E.mod(s,1000);
    state.ticks+=60;E.step();out.unstealth=E.mod(s,1000);
    s.curHp=Math.floor(s.hp*0.4);E.step();out.fled=!boss()&&E.active().fled;
    mapState.current='zone_08';mapState.mobs=[null,null,null,null,null];E.step();state.ticks=E.active().wait;E.step();out.back=!!boss()&&Math.round(boss().curHp/boss().hp*100);
    // 三、魔族的獵龍隊
    __profile({cls:'dragon',lv:60});fresh();E.start('dragon');
    const mem=mapState.mobs.find(m=>m&&m._weMinion);out.members=mapState.mobs.filter(m=>m&&m._weMinion).length;out.memMod=E.mod(mem,1000);
    state.ticks=E.active().callAt;E.step();out.call=mult(player,boss());
    const cap=boss();cap.curHp=0;killMob(mapState.mobs.indexOf(cap));out.squadGone=!mapState.mobs.some(m=>m&&m._weMinion&&!m._dead);
    // 四、篡位者的懸賞
    __profile({cls:'knight',lv:60});fresh();out.noCastle=E.canTrigger('kenn');
    const oc=window.castleOwnerCity;window.castleOwnerCity=()=>'giran';fresh();out.castle=E.canTrigger('kenn');
    E.start('kenn');const kc=boss();state.ticks=E.active().markAt;E.step();out.mark=!!E.active().mark;
    player.hp=player.mhp;state.ticks=E.active().mark.end;E.step();out.hit=Math.round((1-player.hp/player.mhp)*100);
    const g0=player.gold;kc.curHp=0;killMob(mapState.mobs.indexOf(kc));out.bounty=player.gold-g0;
    window.castleOwnerCity=oc;
    // 戰利品袋
    const bc=()=>player.inv.filter(i=>i.id===E.BAG).reduce((s,i)=>s+(i.cnt||1),0);gainItem(E.BAG,1,true,true);const b0=bc();useItem(player.inv.find(i=>i.id===E.BAG).uid);out.opened=bc()===b0-1;
    // 被追殺的人倒下＝失敗
    __profile({cls:'knight',lv:60});fresh();E.start('senis');player.dead=true;E.step();out.fail=!E.active()&&E.stats('senis').fails===1;player.dead=false;
    // 五、冰之女王「寒冬」：不挑職業；女王＋2 侍女；攻速 −40%（侍女在）→ −20%；凍傷
    __profile({cls:'elf',lv:60});fresh();out.winterCan=E.canTrigger('winter');recomputeStats();const as0=player.d.aspd;
    E.start('winter');out.maids=mapState.mobs.filter(m=>m&&m._weMaid).length;E.step();out.chill=E.chillMult();recomputeStats();out.aspd2=+(player.d.aspd/as0).toFixed(3);
    player.hp=player.mhp;state.ticks=E.active().frostAt;E.step();out.frost=Math.round((1-player.hp/player.mhp)*100);
    mapState.mobs.forEach((m,i)=>{if(m&&m._weMaid){m.curHp=0;killMob(i);}});E.step();out.chill1=E.chillMult();recomputeStats();out.aspd1=+(player.d.aspd/as0).toFixed(3);
    const q=boss();q.curHp=0;killMob(mapState.mobs.indexOf(q));recomputeStats();out.winterEnd=!E.active()&&+(player.d.aspd/as0).toFixed(3);
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepEqual(r.on,[true,true,true,true,true]);
  assert.deepEqual(r.can,[true,false,false,false,true],'騎士觸發賽尼斯（寒冬不挑職業）');assert.equal(r.lv29,false);
  assert.equal(r.senis,true);assert.equal(r.medium,2);assert.equal(r.curse,1);assert.equal(r.cut,5);assert.equal(r.lifted,true);
  assert.equal(r.bag,true);assert.equal(r.ended,true);assert.equal(r.kills,1);assert.equal(r.gap,false);
  assert.equal(r.ambush,2.5);assert.equal(r.ambush2,1);assert.equal(r.stealth,0);assert.equal(r.unstealth,1000);
  assert.equal(r.fled,true);assert.equal(r.back,40);
  assert.equal(r.members,3);assert.equal(r.memMod,200);assert.equal(r.call,1.5);assert.equal(r.squadGone,true);
  assert.equal(r.noCastle,false);assert.equal(r.castle,true);assert.equal(r.mark,true);assert.ok(r.hit>=25&&r.hit<=31,'懸賞令 '+r.hit);assert.ok(r.bounty>=60000);
  assert.equal(r.opened,true);assert.equal(r.fail,true);
  assert.equal(r.winterCan,true,'寒冬不挑職業');assert.equal(r.maids,2);assert.equal(r.chill,0.6);assert.equal(r.aspd2,1.667,'攻速 −40%');assert.equal(r.frost,4,'凍傷 4%');
  assert.equal(r.chill1,0.8);assert.equal(r.aspd1,1.25,'侍女倒下 −20%');assert.equal(r.winterEnd,1,'寒冬結束');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-world-events: ok');
}finally{await browser.close();}
