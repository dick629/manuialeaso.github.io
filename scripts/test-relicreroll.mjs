// test-relicreroll.mjs — 銀騎士村艾彼迪爾：+10 遺物＋回夢水晶重洗第二詞綴、保留／替換、回夢香塵兌換（玩家 2026-10-29 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});state.ff=false;
    const A=__afkRelicPlus,RR=__afkRelicReroll,out={};
    const cnt=id=>player.inv.filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt||1),0);
    out.town=DB.towns.town_silver_knight.npcs.some(n=>n.id==='npc_epidir'&&n.n==='艾彼迪爾');
    // 兌換
    gainItem(RR.DUST,45,true,true);RR.act.exchange(true);out.ex=[cnt(RR.DUST),cnt(RR.CRY)];
    // 找一件有很多同部位遺物的武器
    const base=Object.keys(DB.items).find(id=>{const d=DB.items[id];return d&&isRelic(d)&&d.type==='wpn'&&!d.gmOnly&&!/~/.test(id)&&A.donorsFor(id).length>5;});
    const fx0=A.donorsFor(base).find(id=>!/~/.test(id));
    const tid=A.makeId(base,10,fx0);A.ensure(tid);
    player.inv.push({id:tid,uid:'rr-target',cnt:2,en:0,bless:true,anc:false,attr:false,lock:false});
    const other=Object.keys(DB.items).find(id=>{const d=DB.items[id];return d&&isRelic(d)&&d.type==='arm'&&!d.gmOnly&&!/~/.test(id)&&A.ensure(A.makeId(id,10,null));});
    const sid=A.makeId(other,10,null);
    player.inv.push({id:sid,uid:'rr-sac',cnt:2,en:0,lock:false});
    interactNPC('npc_epidir');
    const box=()=>document.getElementById('afk-rr-embed');
    box().querySelector('[data-rrsel="inv:rr-target"]').click();
    out.sacOpts=[...box().querySelectorAll('#afk-rr-sac option')].map(o=>o.value);
    box().querySelector('button[data-rr="roll"]').click();
    const pd=player._afkReroll;
    out.roll=[!!pd,pd&&pd.oldFx===fx0,pd&&pd.newFx!==fx0,cnt(RR.CRY),cnt(sid),player.inv.find(x=>x.uid==='rr-target').cnt];
    out.blocked=box().querySelector('button[data-rr="roll"]').disabled;
    out.choice=[...box().querySelectorAll('button[data-rr="keep"],button[data-rr="replace"]')].length;
    box().querySelector('button[data-rr="replace"]').click();
    const moved=player.inv.find(x=>x.uid===pd.uid);
    out.replaced=[A.parseId(moved.id).fx===pd.newFx,A.parseId(moved.id).n,moved.bless,!player._afkReroll];
    // 第二次：保留
    const id1=moved.id;
    box().querySelector('[data-rrsel="inv:'+pd.uid+'"]').click();
    box().querySelector('button[data-rr="roll"]').click();
    box().querySelector('button[data-rr="keep"]').click();
    out.kept=[moved.id===id1,cnt(RR.CRY),cnt(sid),!player._afkReroll];
    // 材料不足
    out.noMat=RR.act.roll('inv:'+pd.uid,'');
    return out;
  });
  assert.equal(r.town,true,'艾彼迪爾在銀騎士村');
  assert.deepEqual(r.ex,[5,2],'45 香塵換 2 個水晶、剩 5');
  assert.ok(r.sacOpts.length===1&&r.sacOpts[0]==='rr-sac','材料只列 +10、不含要洗的那件 '+r.sacOpts);
  assert.deepEqual(r.roll,[true,true,true,1,1,1],'重洗：扣 1 水晶、1 件 +10、從一疊拆一件');
  assert.equal(r.blocked,true,'沒決定前不能再洗');
  assert.equal(r.choice,2);
  assert.deepEqual(r.replaced,[true,10,true,true],'替換：只換第二詞綴、其他詞綴保留');
  assert.deepEqual(r.kept,[true,0,0,true],'保留：材料照扣、遺物不變');
  assert.ok(/回夢水晶/.test(r.noMat));
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-relicreroll: ok');
}finally{await browser.close();}
