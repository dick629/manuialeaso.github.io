// test-saint-cloth.mjs — 聖衣光輝（5 次失去光輝、雅典娜祝福恢復）、封印沒有翅膀、解封數值、光輝碎片升星（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100,rebirth:1});
    const A=AFK_CARD_ASCENSION,C=AFK_CARD_COMBAT,SC=__afkSaintCloth,out={};
    const rows=A.catalog.samsara.filter(x=>!x.unique);
    player.cardAscension={v:1,owned:{},sealed:{},copies:{},failures:{},attempts:{},unlocked:{mythic:true,celestial:true,spacetime:true,samsara:true},bonus:{}};
    rows.forEach(x=>{player.cardAscension.owned[x.id]=true;player.cardAscension.sealed[x.id]=true;});
    const row=rows[0];delete player.cardAscension.sealed[row.id];player.cardAscension.copies[row.id]=2;
    mapState.current='training';
    player.poly=JSON.parse(JSON.stringify(row.form));player.buffs.poly=1800;recomputeStats();
    const rule=()=>{const x=C.ruleFor(row,player);return [x.stat,x.resist,x.critDamage];};
    out.open=rule();
    out.wing=_actorBattleForm(player).key;
    const uses=[];
    for(let i=0;i<6;i++){player.cardAscension.clothOn=null;SC.checkWear();uses.push(SC.usesOf(row.id)+(SC.dim(row.id)?'D':''));}
    out.uses=uses;out.dimRule=rule();out.dimWing=_actorBattleForm(player).key;
    // 鑽石卡（測試直接當作已登錄）
    A.diamondOwned=()=>true;
    const card=Object.keys(DB.items).find(k=>DB.items[k].eff==='card'&&DB.items[k].cardTier===5);
    gainItem(card,15+50,true,true);
    SC.craftBless();out.bless=player.inv.filter(x=>x.id===SC.ITEMS.bless).length;
    useItem(player.inv.find(x=>x.id===SC.ITEMS.bless).uid);
    out.after=[SC.dim(row.id),SC.usesOf(row.id)];
    for(let i=0;i<5;i++)SC.craftShard();
    SC.lightStar();
    out.stars=rows.reduce((n,x)=>n+SC.starsOf(x.id),0);out.cardsLeft=player.inv.filter(x=>x.id===card).reduce((n,x)=>n+(x.cnt||0),0);
    // 星數：穿著的那件 2 星 → 對最終頭目受到傷害 ×0.8
    player.cardAscension.clothStars[row.id]=2;player.cardAscension.clothOn=row.id;
    const mob={_afkFinal:true,n:'x'};out.taken=Math.round(__afkTakenMods.reduce((k,f)=>k*f(player,mob),1)*100)/100;
    return out;
  });
  assert.deepEqual(r.open,[75,250,100],'解除封印數值');
  assert.ok(!/・封/.test(r.wing),'解除封印有翅膀 '+r.wing);
  assert.deepEqual(r.uses,['1','2','3','4','5','5D'],'第 6 次失去光輝');
  assert.deepEqual(r.dimRule,[50,200,50],'失去光輝＝封印數值');
  assert.ok(/・封/.test(r.dimWing),'封印型態沒有翅膀 '+r.dimWing);
  assert.equal(r.bless,1);assert.deepEqual(r.after,[false,0],'雅典娜祝福恢復光輝');
  assert.equal(r.stars,1,'5 片碎片升 1 星');assert.equal(r.cardsLeft,0);
  assert.equal(r.taken,0.8,'2 星受到最終頭目傷害 −20%');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-saint-cloth: ok');
}finally{await browser.close();}
