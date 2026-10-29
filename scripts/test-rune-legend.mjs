// test-rune-legend.mjs — 傳說符文「破」：命中吸收 MP＝面板傷害、冷卻 3 秒、全身一顆、平衡點數 +5% 傷害、佐爾頓兌換與合成、時空裂痕前 12 分鐘掉落（玩家 2026-10-29）
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
  // 佐爾頓合成：同階 3 顆＋哀石結晶 10 → 高一階隨機；先用重複的
  const c=await page.evaluate(()=>{
    const RD=__afkRuneData,Z=__afkRunes,out={};
    player.inv=player.inv.filter(i=>!/^afk_rune_|afk_lament_gem/.test(i.id));
    const s1=RD.list.filter(r=>r.stage===1);
    gainItem(s1[0].id,3,true,true);gainItem(s1[1].id,1,true,true);gainItem('afk_lament_gem',10,true,true);
    out.got=Z.act.combine(1);out.stage=RD.byId[out.got]&&RD.byId[out.got].stage;
    out.left0=player.inv.filter(i=>i.id===s1[0].id).reduce((n,i)=>n+(i.cnt||1),0);out.left1=player.inv.filter(i=>i.id===s1[1].id).reduce((n,i)=>n+(i.cnt||1),0);
    out.gem=player.inv.filter(i=>i.id==='afk_lament_gem').length;
    out.again=Z.act.combine(1);out.top=Z.act.combine(3);
    return out;
  });
  assert.equal(c.stage,2);assert.equal(c.left0,0,'先用重複的');assert.equal(c.left1,1);assert.equal(c.gem,0);
  assert.ok(/需要/.test(c.again));assert.ok(/不能合成/.test(c.top),'階段三不合成傳說');
  // 時空裂痕（席琳模式）前 12 分鐘每次擊殺 1% 掉「破」，一趟最多一顆
  const d=await page.evaluate(()=>{
    const R2=__afkRift2,out={pct:R2.DROP.legend,min:R2.TUNE.clearMin*R2.DROP.legendPct};
    player.inv=player.inv.filter(i=>i.id!=='afk_rune_po_l');
    player.sherineWorld=true;player.sherineMad=false;player.sherineDream=false;
    state.riftRun={};mapState.current='rift_battle';state._r2Mode='sherine';state._r2Legend=false;
    const kill=(min)=>{state.ticks=1e6;state._r2Start=state.ticks-min*600;mapState.mobs=[{n:'裂痕怪',lv:30,hp:10,curHp:0,exp:1,st:{}},null,null,null,null];try{killMob(0);}catch(e){}};
    const or=Math.random;Math.random=()=>0.001;
    kill(5);out.early=player.inv.filter(i=>i.id==='afk_rune_po_l').length;
    kill(6);out.cap=player.inv.filter(i=>i.id==='afk_rune_po_l').length;
    state._r2Legend=false;kill(13);out.late=player.inv.filter(i=>i.id==='afk_rune_po_l').length;
    state._r2Legend=false;state._r2Mode='mad';kill(3);out.mad=player.inv.filter(i=>i.id==='afk_rune_po_l').length;
    Math.random=or;state.riftRun=null;mapState.current='training';
    return out;
  });
  // 三符文連線：防具跨件（盔甲→頭盔…）、飾品跨件（戒指 1～4→耳環→項鍊→腰帶）
  const L=await page.evaluate(()=>{
    const RD=__afkRuneData,FX=__afkRuneFx,id=ch=>RD.list.find(r=>r.ch===ch&&r.stage<4).id;
    const pick=sl=>Object.keys(DB.items).find(k=>DB.items[k].slot===sl&&!DB.items[k].relic&&!/~/.test(k));
    const mk=(sl,socks)=>({id:pick(sl),en:0,uid:'L'+sl+Math.random(),sockets:socks});
    player.eq.armor=mk('armor',[id('盾'),id('罩')]);player.eq.helm=mk('helm',[id('淨'),null]);
    player.eq.ring1=mk('ring',[id('穗')]);player.eq.ring2=mk('ring',[id('豐')]);player.eq.ring3=mk('ring',[id('尋')]);
    FX.bump();const a=[FX.Wd(player,'vajra'),FX.Wd(player,'harvest')];
    player.eq.helm.sockets=[null,id('淨')];FX.bump();a.push(FX.Wd(player,'vajra'));   // 中間隔一個空孔就不連
    return a;
  });
  assert.deepEqual(L,[1,1,0],'跨件連線成立；中間空孔不連');
  assert.equal(d.pct,0.01);assert.equal(d.min,12);
  assert.deepEqual([d.early,d.cap,d.late,d.mad],[1,1,1,1],'前 12 分鐘、一趟一顆、只限席琳模式');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-rune-legend: ok');
}finally{await browser.close();}
