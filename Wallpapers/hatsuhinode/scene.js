/*
 * 初日の出 Hatsuhinode — the first sunrise of the year over a calm sea.
 *
 * Sky, sea, clouds and the far islets are baked in a few flat tones and repainted
 * only when the dawn has warmed a little more. Per frame: the sun sprite climbs,
 * two wave strips drift, a fixed pool of glints twinkles along the light path and
 * a handful of gulls cross.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, mixColor, parseColor, toHex } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.6;
  const SUN_X = 0.56;
  const RISE_SECONDS = 540;
  const START = 0.22;
  const REBAKE_STEP = 0.025;
  const GLINTS = 170;
  const MAX_GULLS = 8;
  const GULLS = 4;

  const SKY_COOL = ['#36426a', '#4a5880', '#655f80', '#93707e', '#b88174'];
  const SKY_WARM = ['#425480', '#617198', '#8d8296', '#cf977a', '#e6aa62'];
  const SEA_COOL = ['#866a78', '#5e6480', '#4a5474', '#3e4868'];
  const SEA_WARM = ['#bc8c70', '#807c92', '#5c6888', '#4a5878'];
  const CLOUD_BODY = ['#4a4f6c', '#6a5f78'];
  const CLOUD_RIM = ['#b0706a', '#e2a25c'];
  const ISLE = '#2c2f44';
  const GULL_INK = '#2a2b3a';
  const GLINT_INKS = ['#f2d48a', '#f4ead2', '#e6b45e'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function blendInks(a, b, w) {
    return a.map((h, i) => mixColor(parseColor(h), parseColor(b[i]), w));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const wy = Math.round(H * HORIZON);
    return { W, H, U, wy, sx: W * SUN_X, r: Math.max(2, H * 0.075) };
  }

  // ---- baked layers ---------------------------------------------------------

  // Rows step through a few inks, dithered at the seams so the bands soften.
  function bandFill(img, g, y0, y1, inks, curve, rand) {
    const d = img.data;
    for (let y = y0; y < y1; y++) {
      const f = curve((y - y0) / Math.max(1, y1 - y0)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
  }

  function paintSky(g, warmth, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.wy);
    bandFill(img, g, 0, g.wy, blendInks(SKY_COOL, SKY_WARM, warmth), (f) => Math.pow(f, 1.6), rand);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintIsles(ctx, g) {
    ctx.fillStyle = ISLE;
    blob(ctx, g.W * 0.16, g.wy, g.U * 3.2, g.U * 2.4);
    blob(ctx, g.W * 0.19, g.wy, g.U * 1.8, g.U * 1.4);
    blob(ctx, g.W * 0.215, g.wy, g.U * 1.1, g.U * 0.8);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.82, g.wy + 1);
    ctx.quadraticCurveTo(g.W * 0.9, g.wy - g.U * 3.4, g.W * 1.02, g.wy - g.U * 2.2);
    ctx.lineTo(g.W * 1.02, g.wy + 1);
    ctx.closePath();
    ctx.fill();
  }

  function paintSea(g, warmth, rand) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, h);
    bandFill(img, g, 0, h, blendInks(SEA_COOL, SEA_WARM, warmth), (f) => Math.pow(f, 0.55), rand);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Long low strata, lit gold underneath; tiles sideways.
  function paintClouds(g, warmth, rand) {
    const w = Math.ceil(g.W * 1.5);
    const c = layer(w, g.wy);
    const ctx = c.getContext('2d');
    const body = toHex(mixColor(parseColor(CLOUD_BODY[0]), parseColor(CLOUD_BODY[1]), warmth));
    const rim = toHex(mixColor(parseColor(CLOUD_RIM[0]), parseColor(CLOUD_RIM[1]), warmth));
    const bands = [0.22, 0.34, 0.45, 0.52];
    for (let b = 0; b < bands.length; b++) {
      const y = g.H * bands[b];
      const thick = g.U * (0.7 + b * 0.25);
      for (let k = 0; k < 4; k++) {
        const x = w * (k / 4 + rand() * 0.12);
        const len = g.W * (0.06 + rand() * 0.22);
        ctx.fillStyle = rim;
        blob(ctx, x, y + thick * 0.45, len * 0.48, thick * 0.6);
        ctx.fillStyle = body;
        blob(ctx, x, y, len * 0.5, thick);
        blob(ctx, x + len * 0.18, y - thick * 0.5, len * 0.22, thick * 0.7);
      }
    }
    return c;
  }

  // Short dashes on the swell, sparser and longer toward the viewer.
  function paintWaves(g, rand, ink, alpha) {
    const w = Math.ceil(g.W * 1.4);
    const h = g.H - g.wy;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = ink;
    ctx.globalAlpha = alpha;
    for (let y = 1; y < h; y += 1 + Math.floor((y / h) * 3)) {
      const f = y / h;
      const len = 1 + f * g.U * 6;
      for (let x = rand() * len * 3; x < w; x += len * (2 + rand() * 4)) {
        ctx.fillRect(x, y, len, Math.max(1, f * g.U * 0.5));
      }
    }
    return c;
  }

  // The disc and its glow as flat rings, so the weave keeps a few clean tones.
  function paintSun(g) {
    const R = g.r;
    const size = Math.ceil(R * 8);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    const rings = [[4, 'rgba(226,150,96,0.16)'], [2.8, 'rgba(232,166,96,0.22)'], [1.7, 'rgba(240,190,110,0.32)']];
    for (const [k, ink] of rings) {
      ctx.fillStyle = ink;
      blob(ctx, m, m, R * k, R * k);
    }
    ctx.fillStyle = '#e9a24e';
    blob(ctx, m, m, R, R);
    ctx.fillStyle = '#f3cc78';
    blob(ctx, m - R * 0.08, m - R * 0.08, R * 0.82, R * 0.82);
    return c;
  }

  // The steady road of light under the sun: gold dashes in a widening wedge.
  function paintPath(g, rand) {
    const h = g.H - g.wy;
    const w = Math.ceil(g.r * 1.4 + g.W * 0.32);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const m = w / 2;
    for (let y = 0; y < h; y += 1 + Math.floor((y / h) * 2)) {
      const f = y / h;
      const half = g.r * 0.7 + f * g.W * 0.15;
      const len = 1 + f * g.U * 5;
      for (let x = m - half + rand() * len * 2; x < m + half; x += len * (1.6 + rand() * 2.5)) {
        const edge = 1 - Math.abs(x - m) / half;
        if (rand() > edge * 1.4) continue;
        ctx.fillStyle = edge > 0.6 && rand() < 0.5 ? '#f2d08a' : '#d99a5c';
        ctx.globalAlpha = 0.5 + 0.4 * (1 - f);
        ctx.fillRect(x, y, len, Math.max(1, f * g.U * 0.6));
      }
    }
    return c;
  }

  function drawPath(ctx, g, t, amount, p) {
    if (amount <= 0) return;
    const c = state.path;
    const sway = Math.sin(t * 0.7) * g.U * 0.5;
    ctx.globalAlpha = Math.min(1, amount * (0.4 + 0.6 * p));
    ctx.drawImage(c, g.sx - c.width / 2 + sway, g.wy);
    ctx.globalAlpha = 1;
  }

  function makeGlints(g, rand) {
    const G = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), len: new Float32Array(GLINTS),
      ph: new Float32Array(GLINTS), fr: new Float32Array(GLINTS), ink: new Uint8Array(GLINTS) };
    const h = g.H - g.wy;
    for (let i = 0; i < GLINTS; i++) {
      const d = Math.pow(rand(), 1.4);
      const spread = g.r * 0.6 + d * g.W * 0.13;
      const off = (rand() + rand() + rand() - 1.5) / 1.5;
      G.x[i] = off * spread;
      G.y[i] = g.wy + 1 + d * (h - 2);
      G.len[i] = Math.max(1, 1 + d * g.U * 6 * (0.5 + rand()));
      G.ph[i] = rand() * TAU;
      G.fr[i] = 0.8 + rand() * 1.6;
      G.ink[i] = Math.floor(rand() * GLINT_INKS.length);
    }
    return G;
  }

  function makeGulls(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_GULLS; i++) {
      list.push({
        x0: rand() * g.W * 1.3,
        y: g.H * (0.18 + rand() * 0.3),
        v: g.U * (2.2 + rand() * 2) * (rand() < 0.3 ? -1 : 1),
        s: g.U * (2 + rand() * 1.4),
        flap: 3.5 + rand() * 2,
        ph: rand() * TAU,
        bob: rand() * TAU,
      });
    }
    return list;
  }

  function rebake(g, warmth) {
    const rand = K.rng(17);
    state.sky = paintSky(g, warmth, rand);
    state.clouds = paintClouds(g, warmth, K.rng(29));
    state.sea = paintSea(g, warmth, rand);
    state.isles = layer(g.W, g.H);
    paintIsles(state.isles.getContext('2d'), g);
    state.warmth = warmth;
  }

  // ---- motion ---------------------------------------------------------------

  function progress(t) {
    return Math.min(1, START + (1 - START) * (t / RISE_SECONDS));
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 0.6) % c.width);
    ctx.drawImage(c, off, 0);
    ctx.drawImage(c, off + c.width, 0);
  }

  function drawSun(ctx, g, p) {
    const s = state.sun;
    const cy = lerp(g.wy + g.r * 0.35, g.wy - g.r * 3.2, smoothstep(0, 1, p));
    ctx.drawImage(s, g.sx - s.width / 2, cy - s.height / 2);
    return cy;
  }

  function drawWaves(ctx, g, t) {
    const a = state.wavesLight;
    const b = state.wavesDark;
    const offA = -((t * g.U * 0.9) % a.width);
    const offB = (t * g.U * 0.5) % b.width;
    ctx.drawImage(b, offB - b.width, g.wy);
    ctx.drawImage(b, offB, g.wy);
    ctx.drawImage(a, offA, g.wy);
    ctx.drawImage(a, offA + a.width, g.wy);
  }

  function drawGlints(ctx, g, t, amount, p) {
    if (amount <= 0) return;
    const G = state.glints;
    const strength = Math.min(1, amount * (0.45 + 0.55 * p));
    const sway = Math.sin(t * 0.3) * g.U * 0.6;
    for (let i = 0; i < GLINTS; i++) {
      const s = 0.5 + 0.5 * Math.sin(t * G.fr[i] + G.ph[i]);
      const a = s * s * s * strength;
      if (a < 0.05) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = GLINT_INKS[G.ink[i]];
      ctx.fillRect(g.sx + G.x[i] + sway * (G.y[i] - g.wy) / g.H, G.y[i], G.len[i], 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawGulls(ctx, g, t, count) {
    if (count <= 0) return;
    const span = g.W * 1.3;
    ctx.strokeStyle = GULL_INK;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.lineJoin = 'round';
    for (let i = 0; i < count; i++) {
      const b = state.gulls[i];
      const raw = (b.x0 + t * b.v) % span;
      const x = (raw < 0 ? raw + span : raw) - g.W * 0.15;
      const y = b.y + Math.sin(t * 0.5 + b.bob) * g.U * 1.2;
      const k = Math.sin(t * b.flap + b.ph);
      const tip = b.s * (0.15 + 0.45 * k);
      const elbow = b.s * (0.35 + 0.2 * k);
      ctx.beginPath();
      ctx.moveTo(x - b.s, y - tip);
      ctx.lineTo(x - b.s * 0.45, y - elbow);
      ctx.lineTo(x, y);
      ctx.lineTo(x + b.s * 0.45, y - elbow);
      ctx.lineTo(x + b.s, y - tip);
      ctx.stroke();
    }
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed || 7);
    state.g = g;
    state.sun = paintSun(g);
    state.wavesLight = paintWaves(g, rand, '#c9a88a', 0.28);
    state.path = paintPath(g, rand);
    state.wavesDark = paintWaves(g, rand, '#2c3452', 0.4);
    state.glints = makeGlints(g, rand);
    state.gulls = makeGulls(g, rand);
    rebake(g, progress(0));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glitter, gulls } = api.props;
    const p = progress(t);
    if (Math.abs(p - state.warmth) >= REBAKE_STEP) rebake(g, p);
    ctx.drawImage(state.sky, 0, 0);
    drawSun(ctx, g, p);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.sea, 0, g.wy);
    drawWaves(ctx, g, t);
    drawPath(ctx, g, t, glitter, p);
    drawGlints(ctx, g, t, glitter, p);
    ctx.drawImage(state.isles, 0, 0);
    drawGulls(ctx, g, t, Math.min(MAX_GULLS, Math.round(GULLS * gulls)));
  }

  Kasuri.run({
    defaults: { glitter: 1, gulls: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
