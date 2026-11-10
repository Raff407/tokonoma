/*
 * 白馬 Hakuba — a snow ridge at first light, with a sea of cloud below.
 *
 * Sky, peaks, near hill and shrine gate are baked into layers and repainted
 * once a minute from the clock, so the snow goes pink, then gold, then white.
 * Between repaints only two cloud banks slide and a hawk glides past.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const BASE = 0.7;
  const RETINT_SECONDS = 60;
  const PEAKS = [
    { x: 0.08, h: 0.22, w: 0.270 },
    { x: 0.2, h: 0.26, w: 0.176 },
    { x: 0.31, h: 0.33, w: 0.189 },
    { x: 0.43, h: 0.4, w: 0.176 },
    { x: 0.52, h: 0.36, w: 0.162 },
    { x: 0.63, h: 0.34, w: 0.176 },
    { x: 0.76, h: 0.46, w: 0.216 },
    { x: 0.88, h: 0.34, w: 0.162 },
    { x: 0.97, h: 0.28, w: 0.189 },
  ];
  const FAR = [
    { x: 0.04, h: 0.14, w: 0.243 },
    { x: 0.38, h: 0.2, w: 0.216 },
    { x: 0.66, h: 0.16, w: 0.270 },
    { x: 0.9, h: 0.22, w: 0.230 },
  ];
  // Light on the snow and cloud through the day: pink first, then gold, then white.
  const LIGHT = [
    { h: 0, top: '#080c1e', low: '#1d2342', lit: '#59658e', shade: '#1b2240', cloud: '#38426a', cloudShade: '#1c2342', haze: '#232a4c' },
    { h: 5, top: '#171d44', low: '#4d4768', lit: '#8a84a8', shade: '#2a3050', cloud: '#6a6890', cloudShade: '#2c3254', haze: '#3d3a5c' },
    { h: 6.1, top: '#3a4a82', low: '#e8a3a6', lit: '#f4b4bc', shade: '#56668f', cloud: '#f2bcbe', cloudShade: '#6e7ca4', haze: '#bd8e9c' },
    { h: 7.3, top: '#5878ae', low: '#f4cd92', lit: '#f8d388', shade: '#7488b0', cloud: '#f8dcac', cloudShade: '#8f9cbc', haze: '#c9b0a0' },
    { h: 9, top: '#5a88bc', low: '#cfe0e6', lit: '#fbf7ec', shade: '#98acca', cloud: '#fdfbf4', cloudShade: '#a9bad0', haze: '#a8bccc' },
    { h: 15, top: '#3a6aa4', low: '#c4d6de', lit: '#ffffff', shade: '#94a9c8', cloud: '#ffffff', cloudShade: '#a6b8cf', haze: '#aec2d0' },
    { h: 17.4, top: '#3c4c80', low: '#f0a45c', lit: '#f8cd84', shade: '#6c7aa4', cloud: '#f8d6a4', cloudShade: '#8a90b4', haze: '#c4957a' },
    { h: 18.7, top: '#242a58', low: '#b9607c', lit: '#eaa0ae', shade: '#4d5684', cloud: '#e4a6b4', cloudShade: '#5c648e', haze: '#82607c' },
    { h: 20.5, top: '#0e1230', low: '#2c2d4e', lit: '#6a749c', shade: '#1f2644', cloud: '#454f78', cloudShade: '#222a4a', haze: '#2a2f50' },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function lightAt(h) {
    return Object.assign(K.paletteAt(h, LIGHT), { night: S.nightness(h) });
  }

  // ---- ridges ------------------------------------------------------------

  function envelope(peaks, f, g) {
    let best = 0;
    for (const p of peaks) {
      const d = Math.abs(f - p.x) / p.w;
      if (d < 1) best = Math.max(best, Math.pow(1 - d, 0.9) * p.h * 1.05);
    }
    return best;
  }

  function ridgeLine(g, peaks, seed, rough) {
    const line = new Float32Array(g.W);
    const base = g.H * BASE;
    for (let x = 0; x < g.W; x++) {
      const f = x / g.W;
      const env = envelope(peaks, f, g) + 0.05;
      const sharp = 1 - Math.abs(2 * fbm(f * 7, 3, 3, seed) - 1);
      const mid = 1 - Math.abs(2 * fbm(f * 22, 8, 3, seed + 2) - 1);
      const crag = (fbm(f * 70, 7, 3, seed + 4) - 0.5) * g.U * rough;
      line[x] = base - env * g.H * (0.45 + 0.3 * sharp + 0.4 * mid) + crag;
    }
    return line;
  }

  function paintFarRange(ctx, g, L) {
    const line = ridgeLine(g, FAR, 41, 1.6);
    const grad = ctx.createLinearGradient(0, g.H * 0.4, 0, g.H * BASE);
    grad.addColorStop(0, hex(mixColor(L.haze, L.lit, 0.4)));
    grad.addColorStop(1, hex(mixColor(L.haze, L.low, 0.5)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x < g.W; x++) ctx.lineTo(x, line[x]);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function snowPixel(g, L, x, y, top, slope) {
    const elev = (g.H * BASE - y) / (g.H * 0.44);
    const gully = fbm(x * 0.16, y * 0.02, 3, 9);
    const facet = fbm(x * 0.07 + y * 0.025, y * 0.06, 3, 17);
    const lineElev = 0.2 + (fbm(x * 0.04, 5, 3, 13) - 0.5) * 0.14 + (gully - 0.5) * 0.22;
    const lit = clamp(0.48 + slope / (g.U * 7) * 0.45 + (facet - 0.5) * 1.6, 0, 1);
    const snowLit = mixColor(L.lit, rgb('#ffffff'), 0.1);
    const snow = mixColor(L.shade, snowLit, smoothstep(0.12, 0.9, lit));
    if (elev > lineElev || y - top < g.U * 1.0) return snow;
    const rock = mixColor(rgb('#2e3552'), L.shade, 0.45 + lit * 0.2);
    const blend = smoothstep(lineElev - 0.07, lineElev, elev) * (0.35 + gully * 0.6);
    return mixColor(rock, snow, blend);
  }

  function paintRange(ctx, g, L) {
    const line = ridgeLine(g, PEAKS, 5, 3.2);
    const top = Math.floor(g.H * 0.1);
    const h = Math.ceil(g.H * BASE) - top + 1;
    const img = ctx.getImageData(0, top, g.W, h);
    for (let x = 0; x < g.W; x++) {
      const a = line[Math.max(0, x - 8)];
      const b = line[Math.min(g.W - 1, x + 8)];
      const slope = b - a;
      for (let y = Math.max(0, Math.floor(line[x] - top)); y < h; y++) {
        const c = snowPixel(g, L, x, y + top, line[x], slope);
        const i = (y * g.W + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, top);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, L, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * BASE);
    grad.addColorStop(0, hex(L.top));
    grad.addColorStop(1, hex(L.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (L.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = L.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Warm glow low in the east, strongest while the sun is near the horizon.
    const warm = 1 - L.night * 0.6;
    const glow = ctx.createRadialGradient(g.W * 0.86, g.H * BASE, 0, g.W * 0.86, g.H * BASE, g.W * 0.5);
    glow.addColorStop(0, `rgba(255,226,170,${0.5 * warm})`);
    glow.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    paintFarRange(ctx, g, L);
    paintRange(ctx, g, L);
    return c;
  }

  // ---- cloud sea ---------------------------------------------------------

  // Alpha only, tiling sideways, dense toward the bottom edge.
  function paintMask(w, h, seed, stretch, lift) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * stretch, 4, seed);
    for (let y = 0; y < h; y++) {
      const depth = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        const up = density(x, Math.max(0, y - 2));
        const lit = Math.round(255 * clamp(0.86 + (v - up) * 10, 0.72, 1));
        img.data[i] = img.data[i + 1] = img.data[i + 2] = lit;
        img.data[i + 3] = smoothstep(0.5 - lift, 0.62 - lift, v + depth * 0.6) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tintSea(mask, L, mix) {
    const c = layer(mask.width, mask.height);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, hex(mixColor(L.cloud, L.haze, mix)));
    grad.addColorStop(0.55, hex(mixColor(mixColor(L.cloud, L.cloudShade, 0.45), L.haze, mix)));
    grad.addColorStop(1, hex(mixColor(L.cloudShade, L.haze, mix * 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    return c;
  }

  // ---- near hill, pines and the gate -------------------------------------

  function hillY(g, x) {
    const f = x / g.W;
    const knoll = Math.exp(-Math.pow((f - 0.8) / 0.09, 2)) * 0.05;
    const left = Math.exp(-Math.pow(f / 0.16, 2)) * 0.07;
    return g.H * (0.9 - knoll - left) + (fbm(x * 0.05, 1, 3, 23) - 0.5) * g.U * 1.6;
  }

  function paintPine(ctx, g, px, base, s, ink) {
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px - s * 1.1, base - s * 4, px + s * 0.4, base - s * 8);
    ctx.stroke();
    const pads = [[0.4, -7.6, 3.4], [-1.9, -5.7, 2.8], [2.3, -5, 2.6], [-0.4, -3.4, 3]];
    for (const [dx, dy, r] of pads) {
      ctx.beginPath();
      ctx.ellipse(px + dx * s, base + dy * s, r * s, r * s * 0.34, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintCedar(ctx, g, px, base, s, ink) {
    ctx.fillStyle = ink;
    for (let k = 0; k < 4; k++) {
      const w = s * (1.1 + k * 0.55);
      const y1 = base - s * (6 - k * 1.5);
      ctx.beginPath();
      ctx.moveTo(px, y1 - s * 2.8);
      ctx.lineTo(px - w, y1);
      ctx.lineTo(px + w, y1);
      ctx.fill();
    }
    ctx.fillRect(px - s * 0.15, base - s * 0.5, s * 0.3, s * 0.5);
  }

  function paintGate(ctx, g, gx, base, s, L) {
    const dim = 1 - L.night * 0.55;
    const post = hex(mixColor(rgb('#b4472f'), L.shade, 1 - dim));
    const dark = hex(mixColor(rgb('#2a2d2a'), L.shade, 0.2));
    const w = s * 6;
    const h = s * 7;
    ctx.fillStyle = post;
    ctx.fillRect(gx - w / 2 + s * 0.6, base - h, s * 0.9, h);
    ctx.fillRect(gx + w / 2 - s * 1.5, base - h, s * 0.9, h);
    ctx.fillRect(gx - w / 2 + s * 0.2, base - h * 0.78, w - s * 0.4, s * 0.8);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(gx - w / 2 - s * 1.2, base - h - s * 0.2);
    ctx.quadraticCurveTo(gx, base - h + s * 0.6, gx + w / 2 + s * 1.2, base - h - s * 0.2);
    ctx.lineTo(gx + w / 2 + s * 0.8, base - h + s * 0.8);
    ctx.quadraticCurveTo(gx, base - h + s * 1.5, gx - w / 2 - s * 0.8, base - h + s * 0.8);
    ctx.fill();
  }

  function paintFront(g, L, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ink = hex(mixColor(mixColor(rgb('#1a2230'), L.shade, 0.22), rgb('#080b16'), L.night * 0.6));
    const moss = hex(mixColor(mixColor(rgb('#2f4a36'), L.shade, 0.3), rgb('#0b1018'), L.night * 0.6));
    ctx.fillStyle = moss;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x++) ctx.lineTo(x, hillY(g, Math.min(x, g.W - 1)));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // Rim of light along the hill crest.
    ctx.fillStyle = hex(mixColor(L.lit, L.shade, 0.55));
    ctx.globalAlpha = 0.5 * (1 - L.night * 0.7);
    for (let x = 0; x < g.W; x++) ctx.fillRect(x, hillY(g, x), 1, 1);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const px = g.W * (0.01 + i * 0.022 + rand() * 0.01);
      paintCedar(ctx, g, px, hillY(g, px) + g.U, g.U * (0.9 + rand() * 0.5), ink);
    }
    paintPine(ctx, g, g.W * 0.07, hillY(g, g.W * 0.07) + g.U * 2, g.U * 1.5, ink);
    paintPine(ctx, g, g.W * 0.64, hillY(g, g.W * 0.64) + g.U, g.U * 0.9, ink);
    for (let i = 0; i < 4; i++) {
      const px = g.W * (0.9 + i * 0.026);
      paintCedar(ctx, g, px, hillY(g, px) + g.U, g.U * (0.9 + rand() * 0.4), ink);
    }
    paintGate(ctx, g, g.W * 0.8, hillY(g, g.W * 0.8) + g.U * 0.4, g.U * 0.95, L);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const L = lightAt(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, L, rand);
    state.front = paintFront(g, L, rand);
    state.seaBack = tintSea(state.maskBack, L, 0.3);
    state.seaFront = tintSea(state.maskFront, L, 0.05);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawSea(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, amount);
    const back = state.seaBack;
    const front = state.seaFront;
    const ob = -((t * g.U * 1.1) % back.width);
    const of = -((t * g.U * 2.6) % front.width);
    ctx.globalAlpha = 0.92 * a;
    ctx.drawImage(back, ob, g.H * 0.57);
    ctx.drawImage(back, ob + back.width, g.H * 0.57);
    ctx.globalAlpha = a;
    ctx.drawImage(front, of, g.H * 0.69);
    ctx.drawImage(front, of + front.width, g.H * 0.69);
    ctx.globalAlpha = 1;
  }

  // One hawk crosses the sky every minute or so, wings flexing slowly.
  function drawHawk(ctx, g, t) {
    const cycle = 70;
    const p = (t % cycle) / 46;
    if (p >= 1) return;
    const s = g.U * 0.9;
    const hx = lerp(-g.W * 0.04, g.W * 0.7, p);
    const hy = g.H * 0.24 + Math.sin(p * 5) * g.U * 2 - p * g.U * 4;
    const flex = Math.sin(t * 1.6) * s * 0.5;
    ctx.strokeStyle = '#1e2434';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - s * 3, hy + s * 0.4 + flex);
    ctx.quadraticCurveTo(hx - s * 1.5, hy - s * 0.8, hx, hy);
    ctx.quadraticCurveTo(hx + s * 1.5, hy - s * 0.8, hx + s * 3, hy + s * 0.4 + flex);
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const w = Math.ceil(g.W * 1.3);
    state.maskBack = paintMask(w, Math.ceil(g.H * 0.3), 21, 0.06, 0.02);
    state.maskFront = paintMask(w, Math.ceil(g.H * 0.4), 33, 0.05, 0.0);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawSea(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    if (props.hawk) drawHawk(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dawn', clouds: 1, hawk: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
