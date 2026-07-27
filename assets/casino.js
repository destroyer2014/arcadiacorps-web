// ════════════════════════════════════════════
// CASINO — Pragmata Bot
// ════════════════════════════════════════════
(function(){
  // ── Attempts system — Supabase (global, reset por admin) ──
  const MAX_ATTEMPTS = 3;
  const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const CA_API = SUPABASE_URL + '/rest/v1/casino_attempts';
  const CA_HDR = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // ID único por navegador (persistente)
  function getUserId(){
    try {
      let id = localStorage.getItem('pragmata_uid');
      if(!id){ id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pragmata_uid', id); }
      return id;
    } catch(e){ return 'u_anon'; }
  }

  function getTodayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // Cache en memoria para no esperar fetch en cada acción
  let _cache = null; // { count, day }

  async function fetchRow(){
    try {
      const uid = getUserId();
      const res = await fetch(`${CA_API}?id=eq.${uid}&select=count,day`, { headers: CA_HDR });
      const data = await res.json();
      if(data && data[0]){
        const row = data[0];
        // Si es otro día, resetear
        if(row.day !== getTodayKey()){
          await upsertRow(MAX_ATTEMPTS, getTodayKey());
          _cache = { count: MAX_ATTEMPTS, day: getTodayKey() };
        } else {
          _cache = { count: row.count, day: row.day };
        }
      } else {
        // Primera vez — crear fila
        await upsertRow(MAX_ATTEMPTS, getTodayKey());
        _cache = { count: MAX_ATTEMPTS, day: getTodayKey() };
      }
    } catch(e){
      if(!_cache) _cache = { count: MAX_ATTEMPTS, day: getTodayKey() };
    }
    return _cache;
  }

  async function upsertRow(count, day){
    try {
      const uid = getUserId();
      await fetch(CA_API, {
        method: 'POST',
        headers: { ...CA_HDR, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: uid, count, day })
      });
    } catch(e){}
  }

  function getAttempts(){ return _cache ? _cache.count : MAX_ATTEMPTS; }

  async function useAttempt(){
    await fetchRow();
    if(_cache.count <= 0) return false;
    _cache.count--;
    await upsertRow(_cache.count, _cache.day);
    updateHUD();
    if(window.recordCoinsPlay) window.recordCoinsPlay();
    return true;
  }

  async function addAttempt(){
    await fetchRow();
    _cache.count = Math.min(_cache.count + 1, MAX_ATTEMPTS + 2);
    await upsertRow(_cache.count, _cache.day);
    updateHUD();
  }

  async function addAttempts(n){
    await fetchRow();
    _cache.count = Math.min(_cache.count + n, MAX_ATTEMPTS + 3);
    await upsertRow(_cache.count, _cache.day);
    updateHUD();
  }

  // Inicializar: cargar intentos del servidor
  fetchRow().then(()=> updateHUD());

  function updateHUD(){
    const left = getAttempts();
    const hearts = document.getElementById('casinoHearts');
    const info = document.getElementById('casinoResetInfo');
    if(!hearts) return;
    let h = '';
    for(let i=0;i<MAX_ATTEMPTS;i++) h += (i < left) ? '❤️ ' : '🖤 ';
    hearts.textContent = h.trim();
    info.textContent = left > 0
      ? `${left} intento${left>1?'s':''} disponible${left>1?'s':''} hoy`
      : '⏳ Sin intentos — vuelve mañana';
    // disable/enable all play buttons
    document.querySelectorAll('.btn-play').forEach(btn=>{
      if(btn.id === 'bjHitBtn' || btn.id === 'bjStandBtn') return;
      if(['rouletteBtn','coinflipBtn','hldBtn','hlcBtn'].includes(btn.id)){
        // Estos requieren que el usuario elija una apuesta primero
        if(left <= 0) btn.disabled = true;
        return;
      }
      btn.disabled = (left <= 0);
    });
    // show no-attempts notices for inactive games
    document.querySelectorAll('.no-attempts-notice').forEach(n=>{
      n.style.display = (left <= 0) ? 'block' : 'none';
    });
  }

  // ── Prize claim CTA builder ──
  function buildClaimCTA(prize){
    const msg = encodeURIComponent(`¡Hola! Gané en el Casino de la página de Pragmata Bot 🎰\nPremio: ${prize}\n(adjunto mi captura de pantalla)`);
    return `<a class="claim-cta" href="https://wa.me/51917611323?text=${msg}" target="_blank" rel="noopener">📲 RECLAMAR CON UN OWNER</a>`;
  }

  // ── Random prize helpers (10 – 10,000) ──
  function randGold(){
    // Weighted: la mayoría 10-500, tope máximo 5,000
    const tier = Math.random();
    if(tier < 0.60) return Math.floor(Math.random()*490)+10;       // 10-499   (60%)
    if(tier < 0.85) return Math.floor(Math.random()*500)+500;      // 500-999  (25%)
    if(tier < 0.97) return Math.floor(Math.random()*2000)+1000;    // 1000-2999 (12%)
    return Math.floor(Math.random()*2001)+3000;                     // 3000-5000 (3%)
  }
  function randGems(){
    const tier = Math.random();
    if(tier < 0.55) return Math.floor(Math.random()*490)+10;
    if(tier < 0.82) return Math.floor(Math.random()*500)+500;
    if(tier < 0.96) return Math.floor(Math.random()*2000)+1000;
    return Math.floor(Math.random()*2001)+3000;
  }
  function randMegaGems(){
    // Jackpot: tope del pozo, 3,000 - 5,000
    return Math.floor(Math.random()*2001)+3000;
  }
  function fmtN(n){ return n.toLocaleString('es-PE'); }

  // ── Sound helpers ──
  function playWin(){ window.playFlagSound && window.playFlagSound(); }
  function playLose(){ window.playClickSound && window.playClickSound(); }
  function playCoin(){ window.playCoinSound && window.playCoinSound(); }

  // coin rain
  function rainCoins(n){
    for(let i=0;i<(n||16);i++){
      const coin = document.createElement('div');
      const size = 14 + Math.random()*8;
      coin.style.cssText = `position:fixed;top:-30px;left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:#ffd23f;border:2px solid #b8860b;border-radius:50%;z-index:99998;pointer-events:none;transition:top ${1+Math.random()}s linear,transform 1s linear`;
      document.body.appendChild(coin);
      requestAnimationFrame(()=>{ coin.style.top='110vh'; coin.style.transform=`rotate(${720}deg)`; });
      setTimeout(()=>coin.remove(), 2200);
    }
  }

  function showResult(bannerId, titleId, prizeId, bodyId, type, title, prize, body, hasCTA){
    const banner = document.getElementById(bannerId);
    const tEl = document.getElementById(titleId);
    const pEl = document.getElementById(prizeId);
    const bEl = document.getElementById(bodyId);
    if(!banner) return;
    banner.className = `result-banner ${type}`;
    tEl.textContent = title;
    pEl.textContent = prize;
    bEl.innerHTML = body + (hasCTA ? '<br><br>' + buildClaimCTA(prize) : '');
    banner.style.display = 'block';
    if(type === 'win' && window.recordPrizeWin) window.recordPrizeWin(prize);
    if((type === 'win' || type === 'bonus') && window.recordCoinsWin) window.recordCoinsWin();
  }

  // ════════════════════
  // 1. TRAGAMONEDAS
  // ════════════════════
  const REEL_SYMBOLS = ['7️⃣','💎','⭐','🍀','🍋','🔔','🍒','❌'];
  const SLOT_PRIZES = {
    '7️⃣': { label: ()=>`🏆 JACKPOT — ${fmtN(randMegaGems())} MEGA GEMAS`, type: 'win', cta: true, fn: null },
    '💎': { label: ()=>`💎 ${fmtN(randGems())} GEMAS`, type: 'win', cta: true, fn: null },
    '⭐': { label: ()=>'⭐ 1 SEMANA PREMIUM', type: 'win', cta: true, fn: null },
    '🍀': { label: ()=>'🍀 +1 INTENTO EXTRA', type: 'bonus', cta: false, fn: ()=>addAttempt() },
    '🍋': { label: ()=>`🍋 ${fmtN(randGold())} ORO`, type: 'win', cta: true, fn: null },
    '🔔': { label: ()=>`🔔 ${fmtN(randGold())} ORO`, type: 'win', cta: true, fn: null },
    '🍒': { label: ()=>`🍒 ${fmtN(randGold())} ORO`, type: 'win', cta: true, fn: null },
  };

  // Weighted random for slots (jackpot super rare)
  function spinReel(){
    const weights = [1,4,2,8,12,15,15,22]; // 7,💎,⭐,🍀,🍋,🔔,🍒,❌ (⭐ semanal: dificultad aumentada)
    const total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*total;
    for(let i=0;i<weights.length;i++){ r-=weights[i]; if(r<=0) return REEL_SYMBOLS[i]; }
    return REEL_SYMBOLS[REEL_SYMBOLS.length-1];
  }

  const reels = [document.getElementById('reel0'),document.getElementById('reel1'),document.getElementById('reel2')];
  const slotsBtn = document.getElementById('slotsBtn');

  if(slotsBtn){
    slotsBtn.addEventListener('click', ()=>{
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('slotsResult').style.display = 'none';
      slotsBtn.disabled = true;

      // Animate reels
      reels.forEach(r=>{ r.classList.add('spinning'); r.querySelector('.reel-inner span').textContent = REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)]; });

      const results = [];
      reels.forEach((r, i)=>{
        setTimeout(()=>{
          r.classList.remove('spinning');
          const sym = spinReel();
          results.push(sym);
          r.querySelector('.reel-inner span').textContent = sym;
          playCoin();

          if(i===2){
            setTimeout(()=>{
              slotsBtn.disabled = getAttempts()<=0;
              evaluateSlots(results);
            }, 200);
          }
        }, 500 + i*400);
      });
    });
  }

  function evaluateSlots(results){
    const [a,b,c] = results;
    if(a===b && b===c){
      const prizeDef = SLOT_PRIZES[a];
      if(prizeDef){
        if(prizeDef.fn) prizeDef.fn();
        const lbl = prizeDef.label();
        const isBonus = prizeDef.type === 'bonus';
        playWin(); if(!isBonus) rainCoins(24);
        showResult('slotsResult','slotsResTitle','slotsResPrize','slotsResBody',
          isBonus?'bonus':'win',
          isBonus ? '🍀 ¡BONUS!' : '🎉 ¡GANASTE!',
          lbl,
          isBonus ? 'Se añadió 1 intento extra a tus turnos de hoy.' : 'Toma una captura y reclama tu premio con un Owner.',
          prizeDef.cta
        );
      }
    } else {
      playLose();
      showResult('slotsResult','slotsResTitle','slotsResPrize','slotsResBody','lose','😔 SIN SUERTE','Ningún premio','Prueba de nuevo mañana.',false);
    }
  }

  // ════════════════════
  // 2. BLACKJACK
  // ════════════════════
  const SUITS = ['♠','♥','♦','♣'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const RED_SUITS = ['♥','♦'];

  let bjDeck=[], bjPlayer=[], bjDealer=[], bjActive=false;

  function makeDeck(){
    const d=[];
    SUITS.forEach(s=>RANKS.forEach(r=>d.push({r,s})));
    // shuffle
    for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }
  function cardValue(card){
    if(['J','Q','K'].includes(card.r)) return 10;
    if(card.r==='A') return 11;
    return parseInt(card.r);
  }
  function handValue(hand){
    let total=0, aces=0;
    hand.forEach(c=>{ total+=cardValue(c); if(c.r==='A') aces++; });
    while(total>21 && aces>0){ total-=10; aces--; }
    return total;
  }
  function renderCard(card, hidden){
    if(hidden) return `<div class="bj-card back"></div>`;
    const isRed = RED_SUITS.includes(card.s);
    return `<div class="bj-card${isRed?' red':''}">${card.r}${card.s}</div>`;
  }
  function renderHands(hideDealer){
    const dc = document.getElementById('dealerCards');
    const pc = document.getElementById('playerCards');
    const ds = document.getElementById('dealerScore');
    const ps = document.getElementById('playerScore');
    if(!dc) return;
    dc.innerHTML = bjDealer.map((c,i)=>renderCard(c, hideDealer && i===1)).join('');
    pc.innerHTML = bjPlayer.map(c=>renderCard(c,false)).join('');
    ps.textContent = `(${handValue(bjPlayer)})`;
    ds.textContent = hideDealer ? '' : `(${handValue(bjDealer)})`;
  }

  const bjDealBtn = document.getElementById('bjDealBtn');
  const bjHitBtn = document.getElementById('bjHitBtn');
  const bjStandBtn = document.getElementById('bjStandBtn');

  if(bjDealBtn){
    bjDealBtn.addEventListener('click',()=>{
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('bjResult').style.display='none';
      bjDeck = makeDeck();
      bjPlayer=[bjDeck.pop(),bjDeck.pop()];
      bjDealer=[bjDeck.pop(),bjDeck.pop()];
      bjActive=true;
      renderHands(true);
      bjDealBtn.disabled=true;
      bjHitBtn.disabled=false;
      bjStandBtn.disabled=false;
      // Check natural blackjack
      if(handValue(bjPlayer)===21){
        bjActive=false;
        bjHitBtn.disabled=true; bjStandBtn.disabled=true;
        renderHands(false);
        bjEndGame('blackjack');
      }
    });
    bjHitBtn.addEventListener('click',()=>{
      if(!bjActive) return;
      bjPlayer.push(bjDeck.pop());
      renderHands(true);
      if(handValue(bjPlayer)>21){ bjActive=false; bjHitBtn.disabled=true; bjStandBtn.disabled=true; renderHands(false); bjEndGame('bust'); }
    });
    bjStandBtn.addEventListener('click',()=>{
      if(!bjActive) return;
      bjActive=false; bjHitBtn.disabled=true; bjStandBtn.disabled=true;
      // dealer draws to 17
      while(handValue(bjDealer)<17) bjDealer.push(bjDeck.pop());
      renderHands(false);
      const p=handValue(bjPlayer), d=handValue(bjDealer);
      if(d>21 || p>d) bjEndGame('win');
      else if(p===d) bjEndGame('push');
      else bjEndGame('lose');
    });
  }

  function bjEndGame(outcome){
    bjDealBtn.disabled = getAttempts()<=0;
    const pv=handValue(bjPlayer);
    if(outcome==='blackjack'){
      const g=Math.floor(Math.random()*1500)+1000; // 1000-2499 mega gemas
      playWin(); rainCoins(30);
      showResult('bjResult','bjResTitle','bjResPrize','bjResBody','win','🃏 ¡BLACKJACK NATURAL!',`💎 ${fmtN(g)} MEGA GEMAS`,'Blackjack perfecto. Toma una captura y reclama.',true);
    } else if(outcome==='win' && pv===20){
      const g=randGems();
      playWin(); rainCoins(20);
      showResult('bjResult','bjResTitle','bjResPrize','bjResBody','win','🎉 ¡GANASTE CON 20!',`💎 ${fmtN(g)} GEMAS`,`Victoria con 20 puntos. Reclama tu premio.`,true);
    } else if(outcome==='win'){
      const o=randGold();
      playWin(); rainCoins(14);
      showResult('bjResult','bjResTitle','bjResPrize','bjResBody','win','✅ ¡GANASTE!',`🥇 ${fmtN(o)} ORO`,`Superaste a la banca. Reclama tu Oro.`,true);
    } else if(outcome==='push'){
      playCoin(); addAttempt();
      showResult('bjResult','bjResTitle','bjResPrize','bjResBody','bonus','🤝 EMPATE','🍀 +1 INTENTO EXTRA','Empate justo — se añadió 1 intento.',false);
    } else {
      playLose();
      showResult('bjResult','bjResTitle','bjResPrize','bjResBody','lose','❌ PERDISTE','Sin premio','Mejor suerte mañana.',false);
    }
  }

  // ════════════════════
  // 3. DADOS
  // ════════════════════
  function drawDie(canvas, value, color){
    const ctx = canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0d0a12';
    ctx.strokeStyle= color||'#382f44';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(4,4,W-8,H-8,8); ctx.fill(); ctx.stroke();
    // pip positions for each face
    const PIP_MAP = {
      1:[[.5,.5]],
      2:[[.25,.25],[.75,.75]],
      3:[[.25,.25],[.5,.5],[.75,.75]],
      4:[[.25,.25],[.75,.25],[.25,.75],[.75,.75]],
      5:[[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]],
      6:[[.25,.2],[.75,.2],[.25,.5],[.75,.5],[.25,.8],[.75,.8]],
    };
    const pips = PIP_MAP[value]||[];
    ctx.fillStyle=color||'#ffd23f';
    pips.forEach(([rx,ry])=>{
      const x=(W-8)*rx+4, y=(H-8)*ry+4;
      ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    });
  }

  function animateDie(canvas, duration, finalValue, color, cb){
    const start=Date.now();
    function frame(){
      const elapsed=Date.now()-start;
      if(elapsed>=duration){ drawDie(canvas,finalValue,color); cb&&cb(); return; }
      drawDie(canvas,Math.ceil(Math.random()*6),color);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // init dice display
  ['die1','die2','die3','die4'].forEach(id=>{
    const c=document.getElementById(id);
    if(c) drawDie(c,6, id==='die3'||id==='die4'?'#ff3860':'#ffd23f');
  });

  const diceBtn=document.getElementById('diceBtn');
  let diceRolling=false;

  if(diceBtn){
    diceBtn.addEventListener('click',()=>{
      if(diceRolling) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('diceResult').style.display='none';
      document.getElementById('diceTotals').style.display='none';
      diceBtn.disabled=true; diceRolling=true;

      const p1=Math.ceil(Math.random()*6), p2=Math.ceil(Math.random()*6);
      const h1=Math.ceil(Math.random()*6), h2=Math.ceil(Math.random()*6);
      let done=0;
      function check(){ done++; if(done===4) resolveDice(p1,p2,h1,h2); }

      animateDie(document.getElementById('die1'),900,p1,'#ffd23f',check);
      animateDie(document.getElementById('die2'),1100,p2,'#ffd23f',check);
      animateDie(document.getElementById('die3'),800,h1,'#ff3860',check);
      animateDie(document.getElementById('die4'),1050,h2,'#ff3860',check);
    });
  }

  function resolveDice(p1,p2,h1,h2){
    diceRolling=false;
    const pt=p1+p2, ht=h1+h2;
    document.getElementById('playerTotal').textContent=pt;
    document.getElementById('houseTotal').textContent=ht;
    document.getElementById('diceTotals').style.display='flex';

    if(pt>ht){
      const margin=pt-ht;
      const isDouble6=(p1===6&&p2===6);
      playWin();
      if(isDouble6){
        const g=randGems();
        rainCoins(30);
        showResult('diceResult','diceResTitle','diceResPrize','diceResBody','win','🎲 ¡DOBLE 6 + VICTORIA!',`💎 ${fmtN(g)} GEMAS`,'¡Doble 6 ganador! Premio máximo. Reclama.',true);
      } else if(margin>=3){
        const g=Math.floor(Math.random()*1300)+700; // 700-1999 mega gemas
        rainCoins(22);
        showResult('diceResult','diceResTitle','diceResPrize','diceResBody','win','🏆 ¡VICTORIA APLASTANTE!',`💎 ${fmtN(g)} MEGA GEMAS`,`Ganaste por ${margin} puntos. Reclama tu premio.`,true);
      } else {
        const o=randGold();
        rainCoins(14);
        showResult('diceResult','diceResTitle','diceResPrize','diceResBody','win','✅ ¡GANASTE!',`🥇 ${fmtN(o)} ORO`,`Tú: ${pt} vs Banca: ${ht}. Reclama tu Oro.`,true);
      }
    } else if(pt===ht){
      addAttempt(); playCoin();
      showResult('diceResult','diceResTitle','diceResPrize','diceResBody','bonus','🤝 ¡EMPATE!','🍀 +1 INTENTO EXTRA',`Ambos con ${pt}. Empate: se añadió 1 intento.`,false);
    } else {
      playLose();
      showResult('diceResult','diceResTitle','diceResPrize','diceResBody','lose','💀 PERDISTE',`Banca: ${ht} vs Tú: ${pt}`,'Sin suerte esta vez.',false);
    }
    diceBtn.disabled=getAttempts()<=0;
  }

  // ════════════════════
  // 4. PACHINKO
  // ════════════════════
  const PACH_BUCKETS = [
    { label:'🏆 JACKPOT', prizeType:'megagems', type:'win', cta:true, color:'#ffd23f', w:1 },
    { label:'💎 GEMAS',   prizeType:'gems',       type:'win', cta:true, color:'#7c5cff', w:3 },
    { label:'⭐ ORO',     prizeType:'gold',        type:'win', cta:true, color:'#ffd23f', w:5 },
    { label:'🍀 BONUS',   prizeType:'bonus2',     type:'bonus',cta:false,color:'#39ff88', w:6 },
    { label:'💀 NADA',    prizeType:'none',        type:'lose', cta:false,color:'#ff3860', w:12 },
    { label:'⭐ ORO',     prizeType:'gold',        type:'win', cta:true, color:'#ffd23f', w:5 },
    { label:'💎 GEMAS',   prizeType:'gems',        type:'win', cta:true, color:'#7c5cff', w:3 },
    { label:'💀 NADA',    prizeType:'none',        type:'lose', cta:false,color:'#ff3860', w:12 },
    { label:'🍀 BONUS',   prizeType:'bonus2',     type:'bonus',cta:false,color:'#39ff88', w:6 },
    { label:'🏆 JACKPOT', prizeType:'megagems', type:'win', cta:true, color:'#ffd23f', w:1 },
  ];
  function pachPrizeLabel(bucket){
    if(bucket.prizeType==='megagems') return `${fmtN(randMegaGems())} MEGA GEMAS`;
    if(bucket.prizeType==='gems') return `${fmtN(randGems())} GEMAS`;
    if(bucket.prizeType==='gold') return `${fmtN(randGold())} ORO`;
    if(bucket.prizeType==='bonus2') return '+2 INTENTOS';
    return 'Sin premio';
  }
  const PACH_N = PACH_BUCKETS.length; // 10 buckets

  function weightedBucketIndex(){
    const total = PACH_BUCKETS.reduce((a,b)=>a+b.w,0);
    let r=Math.random()*total;
    for(let i=0;i<PACH_BUCKETS.length;i++){ r-=PACH_BUCKETS[i].w; if(r<=0) return i; }
    return PACH_BUCKETS.length-1;
  }

  const pachCanvas = document.getElementById('pachinkoCanvas');
  const leverBtn = document.getElementById('leverBtn');
  let pachRunning=false;

  if(pachCanvas){
    const CW=pachCanvas.width, CH=pachCanvas.height;
    const BUCKET_W=CW/PACH_N;
    // pegs grid
    const PEGS=[];
    const ROWS=7, COLS=8;
    for(let row=0;row<ROWS;row++){
      const count=(row%2===0)?COLS:COLS-1;
      const offset=(row%2===0)?0:BUCKET_W/2;
      for(let col=0;col<count;col++){
        PEGS.push({
          x: offset + BUCKET_W*0.5 + col*(CW/(count)),
          y: 40 + row*(CH-80)/(ROWS-1)
        });
      }
    }

    function drawPachinko(ball){
      const ctx=pachCanvas.getContext('2d');
      ctx.clearRect(0,0,CW,CH);
      // background
      ctx.fillStyle='#060509'; ctx.fillRect(0,0,CW,CH);
      // pegs
      PEGS.forEach(p=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2);
        ctx.fillStyle='#382f44'; ctx.fill();
        ctx.strokeStyle='#7c5cff'; ctx.lineWidth=1; ctx.stroke();
      });
      // buckets
      PACH_BUCKETS.forEach((b,i)=>{
        const x=i*BUCKET_W;
        ctx.fillStyle=b.color+'22';
        ctx.fillRect(x+1,CH-30,BUCKET_W-2,30);
        ctx.strokeStyle=b.color;
        ctx.lineWidth=1;
        ctx.strokeRect(x+1,CH-30,BUCKET_W-2,30);
        ctx.fillStyle=b.color;
        ctx.font='10px monospace';
        ctx.textAlign='center';
        ctx.fillText(b.label.split(' ')[0],x+BUCKET_W/2,CH-12);
      });
      // ball
      if(ball){
        ctx.beginPath(); ctx.arc(ball.x,ball.y,9,0,Math.PI*2);
        ctx.fillStyle='#ffd23f';
        ctx.shadowColor='#ffd23f'; ctx.shadowBlur=12;
        ctx.fill();
        ctx.shadowBlur=0;
      }
    }

    function runBall(targetBucket, onDone){
      const startX = CW/2 + (Math.random()-0.5)*40;
      let bx=startX, by=10, vx=(Math.random()-0.5)*1.5, vy=1.5;
      const gravity=0.25, bounce=0.55, friction=0.96;
      const targetCenterX = targetBucket*BUCKET_W + BUCKET_W/2;

      function step(){
        vy+=gravity;
        bx+=vx; by+=vy;
        // peg collision
        PEGS.forEach(p=>{
          const dx=bx-p.x, dy=by-p.y, dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<15){
            const nx=dx/dist, ny=dy/dist;
            const dot=vx*nx+vy*ny;
            vx=(vx-2*dot*nx)*bounce;
            vy=(vy-2*dot*ny)*bounce;
            bx=p.x+nx*16; by=p.y+ny*16;
            // nudge toward target
            vx+=(targetCenterX-bx)*0.002;
            playCoin();
          }
        });
        // walls
        if(bx<9){bx=9; vx=Math.abs(vx)*bounce;}
        if(bx>CW-9){bx=CW-9; vx=-Math.abs(vx)*bounce;}
        vx*=friction;
        drawPachinko({x:bx,y:by});
        if(by>=CH-30){ onDone&&onDone(); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    drawPachinko(null);

    leverBtn.addEventListener('click',()=>{
      if(pachRunning) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('pachinkoResult').style.display='none';
      leverBtn.disabled=true; pachRunning=true;
      leverBtn.classList.add('pulled');
      setTimeout(()=>leverBtn.classList.remove('pulled'),400);

      const targetIdx = weightedBucketIndex();
      runBall(targetIdx, ()=>{
        pachRunning=false;
        leverBtn.disabled=getAttempts()<=0;
        const bucket=PACH_BUCKETS[targetIdx];
        const prizeStr = pachPrizeLabel(bucket);
        if(bucket.type==='bonus'){ addAttempts(2); playCoin(); }
        else if(bucket.type==='win'){ playWin(); rainCoins(20); }
        else { playLose(); }
        showResult('pachinkoResult','pachinkoResTitle','pachinkoResPrize','pachinkoResBody',
          bucket.type,
          bucket.type==='win'?'🎉 ¡GANASTE!':bucket.type==='bonus'?'🍀 ¡BONUS!':'💀 SIN SUERTE',
          `${bucket.label} — ${prizeStr}`,
          bucket.cta?'Toma una captura y reclama tu premio con un Owner.':
            bucket.type==='bonus'?`Se añadieron 2 intentos extra.`:'Mejor suerte mañana.',
          bucket.cta
        );
      });
    });
  }

  // ════════════════════
  // 5. ADIVINA LA CARTA
  // ════════════════════
  const CP_DECK = [
    { type:'special', icon:'⚡', lbl:'ESPECIAL\nMEGA GEMAS', cls:'special' },
    { type:'gems',    icon:'💎', lbl:'GEMAS',   cls:'gems' },
    { type:'gems',    icon:'💎', lbl:'GEMAS',   cls:'gems' },
    { type:'gold',    icon:'🥇', lbl:'ORO',     cls:'gold' },
    { type:'gold',    icon:'🥇', lbl:'ORO',     cls:'gold' },
    { type:'bonus',   icon:'🍀', lbl:'+1 INTENTO', cls:'bonus' },
    { type:'none',    icon:'💀', lbl:'NADA',    cls:'none' },
    { type:'none',    icon:'💀', lbl:'NADA',    cls:'none' },
  ];

  function shuffleArr(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; }

  let cpActive=false, cpPicked=false;

  const cpStartBtn = document.getElementById('cpStartBtn');
  const cpCardsEl  = document.getElementById('cpCards');
  const cpPhaseReady = document.getElementById('cpPhaseReady');
  const cpPhasePick  = document.getElementById('cpPhasePick');

  function cpReset(){
    cpActive=false; cpPicked=false;
    cpCardsEl.innerHTML='';
    cpPhasePick.style.display='none';
    cpPhaseReady.style.display='block';
    document.getElementById('cpResult').style.display='none';
    if(cpStartBtn) cpStartBtn.disabled=getAttempts()<=0;
  }

  if(cpStartBtn){
    cpStartBtn.addEventListener('click',()=>{
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      cpStartBtn.disabled=true;
      cpPhaseReady.style.display='none';
      cpPhasePick.style.display='block';
      document.getElementById('cpResult').style.display='none';
      cpPicked=false; cpActive=true;

      const hand = shuffleArr(CP_DECK);
      cpCardsEl.innerHTML='';

      hand.forEach((card, idx)=>{
        const wrapper = document.createElement('div');
        wrapper.className = 'cp-card';
        wrapper.innerHTML = `<div class="cp-card-inner">
          <div class="cp-card-back"></div>
          <div class="cp-card-front"><span class="cp-icon">${card.icon}</span><span class="cp-lbl">${card.lbl}</span></div>
        </div>`;
        wrapper.addEventListener('click',()=>{
          if(!cpActive||cpPicked) return;
          cpPicked=true; cpActive=false;

          // Flip chosen card
          wrapper.classList.add('flipped', card.cls);

          // Reveal all others after 600ms
          setTimeout(()=>{
            cpCardsEl.querySelectorAll('.cp-card').forEach((c,i)=>{
              if(c===wrapper) return;
              c.classList.add('flipped','revealed', hand[i].cls);
            });
          }, 600);

          // Resolve prize after all reveal
          setTimeout(()=>{
            cpResolve(card);
            cpStartBtn.disabled=getAttempts()<=0;
            cpPhaseReady.style.display='block';
          }, 1400);
        });
        cpCardsEl.appendChild(wrapper);
      });

      // Shuffle animation: briefly show all face-down then settle
      cpCardsEl.querySelectorAll('.cp-card').forEach((c,i)=>{
        c.style.opacity='0';
        c.style.transform='translateY(20px)';
        setTimeout(()=>{ c.style.transition='opacity .3s,transform .3s'; c.style.opacity='1'; c.style.transform=''; }, 80*i);
      });
    });
  }

  function cpResolve(card){
    if(card.type==='special'){
      const g=randMegaGems(); playWin(); rainCoins(32);
      showResult('cpResult','cpResTitle','cpResPrize','cpResBody','win',
        '⚡ ¡CARTA ESPECIAL!',`${fmtN(g)} MEGA GEMAS`,'¡Encontraste la carta especial! Toma captura y reclama.',true);
    } else if(card.type==='gems'){
      const g=randGems(); playWin(); rainCoins(20);
      showResult('cpResult','cpResTitle','cpResPrize','cpResBody','win',
        '💎 ¡GEMAS!',`${fmtN(g)} GEMAS`,'Reclama tus gemas con un Owner.',true);
    } else if(card.type==='gold'){
      const o=randGold(); playWin(); rainCoins(14);
      showResult('cpResult','cpResTitle','cpResPrize','cpResBody','win',
        '🥇 ¡ORO!',`${fmtN(o)} ORO`,'Reclama tu Oro con un Owner.',true);
    } else if(card.type==='bonus'){
      addAttempt(); playCoin();
      showResult('cpResult','cpResTitle','cpResPrize','cpResBody','bonus',
        '🍀 ¡BONUS!','+1 INTENTO EXTRA','Se añadió 1 intento a tus turnos de hoy.',false);
    } else if(card.type==='none'){
      playLose();
      showResult('cpResult','cpResTitle','cpResPrize','cpResBody','lose',
        '💀 SIN SUERTE','Sin premio','Mejor suerte en tu próximo intento.',false);
    }
  }

  // ════════════════════
  // 6. RULETA EUROPEA
  // ════════════════════
  const ROULETTE_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  function rouletteColor(n){
    if(n===0) return 'green';
    return ROULETTE_RED.has(n) ? 'red' : 'black';
  }
  let rbSelected = null;
  const rouletteBetsEl = document.getElementById('rouletteBets');
  const rouletteBtn = document.getElementById('rouletteBtn');
  if(rouletteBetsEl){
    rouletteBetsEl.querySelectorAll('.rb-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        rouletteBetsEl.querySelectorAll('.rb-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        rbSelected = btn.dataset.bet;
        document.getElementById('rouletteBetLabel').textContent = 'Apuesta: ' + btn.textContent;
        rouletteBtn.disabled = getAttempts()<=0;
      });
    });
  }
  if(rouletteBtn){
    rouletteBtn.addEventListener('click',()=>{
      if(!rbSelected) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('rouletteResult').style.display='none';
      rouletteBtn.disabled = true;
      const numEl = document.getElementById('rouletteNumber');
      numEl.className = 'roulette-number spinning';
      let ticks = 0;
      const spin = setInterval(()=>{
        numEl.textContent = Math.floor(Math.random()*37);
        ticks++;
        if(ticks>18){
          clearInterval(spin);
          const result = Math.floor(Math.random()*37);
          const color = rouletteColor(result);
          numEl.textContent = result;
          numEl.className = 'roulette-number is-'+color;
          resolveRoulette(result, color);
        }
      }, 80);
    });
  }
  function resolveRoulette(result, color){
    let won=false, prizeType=null;
    if(rbSelected==='zero' && result===0){ won=true; prizeType='premium'; }
    else if(rbSelected==='red' && color==='red'){ won=true; prizeType='gems'; }
    else if(rbSelected==='black' && color==='black'){ won=true; prizeType='gold'; }
    else if(rbSelected==='even' && result!==0 && result%2===0){ won=true; prizeType='gold'; }
    else if(rbSelected==='odd' && result%2===1){ won=true; prizeType='gold'; }

    if(won){
      playWin();
      if(prizeType==='premium'){
        rainCoins(40);
        showResult('rouletteResult','rouletteResTitle','rouletteResPrize','rouletteResBody','win','🟢 ¡EL CERO!','⭐ 1 SEMANA PREMIUM','¡Increíble suerte! Toma una captura y reclama.',true);
      } else if(prizeType==='gems'){
        const g=randGems(); rainCoins(18);
        showResult('rouletteResult','rouletteResTitle','rouletteResPrize','rouletteResBody','win','🔴 ¡COLOR CORRECTO!',`💎 ${fmtN(g)} GEMAS`,`Salió ${result} (${color}). Reclama tu premio.`,true);
      } else {
        const o=randGold(); rainCoins(14);
        showResult('rouletteResult','rouletteResTitle','rouletteResPrize','rouletteResBody','win','✅ ¡GANASTE!',`🥇 ${fmtN(o)} ORO`,`Salió ${result} (${color}). Reclama tu Oro.`,true);
      }
    } else {
      playLose();
      showResult('rouletteResult','rouletteResTitle','rouletteResPrize','rouletteResBody','lose','😔 SIN SUERTE',`Salió ${result} (${color})`,'Prueba de nuevo mañana.',false);
    }
    rouletteBtn.disabled = getAttempts()<=0;
  }

  // ════════════════════
  // 7. CARA O CRUZ
  // ════════════════════
  let cfSelected = null;
  const coinflipBetsEl = document.getElementById('coinflipBets');
  const coinflipBtn = document.getElementById('coinflipBtn');
  if(coinflipBetsEl){
    coinflipBetsEl.querySelectorAll('.rb-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        coinflipBetsEl.querySelectorAll('.rb-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        cfSelected = btn.dataset.bet;
        coinflipBtn.disabled = getAttempts()<=0;
      });
    });
  }
  if(coinflipBtn){
    coinflipBtn.addEventListener('click',()=>{
      if(!cfSelected) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('coinflipResult').style.display='none';
      coinflipBtn.disabled = true;
      const coinEl = document.getElementById('coinEl');
      coinEl.classList.add('flipping');
      setTimeout(()=>{
        coinEl.classList.remove('flipping');
        const result = Math.random()<0.5 ? 'cara' : 'cruz';
        coinEl.textContent = result==='cara' ? '😀' : '🔄';
        resolveCoinflip(result);
      }, 900);
    });
  }
  function resolveCoinflip(result){
    if(cfSelected===result){
      playWin();
      const isGems = Math.random()<0.5;
      if(isGems){
        const g=randGems(); rainCoins(16);
        showResult('coinflipResult','coinflipResTitle','coinflipResPrize','coinflipResBody','win','🎉 ¡ACERTASTE!',`💎 ${fmtN(g)} GEMAS`,`Salió ${result==='cara'?'Cara 😀':'Cruz 🔄'}. Reclama tu premio.`,true);
      } else {
        const o=randGold(); rainCoins(14);
        showResult('coinflipResult','coinflipResTitle','coinflipResPrize','coinflipResBody','win','🎉 ¡ACERTASTE!',`🥇 ${fmtN(o)} ORO`,`Salió ${result==='cara'?'Cara 😀':'Cruz 🔄'}. Reclama tu Oro.`,true);
      }
    } else {
      playLose();
      showResult('coinflipResult','coinflipResTitle','coinflipResPrize','coinflipResBody','lose','😔 FALLASTE',`Salió ${result==='cara'?'Cara 😀':'Cruz 🔄'}`,'Prueba de nuevo mañana.',false);
    }
    coinflipBtn.disabled = getAttempts()<=0;
  }

  // ════════════════════
  // 8. HIGH & LOW (DADOS)
  // ════════════════════
  let hldSelected = null, hldBase = 1;
  const hldBetsEl = document.getElementById('hldBets');
  const hldBtn = document.getElementById('hldBtn');
  const hldBaseCanvas = document.getElementById('hldBaseDie');
  const hldNextCanvas = document.getElementById('hldNextDie');

  function hldRollBase(){
    hldBase = Math.ceil(Math.random()*6);
    if(hldBaseCanvas) drawDie(hldBaseCanvas, hldBase, '#ffd23f');
    if(hldNextCanvas) drawDie(hldNextCanvas, 0, '#7c5cff');
  }
  if(hldBaseCanvas) hldRollBase();

  if(hldBetsEl){
    hldBetsEl.querySelectorAll('.rb-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        hldBetsEl.querySelectorAll('.rb-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        hldSelected = btn.dataset.bet;
        hldBtn.disabled = getAttempts()<=0;
      });
    });
  }
  if(hldBtn){
    hldBtn.addEventListener('click',()=>{
      if(!hldSelected) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('hldResult').style.display='none';
      hldBtn.disabled = true;
      const next = Math.ceil(Math.random()*6);
      animateDie(hldNextCanvas, 800, next, '#7c5cff', ()=> resolveHLD(next));
    });
  }
  function resolveHLD(next){
    let won=false, isEqual=false;
    if(hldSelected==='higher' && next>hldBase) won=true;
    else if(hldSelected==='lower' && next<hldBase) won=true;
    else if(hldSelected==='equal' && next===hldBase){ won=true; isEqual=true; }

    if(won){
      playWin();
      if(isEqual){
        const g=randGems(); rainCoins(20);
        showResult('hldResult','hldResTitle','hldResPrize','hldResBody','win','🟰 ¡IGUAL EXACTO!',`💎 ${fmtN(g)} GEMAS`,`Base: ${hldBase} — Siguiente: ${next}. ¡Premio mayor! Reclama.`,true);
      } else {
        const o=randGold(); rainCoins(14);
        showResult('hldResult','hldResTitle','hldResPrize','hldResBody','win','✅ ¡GANASTE!',`🥇 ${fmtN(o)} ORO`,`Base: ${hldBase} — Siguiente: ${next}. Reclama tu Oro.`,true);
      }
    } else {
      playLose();
      showResult('hldResult','hldResTitle','hldResPrize','hldResBody','lose','😔 FALLASTE',`Base: ${hldBase} — Siguiente: ${next}`,'Prueba de nuevo mañana.',false);
    }
    setTimeout(hldRollBase, 1200);
    hldBtn.disabled = getAttempts()<=0;
  }

  // ════════════════════
  // 9. HI-LO CARTAS
  // ════════════════════
  const HLC_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  function hlcRankValue(r){ return HLC_RANKS.indexOf(r); }
  function hlcRandomCard(){
    const r = HLC_RANKS[Math.floor(Math.random()*HLC_RANKS.length)];
    const s = SUITS[Math.floor(Math.random()*SUITS.length)];
    return {r,s};
  }
  let hlcSelected = null, hlcBaseCard = hlcRandomCard();

  function hlcRenderBase(){
    const el = document.getElementById('hlcBaseCard');
    if(!el) return;
    const isRed = RED_SUITS.includes(hlcBaseCard.s);
    el.className = 'bj-card' + (isRed?' red':'');
    el.textContent = hlcBaseCard.r + hlcBaseCard.s;
    const nextEl = document.getElementById('hlcNextCard');
    if(nextEl){ nextEl.className = 'bj-card back'; nextEl.textContent=''; }
  }
  if(document.getElementById('hlcBaseCard')) hlcRenderBase();

  const hlcBetsEl = document.getElementById('hlcBets');
  const hlcBtn = document.getElementById('hlcBtn');
  if(hlcBetsEl){
    hlcBetsEl.querySelectorAll('.rb-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        hlcBetsEl.querySelectorAll('.rb-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        hlcSelected = btn.dataset.bet;
        hlcBtn.disabled = getAttempts()<=0;
      });
    });
  }
  if(hlcBtn){
    hlcBtn.addEventListener('click',()=>{
      if(!hlcSelected) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('hlcResult').style.display='none';
      hlcBtn.disabled = true;
      const next = hlcRandomCard();
      setTimeout(()=> resolveHLC(next), 500);
    });
  }
  function resolveHLC(next){
    const nextEl = document.getElementById('hlcNextCard');
    const isRed = RED_SUITS.includes(next.s);
    nextEl.className = 'bj-card' + (isRed?' red':'');
    nextEl.textContent = next.r + next.s;

    const bv = hlcRankValue(hlcBaseCard.r), nv = hlcRankValue(next.r);
    let won=false;
    if(hlcSelected==='high' && nv>bv) won=true;
    else if(hlcSelected==='low' && nv<bv) won=true;

    if(won){
      const isExtreme = (next.r==='A' || next.r==='K');
      playWin();
      if(isExtreme){
        const g=randGems(); rainCoins(20);
        showResult('hlcResult','hlcResTitle','hlcResPrize','hlcResBody','win','🃏 ¡MARGEN EXTREMO!',`💎 ${fmtN(g)} GEMAS`,`${hlcBaseCard.r}${hlcBaseCard.s} → ${next.r}${next.s}. Reclama tu premio.`,true);
      } else {
        const o=randGold(); rainCoins(14);
        showResult('hlcResult','hlcResTitle','hlcResPrize','hlcResBody','win','✅ ¡GANASTE!',`🥇 ${fmtN(o)} ORO`,`${hlcBaseCard.r}${hlcBaseCard.s} → ${next.r}${next.s}. Reclama tu Oro.`,true);
      }
    } else {
      playLose();
      const reason = nv===bv ? 'Empate en valor — pierdes.' : 'Prueba de nuevo mañana.';
      showResult('hlcResult','hlcResTitle','hlcResPrize','hlcResBody','lose','😔 FALLASTE',`${hlcBaseCard.r}${hlcBaseCard.s} → ${next.r}${next.s}`,reason,false);
    }
    setTimeout(()=>{ hlcBaseCard = next; hlcRenderBase(); }, 1300);
    hlcBtn.disabled = getAttempts()<=0;
  }

  // ════════════════════
  // 10. CRASH
  // ════════════════════
  let crashRunning=false, crashMult=1, crashPoint=1, crashInterval=null, crashCashed=false;
  const crashStartBtn = document.getElementById('crashStartBtn');
  const crashCashoutBtn = document.getElementById('crashCashoutBtn');
  const crashMultEl = document.getElementById('crashMultiplier');
  const crashDisplayEl = document.getElementById('crashDisplay');
  const crashBarEl = document.getElementById('crashBar');

  function rollCrashPoint(){
    // House-edge weighted: most crashes happen early, rare long runs
    const r = Math.random();
    if(r<0.45) return 1 + Math.random()*0.8;        // 1.0x - 1.8x (45%)
    if(r<0.75) return 1.8 + Math.random()*1.7;       // 1.8x - 3.5x (30%)
    if(r<0.93) return 3.5 + Math.random()*4.5;       // 3.5x - 8x (18%)
    return 8 + Math.random()*12;                      // 8x - 20x (7%)
  }

  if(crashStartBtn){
    crashStartBtn.addEventListener('click',()=>{
      if(crashRunning) return;
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      document.getElementById('crashResult').style.display='none';
      crashRunning=true; crashCashed=false; crashMult=1;
      crashPoint = rollCrashPoint();
      crashStartBtn.disabled=true; crashCashoutBtn.disabled=false;
      crashDisplayEl.className='crash-display';
      crashBarEl.className='crash-bar'; crashBarEl.style.width='0%';
      crashMultEl.textContent='1.00×';
      crashInterval = setInterval(()=>{
        crashMult += 0.02 + crashMult*0.015;
        if(crashMult>=crashPoint){
          clearInterval(crashInterval);
          crashMultEl.textContent = crashMult.toFixed(2)+'×';
          crashBarEl.style.width='100%';
          if(!crashCashed) crashExplode();
        } else {
          crashMultEl.textContent = crashMult.toFixed(2)+'×';
          crashBarEl.style.width = Math.min(100, (crashMult/20)*100)+'%';
          if(crashMult>=5){ crashDisplayEl.classList.add('danger'); crashBarEl.classList.add('danger'); }
        }
      }, 100);
    });
  }
  if(crashCashoutBtn){
    crashCashoutBtn.addEventListener('click',()=>{
      if(!crashRunning || crashCashed) return;
      crashCashed = true;
      clearInterval(crashInterval);
      crashRunning=false;
      crashCashoutBtn.disabled=true;
      crashStartBtn.disabled = getAttempts()<=0;
      const finalMult = crashMult;
      playWin();
      const baseGold = Math.floor(randGold()*Math.min(finalMult,10));
      if(finalMult>=5){
        const g = randGems(); rainCoins(24);
        showResult('crashResult','crashResTitle','crashResPrize','crashResBody','win','💰 ¡RETIRASTE A TIEMPO!',`🥇 ${fmtN(baseGold)} ORO + 💎 ${fmtN(g)} GEMAS`,`Retiraste en ${finalMult.toFixed(2)}×. Reclama tu premio.`,true);
      } else {
        rainCoins(14);
        showResult('crashResult','crashResTitle','crashResPrize','crashResBody','win','💰 ¡RETIRASTE A TIEMPO!',`🥇 ${fmtN(baseGold)} ORO`,`Retiraste en ${finalMult.toFixed(2)}×. Reclama tu premio.`,true);
      }
    });
  }
  function crashExplode(){
    crashRunning=false;
    crashStartBtn.disabled = getAttempts()<=0;
    crashCashoutBtn.disabled=true;
    playLose();
    showResult('crashResult','crashResTitle','crashResPrize','crashResBody','lose','💥 ¡EXPLOTÓ!',`Llegó a ${crashPoint.toFixed(2)}×`,'No retiraste a tiempo. Prueba de nuevo mañana.',false);
  }

  // ════════════════════
  // 11. MINES
  // ════════════════════
  const MINES_TOTAL = 25, MINES_COUNT = 3;
  let minesGridState = [], minesActive=false, minesSafeOpened=0, minesGoldAcc=0;
  const minesGridEl = document.getElementById('minesGrid');
  const minesStartBtn = document.getElementById('minesStartBtn');
  const minesCashoutBtn = document.getElementById('minesCashoutBtn');
  const minesPrizeNowEl = document.getElementById('minesPrizeNow');
  const minesSafeCountEl = document.getElementById('minesSafeCount');

  function minesNewGame(){
    minesActive = true; minesSafeOpened = 0; minesGoldAcc = 0;
    minesGridState = Array(MINES_TOTAL).fill('safe');
    let placed=0;
    while(placed<MINES_COUNT){
      const idx = Math.floor(Math.random()*MINES_TOTAL);
      if(minesGridState[idx]!=='mine'){ minesGridState[idx]='mine'; placed++; }
    }
    minesPrizeNowEl.textContent = '0 Oro';
    minesSafeCountEl.textContent = '0';
    minesCashoutBtn.disabled = true;
    document.getElementById('minesResult').style.display='none';
    if(minesGridEl){
      minesGridEl.innerHTML='';
      for(let i=0;i<MINES_TOTAL;i++){
        const tile = document.createElement('div');
        tile.className='mine-tile';
        tile.dataset.idx=i;
        tile.textContent='❓';
        tile.addEventListener('click',()=>minesReveal(i,tile));
        minesGridEl.appendChild(tile);
      }
    }
  }
  if(minesStartBtn){
    minesStartBtn.addEventListener('click',()=>{
      if(getAttempts()<=0) return;
      if(!useAttempt()) return;
      minesStartBtn.disabled=true;
      minesNewGame();
    });
  }
  function minesReveal(idx, tile){
    if(!minesActive || tile.classList.contains('revealed')) return;
    if(minesGridState[idx]==='mine'){
      minesActive=false;
      tile.classList.add('revealed','mine');
      tile.textContent='💣';
      // reveal rest
      document.querySelectorAll('.mine-tile').forEach((t,i)=>{
        if(!t.classList.contains('revealed')){
          t.classList.add('revealed', minesGridState[i]==='mine'?'mine':'safe');
          t.textContent = minesGridState[i]==='mine' ? '💣' : '💎';
        }
      });
      minesCashoutBtn.disabled=true;
      minesStartBtn.disabled = getAttempts()<=0;
      playLose();
      showResult('minesResult','minesResTitle','minesResPrize','minesResBody','lose','💥 ¡MINA!',`Perdiste ${fmtN(minesGoldAcc)} Oro acumulado`,'Cayó en una mina. Prueba de nuevo.',false);
    } else {
      tile.classList.add('revealed','safe');
      tile.textContent='💎';
      minesSafeOpened++;
      minesGoldAcc += Math.floor(Math.random()*120)+40;
      minesPrizeNowEl.textContent = fmtN(minesGoldAcc)+' Oro';
      minesSafeCountEl.textContent = minesSafeOpened;
      minesCashoutBtn.disabled=false;
      playCoin();
      if(minesSafeOpened >= MINES_TOTAL - MINES_COUNT){
        // cleared the whole board
        minesAutoCashout(true);
      }
    }
  }
  function minesAutoCashout(cleared){
    minesActive=false;
    minesCashoutBtn.disabled=true;
    minesStartBtn.disabled = getAttempts()<=0;
    document.querySelectorAll('.mine-tile').forEach(t=>t.classList.add('disabled'));
    playWin(); rainCoins(28);
    const bonusGems = minesSafeOpened>=5 ? randGems() : 0;
    const body = cleared ? '¡Tablero limpio! Reclama tu premio completo.' : 'Retiraste a tiempo. Reclama tu premio.';
    const prizeStr = bonusGems>0 ? `🥇 ${fmtN(minesGoldAcc)} ORO + 💎 ${fmtN(bonusGems)} GEMAS` : `🥇 ${fmtN(minesGoldAcc)} ORO`;
    showResult('minesResult','minesResTitle','minesResPrize','minesResBody','win', cleared?'🏆 ¡TABLERO COMPLETO!':'💰 ¡RETIRASTE!', prizeStr, body, true);
  }
  if(minesCashoutBtn){
    minesCashoutBtn.addEventListener('click',()=>{
      if(!minesActive || minesSafeOpened===0) return;
      minesAutoCashout(false);
    });
  }

  // ════════════════════════════════════════
  // 12. BOSS BATTLE
  // ════════════════════════════════════════
  (function(){
    const BOSS_MAX_HP  = 10000;
    const BOSS_HP_KEY  = 'pragmata_boss_hp';
    const PLAYER_MAX_HP = 100;

    function loadBossHP(){
      try { return Math.max(0, Math.min(BOSS_MAX_HP, parseInt(localStorage.getItem(BOSS_HP_KEY)) || BOSS_MAX_HP)); }
      catch(e){ return BOSS_MAX_HP; }
    }
    function saveBossHP(hp){
      try { localStorage.setItem(BOSS_HP_KEY, Math.max(0, hp)); } catch(e){}
    }

    let bossHP       = loadBossHP();
    let playerHP     = PLAYER_MAX_HP;
    let bossGoldAcc  = 0;
    let bossGemsAcc  = 0;
    let bossKO       = false;
    let bossAnimating = false;

    const bossAttackBtn = document.getElementById('bossAttackBtn');

    function updateBossHUD(){
      const ef = document.getElementById('bossHpFill');
      const et = document.getElementById('bossHpText');
      const pf = document.getElementById('playerHpFill');
      const pt = document.getElementById('playerHpText');
      if(!ef) return;

      const bossPct  = Math.max(0,(bossHP / BOSS_MAX_HP) * 100);
      ef.style.width = bossPct + '%';
      ef.style.background = bossPct > 50 ? '#ff3860' : bossPct > 20 ? '#ffd23f' : '#39ff88';
      et.textContent = fmtN(Math.max(0,bossHP)) + ' / ' + fmtN(BOSS_MAX_HP);

      const playerPct = Math.max(0,(playerHP / PLAYER_MAX_HP) * 100);
      pf.style.width  = playerPct + '%';
      pf.style.background = playerPct > 50 ? '#39ff88' : playerPct > 25 ? '#ffd23f' : '#ff3860';
      pt.textContent  = playerHP + ' / ' + PLAYER_MAX_HP;

      document.getElementById('bossGoldAcc').textContent = fmtN(bossGoldAcc);
      document.getElementById('bossGemsAcc').textContent = fmtN(bossGemsAcc);

      if(bossAttackBtn) bossAttackBtn.disabled = getAttempts()<=0 || bossKO || bossAnimating;
    }

    function addLog(msg, cls){
      const log = document.getElementById('bossLog');
      if(!log) return;
      const e = document.createElement('div');
      e.className = 'blog-entry ' + (cls||'');
      e.textContent = msg;
      log.appendChild(e);
      log.scrollTop = log.scrollHeight;
      while(log.children.length > 12) log.removeChild(log.firstChild);
    }

    function shake(id, cls){
      const el = document.getElementById(id);
      if(!el) return;
      el.classList.add(cls);
      setTimeout(()=>el.classList.remove(cls), 400);
    }

    function floatDmg(amount, targetId, color){
      const el = document.getElementById(targetId);
      if(!el) return;
      const rect = el.getBoundingClientRect();
      const div  = document.createElement('div');
      div.textContent = '-' + fmtN(amount);
      div.style.cssText = [
        'position:fixed',
        `left:${rect.left + rect.width/2}px`,
        `top:${rect.top + 10}px`,
        'font-family:var(--f-display)',
        'font-size:13px',
        `color:${color}`,
        'z-index:99999',
        'pointer-events:none',
        'transform:translateX(-50%)',
        'transition:top 0.9s ease,opacity 0.9s ease',
      ].join(';');
      document.body.appendChild(div);
      requestAnimationFrame(()=>{ div.style.top=(rect.top - 36)+'px'; div.style.opacity='0'; });
      setTimeout(()=>div.remove(), 1000);
    }

    if(bossAttackBtn){
      bossAttackBtn.addEventListener('click', async ()=>{
        if(getAttempts()<=0 || bossKO || bossAnimating) return;
        const ok = await useAttempt();
        if(!ok) return;

        bossAnimating = true;
        bossAttackBtn.disabled = true;
        document.getElementById('bossResult').style.display = 'none';

        // ── Player attacks boss ──
        const playerDmg = Math.floor(Math.random() * 301) + 200; // 200-500
        bossHP = Math.max(0, bossHP - playerDmg);
        saveBossHP(bossHP);
        shake('bossSprite','boss-shake');
        floatDmg(playerDmg, 'bossSprite', '#ffd23f');
        addLog(`⚔️ Atacaste al Boss por ${fmtN(playerDmg)} de daño!`, 'attack');

        // ── Drop always ──
        const isGemsDrop = Math.random() < 0.38;
        if(isGemsDrop){
          const g = Math.floor(Math.random() * 131) + 20; // 20-150
          bossGemsAcc += g;
          addLog(`💎 El Boss dropea ${fmtN(g)} Gemas!`, 'drop');
        } else {
          const o = Math.floor(Math.random() * 401) + 100; // 100-500
          bossGoldAcc += o;
          addLog(`🥇 El Boss dropea ${fmtN(o)} Oro!`, 'drop');
        }
        playCoin();
        updateBossHUD();

        // ── Boss muerto? ──
        if(bossHP <= 0){
          bossHP = BOSS_MAX_HP;
          saveBossHP(bossHP);
          const bonusGold = 3000, bonusGems = 800;
          bossGoldAcc += bonusGold;
          bossGemsAcc += bonusGems;
          updateBossHUD();
          addLog('🏆 ¡GUARDIAN OSCURO DERROTADO! Bonus: +3000 Oro +800 Gemas. Renace con vida completa.', 'victory');
          rainCoins(55); playWin();
          showResult('bossResult','bossResTitle','bossResPrize','bossResBody','win',
            '🏆 ¡GUARDIAN OSCURO DERROTADO!',
            `🥇 ${fmtN(bossGoldAcc)} ORO + 💎 ${fmtN(bossGemsAcc)} GEMAS`,
            'Lo venciste. El Boss renace con vida completa. Toma captura y reclama todo.',
            true
          );
          bossAnimating = false;
          bossAttackBtn.disabled = getAttempts()<=0;
          return;
        }

        // ── Boss contraataca ──
        setTimeout(()=>{
          const bossDmg = Math.floor(Math.random() * 31) + 30; // 30-60
          playerHP = Math.max(0, playerHP - bossDmg);
          shake('playerSprite','player-shake');
          floatDmg(bossDmg, 'playerSprite', '#ff3860');
          addLog(`💥 El Boss te golpea por ${bossDmg} de daño!`, 'boss-hit');
          updateBossHUD();

          if(playerHP <= 0){
            bossKO = true;
            addLog('💀 ¡KO! El Boss te derrotó. Conservas todo el drop de la sesión.', 'init');
            playLose();
            const hasPrize = bossGoldAcc > 0 || bossGemsAcc > 0;
            showResult('bossResult','bossResTitle','bossResPrize','bossResBody',
              hasPrize ? 'lose' : 'lose',
              '💀 ¡KO — EL BOSS TE DERROTÓ!',
              bossGoldAcc>0||bossGemsAcc>0
                ? `🥇 ${fmtN(bossGoldAcc)} ORO + 💎 ${fmtN(bossGemsAcc)} GEMAS`
                : 'Sin drop esta sesión',
              'Fuiste derrotado. Conservas todo lo dropeado esta sesión. Reclama tu premio.',
              hasPrize
            );
          } else {
            addLog(`❤️ Tu vida restante: ${playerHP}/${PLAYER_MAX_HP}`, 'info');
          }

          bossAnimating = false;
          bossAttackBtn.disabled = getAttempts()<=0 || bossKO;
        }, 900);
      });
    }

    // Inicializar HUD al cargar
    if(document.getElementById('bossHpFill')) updateBossHUD();
  })();

  // ── Game tab switcher ──
  document.querySelectorAll('.casino-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.casino-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.casino-game').forEach(g=>g.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('game-'+tab.dataset.game).classList.add('active');
    });
  });

  // ── Coins Shop tab switcher ──
  document.querySelectorAll('.cshop-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.cshop-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.cshop-grid').forEach(g=>g.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('cshop-'+tab.dataset.cat).classList.add('active');
    });
  });

  // ── Reset oculto: triple clic rápido en el punto invisible ──
  (function(){
    const dot = document.getElementById('casinoResetDot');
    if(!dot) return;
    let clicks = 0, timer = null;
    dot.addEventListener('click', ()=>{
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(()=>{ clicks = 0; }, 600);
      if(clicks >= 3){
        clicks = 0;
        clearTimeout(timer);
        // Reset solo del usuario actual
        upsertRow(MAX_ATTEMPTS, getTodayKey()).then(()=>{
          if(_cache) _cache.count = MAX_ATTEMPTS;
          updateHUD();
        });
        dot.style.opacity = '1';
        dot.textContent = '✅';
        setTimeout(()=>{ dot.style.opacity = '0'; dot.textContent = ''; }, 800);
      }
    });
  })();

  // ── Exponer control al panel admin ──
  // Reset individual (solo el usuario actual)
  window._casinoSetAttempts = async function(n){
    const count = Math.max(0, Math.min(10, n));
    if(_cache) _cache.count = count;
    await upsertRow(count, getTodayKey());
    updateHUD();
  };

  // Reset global: borra TODOS los registros → todos recuperan 3 intentos
  window._casinoResetAll = async function(){
    try {
      // Eliminar todas las filas — cada usuario obtendrá MAX_ATTEMPTS al cargar
      await fetch(`${CA_API}?id=neq.___none___`, {
        method: 'DELETE',
        headers: CA_HDR
      });
      // Reset propio también
      if(_cache){ _cache.count = MAX_ATTEMPTS; _cache.day = getTodayKey(); }
      await upsertRow(MAX_ATTEMPTS, getTodayKey());
      updateHUD();
      return true;
    } catch(e){ return false; }
  };

  // Init — fetchRow ya inicializa arriba

})();
