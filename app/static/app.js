const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
if (tg) { tg.setHeaderColor('#f4f7ff'); tg.setBackgroundColor('#f4f7ff'); }

const state = { gifts: [], facets: {}, filter: 'all', selected: {}, favorites: new Set(JSON.parse(localStorage.getItem('limuzinov-scope:favorites') || '[]')) };
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const grid = $('#giftGrid'), empty = $('#emptyState'), search = $('#search'), panel = $('#facetPanel');
const rub = n => n ? `${Number(n).toLocaleString('ru-RU')} ⭐` : 'Нет оценки';
const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const plural = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'подарок' : [2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100) ? 'подарка' : 'подарков'}`;

async function api(url, options) {
  const res = await fetch(url, { headers: {'Content-Type':'application/json'}, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Не удалось выполнить запрос');
  return data;
}

function card(g) {
  const saved = state.favorites.has(g.slug);
  const rarity = Math.min(...[g.model_rarity,g.backdrop_rarity,g.symbol_rarity].filter(x => x != null));
  return `<article class="gift-card" data-slug="${esc(g.slug)}" tabindex="0" aria-label="${esc(g.collection)} номер ${g.number}">
    <div class="gift-visual" style="--center:${esc(g.center_color)};--edge:${esc(g.edge_color)}">
      <span class="rarity">${rarity ? `редкость ${rarity}%` : 'collectible'}</span>
      <button class="heart ${saved?'saved':''}" data-heart="${esc(g.slug)}" aria-label="В избранное">${saved?'♥':'♡'}</button>
      ${g.image_url ? `<img src="${esc(g.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="gift-fallback">🎁</span>'}
    </div>
    <div class="gift-info"><span class="gift-name">${esc(g.collection)} #${g.number}</span><span class="gift-meta">${esc(g.model)} · ${esc(g.backdrop)}</span><span class="gift-price"><strong>${rub(g.price_stars)}</strong><small>${g.price_usd ? `≈ $${g.price_usd}` : 'оценка'}</small></span></div>
  </article>`;
}

function render() {
  const q = search.value.trim().toLowerCase();
  let items = state.gifts.filter(g => !q || [g.collection,g.owner_name,g.model,g.backdrop,g.symbol,g.slug,String(g.number)].some(v => String(v||'').toLowerCase().includes(q)));
  for (const [key, value] of Object.entries(state.selected)) {
    if (value) items = items.filter(g => g[key] === value);
  }
  if ($('#favoritesNav').classList.contains('active')) items = items.filter(g => state.favorites.has(g.slug));
  grid.innerHTML = items.map(card).join('');
  grid.hidden = !items.length; empty.hidden = !!items.length;
  $('#resultCount').textContent = plural(items.length);
  $('#resultTitle').textContent = $('#favoritesNav').classList.contains('active') ? 'Избранное' : q ? 'Результаты' : 'Подборка';
  $('#searchClear').hidden = !search.value;
}

function renderFacets() {
  if (state.filter === 'all') { panel.hidden = true; panel.innerHTML = ''; return; }
  panel.hidden = false;
  panel.innerHTML = (state.facets[state.filter] || []).map(x => `<button class="facet-option ${state.selected[state.filter]===x?'selected':''}" data-value="${esc(x)}">${esc(x)}</button>`).join('');
}

function showDetail(g) {
  const saved = state.favorites.has(g.slug);
  $('#detailContent').innerHTML = `
    <div class="detail-stage" style="--center:${esc(g.center_color)};--edge:${esc(g.edge_color)}">${g.image_url?`<img src="${esc(g.image_url)}" alt="${esc(g.collection)}">`:'<span class="detail-gift">🎁</span>'}</div>
    <h2 class="detail-title">${esc(g.collection)} #${g.number}</h2><p class="detail-owner">Владелец · ${esc(g.owner_name)}</p>
    <div class="attribute-list">
      ${attribute('✦','Модель',g.model,g.model_rarity)}${attribute('◐','Фон',g.backdrop,g.backdrop_rarity)}${attribute('◌','Узор',g.symbol,g.symbol_rarity)}
    </div>
    <div class="price-box"><div><span>Ориентировочная цена</span><br><strong>${rub(g.price_stars)}</strong></div><div><span>${esc(g.price_source || 'Данных пока нет')}</span><br><strong>${g.price_ton ? `${g.price_ton} TON` : '—'}</strong></div></div>
    <div class="detail-actions">${g.owner_url ? `<a class="telegram-link" href="${esc(g.owner_url)}">Написать владельцу</a>` : `<a class="telegram-link" href="${esc(g.source_url)}">Открыть подарок</a>`}<button class="detail-heart ${saved?'saved':''}" data-heart="${esc(g.slug)}">${saved?'♥':'♡'}</button></div>
    ${g.owner_url ? `<a class="source-link" href="${esc(g.source_url)}">Открыть оригинал в Telegram</a>` : '<p class="owner-private">Telegram скрыл ссылку владельца — открыть чат напрямую нельзя.</p>'}`;
  $('#detailDialog').showModal(); tg?.HapticFeedback?.impactOccurred('light');
}
function attribute(icon,label,value,rarity){return `<div class="attribute"><div class="attribute-icon">${icon}</div><div><span>${label}</span><strong>${esc(value)}</strong></div><em>${rarity != null ? rarity+'%' : '—'}</em></div>`}

