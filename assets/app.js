// ══════════════════════════════════════════
// MOTOR DE AUDIO — chiptune original generado con Web Audio API
// (sin archivos externos, sin reproducir obras de terceros)
// ══════════════════════════════════════════
(function(){
  let ctx = null;
  let musicTimer = null;
  let musicStep = 0;

  function getCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Tono simple tipo "bleep" 8-bit
  function blip(freq, duration, type, gainStart, delay){
    const c = getCtx();
    if(!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainStart || 0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  window.playCoinSound = function(){
    blip(1568, 0.05, 'square', 0.07, 0);
    blip(2349, 0.12, 'square', 0.06, 0.05);
  };

  window.playJumpSound = function(){
    const c = getCtx();
    if(!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, t0);
    osc.frequency.exponentialRampToValueAtTime(760, t0 + 0.14);
    gain.gain.setValueAtTime(0.07, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.16);
  };

  window.playFlagSound = function(){
    // Pequeño arpegio ascendente, como "logro desbloqueado"
    [523, 659, 784, 1046].forEach((f, i)=> blip(f, 0.18, 'square', 0.06, i * 0.09));
  };

  window.playSlideSound = function(){
    const c = getCtx();
    if(!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.5);
    gain.gain.setValueAtTime(0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.5);
  };

  window.playClickSound = function(){
    blip(700, 0.05, 'square', 0.04, 0);
  };

  // ── Melodía chiptune original de fondo (loop simple, alegre, estilo menú retro) ──
  // Secuencia de notas (Hz) y duraciones — composición propia, sin relación con obras existentes.
  const MELODY = [
    [523,0.18],[523,0.18],[659,0.18],[523,0.18],[784,0.18],[0,0.18],
    [698,0.18],[698,0.18],[659,0.18],[523,0.18],[587,0.18],[0,0.18],
    [523,0.18],[523,0.18],[659,0.18],[523,0.18],[880,0.18],[0,0.18],
    [784,0.18],[0,0.18],[659,0.18],[0,0.18],[523,0.36],[0,0.18],
  ];

  function scheduleMelodyStep(){
    const c = getCtx();
    if(!c) return;
    const [freq, dur] = MELODY[musicStep % MELODY.length];
    if(freq > 0){
      blip(freq, dur * 0.9, 'square', 0.045, 0);
    }
    musicStep++;
    musicTimer = setTimeout(scheduleMelodyStep, dur * 1000);
  }

  window.startMusic = function(){
    const c = getCtx();
    if(!c) return;
    if(musicTimer) return; // ya está sonando
    musicStep = 0;
    scheduleMelodyStep();
  };

  window.stopMusic = function(){
    if(musicTimer){ clearTimeout(musicTimer); musicTimer = null; }
  };

  // ── Estado centralizado de música, compartido por todos los botones de sonido ──
  let musicOn = false;
  const listeners = [];

  window.isMusicOn = function(){ return musicOn; };

  window.toggleMusic = function(){
    musicOn = !musicOn;
    if(musicOn){ window.startMusic(); } else { window.stopMusic(); }
    listeners.forEach(fn => fn(musicOn));
    return musicOn;
  };

  window.onMusicStateChange = function(fn){
    listeners.push(fn);
  };
})();

/* --- bloque --- */
(function(){
  const tabs = document.querySelectorAll('.top-tab');
  const panels = document.querySelectorAll('.top-panel');
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.remove('active'));
      panels.forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector('.top-panel[data-panel="'+tab.dataset.tab+'"]').classList.add('active');
      if(tab.dataset.tab === 'coins' && window.loadCoinsTop) window.loadCoinsTop();
    });
  });
})();

/* --- bloque --- */
// ── Acordeón de comandos ──
(function(){
  const heads = document.querySelectorAll('.accordion-head');
  heads.forEach(head=>{
    head.addEventListener('click', ()=>{
      head.closest('.accordion-item').classList.toggle('open');
    });
  });

  // Abrir la primera categoría por defecto
  const first = document.querySelector('.accordion-item');
  if(first) first.classList.add('open');

  // ── Buscador en vivo ──
  const search = document.getElementById('cmdSearch');
  const items = document.querySelectorAll('.accordion-item');
  const noResults = document.getElementById('cmdNoResults');

  if(search){
  search.addEventListener('input', ()=>{
    const q = search.value.trim().toLowerCase();
    let anyVisible = false;

    items.forEach(item=>{
      const chips = item.querySelectorAll('.cmd-chip');
      let itemHasMatch = false;

      chips.forEach(chip=>{
        const name = chip.dataset.name || '';
        const text = chip.textContent.toLowerCase();
        const match = !q || name.includes(q) || text.includes(q);
        chip.classList.toggle('hidden', !match);
        if(match) itemHasMatch = true;
      });

      item.classList.toggle('hidden', !itemHasMatch);
      if(itemHasMatch){
        anyVisible = true;
        if(q) item.classList.add('open');
      }
    });

    noResults.style.display = anyVisible ? 'none' : 'block';
  });
  }

  // ── Toggle NSFW ──
  const nsfwBtn = document.getElementById('nsfwToggle');
  const nsfwBody = document.getElementById('nsfwBody');
  if(nsfwBtn){
    nsfwBtn.addEventListener('click', ()=>{
      const isOpen = nsfwBody.classList.toggle('open');
      nsfwBtn.textContent = isOpen ? 'OCULTAR' : 'MOSTRAR';
    });
  }
})();

/* --- bloque --- */
(function(){
  // ── Auth Gate: login/registro real contra Supabase Auth ──
  // Reutiliza el mismo proyecto Supabase que ya usa el resto del sitio
  // (casino_attempts, visits) para no duplicar infraestructura.
  const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const AUTH_API = SUPABASE_URL + '/auth/v1';

  const gate = document.getElementById('authGate');
  document.body.style.overflow = 'hidden';
  const form = document.getElementById('authForm');
  const emailEl = document.getElementById('authEmail');
  const passEl = document.getElementById('authPass');
  const passHint = document.getElementById('passHint');
  const submitBtn = document.getElementById('authSubmit');
  const statusEl = document.getElementById('authStatus');
  const guestLink = document.getElementById('authGuest');
  const forgotLink = document.getElementById('authForgot');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  let mode = 'login'; // 'login' | 'register'

  function setMode(next){
    mode = next;
    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');
    submitBtn.textContent = mode === 'login' ? '$ INICIAR SESIÓN' : '$ CREAR CUENTA';
    passHint.style.display = mode === 'register' ? 'block' : 'none';
    passEl.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    statusEl.textContent = '';
    statusEl.className = 'auth-status';
  }
  tabLogin.addEventListener('click', ()=>setMode('login'));
  tabRegister.addEventListener('click', ()=>setMode('register'));

  function showStatus(msg, ok){
    statusEl.textContent = msg;
    statusEl.className = 'auth-status ' + (ok ? 'ok' : 'err');
  }

  function enterSite(){
    gate.classList.add('hide');
    document.body.style.overflow = '';
  }

  // Si ya hay una sesión guardada y válida, entra directo sin pedir login
  const savedSession = localStorage.getItem('pragmata_session');
  if(savedSession){
    try{
      const sess = JSON.parse(savedSession);
      if(sess.expires_at && sess.expires_at * 1000 > Date.now()){
        enterSite();
      }
    }catch(e){}
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = emailEl.value.trim();
    const password = passEl.value;
    if(!email || !password){ showStatus('✗ Completa todos los campos', false); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? '$ VERIFICANDO...' : '$ CREANDO CUENTA...';
    showStatus('', true);

    try{
      const endpoint = mode === 'login'
        ? AUTH_API + '/token?grant_type=password'
        : AUTH_API + '/signup';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if(!res.ok){
        const msg = data?.error_description || data?.msg || data?.error || 'Error desconocido';
        if(/already registered|already exists/i.test(msg)){
          showStatus('✗ Ese correo ya está registrado. Inicia sesión.', false);
        } else if(/invalid login credentials/i.test(msg)){
          showStatus('✗ Correo o contraseña incorrectos.', false);
        } else {
          showStatus('✗ ' + msg, false);
        }
        return;
      }

      if(mode === 'register'){
        if(data.access_token){
          localStorage.setItem('pragmata_session', JSON.stringify(data));
          showStatus('✓ Cuenta creada. ¡Bienvenido!', true);
          setTimeout(enterSite, 700);
        } else {
          showStatus('✓ Cuenta creada. Revisa tu correo para confirmar, luego inicia sesión.', true);
          setTimeout(()=>setMode('login'), 1600);
        }
      } else {
        localStorage.setItem('pragmata_session', JSON.stringify(data));
        showStatus('✓ Acceso concedido', true);
        setTimeout(enterSite, 500);
      }
    }catch(err){
      showStatus('✗ No se pudo conectar. Intenta de nuevo.', false);
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? '$ INICIAR SESIÓN' : '$ CREAR CUENTA';
    }
  });

  forgotLink.addEventListener('click', async (e)=>{
    e.preventDefault();
    const email = emailEl.value.trim();
    if(!email){
      showStatus('✗ Escribe tu correo arriba primero', false);
      emailEl.focus();
      return;
    }
    forgotLink.textContent = 'Enviando...';
    try{
      const res = await fetch(AUTH_API + '/recover', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      if(res.ok){
        showStatus('✓ Revisa tu correo para restablecer la contraseña', true);
      } else {
        showStatus('✗ No se pudo enviar el correo de recuperación', false);
      }
    }catch(err){
      showStatus('✗ Error de conexión, intenta de nuevo', false);
    }finally{
      forgotLink.textContent = '¿Olvidaste la clave?';
    }
  });

  guestLink.addEventListener('click', (e)=>{
    e.preventDefault();
    enterSite();
  });

  setMode('login');
})();

/* --- bloque --- */
(function(){
  const carousel = document.getElementById('planCarousel');
  const left = document.getElementById('planLeft');
  const right = document.getElementById('planRight');
  if(!carousel) return;
  function scrollByCard(dir){
    const card = carousel.querySelector('.plan-card');
    const amount = card ? card.offsetWidth + 20 : 300;
    carousel.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }
  left.addEventListener('click', ()=>scrollByCard(-1));
  right.addEventListener('click', ()=>scrollByCard(1));
})();

/* --- bloque --- */
// ── Animated counters (count-up on scroll into view) ──
(function(){
  const targets = {
    statUsers:      3000,
    statCommands:   429,
    statCategories: 19,
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(el, target, duration){
    if(reduceMotion){ el.textContent = target.toLocaleString('es-PE'); return; }
    const start = performance.now();
    function tick(now){
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const val = Math.floor(eased * target);
      el.textContent = val.toLocaleString('es-PE');
      if(p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('es-PE');
    }
    requestAnimationFrame(tick);
  }

  let played = false;
  const statsSection = document.getElementById('estado');
  if(statsSection){
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting && !played){
          played = true;
          countUp(document.getElementById('statUsers'), targets.statUsers, 1400);
          countUp(document.getElementById('statCommands'), targets.statCommands, 1400);
          countUp(document.getElementById('statCategories'), targets.statCategories, 1000);
        }
      });
    }, { threshold: 0.4 });
    observer.observe(statsSection);
  }
})();

/* --- bloque --- */
// ── Fondo dinámico: hongos, estrellas y monedas flotantes ──
(function(){
  const field = document.getElementById('particleField');
  if(!field) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;

  // Mayoría cerezas (clásico de casino), mezcladas con estrellas, monedas y gemas
  const SYMBOLS = ['🍒','🍒','🍒','⭐','🪙','💎','🍒','⭐'];
  const GLOWS = {
    '🍒': 'rgba(255,77,77,0.55)',
    '⭐': 'rgba(255,210,63,0.6)',
    '🪙': 'rgba(255,210,63,0.6)',
    '💎': 'rgba(124,92,255,0.55)'
  };
  const COUNT = window.innerWidth < 700 ? 14 : 26;

  for(let i = 0; i < COUNT; i++){
    const p = document.createElement('div');
    p.className = 'particle';
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    p.textContent = sym;
    const size = Math.random() * 16 + 14;
    const duration = Math.random() * 20 + 16;
    const delay = Math.random() * -32;
    const drift = (Math.random() * 90 - 45) + 'px';
    const rot = (Math.random() * 360 - 180) + 'deg';
    const opacity = (Math.random() * 0.4 + 0.25).toFixed(2);

    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = Math.random() * 100 + 'vh';
    p.style.fontSize = size + 'px';
    p.style.setProperty('--p-op', opacity);
    p.style.setProperty('--p-drift', drift);
    p.style.setProperty('--p-rot', rot);
    p.style.setProperty('--p-glow', GLOWS[sym] || 'rgba(255,210,63,0.5)');
    p.style.animationDuration = duration + 's';
    p.style.animationDelay = delay + 's';

    field.appendChild(p);
  }
})();

