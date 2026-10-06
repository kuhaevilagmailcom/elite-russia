import {grantXp} from './progression.mjs';

function ensureSchema(db){
  db.exec(`CREATE TABLE IF NOT EXISTS achievement_unlocks(
    user_id INTEGER NOT NULL,achievement_key TEXT NOT NULL,xp_reward INTEGER NOT NULL DEFAULT 0,unlocked_at TEXT NOT NULL,
    PRIMARY KEY(user_id,achievement_key)
  );`);
}
function stat(db,sql,...args){
  const row=db.prepare(sql).get(...args)||{};
  return Number(row.v??row.c??0);
}
function rowsFor(db,user){
  const drops=stat(db,'SELECT COUNT(*) c FROM drop_history WHERE user_id=?',user.id);
  const owned=stat(db,"SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status IN ('owned','market')",user.id);
  const purple=stat(db,"SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND visual_tier='purple'",user.id);
  const gold=stat(db,"SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND visual_tier='gold'",user.id);
  const noDigits=stat(db,"SELECT COUNT(*) c FROM username_instances WHERE owner_id=? AND status IN ('owned','market') AND handle NOT GLOB '*[0-9]*'",user.id);
  const deals=stat(db,'SELECT COUNT(*) c FROM market_transactions WHERE buyer_id=? OR seller_id=?',user.id,user.id);
  const sales=stat(db,'SELECT COUNT(*) c FROM market_transactions WHERE seller_id=?',user.id);
  const gifts=stat(db,"SELECT COUNT(*) c FROM username_transfers WHERE from_user_id=? AND type='gift'",user.id);
  const games=stat(db,'SELECT COUNT(*) c FROM mini_game_records WHERE user_id=?',user.id);
  const gameBest=stat(db,'SELECT COALESCE(MAX(score),0) v FROM mini_game_records WHERE user_id=?',user.id);
  const asset=stat(db,"SELECT COALESCE(SUM(value),0) v FROM username_instances WHERE owner_id=? AND status IN ('owned','market')",user.id);
  const capital=Number(user.balance||0)+asset,level=Number(user.level||1);
  return [
    {key:'first_drop',category:'Коллекция',icon:'package',title:'Первый улов',desc:'Открыть первый дроп',current:drops,target:1,xp:25},
    {key:'collector10',category:'Коллекция',icon:'layers-01',title:'Полка',desc:'Собрать 10 юзернеймов',current:owned,target:10,xp:40},
    {key:'collector50',category:'Коллекция',icon:'layers-01',title:'Коллекционер',desc:'Собрать 50 юзернеймов',current:owned,target:50,xp:100},
    {key:'clean10',category:'Коллекция',icon:'sparkles',title:'Чистая десятка',desc:'10 юзернеймов без цифр',current:noDigits,target:10,xp:70},
    {key:'purple',category:'Редкости',icon:'diamond-02',title:'Фиолетовый',desc:'Получить фиолетовый юзернейм',current:purple,target:1,xp:50},
    {key:'gold',category:'Редкости',icon:'award-01',title:'Золотой билет',desc:'Получить золотой юзернейм',current:gold,target:1,xp:100},
    {key:'gold3',category:'Редкости',icon:'award-01',title:'Золотой запас',desc:'Получить 3 золотых юзернейма',current:gold,target:3,xp:180},
    {key:'deal1',category:'Торговля',icon:'store-01',title:'Первая сделка',desc:'Совершить сделку',current:deals,target:1,xp:25},
    {key:'deal10',category:'Торговля',icon:'store-01',title:'На рынке',desc:'Совершить 10 сделок',current:deals,target:10,xp:80},
    {key:'sales25',category:'Торговля',icon:'chart-up',title:'Продавец',desc:'Сделать 25 продаж',current:sales,target:25,xp:150},
    {key:'gift5',category:'Торговля',icon:'gift',title:'Щедрый',desc:'Передать 5 usernames',current:gifts,target:5,xp:70},
    {key:'game1',category:'Игры',icon:'game',title:'Разминка',desc:'Сыграть мини-игру',current:games,target:1,xp:20},
    {key:'game25',category:'Игры',icon:'game',title:'Игрок',desc:'Сыграть 25 мини-игр',current:games,target:25,xp:100},
    {key:'streak5',category:'Игры',icon:'fire',title:'Серия',desc:'Получить результат 5',current:gameBest,target:5,xp:80},
    {key:'capital1m',category:'Прогресс',icon:'money-bag-02',title:'Миллион',desc:'Капитал 1M ₽',current:capital,target:1000000,xp:150},
    {key:'level50',category:'Прогресс',icon:'medal-01',title:'Мастер',desc:'Достичь 50 уровня',current:level,target:50,xp:120},
    {key:'level100',category:'Прогресс',icon:'medal-01',title:'Ветеран',desc:'Достичь 100 уровня',current:level,target:100,xp:250},
    {key:'level200',category:'Прогресс',icon:'crown',title:'Легендарный',desc:'Достичь 200 уровня',current:level,target:200,xp:500}
  ].map(x=>({...x,current:Math.max(0,Number(x.current)||0),done:Number(x.current)>=Number(x.target)}));
}
export function achievementsData(db,user){
  ensureSchema(db);
  const rows=rowsFor(db,user),unlocked=new Set(db.prepare('SELECT achievement_key FROM achievement_unlocks WHERE user_id=?').all(user.id).map(x=>x.achievement_key));
  return {items:rows.map(x=>({...x,unlocked:unlocked.has(x.key)})),completed:rows.filter(x=>x.done&&unlocked.has(x.key)).length,total:rows.length};
}
export function reconcileAchievements(db,user){
  ensureSchema(db);
  const rows=rowsFor(db,user),unlock=db.prepare('INSERT OR IGNORE INTO achievement_unlocks(user_id,achievement_key,xp_reward,unlocked_at) VALUES(?,?,?,?)');
  for(const a of rows){
    if(!a.done)continue;
    const changes=unlock.run(user.id,a.key,a.xp,new Date().toISOString()).changes;
    if(changes)grantXp(db,user.id,a.xp,'achievement',{key:a.key});
  }
  return achievementsData(db,{...user,...db.prepare('SELECT * FROM users WHERE id=?').get(user.id)});
}
