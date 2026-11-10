/*
 * 水墨 Shuimo — a shanshui ink painting: layered peaks in grey and indigo, mist between
 * the ridges, a small pavilion on a rock, pines, a still pool and a few geese.
 *
 * Every ridge is baked once into its own layer. Mist is a handful of tiling strips that
 * slide at different speeds; the pool is the near scene flipped and laid back in rows.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, mixColor, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const WASHI = '#e4dcc8';
  const PAPER_LOW = '#d9d3c0';
  const INK = '#1f2226';
  const INDIGO = '#34415c';
  const VERMILION = '#b8432c';
  const GOLD = '#b99a52';
  const MOSS = '#4f5a44';
  const WATER = 0.8;
  const BIRDS = 5;
  const state = {};

  // far to near: ink colour, haze toward paper, baseline, peak height, feature width
  const RIDGES = [
    { ink: '#8d96a4', haze: 0.45, base: 0.5, amp: 0.34, seed: 3, scale: 30 },
    { ink: '#6f7a8d', haze: 0.35, base: 0.6, amp: 0.38, seed: 8, scale: 26 },
    { ink: '#4d5a72', haze: 0.22, base: 0.7, amp: 0.34, seed: 15, scale: 22 },
    { ink: '#323a4c', haze: 0.1, base: 0.78, amp: 0.16, seed: 21, scale: 16 },
  ];
  const MISTS = [
    { y: 0.55, speed: 3, alpha: 0.9, seed: 4 },
    { y: 0.66, speed: -4.5, alpha: 0.9, seed: 9 },
    { y: 0.76, speed: 6, alpha: 0.85, seed: 13 },
  ];

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
    return { W, H, U, wy: Math.round(H * WATER), cx: W * 0.7 };
  }

  function paintPaper(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#d3cdbb');
    grad.addColorStop(0.45, WASHI);
    grad.addColorStop(1, PAPER_LOW);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e9d9b8';
    ctx.globalAlpha = 0.7;
    blob(ctx, g.W * 0.24, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.fillStyle = '#c9b57f';
    ctx.globalAlpha = 0.5;
    blob(ctx, g.W * 0.24, g.H * 0.2, g.U * 3.2, g.U * 3.2);
    ctx.globalAlpha = 1;
    return c;
  }

  // Crest height of ridge r at x: broad swells with sharp ridged peaks.
  function crest(g, r, x) {
    const n = fbm(x / (g.U * r.scale), r.seed, 3, r.seed);
    const ridged = 1 - Math.abs(fbm(x / (g.U * r.scale * 0.5), r.seed + 5, 3, r.seed + 2) * 2 - 1);
    const h = Math.pow(Math.max(0, n * 1.3 - 0.15), 1.5) * 0.7 + Math.pow(ridged, 2.2) * 0.45 * n;
    return g.H * r.base - Math.min(1, h) * g.H * r.amp;
  }

  function paintRidge(g, r, rand, index) {
    const c = layer(g.W, g.wy + 2);
    const ctx = c.getContext('2d');
    const top = parseColor(r.ink);
    const haze = parseColor(WASHI);
    const lo = toHex(mixColor(top, haze, r.haze + 0.4));
    const hi = toHex(mixColor(top, haze, r.haze * 0.4));
    const grad = ctx.createLinearGradient(0, g.H * (r.base - r.amp), 0, g.H * (r.base + 0.1));
    grad.addColorStop(0, hi);
    grad.addColorStop(1, lo);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.wy + 2);
    const ys = [];
    for (let x = 0; x <= g.W + 2; x += 1) {
      const y = crest(g, r, x);
      ys.push(y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W + 2, g.wy + 2);
    ctx.closePath();
    ctx.fill();
    // dry brush strokes down the flanks
    ctx.strokeStyle = hi;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let x = 2; x < g.W; x += 2 + rand() * (3 - index * 0.5)) {
      const y = ys[Math.floor(x)];
      if (y === undefined) continue;
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      const len = g.U * (2 + rand() * 6);
      ctx.beginPath();
      ctx.moveTo(x, y + g.U * rand() * 2);
      ctx.lineTo(x + (rand() - 0.5) * g.U, y + len);
      ctx.stroke();
    }
    // a darker ink edge along the crest
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = toHex(mixColor(top, parseColor(INK), 0.4));
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    for (let x = 0; x < ys.length; x++) {
      if (x === 0) ctx.moveTo(x, ys[x]);
      else ctx.lineTo(x, ys[x]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    return { canvas: c, ys };
  }

  function pine(ctx, x, y, h, rand, ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, h * 0.06);
    const lean = (rand() - 0.5) * h * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const f = 0.4 + i * 0.18;
      const side = i % 2 ? 1 : -1;
      const w = h * (0.34 - f * 0.18);
      const px = x + lean * f * f + side * h * 0.12;
      blob(ctx, px, y - h * f, w, w * 0.35);
      blob(ctx, px + side * w * 0.5, y - h * f + w * 0.2, w * 0.6, w * 0.25);
    }
  }

  // Pavilion with a hipped roof, upturned eaves, red posts and a low rail.
  function pavilion(ctx, x, y, u) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - u * 5, y - u * 0.8, u * 10, u * 0.8);
    ctx.fillStyle = VERMILION;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - u * 3.6 + i * u * 2.4, y - u * 5.2, Math.max(1, u * 0.55), u * 4.4);
    ctx.fillStyle = '#6a3a2a';
    ctx.fillRect(x - u * 3.6, y - u * 2.2, u * 7.6, Math.max(1, u * 0.4));
    ctx.fillStyle = INK;
    const ey = y - u * 5.2;
    poly(ctx, [x - u * 6.8, ey - u * 1.4, x - u * 4.6, ey + u * 0.1, x + u * 4.6, ey + u * 0.1, x + u * 6.8, ey - u * 1.4,
      x + u * 5.6, ey - u * 0.3, x + u * 1.2, ey - u * 2.6, x + u * 0.4, ey - u * 3.6, x - u * 0.4, ey - u * 3.6,
      x - u * 1.2, ey - u * 2.6, x - u * 5.6, ey - u * 0.3]);
    ctx.fillRect(x - u * 0.15, ey - u * 4.6, Math.max(1, u * 0.3), u * 1.2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - u * 0.5, ey - u * 3.7, u, Math.max(1, u * 0.3));
  }

  function paintNear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    // cliff on the right holding the pavilion
    const px = g.cx;
    const top = g.H * 0.58;
    const ys = [];
    ctx.fillStyle = '#262c38';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.5, g.wy + 2);
    for (let x = g.W * 0.5; x <= g.W + 2; x += 1) {
      const t = (x - g.W * 0.5) / (g.W * 0.5);
      const bell = Math.exp(-(((x - px) / (g.W * 0.2)) ** 2));
      const y = lerp(g.wy, top, Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5), 0.8)) - bell * g.H * 0.06
        + (fbm(x / (u * 7), 2.2, 3, 6) - 0.5) * u * 4;
      ys.push(y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W + 2, g.wy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a5368';
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let i = 0; i < g.W * 0.4; i++) {
      const x = g.W * 0.5 + rand() * g.W * 0.5;
      const y = ys[Math.min(ys.length - 1, Math.floor(x - g.W * 0.5))];
      ctx.globalAlpha = 0.2 + rand() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y + rand() * u * 3);
      ctx.lineTo(x + (rand() - 0.5) * u, y + u * (2 + rand() * 7));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const at = (x) => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(x - g.W * 0.5)))];
    pavilion(ctx, px, at(px) + u * 0.3, u * 1.5);
    pine(ctx, px - u * 11, at(px - u * 11) + u, u * 17, rand, MOSS);
    pine(ctx, px + u * 13, at(px + u * 13) + u, u * 13, rand, '#3d4a38');
    pine(ctx, px - u * 17, at(px - u * 17) + u, u * 10, rand, MOSS);
    // low reeds at the left shore
    ctx.strokeStyle = '#3c4458';
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let x = 0; x < g.W * 0.2; x += u * (0.8 + rand())) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, g.wy + 1);
      ctx.lineTo(x + (rand() - 0.3) * u, g.wy - u * (2 + rand() * 3));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintMistStrip(g, m) {
    const w = g.W;
    const h = Math.ceil(g.H * 0.26);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const r = K.rng(m.seed);
    ctx.fillStyle = WASHI;
    const n = Math.max(6, Math.round(w / (g.U * 9)));
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = h * (0.35 + r() * 0.3);
      const rx = g.U * (10 + r() * 16);
      const ry = h * (0.12 + r() * 0.18);
      for (const dx of [-w, 0, w]) {
        ctx.globalAlpha = 0.35;
        blob(ctx, x + dx, y, rx, ry);
        ctx.globalAlpha = 0.6;
        blob(ctx, x + dx, y, rx * 0.6, ry * 0.55);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawMist(ctx, g, t, amount, i) {
    if (amount <= 0) return;
    {
      const m = MISTS[i];
      const strip = state.mists[i];
      const off = (((t * m.speed * g.U * 0.5) % g.W) + g.W) % g.W;
      const y = g.H * m.y - strip.height / 2;
      ctx.globalAlpha = Math.min(1, m.alpha * amount);
      ctx.drawImage(strip, off - g.W, y);
      ctx.drawImage(strip, off, y);
    }
    ctx.globalAlpha = 1;
  }

  // Pool: the scene above the waterline flipped, in thin rows that sway sideways.
  function drawPool(ctx, g, t) {
    const src = state.flat;
    const depth = g.H - g.wy;
    ctx.fillStyle = '#9aa2ac';
    ctx.fillRect(0, g.wy, g.W, depth);
    for (let y = 0; y < depth; y += 2) {
      const sy = g.wy - 1 - y * 0.9;
      if (sy < 0) break;
      const sway = Math.sin(t * 0.7 + y * 0.45) * g.U * (0.15 + y / depth * 0.35);
      ctx.globalAlpha = 0.78 - (y / depth) * 0.25;
      ctx.drawImage(src, 0, sy, g.W, 1, sway, g.wy + y, g.W, 2);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = WASHI;
    const k = state.glints;
    for (let i = 0; i < k.x.length; i++) {
      const ph = Math.sin(t * 0.5 + k.p[i]);
      if (ph < 0.2) continue;
      ctx.fillRect(k.x[i], g.wy + k.y[i], k.w[i] * ph, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    const span = g.W + g.U * 20;
    for (let i = 0; i < BIRDS; i++) {
      const x = ((t * g.U * 3 + i * g.U * 5 + 40 * i) % span) - g.U * 10;
      const y = g.H * 0.16 + Math.abs(i - 2) * g.U * 1.7 + Math.sin(t * 0.3 + i) * g.U * 0.5;
      const flap = Math.sin(t * 3 + i * 0.9) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.8, y + flap);
      ctx.quadraticCurveTo(x - g.U * 0.6, y - g.U * 0.5, x, y);
      ctx.quadraticCurveTo(x + g.U * 0.6, y - g.U * 0.5, x + g.U * 1.8, y + flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.paper = paintPaper(g, rand);
    state.ridges = RIDGES.map((r, i) => paintRidge(g, r, rand, i).canvas);
    state.near = paintNear(g, rand);
    state.mists = MISTS.map((m) => paintMistStrip(g, m));
    // flat copy of the world above the waterline, used for the reflection
    const flat = layer(g.W, g.H);
    const fctx = flat.getContext('2d');
    fctx.drawImage(state.paper, 0, 0);
    for (let i = 0; i < state.ridges.length; i++) fctx.drawImage(state.ridges[i], 0, 0);
    fctx.drawImage(state.near, 0, 0);
    state.flat = flat;
    const n = Math.round(g.W / 5);
    const depth = g.H - g.wy;
    const glints = { x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      glints.x[i] = rand() * g.W;
      glints.y[i] = 1 + rand() * (depth - 2);
      glints.w[i] = 2 + rand() * g.U * 2;
      glints.p[i] = rand() * TAU;
    }
    state.glints = glints;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, birds } = api.props;
    ctx.drawImage(state.paper, 0, 0);
    ctx.drawImage(state.ridges[0], 0, 0);
    const amt = Math.min(1, mist);
    drawMist(ctx, g, t, amt, 0);
    ctx.drawImage(state.ridges[1], 0, 0);
    drawMist(ctx, g, t, amt, 1);
    ctx.drawImage(state.ridges[2], 0, 0);
    drawMist(ctx, g, t, amt, 2);
    ctx.drawImage(state.ridges[3], 0, 0);
    ctx.drawImage(state.near, 0, 0);
    if (birds) drawBirds(ctx, g, t);
    drawPool(ctx, g, t);
  }

  Kasuri.run({
    defaults: { mist: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
