/*
 * 旅館 Ryokan — an inn corridor of polished wood, paper lamps glowing, and a
 * rainy garden beyond the glass doors.
 *
 * The garden and the corridor frame are baked once. Per frame: rain streaks,
 * a few ripples on the moss, drops creeping down the glass and lamp glow.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const CEIL = 0.13;
  const SILL = 0.71;
  const POSTS = [0, 0.25, 0.5, 0.75, 1];
  const LAMPS = [0.125, 0.5, 0.875];
  const RAIN = 110;
  const RIPPLES = 7;
  const DROPS = 9;
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

  function pine(ctx, x, base, h, ink, rand) {
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = Math.max(1, h * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + h * 0.08, base - h * 0.5, x - h * 0.03, base - h);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let i = 0; i < 5; i++) {
      const y = base - h * (0.35 + i * 0.15);
      const w = h * (0.34 - i * 0.04);
      const dx = (rand() - 0.5) * h * 0.1;
      blob(ctx, x + dx + w * 0.3, y, w, h * 0.05);
      blob(ctx, x + dx - w * 0.3, y + h * 0.04, w * 0.8, h * 0.045);
    }
  }

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * CEIL;
    const sill = g.H * SILL;
    const ground = g.H * 0.52;
    const sky = ctx.createLinearGradient(0, top, 0, ground);
    sky.addColorStop(0, '#34425f');
    sky.addColorStop(1, '#7c8c9c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, top, g.W, sill - top);
    // far hills in mist
    ctx.fillStyle = '#5d6e7c';
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = 0; x <= g.W; x += g.W / 40) {
      ctx.lineTo(x, ground - g.H * (0.10 + 0.07 * K.fbm(x / g.W * 3, 1.3, 2)));
    }
    ctx.lineTo(g.W, ground);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,164,170,0.35)';
    ctx.fillRect(0, ground - g.H * 0.09, g.W, g.H * 0.09);
    // mid trees: pines and a maple
    const treeline = ground + g.H * 0.02;
    pine(ctx, g.W * 0.07, treeline, g.H * 0.36, '#3c5240', rand);
    pine(ctx, g.W * 0.31, treeline, g.H * 0.27, '#475f48', rand);
    pine(ctx, g.W * 0.9, treeline, g.H * 0.33, '#3c5240', rand);
    // maple
    const mx = g.W * 0.44;
    ctx.strokeStyle = '#352a22';
    ctx.lineWidth = g.H * 0.012;
    ctx.beginPath();
    ctx.moveTo(mx, treeline + g.H * 0.04);
    ctx.quadraticCurveTo(mx - g.H * 0.02, treeline - g.H * 0.1, mx + g.H * 0.02, treeline - g.H * 0.2);
    ctx.stroke();
    const tones = ['#a8432b', '#c0572f', '#8c3326', '#cf8a3e'];
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = tones[i % 4];
      ctx.globalAlpha = 0.85;
      const a = rand() * TAU;
      const r = Math.sqrt(rand()) * g.H * 0.17;
      blob(ctx, mx + Math.cos(a) * r * 1.3, treeline - g.H * 0.2 + Math.sin(a) * r * 0.65, g.H * 0.03, g.H * 0.02);
    }
    ctx.globalAlpha = 1;
    // bamboo fence
    ctx.fillStyle = '#6f7a58';
    const fy = ground + g.H * 0.03;
    for (let x = g.W * 0.52; x < g.W * 0.83; x += g.W * 0.014) ctx.fillRect(x, fy - g.H * 0.09, Math.max(1, g.W * 0.006), g.H * 0.1);
    ctx.fillStyle = '#8f9672';
    ctx.fillRect(g.W * 0.52, fy - g.H * 0.065, g.W * 0.31, Math.max(1, g.H * 0.008));
    ctx.fillRect(g.W * 0.52, fy - g.H * 0.02, g.W * 0.31, Math.max(1, g.H * 0.008));
    // moss ground
    const moss = ctx.createLinearGradient(0, ground, 0, sill);
    moss.addColorStop(0, '#4c5d40');
    moss.addColorStop(1, '#2f3f2f');
    ctx.fillStyle = moss;
    ctx.fillRect(0, ground + g.H * 0.04, g.W, sill - ground);
    ctx.fillStyle = '#566a46';
    for (let i = 0; i < g.W * 0.9; i++) {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(rand() * g.W, ground + g.H * 0.05 + rand() * g.H * 0.15, 1, 1);
    }
    ctx.globalAlpha = 1;
    // stepping stones
    ctx.fillStyle = '#6b6e6e';
    const stones = [[0.2, 0.60, 0.05], [0.28, 0.635, 0.06], [0.38, 0.665, 0.07], [0.5, 0.685, 0.08]];
    for (const [sx, sy, sr] of stones) {
      blob(ctx, g.W * sx, g.H * sy, g.W * sr, g.H * sr * 0.4);
    }
    ctx.fillStyle = 'rgba(190,200,205,0.35)';
    for (const [sx, sy, sr] of stones) blob(ctx, g.W * sx, g.H * sy - 1, g.W * sr * 0.7, g.H * sr * 0.2);
    paintLantern(ctx, g, g.W * 0.66, g.H * 0.64);
    return c;
  }

  // stone lantern: base, post, fire box, cap, jewel
  function paintLantern(ctx, g, x, base) {
    const u = g.H * 0.016;
    ctx.fillStyle = '#8a8e8c';
    ctx.fillRect(x - u * 3, base - u * 1.2, u * 6, u * 1.2);
    ctx.fillRect(x - u * 1.1, base - u * 9, u * 2.2, u * 8);
    blob(ctx, x, base - u * 9, u * 3, u * 0.9);
    ctx.fillStyle = '#9a9e9a';
    ctx.fillRect(x - u * 2.4, base - u * 14, u * 4.8, u * 4.5);
    ctx.fillStyle = '#e0a950';
    ctx.fillRect(x - u * 1.3, base - u * 13, u * 2.6, u * 2.6);
    ctx.fillStyle = '#6e7274';
    ctx.beginPath();
    ctx.moveTo(x - u * 5, base - u * 14);
    ctx.lineTo(x, base - u * 18.5);
    ctx.lineTo(x + u * 5, base - u * 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a8e8c';
    blob(ctx, x, base - u * 18.8, u * 0.9, u * 1.2);
  }

  function paintFrame(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * CEIL;
    const sill = g.H * SILL;
    // ceiling boards and beam
    ctx.fillStyle = '#2b1f18';
    ctx.fillRect(0, 0, g.W, top);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, top - g.H * 0.035, g.W, g.H * 0.035);
    ctx.fillStyle = '#4a3626';
    ctx.fillRect(0, top - 1, g.W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < g.W; x += g.W / 18) ctx.fillRect(x, 0, 1, top - g.H * 0.035);
    // floor: boards in perspective
    const floor = ctx.createLinearGradient(0, sill, 0, g.H);
    floor.addColorStop(0, '#5a3d27');
    floor.addColorStop(1, '#2e1f15');
    ctx.fillStyle = floor;
    ctx.fillRect(0, sill, g.W, g.H - sill);
    ctx.strokeStyle = 'rgba(20,12,8,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const vx = g.W * 0.5;
    const vy = g.H * 0.3;
    for (let i = -8; i <= 8; i++) {
      const bx = vx + i * g.W * 0.13;
      const t0 = (sill - vy) / (g.H - vy);
      ctx.moveTo(vx + (bx - vx) * t0, sill);
      ctx.lineTo(bx, g.H);
    }
    ctx.stroke();
    // reflected garden light on the polished floor
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, sill, g.W, g.H - sill);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.translate(0, sill * 2);
    ctx.scale(1, -0.6);
    ctx.translate(0, -sill * 0.0);
    ctx.drawImage(state.garden, 0, 0);
    ctx.restore();
    // sill rail
    ctx.fillStyle = '#6a4a2e';
    ctx.fillRect(0, sill, g.W, g.H * 0.016);
    ctx.fillStyle = '#8a6540';
    ctx.fillRect(0, sill, g.W, 1);
    // lattice kick panels below the glass
    // posts and mullions
    const pw = Math.max(2, g.W * 0.016);
    for (const p of POSTS) {
      const x = p * g.W - pw / 2;
      ctx.fillStyle = '#3d2a1c';
      ctx.fillRect(x, 0, pw, sill + g.H * 0.016);
      ctx.fillStyle = '#5a3f28';
      ctx.fillRect(x + pw * 0.2, 0, Math.max(1, pw * 0.15), sill);
    }
    // glass door grid: slim muntins
    ctx.fillStyle = '#34261b';
    for (let k = 0; k < 4; k++) {
      const x0 = POSTS[k] * g.W;
      const x1 = POSTS[k + 1] * g.W;
      const mid = x0 + (x1 - x0) * 0.3;
      ctx.fillRect(mid - 1, top, 2, sill - top);
      for (let r = 1; r < 4; r++) ctx.fillRect(x0, top + (sill - top) * r / 4, x1 - x0, 1);
    }
    // glass sheen
    ctx.fillStyle = 'rgba(210,225,235,0.07)';
    for (let k = 0; k < 4; k++) {
      const x0 = POSTS[k] * g.W + pw;
      ctx.beginPath();
      ctx.moveTo(x0, top);
      ctx.lineTo(x0 + g.W * 0.05, top);
      ctx.lineTo(x0 + g.W * 0.01, sill);
      ctx.lineTo(x0 - g.W * 0.03, sill);
      ctx.fill();
    }
    // paper lamps hanging from the beam
    for (const lx of LAMPS) paintLamp(ctx, g, lx * g.W, top);
    return c;
  }

  function paintLamp(ctx, g, x, top) {
    const w = g.W * 0.045;
    const h = g.H * 0.17;
    const y = top + g.H * 0.05;
    ctx.strokeStyle = '#1c1612';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top - g.H * 0.03);
    ctx.lineTo(x, y);
    ctx.stroke();
    const body = ctx.createLinearGradient(x - w, 0, x + w, 0);
    body.addColorStop(0, '#b9692f');
    body.addColorStop(0.5, '#f3d79a');
    body.addColorStop(1, '#b9692f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y + h / 2, w, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,60,25,0.7)';
    for (let r = 1; r < 7; r++) {
      const yy = y + h * r / 7;
      const half = w * Math.sqrt(Math.max(0, 1 - Math.pow((yy - y - h / 2) / (h / 2), 2)));
      ctx.beginPath();
      ctx.moveTo(x - half, yy);
      ctx.lineTo(x + half, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#1e1813';
    ctx.fillRect(x - w * 0.45, y - 1, w * 0.9, g.H * 0.012);
    ctx.fillRect(x - w * 0.45, y + h - g.H * 0.006, w * 0.9, g.H * 0.012);
  }

  function makeGlow(size) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,196,110,0.55)');
    gr.addColorStop(0.35, 'rgba(230,140,70,0.22)');
    gr.addColorStop(1, 'rgba(200,100,50,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function makePool(g, rand) {
    const rain = {
      x: new Float32Array(RAIN), y: new Float32Array(RAIN),
      v: new Float32Array(RAIN), l: new Float32Array(RAIN),
    };
    const top = g.H * CEIL;
    const sill = g.H * SILL;
    for (let i = 0; i < RAIN; i++) {
      rain.x[i] = rand() * g.W;
      rain.y[i] = top + rand() * (sill - top);
      rain.v[i] = g.H * (0.9 + rand() * 0.5);
      rain.l[i] = g.H * (0.025 + rand() * 0.03);
    }
    const rip = { x: new Float32Array(RIPPLES), y: new Float32Array(RIPPLES), p: new Float32Array(RIPPLES) };
    for (let i = 0; i < RIPPLES; i++) {
      rip.x[i] = g.W * (0.05 + rand() * 0.9);
      rip.y[i] = g.H * (0.57 + rand() * 0.12);
      rip.p[i] = rand();
    }
    const drops = { x: new Float32Array(DROPS), y: new Float32Array(DROPS), v: new Float32Array(DROPS) };
    for (let i = 0; i < DROPS; i++) {
      drops.x[i] = g.W * (0.03 + rand() * 0.94);
      drops.y[i] = top + rand() * (sill - top);
      drops.v[i] = g.H * (0.02 + rand() * 0.04);
    }
    return { rain, rip, drops };
  }

  function drawRain(ctx, g, t, dt, amount) {
    const R = state.pool.rain;
    const top = g.H * CEIL;
    const sill = g.H * SILL;
    const n = Math.min(RAIN, Math.round(RAIN * amount * 0.6));
    ctx.strokeStyle = 'rgba(205,220,230,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] -= R.v[i] * dt * 0.12;
      if (R.y[i] > sill - g.H * 0.03 || R.x[i] < 0) {
        R.y[i] = top;
        R.x[i] = (i * 97.13 + t * 31.7) % g.W;
      }
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] + R.l[i] * 0.12, R.y[i] - R.l[i]);
    }
    ctx.stroke();
  }

  function drawRipples(ctx, g, t, amount) {
    const P = state.pool.rip;
    ctx.strokeStyle = 'rgba(190,205,205,0.5)';
    ctx.lineWidth = 1;
    const n = Math.min(RIPPLES, Math.round(RIPPLES * Math.min(1, amount)));
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.45 + P.p[i]) % 1;
      ctx.globalAlpha = 1 - ph;
      ctx.beginPath();
      ctx.ellipse(P.x[i], P.y[i], 1 + ph * g.W * 0.03, 0.5 + ph * g.W * 0.01, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDrops(ctx, g, dt, amount) {
    const D = state.pool.drops;
    const top = g.H * CEIL;
    const sill = g.H * SILL;
    ctx.fillStyle = 'rgba(220,232,240,0.45)';
    for (let i = 0; i < DROPS; i++) {
      D.y[i] += D.v[i] * dt * (0.5 + amount);
      if (D.y[i] > sill) D.y[i] = top;
      ctx.fillRect(D.x[i], D.y[i], 1, Math.max(2, g.H * 0.012));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows };
    const rand = K.rng(api.seed);
    state.g = g;
    state.garden = paintGarden(g, rand);
    state.frame = paintFrame(g);
    state.glow = makeGlow(Math.max(8, Math.round(g.W * 0.32)));
    state.pool = makePool(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, glow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.garden, 0, 0);
    ctx.fillStyle = 'rgba(70,90,110,0.12)';
    ctx.fillRect(0, g.H * CEIL, g.W, g.H * (SILL - CEIL));
    drawRipples(ctx, g, t, rain);
    drawRain(ctx, g, t, step, rain);
    ctx.drawImage(state.frame, 0, 0);
    drawDrops(ctx, g, step, rain);
    const gs = state.glow.width;
    const lampY = g.H * (CEIL + 0.14);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LAMPS.length; i++) {
      ctx.globalAlpha = Math.min(1, glow * (0.8 + 0.12 * Math.sin(t * 0.7 + i * 2.1)));
      ctx.drawImage(state.glow, LAMPS[i] * g.W - gs / 2, lampY - gs / 2);
      ctx.globalAlpha = Math.min(1, glow * 0.35);
      ctx.drawImage(state.glow, LAMPS[i] * g.W - gs / 2, g.H * 0.86 - gs / 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Kasuri.run({
    defaults: { rain: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
