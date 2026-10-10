import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {ensureUser,createDrop,resolveDrop} from '../src/game.mjs';

test('expensive drops honor the earned anti-bad-luck floor instead of failing generation',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-protected-'));
  const db=createDatabase(dir);
  try{
    const user=ensureUser(db,{id:'760011',first_name:'Protected'});
    // Keep the player above every tier cost. No real currency is used.
    const scenarios=[
      {tier:'max',cost:100000,count:16},
      {tier:'strong',cost:50000,count:6},
      {tier:'boosted',cost:15000,count:6},
    ];
    let attempt=0;
    for(const scenario of scenarios){
      for(let i=0;i<scenario.count;i++){
        // Simulate the *exact* state which previously caused most failures:
        // a long streak of bad drops with 90% protected minimum payout.
        db.prepare('UPDATE users SET balance=100000000,bad_drop_streak=20,luck_points=100 WHERE id=?')
          .run(user.id);
        const current=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
        const result=createDrop(db,current,'protected-'+(++attempt),scenario.tier);
        assert.equal(result.cost,scenario.cost);
        assert.ok(result.instance.value>=Math.round(scenario.cost*.90),
          scenario.tier+' unexpectedly returned '+result.instance.value);
        assert.ok(result.instance.handle.startsWith('@'));
        const replay=createDrop(db,current,'protected-'+attempt,scenario.tier);
        assert.equal(replay.instance.id,result.instance.id);
        resolveDrop(db,current,result.instance.id,'sell');
      }
    }
    assert.equal(db.prepare('SELECT COUNT(*) n FROM drop_requests WHERE user_id=?').get(user.id).n,attempt);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM username_instances WHERE owner_id=? AND status='pending'").get(user.id).n,0);
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});
