import {GAME,DROP_TIERS,RARITIES} from './config.mjs';
import {buildGeneratedHandle,isValidHandle,scoreHandle,rarityFromValue} from './generator.mjs';
import {
  uid,nowIso,todayKey,txBalance,bumpTask,bumpSeasonScore,activeSeason,premiumActive,collectionLimit,
  activeCollectionCount,assetStats,systemSellValue,compactShowcase,randomUnit
} from './economy.mjs';

export function levelFromXp(xp){return Math.max(1,1+Math.floor(Number(xp||0)/250))}
export const isPremium=premiumActive;

export function ensureUser(db,tg){
  const id=String(tg.id),ts=nowIso();let u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id);
  if(!u){
    db.prepare('INSERT INTO users(telegram_id,username,first_name,balance,free_drops,created_at,last_seen) VALUES(?,?,?,?,?,?,?)')
      .run(id,tg.username||'',tg.first_name||'Игрок',GAME.startBalance,GAME.freeDrops,ts,ts);
    u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id);
  }else{
    db.prepare('UPDATE users SET username=?,first_name=?,last_seen=? WHERE id=?').run(tg.username||u.username,tg.first_name||u.first_name,ts,u.id);
    u=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  }
  return u;
}
function findPending(db,userId){return db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status='pending' ORDER BY obtained_at DESC LIMIT 1").get(userId)}
function normalizeTier(key){return DROP_TIERS[key]||DROP_TIERS.basic}
function weightedTierProfile(tier,rng=randomUnit){
  const x=rng()*100;let sum=0;
  for(const profile of RARITIES){sum+=Number(tier.weights[profile]||0);if(x<sum)return profile}
  return 'COMMON';
}
function handleUnavailable(db,handle){
  if(db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(handle))return true;
  return !!db.prepare('SELECT 1 FROM upgrade_sessions WHERE target_handle=? AND used_at IS NULL AND expires_at>? LIMIT 1').get(handle,nowIso());
}
function starterDropValue(rawValue){
  const scaled=Math.round((Math.max(200,Number(rawValue)||200)/20)/50)*50;
  return Math.max(400,Math.min(3500,scaled));
}
function pickTemplate(db,tierKey='basic',rng=randomUnit){
  const tier=normalizeTier(tierKey),starter=tier.key==='basic',profile=starter?'COMMON':weightedTierProfile(tier,rng),now=nowIso();

  // The $3K starter drop is intentionally its own low-value pool.
  // Event and special templates have canonical prices that can be far above the
  // entry ticket, so they are reserved for the higher paid tiers.
  if(!starter&&rng()<.18){
    const eventPool=db.prepare(`SELECT t.* FROM event_templates et
      JOIN events e ON e.id=et.event_id
      JOIN username_templates t ON t.id=et.template_id
      WHERE e.active=1 AND e.start_at<=? AND e.end_at>=? AND t.active=1 AND t.rarity=? AND t.current_supply<t.max_supply
      LIMIT 200`).all(now,now,profile);
    const availableEvents=eventPool.filter(x=>!handleUnavailable(db,x.handle));if(availableEvents.length)return availableEvents[Math.floor(rng()*availableEvents.length)];
  }
  const specialChance=starter?0:({COMMON:.002,RARE:.012,EPIC:.05,LEGEND:.18,ULTRA:.55}[profile]||0);
  if(specialChance>0&&rng()<specialChance){
    const specials=db.prepare("SELECT * FROM username_templates WHERE special=1 AND category NOT IN ('wheel','admin') AND rarity=? AND active=1 AND current_supply<max_supply LIMIT 200").all(profile);
    const availableSpecials=specials.filter(x=>!handleUnavailable(db,x.handle));if(availableSpecials.length)return availableSpecials[Math.floor(rng()*availableSpecials.length)];
  }
  for(let i=0;i<80;i++){
    const handle=buildGeneratedHandle(profile,rng);if(!isValidHandle(handle)||handleUnavailable(db,handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(starter&&t?.special)continue;
    if(!t){
      const supply=1,rawBase=scoreHandle(handle),base=starter?starterDropValue(rawBase):rawBase,rarity=rarityFromValue(base);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)')
        .run(handle,rarity,base,supply,'generated',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(starter&&t?.special)continue;
    if(t&&t.active&&t.current_supply<1&&!handleUnavailable(db,t.handle)){
      const rawBase=t.special?t.base_value:scoreHandle(t.handle),base=starter?starterDropValue(rawBase):rawBase,rarity=rarityFromValue(base);
      if(t.base_value!==base||t.rarity!==rarity){db.prepare('UPDATE username_templates SET base_value=?,rarity=?,max_supply=1 WHERE id=?').run(base,rarity,t.id);t={...t,base_value:base,rarity,max_supply:1}}
      return t;
    }
  }
  throw new Error('no_username_available');
}
export function shapeInstance(r){
  return r?{
    id:r.id,handle:'@'+r.handle,rawHandle:r.handle,rarity:r.rarity,value:r.value,sellValue:systemSellValue(r.value),
    instanceNumber:r.instance_number,maxSupply:r.max_supply,status:r.status,obtainedAt:r.obtained_at
  }:null;
}
export function publicUser(db,user){
  const assets=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(value),0) value,COALESCE(MAX(value),0) best FROM username_instances WHERE owner_id=? AND status IN ('pending','owned','market')").get(user.id);
  const owned=db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status='owned'").get(user.id).c;
  const active=activeCollectionCount(db,user.id),capital=Number(user.balance||0)+Number(assets.value||0);
  const rank=db.prepare(`SELECT COUNT(*)+1 rank FROM (
    SELECT u.id,u.balance+COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) capital
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id
    WHERE u.blocked=0 GROUP BY u.id HAVING capital>?
  )`).get(capital).rank;
  return {
    id:user.id,telegramId:user.telegram_id,username:user.username,firstName:user.first_name,balance:user.balance,freeDrops:user.free_drops,
    level:levelFromXp(user.xp),xp:user.xp,premium:isPremium(user),collectionCount:owned,activeCollectionCount:active,
    collectionValue:assets.value,bestValue:assets.best,capital,rank
  };
}
export function homeData(db,user){
  const pending=shapeInstance(findPending(db,user.id));
  const last=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND obtained_type='drop' ORDER BY obtained_at DESC LIMIT 1").get(user.id));
  return {user:publicUser(db,user),pending,last,config:{dropCost:GAME.dropCost,dropTiers:DROP_TIERS,maxCollection:collectionLimit(user),showcaseSlots:isPremium(user)?GAME.premiumShowcaseSlots:GAME.showcaseSlots}};
}
export function createDrop(db,user,requestId,tierKey='basic'){
  if(!requestId||requestId.length>100)throw new Error('bad_request_id');
  const old=db.prepare('SELECT * FROM drop_requests WHERE request_id=? AND user_id=?').get(requestId,user.id);
  if(old){
    const inst=db.prepare('SELECT * FROM username_instances WHERE id=?').get(old.instance_id);
    return {instance:shapeInstance(inst),user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),replayed:true,tier:old.tier||'basic',cost:old.cost};
  }
  if(findPending(db,user.id))throw new Error('pending_drop');
  if(activeCollectionCount(db,user.id)>=collectionLimit(user))throw new Error('collection_full');
  const made=db.transaction(()=>{
    const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    if(activeCollectionCount(db,user.id)>=collectionLimit(fresh))throw new Error('collection_full');
    const tier=normalizeTier(tierKey),effectiveTier=tier.key,template=pickTemplate(db,effectiveTier),instanceNumber=1;
    if(template.current_supply>=1||handleUnavailable(db,template.handle))throw new Error('sold_out');
    const useFree=fresh.free_drops>0&&effectiveTier==='basic',cost=useFree?0:tier.cost;
    if(cost>0)txBalance(db,user.id,'drop',-cost,{requestId,tier:effectiveTier});
    else db.prepare('UPDATE users SET free_drops=free_drops-1 WHERE id=?').run(user.id);
    const changed=db.prepare('UPDATE username_templates SET current_supply=1,max_supply=1 WHERE id=? AND current_supply=0').run(template.id).changes;
    if(!changed)throw new Error('sold_out');
    // pickTemplate already resolved the canonical value for this username.
    // Do not rescore it here: rescoring bypassed the starter-tier value band and
    // was the reason $3K drops could suddenly become $10K-$15K instances.
    const value=Math.max(200,Math.round(Number(template.base_value)||200)),rarity=rarityFromValue(value);
    if(template.rarity!==rarity)db.prepare('UPDATE username_templates SET rarity=?,max_supply=1 WHERE id=?').run(rarity,template.id);
    const instanceId=uid(),season=activeSeason(db);
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(instanceId,template.id,template.handle,rarity,value,1,1,user.id,'pending',nowIso(),'drop',season?.id||null);
    db.prepare('INSERT INTO drop_requests(request_id,user_id,instance_id,cost,tier,created_at) VALUES(?,?,?,?,?,?)').run(requestId,user.id,instanceId,cost,effectiveTier,nowIso());
    db.prepare('INSERT INTO drop_history(id,user_id,instance_id,handle,rarity,value,action,created_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),user.id,instanceId,template.handle,rarity,value,'pending',nowIso());
    db.prepare('UPDATE users SET xp=xp+15 WHERE id=?').run(user.id);
    bumpTask(db,user.id,'drop',1);bumpSeasonScore(db,user.id,15);
    if(['RARE','EPIC','LEGEND','ULTRA'].includes(rarity))bumpTask(db,user.id,'rare',1);
    if(!/\d/.test(template.handle))bumpTask(db,user.id,'nodigits',1);
    return {instanceId,effectiveTier,cost};
  })();
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  return {instance:shapeInstance(db.prepare('SELECT * FROM username_instances WHERE id=?').get(made.instanceId)),user:publicUser(db,fresh),replayed:false,tier:made.effectiveTier,cost:made.cost};
}
export function resolveDrop(db,user,instanceId,action){
  const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='pending'").get(instanceId,user.id);if(!inst)throw new Error('pending_not_found');
  db.transaction(()=>{
    if(action==='keep'){
      db.prepare("UPDATE username_instances SET status='owned' WHERE id=?").run(inst.id);
      db.prepare('INSERT OR IGNORE INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(inst.id,user.id,nowIso());
      db.prepare("UPDATE drop_history SET action='kept' WHERE instance_id=?").run(inst.id);
      bumpTask(db,user.id,'keep',1);bumpSeasonScore(db,user.id,8);
    }else if(action==='sell'){
      const payout=systemSellValue(inst.value);
      db.prepare("UPDATE username_instances SET status='sold' WHERE id=?").run(inst.id);
      db.prepare("UPDATE drop_history SET action='sold' WHERE instance_id=?").run(inst.id);
      txBalance(db,user.id,'system_sale',payout,{instanceId:inst.id,handle:inst.handle,estimatedValue:inst.value});
      bumpTask(db,user.id,'sell',1);bumpSeasonScore(db,user.id,5);
    }else throw new Error('bad_action');
  })();
  return {instance:shapeInstance(db.prepare('SELECT * FROM username_instances WHERE id=?').get(inst.id)),user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
export function collection(db,user,{sort='new',digits='all',showcase='all',page=1}={}){
  const where=["i.owner_id=?","i.status='owned'"],args=[user.id];
  if(digits==='none')where.push("i.handle NOT GLOB '*[0-9]*'");
  if(digits==='with')where.push("i.handle GLOB '*[0-9]*'");
  if(showcase==='only')where.push('ps.instance_id IS NOT NULL');
  const order={
    new:'i.obtained_at DESC',old:'i.obtained_at ASC',
    expensive:'i.value DESC,i.obtained_at DESC',cheap:'i.value ASC,i.obtained_at DESC',
    short:'LENGTH(i.handle) ASC,i.value DESC',long:'LENGTH(i.handle) DESC,i.value DESC'
  }[sort]||'i.obtained_at DESC';
  const size=8,p=Math.max(1,Number(page)||1),offset=(p-1)*size;
  const from='FROM username_instances i LEFT JOIN profile_showcase ps ON ps.instance_id=i.id AND ps.user_id=i.owner_id WHERE '+where.join(' AND ');
  const rows=db.prepare(`SELECT i.*,CASE WHEN ps.instance_id IS NULL THEN 0 ELSE 1 END in_showcase ${from} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,size,offset)
    .map(r=>({...shapeInstance(r),inShowcase:!!r.in_showcase}));
  const total=db.prepare(`SELECT COUNT(*) c ${from}`).get(...args).c;
  const summary=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(value),0) value FROM username_instances WHERE owner_id=? AND status='owned'").get(user.id);
  return {items:rows,total,page:p,pages:Math.max(1,Math.ceil(total/size)),summary,filters:{sort,digits,showcase}};
}
export function leaderboard(db){
  const rows=db.prepare(`
    SELECT u.id,u.username,u.first_name,u.balance,
      COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) username_value,
      u.balance+COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) capital,
      MAX(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE NULL END) best,
      (SELECT x.handle FROM username_instances x
       WHERE x.owner_id=u.id AND x.status IN ('pending','owned','market')
       ORDER BY x.value DESC,x.obtained_at ASC LIMIT 1) best_handle
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id
    WHERE u.blocked=0
    GROUP BY u.id
    ORDER BY capital DESC,u.id ASC
    LIMIT 100
  `).all();
  return rows.map((r,i)=>({...r,position:i+1,best_handle:r.best_handle?'@'+r.best_handle:null}));
}
export function tasks(db,user){
  const defs=[
    {key:'drop3',label:'Получить 3 usernames',target:3,reward:600,source:'drop'},
    {key:'rare1',label:'Получить username от $15,000',target:1,reward:900,source:'rare'},
    {key:'sell1',label:'Продать username',target:1,reward:300,source:'sell'},
    {key:'market1',label:'Купить username на рынке',target:1,reward:500,source:'market_buy'},
    {key:'keep2',label:'Оставить 2 usernames',target:2,reward:350,source:'keep'},
    {key:'nodigits1',label:'Получить username без цифр',target:1,reward:450,source:'nodigits'},
    {key:'invite1',label:'Пригласить друга',target:1,reward:700,source:'invite'}
  ];
  return defs.map(t=>{
    const p=db.prepare('SELECT value FROM task_progress WHERE user_id=? AND progress_date=? AND task_key=?').get(user.id,todayKey(),t.source)?.value||0;
    const claimed=!!db.prepare('SELECT 1 FROM task_claims WHERE user_id=? AND claim_date=? AND task_key=?').get(user.id,todayKey(),t.key);
    return {...t,current:Math.min(t.target,p),claimed};
  });
}
export function claimTask(db,user,key){
  const t=tasks(db,user).find(x=>x.key===key);if(!t)throw new Error('task_not_found');if(t.current<t.target)throw new Error('task_not_done');if(t.claimed)throw new Error('already_claimed');
  db.transaction(()=>{
    db.prepare('INSERT INTO task_claims(user_id,claim_date,task_key) VALUES(?,?,?)').run(user.id,todayKey(),key);
    txBalance(db,user.id,'task_reward',t.reward,{key});
    db.prepare('UPDATE users SET xp=xp+25 WHERE id=?').run(user.id);bumpSeasonScore(db,user.id,25);
  })();
  return {reward:t.reward,user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
export function profile(db,userId){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!u)return null;
  const p=publicUser(db,u);
  const showcase=db.prepare(`SELECT i.*,s.position FROM profile_showcase s JOIN username_instances i ON i.id=s.instance_id WHERE s.user_id=? AND i.status='owned' ORDER BY s.position`).all(userId).map(shapeInstance);
  const best=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status IN ('owned','market') ORDER BY value DESC LIMIT 1").get(userId));
  const friends=db.prepare('SELECT COUNT(*) c FROM friends WHERE user_id=?').get(userId).c;
  const gifts=db.prepare('SELECT COUNT(*) c FROM username_transfers WHERE from_user_id=?').get(userId).c;
  const deals=db.prepare('SELECT COUNT(*) c FROM market_transactions WHERE buyer_id=? OR seller_id=?').get(userId,userId).c;
  const bestSeason=db.prepare('SELECT MIN(position) p FROM season_history WHERE user_id=? AND position IS NOT NULL').get(userId).p;
  const cosmetics=db.prepare('SELECT type,key,source,created_at FROM user_cosmetics WHERE user_id=? ORDER BY created_at DESC').all(userId);
  return {...p,showcase,best,friendsCount:friends,giftsCount:gifts,marketDeals:deals,bestSeason:bestSeason||null,cosmetics};
}
export function sellOwnedUsername(db,user,instanceId){
  const result=db.transaction(()=>{
    const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);
    if(!inst)throw new Error('not_owned');
    const payout=systemSellValue(inst.value);
    db.prepare("UPDATE username_instances SET status='sold' WHERE id=?").run(inst.id);
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(inst.id);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(inst.id);compactShowcase(db,user.id);
    const balance=txBalance(db,user.id,'collection_sale',payout,{instanceId:inst.id,handle:inst.handle,estimatedValue:inst.value});
    bumpTask(db,user.id,'sell',1);bumpSeasonScore(db,user.id,5);
    return {handle:'@'+inst.handle,value:inst.value,sellValue:payout,balance};
  })();
  return {ok:true,...result,user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
export function setShowcase(db,user,instanceId){
  const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);if(!inst)throw new Error('not_owned');
  const exists=db.prepare('SELECT 1 FROM profile_showcase WHERE user_id=? AND instance_id=?').get(user.id,instanceId);
  if(exists){db.prepare('DELETE FROM profile_showcase WHERE user_id=? AND instance_id=?').run(user.id,instanceId);compactShowcase(db,user.id);return {ok:true,active:false}}
  compactShowcase(db,user.id);
  const max=isPremium(user)?GAME.premiumShowcaseSlots:GAME.showcaseSlots,current=db.prepare('SELECT COUNT(*) c FROM profile_showcase WHERE user_id=?').get(user.id).c;
  if(current>=max)throw new Error('showcase_full');
  const pos=(db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM profile_showcase WHERE user_id=?').get(user.id).p)||1;
  db.prepare('INSERT INTO profile_showcase(user_id,instance_id,position) VALUES(?,?,?)').run(user.id,instanceId,pos);
  return {ok:true,active:true};
}
export function adminOverview(db){
  const usersList=db.prepare('SELECT id,telegram_id,username,first_name,balance,xp,blocked,last_seen FROM users ORDER BY last_seen DESC LIMIT 100').all()
    .map(x=>({...x,level:levelFromXp(x.xp)}));
  return {
    users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
    activeToday:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(todayKey()).c,
    drops:db.prepare('SELECT COUNT(*) c FROM drop_history').get().c,
    money:db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s,
    instances:db.prepare('SELECT COUNT(*) c FROM username_instances').get().c,
    rarities:db.prepare('SELECT rarity,COUNT(*) count FROM username_instances GROUP BY rarity').all(),
    usersList,templates:db.prepare('SELECT * FROM username_templates WHERE special=1 ORDER BY id DESC LIMIT 100').all()
  };
}
export function adminAction(db,admin,targetId,action,value){
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)throw new Error('user_not_found');
  db.transaction(()=>{
    if(action==='balance'){
      txBalance(db,target.id,'admin_balance',Math.max(-10000000,Math.min(10000000,Number(value)||0)),{admin:admin.id});
    }else if(action==='block'){
      const blocked=value?1:0;
      db.prepare('UPDATE users SET blocked=? WHERE id=?').run(blocked,target.id);
      if(blocked){
        const active=db.prepare("SELECT id,instance_id FROM market_listings WHERE seller_id=? AND status='active'").all(target.id);
        for(const l of active){
          db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE id=?").run(nowIso(),l.id);
          db.prepare("UPDATE username_instances SET status='owned' WHERE id=? AND owner_id=?").run(l.instance_id,target.id);
        }
      }
    }else throw new Error('bad_admin_action');
    db.prepare('INSERT INTO admin_audit(id,admin_id,action,target,metadata,created_at) VALUES(?,?,?,?,?,?)')
      .run(uid(),admin.id,action,String(targetId),JSON.stringify({value}),nowIso());
  })();
}
