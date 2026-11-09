/*
 * 梅雨明け Tsuyuake — the end of the rainy season.
 *
 * Sky, cedar hills, the temple, the tiled village, the rice terraces and the hydrangeas are
 * baked once. Moving parts are two tiling cloud strips, a few soft sunbeams with a pool of
 * light where each lands, sliding glints on the paddy water and a handful of swallows.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const BEAMS = 3;
  const SWALLOWS = 5;
  const GLINTS = 46;
  const SKY = ['#8f9a9e', '#a9b0ae', '#c6c4b0', '#dccfa6', '#ead8a2'];
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
    const u = U * Math.min(1, W / (U * 130));
    return { W, H, U, u, far: H * 0.36, mid: H * 0.46, plain: H * 0.58, gap: W * 0.64 };
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = Math.ceil(g.plain);
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, Math.max(0, 1 - y / (g.H * 0.46))) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        // warmer near the gap in the clouds
        const near = Math.exp(-(((x - g.gap) / (g.W * 0.3)) ** 2));
        const ff = Math.min(inks.length - 1.001, f + near * 0.9 * (1 - y / h));
        const kk = Math.floor(ff);
        const ink = inks[Math.min(inks.length - 1, kk + (rand() < ff - kk ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
        void k;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- hills, cedars, temple, torii ------------------------------------------

  function ridge(g, base, amp, seed, scale, x) {
    return base + fbm(x / (g.U * scale), 2.3, 4, seed) * amp;
  }

  function cedar(ctx, x, y, h, ink) {
    const w = h * 0.16;
    ctx.fillStyle = ink[0];
    poly(ctx, [x, y - h, x - w, y, x + w, y]);
    ctx.fillStyle = ink[1];
    poly(ctx, [x, y - h * 0.97, x - w * 0.15, y - h * 0.1, x + w * 0.55, y]);
    ctx.fillStyle = '#3b2d22';
    ctx.fillRect(x - w * 0.08, y - 1, Math.max(1, w * 0.16), Math.max(1, h * 0.06));
  }

  function hillLayer(ctx, g, rand, base, amp, seed, fill, trees, ink, tall, step) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.plain + g.U);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, base, amp, seed, 36, x));
    ctx.lineTo(g.W, g.plain + g.U);
    ctx.fill();
    if (!trees) return;
    for (let x = 0; x < g.W; x += g.U * (step + rand() * step)) {
      const y = ridge(g, base, amp, seed, 36, x) + g.U * (0.6 + rand() * 3.5);
      cedar(ctx, x, y + g.U * 2, g.U * tall * (0.7 + rand() * 0.6), ink);
    }
  }

  function pagoda(ctx, g, x, y, s) {
    const roof = '#3a3f4b';
    const wall = '#d8cdb0';
    ctx.fillStyle = '#c8452b';
    ctx.fillRect(x - s * 0.9, y - s * 1.1, s * 1.8, s * 1.1);
    for (let i = 0; i < 3; i++) {
      const w = s * (3.1 - i * 0.6);
      const ry = y - s * (1.1 + i * 2.1);
      ctx.fillStyle = wall;
      ctx.fillRect(x - w * 0.3, ry - s * 1.4, w * 0.6, s * 1.4);
      ctx.fillStyle = roof;
      poly(ctx, [x - w, ry + s * 0.2, x - w * 0.55, ry - s * 0.5, x + w * 0.55, ry - s * 0.5, x + w, ry + s * 0.2, x + w * 0.5, ry]);
      ctx.fillStyle = '#272b34';
      ctx.fillRect(x - w, ry + s * 0.1, w * 2, Math.max(1, s * 0.16));
    }
    const top = y - s * 7.4;
    ctx.fillStyle = '#9a8040';
    ctx.fillRect(x - Math.max(0.5, s * 0.08), top - s * 2.2, Math.max(1, s * 0.16), s * 2.4);
    ctx.fillStyle = '#e6c259';
    ctx.fillRect(x - s * 0.35, top - s * 1.5, s * 0.7, Math.max(1, s * 0.14));
    ctx.fillRect(x - s * 0.25, top - s * 1.0, s * 0.5, Math.max(1, s * 0.14));
  }

  function torii(ctx, x, y, s) {
    ctx.fillStyle = '#c8452b';
    ctx.fillRect(x - s * 1.4, y - s * 3.4, Math.max(1, s * 0.34), s * 3.4);
    ctx.fillRect(x + s * 1.06, y - s * 3.4, Math.max(1, s * 0.34), s * 3.4);
    ctx.fillRect(x - s * 1.1, y - s * 2.6, s * 2.2, Math.max(1, s * 0.26));
    poly(ctx, [x - s * 1.8, y - s * 3.3, x - s * 1.4, y - s * 3.7, x + s * 1.4, y - s * 3.7, x + s * 1.8, y - s * 3.3]);
    ctx.fillStyle = '#272b34';
    ctx.fillRect(x - s * 1.7, y - s * 3.62, s * 3.4, Math.max(1, s * 0.16));
  }

  function paintHills(ctx, g, rand) {
    // far, mist-blue ridges
    hillLayer(ctx, g, rand, g.far, g.H * 0.09, 11, '#8b9a96', false, null, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#c9cdbd';
    ctx.fillRect(0, g.far, g.W, g.H * 0.05);
    ctx.globalAlpha = 1;
    hillLayer(ctx, g, rand, g.far + g.H * 0.04, g.H * 0.09, 17, '#6f8776', true, ['#5a7466', '#4b6458'], 4, 2.2);
    // nearer green hill with the temple
    hillLayer(ctx, g, rand, g.mid, g.H * 0.07, 29, '#6a8a4c', true, ['#3f6342', '#55794a'], 9, 3.2);
    pagoda(ctx, g, g.W * 0.17, g.mid + g.H * 0.012, g.u * 1.15);
    torii(ctx, g.W * 0.9, g.mid + g.H * 0.05, g.u * 1.4);
  }

  // ---- the village -----------------------------------------------------------

  function house(ctx, g, x, y, w, h, tone) {
    const u = g.U;
    ctx.fillStyle = '#d9cfb2';
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#7d6a52';
    ctx.fillRect(x, y - h * 0.5, w, h * 0.5);
    ctx.fillStyle = '#4a3a2c';
    for (let i = 0; i <= 3; i++) ctx.fillRect(x + (w * i) / 3 - 0.5, y - h, Math.max(1, u * 0.2), h);
    // tiled gable roof, eaves wider than the walls
    const e = w * 0.16;
    ctx.fillStyle = tone;
    poly(ctx, [x - e, y - h + u * 0.4, x + w * 0.2, y - h - u * 3.4, x + w * 0.8, y - h - u * 3.4, x + w + e, y - h + u * 0.4]);
    ctx.fillStyle = '#20252e';
    ctx.fillRect(x - e, y - h + u * 0.2, w + e * 2, Math.max(1, u * 0.45));
    ctx.fillStyle = '#5b6270';
    ctx.fillRect(x + w * 0.2, y - h - u * 3.5, w * 0.6, Math.max(1, u * 0.35));
  }

  function paintVillage(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#5a7a46';
    ctx.fillRect(0, g.plain - u * 1.2, g.W, u * 3);
    let x = g.W * 0.2;
    const x1 = g.W * 0.84;
    while (x < x1) {
      const w = u * (4 + rand() * 4);
      const tone = rand() < 0.5 ? '#3b4250' : '#2f3542';
      if (rand() < 0.3) {
        // a dark pine behind the roofs
        ctx.fillStyle = '#2d4a33';
        blob(ctx, x + w * 0.5, g.plain - u * 6, u * 2.8, u * 2);
      }
      house(ctx, g, x, g.plain, w, u * (2.6 + rand() * 1.2), tone);
      x += w + u * (0.8 + rand() * 2.2);
    }
    // fire watch tower and utility poles
    ctx.fillStyle = '#3c342c';
    const px = [g.W * 0.31, g.W * 0.52, g.W * 0.76];
    for (let i = 0; i < px.length; i++) {
      ctx.fillRect(px[i], g.plain - u * 10, Math.max(1, u * 0.35), u * 10);
      ctx.fillRect(px[i] - u * 1.3, g.plain - u * 9, u * 2.6, Math.max(1, u * 0.28));
    }
    ctx.strokeStyle = '#3c342c';
    ctx.lineWidth = Math.max(1, u * 0.14);
    ctx.beginPath();
    for (let i = 0; i + 1 < px.length; i++) {
      ctx.moveTo(px[i], g.plain - u * 9);
      ctx.quadraticCurveTo((px[i] + px[i + 1]) / 2, g.plain - u * 7.4, px[i + 1], g.plain - u * 9);
    }
    ctx.stroke();
  }

  // ---- rice terraces ---------------------------------------------------------

  function paddyRows(g) {
    const rows = [];
    let y = g.plain + g.U * 0.6;
    let k = 0;
    while (y < g.H + g.U * 6) {
      const f = (y - g.plain) / (g.H - g.plain);
      const h = g.U * (1.3 + f * f * 9);
      rows.push({ y, h, f, water: k % 3 === 1 });
      y += h;
      k++;
    }
    return rows;
  }

  function paintPaddies(g, rand, rows) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4c6a3b';
    ctx.fillRect(0, g.plain, g.W, g.H - g.plain);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const u = g.U * (0.6 + row.f * 2);
      const wob = (x) => Math.sin(x / (g.U * (14 + r * 3)) + r * 1.7) * g.U * (0.3 + row.f * 1.6);
      // bund of earth along the top edge
      ctx.fillStyle = row.f < 0.5 ? '#76805a' : '#7a7a56';
      ctx.beginPath();
      ctx.moveTo(0, row.y + row.h + 2);
      for (let x = 0; x <= g.W + 6; x += 6) ctx.lineTo(x, row.y + wob(x));
      ctx.lineTo(g.W + 6, row.y + row.h + 2);
      ctx.fill();
      // field below the bund
      const top = row.y + Math.max(1, g.U * (0.35 + row.f * 0.7));
      ctx.fillStyle = row.water ? '#a9b8b2' : r % 2 ? '#5f7f45' : '#547640';
      ctx.beginPath();
      ctx.moveTo(0, row.y + row.h + 2);
      for (let x = 0; x <= g.W + 6; x += 6) ctx.lineTo(x, top + wob(x));
      ctx.lineTo(g.W + 6, row.y + row.h + 2);
      ctx.fill();
      if (row.water) {
        ctx.fillStyle = '#c4cbbd';
        for (let x = rand() * g.U * 6; x < g.W; x += g.U * (6 + rand() * 12)) {
          ctx.fillRect(x, top + wob(x) + row.h * 0.3, g.U * (3 + rand() * 6), Math.max(1, u * 0.18));
        }
      }
      // seedling tufts in lines
      const lines = Math.max(1, Math.round(row.h / (g.U * 1.5)));
      for (let l = 0; l < lines; l++) {
        const ly = top + wob(0) + ((row.y + row.h - top) * (l + 0.8)) / (lines + 0.3);
        const step = u * (row.water ? 1.9 : 1.1);
        for (let x = rand() * step; x < g.W; x += step) {
          const yy = ly + wob(x) - wob(0);
          ctx.fillStyle = rand() < 0.5 ? '#86a458' : '#9ab566';
          ctx.fillRect(x, yy - u * 0.5, Math.max(1, u * 0.28), Math.max(1, u * 0.8));
          ctx.fillStyle = '#3f5e34';
          ctx.fillRect(x, yy + u * 0.2, Math.max(1, u * 0.28), Math.max(1, u * 0.3));
        }
      }
    }
    return c;
  }

  // ---- hydrangeas (foreground corners) -----------------------------------------

  function hydrangea(ctx, g, rand, x, y, r) {
    ctx.fillStyle = '#34502f';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + rand() * Math.PI;
      blob(ctx, x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 0.5, r * 0.8, r * 0.5);
    }
    const tones = ['#4f63a0', '#6a7bb4', '#8d9bc6', '#c1c6d9'];
    for (let n = 0; n < 4; n++) {
      const bx = x + (n - 1.5) * r * 1.25 + (rand() - 0.5) * r * 0.4;
      const by = y - r * (0.9 + rand() * 0.9);
      const br = r * (0.65 + rand() * 0.3);
      ctx.fillStyle = tones[0];
      blob(ctx, bx, by, br, br * 0.9);
      for (let i = 0; i < 16; i++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand()) * br * 0.85;
        ctx.fillStyle = tones[1 + Math.floor(rand() * 3)];
        blob(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.9, br * 0.2, br * 0.2);
      }
    }
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // dark bank grass along the bottom
    ctx.fillStyle = '#2f4a2c';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 4; x += 4) ctx.lineTo(x, g.H - g.U * (2.5 + fbm(x / (g.U * 8), 3.1, 3, 61) * 4));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    hydrangea(ctx, g, rand, g.W * 0.1, g.H - g.U * 2, g.U * 5);
    hydrangea(ctx, g, rand, g.W * 0.9, g.H - g.U * 1.5, g.U * 4.2);
    return c;
  }

  // ---- clouds and beams --------------------------------------------------------

  function paintClouds(g, rand, tone, dens, yTop, spanH, seed) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(spanH);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    const n = Math.round(dens);
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const y = h * (0.15 + rand() * 0.7);
      const rx = g.U * (10 + rand() * 20);
      const ry = g.U * (1.8 + rand() * 2.8);
      // keep a break in the cloud above the sun gap
      const gx = (x % (w / 1.4)) - g.gap;
      if (Math.abs(gx) < g.W * 0.12 && y < h * 0.6) continue;
      for (const o of [-w, 0, w]) {
        blob(ctx, x + o, y, rx, ry);
        blob(ctx, x + o + rx * 0.3, y - ry * 0.6, rx * 0.6, ry * 0.7);
      }
    }
    void yTop;
    void seed;
    return c;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const layers = state.clouds;
    const ys = [g.H * 0.0, g.H * 0.12, g.H * 0.22];
    const sp = [0.5, 0.9, 1.4];
    const al = [0.9, 0.8, 0.55];
    for (let i = 0; i < layers.length; i++) {
      const c = layers[i];
      const w = c.width;
      const x = (t * g.U * sp[i]) % w;
      ctx.globalAlpha = Math.min(1, al[i] * amount);
      ctx.drawImage(c, -x, ys[i]);
      ctx.drawImage(c, w - x, ys[i]);
    }
    ctx.globalAlpha = 1;
  }

  function beamX(g, i, t) {
    return g.gap + (i - 1) * g.W * 0.12 + Math.sin(t * 0.07 + i * 2.1) * g.W * 0.06;
  }

  function drawBeams(ctx, g, t, amount) {
    if (amount <= 0) return;
    for (let i = 0; i < BEAMS; i++) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.11 + i * 1.9);
      const a = Math.min(1, amount) * (0.12 + 0.1 * pulse);
      const x0 = beamX(g, i, t);
      const top = g.H * 0.05;
      const spread = g.W * (0.05 + i * 0.012);
      const footY = g.H * (0.7 + 0.08 * i);
      const foot = x0 + g.W * (0.1 + 0.04 * i) + Math.sin(t * 0.09 + i) * g.W * 0.05;
      ctx.fillStyle = '#f2dc9c';
      ctx.globalAlpha = a;
      poly(ctx, [x0 - spread * 0.2, top, x0 + spread * 0.2, top, foot + spread, footY, foot - spread, footY]);
      ctx.globalAlpha = a * 0.7;
      poly(ctx, [x0 - spread * 0.05, top, x0 + spread * 0.05, top, foot + spread * 0.45, footY, foot - spread * 0.45, footY]);
      // the pool of light where the beam lands
      ctx.fillStyle = '#f4e3a4';
      ctx.globalAlpha = Math.min(1, amount) * (0.14 + 0.1 * pulse);
      blob(ctx, foot, footY, spread * 1.5, g.U * (2 + i * 0.8));
    }
    ctx.globalAlpha = 1;
  }

  // ---- water glints ------------------------------------------------------------

  function makeGlints(g, rand, rows) {
    const s = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), l: new Float32Array(GLINTS), p: new Float32Array(GLINTS) };
    const wet = rows.filter((r) => r.water);
    for (let i = 0; i < GLINTS; i++) {
      const row = wet[Math.floor(rand() * wet.length)] || rows[0];
      s.x[i] = rand() * g.W;
      s.y[i] = row.y + row.h * (0.45 + rand() * 0.4);
      s.l[i] = g.U * (1.5 + row.f * 6) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawGlints(ctx, g, t, amount) {
    const s = state.glints;
    ctx.fillStyle = '#f5ecc4';
    const thick = Math.max(1, g.U * 0.35);
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.6 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (0.3 + Math.min(1, amount) * 0.4);
      const x = ((s.x[i] + t * g.U * 0.5) % (g.W + s.l[i])) - s.l[i];
      ctx.fillRect(x, s.y[i], s.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- swallows ----------------------------------------------------------------

  function makeSwallows(g, rand) {
    const s = { x: new Float32Array(SWALLOWS), y: new Float32Array(SWALLOWS), v: new Float32Array(SWALLOWS), p: new Float32Array(SWALLOWS) };
    for (let i = 0; i < SWALLOWS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = g.H * (0.2 + rand() * 0.35);
      s.v[i] = g.U * (6 + rand() * 5);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawSwallows(ctx, g, t, dt) {
    const s = state.swallows;
    ctx.strokeStyle = '#1f232c';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.lineCap = 'round';
    for (let i = 0; i < SWALLOWS; i++) {
      s.x[i] += s.v[i] * dt;
      if (s.x[i] > g.W + g.U * 4) {
        s.x[i] = -g.U * 4;
        s.y[i] = g.H * (0.2 + state.rand() * 0.35);
      }
      const y = s.y[i] + Math.sin(t * 0.9 + s.p[i]) * g.U * 3.5;
      const flap = Math.sin(t * 7 + s.p[i]) * g.U * 0.7;
      const x = s.x[i];
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.6, y - g.U * 0.4 + flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.6, y - g.U * 0.4 + flap);
      ctx.moveTo(x, y);
      ctx.lineTo(x - g.U * 1.1, y + g.U * 0.5);
      ctx.stroke();
    }
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintHills(bctx, g, rand);
    paintVillage(bctx, g, rand);
    state.back = back;
    const rows = paddyRows(g);
    state.paddies = paintPaddies(g, rand, rows);
    state.front = paintForeground(g, rand);
    state.glints = makeGlints(g, rand, rows);
    state.swallows = makeSwallows(g, rand);
    state.clouds = [
      paintClouds(g, rand, '#7f898f', 26, 0, g.H * 0.3, 1),
      paintClouds(g, rand, '#a2a9a8', 22, 0, g.H * 0.3, 2),
      paintClouds(g, rand, '#c9c8b8', 18, 0, g.H * 0.3, 3),
    ];
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { beams, clouds, swallows } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, clouds);
    ctx.drawImage(state.paddies, 0, g.plain - g.U * 2, g.W, g.H - g.plain + g.U * 2, 0, g.plain - g.U * 2, g.W, g.H - g.plain + g.U * 2);
    drawGlints(ctx, g, t, beams);
    drawBeams(ctx, g, t, beams);
    if (swallows) drawSwallows(ctx, g, t, Math.min(dt, 0.1));
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { beams: 1, clouds: 1, swallows: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
