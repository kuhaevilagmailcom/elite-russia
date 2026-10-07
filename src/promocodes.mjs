import {nowIso,txBalance} from './economy.mjs';
import {grantGems} from './payments.mjs';

function normalizeCode(value){
  const code=String(value||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z0-9_-]{3,24}$/.test(code))throw new Error('bad_promo_code');
  return code;
}
function normalizeReward(type,amount){
  const rewardType=String(type||'').toLowerCase();
  if(!['gems','money'].includes(rewardType))throw new Error('bad_promo_reward');
  const rewardAmount=Math.max(1,Math.min(rewardType==='gems'?100000:10000000,Math.round(Number(amount)||0)));
  if(!rewardAmount)throw new Error('bad_promo_reward');
  return {rewardType,rewardAmount};
}
export function promoStatus(db,user){
  const redeemed=db.prepare('SELECT code,reward_type rewardType,reward_amount rewardAmount,redeemed_at redeemedAt FROM promo_redemptions WHERE user_id=? ORDER BY redeemed_at DESC LIMIT 8').all(user.id);
  return {redeemed};
}
export function redeemPromo(db,user,value){
  const code=normalizeCode(value),promo=db.prepare('SELECT * FROM promo_codes WHERE code=?').get(code);
  if(!promo||!promo.active)throw new Error('promo_not_found');
  if(promo.expires_at&&Date.parse(promo.expires_at)<=Date.now())throw new Error('promo_expired');
  if(Number(promo.max_uses||0)>0&&Number(promo.uses||0)>=Number(promo.max_uses))throw new Error('promo_limit');
  if(db.prepare('SELECT 1 FROM promo_redemptions WHERE code=? AND user_id=?').get(code,user.id))throw new Error('promo_used');
  return db.transaction(()=>{
    const changed=db.prepare(`UPDATE promo_codes SET uses=uses+1 WHERE code=? AND active=1
      AND (max_uses=0 OR uses<max_uses)`).run(code).changes;
    if(!changed)throw new Error('promo_limit');
    let wallet=null,balance=null;
    if(promo.reward_type==='gems')wallet=grantGems(db,user.id,promo.reward_amount);
    else if(promo.reward_type==='money')balance=txBalance(db,user.id,'promo_reward',promo.reward_amount,{code});
    else throw new Error('bad_promo_reward');
    db.prepare('INSERT INTO promo_redemptions(code,user_id,reward_type,reward_amount,redeemed_at) VALUES(?,?,?,?,?)')
      .run(code,user.id,promo.reward_type,promo.reward_amount,nowIso());
    return {ok:true,code,rewardType:promo.reward_type,rewardAmount:Number(promo.reward_amount),wallet,balance};
  })();
}
export function adminPromoList(db){
  const items=db.prepare(`SELECT code,reward_type rewardType,reward_amount rewardAmount,max_uses maxUses,uses,active,expires_at expiresAt,created_at createdAt
    FROM promo_codes ORDER BY created_at DESC LIMIT 250`).all().map(x=>({...x,active:!!x.active}));
  return {items};
}
export function adminCreatePromo(db,admin,{code,rewardType,rewardAmount,maxUses=0,expiresAt=null}={}){
  const normalized=normalizeCode(code),reward=normalizeReward(rewardType,rewardAmount);
  const uses=Math.max(0,Math.min(1000000,Math.round(Number(maxUses)||0)));
  const expires=expiresAt?new Date(expiresAt).toISOString():null;
  if(expires&&Date.parse(expires)<=Date.now())throw new Error('bad_promo_expiry');
  if(db.prepare('SELECT 1 FROM promo_codes WHERE code=?').get(normalized))throw new Error('promo_exists');
  db.prepare('INSERT INTO promo_codes(code,reward_type,reward_amount,max_uses,uses,active,expires_at,created_by,created_at) VALUES(?,?,?,?,0,1,?,?,?)')
    .run(normalized,reward.rewardType,reward.rewardAmount,uses,expires,admin.id,nowIso());
  return {ok:true,code:normalized,...reward,maxUses:uses,expiresAt:expires};
}
export function adminSetPromoActive(db,admin,code,active){
  const normalized=normalizeCode(code);
  const changes=db.prepare('UPDATE promo_codes SET active=? WHERE code=?').run(active?1:0,normalized).changes;
  if(!changes)throw new Error('promo_not_found');
  return {ok:true,code:normalized,active:!!active};
}
