// test-affix-tiers.mjs — 祝福／遠古只能打怪、遠古三階、龍紋師面板、頭目汙濁之水、席琳動態血量、離線上限（玩家 2026-10-28）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    __profile({cls:'knight',lv:100,eq:{wpn:'wpn_longsword',helm:'hlm_dark'}});
    const out={},A=window.__afkAffixPlus;
    // 祝福只能打怪
    _lootMobInfo=null;let nk=0,k=0;for(let i=0;i<30;i++)if(rollAffixesNew(1).bless)nk++;
    _lootMobInfo={n:'x',lv:1,boss:true};for(let i=0;i<30;i++)if(rollAffixesNew(1).bless)k++;_lootMobInfo=null;
    out.bless=[nk,k];
    // 遠古三階：數值 ×階數
    const w=player.eq.wpn;recomputeStats();const b0=player.d.extraDmg;
    w.anc='eternal';recomputeStats();const b1=player.d.extraDmg;
    w.ancLv=2;recomputeStats();const b2=player.d.extraDmg;
    w.ancLv=3;recomputeStats();const b3=player.d.extraDmg;
    out.anc=[b1-b0,b2-b0,b3-b0];
    out.name=getItemFullName(w).replace(/<[^>]+>/g,'');
    out.desc=/創世的永恆（遠古效果 ×3）：額外傷害 ?\+12/.test(buildItemDescHTML(w));
    delete w.anc;delete w.ancLv;recomputeStats();
    // 打怪掉落：5% 第二階、1% 第三階（亂數固定成 0.005 → 第三階）
    const oR=Math.random;Math.random=()=>0.005;
    _lootMobInfo={n:'x',lv:1,boss:true};gainItem('wpn_2hsword',1,true,false,false,false,{bless:true,anc:true});_lootMobInfo=null;
    gainItem('wpn_katana',1,true,false,false,false,{bless:true,anc:true});   // 非打怪：不升階
    Math.random=oR;
    const kd=player.inv.find(i=>i.id==='wpn_2hsword'),nd=player.inv.find(i=>i.id==='wpn_katana');
    out.drop=[kd&&kd.blessLv,kd&&kd.ancLv,nd&&(nd.blessLv||1),nd&&(nd.ancLv||1)];
    out.sig=itemSig(kd)!==itemSig(Object.assign({},kd,{ancLv:undefined}));
    // 龍紋師：在燃柳村、奧拉奇里亞只留轉生技藝
    const npcs=DB.towns.town_gludio.npcs;
    out.npc=[!!npcs.find(n=>n.id===A.NPC_ID&&n.title==='龍紋賦予'),(npcs.find(n=>n.id==='npc_orachilia')||{}).title];
    interactNPC(A.NPC_ID);
    let box=document.getElementById('afk-ax-embed');
    out.rows=box?box.querySelectorAll('.ax-row').length:0;
    out.noBlessUp=!box.innerHTML.includes('升級祝福');
    out.accBless=!!box.innerHTML.includes('飾品的祝福只能打怪取得');
    gainItem('afk_dmark_stone',1,true);
    box.querySelector('.ax-eq[data-axsel="eq:wpn"]').click();
    box=document.getElementById('afk-ax-embed');
    box.querySelector('button[data-ax="mark"]').click();
    out.mark=[player.eq.wpn.dmark||null,document.querySelector('#afk-ax-embed .ax-err').innerText];
    // 祝福賦予卷軸：防具用 500 張祝福的防卷換二階 → 賦予昇華的祝福；不能往下
    gainItem('scroll_armor_b',600,true,true);
    box=document.getElementById('afk-ax-embed');box.querySelector('.ax-eq[data-axsel="eq:helm"]').click();
    box=document.getElementById('afk-ax-embed');box.querySelector('button[data-ax="blessEx:arm:2"]').click();
    out.scrolls=[questCountId('scroll_armor_b'),questCountId('afk_bless_arm_2')];
    box=document.getElementById('afk-ax-embed');box.querySelector('button[data-ax="bless:2"]').click();
    out.blessed=[player.eq.helm.bless,player.eq.helm.blessLv,questCountId('afk_bless_arm_2')];
    gainItem('afk_bless_arm_1',1,true,true);out.down=A.act.bless('eq:helm',1);
    // 轉生後再跑一次職業任務（開關預設關）
    const RQ=window.AFK_REBIRTH_QUEST;player.rebirth=1;player.trialQ={knight15:2,knight30:2,mage15:2};player.trialStage=4;
    out.rqOff=RQ.apply(player,true);
    AFK_TOGGLES.set('rebirth-quest',true);
    out.rqOn=[RQ.apply(player,true)>0,player.trialQ.knight15,player.trialQ.mage15,player.trialStage,RQ.apply(player,true)];
    player.rebirth=2;out.rq2=RQ.apply(player,true)>=1;
    AFK_TOGGLES.set('rebirth-quest',false);
    // 頭目的汙濁之水
    const D=window.AFK_DEBUFF_RULES,boss={n:'頭目',lv:50,boss:true,curHp:10,hp:10,st:{}};
    mapState.mobs=[null,boss,null];Math.random=()=>0.1;
    out.foul=[D.bossFoul(boss,player),player.statuses.foulWater>1000,D.bossFoul(boss,player)];
    Math.random=oR;
    D.bossFoulSweep();out.foulStays=player.statuses.foulWater>0;
    boss._dead=true;boss.curHp=0;D.bossFoulSweep();out.foulGone=player.statuses.foulWater||0;
    player.classicMode=true;const b2x={n:'頭目',lv:50,boss:true,curHp:10,hp:10,st:{}};mapState.mobs=[b2x];Math.random=()=>0.1;out.classicFoul=D.bossFoul(b2x,player);Math.random=oR;player.classicMode=false;
    // 席琳動態血量、離線上限
    const F=window.__afkFinalBoss;out.scale=[F.hpScale(1),F.hpScale(8),F.hpScale(16),F.hpScale(30)];
    out.cap=window.__afk&&window.__afk.capHours;
    return out;
  });
  assert.deepEqual(r.bless,[0,30],'祝福只能打怪：非打怪 0、打怪全中');
  assert.deepEqual(r.anc,[4,8,12],'遠古三階 ×1／×2／×3');
  assert.ok(r.name.includes('創世的永恆'),r.name);
  assert.ok(r.desc,'說明顯示 ×3 數值');
  assert.deepEqual(r.drop,[3,3,1,1],'打怪掉落升階、非打怪不升階');
  assert.ok(r.sig,'階段不同不能疊在一起');
  assert.deepEqual(r.npc,[true,'轉生技藝']);
  assert.equal(r.rows,13);   // 2026-10-29 多了「蝕刻」
  assert.ok(r.accBless);
  assert.deepEqual(r.scrolls,[100,1]);
  assert.deepEqual(r.blessed,[true,2,0]);
  assert.ok(/只能用更高階/.test(r.down),r.down);
  assert.equal(r.rqOff,0,'開關關著不重置');
  assert.deepEqual(r.rqOn,[true,0,2,0,0],'只重置本職業、每轉一次');
  assert.ok(r.rq2,'二轉再一次');
  assert.ok(r.noBlessUp,'不能在 NPC 升級祝福');
  assert.ok(r.mark[0]&&!r.mark[1],'刻上龍的印記 '+r.mark[1]);
  assert.deepEqual(r.foul,[true,true,false],'頭目施放汙濁之水、已中不重複');
  assert.ok(r.foulStays,'頭目還活著不會散');
  assert.equal(r.foulGone,0,'沒有頭目就散去');
  assert.equal(r.classicFoul,false,'經典模式不施放');
  assert.deepEqual(r.scale,[1/16,0.5,1,1]);
  assert.equal(r.cap,24);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-affix-tiers: ok');
}finally{await browser.close();}
