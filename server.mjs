import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAME} from './src/config.mjs';
import {createDatabase} from './src/database.mjs';
import {ensureUser,homeData,createDrop,resolveDrop,collection,leaderboard,tasks,claimTask,profile,sellOwnedUsername} from './src/game.mjs';
import {listMarket,createListing,cancelListing,buyListing} from './src/market.mjs';
import {registerReferral,friendsData,giftUsername} from './src/social.mjs';
import {wheelStatus,spinWheel} from './src/wheel.mjs';
import {upgradeInfo,previewUpgrade,performUpgrade,cleanupUpgradeSessions} from './src/upgrader.mjs';
import {seasonData,ensureSeasonLifecycle} from './src/seasons.mjs';
import {SHOP_PRODUCTS,shopCatalog,validProductCheckout,applyProductPayment,walletData,buyTheme} from './src/payments.mjs';
import {adminOverview,adminUserDetail,adminSetBalance,adminGrantGems,adminUpdateUserProgress,adminUsernames,adminSetBlocked,adminRemoveUsername,adminTransferUsername,adminAddUsername,adminSetUsernameValue,resetSingleUser,resetAllUsers} from './src/admin.mjs';
import {BOT_COMMANDS,BOT_DESCRIPTION,BOT_SHORT_DESCRIPTION,escapeTelegramHtml,startMessage,helpMessage,gameKeyboard} from './src/bot-ui.mjs';
import {labStatus,submitLab} from './src/lab.mjs';
import {dailyStatus,claimDaily} from './src/daily.mjs';
import {publicUser} from './src/game.mjs';
import {achievementsData,reconcileAchievements} from './src/achievements.mjs';
import {levelRewards,progressionFromXp} from './src/progression.mjs';
import {gamesHub,startMiniGame,answerMiniGame,ensureMiniGameSchema,cleanupMiniGameSessions} from './src/minigames.mjs';
import {bumpTask} from './src/economy.mjs';
import {createNotification,listNotifications,unreadNotificationCount,markNotificationRead,markAllNotificationsRead} from './src/notifications.mjs';
import {promoStatus,redeemPromo,adminPromoList,adminCreatePromo,adminSetPromoActive} from './src/promocodes.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
let BOT_USERNAME=(process.env.BOT_USERNAME||'').replace(/^@/,'');
const WEBAPP_URL=process.env.WEBAPP_URL||process.env.APP_URL||process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const MINIAPP_LINK=process.env.MINIAPP_LINK||'https://t.me/usernamegamebot/usernamegame';
const TASK_CHANNEL_CHAT=String(process.env.TASK_CHANNEL_CHAT||process.env.TASK_CHANNEL_USERNAME||'').trim();
const TASK_CHANNEL_URL=String(process.env.TASK_CHANNEL_URL||'').trim()||(()=>{
  const name=TASK_CHANNEL_CHAT.replace(/^@/,'');
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name)?'https://t.me/'+name:'';
})();
const channelTaskEnabled=()=>!!(BOT_TOKEN&&TASK_CHANNEL_CHAT&&TASK_CHANNEL_URL);
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
ensureMiniGameSchema(db);
const lastDropAt=new Map();
const leaderboardCache=new Map();
function invalidateLeaderboard(){leaderboardCache.clear()}

function rateLimit(userId,key,limit,windowMs){
  const rateKey=String(userId)+':'+String(key),now=Date.now();
  return db.transaction(()=>{
    const row=db.prepare('SELECT started_at,count FROM api_rate_limits WHERE rate_key=?').get(rateKey);
    if(!row||now-Number(row.started_at)>=windowMs){
      db.prepare('INSERT INTO api_rate_limits(rate_key,started_at,count) VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET started_at=excluded.started_at,count=1').run(rateKey,now);
      return true;
    }
    if(Number(row.count)>=limit)return false;
    db.prepare('UPDATE api_rate_limits SET count=count+1 WHERE rate_key=?').run(rateKey);
    return true;
  })();
}
function cleanupRateBuckets(){db.prepare('DELETE FROM api_rate_limits WHERE started_at<?').run(Date.now()-24*60*60*1000)}
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
  cleanupRateBuckets();cleanupStoryFiles();cleanupUpgradeSessions(db);cleanupMiniGameSessions(db);ensureSeasonLifecycle(db);invalidateLeaderboard();
}
maintenance();
setInterval(maintenance,10*60*1000).unref?.();
setInterval(()=>backupDatabase(),24*60*60*1000).unref?.();
backupDatabase();

