const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (v) => {
  if (v == null) return "—";
  let n = BigInt(v),
    s = n < 0n ? "-" : "";
  if (n < 0n) n = -n;
  return (
    s +
    n / 1000000000n +
    "." +
    String(n % 1000000000n)
      .padStart(9, "0")
      .replace(/0+$/, "")
      .padEnd(2, "0")
  );
};
const state = {
  page: "home",
  tab: "store",
  query: "",
  collection: "",
  model: "",
  backdrop: "",
  symbol: "",
  max: "",
  sort: "new",
  cart: new Map(),
  market: [],
  activity: [],
  orderbook: [],
  bundles: [],
  analytics: [],
  collectibles: [],
  personalGifts: [],
  giveaways: [],
  me: null,
  config: { demo: true },
  token: sessionStorage.getItem("mm-session") || "",
};
const cur = () =>
  `${state.config.demo ? "TEST " : ""}${state.config.currency || "GRAM"}`;
let tonUI;
const icons = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z" fill="currentColor" stroke-linejoin="round"/>',
  sales: '<path d="m13 3 8 8-4 4-8-8zM12 10 3 19l2 2 9-9M15 21h7"/>',
  wallet: '<path d="M4 7V5l13-3 1 5M3 7h17a1 1 0 0 1 1 1v12H3zM21 12h-6a3 3 0 0 0 0 6h6M16 15h.1"/>',
  star: '<path d="m12 2 3 6 7 .9-5 5 1 7-6-3.3L6 21l1-7-5-5L9 8z" fill="currentColor"/>',
  offers: '<path d="M3 5h13l4 4-9 10-8-8zM8 9h.1"/>',
  market: '<path d="M3 9l2-5h14l2 5v12H3zM3 9h18M9 13v4m6-4v4"/>',
  activity: '<path d="M3 17l5-5 4 3 8-10M15 5h5v5"/>',
  inventory:
    '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M2 8h20M12 8C3 8 5 1 9 4l3 4c9 0 7-7 3-4z"/>',
  giveaways:
    '<path d="M4 10h16v11H4zM2 7h20v3H2zM12 7v14M12 7C5 7 6 2 9 3c2 1 3 4 3 4zm0 0c7 0 6-5 3-4-2 1-3 4-3 4z"/>',
  profile: '<circle cx="12" cy="7" r="4" fill="currentColor" stroke="none"/><path d="M3 21v-2a9 9 0 0118 0v2z" fill="currentColor" stroke="none"/>',
  cart: '<path d="M2 3h3l3 12h11l3-9H6M9 20h.01M19 20h.01"/>',
};
const icon = (n) => window.MM_ICONS?.[n] || `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || ""}</svg>`;
const uiIcon = (name) =>
  ({
    plus: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>',
    cart: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2 11h11l2-8H6M9 20h.01M18 20h.01"/></svg>',
    filter: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  })[name] || "";
const colors = {
  Mint: ["#87c9a2", "#326e59"],
  Indigo: ["#7790c4", "#414d88"],
  Rose: ["#e7a0b2", "#a04d69"],
  Violet: ["#b197dd", "#65478f"],
  Peach: ["#eeb78e", "#ac7455"],
  Slate: ["#92a5b5", "#4d647b"],
  Sky: ["#94c8e7", "#507da5"],
};
const artwork = {
  frog: '<ellipse cx="80" cy="106" rx="53" ry="37" fill="#56a94d"/><circle cx="46" cy="60" r="24" fill="#6cc358"/><circle cx="114" cy="60" r="24" fill="#6cc358"/><ellipse cx="80" cy="88" rx="56" ry="40" fill="#7bd361"/><ellipse cx="46" cy="61" rx="16" ry="18" fill="#fff9d5"/><ellipse cx="114" cy="61" rx="16" ry="18" fill="#fff9d5"/><circle cx="50" cy="63" r="8" fill="#23352a"/><circle cx="110" cy="63" r="8" fill="#23352a"/><path d="M46 91Q80 115 114 91" fill="none" stroke="#39672d" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="119" rx="31" ry="15" fill="#d6e7a2"/>',
  cap: '<path d="M20 91Q20 32 76 33q49 0 54 55l-7 15H31z" fill="#232841" stroke="#414c73" stroke-width="3"/><path d="M29 91Q98 75 148 105q8 14-27 18L31 109z" fill="#151c31"/><path d="M76 34v52" stroke="#4a5778" stroke-width="3"/><path d="M62 65l14-12 14 12-14 12z" fill="#e7bc64"/>',
  heart:
    '<path d="M80 136C66 122 20 92 20 61q0-28 29-29 20 0 31 21 11-21 31-21 29 0 29 29 0 31-60 75z" fill="#e9a3a0" stroke="#ffdcab" stroke-width="8"/><path d="M80 56v68" stroke="#ad6865" stroke-width="3"/><circle cx="80" cy="92" r="13" fill="#fce6b7"/><path d="M77 90h6v14h-6z" fill="#885a44"/>',
  crystal:
    '<path d="M80 11L132 51 114 115 80 150 38 116 22 51z" fill="#b3b5ff" stroke="#e3d9ff" stroke-width="3"/><path d="M80 11L55 61 80 150 106 61z" fill="#7762c9"/><path d="M22 51l33 10 25-50-58 40m110 0-26 10-26-50z" fill="#e0d7ff"/><path d="M55 61l25 89-42-34z" fill="#9b83e2"/><path d="M106 61l8 54-34 35z" fill="#5f50a9"/>',
  bunny:
    '<ellipse cx="53" cy="42" rx="18" ry="36" transform="rotate(-12 53 42)" fill="#f5ebdc"/><ellipse cx="107" cy="42" rx="18" ry="36" transform="rotate(12 107 42)" fill="#f5ebdc"/><ellipse cx="53" cy="42" rx="9" ry="26" fill="#f3b6bd"/><ellipse cx="107" cy="42" rx="9" ry="26" fill="#f3b6bd"/><ellipse cx="80" cy="114" rx="49" ry="36" fill="#f1e5d4"/><ellipse cx="80" cy="88" rx="52" ry="42" fill="#fff6e8"/><circle cx="61" cy="86" r="6" fill="#473838"/><circle cx="99" cy="86" r="6" fill="#473838"/><path d="M74 98q6-8 12 0l-6 6z" fill="#dd929a"/><ellipse cx="48" cy="127" rx="19" ry="12" fill="#fff8ef"/><ellipse cx="112" cy="127" rx="19" ry="12" fill="#fff8ef"/>',
  watch:
    '<rect x="59" y="3" width="42" height="154" rx="12" fill="#aab3b9"/><path d="M60 18h40m-40 15h40m-40 94h40m-40 15h40" stroke="#65727c" stroke-width="3"/><circle cx="80" cy="80" r="43" fill="#c7cdd3" stroke="#eff2f5" stroke-width="4"/><circle cx="80" cy="80" r="34" fill="#202e43"/><path d="M80 55v25l19 10" stroke="#e7dcb0" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="80" r="4" fill="#fff"/>',
  flower:
    '<g fill="#f5b5c8" stroke="#ffd9e4" stroke-width="2"><ellipse cx="80" cy="43" rx="25" ry="36"/><ellipse cx="116" cy="69" rx="25" ry="36" transform="rotate(72 116 69)"/><ellipse cx="103" cy="111" rx="25" ry="36" transform="rotate(144 103 111)"/><ellipse cx="57" cy="111" rx="25" ry="36" transform="rotate(-144 57 111)"/><ellipse cx="44" cy="69" rx="25" ry="36" transform="rotate(-72 44 69)"/></g><circle cx="80" cy="80" r="21" fill="#f7d27c"/><circle cx="80" cy="80" r="10" fill="#d69a42"/>',
  peach:
    '<path d="M80 41q-34-22-53 14-26 54 53 91 79-37 53-91-19-36-53-14z" fill="#f4a276" stroke="#ffd0a1" stroke-width="4"/><path d="M80 43q-9 50 0 96" fill="none" stroke="#dc745c" stroke-width="3"/><path d="M80 43Q78 9 114 12q0 26-34 31M80 43Q46 10 30 32q23 23 50 11" fill="#78b765"/>',
  candy:
    '<path d="M25 65L5 39v82l20-26m110-30 20-26v82l-20-26" fill="#fac785"/><circle cx="80" cy="80" r="59" fill="#f4a2d3" stroke="#ffe2e7" stroke-width="4"/><path d="M80 80c-40-40 48-61 46-4-2 55-90 49-95 0-4-44 44-65 78-39" fill="none" stroke="#fff4d5" stroke-width="12" stroke-linecap="round"/>',
};
function art(g, buttons = true) {
  const [a, b] = colors[g.backdrop] || colors.Slate;
  const heart = state.me?.favorites.includes(g.id)
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3 16 3 9a5 5 0 019-3 5 5 0 019 3c0 7-9 12-9 12z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3 16 3 9a5 5 0 019-3 5 5 0 019 3c0 7-9 12-9 12z"/></svg>';
  return `<div class="art" style="--c1:${a};--c2:${b}" ${buttons ? `data-action="detail" data-id="${esc(g.id)}"` : ""}><span class="serial">#${esc(g.number)}</span>${buttons ? `<button class="favorite ${state.me?.favorites.includes(g.id) ? "on" : ""}" data-action="favorite" data-id="${esc(g.id)}" aria-label="Избранное">${heart}</button>` : ""}<svg viewBox="0 0 160 160" aria-hidden="true">${artwork[g.art] || ""}</svg></div>`;
}
async function api(path, options = {}) {
  const res = await fetch("/api/v1/" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + state.token,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Ошибка сервера");
  return data;
}
async function reload() {
  [
    state.market,
    state.activity,
    state.orderbook,
    state.bundles,
    state.analytics,
  ] = await Promise.all([
    api("market"),
    api("activity"),
    api("orderbook"),
    api("bundles"),
    api("analytics"),
  ]);
  if (state.token) {
    try {
      const [collectibles, giveaways] = await Promise.all([
        api("collectibles"),
        api("giveaways"),
      ]);
      state.collectibles = collectibles.items || [];
      state.giveaways = giveaways.items || [];
    } catch {
      state.collectibles = [];
      state.giveaways = [];
    }
  }
  state.personalGifts = [];
  if (state.token && !state.config.demo) {
    try {
      const response=await api("personal-gifts");state.personalGifts=response.items||[];
      if(response.enabled&&state.personalGifts.some(g=>g.mediaVersion!==4)&&state.mediaRefreshToken!==state.token){
        state.mediaRefreshToken=state.token;
        try{await api("personal-gifts/refresh-media",{method:"POST",body:"{}"});state.personalGifts=(await api("personal-gifts")).items||[];}catch{}
      }
    } catch { /* leave empty */ }
  }
  state.walletConnection=null;
  if (state.token) {
    try {
      state.me = await api("state");
      if(!state.config.demo)try{state.walletConnection=(await api("wallet/connection")).connection||null;}catch{}
    } catch (e) {
      state.token = "";
      state.me = null;
      state.personalGifts = [];
      sessionStorage.removeItem("mm-session");
    }
  }
}
let timer;
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  clearTimeout(timer);
  timer = setTimeout(() => ($("#toast").style.display = "none"), 3600);
}
function show(title, content) {
  releaseGiftMedia(modal);
  modal.innerHTML = `<div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-button sheet-close" data-action="close" aria-label="Закрыть">${icon("close")}</button></div>${content}`;
  modal.setAttribute("aria-labelledby", "sheet-title");
  if (!modal.open) modal.showModal();
  modal.scrollTop=0;
  observeGiftMedia(modal);
}
const btn = (name, action, id = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${name}</button>`;
function giftCard(g,mine=false){
 return `<article class="gift">${art(g)}<div class="info"><button class="gift-title" data-action="detail" data-id="${esc(g.id)}"><span class="name">${esc(g.collection)}</span><span class="muted">${esc(g.model||"")}</span></button><div class="price">${gramIcon()} ${g.price?fmt(g.price):g.best_offer?fmt(g.best_offer):"—"} <small>${esc(cur())}</small></div><div class="cardbuttons">${mine&&g.bundle?'<span class="muted">В составе набора</span>':mine?btn(g.listing?"Изменить":"Продать","sell",g.id,"accent")+(g.listing?btn("Снять","delist",g.id):btn(icon("more"),"detail",g.id,"icon-button")):btn("Купить","buy",g.id,"accent")+btn(uiIcon(state.cart.has(g.id)?"check":"plus"),"cart-add",g.id,"icon-button")}</div></div></article>`;
}
function giftBackdrop(g){
 const rgb=v=>Number.isInteger(v)&&v>=0&&v<=0xffffff?"#"+v.toString(16).padStart(6,"0"):null;
 const c=g.backdropColors||{},center=rgb(c.center),edge=rgb(c.edge),symbol=rgb(c.symbol);
 const pattern=typeof g.symbolMediaUrl==="string"&&/^\/api\/v1\/media\/telegram\/[A-Za-z0-9_-]{5,512}$/.test(g.symbolMediaUrl)?g.symbolMediaUrl:null;
 const styles=center&&edge?`--gift-center:${center};--gift-edge:${edge};`:"";
 const patternStyle=pattern&&symbol?`--gift-symbol:${symbol};--gift-symbol-url:url('${pattern}');`:"";
 return `<div class="gift-original-backdrop ${center&&edge?"has-colors":""}" style="${styles+patternStyle}" aria-hidden="true">${patternStyle?Array.from({length:12},(_,i)=>`<i class="gift-symbol gift-symbol-${i}"></i>`).join(""):""}</div>`;
}
function giftMedia(g) {
  const safe = (url) => typeof url === "string" && /^\/api\/v1\/media\/telegram\/[A-Za-z0-9_-]{5,512}$/.test(url);
  const image = safe(g.modelMediaUrl) ? g.modelMediaUrl : "";
  const video = safe(g.modelVideoUrl) ? g.modelVideoUrl : "";
  const animation = safe(g.modelAnimationUrl) ? g.modelAnimationUrl : "";
  const alt = esc(g.collection + " #" + g.number);
  const still = image ? `<img class="gift-media-still" src="${esc(image)}" alt="${alt}" loading="lazy">` : '<span class="gift-media-unavailable">Медиа недоступно</span>';
  const background=giftBackdrop(g);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return background+still;
  if(animation) return `${background}${still}<div class="gift-media-lottie" data-animation="${esc(animation)}" aria-label="${alt}"></div>`;
  if(!video) return background+still;
  return `${background}${still}<video class="gift-media-video" src="${esc(video)}" muted loop playsinline preload="none" aria-label="${alt}" hidden></video>`;
}
// Play only visible videos; retain the original thumbnail if playback fails.
const observedGiftVideos=new WeakSet();
const giftVideoObserver = new IntersectionObserver(entries => {
  for (const {target, isIntersecting} of entries) {
    if (!target.isConnected) { giftVideoObserver.unobserve(target); continue; }
    if (isIntersecting && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.play().catch(() => { target.hidden = true; });
    } else { target.pause(); }
  }
}, {threshold: 0.25});
const lottieInstances=new WeakMap();
const motionPreference=window.matchMedia("(prefers-reduced-motion: reduce)");
const lottieObserver=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
    const entry=lottieInstances.get(target); if(!entry) continue;
    entry.visible=isIntersecting;
    if(!isIntersecting||motionPreference.matches){entry.player?.pause();continue;}
    if(entry.player){entry.player.play();continue;}
    if(entry.loading||entry.failed||!window.lottie)continue;
    entry.loading=true;
    fetch(target.dataset.animation,{signal:entry.abort.signal}).then(res=>{
      if(!res.ok||!res.headers.get("content-type")?.includes("application/json"))throw Error("Animation unavailable");
      return res.json();
    }).then(data=>{
      if(!target.isConnected||entry.abort.signal.aborted)return;
      const player=window.lottie.loadAnimation({container:target,renderer:"svg",loop:true,autoplay:false,animationData:data,rendererSettings:{progressiveLoad:false,preserveAspectRatio:"xMidYMid meet"}});
      entry.player=player;
      player.addEventListener("DOMLoaded",()=>{if(!target.isConnected)return;target.classList.add("playing");if(entry.visible&&!motionPreference.matches)player.play();});
      player.addEventListener("data_failed",()=>{target.classList.remove("playing");entry.failed=true;player.destroy();entry.player=null;});
    }).catch(()=>{entry.failed=true;target.classList.remove("playing");}).finally(()=>{entry.loading=false;});
  }
},{threshold:.15});
motionPreference.addEventListener?.("change",()=>{for(const target of document.querySelectorAll(".gift-media-lottie")){const entry=lottieInstances.get(target);if(motionPreference.matches)entry?.player?.pause();else if(entry?.visible)entry.player?.play();}});
function observeGiftMedia(root) {
  for(const target of root.querySelectorAll(".gift-media-lottie")){
    if(lottieInstances.has(target))continue;
    lottieInstances.set(target,{abort:new AbortController(),visible:false,loading:false,failed:false,player:null});
    lottieObserver.observe(target);
  }
  for (const video of root.querySelectorAll(".gift-media-video")) {
    if(observedGiftVideos.has(video))continue;
    observedGiftVideos.add(video);
    video.hidden = false;
    video.addEventListener("playing", () => { video.classList.add("playing"); });
    video.addEventListener("pause", () => { video.classList.remove("playing"); });
    video.addEventListener("error", () => { video.hidden = true; video.classList.remove("playing"); giftVideoObserver.unobserve(video); });
    giftVideoObserver.observe(video);
  }
}
function releaseGiftMedia(root) {
  for(const target of root.querySelectorAll(".gift-media-lottie")){const entry=lottieInstances.get(target);lottieObserver.unobserve(target);entry?.abort.abort();entry?.player?.destroy();lottieInstances.delete(target);}
  for (const video of root.querySelectorAll(".gift-media-video")) { giftVideoObserver.unobserve(video); observedGiftVideos.delete(video); video.pause(); }
}
document.addEventListener("error", event => {
  if(event.target instanceof HTMLImageElement&&event.target.classList.contains("profile-photo"))event.target.remove();
  if (event.target instanceof HTMLImageElement && event.target.classList.contains("gift-media-still")) {
    event.target.hidden = true;
    event.target.parentElement.classList.add("media-error");
  }
}, true);
function collectibleCard(g) {
  const media = giftMedia(g);
  return `<article class="gift real-gift"><div class="real-gift-art">${media}<span class="serial">#${esc(g.number)}</span><span class="verified-source">Telegram</span></div><div class="info"><div class="name">${esc(g.collection)}</div><div class="muted">${esc(g.model || "Модель не указана")}</div><div class="traits"><span>${esc(g.backdrop || "—")}</span><span>${esc(g.symbol || "—")}</span></div><a class="gift-link" href="https://t.me/nft/${encodeURIComponent(g.slug)}" target="_blank" rel="noopener noreferrer">Открыть в Telegram</a></div></article>`;
}
const empty = (title, sub = "", kind = "inventory") =>
  `<div class="empty"><span class="empty-icon">${icon(kind)}</span><strong>${esc(title)}</strong>${sub?`<span>${esc(sub)}</span>`:""}</div>`;
