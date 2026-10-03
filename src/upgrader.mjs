import {buildGeneratedHandle,generatedSupply,scoreHandle,isValidHandle} from './generator.mjs';
import {uid,nowIso,bumpSeasonScore} from './economy.mjs';
const rules={COMMON:{count:3,next:'RARE'},RARE:{count:3,next:'EPIC'},EPIC:{count:4,next:'LEGEND'},LEGEND:{count:5,next:'ULTRA'}};
function createTarget(db,user,next){
  for(let i=0;i<50;i++){
    const handle=buildGeneratedHandle(next);if(!isValidHandle(handle))continue;
    let t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    if(!t){
      const supply=generatedSupply(next),base=scoreHandle(handle,next,1,supply);
      db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,0,?,0,1,?)').run(handle,next,base,supply,'upgrade',nowIso());
      t=db.prepare('SELECT * FROM username_templates WHERE handle=?').get(handle);
    }
    if(!t||!t.active||t.current_supply>=t.max_supply)continue;
    const n=t.current_supply+1,value=scoreHandle(t.handle,next,n,t.max_supply),id=uid();
    db.prepare('UPDATE username_templates SET current_supply=current_supply+1 WHERE id=? AND current_supply<max_supply').run(t.id);
    db.prepare('INSERT INTO username_instances(id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,season_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)').run(id,t.id,t.handle,next,value,n,t.max_supply,user.id,'owned',nowIso(),'upgrade');
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,nowIso());
    return {id,handle:'@'+t.handle,rarity:next,value,instanceNumber:n,maxSupply:t.max_supply};
  }
  throw new Error('upgrade_unavailable');
}
export function upgradeInfo(db,user){
  const groups=db.prepare("SELECT rarity,COUNT(*) count FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') GROUP BY rarity").all(user.id);
  const available=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply FROM username_instances WHERE owner_id=? AND status='owned' AND rarity IN ('COMMON','RARE','EPIC','LEGEND') ORDER BY rarity,value ASC LIMIT 100").all(user.id).map(x=>({...x,handle:'@'+x.handle}));
  return {rules,groups,available};
}
export function performUpgrade(db,user,ids){
  if(!Array.isArray(ids)||!ids.length)throw new Error('bad_upgrade');
  return db.transaction(()=>{
    const placeholders=ids.map(()=>'?').join(',');
    const rows=db.prepare(`SELECT * FROM username_instances WHERE id IN (${placeholders}) AND owner_id=? AND status='owned'`).all(...ids,user.id);
    if(rows.length!==ids.length)throw new Error('upgrade_invalid_items');
    const rarity=rows[0].rarity,rule=rules[rarity];if(!rule||rows.some(x=>x.rarity!==rarity)||rows.length!==rule.count)throw new Error('upgrade_bad_recipe');
    for(const r of rows){db.prepare("UPDATE username_instances SET status='consumed' WHERE id=?").run(r.id);db.prepare('DELETE FROM inventory WHERE instance_id=?').run(r.id);db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(r.id)}
    const result=createTarget(db,user,rule.next);
    db.prepare('INSERT INTO upgrade_history(id,user_id,source_ids,target_instance_id,from_rarity,to_rarity,created_at) VALUES(?,?,?,?,?,?,?)').run(uid(),user.id,JSON.stringify(ids),result.id,rarity,rule.next,nowIso());
    bumpSeasonScore(db,user.id,50);
    return {ok:true,result};
  })();
}
