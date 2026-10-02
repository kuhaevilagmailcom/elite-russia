import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const BOT_TOKEN=process.env.BOT_TOKEN||'';
const BOT_USERNAME=(process.env.BOT_USERNAME||'PerekupGameBot').replace(/^@/,'');
const ALLOW_DEV_AUTH=process.env.ALLOW_DEV_AUTH==='1';
const WEBAPP_URL=process.env.WEBAPP_URL||process.env.APP_URL||process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const ADMIN_IDS=new Set(String(process.env.ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
fs.mkdirSync(DATA_DIR,{recursive:true});
const db=new Database(path.join(DATA_DIR,'perekup.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');

const SEARCH_COST=1000;
const OFFER_INSPECTION_COST=1500;
const regions=[['74','Челябинская область'],['77','Москва'],['116','Республика Татарстан'],['66','Свердловская область'],['163','Самарская область'],['23','Краснодарский край'],['78','Санкт-Петербург'],['54','Новосибирская область'],['51','Мурманская область'],['95','Чеченская Республика']];
const letters=['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
const tierMeta={
  1:{name:'АвтоВАЗ',emoji:'🇷🇺',unlock:1,desc:'Стартовые машины'},
  2:{name:'Иномарки',emoji:'🌍',unlock:3,desc:'Бюджетные иномарки'},
  3:{name:'Бизнес',emoji:'💼',unlock:6,desc:'Комфорт и бизнес-класс'},
  4:{name:'Премиум',emoji:'💎',unlock:10,desc:'Мощные и дорогие авто'},
  5:{name:'Топ-класс',emoji:'🏁',unlock:15,desc:'Спорт и эксклюзив'}
};
const faultCatalog=[
  {key:'oil',label:'Требуется большое ТО',emoji:'🛢️',cost:2200,gain:3,valueGain:.035},
  {key:'brakes',label:'Износ тормозов',emoji:'🛞',cost:3800,gain:5,valueGain:.055},
  {key:'suspension',label:'Подвеска требует ремонта',emoji:'🔧',cost:5200,gain:7,valueGain:.075},
  {key:'body',label:'Кузовные дефекты',emoji:'🧰',cost:6500,gain:8,valueGain:.09},
  {key:'paint',label:'Плохое ЛКП',emoji:'🎨',cost:7200,gain:6,valueGain:.08},
  {key:'engine',label:'Нестабильная работа двигателя',emoji:'⚙️',cost:9800,gain:12,valueGain:.13},
  {key:'gearbox',label:'Нужен сервис коробки',emoji:'🧩',cost:8800,gain:10,valueGain:.11}
];
const dealerNames=['АвтоХаус','Север Авто','Drive Market','Прайм Моторс','Гараж 74','АвтоПрофи'];

function nowIso(){return new Date().toISOString()}
function todayKey(){return nowIso().slice(0,10)}
function uid(){return crypto.randomUUID()}
function money(n){return Math.max(0,Math.round(Number(n)||0))}
function randInt(min,max){return crypto.randomInt(min,max+1)}
function choice(a){return a[crypto.randomInt(0,a.length)]}
function securityHeaders(){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org"}}
function json(res,status,payload){const body=JSON.stringify(payload);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...securityHeaders()});res.end(body)}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6){reject(new Error('body_too_large'));req.destroy()}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('bad_json'))}});req.on('error',reject)})}
function isAdminTelegramId(id){return ADMIN_IDS.has(String(id))||(ALLOW_DEV_AUTH&&String(id)==='10001')}
function levelFromXp(xp){return Math.max(1,Math.min(30,1+Math.floor(Number(xp||0)/250)))}
function unlockedTier(level){if(level>=15)return 5;if(level>=10)return 4;if(level>=6)return 3;if(level>=3)return 2;return 1}

function validateInitData(initData){
  if(!initData||!BOT_TOKEN)return null;
  const params=new URLSearchParams(initData);const hash=params.get('hash');if(!hash)return null;params.delete('hash');
  const lines=[];for(const [k,v] of params.entries())lines.push(`${k}=${v}`);lines.sort();
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calc=crypto.createHmac('sha256',secret).update(lines.join('\n')).digest('hex');
  if(calc.length!==hash.length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(hash)))return null;
  const authDate=Number(params.get('auth_date')||0);if(!authDate||Math.abs(Date.now()/1000-authDate)>86400)return null;
  try{return JSON.parse(params.get('user')||'{}')}catch{return null}
}


