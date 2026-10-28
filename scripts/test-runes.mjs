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
    out.lock3=box().querySelector('[data-row="open3"] button').disabled;
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
    // ── 符文：兌換、開孔、鑲嵌、效果、拆下 ──
    const A=__afkRunes.act,FX=__afkRuneFx,RDx=__afkRuneData;
    const cnt=id=>player.inv.filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt||1),0);
    gainItem('afk_lament_dust',1000,true,true);gainItem('afk_lament_shard',3000,true,true);gainItem('afk_lament_stone',13500,true,true);
    out.ex=[A.exchange('afk_lament_dust',true),cnt('afk_lament_crystal'),cnt('afk_lament_dust'),A.exchange('afk_lament_shard',true),A.exchange('afk_lament_stone',true),cnt('afk_lament_gem')];
    gainItem('afk_miasma_stone',1000,true,true);gainItem('afk_bone_stone',500,true,true);gainItem('afk_void_stone',100,true,true);
    out.fate=[A.fate(),cnt('afk_fate_unlock'),cnt('afk_void_stone')];
    // 武器第三孔
    out.w3=[A.open('eq:wpn'),player.eq.wpn.sockets.length,cnt('afk_fate_unlock')];
    // 鑲嵌：武器只能攻擊、套裝、職業
    ['afk_rune_jian','afk_rune_po','afk_rune_lie','afk_rune_dun','afk_rune_zhao','afk_rune_hui','afk_rune_hun','afk_rune_zhan'].forEach(id=>gainItem(id,2,true,true));
    out.badCat=A.inlay('eq:wpn',0,'afk_rune_dun');
    out.inl=[A.inlay('eq:wpn',0,'afk_rune_jian'),A.inlay('eq:wpn',1,'afk_rune_po'),A.inlay('eq:wpn',2,'afk_rune_lie'),cnt('afk_lament_gem')];
    out.words=FX.wordsOf(player.eq.wpn).map(w=>w.n);
    // 濺射規則：天崩＋碎陣成立（三符文之語成立時兩符文之語不算 → 碎陣不在）
    out.splash=[JSON.stringify(window.__afkSplashRule(player,90,AFK_SPLASH.baseRule)),JSON.stringify(window.__afkSplashRule(player,50,AFK_SPLASH.baseRule))];
    // 防具兩孔＋減傷
    player.eq.armor={id:Object.keys(DB.items).find(k=>DB.items[k].slot==='armor'&&!DB.items[k].gmOnly),uid:uid(),cnt:1,en:0};
    const SDx=__afkSherineDream;SDx.PARTS.forEach(id=>{for(let i=0;i<5;i++)gainSherineRemains(id,'鐵衛夢',true);});
    gainItem('afk_reverie_crystal',3,true,true);
    out.arm=[A.open('eq:armor'),A.open('eq:armor'),(player.eq.armor.sockets||[]).length];
    out.armIn=[A.inlay('eq:armor',0,'afk_rune_dun'),(out.dup=A.inlay('eq:armor',1,'afk_rune_dun'),A.inlay('eq:armor',1,'afk_rune_zhao')),FX.wordsOf(player.eq.armor).map(w=>w.n).join()];
    const mods=window.__afkTakenMods;let mp=1,mm=1;mods.forEach(f=>{try{const v=f(player,{n:'x'},'phys');if(v>=0)mp*=v;}catch(e){}});mods.forEach(f=>{try{const v=f(player,{n:'x'},'magic');if(v>=0)mm*=v;}catch(e){}});
    out.dr=[Math.round(mp*100)/100,Math.round(mm*100)/100];
    // 飾品孔＋補助
    const ring=Object.keys(DB.items).find(k=>DB.items[k].slot==='ring'&&!DB.items[k].gmOnly);player.eq.ring1={id:ring,uid:uid(),cnt:1,en:0};
    out.acc=[A.open('eq:ring1'),A.inlay('eq:ring1',0,'afk_rune_hui'),FX.N(player,'穗')];
    // 拆下
    gainItem('afk_lament_stone',600,true,true);const st0=cnt('afk_lament_stone');out.rm=[A.remove('eq:ring1',0),player.eq.ring1.sockets[0],cnt('afk_rune_hui'),st0-cnt('afk_lament_stone')];
    // 魂：跟之魂疊加
    player.eq.rem_soul={id:'rem_soul',uid:uid(),cnt:1,en:0,seteff:'紅獅'};player.eq.wpn.sockets[0]=null;A.inlay('eq:wpn',0,'afk_rune_hun');recomputeStats();
    out.cut=SDx.setCut(player);
    out.sig=itemSig(player.eq.armor)!==itemSig(Object.assign({},player.eq.armor,{sockets:undefined}));
    return out;
  });
  assert.equal(r.town,true,'佐爾頓在說話之島');
  assert.equal(r.agnes,false,'艾格尼絲不再有蝕刻');
  assert.equal(r.sel,true,'預設選主手');
  assert.equal(r.before2,true,'沒開第一孔不能開第二孔');
  assert.deepEqual(r.s1,['紅獅',1,5,true,0],'墜蝕·解：8 套扣光、套裝算滿 5 件');
  assert.deepEqual(r.s2,['白鳥夢',2,5,'[2,3,5]',0],'刻解·骸：夢域 8 套扣光、夢域效果全開');
  assert.equal(r.lock3,true,'沒有解命石不能開第三孔');
  assert.ok(r.chips[0].includes('墜蝕·解')&&r.chips[1].includes('刻解·骸')&&r.chips[2].includes('未開'),r.chips.join('|'));
  assert.ok(r.desc&&r.sig);
  assert.deepEqual(r.mig,['紅獅','紅獅夢',2],'舊蝕刻資料轉換');
  assert.deepEqual(r.split,[null,2,2,1],'一疊拆一把出來');
  assert.deepEqual(r.ex,[null,6,100,null,null,90],'兌換 150 換 1');
  assert.deepEqual(r.fate,[null,1,0],'解命石');
  assert.deepEqual(r.w3,[null,3,0],'武器第三孔');
  assert.ok(/只能鑲/.test(r.badCat),'武器不能鑲減傷 '+r.badCat);
  assert.deepEqual(r.inl,[null,null,null,30],'鑲嵌三顆（階段三各 20 結晶）');
  assert.ok(/同名/.test(r.dup));
  assert.deepEqual(r.words,['天崩'],'三符文之語 '+r.words);
  assert.deepEqual(r.splash,['{"pct":0.5,"keep":true}','{"pct":0.2,"keep":false}'],'天崩：滿 80% 不扣主目標；沒滿 80% 只有單顆「濺」20%（碎陣被天崩包含不另算）');
  assert.deepEqual(r.arm,[null,null,2],'防具兩孔');
  assert.deepEqual(r.armIn,[null,null,'壁壘'],'防具鑲嵌與壁壘');
  assert.deepEqual(r.dr,[0.91,0.91],'盾／罩＋壁壘');
  assert.deepEqual(r.acc,[null,null,1],'飾品孔與穗');
  assert.deepEqual(r.rm,[null,null,2,500],'拆下');
  assert.equal(r.cut,2,'魂＋之魂＝−2');
  assert.ok(r.sig,'有孔的防具不疊');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-runes: ok');
}finally{await browser.close();}
