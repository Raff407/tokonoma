/*
 * 滝 Taki — a tall waterfall in a mossy gorge.
 *
 * The falling water is one streak texture scrolled downward behind baked cliff
 * walls, which also give it its edge. A mist texture rolls at the foot and a
 * handful of spray drops jump from the pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const POOL = 0.8;
  const MAX_SPRAY = 110;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tiles vertically: light streaks run the length of the fall.
  function paintFall(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.42, y * 0.018, 3, 6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x, y - h), y / h);
        const i = (y * w + x) * 4;
        const lit = smoothstep(0.34, 0.68, v);
        img.data[i] = lerp(84, 236, lit);
        img.data[i + 1] = lerp(118, 240, lit);
        img.data[i + 2] = lerp(132, 236, lit);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function edge(g, side, y) {
    const n = fbm(y * 0.03, side * 4 + 7, 4, 9);
    const taper = lerp(0.075, 0.13, y / g.H);
    return g.W * 0.5 + side * g.W * (taper + (n - 0.5) * 0.05);
  }

  function paintCliffs(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const bottom = Math.ceil(g.H * (POOL + 0.03));
    for (let y = 0; y < bottom; y++) {
      const left = edge(g, -1, y);
      const right = edge(g, 1, y);
      for (let x = 0; x < g.W; x++) {
        if (x > left && x < right) continue;
        const rock = Math.round(fbm(x * 0.03, y * 0.16, 4, 3) * 7) / 7;
        const moss = smoothstep(0.42, 0.56, fbm(x * 0.03 + 9, y * 0.04, 4, 12));
        const inner = Math.min(Math.abs(x - left), Math.abs(x - right)) / (g.U * 22);
        const shade = 0.62 + Math.round(Math.min(1, inner) * 3) / 6;
        const i = (y * g.W + x) * 4;
        img.data[i] = lerp(62 + rock * 110, 52 + rock * 60, moss) * shade;
        img.data[i + 1] = lerp(60 + rock * 100, 90 + rock * 92, moss) * shade;
        img.data[i + 2] = lerp(60 + rock * 90, 50 + rock * 40, moss) * shade;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    paintMaples(ctx, g, rand);
    return c;
  }

  function paintMaples(ctx, g, rand) {
    const inks = ['#b94a2e', '#cf7a33', '#8f3a2c', '#3d6240'];
    for (let i = 0; i < g.W * 3.4; i++) {
      const left = rand() < 0.5;
      const x = left ? rand() * g.W * 0.28 : g.W - rand() * g.W * 0.28;
      const y = g.H * (rand() * rand() * 0.46);
      ctx.fillStyle = inks[Math.floor(rand() * inks.length)];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, g.U * (0.6 + rand() * 1.2), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintPool(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.H * POOL, 0, g.H);
    grad.addColorStop(0, '#5f8f8f');
    grad.addColorStop(1, '#183c44');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.H * POOL, g.W, g.H * (1 - POOL));
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.06, 4, 15);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.36, 0.66, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawFall(ctx, g, t, flow) {
    const f = state.fall;
    const scroll = (t * g.U * 34 * flow) % f.height;
    const x = g.W * 0.5 - f.width / 2;
    const stop = g.H * (POOL + 0.03);
    ctx.drawImage(f, x, scroll - f.height);
    ctx.drawImage(f, x, scroll);
    if (scroll + f.height < stop) ctx.drawImage(f, x, scroll + f.height);
  }

  function drawSpray(ctx, g, dt) {
    const r = state.rand;
    const floor = g.H * (POOL + 0.03);
    ctx.fillStyle = '#ecefe9';
    for (let i = 0; i < MAX_SPRAY; i++) {
      state.pl[i] -= dt * 1.1;
      if (state.pl[i] <= 0) {
        state.px[i] = g.W * 0.5 + (r() - 0.5) * g.U * 34;
        state.py[i] = floor;
        state.pvx[i] = (r() - 0.5) * g.U * 18;
        state.pvy[i] = -g.U * (6 + r() * 15);
        state.pl[i] = 0.4 + r() * 0.8;
      }
      state.pvy[i] += g.U * 28 * dt;
      state.px[i] += state.pvx[i] * dt;
      state.py[i] += state.pvy[i] * dt;
      ctx.globalAlpha = Math.min(1, state.pl[i]) * 0.8;
      ctx.fillRect(state.px[i], state.py[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.fall = paintFall(Math.ceil(g.W * 0.32), g.H);
    state.cliffs = paintCliffs(g, rand);
    state.pool = paintPool(g);
    state.mist = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.32));
    state.px = new Float32Array(MAX_SPRAY);
    state.py = new Float32Array(MAX_SPRAY);
    state.pvx = new Float32Array(MAX_SPRAY);
    state.pvy = new Float32Array(MAX_SPRAY);
    state.pl = new Float32Array(MAX_SPRAY);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    drawFall(ctx, g, t, api.props.flow);
    ctx.drawImage(state.cliffs, 0, 0);
    ctx.drawImage(state.pool, 0, 0);
    ctx.fillStyle = '#d7e3df';
    for (let k = 0; k < 9; k++) {
      const y = g.H * (POOL + 0.05 + k * 0.016);
      const x = ((t * g.U * (2 + k)) + k * 37) % (g.W + g.U * 20) - g.U * 10;
      ctx.globalAlpha = 0.34;
      ctx.fillRect(x, y, g.U * (8 + k * 2), 1);
    }
    ctx.globalAlpha = 1;
    drawSpray(ctx, g, dt);
    const w = state.mist.width;
    const mx = -((t * g.U * 2.2) % w);
    const my = g.H * (POOL - 0.15) + Math.sin(t * 0.3) * g.U;
    ctx.drawImage(state.mist, mx, my);
    ctx.drawImage(state.mist, mx + w, my);
  }

  Kasuri.run({
    defaults: { flow: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
