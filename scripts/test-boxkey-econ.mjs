// test-boxkey-econ.mjs — 寶箱碎片 100 個合成、席琳結晶 50 開箱（afk-boxkey）；集字遊戲系列除役；無用掉落物 ×0.2、Lv30 以下必掉金幣、追蹤收費依等級（afk-novice-econ）（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:20});
    const out={};
    // 合成數量
    const rec=CRAFT_RECIPES.npc_bartel.find(r=>r.result==='item_osiris_box_basic');out.req=rec.req.map(q=>q.cnt);
    // 席琳結晶開箱
    gainItem('item_osiris_box_basic',3,true,true);gainItem('sherine_crystal',120,true,true);
    const box=player.inv.find(i=>i.id==='item_osiris_box_basic');
    window.confirm=()=>true;openOsirisBox(box.uid);
    const sel=document.getElementById('afk-boxkey-mode');out.modeOpts=[...sel.options].map(o=>o.value+(o.disabled?'!':''));
    sel.value='crystal';sel.dispatchEvent(new Event('change'));out.max=document.getElementById('osiris-box-qty').max;
    const n0=player.inv.length;doOpenOsirisBox(box.uid,2);
    out.crystal=player.inv.filter(i=>i.id==='sherine_crystal').reduce((s,i)=>s+(i.cnt||1),0);
    out.boxLeft=player.inv.filter(i=>i.id==='item_osiris_box_basic').reduce((s,i)=>s+(i.cnt||1),0);
    out.tmpCore=player.inv.filter(i=>i.id==='mat_crack_core'||i._afkBoxKeyTmp).length;
    out.got=player.inv.length>n0-1;
    // 核心模式沒龜裂之核→擋
    __afkBoxKey.mode('core');const oc=player.inv.filter(i=>i.id==='sherine_crystal').length;doOpenOsirisBox(box.uid,1);out.boxLeft2=player.inv.filter(i=>i.id==='item_osiris_box_basic').reduce((s,i)=>s+(i.cnt||1),0);
    // 集字遊戲：全系列除役
    const jz=Object.keys(DB.items).filter(id=>/^集字遊戲/.test(DB.items[id].n||''));
    out.jz=[jz.length,jz.every(id=>DB.items[id].ttmiEvent),jz.some(id=>Object.values(MOB_DROPS).some(a=>a.some(e=>e[0]===id))),AFK_TTMI_ITEMS.junk().some(x=>jz.includes(x.id))];
    // 無用掉落物 ×0.2
    const e=[];Object.values(MOB_DROPS).forEach(a=>a.forEach(x=>{if(x[0]==='new_item_148')e.push(x[1]);}));out.cut=e;
    // 金幣：Lv30 以下必掉
    out.gold=[__afkGoldRate({lv:10}),__afkGoldRate({lv:30}),__afkGoldRate({lv:31}),__afkGoldRate({lv:10,boss:true})];
    // 追蹤收費
    out.track=[__afkTrackCost({lv:1}),__afkTrackCost({lv:20}),__afkTrackCost({lv:50}),__afkTrackCost({lv:100}),__afkTrackCost({lv:150})];
    return out;
  });
  assert.deepEqual(r.req,[50,50],'上下碎片各 50');
  assert.deepEqual(r.modeOpts,['core!','crystal']);assert.equal(r.max,'2');
  assert.equal(r.crystal,20,'2 個箱子用 100 顆');assert.equal(r.boxLeft,1);assert.equal(r.tmpCore,0,'借的龜裂之核沒留下');assert.ok(r.got);
  assert.equal(r.boxLeft2,1,'沒龜裂之核開不了');
  assert.deepEqual(r.jz,[6,true,false,false],'集字遊戲全系列：活動品、不掉、不進委託');
  assert.ok(r.cut.length>=1&&r.cut.every(v=>v<=0.2*1+1e-9),'無用掉落物 ×0.2 '+r.cut);
  assert.deepEqual(r.gold,[1,1,0.7,0.7]);
  assert.deepEqual(r.track,[2000,4000,25000,100000,100000]);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-boxkey-econ: ok');
}finally{await browser.close();}
