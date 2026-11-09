/*
 * 露草 Tsuyukusa — blue dayflowers wet with dew in tall grass at dawn.
 *
 * Sky, hills, paddies and the thatched farmhouse are baked once, as are the
 * flowers and the grass around them. Alive: one tiling mist strip, a few
 * leaning blades, a droplet that runs down a leaf and slow dew glints.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#9aa6b4', '#b4b8bb', '#d0c9bb', '#e6d9bc', '#eadcb8'];
  const BLUE = ['#3a5a9a', '#4a6fb0', '#6b8cc4'];
  const GRASS = ['#3a4a2c', '#4f6238', '#6f8148', '#8c9a5c'];
  const DEW = '#e8eadc';
  const BLADES = 16;
  const GLINTS = 14;
  const DROP_TIME = 9;
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
    return { W, H, U, hz: Math.round(H * 0.5) };
  }

  // ---- distance ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.hz) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#efe0bd';
    blob(ctx, g.W * 0.7, g.hz - g.U * 8, g.U * 12, g.U * 12);
    ctx.fillStyle = '#e4cfa6';
    blob(ctx, g.W * 0.7, g.hz - g.U * 8, g.U * 7, g.U * 7);
  }

  function ridge(g, x, base, amp, scale, seed) {
    return base + fbm(x / (g.U * scale), seed, 4, seed * 7) * amp;
  }

  function paintHills(ctx, g) {
    const bands = [
      ['#8e9cae', 0.26, 14, 50, 3, 0.34],
      ['#71849b', 0.33, 12, 36, 6, 0.42],
      ['#58697f', 0.4, 10, 28, 9, 0.5],
    ];
    for (const b of bands) {
      ctx.fillStyle = b[0];
      ctx.beginPath();
      ctx.moveTo(0, g.hz);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, g.H * b[1], g.U * b[2] * 0.5, b[3], b[4]));
      ctx.lineTo(g.W, g.hz);
      ctx.fill();
    }
  }

  // Kayabuki farmhouse: a steep thatched roof with a ridge cap, seen low and small.
  function farmhouse(ctx, g, x, y, s) {
    ctx.fillStyle = '#e0d6bd';
    ctx.fillRect(x - s * 7, y - s * 3, s * 14, s * 3);
    ctx.fillStyle = '#4c3b2c';
    ctx.fillRect(x - s * 7, y - s * 3, s * 14, s * 0.4);
    ctx.fillStyle = '#6b5a3e';
    poly(ctx, [x - s * 10, y - s * 2.6, x - s * 3, y - s * 11, x + s * 3, y - s * 11, x + s * 10, y - s * 2.6]);
    ctx.fillStyle = '#8a7650';
    poly(ctx, [x - s * 9, y - s * 3.4, x - s * 3, y - s * 10.2, x - s * 1, y - s * 10.2, x - s * 4.5, y - s * 3.4]);
    ctx.fillStyle = '#3d3226';
    ctx.fillRect(x - s * 3.2, y - s * 11.4, s * 6.4, s * 0.9);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x - s * 1.6, y - s * 2.6, s * 3.2, s * 2.6);
    ctx.fillStyle = '#a89a78';
    ctx.fillRect(x + s * 3.5, y - s * 2.4, s * 2.4, s * 1.4);
  }

  function pineSmall(ctx, x, y, h, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(x - h * 0.03, y - h * 0.6, h * 0.06, h * 0.6);
    for (let i = 0; i < 3; i++) {
      blob(ctx, x + (i % 2 ? 0.1 : -0.1) * h, y - h * (0.55 + i * 0.17), h * (0.26 - i * 0.05), h * 0.07);
    }
  }

  function paintField(ctx, g, rand) {
    const y0 = g.hz - g.U * 1.5;
    ctx.fillStyle = '#7d8a64';
    ctx.fillRect(0, y0, g.W, g.H - y0);
    const rows = ['#8b966c', '#76865c', '#9aa376', '#6c7d54'];
    for (let y = y0, i = 0; y < g.H; i++) {
      const hh = g.U * (0.8 + (y - y0) / g.H * 4);
      ctx.fillStyle = rows[i % rows.length];
      ctx.fillRect(0, y, g.W, hh * 0.7);
      y += hh;
    }
    const hx = g.W * 0.27;
    farmhouse(ctx, g, hx, y0 + g.U * 1.6, g.U * 0.8);
    pineSmall(ctx, hx + g.U * 11, y0 + g.U * 1.5, g.U * 12, '#3c4b3a');
    pineSmall(ctx, hx - g.U * 12, y0 + g.U * 1.6, g.U * 9, '#44533f');
    for (let x = 0; x < g.W; x += g.U * (3 + rand() * 4)) {
      ctx.fillStyle = '#586a4c';
      blob(ctx, x, y0 + g.U * 0.5, g.U * (1.2 + rand()), g.U * 0.7);
    }
  }

  // ---- grass and flowers -----------------------------------------------------

  function blade(ctx, x, y, h, lean, w, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.5 + lean * 0.3, y - h * 0.55, x + lean, y - h);
    ctx.quadraticCurveTo(x + w * 0.5 + lean * 0.3, y - h * 0.55, x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  function paintGrassBand(ctx, g, rand, count, yMin, yMax, hMin, hMax, inks) {
    for (let i = 0; i < count; i++) {
      const y = yMin + rand() * (yMax - yMin);
      const x = rand() * g.W;
      const h = g.U * (hMin + rand() * (hMax - hMin));
      blade(ctx, x, y, h, (rand() - 0.5) * h * 0.5, g.U * (0.5 + rand() * 0.5), inks[Math.floor(rand() * inks.length)]);
    }
  }

  // A dayflower: two big rounded blue petals like ears, one small pale petal below,
  // gold stamens in the middle and a green boat-shaped bract behind.
  function dayflower(ctx, x, y, s, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = GRASS[1];
    blob(ctx, 0, s * 0.35, s * 0.55, s * 0.9, 0.0);
    ctx.fillStyle = GRASS[2];
    blob(ctx, -s * 0.1, s * 0.2, s * 0.3, s * 0.6, 0.1);
    ctx.fillStyle = BLUE[0];
    blob(ctx, -s * 0.78, -s * 0.4, s * 0.85, s * 0.78, -0.4);
    blob(ctx, s * 0.78, -s * 0.4, s * 0.85, s * 0.78, 0.4);
    ctx.fillStyle = BLUE[1];
    blob(ctx, -s * 0.8, -s * 0.5, s * 0.7, s * 0.62, -0.4);
    blob(ctx, s * 0.8, -s * 0.5, s * 0.7, s * 0.62, 0.4);
    ctx.fillStyle = BLUE[2];
    blob(ctx, -s * 0.95, -s * 0.68, s * 0.34, s * 0.28, -0.4);
    blob(ctx, s * 0.62, -s * 0.66, s * 0.3, s * 0.24, 0.4);
    ctx.fillStyle = '#d7dbd0';
    blob(ctx, 0, s * 0.18, s * 0.26, s * 0.2, 0);
    ctx.fillStyle = '#d2a844';
    blob(ctx, 0, -s * 0.12, s * 0.15, s * 0.15, 0);
    blob(ctx, -s * 0.28, -s * 0.05, s * 0.1, s * 0.07, 0);
    blob(ctx, s * 0.28, -s * 0.05, s * 0.1, s * 0.07, 0);
    ctx.restore();
  }

  function dewBead(ctx, x, y, r) {
    ctx.fillStyle = '#586a4c';
    blob(ctx, x + r * 0.15, y + r * 0.2, r, r);
    ctx.fillStyle = DEW;
    blob(ctx, x - r * 0.1, y - r * 0.15, r * 0.65, r * 0.65);
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGrassBand(ctx, g, rand, 120, g.hz + g.U * 9, g.hz + g.U * 22, 5, 11, [GRASS[3], GRASS[2], '#7f9054']);
    for (let i = 0; i < 6; i++) {
      dayflower(ctx, g.W * (0.08 + rand() * 0.84), g.hz + g.U * (18 + rand() * 6), g.U * (2.2 + rand() * 0.8), (rand() - 0.5) * 0.4);
    }
    paintGrassBand(ctx, g, rand, 90, g.hz + g.U * 20, g.hz + g.U * 34, 8, 16, [GRASS[2], GRASS[1], '#68793f']);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.flowers = [];
    const spots = [[0.12, 0.8, 6.5], [0.3, 0.7, 5.2], [0.52, 0.86, 7.4], [0.68, 0.68, 5.4], [0.86, 0.78, 6.8]];
    paintGrassBand(ctx, g, rand, 45, g.H * 0.8, g.H * 1.02, 16, 30, [GRASS[1], GRASS[0], GRASS[2]]);
    for (const sp of spots) {
      const x = g.W * sp[0] + g.U * (rand() - 0.5) * 4;
      const y = g.H * sp[1];
      const s = g.U * sp[2];
      ctx.strokeStyle = GRASS[1];
      ctx.lineWidth = Math.max(1, s * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, g.H + 2);
      ctx.quadraticCurveTo(x + s * 0.4, y + s * 4, x, y + s * 0.8);
      ctx.stroke();
      blade(ctx, x + s * 0.3, y + s * 2.5, s * 3, s * 1.3, s * 0.22, GRASS[0]);
      dayflower(ctx, x, y, s, (rand() - 0.5) * 0.3);
      dewBead(ctx, x - s * 0.95, y - s * 0.45, s * 0.2);
      dewBead(ctx, x + s * 0.7, y - s * 0.7, s * 0.16);
      state.flowers.push({ x, y, s });
    }
    paintGrassBand(ctx, g, rand, 30, g.H * 0.95, g.H * 1.04, 12, 24, [GRASS[0], '#2e3d24', GRASS[1]]);
    // a broad leaf that carries the droplet
    const big = leafPath(g);
    ctx.fillStyle = GRASS[1];
    ctx.beginPath();
    ctx.moveTo(big.x0, big.y0);
    ctx.quadraticCurveTo(big.cx - g.U * 1.6, big.cy, big.x1, big.y1);
    ctx.quadraticCurveTo(big.cx + g.U * 1.6, big.cy, big.x0, big.y0);
    ctx.fill();
    ctx.strokeStyle = GRASS[3];
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    ctx.beginPath();
    ctx.moveTo(big.x0, big.y0);
    ctx.quadraticCurveTo(big.cx, big.cy, big.x1, big.y1);
    ctx.stroke();
    return c;
  }

  function leafPath(g) {
    const x0 = g.W * 0.4;
    const y0 = g.H * 0.58;
    return { x0, y0, x1: x0 + g.U * 5, y1: g.H * 0.92, cx: x0 - g.U * 6, cy: g.H * 0.74 };
  }

  function bezier(p, f) {
    const a = (1 - f) * (1 - f);
    const b = 2 * (1 - f) * f;
    const c = f * f;
    return [a * p.x0 + b * p.cx + c * p.x1, a * p.y0 + b * p.cy + c * p.y1];
  }

  function paintMist(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.U * 22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const edge = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = x / w * TAU;
        const n = fbm(Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 + y / (g.U * 5), 4, 77);
        const v = Math.max(0, n - 0.35) * 2.2 * edge;
        const i = (y * w + x) * 4;
        d[i] = 238; d[i + 1] = 236; d[i + 2] = 226; d[i + 3] = Math.min(255, v * 170);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- motion ----------------------------------------------------------------

  function makeBlades(g, rand) {
    const out = [];
    for (let i = 0; i < BLADES; i++) {
      out.push({
        x: g.W * (i + rand() * 0.8) / BLADES,
        h: g.U * (22 + rand() * 14),
        w: g.U * (0.5 + rand() * 0.4),
        ph: rand() * TAU,
        ink: i % 3,
      });
    }
    return out;
  }

  function drawBlades(ctx, g, t, breeze) {
    const base = g.H + 2;
    for (let i = 0; i < BLADES; i++) {
      const b = state.blades[i];
      const lean = Math.sin(t * 0.55 + b.ph + b.x / (g.U * 20)) * g.U * 3 * breeze + g.U * breeze;
      ctx.fillStyle = GRASS[b.ink];
      blade(ctx, b.x, base, b.h, lean, b.w, GRASS[b.ink]);
    }
  }

  function drawMist(ctx, g, t, mist) {
    const m = state.mist;
    const y = g.hz - g.U * 10;
    ctx.globalAlpha = Math.min(1, 0.55 * mist);
    const off = (t * g.U * 0.8) % m.width;
    ctx.drawImage(m, -off, y);
    ctx.drawImage(m, m.width - off, y);
    ctx.globalAlpha = Math.min(1, 0.45 * mist);
    const off2 = (t * g.U * 1.3 + m.width * 0.5) % m.width;
    ctx.drawImage(m, -off2, g.hz + g.U * 4);
    ctx.drawImage(m, m.width - off2, g.hz + g.U * 4);
    ctx.globalAlpha = 1;
  }

  function drawDrop(ctx, g, t) {
    const p = state.path;
    const cycle = (t % DROP_TIME) / DROP_TIME;
    const hold = 0.35;
    let f = cycle < hold ? 0 : (cycle - hold) / (1 - hold);
    f = f * f * (3 - 2 * f);
    const grow = cycle < hold ? 0.55 + 0.45 * (cycle / hold) : 1;
    const q = bezier(p, Math.min(0.96, f));
    const r = g.U * 0.9 * grow;
    ctx.fillStyle = '#4b5d3e';
    ctx.beginPath();
    ctx.ellipse(q[0] + r * 0.15, q[1] + r * 0.25, r, r * (1 + f * 0.5), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = DEW;
    ctx.beginPath();
    ctx.ellipse(q[0] - r * 0.1, q[1] - r * 0.1, r * 0.65, r * 0.7 * (1 + f * 0.4), 0, 0, TAU);
    ctx.fill();
    if (f > 0) {
      ctx.globalAlpha = 0.4 * (1 - f);
      ctx.fillRect(q[0] - r * 0.15, p.y0 + (q[1] - p.y0) * 0.3, r * 0.3, (q[1] - p.y0) * 0.6);
      ctx.globalAlpha = 1;
    }
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#f2f0e2';
    for (let i = 0; i < GLINTS; i++) {
      const s = state.glints[i];
      const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = 0.15 + 0.45 * a;
      ctx.fillRect(s.x, s.y, g.U * 0.5, g.U * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintHills(bctx, g);
    paintField(bctx, g, rand);
    state.back = back;
    state.mid = paintMid(g, rand);
    state.front = paintFront(g, rand);
    state.mist = paintMist(g);
    state.blades = makeBlades(g, rand);
    state.path = leafPath(g);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      state.glints.push({
        x: g.W * (0.04 + rand() * 0.92),
        y: g.H * (0.6 + rand() * 0.35),
        sp: 0.4 + rand() * 0.6,
        ph: rand() * TAU,
      });
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, breeze, dew } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.mid, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawBlades(ctx, g, t, breeze);
    if (dew) {
      drawDrop(ctx, g, t);
      drawGlints(ctx, g, t);
    }
  }

  Kasuri.run({
    defaults: { mist: 1, breeze: 1, dew: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
