import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {GAME,DROP_TIERS} from '../src/config.mjs';
import {ROOTS,SPECIALS,buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle,wordQuality} from '../src/generator.mjs';
import {ensureUser,createDrop,resolveDrop,leaderboard,sellOwnedUsername} from '../src/game.mjs';
import {createListing,buyListing} from '../src/market.mjs';
import {giftUsername} from '../src/social.mjs';
import {spinWheel} from '../src/wheel.mjs';
import {previewUpgrade,performUpgrade,UPGRADE_RULES} from '../src/upgrader.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cssSrc=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const dbSrc=fs.readFileSync(new URL('../src/database.mjs',import.meta.url),'utf8');
const upgraderSrc=fs.readFileSync(new URL('../src/upgrader.mjs',import.meta.url),'utf8');

test('candidate universe exceeds 3000 readable combinations',()=>assert.ok(candidateUniverseSize()>3000));
test('generator keeps usernames at 10 chars max and never numeric-only in 100k samples',()=>{for(let i=0;i<100000;i++){const h=buildGeneratedHandle(i%5===0?'RARE':'COMMON');assert.ok(/[a-z]/.test(h));assert.ok(h.length<=10);assert.ok(isValidHandle(h))}});
test('requested clean username roots exist',()=>{for(const h of ['card','loly','mama','sigma'])assert.ok(ROOTS.includes(h));for(const h of ['card','loly','mama','sigma'])assert.ok(SPECIALS.some(x=>x[0]===h))});
test('score strongly rewards shorter names at same rarity',()=>{assert.ok(scoreHandle('card','COMMON',20,5000)>scoreHandle('cardzzzzzz','COMMON',20,5000)*3)});
test('real word costs far more than random letters of same length',()=>{assert.ok(wordQuality('mama')>wordQuality('qzvra'));assert.ok(scoreHandle('mama','COMMON',20,5000)>scoreHandle('qzvr','COMMON',20,5000)*2)});
test('drop price selector is a top sheet and odds are not rendered',()=>{assert.match(appSrc,/data-drop-picker-open/);assert.match(cssSrc,/drop-cost-sheet/);assert.doesNotMatch(appSrc,/function oddsCells/);assert.match(appSrc,/Стоимость попытки/)});
test('UI uses virtual dollar formatting',()=>assert.match(appSrc,/Intl\.NumberFormat\('en-US'\)/));
test('daily wheel has six aligned visual sectors and center-stop math',()=>{assert.match(appSrc,/daily-wheel/);assert.match(appSrc,/targetCenter=idx\*segment/);assert.match(cssSrc,/from -30deg/);assert.match(cssSrc,/translateY\(-105px\)/)});
test('drop result has native Telegram story sharing',()=>{assert.match(appSrc,/data-share-story/);assert.match(appSrc,/shareToStory/);assert.match(appSrc,/canvas\.width=1080/);assert.match(appSrc,/canvas\.height=1920/);assert.match(appSrc,/Я ВЫИГРАЛ/);assert.match(cssSrc,/drop-result-card/)});
test('drop result card only shows username and actions',()=>{const m=appSrc.match(/function resultCard\(x,pending=false\)\{[\s\S]*?\n\}/);assert.ok(m);assert.match(m[0],/esc\(x\.handle\)/);assert.match(m[0],/Оставить/);assert.match(m[0],/Продать/);assert.match(m[0],/Выложить в историю/);assert.doesNotMatch(m[0],/badge\(/);assert.doesNotMatch(m[0],/Экземпляр|Редкость|НОВЫЙ USERNAME/)});

test('story images are uploaded to an authenticated endpoint and served publicly',()=>{assert.match(serverSrc,/\/api\/story-share/);assert.match(serverSrc,/\/story\//);assert.match(serverSrc,/Content-Type':'image\/jpeg/)});
test('bottom navigation stays removed and menu has drop return',()=>{assert.doesNotMatch(appSrc,/function nav\(/);assert.match(appSrc,/\['home','home','Дроп'/)});
test('top menu has every requested game section',()=>{for(const name of ['Дроп','Рынок','Рейтинг','Задания','Колесо','Друзья','Подарок','Апгрейдер','Сезоны','Коллекция','Профиль','USERNAME+'])assert.match(appSrc,new RegExp(name))});
test('new sqlite systems exist',()=>{for(const name of ['market_listings','username_transfers','wheel_history','upgrade_history','upgrade_sessions','season_stats'])assert.match(dbSrc,new RegExp(name))});
test('Telegram auth remains server-side',()=>assert.match(serverSrc,/validateInitData/));
test('USERNAME+ does not alter drop or upgrade chance tables',()=>{assert.match(serverSrc,/createInvoiceLink/);assert.doesNotMatch(fs.readFileSync(new URL('../src/config.mjs',import.meta.url),'utf8'),/premium.*RARITY/i);assert.doesNotMatch(upgraderSrc,/premium/i)});
test('max paid drop still has COMMON as majority outcome',()=>assert.ok(DROP_TIERS.max.weights.COMMON>50));
test('upgrader uses visible non-tiny chance bands',()=>{assert.ok(UPGRADE_RULES.COMMON.lowChance>=.35);assert.ok(UPGRADE_RULES.LEGEND.lowChance>=.20);assert.match(appSrc,/upgrade-roulette/);assert.match(appSrc,/Можно выиграть/)});

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username24-test-')),db=createDatabase(tmp);
const seller=ensureUser(db,{id:10001,username:'seller',first_name:'Seller'});
const buyer=ensureUser(db,{id:10002,username:'buyer',first_name:'Buyer'});
const friend=ensureUser(db,{id:10003,username:'friend',first_name:'Friend'});

let serial=0;
function owned(user,handle='testname',rarity='COMMON',value=1000){
  handle=(handle+(serial++)).toLowerCase();
  const tid=db.prepare('INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,?,0,1,?)').run(handle,rarity,value,100,'test',new Date().toISOString()).lastInsertRowid;
  const id='i-'+handle;
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,tid,handle,rarity,value,1,100,user.id,'owned',new Date().toISOString(),'test');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,new Date().toISOString());
  return id;
}

test('new user starts with configured economy',()=>{assert.equal(seller.balance,GAME.startBalance);assert.equal(seller.free_drops,GAME.freeDrops)});
test('drop is idempotent',()=>{const a=createDrop(db,seller,'same-request'),b=createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),'same-request');assert.equal(a.instance.id,b.instance.id);resolveDrop(db,seller,a.instance.id,'keep')});
test('market listing cannot be bought twice',()=>{const id=owned(seller,'marketname');const l=createListing(db,seller,id,1000);buyListing(db,buyer,l.id);assert.throws(()=>buyListing(db,buyer,l.id),/listing_not_found/)});
test('gift transfer cannot be repeated by old owner',()=>{db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,friend.id,new Date().toISOString());const id=owned(seller,'giftname');giftUsername(db,seller,id,friend.id);assert.throws(()=>giftUsername(db,seller,id,friend.id),/not_owned/)});
test('wheel request is idempotent',()=>{const a=spinWheel(db,buyer,'wheel-1'),b=spinWheel(db,buyer,'wheel-1');assert.equal(a.reward.key,b.reward.key)});

test('owned username can be sold directly from collection',()=>{
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),before=fresh.balance,id=owned(seller,'directsell','RARE',4200);
  const r=sellOwnedUsername(db,fresh,id);
  assert.equal(r.value,4200);
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(id).status,'sold');
  assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(seller.id).balance,before+4200);
});

