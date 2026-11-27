/* Lume · detector de unhas (YOLOv8-seg, modelo nails_seg_yolov8 de mnemic, CC BY 4.0) rodando com onnxruntime-web */
importScripts('ort.wasm.min.js');
const base=self.location.href.replace(/[^/]*$/,'');
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths={mjs:base+'ort-wasm-simd-threaded.mjs.js',wasm:base+'ort-wasm-simd-threaded.wasm'};
let sess=null,loading=null;const S=640;
async function init(){if(sess)return sess;if(!loading)loading=(async()=>{const r=await fetch(base+'nailseg.wasm');if(!r.ok)throw new Error('modelo '+r.status);sess=await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()),{executionProviders:['wasm'],graphOptimizationLevel:'all'});return sess})();return loading}
function iou(a,b){const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]),x2=Math.min(a[2],b[2]),y2=Math.min(a[3],b[3]),i=Math.max(0,x2-x1)*Math.max(0,y2-y1);return i/((a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-i+1e-6)}
onmessage=async e=>{const d=e.data;try{
 await init();if(d.init){postMessage({id:d.id,ok:true});return}
 const bm=d.bitmap,W=bm.width,H=bm.height,r=Math.min(S/W,S/H),nw=Math.round(W*r),nh=Math.round(H*r),dx=Math.floor((S-nw)/2),dy=Math.floor((S-nh)/2);
 const oc=new OffscreenCanvas(S,S),x=oc.getContext('2d',{willReadFrequently:true});x.fillStyle='rgb(114,114,114)';x.fillRect(0,0,S,S);x.imageSmoothingQuality='high';x.drawImage(bm,0,0,W,H,dx,dy,nw,nh);bm.close&&bm.close();
 const px=x.getImageData(0,0,S,S).data,inp=new Float32Array(3*S*S);for(let i=0,j=0;i<S*S;i++,j+=4){inp[i]=px[j]/255;inp[S*S+i]=px[j+1]/255;inp[2*S*S+i]=px[j+2]/255}
 const out=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',inp,[1,3,S,S])});
 let o0=out[sess.outputNames[0]],o1=out[sess.outputNames[1]];if(o0.dims.length===4){const t=o0;o0=o1;o1=t}
 const P=o0.data,N=o0.dims[2],C=o0.dims[1],NM=C-5,pr=o1.data,ph=o1.dims[2],pw=o1.dims[3],cand=[];
 for(let i=0;i<N;i++){const s=P[4*N+i];if(s<(d.conf||.3))continue;const cx=P[i],cy=P[N+i],w=P[2*N+i],h=P[3*N+i];cand.push({s,b:[cx-w/2,cy-h/2,cx+w/2,cy+h/2],i})}
 cand.sort((a,b)=>b.s-a.s);const keep=[];for(const c of cand){if(keep.every(k=>iou(k.b,c.b)<.5))keep.push(c);if(keep.length>=12)break}
 const sx=pw/S,sy=ph/S,dets=[];
 for(const k of keep){const co=new Float32Array(NM);for(let m=0;m<NM;m++)co[m]=P[(5+m)*N+k.i];
  const x0=Math.max(0,Math.floor(k.b[0]*sx)-1),y0=Math.max(0,Math.floor(k.b[1]*sy)-1),x1=Math.min(pw,Math.ceil(k.b[2]*sx)+1),y1=Math.min(ph,Math.ceil(k.b[3]*sy)+1),mw=x1-x0,mh=y1-y0;if(mw<2||mh<2)continue;
  const mk=new Float32Array(mw*mh);for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++){const q=(y0+yy)*pw+(x0+xx);let v=0;for(let m=0;m<NM;m++)v+=co[m]*pr[m*pw*ph+q];
   mk[yy*mw+xx]=v}
  const toO=(X,Y)=>[(X-dx)/r,(Y-dy)/r];
  dets.push({conf:k.s,box:[...toO(k.b[0],k.b[1]),...toO(k.b[2],k.b[3])],mask:{w:mw,h:mh,a:mk,o:toO(x0/sx,y0/sy),e:toO(x1/sx,y1/sy)}})}
 postMessage({id:d.id,dets},dets.map(t=>t.mask.a.buffer))}catch(err){postMessage({id:d.id,error:String(err&&err.message||err)})}};
