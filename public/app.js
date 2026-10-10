let TG=window.Telegram?.WebApp;
const root=document.documentElement,app=document.querySelector('#app'),toastEl=document.querySelector('#toast');
const state={
  page:'home',user:null,home:null,collection:null,market:null,leaderboard:null,tasks:null,wheel:null,friends:null,gift:null,upgrader:null,season:null,profile:null,shop:null,promo:null,levels:null,achievements:null,notifications:null,games:null,gameSession:null,gameKey:'',daily:null,detail:null,admin:null,adminDetail:null,
  menu:false,busy:false,backPage:'collection',dropTier:'basic',dropPicker:false,collectionFilterOpen:false,marketFilterOpen:false,upgradeOutcome:null,
  filters:{sort:'new',digits:'all',page:1},marketFilters:{sort:'new',digits:'all',q:'',page:1},
  rankPage:1,upgradeSelectedIds:[],upgradePreview:null,upgradeStage:'source',upgradeTargetSessionId:'',upgradeSpinning:false,upgradeVisibleCount:30,upgradeScrollTop:0,upgradeLastRound:null,upgradeLandingAngle:0,wheelLastResult:null,giftSelectedItem:'',giftSelectedFriend:'',giftRecipientUsername:'',giftSheet:'',gameFeedback:null,gameBuildValue:'',adminPage:1,adminQuery:'',adminResetStage:0,
  pageLoadedAt:{}
};
const fmt=n=>new Intl.NumberFormat(currentLanguage()==='en'?'en-US':'ru-RU').format(Math.round(Number(n)||0))+' ₽';
function untilText(iso){
 const ms=Math.max(0,new Date(iso).getTime()-Date.now()),mins=Math.max(1,Math.ceil(ms/60000)),en=currentLanguage()==='en';
 const h=Math.floor(mins/60),m=mins%60;
 if(h>=24){const d=Math.floor(h/24),rh=h%24;return d+(en?' d':' дн.')+(rh?' '+rh+(en?' h':' ч'):'')}
 if(h)return h+(en?' h':' ч')+(m?' '+m+(en?' min':' мин'):'');
 return m+(en?' min':' мин');
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ERR={
  unauthorized:'Откройте игру через Telegram',blocked:'Аккаунт заблокирован',insufficient_funds:'Недостаточно денег',pending_drop:'Сначала решите, что делать с текущим username',
  collection_full:'Коллекция заполнена',recipient_full:'У получателя заполнена коллекция',sold_out:'Тираж закончился',too_fast:'Слишком быстро. Попробуйте ещё раз',
  listing_not_found:'Лот уже недоступен',own_listing:'Нельзя купить свой лот',already_listed:'Юзернейм уже на рынке',not_friend:'Пользователь не в списке друзей',
  lab_invalid_username:'Username должен быть длиной 4–15 символов: a-z, 0-9, _',lab_cooldown:'Подожди пару секунд перед следующей оценкой',lab_duplicate:'Ты уже оценивал этот username',lab_too_similar:'Слишком похож на уже оценённый сегодня username',daily_already_claimed:'Ежедневная награда уже получена',game_unavailable:'Сейчас не удалось собрать вопрос',game_cooldown:'Слишком много игр подряд',game_session_not_found:'Игра уже недоступна',game_session_expired:'Раунд устарел',game_finished:'Раунд закончен',game_bad_edit:'Измени username только одним допустимым действием',game_bad_build:'Собери username только из выданных частей',insufficient_gems:'Недостаточно 💎',
  wheel_cooldown:'Колесо уже использовано сегодня',upgrade_invalid_items:'Выбранный username недоступен',upgrade_bad_recipe:'Этот username нельзя улучшить',
  upgrade_session_expired:'Предпросмотр устарел. Выберите usernames заново',upgrade_session_mismatch:'Состав апгрейда изменился',upgrade_unavailable:'Сейчас не удалось подобрать цели. Попробуйте ещё раз',premium_unavailable:'Telegram Stars пока недоступны',recipient_blocked:'Получатель заблокирован',user_not_found:'Пользователь не найден. Он должен сначала открыть игру',rate_limited:'Слишком много действий. Попробуйте через минуту',story_unsupported:'Обновите Telegram — истории из Mini App поддерживаются в новых версиях',story_https_required:'Не удалось подготовить HTTPS-картинку истории',forbidden:'Нет доступа',bad_username:'Некорректный username',username_exists:'Такой username уже существует',reset_confirmation_required:'Введите RESET USERNAME',gift_self:'Нельзя передать username самому себе',game_stale_answer:'Этот ответ уже был обработан',self_admin_block:'Нельзя заблокировать самого себя',promo_not_found:'Промокод не найден',promo_expired:'Срок промокода истёк',promo_limit:'Лимит активаций промокода закончился',promo_used:'Ты уже активировал этот промокод',promo_exists:'Такой промокод уже существует',bad_promo_code:'Проверь написание промокода',bad_promo_reward:'Некорректная награда промокода',channel_task_unavailable:'Проверка подписки сейчас недоступна',channel_subscription_required:'Сначала подпишись на Telegram-канал',network:'Нет соединения с сервером'
};
let viewportFrame=0,lastViewportKey='';
function syncViewportNow(){
 const vv=window.visualViewport,h=Math.round(TG?.viewportStableHeight||TG?.viewportHeight||vv?.height||innerHeight||0),w=Math.round(vv?.width||innerWidth||0),s=TG?.safeAreaInset||{},safe=TG?.contentSafeAreaInset||{};
 const top=Math.max(s.top||0,safe.top||0),bottom=Math.max(s.bottom||0,safe.bottom||0),platform=String(TG?.platform||'browser').toLowerCase(),fine=!!matchMedia?.('(pointer:fine)')?.matches;
 const desktop=['tdesktop','macos','web','weba','webk','browser'].includes(platform)&&fine,key=[h,w,top,bottom,platform,desktop?1:0].join(':');
 if(key===lastViewportKey)return;lastViewportKey=key;
 if(h)root.style.setProperty('--app-h',h+'px');if(w)root.style.setProperty('--app-w',w+'px');
 root.style.setProperty('--safe-t',top+'px');root.style.setProperty('--safe-b',bottom+'px');
 root.dataset.platform=platform;root.classList.toggle('is-desktop',desktop);root.classList.toggle('is-mobile',!desktop);
}
function syncViewport(){
 if(viewportFrame)return;
 viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;syncViewportNow()});
}
try{TG?.ready();TG?.expand();TG?.setHeaderColor?.('#F4F5F7');TG?.setBackgroundColor?.('#F4F5F7');syncViewportNow();TG?.onEvent?.('viewportChanged',syncViewport);TG?.onEvent?.('safeAreaChanged',syncViewport);TG?.onEvent?.('contentSafeAreaChanged',syncViewport)}catch{syncViewportNow()}
addEventListener('resize',syncViewport,{passive:true});
const SETTINGS_KEY='username.settings.v2';
const DEFAULT_SETTINGS=Object.freeze({theme:'system',language:'ru',vibration:true,sound:true,animations:true});
const EN_TEXT=Object.freeze({
 'Играть':'Play','Дроп':'Drop','Игры':'Games','Колесо':'Wheel','Апгрейдер':'Upgrader','Торговля':'Trading','Рынок':'Market',
 'Коллекция':'Collection','Подарки':'Transfers','Прогресс':'Progress','Задания':'Tasks','Уровни':'Levels','Достижения':'Achievements',
 'Топ':'Top','Аккаунт':'Account','Профиль':'Profile','Магазин':'Shop','Настройки':'Settings','Админ':'Admin','Админка':'Admin',
 'Фильтр':'Filter','Фильтр коллекции':'Collection filter','Фильтр рынка':'Market filter','Стоимость':'Value','Цена':'Price','Дата':'Date',
 'Длина':'Length','Тип':'Type','Сначала дорогие':'Highest first','Сначала дешёвые':'Lowest first','Сначала новые':'Newest first',
 'Сначала старые':'Oldest first','Короткие':'Shortest','Длинные':'Longest','Все':'All','Без цифр':'No digits','С цифрами':'With digits',
 'Общая стоимость':'Total value','Продать':'Sell','На рынок':'List on market','Оценка':'Score','В коллекции':'In collection',
 'Получено':'Claimed','Забрать':'Claim','В процессе':'In progress','Ближайшие награды':'Upcoming rewards','Все награды получены.':'All rewards claimed.',
 'Тема':'Theme','Светлая':'Light','Тёмная':'Dark','Системная':'System','Язык':'Language','Русский':'Russian','Вибрация':'Haptics','Звук':'Sound','Анимации':'Animations',
 'ЛУЧШИЙ ЮЗЕРНЕЙМ':'BEST USERNAME','ДОСТИЖЕНИЯ':'ACHIEVEMENTS','СТАТИСТИКА':'STATS','УДАЧА И НЕВЕЗЕНИЕ':'LUCK & BAD LUCK',
 'Юзернеймы':'Usernames','юзернеймов':'usernames','Сделки':'Deals','Друзья':'Friends','Удача':'Luck','Защита от невезения':'Bad-luck protection','Серия неудач':'Bad streak',
 'Нейтрально':'Neutral','Везёт':'Lucky','Очень везёт':'Very lucky','Невероятно везёт':'Legendary luck','Не везёт':'Unlucky','Жёстко не везёт':'Cursed',
 'Профиль не найден.':'Profile not found.','Пока нет':'None yet','Награда':'Reward','Лучший username':'Best username',
 'Выберите юзернейм':'Choose username','Получатель':'Recipient','Введите @username':'Enter @username','Передать':'Transfer','Комиссия 5%':'5% fee',
 'Комиссия':'Fee','Сумма':'Total','Твои юзернеймы':'Your usernames','Выбрать цель':'Choose target','Подбираем варианты…':'Finding targets…',
 'Шанс':'Chance','ШАНС':'CHANCE','Не выпало':'Missed','Продолжить':'Continue','Бесплатное вращение':'Free spin',
 'Уже использовано':'Already used','Одно вращение раз в 24 часа':'One spin every 24 hours','Крутить':'Spin','Недоступно':'Unavailable',
 'КОЛЕСО УДАЧИ':'LUCKY WHEEL','РАЗ В 24 ЧАСА':'EVERY 24 HOURS','24Ч':'24H','КРУТИ':'SPIN','Шансы':'Odds','Выпало':'Result',
 'Сегодня':'Today','Лучший':'Best','Какой дороже?':'Which is worth more?','Выше':'Higher','Ниже':'Lower','Проверить':'Check',
 'Сбросить':'Reset','Готово':'Done','К играм':'Back to games','Игра не запущена.':'Game not started.',
 'Кристаллы':'Crystals','Темы':'Themes','Купить':'Buy','Выбрано':'Selected','Применить':'Apply',
 'Пользователь':'Player','Игрок':'Player','Без username':'No username','Без юзернеймов':'No usernames',
 'Место':'Rank','Осталось':'Time left','Награды':'Rewards','Активные серии':'Active events','ТЕКУЩИЙ СЕЗОН':'CURRENT SEASON',
 'Приглашено':'Invited','До следующей':'Until next','ТВОЯ ССЫЛКА':'YOUR LINK','Скопировать':'Copy','Отправить другу':'Share',
 'Очки сезона':'Season Score','Новичок':'Beginner','Свой':'Regular','В теме':'In the know','Бывалый':'Experienced','Продвинутый':'Advanced','Мастер':'Master',
 'Профи':'Pro','Эксперт':'Expert','Топовый':'Top tier','Имба':'Overpowered','Ветеран':'Veteran','Авторитет':'Authority','Элита':'Elite',
 'Титан':'Titan','Босс':'Boss','Легенда':'Legend','Икона':'Icon','Чемпион':'Champion','Грандмастер':'Grandmaster','Абсолют':'Absolute','Легендарный':'Legendary',
 'Первый улов':'First catch','Полка':'Shelf','Коллекционер':'Collector','Чистая десятка':'Clean ten','Фиолетовый':'Purple',
 'Золотой билет':'Golden ticket','Золотой запас':'Golden reserve','Первая сделка':'First deal','На рынке':'On the market','Продавец':'Seller',
 'Щедрый':'Generous','Разминка':'Warm-up','Серия':'Streak','Миллион':'Million','Игрок':'Player',
 'Открыть дроп':'Open a drop','Открыть 2 дропа':'Open 2 drops','Открыть 3 дропа':'Open 3 drops','Открыть 5 дропов':'Open 5 drops',
 'Продать юзернейм':'Sell a username','Продать 2 юзернейма':'Sell 2 usernames','Продать 3 юзернейма':'Sell 3 usernames',
 'Оставить юзернейм':'Keep a username','Оставить 2 юзернейма':'Keep 2 usernames','Сыграть 1 мини-игру':'Play 1 mini-game',
 'Сыграть 3 мини-игры':'Play 3 mini-games','Сыграть 5 мини-игр':'Play 5 mini-games','Сыграть 7 мини-игр':'Play 7 mini-games','Сыграть 10 мини-игр':'Play 10 mini-games',
 'Выиграть Охоту за юзернеймом':'Win Username Hunt','Выиграть Охоту за юзернеймом дважды':'Win Username Hunt twice','Сыграть в Охоту за юзернеймом':'Play Username Hunt',
 'Сыграть в Выше / ниже':'Play Higher / Lower','Сыграть в Редактор':'Play Editor','Сыграть в Собери юзернейм':'Play Build username','Сыграть в Угадай цену':'Play Guess the price',
 'Купить юзернейм':'Buy a username','Купить 2 юзернейма':'Buy 2 usernames','Получить юзернейм от 15K ₽':'Get a username worth 15K ₽+',
 'Получить 2 юзернейма от 15K ₽':'Get 2 usernames worth 15K ₽+','Получить юзернейм без цифр':'Get a username without digits',
 'Получить 2 юзернейма без цифр':'Get 2 usernames without digits','Открыть колесо':'Spin the wheel','Сделать апгрейд':'Do an upgrade','Сделать 2 апгрейда':'Do 2 upgrades',
 'Передать юзернейм':'Transfer a username','Посмотреть профиль игрока':'View a player profile','Пригласить друга':'Invite a friend','Пригласить 2 друзей':'Invite 2 friends',
 'Купить 3 юзернейма на рынке':'Buy 3 usernames on the market'
});
const EN_TEXT_EXTRA=Object.freeze({
 'Закрыть':'Close','Стоимость попытки':'Attempt price','Выберите цену дропа':'Choose drop price','Получить username':'Get username',
 'Нажми, чтобы получить':'Tap to get one','Улучшить username':'Upgrade username','Быстрое вращение':'Quick spin',
 'По этому фильтру ничего нет.':'Nothing matches this filter.','Назад':'Back','Дальше':'Next','Поиск...':'Search...','Ничего не найдено.':'Nothing found.',
 'ОБЩИЙ КАПИТАЛ':'TOTAL CAPITAL','Кто богаче':'Who is richer','Баланс + стоимость всех активных юзернеймов':'Balance + value of all active usernames',
 'Снять':'Remove','Нет юзернеймов для апгрейда.':'No usernames available for upgrade.','Нет usernames для апгрейда':'No usernames available for upgrade',
 'Получено ':'Received ','Активного сезона нет.':'No active season.','Значок профиля':'Profile badge','Тема сезона':'Season theme','Эксклюзивная рамка':'Exclusive profile frame',
 'Приглашай друзей и собирай коллекцию вместе.':'Invite friends and build your collection together.','Ссылка загружается…':'Loading link…',
 'Пригласи первого друга.':'Invite your first friend.','Наград':'Rewards','До следующей':'Until next',
 'Нет соединения с сервером':'No connection to server','Откройте игру через Telegram':'Open the game through Telegram','Аккаунт заблокирован':'Account blocked',
 'Недостаточно денег':'Not enough money','Сначала решите, что делать с текущим username':'Resolve your current username first',
 'Коллекция заполнена':'Collection is full','У получателя заполнена коллекция':'Recipient collection is full','Тираж закончился':'Sold out',
 'Слишком быстро. Попробуйте ещё раз':'Too fast. Try again','Лот уже недоступен':'Listing is no longer available','Нельзя купить свой лот':'You cannot buy your own listing',
 'Юзернейм уже на рынке':'Username is already listed','Username должен быть длиной 4–15 символов: a-z, 0-9, _':'Username must be 4–15 characters: a-z, 0-9, _',
 'Подожди пару секунд перед следующей оценкой':'Wait a couple of seconds before the next rating','Ты уже оценивал этот username':'You already rated this username',
 'Слишком похож на уже оценённый сегодня username':'Too similar to a username already rated today','Ежедневная награда уже получена':'Daily reward already claimed',
 'Сейчас не удалось собрать вопрос':'Could not create a question right now','Слишком много игр подряд':'Too many games in a row',
 'Игра уже недоступна':'Game is no longer available','Раунд устарел':'Round expired','Раунд закончен':'Round finished',
 'Измени username только одним допустимым действием':'Change the username using one allowed action','Собери username только из выданных частей':'Build the username using all provided parts',
 'Недостаточно 💎':'Not enough 💎','Колесо уже использовано сегодня':'Wheel already used today','Выбранный username недоступен':'Selected username is unavailable',
 'Этот username нельзя улучшить':'This username cannot be upgraded','Предпросмотр устарел. Выберите usernames заново':'Preview expired. Select usernames again',
 'Состав апгрейда изменился':'Upgrade selection changed','Сейчас не удалось подобрать цели. Попробуйте ещё раз':'Could not find upgrade targets. Try again',
 'Telegram Stars пока недоступны':'Telegram Stars are unavailable','Получатель заблокирован':'Recipient is blocked','Пользователь не найден. Он должен сначала открыть игру':'Player not found. They must open the game first','Слишком много действий. Попробуйте через минуту':'Too many actions. Try again in a minute',
 'Нет доступа':'Access denied','Некорректный username':'Invalid username','Такой username уже существует':'This username already exists',
 'Нельзя передать username самому себе':'You cannot transfer a username to yourself','Этот ответ уже был обработан':'This answer was already processed',
 'Нельзя заблокировать самого себя':'You cannot block yourself','Что-то пошло не так':'Something went wrong','Не удалось загрузить раздел':'Failed to load section',
 'Океан':'Ocean','Голубой акцент':'Blue accent','Фиолетовая':'Violet','Фиолетовый акцент':'Violet accent','Лайм':'Lime','Зелёный акцент':'Green accent',
 'Закат':'Sunset','Тёплый оранжевый акцент':'Warm orange accent','Моно':'Mono','Чёрно-белый акцент':'Black-and-white accent',
 'Охота за юзернеймом':'Username Hunt','Выше / ниже':'Higher / Lower','Редактор':'Editor','Собери юзернейм':'Build username','Угадай цену':'Guess the price',
 'Коллекция':'Collection','Редкости':'Rarities','Торговля':'Trading','Прогресс':'Progress','Игры':'Games',
 'Читаемость':'Readability','Краткость':'Brevity','Чистота':'Cleanliness','Спрос':'Demand','Система сразу начислит':'The system will instantly credit',
 '💎 — только оформление. На дроп, колесо и апгрейд они не влияют.':'💎 — cosmetics only. They do not affect drops, wheel or upgrades.',
 'УР.':'LVL','МАКС':'MAX','опыта':'XP','звёзд':'Stars','ПРОТИВ':'VS','дропов':'drops','ДРОП':'DROP','Юзернейм':'Username'
});
function currentLanguage(){return state.settings?.language==='en'?'en':'ru'}
function tx(ru,en){return currentLanguage()==='en'?en:ru}
function translateLiteral(value){
 if(currentLanguage()!=='en')return String(value??'');
 let s=String(value??''),direct=EN_TEXT[s]||EN_TEXT_EXTRA[s];if(direct)return direct;
 const patterns=[
  [/^До следующего: (.+) XP$/,'To next level: $1 XP'],
  [/^Общая стоимость · (.+)$/,'Total value · $1'],
  [/^Следующее вращение через (.+)$/,'Next spin in $1'],
  [/^Выпало: (.+)$/,'Result: $1'],
  [/^Продать · (.+)$/,'Sell · $1'],
  [/^Оценка (.+)$/,'Score $1'],
  [/^ур\. (\d+)$/,'lvl $1'],
  [/^до (.+)$/,'until $1'],
  [/^Комиссия 5% · получите (.+)$/,'5% fee · you receive $1'],
  [/^УР\. (\d+)$/,'LVL $1'],
  [/^(\d+) \/ (\d+) опыта$/,'$1 / $2 XP'],
  [/^(\d+) дропов$/,'$1 drops'],
  [/^(\d+) юзернеймов$/,'$1 usernames']
 ];
 for(const [re,to] of patterns)if(re.test(s))return s.replace(re,to);
 return s;
}
function localizeDom(scope){
 if(currentLanguage()!=='en'||!scope)return;
 const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const raw=node.nodeValue,trim=raw.trim();if(!trim)continue;
  const next=translateLiteral(trim);if(next!==trim)node.nodeValue=raw.replace(trim,next);
 }
 scope.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach(el=>{
  for(const attr of ['placeholder','aria-label','title'])if(el.hasAttribute(attr)){const v=el.getAttribute(attr),n=translateLiteral(v);if(n!==v)el.setAttribute(attr,n)}
 });
}
function readSettings(){
 try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {...DEFAULT_SETTINGS}}
}
state.settings=readSettings();
function effectiveTheme(){
 if(state.settings.theme==='system')return matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light';
 return state.settings.theme==='dark'?'dark':'light';
}
function applyPreferences(){
 const theme=effectiveTheme();root.dataset.theme=theme;root.style.colorScheme=theme;root.lang=currentLanguage();
 root.classList.toggle('no-animations',!state.settings.animations);
 const accent=state.user?.cosmetics?.theme||'';
 root.dataset.accentTheme=accent;
 root.dataset.profileFrame=state.user?.cosmetics?.frame||'';
 root.dataset.cardStyle=state.user?.cosmetics?.card||'';
 const themeColor=theme==='dark'?'#111316':'#F4F5F7',meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',themeColor);
 try{TG?.setHeaderColor?.(themeColor);TG?.setBackgroundColor?.(themeColor);TG?.setBottomBarColor?.(themeColor)}catch{}
}
function saveSettings(patch){
 state.settings={...state.settings,...patch};localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings));applyPreferences();
}
try{matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change',()=>{if(state.settings.theme==='system'){applyPreferences();render()}})}catch{}
function haptic(type='light'){if(!state.settings.vibration)return;try{TG?.HapticFeedback?.impactOccurred(type)}catch{}}
let audioCtx;
function tone(hz,{delay=0,duration=.08,volume=.026,type='sine'}={}){
 if(!state.settings.sound)return;
 try{
  audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume?.();
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),at=audioCtx.currentTime+Math.max(0,delay);
  o.type=type;o.frequency.setValueAtTime(Math.max(40,Number(hz)||360),at);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  o.connect(g);g.connect(audioCtx.destination);o.start(at);o.stop(at+duration+.02);
 }catch{}
}
function sound(kind='tap'){
 if(!state.settings.sound)return;
 const map={
  tap:[[420,{duration:.045,volume:.018,type:'triangle'}]],
  select:[[520,{duration:.055,volume:.02,type:'triangle'}],[660,{delay:.035,duration:.055,volume:.014,type:'triangle'}]],
  tick:[[780,{duration:.028,volume:.012,type:'square'}]],
  spin:[[220,{duration:.09,volume:.018,type:'triangle'}],[330,{delay:.07,duration:.1,volume:.016,type:'triangle'}],[440,{delay:.15,duration:.11,volume:.014,type:'triangle'}]],
  reveal:[[360,{duration:.07,volume:.02,type:'triangle'}],[520,{delay:.055,duration:.09,volume:.022,type:'triangle'}]],
  story:[[560,{duration:.06,volume:.018,type:'triangle'}],[760,{delay:.05,duration:.09,volume:.019,type:'triangle'}]],
  reward:[[523,{duration:.11,volume:.024,type:'sine'}],[659,{delay:.055,duration:.13,volume:.022,type:'sine'}],[784,{delay:.11,duration:.16,volume:.02,type:'sine'}]],
  fail:[[190,{duration:.12,volume:.022,type:'sawtooth'}],[140,{delay:.08,duration:.16,volume:.018,type:'sawtooth'}]]
 };
 for(const [hz,opts] of (map[kind]||map.tap))tone(hz,opts);
}
function motionEnabled(){return !!state.settings.animations}
function toast(t){toastEl.textContent=translateLiteral(t);toastEl.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>toastEl.classList.remove('show'),1900)}
async function initData(){let d=TG?.initData||'',end=Date.now()+1600;while(!d&&Date.now()<end){await new Promise(r=>setTimeout(r,50));TG=window.Telegram?.WebApp||TG;d=TG?.initData||''}return d}
function startParam(){
 const q=new URLSearchParams(location.search);
 return String(TG?.initDataUnsafe?.start_param||q.get('tgWebAppStartParam')||q.get('startapp')||q.get('ref')||'');
}
const inflightGet=new Map();
async function api(url,opts={}){
 const method=String(opts.method||'GET').toUpperCase(),key=method==='GET'?url:'';
 if(key&&inflightGet.has(key))return inflightGet.get(key);
 const run=(async()=>{
  const headers={'Content-Type':'application/json',...(opts.headers||{})},d=await initData();
  if(d)headers['X-Telegram-Init-Data']=d;else if(location.hostname==='localhost'||location.hostname==='127.0.0.1')headers['X-Dev-User']=localStorage.devUser||'10001';
  const sp=startParam();if(sp)headers['X-Start-Param']=sp;
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),9000);
  try{
   const r=await fetch(url,{...opts,headers,cache:'no-store',signal:ctl.signal}),j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'network');return j
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('network');throw e}
  finally{clearTimeout(tm)}
 })();
 if(key)inflightGet.set(key,run);
 try{return await run}finally{if(key&&inflightGet.get(key)===run)inflightGet.delete(key)}
}
const ICON_PATH=Object.freeze({
 home:'<path d="M5 8.5 12 4l7 4.5v8L12 20l-7-3.5z"/><path d="m5 8.5 7 4 7-4M12 12.5V20"/>',
 menu:'<path d="M5 7h14M5 12h14M5 17h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="m15 5-7 7 7 7"/>',chevron:'<path d="m9 5 7 7-7 7"/>',down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 market:'<path d="M4 10h16v10H4zM3 10l2-6h14l2 6"/><path d="M8 14h3v6M3 10c1 2 3 2 4 0 1 2 3 2 5 0 1 2 3 2 5 0 1 2 3 2 4 0"/>',
 rank:'<path d="M5 20v-6h4v6M10 20V9h4v11M15 20V4h4v16"/>',tasks:'<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
 wheel:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M19 12h-5M12 20v-6M5 12h5"/>',
 friends:'<path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-2a5.5 5.5 0 0 1 11 0v2M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
 gift:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11M12 9H8.5A2.5 2.5 0 1 1 11 6.5zM12 9h3.5A2.5 2.5 0 1 0 13 6.5z"/>',
 upgrade:'<path d="m7 14 5-5 5 5M7 9l5-5 5 5M12 9v11"/>',season:'<circle cx="12" cy="9" r="5"/><path d="m9 13-2 7 5-3 5 3-2-7"/>',
 collection:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h8"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
 shop:'<path d="M6 8h12l-1 12H7zM9 9V7a3 3 0 0 1 6 0v2"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
 games:'<path d="M8 9h8a5 5 0 0 1 4.8 6.4l-.6 2A2.2 2.2 0 0 1 16.5 19L14 17h-4l-2.5 2a2.2 2.2 0 0 1-3.7-1.6l-.6-2A5 5 0 0 1 8 9Z"/><path d="M8 12v4M6 14h4M16 13h.01M18 15h.01"/>',
 levels:'<circle cx="12" cy="9" r="5"/><path d="m9 13-2 7 5-3 5 3-2-7"/>',achievements:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M9 17h6"/>',
 notifications:'<path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5zM10 20h4"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',theme:'<path d="M19 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 19 15.5Z"/>',sound:'<path d="M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',motion:'<path d="m9 7 8 5-8 5z"/>',
 admin:'<path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',story:'<path d="M4 12v7h16v-7M12 15V4M8 8l4-4 4 4"/>',promo:'<path d="M4 8a2 2 0 0 0 0 4v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a2 2 0 0 0 0-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M9 8h.01M15 14h.01M9 15l6-7"/>',
 edit:'<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3"/>',puzzle:'<path d="M4 4h6v3a2 2 0 1 0 4 0V4h6v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4z"/>',
 fire:'<path d="M12 21c-4 0-7-2.6-7-6.5 0-3 1.7-5.2 4.5-7.5 0 2 1 3.2 2 4 1-3 2.7-5.2 4.5-7 0 3 3 5 3 9.5C19 18 16 21 12 21Z"/>',money:'<path d="M4 7h16v11H4zM7 10h.01M17 15h.01"/><circle cx="12" cy="12.5" r="2.5"/>',diamond:'<path d="m12 20-9-10 4-6h10l4 6zM3 10h18M8 4l4 16 4-16"/>',crown:'<path d="m4 7 4 4 4-7 4 7 4-4-2 11H6z"/>'
});
const RAW_ICON_KEY=Object.freeze({'sun-03':'sun','moon-02':'theme','settings-01':'settings','medal-01':'achievements','package':'home','layers-01':'collection','sparkles':'achievements','diamond-02':'diamond','award-01':'season','store-01':'market','chart-up':'rank','gift':'gift','game':'games','fire':'fire','money-bag-02':'money','crown':'crown','search-visual':'search','edit-02':'edit','puzzle':'puzzle','gamepad':'games'});
function icon(k){const body=ICON_PATH[k]||ICON_PATH.menu;return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>'}
function marketFilterIcon(){return icon('filter')}
function FilterButton(scope){
 const attr=scope==='collection'?'data-collection-filter-open':'data-market-filter-open';
 return '<button class="filter-button-v7" '+attr+' aria-label="Фильтр"><span class="filter-button-icon">'+marketFilterIcon()+'</span><span class="filter-button-label">Фильтр</span></button>';
}
function hydrateIcons(){}
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function valueClass(x){return ' value-'+(['blue','purple','gold'].includes(String(x?.visual||''))?x.visual:'normal')}
function xpBar(u){
 const pct=Math.max(0,Math.min(100,Math.round(Number(u?.levelProgress||0)*100)));
 return '<div class="xp-block"><div class="xp-head"><b>УР. '+Number(u?.level||1)+' · '+esc(u?.title||'Новичок')+'</b><span>'+(Number(u?.level||1)>=200?'МАКС':(Number(u?.levelXp||0)+' / '+Number(u?.nextLevelXp||0)+' опыта'))+'</span></div><div class="xp-track"><i style="width:'+pct+'%"></i></div></div>';
}
function balance(){return fmt(state.user?.balance||state.home?.user?.balance||0)}
const MENU_SECTIONS=[
 {title:'Играть',items:[['home','home','Дроп'],['games','games','Игры'],['wheel','wheel','Колесо'],['upgrader','upgrade','Апгрейдер']]},
 {title:'Торговля',items:[['market','market','Рынок'],['collection','collection','Коллекция'],['gift','gift','Подарки']]},
 {title:'Прогресс',items:[['tasks','tasks','Задания'],['levels','levels','Уровни'],['achievements','achievements','Достижения'],['top','rank','Топ']]},
 {title:'Аккаунт',items:[['profile','profile','Профиль'],['notifications','notifications','Уведомления'],['promo','promo','Промокод'],['shop','shop','Магазин'],['settings','settings','Настройки']]}
];
function setMenuOpen(open){
 state.menu=!!open;
 const menu=document.querySelector('.menu-backdrop');
 if(menu){menu.classList.toggle('open',state.menu);menu.setAttribute('aria-hidden',state.menu?'false':'true');return}
 render();
}
function menuHtml(){
 const tiles=list=>list.map(([p,i,t])=>'<button class="menu-section-tile" data-page="'+p+'" aria-label="'+esc(t)+'"><span class="menu-tile-icon">'+icon(i)+'</span><span class="menu-tile-label">'+esc(t)+'</span></button>').join('');
 const groups=MENU_SECTIONS.map(s=>'<section class="menu-section"><b>'+esc(s.title)+'</b><div>'+tiles(s.items)+'</div></section>').join('');
 return '<div class="menu-backdrop '+(state.menu?'open':'')+'" data-menu-close><aside class="menu-sheet menu-sections-sheet" data-menu-sheet>'+
  '<div class="menu-grid-top">'+(state.user?.isAdmin?'<button class="menu-admin-shortcut" data-page="admin">'+icon('admin')+'<span>Админ</span></button>':'<span></span>')+'<button class="menu-head-icon" data-menu-close aria-label="Закрыть">'+icon('close')+'</button></div>'+
  '<div class="menu-sections-scroll">'+groups+'</div>'+
 '</aside></div>'
}
function topbar(title,{back=false}={}){const unread=Number(state.user?.unreadNotifications||0);return '<header class="topbar">'+(back?'<button class="top-back" data-back>'+icon('back')+'</button>':'')+'<div class="top-title"><b>'+esc(title)+'</b></div><div class="top-actions"><span>'+balance()+'</span><button class="notification-top" data-page="notifications" aria-label="Уведомления">'+icon('notifications')+(unread?'<i>'+Math.min(unread,99)+(unread>99?'+':'')+'</i>':'')+'</button><button data-menu-open>'+icon('menu')+'</button></div></header>'}
function shell(title,html,opts={}){
 window.__USERNAME_READY=true;applyPreferences();
 app.innerHTML='<div class="shell"><section class="screen">'+topbar(title,opts)+html+'</section>'+menuHtml()+'</div>';localizeDom(app);
 requestAnimationFrame(()=>{fitAllUsernames();hydrateIcons();if(state.page==='upgrader'){const list=document.querySelector('.upgrade-list');if(list)list.scrollTop=state.upgradeScrollTop||0}});
}
function fitUsername(el,max=48,min=20){
 if(!el)return;const room=Math.max(1,(el.parentElement?.clientWidth||el.clientWidth)-8),hiMax=Math.max(min,Number(max)||48);
 el.style.fontSize=hiMax+'px';if(el.scrollWidth<=room)return;
 let lo=Math.max(8,Number(min)||20),hi=hiMax;
 for(let i=0;i<6&&hi-lo>.5;i++){const mid=(lo+hi)/2;el.style.fontSize=mid+'px';if(el.scrollWidth<=room)lo=mid;else hi=mid}
 el.style.fontSize=Math.floor(lo*10)/10+'px';
}
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
 return '<article class="drop-result-card minimal-result'+(pending?' pending-result':'')+valueClass(x)+'">'+
   '<div class="drop-result-main minimal"><h1 data-fit-username data-max-size="48" data-min-size="24">'+esc(x.handle)+'</h1></div>'+
   (pending?'<div class="drop-result-actions">'+
     '<div class="drop-result-resolve"><button data-resolve="keep" data-id="'+x.id+'">Оставить</button><button class="secondary" data-resolve="sell" data-id="'+x.id+'">Продать · '+fmt(x.value)+'</button></div>'+
     '<button class="story-action" data-share-story="'+x.id+'" aria-label="В историю" title="В историю">'+icon('story')+'</button>'+
   '</div>':'')+
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
  ctx.fillStyle='#68717d';ctx.font='750 31px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.textAlign='center';ctx.fillText('МНЕ ВЫПАЛ ЮЗЕРНЕЙМ',540,455);
  ctx.fillStyle='#111318';const size=storyFitFont(ctx,handle,820,150,68,900);ctx.font='900 '+size+'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText(handle,540,800);
  ctx.fillStyle='#eef1f3';storyRoundRect(ctx,250,1000,580,104,30);ctx.fill();
  ctx.fillStyle='#111318';ctx.font='800 32px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('ИГРАЙ СО МНОЙ',540,1067);
  ctx.fillStyle='#8a929c';ctx.font='550 27px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';ctx.fillText('USERNAME · коллекционная игра',540,1170);
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
  return tiers[state.dropTier]||tiers.basic||{key:'basic',label:'3K',cost:3000};
}
function dropPricePicker(tiers){
 if(!state.dropPicker)return '';
 return '<div class="drop-cost-overlay"><button class="drop-cost-back" data-drop-picker-close aria-label="Закрыть"></button><div class="drop-cost-sheet"><div class="drop-cost-title"><b>Стоимость попытки</b><span>Выберите цену дропа</span></div>'+Object.values(tiers).map(t=>'<button class="drop-cost-option '+(state.dropTier===t.key?'active':'')+'" data-drop-tier="'+t.key+'"><span>'+esc(t.label)+'</span><b>'+fmt(t.cost)+'</b></button>').join('')+'</div></div>';
}
function homeView(){
 const h=state.home,u=h.user,p=h.pending,tiers=h.config?.dropTiers||{},tier=selectedDropTier(),free=u.freeDrops>0&&tier.key==='basic',payCost=free?0:Number(tier.cost||3000),cantAfford=!free&&u.balance<payCost;
 return '<div class="home-v7">'+
  '<section class="home-level-v7">'+xpBar(u)+'</section>'+
  (!p?'<div class="home-stake-top"><button class="drop-price-v7" data-drop-picker-open aria-label="Выбрать стоимость дропа"><span>'+fmt(tier.cost)+'</span>'+icon('down')+'</button></div>':'')+
  '<section class="drop-zone home-drop-v7">'+
    (p?resultCard(p,true):'<button class="handle-stage drop-trigger" id="handleStage" data-drop-trigger '+(cantAfford?'disabled':'')+' aria-label="Получить username"><b data-fit-username data-max-size="58" data-min-size="25">@username</b><span>Нажми, чтобы получить</span></button>')+
  '</section>'+
  (!p?'<section class="home-quick-v7"><button class="home-quick-action" data-page="upgrader"><span class="home-quick-icon">'+icon('upgrade')+'</span><div><b>Апгрейдер</b><small>Улучшить username</small></div>'+icon('chevron')+'</button><button class="home-quick-action" data-page="wheel"><span class="home-quick-icon">'+icon('wheel')+'</span><div><b>Колесо</b><small>Быстрое вращение</small></div>'+icon('chevron')+'</button></section>':'')+
  dropPricePicker(tiers)+
 '</div>';
}
async function animateDrop(result){
 const stage=document.querySelector('#handleStage');if(!stage)return;stage.disabled=true;
 const delays=motionEnabled()?[55,60,65,70,80,95,115,145]:[25],samples=buildRollSequence(delays.length,result.handle);let i=0;
 for(const d of delays){stage.classList.add('rolling');stage.innerHTML='<b data-fit-username data-max-size="58" data-min-size="25">'+samples[i++]+'</b>';fitAllUsernames();sound('tick');await new Promise(r=>setTimeout(r,d))}
 stage.innerHTML='<b data-fit-username data-max-size="58" data-min-size="25">'+esc(result.handle)+'</b>';fitAllUsernames();stage.classList.remove('rolling');stage.classList.add('land');
 sound(result.visual==='gold'?'reward':'reveal');if(result.visual==='gold')haptic('medium');else if(result.visual==='purple')haptic('light');
 await new Promise(r=>setTimeout(r,motionEnabled()?90:20));state.home.pending=result;render();
}
function collectionFilterSheet(){
 if(!state.collectionFilterOpen)return '';
 const f=state.filters,row=(label,key,value,current)=>'<button data-collection-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр коллекции</b><button data-sheet-close>'+icon('close')+'</button></div><span>Стоимость</span><div class="sheet-options">'+row('Сначала дорогие','sort','expensive',f.sort)+row('Сначала дешёвые','sort','cheap',f.sort)+'</div><span>Дата</span><div class="sheet-options">'+row('Сначала новые','sort','new',f.sort)+row('Сначала старые','sort','old',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div></aside></div>';
}
function collectionView(){
 const d=state.collection||{items:[],summary:{count:0,value:0},page:1,pages:1};
 return '<div class="page-body collection-page collection-page-clean">'+collectionFilterSheet()+
  '<div class="screen-toolbar collection-toolbar"><div><b>'+(d.summary?.count||0)+' юзернеймов</b><span>Общая стоимость · '+fmt(d.summary?.value||0)+'</span></div>'+FilterButton('collection')+'</div>'+
  '<div class="collection-grid">'+(d.items.length?d.items.map(x=>'<article class="user-card collection-card'+valueClass(x)+'">'+
   '<button class="user-card-main" data-detail="'+x.id+'"><span data-fit-username data-max-size="18" data-min-size="11">'+esc(x.handle)+'</span><b>'+fmt(x.value)+'</b><small>'+(x.score?'Оценка '+x.score:'В коллекции')+'</small></button>'+
   '<button class="user-card-sell" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+(x.sellValue??x.value)+'">Продать</button>'+
  '</article>').join(''):'<div class="empty">По этому фильтру ничего нет.</div>')+'</div>'+pager(d.page,d.pages,'collection')+'</div>';
}
function pager(page,pages,type){if(pages<=1)return '';return '<div class="pager"><button data-pager="'+type+'" data-dir="-1" '+(page<=1?'disabled':'')+'>Назад</button><span>'+page+' / '+pages+'</span><button data-pager="'+type+'" data-dir="1" '+(page>=pages?'disabled':'')+'>Дальше</button></div>'}
function marketFilterSheet(){
 if(!state.marketFilterOpen)return '';
 const f=state.marketFilters,row=(label,key,value,current)=>'<button data-market-filter="'+key+'" data-filter-value="'+value+'" class="'+(current===value?'active':'')+'">'+label+'</button>';
 return '<div class="sheet-root"><button class="sheet-backdrop" data-sheet-close></button><aside class="filter-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Фильтр рынка</b><button data-sheet-close>'+icon('close')+'</button></div><span>Цена</span><div class="sheet-options">'+row('Сначала дешёвые','sort','cheap',f.sort)+row('Сначала дорогие','sort','expensive',f.sort)+'</div><span>Длина</span><div class="sheet-options">'+row('Короткие','sort','short',f.sort)+row('Длинные','sort','long',f.sort)+'</div><span>Тип</span><div class="sheet-options">'+row('Все','digits','all',f.digits)+row('Без цифр','digits','none',f.digits)+row('С цифрами','digits','with',f.digits)+'</div><span>Дата</span><div class="sheet-options">'+row('Новые','sort','new',f.sort)+'</div></aside></div>';
}
function marketView(){
 const m=state.market||{items:[],page:1,pages:1};
 return '<div class="page-body market-page">'+marketFilterSheet()+'<div class="market-search"><label>'+icon('search')+'<input id="marketQuery" value="'+esc(state.marketFilters.q)+'" placeholder="Поиск..." autocomplete="off"></label>'+FilterButton('market')+'</div><div class="market-list">'+(m.items.length?m.items.map(x=>{
   const diff=Number(x.potential||0);
   return '<article class="market-card'+valueClass(x)+'"><div class="market-main"><span data-fit-username data-max-size="20" data-min-size="13">'+esc(x.handle)+'</span><b>'+fmt(x.price)+'</b><small>Оценка '+fmt(x.marketValue||x.value)+'</small>'+(diff>0?'<strong class="market-profit">+'+fmt(diff).replace('$','')+'</strong>':'')+'</div>'+(x.sellerId===state.user?.id?'<button class="secondary" data-market-cancel="'+x.id+'">Снять</button>':'<button class="primary" data-market-buy="'+x.id+'">Купить</button>')+'</article>';
 }).join(''):'<div class="empty">Ничего не найдено.</div>')+'</div>'+pager(m.page,m.pages,'market')+'</div>';
}
function topView(){
 const all=state.leaderboard?.items||[],top=all.slice(0,3),rest=all.slice(3),size=10,pages=Math.max(1,Math.ceil(rest.length/size));
 state.rankPage=Math.max(1,Math.min(state.rankPage,pages));const list=rest.slice((state.rankPage-1)*size,state.rankPage*size);
 const card=(r,pos,hero=false)=>r?'<button class="money-rank '+(hero?'hero':'')+'" data-profile="'+r.id+'"><small>#'+pos+'</small><b>'+esc(r.first_name||r.username||'Игрок')+'</b><strong>'+fmt(r.capital)+'</strong><span>'+(r.best_handle||'Без usernames')+'</span></button>':'';
 return '<div class="page-body rank-page"><div class="rank-summary money"><span>ОБЩИЙ КАПИТАЛ</span><b>Кто богаче</b><small>Баланс + стоимость всех активных usernames</small></div><div class="podium">'+card(top[0],1,true)+'<div>'+card(top[1],2)+card(top[2],3)+'</div></div><div class="rank-list money-list">'+list.map(r=>'<button class="rank-row" data-profile="'+r.id+'"><span class="pos">#'+r.position+'</span><div><b>'+esc(r.first_name||r.username||'Игрок')+'</b><small>'+(r.best_handle||'Без usernames')+'</small></div><strong>'+fmt(r.capital)+'</strong></button>').join('')+'</div>'+pager(state.rankPage,pages,'rank')+'</div>';
}
function taskIcon(t){
 const src=String(t?.source||'');
 if(src==='channel_sub')return 'notifications';
 if(src==='market_buy')return 'market';
 if(src==='upgrade')return 'upgrade';
 if(src==='gift')return 'gift';
 if(src==='invite')return 'friends';
 if(src==='view_profile')return 'profile';
 if(src==='wheel')return 'wheel';
 if(src.startsWith('game_')||src==='games'||src==='hunt_win')return 'games';
 if(src==='drop'||src==='rare'||src==='nodigits'||src==='keep'||src==='sell')return 'collection';
 return 'tasks';
}
function tasksView(){
 const d=state.tasks||{items:[],completed:0,total:0,ready:0},items=d.items||[],regular=items.filter(x=>!x.special),special=items.filter(x=>x.special);
 const card=t=>{
  const done=Number(t.current)>=Number(t.target),pct=Math.max(0,Math.min(100,Math.round(Number(t.current||0)/Math.max(1,Number(t.target||1))*100)));
  let action='';
  if(t.claimed)action='<span class="task-claimed-badge">Получено</span>';
  else if(done)action='<button class="task-claim" data-claim="'+esc(t.key)+'">Забрать <b>+'+fmt(t.reward)+'</b></button>';
  else if(t.special)action='<div class="task-channel-actions"><button class="secondary" data-task-channel-open="'+esc(t.channelUrl||'')+'">Подписаться</button><button data-task-channel-verify>Проверить</button></div>';
  else action='<span class="task-progress-label">'+Number(t.current||0)+' / '+Number(t.target||0)+'</span>';
  return '<article class="task-v10 '+(t.special?'special ':'')+(t.claimed?'claimed ':'')+(done&&!t.claimed?'ready':'')+'">'+
    '<div class="task-v10-top"><span class="task-v10-icon">'+icon(taskIcon(t))+'</span><div class="task-v10-copy"><b>'+esc(t.label)+'</b><span>'+(t.special?'Специальное задание':'Ежедневное задание')+'</span></div><strong>+'+fmt(t.reward)+'</strong></div>'+
    (!t.special?'<div class="task-v10-progress"><i style="--p:'+pct+'%"></i></div>':'')+
    '<div class="task-v10-bottom">'+action+'</div>'+
  '</article>';
 };
 return '<div class="page-scroll tasks-v10">'+
  '<section class="tasks-v10-hero"><div><small>СЕГОДНЯ</small><b>Задания</b><span>Выполнено '+Number(d.completed||0)+' из '+Number(d.total||items.length)+'</span></div><strong>'+Number(d.ready||0)+'</strong></section>'+
  (special.length?'<div class="section-label">Специальное</div>'+special.map(card).join(''):'')+
  '<div class="section-label">Ежедневные · '+regular.length+'</div>'+regular.map(card).join('')+
 '</div>';
}
function wheelGeometry(items){
 const total=Math.max(1,items.reduce((s,x)=>s+Number(x.weight||0),0));let cursor=0;
 const colors=['#ffffff','#eef1f4'],segments=[],rows=items.map((x,i)=>{const start=cursor/total*360;cursor+=Number(x.weight||0);const end=cursor/total*360;segments.push(colors[i%2]+' '+start+'deg '+end+'deg');return {...x,start,end,center:(start+end)/2,span:end-start}});
 return {rows,background:'conic-gradient('+segments.join(',')+')'};
}
function wheelShortLabel(x){
 if(x.type==='username')return '1/1';
 if(x.type==='drop')return 'DROP';
 return String(x.label||'').replace(' бесплатный дроп',' ДРОП');
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
 if(x.type==='username')return 'color-mix(in srgb,var(--accent) 30%,var(--card))';
 if(x.type==='drop')return 'color-mix(in srgb,var(--gold) 24%,var(--card))';
 if(x.type==='xp')return 'color-mix(in srgb,var(--profit) 20%,var(--card))';
 return i%2?'color-mix(in srgb,var(--text) 7%,var(--card))':'var(--card)';
}
function wheelLabelRotation(angle){
 const base=Number(angle)-90;
 return base>90&&base<270?base+180:base;
}
function wheelSvgMarkup(rows){
 return '<svg class="fortune-svg" id="wheelDisc" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" aria-hidden="true">'+
  '<circle cx="50" cy="50" r="48.3" fill="var(--card)"></circle>'+
  rows.map((x,i)=>{
   const [tx,ty]=wheelPoint(x.center,32.5),label=x.span>=10?('<text x="'+tx.toFixed(2)+'" y="'+ty.toFixed(2)+'" transform="rotate('+wheelLabelRotation(x.center).toFixed(2)+' '+tx.toFixed(2)+' '+ty.toFixed(2)+')" text-anchor="middle" dominant-baseline="middle">'+esc(wheelShortLabel(x))+'</text>'):'';
   return '<path class="fortune-slice" d="'+wheelSlicePath(x.start,x.end,47.4)+'" fill="'+wheelSliceFill(x,i)+'" stroke="var(--card)" stroke-width=".7"></path>'+label;
  }).join('')+
  '<circle cx="50" cy="50" r="47.4" fill="none" stroke="var(--border)" stroke-width=".9"></circle>'+
  '<circle cx="50" cy="50" r="40.6" fill="none" stroke="var(--border)" stroke-width=".45"></circle>'+
 '</svg>';
}
function wheelView(){
 const w=state.wheel||{rewards:[],available:false},g=wheelGeometry(w.rewards||[]),last=state.wheelLastResult;
 return '<div class="wheel-page wheel-v10">'+
  '<div class="wheel-v10-status"><i class="'+(w.available?'ready':'wait')+'"></i><span>'+(w.available?'Доступно сейчас':('Через '+untilText(w.nextAt)))+'</span></div>'+
  '<div class="fortune-stage wheel-v10-stage">'+wheelSvgMarkup(g.rows)+'<div class="fortune-pointer"><i></i></div><div class="fortune-hub"><span>USERNAME</span><b>'+icon('wheel')+'</b></div></div>'+
  '<div id="wheelResult" class="wheel-result wheel-v10-result '+(last?'show':'')+'">'+(last?('<span>Выпало</span><b>'+esc(last.label)+'</b>'):'<span>1 вращение в сутки</span>')+'</div>'+
  '<button class="primary wheel-spin-button wheel-v10-button" data-wheel '+(!w.available?'disabled':'')+'><span>'+(w.available?'Крутить':'Уже использовано')+'</span></button>'+
 '</div>';
}
function friendsView(){
 const f=state.friends||{friends:[],rewards:[],invited:0,active:0},link=f.referralLink||'';
 return '<div class="page-body friends-page"><div class="friends-intro"><b>Друзья</b><span>Приглашай друзей и собирай коллекцию вместе.</span></div><section class="ref-card"><small>ТВОЯ ССЫЛКА</small><b>'+esc(link||'Ссылка загружается…')+'</b><div><button class="secondary" data-copy-ref '+(!link?'disabled':'')+'>Скопировать</button><button class="primary" data-share-ref '+(!link?'disabled':'')+'>Отправить другу</button></div></section><div class="friend-stats">'+metric('Приглашено',f.invited)+metric('Наград',f.rewardsCount??f.rewards.length)+metric('До следующей',f.nextReward?f.nextReward.remaining:'—')+'</div><div class="section-label">Друзья</div><div class="friends-list">'+(f.friends.length?f.friends.map(x=>'<div class="friend-row"><div><b>'+esc(x.first_name||x.username||'Игрок')+'</b><span>'+(x.username?'@'+esc(x.username):'Без username')+'</span></div><strong>ур. '+x.level+'</strong></div>').join(''):'<div class="empty">Пригласи первого друга.</div>')+'</div></div>';
}
function giftView(){
 const g=state.gift||{items:[]},item=g.items.find(x=>String(x.id)===String(state.giftSelectedItem)),fee=item?Math.max(1,Math.round(Number(item.value||0)*.05)):0;
 const itemSheet=state.giftSheet==='item'?'<div class="sheet-root"><button class="sheet-backdrop" data-gift-sheet-close></button><aside class="filter-sheet gift-sheet"><div class="sheet-grabber"></div><div class="sheet-title"><b>Юзернейм</b><button data-gift-sheet-close>'+icon('close')+'</button></div><div class="gift-options">'+g.items.map(x=>'<button data-gift-select-item="'+x.id+'"><span>'+esc(x.handle)+'</span><b>'+fmt(x.value)+'</b></button>').join('')+'</div></aside></div>':'';
 return '<div class="gift-page-v7">'+itemSheet+
  '<button class="gift-select-row" data-gift-open="item"><span>Юзернейм</span><b>'+(item?esc(item.handle):'Выберите username')+'</b>'+icon('chevron')+'</button>'+
  '<label class="gift-recipient-v8"><span>Получатель</span><div>@<input id="giftRecipientUsername" maxlength="32" autocomplete="off" value="'+esc(state.giftRecipientUsername||'')+'" placeholder="Введите @username"></div></label>'+
  (item?'<div class="gift-fee-v8"><span>Комиссия 5%</span><b>'+fmt(fee)+'</b></div>':'')+
  '<button class="primary gift-submit-v7" data-gift '+(!item?'disabled':'')+'>Передать</button>'+
 '</div>';
}
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
 return '<button class="upgrade-target-pick '+(selected?'selected':'')+'" data-up-target="'+esc(x.sessionId)+'"><span class="upgrade-target-main"><b data-fit-username data-max-size="18" data-min-size="12">'+esc(x.target.handle)+'</b><small>'+fmt(x.target.value)+'</small></span><span class="upgrade-target-chance"><small>ШАНС</small><strong>'+chance+'%</strong></span>'+(selected?'<i class="upgrade-selected-dot"></i>':'<i>'+icon('chevron')+'</i>')+'</button>';
}
function appendUpgradeBatch(){
 const list=document.querySelector('.upgrade-list'),all=state.upgrader?.available||[];if(!list)return;
 const from=Math.min(state.upgradeVisibleCount||30,all.length),to=Math.min(all.length,from+18);if(to<=from)return;
 const tpl=document.createElement('template');tpl.innerHTML=all.slice(from,to).map(upgradeRowHtml).join('');list.append(tpl.content);state.upgradeVisibleCount=to;hydrateIcons();
}

