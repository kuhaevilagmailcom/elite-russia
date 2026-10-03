import crypto from 'node:crypto';
import {GAME,RARITY_WEIGHTS} from './config.mjs';
import {buildGeneratedHandle,generatedSupply,isValidHandle,scoreHandle,weightedRarity} from './generator.mjs';

const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const today=()=>now().slice(0,10);
export function levelFromXp(xp){return Math.max(1,1+Math.floor(Number(xp||0)/250))}
export function isPremium(user){return !!(user?.premium_until&&new Date(user.premium_until).getTime()>Date.now())}

export function ensureUser(db,tg){
  const id=String(tg.id);const ts=now();
  let u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id);
  if(!u){db.prepare('INSERT INTO users(telegram_id,username,first_name,balance,free_drops,created_at,last_seen) VALUES(?,?,?,?,?,?,?)').run(id,tg.username||'',tg.first_name||'Игрок',GAME.startBalance,GAME.freeDrops,ts,ts);u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id)}
  else{db.prepare('UPDATE users SET username=?,first_name=?,last_seen=? WHERE id=?').run(tg.username||u.username,tg.first_name||u.first_name,ts,u.id);u=db.prepare('SELECT * FROM users WHERE id=?').get(u.id)}
  return u;
}
function bump(db,userId,key,delta=1){db.prepare('INSERT INTO task_progress(user_id,progress_date,task_key,value) VALUES(?,?,?,?) ON CONFLICT(user_id,progress_date,task_key) DO UPDATE SET value=value+excluded.value').run(userId,today(),key,delta)}
function txBalance(db,userId,type,amount,metadata={}){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);const next=u.balance+amount;if(next<0)throw new Error('insufficient_funds');
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(next,userId);
  db.prepare('INSERT INTO balance_transactions VALUES(?,?,?,?,?,?,?,?)').run(uid(),userId,type,amount,u.balance,next,JSON.stringify(metadata),now());
  return next;
}
function findPending(db,userId){return db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status='pending' ORDER BY obtained_at DESC LIMIT 1").get(userId)}
function activeSeason(db){return db.prepare('SELECT * FROM seasons WHERE active=1 ORDER BY id DESC LIMIT 1').get()}

function pickTemplate(db){
  if(Math.random()<.018){
    const special=db.prepare('SELECT * FROM username_templates WHERE special=1 AND active=1 AND current_supply<max_supply ORDER BY RANDOM() LIMIT 1').get();
    if(special)return special;
  }
  for(let i=0;i<30;i++){
    const rarity=weightedRarity();const handle=buildGeneratedHandle(rarity);if(!isValidHandle(handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      const supply=generatedSupply(rarity);const base=scoreHandle(handle,rarity,1,supply);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)').run(handle,rarity,base,supply,'generated',now());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(t&&t.active&&t.current_supply<t.max_supply)return t;
  }
  throw new Error('no_username_available');
}
function shapeInstance(r){return r?{id:r.id,handle:'@'+r.handle,rawHandle:r.handle,rarity:r.rarity,value:r.value,instanceNumber:r.instance_number,maxSupply:r.max_supply,status:r.status,obtainedAt:r.obtained_at}:null}

export function publicUser(db,user){
  const coll=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(value),0) value,COALESCE(MAX(value),0) best FROM username_instances WHERE owner_id=? AND status='owned'").get(user.id);
  const rank=db.prepare(`SELECT COUNT(*)+1 rank FROM (
    SELECT owner_id,SUM(value) total FROM username_instances WHERE status='owned' GROUP BY owner_id HAVING total>?
  )`).get(coll.value).rank;
  return {id:user.id,telegramId:user.telegram_id,username:user.username,firstName:user.first_name,balance:user.balance,freeDrops:user.free_drops,level:levelFromXp(user.xp),xp:user.xp,premium:isPremium(user),collectionCount:coll.count,collectionValue:coll.value,bestValue:coll.best,rank};
}

export function homeData(db,user){
  const pending=shapeInstance(findPending(db,user.id));
  const last=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? ORDER BY obtained_at DESC LIMIT 1").get(user.id));
  return {user:publicUser(db,user),pending,last,config:{dropCost:GAME.dropCost,maxCollection:isPremium(user)?GAME.premiumMaxCollection:GAME.maxCollection,showcaseSlots:isPremium(user)?GAME.premiumShowcaseSlots:GAME.showcaseSlots}};
}

export function createDrop(db,user,requestId){
  if(!requestId||requestId.length>100)throw new Error('bad_request_id');
  const old=db.prepare('SELECT * FROM drop_requests WHERE request_id=? AND user_id=?').get(requestId,user.id);
  if(old){const inst=db.prepare('SELECT * FROM username_instances WHERE id=?').get(old.instance_id);return {instance:shapeInstance(inst),user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),replayed:true}}
  if(findPending(db,user.id))throw new Error('pending_drop');
  const owned=db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status='owned'").get(user.id).c;
  const limit=isPremium(user)?GAME.premiumMaxCollection:GAME.maxCollection;if(owned>=limit)throw new Error('collection_full');
  const run=db.transaction(()=>{
    const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    const template=pickTemplate(db);
    const instanceNumber=template.current_supply+1;if(instanceNumber>template.max_supply)throw new Error('sold_out');
    const cost=fresh.free_drops>0?0:GAME.dropCost;
    if(cost>0)txBalance(db,user.id,'drop',-cost,{requestId});
    if(fresh.free_drops>0)db.prepare('UPDATE users SET free_drops=free_drops-1 WHERE id=?').run(user.id);
    db.prepare('UPDATE username_templates SET current_supply=current_supply+1 WHERE id=? AND current_supply<max_supply').run(template.id);
    const value=template.special?Math.round(template.base_value*(instanceNumber===1?1.32:instanceNumber<=5?1.14:1)):scoreHandle(template.handle,template.rarity,instanceNumber,template.max_supply);
    const instanceId=uid(),season=activeSeason(db);
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(instanceId,template.id,template.handle,template.rarity,value,instanceNumber,template.max_supply,user.id,'pending',now(),'drop',season?.id||null);
    db.prepare('INSERT INTO drop_requests VALUES(?,?,?,?,?)').run(requestId,user.id,instanceId,cost,now());
    db.prepare('INSERT INTO drop_history VALUES(?,?,?,?,?,?,?,?)').run(uid(),user.id,instanceId,template.handle,template.rarity,value,'pending',now());
    db.prepare('UPDATE users SET xp=xp+15 WHERE id=?').run(user.id);bump(db,user.id,'drop',1);
    if(['RARE','EPIC','LEGEND','ULTRA'].includes(template.rarity))bump(db,user.id,'rare',1);
    return instanceId;
  });
  const instanceId=run();const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  return {instance:shapeInstance(db.prepare('SELECT * FROM username_instances WHERE id=?').get(instanceId)),user:publicUser(db,fresh),replayed:false};
}

