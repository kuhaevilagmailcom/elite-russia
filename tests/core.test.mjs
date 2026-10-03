import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {GAME,DROP_TIERS} from '../src/config.mjs';
import {buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle} from '../src/generator.mjs';
import {ensureUser,createDrop,resolveDrop,leaderboard} from '../src/game.mjs';
import {createListing,buyListing} from '../src/market.mjs';
import {giftUsername} from '../src/social.mjs';
import {spinWheel} from '../src/wheel.mjs';
import {performUpgrade,UPGRADE_RULES} from '../src/upgrader.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cssSrc=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const dbSrc=fs.readFileSync(new URL('../src/database.mjs',import.meta.url),'utf8');
const upgraderSrc=fs.readFileSync(new URL('../src/upgrader.mjs',import.meta.url),'utf8');

test('candidate universe exceeds 3000 readable combinations',()=>assert.ok(candidateUniverseSize()>3000));
test('generator never produces numeric-only usernames in 100k samples',()=>{for(let i=0;i<100000;i++){const h=buildGeneratedHandle(i%5===0?'RARE':'COMMON');assert.ok(/[a-z]/.test(h));assert.ok(isValidHandle(h))}});
test('score rewards shorter clean usernames',()=>assert.ok(scoreHandle('monk','ULTRA',1,25)>scoreHandle('monk8392','COMMON',1,5000)));
test('bottom navigation was removed',()=>{assert.doesNotMatch(appSrc,/function nav\(/);assert.doesNotMatch(cssSrc,/\.nav\{/);assert.match(appSrc,/data-menu-open/)});
test('top menu has every requested game section',()=>{for(const name of ['Рынок','Рейтинг','Задания','Колесо','Друзья','Подарок','Апгрейдер','Сезоны','Коллекция','Профиль','USERNAME+'])assert.match(appSrc,new RegExp(name))});
test('new sqlite systems exist',()=>{for(const name of ['market_listings','market_transactions','referrals','friends','referral_rewards','username_transfers','wheel_history','upgrade_history','season_stats','season_rewards','events','event_templates'])assert.match(dbSrc,new RegExp(name))});
test('Telegram auth remains server-side',()=>assert.match(serverSrc,/validateInitData/));
test('USERNAME+ payment exists and does not alter rarity weights',()=>{assert.match(serverSrc,/createInvoiceLink/);assert.doesNotMatch(fs.readFileSync(new URL('../src/config.mjs',import.meta.url),'utf8'),/premium.*RARITY/i)});
test('market usernames are excluded from upgrader',()=>assert.match(upgraderSrc,/status='owned'/));
test('max drop tier still has COMMON as the majority outcome',()=>assert.ok(DROP_TIERS.max.weights.COMMON>50));
test('single-item upgrader uses low visible chances',()=>{assert.equal(UPGRADE_RULES.COMMON.successChance,.20);assert.equal(UPGRADE_RULES.LEGEND.successChance,.08);assert.match(appSrc,/upgrade-roulette/)});

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username2-test-')),db=createDatabase(tmp);
const seller=ensureUser(db,{id:10001,username:'seller',first_name:'Seller'});
const buyer=ensureUser(db,{id:10002,username:'buyer',first_name:'Buyer'});
const friend=ensureUser(db,{id:10003,username:'friend',first_name:'Friend'});

function owned(user,handle='testname',rarity='COMMON',value=1000){
  const tid=db.prepare('INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,?,0,1,?)').run(handle,rarity,value,100,'test',new Date().toISOString()).lastInsertRowid;
  const id='i-'+handle+'-'+Math.random().toString(36).slice(2);
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,tid,handle,rarity,value,1,100,user.id,'owned',new Date().toISOString(),'test');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,new Date().toISOString());
  return id;
}

test('new user starts with configured economy',()=>{assert.equal(seller.balance,GAME.startBalance);assert.equal(seller.free_drops,GAME.freeDrops)});
test('drop is idempotent',()=>{const a=createDrop(db,seller,'same-request'),b=createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),'same-request');assert.equal(a.instance.id,b.instance.id);resolveDrop(db,seller,a.instance.id,'keep')});
test('market listing cannot be bought twice',()=>{const id=owned(seller,'marketname');const l=createListing(db,seller,id,1000);buyListing(db,buyer,l.id);assert.throws(()=>buyListing(db,buyer,l.id),/listing_not_found/)});
test('gift transfer cannot be repeated by old owner',()=>{db.prepare('INSERT INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,friend.id,new Date().toISOString());const id=owned(seller,'giftname');giftUsername(db,seller,id,friend.id);assert.throws(()=>giftUsername(db,seller,id,friend.id),/not_owned/)});
test('wheel request is idempotent',()=>{const a=spinWheel(db,buyer,'wheel-1'),b=spinWheel(db,buyer,'wheel-1');assert.equal(a.reward.key,b.reward.key)});
test('upgrader rejects username owned by someone else',()=>{const id=owned(seller,'upforeign');assert.throws(()=>performUpgrade(db,buyer,id,'foreign-1',()=>0),/upgrade_invalid_items/)});
test('upgrader failure consumes exactly one source and creates nothing',()=>{const id=owned(seller,'upfail','COMMON',1500);const r=performUpgrade(db,seller,id,'fail-1',()=>.99);assert.equal(r.success,false);assert.equal(r.result,null);assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(id).status,'consumed')});
test('upgrader success creates a more valuable next-rarity username',()=>{const id=owned(seller,'upwin','COMMON',1500);const r=performUpgrade(db,seller,id,'win-1',()=>0);assert.equal(r.success,true);assert.equal(r.result.rarity,'RARE');assert.ok(r.result.value>=r.targetMinValue);const replay=performUpgrade(db,seller,id,'win-1',()=>.99);assert.equal(replay.result.id,r.result.id)});
test('pure numeric handle cannot validate',()=>assert.equal(isValidHandle('777777'),false));
test('leaderboard includes users',()=>assert.ok(leaderboard(db,'collection','all').length>=3));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
