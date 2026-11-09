/*
 * 蝶 Cho — butterflies drifting over a summer meadow of wildflowers.
 *
 * Sky, hills and the far meadow are baked once. The long grass is one baked layer
 * drawn back in small tiles that lean with the breeze, more at the tips than the
 * roots. Clouds are one tiling strip. A handful of near flower stems and the
 * butterflies are the only things drawn fresh each frame.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.5;
  const GRASS_TOP = 0.56;
  const SKY = ['#7f97ae', '#9cafbd', '#bcc4c0', '#d8d6c2', '#e6dfc6'];
  const HILLS = [
    { y: 0.43, amp: 0.05, ink: '#8a9aa6', seed: 3 },
    { y: 0.47, amp: 0.04, ink: '#6f8878', seed: 7 },
    { y: 0.5, amp: 0.025, ink: '#5f7a4e', seed: 11 },
  ];
  const MEADOW = ['#7f9455', '#72894b', '#647c43', '#576f3b'];
  const BLADES = ['#4a6236', '#5a743f', '#6c8549', '#829a58', '#9bab68', '#b8ac62'];
  const BLOOMS = [
    { petal: '#ece5cf', heart: '#d4a23e' },
    { petal: '#cf5a3a', heart: '#3a2a22' },
    { petal: '#5d73a0', heart: '#e2d7b4' },
    { petal: '#ddb04a', heart: '#9a6a2a' },
    { petal: '#d98a74', heart: '#e6c766' },
  ];
  const WINGS = [
    { fore: '#d4703a', hind: '#c0532f', edge: '#2e2420', spot: '#ece2c8' },
    { fore: '#e8dfc4', hind: '#ddd1ae', edge: '#4a4236', spot: '#2e2a26' },
    { fore: '#dcb040', hind: '#c99a36', edge: '#3a2c1e', spot: '#efe4c2' },
    { fore: '#5e78a8', hind: '#4b6392', edge: '#22283a', spot: '#e6dcc0' },
  ];
  const MAX_FLIES = 12;
  const FLIES = 6;
  const STEMS = 11;
  const TILE_COLS = 12;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, hy: Math.round(H * HORIZON), gy: Math.round(H * GRASS_TOP) };
  }

  // ---- back: sky, hills, far meadow -----------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hy);
    SKY.forEach((ink, i) => grad.addColorStop(i / (SKY.length - 1), ink));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hy + 2);
  }

  function paintHills(ctx, g) {
    for (const h of HILLS) {
      ctx.fillStyle = h.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x / (g.U * 40), 0.5, 3, h.seed);
        ctx.lineTo(x, g.H * (h.y - h.amp * n * 1.6));
      }
      ctx.lineTo(g.W, g.H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintMeadow(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.hy, 0, g.H);
    MEADOW.forEach((ink, i) => grad.addColorStop(i / (MEADOW.length - 1), ink));
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hy, g.W, g.H - g.hy);
    const n = Math.round(g.W * 4);
    for (let i = 0; i < n; i++) {
      const d = rand();
      const y = lerp(g.hy + 1, g.H, d * d);
      const x = rand() * g.W;
      const drift = fbm(x / (g.U * 25), y / (g.U * 8), 3, 19);
      if (drift < 0.42) continue;
      const b = BLOOMS[Math.floor(rand() * BLOOMS.length)];
      ctx.fillStyle = b.petal;
      const s = Math.max(1, g.U * (0.25 + d * 0.9));
      ctx.fillRect(x, y, s, Math.max(1, s * 0.7));
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintHills(ctx, g);
    paintMeadow(ctx, g, rand);
    return c;
  }

  function paintClouds(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.28);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 22), y / (g.U * 7), 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = smoothstep(0.5, 0.72, v) * band;
        const i = (y * w + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 236;
        img.data[i + 2] = 222;
        img.data[i + 3] = a * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- grass ----------------------------------------------------------------

  function flowerHead(ctx, x, y, r, b, petals) {
    ctx.fillStyle = b.petal;
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * TAU;
      blob(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.45, r * 0.5, r * 0.32, a);
    }
    ctx.fillStyle = b.heart;
    blob(ctx, x, y, r * 0.32, r * 0.28);
  }

  function blade(ctx, g, rand, x, base, len) {
    const lean = (rand() - 0.5) * len * 0.5;
    ctx.strokeStyle = BLADES[Math.floor(rand() * BLADES.length)];
    ctx.lineWidth = Math.max(1, g.U * (0.25 + rand() * 0.35));
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.2, base - len * 0.6, x + lean, base - len);
    ctx.stroke();
  }

  function paintGrass(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    const n = Math.round(g.W * 3.2);
    for (let i = 0; i < n; i++) {
      const d = i / n;
      const base = lerp(g.H * 0.66, g.H * 1.04, d);
      const len = g.U * (5 + d * 22) * (0.6 + rand() * 0.6);
      blade(ctx, g, rand, rand() * g.W, base, len);
      if (rand() < 0.035 + d * 0.03) {
        const x = rand() * g.W;
        const top = base - len * (0.9 + rand() * 0.3);
        ctx.strokeStyle = '#4c6636';
        ctx.lineWidth = Math.max(1, g.U * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + (rand() - 0.5) * g.U * 2, top);
        ctx.stroke();
        const b = BLOOMS[Math.floor(rand() * BLOOMS.length)];
        flowerHead(ctx, x, top, g.U * (0.8 + d * 1.6), b, 6);
      }
    }
    return c;
  }

  // The grass layer comes back in tiles; each one leans with the wind at its spot.
  function drawGrass(ctx, g, t, breeze) {
    const img = state.grass;
    const tw = Math.ceil(g.W / TILE_COLS);
    const rb = state.band;
    const span = g.H - g.gy;
    const amp = g.U * 2.2 * breeze;
    for (let y = g.gy; y < g.H; y += rb) {
      const f = 1 - (y - g.gy) / span;
      const k = amp * f * f;
      const h = Math.min(rb, g.H - y);
      for (let x = 0; x < g.W; x += tw) {
        const w = Math.sin(t * 1.1 - x * 0.025) + 0.45 * Math.sin(t * 2.3 - x * 0.06 + 1.3);
        ctx.drawImage(img, x, y, tw, h, x + k * (w + 0.4), y, tw, h);
      }
    }
  }

  // ---- near stems ---------------------------------------------------------------

  function makeStems(g, rand) {
    const s = [];
    for (let i = 0; i < STEMS; i++) {
      s.push({
        x: ((i + 0.2 + rand() * 0.6) / STEMS) * g.W,
        len: g.H * (0.22 + rand() * 0.2),
        r: g.U * (1.8 + rand() * 1.3),
        bloom: BLOOMS[i % BLOOMS.length],
        p: rand() * TAU,
        petals: 5 + Math.floor(rand() * 3),
      });
    }
    return s;
  }

  function drawStems(ctx, g, t, breeze) {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (const s of state.stems) {
      const w = Math.sin(t * 1.1 - s.x * 0.025 + s.p * 0.2) + 0.45 * Math.sin(t * 2.3 - s.x * 0.06 + 1.3);
      const dx = g.U * 2.6 * breeze * (w + 0.4);
      const tx = s.x + dx;
      const ty = g.H - s.len;
      ctx.strokeStyle = '#3f5730';
      ctx.beginPath();
      ctx.moveTo(s.x, g.H + 1);
      ctx.quadraticCurveTo(s.x, g.H - s.len * 0.5, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#4f6a3a';
      blob(ctx, lerp(s.x, tx, 0.3) + g.U, g.H - s.len * 0.35, g.U * 1.6, g.U * 0.5, -0.5);
      flowerHead(ctx, tx, ty, s.r, s.bloom, s.petals);
    }
  }

  // ---- butterflies ------------------------------------------------------------

  function makeFlies(g, rand) {
    const f = [];
    for (let i = 0; i < MAX_FLIES; i++) {
      const near = rand();
      f.push({
        x0: rand() * g.W,
        y0: g.H * (0.32 + rand() * 0.42),
        vx: g.U * (1.2 + rand() * 2) * (rand() < 0.5 ? -1 : 1),
        size: g.U * (2.8 + near * 2.8),
        flap: 7 + rand() * 4,
        p: rand() * TAU,
        q: rand() * TAU,
        wing: WINGS[i % WINGS.length],
      });
    }
    return f;
  }

  function wingPair(ctx, s, open, side, wg) {
    const fx = side * s * 0.55 * open;
    const hx = side * s * 0.4 * open;
    ctx.fillStyle = wg.edge;
    blob(ctx, fx, -s * 0.28, s * 0.62 * open + 0.6, s * 0.48 + 0.6, side * 0.5);
    blob(ctx, hx, s * 0.28, s * 0.46 * open + 0.6, s * 0.36 + 0.6, -side * 0.4);
    ctx.fillStyle = wg.fore;
    blob(ctx, fx, -s * 0.28, s * 0.52 * open, s * 0.4, side * 0.5);
    ctx.fillStyle = wg.hind;
    blob(ctx, hx, s * 0.28, s * 0.38 * open, s * 0.3, -side * 0.4);
    ctx.fillStyle = wg.spot;
    blob(ctx, side * s * 0.75 * open, -s * 0.42, s * 0.12 * open, s * 0.1);
  }

  function drawFly(ctx, g, f, t) {
    const span = g.W + f.size * 8;
    let x = (f.x0 + f.vx * t) % span;
    if (x < 0) x += span;
    x += Math.sin(t * 0.45 + f.p) * g.U * 6 - f.size * 4;
    const y = f.y0 + Math.sin(t * 0.7 + f.q) * g.U * 5 + Math.sin(t * 2.1 + f.p) * g.U * 1.2;
    const beat = Math.sin(t * f.flap + f.p);
    const open = 0.18 + 0.82 * Math.abs(beat);
    const tilt = Math.sin(t * 0.9 + f.q) * 0.25 + (f.vx > 0 ? 0.15 : -0.15);
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    ctx.setTransform(c, sn, -sn, c, x, y);
    wingPair(ctx, f.size, open, -1, f.wing);
    wingPair(ctx, f.size, open, 1, f.wing);
    ctx.fillStyle = '#2a221c';
    ctx.fillRect(-Math.max(0.5, f.size * 0.08), -f.size * 0.5, Math.max(1, f.size * 0.16), f.size);
  }

  function drawFlies(ctx, g, t, count) {
    for (let i = 0; i < count; i++) drawFly(ctx, g, state.flies[i], t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.band = Math.max(2, Math.round(g.U * 2.5));
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g);
    state.grass = paintGrass(g, rand);
    state.stems = makeStems(g, rand);
    state.flies = makeFlies(g, rand);
  }

  function drawClouds(ctx, g, t) {
    const m = state.clouds;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.drawImage(m, -a, g.H * 0.04);
    ctx.drawImage(m, w - a, g.H * 0.04);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { butterflies, breeze } = api.props;
    const count = Math.min(MAX_FLIES, Math.round(FLIES * butterflies));
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawGrass(ctx, g, t, breeze);
    drawFlies(ctx, g, t, count);
    drawStems(ctx, g, t, breeze);
  }

  Kasuri.run({
    defaults: { butterflies: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
