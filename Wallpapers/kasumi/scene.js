/*
 * 霞 Kasumi — spring haze over layered hills.
 *
 * Five ridges are baked once, far to near, each already veiled in pale haze.
 * Cherry trees and pines sit along them and a pagoda roof rises from the
 * middle hill. Between the ridges, strips of mist slide sideways and swell
 * and thin slowly, so the trees come and go. A few petals drift down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const LAYERS = 5;
  const PAGODA_LAYER = 2;
  const MAX_PETALS = 36;
  const PETALS = 18;
  const WASHI = '#e8e0cb';
  const SKY = ['#cfd2cc', '#dcdacb', '#ebe3cd'];
  const HILL = ['#7f8b96', '#6c7c80', '#566a62', '#445a4a', '#34493a'];
  const HILL_LIGHT = ['#8e99a2', '#7d8c8d', '#687c70', '#566e58', '#46604a'];
  const PINE = ['#5d6e68', '#4c6258', '#3c5646', '#2d4636', '#233a2c'];
  const BLOOM = [['#d6b6ae', '#e6cfc4'], ['#cfa49c', '#e1c3b8'], ['#c4948a', '#d9b4a8'], ['#b9857a', '#d0a79a'], ['#ad7a70', '#c79c90']];
  const HAZE = [0.62, 0.5, 0.36, 0.2, 0.06];
  const ROOF = { slope: '#3a3431', edge: '#27221f', wall: '#a9483a', wallDark: '#7c3a30', gold: '#c9a24c' };
  const PETAL_TONES = ['#e6cfc4', '#d9b4a8', '#efe3d2'];
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
    return { W, H, U, px: W * 0.68 };
  }

  function ridgeY(g, i, x) {
    const base = g.H * (0.34 + 0.115 * i);
    const bump = Math.exp(-(((x - g.px) / (g.U * 22)) ** 2)) * g.U * (i === PAGODA_LAYER ? 5 : 0);
    return base + (fbm(x / (g.U * (34 - i * 3)), i * 3.1, 3, 11 + i) - 0.5) * g.H * (0.13 - i * 0.008) - bump;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, SKY[0]);
    grad.addColorStop(0.55, SKY[1]);
    grad.addColorStop(1, SKY[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#ecd9a6';
    ctx.globalAlpha = 0.5;
    blob(ctx, g.W * 0.27, g.H * 0.2, g.U * 9, g.U * 9);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#f0dfae';
    blob(ctx, g.W * 0.27, g.H * 0.2, g.U * 5.5, g.U * 5.5);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- trees -------------------------------------------------------------

  function bloom(ctx, x, y, r, tones) {
    ctx.fillStyle = tones[0];
    blob(ctx, x, y, r, r * 0.8);
    blob(ctx, x - r * 0.7, y + r * 0.2, r * 0.6, r * 0.5);
    blob(ctx, x + r * 0.7, y + r * 0.25, r * 0.6, r * 0.5);
    ctx.fillStyle = tones[1];
    blob(ctx, x - r * 0.2, y - r * 0.25, r * 0.55, r * 0.4);
    blob(ctx, x + r * 0.45, y - r * 0.05, r * 0.3, r * 0.22);
  }

  function pine(ctx, x, y, r, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(x - Math.max(0.5, r * 0.07), y - r * 0.2, Math.max(1, r * 0.14), r * 0.9);
    blob(ctx, x, y - r * 0.3, r * 0.9, r * 0.38);
    blob(ctx, x + r * 0.1, y - r * 0.7, r * 0.65, r * 0.3);
    blob(ctx, x - r * 0.05, y - r * 1.05, r * 0.4, r * 0.22);
  }

  function trees(ctx, g, rand, i) {
    const size = g.U * (0.9 + i * 0.55);
    for (let row = 0; row < 3; row++) {
      const dy = row * size * 0.9;
      for (let x = -size; x < g.W + size; ) {
        const r = size * (0.8 + rand() * 0.6);
        const y = ridgeY(g, i, x) + dy + r * 0.25;
        const pink = fbm(x / (g.U * 12), row * 2.7 + i * 5, 3, 51) > 0.47;
        if (pink) bloom(ctx, x, y, r, BLOOM[i]);
        else if (row < 2 || rand() < 0.5) pine(ctx, x, y + r * 0.2, r * 1.1, PINE[i]);
        x += r * (1.2 + rand() * 0.8);
      }
    }
  }

  // ---- pagoda ------------------------------------------------------------

  function roofTier(ctx, g, cx, yt, w, h) {
    const lift = h * 0.55;
    const top = [];
    const under = [];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      const s = f * 2 - 1;
      const a = Math.abs(s);
      top.push(cx + s * w, yt + h * Math.pow(a, 1.5) - lift * smoothstep(0.78, 1, a));
    }
    for (let k = 16; k >= 0; k--) {
      const s = (k / 16) * 2 - 1;
      const a = Math.abs(s);
      under.push(cx + s * w * 0.96, yt + h * 1.08 - lift * 0.9 * smoothstep(0.82, 1, a));
    }
    ctx.fillStyle = ROOF.slope;
    poly(ctx, top.concat(under));
    ctx.fillStyle = ROOF.edge;
    ctx.fillRect(cx - w * 0.9, yt + h * 1.02, w * 1.8, Math.max(1, h * 0.14));
  }

  function pagoda(ctx, g, cx, yTop) {
    const u = g.U * 1.45;
    const tiers = 3;
    let y = yTop;
    ctx.fillStyle = ROOF.gold;
    ctx.fillRect(cx - Math.max(0.5, u * 0.18), y - u * 5.5, Math.max(1, u * 0.36), u * 5.6);
    for (let k = 0; k < 4; k++) blob(ctx, cx, y - u * (1.2 + k * 1.05), u * (0.8 - k * 0.12), u * 0.28);
    for (let t = 0; t < tiers; t++) {
      const w = u * (5.2 + t * 2.3);
      const h = u * 2.6;
      roofTier(ctx, g, cx, y, w, h);
      y += h * 1.1;
      const ww = w * 0.58;
      const wh = u * 3.4;
      ctx.fillStyle = ROOF.wall;
      ctx.fillRect(cx - ww, y, ww * 2, wh);
      ctx.fillStyle = ROOF.wallDark;
      for (let p = 0; p <= 4; p++) ctx.fillRect(cx - ww + (p / 4) * (ww * 2 - u * 0.5), y, Math.max(1, u * 0.5), wh);
      ctx.fillRect(cx - ww, y + wh * 0.5, ww * 2, Math.max(1, u * 0.35));
      y += wh;
    }
  }

  // ---- ridges ------------------------------------------------------------

  function paintLayer(g, rand, i) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    if (i === PAGODA_LAYER) pagoda(ctx, g, g.px, ridgeY(g, i, g.px) - g.U * 17);
    const grad = ctx.createLinearGradient(0, g.H * (0.3 + 0.115 * i), 0, g.H);
    grad.addColorStop(0, HILL_LIGHT[i]);
    grad.addColorStop(1, HILL[i]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeY(g, i, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    trees(ctx, g, rand, i);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = HAZE[i];
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(g, seed) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 18), y / (g.U * 5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.3, 0.62, v) * band * 5) / 5;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 230;
        img.data[i + 2] = 214;
        img.data[i + 3] = a * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- petals ------------------------------------------------------------

  function makePetals(g, rand) {
    const f = () => new Float32Array(MAX_PETALS);
    const P = { x: f(), y: f(), vy: f(), vx: f(), a: f(), p: f(), s: f(), tone: f() };
    for (let i = 0; i < MAX_PETALS; i++) {
      resetPetal(g, P, i, rand);
      P.y[i] = rand() * g.H;
    }
    return P;
  }

  function resetPetal(g, P, i, rand) {
    P.x[i] = rand() * g.W * 1.1;
    P.y[i] = -g.U * 2;
    P.vy[i] = g.U * (2.2 + rand() * 1.8);
    P.vx[i] = g.U * (0.8 + rand() * 1.2);
    P.a[i] = rand() * TAU;
    P.p[i] = rand() * TAU;
    P.s[i] = g.U * (0.8 + rand() * 0.6);
    P.tone[i] = Math.floor(rand() * PETAL_TONES.length);
  }

  function drawPetals(ctx, g, t, dt, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      P.y[i] += P.vy[i] * dt;
      P.x[i] += (P.vx[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 1.6) * dt;
      P.a[i] += dt * 1.2;
      if (P.y[i] > g.H + g.U * 2 || P.x[i] > g.W + g.U * 2) resetPetal(g, P, i, state.rand);
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.4 + P.p[i]));
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.setTransform(c, s * sq, -s, c * sq, P.x[i], P.y[i]);
      ctx.fillRect(-P.s[i] / 2, -P.s[i] * 0.3, P.s[i], P.s[i] * 0.6);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.sky = paintSky(g);
    state.layers = [];
    for (let i = 0; i < LAYERS; i++) state.layers.push(paintLayer(g, rand, i));
    state.mists = [paintMist(g, 77), paintMist(g, 91), paintMist(g, 123), paintMist(g, 140)];
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { haze, petals } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    for (let i = 0; i < LAYERS; i++) {
      ctx.drawImage(state.layers[i], 0, 0);
      if (i < LAYERS - 1) {
        const m = state.mists[i];
        const w = m.width;
        const dir = i % 2 ? -1 : 1;
        const a = (((t * g.U * (0.9 + i * 0.35) * dir) % w) + w) % w;
        const y = ridgeY(g, i + 1, g.W * (0.3 + 0.15 * i)) - g.H * 0.09;
        ctx.globalAlpha = Math.min(1, haze * (0.62 + 0.38 * Math.sin(t * 0.17 + i * 1.9)));
        if (haze > 0) {
          ctx.drawImage(m, -a, y);
          ctx.drawImage(m, w - a, y);
        }
        ctx.globalAlpha = 1;
      }
    }
    drawPetals(ctx, g, t, Math.min(dt, 0.1), Math.min(MAX_PETALS, Math.round(PETALS * petals)));
  }

  Kasuri.run({
    defaults: { haze: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
