import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit:'32kb' }));

const PORT = Number(process.env.PORT || 3311);
const EVOGB_API_KEY = process.env.EVOGB_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

const rate = new Map();

const SYSTEM_PROMPT = [
  'Eres la IA oficial de soporte de ArcadiaCorps.',
  'Ayudas a los usuarios con la web, cuentas, perfiles, Nero Bot, Sub-Bots, tickets, tienda, compras, noticias, Social y chat.',
  'Responde siempre en el idioma del usuario, con instrucciones claras y breves.',
  'No inventes funciones ni afirmes que hiciste cambios en cuentas o servidores.',
  'Nunca pidas contraseñas, tokens, códigos de verificación ni claves API.',
  'Cuando el problema requiera acceso de Owner o Staff, indica que debe abrir un ticket.',
  'Para Nero Bot usa el prefijo actual punto (.).'
].join(' ');

function cleanText(value, max=1800) {
  return String(value ?? '').replace(/\u0000/g,'').trim().slice(0,max);
}

async function verifyUser(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers:{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      Authorization:`Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  return response.json();
}

function allowRequest(userId) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 12;
  const previous = rate.get(userId) || [];
  const recent = previous.filter(time => now - time < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  rate.set(userId,recent);
  return true;
}

app.get('/health', (_req,res) => {
  res.json({ ok:true, service:'arcadia-ai-api' });
});

app.post('/chat', async (req,res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await verifyUser(token);

    if (!user?.id) {
      return res.status(401).json({ ok:false, error:'Sesión no válida. Vuelve a iniciar sesión.' });
    }

    if (!allowRequest(user.id)) {
      return res.status(429).json({ ok:false, error:'Has enviado demasiados mensajes. Espera un minuto.' });
    }

    if (!EVOGB_API_KEY) {
      return res.status(503).json({ ok:false, error:'La clave de IA todavía no está configurada en el VPS.' });
    }

    const message = cleanText(req.body?.message);
    if (message.length < 2) {
      return res.status(400).json({ ok:false, error:'Escribe una pregunta.' });
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const history = rawHistory.map(item => {
      const role = item?.role === 'assistant' ? 'Asistente' : 'Usuario';
      return `${role}: ${cleanText(item?.content,700)}`;
    }).filter(Boolean).join('\n');

    const text = history
      ? `${history}\nUsuario: ${message}`
      : message;

    const url = new URL('https://api.evogb.org/ai/gptprompt');
    url.searchParams.set('text',text);
    url.searchParams.set('prompt',SYSTEM_PROMPT);
    url.searchParams.set('key',EVOGB_API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),45_000);

    const apiResponse = await fetch(url,{ signal:controller.signal });
    clearTimeout(timeout);

    const data = await apiResponse.json().catch(() => null);

    if (!apiResponse.ok || !data?.status || !data?.result) {
      return res.status(502).json({
        ok:false,
        error:'La IA externa no respondió correctamente.'
      });
    }

    return res.json({
      ok:true,
      model:'chatgpt',
      answer:String(data.result)
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return res.status(timedOut ? 504 : 500).json({
      ok:false,
      error:timedOut
        ? 'La IA tardó demasiado en responder.'
        : 'No fue posible procesar la consulta.'
    });
  }
});

app.listen(PORT,'127.0.0.1',() => {
  console.log(`Arcadia AI API escuchando en 127.0.0.1:${PORT}`);
});
