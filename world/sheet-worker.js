'use strict';
// Crop the original lossless atlas away from the gameplay thread. The original size is
// retained even for frames with entirely transparent borders.
async function split({url,group}){
  const response=await fetch(url);
  if(!response.ok)throw Error('讀取圖集失敗');
  const image=await createImageBitmap(await response.blob());
  const [, ,frames,cols,width,height,cells,sizes]=group;
  const count=cells?.length?Math.max(...cells)+1:frames;
  const output=[];
  try{
    const canvas=new OffscreenCanvas(width,height);
    const context=canvas.getContext('2d');
    for(let i=0;i<count;i++){
      const [w,h]=sizes?.[i]||[width,height];
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      else context.clearRect(0,0,w,h);
      context.drawImage(image,i%cols*width,Math.floor(i/cols)*height,w,h,0,0,w,h);
      output.push(await canvas.convertToBlob({type:'image/png'}));
    }
  }finally{image.close();}
  return output;
}
const queue=[];
let running=0;
async function consume(){
  running++;
  while(queue.length){
    const task=queue.shift();
    try{self.postMessage({id:task.id,blobs:await split(task)});}
    catch{self.postMessage({id:task.id});}
  }
  running--;
}
self.onmessage=({data})=>{queue.push(data);if(running<4)consume();};
