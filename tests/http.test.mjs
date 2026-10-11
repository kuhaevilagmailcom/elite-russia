import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'username-http-'));
const port=18765;
const base='http://127.0.0.1:'+port;
let child;

async function waitForServer(){
  const end=Date.now()+15000;
  while(Date.now()<end){
    try{const r=await fetch(base+'/healthz');if(r.ok)return}catch{}
    await new Promise(r=>setTimeout(r,150));
  }
  throw new Error('server_start_timeout');
}
function headers(user='30001'){return {'Content-Type':'application/json','X-Dev-User':user}}
async function json(pathname,opts={}){
  const r=await fetch(base+pathname,opts);const body=await r.json().catch(()=>({}));return {r,body};
}

test.before(async()=>{
  child=spawn(process.execPath,['server.mjs'],{
    cwd:process.cwd(),
    env:{...process.env,PORT:String(port),NODE_ENV:'test',ALLOW_DEV_AUTH:'1',DEV_ADMIN:'1',ADMIN_IDS:'',BOT_TOKEN:'',BOT_USERNAME:'test_username_bot',DATA_DIR:tmp,WEBAPP_URL:'https://username.example'},
    stdio:['ignore','pipe','pipe']
  });
  await waitForServer();
});
test.after(async()=>{
  child?.kill('SIGTERM');
  await new Promise(r=>setTimeout(r,150));
  fs.rmSync(tmp,{recursive:true,force:true});
});

test('HTTP auth rejects request without Telegram/dev identity',async()=>{
  const {r,body}=await json('/api/home');assert.equal(r.status,401);assert.equal(body.error,'unauthorized');
});

test('HTTP home and drop work through the real server',async()=>{
  const home=await json('/api/home',{headers:headers()});assert.equal(home.r.status,200);assert.equal(home.body.user.telegramId,'30001');
  const drop=await json('/api/drop',{method:'POST',headers:headers(),body:JSON.stringify({requestId:'http-drop-1',tier:'basic'})});
  assert.equal(drop.r.status,200);assert.ok(drop.body.instance.id);assert.ok(drop.body.instance.handle.startsWith('@'));
  const replay=await json('/api/drop',{method:'POST',headers:headers(),body:JSON.stringify({requestId:'http-drop-1',tier:'basic'})});
  assert.equal(replay.r.status,200);assert.equal(replay.body.instance.id,drop.body.instance.id);
});

test('100K drop can be retried immediately after an unsuccessful first attempt',async()=>{
  const player='39990',init=await json('/api/home',{headers:headers(player)});
  assert.equal(init.r.status,200);
  const fail=await json('/api/drop',{method:'POST',headers:headers(player),
    body:JSON.stringify({requestId:'max-failed-initially',tier:'max'})});
  assert.equal(fail.r.status,409);
  assert.equal(fail.body.error,'insufficient_funds');
  const conn=new Database(path.join(tmp,'username.sqlite'));
  try{conn.prepare('UPDATE users SET balance=250000 WHERE telegram_id=?').run(player)}
  finally{conn.close()}
  const good=await json('/api/drop',{method:'POST',headers:headers(player),
    body:JSON.stringify({requestId:'max-retry-immediately',tier:'max'})});
  assert.equal(good.r.status,200,JSON.stringify(good.body));
  assert.equal(good.body.cost,100000);
  const replay=await json('/api/drop',{method:'POST',headers:headers(player),
    body:JSON.stringify({requestId:'max-retry-immediately',tier:'max'})});
  assert.equal(replay.r.status,200);
  assert.equal(replay.body.instance.id,good.body.instance.id);
});

