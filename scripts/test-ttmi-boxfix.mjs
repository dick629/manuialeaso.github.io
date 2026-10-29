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
    out.bad=bad;return out;
  });
  assert.equal(r.kinds,5,'嘯龍道具包1 開出 5 種');
  assert.equal(r.sold,true,'包內消耗品古物商人有賣');
  assert.deepEqual(r.bad,[],'低等怪不掉時空裂痕寶箱');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-ttmi-boxfix: ok');
}finally{await browser.close();}
