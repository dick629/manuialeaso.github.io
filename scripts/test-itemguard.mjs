// test-itemguard.mjs — 🛡 物品保護（玩家 2026-10-29）：依詞條／強化值設定不能賣、不能存；手動販賣、快速廢品、標廢品、自動販賣、一鍵賣出、
//   單件／一鍵／條件／批次存入都擋；暫時鎖不留下；自動販賣可以只賣指定部位；倉庫條件存入有完整詞條
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:80});
    const IG=__afkItemGuard,out={on:AFK_TOGGLES.enabled('itemguard'),n:IG.AFFIX.length};
    const pick=sl=>Object.keys(DB.items).filter(k=>DB.items[k].type==='arm'&&DB.items[k].slot===sl&&!DB.items[k].relic&&!DB.items[k].legend&&!DB.items[k].noSell&&!/~/.test(k));
    const arm=pick('armor'),helm=pick('helm');
    const add=(id,x)=>{const it=Object.assign({id,en:0,cnt:1,uid:'G'+Math.random().toString(36).slice(2)},x||{});player.inv.push(it);return it;};
    const bl=add(arm[0],{bless:true}),an=add(arm[1],{anc:'eternal'}),pl=add(arm[2]),hm=add(helm[0]),dm=add(arm[3],{dmark:true});
    IG.cfg().sell={bless:true};IG.cfg().store={anc:true};
    const inInv=it=>player.inv.some(x=>x.uid===it.uid);
    // 手動販賣
    window.confirm=()=>true;
    sellItem(bl.uid);out.sellBl=inInv(bl);
    out.why=IG.why(an,'store');out.can=[_qjCanSelect(DB.items[bl.id],bl,'arm'),_qjCanSelect(DB.items[pl.id],pl,'arm')];
    toggleJunk(bl.uid);out.junkBl=!!bl.junk;
    // 自動販賣：防具 ≤+15 全賣，但頭盔不賣（部位）
    const R=getAutoSellRules();R.equip.arm={on:true,max:15};R.protectBless=R.protectAnc=R.protectAttr=R.protectSet=R.protectLegend=false;R.parts={helm:false};R.delaySec=10;R.protectCraftEquip=false;
    player.autoSellOn=true;bl.junk=true;   // 之前就標著的也不能賣
    out.dec=[_autoSellDecision(bl).sell,_autoSellDecision(pl).sell,_autoSellDecision(hm).sell];out.decAn=JSON.stringify(_autoSellDecision(an))+JSON.stringify(an);
    applyAutoSellRules(true);out.decAn+=' J'+an.junk+an.lock+an._autoSellQty;autoSellJunk(true);out.decAn+=' after '+JSON.stringify(an);
    out.afterSell=[inInv(bl),inInv(an),inInv(pl),inInv(hm),inInv(dm)];
    out.tmpLeft=player.inv.filter(i=>i._igTmp).length;out.blLock=!!bl.lock;
    // 倉庫
    mapState.current='town_giran';
    const an2=add(arm[1],{anc:true}),pl2=add(arm[4]);
    whDeposit(an2.uid,1);out.depAnc=inInv(an2);
    whDepositShown(()=>true);out.restored=player.inv.filter(i=>i.lock||i._igTmp).length;   // 存檔失敗→核心深拷貝還原，暫時鎖也不能留下
    window.whTxnCommit=()=>true;
    whDepositShown(()=>true);out.depShown=[inInv(an2),inInv(pl2),inInv(bl)];
    out.tmpLeft2=player.inv.filter(i=>i._igTmp||i.lock).length;
    // 存檔不寫暫時鎖
    IG.lockOn('store');let snap=null;const os=window.saveGame;
    const A2=()=>player.inv.find(x=>x.uid===an2.uid);out.lockedDuring=A2().lock;
    IG.lockOff();out.lockedAfter=!!A2().lock;
    // 倉庫條件存入：完整詞條
    const F=__afkWhFilter;F.state.affix={dmark:true};F.state.cat='all';F.state.en=-1;
    const dm2=add(arm[3],{dmark:true});out.wf=[F.match(dm2),F.match(pl2||dm2)&&false,F.depositable().some(x=>x.uid===an2.uid)];
    // 視窗
    openItemGuard();const m=document.getElementById('afk-ig-modal');out.modal=[m.querySelectorAll('input[data-ig="sell"]').length,m.querySelectorAll('input[data-ig="store"]').length];
    const cb=m.querySelector('input[data-ig="sell"][data-k="dmark"]');cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));
    out.dmSell=IG.blocked(dm2,'sell');m.remove();
    // 強化值
    IG.cfg().sellEn=7;const e7=add(arm[2],{en:7});out.en=[IG.blocked(e7,'sell'),IG.blocked(Object.assign({},e7,{en:6}),'sell')];
    return out;
  });
  assert.equal(r.on,true);assert.equal(r.n,20);
  assert.equal(r.sellBl,true,'手動販賣被擋');
  assert.equal(r.why,'遠古系（任一）');
  assert.deepEqual(r.can,[false,true],'快速廢品勾不到');
  assert.equal(r.junkBl,false,'不能標廢品');
  assert.deepEqual(r.dec,[false,true,false],'自動販賣決策：保護、普通、排除部位');
  assert.deepEqual(r.afterSell,[true,false,false,true,false],'一鍵賣出：祝福的留下、頭盔留下（不能存的照賣）');
  assert.equal(r.tmpLeft,0);assert.equal(r.blLock,false,'暫時鎖還原');
  assert.equal(r.depAnc,true,'單件存入被擋');
  assert.deepEqual(r.depShown,[true,false,false],'存入目前顯示：遠古留下');
  assert.equal(r.tmpLeft2,0);assert.equal(r.restored,0,'交易還原後沒有殘留的暫時鎖');
  assert.deepEqual([r.lockedDuring,r.lockedAfter],[true,false]);
  assert.deepEqual(r.wf,[true,false,false]);
  assert.deepEqual(r.modal,[20,20]);assert.equal(r.dmSell,true);
  assert.deepEqual(r.en,[true,false]);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-itemguard: ok');
}finally{await browser.close();}
