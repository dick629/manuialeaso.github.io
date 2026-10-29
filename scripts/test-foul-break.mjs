// test-foul-break.mjs — 妖精汙濁之水沖散物理免疫（玩家 2026-10-30 03:05）
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'elf',lv:80});player.elfEle='water';player.skills=['sk_elf_muddywater'];player.mp=5000;player._afkFoulCdUntil=0;
    mapState.current='aden_field';mapState.mobs=[null,null,null,null,null];
    const a=__afkLore.boss.place(0,DB.mobs.afk_ttmi_72,{mobId:'afk_ttmi_72'}),b=__afkLore.boss.place(1,DB.mobs.afk_ttmi_72,{mobId:'afk_ttmi_72'}),c=__afkLore.boss.place(2,DB.mobs.afk_ttmi_72,{mobId:'afk_ttmi_72'});
    a._reflectWall={kind:'phys',until:state.ticks+100,block:true};b._reflectWall={kind:'melee',until:state.ticks+100,block:true};c._reflectWall={kind:'magic',until:state.ticks+100,block:true};
    mapState.targetIdx=0;const ok=castSkill('sk_elf_muddywater');
    const out={ok:!!ok,a:a._reflectWall,b:b._reflectWall,c:!!c._reflectWall,desc:/物理免疫/.test(DB.skills.sk_elf_muddywater.desc||'')};
    // 傭兵
    a._reflectWall={kind:'phys',until:state.ticks+100,block:true};const al={cls:'elf',_allyName:'精',lv:80,mp:5000,d:{},eq:{},buffs:{},statuses:{}};
    try{allyCastMagic(al,DB.skills.sk_elf_muddywater);}catch(e){out.err=String(e).slice(0,80);}out.ally=a._reflectWall;
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.ok,true);assert.equal(r.a,null,'phys 免疫解除');assert.equal(r.b,null,'近距離免疫解除');assert.equal(r.c,true,'魔法免疫不動');assert.equal(r.desc,true);
  assert.equal(r.ally,null,'傭兵施放也行 '+(r.err||''));
  assert.deepEqual(errors,[]);await close();console.log('test-foul-break: ok');
}finally{await browser.close();}
