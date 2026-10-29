// test-lore-main.mjs — 主線劇情「紅獅之誓」（玩家 2026-10-29）：甘特發派 7 章、照順序、指定怪 100% 掉任務道具、交付給獎勵、第一次另給、紅獅套裝；
//   通緝犯庫傑：每 30 分鐘、偷襲、煙霧彈、逃跑、懸賞金；小百科世界觀補全
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const L=__afkLore,out={on:AFK_TOGGLES.enabled('loremain')};
    __profile({cls:'royal',lv:60});player.trialQ={};
    const line=L.lines.redlion;out.ch=line.chapters.length;
    const k=i=>L.keyOf(line,i,'royal');
    // 順序鎖
    trialQAccept(k(1),'afkLoreRender_redlion');out.lock=trialQState(k(1));
    // 第 1 章：接取 → 打妖魔鬥士掉道具 → 交付
    trialQAccept(k(0),'afkLoreRender_redlion');out.acc=trialQState(k(0));
    out.active=trialItemActive('afk_q_lion_crest');
    gainItem('afk_q_lion_crest',5,true,true);trialQComplete(k(0),'afkLoreRender_redlion');
    out.done=trialQState(k(0));out.cloak=player.inv.some(i=>i.id==='afk_lion_cloak');out.firstScroll=player.inv.some(i=>i.id==='scroll_armor_b');
    out.drop=(MOB_DROPS['妖魔鬥士']||[]).some(x=>x[0]==='afk_q_lion_crest');
    // 第 7 章王族多一頂王冠
    out.r7=TRIAL_Q[k(6)].rewards;out.r7k=TRIAL_Q[L.keyOf(line,6,'knight')].rewards;
    // 套裝
    const hp0=(recomputeStats(),player.mhp);
    ['afk_lion_cloak','afk_lion_badge','afk_lion_gloves','afk_lion_ring'].forEach((id,i)=>{const sl=['cloak','amulet','gloves','ring1'][i];player.eq[sl]={id,uid:'S'+i,en:0,cnt:1};});
    recomputeStats();out.setHp=Math.round(player.mhp-hp0-80-100);out.setDmg=L.setBonus(player).extraDmg;
    // NPC 介面
    const div=document.getElementById('interaction-content')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'interaction-content'}));
    L.render(line,div);out.ui=!!div.querySelector('#afk-lore-redlion')&&/紅獅之誓 1／7/.test(div.textContent);
    // 庫傑
    const M=__afkLoreMain;player.afkKuze={next:0,map:'talking_island'};mapState.current='talking_island';mapState.mobs=[null,null,null,null,null];
    const sv=DB.maps.talking_island;DB.maps.talking_island=sv.filter(id=>!DB.mobs[id].boss);spawnMob(0);DB.maps.talking_island=sv;
    const kz=mapState.mobs.find(m=>m&&m.afkKuze);out.kuze=!!kz;out.next=Math.round((player.afkKuze.next-Date.now())/60000);
    // 偷襲
    const mods=window.__afkTakenMods,mult=(e,m)=>mods.reduce((a,f)=>{const v=Number(f(e,m,'melee'));return v>=0&&isFinite(v)?a*v:a;},1);
    out.ambush=mult(player,kz);state.ticks+=40;out.ambush2=mult(player,kz);
    // 煙霧彈
    const C=AFK_CARD_COMBAT;const d0=C.damage(player,kz,1000,{kind:'melee'});kz._kzSmokeAt=state.ticks;M.tick();out.smoke=C.damage(player,kz,1000,{kind:'melee'})/d0;
    // 逃跑 → 10 秒後回來、HP +10%
    kz.curHp=Math.floor(kz.hp*0.25);M.tick();out.fled=!mapState.mobs.some(m=>m&&m.afkKuze)&&!!M.away();
    state.ticks+=101;M.tick();const k2=mapState.mobs.find(m=>m&&m.afkKuze);out.back=!!k2&&Math.round(k2.curHp/k2.hp*100);
    // 懸賞金
    const g0=player.gold;const i2=mapState.mobs.indexOf(k2);k2.curHp=0;killMob(i2);out.bounty=player.gold-g0>=50000;
    return out;
  });
  assert.equal(r.on,true);assert.equal(r.ch,7);
  assert.equal(r.lock,0,'要照順序');assert.equal(r.acc,1);assert.equal(r.active,true);
  assert.equal(r.done,2);assert.equal(r.cloak,true);assert.equal(r.firstScroll,true);assert.equal(r.drop,true);
  assert.deepEqual(r.r7,['afk_lion_ring','afk_lion_crown']);assert.deepEqual(r.r7k,['afk_lion_ring']);
  assert.equal(r.setHp,140,'套裝 HP +60 +80');assert.equal(r.setDmg,2);
  assert.equal(r.ui,true);
  assert.equal(r.kuze,true);assert.equal(r.next,30);
  assert.equal(r.ambush,2);assert.equal(r.ambush2,1);
  assert.ok(Math.abs(r.smoke-0.7)<0.02,'煙霧彈 '+r.smoke);assert.equal(r.fled,true);assert.equal(r.back,35);assert.equal(r.bounty,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-lore-main: ok');
}finally{await browser.close();}
