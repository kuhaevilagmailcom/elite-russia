import {buildGeneratedHandle,generatedSupply,scoreHandle,isValidHandle} from './generator.mjs';
import {uid,nowIso,bumpSeasonScore} from './economy.mjs';

export const UPGRADE_RULES=Object.freeze({
  COMMON:{next:'RARE',successChance:.20,minMultiplier:1.80},
  RARE:{next:'EPIC',successChance:.16,minMultiplier:1.70},
  EPIC:{next:'LEGEND',successChance:.12,minMultiplier:1.60},
  LEGEND:{next:'ULTRA',successChance:.08,minMultiplier:1.50}
});

function sourceShape(r){
  return r?{id:r.id,handle:'@'+r.handle,rarity:r.rarity,value:r.value,instanceNumber:r.instance_number,maxSupply:r.max_supply}:null;
}
function targetMinimum(source,rule){return Math.ceil((Number(source.value)||0)*rule.minMultiplier/50)*50}
function createTarget(db,user,next,minValue){
  for(let i=0;i<80;i++){
    const handle=buildGeneratedHandle(next);if(!isValidHandle(handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      const supply=generatedSupply(next),base=scoreHandle(handle,next,1,supply);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)')
        .run(handle,next,base,supply,'upgrade',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(!t||!t.active||t.current_supply>=t.max_supply)continue;
    const n=t.current_supply+1;
    const scored=scoreHandle(t.handle,next,n,t.max_supply);
    const value=Math.max(scored,minValue);
    const id=uid();
    const changed=db.prepare('UPDATE username_templates SET current_supply=current_supply+1 WHERE id=? AND current_supply<max_supply').run(t.id).changes;
    if(!changed)continue;
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)')
      .run(id,t.id,t.handle,next,value,n,t.max_supply,user.id,'owned',nowIso(),'upgrade');
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,nowIso());
    return {id,handle:'@'+t.handle,rarity:next,value,instanceNumber:n,maxSupply:t.max_supply};
  }
  throw new Error('upgrade_unavailable');
}
function replayResult(db,row){
  const sourceId=JSON.parse(row.source_ids||'[]')[0];
  const source=sourceId?sourceShape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(sourceId)):null;
  const rule=UPGRADE_RULES[row.from_rarity];
  const result=row.target_instance_id?sourceShape(db.prepare('SELECT * FROM username_instances WHERE id=?').get(row.target_instance_id)):null;
  return {ok:true,replayed:true,success:!!row.success,result,source,chance:rule?.successChance||0,from:row.from_rarity,to:row.to_rarity,targetMinValue:source&&rule?targetMinimum(source,rule):0};
}
export function upgradeInfo(db,user){
  const rows=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') ORDER BY value DESC LIMIT 120").all(user.id);
  const available=rows.map(x=>{
    const rule=UPGRADE_RULES[x.rarity];
    return {...x,handle:'@'+x.handle,chance:rule.successChance,next:rule.next,targetMinValue:targetMinimum(x,rule)};
  });
  return {rules:UPGRADE_RULES,available};
}
export function performUpgrade(db,user,instanceId,requestId,rng=Math.random){
  if(!instanceId)throw new Error('bad_upgrade');
  if(!requestId||String(requestId).length>100)throw new Error('bad_request_id');
  const previous=db.prepare('SELECT * FROM upgrade_history WHERE user_id=? AND request_id=?').get(user.id,String(requestId));
  if(previous)return replayResult(db,previous);
  return db.transaction(()=>{
    const source=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);
    if(!source)throw new Error('upgrade_invalid_items');
    const rule=UPGRADE_RULES[source.rarity];if(!rule)throw new Error('upgrade_bad_recipe');
    const minValue=targetMinimum(source,rule);
    db.prepare("UPDATE username_instances SET status='consumed' WHERE id=?").run(source.id);
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(source.id);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(source.id);
    const success=rng()<rule.successChance;
    const result=success?createTarget(db,user,rule.next,minValue):null;
    db.prepare('INSERT INTO upgrade_progress(user_id,points,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET points=points+excluded.points,updated_at=excluded.updated_at')
      .run(user.id,1,nowIso());
    db.prepare('INSERT INTO upgrade_history(id,user_id,request_id,source_ids,target_instance_id,from_rarity,to_rarity,success,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(uid(),user.id,String(requestId),JSON.stringify([source.id]),result?.id||'',source.rarity,rule.next,success?1:0,nowIso());
    bumpSeasonScore(db,user.id,success?50:5);
    return {ok:true,replayed:false,success,result,source:sourceShape(source),chance:rule.successChance,from:source.rarity,to:rule.next,targetMinValue:minValue};
  })();
}
