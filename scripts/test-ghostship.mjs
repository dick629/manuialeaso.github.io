// test-ghostship.mjs — 幽靈船出航（玩家 2026-10-29 21:36：每 30 分鐘一班）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    const G=__afkGhostShip,out={on:AFK_TOGGLES.enabled('ghostship')};
    let fake=new Date(2026,9,29,21,40,0).getTime();window.__afkGsNow=()=>fake;
    __profile({cls:'knight',lv:60});mapState.current='town_talking';
    out.npc=DB.towns.town_talking.npcs.some(n=>n.id===G.NPC_ID);
    // 21:40 不在靠岸時間（21:30～21:40 才能登船）
    out.closed=G.canBoard();out.next=new Date(G.nextDock()).getMinutes();
    fake=new Date(2026,9,29,22,3,0).getTime();out.dock=G.docked();
    // 狀態列徽章不能放進 #status-alerts（核心每個 tick 改寫它的文字 → 徽章被洗掉又加回，那一排一直抖；2026-10-29 22:37）
    state.ticks=1000;G.clock();const sa=document.getElementById('status-alerts');sa.innerText='[中毒]';sa.innerText='';
    const bd=document.getElementById('afk-gs-badge');out.badge=!!(bd&&bd.isConnected)&&bd.parentNode.id+'|'+/幽靈船靠岸/.test(bd.textContent);out.board=G.board();out.map=mapState.current;
    // 船員一直湧出
    for(let i=0;i<5;i++)spawnMob(i);out.crew=mapState.mobs.filter(m=>m&&m._gs).length;out.crewLv=mapState.mobs[0].lv;
    // 打倒 30 名 → 船長
    for(let k=0;k<30;k++){const i=k%5;if(!mapState.mobs[i]||mapState.mobs[i]._dead)spawnMob(i);mapState.mobs[i].curHp=0;killMob(i);mapState.mobs[i]=null;}
    out.kills=G.run().kills;spawnMob(0);const c=mapState.mobs[0];out.captain=!!(c&&c._gsCaptain)&&c.n;
    // 技能：召喚、沉船的詛咒
    state.ticks=G.run().callAt;G.clock();out.summon=mapState.mobs.filter(m=>m&&m._gsSummon).length;
    c.curHp=Math.floor(c.hp*0.4);G.clock();out.curse=G.run().curseOn;
    const g0=player.gold;c.curHp=0;killMob(0);out.capDown=G.run().captain===2;out.gold=player.gold-g0;out.stats=G.stats().captains;
    // 22:20 沉船 → 回說話之島
    fake=new Date(2026,9,29,22,20,5).getTime();G.clock();out.back=mapState.current;
    // 靠岸通知
    fake=new Date(2026,9,29,22,30,1).getTime();const msgs=[],oLog=window.logSys;window.logSys=h=>msgs.push(String(h));G.clock();window.logSys=oLog;out.note=msgs.some(h=>/幽靈船靠上了說話之島/.test(h));
    // NPC 視窗
    const div=document.createElement('div');document.body.appendChild(div);G.render(div);out.btn=!!div.querySelector('button[data-gs="board"]:not([disabled])');
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.on,true);assert.equal(r.npc,true);
  assert.match(r.closed,/還沒靠岸/);assert.equal(r.next,0);
  assert.equal(r.dock,true);assert.equal(r.badge,'afk-ev-badges|true','徽章在獨立容器、不會被洗掉');assert.equal(r.board,true);assert.equal(r.map,'afk_ghostship');
  assert.equal(r.crew,5);assert.equal(r.crewLv,60,'船員跟著你的等級');
  assert.equal(r.kills,30);assert.equal(r.captain,'幽靈船長');
  assert.equal(r.summon,2,'深海的召喚');assert.equal(r.curse,true,'沉船的詛咒');
  assert.equal(r.capDown,true);assert.ok(r.gold>=65*1500,'寶箱金幣 '+r.gold);assert.equal(r.stats,1);
  assert.equal(r.back,'town_talking','沉船回說話之島');
  assert.equal(r.note,true,'靠岸通知');assert.equal(r.btn,true,'可以登船');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-ghostship: ok');
}finally{await browser.close();}
