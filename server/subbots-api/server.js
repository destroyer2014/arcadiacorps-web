import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const exec=promisify(execFile);
const app=express();
const PORT=Number(process.env.PORT||3310);
const BOT=process.env.NERO_BOT_DIR||'/opt/nero-bot';
const BRAND_CREDIT='Made With © ArcadiaCorps';
const BRAND_SUFFIX=` | ${BRAND_CREDIT}`;
const authClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

app.use(cors({origin:true,credentials:false}));
app.use(express.json({limit:'3mb'}));

function baseBotName(value=''){
  const clean=String(value||'')
    .replace(/\s*\|\s*Made\s+With\s+©\s*ArcadiaCorps\s*$/i,'')
    .replace(/\s*[•·]\s*ArcadiaCorps\s*$/i,'')
    .replace(/[\r\n\t]+/g,' ')
    .trim()
    .slice(0,40);
  return clean||'Nero Subbot';
}
function brandedBotName(value=''){
  return `${baseBotName(value)}${BRAND_SUFFIX}`;
}
async function user(req,res,next){
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
    if(!token)return res.status(401).json({error:'Sin autorización'});
    const {data,error}=await authClient.auth.getUser(token);
    if(error||!data.user)return res.status(401).json({error:'Sesión inválida'});
    req.user=data.user;next();
  }catch(e){res.status(500).json({error:e.message})}
}
async function own(req){
  const {data,error}=await admin.from('arc_subbots').select('*').eq('id',req.params.id).eq('owner_id',req.user.id).single();
  if(error)throw new Error('Sub-Bot no encontrado');
  return data;
}
async function pm2(args){
  const {stdout}=await exec('pm2',args,{cwd:BOT,maxBuffer:5e6});
  return stdout;
}

app.get('/health',(q,r)=>r.json({ok:true,version:'41.0',brand:BRAND_CREDIT}));
app.get('/public-stats',async(req,res)=>{
  try{
    const raw=JSON.parse(await pm2(['jlist']));
    const bot=raw.find(x=>x.name==='nero-bot');
    let registeredUsers=0;
    try{
      const result=await admin.auth.admin.listUsers({page:1,perPage:1});
      registeredUsers=Number(result?.data?.total||result?.data?.users?.length||0);
    }catch{}
    res.json({
      ok:true,
      registeredUsers,
      botOnline:bot?.pm2_env?.status==='online',
      botStartedAt:bot?.pm2_env?.pm_uptime?new Date(bot.pm2_env.pm_uptime).toISOString():null
    });
  }catch(e){res.status(500).json({error:e.message})}
});
app.get('/subbots',user,async(req,res)=>{
  try{
    const raw=JSON.parse(await pm2(['jlist']));
    const {data}=await admin.from('arc_subbots').select('*').eq('owner_id',req.user.id);
    const allow=new Set((data||[]).map(x=>String(x.phone)));
    res.json({items:raw.filter(x=>x.name?.startsWith('nero-subbot-')).map(x=>({name:x.name,phone:x.name.replace('nero-subbot-',''),status:x.pm2_env?.status,pid:x.pid})).filter(x=>allow.has(x.phone))});
  }catch(e){res.status(500).json({error:e.message})}
});

app.patch('/subbots/:id/config',user,async(req,res)=>{
  try{
    const s=await own(req);
    const body=req.body||{};
    const args=[`${BOT}/scripts/subbot-config.js`,s.phone];

    if(body.name!==undefined&&body.name!==null&&String(body.name).trim()){
      // Security boundary: the browser never controls the final branded name.
      args.push('--name',brandedBotName(body.name));
    }
    if(body.prefix!==undefined&&body.prefix!==null&&String(body.prefix).trim()){
      args.push('--prefix',String(body.prefix));
    }
    if(body.statusText!==undefined&&body.statusText!==null){
      args.push('--status',String(body.statusText));
    }
    if(body.autoRead!==undefined&&body.autoRead!==null){
      args.push('--auto-read',String(Boolean(body.autoRead)));
    }
    if(body.avatarUrl!==undefined&&body.avatarUrl!==null&&String(body.avatarUrl).trim()){
      // scripts/subbot-config.js uses --avatar, not --avatar-url.
      args.push('--avatar',String(body.avatarUrl));
    }

    // Always allow the running worker to apply the selected web profile.
    args.push('--apply-profile','true');
    args.push('--pack-author','ArcadiaCorps');

    const {stdout}=await exec('node',args,{cwd:BOT,maxBuffer:2e6});
    let config=null;
    try{config=JSON.parse(stdout)}catch{}

    res.json({
      ok:true,
      brandedName:brandedBotName(body.name||s.name),
      config
    });
  }catch(e){res.status(400).json({error:e.message})}
});

app.post('/subbots/:id/start',user,async(req,res)=>{
  try{
    const s=await own(req),name=`nero-subbot-${s.phone}`;
    await pm2(['start',`${BOT}/src/subbot-worker.js`,'--name',name,'--','--id',s.phone,'--phone',s.phone]);
    res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message})}
});
for(const action of['stop','restart'])app.post(`/subbots/:id/${action}`,user,async(req,res)=>{
  try{const s=await own(req);await pm2([action,`nero-subbot-${s.phone}`]);res.json({ok:true})}
  catch(e){res.status(400).json({error:e.message})}
});
app.delete('/subbots/:id',user,async(req,res)=>{
  try{
    const s=await own(req);
    await pm2(['delete',`nero-subbot-${s.phone}`]).catch(()=>{});
    await exec('rm',['-rf',`${BOT}/sessions/subbots/${s.phone}`,`${BOT}/runtime/subbot-configs/${s.phone}.json`]);
    res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message})}
});
app.post('/subbots/:id/pairing-code',user,async(req,res)=>{
  try{
    const s=await own(req),name=`nero-subbot-${s.phone}`;
    await pm2(['delete',name]).catch(()=>{});
    await pm2(['start',`${BOT}/src/subbot-worker.js`,'--name',name,'--','--id',s.phone,'--phone',s.phone]);
    await new Promise(r=>setTimeout(r,5000));
    const logs=await pm2(['logs',name,'--lines','80','--nostream']);
    const matches=[...logs.matchAll(/\[SUBBOT_PAIRING_CODE\]\s+\S+\s+([A-Z0-9]{8})/gi)];
    const m=matches.at(-1);
    if(!m)throw new Error('El worker no devolvió un código nuevo.');
    res.json({code:m[1]});
  }catch(e){res.status(400).json({error:e.message})}
});
app.post('/subbots/:id/qr',user,async(req,res)=>res.status(501).json({error:'QR quedará habilitado cuando el worker exponga la imagen QR.'}));
app.listen(PORT,'127.0.0.1',()=>console.log(`Subbots API v41.0 en 127.0.0.1:${PORT}`));
