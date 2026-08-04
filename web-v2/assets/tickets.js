import { supabase } from './auth.js';
export const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const fmt=v=>new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
export async function uploadTicketImages(files,userId,ticketId){
  const out=[]; for(const file of [...files]){
    if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error(`Formato no permitido: ${file.name}`);
    if(file.size>5*1024*1024) throw new Error(`${file.name} supera 5 MB`);
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${userId}/${ticketId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from('ticket-images').upload(path,file,{contentType:file.type,upsert:false});
    if(error) throw error; out.push(path);
  } return out;
}
export async function signedUrls(paths=[]){
  if(!paths.length) return [];
  const {data,error}=await supabase.storage.from('ticket-images').createSignedUrls(paths,3600);
  if(error) throw error; return data.map((x,i)=>({path:paths[i],url:x.signedUrl}));
}
export const statusLabel={open:'Abierto',in_progress:'En proceso',waiting_user:'Esperando usuario',closed:'Cerrado'};
export const priorityLabel={low:'Baja',normal:'Normal',high:'Alta',urgent:'Urgente'};

export async function insertTicketMessage({ticket, authorId, body, attachments=[]}){
  const modern={ticket_id:ticket.id,author_id:authorId,body,attachments};
  const compatible={...modern,ticket_number:ticket.ticket_number,sender_id:authorId,message:body,is_internal:false};
  let result=await supabase.from('ticket_messages').insert(compatible);
  if(result.error && ['PGRST204','42703'].includes(String(result.error.code))){
    result=await supabase.from('ticket_messages').insert(modern);
  }
  return result;
}
