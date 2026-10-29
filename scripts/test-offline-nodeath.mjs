// test-offline-nodeath.mjs — 外掛開關「離線掛機不會死亡」：離線結算期間 HP 歸零→回滿繼續；關掉＝照原本撞死即停（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const run=async(on)=>page.evaluate(async(on)=>{
    __profile({cls:'knight',lv:5});
    AFK_TOGGLES.set?AFK_TOGGLES.set('offlinenodeath',on):localStorage.setItem('afk_toggle_offlinenodeath',on?'1':'0');
    const en=AFK_TOGGLES.enabled('offlinenodeath');
    mapState.current='dragon_valley';mapState.mobs=[null,null,null,null,null];state.running=true;state.ff=false;
    player.hp=player.mhp=50;player.d.ac=10;
    await window.__afk.forceCatchup(3,true);
    for(let i=0;i<200&&window.__afk.busy();i++)await new Promise(r=>setTimeout(r,50));
    return {en,dead:!!player.dead||/^town_/.test(mapState.current),hp:player.hp,map:mapState.current};
  },on);
  const off=await run(false);
  const on=await run(true);
  assert.equal(on.en,true);assert.equal(on.dead,false,'開著不會死 '+JSON.stringify(on));
  assert.equal(off.en,false);assert.equal(off.dead,true,'關掉照原本會死 '+JSON.stringify(off));
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-offline-nodeath: ok');
}finally{await browser.close();}
