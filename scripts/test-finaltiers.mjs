// test-finaltiers.mjs — 終焉三階層：開放條件、HP ×1.25／×1.5625、名稱前綴、第三階層一次、獎勵（玩家 2026-10-29 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});state.running=true;
    window.AFK_UI=Object.assign({},window.AFK_UI||{},{confirm:o=>o.onOk()});
    const FT=__afkFinalTiers,FB=__afkFinalBoss,out={};
    const cnt=id=>player.inv.filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt||1),0);
    player.sherineMad=true;player.sherineDream=true;
    out.closed=FT.can(2);FT.OPEN=true;
    out.locked=FT.can(2);
    player.afkFinal={result:'win',pending:false};
    out.open=[FT.can(2),FT.can(3)];
    afkFinalTierEnter(2);
    out.mode=[state._afkFinal,FB.mode(),mapState.current===FB.MAP];
    try{spawnMob(1);}catch(e){out.sErr=String(e);}
    const m=mapState.mobs.find(x=>x&&x._afkFinal);
    out.boss=[m&&m.n,m&&Math.round(m.hp/(FB.cfg.hp*state._afkFinalScale)*100)/100];
    FB.finish('win');
    out.after2=[player.afkFinalTier.t2,cnt('afk_runebox_3'),FT.can(2),FT.can(3)];
    afkFinalTierEnter(3);
    out.t3=[FB.mode(),player.afkFinalTier.t3];
    try{spawnMob(1);}catch(e){}
    const m3=mapState.mobs.find(x=>x&&x._afkFinal);out.boss3=m3&&m3.n;
    FB.finish('win');
    out.after3=[player.afkFinalTier.t3,cnt('afk_fate_unlock'),FT.can(3)];
    // 中途重新整理：掛著的第二階層算失敗
    player.afkFinalTier={t2:null,t3:null,pending:'tier2'};state._afkFinal=false;
    try{tick();}catch(e){}
    out.pend=[player.afkFinalTier.pending,player.afkFinalTier.t2];
    // 初次輪迴：還沒轉生的人打第一階層，HP ×novice.hp、AC ×novice.def、傷害 ×novice.dmg
    state._afkFinal=false;player.rebirth=0;FB.startMode('first','');try{spawnMob(1);}catch(e){}
    const mf=mapState.mobs.find(x=>x&&x._afkFinal),N=FB.cfg.novice;
    out.novice=[mf&&Math.round(mf.hp/(FB.cfg.hp*state._afkFinalScale)*1000)/1000,mf&&mf.ac,Math.round(__afkTakenMods.reduce((k,f)=>k*f(player,mf),1)*100)/100,N.hp,Math.round(FB.cfg.ac*N.def),Math.round(N.dmg*(0.5+0.5*state._afkFinalScale)*100)/100];   // 傷害也看人數
    return out;
  });
  assert.equal(r.closed,'尚未開放');
  assert.ok(/第一階層/.test(r.locked),r.locked);
  assert.deepEqual(r.open,['','要先打贏第二階層「席琳幻影」']);
  assert.deepEqual(r.mode,[true,'tier2',true]);
  assert.deepEqual(r.boss,['席琳幻影 死亡女神 席琳',1.25],'第二階層 HP ×1.25 '+(r.sErr||''));
  assert.deepEqual(r.after2,['win',1,'已經打贏了','']);
  assert.deepEqual(r.t3,['tier3','lose'],'第三階層進場就算用掉');
  assert.equal(r.boss3,'席琳伴身 死亡女神 席琳');
  assert.deepEqual(r.after3,['win',1,'已經打贏了']);
  assert.deepEqual(r.pend,[null,'lose']);
  assert.deepEqual(r.novice.slice(0,3),r.novice.slice(3),'初次輪迴 '+JSON.stringify(r.novice));
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-finaltiers: ok');
}finally{await browser.close();}
