import crypto from 'node:crypto';
import {ROOTS,buildGeneratedHandle,isValidHandle} from './generator.mjs';
import {analyzeUsername,normalizeUsername,isGameUsername} from './valuation.mjs';
import {todayKey,txBalance,bumpTask,nowIso} from './economy.mjs';
import {grantXp} from './progression.mjs';

export const MINI_GAME_DAILY_CAP=100000;
export const MINI_GAMES=Object.freeze([
  {key:'hunt',title:'Username Hunt',icon:'search-visual',bestLabel:'Серия'},
  {key:'higher',title:'Выше / ниже',icon:'chart-up',bestLabel:'Верных'},
  {key:'editor',title:'Редактор',icon:'edit-02',bestLabel:'Прирост'},
  {key:'build',title:'Собери username',icon:'puzzle',bestLabel:'Цена'},
  {key:'price',title:'Угадай цену',icon:'money-bag-02',bestLabel:'Верных'}
]);

const SESSION_TTL_MS=10*60*1000;
const QUESTION_COUNT=5;
const PRICE_BANDS=[
  {key:'under3',label:'до 3K ₽',min:0,max:2999},
  {key:'3to10',label:'3K–10K ₽',min:3000,max:9999},
  {key:'10to50',label:'10K–50K ₽',min:10000,max:49999},
  {key:'50plus',label:'50K+ ₽',min:50000,max:Number.MAX_SAFE_INTEGER}
];

