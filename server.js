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

function toggleMenu(open) {
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  menu.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

function storedVideos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function videoSource(item) {
  if (item.url) return item.url;
  if (!item.blobId) return '';
  const db = await openDb();
  return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(item.blobId); request.onsuccess = () => resolve(request.result ? URL.createObjectURL(request.result) : ''); request.onerror = () => reject(request.error); });
}

function createPlaceholder(index) {
  const card = document.createElement('article');
  card.className = 'video-card video-card--empty';
  card.innerHTML = `<span class="video-card__number">${String(index + 1).padStart(2, '0')}</span><p>व्हिडिओ लवकरच</p>`;
  return card;
}

async function createCard(item, index) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const video = card.querySelector('video');
  const title = card.querySelector('.video-card__title');
  const play = card.querySelector('.video-card__play');
  const mute = card.querySelector('.video-card__mute');
  const seek = card.querySelector('.video-card__seek');
  const fullscreen = card.querySelector('.video-card__fullscreen');
  const controls = card.querySelector('.video-card__controls');
  video.src = await videoSource(item);
  video.poster = item.poster || '';
  video.muted = true;
  title.textContent = item.title || `व्हिडिओ ${index + 1}`;

  function updatePlayButton() {
    play.textContent = video.paused ? '▶' : 'Ⅱ';
    play.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
  }
  function togglePlayback(event) {
    event?.stopPropagation();
    if (video.paused) { gallery.querySelectorAll('video').forEach((other) => { if (other !== video) other.pause(); }); video.play().catch(() => {}); }
    else video.pause();
  }

  play.addEventListener('click', togglePlayback);
  video.addEventListener('click', togglePlayback);
  video.addEventListener('play', updatePlayButton);
  video.addEventListener('pause', updatePlayButton);
  video.addEventListener('timeupdate', () => { seek.value = video.duration ? (video.currentTime / video.duration) * 100 : 0; });
  seek.addEventListener('input', (event) => { event.stopPropagation(); if (video.duration) video.currentTime = (seek.value / 100) * video.duration; });
  mute.addEventListener('click', (event) => { event.stopPropagation(); video.muted = !video.muted; mute.textContent = video.muted ? '⌁' : '◖))'; mute.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video'); });
  fullscreen.addEventListener('click', (event) => { event.stopPropagation(); if (card.requestFullscreen) card.requestFullscreen(); });
  card.addEventListener('mouseenter', () => controls.classList.add('is-visible'));
  card.addEventListener('focusin', () => controls.classList.add('is-visible'));
  return card;
}

async function renderVideoGallery() {
  if (!gallery || !cardTemplate) return;
  const items = storedVideos();
  gallery.innerHTML = '';
  for (const [index, item] of items.slice(0, 4).entries()) gallery.append(await createCard(item, index));
  for (let index = items.length; index < 4; index += 1) gallery.append(createPlaceholder(index));
}

explore.addEventListener('click', () => document.getElementById(explore.dataset.scrollTo).scrollIntoView({ behavior: 'smooth' }));
menu.addEventListener('click', () => toggleMenu(!drawer.classList.contains('is-open')));
if (desktopMenu) desktopMenu.addEventListener('click', () => toggleMenu(true));
closeMenu.addEventListener('click', () => toggleMenu(false));
navLinks.forEach((link) => link.addEventListener('click', () => toggleMenu(false)));
document.getElementById('year').textContent = new Date().getFullYear();
renderVideoGallery();
