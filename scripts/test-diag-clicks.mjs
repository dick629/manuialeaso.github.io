// test-diag-clicks.mjs — 快取診斷的「最近操作」（2026-10-30：卡死回報要能看到卡住前按了什麼）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    __profile({cls:'royal',lv:9});mapState.current='town_talking';
    const b=document.createElement('button');b.id='afk-test-btn';b.textContent='攻城';b.setAttribute('onclick','void 0');document.body.appendChild(b);b.click();
    const saved=JSON.parse(localStorage.getItem('afk_diag_clicks')||'[]');
    const it=(AFK_SETTINGS._items||[]).find(x=>/診斷/.test(x.label));it.onClick();
    await new Promise(r=>setTimeout(r,1500));
    const txt=(document.getElementById('m-diag-pre')||document.querySelector('#m-diag-modal pre, [id^=m-diag] pre')||document.body).innerText;
    return {n:saved.length,last:saved[saved.length-1],has:/最近操作/.test(txt)&&/#afk-test-btn 攻城/.test(txt)};
  });
  console.log(JSON.stringify(r));
  assert.ok(r.n>=1);assert.match(r.last.t,/#afk-test-btn 攻城/);assert.equal(r.last.m,'town_talking');assert.equal(r.has,true,'診斷面板有最近操作');
  assert.deepEqual(errors,[]);await close();console.log('test-diag-clicks: ok');
}finally{await browser.close();}
