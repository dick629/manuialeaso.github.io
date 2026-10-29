// test-uiscale.mjs — 畫面調整（外掛開關，預設關；只限電腦版）：只縮放遊戲畫面（選角畫面不變）、四條拖曳線（左右欄寬、地圖／日誌高、戰鬥日誌／世界頻道寬）、
//   設定記在本機、手機版不套用（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const off=await browser.page();
  const r0=await off.page.evaluate(()=>({on:AFK_TOGGLES.enabled('uiscale'),gut:document.querySelectorAll('.afk-ui-gutter').length,zoom:document.getElementById('game-screen').style.zoom}));
  assert.deepEqual(r0,{on:false,gut:0,zoom:''},'預設關');
  await off.close();
  const init=()=>{try{localStorage.setItem('afk_toggle_uiscale','1');}catch(e){}};
  const {page,errors,close}=await browser.page({context:{viewport:{width:1600,height:900}},init});
  const r=await page.evaluate(()=>{
    const gs=document.getElementById('game-screen'),out={zoom:gs.style.zoom,stage:document.getElementById('app-stage').style.zoom,cre:(document.getElementById('creation-screen')||{style:{}}).style.zoom||'',
      gut:[...document.querySelectorAll('.afk-ui-gutter')].map(g=>g.dataset.side)};
    __afkUiScale.set({scale:0.7,left:300,log:260,split:60});
    out.after=[gs.style.zoom,document.getElementById('col-left').style.width,document.getElementById('log-row').classList.contains('afk-ui-logh'),
      document.getElementById('map-view-panel').classList.contains('afk-ui-maph'),document.getElementById('combat-log-panel').classList.contains('afk-ui-split'),gs.style.getPropertyValue('--afk-ui-log'),gs.style.getPropertyValue('--afk-ui-split')];
    out.saved=JSON.parse(localStorage.getItem('afk_uiscale_v1'));
    return out;
  });
  assert.equal(r.zoom,'0.8');assert.equal(r.stage,'','不縮放整個舞台（選角畫面不變）');assert.equal(r.cre,'');
  assert.deepEqual(r.gut,['left','log','split','right']);
  assert.deepEqual(r.after,['0.7','300px',true,true,true,'260px','60%']);
  assert.equal(r.saved.scale,0.7);assert.equal(r.saved.left,300);assert.equal(r.saved.log,260);assert.equal(r.saved.split,60);
  assert.deepEqual(errors,[]);
  await close();
  // 手機寬度：什麼都不套用
  const mob=await browser.page({context:{viewport:{width:420,height:860}},init});
  const r2=await mob.page.evaluate(()=>({zoom:document.getElementById('game-screen').style.zoom,w:document.getElementById('col-left').style.width,
    shown:[...document.querySelectorAll('.afk-ui-gutter')].filter(g=>g.style.display!=='none').length,mobile:__afkUiScale.mobile()}));
  assert.deepEqual(r2,{zoom:'',w:'',shown:0,mobile:true},'手機版禁用');
  await mob.close();
  console.log('test-uiscale: ok');
}finally{await browser.close();}