/* --- bloque --- */
// ── Parallax sutil en scroll para fondo del hero ──
(function(){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;

  const grid = document.querySelector('.hero-grid-bg');
  const glow = document.querySelector('.hero-glow');
  if(!grid && !glow) return;

  let ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const y = window.scrollY;
      if(grid) grid.style.transform = `translateY(${y * 0.18}px)`;
      if(glow) glow.style.transform = `translate(-50%, ${y * 0.08}px)`;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* --- bloque --- */
(function(){
  // ══════════════════════════════════════
  // CONFIG — cambia el PIN aquí o desde el panel
  // ══════════════════════════════════════
  const DEFAULT_PIN = '1234';
  const PIN_KEY     = 'pragmata_admin_pin';
  const SESSION_KEY = 'pragmata_admin_session';

  function getPin(){ return localStorage.getItem(PIN_KEY) || DEFAULT_PIN; }
  function savePin(p){ try { localStorage.setItem(PIN_KEY, p); } catch(e){} }
  function setSession(){ try { sessionStorage.setItem(SESSION_KEY, '1'); } catch(e){} }
  function hasSession(){ try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch(e){ return false; } }
  function clearSession(){ try { sessionStorage.removeItem(SESSION_KEY); } catch(e){} }

  // ── Elementos ──
  const trigger     = document.getElementById('adminTrigger');
  const overlay     = document.getElementById('adminOverlay');
  const admClose    = document.getElementById('admClose');
  const pinScreen   = document.getElementById('admPinScreen');
  const dashboard   = document.getElementById('admDashboard');
  const dots        = document.querySelectorAll('.adm-pin-dot');
  const pinError    = document.getElementById('admPinError');
  const siteBanner  = document.getElementById('siteBanner');
  const bannerText  = document.getElementById('siteBannerText');
  const bannerClose = document.getElementById('bannerClose');

  let pinInput = '';

  // ── Activador: 5 clics en botón invisible ──
  let trigClicks = 0, trigTimer = null;
  trigger.style.pointerEvents = 'all';
  trigger.addEventListener('click', ()=>{
    trigClicks++;
    clearTimeout(trigTimer);
    trigTimer = setTimeout(()=>{ trigClicks = 0; }, 1200);
    if(trigClicks >= 5){
      trigClicks = 0;
      openPanel();
    }
  });

  // También: Konami-like — escribe "admin" en cualquier input de texto vacío
  let keySeq = '';
  document.addEventListener('keydown', (e)=>{
    keySeq += e.key.toLowerCase();
    if(keySeq.length > 10) keySeq = keySeq.slice(-10);
    if(keySeq.endsWith('arcadia')){ keySeq = ''; openPanel(); }
  });

  function openPanel(){
    overlay.classList.add('open');
    if(hasSession()){
      showDashboard();
    } else {
      showPin();
    }
  }

  function closePanel(){
    overlay.classList.remove('open');
    pinInput = '';
    updateDots();
    pinError.textContent = '';
  }

  admClose.addEventListener('click', closePanel);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closePanel(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closePanel(); });

  // ── PIN numpad ──
  function showPin(){
    pinScreen.style.display = 'block';
    dashboard.style.display = 'none';
    pinInput = '';
    updateDots();
    pinError.textContent = '';
  }

  function showDashboard(){
    pinScreen.style.display = 'none';
    dashboard.style.display = 'block';
    syncDashboard();
    refreshVisits();
    if(window.refreshRedeems) window.refreshRedeems();
    if(window.refreshReports) window.refreshReports();
    if(window.refreshActivityLog) window.refreshActivityLog();
  }

  function updateDots(){
    dots.forEach((d, i)=>{
      d.classList.toggle('filled', i < pinInput.length);
      d.classList.remove('error');
    });
  }

  function shakeError(msg){
    pinError.textContent = msg;
    dots.forEach(d=>{ d.classList.remove('filled'); d.classList.add('error'); });
    setTimeout(()=>{ dots.forEach(d=>d.classList.remove('error')); pinInput=''; updateDots(); }, 700);
  }

  document.querySelectorAll('.adm-key').forEach(key=>{
    key.addEventListener('click', ()=>{
      const n = key.dataset.n;
      if(n === 'del'){
        pinInput = pinInput.slice(0,-1);
        updateDots();
        return;
      }
      if(pinInput.length >= 4) return;
      pinInput += n;
      updateDots();
      if(pinInput.length === 4){
        setTimeout(()=>{
          if(pinInput === getPin()){
            setSession();
            showDashboard();
          } else {
            shakeError('PIN incorrecto');
          }
        }, 120);
      }
    });
  });

  // ── Dashboard: sync con valores actuales ──
  function syncDashboard(){
    // Stats actuales de la página
    const u = document.getElementById('statUsers');
    const c = document.getElementById('statCommands');
    const ca = document.getElementById('statCategories');
    if(u)  document.getElementById('admUsers').value  = u.textContent.replace(/[.,]/g,'');
    if(c)  document.getElementById('admCmds').value   = c.textContent.replace(/[.,]/g,'');
    if(ca) document.getElementById('admCats').value   = ca.textContent;

    // Casino intentos
    const hearts = document.getElementById('casinoHearts');
    if(hearts){
      const count = (hearts.textContent.match(/❤️/g)||[]).length;
      document.getElementById('admCasinoLeft').value = count;
    }

    // Banner
    const txt = document.getElementById('admBannerText');
    if(siteBanner.style.display !== 'none' && bannerText){
      txt.value = bannerText.textContent;
    }
  }

  // ── Guardar stats ──
  function flash(id, msg, isErr){
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = msg;
    el.className = 'adm-flash' + (isErr ? ' err' : '');
    setTimeout(()=>{ el.textContent = ''; }, 2200);
  }

  document.getElementById('admSaveStats').addEventListener('click', ()=>{
    const uVal  = parseInt(document.getElementById('admUsers').value)||0;
    const cVal  = parseInt(document.getElementById('admCmds').value)||0;
    const caVal = parseInt(document.getElementById('admCats').value)||0;
    const upVal = document.getElementById('admUptime').value.trim()||'99.9%';

    const u  = document.getElementById('statUsers');
    const c  = document.getElementById('statCommands');
    const ca = document.getElementById('statCategories');
    const up = document.getElementById('statUptime');

    if(u)  u.textContent  = uVal.toLocaleString('es-PE');
    if(c)  c.textContent  = cVal.toLocaleString('es-PE');
    if(ca) ca.textContent = caVal;
    if(up) up.textContent = upVal;

    flash('statsFlash', '✅ Stats actualizadas');
  });

  // ── Casino intentos ──
  function setCasinoAttempts(n){
    // Llama a la función global del casino si existe
    if(window._casinoSetAttempts){
      window._casinoSetAttempts(n);
    } else {
      // Fallback: guardar en localStorage directamente
      const today = new Date();
      const key = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      try { localStorage.setItem('pragmata_casino_attempts', JSON.stringify({ day: key, left: n })); } catch(e){}
      // Actualizar HUD manualmente
      const hearts = document.getElementById('casinoHearts');
      const info   = document.getElementById('casinoResetInfo');
      if(hearts){
        let h = '';
        for(let i=0;i<3;i++) h += (i < n) ? '❤️ ' : '🖤 ';
        hearts.textContent = h.trim();
      }
      if(info) info.textContent = n > 0 ? `${n} intento${n>1?'s':''} disponible${n>1?'s':''} hoy` : '⏳ Sin intentos — vuelve mañana';
      // Habilitar/deshabilitar botones
      document.querySelectorAll('.btn-play').forEach(btn=>{
        if(btn.id==='bjHitBtn'||btn.id==='bjStandBtn') return;
        btn.disabled = (n <= 0);
      });
      document.querySelectorAll('.no-attempts-notice').forEach(el=>{ el.style.display = (n<=0)?'block':'none'; });
    }
  }

  document.getElementById('admCasinoSet').addEventListener('click', ()=>{
    const n = Math.max(0, Math.min(10, parseInt(document.getElementById('admCasinoLeft').value)||0));
    setCasinoAttempts(n);
    flash('casinoFlash', `✅ Intentos fijados a ${n}`);
    syncDashboard();
  });
  document.getElementById('admCasinoReset').addEventListener('click', ()=>{
    setCasinoAttempts(3);
    document.getElementById('admCasinoLeft').value = 3;
    flash('casinoFlash', '✅ Intentos reseteados a 3');
  });
  document.getElementById('admCasinoMax').addEventListener('click', ()=>{
    setCasinoAttempts(6);
    document.getElementById('admCasinoLeft').value = 6;
    flash('casinoFlash', '✅ Intentos al máximo (6)');
  });
  document.getElementById('admCasinoClear').addEventListener('click', ()=>{
    setCasinoAttempts(0);
    document.getElementById('admCasinoLeft').value = 0;
    flash('casinoFlash', '🚫 Intentos vaciados');
  });

  // ── Banner ──
  document.getElementById('admBannerShow').addEventListener('click', ()=>{
    const txt = document.getElementById('admBannerText').value.trim();
    if(!txt){ flash('bannerFlash','⚠️ Escribe un mensaje primero', true); return; }
    bannerText.textContent = txt;
    siteBanner.style.display = 'block';
    const prev = document.getElementById('admBannerPreview');
    prev.textContent = txt;
    prev.style.display = 'block';
    flash('bannerFlash','📢 Banner publicado');
  });
  document.getElementById('admBannerHide').addEventListener('click', ()=>{
    siteBanner.style.display = 'none';
    document.getElementById('admBannerPreview').style.display = 'none';
    flash('bannerFlash','✅ Banner quitado');
  });
  bannerClose.addEventListener('click', ()=>{ siteBanner.style.display = 'none'; });

  // ── Cambiar PIN ──
  document.getElementById('admSavePin').addEventListener('click', ()=>{
    const p1 = document.getElementById('admNewPin').value.trim();
    const p2 = document.getElementById('admNewPin2').value.trim();
    if(!/^\d{4}$/.test(p1)){ flash('pinFlash','⚠️ El PIN debe ser 4 dígitos', true); return; }
    if(p1 !== p2){ flash('pinFlash','⚠️ Los PINes no coinciden', true); return; }
    savePin(p1);
    document.getElementById('admNewPin').value  = '';
    document.getElementById('admNewPin2').value = '';
    flash('pinFlash','✅ PIN actualizado correctamente');
  });

  document.getElementById('admCasinoResetAll')?.addEventListener('click', async ()=>{
    flash('casinoFlash', '⏳ Reseteando todos...');
    if(window._casinoResetAll){
      const ok = await window._casinoResetAll();
      flash('casinoFlash', ok ? '🌐 ¡Reset global aplicado! Todos tienen 3 intentos.' : '❌ Error al resetear');
    } else {
      flash('casinoFlash', '❌ Función no disponible', true);
    }
    syncDashboard();
  });

  // ── Visitas ──
  async function refreshVisits(){
    const el = document.getElementById('admVisitCount');
    if(!el) return;
    el.textContent = '...';
    if(window._getVisitCount){
      const n = await window._getVisitCount();
      el.textContent = n !== null ? Number(n).toLocaleString('es-PE') : 'Error';
    } else {
      el.textContent = 'No disponible';
    }
  }

  document.getElementById('admRefreshVisits')?.addEventListener('click', ()=>{
    refreshVisits();
    flash('visitsFlash', '🔄 Actualizado');
  });

  document.getElementById('admRedeemRefresh')?.addEventListener('click', ()=>{
    if(window.refreshRedeems) window.refreshRedeems();
  });

  // ── Cerrar sesión ──
  document.getElementById('admLogout').addEventListener('click', ()=>{
    clearSession();
    closePanel();
  });

})();

/* --- bloque --- */
(function(){
  const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const API = SUPABASE_URL + '/rest/v1/visits';
  const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const visitsEl = document.getElementById('statVisits');

  // Evitar contar la misma sesión dos veces
  const SESSION_KEY = 'pragmata_visited';
  let alreadyVisited = false;
  try { alreadyVisited = sessionStorage.getItem(SESSION_KEY) === '1'; } catch(e){}

  async function getCount(){
    try {
      const res = await fetch(API + '?id=eq.1&select=count', { headers: HEADERS });
      const data = await res.json();
      return data[0]?.count ?? 0;
    } catch(e){ return null; }
  }

  async function increment(){
    try {
      // Leer valor actual y sumar 1
      const current = await getCount();
      if(current === null) return;
      await fetch(API + '?id=eq.1', {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ count: current + 1 })
      });
      return current + 1;
    } catch(e){ return null; }
  }

  async function init(){
    let count;
    if(!alreadyVisited){
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch(e){}
      count = await increment();
    } else {
      count = await getCount();
    }

    if(count !== null && visitsEl){
      // Animación count-up
      const target = Number(count);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduceMotion || target === 0){
        visitsEl.textContent = target.toLocaleString('es-PE');
        return;
      }
      const start = performance.now();
      const duration = 1200;
      function tick(now){
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        visitsEl.textContent = Math.floor(eased * target).toLocaleString('es-PE');
        if(p < 1) requestAnimationFrame(tick);
        else visitsEl.textContent = target.toLocaleString('es-PE');
      }
      requestAnimationFrame(tick);
    }
  }

  // Exponer al panel admin para ver visitas en tiempo real
  window._getVisitCount = getCount;

  init();
})();