test('HTTP Crash has one public round and idempotent bet and cashout across clients',async()=>{
  const uid='34501',other='34502',admin='10001';
  const home=await json('/api/home',{headers:headers(uid)});
  assert.equal(home.r.status,200);
  const add=await json('/api/admin/users/'+home.body.user.id+'/add-username',{
    method:'POST',headers:headers(admin),
    body:JSON.stringify({handle:'crash_http_777',value:6000})
  });
  assert.equal(add.r.status,200,JSON.stringify(add.body));
  const conn=new Database(path.join(tmp,'username.sqlite'));
  let instanceId;
  try{
    instanceId=conn.prepare("SELECT id FROM username_instances WHERE owner_id=? AND handle='crash_http_777'").get(home.body.user.id)?.id;
    assert.ok(instanceId);
    // Make a deterministic waiting round for the integration scenario.
    const current=conn.prepare("SELECT id FROM crash_rounds WHERE status IN ('waiting','running') ORDER BY id DESC LIMIT 1").get();
    assert.ok(current);
    conn.prepare("UPDATE crash_rounds SET status='waiting',starts_at=?,crashes_at=?,crash_x=1000 WHERE id=?")
      .run(Date.now()+10000,Date.now()+75000,current.id);
  }finally{conn.close()}
  const a=await json('/api/crash',{headers:headers(uid)});
  const b=await json('/api/crash',{headers:headers(other)});
  assert.equal(a.r.status,200);assert.equal(a.body.round.id,b.body.round.id);
  assert.equal(a.body.round.status,'waiting');
  assert.equal(a.body.round.crash_x,undefined);
  assert.equal(a.body.round.seed,undefined);
  assert.ok(a.body.available.some(x=>x.id===instanceId));
  const roundId=a.body.round.id;
  const bet=await json('/api/crash/bet',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId,instanceId})});
  assert.equal(bet.r.status,200,JSON.stringify(bet.body));
  const again=await json('/api/crash/bet',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId,instanceId})});
  assert.equal(again.r.status,200);
  assert.equal(again.body.replayed,true);
  const stale=await json('/api/crash/bet',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId:roundId-1,instanceId})});
  assert.equal(stale.r.status,409);
  assert.equal(stale.body.error,'crash_round_changed');
  const spectator=await json('/api/crash',{headers:headers(other)});
  assert.ok(spectator.body.bets.some(x=>x.handle==='@crash_http_777'));
  const myPreview=await json('/api/crash',{headers:headers(uid)});
  assert.equal(myPreview.body.myRewardPlan.length,35);
  assert.ok(myPreview.body.myRewardPlan.every(x=>x.handle.startsWith('@')));

  const db=new Database(path.join(tmp,'username.sqlite'));
  try{
    db.prepare("UPDATE crash_rounds SET status='running',starts_at=?,crashes_at=?,crash_x=1000 WHERE id=?")
      .run(Date.now()-7000,Date.now()+75000,roundId);
  }finally{db.close()}
  const cash=await json('/api/crash/cashout',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId})});
  assert.equal(cash.r.status,200,JSON.stringify(cash.body));
  assert.ok(cash.body.multiplier>1);
  assert.ok(cash.body.reward.value>6000);
  assert.ok(cash.body.reward.handle.startsWith('@'));
  assert.notEqual(cash.body.reward.handle,'@crash_http_777');
  assert.equal(cash.body.reward.value,Math.floor(6000*cash.body.multiplier));
  const second=await json('/api/crash/cashout',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId})});
  assert.equal(second.r.status,200);
  assert.equal(second.body.replayed,true);
  assert.equal(second.body.reward.id,cash.body.reward.id);
  const db2=new Database(path.join(tmp,'username.sqlite'));
  try{
    assert.equal(db2.prepare('SELECT COUNT(*) n FROM balance_transactions WHERE user_id=? AND type=?').get(home.body.user.id,'crash_win').n,0);
    assert.equal(db2.prepare('SELECT status FROM username_instances WHERE id=?').get(instanceId).status,'crash_exchanged');
    const reward=db2.prepare('SELECT * FROM username_instances WHERE id=?').get(cash.body.reward.id);
    assert.equal(reward.owner_id,home.body.user.id);
    assert.equal(reward.obtained_type,'crash');
    assert.equal(reward.status,'owned');
    assert.equal(reward.handle,cash.body.reward.handle.slice(1));
    assert.equal(db2.prepare('SELECT COUNT(*) n FROM crash_wins WHERE instance_id=?').get(reward.id).n,1);
    db2.prepare('UPDATE crash_rounds SET crashes_at=? WHERE id=?').run(Date.now()-2,roundId);
  }finally{db2.close()}
  // Even after rollover, replay must not mint a second reward.
  const after=await json('/api/crash/cashout',{method:'POST',headers:headers(uid),body:JSON.stringify({roundId})});
  assert.equal(after.r.status,200);
  assert.equal(after.body.replayed,true);
  assert.equal(after.body.reward.id,cash.body.reward.id);
});

