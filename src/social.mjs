import {uid,nowIso,txBalance,bumpTask,bumpSeasonScore,collectionLimit,activeCollectionCount,compactShowcase} from './economy.mjs';

function rewardThreshold(db,referrerId,count){
  const rewards=[[1,'money',500],[3,'money',1500],[5,'drop',1],[10,'money',5000]];
  for(const [need,type,amount] of rewards){
    if(count<need)continue;
    const key=String(need);if(db.prepare('SELECT 1 FROM referral_rewards WHERE user_id=? AND reward_key=?').get(referrerId,key))continue;
    db.prepare('INSERT INTO referral_rewards(id,user_id,reward_key,reward_type,reward_amount,created_at) VALUES(?,?,?,?,?,?)').run(uid(),referrerId,key,type,amount,nowIso());
    if(type==='money')txBalance(db,referrerId,'referral_reward',amount,{need});
    if(type==='drop')db.prepare('UPDATE users SET free_drops=free_drops+? WHERE id=?').run(amount,referrerId);
  }
}
export function registerReferral(db,user,startParam){
  const m=String(startParam||'').match(/^ref_(\d+)$/);if(!m)return;
  const referrerId=Number(m[1]);if(!referrerId||referrerId===user.id)return;
  if(db.prepare('SELECT 1 FROM referrals WHERE referred_id=?').get(user.id))return;
  if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(referrerId))return;
  db.transaction(()=>{
    db.prepare('INSERT INTO referrals(id,referrer_id,referred_id,created_at,activated_at) VALUES(?,?,?,?,?)').run(uid(),referrerId,user.id,nowIso(),nowIso());
    db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(referrerId,user.id,nowIso());
    db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(user.id,referrerId,nowIso());
    bumpTask(db,referrerId,'invite',1);bumpSeasonScore(db,referrerId,30);
    const count=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated_at IS NOT NULL').get(referrerId).c;
    rewardThreshold(db,referrerId,count);
  })();
}
export function friendsData(db,user,botUsername){
  const invited=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=?').get(user.id).c;
  const active=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated_at IS NOT NULL').get(user.id).c;
  const friends=db.prepare(`SELECT u.id,u.username,u.first_name,u.xp,u.last_seen FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.last_seen DESC LIMIT 100`).all(user.id)
    .map(x=>({...x,level:Math.max(1,1+Math.floor(Number(x.xp||0)/250))}));
  const rewards=db.prepare('SELECT reward_key,reward_type,reward_amount FROM referral_rewards WHERE user_id=? ORDER BY CAST(reward_key AS INTEGER)').all(user.id);
  return {referralLink:botUsername?`https://t.me/${botUsername}?start=ref_${user.id}`:null,invited,active,friends,rewards};
}
export function giftUsername(db,user,instanceId,friendId){
  friendId=Number(friendId);
  const result=db.transaction(()=>{
    if(!db.prepare('SELECT 1 FROM friends WHERE user_id=? AND friend_id=?').get(user.id,friendId))throw new Error('not_friend');
    const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);if(!inst)throw new Error('not_owned');
    const recipient=db.prepare('SELECT * FROM users WHERE id=?').get(friendId);if(!recipient)throw new Error('user_not_found');if(recipient.blocked)throw new Error('recipient_blocked');
    if(activeCollectionCount(db,friendId)>=collectionLimit(recipient))throw new Error('recipient_full');
    db.prepare('UPDATE username_instances SET owner_id=? WHERE id=?').run(friendId,instanceId);
    db.prepare('UPDATE inventory SET user_id=? WHERE instance_id=?').run(friendId,instanceId);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(instanceId);compactShowcase(db,user.id);
    db.prepare('INSERT INTO username_transfers(id,instance_id,from_user_id,to_user_id,type,created_at) VALUES(?,?,?,?,?,?)').run(uid(),instanceId,user.id,friendId,'gift',nowIso());
    bumpTask(db,user.id,'gift',1);bumpSeasonScore(db,user.id,10);
    return {handle:'@'+inst.handle,recipient:recipient.first_name||recipient.username||'Игрок'};
  })();
  return {ok:true,...result};
}
