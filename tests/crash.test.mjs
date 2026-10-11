import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {ensureUser,collection} from '../src/game.mjs';
import {syncCrashRound,crashState,placeCrashBet,cashoutCrash,crashMultiplier,crashRewardValue,crashRewardOption,CRASH_WAIT_MS,CRASH_MAX_X,CRASH_MAX_PAYOUT} from '../src/crash.mjs';

function grant(db,user,handle,value){
 const template=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES (?,?,?,?,1,'test',0,1,?)")
   .run(handle,'COMMON',value,1,new Date().toISOString());
 const id=crypto.randomUUID(),now=new Date().toISOString();
 db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES (?,?,?,?,?,1,1,?,'owned',?,'test')")
   .run(id,template.lastInsertRowid,handle,'COMMON',value,user.id,now);
 db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,now);
 return id;
}

test('Crash: 100K stake evolves into a real unique username, never currency; survives restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-crash-upgrade-'));
 let db;
 const at=2000000000000;
 try{
  db=createDatabase(dir);
  const a=ensureUser(db,{id:7655501,first_name:'Alpha'});
  const b=ensureUser(db,{id:7655502,first_name:'Beta'});
  const ia=grant(db,a,'alpha_crash_77',100000);
  const ib=grant(db,b,'beta_crash_77',8000);
  const initialBalance=db.prepare('SELECT balance FROM users WHERE id=?').get(a.id).balance;
  const round=syncCrashRound(db,at);
  assert.equal(round.status,'waiting');
  assert.equal(round.starts_at,at+CRASH_WAIT_MS);
  assert.equal(crashState(db,a,at).round.id,crashState(db,b,at).round.id);
  assert.deepEqual(crashState(db,a,at).history,[],'history is empty until a round finishes');
  assert.equal(crashState(db,a,at).available.some(i=>i.id===ia),true);
  const pa=placeCrashBet(db,a,ia,at+1);
  const pb=placeCrashBet(db,b,ib,at+2);
  assert.equal(pa.roundId,pb.roundId);
  assert.equal(placeCrashBet(db,a,ia,at+3).replayed,true);
  assert.throws(()=>placeCrashBet(db,a,ib,at+3),/crash_already_bet/);
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ia).status,'crash_staked');
  const ap=crashState(db,a,at+5).myRewardPlan;
  const bp=crashState(db,b,at+5).myRewardPlan;
  assert.equal(ap.length,35);
  assert.equal(new Set(ap.map(x=>x.handle)).size,35);
  assert.equal(ap.some(x=>bp.some(y=>y.handle===x.handle)),false,'reserved options must be globally unique');
  assert.ok(ap.every(x=>!db.prepare('SELECT id FROM username_instances WHERE handle=?').get(x.handle.slice(1))));
  assert.ok(crashState(db,b,at+4).bets.some(x=>x.userId===a.id&&x.handle==='@alpha_crash_77'));
  assert.throws(()=>cashoutCrash(db,a,at+5),/crash_too_late/);

  // Simulate a safely running shared round at approximately x2.5.
  const startAt=at-Math.ceil(Math.log(2.5)/.115*1000);
  db.prepare("UPDATE crash_rounds SET status='running',starts_at=?,crashes_at=?,crash_x=1000 WHERE id=?")
    .run(startAt,at+60000,round.id);
  assert.ok(crashMultiplier(startAt,at)>=2.49);
  const cash=cashoutCrash(db,a,at);
  assert.equal(cash.ok,true);
  assert.ok(cash.multiplier>=2.49&&cash.multiplier<=2.51);
  assert.equal(cash.reward.value,Math.floor(100000*cash.multiplier));
  assert.equal(cash.reward.handle,crashRewardOption(ap,cash.multiplier).handle);
  assert.notEqual(cash.reward.handle,'@alpha_crash_77');
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ia).status,'crash_exchanged');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory WHERE instance_id=?').get(ia).n,0);
  const won=db.prepare('SELECT * FROM username_instances WHERE id=?').get(cash.reward.id);
  assert.equal(won.status,'owned');
  assert.equal(won.obtained_type,'crash');
  assert.equal(won.owner_id,a.id);
  assert.equal(won.value,cash.reward.value);
  assert.equal(collection(db,a).items.some(i=>i.id===won.id),true);
  assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(a.id).balance,initialBalance);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_transactions WHERE user_id=? AND type=?').get(a.id,'crash_win').n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_wins WHERE bet_id=?').get(pa.betId).n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_reward_options WHERE bet_id=?').get(pa.betId).n,0);
  assert.equal(crashState(db,a,at+1).myWin.handle,cash.reward.handle);
  assert.equal(crashState(db,b,at+1).bets.find(x=>x.userId===a.id).status,'cashed');
  assert.equal(crashState(db,b,at+1).bets.find(x=>x.userId===b.id).status,'staked');

  const replay=cashoutCrash(db,a,at+10);
  assert.equal(replay.replayed,true);
  assert.equal(replay.reward.id,cash.reward.id);

  // Participant B did not cash out, and the reserved potential prizes clear.
  const next=syncCrashRound(db,at+60001);
  assert.notEqual(next.id,round.id);
  assert.equal(next.starts_at,at+60001+CRASH_WAIT_MS);
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ib).status,'crash_lost');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory WHERE instance_id=?').get(ib).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_reward_options WHERE bet_id=?').get(pb.betId).n,0);
  const lastState=crashState(db,a,at+60001);
  assert.equal(lastState.last.id,round.id);
  assert.equal(lastState.history[0].id,round.id,'recent rounds come from actual settled rounds');
  assert.equal(lastState.history[0].multiplier,1000,'history exposes recorded crash result');
  assert.equal(lastState.bets.length,0,'next round starts with no current bets');
  assert.deepEqual(lastState.lastBets.map(x=>[x.player,x.status]),[
    ['Alpha','cashed'],['Beta','lost']
  ],'settled participants remain visible until new stakes arrive');
  assert.equal(crypto.createHash('sha256').update(lastState.last.seed).digest('hex'),round.commitment);

  db.close();db=createDatabase(dir);
  assert.equal(syncCrashRound(db,at+60002).id,next.id);
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(won.id).status,'owned');
  assert.equal(cashoutCrash(db,a,at+60003,round.id).reward.id,won.id);
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('value always rises with x, stops at game maximum and never exceeds x1000',()=>{
 assert.equal(crashMultiplier(0,999999999),CRASH_MAX_X);
 assert.equal(crashMultiplier(1000,500),1);
 assert.equal(crashRewardValue(100000,1),100000);
 assert.equal(crashRewardValue(100000,2.5),250000);
 assert.equal(crashRewardValue(100000,1000),100000000);
 assert.equal(crashRewardValue(9000000,1000),CRASH_MAX_PAYOUT);
});

test('legacy money-based cashout replay does not create a second item',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-legacy-crash-'));
 const db=createDatabase(dir);
 try{
  const user=ensureUser(db,{id:18898,first_name:'Legacy'}),ia=grant(db,user,'legacy_crash_7',8000);
  const round=syncCrashRound(db,2000000000000);
  const bet=placeCrashBet(db,user,ia,2000000000001);
  db.prepare("UPDATE crash_bets SET status='cashed',cashout_x=2.5,win_amount=12000 WHERE id=?").run(bet.betId);
  const replay=cashoutCrash(db,user,2000000000002,round.id);
  assert.equal(replay.replayed,true);
  assert.equal(replay.legacy,true);
  assert.equal(replay.reward,null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_wins').get().n,0);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});
