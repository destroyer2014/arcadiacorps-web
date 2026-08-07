import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit:'48kb' }));

const PORT = Number(process.env.PORT || 3311);
const EVOGB_API_KEY = process.env.EVOGB_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const PUBLIC_BASE_URL = String(
  process.env.PUBLIC_BASE_URL || 'https://arcadiacorps.online/ai-api'
).replace(/\/+$/,'');

const UPLOAD_DIR = '/tmp/arcadia-ai-uploads';
await fs.mkdir(UPLOAD_DIR,{ recursive:true });

const rate = new Map();

const upload = multer({
  storage:multer.diskStorage({
    destination:(_req,_file,cb)=>cb(null,UPLOAD_DIR),
    filename:(_req,file,cb)=>{
      const extension = ({
        'image/jpeg':'.jpg',
        'image/png':'.png',
        'image/webp':'.webp'
      })[file.mimetype] || '.bin';
      cb(null,`${crypto.randomBytes(24).toString('hex')}${extension}`);
    }
  }),
  limits:{ fileSize:8*1024*1024,files:1 },
  fileFilter:(_req,file,cb)=>{
    const allowed = ['image/jpeg','image/png','image/webp'].includes(file.mimetype);
    cb(allowed ? null : new Error('Formato de imagen no permitido.'),allowed);
  }
});

app.use('/files',express.static(UPLOAD_DIR,{
  maxAge:'10m',
  immutable:false,
  fallthrough:false
}));

const GPT_PROMPT = [
  'Eres la IA oficial de soporte de ArcadiaCorps.',
  'Ayudas con la web, cuentas, Nero Bot, Sub-Bots, tickets, tienda, compras, noticias, Social y chat.',
  'Responde en el idioma del usuario con instrucciones claras.',
  'No inventes funciones ni afirmes haber cambiado cuentas o servidores.',
  'Nunca pidas contraseñas, códigos, tokens ni claves API.',
  'Cuando se requiera intervención humana, indica que debe abrir un ticket.',
  'Para Nero Bot usa el prefijo punto (.).'
].join(' ');

const CLAUDE_PROMPT = [
  'Eres Claude dentro de ArcadiaCorps.',
  'Te especializas en programación, JavaScript, Node.js, Baileys, bots de WhatsApp y automatización.',
  'Entrega código seguro y funcional, explica dependencias y no inventes APIs.',
  'Nero Bot usa el prefijo punto (.).',
  'Nunca solicites secretos, contraseñas ni tokens.'
].join(' ');

function cleanText(value,max=1800) {
  return String(value ?? '').replace(/\u0000/g,'').trim().slice(0,max);
}

