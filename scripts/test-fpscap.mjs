// test-fpscap.mjs — 畫面幀率上限（玩家 2026-10-29 23:44：固定 FPS 15／30／60，省電）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    const F=window.AFK_FPS,out={has:!!F,def:F.get(),on:AFK_TOGGLES.enabled('fpscap')};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    F._setHz(60);
    // 60 FPS 在 60Hz 螢幕上不做事
    F.set(60);out.active60=F.active();
    // 15 FPS：rAF 迴圈 1 秒只跑 ~15 次
    F.set(15);out.active15=F.active();
    let n=0,stop=false;const loop=()=>{n++;if(!stop)requestAnimationFrame(loop);};requestAnimationFrame(loop);await wait(1000);stop=true;out.raf=n;
    // CSS 無限動畫：被接手、時間會往前走
    const st=document.createElement('style');st.textContent='@keyframes afkT{from{opacity:1}to{opacity:.2}} .afkT{animation:afkT 1s infinite} .afkTr{transition:width .3s linear;width:10px}';document.head.appendChild(st);
    const el=document.createElement('div');el.className='afkT';el.textContent='x';document.body.appendChild(el);
    await wait(300);const a=el.getAnimations()[0];out.cssOwned=!!(a&&a.__afkFps)&&a.playState;const t1=a.currentTime;await wait(300);out.cssMoves=a.currentTime>t1;
    // Web Animations：照常結束（onfinish、finished 都會到）
    const w=document.createElement('div');document.body.appendChild(w);let fin=0;
    const wa=w.animate([{opacity:1},{opacity:0}],{duration:200});wa.onfinish=()=>fin++;const pf=wa.finished.then(()=>fin++);
    await wait(500);out.waapi=fin;
    // CSS 過場：transitionend 照常
    const tr=document.createElement('div');tr.className='afkTr';document.body.appendChild(tr);let te=0;tr.addEventListener('transitionend',()=>te++);
    await wait(50);tr.style.width='100px';await wait(700);out.trEnd=te;out.trW=Math.round(tr.getBoundingClientRect().width);
    // 不限制：全部還回去
    F.set(0);out.off=[F.active(),a.playState];
    n=0;stop=false;requestAnimationFrame(loop);await wait(500);stop=true;out.rafOff=n;
    // 省電模式面板
    AFK_POWERSAVE.open();const ov=document.getElementById('afk-ps-overlay');
    out.btns=[...ov.querySelectorAll('[data-psfps]')].map(b=>b.textContent);
    ov.querySelector('[data-psfps="30"]').click();out.click30=F.get();
    ov.querySelector('[data-preset="low"]').click();out.low=F.get();
    ov.querySelector('[data-preset="smooth"]').click();out.smooth=F.get();
    ov.querySelector('[data-preset="full"]').click();out.full=F.get();
    out.saved=localStorage.getItem('afk_ps_fps');
    document.getElementById('afk-ps-close').click();
    // 開著 15 FPS 跑一段戰鬥不會出錯
    F.set(15);__profile({cls:'knight',lv:60});state.running=true;state.ff=false;mapState.current='aden_field';
    for(let i=0;i<50;i++)tick();state.running=false;state.ff=true;F.set(0);
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.has,true);assert.equal(r.on,true);assert.equal(r.def,0,'預設不限制');
  assert.equal(r.active60,false,'60Hz 螢幕上 60 FPS 不做事');assert.equal(r.active15,true);
  assert.ok(r.raf>=10&&r.raf<=18,'rAF 一秒 ~15 次 '+r.raf);
  assert.equal(r.cssOwned,'paused','CSS 動畫被接手');assert.equal(r.cssMoves,true,'時間照樣往前');
  assert.equal(r.waapi,2,'onfinish、finished 都到');
  assert.equal(r.trEnd,1,'transitionend 照常');assert.equal(r.trW,100);
  assert.deepEqual(r.off,[false,'running'],'不限制＝還回去');assert.ok(r.rafOff>=20,'不限制 rAF 照原本 '+r.rafOff);
  assert.deepEqual(r.btns,['不限制','60','30','15']);
  assert.equal(r.click30,30);assert.equal(r.low,15);assert.equal(r.smooth,60);assert.equal(r.full,0);assert.equal(r.saved,'0');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-fpscap: ok');
}finally{await browser.close();}
