const {state,api,render,icon,esc,fmt,metric,refreshUser,toast,ERR}=window.USERNAME_APP;
async function refreshAdmin(){
  state.admin=await api('/api/admin/overview?q='+encodeURIComponent(state.adminQuery||'')+'&page='+(state.adminPage||1)+'&size=20');
}
function adminResetSheet(){
  if(!state.adminResetStage)return '';
  if(state.adminResetStage===1)return '<div class="sheet-root"><button class="sheet-backdrop" data-admin-reset-close></button><aside class="filter-sheet danger-sheet"><div class="sheet-title"><b>Сброс всех игроков</b><button data-admin-reset-close>'+icon('close')+'</button></div><p>Будет удалён игровой прогресс ВСЕХ пользователей. Это действие нельзя отменить.</p><label>Введите <b>RESET USERNAME</b><input id="adminResetPhrase" autocomplete="off" placeholder="RESET USERNAME"></label><button class="danger" data-admin-reset-arm disabled>Продолжить</button></aside></div>';
  return '<div class="sheet-root"><button class="sheet-backdrop" data-admin-reset-close></button><aside class="filter-sheet danger-sheet"><div class="sheet-title"><b>Последнее подтверждение</b><button data-admin-reset-close>'+icon('close')+'</button></div><p>Перед сбросом сервер создаст резервную копию. Платежи и активный USERNAME+ сохранятся.</p><button class="danger" data-admin-reset-confirm>Да, сбросить всех</button><button class="secondary" data-admin-reset-close>Отмена</button></aside></div>';
}
function adminView(){
  const a=state.admin||{stats:{},users:[],page:1,pages:1},d=state.adminDetail;
  if(d){
    return '<div class="page-body admin-page"><button class="admin-back" data-admin-back>'+icon('back')+' К пользователям</button>'+
      '<section class="admin-user-hero"><small>Telegram ID '+esc(d.user.telegramId)+' · UID '+d.user.id+'</small><b>'+esc(d.user.firstName||d.user.username||'Пользователь')+'</b><span>'+(d.user.username?'@'+esc(d.user.username):'Без username')+'</span><strong>'+fmt(d.user.capital)+'</strong></section>'+
      '<section class="admin-actions"><label>Изменить баланс<input id="adminMoney" inputmode="numeric" placeholder="Например 5000"></label><div><button data-admin-money="add">Добавить</button><button data-admin-money="take" class="secondary">Забрать</button></div><button data-admin-block="'+(d.user.blocked?'0':'1')+'" class="'+(d.user.blocked?'secondary':'danger-soft')+'">'+(d.user.blocked?'Разблокировать':'Заблокировать')+'</button><button data-admin-user-reset class="danger-soft">Сбросить прогресс пользователя</button></section>'+
      '<section class="admin-add-username"><b>Добавить username</b><input id="adminHandle" placeholder="@username" maxlength="11"><input id="adminValue" inputmode="numeric" placeholder="Стоимость — необязательно"><button data-admin-add-username>Добавить уникальный 1/1</button></section>'+
      '<div class="section-label">Usernames · '+d.user.usernameCount+'</div><div class="admin-usernames">'+(d.items.length?d.items.map(x=>'<article><div><b>'+esc(x.handle)+'</b><span>'+fmt(x.value)+' · '+x.status+'</span></div><div><button data-admin-value="'+x.id+'">Цена</button><button data-admin-transfer="'+x.id+'">Передать</button><button class="danger-soft" data-admin-remove="'+x.id+'">Удалить</button></div></article>').join(''):'<div class="empty">Нет активных usernames.</div>')+'</div></div>';
  }
  return '<div class="page-body admin-page">'+adminResetSheet()+
    '<div class="admin-dashboard"><div>'+metric('Пользователи',a.stats.users||0)+metric('За 24ч',a.stats.activeToday||0)+metric('Баланс',fmt(a.stats.money||0))+metric('Usernames',a.stats.activeUsernames||0)+'</div></div>'+
    '<div class="admin-search"><input id="adminQuery" value="'+esc(state.adminQuery||'')+'" placeholder="ID, username или имя"><button data-admin-search>'+icon('search')+'</button></div>'+
    '<div class="admin-users">'+(a.users.length?a.users.map(u=>'<button data-admin-user="'+u.id+'"><span><b>'+esc(u.first_name||u.username||'Пользователь')+'</b><small>'+esc(u.telegram_id)+(u.username?' · @'+esc(u.username):'')+'</small></span><strong>'+fmt(u.capital)+'</strong><em>'+(u.blocked?'BLOCK':icon('chevron'))+'</em></button>').join(''):'<div class="empty">Пользователи не найдены.</div>')+'</div>'+
    (a.pages>1?'<div class="pager"><button data-admin-pager="-1" '+(a.page<=1?'disabled':'')+'>Назад</button><span>'+a.page+' / '+a.pages+'</span><button data-admin-pager="1" '+(a.page>=a.pages?'disabled':'')+'>Дальше</button></div>':'')+
    '<section class="danger-zone"><small>ОПАСНАЯ ЗОНА</small><b>Сбросить прогресс всех игроков</b><span>Перед сбросом автоматически создаётся backup. Платежи и USERNAME+ не удаляются.</span><button class="danger" data-admin-reset-open>Сбросить прогресс всех игроков</button></section></div>';
}
document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el)return;
  try{
    if(el.hasAttribute('data-admin-search')){state.adminQuery=document.querySelector('#adminQuery')?.value||'';state.adminPage=1;await refreshAdmin();render();return}
    if(el.dataset.adminPager){state.adminPage=Math.max(1,(state.adminPage||1)+Number(el.dataset.adminPager));await refreshAdmin();render();return}
    if(el.dataset.adminUser){state.adminDetail=await api('/api/admin/users/'+el.dataset.adminUser);render();return}
    if(el.hasAttribute('data-admin-back')){state.adminDetail=null;render();return}
    if(el.dataset.adminMoney){const n=Math.abs(Number(document.querySelector('#adminMoney')?.value)||0);if(!n){toast('Введите сумму');return}await api('/api/admin/users/'+state.adminDetail.user.id+'/balance',{method:'POST',body:JSON.stringify({delta:el.dataset.adminMoney==='add'?n:-n})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Баланс обновлён');render();return}
    if(el.dataset.adminBlock!==undefined){await api('/api/admin/users/'+state.adminDetail.user.id+'/block',{method:'POST',body:JSON.stringify({value:el.dataset.adminBlock==='1'})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast(el.dataset.adminBlock==='1'?'Пользователь заблокирован':'Пользователь разблокирован');render();return}
    if(el.hasAttribute('data-admin-user-reset')){if(!confirm('Сбросить игровой прогресс этого пользователя?'))return;await api('/api/admin/users/'+state.adminDetail.user.id+'/reset',{method:'POST',body:'{}'});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Прогресс пользователя сброшен');render();return}
    if(el.hasAttribute('data-admin-add-username')){const handle=document.querySelector('#adminHandle')?.value||'',value=document.querySelector('#adminValue')?.value||'';await api('/api/admin/users/'+state.adminDetail.user.id+'/add-username',{method:'POST',body:JSON.stringify({handle,value})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Username добавлен');render();return}
    if(el.dataset.adminRemove){if(!confirm('Удалить этот username у пользователя?'))return;await api('/api/admin/usernames/'+el.dataset.adminRemove+'/remove',{method:'POST',body:'{}'});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Username удалён');render();return}
    if(el.dataset.adminTransfer){const target=prompt('Внутренний UID пользователя, которому передать username:');if(!target)return;await api('/api/admin/usernames/'+el.dataset.adminTransfer+'/transfer',{method:'POST',body:JSON.stringify({targetId:Number(target)})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Username передан');render();return}
    if(el.dataset.adminValue){const value=prompt('Новая игровая стоимость username:');if(!value)return;await api('/api/admin/usernames/'+el.dataset.adminValue+'/value',{method:'POST',body:JSON.stringify({value:Number(value)})});state.adminDetail=await api('/api/admin/users/'+state.adminDetail.user.id);toast('Стоимость обновлена');render();return}
    if(el.hasAttribute('data-admin-reset-open')){state.adminResetStage=1;render();return}
    if(el.hasAttribute('data-admin-reset-close')){state.adminResetStage=0;render();return}
    if(el.hasAttribute('data-admin-reset-arm')){state.adminResetStage=2;render();return}
    if(el.hasAttribute('data-admin-reset-confirm')){await api('/api/admin/reset-all',{method:'POST',body:JSON.stringify({confirmation:'RESET USERNAME'})});state.adminResetStage=0;state.adminDetail=null;await refreshUser();state.adminPage=1;await refreshAdmin();toast('Все игровые профили сброшены');render();return}
  }catch(err){toast(ERR[err.message]||'Ошибка админки');el.disabled=false}
});
document.addEventListener('input',e=>{if(e.target.id==='adminResetPhrase'){const btn=document.querySelector('[data-admin-reset-arm]');if(btn)btn.disabled=e.target.value!=='RESET USERNAME'}});

window.USERNAME_ADMIN={view:adminView,refresh:refreshAdmin};
