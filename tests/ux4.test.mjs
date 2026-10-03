import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDatabase} from '../src/database.mjs';
import {ensureUser,collection,setShowcase} from '../src/game.mjs';
import {createListing,listMarket} from '../src/market.mjs';
import {friendsData} from '../src/social.mjs';
import {wheelStatus,WHEEL_USERNAMES} from '../src/wheel.mjs';
import {GAME} from '../src/config.mjs';

const appSrc=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const uxCss=fs.readFileSync(new URL('../public/ux4-core.css',import.meta.url),'utf8');
const adminCss=fs.readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
const adminUi=fs.readFileSync(new URL('../public/admin-ui.js',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const wheelSrc=fs.readFileSync(new URL('../src/wheel.mjs',import.meta.url),'utf8');
const gameSrc=fs.readFileSync(new URL('../src/game.mjs',import.meta.url),'utf8');

test('long usernames use responsive fit instead of clipping',()=>{
  assert.match(appSrc,/function fitUsername/);
  assert.match(appSrc,/data-fit-username/);
  assert.match(uxCss,/drop-result-main\.minimal h1\{[^}]*white-space:nowrap/);
  assert.doesNotMatch(uxCss,/drop-result-main\.minimal h1\{[^}]*overflow:hidden/);
});
test('drop starts from the central username area and has no separate drop CTA',()=>{
  const home=appSrc.match(/function homeView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(home,/data-drop-trigger/);
  assert.match(home,/handle-stage drop-trigger/);
  assert.doesNotMatch(home,/id="dropBtn"|class="drop-btn"/);
  assert.match(appSrc,/hasAttribute\('data-drop-trigger'\)/);
});
test('drop animation is about three seconds and lands on server result',()=>{
  const m=appSrc.match(/const reduced=.*?delays=reduced\?\[[^\]]+\]:\[([^\]]+)\]/);
  assert.ok(m);
  const total=m[1].split(',').map(Number).reduce((a,b)=>a+b,0);
  assert.ok(total>=2800&&total<=3500,total);
  const fn=appSrc.match(/async function animateDrop\(result\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(fn,/esc\(result\.handle\)/);
});
test('important UX uses click events and does not depend on touch-only handlers',()=>{
  assert.match(appSrc,/document\.addEventListener\('click'/);
  assert.doesNotMatch(appSrc,/touchstart|touchend/);
  assert.match(appSrc,/requestAnimationFrame/);
});
test('upgrader uses a horizontal slot track, not the old circular roulette',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/slot-viewport|upgradeSpinning/);
  assert.doesNotMatch(view,/upgrade-roulette|upgrade-wheel-wrap/);
  assert.match(appSrc,/slot-track/);
  assert.match(uxCss,/\.slot-track/);
});
test('upgrader has one screen title and no visible five-item-limit copy',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(appSrc,/page==='upgrader'\)shell\('Апгрейдер',upgraderView\(\)\)/);
  assert.match(view,/Выбери usernames и попробуй получить более дорогой/);
  assert.doesNotMatch(view,/>Апгрейдер</);
  assert.doesNotMatch(view,/Выбери до|от 1 до 5|максимум 5|5 usernames/i);
  assert.doesNotMatch(appSrc,/Лимит выбора достигнут|Можно выбрать максимум 5 usernames/);
});
test('upgrader selection cards are compact and footer is sticky',()=>{
  assert.match(uxCss,/\.upgrade-selected\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(uxCss,/\.upgrade-selected>button\{[^}]*height:54px/);
  assert.match(uxCss,/\.upgrade-pick\{[^}]*height:60px/);
  assert.match(uxCss,/\.upgrade-footer\{[^}]*position:sticky[^}]*bottom:0[^}]*height:76px/);
  assert.match(uxCss,/\.upgrade-footer button\{[^}]*height:54px/);
});
test('upgrader lazily extends the real inventory without replacing selected usernames',()=>{
  assert.match(appSrc,/upgradeVisibleCount:30/);
  assert.match(appSrc,/function appendUpgradeBatch\(\)/);
  assert.match(appSrc,/from\+18/);
  assert.match(appSrc,/remaining<310/);
  assert.match(appSrc,/upgradeScrollTop/);
  assert.match(appSrc,/list\.scrollTop=state\.upgradeScrollTop/);
  assert.match(appSrc,/slice\(0,state\.upgradeVisibleCount\|\|30\)/);
});
test('drop roll builds fresh unique random usernames instead of cycling a fixed list',()=>{
  assert.match(appSrc,/const ROLL_BASES=\[/);
  assert.match(appSrc,/function randomRollUsername/);
  assert.match(appSrc,/function buildRollSequence/);
  assert.match(appSrc,/const used=new Set\(\)/);
  assert.match(appSrc,/samples=buildRollSequence\(delays\.length,result\.handle\)/);
  assert.doesNotMatch(appSrc,/const samples=\['@vision','@storm7'/);
});
test('upgrader result keeps price and chance on one compact line',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/upgrade-target-meta/);
  assert.match(view,/fmt\(p\.target\.value\)/);
  assert.match(view,/Шанс <b>/);
  assert.match(uxCss,/\.upgrade-target\{[^}]*min-height:88px/);
});


