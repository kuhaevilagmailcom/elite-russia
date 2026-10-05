export const PREMIUM_STARS=50;

export const SHOP_PRODUCTS=Object.freeze({
  plus_30:{key:'plus_30',title:'USERNAME+',description:'USERNAME+ на 30 дней',stars:50,type:'subscription',grant:'premium_30d'},
  theme_ocean:{key:'theme_ocean',title:'Тема Ocean',description:'Голубой accent-пак для интерфейса',stars:15,type:'theme',grant:'ocean'},
  theme_violet:{key:'theme_violet',title:'Тема Violet',description:'Фиолетовый accent-пак для интерфейса',stars:15,type:'theme',grant:'violet'},
  frame_gold:{key:'frame_gold',title:'Gold Frame',description:'Золотая рамка профиля',stars:20,type:'frame',grant:'gold'},
  frame_purple:{key:'frame_purple',title:'Purple Frame',description:'Фиолетовая рамка профиля',stars:15,type:'frame',grant:'purple'},
  card_minimal:{key:'card_minimal',title:'Clean Cards',description:'Минималистичное оформление карточек',stars:10,type:'card',grant:'minimal'},
  showcase_plus2:{key:'showcase_plus2',title:'+2 витрины',description:'Два дополнительных слота витрины навсегда',stars:20,type:'showcase',grant:'plus2'}
});
export function shopCatalog(){
  return Object.values(SHOP_PRODUCTS).map(({key,title,description,stars,type,grant})=>({key,title,description,stars,type,grant}));
}
export function parsePremiumPayload(payload){
  const m=String(payload||'').match(/^username_plus:(\d+):([0-9a-f-]{16,})$/i);
  return m?{telegramId:m[1],nonce:m[2],productKey:'plus_30'}:null;
}
export function parseProductPayload(payload){
  const legacy=parsePremiumPayload(payload);if(legacy)return legacy;
  const m=String(payload||'').match(/^username_shop:([a-z0-9_]+):(\d+):([0-9a-f-]{16,})$/i);
  return m&&SHOP_PRODUCTS[m[1]]?{productKey:m[1],telegramId:m[2],nonce:m[3]}:null;
}
export function validProductCheckout(q){
  const p=parseProductPayload(q?.invoice_payload),product=p&&SHOP_PRODUCTS[p.productKey];
  return !!(p&&product&&String(q?.from?.id||'')===p.telegramId&&q?.currency==='XTR'&&Number(q?.total_amount)===product.stars);
}
export function validPremiumCheckout(q){
  const p=parseProductPayload(q?.invoice_payload);
  return !!(p&&p.productKey==='plus_30'&&validProductCheckout(q));
}
function grantProduct(db,user,product,ts){
  if(product.grant==='premium_30d'){
    const current=user.premium_until?new Date(user.premium_until).getTime():0,base=Math.max(Date.now(),current),until=new Date(base+30*86400000).toISOString();
    db.prepare('UPDATE users SET premium_until=? WHERE id=?').run(until,user.id);
    db.prepare('INSERT INTO premium_subscriptions(user_id,active_until,source,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active_until=excluded.active_until,source=excluded.source,created_at=excluded.created_at')
      .run(user.id,until,'telegram_stars',ts);
    return {until};
  }
  db.prepare('INSERT OR IGNORE INTO user_cosmetics(user_id,type,key,source,created_at) VALUES(?,?,?,?,?)')
    .run(user.id,product.type,product.grant,'telegram_stars',ts);
  return {cosmetic:{type:product.type,key:product.grant}};
}
export function applyProductPayment(db,message,payment){
  const parsed=parseProductPayload(payment?.invoice_payload),product=parsed&&SHOP_PRODUCTS[parsed.productKey];if(!parsed||!product)return {applied:false,reason:'bad_payload'};
  if(String(message?.from?.id||'')!==parsed.telegramId||payment.currency!=='XTR'||Number(payment.total_amount)!==product.stars)return {applied:false,reason:'bad_payment'};
  const charge=String(payment.telegram_payment_charge_id||'');if(!charge)return {applied:false,reason:'missing_charge'};
  const user=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(parsed.telegramId);if(!user)return {applied:false,reason:'user_not_found'};
  return db.transaction(()=>{
    if(db.prepare('SELECT 1 FROM payments WHERE telegram_charge_id=?').get(charge))return {applied:false,duplicate:true,user,product};
    const ts=new Date().toISOString();
    db.prepare('INSERT INTO payments(telegram_charge_id,provider_charge_id,user_id,payload,currency,total_amount,product,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(charge,String(payment.provider_payment_charge_id||''),user.id,payment.invoice_payload,payment.currency,payment.total_amount,product.key,ts);
    const grant=grantProduct(db,user,product,ts);
    return {applied:true,user,product,...grant};
  })();
}
export function applyPremiumPayment(db,message,payment){
  const parsed=parseProductPayload(payment?.invoice_payload);
  if(!parsed||parsed.productKey!=='plus_30')return {applied:false,reason:'bad_payload'};
  return applyProductPayment(db,message,payment);
}
