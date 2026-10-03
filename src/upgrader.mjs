import {buildGeneratedHandle,generatedSupply,scoreHandle,isValidHandle} from './generator.mjs';
import {RARITY_BASE} from './config.mjs';
import {uid,nowIso,bumpSeasonScore,randomUnit} from './economy.mjs';

const ORDER=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const UPGRADE_RULES=Object.freeze({
  COMMON:{next:'RARE',highChance:.66,lowChance:.40,minMultiplier:1.35},
  RARE:{next:'EPIC',highChance:.58,lowChance:.34,minMultiplier:1.32},
  EPIC:{next:'LEGEND',highChance:.50,lowChance:.28,minMultiplier:1.28},
  LEGEND:{next:'ULTRA',highChance:.42,lowChance:.24,minMultiplier:1.22}
});
const shape=r=>r?{id:r.id,handle:'@'+r.handle,rarity:r.rarity,value:r.value,instanceNumber:r.instance_number,maxSupply:r.max_supply}:null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function validateIds(ids){
  if(!Array.isArray(ids)||ids.length<1||ids.length>5)throw new Error('bad_upgrade');
  const uniq=[...new Set(ids.map(String).filter(Boolean))];if(uniq.length!==ids.length)throw new Error('bad_upgrade');return uniq;
}
function loadSources(db,user,ids){
  const clean=validateIds(ids),marks=clean.map(()=>'?').join(',');
  const rows=db.prepare(`SELECT * FROM username_instances WHERE id IN (${marks}) AND owner_id=? AND status='owned'`).all(...clean,user.id);
  if(rows.length!==clean.length)throw new Error('upgrade_invalid_items');
  if(rows.some(r=>r.rarity==='ULTRA'||!UPGRADE_RULES[r.rarity]))throw new Error('upgrade_bad_recipe');
  return clean.map(id=>rows.find(r=>r.id===id));
}
function anchorOf(rows){return rows.reduce((best,r)=>{const rb=ORDER.indexOf(best.rarity),rr=ORDER.indexOf(r.rarity);if(rr>rb)return r;if(rr===rb&&Number(r.value)>Number(best.value))return r;return best},rows[0])}
function calculateChance(rows){
  const anchor=anchorOf(rows),rule=UPGRADE_RULES[anchor.rarity],bounds=RARITY_BASE[anchor.rarity]||[1,1000];
  const t=clamp((Number(anchor.value)-bounds[0])/Math.max(1,bounds[1]-bounds[0]),0,1);
  let chance=rule.highChance-(rule.highChance-rule.lowChance)*t;
  for(const r of rows){if(r.id===anchor.id)continue;const ratio=clamp(Number(r.value||0)/Math.max(1,Number(anchor.value||1)),0,2);chance+=.045+Math.min(.045,ratio*.035)}
  chance=clamp(chance,.20,.80);
  const totalValue=rows.reduce((s,r)=>s+Number(r.value||0),0),targetMinValue=Math.ceil(Math.max(Number(anchor.value)*rule.minMultiplier,totalValue*1.12)/50)*50;
  return {anchor,rule,chance,totalValue,targetMinValue,from:anchor.rarity,to:rule.next,count:rows.length};
}
function prepareTarget(db,next,minValue){
  for(let i=0;i<100;i++){
    const handle=buildGeneratedHandle(next);if(!isValidHandle(handle))continue;
    if(db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(handle))continue;
    if(db.prepare('SELECT 1 FROM upgrade_sessions WHERE target_handle=? AND used_at IS NULL AND expires_at>? LIMIT 1').get(handle,nowIso()))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      const supply=1,base=scoreHandle(handle,next,1,1);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)').run(handle,next,base,supply,'upgrade',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(!t||!t.active||t.current_supply>=1)continue;
    const n=1,value=Math.max(scoreHandle(t.handle,next,1,1),minValue);
    return {templateId:t.id,handle:t.handle,rarity:next,value,instanceNumber:n,maxSupply:t.max_supply};
  }
  throw new Error('upgrade_unavailable');
}
function sessionPayload(s){return {sessionId:s.id,chance:Number(s.chance),from:s.from_rarity,to:s.target_rarity,target:{handle:'@'+s.target_handle,rarity:s.target_rarity,value:s.target_value}}}
function findReusableSession(db,user,sourceIds){
  const now=nowIso(),key=JSON.stringify([...sourceIds].sort());
  const s=db.prepare('SELECT * FROM upgrade_sessions WHERE user_id=? AND source_ids=? AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').get(user.id,key,now);
  return s||null;
}
function createSession(db,user,rows,preview){
  const sorted=rows.map(r=>r.id).sort(),existing=findReusableSession(db,user,sorted);
  if(existing)return existing;
  const target=prepareTarget(db,preview.to,preview.targetMinValue),id=uid(),created=nowIso(),expires=new Date(Date.now()+10*60*1000).toISOString();
  db.prepare(`INSERT INTO upgrade_sessions(id,user_id,source_ids,target_template_id,target_handle,target_rarity,target_value,chance,from_rarity,created_at,expires_at,used_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)`).run(id,user.id,JSON.stringify(sorted),target.templateId,target.handle,target.rarity,target.value,preview.chance,preview.from,created,expires);
  return db.prepare('SELECT * FROM upgrade_sessions WHERE id=?').get(id);
}
function allocateSessionTarget(db,user,session){
  const t=db.prepare('SELECT * FROM username_templates WHERE id=?').get(session.target_template_id);
  if(!t||!t.active||t.current_supply>=1||db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(t.handle))throw new Error('upgrade_unavailable');
  const n=1,id=uid(),value=Math.max(Number(session.target_value)||0,scoreHandle(t.handle,t.rarity,1,1));
  if(!db.prepare('UPDATE username_templates SET current_supply=1,max_supply=1 WHERE id=? AND current_supply=0').run(t.id).changes)throw new Error('upgrade_unavailable');
  db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)')
    .run(id,t.id,t.handle,t.rarity,value,1,1,user.id,'owned',nowIso(),'upgrade');
  db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,nowIso());
  return {id,handle:'@'+t.handle,rarity:t.rarity,value,instanceNumber:n,maxSupply:t.max_supply};
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
  const available=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') ORDER BY value DESC LIMIT 150").all(user.id).map(shape);
  return {rules:UPGRADE_RULES,maxItems:5,available};
}
export function previewUpgrade(db,user,ids){
  cleanupUpgradeSessions(db);
  const rows=loadSources(db,user,ids),calc=calculateChance(rows),session=createSession(db,user,rows,calc),base=sessionPayload(session);
  return {...base,totalValue:calc.totalValue,targetMinValue:calc.targetMinValue,sources:rows.map(shape),maxItems:5};
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
    db.prepare('INSERT INTO upgrade_progress(user_id,points,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET points=points+excluded.points,updated_at=excluded.updated_at').run(user.id,rows.length,used);
    db.prepare('INSERT INTO upgrade_history(id,user_id,request_id,source_ids,target_instance_id,from_rarity,to_rarity,success,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(uid(),user.id,String(session.id),JSON.stringify(rows.map(r=>r.id)),result?.id||'',session.from_rarity,session.target_rarity,success?1:0,used);
    bumpSeasonScore(db,user.id,success?50:5);
    return {ok:true,replayed:false,success,result,sources:rows.map(shape),chance:Number(session.chance),from:session.from_rarity,to:session.target_rarity,target:{handle:'@'+session.target_handle,rarity:session.target_rarity,value:session.target_value}};
  })();
}
