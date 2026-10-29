// test-dollaffix.mjs — 詞條娃娃合成（玩家 2026-10-29 20:11）：有詞條的娃娃不進一般合成；專區 2 個同階 → 5%、無保底、詞條隨機繼承回一階
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const A=__afkDollAffix,out={on:AFK_TOGGLES.enabled('dollaffix')};
    const t6=DOLL_BY_TIER[6];out.t6drops=Object.keys(MOB_DROPS).filter(n=>(MOB_DROPS[n]||[]).some(e=>t6.includes(e[0]))).length;out.t6synth=DOLL_SYNTH_RATES[5][2];
    __profile({cls:'royal',lv:80});
    const t4=DOLL_BY_TIER[4][0];
    const mk=(o)=>{const it=Object.assign({id:t4,uid:uid(),cnt:1,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false},o);player.inv.push(it);return it;};
    const plain=mk({cnt:2});
    const a=mk({cnt:1,bless:true,blessLv:3,anc:'eternal',ancLv:2,attr:'fr5'});
    const b=mk({cnt:1,bless:true,blessLv:2,attr:'wa4'});
    out.count4=dollTierCount(4);out.aff4=A.count(4);
    // 一般合成不吃有詞條的
    const saves=[];const oSave=window.saveGame;
    _dollRng=()=>0.99;dollSynth(4,2);
    out.affLeft=A.count(4);out.unlocked=player.inv.filter(i=>i.id===t4&&(i.bless||i.attr)).every(i=>!i.lock);
    // 專區：成功（_dollRng 0 → 5% 內）
    _dollRng=()=>0;const res=A.synth(4,false);
    out.ok=res&&res.ok;const got=res.made[0];out.gotTier=DB.items[got.id].dollTier;
    out.gotAff=[got.bless,got.blessLv||1,got.anc,got.ancLv||1,got.attr];
    out.affAfter=A.count(4);
    // 失敗：退還 1 個、詞條不變
    const c=mk({cnt:2,anc:'primordial',ancLv:3});
    _dollRng=()=>0.5;const r2=A.synth(4,false);
    out.fail=r2&&!r2.ok;const back=player.inv.find(i=>i.id===t4&&i.anc==='primordial');out.back=back&&[back.cnt,back.ancLv];
    // 屬性回一階
    out.t1=A.tier1Attr('fr5');out.t1b=A.tier1Attr('wa3');
    // 商人介面
    const div=document.createElement('div');div.id='interaction-content-test';document.body.appendChild(div);
    renderCardSynth(div);const sec=div.querySelector('#afk-dollaffix');out.ui=!!sec&&/詞條娃娃合成/.test(sec.textContent)&&/5%/.test(sec.textContent)&&/沒有保底/.test(sec.textContent);
    const kids=[...div.children];out.order=kids.indexOf(sec)>kids.findIndex(k=>/6 階重組/.test(k.textContent))&&kids.findIndex(k=>/6 階重組/.test(k.textContent))>=0;
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.on,true);
  assert.equal(r.t6drops,0,'六階娃娃不掉落');assert.ok(r.t6synth>0,'五階合成六階');
  assert.equal(r.count4,2,'一般合成只算沒有詞條的');assert.equal(r.aff4,2);
  assert.equal(r.affLeft,2,'一般合成不吃有詞條的');assert.equal(r.unlocked,true,'暫時鎖定有還原');
  assert.equal(r.ok,1);assert.equal(r.gotTier,5);
  assert.equal(r.gotAff[0],true);assert.equal(r.gotAff[1],1,'祝福回一階');assert.equal(r.gotAff[3],1,'遠古回一階');
  assert.ok(r.gotAff[4]==='fr1'||r.gotAff[4]==='wa1','屬性回一階 '+r.gotAff[4]);
  assert.equal(r.affAfter,0);
  assert.equal(r.fail,true);assert.deepEqual(r.back,[1,3],'失敗退還 1 個、詞條不變');
  assert.equal(r.t1,'fr1');assert.equal(r.t1b,'wa1');
  assert.equal(r.ui,true);assert.equal(r.order,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-dollaffix: ok');
}finally{await browser.close();}
