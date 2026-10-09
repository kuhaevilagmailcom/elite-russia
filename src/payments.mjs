export const PREMIUM_STARS=50;

export const SHOP_PRODUCTS=Object.freeze({
  gems_500:{key:'gems_500',title:'500 💎',description:'500 косметических кристаллов',stars:50,type:'gems',gems:500},
  gems_1100:{key:'gems_1100',title:'1 100 💎',description:'1 100 косметических кристаллов',stars:100,type:'gems',gems:1100},
  gems_3000:{key:'gems_3000',title:'3 000 💎',description:'3 000 косметических кристаллов',stars:250,type:'gems',gems:3000}
});

export const THEME_PRODUCTS=Object.freeze({
  ocean:{key:'ocean',title:'Океан',description:'Голубой акцент',gems:350,type:'theme'},
  violet:{key:'violet',title:'Фиолетовая',description:'Фиолетовый акцент',gems:350,type:'theme'},
  lime:{key:'lime',title:'Лайм',description:'Зелёный акцент',gems:350,type:'theme'},
  sunset:{key:'sunset',title:'Закат',description:'Тёплый оранжевый акцент',gems:350,type:'theme'},
  mono:{key:'mono',title:'Моно',description:'Чёрно-белый акцент',gems:350,type:'theme'}
});

function ensureWallet(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS currency_wallets(
      user_id INTEGER PRIMARY KEY,gems INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
    );
  `);
}
export function walletData(db,userId){
  ensureWallet(db);
  const row=db.prepare('SELECT gems FROM currency_wallets WHERE user_id=?').get(userId);
  return {gems:Number(row?.gems||0)};
}
export function grantGems(db,userId,amount){
  ensureWallet(db);const ts=new Date().toISOString(),add=Math.max(0,Math.round(Number(amount)||0));
  db.prepare(`INSERT INTO currency_wallets(user_id,gems,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET gems=gems+excluded.gems,updated_at=excluded.updated_at`).run(userId,add,ts);
  return walletData(db,userId);
}
function spendGems(db,userId,amount){
  ensureWallet(db);const cost=Math.max(0,Math.round(Number(amount)||0)),row=walletData(db,userId);
  if(row.gems<cost)throw new Error('insufficient_gems');
  db.prepare('UPDATE currency_wallets SET gems=gems-?,updated_at=? WHERE user_id=?').run(cost,new Date().toISOString(),userId);
  return walletData(db,userId);
}
export function shopCatalog(){
  return {
    gemPacks:Object.values(SHOP_PRODUCTS).map(x=>({...x})),
    themes:Object.values(THEME_PRODUCTS).map(x=>({...x}))
  };
}
export function parsePremiumPayload(){return null}
export function parseProductPayload(payload){
  const m=String(payload||'').match(/^username_shop:([a-z0-9_]+):(\d+):([0-9a-f-]{16,})$/i);
  return m&&SHOP_PRODUCTS[m[1]]?{productKey:m[1],telegramId:m[2],nonce:m[3]}:null;
}
export function validProductCheckout(q){
  const p=parseProductPayload(q?.invoice_payload),product=p&&SHOP_PRODUCTS[p.productKey];
  return !!(p&&product&&product.type==='gems'&&String(q?.from?.id||'')===p.telegramId&&q?.currency==='XTR'&&Number(q?.total_amount)===product.stars);
}
export function validPremiumCheckout(){return false}
export function applyProductPayment(db,message,payment){
  const parsed=parseProductPayload(payment?.invoice_payload),product=parsed&&SHOP_PRODUCTS[parsed.productKey];
  if(!parsed||!product||product.type!=='gems')return {applied:false,reason:'bad_payload'};
  if(String(message?.from?.id||'')!==parsed.telegramId||payment.currency!=='XTR'||Number(payment.total_amount)!==product.stars)return {applied:false,reason:'bad_payment'};
  const charge=String(payment.telegram_payment_charge_id||'');if(!charge)return {applied:false,reason:'missing_charge'};
  const user=db.prepare('SELECT * FROM users WHERE telegram_id=?').get(parsed.telegramId);if(!user)return {applied:false,reason:'user_not_found'};
  return db.transaction(()=>{
    if(db.prepare('SELECT 1 FROM payments WHERE telegram_charge_id=?').get(charge))return {applied:false,duplicate:true,user,product,wallet:walletData(db,user.id)};
    const ts=new Date().toISOString();
    db.prepare('INSERT INTO payments(telegram_charge_id,provider_charge_id,user_id,payload,currency,total_amount,product,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(charge,String(payment.provider_payment_charge_id||''),user.id,payment.invoice_payload,payment.currency,payment.total_amount,product.key,ts);
    const wallet=grantGems(db,user.id,product.gems);
    return {applied:true,user,product,wallet};
  })();
}
export function applyPremiumPayment(){return {applied:false,reason:'product_removed'}}
export function buyTheme(db,user,themeKey){
  ensureWallet(db);
  const theme=THEME_PRODUCTS[String(themeKey||'')];if(!theme)throw new Error('bad_product');
  return db.transaction(()=>{
    const existing=db.prepare("SELECT 1 FROM user_cosmetics WHERE user_id=? AND type='theme' AND key=?").get(user.id,theme.key);
    if(existing)return {ok:true,alreadyOwned:true,wallet:walletData(db,user.id),theme};
    const wallet=spendGems(db,user.id,theme.gems),ts=new Date().toISOString();
    db.prepare("INSERT INTO user_cosmetics(user_id,type,key,source,created_at) VALUES(?,'theme',?,'gems',?)").run(user.id,theme.key,ts);
    return {ok:true,alreadyOwned:false,wallet,theme};
  }).immediate();
}
