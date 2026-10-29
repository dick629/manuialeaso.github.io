// test-dropcap.mjs — 掉落種類上限（玩家 2026-10-29）：一般怪擲中的掉落隨機留 1～3 種、頭目 3～5 種；必掉（機率 ≥100%）不算；走核心補丁 68
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
    const bag=[['a',0.5],['b',0.5],['c',0.5],['d',0.5],['e',0.5],['f',0.5],['g',0.5],['must1',1],['must2',3]];
    const norm=[],boss=[];
    for(let k=0;k<200;k++){got.length=0;__afkDropCap(bag.slice(),{boss:false});norm.push(got.slice());got.length=0;__afkDropCap(bag.slice(),{boss:true});boss.push(got.slice());}
    window.gainItem=og;
    const rest=a=>a.filter(x=>!/^must/.test(x)).length;
    out.normal=[Math.min(...norm.map(rest)),Math.max(...norm.map(rest))];out.boss=[Math.min(...boss.map(rest)),Math.max(...boss.map(rest))];
    out.mustAlways=norm.concat(boss).every(a=>a.includes('must1')&&a.includes('must2'));
    out.noDup=norm.concat(boss).every(a=>new Set(a).size===a.length);
    // 核心補丁：killMob 擲中的掉落都進 __afkDropCap
    const ids=Object.keys(DB.items).filter(id=>DB.items[id].type==='etc'&&!DB.items[id].relic).slice(0,8);
    MOB_DROPS['掉落測試怪']=ids.map(id=>[id,99.9]);
    let seen=null;const oc=window.__afkDropCap;window.__afkDropCap=(b,m)=>{seen=b.map(x=>x[0]);return oc(b,m);};
    mapState.mobs=[{n:'掉落測試怪',lv:30,hp:10,curHp:0,exp:1,st:{},_dead:false},null,null,null,null];
    try{killMob(0);}catch(e){out.killErr=String(e);}
    window.__afkDropCap=oc;
    out.bag=seen?seen.filter(x=>ids.includes(x)).length:-1;
    out.inv=player.inv.filter(i=>ids.includes(i.id)).length;
    return out;
  });
  assert.equal(r.on,true);
  assert.deepEqual(r.normal,[1,3],'一般怪 1～3 種');
  assert.deepEqual(r.boss,[3,5],'頭目 3～5 種');
  assert.ok(r.mustAlways,'必掉不算上限');assert.ok(r.noDup);
  assert.equal(r.killErr,undefined);
  assert.ok(r.bag>=4,'killMob 擲中的都進袋子 '+r.bag);
  assert.ok(r.inv>=1&&r.inv<=3,'實際只拿 1～3 種 '+r.inv);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-dropcap: ok');
}finally{await browser.close();}
