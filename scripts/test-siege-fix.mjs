// test-siege-fix.mjs — 攻城回報（玩家 2026-10-30 00:34）：失去的城堡／空白地圖送回村莊、宣戰流程不卡、小百科七城說明一致
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  page.on('dialog',d=>d.accept());
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const out={};const C=window.__afkCastleWar;
    __profile({cls:'royal',lv:60});player.gold=1e8;mapState.current='town_talking';state.ff=false;
    const inp=document.createElement('input');inp.id='clan-name-input';inp.value='測試盟';document.body.appendChild(inp);clanCreateFromInput();
    // 宣戰：七座城都能點，點了就進外門區（不卡）
    clanOpenSiegePanel();out.buttons=[...document.querySelectorAll('button[data-castle]')].filter(b=>!b.disabled).length;
    const t=performance.now();document.querySelector('button[data-castle="orc_fortress"]').click();out.ms=Math.round(performance.now()-t);out.map=mapState.current;
    endSiege('win');out.win=mapState.current;out.held=C.held().slice().sort().join(',');
    // 失去那座城：人在城裡 → 送回村莊；之後要去那座城 → 改回村莊，不會變成空白地圖
    const d=C.data();d.castles=d.castles.filter(c=>c!=='orc_fortress');C.save(d);
    try{_clanWithLock(st=>{const info=st.modes[clanModeKey(player)];if(info)info.castle=null;return {};});rememberCastleOwnerCity(null);}catch(e){}
    window.__afkCastleWatch();out.kicked=mapState.current;
    setMapSelectors('town_orc_fortress_castle');changeMap(true);out.retry=mapState.current;
    // 空白地圖也會被救回來
    mapState.current='';window.__afkCastleWatch();out.blank=mapState.current;
    // 小百科：血盟分頁不再寫「一次一座／原本那座會自動放棄」
    AFK_WIKI_API.goto({tab:'pledge'});const txt=document.getElementById('m-wiki-body').innerText;
    out.wiki=[/七城攻城與統一天下/.test(txt),/原本那座會自動放棄/.test(txt),/持有數量/.test(txt)];
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.buttons,7,'七座城都能宣戰');assert.ok(r.ms<2000,'點了不卡 '+r.ms);assert.equal(r.map,'orc_fortress_outer');
  assert.equal(r.win,'town_orc_fortress_castle');assert.match(r.held,/orc_fortress/);
  assert.notEqual(r.kicked,'town_orc_fortress_castle','失去的城堡送回村莊');assert.ok(r.kicked&&!/castle/.test(r.kicked),r.kicked);
  assert.ok(r.retry&&r.retry!=='town_orc_fortress_castle','不會進入沒持有的城堡、也不是空白 '+r.retry);
  assert.ok(r.blank,'空白地圖救回來 '+r.blank);
  assert.deepEqual(r.wiki,[true,false,true],'小百科七城說明一致');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-siege-fix: ok');
}finally{await browser.close();}
