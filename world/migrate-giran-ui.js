'use strict';
(()=>{
 const box=document.createElement('section');box.className='panel';box.id='giran-import';
 box.innerHTML='<h2>奇岩城舊角色搬家</h2><p>選擇舊奇岩城的 saves/characters.json。工具會把可對應的角色、裝備、金幣、倉庫、技能、娃娃與圖鑑、位置書籤、狩獵設定、信箱、簽到進度與歷史紀錄轉成新版存檔。舊紀錄缺少時間時會照原樣標示。經驗保留當級進度比例，99 級保留等級。持有數量、已召喚的娃娃及三種袋盒都會帶入。原版專屬任務與未對應的內容保存在可下載的來源檔。</p><label class="file-zone">選擇奇岩城角色檔<input id="giran-source" type="file" accept=".json,application/json"></label><output aria-live="polite"></output><details hidden><summary>轉換明細</summary><pre></pre></details><div class="actions"><button id="giran-download" disabled>下載轉換後完整備份</button><button id="giran-review" disabled>核對並移入這個瀏覽器</button><button id="giran-original" disabled>取回原版角色檔</button></div>';
 document.getElementById('giran-transfer').after(box);
 let converted=null,sourceText=null,serial=0;
 const q=s=>box.querySelector(s),output=q('output'),original=q('#giran-original');
 const archive=()=>localStorage.getItem('lineage_giran_source_v1');
 function refresh(){original.disabled=!sourceText&&!archive();}
 function download(text,file){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);}
 q('#giran-source').onchange=async e=>{
  const id=++serial;converted=null;sourceText=null;q('details').hidden=true;q('#giran-download').disabled=q('#giran-review').disabled=true;refresh();
  const file=e.target.files[0];if(!file)return;
  try{
   if(file.size>LineageSaveBridge.MAX_TEXT)throw Error('原檔過大，請先在舊版分開匯出。');
   const text=await file.text(),result=await GiranMigration.convert(text);if(id!==serial)return;sourceText=text;converted=result;
   q('pre').textContent=[...result.rows.map(x=>x.name+' Lv.'+x.level+'　金幣 '+x.gold+'　物品 '+x.items+'　技能 '+x.skills),...result.notes.map(x=>x.owner+'　'+x.detail)].join('\n');
   q('details').hidden=false;output.textContent='已整理 '+result.rows.length+' 位角色、倉庫 '+result.warehouse.items.length+' 件物品，另有 '+result.notes.length+' 筆僅保留於原檔。';
   q('#giran-download').disabled=q('#giran-review').disabled=false;refresh();
  }catch(error){if(id===serial)output.textContent=error.message;}
 };
 q('#giran-download').onclick=()=>{if(converted)download(JSON.stringify(converted.bundle),'奇岩城角色移轉.json');};
 q('#giran-review').onclick=async()=>{
  if(!converted)return;
  try{const file=new File([JSON.stringify(converted.bundle)],'奇岩城角色移轉.json',{type:'application/json'}),input=document.getElementById('save-file'),data=new DataTransfer();data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('giran-transfer-reset'));await LineageRecoveryUI.inspectTransfer(file);document.getElementById('full-options').scrollIntoView({block:'center'});}catch(e){output.textContent=e.message;}
 };
 original.onclick=()=>{const text=sourceText||archive();if(text)download(text,'characters.json');};
 window.addEventListener('lineage-full-restored',refresh);refresh();
})();
