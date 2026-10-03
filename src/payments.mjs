export const PREMIUM_STARS=50;

export function parsePremiumPayload(payload){
  const m=String(payload||'').match(/^username_plus:(\d+):([0-9a-f-]{16,})$/i);
  return m?{telegramId:m[1],nonce:m[2]}:null;
}
export function validPremiumCheckout(q){
  const p=parsePremiumPayload(q?.invoice_payload);
  return !!(p&&String(q?.from?.id||'')===p.telegramId&&q?.currency==='XTR'&&Number(q?.total_amount)===PREMIUM_STARS);
}
export function applyPremiumPayment(db,message,payment){
  const parsed=parsePremiumPayload(payment?.invoice_payload);if(!parsed)return {applied:false,reason:'bad_payload'};
  if(String(message?.from?.id||'')!==parsed.telegramId||payment.currency!=='XTR'||Number(payment.total_amount)!==PREMIUM_STARS)return {applied:false,reason:'bad_payment'};
  const charge=String(payment.telegram_payment_charge_id||'');if(!charge)return {applied:false,reason:'missing_charge'};
  const user=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(parsed.telegramId);if(!user)return {applied:false,reason:'user_not_found'};
  return db.transaction(()=>{
    if(db.prepare('SELECT 1 FROM payments WHERE telegram_charge_id=?').get(charge))return {applied:false,duplicate:true,user};
    const current=user.premium_until?new Date(user.premium_until).getTime():0,base=Math.max(Date.now(),current),until=new Date(base+30*86400000).toISOString(),ts=new Date().toISOString();
    db.prepare('INSERT INTO payments(telegram_charge_id,provider_charge_id,user_id,payload,currency,total_amount,product,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(charge,String(payment.provider_payment_charge_id||''),user.id,payment.invoice_payload,payment.currency,payment.total_amount,'USERNAME_PLUS_30D',ts);
    db.prepare('UPDATE users SET premium_until=? WHERE id=?').run(until,user.id);
    db.prepare('INSERT INTO premium_subscriptions(user_id,active_until,source,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_until=excluded.active_until,source=excluded.source,created_at=excluded.created_at')
      .run(user.id,until,'telegram_stars',ts);
    return {applied:true,user,until};
  })();
}