function upgraderView(){
 const u=state.upgrader||{available:[],maxItems:3},selected=selectedUpgradeItems(),source=selected[0],sourceTotal=selected.reduce((sum,x)=>sum+Number(x.value||0),0),stage=state.upgradeStage||'source',round=state.upgradeLastRound;
 if(stage==='source'){
  return '<div class="upgrade-page upgrade-source-stage"><div class="upgrade-list-title"><b>Твои usernames</b><span>'+selected.length+' / '+Number(u.maxItems||3)+'</span></div><div class="upgrade-list upgrade-source-list">'+
   ((u.available||[]).length?(u.available||[]).slice(0,state.upgradeVisibleCount||30).map(upgradeRowHtml).join(''):'<div class="empty">Нет юзернеймов для апгрейда.</div>')+
  '</div><div class="upgrade-footer source-footer"><div><span>Сумма</span><b>'+fmt(sourceTotal)+'</b></div><button class="primary" data-upgrade-preview '+(!selected.length?'disabled':'')+'>Выбрать цель</button></div></div>';
 }
 if(stage==='target'){
  const targets=upgradeTargetOptions(),picked=selectedUpgradeTarget(),total=Number(state.upgradePreview?.totalValue||sourceTotal),count=Number(state.upgradePreview?.sources?.length||selected.length||1);
  return '<div class="upgrade-page upgrade-target-stage">'+
   '<section class="upgrade-source-summary"><div><b>'+(count>1?(count+' юзернеймов'):(source?esc(source.handle):'—'))+'</b><strong>'+fmt(total)+'</strong></div></section>'+
   '<div class="upgrade-target-list">'+(targets.length?targets.map(upgradeTargetRowHtml).join(''):'<div class="empty">Подбираем варианты…</div>')+'</div>'+
   '<div class="upgrade-footer"><button class="secondary upgrade-back-step" data-upgrade-back-source>'+icon('back')+'</button><div><span>Шанс</span><b>'+(picked?upgradeChanceText(picked.chance)+'%':'—')+'</b></div><button class="primary" data-upgrade '+(!picked||state.upgradeSpinning?'disabled':'')+'>Апгрейд</button></div>'+
  '</div>';
 }
 const picked=selectedUpgradeTarget(),roundSources=round?.sources||[],liveSources=roundSources.length?roundSources:selected,liveTotal=liveSources.reduce((sum,x)=>sum+Number(x.value||0),0),liveLabel=liveSources.length>1?(liveSources.length+' юзернеймов'):(liveSources[0]?.handle||'—'),target=round?.target||picked?.target||state.upgradeOutcome?.target;
 const chanceValue=round?.chance??picked?.chance??state.upgradeOutcome?.chance??0,chance=upgradeChanceText(chanceValue),angle=Math.max(3,Math.min(331.2,Number(chanceValue||0)*360)),landing=round?Number(state.upgradeLandingAngle||0):0,wheelAngle=round?((360-(landing%360))%360):0;
 const done=!!state.upgradeOutcome&&!state.upgradeSpinning&&!!round,success=!!state.upgradeOutcome?.success;
 return '<div class="upgrade-page upgrade-spin-stage">'+
  '<section class="upgrade-matchup"><div class="upgrade-match-side source"><b data-fit-username data-max-size="18" data-min-size="11">'+esc(liveLabel)+'</b><strong>'+fmt(liveTotal)+'</strong></div><div class="upgrade-match-arrow">→</div><div class="upgrade-match-side target"><b data-fit-username data-max-size="18" data-min-size="11">'+(target?esc(target.handle):'—')+'</b><strong>'+(target?fmt(target.value):'—')+'</strong></div></section>'+
  '<section class="upgrade-wheel-card ready '+(done?(success?'round-win':'round-fail'):'')+'"><div class="upgrade-roulette upgrade-roulette-clean" style="--chance-angle:'+angle+'deg"><div class="upgrade-wheel-rotor" id="upgradeRotor" style="transform:rotate('+wheelAngle+'deg)"><div class="upgrade-ring"></div></div><div class="upgrade-pointer-static"></div><div class="upgrade-ring-core"><b>'+chance+'%</b></div></div></section>'+
  (done?'<section class="upgrade-result-panel '+(success?'success':'fail')+'"><b>'+(success?'Получено '+esc(state.upgradeOutcome.result.handle):'Не выпало')+'</b><button class="primary" data-upgrade-continue>Продолжить</button></section>':'')+
 '</div>';
}
function seasonsView(){const s=state.season?.season;if(!s)return '<div class="empty">Активного сезона нет.</div>';const seasonName=currentLanguage()==='en'?String(s.name||'').replace(/^Сезон /,'Season '):String(s.name||'').replace(/^Season /,'Сезон ');return '<div class="page-body"><section class="season-hero"><small>ТЕКУЩИЙ СЕЗОН</small><h1>'+esc(seasonName)+'</h1><div>'+metric('Осталось',s.daysLeft+' дн.')+metric('Место','#'+s.rank)+metric('Очки сезона',s.score)+'</div></section><div class="section-label">Награды</div><div class="season-rewards">'+s.rewards.map(x=>'<div><b>'+x.place+'</b><span>'+x.reward+'</span></div>').join('')+'</div>'+(s.series?.length?'<div class="section-label">Активные серии</div><div class="series-list">'+s.series.map(x=>'<div><b>'+esc(x.name)+'</b><span>до '+new Date(x.end_at).toLocaleDateString(currentLanguage()==='en'?'en-US':'ru-RU')+'</span></div>').join('')+'</div>':'')+'</div>'}
function profileView(p=state.profile?.profile){
 if(!p)return '<div class="empty">Профиль не найден.</div>';
 const own=String(p.id)===String(state.user?.id),best=p.best,badges=p.achievements||[],luck=p.luckStats||{};
 const achievementNames={first_drop:'Первый улов',collector10:'Полка',collector50:'Коллекционер',clean10:'Чистая десятка',purple:'Фиолетовый',gold:'Золотой билет',gold3:'Золотой запас',deal1:'Первая сделка',deal10:'На рынке',sales25:'Продавец',gift5:'Щедрый',game1:'Разминка',game25:'Игрок',streak5:'Серия',capital1m:'Миллион',level50:'Мастер',level100:'Ветеран',level200:'Легендарный'};
 const luckStatus={legendary:'Невероятно везёт',lucky:'Очень везёт',good:'Везёт',neutral:'Нейтрально',unlucky:'Не везёт',cursed:'Жёстко не везёт'}[luck.status]||'Нейтрально';
 const achievements='<section class="profile-section-v7"><small>ДОСТИЖЕНИЯ</small><div class="profile-achievements-v7">'+(badges.length?badges.map(x=>'<span>'+icon('achievements')+'<b>'+esc(achievementNames[x.achievement_key]||'Награда')+'</b></span>').join(''):'<div class="profile-empty-v7">Пока нет</div>')+'</div></section>';
 const bestBlock='<section class="profile-section-v7"><small>ЛУЧШИЙ ЮЗЕРНЕЙМ</small>'+(best?'<div class="profile-best'+valueClass(best)+'"><b>'+esc(best.handle)+'</b><strong>'+fmt(best.value)+'</strong></div>':'<div class="profile-empty-v7">—</div>')+'</section>';
 const ownStats=own?'<section class="profile-section-v7"><small>СТАТИСТИКА</small><div class="profile-stats-v7">'+metric('Юзернеймы',p.collectionCount)+metric('Сделки',p.marketDeals||0)+metric('Друзья',p.friendsCount||0)+metric('Удача',(Number(luck.score||0))+'%')+'</div></section>'+
  '<section class="profile-luck-v8"><div class="luck-score-ring" style="--luck:'+Math.max(0,Math.min(100,Number(luck.score||0)))+'%"><b>'+Number(luck.score||0)+'%</b><span>Удача</span></div><div class="luck-copy"><small>УДАЧА И НЕВЕЗЕНИЕ</small><b>'+luckStatus+'</b><div><span>Защита от невезения</span><strong>'+Number(luck.protection||0)+'%</strong></div><div><span>Серия неудач</span><strong>'+Number(luck.badStreak||0)+'</strong></div></div></section>':'';
 return '<div class="profile-v7 '+(own?'own-profile':'public-profile')+'">'+
  '<section class="profile-main-v7"><div class="avatar">'+esc((p.firstName||'U')[0].toUpperCase())+'</div><h1>'+esc(p.firstName||'Игрок')+'</h1><span>'+(p.username?'@'+esc(p.username):'')+'</span>'+xpBar(p)+'<div class="profile-inline-stats"><b>#'+Number(p.rank||0)+'</b><strong>'+fmt(p.capital||0)+'</strong></div></section>'+
  bestBlock+achievements+ownStats+'</div>';
}
function shopView(){
 const p=state.shop||{wallet:{gems:0},gemPacks:[],themes:[],owned:[],selected:{}},owned=new Set((p.owned||[]).map(x=>x.key)),selected=String(p.selected?.theme_key||'');
 return '<div class="shop-page-v7"><section class="shop-wallet"><span>💎</span><b>'+new Intl.NumberFormat('ru-RU').format(Number(p.wallet?.gems||0))+'</b></section>'+
  '<div class="section-label">Кристаллы</div><div class="gem-pack-grid">'+(p.gemPacks||[]).map(x=>'<article><div><b>'+esc(x.title)+'</b><span>'+x.stars+' звёзд</span></div><button class="primary" data-buy-product="'+x.key+'" '+(!p.starsEnabled?'disabled':'')+'>Купить</button></article>').join('')+'</div>'+
  '<div class="section-label">Темы</div><div class="theme-shop-grid">'+(p.themes||[]).map(x=>{const has=owned.has(x.key),active=selected===x.key;return '<article data-theme-preview="'+esc(x.key)+'"><div><b>'+esc(x.title)+'</b><span>'+esc(x.description)+'</span></div>'+(has?'<button class="secondary" data-select-cosmetic="theme:'+x.key+'" '+(active?'disabled':'')+'>'+(active?'Выбрано':'Применить')+'</button>':'<button data-buy-theme="'+x.key+'">'+x.gems+' 💎</button>')+'</article>'}).join('')+'</div>'+
  '<p class="shop-note">💎 — только оформление. На дроп, колесо и апгрейд они не влияют.</p></div>';
}
function fmtPlain(n){return new Intl.NumberFormat(currentLanguage()==='en'?'en-US':'ru-RU').format(Math.round(Number(n)||0))}
function promoView(){
 const d=state.promo||{redeemed:[]};
 return '<div class="promo-page">'+
  '<section class="promo-hero"><span>'+icon('promo')+'</span><div><small>PROMO</small><b>Промокод</b><p>Введи код и забери фиксированную награду.</p></div></section>'+
  '<section class="promo-redeem"><label><span>Промокод</span><input id="promoCodeInput" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="USERNAME2026"></label><button class="primary" data-promo-redeem>Активировать</button></section>'+
  '<div class="section-label">Последние активации</div><div class="promo-history">'+((d.redeemed||[]).length?d.redeemed.map(x=>'<article><b>'+esc(x.code)+'</b><span>'+fmtPlain(x.rewardAmount)+' 💎</span><small>'+new Date(x.redeemedAt).toLocaleDateString(currentLanguage()==='en'?'en-US':'ru-RU')+'</small></article>').join(''):'<div class="empty compact">Промокоды ещё не активировались.</div>')+'</div>'+
 '</div>';
}
function settingsView(){
 const s=state.settings||DEFAULT_SETTINGS,themeName={light:'Светлая',dark:'Тёмная',system:'Системная'}[s.theme]||'Системная';
 const toggle=(key,label,ico)=>'<button class="settings-row" data-setting-toggle="'+key+'"><span class="settings-row-icon">'+icon(ico)+'</span><span><b>'+label+'</b></span><i class="switch '+(s[key]?'on':'')+'"></i></button>';
 return '<div class="settings-page"><section class="settings-card"><div class="settings-title"><b>Тема</b><span>'+themeName+'</span></div><div class="theme-segment">'+
  [['light','Светлая','sun-03'],['dark','Тёмная','moon-02'],['system','Системная','settings-01']].map(([v,t,ic])=>'<button data-setting-theme="'+v+'" class="'+(s.theme===v?'active':'')+'">'+iconRaw(ic)+'<span>'+t+'</span></button>').join('')+
 '</div></section><section class="settings-card"><div class="settings-title"><b>Язык</b><span>'+(s.language==='en'?'English':'Русский')+'</span></div><div class="language-segment">'+
  '<button data-setting-language="ru" class="'+(s.language!=='en'?'active':'')+'">Русский</button><button data-setting-language="en" class="'+(s.language==='en'?'active':'')+'">English</button>'+
 '</div></section><section class="settings-card settings-list">'+toggle('vibration','Вибрация','settings')+toggle('sound','Звук','sound')+toggle('animations','Анимации','motion')+'</section></div>';
}
function iconRaw(name){return icon(RAW_ICON_KEY[name]||name)}
function levelsView(){
 const l=state.levels||{},p=l.progression||state.user||{},rewards=(l.rewards||[]).filter(r=>Number(r.level)>Number(p.level||1)).slice(0,7);
 return '<div class="levels-v7"><section class="levels-main-v7"><h1>УР. '+Number(p.level||1)+'</h1><b>'+esc(p.title||state.user?.title||'Новичок')+'</b>'+xpBar(p)+'<span>До следующего: '+Number(p.remaining||0)+' XP</span></section>'+
 '<div class="section-label">Ближайшие награды</div><div class="level-nearby-v7">'+(rewards.length?rewards.map(r=>'<article><b>УР. '+r.level+'</b><span>'+esc(r.title||'')+'</span><strong>'+(r.money?fmt(r.money):((r.freeDrops||0)+' дропов'))+'</strong></article>').join(''):'<div class="empty compact">Все награды получены.</div>')+'</div></div>';
}
function achievementsView(){
 const a=state.achievements||{items:[],completed:0,total:0};
 return '<div class="achievements-v7"><div class="achievement-summary-v7"><span>Получено</span><b>'+a.completed+' / '+a.total+'</b></div><div class="achievement-grid-v7">'+(a.items||[]).map(x=>{
   const pct=Math.max(0,Math.min(100,Math.round(Number(x.current||0)/Math.max(1,Number(x.target||1))*100)));
   return '<article class="'+(x.done?'done':'locked')+'"><div class="achievement-badge-icon">'+iconRaw(x.icon||'medal-01')+'</div><b>'+(x.done?esc(x.title):'????')+'</b><small>'+esc(x.category||'')+'</small>'+(x.done?'<span class="achievement-opened">Открыто</span>':'<em>'+Math.min(Number(x.current||0),Number(x.target||0))+' / '+Number(x.target||0)+'</em><i style="--p:'+pct+'%"></i>')+'</article>';
 }).join('')+'</div></div>';
}
function detailView(x){
 const q=x.quality||{};
 return '<div class="detail-v10">'+
  '<section class="username-detail-hero'+valueClass(x)+'"><small>ТВОЙ USERNAME</small><h1 data-fit-username data-max-size="54" data-min-size="24">'+esc(x.handle)+'</h1><div class="username-detail-price"><span>Стоимость</span><b>'+fmt(x.value)+'</b></div></section>'+
  '<section class="username-detail-quality"><div>'+metric('Читаемость',Number(q.pronounceability||0))+metric('Краткость',Number(q.length||0))+metric('Чистота',Number(q.cleanliness||0))+metric('Спрос',Number(q.semantic||0))+'</div></section>'+
  '<div class="username-detail-actions"><button class="primary" data-list-market="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'">'+icon('market')+'<span>На рынок</span></button><button class="secondary" data-sell-system="'+x.id+'" data-handle="'+esc(x.handle)+'" data-value="'+x.value+'"><span>Продать</span></button></div>'+
 '</div>';
}
function notificationsView(){
 const d=state.notifications||{items:[],unread:0},items=d.items||[];
 return '<div class="notifications-page"><div class="notifications-head"><div><b>Уведомления</b><span>'+(d.unread?('Непрочитанных: '+d.unread):'Всё прочитано')+'</span></div>'+(d.unread?'<button class="secondary" data-notifications-read>Прочитать все</button>':'')+'</div>'+
  '<div class="notifications-list">'+(items.length?items.map(n=>'<button class="notification-item '+(n.read?'':'unread')+'" data-notification-id="'+esc(n.id)+'" data-notification-page="'+esc(n.page||'')+'"><span class="notification-icon">'+icon(n.type==='USERNAME_RECEIVED'?'gift':n.type==='ADMIN_MESSAGE'?'admin':'notifications')+'</span><span class="notification-copy"><b>'+esc(n.title)+'</b><small>'+esc(n.body||'')+'</small><em>'+new Date(n.createdAt).toLocaleString(currentLanguage()==='en'?'en-US':'ru-RU')+'</em></span><span class="notification-state">'+(n.read?'':'<i></i>')+'</span></button>').join(''):'<div class="empty">Пока уведомлений нет.</div>')+'</div></div>';
}
function gamesView(){
 const g=state.games||{games:[],daily:{earned:0,cap:0}};
 return '<div class="games-hub-v7"><div class="games-cap-v7"><span>Сегодня</span><b>'+fmt(g.daily?.earned||0)+' / '+fmt(g.daily?.cap||0)+'</b></div><div class="games-grid-v7">'+(g.games||[]).map(x=>'<button data-game-start="'+x.key+'"><span>'+iconRaw(x.icon||'gamepad')+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.bestLabel||'Лучший')+' · '+Number(x.best||0)+'</small></button>').join('')+'</div></div>';
}
function miniGameView(){
 const g=state.gameSession;if(!g)return '<div class="empty">Игра не запущена.</div>';
 if(g.done)return '<div class="game-finish-v7"><span>'+icon('games')+'</span><h2>'+g.score+' / '+g.total+'</h2><b>+'+fmt(g.reward)+' · +'+g.xp+' опыта</b><button class="primary" data-page="games">К играм</button></div>';
 const q=g.question||{},head='<div class="game-progress-v7"><span>'+(g.index+1)+' / '+g.total+'</span><b>+'+fmt(g.reward||0)+'</b></div>';
 let body='';
 if(g.gameKey==='hunt')body='<div class="game-question-v7"><h2>Какой дороже?</h2><div class="hunt-grid-v7">'+(q.options||[]).map(x=>'<button class="'+valueClass(x).trim()+'" data-game-answer="'+esc(x.handle)+'">'+esc(x.handle)+'</button>').join('')+'</div></div>';
 if(g.gameKey==='higher')body='<div class="game-question-v7"><div class="versus-v7"><article><b>'+esc(q.left?.handle||'')+'</b><strong>'+fmt(q.left?.value||0)+'</strong></article><span>ПРОТИВ</span><article><b>'+esc(q.right?.handle||'')+'</b><strong>???</strong></article></div><div class="game-two-actions"><button data-game-answer="higher">Выше</button><button data-game-answer="lower">Ниже</button></div></div>';
 if(g.gameKey==='editor')body='<div class="game-question-v7"><h2>'+esc(q.source||'')+'</h2><span>'+fmt(q.sourceValue||0)+'</span><label class="game-input-v7">@<input id="gameEditorInput" maxlength="15" autocomplete="off" placeholder="сделай дороже"></label><button class="primary" data-game-editor-submit>Проверить</button></div>';
 if(g.gameKey==='build')body='<div class="game-question-v7"><h2>@'+esc(state.gameBuildValue||'')+'</h2><div class="parts-v7">'+(q.parts||[]).map(x=>'<button data-game-part="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div><div class="game-two-actions"><button class="secondary" data-game-build-clear>Сбросить</button><button class="primary" data-game-build-submit '+(!state.gameBuildValue?'disabled':'')+'>Готово</button></div></div>';
 if(g.gameKey==='price')body='<div class="game-question-v7"><h2>'+esc(q.item?.handle||'')+'</h2><div class="price-options-v7">'+(q.bands||[]).map(x=>'<button data-game-answer="'+x.key+'">'+esc(x.label)+'</button>').join('')+'</div></div>';
 const feedback=state.gameFeedback?'<div class="game-feedback-v7 '+(state.gameFeedback.correct?'ok':'bad')+'"><b>'+(state.gameFeedback.correct?'Верно':'Мимо')+'</b> +'+fmt(state.gameFeedback.reward||0)+'</div>':'';
 return '<div class="mini-game-v7">'+head+body+feedback+'</div>';
}
function render(){const page=state.page;
 if(page==='home')shell('USERNAME',homeView());
 else if(page==='collection')shell('Коллекция',collectionView());
 else if(page==='market')shell('Рынок',marketView());
 else if(page==='top')shell('Топ',topView());
 else if(page==='tasks')shell('Задания',tasksView());
 else if(page==='levels')shell('Уровни',levelsView());
 else if(page==='achievements')shell('Достижения',achievementsView());
 else if(page==='notifications')shell('Уведомления',notificationsView());
 else if(page==='settings')shell('Настройки',settingsView());
 else if(page==='wheel')shell('Колесо',wheelView());
 else if(page==='friends')shell('Друзья',friendsView());
 else if(page==='gift')shell('Подарки',giftView());
 else if(page==='upgrader')shell('Апгрейдер',upgraderView());
 else if(page==='seasons')shell('Сезоны',seasonsView());
 else if(page==='profile')shell('Профиль',profileView());
 else if(page==='shop')shell('Магазин',shopView());
 else if(page==='promo')shell('Промокод',promoView());
 else if(page==='games')shell('Игры',gamesView());
 else if(page==='miniGame')shell('Игра',miniGameView(),{back:true});
 else if(page==='detail')shell('Username',detailView(state.detail),{back:true});
 else if(page==='admin')shell('Админка',window.USERNAME_ADMIN?.view?.()||'<div class="empty">Админка загружается…</div>')
}
async function refreshUser(){const h=await api('/api/home');state.home=h;state.user=h.user;return h}
const PAGE_TITLE={home:'USERNAME',collection:'Коллекция',market:'Рынок',top:'Топ',tasks:'Задания',levels:'Уровни',achievements:'Достижения',notifications:'Уведомления',settings:'Настройки',wheel:'Колесо',friends:'Друзья',gift:'Подарки',upgrader:'Апгрейдер',seasons:'Сезоны',profile:'Профиль',shop:'Магазин',promo:'Промокод',games:'Игры',miniGame:'Игра',admin:'Админка'};
const PAGE_CACHE_TTL=12000;
let routeSeq=0;
function pageReady(page){
 return page==='home'?!!state.home:
  page==='collection'?!!state.collection:
  page==='market'?!!state.market:
  page==='top'?!!state.leaderboard:
  page==='tasks'?!!state.tasks:
  page==='levels'?!!state.levels:
  page==='achievements'?!!state.achievements:
  page==='notifications'?!!state.notifications:
  page==='settings'?true:
  page==='wheel'?!!state.wheel:
  page==='friends'?!!state.friends:
  page==='gift'?!!state.gift:
  page==='upgrader'?!!state.upgrader:
  page==='seasons'?!!state.season:
  page==='profile'?!!state.profile:
  page==='shop'?!!state.shop:
  page==='promo'?!!state.promo:
  page==='games'?!!state.games:
  page==='miniGame'?!!state.gameSession:
  page==='admin'?!!state.admin:true;
}
function routeLoading(on){
 app.classList.toggle('route-loading',!!on);
 app.setAttribute('aria-busy',on?'true':'false');
 if(on){const menu=document.querySelector('.menu-backdrop.open');if(menu)menu.classList.remove('open')}
}
async function fetchPage(page){
 if(!state.user||page==='home')await refreshUser();
 if(page==='collection')state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&page='+state.filters.page);
 if(page==='market')state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page='+state.marketFilters.page);
 if(page==='top')state.leaderboard=await api('/api/leaderboard');
 if(page==='tasks')state.tasks=await api('/api/tasks');
 if(page==='levels')state.levels=await api('/api/levels');
 if(page==='achievements')state.achievements=await api('/api/achievements/reconcile',{method:'POST',body:'{}'});
 if(page==='notifications'){state.notifications=await api('/api/notifications');if(state.user)state.user.unreadNotifications=Number(state.notifications.unread||0)}
 if(page==='games')state.games=await api('/api/games');
 if(page==='wheel')state.wheel=await api('/api/wheel');
 if(page==='friends')state.friends=await api('/api/friends');
 if(page==='gift'){state.gift=await api('/api/gift/options');state.giftSheet='';state.giftRecipientUsername='';}
 if(page==='upgrader'){
  state.upgrader=await api('/api/upgrader');state.upgrader.available=shuffleUpgradeItems(state.upgrader.available);
  state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeStage='source';state.upgradeTargetSessionId='';state.upgradeOutcome=null;state.upgradeSpinning=false;state.upgradeLastRound=null;state.upgradeLandingAngle=0;state.upgradeVisibleCount=Math.min(30,state.upgrader.available.length);state.upgradeScrollTop=0
 }
 if(page==='seasons')state.season=await api('/api/seasons');
 if(page==='profile')state.profile=await api('/api/profile');
 if(page==='shop')state.shop=await api('/api/shop');
 if(page==='promo')state.promo=await api('/api/promocode');
 if(page==='admin'){if(!state.user?.isAdmin)throw new Error('forbidden');state.adminDetail=null;if(!window.USERNAME_ADMIN?.refresh)throw new Error('network');await window.USERNAME_ADMIN.refresh()}
}
async function load(page,{force=false}={}){
 const seq=++routeSeq,initial=!window.__USERNAME_READY||!state.user;
 state.menu=false;state.dropPicker=false;if(page!=='miniGame')state.gameFeedback=null;
 const fresh=pageReady(page)&&Date.now()-Number(state.pageLoadedAt[page]||0)<PAGE_CACHE_TTL;
 if(fresh&&!force){state.page=page;render();return}
 if(!initial)routeLoading(true);
 try{
  await fetchPage(page);if(seq!==routeSeq)return;
  state.page=page;state.pageLoadedAt[page]=Date.now();render();
 }catch(e){
  if(seq!==routeSeq)return;
  if(initial){state.page=page;shell('USERNAME','<div class="error"><b>'+esc(ERR[e.message]||'Что-то пошло не так')+'</b><button data-page="'+page+'">Повторить</button></div>')}
  else toast(ERR[e.message]||'Не удалось загрузить раздел');
 }finally{if(seq===routeSeq)routeLoading(false)}
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
 const target=Number(degrees||0),ms=Math.max(0,Number(duration)||0),end='rotate('+target+'deg)';
 el.style.transition='none';el.style.transform='rotate(0deg)';
 if(!motionEnabled()||ms<32){el.style.transform=end;return}
 await new Promise(resolve=>{
  const started=performance.now();
  let finished=false;
  const done=()=>{if(finished)return;finished=true;el.style.transform=end;resolve()};
  const frame=now=>{
   if(!el.isConnected)return done();
   const raw=Math.max(0,Math.min(1,(now-started)/ms));
   const eased=1-Math.pow(1-raw,5);
   el.style.transform='rotate('+(target*eased)+'deg)';
   if(raw>=1)return done();
   requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
 });
}
async function spinWheelUi(){
 if(state.busy)return;state.busy=true;
 try{
  const req=crypto.randomUUID?.()||('w-'+Date.now()),r=await api('/api/wheel',{method:'POST',body:JSON.stringify({requestId:req})});
  const items=state.wheel.rewards||[],g=wheelGeometry(items),target=g.rows.find(x=>x.key===r.reward.key),disc=document.querySelector('#wheelDisc'),res=document.querySelector('#wheelResult');
  if(disc&&target){
   const margin=Math.min(2.2,Math.max(.35,target.span*.12)),room=Math.max(.25,target.span-margin*2),landing=target.start+margin+(rollRandomInt(10000)/10000)*room,final=10*360-landing;
   const stage=disc.closest('.fortune-stage');stage?.classList.add('spinning');sound('spin');
   await animateRotation(disc,final,5600,'cubic-bezier(.06,.76,.08,1)');
   stage?.classList.remove('spinning');
  }
  state.wheelLastResult=r.reward;if(res){res.innerHTML='<span>Выпало</span><b>'+esc(r.reward.label)+'</b>';res.classList.add('show')}haptic('medium');sound('reward');await refreshUser();state.wheel=await api('/api/wheel');render();
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
 const sources=result.sources?.length?result.sources:selectedUpgradeItems();
 state.upgradeOutcome=result;state.upgradeSpinning=true;state.upgradeLastRound=null;state.upgradeLandingAngle=0;render();
 const rotor=document.querySelector('#upgradeRotor');if(!rotor){state.upgradeSpinning=false;render();return}
 const winArc=Math.max(3,Math.min(270,Number(result.chance||0)*360)),margin=Math.min(5,winArc/3),unit=rollRandomInt(10000)/10000;
 const landing=result.success?(margin+unit*Math.max(1,winArc-margin*2)):(winArc+margin+unit*Math.max(1,360-winArc-margin*2));
 const wheelDegrees=360*9-landing;
 rotor.closest('.upgrade-roulette-clean')?.classList.add('spinning');sound('spin');
 await animateRotation(rotor,wheelDegrees,6200,'cubic-bezier(.055,.72,.075,1)');
 rotor.closest('.upgrade-roulette-clean')?.classList.remove('spinning');
 haptic(result.success?'medium':'light');sound(result.success?'reward':'fail');
 state.upgradeLandingAngle=landing;state.upgradeLastRound={sources,target:result.target,chance:Number(result.chance||0),success:!!result.success};
 state.upgradeSpinning=false;state.upgradeSelectedIds=[];state.upgradePreview=null;state.upgradeTargetSessionId='';
 state.upgrader=await api('/api/upgrader');state.upgrader.available=shuffleUpgradeItems(state.upgrader.available);state.upgradeVisibleCount=Math.min(Math.max(30,state.upgradeVisibleCount||30),state.upgrader.available.length);state.upgradeScrollTop=0;render();
}
function applyUserLocal(user){
  if(!user)return;state.user=user;if(state.home)state.home.user=user;applyPreferences();
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
async function submitGameAnswer(answer){
 const session=state.gameSession;if(!session?.id)return;
 const r=await api('/api/games/session/'+encodeURIComponent(session.id)+'/answer',{method:'POST',body:JSON.stringify({answer,index:session.index})});
 state.gameSession=r;state.gameFeedback=r.result||null;state.gameBuildValue='';applyUserLocal(r.user);
 if(state.games&&r.daily)state.games.daily=r.daily;
 haptic(r.result?.correct?'light':'soft');if(r.result?.correct)sound('reward');
 render();
 if(!r.done&&state.gameFeedback)setTimeout(()=>{if(state.page==='miniGame'){state.gameFeedback=null;render()}},650);
 if(r.done){try{state.games=await api('/api/games')}catch{}}
}
document.addEventListener('click',async e=>{if(e.target.matches('[data-drop-picker-close]')){state.dropPicker=false;render();return}if(e.target.matches('[data-menu-close]')){setMenuOpen(false);return}if(e.target.matches('[data-modal-close]')){e.target.closest('.modal-root')?.remove();return}const el=e.target.closest('button');if(!el)return;try{
 if(el.hasAttribute('data-menu-open')){sound('tap');setMenuOpen(true);return}
 if(el.hasAttribute('data-menu-close')){setMenuOpen(false);return}
 if(el.hasAttribute('data-notifications-read')){
   const r=await api('/api/notifications/read-all',{method:'POST',body:'{}'});
   if(state.user)state.user.unreadNotifications=Number(r.unread||0);
   state.notifications=await api('/api/notifications');render();return
 }
 if(el.dataset.notificationId){
   const r=await api('/api/notifications/'+encodeURIComponent(el.dataset.notificationId)+'/read',{method:'POST',body:'{}'});
   if(state.user)state.user.unreadNotifications=Number(r.unread||0);
   const item=state.notifications?.items?.find(x=>String(x.id)===String(el.dataset.notificationId));if(item)item.read=true;
   const target=String(el.dataset.notificationPage||'').trim();
   if(target){await load(target,{force:true});return}
   render();return
 }
 if(el.dataset.settingTheme){
   const theme=['light','dark','system'].includes(el.dataset.settingTheme)?el.dataset.settingTheme:'system';
   saveSettings({theme});sound('tap');render();return
 }
 if(el.dataset.settingLanguage){const language=el.dataset.settingLanguage==='en'?'en':'ru';saveSettings({language});sound('tap');render();return}
 if(el.dataset.settingToggle){
   const key=String(el.dataset.settingToggle||'');if(!['vibration','sound','animations'].includes(key))return;
   const value=!state.settings[key];saveSettings({[key]:value});if(key!=='sound'||value)sound('tap');haptic('light');render();return
 }
 if(el.dataset.buyProduct){
   if(!TG?.openInvoice)throw new Error('premium_unavailable');
   const r=await api('/api/shop/invoice',{method:'POST',body:JSON.stringify({productKey:el.dataset.buyProduct})});
   TG.openInvoice(r.invoice,async status=>{if(status==='paid'){sound('reward');haptic('medium');toast('💎 начислены');state.pageLoadedAt.shop=0;await load('shop',{force:true})}});
   return
 }
 if(el.dataset.selectCosmetic){
   const [type,key]=String(el.dataset.selectCosmetic).split(':');await api('/api/cosmetics/select',{method:'POST',body:JSON.stringify({type,key})});
   if(state.shop){state.shop.selected=state.shop.selected||{};state.shop.selected.theme_key=key}
   await refreshUser();sound('tap');haptic('light');render();return
 }
 if(el.dataset.buyTheme){
   const r=await api('/api/shop/theme',{method:'POST',body:JSON.stringify({themeKey:el.dataset.buyTheme})});
   state.shop.wallet=r.wallet;state.shop.owned=state.shop.owned||[];if(!state.shop.owned.some(x=>x.key===r.theme.key))state.shop.owned.push({type:'theme',key:r.theme.key});
   toast('Тема куплена');haptic('light');render();return
 }
 if(el.dataset.gameStart){
   const r=await api('/api/games/'+encodeURIComponent(el.dataset.gameStart)+'/start',{method:'POST'});
   state.gameSession=r;state.gameKey=r.gameKey;state.gameFeedback=null;state.gameBuildValue='';state.backPage='games';state.page='miniGame';render();return
 }
 if(el.dataset.gameAnswer){await submitGameAnswer(el.dataset.gameAnswer);return}
 if(el.hasAttribute('data-game-editor-submit')){
   const value=String(document.querySelector('#gameEditorInput')?.value||'').trim();if(!value)return;await submitGameAnswer(value);return
 }
 if(el.dataset.gamePart!==undefined){
   const part=String(el.dataset.gamePart||'');if(!part||state.gameBuildValue.length+part.length>15)return;
   state.gameBuildValue+=part;el.disabled=true;const title=document.querySelector('.game-question-v7 h2');if(title)title.textContent='@'+state.gameBuildValue;
   const submit=document.querySelector('[data-game-build-submit]');if(submit)submit.disabled=!state.gameBuildValue;return
 }
 if(el.hasAttribute('data-game-build-clear')){state.gameBuildValue='';render();return}
 if(el.hasAttribute('data-game-build-submit')){if(state.gameBuildValue)await submitGameAnswer(state.gameBuildValue);return}
 if(el.dataset.giftOpen){state.giftSheet=el.dataset.giftOpen;render();return}
 if(el.hasAttribute('data-gift-sheet-close')){state.giftSheet='';render();return}
 if(el.dataset.giftSelectItem){state.giftSelectedItem=el.dataset.giftSelectItem;state.giftSheet='';render();return}
 if(el.dataset.giftSelectFriend){state.giftSelectedFriend=el.dataset.giftSelectFriend;state.giftSheet='';render();return}
 if(el.hasAttribute('data-collection-filter-open')){state.collectionFilterOpen=true;render();return}
 if(el.hasAttribute('data-market-filter-open')){state.marketFilterOpen=true;render();return}
 if(el.hasAttribute('data-sheet-close')){state.collectionFilterOpen=false;state.marketFilterOpen=false;render();return}
 if(el.dataset.collectionFilter){state.filters[el.dataset.collectionFilter]=el.dataset.filterValue;state.filters.page=1;state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&page=1');render();return}
 if(el.dataset.marketFilter){state.marketFilters[el.dataset.marketFilter]=el.dataset.filterValue;state.marketFilters.page=1;state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page=1');render();return}
 if(el.hasAttribute('data-promo-redeem')){
   const code=String(document.querySelector('#promoCodeInput')?.value||'').trim();if(!code){toast('Введите промокод');return}
   el.disabled=true;const r=await api('/api/promocode',{method:'POST',body:JSON.stringify({code})});
   applyUserLocal(r.user);state.promo=await api('/api/promocode');sound('reward');haptic('medium');toast('+'+fmtPlain(r.rewardAmount)+' 💎');render();return
 }
 if(el.dataset.page){state.dropPicker=false;await load(el.dataset.page);return}
 if(el.hasAttribute('data-drop-picker-open')){state.dropPicker=true;render();return}
 if(el.dataset.dropTier){state.dropTier=el.dataset.dropTier;state.dropPicker=false;render();return}
 if(el.hasAttribute('data-drop-trigger')&&!state.busy){state.busy=true;el.disabled=true;const requestId=crypto.randomUUID?.()||('req-'+Date.now()+'-'+Math.random().toString(36).slice(2));const r=await api('/api/drop',{method:'POST',body:JSON.stringify({requestId,tier:state.dropTier})});state.home.user=r.user;state.user=r.user;await animateDrop(r.instance);state.busy=false;return}
 if(el.dataset.storyCopy){try{await navigator.clipboard.writeText(el.dataset.storyCopy);toast('Ссылка скопирована')}catch{toast('Не удалось скопировать')}return}
 if(el.dataset.shareStory){
   const item=state.home?.pending&&String(state.home.pending.id)===String(el.dataset.shareStory)?state.home.pending:null;
   if(!item){toast('Username уже недоступен для истории');return}
   el.disabled=true;
   try{sound('story');await shareDropStory(item);toast('Открываю редактор истории')}finally{el.disabled=false}
   return
 }
 if(el.dataset.resolve){
   state.busy=true;const action=el.dataset.resolve,r=await api('/api/drop/'+el.dataset.id+'/resolve',{method:'POST',body:JSON.stringify({action})});
   applyUserLocal(r.user);if(state.home){state.home.pending=null;state.home.last=r.instance}
   toast(action==='keep'?'Добавлено в коллекцию':'Username продан');state.busy=false;render();return
 }
 if(el.dataset.pager){const d=Number(el.dataset.dir);if(el.dataset.pager==='collection'){state.filters.page+=d;state.collection=await api('/api/collection?sort='+state.filters.sort+'&digits='+state.filters.digits+'&page='+state.filters.page);render()}if(el.dataset.pager==='market'){state.marketFilters.page+=d;state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page='+state.marketFilters.page);render()}if(el.dataset.pager==='rank'){state.rankPage+=d;render()}return}
 if(el.dataset.marketBuy){const id=el.dataset.marketBuy,r=await api('/api/market/'+id+'/buy',{method:'POST'});removeMarketLocal(id);toast('Куплено '+r.handle);await refreshUser();render();return}
 if(el.dataset.marketCancel){const id=el.dataset.marketCancel;await api('/api/market/'+id+'/cancel',{method:'POST'});removeMarketLocal(id);toast('Лот снят');render();return}
 if(el.dataset.taskChannelOpen){
   const url=String(el.dataset.taskChannelOpen||'');if(!url)return;
   if(typeof TG?.openTelegramLink==='function')TG.openTelegramLink(url);else window.open(url,'_blank','noopener');return
 }
 if(el.hasAttribute('data-task-channel-verify')){
   el.disabled=true;
   const r=await api('/api/tasks/channel/verify',{method:'POST',body:'{}'});
   state.tasks=r;haptic('medium');toast('Подписка подтверждена');render();return
 }
 if(el.dataset.claim){
   const key=String(el.dataset.claim||'');if(!key||el.disabled)return;
   el.disabled=true;el.classList.add('is-claiming');
   const r=await api('/api/tasks/'+key+'/claim',{method:'POST'});
   applyUserLocal(r.user);state.tasks=await api('/api/tasks');haptic('light');toast('+'+fmt(r.reward));render();return
 }
 if(el.dataset.profile){const r=await api('/api/profile/'+el.dataset.profile);state.backPage='top';state.page='profile';state.profile=r;render();return}
 if(el.dataset.detail){const item=state.collection?.items.find(x=>x.id===el.dataset.detail);if(item){state.backPage='collection';state.detail=item;state.page='detail';render()}return}
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
 if(el.hasAttribute('data-gift')){
   const instanceId=state.giftSelectedItem,recipientUsername=String(document.querySelector('#giftRecipientUsername')?.value||state.giftRecipientUsername||'').trim();
   if(!instanceId||!recipientUsername){toast('Введите @username');return}
   try{
    const r=await api('/api/gift',{method:'POST',body:JSON.stringify({instanceId,recipientUsername})});
    removeGiftLocal(instanceId);removeCollectionLocal(instanceId);state.giftSelectedItem='';state.giftRecipientUsername='';await refreshUser();toast(r.handle+' → '+(r.recipientUsername||r.recipient));render();
   }catch(err){
    if(err.message==='user_not_found'){toast('Данный человек не играет в USERNAME');return}
    throw err
   }
   return
 }
 if(el.dataset.upItem){
   const id=el.dataset.upItem,max=Number(state.upgrader?.maxItems||3),list=[...(state.upgradeSelectedIds||[])],at=list.indexOf(id);
   if(at>=0)list.splice(at,1);else{if(list.length>=max){toast('Максимум '+max);return}const next=state.upgrader?.available?.find(x=>x.id===id),first=state.upgrader?.available?.find(x=>x.id===list[0]);if(first&&next&&first.rarity!==next.rarity){toast('Выбирай usernames одной редкости');return}list.push(id)}
   state.upgradeSelectedIds=list;state.upgradePreview=null;state.upgradeTargetSessionId='';state.upgradeOutcome=null;state.upgradeLastRound=null;state.upgradeLandingAngle=0;state.upgradeScrollTop=0;render();return
 }
 if(el.hasAttribute('data-upgrade-preview')){await refreshUpgradePreview();return}
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
 if(el.hasAttribute('data-back')){if(state.page==='miniGame'){await load('games');return}await load(state.backPage||'collection');return}
}catch(err){state.busy=false;toast(ERR[err.message]||'Что-то пошло не так');el.disabled=false}});
let marketSearchTimer;
document.addEventListener('input',e=>{
 if(e.target.id==='marketQuery'){clearTimeout(marketSearchTimer);const q=e.target.value||'';marketSearchTimer=setTimeout(async()=>{state.marketFilters.q=q;state.marketFilters.page=1;try{state.market=await api('/api/market?sort='+state.marketFilters.sort+'&digits='+state.marketFilters.digits+'&q='+encodeURIComponent(state.marketFilters.q)+'&page=1');render();requestAnimationFrame(()=>{const input=document.querySelector('#marketQuery');if(input){input.focus();input.setSelectionRange(q.length,q.length)}})}catch{}},320)}
 if(e.target.id==='giftRecipientUsername'){state.giftRecipientUsername=String(e.target.value||'').replace(/^@/,'').trim()}
});
document.addEventListener('scroll',e=>{
 const list=e.target;if(!list?.classList?.contains('upgrade-list'))return;
 state.upgradeScrollTop=list.scrollTop;
 const remaining=list.scrollHeight-list.scrollTop-list.clientHeight;
 if(remaining<310)appendUpgradeBatch();
},true);
window.USERNAME_APP={state,api,render,icon,esc,fmt,metric,refreshUser,toast,ERR};
applyPreferences();
import('/admin-ui.js?v=7.5.0').catch(()=>{});
const deepPage=(()=>{const m=startParam().match(/^page_(home|collection|market|top|tasks|levels|achievements|notifications|settings|wheel|friends|gift|upgrader|profile|shop|promo|games|admin)$/);return m?m[1]:'home'})();
load(deepPage);
