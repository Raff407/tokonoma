/*
 * ムササビ Momonga — a flying squirrel gliding between huge cedars on a moonlit night.
 *
 * Sky, moon, far and near trunks, shrine gate and lantern are baked once per size.
 * Mist is one tiling strip. The squirrel is a small shape drawn along a gliding arc,
 * crossing the frame and then resting out of sight before it returns the other way.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#1d2540', '#2a3558', '#3b4a6c', '#52627f'];
  const GROUND = 0.9;
  const PERIOD = 20;
  const GLIDE = 17;
  const FLIES = 14;

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
    return { W, H, U, gy: Math.round(H * GROUND), mx: W * 0.66, my: H * 0.2 };
  }

  // ---- sky and moon --------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.8)) * (inks.length - 1);
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
    ctx.fillStyle = '#d8d2bc';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.4;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.4), 1, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintMoon(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = g.U * 6.5;
    ctx.fillStyle = '#6f7d95';
    for (let i = 5; i > 0; i--) {
      ctx.globalAlpha = 0.07;
      blob(ctx, g.mx, g.my, r * (1 + i * 0.55), r * (1 + i * 0.55));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ece4c8';
    blob(ctx, g.mx, g.my, r, r);
    ctx.fillStyle = '#d3cba9';
    blob(ctx, g.mx - r * 0.25, g.my + r * 0.2, r * 0.3, r * 0.26);
    blob(ctx, g.mx + r * 0.35, g.my - r * 0.3, r * 0.2, r * 0.18);
    return c;
  }

  // ---- cedars --------------------------------------------------------------

  function trunk(ctx, g, rand, x, w, top, bottom, inks, litSide) {
    const wob = rand() * 10;
    ctx.fillStyle = inks[0];
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, top);
    for (let y = top; y <= bottom; y += 3) ctx.lineTo(x - w * 0.5 - (y - top) * 0.004 * w + Math.sin(y / (g.U * 9) + wob) * w * 0.03, y);
    for (let y = bottom; y >= top; y -= 3) ctx.lineTo(x + w * 0.5 + (y - top) * 0.004 * w + Math.sin(y / (g.U * 9) + wob) * w * 0.03, y);
    ctx.closePath();
    ctx.fill();
    const ls = litSide;
    const sx = x + ls * w * 0.5;
    ctx.fillStyle = inks[1];
    ctx.fillRect(Math.min(sx, sx - ls * w * 0.28), top, w * 0.28, bottom - top);
    // bark furrows
    ctx.fillStyle = inks[2];
    const n = Math.max(3, Math.round(w / 2.4));
    for (let i = 0; i < n; i++) {
      const fx = x - w * 0.45 + rand() * w * 0.9;
      const y0 = top + rand() * (bottom - top) * 0.7;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(Math.floor(fx), y0, 1, (bottom - top) * (0.1 + rand() * 0.25));
    }
    ctx.globalAlpha = 1;
  }

  function crown(ctx, g, rand, x, y, s, inks) {
    ctx.fillStyle = inks[0];
    for (let i = 0; i < 7; i++) {
      const dx = (rand() - 0.5) * s * 1.7;
      const dy = (rand() - 0.5) * s * 0.9;
      blob(ctx, x + dx, y + dy, s * (0.45 + rand() * 0.4), s * (0.3 + rand() * 0.25));
    }
    ctx.fillStyle = inks[1];
    for (let i = 0; i < 4; i++) {
      blob(ctx, x + (rand() - 0.5) * s * 1.2, y - s * 0.2 + (rand() - 0.5) * s * 0.5, s * 0.3, s * 0.15);
    }
  }

  const FAR = ['#34425f', '#3f4e6c', '#2d3a56'];
  const MID = ['#222d44', '#31405c', '#1b2539'];
  const NEAR = ['#131a2b', '#232d44', '#0e1422'];
  const CROWN_FAR = ['#2e3b57', '#3a4864'];
  const CROWN_MID = ['#1d2840', '#2a3752'];

  function paintFar(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const step = g.U * 9;
    for (let x = step * 0.3; x < g.W; x += step * (0.8 + rand() * 0.8)) {
      const w = g.U * (2 + rand() * 1.2);
      if (Math.abs(x - g.mx) < g.U * 9) continue;
      trunk(ctx, g, rand, x, w, g.H * 0.03, g.gy, FAR, 1);
      crown(ctx, g, rand, x, g.H * (0.02 + rand() * 0.06), g.U * 6, CROWN_FAR);
    }
    return c;
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [0.2, 0.36, 0.5, 0.82, 0.92];
    for (let i = 0; i < spots.length; i++) {
      const x = g.W * (spots[i] + (rand() - 0.5) * 0.04);
      const w = g.U * (4.2 + rand() * 2);
      trunk(ctx, g, rand, x, w, -2, g.gy + 4, MID, 1);
      crown(ctx, g, rand, x, g.H * 0.02, g.U * 10, CROWN_MID);
    }
    return c;
  }

  function shimenawa(ctx, g, x, y, w) {
    ctx.fillStyle = '#b9a67a';
    ctx.fillRect(x - w * 0.52, y, w * 1.04, Math.max(2, g.U * 1.1));
    ctx.fillStyle = '#8a7752';
    for (let i = 0; i < w * 1.04; i += 3) ctx.fillRect(x - w * 0.52 + i, y + 1, 1, Math.max(1, g.U * 0.7));
    ctx.fillStyle = '#e4dcc4';
    for (let k = -1; k <= 1; k++) {
      const sx = x + k * w * 0.3;
      const sy = y + g.U * 1.1;
      poly(ctx, [sx, sy, sx + g.U * 1.4, sy, sx + g.U * 1.4, sy + g.U * 1.8, sx + g.U * 0.5, sy + g.U * 1.8, sx + g.U * 0.5, sy + g.U * 3.2, sx - g.U * 0.6, sy + g.U * 3.2, sx - g.U * 0.6, sy + g.U * 1.8, sx, sy + g.U * 1.8]);
    }
  }

  function paintNear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.U * 15;
    const wr = g.U * 13;
    trunk(ctx, g, rand, g.W * 0.05, wl, -2, g.H, NEAR, 1);
    trunk(ctx, g, rand, g.W * 0.96, wr, -2, g.H, NEAR, -1);
    shimenawa(ctx, g, g.W * 0.05 + wl * 0.12, g.H * 0.58, wl * 0.9);
    // roots
    ctx.fillStyle = NEAR[0];
    poly(ctx, [g.W * 0.05 - wl * 0.7, g.H, g.W * 0.05 - wl * 0.3, g.gy - g.U * 3, g.W * 0.05 + wl * 0.7, g.gy - g.U * 3, g.W * 0.05 + wl * 1.1, g.H]);
    poly(ctx, [g.W * 0.96 - wr * 1.1, g.H, g.W * 0.96 - wr * 0.7, g.gy - g.U * 3, g.W * 0.96 + wr * 0.3, g.gy - g.U * 3, g.W * 0.96 + wr * 0.7, g.H]);
    return c;
  }

  // ---- shrine, ground ------------------------------------------------------

  function torii(ctx, g, x, y, s) {
    const col = '#8f3a2c';
    const dark = '#6a2a21';
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.62, y - s * 1.0, s * 0.14, s * 1.0);
    ctx.fillRect(x + s * 0.48, y - s * 1.0, s * 0.14, s * 1.0);
    ctx.fillRect(x - s * 0.7, y - s * 0.76, s * 1.4, s * 0.09);
    poly(ctx, [x - s * 0.95, y - s * 1.0, x + s * 0.95, y - s * 1.0, x + s * 0.8, y - s * 0.9, x - s * 0.8, y - s * 0.9]);
    ctx.fillStyle = dark;
    ctx.fillRect(x - s * 0.8, y - s * 1.06, s * 1.6, s * 0.06);
    ctx.fillStyle = '#12182a';
    ctx.fillRect(x - s * 0.65, y - s * 0.12, s * 0.2, s * 0.12);
    ctx.fillRect(x + s * 0.45, y - s * 0.12, s * 0.2, s * 0.12);
  }

  function lantern(ctx, g, x, y, s) {
    const stone = '#4c566b';
    const lit = '#6b7690';
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 0.12, y - s * 0.5, s * 0.24, s * 0.5);
    ctx.fillRect(x - s * 0.3, y - s * 0.08, s * 0.6, s * 0.08);
    ctx.fillRect(x - s * 0.34, y - s * 0.62, s * 0.68, s * 0.14);
    ctx.fillRect(x - s * 0.3, y - s * 1.0, s * 0.6, s * 0.38);
    ctx.fillStyle = '#d9b45a';
    ctx.fillRect(x - s * 0.16, y - s * 0.92, s * 0.32, s * 0.22);
    ctx.fillStyle = stone;
    poly(ctx, [x - s * 0.62, y - s * 1.0, x + s * 0.62, y - s * 1.0, x + s * 0.2, y - s * 1.3, x - s * 0.2, y - s * 1.3]);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 0.1, y - s * 1.4, s * 0.2, s * 0.12);
    ctx.fillRect(x - s * 0.62, y - s * 1.02, s * 0.5, 1);
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    torii(ctx, g, g.W * 0.43, g.gy - g.U * 0.5, g.U * 11);
    lantern(ctx, g, g.W * 0.7, g.gy + g.U * 1.2, g.U * 7);
    ctx.fillStyle = '#16203a';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, g.gy + fbm(x / (g.U * 10), 2.2, 3, 5) * g.U * 3);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#3d5446';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.fillRect(Math.floor(rand() * g.W), g.gy + 1 + Math.floor(rand() * (g.H - g.gy - 1)), 1 + Math.floor(rand() * 2), 1);
    }
    ctx.globalAlpha = 1;
    // stone steps leading to the gate
    ctx.fillStyle = '#4a5670';
    for (let i = 0; i < 4; i++) {
      const w = g.U * (9 + i * 3);
      ctx.fillRect(g.W * 0.43 - w / 2, g.gy + g.U * (0.2 + i * 1.8), w, g.U * 0.5);
    }
    return c;
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 31);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 162;
        img.data[i + 2] = 184;
        img.data[i + 3] = a * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    const rows = [g.H * 0.62, g.H * 0.8];
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, rows[0]);
    ctx.drawImage(m, w - a, rows[0]);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.55);
    ctx.drawImage(m, b - w, rows[1]);
    ctx.drawImage(m, b, rows[1]);
    const c = (t * g.U * 0.35 + w * 0.7) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.3);
    ctx.drawImage(m, c - w, g.H * 0.3);
    ctx.drawImage(m, c, g.H * 0.3);
    ctx.globalAlpha = 1;
  }

  // ---- squirrel ------------------------------------------------------------

  function drawSquirrel(ctx, g, t) {
    const cyc = Math.floor(t / PERIOD);
    const ph = t - cyc * PERIOD;
    if (ph > GLIDE) return;
    const s = ph / GLIDE;
    const dir = cyc % 2 === 0 ? 1 : -1;
    const e = s * s * (3 - 2 * s) * 0.35 + s * 0.65;
    const x0 = g.W * 0.1;
    const x1 = g.W * 0.9;
    const x = dir > 0 ? lerp(x0, x1, e) : lerp(x1, x0, e);
    const y = g.H * 0.3 + Math.sin(e * Math.PI * 0.5) * g.H * 0.22 - Math.sin(e * Math.PI) * g.H * 0.02;
    const slope = (g.H * 0.22 * Math.cos(e * Math.PI * 0.5) * Math.PI * 0.5) / (x1 - x0);
    const tilt = Math.atan(slope) * dir;
    const flap = Math.sin(t * 1.6) * 0.15;
    const k = g.U * 1.5;
    const fade = Math.min(1, s / 0.06, (1 - s) / 0.06);
    ctx.globalAlpha = fade;
    ctx.setTransform(dir * Math.cos(tilt), Math.sin(tilt) * dir * dir, -dir * Math.sin(tilt) * 0, 1, x, y);
    ctx.setTransform(dir * Math.cos(tilt) * k, Math.sin(tilt * dir) * k * dir, -Math.sin(tilt * dir) * k, Math.cos(tilt * dir) * k, x, y);
    // tail
    ctx.fillStyle = '#7b7a74';
    poly(ctx, [-2.5, -0.9, -8.5, -1.4 + flap, -9.2, 0, -8.5, 1.4 - flap, -2.5, 0.9]);
    // membrane
    ctx.fillStyle = '#a9a38f';
    poly(ctx, [2.6, -1.2, 3.2, -4.6 + flap, 0, -4.3, -2.6, -4.9 + flap, -2.9, -1.2, -2.9, 1.2, -2.6, 4.9 - flap, 0, 4.3, 3.2, 4.6 - flap, 2.6, 1.2]);
    ctx.fillStyle = '#cbc4ab';
    poly(ctx, [2.2, -1.1, 2.6, -3.4, 0, -3.1, -2.2, -3.6, -2.2, -1.1]);
    poly(ctx, [2.2, 1.1, 2.6, 3.4, 0, 3.1, -2.2, 3.6, -2.2, 1.1]);
    // body and head
    ctx.fillStyle = '#e4dcc4';
    blob(ctx, 0, 0, 3.2, 1.5);
    blob(ctx, 3.4, 0, 1.5, 1.2);
    ctx.fillStyle = '#6a685f';
    blob(ctx, 4.2, -0.5, 0.35, 0.35);
    poly(ctx, [3, -1, 3.2, -2.1, 3.9, -1.1]);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- fireflies -----------------------------------------------------------

  function makeFlies(g, rand) {
    const f = [];
    for (let i = 0; i < FLIES; i++) {
      f.push({ x: g.W * (0.15 + rand() * 0.7), y: g.H * (0.65 + rand() * 0.25), p: rand() * TAU, s: 0.2 + rand() * 0.3, r: g.U * (1 + rand() * 2) });
    }
    return f;
  }

  function drawFlies(ctx, g, t, amount) {
    const n = Math.min(FLIES, Math.round(FLIES * amount * 0.7));
    ctx.fillStyle = '#d9c36a';
    for (let i = 0; i < n; i++) {
      const f = state.flies[i];
      const glow = 0.5 + 0.5 * Math.sin(t * 0.7 + f.p);
      ctx.globalAlpha = 0.25 + glow * 0.6;
      ctx.fillRect(Math.round(f.x + Math.sin(t * f.s + f.p) * f.r), Math.round(f.y + Math.cos(t * f.s * 1.3 + f.p) * f.r * 0.6), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.moon = paintMoon(g);
    state.far = paintFar(g, rand);
    state.mid = paintMid(g, rand);
    state.ground = paintGround(g, rand);
    state.near = paintNear(g, rand);
    state.mist = paintMist(g);
    state.flies = makeFlies(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, moon, fireflies } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.3 + moon * 0.7);
    ctx.drawImage(state.moon, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t * 0.6, mist * 0.6);
    ctx.drawImage(state.mid, 0, 0);
    ctx.drawImage(state.ground, 0, 0);
    drawSquirrel(ctx, g, t);
    drawMist(ctx, g, t, mist);
    drawFlies(ctx, g, t, fireflies);
    ctx.drawImage(state.near, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, moon: 1, fireflies: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.3, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
