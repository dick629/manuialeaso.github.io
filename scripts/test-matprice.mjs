// test-matprice.mjs — 材料賣價重算（afk-matprice.js）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={console:{log(){},warn(){}},document:{readyState:'complete',addEventListener(){},getElementById(){return null},createElement(){return {style:{},classList:{add(){},remove(){}}}},body:{appendChild(){}}},localStorage:{getItem(){return null},setItem(){}},setTimeout(){},setInterval(){},clearInterval(){},clearTimeout(){},Math,JSON,Date,performance:{now:()=>0},navigator:{},location:{search:'',hostname:''},addEventListener(){},requestAnimationFrame(){return 0},cancelAnimationFrame(){}};
ctx.window=ctx;vm.createContext(ctx);
const run=s=>vm.runInContext(s,ctx);
const load=f=>run(fs.readFileSync(path.join(root,f),'utf8'));
for(const f of ['js/00-data.js','js/01-drops-config.js','js/13-shop-save.js','js/14-craft-pandora.js'])load(f);
run(`function getAttrAffix(){return null}
function getSellPrice(item){let d=DB.items[item.id];if(!d)return 0;let price=Math.floor((d.p||0)*0.3),mult=1;if(item.bless===true)mult*=10;if(item.anc)mult*=10;return price*mult;}`);
load('afk-matprice.js');
const M=ctx.AFK_MATPRICE,DB=run('DB');assert.ok(M);
const sp=id=>run(`getSellPrice({id:${JSON.stringify(id)}})`);
// 材料最低 500，且依等級／稀缺／需求遞增
for(const id of Object.keys(DB.items)){const d=DB.items[id];if(!M.isMat(d))continue;const v=sp(id);if(M.calc(id)>0)assert.ok(v>=500,id+' '+v);assert.ok(v>=Math.floor((d.p||0)*0.3),'不能比原本低 '+id);}
assert.ok(sp('new_item_153')>sp('new_item_151'),'高品質鑽石要比鑽石貴');   // 稀缺
assert.ok(sp('new_item_183')>=500);   // 骨頭碎片
// 商店有賣的不動
const shop=new Set();for(const k in run('SHOP_LISTS'))for(const it of run('SHOP_LISTS')[k]||[])shop.add(typeof it==='string'?it:it.id);
for(const id of shop){const d=DB.items[id];if(M.isMat(d))assert.equal(sp(id),Math.floor((d.p||0)*0.3),'商店材料不能變貴 '+id);}
// 裝備／藥水不受影響；祝福倍率照舊
assert.equal(sp('wpn_longsword'),Math.floor(DB.items.wpn_longsword.p*0.3));
assert.equal(run(`getSellPrice({id:'wpn_longsword',bless:true})`),Math.floor(DB.items.wpn_longsword.p*0.3)*10);
// 上限合理
for(const id of Object.keys(DB.items)){if(M.isMat(DB.items[id]))assert.ok(M.calc(id)<=30000,id);}
console.log('test-matprice: ok');