test('HTTP story endpoint returns a public same-origin media path and JPEG without auth',async()=>{
  const home=await json('/api/home',{headers:headers()});const id=home.body.pending?.id;assert.ok(id);
  const bytes=Buffer.alloc(1200,1);bytes[0]=0xff;bytes[1]=0xd8;
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  const story=await json('/api/story-share',{method:'POST',headers:headers(),body:JSON.stringify({instanceId:id,dataUrl})});
  assert.equal(story.r.status,200);
  assert.match(story.body.mediaPath,/^\/story\/[a-f0-9]{36}\.jpg$/);
  assert.match(story.body.mediaUrl,/^https:\/\/username\.example\/story\/[a-f0-9]{36}\.jpg$/);
  const media=await fetch(base+story.body.mediaPath);
  assert.equal(media.status,200);assert.match(media.headers.get('content-type')||'',/^image\/jpeg/);
  const body=Buffer.from(await media.arrayBuffer());assert.equal(body[0],0xff);assert.equal(body[1],0xd8);
});

test('HTTP market flow works and leaderboard returns unified capital',async()=>{
  const seller='30100',buyer='30101';
  await json('/api/home',{headers:headers(seller)});
  const drop=await json('/api/drop',{method:'POST',headers:headers(seller),body:JSON.stringify({requestId:'market-http-drop',tier:'basic'})});
  assert.equal(drop.r.status,200);
  const keep=await json('/api/drop/'+drop.body.instance.id+'/resolve',{method:'POST',headers:headers(seller),body:JSON.stringify({action:'keep'})});
  assert.equal(keep.r.status,200);
  const listing=await json('/api/market',{method:'POST',headers:headers(seller),body:JSON.stringify({instanceId:drop.body.instance.id,price:500})});
  assert.equal(listing.r.status,200);assert.ok(listing.body.id);
  await json('/api/home',{headers:headers(buyer)});
  const buy=await json('/api/market/'+listing.body.id+'/buy',{method:'POST',headers:headers(buyer),body:'{}'});
  assert.equal(buy.r.status,200);
  const board=await json('/api/leaderboard',{headers:headers(buyer)});
  assert.equal(board.r.status,200);assert.ok(Array.isArray(board.body.items));assert.ok(board.body.items.length>=2);
  for(let i=0;i<board.body.items.length;i++){
    const row=board.body.items[i];assert.equal(row.capital,Number(row.balance)+Number(row.username_value));
    if(i>0)assert.ok(board.body.items[i-1].capital>=row.capital);
  }
});

test('running server database enforces global unique username index',async()=>{
  const check=new Database(path.join(tmp,'username.sqlite'),{readonly:true,fileMustExist:true});
  try{
    const indexes=check.prepare("PRAGMA index_list('username_instances')").all();
    assert.ok(indexes.some(x=>x.name==='idx_instances_handle_unique'&&Number(x.unique)===1));
    const dup=check.prepare('SELECT handle,COUNT(*) c FROM username_instances GROUP BY handle HAVING c>1 LIMIT 1').get();
    assert.equal(dup,undefined);
    assert.equal(String(check.pragma('integrity_check',{simple:true})).toLowerCase(),'ok');
  }finally{check.close()}
});

