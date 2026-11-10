/*
 * 青い池 Aoiike — a milky turquoise pond with bare larch trunks standing in it.
 *
 * Sky, snow peak, dark forest and trunks are baked once. The pond is that world
 * flipped and laid back in thin rows that slide sideways. Mist is one tiling
 * strip, ripples are a few rings at the trunk feet, snow is a short pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.5;
  const ROWS_STEP = 2;
  const MAX_SNOW = 50;
  const SKY = ['#8c9db0', '#a9b4bd', '#c9ccc6', '#e2dfd0'];
  const WATER_TOP = '#7fb3ad';
  const WATER_LOW = '#3f7f84';
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
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  // ---- sky and peak ----------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
  }

  function ridgeY(g, x, px, top, half) {
    const d = Math.abs(x - px) / half;
    const base = g.wy - g.U * 6;
    const shape = Math.pow(Math.max(0, 1 - d), 1.35);
    return base - (base - top) * shape + (fbm(x * 0.05, 3, 3, 7) - 0.5) * g.U * 2.2;
  }

  function paintPeak(ctx, g) {
    const px = g.W * 0.66;
    const top = g.H * 0.11;
    const half = g.W * 0.36;
    const x0 = Math.max(0, Math.floor(px - half));
    const x1 = Math.min(g.W, Math.ceil(px + half));
    const y0 = Math.floor(top - g.U * 3);
    const h = g.wy - y0;
    const img = ctx.getImageData(x0, y0, x1 - x0, h);
    const w = x1 - x0;
    const rock = K.parseColor('#6f7f96');
    const snow = K.parseColor('#f1f1ea');
    const shadow = K.parseColor('#b6c0cf');
    for (let x = 0; x < w; x++) {
      const ry = ridgeY(g, x0 + x, px, top, half);
      for (let y = Math.max(0, Math.floor(ry - y0)); y < h; y++) {
        const f = (y + y0 - top) / (g.wy - top);
        const gully = fbm((x0 + x) * 0.2, (y + y0) * 0.02, 3, 9);
        const line = 0.5 + (gully - 0.5) * 0.5;
        const side = (x0 + x) > px ? 0.88 : 1;
        let c = f < line ? (gully > 0.62 ? shadow : snow) : rock;
        if (f >= line) c = K.mixColor(c, K.parseColor('#c9ccc6'), smoothstep(0.75, 1, f) * 0.7);
        const i = (y * w + x) * 4;
        img.data[i] = c[0] * side;
        img.data[i + 1] = c[1] * side;
        img.data[i + 2] = c[2] * side;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  // ---- forest and shore ------------------------------------------------------

  function fir(ctx, x, base, h, w, ink) {
    ctx.fillStyle = ink;
    poly(ctx, [x, base - h, x + w * 0.5, base, x - w * 0.5, base]);
    poly(ctx, [x, base - h * 0.78, x + w * 0.62, base - h * 0.2, x - w * 0.62, base - h * 0.2]);
  }

  function paintForest(ctx, g, rand) {
    const base = g.wy;
    const haze = ctx.createLinearGradient(0, base - g.U * 12, 0, base);
    haze.addColorStop(0, 'rgba(201,204,198,0.9)');
    haze.addColorStop(1, 'rgba(201,204,198,0)');
    ctx.fillStyle = '#7d8c85';
    for (let x = -g.U * 2; x < g.W + g.U * 2; x += g.U * 1.4) {
      fir(ctx, x, base + 1, g.U * (6 + rand() * 5), g.U * (2.4 + rand() * 1.2), '#7d8c85');
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, base - g.U * 12, g.W, g.U * 12);
    for (let x = -g.U * 2; x < g.W + g.U * 2; x += g.U * 1.9) {
      const bump = fbm(x * 0.02, 1, 3, 3);
      fir(ctx, x, base + 1, g.U * (7 + bump * 8 + rand() * 4), g.U * (3 + rand() * 1.5), '#2f4636');
    }
    ctx.fillStyle = '#26382d';
    ctx.fillRect(0, base - g.U * 0.6, g.W, g.U * 0.8);
  }

  // ---- larch trunks ----------------------------------------------------------

  function trunk(ctx, g, rand, x, base, h, w) {
    const lean = (rand() - 0.5) * w * 1.6;
    ctx.fillStyle = '#2b2a27';
    poly(ctx, [x - w / 2, base, x - w * 0.22 + lean, base - h, x + w * 0.22 + lean, base - h, x + w / 2, base]);
    ctx.fillStyle = '#4a463e';
    poly(ctx, [x - w * 0.08, base, x + lean * 0.9 - w * 0.02, base - h, x + lean + w * 0.18, base - h, x + w * 0.16, base]);
    ctx.strokeStyle = '#2b2a27';
    ctx.lineCap = 'round';
    const limbs = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < limbs; i++) {
      const f = 0.3 + (i / limbs) * 0.68;
      const sx = x + lean * f;
      const sy = base - h * f;
      const dir = i % 2 ? 1 : -1;
      const len = g.U * (2.2 + rand() * 3.2) * (1.15 - f * 0.6);
      const ex = sx + dir * len;
      const ey = sy - len * (0.5 + rand() * 0.7);
      ctx.lineWidth = Math.max(1, w * 0.18);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + dir * len * 0.4, sy - len * 0.1, ex, ey);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, w * 0.1);
      ctx.beginPath();
      ctx.moveTo(lerp(sx, ex, 0.6), lerp(sy, ey, 0.6));
      ctx.lineTo(ex + dir * len * 0.3, ey - len * 0.35);
      ctx.stroke();
    }
  }

  const TRUNKS = [
    [0.1, 0.72, 52, 1.6],
    [0.19, 0.64, 40, 1.2],
    [0.31, 0.7, 62, 1.9],
    [0.44, 0.6, 34, 1.0],
    [0.52, 0.76, 58, 1.7],
    [0.62, 0.66, 44, 1.3],
    [0.74, 0.74, 66, 2.0],
    [0.83, 0.62, 38, 1.1],
    [0.92, 0.7, 50, 1.5],
  ];

  function paintTrunks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const [fx, fy, h, w] of TRUNKS) {
      trunk(ctx, g, rand, g.W * fx, g.H * fy, g.U * h, g.U * w);
    }
    return c;
  }

  // ---- water -----------------------------------------------------------------

  function paintWater(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.wy, 0, g.H);
    grad.addColorStop(0, WATER_TOP);
    grad.addColorStop(1, WATER_LOW);
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    // pale milky patches near the middle of the pond
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      const y = g.wy + (g.H - g.wy) * (0.1 + rand() * 0.7);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, g.U * 14);
      rg.addColorStop(0, 'rgba(176,222,214,0.35)');
      rg.addColorStop(1, 'rgba(176,222,214,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - g.U * 14, y - g.U * 14, g.U * 28, g.U * 28);
    }
    return c;
  }

  // The whole above-water world flipped, so rows can be copied from it.
  function paintMirror(g, back, trunks) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, g.wy * 2);
    ctx.scale(1, -1);
    ctx.drawImage(back, 0, 0);
    ctx.drawImage(trunks, 0, 0);
    ctx.restore();
    return c;
  }

  function drawWater(ctx, g, t, ripple) {
    ctx.drawImage(state.water, 0, 0);
    const m = state.mirror;
    const amp = g.U * 0.9 * Math.min(1, 0.2 + ripple);
    ctx.globalAlpha = 0.4;
    for (let y = g.wy; y < g.H; y += ROWS_STEP) {
      const d = (y - g.wy) / (g.H - g.wy);
      const dx = Math.sin(y * 0.35 + t * 0.9) * amp * (0.3 + d) + Math.sin(y * 0.11 - t * 0.5) * amp * 0.5;
      ctx.drawImage(m, 0, y, g.W, ROWS_STEP, dx, y, g.W, ROWS_STEP);
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx, g, t, ripple) {
    if (ripple <= 0) return;
    ctx.strokeStyle = '#d6ece6';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let i = 0; i < TRUNKS.length; i++) {
      const ph = ((t * 0.25 + i * 0.37) % 1);
      const r = g.U * (1 + ph * 6) * (0.7 + TRUNKS[i][3] * 0.3);
      ctx.globalAlpha = 0.5 * (1 - ph) * Math.min(1, ripple);
      ctx.beginPath();
      ctx.ellipse(g.W * TRUNKS[i][0], g.H * TRUNKS[i][1] + g.U * 0.4, r, r * 0.22, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist ------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4.5), 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 236;
        img.data[i + 2] = 230;
        img.data[i + 3] = a * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const rows = [[g.wy - g.H * 0.13, 1.0, 0.9], [g.wy + g.H * 0.04, 0.6, 0.55], [g.wy + g.H * 0.2, 0.4, 0.3]];
    for (let i = 0; i < rows.length; i++) {
      const [y, v, a] = rows[i];
      const o = (t * g.U * v + w * i * 0.33) % w;
      ctx.globalAlpha = Math.min(1, mist * a);
      ctx.drawImage(m, -o, y);
      ctx.drawImage(m, w - o, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- snow ------------------------------------------------------------------

  function makeSnow(g, rand) {
    const f = () => new Float32Array(MAX_SNOW);
    const S = { x: f(), y: f(), v: f(), p: f(), s: f() };
    for (let i = 0; i < MAX_SNOW; i++) {
      S.x[i] = rand() * g.W;
      S.y[i] = rand() * g.H;
      S.v[i] = g.U * (2 + rand() * 2.5);
      S.p[i] = rand() * TAU;
      S.s[i] = Math.max(1, g.U * (0.25 + rand() * 0.3));
    }
    return S;
  }

  function drawSnow(ctx, g, t, dt) {
    const S = state.snow;
    ctx.fillStyle = '#f4f4ee';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < MAX_SNOW; i++) {
      S.y[i] += S.v[i] * dt;
      S.x[i] += Math.sin(t * 0.8 + S.p[i]) * g.U * 0.8 * dt;
      if (S.y[i] > g.H) {
        S.y[i] = -2;
        S.x[i] = state.rand() * g.W;
      }
      ctx.fillRect(S.x[i], S.y[i], S.s[i], S.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g);
    paintPeak(bctx, g);
    paintForest(bctx, g, rand);
    const trunks = paintTrunks(g, rand);
    state.g = g;
    state.rand = rand;
    state.back = back;
    state.trunks = trunks;
    state.water = paintWater(g, rand);
    state.mirror = paintMirror(g, back, trunks);
    state.mist = paintMist(g);
    state.snow = makeSnow(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, ripple, snow } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawRings(ctx, g, t, ripple);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.trunks, 0, 0);
    if (snow) drawSnow(ctx, g, t, Math.min(dt, 0.1));
  }

  Kasuri.run({
    defaults: { mist: 1, ripple: 1, snow: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