function securityHeaders(){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline' https://use.hugeicons.com; img-src 'self' data:; connect-src 'self'; font-src 'self' https://use.hugeicons.com data:; frame-ancestors https://web.telegram.org https://*.telegram.org"}}
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...securityHeaders()});res.end(JSON.stringify(payload))}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>3e6){reject(new Error('body_too_large'));req.destroy()}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('bad_json'))}});req.on('error',reject)})}
function validateInitData(initData){
  if(!initData||!BOT_TOKEN)return null;
  const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash)return null;p.delete('hash');
  const lines=[];for(const [k,v] of p.entries())lines.push(`${k}=${v}`);lines.sort();
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calc=crypto.createHmac('sha256',secret).update(lines.join('\n')).digest('hex');
  if(calc.length!==hash.length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))return null;
  const authDate=Number(p.get('auth_date')||0),age=Math.floor(Date.now()/1000)-authDate;
  if(!authDate||age>86400||age<-300)return null;
  try{
    const user=JSON.parse(p.get('user')||'{}');
    if(!user||!Number.isSafeInteger(Number(user.id))||Number(user.id)<=0)return null;
    return user;
  }catch{return null}
}
function auth(req){
  const raw=String(req.headers['x-telegram-init-data']||''),tg=validateInitData(raw);
  if(tg){
    const verifiedStart=String(new URLSearchParams(raw).get('start_param')||'');
    const u=ensureUser(db,tg);registerReferral(db,u,verifiedStart);if(verifiedStart)invalidateLeaderboard();return u;
  }
  if(ALLOW_DEV_AUTH){
    const rawDev=req.headers['x-dev-user'];if(!rawDev)return null;
    const host=String(req.headers.host||'').split(':')[0].toLowerCase();
    if(!['localhost','127.0.0.1','::1'].includes(host))return null;
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
function publicMiniAppLink(ref=''){try{const u=new URL(MINIAPP_LINK);if(ref)u.searchParams.set('startapp',ref);return u.toString()}catch{return 'https://t.me/usernamegamebot/usernamegame'}}
async function sendBotMenuMessage(chatId,text,url,label){
  const payload={chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true},keyboard=gameKeyboard(url,label);
  if(keyboard)payload.reply_markup=keyboard;
  return telegramApi('sendMessage',payload);
}
async function sendStartMessage(chatId,firstName='',ref=''){
  return sendBotMenuMessage(chatId,startMessage(firstName),publicMiniAppLink(ref),'🎮 Начать играть');
}
async function sendHelpMessage(chatId){
  return sendBotMenuMessage(chatId,helpMessage(),publicMiniAppLink(),'🎮 Начать играть');
}
async function notifyUser(userId,type,title,body='',page='home'){
  const target=db.prepare('SELECT id,telegram_id,username,first_name FROM users WHERE id=?').get(Number(userId));
  if(!target)return {stored:false,sent:false};
  const stored=!!createNotification(db,target.id,type,title,body,page);
  let sent=false;
  if(BOT_TOKEN&&target.telegram_id){
    const text='<b>'+escapeTelegramHtml(title)+'</b>'+(body?'\n\n'+escapeTelegramHtml(body):'');
    const payload={chat_id:target.telegram_id,text,parse_mode:'HTML',disable_web_page_preview:true};
    const url=publicMiniAppLink(page?('page_'+page):'');
    if(url)payload.reply_markup={inline_keyboard:[[{text:'🎮 Открыть USERNAME',url}]]};
    try{await telegramApi('sendMessage',payload);sent=true}catch(e){console.error('Telegram user notification:',e.message)}
  }
  return {stored,sent};
}
async function runBroadcast(message,{page='home',buttonLabel='🎮 Открыть игру'}={}){
  const text=String(message||'').trim();if(!text)throw new Error('bad_message');
  const users=db.prepare("SELECT id,telegram_id FROM users WHERE blocked=0 AND telegram_id IS NOT NULL AND telegram_id<>'' ORDER BY id").all();
  let sent=0,failed=0;
  const url=publicMiniAppLink(page?('page_'+page):'');
  for(let offset=0;offset<users.length;offset+=20){
    const chunk=users.slice(offset,offset+20);
    const results=await Promise.allSettled(chunk.map(async target=>{
      createNotification(db,target.id,'ADMIN_MESSAGE','Сообщение от USERNAME',text,page);
      if(!BOT_TOKEN)return false;
      const payload={chat_id:target.telegram_id,text:'<b>USERNAME</b>\n\n'+escapeTelegramHtml(text),parse_mode:'HTML',disable_web_page_preview:true};
      if(url)payload.reply_markup={inline_keyboard:[[{text:String(buttonLabel||'🎮 Открыть игру').slice(0,64),url}]]};
      await telegramApi('sendMessage',payload);return true;
    }));
    for(const r of results){if(r.status==='fulfilled')sent++;else failed++}
    if(offset+20<users.length)await new Promise(r=>setTimeout(r,750));
  }
  return {ok:true,total:users.length,sent,failed};
}
async function handleTelegramUpdate(u){
  if(u?.pre_checkout_query){
    const q=u.pre_checkout_query,ok=validProductCheckout(q);
    await telegramApi('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(!ok?{error_message:'Платёж не прошёл проверку. Откройте USERNAME и создайте новый счёт.'}:{})}).catch(e=>console.error('pre_checkout:',e.message));
    return;
  }
  const m=u?.message;if(!m)return;
  const payment=m.successful_payment;
  if(payment){
    const result=applyProductPayment(db,m,payment);
    if(result.applied){
      const text='Начислено '+String(result.product?.title||'💎')+'.';
      await telegramApi('sendMessage',{chat_id:m.chat.id,text}).catch(()=>{});
    }
  }
  const text=String(m.text||'').trim(),start=text.match(/^\/start(?:@\w+)?(?:\s+([^\s]+))?$/i);
  if(!m.chat?.id)return;
  if(start)return sendStartMessage(m.chat.id,m.from?.first_name||'',start[1]||'');
  if(/^\/play(?:@\w+)?$/i.test(text)||/^🎮?\s*(?:открыть|начать) игру$/i.test(text))return sendBotMenuMessage(m.chat.id,'<b>USERNAME</b> уже ждёт тебя. Нажимай кнопку и заходи в игру 👇',publicMiniAppLink(),'🎮 Начать играть');
  if(/^\/help(?:@\w+)?$/i.test(text))return sendHelpMessage(m.chat.id);
  if(/^\/admin(?:@\w+)?$/i.test(text)){
    if(!ADMIN_IDS.has(String(m.from?.id)))return telegramApi('sendMessage',{chat_id:m.chat.id,text:'Нет доступа.'});
    const s=adminOverview(db,{page:1,size:5}).stats;
    const body='<b>🛠 Админ-панель USERNAME</b>\n\n'+
      '👥 Пользователей: <b>'+Number(s.users||0)+'</b>\n'+
      '🟢 За 24 часа: <b>'+Number(s.activeToday||0)+'</b>\n'+
      '🧩 Активных usernames: <b>'+Number(s.activeUsernames||0)+'</b>\n\n'+
      '<code>/broadcast текст</code> — рассылка всем игрокам';
    return sendBotMenuMessage(m.chat.id,body,publicMiniAppLink('page_admin'),'🛠 Открыть админку');
  }
  const broadcast=text.match(/^\/broadcast(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  if(broadcast){
    if(!ADMIN_IDS.has(String(m.from?.id)))return telegramApi('sendMessage',{chat_id:m.chat.id,text:'Нет доступа.'});
    if(!String(broadcast[1]||'').trim())return telegramApi('sendMessage',{chat_id:m.chat.id,text:'Использование: /broadcast текст сообщения'});
    const result=await runBroadcast(broadcast[1],{page:'home'});
    return telegramApi('sendMessage',{chat_id:m.chat.id,text:'Рассылка завершена.\n\nОтправлено: '+result.sent+'\nОшибок: '+result.failed+'\nВсего: '+result.total});
  }
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
    if(req.method==='GET'&&url.pathname==='/api/home'){const h=homeData(db,user);h.user.isAdmin=isAdmin(user);h.user.unreadNotifications=unreadNotificationCount(db,user.id);return json(res,200,h)}
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
    if(req.method==='GET'&&url.pathname==='/api/collection')return json(res,200,collection(db,user,{sort:url.searchParams.get('sort')||'new',digits:url.searchParams.get('digits')||'all',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='GET'&&url.pathname==='/api/leaderboard'){
      const key='capital',cached=leaderboardCache.get(key);
      if(cached&&Date.now()-cached.ts<30000)return json(res,200,{items:cached.items});
      const items=leaderboard(db);leaderboardCache.set(key,{ts:Date.now(),items});return json(res,200,{items});
    }
    if(req.method==='GET'&&url.pathname==='/api/tasks'){
      const channelEnabled=channelTaskEnabled(),items=tasks(db,user,{includeSpecial:channelEnabled}).map(t=>t.special?{...t,channelUrl:TASK_CHANNEL_URL}:t);
      return json(res,200,{items,total:items.length,completed:items.filter(x=>x.claimed).length,ready:items.filter(x=>!x.claimed&&x.current>=x.target).length});
    }
    if(req.method==='POST'&&url.pathname==='/api/tasks/channel/verify'){
      if(!channelTaskEnabled())throw new Error('channel_task_unavailable');
      if(!rateLimit(user.id,'channel_task_verify',10,60000))return json(res,429,{error:'rate_limited'});
      let member;
      try{member=await telegramApi('getChatMember',{chat_id:TASK_CHANNEL_CHAT,user_id:Number(user.telegram_id)})}
      catch(e){console.error('Telegram channel task:',e.message);throw new Error('channel_task_unavailable')}
      const subscribed=['creator','administrator','member'].includes(String(member?.status||''))||(member?.status==='restricted'&&member?.is_member!==false);
      if(!subscribed)throw new Error('channel_subscription_required');
      db.prepare('INSERT INTO task_progress(user_id,progress_date,task_key,value) VALUES(?,?,?,1) ON CONFLICT(user_id,progress_date,task_key) DO UPDATE SET value=MAX(value,1)')
        .run(user.id,'special','channel_sub');
      const items=tasks(db,user,{includeSpecial:true}).map(t=>t.special?{...t,channelUrl:TASK_CHANNEL_URL}:t);
      return json(res,200,{ok:true,items,total:items.length,completed:items.filter(x=>x.claimed).length,ready:items.filter(x=>!x.claimed&&x.current>=x.target).length});
    }
    const claim=url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);if(req.method==='POST'&&claim){
      const result=claimTask(db,user,claim[1],{allowSpecial:channelTaskEnabled()});invalidateLeaderboard();return json(res,200,result)
    }
    if(req.method==='GET'&&url.pathname==='/api/daily')return json(res,200,dailyStatus(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id)));
    if(req.method==='POST'&&url.pathname==='/api/daily/claim'){
      const result=claimDaily(db,user),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      invalidateLeaderboard();return json(res,200,{...result,user:publicUser(db,fresh),status:dailyStatus(db,fresh)})
    }
    if(req.method==='GET'&&url.pathname==='/api/games')return json(res,200,gamesHub(db,user));
    const gameStart=url.pathname.match(/^\/api\/games\/([a-z]+)\/start$/);
    if(req.method==='POST'&&gameStart){
      if(!rateLimit(user.id,'mini_game_start',20,60000))return json(res,429,{error:'rate_limited'});
      return json(res,200,startMiniGame(db,user,gameStart[1]));
    }
    const gameAnswer=url.pathname.match(/^\/api\/games\/session\/([^/]+)\/answer$/);
    if(req.method==='POST'&&gameAnswer){
      if(!rateLimit(user.id,'mini_game_answer',80,60000))return json(res,429,{error:'rate_limited'});
      const b=await readBody(req),result=answerMiniGame(db,user,gameAnswer[1],b.answer,b.index);
      const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);invalidateLeaderboard();
      return json(res,200,{...result,user:publicUser(db,fresh)});
    }
    if(req.method==='GET'&&url.pathname==='/api/lab')return json(res,200,labStatus(db,user));
    if(req.method==='POST'&&url.pathname==='/api/lab'){
      if(!rateLimit(user.id,'username_lab',20,60000))return json(res,429,{error:'rate_limited'});
      const b=await readBody(req),result=submitLab(db,user,String(b.handle||'')),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      invalidateLeaderboard();return json(res,200,{...result,user:publicUser(db,fresh)})
    }
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,{profile:profile(db,user.id)});
    const other=url.pathname.match(/^\/api\/profile\/(\d+)$/);if(req.method==='GET'&&other){const targetId=Number(other[1]);if(targetId!==user.id)bumpTask(db,user.id,'view_profile',1);const p=profile(db,targetId);return p?json(res,200,{profile:p}):json(res,404,{error:'user_not_found'})}
    const collectionSell=url.pathname.match(/^\/api\/collection\/([^/]+)\/sell$/);if(req.method==='POST'&&collectionSell){const result=sellOwnedUsername(db,user,collectionSell[1]);invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/market')return json(res,200,listMarket(db,{sort:url.searchParams.get('sort')||'new',digits:url.searchParams.get('digits')||'all',q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1)}));
    if(req.method==='POST'&&url.pathname==='/api/market'){const b=await readBody(req),result=createListing(db,user,String(b.instanceId||''),b.price);invalidateLeaderboard();return json(res,200,result)}
    const buy=url.pathname.match(/^\/api\/market\/([^/]+)\/buy$/);if(req.method==='POST'&&buy){const result=buyListing(db,user,buy[1]);invalidateLeaderboard();return json(res,200,result)}
    const cancel=url.pathname.match(/^\/api\/market\/([^/]+)\/cancel$/);if(req.method==='POST'&&cancel){const result=cancelListing(db,user,cancel[1]);invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/friends'){if(!BOT_USERNAME&&BOT_TOKEN)await resolveBotUsername();return json(res,200,friendsData(db,user,BOT_USERNAME))}
    if(req.method==='GET'&&url.pathname==='/api/gift/options')return json(res,200,giftOptions(user));
    if(req.method==='POST'&&url.pathname==='/api/gift'){
      const b=await readBody(req),result=giftUsername(db,user,String(b.instanceId||''),b.recipientUsername??b.friendId);
      invalidateLeaderboard();
      const sender=user.username?('@'+user.username):(user.first_name||'Игрок');
      await notifyUser(result.recipientId,'USERNAME_RECEIVED','🎁 Тебе передали username',result.handle+'\nОт: '+sender,'collection');
      const {recipientId,...publicResult}=result;
      return json(res,200,publicResult)
    }

    if(req.method==='GET'&&url.pathname==='/api/notifications')return json(res,200,listNotifications(db,user.id,100));
    if(req.method==='POST'&&url.pathname==='/api/notifications/read-all')return json(res,200,markAllNotificationsRead(db,user.id));
    const notificationRead=url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if(req.method==='POST'&&notificationRead)return json(res,200,markNotificationRead(db,user.id,notificationRead[1]));

    if(req.method==='GET'&&url.pathname==='/api/promocode')return json(res,200,promoStatus(db,user));
    if(req.method==='POST'&&url.pathname==='/api/promocode'){
      const b=await readBody(req),result=redeemPromo(db,user,b.code),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      invalidateLeaderboard();return json(res,200,{...result,user:publicUser(db,fresh),wallet:walletData(db,user.id)});
    }

    if(req.method==='GET'&&url.pathname==='/api/wheel')return json(res,200,wheelStatus(db,user));
    if(req.method==='POST'&&url.pathname==='/api/wheel'){const b=await readBody(req),result=spinWheel(db,user,String(b.requestId||''));invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/upgrader')return json(res,200,upgradeInfo(db,user));
    if(req.method==='POST'&&url.pathname==='/api/upgrader/preview'){if(!rateLimit(user.id,'upgrade_preview',20,60000))return json(res,429,{error:'rate_limited'});const b=await readBody(req);return json(res,200,previewUpgrade(db,user,b.ids))}
    if(req.method==='POST'&&url.pathname==='/api/upgrader'){const b=await readBody(req),result=performUpgrade(db,user,b.ids,String(b.sessionId||''));invalidateLeaderboard();return json(res,200,result)}

    if(req.method==='GET'&&url.pathname==='/api/seasons')return json(res,200,{season:seasonData(db,user)});

    if(req.method==='GET'&&(url.pathname==='/api/shop'||url.pathname==='/api/premium')){
      const owned=db.prepare("SELECT type,key FROM user_cosmetics WHERE user_id=? AND type='theme' ORDER BY key").all(user.id);
      const selected=db.prepare('SELECT theme_key FROM user_cosmetic_settings WHERE user_id=?').get(user.id)||{};
      const catalog=shopCatalog();
      return json(res,200,{wallet:walletData(db,user.id),gemPacks:catalog.gemPacks,themes:catalog.themes,owned,selected,starsEnabled:!!BOT_TOKEN})
    }
    if(req.method==='POST'&&url.pathname==='/api/shop/invoice'){
      if(!BOT_TOKEN)return json(res,503,{error:'premium_unavailable'});
      const b=await readBody(req),product=SHOP_PRODUCTS[String(b.productKey||'')];if(!product||product.type!=='gems')throw new Error('bad_product');
      const invoice=await telegramApi('createInvoiceLink',{title:product.title,description:product.description,payload:`username_shop:${product.key}:${user.telegram_id}:${crypto.randomUUID()}`,currency:'XTR',prices:[{label:product.title,amount:product.stars}]});
      return json(res,200,{invoice,product:{key:product.key,title:product.title,stars:product.stars,gems:product.gems}})
    }
    if(req.method==='POST'&&url.pathname==='/api/shop/theme'){
      const b=await readBody(req),result=buyTheme(db,user,String(b.themeKey||''));
      return json(res,200,result)
    }
    if(req.method==='POST'&&url.pathname==='/api/cosmetics/select'){
      const b=await readBody(req),type=String(b.type||''),key=String(b.key||'');
      if(type!=='theme')throw new Error('bad_cosmetic');
      if(!db.prepare("SELECT 1 FROM user_cosmetics WHERE user_id=? AND type='theme' AND key=?").get(user.id,key))throw new Error('cosmetic_locked');
      const now=new Date().toISOString();
      db.prepare('INSERT INTO user_cosmetic_settings(user_id,theme_key,frame_key,card_key,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET theme_key=excluded.theme_key,updated_at=excluded.updated_at')
        .run(user.id,key,null,null,now);
      return json(res,200,{ok:true,type,key})
    }
    if(req.method==='GET'&&url.pathname==='/api/levels'){
      return json(res,200,{progression:progressionFromXp(user.xp),rewards:levelRewards()})
    }
    if(req.method==='GET'&&url.pathname==='/api/achievements')return json(res,200,achievementsData(db,{...user,level:progressionFromXp(user.xp).level}));
    if(req.method==='POST'&&url.pathname==='/api/achievements/reconcile'){
      const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      return json(res,200,reconcileAchievements(db,{...fresh,level:progressionFromXp(fresh.xp).level}));
    }

    if(url.pathname==='/api/admin/overview'&&req.method==='GET'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      return json(res,200,adminOverview(db,{q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1),size:Number(url.searchParams.get('size')||20)}));
    }
    if(url.pathname==='/api/admin/usernames'&&req.method==='GET'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      return json(res,200,adminUsernames(db,{q:url.searchParams.get('q')||'',status:url.searchParams.get('status')||'active',page:Number(url.searchParams.get('page')||1),size:Number(url.searchParams.get('size')||30)}));
    }
    if(url.pathname==='/api/admin/promocodes'&&req.method==='GET'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      return json(res,200,adminPromoList(db));
    }
    if(url.pathname==='/api/admin/promocodes'&&req.method==='POST'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      const b=await readBody(req);return json(res,200,adminCreatePromo(db,user,b));
    }
    const promoToggle=url.pathname.match(/^\/api\/admin\/promocodes\/([^/]+)\/active$/);
    if(req.method==='POST'&&promoToggle){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      const b=await readBody(req);return json(res,200,adminSetPromoActive(db,user,decodeURIComponent(promoToggle[1]),!!b.active));
    }
    const adminUser=url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if(req.method==='GET'&&adminUser){if(!isAdmin(user))return json(res,403,{error:'forbidden'});return json(res,200,adminUserDetail(db,Number(adminUser[1])))}
    const adminActionRoute=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(balance|gems|profile|block|reset|add-username|message)$/);
    if(req.method==='POST'&&adminActionRoute){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});const targetId=Number(adminActionRoute[1]),action=adminActionRoute[2],b=await readBody(req);let result;
      if(action==='balance')result=adminSetBalance(db,user,targetId,b.delta);
      if(action==='gems')result=adminGrantGems(db,user,targetId,b.delta);
      if(action==='profile')result=adminUpdateUserProgress(db,user,targetId,{xp:b.xp,freeDrops:b.freeDrops});
      if(action==='block')result=adminSetBlocked(db,user,targetId,!!b.value);
      if(action==='reset')result=resetSingleUser(db,user,targetId);
      if(action==='add-username')result=adminAddUsername(db,user,targetId,b.handle,b.value);
      if(action==='message'){
        const message=String(b.text||'').trim();if(!message)throw new Error('bad_message');
        const delivery=await notifyUser(targetId,'ADMIN_MESSAGE','Сообщение от USERNAME',message,'home');
        result={ok:true,...delivery};
      }
      invalidateLeaderboard();return json(res,200,result);
    }
    const adminUsername=url.pathname.match(/^\/api\/admin\/usernames\/([^/]+)\/(remove|transfer|value)$/);
    if(req.method==='POST'&&adminUsername){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});const b=await readBody(req),id=adminUsername[1],action=adminUsername[2];let result;
      if(action==='remove')result=adminRemoveUsername(db,user,id);
      if(action==='transfer'){result=adminTransferUsername(db,user,id,Number(b.targetId));await notifyUser(Number(b.targetId),'USERNAME_RECEIVED','🎁 Тебе передали username',result.handle+'\nПередано администрацией USERNAME','collection')}
      if(action==='value')result=adminSetUsernameValue(db,user,id,b.value);
      invalidateLeaderboard();return json(res,200,result);
    }
    if(req.method==='POST'&&url.pathname==='/api/admin/broadcast'){
      if(!isAdmin(user))return json(res,403,{error:'forbidden'});
      const b=await readBody(req),message=String(b.text||'').trim();if(!message)throw new Error('bad_message');
      const result=await runBroadcast(message,{page:String(b.page||'home'),buttonLabel:String(b.buttonLabel||'🎮 Открыть игру')});
      db.prepare('INSERT INTO admin_audit(id,admin_id,action,target,metadata,created_at) VALUES(?,?,?,?,?,?)')
        .run(crypto.randomUUID(),user.id,'broadcast','all',JSON.stringify(result),new Date().toISOString());
      return json(res,200,result);
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
    const code={insufficient_funds:409,promo_not_found:404,promo_expired:409,promo_limit:409,promo_used:409,promo_exists:409,bad_promo_code:400,bad_promo_reward:400,bad_promo_expiry:400,bad_gems:400,pending_drop:409,collection_full:409,recipient_full:409,sold_out:409,already_claimed:409,task_not_done:409,not_owned:404,pending_not_found:404,listing_not_found:404,own_listing:409,already_listed:409,bad_price:400,not_friend:403,wheel_cooldown:409,bad_upgrade:400,upgrade_invalid_items:409,upgrade_bad_recipe:409,upgrade_unavailable:409,upgrade_session_expired:409,upgrade_session_mismatch:409,bad_story_image:400,story_https_required:503,body_too_large:413,bad_json:400,bad_request_id:400,premium_unavailable:503,insufficient_gems:409,bad_product:400,bad_cosmetic:400,cosmetic_locked:403,rate_limited:429,recipient_blocked:409,user_not_found:404,bad_username:400,username_exists:409,gift_self:400,game_stale_answer:409,self_admin_block:409,reset_confirmation_required:400,bad_message:400,channel_task_unavailable:503,channel_subscription_required:409,sqlite_integrity_check_failed:500,wheel_username_unavailable:409}[e.message]||500;
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
const server=http.createServer((req,res)=>{const url=new URL(req.url,WEBAPP_URL);if(url.pathname==='/healthz'){
  try{const dbOk=Number(db.prepare('SELECT 1 ok').get()?.ok)===1;return json(res,dbOk?200:503,{ok:dbOk,service:'username',version:GAME.version,db:dbOk,botConfigured:!!BOT_TOKEN,telegramPolling})}
  catch{return json(res,503,{ok:false,service:'username',version:GAME.version,db:false,botConfigured:!!BOT_TOKEN,telegramPolling})}
}if(url.pathname.startsWith('/story/'))return serveStoryImage(req,res,url);if(url.pathname.startsWith('/api/'))return api(req,res,url);return serveStatic(req,res,url)});
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)server.listen(PORT,()=>{console.log(`USERNAME v${GAME.version} running on http://localhost:${PORT}`);startTelegramPolling().catch(e=>console.error('Telegram bot fatal:',e))});
export {validateInitData,externalOrigin};
