import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAME} from './src/config.mjs';
import {createDatabase} from './src/database.mjs';
import {ensureUser,homeData,createDrop,resolveDrop,collection,leaderboard,tasks,claimTask,profile,setShowcase,sellOwnedUsername,adminOverview,adminAction} from './src/game.mjs';
import {listMarket,createListing,cancelListing,buyListing} from './src/market.mjs';
import {registerReferral,friendsData,giftUsername} from './src/social.mjs';
import {wheelStatus,spinWheel} from './src/wheel.mjs';
import {upgradeInfo,previewUpgrade,performUpgrade} from './src/upgrader.mjs';
import {seasonData} from './src/seasons.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
const BOT_USERNAME=(process.env.BOT_USERNAME||'perekup_app_bot').replace(/^@/,'');
const WEBAPP_URL=process.env.WEBAPP_URL||process.env.APP_URL||process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const ALLOW_DEV_AUTH=process.env.ALLOW_DEV_AUTH==='1';
const ADMIN_IDS=new Set(String(process.env.ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const STORY_DIR=path.join(DATA_DIR,'story-shares');
fs.mkdirSync(STORY_DIR,{recursive:true});
const db=createDatabase(DATA_DIR);
const lastDropAt=new Map();

function securityHeaders(){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org"}}
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...securityHeaders()});res.end(JSON.stringify(payload))}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>3e6){reject(new Error('body_too_large'));req.destroy()}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('bad_json'))}});req.on('error',reject)})}
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
  const raw=String(req.headers['x-telegram-init-data']||''),tg=validateInitData(raw);
  const startParam=String(req.headers['x-start-param']||'');
  if(tg){const u=ensureUser(db,tg);registerReferral(db,u,startParam);return u}
  if(ALLOW_DEV_AUTH){const id=String(req.headers['x-dev-user']||'10001'),u=ensureUser(db,{id:Number(id),username:'dev'+id,first_name:'Dev'});registerReferral(db,u,startParam);return u}
  return null;
}
function isAdmin(user){return ADMIN_IDS.has(String(user.telegram_id))||(ALLOW_DEV_AUTH&&String(user.telegram_id)==='10001')}
function externalOrigin(req){
  const forwardedProto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
  const forwardedHost=String(req.headers['x-forwarded-host']||'').split(',')[0].trim();
  const host=forwardedHost||String(req.headers.host||'').trim();
  if(host&&forwardedProto==='https')return 'https://'+host;
  try{const configured=new URL(WEBAPP_URL);if(configured.protocol==='https:')return configured.origin}catch{}
  if(host&&String(req.socket?.encrypted||'')==='true')return 'https://'+host;
  return '';
}
async function telegramApi(method,payload={}){
  if(!BOT_TOKEN)throw new Error('bot_token_missing');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),35000);
  try{const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctl.signal});const j=await r.json().catch(()=>({ok:false}));if(!r.ok||!j.ok)throw new Error(j.description||'telegram_error');return j.result}finally{clearTimeout(timer)}
}
function publicWebAppUrl(ref=''){try{const u=new URL(WEBAPP_URL);if(u.protocol!=='https:')return '';if(ref)u.searchParams.set('ref',ref);return u.toString()}catch{return ''}}
async function sendStartMessage(chatId,firstName='',ref=''){
  const url=publicWebAppUrl(ref),name=String(firstName||'').trim();
  const text=(name?`Привет, ${name}!\n\n`:'')+'<b>USERNAME</b>\n\nКоллекционируй редкие виртуальные usernames, собирай коллекцию и поднимайся в рейтинге.';
  const payload={chat_id:chatId,text,parse_mode:'HTML'};if(url)payload.reply_markup={inline_keyboard:[[{text:'Открыть игру',web_app:{url}}]]};return telegramApi('sendMessage',payload)
}
async function handleTelegramUpdate(u){
  if(u?.pre_checkout_query){await telegramApi('answerPreCheckoutQuery',{pre_checkout_query_id:u.pre_checkout_query.id,ok:true}).catch(e=>console.error('pre_checkout:',e.message));return}
  const m=u?.message;if(!m)return;
  const payment=m.successful_payment;
  if(payment?.invoice_payload?.startsWith('username_plus:')){
    const parts=payment.invoice_payload.split(':'),tgId=String(parts[1]||'');
    if(String(m.from?.id||'')===tgId){
      const user=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tgId);
      if(user){
        const current=user.premium_until?new Date(user.premium_until).getTime():0,base=Math.max(Date.now(),current),until=new Date(base+30*86400000).toISOString(),ts=new Date().toISOString();
        db.prepare('UPDATE users SET premium_until=? WHERE id=?').run(until,user.id);
        db.prepare('INSERT INTO premium_subscriptions(user_id,active_until,source,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_until=excluded.active_until,source=excluded.source').run(user.id,until,'telegram_stars',ts);
        await telegramApi('sendMessage',{chat_id:m.chat.id,text:'USERNAME+ активирован на 30 дней.'}).catch(()=>{});
      }
    }
  }
  const text=String(m.text||'').trim(),match=text.match(/^\/start(?:@\w+)?(?:\s+([^\s]+))?/i);
  if(m.chat?.id&&match)await sendStartMessage(m.chat.id,m.from?.first_name||'',match[1]||'');
}
let telegramPolling=false;
async function startTelegramPolling(){
  if(telegramPolling||!BOT_TOKEN)return;telegramPolling=true;
  await telegramApi('deleteWebhook',{drop_pending_updates:false}).catch(()=>{});
  const url=publicWebAppUrl();if(url)await telegramApi('setChatMenuButton',{menu_button:{type:'web_app',text:'USERNAME',web_app:{url}}}).catch(()=>{});
  await telegramApi('setMyCommands',{commands:[{command:'start',description:'Открыть USERNAME'}]}).catch(()=>{});
  let offset=0;console.log('Telegram bot polling started');
  while(telegramPolling){try{const ups=await telegramApi('getUpdates',{offset,timeout:25,allowed_updates:['message','pre_checkout_query']});for(const u of ups||[]){offset=Math.max(offset,Number(u.update_id||0)+1);await handleTelegramUpdate(u)}}catch(e){console.error('Telegram polling:',e.message);await new Promise(r=>setTimeout(r,2000))}}
}