/* --- bloque --- */
// ════════════════════════════════════════════
// CUENTAS · COINS · CANJE · TOP — Pragmata Bot
// ════════════════════════════════════════════
(function(){
  const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const HDR = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  const USERS_API  = SUPABASE_URL + '/rest/v1/users';
  const LOG_API    = SUPABASE_URL + '/rest/v1/casino_coins_log';
  const REDEEM_API = SUPABASE_URL + '/rest/v1/redeem_requests';
  const CA_API     = SUPABASE_URL + '/rest/v1/casino_attempts';
  const SETTINGS_API = SUPABASE_URL + '/rest/v1/site_settings';
  const POSTS_API  = SUPABASE_URL + '/rest/v1/social_posts';
  const COMMENTS_API = SUPABASE_URL + '/rest/v1/social_comments';
  const REPORTS_API = SUPABASE_URL + '/rest/v1/post_reports';
  const LOGS_API = SUPABASE_URL + '/rest/v1/activity_log';
  const NOTIF_API = SUPABASE_URL + '/rest/v1/notifications';
  const FRIENDS_API = SUPABASE_URL + '/rest/v1/friendships';
  const STORAGE_URL = SUPABASE_URL + '/storage/v1';
  const SESSION_KEY = 'pragmata_account_session';

  // ── helpers de sesión ──
  function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e){ return null; } }
  function setSession(u){ try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch(e){} }
  function clearSession(){ try { localStorage.removeItem(SESSION_KEY); } catch(e){} }

  function getBrowserUid(){
    try {
      let id = localStorage.getItem('pragmata_uid');
      if(!id){ id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pragmata_uid', id); }
      return id;
    } catch(e){ return 'u_anon'; }
  }

  async function sha256(str){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function fmtN(n){ return Number(n||0).toLocaleString('es-PE'); }
  function genCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'PRG-';
    for(let i=0;i<8;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  function logActivity(userId, username, action, detail){
    fetch(LOGS_API, {
      method: 'POST', headers: { ...HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, username, action, detail: detail || '' })
    }).catch(()=>{});
  }

  // ── Upload a Supabase Storage ──
  async function uploadToStorage(bucket, path, file){
    const res = await fetch(`${STORAGE_URL}/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    });
    if(!res.ok){ const e = await res.text(); throw new Error(e); }
    return `${STORAGE_URL}/object/public/${bucket}/${path}`;
  }

  // ── Avatar generado por usuario ──
  const AVATAR_COLORS = ['#ff6fb0','#4fa8ff','#ffd23f','#39ff88','#7c5cff','#ff8a3d','#3ddbd9','#ff5c5c'];
  const COVER_COLORS  = ['#7c5cff','#ff6fb0','#ffd23f','#39ff88','#ff3860','#4fa8ff','#ff8a3d','#18131f'];
  function hashStr(s){ let h = 0; for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; } return h; }
  function getAvatarColor(username){
    const s = getSession();
    if(s && s.username === username && s.avatar_color) return s.avatar_color;
    return AVATAR_COLORS[hashStr(username) % AVATAR_COLORS.length];
  }
  function avatarHTML(username, size, avatarUrl){
    const sz = size === 'lg' ? ' lg' : '';
    if(avatarUrl){
      return `<span class="avatar-img${sz}"><img src="${avatarUrl.replace(/"/g,'&quot;')}" alt="${escapeHtml(username)}" loading="lazy"></span>`;
    }
    const color = getAvatarColor(username);
    const initial = (username||'?').trim().charAt(0).toUpperCase();
    return `<span class="avatar${sz}" style="background:${color}">${escapeHtml(initial)}</span>`;
  }

  // ── Insignia de rango por Coins ──
  function rankBadge(coins){
    coins = coins || 0;
    if(coins >= 10000) return '👑 Leyenda';
    if(coins >= 2000)  return '🥇 Pro';
    if(coins >= 500)   return '🥈 Activo';
    return '🥉 Novato';
  }

  // ── Lazo de género ──
  function genderRibbon(g){
    if(g === 'F') return '<span class="gender-ribbon g-f" title="Rosa">🎀</span>';
    if(g === 'M') return '<span class="gender-ribbon g-m" title="Azul">🎀</span>';
    return '';
  }

  // ── Verificado y Staff ──
  function verifiedBadge(v){
    return v ? '<span class="verified-badge" title="Cuenta verificada">✔</span>' : '';
  }
  function staffBadge(s){
    return s ? '<span class="staff-badge">STAFF</span>' : '';
  }
  // Combina avatar + nombre + lazo + verificado + staff, listo para insertar en cualquier lado
  function nameTagHTML(username, opts){
    opts = opts || {};
    return `${avatarHTML(username, '', opts.avatar_url)}${verifiedBadge(opts.verified)}${genderRibbon(opts.gender)}${staffBadge(opts.staff)} <span class="user-clickable-name">${escapeHtml(username)}</span>`;
  }

  // ── UI: barra de cuenta ──
  const accBar    = document.getElementById('coinsAccountInfo');
  const accBtn    = document.getElementById('coinsAccountBtn');
  const modalOv   = document.getElementById('accModalOverlay');
  const accUserIn = document.getElementById('accUsername');
  const accPinIn  = document.getElementById('accPin');
  const accErr    = document.getElementById('accModalError');
  const accGoBtn  = document.getElementById('accModalGo');
  const accCancel = document.getElementById('accModalCancel');

  function renderAccountBar(){
    const s = getSession();
    const editBtn = document.getElementById('coinsEditProfileBtn');
    if(!accBar || !accBtn) return;
    if(s){
      accBar.innerHTML = `${avatarHTML(s.username)} <span class="acc-name">${escapeHtml(s.username)}</span>${verifiedBadge(s.verified)} ${genderRibbon(s.gender)}${staffBadge(s.staff)} <span class="rank-badge">${rankBadge(s.coins)}</span> · 🪙 <b id="coinsBalanceVal">${fmtN(s.coins)}</b> Coins`;
      accBtn.textContent = '🔓 Cerrar sesión';
      accBtn.classList.add('logout');
      if(editBtn) editBtn.style.display = '';
      if(notifWrapper) notifWrapper.style.display = '';
      startNotifPoll();
    } else {
      accBar.innerHTML = `🔒 No has iniciado sesión`;
      accBtn.textContent = '👤 Iniciar sesión';
      accBtn.classList.remove('logout');
      if(editBtn) editBtn.style.display = 'none';
      if(notifWrapper) notifWrapper.style.display = 'none';
      stopNotifPoll();
    }
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  accBtn && accBtn.addEventListener('click', ()=>{
    const s = getSession();
    if(s){
      clearSession();
      renderAccountBar();
      syncComposer();
    } else {
      accErr.textContent = '';
      accUserIn.value = '';
      accPinIn.value = '';
      modalOv.classList.add('open');
    }
  });
  accCancel && accCancel.addEventListener('click', ()=> modalOv.classList.remove('open'));
  modalOv && modalOv.addEventListener('click', (e)=>{ if(e.target===modalOv) modalOv.classList.remove('open'); });

  let selectedGender = '';
  const genderPick = document.getElementById('genderPick');
  genderPick && genderPick.addEventListener('click', (e)=>{
    const opt = e.target.closest('.gender-opt');
    if(!opt) return;
    genderPick.querySelectorAll('.gender-opt').forEach(b=>b.classList.remove('active'));
    opt.classList.add('active');
    selectedGender = opt.dataset.g;
  });

  accGoBtn && accGoBtn.addEventListener('click', async ()=>{
    const username = (accUserIn.value||'').trim();
    const pin = (accPinIn.value||'').trim();
    accErr.textContent = '';
    if(username.length < 3){ accErr.textContent = 'Usuario muy corto (mínimo 3 caracteres).'; return; }
    if(!/^\d{6}$/.test(pin)){ accErr.textContent = 'El PIN debe tener exactamente 6 dígitos.'; return; }
    accGoBtn.disabled = true; accGoBtn.textContent = 'Verificando…';
    try {
      const r = await loginOrRegister(username, pin, selectedGender);
      if(r.error){ accErr.textContent = r.error; }
      else {
        modalOv.classList.remove('open'); renderAccountBar(); syncComposer();
        if(r.dailyBonus) setTimeout(()=>alert(`🎁 ¡Bono diario! +${r.dailyBonus} 🪙 por entrar hoy.`), 200);
      }
    } catch(e){
      accErr.textContent = 'Error de conexión. Intenta de nuevo.';
    }
    accGoBtn.disabled = false; accGoBtn.textContent = 'Entrar';
  });

  function todayStr(){ return new Date().toISOString().slice(0,10); }

  async function loginOrRegister(username, pin, gender){
    const pinHash = await sha256(pin);
    const res = await fetch(`${USERS_API}?username=eq.${encodeURIComponent(username)}&select=id,username,pin_hash,coins,last_login,banned,gender,bio,verified,staff`, { headers: HDR });
    const rows = await res.json();
    if(rows && rows.length){
      const u = rows[0];
      if(u.pin_hash !== pinHash) return { error: 'PIN incorrecto para ese usuario.' };
      if(u.banned) return { error: 'Esta cuenta está suspendida. Contacta a un admin.' };
      const today = todayStr();
      let coins = u.coins || 0;
      let dailyBonus = 0;
      if(u.last_login !== today){
        dailyBonus = 20;
        coins += dailyBonus;
        await fetch(`${USERS_API}?id=eq.${u.id}`, {
          method: 'PATCH', headers: { ...HDR, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ coins, last_login: today })
        });
        await fetch(LOG_API, {
          method: 'POST', headers: { ...HDR, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: u.id, amount: dailyBonus, reason: 'login_diario' })
        });
      }
      setSession({ id: u.id, username: u.username, coins, gender: u.gender, bio: u.bio, verified: u.verified, staff: u.staff });
      logActivity(u.id, u.username, 'login', dailyBonus ? `bono diario +${dailyBonus}` : '');
      return { ok: true, dailyBonus };
    } else {
      const ins = await fetch(USERS_API, {
        method: 'POST',
        headers: { ...HDR, 'Prefer': 'return=representation' },
        body: JSON.stringify({ username, pin_hash: pinHash, coins: 0, last_login: todayStr(), gender: gender || null })
      });
      const data = await ins.json();
      if(!data || !data[0]) return { error: 'No se pudo crear la cuenta. ¿El usuario ya existe?' };
      setSession({ id: data[0].id, username: data[0].username, coins: data[0].coins||0, gender: data[0].gender, bio: data[0].bio, verified: false, staff: false });
      logActivity(data[0].id, data[0].username, 'registro', '');
      return { ok: true };
    }
  }

  // ── Editar perfil (bio / género / colores / estado / foto) ──
  const profileEditOv   = document.getElementById('profileEditOverlay');
  const profileBioIn    = document.getElementById('profileBioInput');
  const profileStatusIn = document.getElementById('profileStatusInput');
  const profileGenderPk = document.getElementById('profileGenderPick');
  const avatarColorPk   = document.getElementById('avatarColorPicker');
  const coverColorPk    = document.getElementById('coverColorPicker');
  const avatarFileInput = document.getElementById('avatarFileInput');
  let pendingAvatarFile = null;

  // Rellenar swatches
  if(avatarColorPk) avatarColorPk.innerHTML = AVATAR_COLORS.map(c=>`<span class="profile-color-swatch" data-type="avatar" data-color="${c}" style="background:${c}"></span>`).join('');
  if(coverColorPk)  coverColorPk.innerHTML  = COVER_COLORS.map(c=>`<span class="profile-color-swatch" data-type="cover" data-color="${c}" style="background:${c}"></span>`).join('');

  avatarFileInput && avatarFileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 2*1024*1024){ alert('La imagen no debe superar 2 MB.'); return; }
    pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const wrap = document.getElementById('avatarUploadWrap');
      if(wrap){
        const existing = wrap.querySelector('#avatarPreviewModal');
        if(existing) existing.outerHTML = `<span id="avatarPreviewModal" class="avatar-img lg" style="display:inline-flex;"><img src="${ev.target.result}" style="width:56px;height:56px;object-fit:cover;border-radius:50%;"></span>`;
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('coinsEditProfileBtn')?.addEventListener('click', ()=>{
    const s = getSession();
    if(!s) return;
    const modal = document.getElementById('avatarPreviewModal');
    if(modal && s.avatar_url){
      modal.outerHTML = `<span id="avatarPreviewModal" class="avatar-img lg" style="display:inline-flex;"><img src="${s.avatar_url}" style="width:56px;height:56px;object-fit:cover;border-radius:50%;"></span>`;
    } else if(modal) {
      const color = getAvatarColor(s.username);
      modal.style.background = color;
      modal.textContent = s.username.charAt(0).toUpperCase();
    }
    pendingAvatarFile = null;
    profileBioIn.value = s.bio || '';
    profileStatusIn.value = s.status_text || '';
    profileGenderPk.querySelectorAll('.gender-opt').forEach(b=> b.classList.toggle('active', b.dataset.g === (s.gender || '')));
    avatarColorPk.querySelectorAll('.profile-color-swatch').forEach(b=> b.classList.toggle('selected', b.dataset.color === (s.avatar_color || '')));
    coverColorPk.querySelectorAll('.profile-color-swatch').forEach(b=> b.classList.toggle('selected', b.dataset.color === (s.cover_color || '')));
    profileEditOv.classList.add('open');
  });

  [avatarColorPk, coverColorPk].forEach(picker=>{
    picker && picker.addEventListener('click', (e)=>{
      const sw = e.target.closest('.profile-color-swatch');
      if(!sw) return;
      picker.querySelectorAll('.profile-color-swatch').forEach(b=>b.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  profileGenderPk && profileGenderPk.addEventListener('click', (e)=>{
    const opt = e.target.closest('.gender-opt');
    if(!opt) return;
    profileGenderPk.querySelectorAll('.gender-opt').forEach(b=>b.classList.remove('active'));
    opt.classList.add('active');
  });
  document.getElementById('profileEditCancel')?.addEventListener('click', ()=> profileEditOv.classList.remove('open'));
  profileEditOv && profileEditOv.addEventListener('click', (e)=>{ if(e.target===profileEditOv) profileEditOv.classList.remove('open'); });

  document.getElementById('profileEditSave')?.addEventListener('click', async ()=>{
    const s = getSession();
    if(!s) return;
    const saveBtn = document.getElementById('profileEditSave');
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
    try {
      let avatar_url = s.avatar_url || null;
      if(pendingAvatarFile){
        const ext = pendingAvatarFile.name.split('.').pop();
        const path = `${s.id}/avatar.${ext}`;
        avatar_url = await uploadToStorage('avatars', path, pendingAvatarFile);
      }
      const bio = (profileBioIn.value || '').trim();
      const status_text = (profileStatusIn.value || '').trim();
      const activeG = profileGenderPk.querySelector('.gender-opt.active');
      const gender = activeG ? activeG.dataset.g : '';
      const avatar_color = avatarColorPk.querySelector('.selected')?.dataset.color || null;
      const cover_color  = coverColorPk.querySelector('.selected')?.dataset.color || null;
      await fetch(`${USERS_API}?id=eq.${s.id}`, {
        method: 'PATCH', headers: { ...HDR, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ bio, status_text, gender: gender || null, avatar_color, cover_color, avatar_url })
      });
      s.bio = bio; s.status_text = status_text; s.gender = gender || null;
      s.avatar_color = avatar_color; s.cover_color = cover_color; s.avatar_url = avatar_url;
      setSession(s);
      renderAccountBar();
      profileEditOv.classList.remove('open');
      pendingAvatarFile = null;
    } catch(e){ alert('No se pudo guardar el perfil: ' + e.message); }
    saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
  });


  // ── Ver perfil de otro usuario ──
  const profileViewOv   = document.getElementById('profileViewOverlay');
  const profileViewBody = document.getElementById('profileViewBody');

  window.openProfileView = async function(userId){
    if(!userId || !profileViewBody) return;
    profileViewBody.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>';
    profileViewOv.classList.add('open');
    try {
      const [uRes, pRes, frRes] = await Promise.all([
        fetch(`${USERS_API}?id=eq.${userId}&select=username,coins,gender,bio,verified,staff,avatar_color,cover_color,status_text,avatar_url`, { headers: HDR }),
        fetch(`${POSTS_API}?user_id=eq.${userId}&select=content,created_at,image_url&order=created_at.desc&limit=15`, { headers: HDR }),
        fetch(`${FRIENDS_API}?or=(requester_id.eq.${userId},addressee_id.eq.${userId})&status=eq.accepted&select=requester_id,addressee_id,users!friendships_requester_id_fkey(username,avatar_url),userAddr:users!friendships_addressee_id_fkey(username,avatar_url)`, { headers: HDR })
      ]);
      const uRows = await uRes.json();
      const pRows = await pRes.json();
      const fRows = await frRes.json().catch(()=>[]);
      if(!uRows || !uRows[0]){ profileViewBody.innerHTML = '<div class="social-feed-empty">Usuario no encontrado.</div>'; return; }
      const u = uRows[0];
      const coverStyle = u.cover_color ? `background:${u.cover_color}` : 'background:linear-gradient(135deg,#7c5cff 0%,#ffd23f 100%)';
      const avatarEl = u.avatar_url
        ? `<span class="avatar-img lg" style="border:3px solid var(--panel);flex-shrink:0;"><img src="${u.avatar_url.replace(/"/g,'&quot;')}" style="width:56px;height:56px;object-fit:cover;border-radius:50%;"></span>`
        : `<span class="avatar lg" style="background:${u.avatar_color || AVATAR_COLORS[hashStr(u.username)%AVATAR_COLORS.length]};border:3px solid var(--panel)">${escapeHtml(u.username.charAt(0).toUpperCase())}</span>`;
      const friendCount = fRows ? fRows.length : 0;
      profileViewBody.innerHTML = `
        <div class="profile-cover" style="${coverStyle}"></div>
        <div class="profile-view-row">
          ${avatarEl}
          <div>
            <div class="profile-view-name">${escapeHtml(u.username)}${verifiedBadge(u.verified)} ${genderRibbon(u.gender)}${staffBadge(u.staff)} <span class="rank-badge">${rankBadge(u.coins)}</span></div>
            ${u.status_text ? `<div style="font-family:var(--f-mono);font-size:11px;color:var(--gold);margin-top:3px;">💬 ${escapeHtml(u.status_text)}</div>` : ''}
            ${u.bio ? `<div class="profile-view-bio">${escapeHtml(u.bio)}</div>` : ''}
          </div>
        </div>
        <div class="profile-view-stats">🪙 <b style="color:var(--gold)">${fmtN(u.coins)}</b> Coins · 👥 <b>${friendCount}</b> amigos</div>
        <div class="profile-friend-btn-wrap" id="pfbw-${userId}"></div>
        <div class="profile-view-posts" style="margin-top:10px;">
          ${pRows && pRows.length ? pRows.map(p=>`
            <div class="profile-view-post">
              ${escapeHtml(p.content||'')}
              ${p.image_url ? `<img src="${p.image_url.replace(/"/g,'&quot;')}" style="max-width:100%;margin-top:6px;border:1px solid var(--line);" loading="lazy">` : ''}
              <br><span style="color:var(--text-dim);font-size:11px;">${timeAgo(p.created_at)}</span>
            </div>`) .join('') : '<div class="social-feed-empty">Sin publicaciones todavía.</div>'}
        </div>
        <button class="acc-modal-go profile-view-close" id="profileViewCloseBtn" style="margin-top:14px;">Cerrar</button>
      `;
      document.getElementById('profileViewCloseBtn')?.addEventListener('click', ()=> profileViewOv.classList.remove('open'));
      // Renderizar botón de amistad
      const fbWrap = document.getElementById(`pfbw-${userId}`);
      if(fbWrap) await renderFriendBtn(fbWrap, userId, u.username);
    } catch(e){
      profileViewBody.innerHTML = '<div class="social-feed-empty">No se pudo cargar el perfil.</div>';
    }
  };
  profileViewOv && profileViewOv.addEventListener('click', (e)=>{ if(e.target===profileViewOv) profileViewOv.classList.remove('open'); });

  window.openProfileByUsername = async function(username){
    try {
      const res = await fetch(`${USERS_API}?username=eq.${encodeURIComponent(username)}&select=id`, { headers: HDR });
      const rows = await res.json();
      if(rows && rows[0]) window.openProfileView(rows[0].id);
      else alert(`@${username} no existe.`);
    } catch(e){}
  };

  // ── Coins: otorgar y refrescar saldo ──
  async function addCoins(amount, reason){
    const s = getSession();
    if(!s) return;
    try {
      const res = await fetch(`${USERS_API}?id=eq.${s.id}&select=coins`, { headers: HDR });
      const rows = await res.json();
      const current = (rows && rows[0]) ? rows[0].coins : (s.coins||0);
      const updated = current + amount;
      await fetch(`${USERS_API}?id=eq.${s.id}`, {
        method: 'PATCH', headers: { ...HDR, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ coins: updated })
      });
      await fetch(LOG_API, {
        method: 'POST', headers: { ...HDR, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ user_id: s.id, amount, reason })
      });
      s.coins = updated; setSession(s);
      const bal = document.getElementById('coinsBalanceVal');
      if(bal) bal.textContent = fmtN(updated);
    } catch(e){}
  }

  window.recordCoinsPlay = function(){ if(getSession()) addCoins(5, 'jugada'); };
  window.recordCoinsWin  = function(){ if(getSession()) addCoins(10, 'victoria'); burstConfetti(); };

  // ── Log de Premios (público) ──
  function cleanPrizeText(raw){
    if(!raw) return '';
    return String(raw).replace(/^[^\wÁÉÍÓÚÑáéíóúñ0-9]+/u, '').trim();
  }
  const PRIZE_FLAIRS = ['¡increíble!! 🔥','¡qué suerte!! 🍀','¡se lo mereció!! 🎉','está en racha!! ⚡','¡wow!! 😱','¡vamos por más!! 💪'];
  window.recordPrizeWin = function(prizeText){
    const s = getSession();
    if(!s || !prizeText) return;
    const clean = cleanPrizeText(prizeText);
    if(!clean) return;
    logActivity(s.id, s.username, 'premio', clean);
    prependPrizeLog(s.username, clean, true);
  };

  function prizeIcon(prizeText){
    const t = (prizeText||'').toLowerCase();
    if(t.includes('gema')) return '💎';
    if(t.includes('oro')) return '🥇';
    if(t.includes('intento')) return '🍀';
    return '🏆';
  }

  function prizeLogRowHtml(username, prizeText, isNew){
    const flair = PRIZE_FLAIRS[Math.floor(Math.random()*PRIZE_FLAIRS.length)];
    return `<div class="prize-log-item${isNew?' is-new':''}">
      <span class="prize-log-ico">${prizeIcon(prizeText)}</span>
      <div class="prize-log-body"><span class="prize-log-user">${escapeHtml(username)}</span> ganó <span class="prize-log-prize">${escapeHtml(prizeText)}</span>, ${flair}</div>
      <span class="prize-log-time">ahora</span>
    </div>`;
  }

  function prependPrizeLog(username, prizeText, isNew){
    const feed = document.getElementById('prizeLogFeed');
    if(!feed) return;
    const empty = feed.querySelector('.prize-log-empty');
    if(empty) empty.remove();
    feed.insertAdjacentHTML('afterbegin', prizeLogRowHtml(username, prizeText, isNew));
    while(feed.children.length > 40) feed.lastElementChild.remove();
  }

  async function refreshPrizeLog(){
    const feed = document.getElementById('prizeLogFeed');
    if(!feed) return;
    try {
      const res = await fetch(`${LOGS_API}?action=eq.premio&select=username,detail,created_at&order=created_at.desc&limit=25`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ feed.innerHTML = '<div class="prize-log-empty">Aún no hay premios registrados. ¡Sé el primero!</div>'; return; }
      feed.innerHTML = rows.map(r => `<div class="prize-log-item">
        <span class="prize-log-ico">${prizeIcon(r.detail)}</span>
        <div class="prize-log-body"><span class="prize-log-user">${escapeHtml(r.username||'Jugador')}</span> ganó <span class="prize-log-prize">${escapeHtml(r.detail||'')}</span>, ${PRIZE_FLAIRS[Math.floor(Math.random()*PRIZE_FLAIRS.length)]}</div>
        <span class="prize-log-time">${timeAgo(r.created_at)}</span>
      </div>`).join('');
    } catch(e){
      feed.innerHTML = '<div class="prize-log-empty">Error al cargar el log de premios.</div>';
    }
  }
  refreshPrizeLog();
  setInterval(refreshPrizeLog, 20000);

  function burstConfetti(){
    const colors = ['#39ff88','#ffd23f','#7c5cff','#ff6fb0','#4fa8ff','#ff8a3d'];
    const count = 36;
    for(let i=0;i<count;i++){
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const size = Math.random()*8 + 6;
      piece.style.left = Math.random()*100 + 'vw';
      piece.style.width = size + 'px';
      piece.style.height = size*0.4 + 'px';
      piece.style.background = colors[Math.floor(Math.random()*colors.length)];
      piece.style.animationDuration = (Math.random()*1.5 + 1.8) + 's';
      piece.style.animationDelay = (Math.random()*0.3) + 's';
      document.body.appendChild(piece);
      setTimeout(()=> piece.remove(), 4000);
    }
  }

  // ── Canje (tienda) ──
  document.querySelectorAll('.cshop-redeem-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const s = getSession();
      if(!s){ modalOv.classList.add('open'); return; }
      const cost = parseInt(btn.dataset.cost, 10) || 0;
      const item = btn.dataset.item;
      const cat  = btn.dataset.cat;
      if(s.coins < cost){ alert(`No tienes suficientes Coins. Necesitas ${fmtN(cost)} 🪙 y tienes ${fmtN(s.coins)} 🪙.`); return; }
      if(!confirm(`¿Canjear "${item}" por ${fmtN(cost)} 🪙?`)) return;

      btn.disabled = true;
      const code = genCode();
      try {
        // Descontar coins
        const updated = s.coins - cost;
        await fetch(`${USERS_API}?id=eq.${s.id}`, {
          method: 'PATCH', headers: { ...HDR, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ coins: updated })
        });
        await fetch(LOG_API, {
          method: 'POST', headers: { ...HDR, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: s.id, amount: -cost, reason: 'canje:' + item })
        });
        await fetch(REDEEM_API, {
          method: 'POST', headers: { ...HDR, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            user_id: s.id, item, cost, code, status: 'pendiente',
            category: cat, target_uid: getBrowserUid()
          })
        });
        s.coins = updated; setSession(s);
        const bal = document.getElementById('coinsBalanceVal');
        if(bal) bal.textContent = fmtN(updated);
        alert(`✅ Solicitud creada.\nTu código: ${code}\nUn admin debe aprobarla en el panel para que se aplique.`);
        logActivity(s.id, s.username, 'canje', `${item} (${cost} 🪙)`);
      } catch(e){
        alert('Error al procesar el canje. Intenta de nuevo.');
      }
      btn.disabled = false;
    });
  });

  // ── Top Coins (ranking real) ──
  let coinsTopLoaded = false;
  window.loadCoinsTop = async function(){
    if(coinsTopLoaded) return;
    const podium = document.getElementById('coinsTopPodium');
    const list   = document.getElementById('coinsTopList');
    const note   = document.getElementById('coinsTopNote');
    try {
      const res = await fetch(`${USERS_API}?select=id,username,coins,gender,verified,staff&order=coins.desc&limit=10`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){
        podium.innerHTML = '';
        list.innerHTML = '';
        note.textContent = 'Aún no hay jugadores registrados en el casino.';
        return;
      }
      const medals = ['🥇','🥈','🥉'];
      const classes = ['gold','silver','bronze'];
      podium.innerHTML = rows.slice(0,3).map((r,i)=>`
        <div class="podium-card ${classes[i]}"><div class="podium-rank">${medals[i]}</div><div class="podium-name user-clickable" data-uid="${r.id}">${nameTagHTML(r.username, r)}</div><div class="podium-meta">🪙 <b>${fmtN(r.coins)}</b> Coins</div></div>
      `).join('');
      list.innerHTML = rows.slice(3).map((r,i)=>`
        <div class="top-row"><span class="rank">${i+4}</span><span class="name user-clickable" data-uid="${r.id}">${nameTagHTML(r.username, r)}</span><span class="meta">🪙 <b>${fmtN(r.coins)}</b></span></div>
      `).join('');
      note.textContent = `Top ${rows.length} jugadores registrados con más Coins.`;
      coinsTopLoaded = true;
    } catch(e){
      note.textContent = 'No se pudo cargar el ranking. Intenta de nuevo.';
    }
  };
  document.addEventListener('click', (e)=>{
    const el = e.target.closest('.user-clickable');
    if(el && el.dataset.uid) window.openProfileView(el.dataset.uid);
  });

  // ── Panel Admin: canjes pendientes ──
  async function refreshRedeems(){
    const box = document.getElementById('admRedeemList');
    if(!box) return;
    box.innerHTML = 'Cargando…';
    try {
      const res = await fetch(`${REDEEM_API}?status=eq.pendiente&select=id,item,cost,code,category,target_uid,created_at,user_id,users(username)&order=created_at.asc`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ box.innerHTML = '<div class="adm-redeem-empty">Sin canjes pendientes.</div>'; return; }
      box.innerHTML = rows.map(r => `
        <div class="adm-redeem-row" data-id="${r.id}" data-cat="${r.category||''}" data-uid="${r.target_uid||''}">
          <div class="adm-redeem-info">
            <b>${escapeHtml((r.users && r.users.username) || '—')}</b> pidió <b>${escapeHtml(r.item)}</b>
            <span class="adm-redeem-code">${r.code}</span>
          </div>
          <div class="adm-redeem-btns">
            <button class="adm-btn adm-redeem-approve">✅ Aprobar</button>
            <button class="adm-btn danger adm-redeem-reject">✕ Rechazar</button>
          </div>
        </div>
      `).join('');
    } catch(e){
      box.innerHTML = '<div class="adm-redeem-empty">Error al cargar canjes.</div>';
    }
  }
  window.refreshRedeems = refreshRedeems;

  document.addEventListener('click', async (e)=>{
    const approveBtn = e.target.closest('.adm-redeem-approve');
    const rejectBtn  = e.target.closest('.adm-redeem-reject');
    if(!approveBtn && !rejectBtn) return;
    const row = e.target.closest('.adm-redeem-row');
    const id = row.dataset.id;
    const cat = row.dataset.cat;
    const uid = row.dataset.uid;

    if(rejectBtn){
      await fetch(`${REDEEM_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ status:'rechazado' }) });
      refreshRedeems();
      return;
    }

    // Aprobar
    if(cat === 'lives'){
      // Determinar cuántos intentos según el ítem (mapeo simple por costo del texto del botón ya usado)
      try {
        const r2 = await fetch(`${CA_API}?id=eq.${uid}&select=count,day`, { headers: HDR });
        const d2 = await r2.json();
        if(d2 && d2[0]){
          const newCount = d2[0].count + 3; // por defecto +3; ajustar manualmente si el ítem era de +6
          await fetch(`${CA_API}?id=eq.${uid}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ count: newCount }) });
        }
      } catch(e){}
    }
    await fetch(`${REDEEM_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ status:'aprobado' }) });
    refreshRedeems();
  });

  // ── Estado del bot (online/offline, visible para todos) ──
  async function loadBotStatus(){
    const bar = document.getElementById('heroStatusBar');
    const txt = document.getElementById('heroStatusText');
    if(!bar || !txt) return;
    try {
      const res = await fetch(`${SETTINGS_API}?id=eq.1&select=bot_status`, { headers: HDR });
      const rows = await res.json();
      const status = (rows && rows[0]) ? rows[0].bot_status : 'online';
      if(status === 'offline'){
        bar.classList.add('offline');
        txt.textContent = 'BOT APAGADO — FUERA DE LÍNEA';
      } else {
        bar.classList.remove('offline');
        txt.textContent = 'SERVIDOR EN LÍNEA — RESPONDIENDO';
      }
    } catch(e){}
  }
  loadBotStatus();

  async function setBotStatus(status){
    try {
      await fetch(`${SETTINGS_API}?id=eq.1`, {
        method: 'PATCH', headers: { ...HDR, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ bot_status: status, updated_at: new Date().toISOString() })
      });
      loadBotStatus();
      const flash = document.getElementById('botStatusFlash');
      if(flash){ flash.textContent = status === 'online' ? '✅ Marcado como Online' : '🔴 Marcado como Offline'; setTimeout(()=>flash.textContent='', 2200); }
    } catch(e){}
  }
  document.getElementById('admBotOnline')?.addEventListener('click', ()=> setBotStatus('online'));
  document.getElementById('admBotOffline')?.addEventListener('click', ()=> setBotStatus('offline'));

  // ── Notificaciones ──
  let notifPollTimer = null;
  const notifBell    = document.getElementById('notifBell');
  const notifBadge   = document.getElementById('notifBadge');
  const notifPanel   = document.getElementById('notifPanel');
  const notifWrapper = document.getElementById('notifWrapper');

  async function pollNotifications(){
    const s = getSession();
    if(!s) return;
    try {
      const res = await fetch(`${NOTIF_API}?user_id=eq.${s.id}&select=id,type,from_username,post_id,preview,read,created_at&order=created_at.desc&limit=20`, { headers: HDR });
      const rows = await res.json();
      const unread = rows.filter(n=>!n.read);
      if(notifBadge){ notifBadge.style.display = unread.length ? 'flex' : 'none'; notifBadge.textContent = unread.length > 9 ? '9+' : unread.length; }
      const notifList = document.getElementById('notifList');
      if(notifList){
        if(!rows || !rows.length){ notifList.innerHTML = '<div class="notif-empty">Sin notificaciones.</div>'; }
        else {
          notifList.innerHTML = rows.map(n=>{
            const icon = n.type==='comment'?'💬':n.type==='mention'?'@':n.type==='friend_request'?'👥':'💬@';
            const msg  = n.type==='comment' ? `<b>${escapeHtml(n.from_username)}</b> comentó tu publicación`
                       : n.type==='mention' ? `<b>${escapeHtml(n.from_username)}</b> te mencionó en un post`
                       : n.type==='friend_request' ? `<b>${escapeHtml(n.from_username)}</b> te envió solicitud de amistad`
                       : `<b>${escapeHtml(n.from_username)}</b> te mencionó en un comentario`;
            return `<div class="notif-item${n.read?'':' unread'}" data-notif-id="${n.id}" data-post-id="${n.post_id||''}">
              ${icon} ${msg}
              ${n.preview?`<div style="color:var(--text-dim);margin-top:3px;font-size:11px;">"${escapeHtml(n.preview.slice(0,50))}"</div>`:''}
              <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>`;
          }).join('');
        }
      }
      loadFriendRequests();
    } catch(e){}
  }

  notifBell && notifBell.addEventListener('click', async (e)=>{
    e.stopPropagation();
    notifPanel.classList.toggle('open');
    if(notifPanel.classList.contains('open')){
      const s = getSession();
      if(s){ await fetch(`${NOTIF_API}?user_id=eq.${s.id}&read=eq.false`,{ method:'PATCH',headers:{...HDR,'Prefer':'return=minimal'},body:JSON.stringify({read:true}) }).catch(()=>{}); if(notifBadge) notifBadge.style.display='none'; }
    }
  });
  document.addEventListener('click', (e)=>{
    if(notifPanel && !e.target.closest('.notif-wrapper')) notifPanel.classList.remove('open');
    const item = e.target.closest('.notif-item[data-post-id]');
    if(item && item.dataset.postId){
      notifPanel.classList.remove('open');
      const postEl = document.querySelector(`.social-post[data-post-id="${item.dataset.postId}"]`);
      postEl?.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  });

  function startNotifPoll(){ pollNotifications(); notifPollTimer = setInterval(pollNotifications, 30000); }
  function stopNotifPoll(){ if(notifPollTimer){ clearInterval(notifPollTimer); notifPollTimer=null; } }

  async function sendNotification(toUserId, type, fromUsername, postId, preview){
    if(!toUserId) return;
    const s = getSession();
    if(s && s.id === toUserId) return;
    try { await fetch(NOTIF_API,{ method:'POST',headers:{...HDR,'Prefer':'return=minimal'},body:JSON.stringify({user_id:toUserId,type,from_username:fromUsername,post_id:postId,preview:preview||''}) }); } catch(e){}
  }

  async function notifyMentions(text, postId, notifType){
    const s = getSession(); if(!s) return;
    const mentions = [...new Set((text.match(/@([a-zA-Z0-9_]{3,20})/g)||[]).map(m=>m.slice(1)))];
    for(const uname of mentions){
      if(uname===s.username) continue;
      try { const res=await fetch(`${USERS_API}?username=eq.${encodeURIComponent(uname)}&select=id`,{headers:HDR}); const rows=await res.json(); if(rows&&rows[0]) await sendNotification(rows[0].id,notifType,s.username,postId,text.slice(0,60)); } catch(e){}
    }
  }

  async function updateCommentCount(postId, delta){
    try {
      const res = await fetch(`${POSTS_API}?id=eq.${postId}&select=comment_count`,{headers:HDR});
      const rows = await res.json();
      const current = (rows&&rows[0]) ? (rows[0].comment_count||0) : 0;
      const newCount = current + delta;
      await fetch(`${POSTS_API}?id=eq.${postId}`,{method:'PATCH',headers:{...HDR,'Prefer':'return=minimal'},body:JSON.stringify({comment_count:newCount})});
      const toggle = document.querySelector(`.social-comment-toggle[data-id="${postId}"]`);
      if(toggle) toggle.innerHTML = newCount > 0 ? `💬 ${newCount}` : '💬 Comentarios';
    } catch(e){}
  }

  // ── Muro Social ──
  const socialInput   = document.getElementById('socialInput');
  const socialPostBtn = document.getElementById('socialPostBtn');
  const socialCount   = document.getElementById('socialCharCount');
  const socialFeed    = document.getElementById('socialFeed');

  function syncComposer(){
    const s = getSession();
    if(socialInput) socialInput.disabled = !s;
    if(socialPostBtn) socialPostBtn.disabled = !s;
    if(socialInput) socialInput.placeholder = s ? '¿Qué quieres compartir?' : 'Inicia sesión arriba en Coins Pragmata para poder publicar…';
    document.getElementById('stickerToggleBtn').disabled = !s;
    document.getElementById('gifAddBtn').disabled = !s;
    const imgLabel = document.getElementById('imgUploadLabel');
    if(imgLabel) imgLabel.style.display = s ? '' : 'none';
  }

  function timeAgo(iso){
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if(diff < 60) return 'hace un momento';
    if(diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if(diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return `hace ${Math.floor(diff/86400)} d`;
  }

  const FEED_PAGE_SIZE = 15;
  let feedOffset = 0;
  let feedDone = false;
  let feedLoading = false;
  let feedSentinelObserver = null;

  function renderPostBody(content){
    // Extraer GIF si existe al final
    let gif = '';
    content = content.replace(/\[gif:(https?:\/\/[^\]]+)\]/g, (_, url)=>{
      gif = `<img class="post-gif" src="${url.replace(/"/g,'&quot;')}" alt="GIF" loading="lazy">`;
      return '';
    });
    const text = escapeHtml(content.trim()).replace(/@([a-zA-Z0-9_]{3,20})/g, (m, uname)=>{
      return `<span class="mention-link" data-mention="${escapeHtml(uname)}">@${escapeHtml(uname)}</span>`;
    });
    return (text ? `<span>${text}</span>` : '') + gif;
  }

  function postHTML(p, liked){
    const isLiked = liked.includes(p.id);
    const meta = p.users || {};
    const imgHtml = p.image_url ? `<img class="post-image" src="${p.image_url.replace(/"/g,'&quot;')}" alt="imagen" loading="lazy">` : '';
    return `
      <div class="social-post" data-post-id="${p.id}">
        <div class="social-post-head">
          <span class="social-post-user user-clickable" data-uid="${p.user_id}">${nameTagHTML(p.username, meta)}</span>
          <span class="social-post-time">${timeAgo(p.created_at)}</span>
        </div>
        <div class="social-post-body">${renderPostBody(p.content||'')}${imgHtml}</div>
        <div class="social-post-actions">
          <span class="social-like-btn${isLiked?' liked':''}" data-id="${p.id}">${isLiked ? '❤️' : '🤍'} <span class="like-count">${p.likes||0}</span></span>
          <span class="social-comment-toggle" data-id="${p.id}">💬 ${p.comment_count > 0 ? p.comment_count : 'Comentarios'}</span>
          <span class="social-report-btn" data-id="${p.id}">🚩 Reportar</span>
        </div>
        <div class="social-comments-box" id="comments-${p.id}"></div>
      </div>
    `;
  }

  async function loadSocialFeed(){
    if(!socialFeed) return;
    feedOffset = 0; feedDone = false; feedLoading = false;
    socialFeed.innerHTML = Array.from({length:3}).map(()=>`
      <div class="skeleton-post"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
    `).join('');
    try {
      const res = await fetch(`${POSTS_API}?select=id,user_id,username,content,created_at,likes,comment_count,image_url,users(gender,verified,staff,avatar_url)&order=created_at.desc&limit=${FEED_PAGE_SIZE}&offset=0`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ socialFeed.innerHTML = '<div class="social-feed-empty">Aún no hay publicaciones. ¡Sé el primero!</div>'; return; }
      const liked = getLikedPosts();
      socialFeed.innerHTML = rows.map(p => postHTML(p, liked)).join('');
      feedOffset = rows.length;
      if(rows.length < FEED_PAGE_SIZE) feedDone = true;
      setupFeedSentinel();
    } catch(e){
      socialFeed.innerHTML = '<div class="social-feed-empty">No se pudo cargar el muro.</div>';
    }
  }

  function setupFeedSentinel(){
    let sentinel = document.getElementById('feedSentinel');
    if(sentinel) sentinel.remove();
    if(feedDone) return;
    sentinel = document.createElement('div');
    sentinel.id = 'feedSentinel';
    sentinel.style.cssText = 'height:1px;';
    socialFeed.parentNode.insertBefore(sentinel, socialFeed.nextSibling);
    if(!feedSentinelObserver){
      feedSentinelObserver = new IntersectionObserver((entries)=>{
        if(entries[0].isIntersecting) loadMorePosts();
      }, { rootMargin: '300px' });
    }
    feedSentinelObserver.observe(sentinel);
  }

  async function loadMorePosts(){
    if(feedLoading || feedDone) return;
    feedLoading = true;
    const loader = document.createElement('div');
    loader.className = 'skeleton-post';
    loader.id = 'feedLoadingMore';
    loader.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div>';
    socialFeed.appendChild(loader);
    try {
      const res = await fetch(`${POSTS_API}?select=id,user_id,username,content,created_at,likes,comment_count,image_url,users(gender,verified,staff,avatar_url)&order=created_at.desc&limit=${FEED_PAGE_SIZE}&offset=${feedOffset}`, { headers: HDR });
      const rows = await res.json();
      document.getElementById('feedLoadingMore')?.remove();
      if(!rows || !rows.length){ feedDone = true; setupFeedSentinel(); feedLoading = false; return; }
      const liked = getLikedPosts();
      socialFeed.insertAdjacentHTML('beforeend', rows.map(p => postHTML(p, liked)).join(''));
      feedOffset += rows.length;
      if(rows.length < FEED_PAGE_SIZE) feedDone = true;
      setupFeedSentinel();
    } catch(e){
      document.getElementById('feedLoadingMore')?.remove();
    }
    feedLoading = false;
  }

  function getLikedPosts(){ try { return JSON.parse(localStorage.getItem('pragmata_liked_posts')) || []; } catch(e){ return []; } }
  function setLikedPosts(arr){ try { localStorage.setItem('pragmata_liked_posts', JSON.stringify(arr)); } catch(e){} }

  async function loadCommentsInto(box, id){
    box.dataset.loaded = '1';
    box.innerHTML = '<div class="skeleton-line"></div>';
    try {
      const res = await fetch(`${COMMENTS_API}?post_id=eq.${id}&select=username,content,created_at&order=created_at.asc&limit=100`, { headers: HDR });
      const rows = await res.json();
      const s = getSession();
      box.innerHTML = (rows && rows.length ? rows.map(c=>`<div class="social-comment-item"><b>${escapeHtml(c.username)}:</b> ${escapeHtml(c.content)}</div>`).join('') : '<div class="social-comment-item" style="color:var(--text-dim);">Sin comentarios todavía.</div>')
        + (s ? `<div class="social-comment-form"><input type="text" maxlength="200" placeholder="Escribe un comentario…" class="comment-input" data-post-id="${id}"><button class="comment-send-btn" data-post-id="${id}">Enviar</button></div>` : '');
    } catch(err){
      box.innerHTML = '<div class="social-comment-item">No se pudo cargar.</div>';
    }
  }

  document.addEventListener('click', async (e)=>{
    const likeBtn = e.target.closest('.social-like-btn');
    const commentToggle = e.target.closest('.social-comment-toggle');
    const mention = e.target.closest('.mention-link');
    const reportBtn = e.target.closest('.social-report-btn');

    if(mention){
      window.openProfileByUsername(mention.dataset.mention);
      return;
    }

    if(reportBtn){
      const s = getSession();
      if(!s){ modalOv.classList.add('open'); return; }
      const reason = prompt('¿Por qué reportas esta publicación? (opcional)') || '';
      try {
        await fetch(REPORTS_API, {
          method:'POST', headers:{...HDR,'Prefer':'return=minimal'},
          body: JSON.stringify({ post_id: parseInt(reportBtn.dataset.id,10), reporter_id: s.id, reporter_username: s.username, reason })
        });
        reportBtn.textContent = '✅ Reportado';
        reportBtn.style.pointerEvents = 'none';
      } catch(err){
        alert('No se pudo enviar el reporte.');
      }
      return;
    }

    if(likeBtn){
      const id = parseInt(likeBtn.dataset.id, 10);
      const liked = getLikedPosts();
      if(liked.includes(id)) return; // ya dado like en este navegador
      const countEl = likeBtn.querySelector('.like-count');
      const newCount = parseInt(countEl.textContent, 10) + 1;
      likeBtn.classList.add('liked');
      likeBtn.firstChild.textContent = '❤️ ';
      countEl.textContent = newCount;
      liked.push(id); setLikedPosts(liked);
      try {
        await fetch(`${POSTS_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ likes: newCount }) });
      } catch(err){}
      return;
    }

    if(commentToggle){
      const id = commentToggle.dataset.id;
      const box = document.getElementById(`comments-${id}`);
      if(!box) return;
      box.classList.toggle('open');
      if(box.classList.contains('open') && !box.dataset.loaded){
        await loadCommentsInto(box, id);
      }
      return;
    }

    const sendBtn = e.target.closest('.comment-send-btn');
    if(sendBtn){
      const pid = sendBtn.dataset.postId;
      const input = document.querySelector(`.comment-input[data-post-id="${pid}"]`);
      const s = getSession();
      const content = (input.value || '').trim();
      if(!s || !content) return;
      sendBtn.disabled = true;
      try {
        await fetch(COMMENTS_API, {
          method:'POST', headers:{...HDR,'Prefer':'return=minimal'},
          body: JSON.stringify({ post_id: pid, user_id: s.id, username: s.username, content })
        });
        // Notificar al autor del post
        const pRes = await fetch(`${POSTS_API}?id=eq.${pid}&select=user_id`,{headers:HDR});
        const pData = await pRes.json();
        if(pData && pData[0]) await sendNotification(pData[0].user_id, 'comment', s.username, parseInt(pid,10), content.slice(0,60));
        // Notificar menciones en el comentario
        await notifyMentions(content, parseInt(pid,10), 'mention_comment');
        // Actualizar contador
        await updateCommentCount(pid, 1);
        const box = document.getElementById(`comments-${pid}`);
        await loadCommentsInto(box, pid);
      } catch(err){
        alert('No se pudo enviar el comentario.');
      }
      sendBtn.disabled = false;
    }
  });

  socialInput && socialInput.addEventListener('input', ()=>{
    socialCount.textContent = `${socialInput.value.length}/280`;
  });

  // ── Stickers ──
  const STICKERS = ['🎮','⭐','🪙','💎','🎰','🃏','🎲','🕹️','👑','🔥','💀','🎉','😂','😎','🥳','🤑','😭','👀','💪','🙏','🤝','🫡','🎯','🍷','🎀','✨','🚀','🐉','⚔️','🛡️'];
  const stickerBtn = document.getElementById('stickerToggleBtn');
  const stickerPicker = document.getElementById('stickerPicker');
  if(stickerPicker){
    stickerPicker.innerHTML = STICKERS.map(s=>`<span data-stk="${s}">${s}</span>`).join('');
  }
  stickerBtn && stickerBtn.addEventListener('click', ()=>{
    stickerPicker.classList.toggle('open');
  });
  stickerPicker && stickerPicker.addEventListener('click', (e)=>{
    const el = e.target.closest('span[data-stk]');
    if(!el || !socialInput) return;
    socialInput.value += el.dataset.stk;
    socialCount.textContent = `${socialInput.value.length}/280`;
    socialInput.focus();
  });
  document.addEventListener('click', (e)=>{
    if(stickerPicker && stickerPicker.classList.contains('open') && !e.target.closest('.sticker-picker') && !e.target.closest('#stickerToggleBtn')){
      stickerPicker.classList.remove('open');
    }
  });

  // ── GIF ──
  let pendingGifUrl = '';
  let pendingPostImage = null;
  const gifAddBtn = document.getElementById('gifAddBtn');
  const gifPreview = document.getElementById('composerGifPreview');
  const imgPreview = document.getElementById('composerImgPreview');
  const postImageInput = document.getElementById('postImageInput');

  gifAddBtn && gifAddBtn.addEventListener('click', ()=>{
    const url = prompt('Pega el link directo de un GIF (Tenor, Giphy o .gif):');
    if(!url) return;
    const clean = url.trim();
    const valid = /^https:\/\/.+\.(gif|webp)(\?.*)?$/i.test(clean) || /tenor\.com|giphy\.com/i.test(clean);
    if(!valid){ alert('Ese link no parece un GIF válido. Usa un enlace directo (.gif) o de Tenor/Giphy.'); return; }
    pendingGifUrl = clean;
    gifPreview.style.display = 'inline-block';
    gifPreview.innerHTML = `<img src="${clean.replace(/"/g,'&quot;')}" alt="GIF"><button type="button" class="gif-remove" id="gifRemoveBtn">✕</button>`;
  });

  postImageInput && postImageInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 5*1024*1024){ alert('La imagen no debe superar 5 MB.'); postImageInput.value=''; return; }
    pendingPostImage = file;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      imgPreview.style.display = 'inline-block';
      imgPreview.innerHTML = `<img src="${ev.target.result}" alt="preview"><button type="button" class="img-remove" id="imgRemoveBtn">✕</button>`;
    };
    reader.readAsDataURL(file);
  });

  document.addEventListener('click', (e)=>{
    if(e.target.id === 'gifRemoveBtn'){ pendingGifUrl=''; gifPreview.style.display='none'; gifPreview.innerHTML=''; }
    if(e.target.id === 'imgRemoveBtn'){ pendingPostImage=null; imgPreview.style.display='none'; imgPreview.innerHTML=''; postImageInput.value=''; }
  });

  socialPostBtn && socialPostBtn.addEventListener('click', async ()=>{
    const s = getSession();
    if(!s) return;
    let content = (socialInput.value||'').trim();
    if(!content && !pendingGifUrl && !pendingPostImage){ return; }
    if(pendingGifUrl){ content = (content ? content + '\n' : '') + `[gif:${pendingGifUrl}]`; }
    socialPostBtn.disabled = true; socialPostBtn.textContent = 'Publicando…';
    try {
      let image_url = null;
      if(pendingPostImage){
        const ext = pendingPostImage.name.split('.').pop();
        const path = `${s.id}/${Date.now()}.${ext}`;
        image_url = await uploadToStorage('post-images', path, pendingPostImage);
      }
      const postRes = await fetch(POSTS_API, {
        method: 'POST', headers: { ...HDR, 'Prefer': 'return=representation' },
        body: JSON.stringify({ user_id: s.id, username: s.username, content, image_url })
      });
      const postData = await postRes.json();
      const newPostId = postData && postData[0] ? postData[0].id : null;
      socialInput.value = '';
      socialCount.textContent = '0/280';
      pendingGifUrl = ''; gifPreview.style.display = 'none'; gifPreview.innerHTML = '';
      pendingPostImage = null; imgPreview.style.display = 'none'; imgPreview.innerHTML = '';
      if(postImageInput) postImageInput.value = '';
      logActivity(s.id, s.username, 'post', content.slice(0,60));
      if(newPostId) await notifyMentions(content, newPostId, 'mention');
      loadSocialFeed();
    } catch(e){
      alert('No se pudo publicar: ' + e.message);
    }
    socialPostBtn.disabled = false; socialPostBtn.textContent = 'Publicar';
  });

  loadSocialFeed();

  // ── Admin: gestión de usuarios ──
  async function searchUsers(){
    const box = document.getElementById('admUserResults');
    const q = (document.getElementById('admUserSearch').value || '').trim();
    if(!box) return;
    box.innerHTML = 'Buscando…';
    try {
      const url = q
        ? `${USERS_API}?username=ilike.*${encodeURIComponent(q)}*&select=id,username,coins,banned,verified,staff&order=coins.desc&limit=20`
        : `${USERS_API}?select=id,username,coins,banned,verified,staff&order=coins.desc&limit=20`;
      const res = await fetch(url, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ box.innerHTML = '<div class="adm-redeem-empty">Sin resultados.</div>'; return; }
      box.innerHTML = rows.map(u => `
        <div class="adm-user-row" data-id="${u.id}">
          <div class="adm-user-info"><b>${escapeHtml(u.username)}</b>${verifiedBadge(u.verified)}${staffBadge(u.staff)} · 🪙 ${fmtN(u.coins)} ${u.banned ? '<span class="banned-tag">SUSPENDIDO</span>' : ''}</div>
          <div class="adm-user-btns">
            <button class="adm-btn ${u.banned?'':'danger'} adm-user-ban">${u.banned ? '✅ Reactivar' : '🚫 Suspender'}</button>
            <button class="adm-btn adm-user-resetpin">🔐 Resetear PIN</button>
            <button class="adm-btn adm-user-verify">${u.verified ? '✖ Quitar ✔' : '✔ Verificar'}</button>
            <button class="adm-btn adm-user-staff">${u.staff ? '✖ Quitar Staff' : '🍷 Hacer Staff'}</button>
          </div>
        </div>
      `).join('');
    } catch(e){
      box.innerHTML = '<div class="adm-redeem-empty">Error al buscar.</div>';
    }
  }
  document.getElementById('admUserSearchBtn')?.addEventListener('click', searchUsers);
  document.getElementById('admUserSearch')?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') searchUsers(); });

  document.addEventListener('click', async (e)=>{
    const banBtn = e.target.closest('.adm-user-ban');
    const pinBtn = e.target.closest('.adm-user-resetpin');
    const verifyBtn = e.target.closest('.adm-user-verify');
    const staffBtn = e.target.closest('.adm-user-staff');
    if(!banBtn && !pinBtn && !verifyBtn && !staffBtn) return;
    const row = e.target.closest('.adm-user-row');
    const id = row.dataset.id;

    if(banBtn){
      const isCurrentlyBanned = banBtn.textContent.includes('Reactivar');
      await fetch(`${USERS_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ banned: !isCurrentlyBanned }) });
      searchUsers();
      return;
    }
    if(pinBtn){
      const newPin = String(Math.floor(100000 + Math.random()*900000));
      const hash = await sha256(newPin);
      await fetch(`${USERS_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ pin_hash: hash }) });
      alert(`Nuevo PIN generado: ${newPin}\nCompártelo con el usuario de forma segura.`);
      return;
    }
    if(verifyBtn){
      const isVerified = verifyBtn.textContent.includes('Quitar');
      await fetch(`${USERS_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ verified: !isVerified }) });
      searchUsers();
      return;
    }
    if(staffBtn){
      const isStaff = staffBtn.textContent.includes('Quitar');
      await fetch(`${USERS_API}?id=eq.${id}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ staff: !isStaff }) });
      searchUsers();
      return;
    }
  });

  // ── Admin: reportes de publicaciones ──
  async function refreshReports(){
    const box = document.getElementById('admReportsList');
    if(!box) return;
    box.innerHTML = 'Cargando…';
    try {
      const res = await fetch(`${REPORTS_API}?select=id,post_id,reporter_username,reason,created_at,social_posts(content,username)&order=created_at.desc&limit=30`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ box.innerHTML = '<div class="adm-redeem-empty">Sin reportes pendientes.</div>'; return; }
      box.innerHTML = rows.map(r => `
        <div class="adm-redeem-row" data-report-id="${r.id}" data-post-id="${r.post_id}">
          <div class="adm-redeem-info">
            <b>${escapeHtml(r.reporter_username||'—')}</b> reportó a <b>${escapeHtml((r.social_posts && r.social_posts.username) || '—')}</b>
            <span class="adm-redeem-code">${escapeHtml((r.social_posts && r.social_posts.content) || '(post eliminado)')}</span>
            ${r.reason ? `<span style="display:block; color:var(--text-dim); margin-top:3px;">Motivo: ${escapeHtml(r.reason)}</span>` : ''}
          </div>
          <div class="adm-redeem-btns">
            <button class="adm-btn danger adm-report-delete">🗑️ Eliminar post</button>
            <button class="adm-btn adm-report-dismiss">✓ Descartar</button>
          </div>
        </div>
      `).join('');
    } catch(e){
      box.innerHTML = '<div class="adm-redeem-empty">Error al cargar reportes.</div>';
    }
  }
  window.refreshReports = refreshReports;
  document.getElementById('admReportsRefresh')?.addEventListener('click', refreshReports);

  document.addEventListener('click', async (e)=>{
    const delBtn = e.target.closest('.adm-report-delete');
    const dismissBtn = e.target.closest('.adm-report-dismiss');
    if(!delBtn && !dismissBtn) return;
    const row = e.target.closest('.adm-redeem-row');
    const reportId = row.dataset.reportId;
    const postId = row.dataset.postId;
    if(delBtn){
      if(!confirm('¿Eliminar esta publicación permanentemente?')) return;
      await fetch(`${POSTS_API}?id=eq.${postId}`, { method:'DELETE', headers: HDR });
      await fetch(`${REPORTS_API}?id=eq.${reportId}`, { method:'DELETE', headers: HDR });
      refreshReports();
      return;
    }
    if(dismissBtn){
      await fetch(`${REPORTS_API}?id=eq.${reportId}`, { method:'DELETE', headers: HDR });
      refreshReports();
    }
  });

  // ── Admin: log de actividad ──
  async function refreshActivityLog(){
    const box = document.getElementById('admActivityLog');
    if(!box) return;
    box.innerHTML = 'Cargando…';
    try {
      const res = await fetch(`${LOGS_API}?select=username,action,detail,created_at&order=created_at.desc&limit=60`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length){ box.innerHTML = '<div class="adm-redeem-empty">Sin actividad registrada.</div>'; return; }
      box.innerHTML = rows.map(r => `
        <div class="adm-log-row"><span class="adm-log-time">${timeAgo(r.created_at)}</span> <b>${escapeHtml(r.username||'—')}</b> — ${escapeHtml(r.action)}${r.detail ? `: ${escapeHtml(r.detail)}` : ''}</div>
      `).join('');
    } catch(e){
      box.innerHTML = '<div class="adm-redeem-empty">Error al cargar el log.</div>';
    }
  }
  window.refreshActivityLog = refreshActivityLog;
  document.getElementById('admActivityRefresh')?.addEventListener('click', refreshActivityLog);

  // ── Sistema de amigos ──
  async function getFriendStatus(targetId){
    const s = getSession();
    if(!s || s.id === targetId) return null;
    try {
      const res = await fetch(`${FRIENDS_API}?or=(and(requester_id.eq.${s.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${s.id}))&select=id,requester_id,status`, { headers: HDR });
      const rows = await res.json();
      if(!rows || !rows.length) return { status: 'none' };
      const f = rows[0];
      return { id: f.id, status: f.status, iRequested: f.requester_id === s.id };
    } catch(e){ return null; }
  }

  async function renderFriendBtn(container, targetId, targetUsername){
    const s = getSession();
    if(!s || s.id === targetId){ container.innerHTML=''; return; }
    const f = await getFriendStatus(targetId);
    if(!f){ container.innerHTML=''; return; }
    let html = '';
    if(f.status === 'none'){
      html = `<button class="friend-btn" data-action="add" data-tid="${targetId}" data-tname="${escapeHtml(targetUsername)}">➕ Agregar amigo</button>`;
    } else if(f.status === 'pending' && f.iRequested){
      html = `<button class="friend-btn sent" disabled>⏳ Solicitud enviada</button>`;
    } else if(f.status === 'pending' && !f.iRequested){
      html = `<button class="friend-btn accept" data-action="accept" data-fid="${f.id}">✅ Aceptar solicitud</button>
              <button class="friend-btn" style="border-color:var(--red);color:var(--red);" data-action="reject" data-fid="${f.id}">✕ Rechazar</button>`;
    } else if(f.status === 'accepted'){
      html = `<button class="friend-btn friends" disabled>👥 Amigos</button>`;
    }
    container.innerHTML = html;
  }

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const s = getSession();
    if(!s){ modalOv.classList.add('open'); return; }
    const action = btn.dataset.action;

    if(action === 'add'){
      const tid = btn.dataset.tid;
      const tname = btn.dataset.tname;
      btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        await fetch(FRIENDS_API, { method:'POST', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ requester_id: s.id, addressee_id: tid }) });
        // Notificar al destinatario
        await sendNotification(tid, 'friend_request', s.username, null, '');
        btn.textContent = '⏳ Solicitud enviada'; btn.classList.add('sent'); btn.disabled = true;
      } catch(e){ btn.disabled=false; btn.textContent='➕ Agregar amigo'; }
      return;
    }
    if(action === 'accept'){
      const fid = btn.dataset.fid;
      await fetch(`${FRIENDS_API}?id=eq.${fid}`, { method:'PATCH', headers:{...HDR,'Prefer':'return=minimal'}, body: JSON.stringify({ status:'accepted' }) });
      btn.closest('.profile-friend-btn-wrap') ? btn.closest('.profile-friend-btn-wrap').innerHTML = '<button class="friend-btn friends" disabled>👥 Amigos</button>' : btn.textContent='👥 Amigos';
      return;
    }
    if(action === 'reject'){
      const fid = btn.dataset.fid;
      await fetch(`${FRIENDS_API}?id=eq.${fid}`, { method:'DELETE', headers: HDR });
      btn.closest('.profile-friend-btn-wrap') ? btn.closest('.profile-friend-btn-wrap').innerHTML = '<button class="friend-btn" data-action="add">➕ Agregar amigo</button>' : null;
      return;
    }
  });

  // Solicitudes de amistad pendientes en el panel de notificaciones
  async function loadFriendRequests(){
    const s = getSession();
    if(!s) return;
    try {
      const res = await fetch(`${FRIENDS_API}?addressee_id=eq.${s.id}&status=eq.pending&select=id,requester_id,users!friendships_requester_id_fkey(username,avatar_url)`, { headers: HDR });
      const rows = await res.json();
      const panel = document.getElementById('friendReqPanel');
      if(!panel) return;
      if(!rows || !rows.length){ panel.innerHTML = '<div class="notif-empty">Sin solicitudes pendientes.</div>'; return; }
      panel.innerHTML = rows.map(r=>{
        const u = r.users || {};
        return `<div class="friend-req-item">
          ${avatarHTML(u.username||'?', '', u.avatar_url)}
          <b>${escapeHtml(u.username||'—')}</b> quiere ser tu amigo
          <div class="friend-req-btns">
            <button class="adm-btn" data-action="accept" data-fid="${r.id}">✅</button>
            <button class="adm-btn danger" data-action="reject" data-fid="${r.id}">✕</button>
          </div>
        </div>`;
      }).join('');
    } catch(e){}
  }

  // ── Scroll reveal ──
  if('IntersectionObserver' in window){
    const revealObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
  }

  renderAccountBar();
  syncComposer();
})();

