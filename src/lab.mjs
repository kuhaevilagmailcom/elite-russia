import {analyzeUsername,isGameUsername,normalizeUsername} from './valuation.mjs';
import {todayKey,txBalance,bumpTask,nowIso} from './economy.mjs';
import {grantXp} from './progression.mjs';

const THEMES=[
  {key:'cars',label:'Машины',hint:'4–10 символов · можно без цифр'},
  {key:'gaming',label:'Игры',hint:'4–10 символов · легко читается'},
  {key:'finance',label:'Деньги',hint:'4–10 символов · без мусора'},
  {key:'tech',label:'Технологии',hint:'4–10 символов · брендово'},
  {key:'media',label:'Музыка / медиа',hint:'4–10 символов · запоминается'},
  {key:'sports',label:'Спорт',hint:'4–10 символов · коротко'},
  {key:'animals',label:'Животные',hint:'4–10 символов · читаемо'},
  {key:'cities',label:'Города',hint:'4–10 символов · узнаваемо'}
];
const DAILY_CAP=12000;
function challengeIndex(userId,date){
  const digits=String(date).replace(/\D/g,'').split('').reduce((a,b)=>a+Number(b),0);
  return (Number(userId||0)+digits)%THEMES.length;
}
export function labStatus(db,user){
  const date=todayKey(),theme=THEMES[challengeIndex(user.id,date)];
  const row=db.prepare('SELECT COUNT(*) attempts,COALESCE(SUM(reward),0) earned,MAX(created_at) last_at FROM username_lab_attempts WHERE user_id=? AND attempt_date=?').get(user.id,date);
  return {theme,date,attempts:Number(row?.attempts||0),earned:Number(row?.earned||0),dailyCap:DAILY_CAP,cooldownMs:3500};
}
function baseReward(score){
  const s=Math.max(0,Math.min(1000,Number(score)||0));
  if(s<250)return 50+Math.round(s/250*50);
  if(s<450)return 150+Math.round((s-250)/200*200);
  if(s<650)return 350+Math.round((s-450)/200*450);
  if(s<820)return 800+Math.round((s-650)/170*700);
  return Math.min(2000,1500+Math.round((s-820)/180*500));
}
function fingerprint(handle){
  return normalizeUsername(handle).replace(/[_\d]+/g,'').replace(/(.)\1+/g,'$1');
}
export function submitLab(db,user,input){
  const handle=normalizeUsername(input),now=Date.now();
  if(!isGameUsername(handle))throw new Error('lab_invalid_username');
  const result=db.transaction(()=>{
    const status=labStatus(db,user),last=status.attempts?db.prepare('SELECT created_at FROM username_lab_attempts WHERE user_id=? AND attempt_date=? ORDER BY id DESC LIMIT 1').get(user.id,status.date):null;
    if(last&&now-new Date(last.created_at).getTime()<3500)throw new Error('lab_cooldown');
    if(status.earned>=DAILY_CAP)throw new Error('lab_daily_cap');
    if(db.prepare('SELECT 1 FROM username_lab_attempts WHERE user_id=? AND handle=? LIMIT 1').get(user.id,handle))throw new Error('lab_duplicate');
    const fp=fingerprint(handle);
    if(fp.length>=3&&db.prepare('SELECT 1 FROM username_lab_attempts WHERE user_id=? AND attempt_date=? AND fingerprint=? LIMIT 1').get(user.id,status.date,fp))throw new Error('lab_too_similar');
    const assessment=analyzeUsername(handle,{theme:status.theme.key});
    const labScore=Math.max(0,Math.min(100,Math.round(
    assessment.breakdown.pronounceability*.25+
    assessment.breakdown.cleanliness*.18+
    assessment.breakdown.word*.18+
    assessment.breakdown.length*.12+
    assessment.breakdown.brand*.12+
    assessment.breakdown.theme*.15
    )));
    let factor=status.attempts<10?1:status.attempts<25?.7:.4;
    const remaining=Math.max(0,DAILY_CAP-status.earned);
    const reward=Math.min(remaining,Math.max(25,Math.round(baseReward(labScore*10)*factor/10)*10));
    const xp=Math.max(8,Math.round(10+labScore*.18));
    if(reward>0)txBalance(db,user.id,'username_lab',reward,{handle,score:labScore,theme:status.theme.key});
    const prog=grantXp(db,user.id,xp,'username_lab',{handle,score:labScore,theme:status.theme.key});
    db.prepare('INSERT INTO username_lab_attempts(user_id,attempt_date,handle,fingerprint,theme,score,reward,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(user.id,status.date,handle,fp,status.theme.key,labScore,reward,nowIso());
    bumpTask(db,user.id,'lab',1);
    return {progression:prog,score:labScore,reward,xp,assessment,statusDate:status.date,theme:status.theme.key};
  }).immediate();
  const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  return {
    handle:'@'+handle,score:result.score,reward:result.reward,xp:result.xp,assessment:{value:result.assessment.value,visual:result.assessment.visual,category:result.assessment.category,
      readability:result.assessment.breakdown.pronounceability,cleanliness:result.assessment.breakdown.cleanliness,brevity:result.assessment.breakdown.length,
      originality:Math.max(0,Math.min(100,Math.round((result.assessment.breakdown.brand+result.assessment.breakdown.pattern)/2))),theme:result.assessment.breakdown.theme},
    progression:result.progression,status:labStatus(db,fresh),userId:fresh.id
  };
}
