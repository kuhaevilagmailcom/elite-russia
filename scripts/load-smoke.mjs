import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const concurrency=Math.max(1,Number(process.argv[2]||100));
const port=Number(process.env.LOAD_PORT||18887);
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'username-load-'));
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test',ALLOW_DEV_AUTH:'1',DEV_ADMIN:'0',ADMIN_IDS:'',BOT_TOKEN:'',DATA_DIR:dataDir,WEBAPP_URL:'https://load.example'},stdio:['ignore','ignore','pipe']});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){try{if((await fetch(base+'/healthz')).ok)break}catch{}await wait(100)}
  if(Date.now()>=deadline)throw new Error('server_start_timeout');
  const started=performance.now();
  const results=await Promise.all(Array.from({length:concurrency},async(_,i)=>{
    const t=performance.now();
    const r=await fetch(base+'/api/home',{headers:{'X-Dev-User':String(900000+i)}});
    const body=await r.json().catch(()=>({}));
    return {status:r.status,ms:performance.now()-t,error:body.error||null};
  }));
  const times=results.map(x=>x.ms).sort((a,b)=>a-b),p=(q)=>times[Math.min(times.length-1,Math.floor(times.length*q))];
  const failed=results.filter(x=>x.status!==200);
  const report={concurrency,totalMs:Number((performance.now()-started).toFixed(1)),ok:results.length-failed.length,failed:failed.length,p50:Number(p(.50).toFixed(1)),p95:Number(p(.95).toFixed(1)),p99:Number(p(.99).toFixed(1)),max:Number(times.at(-1).toFixed(1)),errors:[...new Set(failed.map(x=>`${x.status}:${x.error||'unknown'}`))]};
  console.log(JSON.stringify(report));
  if(failed.length)process.exitCode=1;
}finally{
  child.kill('SIGTERM');
  await wait(150);
  fs.rmSync(dataDir,{recursive:true,force:true});
}
