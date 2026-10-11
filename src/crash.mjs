import crypto from 'node:crypto';
import {uid,nowIso,randomUnit} from './economy.mjs';
import {buildGeneratedHandle,isValidHandle,rarityFromValue,SPECIALS} from './generator.mjs';
import {analyzeUsername,visualTier} from './valuation.mjs';

// Shared Crash stakes are fictional collectible usernames, not real Telegram
// handles. Cashout exchanges the staked handle for a new, higher-value item,
// NEVER awards additional balance. Winning handle is reserved for this player
// in SQLite before the flight, so the displayed prize can actually be minted.
export const CRASH_WAIT_MS=10000;
export const CRASH_MAX_X=1000;
export const CRASH_GROWTH=0.115; // log-multiplier gained per second
export const CRASH_MAX_PAYOUT=1_000_000_000; // canonical maximum item value
export const CRASH_REWARD_STAGES=Object.freeze(Array.from({length:35},(_,i)=>
  Number(Math.exp(Math.log(CRASH_MAX_X)*i/34).toFixed(6))));

const specialSet=new Set(SPECIALS.map(x=>String(x[0]).toLowerCase()));
export function crashRewardValue(stakeValue,multiplier){
  const value=Math.max(1,Math.floor(Number(stakeValue)||0));
  return Math.max(value,Math.min(CRASH_MAX_PAYOUT,Math.floor(value*Math.max(1,Number(multiplier)||1))));
}
function rewardProfile(price){
  return price>=10000000?'ULTRA':price>=1000000?'LEGEND':price>=100000?'EPIC':price>=10000?'RARE':'COMMON';
}
function rewardOptionAt(db,betId,multiplier){
  return db.prepare(`SELECT stage,multiplier,handle FROM crash_reward_options
    WHERE bet_id=? AND multiplier<=? ORDER BY stage DESC LIMIT 1`)
    .get(betId,Number(multiplier)+0.0000001)||
    db.prepare("SELECT stage,multiplier,handle FROM crash_reward_options WHERE bet_id=? ORDER BY stage LIMIT 1").get(betId);
}
export function crashRewardOption(options,multiplier){
  if(!Array.isArray(options)||!options.length)return null;
  let result=options[0];
  for(const option of options){if(option.multiplier<=Number(multiplier)+0.0000001)result=option;else break}
  return result;
}
function reserveRewardNames(db,betId,stakeValue){
  const existing=db.prepare("SELECT COUNT(*) n FROM crash_reward_options WHERE bet_id=?").get(betId)?.n||0;
  if(existing)return;
  const occupied=db.prepare(`SELECT 1 FROM username_templates WHERE handle=?
    UNION SELECT 1 FROM username_instances WHERE handle=?
    UNION SELECT 1 FROM crash_reward_options WHERE handle=? LIMIT 1`);
  const save=db.prepare('INSERT INTO crash_reward_options(bet_id,stage,multiplier,handle) VALUES(?,?,?,?)');
  for(let i=0;i<CRASH_REWARD_STAGES.length;i++){
    const threshold=CRASH_REWARD_STAGES[i];
    const profile=rewardProfile(crashRewardValue(stakeValue,threshold));
    let selected='';
    for(let attempt=0;attempt<190;attempt++){
      const handle=buildGeneratedHandle(profile,randomUnit);
      if(!isValidHandle(handle)||specialSet.has(handle)||occupied.get(handle,handle,handle))continue;
      selected=handle;break;
    }
    if(!selected)throw new Error('crash_reward_unavailable');
    save.run(betId,i,threshold,selected);
  }
}
function rewardReceipt(db,bet){
  const row=db.prepare('SELECT * FROM crash_wins WHERE bet_id=?').get(bet.id);
  return row?{id:row.instance_id,handle:'@'+row.handle,value:row.value,multiplier:row.multiplier}:null;
}
function crashTarget(seed){
  // 3% instantaneous house edge, then an approximately 1/x survival curve.
  const hash=crypto.createHash('sha256').update(seed).digest();
  const r=hash.readUIntBE(0,6)/2**48;
  return Math.max(1,Math.min(CRASH_MAX_X,Math.floor((0.97/(1-r))*100)/100));
}
const finishMs=(startAt,target)=>startAt+Math.ceil(Math.log(target)/CRASH_GROWTH*1000);
export function crashMultiplier(startAt,at=Date.now()){
  const s=Math.max(0,(at-startAt)/1000);
  return Math.max(1,Math.min(CRASH_MAX_X,Math.floor(Math.exp(s*CRASH_GROWTH)*100)/100));
}
function createRound(db,now){
  const seed=crypto.randomBytes(32).toString('hex');
  const commitment=crypto.createHash('sha256').update(seed).digest('hex');
  const target=crashTarget(seed),startAt=now+CRASH_WAIT_MS;
  const crashAt=finishMs(startAt,target);
  const result=db.prepare(`INSERT INTO crash_rounds
    (status,created_at,starts_at,crashes_at,crash_x,seed,commitment)
    VALUES ('waiting',?,?,?,?,?,?)`).run(now,startAt,crashAt,target,seed,commitment);
  return db.prepare('SELECT * FROM crash_rounds WHERE id=?').get(result.lastInsertRowid);
}
function settleLost(db,roundId,now){
  const bets=db.prepare("SELECT id,instance_id FROM crash_bets WHERE round_id=? AND status='staked'").all(roundId);
  for(const b of bets){
    db.prepare("UPDATE crash_bets SET status='lost',settled_at=? WHERE id=? AND status='staked'").run(now,b.id);
    db.prepare("UPDATE username_instances SET status='crash_lost' WHERE id=? AND status='crash_staked'").run(b.instance_id);
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(b.instance_id);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(b.instance_id);
    db.prepare('DELETE FROM crash_reward_options WHERE bet_id=?').run(b.id);
  }
}
function sync(db,now){
  let round=db.prepare("SELECT * FROM crash_rounds WHERE status IN ('waiting','running') ORDER BY id DESC LIMIT 1").get();
  if(!round)return createRound(db,now);
  if(now>=round.crashes_at){
    db.prepare("UPDATE crash_rounds SET status='crashed',ended_at=? WHERE id=? AND status IN ('waiting','running')").run(round.crashes_at,round.id);
    settleLost(db,round.id,round.crashes_at);
    // Start the next waiting period on the first process tick after the crash.
    return createRound(db,now);
  }
  if(round.status==='waiting'&&now>=round.starts_at){
    db.prepare("UPDATE crash_rounds SET status='running' WHERE id=? AND status='waiting'").run(round.id);
    round={...round,status:'running'};
  }
  return round;
}
export function syncCrashRound(db,now=Date.now()){
  return db.transaction(()=>sync(db,now))();
}
function publicRound(row,now){
  return {
    id:row.id,status:row.status,startsAt:row.starts_at,serverNow:now,
    maxMultiplier:CRASH_MAX_X,
    multiplier:row.status==='running'?crashMultiplier(row.starts_at,now):1,
    commitment:row.commitment
  };
}
function shapeBet(row){
  return row?{
    id:row.id,userId:row.user_id,player:row.first_name||row.username||'Игрок',
    handle:'@'+row.handle,value:row.value,status:row.status,
    cashoutX:row.cashout_x||null,win:0,settledAt:row.settled_at||null
  }:null;
}
export function crashState(db,user,now=Date.now()){
  return db.transaction(()=>{
    const round=sync(db,now);
    const last=db.prepare("SELECT id,crash_x,commitment,seed,ended_at FROM crash_rounds WHERE status='crashed' ORDER BY id DESC LIMIT 1").get();
    const bets=db.prepare(`SELECT b.*,i.handle,i.value,u.first_name,u.username
      FROM crash_bets b JOIN username_instances i ON i.id=b.instance_id JOIN users u ON u.id=b.user_id
      WHERE b.round_id=? ORDER BY b.created_at ASC LIMIT 100`).all(round.id).map(shapeBet);
    const my=bets.find(x=>x.userId===user.id)||null;
    const myAny=my||shapeBet(db.prepare(`SELECT b.*,i.handle,i.value,u.first_name,u.username
      FROM crash_bets b JOIN username_instances i ON i.id=b.instance_id JOIN users u ON u.id=b.user_id
      WHERE b.round_id=? AND b.user_id=?`).get(round.id,user.id));
    // Bets from an older deployed version can be upgraded in-place while staked.
    if(myAny?.status==='staked'){
      reserveRewardNames(db,myAny.id,myAny.value);
    }
    const myRewardPlan=myAny?.status==='staked'?
      db.prepare("SELECT multiplier,handle FROM crash_reward_options WHERE bet_id=? ORDER BY stage").all(myAny.id)
        .map(x=>({multiplier:x.multiplier,handle:'@'+x.handle})):[];
    const myWin=myAny?rewardReceipt(db,myAny):null;
    const available=db.prepare("SELECT id,handle,value FROM username_instances WHERE owner_id=? AND status='owned' ORDER BY value DESC LIMIT 100").all(user.id)
      .map(x=>({...x,handle:'@'+x.handle}));
    return {round:publicRound(round,now),last:last?{id:last.id,multiplier:last.crash_x,commitment:last.commitment,seed:last.seed,endedAt:last.ended_at}:null,
      bets,myBet:myAny,myRewardPlan,myWin,available,payoutCap:CRASH_MAX_PAYOUT};
  })();
}
export function placeCrashBet(db,user,instanceId,now=Date.now(),expectedRoundId=null){
  return db.transaction(()=>{
    const round=sync(db,now);
    if(Number(expectedRoundId===null?round.id:expectedRoundId)!==round.id)throw new Error('crash_round_changed');
    if(round.status!=='waiting'||now>=round.starts_at)throw new Error('crash_betting_closed');
    const existing=db.prepare('SELECT id,instance_id FROM crash_bets WHERE round_id=? AND user_id=?').get(round.id,user.id);
    if(existing){
      if(existing.instance_id===instanceId)return {ok:true,roundId:round.id,betId:existing.id,replayed:true};
      throw new Error('crash_already_bet');
    }
    const inst=db.prepare("SELECT id,handle,value FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);
    if(!inst)throw new Error('crash_item_unavailable');
    const changed=db.prepare("UPDATE username_instances SET status='crash_staked' WHERE id=? AND owner_id=? AND status='owned'").run(inst.id,user.id).changes;
    if(!changed)throw new Error('crash_item_unavailable');
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(inst.id);
    const result=db.prepare(`INSERT INTO crash_bets(round_id,user_id,instance_id,status,created_at)
      VALUES (?,?,?,'staked',?)`).run(round.id,user.id,inst.id,now);
    reserveRewardNames(db,Number(result.lastInsertRowid),inst.value);
    return {ok:true,roundId:round.id,betId:Number(result.lastInsertRowid),replayed:false};
  })();
}
export function cashoutCrash(db,user,now=Date.now(),expectedRoundId=null){
  return db.transaction(()=>{
    const round=sync(db,now);
    const roundId=expectedRoundId===null?round.id:Number(expectedRoundId);
    if(!Number.isSafeInteger(roundId)||roundId<=0)throw new Error('crash_round_changed');
    const bet=db.prepare('SELECT * FROM crash_bets WHERE round_id=? AND user_id=?').get(roundId,user.id);
    if(!bet)throw new Error('crash_no_bet');
    if(bet.status==='cashed'){
      const reward=rewardReceipt(db,bet);
      // Legacy money-based cashouts must stay idempotent after this migration.
      return {ok:true,multiplier:bet.cashout_x,reward,replayed:true,legacy:!reward};
    }
    if(roundId!==round.id||round.status!=='running'||bet.status!=='staked')throw new Error('crash_too_late');
    const item=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='crash_staked'").get(bet.instance_id,user.id);
    if(!item)throw new Error('crash_item_unavailable');
    reserveRewardNames(db,bet.id,item.value);
    const multiplier=crashMultiplier(round.starts_at,now);
    const option=rewardOptionAt(db,bet.id,multiplier);
    if(!option)throw new Error('crash_reward_unavailable');
    const value=crashRewardValue(item.value,multiplier);
    const assessment=analyzeUsername(option.handle);
    const rarity=rarityFromValue(value),score=assessment.score||0;
    const visual=visualTier(value,score),quality=JSON.stringify(assessment.breakdown||{});
    // The reward handle was uniquely reserved at stake time. A single SQLite
    // transaction consumes the source and mints the new asset, or rolls back.
    const template=db.prepare(`INSERT INTO username_templates
      (handle,rarity,base_value,max_supply,current_supply,category,special,active,username_score,visual_tier,quality_json,created_at)
      VALUES(?,?,?,?,1,'crash',0,1,?,?,?,?)`)
      .run(option.handle,rarity,value,1,score,visual,quality,nowIso());
    const id=uid(),created=nowIso();
    db.prepare(`INSERT INTO username_instances
      (id,template_id,handle,rarity,value,instance_number,max_supply,owner_id,status,obtained_at,obtained_type,username_score,visual_tier,quality_json)
      VALUES (?,?,?,?,?,1,1,?,'owned',?,'crash',?,?,?)`)
      .run(id,template.lastInsertRowid,option.handle,rarity,value,user.id,created,score,visual,quality);
    db.prepare('INSERT INTO inventory(instance_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,created);
    const changed=db.prepare("UPDATE crash_bets SET status='cashed',cashout_x=?,win_amount=0,settled_at=? WHERE id=? AND status='staked'")
      .run(multiplier,now,bet.id).changes;
    if(!changed)throw new Error('crash_too_late');
    db.prepare("UPDATE username_instances SET status='crash_exchanged' WHERE id=? AND status='crash_staked'").run(item.id);
    db.prepare('DELETE FROM inventory WHERE instance_id=?').run(item.id);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(item.id);
    db.prepare('INSERT INTO crash_wins(bet_id,instance_id,handle,value,multiplier,created_at) VALUES(?,?,?,?,?,?)')
      .run(bet.id,id,option.handle,value,multiplier,created);
    db.prepare('DELETE FROM crash_reward_options WHERE bet_id=?').run(bet.id);
    return {ok:true,multiplier,reward:{id,handle:'@'+option.handle,value,rarity,visual},replayed:false};
  })();
}
