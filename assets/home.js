(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-home-counter]').forEach(el => {
    const target = Number(el.dataset.homeCounter || 0);
    if(reduce){ el.textContent = target.toLocaleString('es-PE'); return; }
    let started = false;
    const observer = new IntersectionObserver(entries => {
      if(started || !entries.some(e => e.isIntersecting)) return;
      started = true;
      const begin = performance.now();
      const duration = 1400;
      function step(now){
        const p = Math.min((now - begin) / duration, 1);
        const value = Math.round(target * (1 - Math.pow(1-p, 3)));
        el.textContent = value.toLocaleString('es-PE');
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      observer.disconnect();
    }, {threshold:.35});
    observer.observe(el);
  });

  const embers = document.querySelector('.home-embers');
  if(embers && !reduce){
    for(let i=0;i<26;i++){
      const particle = document.createElement('i');
      particle.style.setProperty('--x', Math.random()*100 + '%');
      particle.style.setProperty('--delay', Math.random()*8 + 's');
      particle.style.setProperty('--dur', (6+Math.random()*8) + 's');
      particle.style.setProperty('--size', (1+Math.random()*3) + 'px');
      embers.appendChild(particle);
    }
  }
})();

/* Hero image/GIF support, entrance animations and testimonial carousel */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const media = document.querySelector('.home-hero-media');
  const fallback = document.querySelector('.home-robot-fallback');
  if(media && fallback){
    const showMedia = () => {
      media.hidden = false;
      media.classList.add('is-ready');
      fallback.hidden = true;
    };
    const showFallback = () => {
      media.hidden = true;
      fallback.hidden = false;
    };
    media.addEventListener('load', showMedia, {once:true});
    media.addEventListener('error', showFallback, {once:true});
    if(media.complete){
      if(media.naturalWidth > 0) showMedia(); else showFallback();
    }
  }

  const reveals = document.querySelectorAll('.home-reveal');
  if(reduce || !('IntersectionObserver' in window)){
    reveals.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, {threshold:0.12, rootMargin:'0px 0px -40px'});
    reveals.forEach(el => revealObserver.observe(el));
  }

  const carousel = document.getElementById('homeTestimonialCarousel');
  if(!carousel) return;

  const track = carousel.querySelector('.home-testimonial-track');
  const cards = Array.from(carousel.querySelectorAll('.home-testimonial-card'));
  const prev = carousel.querySelector('.home-testimonial-arrow.prev');
  const next = carousel.querySelector('.home-testimonial-arrow.next');
  const dots = carousel.querySelector('.home-testimonial-dots');
  let index = 0;
  let timer = null;
  let startX = 0;

  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Ir al testimonio ${i + 1}`);
    dot.addEventListener('click', () => go(i, true));
    dots.appendChild(dot);
  });

  function visibleCards(){
    if(window.innerWidth <= 700) return 1;
    if(window.innerWidth <= 1050) return 2;
    return 3;
  }

  function maxIndex(){
    return Math.max(0, cards.length - visibleCards());
  }

  function update(){
    const cardWidth = cards[0]?.getBoundingClientRect().width || 0;
    const gap = 14;
    track.style.transform = `translate3d(-${index * (cardWidth + gap)}px,0,0)`;
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === index));
    prev.disabled = index === 0;
    next.disabled = index === maxIndex();
  }

  function go(nextIndex, userAction){
    index = Math.max(0, Math.min(nextIndex, maxIndex()));
    update();
    if(userAction) restart();
  }

  function restart(){
    clearInterval(timer);
    if(reduce) return;
    timer = setInterval(() => {
      go(index >= maxIndex() ? 0 : index + 1, false);
    }, 4800);
  }

  prev.addEventListener('click', () => go(index - 1, true));
  next.addEventListener('click', () => go(index + 1, true));
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', restart);
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
  carousel.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - startX;
    if(Math.abs(diff) > 45) go(index + (diff < 0 ? 1 : -1), true);
  }, {passive:true});
  window.addEventListener('resize', () => { index = Math.min(index, maxIndex()); update(); });

  update();
  restart();
})();

/* HOME V6 — cinematic motion, staggered grids, smart nav and parallax */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.getElementById('homeIntro');
  const body = document.body;

  const finishIntro = () => {
    intro?.classList.add('is-done');
    body.classList.add('home-ready');
  };
  if(reduce) finishIntro();
  else window.addEventListener('load', () => setTimeout(finishIntro, 900), {once:true});
  setTimeout(finishIntro, 2600);

  document.querySelectorAll('.home-stats-grid,.home-feature-grid,.home-showcase-grid,.home-bottom-grid').forEach(el => el.classList.add('home-stagger'));
  const staggerGroups = document.querySelectorAll('.home-stagger');
  if(reduce || !('IntersectionObserver' in window)) staggerGroups.forEach(el => el.classList.add('is-visible'));
  else {
    const staggerObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        staggerObserver.unobserve(entry.target);
      });
    }, {threshold:.12,rootMargin:'0px 0px -35px'});
    staggerGroups.forEach(el => staggerObserver.observe(el));
  }

  const nav = document.getElementById('nav');
  let lastY = window.scrollY;
  let ticking = false;
  function updateNav(){
    const y = window.scrollY;
    nav?.classList.toggle('home-nav-scrolled', y > 30);
    if(nav && y > 170 && y > lastY + 8) nav.classList.add('home-nav-hidden');
    else if(nav && y < lastY - 5) nav.classList.remove('home-nav-hidden');
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if(!ticking){ requestAnimationFrame(updateNav); ticking = true; }
  }, {passive:true});

  const glow = document.getElementById('homeCursorGlow');
  if(glow && !reduce && matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
      glow.classList.add('is-active');
    }, {passive:true});
    document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('is-active'));
  }

  const stage = document.querySelector('.home-robot-stage');
  const image = document.querySelector('.home-hero-media');
  if(stage && image && !reduce){
    stage.addEventListener('pointermove', e => {
      if(!matchMedia('(pointer:fine)').matches) return;
      const r = stage.getBoundingClientRect();
      const x = ((e.clientX-r.left)/r.width-.5)*10;
      const y = ((e.clientY-r.top)/r.height-.5)*8;
      image.style.transform = `translate3d(${x}px,${y}px,0) scale(1.025)`;
    });
    stage.addEventListener('pointerleave', () => image.style.transform = 'translate3d(0,0,0) scale(1)');
  }

  const terminal = document.querySelector('.home-terminal');
  if(terminal){
    const rows = Array.from(terminal.children);
    rows.forEach((row,i) => {
      row.classList.add('typed-row');
      row.style.animationDelay = `${i * 110}ms`;
    });
    if(reduce) terminal.classList.add('is-typing');
    else {
      const termObserver = new IntersectionObserver(entries => {
        if(entries.some(e => e.isIntersecting)){
          terminal.classList.add('is-typing');
          termObserver.disconnect();
        }
      }, {threshold:.35});
      termObserver.observe(terminal);
    }
  }
})();
