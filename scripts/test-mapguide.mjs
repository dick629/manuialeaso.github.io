// test-mapguide.mjs — 小百科「練功推薦」：各地圖幾等怪、建議 AC／魔防（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    __profile({cls:'knight',lv:45});
    AFK_WIKI_API.goto({tab:'mapguide'});await new Promise(r=>setTimeout(r,200));
    const body=document.getElementById('m-wiki-body'),tab=document.querySelector('#m-wiki-tabs .m-wiki-tab.on');
    const rows=[...body.querySelectorAll('.m-mg-row')];
    const cellsOf=row=>[row.querySelector('.m-mg-name b').innerText.trim(),...[...row.querySelectorAll('.m-mg-chip b')].map(b=>b.innerText.trim())];
    // 精靈墓穴（地之牙 Lv40 命中 43）手算
    const v='elf_grave',mobs=DB.maps[v].map(id=>DB.mobs[id]).filter(m=>m&&!m.boss&&!m.noAttack);
    const avg=Math.round(mobs.reduce((s,m)=>s+m.lv,0)/mobs.length),hard=mobs.reduce((a,m)=>(m.lv+(m.hit||0))>(a.lv+(a.hit||0))?m:a);
    const tr=body.querySelector('[data-mg="'+v+'"]');
    const avgs=rows.map(row=>Number((cellsOf(row)[2].match(/\d+/)||[0])[0]));
    return {tab:tab&&tab.textContent,n:rows.length,subs:body.querySelectorAll('.m-wiki-sub').length,
      row:tr?cellsOf(tr):null,expAc:[8-(hard.lv+(hard.hit||0)-avg),-10-(hard.lv+(hard.hit||0)-avg)],avg,
      sorted:avgs.every((x,i)=>!i||x>=avgs[i-1]),you:body.innerText.includes('Lv45')};
  });
  console.log(JSON.stringify(r));
  assert.equal(r.tab,'練功推薦');
  assert.ok(r.n>=80,'地圖數 '+r.n);assert.ok(r.subs>=4);assert.equal(r.sorted,true,'依平均等級排序');
  assert.ok(r.row,'精靈墓穴在表上');assert.equal(r.row[2],'Lv'+r.avg);assert.equal(r.row[3],r.expAc.join('／'),'建議 AC');
  assert.ok(/^\d+$/.test(r.row[4])&&Number(r.row[4])>0,'地之牙的地獄之牙比普攻痛 → 要魔防');
  assert.ok(/%/.test(r.row[5]),'你欄');assert.equal(r.you,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-mapguide: ok');
}finally{await browser.close();}
