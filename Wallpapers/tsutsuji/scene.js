/*
 * 躑躅 Tsutsuji — a spring hillside of clipped azaleas around a mossy stone lantern.
 *
 * Sky, cedar ridges, azalea mounds, the lantern and the path are baked once.
 * Haze is two tiling strips that drift; petals are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#b9bfc0', '#cdcbc0', '#ddd6c6', '#e8dfcf'];
  const PINKS = [
    ['#a8566a', '#c4788a', '#dba0ac'],
    ['#b3425a', '#cf6479', '#e48a9a'],
    ['#9c3a2e', '#bf4f3a', '#d6694f'],
    ['#c98a98', '#dba7b1', '#ecc9cd'],
  ];
  const LEAF = ['#3a4a32', '#4c6038', '#627a44'];
  const STONE = { dark: '#4a4d49', mid: '#6d706a', light: '#9a9a90', moss: '#5f7040', mossLit: '#7e9150' };
  const MAX_PETALS = 36;
  const PETALS = 18;
  const PETAL_TONES = ['#e2adb6', '#d68b9a', '#ecc9cd', '#c4586c'];
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
    return { W, H, U, lx: W * 0.62, ly: H * 0.87 };
  }

  // ---- sky and ridges --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = Math.ceil(g.H * 0.5);
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.H * 0.4)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#e9e0cf';
    blob(ctx, g.W * 0.22, g.H * 0.12, g.U * 7, g.U * 7);
  }

  function ridge(g, x, base, amp, seed) {
    return g.H * base + fbm(x / (g.U * 36), seed, 4, seed * 7) * g.H * amp;
  }

  function cedar(ctx, x, y, h, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.14, y);
    ctx.lineTo(x - h * 0.14, y);
    ctx.fill();
  }

  function paintRidge(ctx, g, rand, base, amp, seed, fill, tree, th) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, base, amp, seed));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let x = 0; x < g.W; x += g.U * (0.9 + rand() * 1.3)) {
      cedar(ctx, x, ridge(g, x, base, amp, seed) + g.U * 0.8, g.U * th * (0.7 + rand() * 0.6), tree);
    }
  }

  // ---- azalea mounds -------------------------------------------------------

  function mound(ctx, g, rand, x, y, r, tones) {
    ctx.fillStyle = '#34452d';
    blob(ctx, x, y + r * 0.1, r * 1.05, r * 0.62);
    ctx.fillStyle = tones[0];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.68, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(x - r, y - 0.5, r * 2, r * 0.18);
    ctx.fillStyle = tones[1];
    blob(ctx, x - r * 0.12, y - r * 0.26, r * 0.78, r * 0.4);
    ctx.fillStyle = tones[2];
    const n = Math.round(r * 1.3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI;
      const d = Math.sqrt(rand()) * r * 0.8;
      blob(ctx, x - Math.cos(a) * d * 0.9, y - Math.sin(a) * d * 0.55, r * 0.11, r * 0.08);
    }
    ctx.fillStyle = LEAF[1];
    for (let i = 0; i < 3; i++) blob(ctx, x + (rand() - 0.5) * r * 1.4, y + r * 0.1, r * 0.14, r * 0.07);
  }

  function pickTone(rand) {
    const f = rand();
    if (f < 0.4) return PINKS[0];
    if (f < 0.65) return PINKS[1];
    if (f < 0.85) return PINKS[3];
    return PINKS[2];
  }

  function moundRows(ctx, g, rand, y0, y1, minR, maxR, skip) {
    const rows = 9;
    for (let k = 0; k < rows; k++) {
      const f = k / (rows - 1);
      const y = lerp(y0, y1, f);
      const r = lerp(minR, maxR, f * f * 0.7 + f * 0.3);
      for (let x = -r; x < g.W + r; x += r * (1.3 + rand() * 0.5)) {
        const px = x + (rand() - 0.5) * r * 0.6;
        if (skip && skip(px, y, r)) continue;
        mound(ctx, g, rand, px, y + (rand() - 0.5) * r * 0.3, r * (0.85 + rand() * 0.3), pickTone(rand));
      }
    }
  }

  // ---- lantern ---------------------------------------------------------------

  function slab(ctx, x, y, w, h) {
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = STONE.light;
    ctx.fillRect(x - w / 2, y - h, w * 0.45, h);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - w / 2, y - Math.max(0.6, h * 0.12), w, Math.max(0.6, h * 0.12));
  }

  function roof(ctx, x, y, w, h) {
    ctx.fillStyle = STONE.dark;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.15, x - w * 0.12, y - h);
    ctx.lineTo(x + w * 0.12, y - h);
    ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.15, x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = STONE.mid;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.46, y - h * 0.04);
    ctx.quadraticCurveTo(x - w * 0.28, y - h * 0.2, x - w * 0.1, y - h * 0.96);
    ctx.lineTo(x + w * 0.02, y - h * 0.96);
    ctx.quadraticCurveTo(x - w * 0.12, y - h * 0.3, x - w * 0.02, y - h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = STONE.moss;
    blob(ctx, x + w * 0.1, y - h * 0.55, w * 0.18, h * 0.12);
    ctx.fillStyle = STONE.mossLit;
    blob(ctx, x + w * 0.06, y - h * 0.6, w * 0.08, h * 0.05);
  }

  function paintLantern(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U * 1.8;
    const x = g.lx;
    let y = g.ly;
    ctx.fillStyle = '#2c3a28';
    blob(ctx, x, y, U * 8, U * 1.6);
    slab(ctx, x, y, U * 12, U * 2.2);
    y -= U * 2.2;
    slab(ctx, x, y, U * 8, U * 1.6);
    y -= U * 1.6;
    slab(ctx, x, y, U * 2.6, U * 11);
    ctx.fillStyle = STONE.moss;
    ctx.fillRect(x - U * 1.3, y - U * 3, U * 2.6, U * 3);
    ctx.fillStyle = STONE.mossLit;
    ctx.fillRect(x - U * 1.3, y - U * 3, U * 0.9, U * 1.2);
    y -= U * 11;
    slab(ctx, x, y, U * 6.4, U * 1.2);
    y -= U * 1.2;
    slab(ctx, x, y, U * 9.6, U * 1.5);
    y -= U * 1.5;
    const fb = U * 6.4;
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - U * 3, y - fb, U * 6, fb);
    ctx.fillStyle = STONE.light;
    ctx.fillRect(x - U * 3, y - fb, U * 1, fb);
    ctx.fillStyle = '#c99a4a';
    ctx.fillRect(x - U * 1.7, y - fb + U * 1.2, U * 3.4, U * 4);
    ctx.fillStyle = '#e8c276';
    ctx.fillRect(x - U * 1.1, y - fb + U * 1.8, U * 2.2, U * 2.6);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - U * 0.15, y - fb + U * 1.2, Math.max(1, U * 0.3), U * 4);
    y -= fb;
    roof(ctx, x, y, U * 17, U * 5);
    y -= U * 5;
    slab(ctx, x, y, U * 2.4, U * 1);
    y -= U;
    ctx.fillStyle = STONE.mid;
    blob(ctx, x, y - U * 1.4, U * 1.3, U * 1.7);
    ctx.fillStyle = STONE.light;
    blob(ctx, x - U * 0.4, y - U * 1.8, U * 0.5, U * 0.8);
    ctx.fillStyle = STONE.dark;
    ctx.beginPath();
    ctx.moveTo(x - U * 0.6, y - U * 3);
    ctx.lineTo(x, y - U * 4.6);
    ctx.lineTo(x + U * 0.6, y - U * 3);
    ctx.fill();
    return c;
  }

  function paintPath(ctx, g) {
    const U = g.U;
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      const y = g.H * (0.99 - f * 0.17);
      const x = g.lx - U * 20 + f * U * 16 + Math.sin(i * 1.3) * U * 2;
      const w = U * (9 - f * 5);
      ctx.fillStyle = '#4d4f48';
      blob(ctx, x, y + w * 0.08, w * 0.55, w * 0.2);
      ctx.fillStyle = '#8e8d82';
      blob(ctx, x, y, w * 0.5, w * 0.17);
      ctx.fillStyle = '#b4b2a4';
      blob(ctx, x - w * 0.1, y - w * 0.04, w * 0.28, w * 0.06);
    }
  }

  // ---- baking ----------------------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintRidge(ctx, g, rand, 0.3, 0.1, 1.7, '#a2aaa4', '#8e998f', 7);
    paintRidge(ctx, g, rand, 0.4, 0.1, 3.9, '#74857a', '#5f7266', 10);
    ctx.fillStyle = '#51663f';
    ctx.fillRect(0, g.H * 0.5, g.W, g.H * 0.5);
    const sx0 = g.lx - g.U * 20;
    const sx1 = g.lx + g.U * 20;
    moundRows(ctx, g, rand, g.H * 0.5, g.H * 0.78, g.U * 3.2, g.U * 7, (x, y) => x > sx0 && x < sx1 && y > g.H * 0.5);
    ctx.fillStyle = '#50623c';
    ctx.fillRect(0, g.H * 0.8, g.W, g.H * 0.2);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPath(ctx, g);
    const a = g.lx - g.U * 30;
    const b = g.lx + g.U * 30;
    const R = g.U * 8.5;
    mound(ctx, g, rand, a - R * 0.2, g.ly + g.U * 1, R, PINKS[1]);
    mound(ctx, g, rand, b + R * 0.1, g.ly + g.U * 0.5, R * 1.05, PINKS[0]);
    mound(ctx, g, rand, g.lx + g.U * 14, g.ly + g.U * 4, R * 0.7, PINKS[2]);
    for (let x = -R; x < g.W + R; x += R * (1.6 + rand() * 0.5)) {
      if (x > g.lx - g.U * 44 && x < g.lx + g.U * 44) continue;
      mound(ctx, g, rand, x, g.H * 0.93 + rand() * g.U * 3, R * (1 + rand() * 0.5), pickTone(rand));
    }
    return c;
  }

  function paintHaze(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 230;
        img.data[i + 2] = 218;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawHaze(ctx, g, t, haze) {
    if (haze <= 0) return;
    const m = state.haze;
    const w = m.width;
    const a = (t * g.U * 1.2) % w;
    ctx.globalAlpha = Math.min(1, haze * 0.85);
    ctx.drawImage(m, -a, g.H * 0.3);
    ctx.drawImage(m, w - a, g.H * 0.3);
    const b = (t * g.U * 0.7 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, haze * 0.45);
    ctx.drawImage(m, b - w, g.H * 0.56);
    ctx.drawImage(m, b, g.H * 0.56);
    ctx.globalAlpha = 1;
  }

  // ---- petals ------------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), p: f(), size: f(), tone: f() };
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = g.W * (-0.1 + r() * 0.9);
    P.y[i] = scatter ? r() * g.H : -g.U * 2;
    P.vy[i] = g.U * (1.6 + r() * 1.4);
    P.vx[i] = g.U * (1.2 + r() * 1.6);
    P.size[i] = g.U * (0.7 + r() * 0.6);
    P.tone[i] = Math.floor(r() * PETAL_TONES.length);
    P.a[i] = r() * TAU;
    P.p[i] = r() * TAU;
  }

  function stepPetal(g, P, i, t, dt) {
    P.y[i] += P.vy[i] * dt;
    P.x[i] += (P.vx[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 1.2) * dt;
    P.a[i] += dt * 1.2;
    if (P.y[i] > g.H * 1.02 || P.x[i] > g.W * 1.05) resetPetal(g, P, i, false);
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + P.p[i]));
      const sz = P.size[i];
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.lantern = paintLantern(g);
    state.front = paintFront(g, rand);
    state.haze = paintHaze(g);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { haze, petals } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawHaze(ctx, g, t, haze);
    ctx.drawImage(state.lantern, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { haze: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
