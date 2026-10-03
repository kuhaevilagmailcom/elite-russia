let TG=window.Telegram?.WebApp;
const root=document.documentElement,app=document.querySelector('#app'),toastEl=document.querySelector('#toast');
const state={
  page:'home',user:null,home:null,collection:null,market:null,leaderboard:null,tasks:null,wheel:null,friends:null,gift:null,upgrader:null,season:null,profile:null,premium:null,detail:null,admin:null,adminDetail:null,
  menu:false,busy:false,backPage:'collection',dropTier:'basic',dropPicker:false,collectionFilterOpen:false,marketFilterOpen:false,upgradeOutcome:null,
  filters:{sort:'new',digits:'all',showcase:'all',page:1},marketFilters:{sort:'new',digits:'all',q:'',page:1},
  rankPage:1,upgradeSelectedIds:[],upgradePreview:null,upgradeSpinning:false,wheelLastResult:null,adminPage:1,adminQuery:'',adminResetStage:0
};
const fmt=n=>'$'+new Intl.NumberFormat('en-US').format(Math.round(Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ERR={
  unauthorized:'Откройте игру через Telegram',blocked:'Аккаунт заблокирован',insufficient_funds:'Недостаточно денег',pending_drop:'Сначала решите, что делать с текущим username',
  collection_full:'Коллекция заполнена',recipient_full:'У получателя заполнена коллекция',sold_out:'Тираж закончился',too_fast:'Слишком быстро. Попробуйте ещё раз',
  listing_not_found:'Лот уже недоступен',own_listing:'Нельзя купить свой лот',already_listed:'Username уже на рынке',not_friend:'Пользователь не в списке друзей',
  wheel_cooldown:'Колесо уже использовано сегодня',upgrade_invalid_items:'Выбранные usernames недоступны',upgrade_bad_recipe:'Неверный набор для апгрейда',
  upgrade_session_expired:'Предпросмотр устарел. Выберите usernames заново',upgrade_session_mismatch:'Состав апгрейда изменился',premium_unavailable:'Telegram Stars пока недоступны',showcase_full:'Витрина заполнена',recipient_blocked:'Получатель заблокирован',rate_limited:'Слишком много действий. Попробуйте через минуту',story_unsupported:'Обновите Telegram — истории из Mini App поддерживаются в новых версиях',story_https_required:'Не удалось подготовить HTTPS-картинку истории',forbidden:'Нет доступа',bad_username:'Некорректный username',username_exists:'Такой username уже существует',reset_confirmation_required:'Введите RESET USERNAME',network:'Нет соединения с сервером'
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
profile:'<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',premium:'<path d="m12 3 3 5 6 1-4 4 .8 6L12 16l-5.8 3L7 13 3 9l6-1 3-5Z"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',admin:'<path d="M12 3 4 6v6c0 4.7 3.2 7.7 8 9 4.8-1.3 8-4.3 8-9V6l-8-3Z"/><path d="M9 12h6M12 9v6"/>',story:'<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M5 12v7h14v-7"/>'
};
function icon(k){return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICON[k]||ICON.menu)+'</svg>'}
function badge(r){return '<span class="rarity '+String(r).toLowerCase()+'">'+esc(r)+'</span>'}
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function balance(){return fmt(state.user?.balance||state.home?.user?.balance||0)}
const MENU=[
 ['home','home','Дроп','Нажми на username и испытай удачу'],['market','market','Рынок','Покупай и продавай'],['top','rank','Рейтинг','Кто богаче'],['tasks','tasks','Задания','Ежедневные цели'],['wheel','wheel','Колесо','Бесплатно раз в 24 часа'],
 ['friends','friends','Друзья','Приглашения и награды'],['gift','gift','Подарок','Передать username'],['upgrader','upgrade','Апгрейдер','Рискнуть коллекцией'],['seasons','season','Сезоны','Рейтинг сезона']
];
const MENU_BOTTOM=[['collection','collection','Коллекция'],['profile','profile','Профиль'],['premium','premium','USERNAME+']];
function menuHtml(){
 const play=MENU.slice(0,5),social=MENU.slice(5),bottom=[...MENU_BOTTOM];
 if(state.user?.isAdmin)bottom.push(['admin','admin','Админка']);
 const rows=list=>list.map(([p,i,t,s])=>'<button data-page="'+p+'"><span class="menu-icon">'+icon(i)+'</span><span><b>'+t+'</b>'+(s?'<small>'+s+'</small>':'')+'</span><em>›</em></button>').join('');
 return '<div class="menu-backdrop '+(state.menu?'open':'')+'" data-menu-close><aside class="menu-sheet" data-menu-sheet><div class="menu-head"><div><small>USERNAME</small><b>Меню</b></div><button data-menu-close>'+icon('close')+'</button></div><div class="menu-group-title">ИГРАТЬ</div><div class="menu-list">'+rows(play)+'</div><div class="menu-group-title">СОЦИАЛЬНОЕ</div><div class="menu-list">'+rows(social)+'</div><div class="menu-divider"></div><div class="menu-list compact">'+rows(bottom)+'</div></aside></div>'
}
function topbar(title,{back=false}={}){return '<header class="topbar">'+(back?'<button class="top-back" data-back>'+icon('back')+'</button>':'')+'<div class="top-title"><b>'+esc(title)+'</b></div><div class="top-actions"><span>'+balance()+'</span><button data-menu-open>'+icon('menu')+'</button></div></header>'}
function shell(title,html,opts={}){window.__USERNAME_READY=true;app.innerHTML='<div class="shell"><section class="screen">'+topbar(title,opts)+html+'</section>'+menuHtml()+'</div>';requestAnimationFrame(fitAllUsernames)}
function fitUsername(el,max=48,min=20){if(!el)return;el.style.fontSize='';let size=Math.min(max,parseFloat(getComputedStyle(el).fontSize)||max);const room=Math.max(1,el.parentElement?.clientWidth||el.clientWidth);while(size>min&&el.scrollWidth>room-8){size-=1;el.style.fontSize=size+'px'}}
function fitAllUsernames(){document.querySelectorAll('[data-fit-username]').forEach(el=>fitUsername(el,Number(el.dataset.maxSize||48),Number(el.dataset.minSize||20)))}
function rarityTone(rarity){
  return {COMMON:'#8f98a3',RARE:'#2aabee',EPIC:'#7257d8',LEGEND:'#d88b22',ULTRA:'#e34850'}[String(rarity||'').toUpperCase()]||'#8f98a3';
}
function resultCard(x,pending=false){
 return '<article class="drop-result-card minimal-result">'+
   '<div class="drop-result-main minimal"><h1 data-fit-username data-max-size="48" data-min-size="24">'+esc(x.handle)+'</h1></div>'+
   (pending?'<div class="drop-result-actions compact-actions"><button data-resolve="keep" data-id="'+x.id+'">Оставить</button><button class="secondary" data-resolve="sell" data-id="'+x.id+'">Продать · '+fmt(x.sellValue??x.value)+'</button><button class="story-icon-btn" data-share-story="'+x.id+'" aria-label="Выложить в историю" title="Выложить в историю">'+icon('story')+'</button></div>':'')+
 '</article>';
}
function storyRoundRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function storyFitFont(ctx,text,maxWidth,startSize,minSize=50,weight=800){
  let size=startSize;while(size>minSize){ctx.font=weight+' '+size+'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';if(ctx.measureText(text).width<=maxWidth)break;size-=4}return size;
}
function generateStoryImage(item){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const ctx=canvas.getContext('2d'),handle=String(item.handle||'@username');
  const bg=ctx.createLinearGradient(0,0,0,1920);bg.addColorStop(0,'#f4f5f7');bg.addColorStop(1,'#e8ebef');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1920);
  ctx.fillStyle='#111318';ctx.font='900 52px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('USERNAME',72,118);
  ctx.fillStyle='#68717d';ctx.font='600 30px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('COLLECTION GAME',72,166);
  ctx.fillStyle='#ffffff';storyRoundRect(ctx,60,280,960,1120,44);ctx.fill();
  ctx.strokeStyle='#dde1e5';ctx.lineWidth=2;storyRoundRect(ctx,60,280,960,1120,44);ctx.stroke();
  ctx.fillStyle='#68717d';ctx.font='750 30px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.textAlign='center';ctx.fillText('Я ВЫИГРАЛ USERNAME',540,455);
  ctx.fillStyle='#111318';const size=storyFitFont(ctx,handle,820,150,68,900);ctx.font='900 '+size+'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText(handle,540,820);
  ctx.fillStyle='#eef1f3';storyRoundRect(ctx,205,1010,670,100,28);ctx.fill();
  ctx.fillStyle='#111318';ctx.font='750 31px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('ЗАХОДИ В USERNAME',540,1073);
  ctx.fillStyle='#8a929c';ctx.font='550 27px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('Попробуй выбить свой уникальный username',540,1170);
  ctx.textAlign='left';ctx.fillStyle='#111318';ctx.font='800 34px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('USERNAME',72,1770);
  ctx.fillStyle='#69727d';ctx.font='550 25px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('Каждый username существует в игре только один раз',72,1815);
  return canvas.toDataURL('image/jpeg',.92);
}
async function shareDropStory(item){
  if(!item)return;
  if(typeof TG?.shareToStory!=='function'||(typeof TG?.isVersionAtLeast==='function'&&!TG.isVersionAtLeast('7.8')))throw new Error('story_unsupported');
  const dataUrl=generateStoryImage(item);
  const uploaded=await api('/api/story-share',{method:'POST',body:JSON.stringify({instanceId:item.id,dataUrl})});
  const mediaUrl=uploaded.mediaPath?new URL(uploaded.mediaPath,location.origin).href:uploaded.mediaUrl;
  if(!/^https:\/\//i.test(mediaUrl||''))throw new Error('story_https_required');
  TG.shareToStory(mediaUrl,{text:'Я выиграл '+item.handle+' в USERNAME'});
  haptic('medium');
}
function selectedDropTier(){
  const tiers=state.home?.config?.dropTiers||{};
  return tiers[state.dropTier]||tiers.basic||{key:'basic',label:'$3K',cost:3000};
}
function dropPricePicker(tiers){
 if(!state.dropPicker)return '';
 return '<div class="drop-cost-overlay"><button class="drop-cost-back" data-drop-picker-close aria-label="Закрыть"></button><div class="drop-cost-sheet"><div class="drop-cost-title"><b>Стоимость попытки</b><span>Выберите цену дропа</span></div>'+Object.values(tiers).map(t=>'<button class="drop-cost-option '+(state.dropTier===t.key?'active':'')+'" data-drop-tier="'+t.key+'"><span>'+esc(t.label)+'</span><b>'+fmt(t.cost)+'</b></button>').join('')+'</div></div>';
}
function homeView(){
 const h=state.home,u=h.user,last=h.last,p=h.pending,tiers=h.config.dropTiers||{},tier=selectedDropTier();
 const freeBasic=u.freeDrops>0&&state.dropTier==='basic',payCost=freeBasic?0:Number(tier.cost||3000),cantAfford=!freeBasic&&u.balance<payCost;
 return '<div class="home">'+dropPricePicker(tiers)+'<div class="home-metrics">'+metric('Капитал',fmt(u.capital))+metric('Место','#'+u.rank)+metric('Usernames',u.collectionCount)+'</div>'+
 '<section class="drop-zone"><div class="drop-headline"><div><span>DROP</span><small>'+(freeBasic?'Бесплатная попытка':('Попытка '+fmt(payCost)))+'</small></div>'+(!p?'<button class="drop-cost-trigger compact" data-drop-picker-open>'+fmt(tier.cost)+' <em>⌄</em></button>':'')+'</div>'+
 (p?resultCard(p,true):'<button class="handle-stage drop-trigger" id="handleStage" data-drop-trigger '+(cantAfford?'disabled':'')+' aria-label="Прокрутить username"><b data-fit-username data-max-size="54" data-min-size="25">@username</b><small>'+(cantAfford?'Недостаточно денег':'Нажми на username')+'</small></button>')+
 '</section><section class="last"><div class="section-title"><span>Последний username</span></div>'+(last?'<div class="last-row"><b>'+esc(last.handle)+'</b><strong>'+fmt(last.value)+'</strong></div>':'<div class="empty-line">История появится после первого дропа.</div>')+'</section></div>';
}
async function animateDrop(result){
 const stage=document.querySelector('#handleStage');if(!stage)return;stage.disabled=true;
 const samples=['@vision','@storm7','@phantom','@dealer77','@blackout','@master7','@prime','@ghost77','@mister777','@nightfa','@street','@alpha7'];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,delays=reduced?[100,140]:[55,55,60,70,80,95,115,140,180,235,310,420,540,650];let i=0;
 for(const d of delays){stage.classList.add('rolling');stage.innerHTML='<b data-fit-username data-max-size="54" data-min-size="25">'+samples[i++%samples.length]+'</b><small>Прокрутка…</small>';fitAllUsernames();await new Promise(r=>setTimeout(r,d))}
 stage.innerHTML='<b data-fit-username data-max-size="54" data-min-size="25">'+esc(result.handle)+'</b><small>Выпало</small>';fitAllUsernames();stage.classList.remove('rolling');stage.classList.add('land');haptic('medium');await new Promise(r=>setTimeout(r,reduced?120:190));state.home.pending=result;render();
}
function collectionFilterSheet(){
 if(!state.collectionFilterOpen)return '';
 const f=state.filters,row=(label,key,value,current)=>'<button data-collection-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр коллекции</b><button data-sheet-close>'+icon('close')+'</button></div><span>Стоимость</span><div class="sheet-options">'+row('Сначала дорогие','sort','expensive',f.sort)+row('Сначала дешёвые','sort','cheap',f.sort)+'</div><span>Дата</span><div class="sheet-options">'+row('Сначала новые','sort','new',f.sort)+row('Сначала старые','sort','old',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div><span>Витрина</span><div class="sheet-options">'+row('Все','showcase','all',f.showcase)+row('Только витрина','showcase','only',f.showcase)+'</div></aside></div>';
}
function collectionView(){
 const c=state.collection||{items:[],summary:{count:0,value:0},page:1,pages:1};
 return '<div class="page-body collection-page">'+collectionFilterSheet()+'<div class="screen-toolbar"><div><b>Коллекция</b><span>'+(c.summary?.count||0)+' usernames · '+fmt(c.summary?.value||0)+'</span></div><button data-collection-filter-open aria-label="Фильтр">'+icon('filter')+'</button></div><div class="collection-grid">'+(c.items.length?c.items.map(x=>'<article class="user-card"><button class="user-card-main" data-detail="'+x.id+'"><span data-fit-username data-max-size="18" data-min-size="12">'+esc(x.handle)+'</span><b>'+fmt(x.value)+'</b><small>'+(x.inShowcase?'На витрине':'В коллекции')+'</small></button><button class="user-card-sell" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+(x.sellValue??x.value)+'">Продать</button></article>').join(''):'<div class="empty">По этому фильтру ничего нет.</div>')+'</div>'+pager(c.page,c.pages,'collection')+'</div>';
}
function pager(page,pages,type){if(pages<=1)return '';return '<div class="pager"><button data-pager="'+type+'" data-dir="-1" '+(page<=1?'disabled':'')+'>Назад</button><span>'+page+' / '+pages+'</span><button data-pager="'+type+'" data-dir="1" '+(page>=pages?'disabled':'')+'>Дальше</button></div>'}
function marketFilterSheet(){
 if(!state.marketFilterOpen)return '';
 const f=state.marketFilters,row=(label,key,value,current)=>'<button data-market-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр рынка</b><button data-sheet-close>'+icon('close')+'</button></div><span>Цена</span><div class="sheet-options">'+row('Сначала дешёвые','sort','cheap',f.sort)+row('Сначала дорогие','sort','expensive',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div><span>Дата</span><div class="sheet-options">'+row('Новые','sort','new',f.sort)+'</div></aside></div>';
}
function marketView(){
 const m=state.market||{items:[],page:1,pages:1};
 return '<div class="page-body market-page">'+marketFilterSheet()+'<div class="market-search"><label>'+icon('search')+'<input id="marketQuery" value="'+esc(state.marketFilters.q)+'" placeholder="Поиск username..." autocomplete="off"></label><button data-market-filter-open aria-label="Фильтр">'+icon('filter')+'</button></div><div class="market-list">'+(m.items.length?m.items.map(x=>'<article class="market-card"><div class="market-main"><span data-fit-username data-max-size="20" data-min-size="13">'+esc(x.handle)+'</span><b>'+fmt(x.price)+'</b><small>Продавец: '+esc(x.sellerName)+'</small></div>'+(x.sellerId===state.user?.id?'<button class="secondary" data-market-cancel="'+x.id+'">Снять с продажи</button>':'<button class="primary" data-market-buy="'+x.id+'">Купить</button>')+'</article>').join(''):'<div class="empty">Ничего не найдено.</div>')+'</div>'+pager(m.page,m.pages,'market')+'</div>';
}
function topView(){
 const all=state.leaderboard?.items||[],top=all.slice(0,3),rest=all.slice(3),size=10,pages=Math.max(1,Math.ceil(rest.length/size));
 state.rankPage=Math.max(1,Math.min(state.rankPage,pages));const list=rest.slice((state.rankPage-1)*size,state.rankPage*size);
 const card=(r,pos,hero=false)=>r?'<button class="money-rank '+(hero?'hero':'')+'" data-profile="'+r.id+'"><small>#'+pos+'</small><b>'+esc(r.first_name||r.username||'Игрок')+'</b><strong>'+fmt(r.capital)+'</strong><span>'+(r.best_handle||'Без usernames')+'</span></button>':'';
 return '<div class="page-body rank-page"><div class="rank-summary money"><span>ОБЩИЙ КАПИТАЛ</span><b>Кто богаче</b><small>Баланс + стоимость всех активных usernames</small></div><div class="podium">'+card(top[0],1,true)+'<div>'+card(top[1],2)+card(top[2],3)+'</div></div><div class="rank-list money-list">'+list.map(r=>'<button class="rank-row" data-profile="'+r.id+'"><span class="pos">#'+r.position+'</span><div><b>'+esc(r.first_name||r.username||'Игрок')+'</b><small>'+(r.best_handle||'Без usernames')+'</small></div><strong>'+fmt(r.capital)+'</strong></button>').join('')+'</div>'+pager(state.rankPage,pages,'rank')+'</div>';
}
function tasksView(){return '<div class="page-scroll task-list">'+(state.tasks?.items||[]).map(t=>'<article class="task"><div><b>'+esc(t.label)+'</b><span>'+t.current+' / '+t.target+'</span></div><strong>+'+fmt(t.reward)+'</strong><div class="progress"><i style="width:'+Math.min(100,t.current/t.target*100)+'%"></i></div><button data-claim="'+t.key+'" '+(t.current<t.target||t.claimed?'disabled':'')+'>'+(t.claimed?'Получено':t.current>=t.target?'Забрать':'В процессе')+'</button></article>').join('')+'</div>'}
function wheelGeometry(items){
 const total=Math.max(1,items.reduce((s,x)=>s+Number(x.weight||0),0));let cursor=0;
 const colors=['#ffffff','#eef1f4'],segments=[],rows=items.map((x,i)=>{const start=cursor/total*360;cursor+=Number(x.weight||0);const end=cursor/total*360;segments.push(colors[i%2]+' '+start+'deg '+end+'deg');return {...x,start,end,center:(start+end)/2,span:end-start}});
 return {rows,background:'conic-gradient('+segments.join(',')+')'};
}
function wheelShortLabel(x){
 if(x.type==='username')return '1/1';
 if(x.type==='drop')return 'DROP';
 return String(x.label||'').replace('$1 500','$1.5K').replace(' бесплатный дроп',' DROP');
}
function wheelView(){
 const w=state.wheel||{rewards:[],available:false},g=wheelGeometry(w.rewards||[]),rare=g.rows.filter(x=>x.span<12),visible=g.rows.filter(x=>x.span>=12),last=state.wheelLastResult;
 return '<div class="wheel-page"><section class="wheel-card"><div class="wheel-stage"><div class="daily-wheel-pointer"></div><div class="daily-wheel" id="wheelDisc" style="--wheel-bg:'+g.background+'">'+visible.map(x=>'<span class="daily-wheel-label" style="--angle:'+x.center+'deg">'+esc(wheelShortLabel(x))+'</span>').join('')+'<div class="daily-wheel-core"><b>USERNAME</b><span>DAILY</span></div></div></div>'+
 (rare.length?'<div class="wheel-rare"><span>РЕДКИЕ ПРИЗЫ</span><div>'+rare.map(x=>'<b>'+esc(wheelShortLabel(x))+'</b>').join('')+'</div></div>':'')+'</section>'+
 '<div class="wheel-copy"><b>'+(w.available?'Бесплатное вращение':'Уже использовано')+'</b><span>'+(w.available?'Одно вращение раз в 24 часа':('Следующее: '+new Date(w.nextAt).toLocaleString('ru-RU')))+'</span></div>'+
 '<button class="primary wheel-spin-button" data-wheel '+(!w.available?'disabled':'')+'>'+(w.available?'Крутить колесо':'Возвращайся позже')+'</button>'+
 '<div id="wheelResult" class="wheel-result '+(last?'show':'')+'">'+(last?('Выпало: '+esc(last.label)):'')+'</div></div>';
}
function friendsView(){
 const f=state.friends||{friends:[],rewards:[],invited:0,active:0},link=f.referralLink||'';
 return '<div class="page-body friends-page"><div class="friends-intro"><b>Друзья</b><span>Приглашай друзей и собирай коллекцию вместе.</span></div><section class="ref-card"><small>ТВОЯ ССЫЛКА</small><b>'+esc(link||'Ссылка загружается…')+'</b><div><button class="secondary" data-copy-ref '+(!link?'disabled':'')+'>Скопировать</button><button class="primary" data-share-ref '+(!link?'disabled':'')+'>Отправить другу</button></div></section><div class="friend-stats">'+metric('Приглашено',f.invited)+metric('Наград',f.rewardsCount??f.rewards.length)+metric('До следующей',f.nextReward?f.nextReward.remaining:'—')+'</div><div class="section-label">Друзья</div><div class="friends-list">'+(f.friends.length?f.friends.map(x=>'<div class="friend-row"><div><b>'+esc(x.first_name||x.username||'Игрок')+'</b><span>'+(x.username?'@'+esc(x.username):'Без username')+'</span></div><strong>ур. '+x.level+'</strong></div>').join(''):'<div class="empty">Пригласи первого друга.</div>')+'</div></div>';
}
function giftView(){const g=state.gift;return '<div class="gift-page"><div class="form-card"><label>Username<select id="giftInstance"><option value="">Выберите username</option>'+g.items.map(x=>'<option value="'+x.id+'">'+x.handle+' · '+x.rarity+' · '+fmt(x.value)+'</option>').join('')+'</select></label><label>Друг<select id="giftFriend"><option value="">Выберите друга</option>'+g.friends.map(x=>'<option value="'+x.id+'">'+esc(x.first_name||x.username||'Игрок')+'</option>').join('')+'</select></label><div class="notice">Передача необратима. Username должен находиться в вашей коллекции и не быть выставлен на рынке.</div><button class="primary" data-gift>Подарить username</button></div></div>'}
function selectedUpgradeItems(){
 const list=state.upgrader?.available||[],set=new Set(state.upgradeSelectedIds||[]);
 return list.filter(x=>set.has(x.id));
}
function upgraderView(){
 const u=state.upgrader||{available:[],maxItems:5},selected=selectedUpgradeItems(),p=state.upgradePreview,chance=p?Math.round(Number(p.chance||0)*100):0,total=selected.reduce((s,x)=>s+Number(x.value||0),0);
 return '<div class="upgrade-page"><div class="upgrade-copy"><span>Выбери usernames и попробуй получить более дорогой</span></div>'+
 '<section class="upgrade-selection"><div class="upgrade-selection-head"><span>Выбрано: <b>'+selected.length+'</b></span><strong>'+fmt(total)+'</strong></div><div class="upgrade-selected">'+(selected.length?selected.map(x=>'<button data-up-remove="'+x.id+'"><b>'+esc(x.handle)+'</b><span>'+fmt(x.value)+'</span><em>×</em></button>').join(''):'<div class="upgrade-empty-selected">Выбери usernames из списка ниже</div>')+'</div></section>'+
 (selected.length?'<section class="upgrade-target">'+(p?'<small>МОЖНО ПОЛУЧИТЬ</small><b data-fit-username data-max-size="31" data-min-size="19">'+esc(p.target.handle)+'</b><strong>'+fmt(p.target.value)+'</strong><span>Шанс <b>'+chance+'%</b></span>':'<div class="upgrade-preview-loading">Подбираю результат…</div>')+'</section>':'')+
 (state.upgradeSpinning?'<section class="slot-viewport" id="upgradeSlotViewport"><div class="slot-selector"></div><div class="slot-track" id="upgradeSlotTrack"></div></section>':'')+
 (state.upgradeOutcome&&!state.upgradeSpinning?'<section class="upgrade-outcome '+(state.upgradeOutcome.success?'success':'fail')+'"><small>РЕЗУЛЬТАТ</small><b>'+(state.upgradeOutcome.success?esc(state.upgradeOutcome.result.handle):'Не получилось')+'</b><span>'+(state.upgradeOutcome.success?fmt(state.upgradeOutcome.result.value):'Выбранные usernames сгорели')+'</span><button class="secondary" data-upgrade-continue>Продолжить</button></section>':'')+
 '<div class="upgrade-list-title"><b>Мои usernames</b></div><div class="upgrade-list">'+((u.available||[]).length?(u.available||[]).map(x=>'<button class="upgrade-pick '+(state.upgradeSelectedIds.includes(x.id)?'selected':'')+'" data-up-item="'+x.id+'"><span><b>'+esc(x.handle)+'</b><small>'+fmt(x.value)+'</small></span><i aria-hidden="true">'+(state.upgradeSelectedIds.includes(x.id)?'✓':'＋')+'</i></button>').join(''):'<div class="empty">Нет usernames для апгрейда.</div>')+'</div><div class="upgrade-footer"><div><span>Шанс</span><b>'+(p?chance+'%':'—')+'</b></div><button class="primary" data-upgrade '+(!selected.length||!p||state.upgradeSpinning?'disabled':'')+'>'+(state.upgradeSpinning?'Прокрутка…':'Апгрейд')+'</button></div></div>';
}
function seasonsView(){const s=state.season?.season;if(!s)return '<div class="empty">Активного сезона нет.</div>';return '<div class="page-body"><section class="season-hero"><small>ТЕКУЩИЙ СЕЗОН</small><h1>'+esc(s.name)+'</h1><div>'+metric('Осталось',s.daysLeft+' дн.')+metric('Место','#'+s.rank)+metric('Season Score',s.score)+'</div></section><div class="section-label">Награды</div><div class="season-rewards">'+s.rewards.map(x=>'<div><b>'+x.place+'</b><span>'+x.reward+'</span></div>').join('')+'</div>'+(s.series?.length?'<div class="section-label">Активные серии</div><div class="series-list">'+s.series.map(x=>'<div><b>'+esc(x.name)+'</b><span>до '+new Date(x.end_at).toLocaleDateString('ru-RU')+'</span></div>').join('')+'</div>':'')+'</div>'}
function profileView(p=state.profile?.profile){if(!p)return '<div class="empty">Профиль не найден.</div>';return '<div class="page-body"><div class="profile-hero"><div class="avatar">'+esc((p.firstName||'U')[0].toUpperCase())+'</div><b>'+esc(p.firstName||'Игрок')+'</b><span>'+(p.username?'@'+esc(p.username):'')+' · уровень '+p.level+' · #'+p.rank+'</span></div><div class="profile-metrics">'+metric('Капитал',fmt(p.balance+p.collectionValue))+metric('Баланс',fmt(p.balance))+metric('Коллекция',fmt(p.collectionValue))+metric('Usernames',p.collectionCount)+metric('Друзей',p.friendsCount||0)+metric('Сделок',p.marketDeals||0)+'</div><section class="showcase"><div class="section-title"><span>Витрина</span></div><div class="showcase-row">'+(p.showcase?.length?p.showcase.map(x=>'<div>'+x.handle+'<small>'+x.rarity+'</small></div>').join(''):'<div class="empty-line">Добавьте usernames из коллекции.</div>')+'</div></section></div>'}
function premiumView(){const p=state.premium;return '<div class="premium-page"><div class="plus-hero"><small>USERNAME+</small><h1>'+(p.active?'Подписка активна':'Больше возможностей. Без pay-to-win.')+'</h1><p>USERNAME+ не влияет на редкость дропа, награды колеса или апгрейдер.</p></div><div class="feature-list">'+p.features.map(x=>'<div>'+esc(x)+'</div>').join('')+'</div>'+(p.active?'<div class="plus-active">Активно до '+new Date(p.activeUntil).toLocaleDateString('ru-RU')+'</div>':'<button class="primary" data-premium '+(!p.starsEnabled?'disabled':'')+'>Подключить · '+p.stars+' Stars</button>')+'</div>'}
function detailView(x){return '<div class="detail-page">'+resultCard(x,false)+'<div class="detail-grid">'+metric('Экземпляр','#'+x.instanceNumber+' / '+x.maxSupply)+metric('Получен',new Date(x.obtainedAt).toLocaleDateString('ru-RU'))+metric('Длина',String((x.rawHandle||x.handle.slice(1)).length))+metric('Редкость',x.rarity)+'</div><div class="detail-actions three"><button data-showcase="'+x.id+'">'+(x.inShowcase?'Убрать с витрины':'На витрину')+'</button><button class="primary" data-list-market="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">На рынок</button><button class="sell-system" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+(x.sellValue??x.value)+'">Продать системе · '+fmt(x.sellValue??x.value)+'</button></div></div>'}
function render(){const page=state.page;if(page==='home')shell('USERNAME',homeView());else if(page==='collection')shell('Коллекция',collectionView());else if(page==='market')shell('Рынок',marketView());else if(page==='top')shell('Рейтинг',topView());else if(page==='tasks')shell('Задания',tasksView());else if(page==='wheel')shell('Колесо',wheelView());else if(page==='friends')shell('Друзья',friendsView());else if(page==='gift')shell('Подарок',giftView());else if(page==='upgrader')shell('Апгрейдер',upgraderView());else if(page==='seasons')shell('Сезоны',seasonsView());else if(page==='profile')shell('Профиль',profileView());else if(page==='premium')shell('USERNAME+',premiumView());else if(page==='detail')shell('Username',detailView(state.detail),{back:true});else if(page==='admin')shell('Админка',window.USERNAME_ADMIN?.view?.()||'<div class="empty">Админка загружается…</div>')}
async function refreshUser(){const h=await api('/api/home');state.home=h;state.user=h.user;return h}
const PAGE_TITLE={home:'USERNAME',collection:'Коллекция',market:'Рынок',top:'Рейтинг',tasks:'Задания',wheel:'Колесо',friends:'Друзья',gift:'Подарок',upgrader:'Апгрейдер',seasons:'Сезоны',profile:'Профиль',premium:'USERNAME+',admin:'Админка'};
async function load(page){
 state.page=page;state.menu=false;
 shell(PAGE_TITLE[page]||'USERNAME','<div class="screen-skeleton"><i></i><i></i><i></i><i></i></div>');
 try{
  if(!state.user||page==='home')await refreshUser();
  if(page==='collection')state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&showcase='+state.filters.showcase+'&page='+state.filters.page);
  if(page==='market')state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page='+state.marketFilters.page);
  if(page==='top')state.leaderboard=await api('/api/leaderboard');
  if(page==='tasks')state.tasks=await api('/api/tasks');
  if(page==='wheel')state.wheel=await api('/api/wheel');
  if(page==='friends')state.friends=await api('/api/friends');
  if(page==='gift')state.gift=await api('/api/gift/options');
  if(page==='upgrader'){state.upgrader=await api('/api/upgrader');state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeOutcome=null;state.upgradeSpinning=false}
  if(page==='seasons')state.season=await api('/api/seasons');
  if(page==='profile')state.profile=await api('/api/profile');
  if(page==='premium')state.premium=await api('/api/premium');
  if(page==='admin'){if(!state.user?.isAdmin)throw new Error('forbidden');state.adminDetail=null;if(!window.USERNAME_ADMIN?.refresh)throw new Error('network');await window.USERNAME_ADMIN.refresh()}
  render();
 }catch(e){shell('USERNAME','<div class="error"><b>'+esc(ERR[e.message]||'Что-то пошло не так')+'</b><button data-page="'+page+'">Повторить</button></div>')}
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
 try{
  const req=crypto.randomUUID?.()||('w-'+Date.now()),r=await api('/api/wheel',{method:'POST',body:JSON.stringify({requestId:req})});
  const items=state.wheel.rewards||[],g=wheelGeometry(items),target=g.rows.find(x=>x.key===r.reward.key),disc=document.querySelector('#wheelDisc'),res=document.querySelector('#wheelResult');
  if(disc&&target){const final=7*360-target.center;disc.style.transition='transform 3.6s cubic-bezier(.08,.72,.12,1)';requestAnimationFrame(()=>{disc.style.transform='rotate('+final+'deg)'});await new Promise(x=>setTimeout(x,3650))}
  state.wheelLastResult=r.reward;if(res){res.textContent='Выпало: '+r.reward.label;res.classList.add('show')}haptic('medium');await refreshUser();state.wheel=await api('/api/wheel');render();
 }finally{state.busy=false}
}
let upgradePreviewSeq=0;
async function refreshUpgradePreview(){
 const ids=[...(state.upgradeSelectedIds||[])],seq=++upgradePreviewSeq;
 if(!ids.length){state.upgradePreview=null;render();return}
 state.upgradePreview=null;render();
 try{const p=await api('/api/upgrader/preview',{method:'POST',body:JSON.stringify({ids})});if(seq!==upgradePreviewSeq)return;state.upgradePreview=p;render()}catch(e){if(seq===upgradePreviewSeq){state.upgradePreview=null;toast(ERR[e.message]||'Не удалось рассчитать шанс');render()}}
}
async function animateUpgradeWheel(result){
 state.upgradeOutcome=result;state.upgradeSpinning=true;render();
 const viewport=document.querySelector('#upgradeSlotViewport'),track=document.querySelector('#upgradeSlotTrack');if(!viewport||!track){state.upgradeSpinning=false;render();return}
 const targetLabel=result.success?result.target.handle:'—',pool=['@alpha','@night77','@street','@prime','@storm','@ghost','@vision','@dealer7','@matrix','@lucky'];
 const items=Array.from({length:15},(_,i)=>i===11?targetLabel:pool[i%pool.length]);track.innerHTML=items.map((x,i)=>'<div class="slot-item '+(i===11?'target':'')+'">'+esc(x)+'</div>').join('');
 const item=track.querySelector('.slot-item'),step=(item?.offsetWidth||120)+8,targetIndex=11,offset=viewport.clientWidth/2-(targetIndex*step+(item?.offsetWidth||120)/2);
 track.style.transition='none';track.style.transform='translate3d(0,0,0)';track.getBoundingClientRect();
 requestAnimationFrame(()=>{track.style.transition='transform 3.15s cubic-bezier(.08,.78,.1,1)';track.style.transform='translate3d('+offset+'px,0,0)'});
 await new Promise(r=>setTimeout(r,3200));haptic(result.success?'medium':'light');state.upgradeSpinning=false;state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgrader=await api('/api/upgrader');render();
}
function applyUserLocal(user){
  if(!user)return;state.user=user;if(state.home)state.home.user=user;
}
function removeCollectionLocal(id){
  if(!state.collection)return;
  const item=state.collection.items.find(x=>String(x.id)===String(id)),before=state.collection.items.length;
  state.collection.items=state.collection.items.filter(x=>String(x.id)!==String(id));
  if(state.collection.items.length!==before){
    state.collection.total=Math.max(0,(state.collection.total||0)-1);
    if(state.collection.summary){state.collection.summary.count=Math.max(0,(state.collection.summary.count||0)-1);state.collection.summary.value=Math.max(0,(state.collection.summary.value||0)-Number(item?.value||0))}
  }
}
function removeGiftLocal(id){
  if(state.gift?.items)state.gift.items=state.gift.items.filter(x=>String(x.id)!==String(id));
}
function removeMarketLocal(id){
  if(!state.market)return;
  const before=state.market.items.length;state.market.items=state.market.items.filter(x=>String(x.id)!==String(id));
  if(state.market.items.length!==before)state.market.total=Math.max(0,(state.market.total||0)-1);
}
document.addEventListener('click',async e=>{if(e.target.matches('[data-drop-picker-close]')){state.dropPicker=false;render();return}if(e.target.matches('[data-menu-close]')){state.menu=false;render();return}if(e.target.matches('[data-modal-close]')){e.target.closest('.modal-root')?.remove();return}const el=e.target.closest('button');if(!el)return;try{
 if(el.hasAttribute('data-menu-open')){state.menu=true;render();return}
 if(el.hasAttribute('data-menu-close')){state.menu=false;render();return}
 if(el.hasAttribute('data-collection-filter-open')){state.collectionFilterOpen=true;render();return}
 if(el.hasAttribute('data-market-filter-open')){state.marketFilterOpen=true;render();return}
 if(el.hasAttribute('data-sheet-close')){state.collectionFilterOpen=false;state.marketFilterOpen=false;render();return}
 if(el.dataset.collectionFilter){state.filters[el.dataset.collectionFilter]=el.dataset.filterValue;state.filters.page=1;state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&showcase='+state.filters.showcase+'&page=1');render();return}
 if(el.dataset.marketFilter){state.marketFilters[el.dataset.marketFilter]=el.dataset.filterValue;state.marketFilters.page=1;state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page=1');render();return}
 if(el.dataset.page){state.dropPicker=false;await load(el.dataset.page);return}
 if(el.hasAttribute('data-drop-picker-open')){state.dropPicker=true;render();return}
 if(el.dataset.dropTier){state.dropTier=el.dataset.dropTier;state.dropPicker=false;render();return}
 if(el.hasAttribute('data-drop-trigger')&&!state.busy){state.busy=true;el.disabled=true;const requestId=crypto.randomUUID?.()||('req-'+Date.now()+'-'+Math.random().toString(36).slice(2));const r=await api('/api/drop',{method:'POST',body:JSON.stringify({requestId,tier:state.dropTier})});state.home.user=r.user;state.user=r.user;await animateDrop(r.instance);state.busy=false;return}
 if(el.dataset.storyCopy){try{await navigator.clipboard.writeText(el.dataset.storyCopy);toast('Ссылка скопирована')}catch{toast('Не удалось скопировать')}return}
 if(el.dataset.shareStory){
   const item=state.home?.pending&&String(state.home.pending.id)===String(el.dataset.shareStory)?state.home.pending:null;
   if(!item){toast('Username уже недоступен для истории');return}
   el.disabled=true;
   try{await shareDropStory(item)}finally{el.disabled=false}
   return
 }
 if(el.dataset.resolve){
   state.busy=true;const action=el.dataset.resolve,r=await api('/api/drop/'+el.dataset.id+'/resolve',{method:'POST',body:JSON.stringify({action})});
   applyUserLocal(r.user);if(state.home){state.home.pending=null;state.home.last=r.instance}
   toast(action==='keep'?'Добавлено в коллекцию':'Username продан');state.busy=false;render();return
 }
 if(el.dataset.pager){const d=Number(el.dataset.dir);if(el.dataset.pager==='collection'){state.filters.page+=d;state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&showcase='+state.filters.showcase+'&page='+state.filters.page);render()}if(el.dataset.pager==='market'){state.marketFilters.page+=d;state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page='+state.marketFilters.page);render()}if(el.dataset.pager==='rank'){state.rankPage+=d;render()}return}
 if(el.dataset.marketBuy){const id=el.dataset.marketBuy,r=await api('/api/market/'+id+'/buy',{method:'POST'});removeMarketLocal(id);toast('Куплено '+r.handle);await refreshUser();render();return}
 if(el.dataset.marketCancel){const id=el.dataset.marketCancel;await api('/api/market/'+id+'/cancel',{method:'POST'});removeMarketLocal(id);toast('Лот снят');render();return}
 if(el.dataset.claim){const r=await api('/api/tasks/'+el.dataset.claim+'/claim',{method:'POST'});toast('+'+fmt(r.reward));await refreshUser();await load('tasks');return}
 if(el.dataset.profile){const r=await api('/api/profile/'+el.dataset.profile);state.backPage='top';state.page='profile';state.profile=r;render();return}
 if(el.dataset.detail){const item=state.collection?.items.find(x=>x.id===el.dataset.detail);if(item){state.backPage='collection';state.detail=item;state.page='detail';render()}return}
 if(el.dataset.showcase){const r=await api('/api/showcase/'+el.dataset.showcase,{method:'POST'});if(state.detail&&state.detail.id===el.dataset.showcase)state.detail.inShowcase=r.active;const item=state.collection?.items?.find(x=>x.id===el.dataset.showcase);if(item)item.inShowcase=r.active;toast(r.active?'Добавлено на витрину':'Убрано с витрины');render();return}
 if(el.dataset.sellSystem){openSystemSellModal(el.dataset.sellSystem,el.dataset.handle,Number(el.dataset.value));return}
 if(el.dataset.confirmSystemSell){
   const id=el.dataset.confirmSystemSell,r=await api('/api/collection/'+id+'/sell',{method:'POST'});
   closeModal(el);applyUserLocal(r.user);removeCollectionLocal(id);removeGiftLocal(id);toast(r.handle+' продан за '+fmt(r.sellValue??r.value));
   if(state.page==='detail'){state.page='collection';state.detail=null}render();return
 }
 if(el.dataset.listMarket){openMarketModal(el.dataset.listMarket,el.dataset.handle,Number(el.dataset.value));return}
 if(el.dataset.createListing){
   const id=el.dataset.createListing,root=el.closest('.modal-root'),price=Number(root.querySelector('#listingPrice').value);
   await api('/api/market',{method:'POST',body:JSON.stringify({instanceId:id,price})});closeModal(el);removeCollectionLocal(id);removeGiftLocal(id);toast('Лот опубликован');
   if(state.page==='detail'){state.page='collection';state.detail=null}render();return
 }
 if(el.hasAttribute('data-modal-close')){closeModal(el);return}
 if(el.hasAttribute('data-wheel')){await spinWheelUi();return}
 if(el.hasAttribute('data-copy-ref')){if(!state.friends.referralLink){toast('Ссылка недоступна');return}await navigator.clipboard.writeText(state.friends.referralLink);toast('Ссылка скопирована');return}
 if(el.hasAttribute('data-share-ref')){const f=state.friends;if(!f?.referralLink)return;const share='https://t.me/share/url?url='+encodeURIComponent(f.referralLink)+'&text='+encodeURIComponent(f.shareText||'Я играю в USERNAME. Залетай 👇');if(typeof TG?.openTelegramLink==='function')TG.openTelegramLink(share);else window.open(share,'_blank','noopener');return}
 if(el.hasAttribute('data-gift')){const instanceId=document.querySelector('#giftInstance')?.value,friendId=document.querySelector('#giftFriend')?.value;if(!instanceId||!friendId){toast('Выберите username и друга');return}const r=await api('/api/gift',{method:'POST',body:JSON.stringify({instanceId,friendId})});removeGiftLocal(instanceId);removeCollectionLocal(instanceId);toast(r.handle+' отправлен пользователю '+r.recipient);render();return}
 if(el.dataset.upItem){
   const id=el.dataset.upItem,ids=[...(state.upgradeSelectedIds||[])],i=ids.indexOf(id);
   if(i>=0)ids.splice(i,1);else{if(ids.length>=(state.upgrader?.maxItems||5)){haptic('light');return}ids.push(id)}
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
}catch(err){state.busy=false;toast(ERR[err.message]||'Что-то пошло не так');el.disabled=false}});
let marketSearchTimer;
document.addEventListener('input',e=>{if(e.target.id==='marketQuery'){clearTimeout(marketSearchTimer);const q=e.target.value||'';marketSearchTimer=setTimeout(async()=>{state.marketFilters.q=q;state.marketFilters.page=1;try{state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page=1');render();requestAnimationFrame(()=>{const input=document.querySelector('#marketQuery');if(input){input.focus();input.setSelectionRange(q.length,q.length)}})}catch{}},320)}});
window.USERNAME_APP={state,api,render,icon,esc,fmt,metric,refreshUser,toast,ERR};
import('/admin-ui.js?v=4.2.0').catch(()=>{});
load('home');
