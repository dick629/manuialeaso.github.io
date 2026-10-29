// test-kurt-hunt.mjs — 世界事件「克特的追殺令」（玩家 2026-10-29）：Lv30+、隊伍有王族、每次出怪 5%、冷卻 15 分；地圖等級縮放；副本（含支配者傲慢之塔）不出現、
//   傲慢之塔會出現；跨地圖追殺、城鎮暫停、10 分鐘結束、王族倒下結束；黑魔法鎧、斬首宣告、黑騎士召集；獎勵與甘特兌換
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const K=__afkKurtHunt,out={on:AFK_TOGGLES.enabled('kurthunt')};
    out.maps=['talking_island_port','pride_51_60','zone_12','dom_tower_top','afk_traitor_whisper','rift_battle','town_giran','antaras_lair','training','pirate_wild'].map(m=>K.okMap(m));
    out.L=[K.levelFor('talking_island_port'),K.levelFor('dv_dungeon_7')];
    __profile({cls:'knight',lv:40});mapState.current='aden_field';player.afkKurtCd=0;
    out.noRoyal=K.canTrigger();
    __profile({cls:'royal',lv:29});mapState.current='aden_field';player.afkKurtCd=0;out.lv29=K.canTrigger();
    __profile({cls:'knight',lv:40});player.allies=[{cls:'royal',lv:40,curHp:500,mhp:500,_allyName:'王子傭兵',eq:{}}];mapState.current='aden_field';player.afkKurtCd=0;out.allyRoyal=K.canTrigger();
    __profile({cls:'royal',lv:45});mapState.current='aden_field';player.afkKurtCd=0;out.royal=K.canTrigger();
    // 出怪觸發（5%）
    let simNow=Date.now();const rn=Date.now;Date.now=()=>simNow;
    const or=Math.random;Math.random=()=>0.01;
    mapState.mobs=[null,null,null,null,null];mapState.forceBoss=false;const sv=DB.maps.aden_field;DB.maps.aden_field=sv.filter(id=>!DB.mobs[id].boss);Math.random=()=>0.01;spawnMob(0);Math.random=or;DB.maps.aden_field=sv;
    const k=mapState.mobs.find(m=>m&&m._afkKurt==='hunt');out.spawned=!!k;out.kL=k&&k._kurtL;out.cd=Math.round((player.afkKurtCd-Date.now())/60000);
    out.hunt=!!K.hunt();
    // 冷卻中不再觸發
    out.cdBlock=K.canTrigger();
    // 黑魔法鎧：魔法 −40%
    const C=AFK_CARD_COMBAT;out.magic=C.damage(player,k,1000,{kind:'magic'});out.melee=C.damage(player,k,1000,{kind:'melee'});
    k._armorBroken=true;out.meleeBroken=C.damage(player,k,1000,{kind:'melee'});k._armorBroken=false;
    // 受到的傷害：王族 ×1.3、紅獅王的守護 ×0.7
    const mods=window.__afkTakenMods;const mult=(e,m)=>mods.reduce((a,f)=>{const v=Number(f(e,m,'melee'));return v>=0&&isFinite(v)?a*v:a;},1);
    out.taken=Math.round(mult(player,k)*100);player.afkKurtGuardUntil=Date.now()+1e6;out.takenGuard=Math.round(mult(player,k)*100);player.afkKurtGuardUntil=0;
    // 換地圖：追過來、HP 保留
    k.curHp=Math.round(k.hp*0.8);state.ticks=10000;K.step();
    mapState.current='giant_tomb';mapState.mobs=[null,null,null,null,null];
    K.step();out.wait=K.hunt().wait>0;state.ticks+=500;K.step();
    const k2=mapState.mobs.find(m=>m&&m._afkKurt==='hunt');out.follow=!!k2;out.followHp=k2&&Math.round(k2.curHp/k2.hp*100);out.followL=k2&&k2._kurtL;
    // 城鎮暫停
    const left0=K.hunt().left;mapState.current='town_giran';for(let i=0;i<50;i++){state.ticks++;K.step();}out.paused=K.hunt().left===left0;
    mapState.current='giant_tomb';
    // 斬首宣告
    const h=K.hunt();h.markAt=state.ticks;const kk=mapState.mobs.find(m=>m&&m._afkKurt==='hunt');
    player.hp=player.mhp;for(let i=0;i<3&&!h.mark;i++){state.ticks++;K.step();}out.marked=!!h.mark;const hp0=player.hp;for(let i=0;i<55;i++){state.ticks++;K.step();}
    out.markDmg=hp0-player.hp>=Math.floor(player.mhp*0.2);
    h.markAt=state.ticks;player.hp=player.mhp;state.ticks++;K.step();kk.curHp-=Math.ceil(kk.hp*0.06);for(let i=0;i<55;i++){state.ticks++;K.step();}out.markBlocked=player.hp===player.mhp;
    // 黑騎士召集
    kk.curHp=Math.round(kk.hp*0.65);mapState.mobs=mapState.mobs.map(m=>m&&m._afkKurt?m:null);state.ticks++;K.step();
    out.minions=mapState.mobs.filter(m=>m&&m._afkKurtMinion).length;
    // 擊殺：獎勵
    const idx=mapState.mobs.indexOf(kk);kk.curHp=0;try{killMob(idx);}catch(e){out.killErr=String(e);}
    out.order=player.inv.filter(i=>i.id===K.ORDER).length;out.ended=!K.hunt();out.kills=K.stats().kills;
    // 時間到
    player.afkKurtCd=0;mapState.mobs=[null,null,null,null,null];K.start(0);K.hunt().left=2;state.ticks++;K.step();state.ticks++;K.step();out.timeEnd=!K.hunt();out.removed=!mapState.mobs.some(m=>m&&m._afkKurt);
    // 王族倒下
    player.afkKurtCd=0;K.start(1);player.dead=true;state.ticks++;K.step();out.royalEnd=!K.hunt();player.dead=false;
    // 甘特兌換
    gainItem(K.ORDER,60,true,true);out.ex=[K.exchange('scroll'),K.exchange('helm'),K.exchange('helm')];
    out.got=[player.inv.some(i=>i.id===K.SCROLL),player.inv.some(i=>i.id===K.HELM),DB.items[K.HELM].req];
    // 卷軸
    const sc=player.inv.find(i=>i.id===K.SCROLL);useItem(sc.uid);out.guard=player.afkKurtGuardUntil>Date.now();
    Date.now=rn;
    return out;
  });
  assert.equal(r.on,true);
  assert.deepEqual(r.maps,[true,true,true,false,false,false,false,false,false,true],'可出現的地圖');
  assert.deepEqual(r.L,[22,94]);
  assert.equal(r.noRoyal,false);assert.equal(r.lv29,false);assert.equal(r.allyRoyal,true);assert.equal(r.royal,true);
  assert.equal(r.spawned,true);assert.equal(r.kL,57);assert.equal(r.cd,15);assert.equal(r.hunt,true);assert.equal(r.cdBlock,false);
  assert.ok(Math.abs(r.magic/r.melee-0.6)<0.02,'魔法 −40% '+r.magic+'/'+r.melee);
  assert.ok(Math.abs(r.meleeBroken/r.melee-1.2)<0.02,'碎裂後物理 +20%');
  assert.equal(r.taken,130);assert.equal(r.takenGuard,91);
  assert.equal(r.wait,true);assert.equal(r.follow,true);assert.equal(r.followHp,80);assert.equal(r.followL,58);
  assert.equal(r.paused,true,'城鎮暫停');
  assert.equal(r.marked,true);assert.equal(r.markDmg,true,'斬首宣告');assert.equal(r.markBlocked,true,'打掉 5% 打斷');
  assert.equal(r.minions,2,'黑騎士召集');
  assert.equal(r.killErr,undefined);assert.equal(r.order,1);assert.equal(r.ended,true);assert.equal(r.kills,1);
  assert.equal(r.timeEnd,true);assert.equal(r.removed,true);assert.equal(r.royalEnd,true);
  assert.deepEqual([r.ex[0],r.ex[1],/50 張/.test(r.ex[2])],[null,null,true]);assert.deepEqual(r.got,[true,true,'royal']);
  assert.equal(r.guard,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-kurt-hunt: ok');
}finally{await browser.close();}
