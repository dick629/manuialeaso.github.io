// test-hardin.mjs — 支線「知識與背叛」＋哈汀的時空＋歐林＋四色／哈汀之影重做（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const L=__afkLore,H=__afkHardin,B=L.boss,out={on:AFK_TOGGLES.enabled('lorehardin')};
    __profile({cls:'mage',lv:70});player.trialQ={};
    const line=H.line,k=i=>L.keyOf(line,i,'mage');out.ch=line.chapters.length;
    out.npc=DB.towns.town_ivory_tower.npcs.some(n=>n.id===H.NPC_ID);
    out.r3=TRIAL_Q[k(2)].rewards;out.r3k=TRIAL_Q[L.keyOf(line,2,'knight')].rewards;
    // 順序鎖
    trialQAccept(k(1),'afkLoreRender_hardin');out.lock=trialQState(k(1));
    // 第 2 章：巴風特真的掉封印的碎片
    player.trialQ[k(0)]=2;trialQAccept(k(1),'afkLoreRender_hardin');out.acc2=trialQState(k(1));
    mapState.current='zone_14';mapState.mobs=[null,null,null,null,null];
    const bp=B.place(0,DB.mobs.baphomet,{mobId:'baphomet'});bp.curHp=0;killMob(0);
    out.seal=player.inv.some(i=>i.id==='afk_q_hd_seal');
    // 套裝
    const md0=(recomputeStats(),player.d.magicDmg||0);
    H.SET.forEach((id,i)=>{const sl=['boots','belt','armor','cloak'][i];player.eq[sl]={id,uid:'H'+i,en:0,cnt:1};});
    recomputeStats();out.setMd=(player.d.magicDmg||0)-md0;out.setDmg=L.setBonus(player).extraDmg;
    // 四色
    out.semaAoe=DB.mobs.sema.mag2&&DB.mobs.sema.mag2.skn;
    mapState.current='zone_08';mapState.mobs=[null,null,null,null,null];
    const se=B.place(0,DB.mobs.sema,{mobId:'sema'}),ba=B.place(1,DB.mobs.batus,{mobId:'batus'}),ca=B.place(2,DB.mobs.casper,{mobId:'casper'});
    out.link=H.mod(player,se,1000,'melee');const spd0=se.atkSpd;
    ca.curHp=0;killMob(2);out.enr1=!!se._hdEnraged;
    ba.curHp=0;killMob(1);out.enr2=!!se._hdEnraged&&se.atkSpd<spd0;out.solo=H.mod(player,se,1000,'melee');
    // 哈汀之影 影分身
    mapState.current='hidden_seal_spirit';mapState.mobs=[null,null,null,null,null];
    const hs=B.place(0,DB.mobs.iv_hatin,{mobId:'iv_hatin'});hs.curHp=Math.floor(hs.hp*0.45);H.tick();
    const cl=mapState.mobs.find(m=>m&&m.afkHdClone);out.clone=!!cl&&cl.hp===Math.round(hs.hp*0.3);out.inv=H.mod(player,hs,1000,'magic');
    const ci=mapState.mobs.indexOf(cl);cl.curHp=0;killMob(ci);out.vuln=H.mod(player,hs,1000,'magic');
    // 歐林
    player.trialQ[k(3)]=2;player.afkHdOrin=0;mapState.current='zone_12';mapState.mobs=[null,null,null,null,null];
    const sv=DB.maps.zone_12;DB.maps.zone_12=sv.filter(id=>!DB.mobs[id].boss);spawnMob(0);DB.maps.zone_12=sv;
    const ori=mapState.mobs.find(m=>m&&m.afkHd==='orin');out.orin=!!ori;out.orinNext=Math.round((player.afkHdOrin-Date.now())/60000);
    if(ori){H.tick();state.ticks=ori._hdA;H.tick();ori.curHp=Math.floor(ori.hp*0.69);H.tick();out.wall=H.mod(player,ori,1000,'magic');
      const oi=mapState.mobs.indexOf(ori);const c0=player.inv.reduce((s,i)=>s+(i.id===AFK_TTMI_ITEMS.resolve(7102)?(i.cnt||1):0),0);ori.curHp=0;killMob(oi);
      out.orinPay=player.inv.reduce((s,i)=>s+(i.id===AFK_TTMI_ITEMS.resolve(7102)?(i.cnt||1):0),0)-c0;}
    // 副本
    out.noEnter=H.canEnter();
    player.trialQ[k(4)]=2;player.trialQ[k(5)]=2;trialQAccept(k(6),'afkLoreRender_hardin');
    player.allies=[1,2,3].map(i=>({cls:'knight',lv:70,curHp:3000,mhp:3000,mp:100,mmp:100,_allyName:'傭兵'+i,eq:{}}));
    out.enter=H.enter();out.map=mapState.current;const R=H.run();out.scale=R.scale;
    const fill=()=>{for(let i=0;i<5;i++)if(!mapState.mobs[i]||mapState.mobs[i]._dead)spawnMob(i);};
    const clear=()=>{let n=0;mapState.mobs.forEach((m,i)=>{if(m&&!m._dead&&m._hdRun&&m.curHp>0){m.curHp=0;killMob(i);n++;}});return n;};
    let guard=0;
    while(H.run().stage==='wave'&&guard++<200){fill();clear();}
    out.choiceStage=H.run().stage;out.wave6=H.run().wave;
    out.choose=H.choose('stop');out.wave7=H.run().wave;
    guard=0;while(H.run().stage==='wave'&&guard++<200){fill();clear();}
    out.bossStage=H.run().stage;fill();
    const sn=mapState.mobs.find(m=>m&&m.afkHd==='senis');out.senis=!!sn&&sn.hp===Math.round(DB.mobs.afk_hd_senis.hp*R.scale);
    const mhp0=player.mhp;sn.curHp=Math.floor(sn.hp*0.74);state.ticks=sn._hdA||state.ticks;H.tick();state.ticks=sn._hdA;H.tick();
    out.curse=H.run().curse;out.mhpCut=Math.round((1-player.mhp/mhp0)*100);out.charm=player.allies.some(a=>a._hdCharm>state.ticks);
    sn.curHp=Math.floor(sn.hp*0.29);H.tick();out.flyMelee=H.mod(player,sn,1000,'melee');out.flyMagic=H.mod(player,sn,1000,'magic');
    sn.curHp=0;killMob(mapState.mobs.indexOf(sn));
    out.hardinStage=H.run().stage;fill();
    const hd=mapState.mobs.find(m=>m&&m.afkHd==='hardin');out.hardin=!!hd&&hd.hp===Math.round(90000*R.scale);
    hd.curHp=Math.floor(hd.hp*0.74);H.tick();out.shadow=mapState.mobs.some(m=>m&&m.afkHdShadow&&!m._dead);out.shadowMod=H.mod(player,hd,1000,'magic');
    mapState.mobs.forEach((m,i)=>{if(m&&m.afkHdShadow){m.curHp=0;killMob(i);}});out.noShadowMod=H.mod(player,hd,1000,'magic');
    const hi=mapState.mobs.indexOf(hd);hd.curHp=0;killMob(hi);out.revive=!hd._dead&&Math.round(hd.curHp/hd.hp*100);
    hd.curHp=0;killMob(hi);out.done=H.run().stage;
    out.mark=player.inv.some(i=>i.id===H.MARK);out.tear=player.inv.some(i=>i.id==='afk_hd_tear');out.glass=player.inv.some(i=>i.id==='afk_q_hd_glass');
    trialQComplete(k(6),'afkLoreRender_hardin');out.tome=player.inv.some(i=>i.id==='afk_hd_tome');out.q7=trialQState(k(6));
    // 失控的巴風特
    mapState.current='zone_14';mapState.mobs=[null,null,null,null,null];
    const fb=B.place(1,DB.mobs.afk_hd_baph,{mobId:'afk_hd_baph'});H.tick();fb.curHp=Math.floor(fb.hp*0.49);state.ticks=fb._hdA;H.tick();
    out.rage=H.mod(player,fb,1000,'melee');out.skel=mapState.mobs.filter(m=>m&&m.n==='魔界的骷髏').length;
    // 喬：交換、面板
    gainItem(H.MARK,6,true);out.ex=H.exchange('tome');out.tome2=player.inv.filter(i=>i.id==='afk_hd_tome').reduce((s,i)=>s+(i.cnt||1),0);out.markLeft=player.inv.filter(i=>i.id===H.MARK).reduce((s,i)=>s+(i.cnt||1),0);
    const div=document.getElementById('interaction-content')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'interaction-content'}));
    H.renderJoe(div);out.ui=/知識與背叛 1／7/.test(div.textContent)&&!!div.querySelector('#afk-hd-joe')&&/哈汀的時空/.test(div.textContent);
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.on,true);assert.equal(r.ch,7);assert.equal(r.npc,true);
  assert.deepEqual(r.r3,['afk_hd_belt','arm_57']);assert.deepEqual(r.r3k,['afk_hd_belt']);
  assert.equal(r.lock,0);assert.equal(r.acc2,1);assert.equal(r.seal,true,'巴風特 100% 掉封印的碎片');
  assert.equal(r.setMd,3,'長袍 1＋斗篷 1＋套裝 1：'+r.setMd);assert.equal(r.setDmg,2);
  assert.equal(r.semaAoe,'暴風之刃');assert.equal(r.link,800);assert.equal(r.enr1,false);assert.equal(r.enr2,true);assert.equal(r.solo,1000);
  assert.equal(r.clone,true);assert.equal(r.inv,0);assert.ok(r.vuln>0);
  assert.equal(r.orin,true);assert.equal(r.orinNext,30);assert.equal(r.wall,500);assert.ok(r.orinPay>=20);
  assert.match(r.noEnter,/第 7 章/);
  assert.equal(r.enter,true);assert.equal(r.map,'afk_hardin_time');assert.equal(r.scale,1.75);
  assert.equal(r.choiceStage,'choice');assert.equal(r.wave6,6);assert.equal(r.choose,true);assert.equal(r.wave7,7);
  assert.equal(r.bossStage,'boss');assert.equal(r.senis,true);
  assert.equal(r.curse,1);assert.equal(r.mhpCut,5);assert.equal(r.charm,true);
  assert.equal(r.flyMelee,0);assert.equal(r.flyMagic,1000);
  assert.equal(r.hardinStage,'hardin');assert.equal(r.hardin,true);
  assert.equal(r.shadow,true);assert.equal(r.shadowMod,500);assert.equal(r.noShadowMod,1000);
  assert.equal(r.revive,30);assert.equal(r.done,'done');
  assert.equal(r.mark,true);assert.equal(r.tear,true);assert.equal(r.glass,true);assert.equal(r.tome,true);assert.equal(r.q7,2);
  assert.equal(r.rage,1200);assert.equal(r.skel,3);
  assert.equal(r.ex,null);assert.equal(r.tome2,2,JSON.stringify(r.tome2));assert.equal(r.markLeft,1);assert.equal(r.ui,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-hardin: ok');
}finally{await browser.close();}
