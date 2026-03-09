/**
 * app.js
 * Core application — loads data, builds the floor, wires interactions.
 * ES module; imported by index.html as type="module".
 */

import { drawSleeve } from './sleeve.js';
import { initBag, addToBag, removeFromBag, isBagged, getBag,
         renderBagTray, copyBagToClipboard, clearBag } from './bag.js';

// ─── Section order ───────────────────────────────────────────────────────────
// Controls room sequence on the floor. Edit to reorder or hide rooms.
const SECTION_ORDER = [
  'Rock', 'Alternative', 'Metal', 'Punk', 'Electronic',
  'Post-Rock', 'Hip-Hop', 'Indie', 'Progressive',
  'Soundtrack', 'Classical', 'Emo', 'Pop', 'Folk',
  'Jazz', 'Soul', 'World', 'Other',
];

// ─── State ────────────────────────────────────────────────────────────────────
let library   = [];
let sections  = [];
let roomMap   = {};  // genre → [albums]
let activeRoom = 0;
let detailAlbum = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const floor        = document.getElementById('floor');
const floorNav     = document.getElementById('floor-nav');
const bagItems     = document.getElementById('bag-items');
const bagCopyBtn   = document.getElementById('bag-copy');
const bagClearBtn  = document.getElementById('bag-clear');
const detailPanel  = document.getElementById('detail-panel');
const detailClose  = document.getElementById('detail-close');

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    [library, sections] = await Promise.all([
      fetch('./data/library.json').then(r => r.json()),
      fetch('./data/sections.json').then(r => r.json()),
    ]);
  } catch (err) {
    console.error('Failed to load data:', err);
    return;
  }

  // Group albums by genre
  roomMap = {};
  for (const album of library) {
    const g = album.genre || 'Other';
    if (!roomMap[g]) roomMap[g] = [];
    roomMap[g].push(album);
  }

  buildFloor();
  buildFloorNav();
  initBag({ onChange: onBagChange });
  wireInteractions();
}

// ─── Floor ────────────────────────────────────────────────────────────────────
function buildFloor() {
  floor.innerHTML = '';

  const visibleSections = SECTION_ORDER.filter(g => roomMap[g]?.length > 0);

  visibleSections.forEach((genre, idx) => {
    const albums = roomMap[genre];
    const room   = buildRoom(genre, albums, idx);
    floor.appendChild(room);
  });
}

function buildRoom(genre, albums, idx) {
  const room = document.createElement('section');
  room.className  = 'room';
  room.dataset.genre = genre;
  room.dataset.idx   = idx;

  // Room background tint (from CSS custom property set in genre/*.css)
  const tint = document.createElement('div');
  tint.className = 'room__tint';
  room.appendChild(tint);

  // Header
  const header = document.createElement('header');
  header.className = 'room__header';
  header.innerHTML = `
    <h2 class="room__title">${genre}</h2>
    <span class="room__count u-mono u-muted">${albums.length} records</span>
  `;
  room.appendChild(header);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'sleeve-grid';

  albums.forEach(album => {
    const sleeve = buildSleeve(album);
    grid.appendChild(sleeve);
  });

  room.appendChild(grid);
  return room;
}

