/*
 * 商店街 Shotengai — an empty covered arcade at night.
 *
 * Walls, shutters, awnings, noren and floor are baked once. Only rain on the
 * glass, a few floor ripples and the swaying lanterns with their reflections
 * move between repaints.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const VPY = 0.46;
  const HALF = 0.7;
  const EAVES = -0.4;
  const LINTEL = -0.12;
  const FLOOR = 0.5;
  const STEP = 0.8;
  const BAYS = 11;
  const DROPS = 90;
  const RIPPLES = 8;
  const AWNINGS = ['#3c5a3c', '#c8453a', '#2c3f8c'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const depth = (i) => 1.19 * Math.pow(STEP, i);

  // A point on a side wall: s is depth scale, h is height in screen heights.
  function px(g, side, s) {
    return g.W * 0.5 + side * g.W * HALF * s;
  }

  function py(g, s, h) {
    return g.H * VPY + h * g.H * s;
  }

  function quad(ctx, g, side, sa, sb, ha, hb) {
    ctx.beginPath();
    ctx.moveTo(px(g, side, sa), py(g, sa, ha));
    ctx.lineTo(px(g, side, sb), py(g, sb, ha));
    ctx.lineTo(px(g, side, sb), py(g, sb, hb));
    ctx.lineTo(px(g, side, sa), py(g, sa, hb));
    ctx.closePath();
  }

  function line(ctx, g, side, sa, sb, h) {
    ctx.beginPath();
    ctx.moveTo(px(g, side, sa), py(g, sa, h));
    ctx.lineTo(px(g, side, sb), py(g, sb, h));
    ctx.stroke();
  }

  // ---- sky seen through the glass ----------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, '#171a2c');
    grad.addColorStop(1, '#2b3454');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const far = ctx.createRadialGradient(g.W * 0.5, g.H * VPY, 0, g.W * 0.5, g.H * VPY, g.W * 0.2);
    far.addColorStop(0, 'rgba(120,138,170,0.55)');
    far.addColorStop(1, 'rgba(120,138,170,0)');
    ctx.fillStyle = far;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- walls -------------------------------------------------------------

  function paintShutter(ctx, g, side, sa, sb, tone) {
    quad(ctx, g, side, sa, sb, LINTEL, FLOOR);
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.strokeStyle = 'rgba(14,16,26,0.55)';
    ctx.lineWidth = 1;
    for (let h = LINTEL + 0.04; h < FLOOR; h += 0.045) line(ctx, g, side, sa, sb, h);
    ctx.strokeStyle = 'rgba(232,226,208,0.12)';
    for (let h = LINTEL + 0.062; h < FLOOR; h += 0.09) line(ctx, g, side, sa, sb, h);
  }

  function paintNoren(ctx, g, side, sa, sb) {
    quad(ctx, g, side, sa, sb, LINTEL, FLOOR);
    ctx.fillStyle = '#d9a73a';
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    const parts = 3;
    for (let k = 0; k < parts; k++) {
      const a = sa + ((sb - sa) * (k + 0.06)) / parts;
      const b = sa + ((sb - sa) * (k + 0.94)) / parts;
      quad(ctx, g, side, a, b, LINTEL, 0.12);
      ctx.fillStyle = '#2c3f8c';
      ctx.fill();
      quad(ctx, g, side, a, b, 0.06, 0.075);
      ctx.fillStyle = '#e8e2d0';
      ctx.fill();
    }
  }

  function paintVending(ctx, g, side, sa, sb) {
    const m = (sb - sa) * 0.3;
    quad(ctx, g, side, sa, sb, LINTEL, FLOOR);
    ctx.fillStyle = '#d9a73a';
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    quad(ctx, g, side, sa + m, sb - m, 0.0, FLOOR);
    ctx.fillStyle = '#e8e2d0';
    ctx.fill();
    const cols = ['#c8453a', '#2c3f8c', '#3c5a3c', '#d9a73a'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const a = sa + m + ((sb - sa - 2 * m) * (c + 0.15)) / 3;
        const b = sa + m + ((sb - sa - 2 * m) * (c + 0.85)) / 3;
        quad(ctx, g, side, a, b, 0.03 + r * 0.06, 0.07 + r * 0.06);
        ctx.fillStyle = cols[(r + c) % 4];
        ctx.fill();
      }
    }
  }

  function paintBay(ctx, g, side, i) {
    const sa = depth(i);
    const sb = depth(i + 1);
    const inset = (sa - sb) * 0.07;
    const a = sa - inset;
    const b = sb + inset;
    quad(ctx, g, side, sa, sb, EAVES, FLOOR);
    ctx.fillStyle = '#20233a';
    ctx.fill();
    const kind = (i + (side > 0 ? 2 : 0)) % 4;
    if (kind === 2) paintVending(ctx, g, side, a, b);
    else if (kind === 3) paintNoren(ctx, g, side, a, b);
    else paintShutter(ctx, g, side, a, b, kind === 0 ? '#3d4768' : '#4a5270');
    quad(ctx, g, side, a, b, LINTEL - 0.06, LINTEL);
    ctx.fillStyle = AWNINGS[(i + (side > 0 ? 1 : 0)) % 3];
    ctx.fill();
    quad(ctx, g, side, a, b, LINTEL - 0.012, LINTEL);
    ctx.fillStyle = '#e8e2d0';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    quad(ctx, g, side, a, b, EAVES + 0.03, LINTEL - 0.1);
    ctx.fillStyle = '#2a2f4c';
    ctx.fill();
  }

  // ---- floor and roof ribs -------------------------------------------------

  function paintFloor(ctx, g) {
    const y0 = py(g, 0.12, FLOOR);
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, '#3a4263');
    grad.addColorStop(1, '#15182a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(g, -1, 1.4), py(g, 1.4, FLOOR));
    ctx.lineTo(px(g, -1, 0.1), py(g, 0.1, FLOOR));
    ctx.lineTo(px(g, 1, 0.1), py(g, 0.1, FLOOR));
    ctx.lineTo(px(g, 1, 1.4), py(g, 1.4, FLOOR));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,134,170,0.22)';
    ctx.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(g.W * 0.5, g.H * VPY);
      ctx.lineTo(g.W * (0.5 + k * 0.4), g.H * 1.5);
      ctx.stroke();
    }
    for (let i = 0; i < BAYS; i++) {
      const y = py(g, depth(i), FLOOR);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(g.W, y);
      ctx.stroke();
    }
    for (let i = 1; i < BAYS - 1; i++) {
      const s = depth(i);
      const pool = ctx.createRadialGradient(g.W * 0.5, py(g, s, FLOOR), 0, g.W * 0.5, py(g, s, FLOOR), g.W * 0.45 * s);
      pool.addColorStop(0, 'rgba(226,150,70,0.18)');
      pool.addColorStop(1, 'rgba(226,150,70,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(0, py(g, s, FLOOR) - g.H * 0.1 * s, g.W, g.H * 0.2 * s);
    }
  }

  function paintRibs(ctx, g) {
    ctx.strokeStyle = '#161828';
    for (let i = 0; i < BAYS; i++) {
      const s = depth(i);
      ctx.lineWidth = Math.max(1, g.U * 0.5 * s * 1.5);
      const ey = py(g, s, EAVES);
      const ry = py(g, s, -0.64);
      ctx.beginPath();
      ctx.moveTo(px(g, -1, s), ey);
      ctx.quadraticCurveTo(g.W * 0.5, 2 * ry - ey, px(g, 1, s), ey);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (const t of [0.3, 0.7]) {
      ctx.beginPath();
      for (let i = 0; i < BAYS; i++) {
        const s = depth(i);
        const ey = py(g, s, EAVES);
        const ry = py(g, s, -0.64);
        const x = px(g, -1, s) + (px(g, 1, s) - px(g, -1, s)) * t;
        const y = ey + (2 * ry - ey - ey) * 2 * t * (1 - t);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFloor(ctx, g);
    for (let i = BAYS - 1; i >= 0; i--) {
      paintBay(ctx, g, -1, i);
      paintBay(ctx, g, 1, i);
    }
    ctx.fillStyle = '#c9d2e4';
    ctx.globalAlpha = 0.5;
    const e = py(g, depth(BAYS), 0);
    ctx.fillRect(g.W * 0.5 - g.W * 0.03, e - g.H * 0.02, g.W * 0.06, g.H * 0.04);
    ctx.globalAlpha = 1;
    paintRibs(ctx, g);
    return c;
  }

  // ---- sprites -------------------------------------------------------------

  function paintLantern() {
    const c = layer(24, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 24, 0);
    grad.addColorStop(0, '#9c2f20');
    grad.addColorStop(0.5, '#e86a42');
    grad.addColorStop(1, '#9c2f20');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(12, 16, 11, 12, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,16,10,0.6)';
    ctx.lineWidth = 1;
    for (let y = 8; y <= 24; y += 4) {
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(22, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#d9a73a';
    ctx.fillRect(7, 2, 10, 3);
    ctx.fillRect(7, 27, 10, 3);
    return c;
  }

  function paintGlow() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(236,160,84,0.6)');
    grad.addColorStop(1, 'rgba(236,160,84,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function drawRain(ctx, g, dt, amount) {
    if (amount <= 0) return;
    const n = Math.floor(DROPS * Math.min(1.5, amount));
    ctx.strokeStyle = 'rgba(170,186,214,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      state.dy[i] += state.dv[i] * dt * g.H;
      if (state.dy[i] > g.H * 0.58) {
        state.dy[i] = -g.H * 0.05;
        state.dx[i] = Math.random() * g.W * 1.2;
      }
      const len = g.U * (2 + state.dv[i] * 3);
      ctx.moveTo(state.dx[i] - state.dy[i] * 0.12, state.dy[i]);
      ctx.lineTo(state.dx[i] - state.dy[i] * 0.12 - len * 0.12, state.dy[i] + len);
    }
    ctx.stroke();
  }

  function drawRipples(ctx, g, t) {
    ctx.strokeStyle = 'rgba(190,200,224,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < RIPPLES; i++) {
      const r = (t * 0.5 + state.rp[i]) % 1;
      const s = state.rs[i];
      ctx.globalAlpha = (1 - r) * 0.8;
      ctx.beginPath();
      ctx.ellipse(g.W * state.rx[i], py(g, s, FLOOR - 0.03 * s), g.U * (0.5 + r * 4) * s, g.U * (0.2 + r * 1.2) * s, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function lanternPos(g, i, side, t) {
    const s = depth(i);
    return {
      s,
      x: px(g, side, s * 0.7) + Math.sin(t * 0.9 + i * 1.3 + side) * g.U * 0.35 * s,
      top: py(g, s, EAVES + 0.06),
      h: g.H * 0.13 * s,
    };
  }

  function drawLanterns(ctx, g, t, glow) {
    ctx.strokeStyle = '#161828';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < BAYS - 1; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const p = lanternPos(g, i, side, t);
        ctx.moveTo(px(g, side, p.s * 0.7), py(g, p.s, EAVES));
        ctx.lineTo(p.x, p.top);
      }
    }
    ctx.stroke();
    for (let i = BAYS - 2; i >= 1; i--) {
      for (let side = -1; side <= 1; side += 2) {
        const p = lanternPos(g, i, side, t);
        const w = p.h * 0.75;
        const gs = p.h * 4.2;
        ctx.globalAlpha = Math.min(1, 0.4 * glow);
        ctx.drawImage(state.glow, p.x - gs / 2, p.top + p.h / 2 - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        ctx.drawImage(state.lantern, p.x - w / 2, p.top, w, p.h);
        const fy = py(g, p.s, FLOOR);
        const ry = fy + (fy - p.top - p.h);
        const wob = Math.sin(t * 2.1 + i + side) * g.U * 0.15 * p.s;
        ctx.globalAlpha = 0.5 * Math.min(1, glow);
        ctx.drawImage(state.lantern, p.x - w / 2 + wob, ry, w, p.h * 1.3);
        ctx.globalAlpha = 0.18 * Math.min(1, glow);
        ctx.fillStyle = '#e89a52';
        ctx.fillRect(p.x - w * 0.9 - wob, ry + p.h * 0.5, w * 1.8, Math.max(1, g.U * 0.25));
        ctx.globalAlpha = 1;
      }
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed || 7);
    state.g = g;
    state.sky = paintSky(g);
    state.front = paintFront(g);
    state.lantern = paintLantern();
    state.glow = paintGlow();
    state.dx = new Float32Array(DROPS * 2);
    state.dy = new Float32Array(DROPS * 2);
    state.dv = new Float32Array(DROPS * 2);
    for (let i = 0; i < DROPS * 2; i++) {
      state.dx[i] = rand() * g.W * 1.2;
      state.dy[i] = rand() * g.H * 0.58;
      state.dv[i] = 0.45 + rand() * 0.5;
    }
    state.rx = new Float32Array(RIPPLES);
    state.rs = new Float32Array(RIPPLES);
    state.rp = new Float32Array(RIPPLES);
    for (let i = 0; i < RIPPLES; i++) {
      state.rx[i] = 0.2 + rand() * 0.6;
      state.rs[i] = 0.35 + rand() * 0.6;
      state.rp[i] = rand();
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.sky, 0, 0);
    drawRain(ctx, g, dt, api.props.rain);
    ctx.drawImage(state.front, 0, 0);
    drawRipples(ctx, g, t);
    drawLanterns(ctx, g, t, api.props.glow);
  }

  Kasuri.run({
    defaults: { rain: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
