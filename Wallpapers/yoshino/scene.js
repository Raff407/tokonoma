/*
 * 吉野 Yoshino — mountainsides in cherry blossom, mist between the ridges.
 *
 * Sky, five ridges, the temple hall and the pagoda are baked once. Mist is a
 * tiling strip per gap between ridges, sliding at its own pace. Petals are a
 * short reused pool blowing across and down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  // Ridge base heights as screen fractions, far to near.
  const BASES = [0.40, 0.49, 0.585, 0.70, 0.84];
  const AMPS = [0.09, 0.08, 0.07, 0.06, 0.05];
  const HALL_RIDGE = 2;
  const HALL_X = 0.64;
  const PAGODA_X = 0.30;
  const PINKS = [
    ['#d9ccd0', '#cdbcc4', '#e2d6d6'],
    ['#e8c0bd', '#dca7aa', '#efd0cb'],
    ['#dfa9ac', '#d19198', '#e8bcbb'],
    ['#d398a1', '#c27f89', '#dda9ae'],
    ['#b97883', '#a5666f', '#c78f95'],
  ];
  const GREENS = ['#7d8a6c', '#6f7d5e', '#62704f', '#4f5e43', '#3f4d37'];
  const MAX_PETALS = 90;
  const PETAL_BASE = 45;
  const MIST_BANDS = [0.43, 0.535, 0.645, 0.775];
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

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, '#c9ccd2');
    grad.addColorStop(0.5, '#ebe3d6');
    grad.addColorStop(1, '#f3e4d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // A pale low sun behind the haze.
    const sun = ctx.createRadialGradient(g.W * 0.2, g.H * 0.22, 0, g.W * 0.2, g.H * 0.22, g.U * 22);
    sun.addColorStop(0, 'rgba(246,226,190,0.8)');
    sun.addColorStop(1, 'rgba(246,226,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, g.W, g.H * 0.6);
    ctx.fillStyle = '#f2dcc0';
    blob(ctx, g.W * 0.2, g.H * 0.22, g.U * 4.5, g.U * 4.5);
    return c;
  }

  // ---- ridges ------------------------------------------------------------

  function ridgeY(g, i, x) {
    const n = fbm((x / g.W) * (2.4 + i * 0.5) + i * 3.1, i * 5.7, 3, 40 + i);
    let y = g.H * BASES[i] + (n - 0.5) * 2 * g.H * AMPS[i] * 1.9;
    if (i === HALL_RIDGE) {
      const shelf = g.H * BASES[i] - g.U * 1.5;
      const hx = g.W * HALL_X;
      const near = 1 - smoothstep(g.U * 18, g.U * 40, Math.abs(x - hx));
      const px = g.W * PAGODA_X;
      const nearP = 1 - smoothstep(g.U * 8, g.U * 20, Math.abs(x - px));
      y = lerp(y, shelf, Math.max(near, nearP));
    }
    return y;
  }

  function paintRidge(g, i, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ys = new Float32Array(g.W + 1);
    for (let x = 0; x <= g.W; x++) ys[x] = ridgeY(g, i, x);
    const pal = PINKS[i];
    const grad = ctx.createLinearGradient(0, g.H * (BASES[i] - AMPS[i]), 0, g.H * (BASES[i] + 0.2));
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x++) ctx.lineTo(x, ys[x]);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    const scale = 0.6 + i * 0.35;
    const count = Math.round(g.W * (0.9 + i * 0.5));
    // Cedar and pine dark patches first, then blossom clouds over them.
    ctx.fillStyle = GREENS[i];
    ctx.globalAlpha = 0.75;
    for (let k = 0; k < count * 0.5; k++) {
      const x = rand() * g.W;
      const y = ys[Math.floor(x)] + rand() * g.H * (0.1 + i * 0.03);
      blob(ctx, x, y, g.U * 0.5 * scale, g.U * 1.1 * scale);
    }
    ctx.globalAlpha = 1;
    for (let k = 0; k < count; k++) {
      const x = rand() * g.W;
      const y = ys[Math.floor(x)] + rand() * rand() * g.H * (0.12 + i * 0.04) - g.U * 0.3;
      ctx.fillStyle = pal[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.85;
      blob(ctx, x, y, g.U * (0.7 + rand() * 1.2) * scale, g.U * (0.5 + rand() * 0.8) * scale);
    }
    ctx.globalAlpha = 1;
    return { canvas: c, ys };
  }

  // ---- temple ------------------------------------------------------------

  // A roof with up-turned corners: ridge on top, eaves swept out at the ends.
  function paintRoof(ctx, cx, y, topHalf, eaveHalf, h, ink, edge) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - topHalf, y - h);
    ctx.lineTo(cx + topHalf, y - h);
    ctx.quadraticCurveTo(cx + eaveHalf * 0.8, y - h * 0.15, cx + eaveHalf, y - h * 0.35);
    ctx.lineTo(cx + eaveHalf * 0.96, y);
    ctx.quadraticCurveTo(cx, y + h * 0.12, cx - eaveHalf * 0.96, y);
    ctx.lineTo(cx - eaveHalf, y - h * 0.35);
    ctx.quadraticCurveTo(cx - eaveHalf * 0.8, y - h * 0.15, cx - topHalf, y - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = edge;
    ctx.fillRect(cx - eaveHalf * 0.95, y - h * 0.08, eaveHalf * 1.9, Math.max(1, h * 0.1));
    ctx.fillStyle = ink;
    ctx.fillRect(cx - topHalf - 0.5, y - h - h * 0.12, topHalf * 2 + 1, Math.max(1, h * 0.14));
  }

  function paintHall(ctx, g, x, base) {
    const u = g.U;
    const half = u * 15;
    const ink = '#2f3140';
    const edge = '#4a4d5e';
    // Stone base and steps.
    ctx.fillStyle = '#9b958a';
    ctx.fillRect(x - half * 0.9, base - u * 1.2, half * 1.8, u * 1.4);
    // Walls in washi with vermilion pillars.
    ctx.fillStyle = '#e9e1cf';
    ctx.fillRect(x - half * 0.78, base - u * 6.2, half * 1.56, u * 5.2);
    ctx.fillStyle = '#c9452c';
    const posts = 7;
    for (let p = 0; p < posts; p++) {
      const px = lerp(x - half * 0.78, x + half * 0.78, p / (posts - 1));
      ctx.fillRect(px - u * 0.28, base - u * 6.2, u * 0.56, u * 5.2);
    }
    ctx.fillStyle = '#c9452c';
    ctx.fillRect(x - half * 0.82, base - u * 6.6, half * 1.64, u * 0.5);
    ctx.fillStyle = '#6a5a46';
    ctx.fillRect(x - half * 0.78, base - u * 3.2, half * 1.56, u * 0.3);
    // Lower roof wide, upper roof narrower on a second storey.
    paintRoof(ctx, x, base - u * 6.4, half * 0.75, half * 1.18, u * 3.6, ink, edge);
    ctx.fillStyle = '#e9e1cf';
    ctx.fillRect(x - half * 0.5, base - u * 10.4, half * 1.0, u * 2.3);
    ctx.fillStyle = '#c9452c';
    ctx.fillRect(x - half * 0.54, base - u * 10.7, half * 1.08, u * 0.4);
    paintRoof(ctx, x, base - u * 10.8, half * 0.38, half * 0.82, u * 3.4, ink, edge);
    // Gold finial.
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x - u * 0.2, base - u * 16.4, u * 0.4, u * 2);
  }

  function paintPagoda(ctx, g, x, base) {
    const u = g.U * 1.5;
    const ink = '#2f3140';
    ctx.fillStyle = '#9b958a';
    ctx.fillRect(x - u * 3.6, base - u * 0.8, u * 7.2, u * 1);
    const tiers = 3;
    let y = base - u * 0.8;
    for (let t = 0; t < tiers; t++) {
      const w = u * (3.2 - t * 0.6);
      const wallH = u * 2.2;
      ctx.fillStyle = '#e9e1cf';
      ctx.fillRect(x - w * 0.8, y - wallH, w * 1.6, wallH);
      ctx.fillStyle = '#c9452c';
      ctx.fillRect(x - w * 0.8, y - wallH, u * 0.35, wallH);
      ctx.fillRect(x + w * 0.8 - u * 0.35, y - wallH, u * 0.35, wallH);
      y -= wallH;
      paintRoof(ctx, x, y + u * 0.2, w * 0.4, w * 1.35, u * 1.5, ink, '#4a4d5e');
      y -= u * 1.1;
    }
    ctx.fillStyle = ink;
    ctx.fillRect(x - u * 0.15, y - u * 3.4, u * 0.3, u * 3.6);
    ctx.fillStyle = '#c9a24a';
    for (let r = 0; r < 4; r++) ctx.fillRect(x - u * 0.55, y - u * (0.8 + r * 0.7), u * 1.1, u * 0.22);
  }

  // Blossom and cedar trees clustered in front of the buildings.
  function paintGrove(ctx, g, cx, base, spread, rand) {
    for (let k = 0; k < 22; k++) {
      const x = cx + (rand() - 0.5) * spread;
      const y = base - rand() * g.U * 1.4;
      ctx.fillStyle = k % 3 === 0 ? '#4f5e43' : PINKS[2][Math.floor(rand() * 3)];
      if (k % 3 === 0) {
        blob(ctx, x, y - g.U * 1.2, g.U * 0.6, g.U * 1.8);
      } else {
        blob(ctx, x, y - g.U * 0.6, g.U * (0.9 + rand() * 0.9), g.U * (0.7 + rand() * 0.5));
      }
    }
  }

  // ---- mist, petals ------------------------------------------------------

  function paintMist(g, seed) {
    const w = Math.ceil(g.W * 1.2);
    const h = Math.max(4, Math.ceil(g.H * 0.16));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const f = x / w;
        const v = lerp(fbm(x * 0.02, y * 0.09, 3, seed), fbm((x - w) * 0.02, y * 0.09, 3, seed), f);
        const i = (y * w + x) * 4;
        img.data[i] = 243;
        img.data[i + 1] = 235;
        img.data[i + 2] = 224;
        img.data[i + 3] = smoothstep(0.25, 0.6, v) * band * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makePetals(g, rand) {
    const P = { x: [], y: [], vx: [], vy: [], p: [], s: [], tone: [] };
    for (let i = 0; i < MAX_PETALS; i++) {
      P.x.push(rand() * g.W);
      P.y.push(rand() * g.H);
      P.vx.push(g.U * (3 + rand() * 4));
      P.vy.push(g.U * (1.5 + rand() * 2));
      P.p.push(rand() * TAU);
      P.s.push(Math.max(1, g.U * (0.3 + rand() * 0.35)));
      P.tone.push(Math.floor(rand() * 3));
    }
    return P;
  }

  const PETAL_TONES = ['#f7e3e0', '#f0c8c8', '#fbf1ea'];

  function stepPetals(g, count, t, dt) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      P.x[i] += (P.vx[i] + Math.sin(t * 0.5 + P.p[i]) * g.U) * dt;
      P.y[i] += (P.vy[i] + Math.cos(t * 0.9 + P.p[i]) * g.U * 0.6) * dt;
      if (P.x[i] > g.W + 2 || P.y[i] > g.H + 2) {
        P.x[i] = -2 - Math.random() * g.W * 0.3;
        P.y[i] = Math.random() * g.H * 0.7 - g.H * 0.1;
      }
    }
  }

  function drawPetals(ctx, count, t) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const flip = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + P.p[i]));
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.fillRect(P.x[i], P.y[i], P.s[i] * (1 + flip), P.s[i] * (1.4 - flip * 0.5));
    }
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed || 7);
    state.g = g;
    state.sky = paintSky(g);
    state.ridges = BASES.map((b, i) => paintRidge(g, i, rand));
    const hallCtx = state.ridges[HALL_RIDGE].canvas.getContext('2d');
    const ys = state.ridges[HALL_RIDGE].ys;
    const hx = Math.round(g.W * HALL_X);
    const px = Math.round(g.W * PAGODA_X);
    paintPagoda(hallCtx, g, px, ys[px] + g.U * 0.3);
    paintHall(hallCtx, g, hx, ys[hx] + g.U * 0.3);
    paintGrove(hallCtx, g, hx, ys[hx] + g.U * 1.2, g.U * 34, rand);
    paintGrove(hallCtx, g, px, ys[px] + g.U * 1.2, g.U * 14, rand);
    state.mist = paintMist(g, 55);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, mist } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETAL_BASE * petals));
    stepPetals(g, count, t, Math.min(dt, 0.1));
    ctx.drawImage(state.sky, 0, 0);
    for (let i = 0; i < state.ridges.length; i++) {
      ctx.drawImage(state.ridges[i].canvas, 0, 0);
      if (i < MIST_BANDS.length) drawMistBand(ctx, g, t, mist, i);
    }
    drawPetals(ctx, count, t);
  }

  function drawMistBand(ctx, g, t, amount, b) {
    if (amount <= 0) return;
    const m = state.mist;
    ctx.globalAlpha = Math.min(1, 0.95 * amount);
    const off = -((t * g.U * (0.6 + b * 0.35) + b * 37) % m.width);
    const y = g.H * MIST_BANDS[b] - m.height / 2;
    ctx.drawImage(m, off, y);
    ctx.drawImage(m, off + m.width, y);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { petals: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
