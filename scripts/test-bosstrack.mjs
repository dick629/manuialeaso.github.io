// test-bosstrack.mjs — 魔物追蹤 24 小時；BOSS 追蹤：遺物 1 件 8 小時、延長每次多 1 件、最多 24 小時；出怪改成追蹤頭目（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:60});window.confirm=()=>true;
    const B=__afkBossTrack,out={},H=3600000;
    const relics=Object.keys(DB.items).filter(k=>DB.items[k].relic&&!DB.items[k].gmOnly&&k.indexOf('~')<0).slice(0,8);
    relics.forEach(id=>gainItem(id,1,true,true));
    const relicN=()=>player.inv.filter(x=>DB.items[x.id]&&DB.items[x.id].relic).length;
    // 魔物追蹤 24 小時
    const maps=obelMapList();const m0=maps.find(x=>(DB.maps[x.v]||[]).some(id=>DB.mobs[id]&&!DB.mobs[id].boss));
    _obelSel={map:m0.v,mob:DB.maps[m0.v].find(id=>DB.mobs[id]&&!DB.mobs[id].boss)};player.gold=1e6;
    obelStartTracking();
    out.track=Math.round((player.tracking.until-Date.now())/H);
    // BOSS 追蹤
    const bm=maps.find(x=>(DB.maps[x.v]||[]).some(id=>DB.mobs[id]&&DB.mobs[id].boss)&&(DB.maps[x.v]||[]).some(id=>DB.mobs[id]&&!DB.mobs[id].boss));
    const boss=DB.maps[bm.v].find(id=>DB.mobs[id]&&DB.mobs[id].boss);
    const n0=relicN();
    afkBossTrackPick('map',bm.v);afkBossTrackPick('mob',boss);afkBossTrackStart();
    out.start=[n0-relicN(),Math.round((player.bossTracking.until-Date.now())/H)];
    afkBossTrackExtend();out.ext1=[n0-relicN(),Math.round((player.bossTracking.until-Date.now())/H),B.nextCost()];
    afkBossTrackExtend();out.ext2=[n0-relicN(),Math.round((player.bossTracking.until-Date.now())/H)];
    afkBossTrackExtend();out.ext3=[n0-relicN(),Math.round((player.bossTracking.until-Date.now())/H)];
    // 出怪
    mapState.current=bm.v;mapState.mobs=[null,null,null,null,null];
    const R=Math.random;Math.random=()=>0.1;
    try{spawnMob(0);}finally{Math.random=R;}
    out.spawn=[mapState.mobs[0]&&mapState.mobs[0].n,DB.mobs[boss].n,DB.maps[bm.v].filter(id=>DB.mobs[id]&&DB.mobs[id].boss).length,mapState.forceBoss];
    // 面板
    const div=document.createElement('div');renderObelNPC(div);out.panel=/BOSS 追蹤/.test(div.textContent);
    return out;
  });
  assert.equal(r.track,24,'魔物追蹤 24 小時');
  assert.deepEqual(r.start,[1,8]);
  assert.deepEqual(r.ext1,[3,16,3],'第一次延長 2 件');
  assert.deepEqual(r.ext2,[6,24],'第二次延長 3 件，到 24 小時');
  assert.deepEqual(r.ext3,[6,24],'超過 24 小時不能再延長');
  assert.equal(r.spawn[0],r.spawn[1],'出怪改成追蹤的頭目 '+JSON.stringify(r.spawn));
  assert.ok(!r.spawn[3]);
  assert.equal(r.panel,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-bosstrack: ok');
}finally{await browser.close();}
