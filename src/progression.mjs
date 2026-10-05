import {txBalance,nowIso} from './economy.mjs';

const TITLES=[
  [1,'Новичок'],[5,'Перекуп'],[10,'Торгаш'],[15,'Барыга'],[20,'Охотник'],
  [30,'Коллекционер'],[40,'Магнат'],[50,'Акула'],[65,'Дилер имён'],[80,'Король рынка'],[100,'Легенда']
];
const REWARDS=new Map([
  [2,{money:1000}],[3,{money:1500}],[5,{freeDrops:1}],[10,{money:10000}],
  [15,{money:7500}],[20,{freeDrops:2}],[25,{money:15000}],[30,{money:25000}],
  [40,{money:35000}],[50,{money:50000}],[65,{money:75000}],[75,{freeDrops:3}],[80,{money:100000}],[100,{money:250000,freeDrops:5}]
]);

export function xpToReachLevel(level){
  const l=Math.max(1,Math.min(100,Math.floor(Number(level)||1)));
  if(l<=1)return 0;
  let total=0;
  for(let n=1;n<l;n++)total+=Math.round(90+34*n+4.2*Math.pow(n,1.55));
  return total;
}
export function levelFromXp(xp){
  const value=Math.max(0,Math.floor(Number(xp)||0));
  let lo=1,hi=100;
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2);
    if(xpToReachLevel(mid)<=value)lo=mid;else hi=mid-1;
  }
  return lo;
}
export function levelTitle(level){
  let title=TITLES[0][1];
  for(const [at,name] of TITLES)if(Number(level)>=at)title=name;
  return title;
}
export function progressionFromXp(xp){
  const value=Math.max(0,Math.floor(Number(xp)||0)),level=levelFromXp(value),start=xpToReachLevel(level),next=level>=100?start:xpToReachLevel(level+1);
  return {
    level,xp:value,title:levelTitle(level),levelXp:value-start,nextLevelXp:Math.max(0,next-start),
    remaining:level>=100?0:Math.max(0,next-value),progress:level>=100?1:Math.max(0,Math.min(1,(value-start)/Math.max(1,next-start)))
  };
}
function awardLevelReward(db,userId,level){
  const reward=REWARDS.get(level);if(!reward)return null;
  const inserted=db.prepare('INSERT OR IGNORE INTO level_reward_claims(user_id,level,claimed_at) VALUES(?,?,?)').run(userId,level,nowIso()).changes;
  if(!inserted)return null;
  if(reward.money)txBalance(db,userId,'level_reward',reward.money,{level});
  if(reward.freeDrops)db.prepare('UPDATE users SET free_drops=free_drops+? WHERE id=?').run(reward.freeDrops,userId);
  return {...reward,level};
}
export function grantXp(db,userId,amount,reason='game',metadata={}){
  const add=Math.max(0,Math.min(10000,Math.round(Number(amount)||0))),before=db.prepare('SELECT xp,level FROM users WHERE id=?').get(userId);
  if(!before)throw new Error('user_not_found');
  const beforeLevel=levelFromXp(before.xp);
  if(add)db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(add,userId);
  const row=db.prepare('SELECT xp FROM users WHERE id=?').get(userId),after=progressionFromXp(row.xp);
  db.prepare('UPDATE users SET level=? WHERE id=?').run(after.level,userId);
  db.prepare('INSERT INTO xp_history(user_id,amount,reason,metadata,created_at) VALUES(?,?,?,?,?)').run(userId,add,reason,JSON.stringify(metadata||{}),nowIso());
  const rewards=[];
  for(let l=beforeLevel+1;l<=after.level;l++){const r=awardLevelReward(db,userId,l);if(r)rewards.push(r)}
  return {...after,added:add,rewards};
}
export function levelRewards(){return [...REWARDS.entries()].map(([level,reward])=>({level,...reward,title:levelTitle(level)}))}