test('collection UI removed rarity filter chips',()=>{
  const view=appSrc.match(/function collectionView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/data-collection-filter-open/);
  for(const r of ['COMMON','RARE','EPIC','LEGEND','ULTRA'])assert.doesNotMatch(view,new RegExp(r));
});
test('market uses compact search and filter sheet instead of rarity chips',()=>{
  const view=appSrc.match(/function marketView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/Поиск username/);
  assert.match(view,/data-market-filter-open/);
  assert.doesNotMatch(view,/market-rarity|RARE|EPIC|LEGEND|ULTRA/);
});
test('leaderboard UI emphasizes money and has a top-three podium',()=>{
  const view=appSrc.match(/function topView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/podium/);assert.match(view,/money-rank/);assert.match(view,/fmt\(r\.capital\)/);assert.match(view,/Кто богаче/);
  assert.match(uxCss,/money-rank\.hero/);
});
test('wheel is responsive, centered and uses true weight geometry',()=>{
  assert.match(appSrc,/function wheelGeometry/);
  assert.match(appSrc,/start=cursor\/total\*360/);
  assert.match(uxCss,/\.wheel-stage\{--wheel-size:/);
  assert.match(uxCss,/border-radius:50%/);
  assert.match(uxCss,/daily-wheel-pointer/);
});
test('wheel hides labels from tiny sectors and lists rare prizes separately',()=>{
  const view=appSrc.match(/function wheelView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/rare=g\.rows\.filter\(x=>x\.span<12\)/);
  assert.match(view,/visible=g\.rows\.filter\(x=>x\.span>=12\)/);
  assert.match(view,/visible\.map\(x=>'<span class="daily-wheel-label"/);
  assert.match(view,/wheel-rare/);
  assert.match(view,/РЕДКИЕ ПРИЗЫ/);
});
test('wheel result persists locally and spin is driven by server reward',()=>{
  assert.match(appSrc,/wheelLastResult:null/);
  assert.match(appSrc,/state\.wheelLastResult=r\.reward/);
  assert.match(appSrc,/target=g\.rows\.find\(x=>x\.key===r\.reward\.key\)/);
  assert.match(appSrc,/3\.6s cubic-bezier/);
  assert.match(appSrc,/await new Promise\(x=>setTimeout\(x,3650\)\)/);
});
test('wheel disabled CTA is visually distinct',()=>{
  assert.match(uxCss,/\.wheel-spin-button:disabled\{[^}]*background:#d7eefa!important[^}]*opacity:1/);
});
test('new players start with exactly 50000 virtual dollars',()=>assert.equal(GAME.startBalance,50000));

test('referral screen has copy and native Telegram share actions',()=>{
  const view=appSrc.match(/function friendsView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/data-copy-ref/);assert.match(view,/data-share-ref/);
  assert.match(appSrc,/openTelegramLink/);
  assert.match(appSrc,/t\.me\/share\/url/);
});
test('admin menu is shown conditionally and fixed admin IDs exist server-side',()=>{
  assert.match(appSrc,/state\.user\?\.isAdmin/);
  assert.match(serverSrc,/8464597898/);
  assert.match(serverSrc,/1141626866/);
  assert.match(serverSrc,/DEFAULT_ADMIN_IDS/);
  assert.match(adminUi,/data-admin-user-reset/);
  assert.match(adminUi,/RESET USERNAME/);
});
test('full reset UI requires typed phrase and a second confirmation stage',()=>{
  assert.match(adminUi,/adminResetStage===1/);
  assert.match(adminUi,/data-admin-reset-arm/);
  assert.match(adminUi,/adminResetStage=2/);
  assert.match(adminUi,/data-admin-reset-confirm/);
});
test('all main controls meet mobile touch-target sizing in final CSS layer',()=>{
  assert.match(uxCss,/button\{min-height:44px\}/);
  assert.match(uxCss,/story-icon-btn/);
  assert.match(uxCss,/@media\(max-width:370px\)/);
  assert.match(uxCss,/@media\(min-width:768px\)/);
  assert.match(adminCss,/admin-search button/);
});
test('username action handlers avoid full section reloads',()=>{
  const patterns=[
    /if\(el\.dataset\.resolve\)[\s\S]{0,450}?return/,
    /if\(el\.dataset\.confirmSystemSell\)[\s\S]{0,650}?return/,
    /if\(el\.dataset\.createListing\)[\s\S]{0,650}?return/,
    /if\(el\.dataset\.marketBuy\)[\s\S]{0,450}?return/,
    /if\(el\.dataset\.marketCancel\)[\s\S]{0,400}?return/,
    /if\(el\.hasAttribute\('data-gift'\)\)[\s\S]{0,650}?return/,
    /if\(el\.dataset\.showcase\)[\s\S]{0,500}?return/
  ];
  for(const p of patterns){const m=appSrc.match(p)?.[0]||'';assert.ok(m,p);assert.doesNotMatch(m,/load\(/)}
});

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username-ux4-')),db=createDatabase(tmp);
const user=ensureUser(db,{id:41001,username:'uxuser',first_name:'UX'});
const buyer=ensureUser(db,{id:41002,username:'uxbuyer',first_name:'Buyer'});
let serial=0;
function ownedIn(owner,handle,value=1000,when=new Date().toISOString()){
  const raw=(handle+serial++).toLowerCase().slice(0,10),rarity=value>=500000?'LEGEND':value>=100000?'EPIC':value>=15000?'RARE':'COMMON';
  const tid=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,'test',0,1,?)").run(raw,rarity,value,1,when).lastInsertRowid;
  const id='ux-'+raw+'-'+serial;
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,1,1,?,'owned',?,'test')").run(id,tid,raw,rarity,value,owner.id,when);
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,owner.id,when);
  return id;
}
const old=ownedIn(user,'oldname',900,new Date(Date.now()-86400000).toISOString());
const cheap=ownedIn(user,'cheapname',300,new Date(Date.now()-3600000).toISOString());
const expensive=ownedIn(user,'richname',9000,new Date().toISOString());
const digit=ownedIn(user,'digit77',1500,new Date().toISOString());
setShowcase(db,user,expensive);

test('collection supports price date length digits and showcase sorting/filtering',()=>{
  assert.equal(collection(db,user,{sort:'expensive'}).items[0].id,expensive);
  assert.equal(collection(db,user,{sort:'cheap'}).items[0].id,cheap);
  assert.equal(collection(db,user,{sort:'old'}).items[0].id,old);
  const short=collection(db,user,{sort:'short'}).items;
  assert.ok(short[0].rawHandle.length<=short.at(-1).rawHandle.length);
  assert.ok(collection(db,user,{digits:'with'}).items.every(x=>/\d/.test(x.rawHandle)));
  assert.ok(collection(db,user,{digits:'none'}).items.every(x=>!/\d/.test(x.rawHandle)));
  const only=collection(db,user,{showcase:'only'});assert.equal(only.items.length,1);assert.equal(only.items[0].id,expensive);
});
test('market sorting and digit filters work without rarity controls',()=>{
  const a=ownedIn(user,'marka',1000),b=ownedIn(user,'market88',2000),c=ownedIn(user,'longmarket',3000);
  createListing(db,user,a,900);createListing(db,user,b,300);createListing(db,user,c,1800);
  assert.equal(listMarket(db,{sort:'cheap'}).items[0].price,300);
  assert.equal(listMarket(db,{sort:'expensive'}).items[0].price,1800);
  assert.ok(listMarket(db,{digits:'with'}).items.every(x=>/\d/.test(x.rawHandle)));
  assert.ok(listMarket(db,{digits:'none'}).items.every(x=>!/\d/.test(x.rawHandle)));
});
test('friends data always produces a referral link when bot username is known',()=>{
  const f=friendsData(db,user,'username_test_bot');
  assert.equal(f.referralLink,'https://t.me/username_test_bot?start=ref_'+user.id);
  assert.match(f.shareText,/USERNAME/);
});
test('wheel reward weights total 100 and include unique username reward while available',()=>{
  const st=wheelStatus(db,buyer);assert.equal(st.rewards.reduce((s,x)=>s+x.weight,0),100);assert.ok(st.rewards.some(x=>x.type==='username'));
});
test('already-owned wheel usernames are excluded from the remaining pool',()=>{
  const before=wheelStatus(db,buyer).wheelUsernamesAvailable,handle=WHEEL_USERNAMES[0],now=new Date().toISOString();
  const tid=db.prepare("INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,'wheel',1,1,?)").run(handle,'RARE',5000,1,now).lastInsertRowid;
  db.prepare("INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type) VALUES(?,?,?,?,?,1,1,?,'owned',?,'wheel')").run('wheel-owned-test',tid,handle,'RARE',5000,user.id,now);
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run('wheel-owned-test',user.id,now);
  const after=wheelStatus(db,buyer).wheelUsernamesAvailable;
  assert.equal(after,before-1);
});
test('ordinary drop code excludes wheel/admin special categories',()=>assert.match(gameSrc,/category NOT IN \('wheel','admin'\)/));
test.after(()=>{db.close();fs.rmSync(tmp,{recursive:true,force:true})});
