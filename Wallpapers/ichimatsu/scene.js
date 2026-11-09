/*
 * 市松 Ichimatsu — the checkerboard of ink and washi, rolling in a slow wave.
 *
 * The squares are baked once on a wide sheet. Each frame lays the sheet down in thin
 * strips that slide sideways and lift with a travelling swell, then a baked soft light
 * and a few petals go over the top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const INK = '#23272b';
  const WASHI = '#e6dcc4';
  const SPOTS = ['#33506f', '#5d7048', '#c4472d', '#b99a45'];
  const STRIP = 3;
  const PETALS = 14;
  const PETAL_TONES = ['#e9c7c0', '#dcb0a8', '#efd8cf'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSheet(g, rand) {
    const c = layer(g.W + g.pad * 2, g.H + g.pad * 2);
    const ctx = c.getContext('2d');
    const nx = Math.ceil(c.width / g.s) + 1;
    const ny = Math.ceil(c.height / g.s) + 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let col = (i + j) % 2 === 0 ? INK : WASHI;
        if (rand() < 0.05) col = SPOTS[Math.floor(rand() * SPOTS.length)];
        ctx.fillStyle = col;
        ctx.fillRect(i * g.s, j * g.s, g.s + 1, g.s + 1);
      }
    }
    ctx.fillStyle = 'rgba(35,39,43,0.28)';
    for (let i = 0; i <= nx; i++) ctx.fillRect(i * g.s, 0, 1, c.height);
    for (let j = 0; j <= ny; j++) ctx.fillRect(0, j * g.s, c.width, 1);
    return c;
  }

  function paintLight(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = Math.max(g.W, g.H) * 0.75;
    const grad = ctx.createRadialGradient(g.W * 0.7, g.H * 0.22, 0, g.W * 0.7, g.H * 0.22, r);
    grad.addColorStop(0, 'rgba(240,206,130,0.42)');
    grad.addColorStop(0.35, 'rgba(236,196,120,0.14)');
    grad.addColorStop(1, 'rgba(20,24,32,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function makePetals(g, rand) {
    const p = { x: new Float32Array(PETALS), y: new Float32Array(PETALS), v: new Float32Array(PETALS),
      a: new Float32Array(PETALS), ph: new Float32Array(PETALS), tone: new Uint8Array(PETALS) };
    for (let i = 0; i < PETALS; i++) {
      p.x[i] = rand() * g.W;
      p.y[i] = rand() * g.H;
      p.v[i] = g.H * (0.03 + rand() * 0.03);
      p.a[i] = rand() * TAU;
      p.ph[i] = rand() * TAU;
      p.tone[i] = Math.floor(rand() * PETAL_TONES.length);
    }
    return p;
  }

  function drawSheet(ctx, g, t, wave) {
    const amp = g.s * 0.55 * wave;
    for (let y = 0; y < g.H; y += STRIP) {
      const ph = y / (g.s * 3.2) - t * 0.5;
      const lift = Math.sin(ph) * amp;
      const slide = Math.sin(ph * 0.6 + t * 0.2) * g.s * 0.9 * wave;
      const sy = Math.min(g.H + g.pad * 2 - STRIP, Math.max(0, y + g.pad + lift));
      const sx = Math.min(g.pad * 2, Math.max(0, g.pad + slide));
      ctx.drawImage(state.sheet, sx, sy, g.W, STRIP, 0, y, g.W, STRIP);
      const slope = Math.cos(ph);
      if (slope > 0) ctx.fillStyle = 'rgba(16,20,28,' + (slope * 0.2 * wave).toFixed(3) + ')';
      else ctx.fillStyle = 'rgba(244,224,170,' + (-slope * 0.12 * wave).toFixed(3) + ')';
      ctx.fillRect(0, y, g.W, STRIP);
    }
  }

  function drawPetals(ctx, g, t, dt, count) {
    const p = state.petals;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      p.y[i] += p.v[i] * step;
      p.x[i] += Math.sin(t * 0.6 + p.ph[i]) * g.s * 0.3 * step + g.s * 0.2 * step;
      if (p.y[i] > g.H + g.s) { p.y[i] = -g.s; p.x[i] = Math.random() * g.W; }
      if (p.x[i] > g.W + g.s) p.x[i] = -g.s;
      const a = p.a[i] + t * 0.5;
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.1 + p.ph[i]));
      const c = Math.cos(a), s = Math.sin(a);
      const sz = g.s * 0.28;
      ctx.fillStyle = PETAL_TONES[p.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, p.x[i], p.y[i]);
      ctx.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setup(ctx, api) {
    const rand = K.rng(api.seed);
    const s = Math.max(4, api.rows / 9);
    const g = { W: api.cols, H: api.rows, s, pad: Math.ceil(s * 2) };
    state.g = g;
    state.sheet = paintSheet(g, rand);
    state.light = paintLight(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wave, petals } = api.props;
    drawSheet(ctx, g, t, wave);
    ctx.drawImage(state.light, 0, 0);
    drawPetals(ctx, g, t, dt, Math.min(PETALS, Math.round(PETALS * 0.6 * petals)));
  }

  Kasuri.run({
    defaults: { wave: 1, petals: 1, mode: 'block', ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
