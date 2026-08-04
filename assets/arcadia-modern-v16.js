(function(){
  const rain=document.getElementById('neonRain'); if(rain&&!matchMedia('(prefers-reduced-motion: reduce)').matches){for(let i=0;i<(innerWidth<700?14:28);i++){const d=document.createElement('i');d.className='neon-drop';d.style.left=Math.random()*100+'vw';d.style.animationDuration=(5+Math.random()*9)+'s';d.style.animationDelay=(-Math.random()*12)+'s';d.style.opacity=(.08+Math.random()*.28);rain.appendChild(d)}}
  document.querySelectorAll('.sidebar-accordion-head').forEach(b=>b.addEventListener('click',()=>b.parentElement.classList.toggle('open')));
  function readSession(){try{return JSON.parse(localStorage.getItem('pragmata_session')||sessionStorage.getItem('pragmata_session')||'null')}catch{return null}}
  const s=readSession(),u=s?.user||s;const email=u?.email||'';const name=u?.user_metadata?.full_name||u?.user_metadata?.name||email.split('@')[0]||'Invitado';
  ['navUsername','sidebarUsername'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=name});const av=document.getElementById('sidebarAvatar');if(av)av.textContent=(name[0]||'U').toUpperCase();
  if(!s){document.querySelectorAll('.presence-dot').forEach(x=>x.classList.replace('online','offline'));const t=document.getElementById('navPresenceText');if(t)t.textContent='Offline'}
  document.getElementById('authGoogle')?.addEventListener('click',()=>alert('Google quedará activo al configurar el proveedor OAuth en Supabase.'));
  document.getElementById('authGithub')?.addEventListener('click',()=>alert('GitHub quedará activo al configurar el proveedor OAuth en Supabase.'));
})();