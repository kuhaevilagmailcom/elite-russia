import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {GAME,DROP_TIERS,STARTER_DROP_JACKPOT} from '../src/config.mjs';
import {ROOTS,SPECIALS,buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle,stableScoreHandle,wordQuality,generatedSupply,rarityFromValue} from '../src/generator.mjs';
import {ensureUser,createDrop,resolveDrop,leaderboard,publicUser,sellOwnedUsername,setShowcase,starterDropMode} from '../src/game.mjs';
import {createListing,buyListing,cancelListing,listMarket} from '../src/market.mjs';
import {giftUsername} from '../src/social.mjs';
import {spinWheel,wheelStatus} from '../src/wheel.mjs';
import {previewUpgrade,performUpgrade,upgradeInfo} from '../src/upgrader.mjs';
import {ensureSeasonLifecycle} from '../src/seasons.mjs';
import {activeCollectionCount,systemSellValue,todayKey} from '../src/economy.mjs';
import {PREMIUM_STARS,validPremiumCheckout,applyPremiumPayment} from '../src/payments.mjs';
import {analyzeUsername,isGameUsername,visualTier} from '../src/valuation.mjs';
import {levelFromXp,progressionFromXp,xpToReachLevel} from '../src/progression.mjs';
import {labStatus,submitLab} from '../src/lab.mjs';
import {dailyStatus,claimDaily} from '../src/daily.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cssSrc=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const uxCss=fs.readFileSync(new URL('../public/ux4-core.css',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const dbSrc=fs.readFileSync(new URL('../src/database.mjs',import.meta.url),'utf8');
const upgraderSrc=fs.readFileSync(new URL('../src/upgrader.mjs',import.meta.url),'utf8');