async function telegramApi(method,payload={}){
  if(!BOT_TOKEN)throw new Error('bot_token_missing');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),35000);
  try{
    const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const j=await r.json().catch(()=>({ok:false,description:'bad_json'}));
    if(!r.ok||!j.ok)throw new Error(j.description||`telegram_http_${r.status}`);
    return j.result;
  }finally{clearTimeout(timer)}
}
function publicWebAppUrl(){
  try{const u=new URL(WEBAPP_URL);return u.protocol==='https:'?u.toString():''}catch{return ''}
}
async function sendStartMessage(chatId,firstName=''){
  const url=publicWebAppUrl();const name=String(firstName||'').trim();
  const text=`${name?`Привет, ${name}! 👋\\n\\n`:''}🚘 <b>ПЕРЕКУП | ИГРА</b>\\n\\nПокупай машины, проверяй их, ремонтируй и продавай дороже.`;
  const payload={chat_id:chatId,text,parse_mode:'HTML'};
  if(url)payload.reply_markup={inline_keyboard:[[{text:'🚘 Открыть игру',web_app:{url}}]]};
  return telegramApi('sendMessage',payload);
}
async function handleTelegramUpdate(update){
  const m=update?.message;if(!m?.chat?.id)return;
  const text=String(m.text||'').trim();
  if(/^\\/start(?:@\\w+)?(?:\\s|$)/i.test(text))await sendStartMessage(m.chat.id,m.from?.first_name||'');
}
let telegramPolling=false;
async function startTelegramPolling(){
  if(telegramPolling||!BOT_TOKEN)return;
  telegramPolling=true;
  try{
    await telegramApi('deleteWebhook',{drop_pending_updates:false}).catch(e=>console.warn('Telegram deleteWebhook:',e.message));
    const url=publicWebAppUrl();
    if(url)await telegramApi('setChatMenuButton',{menu_button:{type:'web_app',text:'🚘 Играть',web_app:{url}}}).catch(e=>console.warn('Telegram menu button:',e.message));
    await telegramApi('setMyCommands',{commands:[{command:'start',description:'Запустить игру'}]}).catch(()=>{});
    let offset=0;console.log('Telegram bot polling started');
    while(telegramPolling){
      try{
        const updates=await telegramApi('getUpdates',{offset,timeout:25,allowed_updates:['message']});
        for(const u of updates||[]){offset=Math.max(offset,Number(u.update_id||0)+1);try{await handleTelegramUpdate(u)}catch(e){console.error('Telegram update error:',e)}}
      }catch(e){if(!telegramPolling)break;console.error('Telegram polling error:',e.message);await new Promise(r=>setTimeout(r,2000))}
    }
  }finally{telegramPolling=false}
}

