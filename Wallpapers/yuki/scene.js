/*
 * 雪 Yuki — a mountain village at night under falling snow.
 *
 * Hills, steep thatched roofs and pines are baked once. Each window breathes
 * on its own slow noise and now and then someone goes to bed. Snow falls in
 * three depths; chimney smoke rises and leans with the same wind.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp } = K;

  const FLAKE = '#e9eef5';
  const SMOKE = '#8d97ac';
  const LIGHT = '#e8b56c';
  const MAX_FLAKES = 900;
  const MAX_SMOKE = 80;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function ridge(ctx, g, base, rise, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * (base - fbm(x * scale, seed, 4, seed) * rise));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function pine(ctx, x, y, h) {
    ctx.fillStyle = '#10171d';
    ctx.fillRect(x - 0.5, y - h * 0.2, 1, h * 0.2);
    for (let k = 0; k < 4; k++) {
      const w = h * (0.34 - k * 0.07);
      const top = y - h * (0.42 + k * 0.2);
      ctx.fillStyle = '#10171d';
      ctx.beginPath();
      ctx.moveTo(x - w, top + h * 0.26);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w, top + h * 0.26);
      ctx.fill();
      ctx.fillStyle = '#b9c3d3';
      ctx.fillRect(x - w * 0.5, top + h * 0.09, w, Math.max(1, h * 0.04));
    }
  }

  function house(ctx, g, windows, chimneys, x, y, s) {
    const w = s;
    const roof = s * 0.82;
    const wall = s * 0.34;
    ctx.fillStyle = '#1c1a1d';
    ctx.fillRect(x - w * 0.42, y - wall, w * 0.84, wall);
    ctx.fillStyle = '#c4ccd9';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.58, y - wall);
    ctx.lineTo(x, y - wall - roof);
    ctx.lineTo(x + w * 0.58, y - wall);
    ctx.fill();
    ctx.fillStyle = '#7c879c';
    ctx.beginPath();
    ctx.moveTo(x, y - wall - roof);
    ctx.lineTo(x + w * 0.58, y - wall);
    ctx.lineTo(x + w * 0.16, y - wall);
    ctx.fill();
    const panes = 2 + (s > g.U * 12 ? 1 : 0);
    for (let i = 0; i < panes; i++) {
      windows.push({
        x: x - w * 0.32 + ((i + 0.15) / panes) * w * 0.62,
        y: y - wall * 0.78,
        w: Math.max(1, (w * 0.5) / panes),
        h: Math.max(1, wall * 0.5),
        seed: windows.length * 7.3 + x,
      });
    }
    chimneys.push({ x: x - w * 0.12, y: y - wall - roof * 0.62 });
  }

  function paintScene(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
    sky.addColorStop(0, '#0a0f20');
    sky.addColorStop(1, '#2d3756');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ridge(ctx, g, 0.66, 0.34, 0.009, 2, '#4a5674');
    ridge(ctx, g, 0.78, 0.22, 0.016, 9, '#76839d');
    ridge(ctx, g, 0.86, 0.12, 0.02, 15, '#a3aec2');
    const windows = [];
    const chimneys = [];
    const spots = [0.14, 0.31, 0.5, 0.66, 0.84];
    spots.forEach((fx, i) => {
      const y = g.H * (0.78 + (i % 2) * 0.05);
      for (let p = 0; p < 4; p++) pine(ctx, g.W * (fx + 0.06 + rand() * 0.06), y + g.U, g.U * (8 + rand() * 8));
      house(ctx, g, windows, chimneys, g.W * fx, y, g.U * (11 + rand() * 6));
    });
    ctx.fillStyle = '#ccd4e0';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.88 + fbm(x * 0.02, 4, 3, 3) * 0.05));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    return { canvas: c, windows, chimneys };
  }

  function drawWindows(ctx, t) {
    ctx.fillStyle = LIGHT;
    for (const w of state.scene.windows) {
      const lit = noise2(t * 0.012, w.seed, 4);
      const flicker = noise2(t * 0.9, w.seed, 8) * 0.18;
      ctx.globalAlpha = K.smoothstep(0.34, 0.42, lit) * (0.72 + flicker);
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalAlpha = 1;
  }

  function resetFlake(g, i, anywhere) {
    const r = state.rand;
    const near = i % 3;
    state.fx[i] = r() * g.W;
    state.fy[i] = anywhere ? r() * g.H : -2;
    state.fv[i] = g.U * (3 + near * 3.5 + r() * 2);
    state.fp[i] = r() * 6.28;
  }

  function drawSnow(ctx, g, t, dt, props) {
    const count = Math.min(MAX_FLAKES, Math.round(g.W * 2.4 * props.snow));
    const drift = props.wind * g.U * 3.5;
    ctx.fillStyle = FLAKE;
    for (let i = 0; i < count; i++) {
      state.fy[i] += state.fv[i] * dt;
      state.fx[i] += (drift + Math.sin(t * 0.8 + state.fp[i]) * g.U * 1.6) * dt;
      if (state.fy[i] > g.H) resetFlake(g, i, false);
      if (state.fx[i] > g.W) state.fx[i] -= g.W;
      if (state.fx[i] < 0) state.fx[i] += g.W;
      const near = i % 3;
      ctx.globalAlpha = 0.35 + near * 0.28;
      const size = near === 2 && g.U > 0.9 ? 2 : 1;
      ctx.fillRect(state.fx[i], state.fy[i], size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, dt, props) {
    const chimneys = state.scene.chimneys;
    ctx.fillStyle = SMOKE;
    for (let i = 0; i < MAX_SMOKE; i++) {
      state.sl[i] -= dt / 6;
      if (state.sl[i] <= 0) {
        const c = chimneys[i % chimneys.length];
        state.sx[i] = c.x;
        state.sy[i] = c.y;
        state.sl[i] = 0.4 + state.rand() * 0.6;
      }
      state.sy[i] -= g.U * 2.4 * dt;
      state.sx[i] += props.wind * g.U * (1 + (1 - state.sl[i]) * 3) * dt;
      ctx.globalAlpha = state.sl[i] * 0.34;
      ctx.fillRect(state.sx[i], state.sy[i], 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.scene = paintScene(g, rand);
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, i, true);
    state.sx = new Float32Array(MAX_SMOKE);
    state.sy = new Float32Array(MAX_SMOKE);
    state.sl = new Float32Array(MAX_SMOKE);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.scene.canvas, 0, 0);
    drawWindows(ctx, t);
    drawSmoke(ctx, g, dt, api.props);
    drawSnow(ctx, g, t, dt, api.props);
  }

  Kasuri.run({
    defaults: { snow: 1, wind: 1, ramp: 'lines', cell: 8, boost: 0.2, gain: 1.1 },
    maxFps: 24,
    setup,
    draw,
  });
})();
