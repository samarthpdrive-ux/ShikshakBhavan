const PAGE_SIZE = 4;

const $ = (selector, parent = document) => parent.querySelector(selector);
const explore = $('[data-scroll-to]');
const menu = $('.menu');
const desktopMenu = $('[data-menu-trigger]');
const drawer = $('.drawer');
const closeMenu = $('.drawer__close');
const navLinks = document.querySelectorAll('.drawer__nav a');
const photoGallery = $('#residence-showcase');
const videoGallery = $('#video-gallery');
const videoTemplate = $('#video-card-template');
const modal = $('#album-modal');
const viewerMedia = $('#album-viewer-media');
const albumImage = $('#album-image');
const albumVideo = $('#album-video');
const albumCaption = $('#album-caption');
const viewerControls = $('#viewer-controls');
const viewerBackward = $('#viewer-backward');
const viewerToggle = $('#viewer-toggle');
const viewerForward = $('#viewer-forward');
const viewerMute = $('#viewer-mute');
const viewerZoom = $('#viewer-zoom');
const photoPrevious = $('#photo-previous');
const photoNext = $('#photo-next');
const photoPage = $('#photo-page');
const videoPrevious = $('#video-previous');
const videoNext = $('#video-next');
const videoPage = $('#video-page');

const pager = {
  photo: { offset: 0, hasNext: false },
  video: { offset: 0, hasNext: false },
};
let controlsTimer;

