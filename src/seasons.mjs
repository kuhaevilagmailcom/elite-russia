import {GAME} from './config.mjs';
import {activeSeason} from './economy.mjs';
export function seasonData(db,user){
  const s=activeSeason(db);if(!s)return null;
  const score=db.prepare('SELECT score FROM season_stats WHERE user_id=? AND season_id=?').get(user.id,s.id)?.score||0;
  const rank=db.prepare('SELECT COUNT(*)+1 rank FROM season_stats WHERE season_id=? AND score>?').get(s.id,score).rank;
  const days=Math.max(0,Math.ceil((new Date(s.end_at).getTime()-Date.now())/86400000));
  const rewards=[
    {place:'TOP 1000',reward:'1 000 NC'},
    {place:'TOP 500',reward:'3 000 NC'},
    {place:'TOP 100',reward:'Profile badge'},
    {place:'TOP 10',reward:'Season theme'},
    {place:'TOP 3',reward:'Exclusive profile frame'}
  ];
  const series=db.prepare('SELECT id,name,start_at,end_at,active FROM events WHERE active=1 AND start_at<=? AND end_at>=? ORDER BY end_at').all(new Date().toISOString(),new Date().toISOString());
  return {id:s.id,name:s.name,startAt:s.start_at,endAt:s.end_at,daysLeft:days,score,rank,rewards,series,seasonDays:GAME.seasonDays};
}
