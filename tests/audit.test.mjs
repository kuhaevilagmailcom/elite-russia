import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {createDatabase} from '../src/database.mjs';
import {ensureUser,publicUser,profile,leaderboard} from '../src/game.mjs';
import {BOT_COMMANDS} from '../src/bot-ui.mjs';

test('public player profiles never include private Telegram IDs',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-privacy-'));
  const db=createDatabase(dir);
  try {
    const a=ensureUser(db,{id:458765123,username:'alphaaudit',first_name:'A'});
    const b=ensureUser(db,{id:458765124,username:'betaaudit',first_name:'B'});
    assert.equal(Object.hasOwn(publicUser(db,a),'telegramId'),false);
    const other=profile(db,b.id);
    assert.equal(Object.hasOwn(other,'telegramId'),false);
    assert.equal(Object.hasOwn(other,'telegram_id'),false);
    assert.equal(other.id,b.id);
  } finally {db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('empty Telegram username removes stale alias for transfers',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-alias-'));
  const db=createDatabase(dir);
  try {
    const u=ensureUser(db,{id:458765125,username:'obsolete_name',first_name:'Old'});
    ensureUser(db,{id:458765125,first_name:'Updated'});
    const fresh=db.prepare('SELECT username,first_name FROM users WHERE id=?').get(u.id);
    assert.equal(fresh.username,'');
    assert.equal(fresh.first_name,'Updated');
  } finally {db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('inactive accounts are absent from the public seven-day leaderboard',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-activity-'));
  const db=createDatabase(dir);
  try {
    const active=ensureUser(db,{id:458765126,username:'active_audit',first_name:'Active'});
    const old=ensureUser(db,{id:458765127,username:'dormant_audit',first_name:'Old'});
    db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(new Date(Date.now()-20*86400000).toISOString(),old.id);
    const ids=new Set(leaderboard(db).map(x=>x.id));
    assert.ok(ids.has(active.id));
    assert.ok(!ids.has(old.id));
  } finally {db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('refund ledger columns exist and payment support is registered',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-refunds-'));
  const db=createDatabase(dir);
  try {
    const cols=new Set(db.prepare('PRAGMA table_info(payments)').all().map(c=>c.name));
    for(const c of ['refunded_at','refund_recovered_gems','refund_shortfall_gems'])assert.ok(cols.has(c));
    assert.ok(BOT_COMMANDS.some(x=>x.command==='paysupport'));
  } finally {db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('UI respects reduced motion, allows zoom and exposes Stars management',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const admin=fs.readFileSync(new URL('../public/admin-ui.js',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(app,/prefers-reduced-motion/);
  assert.doesNotMatch(html,/user-scalable=no/);
  assert.match(admin,/data-admin-refund/);
  assert.match(server,/refundStarPayment/);
});
