/*
 * 蟹 Kani — low tide on a rocky shore, seen from above.
 *
 * Sand, rocks and their pools are baked once. The sea is a baked band with a slow
 * drifting strip of crests; each wave is one baked sheet of water and foam that slides
 * up the sand and back. Crabs are a small pool that walk sideways from pool to pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const SHORE = 0.2;
  const MAX_CRABS = 14;
  const CRABS = 7;
  const WAVE_PERIOD = 10;
  const SAND = ['#c9b48c', '#bfa982', '#d4c29c'];
  const WET = '#9c8f78';
  const SEA = ['#26405a', '#2f4d66', '#3b5d70', '#4b6e78'];
  const STONE = { dark: '#34312d', mid: '#4f4b45', top: '#6e6961', lit: '#8a8378' };
  const MOSS = ['#4d6340', '#5f7448', '#6f7f4c'];
  const POOL = { deep: '#2c4658', mid: '#3e6070', lit: '#7a979a' };
  const CRAB = { leg: '#7e2c20', body: '#b4442b', claw: '#c4542f', lit: '#d9713e', tip: '#5a221a', eye: '#1f1a17' };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, a) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), a || 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, shore: H * SHORE };
  }

  function shoreAt(g, x) {
    return g.shore + Math.sin(x / (g.U * 23)) * g.U * 1.6 + Math.sin(x / (g.U * 9) + 1.3) * g.U * 0.7;
  }

  // ---- sand, rocks and pools ----------------------------------------------

  function paintSand(ctx, g) {
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = SAND.map(K.parseColor);
    const wet = K.parseColor(WET);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 10), y / (g.U * 10), 3, 11);
        const rip = Math.sin((y + fbm(x / (g.U * 20), y / (g.U * 20), 2, 5) * g.U * 14) / (g.U * 1.6));
        let ink = inks[0];
        if (rip > 0.75) ink = inks[1];
        else if (n > 0.6) ink = inks[2];
        else if (n < 0.36) ink = inks[1];
        const s = shoreAt(g, x);
        const w = clamp(1 - (y - s) / (g.H * 0.26), 0, 1);
        const mix = Math.round(w * w * 4) / 4;
        const i = (y * g.W + x) * 4;
        d[i] = lerp(ink[0], wet[0], mix);
        d[i + 1] = lerp(ink[1], wet[1], mix);
        d[i + 2] = lerp(ink[2], wet[2], mix);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintRock(ctx, g, rand, cx, cy, r) {
    ctx.fillStyle = 'rgba(40,34,28,0.35)';
    blob(ctx, cx + r * 0.15, cy + r * 0.2, r * 1.15, r * 0.8);
    const n = 5 + Math.floor(rand() * 4);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const d = r * (0.25 + rand() * 0.55);
      parts.push([cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.8, r * (0.4 + rand() * 0.35), rand() * TAU]);
    }
    const passes = [[STONE.dark, 0, 0, 1], [STONE.mid, -0.08, -0.1, 0.85], [STONE.top, -0.14, -0.2, 0.6], [STONE.lit, -0.2, -0.28, 0.3]];
    for (const [ink, ox, oy, k] of passes) {
      ctx.fillStyle = ink;
      for (const p of parts) blob(ctx, p[0] + ox * p[2], p[1] + oy * p[2], p[2] * k * 1.25, p[2] * k * 0.9, p[3]);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = MOSS[i % MOSS.length];
      const a = rand() * TAU;
      blob(ctx, cx + Math.cos(a) * r * 1.0, cy + Math.sin(a) * r * 0.6, r * (0.12 + rand() * 0.12), r * 0.1);
    }
  }

  function paintPool(ctx, g, rand, p) {
    ctx.fillStyle = STONE.dark;
    blob(ctx, p.x, p.y, p.rx * 1.18, p.ry * 1.25);
    ctx.fillStyle = POOL.deep;
    blob(ctx, p.x, p.y, p.rx, p.ry);
    ctx.fillStyle = POOL.mid;
    blob(ctx, p.x + p.rx * 0.1, p.y + p.ry * 0.12, p.rx * 0.75, p.ry * 0.68);
    ctx.fillStyle = MOSS[1];
    for (let i = 0; i < 5; i++) {
      const a = rand() * TAU;
      blob(ctx, p.x + Math.cos(a) * p.rx * 0.8, p.y + Math.sin(a) * p.ry * 0.75, p.rx * 0.12, p.ry * 0.1);
    }
    ctx.fillStyle = POOL.lit;
    ctx.globalAlpha = 0.6;
    blob(ctx, p.x - p.rx * 0.35, p.y - p.ry * 0.4, p.rx * 0.32, p.ry * 0.12, -0.2);
    ctx.globalAlpha = 1;
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSand(ctx, g);
    ctx.fillStyle = '#8f8068';
    for (let i = 0; i < 70; i++) {
      blob(ctx, rand() * g.W, g.shore + rand() * (g.H - g.shore), g.U * (0.3 + rand() * 0.5), g.U * 0.3);
    }
    const spots = [[0.12, 0.62, 1.1], [0.33, 0.42, 0.85], [0.55, 0.74, 1.2], [0.74, 0.47, 0.9], [0.9, 0.78, 1], [0.24, 0.88, 0.7], [0.66, 0.95, 0.6]];
    const pools = [];
    for (const [fx, fy, k] of spots) {
      const x = g.W * fx;
      const y = g.H * fy;
      const r = g.U * 11 * k;
      paintRock(ctx, g, rand, x, y, r);
      const p = { x: x + r * 0.1, y: y - r * 0.05, rx: r * 0.62, ry: r * 0.38 };
      paintPool(ctx, g, rand, p);
      pools.push(p);
    }
    return { canvas: c, pools };
  }

  // ---- sea and waves -------------------------------------------------------

  function paintSea(g) {
    const h = Math.ceil(g.shore + g.U * 4);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const inks = SEA.map(K.parseColor);
    const foam = K.parseColor('#e4ddc8');
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    for (let x = 0; x < g.W; x++) {
      const s = shoreAt(g, x);
      for (let y = 0; y < h; y++) {
        const i = (y * g.W + x) * 4;
        if (y > s) continue;
        const f = clamp(y / s, 0, 1) * (inks.length - 1);
        const n = fbm(x / (g.U * 8), y / (g.U * 3), 2, 21);
        const ink = inks[Math.min(inks.length - 1, Math.floor(f + (n - 0.5) * 0.9 + 0.5))];
        const edge = s - y < g.U * 1.3 && fbm(x / (g.U * 2), y / g.U, 2, 4) > 0.42;
        const px = edge ? foam : ink;
        d[i] = px[0];
        d[i + 1] = px[1];
        d[i + 2] = px[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintCrests(g) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.shore * 0.85);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#9fb2b0';
    ctx.lineCap = 'round';
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y = h * (0.15 + (r / rows) * 0.8);
      ctx.lineWidth = Math.max(1, g.U * (0.35 + r * 0.08));
      ctx.globalAlpha = 0.35 + r * 0.1;
      for (let x = (r * 37) % (g.U * 30); x < w; x += g.U * (16 + (r % 3) * 5)) {
        const len = g.U * (6 + ((x * 7 + r * 13) % 6));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y - g.U * 0.9, x + len, y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintWash(g) {
    const h = Math.ceil(g.H * 0.3);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    const water = K.parseColor('#5d7f86');
    const foam = K.parseColor('#e6dfcb');
    for (let x = 0; x < g.W; x++) {
      const e = h - g.U * 2 - fbm(x / (g.U * 7), 3, 3, 9) * g.U * 6 - Math.sin(x / (g.U * 13)) * g.U * 1.5;
      for (let y = 0; y < h; y++) {
        const i = (y * g.W + x) * 4;
        if (y > e + g.U * 0.6) continue;
        const near = e - y;
        const lace = fbm(x / (g.U * 1.6), y / (g.U * 1.1), 2, 31);
        let px = water;
        let a = 0.5 + 0.25 * smoothstep(g.U * 6, 0, near);
        if (near < g.U * 1.4 || (near < g.U * 4 && lace > 0.62)) {
          px = foam;
          a = 0.85;
        }
        d[i] = px[0];
        d[i + 1] = px[1];
        d[i + 2] = px[2];
        d[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function waveReach(t, offset) {
    const p = ((t + offset) / WAVE_PERIOD) % 1;
    if (p < 0.3) {
      const k = p / 0.3;
      return 1 - (1 - k) * (1 - k);
    }
    const k = (p - 0.3) / 0.7;
    return 1 - k * k * (3 - 2 * k);
  }

  function drawWave(ctx, g, t, surf, offset, reachK, alpha) {
    const w = state.wash;
    const reach = waveReach(t, offset);
    const y = g.shore + reach * g.H * 0.22 * surf * reachK - w.height + g.U * 2;
    ctx.globalAlpha = alpha * (0.35 + 0.65 * reach);
    ctx.drawImage(w, Math.sin((t + offset) * 0.3) * g.U * 3 - g.U * 4, y);
    ctx.globalAlpha = 1;
  }

  function drawSea(ctx, g, t) {
    ctx.drawImage(state.sea, 0, 0);
    const c = state.crests;
    const off = (t * g.U * 1.4) % (c.width - g.W);
    ctx.drawImage(c, -off, g.shore * 0.05);
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#c8cdbd';
    const pools = state.pools;
    for (let i = 0; i < pools.length; i++) {
      const p = pools[i];
      const s = Math.sin(t * 0.7 + i * 1.9);
      ctx.globalAlpha = 0.25 + 0.2 * s;
      blob(ctx, p.x + Math.cos(t * 0.4 + i) * p.rx * 0.3, p.y + p.ry * 0.15, p.rx * 0.18, p.ry * 0.07);
    }
    ctx.globalAlpha = 1;
  }

  // ---- crabs ---------------------------------------------------------------

  function makeCrabs() {
    const f = () => new Float32Array(MAX_CRABS);
    return { x: f(), y: f(), a: f(), tx: f(), ty: f(), mode: f(), timer: f(), gait: f(), size: f(), pace: f(), claw: f() };
  }

  function pickTarget(g, C, i) {
    const r = state.rand;
    const pools = state.pools;
    if (r() < 0.75) {
      const p = pools[Math.floor(r() * pools.length)];
      const a = r() * TAU;
      C.tx[i] = p.x + Math.cos(a) * p.rx * 1.35;
      C.ty[i] = p.y + Math.sin(a) * p.ry * 1.6;
    } else {
      C.tx[i] = g.W * (0.05 + r() * 0.9);
      C.ty[i] = g.shore + g.H * (0.12 + r() * 0.8);
    }
    C.tx[i] = clamp(C.tx[i], g.U * 3, g.W - g.U * 3);
    C.ty[i] = clamp(C.ty[i], g.shore + g.U * 8, g.H - g.U * 3);
  }

  function resetCrab(g, C, i) {
    const r = state.rand;
    pickTarget(g, C, i);
    C.x[i] = C.tx[i];
    C.y[i] = C.ty[i];
    C.a[i] = r() * TAU;
    C.mode[i] = 0;
    C.timer[i] = r() * 3;
    C.gait[i] = r() * TAU;
    C.size[i] = g.U * (0.85 + r() * 0.35);
    C.pace[i] = g.U * (5 + r() * 4);
    C.claw[i] = 0;
  }

  function turnToward(cur, want) {
    let d = (want - cur) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  function stepCrab(g, C, i, dt) {
    if (C.mode[i] === 0) {
      C.timer[i] -= dt;
      C.claw[i] = Math.max(0, C.claw[i] - dt * 2);
      if (C.timer[i] < 1.2 && C.timer[i] > 0.6) C.claw[i] = Math.min(1, C.claw[i] + dt * 5);
      if (C.timer[i] <= 0) {
        pickTarget(g, C, i);
        C.mode[i] = 1;
      }
      return;
    }
    const dx = C.tx[i] - C.x[i];
    const dy = C.ty[i] - C.y[i];
    const dist = Math.hypot(dx, dy);
    if (dist < g.U * 0.6) {
      C.mode[i] = 0;
      C.timer[i] = 1.5 + state.rand() * 4;
      return;
    }
    const dir = Math.atan2(dy, dx);
    const d1 = turnToward(C.a[i], dir);
    const d2 = turnToward(C.a[i], dir + Math.PI);
    const d = Math.abs(d1) < Math.abs(d2) ? d1 : d2;
    C.a[i] += clamp(d, -dt * 3, dt * 3);
    const step = Math.min(dist, C.pace[i] * dt * (0.7 + 0.3 * Math.abs(Math.sin(C.gait[i]))));
    C.x[i] += (dx / dist) * step;
    C.y[i] += (dy / dist) * step;
    C.gait[i] += dt * 14;
  }

  function drawCrab(ctx, C, i) {
    const s = C.size[i];
    const c = Math.cos(C.a[i]);
    const sn = Math.sin(C.a[i]);
    const walk = C.mode[i] === 1 ? 1 : 0.15;
    const gait = C.gait[i];
    ctx.setTransform(c, sn, -sn, c, C.x[i], C.y[i]);
    ctx.fillStyle = 'rgba(40,32,26,0.35)';
    blob(ctx, s * 0.5, s * 0.7, s * 4.2, s * 2.8);
    ctx.strokeStyle = CRAB.leg;
    ctx.lineWidth = Math.max(1, s * 0.65);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 4; k++) {
        const swing = Math.sin(gait + k * 1.6 + (side > 0 ? Math.PI : 0)) * 0.35 * walk;
        const base = (-0.55 + k * 0.38 + swing) * side;
        const ax = side * s * 2.4;
        const ay = (-0.6 + k * 0.55) * s;
        const kx = ax + side * Math.cos(base) * s * 2;
        const ky = ay + Math.sin(base) * s * 2 * side - s * 0.6;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + side * s * 1.1, ky + s * 1.4);
        ctx.stroke();
      }
    }
    const lift = C.claw[i] * s * 0.9;
    ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, -s * 1.6);
    ctx.lineTo(-s * 2.2, -s * 3.2 - lift);
    ctx.moveTo(s * 1.4, -s * 1.6);
    ctx.lineTo(s * 2.2, -s * 3.2 - lift);
    ctx.stroke();
    ctx.fillStyle = CRAB.body;
    blob(ctx, 0, 0, s * 3, s * 2.2);
    ctx.fillStyle = CRAB.claw;
    blob(ctx, -s * 2.3, -s * 3.6 - lift, s * 1.25, s * 0.95, 0.4);
    blob(ctx, s * 2.3, -s * 3.6 - lift, s * 1.25, s * 0.95, -0.4);
    ctx.fillStyle = CRAB.tip;
    blob(ctx, -s * 2.5, -s * 4.4 - lift, s * 0.5, s * 0.4);
    blob(ctx, s * 2.5, -s * 4.4 - lift, s * 0.5, s * 0.4);
    ctx.fillStyle = CRAB.lit;
    blob(ctx, -s * 0.5, -s * 0.6, s * 1.6, s * 0.9);
    ctx.fillStyle = CRAB.eye;
    blob(ctx, -s * 0.8, -s * 2.1, s * 0.4, s * 0.4);
    blob(ctx, s * 0.8, -s * 2.1, s * 0.4, s * 0.4);
  }

  function drawCrabs(ctx, count) {
    const C = state.crabs;
    for (let i = 0; i < count; i++) drawCrab(ctx, C, i);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.rand = K.rng(api.seed);
    const ground = paintGround(g, state.rand);
    state.ground = ground.canvas;
    state.pools = ground.pools;
    state.sea = paintSea(g);
    state.crests = paintCrests(g);
    state.wash = paintWash(g);
    state.crabs = makeCrabs();
    for (let i = 0; i < MAX_CRABS; i++) resetCrab(g, state.crabs, i);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { crabs, surf } = api.props;
    const count = Math.min(MAX_CRABS, Math.round(CRABS * crabs));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepCrab(g, state.crabs, i, step);
    ctx.drawImage(state.ground, 0, 0);
    drawGlints(ctx, g, t);
    drawCrabs(ctx, count);
    if (surf > 0) {
      drawWave(ctx, g, t, surf, WAVE_PERIOD * 0.55, 0.6, 0.6);
      drawWave(ctx, g, t, surf, 0, 1, 1);
    }
    drawSea(ctx, g, t);
  }

  Kasuri.run({
    defaults: { crabs: 1, surf: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
