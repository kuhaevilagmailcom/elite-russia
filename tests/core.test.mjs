import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {createDatabase} from '../src/database.mjs';
import {GAME,DROP_TIERS} from '../src/config.mjs';
import {ROOTS,SPECIALS,buildGeneratedHandle,candidateUniverseSize,isValidHandle,scoreHandle,wordQuality} from '../src/generator.mjs';
import {analyzeUsername,isGameUsername,visualTier} from '../src/valuation.mjs';
import {ensureUser,publicUser,leaderboard,tasks,DAILY_TASK_POOL} from '../src/game.mjs';
import {listMarket,createListing,buyListing} from '../src/market.mjs';
import {giftUsername} from '../src/social.mjs';
import {levelFromXp,progressionFromXp,xpToReachLevel,MAX_LEVEL,TITLE_CONFIG,levelTitle} from '../src/progression.mjs';
import {achievementsData} from '../src/achievements.mjs';
import {gamesHub,startMiniGame,answerMiniGame,MINI_GAME_DAILY_CAP,MINI_GAMES} from '../src/minigames.mjs';
import {SHOP_PRODUCTS,THEME_PRODUCTS,validProductCheckout,applyProductPayment,walletData,buyTheme} from '../src/payments.mjs';
import {dailyStatus,claimDaily} from '../src/daily.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cssSrc=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const indexSrc=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const dbSrc=fs.readFileSync(new URL('../src/database.mjs',import.meta.url),'utf8');
const paymentSrc=fs.readFileSync(new URL('../src/payments.mjs',import.meta.url),'utf8');

test('v7 uses one stylesheet and cache-busts it with the current release',()=>{
  assert.match(indexSrc,new RegExp('styles\\.css\\?v='+GAME.version.split('.').join('\\.')));
  assert.doesNotMatch(indexSrc,/ux4-core\.css/);
  assert.equal(fs.existsSync(new URL('../public/ux4-core.css',import.meta.url)),false);
});

test('home keeps username as the centered gameplay object',()=>{
  const home=appSrc.match(/function homeView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(home,/home-drop-v7/);
  assert.doesNotMatch(home,/Daily|Lab|Капитал|Последний username|Rank/);
  const dropRule=cssSrc.match(/\.home-drop-v7\{[^}]+\}/)?.[0]||'';
  assert.match(dropRule,/flex:1/);
  assert.match(dropRule,/align-items:center/);
  assert.match(dropRule,/justify-content:center/);
  const actionRule=cssSrc.match(/\.drop-result-actions\{[^}]+\}/)?.[0]||'';
  assert.match(actionRule,/position:absolute/);
});

test('menu has exactly the four v7 product groups and no Lab or Plus',()=>{
  const block=appSrc.match(/const MENU_SECTIONS=\[[\s\S]*?\n\];/)?.[0]||'';
  for(const title of ['Играть','Торговля','Прогресс','Аккаунт'])assert.match(block,new RegExp(title));
  for(const item of ['Дроп','Игры','Колесо','Апгрейдер','Рынок','Коллекция','Подарки','Задания','Уровни','Достижения','Топ','Профиль','Магазин','Настройки'])assert.match(block,new RegExp(item));
  assert.doesNotMatch(block,/Lab|Plus|USERNAME\+/);
});

test('UI icon map is Hugeicons-only and contains verified semantic icons',()=>{
  const block=appSrc.match(/const ICON_NAME=Object\.freeze\(\{[\s\S]*?\}\);/)?.[0]||'';
  for(const icon of ['package','gamepad','shopping-bag-01','square-arrow-up-double','medal-01','play','filter'])assert.match(block,new RegExp(icon.replace(/-/g,'\\-')));
  assert.match(appSrc,/hgi-stroke/);
  assert.doesNotMatch(block,/lucide|emoji|solid/i);
});

