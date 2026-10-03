import {GAME} from './config.mjs';
import {activeSeason,nowIso,txBalance} from './economy.mjs';

function grantCosmetic(db,userId,type,key,source,ts){
  db.prepare('INSERT OR IGNORE INTO user_cosmetics(user_id,type,key,source,created_at) VALUES(?,?,?,?,?)').run(userId,type,key,source,ts);
}
function finalizeSeason(db,s){
  const ts=nowIso();
  db.transaction(()=>{
    const fresh=db.prepare('SELECT * FROM seasons WHERE id=? AND active=1').get(s.id);if(!fresh)return;
    const ranking=db.prepare('SELECT user_id,score FROM season_stats WHERE season_id=? ORDER BY score DESC,user_id ASC').all(s.id);
    ranking.forEach((r,i)=>{
      const pos=i+1;
      db.prepare('INSERT OR REPLACE INTO season_history(user_id,season_id,position,score) VALUES(?,?,?,?)').run(r.user_id,s.id,pos,r.score);
      let money=0;if(pos<=500)money=3000;else if(pos<=1000)money=1000;
      if(money){
        const key='money_'+money;
        if(!db.prepare('SELECT 1 FROM season_rewards WHERE user_id=? AND season_id=? AND reward_key=?').get(r.user_id,s.id,key)){
          txBalance(db,r.user_id,'season_reward',money,{seasonId:s.id,position:pos});
          db.prepare('INSERT INTO season_rewards(user_id,season_id,reward_key,claimed_at) VALUES(?,?,?,?)').run(r.user_id,s.id,key,ts);
        }
      }
      if(pos<=100){grantCosmetic(db,r.user_id,'badge',`season_${s.id}_top100`,`season:${s.id}`,ts);db.prepare('INSERT OR IGNORE INTO season_rewards(user_id,season_id,reward_key,claimed_at) VALUES(?,?,?,?)').run(r.user_id,s.id,'badge_top100',ts)}
      if(pos<=10){grantCosmetic(db,r.user_id,'theme',`season_${s.id}_top10`,`season:${s.id}`,ts);db.prepare('INSERT OR IGNORE INTO season_rewards(user_id,season_id,reward_key,claimed_at) VALUES(?,?,?,?)').run(r.user_id,s.id,'theme_top10',ts)}
      if(pos<=3){grantCosmetic(db,r.user_id,'frame',`season_${s.id}_top3`,`season:${s.id}`,ts);db.prepare('INSERT OR IGNORE INTO season_rewards(user_id,season_id,reward_key,claimed_at) VALUES(?,?,?,?)').run(r.user_id,s.id,'frame_top3',ts)}
    });
    db.prepare('UPDATE seasons SET active=0 WHERE id=?').run(s.id);
    const nextId=db.prepare('SELECT COALESCE(MAX(id),0)+1 id FROM seasons').get().id;
    const end=new Date(Date.now()+GAME.seasonDays*86400000).toISOString();
    db.prepare('INSERT INTO seasons(name,start_at,end_at,active) VALUES(?,?,?,1)').run('Season '+nextId,ts,end);
  })();
}
export function ensureSeasonLifecycle(db){
  const expired=db.prepare('SELECT * FROM seasons WHERE active=1 AND end_at<=? ORDER BY id').all(nowIso());
  for(const s of expired)finalizeSeason(db,s);
  let s=activeSeason(db);
  if(!s){
    const ts=nowIso(),nextId=db.prepare('SELECT COALESCE(MAX(id),0)+1 id FROM seasons').get().id,end=new Date(Date.now()+GAME.seasonDays*86400000).toISOString();
    db.prepare('INSERT INTO seasons(name,start_at,end_at,active) VALUES(?,?,?,1)').run('Season '+nextId,ts,end);
    s=activeSeason(db);
  }
  return s;
}
export function seasonData(db,user){
  const s=ensureSeasonLifecycle(db);if(!s)return null;
  const score=db.prepare('SELECT score FROM season_stats WHERE user_id=? AND season_id=?').get(user.id,s.id)?.score||0;
  const rank=db.prepare('SELECT COUNT(*)+1 rank FROM season_stats WHERE season_id=? AND score>?').get(s.id,score).rank;
  const days=Math.max(0,Math.ceil((new Date(s.end_at).getTime()-Date.now())/86400000));
  const rewards=[
    {place:'TOP 1000',reward:'$1,000'},
    {place:'TOP 500',reward:'$3,000'},
    {place:'TOP 100',reward:'Profile badge'},
    {place:'TOP 10',reward:'Season theme'},
    {place:'TOP 3',reward:'Exclusive profile frame'}
  ];
  const now=nowIso();
  const series=db.prepare('SELECT id,name,start_at,end_at,active FROM events WHERE active=1 AND start_at<=? AND end_at>=? ORDER BY end_at').all(now,now);
  return {id:s.id,name:s.name,startAt:s.start_at,endAt:s.end_at,daysLeft:days,score,rank,rewards,series,seasonDays:GAME.seasonDays};
}
