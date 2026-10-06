import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,bumpTask,bumpSeasonScore,collectionLimit,activeCollectionCount,compactShowcase} from './economy.mjs';
import {grantXp,levelFromXp} from './progression.mjs';

const REFERRAL_REWARDS=[[1,'money',500],[3,'money',1500],[5,'drop',1],[10,'money',5000]];
function rewardThreshold(db,referrerId,count){
  for(const [need,type,amount] of REFERRAL_REWARDS){
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
    bumpTask(db,referrerId,'invite',1);grantXp(db,referrerId,30,'referral',{referredId:user.id});bumpSeasonScore(db,referrerId,30);
    const count=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated_at IS NOT NULL').get(referrerId).c;
    rewardThreshold(db,referrerId,count);
  })();
}
export function friendsData(db,user,botUsername){
  const invited=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=?').get(user.id).c;
  const active=db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND activated_at IS NOT NULL').get(user.id).c;
  const friends=db.prepare(`SELECT u.id,u.username,u.first_name,u.xp,u.last_seen FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.last_seen DESC LIMIT 100`).all(user.id)
    .map(x=>({...x,level:levelFromXp(x.xp)}));
  const rewards=db.prepare('SELECT reward_key,reward_type,reward_amount FROM referral_rewards WHERE user_id=? ORDER BY CAST(reward_key AS INTEGER)').all(user.id);
  const next=REFERRAL_REWARDS.find(x=>invited<x[0]);
  return {
    referralLink:botUsername?`https://t.me/${botUsername}?start=ref_${user.id}`:null,
    shareText:'Я играю в USERNAME — тут выпадают уникальные юзернеймы, есть рынок, апгрейдер и колесо. Залетай 👇',
    invited,active,friends,rewards,rewardsCount:rewards.length,
    nextReward:next?{need:next[0],type:next[1],amount:next[2],remaining:Math.max(0,next[0]-invited)}:null
  };
}
export function giftUsername(db,user,instanceId,recipientRef){
  const raw=String(recipientRef??'').trim(),username=raw.replace(/^@/,'').toLowerCase();
  const result=db.transaction(()=>{
    const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);if(!inst)throw new Error('not_owned');
    let recipient=null;
    if(/^\d+$/.test(raw))recipient=db.prepare('SELECT * FROM users WHERE id=?').get(Number(raw));
    if(!recipient&&username)recipient=db.prepare("SELECT * FROM users WHERE LOWER(username)=? ORDER BY last_seen DESC LIMIT 1").get(username);
    if(!recipient)throw new Error('user_not_found');
    if(recipient.id===user.id)throw new Error('gift_self');
    if(recipient.blocked)throw new Error('recipient_blocked');
    if(activeCollectionCount(db,recipient.id)>=collectionLimit(recipient))throw new Error('recipient_full');
    const fee=Math.max(1,Math.round(Number(inst.value||0)*Number(GAME.transferFee||.05)));
    const sender=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    if(Number(sender.balance||0)<fee)throw new Error('insufficient_funds');
    txBalance(db,user.id,'gift_fee',-fee,{instanceId,handle:inst.handle,toUserId:recipient.id,rate:Number(GAME.transferFee||.05)});
    db.prepare('UPDATE username_instances SET owner_id=? WHERE id=?').run(recipient.id,instanceId);
    db.prepare('UPDATE inventory SET user_id=? WHERE instance_id=?').run(recipient.id,instanceId);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(instanceId);compactShowcase(db,user.id);
    db.prepare('INSERT INTO username_transfers(id,instance_id,from_user_id,to_user_id,type,created_at) VALUES(?,?,?,?,?,?)').run(uid(),instanceId,user.id,recipient.id,'gift',nowIso());
    bumpTask(db,user.id,'gift',1);grantXp(db,user.id,12,'gift',{instanceId,toUserId:recipient.id,fee});bumpSeasonScore(db,user.id,10);
    return {handle:'@'+inst.handle,recipient:recipient.first_name||recipient.username||'Игрок',recipientUsername:recipient.username?('@'+recipient.username):'',fee,feeRate:Number(GAME.transferFee||.05)};
  })();
  return {ok:true,...result};
}
