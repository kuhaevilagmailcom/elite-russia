import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export async function asyncMap(items,fn){const result=[];for(const [i,x] of items.entries())result.push(await fn(x,i));return result;}
// Translate the deliberately small, parameterized SQL dialect used by the shared engine.
export function pgSQL(sql){let i=0;const ignore=/^INSERT OR IGNORE INTO /i.test(sql);sql=sql.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ');let out=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\buser\b|\browid\b/gi,m=>m==='?'?'$'+(++i):m.toLowerCase()==='user'?'"user"':m.toLowerCase()==='rowid'?'id':m);if(ignore)out+=' ON CONFLICT DO NOTHING';return out;}
export class SQLiteRepository{
 constructor(db){this.db=db;this.context=new AsyncLocalStorage();this.tail=Promise.resolve();}
 static async open(path=':memory:'){const {DatabaseSync}=await import('node:sqlite');if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);db.exec(readFileSync(new URL('./sqlite-schema.sql',import.meta.url),'utf8'));return new SQLiteRepository(db);}
 async exclusive(fn){if(this.context.getStore())return fn();const old=this.tail;let release;this.tail=new Promise(r=>release=r);await old;try{return await this.context.run(true,fn)}finally{release()}}
 async all(q,...p){return this.exclusive(()=>{const s=this.db.prepare(q);s.setReadBigInts(true);return s.all(...p)})} async get(q,...p){return (await this.all(q,...p))[0]}
 async run(q,...p){return this.exclusive(()=>this.db.prepare(q).run(...p))} async exec(q){return this.exclusive(()=>this.db.exec(q))}
 async tx(fn){if(this.context.getStore())throw Error('Nested transaction');return this.exclusive(async()=>{this.db.exec('BEGIN IMMEDIATE');try{const r=await fn();this.db.exec('COMMIT');return r}catch(e){this.db.exec('ROLLBACK');throw e}})}
 async close(){await this.exclusive(()=>this.db.close())}
}
export class PostgresRepository{
 constructor(pool){this.pool=pool;this.context=new AsyncLocalStorage();}
 static async open(url,{migrate=false}={}){if(!url)throw Error('DATABASE_URL required');const {Pool,types}=await import('pg');types.setTypeParser(20,BigInt);const pool=new Pool({connectionString:url,max:10,connectionTimeoutMillis:5000,statement_timeout:15000,idle_in_transaction_session_timeout:20000});try{if(migrate)await pool.query(readFileSync(new URL('../../migrations/001_market.sql',import.meta.url),'utf8'));await pool.query('SELECT 1 FROM meta LIMIT 1');return new PostgresRepository(pool)}catch(e){await pool.end();throw e}}
 async query(q,p=[]){return (this.context.getStore()||this.pool).query(pgSQL(q),p)}
 async all(q,...p){return (await this.query(q,p)).rows} async get(q,...p){return (await this.all(q,...p))[0]} async run(q,...p){return {changes:(await this.query(q,p)).rowCount}} async exec(q){return this.query(q)}
 async tx(fn){if(this.context.getStore())throw Error('Nested transaction');const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'"); // Safe coarse serialization of sandbox mutations across processes; replace with row locks after concurrency verification.
 await c.query('SELECT pg_advisory_xact_lock(74912301)');const result=await this.context.run(c,fn);await c.query('COMMIT');return result;}catch(e){try{await c.query('ROLLBACK')}catch{}throw e;}finally{c.release()}}
 async close(){await this.pool.end()}
}
