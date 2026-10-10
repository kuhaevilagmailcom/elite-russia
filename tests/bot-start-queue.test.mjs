import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {enqueueStart,deliverStartBatch} from '../src/bot-start-queue.mjs';

test('start update is saved before acknowledgement and survives a database restart',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-start-'));
 let db;
 try{
  db=createDatabase(dir);
  assert.equal(enqueueStart(db,{updateId:1001,chatId:789,firstName:'Alex',ref:'abc'}),true);
  assert.equal(enqueueStart(db,{updateId:1001,chatId:789,firstName:'Alex',ref:'abc'}),false);
  db.prepare("INSERT INTO game_config(key,value) VALUES('telegram_update_offset','1002')").run();
  db.close();
  db=createDatabase(dir);
  assert.equal(db.prepare("SELECT value FROM game_config WHERE key='telegram_update_offset'").get()?.value,'1002');
  const sent=[];
  assert.equal(await deliverStartBatch(db,async row=>{sent.push(row)},{clock:()=>15000}),1);
  assert.deepEqual(sent.map(x=>({chat:x.chat_id,name:x.first_name,ref:x.ref})),[{chat:'789',name:'Alex',ref:'abc'}]);
  assert.equal(await deliverStartBatch(db,async()=>{throw Error('duplicate')},{clock:()=>15000}),0);
  assert.equal(db.prepare('SELECT status FROM bot_start_outbox WHERE update_id=1001').get().status,'sent');
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('a failed Telegram send is retried later without dropping the start command',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-start-retry-'));
 const db=createDatabase(dir);
 try{
  enqueueStart(db,{updateId:1002,chatId:555,firstName:'Demo'});
  await deliverStartBatch(db,async()=>{throw Error('connection reset')},{clock:()=>20000});
  const pending=db.prepare('SELECT status,attempts,next_attempt_at FROM bot_start_outbox WHERE update_id=1002').get();
  assert.equal(pending.status,'pending');assert.equal(pending.attempts,1);
  assert.ok(pending.next_attempt_at>20000);
  assert.equal(await deliverStartBatch(db,async()=>{throw Error('not yet')},{clock:()=>20000}),0);
  const chats=[];
  assert.equal(await deliverStartBatch(db,async row=>chats.push(row.chat_id),{clock:()=>pending.next_attempt_at+1}),1);
  assert.deepEqual(chats,['555']);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('blocked bot errors are marked terminal to avoid endless retries',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-start-block-'));
 const db=createDatabase(dir);
 try{
  enqueueStart(db,{updateId:1003,chatId:999});
  await deliverStartBatch(db,async()=>{throw Error('Forbidden: bot was blocked by the user')});
  assert.equal(db.prepare('SELECT status FROM bot_start_outbox WHERE update_id=1003').get().status,'failed');
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});