/* --- bloque --- */
(function(){
  const form = document.getElementById('subbotConnectForm');
  const phoneInput = document.getElementById('subbotPhone');
  const submitBtn = document.getElementById('subbotSubmitBtn');
  const resultBox = document.getElementById('subbotResult');
  const codeEl = document.getElementById('subbotCode');
  const copyBtn = document.getElementById('subbotCopy');
  const timerEl = document.getElementById('subbotTimer');
  const hintEl = document.getElementById('subbotHint');
  if(!form) return;

  let countdownInterval = null;

  function startCountdown(seconds){
    clearInterval(countdownInterval);
    let remaining = seconds;
    timerEl.classList.remove('expired');
    timerEl.textContent = `⏱️ Expira en ${remaining}s`;
    countdownInterval = setInterval(()=>{
      remaining--;
      if(remaining <= 0){
        clearInterval(countdownInterval);
        timerEl.classList.add('expired');
        timerEl.textContent = '✗ Código expirado — pide uno nuevo';
        return;
      }
      timerEl.textContent = `⏱️ Expira en ${remaining}s`;
    }, 1000);
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const raw = phoneInput.value.trim().replace(/[^0-9]/g, '');
    if(raw.length < 8){
      phoneInput.style.borderColor = 'var(--red)';
      phoneInput.focus();
      return;
    }
    phoneInput.style.borderColor = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Generando código...';
    resultBox.style.display = 'none';
    hintEl.textContent = 'Esto puede tardar hasta 20 segundos, no cierres esta pestaña.';

    try{
      const res = await fetch('/api/subbot/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: raw }),
      });
      const data = await res.json();

      if(!res.ok || !data.ok){
        hintEl.textContent = '✗ ' + (data.error || 'No se pudo generar el código. Intenta de nuevo.');
        return;
      }

      codeEl.textContent = data.code;
      resultBox.style.display = 'block';
      hintEl.textContent = 'Sigue los pasos de abajo antes de que expire.';
      startCountdown(60);
    }catch(err){
      hintEl.textContent = '✗ No se pudo conectar con el bot. Intenta de nuevo en un momento.';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = '🔑 OBTENER CÓDIGO';
    }
  });

  copyBtn?.addEventListener('click', ()=>{
    navigator.clipboard?.writeText(codeEl.textContent.trim());
    copyBtn.textContent = '✓ Copiado';
    setTimeout(()=>{ copyBtn.textContent = '📋 Copiar código'; }, 1500);
  });
})();

