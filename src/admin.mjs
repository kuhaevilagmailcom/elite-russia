import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,collectionLimit,activeCollectionCount,compactShowcase} from './economy.mjs';
import {isValidHandle,stableScoreHandle,rarityFromValue} from './generator.mjs';
import {progressionFromXp} from './progression.mjs';
import {walletData,grantGems} from './payments.mjs';

const MAX_USERNAME_VALUE=1000000000;
function normalizeUsernameValue(value,fallback=0){
  const raw=Number(value);
  const base=Number.isFinite(raw)&&raw>0?raw:Number(fallback||0);
  if(!Number.isFinite(base)||base<=0)throw new Error('bad_price');
  return Math.max(200,Math.min(MAX_USERNAME_VALUE,Math.round(base)));
}

function audit(db,adminId,action,target,metadata={}){
  db.prepare('INSERT INTO admin_audit(id,admin_id,action,target,metadata,created_at) VALUES(?,?,?,?,?,?)')
    .run(uid(),adminId,action,String(target??''),JSON.stringify(metadata),nowIso());
}
function userCapital(db,userId){
  return db.prepare(`SELECT u.balance+COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) capital
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id WHERE u.id=? GROUP BY u.id`).get(userId)?.capital||0;
}
export function adminOverview(db,{q='',page=1,size=20}={}){
  const p=Math.max(1,Number(page)||1),limit=Math.max(5,Math.min(50,Number(size)||20)),off=(p-1)*limit,query=String(q||'').trim();
  const where=[],args=[];
  if(query){
    where.push("(u.telegram_id LIKE ? OR LOWER(COALESCE(u.username,'')) LIKE ? OR LOWER(COALESCE(u.first_name,'')) LIKE ?)");
    const like='%'+query.toLowerCase()+'%';args.push('%'+query+'%',like,like);
  }
  const w=where.length?'WHERE '+where.join(' AND '):'';
  const users=db.prepare(`SELECT u.id,u.telegram_id,u.username,u.first_name,u.balance,u.xp,u.free_drops,u.blocked,u.created_at,u.last_seen,
    COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN 1 ELSE 0 END),0) username_count,
    COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) username_value,
    u.balance+COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) capital
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id
    ${w} GROUP BY u.id ORDER BY u.last_seen DESC LIMIT ? OFFSET ?`).all(...args,limit,off)
    .map(x=>({...x,level:progressionFromXp(x.xp).level}));
  const total=db.prepare(`SELECT COUNT(*) c FROM users u ${w}`).get(...args).c;
  const now=Date.now(),m15=new Date(now-15*60000).toISOString(),h24=new Date(now-86400000).toISOString(),d7=new Date(now-7*86400000).toISOString();
  return {
    stats:{
      users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
      activeNow:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(m15).c,
      activeToday:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(h24).c,
      active7d:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(d7).c,
      newUsers24h:db.prepare('SELECT COUNT(*) c FROM users WHERE created_at>=?').get(h24).c,
      blocked:db.prepare('SELECT COUNT(*) c FROM users WHERE blocked=1').get().c,
      money:db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s,
      activeUsernames:db.prepare("SELECT COUNT(*) c FROM username_instances WHERE status IN ('pending','owned','market')").get().c,
      totalDrops:db.prepare('SELECT COUNT(*) c FROM drop_history').get().c,
      drops24h:db.prepare('SELECT COUNT(*) c FROM drop_history WHERE created_at>=?').get(h24).c,
      marketDeals24h:db.prepare('SELECT COUNT(*) c FROM market_transactions WHERE created_at>=?').get(h24).c,
      marketVolume24h:db.prepare('SELECT COALESCE(SUM(price),0) s FROM market_transactions WHERE created_at>=?').get(h24).s,
      transfers24h:db.prepare('SELECT COUNT(*) c FROM username_transfers WHERE created_at>=?').get(h24).c
    },
    users,total,page:p,pages:Math.max(1,Math.ceil(total/limit))
  };
}
export function adminUserDetail(db,userId){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(Number(userId));if(!u)throw new Error('user_not_found');
  const items=db.prepare("SELECT id,handle,rarity,value,status,obtained_at FROM username_instances WHERE owner_id=? AND status IN ('pending','owned','market') ORDER BY value DESC LIMIT 250").all(u.id)
    .map(x=>({...x,handle:'@'+x.handle}));
  const prog=progressionFromXp(u.xp);
  return {user:{id:u.id,telegramId:u.telegram_id,username:u.username,firstName:u.first_name,balance:u.balance,gems:walletData(db,u.id).gems,xp:u.xp,level:prog.level,title:prog.title,freeDrops:u.free_drops,blocked:!!u.blocked,premiumUntil:u.premium_until,createdAt:u.created_at,lastSeen:u.last_seen,capital:userCapital(db,u.id),usernameCount:items.length},items};
}
export function adminSetBalance(db,admin,targetId,delta){
  const n=Math.max(-1000000000,Math.min(1000000000,Math.round(Number(delta)||0)));
  const result=db.transaction(()=>{const before=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!before)throw new Error('user_not_found');const balance=txBalance(db,targetId,'admin_balance',n,{admin:admin.id});audit(db,admin.id,'balance',targetId,{delta:n,balance});return balance})();
  return {ok:true,balance:result};
}
export function adminGrantGems(db,admin,targetId,amount){
  const target=db.prepare('SELECT id FROM users WHERE id=?').get(Number(targetId));if(!target)throw new Error('user_not_found');
  const add=Math.max(-100000,Math.min(100000,Math.round(Number(amount)||0)));
  if(!add)throw new Error('bad_gems');
  const current=walletData(db,target.id);
  if(add<0&&current.gems<Math.abs(add))throw new Error('insufficient_gems');
  let wallet;
  if(add>0)wallet=grantGems(db,target.id,add);
  else{
    db.prepare('UPDATE currency_wallets SET gems=gems+?,updated_at=? WHERE user_id=?').run(add,nowIso(),target.id);
    wallet=walletData(db,target.id);
  }
  audit(db,admin.id,'gems',target.id,{delta:add,gems:wallet.gems});
  return {ok:true,wallet};
}
export function adminUpdateUserProgress(db,admin,targetId,{xp,freeDrops}={}){
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(Number(targetId));if(!target)throw new Error('user_not_found');
  const nextXp=Math.max(0,Math.min(1000000000,Math.round(Number(xp??target.xp)||0)));
  const nextFree=Math.max(0,Math.min(100000,Math.round(Number(freeDrops??target.free_drops)||0)));
  db.prepare('UPDATE users SET xp=?,free_drops=? WHERE id=?').run(nextXp,nextFree,target.id);
  audit(db,admin.id,'user_progress',target.id,{xp:nextXp,freeDrops:nextFree});
  const prog=progressionFromXp(nextXp);
  return {ok:true,xp:nextXp,freeDrops:nextFree,level:prog.level,title:prog.title};
}
export function adminUsernames(db,{q='',status='active',page=1,size=30}={}){
  const p=Math.max(1,Number(page)||1),limit=Math.max(10,Math.min(60,Number(size)||30)),off=(p-1)*limit,query=String(q||'').trim().toLowerCase(),filters=[],args=[];
  if(status==='active')filters.push("i.status IN ('pending','owned','market')");
  else if(['pending','owned','market','sold','admin_removed'].includes(status)){filters.push('i.status=?');args.push(status)}
  if(query){
    const like='%'+query+'%';
    filters.push("(LOWER(i.handle) LIKE ? OR LOWER(COALESCE(u.username,'')) LIKE ? OR LOWER(COALESCE(u.first_name,'')) LIKE ? OR CAST(u.id AS TEXT) LIKE ?)");
    args.push(like,like,like,'%'+query+'%');
  }
  const w=filters.length?'WHERE '+filters.join(' AND '):'';
  const items=db.prepare(`SELECT i.id,i.handle,i.rarity,i.value,i.status,i.obtained_at,u.id owner_id,u.telegram_id,u.username owner_username,u.first_name owner_name
    FROM username_instances i LEFT JOIN users u ON u.id=i.owner_id ${w}
    ORDER BY i.obtained_at DESC LIMIT ? OFFSET ?`).all(...args,limit,off)
    .map(x=>({...x,handle:'@'+x.handle}));
  const total=db.prepare(`SELECT COUNT(*) c FROM username_instances i LEFT JOIN users u ON u.id=i.owner_id ${w}`).get(...args).c;
  return {items,total,page:p,pages:Math.max(1,Math.ceil(total/limit)),status};
}
export function adminSetBlocked(db,admin,targetId,blocked){
  if(Number(targetId)===Number(admin.id)&&blocked)throw new Error('self_admin_block');
  db.transaction(()=>{
    const target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)throw new Error('user_not_found');
    db.prepare('UPDATE users SET blocked=? WHERE id=?').run(blocked?1:0,targetId);
    if(blocked){
      const active=db.prepare("SELECT id,instance_id FROM market_listings WHERE seller_id=? AND status='active'").all(targetId);
      for(const l of active){db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE id=?").run(nowIso(),l.id);db.prepare("UPDATE username_instances SET status='owned' WHERE id=?").run(l.instance_id)}
    }
    audit(db,admin.id,blocked?'block':'unblock',targetId,{});
  })();
  return {ok:true};
}
export function adminRemoveUsername(db,admin,instanceId){
  return db.transaction(()=>{
    const i=db.prepare('SELECT * FROM username_instances WHERE id=?').get(instanceId);if(!i)throw new Error('not_owned');
    db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE instance_id=? AND status='active'").run(nowIso(),i.id);
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(i.id);db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(i.id);
    db.prepare("DELETE FROM upgrade_sessions WHERE used_at IS NULL AND source_ids LIKE ?").run('%'+i.id+'%');
    db.prepare("UPDATE username_instances SET status='admin_removed' WHERE id=?").run(i.id);
    audit(db,admin.id,'remove_username',i.owner_id,{instanceId:i.id,handle:i.handle});
    return {ok:true,handle:'@'+i.handle};
  })();
}
export function adminTransferUsername(db,admin,instanceId,targetId){
  return db.transaction(()=>{
    const i=db.prepare("SELECT * FROM username_instances WHERE id=? AND status IN ('pending','owned','market')").get(instanceId);if(!i)throw new Error('not_owned');
    const target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)throw new Error('user_not_found');
    if(activeCollectionCount(db,target.id)>=collectionLimit(target))throw new Error('recipient_full');
    db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE instance_id=? AND status='active'").run(nowIso(),i.id);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(i.id);compactShowcase(db,i.owner_id);
    db.prepare("UPDATE username_instances SET owner_id=?,status='owned' WHERE id=?").run(target.id,i.id);
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT(instance_id) DO UPDATE SET user_id=excluded.user_id').run(i.id,target.id,nowIso());
    audit(db,admin.id,'transfer_username',i.owner_id,{instanceId:i.id,handle:i.handle,toUserId:target.id});
    return {ok:true,handle:'@'+i.handle};
  })();
}
export function adminAddUsername(db,admin,targetId,handle,value){
  const raw=String(handle||'').toLowerCase().replace(/^@/,'').trim();if(!isValidHandle(raw))throw new Error('bad_username');
  if(db.prepare('SELECT 1 FROM username_instances WHERE handle=?').get(raw))throw new Error('username_exists');
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!target)throw new Error('user_not_found');
  if(activeCollectionCount(db,target.id)>=collectionLimit(target))throw new Error('recipient_full');
  const v=normalizeUsernameValue(value,stableScoreHandle(raw)),rarity=rarityFromValue(v),ts=nowIso();
  return db.transaction(()=>{
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(raw);
    if(!t){
      const id=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,'admin',1,1,?)").run(raw,rarity,v,1,ts).lastInsertRowid;
      t=db.prepare('SELECT * FROM username_templates WHERE id=?').get(id);
    }else{
      if(t.current_supply>=1)throw new Error('username_exists');
      db.prepare("UPDATE username_templates SET rarity=?,base_value=?,max_supply=1,current_supply=1,category='admin',special=1,active=1 WHERE id=?").run(rarity,v,t.id);
    }
    const id=uid();db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,1,1,?,'owned',?,'admin')").run(id,t.id,raw,rarity,v,target.id,ts);
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,target.id,ts);
    audit(db,admin.id,'add_username',target.id,{instanceId:id,handle:raw,value:v});
    return {ok:true,id,handle:'@'+raw,value:v,rarity};
  })();
}
export function adminSetUsernameValue(db,admin,instanceId,value){
  const v=normalizeUsernameValue(value);
  return db.transaction(()=>{
    const i=db.prepare('SELECT * FROM username_instances WHERE id=?').get(instanceId);if(!i)throw new Error('not_owned');
    const rarity=rarityFromValue(v);
    db.prepare('UPDATE username_instances SET value=?,rarity=? WHERE id=?').run(v,rarity,i.id);
    db.prepare('UPDATE username_templates SET base_value=?,rarity=? WHERE id=?').run(v,rarity,i.template_id);
    db.prepare('UPDATE drop_history SET value=?,rarity=? WHERE instance_id=?').run(v,rarity,i.id);
    audit(db,admin.id,'set_username_value',i.owner_id,{instanceId:i.id,handle:i.handle,value:v});
    return {ok:true,value:v,rarity};
  })();
}
function releaseActiveUsernames(db,userId){
  const rows=db.prepare("SELECT id,template_id FROM username_instances WHERE owner_id=? AND status IN ('pending','owned','market')").all(userId);
  for(const r of rows){
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(r.id);db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(r.id);
    db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE instance_id=? AND status='active'").run(nowIso(),r.id);
    db.prepare('DELETE FROM username_instances WHERE id=?').run(r.id);
    db.prepare('UPDATE username_templates SET current_supply=0 WHERE id=?').run(r.template_id);
  }
}
export function resetSingleUser(db,admin,targetId){
  return db.transaction(()=>{
    const u=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!u)throw new Error('user_not_found');
    releaseActiveUsernames(db,u.id);
    const deletes=[
      ['drop_requests','user_id'],['drop_history','user_id'],['task_progress','user_id'],['task_claims','user_id'],
      ['xp_history','user_id'],['level_reward_claims','user_id'],['achievement_unlocks','user_id'],
      ['mini_game_sessions','user_id'],['mini_game_records','user_id'],['mini_game_daily_earnings','user_id'],
      ['username_lab_attempts','user_id'],['wheel_claims','user_id'],['wheel_history','user_id'],
      ['upgrade_sessions','user_id'],['upgrade_history','user_id'],['upgrade_progress','user_id'],
      ['season_stats','user_id'],['season_rewards','user_id'],['season_history','user_id'],
      ['referral_rewards','user_id'],['balance_transactions','user_id'],['profile_showcase','user_id']
    ];
    for(const [table,col] of deletes)db.prepare(`DELETE FROM ${table} WHERE ${col}=?`).run(u.id);
    db.prepare('DELETE FROM referrals WHERE referrer_id=? OR referred_id=?').run(u.id,u.id);
    db.prepare('DELETE FROM friends WHERE user_id=? OR friend_id=?').run(u.id,u.id);
    db.prepare('DELETE FROM username_transfers WHERE from_user_id=? OR to_user_id=?').run(u.id,u.id);
    db.prepare('DELETE FROM market_transactions WHERE buyer_id=? OR seller_id=?').run(u.id,u.id);
    db.prepare(`UPDATE users SET balance=?,free_drops=?,xp=0,level=1,luck_points=0,bad_drop_streak=0,total_earned=0,
      best_drop_value=0,daily_streak=0,last_daily_date=NULL WHERE id=?`).run(GAME.startBalance,GAME.freeDrops,u.id);
    audit(db,admin.id,'reset_user',u.id,{});
    return {ok:true};
  })();
}
export function resetAllUsers(db,admin,confirmation){
  if(String(confirmation||'')!=='RESET USERNAME')throw new Error('reset_confirmation_required');
  return db.transaction(()=>{
    const clearTables=[
      'inventory','profile_showcase','market_listings','market_transactions','drop_requests','drop_history','balance_transactions',
      'task_progress','task_claims','xp_history','level_reward_claims','achievement_unlocks','mini_game_sessions','mini_game_records',
      'mini_game_daily_earnings','username_lab_attempts','referrals','friends','referral_rewards','username_transfers','wheel_claims',
      'wheel_history','upgrade_sessions','upgrade_history','upgrade_progress','season_stats','season_rewards','season_history'
    ];
    for(const table of clearTables)db.prepare(`DELETE FROM ${table}`).run();
    db.prepare('DELETE FROM username_instances').run();
    db.prepare('UPDATE username_templates SET current_supply=0').run();
    db.prepare(`UPDATE users SET balance=?,free_drops=?,xp=0,level=1,luck_points=0,bad_drop_streak=0,total_earned=0,
      best_drop_value=0,daily_streak=0,last_daily_date=NULL`).run(GAME.startBalance,GAME.freeDrops);
    audit(db,admin.id,'reset_all','all',{});
    return {ok:true};
  })();
}
