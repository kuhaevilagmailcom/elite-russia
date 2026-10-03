import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAME} from './src/config.mjs';
import {createDatabase} from './src/database.mjs';
import {ensureUser,homeData,createDrop,resolveDrop,collection,leaderboard,tasks,claimTask,profile,setShowcase,adminOverview,adminAction} from './src/game.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
const BOT_USERNAME=(process.env.BOT_USERNAME||'UsernameGameBot').replace(/^@/,'');
const WEBAPP_URL=process.env.WEBAPP_URL||process.env.APP_URL||process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const ALLOW_DEV_AUTH=process.env.ALLOW_DEV_AUTH==='1';
const ADMIN_IDS=new Set(String(process.env.ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const db=createDatabase(DATA_DIR);
const lastDropAt=new Map();

function securityHeaders(){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org"}}
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...securityHeaders()});res.end(JSON.stringify(payload))}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6){reject(new Error('body_too_large'));req.destroy()}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('bad_json'))}});req.on('error',reject)})}
function validateInitData(initData){
  if(!initData||!BOT_TOKEN)return null;
  const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash)return null;p.delete('hash');
  const lines=[];for(const [k,v] of p.entries())lines.push(`${k}=${v}`);lines.sort();
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calc=crypto.createHmac('sha256',secret).update(lines.join('\n')).digest('hex');
  if(calc.length!==hash.length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))return null;
  const authDate=Number(p.get('auth_date')||0);if(!authDate||Math.abs(Date.now()/1000-authDate)>86400)return null;
  try{return JSON.parse(p.get('user')||'{}')}catch{return null}
}
function auth(req){
  const tg=validateInitData(String(req.headers['x-telegram-init-data']||''));
  if(tg)return ensureUser(db,tg);
  if(ALLOW_DEV_AUTH){
    const id=String(req.headers['x-dev-user']||'10001');
    return ensureUser(db,{id:Number(id),username:'dev'+id,first_name:'Dev'});
  }
  return null;
}
function isAdmin(user){return ADMIN_IDS.has(String(user.telegram_id))||(ALLOW_DEV_AUTH&&String(user.telegram_id)==='10001')}
async function telegramApi(method,payload={}){
  if(!BOT_TOKEN)throw new Error('bot_token_missing');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),35000);
  try{const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctl.signal});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.description||'telegram_error');return j.result}finally{clearTimeout(timer)}
}
function publicWebAppUrl(){try{const u=new URL(WEBAPP_URL);return u.protocol==='https:'?u.toString():''}catch{return ''}}
async function sendStartMessage(chatId,firstName=''){
  const url=publicWebAppUrl(),name=String(firstName||'').trim();
  const text=(name?`Привет, ${name}!\n\n`:'')+'<b>USERNAME</b>\n\nКоллекционируй редкие виртуальные usernames, собирай коллекцию и поднимайся в рейтинге.';
  const payload={chat_id:chatId,text,parse_mode:'HTML'};if(url)payload.reply_markup={inline_keyboard:[[{text:'Открыть игру',web_app:{url}}]]};return telegramApi('sendMessage',payload)
}
let telegramPolling=false;
async function startTelegramPolling(){
  if(telegramPolling||!BOT_TOKEN)return;telegramPolling=true;
  await telegramApi('deleteWebhook',{drop_pending_updates:false}).catch(()=>{});
  const url=publicWebAppUrl();if(url)await telegramApi('setChatMenuButton',{menu_button:{type:'web_app',text:'USERNAME',web_app:{url}}}).catch(()=>{});
  await telegramApi('setMyCommands',{commands:[{command:'start',description:'Открыть USERNAME'}]}).catch(()=>{});
  let offset=0;console.log('Telegram bot polling started');
  while(telegramPolling){try{const ups=await telegramApi('getUpdates',{offset,timeout:25,allowed_updates:['message']});for(const u of ups||[]){offset=Math.max(offset,Number(u.update_id||0)+1);const m=u.message;if(m?.chat?.id&&/^\/start(?:@\w+)?(?:\s|$)/i.test(String(m.text||'')))await sendStartMessage(m.chat.id,m.from?.first_name||'')}}catch(e){console.error('Telegram polling:',e.message);await new Promise(r=>setTimeout(r,2000))}}
}

