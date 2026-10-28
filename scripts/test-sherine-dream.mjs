// test-sherine-dream.mjs — 夢域席琳遺骸、之魂（件數 −1、謀叛者頭目掉落）、伊奧不兌換之魂（玩家 2026-10-28 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});
    const out={};player.sherineMad=true;player.sherineDream=true;
    ['rem_claw','rem_eye','rem_blood','rem_flesh'].forEach(id=>{player.eq[id]={id,uid:uid(),cnt:1,en:0,seteff:'紅獅'};});
    recomputeStats();out.ed0=player.d.extraDmg;out.n0=player._sherineSetCnt['紅獅'];
    player.eq.rem_soul={id:'rem_soul',uid:uid(),cnt:1,en:0,seteff:'鐵衛'};recomputeStats();
    out.n1=[player._sherineSetCnt['紅獅'],player._sherineSetCnt['鐵衛']];out.red5=!!player._setRedLion5;
    ['rem_claw','rem_eye','rem_blood','rem_flesh'].forEach(id=>player.eq[id].seteff='紅獅夢');recomputeStats();
    out.tiers=__afkSherineDream.dreamTiers(player)['紅獅'];out.ed1=player.d.extraDmg;out.out=Math.round(player._sdreamFx.out.all*1000)/1000;
    out.name=getItemFullName(player.eq.rem_claw).replace(/<[^>]+>/g,'');out.color=getItemColor(player.eq.rem_claw);
    const div=document.createElement('div');document.body.appendChild(div);renderIoExchange(div);
    out.io=div.querySelectorAll('[onclick^="doIoExchange"]').length;
    out.remTab=SHERINE_REMAINS.length;
    return out;
  });
  assert.equal(r.n0,4);
  assert.deepEqual(r.n1,[5,2],'之魂：每組 +1（本身算 1 件）');
  assert.ok(r.red5,'4 件紅獅＋之魂＝5 件效果');
  assert.deepEqual(r.tiers,[2,3,5]);
  assert.equal(r.ed1-r.ed0,45,'夢域紅獅 2 件額外傷害再 +45');
  assert.equal(r.out,1.182);
  assert.equal(r.name,'血獅之爪');
  assert.equal(r.color,'c-sherine-dream');
  assert.equal(r.io,8,'伊奧不兌換之魂');
  assert.equal(r.remTab,9);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-sherine-dream: ok');
}finally{await browser.close();}
