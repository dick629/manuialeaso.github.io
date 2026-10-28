// test-class-saga.mjs — 八職業 55～80 級專屬劇情（afk-class-saga.js）
//   ‧48 章都登錄成試煉、道具與怪物都存在、腰帶 8 條
//   ‧接取要先完成前一章、要達等級；只有接取中且未集滿才掉（不吃試煉批次兌換的持續掉落）
//   ‧交付：扣道具、第一次給經驗與祝福卷軸、第六章給傳承腰帶
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fakeElement=()=>({innerHTML:'',value:'',style:{},className:'',classList:{contains(){return true},add(){},remove(){}},remove(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []}});
const nodes={'interaction-content':fakeElement()};
const listeners=[];
const ctx={console:{log(){},warn(){},info(){}},document:{readyState:'loading',addEventListener(t,f){if(t==='DOMContentLoaded')listeners.push(f)},getElementById(id){return nodes[id]||null},createElement:fakeElement,body:fakeElement(),head:fakeElement(),documentElement:fakeElement()},
  location:{hostname:'localhost',search:''},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},Math,Date,JSON,performance:{now:()=>0}};
ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
const run=s=>vm.runInContext(s,ctx);
const load=f=>run(fs.readFileSync(path.join(root,f),'utf8'));
for(const f of ['js/00-data.js','js/01-drops-config.js','js/12-npc-quests.js'])load(f);
let saved=0;
run(`
var __logs=[];function logSys(h){__logs.push(String(h))} function logCombat(){} function renderTabs(){} function updateUI(){} function closeNpcInteraction(){}
function saveGame(){window.__saved=(window.__saved||0)+1}
function checkLvUp(){}
var __uid=0;
function gainItem(id,n,silent){n=n||1;var it=player.inv.find(x=>x.id===id&&!x.lock);if(it)it.cnt+=n;else player.inv.push({id:id,uid:'u'+(++__uid),cnt:n});return {id:id}}
function questCountId(id){return player.inv.filter(i=>i.id===id&&!i.lock).reduce((s,i)=>s+(i.cnt||0),0)}
function lockedCountId(id){return 0}
function questConsumeId(id,n){for(const it of player.inv){if(n<=0)break;if(it.id!==id||it.lock)continue;var k=Math.min(n,it.cnt);it.cnt-=k;n-=k;}player.inv=player.inv.filter(i=>i.cnt>0)}
function interactNPC(){}
`);
// 試煉批次兌換（會放寬掉落閘）先載，劇情外掛排在它後面
load('afk-retrial.js');load('afk-class-saga.js');
listeners.forEach(f=>f());
const S=ctx.AFK_CLASS_SAGA;assert.ok(S,'外掛沒有載入');
const DB=run('DB'),TQ=run('TRIAL_Q'),MD=run('MOB_DROPS');
assert.equal(S.chapters.length,48);
for(const q of S.chapters){
  assert.ok(TQ[q.key],'沒登錄試煉 '+q.key);assert.equal(TQ[q.key].cls,q.cls);assert.equal(TQ[q.key].lv,q.lv);
  assert.ok(DB.items[q.item]&&DB.items[q.item].questItem);
  for(const m of q.mobs){assert.ok((MD[m]||[]).some(x=>x[0]===q.item&&x[1]===1),'沒掉落 '+q.item);}
}
for(const c of S.order){const b=DB.items[S.saga[c].belt.id];assert.ok(b&&b.slot==='belt'&&b.req===c);assert.equal(JSON.stringify(TQ['saga80_'+c].rewards),JSON.stringify([S.saga[c].belt.id]));}
assert.equal(new Set(S.chapters.map(q=>q.item)).size,48,'章節道具不能重複');

// 流程
run(`player.cls='elf';player.lv=60;player.inv=[];player.trialQ={};player.exp=0;`);
const P=()=>run('player');
const ch=S.chapters.filter(q=>q.cls==='elf');
assert.equal(ctx.trialItemActive(ch[0].item),false,'沒接取不掉');
ctx.trialQAccept(ch[1].key,'x');assert.equal(P().trialQ[ch[1].key]||0,0,'前一章沒做不能接');
ctx.trialQAccept(ch[0].key,'x');assert.equal(P().trialQ[ch[0].key],1);
assert.equal(ctx.trialItemActive(ch[0].item),true,'接取中要掉');
run(`gainItem(${JSON.stringify(ch[0].item)},${ch[0].need})`);
assert.equal(ctx.trialItemActive(ch[0].item),false,'集滿就不掉');
ctx.trialQComplete(ch[0].key,'x');
assert.equal(P().trialQ[ch[0].key],2);assert.equal(run(`questCountId(${JSON.stringify(ch[0].item)})`),0);
assert.equal(P().exp,Math.floor(run('getExpReq(55)')*0.15));
assert.equal(run(`questCountId('scroll_armor_b')`),1);
assert.equal(ctx.trialItemActive(ch[0].item),false,'完成後不再掉（不吃批次兌換的持續掉落）');
// 等級不到不能接
run(`player.lv=64`);ctx.trialQAccept(ch[2].key,'x');ctx.trialQAccept(ch[1].key,'x');assert.equal(P().trialQ[ch[1].key],1);
run(`gainItem(${JSON.stringify(ch[1].item)},${ch[1].need})`);ctx.trialQComplete(ch[1].key,'x');
ctx.trialQAccept(ch[2].key,'x');assert.equal(P().trialQ[ch[2].key]||0,0,'Lv64 不能接 65 章');
// 一路做完拿腰帶
run(`player.lv=80`);
for(const q of ch.slice(2)){ctx.trialQAccept(q.key,'x');assert.equal(P().trialQ[q.key],1,q.key);run(`gainItem(${JSON.stringify(q.item)},${q.need})`);ctx.trialQComplete(q.key,'x');assert.equal(P().trialQ[q.key],2,q.key);}
assert.equal(run(`questCountId('blt_saga_elf')`),1);
// 別的職業的章節不能接
ctx.trialQAccept('saga55_knight','x');assert.equal(P().trialQ.saga55_knight||0,0);
// 世界觀資料
assert.equal(S.figures.length>=10,true);for(const c of S.order)assert.ok(S.saga[c].now.length>40);
console.log('test-class-saga: ok');
