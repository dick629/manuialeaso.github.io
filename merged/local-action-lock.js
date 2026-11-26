'use strict';
// The reward ledgers commit synchronously. An IndexedDB readwrite transaction
// serializes that critical section across tabs on LAN origins without Web Locks.
window.LineageLocalActionLock=(()=>{
  let opening;
  function db(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open('lineage-local-action-lock',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('actions');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const connection=request.result;
        connection.onversionchange=()=>{connection.close();opening=null;};resolve(connection);
      };
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  return async function withActionLock(name,action){
    if(navigator.locks)return navigator.locks.request(name,action);
    const connection=await db();
    return new Promise((resolve,reject)=>{
      const tx=connection.transaction('actions','readwrite');let value,error;
      tx.objectStore('actions').get(name).onsuccess=()=>{
        try{value=action();}catch(e){error=e;tx.abort();}
      };
      tx.oncomplete=()=>resolve(value);
      tx.onabort=()=>reject(error||tx.error||Error('交易中止'));
    });
  };
})();
