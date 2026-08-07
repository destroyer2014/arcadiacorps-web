import { supabase } from './auth.js?v=37';
import { requireRole } from './access.js?v=37';
import { mountShell } from './shell.js?v=36';

const access = await requireRole(['owner']);
if (!access) throw new Error('Acceso denegado');
await mountShell();

const $ = selector => document.querySelector(selector);

function setCard(name,ok,detail) {
  const card = document.querySelector(`[data-check="${name}"]`);
  if (!card) return;
  const pill = card.querySelector('.status-pill-v38');
  pill.className = `status-pill-v38 ${ok ? 'ok' : 'error'}`;
  pill.textContent = ok ? 'Operativo' : 'Error';
  card.querySelector('[data-detail]').textContent = detail;
}

async function fetchJson(url,timeout=8000,options={}) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try {
    const response = await fetch(url,{
      cache:'no-store',
      ...options,
      signal:controller.signal
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const button = $('#runChecks');
  button.disabled = true;
  button.textContent = 'Comprobando…';

  document.querySelectorAll('.status-pill-v38').forEach(pill=>{
    pill.className = 'status-pill-v38 pending';
    pill.textContent = 'Comprobando';
  });

  let healthy = 0;

  setCard('web',true,`Web cargada correctamente · ${location.host}`);
  healthy++;

  try {
    const { data:{ session },error } = await supabase.auth.getSession();
    if (error || !session) throw new Error('Sesión no disponible');

    const { error:dbError } = await supabase
      .from('profiles')
      .select('id',{head:true,count:'exact'});

    if (dbError) throw dbError;
    setCard('supabase',true,'Auth y base de datos funcionando.');
    healthy++;
  } catch (error) {
    setCard('supabase',false,error.message || 'No responde.');
  }

  try {
    const ai = await fetchJson('/ai-api/health');
    setCard('ai',Boolean(ai.ok),`Servicio ${ai.service || 'IA'} · v${ai.version || '?'}`);
    if (ai.ok) healthy++;
  } catch (error) {
    setCard('ai',false,error.name === 'AbortError' ? 'Tiempo de espera agotado.' : error.message);
  }

  try {
    const nero = await fetchJson('/nero-api/health');
    const stats = await fetchJson('/nero-api/public-stats').catch(()=>({}));
    setCard(
      'nero',
      Boolean(nero.ok),
      `API v${nero.version || '?'} · Nero Bot ${stats.botOnline ? 'online' : 'offline'}`
    );
    $('#registeredUsers').textContent =
      Number.isFinite(Number(stats.registeredUsers)) ? Number(stats.registeredUsers) : '—';
    $('#neroBotState').textContent = stats.botOnline ? 'Online' : 'Offline';
    if (nero.ok) healthy++;
  } catch (error) {
    setCard('nero',false,error.name === 'AbortError' ? 'Tiempo de espera agotado.' : error.message);
    $('#registeredUsers').textContent = '—';
    $('#neroBotState').textContent = '—';
  }

  $('#healthyCount').textContent = `${healthy}/4`;
  $('#lastCheck').textContent = new Date().toLocaleString('es-PE');

  button.disabled = false;
  button.textContent = 'Ejecutar diagnóstico';
}

$('#runChecks').addEventListener('click',run);
await run();
