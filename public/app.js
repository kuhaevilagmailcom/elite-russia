function crashRoster(bets){
 const list=(bets||[]).slice(-CRASH_VISIBLE_PLAYERS).reverse();
 return list.length?list.map(b=>
  '<div class="crash-bet-row"><span class="crash-player-name">'+esc(b.player)+'</span>'+
  '<span class="crash-stake-summary"><b>'+esc(b.handle)+'</b><small>'+fmt(b.value)+'</small></span></div>'
 ).join(''):'<div class="crash-empty">Пока нет ставок</div>';
}
function crashView(){
 const d=state.crash;
 if(!d)return '<div class="page-body"><div class="empty">Загрузка краша…</div></div>';
 const r=d.round,waiting=r.status==='waiting',running=r.status==='running',bet=d.myBet,selected=waiting&&!bet;
 const available=(d.available||[]).map(x=>
  '<button class="crash-item" data-crash-bet="'+esc(x.id)+'" '+(state.crashBusy?'disabled':'')+'><span><b>'+esc(x.handle)+'</b><small>'+fmt(x.value)+'</small></span><span class="crash-item-plus">+</span></button>'
 ).join('');
 const firstPreview=crashRewardPreview(d.myRewardPlan,1,bet?.value)||{handle:bet?.handle||'@username',value:bet?.value||0};
 return '<div class="crash-page" data-crash-round="'+r.id+'">'+
  '<div class="crash-caption"><span class="crash-live-dot"></span><b>КРАШ</b><span>до ×1000</span></div>'+
  '<div class="crash-stage '+(waiting?'waiting':'flying')+'">'+
    '<div class="crash-stage-grid"></div><div class="crash-flight-rail"></div>'+
    '<div class="crash-skyline"><span id="crashFlyName">'+esc(firstPreview.handle)+'</span><small id="crashFlyPrice">'+(bet?fmt(firstPreview.value):'Выбери ставку')+'</small><span class="crash-thruster"></span></div>'+
    '<div class="crash-stage-multiplier" id="crashMultiplier">×1.00</div>'+
    '<div class="crash-stage-sub" id="crashStatus">'+(waiting?'Старт через <b id="crashCountdown">10.0</b> с':'Успей забрать')+'</div>'+
    '<div class="crash-explosion" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'+
  '</div>'+
  (bet?'<div class="crash-mybet"><div><small>Твоя ставка</small><b>'+esc(bet.handle)+'</b><span>'+fmt(bet.value)+'</span></div>'+
     (running&&bet.status==='staked'?'<button class="crash-cashout" data-crash-cashout '+(state.crashBusy?'disabled':'')+'>Забрать <b id="crashCashout">×1.00</b></button>':
      bet.status==='cashed'?'<div class="crash-cashed">'+(d.myWin?'<b>'+esc(d.myWin.handle)+'</b><small>'+fmt(d.myWin.value)+'</small>':'Забрано ×'+Number(bet.cashoutX).toFixed(2))+'</div>':
      '<div class="crash-queued">'+(waiting?'Ждём старта':'Ставка в игре')+'</div>')+'</div>':'')+
  (selected?'<div class="crash-choice"><div class="crash-choice-head"><b>Твоя ставка</b><span>Выбери username</span></div>'+
    '<div class="crash-available">'+(available||'<div class="crash-empty">Нет доступных usernames</div>')+'</div></div>':'')+
  '<div class="crash-participants"><div class="crash-participants-head"><b>Участники</b><span id="crashParticipantsCount">'+
    (d.bets.length>CRASH_VISIBLE_PLAYERS?'Последние '+CRASH_VISIBLE_PLAYERS:d.bets.length+' ставок')+'</span></div>'+
   '<div id="crashBets" class="crash-bet-list">'+crashRoster(d.bets)+'</div></div>'+
  (state.crashLastReward?'<p class="crash-mini-note crash-earned">Получен <b>'+esc(state.crashLastReward.handle)+'</b> · '+fmt(state.crashLastReward.value)+'</p>':
    '<p class="crash-mini-note">Забери новый username до взрыва · старая ставка заменяется</p>')+
  '</div>';
}
let crashTickerBusy=false,crashLoopOn=false,crashVisualOffset=0,crashKnownPrevious=0;
function startCrashVisualLoop(){
 if(crashLoopOn)return;crashLoopOn=true;
 const frame=()=>{
  if(state.page!=='crash'){crashLoopOn=false;return}
  const d=state.crash,r=d?.round,stage=document.querySelector('.crash-stage');
  if(r&&stage){
   const at=Date.now()+crashVisualOffset,elapsed=Math.max(0,(at-r.startsAt)/1000),running=r.status==='running';
   const mult=running?Math.min(1000,Math.floor(Math.exp(elapsed*.115)*100)/100):1;
   const show=document.querySelector('#crashMultiplier');if(show)show.textContent='×'+mult.toFixed(2);
   const cash=document.querySelector('#crashCashout');if(cash)cash.textContent='×'+mult.toFixed(2);
   const remain=Math.max(0,(r.startsAt-at)/1000);
   const countdown=document.querySelector('#crashCountdown');if(countdown)countdown.textContent=remain.toFixed(1);
   const progress=running?Math.min(1,Math.log(Math.max(1,mult))/Math.log(1000)):0;
   const flying=document.querySelector('.crash-skyline');
   if(flying){
    // Move along a rising diagonal guide, keeping long names inside the stage.
    const startingX=stage.clientWidth*.10;
    const maxX=Math.max(0,stage.clientWidth-startingX-flying.offsetWidth-10);
    const maxDx=Math.min(stage.clientWidth*.54,maxX);
    const maxDy=Math.min(stage.clientHeight*.43,100,
      Math.max(0,stage.clientHeight-23-flying.offsetHeight-12));
    const dx=maxDx*progress,dy=-maxDy*progress;
    // The visual guide follows exactly the same diagonal on every viewport.
    stage.style.setProperty('--crash-line-length',Math.hypot(maxDx,maxDy).toFixed(1)+'px');
    stage.style.setProperty('--crash-line-angle',(-Math.atan2(maxDy,Math.max(1,maxDx))*180/Math.PI).toFixed(1)+'deg');
    flying.style.setProperty('--crash-x',dx.toFixed(1)+'px');
    flying.style.setProperty('--crash-y',dy.toFixed(1)+'px');
    const won=d.myWin;
    const preview=won||crashRewardPreview(d.myRewardPlan,running?mult:1,d.myBet?.value);
    const label=document.querySelector('#crashFlyName');
    const price=document.querySelector('#crashFlyPrice');
    if(label&&preview&&label.textContent!==preview.handle)label.textContent=preview.handle;
    const val=preview?fmt(preview.value):(d.myBet?fmt(d.myBet.value):'Выбери ставку');
    if(price&&price.textContent!==val)price.textContent=val;
   }
   stage.classList.toggle('exploded',Date.now()<Number(state.crashBlastUntil||0));
  }
  requestAnimationFrame(frame);
 };
 requestAnimationFrame(frame);
}
async function refreshCrashLive(){
 if(state.page!=='crash'||crashTickerBusy)return;
 crashTickerBusy=true;
 try{
  const next=await api('/api/crash');
  const previous=state.crash;
  crashVisualOffset=next.round.serverNow-Date.now();
  const nextLast=next.last?.id||0;
  if(previous&&next.round.id!==previous.round.id&&nextLast===previous.round.id)
    state.crashBlastUntil=Date.now()+850;
  crashKnownPrevious=nextLast;
  const rerender=!previous||next.round.id!==previous.round.id||next.round.status!==previous.round.status||
    (next.myBet?.status||'')!==(previous.myBet?.status||'')||
    (next.myBet?.id||0)!==(previous.myBet?.id||0);
  state.crash=next;
  if(rerender)render();
  else{
   const roster=document.querySelector('#crashBets');if(roster)roster.innerHTML=crashRoster(next.bets);
   const count=document.querySelector('#crashParticipantsCount');
   if(count)count.textContent=next.bets.length>CRASH_VISIBLE_PLAYERS?'Последние '+CRASH_VISIBLE_PLAYERS:next.bets.length+' ставок';
  }
  startCrashVisualLoop();
 }catch(e){console.warn('Crash refresh:',e.message)}
 finally{crashTickerBusy=false}
}
setInterval(()=>{void refreshCrashLive()},850);
function crashRoster(bets){
 const list=(bets||[]).slice(-CRASH_VISIBLE_PLAYERS).reverse();
 return list.length?list.map(b=>
  '<div class="crash-bet-row"><span class="crash-player-name">'+esc(b.player)+'</span>'+
  '<span class="crash-stake-summary"><b>'+esc(b.handle)+'</b><small>'+fmt(b.value)+'</small></span></div>'
 ).join(''):'<div class="crash-empty">Пока нет ставок</div>';
}
function crashAutoControls(d,bet,waiting){
 const selected=bet?.status==='staked'?bet.autoStopX:d.autoStopX;
 const presets=[1.5,2,2.5];
 const custom=selected!==null&&selected!==undefined&&!presets.some(x=>x===Number(selected));
 return '<div class="crash-auto"><div class="crash-auto-title"><b>Автостоп</b><span>'+
  (selected===null||selected===undefined?'Выкл.':'×'+Number(selected).toFixed(2))+'</span></div>'+
  '<div class="crash-auto-presets">'+
   '<button class="crash-auto-chip '+(selected==null?'active':'')+'" data-crash-autostop="off">Выкл.</button>'+
   presets.map(x=>'<button class="crash-auto-chip '+(selected===x?'active':'')+'" data-crash-autostop="'+x+'">×'+x.toFixed(2)+'</button>').join('')+
   '<button class="crash-auto-chip '+(custom||state.crashCustomOpen?'active':'')+'" data-crash-autostop-custom>Свой ×</button>'+
  '</div>'+
  (state.crashCustomOpen?'<div class="crash-auto-entry"><input id="crashAutoInput" type="text" inputmode="decimal" maxlength="7" placeholder="Напр. 3,75" value="'+(custom?Number(selected).toFixed(2):'')+'"><button data-crash-autostop-save>Сохранить</button></div>':'')+
  '</div>';
}
function crashView(){
 const d=state.crash;if(!d)return '<div class="page-body"><div class="empty">Загрузка краша…</div></div>';
 const r=d.round,waiting=r.status==='waiting',running=r.status==='running',bet=d.myBet,canBet=waiting&&!bet;
 const available=(d.available||[]).map(x=>
  '<button class="crash-item" data-crash-bet="'+esc(x.id)+'" '+(state.crashBusy?'disabled':'')+'><span><b>'+esc(x.handle)+'</b><small>'+fmt(x.value)+'</small></span><span class="crash-item-plus">+</span></button>'
 ).join('');
 const first=crashRewardPreview(d.myRewardPlan,1,bet?.value)||{handle:bet?.handle||'@username',value:bet?.value||0};
 return '<div class="crash-page" data-crash-round="'+r.id+'">'+
  '<div class="crash-caption"><span class="crash-live-dot"></span><b>Краш</b><span>Макс. ×1000</span></div>'+
  '<div class="crash-stage '+(waiting?'waiting':'flying')+'">'+
   '<div class="crash-stage-grid"></div>'+
   '<svg class="crash-graph" id="crashGraphSvg" aria-hidden="true" viewBox="0 0 400 200" preserveAspectRatio="none">'+
    '<defs><linearGradient id="crashLineColor" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#246ab4"/><stop offset="75%" stop-color="#48bbf7"/><stop offset="100%" stop-color="#b1e9ff"/></linearGradient></defs>'+
    '<path id="crashGuide" class="crash-guide" d=""/><path id="crashTrack" class="crash-track" d=""/>'+
   '</svg>'+
   '<div class="crash-stage-header"><strong id="crashMultiplier">×1.00</strong><span id="crashStatus">'+
    (waiting?'Старт через <b id="crashCountdown">10.0</b> с':'Успей забрать')+'</span></div>'+
   '<div class="crash-skyline"><span id="crashFlyName">'+esc(first.handle)+'</span>'+
    '<small id="crashFlyPrice">'+(bet?fmt(first.value):'Выбери ставку')+'</small></div>'+
   '<div class="crash-explosion" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><strong>КРАШ</strong><b>×'+Number(state.crashLastExplosionX||1).toFixed(2)+'</b></div>'+
   '<div class="crash-stage-foot"><span>USERNAME</span><span>CRASH</span></div>'+
  '</div>'+
  '<section class="crash-controls">'+
   (bet?'<div class="crash-mybet"><div><small>Поставлено</small><b>'+esc(bet.handle)+'</b><span>'+fmt(bet.value)+
     (bet.autoStopX?' · Автостоп ×'+Number(bet.autoStopX).toFixed(2):'')+'</span></div>'+
     (running&&bet.status==='staked'?'<button class="crash-cashout" data-crash-cashout '+(state.crashBusy?'disabled':'')+'>Забрать <b id="crashCashout">×1.00</b></button>':
       bet.status==='cashed'?'<div class="crash-cashed"><b>'+esc(d.myWin?.handle||'Забрано')+'</b><small>'+fmt(d.myWin?.value||0)+(bet.settlementKind==='auto'?' · Авто':'')+'</small></div>':
       '<div class="crash-queued">'+(waiting?'Ожидание':'В игре')+'</div>')+'</div>':
       (canBet?'<div class="crash-choice"><div class="crash-choice-head"><b>Выбери username для ставки</b></div>'+
        '<div class="crash-available">'+(available||'<div class="crash-empty">Нет доступных usernames</div>')+'</div></div>':
        '<div class="crash-queued">Ставки откроются через несколько секунд</div>'))+
   crashAutoControls(d,bet,waiting)+
  '</section>'+
  '<section class="crash-participants"><div class="crash-participants-head"><b>Участники</b><span id="crashParticipantsCount">'+
   (d.bets.length>CRASH_VISIBLE_PLAYERS?'Последние '+CRASH_VISIBLE_PLAYERS:d.bets.length+' ставок')+'</span></div>'+
   '<div id="crashBets" class="crash-bet-list">'+crashRoster(d.bets)+'</div></section>'+
  (state.crashLastReward?'<p class="crash-mini-note crash-earned">Получен <b>'+esc(state.crashLastReward.handle)+'</b> · '+fmt(state.crashLastReward.value)+'</p>':
   '<p class="crash-mini-note">Выигрыш — новый username · Старый расходуется</p>')+
 '</div>';
}
let crashTickerBusy=false,crashLoopOn=false,crashVisualOffset=0;
let crashActiveRoundId=0;
function crashBezierPoint(p,w,h){
 const x0=w*.13,y0=h-31,x3=w*.78,y3=h*.31;
 const dx=x3-x0,dy=y0-y3;
 const a={x:x0,y:y0},b={x:x0+dx*.24,y:y0-dy*.055},c={x:x0+dx*.77,y:y0-dy*.88},d={x:x3,y:y3};
 const z=1-p,z2=z*z,p2=p*p;
 return {x:z2*z*a.x+3*z2*p*b.x+3*z*p2*c.x+p2*p*d.x,
         y:z2*z*a.y+3*z2*p*b.y+3*z*p2*c.y+p2*p*d.y};
}
function startCrashVisualLoop(){
 if(crashLoopOn)return;crashLoopOn=true;
 let lastPathProgress=-1,lastW=0,lastH=0;
 const frame=()=>{
  if(state.page!=='crash'){crashLoopOn=false;return}
  const d=state.crash,r=d?.round,stage=document.querySelector('.crash-stage');
  if(r&&stage){
   const now=Date.now()+crashVisualOffset,elapsed=Math.max(0,(now-r.startsAt)/1000),running=r.status==='running';
   const mult=running?Math.min(1000,Math.floor(Math.exp(elapsed*.115)*100)/100):1;
   const multiplier=document.querySelector('#crashMultiplier');if(multiplier)multiplier.textContent='×'+mult.toFixed(2);
   const cashout=document.querySelector('#crashCashout');if(cashout)cashout.textContent='×'+mult.toFixed(2);
   const remain=Math.max(0,(r.startsAt-now)/1000);
   const countdown=document.querySelector('#crashCountdown');if(countdown)countdown.textContent=remain.toFixed(1);
   const status=document.querySelector('#crashStatus');
   if(status&&running&&status.textContent!=='Успей забрать')status.textContent='Успей забрать';
   const w=stage.clientWidth,h=stage.clientHeight;
   // Ease path visibility for early rounds without changing the server factor.
   const raw=Math.min(1,Math.log(Math.max(1,mult))/Math.log(1000));
   const progress=running?Math.pow(raw,.57):0;
   const motion=motionEnabled()&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const p=motion?progress:Math.min(1,progress);
   const point=crashBezierPoint(p,w,h),flight=document.querySelector('.crash-skyline');
   if(flight){
    const x=Math.min(w-flight.offsetWidth-8,Math.max(8,point.x-flight.offsetWidth/2));
    const y=Math.min(h-flight.offsetHeight-7,Math.max(12,point.y-flight.offsetHeight*.68));
    flight.style.setProperty('--crash-x',x.toFixed(1)+'px');
    flight.style.setProperty('--crash-y',y.toFixed(1)+'px');
    const reward=d.myWin||crashRewardPreview(d.myRewardPlan,running?mult:1,d.myBet?.value);
    const name=document.querySelector('#crashFlyName'),price=document.querySelector('#crashFlyPrice');
    if(reward&&name&&name.textContent!==reward.handle){
     name.classList.remove('crash-name-switch');void name.offsetWidth;name.classList.add('crash-name-switch');
     name.textContent=reward.handle;
    }
    const value=reward?fmt(reward.value):(d.myBet?fmt(d.myBet.value):'Выбери ставку');
    if(price&&price.textContent!==value)price.textContent=value;
   }
   const svg=document.querySelector('#crashGraphSvg'),guide=document.querySelector('#crashGuide'),track=document.querySelector('#crashTrack');
   if(svg&&guide&&track&&(Math.abs(p-lastPathProgress)>.002||w!==lastW||h!==lastH)){
    svg.setAttribute('viewBox','0 0 '+w+' '+h);
    const pathFor=(end)=>{
     let path='';const samples=Math.max(1,Math.ceil(44*end));
     for(let i=0;i<=samples;i++){
      const pt=crashBezierPoint(end*i/samples,w,h);
      path+=(i===0?'M':' L')+pt.x.toFixed(1)+' '+pt.y.toFixed(1);
     }
     return path;
    };
    guide.setAttribute('d',pathFor(1));track.setAttribute('d',pathFor(p));
    lastPathProgress=p;lastW=w;lastH=h;
   }
   stage.classList.toggle('exploded',Date.now()<Number(state.crashBlastUntil||0));
  }
  requestAnimationFrame(frame);
 };
 requestAnimationFrame(frame);
}
async function refreshCrashLive(){
 if(state.page!=='crash'||crashTickerBusy)return;
 crashTickerBusy=true;
 try{
  const next=await api('/api/crash');
  const previous=state.crash;
  crashVisualOffset=next.round.serverNow-Date.now();
  if(previous&&previous.round.id!==next.round.id&&next.last?.id===previous.round.id){
   state.crashBlastUntil=Date.now()+920;
   state.crashLastExplosionX=next.last.multiplier;
   crashSound('crash');
  }
  if(previous&&previous.round.status==='waiting'&&next.round.status==='running'&&previous.round.id===next.round.id)
   crashSound('start');
  if(previous&&previous.myBet?.status==='staked'&&next.myBet?.status==='cashed'&&next.myBet.settlementKind==='auto'){
   state.crashLastReward=next.myWin;
   crashSound('auto');
   if(next.myWin)toast('Автостоп: '+next.myWin.handle+' · '+fmt(next.myWin.value));
  }
  const change=!previous||previous.round.id!==next.round.id||previous.round.status!==next.round.status||
   previous.myBet?.status!==next.myBet?.status||previous.myBet?.id!==next.myBet?.id||
   previous.myBet?.autoStopX!==next.myBet?.autoStopX||
   previous.autoStopX!==next.autoStopX;
  state.crash=next;
  if(change)render();
  else{
   const roster=document.querySelector('#crashBets');if(roster&&roster.dataset.signature!==JSON.stringify(next.bets.slice(-CRASH_VISIBLE_PLAYERS).map(b=>[b.id,b.status]))){
    roster.innerHTML=crashRoster(next.bets);
    roster.dataset.signature=JSON.stringify(next.bets.slice(-CRASH_VISIBLE_PLAYERS).map(b=>[b.id,b.status]));
   }
   const count=document.querySelector('#crashParticipantsCount');if(count)count.textContent=next.bets.length>CRASH_VISIBLE_PLAYERS?'Последние '+CRASH_VISIBLE_PLAYERS:next.bets.length+' ставок';
  }
  if(next.round.id!==crashActiveRoundId){crashActiveRoundId=next.round.id;state.crashBusy=false}
  startCrashVisualLoop();
 }catch(e){console.warn('Crash refresh:',e.message)}
 finally{crashTickerBusy=false}
}
setInterval(()=>{void refreshCrashLive()},900);

