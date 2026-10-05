let TG=window.Telegram?.WebApp;
const root=document.documentElement,app=document.querySelector('#app'),toastEl=document.querySelector('#toast');
const state={
  page:'home',user:null,home:null,collection:null,market:null,leaderboard:null,tasks:null,wheel:null,friends:null,gift:null,upgrader:null,season:null,profile:null,premium:null,detail:null,admin:null,adminDetail:null,
  menu:false,busy:false,backPage:'collection',dropTier:'basic',dropPicker:false,collectionFilterOpen:false,marketFilterOpen:false,upgradeOutcome:null,
  filters:{sort:'new',digits:'all',showcase:'all',page:1},marketFilters:{sort:'new',digits:'all',q:'',page:1},
  rankPage:1,upgradeSelectedIds:[],upgradePreview:null,upgradeStage:'source',upgradeTargetSessionId:'',upgradeSpinning:false,upgradeVisibleCount:30,upgradeScrollTop:0,upgradeLastRound:null,upgradeLandingAngle:0,wheelLastResult:null,adminPage:1,adminQuery:'',adminResetStage:0
};
const fmt=n=>'$'+new Intl.NumberFormat('en-US').format(Math.round(Number(n)||0));
function untilText(iso){
 const ms=Math.max(0,new Date(iso).getTime()-Date.now()),mins=Math.max(1,Math.ceil(ms/60000));
 const h=Math.floor(mins/60),m=mins%60;
 if(h>=24){const d=Math.floor(h/24),rh=h%24;return d+' дн.'+(rh?' '+rh+' ч':'')}
 if(h)return h+' ч'+(m?' '+m+' мин':'');
 return m+' мин';
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ERR={
  unauthorized:'Откройте игру через Telegram',blocked:'Аккаунт заблокирован',insufficient_funds:'Недостаточно денег',pending_drop:'Сначала решите, что делать с текущим username',
  collection_full:'Коллекция заполнена',recipient_full:'У получателя заполнена коллекция',sold_out:'Тираж закончился',too_fast:'Слишком быстро. Попробуйте ещё раз',
  listing_not_found:'Лот уже недоступен',own_listing:'Нельзя купить свой лот',already_listed:'Username уже на рынке',not_friend:'Пользователь не в списке друзей',
  wheel_cooldown:'Колесо уже использовано сегодня',upgrade_invalid_items:'Выбранный username недоступен',upgrade_bad_recipe:'Этот username нельзя улучшить',
  upgrade_session_expired:'Предпросмотр устарел. Выберите usernames заново',upgrade_session_mismatch:'Состав апгрейда изменился',upgrade_unavailable:'Сейчас не удалось подобрать цели. Попробуйте ещё раз',premium_unavailable:'Telegram Stars пока недоступны',showcase_full:'Витрина заполнена',recipient_blocked:'Получатель заблокирован',rate_limited:'Слишком много действий. Попробуйте через минуту',story_unsupported:'Обновите Telegram — истории из Mini App поддерживаются в новых версиях',story_https_required:'Не удалось подготовить HTTPS-картинку истории',forbidden:'Нет доступа',bad_username:'Некорректный username',username_exists:'Такой username уже существует',reset_confirmation_required:'Введите RESET USERNAME',network:'Нет соединения с сервером'
};
function syncViewport(){const h=TG?.viewportStableHeight||TG?.viewportHeight||innerHeight;if(h)root.style.setProperty('--app-h',Math.round(h)+'px');const s=TG?.safeAreaInset||{},c=TG?.contentSafeAreaInset||{};root.style.setProperty('--safe-t',Math.max(s.top||0,c.top||0)+'px');root.style.setProperty('--safe-b',Math.max(s.bottom||0,c.bottom||0)+'px')}
try{TG?.ready();TG?.expand();TG?.setHeaderColor?.('#F4F5F7');TG?.setBackgroundColor?.('#F4F5F7');syncViewport();TG?.onEvent?.('viewportChanged',syncViewport);TG?.onEvent?.('safeAreaChanged',syncViewport);TG?.onEvent?.('contentSafeAreaChanged',syncViewport)}catch{syncViewport()}
addEventListener('resize',syncViewport);
function haptic(type='light'){try{TG?.HapticFeedback?.impactOccurred(type)}catch{}}
function toast(t){toastEl.textContent=t;toastEl.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>toastEl.classList.remove('show'),1900)}
async function initData(){let d=TG?.initData||'',end=Date.now()+1600;while(!d&&Date.now()<end){await new Promise(r=>setTimeout(r,50));TG=window.Telegram?.WebApp||TG;d=TG?.initData||''}return d}
function startParam(){
 const q=new URLSearchParams(location.search);
 return String(TG?.initDataUnsafe?.start_param||q.get('tgWebAppStartParam')||q.get('startapp')||q.get('ref')||'');
}
async function api(url,opts={}){const headers={'Content-Type':'application/json',...(opts.headers||{})};const d=await initData();if(d)headers['X-Telegram-Init-Data']=d;else if(location.hostname==='localhost'||location.hostname==='127.0.0.1')headers['X-Dev-User']=localStorage.devUser||'10001';const sp=startParam();if(sp)headers['X-Start-Param']=sp;const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),9000);try{const r=await fetch(url,{...opts,headers,cache:'no-store',signal:ctl.signal});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'network');return j}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('network');throw e}finally{clearTimeout(tm)}}
const ICON_NAME=Object.freeze({
 home:'house',menu:'menu',close:'x',back:'chevron-left',
 market:'store',rank:'chart-bar-increasing',tasks:'list-checks',wheel:'circle-gauge',
 friends:'users',gift:'gift',upgrade:'trending-up',season:'trophy',
 collection:'layout-grid',profile:'user-round',premium:'gem',filter:'sliders-horizontal',
 search:'search',admin:'shield-check',story:'share-2',chevron:'chevron-right',
 down:'chevron-down',plus:'plus',check:'check',x:'x'
});
function icon(k){const name=ICON_NAME[k]||ICON_NAME.menu;return '<i class="ico lucide-slot" data-lucide="'+name+'" aria-hidden="true"></i>'}
function marketFilterIcon(){return '<svg class="market-filter-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="14" cy="7" r="2.3" fill="#fff" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="17" r="2.3" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>'}
let lucideRetry=0;
function hydrateIcons(){
 try{
  if(window.lucide?.createIcons){window.lucide.createIcons({attrs:{'stroke-width':'2.2'}});lucideRetry=0;return}
 }catch{}
 if(lucideRetry<20){lucideRetry++;setTimeout(hydrateIcons,100)}
}
addEventListener('load',hydrateIcons,{once:true});
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function balance(){return fmt(state.user?.balance||state.home?.user?.balance||0)}
const MENU=[
 ['home','home','Дроп','Испытай удачу'],['market','market','Рынок','Покупай и продавай'],['top','rank','Рейтинг','Кто богаче'],['tasks','tasks','Задания','Ежедневные цели'],['wheel','wheel','Колесо','Бесплатно раз в 24 часа'],
 ['friends','friends','Друзья','Приглашения и награды'],['gift','gift','Подарок','Передать username'],['upgrader','upgrade','Апгрейдер','Рискнуть коллекцией'],['seasons','season','Сезоны','Рейтинг сезона']
];
const MENU_BOTTOM=[['collection','collection','Коллекция'],['profile','profile','Профиль'],['premium','premium','USERNAME+']];
function menuHtml(){
 const main=[...MENU],bottom=[...MENU_BOTTOM];
 const shortLabel=t=>({'Рейтинг':'Топ','USERNAME+':'Plus'}[t]||t);
 const tiles=list=>list.map(([p,i,t])=>'<button class="menu-tile" data-page="'+p+'" aria-label="'+esc(t)+'" title="'+esc(t)+'">'+icon(i)+'<span>'+esc(shortLabel(t))+'</span></button>').join('');
 return '<div class="menu-backdrop '+(state.menu?'open':'')+'" data-menu-close><aside class="menu-sheet menu-grid-sheet" data-menu-sheet>'+
  '<div class="menu-grid-top">'+(state.user?.isAdmin?'<button class="menu-admin-shortcut" data-page="admin" aria-label="Админка" title="Админка">'+icon('admin')+'<span>Админ</span></button>':'<span></span>')+'<button class="menu-head-icon" data-menu-close aria-label="Закрыть">'+icon('close')+'</button></div>'+
  '<div class="menu-grid-main">'+tiles(main)+'</div>'+
  '<div class="menu-grid-divider"></div>'+
  '<div class="menu-grid-bottom">'+tiles(bottom)+'</div>'+
 '</aside></div>'
}
function topbar(title,{back=false}={}){return '<header class="topbar">'+(back?'<button class="top-back" data-back>'+icon('back')+'</button>':'')+'<div class="top-title"><b>'+esc(title)+'</b></div><div class="top-actions"><span>'+balance()+'</span><button data-menu-open>'+icon('menu')+'</button></div></header>'}
function shell(title,html,opts={}){
 window.__USERNAME_READY=true;
 app.innerHTML='<div class="shell"><section class="screen">'+topbar(title,opts)+html+'</section>'+menuHtml()+'</div>';
 requestAnimationFrame(()=>{fitAllUsernames();hydrateIcons();if(state.page==='upgrader'){const list=document.querySelector('.upgrade-list');if(list)list.scrollTop=state.upgradeScrollTop||0}});
}
function fitUsername(el,max=48,min=20){if(!el)return;el.style.fontSize='';let size=Math.min(max,parseFloat(getComputedStyle(el).fontSize)||max);const room=Math.max(1,el.parentElement?.clientWidth||el.clientWidth);while(size>min&&el.scrollWidth>room-8){size-=1;el.style.fontSize=size+'px'}}
function fitAllUsernames(){document.querySelectorAll('[data-fit-username]').forEach(el=>fitUsername(el,Number(el.dataset.maxSize||48),Number(el.dataset.minSize||20)))}
const ROLL_BASES=['velorian','coldvibe','nightfall','serenity','monarch','privated','lunaris','hazewave','nightcore','rareline','daylight','blackout','phantom','vision','storm','dealer','master','prime','street','matrix','lucky','silent','crimson','shadow','winter','aurora','glacier','moonwave','novaline','royal'];
function rollRandomInt(max){if(max<=1)return 0;try{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}catch{return Math.floor(Math.random()*max)}}
function randomRollUsername(used=new Set(),blocked=''){
 for(let tries=0;tries<80;tries++){
  const base=ROLL_BASES[rollRandomInt(ROLL_BASES.length)];
  const mode=rollRandomInt(5);let raw=base;
  if(mode===1)raw=(base+'x').slice(0,10);
  else if(mode===2)raw=(base+String(rollRandomInt(90)+10)).slice(0,10);
  else if(mode===3)raw=(base+String(rollRandomInt(900)+100)).slice(0,10);
  else if(mode===4&&base.length>7)raw=base.slice(0,7)+String(rollRandomInt(9)+1);
  raw=raw.replace(/[^a-z0-9_]/g,'').slice(0,10);
  const handle='@'+raw;if(raw.length>=4&&handle!==blocked&&!used.has(handle)){used.add(handle);return handle}
 }
 let fallback;do{fallback='@user'+String(rollRandomInt(900000)+100000).slice(0,6)}while(used.has(fallback)||fallback===blocked);used.add(fallback);return fallback;
}
function buildRollSequence(count,finalHandle=''){const used=new Set();const rows=[];for(let i=0;i<count;i++)rows.push(randomRollUsername(used,String(finalHandle||'')));return rows}
function shuffleUpgradeItems(items){const out=[...(items||[])];for(let i=out.length-1;i>0;i--){const j=rollRandomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}

function resultCard(x,pending=false){
 return '<article class="drop-result-card minimal-result">'+
   '<div class="drop-result-main minimal"><h1 data-fit-username data-max-size="48" data-min-size="24">'+esc(x.handle)+'</h1></div>'+
   (pending?'<div class="drop-result-actions compact-actions"><button data-resolve="keep" data-id="'+x.id+'">Оставить</button><button class="secondary" data-resolve="sell" data-id="'+x.id+'">Продать · '+fmt(x.value)+'</button><button class="story-icon-btn" data-share-story="'+x.id+'" aria-label="Выложить в историю" title="Выложить в историю">'+icon('story')+'</button></div>':'')+
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
  return tiers[state.dropTier]||tiers.basic||{key:'basic',label:'$25K',cost:25000};
}
function dropPricePicker(tiers){
 if(!state.dropPicker)return '';
 return '<div class="drop-cost-overlay"><button class="drop-cost-back" data-drop-picker-close aria-label="Закрыть"></button><div class="drop-cost-sheet"><div class="drop-cost-title"><b>Стоимость попытки</b><span>Выберите цену дропа</span></div>'+Object.values(tiers).map(t=>'<button class="drop-cost-option '+(state.dropTier===t.key?'active':'')+'" data-drop-tier="'+t.key+'"><span>'+esc(t.label)+'</span><b>'+fmt(t.cost)+'</b></button>').join('')+'</div></div>';
}
function homeView(){
 const h=state.home,u=h.user,last=h.last,p=h.pending,tiers=h.config.dropTiers||{},tier=selectedDropTier();
 const freeBasic=u.freeDrops>0&&state.dropTier==='basic',payCost=freeBasic?0:Number(tier.cost||25000),cantAfford=!freeBasic&&u.balance<payCost;
 const quick=[
  ['collection','collection','Коллекция'],['market','market','Рынок'],['tasks','tasks','Задания'],['wheel','wheel','Колесо']
 ].map(([page,ico,label])=>'<button class="home-shortcut" data-page="'+page+'">'+icon(ico)+'<span>'+label+'</span></button>').join('');
 return '<div class="home">'+dropPricePicker(tiers)+'<div class="home-metrics">'+metric('Капитал',fmt(u.capital))+metric('Место','#'+u.rank)+metric('Usernames',u.collectionCount)+'</div>'+
 '<section class="drop-zone">'+(!p?'<div class="drop-price-corner"><button class="drop-cost-trigger compact" data-drop-picker-open>'+fmt(tier.cost)+' <em>'+icon('down')+'</em></button></div>':'')+
 (p?resultCard(p,true):'<button class="handle-stage drop-trigger" id="handleStage" data-drop-trigger '+(cantAfford?'disabled':'')+' aria-label="Получить случайный username"><b data-fit-username data-max-size="54" data-min-size="25">@username</b>'+(cantAfford?'<small>Недостаточно денег</small>':'')+'</button>')+
 '</section><section class="last"><div class="section-title"><span>Последний username</span></div>'+(last?'<div class="last-row"><b>'+esc(last.handle)+'</b><strong>'+fmt(last.value)+'</strong></div>':'<div class="empty-line">История появится после первого дропа.</div>')+'</section>'+
 '<section class="home-shortcuts" aria-label="Быстрый доступ">'+quick+'</section></div>';
}
async function animateDrop(result){
 const stage=document.querySelector('#handleStage');if(!stage)return;stage.disabled=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,delays=reduced?[80,110]:[32,32,36,40,43,47,54,61,68,79,90,104,122,144,166,187,216,252,302,374],samples=buildRollSequence(delays.length,result.handle);let i=0;
 for(const d of delays){stage.classList.add('rolling');stage.innerHTML='<b data-fit-username data-max-size="54" data-min-size="25">'+samples[i++]+'</b><small>Прокрутка…</small>';fitAllUsernames();await new Promise(r=>setTimeout(r,d))}
 stage.innerHTML='<b data-fit-username data-max-size="54" data-min-size="25">'+esc(result.handle)+'</b><small>Выпало</small>';fitAllUsernames();stage.classList.remove('rolling');stage.classList.add('land');haptic('medium');await new Promise(r=>setTimeout(r,reduced?90:120));state.home.pending=result;render();
}
function collectionFilterSheet(){
 if(!state.collectionFilterOpen)return '';
 const f=state.filters,row=(label,key,value,current)=>'<button data-collection-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр коллекции</b><button data-sheet-close>'+icon('close')+'</button></div><span>Стоимость</span><div class="sheet-options">'+row('Сначала дорогие','sort','expensive',f.sort)+row('Сначала дешёвые','sort','cheap',f.sort)+'</div><span>Дата</span><div class="sheet-options">'+row('Сначала новые','sort','new',f.sort)+row('Сначала старые','sort','old',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div><span>Витрина</span><div class="sheet-options">'+row('Все','showcase','all',f.showcase)+row('Только витрина','showcase','only',f.showcase)+'</div></aside></div>';
}
function collectionView(){
 const c=state.collection||{items:[],summary:{count:0,value:0},page:1,pages:1};
 return '<div class="page-body collection-page collection-page-clean">'+collectionFilterSheet()+
  '<div class="screen-toolbar collection-toolbar"><div><b>'+(c.summary?.count||0)+' usernames</b><span>Общая стоимость · '+fmt(c.summary?.value||0)+'</span></div><button class="collection-filter-button" data-collection-filter-open aria-label="Фильтр">'+marketFilterIcon()+'</button></div>'+
  '<div class="collection-grid">'+(c.items.length?c.items.map(x=>'<article class="user-card collection-card">'+
   '<button class="user-card-main" data-detail="'+x.id+'"><span data-fit-username data-max-size="18" data-min-size="11">'+esc(x.handle)+'</span><b>'+fmt(x.value)+'</b><small>'+(x.inShowcase?'На витрине':'В коллекции')+'</small></button>'+
   '<button class="user-card-sell" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+(x.sellValue??x.value)+'">Продать</button>'+
  '</article>').join(''):'<div class="empty">По этому фильтру ничего нет.</div>')+'</div>'+pager(c.page,c.pages,'collection')+'</div>';
}
function pager(page,pages,type){if(pages<=1)return '';return '<div class="pager"><button data-pager="'+type+'" data-dir="-1" '+(page<=1?'disabled':'')+'>Назад</button><span>'+page+' / '+pages+'</span><button data-pager="'+type+'" data-dir="1" '+(page>=pages?'disabled':'')+'>Дальше</button></div>'}
function marketFilterSheet(){
 if(!state.marketFilterOpen)return '';
 const f=state.marketFilters,row=(label,key,value,current)=>'<button data-market-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр рынка</b><button data-sheet-close>'+icon('close')+'</button></div><span>Цена</span><div class="sheet-options">'+row('Сначала дешёвые','sort','cheap',f.sort)+row('Сначала дорогие','sort','expensive',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div><span>Дата</span><div class="sheet-options">'+row('Новые','sort','new',f.sort)+'</div></aside></div>';
}
function marketView(){
 const m=state.market||{items:[],page:1,pages:1};
 return '<div class="page-body market-page">'+marketFilterSheet()+'<div class="market-search"><label>'+icon('search')+'<input id="marketQuery" value="'+esc(state.marketFilters.q)+'" placeholder="Поиск username..." autocomplete="off"></label><button class="market-filter-button" data-market-filter-open aria-label="Фильтр">'+marketFilterIcon()+'</button></div><div class="market-list">'+(m.items.length?m.items.map(x=>'<article class="market-card"><div class="market-main"><span data-fit-username data-max-size="20" data-min-size="13">'+esc(x.handle)+'</span><b>'+fmt(x.price)+'</b><small>Продавец: '+esc(x.sellerName)+'</small></div>'+(x.sellerId===state.user?.id?'<button class="secondary" data-market-cancel="'+x.id+'">Снять с продажи</button>':'<button class="primary" data-market-buy="'+x.id+'">Купить</button>')+'</article>').join(''):'<div class="empty">Ничего не найдено.</div>')+'</div>'+pager(m.page,m.pages,'market')+'</div>';
}
function topView(){
 const all=state.leaderboard?.items||[],top=all.slice(0,3),rest=all.slice(3),size=10,pages=Math.max(1,Math.ceil(rest.length/size));
 state.rankPage=Math.max(1,Math.min(state.rankPage,pages));const list=rest.slice((state.rankPage-1)*size,state.rankPage*size);
 const card=(r,pos,hero=false)=>r?'<button class="money-rank '+(hero?'hero':'')+'" data-profile="'+r.id+'"><small>#'+pos+'</small><b>'+esc(r.first_name||r.username||'Игрок')+'</b><strong>'+fmt(r.capital)+'</strong><span>'+(r.best_handle||'Без usernames')+'</span></button>':'';
 return '<div class="page-body rank-page"><div class="rank-summary money"><span>ОБЩИЙ КАПИТАЛ</span><b>Кто богаче</b><small>Баланс + стоимость всех активных usernames</small></div><div class="podium">'+card(top[0],1,true)+'<div>'+card(top[1],2)+card(top[2],3)+'</div></div><div class="rank-list money-list">'+list.map(r=>'<button class="rank-row" data-profile="'+r.id+'"><span class="pos">#'+r.position+'</span><div><b>'+esc(r.first_name||r.username||'Игрок')+'</b><small>'+(r.best_handle||'Без usernames')+'</small></div><strong>'+fmt(r.capital)+'</strong></button>').join('')+'</div>'+pager(state.rankPage,pages,'rank')+'</div>';
}
function tasksView(){return '<div class="page-scroll task-list">'+(state.tasks?.items||[]).map(t=>{
 const done=t.current>=t.target,status=t.claimed?'<span class="task-status done">'+icon('check')+' Получено</span>':done?'<button class="task-claim" data-claim="'+t.key+'">Забрать</button>':'<span class="task-status">В процессе</span>';
 return '<article class="task compact-task"><div class="task-head"><div><b>'+esc(t.label)+'</b><strong>+'+fmt(t.reward)+'</strong></div><span>'+t.current+' / '+t.target+'</span></div><div class="progress"><i style="width:'+Math.min(100,t.current/t.target*100)+'%"></i></div><div class="task-foot">'+status+'</div></article>';
 }).join('')+'</div>'}
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
function wheelPoint(angle,r=48){
 const a=(Number(angle)-90)*Math.PI/180;
 return [50+r*Math.cos(a),50+r*Math.sin(a)];
}
function wheelSlicePath(start,end,r=48){
 const [x1,y1]=wheelPoint(start,r),[x2,y2]=wheelPoint(end,r),large=(end-start)>180?1:0;
 return 'M50 50 L'+x1.toFixed(3)+' '+y1.toFixed(3)+' A'+r+' '+r+' 0 '+large+' 1 '+x2.toFixed(3)+' '+y2.toFixed(3)+' Z';
}
function wheelSliceFill(x,i){
 if(x.type==='username')return '#bfe9fb';
 if(x.type==='drop')return '#d9f2fc';
 if(x.type==='xp')return '#e9eef2';
 return i%2?'#f1f3f5':'#ffffff';
}
function wheelLabelRotation(angle){
 const base=Number(angle)-90;
 return base>90&&base<270?base+180:base;
}
function wheelSvgMarkup(rows){
 return '<svg class="fortune-svg" id="wheelDisc" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" aria-hidden="true">'+
  '<circle cx="50" cy="50" r="48.3" fill="#f8f9fa"></circle>'+
  rows.map((x,i)=>{
   const [tx,ty]=wheelPoint(x.center,32.5),label=x.span>=10?('<text x="'+tx.toFixed(2)+'" y="'+ty.toFixed(2)+'" transform="rotate('+wheelLabelRotation(x.center).toFixed(2)+' '+tx.toFixed(2)+' '+ty.toFixed(2)+')" text-anchor="middle" dominant-baseline="middle">'+esc(wheelShortLabel(x))+'</text>'):'';
   return '<path class="fortune-slice" d="'+wheelSlicePath(x.start,x.end,47.4)+'" fill="'+wheelSliceFill(x,i)+'" stroke="#ffffff" stroke-width=".7"></path>'+label;
  }).join('')+
  '<circle cx="50" cy="50" r="47.4" fill="none" stroke="#d8dde2" stroke-width=".9"></circle>'+
  '<circle cx="50" cy="50" r="40.6" fill="none" stroke="rgba(255,255,255,.72)" stroke-width=".45"></circle>'+
 '</svg>';
}
function wheelView(){
 const w=state.wheel||{rewards:[],available:false},g=wheelGeometry(w.rewards||[]),rare=g.rows.filter(x=>x.span<10),last=state.wheelLastResult;
 return '<div class="wheel-page wheel-page-clean"><section class="wheel-card wheel-card-clean"><div class="fortune-stage">'+
  '<div class="fortune-rim"></div>'+
  wheelSvgMarkup(g.rows)+
  '<div class="fortune-pointer"><i></i></div>'+
  '<div class="fortune-hub"><b>@</b><span>USERNAME</span></div>'+
 '</div>'+
 (rare.length?'<div class="wheel-rare"><span>РЕДКИЕ СЕКТОРЫ</span><div>'+rare.map(x=>'<b>'+esc(wheelShortLabel(x))+'</b>').join('')+'</div></div>':'')+'</section>'+
 '<div class="wheel-copy"><b>'+(w.available?'Бесплатное вращение':'Уже использовано')+'</b><span>'+(w.available?'Одно вращение раз в 24 часа':('Следующее вращение через '+untilText(w.nextAt)))+'</span></div>'+
 '<button class="primary wheel-spin-button" data-wheel '+(!w.available?'disabled':'')+'>'+(w.available?'Крутить':'Недоступно')+'</button>'+
 '<div id="wheelResult" class="wheel-result '+(last?'show':'')+'">'+(last?('Выпало: '+esc(last.label)):'')+'</div></div>';
}
function friendsView(){
 const f=state.friends||{friends:[],rewards:[],invited:0,active:0},link=f.referralLink||'';
 return '<div class="page-body friends-page"><div class="friends-intro"><b>Друзья</b><span>Приглашай друзей и собирай коллекцию вместе.</span></div><section class="ref-card"><small>ТВОЯ ССЫЛКА</small><b>'+esc(link||'Ссылка загружается…')+'</b><div><button class="secondary" data-copy-ref '+(!link?'disabled':'')+'>Скопировать</button><button class="primary" data-share-ref '+(!link?'disabled':'')+'>Отправить другу</button></div></section><div class="friend-stats">'+metric('Приглашено',f.invited)+metric('Наград',f.rewardsCount??f.rewards.length)+metric('До следующей',f.nextReward?f.nextReward.remaining:'—')+'</div><div class="section-label">Друзья</div><div class="friends-list">'+(f.friends.length?f.friends.map(x=>'<div class="friend-row"><div><b>'+esc(x.first_name||x.username||'Игрок')+'</b><span>'+(x.username?'@'+esc(x.username):'Без username')+'</span></div><strong>ур. '+x.level+'</strong></div>').join(''):'<div class="empty">Пригласи первого друга.</div>')+'</div></div>';
}
function giftView(){const g=state.gift;return '<div class="gift-page gift-page-clean"><div class="form-card gift-card"><label>Username<select id="giftInstance"><option value="">Выберите username</option>'+g.items.map(x=>'<option value="'+x.id+'">'+x.handle+' · '+fmt(x.value)+'</option>').join('')+'</select></label><label>Друг<select id="giftFriend"><option value="">Выберите друга</option>'+g.friends.map(x=>'<option value="'+x.id+'">'+esc(x.first_name||x.username||'Игрок')+'</option>').join('')+'</select></label><div class="notice gift-notice">Передача необратима. Username должен быть в коллекции и не находиться на рынке.</div><button class="primary" data-gift>Подарить</button></div></div>'}
function selectedUpgradeItems(){
 const list=state.upgrader?.available||[],set=new Set(state.upgradeSelectedIds||[]);
 return list.filter(x=>set.has(x.id));
}
function upgradeChanceText(value){
 const raw=Number(value||0)*100;
 return raw<10?raw.toFixed(1):Math.round(raw).toString();
}
function upgradeTargetOptions(){
 const list=state.upgradePreview?.targets;
 if(Array.isArray(list)&&list.length)return list;
 return state.upgradePreview?.sessionId?[state.upgradePreview]:[];
}
function selectedUpgradeTarget(){
 const id=String(state.upgradeTargetSessionId||'');
 return upgradeTargetOptions().find(x=>String(x.sessionId)===id)||null;
}
function upgradeRowHtml(x){
 const selected=(state.upgradeSelectedIds||[]).includes(x.id);
 return '<button class="upgrade-pick upgrade-source-card '+(selected?'selected':'')+'" data-up-item="'+x.id+'">'+
  '<span class="upgrade-source-handle">'+esc(x.handle)+'</span>'+
  '<span class="upgrade-source-price">'+fmt(x.value)+'</span>'+
 '</button>';
}
function upgradeTargetRowHtml(x){
 const selected=String(state.upgradeTargetSessionId||'')===String(x.sessionId),chance=upgradeChanceText(x.chance);
 return '<button class="upgrade-target-pick '+(selected?'selected':'')+'" data-up-target="'+esc(x.sessionId)+'"><span class="upgrade-target-main"><b data-fit-username data-max-size="18" data-min-size="12">'+esc(x.target.handle)+'</b><small>'+fmt(x.target.value)+'</small></span><span class="upgrade-target-chance"><small>ШАНС</small><strong>'+chance+'%</strong></span><i>'+(selected?icon('check'):icon('chevron'))+'</i></button>';
}
function appendUpgradeBatch(){
 const list=document.querySelector('.upgrade-list'),all=state.upgrader?.available||[];if(!list)return;
 const from=Math.min(state.upgradeVisibleCount||30,all.length),to=Math.min(all.length,from+18);if(to<=from)return;
 const tpl=document.createElement('template');tpl.innerHTML=all.slice(from,to).map(upgradeRowHtml).join('');list.append(tpl.content);state.upgradeVisibleCount=to;hydrateIcons();
}

function upgraderView(){
 const u=state.upgrader||{available:[],maxItems:1},selected=selectedUpgradeItems(),liveSource=selected[0],round=state.upgradeLastRound;
 const stage=state.upgradeStage||'source';
 if(stage==='source'){
  return '<div class="upgrade-page upgrade-source-stage">'+
   '<div class="upgrade-step-head upgrade-source-head"><span>ШАГ 1 ИЗ 3</span><b>Выбери свой username</b></div>'+
   '<div class="upgrade-list-title"><b>Твои usernames</b><span>'+(u.available||[]).length+' доступно</span></div>'+
   '<div class="upgrade-list upgrade-source-list">'+((u.available||[]).length?(u.available||[]).slice(0,state.upgradeVisibleCount||30).map(upgradeRowHtml).join(''):'<div class="empty">Нет usernames для апгрейда.</div>')+'</div>'+
  '</div>';
 }
 if(stage==='target'){
  const targets=upgradeTargetOptions(),picked=selectedUpgradeTarget();
  return '<div class="upgrade-page upgrade-target-stage">'+
   '<div class="upgrade-step-head with-action"><div><span>ШАГ 2 ИЗ 3</span><b>Что хочешь получить?</b><small>Чем дороже username — тем ниже шанс.</small></div><button class="secondary upgrade-back-step" data-upgrade-back-source>'+icon('back')+' Назад</button></div>'+
   '<section class="upgrade-source-summary"><span>ТЫ СТАВИШЬ</span><div><b data-fit-username data-max-size="20" data-min-size="12">'+(liveSource?esc(liveSource.handle):'—')+'</b><strong>'+(liveSource?fmt(liveSource.value):'—')+'</strong></div></section>'+
   '<div class="upgrade-list-title"><b>Выбери цель</b><span>'+targets.length+' вариантов</span></div>'+
   '<div class="upgrade-target-list">'+(targets.length?targets.map(upgradeTargetRowHtml).join(''):'<div class="upgrade-target-loading"><span></span><b>Подбираем варианты…</b><small>Считаем цены и реальные шансы.</small></div>')+'</div>'+
   '<div class="upgrade-footer upgrade-target-footer"><div><span>Шанс</span><b>'+(picked?upgradeChanceText(picked.chance)+'%':'—')+'</b></div><button class="primary" data-upgrade '+(!picked||state.upgradeSpinning?'disabled':'')+'>'+icon('upgrade')+' Апгрейд</button></div>'+
  '</div>';
 }
 const picked=selectedUpgradeTarget(),source=round?.source||liveSource,target=round?.target||picked?.target||state.upgradeOutcome?.target;
 const chanceValue=round?.chance??picked?.chance??state.upgradeOutcome?.chance??0,chance=upgradeChanceText(chanceValue),angle=Math.max(3,Math.min(270,Number(chanceValue||0)*360)),landing=round?Number(state.upgradeLandingAngle||0):0;
 const wheelAngle=round?((360-(landing%360))%360):0;
 const done=!!state.upgradeOutcome&&!state.upgradeSpinning&&!!round,success=!!state.upgradeOutcome?.success;
 return '<div class="upgrade-page upgrade-spin-stage">'+
  '<section class="upgrade-matchup">'+
   '<div class="upgrade-match-side source"><small>СТАВИШЬ</small><b data-fit-username data-max-size="18" data-min-size="11">'+(source?esc(source.handle):'—')+'</b><strong>'+(source?fmt(source.value):'—')+'</strong></div>'+
   '<div class="upgrade-match-arrow">'+icon('chevron')+'</div>'+
   '<div class="upgrade-match-side target"><small>МОЖЕШЬ ПОЛУЧИТЬ</small><b data-fit-username data-max-size="18" data-min-size="11">'+(target?esc(target.handle):'—')+'</b><strong>'+(target?fmt(target.value):'—')+'</strong></div>'+
  '</section>'+
  '<section class="upgrade-wheel-card ready '+(done?(success?'round-win':'round-fail'):'')+'">'+
   '<div class="upgrade-roulette upgrade-roulette-clean" style="--chance-angle:'+angle+'deg">'+
    '<div class="upgrade-wheel-rotor" id="upgradeRotor" style="transform:rotate('+wheelAngle+'deg)"><div class="upgrade-ring"></div></div>'+
    '<div class="upgrade-pointer-static"></div>'+
    '<div class="upgrade-ring-core"><b>'+chance+'%</b><span>ШАНС</span></div>'+
   '</div>'+
  '</section>'+
  (done?'<section class="upgrade-result-panel '+(success?'success':'fail')+'"><small>'+(success?'УСПЕХ':'НЕ ПОВЕЗЛО')+'</small><b>'+(success?'Круто, апгрейд залетел!':'Апгрейд не зашёл')+'</b><span>'+(success?('Ты получил '+esc(state.upgradeOutcome.result.handle)+' · '+fmt(state.upgradeOutcome.result.value)):((source?esc(source.handle):'Username')+' сгорел. Можно рискнуть ещё раз.'))+'</span><button class="primary" data-upgrade-continue>'+(success?'Продолжить':'Попробовать ещё раз')+'</button></section>':'')+
 '</div>';
}
function seasonsView(){const s=state.season?.season;if(!s)return '<div class="empty">Активного сезона нет.</div>';return '<div class="page-body"><section class="season-hero"><small>ТЕКУЩИЙ СЕЗОН</small><h1>'+esc(s.name)+'</h1><div>'+metric('Осталось',s.daysLeft+' дн.')+metric('Место','#'+s.rank)+metric('Season Score',s.score)+'</div></section><div class="section-label">Награды</div><div class="season-rewards">'+s.rewards.map(x=>'<div><b>'+x.place+'</b><span>'+x.reward+'</span></div>').join('')+'</div>'+(s.series?.length?'<div class="section-label">Активные серии</div><div class="series-list">'+s.series.map(x=>'<div><b>'+esc(x.name)+'</b><span>до '+new Date(x.end_at).toLocaleDateString('ru-RU')+'</span></div>').join('')+'</div>':'')+'</div>'}
function profileView(p=state.profile?.profile){if(!p)return '<div class="empty">Профиль не найден.</div>';return '<div class="page-body profile-page-clean"><div class="profile-hero"><div class="avatar">'+esc((p.firstName||'U')[0].toUpperCase())+'</div><b>'+esc(p.firstName||'Игрок')+'</b><span>'+(p.username?'@'+esc(p.username):'')+' · уровень '+p.level+' · #'+p.rank+'</span></div><div class="profile-metrics">'+metric('Капитал',fmt(p.balance+p.collectionValue))+metric('Баланс',fmt(p.balance))+metric('Коллекция',fmt(p.collectionValue))+metric('Usernames',p.collectionCount)+metric('Друзей',p.friendsCount||0)+metric('Сделок',p.marketDeals||0)+'</div><section class="showcase"><div class="section-title"><span>Витрина</span></div><div class="showcase-row">'+(p.showcase?.length?p.showcase.map(x=>'<div>'+x.handle+'</div>').join(''):'<div class="profile-showcase-empty">'+icon('collection')+'<b>Витрина пуста</b><span>Добавь username из коллекции</span></div>')+'</div></section></div>'}
function premiumView(){const p=state.premium;return '<div class="premium-page premium-page-clean"><div class="plus-hero"><h1>'+(p.active?'Подписка активна':'Больше возможностей')+'</h1><p>Подписка не повышает шанс дропа, награды колеса или апгрейдера.</p></div><div class="feature-list">'+p.features.map(x=>'<div>'+icon('check')+'<span>'+esc(x)+'</span></div>').join('')+'</div>'+(p.active?'<div class="plus-active">Активно до '+new Date(p.activeUntil).toLocaleDateString('ru-RU')+'</div>':'<button class="primary" data-premium '+(!p.starsEnabled?'disabled':'')+'>Подключить · '+p.stars+' Stars</button>')+'</div>'}
function detailView(x){return '<div class="detail-page">'+resultCard(x,false)+'<div class="detail-grid">'+metric('Экземпляр','#'+x.instanceNumber+' / '+x.maxSupply)+metric('Получен',new Date(x.obtainedAt).toLocaleDateString('ru-RU'))+metric('Длина',String((x.rawHandle||x.handle.slice(1)).length))+metric('Цена',fmt(x.value))+'</div><div class="detail-actions three"><button data-showcase="'+x.id+'">'+(x.inShowcase?'Убрать с витрины':'На витрину')+'</button><button class="primary" data-list-market="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">На рынок</button><button class="sell-system" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">Продать системе · '+fmt(x.value)+'</button></div></div>'}
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
  if(page==='upgrader'){state.upgrader=await api('/api/upgrader');state.upgrader.available=shuffleUpgradeItems(state.upgrader.available);state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeStage='source';state.upgradeTargetSessionId='';state.upgradeOutcome=null;state.upgradeSpinning=false;state.upgradeLastRound=null;state.upgradeLandingAngle=0;state.upgradeVisibleCount=Math.min(30,state.upgrader.available.length);state.upgradeScrollTop=0}
  if(page==='seasons')state.season=await api('/api/seasons');
  if(page==='profile')state.profile=await api('/api/profile');
  if(page==='premium')state.premium=await api('/api/premium');
  if(page==='admin'){if(!state.user?.isAdmin)throw new Error('forbidden');state.adminDetail=null;if(!window.USERNAME_ADMIN?.refresh)throw new Error('network');await window.USERNAME_ADMIN.refresh()}
  render();
 }catch(e){shell('USERNAME','<div class="error"><b>'+esc(ERR[e.message]||'Что-то пошло не так')+'</b><button data-page="'+page+'">Повторить</button></div>')}
}
function openMarketModal(id,handle,value){const fee=.05,root=document.createElement('div');root.className='modal-root';root.innerHTML='<div class="modal-back" data-modal-close></div><div class="modal"><div class="modal-head"><b>Выставить '+esc(handle)+'</b><button data-modal-close>'+icon('close')+'</button></div><label>Цена<input id="listingPrice" inputmode="numeric" value="'+Math.max(100,Math.round(value*1.15))+'"></label><div class="modal-calc" id="modalCalc"></div><button class="primary" data-create-listing="'+id+'">Выставить</button></div>';document.body.appendChild(root);hydrateIcons();const input=root.querySelector('#listingPrice'),calc=root.querySelector('#modalCalc');const update=()=>{const p=Math.max(0,Number(input.value)||0);calc.textContent='Комиссия 5% · получите '+fmt(p*(1-fee))};input.addEventListener('input',update);update()}
function openSystemSellModal(id,handle,value){
 const root=document.createElement('div');root.className='modal-root';
 root.innerHTML='<div class="modal-back" data-modal-close></div><div class="modal"><div class="modal-head"><b>Продать '+esc(handle)+'?</b><button data-modal-close>'+icon('close')+'</button></div><div class="system-sell-copy">Система сразу начислит <b>'+fmt(value)+'</b>. Username исчезнет из коллекции. Отменить продажу после подтверждения нельзя.</div><button class="primary" data-confirm-system-sell="'+id+'">Продать за '+fmt(value)+'</button></div>';
 document.body.appendChild(root);hydrateIcons();
}
function closeModal(el){el?.closest('.modal-root')?.remove()}
async function animateRotation(el,degrees,duration,easing){
 if(!el)return;
 const end='rotate('+Number(degrees||0)+'deg)';
 const reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 el.style.transition='none';el.style.transform='rotate(0deg)';void el.offsetWidth;
 if(reduced){el.style.transform=end;return}
 if(typeof el.animate==='function'){
  const animation=el.animate([{transform:'rotate(0deg)'},{transform:end}],{duration,easing,fill:'forwards'});
  try{await animation.finished}catch{}
  el.style.transform=end;animation.cancel();return
 }
 await new Promise(resolve=>{
  let settled=false;
  const finish=()=>{if(settled)return;settled=true;el.removeEventListener('transitionend',finish);el.style.transform=end;resolve()};
  el.addEventListener('transitionend',finish,{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   el.style.transition='transform '+duration+'ms '+easing;
   el.style.transform=end;
  }));
  setTimeout(finish,duration+160);
 });
}
async function spinWheelUi(){
 if(state.busy)return;state.busy=true;
 try{
  const req=crypto.randomUUID?.()||('w-'+Date.now()),r=await api('/api/wheel',{method:'POST',body:JSON.stringify({requestId:req})});
  const items=state.wheel.rewards||[],g=wheelGeometry(items),target=g.rows.find(x=>x.key===r.reward.key),disc=document.querySelector('#wheelDisc'),res=document.querySelector('#wheelResult');
  if(disc&&target){
   const margin=Math.min(2.2,Math.max(.35,target.span*.12)),room=Math.max(.25,target.span-margin*2),landing=target.start+margin+(rollRandomInt(10000)/10000)*room,final=8*360-landing;
   const stage=disc.closest('.fortune-stage');stage?.classList.add('spinning');
   await animateRotation(disc,final,3450,'cubic-bezier(.08,.74,.09,1)');
   stage?.classList.remove('spinning');
  }
  state.wheelLastResult=r.reward;if(res){res.textContent='Выпало: '+r.reward.label;res.classList.add('show')}haptic('medium');await refreshUser();state.wheel=await api('/api/wheel');render();
 }finally{state.busy=false}
}
let upgradePreviewSeq=0;
async function refreshUpgradePreview(){
 const ids=[...(state.upgradeSelectedIds||[])],seq=++upgradePreviewSeq;
 if(!ids.length){state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeStage='source';render();return}
 state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeStage='target';render();
 try{
  const p=await api('/api/upgrader/preview',{method:'POST',body:JSON.stringify({ids})});
  if(seq!==upgradePreviewSeq)return;
  state.upgradePreview=p;state.upgradeStage='target';render();
 }catch(e){
  if(seq===upgradePreviewSeq){state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeStage='source';toast(ERR[e.message]||'Не удалось подобрать цели');render()}
 }
}
async function animateUpgradeWheel(result){
 const source=result.sources?.[0]||selectedUpgradeItems()[0]||null;
 state.upgradeOutcome=result;state.upgradeSpinning=true;state.upgradeLastRound=null;state.upgradeLandingAngle=0;render();
 const rotor=document.querySelector('#upgradeRotor');if(!rotor){state.upgradeSpinning=false;render();return}
 const winArc=Math.max(3,Math.min(270,Number(result.chance||0)*360)),margin=Math.min(5,winArc/3),unit=rollRandomInt(10000)/10000;
 const landing=result.success?(margin+unit*Math.max(1,winArc-margin*2)):(winArc+margin+unit*Math.max(1,360-winArc-margin*2));
 const wheelDegrees=360*6-landing;
 rotor.closest('.upgrade-roulette-clean')?.classList.add('spinning');
 await animateRotation(rotor,wheelDegrees,3200,'cubic-bezier(.12,.72,.08,1)');
 rotor.closest('.upgrade-roulette-clean')?.classList.remove('spinning');
 haptic(result.success?'medium':'light');
 state.upgradeLandingAngle=landing;state.upgradeLastRound={source,target:result.target,chance:Number(result.chance||0),success:!!result.success};
 state.upgradeSpinning=false;state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeTargetSessionId='';
 state.upgrader=await api('/api/upgrader');state.upgrader.available=shuffleUpgradeItems(state.upgrader.available);state.upgradeVisibleCount=Math.min(Math.max(30,state.upgradeVisibleCount||30),state.upgrader.available.length);state.upgradeScrollTop=0;render();
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
 if(el.dataset.claim){
   const key=String(el.dataset.claim||'');if(!key||el.disabled)return;
   el.disabled=true;el.classList.add('is-claiming');
   const r=await api('/api/tasks/'+key+'/claim',{method:'POST'});
   const task=state.tasks?.items?.find(x=>String(x.key)===key);if(task)task.claimed=true;
   applyUserLocal(r.user);haptic('light');toast('+'+fmt(r.reward));render();return
 }
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
   const id=el.dataset.upItem;
   state.upgradeSelectedIds=[id];state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeOutcome=null;state.upgradeLastRound=null;state.upgradeLandingAngle=0;state.upgradeScrollTop=0;
   await refreshUpgradePreview();return
 }
 if(el.hasAttribute('data-upgrade-back-source')){
   state.upgradeStage='source';state.upgradeTargetSessionId='';state.upgradeOutcome=null;state.upgradeLastRound=null;state.upgradeLandingAngle=0;render();return
 }
 if(el.dataset.upTarget){
   const option=upgradeTargetOptions().find(x=>String(x.sessionId)===String(el.dataset.upTarget));
   if(!option)return;
   state.upgradeTargetSessionId=String(option.sessionId);haptic('light');render();return
 }
 if(el.hasAttribute('data-upgrade-continue')){
   state.upgradeOutcome=null;state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeStage='source';state.upgradeLastRound=null;state.upgradeLandingAngle=0;render();return
 }
 if(el.hasAttribute('data-upgrade')&&!state.upgradeSpinning){
   const ids=[...(state.upgradeSelectedIds||[])],target=selectedUpgradeTarget(),sessionId=target?.sessionId;
   if(!ids.length||!sessionId)return;
   state.upgradeStage='spin';state.upgradeSpinning=true;state.upgradeOutcome=null;state.upgradeLastRound=null;state.upgradeLandingAngle=0;el.disabled=true;render();
   try{
    const r=await api('/api/upgrader',{method:'POST',body:JSON.stringify({ids,sessionId})});
    await animateUpgradeWheel(r);
   }catch(err){
    state.upgradeStage='target';state.upgradeSpinning=false;render();throw err
   }
   return
 }
 if(el.hasAttribute('data-premium')){const r=await api('/api/premium/invoice',{method:'POST'});if(!TG?.openInvoice)throw new Error('premium_unavailable');TG.openInvoice(r.invoice,async status=>{if(status==='paid'){toast('USERNAME+ активирован');await load('premium')}});return}
 if(el.hasAttribute('data-back')){await load(state.backPage||'collection');return}
}catch(err){state.busy=false;toast(ERR[err.message]||'Что-то пошло не так');el.disabled=false}});
let marketSearchTimer;
document.addEventListener('input',e=>{if(e.target.id==='marketQuery'){clearTimeout(marketSearchTimer);const q=e.target.value||'';marketSearchTimer=setTimeout(async()=>{state.marketFilters.q=q;state.marketFilters.page=1;try{state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page=1');render();requestAnimationFrame(()=>{const input=document.querySelector('#marketQuery');if(input){input.focus();input.setSelectionRange(q.length,q.length)}})}catch{}},320)}});
document.addEventListener('scroll',e=>{
 const list=e.target;if(!list?.classList?.contains('upgrade-list'))return;
 state.upgradeScrollTop=list.scrollTop;
 const remaining=list.scrollHeight-list.scrollTop-list.clientHeight;
 if(remaining<310)appendUpgradeBatch();
},true);
window.USERNAME_APP={state,api,render,icon,esc,fmt,metric,refreshUser,toast,ERR};
import('/admin-ui.js?v=5.4.2').catch(()=>{});
load('home');
