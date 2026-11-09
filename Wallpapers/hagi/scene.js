/*
 * 萩 Hagi — bush clover in bloom beside a still pond, under the autumn moon.
 *
 * Sky, moon, hills, cedars and the stone lantern are baked once, then flipped into a
 * reflection that is laid back in thin sliding rows. The two arching branches are baked
 * layers that rock gently about their roots. Petals are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.62;
  const MAX_PETALS = 36;
  const PETALS = 18;
  const MAX_RINGS = 5;
  const BLOSSOM = ['#a9577f', '#c27a9f', '#8a4a7c', '#d09ab2'];
  const LEAF = ['#3f5238', '#55703f', '#2f4332'];
  const BARK = '#3a2d2a';
  const STONE = '#7c8088';
  const STONE_LIT = '#a4a79f';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, TAU);
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
    const wy = Math.round(H * WATER);
    return { W, H, U, wy, hp: H - wy, mx: W * 0.6, my: H * 0.3, lx: W * 0.84 };
  }

  // ---- sky, moon, hills ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, '#171d36');
    grad.addColorStop(0.5, '#2c3558');
    grad.addColorStop(1, '#5d5c75');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    ctx.fillStyle = '#d9d0b4';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.4;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.3), 1, 1);
    }
    ctx.globalAlpha = 1;
    const r = g.U * 8;
    const halo = ctx.createRadialGradient(g.mx, g.my, r * 0.9, g.mx, g.my, r * 3.2);
    halo.addColorStop(0, 'rgba(232,214,160,0.30)');
    halo.addColorStop(1, 'rgba(232,214,160,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.wy);
    ctx.fillStyle = '#efe1b4';
    blob(ctx, g.mx, g.my, r, r);
    ctx.fillStyle = '#d9c78f';
    blob(ctx, g.mx - r * 0.3, g.my - r * 0.2, r * 0.28, r * 0.22);
    blob(ctx, g.mx + r * 0.25, g.my + r * 0.3, r * 0.22, r * 0.18);
    blob(ctx, g.mx + r * 0.35, g.my - r * 0.35, r * 0.14, r * 0.12);
  }

  function ridge(g, x, base, amp, seed) {
    return base + fbm(x / (g.U * 38), seed * 0.7, 4, seed) * amp;
  }

  function paintHills(ctx, g, rand) {
    const bands = [
      ['#5d668c', 0.44, 0.08, 5],
      ['#434c74', 0.52, 0.07, 9],
    ];
    for (const [col, base, amp, seed] of bands) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, g.H * base, g.H * amp, seed));
      ctx.lineTo(g.W, g.wy);
      ctx.fill();
    }
    ctx.fillStyle = '#1f2b3c';
    for (let x = -g.U; x < g.W + g.U; ) {
      const h = g.U * (8 + rand() * 10);
      const w = h * 0.2;
      const by = g.wy - g.U * 0.5;
      poly(ctx, [x - w, by, x + w, by, x, by - h]);
      poly(ctx, [x - w * 0.7, by - h * 0.35, x + w * 0.7, by - h * 0.35, x, by - h * 1.05]);
      x += w * (2.5 + rand() * 5);
    }
  }

  function paintBank(ctx, g, rand) {
    ctx.fillStyle = '#1d2a28';
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.wy - g.U * (1.2 + 0.9 * fbm(x / (g.U * 14), 2.2, 3, 17)));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.W;
      const h = g.U * (2 + rand() * 3);
      ctx.strokeStyle = i % 3 ? '#2b3b30' : '#3b4a37';
      ctx.lineWidth = Math.max(0.8, g.U * 0.22);
      ctx.beginPath();
      ctx.moveTo(x, g.wy - g.U * 0.6);
      ctx.quadraticCurveTo(x + h * 0.15, g.wy - h * 0.6, x + (rand() - 0.3) * h * 0.5, g.wy - h);
      ctx.stroke();
    }
    ctx.fillStyle = '#9d9376';
    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.45 + rand() * 0.5);
      const h = g.U * (4 + rand() * 3);
      ctx.strokeStyle = '#4d5040';
      ctx.lineWidth = Math.max(0.8, g.U * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, g.wy - g.U);
      ctx.lineTo(x + g.U * 0.4, g.wy - h);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      blob(ctx, x + g.U * 0.5, g.wy - h - g.U * 0.5, g.U * 0.4, g.U * 1.1);
      ctx.globalAlpha = 1;
    }
  }

  function paintLantern(ctx, g) {
    const U = g.U * 1.8;
    const x = g.lx;
    let y = g.wy - g.U * 0.9;
    const glow = ctx.createRadialGradient(x, y - U * 8.6, U * 0.5, x, y - U * 8.6, U * 7);
    glow.addColorStop(0, 'rgba(226,184,96,0.45)');
    glow.addColorStop(1, 'rgba(226,184,96,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - U * 8, y - U * 16, U * 16, U * 16);
    ctx.fillStyle = STONE;
    ctx.fillRect(x - U * 2.6, y - U * 1.2, U * 5.2, U * 1.2);
    y -= U * 1.2;
    ctx.fillRect(x - U * 0.9, y - U * 4, U * 1.8, U * 4);
    ctx.fillStyle = STONE_LIT;
    ctx.fillRect(x - U * 0.9, y - U * 4, U * 0.5, U * 4);
    y -= U * 4;
    ctx.fillStyle = STONE;
    ctx.fillRect(x - U * 2.2, y - U * 0.9, U * 4.4, U * 0.9);
    y -= U * 0.9;
    ctx.fillStyle = '#25272c';
    ctx.fillRect(x - U * 1.8, y - U * 3.2, U * 3.6, U * 3.2);
    ctx.fillStyle = '#e6c26a';
    ctx.fillRect(x - U * 1.2, y - U * 2.7, U * 2.4, U * 2.2);
    ctx.fillStyle = '#a98a45';
    ctx.fillRect(x - U * 0.1, y - U * 2.7, U * 0.2, U * 2.2);
    y -= U * 3.2;
    ctx.fillStyle = STONE;
    poly(ctx, [x - U * 4, y, x + U * 4, y, x + U * 2.6, y - U * 1.7, x + U * 0.7, y - U * 2.2,
      x - U * 0.7, y - U * 2.2, x - U * 2.6, y - U * 1.7]);
    ctx.fillStyle = STONE_LIT;
    poly(ctx, [x - U * 4, y, x - U * 2.6, y - U * 1.7, x - U * 0.7, y - U * 2.2, x - U * 1.2, y - U * 0.8]);
    y -= U * 2.2;
    ctx.fillStyle = STONE;
    blob(ctx, x, y - U * 0.6, U * 0.8, U * 0.9);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g, rand);
    paintBank(ctx, g, rand);
    paintLantern(ctx, g);
    return c;
  }

  function paintReflection(g, sky) {
    const c = layer(g.W, g.hp);
    const ctx = c.getContext('2d');
    ctx.translate(0, g.hp);
    ctx.scale(1, -1);
    ctx.drawImage(sky, 0, g.wy - g.hp, g.W, g.hp, 0, 0, g.W, g.hp);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1c2a3e';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, g.W, g.hp);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintPond(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(sky, 0, 0);
    const grad = ctx.createLinearGradient(0, g.wy, 0, g.H);
    grad.addColorStop(0, '#2c3a4e');
    grad.addColorStop(1, '#1a2438');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.wy, g.W, g.hp);
    return c;
  }

  function paintClouds(g, rand) {
    const c = layer(g.W * 2, g.H * 0.4);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4b5272';
    for (let i = 0; i < 9; i++) {
      const x = rand() * g.W * 2;
      const y = g.H * (0.08 + rand() * 0.22);
      const w = g.U * (14 + rand() * 18);
      for (const dx of [0, g.W * 2, -g.W * 2]) {
        ctx.globalAlpha = 0.55;
        blob(ctx, x + dx, y, w, g.U * (0.5 + rand() * 0.4));
        ctx.globalAlpha = 0.35;
        blob(ctx, x + dx + w * 0.3, y - g.U * 0.5, w * 0.6, g.U * 0.4);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bush clover branches ----------------------------------------------------

  function quad(a, b, c, t) {
    const s = 1 - t;
    return s * s * a + 2 * s * t * b + t * t * c;
  }

  function foliage(ctx, g, rand, x, y, nx, ny, scale) {
    const U = g.U;
    ctx.fillStyle = LEAF[Math.floor(rand() * 3)];
    blob(ctx, x + nx * U * 1.0, y + ny * U * 1.0, U * 1.0 * scale, U * 0.6 * scale);
    ctx.fillStyle = LEAF[Math.floor(rand() * 3)];
    blob(ctx, x - nx * U * 1.0, y - ny * U * 1.0, U * 1.0 * scale, U * 0.6 * scale);
    const n = rand() < 0.8 ? 3 + Math.floor(rand() * 3) : 0;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = BLOSSOM[Math.floor(rand() * BLOSSOM.length)];
      blob(ctx, x + (rand() - 0.5) * U * 2.6, y + rand() * U * 2.4, U * 0.85 * scale, U * 0.85 * scale);
    }
  }

  function branch(ctx, g, rand, p, w, depth) {
    const [x0, y0, cx, cy, x1, y1] = p;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(6, Math.round(len / (g.U * 1.1)));
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = quad(x0, cx, x1, t);
      const y = quad(y0, cy, y1, t);
      ctx.strokeStyle = BARK;
      ctx.lineWidth = Math.max(0.8, w * (1 - 0.7 * t));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      const nx = -(y - py) / (Math.hypot(x - px, y - py) || 1);
      const ny = (x - px) / (Math.hypot(x - px, y - py) || 1);
      if (depth >= 1 || t > 0.3) foliage(ctx, g, rand, x, y, nx, ny, depth ? 1 : 0.9);
      if (depth < 2 && t > 0.12 && t < 0.92 && rand() < (depth ? 0.16 : 0.3)) {
        const dir = rand() < 0.5 ? -1 : 1;
        const sl = len * (depth ? 0.2 : 0.3) * (0.6 + rand() * 0.6);
        const ex = x + dir * sl * (0.3 + rand() * 0.5);
        const ey = y + sl * (0.5 + rand() * 0.6);
        branch(ctx, g, rand, [x, y, x + dir * sl * 0.45, y - sl * 0.1, ex, ey], w * 0.55, depth + 1);
      }
      px = x;
      py = y;
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = BLOSSOM[i % BLOSSOM.length];
      blob(ctx, x1 + (rand() - 0.5) * g.U, y1 + rand() * g.U * 1.4, g.U * 0.55, g.U * 0.55);
    }
  }

  function paintBranch(g, rand, spec) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const p of spec) branch(ctx, g, rand, p, g.U * 2.2, 0);
    return c;
  }

  function branchSpecs(g) {
    const { W, H, U } = g;
    const left = [
      [-U * 4, H * 0.0, W * 0.16, -H * 0.12, W * 0.42, H * 0.3],
      [-U * 4, H * 0.1, W * 0.1, H * 0.0, W * 0.24, H * 0.34],
      [-U * 4, H * 0.03, W * 0.28, -H * 0.02, W * 0.5, H * 0.14],
    ];
    const right = [
      [W + U * 4, H * 0.0, W * 0.86, -H * 0.08, W * 0.74, H * 0.26],
      [W + U * 4, H * 0.12, W * 0.96, H * 0.06, W * 0.93, H * 0.36],
    ];
    return { left, right };
  }

  // ---- petals and rings --------------------------------------------------------

  function makePetals() {
    return {
      x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS),
      vy: new Float32Array(MAX_PETALS), p: new Float32Array(MAX_PETALS),
      stop: new Float32Array(MAX_PETALS), life: new Float32Array(MAX_PETALS),
      tone: new Uint8Array(MAX_PETALS), swim: new Uint8Array(MAX_PETALS),
    };
  }

  function resetPetal(g, P, i, rand, scatter) {
    P.x[i] = g.W * (0.04 + rand() * 0.6);
    P.y[i] = scatter ? rand() * g.H * 0.7 : g.H * (0.05 + rand() * 0.25);
    P.vy[i] = g.U * (1.6 + rand() * 1.4);
    P.p[i] = rand() * TAU;
    P.stop[i] = g.wy + g.hp * (0.1 + rand() * 0.75);
    P.life[i] = 0;
    P.tone[i] = Math.floor(rand() * BLOSSOM.length);
    P.swim[i] = 0;
  }

  function stepPetal(g, P, i, t, dt, rand) {
    if (!P.swim[i]) {
      P.y[i] += P.vy[i] * dt;
      P.x[i] += Math.sin(t * 0.9 + P.p[i]) * g.U * 1.2 * dt;
      if (P.y[i] >= P.stop[i]) {
        P.y[i] = P.stop[i];
        P.swim[i] = 1;
        P.life[i] = 0;
        spawnRing(g, P.x[i], P.y[i], t, 0.6);
      }
    } else {
      P.life[i] += dt;
      P.x[i] += g.U * 0.35 * dt;
      if (P.life[i] > 22) resetPetal(g, P, i, rand, false);
    }
  }

  function spawnRing(g, x, y, t, alpha) {
    const R = state.rings;
    const i = R.next;
    R.next = (i + 1) % MAX_RINGS;
    R.x[i] = x;
    R.y[i] = y;
    R.t0[i] = t;
    R.a[i] = alpha;
  }

  // ---- per frame -------------------------------------------------------------

  function drawReflection(ctx, g, t, ripple) {
    const amp = g.U * (0.25 + 0.2 * ripple);
    ctx.globalAlpha = 0.7;
    for (let y = 0; y < g.hp; y += 3) {
      const h = Math.min(3, g.hp - y);
      const dx = Math.sin(t * 0.8 + y * 0.45) * amp * (0.3 + y / g.hp);
      ctx.drawImage(state.refl, 0, y, g.W, h, dx, g.wy + y, g.W, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    const cy = g.wy + (g.wy - g.my);
    ctx.fillStyle = '#e6d6a0';
    for (let i = 0; i < 12; i++) {
      const y = cy - g.U * 6 + i * g.U * 1.05;
      if (y < g.wy + 1 || y > g.H - 1) continue;
      const w = g.U * (1.5 + 3.5 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.9)));
      const x = g.mx + Math.sin(t * 0.5 + i * 2.3) * g.U * 2.5 - w / 2;
      ctx.globalAlpha = 0.18 + 0.14 * Math.sin(t * 0.6 + i * 1.3);
      ctx.fillRect(x, y, w, Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx, g, t, ripple) {
    const R = state.rings;
    ctx.strokeStyle = '#b9b8c8';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    for (let i = 0; i < MAX_RINGS; i++) {
      const age = t - R.t0[i];
      if (age < 0 || age > 4) continue;
      ctx.globalAlpha = R.a[i] * ripple * 0.5 * (1 - age / 4);
      const r = g.U * (0.6 + age * 1.6);
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSwaying(ctx, g, img, px, py, a) {
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.drawImage(img, -px, -py);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const sq = P.swim[i] ? 0.35 : 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + P.p[i]));
      const a = P.p[i] + t * 0.5;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const sz = g.U * 0.9;
      ctx.globalAlpha = P.swim[i] ? Math.min(1, (22 - P.life[i]) / 3) * 0.85 : 1;
      ctx.fillStyle = BLOSSOM[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const sky = paintBack(g, rand);
    const spec = branchSpecs(g);
    state.g = g;
    state.rand = rand;
    state.back = paintPond(g, sky);
    state.refl = paintReflection(g, sky);
    state.clouds = paintClouds(g, rand);
    state.left = paintBranch(g, rand, spec.left);
    state.right = paintBranch(g, rand, spec.right);
    state.petals = makePetals();
    state.rings = { x: new Float32Array(MAX_RINGS), y: new Float32Array(MAX_RINGS),
      t0: new Float32Array(MAX_RINGS).fill(-99), a: new Float32Array(MAX_RINGS), next: 0 };
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, rand, true);
    state.nextRing = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, petals, ripple } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step, state.rand);
    if (ripple > 0 && t > state.nextRing) {
      spawnRing(g, g.W * (0.1 + state.rand() * 0.8), g.wy + g.hp * (0.15 + state.rand() * 0.8), t, 0.7);
      state.nextRing = t + 2.2 / Math.max(0.3, ripple);
    }
    ctx.drawImage(state.back, 0, 0);
    const off = ((t * g.U * 0.6) % (g.W * 2));
    ctx.globalAlpha = 0.8;
    ctx.drawImage(state.clouds, -off, 0);
    ctx.drawImage(state.clouds, g.W * 2 - off, 0);
    ctx.globalAlpha = 1;
    drawReflection(ctx, g, t, ripple);
    drawGlints(ctx, g, t);
    drawRings(ctx, g, t, ripple);
    const a1 = (Math.sin(t * 0.55) * 0.016 + Math.sin(t * 1.3 + 1) * 0.005) * sway;
    const a2 = (Math.sin(t * 0.47 + 2) * 0.02 + Math.sin(t * 1.1) * 0.006) * sway;
    drawSwaying(ctx, g, state.left, -g.U * 4, 0, a1);
    drawSwaying(ctx, g, state.right, g.W + g.U * 4, 0, a2);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { sway: 1, petals: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
