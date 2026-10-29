// test-dropcap.mjs — 掉落種類下修 30%（玩家 2026-10-29）：擲中 n 種只給 round(n×0.7)；掉落表上 100% 的必掉不算，倍率疊上去的不算必掉；走核心補丁 68
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:80});
    const out={on:AFK_TOGGLES.enabled('dropcap')};
    const got=[],og=window.gainItem;window.gainItem=(id,n)=>{got.push(id);};
    const mk=n=>{const b=[];for(let i=0;i<n;i++)b.push(['x'+i,0.5,2]);return b;};
    out.keep=[1,2,3,4,5,10].map(n=>{got.length=0;__afkDropCap(mk(n),{});return got.length;});
    // 必掉：表上 100%；倍率疊到 300% 但表上 2% 的不算
    got.length=0;__afkDropCap([['must',1,100],['boost',3,2],['a',0.5,2],['b',0.5,2]],{});
    out.must=got.includes('must');out.total=got.length;
    window.gainItem=og;
    const ids=Object.keys(DB.items).filter(id=>DB.items[id].type==='etc'&&!DB.items[id].relic).slice(0,10);
    MOB_DROPS['掉落測試怪']=ids.map(id=>[id,99.9]);
    let seen=null;const oc=window.__afkDropCap;window.__afkDropCap=(b,m)=>{seen=b;return oc(b,m);};
    mapState.mobs=[{n:'掉落測試怪',lv:30,hp:10,curHp:0,exp:1,st:{},_dead:false},null,null,null,null];
    try{killMob(0);}catch(e){out.killErr=String(e);}
    window.__afkDropCap=oc;
    out.bag=seen?seen.filter(x=>ids.includes(x[0])).length:-1;out.base=seen&&seen[0]&&seen[0][2];
    out.inv=player.inv.filter(i=>ids.includes(i.id)).length;
    return out;
  });
  assert.equal(r.on,true);
  assert.deepEqual(r.keep,[1,1,2,3,4,7],'下修 30%');
  assert.ok(r.must);assert.equal(r.total,1+2,'必掉另給；倍率疊上去的 3 種只給 2 種');
  assert.equal(r.killErr,undefined);
  assert.ok(r.bag>=6,'killMob 擲中的都進袋子 '+r.bag);assert.equal(r.base,99.9,'袋子帶表上的基礎機率');
  assert.ok(r.inv<=7&&r.inv>=4,'實際只拿 7 成 '+r.inv);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-dropcap: ok');
}finally{await browser.close();}
