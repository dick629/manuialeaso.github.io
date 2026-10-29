// test-ui-fixes.mjs — 玩家 2026-10-29 19:35 的四項修正：
//   1. 有新版本時自動更新改成外掛開關（autoupdate，預設關）
//   2. 非官方橫幅右邊的 ✕（按了＝開 nobanner、先跳確認）；物品保護視窗讓開橫幅、返回鍵可關
//   3. 製作清單每列「成品能力」（craftinfo）
//   4. 畫面調整：拖過日誌高度後村莊／戰鬥畫面不溢出地圖面板
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    const out={};
    out.autoupdate=AFK_TOGGLES.enabled('autoupdate');
    out.autoupdateListed=AFK_TOGGLES.list?AFK_TOGGLES.list().some(t=>t.id==='autoupdate'):true;
    // 橫幅 ✕
    let b=document.getElementById('_orig_pbar');if(!b){b=document.createElement('div');b.id='_orig_pbar';document.body.appendChild(b);}
    b.textContent='非官方轉載版本・shines871';b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:11px 16px;font:bold 15px/1.5 sans-serif';
    AFK_BANNER.remeasure();
    __afkNoBanner.addCloseButton();
    const x=b.querySelector('.afk-pbar-x');out.x=!!x;if(!x)return out;
    __profile({cls:'knight',lv:60});
    // 物品保護視窗：讓開橫幅
    __afkItemGuard.open();
    const m=document.getElementById('afk-ig-modal');out.igTop=Math.round(m.getBoundingClientRect().top);out.bar=Math.round(AFK_BANNER.bottom());
    const d0=AFK_NAV.depth();m.querySelector('[data-ig-close]').click();out.igClosed=!document.getElementById('afk-ig-modal');out.navBack=AFK_NAV.depth()===d0-1;
    // ✕ → 開關＋確認視窗
    x.click();await new Promise(r=>setTimeout(r,100));
    out.nbOn=AFK_TOGGLES.enabled('nobanner');out.confirm=!!document.querySelector('#afk-confirm-modal:not(.hidden)');
    try{const c=document.querySelector('#afk-confirm-modal [data-act="cancel"],#afk-confirm-modal button.cancel,#afk-confirm-modal button:last-child');if(c)c.click();}catch(e){}
    // 製作清單
    const div=document.createElement('div');document.body.appendChild(div);
    const npc=Object.keys(CRAFT_RECIPES).find(k=>CRAFT_RECIPES[k].length>0);
    renderUniversalCraft(div,npc);
    const dets=div.querySelectorAll('.afk-craft-use');out.craft=dets.length>0&&dets.length===div.querySelectorAll('.tip-host[data-tip-craft]').length;
    out.craftBody=dets[0]&&dets[0].querySelector('.afk-craft-body').textContent.length>0;
    out.craftRow=!!div.querySelector('.list-item.afk-craft-row');
    div.remove();
    return out;
  });
  assert.equal(r.autoupdate,false,'有新版本時自動更新：預設關');assert.equal(r.autoupdateListed,true);
  assert.equal(r.x,true,'橫幅有 ✕');
  assert.ok(r.igTop>=r.bar-1&&r.bar>0,'物品保護視窗在橫幅下面 '+r.igTop+'/'+r.bar);assert.equal(r.igClosed,true);assert.equal(r.navBack,true);
  assert.equal(r.nbOn,true);assert.equal(r.confirm,true,'按 ✕ 先跳確認視窗');
  assert.equal(r.craft,true);assert.equal(r.craftBody,true);assert.equal(r.craftRow,true);
  assert.deepEqual(errors,[]);
  await close();
  // 畫面調整：日誌拉高後，村莊畫面不溢出
  const init=()=>{try{localStorage.setItem('afk_toggle_uiscale','1');}catch(e){}};
  const p2=await browser.page({context:{viewport:{width:1600,height:900}},init});
  await p2.page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r2=await p2.page.evaluate(async()=>{
    __profile({cls:'knight',lv:60});
    document.getElementById('creation-screen')?.classList.add('hidden');document.getElementById('game-screen').classList.remove('hidden');
    try{setMapSelectors('town_heine');changeMap(true);}catch(e){}
    __afkUiScale.set({scale:0.8,log:700});
    await new Promise(r=>setTimeout(r,300));
    const mp=document.getElementById('map-view-panel').getBoundingClientRect(),tv=document.getElementById('town-view'),t=tv.getBoundingClientRect();
    return {hidden:tv.classList.contains('hidden'),mapBottom:Math.round(mp.bottom),townBottom:Math.round(t.bottom),ov:getComputedStyle(document.getElementById('map-view-panel')).overflow};
  });
  assert.equal(r2.hidden,false);assert.ok(r2.townBottom<=r2.mapBottom+1,'村莊畫面不溢出 '+JSON.stringify(r2));assert.equal(r2.ov,'hidden');
  assert.deepEqual(p2.errors,[]);
  await p2.close();
  console.log('test-ui-fixes: ok');
}finally{await browser.close();}
