import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

test('HTTP story endpoint returns a public HTTPS media URL',async()=>{
  const home=await json('/api/home',{headers:headers()});const id=home.body.pending?.id;assert.ok(id);
  const bytes=Buffer.alloc(1200,1);bytes[0]=0xff;bytes[1]=0xd8;
  const dataUrl='data:image/jpeg;base64,'+bytes.toString('base64');
  const story=await json('/api/story-share',{method:'POST',headers:headers(),body:JSON.stringify({instanceId:id,dataUrl})});
  assert.equal(story.r.status,200);assert.match(story.body.mediaUrl,/^https:\/\/username\.example\/story\/[a-f0-9]{36}\.jpg$/);
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
