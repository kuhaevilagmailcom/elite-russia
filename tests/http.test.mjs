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
    env:{...process.env,PORT:String(port),NODE_ENV:'test',ALLOW_DEV_AUTH:'1',DEV_ADMIN:'1',ADMIN_IDS:'',BOT_TOKEN:'',DATA_DIR:tmp,WEBAPP_URL:'https://username.example'},
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

test('HTTP admin block immediately blocks target API access',async()=>{
  await json('/api/home',{headers:headers('30002')});
  const overview=await json('/api/admin/overview',{headers:headers('10001')});
  const target=overview.body.usersList.find(x=>String(x.telegram_id)==='30002');assert.ok(target);
  const admin=await json('/api/admin/users/'+target.id+'/block',{method:'POST',headers:headers('10001'),body:JSON.stringify({value:true})});assert.equal(admin.r.status,200);
  const blocked=await json('/api/home',{headers:headers('30002')});assert.equal(blocked.r.status,403);assert.equal(blocked.body.error,'blocked');
});

test('HTTP premium invoice is unavailable without bot token',async()=>{
  await json('/api/home',{headers:headers('30003')});
  const p=await json('/api/premium/invoice',{method:'POST',headers:headers('30003'),body:'{}'});assert.equal(p.r.status,503);assert.equal(p.body.error,'premium_unavailable');
});
