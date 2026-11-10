/*
 * 木版 Mokuhan — woodblock hills in flat colour.
 *
 * Sky, sun and five ridges of cedar are each baked once into their own layer.
 * Mist is a tiling strip drawn between the ridges at different speeds and
 * directions; a thinner strip of high haze slides across the sky.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SKY = ['#9fadb2', '#b7bfb8', '#d0cdb8', '#e2d8bc', '#ebdfc6'];
  const SUN = '#d6452c';
  const WASHI = [236, 228, 208];
  const RIDGES = [
    { y: 0.5, h: 5, a: '#8fa1b0', b: '#7d91a3', amp: 0.11, seed: 3 },
    { y: 0.58, h: 8, a: '#6d869b', b: '#5a748b', amp: 0.09, seed: 7 },
    { y: 0.66, h: 10, a: '#5f7656', b: '#4c6246', amp: 0.06, seed: 13 },
    { y: 0.78, h: 15, a: '#3f5340', b: '#30443a', amp: 0.05, seed: 19 },
    { y: 0.92, h: 24, a: '#27374a', b: '#1d2b3c', amp: 0.04, seed: 29 },
  ];
  const MAPLES = ['#c0452c', '#d6652f', '#c9973a'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    return { W, H, U: H / 100, sunX: W * 0.68, sunY: H * 0.25, sunR: H * 0.11 };
  }

  function ridgeY(g, r, x) {
    return g.H * r.y + (fbm(x / (g.U * 32), r.seed, 4, r.seed * 3) - 0.5) * g.H * r.amp * 2;
  }

  // ---- sky and sun ---------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const f = (i / (bands - 1)) * (SKY.length - 1);
      const k = Math.min(SKY.length - 2, Math.floor(f));
      const a = K.parseColor(SKY[k]);
      const b = K.parseColor(SKY[k + 1]);
      const m = f - k;
      ctx.fillStyle = 'rgb(' + Math.round(lerp(a[0], b[0], m)) + ',' + Math.round(lerp(a[1], b[1], m)) + ',' + Math.round(lerp(a[2], b[2], m)) + ')';
      const y0 = Math.floor((i / bands) * g.H * 0.8);
      const y1 = Math.ceil(((i + 1) / bands) * g.H * 0.8);
      ctx.fillRect(0, y0, g.W, y1 - y0 + 1);
    }
    ctx.fillStyle = SKY[4];
    ctx.fillRect(0, g.H * 0.8, g.W, g.H * 0.2 + 1);
    ctx.fillStyle = '#e5b9a0';
    ctx.beginPath();
    ctx.arc(g.sunX, g.sunY, g.sunR * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.arc(g.sunX, g.sunY, g.sunR, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  // ---- trees ---------------------------------------------------------------

  // A cedar of three stacked skirts; the right half is the darker block of the print.
  function cedar(ctx, x, y, h, a, b) {
    ctx.fillStyle = b;
    ctx.fillRect(x - Math.max(0.5, h * 0.03), y - h * 0.15, Math.max(1, h * 0.06), h * 0.18);
    for (let k = 0; k < 3; k++) {
      const ty = y - h + k * h * 0.27;
      const by = ty + h * 0.44;
      const hw = h * (0.13 + 0.07 * k);
      ctx.fillStyle = a;
      poly(ctx, [x, ty, x - hw, by, x, by]);
      ctx.fillStyle = b;
      poly(ctx, [x, ty, x + hw, by, x, by]);
    }
  }

  function maple(ctx, x, y, h, rand) {
    const r = h * 0.4;
    ctx.fillStyle = '#3b2c24';
    ctx.fillRect(x - Math.max(0.5, h * 0.04), y - h * 0.4, Math.max(1, h * 0.08), h * 0.42);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = MAPLES[Math.min(2, Math.floor(rand() * 3))];
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * r, y - h * 0.62 + (rand() - 0.5) * r * 0.7, r * (0.5 + rand() * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function pagoda(ctx, x, y, s, a, b) {
    ctx.fillStyle = a;
    ctx.fillRect(x - s * 0.5, y - s * 0.7, s, s * 0.7);
    for (let i = 0; i < 5; i++) {
      const w = s * (2.3 - i * 0.3);
      const ty = y - s * (1.0 + i * 1.05);
      ctx.fillStyle = a;
      poly(ctx, [x - w * 0.5, ty, x - w * 0.3, ty - s * 0.38, x + w * 0.3, ty - s * 0.38, x + w * 0.5, ty]);
      ctx.fillStyle = b;
      poly(ctx, [x, ty - s * 0.38, x + w * 0.3, ty - s * 0.38, x + w * 0.5, ty, x, ty]);
      ctx.fillStyle = a;
      ctx.fillRect(x - s * 0.28, ty, s * 0.56, s * 0.7);
    }
    ctx.fillRect(x - s * 0.06, y - s * 7, s * 0.12, s * 1.8);
  }

  function paintRidge(g, r, idx) {
    const rand = K.rng(r.seed * 101 + 5);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = r.a;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeY(g, r, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const th = g.U * r.h;
    if (idx === 1) pagoda(ctx, g.W * 0.2, ridgeY(g, r, g.W * 0.2) + g.U * 0.6, g.U * 2.1, r.b, r.a);
    for (let x = -th * 0.3; x < g.W + th; x += th * (idx < 2 ? 0.9 : 0.34) * (1 + rand() * 0.8)) {
      const y = ridgeY(g, r, x) + th * 0.12;
      const h = th * (0.7 + rand() * 0.6);
      if (idx >= 2 && idx <= 3 && rand() < 0.14) maple(ctx, x, y, h * 0.85, rand);
      else cedar(ctx, x, y, h, r.a, r.b);
    }
    // a second, lower row on the nearer ridges fills the slope
    if (idx >= 2) {
      for (let x = 0; x < g.W; x += th * (0.5 + rand() * 0.4)) {
        const y = ridgeY(g, r, x) + th * (0.7 + rand() * 0.5);
        cedar(ctx, x, y, th * (0.8 + rand() * 0.5), r.b, r.a);
      }
    }
    return c;
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g, tall, seed, grain) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(tall);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * grain), y / (g.U * 3.5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.42, 0.66, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = WASHI[0];
        img.data[i + 1] = WASHI[1];
        img.data[i + 2] = WASHI[2];
        img.data[i + 3] = a * 215;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function strip(ctx, img, x, y) {
    const w = img.width;
    const o = ((x % w) + w) % w;
    ctx.drawImage(img, -o, y);
    ctx.drawImage(img, w - o, y);
  }

  // ---- run -----------------------------------------------------------------

  const BANDS = [
    { ridge: 1, dir: 1, v: 0.9, ph: 0.1, k: 0.9 },
    { ridge: 2, dir: -1, v: 1.3, ph: 0.5, k: 1 },
    { ridge: 3, dir: 1, v: 1.7, ph: 0.8, k: 0.9 },
    { ridge: 4, dir: -1, v: 2.2, ph: 0.3, k: 0.8 },
  ];

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.sky = paintSky(g);
    state.ridges = RIDGES.map((r, i) => paintRidge(g, r, i));
    state.mist = paintMist(g, g.H * 0.16, 77, 16);
    state.haze = paintMist(g, g.H * 0.09, 31, 26);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, haze } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    if (haze > 0) {
      ctx.globalAlpha = Math.min(1, haze * 0.8);
      strip(ctx, state.haze, t * g.U * 0.5, g.H * 0.16);
      strip(ctx, state.haze, -t * g.U * 0.35 + state.haze.width * 0.5, g.H * 0.36);
      ctx.globalAlpha = 1;
    }
    const mh = state.mist.height;
    for (let i = 0; i < RIDGES.length; i++) {
      ctx.drawImage(state.ridges[i], 0, 0);
      const b = BANDS[i];
      if (!b || mist <= 0) continue;
      ctx.globalAlpha = Math.min(1, mist * b.k);
      const y = g.H * RIDGES[b.ridge].y - mh * 0.6 + Math.sin(t * 0.15 + b.ph * 6) * g.U * 0.6;
      strip(ctx, state.mist, b.dir * t * g.U * b.v + state.mist.width * b.ph, y);
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { mist: 1, haze: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
