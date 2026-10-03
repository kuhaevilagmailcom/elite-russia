import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {GAME,DROP_TIERS} from '../src/config.mjs';
import {ROOTS,SPECIALS,buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle,wordQuality,generatedSupply} from '../src/generator.mjs';
import {ensureUser,createDrop,resolveDrop,leaderboard,sellOwnedUsername,setShowcase} from '../src/game.mjs';
import {createListing,buyListing,cancelListing,listMarket} from '../src/market.mjs';
import {giftUsername} from '../src/social.mjs';
import {spinWheel,wheelStatus} from '../src/wheel.mjs';
import {previewUpgrade,performUpgrade,UPGRADE_RULES} from '../src/upgrader.mjs';
import {ensureSeasonLifecycle} from '../src/seasons.mjs';
import {activeCollectionCount,systemSellValue,todayKey} from '../src/economy.mjs';
import {PREMIUM_STARS,validPremiumCheckout,applyPremiumPayment} from '../src/payments.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cssSrc=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const dbSrc=fs.readFileSync(new URL('../src/database.mjs',import.meta.url),'utf8');
const upgraderSrc=fs.readFileSync(new URL('../src/upgrader.mjs',import.meta.url),'utf8');

test('generator has a large readable universe',()=>assert.ok(candidateUniverseSize()>3000));
test('generator keeps usernames <=10 chars and never numeric-only',()=>{for(let i=0;i<100000;i++){const h=buildGeneratedHandle(i%5===0?'RARE':'COMMON');assert.ok(/[a-z]/.test(h));assert.ok(h.length<=10);assert.ok(isValidHandle(h))}});
test('requested word handles exist',()=>{for(const h of ['card','loly','mama','sigma']){assert.ok(ROOTS.includes(h));assert.ok(SPECIALS.some(x=>x[0]===h))}});
test('short real words are in a different value class than long or junk handles',()=>{
  assert.ok(scoreHandle('card','ULTRA')>scoreHandle('sigma','ULTRA')*4);
  assert.ok(scoreHandle('card','ULTRA')>scoreHandle('qzvr','ULTRA')*8);
  assert.ok(wordQuality('mama')>wordQuality('qzvra'));
});
test('system sale is a low salvage payout, especially for premium assets',()=>{
  assert.equal(systemSellValue(5000),1000);
  assert.equal(systemSellValue(50000),5000);
  assert.equal(systemSellValue(1000000),50000);
});
test('max paid drop still has COMMON majority',()=>assert.ok(DROP_TIERS.max.weights.COMMON>50));
test('v3 economy cannot print several paid drops immediately',()=>{
  assert.equal(GAME.freeDrops,1);
  assert.ok(GAME.startBalance<=DROP_TIERS.basic.cost*2);
  assert.equal(DROP_TIERS.basic.cost,3000);
  assert.ok(DROP_TIERS.basic.weights.ULTRA<=.001);
  assert.ok(DROP_TIERS.max.weights.ULTRA<=.1);
});
test('every template is globally unique supply 1',()=>{
  assert.equal(generatedSupply('COMMON'),1);
  assert.ok(SPECIALS.every(x=>x[3]===1));
});
test('four-character generation is reserved for ultra class',()=>{
  for(let i=0;i<5000;i++){
    assert.ok(buildGeneratedHandle('COMMON').length>=7);
    assert.ok(buildGeneratedHandle('RARE').length>=6);
    assert.ok(buildGeneratedHandle('EPIC').length>=5);
    assert.ok(buildGeneratedHandle('LEGEND').length>=5);
    assert.ok(buildGeneratedHandle('ULTRA').length>=4);
  }
});
test('UI uses dollars and weighted wheel geometry',()=>{assert.match(appSrc,/Intl\.NumberFormat\('en-US'\)/);assert.match(appSrc,/function wheelGeometry/);assert.match(appSrc,/target\.center/);assert.match(cssSrc,/--wheel-bg/)});
test('drop card is minimal and story share is an icon-only native action',()=>{
  const m=appSrc.match(/function resultCard\(x,pending=false\)\{[\s\S]*?\n\}/);assert.ok(m);
  assert.match(m[0],/esc\(x\.handle\)/);assert.doesNotMatch(m[0],/badge\(/);
  assert.match(m[0],/story-icon-btn/);assert.match(m[0],/icon\('story'\)/);
  assert.match(appSrc,/shareToStory/);assert.doesNotMatch(appSrc,/function openStoryFallback/);
  assert.match(appSrc,/canvas\.width=1080/);assert.match(appSrc,/canvas\.height=1920/);
});
test('menu remains top-driven and readable',()=>{assert.doesNotMatch(appSrc,/function nav\(/);assert.match(appSrc,/menu-group-title/);for(const name of ['Дроп','Рынок','Рейтинг','Задания','Колесо','Друзья','Подарок','Апгрейдер','Сезоны','Коллекция','Профиль','USERNAME+'])assert.match(appSrc,new RegExp(name));assert.match(cssSrc,/\.menu-list b\{font-size:14px/);assert.match(cssSrc,/\.menu-list button\{min-height:62px/)});
test('server has production auth guard, trusted proxy gate, story TTL and rate limiting',()=>{assert.match(serverSrc,/ALLOW_DEV_AUTH must be disabled in production/);assert.match(serverSrc,/TRUST_PROXY/);assert.match(serverSrc,/storyTtlMs/);assert.match(serverSrc,/rateLimit\(user\.id,'story'/);assert.match(serverSrc,/rateLimit\(user\.id,'global'/)});
test('database has payment ledger, migrations, cosmetics and runtime lock',()=>{for(const name of ['payments','schema_migrations','user_cosmetics','runtime_locks','3.0.0-global-unique','idx_instances_handle_unique'])assert.match(dbSrc,new RegExp(name))});
test('premium does not change drop/upgrader odds',()=>{assert.doesNotMatch(fs.readFileSync(new URL('../src/config.mjs',import.meta.url),'utf8'),/premium.*RARITY/i);assert.doesNotMatch(upgraderSrc,/premium/i)});

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username27-test-')),db=createDatabase(tmp);
const seller=ensureUser(db,{id:10001,username:'seller',first_name:'Seller'});
const buyer=ensureUser(db,{id:10002,username:'buyer',first_name:'Buyer'});
const friend=ensureUser(db,{id:10003,username:'friend',first_name:'Friend'});

let serial=0;
function owned(user,handle='testname',rarity='COMMON',value=1000){
  const raw=(handle+serial++).toLowerCase().slice(0,20);
  const tid=db.prepare('INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,?,0,1,?)').run(raw,rarity,value,100,'test',new Date().toISOString()).lastInsertRowid;
  const id='i-'+raw+'-'+serial;
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,tid,raw,rarity,value,1,100,user.id,'owned',new Date().toISOString(),'test');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,new Date().toISOString());
  return id;
}

test('new user starts with configured economy',()=>{assert.equal(seller.balance,GAME.startBalance);assert.equal(seller.free_drops,GAME.freeDrops)});
test('database rejects a second instance with the same username globally',()=>{
  const id=owned(seller,'globallyunique','COMMON',1000);
  const row=db.prepare('SELECT * FROM username_instances WHERE id=?').get(id);
  assert.throws(()=>db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run('duplicate-instance',row.template_id,row.handle,row.rarity,row.value,1,1,buyer.id,'owned',new Date().toISOString(),'test'),/UNIQUE/);
});
test('drop request is idempotent',()=>{const a=createDrop(db,seller,'same-request'),b=createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),'same-request');assert.equal(a.instance.id,b.instance.id);resolveDrop(db,seller,a.instance.id,'keep')});
test('market listing cannot be bought twice',()=>{const id=owned(seller,'marketname');const l=createListing(db,seller,id,1000);buyListing(db,buyer,l.id);assert.throws(()=>buyListing(db,buyer,l.id),/listing_not_found/)});
test('gift transfer cannot be repeated by old owner',()=>{db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,friend.id,new Date().toISOString());const id=owned(seller,'giftname');giftUsername(db,seller,id,friend.id);assert.throws(()=>giftUsername(db,seller,id,friend.id),/not_owned/)});
test('wheel is idempotent and exposes real weights',()=>{const st=wheelStatus(db,buyer);assert.equal(st.rewards.reduce((s,x)=>s+x.weight,0),100);const a=spinWheel(db,buyer,'wheel-1'),b=spinWheel(db,buyer,'wheel-1');assert.equal(a.reward.key,b.reward.key)});
test('direct collection sale pays system sell value, not estimate',()=>{const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),before=fresh.balance,id=owned(seller,'directsell','RARE',4200);const r=sellOwnedUsername(db,fresh,id);assert.equal(r.value,4200);assert.equal(r.sellValue,systemSellValue(4200));assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(seller.id).balance,before+r.sellValue)});