test('generator has a large readable universe',()=>assert.ok(candidateUniverseSize()>3000));
test('generator keeps usernames <=10 chars and never numeric-only',()=>{for(let i=0;i<100000;i++){const h=buildGeneratedHandle(i%5===0?'RARE':'COMMON');assert.ok(/[a-z]/.test(h));assert.ok(h.length<=10);assert.ok(isValidHandle(h))}});
test('requested word handles and ultra-short Telegram handles exist',()=>{
  assert.ok(ROOTS.length>=500);
  for(const h of ['card','loly','mama','papa','sosi','sosal','dedyska','sigma']){assert.ok(ROOTS.includes(h));assert.ok(SPECIALS.some(x=>x[0]===h))}
  for(const h of ['nft','ufc','gif','vid','pic'])assert.ok(SPECIALS.some(x=>x[0]===h&&x[2]>=60000000));
});
test('semantic valuation rewards readable words over junk instead of length alone',()=>{
  const word=analyzeUsername('ghost'),junk=analyzeUsername('qzvr910');
  assert.ok(word.score>junk.score);
  assert.ok(word.value>junk.value);
  assert.ok(analyzeUsername('mama').score>analyzeUsername('qxzrv').score);
  assert.ok(wordQuality('mama')>wordQuality('qzvra'));
});
test('requested rarity label never changes the canonical username value',()=>{
  const a=scoreHandle('card','COMMON',1,1,()=>.5),b=scoreHandle('card','ULTRA',1,1,()=>.5);
  assert.equal(a,b);
  assert.equal(rarityFromValue(a),rarityFromValue(scoreHandle('card')));
});
test('clean usernames beat noisy variants with digits and underscores',()=>{
  assert.ok(scoreHandle('ghost')>scoreHandle('ghost_77'));
  assert.ok(analyzeUsername('king777').breakdown.pattern>analyzeUsername('king483').breakdown.pattern);
});
test('game generation starts at four characters while ordinary three-letter generation stays excluded',()=>{
  assert.equal(isGameUsername('abcd'),true);
  assert.equal(isGameUsername('abc'),false);
  assert.equal(isValidHandle('abc'),false);
  assert.equal(isValidHandle('nft'),true);
  for(const profile of ['COMMON','RARE','EPIC','LEGEND','ULTRA'])for(let i=0;i<500;i++)assert.ok(buildGeneratedHandle(profile).length>=4);
});
test('four-character value depends on meaning and cleanliness, not a blanket multi-million floor',()=>{
  const meaningful=analyzeUsername('mama'),junk=analyzeUsername('qzvr'),numbered=analyzeUsername('a7x9');
  assert.ok(meaningful.score>junk.score);
  assert.ok(meaningful.value>junk.value);
  assert.ok(junk.value>0&&numbered.value>0);
});
test('visual value tiers map to neutral blue purple and gold presentation',()=>{
  assert.equal(visualTier(1500,200),'normal');
  assert.equal(visualTier(25000,500),'blue');
  assert.equal(visualTier(250000,700),'purple');
  assert.equal(visualTier(2000000,850),'gold');
});
test('RARE generation never creates 4 or 5 character handles',()=>{
  for(let i=0;i<5000;i++)assert.ok(buildGeneratedHandle('RARE').length>=6);
});
test('system sale uses the canonical username value everywhere',()=>{
  assert.equal(systemSellValue(5000),5000);
  assert.equal(systemSellValue(50000),50000);
  assert.equal(systemSellValue(1000000),1000000);
});
test('max paid drop still allows COMMON but meaningfully improves the profile mix',()=>{assert.ok(DROP_TIERS.max.weights.COMMON>0);assert.ok(DROP_TIERS.max.weights.COMMON<DROP_TIERS.basic.weights.COMMON);assert.ok(DROP_TIERS.max.weights.EPIC>DROP_TIERS.basic.weights.EPIC);assert.ok(DROP_TIERS.max.weights.LEGEND>DROP_TIERS.basic.weights.LEGEND)});
test('v3 economy cannot print several paid drops immediately',()=>{
  assert.equal(GAME.freeDrops,1);
  assert.equal(GAME.startBalance,50000);
  assert.equal(DROP_TIERS.basic.cost,3000);
  assert.ok(DROP_TIERS.basic.weights.ULTRA<=.001);
  assert.ok(DROP_TIERS.max.weights.ULTRA<=.5);
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
test('UI uses dollars and weighted wheel geometry',()=>{assert.match(appSrc,/Intl\.NumberFormat\('en-US'\)/);assert.match(appSrc,/function wheelGeometry/);assert.match(appSrc,/landing=target\.start\+margin/);assert.match(cssSrc,/--wheel-bg/)});
test('drop card is minimal and story share is an icon-only native action',()=>{
  const m=appSrc.match(/function resultCard\(x,pending=false\)\{[\s\S]*?\n\}/);assert.ok(m);
  assert.match(m[0],/esc\(x\.handle\)/);assert.doesNotMatch(m[0],/badge\(/);
  assert.match(m[0],/story-icon-btn/);assert.match(m[0],/icon\('story'\)/);
  assert.match(appSrc,/shareToStory/);assert.doesNotMatch(appSrc,/function openStoryFallback/);
  assert.match(appSrc,/canvas\.width=1080/);assert.match(appSrc,/canvas\.height=1920/);
});
test('menu is a compact labeled 3x3 grid with bottom shortcuts',()=>{
  assert.doesNotMatch(appSrc,/function nav\(/);
  assert.match(appSrc,/menu-grid-main/);assert.match(appSrc,/menu-grid-bottom/);assert.match(appSrc,/menu-tile/);
  for(const name of ['Дроп','Рынок','Рейтинг','Задания','Колесо','Друзья','Подарок','Апгрейдер','Сезоны','Коллекция','Профиль','USERNAME+'])assert.match(appSrc,new RegExp(name));
  assert.match(uxCss,/\.menu-grid-main,.menu-grid-bottom\{[^}]*grid-template-columns:repeat\(3/);
  assert.match(uxCss,/\.menu-tile\{[^}]*height:74px/);
});
test('server has production auth guard, trusted proxy gate, story TTL and rate limiting',()=>{assert.match(serverSrc,/ALLOW_DEV_AUTH must be disabled in production/);assert.match(serverSrc,/TRUST_PROXY/);assert.match(serverSrc,/storyTtlMs/);assert.match(serverSrc,/rateLimit\(user\.id,'story'/);assert.match(serverSrc,/rateLimit\(user\.id,'global'/)});
test('database has payment ledger, migrations, backups, indexes and integrity checks',()=>{for(const name of ['payments','schema_migrations','user_cosmetics','runtime_locks','username_lab_attempts','xp_history','6.0.0-valuation-progression','idx_instances_handle_unique','idx_instances_owner_status_value','VACUUM INTO','integrity_check'])assert.match(dbSrc,new RegExp(name))});
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

test('new user starts with configured economy',()=>{assert.equal(GAME.startBalance,50000);assert.equal(seller.balance,GAME.startBalance);assert.equal(seller.free_drops,GAME.freeDrops)});
test('database rejects a second instance with the same username globally',()=>{
  const id=owned(seller,'globallyunique','COMMON',1000);
  const row=db.prepare('SELECT * FROM username_instances WHERE id=?').get(id);
  assert.throws(()=>db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run('duplicate-instance',row.template_id,row.handle,row.rarity,row.value,1,1,buyer.id,'owned',new Date().toISOString(),'test'),/UNIQUE/);
});
test('drop request is idempotent',()=>{const a=createDrop(db,seller,'same-request'),b=createDrop(db,db.prepare('SELECT * FROM users WHERE id=?').get(seller.id),'same-request');assert.equal(a.instance.id,b.instance.id);resolveDrop(db,seller,a.instance.id,'keep')});
test('3K starter drop has low-value normals plus tiny jackpot bands',()=>{
  assert.equal(starterDropMode(0),'ultra');
  assert.equal(starterDropMode(STARTER_DROP_JACKPOT.ultraChance+STARTER_DROP_JACKPOT.bigChance/2),'big');
  assert.equal(starterDropMode(STARTER_DROP_JACKPOT.ultraChance+STARTER_DROP_JACKPOT.bigChance+STARTER_DROP_JACKPOT.rareChance/2),'rare');
  assert.equal(starterDropMode(.5),'normal');
  assert.ok(STARTER_DROP_JACKPOT.rareChance<.01);
  assert.ok(STARTER_DROP_JACKPOT.bigChance<.001);
  assert.ok(STARTER_DROP_JACKPOT.ultraChance<=.00001);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-starter-test-')),starterDb=createDatabase(dir);
  try{
    const u=ensureUser(starterDb,{id:10004,username:'starter',first_name:'Starter'});
    starterDb.prepare('UPDATE users SET balance=1000000,free_drops=0 WHERE id=?').run(u.id);
    for(let i=0;i<80;i++){
      const fresh=starterDb.prepare('SELECT * FROM users WHERE id=?').get(u.id);
      const r=createDrop(starterDb,fresh,'starter-'+i,'basic'),v=r.instance.value;
      const allowed=(v>=STARTER_DROP_JACKPOT.normalMin&&v<=STARTER_DROP_JACKPOT.normalMax)||
        (v>=STARTER_DROP_JACKPOT.goodMin&&v<=STARTER_DROP_JACKPOT.goodMax)||
        (v>=STARTER_DROP_JACKPOT.rareMin&&v<=STARTER_DROP_JACKPOT.rareMax)||
        (v>=STARTER_DROP_JACKPOT.bigMin&&v<=STARTER_DROP_JACKPOT.bigMax)||
        v>=STARTER_DROP_JACKPOT.ultraMin;
      assert.ok(allowed,'starter value '+v+' for '+r.instance.handle);
      resolveDrop(starterDb,starterDb.prepare('SELECT * FROM users WHERE id=?').get(u.id),r.instance.id,'sell');
    }
  }finally{starterDb.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('level progression is nonlinear and capped at level 100',()=>{
  assert.equal(levelFromXp(0),1);
  assert.ok(xpToReachLevel(10)>xpToReachLevel(5));
  assert.ok(xpToReachLevel(50)-xpToReachLevel(49)>xpToReachLevel(5)-xpToReachLevel(4));
  assert.equal(levelFromXp(Number.MAX_SAFE_INTEGER),100);
  const p=progressionFromXp(xpToReachLevel(17)+100);
  assert.equal(p.level,17);assert.ok(p.progress>0&&p.progress<1);assert.ok(p.remaining>0);
});
test('Username Lab is a server-side skill earning path with 4-character minimum',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-lab-test-')),labDb=createDatabase(dir);
  try{
    const u=ensureUser(labDb,{id:31001,username:'labuser',first_name:'Lab'}),before=labDb.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance;
    const status=labStatus(labDb,u);assert.equal(status.attempts,0);assert.ok(status.dailyCap>0);
    const r=submitLab(labDb,u,'turbox');
    assert.ok(r.score>=0&&r.score<=100);assert.ok(r.reward>0);assert.ok(r.xp>0);
    assert.equal(labStatus(labDb,labDb.prepare('SELECT * FROM users WHERE id=?').get(u.id)).attempts,1);
    assert.ok(labDb.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance>before);
    assert.equal(labDb.prepare('SELECT value FROM task_progress WHERE user_id=? AND progress_date=? AND task_key=?').get(u.id,todayKey(),'lab').value,1);
  }finally{labDb.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('daily income gives a deterministic recovery path and cannot be claimed twice',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-daily-test-')),dailyDb=createDatabase(dir);
  try{
    const u=ensureUser(dailyDb,{id:31002,username:'dailyuser',first_name:'Daily'}),before=dailyDb.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance;
    assert.equal(dailyStatus(dailyDb,u).claimable,true);
    const r=claimDaily(dailyDb,u);assert.equal(r.day,1);assert.equal(r.reward.money,1000);
    assert.equal(dailyDb.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance,before+1000);
    assert.throws(()=>claimDaily(dailyDb,dailyDb.prepare('SELECT * FROM users WHERE id=?').get(u.id)),/daily_already_claimed/);
  }finally{dailyDb.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('market listing cannot be bought twice',()=>{const id=owned(seller,'marketname');const l=createListing(db,seller,id,1000);buyListing(db,buyer,l.id);assert.throws(()=>buyListing(db,buyer,l.id),/listing_not_found/)});
test('gift transfer cannot be repeated by old owner',()=>{db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,friend.id,new Date().toISOString());const id=owned(seller,'giftname');giftUsername(db,seller,id,friend.id);assert.throws(()=>giftUsername(db,seller,id,friend.id),/not_owned/)});
test('wheel is idempotent and exposes worthwhile real-weight rewards',()=>{
  const st=wheelStatus(db,buyer);assert.equal(st.rewards.reduce((s,x)=>s+x.weight,0),100);
  const byKey=Object.fromEntries(st.rewards.map(x=>[x.key,x]));
  assert.equal(byKey.cash3000.label,'$3K');
  assert.equal(byKey.cash10000.label,'$10K');
  assert.equal(byKey.cash25000.label,'$25K');
  assert.ok(byKey.username.weight>0);
  const a=spinWheel(db,buyer,'wheel-1'),b=spinWheel(db,buyer,'wheel-1');assert.equal(a.reward.key,b.reward.key)
});
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

test('upgrader accepts exactly one username and chance matches the displayed price ratio',()=>{
  const u=ensureUser(db,{id:20004,username:'up',first_name:'Up'}),source=owned(u,'cheapup','COMMON',200),extra=owned(u,'extraup','COMMON',300),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const a=previewUpgrade(db,fresh,[source]);
  assert.equal(upgradeInfo(db,fresh).maxItems,1);
  assert.equal(a.maxItems,1);
  assert.ok(Math.abs(a.chance-Math.max(.01,Math.min(.75,200*.9/a.target.value)))<1e-12);
  assert.throws(()=>previewUpgrade(db,fresh,[source,extra]),/bad_upgrade/);
});
test('same upgrade inputs reuse same preview target instead of rerolling',()=>{
  const u=ensureUser(db,{id:20005,username:'reroll',first_name:'Reroll'}),id=owned(u,'rerollup','COMMON',600),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const a=previewUpgrade(db,fresh,[id]),b=previewUpgrade(db,fresh,[id]);assert.equal(a.sessionId,b.sessionId);assert.equal(a.target.handle,b.target.handle);
  const win=performUpgrade(db,fresh,[id],a.sessionId,()=>0);assert.equal(win.result.handle,a.target.handle);
});
test('failed single upgrade consumes the selected username',()=>{
  const u=ensureUser(db,{id:20006,username:'fail',first_name:'Fail'}),a=owned(u,'faila','COMMON',400),fresh=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const p=previewUpgrade(db,fresh,[a]),r=performUpgrade(db,fresh,[a],p.sessionId,()=>.999);assert.equal(r.success,false);assert.equal(r.result,null);assert.equal(db.prepare('SELECT status FROM username_instances WHERE id=?').get(a).status,'consumed');
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

test('daily task key uses configured UTC+5 day',()=>{const expected=new Date(Date.now()+300*60000).toISOString().slice(0,10);assert.equal(todayKey(),expected)});
test('market search is prefix-based',()=>{const u=ensureUser(db,{id:20007,username:'search',first_name:'Search'}),id=owned(u,'prefixfind','RARE',900);createListing(db,u,id,1200);assert.ok(listMarket(db,{q:'prefix'}).items.some(x=>x.handle.includes('prefix')));assert.equal(listMarket(db,{q:'fix'}).items.some(x=>x.handle.includes('prefix')),false)});
test('username actions update locally instead of reloading screens',()=>{
  const blocks=[
    appSrc.match(/if\(el\.dataset\.resolve\)\{[\s\S]*?\n \}/)?.[0]||'',
    appSrc.match(/if\(el\.dataset\.confirmSystemSell\)\{[\s\S]*?\n \}/)?.[0]||'',
    appSrc.match(/if\(el\.dataset\.createListing\)\{[\s\S]*?\n \}/)?.[0]||'',
    appSrc.match(/if\(el\.dataset\.marketBuy\)\{[\s\S]*?return\}/)?.[0]||'',
    appSrc.match(/if\(el\.dataset\.marketCancel\)\{[\s\S]*?return\}/)?.[0]||'',
    appSrc.match(/if\(el\.hasAttribute\('data-gift'\)\)\{[\s\S]*?return\}/)?.[0]||''
  ];
  for(const block of blocks){assert.ok(block);assert.doesNotMatch(block,/load\(/)}
  assert.match(appSrc,/removeCollectionLocal/);assert.match(appSrc,/removeMarketLocal/);assert.match(appSrc,/removeGiftLocal/);
});
test('leaderboard is a single total-capital ranking',()=>{
  const a=ensureUser(db,{id:21001,username:'rankA',first_name:'Rank A'});
  const b=ensureUser(db,{id:21002,username:'rankB',first_name:'Rank B'});
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(5000,a.id);
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(1000,b.id);
  owned(a,'rankassetA','COMMON',1000);
  owned(b,'rankassetB','COMMON',9000);
  const rows=leaderboard(db),ra=rows.find(x=>x.id===a.id),rb=rows.find(x=>x.id===b.id);
  assert.equal(ra.capital,6000);
  assert.equal(rb.capital,10000);
  assert.ok(rb.position<ra.position);
});
test('leaderboard counts pending and market usernames as assets',()=>{
  const u=ensureUser(db,{id:21003,username:'rankC',first_name:'Rank C'});
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(2000,u.id);
  const pending=owned(u,'rankpending','COMMON',3000);
  db.prepare("UPDATE username_instances SET status='pending' WHERE id=?").run(pending);
  const market=owned(u,'rankmarket','COMMON',4000);
  db.prepare("UPDATE username_instances SET status='market' WHERE id=?").run(market);
  const row=leaderboard(db).find(x=>x.id===u.id);
  assert.equal(row.capital,9000);
  assert.equal(row.username_value,7000);
});
test('leaderboard UI has no separate modes or periods',()=>{
  const m=appSrc.match(/function topView\(\)\{[\s\S]*?\n\}/);assert.ok(m);
  assert.match(m[0],/ОБЩИЙ КАПИТАЛ/i);
  assert.match(m[0],/r\.capital/);
  assert.doesNotMatch(m[0],/mode-tabs|period-tabs|rankMode|rankPeriod/);
});
test('sold and consumed usernames do not count toward total capital',()=>{
  const u=ensureUser(db,{id:21004,username:'rankD',first_name:'Rank D'});
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(3000,u.id);
  const sold=owned(u,'ranksold','COMMON',5000),consumed=owned(u,'rankconsumed','COMMON',7000),kept=owned(u,'rankkept','COMMON',2000);
  db.prepare("UPDATE username_instances SET status='sold' WHERE id=?").run(sold);
  db.prepare("UPDATE username_instances SET status='consumed' WHERE id=?").run(consumed);
  const row=leaderboard(db).find(x=>x.id===u.id);
  assert.equal(row.capital,5000);
  assert.equal(row.username_value,2000);
});
test('publicUser rank uses exactly the same capital formula as leaderboard',()=>{
  const u=db.prepare('SELECT * FROM users WHERE telegram_id=?').get('21003');
  const p=publicUser(db,u),row=leaderboard(db).find(x=>x.id===u.id);
  assert.equal(p.capital,row.capital);
  assert.equal(p.rank,row.position);
});
test('leaderboard cache is invalidated on capital-changing API actions',()=>{
  assert.match(serverSrc,/function invalidateLeaderboard\(\)/);
  for(const token of ['createDrop','resolveDrop','claimTask','sellOwnedUsername','buyListing','giftUsername','spinWheel','performUpgrade'])assert.match(serverSrc,new RegExp(token+'[\\s\\S]{0,220}invalidateLeaderboard'));
});
test('story sharing uses same-origin public media path and no modal fallback',()=>{
  assert.match(appSrc,/new URL\(uploaded\.mediaPath,location\.origin\)/);
  assert.match(serverSrc,/mediaPath='\/story\/'/);
  assert.doesNotMatch(appSrc,/function openStoryFallback/);
});
test('pure numeric handle cannot validate',()=>assert.equal(isValidHandle('777777'),false));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