/* --- bloque --- */
(function(){
  // ── Modal de Perfil, conectado a Supabase Auth real ──
  const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const AUTH_API = SUPABASE_URL + '/auth/v1';

  const overlay = document.getElementById('profileOverlay');
  const openLink = document.getElementById('sidebarProfileLink');
  const closeBtn = document.getElementById('profileClose');
  const cancelBtn = document.getElementById('profileCancel');
  const saveBtn = document.getElementById('profileSave');
  const logoutBtn = document.getElementById('profileLogout');
  const changePassBtn = document.getElementById('profileChangePass');

  const greeting = document.getElementById('profileGreeting');
  const emailEl = document.getElementById('profileEmail');
  const avatarBig = document.getElementById('profileAvatarBig');
  const nameInput = document.getElementById('profileName');
  const userInput = document.getElementById('profileUsername');
  const bioInput = document.getElementById('profileBio');
  const bioCount = document.getElementById('bioCount');
  const statusEl = document.getElementById('profileStatus');
  const newPassInput = document.getElementById('profileNewPass');
  const passStatusEl = document.getElementById('profilePassStatus');

  function getSess(){
    try{ return JSON.parse(localStorage.getItem('pragmata_session')); }catch(e){ return null; }
  }

  bioInput?.addEventListener('input', ()=>{ bioCount.textContent = bioInput.value.length; });

  function fillFromUser(user){
    const meta = user.user_metadata || {};
    emailEl.textContent = user.email || '';
    nameInput.value = meta.full_name || '';
    userInput.value = meta.username || '';
    bioInput.value = meta.bio || '';
    bioCount.textContent = bioInput.value.length;
    greeting.textContent = 'Hola, ' + (meta.full_name || user.email?.split('@')[0] || 'Usuario');
    avatarBig.textContent = (meta.full_name || user.email || '?').trim().charAt(0).toUpperCase();
  }

  async function loadProfile(){
    const sess = getSess();
    if(!sess?.access_token) return;
    try{
      const res = await fetch(AUTH_API + '/user', {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + sess.access_token },
      });
      if(res.ok){
        const user = await res.json();
        fillFromUser(user);
      }
    }catch(e){}
  }

  openLink?.addEventListener('click', (e)=>{
    e.preventDefault();
    const sess = getSess();
    if(!sess?.access_token){
      document.getElementById('authGate')?.classList.remove('hide');
      document.body.style.overflow = 'hidden';
      return;
    }
    loadProfile();
    overlay.classList.add('open');
  });

  function closeProfile(){ overlay.classList.remove('open'); }
  closeBtn?.addEventListener('click', closeProfile);
  cancelBtn?.addEventListener('click', closeProfile);
  overlay?.addEventListener('click', (e)=>{ if(e.target === overlay) closeProfile(); });

  saveBtn?.addEventListener('click', async ()=>{
    const sess = getSess();
    if(!sess?.access_token) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    statusEl.textContent = '';
    try{
      const res = await fetch(AUTH_API + '/user', {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            full_name: nameInput.value.trim(),
            username: userInput.value.trim(),
            bio: bioInput.value.trim(),
          },
        }),
      });
      if(res.ok){
        const user = await res.json();
        fillFromUser(user);
        statusEl.className = 'profile-status ok';
        statusEl.textContent = '✓ Perfil actualizado';
      } else {
        statusEl.className = 'profile-status err';
        statusEl.textContent = '✗ No se pudo guardar, intenta de nuevo';
      }
    }catch(e){
      statusEl.className = 'profile-status err';
      statusEl.textContent = '✗ Error de conexión';
    }finally{
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar cambios';
    }
  });

  changePassBtn?.addEventListener('click', async ()=>{
    const sess = getSess();
    if(!sess?.access_token) return;
    const newPass = newPassInput.value;
    if(newPass.length < 6){
      passStatusEl.className = 'profile-status err';
      passStatusEl.textContent = '✗ Mínimo 6 caracteres';
      return;
    }
    changePassBtn.disabled = true;
    changePassBtn.textContent = 'Actualizando...';
    try{
      const res = await fetch(AUTH_API + '/user', {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPass }),
      });
      if(res.ok){
        passStatusEl.className = 'profile-status ok';
        passStatusEl.textContent = '✓ Contraseña actualizada';
        newPassInput.value = '';
      } else {
        passStatusEl.className = 'profile-status err';
        passStatusEl.textContent = '✗ No se pudo actualizar';
      }
    }catch(e){
      passStatusEl.className = 'profile-status err';
      passStatusEl.textContent = '✗ Error de conexión';
    }finally{
      changePassBtn.disabled = false;
      changePassBtn.textContent = 'Actualizar contraseña';
    }
  });

  logoutBtn?.addEventListener('click', ()=>{
    localStorage.removeItem('pragmata_session');
    closeProfile();
    location.reload();
  });
})();

