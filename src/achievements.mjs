export function achievementsData(db,user){
  const drops=Number(db.prepare('SELECT COUNT(*) c FROM drop_history WHERE user_id=?').get(user.id)?.c||0);
  const owned=Number(db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status IN ('owned','market')").get(user.id)?.c||0);
  const purple=Number(db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND visual_tier='purple'").get(user.id)?.c||0);
  const gold=Number(db.prepare("SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND visual_tier='gold'").get(user.id)?.c||0);
  const lab=Number(db.prepare('SELECT COUNT(*) c FROM username_lab_attempts WHERE user_id=?').get(user.id)?.c||0);
  const deals=Number(db.prepare('SELECT COUNT(*) c FROM market_transactions WHERE buyer_id=? OR seller_id=?').get(user.id,user.id)?.c||0);
  const asset=Number(db.prepare("SELECT COALESCE(SUM(value),0) v FROM username_instances WHERE owner_id=? AND status IN ('owned','market')").get(user.id)?.v||0);
  const capital=Number(user.balance||0)+asset;
  const rows=[
    {key:'first_drop',title:'Первый улов',desc:'Открой первый drop',current:drops,target:1},
    {key:'collector',title:'Коллекционер',desc:'Собери 25 usernames',current:owned,target:25},
    {key:'purple',title:'Фиолетовый',desc:'Получи редкий фиолетовый username',current:purple,target:1},
    {key:'gold',title:'Золотой билет',desc:'Получи золотой username',current:gold,target:1},
    {key:'market',title:'Перекуп',desc:'Совершить 5 сделок на рынке',current:deals,target:5},
    {key:'lab100',title:'Автор',desc:'Оцени 100 usernames в Lab',current:lab,target:100},
    {key:'capital',title:'Магнат',desc:'Капитал $1,000,000',current:capital,target:1000000},
    {key:'level25',title:'Опытный',desc:'Достигни 25 уровня',current:Number(user.level||1),target:25}
  ].map(x=>({...x,current:Math.max(0,Number(x.current)||0),done:Number(x.current)>=Number(x.target)}));
  return {items:rows,completed:rows.filter(x=>x.done).length,total:rows.length};
}
