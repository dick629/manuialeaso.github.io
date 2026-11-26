(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../merged/save-bridge.js'));
  else root.GiranSaveComparison=factory(root.LineageSaveBridge);
})(globalThis,function(bridge){
  'use strict';
  const transient=new Set(['fb5_active_role_sessions_v1','lineage_admin_receipts_v1','lineage_growth_transaction_backup_v1','afk_clock_v1']);
  function inspect(text,signature=value=>value,withRecords=false){
    const parsed=bridge.inspect(text),full=parsed.kind==='full';
    const entries=full?bridge.roleKeys(parsed.keys).map(slot=>[slot,bridge.decode(parsed.keys[slot])]):[['角色',parsed]];
    const roles=entries.map(([slot,role])=>{
      bridge.validateRole(role.value);
      const p=role.value.p;
      const row={slot,name:p.name||p.cls,level:p.lv,party:1+(p.allies?.length||0),items:p.inv.length,
        equipment:Object.values(p.eq).filter(Boolean).length,hash:signature(role.payload)};
      if(withRecords)row.record=role.value;
      return row;
    });
    const shared={};
    if(full){
      const slots=new Set(roles.map(r=>r.slot));
      for(const [key,value] of Object.entries(parsed.keys)){
        if(!slots.has(key)&&!transient.has(key)&&!key.startsWith('afk_diag_'))shared[key]=signature(value);
      }
    }
    return {format:parsed.kind,roles,shared};
  }
  function compare(a,b){
    const hashes=side=>Object.fromEntries(side.roles.map(r=>[r.slot,r.hash]));
    const different=(left,right)=>[...new Set([...Object.keys(left),...Object.keys(right)])].filter(key=>left[key]!==right[key]);
    return {roles:different(hashes(a),hashes(b)),shared:different(a.shared,b.shared),formatsDiffer:a.format!==b.format};
  }
  function fields(left,right){
    if(!left||!right)return [];
    const changes=[];
    const readable=new Set(['p.name','p.cls','p.lv','p.exp','p.hp','p.mp','p.gold','p.dead','p.rebirth','ms.current','ticks','v']);
    for(const section of ['p','ms','']){
      const a=section?left[section]||{}:left,b=section?right[section]||{}:right;
      for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
        if(!section&&(key==='p'||key==='ms'))continue;
        if(JSON.stringify(a[key])===JSON.stringify(b[key]))continue;
        const row={path:(section?section+'.':'')+key};
        const simple=value=>value==null||typeof value==='number'||typeof value==='boolean'||(typeof value==='string'&&value.length<90);
        if(readable.has(row.path)&&simple(a[key])&&simple(b[key])){row.source=a[key]??null;row.target=b[key]??null;}
        changes.push(row);
      }
    }
    return changes;
  }
  return {inspect,compare,fields};
});
