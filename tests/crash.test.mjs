import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {ensureUser} from '../src/game.mjs';
import {syncCrashRound,crashState,placeCrashBet,cashoutCrash,crashMultiplier,CRASH_WAIT_MS,CRASH_MAX_X} from '../src/crash.mjs';

test('Crash: one shared round, locked usernames, secure cashout, late loss and restart recovery',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-crash-'));
  let db;
  const at=2000000000000;
  try{
    db=createDatabase(dir);
    const a=ensureUser(db,{id:7655501,first_name:'Alpha'});
    const b=ensureUser(db,{id:7655502,first_name:'Beta'});
    const grant=(user,handle,value)=>{
      const template=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES (?,?,?,?,1,'test',0,1,?)")
        .run(handle,'COMMON',value,1,new Date().toISOString());
      const id=crypto.randomUUID();
      db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES (?,?,?,?,?,1,1,?,'owned',?,'test')")
        .run(id,template.lastInsertRowid,handle,'COMMON',value,user.id,new Date().toISOString());
      db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)')
        .run(id,user.id,new Date().toISOString());
      return id;
    };
    const ia=grant(a,'alpha_crash_77',5000),ib=grant(b,'beta_crash_77',8000);
    const round=syncCrashRound(db,at);
    assert.equal(round.status,'waiting');
    assert.equal(round.starts_at,at+CRASH_WAIT_MS);
    const ash=crashState(db,a,at),bsh=crashState(db,b,at);
    assert.equal(ash.round.id,bsh.round.id);
    assert.ok(!('seed' in ash.round));
    assert.ok(!('crash_x' in ash.round));
    assert.equal(ash.available.some(i=>i.id===ia),true);
    const pa=placeCrashBet(db,a,ia,at+1);
    const pb=placeCrashBet(db,b,ib,at+2);
    assert.equal(pa.roundId,pb.roundId);
    assert.equal(placeCrashBet(db,a,ia,at+3).replayed,true);
    assert.throws(()=>placeCrashBet(db,a,ib,at+3),/crash_already_bet/);
    assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ia).status,'crash_staked');
    assert.ok(crashState(db,b,at+4).bets.some(x=>x.userId===a.id&&x.handle==='@alpha_crash_77'));
    assert.throws(()=>cashoutCrash(db,a,at+5),/crash_too_late/);

    // Force a long-lived running interval without trusting the client clock.
    const startAt=at-8000;
    db.prepare("UPDATE crash_rounds SET status='running',starts_at=?,crashes_at=?,crash_x=1000 WHERE id=?")
      .run(startAt,at+60000,round.id);
    assert.ok(crashMultiplier(startAt,at)>2);
    const cash=cashoutCrash(db,a,at);
    assert.equal(cash.ok,true);
    assert.ok(cash.multiplier>2&&cash.multiplier<1000);
    assert.equal(cash.win,Math.floor(5000*(cash.multiplier-1)));
    assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ia).status,'owned');
    const replay=cashoutCrash(db,a,at+10);
    assert.equal(replay.replayed,true);
    assert.equal(replay.win,cash.win);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_transactions WHERE user_id=? AND type=?').get(a.id,'crash_win').n,1);

    // Player B held until the crash and loses the actual locked instance.
    const next=syncCrashRound(db,at+60001);
    assert.notEqual(next.id,round.id);
    assert.equal(next.status,'waiting');
    assert.equal(next.starts_at,at+60001+CRASH_WAIT_MS);
    assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ib).status,'crash_lost');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory WHERE instance_id=?').get(ib).n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_transactions WHERE user_id=? AND type=?').get(b.id,'crash_win').n,0);
    assert.equal(db.prepare('SELECT status FROM crash_bets WHERE user_id=?').get(b.id).status,'lost');
    assert.equal(crashState(db,a,at+60001).last.id,round.id);
    assert.equal(crypto.createHash('sha256').update(crashState(db,a,at+60001).last.seed).digest('hex'),round.commitment);

    db.close();db=createDatabase(dir);
    assert.equal(syncCrashRound(db,at+60002).id,next.id,'round survives restart');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_bets WHERE user_id=?').get(a.id).n,1);
    assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(ia).status,'owned');
  }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('Crash multiplier never exceeds x1000',()=>{
 assert.equal(crashMultiplier(0,999999999),CRASH_MAX_X);
 assert.equal(crashMultiplier(1000,500),1);
});
