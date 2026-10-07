const {state,api,render,icon,esc,fmt,metric,refreshUser,toast,ERR}=window.USERNAME_APP;

state.adminSection=state.adminSection||'users';
state.adminUsernameQuery=state.adminUsernameQuery||'';
state.adminUsernameStatus=state.adminUsernameStatus||'active';
state.adminUsernamePage=state.adminUsernamePage||1;
state.adminUsernames=state.adminUsernames||null;
state.adminBroadcastResult=state.adminBroadcastResult||null;

async function refreshAdmin(){
  state.admin=await api('/api/admin/overview?q='+encodeURIComponent(state.adminQuery||'')+'&page='+(state.adminPage||1)+'&size=20');
  if(state.adminSection==='usernames')await refreshAdminUsernames();
}
async function refreshAdminUsernames(){
  state.adminUsernames=await api('/api/admin/usernames?q='+encodeURIComponent(state.adminUsernameQuery||'')+'&status='+encodeURIComponent(state.adminUsernameStatus||'active')+'&page='+(state.adminUsernamePage||1)+'&size=30');
}
function adminResetSheet(){
  if(!state.adminResetStage)return '';
  if(state.adminResetStage===1)return '<div class="sheet-root"><button class="sheet-backdrop" data-admin-reset-close></button><aside class="filter-sheet danger-sheet"><div class="sheet-title"><b>Сброс всех игроков</b><button data-admin-reset-close>'+icon('x')+'</button></div><p>Игровой прогресс всех пользователей будет сброшен. Перед операцией сервер создаст резервную копию.</p><label>Введите <b>RESET USERNAME</b><input id="adminResetPhrase" autocomplete="off" placeholder="RESET USERNAME"></label><button class="danger" data-admin-reset-arm disabled>Продолжить</button></aside></div>';
  return '<div class="sheet-root"><button class="sheet-backdrop" data-admin-reset-close></button><aside class="filter-sheet danger-sheet"><div class="sheet-title"><b>Последнее подтверждение</b><button data-admin-reset-close>'+icon('x')+'</button></div><p>Платежи сохранятся. Игровой прогресс будет очищен.</p><button class="danger" data-admin-reset-confirm>Да, сбросить всех</button><button class="secondary" data-admin-reset-close>Отмена</button></aside></div>';
}
function adminTabs(){
  const tabs=[
    ['users','profile','Пользователи'],
    ['broadcast','notifications','Рассылка'],
    ['usernames','collection','Usernames'],
    ['stats','rank','Статистика']
  ];
  return '<nav class="admin-tabs">'+tabs.map(([key,ico,label])=>'<button data-admin-section="'+key+'" class="'+(state.adminSection===key?'active':'')+'"><span>'+icon(ico)+'</span><b>'+label+'</b></button>').join('')+'</nav>';
}
function userStatus(user){
  if(user.blocked)return '<span class="admin-status blocked">Заблокирован</span>';
  const seen=Date.parse(user.last_seen||user.lastSeen||'')||0;
  return Date.now()-seen<15*60*1000?'<span class="admin-status online">Онлайн</span>':'<span class="admin-status">Неактивен</span>';
}
function usersSection(){
  const a=state.admin||{users:[],page:1,pages:1};
  return '<section class="admin-section">'+
    '<div class="admin-section-head"><div><small>УПРАВЛЕНИЕ</small><b>Пользователи</b><span>Поиск и полное управление игровым профилем.</span></div><strong>'+Number(a.stats?.users||0)+'</strong></div>'+
    '<div class="admin-search"><input id="adminQuery" value="'+esc(state.adminQuery||'')+'" placeholder="ID, Telegram username или имя"><button data-admin-search aria-label="Поиск">'+icon('search')+'</button></div>'+
    '<div class="admin-users">'+(a.users?.length?a.users.map(u=>'<button data-admin-user="'+u.id+'" class="admin-user-row">'+
      '<span class="admin-avatar">'+esc((u.first_name||u.username||'U').slice(0,1).toUpperCase())+'</span>'+
      '<span class="admin-user-copy"><b>'+esc(u.first_name||u.username||'Пользователь')+'</b><small>'+(u.username?'@'+esc(u.username)+' · ':'')+'UID '+u.id+' · '+Number(u.level||1)+' ур.</small></span>'+
      '<span class="admin-user-money"><b>'+fmt(u.capital)+'</b>'+userStatus(u)+'</span>'+icon('chevron')+
    '</button>').join(''):'<div class="empty">Пользователи не найдены.</div>')+'</div>'+
    (a.pages>1?'<div class="pager admin-pager"><button data-admin-pager="-1" '+(a.page<=1?'disabled':'')+'>Назад</button><span>'+a.page+' / '+a.pages+'</span><button data-admin-pager="1" '+(a.page>=a.pages?'disabled':'')+'>Дальше</button></div>':'')+
  '</section>';
}
function broadcastSection(){
  const result=state.adminBroadcastResult;
  return '<section class="admin-section admin-broadcast-section">'+
    '<div class="admin-section-head"><div><small>КОММУНИКАЦИЯ</small><b>Рассылка</b><span>Сообщение придёт в Telegram и в центр уведомлений Mini App.</span></div><span class="admin-head-icon">'+icon('notifications')+'</span></div>'+
    '<div class="admin-form-card"><label><span>Текст сообщения</span><textarea id="adminBroadcastText" maxlength="2000" placeholder="Напиши сообщение для пользователей..."></textarea></label>'+
      '<div class="admin-form-grid"><label><span>Текст кнопки</span><input id="adminBroadcastButton" maxlength="64" value="🎮 Открыть игру" placeholder="Открыть игру"></label>'+
      '<label><span>Куда ведёт кнопка</span><select id="adminBroadcastPage"><option value="home">Главная</option><option value="games">Игры</option><option value="collection">Коллекция</option><option value="wheel">Колесо</option><option value="upgrader">Апгрейдер</option><option value="shop">Магазин</option></select></label></div>'+
      '<button class="primary admin-main-action" data-admin-broadcast>'+icon('notifications')+'<span>Запустить рассылку</span></button>'+
    '</div>'+
    (result?'<div class="admin-delivery-result"><span>'+icon('check')+'</span><div><b>Последняя рассылка завершена</b><small>Отправлено: '+Number(result.sent||0)+' · Ошибок: '+Number(result.failed||0)+' · Всего: '+Number(result.total||0)+'</small></div></div>':'')+
  '</section>';
}
function usernamesSection(){
  const d=state.adminUsernames||{items:[],page:1,pages:1,total:0};
  const statuses=[['active','Активные'],['owned','В коллекции'],['market','На рынке'],['pending','Ожидают']];
  return '<section class="admin-section">'+
    '<div class="admin-section-head"><div><small>КАТАЛОГ</small><b>Usernames</b><span>Все активные username и их владельцы.</span></div><strong>'+Number(d.total||0)+'</strong></div>'+
    '<div class="admin-username-toolbar"><div class="admin-search"><input id="adminUsernameQuery" value="'+esc(state.adminUsernameQuery||'')+'" placeholder="@username, владелец или UID"><button data-admin-username-search>'+icon('search')+'</button></div>'+
    '<div class="admin-status-filter">'+statuses.map(([key,label])=>'<button data-admin-username-status="'+key+'" class="'+(state.adminUsernameStatus===key?'active':'')+'">'+label+'</button>').join('')+'</div></div>'+
    '<div class="admin-global-usernames">'+(d.items?.length?d.items.map(x=>'<article class="admin-username-row">'+
      '<div class="admin-username-main"><b>'+esc(x.handle)+'</b><span>'+fmt(x.value)+' · '+esc(x.rarity)+' · '+esc(x.status)+'</span></div>'+
      '<button class="admin-owner" data-admin-user="'+Number(x.owner_id||0)+'"><span>'+esc(x.owner_name||x.owner_username||'Без владельца')+'</span><small>'+(x.owner_username?'@'+esc(x.owner_username):'UID '+Number(x.owner_id||0))+'</small></button>'+
      '<div class="admin-username-actions"><button data-admin-value="'+x.id+'">Цена</button><button data-admin-transfer="'+x.id+'">Передать</button><button class="danger-soft" data-admin-remove="'+x.id+'">Удалить</button></div>'+
    '</article>').join(''):'<div class="empty">Ничего не найдено.</div>')+'</div>'+
    (d.pages>1?'<div class="pager admin-pager"><button data-admin-username-pager="-1" '+(d.page<=1?'disabled':'')+'>Назад</button><span>'+d.page+' / '+d.pages+'</span><button data-admin-username-pager="1" '+(d.page>=d.pages?'disabled':'')+'>Дальше</button></div>':'')+
  '</section>';
}
function statsSection(){
  const s=state.admin?.stats||{};
  const cards=[
    ['Пользователи',s.users||0,'Всего аккаунтов'],
    ['Онлайн',s.activeNow||0,'За последние 15 минут'],
    ['Активны 24ч',s.activeToday||0,'Уникальных пользователей'],
    ['Активны 7 дней',s.active7d||0,'Недельная аудитория'],
    ['Новые 24ч',s.newUsers24h||0,'Новых аккаунтов'],
    ['Заблокировано',s.blocked||0,'Пользователей'],
    ['Usernames',s.activeUsernames||0,'Активных экземпляров'],
    ['Дропов 24ч',s.drops24h||0,'Открытий за сутки'],
    ['Дропов всего',s.totalDrops||0,'За всё время'],
    ['Сделок 24ч',s.marketDeals24h||0,'На рынке'],
    ['Оборот рынка 24ч',fmt(s.marketVolume24h||0),'За сутки'],
    ['Передач 24ч',s.transfers24h||0,'Между игроками']
  ];
  return '<section class="admin-section">'+
    '<div class="admin-section-head"><div><small>АНАЛИТИКА</small><b>Статистика</b><span>Ключевые показатели проекта в одном месте.</span></div><span class="admin-head-icon">'+icon('rank')+'</span></div>'+
    '<div class="admin-stats-grid">'+cards.map(([label,value,sub])=>'<article><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub)+'</small></article>').join('')+'</div>'+
    '<div class="admin-money-card"><div><small>СУММАРНЫЙ БАЛАНС</small><b>'+fmt(s.money||0)+'</b></div><span>'+icon('admin')+'</span></div>'+
    '<section class="danger-zone"><small>ОПАСНАЯ ЗОНА</small><b>Сбросить прогресс всех игроков</b><span>Перед сбросом создаётся резервная копия. Платежи сохраняются.</span><button class="danger" data-admin-reset-open>Сбросить прогресс всех игроков</button></section>'+
  '</section>';
}
function userDetailView(d){
  const u=d.user;
  return '<div class="admin-detail">'+
    '<button class="admin-back" data-admin-back>'+icon('back')+'<span>К пользователям</span></button>'+
    '<section class="admin-user-hero"><div class="admin-avatar large">'+esc((u.firstName||u.username||'U').slice(0,1).toUpperCase())+'</div><div class="admin-user-hero-copy"><small>UID '+u.id+' · Telegram ID '+esc(u.telegramId)+'</small><b>'+esc(u.firstName||u.username||'Пользователь')+'</b><span>'+(u.username?'@'+esc(u.username):'Без Telegram username')+'</span><div>'+userStatus({blocked:u.blocked,lastSeen:u.lastSeen})+'</div></div><div class="admin-user-hero-money"><small>Капитал</small><b>'+fmt(u.capital)+'</b><span>'+Number(u.level||1)+' ур. · '+esc(u.title||'')+'</span></div></section>'+
    '<div class="admin-detail-grid">'+
      '<section class="admin-form-card"><div class="admin-card-title"><span>'+icon('profile')+'</span><div><b>Игровое состояние</b><small>XP, бесплатные дропы и баланс</small></div></div>'+
        '<div class="admin-form-grid"><label><span>XP</span><input id="adminXp" inputmode="numeric" value="'+Number(u.xp||0)+'"></label><label><span>Бесплатные дропы</span><input id="adminFreeDrops" inputmode="numeric" value="'+Number(u.freeDrops||0)+'"></label></div>'+
        '<button class="secondary" data-admin-save-progress>Сохранить прогресс</button>'+
        '<label><span>Изменить баланс на сумму</span><input id="adminMoney" inputmode="numeric" placeholder="Например 5000"></label>'+
        '<div class="admin-inline-actions"><button data-admin-money="add">+ Добавить</button><button data-admin-money="take" class="secondary">− Забрать</button></div>'+
      '</section>'+
      '<section class="admin-form-card"><div class="admin-card-title"><span>'+icon('admin')+'</span><div><b>Аккаунт</b><small>Доступ и служебные действия</small></div></div>'+
        '<button data-admin-block="'+(u.blocked?'0':'1')+'" class="'+(u.blocked?'secondary':'danger-soft')+'">'+(u.blocked?'Разблокировать пользователя':'Заблокировать пользователя')+'</button>'+
        '<button data-admin-user-reset class="danger-soft">Сбросить игровой прогресс</button>'+
      '</section>'+
    '</div>'+
    '<section class="admin-form-card"><div class="admin-card-title"><span>'+icon('notifications')+'</span><div><b>Сообщение пользователю</b><small>Telegram + центр уведомлений Mini App</small></div></div><textarea id="adminMessage" maxlength="1000" placeholder="Напиши сообщение..."></textarea><button data-admin-message>Отправить сообщение</button></section>'+
    '<section class="admin-form-card"><div class="admin-card-title"><span>'+icon('plus')+'</span><div><b>Добавить username</b><small>Создаётся уникальный экземпляр 1/1</small></div></div><div class="admin-form-grid"><input id="adminHandle" placeholder="@username" maxlength="15"><input id="adminValue" inputmode="numeric" placeholder="Стоимость — автоматически"></div><button data-admin-add-username>Добавить пользователю</button></section>'+
    '<section class="admin-usernames-card"><div class="admin-card-title"><span>'+icon('collection')+'</span><div><b>Usernames</b><small>'+Number(d.user.usernameCount||0)+' активных</small></div></div><div class="admin-usernames">'+(d.items.length?d.items.map(x=>'<article><div><b>'+esc(x.handle)+'</b><span>'+fmt(x.value)+' · '+esc(x.status)+'</span></div><div><button data-admin-value="'+x.id+'">Цена</button><button data-admin-transfer="'+x.id+'">Передать</button><button class="danger-soft" data-admin-remove="'+x.id+'">Удалить</button></div></article>').join(''):'<div class="empty">Нет активных usernames.</div>')+'</div></section>'+
  '</div>';
}
function adminView(){
  if(state.adminDetail)return '<div class="page-body admin-page">'+userDetailView(state.adminDetail)+'</div>';
  const body=state.adminSection==='broadcast'?broadcastSection():state.adminSection==='usernames'?usernamesSection():state.adminSection==='stats'?statsSection():usersSection();
  return '<div class="page-body admin-page">'+adminResetSheet()+adminTabs()+body+'</div>';
}
async function refreshCurrentAdminList(){
  if(state.adminDetail){state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);return}
  if(state.adminSection==='usernames')await refreshAdminUsernames();
  else await refreshAdmin();
}
document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el)return;
  try{
    if(el.dataset.adminSection){
      state.adminSection=el.dataset.adminSection;state.adminDetail=null;
      if(state.adminSection==='usernames')await refreshAdminUsernames();
      render();return
    }
    if(el.hasAttribute('data-admin-search')){state.adminQuery=document.querySelector('#adminQuery')?.value||'';state.adminPage=1;await refreshAdmin();render();return}
    if(el.dataset.adminPager){state.adminPage=Math.max(1,(state.adminPage||1)+Number(el.dataset.adminPager));await refreshAdmin();render();return}
    if(el.hasAttribute('data-admin-username-search')){state.adminUsernameQuery=document.querySelector('#adminUsernameQuery')?.value||'';state.adminUsernamePage=1;await refreshAdminUsernames();render();return}
    if(el.dataset.adminUsernameStatus){state.adminUsernameStatus=el.dataset.adminUsernameStatus;state.adminUsernamePage=1;await refreshAdminUsernames();render();return}
    if(el.dataset.adminUsernamePager){state.adminUsernamePage=Math.max(1,(state.adminUsernamePage||1)+Number(el.dataset.adminUsernamePager));await refreshAdminUsernames();render();return}
    if(el.dataset.adminUser){const id=Number(el.dataset.adminUser);if(!id)return;state.adminDetail=await api('/api/admin/users/'+id);render();return}
    if(el.hasAttribute('data-admin-back')){state.adminDetail=null;render();return}
    if(el.hasAttribute('data-admin-save-progress')){
      const xp=Math.max(0,Number(document.querySelector('#adminXp')?.value)||0),freeDrops=Math.max(0,Number(document.querySelector('#adminFreeDrops')?.value)||0);
      await api('/api/admin/users/'+state.adminDetail.user.id+'/profile',{method:'POST',body:JSON.stringify({xp,freeDrops})});
      state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Прогресс обновлён');render();return
    }
    if(el.dataset.adminMoney){const n=Math.abs(Number(document.querySelector('#adminMoney')?.value)||0);if(!n){toast('Введите сумму');return}await api('/api/admin/users/'+state.adminDetail.user.id+'/balance',{method:'POST',body:JSON.stringify({delta:el.dataset.adminMoney==='add'?n:-n})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Баланс обновлён');render();return}
    if(el.dataset.adminBlock!==undefined){await api('/api/admin/users/'+state.adminDetail.user.id+'/block',{method:'POST',body:JSON.stringify({value:el.dataset.adminBlock==='1'})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast(el.dataset.adminBlock==='1'?'Пользователь заблокирован':'Пользователь разблокирован');render();return}
    if(el.hasAttribute('data-admin-user-reset')){if(!confirm('Сбросить игровой прогресс этого пользователя?'))return;await api('/api/admin/users/'+state.adminDetail.user.id+'/reset',{method:'POST',body:'{}'});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Прогресс пользователя сброшен');render();return}
    if(el.hasAttribute('data-admin-add-username')){const handle=document.querySelector('#adminHandle')?.value||'',value=document.querySelector('#adminValue')?.value||'';await api('/api/admin/users/'+state.adminDetail.user.id+'/add-username',{method:'POST',body:JSON.stringify({handle,value})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Username добавлен');render();return}
    if(el.hasAttribute('data-admin-message')){
      const text=String(document.querySelector('#adminMessage')?.value||'').trim();if(!text){toast('Введите сообщение');return}
      el.disabled=true;await api('/api/admin/users/'+state.adminDetail.user.id+'/message',{method:'POST',body:JSON.stringify({text})});
      toast('Сообщение отправлено');const box=document.querySelector('#adminMessage');if(box)box.value='';el.disabled=false;return
    }
    if(el.dataset.adminRemove){if(!confirm('Удалить этот username?'))return;await api('/api/admin/usernames/'+el.dataset.adminRemove+'/remove',{method:'POST',body:'{}'});await refreshCurrentAdminList();toast('Username удалён');render();return}
    if(el.dataset.adminTransfer){const target=prompt('UID пользователя, которому передать username:');if(!target)return;await api('/api/admin/usernames/'+el.dataset.adminTransfer+'/transfer',{method:'POST',body:JSON.stringify({targetId:Number(target)})});await refreshCurrentAdminList();toast('Username передан');render();return}
    if(el.dataset.adminValue){const value=prompt('Новая игровая стоимость username:');if(!value)return;await api('/api/admin/usernames/'+el.dataset.adminValue+'/value',{method:'POST',body:JSON.stringify({value:Number(value)})});await refreshCurrentAdminList();toast('Стоимость обновлена');render();return}
    if(el.hasAttribute('data-admin-broadcast')){
      const text=String(document.querySelector('#adminBroadcastText')?.value||'').trim();if(!text){toast('Введите текст рассылки');return}
      if(!confirm('Отправить сообщение всем активным пользователям?'))return;
      el.disabled=true;
      const buttonLabel=String(document.querySelector('#adminBroadcastButton')?.value||'🎮 Открыть игру').trim(),page=String(document.querySelector('#adminBroadcastPage')?.value||'home');
      const result=await api('/api/admin/broadcast',{method:'POST',body:JSON.stringify({text,buttonLabel,page})});
      state.adminBroadcastResult=result;toast('Рассылка завершена');el.disabled=false;render();return
    }
    if(el.hasAttribute('data-admin-reset-open')){state.adminResetStage=1;render();return}
    if(el.hasAttribute('data-admin-reset-close')){state.adminResetStage=0;render();return}
    if(el.hasAttribute('data-admin-reset-arm')){state.adminResetStage=2;render();return}
    if(el.hasAttribute('data-admin-reset-confirm')){await api('/api/admin/reset-all',{method:'POST',body:JSON.stringify({confirmation:'RESET USERNAME'})});state.adminResetStage=0;state.adminDetail=null;await refreshUser();state.adminPage=1;await refreshAdmin();toast('Все игровые профили сброшены');render();return}
  }catch(err){toast(ERR[err.message]||'Ошибка админки');el.disabled=false}
});
document.addEventListener('keydown',async e=>{
  if(e.key!=='Enter')return;
  if(e.target?.id==='adminQuery'){e.preventDefault();state.adminQuery=e.target.value||'';state.adminPage=1;await refreshAdmin();render()}
  if(e.target?.id==='adminUsernameQuery'){e.preventDefault();state.adminUsernameQuery=e.target.value||'';state.adminUsernamePage=1;await refreshAdminUsernames();render()}
});
document.addEventListener('input',e=>{if(e.target.id==='adminResetPhrase'){const btn=document.querySelector('[data-admin-reset-arm]');if(btn)btn.disabled=e.target.value!=='RESET USERNAME'}});

window.USERNAME_ADMIN={view:adminView,refresh:refreshAdmin};
