let TG=window.Telegram?.WebApp;
const root=document.documentElement,app=document.querySelector('#app'),toastEl=document.querySelector('#toast');
const state={page:'home',home:null,collection:null,leaderboard:null,tasks:null,profile:null,filters:{rarity:'ALL',sort:'new',page:1},rankMode:'collection',rankPage:1,busy:false};
const fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' NC';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errors={unauthorized:'Откройте игру через Telegram',blocked:'Аккаунт заблокирован',insufficient_funds:'Недостаточно NC',pending_drop:'Сначала решите, что делать с текущим username',collection_full:'Коллекция заполнена',sold_out:'Тираж закончился',too_fast:'Слишком быстро. Попробуйте ещё раз',network:'Нет соединения с сервером',showcase_full:'Витрина заполнена'};
function syncViewport(){const h=TG?.viewportStableHeight||TG?.viewportHeight||innerHeight;if(h)root.style.setProperty('--app-h',Math.round(h)+'px');const s=TG?.safeAreaInset||{},c=TG?.contentSafeAreaInset||{};root.style.setProperty('--safe-t',Math.max(s.top||0,c.top||0)+'px');root.style.setProperty('--safe-b',Math.max(s.bottom||0,c.bottom||0)+'px')}
try{TG?.ready();TG?.expand();TG?.setHeaderColor?.('#F4F5F7');TG?.setBackgroundColor?.('#F4F5F7');syncViewport();TG?.onEvent?.('viewportChanged',syncViewport);TG?.onEvent?.('safeAreaChanged',syncViewport);TG?.onEvent?.('contentSafeAreaChanged',syncViewport)}catch{syncViewport()}
addEventListener('resize',syncViewport);
function haptic(type='light'){try{TG?.HapticFeedback?.impactOccurred(type)}catch{}}
function toast(t){toastEl.textContent=t;toastEl.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>toastEl.classList.remove('show'),1900)}
async function initData(){let d=TG?.initData||'',end=Date.now()+1600;while(!d&&Date.now()<end){await new Promise(r=>setTimeout(r,50));TG=window.Telegram?.WebApp||TG;d=TG?.initData||''}return d}
async function api(url,opts={}){const headers={'Content-Type':'application/json',...(opts.headers||{})};const d=await initData();if(d)headers['X-Telegram-Init-Data']=d;else if(location.hostname==='localhost'||location.hostname==='127.0.0.1')headers['X-Dev-User']=localStorage.devUser||'10001';const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),8000);try{const r=await fetch(url,{...opts,headers,cache:'no-store',signal:ctl.signal});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'network');return j}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('network');throw e}finally{clearTimeout(tm)}}
const ICON={
home:'<path d="M4 11.5 12 5l8 6.5V20H5V11.5Z"/><path d="M9 20v-6h6v6"/>',
grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
rank:'<path d="M5 20V11h4v9M10 20V5h4v15M15 20v-7h4v7"/>',
tasks:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>',
user:'<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
back:'<path d="m15 18-6-6 6-6"/>',
more:'<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>'
};
function icon(k){return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICON[k]||ICON.more)+'</svg>'}
function nav(){const items=[['home','home','Главная'],['collection','grid','Коллекция'],['top','rank','Топ'],['tasks','tasks','Задания'],['profile','user','Профиль']];return '<nav class="nav">'+items.map(([p,i,t])=>'<button data-page="'+p+'" class="'+(state.page===p?'active':'')+'">'+icon(i)+'<span>'+t+'</span></button>').join('')+'</nav>'}
function shell(html){app.innerHTML='<div class="shell"><section class="screen">'+html+'</section>'+nav()+'</div>'}
function badge(r){return '<span class="rarity '+String(r).toLowerCase()+'">'+esc(r)+'</span>'}
function header(title,sub=''){return '<header class="page-head"><div><b>'+esc(title)+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div></header>'}
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function homeView(){
 const h=state.home,u=h.user,last=h.last,p=h.pending;
 return '<div class="home">'+
 '<header class="brand"><b>USERNAME</b><div><span>Баланс</span><strong>'+fmt(u.balance)+'</strong></div></header>'+
 '<div class="metrics">'+metric('Коллекция',fmt(u.collectionValue))+metric('Рейтинг','#'+u.rank)+metric('Тегов',u.collectionCount)+'</div>'+
 '<section class="drop-zone"><div class="drop-label">DROP</div><p>Получите случайный username</p>'+
 (p?resultCard(p,true):'<div class="handle-stage" id="handleStage"><span>@</span><b>username</b></div>'+
 '<button class="drop-btn" id="dropBtn"><span>'+(u.freeDrops>0?'Получить бесплатно':'Получить username')+'</span><b>'+(u.freeDrops>0?u.freeDrops+' бесплатно':fmt(h.config.dropCost))+'</b></button>'+
 '<small class="drop-note">'+(u.freeDrops>0?u.freeDrops+' бесплатных дропа осталось':'Результат определяется сервером до анимации')+'</small>')+
 '</section>'+
 '<section class="last">'+
 '<div class="section-title"><span>Последний дроп</span></div>'+
 (last?'<div class="last-row"><b>'+esc(last.handle)+'</b>'+badge(last.rarity)+'<strong>'+fmt(last.value)+'</strong></div>':'<div class="empty-line">История появится после первого дропа.</div>')+
 '</section></div>';
}
function resultCard(x,pending=false){return '<div class="result-card '+String(x.rarity).toLowerCase()+'"><span class="result-kicker">USERNAME</span><h1>'+esc(x.handle)+'</h1><div class="result-meta">'+badge(x.rarity)+'<b>'+fmt(x.value)+'</b></div><div class="result-supply">#'+x.instanceNumber+' / '+x.maxSupply+'</div>'+(pending?'<div class="result-actions"><button data-resolve="keep" data-id="'+x.id+'">Оставить</button><button class="ghost" data-resolve="sell" data-id="'+x.id+'">Продать за '+fmt(x.value)+'</button></div>':'')+'</div>'}
async function animateDrop(result){
 const stage=document.querySelector('#handleStage'),btn=document.querySelector('#dropBtn');if(!stage||!btn)return;
 btn.disabled=true;const samples=['@vision','@storm7','@phantom','@dealer77','@blackout','@master7','@prime','@ghost77','@mister777'];let i=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const delays=reduced?[80,100]:[55,55,60,70,85,110,150,220,330,470];
 for(const d of delays){stage.classList.add('rolling');stage.innerHTML='<b>'+esc(samples[i%samples.length])+'</b>';i++;await new Promise(r=>setTimeout(r,d))}
 stage.innerHTML='<b>'+esc(result.handle)+'</b>';stage.classList.remove('rolling');stage.classList.add('land');haptic('medium');await new Promise(r=>setTimeout(r,reduced?120:420));state.home.pending=result;render();
}
function collectionView(){
 const c=state.collection;
 return header('Коллекция',c.total+' usernames')+
 '<div class="collection-tools"><div class="chips">'+['ALL','COMMON','RARE','EPIC','LEGEND','ULTRA'].map(r=>'<button data-rarity="'+r+'" class="'+(state.filters.rarity===r?'active':'')+'">'+(r==='ALL'?'Все':r)+'</button>').join('')+'</div>'+
 '<select id="sortSelect"><option value="new" '+(state.filters.sort==='new'?'selected':'')+'>Новые</option><option value="value" '+(state.filters.sort==='value'?'selected':'')+'>Цена</option><option value="rarity" '+(state.filters.sort==='rarity'?'selected':'')+'>Редкость</option><option value="short" '+(state.filters.sort==='short'?'selected':'')+'>Короткие</option></select></div>'+
 '<div class="collection-grid">'+(c.items.length?c.items.map(x=>'<button class="user-card" data-detail="'+x.id+'"><span>'+x.handle+'</span>'+badge(x.rarity)+'<b>'+fmt(x.value)+'</b><small>#'+x.instanceNumber+' / '+x.maxSupply+'</small></button>').join(''):'<div class="empty">Здесь пока пусто.</div>')+'</div>'+
 (c.pages>1?'<div class="pager"><button data-prev>Назад</button><span>'+c.page+' / '+c.pages+'</span><button data-next>Дальше</button></div>':'');
}
function topView(){
 const all=state.leaderboard?.items||[],size=8,pages=Math.max(1,Math.ceil(all.length/size));state.rankPage=Math.max(1,Math.min(state.rankPage,pages));const list=all.slice((state.rankPage-1)*size,state.rankPage*size);
 return header('Топ','Лучшие коллекции')+
 '<div class="mode-tabs">'+[['collection','Коллекция'],['capital','Капитал'],['best','Лучший username']].map(([m,t])=>'<button data-mode="'+m+'" class="'+(state.rankMode===m?'active':'')+'">'+t+'</button>').join('')+'</div>'+
 '<div class="rank-list">'+list.map(r=>'<button class="rank-row" data-profile="'+r.id+'"><span class="pos">'+r.position+'</span><div><b>'+esc(r.first_name||r.username||'Игрок')+'</b><small>'+(r.best_handle||'—')+'</small></div><strong>'+fmt(state.rankMode==='capital'?r.capital:state.rankMode==='best'?r.best:r.collection_value)+'</strong></button>').join('')+'</div>'+
 (pages>1?'<div class="pager"><button data-rank-prev>Назад</button><span>'+state.rankPage+' / '+pages+'</span><button data-rank-next>Дальше</button></div>':'');
}
function tasksView(){
 const list=state.tasks?.items||[];
 return header('Задания','Обновляются каждый день')+'<div class="task-list">'+list.map(t=>'<div class="task"><div><b>'+esc(t.label)+'</b><span>'+t.current+' / '+t.target+'</span></div><strong>+'+fmt(t.reward)+'</strong><div class="progress"><i style="width:'+Math.min(100,t.current/t.target*100)+'%"></i></div><button data-claim="'+t.key+'" '+(t.current<t.target||t.claimed?'disabled':'')+'>'+(t.claimed?'Получено':t.current>=t.target?'Забрать':'В процессе')+'</button></div>').join('')+'</div>';
}
function profileView(p=state.profile?.profile){
 if(!p)return header('Профиль')+'<div class="empty">Профиль не найден.</div>';
 return header(p.firstName||'Игрок',p.username?'@'+p.username:'')+
 '<div class="profile-hero"><div class="avatar">'+esc((p.firstName||'U')[0].toUpperCase())+'</div><b>Уровень '+p.level+'</b><span>#'+p.rank+' в рейтинге</span></div>'+
 '<div class="profile-metrics">'+metric('Капитал',fmt(p.balance+p.collectionValue))+metric('Баланс',fmt(p.balance))+metric('Коллекция',fmt(p.collectionValue))+metric('Тегов',p.collectionCount)+metric('Лучший',p.best?esc(p.best.handle):'—')+metric('USERNAME+',p.premium?'Активен':'Нет')+'</div>'+
 '<section class="showcase"><div class="section-title"><span>Витрина</span></div><div class="showcase-row">'+(p.showcase?.length?p.showcase.map(x=>'<div>'+x.handle+'<small>'+x.rarity+'</small></div>').join(''):'<div class="empty-line">Добавьте usernames из коллекции.</div>')+'</div></section>';
}
function detailView(x){return '<div class="detail"><button class="back" data-back>'+icon('back')+'</button>'+resultCard(x,false)+'<div class="detail-grid">'+metric('Экземпляр','#'+x.instanceNumber+' / '+x.maxSupply)+metric('Получен',new Date(x.obtainedAt).toLocaleDateString('ru-RU'))+metric('Длина',String(x.rawHandle?.length||x.handle.length-1))+metric('Редкость',x.rarity)+'</div><button class="showcase-btn" data-showcase="'+x.id+'">Добавить на витрину</button></div>'}
function render(){if(state.page==='home')shell(homeView());else if(state.page==='collection')shell(collectionView());else if(state.page==='top')shell(topView());else if(state.page==='tasks')shell(tasksView());else if(state.page==='profile')shell(profileView())}
async function load(page){
 state.page=page;app.innerHTML='<div class="boot"><b>USERNAME</b><span></span></div>';
 try{
  if(page==='home')state.home=await api('/api/home');
  if(page==='collection')state.collection=await api('/api/collection?rarity='+state.filters.rarity+'&sort='+state.filters.sort+'&page='+state.filters.page);
  if(page==='top')state.leaderboard=await api('/api/leaderboard?mode='+state.rankMode);
  if(page==='tasks')state.tasks=await api('/api/tasks');
  if(page==='profile')state.profile=await api('/api/profile');
  render();
 }catch(e){shell('<div class="error"><b>'+esc(errors[e.message]||e.message)+'</b><button data-page="'+page+'">Повторить</button></div>')}
}
document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;try{
 if(el.dataset.page){await load(el.dataset.page);return}
 if(el.id==='dropBtn'&&!state.busy){state.busy=true;el.disabled=true;const requestId=crypto.randomUUID?.()||('req-'+Date.now()+'-'+Math.random().toString(36).slice(2));const r=await api('/api/drop',{method:'POST',body:JSON.stringify({requestId})});state.home.user=r.user;await animateDrop(r.instance);state.busy=false;return}
 if(el.dataset.resolve){state.busy=true;const r=await api('/api/drop/'+el.dataset.id+'/resolve',{method:'POST',body:JSON.stringify({action:el.dataset.resolve})});toast(el.dataset.resolve==='keep'?'Добавлено в коллекцию':'Продано за '+fmt(state.home.pending.value));state.busy=false;await load('home');return}
 if(el.dataset.rarity){state.filters.rarity=el.dataset.rarity;state.filters.page=1;await load('collection');return}
 if(el.hasAttribute('data-prev')){state.filters.page=Math.max(1,state.filters.page-1);await load('collection');return}
 if(el.hasAttribute('data-next')){state.filters.page++;await load('collection');return}
 if(el.dataset.mode){state.rankMode=el.dataset.mode;state.rankPage=1;await load('top');return}
 if(el.hasAttribute('data-rank-prev')){state.rankPage=Math.max(1,state.rankPage-1);render();return}
 if(el.hasAttribute('data-rank-next')){state.rankPage++;render();return}
 if(el.dataset.claim){const r=await api('/api/tasks/'+el.dataset.claim+'/claim',{method:'POST'});toast('+'+fmt(r.reward));await load('tasks');return}
 if(el.dataset.profile){const r=await api('/api/profile/'+el.dataset.profile);state.page='profile';shell(profileView(r.profile));return}
 if(el.dataset.detail){const item=state.collection?.items.find(x=>x.id===el.dataset.detail);if(item){state.page='detail';app.innerHTML='<div class="shell"><section class="screen">'+detailView(item)+'</section>'+nav()+'</div>'}return}
 if(el.dataset.showcase){await api('/api/showcase/'+el.dataset.showcase,{method:'POST'});toast('Добавлено на витрину');return}
 if(el.hasAttribute('data-back')){await load('collection');return}
}catch(err){state.busy=false;toast(errors[err.message]||err.message||'Ошибка');el.disabled=false}});
document.addEventListener('change',async e=>{if(e.target.id==='sortSelect'){state.filters.sort=e.target.value;state.filters.page=1;await load('collection')}});
load('home');
