import {GAME,DROP_TIERS,RARITIES,STARTER_DROP_JACKPOT,USERNAME_RULES} from './config.mjs';
import {buildGeneratedHandle,isValidHandle,scoreHandle,rarityFromValue} from './generator.mjs';
import {analyzeUsername,visualTier} from './valuation.mjs';
import {levelFromXp,progressionFromXp,grantXp} from './progression.mjs';
import {
  uid,nowIso,todayKey,txBalance,bumpTask,bumpSeasonScore,activeSeason,premiumActive,collectionLimit,
  activeCollectionCount,assetStats,systemSellValue,compactShowcase,randomUnit
} from './economy.mjs';

export const isPremium=premiumActive;

export function ensureUser(db,tg){
  const id=String(tg.id),ts=nowIso();let u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id);
  if(!u){
    db.prepare('INSERT INTO users(telegram_id,username,first_name,balance,free_drops,created_at,last_seen) VALUES(?,?,?,?,?,?,?)')
      .run(id,tg.username||'',tg.first_name||'Игрок',GAME.startBalance,GAME.freeDrops,ts,ts);
    u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(id);
  }else{
    const nextUsername=tg.username||u.username,nextName=tg.first_name||u.first_name,lastSeen=Date.parse(u.last_seen||'')||0;
    if(nextUsername!==u.username||nextName!==u.first_name||Date.now()-lastSeen>=60000){
      db.prepare('UPDATE users SET username=?,first_name=?,last_seen=? WHERE id=?').run(nextUsername,nextName,ts,u.id);
      u=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
    }
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
function starterValueBand(mode){
  if(mode==='good')return [STARTER_DROP_JACKPOT.goodMin,STARTER_DROP_JACKPOT.goodMax];
  if(mode==='rare')return [STARTER_DROP_JACKPOT.rareMin,STARTER_DROP_JACKPOT.rareMax];
  if(mode==='big')return [STARTER_DROP_JACKPOT.bigMin,STARTER_DROP_JACKPOT.bigMax];
  if(mode==='ultra')return [STARTER_DROP_JACKPOT.ultraMin,Number.MAX_SAFE_INTEGER];
  return [STARTER_DROP_JACKPOT.normalMin,STARTER_DROP_JACKPOT.normalMax];
}
export function starterDropMode(roll=randomUnit()){
  const r=Math.max(0,Math.min(.999999999,Number(roll)||0));
  const ultra=STARTER_DROP_JACKPOT.ultraChance,big=ultra+STARTER_DROP_JACKPOT.bigChance,rare=big+STARTER_DROP_JACKPOT.rareChance;
  if(r<ultra)return 'ultra';
  if(r<big)return 'big';
  if(r<rare)return 'rare';
  return 'normal';
}
function pickTemplate(db,tierKey='basic',rng=randomUnit,player=null){
  const tier=normalizeTier(tierKey),starter=tier.key==='basic';
  let starterMode=starter?starterDropMode(rng()):null;
  const streak=Math.max(0,Number(player?.bad_drop_streak||0)),luck=Math.max(0,Math.min(100,Number(player?.luck_points||0)));
  if(starter&&starterMode==='normal'){
    if(streak>=20)starterMode='rare';
    else if(streak>=10||luck>=75)starterMode='good';
  }
  const profile=starter?(starterMode==='ultra'?'ULTRA':starterMode==='big'?'RARE':starterMode==='rare'?'RARE':'COMMON'):weightedTierProfile(tier,rng),now=nowIso();

  // The basic 3K tier is cheap most of the time, but keeps tiny real jackpot chances.
  if(starter&&(starterMode==='ultra'||starterMode==='big')){
    const min=starterMode==='ultra'?STARTER_DROP_JACKPOT.ultraMin:STARTER_DROP_JACKPOT.bigMin;
    const max=starterMode==='ultra'?Number.MAX_SAFE_INTEGER:STARTER_DROP_JACKPOT.bigMax;
    const specials=db.prepare("SELECT * FROM username_templates WHERE special=1 AND category NOT IN ('wheel','admin') AND active=1 AND current_supply<max_supply AND base_value>=? AND base_value<=? LIMIT 300").all(min,max);
    const available=specials.filter(x=>!handleUnavailable(db,x.handle));
    if(available.length)return available[Math.floor(rng()*available.length)];
    if(starterMode==='ultra')starterMode='big';
  }

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
  const starterBand=starter?starterValueBand(starterMode):null;
  for(let i=0;i<(starter?650:80);i++){
    const handle=buildGeneratedHandle(profile,rng);if(!isValidHandle(handle)||handleUnavailable(db,handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(starter&&t?.special)continue;
    const base=t?Number(t.base_value):scoreHandle(handle),rarity=rarityFromValue(base);
    if(starter&&(base<starterBand[0]||base>starterBand[1]))continue;
    if(!t){
      const supply=1,assessment=analyzeUsername(handle);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,username_score,visual_tier,quality_json,created_at) VALUES(?,?,?,?,0,?,0,1,?,?,?,?)')
        .run(handle,rarity,base,supply,'generated',assessment.score,visualTier(base,assessment.score),JSON.stringify(assessment.breakdown||{}),nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(starter&&t?.special)continue;
    if(t&&t.active&&t.current_supply<1&&!handleUnavailable(db,t.handle))return t;
  }
  throw new Error('no_username_available');
}
export function shapeInstance(r){
  if(!r)return null;
  let quality={};try{quality=r.quality_json?JSON.parse(r.quality_json):{}}catch{}
  return {
    id:r.id,handle:'@'+r.handle,rawHandle:r.handle,rarity:r.rarity,value:r.value,sellValue:systemSellValue(r.value),
    score:Number(r.username_score||0),visual:r.visual_tier||visualTier(r.value,r.username_score),
    quality,instanceNumber:r.instance_number,maxSupply:r.max_supply,status:r.status,obtainedAt:r.obtained_at
  };
}

function activeCosmetics(db,userId){
  const row=db.prepare('SELECT theme_key,frame_key,card_key FROM user_cosmetic_settings WHERE user_id=?').get(userId)||{};
  return {theme:row.theme_key||'',frame:row.frame_key||'',card:row.card_key||''};
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
  const prog=progressionFromXp(user.xp);
  return {
    id:user.id,telegramId:user.telegram_id,username:user.username,firstName:user.first_name,balance:user.balance,freeDrops:user.free_drops,
    level:prog.level,xp:prog.xp,title:prog.title,levelXp:prog.levelXp,nextLevelXp:prog.nextLevelXp,levelProgress:prog.progress,xpRemaining:prog.remaining,
    luck:Number(user.luck_points||0),badDropStreak:Number(user.bad_drop_streak||0),totalEarned:Number(user.total_earned||0),bestDropValue:Number(user.best_drop_value||0),
    premium:isPremium(user),collectionCount:owned,activeCollectionCount:active,collectionValue:assets.value,bestValue:assets.best,capital,rank,
    cosmetics:activeCosmetics(db,user.id)
  };
}
export function homeData(db,user){
  const pending=shapeInstance(findPending(db,user.id));
  const last=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND obtained_type='drop' ORDER BY obtained_at DESC LIMIT 1").get(user.id));
  return {user:publicUser(db,user),pending,last,config:{dropCost:GAME.dropCost,dropTiers:DROP_TIERS,maxCollection:collectionLimit(user),usernameRules:{gameMin:USERNAME_RULES.minLength,gameMax:USERNAME_RULES.maxLength,basicTelegramMin:5}}};
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
    const tier=normalizeTier(tierKey),effectiveTier=tier.key,template=pickTemplate(db,effectiveTier,randomUnit,fresh),instanceNumber=1;
    if(template.current_supply>=1||handleUnavailable(db,template.handle))throw new Error('sold_out');
    const useFree=fresh.free_drops>0&&effectiveTier==='basic',cost=useFree?0:tier.cost;
    if(cost>0)txBalance(db,user.id,'drop',-cost,{requestId,tier:effectiveTier});
    else db.prepare('UPDATE users SET free_drops=free_drops-1 WHERE id=?').run(user.id);
    const changed=db.prepare('UPDATE username_templates SET current_supply=1,max_supply=1 WHERE id=? AND current_supply=0').run(template.id).changes;
    if(!changed)throw new Error('sold_out');
    // pickTemplate already resolved the canonical value for this username.
    // Do not rescore it here: rescoring bypassed the starter-tier value band and
    // was the reason 3K drops could suddenly become 10K-15K instances.
    const value=Math.max(200,Math.round(Number(template.base_value)||200)),rarity=rarityFromValue(value),assessment=analyzeUsername(template.handle);
    const score=Number(template.username_score||assessment.score||0),visual=visualTier(value,score),quality=JSON.stringify(assessment.breakdown||{});
    if(template.rarity!==rarity||template.username_score!==score||template.visual_tier!==visual)
      db.prepare('UPDATE username_templates SET rarity=?,max_supply=1,username_score=?,visual_tier=?,quality_json=? WHERE id=?').run(rarity,score,visual,quality,template.id);
    const instanceId=uid(),season=activeSeason(db);
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id,username_score,visual_tier,quality_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(instanceId,template.id,template.handle,rarity,value,1,1,user.id,'pending',nowIso(),'drop',season?.id||null,score,visual,quality);
    db.prepare('INSERT INTO drop_requests(request_id,user_id,instance_id,cost,tier,created_at) VALUES(?,?,?,?,?,?)').run(requestId,user.id,instanceId,cost,effectiveTier,nowIso());
    db.prepare('INSERT INTO drop_history(id,user_id,instance_id,handle,rarity,value,action,created_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),user.id,instanceId,template.handle,rarity,value,'pending',nowIso());

    const paid=cost>0,loss=paid&&value<cost;
    let luck=Math.max(0,Math.min(100,Number(fresh.luck_points||0))),streak=Math.max(0,Number(fresh.bad_drop_streak||0));
    if(loss){streak+=1;luck=Math.min(100,luck+(value<cost*.5?5:3))}
    else if(paid){streak=0;luck=Math.max(0,luck-(value>=cost*3?25:10))}
    db.prepare('UPDATE users SET luck_points=?,bad_drop_streak=?,best_drop_value=MAX(best_drop_value,?) WHERE id=?').run(luck,streak,value,user.id);
    grantXp(db,user.id,15,'drop',{tier:effectiveTier,value,visual});
    bumpTask(db,user.id,'drop',1);bumpSeasonScore(db,user.id,15);
    if(value>=15000)bumpTask(db,user.id,'rare',1);
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
      grantXp(db,user.id,5,'keep_username',{instanceId:inst.id,value:inst.value});
      bumpTask(db,user.id,'keep',1);bumpSeasonScore(db,user.id,8);
    }else if(action==='sell'){
      const payout=systemSellValue(inst.value);
      db.prepare("UPDATE username_instances SET status='sold' WHERE id=?").run(inst.id);
      db.prepare("UPDATE drop_history SET action='sold' WHERE instance_id=?").run(inst.id);
      txBalance(db,user.id,'system_sale',payout,{instanceId:inst.id,handle:inst.handle,estimatedValue:inst.value});
      grantXp(db,user.id,5,'sell_username',{instanceId:inst.id,value:inst.value});
      bumpTask(db,user.id,'sell',1);bumpSeasonScore(db,user.id,5);
    }else throw new Error('bad_action');
  })();
  return {instance:shapeInstance(db.prepare('SELECT * FROM username_instances WHERE id=?').get(inst.id)),user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
export function collection(db,user,{sort='new',digits='all',page=1}={}){
  const where=["i.owner_id=?","i.status='owned'"],args=[user.id];
  if(digits==='none')where.push("i.handle NOT GLOB '*[0-9]*'");
  if(digits==='with')where.push("i.handle GLOB '*[0-9]*'");
  const order={
    new:'i.obtained_at DESC',old:'i.obtained_at ASC',
    expensive:'i.value DESC,i.obtained_at DESC',cheap:'i.value ASC,i.obtained_at DESC',
    short:'LENGTH(i.handle) ASC,i.value DESC',long:'LENGTH(i.handle) DESC,i.value DESC'
  }[sort]||'i.obtained_at DESC';
  const size=8,p=Math.max(1,Number(page)||1),offset=(p-1)*size;
  const from='FROM username_instances i WHERE '+where.join(' AND ');
  const rows=db.prepare(`SELECT i.* ${from} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,size,offset).map(shapeInstance);
  const total=db.prepare(`SELECT COUNT(*) c ${from}`).get(...args).c;
  const summary=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(value),0) value FROM username_instances WHERE owner_id=? AND status='owned'").get(user.id);
  return {items:rows,total,page:p,pages:Math.max(1,Math.ceil(total/size)),summary,filters:{sort,digits}};
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
export const DAILY_TASK_POOL=Object.freeze([
  {key:'drop1',label:'Открыть drop',target:1,reward:450,source:'drop'},
  {key:'drop2',label:'Открыть 2 drops',target:2,reward:800,source:'drop'},
  {key:'drop3',label:'Открыть 3 drops',target:3,reward:1200,source:'drop'},
  {key:'drop5',label:'Открыть 5 drops',target:5,reward:1800,source:'drop'},
  {key:'sell1',label:'Продать username',target:1,reward:700,source:'sell'},
  {key:'sell2',label:'Продать 2 usernames',target:2,reward:1100,source:'sell'},
  {key:'sell3',label:'Продать 3 usernames',target:3,reward:1500,source:'sell'},
  {key:'keep1',label:'Оставить username',target:1,reward:450,source:'keep'},
  {key:'keep2',label:'Оставить 2 usernames',target:2,reward:750,source:'keep'},
  {key:'games1',label:'Сыграть 1 мини-игру',target:1,reward:500,source:'games'},
  {key:'games3',label:'Сыграть 3 мини-игры',target:3,reward:1300,source:'games'},
  {key:'games5',label:'Сыграть 5 мини-игр',target:5,reward:1900,source:'games'},
  {key:'games7',label:'Сыграть 7 мини-игр',target:7,reward:2600,source:'games'},
  {key:'games10',label:'Сыграть 10 мини-игр',target:10,reward:3800,source:'games'},
  {key:'hunt1',label:'Выиграть Охоту за username',target:1,reward:1000,source:'hunt_win'},
  {key:'hunt2',label:'Выиграть Охоту за username дважды',target:2,reward:1700,source:'hunt_win'},
  {key:'play_hunt',label:'Сыграть в Охоту за username',target:1,reward:700,source:'game_hunt'},
  {key:'play_higher',label:'Сыграть в Выше / ниже',target:1,reward:700,source:'game_higher'},
  {key:'play_editor',label:'Сыграть в Редактор',target:1,reward:700,source:'game_editor'},
  {key:'play_build',label:'Сыграть в Собери username',target:1,reward:700,source:'game_build'},
  {key:'play_price',label:'Сыграть в Угадай цену',target:1,reward:700,source:'game_price'},
  {key:'market1',label:'Купить username',target:1,reward:800,source:'market_buy'},
  {key:'market2',label:'Купить 2 usernames',target:2,reward:1300,source:'market_buy'},
  {key:'rare1',label:'Получить username от 15K ₽',target:1,reward:1200,source:'rare'},
  {key:'rare2',label:'Получить 2 username от 15K ₽',target:2,reward:1800,source:'rare'},
  {key:'nodigits1',label:'Получить username без цифр',target:1,reward:650,source:'nodigits'},
  {key:'nodigits2',label:'Получить 2 username без цифр',target:2,reward:1050,source:'nodigits'},
  {key:'wheel1',label:'Открыть колесо',target:1,reward:500,source:'wheel'},
  {key:'upgrade1',label:'Сделать upgrade',target:1,reward:900,source:'upgrade'},
  {key:'upgrade2',label:'Сделать 2 upgrades',target:2,reward:1500,source:'upgrade'},
  {key:'gift1',label:'Передать username',target:1,reward:900,source:'gift'},
  {key:'profile1',label:'Посмотреть профиль игрока',target:1,reward:400,source:'view_profile'},
  {key:'invite1',label:'Пригласить друга',target:1,reward:1000,source:'invite'},
  {key:'invite2',label:'Пригласить 2 друзей',target:2,reward:1700,source:'invite'},
  {key:'trade3',label:'Купить 3 username на рынке',target:3,reward:1600,source:'market_buy'}
]);
function dailyTaskDefs(user){
  const seed=String(user.id)+':'+todayKey();
  let x=0;for(let i=0;i<seed.length;i++)x=(Math.imul(x,31)+seed.charCodeAt(i))>>>0;
  const rows=DAILY_TASK_POOL.map((task,i)=>({task,rank:((Math.imul((x^i)>>>0,2654435761)>>>0))})).sort((a,b)=>a.rank-b.rank);
  const picked=[],sources=new Set();
  for(const row of rows){
    if(picked.length>=6)break;
    if(sources.has(row.task.source)&&picked.length<4)continue;
    picked.push(row.task);sources.add(row.task.source);
  }
  for(const row of rows)if(picked.length<6&&!picked.includes(row.task))picked.push(row.task);
  return picked;
}
export function tasks(db,user){
  return dailyTaskDefs(user).map(t=>{
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
    grantXp(db,user.id,25,'task',{key});bumpSeasonScore(db,user.id,25);
  })();
  return {reward:t.reward,user:publicUser(db,db.prepare('SELECT * FROM users WHERE id=?').get(user.id))};
}
function luckProfile(db,u){
  const rows=db.prepare(`SELECT h.value,COALESCE(r.cost,0) cost
    FROM drop_history h LEFT JOIN drop_requests r ON r.instance_id=h.instance_id
    WHERE h.user_id=? ORDER BY h.created_at DESC LIMIT 500`).all(u.id);
  const paid=rows.filter(x=>Number(x.cost)>0),totalCost=paid.reduce((s,x)=>s+Number(x.cost||0),0),totalValue=paid.reduce((s,x)=>s+Number(x.value||0),0);
  const profitable=paid.filter(x=>Number(x.value)>=Number(x.cost)).length,profitRate=paid.length?profitable/paid.length:0;
  const roi=totalCost?totalValue/totalCost:1,bestMultiplier=paid.reduce((m,x)=>Math.max(m,Number(x.value||0)/Math.max(1,Number(x.cost||0))),0);
  const badStreak=Math.max(0,Number(u.bad_drop_streak||0)),protection=Math.max(0,Math.min(100,Number(u.luck_points||0)));
  const score=Math.max(0,Math.min(100,Math.round(50+(roi-.85)*50+(profitRate-.25)*20-badStreak*1.25)));
  const status=score>=85?'legendary':score>=68?'lucky':score>=55?'good':score>=40?'neutral':score>=22?'unlucky':'cursed';
  const protectionState=badStreak>=20?'rare':badStreak>=10||protection>=75?'good':'normal';
  return {score,status,protection,protectionState,badStreak,totalDrops:rows.length,paidDrops:paid.length,profitableDrops:profitable,
    roi:Number(roi.toFixed(2)),bestMultiplier:Number(bestMultiplier.toFixed(2))};
}
export function profile(db,userId){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!u)return null;
  const p=publicUser(db,u);
  const best=shapeInstance(db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status IN ('owned','market') ORDER BY value DESC LIMIT 1").get(userId));
  const friends=db.prepare('SELECT COUNT(*) c FROM friends WHERE user_id=?').get(userId).c;
  const gifts=db.prepare('SELECT COUNT(*) c FROM username_transfers WHERE from_user_id=?').get(userId).c;
  const deals=db.prepare('SELECT COUNT(*) c FROM market_transactions WHERE buyer_id=? OR seller_id=?').get(userId,userId).c;
  const bestSeason=db.prepare('SELECT MIN(position) p FROM season_history WHERE user_id=? AND position IS NOT NULL').get(userId).p;
  const cosmetics=db.prepare('SELECT type,key,source,created_at FROM user_cosmetics WHERE user_id=? ORDER BY created_at DESC').all(userId),activeCosmeticState=activeCosmetics(db,userId);
  const achievements=db.prepare('SELECT achievement_key,xp_reward,unlocked_at FROM achievement_unlocks WHERE user_id=? ORDER BY unlocked_at DESC LIMIT 3').all(userId);
  return {...p,best,friendsCount:friends,giftsCount:gifts,marketDeals:deals,bestSeason:bestSeason||null,cosmetics,activeCosmetics:activeCosmeticState,achievements,luckStats:luckProfile(db,u)};
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
