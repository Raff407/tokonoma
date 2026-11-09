/*
 * 芒 Susuki — a field of pampas grass on an autumn night, under a big full moon.
 *
 * Sky, moon, hills and three depth bands of grass are baked once. Each band is drawn
 * back as a coarse grid of tiles, higher tiles shifted further by a travelling wind
 * wave, so the whole field sways without touching single stems. A few tall plumes in front are
 * drawn by hand, and one tiling cloud strip slides across the moon.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep, lerp } = K;

  const TAU = Math.PI * 2;
  const STRIPS = 16;
  const ROWS = 7;
  const GROUND = '#141c22';
  const FRONT_INKS = ['#d6c9a0', '#ece0b8'];
  const FRONT_PLUMES = 9;
  const BANDS = [
    { base: 0.84, top: 0.6, count: 5, h: [12, 18], stem: '#344444', plume: ['#7c7a6e', '#8f8a76'], amp: 0.22, freq: 0.9 },
    { base: 0.98, top: 0.62, count: 8, h: [20, 30], stem: '#33403c', plume: ['#a69d80', '#bcb08c'], amp: 0.32, freq: 0.75 },
    { base: 1.08, top: 0.64, count: 13, h: [32, 46], stem: '#2e3a34', plume: ['#c8b994', '#dccda4'], amp: 0.42, freq: 0.6 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky, moon and hills -------------------------------------------------

  function paintMoon(ctx, m) {
    const halo = ctx.createRadialGradient(m.x, m.y, m.r * 0.9, m.x, m.y, m.r * 3.6);
    halo.addColorStop(0, 'rgba(214,204,170,0.45)');
    halo.addColorStop(0.4, 'rgba(140,146,160,0.16)');
    halo.addColorStop(1, 'rgba(60,72,110,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(m.x - m.r * 4, m.y - m.r * 4, m.r * 8, m.r * 8);
    const size = Math.ceil(m.r * 2) + 2;
    const img = ctx.getImageData(Math.round(m.x - size / 2), Math.round(m.y - size / 2), size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x - size / 2 + 0.5) / m.r;
        const ny = (y - size / 2 + 0.5) / m.r;
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;
        const sea = smoothstep(0.5, 0.62, fbm(nx * 2 + 3, ny * 2 + 7, 4, 19));
        const limb = 1 - 0.12 * r2;
        const i = (y * size + x) * 4;
        d[i] = lerp(242, 196, sea * 0.7) * limb;
        d[i + 1] = lerp(230, 188, sea * 0.7) * limb;
        d[i + 2] = lerp(196, 166, sea * 0.7) * limb;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, Math.round(m.x - size / 2), Math.round(m.y - size / 2));
  }

  function hill(ctx, g, y0, amp, scale, seed, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * y0 - fbm(x / (g.U * scale), seed, 4, seed) * g.H * amp);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.62);
    sky.addColorStop(0, '#0b1229');
    sky.addColorStop(0.6, '#1a2648');
    sky.addColorStop(1, '#34405e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#c9cfd8';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g.moon);
    hill(ctx, g, 0.6, 0.12, 50, 4, '#1c2640');
    hill(ctx, g, 0.66, 0.07, 30, 9, '#162030');
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, g.H * 0.64, g.W, g.H * 0.36);
    return c;
  }

  // ---- grass ---------------------------------------------------------------

  // One stem with a drooping plume of a few feathered strands at its tip.
  function stem(ctx, g, rand, x, base, h, band) {
    const lean = (rand() - 0.3) * h * 0.25;
    const tx = x + lean;
    const ty = base - h;
    ctx.strokeStyle = band.stem;
    ctx.lineWidth = Math.max(0.8, h * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, tx, ty);
    ctx.stroke();
    plume(ctx, tx, ty, h * 0.38, rand() < 0.85 ? 1 : -1, band.plume, 0);
    if (rand() < 0.6) {
      ctx.strokeStyle = band.stem;
      ctx.lineWidth = Math.max(0.6, h * 0.025);
      const side = rand() < 0.5 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, base - h * 0.1);
      ctx.quadraticCurveTo(x + side * h * 0.2, base - h * 0.45, x + side * h * 0.42, base - h * 0.3);
      ctx.stroke();
    }
  }

  // A nodding plume: a soft spine that rises from the tip and bows over, with a few
  // thinner strands peeling away from it near the end.
  function plume(ctx, x, y, len, dir, inks, sway) {
    ctx.lineCap = 'round';
    const ex = x + dir * len * 0.5 + sway;
    const ey = y - len * 0.82;
    const cx = x + dir * len * 0.04 + sway * 0.4;
    const cy = y - len * 0.62;
    ctx.strokeStyle = inks[0];
    ctx.lineWidth = Math.max(1, len * 0.13);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = inks[1];
    ctx.lineWidth = Math.max(0.7, len * 0.07);
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.moveTo(x, y - len * 0.2);
      ctx.quadraticCurveTo(cx + s * len * 0.08, cy, ex + dir * len * 0.12 - s * len * 0.04, ey + len * (0.06 + s * 0.14));
      ctx.stroke();
    }
  }

  function paintBand(g, rand, band) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = g.H * band.base;
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, base - g.U * 3, g.W, g.H - base + g.U * 3);
    const step = g.U * band.count;
    for (let x = -g.U * 4; x < g.W + g.U * 4; x += step * (0.5 + rand())) {
      const h = g.U * lerp(band.h[0], band.h[1], rand());
      stem(ctx, g, rand, x, base - g.U * 2 + rand() * g.U * 3, h, band);
    }
    return c;
  }

  // Lean the band by the wind in a coarse grid of tiles: higher tiles move further,
  // and the lean travels along the field. The root row stays put.
  function drawBand(ctx, g, img, band, t, wind) {
    const base = g.H * band.base;
    const y0 = Math.max(0, Math.floor(g.H * band.top - g.U * 22));
    const y1 = Math.min(g.H, Math.ceil(base + g.U * 2));
    const th = Math.ceil((y1 - y0) / ROWS);
    const sw = Math.ceil(g.W / STRIPS);
    for (let x = 0; x < g.W; x += sw) {
      const k = wind * band.amp * (0.55 * Math.sin(x * 0.035 - t * band.freq * 2.2) + 0.3 * Math.sin(x * 0.011 - t * 0.7) + 0.25);
      for (let y = y0; y < y1; y += th) {
        const dx = k * Math.max(0, base - y - th * 0.5);
        ctx.drawImage(img, x, y, sw, th, x + dx, y, sw, th);
      }
    }
  }

  function makeFront(g, rand) {
    const n = FRONT_PLUMES;
    const P = { x: new Float32Array(n), h: new Float32Array(n), p: new Float32Array(n), dir: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      P.x[i] = g.W * ((i + 0.2 + rand() * 0.6) / n);
      P.h[i] = g.U * (36 + rand() * 20);
      P.p[i] = rand() * TAU;
      P.dir[i] = 1;
    }
    return P;
  }

  function drawFront(ctx, g, t, wind) {
    const P = state.front;
    ctx.lineCap = 'round';
    for (let i = 0; i < FRONT_PLUMES; i++) {
      const x = P.x[i];
      const h = P.h[i];
      const sway = wind * h * (0.16 * Math.sin(x * 0.035 - t * 1.3 + P.p[i] * 0.3) + 0.08);
      const tx = x + sway;
      const ty = g.H - h + Math.abs(sway) * 0.2;
      ctx.strokeStyle = '#3a4640';
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, g.H + 2);
      ctx.quadraticCurveTo(x + sway * 0.15, g.H - h * 0.5, tx, ty);
      ctx.stroke();
      const len = h * 0.32;
      const flick = Math.sin(t * 2.1 + P.p[i]) * len * 0.06 * wind + sway * 0.3;
      plume(ctx, tx, ty, len, P.dir[i], FRONT_INKS, flick);
    }
  }

  // ---- clouds --------------------------------------------------------------

  function paintCloud(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 18), y / (g.U * 5), 4, 31);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 120;
        img.data[i + 1] = 128;
        img.data[i + 2] = 150;
        img.data[i + 3] = smoothstep(0.48, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawCloud(ctx, g, t, clouds) {
    if (clouds <= 0) return;
    const tile = state.cloud;
    const w = tile.width;
    const a = (t * g.U * 0.8) % w;
    ctx.globalAlpha = Math.min(1, clouds * 0.8);
    ctx.drawImage(tile, -a, g.moon.y - tile.height * 0.4);
    ctx.drawImage(tile, w - a, g.moon.y - tile.height * 0.4);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const g = { W, H, U, moon: { x: W * 0.7, y: H * 0.26, r: U * 17 } };
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.bands = BANDS.map((b) => paintBand(g, rand, b));
    state.front = makeFront(g, rand);
    state.cloud = paintCloud(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, clouds } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawCloud(ctx, g, t, clouds);
    for (let i = 0; i < BANDS.length; i++) drawBand(ctx, g, state.bands[i], BANDS[i], t, wind);
    drawFront(ctx, g, t, wind);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