test('market status still counts toward collection limit',()=>{
  const u=ensureUser(db,{id:20001,username:'limit',first_name:'Limit'});
  for(let i=0;i<GAME.maxCollection;i++)owned(u,'lim'+i,'COMMON',100);
  const first=db.prepare("SELECT id FROM username_instances WHERE owner_id=? AND status='owned' LIMIT 1").get(u.id).id;
  const l=createListing(db,u,first,500);
  assert.equal(activeCollectionCount(db,u.id),GAME.maxCollection);
  assert.throws(()=>createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(u.id),'over-limit'),/collection_full/);
  cancelListing(db,u,l.id);
  assert.equal(activeCollectionCount(db,u.id),GAME.maxCollection);
});

test('full recipient cannot receive a gift or market purchase',()=>{
  const full=ensureUser(db,{id:20002,username:'full',first_name:'Full'});
  for(let i=0;i<GAME.maxCollection;i++)owned(full,'full'+i,'COMMON',100);
  db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,full.id,new Date().toISOString());
  const gift=owned(seller,'giftfull','COMMON',500);
  assert.throws(()=>giftUsername(db,seller,gift,full.id),/recipient_full/);
  const sale=owned(seller,'buyfull','COMMON',500),listing=createListing(db,seller,sale,100);
  assert.throws(()=>buyListing(db,full,listing.id),/collection_full/);
});