test('cheaper username has higher upgrade chance than expensive username of same rarity',()=>{
  const cheap=owned(seller,'cheapup','COMMON',200),expensive=owned(seller,'expensiveup','COMMON',1400);
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  const a=previewUpgrade(db,fresh,[cheap]),b=previewUpgrade(db,fresh,[expensive]);
  assert.ok(a.chance>b.chance);
  assert.ok(a.chance>=.55);
  assert.ok(b.chance>=.35);
});

test('adding another username increases upgrade chance',()=>{
  const anchor=owned(seller,'anchorup','RARE',7000),extra=owned(seller,'extraup','COMMON',900);
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  const one=previewUpgrade(db,fresh,[anchor]),two=previewUpgrade(db,fresh,[anchor,extra]);
  assert.ok(two.chance>one.chance);
  assert.equal(two.sources.length,2);
});

test('upgrade preview shows exact target and success awards that exact handle',()=>{
  const source=owned(seller,'exactup','COMMON',700),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  const p=previewUpgrade(db,fresh,[source]);
  assert.ok(p.sessionId);assert.ok(p.target.handle.startsWith('@'));
  const r=performUpgrade(db,fresh,[source],p.sessionId,()=>0);
  assert.equal(r.success,true);
  assert.equal(r.result.handle,p.target.handle);
  assert.equal(r.result.rarity,p.target.rarity);
  const replay=performUpgrade(db,fresh,[source],p.sessionId,()=>.99);
  assert.equal(replay.result.id,r.result.id);
});

test('failed multi-upgrade consumes every selected username',()=>{
  const a=owned(seller,'faila','COMMON',400),b=owned(seller,'failb','COMMON',350),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  const p=previewUpgrade(db,fresh,[a,b]),r=performUpgrade(db,fresh,[a,b],p.sessionId,()=>.999);
  assert.equal(r.success,false);assert.equal(r.result,null);
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(a).status,'consumed');
  assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(b).status,'consumed');
});

test('market username cannot enter upgrader',()=>{
  const id=owned(seller,'marketup','COMMON',500),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  createListing(db,fresh,id,800);
  assert.throws(()=>previewUpgrade(db,fresh,[id]),/upgrade_invalid_items/);
});

test('pure numeric handle cannot validate',()=>assert.equal(isValidHandle('777777'),false));
test('leaderboard includes users',()=>assert.ok(leaderboard(db,'collection','all').length>=3));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
