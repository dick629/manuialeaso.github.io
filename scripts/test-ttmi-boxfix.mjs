// test-ttmi-boxfix.mjs — 嘯龍道具包開得出全部內容、包內消耗品古物商人有賣、低等怪不掉時空裂痕寶箱（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:30});const out={},T=window.AFK_TTMI_ITEMS;
    const box=Object.getOwnPropertyNames(DB.items).find(k=>DB.items[k]&&DB.items[k].n==='嘯龍道具包1');
    gainItem(box,1,true,true);const it=player.inv.find(x=>x.id===box);
    const before=player.inv.length;useItem(it.uid);
    out.kinds=player.inv.filter(x=>/^嘯龍/.test((DB.items[x.id]||{}).n||'')&&x.id!==box).length;
    const pot=Object.getOwnPropertyNames(DB.items).find(k=>DB.items[k]&&DB.items[k].n==='嘯龍慎重藥水');
    out.sold=!!((T.acquisition(pot)||{}).shop);
    const bad=[];const seen={};
    Object.keys(DB.mobs).forEach(k=>{const m=DB.mobs[k];if(!m||m.lv>=20||seen[m.n])return;seen[m.n]=1;(MOB_DROPS[m.n]||[]).forEach(e=>{const n=(DB.items[e[0]]||{}).n||'';if(/歐西里斯|庫庫爾坎|底比斯|提卡爾/.test(n))bad.push(m.n+':'+n);});});
    out.bad=bad;
    // 封印的克特套裝箱子：只在黑騎士團身上
    const kent=Object.getOwnPropertyNames(DB.items).find(k=>DB.items[k]&&DB.items[k].n==='封印的克特套裝箱子');
    out.kent=Object.keys(MOB_DROPS).filter(n=>(MOB_DROPS[n]||[]).some(e=>e[0]===kent)).every(n=>/黑騎士/.test(n));
    // 嘯龍道具包：古物商人有賣；0.1% 中獎的材料禮包價值超過售價 5 倍
    out.boxSold=((T.acquisition(box)||{}).shop||{}).price;
    const gid='afk_matgift_'+box;out.giftValue=DB.items[gid]&&DB.items[gid].giftValue;
    gainItem(gid,1,true,true);const before2=new Map(player.inv.map(x=>[x.id,x.cnt||1]));
    useItem(player.inv.find(x=>x.id===gid).uid);
    let val=0;player.inv.forEach(x=>{const d=DB.items[x.id];if(d&&d.ttmiMaterial){const dn=(x.cnt||1)-(before2.get(x.id)||0);if(dn>0)val+=dn*T.price(x.id);}});
    out.giftGot=val;out.giftGone=!player.inv.some(x=>x.id===gid);
    return out;
  });
  assert.equal(r.kinds,5,'嘯龍道具包1 開出 5 種');
  assert.equal(r.sold,true,'包內消耗品古物商人有賣');
  assert.deepEqual(r.bad,[],'低等怪不掉時空裂痕寶箱');
  assert.equal(r.kent,true,'克特套裝箱子只在黑騎士團');
  assert.ok(r.boxSold>0,'嘯龍道具包有賣');
  assert.equal(r.giftValue,Math.ceil(r.boxSold*5));
  assert.ok(r.giftGone&&r.giftGot>r.giftValue,'材料禮包價值超過 5 倍 '+r.giftGot+' / '+r.giftValue);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-ttmi-boxfix: ok');
}finally{await browser.close();}
