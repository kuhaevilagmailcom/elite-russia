import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {GAME} from './config.mjs';
import {SPECIALS} from './generator.mjs';

export function createDatabase(dataDir){
  fs.mkdirSync(dataDir,{recursive:true});
  const db=new Database(path.join(dataDir,'username.sqlite'));
  db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 3000');
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT UNIQUE NOT NULL, username TEXT, first_name TEXT,
    balance INTEGER NOT NULL DEFAULT ${GAME.startBalance}, free_drops INTEGER NOT NULL DEFAULT ${GAME.freeDrops},
    level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0,
    premium_until TEXT, created_at TEXT NOT NULL, last_seen TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS username_templates(
    id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT UNIQUE NOT NULL, rarity TEXT NOT NULL, base_value INTEGER NOT NULL,
    max_supply INTEGER NOT NULL, current_supply INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT 'generated',
    special INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, season_id INTEGER, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS username_instances(
    id TEXT PRIMARY KEY, template_id INTEGER NOT NULL, handle TEXT NOT NULL, rarity TEXT NOT NULL, value INTEGER NOT NULL,
    instance_number INTEGER NOT NULL, max_supply INTEGER NOT NULL, owner_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    obtained_at TEXT NOT NULL, obtained_type TEXT NOT NULL DEFAULT 'drop', season_id INTEGER,
    FOREIGN KEY(template_id) REFERENCES username_templates(id), FOREIGN KEY(owner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS inventory(instance_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(instance_id) REFERENCES username_instances(id),FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS drop_requests(request_id TEXT NOT NULL,user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,cost INTEGER NOT NULL,tier TEXT NOT NULL DEFAULT 'basic',created_at TEXT NOT NULL,PRIMARY KEY(request_id,user_id));
  CREATE TABLE IF NOT EXISTS drop_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,handle TEXT NOT NULL,rarity TEXT NOT NULL,value INTEGER NOT NULL,action TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS balance_transactions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,type TEXT NOT NULL,amount INTEGER NOT NULL,balance_before INTEGER NOT NULL,balance_after INTEGER NOT NULL,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS task_progress(user_id INTEGER NOT NULL,progress_date TEXT NOT NULL,task_key TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,progress_date,task_key));
  CREATE TABLE IF NOT EXISTS task_claims(user_id INTEGER NOT NULL,claim_date TEXT NOT NULL,task_key TEXT NOT NULL,PRIMARY KEY(user_id,claim_date,task_key));
  CREATE TABLE IF NOT EXISTS profile_showcase(user_id INTEGER NOT NULL,instance_id TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(user_id,position),UNIQUE(user_id,instance_id));
  CREATE TABLE IF NOT EXISTS season_history(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,position INTEGER,score INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,season_id));
  CREATE TABLE IF NOT EXISTS premium_subscriptions(user_id INTEGER PRIMARY KEY,active_until TEXT,source TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,admin_id INTEGER NOT NULL,action TEXT NOT NULL,target TEXT,metadata TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS market_listings(id TEXT PRIMARY KEY,instance_id TEXT NOT NULL,seller_id INTEGER NOT NULL,buyer_id INTEGER,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,closed_at TEXT);
  CREATE TABLE IF NOT EXISTS market_transactions(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,instance_id TEXT NOT NULL,seller_id INTEGER NOT NULL,buyer_id INTEGER NOT NULL,price INTEGER NOT NULL,fee INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS referrals(id TEXT PRIMARY KEY,referrer_id INTEGER NOT NULL,referred_id INTEGER UNIQUE NOT NULL,created_at TEXT NOT NULL,activated_at TEXT);
  CREATE TABLE IF NOT EXISTS friends(user_id INTEGER NOT NULL,friend_id INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,friend_id));
  CREATE TABLE IF NOT EXISTS referral_rewards(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,reward_key TEXT NOT NULL,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,reward_key));
  CREATE TABLE IF NOT EXISTS username_transfers(id TEXT PRIMARY KEY,instance_id TEXT NOT NULL,from_user_id INTEGER NOT NULL,to_user_id INTEGER NOT NULL,type TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS wheel_claims(user_id INTEGER PRIMARY KEY,last_claim_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS wheel_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,request_id TEXT NOT NULL,reward_key TEXT NOT NULL,reward_label TEXT NOT NULL,reward_type TEXT NOT NULL,reward_amount INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,request_id));
  CREATE TABLE IF NOT EXISTS upgrade_progress(user_id INTEGER PRIMARY KEY,points INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS upgrade_history(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,source_ids TEXT NOT NULL,target_instance_id TEXT NOT NULL,from_rarity TEXT NOT NULL,to_rarity TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS season_stats(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,score INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,season_id));
  CREATE TABLE IF NOT EXISTS season_rewards(user_id INTEGER NOT NULL,season_id INTEGER NOT NULL,reward_key TEXT NOT NULL,claimed_at TEXT,PRIMARY KEY(user_id,season_id,reward_key));
  CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS event_templates(event_id INTEGER NOT NULL,template_id INTEGER NOT NULL,PRIMARY KEY(event_id,template_id));
  CREATE INDEX IF NOT EXISTS idx_instances_owner ON username_instances(owner_id,status,obtained_at);
  CREATE INDEX IF NOT EXISTS idx_drop_user ON drop_history(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON balance_transactions(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_market_status ON market_listings(status,created_at);
  CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id,status);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id,friend_id);
  CREATE INDEX IF NOT EXISTS idx_transfer_from ON username_transfers(from_user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_wheel_user ON wheel_history(user_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_season_score ON season_stats(season_id,score DESC);
  `);
  const dropCols=new Set(db.prepare('PRAGMA table_info(drop_requests)').all().map(x=>x.name));
  if(!dropCols.has('tier'))db.exec("ALTER TABLE drop_requests ADD COLUMN tier TEXT NOT NULL DEFAULT 'basic'");
  const upgradeCols=new Set(db.prepare('PRAGMA table_info(upgrade_history)').all().map(x=>x.name));
  if(!upgradeCols.has('success'))db.exec("ALTER TABLE upgrade_history ADD COLUMN success INTEGER NOT NULL DEFAULT 1");
  const now=new Date().toISOString();
  const cfg=db.prepare('INSERT OR IGNORE INTO game_config(key,value) VALUES(?,?)');
  cfg.run('drop_cost',String(GAME.dropCost));cfg.run('market_fee',String(GAME.marketFee));
  if(!db.prepare('SELECT 1 FROM seasons WHERE active=1 LIMIT 1').get()){
    const end=new Date(Date.now()+GAME.seasonDays*86400000).toISOString();
    db.prepare('INSERT INTO seasons(name,start_at,end_at,active) VALUES(?,?,?,1)').run('Season 1',now,end);
  }
  const ins=db.prepare('INSERT OR IGNORE INTO username_templates(handle,rarity,base_value,max_supply,current_supply,category,special,active,season_id,created_at) VALUES(?,?,?,?,0,?,1,1,NULL,?)');
  for(const [handle,rarity,value,supply,category] of SPECIALS)ins.run(handle,rarity,value,supply,category,now);
  return db;
}
