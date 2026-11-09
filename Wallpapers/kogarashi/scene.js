/*
 * 木枯らし Kogarashi — the first winter wind along a country road at dusk.
 *
 * Sky, hills, fields and the road are baked once. Each bare tree is baked into its own
 * layer and drawn with a shear that follows the gusts, so it bends and springs back.
 * Dry leaves are a fixed pool that skitters along the ground; a few pale wind lines pass.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.56;
  const SKY = ['#3d4a66', '#56627a', '#7c8090', '#a89e94', '#cdb48c', '#dcc39a'];
  const HILL_FAR = '#5c6478';
  const HILL_NEAR = '#4a5560';
  const FIELD = ['#7c7a58', '#6e6c4c', '#5e5e42'];
  const ROAD = ['#b8a684', '#a8946f', '#c6b593'];
  const INK = '#2a2628';
  const INK_FAR = '#4e5060';
  const LEAF_TONES = ['#c4552f', '#d88a40', '#b4442b', '#d6aa52', '#a8603a'];
  const MAX_LEAVES = 70;
  const LEAVES = 44;
  const STREAKS = 7;
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
    const hy = Math.round(H * HORIZON);
    return { W, H, U, hy, vx: W * 0.62 };
  }

  function gust(t) {
    const v = 0.5 + 0.28 * Math.sin(t * 0.45) + 0.16 * Math.sin(t * 1.15 + 1.3) + 0.06 * Math.sin(t * 2.7 + 0.4);
    return Math.max(0, Math.min(1, v));
  }

  // ---- still world ---------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.hy;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.pow(y / h, 1.3) * (inks.length - 1);
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
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#e6d2a6';
    blob(ctx, g.W * 0.45, g.hy - g.U * 20, g.U * 3.2, g.U * 3.2);
    ctx.fillStyle = '#8a8894';
    for (let i = 0; i < 6; i++) {
      const x = g.W * (rand() * 1.1 - 0.05);
      const y = g.H * (0.08 + rand() * 0.22);
      blob(ctx, x, y, g.U * (10 + rand() * 16), g.U * (0.6 + rand() * 0.6));
    }
  }

  function ridge(ctx, g, base, amp, ink, seed) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) {
      const n = K.fbm(x / (g.U * 30), seed, 3, seed);
      ctx.lineTo(x, base - amp * n);
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
  }

  function roadEdge(g, y, side) {
    const f = (y - g.hy) / (g.H - g.hy);
    const half = lerp(g.U * 0.6, g.W * 0.2, Math.pow(f, 1.1));
    const centre = lerp(g.vx, g.W * 0.44, f) + Math.sin(f * 3.2) * g.U * 6 * f;
    return centre + side * half;
  }

  function paintGround(ctx, g, rand) {
    const rows = g.H - g.hy;
    for (let y = g.hy; y < g.H; y++) {
      const f = (y - g.hy) / rows;
      ctx.fillStyle = FIELD[f < 0.25 ? 0 : f < 0.6 ? 1 : 2];
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.fillStyle = '#8c8660';
    for (let i = 0; i < 26; i++) {
      const y = g.hy + rows * Math.pow(rand(), 1.4);
      const f = (y - g.hy) / rows;
      blob(ctx, rand() * g.W, y, g.U * (3 + 14 * f), g.U * (0.2 + 0.6 * f));
    }
    for (let y = g.hy; y < g.H; y++) {
      const f = (y - g.hy) / rows;
      const l = roadEdge(g, y, -1);
      const r = roadEdge(g, y, 1);
      ctx.fillStyle = ROAD[f < 0.35 ? 2 : rand() < 0.5 ? 0 : 0];
      ctx.fillRect(l, y, r - l, 1);
      ctx.fillStyle = ROAD[1];
      const rut = (r - l) * 0.18;
      ctx.fillRect(lerp(l, r, 0.28) - rut * 0.1, y, Math.max(0.5, rut * 0.2), 1);
      ctx.fillRect(lerp(l, r, 0.72) - rut * 0.1, y, Math.max(0.5, rut * 0.2), 1);
    }
    ctx.strokeStyle = '#4c4a36';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 90; i++) {
      const y = g.hy + rows * (0.15 + 0.85 * Math.pow(rand(), 0.8));
      const f = (y - g.hy) / rows;
      let x = rand() * g.W;
      const l = roadEdge(g, y, -1);
      const r = roadEdge(g, y, 1);
      if (x > l - g.U && x < r + g.U) x = rand() < 0.5 ? l - g.U * (1 + rand() * 6) : r + g.U * (1 + rand() * 6);
      const h = g.U * (1 + 4 * f);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + h * 0.6, y - h);
      ctx.moveTo(x + g.U * 0.5, y);
      ctx.lineTo(x + h * 0.9, y - h * 0.7);
      ctx.stroke();
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, g.hy - g.U * 1, g.U * 16, HILL_FAR, 3.1);
    ridge(ctx, g, g.hy + g.U * 0.5, g.U * 7, HILL_NEAR, 8.7);
    paintGround(ctx, g, rand);
    return c;
  }

  // ---- trees ---------------------------------------------------------------

  function branch(ctx, rand, x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = Math.max(0.7, w);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      (x + x2) / 2 + (rand() - 0.5) * len * 0.25,
      (y + y2) / 2 + (rand() - 0.5) * len * 0.25,
      x2, y2);
    ctx.stroke();
    if (depth <= 0) return;
    const kids = depth > 4 ? 2 : 2 + (rand() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const spread = 0.35 + rand() * 0.35;
      const a = ang + (k - (kids - 1) / 2) * spread * 1.4 + (rand() - 0.5) * 0.3 + 0.06;
      branch(ctx, rand, x2, y2, a, len * (0.68 + rand() * 0.12), w * 0.66, depth - 1);
    }
  }

  function bakeTree(g, rand, height, ink) {
    const w = height * 1.4;
    const h = height * 1.08;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    const trunk = height * 0.3;
    const base = Math.max(1.2, height * 0.05);
    ctx.lineWidth = base;
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.quadraticCurveTo(w / 2 - base * 0.4, h - trunk * 0.5, w / 2 + base * 0.3, h - trunk);
    ctx.stroke();
    const depth = height > g.U * 30 ? 7 : height > g.U * 12 ? 6 : 4;
    branch(ctx, rand, w / 2 + base * 0.3, h - trunk, -Math.PI / 2 - 0.5, height * 0.24, base * 0.7, depth);
    branch(ctx, rand, w / 2 + base * 0.3, h - trunk, -Math.PI / 2 + 0.05, height * 0.27, base * 0.75, depth);
    branch(ctx, rand, w / 2 + base * 0.3, h - trunk, -Math.PI / 2 + 0.55, height * 0.22, base * 0.6, depth - 1);
    return { c, w, h };
  }

  function makeTrees(g, rand) {
    const spots = [
      [0.13, 1.01, 0.9, INK, 1],
      [0.88, 0.97, 0.72, INK, 0.9],
      [0.3, 0.8, 0.36, '#3a3638', 0.7],
      [0.76, 0.69, 0.2, INK_FAR, 0.55],
      [0.53, 0.63, 0.11, INK_FAR, 0.4],
      [0.7, 0.6, 0.08, INK_FAR, 0.35],
    ];
    return spots.map(([fx, fy, fh, ink, flex], i) => ({
      x: g.W * fx, y: g.H * fy, flex, phase: i * 0.7, ...bakeTree(g, rand, g.H * fh, ink),
    }));
  }

  function drawTrees(ctx, t, wind) {
    for (const tr of state.trees) {
      const lag = gust(t - tr.phase * 0.3);
      const sway = Math.sin(t * 2.3 + tr.phase) * 0.03;
      const k = -(0.06 + lag * 0.22 + sway) * wind * tr.flex;
      ctx.setTransform(1, 0, k, 1, tr.x, tr.y);
      ctx.drawImage(tr.c, -tr.w / 2, -tr.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- leaves and wind -----------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), floor: f(), vy: f(), lift: f(), a: f(), spin: f(), p: f(), size: f(), tone: f(), pace: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    const f = Math.pow(r(), 0.7);
    L.floor[i] = lerp(g.hy + g.U * 3, g.H, f);
    L.size[i] = g.U * (0.9 + 3.4 * f) * (0.8 + r() * 0.4);
    L.pace[i] = 0.5 + f * 0.8 + r() * 0.4;
    L.x[i] = scatter ? r() * g.W : -g.U * (2 + r() * 20);
    L.y[i] = L.floor[i] - (r() < 0.3 ? r() * g.U * 20 : 0);
    L.vy[i] = 0;
    L.lift[i] = r();
    L.a[i] = r() * TAU;
    L.spin[i] = 2 + r() * 6;
    L.p[i] = r() * TAU;
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
  }

  function stepLeaves(g, t, dt, count, wind) {
    const L = state.leaves;
    const r = state.rand;
    const gs = gust(t);
    for (let i = 0; i < count; i++) {
      const push = (0.25 + gs * 1.1) * wind;
      L.x[i] += g.U * 16 * L.pace[i] * push * dt;
      L.vy[i] += g.U * 40 * dt;
      L.y[i] += L.vy[i] * dt;
      if (L.y[i] >= L.floor[i]) {
        L.y[i] = L.floor[i];
        L.vy[i] = r() < push * 0.08 ? -g.U * (6 + r() * 14) * L.pace[i] : 0;
      }
      L.a[i] += L.spin[i] * push * dt;
      if (L.x[i] > g.W + g.U * 4) resetLeaf(g, L, i, false);
    }
  }

  function drawLeaves(ctx, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c, s * 0.5, -s, c * 0.5 + 0.5, L.x[i], L.y[i] - sz * 0.3);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeStreaks(g, rand) {
    const s = [];
    for (let i = 0; i < STREAKS; i++) {
      s.push({ y: g.H * (0.12 + rand() * 0.7), len: g.U * (10 + rand() * 18), off: rand(), pace: 0.7 + rand() * 0.6 });
    }
    return s;
  }

  function drawStreaks(ctx, g, t, wind) {
    if (wind <= 0) return;
    const span = g.W * 1.6;
    ctx.strokeStyle = '#ddd2ba';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = Math.min(0.4, 0.22 * wind);
    ctx.beginPath();
    for (const st of state.streaks) {
      const x = ((st.off * span + t * g.U * 34 * st.pace * wind) % span) - g.W * 0.3;
      const y = st.y + Math.sin(t * 1.4 + st.off * 9) * g.U;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + st.len * 0.5, y - g.U * 0.8, x + st.len, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.trees = makeTrees(g, rand);
    state.streaks = makeStreaks(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, leaves } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    stepLeaves(g, t, Math.min(dt, 0.1), count, wind);
    ctx.drawImage(state.back, 0, 0);
    drawStreaks(ctx, g, t, wind);
    drawTrees(ctx, t, wind);
    drawLeaves(ctx, count);
  }

  Kasuri.run({
    defaults: { wind: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
