(function(){
'use strict';
const URL='https://dtfecbsokpgzyuiyxyvm.supabase.co';
const KEY='sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
const REST=URL+'/rest/v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function get(path){const r=await fetch(REST+path,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
function setText(id,v){const e=document.getElementById(id);if(e&&v)e.textContent=v;}
function setLink(id,text,url){const e=document.getElementById(id);if(!e)return;if(text)e.querySelector('[data-label]')?e.querySelector('[data-label]').textContent=text:e.lastChild.textContent=' '+text;if(url)e.href=url;}
function applySettings(s){window.ArcadiaSiteSettings=s;document.dispatchEvent(new CustomEvent('arcadia:settings',{detail:s}));
 setText('dynamicHeroEyebrow',s.hero_eyebrow);setText('dynamicHeroTitle',s.hero_title);setText('dynamicHeroAccent',s.hero_accent);setText('dynamicHeroDescription',s.hero_description);
 setLink('dynamicPrimaryButton',s.primary_button_text,s.primary_button_url);setLink('dynamicSecondaryButton',s.secondary_button_text,s.secondary_button_url);
 const status=document.getElementById('dynamicServiceStatus');if(status){status.textContent='● '+(s.service_status_label||'En línea');status.classList.toggle('is-offline',s.service_status!=='online');}
 setText('dynamicServiceMessage',s.service_status_message);
 const banner=document.getElementById('siteMaintenanceBanner');if(banner){const on=s.maintenance_enabled==='true';banner.hidden=!on;banner.querySelector('span').textContent=s.maintenance_message||'Estamos realizando mejoras.';}
 document.querySelectorAll('a[href*="whatsapp.com/channel"]').forEach(a=>{if(s.whatsapp_channel_url)a.href=s.whatsapp_channel_url;});
 document.querySelectorAll('a[href*="chat.whatsapp.com"]').forEach(a=>{if(s.whatsapp_group_url)a.href=s.whatsapp_group_url;});
}
function renderNews(rows){const list=document.getElementById('dynamicHomeNews');if(!list||!rows.length)return;list.innerHTML=rows.slice(0,6).map(n=>`<a href="${esc(n.action_url||'proyecto.html')}"><b>${esc(n.badge||'Nuevo')}</b><span><strong>${esc(n.title)}</strong><small>${esc(n.summary)}</small></span></a>`).join('');}
async function load(){try{const [settings,news]=await Promise.all([get('/site_settings?select=key,value'),get('/site_news?select=id,title,summary,badge,action_label,action_url,starts_at,expires_at,sort_order&is_active=eq.true&order=sort_order.asc,created_at.desc&limit=6')]);applySettings(Object.fromEntries(settings.map(x=>[x.key,x.value])));renderNews(news);}catch(e){console.warn('[contenido v15] se conserva el contenido HTML:',e);}}
function start(){load();setTimeout(load,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();document.addEventListener('partialsReady',()=>setTimeout(load,50));
})();