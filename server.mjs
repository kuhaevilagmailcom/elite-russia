import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAME} from './src/config.mjs';
import {createDatabase} from './src/database.mjs';
import {ensureUser,homeData,createDrop,resolveDrop,collection,leaderboard,tasks,claimTask,profile,setShowcase,sellOwnedUsername} from './src/game.mjs';
import {listMarket,createListing,cancelListing,buyListing} from './src/market.mjs';
import {registerReferral,friendsData,giftUsername} from './src/social.mjs';
import {wheelStatus,spinWheel} from './src/wheel.mjs';
import {upgradeInfo,previewUpgrade,performUpgrade,cleanupUpgradeSessions} from './src/upgrader.mjs';
import {seasonData,ensureSeasonLifecycle} from './src/seasons.mjs';
import {PREMIUM_STARS,validPremiumCheckout,applyPremiumPayment} from './src/payments.mjs';
import {adminOverview,adminUserDetail,adminSetBalance,adminSetBlocked,adminRemoveUsername,adminTransferUsername,adminAddUsername,adminSetUsernameValue,resetSingleUser,resetAllUsers} from './src/admin.mjs';
import {BOT_COMMANDS,BOT_DESCRIPTION,BOT_SHORT_DESCRIPTION,escapeTelegramHtml,startMessage,helpMessage,gameKeyboard} from './src/bot-ui.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
let BOT_USERNAME=(process.env.BOT_USERNAME||'').replace(/^@/,'');
const WEBAPP_URL=process.env.WEBAPP_URL||process.env.APP_URL||process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const NODE_ENV=process.env.NODE_ENV||'development';
const ALLOW_DEV_AUTH=process.env.ALLOW_DEV_AUTH==='1';
const DEV_ADMIN=process.env.DEV_ADMIN==='1';
const TRUST_PROXY=process.env.TRUST_PROXY==='1';
const INSTANCE_ID=crypto.randomUUID();
if(NODE_ENV==='production'&&ALLOW_DEV_AUTH)throw new Error('ALLOW_DEV_AUTH must be disabled in production');
const DEFAULT_ADMIN_IDS=['8464597898','1141626866'];
const ADMIN_IDS=new Set([...DEFAULT_ADMIN_IDS,...String(process.env.ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean)]);
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const STORY_DIR=path.join(DATA_DIR,'story-shares');
fs.mkdirSync(STORY_DIR,{recursive:true});
const db=createDatabase(DATA_DIR);
const lastDropAt=new Map();
const rateBuckets=new Map();
const leaderboardCache=new Map();
function invalidateLeaderboard(){leaderboardCache.clear()}

function rateLimit(userId,key,limit,windowMs){
  const k=String(userId)+':'+key,now=Date.now(),row=rateBuckets.get(k);
  if(!row||now-row.started>=windowMs){rateBuckets.set(k,{started:now,count:1});return true}
  if(row.count>=limit)return false;row.count++;return true;
}
function cleanupRateBuckets(){const now=Date.now();for(const [k,v] of rateBuckets){if(now-v.started>10*60*1000)rateBuckets.delete(k)}}
function cleanupStoryFiles(){
  const cutoff=Date.now()-Number(GAME.storyTtlMs||86400000);
  try{for(const name of fs.readdirSync(STORY_DIR)){const p=path.join(STORY_DIR,name),st=fs.statSync(p);if(st.mtimeMs<cutoff)fs.unlinkSync(p)}}catch(e){console.error('Story cleanup:',e.message)}
}
async function backupDatabase(label=''){
  const dir=path.join(DATA_DIR,'backups');fs.mkdirSync(dir,{recursive:true});
  const day=new Date().toISOString().slice(0,10),safe=String(label||'username-'+day).replace(/[^a-z0-9._-]/gi,'-'),target=path.join(dir,safe+'.sqlite');
  try{
    if(!fs.existsSync(target))await db.backup(target);
    const files=fs.readdirSync(dir).filter(x=>/\.sqlite$/.test(x)).sort((a,b)=>fs.statSync(path.join(dir,b)).mtimeMs-fs.statSync(path.join(dir,a)).mtimeMs);
    for(const old of files.slice(12))fs.unlinkSync(path.join(dir,old));
    return target;
  }catch(e){console.error('Backup:',e.message);throw e}
}
function maintenance(){
  cleanupRateBuckets();cleanupStoryFiles();cleanupUpgradeSessions(db);ensureSeasonLifecycle(db);invalidateLeaderboard();
}
maintenance();
setInterval(maintenance,10*60*1000).unref?.();
setInterval(()=>backupDatabase(),24*60*60*1000).unref?.();
backupDatabase();

