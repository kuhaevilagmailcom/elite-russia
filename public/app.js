let TG=window.Telegram?.WebApp;
const root=document.documentElement,app=document.querySelector('#app'),toastEl=document.querySelector('#toast');
const state={
  page:'home',user:null,home:null,collection:null,market:null,leaderboard:null,tasks:null,wheel:null,friends:null,gift:null,upgrader:null,season:null,profile:null,premium:null,detail:null,
  menu:false,busy:false,backPage:'collection',dropTier:'basic',dropPicker:false,upgradeOutcome:null,
  filters:{rarity:'ALL',sort:'new',page:1},
  marketFilters:{rarity:'ALL',sort:'new',q:'',page:1},
  rankMode:'collection',rankPeriod:'all',rankPage:1,
  upgradeSelectedIds:[],upgradePreview:null,upgradeSpinning:false
};
const fmt=n=>'$'+new Intl.NumberFormat('en-US').format(Math.round(Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ERR={
  unauthorized:'Откройте игру через Telegram',blocked:'Аккаунт заблокирован',insufficient_funds:'Недостаточно NC',pending_drop:'Сначала решите, что делать с текущим username',
  collection_full:'Коллекция заполнена',recipient_full:'У получателя заполнена коллекция',sold_out:'Тираж закончился',too_fast:'Слишком быстро. Попробуйте ещё раз',
  listing_not_found:'Лот уже недоступен',own_listing:'Нельзя купить свой лот',already_listed:'Username уже на рынке',not_friend:'Пользователь не в списке друзей',
  wheel_cooldown:'Колесо уже использовано сегодня',upgrade_invalid_items:'Выбранные usernames недоступны',upgrade_bad_recipe:'Неверный набор для апгрейда',
  upgrade_session_expired:'Предпросмотр устарел. Выберите usernames заново',upgrade_session_mismatch:'Состав апгрейда изменился',premium_unavailable:'Telegram Stars пока недоступны',showcase_full:'Витрина заполнена',network:'Нет соединения с сервером'
};
function syncViewport(){const h=TG?.viewportStableHeight||TG?.viewportHeight||innerHeight;if(h)root.style.setProperty('--app-h',Math.round(h)+'px');const s=TG?.safeAreaInset||{},c=TG?.contentSafeAreaInset||{};root.style.setProperty('--safe-t',Math.max(s.top||0,c.top||0)+'px');root.style.setProperty('--safe-b',Math.max(s.bottom||0,c.bottom||0)+'px')}
try{TG?.ready();TG?.expand();TG?.setHeaderColor?.('#F4F5F7');TG?.setBackgroundColor?.('#F4F5F7');syncViewport();TG?.onEvent?.('viewportChanged',syncViewport);TG?.onEvent?.('safeAreaChanged',syncViewport);TG?.onEvent?.('contentSafeAreaChanged',syncViewport)}catch{syncViewport()}
addEventListener('resize',syncViewport);
function haptic(type='light'){try{TG?.HapticFeedback?.impactOccurred(type)}catch{}}
function toast(t){toastEl.textContent=t;toastEl.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>toastEl.classList.remove('show'),1900)}
async function initData(){let d=TG?.initData||'',end=Date.now()+1600;while(!d&&Date.now()<end){await new Promise(r=>setTimeout(r,50));TG=window.Telegram?.WebApp||TG;d=TG?.initData||''}return d}
function startParam(){return String(TG?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('ref')||'')}
async function api(url,opts={}){const headers={'Content-Type':'application/json',...(opts.headers||{})};const d=await initData();if(d)headers['X-Telegram-Init-Data']=d;else if(location.hostname==='localhost'||location.hostname==='127.0.0.1')headers['X-Dev-User']=localStorage.devUser||'10001';const sp=startParam();if(sp)headers['X-Start-Param']=sp;const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),9000);try{const r=await fetch(url,{...opts,headers,cache:'no-store',signal:ctl.signal});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'network');return j}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('network');throw e}finally{clearTimeout(tm)}}
const ICON={
home:'<path d="M4 11.5 12 5l8 6.5V20H5V11.5Z"/><path d="M9 20v-6h6v6"/>',menu:'<path d="M5 7h14M5 12h14M5 17h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="m15 18-6-6 6-6"/>',
market:'<path d="M4 9h16l-1-4H5L4 9Z"/><path d="M6 9v10h12V9M9 19v-5h6v5"/>',rank:'<path d="M5 20V12h4v8M10 20V5h4v15M15 20v-10h4v10"/>',
tasks:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>',
wheel:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7"/>',
friends:'<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0M14 17a5 5 0 0 1 7 3"/>',
gift:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16"/><path d="M12 9c-4-1-5-3-3-4 1.7-.8 3 1 3 4Zm0 0c4-1 5-3 3-4-1.7-.8-3 1-3 4Z"/>',
upgrade:'<path d="M12 20V7M7 12l5-5 5 5"/><path d="M5 4h14"/>',season:'<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M12 13v5M8 21h8"/>',
collection:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
profile:'<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',premium:'<path d="m12 3 3 5 6 1-4 4 .8 6L12 16l-5.8 3L7 13 3 9l6-1 3-5Z"/>'
};
function icon(k){return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICON[k]||ICON.menu)+'</svg>'}
function badge(r){return '<span class="rarity '+String(r).toLowerCase()+'">'+esc(r)+'</span>'}
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function balance(){return fmt(state.user?.balance||state.home?.user?.balance||0)}
const MENU=[
 ['home','home','Дроп','Прокрутка usernames'],['market','market','Рынок','Покупка и продажа usernames'],['top','rank','Рейтинг','Лучшие коллекции'],['tasks','tasks','Задания','Ежедневные цели'],['wheel','wheel','Колесо','Бесплатная награда'],
 ['friends','friends','Друзья','Приглашения и друзья'],['gift','gift','Подарок','Отправить username другу'],['upgrader','upgrade','Апгрейдер','До 5 usernames · общий риск'],['seasons','season','Сезоны','Текущий сезон и награды']
];
const MENU_BOTTOM=[['collection','collection','Коллекция'],['profile','profile','Профиль'],['premium','premium','USERNAME+']];
function menuHtml(){return '<div class="menu-backdrop '+(state.menu?'open':'')+'" data-menu-close><aside class="menu-sheet" data-menu-sheet><div class="menu-head"><div><small>USERNAME</small><b>Меню</b></div><button data-menu-close>'+icon('close')+'</button></div><div class="menu-list">'+MENU.map(([p,i,t,s])=>'<button data-page="'+p+'"><span class="menu-icon">'+icon(i)+'</span><span><b>'+t+'</b><small>'+s+'</small></span><em>›</em></button>').join('')+'</div><div class="menu-divider"></div><div class="menu-list compact">'+MENU_BOTTOM.map(([p,i,t])=>'<button data-page="'+p+'"><span class="menu-icon">'+icon(i)+'</span><span><b>'+t+'</b></span><em>›</em></button>').join('')+'</div></aside></div>'}
function topbar(title,{back=false}={}){return '<header class="topbar">'+(back?'<button class="top-back" data-back>'+icon('back')+'</button>':'')+'<div class="top-title"><b>'+esc(title)+'</b></div><div class="top-actions"><span>'+balance()+'</span><button data-menu-open>'+icon('menu')+'</button></div></header>'}
function shell(title,html,opts={}){window.__USERNAME_READY=true;app.innerHTML='<div class="shell"><section class="screen">'+topbar(title,opts)+html+'</section>'+menuHtml()+'</div>'}
function resultCard(x,pending=false){return '<div class="result-card '+String(x.rarity).toLowerCase()+'"><span class="result-kicker">USERNAME</span><h1>'+esc(x.handle)+'</h1><div class="result-meta">'+badge(x.rarity)+'<b>'+fmt(x.value)+'</b></div><div class="result-supply">#'+x.instanceNumber+' / '+x.maxSupply+'</div>'+(pending?'<div class="result-actions"><button data-resolve="keep" data-id="'+x.id+'">Оставить</button><button class="ghost" data-resolve="sell" data-id="'+x.id+'">Продать за '+fmt(x.value)+'</button></div>':'')+'</div>'}
function selectedDropTier(){
  const tiers=state.home?.config?.dropTiers||{};
  return tiers[state.dropTier]||tiers.basic||{key:'basic',label:'$2K',cost:2000};
}
function dropPricePicker(tiers){
 if(!state.dropPicker)return '';
 return '<div class="drop-cost-overlay"><button class="drop-cost-back" data-drop-picker-close aria-label="Закрыть"></button><div class="drop-cost-sheet"><div class="drop-cost-title"><b>Стоимость попытки</b><span>Выберите цену дропа</span></div>'+Object.values(tiers).map(t=>'<button class="drop-cost-option '+(state.dropTier===t.key?'active':'')+'" data-drop-tier="'+t.key+'"><span>'+esc(t.label)+'</span><b>'+fmt(t.cost)+'</b></button>').join('')+'</div></div>';
}
function homeView(){
 const h=state.home,u=h.user,last=h.last,p=h.pending,tiers=h.config.dropTiers||{},tier=selectedDropTier();
 const freeBasic=u.freeDrops>0&&state.dropTier==='basic',payCost=freeBasic?0:Number(tier.cost||2000),cantAfford=!freeBasic&&u.balance<payCost;
 return '<div class="home">'+dropPricePicker(tiers)+'<div class="home-metrics">'+metric('Коллекция',fmt(u.collectionValue))+metric('Место','#'+u.rank)+metric('Usernames',u.collectionCount)+'</div>'+
 '<section class="drop-zone"><div class="drop-label">DROP</div><p>Получите случайный username</p>'+
 (!p?'<button class="drop-cost-trigger" data-drop-picker-open><span>Стоимость попытки</span><b>'+fmt(tier.cost)+' <em>⌄</em></b></button>':'')+
 (p?resultCard(p,true):'<div class="handle-stage" id="handleStage"><span>@</span><b>username</b></div><button class="drop-btn" id="dropBtn" '+(cantAfford?'disabled':'')+'><span>'+(freeBasic?'Получить бесплатно':'Получить username')+'</span><b>'+(freeBasic?u.freeDrops+' осталось':fmt(payCost))+'</b></button><small class="drop-note">'+(freeBasic?'Базовая попытка сейчас бесплатна':cantAfford?'Недостаточно денег для выбранной стоимости':'Цена влияет на качество пула, проценты скрыты')+'</small>')+'</section>'+
 '<section class="last"><div class="section-title"><span>Последний username</span></div>'+(last?'<div class="last-row"><b>'+esc(last.handle)+'</b>'+badge(last.rarity)+'<strong>'+fmt(last.value)+'</strong></div>':'<div class="empty-line">История появится после первого дропа.</div>')+'</section></div>';
}
async function animateDrop(result){const stage=document.querySelector('#handleStage'),btn=document.querySelector('#dropBtn');if(!stage||!btn)return;btn.disabled=true;const samples=['@vision','@storm7','@phantom','@dealer77','@blackout','@master7','@prime','@ghost77','@mister777'];const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,delays=reduced?[80,100]:[55,55,60,70,85,110,150,220,330,470];let i=0;for(const d of delays){stage.classList.add('rolling');stage.innerHTML='<b>'+samples[i++%samples.length]+'</b>';await new Promise(r=>setTimeout(r,d))}stage.innerHTML='<b>'+esc(result.handle)+'</b>';stage.classList.remove('rolling');stage.classList.add('land');haptic('medium');await new Promise(r=>setTimeout(r,reduced?120:420));state.home.pending=result;render()}
function collectionView(){const c=state.collection;return '<div class="page-body"><div class="collection-tools"><div class="chips">'+['ALL','COMMON','RARE','EPIC','LEGEND','ULTRA'].map(r=>'<button data-rarity="'+r+'" class="'+(state.filters.rarity===r?'active':'')+'">'+(r==='ALL'?'Все':r)+'</button>').join('')+'</div><select id="sortSelect"><option value="new" '+(state.filters.sort==='new'?'selected':'')+'>Новые</option><option value="value" '+(state.filters.sort==='value'?'selected':'')+'>Дорогие</option><option value="rarity" '+(state.filters.sort==='rarity'?'selected':'')+'>Редкие</option><option value="short" '+(state.filters.sort==='short'?'selected':'')+'>Короткие</option></select></div><div class="collection-grid">'+(c.items.length?c.items.map(x=>'<article class="user-card"><button class="user-card-main" data-detail="'+x.id+'"><span>'+x.handle+'</span>'+badge(x.rarity)+'<b>'+fmt(x.value)+'</b><small>#'+x.instanceNumber+' / '+x.maxSupply+'</small></button><button class="user-card-sell" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">Продать</button></article>').join(''):'<div class="empty">Здесь пока пусто.</div>')+'</div>'+pager(c.page,c.pages,'collection')+'</div>'}
function pager(page,pages,type){if(pages<=1)return '';return '<div class="pager"><button data-pager="'+type+'" data-dir="-1" '+(page<=1?'disabled':'')+'>Назад</button><span>'+page+' / '+pages+'</span><button data-pager="'+type+'" data-dir="1" '+(page>=pages?'disabled':'')+'>Дальше</button></div>'}
function marketView(){const m=state.market;return '<div class="page-body"><div class="market-search"><input id="marketQuery" value="'+esc(state.marketFilters.q)+'" placeholder="Поиск username"><button data-market-search>Найти</button></div><div class="market-tools"><div class="chips">'+['ALL','RARE','EPIC','LEGEND','ULTRA'].map(r=>'<button data-market-rarity="'+r+'" class="'+(state.marketFilters.rarity===r?'active':'')+'">'+(r==='ALL'?'Все':r)+'</button>').join('')+'</div><select id="marketSort"><option value="new">Новые</option><option value="cheap">Дешёвые</option><option value="expensive">Дорогие</option><option value="rare">Редкие</option><option value="short">Короткие</option></select></div><div class="market-list">'+(m.items.length?m.items.map(x=>'<article class="market-card"><div><span>'+x.handle+'</span>'+badge(x.rarity)+'</div><small>Продавец: '+esc(x.sellerName)+'</small><b>'+fmt(x.price)+'</b>'+(x.sellerId===state.user?.id?'<button class="secondary" data-market-cancel="'+x.id+'">Снять</button>':'<button data-market-buy="'+x.id+'">Купить</button>')+'</article>').join(''):'<div class="empty">На рынке пока ничего нет.</div>')+'</div>'+pager(m.page,m.pages,'market')+'</div>'}
function topView(){const all=state.leaderboard?.items||[],size=8,pages=Math.max(1,Math.ceil(all.length/size));state.rankPage=Math.max(1,Math.min(state.rankPage,pages));const list=all.slice((state.rankPage-1)*size,state.rankPage*size);return '<div class="page-body"><div class="mode-tabs">'+[['collection','Коллекция'],['capital','Капитал'],['best','Лучший username']].map(([m,t])=>'<button data-mode="'+m+'" class="'+(state.rankMode===m?'active':'')+'">'+t+'</button>').join('')+'</div><div class="period-tabs">'+[['week','Неделя'],['month','Месяц'],['season','Сезон'],['all','Всё время']].map(([p,t])=>'<button data-period="'+p+'" class="'+(state.rankPeriod===p?'active':'')+'">'+t+'</button>').join('')+'</div><div class="rank-list">'+list.map(r=>'<button class="rank-row '+(r.position<=3?'top'+r.position:'')+'" data-profile="'+r.id+'"><span class="pos">'+r.position+'</span><div><b>'+esc(r.first_name||r.username||'Игрок')+'</b><small>'+(r.best_handle||'—')+'</small></div><strong>'+fmt(state.rankMode==='capital'?r.capital:state.rankMode==='best'?r.best:r.collection_value)+'</strong></button>').join('')+'</div>'+pager(state.rankPage,pages,'rank')+'</div>'}
function tasksView(){return '<div class="page-scroll task-list">'+(state.tasks?.items||[]).map(t=>'<article class="task"><div><b>'+esc(t.label)+'</b><span>'+t.current+' / '+t.target+'</span></div><strong>+'+fmt(t.reward)+'</strong><div class="progress"><i style="width:'+Math.min(100,t.current/t.target*100)+'%"></i></div><button data-claim="'+t.key+'" '+(t.current<t.target||t.claimed?'disabled':'')+'>'+(t.claimed?'Получено':t.current>=t.target?'Забрать':'В процессе')+'</button></article>').join('')+'</div>'}
function wheelView(){
 const w=state.wheel,items=(w.rewards||[]),short={'nc500':'$500','nc1000':'$1K','xp50':'50 XP','nc2500':'$2.5K','drop1':'FREE DROP','nc5000':'$5K'};
 return '<div class="wheel-page"><div class="daily-wheel-shell"><div class="daily-wheel-pointer"></div><div class="daily-wheel" id="wheelDisc">'+items.map((x,i)=>'<span class="daily-wheel-label" style="--i:'+i+'">'+esc(short[x.key]||x.label)+'</span>').join('')+'<div class="daily-wheel-core"><b>DAILY</b><span>USERNAME</span></div></div></div><div class="wheel-copy"><b>'+(w.available?'Ежедневное вращение доступно':'Колесо уже использовано')+'</b><span>'+(w.available?'Одно бесплатное вращение каждые 24 часа.':('Следующее: '+new Date(w.nextAt).toLocaleString('ru-RU')))+'</span></div><button class="primary wheel-spin-button" data-wheel '+(!w.available?'disabled':'')+'>Крутить колесо</button><div id="wheelResult" class="wheel-result"></div></div>';
}
function friendsView(){const f=state.friends;return '<div class="page-body"><section class="ref-card"><span>Ваша ссылка</span><div><input id="refLink" readonly value="'+esc(f.referralLink)+'"><button data-copy-ref>Копировать</button></div></section><div class="home-metrics">'+metric('Приглашено',f.invited)+metric('Активных',f.active)+metric('Наград',f.rewards.length)+'</div><div class="section-label">Друзья</div><div class="friends-list">'+(f.friends.length?f.friends.map(x=>'<div class="friend-row"><div><b>'+esc(x.first_name||x.username||'Игрок')+'</b><span>'+(x.username?'@'+esc(x.username):'Без username')+'</span></div><strong>ур. '+x.level+'</strong></div>').join(''):'<div class="empty">Пригласите первого друга.</div>')+'</div></div>'}
function giftView(){const g=state.gift;return '<div class="gift-page"><div class="form-card"><label>Username<select id="giftInstance"><option value="">Выберите username</option>'+g.items.map(x=>'<option value="'+x.id+'">'+x.handle+' · '+x.rarity+' · '+fmt(x.value)+'</option>').join('')+'</select></label><label>Друг<select id="giftFriend"><option value="">Выберите друга</option>'+g.friends.map(x=>'<option value="'+x.id+'">'+esc(x.first_name||x.username||'Игрок')+'</option>').join('')+'</select></label><div class="notice">Передача необратима. Username должен находиться в вашей коллекции и не быть выставлен на рынке.</div><button class="primary" data-gift>Подарить username</button></div></div>'}
function selectedUpgradeItems(){
 const list=state.upgrader?.available||[],set=new Set(state.upgradeSelectedIds||[]);
 return list.filter(x=>set.has(x.id));
}
function upgraderView(){
 const u=state.upgrader||{available:[],maxItems:5},selected=selectedUpgradeItems(),p=state.upgradePreview;
 if(state.upgradeOutcome){
   const r=state.upgradeOutcome,n=r.sources?.length||0,names=(r.sources||[]).slice(0,4).map(x=>x.handle).join(', ');
   return '<div class="upgrade-result-screen"><div class="upgrade-result-card '+(r.success?'success':'fail')+'"><small>АПГРЕЙД</small><h2>'+(r.success?'Победа':'Проигрыш')+'</h2><div class="upgrade-result-source">'+n+' username'+(n===1?'':'s')+' · '+esc(names)+(n>4?'…':'')+'</div>'+(r.success?'<div class="upgrade-result-target"><span>Вы выиграли</span><b>'+esc(r.result.handle)+'</b><strong>'+esc(r.result.rarity)+' · '+fmt(r.result.value)+'</strong></div>':'<div class="upgrade-result-target lost"><span>Сгорело</span><b>'+n+' username'+(n===1?'':'s')+'</b><strong>Приз '+esc(r.target?.handle||'')+' не получен</strong></div>')+'<button class="primary" data-upgrade-continue>Продолжить</button></div></div>';
 }
 const chance=p?Math.round(Number(p.chance||0)*100):0,winDeg=Math.max(1,(Number(p?.chance)||.2)*360),total=selected.reduce((s,x)=>s+Number(x.value||0),0);
 return '<div class="upgrade-multi-page"><div class="upgrade-multi-head"><div><small>ВЫБРАНО</small><b>'+selected.length+' / '+(u.maxItems||5)+'</b><span>'+fmt(total)+'</span></div>'+(selected.length?'<button data-up-clear>Очистить</button>':'')+'</div>'+
 '<div class="upgrade-selected-strip">'+(selected.length?selected.map(x=>'<button data-up-remove="'+x.id+'"><span>'+esc(x.handle)+'</span><small>'+x.rarity+'</small><em>×</em></button>').join(''):'<div class="upgrade-empty-slot">Выберите от 1 до 5 usernames ниже</div>')+'</div>'+
 (selected.length?'<div class="upgrade-multi-stage">'+(p?'<div class="upgrade-prize-card"><span>Можно выиграть</span><b>'+esc(p.target.handle)+'</b><strong>'+p.target.rarity+' · '+fmt(p.target.value)+'</strong></div><div class="upgrade-wheel-wrap multi"><div class="upgrade-wheel-pointer" id="upgradePointer"></div><div class="upgrade-roulette" id="upgradeRoulette" style="--win-deg:'+winDeg+'deg"><div class="upgrade-wheel-core"><b>'+chance+'%</b><span>WIN</span></div></div></div><div class="upgrade-wheel-legend"><span><i class="win"></i>Победа '+chance+'%</span><span><i class="lose"></i>Проигрыш '+(100-chance)+'%</span></div>':'<div class="upgrade-preview-loading">Подбираю username для выигрыша…</div>')+'</div>':'')+
 '<div class="upgrade-pool-title"><span>Мои usernames</span><small>Дешёвый основной username даёт выше шанс. Дополнительные повышают его ещё.</small></div><div class="upgrade-multi-list">'+((u.available||[]).length?(u.available||[]).map(x=>'<button class="upgrade-pick '+(state.upgradeSelectedIds.includes(x.id)?'selected':'')+'" data-up-item="'+x.id+'"><div><b>'+esc(x.handle)+'</b>'+badge(x.rarity)+'</div><span>'+fmt(x.value)+'</span><strong>'+(state.upgradeSelectedIds.includes(x.id)?'Добавлен':'Добавить')+'</strong></button>').join(''):'<div class="empty">Нет usernames для апгрейда.</div>')+'</div>'+
 '<div class="upgrade-multi-footer"><div>'+(selected.length?(p?'При проигрыше сгорят все '+selected.length+' · шанс '+chance+'%':'Подготовка…'):'Добавьте хотя бы один username')+'</div><button class="primary upgrade-spin-btn" data-upgrade '+(!selected.length||!p||state.upgradeSpinning?'disabled':'')+'>'+(state.upgradeSpinning?'Крутится...':'Крутить')+'</button></div></div>';
}
function seasonsView(){const s=state.season?.season;if(!s)return '<div class="empty">Активного сезона нет.</div>';return '<div class="page-body"><section class="season-hero"><small>ТЕКУЩИЙ СЕЗОН</small><h1>'+esc(s.name)+'</h1><div>'+metric('Осталось',s.daysLeft+' дн.')+metric('Место','#'+s.rank)+metric('Season Score',s.score)+'</div></section><div class="section-label">Награды</div><div class="season-rewards">'+s.rewards.map(x=>'<div><b>'+x.place+'</b><span>'+x.reward+'</span></div>').join('')+'</div>'+(s.series?.length?'<div class="section-label">Активные серии</div><div class="series-list">'+s.series.map(x=>'<div><b>'+esc(x.name)+'</b><span>до '+new Date(x.end_at).toLocaleDateString('ru-RU')+'</span></div>').join('')+'</div>':'')+'</div>'}
function profileView(p=state.profile?.profile){if(!p)return '<div class="empty">Профиль не найден.</div>';return '<div class="page-body"><div class="profile-hero"><div class="avatar">'+esc((p.firstName||'U')[0].toUpperCase())+'</div><b>'+esc(p.firstName||'Игрок')+'</b><span>'+(p.username?'@'+esc(p.username):'')+' · уровень '+p.level+' · #'+p.rank+'</span></div><div class="profile-metrics">'+metric('Капитал',fmt(p.balance+p.collectionValue))+metric('Баланс',fmt(p.balance))+metric('Коллекция',fmt(p.collectionValue))+metric('Usernames',p.collectionCount)+metric('Друзей',p.friendsCount||0)+metric('Сделок',p.marketDeals||0)+'</div><section class="showcase"><div class="section-title"><span>Витрина</span></div><div class="showcase-row">'+(p.showcase?.length?p.showcase.map(x=>'<div>'+x.handle+'<small>'+x.rarity+'</small></div>').join(''):'<div class="empty-line">Добавьте usernames из коллекции.</div>')+'</div></section></div>'}
function premiumView(){const p=state.premium;return '<div class="premium-page"><div class="plus-hero"><small>USERNAME+</small><h1>'+(p.active?'Подписка активна':'Больше возможностей. Без pay-to-win.')+'</h1><p>USERNAME+ не влияет на редкость дропа, награды колеса или апгрейдер.</p></div><div class="feature-list">'+p.features.map(x=>'<div>'+esc(x)+'</div>').join('')+'</div>'+(p.active?'<div class="plus-active">Активно до '+new Date(p.activeUntil).toLocaleDateString('ru-RU')+'</div>':'<button class="primary" data-premium '+(!p.starsEnabled?'disabled':'')+'>Подключить · '+p.stars+' Stars</button>')+'</div>'}
function detailView(x){return '<div class="detail-page">'+resultCard(x,false)+'<div class="detail-grid">'+metric('Экземпляр','#'+x.instanceNumber+' / '+x.maxSupply)+metric('Получен',new Date(x.obtainedAt).toLocaleDateString('ru-RU'))+metric('Длина',String((x.rawHandle||x.handle.slice(1)).length))+metric('Редкость',x.rarity)+'</div><div class="detail-actions three"><button data-showcase="'+x.id+'">На витрину</button><button class="primary" data-list-market="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">На рынок</button><button class="sell-system" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">Продать системе · '+fmt(x.value)+'</button></div></div>'}
function render(){const page=state.page;if(page==='home')shell('USERNAME',homeView());else if(page==='collection')shell('Коллекция',collectionView());else if(page==='market')shell('Рынок',marketView());else if(page==='top')shell('Рейтинг',topView());else if(page==='tasks')shell('Задания',tasksView());else if(page==='wheel')shell('Колесо',wheelView());else if(page==='friends')shell('Друзья',friendsView());else if(page==='gift')shell('Подарок',giftView());else if(page==='upgrader')shell('Апгрейдер',upgraderView());else if(page==='seasons')shell('Сезоны',seasonsView());else if(page==='profile')shell('Профиль',profileView());else if(page==='premium')shell('USERNAME+',premiumView());else if(page==='detail')shell('Username',detailView(state.detail),{back:true})}
async function refreshUser(){const h=await api('/api/home');state.home=h;state.user=h.user;return h}
async function load(page){
 state.page=page;state.menu=false;app.innerHTML='<div class="boot"><b>USERNAME</b><span></span></div>';
 try{
  if(!state.user||page==='home')await refreshUser();
  if(page==='collection')state.collection=await api('/api/collection?rarity='+state.filters.rarity+'&sort='+state.filters.sort+'&page='+state.filters.page);
  if(page==='market')state.market=await api('/api/market?rarity='+state.marketFilters.rarity+'&sort='+state.marketFilters.sort+'&q='+encodeURIComponent(state.marketFilters.q)+'&page='+state.marketFilters.page);
  if(page==='top')state.leaderboard=await api('/api/leaderboard?mode='+state.rankMode+'&period='+state.rankPeriod);
  if(page==='tasks')state.tasks=await api('/api/tasks');
  if(page==='wheel')state.wheel=await api('/api/wheel');
  if(page==='friends')state.friends=await api('/api/friends');
  if(page==='gift')state.gift=await api('/api/gift/options');
  if(page==='upgrader'){state.upgrader=await api('/api/upgrader');state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeOutcome=null;state.upgradeSpinning=false}
  if(page==='seasons')state.season=await api('/api/seasons');
  if(page==='profile')state.profile=await api('/api/profile');
  if(page==='premium')state.premium=await api('/api/premium');
  render();
 }catch(e){shell('USERNAME','<div class="error"><b>'+esc(ERR[e.message]||e.message)+'</b><button data-page="'+page+'">Повторить</button></div>')}
}
function openMarketModal(id,handle,value){const fee=.05,root=document.createElement('div');root.className='modal-root';root.innerHTML='<div class="modal-back" data-modal-close></div><div class="modal"><div class="modal-head"><b>Выставить '+esc(handle)+'</b><button data-modal-close>'+icon('close')+'</button></div><label>Цена<input id="listingPrice" inputmode="numeric" value="'+Math.max(100,Math.round(value*1.15))+'"></label><div class="modal-calc" id="modalCalc"></div><button class="primary" data-create-listing="'+id+'">Выставить</button></div>';document.body.appendChild(root);const input=root.querySelector('#listingPrice'),calc=root.querySelector('#modalCalc');const update=()=>{const p=Math.max(0,Number(input.value)||0);calc.textContent='Комиссия 5% · получите '+fmt(p*(1-fee))};input.addEventListener('input',update);update()}
function openSystemSellModal(id,handle,value){
 const root=document.createElement('div');root.className='modal-root';
 root.innerHTML='<div class="modal-back" data-modal-close></div><div class="modal"><div class="modal-head"><b>Продать '+esc(handle)+'?</b><button data-modal-close>'+icon('close')+'</button></div><div class="system-sell-copy">Система сразу начислит <b>'+fmt(value)+'</b>. Username исчезнет из коллекции. Отменить продажу после подтверждения нельзя.</div><button class="primary" data-confirm-system-sell="'+id+'">Продать за '+fmt(value)+'</button></div>';
 document.body.appendChild(root);
}
function closeModal(el){el?.closest('.modal-root')?.remove()}
async function spinWheelUi(){
 if(state.busy)return;state.busy=true;
 const req=crypto.randomUUID?.()||('w-'+Date.now());
 const r=await api('/api/wheel',{method:'POST',body:JSON.stringify({requestId:req})});
 const items=state.wheel.rewards||[],idx=Math.max(0,items.findIndex(x=>x.key===r.reward.key)),n=Math.max(1,items.length),disc=document.querySelector('#wheelDisc'),res=document.querySelector('#wheelResult');
 if(disc){
   const segment=360/n;
   const targetCenter=idx*segment;
   const turns=6*360;
   disc.classList.add('spinning');
   requestAnimationFrame(()=>{disc.style.transform='rotate('+(turns-targetCenter)+'deg)'});
   await new Promise(x=>setTimeout(x,3200));
   disc.classList.remove('spinning');
 }
 if(res)res.textContent='Получено: '+r.reward.label;
 haptic('medium');
 await refreshUser();state.wheel=await api('/api/wheel');state.busy=false;
 setTimeout(()=>render(),800);
}
let upgradePreviewSeq=0;
async function refreshUpgradePreview(){
 const ids=[...(state.upgradeSelectedIds||[])],seq=++upgradePreviewSeq;
 if(!ids.length){state.upgradePreview=null;render();return}
 state.upgradePreview=null;render();
 try{
   const p=await api('/api/upgrader/preview',{method:'POST',body:JSON.stringify({ids})});
   if(seq!==upgradePreviewSeq)return;
   state.upgradePreview=p;render();
 }catch(e){if(seq===upgradePreviewSeq){state.upgradePreview=null;toast(ERR[e.message]||e.message||'Не удалось рассчитать шанс');render()}}
}
async function animateUpgradeWheel(result){
 const disc=document.querySelector('#upgradeRoulette'),pointer=document.querySelector('#upgradePointer');if(!disc)return;
 pointer?.classList.add('spinning');
 const chance=Math.max(.001,Math.min(.999,Number(result.chance)||0)),winDeg=chance*360;
 const margin=Math.max(1,Math.min(5,winDeg*.18));
 let selectedAngle;
 if(result.success){
   selectedAngle=margin+Math.random()*Math.max(1,winDeg-margin*2);
 }else{
   const loseStart=winDeg+4,loseEnd=356;
   selectedAngle=loseStart+Math.random()*Math.max(1,loseEnd-loseStart);
 }
 const final=6*360+(360-selectedAngle);
 requestAnimationFrame(()=>{disc.style.transform='rotate('+final+'deg)'});
 await new Promise(r=>setTimeout(r,3300));
 pointer?.classList.remove('spinning');
 state.upgradeOutcome=result;state.upgradeSpinning=false;state.upgradeSelectedIds=[];state.upgradePreview=null;
 state.upgrader=await api('/api/upgrader');
 render();
}
document.addEventListener('click',async e=>{if(e.target.matches('[data-drop-picker-close]')){state.dropPicker=false;render();return}if(e.target.matches('[data-menu-close]')){state.menu=false;render();return}if(e.target.matches('[data-modal-close]')){e.target.closest('.modal-root')?.remove();return}const el=e.target.closest('button');if(!el)return;try{
 if(el.hasAttribute('data-menu-open')){state.menu=true;render();return}
 if(el.hasAttribute('data-menu-close')){state.menu=false;render();return}
 if(el.dataset.page){state.dropPicker=false;await load(el.dataset.page);return}
 if(el.hasAttribute('data-drop-picker-open')){state.dropPicker=true;render();return}
 if(el.dataset.dropTier){state.dropTier=el.dataset.dropTier;state.dropPicker=false;render();return}
 if(el.id==='dropBtn'&&!state.busy){state.busy=true;el.disabled=true;const requestId=crypto.randomUUID?.()||('req-'+Date.now()+'-'+Math.random().toString(36).slice(2));const r=await api('/api/drop',{method:'POST',body:JSON.stringify({requestId,tier:state.dropTier})});state.home.user=r.user;state.user=r.user;await animateDrop(r.instance);state.busy=false;return}
 if(el.dataset.resolve){state.busy=true;await api('/api/drop/'+el.dataset.id+'/resolve',{method:'POST',body:JSON.stringify({action:el.dataset.resolve})});toast(el.dataset.resolve==='keep'?'Добавлено в коллекцию':'Username продан');state.busy=false;await load('home');return}
 if(el.dataset.rarity){state.filters.rarity=el.dataset.rarity;state.filters.page=1;await load('collection');return}
 if(el.dataset.marketRarity){state.marketFilters.rarity=el.dataset.marketRarity;state.marketFilters.page=1;await load('market');return}
 if(el.dataset.pager){const d=Number(el.dataset.dir);if(el.dataset.pager==='collection'){state.filters.page+=d;await load('collection')}if(el.dataset.pager==='market'){state.marketFilters.page+=d;await load('market')}if(el.dataset.pager==='rank'){state.rankPage+=d;render()}return}
 if(el.hasAttribute('data-market-search')){state.marketFilters.q=document.querySelector('#marketQuery')?.value||'';state.marketFilters.page=1;await load('market');return}
 if(el.dataset.marketBuy){const r=await api('/api/market/'+el.dataset.marketBuy+'/buy',{method:'POST'});toast('Куплено '+r.handle);await refreshUser();await load('market');return}
 if(el.dataset.marketCancel){await api('/api/market/'+el.dataset.marketCancel+'/cancel',{method:'POST'});toast('Лот снят');await load('market');return}
 if(el.dataset.mode){state.rankMode=el.dataset.mode;state.rankPage=1;await load('top');return}
 if(el.dataset.period){state.rankPeriod=el.dataset.period;state.rankPage=1;await load('top');return}
 if(el.dataset.claim){const r=await api('/api/tasks/'+el.dataset.claim+'/claim',{method:'POST'});toast('+'+fmt(r.reward));await refreshUser();await load('tasks');return}
 if(el.dataset.profile){const r=await api('/api/profile/'+el.dataset.profile);state.backPage='top';state.page='profile';state.profile=r;render();return}
 if(el.dataset.detail){const item=state.collection?.items.find(x=>x.id===el.dataset.detail);if(item){state.backPage='collection';state.detail=item;state.page='detail';render()}return}
 if(el.dataset.showcase){await api('/api/showcase/'+el.dataset.showcase,{method:'POST'});toast('Добавлено на витрину');return}
 if(el.dataset.sellSystem){openSystemSellModal(el.dataset.sellSystem,el.dataset.handle,Number(el.dataset.value));return}
 if(el.dataset.confirmSystemSell){const r=await api('/api/collection/'+el.dataset.confirmSystemSell+'/sell',{method:'POST'});closeModal(el);state.user=r.user;toast(r.handle+' продан за '+fmt(r.value));await load('collection');return}
 if(el.dataset.listMarket){openMarketModal(el.dataset.listMarket,el.dataset.handle,Number(el.dataset.value));return}
 if(el.dataset.createListing){const root=el.closest('.modal-root'),price=Number(root.querySelector('#listingPrice').value);await api('/api/market',{method:'POST',body:JSON.stringify({instanceId:el.dataset.createListing,price})});closeModal(el);toast('Лот опубликован');await load('collection');return}
 if(el.hasAttribute('data-modal-close')){closeModal(el);return}
 if(el.hasAttribute('data-wheel')){await spinWheelUi();return}
 if(el.hasAttribute('data-copy-ref')){await navigator.clipboard.writeText(state.friends.referralLink);toast('Ссылка скопирована');return}
 if(el.hasAttribute('data-gift')){const instanceId=document.querySelector('#giftInstance')?.value,friendId=document.querySelector('#giftFriend')?.value;if(!instanceId||!friendId){toast('Выберите username и друга');return}const r=await api('/api/gift',{method:'POST',body:JSON.stringify({instanceId,friendId})});toast(r.handle+' отправлен пользователю '+r.recipient);await load('gift');return}
 if(el.dataset.upItem){
   const id=el.dataset.upItem,ids=[...(state.upgradeSelectedIds||[])],i=ids.indexOf(id);
   if(i>=0)ids.splice(i,1);else{if(ids.length>=(state.upgrader?.maxItems||5)){toast('Можно выбрать максимум 5 usernames');return}ids.push(id)}
   state.upgradeSelectedIds=ids;state.upgradeOutcome=null;await refreshUpgradePreview();return
 }
 if(el.dataset.upRemove){state.upgradeSelectedIds=(state.upgradeSelectedIds||[]).filter(id=>id!==el.dataset.upRemove);await refreshUpgradePreview();return}
 if(el.hasAttribute('data-up-clear')){state.upgradeSelectedIds=[];state.upgradePreview=null;render();return}
 if(el.hasAttribute('data-upgrade-continue')){state.upgradeOutcome=null;state.upgradeSelectedIds=[];state.upgradePreview=null;render();return}
 if(el.hasAttribute('data-upgrade')&&!state.upgradeSpinning){
   const ids=[...(state.upgradeSelectedIds||[])],sessionId=state.upgradePreview?.sessionId;if(!ids.length||!sessionId)return;
   state.upgradeSpinning=true;el.disabled=true;
   const r=await api('/api/upgrader',{method:'POST',body:JSON.stringify({ids,sessionId})});
   await animateUpgradeWheel(r);return
 }
 if(el.hasAttribute('data-premium')){const r=await api('/api/premium/invoice',{method:'POST'});if(!TG?.openInvoice)throw new Error('premium_unavailable');TG.openInvoice(r.invoice,async status=>{if(status==='paid'){toast('USERNAME+ активирован');await load('premium')}});return}
 if(el.hasAttribute('data-back')){await load(state.backPage||'collection');return}
}catch(err){state.busy=false;toast(ERR[err.message]||err.message||'Ошибка');el.disabled=false}});
document.addEventListener('change',async e=>{if(e.target.id==='sortSelect'){state.filters.sort=e.target.value;state.filters.page=1;await load('collection')}if(e.target.id==='marketSort'){state.marketFilters.sort=e.target.value;state.marketFilters.page=1;await load('market')}});
load('home');