function giftOptions(user){
  const items=db.prepare("SELECT id,handle,rarity,value FROM username_instances WHERE owner_id=? AND status='owned' ORDER BY value DESC LIMIT 100").all(user.id).map(x=>({...x,handle:'@'+x.handle}));
  const friends=db.prepare('SELECT u.id,u.username,u.first_name FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.first_name,u.username').all(user.id);
  return {items,friends};
}
async function api(req,res,url){
  try{
    const user=auth(req);if(!user)return json(res,401,{error:'unauthorized'});if(user.blocked)return json(res,403,{error:'blocked'});
    if(req.method==='GET'&&url.pathname==='/api/home')return json(res,200,homeData(db,user));
    if(req.method==='POST'&&url.pathname==='/api/story-share'){
      const b=await readBody(req),instanceId=String(b.instanceId||''),dataUrl=String(b.dataUrl||'');
      const inst=db.prepare('SELECT id,handle,owner_id FROM username_instances WHERE id=? AND owner_id=?').get(instanceId,user.id);
      if(!inst)throw new Error('not_owned');
      const match=dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('bad_story_image');
      const bytes=Buffer.from(match[1],'base64');if(bytes.length<1000||bytes.length>1600000||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('bad_story_image');
      const token=crypto.randomBytes(18).toString('hex'),filename=token+'.jpg',file=path.join(STORY_DIR,filename);
      fs.writeFileSync(file,bytes);
      try{for(const name of fs.readdirSync(STORY_DIR)){const p=path.join(STORY_DIR,name),st=fs.statSync(p);if(Date.now()-st.mtimeMs>24*3600000)fs.unlinkSync(p)}}catch{}
      const origin=externalOrigin(req),mediaUrl=origin?new URL('/story/'+filename,origin).toString():'';
      if(!mediaUrl){try{fs.unlinkSync(file)}catch{};throw new Error('story_https_required')}
      return json(res,200,{ok:true,mediaUrl});
    }
    if(req.method==='POST'&&url.pathname==='/api/drop'){
      const b=await readBody(req),requestId=String(b.requestId||''),replay=db.prepare('SELECT 1 FROM drop_requests WHERE request_id=? AND user_id=?').get(requestId,user.id);
      if(!replay){const t=Date.now(),last=lastDropAt.get(user.id)||0;if(t-last<GAME.dropRateLimitMs)return json(res,429,{error:'too_fast'});lastDropAt.set(user.id,t)}
      return json(res,200,createDrop(db,user,requestId,String(b.tier||'basic')));
    }
    const resolve=url.pathname.match(/^\/api\/drop\/([^/]+)\/resolve$/);if(req.method==='POST'&&resolve){const b=await readBody(req);return json(res,200,resolveDrop(db,user,resolve[1],b.action))}
    if(req.method==='GET'&&url.pathname==='/api/collection')return json(res,200,collection(db,user,{rarity:url.searchParams.get('rarity')||'ALL',sort:url.searchParams.get('sort')||'new',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='GET'&&url.pathname==='/api/leaderboard')return json(res,200,{items:leaderboard(db,url.searchParams.get('mode')||'collection',url.searchParams.get('period')||'all')});
    if(req.method==='GET'&&url.pathname==='/api/tasks')return json(res,200,{items:tasks(db,user)});
    const claim=url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);if(req.method==='POST'&&claim)return json(res,200,claimTask(db,user,claim[1]));
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,{profile:profile(db,user.id)});
    const other=url.pathname.match(/^\/api\/profile\/(\d+)$/);if(req.method==='GET'&&other){const p=profile(db,Number(other[1]));return p?json(res,200,{profile:p}):json(res,404,{error:'user_not_found'})}
    const showcase=url.pathname.match(/^\/api\/showcase\/([^/]+)$/);if(req.method==='POST'&&showcase){setShowcase(db,user,showcase[1]);return json(res,200,{ok:true})}
    const collectionSell=url.pathname.match(/^\/api\/collection\/([^/]+)\/sell$/);if(req.method==='POST'&&collectionSell)return json(res,200,sellOwnedUsername(db,user,collectionSell[1]));

    if(req.method==='GET'&&url.pathname==='/api/market')return json(res,200,listMarket(db,{rarity:url.searchParams.get('rarity')||'ALL',sort:url.searchParams.get('sort')||'new',q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='POST'&&url.pathname==='/api/market'){const b=await readBody(req);return json(res,200,createListing(db,user,String(b.instanceId||''),b.price))}
    const buy=url.pathname.match(/^\/api\/market\/([^/]+)\/buy$/);if(req.method==='POST'&&buy)return json(res,200,buyListing(db,user,buy[1]));
    const cancel=url.pathname.match(/^\/api\/market\/([^/]+)\/cancel$/);if(req.method==='POST'&&cancel)return json(res,200,cancelListing(db,user,cancel[1]));

    if(req.method==='GET'&&url.pathname==='/api/friends')return json(res,200,friendsData(db,user,BOT_USERNAME));
    if(req.method==='GET'&&url.pathname==='/api/gift/options')return json(res,200,giftOptions(user));
    if(req.method==='POST'&&url.pathname==='/api/gift'){const b=await readBody(req);return json(res,200,giftUsername(db,user,String(b.instanceId||''),Number(b.friendId)))}

    if(req.method==='GET'&&url.pathname==='/api/wheel')return json(res,200,wheelStatus(db,user));
    if(req.method==='POST'&&url.pathname==='/api/wheel'){const b=await readBody(req);return json(res,200,spinWheel(db,user,String(b.requestId||'')))}

    if(req.method==='GET'&&url.pathname==='/api/upgrader')return json(res,200,upgradeInfo(db,user));
    if(req.method==='POST'&&url.pathname==='/api/upgrader/preview'){const b=await readBody(req);return json(res,200,previewUpgrade(db,user,b.ids))}
    if(req.method==='POST'&&url.pathname==='/api/upgrader'){const b=await readBody(req);return json(res,200,performUpgrade(db,user,b.ids,String(b.sessionId||'')))}

    if(req.method==='GET'&&url.pathname==='/api/seasons')return json(res,200,{season:seasonData(db,user)});

    if(req.method==='GET'&&url.pathname==='/api/premium')return json(res,200,{active:!!user.premium_until&&new Date(user.premium_until)>new Date(),activeUntil:user.premium_until,name:'USERNAME+',stars:50,features:['Расширенная коллекция','6 слотов витрины','История дропов','Темы профиля','Дополнительные фильтры рынка','История сделок','Без рекламы'],starsEnabled:!!BOT_TOKEN});
    if(req.method==='POST'&&url.pathname==='/api/premium/invoice'){if(!BOT_TOKEN)return json(res,503,{error:'premium_unavailable'});const invoice=await telegramApi('createInvoiceLink',{title:'USERNAME+',description:'USERNAME+ на 30 дней. Не влияет на шансы дропа, колесо или апгрейдер.',payload:`username_plus:${user.telegram_id}:${crypto.randomUUID()}`,currency:'XTR',prices:[{label:'USERNAME+ • 30 дней',amount:50}]});return json(res,200,{invoice,stars:50})}

    if(url.pathname==='/api/admin/overview'&&req.method==='GET'){if(!isAdmin(user))return json(res,403,{error:'forbidden'});return json(res,200,adminOverview(db))}
    const aa=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(balance|block)$/);if(req.method==='POST'&&aa){if(!isAdmin(user))return json(res,403,{error:'forbidden'});const b=await readBody(req);adminAction(db,user,Number(aa[1]),aa[2],b.value);return json(res,200,{ok:true})}
    return json(res,404,{error:'not_found'});
  }catch(e){
    console.error(e);
    const code={insufficient_funds:409,pending_drop:409,collection_full:409,recipient_full:409,sold_out:409,already_claimed:409,task_not_done:409,showcase_full:409,not_owned:404,pending_not_found:404,listing_not_found:404,own_listing:409,already_listed:409,bad_price:400,not_friend:403,wheel_cooldown:409,bad_upgrade:400,upgrade_invalid_items:409,upgrade_bad_recipe:409,upgrade_unavailable:409,upgrade_session_expired:409,upgrade_session_mismatch:409,bad_story_image:400,story_https_required:503,body_too_large:413,bad_json:400,bad_request_id:400,premium_unavailable:503}[e.message]||500;
    return json(res,code,{error:e.message||'server_error'});
  }
}
function serveStoryImage(req,res,url){
  const m=url.pathname.match(/^\/story\/([a-f0-9]{36})\.jpg$/);if(!m){res.writeHead(404);return res.end('Not found')}
  const file=path.join(STORY_DIR,m[1]+'.jpg');
  fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':st.size,'Cache-Control':'public, max-age=86400','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(file).pipe(res);
  });
}
function serveStatic(req,res,url){
  let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);rel=path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');
  const root=path.join(__dirname,'public'),file=path.join(root,rel);if(!file.startsWith(root)){res.writeHead(403);return res.end()}
  fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Expires':'0',...securityHeaders()});fs.createReadStream(file).pipe(res)})
}
const server=http.createServer((req,res)=>{const url=new URL(req.url,WEBAPP_URL);if(url.pathname==='/healthz')return json(res,200,{ok:true,service:'username',version:GAME.version,botConfigured:!!BOT_TOKEN,telegramPolling});if(url.pathname.startsWith('/story/'))return serveStoryImage(req,res,url);if(url.pathname.startsWith('/api/'))return api(req,res,url);return serveStatic(req,res,url)});
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)server.listen(PORT,()=>{console.log(`USERNAME v${GAME.version} running on http://localhost:${PORT}`);startTelegramPolling().catch(e=>console.error('Telegram bot fatal:',e))});
export {validateInitData};