function grouped() {
  const m = new Map();
  for (const g of state.market) {
    let c = m.get(g.collection);
    if (!c) m.set(g.collection, { g, floor: BigInt(g.price), count: 1 });
    else {
      c.count++;
      if (BigInt(g.price) < c.floor) c.floor = BigInt(g.price);
    }
  }
  return [...m.values()];
}
function marketContent() {
  let all = state.market.filter(
    (g) =>
      (!state.collection || g.collection === state.collection) &&
      (!state.model || g.model === state.model) &&
      (!state.backdrop || g.backdrop === state.backdrop) &&
      (!state.symbol || g.symbol === state.symbol) &&
      (!state.max || Number(fmt(g.price)) <= Number(state.max)) &&
      (!state.query ||
        `${g.collection} ${g.number} ${g.model}`
          .toLowerCase()
          .includes(state.query.toLowerCase())),
  );
  if (state.sort === "low")
    all.sort((a, b) => (BigInt(a.price) < BigInt(b.price) ? -1 : 1));
  if (state.sort === "high")
    all.sort((a, b) => (BigInt(a.price) > BigInt(b.price) ? -1 : 1));
  const groups = grouped();
  let content =
    state.tab === "collections"
      ? `<div class="sectionhead"><b>Проверенные метаданные Telegram</b><span class="muted">${state.collectibles.length}</span></div><div class="grid">${state.collectibles.map(collectibleCard).join("")}</div>${state.collectibles.length ? "" : empty("Каталог пока пуст", "Администратор может безопасно импортировать публичный slug. Импорт не подтверждает владение.")}<div class="panel">${groups.map((c) => `<div class="row"><div><b>${esc(c.g.collection)}</b><div class="muted">${c.count} в продаже</div></div>${btn(fmt(c.floor) + " " + cur(), "collection", c.g.collection)}${btn("Статистика", "collection-stats", c.g.collection)}</div>`).join("")}</div>`
      : state.tab === "offers"
        ? bookContent() + offersContent()
        : state.tab === "bundles"
          ? bundleContent()
          : `<div class="search"><input id="search" placeholder="Поиск подарков или номера" value="${esc(state.query)}">${btn(uiIcon("filter") + "Фильтры", "filters")}</div><div class="filters">${btn(state.collection || "Коллекция", "filters", "", "chip " + (state.collection ? "active" : ""))}${btn(state.model || "Модель", "filters", "", "chip " + (state.model ? "active" : ""))}${btn(state.backdrop || "Фон", "filters", "", "chip " + (state.backdrop ? "active" : ""))}${btn(state.symbol || "Символ", "filters", "", "chip " + (state.symbol ? "active" : ""))}${btn("Цена", "filters", "", "chip " + (state.max ? "active" : ""))}</div><div class="sectionhead"><b>Коллекции</b>${btn("Все", "tab", "collections")}</div><div class="collections">${groups.map((c) => `<button class="collection" data-action="collection" data-id="${esc(c.g.collection)}"><img class="collection-mark" src="/logo.svg" alt=""><span>${esc(c.g.collection)}<small>${fmt(c.floor)} ${cur()}</small></span></button>`).join("")}</div><div class="sectionhead"><b id="count">${all.length} подарков</b><select id="sort"><option value="new">Недавно добавлены</option><option value="low" ${state.sort === "low" ? "selected" : ""}>Сначала дешёвые</option><option value="high" ${state.sort === "high" ? "selected" : ""}>Сначала дорогие</option></select></div><div class="grid" id="gift-grid">${all.map((g) => giftCard(g)).join("")}</div>${all.length ? "" : empty("Ничего не найдено", "Измените фильтры или дождитесь новых объявлений")}`;
  return `<div class="hero"><div><h1>Маркет</h1><div class="muted">Найди свой следующий подарок</div></div>${btn("Sweep", "sweep")}</div><div class="tabs">${[
    ["store", "Маркет"],
    ["collections", "Коллекции"],
    ["offers", "Офферы"],
    ["bundles", "Наборы"],
  ]
    .map(([id, n]) => btn(n, "tab", id, state.tab === id ? "active" : ""))
    .join("")}</div>${content}`;
}
function bookContent() {
  const own = new Set((state.me?.collectionOffers || []).map((o) => o.id));
  return `<div class="panel"><div class="row"><h3>Заявки на коллекции</h3>${btn("+ Заявка", "book-new", "", "accent")}</div>${state.orderbook.map((o) => `<div class="row"><div><b>${esc(o.collection)}</b><div class="muted">${esc([o.model, o.backdrop, o.symbol].filter(Boolean).join(" · ") || "Любые атрибуты")} · осталось ${esc(o.remaining)}</div><b>${fmt(o.price)} ${cur()}</b></div>${own.has(o.id) ? btn("Отменить", "book-cancel", o.id) : btn("Продать", "book-fill", o.id)}</div>`).join("") || empty("Нет заявок на коллекции")}</div>`;
}
function bundleContent() {
  return `<div class="panel"><div class="row"><h3>Наборы подарков</h3>${btn("+ Создать", "bundle-new", "", "accent")}</div></div><div class="grid">${state.bundles
    .map(
      (b) =>
        `<article class="gift"><div class="bundle-art">${b.gifts
          .slice(0, 4)
          .map((g) => art(g, false))
          .join(
            "",
          )}</div><div class="info"><b>Набор · ${b.gifts.length} подарков</b><div class="muted">${esc(b.gifts.map((g) => g.collection).join(", "))}</div><div class="price">${fmt(b.price)} ${cur()}</div>${state.me?.ownBundles.includes(b.id) ? btn("Расформировать", "bundle-cancel", b.id) : btn("Купить набор", "bundle-detail", b.id, "accent")}</div></article>`,
    )
    .join(
      "",
    )}</div>${state.bundles.length ? "" : empty("Нет активных наборов")}`;
}
function matching(o) {
  return (state.me?.inventory || []).filter(
    (g) =>
      !g.bundle &&
      g.collection === o.collection &&
      ["model", "backdrop", "symbol"].every((k) => !o[k] || g[k] === o[k]),
  );
}
function quickSell(g) {
  if (!g || g.bundle) throw Error("Подарок недоступен");
  const own = new Set((state.me?.collectionOffers || []).map((o) => o.id));
  const o = state.orderbook.find(
    (o) => !own.has(o.id) && matching(o).some((x) => x.id === g.id),
  );
  quotedBook = o;
  const direct = (state.me?.offers || [])
    .filter(
      (x) =>
        x.gift === g.id &&
        x.status === "active" &&
        x.buyer !== state.me.user.id &&
        Number(x.expires) > Date.now(),
    )
    .sort((a, b) => (BigInt(a.price) > BigInt(b.price) ? -1 : 1))[0];
  if (direct && (!o || BigInt(direct.price) >= BigInt(o.price))) {
    show(
      "Quick Sell",
      `<div class="detail"><b>${esc(g.collection)} #${esc(g.number)}</b><div class="metric">${fmt(direct.price)} ${cur()}</div><p>К получению: ${fmt(BigInt(direct.price) - (BigInt(direct.price) * 2n) / 100n)} ${cur()}</p>${btn("Подтвердить продажу", "accept", direct.id, "accent")}</div>`,
    );
    return;
  }
  if (!o) {
    show("Quick Sell", empty("Нет обеспеченного спроса"));
    return;
  }
  show(
    "Quick Sell",
    `<div class="detail"><b>${esc(g.collection)} #${esc(g.number)}</b><div class="metric">${fmt(o.price)} ${cur()}</div><p>К получению: ${fmt(BigInt(o.price) - (BigInt(o.price) * 2n) / 100n)} ${cur()}</p><input id="book-gift" type="hidden" value="${esc(g.id)}">${btn("Подтвердить продажу", "book-confirm", o.id, "accent")}</div>`,
  );
}
let quotedBundle = null,
  quotedBook = null;
