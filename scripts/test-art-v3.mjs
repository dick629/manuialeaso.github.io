// test-art-v3.mjs — GPT變身檔：圖檔齊全、開關預設關、開了才換外觀、離線快取涵蓋（玩家 2026-10-28）
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// 1) 圖檔：每個角色三方向（聖衣另有翅膀版）、每個動作的張數都齊，沒有變身動作
const W={};new Function('window',readFileSync(path.join(root,'art-v3/game-data.js'),'utf8'))(W);
const D=W.AFK_ART_V3_DATA;
assert.equal(D.characters.length,80);
assert.ok(!('morph' in D.counts),'不放變身動作');
let n=0;
for(const c of D.characters)for(const dir of ['right','left','rear'])for(const wing of c.wing?[false,true]:[false]){
  const dirp=path.join(root,'art-v3/frames',c.id+'-'+dir+(wing?'-wing':''));
  for(const [a,k] of Object.entries(D.counts))for(let i=0;i<k;i++){assert.ok(existsSync(path.join(dirp,a+'_'+i+'.png')),dirp+' '+a+'_'+i);n++;}
  assert.equal(readdirSync(dirp).length,Object.values(D.counts).reduce((s,v)=>s+v,0),dirp+' 多出檔案');
}
assert.equal(n,14352);
// 2) 載入與離線快取
const idx=readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(/art-v3\/game-data\.js\?v=[0-9a-f]{10}/.test(idx)&&/afk-art-v3\.js\?v=[0-9a-f]{10}/.test(idx));
assert.ok(readFileSync(path.join(root,'sw.js'),'utf8').includes("'/art-v3/frames/'"),'圖桶涵蓋 art-v3/frames');
// 3) 遊戲內：開關名稱、預設關、開了才換、裝備變身仍優先
const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
  const r=await page.evaluate(()=>{
    __profile({cls:'knight',lv:100});
    const T=AFK_TOGGLES,A=AFK_CARD_ASCENSION,row=A.catalog.mythic.find(x=>x.n==='神話・巴列斯'),z=A.catalog.samsara.find(x=>x.n==='金牛座聖衣');
    const reg=T.list?T.list().find(x=>x.id==='art-v3'):null;
    const out={name:reg&&reg.name,def:T.enabled('art-v3')};
    A.acquire(row.id);player.poly=JSON.parse(JSON.stringify(row.form));player.buffs.poly=999;
    out.off=_actorBattleForm(player).base;
    T.set('art-v3',true);out.on=_actorBattleForm(player).base;
    A.acquire(z.id);A.acquire(z.id);player.poly=JSON.parse(JSON.stringify(z.form));
    out.wing=_actorBattleForm(player).base;T.set('art-v3-wings',false);out.noWing=_actorBattleForm(player).base;T.set('art-v3-wings',true);
    player.poly=null;player.buffs.poly=0;out.none=(_actorBattleForm(player)||{}).base||'';
    T.set('art-v3',false);
    return out;
  });
  assert.equal(r.def,false,'預設關');
  if(r.name!=null)assert.equal(r.name,'GPT變身檔');
  assert.ok(!/art-v3/.test(r.off),'關著用原本的圖 '+r.off);
  assert.equal(r.on,'art-v3/frames/form-001-right/');
  assert.equal(r.wing,'art-v3/frames/form-069-right-wing/');
  assert.equal(r.noWing,'art-v3/frames/form-069-right/');
  assert.ok(!/art-v3/.test(r.none),'沒變身不換');
  assert.deepEqual(errors,[]);
  await close();
  console.log('test-art-v3: ok');
}finally{await browser.close();}