test('HTTP collection and market support the new non-rarity filters',async()=>{
  const uid='30200';await json('/api/home',{headers:headers(uid)});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});
  const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  for(const [handle,value] of [['fltcheap',1000],['fltrich',9000],['flt77',3000]]){
    const add=await json('/api/admin/users/'+target.id+'/add-username',{method:'POST',headers:headers('10001'),body:JSON.stringify({handle,value})});assert.equal(add.r.status,200);
  }
  const expensive=await json('/api/collection?sort=expensive&digits=all&showcase=all&page=1',{headers:headers(uid)});
  assert.equal(expensive.r.status,200);assert.ok(expensive.body.items[0].value>=expensive.body.items.at(-1).value);
  const digits=await json('/api/collection?sort=new&digits=with&showcase=all&page=1',{headers:headers(uid)});
  assert.equal(digits.r.status,200);assert.ok(digits.body.items.every(x=>/\d/.test(x.rawHandle)));
  const cheapItem=expensive.body.items.find(x=>x.rawHandle==='fltcheap'),richItem=expensive.body.items.find(x=>x.rawHandle==='fltrich');
  const l1=await json('/api/market',{method:'POST',headers:headers(uid),body:JSON.stringify({instanceId:cheapItem.id,price:500})});
  const l2=await json('/api/market',{method:'POST',headers:headers(uid),body:JSON.stringify({instanceId:richItem.id,price:5000})});
  assert.equal(l1.r.status,200);assert.equal(l2.r.status,200);
  const market=await json('/api/market?sort=cheap&digits=none&page=1',{headers:headers(uid)});
  assert.equal(market.r.status,200);assert.ok(market.body.items[0].price<=market.body.items.at(-1).price);assert.ok(market.body.items.every(x=>!/\d/.test(x.rawHandle)));
});

test('HTTP friends returns a usable referral link and share copy when bot username is configured',async()=>{
  const f=await json('/api/friends',{headers:headers('30200')});assert.equal(f.r.status,200);
  assert.match(f.body.referralLink,/^https:\/\/t\.me\/test_username_bot\?start=ref_\d+$/);assert.match(f.body.shareText,/USERNAME/);
});

test('HTTP wheel is free, weighted to 100 and idempotent',async()=>{
  const uid='30201';await json('/api/home',{headers:headers(uid)});
  const status=await json('/api/wheel',{headers:headers(uid)});assert.equal(status.r.status,200);assert.equal(status.body.rewards.reduce((s,x)=>s+x.weight,0),100);
  const a=await json('/api/wheel',{method:'POST',headers:headers(uid),body:JSON.stringify({requestId:'http-wheel'})});assert.equal(a.r.status,200);
  const b=await json('/api/wheel',{method:'POST',headers:headers(uid),body:JSON.stringify({requestId:'http-wheel'})});assert.equal(b.r.status,200);assert.equal(a.body.reward.key,b.body.reward.key);
});

test('HTTP upgrader preview and spin work without touch APIs or Telegram-only events',async()=>{
  const uid='30202';await json('/api/home',{headers:headers(uid)});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  const add=await json('/api/admin/users/'+target.id+'/add-username',{method:'POST',headers:headers('10001'),body:JSON.stringify({handle:'uphttpname',value:1000})});assert.equal(add.r.status,200);
  const info=await json('/api/upgrader',{headers:headers(uid)});assert.equal(info.r.status,200);assert.ok(info.body.available.length);
  const id=info.body.available[0].id,preview=await json('/api/upgrader/preview',{method:'POST',headers:headers(uid),body:JSON.stringify({ids:[id]})});assert.equal(preview.r.status,200);assert.ok(preview.body.sessionId);
  const spin=await json('/api/upgrader',{method:'POST',headers:headers(uid),body:JSON.stringify({ids:[id],sessionId:preview.body.sessionId})});assert.equal(spin.r.status,200);assert.equal(typeof spin.body.success,'boolean');
});