function buildSleeve(album) {
  const el = document.createElement('div');
  el.className  = 'sleeve';
  el.dataset.id = album.id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${album.artist} — ${album.album}`);

  const canvas = document.createElement('canvas');
  canvas.className = 'sleeve__canvas';
  canvas.width  = 140;
  canvas.height = 140;

  const info = document.createElement('div');
  info.className = 'sleeve__info';
  info.innerHTML = `
    <div class="sleeve__artist">${escHtml(album.artist)}</div>
    <div class="sleeve__album">${escHtml(album.album)}</div>
    <div class="sleeve__year u-mono">${album.year || ''}</div>
  `;

  el.appendChild(canvas);
  el.appendChild(info);

  // Lazy-render art when sleeve enters viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        drawSleeve(canvas, album);
        observer.unobserve(el);
      }
    });
  }, { rootMargin: '200px' });
  observer.observe(el);

  // Click → open detail panel
  el.addEventListener('click', () => openDetail(album));
  el.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(album); });

  return el;
}

// ─── Floor nav dots ───────────────────────────────────────────────────────────
function buildFloorNav() {
  floorNav.innerHTML = '';
  const visibleSections = SECTION_ORDER.filter(g => roomMap[g]?.length > 0);

  visibleSections.forEach((genre, idx) => {
    const dot = document.createElement('button');
    dot.className = 'floor-nav__dot';
    if (idx === 0) dot.classList.add('floor-nav__dot--active');
    dot.setAttribute('aria-label', `Go to ${genre}`);
    dot.addEventListener('click', () => scrollToRoom(idx));
    floorNav.appendChild(dot);
  });
}

function scrollToRoom(idx) {
  const rooms = floor.querySelectorAll('.room');
  if (rooms[idx]) {
    rooms[idx].scrollIntoView({ behavior: 'smooth', inline: 'start' });
  }
}

function updateNavDots(idx) {
  const dots = floorNav.querySelectorAll('.floor-nav__dot');
  dots.forEach((d, i) => d.classList.toggle('floor-nav__dot--active', i === idx));
  activeRoom = idx;
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function openDetail(album) {
  detailAlbum = album;

  // Large art
  let artCanvas = detailPanel.querySelector('.detail-panel__art canvas');
  if (!artCanvas) {
    const artDiv = detailPanel.querySelector('.detail-panel__art');
    artCanvas = document.createElement('canvas');
    artCanvas.width  = 400;
    artCanvas.height = 400;
    artDiv.appendChild(artCanvas);
  }
  drawSleeve(artCanvas, album);

  detailPanel.querySelector('.detail-panel__artist').textContent = album.artist;
  detailPanel.querySelector('.detail-panel__album').textContent  = album.album;

  const meta = detailPanel.querySelector('.detail-panel__meta');
  meta.innerHTML = `
    <span>${album.year || '—'}</span>
    <span>${album.genre}</span>
    <span>${album.format || ''}</span>
    <span>${album.tracks.length} tracks</span>
  `;

  const tracklist = detailPanel.querySelector('.detail-panel__tracklist');
  tracklist.innerHTML = '';
  album.tracks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'detail-panel__track';
    li.innerHTML = `
      <span class="detail-panel__track-num">${t.number ?? '·'}</span>
      <span class="detail-panel__track-title">${escHtml(t.title)}</span>
      <span class="detail-panel__track-dur">${formatDuration(t.duration)}</span>
    `;
    tracklist.appendChild(li);
  });

  const addBtn = detailPanel.querySelector('.detail-panel__add-btn');
  updateAddBtn(addBtn, album);

  detailPanel.classList.add('detail-panel--open');
}

function closeDetail() {
  detailPanel.classList.remove('detail-panel--open');
  detailAlbum = null;
}

function updateAddBtn(btn, album) {
  if (isBagged(album.id)) {
    btn.textContent = '✓ In bag';
    btn.onclick = () => { removeFromBag(album.id); updateAddBtn(btn, album); };
  } else {
    btn.textContent = '+ Add to bag';
    btn.onclick = () => { addToBag(album); updateAddBtn(btn, album); };
  }
}

// ─── Bag change handler ───────────────────────────────────────────────────────
function onBagChange(bag) {
  renderBagTray(bagItems);
  // Update add button if detail panel is open
  if (detailAlbum) {
    const addBtn = detailPanel.querySelector('.detail-panel__add-btn');
    if (addBtn) updateAddBtn(addBtn, detailAlbum);
  }
}

// ─── Wire interactions ────────────────────────────────────────────────────────
function wireInteractions() {
  // Floor scroll → update active room
  let scrollTimer;
  floor.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const rooms = floor.querySelectorAll('.room');
      const floorLeft = floor.scrollLeft;
      let closest = 0;
      let minDist  = Infinity;
      rooms.forEach((room, idx) => {
        const dist = Math.abs(room.offsetLeft - floorLeft);
        if (dist < minDist) { minDist = dist; closest = idx; }
      });
      updateNavDots(closest);
    }, 80);
  });

  // Detail panel close
  detailClose.addEventListener('click', closeDetail);
  detailPanel.addEventListener('click', (e) => {
    if (e.target === detailPanel) closeDetail();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

  // Bag buttons
  bagCopyBtn.addEventListener('click', async () => {
    await copyBagToClipboard();
    bagCopyBtn.textContent = 'Copied!';
    setTimeout(() => { bagCopyBtn.textContent = 'Copy list'; }, 1500);
  });

  bagClearBtn.addEventListener('click', () => {
    clearBag();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
