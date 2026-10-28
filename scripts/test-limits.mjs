// test-limits.mjs — 能力上限（命中 80%、爆傷 500%、消耗減半、減傷 75%、爆擊溢出濺射）（玩家 2026-10-29；星蝕·解移到 test-runes.mjs）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});
    const out={hv:window.__afkHitHv};
    recomputeStats(); player.d.meleeCritDmg=900; window.AFK_CAPS.clamp(player); out.cd=player.d.meleeCritDmg;
    out.mp=player.d.getMpCost(40,1)>=20;
    out.hp=effHpCost({hpCost:100})>=50;
    // 減傷：takenMods 塞一個 ×0.1 → 夾到 ×0.25
    const mods=window.__afkTakenMods; mods.push(()=>0.1); out.taken=window.__afkTaken(player,1000,{n:'x'},'phys'); mods.pop();
    // 爆擊濺射
    const t1={n:'a',hp:1e6,curHp:1e6,uid:'a1',lv:1}, t2={n:'b',hp:1e6,curHp:1e6,uid:'b1',lv:1};
    mapState.mobs=[t1,t2]; player._rawCrit={melee:90,ranged:0,magic:0}; player._afkCrit={t:t1,at:state.ticks};
    const v=AFK_CARD_COMBAT.damage(player,t1,1000,{kind:'melee'}); out.splash=1e6-t2.curHp; out.v=v;
    player._rawCrit={melee:50}; player._afkCrit={t:t1,at:state.ticks}; AFK_CARD_COMBAT.damage(player,t1,1000,{kind:'melee'}); out.noSplash=1e6-t2.curHp===out.splash;
    return out;
  });
  assert.equal(r.hv,15,'命中判定值上限 15（80%）');
  assert.equal(r.cd,500,'爆擊傷害上限 500%');
  assert.ok(r.mp&&r.hp,'消耗最多減半');
  assert.equal(r.taken,250,'百分比減傷最多 75%');
  assert.ok(r.splash>0,'爆擊率滿 80% 才濺射 '+r.splash);
  assert.ok(r.noSplash,'爆擊率沒滿不濺射');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-limits: ok');
}finally{await browser.close();}
