import crypto from 'node:crypto';
import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,bumpSeasonScore,collectionLimit,activeCollectionCount} from './economy.mjs';
import {stableScoreHandle,rarityFromValue} from './generator.mjs';

export const WHEEL_USERNAMES=['abuser','wheel','daily','lucky','spin','winner','fortune'];
const BASE_REWARDS=[
  {key:'cash100',label:'$100',type:'money',amount:100,weight:35},
  {key:'cash250',label:'$250',type:'money',amount:250,weight:28},
  {key:'xp25',label:'25 XP',type:'xp',amount:25,weight:18},
  {key:'cash500',label:'$500',type:'money',amount:500,weight:12},
  {key:'drop1',label:'1 бесплатный дроп',type:'drop',amount:1,weight:3},
  {key:'cash1500',label:'$1 500',type:'money',amount:1500,weight:1},
  {key:'username',label:'1/1 USERNAME',type:'username',amount:0,weight:3}
];
function availableWheelHandles(db){return WHEEL_USERNAMES.filter(h=>!db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(h))}
function rewardsFor(db,user){
  const canReceive=activeCollectionCount(db,user.id)<collectionLimit(user),available=canReceive?availableWheelHandles(db):[];
  const rows=BASE_REWARDS.map(x=>({...x}));
  if(!available.length){const special=rows.find(x=>x.type==='username'),cash=rows.find(x=>x.key==='cash100');cash.weight+=special.weight;return {rows:rows.filter(x=>x.type!=='username'),available}}
  return {rows,available};
}
function pick(rows){const total=rows.reduce((s,x)=>s+x.weight,0),n=crypto.randomInt(0,total);let a=0;for(const r of rows){a+=r.weight;if(n<a)return r}return rows[0]}
function grantUsername(db,user,available){
  if(!available.length)throw new Error('wheel_username_unavailable');
  const handle=available[crypto.randomInt(0,available.length)],value=stableScoreHandle(handle),rarity=rarityFromValue(value),ts=nowIso();
  let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
  if(!t){
    const id=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,'wheel',1,1,?)").run(handle,rarity,value,1,ts).lastInsertRowid;
    t=db.prepare('SELECT * FROM username_templates WHERE id=?').get(id);
  }else{
    if(t.current_supply>=1||db.prepare('SELECT 1 FROM username_instances WHERE handle=?').get(handle))throw new Error('wheel_username_unavailable');
    db.prepare("UPDATE username_templates SET rarity=?,base_value=?,max_supply=1,current_supply=1,category='wheel',special=1,active=1 WHERE id=?").run(rarity,value,t.id);
  }
  const id=uid();
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,1,1,?,'owned',?,'wheel')").run(id,t.id,handle,rarity,value,user.id,ts);
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,ts);
  return {id,handle:'@'+handle,value,rarity};
}
export function wheelStatus(db,user){
  const claim=db.prepare('SELECT last_claim_at FROM wheel_claims WHERE user_id=?').get(user.id);
  const nextAt=claim?new Date(claim.last_claim_at).getTime()+GAME.wheelCooldownMs:0,{rows,available}=rewardsFor(db,user);
  return {available:Date.now()>=nextAt,nextAt:nextAt?new Date(nextAt).toISOString():null,rewards:rows.map(({key,label,type,weight})=>({key,label,type,weight})),wheelUsernamesAvailable:available.length};
}
export function spinWheel(db,user,requestId){
  requestId=String(requestId||'');
  if(!requestId||requestId.length>100)throw new Error('bad_request_id');
  const old=db.prepare('SELECT * FROM wheel_history WHERE user_id=? AND request_id=?').get(user.id,requestId);
  if(old)return {reward:{key:old.reward_key,label:old.reward_label,type:old.reward_type,amount:old.reward_amount},replayed:true};
  return db.transaction(()=>{
    const again=db.prepare('SELECT * FROM wheel_history WHERE user_id=? AND request_id=?').get(user.id,requestId);
    if(again)return {reward:{key:again.reward_key,label:again.reward_label,type:again.reward_type,amount:again.reward_amount},replayed:true};
    const claim=db.prepare('SELECT last_claim_at FROM wheel_claims WHERE user_id=?').get(user.id),nextAt=claim?new Date(claim.last_claim_at).getTime()+GAME.wheelCooldownMs:0;
    if(Date.now()<nextAt)throw new Error('wheel_cooldown');
    const {rows,available}=rewardsFor(db,user),r=pick(rows),ts=nowIso();let reward={...r};
    if(r.type==='money')txBalance(db,user.id,'wheel',r.amount,{reward:r.key});
    if(r.type==='xp')db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(r.amount,user.id);
    if(r.type==='drop')db.prepare('UPDATE users SET free_drops=free_drops+? WHERE id=?').run(r.amount,user.id);
    if(r.type==='username'){const item=grantUsername(db,user,available);reward={...r,label:item.handle,item};}
    db.prepare('INSERT INTO wheel_claims(user_id,last_claim_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_claim_at=excluded.last_claim_at').run(user.id,ts);
    db.prepare('INSERT INTO wheel_history(id,user_id,request_id,reward_key,reward_label,reward_type,reward_amount,created_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),user.id,requestId,r.key,reward.label,r.type,r.amount,ts);
    bumpSeasonScore(db,user.id,5);
    return {reward,replayed:false};
  })();
}