test('fixed admin IDs are authorized and ordinary users are denied',async()=>{
  await json('/api/home',{headers:headers('8464597898')});
  const ok=await json('/api/admin/overview',{headers:headers('8464597898')});assert.equal(ok.r.status,200);
  const denied=await json('/api/admin/overview',{headers:headers('30200')});assert.equal(denied.r.status,403);assert.equal(denied.body.error,'forbidden');
});

test('HTTP single-user reset restores gameplay defaults without deleting account',async()=>{
  const uid='30203';const home=await json('/api/home',{headers:headers(uid)});assert.equal(home.r.status,200);
  const overview=await json('/api/admin/overview',{headers:headers('8464597898')});const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  await json('/api/admin/users/'+target.id+'/add-username',{method:'POST',headers:headers('8464597898'),body:JSON.stringify({handle:'resetone',value:7000})});
  await json('/api/admin/users/'+target.id+'/balance',{method:'POST',headers:headers('8464597898'),body:JSON.stringify({delta:12000})});
  const reset=await json('/api/admin/users/'+target.id+'/reset',{method:'POST',headers:headers('8464597898'),body:'{}'});assert.equal(reset.r.status,200);
  const after=await json('/api/home',{headers:headers(uid)});assert.equal(after.r.status,200);assert.equal(after.body.user.balance,50000);assert.equal(after.body.user.freeDrops,1);assert.equal(after.body.user.collectionCount,0);
});

test('HTTP admin block immediately blocks target API access',async()=>{
  await json('/api/home',{headers:headers('30002')});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});
  const target=overview.body.users.find(x=>String(x.telegram_id)==='30002');assert.ok(target);
  const admin=await json('/api/admin/users/'+target.id+'/block',{method:'POST',headers:headers('10001'),body:JSON.stringify({value:true})});assert.equal(admin.r.status,200);
  const blocked=await json('/api/home',{headers:headers('30002')});assert.equal(blocked.r.status,403);assert.equal(blocked.body.error,'blocked');
});

test('HTTP notification can be marked read individually',async()=>{
  const uid='30410';await json('/api/home',{headers:headers(uid)});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});
  const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  const sent=await json('/api/admin/users/'+target.id+'/message',{method:'POST',headers:headers('10001'),body:JSON.stringify({text:'Проверка уведомления'})});
  assert.equal(sent.r.status,200);
  const before=await json('/api/notifications',{headers:headers(uid)});assert.equal(before.r.status,200);
  const item=before.body.items.find(x=>x.type==='ADMIN_MESSAGE'&&!x.read);assert.ok(item);assert.ok(before.body.unread>=1);
  const read=await json('/api/notifications/'+encodeURIComponent(item.id)+'/read',{method:'POST',headers:headers(uid),body:'{}'});
  assert.equal(read.r.status,200);
  const after=await json('/api/notifications',{headers:headers(uid)});
  assert.equal(after.body.items.find(x=>x.id===item.id).read,true);
});

test('HTTP admin can grant crystals and create a gems-only promo code',async()=>{
  const uid='30411';await json('/api/home',{headers:headers(uid)});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});
  const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  const gems=await json('/api/admin/users/'+target.id+'/gems',{method:'POST',headers:headers('10001'),body:JSON.stringify({delta:600})});
  assert.equal(gems.r.status,200);assert.equal(gems.body.wallet.gems,600);
  const detail=await json('/api/admin/users/'+target.id,{headers:headers('10001')});assert.equal(detail.body.user.gems,600);
  const code='PROMO740TEST';
  const created=await json('/api/admin/promocodes',{method:'POST',headers:headers('10001'),body:JSON.stringify({code,rewardType:'gems',rewardAmount:250,maxUses:2})});
  assert.equal(created.r.status,200);assert.equal(created.body.code,code);
  const redeemed=await json('/api/promocode',{method:'POST',headers:headers(uid),body:JSON.stringify({code})});
  assert.equal(redeemed.r.status,200);assert.equal(redeemed.body.rewardType,'gems');assert.equal(redeemed.body.wallet.gems,850);
  const again=await json('/api/promocode',{method:'POST',headers:headers(uid),body:JSON.stringify({code})});
  assert.equal(again.r.status,409);assert.equal(again.body.error,'promo_used');
  const list=await json('/api/admin/promocodes',{headers:headers('10001')});assert.equal(list.r.status,200);assert.ok(list.body.items.some(x=>x.code===code));
});