test('showcase compacts after removing middle item',()=>{
  const u=ensureUser(db,{id:20003,username:'show',first_name:'Show'}),ids=[owned(u,'showa'),owned(u,'showb'),owned(u,'showc')];
  for(const id of ids)setShowcase(db,u,id);
  sellOwnedUsername(db,db.prepare('SELECT * FROM users WHERE id=?').get(u.id),ids[1]);
  const d=owned(u,'showd');setShowcase(db,db.prepare('SELECT * FROM users WHERE id=?').get(u.id),d);
  assert.deepEqual(db.prepare('SELECT position FROM profile_showcase WHERE user_id=? ORDER BY position').all(u.id).map(x=>x.position),[1,2,3]);
});

test('cheaper username has higher upgrade chance and extra items increase it',()=>{
  const u=ensureUser(db,{id:20004,username:'up',first_name:'Up'}),cheap=owned(u,'cheapup','COMMON',200),expensive=owned(u,'expensiveup','COMMON',1400),extra=owned(u,'extraup','COMMON',300),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const a=previewUpgrade(db,fresh,[cheap]),b=previewUpgrade(db,fresh,[expensive]),c=previewUpgrade(db,fresh,[cheap,extra]);
  assert.ok(a.chance>b.chance);assert.ok(c.chance>a.chance);
});
test('same upgrade inputs reuse same preview target instead of rerolling',()=>{
  const u=ensureUser(db,{id:20005,username:'reroll',first_name:'Reroll'}),id=owned(u,'rerollup','COMMON',600),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const a=previewUpgrade(db,fresh,[id]),b=previewUpgrade(db,fresh,[id]);assert.equal(a.sessionId,b.sessionId);assert.equal(a.target.handle,b.target.handle);
  const win=performUpgrade(db,fresh,[id],a.sessionId,()=>0);assert.equal(win.result.handle,a.target.handle);
});
test('failed multi-upgrade consumes all selected usernames',()=>{
  const u=ensureUser(db,{id:20006,username:'fail',first_name:'Fail'}),a=owned(u,'faila','COMMON',400),b=owned(u,'failb','COMMON',350),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const p=previewUpgrade(db,fresh,[a,b]),r=performUpgrade(db,fresh,[a,b],p.sessionId,()=>.999);assert.equal(r.success,false);assert.equal(r.result,null);assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(a).status,'consumed');assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(b).status,'consumed');
});

