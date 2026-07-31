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
