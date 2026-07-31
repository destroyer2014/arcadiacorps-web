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