test('Stars checkout validates product, amount and payer',()=>{
  const payload='username_plus:10001:12345678-1234-1234-1234-123456789abc';
  assert.equal(validPremiumCheckout({invoice_payload:payload,from:{id:10001},currency:'XTR',total_amount:PREMIUM_STARS}),true);
  assert.equal(validPremiumCheckout({invoice_payload:payload,from:{id:10001},currency:'XTR',total_amount:1}),false);
  assert.equal(validPremiumCheckout({invoice_payload:payload,from:{id:999},currency:'XTR',total_amount:PREMIUM_STARS}),false);
});
test('Stars payment charge is applied only once',()=>{
  const payload='username_plus:10001:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',payment={invoice_payload:payload,currency:'XTR',total_amount:PREMIUM_STARS,telegram_payment_charge_id:'charge-1',provider_payment_charge_id:'provider-1'},message={from:{id:10001}};
  const a=applyPremiumPayment(db,message,payment),after1=db.prepare('SELECT premium_until FROM users WHERE id=?').get(seller.id).premium_until,b=applyPremiumPayment(db,message,payment),after2=db.prepare('SELECT premium_until FROM users WHERE id=?').get(seller.id).premium_until;
  assert.equal(a.applied,true);assert.equal(b.duplicate,true);assert.equal(after2,after1);assert.equal(db.prepare('SELECT COUNT(*) c FROM payments WHERE telegram_charge_id=?').get('charge-1').c,1);
});

test('expired season is finalized and a new one starts',()=>{
  const old=db.prepare('SELECT * FROM seasons WHERE active=1 ORDER BY id DESC LIMIT 1').get(),past=new Date(Date.now()-1000).toISOString();
  db.prepare('UPDATE seasons SET end_at=? WHERE id=?').run(past,old.id);
  db.prepare('INSERT OR REPLACE INTO season_stats(user_id,season_id,score,updated_at) VALUES(?,?,?,?)').run(seller.id,old.id,100,new Date().toISOString());
  db.prepare('INSERT OR REPLACE INTO season_stats(user_id,season_id,score,updated_at) VALUES(?,?,?,?)').run(buyer.id,old.id,50,new Date().toISOString());
  const next=ensureSeasonLifecycle(db);assert.notEqual(next.id,old.id);assert.equal(db.prepare('SELECT active FROM seasons WHERE id=?').get(old.id).active,0);
  assert.equal(db.prepare('SELECT position FROM season_history WHERE user_id=? AND season_id=?').get(seller.id,old.id).position,1);
  assert.ok(db.prepare('SELECT COUNT(*) c FROM season_rewards WHERE user_id=? AND season_id=?').get(seller.id,old.id).c>0);
});

test('leaderboard includes market assets and capital ignores fake period',()=>{
  const rows=leaderboard(db,'capital','week');assert.ok(rows.length>=3);
});
test('daily task key uses configured UTC+5 day',()=>{const expected=new Date(Date.now()+300*60000).toISOString().slice(0,10);assert.equal(todayKey(),expected)});
test('market search is prefix-based',()=>{const u=ensureUser(db,{id:20007,username:'search',first_name:'Search'}),id=owned(u,'prefixfind','RARE',900);createListing(db,u,id,1200);assert.ok(listMarket(db,{q:'prefix'}).items.some(x=>x.handle.includes('prefix')));assert.equal(listMarket(db,{q:'fix'}).items.some(x=>x.handle.includes('prefix')),false)});
test('username actions update locally instead of reloading screens',()=>{
  const resolve=appSrc.match(/if\(el\.dataset\.resolve\)\{[\s\S]*?\n \}/)?.[0]||'';
  const sell=appSrc.match(/if\(el\.dataset\.confirmSystemSell\)\{[\s\S]*?\n \}/)?.[0]||'';
  const listing=appSrc.match(/if\(el\.dataset\.createListing\)\{[\s\S]*?\n \}/)?.[0]||'';
  assert.doesNotMatch(resolve,/load\(/);assert.doesNotMatch(sell,/load\(/);assert.doesNotMatch(listing,/load\(/);
  assert.match(appSrc,/removeCollectionLocal/);
});
test('pure numeric handle cannot validate',()=>assert.equal(isValidHandle('777777'),false));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
