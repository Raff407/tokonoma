/*
 * kasuri-core — the maths under the glyph renderer.
 *
 * Kasuri (絣) is the weave where threads are dyed before they meet, so the
 * picture comes out of the grid a little blurred. That is the whole idea
 * here: scenes paint a small picture, one pixel per cell, and the renderer
 * weaves it back up as glyphs, blocks or dots.
 *
 * Pure functions only, so they run in the browser and in node tests alike.
 */
(function (root) {
  'use strict';

  const MIN_CELL = 2;
  const MAX_CELL = 64;

  // Ordered from empty to full. Every ramp starts blank so dark cells vanish.
  const RAMPS = Object.freeze({
    ascii: ' .:-=+*#%@',
    lines: ' .-=≡#▒▓█',
    kana: ' ・ﾉｼﾒﾇ木林森',
    dense: " .'`^,:;Il!i><~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    sparse: ' ..::',
  });

  // Ramps whose glyphs stay thin even at full brightness. kasuri lifts the
  // dyed wash under them so the scene keeps its colour (lines fills the cell, so it needs none).
  const RAMP_LIFT = Object.freeze({ dense: 0.75 });

  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function gridSize(width, height, cell) {
    const size = Number.isFinite(cell) ? clamp(Math.round(cell), MIN_CELL, MAX_CELL) : MIN_CELL;
    return {
      cols: Math.max(1, Math.ceil(width / size)),
      rows: Math.max(1, Math.ceil(height / size)),
      cell: size,
    };
  }

  function rampIndex(lum, length) {
    return clamp(Math.round(clamp(lum, 0, 1) * (length - 1)), 0, length - 1);
  }

  function parseColor(hex) {
    if (typeof hex !== 'string') return [0, 0, 0];
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  function toHex(rgb) {
    return '#' + rgb.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  function mixColor(a, b, t) {
    const k = clamp(t, 0, 1);
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }

  function luminance(rgb) {
    return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  }

  // mulberry32: tiny, fast and good enough for leaves and fish.
  function rng(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, seed = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function noise2(x, y, seed = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, seed);
    const b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed);
    const d = hash2(xi + 1, yi + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, octaves = 4, seed = 0) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise2(x * f, y * f, seed + i * 17);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }

  function bayer4(x, y) {
    return BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] / 16;
  }

  // Returns a gate that says whether a frame at `now` (ms) should draw.
  function frameGate(fps) {
    if (!(fps > 0)) return () => true;
    const interval = 1000 / fps;
    let last = -Infinity;
    return function gate(now) {
      if (now - last < interval - 1) return false;
      last = now;
      return true;
    };
  }

  function coerce(fallback, value) {
    if (typeof fallback === 'number') {
      const n = typeof value === 'number' ? value : parseFloat(value);
      return Number.isFinite(n) ? n : fallback;
    }
    if (typeof fallback === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return fallback;
    }
    if (typeof fallback === 'string' && fallback.startsWith('#')) {
      return typeof value === 'string' && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
        ? '#' + value.trim().replace(/^#/, '')
        : fallback;
    }
    return typeof value === 'string' ? value : fallback;
  }

  // Only keys the scene declared survive, each coerced to the default's type.
  function mergeProps(defaults, incoming) {
    const out = {};
    for (const key of Object.keys(defaults)) {
      out[key] = incoming && key in incoming ? coerce(defaults[key], incoming[key]) : defaults[key];
    }
    return out;
  }

  function propsFromQuery(search) {
    const out = {};
    const params = new URLSearchParams(search || '');
    for (const [k, v] of params) out[k] = v;
    return out;
  }

  // Source rectangle that covers a target box without stretching (CSS object-fit: cover).
  function coverRect(srcW, srcH, dstW, dstH) {
    const scale = Math.max(dstW / srcW, dstH / srcH);
    const sw = Math.round(dstW / scale);
    const sh = Math.round(dstH / scale);
    return { sx: Math.round((srcW - sw) / 2), sy: Math.round((srcH - sh) / 2), sw, sh };
  }

  // Rows of characters → pixels. Characters not in the palette are see-through.
  function parseSprite(rows, palette) {
    const pixels = [];
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (palette[ch]) pixels.push({ x, y, color: palette[ch] });
      });
    });
    return { w: Math.max(...rows.map((r) => [...r].length)), h: rows.length, pixels };
  }

  const SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  const seasonOf = (month) => SEASONS[((month % 12) + 12) % 12];

  const hourOf = (date) => date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // Colour stops around the clock; every key except `h` is a hex colour.
  function paletteAt(hour, stops) {
    const sorted = [...stops].sort((a, b) => a.h - b.h);
    const h = ((hour % 24) + 24) % 24;
    let i = sorted.findIndex((s) => s.h > h);
    if (i === -1) i = 0;
    const next = sorted[i];
    const prev = sorted[(i - 1 + sorted.length) % sorted.length];
    const span = (next.h - prev.h + 24) % 24 || 24;
    const t = ((h - prev.h + 24) % 24) / span;
    const out = {};
    for (const key of Object.keys(prev)) {
      if (key !== 'h') out[key] = mixColor(parseColor(prev[key]), parseColor(next[key]), t);
    }
    return out;
  }

  const api = Object.freeze({
    MIN_CELL, MAX_CELL, RAMPS, RAMP_LIFT,
    clamp, lerp, smoothstep, gridSize, rampIndex,
    parseColor, toHex, mixColor, luminance,
    rng, hash2, noise2, fbm, bayer4, frameGate,
    mergeProps, propsFromQuery, coverRect,
    parseSprite, seasonOf, hourOf, paletteAt,
  });

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KasuriCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
