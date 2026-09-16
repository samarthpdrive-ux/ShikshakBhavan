const STORAGE_KEY = 'ssb-videos';
const DB_NAME = 'ssb-admin-media';
const STORE_NAME = 'videos';

const explore = document.querySelector('[data-scroll-to]');
const menu = document.querySelector('.menu');
const desktopMenu = document.querySelector('[data-menu-trigger]');
const drawer = document.querySelector('.drawer');
const closeMenu = document.querySelector('.drawer__close');
const navLinks = document.querySelectorAll('.drawer__nav a');
const gallery = document.getElementById('video-gallery');
const cardTemplate = document.getElementById('video-card-template');

/* ---------------------------------------------------------------- */
/* Menu drawer                                                       */
/* ---------------------------------------------------------------- */
function toggleMenu(open) {
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  menu.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

explore.addEventListener('click', () => document.getElementById(explore.dataset.scrollTo).scrollIntoView({ behavior: 'smooth' }));
menu.addEventListener('click', () => toggleMenu(!drawer.classList.contains('is-open')));
if (desktopMenu) desktopMenu.addEventListener('click', () => toggleMenu(true));
closeMenu.addEventListener('click', () => toggleMenu(false));
navLinks.forEach((link) => link.addEventListener('click', () => toggleMenu(false)));
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------------- */
/* Stored video helpers                                              */
/* ---------------------------------------------------------------- */
function storedVideos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function videoSource(item) {
  if (item.url) return item.url;
  if (!item.blobId) return '';
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(item.blobId);
    request.onsuccess = () => resolve(request.result ? URL.createObjectURL(request.result) : '');
    request.onerror = () => reject(request.error);
  });
}

/* ---------------------------------------------------------------- */
/* Lightbox — a single fullscreen viewer shared by photos & videos   */
/* ---------------------------------------------------------------- */
const Lightbox = (() => {
  const root = document.getElementById('lightbox');
  const stage = root.querySelector('[data-lightbox-stage]');
  const imageEl = root.querySelector('.lightbox__image');
  const videoEl = root.querySelector('.lightbox__video');
  const titleEl = root.querySelector('[data-lightbox-title]');
  const countEl = root.querySelector('[data-lightbox-count]');
  const videobar = root.querySelector('[data-lightbox-videobar]');
  const playBtn = root.querySelector('[data-lightbox-playpause]');
  const muteBtn = root.querySelector('[data-lightbox-mute]');
  const seekEl = root.querySelector('[data-lightbox-seek]');
  const fsBtn = root.querySelector('[data-lightbox-fullscreen]');
  const prevBtn = root.querySelector('[data-lightbox-prev]');
  const nextBtn = root.querySelector('[data-lightbox-next]');
  const closeEls = root.querySelectorAll('[data-lightbox-close]');

  let items = [];
  let index = 0;
  let touchStartX = null;

  function updateNavVisibility() {
    const multiple = items.length > 1;
    prevBtn.style.display = multiple ? '' : 'none';
    nextBtn.style.display = multiple ? '' : 'none';
  }

  function stopVideo() {
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.classList.remove('is-active');
  }

  function render() {
    const item = items[index];
    if (!item) return;

    imageEl.classList.remove('is-active');
    stopVideo();
    videobar.hidden = true;

    if (item.type === 'video') {
      videoEl.src = item.src;
      videoEl.muted = false;
      videoEl.classList.add('is-active');
      videobar.hidden = false;
      playBtn.textContent = '▶';
      seekEl.value = 0;
      videoEl.play().catch(() => {});
    } else {
      imageEl.src = item.src;
      imageEl.alt = item.title || '';
      imageEl.classList.add('is-active');
    }

    titleEl.textContent = item.title || '';
    countEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    updateNavVisibility();
  }

  function open(list, startIndex) {
    items = list;
    index = startIndex;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    render();
    closeEls[1] ? closeEls[1].focus() : root.querySelector('.lightbox__close').focus();
  }

  function close() {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopVideo();
    imageEl.classList.remove('is-active');
    imageEl.src = '';
  }

  function next() { if (!items.length) return; index = (index + 1) % items.length; render(); }
  function prev() { if (!items.length) return; index = (index - 1 + items.length) % items.length; render(); }

  /* Controls */
  closeEls.forEach((el) => el.addEventListener('click', close));
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);

  playBtn.addEventListener('click', () => {
    if (videoEl.paused) { videoEl.play().catch(() => {}); playBtn.textContent = 'Ⅱ'; }
    else { videoEl.pause(); playBtn.textContent = '▶'; }
  });
  videoEl.addEventListener('play', () => { playBtn.textContent = 'Ⅱ'; });
  videoEl.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  videoEl.addEventListener('timeupdate', () => {
    seekEl.value = videoEl.duration ? (videoEl.currentTime / videoEl.duration) * 100 : 0;
  });
  seekEl.addEventListener('input', () => {
    if (videoEl.duration) videoEl.currentTime = (seekEl.value / 100) * videoEl.duration;
  });
  muteBtn.addEventListener('click', () => {
    videoEl.muted = !videoEl.muted;
    muteBtn.textContent = videoEl.muted ? '⌁' : '◖))';
  });
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen();
  });

  /* Keyboard */
  document.addEventListener('keydown', (event) => {
    if (!root.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') prev();
    else if (event.key === ' ' && items[index]?.type === 'video') { event.preventDefault(); playBtn.click(); }
  });

  /* Swipe */
  stage.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) (delta < 0 ? next() : prev());
    touchStartX = null;
  }, { passive: true });

  return { open, close };
})();