function initDb(){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,telegram_id TEXT UNIQUE NOT NULL,username TEXT,first_name TEXT,
    level INTEGER NOT NULL DEFAULT 1,xp INTEGER NOT NULL DEFAULT 0,balance INTEGER NOT NULL DEFAULT 100000,
    reputation INTEGER NOT NULL DEFAULT 0,searches INTEGER NOT NULL DEFAULT 0,buys INTEGER NOT NULL DEFAULT 0,
    sales INTEGER NOT NULL DEFAULT 0,profit INTEGER NOT NULL DEFAULT 0,inspections INTEGER NOT NULL DEFAULT 0,
    repairs INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,last_seen TEXT NOT NULL,blocked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS vehicle_catalog(
    id INTEGER PRIMARY KEY AUTOINCREMENT,brand TEXT NOT NULL,model TEXT NOT NULL,generation TEXT,
    year_from INTEGER NOT NULL,year_to INTEGER NOT NULL,base_price INTEGER NOT NULL,tier INTEGER NOT NULL,
    country TEXT NOT NULL,category TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,image_key TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS owned_vehicles(
    id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,catalog_id INTEGER NOT NULL,year INTEGER NOT NULL,mileage INTEGER NOT NULL,
    owners_count INTEGER NOT NULL,condition INTEGER NOT NULL,color TEXT NOT NULL,plate TEXT NOT NULL,region TEXT NOT NULL,
    region_name TEXT NOT NULL,buy_price INTEGER NOT NULL,current_value INTEGER NOT NULL,faults_json TEXT NOT NULL DEFAULT '[]',
    inspected INTEGER NOT NULL DEFAULT 0,service_spent INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'owned',
    created_at TEXT NOT NULL,FOREIGN KEY(owner_id) REFERENCES users(id),FOREIGN KEY(catalog_id) REFERENCES vehicle_catalog(id)
  );
  CREATE TABLE IF NOT EXISTS current_offers(user_id INTEGER PRIMARY KEY,offer_json TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS system_auctions(
    id TEXT PRIMARY KEY,vehicle_id TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,start_value INTEGER NOT NULL,target_value INTEGER NOT NULL,
    ends_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,sold_at TEXT,sold_price INTEGER,
    FOREIGN KEY(vehicle_id) REFERENCES owned_vehicles(id),FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS balance_transactions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,type TEXT NOT NULL,amount INTEGER NOT NULL,balance_before INTEGER NOT NULL,balance_after INTEGER NOT NULL,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS daily_rewards(user_id INTEGER PRIMARY KEY,last_claim_date TEXT,streak INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS claimed_tasks(user_id INTEGER NOT NULL,task_key TEXT NOT NULL,claim_date TEXT NOT NULL,PRIMARY KEY(user_id,task_key,claim_date));
  CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,admin_id INTEGER NOT NULL,action TEXT NOT NULL,target_user_id INTEGER,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS vehicle_service_history(id TEXT PRIMARY KEY,vehicle_id TEXT NOT NULL,user_id INTEGER NOT NULL,service_key TEXT NOT NULL,cost INTEGER NOT NULL,value_before INTEGER NOT NULL,value_after INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_service_vehicle ON vehicle_service_history(vehicle_id,service_key,created_at);
  CREATE TABLE IF NOT EXISTS daily_task_progress(user_id INTEGER NOT NULL,progress_date TEXT NOT NULL,task_key TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,progress_date,task_key));
  CREATE INDEX IF NOT EXISTS idx_owned_owner ON owned_vehicles(owner_id,status);
  CREATE INDEX IF NOT EXISTS idx_auction_user ON system_auctions(user_id,status,created_at);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON balance_transactions(user_id,created_at);
  `);
  if(db.prepare('SELECT COUNT(*) c FROM vehicle_catalog').get().c===0)seedCatalog();
}

function seedCatalog(){
  const rows=[
    ['LADA','2109','Samara',1987,2004,42000,1,'Россия','hatch','lada2109'],
    ['LADA','2110','110',1995,2007,52000,1,'Россия','sedan','lada2110'],
    ['LADA','Priora','2170',2007,2018,68000,1,'Россия','sedan','priora'],
    ['LADA','Granta','I',2011,2024,84000,1,'Россия','sedan','priora'],
    ['LADA','Vesta','I',2015,2024,118000,1,'Россия','sedan','priora'],
    ['Renault','Logan','I',2005,2015,122000,2,'Франция','sedan','logan'],
    ['Hyundai','Solaris','I',2011,2017,138000,2,'Корея','sedan','skoda'],
    ['Volkswagen','Golf','Mk6',2008,2013,158000,2,'Германия','hatch','golf'],
    ['Skoda','Octavia','A7',2013,2020,188000,2,'Чехия','liftback','skoda'],
    ['Toyota','Camry 40','XV40',2006,2011,195000,2,'Япония','sedan','camry'],
    ['Kia','K5','DL3',2019,2024,338000,3,'Корея','sedan','skoda'],
    ['BMW','E39','5 Series',1995,2004,285000,3,'Германия','sedan','bmw'],
    ['Mercedes-Benz','W211','E-Class',2002,2009,310000,3,'Германия','sedan','mercedes'],
    ['Audi','A6','C7',2011,2018,355000,3,'Германия','sedan','audi'],
    ['Toyota','Camry 50','XV50',2011,2017,295000,3,'Япония','sedan','camry'],
    ['BMW','F10','5 Series',2010,2017,535000,4,'Германия','sedan','bmw'],
    ['Mercedes-Benz','W212','E-Class',2009,2016,565000,4,'Германия','sedan','mercedes'],
    ['Audi','A7','4G',2010,2018,590000,4,'Германия','liftback','audi'],
    ['Toyota','Mark II','JZX100',1996,2000,520000,4,'Япония','sedan','supra'],
    ['Audi','R8','I',2006,2015,780000,4,'Германия','sport','r8'],
    ['Toyota','Supra A80','A80',1993,2002,910000,5,'Япония','sport','supra'],
    ['Nissan','GT-R R35','R35',2007,2024,1180000,5,'Япония','sport','gtr'],
    ['BMW','M5 F90','F90',2017,2024,1280000,5,'Германия','sport','bmw'],
    ['Mercedes-AMG','GT','C190',2015,2023,1350000,5,'Германия','sport','mercedes'],
    ['Porsche','911','992',2019,2024,1580000,5,'Германия','sport','porsche']
  ];
  const st=db.prepare('INSERT INTO vehicle_catalog(brand,model,generation,year_from,year_to,base_price,tier,country,category,image_key) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const r of rows)st.run(...r);
}

function ensureUser(req){
  const initData=req.headers['x-telegram-init-data']||'';let tg=validateInitData(String(initData));
  if(!tg&&ALLOW_DEV_AUTH){const devId=String(req.headers['x-dev-user']||'10001');tg={id:devId,username:`dev${devId}`,first_name:'Игрок'}}
  if(!tg)return null;
  let u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(tg.id));
  if(!u){db.prepare('INSERT INTO users(telegram_id,username,first_name,created_at,last_seen) VALUES(?,?,?,?,?)').run(String(tg.id),tg.username||'',tg.first_name||'Игрок',nowIso(),nowIso());u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(tg.id))}
  db.prepare('UPDATE users SET username=?,first_name=?,last_seen=? WHERE id=?').run(tg.username||u.username,tg.first_name||u.first_name,nowIso(),u.id);
  return db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
}
function refreshLevel(userId){const u=db.prepare('SELECT xp,level FROM users WHERE id=?').get(userId);const lvl=levelFromXp(u.xp);if(lvl!==u.level)db.prepare('UPDATE users SET level=? WHERE id=?').run(lvl,userId);return lvl}
function publicUser(u){
  const g=db.prepare("SELECT COALESCE(SUM(current_value),0) v,COUNT(*) c FROM owned_vehicles WHERE owner_id=? AND status='owned'").get(u.id);
  const level=levelFromXp(u.xp);const tier=unlockedTier(level);
  return{id:u.id,telegramId:u.telegram_id,username:u.username,firstName:u.first_name,level,xp:u.xp,xpNext:level*250,balance:u.balance,reputation:u.reputation,searches:u.searches,buys:u.buys,sales:u.sales,profit:u.profit,inspections:u.inspections,repairs:u.repairs,garageValue:g.v,garageCount:g.c,capital:u.balance+g.v,unlockedTier:tier,tiers:Object.entries(tierMeta).map(([id,t])=>({id:Number(id),...t,locked:level<t.unlock})),blocked:!!u.blocked,isAdmin:isAdminTelegramId(u.telegram_id)}
}
function txBalance(userId,type,amount,metadata={}){const u=db.prepare('SELECT balance FROM users WHERE id=?').get(userId);if(!u)throw new Error('user_not_found');const after=u.balance+Math.round(Number(amount)||0);if(after<0)throw new Error('insufficient_funds');db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE users SET balance=? WHERE id=?').run(after,userId);db.prepare('INSERT INTO balance_transactions VALUES(?,?,?,?,?,?,?,?)').run(uid(),userId,type,Math.round(Number(amount)||0),u.balance,after,JSON.stringify(metadata),nowIso());db.exec('COMMIT')}catch(e){try{db.exec('ROLLBACK')}catch{}throw e}return after}
function addProgress(userId,{xp=0,reputation=0}={}){db.prepare('UPDATE users SET xp=xp+?,reputation=MAX(0,reputation+?) WHERE id=?').run(xp,reputation,userId);refreshLevel(userId)}
function bumpDaily(userId,key,delta=1){db.prepare('INSERT INTO daily_task_progress(user_id,progress_date,task_key,value) VALUES(?,?,?,?) ON CONFLICT(user_id,progress_date,task_key) DO UPDATE SET value=value+excluded.value').run(userId,todayKey(),key,Math.max(0,Math.round(delta)||0))}
function dailyValue(userId,key){return db.prepare('SELECT value FROM daily_task_progress WHERE user_id=? AND progress_date=? AND task_key=?').get(userId,todayKey(),key)?.value||0}
function serviceAlreadyDone(vehicleId,key){return !!db.prepare('SELECT 1 FROM vehicle_service_history WHERE vehicle_id=? AND service_key=? LIMIT 1').get(vehicleId,key)}

function makePlate(){const num=String(randInt(1,999)).padStart(3,'0');const a=choice(letters),b=choice(letters),c=choice(letters);const [region,regionName]=choice(regions);return{plate:`${a}${num}${b}${c}`,region,regionName}}
function makeFaults(tier,condition){const max=Math.min(4,Math.max(0,Math.round((92-condition)/8)+randInt(0,1)));const pool=[...faultCatalog];const out=[];for(let i=0;i<max;i++){if(!pool.length)break;const idx=randInt(0,pool.length-1);const f=pool.splice(idx,1)[0];out.push({...f,cost:Math.round(f.cost*(1+(tier-1)*.35))})}return out}
function valueFor(cat,year,mileage,condition){const age=Math.max(0,new Date().getFullYear()-year);const ageMod=Math.max(.52,1-age*.018);const kmMod=Math.max(.62,1-mileage/700000);const condMod=.62+condition/260;return money(cat.base_price*ageMod*kmMod*condMod)}
function generateOffer(user,tierRequested){
  const level=levelFromXp(user.xp),maxTier=unlockedTier(level);let tier=Math.max(1,Math.min(maxTier,Number(tierRequested)||maxTier));
  let cat;
  if(user.searches===0)cat=db.prepare("SELECT * FROM vehicle_catalog WHERE image_key='lada2109' LIMIT 1").get();
  else cat=db.prepare('SELECT * FROM vehicle_catalog WHERE active=1 AND tier=? ORDER BY RANDOM() LIMIT 1').get(tier);
  const year=randInt(cat.year_from,cat.year_to),age=Math.max(0,new Date().getFullYear()-year);
  const mileage=Math.max(12000,Math.round((age*randInt(7000,17000)+randInt(5000,45000))/100)*100);
  const condition=Math.max(48,Math.min(94,94-Math.floor(age*.8)-Math.floor(mileage/60000)+randInt(-5,5)));
  const owners=Math.max(1,Math.min(6,1+Math.floor(age/5)+randInt(0,1)));
  const pd=makePlate(),faults=makeFaults(cat.tier,condition),trueValue=valueFor(cat,year,mileage,condition);
  const sellerFactor=randInt(73,92)/100;const sellerPrice=money(trueValue*sellerFactor);
  const low=money(trueValue*.90),high=money(trueValue*1.08);
  return{id:uid(),catalogId:cat.id,brand:cat.brand,model:cat.model,generation:cat.generation,tier:cat.tier,country:cat.country,category:cat.category,imageKey:cat.image_key,year,mileage,owners,condition,color:choice(['Чёрный','Белый','Серый','Синий','Красный','Серебристый']),plate:pd.plate,region:pd.region,regionName:pd.regionName,faults,inspected:false,trueValue,sellerPrice,estimateLow:low,estimateHigh:high,potentialProfit:Math.max(0,trueValue-sellerPrice),searchCost:SEARCH_COST}
}
function offerFor(id){const r=db.prepare('SELECT offer_json FROM current_offers WHERE user_id=?').get(id);return r?JSON.parse(r.offer_json):null}
function saveOffer(id,o){db.prepare('INSERT INTO current_offers(user_id,offer_json,created_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET offer_json=excluded.offer_json,created_at=excluded.created_at').run(id,JSON.stringify(o),nowIso())}
function clearOffer(id){db.prepare('DELETE FROM current_offers WHERE user_id=?').run(id)}
function insertOwned(ownerId,o){db.prepare(`INSERT INTO owned_vehicles(id,owner_id,catalog_id,year,mileage,owners_count,condition,color,plate,region,region_name,buy_price,current_value,faults_json,inspected,service_spent,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(o.id,ownerId,o.catalogId,o.year,o.mileage,o.owners,o.condition,o.color,o.plate,o.region,o.regionName,o.sellerPrice,o.trueValue,JSON.stringify(o.faults||[]),o.inspected?1:0,0,'owned',nowIso())}
function vehicleRow(id,ownerId){return db.prepare(`SELECT ov.*,vc.brand,vc.model,vc.generation,vc.tier,vc.country,vc.category,vc.image_key imageKey FROM owned_vehicles ov JOIN vehicle_catalog vc ON vc.id=ov.catalog_id WHERE ov.id=? AND ov.owner_id=?`).get(id,ownerId)}
function shapeVehicle(v){if(!v)return null;return{...v,faults:JSON.parse(v.faults_json||'[]'),inspected:!!v.inspected,projectedProfit:v.current_value-v.buy_price-v.service_spent}}
function quickSellValue(v){return money(v.current_value*(.82+Math.min(.08,v.condition/1000)))}
function currentAuction(a){
  if(!a)return null;const total=30000,start=new Date(a.created_at).getTime(),end=new Date(a.ends_at).getTime(),now=Date.now();const ratio=Math.max(0,Math.min(1,(now-start)/total));
  const steps=Math.min(5,Math.floor(ratio*6));let bid=a.start_value;const bids=[];
  for(let i=0;i<steps;i++){const p=(i+1)/6;const price=money(a.start_value+(a.target_value-a.start_value)*p);bid=Math.max(bid,price);bids.push({dealer:dealerNames[i%dealerNames.length],amount:price,emoji:['🏢','🚘','🤝','💼','🔑','🏁'][i%6]})}
  return{...a,currentBid:Math.min(bid,a.target_value),bids,timeLeftMs:Math.max(0,end-now),ended:now>=end}
}
function settleAuction(a,price=null){const live=currentAuction(a);const vehicle=vehicleRow(a.vehicle_id,a.user_id);if(!vehicle||vehicle.status!=='owned')return live;const sold=money(price??(live.ended?a.target_value:live.currentBid));db.exec('BEGIN IMMEDIATE');try{const u=db.prepare('SELECT * FROM users WHERE id=?').get(a.user_id);db.prepare("UPDATE owned_vehicles SET status='sold' WHERE id=?").run(a.vehicle_id);db.prepare("UPDATE system_auctions SET status='sold',sold_at=?,sold_price=? WHERE id=?").run(nowIso(),sold,a.id);db.prepare('UPDATE users SET balance=balance+?,sales=sales+1,profit=profit+?,xp=xp+?,reputation=reputation+? WHERE id=?').run(sold,sold-vehicle.buy_price-vehicle.service_spent,80,3,a.user_id);db.prepare('INSERT INTO balance_transactions VALUES(?,?,?,?,?,?,?,?)').run(uid(),a.user_id,'system_sale',sold,u.balance,u.balance+sold,JSON.stringify({vehicleId:a.vehicle_id,auctionId:a.id}),nowIso());db.exec('COMMIT')}catch(e){try{db.exec('ROLLBACK')}catch{}throw e}bumpDaily(a.user_id,'sell',1);refreshLevel(a.user_id);return{...live,status:'sold',sold_price:sold,ended:true,timeLeftMs:0}}
function settleExpiredFor(userId){const rows=db.prepare("SELECT * FROM system_auctions WHERE user_id=? AND status='active'").all(userId);for(const a of rows){if(Date.now()>=new Date(a.ends_at).getTime())settleAuction(a)}}
function requireAdmin(user,res){if(!isAdminTelegramId(user.telegram_id)){json(res,403,{error:'forbidden'});return false}return true}
function audit(adminId,action,target,metadata={}){db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(uid(),adminId,action,target,JSON.stringify(metadata),nowIso())}

async function api(req,res,url){
  try{
    const user=ensureUser(req);if(!user)return json(res,401,{error:'unauthorized'});if(user.blocked)return json(res,403,{error:'blocked'});settleExpiredFor(user.id);
    if(req.method==='GET'&&url.pathname==='/api/me')return json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),config:{searchCost:SEARCH_COST,inspectionCost:OFFER_INSPECTION_COST}});
    if(req.method==='GET'&&url.pathname==='/api/game/current')return json(res,200,{offer:offerFor(user.id)});
    if(req.method==='POST'&&url.pathname==='/api/game/search'){
      const b=await readBody(req),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);const max=unlockedTier(levelFromXp(fresh.xp));const tier=Math.max(1,Math.min(max,Number(b.tier)||max));txBalance(user.id,'search',-SEARCH_COST,{tier});db.prepare('UPDATE users SET searches=searches+1,xp=xp+5 WHERE id=?').run(user.id);refreshLevel(user.id);const o=generateOffer({...fresh,searches:fresh.searches},tier);saveOffer(user.id,o);return json(res,200,{offer:o,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))})
    }
    if(req.method==='POST'&&url.pathname==='/api/game/inspect'){
      const o=offerFor(user.id);if(!o)return json(res,404,{error:'offer_not_found'});if(o.inspected)return json(res,200,{offer:o});txBalance(user.id,'offer_inspection',-OFFER_INSPECTION_COST,{offerId:o.id});o.inspected=true;saveOffer(user.id,o);db.prepare('UPDATE users SET inspections=inspections+1,xp=xp+8,reputation=reputation+1 WHERE id=?').run(user.id);bumpDaily(user.id,'inspect',1);refreshLevel(user.id);return json(res,200,{offer:o,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))})
    }
    if(req.method==='POST'&&url.pathname==='/api/game/buy'){
      const o=offerFor(user.id);if(!o)return json(res,404,{error:'offer_not_found'});txBalance(user.id,'car_buy',-o.sellerPrice,{offerId:o.id,brand:o.brand,model:o.model});insertOwned(user.id,o);db.prepare('UPDATE users SET buys=buys+1,xp=xp+20,reputation=reputation+1 WHERE id=?').run(user.id);clearOffer(user.id);refreshLevel(user.id);return json(res,200,{ok:true,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),vehicleId:o.id})
    }
    if(req.method==='POST'&&url.pathname==='/api/game/skip'){clearOffer(user.id);return json(res,200,{ok:true})}
    if(req.method==='GET'&&url.pathname==='/api/garage'){
      const rows=db.prepare(`SELECT ov.*,vc.brand,vc.model,vc.generation,vc.tier,vc.country,vc.category,vc.image_key imageKey FROM owned_vehicles ov JOIN vehicle_catalog vc ON vc.id=ov.catalog_id WHERE ov.owner_id=? AND ov.status='owned' ORDER BY ov.created_at DESC`).all(user.id).map(shapeVehicle);return json(res,200,{vehicles:rows})
    }
    const vm=url.pathname.match(/^\/api\/garage\/([^/]+)$/);if(req.method==='GET'&&vm){const v=vehicleRow(vm[1],user.id);if(!v)return json(res,404,{error:'vehicle_not_found'});return json(res,200,{vehicle:shapeVehicle(v),quickSell:quickSellValue(v)})}
    const vi=url.pathname.match(/^\/api\/garage\/([^/]+)\/inspect$/);if(req.method==='POST'&&vi){const v=vehicleRow(vi[1],user.id);if(!v||v.status!=='owned')return json(res,404,{error:'vehicle_not_found'});if(v.inspected)return json(res,200,{vehicle:shapeVehicle(v)});txBalance(user.id,'garage_inspection',-800,{vehicleId:v.id});db.prepare('UPDATE owned_vehicles SET inspected=1 WHERE id=?').run(v.id);db.prepare('UPDATE users SET inspections=inspections+1,xp=xp+8 WHERE id=?').run(user.id);refreshLevel(user.id);return json(res,200,{vehicle:shapeVehicle(vehicleRow(v.id,user.id))})}
    const vr=url.pathname.match(/^\/api\/garage\/([^/]+)\/repair$/);if(req.method==='POST'&&vr){const b=await readBody(req),v=vehicleRow(vr[1],user.id);if(!v||v.status!=='owned')return json(res,404,{error:'vehicle_not_found'});let faults=JSON.parse(v.faults_json||'[]');const key=String(b.key||'');let cost=0,gain=0,valueGain=0;
      if(key==='detail'){if(serviceAlreadyDone(v.id,key))return json(res,409,{error:'service_already_done'});cost=1800;gain=1;valueGain=.015}else if(key==='paint'){if(serviceAlreadyDone(v.id,key))return json(res,409,{error:'service_already_done'});cost=6500;gain=4;valueGain=.06}else{const idx=faults.findIndex(f=>f.key===key);if(idx<0)return json(res,404,{error:'fault_not_found'});const f=faults[idx];cost=f.cost;gain=f.gain;valueGain=f.valueGain;faults.splice(idx,1)}
      txBalance(user.id,'repair',-cost,{vehicleId:v.id,key});const newCond=Math.min(100,v.condition+gain),rawValue=money(v.current_value*(1+valueGain)),maxAdded=money(Math.max(cost*1.4,v.current_value*.08)),newValue=Math.min(rawValue,v.current_value+maxAdded);db.prepare('UPDATE owned_vehicles SET condition=?,current_value=?,faults_json=?,service_spent=service_spent+?,inspected=1 WHERE id=?').run(newCond,newValue,JSON.stringify(faults),cost,v.id);db.prepare('INSERT INTO vehicle_service_history VALUES(?,?,?,?,?,?,?,?)').run(uid(),v.id,user.id,key,cost,v.current_value,newValue,nowIso());db.prepare('UPDATE users SET repairs=repairs+1,xp=xp+12,reputation=reputation+1 WHERE id=?').run(user.id);bumpDaily(user.id,'repair',1);refreshLevel(user.id);return json(res,200,{vehicle:shapeVehicle(vehicleRow(v.id,user.id)),cost})
    }
    const qs=url.pathname.match(/^\/api\/garage\/([^/]+)\/quick-sell$/);if(req.method==='POST'&&qs){const v=vehicleRow(qs[1],user.id);if(!v||v.status!=='owned')return json(res,404,{error:'vehicle_not_found'});if(db.prepare("SELECT 1 FROM system_auctions WHERE vehicle_id=? AND status='active'").get(v.id))return json(res,409,{error:'auction_active'});const price=quickSellValue(v);const a={id:uid(),vehicle_id:v.id,user_id:user.id,start_value:price,target_value:price,created_at:nowIso(),ends_at:nowIso(),status:'active'};db.prepare('INSERT INTO system_auctions(id,vehicle_id,user_id,start_value,target_value,ends_at,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(a.id,v.id,user.id,price,price,a.ends_at,'active',a.created_at);const sold=settleAuction(a,price);return json(res,200,{sale:sold,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))})}
    const as=url.pathname.match(/^\/api\/garage\/([^/]+)\/auction$/);if(req.method==='POST'&&as){const v=vehicleRow(as[1],user.id);if(!v||v.status!=='owned')return json(res,404,{error:'vehicle_not_found'});const ex=db.prepare("SELECT * FROM system_auctions WHERE vehicle_id=? AND status='active'").get(v.id);if(ex)return json(res,200,{auction:currentAuction(ex)});const start=money(v.current_value*.84),target=money(v.current_value*(.97+Math.min(.09,(v.condition-60)/500)));const created=nowIso(),ends=new Date(Date.now()+30000).toISOString(),id=uid();db.prepare('INSERT INTO system_auctions(id,vehicle_id,user_id,start_value,target_value,ends_at,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,v.id,user.id,start,target,ends,'active',created);return json(res,200,{auction:currentAuction(db.prepare('SELECT * FROM system_auctions WHERE id=?').get(id))})}
    if(req.method==='GET'&&url.pathname==='/api/auctions'){settleExpiredFor(user.id);const active=db.prepare("SELECT sa.*,vc.brand,vc.model,vc.image_key imageKey,ov.plate,ov.region,ov.current_value FROM system_auctions sa JOIN owned_vehicles ov ON ov.id=sa.vehicle_id JOIN vehicle_catalog vc ON vc.id=ov.catalog_id WHERE sa.user_id=? AND sa.status='active' ORDER BY sa.created_at DESC").all(user.id).map(currentAuction);const history=db.prepare("SELECT sa.*,vc.brand,vc.model,vc.image_key imageKey,ov.plate,ov.region FROM system_auctions sa JOIN owned_vehicles ov ON ov.id=sa.vehicle_id JOIN vehicle_catalog vc ON vc.id=ov.catalog_id WHERE sa.user_id=? AND sa.status='sold' ORDER BY sa.sold_at DESC LIMIT 20").all(user.id);return json(res,200,{active,history})}
    const ag=url.pathname.match(/^\/api\/auction\/([^/]+)$/);if(req.method==='GET'&&ag){let a=db.prepare('SELECT * FROM system_auctions WHERE id=? AND user_id=?').get(ag[1],user.id);if(!a)return json(res,404,{error:'auction_not_found'});if(a.status==='active'&&Date.now()>=new Date(a.ends_at).getTime())a=settleAuction(a);return json(res,200,{auction:a.status==='active'?currentAuction(a):a})}
    const aa=url.pathname.match(/^\/api\/auction\/([^/]+)\/accept$/);if(req.method==='POST'&&aa){const a=db.prepare("SELECT * FROM system_auctions WHERE id=? AND user_id=? AND status='active'").get(aa[1],user.id);if(!a)return json(res,404,{error:'auction_not_found'});const live=currentAuction(a);const sold=settleAuction(a,live.currentBid);return json(res,200,{auction:sold,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))})}
    if(req.method==='GET'&&url.pathname==='/api/tasks'){
      const d=todayKey();const defs=[
        {key:'inspect2',label:'Проверь 2 машины',emoji:'🔍',target:2,current:Math.min(dailyValue(user.id,'inspect'),2),reward:6000},
        {key:'repair1',label:'Почини машину',emoji:'🔧',target:1,current:Math.min(dailyValue(user.id,'repair'),1),reward:9000},
        {key:'sell1',label:'Закрой 1 сделку',emoji:'🤝',target:1,current:Math.min(dailyValue(user.id,'sell'),1),reward:12000}
      ].map(t=>({...t,claimed:!!db.prepare('SELECT 1 FROM claimed_tasks WHERE user_id=? AND task_key=? AND claim_date=?').get(user.id,t.key,d)}));return json(res,200,{tasks:defs})
    }
    const tc=url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);if(req.method==='POST'&&tc){const m={inspect2:{ok:dailyValue(user.id,'inspect')>=2,reward:6000},repair1:{ok:dailyValue(user.id,'repair')>=1,reward:9000},sell1:{ok:dailyValue(user.id,'sell')>=1,reward:12000}},t=m[tc[1]];if(!t||!t.ok)return json(res,409,{error:'task_not_done'});try{db.prepare('INSERT INTO claimed_tasks VALUES(?,?,?)').run(user.id,tc[1],todayKey())}catch{return json(res,409,{error:'already_claimed'})}txBalance(user.id,'task_reward',t.reward,{key:tc[1]});addProgress(user.id,{xp:20,reputation:1});return json(res,200,{reward:t.reward})}
    if(req.method==='GET'&&url.pathname==='/api/ranking'){const rows=db.prepare("SELECT u.id,u.username,u.first_name,u.level,u.balance,u.profit,u.sales,COALESCE(SUM(CASE WHEN ov.status='owned' THEN ov.current_value ELSE 0 END),0) garage_value,u.balance+COALESCE(SUM(CASE WHEN ov.status='owned' THEN ov.current_value ELSE 0 END),0) capital FROM users u LEFT JOIN owned_vehicles ov ON ov.owner_id=u.id GROUP BY u.id ORDER BY profit DESC,capital DESC LIMIT 100").all();return json(res,200,{ranking:rows})}
    if(req.method==='GET'&&url.pathname==='/api/daily'){const r=db.prepare('SELECT * FROM daily_rewards WHERE user_id=?').get(user.id)||{streak:0,last_claim_date:null};const rewards=[3000,4000,5000,6000,7000,9000,15000];return json(res,200,{...r,canClaim:r.last_claim_date!==todayKey(),nextReward:rewards[r.streak%7]})}
    if(req.method==='POST'&&url.pathname==='/api/daily/claim'){const r=db.prepare('SELECT * FROM daily_rewards WHERE user_id=?').get(user.id)||{streak:0,last_claim_date:null};if(r.last_claim_date===todayKey())return json(res,409,{error:'already_claimed'});const rewards=[3000,4000,5000,6000,7000,9000,15000],reward=rewards[r.streak%7],streak=(r.streak%7)+1;db.prepare('INSERT INTO daily_rewards(user_id,last_claim_date,streak) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_claim_date=excluded.last_claim_date,streak=excluded.streak').run(user.id,todayKey(),streak);txBalance(user.id,'daily_reward',reward);return json(res,200,{reward,streak})}
    if(req.method==='GET'&&url.pathname==='/api/stats')return json(res,200,{stats:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),transactions:db.prepare('SELECT type,amount,created_at FROM balance_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(user.id)});
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
    if(req.method==='GET'&&url.pathname==='/api/achievements'){const u=publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id));const items=[['🚘','Первая покупка',u.buys>=1],['🔧','Первый ремонт',u.repairs>=1],['🤝','Первая продажа',u.sales>=1],['💸','100 000 ₽ прибыли',u.profit>=100000],['⭐','5 уровень',u.level>=5],['🏁','Топ-класс открыт',u.unlockedTier>=5]].map(([emoji,name,done])=>({emoji,name,done}));return json(res,200,{items})}
    if(req.method==='GET'&&url.pathname==='/api/rules')return json(res,200,{items:['🔎 Поиск автомобиля стоит 1 000 ₽.','🧪 Диагностика показывает скрытые дефекты до покупки.','🔧 Ремонт повышает состояние и стоимость машины.','🔨 На торгах за машину конкурируют системные дилеры.','💸 Можно продать системе сразу дешевле или подождать торги.','⭐ С ростом уровня открываются новые классы машин.']})
    if(req.method==='GET'&&url.pathname==='/api/dealer-tiers'){const u=publicUser(user);return json(res,200,{tiers:u.tiers,level:u.level,unlockedTier:u.unlockedTier})}

    if(url.pathname.startsWith('/api/admin/')){
      if(!requireAdmin(user,res))return;
      if(req.method==='GET'&&url.pathname==='/api/admin/overview'){const overview={users:db.prepare('SELECT COUNT(*) c FROM users').get().c,activeToday:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(todayKey()).c,totalBalance:db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s,searches:db.prepare('SELECT COALESCE(SUM(searches),0) s FROM users').get().s,vehicles:db.prepare("SELECT COUNT(*) c FROM owned_vehicles WHERE status='owned'").get().c,sales:db.prepare('SELECT COALESCE(SUM(sales),0) s FROM users').get().s,profit:db.prepare('SELECT COALESCE(SUM(profit),0) s FROM users').get().s};const users=db.prepare('SELECT id,telegram_id,username,first_name,level,xp,balance,reputation,searches,buys,sales,profit,blocked,last_seen FROM users ORDER BY last_seen DESC LIMIT 100').all();return json(res,200,{overview,users})}
      const m=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(balance|level|reputation|block|grant-car|reset)$/);if(req.method==='POST'&&m){const targetId=Number(m[1]),action=m[2],target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)return json(res,404,{error:'user_not_found'});const b=await readBody(req);
        if(action==='balance'){const amount=Math.max(-10000000,Math.min(10000000,Math.round(Number(b.amount)||0)));txBalance(targetId,'admin_balance',amount,{admin:user.id});audit(user.id,'balance',targetId,{amount})}
        else if(action==='level'){const level=Math.max(1,Math.min(30,Number(b.level)||1));const xp=(level-1)*250;db.prepare('UPDATE users SET level=?,xp=? WHERE id=?').run(level,xp,targetId);audit(user.id,'level',targetId,{level})}
        else if(action==='reputation'){const reputation=Math.max(0,Math.min(9999,Number(b.reputation)||0));db.prepare('UPDATE users SET reputation=? WHERE id=?').run(reputation,targetId);audit(user.id,'reputation',targetId,{reputation})}
        else if(action==='block'){const blocked=b.blocked?1:0;db.prepare('UPDATE users SET blocked=? WHERE id=?').run(blocked,targetId);audit(user.id,'block',targetId,{blocked})}
        else if(action==='grant-car'){const o=generateOffer({...target,searches:Math.max(1,target.searches)},Math.min(5,Number(b.tier)||1));o.sellerPrice=0;insertOwned(targetId,o);audit(user.id,'grant_car',targetId,{brand:o.brand,model:o.model})}
        else if(action==='reset'){db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM current_offers WHERE user_id=?').run(targetId);db.prepare('DELETE FROM system_auctions WHERE user_id=?').run(targetId);db.prepare('DELETE FROM owned_vehicles WHERE owner_id=?').run(targetId);db.prepare('DELETE FROM balance_transactions WHERE user_id=?').run(targetId);db.prepare('DELETE FROM daily_rewards WHERE user_id=?').run(targetId);db.prepare('DELETE FROM claimed_tasks WHERE user_id=?').run(targetId);db.prepare('UPDATE users SET level=1,xp=0,balance=100000,reputation=0,searches=0,buys=0,sales=0,profit=0,inspections=0,repairs=0 WHERE id=?').run(targetId);db.exec('COMMIT')}catch(e){try{db.exec('ROLLBACK')}catch{}throw e}audit(user.id,'reset',targetId)}
        return json(res,200,{ok:true})
      }
      if(req.method==='GET'&&url.pathname==='/api/admin/audit')return json(res,200,{items:db.prepare('SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT 100').all()});
      return json(res,404,{error:'not_found'});
    }
    return json(res,404,{error:'not_found'});
  }catch(e){console.error(e);const code=['insufficient_funds','service_already_done','already_claimed'].includes(e.message)?409:e.message==='forbidden'?403:['bad_json','body_too_large'].includes(e.message)?400:500;return json(res,code,{error:e.message||'server_error'})}
}

function serveStatic(req,res,url){let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);rel=path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');const root=path.join(__dirname,'public'),file=path.join(root,rel);if(!file.startsWith(root)){res.writeHead(403);return res.end()}fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'||ext==='.js'||ext==='.css'?'no-store, max-age=0':'public, max-age=86400','Pragma':'no-cache','Expires':'0',...securityHeaders()});fs.createReadStream(file).pipe(res)})}

initDb();
const server=http.createServer((req,res)=>{const url=new URL(req.url,WEBAPP_URL);if(url.pathname==='/healthz')return json(res,200,{ok:true,service:'perekup',version:'5.2.0',botConfigured:!!BOT_TOKEN,webAppConfigured:!!publicWebAppUrl(),telegramPolling});if(url.pathname.startsWith('/api/'))return api(req,res,url);return serveStatic(req,res,url)});
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)server.listen(PORT,()=>{console.log(`PEREKUP v5.2.0 running on http://localhost:${PORT}`);startTelegramPolling().catch(e=>console.error('Telegram bot fatal:',e))});
export {money,levelFromXp,unlockedTier,valueFor,makeFaults,tierMeta,faultCatalog,SEARCH_COST,OFFER_INSPECTION_COST};
