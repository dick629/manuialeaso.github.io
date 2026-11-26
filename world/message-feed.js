'use strict';
window.GiranMessageFeed=(()=>{
  const kinds={combat:'戰鬥',loot:'掉寶',experience:'經驗',system:'系統'},limit=80;
  let channel='',role='',view=null,timer=0,pending=[];
  function mayMatch(row){
    return row.role===role&&(channel==='journal'||row.kind===kinds[channel]||(channel!=='combat'&&row.kind==='系統'));
  }
  function match(row){
    if(!mayMatch(row))return false;
    GiranJournal.normalize(row);
    return (channel==='journal'||row.kind===kinds[channel])&&!!row.text;
  }
  function append(rows,opening=false){
    if(!rows.length)return;
    const follow=opening||view.scrollHeight-view.scrollTop-view.clientHeight<4;
    const fragment=document.createDocumentFragment();
    for(const row of rows.slice(-limit)){
      const line=document.createElement('div');
      GiranJournal.paint(line,row);
      fragment.append(line);
    }
    view.append(fragment);
    while(view.childElementCount>limit)view.firstElementChild.remove();
    if(follow)view.scrollTop=view.scrollHeight;
  }
  function update(){
    timer=0;
    const batch=pending;pending=[];
    append(batch.filter(match));
  }
  function receive(row){
    if(!mayMatch(row))return;
    pending.push(row);
    if(!timer)timer=setTimeout(update,200);
  }
  function show(node,next){
    const nextRole=next&&typeof player!=='undefined'&&player?.cls?(player.name||player.cls):'';
    if(next===channel&&nextRole===role)return;
    GiranJournal.subscribe(null);clearTimeout(timer);timer=0;pending=[];
    channel=next;role=nextRole;view=node;view.replaceChildren();
    view.classList.toggle('ga-log-colors',channel==='journal'||channel==='combat'||channel==='loot'||channel==='system');
    if(!channel||!role)return;
    const history=GiranJournal.subscribe(receive),recent=[];
    for(let i=history.length-1;i>=0&&recent.length<limit;i--){
      if(match(history[i]))recent.push(history[i]);
    }
    append(recent.reverse(),true);
  }
  return {show};
})();
