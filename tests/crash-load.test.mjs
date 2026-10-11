import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {ensureUser} from '../src/game.mjs';
import {syncCrashRound,placeCrashBet,setCrashAutoStop,crashAutoStopAt} from '../src/crash.mjs';

test('forty players auto-settle the same shared round with unique awarded usernames',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-crash-many-'));
  const db=createDatabase(dir),now=2000000000000;
  try{
    const round=syncCrashRound(db,now);
    const ids=[];
    const measured=Date.now();
    for(let n=0;n<40;n++){
      const user=ensureUser(db,{id:String(880000+n),first_name:'Player '+n});
      const handle='stakeload'+n,price=100000;
      const template=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES (?,'EPIC',?,1,1,'load',0,1,?)")
        .run(handle,price,new Date().toISOString());
      const instance=crypto.randomUUID(),at=new Date().toISOString();
      db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES (?,? ,?,'EPIC',?,1,1,?,'owned',?,'test')")
        .run(instance,template.lastInsertRowid,handle,price,user.id,at);
      db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES (?,?,?)').run(instance,user.id,at);
      setCrashAutoStop(db,user,2.5,now+1);
      placeCrashBet(db,user,instance,now+2,round.id);
      ids.push(instance);
    }
    const startsAt=now+10000;
    db.prepare("UPDATE crash_rounds SET status='running',starts_at=?,crashes_at=?,crash_x=1000 WHERE id=?")
      .run(startsAt,startsAt+130000,round.id);
    const due=crashAutoStopAt(startsAt,2.5);
    syncCrashRound(db,due+5000);
    const active=db.prepare("SELECT * FROM crash_bets WHERE round_id=?").all(round.id);
    assert.equal(active.length,40);
    assert.equal(active.filter(x=>x.status==='cashed'&&x.settlement_kind==='auto').length,40);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_wins').get().n,40);
    assert.equal(db.prepare('SELECT COUNT(DISTINCT handle) n FROM crash_wins').get().n,40);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM crash_reward_options').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_transactions WHERE type=?').get('crash_win').n,0);
    for(const id of ids)assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(id).status,'crash_exchanged');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM username_instances WHERE status=? AND obtained_type=?').get('owned','crash').n,40);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
    console.log('Crash 40-player bet + shared settlement:',Date.now()-measured,'ms');
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});
