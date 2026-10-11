import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {ensureUser,collection} from '../src/game.mjs';
import {
 syncCrashRound,crashState,placeCrashBet,cashoutCrash,setCrashAutoStop,
 parseCrashAutoStop,crashAutoStopAt,CRASH_WAIT_MS,CRASH_GROWTH
} from '../src/crash.mjs';

function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-auto-'));
 const db=createDatabase(dir);
 const user=ensureUser(db,{id:'73122',first_name:'Autoplay'});
 let idx=0;
 function grant(value=100000){
  const handle='autox'+(++idx)+'_item';
  const t=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES (?,'RARE',?,1,1,'test',0,1,?)")
    .run(handle,value,new Date().toISOString());
  const id=crypto.randomUUID(),at=new Date().toISOString();
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES (?,?,?,'RARE',?,1,1,?,'owned',?,'test')")
    .run(id,t.lastInsertRowid,handle,value,user.id,at);
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES (?,?,?)').run(id,user.id,at);
  return id;
 }
 return {dir,db,user,grant,close(){db.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
const force=(db,id,startsAt,target=1000,crashAt=startsAt+180000)=>{
 db.prepare("UPDATE crash_rounds SET status='running',starts_at=?,crashes_at=?,crash_x=? WHERE id=?")
   .run(startsAt,crashAt,target,id);
};
test('auto-stop input validation and persistence',()=>{
 for(const [input,expected] of [['1,5',1.5],['1.50',1.5],[2.5,2.5],['1000',1000],['1.01',1.01]])
   assert.equal(parseCrashAutoStop(input),expected);
 for(const v of [1,0,1001,'xyz','1.001','NaN',-2,Infinity])assert.throws(()=>parseCrashAutoStop(v),/crash_invalid_autostop/);
 assert.equal(parseCrashAutoStop(''),null);
 assert.ok(crashAutoStopAt(0,2.5)>crashAutoStopAt(0,1.5));
 const f=fixture();
 try{
  assert.deepEqual(setCrashAutoStop(f.db,f.user,'2,5',1000),{autoStopX:2.5});
  assert.equal(crashState(f.db,f.user,1001).autoStopX,2.5);
  assert.equal(setCrashAutoStop(f.db,f.user,null,1002).autoStopX,null);
  assert.equal(crashState(f.db,f.user,1003).autoStopX,null);
 }finally{f.close()}
});

test('server automatically exchanges the original username even when Mini App is closed',()=>{
 for(const x of [1.5,2,2.5,7.25]){
  const f=fixture(),at=2000000000000;
  try{
   const id=f.grant(),round=syncCrashRound(f.db,at);
   setCrashAutoStop(f.db,f.user,x,at+1);
   const wager=placeCrashBet(f.db,f.user,id,at+2);
   assert.equal(crashState(f.db,f.user,at+3).myBet.autoStopX,x);
   const start=at+10000,due=crashAutoStopAt(start,x);
   force(f.db,round.id,start);
   assert.equal(crashState(f.db,f.user,due-2).myBet.status,'staked');
   // No client requests; only the server's own background round tick.
   syncCrashRound(f.db,due+4500);
   const state=crashState(f.db,f.user,due+4501);
   assert.equal(state.myBet.status,'cashed');
   assert.equal(state.myBet.settlementKind,'auto');
   assert.equal(state.myBet.cashoutX,x);
   assert.ok(state.myWin.handle.startsWith('@'));
   assert.equal(state.myWin.value,Math.floor(100000*x));
   assert.equal(collection(f.db,f.user).items.some(i=>i.id===state.myWin.id),true);
   assert.equal(f.db.prepare('SELECT status FROM username_instances WHERE id=?').get(id).status,'crash_exchanged');
   assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crash_wins WHERE bet_id=?').get(wager.betId).n,1);
   const replay=cashoutCrash(f.db,f.user,due+5000,round.id);
   assert.equal(replay.replayed,true);
   assert.equal(replay.auto,true);
   assert.equal(replay.reward.id,state.myWin.id);
  }finally{f.close()}
 }
});

test('manual cashout before auto-stop wins once, with no delayed duplicate',()=>{
 const f=fixture(),at=2000000000000;
 try{
  const id=f.grant(),round=syncCrashRound(f.db,at);
  setCrashAutoStop(f.db,f.user,2.5,at+1);
  const wager=placeCrashBet(f.db,f.user,id,at+2);
  const start=at+10000;
  force(f.db,round.id,start);
  const manualAt=crashAutoStopAt(start,1.8);
  const result=cashoutCrash(f.db,f.user,manualAt,round.id);
  assert.equal(result.auto,false);
  assert.ok(result.multiplier>=1.79&&result.multiplier<1.81);
  assert.ok(result.reward.value<250000);
  syncCrashRound(f.db,crashAutoStopAt(start,2.5)+300);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crash_wins WHERE bet_id=?').get(wager.betId).n,1);
  assert.equal(cashoutCrash(f.db,f.user,crashAutoStopAt(start,3),round.id).reward.id,result.reward.id);
 }finally{f.close()}
});

test('explosion before target loses the wager, never auto-awards an item',()=>{
 const f=fixture(),at=2000000000000;
 try{
  const id=f.grant(),round=syncCrashRound(f.db,at);
  setCrashAutoStop(f.db,f.user,2.5,at+1);
  placeCrashBet(f.db,f.user,id,at+2);
  const start=at+10000,boom=crashAutoStopAt(start,1.6);
  force(f.db,round.id,start,1.6,boom);
  syncCrashRound(f.db,boom+5000);
  assert.equal(f.db.prepare('SELECT status FROM username_instances WHERE id=?').get(id).status,'crash_lost');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crash_wins').get().n,0);
 }finally{f.close()}
});

test('after restart auto-stop catches up by target time, including if server wakes after explosion',()=>{
 const f=fixture(),at=2000000000000;
 try{
  const id=f.grant(),round=syncCrashRound(f.db,at);
  setCrashAutoStop(f.db,f.user,'2.50',at+1);
  placeCrashBet(f.db,f.user,id,at+2);
  const start=at+10000,boom=crashAutoStopAt(start,3.5);
  force(f.db,round.id,start,3.5,boom);
  const overdue=boom+22000;
  f.db.close();
  const reopened=createDatabase(f.dir);
  f.db=reopened;
  const newRound=syncCrashRound(reopened,overdue);
  assert.notEqual(newRound.id,round.id);
  const prior=reopened.prepare('SELECT b.* FROM crash_bets b WHERE round_id=?').get(round.id);
  assert.equal(prior.status,'cashed');
  assert.equal(prior.settlement_kind,'auto');
  assert.equal(prior.cashout_x,2.5);
  assert.equal(reopened.prepare('SELECT COUNT(*) n FROM crash_wins WHERE bet_id=?').get(prior.id).n,1);
  const win=reopened.prepare('SELECT * FROM crash_wins WHERE bet_id=?').get(prior.id);
  assert.equal(win.value,250000);
  assert.equal(reopened.prepare('SELECT status FROM username_instances WHERE id=?').get(win.instance_id).status,'owned');
  assert.equal(reopened.prepare('PRAGMA foreign_key_check').all().length,0);
  // fixture closes the reopened DB.
 }finally{f.close()}
});

test('twenty consecutive rounds accept the previously won username as a fresh stake',()=>{
 const f=fixture(),start=2000000000000;
 try{
  let item=f.grant(),now=start;
  setCrashAutoStop(f.db,f.user,null,now);
  for(let n=0;n<20;n++){
   const round=syncCrashRound(f.db,now);
   assert.equal(round.status,'waiting');
   const bet=placeCrashBet(f.db,f.user,item,now+1,round.id);
   const begins=now+CRASH_WAIT_MS;
   force(f.db,round.id,begins,1000,begins+150000);
   const stakeValue=f.db.prepare('SELECT value FROM username_instances WHERE id=?').get(item).value;
   const cashed=cashoutCrash(f.db,f.user,crashAutoStopAt(begins,1.5),round.id);
   assert.equal(cashed.reward.value,Math.min(1000000000,Math.floor(stakeValue*cashed.multiplier)));
   item=cashed.reward.id;
   assert.equal(f.db.prepare('SELECT status FROM username_instances WHERE id=?').get(item).status,'owned');
   assert.equal(cashoutCrash(f.db,f.user,begins+60000,round.id).reward.id,item);
   f.db.prepare("UPDATE crash_rounds SET crashes_at=? WHERE id=?").run(begins+60001,round.id);
   now=begins+60010;
   const next=syncCrashRound(f.db,now);
   assert.notEqual(next.id,round.id);
   now+=12000;
   f.db.prepare("UPDATE crash_rounds SET crashes_at=? WHERE id=?").run(now-1,next.id);
   syncCrashRound(f.db,now);
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crash_wins').get().n,20);
  assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{f.close()}
});
