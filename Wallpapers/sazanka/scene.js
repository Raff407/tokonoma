/*
 * 山茶花 Sazanka — camellia hedge on a frosty winter morning.
 *
 * Sky, wall, lantern, hedge, flowers and path are baked once. Per frame: a slow
 * strip of mist, a short pool of falling petals that settle on the path, and a
 * few frost glints.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MAX_PETALS = 70;
  const BASE_PETALS = 40;
  const GLINTS = 22;
  const PETAL_TONES = ['#d98a9a', '#e6a5b0', '#c9748a', '#efc0c6'];
  const LEAF = ['#22362a', '#2f4a35', '#44653f', '#6b8750'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wallY: H * 0.34, hedgeTop: H * 0.4, pathY: H * 0.7 };
  }

  // ---- sky, hills, wall ----------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, Math.ceil(g.pathY));
    const stops = ['#b9c6cc', '#cfd5d1', '#e4dcc8', '#efdcbc'].map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      const f = Math.min(1, y / (g.H * 0.4)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = stops[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#f2e4bd';
    blob(ctx, g.W * 0.78, g.H * 0.2, g.U * 5, g.U * 5);
    ctx.globalAlpha = 0.25;
    blob(ctx, g.W * 0.78, g.H * 0.2, g.U * 12, g.U * 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e9e2cf';
    for (let i = 0; i < 4; i++) blob(ctx, g.W * (0.1 + rand() * 0.7), g.H * (0.06 + rand() * 0.1), g.U * (10 + rand() * 14), g.U * 0.6);
  }

  function paintHills(ctx, g) {
    const layers = [['#8d9aa3', 0.26, 0.08, 3], ['#6f7f88', 0.31, 0.06, 7]];
    for (const [col, base, amp, seed] of layers) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, g.wallY + g.U);
      for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, g.H * base - K.fbm(x / (g.U * 35), seed, 3, seed) * g.H * amp);
      ctx.lineTo(g.W, g.wallY + g.U);
      ctx.fill();
    }
    ctx.fillStyle = '#3f5340';
    for (let x = 0; x < g.W; x += g.U * 2) {
      const h = K.fbm(x / (g.U * 9), 2, 2, 5);
      if (h > 0.55) blob(ctx, x, g.wallY - g.U * 2.2, g.U * 1.6, g.U * 2.4);
    }
  }

  // Earthen wall with a row of kawara tiles on top, running behind the hedge.
  function paintWall(ctx, g) {
    const u = g.U;
    const y0 = g.wallY;
    ctx.fillStyle = '#c9bfa6';
    ctx.fillRect(0, y0 + u * 2.4, g.W, g.hedgeTop + u * 12 - y0);
    ctx.fillStyle = '#b4a98e';
    for (let x = 0; x < g.W; x += u * 18) ctx.fillRect(x, y0 + u * 2.4, Math.max(1, u * 0.3), u * 14);
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect(0, y0 + u * 2.4, g.W, u * 0.8);
    ctx.fillStyle = '#3b434b';
    ctx.fillRect(0, y0, g.W, u * 2.4);
    ctx.fillStyle = '#586068';
    for (let x = 0; x < g.W; x += u * 1.7) {
      blob(ctx, x, y0 + u * 2.4, u * 0.9, u * 0.9);
    }
    ctx.fillStyle = '#6b747b';
    ctx.fillRect(0, y0, g.W, Math.max(1, u * 0.35));
    ctx.fillStyle = '#2a3036';
    for (let x = u * 0.9; x < g.W; x += u * 1.7) ctx.fillRect(x, y0 + u * 0.5, Math.max(1, u * 0.25), u * 1.8);
  }

  // ---- lantern -------------------------------------------------------------

  function paintLantern(ctx, g) {
    const u = g.U;
    const x = g.W * 0.84;
    const base = g.pathY + u * 3;
    const stone = ['#8a8f8c', '#a6aaa3', '#c9ccc2'];
    const fill = (col, x0, y0, w, h) => { ctx.fillStyle = col; ctx.fillRect(x - w / 2 + x0, y0, w, h); };
    fill(stone[0], 0, base - u * 2.4, u * 11, u * 2.4);
    fill(stone[2], -u * 0.5, base - u * 2.4, u * 3, u * 0.5);
    fill(stone[0], 0, base - u * 15, u * 3.2, u * 12.8);
    fill(stone[1], -u * 0.6, base - u * 15, u * 1, u * 12.8);
    fill(stone[1], 0, base - u * 17.5, u * 9, u * 2.5);
    fill(stone[0], 0, base - u * 25, u * 7, u * 7.5);
    fill('#2d2a26', 0, base - u * 23, u * 3.4, u * 4.2);
    fill('#d4b05e', 0, base - u * 22.5, u * 1.6, u * 3);
    fill(stone[1], 0, base - u * 26, u * 10, u * 1.3);
    ctx.fillStyle = stone[0];
    poly(ctx, [x - u * 7.5, base - u * 26, x + u * 7.5, base - u * 26, x + u * 3, base - u * 31, x - u * 3, base - u * 31]);
    ctx.fillStyle = stone[1];
    poly(ctx, [x - u * 7.5, base - u * 26, x - u * 3, base - u * 31, x - u * 3.5, base - u * 31, x - u * 8, base - u * 26]);
    ctx.fillStyle = stone[2];
    blob(ctx, x, base - u * 32, u * 1.8, u * 1.6);
    ctx.fillStyle = '#e9ece6';
    ctx.fillRect(x - u * 7, base - u * 26.6, u * 14, u * 0.7);
    ctx.fillRect(x - u * 4.5, base - u * 17.9, u * 9, u * 0.5);
    ctx.fillRect(x - u * 5.5, base - u * 2.7, u * 11, u * 0.4);
  }

  // ---- hedge and flowers ---------------------------------------------------

  function paintHedge(ctx, g, rand) {
    const u = g.U;
    const top = (x) => g.hedgeTop + K.fbm(x / (u * 18), 3, 3, 17) * u * 6;
    ctx.fillStyle = LEAF[0];
    ctx.beginPath();
    ctx.moveTo(0, g.pathY);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, top(x));
    ctx.lineTo(g.W, g.pathY);
    ctx.fill();
    for (let pass = 1; pass < LEAF.length; pass++) {
      ctx.fillStyle = LEAF[pass];
      for (let i = 0; i < g.W * g.H / (u * u) * 0.09; i++) {
        const x = rand() * g.W;
        const y = top(x) + (g.pathY - top(x)) * Math.pow(rand(), 1.2);
        const bias = pass === 3 ? 0.55 : 1;
        if (rand() > bias) continue;
        const a = (rand() - 0.5) * 1.6;
        blob(ctx, x, y, u * (0.9 + rand() * 0.9), u * (0.4 + rand() * 0.3), a);
      }
    }
    ctx.fillStyle = '#17241c';
    ctx.fillRect(0, g.pathY - u * 1.4, g.W, u * 1.6);
    return top;
  }

  function flower(ctx, x, y, r, rot, bud) {
    const n = 5;
    for (let layerIx = 0; layerIx < 2; layerIx++) {
      const s = layerIx ? 0.62 : 1;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + layerIx * 0.6;
        const px = x + Math.cos(a) * r * 0.5 * s;
        const py = y + Math.sin(a) * r * 0.5 * s;
        ctx.fillStyle = layerIx ? (bud ? '#e6a5b0' : '#efc0c6') : (bud ? '#c9748a' : '#d98a9a');
        blob(ctx, px, py, r * 0.55 * s, r * 0.42 * s, a);
      }
    }
    ctx.fillStyle = '#e0b84e';
    blob(ctx, x, y, r * 0.3, r * 0.3);
    ctx.fillStyle = '#f2d98a';
    for (let i = 0; i < 4; i++) blob(ctx, x + Math.cos(i * 1.6) * r * 0.2, y + Math.sin(i * 1.6) * r * 0.2, r * 0.08, r * 0.08);
  }

  function paintFlowers(ctx, g, rand, top) {
    const u = g.U;
    const count = Math.round(g.W / (u * 2.3));
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const t = top(x);
      const y = t + u * 0.5 + Math.pow(rand(), 0.8) * (g.pathY - t - u * 4);
      const r = u * (1.5 + rand() * 1.3);
      flower(ctx, x, y, r, rand() * TAU, rand() < 0.3);
    }
  }

  // ---- path ----------------------------------------------------------------

  function paintPath(ctx, g, rand) {
    const u = g.U;
    const h = g.H - g.pathY;
    const img = ctx.createImageData(g.W, Math.ceil(h));
    const a = K.parseColor('#c4cbcc');
    const b = K.parseColor('#e6ebe8');
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      const f = y / img.height;
      for (let x = 0; x < g.W; x++) {
        const n = K.fbm(x / (u * 3), y / (u * 2), 2, 31);
        const k = Math.min(1, Math.max(0, 0.35 + n * 0.5 + f * 0.1 + (rand() - 0.5) * 0.28));
        const i = (y * g.W + x) * 4;
        d[i] = a[0] + (b[0] - a[0]) * k;
        d[i + 1] = a[1] + (b[1] - a[1]) * k;
        d[i + 2] = a[2] + (b[2] - a[2]) * k;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, g.pathY);
    ctx.fillStyle = '#8f9893';
    ctx.fillRect(0, g.pathY, g.W, Math.max(1, u * 0.5));
    steppingStones(ctx, g, rand);
  }

  function steppingStones(ctx, g, rand) {
    const u = g.U;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const y = g.pathY + u * 3 + f * (g.H - g.pathY - u * 6);
      const x = g.W * (0.18 + 0.6 * f * f * 0.7) + Math.sin(i * 2.3) * g.W * 0.06 + g.W * 0.05;
      const rx = u * (3.5 + f * 6);
      const ry = rx * 0.38;
      ctx.fillStyle = '#6f7673';
      blob(ctx, x, y + ry * 0.35, rx, ry);
      ctx.fillStyle = '#9ca29c';
      blob(ctx, x, y, rx, ry);
      ctx.fillStyle = '#c5cac2';
      blob(ctx, x - rx * 0.15, y - ry * 0.2, rx * 0.8, ry * 0.55);
      ctx.fillStyle = '#e9ede9';
      blob(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.22);
      ctx.fillStyle = '#d98a9a';
      if (rand() < 0.7) blob(ctx, x + rx * (rand() - 0.5), y, u * 0.7, u * 0.45, rand() * 3);
    }
  }

  function scatterPetals(ctx, g, rand) {
    const u = g.U;
    for (let i = 0; i < g.W / (u * 2.2); i++) {
      const x = rand() * g.W;
      const y = g.pathY + u * 2 + rand() * (g.H - g.pathY - u * 3);
      ctx.fillStyle = PETAL_TONES[(rand() * PETAL_TONES.length) | 0];
      blob(ctx, x, y, u * (0.5 + rand() * 0.5), u * (0.28 + rand() * 0.2), rand() * 3);
    }
  }

  function bakeAll(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintWall(ctx, g);
    const top = paintHedge(ctx, g, rand);
    paintFlowers(ctx, g, rand, top);
    paintPath(ctx, g, rand);
    paintLantern(ctx, g);
    scatterPetals(ctx, g, rand);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W);
    const h = Math.max(4, Math.round(g.U * 12));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eef0ea';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w;
      const y = h * (0.35 + 0.35 * K.noise2(i, 1, 4));
      for (const off of [0, -w, w]) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(x + off, y, g.U * (12 + 8 * K.noise2(i, 2, 4)), g.U * 2.2, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function makePetals() {
    const n = MAX_PETALS;
    return {
      x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
      p: new Float32Array(n), a: new Float32Array(n), size: new Float32Array(n),
      land: new Float32Array(n), rest: new Float32Array(n), tone: new Uint8Array(n),
    };
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = r() * g.W;
    P.y[i] = scatter ? g.hedgeTop + r() * (g.H - g.hedgeTop) * 0.8 : g.hedgeTop + r() * (g.pathY - g.hedgeTop) * 0.8;
    P.vx[i] = (r() - 0.3) * g.U * 1.2;
    P.vy[i] = g.U * (7 + r() * 4);
    P.p[i] = r() * TAU;
    P.a[i] = r() * TAU;
    P.size[i] = g.U * (1.6 + r() * 1.2);
    P.land[i] = g.pathY + g.U * 2 + r() * (g.H - g.pathY - g.U * 4);
    P.rest[i] = 0;
    P.tone[i] = (r() * PETAL_TONES.length) | 0;
    if (scatter && P.y[i] > P.land[i]) P.y[i] = P.land[i] - r() * g.U * 10;
  }

  function stepPetal(g, P, i, t, dt) {
    if (P.rest[i] > 0) {
      P.rest[i] -= dt;
      if (P.rest[i] <= 0) resetPetal(g, P, i, false);
      return;
    }
    P.x[i] += (P.vx[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 1.4) * dt;
    P.y[i] += P.vy[i] * dt;
    P.a[i] += dt * (0.8 + Math.sin(P.p[i]));
    if (P.y[i] >= P.land[i]) P.rest[i] = 5 + (P.p[i] % 3) * 2;
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const rest = P.rest[i] > 0;
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = rest ? 0.45 : 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + P.p[i]));
      const sz = P.size[i];
      ctx.globalAlpha = rest ? Math.min(1, P.rest[i] / 2) : 1;
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function makeGlints(g, rand) {
    const out = [];
    for (let i = 0; i < GLINTS; i++) {
      out.push({ x: rand() * g.W, y: g.pathY + rand() * (g.H - g.pathY), p: rand() * TAU, f: 0.4 + rand() * 0.7 });
    }
    return out;
  }

  function drawGlints(ctx, g, t, amount) {
    const n = Math.round(GLINTS * Math.min(1, amount));
    const sz = Math.max(1, g.U * 0.5);
    ctx.fillStyle = '#fbf8ee';
    for (let i = 0; i < n; i++) {
      const q = state.glints[i];
      const a = Math.sin(t * q.f + q.p);
      if (a < 0.2) continue;
      ctx.globalAlpha = (a - 0.2) * 0.9;
      ctx.fillRect(q.x, q.y, sz * 2, sz);
      ctx.fillRect(q.x + sz * 0.5, q.y - sz * 0.5, sz, sz * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const off = (t * g.U * 3) % m.width;
    ctx.globalAlpha = Math.min(0.6, 0.42 * amount);
    const y = g.pathY - g.U * 4;
    ctx.drawImage(m, -off, y);
    ctx.drawImage(m, m.width - off, y);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.rand = K.rng(api.seed);
    state.base = bakeAll(g, state.rand);
    state.mist = paintMist(g);
    state.petals = makePetals();
    state.glints = makeGlints(g, state.rand);
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, frost, mist } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(BASE_PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step);
    ctx.drawImage(state.base, 0, 0);
    drawMist(ctx, g, t, mist);
    drawGlints(ctx, g, t, frost);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { petals: 1, frost: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
