import {buildGeneratedHandle,generatedSupply,scoreHandle,isValidHandle} from './generator.mjs';
import {uid,nowIso,bumpSeasonScore} from './economy.mjs';

const ORDER=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const UPGRADE_RULES=Object.freeze({
  COMMON:{next:'RARE',baseChance:.10,minMultiplier:1.70},
  RARE:{next:'EPIC',baseChance:.08,minMultiplier:1.65},
  EPIC:{next:'LEGEND',baseChance:.06,minMultiplier:1.60},
  LEGEND:{next:'ULTRA',baseChance:.04,minMultiplier:1.55}
});
const shape=r=>r?{id:r.id,handle:'@'+r.handle,rarity:r.rarity,value:r.value,instanceNumber:r.instance_number,maxSupply:r.max_supply}:null;

function validateIds(ids){
  if(!Array.isArray(ids)||ids.length<1||ids.length>5)throw new Error('bad_upgrade');
  const uniq=[...new Set(ids.map(String).filter(Boolean))];if(uniq.length!==ids.length)throw new Error('bad_upgrade');
  return uniq;
}
function loadSources(db,user,ids){
  const clean=validateIds(ids),marks=clean.map(()=>'?').join(',');
  const rows=db.prepare(`SELECT * FROM username_instances WHERE id IN (${marks}) AND owner_id=? AND status='owned'`).all(...clean,user.id);
  if(rows.length!==clean.length)throw new Error('upgrade_invalid_items');
  if(rows.some(r=>r.rarity==='ULTRA'||!UPGRADE_RULES[r.rarity]))throw new Error('upgrade_bad_recipe');
  return clean.map(id=>rows.find(r=>r.id===id));
}
function calculatePreview(rows){
  const anchor=rows.reduce((best,r)=>ORDER.indexOf(r.rarity)>ORDER.indexOf(best.rarity)?r:best,rows[0]);
  const rule=UPGRADE_RULES[anchor.rarity],anchorValue=Math.max(1,Number(anchor.value)||1),totalValue=rows.reduce((s,r)=>s+Number(r.value||0),0);
  let chance=rule.baseChance;
  for(const r of rows){
    if(r.id===anchor.id)continue;
    chance+=Math.min(.04,Math.max(.008,(Number(r.value)||0)/anchorValue*.035));
  }
  chance=Math.min(.32,Math.max(.04,chance));
  const targetMinValue=Math.ceil(Math.max(anchorValue*rule.minMultiplier,totalValue*1.45)/50)*50;
  return {from:anchor.rarity,to:rule.next,chance,targetMinValue,totalValue,anchorId:anchor.id,count:rows.length};
}
function createTarget(db,user,next,minValue){
  for(let i=0;i<90;i++){
    const handle=buildGeneratedHandle(next);if(!isValidHandle(handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      const supply=generatedSupply(next),base=scoreHandle(handle,next,1,supply);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)')
        .run(handle,next,base,supply,'upgrade',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(!t||!t.active||t.current_supply>=t.max_supply)continue;
    const n=t.current_supply+1,value=Math.max(scoreHandle(t.handle,next,n,t.max_supply),minValue),id=uid();
    if(!db.prepare('UPDATE username_templates SET current_supply=current_supply+1 WHERE id=? AND current_supply<max_supply').run(t.id).changes)continue;
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)')
      .run(id,t.id,t.handle,next,value,n,t.max_supply,user.id,'owned',nowIso(),'upgrade');
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,nowIso());
    return {id,handle:'@'+t.handle,rarity:next,value,instanceNumber:n,maxSupply:t.max_supply};
  }
  throw new Error('upgrade_unavailable');
}
function replayResult(db,row){
  const ids=JSON.parse(row.source_ids||'[]'),sources=ids.map(id=>shape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(id))).filter(Boolean);
  const preview=sources.length?calculatePreview(sources.map(s=>({id:s.id,handle:s.handle.slice(1),rarity:s.rarity,value:s.value,instance_number:s.instanceNumber,max_supply:s.maxSupply}))):{chance:0,from:row.from_rarity,to:row.to_rarity,targetMinValue:0,totalValue:0,count:ids.length};
  const result=row.target_instance_id?shape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(row.target_instance_id)):null;
  return {ok:true,replayed:true,success:!!row.success,result,sources,...preview};
}
export function upgradeInfo(db,user){
  const available=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') ORDER BY value DESC LIMIT 150").all(user.id).map(shape);
  return {rules:UPGRADE_RULES,maxItems:5,available};
}
export function previewUpgrade(db,user,ids){
  const rows=loadSources(db,user,ids),preview=calculatePreview(rows);
  return {...preview,sources:rows.map(shape),maxItems:5};
}
export function performUpgrade(db,user,ids,requestId,rng=Math.random){
  if(!requestId||String(requestId).length>100)throw new Error('bad_request_id');
  const previous=db.prepare('SELECT * FROM upgrade_history WHERE user_id=? AND request_id=?').get(user.id,String(requestId));
  if(previous)return replayResult(db,previous);
  return db.transaction(()=>{
    const rows=loadSources(db,user,ids),preview=calculatePreview(rows);
    for(const source of rows){
      db.prepare("UPDATE username_instances SET status='consumed' WHERE id=?").run(source.id);
      db.prepare('DELETE FROM inventory WHERE instance_id=?').run(source.id);
      db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(source.id);
    }
    const success=rng()<preview.chance;
    const result=success?createTarget(db,user,preview.to,preview.targetMinValue):null;
    db.prepare('INSERT INTO upgrade_progress(user_id,points,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET points=points+excluded.points,updated_at=excluded.updated_at')
      .run(user.id,rows.length,nowIso());
    db.prepare('INSERT INTO upgrade_history(id,user_id,request_id,source_ids,target_instance_id,from_rarity,to_rarity,success,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(uid(),user.id,String(requestId),JSON.stringify(rows.map(r=>r.id)),result?.id||'',preview.from,preview.to,success?1:0,nowIso());
    bumpSeasonScore(db,user.id,success?50:5);
    return {ok:true,replayed:false,success,result,sources:rows.map(shape),...preview};
  })();
}
