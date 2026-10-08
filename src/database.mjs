import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {GAME} from './config.mjs';
import {SPECIALS,stableScoreHandle,rarityFromValue} from './generator.mjs';
import {analyzeUsername,visualTier} from './valuation.mjs';

export function createDatabase(dataDir){
  fs.mkdirSync(dataDir,{recursive:true});
  const dbPath=path.join(dataDir,'username.sqlite'),existed=fs.existsSync(dbPath);
  const db=new Database(dbPath);
  db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 3000');
  if(existed){
    const backupDir=path.join(dataDir,'backups');fs.mkdirSync(backupDir,{recursive:true});
    const stamp=new Date().toISOString().slice(0,10),backupPath=path.join(backupDir,'pre-migration-'+stamp+'.sqlite');
    if(!fs.existsSync(backupPath)){
      const escaped=backupPath.replace(/'/g,"''");
      db.exec("VACUUM INTO '"+escaped+"'");
    }
  }
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT UNIQUE NOT NULL, username TEXT, first_name TEXT,
    balance INTEGER NOT NULL DEFAULT ${GAME.startBalance}, free_drops INTEGER NOT NULL DEFAULT ${GAME.freeDrops},
    level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0,
    luck_points INTEGER NOT NULL DEFAULT 0, bad_drop_streak INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0, best_drop_value INTEGER NOT NULL DEFAULT 0,
    daily_streak INTEGER NOT NULL DEFAULT 0, last_daily_date TEXT,
    premium_until TEXT, created_at TEXT NOT NULL, last_seen TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS username_templates(
    id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT UNIQUE NOT NULL, rarity TEXT NOT NULL, base_value INTEGER NOT NULL,
    max_supply INTEGER NOT NULL, current_supply INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT 'generated',
    special INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, season_id INTEGER,
    username_score INTEGER NOT NULL DEFAULT 0, visual_tier TEXT NOT NULL DEFAULT 'normal', quality_json TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS username_instances(
    id TEXT PRIMARY KEY, template_id INTEGER NOT NULL, handle TEXT NOT NULL, rarity TEXT NOT NULL, value INTEGER NOT NULL,
    instance_number INTEGER NOT NULL, max_supply INTEGER NOT NULL, owner_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    obtained_at TEXT NOT NULL, obtained_type TEXT NOT NULL DEFAULT 'drop', season_id INTEGER,
    username_score INTEGER NOT NULL DEFAULT 0, visual_tier TEXT NOT NULL DEFAULT 'normal', quality_json TEXT,
    FOREIGN KEY(template_id) REFERENCES username_templates(id), FOREIGN KEY(owner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS inventory(instance_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(instance_id) REFERENCES username_instances(id),FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS drop_requests(request_id TEXT NOT NULL,user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,cost INTEGER NOT NULL,tier TEXT NOT NULL DEFAULT 'basic',created_at TEXT NOT NULL,PRIMARY KEY(request_id,user_id));
  CREATE TABLE IF NOT EXISTS drop_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,handle TEXT NOT NULL,rarity TEXT NOT NULL,value INTEGER NOT NULL,action TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS balance_transactions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,type TEXT NOT NULL,amount INTEGER NOT NULL,balance_before INTEGER NOT NULL,balance_after INTEGER NOT NULL,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS task_progress(user_id INTEGER NOT NULL,progress_date TEXT NOT NULL,task_key TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,progress_date,task_key));
  CREATE TABLE IF NOT EXISTS task_claims(user_id INTEGER NOT NULL,claim_date TEXT NOT NULL,task_key TEXT NOT NULL,PRIMARY KEY(user_id,claim_date,task_key));
  CREATE TABLE IF NOT EXISTS xp_history(
    id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,amount INTEGER NOT NULL,reason TEXT NOT NULL,metadata TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS level_reward_claims(
    user_id INTEGER NOT NULL,level INTEGER NOT NULL,claimed_at TEXT NOT NULL,PRIMARY KEY(user_id,level)
  );
  CREATE TABLE IF NOT EXISTS currency_wallets(
    user_id INTEGER PRIMARY KEY,gems INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS achievement_unlocks(
    user_id INTEGER NOT NULL,achievement_key TEXT NOT NULL,xp_reward INTEGER NOT NULL DEFAULT 0,unlocked_at TEXT NOT NULL,
    PRIMARY KEY(user_id,achievement_key)
  );
  CREATE TABLE IF NOT EXISTS mini_game_sessions(
    id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,game_key TEXT NOT NULL,payload_json TEXT NOT NULL,state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,expires_at TEXT NOT NULL,finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS mini_game_records(
    id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,game_key TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,
    reward INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 0,metadata TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mini_game_daily_earnings(
    user_id INTEGER NOT NULL,earning_date TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,plays INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,earning_date)
  );
  CREATE TABLE IF NOT EXISTS username_lab_attempts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,attempt_date TEXT NOT NULL,handle TEXT NOT NULL,fingerprint TEXT NOT NULL,
    theme TEXT NOT NULL,score INTEGER NOT NULL,reward INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,handle)
  );
  CREATE TABLE IF NOT EXISTS profile_showcase(user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(user_id,position),UNIQUE(user_id,instance_id));
  CREATE TABLE IF NOT EXISTS season_history(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,position INTEGER,score INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,season_id));
  CREATE TABLE IF NOT EXISTS premium_subscriptions(user_id INTEGER PRIMARY KEY,active_until TEXT,source TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,admin_id INTEGER NOT NULL,action TEXT NOT NULL,target TEXT,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notifications(
    id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,type TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',
    page TEXT NOT NULL DEFAULT '',read_at TEXT,created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS promo_codes(
    code TEXT PRIMARY KEY,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,max_uses INTEGER NOT NULL DEFAULT 0,
    uses INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,expires_at TEXT,created_by INTEGER,created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS promo_redemptions(
    code TEXT NOT NULL,user_id INTEGER NOT NULL,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,redeemed_at TEXT NOT NULL,
    PRIMARY KEY(code,user_id),FOREIGN KEY(code) REFERENCES promo_codes(code),FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS payments(
    telegram_charge_id TEXT PRIMARY KEY,provider_charge_id TEXT,user_id INTEGER NOT NULL,payload TEXT NOT NULL,
    currency TEXT NOT NULL,total_amount INTEGER NOT NULL,product TEXT NOT NULL,created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_cosmetics(
    user_id INTEGER NOT NULL,type TEXT NOT NULL,key TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,
    PRIMARY KEY(user_id,type,key)
  );
  CREATE TABLE IF NOT EXISTS user_cosmetic_settings(
    user_id INTEGER PRIMARY KEY,theme_key TEXT,frame_key TEXT,card_key TEXT,updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS runtime_locks(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS api_rate_limits(rate_key TEXT PRIMARY KEY,started_at INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS market_listings(id TEXT PRIMARY KEY,instance_id TEXT NOT NULL,seller_id INTEGER NOT NULL,buyer_id INTEGER,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,closed_at TEXT);
  CREATE TABLE IF NOT EXISTS market_transactions(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,instance_id TEXT NOT NULL,seller_id INTEGER NOT NULL,buyer_id INTEGER NOT NULL,price INTEGER NOT NULL,fee INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS referrals(id TEXT PRIMARY KEY,referrer_id INTEGER NOT NULL,referred_id INTEGER UNIQUE NOT NULL,created_at TEXT NOT NULL,activated_at TEXT);
  CREATE TABLE IF NOT EXISTS friends(user_id INTEGER NOT NULL,friend_id INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,friend_id));
  CREATE TABLE IF NOT EXISTS referral_rewards(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,reward_key TEXT NOT NULL,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,reward_key));
  CREATE TABLE IF NOT EXISTS username_transfers(id TEXT PRIMARY KEY,instance_id TEXT NOT NULL,from_user_id INTEGER NOT NULL,to_user_id INTEGER NOT NULL,type TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS wheel_claims(user_id INTEGER PRIMARY KEY,last_claim_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS wheel_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,request_id TEXT NOT NULL,reward_key TEXT NOT NULL,reward_label TEXT NOT NULL,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,request_id));
  CREATE TABLE IF NOT EXISTS upgrade_progress(user_id INTEGER PRIMARY KEY,points INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS upgrade_sessions(
    id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,source_ids TEXT NOT NULL,target_template_id INTEGER NOT NULL,
    target_handle TEXT NOT NULL,target_rarity TEXT NOT NULL,target_value INTEGER NOT NULL,chance REAL NOT NULL,
    from_rarity TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS upgrade_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,request_id TEXT,source_ids TEXT NOT NULL,target_instance_id TEXT NOT NULL,from_rarity TEXT NOT NULL,to_rarity TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS season_stats(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,score INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,season_id));
  CREATE TABLE IF NOT EXISTS season_rewards(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,reward_key TEXT NOT NULL,claimed_at TEXT,PRIMARY KEY(user_id,season_id,reward_key));
  CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS event_templates(event_id INTEGER NOT NULL,template_id INTEGER NOT NULL,PRIMARY KEY(event_id,template_id));
  CREATE INDEX IF NOT EXISTS idx_instances_owner ON username_instances(owner_id,status,obtained_at);
  CREATE INDEX IF NOT EXISTS idx_instances_owner_status_value ON username_instances(owner_id,status,value DESC);
  CREATE INDEX IF NOT EXISTS idx_drop_user ON drop_history(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON balance_transactions(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_market_status ON market_listings(status,created_at);
  CREATE INDEX IF NOT EXISTS idx_market_status_price ON market_listings(status,price,created_at);
  CREATE INDEX IF NOT EXISTS idx_market_instance_status ON market_listings(instance_id,status);
  CREATE INDEX IF NOT EXISTS idx_templates_handle ON username_templates(handle);
  CREATE INDEX IF NOT EXISTS idx_instances_handle_status ON username_instances(handle,status);
  CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id,status);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id,friend_id);
  CREATE INDEX IF NOT EXISTS idx_transfer_from ON username_transfers(from_user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_wheel_user ON wheel_history(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_season_score ON season_stats(season_id,score DESC);
  CREATE INDEX IF NOT EXISTS idx_upgrade_sessions_user ON upgrade_sessions(user_id,expires_at,used_at);
  CREATE INDEX IF NOT EXISTS idx_lab_user_day ON username_lab_attempts(user_id,attempt_date,created_at);
  CREATE INDEX IF NOT EXISTS idx_xp_history_user ON xp_history(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_minigame_records_user ON mini_game_records(user_id,game_key,created_at);
  CREATE INDEX IF NOT EXISTS idx_minigame_sessions_user ON mini_game_sessions(user_id,game_key,expires_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,read_at,created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_promo_active ON promo_codes(active,expires_at);
  CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id,redeemed_at DESC);
  `);
  const paymentCols=new Set(db.prepare('PRAGMA table_info(payments)').all().map(x=>x.name));
  if(!paymentCols.has('refunded_at'))db.exec('ALTER TABLE payments ADD COLUMN refunded_at TEXT');
  if(!paymentCols.has('refund_started_at'))db.exec('ALTER TABLE payments ADD COLUMN refund_started_at TEXT');
  if(!paymentCols.has('refund_recovered_gems'))db.exec('ALTER TABLE payments ADD COLUMN refund_recovered_gems INTEGER NOT NULL DEFAULT 0');
  if(!paymentCols.has('refund_shortfall_gems'))db.exec('ALTER TABLE payments ADD COLUMN refund_shortfall_gems INTEGER NOT NULL DEFAULT 0');
  const userCols=new Set(db.prepare('PRAGMA table_info(users)').all().map(x=>x.name));
  if(!userCols.has('luck_points'))db.exec("ALTER TABLE users ADD COLUMN luck_points INTEGER NOT NULL DEFAULT 0");
  if(!userCols.has('bad_drop_streak'))db.exec("ALTER TABLE users ADD COLUMN bad_drop_streak INTEGER NOT NULL DEFAULT 0");
  if(!userCols.has('total_earned'))db.exec("ALTER TABLE users ADD COLUMN total_earned INTEGER NOT NULL DEFAULT 0");
  if(!userCols.has('best_drop_value'))db.exec("ALTER TABLE users ADD COLUMN best_drop_value INTEGER NOT NULL DEFAULT 0");
  if(!userCols.has('daily_streak'))db.exec("ALTER TABLE users ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0");
  if(!userCols.has('last_daily_date'))db.exec("ALTER TABLE users ADD COLUMN last_daily_date TEXT");
  const templateCols=new Set(db.prepare('PRAGMA table_info(username_templates)').all().map(x=>x.name));
  if(!templateCols.has('username_score'))db.exec("ALTER TABLE username_templates ADD COLUMN username_score INTEGER NOT NULL DEFAULT 0");
  if(!templateCols.has('visual_tier'))db.exec("ALTER TABLE username_templates ADD COLUMN visual_tier TEXT NOT NULL DEFAULT 'normal'");
  if(!templateCols.has('quality_json'))db.exec("ALTER TABLE username_templates ADD COLUMN quality_json TEXT");
  const instanceCols=new Set(db.prepare('PRAGMA table_info(username_instances)').all().map(x=>x.name));
  if(!instanceCols.has('username_score'))db.exec("ALTER TABLE username_instances ADD COLUMN username_score INTEGER NOT NULL DEFAULT 0");
  if(!instanceCols.has('visual_tier'))db.exec("ALTER TABLE username_instances ADD COLUMN visual_tier TEXT NOT NULL DEFAULT 'normal'");
  if(!instanceCols.has('quality_json'))db.exec("ALTER TABLE username_instances ADD COLUMN quality_json TEXT");
  const dropCols=new Set(db.prepare('PRAGMA table_info(drop_requests)').all().map(x=>x.name));
  if(!dropCols.has('tier'))db.exec("ALTER TABLE drop_requests ADD COLUMN tier TEXT NOT NULL DEFAULT 'basic'");
  const upgradeCols=new Set(db.prepare('PRAGMA table_info(upgrade_history)').all().map(x=>x.name));
  if(!upgradeCols.has('success'))db.exec("ALTER TABLE upgrade_history ADD COLUMN success INTEGER NOT NULL DEFAULT 1");
  if(!upgradeCols.has('request_id'))db.exec("ALTER TABLE upgrade_history ADD COLUMN request_id TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_upgrade_request ON upgrade_history(user_id,request_id) WHERE request_id IS NOT NULL");
  const now=new Date().toISOString();
  const cfg=db.prepare('INSERT OR IGNORE INTO game_config(key,value) VALUES(?,?)');
  cfg.run('drop_cost',String(GAME.dropCost));cfg.run('market_fee',String(GAME.marketFee));
  if(!db.prepare('SELECT 1 FROM seasons WHERE active=1 LIMIT 1').get()){
    const end=new Date(Date.now()+GAME.seasonDays*86400000).toISOString();
    db.prepare('INSERT INTO seasons(name,start_at,end_at,active) VALUES(?,?,?,1)').run('Season 1',now,end);
  }
  const cfgUpsert=db.prepare('INSERT INTO game_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  cfgUpsert.run('drop_cost',String(GAME.dropCost));
  cfgUpsert.run('market_fee',String(GAME.marketFee));
  cfgUpsert.run('system_sell_rate',String(GAME.systemSellRate||0.35));

  const specialUpsert=db.prepare(`INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,season_id,created_at)
    VALUES(?,?,?,?,0,?,1,1,NULL,?)
    ON CONFLICT(handle) DO UPDATE SET
      rarity=excluded.rarity,base_value=excluded.base_value,
      max_supply=1,
      category=excluded.category,special=1,active=1`);
  for(const [handle,rarity,value,supply,category] of SPECIALS)specialUpsert.run(handle,rarity,value,supply,category,now);

  const migrated=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('2.7.0-revalue');
  if(!migrated){
    const specials=new Map(SPECIALS.map(x=>[x[0],x]));
    const rows=db.prepare("SELECT id,handle,rarity,value,instance_number,max_supply,status FROM username_instances WHERE status IN ('pending','owned','market')").all();
    const upd=db.prepare('UPDATE username_instances SET value=? WHERE id=?');
    const tx=db.transaction(()=>{
      for(const r of rows){
        const sp=specials.get(r.handle);
        const next=sp
          ? Math.round(sp[2]*(r.instance_number===1?1.32:r.instance_number<=5?1.14:1))
          : stableScoreHandle(r.handle,r.rarity,r.instance_number,r.max_supply);
        upd.run(next,r.id);
      }
      const generated=db.prepare('SELECT id,handle,rarity,max_supply FROM username_templates WHERE special=0').all();
      const updT=db.prepare('UPDATE username_templates SET base_value=? WHERE id=?');
      for(const t of generated)updT.run(stableScoreHandle(t.handle,t.rarity,1,t.max_supply),t.id);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('2.7.0-revalue',now);
    });
    tx();
  }

  const uniqueV3=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('3.0.0-global-unique');
  if(!uniqueV3){
    const tx=db.transaction(()=>{
      const taken=new Set(db.prepare('SELECT handle FROM username_instances ORDER BY obtained_at,id').all().map(r=>String(r.handle).toLowerCase()));
      const groups=db.prepare('SELECT handle,COUNT(*) c FROM username_instances GROUP BY handle HAVING COUNT(*)>1').all();
      for(const g of groups){
        const rows=db.prepare('SELECT * FROM username_instances WHERE handle=? ORDER BY obtained_at ASC,id ASC').all(g.handle);
        for(let i=1;i<rows.length;i++){
          const row=rows[i];
          let candidate='',n=i+1;
          do{
            const suffix='x'+n.toString(36);
            candidate=(String(g.handle).slice(0,Math.max(4,10-suffix.length))+suffix).slice(0,10);
            n++;
          }while(taken.has(candidate)||db.prepare('SELECT 1 FROM username_templates WHERE handle=?').get(candidate));
          taken.add(candidate);
          const val=stableScoreHandle(candidate,row.rarity,1,1);
          const t=db.prepare('INSERT INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,created_at) VALUES(?,?,?,?,1,?,0,1,?)')
            .run(candidate,row.rarity,val,1,'legacy_unique',now).lastInsertRowid;
          db.prepare('UPDATE username_instances SET template_id=?,handle=?,value=?,instance_number=1,max_supply=1 WHERE id=?').run(t,candidate,val,row.id);
          db.prepare('UPDATE drop_history SET handle=?,value=? WHERE instance_id=?').run(candidate,val,row.id);
        }
      }
      const specials=new Map(SPECIALS.map(x=>[x[0],x]));
      const all=db.prepare('SELECT id,handle,rarity FROM username_instances').all();
      for(const r of all){
        const sp=specials.get(r.handle),val=sp?sp[2]:stableScoreHandle(r.handle,r.rarity,1,1);
        db.prepare('UPDATE username_instances SET value=?,instance_number=1,max_supply=1 WHERE id=?').run(val,r.id);
      }
      const templates=db.prepare('SELECT id,handle,rarity,special FROM username_templates').all();
      for(const t of templates){
        const sp=specials.get(t.handle),exists=db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(t.handle);
        const val=sp?sp[2]:stableScoreHandle(t.handle,t.rarity,1,1);
        db.prepare('UPDATE username_templates SET base_value=?,max_supply=1,current_supply=? WHERE id=?').run(val,exists?1:0,t.id);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('3.0.0-global-unique',now);
    });
    tx();
  }
  const economyV3=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('3.0.0-economy-rebase');
  if(!economyV3){
    db.transaction(()=>{
      db.prepare('UPDATE users SET balance=CASE WHEN balance>100000 THEN 100000 ELSE balance END,free_drops=CASE WHEN free_drops>2 THEN 2 ELSE free_drops END').run();
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('3.0.0-economy-rebase',now);
    })();
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_handle_unique ON username_instances(handle)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id,activated_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_drop_requests_instance ON drop_requests(instance_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_minigame_sessions_expiry ON mini_game_sessions(expires_at,finished_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_upgrade_target_active ON upgrade_sessions(target_handle,used_at,expires_at)');

  const valueRarityV31=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('3.1.0-value-rarity');
  if(!valueRarityV31){
    const specials=new Map(SPECIALS.map(x=>[x[0],x]));
    db.transaction(()=>{
      const templates=db.prepare('SELECT id,handle,special FROM username_templates').all();
      const updTemplate=db.prepare('UPDATE username_templates SET rarity=?,base_value=?,max_supply=1,current_supply=? WHERE id=?');
      for(const t of templates){
        const sp=specials.get(t.handle),value=sp?Number(sp[2]):stableScoreHandle(t.handle),rarity=rarityFromValue(value);
        const exists=db.prepare('SELECT 1 FROM username_instances WHERE handle=? LIMIT 1').get(t.handle);
        updTemplate.run(rarity,value,exists?1:0,t.id);
      }
      const instances=db.prepare('SELECT id,handle FROM username_instances').all();
      const updInstance=db.prepare('UPDATE username_instances SET rarity=?,value=?,instance_number=1,max_supply=1 WHERE id=?');
      const updHistory=db.prepare('UPDATE drop_history SET rarity=?,value=?,handle=? WHERE instance_id=?');
      for(const row of instances){
        const sp=specials.get(row.handle),value=sp?Number(sp[2]):stableScoreHandle(row.handle),rarity=rarityFromValue(value);
        updInstance.run(rarity,value,row.id);
        updHistory.run(rarity,value,row.handle,row.id);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('3.1.0-value-rarity',now);
    })();
  }

  const fragmentValueV5=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('4.4.0-fragment-value-model');
  if(!fragmentValueV5){
    const specials=new Map(SPECIALS.map(x=>[x[0],x]));
    db.transaction(()=>{
      const templates=db.prepare('SELECT id,handle FROM username_templates').all();
      const updTemplate=db.prepare('UPDATE username_templates SET rarity=?,base_value=? WHERE id=?');
      for(const row of templates){
        const sp=specials.get(row.handle),value=sp?Number(sp[2]):stableScoreHandle(row.handle);
        updTemplate.run(rarityFromValue(value),value,row.id);
      }
      const instances=db.prepare('SELECT id,handle FROM username_instances').all();
      const updInstance=db.prepare('UPDATE username_instances SET rarity=?,value=? WHERE id=?');
      const updHistory=db.prepare('UPDATE drop_history SET rarity=?,value=?,handle=? WHERE instance_id=?');
      for(const row of instances){
        const sp=specials.get(row.handle),value=sp?Number(sp[2]):stableScoreHandle(row.handle),rarity=rarityFromValue(value);
        updInstance.run(rarity,value,row.id);
        updHistory.run(rarity,value,row.handle,row.id);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('4.4.0-fragment-value-model',now);
    })();
  }

  const specialHandlesV52=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('5.2.0-special-handles');
  if(!specialHandlesV52){
    const specials=new Map(SPECIALS.map(x=>[x[0],x]));
    db.transaction(()=>{
      const updTemplate=db.prepare('UPDATE username_templates SET rarity=?,base_value=?,max_supply=1,special=1,active=1,category=? WHERE handle=?');
      const updInstance=db.prepare('UPDATE username_instances SET rarity=?,value=?,instance_number=1,max_supply=1 WHERE handle=?');
      const updHistory=db.prepare('UPDATE drop_history SET rarity=?,value=? WHERE handle=?');
      for(const [handle,_declared,value,_supply,category] of SPECIALS){
        const rarity=rarityFromValue(Number(value));
        updTemplate.run(rarity,Number(value),category,handle);
        updInstance.run(rarity,Number(value),handle);
        updHistory.run(rarity,Number(value),handle);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('5.2.0-special-handles',now);
    })();
  }

  const specialHandlesV53=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('5.3.0-special-handles-expanded');
  if(!specialHandlesV53){
    db.transaction(()=>{
      const updTemplate=db.prepare('UPDATE username_templates SET rarity=?,base_value=?,max_supply=1,special=1,active=1,category=? WHERE handle=?');
      const updInstance=db.prepare('UPDATE username_instances SET rarity=?,value=?,instance_number=1,max_supply=1 WHERE handle=?');
      const updHistory=db.prepare('UPDATE drop_history SET rarity=?,value=? WHERE handle=?');
      for(const [handle,_declared,value,_supply,category] of SPECIALS){
        const rarity=rarityFromValue(Number(value));
        updTemplate.run(rarity,Number(value),category,handle);
        updInstance.run(rarity,Number(value),handle);
        updHistory.run(rarity,Number(value),handle);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('5.3.0-special-handles-expanded',now);
    })();
  }

  const redesignV6=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('6.0.0-valuation-progression');
  if(!redesignV6){
    db.transaction(()=>{
      const updTemplate=db.prepare('UPDATE username_templates SET base_value=?,rarity=?,username_score=?,visual_tier=?,quality_json=? WHERE id=?');
      const updInstance=db.prepare('UPDATE username_instances SET value=?,rarity=?,username_score=?,visual_tier=?,quality_json=? WHERE id=?');
      const templates=db.prepare('SELECT * FROM username_templates').all();
      const byId=new Map();
      for(const t of templates){
        const a=analyzeUsername(t.handle),value=t.special?Number(t.base_value):a.value,rarity=rarityFromValue(value),visual=visualTier(value,a.score),quality=JSON.stringify(a.breakdown||{});
        updTemplate.run(value,rarity,a.score,visual,quality,t.id);byId.set(t.id,{value,rarity,score:a.score,visual,quality});
      }
      const instances=db.prepare('SELECT id,template_id FROM username_instances').all();
      for(const i of instances){
        const x=byId.get(i.template_id);if(x)updInstance.run(x.value,x.rarity,x.score,x.visual,x.quality,i.id);
      }
      db.prepare('UPDATE users SET level=CASE WHEN level<1 THEN 1 ELSE level END,luck_points=MIN(100,MAX(0,luck_points)),bad_drop_streak=MAX(0,bad_drop_streak)').run();
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('6.0.0-valuation-progression',now);
    })();
  }

  const usernameLimitV71=db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('7.1.0-username-max-15');
  if(!usernameLimitV71){
    db.transaction(()=>{
      const rows=db.prepare('SELECT id,handle FROM username_templates WHERE LENGTH(handle)>15 ORDER BY id').all();
      for(const row of rows){
        const clean=String(row.handle||'').toLowerCase().replace(/[^a-z0-9_]/g,'')||'username';
        const stem=(/^[a-z]/.test(clean)?clean:'u'+clean).slice(0,10);
        let n=0,candidate='';
        do{
          const suffix=(String(row.id)+String(n||'')).slice(-4).padStart(4,'0');
          candidate=(stem+'_'+suffix).slice(0,15);n++;
        }while(db.prepare('SELECT 1 FROM username_templates WHERE handle=? AND id<>?').get(candidate,row.id)||
               db.prepare('SELECT 1 FROM username_instances WHERE handle=? AND template_id<>?').get(candidate,row.id));
        db.prepare('UPDATE username_templates SET handle=? WHERE id=?').run(candidate,row.id);
        const instances=db.prepare('SELECT id FROM username_instances WHERE template_id=?').all(row.id);
        for(const inst of instances){
          db.prepare('UPDATE username_instances SET handle=? WHERE id=?').run(candidate,inst.id);
          db.prepare('UPDATE drop_history SET handle=? WHERE instance_id=?').run(candidate,inst.id);
        }
        db.prepare('UPDATE upgrade_sessions SET target_handle=? WHERE target_template_id=?').run(candidate,row.id);
      }
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run('7.1.0-username-max-15',now);
    })();
  }

  const integrity=db.pragma('integrity_check',{simple:true});
  if(String(integrity).toLowerCase()!=='ok')throw new Error('sqlite_integrity_check_failed:'+integrity);
  return db;
}
