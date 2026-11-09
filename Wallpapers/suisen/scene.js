/*
 * 水仙 Suisen — white narcissus on a windswept winter headland.
 *
 * Sky, sea, headland, torii, pine and leaves are baked once. Each frame slides
 * thin wave streaks, pulses the foam along the rocks, lifts a short pool of
 * spray, sways the flowers and flies a few gulls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const HORIZON = 0.42;
  const STREAKS = 64;
  const SPRAYS = 18;
  const GULLS = 3;
  const SKY = ['#8499ab', '#a9b7bf', '#cfd1c6', '#e9dfc6'];
  const SEA = ['#8aa2ad', '#5f7a89', '#42606f', '#2f4a5a'];
  const ROCK = ['#26282b', '#383a3b', '#4c4c49', '#62604f'];
  const GRASS = ['#55663f', '#6b7648', '#8b8a55', '#a59a62'];
  const PETAL = '#f4f0e3';
  const CUP = '#e2b84a';
  const VERMILION = '#c0432c';
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

  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  function scaled(pts, W, H) {
    return pts.map((v, i) => v * (i % 2 ? H : W));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, hor: Math.round(H * HORIZON) };
  }

  // Shapes as fractions of the frame size.
  const LAND = [0, 0.47, 0.14, 0.455, 0.27, 0.48, 0.37, 0.52, 0.43, 0.58, 0.46, 0.7, 0.45, 0.85, 0.41, 1, 0, 1];
  const HEAD = [0.4, 0.545, 0.47, 0.57, 0.53, 0.64, 0.58, 0.72, 0.65, 0.79, 0.74, 0.84, 0.83, 0.9, 0.9, 0.97, 0.86, 1, 0.41, 1, 0.45, 0.8, 0.44, 0.66];
  const FOAM_LINE = [0.9, 0.97, 0.83, 0.9, 0.74, 0.84, 0.65, 0.79, 0.58, 0.72, 0.53, 0.64];

  // ---- sky and sea -----------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.hor);
    SKY.forEach((col, i) => grad.addColorStop(i / (SKY.length - 1), col));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hor + 1);
    const sx = g.W * 0.74;
    const sy = g.H * 0.3;
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#efe0b4';
      blob(ctx, sx, sy, g.U * i * 5, g.U * i * 5);
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#f2e3b6';
    blob(ctx, sx, sy, g.U * 3.4, g.U * 3.4);
    ctx.globalAlpha = 1;
    paintFarShore(ctx, g, rand);
    return c;
  }

  function paintFarShore(ctx, g, rand) {
    ctx.fillStyle = '#8c9aa0';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.5, g.hor);
    for (let x = g.W * 0.5; x <= g.W; x += 2) {
      const f = (x - g.W * 0.5) / (g.W * 0.5);
      ctx.lineTo(x, g.hor - g.U * (1 + 4 * Math.sin(f * 3.1) * fbm(x * 0.03, 1.2, 3, 5)));
    }
    ctx.lineTo(g.W, g.hor);
    ctx.fill();
    ctx.fillStyle = '#7b8b94';
    blob(ctx, g.W * 0.6, g.hor, g.U * 5, g.U * 1.2);
    blob(ctx, g.W * 0.64, g.hor, g.U * 2.5, g.U * 2);
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.012, y * 0.08, 4, 31);
        const b = fbm((x - w) * 0.012, y * 0.08, 4, 31);
        const v = a + (b - a) * (x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 238;
        img.data[i + 2] = 228;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSea(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.hor, 0, g.H);
    SEA.forEach((col, i) => grad.addColorStop(i / (SEA.length - 1), col));
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hor, g.W, g.H - g.hor);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#efe0b4';
    for (let y = g.hor; y < g.hor + g.H * 0.2; y += 1) {
      const f = (y - g.hor) / (g.H * 0.2);
      const w = g.U * (4 + 8 * (1 - f));
      ctx.fillRect(g.W * 0.74 - w / 2 + Math.sin(y * 1.7) * g.U, y, w, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- land --------------------------------------------------------------------

  function speckle(ctx, g, rand, box, inks, count, len, tilt) {
    for (let i = 0; i < count; i++) {
      const x = box[0] + rand() * (box[2] - box[0]);
      const y = box[1] + rand() * (box[3] - box[1]);
      ctx.strokeStyle = inks[Math.floor(rand() * inks.length)];
      ctx.lineWidth = Math.max(1, g.U * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tilt * len * (0.5 + rand()), y - len * (0.6 + rand()));
      ctx.stroke();
    }
  }

  function paintHead(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pts = scaled(HEAD, g.W, g.H);
    ctx.fillStyle = ROCK[1];
    path(ctx, pts);
    ctx.fill();
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    for (let i = 0; i < g.W * g.H * 0.05; i++) {
      const x = rand() * g.W;
      const y = g.H * 0.5 + rand() * g.H * 0.5;
      const n = fbm(x * 0.05, y * 0.12, 3, 17);
      ctx.fillStyle = ROCK[Math.min(3, Math.floor(n * 4))];
      ctx.fillRect(x, y, 1 + rand() * g.U * 2.4, 1);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ROCK[0];
    for (let i = 0; i < 7; i++) {
      const y = g.H * (0.6 + i * 0.06);
      ctx.fillRect(g.W * 0.38, y, g.W * 0.6, g.U * 0.5);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = GRASS[1];
    ctx.beginPath();
    ctx.moveTo(g.W * 0.4, g.H * 0.545);
    ctx.lineTo(g.W * 0.47, g.H * 0.57);
    ctx.lineTo(g.W * 0.53, g.H * 0.64);
    ctx.lineTo(g.W * 0.51, g.H * 0.655);
    ctx.lineTo(g.W * 0.46, g.H * 0.6);
    ctx.lineTo(g.W * 0.4, g.H * 0.575);
    ctx.fill();
    return c;
  }

  function paintLand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pts = scaled(LAND, g.W, g.H);
    ctx.fillStyle = GRASS[0];
    path(ctx, pts);
    ctx.fill();
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    const box = [0, g.H * 0.44, g.W * 0.5, g.H];
    speckle(ctx, g, rand, box, GRASS, g.W * g.H * 0.035, g.U * 1.4, 0.7);
    speckle(ctx, g, rand, [0, g.H * 0.7, g.W * 0.46, g.H], GRASS, g.W * g.H * 0.012, g.U * 3.2, 0.8);
    ctx.fillStyle = ROCK[0];
    ctx.globalAlpha = 0.5;
    blob(ctx, g.W * 0.43, g.H * 0.78, g.U * 2.6, g.U * 12);
    ctx.globalAlpha = 1;
    ctx.restore();
    return c;
  }

  // ---- torii and pine ----------------------------------------------------------

  function paintTorii(ctx, g) {
    const x = g.W * 0.3;
    const y = g.H * 0.52;
    const h = g.U * 10;
    const w = g.U * 7;
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - w / 2, y - h, g.U * 0.9, h);
    ctx.fillRect(x + w / 2 - g.U * 0.9, y - h, g.U * 0.9, h);
    ctx.fillRect(x - w / 2 - g.U * 0.5, y - h * 0.8, w + g.U, g.U * 0.7);
    ctx.fillStyle = '#2a2523';
    ctx.fillRect(x - w / 2 - g.U * 1.3, y - h - g.U * 1.1, w + g.U * 2.6, g.U * 1.1);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - w / 2 - g.U * 0.8, y - h - g.U * 0.1, w + g.U * 1.6, g.U * 0.5);
  }

  function paintPine(ctx, g, rand) {
    const bx = g.W * 0.4;
    const by = g.H * 0.555;
    ctx.strokeStyle = '#3a2d25';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + g.U * 2, by - g.U * 6, bx - g.U * 3, by - g.U * 11);
    ctx.stroke();
    ctx.lineWidth = g.U * 0.8;
    ctx.beginPath();
    ctx.moveTo(bx - g.U * 1.5, by - g.U * 8.5);
    ctx.quadraticCurveTo(bx - g.U * 6, by - g.U * 8, bx - g.U * 10, by - g.U * 9.5);
    ctx.stroke();
    const tufts = [[-3, -11.5, 4.4], [-9, -9.8, 3.6], [-6, -9, 3.2], [0.5, -9.5, 2.8], [-11.5, -8.4, 2.4]];
    tufts.forEach((t, k) => {
      const cx = bx + t[0] * g.U;
      const cy = by + t[1] * g.U;
      ctx.fillStyle = '#26382a';
      blob(ctx, cx, cy, g.U * t[2], g.U * t[2] * 0.42);
      ctx.fillStyle = k % 2 ? '#3a5236' : '#456040';
      blob(ctx, cx - g.U * 0.6, cy - g.U * 0.5, g.U * t[2] * 0.7, g.U * t[2] * 0.26);
    });
    ctx.lineCap = 'butt';
  }

  // ---- narcissus -----------------------------------------------------------------

  function makeFlowers(g, rand) {
    const spec = [
      [0.07, 0.96, 22], [0.16, 1.0, 26], [0.27, 0.97, 21], [0.34, 0.98, 18],
      [0.04, 0.8, 14], [0.2, 0.84, 15], [0.31, 0.86, 13], [0.39, 0.9, 13],
      [0.1, 0.66, 9], [0.22, 0.7, 9], [0.33, 0.72, 8], [0.4, 0.78, 8],
      [0.06, 0.56, 6], [0.15, 0.58, 6], [0.25, 0.6, 5.5], [0.36, 0.62, 5.5],
    ];
    return spec.map((s) => ({
      x: g.W * s[0], y: g.H * s[1], h: g.U * s[2], r: g.U * s[2] * 0.2,
      ph: rand() * TAU, lean: 0.25 + rand() * 0.25,
    }));
  }

  function paintLeaves(ctx, g, flowers) {
    flowers.forEach((f, k) => {
      for (let b = 0; b < 5; b++) {
        const dir = (b - 2) * 0.28 + (k % 3 - 1) * 0.08;
        const len = f.h * (0.7 + (b % 3) * 0.15);
        const bx = f.x + (b - 2) * f.r * 0.15;
        ctx.fillStyle = b % 2 ? '#4f6a3f' : '#627c48';
        ctx.beginPath();
        ctx.moveTo(bx - f.r * 0.18, f.y);
        ctx.quadraticCurveTo(bx + dir * len * 0.5, f.y - len * 0.6, bx + dir * len * 0.9 + f.lean * f.r, f.y - len);
        ctx.quadraticCurveTo(bx + dir * len * 0.5 + f.r * 0.25, f.y - len * 0.55, bx + f.r * 0.18, f.y);
        ctx.fill();
      }
    });
  }

  function drawFlower(ctx, f, t, gust) {
    const sway = Math.sin(t * 1.1 + f.ph) * 0.1 + gust * 0.5;
    const hx = f.x + (sway + f.lean) * f.h * 0.28;
    const hy = f.y - f.h * 0.82;
    ctx.strokeStyle = '#6b8450';
    ctx.lineWidth = Math.max(1, f.r * 0.22);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + sway * f.h * 0.1, f.y - f.h * 0.5, hx, hy);
    ctx.stroke();
    ctx.fillStyle = PETAL;
    for (let p = 0; p < 6; p++) {
      const a = p * (TAU / 6) + 0.3 + sway;
      ctx.beginPath();
      ctx.ellipse(hx + Math.cos(a) * f.r * 0.7, hy + Math.sin(a) * f.r * 0.6, f.r * 0.62, f.r * 0.34, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = CUP;
    blob(ctx, hx, hy, f.r * 0.42, f.r * 0.38);
    ctx.fillStyle = '#c08a2e';
    blob(ctx, hx, hy + f.r * 0.05, f.r * 0.2, f.r * 0.16);
  }

  // ---- sea motion ------------------------------------------------------------------

  function makeStreaks(g, rand) {
    const s = { y: [], x: [], len: [], v: [], a: [] };
    for (let i = 0; i < STREAKS; i++) {
      const f = Math.pow(rand(), 1.4);
      s.y.push(g.hor + 1 + f * (g.H - g.hor - 2));
      s.x.push(rand() * g.W);
      s.len.push(g.U * (2 + f * 9) * (0.6 + rand() * 0.8));
      s.v.push(g.U * (0.5 + f * 1.6) * (0.7 + rand() * 0.6));
      s.a.push(0.14 + f * 0.3);
    }
    return s;
  }

  function drawStreaks(ctx, g, t, surf) {
    const s = state.streaks;
    ctx.fillStyle = '#dfe6e2';
    for (let i = 0; i < STREAKS; i++) {
      const x = ((s.x[i] - t * s.v[i] * (0.6 + surf * 0.4)) % (g.W + s.len[i]) + g.W + s.len[i]) % (g.W + s.len[i]) - s.len[i];
      const pulse = 0.65 + 0.35 * Math.sin(t * 0.9 + i * 1.7);
      ctx.globalAlpha = s.a[i] * pulse * (0.4 + surf * 0.6);
      ctx.fillRect(x, s.y[i], s.len[i], Math.max(1, g.U * 0.35 * (s.y[i] - g.hor) / (g.H - g.hor) + 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function makeFoam(g, rand) {
    const out = { x: [], y: [], ph: [], r: [] };
    for (let k = 0; k + 3 < FOAM_LINE.length; k += 2) {
      const ax = FOAM_LINE[k] * g.W, ay = FOAM_LINE[k + 1] * g.H;
      const bx = FOAM_LINE[k + 2] * g.W, by = FOAM_LINE[k + 3] * g.H;
      for (let i = 0; i < 5; i++) {
        const f = i / 5;
        out.x.push(ax + (bx - ax) * f + g.U * 0.8);
        out.y.push(ay + (by - ay) * f + g.U * 0.5);
        out.ph.push(rand() * TAU);
        out.r.push(g.U * (1.3 + rand() * 1.6));
      }
    }
    return out;
  }

  function drawFoam(ctx, g, t, surf) {
    const f = state.foam;
    ctx.fillStyle = '#eef0ea';
    for (let i = 0; i < f.x.length; i++) {
      const swell = 0.5 + 0.5 * Math.sin(t * 0.8 + f.ph[i]);
      const r = f.r[i] * (0.5 + swell * surf * 0.9);
      ctx.globalAlpha = 0.5 + 0.4 * swell;
      blob(ctx, f.x[i] + swell * g.U * 0.8, f.y[i] + g.U * 0.3, r * 1.5, r * 0.55);
    }
    ctx.globalAlpha = 1;
  }

  function makeSpray(g, rand) {
    const s = { x: [], y: [], vx: [], vy: [], life: [], base: [] };
    for (let i = 0; i < SPRAYS; i++) {
      s.x.push(0); s.y.push(0); s.vx.push(0); s.vy.push(0); s.base.push(i % (state.foam.x.length));
      s.life.push(rand() * 2.5);
    }
    return s;
  }

  function stepSpray(g, dt, count) {
    const s = state.spray;
    const f = state.foam;
    for (let i = 0; i < count; i++) {
      s.life[i] -= dt;
      if (s.life[i] > 0) {
        s.x[i] += s.vx[i] * dt;
        s.vy[i] += g.U * 14 * dt;
        s.y[i] += s.vy[i] * dt;
      } else {
        const b = (s.base[i] + Math.floor(state.rand() * 4)) % f.x.length;
        s.x[i] = f.x[b];
        s.y[i] = f.y[b];
        s.vx[i] = g.U * (1 + state.rand() * 5);
        s.vy[i] = -g.U * (6 + state.rand() * 8);
        s.life[i] = 1.2 + state.rand() * 1.4;
      }
    }
  }

  function drawSpray(ctx, g, count) {
    const s = state.spray;
    ctx.fillStyle = '#f2f2ea';
    for (let i = 0; i < count; i++) {
      if (s.life[i] <= 0) continue;
      ctx.globalAlpha = Math.min(0.85, s.life[i]);
      const r = Math.max(1, g.U * 0.5);
      ctx.fillRect(s.x[i], s.y[i], r, r);
    }
    ctx.globalAlpha = 1;
  }

  // ---- gulls ----------------------------------------------------------------------

  function drawGull(ctx, g, x, y, flap, s) {
    const wing = g.U * 5.5 * s;
    const up = flap * g.U * 2.6 * s;
    ctx.strokeStyle = '#f1eee4';
    ctx.lineWidth = Math.max(1.5, g.U * 0.9 * s);
    ctx.beginPath();
    ctx.moveTo(x - wing, y - up);
    ctx.lineTo(x - wing * 0.45, y - up * 0.3 - g.U * 0.3 * s);
    ctx.lineTo(x, y);
    ctx.lineTo(x + wing * 0.45, y - up * 0.3 - g.U * 0.3 * s);
    ctx.lineTo(x + wing, y - up);
    ctx.stroke();
    ctx.fillStyle = '#34363a';
    ctx.fillRect(x - wing - 0.5, y - up - 0.5, Math.max(1, g.U * 0.9 * s), Math.max(1, g.U * 0.7 * s));
    ctx.fillRect(x + wing - g.U * 0.9 * s, y - up - 0.5, Math.max(1, g.U * 0.9 * s), Math.max(1, g.U * 0.7 * s));
  }

  function drawGulls(ctx, g, t) {
    const span = g.W + g.U * 20;
    for (let i = 0; i < GULLS; i++) {
      const x = g.W + g.U * 10 - ((t * g.U * (3 + i * 0.7) + i * span * 0.37) % span);
      const y = g.H * (0.2 + i * 0.07) + Math.sin(t * 0.6 + i * 2) * g.U * 2;
      drawGull(ctx, g, x, y, Math.sin(t * (3.2 + i * 0.4) + i), 0.8 + i * 0.15);
    }
  }

  // ---- run ------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.sky = paintSky(g, rand);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.sea = paintSea(g);
    state.head = paintHead(g, rand);
    state.land = paintLand(g, rand);
    const lc = state.land.getContext('2d');
    paintTorii(lc, g);
    paintPine(lc, g, rand);
    state.flowers = makeFlowers(g, rand);
    paintLeaves(lc, g, state.flowers);
    state.streaks = makeStreaks(g, rand);
    state.foam = makeFoam(g, rand);
    state.spray = makeSpray(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { surf, spray, gulls } = api.props;
    const count = Math.min(SPRAYS, Math.round(SPRAYS * spray * 0.7));
    stepSpray(g, Math.min(dt, 0.1), count);
    ctx.drawImage(state.sky, 0, 0);
    const cw = state.clouds.width;
    const cx = -((t * g.U * 0.5) % cw);
    ctx.drawImage(state.clouds, cx, g.H * 0.04);
    ctx.drawImage(state.clouds, cx + cw, g.H * 0.04);
    ctx.drawImage(state.sea, 0, 0, g.W, g.H, 0, 0, g.W, g.H);
    drawStreaks(ctx, g, t, surf);
    if (gulls) drawGulls(ctx, g, t);
    ctx.drawImage(state.head, 0, 0);
    drawFoam(ctx, g, t, surf);
    drawSpray(ctx, g, count);
    ctx.drawImage(state.land, 0, 0);
    const gust = Math.sin(t * 0.5) * Math.sin(t * 0.23 + 1) * 0.6 + 0.2;
    for (let i = 0; i < state.flowers.length; i++) drawFlower(ctx, state.flowers[i], t, gust);
  }

  Kasuri.run({
    defaults: { surf: 1, spray: 1, gulls: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
