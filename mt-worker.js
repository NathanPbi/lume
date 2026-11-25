/* MagicTouch em um worker separado: não conflita com o detector de mão da página */
importScripts('vision_bundle.js');
let seg=null,boot=null;
function init(){if(boot)return boot;boot=(async()=>{const fs=await Vision.FilesetResolver.forVisionTasks('./');const parts=await Promise.all(['magic-0.wasm','magic-1.wasm','magic-2.wasm'].map(async u=>{const r=await fetch(u);return r.ok?new Uint8Array(await r.arrayBuffer()):new Uint8Array(0)}));const buf=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){buf.set(p,o);o+=p.length}
 seg=await Vision.InteractiveSegmenter.createFromOptions(fs,{baseOptions:{modelAssetBuffer:buf,delegate:'CPU'},outputCategoryMask:false,outputConfidenceMasks:true});return seg})();return boot}
self.onmessage=async e=>{const d=e.data;try{await init();if(d.init){postMessage({id:d.id,ok:true});return}
 seg.setImage(d.bitmap);const st=[{brushMode:1,point:d.pos,isCompleted:true}];if(d.neg&&d.neg.length)st.push({brushMode:2,point:d.neg,isCompleted:true});
 const m=seg.segment(st),a=new Float32Array(m.getAsFloat32Array()),w=m.width,h=m.height;m.close();d.bitmap.close&&d.bitmap.close();postMessage({id:d.id,w,h,a},[a.buffer])}catch(err){postMessage({id:d.id,err:String(err&&err.message||err)})}};
