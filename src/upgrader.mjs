import {buildGeneratedHandle,scoreHandle,isValidHandle,rarityFromValue} from './generator.mjs';
import {uid,nowIso,bumpSeasonScore,randomUnit} from './economy.mjs';

export const UPGRADE_RULES=Object.freeze({
  COMMON:{next:'RARE',minMultiplier:1.35},
  RARE:{next:'EPIC',minMultiplier:1.32},
  EPIC:{next:'LEGEND',minMultiplier:1.28},
  LEGEND:{next:'ULTRA',minMultiplier:1.22}
});
const shape=r=>r?{id:r.id,handle:'@'+r.handle,rarity:r.rarity,value:r.value,instanceNumber:r.instance_number,maxSupply:r.max_supply}:null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const TARGET_OPTION_COUNT=8;
const TARGET_RANGE=Object.freeze({RARE:[15000,99999],EPIC:[100000,499999],LEGEND:[500000,1999999],ULTRA:[2000000,25000000]});
const chanceFor=(sourceValue,targetValue)=>clamp(Number(sourceValue)*.90/Math.max(1,Number(targetValue)),.01,.75);
function validateIds(ids){
  if(!Array.isArray(ids)||ids.length!==1)throw new Error('bad_upgrade');
  const clean=String(ids[0]||'');if(!clean)throw new Error('bad_upgrade');return [clean];
}
function loadSources(db,user,ids){
  const clean=validateIds(ids),marks=clean.map(()=>'?').join(',');
  const rows=db.prepare(`SELECT * FROM username_instances WHERE id IN (${marks}) AND owner_id=? AND status='owned'`).all(...clean,user.id);
  if(rows.length!==clean.length)throw new Error('upgrade_invalid_items');
  if(rows.some(r=>r.rarity==='ULTRA'||!UPGRADE_RULES[r.rarity]))throw new Error('upgrade_bad_recipe');
  return clean.map(id=>rows.find(r=>r.id===id));
}
function calculatePlan(source){
  const rule=UPGRADE_RULES[source.rarity];
  const targetMinValue=Math.ceil(Number(source.value)*rule.minMultiplier/50)*50;
  return {source,rule,totalValue:Number(source.value),targetMinValue,from:source.rarity,to:rule.next,count:1};
}
function prepareTarget(db,next,minValue,maxValue=Infinity){
  for(let i=0;i<300;i++){
    const handle=buildGeneratedHandle(next);if(!isValidHandle(handle))continue;
    if(db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(handle))continue;
    if(db.prepare('SELECT 1 FROM upgrade_sessions WHERE target_handle=? AND used_at IS NULL AND expires_at>? LIMIT 1').get(handle,nowIso()))continue;
    const raw=scoreHandle(handle),value=Math.max(raw,minValue),rarity=rarityFromValue(value);
    if(value>maxValue||rarity!==next)continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)').run(handle,rarity,raw,1,'upgrade',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(!t||!t.active||t.current_supply>=1)continue;
    if(t.rarity!==rarity||t.base_value!==raw)db.prepare('UPDATE username_templates SET rarity=?,base_value=?,max_supply=1 WHERE id=?').run(rarity,raw,t.id);
    return {templateId:t.id,handle:t.handle,rarity,value,instanceNumber:1,maxSupply:1};
  }
  throw new Error('upgrade_unavailable');
}
function sessionPayload(s){return {sessionId:s.id,chance:Number(s.chance),from:s.from_rarity,to:s.target_rarity,target:{handle:'@'+s.target_handle,rarity:s.target_rarity,value:s.target_value}}}
function createSession(db,user,rows,preview,targetMinValue=preview.targetMinValue,targetMaxValue=Infinity){
  const sorted=rows.map(r=>r.id).sort(),target=prepareTarget(db,preview.to,targetMinValue,targetMaxValue);
  // CS-style upgrader: every visible target carries its real server-side
  // probability. More expensive targets therefore have a smaller win arc.
  const chance=chanceFor(preview.source.value,target.value);
  const id=uid(),created=nowIso(),expires=new Date(Date.now()+10*60*1000).toISOString();
  db.prepare(`INSERT INTO upgrade_sessions(id,user_id,source_ids,target_template_id,target_handle,target_rarity,target_value,chance,from_rarity,created_at,expires_at,used_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)`).run(id,user.id,JSON.stringify(sorted),target.templateId,target.handle,target.rarity,target.value,chance,preview.from,created,expires);
  return db.prepare('SELECT * FROM upgrade_sessions WHERE id=?').get(id);
}
function targetOptions(db,user,rows,preview){
  const key=JSON.stringify(rows.map(r=>r.id).sort()),range=TARGET_RANGE[preview.to],now=nowIso();
  if(!range)throw new Error('upgrade_unavailable');

  // Reuse an active preview for the same source. Repeated renders / retries must
  // not reroll the target ladder or invalidate a button the user already saw.
  const existing=db.prepare(`SELECT s.*
    FROM upgrade_sessions s
    JOIN username_templates t ON t.id=s.target_template_id
    WHERE s.user_id=? AND s.source_ids=? AND s.used_at IS NULL AND s.expires_at>?
      AND t.active=1 AND t.current_supply<1
      AND NOT EXISTS(SELECT 1 FROM username_instances i WHERE i.handle=s.target_handle)
    ORDER BY s.target_value ASC,s.created_at ASC`).all(user.id,key,now);
  if(existing.length){
    return existing.slice(0,TARGET_OPTION_COUNT).map(sessionPayload);
  }

  db.prepare('DELETE FROM upgrade_sessions WHERE user_id=? AND source_ids=? AND used_at IS NULL').run(user.id,key);
  const floor=Math.max(Number(preview.targetMinValue),range[0]),upper=Math.min(range[1],Math.max(floor+350,Math.round(floor*6)));
  const floors=[];
  for(let i=0;i<TARGET_OPTION_COUNT;i++){
    const t=TARGET_OPTION_COUNT===1?0:i/(TARGET_OPTION_COUNT-1);
    let value=Math.round((floor*Math.pow(Math.max(1,upper/floor),t))/50)*50;
    if(floors.length&&value<=floors[floors.length-1])value=floors[floors.length-1]+50;
    floors.push(Math.min(range[1],value));
  }
  const sessions=[];
  for(let i=0;i<floors.length;i++){
    const minValue=floors[i],maxValue=i<floors.length-1?Math.max(minValue,floors[i+1]-50):range[1];
    try{sessions.push(createSession(db,user,rows,preview,minValue,maxValue))}
    catch(e){if(e.message!=='upgrade_unavailable')throw e}
  }
  if(!sessions.length)throw new Error('upgrade_unavailable');
  return sessions.sort((a,b)=>Number(a.target_value)-Number(b.target_value)).map(sessionPayload);
}
function allocateSessionTarget(db,user,session){
  const t=db.prepare('SELECT * FROM username_templates WHERE id=?').get(session.target_template_id);
  if(!t||!t.active||t.current_supply>=1||db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(t.handle))throw new Error('upgrade_unavailable');
  const n=1,id=uid(),value=Math.max(Number(session.target_value)||0,scoreHandle(t.handle)),rarity=rarityFromValue(value);if(rarity!==session.target_rarity)throw new Error('upgrade_session_mismatch');
  if(!db.prepare('UPDATE username_templates SET current_supply=1,max_supply=1 WHERE id=? AND current_supply=0').run(t.id).changes)throw new Error('upgrade_unavailable');
  db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)')
    .run(id,t.id,t.handle,rarity,value,1,1,user.id,'owned',nowIso(),'upgrade');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,nowIso());
  return {id,handle:'@'+t.handle,rarity,value,instanceNumber:n,maxSupply:1};
}
function replayResult(db,row){
  const ids=JSON.parse(row.source_ids||'[]'),sources=ids.map(id=>shape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(id))).filter(Boolean);
  const session=db.prepare('SELECT * FROM upgrade_sessions WHERE id=? AND user_id=?').get(row.request_id,row.user_id);
  const result=row.target_instance_id?shape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(row.target_instance_id)):null;
  const target=session?{handle:'@'+session.target_handle,rarity:session.target_rarity,value:session.target_value}:result;
  return {ok:true,replayed:true,success:!!row.success,result,sources,chance:Number(session?.chance||0),from:row.from_rarity,to:row.to_rarity,target};
}
export function cleanupUpgradeSessions(db){
  const cutoff=new Date(Date.now()-24*3600000).toISOString(),now=nowIso();
  return db.prepare('DELETE FROM upgrade_sessions WHERE (used_at IS NOT NULL AND used_at<?) OR (used_at IS NULL AND expires_at<?)').run(cutoff,now).changes;
}
export function upgradeInfo(db,user){
  const available=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') ORDER BY value DESC LIMIT 250").all(user.id).map(shape);
  return {rules:UPGRADE_RULES,maxItems:1,available};
}
export function previewUpgrade(db,user,ids){
  cleanupUpgradeSessions(db);
  const rows=loadSources(db,user,ids),calc=calculatePlan(rows[0]),targets=targetOptions(db,user,rows,calc),base=targets[Math.min(2,targets.length-1)];
  return {...base,targets,totalValue:calc.totalValue,targetMinValue:calc.targetMinValue,sources:rows.map(shape),maxItems:1};
}
export function performUpgrade(db,user,ids,sessionId,rng=randomUnit){
  if(!sessionId||String(sessionId).length>100)throw new Error('bad_request_id');
  const previous=db.prepare('SELECT * FROM upgrade_history WHERE user_id=? AND request_id=?').get(user.id,String(sessionId));if(previous)return replayResult(db,previous);
  return db.transaction(()=>{
    const rows=loadSources(db,user,ids),session=db.prepare('SELECT * FROM upgrade_sessions WHERE id=? AND user_id=? AND used_at IS NULL').get(String(sessionId),user.id);
    if(!session||new Date(session.expires_at).getTime()<Date.now())throw new Error('upgrade_session_expired');
    const expected=JSON.stringify(rows.map(r=>r.id).sort());if(expected!==session.source_ids)throw new Error('upgrade_session_mismatch');
    for(const source of rows){db.prepare("UPDATE username_instances SET status='consumed' WHERE id=?").run(source.id);db.prepare('DELETE FROM inventory WHERE instance_id=?').run(source.id);db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(source.id)}
    const success=rng()<Number(session.chance),result=success?allocateSessionTarget(db,user,session):null,used=nowIso();
    db.prepare('UPDATE upgrade_sessions SET used_at=? WHERE id=?').run(used,session.id);
    db.prepare('DELETE FROM upgrade_sessions WHERE user_id=? AND source_ids=? AND id<>? AND used_at IS NULL').run(user.id,session.source_ids,session.id);
    db.prepare('INSERT INTO upgrade_progress(user_id,points,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET points=points+excluded.points,updated_at=excluded.updated_at').run(user.id,rows.length,used);
    db.prepare('INSERT INTO upgrade_history(id,user_id,request_id,source_ids,target_instance_id,from_rarity,to_rarity,success,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(uid(),user.id,String(session.id),JSON.stringify(rows.map(r=>r.id)),result?.id||'',session.from_rarity,session.target_rarity,success?1:0,used);
    grantXp(db,user.id,success?40:8,'upgrade',{success:!!success,chance:Number(session.chance),targetValue:session.target_value});
    bumpSeasonScore(db,user.id,success?50:5);
    return {ok:true,replayed:false,success,result,sources:rows.map(shape),chance:Number(session.chance),from:session.from_rarity,to:session.target_rarity,target:{handle:'@'+session.target_handle,rarity:session.target_rarity,value:session.target_value}};
  })();
}