function bearer(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

async function verifyUser(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`,{
    headers:{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      Authorization:`Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

function allowRequest(userId,bucket,max,windowMs=60_000) {
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  const previous = rate.get(key) || [];
  const recent = previous.filter(time=>now-time<windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  rate.set(key,recent);
  return true;
}

function safeRemoteUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const match = host.match(/^172\.(\d+)\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return false;
    return true;
  } catch {
    return false;
  }
}

async function externalFetch(url,options={},timeoutMs=55_000) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    return await fetch(url,{ ...options,signal:controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function historyText(history=[]) {
  return (Array.isArray(history) ? history.slice(-8) : [])
    .map(item => `${item?.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${cleanText(item?.content,700)}`)
    .filter(Boolean)
    .join('\n');
}

async function requireUser(req,res,next) {
  const user = await verifyUser(bearer(req));
  if (!user?.id) return res.status(401).json({
    ok:false,error:'Sesión no válida. Vuelve a iniciar sesión.'
  });
  req.arcadiaUser = user;
  next();
}

function keyCheck(res) {
  if (EVOGB_API_KEY) return true;
  res.status(503).json({
    ok:false,error:'La clave de IA no está configurada en el VPS.'
  });
  return false;
}

async function textAI(req,res,{ endpoint,prompt,bucket }) {
  if (!keyCheck(res)) return;
  const user = req.arcadiaUser;
  if (!allowRequest(user.id,bucket,12)) {
    return res.status(429).json({
      ok:false,error:'Has enviado demasiados mensajes. Espera un minuto.'
    });
  }

  const message = cleanText(req.body?.message);
  if (message.length < 2) {
    return res.status(400).json({ ok:false,error:'Escribe una pregunta.' });
  }

  const rawHistory = Array.isArray(req.body?.history) ? [...req.body.history] : [];
  const last = rawHistory.at(-1);
  if (last?.role === 'user' && cleanText(last?.content) === message) rawHistory.pop();
  const context = historyText(rawHistory);
  const text = context ? `${context}\nUsuario: ${message}` : message;
  const url = new URL(`https://api.evogb.org/ai/${endpoint}`);
  url.searchParams.set('text',endpoint === 'gptprompt' ? text : `${prompt}\n\nPregunta del usuario:\n${text}`);
  if (endpoint === 'gptprompt') url.searchParams.set('prompt',prompt);
  url.searchParams.set('key',EVOGB_API_KEY);

  const response = await externalFetch(url);
  const data = await response.json().catch(()=>null);
  if (!response.ok || !data?.status || !data?.result) {
    console.error('EvoGB text error',endpoint,response.status,data);
    return res.status(502).json({
      ok:false,error:'La IA externa no respondió correctamente.'
    });
  }

  res.json({
    ok:true,
    model:endpoint === 'gptprompt' ? 'chatgpt' : 'claude',
    answer:String(data.result)
  });
}

function queryUrl(endpoint,params) {
  const url = new URL(`https://api.evogb.org/ai/${endpoint}`);
  Object.entries(params).forEach(([key,value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key,String(value));
    }
  });
  url.searchParams.set('key',EVOGB_API_KEY);
  return url;
}

async function tryJsonCandidates(endpoint,candidates) {
  let last = null;
  for (const params of candidates) {
    const response = await externalFetch(queryUrl(endpoint,params));
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    if (response.ok && data) return { response,data };
    last = { status:response.status,body:text.slice(0,300) };
  }
  throw new Error(`EvoGB rechazó la imagen (${last?.status || 'sin respuesta'}).`);
}

async function tryImageCandidates(endpoint,candidates) {
  let last = null;
  for (const params of candidates) {
    const response = await externalFetch(queryUrl(endpoint,params),{},90_000);
    const type = response.headers.get('content-type') || '';

    if (response.ok && type.startsWith('image/')) {
      return {
        bytes:Buffer.from(await response.arrayBuffer()),
        type
      };
    }

    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    const remote = data?.result || data?.url || data?.image || data?.download_url;
    if (response.ok && typeof remote === 'string' && safeRemoteUrl(remote)) {
      const imageResponse = await externalFetch(remote,{},90_000);
      const imageType = imageResponse.headers.get('content-type') || '';
      if (imageResponse.ok && imageType.startsWith('image/')) {
        return {
          bytes:Buffer.from(await imageResponse.arrayBuffer()),
          type:imageType
        };
      }
    }

    last = { status:response.status,body:text.slice(0,300) };
  }
  throw new Error(`EvoGB no devolvió una imagen (${last?.status || 'sin respuesta'}).`);
}

function imageSource(req) {
  if (req.file) return `${PUBLIC_BASE_URL}/files/${encodeURIComponent(req.file.filename)}`;
  const url = cleanText(req.body?.url,1800);
  if (!safeRemoteUrl(url)) throw new Error('La URL de la imagen no es válida.');
  return url;
}

app.get('/health',(_req,res)=>{
  res.json({ ok:true,service:'arcadia-ai-api',version:'36' });
});

app.post('/chat',requireUser,async (req,res)=>{
  try {
    await textAI(req,res,{
      endpoint:'gptprompt',
      prompt:GPT_PROMPT,
      bucket:'chatgpt'
    });
  } catch (error) {
    console.error(error);
    res.status(error?.name==='AbortError'?504:500).json({
      ok:false,error:error?.name==='AbortError'
        ? 'La IA tardó demasiado en responder.'
        : 'No fue posible procesar la consulta.'
    });
  }
});

app.post('/claude',requireUser,async (req,res)=>{
  try {
    await textAI(req,res,{
      endpoint:'claude',
      prompt:CLAUDE_PROMPT,
      bucket:'claude'
    });
  } catch (error) {
    console.error(error);
    res.status(error?.name==='AbortError'?504:500).json({
      ok:false,error:error?.name==='AbortError'
        ? 'Claude tardó demasiado en responder.'
        : 'No fue posible procesar la consulta.'
    });
  }
});

app.post('/image-to-prompt',requireUser,upload.single('image'),async (req,res)=>{
  try {
    if (!keyCheck(res)) return;
    if (!allowRequest(req.arcadiaUser.id,'image-prompt',6)) {
      return res.status(429).json({
        ok:false,error:'Límite temporal alcanzado. Espera un minuto.'
      });
    }

    const source = imageSource(req);
    const language = cleanText(req.body?.language || 'es',8) || 'es';

    const candidates = [
      { method:'url',url:source,lang:language },
      { method:'URL',url:source,language_code:language },
      { method:'url',image:source,language_code:language },
      { image_url:source,lang:language },
      { image:source,language:language },
      { url:source,lang:language }
    ];

    const { data } = await tryJsonCandidates('image-to-prompt',candidates);
    const prompt = data?.prompt || data?.result;
    if (!prompt) throw new Error('La API no devolvió el prompt.');

    res.json({
      ok:true,
      language:data.language_code || language,
      prompt:String(prompt)
    });
  } catch (error) {
    console.error('image-to-prompt',error);
    res.status(502).json({
      ok:false,
      error:error.message || 'No se pudo analizar la imagen.'
    });
  }
});

app.post('/nanobanana',requireUser,upload.single('image'),async (req,res)=>{
  try {
    if (!keyCheck(res)) return;
    if (!allowRequest(req.arcadiaUser.id,'nanobanana',4)) {
      return res.status(429).json({
        ok:false,error:'Límite temporal alcanzado. Espera un minuto.'
      });
    }

    const source = imageSource(req);
    const prompt = cleanText(req.body?.prompt,1200);
    if (prompt.length < 3) {
      return res.status(400).json({
        ok:false,error:'Escribe los cambios que debe realizar la IA.'
      });
    }

    const candidates = [
      { method:'url',url:source,prompt },
      { method:'URL',url:source,prompt },
      { method:'url',image:source,prompt },
      { image_url:source,prompt },
      { image:source,prompt },
      { url:source,prompt }
    ];

    const image = await tryImageCandidates('nanobanana',candidates);
    res.setHeader('Content-Type',image.type);
    res.setHeader('Cache-Control','no-store');
    res.send(image.bytes);
  } catch (error) {
    console.error('nanobanana',error);
    res.status(502).json({
      ok:false,
      error:error.message || 'No se pudo editar la imagen.'
    });
  }
});

app.use((error,_req,res,_next)=>{
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      ok:false,
      error:error.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el límite de 8 MB.'
        : 'No se pudo procesar el archivo.'
    });
  }
  res.status(400).json({
    ok:false,error:error.message || 'Solicitud no válida.'
  });
});

setInterval(async ()=>{
  try {
    const names = await fs.readdir(UPLOAD_DIR);
    const now = Date.now();
    await Promise.all(names.map(async name=>{
      const file = path.join(UPLOAD_DIR,name);
      const stat = await fs.stat(file);
      if (now-stat.mtimeMs > 20*60_000) await fs.unlink(file);
    }));
  } catch {}
},5*60_000).unref();

app.listen(PORT,'127.0.0.1',()=>{
  console.log(`Arcadia AI API v36 en 127.0.0.1:${PORT}`);
});
