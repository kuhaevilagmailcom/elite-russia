import {GAME} from './config.mjs';
import {uid,nowIso,txBalance,bumpTask,bumpSeasonScore,collectionLimit} from './economy.mjs';

function shape(r){return {
  id:r.id,instanceId:r.instance_id,handle:'@'+r.handle,rarity:r.rarity,value:r.value,
  instanceNumber:r.instance_number,maxSupply:r.max_supply,price:r.price,sellerId:r.seller_id,
  sellerName:r.seller_name||r.seller_username||'Игрок',createdAt:r.created_at
}}
export function listMarket(db,{rarity='ALL',sort='new',q='',page=1}={}){
  const where=["l.status='active'"],args=[];
  if(rarity!=='ALL'){where.push('i.rarity=?');args.push(rarity)}
  if(q){where.push('i.handle LIKE ?');args.push('%'+String(q).toLowerCase().replace(/^@/,'').slice(0,30)+'%')}
  const order={
    new:'l.created_at DESC',cheap:'l.price ASC',expensive:'l.price DESC',
    rare:"CASE i.rarity WHEN 'ULTRA' THEN 5 WHEN 'LEGEND' THEN 4 WHEN 'EPIC' THEN 3 WHEN 'RARE' THEN 2 ELSE 1 END DESC,l.price DESC",
    short:'LENGTH(i.handle) ASC,l.price DESC'
  }[sort]||'l.created_at DESC';
  const size=8,p=Math.max(1,Number(page)||1),off=(p-1)*size;
  const base=`FROM market_listings l JOIN username_instances i ON i.id=l.instance_id JOIN users u ON u.id=l.seller_id WHERE ${where.join(' AND ')}`;
  const rows=db.prepare(`SELECT l.id,l.instance_id,l.seller_id,l.price,l.created_at,i.handle,i.rarity,i.value,i.instance_number,i.max_supply,u.first_name seller_name,u.username seller_username ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,size,off).map(shape);
  const total=db.prepare(`SELECT COUNT(*) c ${base}`).get(...args).c;
  return {items:rows,total,page:p,pages:Math.max(1,Math.ceil(total/size)),fee:GAME.marketFee};
}
export function createListing(db,user,instanceId,price){
  price=Math.round(Number(price)||0);if(price<100||price>1000000000)throw new Error('bad_price');
  const run=db.transaction(()=>{
    const inst=db.prepare("SELECT * FROM username_instances WHERE id=? AND owner_id=? AND status='owned'").get(instanceId,user.id);if(!inst)throw new Error('not_owned');
    if(db.prepare("SELECT 1 FROM market_listings WHERE instance_id=? AND status='active'").get(instanceId))throw new Error('already_listed');
    const id=uid();db.prepare('INSERT INTO market_listings(id,instance_id,seller_id,price,status,created_at) VALUES(?,?,?,?,?,?)').run(id,instanceId,user.id,price,'active',nowIso());
    db.prepare("UPDATE username_instances SET status='market' WHERE id=?").run(instanceId);
    db.prepare('DELETE FROM profile_showcase WHERE instance_id=?').run(instanceId);
    return id;
  });
  return {ok:true,id:run(),price,fee:Math.round(price*GAME.marketFee),net:Math.round(price*(1-GAME.marketFee))};
}
export function cancelListing(db,user,listingId){
  const run=db.transaction(()=>{
    const l=db.prepare("SELECT * FROM market_listings WHERE id=? AND seller_id=? AND status='active'").get(listingId,user.id);if(!l)throw new Error('listing_not_found');
    db.prepare("UPDATE market_listings SET status='cancelled',closed_at=? WHERE id=?").run(nowIso(),listingId);
    db.prepare("UPDATE username_instances SET status='owned' WHERE id=? AND owner_id=?").run(l.instance_id,user.id);
  });run();return {ok:true};
}
export function buyListing(db,buyer,listingId){
  const result=db.transaction(()=>{
    const l=db.prepare(`SELECT l.*,i.handle,i.rarity,i.value,i.owner_id FROM market_listings l JOIN username_instances i ON i.id=l.instance_id WHERE l.id=? AND l.status='active'`).get(listingId);
    if(!l)throw new Error('listing_not_found');if(l.seller_id===buyer.id)throw new Error('own_listing');
    const freshBuyer=db.prepare('SELECT * FROM users WHERE id=?').get(buyer.id);
    const count=db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status='owned'").get(buyer.id).c;
    if(count>=collectionLimit(freshBuyer))throw new Error('collection_full');if(freshBuyer.balance<l.price)throw new Error('insufficient_funds');
    const fee=Math.round(l.price*GAME.marketFee),sellerNet=l.price-fee;
    txBalance(db,buyer.id,'market_buy',-l.price,{listingId,instanceId:l.instance_id});
    txBalance(db,l.seller_id,'market_sale',sellerNet,{listingId,instanceId:l.instance_id,fee});
    db.prepare("UPDATE market_listings SET status='sold',buyer_id=?,closed_at=? WHERE id=? AND status='active'").run(buyer.id,nowIso(),listingId);
    db.prepare("UPDATE username_instances SET owner_id=?,status='owned' WHERE id=? AND owner_id=?").run(buyer.id,l.instance_id,l.seller_id);
    db.prepare('UPDATE inventory SET user_id=? WHERE instance_id=?').run(buyer.id,l.instance_id);
    db.prepare('INSERT INTO market_transactions(id,listing_id,instance_id,seller_id,buyer_id,price,fee,created_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),listingId,l.instance_id,l.seller_id,buyer.id,l.price,fee,nowIso());
    bumpTask(db,buyer.id,'market_buy',1);bumpTask(db,l.seller_id,'sell',1);bumpSeasonScore(db,buyer.id,20);bumpSeasonScore(db,l.seller_id,12);
    return {handle:'@'+l.handle,price:l.price,fee,sellerNet};
  })();
  return {ok:true,...result};
}
