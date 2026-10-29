// test-rune-legend.mjs — 傳說符文「破」：命中吸收 MP＝面板傷害、冷卻 3 秒、全身一顆、平衡點數 +5% 傷害、佐爾頓兌換（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:80,eq:{ring1:'acc_ring_str'in DB.items?'acc_ring_str':Object.keys(DB.items).find(k=>DB.items[k].slot==='ring'&&!DB.items[k].relic)}});
    const RD=__afkRuneData,FX=__afkRuneFx,C=AFK_CARD_COMBAT,Z=__afkRunes,out={};
    const id='afk_rune_po_l';out.name=DB.items[id].n;out.stage=RD.list.find(x=>x.id===id).stage;
    // 佐爾頓兌換
    gainItem('afk_fate_unlock',1,true,true);gainItem('afk_lament_gem',100,true,true);
    out.ex=Z.act.legend(id);out.have=player.inv.filter(x=>x.id===id).length;
    // 鑲進戒指（先開孔）
    player.eq.ring1.sockets=[null];player.eq.ring2=JSON.parse(JSON.stringify(player.eq.ring1));player.eq.ring2.uid='r2';player.eq.ring2.sockets=[null];
    player.eq.ring1.sockets[0]=id;FX.bump();
    out.dup=Z.act.inlay('eq:ring2',0,id);
    // 效果
    mapState.current='training';const m={n:'木人',curHp:1e6,hp:1e6,lv:10,ac:0,dr:0,st:{}};mapState.mobs=[m,null,null,null,null];
    player.d.meleeDmg=100;player.mp=0;player.mmp=5000;state.ticks=1000;
    const v=C.damage(player,m,1000,{kind:'melee'});out.mp1=player.mp;out.v=v;
    C.damage(player,m,1000,{kind:'melee'});out.mp2=player.mp;   // 冷卻中
    state.ticks+=30;player.d.magicDmg=70;C.damage(player,m,1000,{kind:'magic'});out.mp3=player.mp;
    return out;
  });
  assert.equal(r.name,'破之符文（傳說）');assert.equal(r.stage,4);
  assert.equal(r.ex,null);assert.equal(r.have,1);
  assert.ok(/只能裝一顆/.test(r.dup||''),'全身只能一顆 '+r.dup);
  assert.equal(r.v,1050,'平衡點數 +5%');
  assert.deepEqual([r.mp1,r.mp2,r.mp3],[100,100,170],'吸收 MP＝面板傷害、冷卻 3 秒');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-rune-legend: ok');
}finally{await browser.close();}