function securityHeaders(){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org"}}
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
  if(tg){
    const verifiedStart=String(new URLSearchParams(raw).get('start_param')||'');
    const u=ensureUser(db,tg);registerReferral(db,u,verifiedStart);if(verifiedStart)invalidateLeaderboard();return u;
  }
  if(ALLOW_DEV_AUTH){
    const rawDev=req.headers['x-dev-user'];if(!rawDev)return null;
    const id=String(rawDev),u=ensureUser(db,{id:Number(id),username:'dev'+id,first_name:'Dev'});
    const devStart=String(req.headers['x-start-param']||'');registerReferral(db,u,devStart);if(devStart)invalidateLeaderboard();return u;
  }
  return null;
}
function isAdmin(user){return ADMIN_IDS.has(String(user.telegram_id))||(ALLOW_DEV_AUTH&&DEV_ADMIN&&String(user.telegram_id)==='10001')}
function externalOrigin(req){
  try{const configured=new URL(WEBAPP_URL);if(configured.protocol==='https:')return configured.origin}catch{}
  if(TRUST_PROXY){
    const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
    const host=String(req.headers['x-forwarded-host']||'').split(',')[0].trim();
    if(proto==='https'&&/^[a-z0-9.-]+(?::\d+)?$/i.test(host))return 'https://'+host;
  }
  const host=String(req.headers.host||'').trim();
  if(req.socket?.encrypted&&/^[a-z0-9.-]+(?::\d+)?$/i.test(host))return 'https://'+host;
  return '';
}
async function telegramApi(method,payload={}){
  if(!BOT_TOKEN)throw new Error('bot_token_missing');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),35000);
  try{const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctl.signal});const j=await r.json().catch(()=>({ok:false}));if(!r.ok||!j.ok)throw new Error(j.description||'telegram_error');return j.result}finally{clearTimeout(timer)}
}
function publicWebAppUrl(ref=''){try{const u=new URL(WEBAPP_URL);if(u.protocol!=='https:')return '';if(ref)u.searchParams.set('ref',ref);return u.toString()}catch{return ''}}
async function sendBotMenuMessage(chatId,text,url,label){
  const payload={chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true},keyboard=gameKeyboard(url,label);
  if(keyboard)payload.reply_markup=keyboard;
  return telegramApi('sendMessage',payload);
}
async function sendStartMessage(chatId,firstName='',ref=''){
  return sendBotMenuMessage(chatId,startMessage(firstName),publicWebAppUrl(ref),'🎮 Начать играть');
}
async function sendHelpMessage(chatId){
  return sendBotMenuMessage(chatId,helpMessage(),publicWebAppUrl(),'🎮 Начать играть');
}
async function handleTelegramUpdate(u){
  if(u?.pre_checkout_query){
    const q=u.pre_checkout_query,ok=validPremiumCheckout(q);
    await telegramApi('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(!ok?{error_message:'Платёж не прошёл проверку. Откройте USERNAME и создайте новый счёт.'}:{})}).catch(e=>console.error('pre_checkout:',e.message));
    return;
  }
  const m=u?.message;if(!m)return;
  const payment=m.successful_payment;
  if(payment){
    const result=applyPremiumPayment(m,payment);
    if(result.applied)await telegramApi('sendMessage',{chat_id:m.chat.id,text:'USERNAME+ активирован на 30 дней.'}).catch(()=>{});
  }
  const text=String(m.text||'').trim(),start=text.match(/^\/start(?:@\w+)?(?:\s+([^\s]+))?$/i);
  if(!m.chat?.id)return;
  if(start)return sendStartMessage(m.chat.id,m.from?.first_name||'',start[1]||'');
  if(/^\/play(?:@\w+)?$/i.test(text)||/^🎮?\s*(?:открыть|начать) игру$/i.test(text))return sendBotMenuMessage(m.chat.id,'<b>USERNAME</b> уже ждёт тебя. Нажимай кнопку и заходи в игру 👇',publicWebAppUrl(),'🎮 Начать играть');
  if(/^\/help(?:@\w+)?$/i.test(text))return sendHelpMessage(m.chat.id);
}
let telegramPolling=false;
function acquirePollLease(){
  const now=Date.now(),expires=new Date(now+70000).toISOString(),current=db.prepare('SELECT * FROM runtime_locks WHERE name=?').get('telegram_polling');
  if(current&&current.owner!==INSTANCE_ID&&new Date(current.expires_at).getTime()>now)return false;
  db.prepare('INSERT INTO runtime_locks(name,owner,expires_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at').run('telegram_polling',INSTANCE_ID,expires);
  return true;
}
function refreshPollLease(){db.prepare('UPDATE runtime_locks SET expires_at=? WHERE name=? AND owner=?').run(new Date(Date.now()+70000).toISOString(),'telegram_polling',INSTANCE_ID)}
async function resolveBotUsername(){
  if(!BOT_TOKEN)return;
  try{
    const me=await telegramApi('getMe'),resolved=String(me?.username||'').replace(/^@/,'');
    if(resolved)BOT_USERNAME=resolved;
  }catch(e){console.error('Bot username:',e.message)}
}
async function configureTelegramBot(){
  const url=publicWebAppUrl(),steps=[
    ['commands',()=>telegramApi('setMyCommands',{commands:BOT_COMMANDS})],
    ['description',()=>telegramApi('setMyDescription',{description:BOT_DESCRIPTION})],
    ['short description',()=>telegramApi('setMyShortDescription',{short_description:BOT_SHORT_DESCRIPTION})],
    ['menu button',()=>telegramApi('setChatMenuButton',{menu_button:url?{type:'web_app',text:'🎮 Начать играть',web_app:{url}}:{type:'commands'}})]
  ];
  const configured=[],failed=[];
  for(const [name,run] of steps){try{await run();configured.push(name)}catch(e){failed.push(name);console.error(`Telegram ${name}:`,e.message)}}
  if(!url)console.warn('Telegram Web App button disabled: WEBAPP_URL must be a public HTTPS URL');
  return {url,configured,failed};
}
async function notifyAdminsBotRestarted(){
  const text='🟢 <b>Бот перезапущен</b>\n\n'+
    `Версия: <code>${escapeTelegramHtml(GAME.version)}</code>\n`+
    `Время: ${escapeTelegramHtml(new Date().toLocaleString('ru-RU',{timeZone:'Asia/Yekaterinburg'}))} (ЕКБ)`;
  for(const chatId of ADMIN_IDS){
    try{await telegramApi('sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true})}
    catch(e){console.error(`Telegram admin notification ${chatId}:`,e.message)}
  }
}
async function startTelegramPolling(){
  if(telegramPolling||!BOT_TOKEN)return;if(!acquirePollLease()){console.log('Telegram polling lease held by another instance');return}
  telegramPolling=true;await resolveBotUsername();
  await telegramApi('deleteWebhook',{drop_pending_updates:false}).catch(()=>{});
  await notifyAdminsBotRestarted();
  await configureTelegramBot();
  let offset=0,lastLease=0;console.log('Telegram bot polling started');
  while(telegramPolling){
    try{
      if(Date.now()-lastLease>20000){refreshPollLease();lastLease=Date.now()}
      const ups=await telegramApi('getUpdates',{offset,timeout:25,allowed_updates:['message','pre_checkout_query']});
      for(const u of ups||[]){offset=Math.max(offset,Number(u.update_id||0)+1);await handleTelegramUpdate(u)}
    }catch(e){console.error('Telegram polling:',e.message);await new Promise(r=>setTimeout(r,2000))}
  }
}
function giftOptions(user){
  const items=db.prepare("SELECT id,handle,rarity,value FROM username_instances WHERE owner_id=? AND status='owned' ORDER BY value DESC LIMIT 100").all(user.id).map(x=>({...x,handle:'@'+x.handle}));
  const friends=db.prepare('SELECT u.id,u.username,u.first_name FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.first_name,u.username').all(user.id);
  return {items,friends};
}
async function api(req,res,url){
  try{
    const user=auth(req);if(!user)return json(res,401,{error:'unauthorized'});if(user.blocked)return json(res,403,{error:'blocked'});
    ensureSeasonLifecycle(db);
    if(!rateLimit(user.id,'global',120,60000))return json(res,429,{error:'rate_limited'});
    if(req.method==='GET'&&url.pathname==='/api/home'){const h=homeData(db,user);h.user.isAdmin=isAdmin(user);return json(res,200,h)}
    if(req.method==='POST'&&url.pathname==='/api/story-share'){
      if(!rateLimit(user.id,'story',3,60000))return json(res,429,{error:'rate_limited'});
      const b=await readBody(req),instanceId=String(b.instanceId||''),dataUrl=String(b.dataUrl||'');
      const inst=db.prepare('SELECT id,handle,owner_id FROM username_instances WHERE id=? AND owner_id=?').get(instanceId,user.id);
      if(!inst)throw new Error('not_owned');
      const match=dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('bad_story_image');
      const bytes=Buffer.from(match[1],'base64');if(bytes.length<1000||bytes.length>1600000||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('bad_story_image');
      const token=crypto.randomBytes(18).toString('hex'),filename=token+'.jpg',file=path.join(STORY_DIR,filename);
      fs.writeFileSync(file,bytes);
      const mediaPath='/story/'+filename,origin=externalOrigin(req),mediaUrl=origin?new URL(mediaPath,origin).toString():null;
      return json(res,200,{ok:true,mediaPath,mediaUrl});
    }
    if(req.method==='POST'&&url.pathname==='/api/drop'){
      const b=await readBody(req),requestId=String(b.requestId||''),replay=db.prepare('SELECT 1 FROM drop_requests WHERE request_id=? AND user_id=?').get(requestId,user.id);
      if(!replay){const t=Date.now(),last=lastDropAt.get(user.id)||0;if(t-last<GAME.dropRateLimitMs)return json(res,429,{error:'too_fast'});lastDropAt.set(user.id,t)}
      const result=createDrop(db,user,requestId,String(b.tier||'basic'));invalidateLeaderboard();return json(res,200,result);
    }
    const resolve=url.pathname.match(/^\/api\/drop\/([^/]+)\/resolve$/);if(req.method==='POST'&&resolve){const b=await readBody(req),result=resolveDrop(db,user,resolve[1],b.action);invalidateLeaderboard();return json(res,200,result)}
    if(req.method==='GET'&&url.pathname==='/api/collection')return json(res,200,collection(db,user,{sort:url.searchParams.get('sort')||'new',digits:url.searchParams.get('digits')||'all',showcase:url.searchParams.get('showcase')||'all',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='GET'&&url.pathname==='/api/leaderboard'){
      const key='capital',cached=leaderboardCache.get(key);
      if(cached&&Date.now()-cached.ts<30000)return json(res,200,{items:cached.items});
      const items=leaderboard(db);leaderboardCache.set(key,{ts:Date.now(),items});return json(res,200,{items});
    }
    if(req.method==='GET'&&url.pathname==='/api/tasks')return json(res,200,{items:tasks(db,user)});
    const claim=url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);if(req.method==='POST'&&claim){const result=claimTask(db,user,claim[1]);invalidateLeaderboard();return json(res,200,result)}
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,{profile:profile(db,user.id)});
    const other=url.pathname.match(/^\/api\/profile\/(\d+)$/);if(req.method==='GET'&&other){const p=profile(db,Number(other[1]));return p?json(res,200,{profile:p}):json(res,404,{error:'user_not_found'})}
    const showcase=url.pathname.match(/^\/api\/showcase\/([^/]+)$/);if(req.method==='POST'&&showcase){return json(res,200,setShowcase(db,user,showcase[1]))}
    const collectionSell=url.pathname.match(/^\/api\/collection\/([^/]+)\/sell$/);if(req.method==='POST'&&collectionSell){const result=sellOwnedUsername(db,user,collectionSell[1]);invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/market')return json(res,200,listMarket(db,{sort:url.searchParams.get('sort')||'new',digits:url.searchParams.get('digits')||'all',q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='POST'&&url.pathname==='/api/market'){const b=await readBody(req),result=createListing(db,user,String(b.instanceId||''),b.price);invalidateLeaderboard();return json(res,200,result)}
    const buy=url.pathname.match(/^\/api\/market\/([^/]+)\/buy$/);if(req.method==='POST'&&buy){const result=buyListing(db,user,buy[1]);invalidateLeaderboard();return json(res,200,result)}
    const cancel=url.pathname.match(/^\/api\/market\/([^/]+)\/cancel$/);if(req.method==='POST'&&cancel){const result=cancelListing(db,user,cancel[1]);invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/friends'){if(!BOT_USERNAME&&BOT_TOKEN)await resolveBotUsername();return json(res,200,friendsData(db,user,BOT_USERNAME))}
    if(req.method==='GET'&&url.pathname==='/api/gift/options')return json(res,200,giftOptions(user));
    if(req.method==='POST'&&url.pathname==='/api/gift'){const b=await readBody(req),result=giftUsername(db,user,String(b.instanceId||''),Number(b.friendId));invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/wheel')return json(res,200,wheelStatus(db,user));
    if(req.method==='POST'&&url.pathname==='/api/wheel'){const b=await readBody(req),result=spinWheel(db,user,String(b.requestId||''));invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/upgrader')return json(res,200,upgradeInfo(db,user));
    if(req.method==='POST'&&url.pathname==='/api/upgrader/preview'){if(!rateLimit(user.id,'upgrade_preview',20,60000))return json(res,429,{error:'rate_limited'});const b=await readBody(req);return json(res,200,previewUpgrade(db,user,b.ids))}
    if(req.method==='POST'&&url.pathname==='/api/upgrader'){const b=await readBody(req),result=performUpgrade(db,user,b.ids,String(b.sessionId||''));invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/seasons')return json(res,200,{season:seasonData(db,user)});

    if(req.method==='GET'&&url.pathname==='/api/premium')return json(res,200,{active:!!user.premium_until&&new Date(user.premium_until)>new Date(),activeUntil:user.premium_until,name:'USERNAME+',stars:50,features:['Коллекция до 300 usernames','6 слотов витрины'],starsEnabled:!!BOT_TOKEN});
    if(req.method==='POST'&&url.pathname==='/api/premium/invoice'){if(!BOT_TOKEN)return json(res,503,{error:'premium_unavailable'});const invoice=await telegramApi('createInvoiceLink',{title:'USERNAME+',description:'USERNAME+ на 30 дней. Не влияет на шансы дропа, колесо или апгрейдер.',payload:`username_plus:${user.telegram_id}:${crypto.randomUUID()}`,currency:'XTR',prices:[{label:'USERNAME+ • 30 дней',amount:PREMIUM_STARS}]});return json(res,200,{invoice,stars:PREMIUM_STARS})}

    if(url.pathname==='/api/admin/overview'&&req.method==='GET'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      return json(res,200,adminOverview(db,{q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1),size:Number(url.searchParams.get('size')||20)}));
    }
    const adminUser=url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if(req.method==='GET'&&adminUser){if(!isAdmin(user))return json(res,403,{error:'forbidden'});return json(res,200,adminUserDetail(db,Number(adminUser[1])))}
    const adminActionRoute=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(balance|block|reset|add-username)$/);
    if(req.method==='POST'&&adminActionRoute){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});const targetId=Number(adminActionRoute[1]),action=adminActionRoute[2],b=await readBody(req);let result;
      if(action==='balance')result=adminSetBalance(db,user,targetId,b.delta);
      if(action==='block')result=adminSetBlocked(db,user,targetId,!!b.value);
      if(action==='reset')result=resetSingleUser(db,user,targetId);
      if(action==='add-username')result=adminAddUsername(db,user,targetId,b.handle,b.value);
      invalidateLeaderboard();return json(res,200,result);
    }
    const adminUsername=url.pathname.match(/^\/api\/admin\/usernames\/([^/]+)\/(remove|transfer|value)$/);
    if(req.method==='POST'&&adminUsername){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});const b=await readBody(req),id=adminUsername[1],action=adminUsername[2];let result;
      if(action==='remove')result=adminRemoveUsername(db,user,id);
      if(action==='transfer')result=adminTransferUsername(db,user,id,Number(b.targetId));
      if(action==='value')result=adminSetUsernameValue(db,user,id,b.value);
      invalidateLeaderboard();return json(res,200,result);
    }
    if(req.method==='POST'&&url.pathname==='/api/admin/reset-all'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});const b=await readBody(req);
      if(String(b.confirmation||'')!=='RESET USERNAME')throw new Error('reset_confirmation_required');
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');await backupDatabase('pre-full-reset-'+stamp);
      const result=resetAllUsers(db,user,b.confirmation),integrity=db.pragma('integrity_check',{simple:true});
      if(String(integrity).toLowerCase()!=='ok')throw new Error('sqlite_integrity_check_failed');
      invalidateLeaderboard();return json(res,200,{...result,integrity});
    }
    return json(res,404,{error:'not_found'});
  }catch(e){
    console.error(e);
    const code={insufficient_funds:409,pending_drop:409,collection_full:409,recipient_full:409,sold_out:409,already_claimed:409,task_not_done:409,showcase_full:409,not_owned:404,pending_not_found:404,listing_not_found:404,own_listing:409,already_listed:409,bad_price:400,not_friend:403,wheel_cooldown:409,bad_upgrade:400,upgrade_invalid_items:409,upgrade_bad_recipe:409,upgrade_unavailable:409,upgrade_session_expired:409,upgrade_session_mismatch:409,bad_story_image:400,story_https_required:503,body_too_large:413,bad_json:400,bad_request_id:400,premium_unavailable:503,rate_limited:429,recipient_blocked:409,bad_username:400,username_exists:409,reset_confirmation_required:400,sqlite_integrity_check_failed:500,wheel_username_unavailable:409}[e.message]||500;
    return json(res,code,{error:e.message||'server_error'});
  }
}
function serveStoryImage(req,res,url){
  const m=url.pathname.match(/^\/story\/([a-f0-9]{36})\.jpg$/);if(!m){res.writeHead(404);return res.end('Not found')}
  const file=path.join(STORY_DIR,m[1]+'.jpg');
  fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}if(Date.now()-st.mtimeMs>Number(GAME.storyTtlMs||86400000)){try{fs.unlinkSync(file)}catch{};res.writeHead(410);return res.end('Expired')}
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
export {validateInitData,externalOrigin};