function ensureSchema(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS mini_game_sessions(
      id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,game_key TEXT NOT NULL,payload_json TEXT NOT NULL,state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,expires_at TEXT NOT NULL,finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS mini_game_records(
      id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,game_key TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,
      reward INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 0,metadata TEXT,created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mini_game_daily_earnings(
      user_id INTEGER NOT NULL,earning_date TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,plays INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id,earning_date)
    );
    CREATE INDEX IF NOT EXISTS idx_minigame_records_user ON mini_game_records(user_id,game_key,created_at);
    CREATE INDEX IF NOT EXISTS idx_minigame_sessions_user ON mini_game_sessions(user_id,game_key,expires_at);
  `);
}
function pick(arr){return arr[crypto.randomInt(0,arr.length)]}
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(0,i+1);[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function uniqueCandidates(count,{min=0,max=Number.MAX_SAFE_INTEGER}={}){
  const out=[],used=new Set();
  for(let tries=0;tries<1400&&out.length<count;tries++){
    const profile=tries%8===0?'RARE':tries%13===0?'EPIC':'COMMON';
    let h=buildGeneratedHandle(profile);
    if(!isValidHandle(h)||used.has(h))continue;
    const a=analyzeUsername(h);
    if(a.value<min||a.value>max)continue;
    used.add(h);out.push({handle:'@'+h,value:a.value,visual:a.visual});
  }
  const fallback=shuffle(ROOTS).map(x=>normalizeUsername(x)).filter(x=>isGameUsername(x)).slice(0,count*4);
  for(const h of fallback){
    if(out.length>=count)break;if(used.has(h))continue;
    const a=analyzeUsername(h);if(a.value<min||a.value>max)continue;
    used.add(h);out.push({handle:'@'+h,value:a.value,visual:a.visual});
  }
  if(out.length<count)throw new Error('game_unavailable');
  return out;
}
function priceBand(value){return PRICE_BANDS.find(x=>value>=x.min&&value<=x.max)?.key||'50plus'}
function makeHunt(){
  return Array.from({length:QUESTION_COUNT},()=> {
    const options=uniqueCandidates(6);
    const best=options.reduce((a,b)=>b.value>a.value?b:a,options[0]);
    return {options,answer:best.handle};
  });
}
function makeHigher(){
  return Array.from({length:QUESTION_COUNT},()=> {
    let pair=uniqueCandidates(2);
    for(let i=0;i<8&&Math.abs(pair[0].value-pair[1].value)<1000;i++)pair=uniqueCandidates(2);
    return {left:pair[0],right:pair[1],answer:pair[1].value>pair[0].value?'higher':'lower'};
  });
}
const EDITOR_SOURCES=['gh0st_771','real_vlad77','turbo_77','m0ney_123','kot_23','venom_77','dima_777','ghost_01'];
function makeEditor(){
  const source=pick(EDITOR_SOURCES),a=analyzeUsername(source);
  return [{source:'@'+source,sourceValue:a.value}];
}
const BUILD_SETS=[
  ['tur','bo','x','77','_','pro'],['ve','nom','77','x','_','pro'],['mo','ney','77','_','real'],['gh','ost','77','x','_'],['vl','ad','77','_','real']
];
function makeBuild(){return [{parts:shuffle(pick(BUILD_SETS))}]}
function makePrice(){
  return Array.from({length:QUESTION_COUNT},()=> {
    const item=uniqueCandidates(1)[0];
    return {item,answer:priceBand(item.value)};
  });
}
function questionsFor(key){
  if(key==='hunt')return makeHunt();
  if(key==='higher')return makeHigher();
  if(key==='editor')return makeEditor();
  if(key==='build')return makeBuild();
  if(key==='price')return makePrice();
  throw new Error('bad_game');
}
function safeState(row){try{return JSON.parse(row.state_json||'{}')}catch{return {index:0,score:0,streak:0,reward:0,xp:0}}}
function safePayload(row){try{return JSON.parse(row.payload_json||'[]')}catch{return []}}
function currentQuestion(row){
  const state=safeState(row),payload=safePayload(row),q=payload[state.index];
  if(!q)return null;
  if(row.game_key==='hunt')return {options:q.options.map(x=>({handle:x.handle,visual:x.visual}))};
  if(row.game_key==='higher')return {left:q.left,right:{handle:q.right.handle,visual:q.right.visual}};
  if(row.game_key==='editor')return {source:q.source,sourceValue:q.sourceValue};
  if(row.game_key==='build')return {parts:q.parts};
  if(row.game_key==='price')return {item:{handle:q.item.handle,visual:q.item.visual},bands:PRICE_BANDS.map(({key,label})=>({key,label}))};
  return null;
}
function sessionView(row){
  const s=safeState(row),done=!!row.finished_at||!currentQuestion(row);
  return {id:row.id,gameKey:row.game_key,index:s.index,total:s.total||safePayload(row).length,score:s.score||0,streak:s.streak||0,reward:s.reward||0,xp:s.xp||0,done,question:done?null:currentQuestion(row)};
}
function dailyRow(db,userId){
  ensureSchema(db);
  return db.prepare('SELECT * FROM mini_game_daily_earnings WHERE user_id=? AND earning_date=?').get(userId,todayKey())||{amount:0,plays:0};
}
function remainingCap(db,userId){return Math.max(0,MINI_GAME_DAILY_CAP-Number(dailyRow(db,userId).amount||0))}
function grantMoneyCapped(db,userId,amount,metadata){
  const grant=Math.min(remainingCap(db,userId),Math.max(0,Math.round(Number(amount)||0)));
  if(grant>0)txBalance(db,userId,'mini_game',grant,metadata);
  db.prepare(`INSERT INTO mini_game_daily_earnings(user_id,earning_date,amount,plays,updated_at)
    VALUES(?,?,?,?,?) ON CONFLICT(user_id,earning_date) DO UPDATE SET amount=amount+excluded.amount,updated_at=excluded.updated_at`)
    .run(userId,todayKey(),grant,0,nowIso());
  return grant;
}
function levenshteinOne(a,b){
  if(a===b)return 0;
  if(Math.abs(a.length-b.length)>1)return 2;
  if(a.length===b.length){let d=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i]&&++d>1)return 2;return d}
  const [s,l]=a.length<b.length?[a,b]:[b,a];let i=0,j=0,d=0;
  while(i<s.length&&j<l.length){if(s[i]===l[j]){i++;j++;continue}if(++d>1)return 2;j++}
  return d+(j<l.length?1:0);
}
function editorAllowed(source,next){
  if(!isGameUsername(next))return false;
  if(source===next)return false;
  if(levenshteinOne(source,next)<=1)return true;
  if(source.replace(/\d+/g,'')===next||source.replace(/_/g,'')===next)return true;
  if(source.replace(/[_\d]+/g,'')===next)return true;
  return false;
}
function resolveAnswer(key,q,answer,state){
  if(key==='hunt'){
    const picked=String(answer||'');const correct=picked===q.answer;
    return {correct,reward:correct?Math.min(700,300+state.streak*80):50,xp:correct?8:3,detail:{correct:q.answer,picked}};
  }
  if(key==='higher'){
    const picked=String(answer||'').toLowerCase(),correct=picked===q.answer;
    return {correct,reward:correct?Math.min(650,250+state.streak*75):40,xp:correct?8:3,detail:{correct:q.answer,picked,rightValue:q.right.value}};
  }
  if(key==='price'){
    const picked=String(answer||''),correct=picked===q.answer;
    return {correct,reward:correct?350:40,xp:correct?7:3,detail:{correct:q.answer,picked,value:q.item.value}};
  }
  if(key==='editor'){
    const source=normalizeUsername(q.source),next=normalizeUsername(answer);
    if(!editorAllowed(source,next))throw new Error('game_bad_edit');
    const before=analyzeUsername(source),after=analyzeUsername(next),gain=Math.max(0,after.value-before.value),correct=gain>0;
    return {correct,reward:correct?Math.min(1500,250+Math.round(gain*.08)):50,xp:correct?12:4,score:gain,detail:{before:before.value,after:after.value,handle:'@'+next,gain}};
  }
  if(key==='build'){
    const raw=Array.isArray(answer)?answer.join(''):String(answer||''),next=normalizeUsername(raw),parts=[...q.parts];
    const canBuild=(text,remaining)=>{
      if(!text.length)return remaining.length===0;
      for(let i=0;i<remaining.length;i++){
        const part=remaining[i];
        if(text.startsWith(part)&&canBuild(text.slice(part.length),remaining.slice(0,i).concat(remaining.slice(i+1))))return true;
      }
      return false;
    };
    if(!isGameUsername(next)||!canBuild(next,parts))throw new Error('game_bad_build');
    const a=analyzeUsername(next),reward=Math.min(1800,Math.max(100,Math.round(a.value*.03)));
    return {correct:true,reward,xp:10,score:a.value,detail:{handle:'@'+next,value:a.value,visual:a.visual}};
  }
  throw new Error('bad_game');
}
function finishSession(db,row,state){
  const score=Number(state.bestScore||state.score||0),recordId=crypto.randomUUID(),ts=nowIso();
  db.prepare('UPDATE mini_game_sessions SET state_json=?,finished_at=? WHERE id=?').run(JSON.stringify(state),ts,row.id);
  db.prepare('INSERT INTO mini_game_records(id,user_id,game_key,score,reward,xp,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(recordId,row.user_id,row.game_key,score,state.reward||0,state.xp||0,JSON.stringify({streak:state.streak||0}),ts);
  db.prepare(`INSERT INTO mini_game_daily_earnings(user_id,earning_date,amount,plays,updated_at)
    VALUES(?,?,?,?,?) ON CONFLICT(user_id,earning_date) DO UPDATE SET plays=plays+1,updated_at=excluded.updated_at`)
    .run(row.user_id,todayKey(),0,1,ts);
  bumpTask(db,row.user_id,'games',1);
  bumpTask(db,row.user_id,'game_'+row.game_key,1);
  if(row.game_key==='hunt'&&state.score>=3)bumpTask(db,row.user_id,'hunt_win',1);
}
export function gamesHub(db,user){
  ensureSchema(db);
  const d=dailyRow(db,user.id),best=db.prepare('SELECT game_key,MAX(score) best FROM mini_game_records WHERE user_id=? GROUP BY game_key').all(user.id);
  const map=new Map(best.map(x=>[x.game_key,Number(x.best||0)]));
  return {games:MINI_GAMES.map(x=>({...x,best:map.get(x.key)||0})),daily:{earned:Number(d.amount||0),cap:MINI_GAME_DAILY_CAP,remaining:Math.max(0,MINI_GAME_DAILY_CAP-Number(d.amount||0)),plays:Number(d.plays||0)}};
}
export function startMiniGame(db,user,key){
  ensureSchema(db);
  const game=MINI_GAMES.find(x=>x.key===key);if(!game)throw new Error('bad_game');
  const recent=db.prepare('SELECT COUNT(*) c FROM mini_game_sessions WHERE user_id=? AND created_at>?').get(user.id,new Date(Date.now()-3600000).toISOString());
  if(Number(recent?.c||0)>=30)throw new Error('game_cooldown');
  const payload=questionsFor(key),id=crypto.randomUUID(),created=nowIso(),expires=new Date(Date.now()+SESSION_TTL_MS).toISOString();
  const state={index:0,total:payload.length,score:0,streak:0,reward:0,xp:0,bestScore:0};
  db.prepare('INSERT INTO mini_game_sessions(id,user_id,game_key,payload_json,state_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?)')
    .run(id,user.id,key,JSON.stringify(payload),JSON.stringify(state),created,expires);
  return {game,...sessionView(db.prepare('SELECT * FROM mini_game_sessions WHERE id=?').get(id)),daily:gamesHub(db,user).daily};
}
export function answerMiniGame(db,user,sessionId,answer,expectedIndex=null){
  ensureSchema(db);
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM mini_game_sessions WHERE id=? AND user_id=?').get(String(sessionId||''),user.id);
    if(!row)throw new Error('game_session_not_found');
    if(row.finished_at)throw new Error('game_finished');
    if(new Date(row.expires_at).getTime()<Date.now())throw new Error('game_session_expired');
    const payload=safePayload(row),state=safeState(row);
    if(expectedIndex!==null&&Number(expectedIndex)!==Number(state.index))throw new Error('game_stale_answer');
    const q=payload[state.index];if(!q)throw new Error('game_finished');
    const resolved=resolveAnswer(row.game_key,q,answer,state);
    if(resolved.correct){state.score=(state.score||0)+1;state.streak=(state.streak||0)+1}else state.streak=0;
    if(Number.isFinite(resolved.score))state.bestScore=Math.max(Number(state.bestScore||0),Number(resolved.score||0));
    else state.bestScore=Math.max(Number(state.bestScore||0),Number(state.score||0));
    const money=grantMoneyCapped(db,user.id,resolved.reward,{game:row.game_key,sessionId:row.id,index:state.index});
    const xp=Math.max(0,Math.round(resolved.xp||0));if(xp)grantXp(db,user.id,xp,'mini_game',{game:row.game_key,sessionId:row.id,index:state.index,correct:resolved.correct});
    state.reward=(state.reward||0)+money;state.xp=(state.xp||0)+xp;state.index++;
    const done=state.index>=payload.length;
    if(done)finishSession(db,row,state);else db.prepare('UPDATE mini_game_sessions SET state_json=? WHERE id=?').run(JSON.stringify(state),row.id);
    const fresh=db.prepare('SELECT * FROM mini_game_sessions WHERE id=?').get(row.id);
    return {...sessionView(fresh),result:{correct:!!resolved.correct,reward:money,xp,detail:resolved.detail},daily:gamesHub(db,user).daily};
  })();
}
export function cleanupMiniGameSessions(db){
  const expired=new Date(Date.now()-24*3600000).toISOString(),finished=new Date(Date.now()-7*24*3600000).toISOString();
  return db.prepare('DELETE FROM mini_game_sessions WHERE (finished_at IS NULL AND expires_at<?) OR (finished_at IS NOT NULL AND finished_at<?)').run(expired,finished).changes;
}
export function ensureMiniGameSchema(db){ensureSchema(db);return true}
