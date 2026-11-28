// Node.js 22+. Local adapter for the optional Nail Virtual image edit.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const port = Number(process.env.PORT || 3000);
const root = new URL('./', import.meta.url);
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.wasm':'application/wasm',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.css':'text/css',
  '.data':'application/octet-stream', '.tflite':'application/octet-stream', '.binarypb':'application/octet-stream',
  '.woff2':'font/woff2', '.glb':'model/gltf-binary'
};
const fingers = ['polegar','indicador','médio','anelar','mindinho'];
const shapes = ['natural','quadrada','redonda','amendoada','bailarina','stiletto'];
const lengths = {curta:'curto',media:'médio',longa:'longo'};
let busy = false;

function problem(code,message) { return Object.assign(new Error(message), {code}); }
function json(res, code, error) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error}));
}
async function readSelection(req) {
  const parts = [];
  let size=0;
  for await (const part of req) {
    size += part.length;
    if (size>10*1024*1024) throw problem(413,'Foto muito grande. Escolha uma foto menor.');
    parts.push(part);
  }
  let input;
  try { input=JSON.parse(Buffer.concat(parts).toString()); } catch { throw problem(400,'Dados da prévia inválidos.'); }
  const invalid=()=>problem(400,'Foto ou combinação inválida. Reabra a prévia.');
  const prefix='data:image/jpeg;base64,';
  if (!input || typeof input.photo!=='string' || !input.photo.startsWith(prefix) ||
      !['L','R'].includes(input.side) || !shapes.includes(input.shape) ||
      !Object.hasOwn(lengths,input.length) || !Array.isArray(input.nails) || input.nails.length!==5) throw invalid();
  const bytes=Buffer.from(input.photo.slice(prefix.length),'base64');
  let mask=null;
  if (input.mask!=null) {
    const mp='data:image/png;base64,';
    if (typeof input.mask!=='string' || !input.mask.startsWith(mp)) throw invalid();
    mask=Buffer.from(input.mask.slice(mp.length),'base64');
    if (mask.length<8 || !mask.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) throw invalid();
  }
  if (bytes.length<4 || bytes.readUInt16BE(0)!==0xffd8 || bytes.readUInt16BE(bytes.length-2)!==0xffd9) throw invalid();
  const details=input.nails.map((n,i)=>{
    if (!n || (n.color!==null && !/^#[a-f0-9]{6}$/i.test(n.color)) ||
        typeof n.finish!=='string' || typeof n.art!=='string' || n.finish.length>70 || n.art.length>100)
      throw invalid();
    return {dedo:fingers[i],esmalte:n.color,acabamento:n.finish,desenho:n.art || null};
  });
  const shapeInstruction=input.shape==='natural'
    ? 'Mantenha o formato, o comprimento natural, as assimetrias e as pequenas irregularidades de cada unha. Cubra até a ponta livre e as laterais.'
    : 'A cliente pediu alongamento. Simule o formato '+input.shape+' com comprimento '+lengths[input.length]+', preservando a anatomia da mão e o encaixe real na cutícula.';
  const prompt=[
    'Edite a fotografia fornecida da mão '+(input.side==='R'?'direita':'esquerda')+'. Identifique os dedos pela anatomia da mão, inclusive se estiverem dobrados.',
    'Aplique somente as escolhas do catálogo abaixo aos dedos visíveis. Campos nulos significam ausência daquele efeito. Não invente dedos ocultos.',
    shapeInstruction, 'Preserve a pele, as cutículas, anéis, pose, iluminação, textura e enquadramento originais. Sem texto, moldura ou retoque da pele.',
    'Faça o esmalte seguir a curvatura e os reflexos de cada unha. Na francesinha, aplique a faixa fina apenas na ponta livre.',
    'A área transparente da máscara marca exatamente as unhas: pinte só ali, com acabamento de esmalte em gel de salão: cobertura uniforme, borda limpa rente à cutícula e às laterais, brilho de laca com reflexo nítido da luz e espessura sutil na borda. Mantenha a mesma resolução e o mesmo enquadramento da foto.',
    'Estilos por dedo (dados de catálogo): '+JSON.stringify(details)
  ].join('\n');
  return {bytes,mask,prompt};
}
async function edit(req,res) {
  if (req.headers.origin!=='http://'+req.headers.host) return json(res,403,'Abra a prévia na mesma origem do app.');
  if (req.headers['content-type']?.split(';')[0]!=='application/json') return json(res,415,'Envie os dados da prévia em JSON.');
  if (!process.env.OPENAI_API_KEY) return json(res,503,'Configure OPENAI_API_KEY no servidor para ativar a prévia realista.');
  if (busy) return json(res,429,'Já existe uma prévia em processamento. Aguarde antes de gerar outra.');
  busy=true;
  const controller=new AbortController();
  const disconnect=()=>{ if (!res.writableEnded) controller.abort(); };
  res.on('close',disconnect);
  try {
    const {bytes,mask,prompt}=await readSelection(req);
    const send=withMask=>{
      const form=new FormData();
      form.set('model','gpt-image-2.5-sunburst');
      form.append('image[]',new Blob([bytes],{type:'image/jpeg'}),'mao.jpg');
      if (withMask) form.append('mask',new Blob([mask],{type:'image/png'}),'unhas.png');
      form.set('prompt',prompt);
      form.set('n','1');
      return fetch('https://api.openai.com/v1/images/edits',{
        method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form,
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(180000)])
      });
    };
    // com a máscara das unhas a IA mexe só nelas; se o modelo recusar a máscara, tenta sem
    let response=await send(!!mask);
    if (mask && response.status===400) response=await send(false);
    if (!response.ok) {
      const msg = response.status===401 || response.status===403 ? 'Confira a chave e o acesso ao modelo no projeto da OpenAI.' :
        response.status===429 ? 'A OpenAI indicou limite de uso ou saldo. Confira o projeto antes de tentar de novo.' :
        response.status===400 ? 'A OpenAI não aceitou esta edição. Confira a foto e o acesso ao modelo.' :
        'O serviço de imagens está indisponível no momento.';
      return json(res,502,msg);
    }
    const body=await response.json();
    const encoded=body?.data?.[0]?.b64_json;
    if (!encoded || typeof encoded!=='string') throw problem(502,'A OpenAI não devolveu uma imagem.');
    const png=Buffer.from(encoded,'base64');
    if (!png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) throw problem(502,'Formato inesperado na resposta da OpenAI.');
    if (!res.destroyed) {
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'}); res.end(png);
    }
  } catch (error) {
    const code=Number.isInteger(error.code)?error.code:error.name==='TimeoutError'?504:502;
    json(res,code,Number.isInteger(error.code)?error.message:code===504?'A edição demorou mais que o esperado.':'Falha de conexão ao gerar a prévia.');
  } finally { busy=false; res.off('close',disconnect); }
}

createServer(async(req,res)=>{
  if (!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host)) return json(res,403,'Use o endereço local indicado no terminal.');
  const path=req.url.split('?')[0];
  if (path==='/api/previa-realista/status') {
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true,configured:!!process.env.OPENAI_API_KEY}));
  }
  if (path==='/api/previa-realista') {
    if (req.method!=='POST') return json(res,405,'Use POST.');
    return edit(req,res);
  }
  if (req.method!=='GET' && req.method!=='HEAD') return json(res,405,'Método indisponível.');
  const name=path==='/'?'index.html':path.slice(1);
  const mime=types[extname(name).toLowerCase()];
  if (!mime || !/^[a-z0-9][a-z0-9_.-]*$/i.test(name)) return json(res,404,'Arquivo não encontrado.');
  try {
    const file=await readFile(new URL(name,root));
    res.writeHead(200,{'Content-Type':mime}); res.end(req.method==='HEAD'?undefined:file);
  } catch { json(res,404,'Arquivo não encontrado.'); }
}).listen(port,'127.0.0.1',()=>console.log('Nail Virtual: http://localhost:'+port));