function toggleFavorite(slug) {
  state.favorites.has(slug) ? state.favorites.delete(slug) : state.favorites.add(slug);
  localStorage.setItem('limuzinov-scope:favorites', JSON.stringify([...state.favorites]));
  render();
  const g = state.gifts.find(x => x.slug === slug); if ($('#detailDialog').open && g) showDetailRefresh(g);
  toast(state.favorites.has(slug) ? 'Добавлено в избранное' : 'Удалено из избранного');
  tg?.HapticFeedback?.selectionChanged();
}
function showDetailRefresh(g){ $('#detailDialog').close(); showDetail(g); }
let toastTimer; function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}

document.addEventListener('click', e => {
  const heart = e.target.closest('[data-heart]'); if (heart) { e.stopPropagation(); toggleFavorite(heart.dataset.heart); return; }
  const cardEl = e.target.closest('.gift-card'); if (cardEl) { showDetail(state.gifts.find(g => g.slug === cardEl.dataset.slug)); return; }
  const filter = e.target.closest('.filter'); if (filter) {
    if (filter.dataset.filter === 'all') { state.selected = {}; state.filter = 'all'; }
    else { state.filter = filter.dataset.filter; }
    $$('.filter').forEach(x => x.classList.toggle('active', x.dataset.filter === state.filter || (x.dataset.filter !== 'all' && state.selected[x.dataset.filter])));
    renderFacets(); render(); return;
  }
  const option = e.target.closest('.facet-option'); if(option){
    state.selected[state.filter] = state.selected[state.filter] === option.dataset.value ? '' : option.dataset.value;
    $$('.filter').forEach(x => x.classList.toggle('active', x.dataset.filter === state.filter || (x.dataset.filter !== 'all' && state.selected[x.dataset.filter])));
    renderFacets(); render(); return;
  }
  if(e.target.closest('[data-import]') || e.target.closest('#openImport')) { $('#importDialog').showModal(); setTimeout(()=>$('#importUrl').focus(),150); }
  if(e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
search.addEventListener('input', render); $('#searchClear').addEventListener('click',()=>{search.value='';render();search.focus()});
$('#favoritesNav').addEventListener('click', e=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));e.currentTarget.classList.add('active');render()});
$('.nav-item.active').addEventListener('click',()=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));$('.nav-item').classList.add('active');render()});
$('#importSubmit').addEventListener('click', async()=>{
  const button=$('#importSubmit'), error=$('#importError'); error.textContent=''; button.disabled=true; button.textContent='Проверяем Telegram…';
  try { const gift=await api('/api/import',{method:'POST',body:JSON.stringify({url:$('#importUrl').value})}); state.gifts=[gift,...state.gifts.filter(g=>g.slug!==gift.slug)]; $('#importDialog').close(); $('#importUrl').value=''; render(); showDetail(gift); toast('Подарок добавлен'); }
  catch(e){error.textContent=e.message;tg?.HapticFeedback?.notificationOccurred('error')}
  finally{button.disabled=false;button.textContent='Найти и добавить'}
});

async function init(){
  try { const [gifts,facets]=await Promise.all([api('/api/gifts'),api('/api/facets')]); state.gifts=gifts.items;state.facets=facets;render();
    const similar=new URLSearchParams(location.search).get('similar'); if(similar){const source=state.gifts.find(g=>g.slug===similar);if(source){search.value=source.collection;render()}}
  } catch(e){empty.hidden=false;grid.hidden=true;$('#resultCount').textContent='Ошибка';toast(e.message)}
}
init();

