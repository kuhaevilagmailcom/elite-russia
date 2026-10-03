import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,collectionLimit,activeCollectionCount,compactShowcase} from './economy.mjs';
import {isValidHandle,stableScoreHandle,rarityFromValue} from './generator.mjs';

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
  const users=db.prepare(`SELECT u.id,u.telegram_id,u.username,u.first_name,u.balance,u.blocked,u.last_seen,
    COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN 1 ELSE 0 END),0) username_count,
    COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) username_value,
    u.balance+COALESCE(SUM(CASE WHEN i.status IN ('pending','owned','market') THEN i.value ELSE 0 END),0) capital
    FROM users u LEFT JOIN username_instances i ON i.owner_id=u.id
    ${w} GROUP BY u.id ORDER BY u.last_seen DESC LIMIT ? OFFSET ?`).all(...args,limit,off);
  const total=db.prepare(`SELECT COUNT(*) c FROM users u ${w}`).get(...args).c;
  return {
    stats:{
      users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
      activeToday:db.prepare('SELECT COUNT(*) c FROM users WHERE last_seen>=?').get(new Date(Date.now()-86400000).toISOString()).c,
      money:db.prepare('SELECT COALESCE(SUM(balance),0) s FROM users').get().s,
      activeUsernames:db.prepare("SELECT COUNT(*) c FROM username_instances WHERE status IN ('pending','owned','market')").get().c
    },
    users,total,page:p,pages:Math.max(1,Math.ceil(total/limit))
  };
}
export function adminUserDetail(db,userId){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(Number(userId));if(!u)throw new Error('user_not_found');
  const items=db.prepare("SELECT id,handle,rarity,value,status,obtained_at FROM username_instances WHERE owner_id=? AND status IN ('pending','owned','market') ORDER BY value DESC LIMIT 250").all(u.id)
    .map(x=>({...x,handle:'@'+x.handle}));
  return {user:{id:u.id,telegramId:u.telegram_id,username:u.username,firstName:u.first_name,balance:u.balance,blocked:!!u.blocked,premiumUntil:u.premium_until,capital:userCapital(db,u.id),usernameCount:items.length},items};
}
export function adminSetBalance(db,admin,targetId,delta){
  const n=Math.max(-1000000000,Math.min(1000000000,Math.round(Number(delta)||0)));
  const result=db.transaction(()=>{const before=db.prepare('SELECT * FROM users WHERE id=?').get(targetId);if(!before)throw new Error('user_not_found');const balance=txBalance(db,targetId,'admin_balance',n,{admin:admin.id});audit(db,admin.id,'balance',targetId,{delta:n,balance});return balance})();
  return {ok:true,balance:result};
}
export function adminSetBlocked(db,admin,targetId,blocked){
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
  const v=Math.max(200,Math.round(Number(value)||stableScoreHandle(raw))),rarity=rarityFromValue(v),ts=nowIso();
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
  const v=Math.max(200,Math.round(Number(value)||0));if(!v)throw new Error('bad_price');
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
    db.prepare('DELETE FROM drop_requests WHERE user_id=?').run(u.id);db.prepare('DELETE FROM drop_history WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM task_progress WHERE user_id=?').run(u.id);db.prepare('DELETE FROM task_claims WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM wheel_claims WHERE user_id=?').run(u.id);db.prepare('DELETE FROM wheel_history WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM upgrade_sessions WHERE user_id=?').run(u.id);db.prepare('DELETE FROM upgrade_history WHERE user_id=?').run(u.id);db.prepare('DELETE FROM upgrade_progress WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM season_stats WHERE user_id=?').run(u.id);db.prepare('DELETE FROM season_rewards WHERE user_id=?').run(u.id);db.prepare('DELETE FROM season_history WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM balance_transactions WHERE user_id=?').run(u.id);
    db.prepare('UPDATE users SET balance=?,free_drops=?,xp=0,level=1 WHERE id=?').run(GAME.startBalance,GAME.freeDrops,u.id);
    audit(db,admin.id,'reset_user',u.id,{});
    return {ok:true};
  })();
}
export function resetAllUsers(db,admin,confirmation){
  if(String(confirmation||'')!=='RESET USERNAME')throw new Error('reset_confirmation_required');
  return db.transaction(()=>{
    db.prepare('DELETE FROM inventory').run();db.prepare('DELETE FROM profile_showcase').run();
    db.prepare('DELETE FROM market_listings').run();db.prepare('DELETE FROM market_transactions').run();
    db.prepare('DELETE FROM drop_requests').run();db.prepare('DELETE FROM drop_history').run();db.prepare('DELETE FROM balance_transactions').run();
    db.prepare('DELETE FROM task_progress').run();db.prepare('DELETE FROM task_claims').run();
    db.prepare('DELETE FROM referrals').run();db.prepare('DELETE FROM friends').run();db.prepare('DELETE FROM referral_rewards').run();db.prepare('DELETE FROM username_transfers').run();
    db.prepare('DELETE FROM wheel_claims').run();db.prepare('DELETE FROM wheel_history').run();
    db.prepare('DELETE FROM upgrade_sessions').run();db.prepare('DELETE FROM upgrade_history').run();db.prepare('DELETE FROM upgrade_progress').run();
    db.prepare('DELETE FROM season_stats').run();db.prepare('DELETE FROM season_rewards').run();db.prepare('DELETE FROM season_history').run();
    db.prepare('DELETE FROM username_instances').run();db.prepare('UPDATE username_templates SET current_supply=0').run();
    db.prepare('UPDATE users SET balance=?,free_drops=?,xp=0,level=1,blocked=0').run(GAME.startBalance,GAME.freeDrops);
    audit(db,admin.id,'reset_all','all',{});
    return {ok:true};
  })();
}
