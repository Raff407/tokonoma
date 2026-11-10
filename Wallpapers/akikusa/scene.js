/*
 * 秋草 Akikusa — autumn grasses under a big moon.
 *
 * Sky, moon, hills and pagoda are baked once. Three grass layers (pampas plumes, arching
 * bush clover) are baked once each and drawn back in thin horizontal slices that lean
 * sideways more toward the tips. Cloud is one tiling strip that drifts slowly.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#171d33', '#1f2845', '#2c3a5c', '#44527a'];
  const SLICE = 3;
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
    return { W, H, U, moonX: W * 0.66, moonY: H * 0.3, moonR: H * 0.17 };
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.75)) * (inks.length - 1);
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
    ctx.fillStyle = '#9aa4b8';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H * 0.5;
      if (Math.hypot(x - g.moonX, y - g.moonY) < g.moonR * 2) continue;
      ctx.globalAlpha = 0.3 + rand() * 0.4;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g);
    return c;
  }

  function paintMoon(ctx, g) {
    const { moonX: x, moonY: y, moonR: r } = g;
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = '#e8dcb8';
      ctx.globalAlpha = 0.045;
      blob(ctx, x, y, r * (1 + i * 0.28), r * (1 + i * 0.28));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#efe4c0';
    blob(ctx, x, y, r, r);
    ctx.fillStyle = '#d9cb9f';
    ctx.globalAlpha = 0.55;
    blob(ctx, x - r * 0.3, y - r * 0.2, r * 0.3, r * 0.24);
    blob(ctx, x + r * 0.25, y + r * 0.1, r * 0.34, r * 0.28);
    blob(ctx, x - r * 0.05, y + r * 0.5, r * 0.22, r * 0.16);
    blob(ctx, x + r * 0.1, y - r * 0.55, r * 0.18, r * 0.12);
    ctx.globalAlpha = 1;
  }

  function ridge(g, x, base, amp, seed, scale) {
    return base + fbm(x / (g.U * scale), seed, 4, seed * 7) * amp;
  }

  function paintHills(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const bands = [
      { base: 0.52, amp: 0.14, seed: 2.2, scale: 38, ink: '#3a4668' },
      { base: 0.58, amp: 0.1, seed: 5.1, scale: 30, ink: '#2a3454' },
    ];
    bands.forEach((b, n) => {
      ctx.fillStyle = b.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, g.H * b.base, g.H * b.amp, b.seed, b.scale) - g.H * 0.08);
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      if (n === 0) paintPagoda(ctx, g, b);
    });
    return c;
  }

  function paintPagoda(ctx, g, b) {
    const px = g.W * 0.24;
    const base = ridge(g, px, g.H * b.base, g.H * b.amp, b.seed, b.scale) - g.H * 0.08 + g.U * 0.5;
    const u = g.U * 1.5;
    ctx.fillStyle = '#222a47';
    for (let i = 0; i < 5; i++) {
      const w = u * (4.2 - i * 0.5);
      const y = base - u * (3.2 * i + 2.4);
      ctx.fillRect(px - w * 0.32, y, w * 0.64, u * 2.6);
      ctx.beginPath();
      ctx.moveTo(px - w * 0.75, y + u * 0.2);
      ctx.lineTo(px - w * 0.4, y - u * 0.7);
      ctx.lineTo(px + w * 0.4, y - u * 0.7);
      ctx.lineTo(px + w * 0.75, y + u * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(px - u * 0.12, base - u * 20, u * 0.24, u * 3.2);
    ctx.fillRect(px - u * 2.4, base - u * 2.4, u * 4.8, u * 2.4);
  }

  function paintCloud(g, rand) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9cfdc';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * (w / 9);
      const y = h * (0.12 + rand() * 0.75);
      const rx = g.U * (10 + rand() * 18);
      ctx.globalAlpha = 0.07 + rand() * 0.07;
      for (const off of [0, -w, w]) {
        blob(ctx, x + off, y, rx, g.U * (0.9 + rand() * 0.9));
        blob(ctx, x + off + rx * 0.4, y - g.U * 0.5, rx * 0.5, g.U * 0.55);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // One stem: a curve from the ground, bending sideways, ending in a tip point.
  function stemPath(x0, y0, x1, y1, bend) {
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2 + bend, cy: (y0 + y1) / 2 };
  }

  function pointAt(s, t) {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return [a * s.x0 + b * s.cx + c * s.x1, a * s.y0 + b * s.cy + c * s.y1];
  }

  function strokeStem(ctx, s, width, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1);
    ctx.stroke();
  }

  // Susuki plume: a feathery fan of fine strokes along the last part of the stem.
  function plume(ctx, s, len, inks, rand, u) {
    ctx.lineCap = 'round';
    const [sx, sy] = pointAt(s, 0.8);
    const tipDir = Math.atan2(s.y1 - s.cy, s.x1 - s.cx);
    for (let i = 0; i < 34; i++) {
      const t = 0.8 + (i / 34) * 0.2;
      const [bx, by] = pointAt(s, t);
      const side = i % 2 ? 1 : -1;
      const a = tipDir + side * (0.1 + rand() * 0.25);
      const l = len * (0.55 + rand() * 0.45) * (1 - (t - 0.8) * 1.6);
      ctx.strokeStyle = inks[Math.floor(rand() * inks.length)];
      ctx.lineWidth = Math.max(0.8, u * 0.22);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a) * l * 0.6, by + Math.sin(a) * l * 0.6 - l * 0.1, bx + Math.cos(a + side * 0.3) * l, by + Math.sin(a + side * 0.3) * l + l * 0.25);
      ctx.stroke();
    }
    ctx.strokeStyle = inks[0];
    ctx.lineWidth = Math.max(0.8, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  }

  function blade(ctx, x, y, len, lean, ink, w) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    ctx.stroke();
  }

  // Hagi: arching sprays hung with small blossoms.
  function hagi(ctx, x, y, size, rand, u, leafInks, bloomInks) {
    const dir = rand() < 0.5 ? -1 : 1;
    const s = stemPath(x, y, x + dir * size * (0.9 + rand() * 0.5), y - size * (0.2 + rand() * 0.3), dir * size * 0.1);
    s.cy = y - size * (0.95 + rand() * 0.25);
    strokeStem(ctx, s, Math.max(0.9, u * 0.3), leafInks[0]);
    for (let i = 0; i < 20; i++) {
      const t = 0.12 + (i / 20) * 0.88;
      const [px, py] = pointAt(s, t);
      const sd = i % 2 ? 1 : -1;
      ctx.fillStyle = leafInks[1 + (i % 2)];
      blob(ctx, px + sd * u * 0.5, py + u * 0.1, u * 0.65, u * 0.38);
      if (t > 0.35 && rand() < 0.75) {
        ctx.fillStyle = bloomInks[Math.floor(rand() * bloomInks.length)];
        blob(ctx, px + (rand() - 0.5) * u, py + u * (0.3 + rand() * 0.8), u * 0.5, u * 0.5);
      }
    }
  }

  const GRASS = [
    { ink: '#2c3652', plume: ['#6e7794', '#8d92a8'], leaf: ['#303c58', '#34425f', '#2a3652'], bloom: ['#6a4a64', '#7a5068'], size: 0.5, n: 0.6, base: 0.8 },
    { ink: '#26324a', plume: ['#a7aab9', '#c8c4b4', '#8f95aa'], leaf: ['#2b4140', '#355048', '#2c3d44'], bloom: ['#9a5058', '#a65b5e', '#8c4a60'], size: 0.75, n: 0.45, base: 0.9 },
    { ink: '#141b2c', plume: ['#d9d2b6', '#c4bda4', '#e8dcb8', '#a4a7b0'], leaf: ['#17261f', '#1d3027', '#162420'], bloom: ['#b95a52', '#a64a4c', '#c46a5a'], size: 1.05, n: 0.26, base: 1.04 },
  ];

  function paintGrass(g, rand, spec) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U * (0.6 + spec.size * 0.5);
    const baseY = g.H * spec.base;
    const count = Math.round(g.W * spec.n * 0.25);
    ctx.fillStyle = spec.ink;
    ctx.fillRect(0, baseY, g.W, g.H);
    for (let i = 0; i < count * 3; i++) {
      const x = rand() * g.W;
      blade(ctx, x, baseY - g.H * 0.02 + rand() * g.H * 0.04, g.H * spec.size * (0.12 + rand() * 0.14), (rand() - 0.5) * u * 4, spec.ink, Math.max(1, u * 0.35));
    }
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = baseY + (rand() - 0.5) * g.H * 0.05;
      const h = g.H * spec.size * (0.42 + rand() * 0.3);
      const lean = (rand() - 0.5) * h * 0.5;
      if (rand() < 0.5) {
        const s = stemPath(x, y, x + lean, y - h, lean * 0.3);
        strokeStem(ctx, s, Math.max(1, u * 0.3), spec.ink);
        plume(ctx, s, u * 5.2, spec.plume, rand, u);
        for (let k = 0; k < 3; k++) blade(ctx, x, y, h * (0.45 + rand() * 0.3), (rand() - 0.5) * u * 9, spec.ink, Math.max(1, u * 0.4));
      } else {
        hagi(ctx, x, y, h * 0.95, rand, u, spec.leaf, spec.bloom);
      }
    }
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.hills = paintHills(g);
    state.cloud = paintCloud(g, rand);
    state.grass = GRASS.map((spec) => paintGrass(g, rand, spec));
  }

  function drawGrass(ctx, g, img, spec, t, wind, phase) {
    const top = g.H * (spec.base - spec.size * 0.6);
    const span = g.H - top;
    for (let y = Math.max(0, Math.floor(top)); y < g.H; y += SLICE) {
      const f = 1 - (y - top) / span;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.23 + phase);
      const dx = Math.sin(t * 0.9 + y * 0.045 + phase) * g.U * 0.9 * f * f * wind * gust;
      const h = Math.min(SLICE, g.H - y);
      ctx.drawImage(img, 0, y, g.W, h, dx, y, g.W, h);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, clouds } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    if (clouds > 0) {
      const w = state.cloud.width;
      const off = (t * g.U * 0.5) % w;
      ctx.globalAlpha = Math.min(1, clouds);
      ctx.drawImage(state.cloud, off, g.H * 0.08);
      ctx.drawImage(state.cloud, off - w, g.H * 0.08);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.hills, 0, 0);
    for (let i = 0; i < state.grass.length; i++) drawGrass(ctx, g, state.grass[i], GRASS[i], t, wind, i * 1.7);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