/* ---------------------------------------------------------------- */
/* Photo grid → lightbox                                             */
/* ---------------------------------------------------------------- */
function wirePhotoGrid() {
  const cards = Array.from(document.querySelectorAll('.photo-card[data-photo-src]'));
  const items = cards.map((card) => ({
    type: 'image',
    src: card.dataset.photoSrc,
    title: card.dataset.photoTitle || '',
  }));

  cards.forEach((card, i) => {
    const openThis = () => Lightbox.open(items, i);
    card.addEventListener('click', openThis);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openThis(); }
    });
  });
}

/* ---------------------------------------------------------------- */
/* Video grid → lightbox                                             */
/* ---------------------------------------------------------------- */
function createPlaceholder(index) {
  const card = document.createElement('article');
  card.className = 'video-card video-card--empty';
  card.innerHTML = `<span class="video-card__number">${String(index + 1).padStart(2, '0')}</span><p>व्हिडिओ लवकरच</p>`;
  return card;
}

function createCard(item, index, openInLightbox) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const video = card.querySelector('video');
  const title = card.querySelector('.video-card__title');

  video.src = item.src;
  if (item.poster) video.poster = item.poster;
  title.textContent = item.title || `व्हिडिओ ${index + 1}`;
  card.querySelector('.video-card__number').textContent = String(index + 1).padStart(2, '0');

  const hoverCapable = window.matchMedia('(hover: hover)').matches;
  if (hoverCapable) {
    card.addEventListener('mouseenter', () => video.play().catch(() => {}));
    card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
  }

  const open = () => openInLightbox(index);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });

  return card;
}

async function renderVideoGallery() {
  if (!gallery || !cardTemplate) return;
  const raw = storedVideos().slice(0, 4);
  const resolved = [];
  for (const item of raw) {
    const src = await videoSource(item);
    if (src) resolved.push({ ...item, src, type: 'video' });
  }

  gallery.innerHTML = '';
  const openInLightbox = (i) => Lightbox.open(resolved, i);
  resolved.forEach((item, i) => gallery.append(createCard(item, i, openInLightbox)));
  for (let i = resolved.length; i < 4; i += 1) gallery.append(createPlaceholder(i));
}

/* ---------------------------------------------------------------- */
/* Init                                                               */
/* ---------------------------------------------------------------- */
wirePhotoGrid();
renderVideoGallery();
