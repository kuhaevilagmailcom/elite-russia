import crypto from 'node:crypto';
import {GAME} from './config.mjs';
export const uid=()=>crypto.randomUUID();
export const nowIso=()=>new Date().toISOString();
export const todayKey=()=>nowIso().slice(0,10);
export function premiumActive(user){return !!(user?.premium_until&&new Date(user.premium_until).getTime()>Date.now())}
export function collectionLimit(user){return premiumActive(user)?GAME.premiumMaxCollection:GAME.maxCollection}
export function txBalance(db,userId,type,amount,metadata={}){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!u)throw new Error('user_not_found');
  const next=u.balance+Number(amount||0);if(next<0)throw new Error('insufficient_funds');
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(next,userId);
  db.prepare('INSERT INTO balance_transactions(id,user_id,type,amount,balance_before,balance_after,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(uid(),userId,type,Number(amount||0),u.balance,next,JSON.stringify(metadata),nowIso());
  return next;
}
export function bumpTask(db,userId,key,delta=1){
  db.prepare('INSERT INTO task_progress(user_id,progress_date,task_key,value) VALUES(?,?,?,?) ON CONFLICT(user_id,progress_date,task_key) DO UPDATE SET value=value+excluded.value')
    .run(userId,todayKey(),key,delta);
}
export function activeSeason(db){return db.prepare('SELECT * FROM seasons WHERE active=1 ORDER BY id DESC LIMIT 1').get()}
export function bumpSeasonScore(db,userId,delta=1){
  const s=activeSeason(db);if(!s)return;
  db.prepare('INSERT INTO season_stats(user_id,season_id,score,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,season_id) DO UPDATE SET score=score+excluded.score,updated_at=excluded.updated_at')
    .run(userId,s.id,Math.max(0,Math.round(delta)),nowIso());
}
