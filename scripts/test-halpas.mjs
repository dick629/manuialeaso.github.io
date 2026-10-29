// test-halpas.mjs — 終章「闇龍的低語」＋火焰之影（真身）＋闇龍 哈爾巴斯＋反王肯恩／死亡騎士重做（玩家 2026-10-29）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    const L=__afkLore,H=__afkHalpas,B=L.boss,out={on:AFK_TOGGLES.enabled('lorehalpas')};
    __profile({cls:'royal',lv:100});player.trialQ={};
    const line=H.line,k=i=>L.keyOf(line,i,'royal');out.ch=line.chapters.length;
    out.mem=line.chapters[2].reqs.map(q=>q.mobs.length);
    // 順序與真的掉落：第 2 章 反王肯恩(謀叛)
    trialQAccept(k(1),'afkLoreRender_halpas');out.lock=trialQState(k(1));
    player.trialQ[k(0)]=2;trialQAccept(k(1),'afkLoreRender_halpas');
    mapState.current='afk_traitor_whisper';mapState.mobs=[null,null,null,null,null];
    const kn=B.place(0,DB.mobs.afk_traitor_ken,{mobId:'afk_traitor_ken'});kn.curHp=0;killMob(0);
    out.letter=player.inv.some(i=>i.id==='afk_q_hp_letter');
    // 套裝
    H.SET.forEach((id,i)=>{player.eq[['helm','gloves','boots','armor'][i]]={id,uid:'D'+i,en:0,cnt:1};});recomputeStats();
    const b=L.setBonus(player);out.set=[b.extraDmg,b.mhp,b.mdmg,b.dr];
    // 反王肯恩 重做
    mapState.current='pride_41_50';mapState.mobs=[null,null,null,null,null];
    const ke=B.place(0,DB.mobs.afk_boss_kenrauhel,{mobId:'afk_boss_kenrauhel'});
    player.buffs=player.buffs||{};player.buffs.sk_royal_precise=10;
    const other=B.place(2,DB.mobs.b_knight,{mobId:'b_knight'});
    out.fragK=fragileMult(ke);out.fragO=fragileMult(other);
    ke.curHp=Math.floor(ke.hp*0.49);H.tick();out.kguard=mapState.mobs.filter(m=>m&&m.n==='黑騎士親衛').length;
    // 死亡騎士 重做
    mapState.current='zone_10';mapState.mobs=[null,null,null,null,null];
    const dk=B.place(0,DB.mobs.dk,{mobId:'dk'});dk.curHp=Math.floor(dk.hp*0.29);H.tick();out.dkskel=mapState.mobs.filter((m,i)=>m&&i>0&&!m._dead).length;
    // 火焰之影（真身）
    out.noFlame=H.canEnter('flame');
    player.trialQ[k(1)]=2;player.trialQ[k(2)]=2;trialQAccept(k(3),'afkLoreRender_halpas');
    player.allies=[1,2,3].map(i=>({cls:'knight',lv:100,curHp:5000,mhp:5000,mp:100,mmp:100,_allyName:'傭兵'+i,eq:{}}));
    out.enterF=H.enter('flame');out.mapF=mapState.current;out.scaleF=H.run().scale;
    spawnMob(0);spawnMob(1);const fl=mapState.mobs[1];out.flame=!!fl&&fl.afkHp==='flame'&&fl.hp===Math.round(400000*H.run().scale)&&!mapState.mobs[0];
    player.hp=player.mhp;const hp0=player.hp;H.tick();state.ticks+=10;H.tick();out.burn=hp0-player.hp>0;
    fl.curHp=Math.floor(fl.hp*0.79);H.tick();out.guards=mapState.mobs.filter(m=>m&&!m._dead&&/火焰之影親衛兵/.test(m.n)).length;
    mapState.mobs.forEach((m,i)=>{if(m&&i!==1)mapState.mobs[i]=null;});
    state.ticks=fl._hpA;H.tick();out.mark=(fl._hpMark||[]).length;
    const a0=player.allies.map(a=>a.curHp);player.hp=player.mhp;const p0=player.hp;state.ticks=fl._hpMarkAt;H.tick();
    out.share=player.allies.every((a,i)=>a.curHp<a0[i])&&player.hp<p0;
    fl.curHp=Math.floor(fl.hp*0.09);H.tick();const c1=fl.curHp;state.ticks+=10;H.tick();out.regen=fl.curHp>c1;
    fl.curHp=0;killMob(1);out.core=player.inv.some(i=>i.id==='afk_q_hp_core');out.fdone=H.run().done;
    trialQComplete(k(3),'afkLoreRender_halpas');out.cloak=player.inv.some(i=>i.id==='afk_hp_flame_cloak');
    // 闇龍 哈爾巴斯
    trialQAccept(k(4),'afkLoreRender_halpas');
    out.enterH=H.enter('halpas');out.scaleH=H.run().scale;out.bless=H.run().bless;
    spawnMob(1);const hp=mapState.mobs[1];out.halpas=!!hp&&hp.hp===Math.round(1500000*0.25);
    H.tick();state.ticks=hp._hpB;out.p1=!!hp._hpPhase;H.tick();
    hp.curHp=Math.floor(hp.hp*0.6);H.tick();state.ticks=hp._hpB;H.tick();out.echo=hp._hpEcho;
    hp.curHp=Math.floor(hp.hp*0.3);state.ticks=Math.max(state.ticks,hp._hpC);const php=player.hp;H.tick();out.blocked=H.run().bless===0&&player.hp===php;
    player.hp=player.mhp;const ph2=player.hp,hc=hp.curHp;state.ticks=hp._hpC;H.tick();out.devour=player.hp<ph2&&hp.curHp>hc;
    const sc0=player.inv.filter(i=>i.id===H.SCALE).reduce((s,i)=>s+(i.cnt||1),0);
    hp.curHp=0;killMob(1);out.scaleGain=player.inv.filter(i=>i.id===H.SCALE).reduce((s,i)=>s+(i.cnt||1),0)-sc0;out.rev=player.inv.some(i=>i.id==='afk_q_hp_scale');
    trialQComplete(k(4),'afkLoreRender_halpas');out.armor=player.inv.some(i=>i.id==='afk_hp_armor');
    // 限時
    out.enterH2=H.enter('halpas');spawnMob(1);state.ticks=H.run().start+H.LIMIT;H.tick();out.timeout=H.run().done;
    // 交換
    gainItem(H.SCALE,20,true);gainItem(H.HEART,1,true);out.ex=H.exchange('eye');out.eye=player.inv.some(i=>i.id==='afk_hp_eye');
    // 面板
    const div=document.getElementById('interaction-content')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'interaction-content'}));
    div.innerHTML='';L.render(line,div);H.renderPanel(div);out.ui=/闇龍的低語 1／5/.test(div.textContent)&&!!div.querySelector('#afk-hp-panel');
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.on,true);assert.equal(r.ch,5);assert.ok(r.mem.every(n=>n>=1),'四龍都有怪 '+r.mem);
  assert.equal(r.lock,0);assert.equal(r.letter,true);
  assert.deepEqual(r.set,[5,300,2,2]);
  assert.ok(r.fragK<r.fragO&&r.fragK>1,'篡位者的威壓 '+r.fragK+' / '+r.fragO);assert.equal(r.kguard,2);assert.equal(r.dkskel,4);
  assert.match(r.noFlame,/第 4 章/);
  assert.equal(r.enterF,true);assert.equal(r.mapF,'afk_flame_depth');assert.equal(r.flame,true);assert.equal(r.burn,true);
  assert.equal(r.guards,4);assert.equal(r.mark,2);assert.equal(r.share,true);assert.equal(r.regen,true);
  assert.equal(r.core,true);assert.equal(r.fdone,true);assert.equal(r.cloak,true);
  assert.equal(r.enterH,true);assert.equal(r.scaleH,0.25);assert.equal(r.bless,1);assert.equal(r.halpas,true);
  assert.equal(r.echo,0);assert.equal(r.blocked,true);assert.equal(r.devour,true);
  assert.ok(r.scaleGain>=3);assert.equal(r.rev,true);assert.equal(r.armor,true);
  assert.equal(r.enterH2,true);assert.equal(r.timeout,true);
  assert.equal(r.ex,null);assert.equal(r.eye,true);assert.equal(r.ui,true);
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-halpas: ok');
}finally{await browser.close();}
