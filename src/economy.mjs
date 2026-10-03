import crypto from 'node:crypto';
import {GAME} from './config.mjs';

export const uid=()=>crypto.randomUUID();
export const nowIso=()=>new Date().toISOString();
export const randomUnit=()=>crypto.randomInt(0,0x100000000)/0x100000000;
export const todayKey=()=>{
  const offset=Number(GAME.dayTimezoneOffsetMinutes||0)*60000;
  return new Date(Date.now()+offset).toISOString().slice(0,10);
};
export function premiumActive(user){return !!(user?.premium_until&&new Date(user.premium_until).getTime()>Date.now())}
export function collectionLimit(user){return premiumActive(user)?GAME.premiumMaxCollection:GAME.maxCollection}
export function activeCollectionCount(db,userId){
  return db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status IN ('pending','owned','market')").get(userId).c;
}
export function ownedCollectionCount(db,userId){
  return db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status='owned'").get(userId).c;
}
export function assetStats(db,userId){
  return db.prepare("SELECT COUNT(*) count,COALESCE(SUM(value),0) value,COALESCE(MAX(value),0) best FROM username_instances WHERE owner_id=? AND status IN ('owned','market')").get(userId);
}
export function systemSellValue(value){
  const v=Math.max(0,Number(value)||0);
  const rate=v>=1000000?.05:v>=250000?.07:v>=50000?.10:v>=10000?.14:.20;
  return Math.max(100,Math.round(v*rate/100)*100);
}
export function configNumber(db,key,fallback){
  const row=db.prepare('SELECT value FROM game_config WHERE key=?').get(key);
  const n=Number(row?.value);return Number.isFinite(n)?n:fallback;
}
export function txBalance(db,userId,type,amount,metadata={}){
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(userId);if(!u)throw new Error('user_not_found');
  const delta=Number(amount||0),next=u.balance+delta;if(next<0)throw new Error('insufficient_funds');
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(next,userId);
  db.prepare('INSERT INTO balance_transactions(id,user_id,type,amount,balance_before,balance_after,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(uid(),userId,type,delta,u.balance,next,JSON.stringify(metadata),nowIso());
  return next;
}
export function bumpTask(db,userId,key,delta=1){
  db.prepare('INSERT INTO task_progress(user_id,progress_date,task_key,value) VALUES(?,?,?,?) ON CONFLICT(user_id,progress_date,task_key) DO UPDATE SET value=value+excluded.value')
    .run(userId,todayKey(),key,delta);
}
export function activeSeason(db){
  return db.prepare('SELECT * FROM seasons WHERE active=1 AND end_at>? ORDER BY id DESC LIMIT 1').get(nowIso());
}
export function bumpSeasonScore(db,userId,delta=1){
  const s=activeSeason(db);if(!s)return;
  db.prepare('INSERT INTO season_stats(user_id,season_id,score,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,season_id) DO UPDATE SET score=score+excluded.score,updated_at=excluded.updated_at')
    .run(userId,s.id,Math.max(0,Math.round(delta)),nowIso());
}
export function compactShowcase(db,userId){
  const rows=db.prepare('SELECT instance_id FROM profile_showcase WHERE user_id=? ORDER BY position,instance_id').all(userId);
  const move=db.prepare('UPDATE profile_showcase SET position=? WHERE user_id=? AND instance_id=?');
  rows.forEach((r,i)=>move.run(-(i+1),userId,r.instance_id));
  rows.forEach((r,i)=>move.run(i+1,userId,r.instance_id));
}
