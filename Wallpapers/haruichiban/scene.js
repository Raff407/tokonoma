/*
 * 春一番 Haruichiban — the first warm wind of spring over a hillside village.
 *
 * Sky, ridges, terraces, roofs and pagoda are baked once. The plum branch is baked
 * as its own layer and laid back in thin bands that lean with the wind. Mist is one
 * tiling strip and the petals are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#b9c6cc', '#d6d8cf', '#eadfcc', '#efd5c3'];
  const RIDGE = ['#9aa8b3', '#7f92a2', '#5f7488'];
  const TERRACE = ['#7f8e5c', '#6d7e4e', '#5d6e44', '#4d5e3c'];
  const KAWARA = '#3a3f4a';
  const KAWARA_HI = '#626a78';
  const THATCH = '#8a7448';
  const WASHI = '#e6dec8';
  const WASHI_SIDE = '#c8bfa6';
  const POST = '#3b2f26';
  const VERMILION = '#b0442f';
  const BARK = '#2c231d';
  const BLOSSOM = ['#e6aeb0', '#f1e2d8', '#d98a92', '#f1e2d8'];
  const PETAL = ['#f0c3c4', '#f4e8de', '#e4a0a6'];
  const MAX_PETALS = 90;
  const PETALS = 44;
  const STREAKS = 9;
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
    return { W, H, U };
  }

  // The hillside: high on the left, falling away to the right.
  function slope(g, x) {
    return g.H * (0.44 + 0.12 * (x / g.W)) + fbm(x / (g.U * 30), 2.2, 3, 17) * g.U * 3;
  }

  // ---- sky and ridges ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.55)) * (inks.length - 1);
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
    const sx = g.W * 0.78;
    const sy = g.H * 0.2;
    ctx.fillStyle = 'rgba(244,230,190,0.35)';
    blob(ctx, sx, sy, g.U * 9, g.U * 9);
    ctx.fillStyle = '#f3e3b0';
    blob(ctx, sx, sy, g.U * 4.6, g.U * 4.6);
  }

  function paintRidges(ctx, g, rand) {
    for (let k = 0; k < RIDGE.length; k++) {
      ctx.fillStyle = RIDGE[k];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const y = g.H * (0.3 + k * 0.07) + fbm(x / (g.U * 38), 3.1 + k * 5, 4, 29 + k) * g.H * 0.16 - (k === 0 ? Math.exp(-(((x - g.W * 0.66) / (g.W * 0.18)) ** 2)) * g.H * 0.1 : 0);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    // cedar band along the back of the village
    for (let x = 0; x < g.W; x += g.U * (1.2 + rand() * 1.4)) {
      const base = slope(g, x) - g.U * 4;
      const h = g.U * (4 + rand() * 5);
      ctx.fillStyle = rand() < 0.5 ? '#3b5143' : '#4a6150';
      poly(ctx, [x - h * 0.2, base + g.U, x, base - h, x + h * 0.2, base + g.U]);
    }
  }

  // ---- village -------------------------------------------------------------

  function house(ctx, g, x, y, s, thatch) {
    const u = g.U * s;
    const w = u * (10 + (x * 7) % 3);
    const wh = u * 4;
    ctx.fillStyle = WASHI;
    ctx.fillRect(x - w / 2, y - wh, w * 0.62, wh);
    ctx.fillStyle = WASHI_SIDE;
    ctx.fillRect(x - w / 2 + w * 0.62, y - wh, w * 0.38, wh);
    ctx.fillStyle = POST;
    for (let i = 0; i <= 4; i++) ctx.fillRect(x - w / 2 + (w * i) / 4 - 0.3, y - wh, Math.max(0.6, u * 0.3), wh);
    ctx.fillRect(x - w / 2, y - wh * 0.55, w, Math.max(0.6, u * 0.28));
    ctx.fillStyle = POST;
    ctx.fillRect(x - w / 2, y - 0.6, w, 0.8);
    const rh = u * 5;
    const ry = y - wh - u * 0.6;
    ctx.fillStyle = thatch ? THATCH : KAWARA;
    poly(ctx, [x - w * 0.66, ry, x - w * 0.34, ry - rh, x + w * 0.34, ry - rh, x + w * 0.66, ry]);
    ctx.fillStyle = thatch ? '#a58c58' : KAWARA_HI;
    for (let i = 1; i < 4; i++) ctx.fillRect(x - w * (0.64 - i * 0.07), ry - (rh * i) / 4, w * (1.28 - i * 0.14), Math.max(0.5, u * 0.22));
    ctx.fillStyle = thatch ? '#6e5a34' : '#22262e';
    ctx.fillRect(x - w * 0.36, ry - rh - u * 0.45, w * 0.72, u * 0.5);
  }

  function pagoda(ctx, g, x, y) {
    const u = g.U;
    let top = y;
    const widths = [9, 7.4, 5.8];
    for (let i = 0; i < 3; i++) {
      const w = u * widths[i];
      ctx.fillStyle = VERMILION;
      ctx.fillRect(x - w / 2, top - u * 3.2, w, u * 3.2);
      ctx.fillStyle = POST;
      ctx.fillRect(x - w / 2, top - u * 3.2, Math.max(0.6, u * 0.4), u * 3.2);
      ctx.fillRect(x + w / 2 - u * 0.4, top - u * 3.2, Math.max(0.6, u * 0.4), u * 3.2);
      const ey = top - u * 3.2;
      ctx.fillStyle = KAWARA;
      poly(ctx, [x - w * 0.95, ey + u * 0.4, x - w * 0.45, ey - u * 1.9, x + w * 0.45, ey - u * 1.9, x + w * 0.95, ey + u * 0.4]);
      ctx.fillStyle = KAWARA_HI;
      ctx.fillRect(x - w * 0.9, ey + u * 0.1, w * 1.8, Math.max(0.6, u * 0.28));
      top = ey - u * 1.9;
    }
    ctx.fillStyle = '#c9a24c';
    ctx.fillRect(x - 0.4, top - u * 5, Math.max(0.8, u * 0.4), u * 5);
    for (let i = 0; i < 3; i++) ctx.fillRect(x - u * 0.8, top - u * (1 + i * 1.3), u * 1.6, Math.max(0.6, u * 0.3));
  }

  function torii(ctx, g, x, y, s) {
    const u = g.U * s;
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - u * 3.2, y - u * 7, Math.max(1, u * 0.9), u * 7);
    ctx.fillRect(x + u * 2.3, y - u * 7, Math.max(1, u * 0.9), u * 7);
    ctx.fillRect(x - u * 2.6, y - u * 5.3, u * 5.6, Math.max(1, u * 0.6));
    ctx.fillStyle = BARK;
    poly(ctx, [x - u * 4.4, y - u * 6.6, x - u * 3.8, y - u * 7.8, x + u * 3.8, y - u * 7.8, x + u * 4.4, y - u * 6.6]);
  }

  function cedar(ctx, g, rand, x, y, h) {
    ctx.fillStyle = '#2f4538';
    poly(ctx, [x - h * 0.17, y, x - h * 0.05, y - h * 0.55, x, y - h, x + h * 0.05, y - h * 0.55, x + h * 0.17, y]);
    ctx.fillStyle = '#44604c';
    poly(ctx, [x - h * 0.12, y, x - h * 0.03, y - h * 0.6, x, y - h * 0.95, x + h * 0.02, y - h * 0.4]);
  }

  function paintVillage(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidges(ctx, g, rand);
    const rows = [
      { off: 0.02, s: 0.6, n: 7 },
      { off: 0.1, s: 0.75, n: 6 },
      { off: 0.19, s: 0.95, n: 5 },
      { off: 0.3, s: 1.2, n: 4 },
    ];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      ctx.fillStyle = TERRACE[r];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, slope(g, x) + g.H * row.off);
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      ctx.fillStyle = '#9a9276';
      for (let x = 0; x <= g.W; x += 2) ctx.fillRect(x, slope(g, x) + g.H * row.off, 2, Math.max(1, g.U * 0.9));
      ctx.fillStyle = 'rgba(40,50,30,0.25)';
      for (let x = 0; x <= g.W; x += 2) ctx.fillRect(x, slope(g, x) + g.H * row.off + g.U, 2, Math.max(1, g.U * 0.7));
      if (r === 0) pagoda(ctx, g, g.W * 0.58, slope(g, g.W * 0.58) + g.H * 0.005);
      if (r === 1) torii(ctx, g, g.W * 0.69, slope(g, g.W * 0.69) + g.H * row.off + g.U * 1.5, row.s);
      const span = g.W / row.n;
      for (let i = 0; i < row.n; i++) {
        const x = span * (i + 0.25 + rand() * 0.5);
        if (r === 1 && Math.abs(x - g.W * 0.69) < g.U * 9) continue;
        const y = slope(g, x) + g.H * row.off + g.U * (2.5 + r * 0.8);
        if (rand() < 0.3) cedar(ctx, g, rand, x + g.U * 7 * row.s, y, g.U * (8 + r * 2));
        house(ctx, g, x, y, row.s, rand() < 0.25);
      }
    }
    return c;
  }

  // ---- plum branch ---------------------------------------------------------

  function flower(ctx, g, rand, x, y) {
    const r = Math.max(0.8, g.U * (0.6 + rand() * 0.4));
    ctx.fillStyle = BLOSSOM[Math.floor(rand() * BLOSSOM.length)];
    blob(ctx, x, y, r, r);
    blob(ctx, x + r * 0.9, y - r * 0.4, r * 0.8, r * 0.8);
    blob(ctx, x - r * 0.6, y + r * 0.7, r * 0.7, r * 0.7);
    if (rand() < 0.3) {
      ctx.fillStyle = '#b9505a';
      ctx.fillRect(x, y, Math.max(0.8, r * 0.5), Math.max(0.8, r * 0.5));
    }
  }

  function limb(ctx, g, rand, flowers, x, y, ang, len, w, curve, depth) {
    const n = Math.max(2, Math.ceil(len / (g.U * 2.2)));
    const seg = len / n;
    ctx.strokeStyle = BARK;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      ang += curve + (rand() - 0.5) * 0.3;
      const nx = x + Math.cos(ang) * seg;
      const ny = y + Math.sin(ang) * seg;
      ctx.lineWidth = Math.max(1, w * (1 - (i / n) * 0.55));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
      if (depth < 2 && rand() < 0.28) flowers.push(x + (rand() - 0.5) * g.U, y + (rand() - 0.5) * g.U);
      if (depth > 0 && rand() < 0.22) {
        const side = rand() < 0.5 ? -1 : 1;
        limb(ctx, g, rand, flowers, x, y, ang + side * (0.5 + rand() * 0.5), len * (0.35 + rand() * 0.25), w * 0.55, curve * 0.5 + 0.03, depth - 1);
      }
    }
    if (depth < 2) flowers.push(x, y);
  }

  function paintTree(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const flowers = [];
    const W = g.W;
    const H = g.H;
    const U = g.U;
    limb(ctx, g, rand, flowers, W * 0.035, H * 1.03, -1.62, H * 0.5, U * 4.2, 0.07, 1);
    limb(ctx, g, rand, flowers, W * 0.05, H * 0.5, -0.5, W * 0.22, U * 1.8, -0.05, 2);
    limb(ctx, g, rand, flowers, W * 0.1, H * 0.3, -0.45, W * 0.36, U * 2.0, 0.03, 3);
    limb(ctx, g, rand, flowers, W * 0.4, H * 0.1, -0.1, W * 0.32, U * 1.3, 0.05, 2);
    limb(ctx, g, rand, flowers, W * 0.74, H * 0.12, 0.2, W * 0.22, U * 1, -0.03, 2);
    for (let i = 0; i < flowers.length; i += 2) flower(ctx, g, rand, flowers[i], flowers[i + 1]);
    return c;
  }

  // ---- mist and wind lines -------------------------------------------------

  function paintMist(g, rand) {
    const w = g.W;
    const c = layer(w, g.H * 0.3);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(238,230,214,0.5)';
    for (let i = 0; i < 9; i++) {
      const x = rand() * w;
      const y = g.H * (0.04 + rand() * 0.2);
      const rx = g.U * (14 + rand() * 20);
      const ry = g.U * (0.9 + rand() * 1.2);
      for (const dx of [-w, 0, w]) blob(ctx, x + dx, y, rx, ry);
    }
    return c;
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), len: new Float32Array(STREAKS), v: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = g.H * (0.1 + rand() * 0.7);
      s.len[i] = g.U * (6 + rand() * 12);
      s.v[i] = g.U * (22 + rand() * 20);
    }
    return s;
  }

  // ---- petals --------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f() };
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = scatter ? r() * g.W : -g.U * (1 + r() * 8);
    P.y[i] = g.H * (0.05 + r() * 0.85);
    P.vx[i] = g.U * (13 + r() * 12);
    P.vy[i] = g.U * (1 + r() * 3);
    P.size[i] = g.U * (0.9 + r() * 0.9);
    P.tone[i] = Math.floor(r() * PETAL.length);
    P.spin[i] = (r() - 0.5) * 6;
    P.a[i] = r() * TAU;
    P.p[i] = r() * TAU;
  }

  function stepPetal(g, P, i, t, dt, gust) {
    P.x[i] += P.vx[i] * gust * dt;
    P.y[i] += (P.vy[i] + Math.sin(t * 1.6 + P.p[i]) * g.U * 3.5) * dt;
    P.a[i] += P.spin[i] * dt;
    if (P.x[i] > g.W + g.U * 2 || P.y[i] > g.H + g.U * 2) resetPetal(g, P, i, false);
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + P.p[i]));
      const sz = P.size[i];
      ctx.fillStyle = PETAL[P.tone[i]];
      ctx.setTransform(c, s * sq, -s, c * sq, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMist(ctx, g, t, gust) {
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.4 * gust) % w;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(m, -a, g.H * 0.36);
    ctx.drawImage(m, w - a, g.H * 0.36);
    const b = (t * g.U * 0.8 * gust + w * 0.5) % w;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(m, -b, g.H * 0.52);
    ctx.drawImage(m, w - b, g.H * 0.52);
    ctx.globalAlpha = 1;
  }

  function drawStreaks(ctx, g, dt, gust, wind) {
    if (wind <= 0) return;
    const S = state.streaks;
    ctx.fillStyle = 'rgba(246,238,224,0.28)';
    for (let i = 0; i < STREAKS; i++) {
      S.x[i] += S.v[i] * gust * dt;
      if (S.x[i] > g.W + S.len[i]) {
        S.x[i] = -S.len[i];
        S.y[i] = g.H * (0.1 + state.rand() * 0.7);
      }
      ctx.fillRect(S.x[i], S.y[i], S.len[i], Math.max(1, g.U * 0.3));
    }
  }

  function drawTree(ctx, g, t, wind) {
    const tree = state.tree;
    const gust = 0.65 + 0.35 * Math.sin(t * 0.55) + 0.15 * Math.sin(t * 1.7);
    const amp = g.U * 2.4 * wind;
    for (let y = 0; y < g.H; y += SLICE) {
      const f = Math.max(0, (g.H - y) / g.H);
      const k = Math.pow(f, 1.4);
      const dx = amp * k * (gust + 0.35 * Math.sin(t * 1.3 - y * 0.05)) + g.U * 1.2 * wind * k;
      ctx.drawImage(tree, 0, y, g.W, SLICE, dx, y, g.W, SLICE);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    paintSky(back.getContext('2d'), g, rand);
    state.back = back;
    state.village = paintVillage(g, rand);
    state.tree = paintTree(g, rand);
    state.mist = paintMist(g, rand);
    state.streaks = makeStreaks(g, rand);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, wind } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    const gust = (0.7 + 0.3 * Math.sin(t * 0.55) + 0.1 * Math.sin(t * 1.7)) * (0.3 + 0.7 * wind);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step, gust);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.village, 0, 0);
    drawMist(ctx, g, t, 0.4 + gust);
    drawStreaks(ctx, g, step, gust, wind);
    drawTree(ctx, g, t, wind);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { petals: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
