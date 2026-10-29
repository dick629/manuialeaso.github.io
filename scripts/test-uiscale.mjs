// test-uiscale.mjs — 畫面調整（外掛開關，預設關）：開啟後整體 80%、左右欄拖曳線、設定記在本機（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const off=await browser.page();
  const r0=await off.page.evaluate(()=>({on:AFK_TOGGLES.enabled('uiscale'),gut:document.querySelectorAll('.afk-ui-gutter').length,zoom:document.getElementById('app-stage').style.zoom}));
  assert.deepEqual(r0,{on:false,gut:0,zoom:''},'預設關');
  await off.close();
  const {page,errors,close}=await browser.page({context:{viewport:{width:1600,height:900}},init:()=>{try{localStorage.setItem('afk_toggle_uiscale','1');}catch(e){}}});
  const r=await page.evaluate(()=>{
    const s=document.getElementById('app-stage'),out={zoom:s.style.zoom,gut:document.querySelectorAll('.afk-ui-gutter').length};
    __afkUiScale.set({scale:0.7,left:300});out.after=[s.style.zoom,document.getElementById('col-left').style.width];
    out.saved=JSON.parse(localStorage.getItem('afk_uiscale_v1'));
    return out;
  });
  assert.equal(r.zoom,'0.8');assert.equal(r.gut,2);
  assert.deepEqual(r.after,['0.7','300px']);
  assert.equal(r.saved.scale,0.7);assert.equal(r.saved.left,300);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-uiscale: ok');
}finally{await browser.close();}
