// test-rift2.mjs — 時空裂痕重做：遊戲時間、席琳三模式掉落與結算、完全通關、失去光芒的符文石（玩家 2026-10-29 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});state.ff=true;state.running=true;
    const R2=__afkRift2,RD=__afkRuneData,out={};
    const cnt=id=>player.inv.filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt||1),0);
    player.sherineWorld=false;player.sherineMad=true;player.sherineDream=false;
    gainItem('mat_crack_core',1,true,true);player.riftRewardMs=null;
    enterRift();
    out.mode=state._r2Mode;
    // 遊戲時間：電腦時鐘不動、跑 600 下＝1 分鐘
    const oSp=window.spawnRiftMob;window.spawnRiftMob=()=>{};mapState.mobs=[null,null,null,null,null];
    const t0=state.ticks;for(let i=0;i<600;i++){try{tick();}catch(e){out.tErr=String(e);}if(!state.riftRun)break;}
    window.spawnRiftMob=oSp;out.dbg=[state.ticks-t0,state.riftRun,state._r2Start,mapState.current,out.tErr];out.min=Math.round(R2.minutes()*10)/10;out.stay=Math.round((Date.now()-state.riftStartMs)/1000);
    // 掉落機率不吃加倍、遺物 ×10
    const relic=Object.keys(DB.items).find(k=>DB.items[k].relic);
    out.drop=[__afkRiftDrop(relic,0.0001,{}),__afkRiftDrop('mat_crack_core',5,{}),partyDropRate(0.3)];
    // 擊殺：Math.random=0 → 必掉哀石碎片與符文盒
    const rnd=Math.random;Math.random=()=>0;
    mapState.mobs[0]={n:'測試頭目',lv:70,boss:true,hp:10,curHp:0,uid:'t1',st:newMobStatus(),_dead:false};
    try{killMob(0);}catch(e){out.kErr=String(e);}
    Math.random=rnd;
    out.kill=[cnt('afk_lament_shard'),cnt(RD.BOX[2])];
    // 撐滿 80 分鐘：完全通關
    state._r2Start=state.ticks-48000;try{tick();}catch(e){}
    out.clear=[state.riftRun,player.afkRift2Reward&&player.afkRift2Reward.clear,player.afkRift2Reward&&player.afkRift2Reward.mode];
    const b3=cnt(RD.BOX[3]),bone=cnt('afk_bone_stone');claimRiftReward();
    out.claim=[cnt(RD.BOX[3])-b3,cnt('afk_bone_stone')-bone,player.riftRewardMs];
    // 夢域結算時段
    const seg=m=>{const before=JSON.stringify(player.inv.map(x=>x.id+':'+(x.cnt||1)));R2.reward({mode:'dream',min:m,clear:false});return player.inv.filter(x=>!before.includes(x.id+':'+(x.cnt||1))).map(x=>x.id);};
    out.dream=[seg(5).some(id=>/~r10/.test(id)),seg(30).includes(RD.BOX[2]),seg(65).includes(RD.BOX[3]),seg(77).some(id=>/afk_(miasma|bone|void)_stone/.test(id))];
    // 失去光芒的符文石：打開
    gainItem(RD.BOX[1],1,true,true);const box=player.inv.find(x=>x.id===RD.BOX[1]);useItem(box.uid);
    out.open=player.inv.some(x=>RD.byId[x.id]&&RD.byId[x.id].stage===1);
    return out;
  });
  assert.equal(r.mode,'mad');
  assert.equal(r.min,1,'600 下＝1 分鐘');
  assert.ok(Math.abs(r.stay-60)<=1,'停留時間用遊戲時間 '+r.stay);
  assert.deepEqual(r.drop,[0.001,5,0.3],'裂痕掉落不吃加倍、遺物 ×10');
  assert.deepEqual(r.kill,[1,1],'哀石碎片與符文盒 '+(r.kErr||''));
  assert.deepEqual(r.clear,[false,true,'mad'],'80 分鐘完全通關');
  assert.deepEqual(r.claim,[1,50,null],'瘋狂完全通關：階段三＋骸骨魔石 50');
  assert.deepEqual(r.dream,[true,true,true,true],'夢域結算時段');
  assert.equal(r.open,true,'打開符文盒');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-rift2: ok');
}finally{await browser.close();}
