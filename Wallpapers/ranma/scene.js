/*
 * 欄間 Ranma — a carved transom of pine and waves above a sliding paper door.
 *
 * The room, the glowing backlight, the carving and the door are baked once. Per frame
 * a tiling strip of slanted light shafts slides across the openings and the paper, the
 * carving's shadow is laid on the paper and swayed a little, and a few motes drift.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const WALL = '#2a2620';
  const WALL_LIT = '#3a3328';
  const WOOD = { dark: '#2b1f16', mid: '#4a3524', lit: '#7a5a38', edge: '#9a7648' };
  const GLOW = ['#e8cf94', '#d9b26a', '#c4954a'];
  const PAPER = ['#d8ceb0', '#c9bd9c'];
  const NEEDLE = ['#2a2a1c', '#3a4126', '#56602f'];
  const DUST = 16;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const rx0 = Math.round(W * 0.05);
    const rx1 = Math.round(W * 0.95);
    const ry0 = Math.round(H * 0.09);
    const ry1 = Math.round(H * 0.4);
    const sy0 = Math.round(H * 0.44);
    const sy1 = Math.round(H * 0.91);
    return { W, H, rx0, rx1, ry0, ry1, sy0, sy1, RH: ry1 - ry0, SH: sy1 - sy0, u: (ry1 - ry0) / 30 };
  }

  // ---- the room ------------------------------------------------------------

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = WALL_LIT;
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, rand() * g.H, g.u * (2 + rand() * 6), Math.max(1, g.u * 0.3));
    // upper beam and lower rail
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.rx0 - g.u, g.ry0 - g.u * 2.6, g.rx1 - g.rx0 + g.u * 2, g.u * 2.6);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(g.rx0 - g.u, g.ry0 - g.u * 2.6, g.rx1 - g.rx0 + g.u * 2, Math.max(1, g.u * 0.4));
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(g.rx0 - g.u, g.ry1, g.rx1 - g.rx0 + g.u * 2, g.sy0 - g.ry1);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(g.rx0 - g.u, g.ry1, g.rx1 - g.rx0 + g.u * 2, Math.max(1, g.u * 0.4));
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.rx0 - g.u, g.sy0 - g.u * 0.8, g.rx1 - g.rx0 + g.u * 2, g.u * 0.8);
    // floor mat with a dark braided edge
    const fy = g.sy1;
    ctx.fillStyle = '#6e6a42';
    ctx.fillRect(0, fy + g.u * 1.6, g.W, g.H - fy);
    ctx.fillStyle = '#3c3a24';
    ctx.fillRect(0, fy + g.u * 1.6, g.W, g.u * 1.1);
    ctx.fillStyle = '#7e7a4c';
    for (let y = fy + g.u * 3.4; y < g.H; y += g.u * 0.9) ctx.fillRect(0, y, g.W, Math.max(1, g.u * 0.2));
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.rx0 - g.u, fy, g.rx1 - g.rx0 + g.u * 2, g.u * 1.6);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(g.rx0 - g.u, fy, g.rx1 - g.rx0 + g.u * 2, Math.max(1, g.u * 0.3));
    // side posts
    for (const x of [g.rx0 - g.u * 2.4, g.rx1 + g.u * 0.2]) {
      ctx.fillStyle = WOOD.mid;
      ctx.fillRect(x, g.ry0 - g.u * 2.6, g.u * 2.2, fy + g.u * 1.6 - g.ry0 + g.u * 2.6);
      ctx.fillStyle = WOOD.lit;
      ctx.fillRect(x, g.ry0 - g.u * 2.6, Math.max(1, g.u * 0.4), fy + g.u * 1.6 - g.ry0 + g.u * 2.6);
    }
    return c;
  }

  function paintDoor(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const w = g.rx1 - g.rx0;
    const pw = w / 4;
    const t = Math.max(1, g.u * 0.35);
    for (let p = 0; p < 4; p++) {
      const x0 = g.rx0 + p * pw;
      ctx.fillStyle = PAPER[p % 2];
      ctx.fillRect(x0, g.sy0, pw, g.SH);
      ctx.fillStyle = WOOD.mid;
      for (let y = g.sy0 + g.u * 2; y < g.sy1 - g.u; y += g.u * 5.2) ctx.fillRect(x0, y, pw, t);
      for (let i = 1; i < 3; i++) ctx.fillRect(x0 + (pw * i) / 3, g.sy0, t, g.SH);
      // solid lower panel
      ctx.fillStyle = WOOD.mid;
      ctx.fillRect(x0, g.sy1 - g.u * 4, pw, g.u * 4);
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(x0 + g.u * 0.8, g.sy1 - g.u * 3.2, pw - g.u * 1.6, g.u * 2.4);
      // frame
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(x0, g.sy0, g.u * 0.9, g.SH);
      ctx.fillRect(x0 + pw - g.u * 0.9, g.sy0, g.u * 0.9, g.SH);
    }
    ctx.fillRect(g.rx0, g.sy0, w, g.u * 0.9);
    // round pull on the meeting stile
    ctx.fillStyle = '#7a2a1c';
    blob(ctx, g.rx0 + pw * 2, g.sy0 + g.SH * 0.55, g.u * 0.9, g.u * 0.9);
    ctx.fillStyle = '#b8503a';
    blob(ctx, g.rx0 + pw * 2 - g.u * 0.2, g.sy0 + g.SH * 0.55 - g.u * 0.2, g.u * 0.4, g.u * 0.4);
    return c;
  }

  // ---- the carving ---------------------------------------------------------

  function pad(ctx, x, y, w, h, tilt, rand) {
    ctx.fillStyle = NEEDLE[0];
    blob(ctx, x, y, w, h, tilt);
    ctx.fillStyle = NEEDLE[1];
    blob(ctx, x - w * 0.12, y - h * 0.2, w * 0.78, h * 0.62, tilt);
    ctx.strokeStyle = NEEDLE[2];
    ctx.lineWidth = Math.max(1, h * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * w * (0.9 + rand() * 0.2), y + Math.sin(a) * h * 1.1);
    }
    ctx.stroke();
  }

  function pineBranch(ctx, g, rand) {
    const u = g.u * 1.5;
    const ox = g.rx0 + u * 2;
    const oy = g.ry0 + g.RH * 0.78;
    ctx.strokeStyle = WOOD.dark;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.7;
    const spine = [[ox, oy + u * 4], [ox + u * 9, oy - u * 3], [ox + u * 17, oy - u * 6.5], [ox + u * 25, oy - u * 5]];
    ctx.beginPath();
    ctx.moveTo(spine[0][0], spine[0][1]);
    ctx.bezierCurveTo(spine[1][0], spine[1][1], spine[2][0], spine[2][1], spine[3][0], spine[3][1]);
    ctx.stroke();
    ctx.lineWidth = u * 0.9;
    ctx.beginPath();
    ctx.moveTo(ox + u * 10, oy - u * 3.2);
    ctx.quadraticCurveTo(ox + u * 12, oy - u * 9, ox + u * 17, oy - u * 12);
    ctx.moveTo(ox + u * 16, oy - u * 6.3);
    ctx.quadraticCurveTo(ox + u * 22, oy - u * 1, ox + u * 27, oy + u * 1.5);
    ctx.stroke();
    ctx.strokeStyle = WOOD.mid;
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(spine[0][0], spine[0][1] - u * 0.5);
    ctx.bezierCurveTo(spine[1][0], spine[1][1] - u * 0.5, spine[2][0], spine[2][1] - u * 0.5, spine[3][0], spine[3][1] - u * 0.5);
    ctx.stroke();
    const pads = [
      [ox + u * 9, oy - u * 6.5, 5.2, 2.2, -0.15], [ox + u * 17, oy - u * 14, 5.4, 2.3, 0.1],
      [ox + u * 23, oy - u * 9, 5.6, 2.4, 0.05], [ox + u * 28, oy - u * 5, 4.6, 2, 0.2],
      [ox + u * 29, oy + u * 2.6, 5, 2.1, 0.15], [ox + u * 14, oy - u * 0.5, 4.2, 1.8, -0.1],
    ];
    for (const p of pads) pad(ctx, p[0], p[1], p[2] * u, p[3] * u, p[4], rand);
  }

  function waves(ctx, g) {
    const u = g.u;
    const r = u * 7;
    const base = g.ry1 - u * 1.4;
    ctx.lineCap = 'butt';
    for (let row = 0; row < 3; row++) {
      const y = base - row * r * 0.52;
      const off = row % 2 ? r : 0;
      for (let x = g.rx0 + g.W * 0.4 + off; x < g.rx1 + r; x += r * 2) {
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k === 1 ? WOOD.mid : WOOD.dark;
          ctx.lineWidth = Math.max(1, u * (k === 1 ? 0.7 : 1.2));
          ctx.beginPath();
          ctx.arc(x, y, r * (1 - k * 0.28), Math.PI, 0);
          ctx.stroke();
        }
      }
    }
  }

  function paintCarving(g, rand) {
    const c = layer(g.W, g.RH + g.u * 3);
    const ctx = c.getContext('2d');
    const u = g.u;
    ctx.translate(0, -(g.ry0 - u * 0.5));
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.rx0, g.ry0, g.rx1 - g.rx0, g.RH);
    ctx.clip();
    // lattice bars behind the carving
    ctx.fillStyle = WOOD.dark;
    for (let i = 1; i < 6; i++) ctx.fillRect(g.rx0 + ((g.rx1 - g.rx0) * i) / 6, g.ry0, Math.max(1, u * 0.7), g.RH);
    pineBranch(ctx, g, rand);
    waves(ctx, g);
    // a small rising sun disc cut as a ring
    ctx.strokeStyle = WOOD.dark;
    ctx.lineWidth = u * 1.3;
    ctx.beginPath();
    ctx.arc(g.rx0 + g.W * 0.62, g.ry0 + g.RH * 0.3, u * 4.2, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // frame
    const f = u * 1.2;
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.rx0, g.ry0, g.rx1 - g.rx0, f);
    ctx.fillRect(g.rx0, g.ry1 - f, g.rx1 - g.rx0, f);
    ctx.fillRect(g.rx0, g.ry0, f, g.RH);
    ctx.fillRect(g.rx1 - f, g.ry0, f, g.RH);
    ctx.fillStyle = WOOD.edge;
    ctx.fillRect(g.rx0, g.ry0, g.rx1 - g.rx0, Math.max(1, u * 0.3));
    return c;
  }

  // The carving flattened to a soft dark shape, to lay on the paper as shadow.
  function paintShadow(g, carving) {
    const c = layer(g.W, g.RH * 1.1 + g.u * 3);
    const ctx = c.getContext('2d');
    ctx.drawImage(carving, 0, 0, carving.width, carving.height, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#4a4030';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function paintBacklight(g) {
    const c = layer(g.W, g.RH);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.RH);
    grad.addColorStop(0, GLOW[2]);
    grad.addColorStop(0.5, GLOW[1]);
    grad.addColorStop(1, GLOW[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.RH);
    return c;
  }

  // Slanted bands of light, wrapped so the strip tiles sideways.
  function paintShafts(g, rand) {
    const h = g.sy1 - g.ry0;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const skew = -0.5;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const w = g.W * (0.07 + rand() * 0.07);
      const x = (g.W * (i + 0.3 + rand() * 0.4)) / count + h * 0.25;
      for (const wrap of [-g.W, 0, g.W]) {
        ctx.setTransform(1, 0, skew, 1, 0, 0);
        const grad = ctx.createLinearGradient(x + wrap - w, 0, x + wrap + w, 0);
        grad.addColorStop(0, 'rgba(250,228,160,0)');
        grad.addColorStop(0.5, 'rgba(250,228,160,' + (0.5 + rand() * 0.2).toFixed(2) + ')');
        grad.addColorStop(1, 'rgba(250,228,160,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + wrap - w, 0, w * 2, h);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  // ---- per frame -----------------------------------------------------------

  function tile(ctx, src, sy, sh, dy, off, alpha) {
    const w = state.g.W;
    const x = -(((off % w) + w) % w);
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, 0, sy, w, sh, x, dy, w, sh);
    ctx.drawImage(src, 0, sy, w, sh, x + w, dy, w, sh);
    ctx.globalAlpha = 1;
  }

  function makeDust(g, rand) {
    const d = { x: new Float32Array(DUST), y: new Float32Array(DUST), v: new Float32Array(DUST), p: new Float32Array(DUST) };
    for (let i = 0; i < DUST; i++) {
      d.x[i] = rand() * g.W;
      d.y[i] = g.ry0 + rand() * (g.sy1 - g.ry0);
      d.v[i] = 0.4 + rand() * 0.8;
      d.p[i] = rand() * TAU;
    }
    return d;
  }

  function drawDust(ctx, g, t, dt, amount) {
    const d = state.dust;
    const n = Math.min(DUST, Math.round(DUST * amount * 0.5));
    ctx.fillStyle = '#f2dca0';
    for (let i = 0; i < n; i++) {
      d.y[i] += d.v[i] * dt * g.u * 0.5;
      d.x[i] += Math.sin(t * 0.4 + d.p[i]) * dt * g.u * 0.6;
      if (d.y[i] > g.sy1) {
        d.y[i] = g.ry0;
        d.x[i] = (d.x[i] * 7.3 + 11) % g.W;
      }
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 0.8 + d.p[i]);
      ctx.fillRect(d.x[i], d.y[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g, rand);
    state.door = paintDoor(g);
    state.carving = paintCarving(g, rand);
    state.shadow = paintShadow(g, state.carving);
    state.glow = paintBacklight(g);
    state.shafts = paintShafts(g, rand);
    state.dust = makeDust(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { shafts, dapple, dust } = api.props;
    const drift = t * g.W * 0.02;
    const breath = 0.7 + 0.3 * Math.sin(t * 0.35);
    ctx.drawImage(state.room, 0, 0);
    ctx.drawImage(state.glow, 0, g.ry0);
    tile(ctx, state.shafts, 0, g.RH, g.ry0, drift, Math.min(1, shafts * breath));
    ctx.drawImage(state.carving, 0, g.ry0 - g.u * 0.5);
    ctx.drawImage(state.door, 0, 0);
    // carving shadow swaying on the paper, kept inside the door
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.rx0, g.sy0, g.rx1 - g.rx0, g.SH);
    ctx.clip();
    const sway = Math.sin(t * 0.3) * g.u * 1.6 * dapple;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(state.shadow, sway, g.sy0 + g.u * 0.5);
    ctx.globalAlpha = 1;
    tile(ctx, state.shafts, g.sy0 - g.ry0, g.SH, g.sy0, drift * 1.15, Math.min(1, shafts * breath * 1.2));
    ctx.restore();
    drawDust(ctx, g, t, Math.min(dt, 0.1), dust);
  }

  Kasuri.run({
    defaults: { shafts: 1, dapple: 1, dust: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
