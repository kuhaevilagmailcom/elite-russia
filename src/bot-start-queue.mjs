/** Durable /start reply queue. Updates are acknowledged only after enqueueing.
 * Delivery is at-least-once: Telegram provides no exactly-once sendMessage API.
 */
export function enqueueStart(db,{updateId,chatId,firstName='',ref=''}) {
  if(!Number.isSafeInteger(Number(updateId))||Number(updateId)<0)throw new Error('bad_telegram_update_id');
  if(!Number.isSafeInteger(Number(chatId)))throw new Error('bad_telegram_chat_id');
  return db.prepare(`INSERT OR IGNORE INTO bot_start_outbox
    (update_id,chat_id,first_name,ref,status,attempts,next_attempt_at,created_at)
    VALUES (?,?,?,?,'pending',0,0,?)`)
    .run(Number(updateId),String(chatId),String(firstName).slice(0,100),String(ref).slice(0,150),Date.now()).changes>0;
}

export async function deliverStartBatch(db,deliver,{limit=5,clock=()=>Date.now()}={}){
  const rows=db.prepare(`SELECT update_id,chat_id,first_name,ref,attempts FROM bot_start_outbox
    WHERE status='pending' AND next_attempt_at<=? ORDER BY update_id LIMIT ?`).all(clock(),Math.min(20,Math.max(1,limit)));
  await Promise.all(rows.map(async row=>{
    try{
      await deliver(row);
      db.prepare("UPDATE bot_start_outbox SET status='sent',sent_at=?,last_error='' WHERE update_id=?")
        .run(clock(),row.update_id);
    }catch(e){
      const reason=String(e?.message||'telegram_send_error').slice(0,160);
      const denied=/bot was blocked|user is deactivated|chat not found|bot can't initiate conversation/i.test(reason);
      const attempts=row.attempts+1;
      const backoff=Math.min(120000,2000*2**Math.min(attempts-1,6));
      db.prepare(`UPDATE bot_start_outbox SET status=?,attempts=?,next_attempt_at=?,last_error=?
        WHERE update_id=?`).run(denied?'failed':'pending',attempts,denied?0:clock()+backoff,reason,row.update_id);
    }
  }));
  return rows.length;
}
