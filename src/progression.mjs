import {txBalance,nowIso} from './economy.mjs';

export const MAX_LEVEL=200;

export const TITLE_CONFIG=Object.freeze([
  [1,'Йоу'],
  [10,'Чечик'],
  [20,'Шарит'],
  [30,'В теме'],
  [40,'На вайбе'],
  [50,'Могёт'],
  [60,'Лудик'],
  [70,'Жёсткий'],
  [80,'Лютый'],
  [90,'Имбовый'],
  [100,'Аура +100'],
  [110,'Сигма'],
  [120,'Маэстро'],
  [130,'Раздаёт'],
  [140,'Аура +500'],
  [150,'Имба'],
  [160,'Боссик'],
  [170,'Сверхразум'],
  [180,'Аура +1000'],
  [190,'Финальный босс'],
  [200,'Легендарка']
]);

const REWARDS=new Map([
  [5,{money:2500}],[10,{money:5000}],[15,{freeDrops:1}],[20,{money:7500}],
  [30,{money:10000}],[40,{money:12500}],[50,{freeDrops:1}],[60,{money:10000}],
  [70,{freeDrops:1}],[80,{money:20000}],[90,{money:25000}],[100,{freeDrops:2,money:30000}],
  [120,{money:40000}],[140,{freeDrops:2}],[150,{money:50000}],[160,{money:60000}],
  [180,{freeDrops:3,money:75000}],[190,{money:100000}],[200,{freeDrops:5,money:200000}]
]);

function xpForStep(level){
  const l=Math.max(1,Math.min(MAX_LEVEL-1,Math.floor(Number(level)||1)));
  if(l<20)return Math.round(85+l*18);
  if(l<80)return Math.round(430+(l-20)*38);
  if(l<150)return Math.round(2800+(l-80)*95);
  return Math.round(9800+(l-150)*235);
}

export function xpToReachLevel(level){
  const target=Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number(level)||1)));
  if(target<=1)return 0;
  let total=0;
  for(let l=1;l<target;l++)total+=xpForStep(l);
  return total;
}

export function levelFromXp(xp){
  const value=Math.max(0,Math.floor(Number(xp)||0));
  let lo=1,hi=MAX_LEVEL;
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2);
    if(xpToReachLevel(mid)<=value)lo=mid;else hi=mid-1;
  }
  return lo;
}

export function levelTitle(level){
  const l=Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number(level)||1)));
  let title=TITLE_CONFIG[0][1];
  for(const [at,name] of TITLE_CONFIG)if(l>=at)title=name;
  return title;
}

export function progressionFromXp(xp){
  const value=Math.max(0,Math.floor(Number(xp)||0)),level=levelFromXp(value),start=xpToReachLevel(level),next=level>=MAX_LEVEL?start:xpToReachLevel(level+1);
  return {
    level,xp:value,title:levelTitle(level),levelXp:value-start,nextLevelXp:Math.max(0,next-start),
    remaining:level>=MAX_LEVEL?0:Math.max(0,next-value),progress:level>=MAX_LEVEL?1:Math.max(0,Math.min(1,(value-start)/Math.max(1,next-start)))
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

export function levelRewards(){
  return [...REWARDS.entries()].map(([level,reward])=>({level,...reward,title:levelTitle(level)}));
}
