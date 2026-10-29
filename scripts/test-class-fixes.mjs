// test-class-fixes.mjs — 玩家 2026-10-29 21:07：幻術士修補（疼痛的歡愉、立方：燃燒）、寵物攻擊回全隊 MP、隱藏條件「騎士的負重」、詞條娃娃 0.5%、說明框墊到最上層
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(async()=>{
    const out={on:AFK_TOGGLES.enabled('illufix'),merged:[AFK_TOGGLES.list().some(t=>t.id==='classtweak'),AFK_TOGGLES.list().find(t=>t.id==='illufix').name,DB.skills.sk_illu_cube_harmony.cube.val]};
    __profile({cls:'illusion',lv:80});
    mapState.current='aden_field';mapState.mobs=[null,null,null,null,null];
    const mob=__afkLore.boss.place(0,DB.mobs.afk_ttmi_72,{mobId:'afk_ttmi_72'});
    // 疼痛的歡愉
    const mods=window.__afkTakenMods,mult=e=>mods.reduce((a,f)=>{const v=Number(f(e,mob,'melee'));return v>=0&&isFinite(v)?a*v:a;},1);
    out.noPain=mult(player);player.buffs.sk_illu_pain=100;out.pain=mult(player);
    out.rf=__afkPainRf(player,100,mob);out.expose=mob._afkExpose>state.ticks;
    player.sherineDream=true;player.sherineMad=true;out.rfDream=__afkPainRf(player,100,mob);player.sherineDream=false;player.sherineMad=false;
    const src=await (await fetch('js/04-combat-attack.js')).text(),src6=await (await fetch('js/06-status-allies.js')).text();
    out.patch=(src.split('加掛版補丁:疼痛的歡愉').length-1)+(src6.split('加掛版補丁:疼痛的歡愉').length-1);
    // 立方：燃燒
    const c=DB.skills.sk_illu_cube_burn.cube;out.cube=[c.iv,c.dice];
    player.buffs.sk_illu_pain=0;player.skills=['sk_illu_cube_burn'];player.buffs.sk_illu_cube_burn=200;player._cubeCd={sk_illu_cube_burn:1};
    state.running=true;player.hp=Math.floor(player.mhp/2);player.mp=10;const hp0=player.hp,mob0=mob.curHp;
    cubeTick();state.running=false;
    out.burn=[mob0-mob.curHp,player.hp-hp0,player.mp,mob._afkScorch>state.ticks];
    // 寵物攻擊回全隊 MP
    out.petMp=__afkPetInherit.petMp;
    let called=0;const oT=window.teamRecoverMp;window.teamRecoverMp=n=>{called+=n;};
    try{const pet=petNewInstance(Object.keys(PET_BOOK)[0],30);const d=petDerive(pet);mob.curHp=mob.hp;petAttackOnce(pet,d,mob);}catch(e){out.petErr=String(e).slice(0,80);}
    window.teamRecoverMp=oT;out.petCalled=called;
    // 騎士的負重（測試瀏覽器預設關掉，免得其他騎士傷害測試的數字被它改掉）
    window.__afkTestNoKnightLoad=false;
    __profile({cls:'knight',lv:80});recomputeStats();out.cap=player.d.weightCapacity;
    mapState.mobs=[null,null,null,null,null];const m2=__afkLore.boss.place(0,DB.mobs.afk_ttmi_72,{mobId:'afk_ttmi_72'});
    AFK_CARD_COMBAT.damage(player,m2,100,{kind:'melee'});out.loadAt=player._afkLoadAt-state.ticks;
    const t1=player._afkLoadAt;AFK_CARD_COMBAT.damage(player,m2,100,{kind:'melee'});out.cd=player._afkLoadAt===t1;
    out.hiddenName=AFK_TOGGLES.list().find(t=>t.id==='hiddenbonus').name;
    // 詞條娃娃 0.5%、說明框
    out.doll=__afkDollAffix.RATE;
    out.tipZ=getComputedStyle(Object.assign(document.body.appendChild(document.createElement('div')),{className:'game-tooltip'})).zIndex;
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.on,true);
  assert.equal(r.merged[0],false,'職業技能微調併進幻術士修補');assert.match(r.merged[1],/立方：和諧/);assert.equal(r.merged[2],15);
  assert.equal(r.noPain,1);assert.equal(r.pain,0.5,'疼痛的歡愉 受傷 −50%');
  assert.equal(r.rf,200,'一般模式反彈減傷前（2 倍）');assert.equal(r.rfDream,100,'夢域反彈減傷後');assert.equal(r.expose,true,'蝕刻印記');
  assert.equal(r.patch,3,'核心補丁 69 三處');
  assert.deepEqual(r.cube,[20,[5,10]]);
  assert.ok(r.burn[0]>0,'燃燒有傷害');assert.equal(r.burn[1],r.burn[0]*2,'傷害 2 倍補血');assert.equal(r.burn[2],11,'回 1 MP');assert.equal(r.burn[3],true,'灼熱印記');
  assert.equal(r.petMp,5);assert.equal(r.petCalled,5,'寵物攻擊回全隊 5 MP '+(r.petErr||''));
  assert.ok(r.cap>0);assert.equal(r.loadAt,100,'騎士的負重 10 秒冷卻');assert.equal(r.cd,true);assert.match(r.hiddenName,/騎士的負重/);
  assert.equal(r.doll,0.5);assert.equal(r.tipZ,'100500');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-class-fixes: ok');
}finally{await browser.close();}
