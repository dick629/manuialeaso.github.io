// test-hidden.mjs — 隱藏條件：謀叛三人組（王子＋男騎士＋男法師）、王族之敵（男性王族／騎士／法師對反王肯恩、賽尼斯）、立方和諧回 15 MP（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'royal',lv:80});player.avatar='王子';
    const C=AFK_CARD_COMBAT,H=__afkHidden,out={};
    const ally=(cls,av)=>({cls,avatar:av,curHp:1000,mhp:1000,d:{},eq:{},buffs:{},statuses:{}});
    const hit=(mapId,name)=>{mapState.current=mapId;const m={n:name,curHp:1e6,hp:1e6,lv:80,ac:0,st:{}};mapState.mobs=[m,null,null,null,null];return C.damage(player,m,100,{kind:'melee'});};
    const taken=()=>Math.round(__afkTakenMods.reduce((k,f)=>k*f(player,mapState.mobs[0]),1)*100)/100;
    player.allies=[ally('knight','男騎士'),ally('mage','男法師')];
    out.trio=[H.trio(),hit('afk_traitor_whisper','反王肯恩(謀叛)'),taken()];
    player.allies=[ally('knight','男騎士'),ally('mage','女法師')];
    out.female=[H.trio(),hit('afk_traitor_whisper','反王肯恩(謀叛)'),taken()];
    player.allies=[ally('knight','男騎士'),ally('mage','男法師'),ally('elf','男妖精')];
    out.four=[H.trio(),hit('afk_traitor_whisper','反王肯恩(謀叛)')];
    player.allies=[];
    out.king=[hit('pride_41_50','反王肯恩'),hit('pride_41_50','賽尼斯(首領)'),hit('pride_41_50','黑騎士')];
    player.avatar='公主';out.princess=hit('pride_41_50','反王肯恩');
    out.harmony=DB.skills.sk_illu_cube_harmony.cube.val;
    return out;
  });
  assert.deepEqual(r.trio,[true,150,0.5],'三人組：傷害 +50%、受傷 −50%');
  assert.deepEqual(r.female,[false,100,1],'有女性角色不算');
  assert.deepEqual(r.four,[false,100],'四個人不算');
  assert.deepEqual(r.king,[110,110,100],'王族之敵 +10%');
  assert.equal(r.princess,100,'女性不算');
  assert.equal(r.harmony,15,'立方：和諧回 15 MP');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-hidden: ok');
}finally{await browser.close();}
