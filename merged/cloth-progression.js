(function(W){
  'use strict';
  const A=W.AFK_CARD_ASCENSION,G=W.LineageGrowth,Z=W.__afkZodiac;
  if(!A||!G||!Z)return;
  const tiers={bronze:{name:'青銅聖衣',scale:.5,next:'silver'},silver:{name:'白銀聖衣',scale:.75,next:'gold'},gold:{name:'黃金聖衣',scale:1,next:'divine'},divine:{name:'神聖衣',scale:1,next:null}};
  const special=Object.freeze(['血魔聖衣','冥聖衣','鐵聖衣','次元聖衣','匣之'].map((name,i)=>Object.freeze({id:['blood_demon','underworld','steel','dimension','casket'][i],name,enabled:false,schools:[],stage:null})));
  const rows=()=>A.catalog.samsara.filter(r=>!r.unique),p=()=>typeof player==='undefined'?null:player;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cloth(actor,id){return actor?.cardAscension?.cloth?.[id]||{};}
  function pendingInBattle(actor,id){return actor===p()&&!!state._afkFinal&&state._afkShatter===id;}
  function stage(actor,id){const c=cloth(actor,id);if(c.ex)return 'divine';if(c.broken||c.recoveryPending&&!pendingInBattle(actor,id))return 'broken';if(c.grade&&!tiers[c.grade])return 'unknown';return c.grade||'gold';}
  // 11-13（Ping 12:23／12:41）：血咒派、守護派的碎裂聖衣可以不修復，直接換成血魔聖衣／鐵聖衣（黃金修復之砂 ×5；略強於神聖衣）
  const IRON=new Set(['守護騎士','守誓君主','不屈戰衛','龍鱗守護者','王盾統帥','森林盾衛','符甲賢者','暗誓衛','鐵壁破陣者','龍盾守望','鏡盾騎士','聖騎士','光輝君主','四季詠者','星輝導師','龍語祭司']);
  const SPN={blood:'血魔聖衣',iron:'鐵聖衣'},SP_COST=5;
  function specialKind(actor){try{const C=W.LineageClassCore,v=actor&&actor.classPath,t=v&&C&&C.trees.get(v.route);if(!t)return null;if(t.category==='血咒派')return 'blood';if(IRON.has(t.name))return 'iron';}catch(e){}return null;}
  function specialForge(id,kind){const actor=p();if(!actor||actor.dead)throw Error('請先復活');if(!/^town_/.test(mapState.current||'')||state._afkFinal)throw Error('請先回村，再找星鑄師');
    if(!A.owned(id,actor))throw Error('尚未持有這件聖衣');if(stage(actor,id)!=='broken')throw Error('只有碎裂的聖衣可以換成新聖衣');const k=specialKind(actor);if(!k||k!==kind)throw Error('目前的流派不能選這件聖衣');
    if(questCountId(Z.SAND)<SP_COST)throw Error('材料不足：'+DB.items[Z.SAND].n+' ×'+SP_COST);
    G.transaction('換成'+SPN[k],()=>{const before=questCountId(Z.SAND);questConsumeId(Z.SAND,SP_COST);if(questCountId(Z.SAND)!==before-SP_COST)throw Error('材料扣除未完成');const s=actor.cardAscension;s.cloth=s.cloth||{};const c=s.cloth[id]=s.cloth[id]||{};Object.assign(c,{grade:'divine',broken:false,recoveryPending:false,ex:true,special:k,dim:false,uses:0,recoveredAt:Date.now()});});
    logSys('<span class="text-amber-200">星鑄師把碎裂的聖衣重新鍛成了 '+esc(SPN[k])+'。原有收藏與星數保留。</span>');}
  function label(actor,id){const s=stage(actor,id),sp=cloth(actor,id).special;if(sp&&SPN[sp])return SPN[sp];return s==='broken'?'碎裂聖衣・待回收':s==='unknown'?'聖衣資料待確認':tiers[s].name;}
  function canWear(id,actor){if(!rows().some(r=>r.id===id))return true;return !['broken','unknown'].includes(stage(actor,id));}
  function scale(id,actor,rule){if(!rows().some(r=>r.id===id))return rule;const factor=tiers[stage(actor,id)]?.scale??0;if(factor===1)return rule;const r={...rule};for(const k of Object.keys(r))if(typeof r[k]==='number')r[k]*=factor;return r;}
  function quote(id,actor){actor=actor||p();const rs=rows(),i=rs.findIndex(r=>r.id===id);if(i<0||!A.owned(id,actor))throw Error('尚未持有這件聖衣');const s=stage(actor,id);
    if(s==='unknown')throw Error('聖衣階級資料無法辨識，請先備份並檢查存檔');
    if(s==='divine')throw Error('已是神聖衣');
    const h=Z.H[i%12],next=s==='broken'?'bronze':tiers[s].next,req=s==='broken'?[]:[{id:Z.SAND,count:3}];
    if(next==='divine')req.push({id:h.seal,count:1});
    return {from:s,next,name:tiers[next].name,req,house:h};
  }
  function upgrade(id){const actor=p();if(!actor||actor.dead)throw Error('請先復活');if(!/^town_/.test(mapState.current||'')||state._afkFinal)throw Error('請先回村，再找星鑄師回收／升階');
    const q=quote(id,actor);for(const r of q.req)if(questCountId(r.id)<r.count)throw Error('材料不足：'+DB.items[r.id].n+' ×'+r.count);
    G.transaction(q.from==='broken'?'回收碎裂聖衣':'聖衣升階',()=>{
      for(const r of q.req){const before=questCountId(r.id);questConsumeId(r.id,r.count);if(questCountId(r.id)!==before-r.count)throw Error('材料扣除未完成');}
      const s=actor.cardAscension;s.cloth=s.cloth||{};const c=s.cloth[id]=s.cloth[id]||{};
      Object.assign(c,{grade:q.next,broken:false,recoveryPending:false,ex:q.next==='divine',dim:false,uses:0});
      if(q.from==='broken')c.recoveredAt=Date.now();
    });
    logSys('<span class="text-amber-200">星鑄師已完成：'+esc(label(actor,id))+'。原有收藏與星數保留。</span>');return q;
  }
  function renderNpc(actor){const K=W.__afkNpcKit;let h='<div class="ax-h">聖衣回收與修練</div><div class="ax-note">最終戰碎裂的舊聖衣，免費回收成青銅，再依序升為白銀、黃金、神聖衣（原 EX）。青銅／白銀的聖衣數值為原黃金的 50%／75%；黃金與神聖衣沿用原數值。原有星數與收藏保留，封印、光輝及冷卻規則照舊。</div><div class="ax-note">青銅→白銀、白銀→黃金：每階黃金修復之砂 ×3；黃金→神聖衣：砂 ×3＋對應宮之印 ×1。神聖衣不再碎裂、不耗光輝，且可升 ★4。持有砂 '+questCountId(Z.SAND)+'</div>';
    for(const row of rows()){if(!A.owned(row.id,actor))continue;const s=stage(actor,row.id),stars=actor.cardAscension.clothStars?.[row.id]||0;let desc='',buttons=[];
      if(s==='divine'){desc='已完成修練；升 ★4 需光輝碎片 ×4、黃金修復之砂 ×1。';buttons=[['star:'+row.id,'升 ★4',stars===3]];}
      else if(s==='unknown')desc='保留資料，請先備份並檢查。';
      else{const q=quote(row.id,actor),cost=q.req.map(x=>DB.items[x.id].n+' ×'+x.count).join('＋')||'不消耗材料';desc='下一階：'+q.name+'；'+cost;buttons=[['ex:'+row.id,s==='broken'?'回收為青銅':'升為'+q.name,true]];const sk=s==='broken'&&specialKind(actor);if(sk){desc+='；或不修復，換成 '+SPN[sk]+'（黃金修復之砂 ×'+SP_COST+'）';buttons.push(['sp:'+row.id+':'+sk,'換成'+SPN[sk],true]);}}
      h+=K.rowHtml({key:row.id,name:row.n+' · '+label(actor,row.id)+' ★'+stars,color:s==='broken'?'#d89488':s==='divine'?'#e7d497':s==='bronze'?'#c8a173':s==='silver'?'#bdcbd8':'#d9bc7d',desc,why:'',btns:buttons},'data-zd');
    }
    h+='<div class="ax-h">流派專屬聖衣</div><div class="ax-note">血咒派可以把碎裂的聖衣直接換成「血魔聖衣」（真實傷害 +5%），守護派（承傷、支援流派）換成「鐵聖衣」（真實減傷 +5%），各要黃金修復之砂 ×5；數值略強於神聖衣，之後一樣能升 ★4。「匣之聖衣」在第三套天賦「匣之」開啟後，所有神聖衣、血魔聖衣、鐵聖衣自動升上去。</div>';return h;
  }
  W.LineageClothProgression={tiers,special,stage,label,canWear,scale,quote,upgrade,renderNpc,canUseSpecial:()=>false,specialKind,specialForge,SPN,SP_COST};
})(window);
