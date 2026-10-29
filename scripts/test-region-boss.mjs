// test-region-boss.mjs — 地區霸主＋特殊收藏（玩家 2026-10-30）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const B=__afkRegionBoss,out={n:B.LIST.length,toggle:AFK_TOGGLES.enabled('regionboss')};
    const fresh=(map)=>{mapState.current=map;mapState.mobs=[null,null,null,null,null];if(B.active())B.end('time');player.afkRb={cd:{},gap:0,stats:(player.afkRb&&player.afkRb.stats)||{}};if(window.__afkWorldEvents&&__afkWorldEvents.active())__afkWorldEvents.end('time');};
    const boss=()=>mapState.mobs.find(m=>m&&m._rbBoss&&!m._dead);
    __profile({cls:'knight',lv:40});
    // 每個地區都有可出現的地圖，霸主都有動畫
    out.regionsOk=B.LIST.filter(b=>MAP_REGIONS.find(x=>x.key===b.r).maps.some(m=>B.okMap(m.v))).length;
    out.anim=B.LIST.filter(b=>MOB_ANIM_NAMES.has(DB.mobs[b.id].n)).length;
    out.minions=B.LIST.filter(b=>!b.minion||Object.values(DB.mobs).some(m=>m.n===b.minion&&!m.boss)).length;
    // 觸發條件
    fresh('zone_08');out.can=B.canTrigger('zone_08');out.town=B.canTrigger('town_gludin');
    player.lv=10;out.lowLv=B.canTrigger('zone_08');player.lv=40;
    // 出現：古魯丁（召喚＋狂暴）
    fresh('zone_08');out.start=B.start('gludin');const A=B.active();
    const b=boss();out.L=b&&b._rbL;out.lvOk=b&&b.lv===B.levelFor('zone_08');
    out.cd=B.canTrigger('zone_08');   // 進行中＝不再出
    state.ticks=A.summonAt;B.step();out.summoned=mapState.mobs.filter(m=>m&&m._rbMinion).length;
    b.curHp=Math.floor(b.hp*0.25);const spd=b.atkSpd;B.step();out.enrage=b._rbEnraged&&+(spd/b.atkSpd).toFixed(2);
    const mods=window.__afkTakenMods;out.enrMult=mods.reduce((a,f)=>{const v=Number(f(player,b,'melee'));return v>=0&&isFinite(v)?a*v:a;},1);
    // 打倒：寶箱＋證明＋紀錄；手下一起退場
    const bi=mapState.mobs.indexOf(b);b.curHp=0;killMob(bi);
    out.box=player.inv.some(i=>i.id===B.BOX);out.trophy=player.inv.some(i=>i.id===B.BY.gludin.trophyId);out.kills=B.stats('gludin').kills;out.ended=!B.active();
    out.minionGone=!mapState.mobs.some(m=>m&&m._rbMinion&&!m._dead);
    out.gap=B.canTrigger('kent');
    // 換地圖＝回巢穴
    fresh('zone_03');B.start('oren');mapState.current='zone_02';B.step();out.leave=!B.active();
    // 屏障：海音（魔法屏障＋震地）；粉碎能量打破
    fresh('heine');B.start('heine');const h=boss();const H=B.active();
    state.ticks=H.shieldAt;B.step();out.shield=h._reflectWall&&h._reflectWall.kind+'/'+h._reflectWall.block;
    const hp0=h.curHp;reflectWallOnDamage(h,0,'magic',null);h.curHp-=500;reflectWallOnDamage(h,500,'magic',null);out.blocked=h.curHp===hp0;
    if(window.__afkCrushBreak)out.crush=__afkCrushBreak(h,'你')&&!h._reflectWall;
    player.hp=player.mhp;state.ticks=H.quakeAt;B.step();out.quake=Math.round((1-player.hp/player.mhp)*100);
    // 傲慢之塔：魔法、物理屏障輪流
    fresh('pride_21_30');B.start('tower');const tw=boss(),TA=B.active();state.ticks=TA.shieldAt;B.step();const k1=tw._reflectWall.kind;state.ticks=TA.shieldAt;B.step();out.alt=k1+'/'+tw._reflectWall.kind;
    if(window.__afkFoulBreak){__afkFoulBreak('你');out.foul=!tw._reflectWall;}
    // 再生
    fresh('zone_01');B.start('fairyforest');const ff=boss(),FA=B.active();ff.curHp=Math.floor(ff.hp/2);const c0=ff.curHp;state.ticks=FA.regenAt;B.step();out.regen=ff.curHp-c0===Math.ceil(ff.hp*0.02);
    // 寶箱
    const bc=()=>player.inv.filter(i=>i.id===B.BOX).reduce((s,i)=>s+(i.cnt||1),0);const b0=bc();useItem(player.inv.find(i=>i.id===B.BOX).uid);out.opened=bc()===b0-1;
    B.end('time');
    // 特殊收藏
    collectionOpenSpecial();const ov=document.getElementById('afk-special-book');
    out.secs=[...ov.querySelectorAll('.afk-sc-sec summary b')].map(e=>e.textContent);
    out.got=ov.querySelectorAll('.afk-sc-tile.got').length;
    out.story=ov.querySelectorAll('.afk-sc-line').length;out.quests=ov.querySelectorAll('.afk-sc-q li').length;
    out.btn=!!document.getElementById('afk-coll-special');
    ov.querySelector('[data-close]').click();out.closed=!document.getElementById('afk-special-book');
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.n,15);assert.equal(r.toggle,true);
  assert.equal(r.regionsOk,15,'每個地區都有可出現的地圖');assert.equal(r.anim,15,'霸主都有動畫');assert.equal(r.minions,15,'手下都存在');
  assert.equal(r.can,'gludin');assert.equal(r.town,null);assert.equal(r.lowLv,null);
  assert.equal(r.start,true);assert.equal(r.lvOk,true);assert.equal(r.cd,null);
  assert.equal(r.summoned,2);assert.equal(r.enrage,1.5);assert.ok(Math.abs(r.enrMult-1.3)<1e-9);
  assert.equal(r.box,true);assert.equal(r.trophy,true);assert.equal(r.kills,1);assert.equal(r.ended,true);assert.equal(r.minionGone,true);
  assert.equal(r.gap,null,'剛結束 5 分鐘內不再出');
  assert.equal(r.leave,true);
  assert.equal(r.shield,'magic/true');assert.equal(r.blocked,true);assert.equal(r.crush,true,'粉碎能量打破魔法屏障');
  assert.equal(r.quake,6);assert.equal(r.alt,'magic/phys');assert.equal(r.foul,true,'污濁之水沖散物理屏障');
  assert.equal(r.regen,true);assert.equal(r.opened,true);
  assert.deepEqual(r.secs,['🌍 世界事件','👑 地區霸主','📜 劇情','📋 任務（職業試煉）','🏹 冒險者等級']);
  assert.ok(r.got>=1,'打倒過的霸主亮起');assert.ok(r.story>=3);assert.ok(r.quests>=3);assert.equal(r.btn,true);assert.equal(r.closed,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-region-boss: ok');
}finally{await browser.close();}