async function api(req,res,url){
  try{
    const user=auth(req);if(!user)return json(res,401,{error:'unauthorized'});if(user.blocked)return json(res,403,{error:'blocked'});
    if(req.method==='GET'&&url.pathname==='/api/home')return json(res,200,homeData(db,user));
    if(req.method==='POST'&&url.pathname==='/api/drop'){
      const b=await readBody(req),requestId=String(b.requestId||'');
      const replay=db.prepare('SELECT 1 FROM drop_requests WHERE request_id=? AND user_id=?').get(requestId,user.id);
      if(!replay){const t=Date.now(),last=lastDropAt.get(user.id)||0;if(t-last<GAME.dropRateLimitMs)return json(res,429,{error:'too_fast'});lastDropAt.set(user.id,t)}
      return json(res,200,createDrop(db,user,requestId));
    }
    const resolve=url.pathname.match(/^\/api\/drop\/([^/]+)\/resolve$/);if(req.method==='POST'&&resolve){const b=await readBody(req);return json(res,200,resolveDrop(db,user,resolve[1],b.action))}
    if(req.method==='GET'&&url.pathname==='/api/collection')return json(res,200,collection(db,user,{rarity:url.searchParams.get('rarity')||'ALL',sort:url.searchParams.get('sort')||'new',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='GET'&&url.pathname==='/api/leaderboard')return json(res,200,{items:leaderboard(db,url.searchParams.get('mode')||'collection')});
    if(req.method==='GET'&&url.pathname==='/api/tasks')return json(res,200,{items:tasks(db,user)});
    const claim=url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);if(req.method==='POST'&&claim)return json(res,200,claimTask(db,user,claim[1]));
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,{profile:profile(db,user.id)});
    const other=url.pathname.match(/^\/api\/profile\/(\d+)$/);if(req.method==='GET'&&other){const p=profile(db,Number(other[1]));return p?json(res,200,{profile:p}):json(res,404,{error:'user_not_found'})}
    const showcase=url.pathname.match(/^\/api\/showcase\/([^/]+)$/);if(req.method==='POST'&&showcase){setShowcase(db,user,showcase[1]);return json(res,200,{ok:true})}
    if(req.method==='GET'&&url.pathname==='/api/premium')return json(res,200,{active:!!user.premium_until&&new Date(user.premium_until)>new Date(),name:'USERNAME+',features:['Расширенная коллекция','6 слотов витрины','История дропов','Темы профиля','Без рекламы'],starsEnabled:false});
    if(url.pathname==='/api/admin/overview'&&req.method==='GET'){if(!isAdmin(user))return json(res,403,{error:'forbidden'});return json(res,200,adminOverview(db))}
    const aa=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(balance|block)$/);if(req.method==='POST'&&aa){if(!isAdmin(user))return json(res,403,{error:'forbidden'});const b=await readBody(req);adminAction(db,user,Number(aa[1]),aa[2],b.value);return json(res,200,{ok:true})}
    return json(res,404,{error:'not_found'});
  }catch(e){console.error(e);const code={insufficient_funds:409,pending_drop:409,collection_full:409,sold_out:409,already_claimed:409,task_not_done:409,bad_json:400,bad_request_id:400}[e.message]||500;return json(res,code,{error:e.message||'server_error'})}
}
function serveStatic(req,res,url){
  let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);rel=path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');
  const root=path.join(__dirname,'public'),file=path.join(root,rel);if(!file.startsWith(root)){res.writeHead(403);return res.end()}
  fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Expires':'0',...securityHeaders()});fs.createReadStream(file).pipe(res)})
}
const server=http.createServer((req,res)=>{const url=new URL(req.url,WEBAPP_URL);if(url.pathname==='/healthz')return json(res,200,{ok:true,service:'username',version:GAME.version,botConfigured:!!BOT_TOKEN,telegramPolling});if(url.pathname.startsWith('/api/'))return api(req,res,url);return serveStatic(req,res,url)});
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)server.listen(PORT,()=>{console.log(`USERNAME v${GAME.version} running on http://localhost:${PORT}`);startTelegramPolling().catch(e=>console.error('Telegram bot fatal:',e))});
export {validateInitData};