export function resolveDrop(db,user,instanceId,action){
  const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='pending'").get(instanceId,user.id);if(!inst)throw new Error('pending_not_found');
  const run=db.transaction(()=>{
    if(action==='keep'){
      db.prepare("UPDATE username_instances SET status='owned' WHERE id=?").run(inst.id);
      db.prepare('INSERT OR IGNORE INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(inst.id,user.id,now());
      db.prepare("UPDATE drop_history SET action='kept' WHERE instance_id=?").run(inst.id);bump(db,user.id,'keep',1);
    }else if(action==='sell'){
      db.prepare("UPDATE username_instances SET status='sold' WHERE id=?").run(inst.id);
      db.prepare("UPDATE drop_history SET action='sold' WHERE instance_id=?").run(inst.id);
      txBalance(db,user.id,'system_sale',inst.value,{instanceId:inst.id,handle:inst.handle});bump(db,user.id,'sell',1);
    }else throw new Error('bad_action');
  });run();
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  return {instance:shapeInstance(db.prepare('SELECT * FROM username_instances WHERE id=?').get(inst.id)),user:publicUser(db,fresh)};
}

export function collection(db,user,{rarity='ALL',sort='new',page=1}={}){
  const where=["owner_id=?","status='owned'"];const args=[user.id];
  if(rarity!=='ALL'){where.push('rarity=?');args.push(rarity)}
  const order={new:'obtained_at DESC',value:'value DESC',rarity:"CASE rarity WHEN 'ULTRA' THEN 5 WHEN 'LEGEND' THEN 4 WHEN 'EPIC' THEN 3 WHEN 'RARE' THEN 2 ELSE 1 END DESC,value DESC",short:'LENGTH(handle) ASC,value DESC'}[sort]||'obtained_at DESC';
  const size=12,offset=(Math.max(1,page)-1)*size;
  const rows=db.prepare(`SELECT * FROM username_instances WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,size,offset).map(shapeInstance);
  const total=db.prepare(`SELECT COUNT(*) c FROM username_instances WHERE ${where.join(' AND ')}`).get(...args).c;
  return {items:rows,total,page:Math.max(1,page),pages:Math.max(1,Math.ceil(total/size))};
}

export function leaderboard(db,mode='collection'){
  const order=mode==='best'?'best DESC':mode==='capital'?'capital DESC':'collection_value DESC';
  const rows=db.prepare(`SELECT u.id,u.username,u.first_name,u.balance,
    COALESCE(SUM(CASE WHEN i.status='owned' THEN i.value ELSE 0 END),0) collection_value,
    COALESCE(MAX(CASE WHEN i.status='owned' THEN i.value ELSE 0 END),0) best,
    u.balance+COALESCE(SUM(CASE WHEN i.status='owned' THEN i.value ELSE 0 END),0) capital,
    (SELECT handle FROM username_instances x WHERE x.owner_id=u.id AND x.status='owned' ORDER BY value DESC LIMIT 1) best_handle
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id WHERE u.blocked=0 GROUP BY u.id ORDER BY ${order} LIMIT 100`).all();
  return rows.map((r,i)=>({...r,position:i+1,best_handle:r.best_handle?'@'+r.best_handle:null}));
}

export function tasks(db,user){
  const defs=[
    {key:'drop3',label:'Получить 3 usernames',target:3,reward:2500,source:'drop'},
    {key:'rare1',label:'Получить RARE или выше',target:1,reward:3000,source:'rare'},
    {key:'keep2',label:'Оставить 2 usernames',target:2,reward:1600,source:'keep'},
    {key:'sell2',label:'Продать 2 usernames',target:2,reward:1400,source:'sell'}
  ];
  return defs.map(t=>{const p=db.prepare('SELECT value FROM task_progress WHERE user_id=? AND progress_date=? AND task_key=?').get(user.id,today(),t.source)?.value||0;const claimed=!!db.prepare('SELECT 1 FROM task_claims WHERE user_id=? AND claim_date=? AND task_key=?').get(user.id,today(),t.key);return {...t,current:Math.min(t.target,p),claimed}});
}
export function claimTask(db,user,key){
  const t=tasks(db,user).find(x=>x.key===key);if(!t)throw new Error('task_not_found');if(t.current<t.target)throw new Error('task_not_done');if(t.claimed)throw new Error('already_claimed');
  const run=db.transaction(()=>{db.prepare('INSERT INTO task_claims VALUES(?,?,?)').run(user.id,today(),key);txBalance(db,user.id,'task_reward',t.reward,{key});db.prepare('UPDATE users SET xp=xp+25 WHERE id=?').run(user.id)});run();
  return {reward:t.reward,user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
export function profile(db,userId){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!u)return null;
  const p=publicUser(db,u);
  const showcase=db.prepare(`SELECT i.*,s.position FROM profile_showcase s JOIN username_instances i ON i.id=s.instance_id WHERE s.user_id=? AND i.status='owned' ORDER BY s.position`).all(userId).map(shapeInstance);
  const best=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status='owned' ORDER BY value DESC LIMIT 1").get(userId));
  return {...p,showcase,best};
}
export function setShowcase(db,user,instanceId){
  const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);if(!inst)throw new Error('not_owned');
  const max=isPremium(user)?GAME.premiumShowcaseSlots:GAME.showcaseSlots;
  const current=db.prepare('SELECT COUNT(*) c FROM profile_showcase WHERE user_id=?').get(user.id).c;
  if(db.prepare('SELECT 1 FROM profile_showcase WHERE user_id=? AND instance_id=?').get(user.id,instanceId))return;
  if(current>=max)throw new Error('showcase_full');
  db.prepare('INSERT INTO profile_showcase(user_id,instance_id,position) VALUES(?,?,?)').run(user.id,instanceId,current+1);
}
export function adminOverview(db){
  return {
    users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
    activeToday:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(today()).c,
    drops:db.prepare('SELECT COUNT(*) c FROM drop_history').get().c,
    nc:db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s,
    instances:db.prepare('SELECT COUNT(*) c FROM username_instances').get().c,
    rarities:db.prepare('SELECT rarity,COUNT(*) count FROM username_instances GROUP BY rarity').all(),
    usersList:db.prepare('SELECT id,telegram_id,username,first_name,balance,level,xp,blocked,last_seen FROM users ORDER BY last_seen DESC LIMIT 100').all(),
    templates:db.prepare('SELECT * FROM username_templates WHERE special=1 ORDER BY id DESC LIMIT 100').all()
  };
}
export function adminAction(db,admin,targetId,action,value){
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)throw new Error('user_not_found');
  if(action==='balance')txBalance(db,target.id,'admin_balance',Math.max(-10000000,Math.min(10000000,Number(value)||0)),{admin:admin.id});
  else if(action==='block')db.prepare('UPDATE users SET blocked=? WHERE id=?').run(value?1:0,target.id);
  else throw new Error('bad_admin_action');
  db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(uid(),admin.id,action,String(targetId),JSON.stringify({value}),now());
}
