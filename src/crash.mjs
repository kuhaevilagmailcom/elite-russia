import crypto from 'node:crypto';
import {txBalance} from './economy.mjs';

// USERNAME Crash is a shared, server-authoritative virtual-item game.
// The staked username is locked before launch; cashing out returns the item
// plus virtual game currency. If the round crashes, the item is consumed.
// No Telegram Stars / cash transactions or withdrawal are involved.
export const CRASH_WAIT_MS=10000;
export const CRASH_MAX_X=1000;
export const CRASH_GROWTH=0.115; // log-multiplier gained per second
export const CRASH_MAX_PAYOUT=1_000_000_000;

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
    cashoutX:row.cashout_x||null,win:row.win_amount||0,settledAt:row.settled_at||null
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
    const available=db.prepare("SELECT id,handle,value FROM username_instances WHERE owner_id=? AND status='owned' ORDER BY value DESC LIMIT 100").all(user.id)
      .map(x=>({...x,handle:'@'+x.handle}));
    return {round:publicRound(round,now),last:last?{id:last.id,multiplier:last.crash_x,commitment:last.commitment,seed:last.seed,endedAt:last.ended_at}:null,bets,myBet:myAny,available,payoutCap:CRASH_MAX_PAYOUT};
  })();
}
export function placeCrashBet(db,user,instanceId,now=Date.now(),expectedRoundId=null){
  return db.transaction(()=>{
    const round=sync(db,now);
    if(Number(expectedRoundId||round.id)!==round.id)throw new Error('crash_round_changed');
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
    return {ok:true,roundId:round.id,betId:Number(result.lastInsertRowid),replayed:false};
  })();
}
export function cashoutCrash(db,user,now=Date.now(),expectedRoundId=null){
  return db.transaction(()=>{
    // Transition the round to crashed before checking whether a cashout
    // arrived in time. Client-sent multipliers or timestamps are never trusted.
    const round=sync(db,now);
    const roundId=expectedRoundId===null?round.id:Number(expectedRoundId);
    if(!Number.isSafeInteger(roundId)||roundId<=0)throw new Error('crash_round_changed');
    const bet=db.prepare('SELECT * FROM crash_bets WHERE round_id=? AND user_id=?').get(roundId,user.id);
    if(!bet)throw new Error('crash_no_bet');
    // Permit a safe replay of a completed cashout after round rollover.
    if(bet.status==='cashed')return {ok:true,multiplier:bet.cashout_x,win:bet.win_amount,replayed:true};
    if(roundId!==round.id||round.status!=='running'||bet.status!=='staked')throw new Error('crash_too_late');
    const item=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='crash_staked'").get(bet.instance_id,user.id);
    if(!item)throw new Error('crash_item_unavailable');
    const multiplier=crashMultiplier(round.starts_at,now);
    const win=Math.min(CRASH_MAX_PAYOUT,Math.floor(item.value*(multiplier-1)));
    const changed=db.prepare("UPDATE crash_bets SET status='cashed',cashout_x=?,win_amount=?,settled_at=? WHERE id=? AND status='staked'")
      .run(multiplier,win,now,bet.id).changes;
    if(!changed)throw new Error('crash_too_late');
    db.prepare("UPDATE username_instances SET status='owned' WHERE id=? AND status='crash_staked'").run(item.id);
    if(win>0)txBalance(db,user.id,'crash_win',win,{roundId:round.id,instanceId:item.id,multiplier});
    return {ok:true,multiplier,win,replayed:false};
  })();
}