test('HTTP gem invoice is unavailable without bot token',async()=>{
  await json('/api/home',{headers:headers('30003')});
  const p=await json('/api/shop/invoice',{method:'POST',headers:headers('30003'),body:JSON.stringify({productKey:'gems_500'})});
  assert.equal(p.r.status,503);assert.equal(p.body.error,'premium_unavailable');
});

test('HTTP full reset requires exact confirmation, makes backup, frees usernames and preserves financial/schema records',async()=>{
  const uid='30300';await json('/api/home',{headers:headers(uid)});
  const overview=await json('/api/admin/overview',{headers:headers('8464597898')});const target=overview.body.users.find(x=>String(x.telegram_id)===uid);assert.ok(target);
  const added=await json('/api/admin/users/'+target.id+'/add-username',{method:'POST',headers:headers('8464597898'),body:JSON.stringify({handle:'resetallx',value:12000})});assert.equal(added.r.status,200);
  const direct=new Database(path.join(tmp,'username.sqlite'));direct.pragma('busy_timeout = 3000');
  const migrationsBefore=direct.prepare('SELECT COUNT(*) c FROM schema_migrations').get().c;
  const premiumUntil=new Date(Date.now()+15*86400000).toISOString();
  direct.prepare('UPDATE users SET premium_until=? WHERE id=?').run(premiumUntil,target.id);
  direct.prepare("INSERT OR IGNORE INTO payments(telegram_charge_id,provider_charge_id,user_id,payload,currency,total_amount,product,created_at) VALUES('reset-charge','provider',?,'audit','XTR',50,'USERNAME_PLUS_30D',?)").run(target.id,new Date().toISOString());
  direct.close();
  const bad=await json('/api/admin/reset-all',{method:'POST',headers:headers('8464597898'),body:JSON.stringify({confirmation:'WRONG'})});assert.equal(bad.r.status,400);
  const good=await json('/api/admin/reset-all',{method:'POST',headers:headers('8464597898'),body:JSON.stringify({confirmation:'RESET USERNAME'})});assert.equal(good.r.status,200);assert.equal(String(good.body.integrity).toLowerCase(),'ok');
  const check=new Database(path.join(tmp,'username.sqlite'),{readonly:true,fileMustExist:true});
  try{
    assert.equal(check.prepare('SELECT COUNT(*) c FROM username_instances').get().c,0);
    assert.equal(check.prepare('SELECT COUNT(*) c FROM market_listings').get().c,0);
    assert.equal(check.prepare('SELECT COALESCE(SUM(current_supply),0) s FROM username_templates').get().s,0);
    assert.equal(check.prepare("SELECT COUNT(*) c FROM payments WHERE telegram_charge_id='reset-charge'").get().c,1);
    assert.equal(check.prepare('SELECT COUNT(*) c FROM schema_migrations').get().c,migrationsBefore);
    const u=check.prepare('SELECT balance,free_drops,premium_until FROM users WHERE id=?').get(target.id);assert.equal(u.balance,50000);assert.equal(u.free_drops,1);assert.equal(u.premium_until,premiumUntil);
    assert.equal(String(check.pragma('integrity_check',{simple:true})).toLowerCase(),'ok');
    assert.ok(check.prepare("SELECT COUNT(*) c FROM admin_audit WHERE action='reset_all'").get().c>=1);
  }finally{check.close()}
  const backups=fs.readdirSync(path.join(tmp,'backups')).filter(x=>x.startsWith('pre-full-reset-')&&x.endsWith('.sqlite'));assert.ok(backups.length>=1);
});
