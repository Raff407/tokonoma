/*
 * 茶畑 Chabatake — rows of tea bushes over rolling hills in early spring.
 *
 * Sky, mountains and three hills of rows are baked once. The rows follow each hill's
 * contour and widen toward the viewer. Per frame: a tiling cloud strip, two tiling mist
 * strips in the valleys, and the blades of a handful of frost fans on their poles.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#8c9db0', '#a3b0ba', '#bcc2c0', '#d2d0c2', '#dfd8c4'];
  const RANGE = ['#8794a4', '#6f8193'];
  const HILLS = [
    { tones: ['#a8b48a', '#8e9f72', '#788b62', '#5c6c50'], s0: 2.2, grow: 0.05, haze: 0.3 },
    { tones: ['#a6bb6e', '#86a052', '#668340', '#3d4f30'], s0: 2.6, grow: 0.08, haze: 0.12 },
    { tones: ['#b0c271', '#8aa651', '#64843c', '#2f3c27'], s0: 3.2, grow: 0.11, haze: 0.0 },
  ];
  const TREE = ['#2e4030', '#3d5537', '#52683f'];
  const POLE = '#3a3934';
  const BLADE = '#4e5049';
  const HUB = '#d8d2bf';
  const MAX_FANS = 12;
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
    return { W, H, U: H / 100 };
  }

  // ---- hill outlines -------------------------------------------------------

  function topFar(g, x) {
    return g.H * 0.42 + Math.sin(x / (g.W * 0.22) + 0.6) * g.H * 0.03 + fbm(x / (g.U * 30), 2.2, 3, 5) * g.H * 0.05;
  }

  function topMid(g, x) {
    return g.H * 0.52 + Math.sin(x / (g.W * 0.18) + 2.1) * g.H * 0.05 + fbm(x / (g.U * 36), 7.1, 3, 9) * g.H * 0.04;
  }

  function topNear(g, x) {
    const f = x / g.W;
    return g.H * 0.64 + (f - 0.3) * (f - 0.3) * g.H * 0.22 + Math.sin(x / (g.W * 0.13) + 4) * g.H * 0.025;
  }

  const TOPS = [topFar, topMid, topNear];

  // ---- sky and mountains ---------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.45)) * (inks.length - 1);
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
    for (let r = 0; r < RANGE.length; r++) {
      ctx.fillStyle = RANGE[r];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const peak = Math.exp(-(((x - g.W * (0.72 - r * 0.45)) / (g.W * 0.2)) ** 2)) * g.H * (0.1 - r * 0.03);
        const y = g.H * (0.33 + r * 0.05) - peak + fbm(x / (g.U * (24 - r * 6)), r * 3.3, 4, 13 + r) * g.H * 0.06;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    return c;
  }

  // ---- tea rows ------------------------------------------------------------

  function paintHill(g, idx, rand) {
    const spec = HILLS[idx];
    const top = TOPS[idx];
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const mist = K.parseColor('#c6c9c3');
    const inks = spec.tones.map((c) => K.mixColor(K.parseColor(c), mist, spec.haze));
    const s0 = Math.max(spec.s0, g.U * spec.s0 * 0.7);
    const k = spec.grow;
    const lean = (idx === 1 ? 0.06 : idx === 2 ? -0.08 : 0.03);
    for (let x = 0; x < g.W; x++) {
      const t = top(g, x);
      const wave = Math.sin(x / (g.U * 22) + idx * 1.7) * g.U * 1.6 + (x - g.W * 0.5) * lean;
      for (let y = Math.max(0, Math.floor(t)); y < g.H; y++) {
        const depth = y - t;
        const dd = Math.max(0, depth + wave * Math.min(1, depth / (g.U * 6)));
        const v = Math.log(1 + (k * dd) / s0) / k;
        const f = v - Math.floor(v);
        let tone;
        if (f < 0.24) tone = 0;
        else if (f < 0.52) tone = 1;
        else if (f < 0.74) tone = 2;
        else tone = 3;
        if (tone < 3 && fbm(x / (g.U * 5), y / (g.U * 3), 2, 31 + idx) > 0.66) tone = Math.min(2, tone + 1);
        if (depth < 1.5) tone = 0;
        const ink = inks[tone];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (idx < 2) paintTrees(ctx, g, idx, rand);
    return c;
  }

  function paintTrees(ctx, g, idx, rand) {
    const top = TOPS[idx];
    const size = g.U * (0.9 + idx * 0.4);
    for (let x = 0; x < g.W; ) {
      const n = fbm(x / (g.U * 18), idx * 5.1, 3, 51 + idx);
      if (n > 0.6) {
        const r = size * (0.8 + rand() * 0.6);
        const y = top(g, x) + r * 0.3;
        ctx.fillStyle = TREE[0];
        blob(ctx, x, y, r, r * 1.1);
        ctx.fillStyle = TREE[1];
        blob(ctx, x - r * 0.2, y - r * 0.25, r * 0.7, r * 0.75);
        ctx.fillStyle = TREE[2];
        blob(ctx, x - r * 0.35, y - r * 0.45, r * 0.32, r * 0.35);
        x += r * (1 + rand() * 0.5);
      } else {
        x += size;
      }
    }
  }

  // ---- frost fans ----------------------------------------------------------

  function placeFans(g, rand, hills) {
    const F = { n: 0, x: new Float32Array(MAX_FANS), y: new Float32Array(MAX_FANS), r: new Float32Array(MAX_FANS), a: new Float32Array(MAX_FANS), w: new Float32Array(MAX_FANS), sw: new Float32Array(MAX_FANS), hill: new Uint8Array(MAX_FANS) };
    const plan = [
      [1, 0.14, 0.5], [1, 0.36, 0.45], [1, 0.58, 0.5], [1, 0.8, 0.4],
      [2, 0.1, 0.7], [2, 0.38, 0.6], [2, 0.66, 0.75], [2, 0.9, 0.6],
    ];
    for (const [h, fx, fd] of plan) {
      const i = F.n++;
      const x = g.W * (fx + (rand() - 0.5) * 0.04);
      const top = TOPS[h](g, x);
      const ground = top + g.U * (h === 1 ? 2.5 : 4) * (1 + fd);
      const tall = g.U * (h === 1 ? 7 : 13);
      const ctx = hills[h].getContext('2d');
      ctx.strokeStyle = POLE;
      ctx.lineWidth = Math.max(1, g.U * (h === 1 ? 0.35 : 0.55));
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.lineTo(x, ground - tall);
      ctx.stroke();
      F.x[i] = x;
      F.y[i] = ground - tall;
      F.r[i] = g.U * (h === 1 ? 2.4 : 3.8);
      F.a[i] = rand() * TAU;
      F.w[i] = 1.1 + rand() * 0.6;
      F.sw[i] = rand() * TAU;
      F.hill[i] = h;
    }
    return F;
  }

  function drawFans(ctx, g, t, hill, fans) {
    const F = state.fans;
    for (let i = 0; i < F.n; i++) {
      if (F.hill[i] !== hill) continue;
      const hx = F.x[i];
      const hy = F.y[i];
      const R = F.r[i];
      const spin = F.a[i] + t * F.w[i] * fans * 1.4;
      const sq = 0.38 + 0.22 * Math.sin(t * 0.18 + F.sw[i]);
      const tilt = -0.35;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      ctx.fillStyle = BLADE;
      for (let b = 0; b < 3; b++) {
        const a = spin + (b * TAU) / 3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ctx.setTransform(ct * sq * ca - st * sa, st * sq * ca + ct * sa, -ct * sq * sa - st * ca, -st * sq * sa + ct * ca, hx + R * 0.15, hy);
        ctx.fillRect(0, -R * 0.14, R, R * 0.28);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = HUB;
      ctx.fillRect(hx - R * 0.35, hy - R * 0.22, R * 0.55, R * 0.44);
    }
  }

  // ---- clouds and mist -----------------------------------------------------

  function paintStrip(g, wf, hf, sx, sy, seed, rgb, alpha, lo, hi) {
    const w = Math.ceil(g.W * wf);
    const h = Math.ceil(g.H * hf);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * sx), y / (g.U * sy), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(lo, hi, v) * band * 3) / 3;
        const i = (y * w + x) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = a * alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawStrip(ctx, strip, x, y, alpha) {
    if (alpha <= 0) return;
    const w = strip.width;
    const a = ((x % w) + w) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(strip, -a, y);
    ctx.drawImage(strip, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.hills = [0, 1, 2].map((i) => paintHill(g, i, rand));
    state.fans = placeFans(g, rand, state.hills);
    state.clouds = paintStrip(g, 1.6, 0.22, 26, 6, 61, [236, 230, 214], 200, 0.42, 0.66);
    state.mist = paintStrip(g, 1.5, 0.1, 16, 3, 77, [226, 224, 210], 170, 0.36, 0.62);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fans, mist, clouds } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawStrip(ctx, state.clouds, t * g.U * 1.2, g.H * 0.04, clouds * 0.9);
    ctx.drawImage(state.hills[0], 0, 0);
    drawStrip(ctx, state.mist, t * g.U * 1.6, g.H * 0.44, mist * 0.8);
    ctx.drawImage(state.hills[1], 0, 0);
    drawFans(ctx, g, t, 1, fans);
    drawStrip(ctx, state.mist, -t * g.U * 1.1 + g.W * 0.5, g.H * 0.56, mist * 0.55);
    ctx.drawImage(state.hills[2], 0, 0);
    drawFans(ctx, g, t, 2, fans);
  }

  Kasuri.run({
    defaults: { fans: 1, mist: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
