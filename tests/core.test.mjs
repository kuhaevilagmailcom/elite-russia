import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {GAME} from '../src/config.mjs';
import {buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle} from '../src/generator.mjs';
import {ensureUser,createDrop,resolveDrop,collection,leaderboard} from '../src/game.mjs';

test('candidate universe exceeds 3000 readable combinations',()=>assert.ok(candidateUniverseSize()>3000));
test('generator never produces numeric-only usernames in 100k samples',()=>{for(let i=0;i<100000;i++){const h=buildGeneratedHandle(i%5===0?'RARE':'COMMON');assert.ok(/[a-z]/.test(h));assert.ok(isValidHandle(h))}});
test('score rewards shorter clean usernames',()=>assert.ok(scoreHandle('monk','ULTRA',1,25)>scoreHandle('monk8392','COMMON',1,5000)));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username-test-'));const db=createDatabase(tmp);
const u=ensureUser(db,{id:10001,username:'tester',first_name:'Test'});
test('new user starts with configured economy',()=>{const r=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);assert.equal(r.balance,GAME.startBalance);assert.equal(r.free_drops,GAME.freeDrops)});
test('drop is idempotent',()=>{const a=createDrop(db,u,'same-request');const b=createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(u.id),'same-request');assert.equal(a.instance.id,b.instance.id)});
test('pending drop can be kept and appears in collection',()=>{const p=db.prepare("SELECT * FROM username_instances WHERE owner_id=? AND status='pending' LIMIT 1").get(u.id);resolveDrop(db,u,p.id,'keep');assert.equal(collection(db,u,{}).total,1)});
test('pure numeric handle cannot validate',()=>assert.equal(isValidHandle('777777'),false));
test('leaderboard includes user',()=>assert.ok(leaderboard(db,'collection').some(x=>x.id===u.id)));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
