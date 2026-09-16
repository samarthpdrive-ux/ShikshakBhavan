const explore = document.querySelector('[data-scroll-to]');
const menu = document.querySelector('.menu');
const desktopMenu = document.querySelector('[data-menu-trigger]');
const drawer = document.querySelector('.drawer');
const closeMenu = document.querySelector('.drawer__close');
const navLinks = document.querySelectorAll('.drawer__nav a');
const gallery = document.getElementById('video-gallery');
const cardTemplate = document.getElementById('video-card-template');
const modal = document.getElementById('album-modal');
const albumGrid = document.getElementById('album-grid');
const albumViewer = document.getElementById('album-viewer');
const albumTitle = document.getElementById('album-title');
const albumLabel = document.getElementById('album-label');
const albumImage = document.getElementById('album-image');
const albumVideo = document.getElementById('album-video');
const albumCaption = document.getElementById('album-caption');
let allVideos = [];

function toggleMenu(open) {
  if (!drawer || !menu) return;
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  menu.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

async function getVideos(limit) {
  const response = await fetch(limit ? `/api/videos?limit=${limit}` : '/api/videos');
  const videos = await response.json();
  if (!response.ok) throw new Error('Unable to load videos');
  return videos;
}

function photoItems() {
  return [...document.querySelectorAll('.photo-card')].map((card, index) => ({
    type: 'photo',
    src: card.dataset.photoSrc || '',
    title: card.dataset.photoTitle || `छायाचित्र ${String(index + 1).padStart(2, '0')}`,
    empty: !card.dataset.photoSrc,
  }));
}

function showModal() {
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  albumVideo.pause();
  albumVideo.removeAttribute('src');
  albumVideo.load();
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (!drawer?.classList.contains('is-open')) document.body.style.overflow = '';
}

function openViewer(item) {
  showModal();
  albumGrid.hidden = true;
  albumViewer.hidden = false;
  albumCaption.textContent = item.title;
  if (item.type === 'video') {
    albumImage.hidden = true;
    albumImage.removeAttribute('src');
    albumVideo.hidden = false;
    albumVideo.src = item.url;
    albumVideo.load();
  } else {
    albumVideo.pause();
    albumVideo.removeAttribute('src');
    albumImage.hidden = false;
    albumVideo.hidden = true;
    albumImage.src = item.src;
    albumImage.alt = item.title;
  }
}

function addAlbumEntry(item) {
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = `album-entry${item.empty ? ' album-entry--empty' : ''}`;
  if (item.empty) {
    entry.disabled = true;
    entry.innerHTML = `<span>${item.title} — लवकरच</span>`;
  } else if (item.type === 'video') {
    entry.innerHTML = `<video muted preload="metadata" playsinline src="${item.url}"></video><span>${item.title}</span>`;
  } else {
    entry.innerHTML = `<img src="${item.src}" alt="${item.title}" loading="lazy" /><span>${item.title}</span>`;
  }
  if (!item.empty) entry.onclick = () => openViewer(item);
  albumGrid.append(entry);
}

async function openAlbum(kind) {
  showModal();
  albumViewer.hidden = true;
  albumGrid.hidden = false;
  albumGrid.innerHTML = '';
  albumLabel.textContent = kind === 'photo' ? '01 / फोटो अल्बम' : '02 / व्हिडिओ अल्बम';
  albumTitle.textContent = kind === 'photo' ? 'छायाचित्रांचा संग्रह' : 'व्हिडिओ संग्रह';
  if (kind === 'photo') {
    photoItems().forEach(addAlbumEntry);
    return;
  }
  try {
    allVideos = await getVideos();
    if (!allVideos.length) addAlbumEntry({ empty: true, title: 'व्हिडिओ', type: 'video' });
    allVideos.forEach((video, index) => addAlbumEntry({ ...video, type: 'video', title: video.title || `व्हिडिओ ${index + 1}` }));
  } catch {
    addAlbumEntry({ empty: true, title: 'व्हिडिओ उपलब्ध नाही', type: 'video' });
  }
}

function placeholder(index) {
  const card = document.createElement('article');
  card.className = 'video-card video-card--empty';
  card.innerHTML = `<span class="video-card__number">${String(index + 1).padStart(2, '0')}</span><p>व्हिडिओ लवकरच</p>`;
  return card;
}

function videoCard(item, index) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const video = card.querySelector('video');
  const title = card.querySelector('.video-card__title');
  const play = card.querySelector('.video-card__play');
  const mute = card.querySelector('.video-card__mute');
  const seek = card.querySelector('.video-card__seek');
  const fullscreen = card.querySelector('.video-card__fullscreen');
  video.src = item.url;
  video.muted = true;
  title.textContent = item.title || `व्हिडिओ ${index + 1}`;
  const playback = () => (video.paused ? video.play().catch(() => {}) : video.pause());
  play.onclick = playback;
  video.onclick = playback;
  video.onplay = () => { play.textContent = 'Ⅱ'; };
  video.onpause = () => { play.textContent = '▶'; };
  video.ontimeupdate = () => { seek.value = video.duration ? (video.currentTime / video.duration) * 100 : 0; };
  seek.oninput = () => { if (video.duration) video.currentTime = (seek.value * video.duration) / 100; };
  mute.onclick = () => { video.muted = !video.muted; mute.textContent = video.muted ? '⌁' : '◖))'; };
  fullscreen.onclick = () => openViewer({ ...item, type: 'video', title: item.title || `व्हिडिओ ${index + 1}` });
  return card;
}

async function renderVideos() {
  if (!gallery) return;
  try {
    const videos = await getVideos(4);
    gallery.innerHTML = '';
    videos.forEach((video, index) => gallery.append(videoCard(video, index)));
    for (let index = videos.length; index < 4; index += 1) gallery.append(placeholder(index));
  } catch {
    gallery.innerHTML = '';
    for (let index = 0; index < 4; index += 1) gallery.append(placeholder(index));
  }
}

document.querySelectorAll('[data-photo-src]').forEach((card) => {
  const openPhoto = () => openViewer({ type: 'photo', src: card.dataset.photoSrc, title: card.dataset.photoTitle || 'छायाचित्र' });
  card.onclick = openPhoto;
  card.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPhoto(); } };
});
document.querySelectorAll('[data-open-album]').forEach((button) => { button.onclick = () => openAlbum(button.dataset.openAlbum); });
document.querySelectorAll('[data-close-album]').forEach((button) => { button.onclick = closeModal; });
document.getElementById('album-back').onclick = () => { albumVideo.pause(); albumViewer.hidden = true; albumGrid.hidden = false; };
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
if (explore) explore.onclick = () => document.getElementById(explore.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth' });
if (menu) menu.onclick = () => toggleMenu(!drawer.classList.contains('is-open'));
if (desktopMenu) desktopMenu.onclick = () => toggleMenu(true);
if (closeMenu) closeMenu.onclick = () => toggleMenu(false);
navLinks.forEach((link) => { link.onclick = () => toggleMenu(false); });
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
renderVideos();