function toggleMenu(open) {
  if (!drawer || !menu) return;
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  menu.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

async function fetchMedia(type, offset) {
  const response = await fetch(`/api/${type}s?offset=${offset}&limit=${PAGE_SIZE + 1}`);
  const items = await response.json();
  if (!response.ok) throw new Error(`Unable to load ${type}s`);
  return { items: items.slice(0, PAGE_SIZE), hasNext: items.length > PAGE_SIZE };
}

function emptyPhoto(index) {
  const card = document.createElement('article');
  card.className = 'photo-card photo-card--empty';
  card.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>छायाचित्र लवकरच</p><i>◇</i>`;
  return card;
}

function photoCard(item, index) {
  const card = document.createElement('article');
  card.className = 'photo-card photo-card--featured';
  card.innerHTML = `<div class="photo-card__media"><img src="${item.url}" alt="${item.title}" loading="lazy" /></div><div class="photo-card__overlay"><span>${String(index + 1).padStart(2, '0')}</span><p>${item.title}</p></div>`;
  return card;
}

function emptyVideo(index) {
  const card = document.createElement('article');
  card.className = 'video-card video-card--empty';
  card.innerHTML = `<span class="video-card__number">${String(index + 1).padStart(2, '0')}</span><p>व्हिडिओ लवकरच</p>`;
  return card;
}

function openViewer(item) {
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  albumImage.hidden = true;
  albumVideo.hidden = false;
  albumVideo.controls = false;
  albumVideo.removeAttribute('controls');
  albumVideo.src = item.url;
  albumVideo.load();
  albumCaption.textContent = item.title || 'श्रीमान शिक्षक भवन';
  viewerControls.hidden = false;
  viewerToggle.textContent = '▶';
  showViewerControls();
}

function closeViewer() {
  clearTimeout(controlsTimer);
  albumVideo.pause();
  albumVideo.removeAttribute('src');
  albumVideo.load();
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (!drawer?.classList.contains('is-open')) document.body.style.overflow = '';
}

function showViewerControls() {
  if (modal.hidden || albumVideo.hidden) return;
  viewerControls.classList.add('is-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => viewerControls.classList.remove('is-visible'), 2600);
}

function videoCard(item, index) {
  const card = videoTemplate.content.firstElementChild.cloneNode(true);
  const video = $('.video-card video', card);
  const number = $('.video-card__number', card);
  const title = $('.video-card__title', card);
  const play = $('.video-card__play', card);
  const fullscreen = $('.video-card__fullscreen', card);
  video.src = item.url;
  video.controls = false;
  video.removeAttribute('controls');
  video.muted = true;
  video.preload = 'metadata';
  number.textContent = String(index + 1).padStart(2, '0');
  title.textContent = item.title || `व्हिडिओ ${index + 1}`;
  const open = () => openViewer(item);
  card.onclick = open;
  play.onclick = (event) => { event.stopPropagation(); open(); };
  video.onclick = (event) => { event.stopPropagation(); open(); };
  fullscreen.onclick = (event) => { event.stopPropagation(); open(); };
  return card;
}

function updatePager(type) {
  const state = pager[type];
  const pageNumber = Math.floor(state.offset / PAGE_SIZE) + 1;
  const previous = type === 'photo' ? photoPrevious : videoPrevious;
  const next = type === 'photo' ? photoNext : videoNext;
  const label = type === 'photo' ? photoPage : videoPage;
  previous.disabled = state.offset === 0;
  next.disabled = !state.hasNext;
  label.textContent = `${String(pageNumber).padStart(2, '0')} / ${state.hasNext ? '…' : String(pageNumber).padStart(2, '0')}`;
}

async function renderPhotos() {
  let items = [];
  try {
    const result = await fetchMedia('photo', pager.photo.offset);
    items = result.items;
    pager.photo.hasNext = result.hasNext;
  } catch {
    pager.photo.hasNext = false;
  }
  photoGallery.innerHTML = '';
  if (!items.length && pager.photo.offset === 0) {
    items = [{ url: 'assets/srimaan-shikshak-bhavan.jpg', title: 'श्रीमान शिक्षक भवन' }];
  }
  items.forEach((item, index) => photoGallery.append(photoCard(item, index)));
  for (let index = items.length; index < PAGE_SIZE; index += 1) photoGallery.append(emptyPhoto(index));
  updatePager('photo');
}

async function renderVideos() {
  let items = [];
  try {
    const result = await fetchMedia('video', pager.video.offset);
    items = result.items;
    pager.video.hasNext = result.hasNext;
  } catch {
    pager.video.hasNext = false;
  }
  videoGallery.innerHTML = '';
  items.forEach((item, index) => videoGallery.append(videoCard(item, index)));
  for (let index = items.length; index < PAGE_SIZE; index += 1) videoGallery.append(emptyVideo(index));
  updatePager('video');
}

function page(type, direction) {
  const state = pager[type];
  state.offset = Math.max(0, state.offset + direction * PAGE_SIZE);
  if (type === 'photo') renderPhotos(); else renderVideos();
}

photoPrevious.onclick = () => page('photo', -1);
photoNext.onclick = () => page('photo', 1);
videoPrevious.onclick = () => page('video', -1);
videoNext.onclick = () => page('video', 1);
document.querySelectorAll('[data-close-album]').forEach((button) => { button.onclick = closeViewer; });
viewerMedia.onpointermove = showViewerControls;
viewerMedia.onclick = (event) => { if (event.target === viewerMedia || event.target === albumVideo) showViewerControls(); };
viewerBackward.onclick = () => { albumVideo.currentTime = Math.max(0, albumVideo.currentTime - 15); showViewerControls(); };
viewerForward.onclick = () => { albumVideo.currentTime = Math.min(albumVideo.duration || Infinity, albumVideo.currentTime + 15); showViewerControls(); };
viewerToggle.onclick = () => { if (albumVideo.paused) albumVideo.play().catch(() => {}); else albumVideo.pause(); showViewerControls(); };
viewerMute.onclick = () => { albumVideo.muted = !albumVideo.muted; viewerMute.textContent = albumVideo.muted ? '⌁' : '◖))'; showViewerControls(); };
viewerZoom.onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else viewerMedia.requestFullscreen?.(); showViewerControls(); };
albumVideo.onplay = () => { viewerToggle.textContent = 'Ⅱ'; showViewerControls(); };
albumVideo.onpause = () => { viewerToggle.textContent = '▶'; showViewerControls(); };
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeViewer(); });

if (explore) explore.onclick = () => document.getElementById(explore.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth' });
if (menu) menu.onclick = () => toggleMenu(!drawer.classList.contains('is-open'));
if (desktopMenu) desktopMenu.onclick = () => toggleMenu(true);
if (closeMenu) closeMenu.onclick = () => toggleMenu(false);
navLinks.forEach((link) => { link.onclick = () => toggleMenu(false); });
const year = $('#year');
if (year) year.textContent = new Date().getFullYear();
renderPhotos();
renderVideos();
