/*
 * 梅花 Meihua — plum blossoms on black branches on a snowy winter night.
 *
 * Sky, moon, far hills, snowy ground and the whole blossoming branch are baked once.
 * The branch layer sways a hair around its root each frame; snow and petals are two
 * short pools of single pixels that fall and wander.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#1c2540', '#2c3a5c', '#44557a', '#5d6f91'];
  const BARK = '#15110f';
  const BARK_LIT = '#3a322c';
  const SNOW = '#e6e4da';
  const SNOW_SHADE = '#aeb3bd';
  const PETALS = ['#efe6d8', '#e6d3cb', '#dcbfb8'];
  const HEART = '#b8432c';
  const GOLD = '#d2b36a';
  const MAX_FLAKES = 90;
  const FLAKES = 60;
  const MAX_PETALS = 36;
  const PETAL_N = 18;
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
    const U = H / 100;
    return { W, H, U, gy: Math.round(H * 0.84), mx: W * 0.74, my: H * 0.2 };
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.gy) * (inks.length - 1);
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
    // moon with a soft halo
    ctx.fillStyle = '#5a6376';
    ctx.globalAlpha = 0.25;
    blob(ctx, g.mx, g.my, g.U * 13, g.U * 13);
    ctx.globalAlpha = 0.35;
    blob(ctx, g.mx, g.my, g.U * 9, g.U * 9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8dcb4';
    blob(ctx, g.mx, g.my, g.U * 5.4, g.U * 5.4);
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.35;
    blob(ctx, g.mx + g.U * 1.4, g.my + g.U * 1, g.U * 1.6, g.U * 1.2);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintHills(g) {
    const c = layer(g.W, g.gy + 2);
    const ctx = c.getContext('2d');
    const tones = ['#2c3752', '#222b42'];
    const bases = [0.6, 0.7];
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = tones[r];
      ctx.beginPath();
      ctx.moveTo(0, g.gy + 2);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const y = g.H * bases[r] - Math.pow(fbm(x / (g.U * 28), 3 + r * 7, 3, 17 + r), 1.4) * g.H * (0.22 - r * 0.06);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W + 2, g.gy + 2);
      ctx.fill();
    }
    return c;
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H - g.gy + 4);
    const ctx = c.getContext('2d');
    const h = c.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#9aa3b4');
    grad.addColorStop(0.35, '#c4c8d0');
    grad.addColorStop(1, '#dcdcd6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, 2 + (fbm(x / (g.U * 14), 8.3, 3, 5) - 0.5) * g.U * 3);
    ctx.lineTo(g.W + 2, h);
    ctx.lineTo(0, h);
    ctx.fill();
    // soft drifts
    ctx.fillStyle = SNOW_SHADE;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.25;
      blob(ctx, rand() * g.W, h * (0.3 + rand() * 0.6), g.U * (5 + rand() * 9), g.U * (0.5 + rand() * 0.7));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // A snow-capped garden rock on the left, in the manner of a scholar's stone.
  function paintRock(ctx, g) {
    const u = g.U;
    const x = g.W * 0.16;
    const y = g.gy + u * 1.5;
    ctx.fillStyle = '#1d222b';
    ctx.beginPath();
    ctx.moveTo(x - u * 7, y);
    ctx.bezierCurveTo(x - u * 8, y - u * 6, x - u * 4, y - u * 8, x - u * 3.5, y - u * 13);
    ctx.bezierCurveTo(x - u * 2, y - u * 15, x + u * 1.5, y - u * 11, x + u * 2.5, y - u * 9);
    ctx.bezierCurveTo(x + u * 5, y - u * 8, x + u * 7, y - u * 4, x + u * 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f3644';
    blob(ctx, x - u * 2.4, y - u * 8, u * 0.9, u * 1.9);
    blob(ctx, x + u * 2.4, y - u * 4, u * 0.8, u * 1.5);
    ctx.fillStyle = '#0d1016';
    blob(ctx, x - u * 0.4, y - u * 6.4, u * 0.7, u * 1.2);
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.ellipse(x - u * 1.2, y - u * 13.6, u * 2.8, u * 1.1, -0.15, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + u * 3.2, y - u * 8.8, u * 2.6, u * 0.8, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = SNOW_SHADE;
    blob(ctx, x, y + u * 0.2, u * 8.5, u * 0.9);
  }

  function blossom(ctx, x, y, r, rand) {
    const tone = PETALS[Math.floor(rand() * PETALS.length)];
    ctx.fillStyle = tone;
    const a0 = rand() * TAU;
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i * TAU) / 5;
      blob(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.62, r * 0.62);
    }
    ctx.fillStyle = HEART;
    blob(ctx, x, y, Math.max(0.6, r * 0.3), Math.max(0.6, r * 0.3));
    if (r > 1.3) {
      ctx.fillStyle = GOLD;
      for (let i = 0; i < 3; i++) {
        const a = a0 + i * 2.1;
        ctx.fillRect(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, 1, 1);
      }
    }
  }

  // One limb: tapering, kinked stroke, with side twigs. Blossoms and snow collect in the lists.
  function limb(ctx, x, y, ang, len, w, depth, rand, g, out) {
    const steps = Math.max(3, Math.round(len / (g.U * 2.2)));
    let px = x;
    let py = y;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      a += (rand() - 0.5) * 0.32 + (-1.1 - a) * 0.05 * (depth > 0 ? 1 : 0.3);
      const sl = len / steps;
      const nx = px + Math.cos(a) * sl;
      const ny = py + Math.sin(a) * sl;
      const lw = Math.max(1, w * (1 - f * 0.7));
      ctx.strokeStyle = BARK;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      if (lw > 1.6 && Math.sin(a) < 0.6) out.caps.push([px, py - lw * 0.35, nx, ny - lw * 0.35, lw]);
      if (depth < 4 && rand() < 0.34 - depth * 0.06 && i > 0) {
        const side = rand() < 0.5 ? -1 : 1;
        limb(ctx, nx, ny, a + side * (0.45 + rand() * 0.45), len * (0.5 + rand() * 0.25), w * 0.6, depth + 1, rand, g, out);
      }
      if (depth >= 2 && rand() < 0.3) out.flowers.push([nx, ny, depth]);
      px = nx;
      py = ny;
    }
    if (depth >= 2) out.flowers.push([px, py, depth + 1]);
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const out = { caps: [], flowers: [] };
    const u = g.U;
    // main limb enters from the left edge, rises and reaches across toward the moon
    limb(ctx, -u * 4, g.H * 0.86, -0.5, g.W * 0.6, u * 3.4, 0, rand, g, out);
    limb(ctx, -u * 2, g.H * 0.5, -0.25, g.W * 0.4, u * 2, 1, rand, g, out);
    // snow resting on the upper side of thicker wood
    ctx.lineCap = 'round';
    for (const s of out.caps) {
      ctx.strokeStyle = SNOW;
      ctx.lineWidth = Math.max(1, s[4] * 0.45);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const keep = Math.min(1, 120 / Math.max(1, out.flowers.length));
    for (const f of out.flowers) {
      if (rand() > keep) continue;
      const n = 1;
      for (let i = 0; i < n; i++) {
        const r = u * (1 + rand() * 0.6);
        const ox = (rand() - 0.5) * u * 2.2;
        const oy = (rand() - 0.5) * u * 2.2;
        if (rand() < 0.2) {
          ctx.fillStyle = '#8a3a2a';
          blob(ctx, f[0] + ox, f[1] + oy, u * 0.45, u * 0.45);
        } else {
          blossom(ctx, f[0] + ox, f[1] + oy, r, rand);
        }
      }
    }
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.hills = paintHills(g);
    state.ground = paintGround(g, rand);
    state.back = layer(g.W, g.H);
    const bctx = state.back.getContext('2d');
    bctx.drawImage(state.sky, 0, 0);
    bctx.drawImage(state.hills, 0, 0);
    bctx.drawImage(state.ground, 0, g.gy - 2);
    paintRock(bctx, g);
    state.branch = paintBranch(g, K.rng(api.seed + 77));
    const mk = (n) => ({ x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), p: new Float32Array(n), s: new Float32Array(n) });
    state.flakes = mk(MAX_FLAKES);
    state.petals = mk(MAX_PETALS);
    for (const k of [state.flakes, state.petals]) {
      for (let i = 0; i < k.x.length; i++) {
        k.x[i] = rand() * g.W;
        k.y[i] = rand() * g.H;
        k.v[i] = 0.6 + rand() * 0.8;
        k.p[i] = rand() * TAU;
        k.s[i] = rand();
      }
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, petals } = api.props;
    ctx.drawImage(state.back, 0, 0);
    // gentle sway of the whole branch around its root
    ctx.save();
    ctx.translate(-g.U * 4, g.H * 0.86);
    ctx.rotate(Math.sin(t * 0.35) * 0.006);
    ctx.drawImage(state.branch, g.U * 4, -g.H * 0.86);
    ctx.restore();

    const fl = state.flakes;
    const nf = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    ctx.fillStyle = SNOW;
    for (let i = 0; i < nf; i++) {
      fl.y[i] += dt * g.U * (2.5 + fl.v[i] * 3);
      fl.x[i] += dt * g.U * (0.6 + Math.sin(t * 0.6 + fl.p[i]) * 0.9);
      if (fl.y[i] > g.gy + g.U * 6 * fl.s[i]) { fl.y[i] = -2; fl.x[i] = Math.random() * g.W; }
      if (fl.x[i] > g.W) fl.x[i] -= g.W;
      ctx.globalAlpha = 0.5 + fl.s[i] * 0.4;
      const sz = fl.s[i] > 0.8 ? 2 : 1;
      ctx.fillRect(fl.x[i], fl.y[i], sz, sz);
    }

    const pt = state.petals;
    const np = Math.min(MAX_PETALS, Math.round(PETAL_N * petals));
    for (let i = 0; i < np; i++) {
      pt.y[i] += dt * g.U * (1.4 + pt.v[i] * 1.6);
      pt.x[i] += dt * g.U * (1 + Math.sin(t * 0.9 + pt.p[i]) * 1.6);
      if (pt.y[i] > g.gy + g.U * 8 * pt.s[i]) { pt.y[i] = -2; pt.x[i] = Math.random() * g.W * 0.8; }
      if (pt.x[i] > g.W) pt.x[i] -= g.W;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = PETALS[i % PETALS.length];
      const flip = Math.sin(t * 1.7 + pt.p[i]) > 0;
      ctx.fillRect(pt.x[i], pt.y[i], flip ? 2 : 1, flip ? 1 : 2);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { snow: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