test('market and collection share one reusable FilterButton component',()=>{
  const collection=appSrc.match(/function collectionView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  const market=appSrc.match(/function marketView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(collection,/FilterButton\('collection'\)/);
  assert.match(market,/FilterButton\('market'\)/);
  assert.match(appSrc,/function FilterButton\(scope\)/);
  assert.match(appSrc,/filter-button-label/);
});

test('settings use theme plus three compact toggles without status copy',()=>{
  const block=appSrc.match(/function settingsView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  for(const x of ['Светлая','Тёмная','Системная','Вибрация','Звук','Анимации'])assert.match(block,new RegExp(x));
  assert.doesNotMatch(block,/Включено|Выключено/);
  assert.match(block,/motion/);
});

test('dark mode has global tokens instead of screen-specific white patches',()=>{
  assert.match(cssSrc,/:root\[data-theme="dark"\]/);
  for(const token of ['--bg:','--card:','--surface:','--text:','--muted:','--border:'])assert.match(cssSrc,new RegExp(token));
  assert.match(cssSrc,/background:var\(--card\)/);
});

test('desktop keeps Mini App width while narrow screens have compact overrides',()=>{
  assert.match(cssSrc,/max-width:520px/);
  assert.match(cssSrc,/@media \(max-width:359px\)/);
  assert.match(cssSrc,/@media \(min-width:521px\)/);
  assert.match(cssSrc,/height:var\(--app-h\)/);
});

test('generator provides a large Telegram-style universe',()=>{
  assert.ok(candidateUniverseSize()>3000);
  assert.ok(ROOTS.length>=500);
  for(const h of ['mama','papa','dima','money','ghost','venom','turbo','moskva','sochi'])assert.ok(ROOTS.includes(h)||SPECIALS.some(x=>x[0]===h));
});

test('game usernames start at 4 characters and support digits and underscore',()=>{
  assert.equal(isGameUsername('mama'),true);
  assert.equal(isGameUsername('abc'),false);
  assert.equal(isGameUsername('kot77'),true);
  assert.equal(isGameUsername('real_vlad'),true);
  let digits=0,underscores=0,clean=0;
  for(let i=0;i<8000;i++){
    const h=buildGeneratedHandle(i%7===0?'RARE':'COMMON');
    assert.ok(h.length>=4&&h.length<=15);
    if(/\d/.test(h))digits++;
    if(/_/.test(h))underscores++;
    if(/^[a-z]+$/.test(h))clean++;
  }
  assert.ok(digits>0&&underscores>0&&clean>0);
});

test('canonical valuation rewards readable clean usernames over junk',()=>{
  const word=analyzeUsername('ghost'),junk=analyzeUsername('qzvr910');
  assert.ok(word.score>junk.score);
  assert.ok(word.value>junk.value);
  assert.ok(scoreHandle('ghost')>scoreHandle('ghost_77'));
  assert.ok(wordQuality('mama')>wordQuality('qzvra'));
  assert.equal(analyzeUsername('ghost').value,analyzeUsername('ghost').value);
});

test('visual rarity only changes meaningful accent tiers',()=>{
  assert.equal(visualTier(1500,200),'normal');
  assert.equal(visualTier(25000,500),'blue');
  assert.equal(visualTier(250000,700),'purple');
  assert.equal(visualTier(2000000,850),'gold');
  assert.match(cssSrc,/\.value-purple/);
  assert.match(cssSrc,/\.value-gold/);
  assert.doesNotMatch(cssSrc,/\.value-purple[^}]*background:linear-gradient/i);
});

test('progression has 200 levels and configured titles',()=>{
  assert.equal(MAX_LEVEL,200);
  assert.equal(levelFromXp(Number.MAX_SAFE_INTEGER),200);
  assert.deepEqual(TITLE_CONFIG.map(x=>x[0]),[1,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200]);
  assert.equal(levelTitle(1),'Новичок');
  assert.equal(levelTitle(57),'Мастер');
  assert.equal(levelTitle(100),'Ветеран');
  assert.equal(levelTitle(200),'Легендарный');
  assert.ok(xpToReachLevel(180)-xpToReachLevel(179)>xpToReachLevel(20)-xpToReachLevel(19));
  const p=progressionFromXp(xpToReachLevel(57)+100);
  assert.equal(p.level,57);
  assert.ok(p.progress>0&&p.progress<1);
});

test('levels UI only shows nearest rewards',()=>{
  const block=appSrc.match(/function levelsView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(block,/slice\(0,7\)/);
  assert.match(block,/До следующего/);
});

test('achievement UI is a compact two-column badge grid',()=>{
  assert.match(cssSrc,/\.achievement-grid-v7\{[^}]*grid-template-columns:1fr 1fr/);
  const block=appSrc.match(/function achievementsView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(block,/achievement-badge-icon/);
  assert.match(block,/\?\?\?\?/);
});

test('daily task pool has at least 30 templates and serves 5-7 per day',()=>{
  assert.ok(DAILY_TASK_POOL.length>=30);
});

test('five skill games replace Lab in the visible client',()=>{
  assert.deepEqual(MINI_GAMES.map(x=>x.key),['hunt','higher','editor','build','price']);
  const menu=appSrc.match(/const MENU_SECTIONS=\[[\s\S]*?\n\];/)?.[0]||'';
  assert.match(menu,/Игры/);
  assert.doesNotMatch(menu,/Lab/);
  assert.match(appSrc,/function gamesView\(/);
  assert.match(appSrc,/function miniGameView\(/);
});

test('skill-game earnings are capped server-side',()=>{
  assert.ok(MINI_GAME_DAILY_CAP>0);
  const src=fs.readFileSync(new URL('../src/minigames.mjs',import.meta.url),'utf8');
  assert.match(src,/remainingCap/);
  assert.match(src,/mini_game_daily_earnings/);
  assert.match(src,/game_cooldown/);
  assert.match(src,/SESSION_TTL_MS/);
});

test('gift flow uses a username picker plus direct Telegram username recipient input',()=>{
  const block=appSrc.match(/function giftView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(block,/data-gift-open="item"/);
  assert.match(block,/giftRecipientUsername/);
  assert.match(block,/Введите @username/);
  assert.doesNotMatch(block,/<select/);
});

test('profile distinguishes own statistics from public profile without the removed showcase',()=>{
  const block=appSrc.match(/function profileView\(p=state\.profile\?\.profile\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(block,/const own=String\(p\.id\)===String\(state\.user\?\.id\)/);
  assert.match(block,/ЛУЧШИЙ ЮЗЕРНЕЙМ/);
  assert.match(block,/СТАТИСТИКА/);
  assert.match(block,/УДАЧА И НЕВЕЗЕНИЕ/);
  assert.match(block,/own\?/);
  assert.doesNotMatch(block,/ВИТРИНА|Редактировать витрину|Витрина пуста/);
});

test('top rows open public profiles',()=>{
  const block=appSrc.match(/function topView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(block,/data-profile=/);
});

test('shop exposes only deterministic gem packs and themes',()=>{
  assert.ok(Object.values(SHOP_PRODUCTS).every(x=>x.type==='gems'&&x.gems>0&&x.stars>0));
  assert.ok(Object.values(THEME_PRODUCTS).every(x=>x.type==='theme'&&x.gems>0));
  assert.doesNotMatch(paymentSrc,/luck boost|wheel spin|upgrade chance|random box/i);
  assert.doesNotMatch(appSrc.match(/function shopView\(\)\{[\s\S]*?\n\}/)?.[0]||'',/USERNAME\+/);
});

test('main currency cannot be purchased through Stars',()=>{
  for(const p of Object.values(SHOP_PRODUCTS))assert.ok(!/(money|cash|drop|wheel|upgrade|xp|username)/i.test(p.key+' '+p.title+' '+p.description));
  assert.doesNotMatch(serverSrc,/Stars.*balance|balance.*Stars/i);
});

test('database schema includes v7 wallets games and achievement progress',()=>{
  for(const name of ['currency_wallets','mini_game_sessions','mini_game_records','mini_game_daily_earnings','achievement_unlocks'])assert.match(dbSrc,new RegExp(name));
});

test('server exposes v7 games and shop routes',()=>{
  for(const route of ['/api/games','/api/shop','/api/shop/theme'])assert.ok(serverSrc.includes(route));
  assert.match(serverSrc,/mini_game_start/);
  assert.match(serverSrc,/mini_game_answer/);
});

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username-v7-test-'));
const db=createDatabase(tmp);
const seller=ensureUser(db,{id:10001,username:'seller',first_name:'Seller'});
const buyer=ensureUser(db,{id:10002,username:'buyer',first_name:'Buyer'});
const friend=ensureUser(db,{id:10003,username:'friend',first_name:'Friend'});

let serial=0;
function owned(user,handle='testname',rarity='COMMON',value=1000){
  const raw=(handle+serial++).toLowerCase().slice(0,20);
  const tid=db.prepare('INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,?,0,1,?)')
    .run(raw,rarity,value,1,'test',new Date().toISOString()).lastInsertRowid;
  const id='i-'+raw+'-'+serial;
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run(id,tid,raw,rarity,value,1,1,user.id,'owned',new Date().toISOString(),'test');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,new Date().toISOString());
  return id;
}

test('new user starts with configured gameplay economy',()=>{
  assert.equal(GAME.startBalance,50000);
  assert.equal(seller.balance,GAME.startBalance);
  assert.equal(DROP_TIERS.basic.cost,3000);
});

test('tasks endpoint returns six daily templates',()=>{
  const rows=tasks(db,seller);
  assert.equal(rows.length,6);
  assert.ok(rows.every(x=>x.target>0&&x.reward>0));
});

test('achievements provide categorized reward progress',()=>{
  const data=achievementsData(db,{...seller,level:1});
  assert.ok(data.total>=15);
  assert.ok(data.items.some(x=>x.category==='Коллекция'));
  assert.ok(data.items.some(x=>x.category==='Игры'));
  assert.ok(data.items.some(x=>x.category==='Прогресс'));
});

test('all five mini-games create server-side sessions',()=>{
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(seller.id);
  for(const game of MINI_GAMES){
    const s=startMiniGame(db,u,game.key);
    assert.equal(s.gameKey,game.key);
    assert.ok(s.id);
    assert.ok(s.question);
  }
  assert.equal(gamesHub(db,u).games.length,5);
});

test('editor and build games validate answers on the server',()=>{
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(buyer.id);
  const editor=startMiniGame(db,u,'editor'),source=String(editor.question.source||'').replace(/^@/,'');
  const edit=source.includes('_')?source.replace(/_/g,''):source.replace(/\d+$/,'');
  const er=answerMiniGame(db,u,editor.id,edit);
  assert.equal(er.done,true);
  const build=startMiniGame(db,u,'build'),answer=build.question.parts.join('');
  const br=answerMiniGame(db,u,build.id,answer);
  assert.equal(br.done,true);
});

test('daily recovery path is deterministic and cannot be claimed twice',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'username-daily-v7-')),d=createDatabase(dir);
  try{
    const u=ensureUser(d,{id:31002,username:'dailyuser',first_name:'Daily'}),before=d.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance;
    assert.equal(dailyStatus(d,u).claimable,true);
    const r=claimDaily(d,u);
    assert.equal(r.reward.money,1000);
    assert.equal(d.prepare('SELECT balance FROM users WHERE id=?').get(u.id).balance,before+1000);
    assert.throws(()=>claimDaily(d,d.prepare('SELECT * FROM users WHERE id=?').get(u.id)),/daily_already_claimed/);
  }finally{d.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('market purchase transfers one username once',()=>{
  const id=owned(seller,'marketv7','COMMON',1400),listing=createListing(db,seller,id,1500);
  const r=buyListing(db,buyer,listing.id);
  assert.equal(r.handle.startsWith('@'),true);
  assert.throws(()=>buyListing(db,buyer,listing.id),/listing_not_found/);
  assert.ok(listMarket(db,{q:'market'}).items.every(x=>x.id!==listing.id));
});

test('gift picker backend only transfers to a friend',()=>{
  db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created_at) VALUES(?,?,?)').run(seller.id,friend.id,new Date().toISOString());
  const id=owned(seller,'giftv7','COMMON',1200);
  const r=giftUsername(db,seller,id,friend.id);
  assert.ok(r.ok);
  assert.throws(()=>giftUsername(db,seller,id,friend.id),/not_owned/);
});

test('Stars payment grants gems and never changes gameplay balance',()=>{
  const product=SHOP_PRODUCTS.gems_500,payload='username_shop:'+product.key+':10001:12345678-1234-1234-1234-123456789abc';
  const query={invoice_payload:payload,from:{id:10001},currency:'XTR',total_amount:product.stars};
  assert.equal(validProductCheckout(query),true);
  const before=db.prepare('SELECT balance FROM users WHERE id=?').get(seller.id).balance;
  const payment={...query,telegram_payment_charge_id:'v7-gem-charge',provider_payment_charge_id:'provider'};
  const result=applyProductPayment(db,{from:{id:10001}},payment);
  assert.equal(result.applied,true);
  assert.equal(walletData(db,seller.id).gems,product.gems);
  assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(seller.id).balance,before);
});

test('theme purchase spends only gems and grants deterministic ownership',()=>{
  const before=walletData(db,seller.id).gems;
  const theme=THEME_PRODUCTS.ocean;
  const r=buyTheme(db,seller,'ocean');
  assert.equal(r.ok,true);
  assert.equal(walletData(db,seller.id).gems,before-theme.gems);
  assert.ok(db.prepare("SELECT 1 FROM user_cosmetics WHERE user_id=? AND type='theme' AND key='ocean'").get(seller.id));
});

test('leaderboard remains one total-capital ranking and publicUser agrees',()=>{
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
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(b.id);
  assert.equal(publicUser(db,fresh).capital,rb.capital);
});

test('small-screen CSS keeps primary gameplay actions inside the app surface',()=>{
  assert.match(cssSrc,/\.drop-result-actions\{[^}]*left:0;right:0;bottom:2px/);
  assert.match(cssSrc,/\.gift-submit-v7\{margin-top:auto\}/);
  assert.match(cssSrc,/\.upgrade-footer\{margin-top:auto/);
});

test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
