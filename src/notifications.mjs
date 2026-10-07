import {uid,nowIso} from './economy.mjs';

const ALLOWED_TYPES=new Set([
  'USERNAME_RECEIVED','USERNAME_SENT','GIFT_RECEIVED','LEVEL_UP','ACHIEVEMENT',
  'QUEST_COMPLETE','REWARD','ADMIN_MESSAGE','SYSTEM'
]);

function clean(value,max=500){
  return String(value??'').trim().slice(0,max);
}

export function createNotification(db,userId,type,title,body='',page=''){
  const uidValue=Number(userId);
  if(!uidValue||!db.prepare('SELECT 1 FROM users WHERE id=?').get(uidValue))return null;
  const safeType=ALLOWED_TYPES.has(String(type))?String(type):'SYSTEM';
  const row={
    id:uid(),
    userId:uidValue,
    type:safeType,
    title:clean(title,120)||'USERNAME',
    body:clean(body,500),
    page:clean(page,40),
    createdAt:nowIso()
  };
  db.prepare('INSERT INTO notifications(id,user_id,type,title,body,page,read_at,created_at) VALUES(?,?,?,?,?,?,NULL,?)')
    .run(row.id,row.userId,row.type,row.title,row.body,row.page,row.createdAt);
  return row;
}

export function unreadNotificationCount(db,userId){
  return Number(db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL').get(Number(userId))?.c||0);
}

export function listNotifications(db,userId,limit=80){
  const size=Math.max(1,Math.min(100,Number(limit)||80));
  const items=db.prepare(`SELECT id,type,title,body,page,read_at,created_at
    FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?`).all(Number(userId),size)
    .map(x=>({id:x.id,type:x.type,title:x.title,body:x.body,page:x.page,read:!!x.read_at,createdAt:x.created_at}));
  return {items,unread:unreadNotificationCount(db,userId)};
}

export function markAllNotificationsRead(db,userId){
  const at=nowIso();
  const changes=db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(at,Number(userId)).changes;
  return {ok:true,changes,unread:0};
}
