/*
 * 大文字 Daimonji — the great bonfire character burning on a mountainside above Kyoto.
 *
 * Sky, ranges, mountain and roofs are baked once. The fires are one glow sprite drawn at
 * fixed points along the three strokes, each breathing on its own phase. Smoke and sparks
 * are short reused pools worked out in closed form from the clock, so nothing allocates.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const MAX_SMOKE = 28;
  const MAX_SPARKS = 36;
  const SMOKE_LIFE = 9;
  const SPARK_LIFE = 3.2;
  const SKY = ['#0a0e20', '#141c44', '#232d62', '#3a3868', '#6a4a62'];
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
    return { W, H, U: H / 100, cx: W * 0.5, city: H * 0.74 };
  }

  // ---- mountain and the three strokes ------------------------------------------

  function ridge(g, x) {
    const d = Math.abs(x - g.cx) / (g.H * 0.95);
    return g.H * 0.1 + Math.pow(d, 1.35) * g.H * 0.62 + fbm(x / (g.U * 22), 2.2, 3, 17) * g.H * 0.05;
  }

  function farRidge(g, x) {
    return g.H * 0.32 + fbm(x / (g.U * 45), 5.1, 4, 29) * g.H * 0.16 - Math.exp(-(((x - g.W * 0.12) / (g.W * 0.14)) ** 2)) * g.H * 0.12;
  }

  // Fire points: the bar, then the left leg and the right leg, both leaving the bar's middle.
  function firePoints(g) {
    const s = g.H * 0.3;
    const top = g.H * 0.3;
    const foot = g.H * 0.64;
    const hub = top + g.H * 0.04;
    const strokes = [
      [g.cx - s * 1.05, top, g.cx + s * 1.05, top],
      [g.cx, top, g.cx - s * 1.0, foot],
      [g.cx + g.U * 0.5, hub, g.cx + s * 1.0, foot],
    ];
    const gap = g.H * 0.03;
    const pts = [];
    for (const [x0, y0, x1, y1] of strokes) {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / gap));
      for (let i = 0; i <= n; i++) pts.push(lerp(x0, x1, i / n), lerp(y0, y1, i / n));
    }
    return Float32Array.from(pts);
  }

  function paintSky(ctx, g, rand) {
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.city + 1);
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      const f = Math.min(1, y / (g.H * 0.62)) * (inks.length - 1);
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
    for (let i = 0; i < Math.round(g.W * g.H * 0.0012); i++) {
      const y = rand() * g.H * 0.4;
      ctx.fillStyle = rand() < 0.3 ? '#e6c259' : '#d8d4c4';
      ctx.globalAlpha = 0.25 + rand() * 0.55;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintRange(ctx, g, fn, fill, haze) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.city);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(g.W, g.city);
    ctx.fill();
    const grad = ctx.createLinearGradient(0, g.H * 0.3, 0, g.city);
    grad.addColorStop(0, 'rgba(74,58,92,0)');
    grad.addColorStop(1, haze);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function paintTrees(ctx, g, rand) {
    for (let y = g.H * 0.14; y < g.city; y += g.U * 1.3) {
      for (let x = 0; x < g.W; x += g.U * (1.4 + rand() * 1.2)) {
        if (y < ridge(g, x) + g.U * 0.8) continue;
        const r = g.U * (0.9 + rand() * 0.9);
        ctx.fillStyle = rand() < 0.5 ? '#141a36' : '#1f2750';
        blob(ctx, x, y, r, r * 0.65);
        if (rand() < 0.18) {
          ctx.fillStyle = '#2c3764';
          blob(ctx, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.25);
        }
      }
    }
  }

  function paintHalo(ctx, g, pts) {
    const r = g.U * 9;
    for (let i = 0; i < pts.length; i += 2) {
      const grad = ctx.createRadialGradient(pts[i], pts[i + 1], 0, pts[i], pts[i + 1], r);
      grad.addColorStop(0, 'rgba(190,92,50,0.5)');
      grad.addColorStop(1, 'rgba(176,84,48,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pts[i] - r, pts[i + 1] - r, r * 2, r * 2);
    }
  }

  // ---- the city ------------------------------------------------------------------

  function house(ctx, g, rand, x, base, w, h, lit) {
    ctx.fillStyle = '#0e1226';
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = '#3a4470';
    poly(ctx, [x - w * 0.2, base - h + 0.5, x + w * 0.2, base - h - h * 0.45, x + w * 0.8, base - h - h * 0.45, x + w * 1.2, base - h + 0.5]);
    ctx.fillStyle = '#4a5488';
    ctx.fillRect(x + w * 0.2, base - h - h * 0.45, w * 0.6, Math.max(1, g.U * 0.25));
    if (rand() < lit) {
      ctx.fillStyle = rand() < 0.5 ? '#e6c259' : '#c9893a';
      ctx.fillRect(Math.floor(x + w * (0.2 + rand() * 0.4)), Math.floor(base - h * 0.6), Math.max(1, Math.round(g.U * 0.55)), Math.max(1, Math.round(g.U * 0.5)));
    }
  }

  function pagoda(ctx, g, x, base, h) {
    const tiers = 5;
    const th = h / (tiers + 1);
    ctx.fillStyle = '#0e1226';
    ctx.fillRect(x - h * 0.06, base - h, h * 0.12, h);
    for (let i = 0; i < tiers; i++) {
      const w = h * (0.34 - i * 0.045);
      const y = base - th * (i + 0.6);
      ctx.fillStyle = '#0d1122';
      ctx.fillRect(x - w * 0.6, y - th * 0.7, w * 1.2, th * 0.7);
      ctx.fillStyle = '#3a4470';
      poly(ctx, [x - w * 1.25, y + 0.5, x - w * 0.5, y - th * 0.35, x + w * 0.5, y - th * 0.35, x + w * 1.25, y + 0.5]);
    }
    ctx.fillStyle = '#4a5488';
    ctx.fillRect(x - 0.5, base - h - h * 0.12, 1, h * 0.14);
  }

  function paintCity(ctx, g, rand) {
    ctx.fillStyle = '#080b16';
    ctx.fillRect(0, g.city, g.W, g.H - g.city + 1);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);
      const base = g.city + g.U * (2.5 + f * 8.5) + (g.H - g.city) * 0.06 * r;
      const size = g.U * (1 + f * 1.1);
      for (let x = -size; x < g.W + size; x += size * (3 + rand() * 2.6)) {
        if (r === 1 && Math.abs(x - g.W * 0.18) < size * 3) continue;
        house(ctx, g, rand, x, base, size * (3 + rand() * 1.8), size * (1.6 + rand() * 0.9), 0.35 + f * 0.25);
      }
      ctx.fillStyle = '#080b16';
      ctx.fillRect(0, base, g.W, g.U * 0.8);
      if (r === 1) pagoda(ctx, g, g.W * 0.18, base, g.U * 20);
    }
    // a river with a few lantern lights along it
    const ry = g.city + (g.H - g.city) * 0.5;
    ctx.fillStyle = '#10163a';
    ctx.fillRect(0, ry, g.W, g.U * 1.4);
    for (let x = 0; x < g.W; x += g.U * (3 + rand() * 3)) {
      ctx.fillStyle = '#c9893a';
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      ctx.fillRect(Math.floor(x), Math.floor(ry + g.U * 0.4), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintBack(g, pts, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintRange(ctx, g, farRidge, '#2c3260', 'rgba(110,80,100,0.45)');
    paintRange(ctx, g, ridge, '#1c2348', 'rgba(26,30,64,0.8)');
    paintTrees(ctx, g, rand);
    paintHalo(ctx, g, pts);
    paintCity(ctx, g, rand);
    return c;
  }

  // ---- sprites -------------------------------------------------------------------

  function radial(size, stops) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, col] of stops) grad.addColorStop(at, col);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function makeSprites() {
    state.flame = radial(32, [[0, 'rgba(247,224,154,1)'], [0.25, 'rgba(230,150,60,0.95)'], [0.6, 'rgba(214,69,44,0.5)'], [1, 'rgba(160,40,30,0)']]);
    state.puff = radial(32, [[0, 'rgba(120,124,150,0.9)'], [0.6, 'rgba(90,96,128,0.45)'], [1, 'rgba(70,76,108,0)']]);
    const wide = layer(Math.ceil(state.cloudW), Math.ceil(state.cloudH));
    const ctx = wide.getContext('2d');
    const rand = K.rng(71);
    ctx.fillStyle = 'rgba(40,44,82,0.55)';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * wide.width;
      const y = wide.height * (0.35 + rand() * 0.3);
      for (const ox of [0, -wide.width]) blob(ctx, x + ox + (rand() - 0.5) * 8, y, wide.width * (0.04 + rand() * 0.05), wide.height * (0.1 + rand() * 0.12));
    }
    state.clouds = wide;
  }

  // ---- motion --------------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 0.5) % c.width);
    ctx.drawImage(c, off, g.H * 0.06);
    ctx.drawImage(c, off + c.width, g.H * 0.06);
  }

  function drawFires(ctx, g, t, amount) {
    const pts = state.pts;
    const base = g.U * 3.8 * Math.sqrt(amount);
    for (let i = 0, n = 0; i < pts.length; i += 2, n++) {
      const ph = n * 2.399;
      const f = 0.5 + 0.5 * Math.sin(t * (3.1 + (n % 5) * 0.37) + ph) * Math.sin(t * 1.3 + ph * 1.7);
      const s = base * (0.8 + 0.4 * f);
      ctx.globalAlpha = Math.min(1, 0.62 + 0.38 * f);
      ctx.drawImage(state.flame, pts[i] - s / 2, pts[i + 1] - s * 0.8, s, s * 1.35);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t, amount) {
    const count = Math.min(MAX_SMOKE, Math.round(MAX_SMOKE * Math.min(1, amount)));
    const nf = state.pts.length / 2;
    for (let i = 0; i < count; i++) {
      const q = t / SMOKE_LIFE + i / MAX_SMOKE;
      const cyc = Math.floor(q);
      const a = q - cyc;
      const src = ((i * 7 + cyc * 13) % nf) * 2;
      const rise = a * g.H * 0.3;
      const sway = Math.sin(a * 5 + i) * g.U * 1.2;
      const s = g.U * (3 + a * 12);
      ctx.globalAlpha = Math.min(1, amount) * 0.42 * smoothstep(0, 0.12, a) * (1 - a);
      ctx.drawImage(state.puff, state.pts[src] + a * g.W * 0.12 + sway - s / 2, state.pts[src + 1] - rise - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawSparks(ctx, g, t, amount) {
    const count = Math.min(MAX_SPARKS, Math.round(MAX_SPARKS * Math.min(1, amount)));
    const nf = state.pts.length / 2;
    ctx.fillStyle = '#f7e09a';
    for (let i = 0; i < count; i++) {
      const q = t / SPARK_LIFE + i / MAX_SPARKS;
      const cyc = Math.floor(q);
      const a = q - cyc;
      const src = ((i * 11 + cyc * 17) % nf) * 2;
      const x = state.pts[src] + a * g.U * 7 + Math.sin(a * 9 + i * 2) * g.U * 0.9;
      const y = state.pts[src + 1] - a * g.H * 0.17 - g.U;
      ctx.globalAlpha = (1 - a) * smoothstep(0, 0.1, a) * 0.9;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.cloudW = g.W * 1.4;
    state.cloudH = g.H * 0.22;
    state.pts = firePoints(g);
    makeSprites();
    state.back = paintBack(g, state.pts, K.rng(api.seed || 5));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fire, smoke, sparks } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawFires(ctx, g, t, fire);
    if (smoke > 0) drawSmoke(ctx, g, t, smoke);
    if (sparks > 0) drawSparks(ctx, g, t, sparks);
  }

  Kasuri.run({
    defaults: { fire: 1, smoke: 1, sparks: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
