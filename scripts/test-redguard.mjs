// test-redguard.mjs — 避免紅人持續追殺（玩家 2026-10-29）：席琳神殿「女神嘆息信徒 京」花 10 龍鑽或 100 萬金幣，正義值歸 0、追殺名單清空、密語尋仇作廢、追殺永久解除
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:30});
    const G=__afkRedGuard,out={on:AFK_TOGGLES.enabled('redguard')};
    out.npc=DB.towns.town_sherine.npcs.some(n=>n.id===G.NPC_ID&&n.n==='女神嘆息信徒 京');
    player.alignmentValue=-15000;player.gold=500000;
    pvpMarkForChase({n:'紅人甲',avatar:'男戰士',alignmentValue:-20000});pvpMarkForChase({n:'紅人乙',avatar:'男法師',alignmentValue:-20000});
    player.trollPlayers.push({n:'臨時白目',avatar:'男戰士',alignmentValue:0,until:Date.now()+3600e3});
    player.pvpKillWhispers=[{n:'紅人丙',awaitingRevenge:true,revengeCount:1,expiresAt:Date.now()+1e6}];
    out.before=G.chasers(player).length;
    out.poor=G.purify('gold');   // 錢不夠
    player.gold=2000000;
    out.ok=G.purify('gold');
    out.after=[player.alignmentValue,player.gold,G.chasers(player).length,player.pvpKillWhispers[0].awaitingRevenge,G.isProtected(player)];
    pvpMarkForChase({n:'紅人丁',avatar:'男戰士',alignmentValue:-20000});out.blocked=G.chasers(player).length;
    player.trollPlayers.push({n:'世界頻道記仇',avatar:'男戰士',noExpire:true,until:Number.MAX_SAFE_INTEGER});mapState.current='training';try{spawnMob(0);}catch(e){}
    out.swept=G.chasers(player).length;
    out.forever=player.afkRedGuardUntil===G.FOREVER;pvpMarkForChase({n:'紅人戊',avatar:'男戰士',alignmentValue:-20000});out.expired=G.chasers(player).length;
    // 龍鑽
    let d=50;window.pandoraGetSharedDiamonds=()=>d;window.pandoraAdjustSharedDiamonds=x=>{d+=x;return {ok:true,diamonds:d};};
    out.dia=[G.purify('dia'),d];
    // NPC 介面
    const div=document.createElement('div');document.body.appendChild(div);interactNPC&&0;
    return out;
  });
  assert.equal(r.on,true);assert.equal(r.npc,true);
  assert.equal(r.before,3);assert.ok(/金幣不夠/.test(r.poor));assert.equal(r.ok,null);
  assert.deepEqual(r.after,[0,1000000,0,false,true]);
  assert.equal(r.blocked,0,'保護期間不加追殺');assert.equal(r.swept,0,'出怪前清掉其他來源的追殺');
  assert.equal(r.forever,true);assert.equal(r.expired,0,'永久解除');
  assert.deepEqual(r.dia,[null,40]);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-redguard: ok');
}finally{await browser.close();}
