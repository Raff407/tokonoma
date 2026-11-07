/*
 * 向日葵 Himawari — a sunflower field under a big summer sky.
 *
 * One baked flower head at each of a few sizes; rows nod together as a slow
 * gust passes, back rows first. Towering cloud drifts behind. A distant hill,
 * and bees that are only a dark cell or two.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const ROWS = 6;
  const MAX_BEES = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.55);
    sky.addColorStop(0, '#2f6a9e');
    sky.addColorStop(1, '#b6d4dc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#4c7a78';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.6);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.5 - fbm(x * 0.01, 3, 3, 8) * 0.1));
    ctx.lineTo(g.W, g.H * 0.6);
    ctx.fill();
    return c;
  }

  // Cumulus: flat base, heaped top. Lit from above in a single pass.
  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.02, y * 0.035, 5, 2);
    for (let y = 0; y < h; y++) {
      const up = 1 - y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        const a = smoothstep(0.4 + up * 0.28, 0.46 + up * 0.28, v) * smoothstep(0, h * 0.06, h - y);
        const shade = 192 + up * 60;
        img.data[i] = shade;
        img.data[i + 1] = shade;
        img.data[i + 2] = shade + 2;
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintHead(radius) {
    const size = Math.ceil(radius * 2.6);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    const petals = 18;
    for (let ring = 0; ring < 2; ring++) {
      ctx.fillStyle = ring ? '#e4b52e' : '#c78f24';
      for (let i = 0; i < petals; i++) {
        const a = (i + ring * 0.5) / petals * 6.283;
        ctx.beginPath();
        ctx.ellipse(m + Math.cos(a) * radius * 0.84, m + Math.sin(a) * radius * 0.84, radius * 0.4, radius * 0.17, a, 0, 6.3);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#3f2a1a';
    ctx.beginPath();
    ctx.arc(m, m, radius * 0.56, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6a4726';
    ctx.beginPath();
    ctx.arc(m, m, radius * 0.3, 0, 6.3);
    ctx.fill();
    return c;
  }

  function makeRows(g, rand) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const f = r / (ROWS - 1);
      const radius = g.U * lerp(1.6, 9, f * f);
      const gap = radius * 2.9;
      const flowers = [];
      for (let x = -gap + rand() * gap; x < g.W + gap; x += gap * (0.9 + rand() * 0.3)) {
        flowers.push({ x, drop: rand() * radius * 0.9, phase: rand() * 6.28, leaf: rand() < 0.5 ? -1 : 1 });
      }
      rows.push({ y: g.H * lerp(0.56, 0.84, f * f), radius, head: paintHead(radius), flowers, stem: toStem(f), leaf: toLeaf(f) });
    }
    return rows;
  }

  const toStem = (f) => K.toHex(K.mixColor([98, 132, 96], [44, 84, 44], f));
  const toLeaf = (f) => K.toHex(K.mixColor([82, 128, 88], [46, 100, 52], f));

  function drawRow(ctx, g, row, t, wind) {
    const r = row.radius;
    const size = row.head.width;
    ctx.fillStyle = row.leaf;
    ctx.fillRect(0, row.y + r * 2.5, g.W, g.H);
    ctx.strokeStyle = row.stem;
    ctx.lineWidth = Math.max(1, r * 0.2);
    for (const f of row.flowers) {
      const gust = Math.sin(t * 0.7 - f.x * 0.018 + f.phase * 0.2) * wind;
      const lean = gust * r * 0.55;
      const hx = f.x + lean;
      const hy = row.y + f.drop + Math.abs(gust) * r * 0.1;
      ctx.beginPath();
      ctx.moveTo(f.x, g.H);
      ctx.quadraticCurveTo(f.x, hy + r * 1.6, hx, hy + r * 0.6);
      ctx.stroke();
      ctx.fillStyle = row.leaf;
      ctx.beginPath();
      ctx.ellipse(hx + f.leaf * r * 1.1, hy + r * 1.8, r * 1.15, r * 0.48, f.leaf * 0.5, 0, 6.3);
      ctx.fill();
      ctx.drawImage(row.head, hx - size / 2, hy - size / 2);
    }
  }

  function drawBees(ctx, g, t) {
    ctx.fillStyle = '#20180f';
    for (let i = 0; i < MAX_BEES; i++) {
      const s = i * 13.7;
      const x = (K.noise2(t * 0.08, s, 3) * 1.4 - 0.2) * g.W;
      const y = g.H * (0.56 + K.noise2(s, t * 0.08, 5) * 0.34);
      ctx.fillRect(x + Math.sin(t * 20 + s), y + Math.cos(t * 17 + s), Math.max(1, g.U * 0.55), Math.max(1, g.U * 0.45));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.cloud = paintCloud(Math.ceil(g.W * 1.6), Math.ceil(g.H * 0.5));
    state.rows = makeRows(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.sky, 0, 0);
    const w = state.cloud.width;
    const x = -((t * g.U * 1.1 * props.clouds) % w);
    ctx.drawImage(state.cloud, x, g.H * 0.02);
    ctx.drawImage(state.cloud, x + w, g.H * 0.02);
    for (const row of state.rows) drawRow(ctx, g, row, t, props.wind);
    drawBees(ctx, g, t);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