function homeView(){
 const h=state.home,u=h.user,p=h.pending,tiers=h.config?.dropTiers||{},tier=selectedDropTier(),free=u.freeDrops>0&&tier.key==='basic',payCost=free?0:Number(tier.cost||3000),cantAfford=!free&&u.balance<payCost;
 return '<div class="home-v7">'+
  '<section class="home-level-v7">'+xpBar(u)+'</section>'+
  (!p?'<div class="home-stake-top"><button class="drop-price-v7" data-drop-picker-open aria-label="Выбрать стоимость дропа"><span>'+fmt(tier.cost)+'</span><span class="drop-price-chevron" aria-hidden="true"></span></button></div>':'')+
  '<section class="drop-zone home-drop-v7">'+
    (p?resultCard(p,true):'<button class="handle-stage drop-trigger" id="handleStage" data-drop-trigger '+(cantAfford?'disabled':'')+' aria-label="Получить username"><b data-fit-username data-max-size="58" data-min-size="25">@username</b><span>Нажми, чтобы получить</span></button>')+
  '</section>'+
  (!p?'<section class="home-quick-v7"><button class="home-quick-action" data-page="upgrader"><span class="home-quick-icon">'+icon('upgrade')+'</span><div><b>Апгрейдер</b><small>Улучшить username</small></div>'+icon('chevron')+'</button><button class="home-quick-action" data-page="crash"><span class="home-quick-icon">'+icon('upgrade')+'</span><div><b>Краш</b><small>Общий раунд · ×1000</small></div>'+icon('chevron')+'</button></section>':'')+
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
function iconRaw(name){return '<i class="ico hugeicon hgi-stroke hgi-'+name+'" aria-hidden="true"></i>'}
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
 else if(page==='crash')shell('Краш',crashView());
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
const PAGE_TITLE={crash:'Краш',home:'USERNAME',collection:'Коллекция',market:'Рынок',top:'Топ',tasks:'Задания',levels:'Уровни',achievements:'Достижения',notifications:'Уведомления',settings:'Настройки',wheel:'Колесо',friends:'Друзья',gift:'Подарки',upgrader:'Апгрейдер',seasons:'Сезоны',profile:'Профиль',shop:'Магазин',promo:'Промокод',games:'Игры',miniGame:'Игра',admin:'Админка'};
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
  page==='crash'?!!state.crash:
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
 if(page==='crash')state.crash=await api('/api/crash');
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
 if(page==='admin'){if(!state.user?.isAdmin)throw new Error('forbidden');state.adminDetail=null;await ensureAdminUi();if(!window.USERNAME_ADMIN?.refresh)throw new Error('network');await window.USERNAME_ADMIN.refresh()}
}
async function load(page,{force=false}={}){
 const seq=++routeSeq,initial=!window.__USERNAME_READY||!state.user;
 state.menu=false;state.dropPicker=false;if(page!=='miniGame')state.gameFeedback=null;
 const fresh=pageReady(page)&&Date.now()-Number(state.pageLoadedAt[page]||0)<PAGE_CACHE_TTL;
 if(fresh&&!force){state.page=page;render();return}
 if(!initial)routeLoading(true);
 try{
  await fetchPage(page);if(seq!==routeSeq)return;
  state.page=page;state.pageLoadedAt[page]=Date.now();render();if(page==='crash'){crashVisualOffset=state.crash.round.serverNow-Date.now();startCrashVisualLoop()}
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
  if(!user)return;
  // /api/home is the trusted source of the admin flag. Game mutation APIs
  // return publicUser without isAdmin; preserve the verified flag only for
  // the same user instead of accidentally hiding the admin menu.
  const previous=state.user;
  const sameAccount=previous&&String(previous.id)===String(user.id)&&String(previous.telegramId)===String(user.telegramId);
  const next={...user};
  if(sameAccount&&previous.isAdmin===true&&!Object.hasOwn(user,'isAdmin'))next.isAdmin=true;
  if(sameAccount&&!Object.hasOwn(user,'unreadNotifications')&&previous.unreadNotifications!==undefined)next.unreadNotifications=previous.unreadNotifications;
  state.user=next;
  if(state.home)state.home.user=next;
  applyPreferences();
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
 if(el.hasAttribute('data-crash-autostop-custom')){
   state.crashCustomOpen=!state.crashCustomOpen;render();
   if(state.crashCustomOpen)document.querySelector('#crashAutoInput')?.focus();
   return;
 }
 if(el.hasAttribute('data-crash-autostop-save')||el.hasAttribute('data-crash-autostop')){
   if(state.crashBusy)return;
   const value=el.hasAttribute('data-crash-autostop-save')?
     String(document.querySelector('#crashAutoInput')?.value||'').trim():el.dataset.crashAutostop;
   if(el.hasAttribute('data-crash-autostop-save')&&!value){toast('Введи свой множитель');return}
   state.crashBusy=true;el.disabled=true;
   try{
     const result=await api('/api/crash/autostop',{method:'POST',
       body:JSON.stringify({value:value==='off'?null:value})});
     state.crashCustomOpen=false;
     crashSound('bet');
     toast(result.autoStopX?'Автостоп ×'+Number(result.autoStopX).toFixed(2):'Автостоп выключен');
     await load('crash',{force:true});
   }finally{state.crashBusy=false;el.disabled=false}
   return;
 }
 if(el.dataset.crashBet){
   if(state.crashBusy)return;
   state.crashBusy=true;el.disabled=true;
   try{
     await api('/api/crash/bet',{method:'POST',body:JSON.stringify({instanceId:el.dataset.crashBet,roundId:state.crash.round.id})});
     state.crashLastReward=null;crashSound('bet');toast('Username поставлен');await refreshUser();await load('crash',{force:true});
   }finally{state.crashBusy=false;el.disabled=false}
   return
 }
 if(el.hasAttribute('data-crash-cashout')){
   if(state.crashBusy)return;
   state.crashBusy=true;el.disabled=true;
   try{
     const payout=await api('/api/crash/cashout',{method:'POST',body:JSON.stringify({roundId:state.crash.round.id})});
     if(payout.reward){
       state.crashLastReward=payout.reward;
       toast('Получен '+payout.reward.handle+' · '+fmt(payout.reward.value));
     }else{
       toast('Старая ставка уже обработана');
     }
     crashSound('cashout');await refreshUser();await load('crash',{force:true});
   }finally{state.crashBusy=false;el.disabled=false}
   return
 }
 if(el.dataset.page){state.dropPicker=false;await load(el.dataset.page);return}
 if(el.hasAttribute('data-drop-picker-open')){state.dropPicker=true;render();return}
 if(el.dataset.dropTier){state.dropTier=el.dataset.dropTier;state.dropPicker=false;render();return}
 if(el.hasAttribute('data-drop-trigger')&&!state.busy){
   state.busy=true;el.disabled=true;
   const requestId=crypto.randomUUID?.()||('req-'+Date.now()+'-'+Math.random().toString(36).slice(2));
   try{
     const payload={method:'POST',body:JSON.stringify({requestId,tier:state.dropTier})};
     let r;
     try{r=await api('/api/drop',payload)}
     catch(err){
       // Retry ONLY generation exhaustion, using the SAME requestId.
       // If the first request somehow committed, createDrop returns its result
       // without charging again. Network errors are reconciled below instead.
       if(err.message!=='no_username_available')throw err;
       r=await api('/api/drop',payload);
     }
     applyUserLocal(r.user);
     await animateDrop(r.instance);
   }catch(e){
     if(e.message==='network'){
       // A timeout may happen after the server has committed the drop.
       try{
         state.home=await api('/api/home');
         applyUserLocal(state.home.user);
         render();
         if(state.home.pending){toast('Дроп сохранён — открой свой username');return}
       }catch{}
     }
     throw e;
   }finally{
     state.busy=false;
     el.disabled=false;
   }
   return
 }
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
let adminUiPromise;
function ensureAdminUi(){
  if(window.USERNAME_ADMIN?.refresh)return Promise.resolve(window.USERNAME_ADMIN);
  if(!adminUiPromise){
    adminUiPromise=import('/admin-ui.js?v=7.5.0-admin-fix1')
      .catch(e=>{adminUiPromise=null;console.error('USERNAME admin module failed to load:',e);throw e});
  }
  return adminUiPromise;
}
// Eager for fast navigation, but retryable when the user opens Admin.
void ensureAdminUi().catch(()=>{});
const deepPage=(()=>{const m=startParam().match(/^page_(home|crash|collection|market|top|tasks|levels|achievements|notifications|settings|wheel|friends|gift|upgrader|profile|shop|promo|games|admin)$/);return m?m[1]:'home'})();
load(deepPage);
