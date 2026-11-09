/*
 * 屋久島 Yakushima — an old cedar forest in rain.
 *
 * Trunk layers, ground, ferns, lantern and light shafts are baked once. Mist is two
 * tiling strips that slide sideways, rain is a short reused pool of slanted strokes,
 * and a few near fronds sway.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const RAIN_MAX = 110;
  const RAIN = 60;
  const FRONDS = 7;
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
    return { W, H, U, ground: Math.round(H * 0.8) };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#9fae9f');
    grad.addColorStop(0.45, '#7f9283');
    grad.addColorStop(1, '#3d4d41');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- trunks --------------------------------------------------------------

  // One cedar: slightly tapering, flared at the foot, with furrows and moss on the shaded side.
  function trunk(ctx, g, rand, x, w, tone, mossy) {
    const top = -g.U * 4;
    const foot = g.ground + g.U * 4;
    const flare = w * 0.35;
    ctx.fillStyle = tone.base;
    poly(ctx, [
      x - w * 0.46, top, x + w * 0.46, top,
      x + w * 0.5, foot - g.H * 0.2, x + w * 0.5 + flare, foot,
      x - w * 0.5 - flare, foot, x - w * 0.5, foot - g.H * 0.2,
    ]);
    ctx.fillStyle = tone.shade;
    poly(ctx, [
      x + w * 0.1, top, x + w * 0.46, top,
      x + w * 0.5, foot - g.H * 0.2, x + w * 0.5 + flare, foot,
      x + w * 0.15, foot,
    ]);
    ctx.fillStyle = tone.lit;
    poly(ctx, [
      x - w * 0.46, top, x - w * 0.22, top,
      x - w * 0.24, foot - g.H * 0.2, x - w * 0.5 - flare * 0.4, foot,
      x - w * 0.5 - flare, foot, x - w * 0.5, foot - g.H * 0.2,
    ]);
    const n = Math.max(3, Math.round(w / (g.U * 1.6)));
    for (let i = 0; i < n; i++) {
      const fx = x + (rand() - 0.5) * w * 0.92;
      ctx.strokeStyle = rand() < 0.5 ? tone.furrow : tone.lit;
      ctx.globalAlpha = 0.35 + rand() * 0.3;
      ctx.lineWidth = Math.max(1, g.U * (0.25 + rand() * 0.3));
      ctx.beginPath();
      ctx.moveTo(fx, top);
      ctx.bezierCurveTo(fx + (rand() - 0.5) * w * 0.1, g.H * 0.3, fx + (rand() - 0.5) * w * 0.1, g.H * 0.6, fx + (fx - x) * 0.25, foot);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (mossy) {
      for (let i = 0; i < 26; i++) {
        const my = g.H * (0.25 + rand() * 0.72);
        const mx = x + (rand() - 0.35) * w * 0.9 + (my > g.H * 0.7 ? (rand() - 0.5) * flare : 0);
        ctx.fillStyle = rand() < 0.4 ? tone.mossLit : tone.moss;
        blob(ctx, mx, my, g.U * (0.9 + rand() * 2.2), g.U * (1.4 + rand() * 4));
      }
      ctx.fillStyle = tone.moss;
      blob(ctx, x - w * 0.1, foot - g.U * 3, w * 0.7, g.U * 3);
    }
  }

  const FAR = { base: '#6d7f72', shade: '#5f7165', lit: '#7f9082', furrow: '#566858', moss: '#667e62', mossLit: '#7a9270' };
  const MID = { base: '#4a4a3d', shade: '#383a31', lit: '#6a6551', furrow: '#2c2e27', moss: '#4d6a40', mossLit: '#6b8a4c' };
  const NEAR = { base: '#3a3631', shade: '#27261f', lit: '#5a5244', furrow: '#1f1e1a', moss: '#3f5a34', mossLit: '#5f7f40' };

  function paintFar(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let x = g.W * 0.02; x < g.W; x += g.U * (14 + rand() * 12)) {
      trunk(ctx, g, rand, x, g.U * (5 + rand() * 4), FAR, false);
    }
    // a small vermilion gate far in the trees
    const tx = g.W * 0.77;
    const ty = g.ground - g.U * 3;
    const s = g.U * 3.2;
    ctx.fillStyle = '#b4513c';
    ctx.fillRect(tx - s, ty - s * 2, s * 0.28, s * 2);
    ctx.fillRect(tx + s * 0.72, ty - s * 2, s * 0.28, s * 2);
    ctx.fillRect(tx - s * 1.25, ty - s * 2.15, s * 2.5, s * 0.3);
    ctx.fillRect(tx - s * 0.9, ty - s * 1.65, s * 1.8, s * 0.2);
    ctx.fillStyle = '#3a3a32';
    ctx.fillRect(tx - s * 1.3, ty - s * 2.3, s * 2.6, s * 0.16);
    return c;
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const xs = [0.12, 0.31, 0.64, 0.9];
    for (const f of xs) trunk(ctx, g, rand, g.W * (f + (rand() - 0.5) * 0.04), g.U * (9 + rand() * 4), MID, true);
    return c;
  }

  // The great sacred cedar with its rope and paper streamers, and a mossy lantern at its foot.
  function paintGreat(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x = g.W * 0.47;
    const w = g.U * 26;
    trunk(ctx, g, rand, x, w, NEAR, true);
    // knotty burls
    ctx.fillStyle = NEAR.shade;
    for (let i = 0; i < 6; i++) blob(ctx, x + (rand() - 0.5) * w * 0.7, g.H * (0.2 + rand() * 0.5), g.U * (1 + rand()), g.U * (1.5 + rand() * 2));
    // twisted rope
    const ry = g.H * 0.46;
    const rw = w * 0.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? '#b69b62' : '#d8c590';
      ctx.lineWidth = g.U * 1.5;
      ctx.beginPath();
      ctx.moveTo(x - rw, ry - g.U * 0.5);
      ctx.bezierCurveTo(x - rw * 0.4, ry + g.U * (2.5 - k), x + rw * 0.4, ry + g.U * (2.5 - k), x + rw, ry - g.U * 0.5);
      ctx.stroke();
    }
    ctx.lineWidth = g.U * 0.5;
    ctx.strokeStyle = '#8a7544';
    for (let i = 0; i < 14; i++) {
      const f = (i + 0.5) / 14;
      const px = x - rw + rw * 2 * f;
      const py = ry + Math.sin(f * Math.PI) * g.U * 2.3;
      ctx.beginPath();
      ctx.moveTo(px - g.U * 0.5, py - g.U * 0.8);
      ctx.lineTo(px + g.U * 0.5, py + g.U * 0.8);
      ctx.stroke();
    }
    // zigzag paper streamers
    ctx.fillStyle = '#e6e0cc';
    for (let i = 0; i < 4; i++) {
      const f = 0.2 + i * 0.2;
      const px = x - rw + rw * 2 * f;
      const py = ry + Math.sin(f * Math.PI) * g.U * 2.3 + g.U;
      const d = g.U;
      poly(ctx, [
        px - d * 0.45, py, px + d * 0.45, py, px + d * 0.1, py + d * 2,
        px + d * 0.9, py + d * 3.4, px + d * 0.1, py + d * 3.6, px + d * 0.6, py + d * 5,
        px - d * 0.5, py + d * 5.2, px - d * 0.1, py + d * 3.4, px - d * 0.7, py + d * 2,
      ]);
    }
    return c;
  }

  // ---- ground, lantern, ferns ---------------------------------------------

  function lantern(ctx, g, x, y, s) {
    const stone = '#a2a995';
    const moss = '#587a45';
    ctx.fillStyle = '#656d60';
    ctx.fillRect(x - s * 0.9, y - s * 0.5, s * 1.8, s * 0.5);
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 0.3, y - s * 2.4, s * 0.6, s * 1.95);
    ctx.fillRect(x - s * 0.8, y - s * 2.8, s * 1.6, s * 0.4);
    ctx.fillStyle = '#4d5547';
    ctx.fillRect(x - s * 0.55, y - s * 4, s * 1.1, s * 1.2);
    ctx.fillStyle = '#d8b25c';
    ctx.fillRect(x - s * 0.28, y - s * 3.7, s * 0.56, s * 0.7);
    ctx.fillStyle = stone;
    poly(ctx, [x - s * 1.5, y - s * 4, x + s * 1.5, y - s * 4, x + s * 0.5, y - s * 4.9, x - s * 0.5, y - s * 4.9]);
    ctx.fillRect(x - s * 0.18, y - s * 5.4, s * 0.36, s * 0.55);
    ctx.fillStyle = moss;
    blob(ctx, x - s * 0.6, y - s * 4.05, s * 0.9, s * 0.3);
    blob(ctx, x + s * 0.3, y - s * 2.8, s * 0.7, s * 0.25);
    blob(ctx, x, y - s * 0.4, s * 1.2, s * 0.35);
  }

  function fern(ctx, g, rand, x, y, len, ink) {
    const n = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * (i / (n - 1)));
      const l = len * (0.65 + rand() * 0.45);
      const ex = x + Math.cos(a) * l;
      const ey = y + Math.sin(a) * l * 0.85;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + ex) / 2, Math.min(y, ey) - l * 0.22, ex, ey + l * 0.2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      for (let j = 1; j < 6; j++) {
        const f = j / 6;
        const px = x + (ex - x) * f;
        const py = y + (ey + l * 0.2 - y) * f - Math.sin(f * Math.PI) * l * 0.28;
        const q = l * 0.2 * (1 - f * 0.6);
        ctx.beginPath();
        ctx.moveTo(px - q, py + q * 0.5);
        ctx.lineTo(px, py);
        ctx.lineTo(px + q, py + q * 0.5);
        ctx.stroke();
      }
    }
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gy = g.ground;
    const grad = ctx.createLinearGradient(0, gy - g.U * 6, 0, g.H);
    grad.addColorStop(0, '#4a6040');
    grad.addColorStop(0.5, '#2f4430');
    grad.addColorStop(1, '#1d2a1f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 4; x += 4) ctx.lineTo(x, gy - g.U * 2 + K.fbm(x / (g.U * 12), 2.2, 3, 7) * g.U * 5);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // moss hummocks
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#66864a' : '#4c6b3b';
      blob(ctx, rand() * g.W, gy + rand() * (g.H - gy), g.U * (1.5 + rand() * 4), g.U * (0.5 + rand() * 1.2));
    }
    // stone steps leading in
    ctx.fillStyle = '#6f7766';
    for (let i = 0; i < 4; i++) {
      const sy = gy + g.U * (2 + i * 3.4);
      const sw = g.U * (5 + i * 2.6);
      ctx.fillStyle = i % 2 ? '#656d5d' : '#737b6a';
      blob(ctx, g.W * 0.62 + (i % 2 ? g.U : -g.U), sy, sw, g.U * (1 + i * 0.35));
    }
    lantern(ctx, g, g.W * 0.215, gy + g.U * 9, g.U * 3.2);
    const inks = ['#4f7040', '#648a4a', '#3d5c36'];
    for (let i = 0; i < 12; i++) fern(ctx, g, rand, g.W * (0.03 + rand() * 0.94), gy + g.U * (1 + rand() * 14), g.U * (4 + rand() * 4), inks[i % 3]);
    return c;
  }

  // dark foreground trunks at the edges frame the view
  function paintFrame(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    trunk(ctx, g, rand, -g.U * 3, g.U * 20, NEAR, true);
    trunk(ctx, g, rand, g.W + g.U * 2, g.U * 17, NEAR, true);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.35);
    grad.addColorStop(0, 'rgba(26,38,30,0.55)');
    grad.addColorStop(1, 'rgba(26,38,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * 0.35);
    // cedar boughs overhead
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 ? '#2b4130' : '#3a5a3b';
      blob(ctx, rand() * g.W, rand() * g.U * 5, g.U * (3 + rand() * 6), g.U * (1 + rand() * 2.4));
    }
    return c;
  }

  // ---- light shafts and mist -----------------------------------------------

  function paintShafts(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const count = 5;
    for (let i = 0; i < count; i++) {
      const x0 = g.W * (0.08 + (i / count) * 0.9 + (rand() - 0.5) * 0.06);
      const w0 = g.U * (4 + rand() * 6);
      const slant = g.H * 0.28;
      const grad = ctx.createLinearGradient(x0, 0, x0 + slant, g.ground);
      grad.addColorStop(0, 'rgba(240,226,160,0.5)');
      grad.addColorStop(0.7, 'rgba(230,212,144,0.26)');
      grad.addColorStop(1, 'rgba(226,208,140,0)');
      ctx.fillStyle = grad;
      poly(ctx, [x0, 0, x0 + w0, 0, x0 + slant + w0 * 1.6, g.ground, x0 + slant, g.ground]);
    }
    return c;
  }

  function paintMist(g, seed, height, alpha) {
    const c = layer(g.W, height);
    const ctx = c.getContext('2d');
    const r = K.rng(seed);
    for (let i = 0; i < 16; i++) {
      const x = r() * g.W;
      const y = height * (0.3 + r() * 0.4);
      const rx = g.U * (12 + r() * 18);
      const ry = height * (0.2 + r() * 0.25);
      for (const dx of [-g.W, 0, g.W]) {
        const gr = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        gr.addColorStop(0, 'rgba(206,218,208,' + alpha + ')');
        gr.addColorStop(1, 'rgba(206,218,208,0)');
        ctx.fillStyle = gr;
        ctx.save();
        ctx.translate(x + dx, y);
        ctx.scale(1, ry / rx);
        ctx.translate(-(x + dx), -y);
        ctx.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2);
        ctx.restore();
      }
    }
    return c;
  }

  // ---- rain and fronds -----------------------------------------------------

  function makeRain(g, rand) {
    const R = { x: new Float32Array(RAIN_MAX), y: new Float32Array(RAIN_MAX), v: new Float32Array(RAIN_MAX), l: new Float32Array(RAIN_MAX) };
    for (let i = 0; i < RAIN_MAX; i++) {
      R.x[i] = rand() * (g.W + g.H * 0.3);
      R.y[i] = rand() * g.H;
      R.v[i] = g.H * (0.9 + rand() * 0.7);
      R.l[i] = g.U * (2.5 + rand() * 3);
    }
    return R;
  }

  function makeFronds(g, rand) {
    const F = [];
    for (let i = 0; i < FRONDS; i++) {
      F.push({ x: g.W * (0.06 + 0.88 * (i / (FRONDS - 1))) + (rand() - 0.5) * g.U * 4, y: g.H - g.U * (1 + rand() * 4), len: g.U * (8 + rand() * 5), p: rand() * TAU });
    }
    return F;
  }

  function drawRain(ctx, g, dt, count) {
    const R = state.rain;
    const span = g.W + g.H * 0.3;
    ctx.strokeStyle = 'rgba(206,218,214,0.4)';
    ctx.lineWidth = Math.max(1, g.U * 0.18);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] -= R.v[i] * dt * 0.16;
      if (R.y[i] > g.H) {
        R.y[i] -= g.H + R.l[i];
        R.x[i] = Math.random() * span;
      }
      if (R.x[i] < -R.l[i]) R.x[i] += span;
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] - R.l[i] * 0.16, R.y[i] - R.l[i]);
    }
    ctx.stroke();
  }

  function drawFronds(ctx, g, t) {
    ctx.strokeStyle = '#2f4a2c';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (const f of state.fronds) {
      const sway = Math.sin(t * 0.7 + f.p) * f.len * 0.08;
      ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x + sway, f.y - f.len * 0.7, f.x + f.len * 0.45 + sway * 2, f.y - f.len * 0.8);
      ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x - sway, f.y - f.len * 0.7, f.x - f.len * 0.45 - sway * 2, f.y - f.len * 0.8);
    }
    ctx.stroke();
  }

  function drawStrip(ctx, strip, y, off, alpha) {
    const w = strip.width;
    const x = -(((off % w) + w) % w);
    ctx.globalAlpha = alpha;
    ctx.drawImage(strip, x, y);
    ctx.drawImage(strip, x + w, y);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g);
    state.far = paintFar(g, rand);
    state.mid = paintMid(g, rand);
    state.great = paintGreat(g, rand);
    state.ground = paintGround(g, rand);
    state.frame = paintFrame(g, rand);
    state.shafts = paintShafts(g, rand);
    state.mistA = paintMist(g, 5, g.H * 0.5, 0.3);
    state.mistB = paintMist(g, 9, g.H * 0.5, 0.26);
    state.rain = makeRain(g, rand);
    state.fronds = makeFronds(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, mist, light } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawStrip(ctx, state.mistA, g.H * 0.28, t * g.U * 0.9, Math.min(1, 0.85 * mist));
    ctx.drawImage(state.mid, 0, 0);
    drawStrip(ctx, state.mistB, g.H * 0.4, -t * g.U * 1.4, Math.min(1, 0.8 * mist));
    ctx.drawImage(state.great, 0, 0);
    ctx.globalAlpha = Math.min(1, light * (0.7 + 0.3 * Math.sin(t * 0.25) * Math.sin(t * 0.11 + 1)));
    ctx.drawImage(state.shafts, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.ground, 0, 0);
    drawFronds(ctx, g, t);
    ctx.drawImage(state.frame, 0, 0);
    drawRain(ctx, g, step, Math.min(RAIN_MAX, Math.round(RAIN * rain)));
  }

  Kasuri.run({
    defaults: { rain: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
