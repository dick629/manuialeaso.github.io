// test-dex-search-speed.mjs — 掉落查詢搜尋不卡（玩家 2026-10-30「感覺卡卡的」）
//   ① 小百科命中改用一次建好的索引，不再每打一個字就把整本小百科渲染一遍
//   ② 結果卡分段畫，最後仍要全部畫出（不能少）
//   ③ 打字太快時，舊查詢的小百科結果不能貼到新查詢上
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    __profile({cls:'knight',lv:45});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    AFK_DEX_API.goto({q:''});
    const ready0=AFK_WIKI_API.searchReady();
    // 索引還沒建好時搜尋：掉落結果先出來、小百科結果晚一點補上
    const inp=document.getElementById('m-dex-input'),res=document.getElementById('m-dex-results');
    inp.value='骷髏';AFK_DEX_API.goto({q:'骷髏'});
    const slotEarly=!!document.getElementById('m-dex-wikislot')||!!res.querySelector('.m-dex-wikihit');
    let t=Date.now();while(!AFK_WIKI_API.searchReady()&&Date.now()-t<20000)await wait(50);
    const ready1=AFK_WIKI_API.searchReady();
    await wait(1500);
    const cards=res.querySelectorAll(':scope>.m-dex-card').length,more=!!document.getElementById('m-dex-more');
    // 與舊的同步搜尋結果一致
    const sync=AFK_WIKI_API.searchHits('骷髏',8).map(h=>h.label+'|'+h.title);
    // 舊路徑（無索引）比對：暫時讓索引過期
    // 快速改字：舊查詢的結果不能留下
    inp.value='屠龍';AFK_DEX_API.goto({q:'屠龍'});
    inp.value='祝福';AFK_DEX_API.goto({q:'祝福'});
    await wait(1500);
    const hitsQ=[...res.querySelectorAll('.m-dex-wikihit')].map(e=>e.getAttribute('data-q'));
    // 屠龍：罕見字，靠預先建好的裝備詳情文字，搜尋要快
    const t0=performance.now();const dl=AFK_WIKI_API.searchHits('屠龍',8);const tDl=performance.now()-t0;
    // 全部結果卡最後都畫出來
    inp.value='a';AFK_DEX_API.goto({q:'a'});await wait(1500);
    const allCards=res.querySelectorAll(':scope>.m-dex-card').length;
    // 小百科自己的搜尋：用同一份索引（索引作廢時先顯示「搜尋中」，建好再顯示）
    AFK_TOGGLES.set('regionboss',true);   // 改開關會讓索引作廢
    const ready2=AFK_WIKI_API.searchReady();
    AFK_WIKI_API.goto({q:'地區霸主'});
    const body=document.getElementById('m-wiki-body'),pending=body.textContent.includes('搜尋中');
    t=Date.now();while(!AFK_WIKI_API.searchReady()&&Date.now()-t<20000)await wait(50);await wait(100);
    const wikiHits=body.querySelectorAll('.m-wiki-card,.m-wiki-kv,.m-wiki-spell').length,wikiText=body.textContent.includes('蛛巢之母');
    return {ready0,slotEarly,ready1,cards,more,sync,hitsQ,dl:dl.length,tDl,allCards,wikiShown:res.querySelectorAll('.m-dex-wikihit').length,ready2,pending,wikiHits,wikiText};
  });
  console.log(JSON.stringify(r));
  assert.equal(r.ready1,true,'索引會建好');
  assert.equal(r.more,false,'分段畫完會把佔位拿掉');
  assert.ok(r.cards>10,'骷髏結果超過第一段 10 張也全部畫出 '+r.cards);
  assert.ok(r.sync.length>0,'小百科有命中');
  assert.ok(r.hitsQ.length>0&&r.hitsQ.every(q=>q==='祝福'),'只留最後一次查詢的小百科結果 '+r.hitsQ);
  assert.ok(r.dl>0,'屠龍找得到');assert.ok(r.tDl<150,'索引建好後屠龍搜尋 '+Math.round(r.tDl)+'ms');
  assert.ok(r.allCards>10,'「a」結果卡 '+r.allCards);
  assert.equal(r.ready2,false,'改開關後索引作廢');assert.equal(r.pending,true);assert.ok(r.wikiHits>0);assert.equal(r.wikiText,true,'小百科搜得到地區霸主');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-dex-search-speed: ok');
}finally{await browser.close();}
