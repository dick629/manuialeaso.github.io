// test-batch-guards.mjs — 倉庫兩萬格、禮盒一次開多個、同技藝最多 4 人、時流暗殺者吸血 1%（玩家 2026-10-28 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    __profile({cls:'knight',lv:100});
    const out={wh:WH_MAX};
    // 禮盒：開 10 個／全部開啟
    const id=Object.keys(DB.items).find(k=>DB.items[k].n==='集中永恆禮盒');
    gainItem(id,30,true,true);
    let it=player.inv.find(x=>x.id===id);openModal(it,false);
    out.btns=[...document.querySelectorAll('[data-afk-bo]')].map(b=>b.textContent);
    const cnt=()=>player.inv.filter(x=>x.id===id).reduce((s,x)=>s+(x.cnt||1),0);
    afkBatchOpen(it.uid,10);
    await new Promise(r=>{const c=()=>cnt()<=20?r():setTimeout(c,20);c();});
    out.after10=cnt();
    it=player.inv.find(x=>x.id===id);afkBatchOpen(it.uid,it.cnt);
    await new Promise(r=>{const c=()=>cnt()===0?r():setTimeout(c,20);c();});
    out.afterAll=cnt();
    // 兌換券（修練者解咒卷軸 → 解除詛咒的卷軸）也能一次開；背包很大時每一段都很短、可以按停止（玩家 2026-10-29）
    const ex=Object.keys(DB.items).find(k=>DB.items[k].n==='修練者解咒卷軸'),res=DB.items[ex].ttmiResult;
    const eqId=Object.keys(DB.items).find(k=>DB.items[k].slot==='wpn'&&!DB.items[k].relic);
    for(let i=0;i<3000;i++)player.inv.push({id:eqId,en:0,uid:'fill'+i});
    gainItem(ex,400,true,true);const exN=()=>player.inv.filter(x=>x.id===ex).reduce((s,x)=>s+(x.cnt||1),0),resN=()=>player.inv.filter(x=>x.id===res).reduce((s,x)=>s+(x.cnt||1),0);
    const r0=resN();it=player.inv.find(x=>x.id===ex);openModal(it,false);out.exBtns=[...document.querySelectorAll('[data-afk-bo]')].map(b=>b.textContent);
    let gaps=[],last=performance.now();const iv=setInterval(()=>{const n=performance.now();gaps.push(n-last);last=n;},10);
    afkBatchOpen(it.uid,200);await new Promise(r=>setTimeout(r,30));out.stopBtn=document.querySelector('[data-afk-bo="10"]').textContent;out.locked=[...document.querySelectorAll('#modal-actions button')].filter(b=>!b.disabled).map(b=>b.textContent.trim());
    await new Promise(r=>{const c=()=>exN()<=200?r():setTimeout(c,20);c();});
    out.ex=[exN(),resN()-r0];
    it=player.inv.find(x=>x.id===ex);afkBatchOpen(it.uid,it.cnt);await new Promise(r=>setTimeout(r,60));afkBatchOpen.stop();
    await new Promise(r=>setTimeout(r,300));clearInterval(iv);out.stopped=exN()>0&&exN()<200;out.maxGap=Math.round(Math.max(...gaps));
    player.inv=player.inv.filter(x=>!String(x.uid).startsWith('fill'));
    // 同一門技藝最多 4 人
    player.rebirth=1;player.rebirthArt='w_arms';player.allies=[];
    for(let i=0;i<6;i++)player.allies.push({cls:'knight',rebirth:1,rebirthArt:'w_arms',_slot:String(200+i),curHp:100,mhp:100,d:{},buffs:{},statuses:{}});
    state.ticks=(state.ticks||0)+1;
    const A=window.__afkArts;out.cap=[player].concat(player.allies).map(x=>A.art(x));
    out.tune=window.__afkArtTune&&window.__afkArtTune.timeLeech;
    player.allies=[];
    return out;
  });
  assert.equal(r.wh,20000,'倉庫上限');
  assert.deepEqual(r.btns,['開 10 個','全部開啟（30）']);
  assert.equal(r.after10,20,'開 10 個');
  assert.equal(r.afterAll,0,'全部開啟');
  assert.deepEqual(r.exBtns,['開 10 個','全部開啟（400）'],'兌換券也有');assert.equal(r.stopBtn,'停止');assert.deepEqual(r.locked.filter(t=>!/關閉/.test(t)),['停止'],'開啟中只剩停止能按 '+r.locked.join('/'));
  assert.deepEqual(r.ex,[200,200],'兌換券開 200 張');assert.equal(r.stopped,true,'可以停止');assert.ok(r.maxGap<250,'不卡 '+r.maxGap);
  assert.deepEqual(r.cap,['w_arms','w_arms','w_arms','w_arms',null,null,null],'同技藝最多 4 人');
  assert.equal(r.tune,0.01);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-batch-guards: ok');
}finally{await browser.close();}
