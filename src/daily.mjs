import {todayKey,txBalance} from './economy.mjs';
import {grantXp} from './progression.mjs';

const REWARDS=[
  {day:1,money:1000,label:'$1K'},
  {day:2,money:1500,label:'$1.5K'},
  {day:3,money:2000,label:'$2K'},
  {day:4,money:2500,label:'$2.5K'},
  {day:5,freeDrops:1,label:'Free Drop'},
  {day:6,money:3000,label:'$3K'},
  {day:7,money:5000,freeDrops:1,label:'$5K + Drop'}
];
function dayNumber(s){return Math.floor(Date.parse(String(s)+'T00:00:00Z')/86400000)}
export function dailyStatus(db,user){
  const today=todayKey(),last=String(user.last_daily_date||''),diff=last?dayNumber(today)-dayNumber(last):999;
  const streak=diff===0?Math.max(1,Number(user.daily_streak||1)):diff===1?Math.min(7,Math.max(0,Number(user.daily_streak||0))+1):1;
  const day=((streak-1)%7)+1,reward=REWARDS[day-1];
  return {claimable:diff!==0,streak:Number(user.daily_streak||0),nextStreak:streak,day,reward,rewards:REWARDS};
}
export function claimDaily(db,user){
  return db.transaction(()=>{
    const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id),status=dailyStatus(db,fresh);
    if(!status.claimable)throw new Error('daily_already_claimed');
    const today=todayKey(),reward=status.reward;
    if(reward.money)txBalance(db,user.id,'daily_reward',reward.money,{day:status.day,streak:status.nextStreak});
    if(reward.freeDrops)db.prepare('UPDATE users SET free_drops=free_drops+? WHERE id=?').run(reward.freeDrops,user.id);
    db.prepare('UPDATE users SET daily_streak=?,last_daily_date=? WHERE id=?').run(status.nextStreak,today,user.id);
    grantXp(db,user.id,15+status.day*2,'daily',{day:status.day,streak:status.nextStreak});
    return {ok:true,reward,day:status.day,streak:status.nextStreak};
  })();
}
