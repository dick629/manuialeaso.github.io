// test-djinn-revive.mjs — 巨靈的承諾（232）：倒下立即消耗卷軸救回傭兵與寵物；+5 80%、+10 滿血無敵、昇華每 10 秒免費（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const run=async(ear,opt={})=>page.evaluate(({ear,opt})=>{
    if(window.__afkRelicPlus&&!DB.items[ear])__afkRelicPlus.ensure(ear);
    if(!DB.items[ear])return {missing:ear};
    __profile({cls:'knight',lv:100,eq:{ear1:ear}});
    mapState.current='training';
    const mk=i=>({_slot:'t'+i,_allyName:'傭兵'+i,cls:'knight',lv:80,curHp:0,mhp:1000,mp:0,mmp:100,_downed:true,_reviveCd:150,d:{},buffs:{},statuses:{},eq:{},skills:[],_mercPermanentPotions:true,_mercChaModelV:2});
    player.allies=[mk(1),mk(2),mk(3)];
    const form=Object.keys(PET_BOOK)[0];
    const pets=[{uid:'pt1',form,lv:30,hp:0,mhp:500,mp:0,mmp:50,_downed:true,_reviveCd:50,outOwner:'x',eq:{}}];
    window.petsOutList=()=>pets;window._petInWild=()=>true;
    if(opt.scrolls)gainItem('scroll_revive',opt.scrolls,true,true);
    const cnt=()=>player.inv.filter(x=>x.id==='scroll_revive').reduce((n,x)=>n+(x.cnt||0),0);
    AFK_RELIC_RUNTIME.invalidate();
    const out={stage:(AFK_RELIC_RUNTIME.sources(player).find(s=>s.catalogId===232)||{}).stage};
    for(let t=0;t<(opt.ticks||1);t++){state.ticks++;try{alliesTick();}catch(e){out.aErr=String(e);}try{petsTick();}catch(e){out.pErr=String(e);}}
    out.up=player.allies.filter(a=>!a._downed).length;
    out.petUp=!pets[0]._downed;
    out.hpPct=player.allies.filter(a=>!a._downed).map(a=>Math.round(a.curHp/AFK_RELIC_COMPANIONS.maxHp(a)*100));
    out.scrolls=cnt();
    out.guard=player.allies.filter(a=>!a._downed).map(a=>!!(AFK_RELIC_RUNTIME.state(a,'_buffs')||{})[Object.keys(AFK_RELIC_RUNTIME.state(a,'_buffs')||{}).find(k=>/reviveGuard/.test(k))]);
    out.hook=playerHasAutoReviveEarring();
    return out;
  },{ear,opt});
  // 基本：沒有冷卻，一個 tick 內三名傭兵＋寵物全部救回，各扣 1 張
  const base=await run('relic_djinn_promise',{scrolls:10});
  assert.equal(base.stage,0);assert.equal(base.hook,true);
  assert.equal(base.up,3,JSON.stringify(base));assert.equal(base.petUp,true,JSON.stringify(base));assert.equal(base.scrolls,6);
  assert.deepEqual(base.hpPct,[50,50,50]);
  // 沒有卷軸：救不了（也不會出錯）
  const none=await run('relic_djinn_promise',{});
  assert.equal(none.up,0);assert.equal(none.petUp,false);
  // +5：回 80%
  const p5=await run('relic_djinn_promise~r5',{scrolls:10});
  assert.equal(p5.stage,1);assert.equal(p5.up,3);assert.deepEqual(p5.hpPct,[80,80,80]);
  // +10：滿血＋無敵
  const p10=await run('relic_djinn_promise~r10',{scrolls:10});
  assert.equal(p10.stage,2);assert.equal(p10.up,3);assert.deepEqual(p10.hpPct,[100,100,100]);assert.deepEqual(p10.guard,[true,true,true]);
  // 昇華：沒有卷軸也每 10 秒免費救 1 名
  const a0=await page.evaluate(()=>{for(const id of ['relic_djinn_promise~r10~a0','relic_djinn_promise~r15~a0']){if(window.__afkRelicPlus)__afkRelicPlus.ensure(id);if(DB.items[id])return id;}return null;});
  const a5id=a0&&a0.replace(/~a0$/,'~a5');
  assert.ok(a0,'找不到昇華耳環');
  if(a0){
    const asc=await run(a0,{});
    assert.equal(asc.stage,3);assert.equal(asc.up+(asc.petUp?1:0),1,JSON.stringify(asc));assert.equal(asc.scrolls,0);
    const asc2=await run(a0,{ticks:101});
    assert.equal(asc2.up+(asc2.petUp?1:0),2,'10 秒後再免費救 1 名 '+JSON.stringify(asc2));
    const ascPaid=await run(a0,{scrolls:10});
    assert.equal(ascPaid.up,3);assert.equal(ascPaid.petUp,true);assert.equal(ascPaid.scrolls,7,'第一名免費，其餘照付費立即救');
    const a5=await run(a5id,{});
    assert.equal(a5.stage,4);assert.equal(a5.up,3);assert.equal(a5.petUp,true);
  }
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-djinn-revive: ok');
}finally{await browser.close();}
