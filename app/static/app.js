(() => {
  'use strict';
  const APP_BUILD = 'media-proxy-v5';
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  try {
    tg?.setHeaderColor?.('#f5f6fa');
    tg?.setBackgroundColor?.('#f5f6fa');
  } catch (_) {}
  if (tg?.colorScheme === 'dark') document.documentElement.classList.add('dark');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'}[c]));
  const icon = name => '<i data-lucide="' + name + '"></i>';
  const icons = () => window.lucide?.createIcons?.({attrs: {'stroke-width': 1.85}});
  const identity = tg?.initDataUnsafe?.user?.id || 'guest';
  const favoriteKey = 'lim-gifts:favorites:' + identity;
  const presetsKey = 'lim-gifts:presets:' + identity;
  const readSaved = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
    catch (_) { return fallback; }
  };
  const persist = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  };
  const stagePlayers = new Map();
  const failedAnimations = new Set();
  const pageSize = 48;
  const fields = [
    ['collection', 'Коллекция', 'gift'],
    ['model', 'Модель', 'shapes'],
    ['backdrop', 'Фон', 'palette'],
    ['symbol', 'Узор', 'flower-2'],
  ];
  const state = {
    gifts: [], facetValues: {}, filters: {}, q: '', tab: 'catalog',
    total: 0, catalogTotal: 0, nextOffset: null, loading: false, request: 0,
    favorites: new Set(readSaved(favoriteKey, [])),
    presets: readSaved(presetsKey, []),
  };
  const grid = $('#giftGrid');
  const search = $('#search');
  const savedView = document.createElement('div');
  savedView.id = 'savedView';
  savedView.className = 'saved-view';
  savedView.hidden = true;
  grid.before(savedView);
  const money = n => n != null ? Number(n).toLocaleString('ru-RU') + ' ⭐' : 'Цена не указана';
  const number = n => Number(n || 0).toLocaleString('ru-RU');
  const cleanUrl = value => {
    try {
      const parsed = new URL(String(value));
      return parsed.protocol === 'https:' && ['t.me', 'telegram.me'].includes(parsed.hostname.toLowerCase()) ? parsed.href : '';
    } catch (_) { return ''; }
  };
  const slugUrl = slug => '/api/animation/' + encodeURIComponent(slug);
  const giftTitle = g => g.collection + ' #' + g.number;
  const gradient = g => '--gift-center:' + esc(g.center_color || '#8678cd') + ';--gift-edge:' + esc(g.edge_color || '#404b8e') + ';';
  let toastTimer = null;

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2700);
  }

  async function api(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      ...options, headers: {'Content-Type': 'application/json', ...(options.headers || {})},
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.detail || 'Не удалось загрузить данные');
    return data;
  }

  function showDialog(selector) {
    const dialog = $(selector);
    if (!dialog.open) dialog.showModal();
    icons();
    tg?.HapticFeedback?.impactOccurred?.('light');
  }

  function fragmentPreview(slug, extension = 'medium.jpg') {
    if (!/^[a-z0-9][a-z0-9_-]*-\d+$/i.test(String(slug || ''))) return '';
    return 'https://nft.fragment.com/gift/' + slug.toLowerCase() + '.' + extension;
  }

  function art(g, isDetail = false) {
    const preview = '/api/artwork/' + encodeURIComponent(g.slug);
    const secondary = g.image_url && /^https:\/\//i.test(g.image_url)
      ? g.image_url : fragmentPreview(g.slug, 'medium.jpg');
    const last = fragmentPreview(g.slug, 'webp');
    const image = '<img class="gift-preview" alt="' + esc(giftTitle(g)) +
      '" src="' + esc(preview) + '" data-secondary="' + esc(secondary) +
      '" data-tertiary="' + esc(last) +
      '" loading="' + (isDetail ? 'eager' : 'lazy') + '" referrerpolicy="no-referrer">';
    return '<div class="gift-art ' + (isDetail ? 'large-art' : '') +
      '" style="' + gradient(g) + '" data-animation="' + esc(g.slug) + '">' +
      '<div class="gift-pattern" aria-hidden="true"></div>' +
      '<div class="gift-fallback"><div class="gift-placeholder" aria-hidden="true">' +
        '<span class="media-loader"></span><span class="media-state">Загрузка NFT</span></div>' +
        image + '</div>' +
      '<div class="gift-lottie" aria-hidden="true"></div></div>';
  }

  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('gift-preview')) return;
    const attempt = Number(img.dataset.retry || 0);
    const next = [img.dataset.secondary, img.dataset.tertiary][attempt];
    if (next && img.src !== next) {
      img.dataset.retry = String(attempt + 1);
      img.src = next;
      return;
    }
    img.hidden = true;
    const status = img.parentElement?.querySelector('.media-state');
    if (status) status.textContent = 'Медиа недоступно';
    const spinner = img.parentElement?.querySelector('.media-loader');
    if (spinner) spinner.hidden = true;
  }, true);

  document.addEventListener('load', event => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains('gift-preview')) {
      img.parentElement?.classList.add('image-ready');
    }
  }, true);

  function card(g) {
    const saved = state.favorites.has(g.slug);
    return '<article class="gift-card" tabindex="0" data-slug="' + esc(g.slug) +
      '" aria-label="' + esc(giftTitle(g)) + '">' +
      '<div class="card-art">' + art(g) +
      '<button type="button" class="favorite-button ' + (saved ? 'active' : '') + '" data-heart="' +
      esc(g.slug) + '" aria-label="' + (saved ? 'Убрать из избранного' : 'В избранное') + '">' +
      icon('heart') + '</button></div>' +
      '<div class="card-copy"><div class="card-name">' + esc(giftTitle(g)) + '</div>' +
      '<div class="card-attrs">' + esc(g.model) + ' <span>·</span> ' + esc(g.backdrop) + '</div>' +
      '<div class="card-foot"><strong>' + money(g.price_stars) + '</strong>' +
      '<span class="card-arrow">' + icon('arrow-up-right') + '</span></div></div></article>';
  }

  const animationObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const el = entry.target;
      if (!el.isConnected) continue;
      if (entry.isIntersecting) startAnimation(el);
      else stagePlayers.get(el)?.pause?.();
    }
  }, {rootMargin: '100px 0px'}) : null;

  function stopAnimations() {
    for (const [el, player] of stagePlayers) {
      try { player.destroy(); } catch (_) {}
      animationObserver?.unobserve(el);
    }
    stagePlayers.clear();
    $$('.gift-art[data-animation]').forEach(el => animationObserver?.unobserve(el));
  }

  function connectAnimations(root = document) {
    $$('.gift-art[data-animation]', root).forEach(el => {
      if (animationObserver) animationObserver.observe(el);
      else startAnimation(el);
    });
  }

  function startAnimation(el) {
    if (!el.isConnected || !window.lottie || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const slug = el.dataset.animation;
    if (failedAnimations.has(slug)) return;
    if (stagePlayers.has(el)) { stagePlayers.get(el).play?.(); return; }
    const container = $('.gift-lottie', el);
    if (!container) return;
    try {
      const player = window.lottie.loadAnimation({
        container, renderer: 'svg', loop: true, autoplay: false, path: slugUrl(slug),
        rendererSettings: {preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true},
      });
      stagePlayers.set(el, player);
      player.addEventListener('DOMLoaded', () => {
        if (!el.isConnected) return;
        el.classList.add('has-animation');
        player.play();
      });
      player.addEventListener('data_failed', () => {
        failedAnimations.add(slug);
        el.classList.remove('has-animation');
        try { player.destroy(); } catch (_) {}
        stagePlayers.delete(el);
      });
    } catch (_) {
      failedAnimations.add(slug);
      el.classList.remove('has-animation');
    }
  }

  function setActiveNav() {
    $$('.tab[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === state.tab));
    icons();
  }

  function renderCollections() {
    const list = state.facetValues.collection || [];
    const chosen = state.filters.collection || '';
    $('#collectionRail').innerHTML = '<button class="collection-chip ' + (!chosen ? 'selected' : '') +
      '" data-collection="">Все</button>' +
      list.map(name => '<button type="button" class="collection-chip ' + (chosen === name ? 'selected' : '') +
        '" data-collection="' + esc(name) + '">' + esc(name) + '</button>').join('');
  }

  function renderActiveFilters() {
    const active = fields.filter(([key]) => state.filters[key]);
    const tagArea = $('#activeFilters');
    tagArea.innerHTML = active.map(([key, label]) =>
      '<button class="selected-filter" type="button" data-remove-filter="' + key + '"><span>' +
      esc(label) + ': ' + esc(state.filters[key]) + '</span>' + icon('x') + '</button>').join('');
    tagArea.hidden = !active.length;
    $('#activeFilterCount').textContent = String(active.length);
    $('#activeFilterCount').hidden = !active.length;
    icons();
  }

  function renderFacetOptions(key, term = '') {
    const values = (state.facetValues[key] || []).filter(x => x.toLowerCase().includes(term.toLowerCase()));
    const selected = state.filters[key] || '';
    const shown = values.slice(0, 80);
    const element = $('[data-facet-options="' + key + '"]');
    if (!element) return;
    element.innerHTML = '<button type="button" class="facet-pill ' + (!selected ? 'chosen' : '') +
      '" data-facet-key="' + key + '" data-facet-value="">Любой</button>' +
      shown.map(x => '<button type="button" class="facet-pill ' + (x === selected ? 'chosen' : '') +
        '" data-facet-key="' + key + '" data-facet-value="' + esc(x) + '">' + esc(x) + '</button>').join('') +
      (values.length > shown.length ? '<small class="facet-help">Уточни название в поиске выше</small>' : '');
  }

  function renderFilterGroups() {
    $('#filterGroups').innerHTML = fields.map(([key, label, glyph], index) => {
      const selected = state.filters[key];
      return '<details class="filter-group" ' + (index < 2 ? 'open' : '') + '>' +
        '<summary>' + icon(glyph) + '<span>' + label + '</span><small>' + esc(selected || 'Любой') +
        '</small>' + icon('chevron-down') + '</summary>' +
        '<div class="facet-body"><input class="facet-search" type="search" data-facet-search="' + key +
        '" placeholder="Найти ' + label.toLowerCase() + '…" autocomplete="off">' +
        '<div class="facet-options" data-facet-options="' + key + '"></div></div></details>';
    }).join('');
    for (const [key] of fields) renderFacetOptions(key);
    icons();
  }

  function emptyMessage(title, description, button = 'Добавить подарок') {
    $('#emptyTitle').textContent = title;
    $('#emptyText').textContent = description;
    $('#emptyAction').innerHTML = esc(button) + ' ' + icon('arrow-up-right');
    $('#emptyState').hidden = false;
    icons();
  }

  function renderGiftCards(items) {
    stopAnimations();
    grid.innerHTML = items.map(card).join('');
    grid.hidden = !items.length;
    $('#skeletonGrid').hidden = true;
    $('#emptyState').hidden = !!items.length;
    icons();
    connectAnimations(grid);
  }

  function updateLoadMore() {
    $('#loadMore').hidden = state.tab !== 'catalog' || state.nextOffset == null || !state.gifts.length;
    $('#loadMore').disabled = state.loading;
  }

  function syncHead() {
    $('#resultTitle').textContent = state.tab === 'favorites' ? 'Избранные' :
      state.tab === 'saved' ? 'Мои подборки' : 'Все подарки';
    $('#resultSubtitle').textContent = state.tab === 'favorites' ? 'Сохранённые конкретные NFT' :
      state.tab === 'saved' ? 'Твои фильтры и параметры' : 'Коллекционные подарки из Telegram';
    $('#resultCount').textContent = state.tab === 'catalog' ? number(state.total) + ' найдено' :
      state.tab === 'favorites' ? String(state.favorites.size) + ' сохранено' : String(state.presets.length) + ' подборок';
    $('#catalogCount').textContent = number(state.catalogTotal);
  }

  async function fetchCatalog(append = false) {
    const request = ++state.request;
    state.loading = true;
    if (!append) {
      stopAnimations(); grid.innerHTML = ''; grid.hidden = true;
      $('#skeletonGrid').hidden = false; $('#emptyState').hidden = true;
    }
    updateLoadMore();
    const params = new URLSearchParams({q: search.value.trim(), limit: String(pageSize)});
    for (const [key, value] of Object.entries(state.filters)) if (value) params.set(key, value);
    if (append && state.nextOffset != null) params.set('offset', String(state.nextOffset));
    try {
      const data = await api('/api/gifts?' + params.toString());
      if (request !== state.request || state.tab !== 'catalog') return;
      state.gifts = append ? [...state.gifts, ...data.items] : data.items;
      state.total = data.total;
      if (!search.value.trim() && !Object.values(state.filters).some(Boolean)) state.catalogTotal = data.total;
      state.nextOffset = data.next_offset;
      renderGiftCards(state.gifts);
      if (!state.gifts.length) {
        emptyMessage(
          state.total ? 'Подарки не загрузились' : 'Подарков пока нет',
          'В каталоге показываются только реальные NFT. Добавь ссылку или подключи синхронизацию Telegram.',
        );
      }
      syncHead();
    } catch (error) {
      if (request !== state.request) return;
      if (!append) renderGiftCards([]);
      emptyMessage('Не удалось открыть каталог', error.message, 'Повторить');
    } finally {
      if (request === state.request) {
        state.loading = false; $('#skeletonGrid').hidden = true; updateLoadMore();
      }
    }
  }

  function renderPresets() {
    stopAnimations();
    grid.hidden = true; $('#emptyState').hidden = true;
    $('#skeletonGrid').hidden = true; $('#loadMore').hidden = true;
    savedView.hidden = false;
    savedView.innerHTML = state.presets.map((preset, index) =>
      '<div class="preset-card"><div class="preset-icon">' + icon('bookmark') +
      '</div><button type="button" class="preset-open" data-preset="' + index + '">' +
      '<strong>' + esc(preset.title) + '</strong><span>' + esc(preset.query || 'Фильтры подарков') +
      '</span></button><button class="preset-delete" type="button" data-delete-preset="' + index +
      '" aria-label="Удалить подборку">' + icon('trash-2') + '</button></div>').join('');
    if (!state.presets.length) emptyMessage('Нет сохранённых подборок',
      'Выбери модель, фон и узор в фильтрах, затем сохрани набор параметров.', 'Открыть фильтры');
    icons();
  }

  async function renderFavorites() {
    const request = ++state.request;
    state.loading = true;
    stopAnimations(); savedView.hidden = true;
    grid.hidden = true; $('#skeletonGrid').hidden = true;
    $('#loadMore').hidden = true; $('#emptyState').hidden = true;
    const slugs = Array.from(state.favorites).slice(0, 200);
    if (!slugs.length) {
      renderGiftCards([]);
      emptyMessage('Здесь пока пусто', 'Открывай подарки и нажимай сердечко, чтобы сохранить точный NFT.', 'В каталог');
      state.loading = false; syncHead(); return;
    }
    const result = await Promise.all(slugs.map(async slug => {
      const cached = state.gifts.find(g => g.slug === slug);
      if (cached) return cached;
      try { return await api('/api/gifts/' + encodeURIComponent(slug)); }
      catch (_) { return null; }
    }));
    if (request !== state.request || state.tab !== 'favorites') return;
    const q = search.value.trim().toLowerCase();
    const filtered = result.filter(Boolean).filter(g =>
      !q || [g.collection,g.owner_name,g.model,g.backdrop,g.symbol,g.slug].some(x =>
        String(x || '').toLowerCase().includes(q)));
    renderGiftCards(filtered);
    if (!filtered.length) emptyMessage('Ничего не найдено', 'В избранном нет подарков с таким названием.', 'В каталог');
    state.loading = false; syncHead();
  }

  function setTab(tab) {
    state.tab = tab;
    state.request++;
    search.placeholder = tab === 'favorites' ? 'Искать в избранном…' :
      'Название, модель, фон, узор, @ник…';
    if (tab === 'saved') search.value = '';
    savedView.hidden = true;
    $('.discovery').classList.toggle('hidden-discovery', tab === 'saved');
    setActiveNav(); syncHead();
    if (tab === 'catalog') fetchCatalog();
    else if (tab === 'favorites') renderFavorites();
    else renderPresets();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function filterChanged() {
    renderCollections();
    renderActiveFilters();
    renderFilterGroups();
    if (state.tab !== 'catalog') state.tab = 'catalog';
    setActiveNav();
    savedView.hidden = true; $('.discovery').classList.remove('hidden-discovery');
    fetchCatalog();
  }

  function renderDetail(g) {
    const saved = state.favorites.has(g.slug);
    const owner = cleanUrl(g.owner_url);
    const source = cleanUrl(g.source_url) || 'https://t.me/nft/' + encodeURIComponent(g.slug);
    const attrib = (label, glyph, name, rarity) =>
      '<div class="spec"><div class="spec-icon">' + icon(glyph) + '</div><span>' + esc(label) +
      '</span><strong>' + esc(name || 'Неизвестно') + '</strong><em>' +
      (rarity != null ? esc(rarity) + '%' : '—') + '</em></div>';
    const detail = $('#detailContent');
    stopAnimations();
    detail.innerHTML = '<div class="detail-hero">' + art(g, true) + '</div>' +
      '<div class="detail-heading"><div><span class="detail-overline">Коллекционный NFT</span>' +
      '<h2>' + esc(giftTitle(g)) + '</h2></div>' +
      '<button type="button" class="detail-heart ' + (saved ? 'active' : '') +
      '" data-heart="' + esc(g.slug) + '" aria-label="Сохранить подарок">' + icon('heart') + '</button></div>' +
      '<div class="detail-owner"><span class="owner-avatar">' + icon('user-round') + '</span>' +
      '<span class="owner-copy"><small>Владелец</small><strong>' + esc(g.owner_name || 'Скрытый владелец') +
      '</strong></span>' +
      (owner ? '<a class="owner-go" href="' + esc(owner) + '" target="_blank" rel="noopener noreferrer">' +
        icon('arrow-up-right') + '</a>' : '<span class="owner-locked">' + icon('lock-keyhole') + '</span>') + '</div>' +
      '<div class="specs">' + attrib('Модель', 'shapes', g.model, g.model_rarity) +
      attrib('Фон', 'palette', g.backdrop, g.backdrop_rarity) +
      attrib('Узор', 'flower-2', g.symbol, g.symbol_rarity) + '</div>' +
      '<div class="detail-price"><span>Цена / оценка</span><strong>' + money(g.price_stars) +
      '</strong><small>' + esc(g.price_source || 'Точная рыночная цена неизвестна') + '</small></div>' +
      '<div class="detail-links"><a class="primary-button" href="' + esc(source) +
      '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + ' Открыть в Telegram</a>' +
      (owner ? '<a class="secondary-button" href="' + esc(owner) +
        '" target="_blank" rel="noopener noreferrer">' + icon('user-round') + ' Профиль владельца</a>' : '') +
      '</div>';
    icons();
    connectAnimations(detail);
  }

  function openDetail(g) {
    if (!g) return;
    showDialog('#detailDialog');
    renderDetail(g);
  }

  function toggleFavorite(slug) {
    if (state.favorites.has(slug)) state.favorites.delete(slug);
    else state.favorites.add(slug);
    persist(favoriteKey, Array.from(state.favorites));
    toast(state.favorites.has(slug) ? 'Подарок сохранён' : 'Удалено из избранного');
    tg?.HapticFeedback?.selectionChanged?.();
    const g = state.gifts.find(x => x.slug === slug);
    if ($('#detailDialog').open && g) renderDetail(g);
    else if (state.tab === 'favorites') renderFavorites();
    else if (state.tab === 'catalog') {
      $$('.favorite-button[data-heart="' + CSS.escape(slug) + '"]').forEach(el => {
        el.classList.toggle('active', state.favorites.has(slug));
        el.setAttribute('aria-label', state.favorites.has(slug) ? 'Убрать из избранного' : 'В избранное');
      });
      icons();
    }
  }

  function savePreset() {
    const selected = fields.map(([key, label]) => state.filters[key] ? label + ': ' + state.filters[key] : '').filter(Boolean);
    const q = search.value.trim();
    if (!selected.length && !q) return toast('Сначала выбери параметры или введи поиск');
    const title = selected.length ? selected.map(x => x.split(': ')[1]).join(' · ') : q;
    const preset = {title: title.slice(0, 100), query: q, filters: {...state.filters}};
    state.presets.unshift(preset);
    state.presets = state.presets.slice(0, 60);
    persist(presetsKey, state.presets);
    $('#filterDialog').close();
    toast('Подборка сохранена');
    setTab('saved');
  }

  document.addEventListener('click', event => {
    const target = event.target;
    const heart = target.closest('[data-heart]');
    if (heart) { event.stopPropagation(); toggleFavorite(heart.dataset.heart); return; }
    const facet = target.closest('[data-facet-key]');
    if (facet) {
      state.filters[facet.dataset.facetKey] = facet.dataset.facetValue;
      if (!state.filters[facet.dataset.facetKey]) delete state.filters[facet.dataset.facetKey];
      renderFacetOptions(facet.dataset.facetKey, $('[data-facet-search="' + facet.dataset.facetKey + '"]')?.value || '');
      renderActiveFilters();
      $$('details.filter-group summary small').forEach((x, index) => {
        const key = fields[index][0]; x.textContent = state.filters[key] || 'Любой';
      });
      return;
    }
    const collection = target.closest('[data-collection]');
    if (collection) {
      state.filters.collection = collection.dataset.collection;
      if (!state.filters.collection) delete state.filters.collection;
      filterChanged(); return;
    }
    const remove = target.closest('[data-remove-filter]');
    if (remove) { delete state.filters[remove.dataset.removeFilter]; filterChanged(); return; }
    const preset = target.closest('[data-preset]');
    if (preset) {
      const item = state.presets[Number(preset.dataset.preset)];
      if (!item) return;
      state.filters = {...item.filters}; search.value = item.query || '';
      filterChanged(); return;
    }
    const deleted = target.closest('[data-delete-preset]');
    if (deleted) {
      state.presets.splice(Number(deleted.dataset.deletePreset), 1);
      persist(presetsKey, state.presets); renderPresets(); syncHead(); return;
    }
    const cardEl = target.closest('.gift-card');
    if (cardEl) {
      const gift = state.gifts.find(g => g.slug === cardEl.dataset.slug);
      if (gift) openDetail(gift);
      else api('/api/gifts/' + encodeURIComponent(cardEl.dataset.slug)).then(openDetail).catch(e => toast(e.message));
      return;
    }
    const tabEl = target.closest('[data-tab]');
    if (tabEl) { setTab(tabEl.dataset.tab); return; }
    if (target.closest('[data-import]') || target.closest('#openImport')) {
      showDialog('#importDialog'); return;
    }
    if (target.closest('[data-close]')) { target.closest('dialog')?.close(); return; }
    if (target.closest('#openFilters')) { renderFilterGroups(); showDialog('#filterDialog'); return; }
    if (target.closest('#applyFilters')) { $('#filterDialog').close(); filterChanged(); return; }
    if (target.closest('#resetFilters')) {
      state.filters = {}; renderFilterGroups(); renderActiveFilters(); toast('Фильтры сброшены'); return;
    }
    if (target.closest('#saveSearch')) { savePreset(); return; }
    if (target.closest('#resetCollection')) { delete state.filters.collection; filterChanged(); return; }
    if (target.closest('#emptyAction')) {
      if (state.tab === 'favorites') setTab('catalog');
      else if (state.tab === 'saved') showDialog('#filterDialog');
      else if ($('#emptyTitle').textContent.includes('Не удалось')) fetchCatalog();
      else showDialog('#importDialog');
      return;
    }
    if (target.closest('#loadMore')) { if (state.nextOffset != null && !state.loading) fetchCatalog(true); return; }
    const external = target.closest('a[href]');
    if (external && tg && cleanUrl(external.href)) {
      event.preventDefault(); tg.openTelegramLink(external.href);
    }
  });

  grid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('gift-card')) {
      event.preventDefault();
      event.target.click();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches('[data-facet-search]')) {
      renderFacetOptions(event.target.dataset.facetSearch, event.target.value);
    }
  });
  search.addEventListener('input', () => {
    $('#searchClear').hidden = !search.value;
    clearTimeout(search._timer);
    search._timer = setTimeout(() => {
      if (state.tab === 'catalog') fetchCatalog();
      else if (state.tab === 'favorites') renderFavorites();
    }, 280);
  });
  $('#searchClear').addEventListener('click', () => {
    search.value = ''; $('#searchClear').hidden = true;
    if (state.tab === 'favorites') renderFavorites(); else fetchCatalog();
    search.focus();
  });
  $('#detailDialog').addEventListener('close', () => {
    $('.gift-art[data-animation]', grid).forEach(el => {
      if (animationObserver) animationObserver.observe(el);
    });
  });
    $('#importSubmit').addEventListener('click', async () => {
    const button = $('#importSubmit');
    const error = $('#importError');
    error.textContent = '';
    if (!$('#importUrl').value.trim()) { error.textContent = 'Вставь ссылку на подарок'; return; }
    button.disabled = true;
    button.textContent = 'Проверяем Telegram…';
    try {
      const gift = await api('/api/import', {method: 'POST', body: JSON.stringify({url: $('#importUrl').value.trim()})});
      $('#importDialog').close();
      $('#importUrl').value = '';
      state.filters = {};
      renderCollections(); renderActiveFilters();
      search.value = gift.collection;
      await setTab('catalog');
      openDetail(gift);
      toast('Подарок добавлен в каталог');
    } catch (err) {
      error.textContent = err.message;
      tg?.HapticFeedback?.notificationOccurred?.('error');
    } finally {
      button.disabled = false;
      button.innerHTML = 'Найти и добавить ' + icon('arrow-right');
      icons();
    }
  });

  async function init() {
    icons();
    renderCollections();
    renderActiveFilters();
    try {
      const facets = await api('/api/facets');
      state.facetValues = facets;
      renderCollections();
    } catch (_) {}
    const similar = new URLSearchParams(location.search).get('similar');
    if (similar) {
      try {
        const gift = await api('/api/gifts/' + encodeURIComponent(similar));
        state.filters.collection = gift.collection;
        state.filters.model = gift.model;
      } catch (_) {}
    }
    renderActiveFilters();
    api('/api/stats').then(stats => {state.catalogTotal = stats.total; syncHead();}).catch(() => {});
    fetchCatalog();
  }
  init();
})();
