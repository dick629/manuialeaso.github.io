// test-hama-bian.mjs — 哈瑪大師面板比照艾格尼絲（分類、搜尋、選取、服務列）；+15 遺物武器的屬性卷軸搬到象牙塔碧恩（玩家 2026-10-29 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});state.ff=false;
    const A=__afkRelicPlus,out={};
    const base=Object.keys(DB.items).find(id=>{const d=DB.items[id];return d&&isRelic(d)&&d.type==='wpn'&&!d.gmOnly&&!/~/.test(id)&&A.ensure(A.makeId(id,15,null));});
    const wid=A.makeId(base,15,null);player.eq.wpn={id:wid,uid:uid(),cnt:1,en:0,lock:false};
    const acc=Object.keys(DB.items).find(id=>{const d=DB.items[id];return d&&isRelic(d)&&d.type==='acc'&&!d.gmOnly&&!/~/.test(id);});
    player.inv.push({id:acc,uid:'acc-1',cnt:3,en:0,lock:false});
    gainItem('scroll_attr_fire',10,true,true);
    document.getElementById('town-view').classList.remove('hidden');
    // 碧恩
    interactNPC('npc_bian','town_ivory_tower');
    const c=document.getElementById('interaction-content');
    out.bian=[!!c.querySelector('#rp-bian'),c.querySelectorAll('#rp-bian [data-autostar]').length];
    const sc=()=>player.inv.filter(x=>x.id==='scroll_attr_fire').reduce((n,x)=>n+(x.cnt||1),0);
    const s0=sc();doBianAttr('wpn','fire');out.used=s0-sc();
    out.bianDesc=DB.towns.town_ivory_tower.npcs.find(n=>n.id==='npc_bian').d.includes('遺物武器');
    // 哈瑪
    interactNPC('npc_hama','town_gludio');
    const box=document.getElementById('rp-modal');
    out.hama=[box.querySelectorAll('#rp-list [data-rpf]').length,box.querySelectorAll('#rp-tools .ax-row').length,!!box.querySelector('[data-autostar],[data-attr]'),!!box.querySelector('.rp-selcard .rp-go'),!!document.querySelector('#interaction-content #afk-lost-panel')||true];
    box.querySelector('[data-rpf="acc"]').click();
    out.acc=[...box.querySelectorAll('#rp-list [data-rppick]')].every(e=>DB.items[A.groups().find(g=>g.key===e.getAttribute('data-rppick')).base].type==='acc');
    box.querySelector('[data-rpf="all"]').click();
    const pick=box.querySelector('[data-rppick]');pick.click();
    out.sel=box.querySelector('.rp-selcard .rp-go').getAttribute('data-k')===pick.getAttribute('data-rppick')||box.querySelector('.rp-selcard .rp-go').disabled;
    // +11～+15 保底：每失敗 +2%，最高 50%，成功歸零
    pandoraAdjustSharedDiamonds(1e7);
    const pid=A.makeId(base,10,A.donorsFor(base)[0]);A.ensure(pid);player.inv.push({id:pid,uid:'pity-1',cnt:1,en:0,lock:false});
    const key=()=>A.groups().find(g=>g.base===base&&g.n===10&&!g.eqSlots.length).key;
    const rnd=Math.random;Math.random=()=>0.999;
    const r1=A.costOf(11,base).rate;A.upgrade(key());A.upgrade(key());const r2=A.costOf(11,base).rate;
    player.afkRelicPity[11]=30;const r3=A.costOf(11,base).rate;
    Math.random=()=>0;A.upgrade(key());Math.random=rnd;
    out.pity=[r1,Math.round(r2*100),r3,player.afkRelicPity[11],!!player.inv.find(x=>A.parseId(x.id)&&A.parseId(x.id).n===11)];
    return out;
  });
  assert.deepEqual(r.bian,[true,3],'碧恩有遺物武器一鍵衝星');
  assert.equal(r.used,1,'碧恩的屬性按鈕直接可用在 +15 遺物武器');
  assert.equal(r.bianDesc,true);
  assert.equal(r.hama[0],4,'分類 4 個');
  assert.equal(r.hama[1],5,'服務 5 列');
  assert.equal(r.hama[2],false,'哈瑪不再有屬性卷軸');
  assert.equal(r.hama[3],true,'選中那件有按鈕');
  assert.equal(r.acc,true,'飾品分類');
  assert.equal(r.sel,true);
  assert.deepEqual(r.pity,[0.1,14,0.5,0,true],'保底');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-hama-bian: ok');
}finally{await browser.close();}
