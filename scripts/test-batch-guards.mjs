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
  assert.deepEqual(r.cap,['w_arms','w_arms','w_arms','w_arms',null,null,null],'同技藝最多 4 人');
  assert.equal(r.tune,0.01);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-batch-guards: ok');
}finally{await browser.close();}
