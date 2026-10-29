// test-refine-runebox.mjs — 玩家 2026-10-29 16:24：材料工坊提煉魔法結晶體依掉落怪物等級（<30：100 個、金幣照舊；30～59：50 個、金幣 ×1.5；60+：10 個、金幣 ×2）；
//   失去光芒的符文石：階段一要魔法結晶體 100、階段二 150、階段三不用；夢域掉落 ×8；小百科「符文系統」另開一頁
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:80});
    const X=AFK_TTMI_ITEMS,out={};
    const lvOf={};Object.values(DB.mobs).forEach(m=>{if(m&&m.n&&m.race!=='建築'){const v=m.lv||1;if(lvOf[m.n]==null||v<lvOf[m.n])lvOf[m.n]=v;}});
    const minLv={};Object.keys(MOB_DROPS).forEach(n=>{const lv=lvOf[n];if(lv==null)return;MOB_DROPS[n].forEach(e=>{if(minLv[e[0]]==null||lv<minLv[e[0]])minLv[e[0]]=lv;});});
    const ref=X.recipes.filter(r=>r.ttmiRecipeKind==='refine');out.n=ref.length;
    const bad=[];const seen={t1:0,t2:0,t3:0};
    ref.forEach(r=>{const m=r.req.find(q=>q.id!=='gold'),g=r.req.find(q=>q.id==='gold'),c=X.refineCost(m.id);if(!c)return;
      const lv=c.lv,want=lv<30?[100,1]:lv<60?[50,1.5]:[10,2];const d=DB.items[m.id];
      const cnt=d.ttmiSealedLow?Math.max(100,want[0]):want[0];
      if(m.cnt!==cnt||c.mult!==want[1]||g.cnt!==c.gold||g.cnt<50100*want[1]-1)bad.push(d.n+':'+lv+':'+m.cnt+'/'+g.cnt);
      seen[lv<30?'t1':lv<60?'t2':'t3']++;
      if(/份材料/.test(String(d.d))&&!String(d.d).includes('每 '+cnt+' 份材料與 '+c.gold.toLocaleString()+' 金幣'))bad.push('desc '+d.n);});
    out.bad=bad.slice(0,5);out.seen=seen;
    // 符文石開箱成本
    const cid=X.resolve(7102);out.cid=DB.items[cid].n;
    player.inv=[];gainItem('afk_runebox_1',2,true,true);gainItem(cid,150,true,true);
    const box=()=>player.inv.find(i=>i.id==='afk_runebox_1');const cnt=id=>player.inv.filter(i=>i.id===id).reduce((s,i)=>s+(i.cnt||1),0);
    useItem(box().uid);out.s1=[cnt('afk_runebox_1'),cnt(cid)];
    useItem(box().uid);out.s1b=[cnt('afk_runebox_1'),cnt(cid)];   // 只剩 50 個 → 開不了
    gainItem('afk_runebox_2',1,true,true);gainItem(cid,100,true,true);useItem(player.inv.find(i=>i.id==='afk_runebox_2').uid);out.s2=[cnt('afk_runebox_2'),cnt(cid)];
    gainItem('afk_runebox_3',1,true,true);useItem(player.inv.find(i=>i.id==='afk_runebox_3').uid);out.s3=[cnt('afk_runebox_3'),cnt(cid)];
    out.open=__afkRuneData.OPEN_COST;
    // 玩家 2026-10-29 20:38：不夠時用倉庫的結晶體，再用背包＋倉庫的材料自動提煉
    player.inv=[];player.gold=1e9;const wh=loadWarehouse();wh.items=wh.items.filter(i=>i.id!==cid);wh.items.push({id:cid,uid:uid(),cnt:60,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false});saveWarehouse(wh);
    const rf=X.recipes.find(rr=>rr.result===cid&&rr.ttmiRecipeKind==='refine'&&rr.req.find(q=>q.id!=='gold').cnt===10);const mat=rf.req.find(q=>q.id!=='gold').id;
    gainItem(mat,200,true,true);const wh2=loadWarehouse();wh2.items.push({id:mat,uid:uid(),cnt:200,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false});saveWarehouse(wh2);
    gainItem(cid,10,true,true);gainItem('afk_runebox_1',1,true,true);
    const g0=player.gold;useItem(box().uid);
    out.auto=[cnt('afk_runebox_1'),cnt(cid),whCountId(cid),cnt(mat),whCountId(mat),g0-player.gold>0];
    gainItem('afk_runebox_2',1,true,true);useItem(player.inv.find(i=>i.id==='afk_runebox_2').uid);out.auto2=[cnt('afk_runebox_2')];
    // 夢域掉落 ×8
    return out;
  });
  assert.ok(r.n>100,'提煉配方 '+r.n);
  assert.deepEqual(r.bad,[],'提煉數量／金幣依等級');
  assert.ok(r.seen.t1>0&&r.seen.t2>0&&r.seen.t3>0,JSON.stringify(r.seen));
  assert.equal(r.cid,'魔法結晶體');
  assert.deepEqual(r.s1,[1,50],'階段一 100 個');assert.deepEqual(r.s1b,[1,50],'不夠就不開');
  assert.deepEqual(r.s2,[0,0],'階段二 150 個');assert.deepEqual(r.s3,[0,0],'階段三不用');
  assert.deepEqual(r.open,{1:100,2:150,3:0});
  assert.deepEqual(r.auto,[0,0,0,0,100,true],'背包 10＋倉庫 60＋提煉 30 個（材料背包 200 先用、再用倉庫 100）：'+JSON.stringify(r.auto));
  assert.deepEqual(r.auto2,[1],'材料用完就不開');
  // 小百科：符文系統另開一頁
  r.dream=await page.evaluate(async()=>/_dream \? 8 :/.test(await (await fetch('js/05-kill-progression.js')).text()));
  const wk=await page.evaluate(async()=>{const t=await (await fetch('afk-wiki.js')).text();return [/\{ k: 'runes', n: '符文系統' \}/.test(t),/function renderRunes\(\)/.test(t)];});
  assert.deepEqual(wk,[true,true],'符文系統另開一頁');
  assert.equal(r.dream,true,'夢域掉落 ×8');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-refine-runebox: ok');
}finally{await browser.close();}