/* --- bloque --- */
// ── Tienda streaming: carrusel, filtros, búsqueda y countdown ──
(function(){
  const recTrack = document.getElementById('streamRecommendTrack');
  const recLeft = document.getElementById('streamRecLeft');
  const recRight = document.getElementById('streamRecRight');
  if(recTrack && recLeft && recRight){
    const scrollCards = (dir) => {
      const card = recTrack.querySelector('.stream-card');
      const amount = card ? card.offsetWidth + 18 : 280;
      recTrack.scrollBy({ left: dir * amount, behavior: 'smooth' });
    };
    recLeft.addEventListener('click', () => scrollCards(-1));
    recRight.addEventListener('click', () => scrollCards(1));
  }

  const grid = document.getElementById('streamProductGrid');
  if(!grid) return;

  const cards = Array.from(grid.querySelectorAll('.stream-grid-card'));
  const tabs = Array.from(document.querySelectorAll('.stream-tab'));
  const chips = Array.from(document.querySelectorAll('.stream-chip'));
  const search = document.getElementById('streamSearch');
  const noResults = document.getElementById('streamNoResults');
  const loadMore = document.getElementById('streamLoadMore');

  let activeTab = 'all';
  let activeCategory = 'all';
  let extrasRevealed = false;

  function matchesFilters(card){
    const category = card.dataset.category || '';
    const tabData = card.dataset.tab || '';
    const searchData = (card.dataset.search || '').toLowerCase();
    const query = (search?.value || '').trim().toLowerCase();

    const matchCategory = activeCategory === 'all' || category === activeCategory;
    const matchTab = activeTab === 'all' || tabData.includes(activeTab);
    const matchSearch = !query || searchData.includes(query) || card.textContent.toLowerCase().includes(query);

    return matchCategory && matchTab && matchSearch;
  }

  function applyFilters(){
    let visible = 0;

    cards.forEach(card => {
      const isExtra = card.classList.contains('is-extra');
      const matches = matchesFilters(card);
      const canShowExtra = !isExtra || extrasRevealed;
      const show = matches && canShowExtra;
      card.classList.toggle('is-filtered-out', !show);
      if(show) visible++;
    });

    if(noResults) noResults.style.display = visible ? 'none' : 'block';

    if(loadMore){
      const hiddenExtras = cards.some(card => card.classList.contains('is-extra') && matchesFilters(card) && !extrasRevealed);
      loadMore.hidden = !hiddenExtras;
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab || 'all';
      applyFilters();
    });
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(item => item.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category || 'all';
      applyFilters();
    });
  });

  search?.addEventListener('input', applyFilters);

  loadMore?.addEventListener('click', () => {
    extrasRevealed = true;
    cards.filter(card => card.classList.contains('is-extra')).forEach(card => card.classList.add('revealed'));
    applyFilters();
  });

  applyFilters();
})();

/* --- bloque --- */
// ── Countdown para oferta destacada ──
(function(){
  const countdown = document.getElementById('streamCountdown');
  if(!countdown) return;

  const end = new Date(Date.now() + ((2 * 24 + 5) * 60 + 30) * 60 * 1000);

  function render(){
    const diff = end.getTime() - Date.now();
    if(diff <= 0){
      countdown.textContent = '00 : 00 : 00';
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [hours, minutes, seconds].map(v => String(v).padStart(2, '0'));
    countdown.textContent = parts.join(' : ');
  }

  render();
  setInterval(render, 1000);
})();
