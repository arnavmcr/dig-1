/**
 * sleeve.js
 * Canvas-based generative sleeve art.
 * Each album gets a deterministic design based on a hash of its ID.
 * No external dependencies.
 */

/** Fast integer hash from a string (djb2 variant) */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // force unsigned 32-bit
  }
  return h;
}

/** Seeded pseudo-random number generator (LCG) */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

/** Convert HSL to hex string */
function hsl(h, s, l) {
  h = h % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const a = s * Math.min(l, 100 - l) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color / 100).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Room accent colour lookup — mirrors CSS custom properties.
 * Used to bias sleeve colour temperature toward the room.
 */
const ROOM_HUE = {
  'Rock':        0,    // red
  'Alternative': 210,  // blue-slate
  'Metal':       0,    // neutral / silver
  'Punk':        48,   // yellow
  'Electronic':  195,  // cyan
  'Indie':       0,    // dusty rose (approximate)
  'Post-Rock':   175,  // teal
  'Hip-Hop':     20,   // orange
  'Classical':   45,   // cream
  'Soundtrack':  280,  // purple
  'Emo':         270,  // violet
  'Pop':         330,  // pink
  'Progressive': 135,  // green
  'Folk':        35,   // amber
  'Jazz':        43,   // warm amber
  'Soul':        345,  // burgundy
  'World':       38,   // saffron
  'Other':       43,   // default gold
};

const DESIGNS = ['radial', 'concentric', 'stripe', 'grid', 'diagonal', 'ink'];

/**
 * Draw generative sleeve art onto a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} album  — { id, artist, album, genre }
 */
export function drawSleeve(canvas, album) {
  const size = canvas.width;
  const ctx  = canvas.getContext('2d');
  const rng  = makeRng(hash(album.id));
  const h0   = ROOM_HUE[album.genre] ?? 43;

  // Palette — 4 colours anchored around the room hue
  const hBase = h0 + (rng() - 0.5) * 60;
  const colours = [
    hsl(hBase,              15 + rng() * 20, 8  + rng() * 8),   // dark bg
    hsl(hBase + 15,         20 + rng() * 30, 15 + rng() * 12),  // mid
    hsl(hBase + 30,         30 + rng() * 40, 25 + rng() * 20),  // light
    hsl(hBase + rng() * 60, 50 + rng() * 40, 55 + rng() * 30),  // accent pop
  ];

  // Background fill
  ctx.fillStyle = colours[0];
  ctx.fillRect(0, 0, size, size);

  const design = DESIGNS[Math.floor(rng() * DESIGNS.length)];

  switch (design) {
    case 'radial':
      drawRadial(ctx, size, colours, rng);
      break;
    case 'concentric':
      drawConcentric(ctx, size, colours, rng);
      break;
    case 'stripe':
      drawStripe(ctx, size, colours, rng);
      break;
    case 'grid':
      drawGrid(ctx, size, colours, rng);
      break;
    case 'diagonal':
      drawDiagonal(ctx, size, colours, rng);
      break;
    case 'ink':
      drawInk(ctx, size, colours, rng);
      break;
  }

  // Grain overlay
  addGrain(ctx, size, rng, 0.12 + rng() * 0.12);

  // Subtle vignette
  const vig = ctx.createRadialGradient(size/2, size/2, size*0.2, size/2, size/2, size*0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);
}

function drawRadial(ctx, s, c, rng) {
  const cx = s * (0.3 + rng() * 0.4);
  const cy = s * (0.3 + rng() * 0.4);
  const nRings = 3 + Math.floor(rng() * 4);
  for (let i = nRings; i >= 0; i--) {
    const r   = s * (0.15 + 0.75 * (i / nRings));
    const col = c[i % c.length];
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, col + 'cc');
    grd.addColorStop(1, col + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawConcentric(ctx, s, c, rng) {
  const cx = s / 2 + (rng() - 0.5) * s * 0.2;
  const cy = s / 2 + (rng() - 0.5) * s * 0.2;
  const n  = 8 + Math.floor(rng() * 8);
  for (let i = n; i >= 0; i--) {
    const r = (s * 0.55) * (i / n);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = c[(i % (c.length - 1)) + 1];
    ctx.lineWidth = 1.5 + rng() * 3;
    ctx.globalAlpha = 0.4 + 0.6 * (i / n);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawStripe(ctx, s, c, rng) {
  const angle = rng() * Math.PI;
  const n     = 6 + Math.floor(rng() * 10);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(angle);
  for (let i = 0; i < n; i++) {
    const x = -s + (i / n) * s * 2;
    const w = (s * 2) / n * (0.3 + rng() * 0.7);
    ctx.fillStyle = c[1 + Math.floor(rng() * (c.length - 1))];
    ctx.globalAlpha = 0.25 + rng() * 0.5;
    ctx.fillRect(x, -s, w, s * 2);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, s, c, rng) {
  const n  = 4 + Math.floor(rng() * 5);
  const cell = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (rng() > 0.45) {
        ctx.fillStyle = c[1 + Math.floor(rng() * (c.length - 1))];
        ctx.globalAlpha = 0.15 + rng() * 0.55;
        ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawDiagonal(ctx, s, c, rng) {
  const n = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x = (rng() * 2 - 0.5) * s;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + s * (0.5 + rng()), s);
    ctx.strokeStyle = c[1 + Math.floor(rng() * (c.length - 1))];
    ctx.lineWidth   = 4 + rng() * s * 0.08;
    ctx.globalAlpha = 0.2 + rng() * 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawInk(ctx, s, c, rng) {
  const n = 5 + Math.floor(rng() * 8);
  for (let i = 0; i < n; i++) {
    const x = rng() * s;
    const y = rng() * s;
    const r = s * (0.05 + rng() * 0.25);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, c[1 + Math.floor(rng() * (c.length - 1))] + 'cc');
    grd.addColorStop(1, c[0] + '00');
    ctx.globalAlpha = 0.3 + rng() * 0.5;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.6 + rng() * 0.8), r * (0.6 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function addGrain(ctx, s, rng, intensity) {
  const imageData = ctx.getImageData(0, 0, s, s);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * intensity * 255;
    d[i]   = Math.min(255, Math.max(0, d[i]   + n));
    d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
    d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
  }
  ctx.putImageData(imageData, 0, 0);
}
