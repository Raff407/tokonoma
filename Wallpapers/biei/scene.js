/*
 * 美瑛 Biei — patchwork hills of crops in pale stripes under a huge sky.
 *
 * Sky and far peaks, then the fields, a lone tree and a red barn, are baked
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
  const TREE_X = 0.27;
  const BARN_X = 0.68;
  // Stripe pairs for the fields: wheat, lavender over moss, young and deep moss,
  // turned soil, washi-pale stubble, gold. Kept low so nothing glares.
  const PAIRS = [
    ['#c8aa5e', '#8a9a58'],
    ['#7a6f9a', '#5d6e44'],
    ['#7f9156', '#58703f'],
    ['#7d5e40', '#b39a5e'],
    ['#cdbf98', '#8a9a5e'],
    ['#b8904a', '#6c8248'],
    ['#6a8048', '#9aa66a'],
  ];
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

  // Back to front. stripe/band/patch grow toward the viewer for a little perspective.
  const HILLS = [
    { base: 0.505, a1: 0.012, f1: 6, p1: 1, a2: 0.006, f2: 13, haze: 0.5, stripe: 1.7, band: 0.5, patch: 0.11, lean: 0.4 },
    { base: 0.56, a1: 0.022, f1: 4.2, p1: 2.2, a2: 0.008, f2: 9, haze: 0.3, stripe: 2.2, band: 0.5, patch: 0.15, lean: -0.5 },
    { base: 0.665, a1: 0.035, f1: 2.8, p1: 0.4, a2: 0.01, f2: 7, haze: 0.12, stripe: 3, band: 0.55, patch: 0.22, lean: 0.6, bump: TREE_X },
    { base: 0.84, a1: 0.045, f1: 2.1, p1: 3.6, a2: 0.012, f2: 5, haze: 0, stripe: 4.4, band: 0.6, patch: 0.34, lean: -0.7 },
  ];

  function ridge(g, hill, px) {
    const xn = px / g.W;
    let f = hill.base + hill.a1 * Math.sin(xn * hill.f1 + hill.p1) + hill.a2 * Math.sin(xn * hill.f2 + 1);
    if (hill.bump !== undefined) {
      const d = (xn - hill.bump) / 0.16;
      f -= 0.075 * Math.exp(-d * d);
    }
    return g.H * f;
  }

  // ---- sky ---------------------------------------------------------------

  function peak(xn) {
    const tri = (c, w) => Math.pow(Math.max(0, 1 - Math.abs(xn - c) / w), 1.25);
    return 0.17 * tri(0.64, 0.2) + 0.11 * tri(0.44, 0.15) + 0.09 * tri(0.84, 0.14) + 0.06 * tri(0.12, 0.18) + 0.012;
  }

  function paintRange(ctx, g, sky) {
    const base = g.H * 0.53;
    const rock = mixColor(mixColor(rgb('#55648a'), sky.haze, 0.35), rgb('#1a2038'), sky.night * 0.6);
    const shade = mixColor(rock, rgb('#1e2640'), 0.35);
    const snow = mixColor(mixColor(rgb('#e4dfd0'), sky.amb, 0.25), rgb('#4a5272'), sky.night * 0.55);
    const snowShade = mixColor(snow, rgb('#8792ae'), 0.3);
    const d = 3 / g.W;
    for (let x = 0; x < g.W; x++) {
      const xn = x / g.W;
      const top = base - g.H * peak(xn) - (fbm(x * 0.05, 3, 2, 7) - 0.5) * g.U * 1.2;
      const snowLine = top + (base - top) * 0.62 + (fbm(x * 0.12, 9, 2, 3) - 0.5) * g.U * 2;
      // Faces climbing to the right catch the light from the left.
      const lit = peak(xn + d) >= peak(xn - d);
      ctx.fillStyle = hex(lit ? rock : shade);
      ctx.fillRect(x, top, 1, base - top);
      ctx.fillStyle = hex(lit ? snow : snowShade);
      ctx.fillRect(x, top, 1, Math.max(0, snowLine - top));
    }
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.56);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#d8ccaa'), 0.3 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.8; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.45, 1, 1);
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
      const shade = 244 - (y / h) * 30;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = shade;
        img.data[i + 1] = shade - 4;
        img.data[i + 2] = shade - 12;
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

  function tint(c, sky, haze) {
    let o = mixColor(c, sky.amb, 0.15 * (1 - sky.night));
    o = mixColor(o, sky.haze, haze);
    return mixColor(o, rgb('#121a2a'), sky.night * 0.78);
  }

  function tintedPairs(sky, haze) {
    return PAIRS.map((p) => [tint(rgb(p[0]), sky, haze), tint(rgb(p[1]), sky, haze)]);
  }

  // One field: which stripe pair, how the rows run, and whether it is plain.
  function field(pi, bi, seed, idx) {
    const r = hash2(pi, bi, seed);
    return {
      pair: Math.floor(hash2(pi, bi, seed + 5) * PAIRS.length),
      across: idx >= 2 && r > 0.8, // rows running down the slope; near hills only
      plain: r < 0.14,
      slope: (hash2(pi, bi, seed + 9) - 0.5) * 0.5,
    };
  }

  // Fields follow the ridge: depth below the crest drives bands and the rows,
  // so stripes curve over the hill. Light falls from the upper left.
  function paintHill(img, g, idx, pairs, seed) {
    const hill = HILLS[idx];
    const next = HILLS[idx + 1];
    const w = img.width;
    const pw = g.W * hill.patch;
    const sw = Math.max(2, g.U * hill.stripe);
    for (let x = 0; x < w; x++) {
      const top = Math.max(0, Math.floor(ridge(g, hill, x)));
      const bottom = next ? Math.min(img.height, Math.ceil(ridge(g, next, x)) + 1) : img.height;
      const thick = (next ? next.base - hill.base : 1 - hill.base) * g.H + g.U * 6;
      const slope = (ridge(g, hill, x + 1) - ridge(g, hill, x - 1)) * 0.5;
      const light = 1 + Math.max(-0.14, Math.min(0.14, -slope * 0.5));
      for (let y = top; y < bottom; y++) {
        const depth = y - top;
        const dn = depth / thick;
        const wob = (fbm(x * 0.01, depth * 0.02, 2, seed) - 0.5);
        const sx = x + wob * pw * 1.1 + depth * hill.lean;
        const pi = Math.floor(sx / pw);
        const bi = Math.floor(dn / hill.band + wob * 0.8);
        const f = field(pi, bi, seed, idx);
        const p = pairs[f.pair];
        let k;
        let col;
        if (f.plain) {
          col = p[1];
          k = 1;
        } else {
          const u = f.across ? (sx - pi * pw + depth * 0.4) / sw : (depth + (sx - pi * pw) * f.slope) / sw;
          col = Math.floor(u) & 1 ? p[1] : p[0];
          k = 1;
        }
        const edge = sx - pi * pw < 1 ? 0.88 : 1;
        const crest = depth < g.U * 0.8 ? 1.1 : 1;
        // Round the hill: lit near the crest, settling darker toward its foot.
        const round = 1.1 - smoothstep(0, 1, dn) * 0.2;
        k *= edge * crest * round * light;
        const i = (y * w + x) * 4;
        img.data[i] = col[0] * k;
        img.data[i + 1] = col[1] * k;
        img.data[i + 2] = col[2] * k;
        img.data[i + 3] = 255;
      }
    }
  }

  function paintFields(ctx, g, sky) {
    const img = ctx.createImageData(g.W, g.H);
    for (let i = 0; i < HILLS.length; i++) paintHill(img, g, i, tintedPairs(sky, HILLS[i].haze), 13 + i * 31);
    ctx.putImageData(img, 0, 0);
  }

  // A row of windbreak poplars along the far hill.
  function paintWindbreak(ctx, g, sky, rand) {
    ctx.fillStyle = hex(tint(rgb('#2e4228'), sky, 0.15));
    for (let i = 0; i < 9; i++) {
      const cx = g.W * (0.79 + i * 0.016);
      const cy = ridge(g, HILLS[1], cx) + g.U * 0.4;
      const r = g.U * (1.4 + rand() * 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 1.5, r * 1.05, r * 1.7, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // The lone tree: a broad, rounded tree on the crest of the middle hill.
  function paintTree(ctx, g, sky, rand) {
    const tx = g.W * TREE_X;
    const ty = ridge(g, HILLS[2], tx) + g.U * 0.6;
    const h = g.U * 24;
    const leaf = mixColor(rgb('#34492e'), rgb('#0e141c'), sky.night * 0.8);
    const light = mixColor(leaf, mixColor(rgb('#8c9a5a'), sky.amb, 0.2), 0.4 * (1 - sky.night));
    ctx.fillStyle = hex(mixColor(rgb('#3e3028'), rgb('#101218'), sky.night * 0.8));
    ctx.fillRect(tx - g.U * 0.6, ty - h * 0.45, Math.max(1, g.U * 1.2), h * 0.45);
    // Shadow pooled on the grass to the right.
    ctx.fillStyle = 'rgba(20,28,40,0.35)';
    ctx.beginPath();
    ctx.ellipse(tx + g.U * 4, ty, g.U * 6, g.U * 0.9, 0, 0, 6.3);
    ctx.fill();
    const blobs = [];
    for (let i = 0; i < 30; i++) {
      const a = rand() * 6.28;
      const d = Math.sqrt(rand());
      blobs.push({
        x: tx + Math.cos(a) * d * g.U * 7.5,
        y: ty - h * 0.68 + Math.sin(a) * d * g.U * 5.5,
        r: g.U * (2 + rand() * 1.6),
      });
    }
    ctx.fillStyle = hex(leaf);
    for (const b of blobs) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = hex(light);
    for (const b of blobs) {
      if (b.y > ty - h * 0.68 + g.U) continue;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.55, 0, 6.3);
      ctx.fill();
    }
  }

  // A red-roofed barn with a pale wall, set into the far side of the middle hill.
  function paintBarn(ctx, g, sky) {
    const hx = g.W * BARN_X;
    const hy = ridge(g, HILLS[2], hx) + g.U * 1.2;
    const n = sky.night * 0.75;
    const bw = g.U * 11;
    ctx.fillStyle = hex(mixColor(rgb('#d4c9aa'), rgb('#161c2c'), n));
    ctx.fillRect(hx, hy - g.U * 4.5, bw, g.U * 4.5);
    ctx.fillStyle = hex(mixColor(rgb('#9c8a6e'), rgb('#121624'), n));
    ctx.fillRect(hx + bw * 0.4, hy - g.U * 3, bw * 0.2, g.U * 3);
    ctx.fillStyle = hex(mixColor(rgb('#b0402a'), rgb('#1c1620'), n));
    ctx.beginPath();
    ctx.moveTo(hx - g.U * 1, hy - g.U * 4.5);
    ctx.lineTo(hx + bw * 0.2, hy - g.U * 8.5);
    ctx.lineTo(hx + bw * 0.8, hy - g.U * 8.5);
    ctx.lineTo(hx + bw + g.U * 1, hy - g.U * 4.5);
    ctx.closePath();
    ctx.fill();
    // silo
    ctx.fillStyle = hex(mixColor(rgb('#bfb59a'), rgb('#141a28'), n));
    ctx.fillRect(hx + bw + g.U * 1.5, hy - g.U * 9, g.U * 2.6, g.U * 9);
    ctx.fillStyle = hex(mixColor(rgb('#8e3a2a'), rgb('#1c1620'), n));
    ctx.beginPath();
    ctx.arc(hx + bw + g.U * 2.8, hy - g.U * 9, g.U * 1.3, Math.PI, 0);
    ctx.fill();
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFields(ctx, g, sky);
    paintWindbreak(ctx, g, sky, rand);
    paintBarn(ctx, g, sky);
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
