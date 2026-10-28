// test-runes.mjs — 符文師佐爾頓：星蝕·解三個孔（墜蝕·解、刻解·骸、瘴骸·破）、舊「蝕刻」資料轉換、背包一疊拆一把出來（玩家 2026-10-29 晚）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});
    const SD=__afkSherineDream,out={};
    const give=g=>SD.PARTS.forEach(id=>{for(let i=0;i<8;i++)gainSherineRemains(id,g,true);});
    give('紅獅');give('白鳥夢');
    out.town=DB.towns.town_talking.npcs.some(n=>n.id==='npc_zoldon'&&n.n==='佐爾頓');
    out.agnes=(()=>{interactNPC('npc_dragon_engraver');return !!document.querySelector('#afk-ax-etch,[data-ax="ext:etch"]');})();
    player.eq.wpn={id:'wpn_longsword',uid:uid(),cnt:1,en:0};
    interactNPC('npc_zoldon');
    const box=()=>document.getElementById('afk-zo-embed');
    out.sel=!!box().querySelector('.ax-eq.on[data-zosel="eq:wpn"]');
    out.before2=box().querySelector('button[data-zo="open2"]').disabled;
    const pick=(id,v)=>{const s=box().querySelector('#'+id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));};
    pick('afk-zo-g1','紅獅');box().querySelector('button[data-zo="open1"]').click();
    recomputeStats();
    out.s1=[player.eq.wpn.etch,player.eq.wpn.sockets.length,player._sherineSetCnt['紅獅'],!!player._setRedLion5,SD.etchReady(player,'紅獅')];
    pick('afk-zo-g2','白鳥');box().querySelector('button[data-zo="open2"]').click();
    recomputeStats();
    out.s2=[player.eq.wpn.etchD,player.eq.wpn.sockets.length,player._sherineSetCnt['白鳥'],JSON.stringify(SD.dreamTiers(player)['白鳥']),SD.etchReady(player,'白鳥夢')];
    out.lock3=box().querySelector('button[data-zo="open3"]').disabled;
    out.chips=[...box().querySelectorAll('.ax-sel .ax-sock')].map(e=>e.textContent);
    out.desc=buildItemDescHTML(player.eq.wpn).includes('星蝕·解');
    out.sig=itemSig(player.eq.wpn)!==itemSig({id:'wpn_longsword',uid:'x',cnt:1,en:0});
    // 舊資料：蝕刻時代 etch 可能是夢域、sockets 一次給 3 格
    const old={id:'wpn_longsword',uid:uid(),cnt:1,en:0,etch:'紅獅夢',sockets:[null,null,null]};
    SD.migrate(old);out.mig=[old.etch,old.etchD,old.sockets.length];
    // 背包一疊三把：拆一把出來開孔
    give('紅獅');
    const st={id:'wpn_longsword',uid:'stack-3',cnt:3,en:0,bless:false,anc:false,attr:false};player.inv.push(st);
    const err=__afkRunes.act.open1('inv:stack-3','紅獅');
    const daggers=player.inv.filter(x=>x.id==='wpn_longsword');
    out.split=[err,st.cnt,daggers.length,daggers.filter(x=>x.etch==='紅獅').length];
    return out;
  });
  assert.equal(r.town,true,'佐爾頓在說話之島');
  assert.equal(r.agnes,false,'艾格尼絲不再有蝕刻');
  assert.equal(r.sel,true,'預設選主手');
  assert.equal(r.before2,true,'沒開第一孔不能開第二孔');
  assert.deepEqual(r.s1,['紅獅',1,5,true,0],'墜蝕·解：8 套扣光、套裝算滿 5 件');
  assert.deepEqual(r.s2,['白鳥夢',2,5,'[2,3,5]',0],'刻解·骸：夢域 8 套扣光、夢域效果全開');
  assert.equal(r.lock3,true,'瘴骸·破鎖定');
  assert.ok(r.chips[0].includes('墜蝕·解')&&r.chips[1].includes('刻解·骸')&&r.chips[2].includes('鎖定'),r.chips.join('|'));
  assert.ok(r.desc&&r.sig);
  assert.deepEqual(r.mig,['紅獅','紅獅夢',2],'舊蝕刻資料轉換');
  assert.deepEqual(r.split,[null,2,2,1],'一疊拆一把出來');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-runes: ok');
}finally{await browser.close();}