function offersContent() {
  return `<div class="panel"><h3>Мои предложения</h3>${(state.me?.offers || []).map((o) => `<div class="row"><div><b>${esc(o.collection)} #${esc(o.number)}</b><div class="muted">${esc(o.status)} · ${fmt(o.price)} ${cur()}</div></div>${o.status === "active" ? (o.buyer === state.me.user.id ? btn("Отменить", "cancel", o.id) : btn("Принять", "accept", o.id, "accent")) : ""}</div>`).join("") || empty("Нет предложений", "Создайте оффер на понравившийся подарок")}</div>`;
}
function gramIcon(){return '<svg class="gram-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" transform="rotate(45 12 12)" fill="#30A1F5"/><path d="M12 5.5c.65 4 2.5 5.85 6.5 6.5-4 .65-5.85 2.5-6.5 6.5-.65-4-2.5-5.85-6.5-6.5 4-.65 5.85-2.5 6.5-6.5Z" fill="white"/></svg>'}
function giftBoxIcon(){return icon("gift")}
function searchBar(id,placeholder,value=""){
 return `<label class="search-field">${icon("search")}<input id="${id}" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(value)}"></label>`;
}
function walletLabel(){return state.walletConnection?"Подключён":"Кошелёк";}
function homeContent(){
 const listings=state.market||[],catalog=state.collectibles||[];
 return `<section class="reference-banner" aria-label="MINION MARKET"><div class="reference-banner-text"><span class="eyebrow">TELEGRAM COLLECTIBLES</span><strong>MINION<span> MARKET</span></strong><p>Найди свой следующий подарок</p></div><div class="banner-art" aria-hidden="true">${giftBoxIcon()}</div></section><div class="home-actions"><button class="home-action wallet-action" data-action="connect">${icon("wallet")}<span><b>Кошелёк</b><small>${state.walletConnection?"Управление":"Подключить"}</small></span></button><button class="home-action add-action" data-action="deposit-gift">${giftBoxIcon()}<span><b>Добавить NFT</b><small>Ссылка Telegram</small></span></button></div><div class="home-section"><h1>Маркет</h1>${btn("Все коллекции","catalog-open","","text-action")}</div><form id="home-search-form" class="search">${searchBar("home-search","Поиск подарков")}${btn(icon("filter"),"home-filter","","icon-button")}</form>${listings.length?`<div class="grid storefront-grid">${listings.slice(0,30).map(g=>giftCard(g)).join("")}</div>`:empty("Пока нет объявлений","Новые предложения появятся здесь.","market")+`<div class="empty-actions">${btn("Смотреть коллекции","catalog-open")}</div>`}${catalog.length?`<div class="sectionhead"><b>Каталог Telegram</b></div><p class="muted">Не выставлены на продажу</p><div class="grid storefront-grid">${catalog.slice(0,40).map(collectibleCard).join("")}</div>`:""}`;
}
function giftCount(n){const t=n%100,u=n%10;return n+" "+(t>=11&&t<=14?"подарков":u===1?"подарок":u>=2&&u<=4?"подарка":"подарков");}
function inventoryPref(key,fallback,allowed){try{const v=localStorage.getItem("mm-inventory-"+key);return allowed.includes(v)?v:fallback;}catch{return fallback;}}
function setInventoryPref(key,value){try{localStorage.setItem("mm-inventory-"+key,value);}catch{}}
function inventoryGroups(){
 const personal=state.personalGifts||[],assets=state.me?.inventory||[];
 return [["telegram","В Telegram",personal],["held",state.config.demo?"TEST · В инвентаре":"На хранении маркета",assets.filter(g=>!g.listing)],["listed",state.config.demo?"TEST · В продаже":"В продаже",assets.filter(g=>g.listing)]];
}
function inventorySort(items,mode){
 const value=g=>Number.isInteger(g.modelRarity)&&g.modelRarity>=0&&g.modelRarity<=1000?g.modelRarity:Infinity;
 const cmp=(a,b)=>String(a.collection||"").localeCompare(String(b.collection||""),"ru");
 return [...items].sort((a,b)=>mode==="collection"?cmp(a,b):mode==="number"?Number(a.number)-Number(b.number):mode==="rarity"?(value(a)-value(b)||cmp(a,b)):(Number(b.checkedAt||0)-Number(a.checkedAt||0)));
}
function personalInventoryCard(g){
 return `<article class="gift personal-inventory-card inventory-item" data-inventory-key="${esc(g.slug)}" data-inventory-version="${esc(JSON.stringify(g))}"><div class="real-gift-art">${giftMedia(g)}<span class="serial">#${esc(g.number)}</span><span class="inventory-source" aria-label="Ссылка Telegram">${icon("gift")}</span><span class="inventory-check" aria-hidden="true"></span></div><div class="info"><span class="name">${esc(g.collection)}</span><span class="muted">${esc(g.model||"")}</span><span class="inventory-card-status ${g.status==="not_observed"?"unobserved":""}">${g.status==="not_observed"?"Не найден при проверке":"В Telegram"}</span></div><button class="card-hit" aria-label="Открыть ${esc(g.collection)} #${esc(g.number)}" data-action="personal-detail" data-id="${esc(g.slug)}"></button><button class="inventory-more" aria-label="Действия с ${esc(g.collection)}" data-action="personal-menu" data-id="${esc(g.slug)}">${icon("more")}</button></article>`;
}
const inventoryTraits=[["collection","Коллекция"],["model","Модель"],["backdrop","Фон"],["symbol","Символ"]];
function inventoryTraitCount(){return inventoryTraits.filter(([key])=>state.inventoryTraits?.[key]).length;}
function inventoryFilterSheet(){
 const all=inventoryGroups().flatMap(x=>x[2]),filters=state.inventoryTraits||{};
 show("Фильтры коллекции",`<div class="detail">${inventoryTraits.map(([key,label])=>{
 const values=[...new Set(all.map(g=>g[key]).filter(v=>typeof v==="string"&&v.length))].sort((a,b)=>a.localeCompare(b,"ru"));
 if(filters[key]&&!values.includes(filters[key]))values.push(filters[key]);
 return `<label>${label}<select id="inv-${key}"><option value="">Все</option>${values.map(v=>`<option value="${esc(v)}" ${filters[key]===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label>`;
 }).join("")}${btn("Применить","inventory-traits-apply","","accent")}${btn("Сбросить атрибуты","inventory-traits-reset")}</div>`);
}
function inventoryResults(){
 const query=(state.inventoryQuery||"").trim().toLowerCase().replace(/^#/,""),filter=state.inventoryFilter||"all",sort=state.inventorySort||"new";
 const match=g=>(!query||[g.collection,g.model,g.number,g.backdrop,g.symbol,g.slug].join(" ").toLowerCase().includes(query))&&inventoryTraits.every(([key])=>!state.inventoryTraits?.[key]||g[key]===state.inventoryTraits[key]);
 const visible=inventoryGroups().filter(([key])=>filter==="all"||filter===key).map(([key,title,items])=>[key,title,inventorySort(items.filter(match),sort)]).filter(x=>x[2].length);
 const filtered=!!query||filter!=="all"||inventoryTraitCount()>0;
 const count=visible.reduce((n,x)=>n+x[2].length,0),limit=state.inventoryLimit||24,view=state.inventoryView||"grid";
 let remaining=limit;
 const groups=visible.map(([key,title,items])=>{const shown=items.slice(0,remaining);remaining=Math.max(0,remaining-shown.length);return shown.length?`<section class="inventory-group"><div class="sectionhead"><b>${title}</b><span class="count-pill">${items.length}</span></div><div class="grid inventory-grid view-${view}">${shown.map(g=>key==="telegram"?personalInventoryCard(g):giftCard(g,true)).join("")}</div></section>`:""}).join("");
 return `<div class="inventory-result-count" aria-live="polite">${giftCount(count)}</div>${groups||empty(filtered?"Ничего не найдено":"Твоя коллекция начинается здесь",filtered?"Попробуйте изменить поиск или фильтры.":"Добавьте свой подарок по ссылке.","gift")}${!count?`<div class="empty-actions">${btn(filtered?"Сбросить фильтры":"Добавить подарок",filtered?"inventory-reset":"deposit-gift","","accent")}</div>`:""}${count>limit?`<div class="empty-actions">${btn("Показать ещё "+Math.min(24,count-limit),"inventory-more-items")}</div>`:""}`;
}
function selectedRefs(){return state.inventorySelected??=new Set();}
function syncInventorySelection(){
 const selected=selectedRefs(),existing=new Set((state.personalGifts||[]).map(g=>g.slug));
 for(const slug of selected)if(!existing.has(slug))selected.delete(slug);
 const root=$("#inventory-results");if(!root)return;
 root.classList.toggle("selecting",!!state.inventorySelecting);
 for(const card of root.querySelectorAll("[data-inventory-key]")){
  const slug=card.dataset.inventoryKey,on=selected.has(slug),hit=card.querySelector(".card-hit");
  card.classList.toggle("selected",on);
  hit.dataset.action=state.inventorySelecting?"inventory-select-one":"personal-detail";
  if(state.inventorySelecting)hit.setAttribute("aria-pressed",String(on));else hit.removeAttribute("aria-pressed");
  card.querySelector(".inventory-more").hidden=!!state.inventorySelecting;
 }
 const bar=$("#inventory-selection");if(bar){bar.hidden=!state.inventorySelecting;bar.querySelector("strong").textContent="Выбрано: "+selected.size;for(const b of bar.querySelectorAll("[data-needs-selection]"))b.disabled=!selected.size;}
}
function inventoryContent(){
 state.inventoryView??=inventoryPref("view","grid",["grid","list"]);
 state.inventorySort??=inventoryPref("sort","new",["new","collection","number","rarity"]);
 const groups=inventoryGroups(),total=groups.reduce((n,x)=>n+x[2].length,0),filter=state.inventoryFilter||"all";
 const labels=[["all","Все",total],...groups.map(([key,title,items])=>[key,key==="telegram"?"Telegram":key==="held"?"На маркете":"В продаже",items.length])];
 return `<div class="hero inventory-hero"><div><h1>Инвентарь</h1><div class="muted">${giftCount(total)} в коллекции</div></div>${btn(giftBoxIcon()+" Добавить","deposit-gift","","accent")}</div><div class="search">${searchBar("inventory-search","Название, модель или номер",state.inventoryQuery||"")}<button class="icon-button inventory-filter-button ${inventoryTraitCount()?"active":""}" data-action="inventory-traits" aria-label="Фильтры атрибутов">${icon("filter")}${inventoryTraitCount()?`<span class="filter-indicator">${inventoryTraitCount()}</span>`:""}</button></div><div class="tabs inventory-tabs" aria-label="Статус подарков">${labels.map(([id,n,count])=>`<button data-action="inventory-filter" data-id="${id}" class="${filter===id?"active":""}" aria-pressed="${filter===id}">${n}<span class="filter-count">${count}</span></button>`).join("")}</div><div class="inventory-toolbar"><label class="inventory-sort"><span class="sr-only">Сортировка</span><select id="inventory-sort">${[["new","Недавние"],["collection","Коллекция"],["number","Номер"],["rarity","Редкость модели"]].map(([v,n])=>`<option value="${v}" ${state.inventorySort===v?"selected":""}>${n}</option>`).join("")}</select></label><div class="view-toggle" aria-label="Вид коллекции">${["grid","list"].map(v=>`<button data-action="inventory-view" data-id="${v}" aria-label="${v==="grid"?"Сетка":"Список"}" aria-pressed="${state.inventoryView===v}" class="${state.inventoryView===v?"active":""}">${icon(v)}</button>`).join("")}</div></div><div class="selection-entry">${(state.personalGifts||[]).length?btn(state.inventorySelecting?"Готово":"Выбрать","inventory-select-mode","","text-action"):""}</div><div id="inventory-selection" class="selection-bar" ${state.inventorySelecting?"":"hidden"}><strong>Выбрано: ${selectedRefs().size}</strong><div><button data-action="inventory-select-visible">Все видимые</button><button data-action="inventory-batch-refresh" data-needs-selection>Проверить</button><button class="danger-action" data-action="inventory-batch-confirm" data-needs-selection>Убрать</button></div></div><div id="inventory-results">${inventoryResults()}</div><section class="inventory-tools"><h3>Инструменты</h3><div>${btn(icon("swap")+" Обмены","swaps")}${btn(icon("inventory")+" Наборы","bundle-new")}</div></section>`;
}
function updateInventoryResults(){
 const root=$("#inventory-results");if(!root)return;
 const template=document.createElement("template");template.innerHTML=inventoryResults();
 const previous=new Map([...root.querySelectorAll("[data-inventory-key]")].map(node=>[node.dataset.inventoryKey,node]));
 for(const next of template.content.querySelectorAll("[data-inventory-key]")){
  const old=previous.get(next.dataset.inventoryKey);
  if(old&&old.dataset.inventoryVersion===next.dataset.inventoryVersion){
   next.replaceWith(old);previous.delete(next.dataset.inventoryKey);
  }
 }
 // Reused cards retain the actual Lottie player and image/video nodes.
 // Release only cards still in the old subtree before swapping the results.
 releaseGiftMedia(root);root.replaceChildren(template.content);observeGiftMedia(root);syncInventorySelection();
}
function rarityText(n){return Number.isInteger(n)&&n>=0&&n<=1000?`<span class="rarity">${(n/10).toLocaleString("ru-RU",{maximumFractionDigits:1})}%</span>`:"";}
function personalMenu(slug){
 const g=state.personalGifts.find(x=>x.slug===slug);if(!g)return;
 show(g.collection+" #"+g.number,`<div class="detail">${btn("Подробнее","personal-detail",slug)}<a class="gift-link" href="https://t.me/nft/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer">Открыть в Telegram</a>${btn("Проверить в Telegram","personal-refresh",slug)}${btn("Убрать из инвентаря","personal-remove-confirm",slug,"danger-action")}</div>`);
}
function salesContent(){
 const mine=(state.me?.inventory||[]).filter(g=>g.listing),tab=state.salesTab||"active";
 const rows=(state.me?.history||[]).filter(x=>["sale","bundle_sale"].includes(x.kind)&&x.dst===state.me?.user?.id+":available");
 return `<div class="hero"><div><h1>Мои продажи</h1><div class="muted">${mine.length} активных</div></div>${btn("Выставить","nav","inventory","accent")}</div><div class="tabs">${[["active","Активные"],["sold","Проданные"],["offers","Предложения"]].map(([id,n])=>btn(n,"sales-tab",id,tab===id?"active":"")).join("")}</div>${tab==="offers"?offersContent():tab==="sold"?(rows.length?`<div class="panel">${rows.map(x=>`<div class="row"><span>Продажа</span><b>${fmt(x.amount)} ${esc(cur())}</b></div>`).join("")}</div>`:empty("Нет завершённых продаж","","sales")):mine.length?`<div class="grid">${mine.map(g=>giftCard(g,true)).join("")}</div>`:empty("Нет активных продаж","Выберите подарок в инвентаре.","sales")}`;
}
function personalDetail(slug){
 const g=state.personalGifts.find(x=>x.slug===slug);if(!g)return;
 const trait=(label,value,rarity)=>`<div class="trait-row"><span>${label}</span><div><b>${esc(value||"—")}</b>${rarityText(rarity)}</div></div>`;
 show(g.collection+" #"+g.number,`<div class="detail personal-detail"><div class="personal-preview">${giftMedia(g)}<span class="verified-source">Telegram</span></div><div class="trait-table">${trait("Модель",g.model,g.modelRarity)}${trait("Фон",g.backdrop,g.backdropRarity)}${trait("Символ",g.symbol,g.symbolRarity)}</div><div class="ownership-note ${g.status==="not_observed"?"unobserved":""}">${icon("shield")}<div><b>${g.status==="not_observed"?"Не найден при последней проверке":"Найден в списке Telegram"}</b><p>Последнее обнаружение: ${esc(new Date(g.checkedAt).toLocaleString("ru"))}. Не доказывает право собственности или хранение на маркете.</p></div></div><a class="gift-link primary-link" href="https://t.me/nft/${encodeURIComponent(g.slug)}" target="_blank" rel="noopener noreferrer">Открыть в Telegram</a><p class="muted">Продажа на маркете пока недоступна.</p><div class="detail-actions">${btn("Проверить в Telegram","personal-refresh",g.slug)}${btn(icon("more"),"personal-menu",g.slug,"icon-button")}</div></div>`);
}
function profileContent(){
 const name=state.me?.user?.name||"Гость", photo=window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
 const avatar=`<div class="account-avatar initials profile-avatar"><span>${esc(name.slice(0,1).toUpperCase())}</span>${typeof photo==="string"&&/^https:\/\/[^\s]+$/i.test(photo)?`<img class="profile-photo" src="${esc(photo)}" alt="">`:""}</div>`;
 const count=(state.me?.inventory?.length||0)+state.personalGifts.length;
 const stats=state.me?.tradeStats||{};
 const menu=(i,label,action,id="")=>`<button class="profile-menu-item" data-action="${action}" data-id="${id}"><span class="profile-menu-icon">${icon(i)}</span><b>${label}</b><span class="profile-chevron">›</span></button>`;
 return `<div class="profile-screen"><h1>Профиль</h1><section class="profile-identity">${avatar}<div><h2>${esc(name)}</h2><p>${state.config.demo?"Тестовый аккаунт":state.me?.user?.username?"@"+esc(state.me.user.username):state.me?"Telegram аккаунт":"Войдите через Telegram"}</p></div></section><section class="profile-wallet"><div class="profile-wallet-title">${gramIcon()} <span>Торговый баланс</span></div><strong>${state.config.demo?fmt(state.me?.balance.available||0)+" "+esc(cur()):"—"}</strong><p>${state.config.demo?"Тестовые средства":state.walletConnection?esc(state.walletConnection.address.slice(0,9)+"…"+state.walletConnection.address.slice(-6))+" · баланс сети не получен":"Реальные операции пока отключены"}</p>${btn(state.walletConnection?"Управление":"Подключить кошелёк",state.walletConnection?"wallet":"connect","","accent")}${btn("История операций","history","","profile-secondary")}</section><div class="profile-stats"><button data-action="nav" data-id="inventory"><b>${count}</b><span>Подарки</span></button><button data-action="nav" data-id="sales"><b>${esc(stats.sold??0)}</b><span>Продажи</span></button><button data-action="nav" data-id="activity"><b>${esc(stats.bought??0)}</b><span>Покупки</span></button></div><section class="profile-menu">${menu("inventory","Мои подарки","nav","inventory")}${menu("sales","Мои продажи","nav","sales")}${menu("star","Избранное","favorites")}${menu("offers","Офферы","open-offers")}${menu("wallet","Кошелёк","connect")}${menu("support","Поддержка","support")}${state.config.demo?menu("profile","Сменить тестовый аккаунт","demo-switch"):""}</section><div class="panel"><h3>Уведомления</h3>${(state.me?.notifications||[]).map(n=>`<div class="row">${esc(n.message)}</div>`).join("")||'<div class="muted">Нет уведомлений</div>'}</div></div>`;
}
function activityContent(){
 const events=state.activity||[],now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()),day=86400000;
 const days=Array.from({length:7},(_,i)=>({date:today-(6-i)*day,count:0}));
 for(const event of events){const t=Number(event.created);if(event.type==="sold"&&Number.isFinite(t)&&t>=days[0].date&&t<=Date.now()){const i=Math.floor((t-days[0].date)/day);if(days[i])days[i].count++;}}
 const total=days.reduce((n,d)=>n+d.count,0),max=Math.max(1,...days.map(d=>d.count));
 const label=d=>new Date(d.date).toLocaleDateString("ru",{day:"numeric",month:"short",timeZone:"UTC"});
 const filter=state.activityFilter||"all",visible=events.filter(e=>filter==="all"||e.type===filter);
 const types={listed:"Выставлен",sold:"Продан",price_changed:"Цена изменена",delisted:"Снят"};
 return `<div class="hero"><div><h1>Статистика</h1><div class="muted">Последние операции маркета</div></div>${btn("Обновить","refresh")}</div><section class="panel activity-chart"><div class="muted">Продажи в доступной истории · 7 дней UTC</div><strong class="activity-total">${total}</strong><div class="activity-bars" role="group" aria-label="Продажи по дням">${days.map(d=>`<div class="activity-day" aria-label="${esc(label(d))}: ${d.count}"><b>${d.count}</b><div class="activity-track"><span style="height:${d.count/max*100}%"></span></div><small>${esc(label(d))}</small></div>`).join("")}</div><p class="muted">Только полученные события, не полный оборот рынка. ${state.config.demo?"TEST · тестовые данные.":""}</p></section><div class="tabs activity-tabs">${[["all","Все"],["sold","Продажи"],["listed","Листинги"]].map(([id,n])=>`<button data-action="activity-filter" data-id="${id}" aria-pressed="${filter===id}" class="${filter===id?"active":""}">${n}</button>`).join("")}</div><div class="panel">${visible.map(a=>`<div class="row"><div><b>${esc(a.collection)} #${esc(a.number)}</b><div class="muted">${types[a.type]||esc(a.type)} · ${new Date(Number(a.created)).toLocaleString("ru")}</div></div><b>${fmt(a.price)} ${esc(cur())}</b></div>`).join("")||empty("Нет операций")}</div>`;
}
function page() {
  if (state.page === 'home') return homeContent();
  if (state.page === 'sales') return salesContent();
  if (state.page === "market") return marketContent();
  if (state.page === "activity") return activityContent();
  if (state.page === "inventory") return inventoryContent();
  if (state.page === "giveaways")
    return `<div class="hero"><div><h1>Розыгрыши</h1><div class="muted">Только бесплатное участие</div></div>${btn("Создать", "giveaway-new", "", "accent")}</div><div class="giveaway-list">${state.giveaways
      .map(
        (g) =>
          `<article class="panel giveaway"><div class="giveaway-prize">${art({ ...g, id: g.gift }, false)}</div><div><div class="tag">БЕСПЛАТНО</div><h3>${esc(g.title)}</h3><div class="muted">${esc(g.collection)} #${esc(g.number)} · ${esc(g.participants)} участников</div><p class="muted">До ${new Date(Number(g.ends)).toLocaleString("ru")}</p>${g.status !== "active" ? `<b>Завершён${g.winner ? ` · победитель ${esc(g.winner)}` : ""}</b>` : g.organizer === state.me?.user.id ? (Number(g.ends) <= Date.now() ? btn("Определить победителя", "giveaway-settle", g.id, "accent") : '<span class="muted">Приз заблокирован</span>') : g.joined ? '<span class="positive">Вы участвуете</span>' : btn("Участвовать", "giveaway-join", g.id, "accent")}</div></article>`,
      )
      .join(
        "",
      )}</div>${state.giveaways.length ? "" : empty("Активных розыгрышей нет", "Создать бесплатный розыгрыш можно только из незанятого подарка в своём инвентаре.")}`;
  return profileContent();
}
function render() {
  releaseGiftMedia(app);
  if (location.pathname === "/admin") return renderAdmin();
  
 app.innerHTML=`<div class="shell reference-shell page-${esc(state.page)}"><header class="reference-top"><button class="top-back" data-action="nav" data-id="home" aria-label="Главная">${icon("home")}</button><button class="reference-brand" data-action="nav" data-id="home">Minion Market</button><button class="reference-balance" data-action="wallet">${gramIcon()}<b>${state.config.demo?"TEST "+fmt(state.me?.balance.available||0):walletLabel()}</b></button><button class="top-cart" data-action="cart" aria-label="Корзина">${icon("cart")}${state.cart.size?`<sup>${state.cart.size}</sup>`:""}</button></header>${["home","market","giveaways"].includes(state.page)?`<div class="reference-shortcuts">${[["market","market","Маркет"],["offers","offers","Офферы"],["giveaways","giveaways","Розыгрыши"]].map(([route,i,label])=>`<button class="${state.page===route?"active":""}" data-action="${route==="wallet"?"wallet":route==="offers"?"open-offers":"nav"}" data-id="${route}" title="${label}" aria-label="${label}">${icon(i)}<span>${label}</span></button>`).join("")}</div>`:""}<div class="reference-status"><b>${state.config.demo?"TEST":"PREVIEW"}</b> · ${state.config.demo?"Тестовые подарки и средства":"Реальные сделки пока отключены"}</div>${page()}</div><nav class="nav reference-nav" aria-label="Основная навигация">${[["home","Главная"],["inventory","Инвентарь"],["sales","Продажи"],["activity","Статистика"],["profile","Профиль"]].map(([n,label])=>`<button data-action="nav" data-id="${n}" class="${state.page===n?"active":""}" ${state.page===n?'aria-current="page"':""}>${icon(n)}<span>${label}</span></button>`).join("")}</nav>`;

  observeGiftMedia(app);
  syncInventorySelection();
  $("#home-search-form")?.addEventListener("submit",e=>{e.preventDefault();state.query=$("#home-search").value;state.page="market";state.tab="store";render();scrollTo(0,0);});
  $("#inventory-search")?.addEventListener("input",e=>{state.inventoryQuery=e.target.value;state.inventoryLimit=24;updateInventoryResults();});
  $("#inventory-sort")?.addEventListener("change",e=>{state.inventorySort=e.target.value;setInventoryPref("sort",e.target.value);state.inventoryLimit=24;updateInventoryResults();});
  $("#search")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#search")?.focus();
    $("#search")?.setSelectionRange(pos, pos);
  });
  $("#sort")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
}
async function renderAdmin() {
  try {
    const a = await api("admin");
    app.innerHTML = `<div class="shell"><header class="top"><div class="brand"><img src="/logo.svg"> MINION ADMIN</div><a href="/">Маркет →</a></header><div class="banner">${state.config.demo ? "DEMO · тестовые данные" : "RESTRICTED"} · Только просмотр</div><div class="hero"><h1>Обзор</h1>${btn("Обновить", "refresh")}</div><div class="admin-grid">${[
      ["Пользователи", a.users.length],
      ["Подарки", a.gifts.length],
      ["Листинги", a.listings.length],
      ["Проводки", a.ledger.length],
      ["Тикеты", a.tickets.length],
      [
        "Доход",
        fmt(a.accounts.find((x) => x.id === "revenue")?.balance || 0) +
          " " +
          cur(),
      ],
    ]
      .map(
        ([k, v]) =>
          `<div class="panel"><div class="muted">${k}</div><div class="metric">${v}</div></div>`,
      )
      .join(
        "",
      )}</div><div class="panel"><div class="row"><h3>Диагностика интеграций</h3>${btn("Проверить", "admin-check")}${!state.config.demo ? btn("Импорт slug", "catalog-import") : ""}</div>${Object.entries(
      a.health || {},
    )
      .map(
        ([k, v]) =>
          `<div class="row"><span>${esc(k)}</span><b>${esc(k === "ledger" ? (v.ok ? "OK" : "ERROR") : v.status)}</b></div>${v.reason ? `<p class="muted">${esc(v.reason)}</p>` : ""}`,
      )
      .join(
        "",
      )}<p class="muted">Обнаружено обычных подарков: ${a.catalog?.length || 0}. Снимок custody: ${a.custody?.length || 0}. Проверка не зачисляет активы.</p></div><div class="panel"><h3>Ledger</h3><div class="tablewrap"><table><thead><tr><th>Тип</th><th>Откуда</th><th>Куда</th><th>Сумма</th></tr></thead><tbody>${a.ledger.map((r) => `<tr><td>${esc(r.kind)}</td><td>${esc(r.src)}</td><td>${esc(r.dst)}</td><td>${fmt(r.amount)}</td></tr>`).join("")}</tbody></table></div></div><div class="panel"><h3>Поддержка</h3>${a.tickets.map((t) => `<div class="row"><span>${esc(t.message)}</span><small>${esc(t.status)}</small></div>`).join("") || "Нет тикетов"}</div></div>`;
  } catch (e) {
    app.innerHTML =
      empty("Нет доступа", esc(e.message)) +
      '<a href="/">Вернуться в маркет</a>';
  }
}
const findGift = (id) =>
  state.market.find((g) => g.id === id) ||
  state.me?.inventory.find((g) => g.id === id);
async function mutate(a, b) {
  const out = await api("action/" + a, {
    method: "POST",
    headers: {
      "Idempotency-Key":
        crypto.randomUUID?.() ||
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join(""),
    },
    body: JSON.stringify(b),
  });
  await reload();
  render();
  return out;
}
function detail(g) {
  if (!g) return;
  const mine = state.me?.inventory.some((x) => x.id === g.id);
  show(
    g.collection,
    `<div class="detail">${art(g, false)}<div class="metric detail-price">${gramIcon()} ${fmt(g.price)} ${cur()}</div><div class="panel"><div class="row"><span>Модель</span><b>${esc(g.model)}</b></div><div class="row"><span>Фон</span><b>${esc(g.backdrop)}</b></div><div class="row"><span>Символ</span><b>${esc(g.symbol)}</b></div><div class="row"><span>Floor коллекции</span><b>${fmt(g.floor)} ${cur()}</b></div></div>${mine && g.bundle ? '<p class="muted">Подарок заблокирован в наборе.</p>' : mine ? btn("Quick Sell", "quick-sell", g.id) + btn("Выставить / изменить цену", "sell", g.id, "accent") + btn("Передать в тестовом маркете", "send", g.id) : btn("Купить", "buy", g.id, "accent") + btn("Сделать оффер", "offer", g.id)}</div>`,
  );
}
let purchaseQuote;
async function confirmBuy(g) {
  if (!g?.listing) throw Error("Объявление недоступно");
  purchaseQuote = await api("quote", {
    method: "POST",
    body: JSON.stringify({ id: g.listing, version: g.version }),
  });
  show(
    "Подтверждение покупки",
    `<div class="detail">${art(g, false)}<b>${esc(g.collection)} #${esc(g.number)}</b><div class="row"><span>Итого</span><b>${fmt(purchaseQuote.total)} ${cur()}</b></div><div class="row"><span>Комиссия продавца</span><b>${fmt(purchaseQuote.fee)} ${cur()}</b></div><div class="row"><span>Баланс</span><b>${fmt(state.me?.balance.available || 0)} ${cur()}</b></div><p class="muted">Котировка действует 2 минуты. Изменение цены требует нового подтверждения.</p>${btn("Подтвердить покупку", "buy-confirm", g.id, "accent")}</div>`,
  );
}
function cart() {
  const items = [...state.cart.values()];
  show(
    "Корзина",
    `<div class="detail">${items.map((g) => `<div class="row"><div><b>${esc(g.collection)}</b><div class="muted">${fmt(g.price)} ${cur()}</div></div>${btn("Убрать", "cart-remove", g.id)}</div>`).join("") || empty("Корзина пуста")}<div class="row"><b>Итого</b><b>${fmt(items.reduce((s, g) => s + BigInt(g.price), 0n))} ${cur()}</b></div>${items.length ? btn("Купить все", "cart-buy", "", "accent") + btn("Купить только доступные", "cart-partial") : ""}</div>`,
  );
}
function inputSheet(title, label, action, id, value = "") {
  show(
    title,
    `<div class="detail"><label>${label}<input id="value" value="${esc(value)}" placeholder="0.00" inputmode="decimal"></label>${btn("Подтвердить", action, id, "accent")}</div>`,
  );
}
let proofListener;
let connectingWallet=false;
function walletResult(message,verified=false){
  // The SDK owns its overlay. Never put a native dialog in the top layer above it.
  if(tonUI?.modalState?.status==="opened")tonUI.closeModal();
  if(verified)toast("Кошелёк подтверждён");
  if(!modal.open)show("TON-кошелёк",`<div class="detail"><p id="ton-proof-status" role="status">${esc(message)}</p>${verified?btn("Отключить кошелёк","disconnect"):btn("Повторить подключение","connect","","accent")}</div>`);
  else toast(message);
}
async function connect() {
  if(connectingWallet||tonUI?.modalState?.status==="opened")return;
  connectingWallet=true;
  // The native <dialog> occupies the browser top layer, above any SDK z-index.
  if(modal.open)modal.close();
  try {
    if(location.protocol!=="https:")throw Error("Для TON Proof настройте публичный HTTPS-домен.");
    const connection=await api("wallet/connection");
    if(!connection.enabled)throw Error("TON Proof отключён сервером. Требуется restricted и HTTPS.");
    if(!window.TON_CONNECT_UI)await new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="https://unpkg.com/@tonconnect/ui@2.0.9/dist/tonconnect-ui.min.js";
      script.onload=resolve;script.onerror=()=>{script.remove();reject(Error("SDK не загрузился. Проверьте интернет."));};
      document.head.append(script);
    });
    if(!tonUI)tonUI=new window.TON_CONNECT_UI.TonConnectUI({manifestUrl:location.origin+"/tonconnect-manifest.json"});
    if(proofListener){proofListener();proofListener=null;}
    await tonUI.connectionRestored;
    if(connection.connection&&tonUI.connected&&tonUI.wallet?.account?.address?.toLowerCase()===connection.connection.address&&tonUI.wallet?.account?.chain===connection.network&&connection.connection.network===connection.network){
      state.walletConnection=connection.connection;render();walletResult("Кошелёк подтверждён · "+(connection.network==="-239"?"Mainnet":"Testnet")+" · "+connection.connection.address,true);
      return;
    }
    if(tonUI.connected)await tonUI.disconnect();
    if(connection.connection)await api("wallet/connection",{method:"DELETE"});
    state.walletConnection=null;
    const challenge=await api("wallet/proof/challenge",{method:"POST",body:"{}"});
    tonUI.setConnectRequestParameters({state:"ready",value:{tonProof:challenge.payload}});
    let verifying=false;
    proofListener=tonUI.onStatusChange(async wallet=>{
      if(!wallet||verifying)return;
      verifying=true;
      connectingWallet=true;
      try{
        if(wallet.account.chain!==connection.network)throw Error("Выберите кошелёк в сети "+(connection.network==="-239"?"Mainnet":"Testnet"));
        const item=wallet.connectItems?.tonProof;
        if(!item?.proof)throw Error("Кошелёк не предоставил TON Proof.");
        const verified=await api("wallet/proof/verify",{method:"POST",body:JSON.stringify({
          address:wallet.account.address,network:wallet.account.chain,public_key:wallet.account.publicKey,
          proof:{...item.proof,state_init:wallet.account.walletStateInit},
        })});
        state.walletConnection=verified;render();walletResult("Подпись проверена сервером: "+verified.address,true);
      }catch(e){
        walletResult("Не удалось проверить подпись: "+e.message);
      }finally{connectingWallet=false;}
    });
    // Only the SDK's picker is visible while connecting; no buttonRootId is needed.
    if(modal.open)modal.close();
    await tonUI.openModal();
  }catch(e){walletResult(e.message);}
  finally{connectingWallet=false;}
}
let busy = false;
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.stopPropagation();
  const a = el.dataset.action,
    id = el.dataset.id,
    g = findGift(id);
  if (busy) return;
  try {
    switch (a) {
      case "giveaway-new": {
        const gifts = (state.me?.inventory || []).filter(
          (item) => !item.listing && !item.bundle && !item.best_offer,
        );
        show(
          "Новый розыгрыш",
          `<div class="detail"><label>Приз<select id="giveaway-gift">${gifts.map((item) => `<option value="${esc(item.id)}">${esc(item.collection)} #${esc(item.number)}</option>`).join("")}</select></label><label>Название<input id="giveaway-title" maxlength="100" placeholder="Бесплатный розыгрыш"></label><label>Срок<select id="giveaway-hours"><option value="1">1 час</option><option value="6">6 часов</option><option value="24" selected>24 часа</option><option value="72">3 дня</option><option value="168">7 дней</option></select></label><p class="muted">После создания приз блокируется. Изменить его или выбрать победителя вручную нельзя.</p>${gifts.length ? btn("Создать и заблокировать приз", "giveaway-create", "", "accent") : empty("Нет доступного подарка")}</div>`,
        );
        break;
      }
      case "giveaway-create":
        busy = true;
        await api("giveaways", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            gift: $("#giveaway-gift").value,
            title: $("#giveaway-title").value,
            hours: Number($("#giveaway-hours").value),
          }),
        });
        modal.close();
        await reload();
        render();
        toast("Розыгрыш создан, приз заблокирован");
        break;
      case "giveaway-join":
      case "giveaway-settle":
        busy = true;
        await api(
          `giveaways/${id}/${a === "giveaway-join" ? "join" : "settle"}`,
          {
            method: "POST",
            body: "{}",
          },
        );
        await reload();
        render();
        toast(a === "giveaway-join" ? "Вы участвуете" : "Победитель определён");
        break;
      case "catalog-import":
        inputSheet(
          "Метаданные Telegram",
          "Slug, например PlushPepe-123",
          "catalog-confirm",
          "",
        );
        break;
      case "catalog-confirm": {
        const item = await api("admin/collectibles", {
          method: "POST",
          body: JSON.stringify({ slug: $("#value").value.trim() }),
        });
        show(
          "Метаданные сохранены",
          `<div class="detail"><b>${esc(item.collection)} #${esc(item.number)}</b><p>${esc(item.model)} · ${esc(item.backdrop)} · ${esc(item.symbol)}</p><p class="muted">Не является объявлением или активом MINION MARKET.</p></div>`,
        );
        break;
      }
      case "swaps":
        show(
          "Обмены",
          `<div class="detail">${btn("Предложить обмен", "swap-new", "", "accent")}${(state.me?.swaps || []).map((x) => `<div class="panel"><b>${esc(x.sender)} → ${esc(x.recipient)}</b><p>${esc(x.status)} · ${esc(JSON.parse(x.give).join(", "))} ↔ ${esc(JSON.parse(x.take).join(", "))}</p>${x.status === "pending" ? (x.recipient === state.me.user.id ? btn("Принять", "swap-confirm", x.id, "accent") : "") + btn("Отменить", "swap-cancel", x.id) : ""}</div>`).join("") || '<p class="muted">Нет предложений</p>'}</div>`,
        );
        break;
      case "swap-new": {
        const candidates = await api("swap-candidates");
        const mine = (state.me?.inventory || []).filter(
          (g) => !g.listing && !g.bundle,
        );
        show(
          "Предложить обмен",
          `<div class="detail"><label>Ваш подарок<select id="swap-give">${mine.map((g) => `<option value="${esc(g.id)}">${esc(g.collection)} #${esc(g.number)}</option>`).join("")}</select></label><label>Получаемый подарок<select id="swap-take">${candidates.map((g) => `<option value="${esc(g.id)}" data-owner="${esc(g.owner)}">${esc(g.collection)} #${esc(g.number)} · ${esc(g.owner)}</option>`).join("")}</select></label><p class="muted">Только тестовые подарки. Обмен завершится после согласия получателя.</p>${mine.length && candidates.length ? btn("Отправить предложение", "swap-create", "", "accent") : empty("Нет доступных подарков")}</div>`,
        );
        break;
      }
      case "swap-create": {
        busy = true;
        const t = $("#swap-take").selectedOptions[0];
        await mutate("swap-create", {
          to: t.dataset.owner,
          give: [$("#swap-give").value],
          take: [t.value],
        });
        modal.close();
        toast("Обмен предложен");
        break;
      }
      case "swap-confirm": {
        const x = state.me.swaps.find((x) => x.id === id);
        show(
          "Подтвердить обмен",
          `<p>Вы получите: ${esc(JSON.parse(x.give).join(", "))}</p><p>Вы отдаёте: ${esc(JSON.parse(x.take).join(", "))}</p>${btn("Подтвердить", "swap-accept", id, "accent")}`,
        );
        break;
      }
      case "swap-accept":
      case "swap-cancel":
        busy = true;
        await mutate(a, { id });
        modal.close();
        toast("Обмен обновлён");
        break;
      case "admin-check":
        busy = true;
        await api("admin/integrations", { method: "POST", body: "{}" });
        await renderAdmin();
        break;
      case "demo-switch":
        show(
          "Тестовые аккаунты",
          `<div class="detail"><p class="muted">Только локальный режим. Используйте разные роли для проверки сделок.</p>${btn("Демо-трейдер", "demo-login", "demo", "accent")}${btn("Продавец", "demo-login", "seller")}${btn("Покупатель", "demo-login", "buyer")}</div>`,
        );
        break;
      case "demo-login": {
        busy = true;
        const result = await api("auth", {
          method: "POST",
          body: JSON.stringify({ demo: true, account: id }),
        });
        state.token = result.token;
        sessionStorage.setItem("mm-session", state.token);
        state.cart.clear();
        await reload();
        modal.close();
        render();
        toast("Аккаунт переключён");
        break;
      }
      case "collection-stats": {
        const c = state.analytics.find((x) => x.collection === id);
        if (!c) throw Error("Нет данных");
        show(
          id,
          `<div class="detail"><div class="metric">${fmt(c.floor)} ${cur()}</div><p>Активных объявлений: ${esc(c.count)}</p>${[
            ["Модели", c.models, "model"],
            ["Фоны", c.backdrops, "backdrop"],
            ["Символы", c.symbols, "symbol"],
          ]
            .map(
              ([label, rows, k]) =>
                `<div class="panel"><h3>${label}</h3>${rows.map((r) => `<div class="row"><span>${esc(r[k])}</span><b>${fmt(r.floor)} ${cur()}</b></div>`).join("")}</div>`,
            )
            .join(
              "",
            )}<h3>Последние продажи</h3>${c.sales.map((r) => `<div class="row"><span>${new Date(Number(r.created)).toLocaleString("ru")}</span><b>${fmt(r.price)} ${cur()}</b></div>`).join("") || '<p class="muted">Нет продаж</p>'}</div>`,
        );
        break;
      }
      case "book-new": {
        const cs = [
          ...new Set(
            [...state.market, ...(state.me?.inventory || [])].map(
              (g) => g.collection,
            ),
          ),
        ];
        show(
          "Заявка на коллекцию",
          `<div class="detail"><label>Коллекция<select id="book-collection">${cs.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label><label>Модель (необязательно)<input id="book-model"></label><label>Фон (необязательно)<input id="book-backdrop"></label><label>Символ (необязательно)<input id="book-symbol"></label><label>Цена за подарок, ${cur()}<input id="book-price" inputmode="decimal"></label><label>Количество<input id="book-qty" type="number" min="1" max="30" value="1"></label><label>Срок<select id="book-hours"><option value="1">1 час</option><option value="6">6 часов</option><option value="24" selected>24 часа</option><option value="72">3 дня</option><option value="168">7 дней</option></select></label><p class="muted">Цена × количество будет зарезервирована до исполнения, отмены или истечения.</p>${btn("Создать и зарезервировать", "book-create", "", "accent")}</div>`,
        );
        break;
      }
      case "book-create":
        busy = true;
        await mutate("collection-offer", {
          collection: $("#book-collection").value,
          model: $("#book-model").value.trim(),
          backdrop: $("#book-backdrop").value.trim(),
          symbol: $("#book-symbol").value.trim(),
          price: $("#book-price").value,
          quantity: Number($("#book-qty").value),
          hours: Number($("#book-hours").value),
        });
        modal.close();
        toast("Заявка создана");
        break;
      case "book-cancel":
        show(
          "Отмена заявки",
          `<p>Неиспользованный резерв вернётся на баланс.</p>${btn("Отменить заявку", "book-cancel-confirm", id, "accent")}`,
        );
        break;
      case "book-cancel-confirm":
        busy = true;
        await mutate("collection-cancel", { id });
        modal.close();
        toast("Заявка отменена");
        break;
      case "book-fill": {
        const o = state.orderbook.find((x) => x.id === id);
        if (!o) throw Error("Заявка недоступна");
        quotedBook = o;
        const gs = matching(o);
        show(
          "Продать в заявку",
          `<div class="detail"><div class="metric">${fmt(o.price)} ${cur()}</div><p>К получению: ${fmt(BigInt(o.price) - (BigInt(o.price) * 2n) / 100n)} ${cur()}</p>${gs.length ? `<label>Выберите подарок<select id="book-gift">${gs.map((g) => `<option value="${esc(g.id)}">${esc(g.collection)} #${esc(g.number)}</option>`).join("")}</select></label>${btn("Подтвердить продажу", "book-confirm", id, "accent")}` : empty("Нет подходящих подарков")}</div>`,
        );
        break;
      }
      case "book-confirm":
        busy = true;
        if (!quotedBook || quotedBook.id !== id) throw Error("Обновите заявку");
        await mutate("collection-fill", {
          id,
          gift: $("#book-gift").value,
          price: quotedBook.price,
        });
        modal.close();
        toast("Подарок продан");
        break;
      case "quick-sell":
        quickSell(g);
        break;
      case "bundle-new": {
        const gs = (state.me?.inventory || []).filter(
          (g) => !g.bundle && !g.listing,
        );
        show(
          "Создать набор",
          `<div class="detail"><p class="muted">Выберите от 2 до 20 подарков без активных объявлений и офферов.</p>${gs.map((g) => `<label class="bundle-choice"><input type="checkbox" name="bundle-gift" value="${esc(g.id)}"> ${esc(g.collection)} #${esc(g.number)}</label>`).join("") || empty("Нет доступных подарков")}<label>Общая цена, ${cur()}<input id="bundle-price" inputmode="decimal"></label>${btn("Выставить набор", "bundle-create", "", "accent")}</div>`,
        );
        break;
      }
      case "bundle-create":
        busy = true;
        await mutate("bundle-create", {
          price: $("#bundle-price").value,
          gifts: [
            ...modal.querySelectorAll('[name="bundle-gift"]:checked'),
          ].map((x) => x.value),
        });
        modal.close();
        toast("Набор выставлен");
        break;
      case "bundle-detail": {
        const b = state.bundles.find((x) => x.id === id);
        if (!b) throw Error("Набор недоступен");
        quotedBundle = b;
        show(
          "Купить набор",
          `<div class="detail">${b.gifts.map((g) => `<div class="row">${esc(g.collection)} #${esc(g.number)}</div>`).join("")}<div class="metric">${fmt(b.price)} ${cur()}</div>${btn("Подтвердить покупку", "bundle-buy", b.id, "accent")}</div>`,
        );
        break;
      }
      case "bundle-buy":
        busy = true;
        if (quotedBundle?.id !== id) throw Error("Обновите набор");
        await mutate("bundle-buy", { id, version: quotedBundle.version });
        modal.close();
        toast("Набор куплен");
        break;
      case "bundle-cancel":
        show(
          "Расформировать набор",
          btn("Подтвердить", "bundle-cancel-confirm", id, "accent"),
        );
        break;
      case "bundle-cancel-confirm":
        busy = true;
        await mutate("bundle-cancel", { id });
        modal.close();
        toast("Набор расформирован");
        break;
      case "cart-partial":
        busy = true;
        {
          const r = await mutate("partial-buy", {
            items: [...state.cart.values()].map((x) => ({
              id: x.listing,
              version: x.version,
            })),
          });
          const rows = r.map((x) => {
            const g = [...state.cart.values()].find((g) => g.listing === x.id);
            if (x.ok && g) state.cart.delete(g.id);
            return `<div class="row"><span>${esc(g?.collection || x.id)}</span><b>${x.ok ? "Куплен" : esc(x.error)}</b></div>`;
          });
          render();
          show(
            "Результаты покупки",
            `<div class="detail">${rows.join("")}</div>`,
          );
          break;
        }
      case "personal-detail":
        personalDetail(id); break;
      case "inventory-filter": state.inventoryFilter=id;state.inventoryLimit=24;render();break;
      case "inventory-view": if(["grid","list"].includes(id)){state.inventoryView=id;setInventoryPref("view",id);for(const b of document.querySelectorAll("[data-action=inventory-view]")){b.classList.toggle("active",b.dataset.id===id);b.setAttribute("aria-pressed",String(b.dataset.id===id));}updateInventoryResults();}break;
      case "inventory-more-items": state.inventoryLimit=(state.inventoryLimit||24)+24;updateInventoryResults();break;
      case "inventory-reset": state.inventoryFilter="all";state.inventoryQuery="";state.inventoryTraits={};state.inventoryLimit=24;render();break;
      case "inventory-select-mode":
        state.inventorySelecting=!state.inventorySelecting;selectedRefs().clear();render();break;
      case "inventory-select-one":
        if(state.inventorySelecting&&state.personalGifts.some(x=>x.slug===id)){const set=selectedRefs();if(set.has(id))set.delete(id);else set.add(id);syncInventorySelection();}break;
      case "inventory-select-visible":
        if(state.inventorySelecting){for(const card of document.querySelectorAll("#inventory-results [data-inventory-key]"))selectedRefs().add(card.dataset.inventoryKey);syncInventorySelection();}break;
      case "inventory-batch-confirm":
        if(state.inventorySelecting&&selectedRefs().size)show("Убрать выбранные ссылки?",`<div class="detail"><p>Будут удалены только ссылки (${selectedRefs().size}). Оригинальные подарки останутся в Telegram.</p>${btn("Убрать ссылки","inventory-batch-remove","","danger-action")}${btn("Отмена","close")}</div>`);break;
      case "inventory-batch-refresh":
      case "inventory-batch-remove": {
        if(!state.inventorySelecting||!selectedRefs().size)break;
        busy=true;const action=a==="inventory-batch-refresh"?"refresh":"remove";
        el.disabled=true;
        try{
          const result=await api("personal-gifts/batch",{method:"POST",body:JSON.stringify({action,slugs:[...selectedRefs()]})});
          state.personalGifts=(await api("personal-gifts")).items;
          selectedRefs().clear();state.inventorySelecting=false;if(modal.open)modal.close();render();
          toast(action==="remove"?"Удалено ссылок: "+result.removed:"Найдено: "+result.observed+" · не найдено: "+result.notObserved+(result.skipped?" · пропущено: "+result.skipped:""));
        }finally{el.disabled=false;}
        break;
      }
      case "inventory-traits": inventoryFilterSheet();break;
      case "inventory-traits-apply": state.inventoryTraits=Object.fromEntries(inventoryTraits.map(([key])=>[key,$("#inv-"+key).value]));state.inventoryLimit=24;modal.close();render();break;
      case "inventory-traits-reset": state.inventoryTraits={};state.inventoryLimit=24;modal.close();render();break;
      case "catalog-open": state.page="market";state.tab="collections";render();scrollTo(0,0);break;
      case "personal-menu": personalMenu(id);break;
      case "personal-remove-confirm": show("Убрать ссылку?",`<div class="detail"><p>Подарок останется в Telegram. Удалится только ссылка из инвентаря MINION MARKET.</p>${btn("Убрать ссылку","personal-remove",id,"danger-action")}${btn("Отмена","personal-detail",id)}</div>`);break;
      case "activity-filter": if(["all","sold","listed"].includes(id)){state.activityFilter=id;render();}break;
      case "sales-tab": state.salesTab=id;render();break;
      case "home-filter":
        state.page="market"; state.tab="store"; render(); scrollTo(0,0); document.querySelector(".search [data-action=filters]")?.click(); break;
      case "open-offers":
        state.page="market"; state.tab="offers"; render(); scrollTo(0,0); break;
      case "nav":
        if(state.page!==id){try{window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();}catch{}}
        if(id!=="inventory"){state.inventorySelecting=false;selectedRefs().clear();}
        state.page = id;
        if(id==="market")state.tab="store";
        render();
        scrollTo(0,0);
        break;
      case "tab":
        state.tab = id;
        render();
        break;
      case "collection":
        state.collection = id;
        state.tab = "store";
        render();
        break;
      case "close":
        modal.close();
        break;
      case "detail":
        detail(g);
        break;
      case "buy":
        busy = true;
        await confirmBuy(g);
        break;
      case "buy-confirm":
        busy = true;
        if (!purchaseQuote || purchaseQuote.gift !== id)
          throw Error("Обновите котировку");
        await mutate("quote-buy", { id: purchaseQuote.id });
        purchaseQuote = null;
        modal.close();
        state.cart.delete(id);
        render();
        toast("Подарок куплен");
        break;
      case "favorite":
        busy = true;
        await mutate("favorite", { gift: id });
        break;
      case "cart-add":
        if (state.cart.has(id)) state.cart.delete(id);
        else state.cart.set(id, g);
        render();
        break;
      case "cart":
        cart();
        break;
      case "cart-remove":
        state.cart.delete(id);
        render();
        cart();
        break;
      case "cart-buy":
        busy = true;
        await mutate("bulk-buy", {
          items: [...state.cart.values()].map((x) => ({
            id: x.listing,
            version: x.version,
          })),
        });
        state.cart.clear();
        modal.close();
        render();
        toast("Покупка завершена");
        break;
      case "sell":
        inputSheet(
          "Выставить подарок",
          "Цена в " + cur() + " · комиссия продавца 2%",
          "sell-confirm",
          id,
          g.price ? fmt(g.price) : "",
        );
        break;
      case "sell-confirm":
        busy = true;
        await mutate("list", { gift: id, price: $("#value").value });
        modal.close();
        toast("Объявление сохранено");
        break;
      case "delist":
        show(
          "Снять объявление",
          btn("Подтвердить", "delist-confirm", id, "accent"),
        );
        break;
      case "delist-confirm":
        busy = true;
        await mutate("delist", { gift: id });
        modal.close();
        toast("Объявление снято");
        break;
      case "offer":
        inputSheet(
          "Сделать оффер",
          "Цена в " + cur() + " · резерв на 24 часа",
          "offer-confirm",
          id,
        );
        break;
      case "offer-confirm":
        busy = true;
        await mutate("offer", { gift: id, price: $("#value").value });
        modal.close();
        toast("Оффер создан");
        break;
      case "accept":
        show(
          "Принять предложение",
          btn("Подтвердить", "accept-confirm", id, "accent"),
        );
        break;
      case "accept-confirm":
      case "cancel":
        busy = true;
        await mutate(a === "cancel" ? "cancel" : "accept", { id });
        modal.close();
        toast("Операция выполнена");
        break;
      case "send":
        show(
          "Передача подарка",
          `<div class="detail"><label>Тестовый получатель<select id="recipient"><option value="seller">Тестовый продавец</option><option value="buyer">Тестовый покупатель</option></select></label>${btn("Передать", "send-confirm", id, "accent")}</div>`,
        );
        break;
      case "send-confirm":
        busy = true;
        await mutate("send", { gift: id, to: $("#recipient").value });
        modal.close();
        toast("Подарок передан");
        break;
      case "wallet": {
        const w=state.walletConnection;
        show("Кошелёк",`<div class="detail"><div class="wallet-summary"><b>${w?"Подключение подтверждено":"Кошелёк не подключён"}</b>${w?`<p class="muted">Сеть: ${w.network==="-239"?"Mainnet":w.network==="-3"?"Testnet":"Неизвестна"}</p><p class="wallet-address">${esc(w.address)}</p>${btn(icon("copy")+" Копировать адрес","wallet-copy")}`:""}</div><div class="trait-table"><div class="trait-row"><span>Внешний баланс</span><b>Не получен</b></div><div class="trait-row"><span>Торговый баланс</span><b>${state.config.demo?fmt(state.me?.balance.available||0)+" "+esc(cur()):"Недоступен"}</b></div></div><p class="muted">Реальные депозиты и вывод отключены.</p>${w?btn("Отключить кошелёк","disconnect","","danger-action"):btn("Подключить кошелёк","connect","","accent")}${btn("История операций","history")}</div>`);
        break;
      }
      case "wallet-copy":
        if(state.walletConnection?.address){await navigator.clipboard.writeText(state.walletConnection.address);toast("Адрес скопирован");}
        break;
      case "history":
        show(
          "История баланса",
          `<div class="panel">${(state.me?.history || []).map((x) => `<div class="row"><span>${esc(x.kind)}</span><b>${fmt(x.amount)} ${cur()}</b></div>`).join("")}</div>`,
        );
        break;
      case "connect":
        await connect();
        break;
      case "disconnect":
        if (proofListener) {
          proofListener();
          proofListener = null;
        }
        if (tonUI) await tonUI.disconnect();
        if (!state.config.demo)
          await api("wallet/connection", { method: "DELETE" });
        state.walletConnection=null;modal.close();render();
        break;
      case "deposit-gift":
        show("Добавить подарок",`<div class="detail"><p>Вставьте ссылку на свой подарок Telegram. Маркет проверит его через Telegram API.</p><label>Ссылка<input id="gift-link" type="url" placeholder="https://t.me/nft/PlushPepe-123"></label>${btn("Добавить","personal-add","","accent")}<p class="muted">Импорт не переводит подарок на хранение и не разрешает реальные сделки.</p></div>`);
        break;
      case "personal-refresh": {
        busy=true;const result=await api("personal-gifts/batch",{method:"POST",body:JSON.stringify({action:"refresh",slugs:[id]})});
        state.personalGifts=(await api("personal-gifts")).items;state.page="inventory";render();personalDetail(id);
        toast(result.observed?"Подарок найден в Telegram":"Подарок не найден при проверке");break;
      }
      case "personal-add": {
        busy=true;
        const link=$("#gift-link").value.trim();
        await api("personal-gifts",{method:"POST",body:JSON.stringify({link})});
        state.personalGifts=(await api("personal-gifts")).items;
        state.page="inventory"; modal.close(); render(); toast("Подарок найден в Telegram");
        break;
      }
      case "personal-remove":
        busy=true;
        if(modal.open)modal.close();
        await api("personal-gifts",{method:"DELETE",body:JSON.stringify({slug:id})});
        state.personalGifts=(await api("personal-gifts")).items;
        render(); toast("Ссылка удалена из инвентаря");
        break;
      case "personal-sale":
        show("Продажа подарка",`<div class="detail"><p>Продажа за реальные средства в MINION MARKET ещё отключена. Если подарок доступен для продажи в Telegram, откройте его в Telegram и используйте штатную продажу.</p><a class="gift-link" href="https://t.me/nft/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">Открыть подарок в Telegram</a></div>`);
        break;
      case "filters": {
        const sel = (k, title) =>
          `<label>${title}<select id="f-${k}"><option value="">Все</option>${[...new Set(state.market.map((x) => x[k]))].map((v) => `<option ${state[k] === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
        show(
          "Фильтры",
          `<div class="detail">${sel("collection", "Коллекция")}${sel("model", "Модель")}${sel("backdrop", "Фон")}${sel("symbol", "Символ")}<label>Макс. цена<input id="f-max" value="${esc(state.max)}" type="number" min="0"></label>${btn("Применить", "filter-apply", "", "accent")}${btn("Сбросить", "filter-reset")}</div>`,
        );
        break;
      }
      case "filter-apply":
        for (const k of ["collection", "model", "backdrop", "symbol", "max"])
          state[k] = $("#f-" + k).value;
        modal.close();
        render();
        break;
      case "filter-reset":
        for (const k of ["collection", "model", "backdrop", "symbol", "max"])
          state[k] = "";
        modal.close();
        render();
        break;
      case "sweep":
        show(
          "Sweep",
          `<div class="detail"><label>Количество<input id="s-count" type="number" min="1" max="30" value="3"></label><label>Максимальная цена за подарок<input id="s-price" type="number" min="0" value="5"></label>${btn("Подобрать подарки", "sweep-apply", "", "accent")}</div>`,
        );
        break;
      case "sweep-apply": {
        const count = Number($("#s-count").value),
          price = Number($("#s-price").value);
        if (
          !Number.isInteger(count) ||
          count < 1 ||
          count > 30 ||
          !Number.isFinite(price) ||
          price <= 0
        )
          throw Error("Проверьте параметры");
        state.cart = new Map(
          state.market
            .filter(
              (g) =>
                (!state.collection || g.collection === state.collection) &&
                Number(fmt(g.price)) <= price &&
                !state.me?.inventory.some((x) => x.id === g.id),
            )
            .sort((a, b) => Number(a.price) - Number(b.price))
            .slice(0, count)
            .map((g) => [g.id, g]),
        );
        render();
        cart();
        break;
      }
      case "favorites":
        show(
          "Избранное",
          `<div class="grid">${state.market
            .filter((g) => state.me?.favorites.includes(g.id))
            .map((g) => giftCard(g))
            .join("")}</div>`,
        );
        break;
      case "support":
        show(
          "Поддержка",
          `<div class="detail"><textarea id="message" rows="4" placeholder="Опиши проблему"></textarea>${btn("Создать тикет", "ticket", "", "accent")}</div>`,
        );
        break;
      case "ticket":
        busy = true;
        await mutate("ticket", { message: $("#message").value });
        modal.close();
        toast("Тикет создан");
        break;
      case "refresh":
        await reload();
        render();
        break;
    }
  } catch (err) {
    toast(err.message);
  } finally {
    busy = false;
  }
});
let startupComplete=false;
function finishSplash(){
 const splash=document.getElementById("splash");
 if(!splash)return;
 splash.setAttribute("aria-hidden","true");
 if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){splash.remove();return;}
 splash.classList.add("splash-exit");
 setTimeout(()=>splash.remove(),240);
}
async function init() {
  try {
    const startRoute = new URLSearchParams(location.search).get("startapp");
    if (["home","market","inventory","giveaways","profile","sales","activity"].includes(startRoute)) state.page=startRoute;
    if(startRoute==="offers"){state.page="market";state.tab="offers";}
    if(startRoute==="wallet")state.page="profile";
    for (let i = 0; i < 20 && !window.Telegram?.WebApp; i++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    state.config = await api("config");
    await reload();
    if (!state.token) {
      const initData =
        window.Telegram?.WebApp?.initData ||
        new URLSearchParams(location.hash.slice(1)).get("tgWebAppData");
      if (state.config.demo || initData) {
        const result = await api("auth", {
          method: "POST",
          body: JSON.stringify(
            state.config.demo ? { demo: true } : { initData },
          ),
        });
        state.token = result.token;
        sessionStorage.setItem("mm-session", state.token);
        await reload();
      }
    }
    render();
  } catch (e) {
    app.innerHTML = empty("Не удалось запустить маркет", esc(e.message));
  } finally {startupComplete=true;finishSplash();}
}
init();
const feed = new EventSource("/api/v1/stream");
let firstFeed = true;
feed.addEventListener("market", async () => {
  if (firstFeed) {
    firstFeed = false;
    return;
  }
  if (!startupComplete || busy || modal.open || ["search","inventory-search","home-search","inventory-sort"].includes(document.activeElement?.id)) return;
  try {
    await reload();
    render();
  } catch {}
});
