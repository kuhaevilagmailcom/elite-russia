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
const indexSrc=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('CSP explicitly allows the official Hugeicons font CDN',()=>{
  assert.match(serverSrc,/style-src 'self' 'unsafe-inline' https:\/\/use\.hugeicons\.com/);
  assert.match(serverSrc,/font-src 'self' https:\/\/use\.hugeicons\.com data:/);
  assert.doesNotMatch(serverSrc,/unpkg\.com/);
  assert.match(indexSrc,/https:\/\/use\.hugeicons\.com\/font\/icons\.css/);
});
test('all interface icons use Hugeicons Stroke Rounded without runtime hydration',()=>{
  assert.match(indexSrc,/use\.hugeicons\.com\/font\/icons\.css/);
  assert.match(appSrc,/const ICON_NAME=Object\.freeze/);
  assert.match(appSrc,/hgi-stroke hgi-/);
  assert.match(appSrc,/home:'home-01'/);
  assert.match(appSrc,/market:'shopping-bag-01'/);
  assert.match(appSrc,/wheel:'circle-gauge'/);
  assert.match(appSrc,/collection:'grid-view'/);
  assert.match(appSrc,/profile:'user-circle-02'/);
  assert.match(appSrc,/filter:'filter'/);
  assert.doesNotMatch(appSrc,/data-lucide=|window\.lucide|lucideRetry/);
});
test('market and collection filters use Hugeicons too',()=>{
  assert.match(appSrc,/function marketFilterIcon\(\)\{return icon\('filter'\)\}/);
  assert.doesNotMatch(appSrc,/market-filter-svg|<path d=/);
});
test('navigation keeps the current screen visible while data loads',()=>{
  const loadFn=appSrc.match(/async function load\(page,\{force=false\}=\{\}\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.ok(loadFn);
  assert.match(appSrc,/const PAGE_CACHE_TTL=12000/);
  assert.match(appSrc,/function routeLoading\(on\)/);
  assert.match(loadFn,/routeLoading\(true\)/);
  assert.match(loadFn,/pageReady\(page\)/);
  assert.doesNotMatch(loadFn,/screen-skeleton/);
});
test('viewport and username fitting avoid repeated layout thrashing',()=>{
  assert.match(appSrc,/viewportFrame=requestAnimationFrame/);
  assert.match(appSrc,/if\(key===lastViewportKey\)return/);
  const fit=appSrc.match(/function fitUsername\(el,max=48,min=20\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(fit,/for\(let i=0;i<6/);
  assert.doesNotMatch(fit,/while\(size>min/);
});
test('menu opens without rebuilding the whole page',()=>{
  assert.match(appSrc,/function setMenuOpen\(open\)/);
  assert.match(appSrc,/menu\.classList\.toggle\('open'/);
  assert.match(appSrc,/hasAttribute\('data-menu-open'\)\)\{setMenuOpen\(true\)/);
});
test('home drop stays centered and fills spare space with useful shortcuts',()=>{
  const home=appSrc.match(/function homeView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(home,/Нажми на username/);
  assert.match(home,/home-shortcuts/);
  for(const page of ['collection','market','tasks','wheel'])assert.match(home,new RegExp("\\['"+page+"','"));
  assert.match(uxCss,/\.handle-stage\.drop-trigger\{[^}]*background:transparent/);
  assert.match(uxCss,/\.handle-stage\.drop-trigger b\{[^}]*text-align:center/);
  assert.match(uxCss,/\.home-shortcuts\{[^}]*grid-template-columns:repeat\(2/);
});
test('desktop rotation uses Web Animations with a double-RAF fallback',()=>{
  const fn=appSrc.match(/async function animateRotation\(el,degrees,duration,easing\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.ok(fn);
  assert.match(fn,/typeof el\.animate==='function'/);
  assert.match(fn,/animation\.finished/);
  assert.match(fn,/requestAnimationFrame\(\(\)=>requestAnimationFrame/);
  assert.match(appSrc,/await animateRotation\(rotor,wheelDegrees,3200/);
  assert.match(uxCss,/\.upgrade-wheel-rotor\{[^}]*transform-origin:50% 50%/);
});
test('upgrader keeps the final rotor position and round until continue',()=>{
  assert.match(appSrc,/upgradeLastRound:null/);
  assert.match(appSrc,/upgradeLandingAngle:0/);
  assert.match(appSrc,/state\.upgradeLastRound=\{source,target:result\.target/);
  assert.match(appSrc,/style="transform:rotate\('\+wheelAngle\+'deg\)"/);
  assert.match(appSrc,/upgrade-pointer-static/);
  assert.match(appSrc,/state\.upgradeLastRound=null;state\.upgradeLandingAngle=0;render\(\);return/);
});
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
  assert.doesNotMatch(home,/Нажми на username/);
});
test('drop animation is about two and a half seconds and lands on server result',()=>{
  const m=appSrc.match(/const reduced=.*?delays=reduced\?\[[^\]]+\]:\[([^\]]+)\]/);
  assert.ok(m);
  const total=m[1].split(',').map(Number).reduce((a,b)=>a+b,0);
  assert.ok(total>=2300&&total<=2600,total);
  const fn=appSrc.match(/async function animateDrop\(result\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(fn,/esc\(result\.handle\)/);
});
test('important UX uses click events and does not depend on touch-only handlers',()=>{
  assert.match(appSrc,/document\.addEventListener\('click'/);
  assert.doesNotMatch(appSrc,/touchstart|touchend/);
  assert.match(appSrc,/requestAnimationFrame/);
});
test('upgrader uses a probability circle with a real win sector',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/upgrade-roulette/);
  assert.match(view,/--chance-angle/);
  assert.doesNotMatch(view,/slot-viewport|slot-track/);
  assert.match(appSrc,/winArc/);
  assert.match(uxCss,/conic-gradient/);
  assert.match(uxCss,/\.upgrade-pointer-static/);
});
test('upgrader has one screen title and keeps the source step minimal',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  const row=appSrc.match(/function upgradeRowHtml\(x\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(appSrc,/page==='upgrader'\)shell\('Апгрейдер',upgraderView\(\)\)/);
  assert.match(view,/Выбери свой username/);
  assert.doesNotMatch(view,/>Апгрейдер</);
  assert.doesNotMatch(view,/Выбери до|от 1 до 5|максимум 5|5 usernames/i);
  assert.match(row,/upgrade-source-handle/);assert.match(row,/upgrade-source-price/);
  assert.doesNotMatch(row,/rarity|icon\(|chevron/i);
});
test('upgrader is single-item, compact and footer is sticky',()=>{
  assert.match(appSrc,/maxItems:1/);
  assert.match(appSrc,/state\.upgradeSelectedIds=\[id\]/);
  assert.match(uxCss,/\.upgrade-source-card\{[^}]*height:58px/);
  assert.match(uxCss,/\.upgrade-footer\{[^}]*position:sticky[^}]*bottom:0[^}]*height:68px/);
  assert.match(uxCss,/\.upgrade-footer button\{[^}]*height:50px/);
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
test('upgrader result keeps source and target prices in a compact matchup',()=>{
  const view=appSrc.match(/function upgraderView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/upgrade-match-side target/);
  assert.match(view,/target\?fmt\(target\.value\)/);
  assert.match(view,/chance/);
  assert.match(uxCss,/\.upgrade-matchup\{[^}]*min-height:78px/);
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
test('wheel is a true circle with preserved SVG aspect ratio and weighted sectors',()=>{
  assert.match(appSrc,/function wheelGeometry/);
  assert.match(appSrc,/start=cursor\/total\*360/);
  assert.match(appSrc,/function wheelSlicePath/);
  assert.match(appSrc,/function wheelSvgMarkup/);
  assert.match(appSrc,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(uxCss,/\.fortune-stage\{[^}]*width:min\(300px,calc\(100% - 32px\)\)[^}]*height:auto[^}]*aspect-ratio:1 \/ 1/);
  assert.match(uxCss,/\.fortune-pointer\{/);
  assert.match(uxCss,/\.fortune-hub\{/);
  assert.doesNotMatch(uxCss,/\.fortune-stage\{[^}]*height:var\(--fortune-size\)/);
});
test('wheel keeps tiny rewards out of the disc labels and uses a framed pointer layout',()=>{
  const view=appSrc.match(/function wheelView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/rare=g\.rows\.filter\(x=>x\.span<10\)/);
  assert.match(appSrc,/x\.span>=10\?\('<text/);
  assert.match(view,/wheelSvgMarkup\(g\.rows\)/);
  assert.match(view,/fortune-rim/);
  assert.match(view,/fortune-pointer/);
  assert.match(view,/РЕДКИЕ СЕКТОРЫ/);
});
test('wheel result persists locally and desktop animation lands inside the server-selected sector',()=>{
  assert.match(appSrc,/wheelLastResult:null/);
  assert.match(appSrc,/state\.wheelLastResult=r\.reward/);
  assert.match(appSrc,/target=g\.rows\.find\(x=>x\.key===r\.reward\.key\)/);
  assert.match(appSrc,/landing=target\.start\+margin/);
  assert.match(appSrc,/await animateRotation\(disc,final,3450/);
});
test('wheel disabled CTA is visually distinct',()=>{
  assert.match(uxCss,/\.wheel-page-clean \.wheel-spin-button:disabled\{[^}]*background:#e3e6e9[^}]*opacity:1/);
});

test('audited CSS keeps the cleaned 5.4 base plus one 6.0 product layer',()=>{
  assert.match(uxCss,/USERNAME 5\.4 — audited final UI/);
  assert.match(uxCss,/USERNAME 6\.0 — progression, valuation colors and Username Lab/);
  for(const old of ['USERNAME 4.7','USERNAME 4.8','USERNAME 4.9','USERNAME 5.0','USERNAME 5.1','USERNAME 5.2','USERNAME 5.3'])assert.doesNotMatch(uxCss,new RegExp(old.replace('.', '\\.')));
  assert.ok((uxCss.match(/!important/g)||[]).length<=10);
});
test('upgrader source rows stay aligned without fixed desktop-only price columns',()=>{
  const row=appSrc.match(/function upgradeRowHtml\(x\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(uxCss,/\.upgrade-source-card\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(uxCss,/\.upgrade-source-price\{[^}]*max-width:132px[^}]*white-space:nowrap/);
  assert.doesNotMatch(row,/data-fit-username/);
});

test('home exposes level progress luck daily income and the skill-based Username Lab',()=>{
  const home=appSrc.match(/function homeView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(home,/home-progress-card/);
  assert.match(home,/xpBar\(u\)/);
  assert.match(home,/Удача после неудач/);
  assert.match(home,/data-daily-claim/);
  assert.match(home,/home-lab-banner/);
  assert.match(home,/data-page="lab"/);
});
test('Username Lab is a first-class cached page with server submission',()=>{
  assert.match(appSrc,/function labView\(\)/);
  assert.match(appSrc,/Минимум в игре — 4 символа/);
  assert.match(appSrc,/\/api\/lab/);
  assert.match(appSrc,/data-lab-submit/);
  assert.match(appSrc,/page==='lab'/);
  assert.match(uxCss,/\.lab-page\{/);
  assert.match(uxCss,/\.lab-result\.value-purple/);
});
test('valuable usernames use blue purple and gold visual language without backend rarity labels',()=>{
  assert.match(uxCss,/--value-purple:#8B5CF6/);
  assert.match(uxCss,/--value-gold:#F4B740/);
  assert.match(uxCss,/\.value-purple\{/);
  assert.match(uxCss,/\.value-gold\{/);
  const collection=appSrc.match(/function collectionView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(collection,/valueClass\(x\)/);
  for(const r of ['COMMON','RARE','EPIC','LEGEND','ULTRA'])assert.doesNotMatch(collection,new RegExp(r));
});
test('profile shows title XP luck earnings best drop and Lab score',()=>{
  const view=appSrc.match(/function profileView\([\s\S]*?\n\}/)?.[0]||'';
  assert.match(view,/xpBar\(p\)/);
  assert.match(view,/p\.title/);
  assert.match(view,/p\.luck/);
  assert.match(view,/p\.totalEarned/);
  assert.match(view,/p\.bestDropValue/);
  assert.match(view,/p\.lab\?\.bestScore/);
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
  assert.match(uxCss,/@media\(min-width:560px\)/);
  assert.match(adminCss,/admin-search button/);
});
test('task claim updates locally without reloading the whole tasks screen',()=>{
  const handler=appSrc.match(/if\(el\.dataset\.claim\)\{[\s\S]*?render\(\);return\n \}/)?.[0]||'';
  assert.ok(handler);
  assert.match(handler,/task\.claimed=true/);
  assert.match(handler,/applyUserLocal\(r\.user\)/);
  assert.doesNotMatch(handler,/refreshUser\(|load\('tasks'\)/);
  assert.match(uxCss,/\.task-claim\.is-claiming/);
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
