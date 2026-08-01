(()=>{
  const URL='https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const KEY='sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const $=id=>document.getElementById(id);
  const state={session:null,character:null,selectedClass:null,enemy:null,busy:false};
  const classMeta={warrior:{label:'Guerrero',sprite:'🛡️'},mage:{label:'Mago',sprite:'🧙'},assassin:{label:'Asesino',sprite:'🗡️'}};
  function session(){try{return JSON.parse(localStorage.getItem('pragmata_session')||sessionStorage.getItem('pragmata_session')||'null')}catch{return null}}
  function headers(extra={}){return{apikey:KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/json',...extra}}
  function show(id,on=true){$(id).hidden=!on}
  function status(msg=''){ $('gameStatus').textContent=msg; $('creatorStatus').textContent=msg }
  async function api(path,opts={}){const r=await fetch(URL+path,{...opts,headers:headers(opts.headers||{})});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.message||data?.error_description||data?.hint||'No se pudo completar la acción');return data}
  function render(){
    const c=state.character;if(!c)return;
    $('characterDisplayName').textContent=c.name;$('characterClass').textContent=classMeta[c.class]?.label?.toUpperCase()||c.class;$('characterSprite').textContent=classMeta[c.class]?.sprite||'⚔️';
    $('characterLevel').textContent=c.level;$('hpText').textContent=`${c.hp}/${c.max_hp}`;$('hpBar').style.width=`${Math.max(0,c.hp/c.max_hp*100)}%`;
    const need=c.level*100;$('xpText').textContent=`${c.experience}/${need}`;$('xpBar').style.width=`${Math.min(100,c.experience/need*100)}%`;
    $('goldText').textContent=c.gold;$('energyText').textContent=c.energy;$('attackText').textContent=c.attack;$('defenseText').textContent=c.defense;$('speedText').textContent=c.speed;$('critText').textContent=c.crit_chance;
    $('potionCount').textContent=c.potions||0;
    $('exploreBtn').disabled=state.busy||c.energy<1||!!state.enemy;
    renderInventory();
  }
  function renderInventory(){const list=$('inventoryList');const items=[];if(state.character?.potions>0)items.push(`<div class="inventory-item">🧪 <b>Poción menor</b><br>Cantidad: ${state.character.potions}</div>`);items.push(`<div class="inventory-item">${classMeta[state.character.class].sprite} <b>Equipo inicial</b><br>${classMeta[state.character.class].label}</div>`);list.innerHTML=items.join('')}
  function log(lines){const box=$('battleLog');(Array.isArray(lines)?lines:[lines]).forEach(x=>{const p=document.createElement('p');p.textContent='› '+x;box.prepend(p)})}
  function renderEnemy(){const e=state.enemy;show('battleBars',!!e);show('attackBtn',!!e);show('potionBtn',!!e);show('exploreBtn',!e);if(!e){$('enemySprite').textContent='🌲';$('enemyName').textContent='El sendero aguarda';$('enemyDescription').textContent='Explora para encontrar un enemigo.';return}$('enemySprite').textContent=e.sprite;$('enemyName').textContent=`${e.name} · Nv. ${e.level}`;$('enemyDescription').textContent=e.description;$('enemyHpText').textContent=`${e.hp}/${e.max_hp}`;$('enemyHpBar').style.width=`${Math.max(0,e.hp/e.max_hp*100)}%`}
  async function loadCharacter(){const rows=await api('/rest/v1/astharot_characters?select=*&limit=1');return rows?.[0]||null}
  async function createCharacter(){const name=$('characterName').value.trim();if(name.length<3||!state.selectedClass)return status('Elige una clase y usa un nombre de 3 a 18 caracteres.');state.busy=true;$('createCharacterBtn').disabled=true;try{const rows=await api('/rest/v1/rpc/astharot_create_character',{method:'POST',body:JSON.stringify({p_name:name,p_class:state.selectedClass})});state.character=Array.isArray(rows)?rows[0]:rows;show('characterCreator',false);show('gameDashboard');render();log('Tu leyenda ha comenzado en el Bosque de las Cenizas.')}catch(e){status(e.message)}finally{state.busy=false;$('createCharacterBtn').disabled=false}}
  async function battle(action){if(state.busy)return;state.busy=true;status('');document.querySelectorAll('.battle-actions button').forEach(b=>b.disabled=true);try{const payload={p_action:action,p_enemy:state.enemy};const data=await api('/rest/v1/rpc/astharot_battle',{method:'POST',body:JSON.stringify(payload)});state.character=data.character;state.enemy=data.enemy||null;log(data.log||[]);if(data.result==='victory')log(`Victoria: +${data.rewards.gold} oro y +${data.rewards.experience} EXP.`);if(data.result==='defeat')log('Has sido derrotado y regresaste al campamento.');renderEnemy();render()}catch(e){status(e.message)}finally{state.busy=false;render();if(state.enemy){$('attackBtn').disabled=false;$('potionBtn').disabled=false}}}
  async function init(){
    state.session=session();show('rpgLoading',false);
    if(!state.session?.access_token||state.session.expires_at*1000<Date.now()){show('rpgLoginRequired');return}
    try{state.character=await loadCharacter();if(!state.character){show('characterCreator');return}show('gameDashboard');render();renderEnemy()}catch(e){show('rpgLoginRequired');$('rpgLoginRequired').querySelector('p').textContent='No se pudo validar la sesión. Vuelve a iniciar sesión.'}
  }
  document.querySelectorAll('.class-card').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.class-card').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.selectedClass=btn.dataset.class;$('createCharacterBtn').disabled=false});
  $('createCharacterBtn').onclick=createCharacter;$('exploreBtn').onclick=()=>battle('explore');$('attackBtn').onclick=()=>battle('attack');$('potionBtn').onclick=()=>battle('potion');
  init();
})();
