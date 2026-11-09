/*
 * 山吹 Yamabuki — golden kerria arching over a quick spring stream.
 *
 * Backdrop, bank, lantern and bushes are baked once. The stream is one tiling layer
 * drawn in thin strips that slide at different speeds. Petals are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const MAX_PETALS = 36;
  const PETALS = 18;
  const STRIP = 2;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, top: Math.round(H * 0.5), bot: Math.round(H * 0.93) };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.top);
    sky.addColorStop(0, '#c9d0c0');
    sky.addColorStop(1, '#e6e0c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ridge(ctx, g, rand, 0.16, 0.2, '#a9baa6', 0.12, 3);
    ridge(ctx, g, rand, 0.26, 0.15, '#8ba58a', 0.1, 7);
    cedars(ctx, g, rand, g.H * 0.4, 0.5);
    ridge(ctx, g, rand, 0.36, 0.1, '#6b8a66', 0.07, 11);
    cedars(ctx, g, rand, g.H * 0.46, 1);
    return c;
  }

  function ridge(ctx, g, rand, base, amp, ink, ripple, seed) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.55);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * (base + (fbm(x / (g.U * 40), 2.2, 3, seed) - 0.5) * amp));
    }
    ctx.lineTo(g.W, g.H * 0.55);
    ctx.fill();
  }

  // Tall narrow cedars standing on the far bank.
  function cedars(ctx, g, rand, ground, scale) {
    const inks = scale < 1 ? ['#6f8d72', '#82a084'] : ['#4a6a4d', '#5f8160'];
    for (let x = -g.U * 2; x < g.W + g.U * 3; x += g.U * (3 + rand() * 4)) {
      const h = g.U * (14 + rand() * 16) * scale;
      const w = g.U * (2.8 + rand() * 1.6) * scale;
      const y = ground + rand() * g.U * 2;
      ctx.fillStyle = inks[0];
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x - w, y);
      ctx.fill();
      ctx.fillStyle = inks[1];
      ctx.beginPath();
      ctx.moveTo(x - w * 0.1, y - h * 0.95);
      ctx.lineTo(x + w * 0.1, y - h * 0.3);
      ctx.lineTo(x - w * 0.7, y - h * 0.05);
      ctx.fill();
    }
  }

  // ---- stream --------------------------------------------------------------

  function paintStream(g, rand) {
    const h = g.bot - g.top;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#86a89c');
    grad.addColorStop(0.5, '#689089');
    grad.addColorStop(1, '#43707a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, h);
    // golden reflection of the bushes near the far bank
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      const y = rand() * h * 0.35;
      wrapped(ctx, g, x, y, g.U * (3 + rand() * 6), g.U * 0.5, 'rgba(226,190,80,0.35)');
    }
    // streaks and white water
    for (let i = 0; i < 230; i++) {
      const f = rand();
      const y = f * h;
      const len = g.U * (2 + rand() * 7) * (0.5 + f);
      const tone = rand();
      const ink = tone < 0.45 ? 'rgba(236,236,220,0.5)' : tone < 0.8 ? 'rgba(160,196,186,0.5)' : 'rgba(24,52,64,0.5)';
      wrapped(ctx, g, rand() * g.W, y, len, Math.max(0.6, g.U * 0.18 * (0.5 + f)), ink);
    }
    return c;
  }

  function wrapped(ctx, g, x, y, rx, ry, ink) {
    ctx.fillStyle = ink;
    blob(ctx, x, y, rx, ry);
    if (x - rx < 0) blob(ctx, x + g.W, y, rx, ry);
    if (x + rx > g.W) blob(ctx, x - g.W, y, rx, ry);
  }

  function drawStream(ctx, g, t, current) {
    const s = state.stream;
    const h = s.height;
    for (let y = 0; y < h; y += STRIP) {
      const f = y / h;
      const speed = g.U * (1.2 + f * 5) * current;
      const off = (t * speed + Math.sin(y * 0.9 + t * 0.7) * g.U * 0.12) % g.W;
      const hh = Math.min(STRIP, h - y);
      ctx.drawImage(s, 0, y, g.W, hh, -off, g.top + y, g.W, hh);
      ctx.drawImage(s, 0, y, g.W, hh, g.W - off, g.top + y, g.W, hh);
    }
  }

  // ---- banks, stones, lantern ---------------------------------------------

  function paintBanks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    // far bank
    ctx.fillStyle = '#4d6140';
    ctx.fillRect(0, g.top - u * 3, g.W, u * 3.2);
    ctx.fillStyle = '#6b8050';
    for (let i = 0; i < g.W / (u * 1.5); i++) blob(ctx, rand() * g.W, g.top - u * (0.2 + rand() * 2.4), u * (1 + rand() * 1.5), u * 0.6);
    // near bank
    ctx.fillStyle = '#2e3d2b';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    ctx.lineTo(0, g.bot);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.bot - u * 0.5 + (fbm(x / (u * 14), 5, 3, 31) - 0.5) * u * 4);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#566d3b';
    for (let i = 0; i < g.W / u; i++) blob(ctx, rand() * g.W, g.bot + u * rand() * 4, u * (1 + rand() * 2), u * 0.7);
    ctx.fillStyle = '#7e8f4c';
    for (let i = 0; i < g.W / (u * 2); i++) blob(ctx, rand() * g.W, g.bot + u * rand() * 4, u * 0.8, u * 0.35);
    // mossy rocks in the stream
    const rocks = [[0.22, 0.7, 5], [0.55, 0.82, 7], [0.82, 0.64, 4.5], [0.4, 0.58, 3]];
    for (const [fx, fy, r] of rocks) rock(ctx, g, fx * g.W, g.top + (g.bot - g.top) * fy, r * u);
    lantern(ctx, g, g.W * 0.8, g.top - u * 0.5, u);
    return c;
  }

  function rock(ctx, g, x, y, r) {
    ctx.fillStyle = '#d8e0d4';
    ctx.globalAlpha = 0.5;
    blob(ctx, x, y + r * 0.15, r * 1.25, r * 0.22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4a4f4a';
    blob(ctx, x, y, r, r * 0.55);
    ctx.fillStyle = '#6a706a';
    blob(ctx, x - r * 0.15, y - r * 0.15, r * 0.75, r * 0.38);
    ctx.fillStyle = '#6f8a45';
    blob(ctx, x - r * 0.2, y - r * 0.38, r * 0.6, r * 0.2);
    ctx.fillStyle = '#8fa65a';
    blob(ctx, x - r * 0.35, y - r * 0.42, r * 0.3, r * 0.1);
  }

  // Stone lantern: base, post, fire box with a lit window, wide hat, jewel.
  function lantern(ctx, g, x, y, u) {
    const stone = '#8a8e86';
    const dark = '#5d625c';
    const rects = [
      [-4.5, -2, 9, 2, dark],
      [-2, -9, 4, 7, stone],
      [-4, -11, 8, 2, dark],
      [-4, -18, 8, 7, stone],
      [-1.8, -16.8, 3.6, 4.6, '#f0c868'],
      [-4.5, -19, 9, 1.4, dark],
    ];
    for (const [rx, ry, rw, rh, ink] of rects) {
      ctx.fillStyle = ink;
      ctx.fillRect(x + rx * u, y + ry * u, rw * u, rh * u);
    }
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - 8 * u, y - 19 * u);
    ctx.lineTo(x - 2 * u, y - 25 * u);
    ctx.lineTo(x + 2 * u, y - 25 * u);
    ctx.lineTo(x + 8 * u, y - 19 * u);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x - 8 * u, y - 19.4 * u, 16 * u, 0.9 * u);
    blob(ctx, x, y - 26 * u, 1.3 * u, 1.5 * u);
    ctx.fillStyle = '#6f8a45';
    blob(ctx, x - 2 * u, y - 24.8 * u, 3.6 * u, 0.9 * u);
    blob(ctx, x, y - 1.6 * u, 4 * u, 0.7 * u);
  }

  // ---- kerria bushes -------------------------------------------------------

  function bezier(p, t) {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]];
  }

  function flower(ctx, x, y, r) {
    ctx.fillStyle = '#c99a24';
    blob(ctx, x + r * 0.15, y + r * 0.15, r, r * 0.9);
    ctx.fillStyle = '#eec63e';
    blob(ctx, x, y, r * 0.9, r * 0.82);
    ctx.fillStyle = '#f8e07c';
    blob(ctx, x - r * 0.2, y - r * 0.25, r * 0.45, r * 0.38);
  }

  function leafy(ctx, x, y, r, rand) {
    ctx.fillStyle = '#3f5b2c';
    blob(ctx, x, y, r, r * 0.55);
    ctx.fillStyle = rand() < 0.5 ? '#587a3a' : '#6d8d44';
    blob(ctx, x - r * 0.2, y - r * 0.15, r * 0.6, r * 0.3);
  }

  // Arching canes sweeping out from a corner, hung with leaves and golden flowers.
  function cane(ctx, g, rand, p, flowers, size) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#59703a';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const [x, y] = bezier(p, i / 18);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < flowers; i++) {
      const f = 0.12 + (i / flowers) * 0.88;
      const [x, y] = bezier(p, f);
      const hang = rand() * g.U * 3 * f;
      leafy(ctx, x + (rand() - 0.5) * g.U * 2, y + hang * 0.5, g.U * (1.4 + rand() * 0.8), rand);
      if (rand() < 0.85) flower(ctx, x + (rand() - 0.5) * g.U * 2.4, y + hang, size * (0.75 + rand() * 0.5));
    }
  }

  function paintBushes(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const W = g.W;
    const fs = U * 1.5;
    // left bush
    const left = [
      [-U * 4, U * 0, W * 0.16, -U * 6, W * 0.3, g.H * 0.3],
      [-U * 4, U * 12, W * 0.2, U * 2, W * 0.36, g.H * 0.42],
      [-U * 4, U * 26, W * 0.1, U * 18, W * 0.22, g.H * 0.52],
      [-U * 4, U * 6, W * 0.05, g.H * 0.34, W * 0.1, g.H * 0.62],
    ];
    for (const p of left) cane(ctx, g, rand, p, 34, fs);
    // right bush, lower and sparser so the lantern shows
    const right = [
      [W + U * 4, U * 2, W * 0.86, -U * 4, W * 0.68, g.H * 0.27],
      [W + U * 4, U * 14, W * 0.92, U * 4, W * 0.76, g.H * 0.2],
      [W + U * 4, U * 8, W * 0.97, g.H * 0.3, W * 0.93, g.H * 0.5],
    ];
    for (const p of right) cane(ctx, g, rand, p, 30, fs);
    // a dense mass in each top corner
    for (let i = 0; i < 70; i++) {
      const side = i % 2;
      const x = side ? W - rand() * W * 0.22 : rand() * W * 0.26;
      const y = rand() * g.H * (0.1 + (side ? 0.08 : 0.16));
      leafy(ctx, x, y, U * (1.6 + rand()), rand);
      if (rand() < 0.8) flower(ctx, x + (rand() - 0.5) * U * 2, y + U * rand() * 1.5, fs * (0.8 + rand() * 0.4));
    }
    return c;
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, 61);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 232;
        img.data[i + 2] = 216;
        img.data[i + 3] = a * 130;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.8) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.3);
    ctx.drawImage(m, w - a, g.H * 0.3);
    ctx.globalAlpha = 1;
  }

  // ---- petals --------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), p: f(), size: f(), mode: f(), timer: f(), tone: f() };
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    const onWater = r() < 0.7;
    P.mode[i] = onWater ? 1 : 0;
    P.size[i] = g.U * (1.1 + r() * 0.7);
    P.p[i] = r() * TAU;
    P.a[i] = r() * TAU;
    P.tone[i] = r() < 0.75 ? 0 : 1;
    P.timer[i] = 0;
    if (onWater) {
      const f = r();
      P.y[i] = g.top + (g.bot - g.top) * (0.1 + f * 0.8);
      P.x[i] = scatter ? r() * g.W : -g.U * 2;
      P.vx[i] = g.U * (1.8 + f * 5) * (0.8 + r() * 0.3);
    } else {
      P.x[i] = r() * g.W * 0.5 + (r() < 0.4 ? g.W * 0.5 : 0);
      P.y[i] = scatter ? r() * g.H * 0.5 : g.H * (0.08 + r() * 0.2);
      P.vx[i] = g.U * (0.4 + r() * 1);
      P.vy[i] = g.U * (2.5 + r() * 2);
    }
  }

  function stepPetal(g, P, i, t, dt, current) {
    if (P.mode[i] === 1) {
      P.x[i] += P.vx[i] * dt * current;
      P.y[i] += Math.sin(t * 0.9 + P.p[i]) * g.U * 0.25 * dt;
      P.a[i] += Math.sin(t * 0.5 + P.p[i]) * 0.3 * dt;
      if (P.x[i] > g.W + g.U * 3) resetPetal(g, P, i, false);
    } else {
      P.y[i] += P.vy[i] * dt;
      P.x[i] += (P.vx[i] + Math.sin(t * 1.3 + P.p[i]) * g.U * 2) * dt;
      P.a[i] += 1.5 * dt;
      const f = (P.y[i] - g.top) / (g.bot - g.top);
      if (P.y[i] > g.top + (g.bot - g.top) * 0.15 && f > 0.1 + (P.p[i] % 1) * 0.7) {
        P.mode[i] = 1;
        P.vx[i] = g.U * (1.8 + f * 5);
      }
    }
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const water = P.mode[i] === 1;
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = water ? 0.45 : 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + P.p[i]));
      const sz = P.size[i];
      ctx.fillStyle = P.tone[i] ? '#f6e6a8' : '#f0cc48';
      ctx.setTransform(c, sq * s, -s, sq * c, P.x[i], P.y[i]);
      blob(ctx, 0, 0, sz * 0.8, sz * 0.55);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.stream = paintStream(g, rand);
    state.banks = paintBanks(g, rand);
    state.bushes = paintBushes(g, rand);
    state.mist = paintMist(g);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, current, mist } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step, current);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    drawStream(ctx, g, t, current);
    ctx.drawImage(state.banks, 0, 0);
    drawPetals(ctx, g, t, count);
    ctx.drawImage(state.bushes, 0, 0);
  }

  Kasuri.run({
    defaults: { petals: 1, current: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
