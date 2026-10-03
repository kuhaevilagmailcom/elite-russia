import crypto from 'node:crypto';
import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,bumpSeasonScore} from './economy.mjs';
const rewards=[
  {key:'nc500',label:'$500',type:'money',amount:500,weight:30},
  {key:'nc1000',label:'$1 000',type:'money',amount:1000,weight:26},
  {key:'xp50',label:'50 XP',type:'xp',amount:50,weight:18},
  {key:'nc2500',label:'$2 500',type:'money',amount:2500,weight:14},
  {key:'drop1',label:'1 бесплатный дроп',type:'drop',amount:1,weight:9},
  {key:'nc5000',label:'$5 000',type:'money',amount:5000,weight:3}
];
function pick(){const total=rewards.reduce((s,x)=>s+x.weight,0),n=crypto.randomInt(0,total);let a=0;for(const r of rewards){a+=r.weight;if(n<a)return r}return rewards[0]}
export function wheelStatus(db,user){
  const claim=db.prepare('SELECT last_claim_at FROM wheel_claims WHERE user_id=?').get(user.id);
  const nextAt=claim?new Date(claim.last_claim_at).getTime()+GAME.wheelCooldownMs:0;
  return {available:Date.now()>=nextAt,nextAt:nextAt?new Date(nextAt).toISOString():null,rewards:rewards.map(({key,label,weight})=>({key,label,weight}))};
}
export function spinWheel(db,user,requestId){
  if(!requestId)throw new Error('bad_request_id');
  const old=db.prepare('SELECT * FROM wheel_history WHERE user_id=? AND request_id=?').get(user.id,requestId);
  if(old)return {reward:{key:old.reward_key,label:old.reward_label,type:old.reward_type,amount:old.reward_amount},replayed:true};
  return db.transaction(()=>{
    const again=db.prepare('SELECT * FROM wheel_history WHERE user_id=? AND request_id=?').get(user.id,requestId);
    if(again)return {reward:{key:again.reward_key,label:again.reward_label,type:again.reward_type,amount:again.reward_amount},replayed:true};
    const claim=db.prepare('SELECT last_claim_at FROM wheel_claims WHERE user_id=?').get(user.id);
    const nextAt=claim?new Date(claim.last_claim_at).getTime()+GAME.wheelCooldownMs:0;
    if(Date.now()<nextAt)throw new Error('wheel_cooldown');
    const r=pick(),ts=nowIso();
    if(r.type==='money')txBalance(db,user.id,'wheel',r.amount,{reward:r.key});
    if(r.type==='xp')db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(r.amount,user.id);
    if(r.type==='drop')db.prepare('UPDATE users SET free_drops=free_drops+? WHERE id=?').run(r.amount,user.id);
    db.prepare('INSERT INTO wheel_claims(user_id,last_claim_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_claim_at=excluded.last_claim_at').run(user.id,ts);
    db.prepare('INSERT INTO wheel_history(id,user_id,request_id,reward_key,reward_label,reward_type,reward_amount,created_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),user.id,requestId,r.key,r.label,r.type,r.amount,ts);
    bumpSeasonScore(db,user.id,5);
    return {reward:r,replayed:false};
  })();
}
