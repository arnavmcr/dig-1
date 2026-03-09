/**
 * bag.js
 * Bag tray — add/remove albums, clipboard export.
 */

import { drawSleeve } from './sleeve.js';

const MAX_BAG = 20;

let bag = [];  // array of album objects currently in the bag
let onChangeCallback = null;

export function initBag({ onChange } = {}) {
  onChangeCallback = onChange || null;
}

export function addToBag(album) {
  if (bag.find(a => a.id === album.id)) return; // already in bag
  if (bag.length >= MAX_BAG) {
    bag.shift(); // drop the oldest when full
  }
  bag.push(album);
  _notify();
}

export function removeFromBag(albumId) {
  bag = bag.filter(a => a.id !== albumId);
  _notify();
}

export function clearBag() {
  bag = [];
  _notify();
}

export function getBag() {
  return [...bag];
}

export function isBagged(albumId) {
  return bag.some(a => a.id === albumId);
}

function _notify() {
  if (onChangeCallback) onChangeCallback([...bag]);
}

/** Format bag contents as a plain-text list for clipboard. */
export function bagToText() {
  if (!bag.length) return '';
  const lines = bag.map(a => {
    const year = a.year ? ` (${a.year})` : '';
    return `${a.artist} — ${a.album}${year}`;
  });
  return lines.join('\n');
}

/** Copy bag to clipboard, returns promise. */
export async function copyBagToClipboard() {
  const text = bagToText();
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

/**
 * Render the bag tray DOM.
 * @param {HTMLElement} container  — the .bag-tray__items element
 */
export function renderBagTray(container) {
  container.innerHTML = '';
  bag.forEach(album => {
    const el = document.createElement('div');
    el.className = 'bag-sleeve';
    el.dataset.id = album.id;
    el.title = `${album.artist} — ${album.album}`;

    const canvas = document.createElement('canvas');
    canvas.className = 'bag-sleeve__canvas';
    canvas.width  = 52;
    canvas.height = 52;
    drawSleeve(canvas, album);

    const rm = document.createElement('button');
    rm.className = 'bag-sleeve__remove';
    rm.innerHTML = '✕';
    rm.setAttribute('aria-label', `Remove ${album.album}`);
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromBag(album.id);
    });

    el.appendChild(canvas);
    el.appendChild(rm);
    container.appendChild(el);
  });
}
