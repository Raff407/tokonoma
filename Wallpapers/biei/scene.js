/*
 * 美瑛 Biei — patchwork hills of crops in pale stripes under a huge sky.
 *
 * Sky and far peaks, then the fields, a lone tree and a farmhouse, are baked
 * into two layers and repainted once a minute from the clock. Between repaints
 * only the clouds and the shadows they throw on the fields move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, hash2 } = K;

  const RETINT_SECONDS = 60;
  const SHADOW_COUNT = 5;
  const TREE_X = 0.3;
  const HOUSE_X = 0.72;
  // Crop colours, pale and quiet: wheat, washi, young moss, deep moss, soil, lavender.
  const CROPS = ['#cdb674', '#e2dabd', '#8fa266', '#5f7a48', '#8d6e4e', '#8a8cae', '#d6c38a', '#a9b480'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // ---- ridges ------------------------------------------------------------

  const HILLS = [
    { base: 0.535, a1: 0.022, f1: 5, p1: 1, a2: 0.012, f2: 11, haze: 0.4, stripe: 1.6, band: 3, patch: 0.05 },
    { base: 0.625, a1: 0.04, f1: 3.1, p1: 0.5, a2: 0.015, f2: 8, haze: 0.14, stripe: 2.6, band: 5, patch: 0.08, bump: TREE_X },
    { base: 0.77, a1: 0.04, f1: 2.2, p1: 2, a2: 0.012, f2: 7, haze: 0, stripe: 4.2, band: 8, patch: 0.12 },
  ];

  function ridge(g, hill, px) {
    const xn = px / g.W;
    let f = hill.base + hill.a1 * Math.sin(xn * hill.f1 + hill.p1) + hill.a2 * Math.sin(xn * hill.f2 + 1);
    if (hill.bump !== undefined) {
      const d = (xn - hill.bump) / 0.13;
      f -= 0.05 * Math.exp(-d * d);
    }
    return g.H * f;
  }

  // ---- sky ---------------------------------------------------------------

  function peak(xn) {
    const tri = (c, w) => Math.pow(Math.max(0, 1 - Math.abs(xn - c) / w), 1.3);
    return 0.1 * tri(0.7, 0.28) + 0.07 * tri(0.25, 0.22) + 0.045 * tri(0.5, 0.3) + 0.03 * tri(0.95, 0.2);
  }

  function paintRange(ctx, g, sky) {
    const base = g.H * 0.545;
    const rock = mixColor(mixColor(rgb('#6a7ea0'), sky.haze, 0.55), rgb('#242c48'), sky.night * 0.6);
    const snow = mixColor(mixColor(rgb('#eceee8'), sky.amb, 0.4), sky.top, 0.12 + sky.night * 0.35);
    for (let x = 0; x < g.W; x++) {
      const top = base - g.H * peak(x / g.W) - (fbm(x * 0.08, 3, 3, 7) - 0.5) * g.U * 1.6;
      const snowLine = top + (base - top) * 0.42 + (fbm(x * 0.2, 9, 2, 3) - 0.5) * g.U * 1.5;
      ctx.fillStyle = hex(rock);
      ctx.fillRect(x, top, 1, base - top);
      ctx.fillStyle = hex(snow);
      ctx.fillRect(x, top, 1, Math.max(0, snowLine - top));
    }
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.56);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.8; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintRange(ctx, g, sky);
    return c;
  }

  // Heaped cumulus that tiles sideways.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.045, 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      const shade = 252 - (y / h) * 22;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = shade;
        img.data[i + 2] = shade + 3;
        img.data[i + 3] = smoothstep(0.5, 0.66, v) * band * 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintShadow() {
    const c = layer(64, 32);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(32, 16);
    ctx.scale(1, 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
    grad.addColorStop(0, 'rgba(24,34,60,0.7)');
    grad.addColorStop(0.6, 'rgba(24,34,60,0.45)');
    grad.addColorStop(1, 'rgba(24,34,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-32, -32, 64, 64);
    ctx.restore();
    return c;
  }

  // ---- fields ------------------------------------------------------------

  function tintedCrops(sky, haze) {
    const out = [];
    for (let i = 0; i < CROPS.length; i++) {
      let c = mixColor(rgb(CROPS[i]), sky.amb, 0.22 * (1 - sky.night));
      c = mixColor(c, sky.haze, haze);
      c = mixColor(c, rgb('#121a2a'), sky.night * 0.78);
      out.push(c);
    }
    return out;
  }

  function paintHill(img, g, hill, crops, seed) {
    const w = img.width;
    const pw = g.W * hill.patch;
    const bh = g.U * hill.band;
    const sw = g.U * hill.stripe;
    for (let x = 0; x < w; x++) {
      const top = Math.max(0, Math.floor(ridge(g, hill, x)));
      for (let y = top; y < img.height; y++) {
        const yy = y - top;
        const warp = (fbm(x * 0.02, y * 0.03, 2, seed) - 0.5) * 1.2;
        const pi = Math.floor(x / pw + warp);
        const bi = Math.floor(yy / bh + warp * 0.7);
        const id = hash2(pi, bi, seed);
        const id2 = hash2(pi, bi, seed + 9);
        const a = id < 0.68 ? (id2 - 0.5) * 0.6 : 1.57 + (id2 - 0.5) * 0.6;
        const u = (-(x - pi * pw) * Math.sin(a) + yy * Math.cos(a)) / sw;
        const sid = Math.floor(u);
        const crop = crops[Math.floor(hash2(pi, bi, seed + 5) * crops.length)];
        const tone = (sid & 1 ? 0.9 : 1.07) * (0.97 + hash2(sid, pi, seed + 2) * 0.06);
        const lift = (1.16 - Math.min(1, yy / (g.H * 0.22)) * 0.24) * (yy < g.U * 0.9 ? 1.1 : 1);
        const k = tone * lift;
        const i = (y * w + x) * 4;
        img.data[i] = crop[0] * k;
        img.data[i + 1] = crop[1] * k;
        img.data[i + 2] = crop[2] * k;
        img.data[i + 3] = 255;
      }
    }
  }

  function paintFields(ctx, g, sky) {
    const img = ctx.createImageData(g.W, g.H);
    for (let i = 0; i < HILLS.length; i++) paintHill(img, g, HILLS[i], tintedCrops(sky, HILLS[i].haze), 13 + i * 31);
    ctx.putImageData(img, 0, 0);
  }

  // The lone tree: a slim larch on the crest of the middle hill.
  function paintTree(ctx, g, sky, rand) {
    const tx = g.W * TREE_X;
    const ty = ridge(g, HILLS[1], tx) + g.U * 0.5;
    const h = g.U * 17;
    const leaf = mixColor(rgb('#3f5a3a'), rgb('#101620'), sky.night * 0.8);
    const light = mixColor(leaf, mixColor(rgb('#9aa86a'), sky.amb, 0.3), 0.35 * (1 - sky.night));
    ctx.fillStyle = hex(mixColor(rgb('#4a3a30'), rgb('#101218'), sky.night * 0.8));
    ctx.fillRect(tx - g.U * 0.35, ty - h * 0.4, Math.max(1, g.U * 0.7), h * 0.4);
    for (let i = 0; i < 26; i++) {
      const f = i / 25;
      const r = g.U * (0.7 + Math.sin(f * 3.0 + 0.2) * 1.3 + rand() * 0.4);
      const cx = tx + (rand() - 0.5) * g.U * 1.4;
      const cy = ty - h * (0.28 + f * 0.72);
      ctx.fillStyle = hex(leaf);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hex(light);
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.55, 0, 6.3);
      ctx.fill();
    }
  }

  // A farmhouse with a red roof and a short row of windbreak trees.
  function paintFarm(ctx, g, sky, rand) {
    const hx = g.W * HOUSE_X;
    const hy = ridge(g, HILLS[1], hx) + g.U * 0.8;
    const n = sky.night * 0.75;
    ctx.fillStyle = hex(mixColor(rgb('#e2dcc8'), rgb('#161c2c'), n));
    ctx.fillRect(hx, hy - g.U * 3, g.U * 7, g.U * 3);
    ctx.fillStyle = hex(mixColor(rgb('#a8402e'), rgb('#1c1620'), n));
    ctx.beginPath();
    ctx.moveTo(hx - g.U * 0.8, hy - g.U * 3);
    ctx.lineTo(hx + g.U * 3.5, hy - g.U * 6.2);
    ctx.lineTo(hx + g.U * 7.8, hy - g.U * 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#3a5236'), rgb('#101620'), n));
    for (let i = 0; i < 7; i++) {
      const cx = hx + g.U * (9 + i * 1.7);
      const cy = ridge(g, HILLS[1], cx) + g.U * 0.6;
      const r = g.U * (1.1 + rand() * 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 1.4, r * 0.7, r * 1.7, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFields(ctx, g, sky);
    paintFarm(ctx, g, sky, rand);
    paintTree(ctx, g, sky, rand);
    return c;
  }

  // ---- clock -------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.85 - sky.night * 0.3;
    state.shadowAlpha = 1 - sky.night * 0.5;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.6) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  // Shadows slide over the fields a little faster than the clouds above.
  function drawShadows(ctx, g, t, amount) {
    if (amount <= 0) return;
    const span = g.W * 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.H * 0.5, g.W, g.H * 0.5);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, 0.7 * amount * state.shadowAlpha);
    for (let i = 0; i < SHADOW_COUNT; i++) {
      const sx = (((i * 0.31 + 0.1) * span - t * g.U * 2.2) % span + span) % span - g.W * 0.25;
      const size = g.W * (0.2 + (i % 3) * 0.06);
      const sy = g.H * (0.6 + ((i * 0.37) % 0.3));
      ctx.drawImage(state.shadow, sx, sy, size, size * 0.42);
    }
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.42));
    state.shadow = paintShadow();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawShadows(ctx, g, t, props.shadows);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, shadows: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
