/*
 * 蛍 Hotaru — fireflies over a slow stream on a summer night.
 *
 * Each firefly wanders on its own noise and pulses slowly, the way a real one
 * does: long dark, a soft rise, a soft fall. The glow is one small sprite
 * drawn additively, with a dimmer copy on the water below. They drift towards
 * the cursor if it stays around.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { noise2, fbm, smoothstep } = K;

  const MAX_FLIES = 90;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGlow(radius) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(232,236,150,1)');
    grad.addColorStop(0.22, 'rgba(216,226,118,0.75)');
    grad.addColorStop(1, 'rgba(110,140,70,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function reed(ctx, x, y, h, lean, colour) {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  function paintBanks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.62);
    sky.addColorStop(0, '#0d1526');
    sky.addColorStop(1, '#2a4257');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#b6bfcb';
    for (let i = 0; i < g.W * 0.4; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#16282c';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.64);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.56 - fbm(x * 0.012, 2, 4, 6) * 0.3));
    ctx.lineTo(g.W, g.H * 0.64);
    ctx.fill();
    const water = ctx.createLinearGradient(0, g.H * 0.62, 0, g.H);
    water.addColorStop(0, '#2a4257');
    water.addColorStop(1, '#101c2a');
    ctx.fillStyle = water;
    ctx.fillRect(0, g.H * 0.62, g.W, g.H * 0.38);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b1414';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.93 + fbm(x * 0.03, 8, 3, 4) * 0.08));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (let i = 0; i < g.W * 0.45; i++) {
      const edge = Math.abs((i / (g.W * 0.45)) * 2 - 1);
      const h = g.U * (6 + rand() * 12 + edge * edge * 26);
      reed(ctx, rand() * g.W, g.H, h, (rand() - 0.5) * g.U * 7, rand() < 0.3 ? '#34503c' : '#1b2c26');
    }
    ctx.fillStyle = '#0d1a1a';
    ctx.beginPath();
    ctx.ellipse(g.W * 0.82, g.H * 0.68, g.U * 16, g.U * 4, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  function placeFlies(g, rand) {
    state.seed = new Float32Array(MAX_FLIES);
    state.fx = new Float32Array(MAX_FLIES);
    state.fy = new Float32Array(MAX_FLIES);
    state.pull = 0;
    for (let i = 0; i < MAX_FLIES; i++) {
      state.seed[i] = rand() * 1000;
      state.fx[i] = g.W * rand();
      state.fy[i] = g.H * (0.2 + rand() * 0.72);
    }
  }

  function pulse(t, seed) {
    const p = (t * 0.22 + seed) % 1;
    return smoothstep(0, 0.14, p) * (1 - smoothstep(0.14, 0.42, p));
  }

  function moveFly(g, i, t, dt, pointer) {
    const s = state.seed[i];
    const vx = noise2(t * 0.14, s, 1) - 0.5;
    const vy = noise2(s, t * 0.14, 2) - 0.5;
    state.fx[i] += vx * g.U * 11 * dt;
    state.fy[i] += vy * g.U * 8 * dt;
    if (pointer.active && i % 2 === 0) {
      state.fx[i] += (pointer.x - state.fx[i]) * 0.14 * dt;
      state.fy[i] += (pointer.y - state.fy[i]) * 0.14 * dt;
    }
    if (state.fx[i] < 0) state.fx[i] += g.W;
    if (state.fx[i] > g.W) state.fx[i] -= g.W;
    if (state.fy[i] < g.H * 0.12) state.fy[i] += dt * g.U * 6;
    if (state.fy[i] > g.H * 0.96) state.fy[i] -= dt * g.U * 6;
  }

  function drawFlies(ctx, g, t, dt, props, pointer) {
    const count = Math.min(MAX_FLIES, Math.round(40 * props.flies));
    const size = state.glow.width;
    const waterline = g.H * 0.62;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      moveFly(g, i, t, dt, pointer);
      const bright = Math.max(0.05, pulse(t, state.seed[i]));
      const x = state.fx[i] - size / 2;
      const y = state.fy[i] - size / 2;
      ctx.globalAlpha = bright;
      ctx.drawImage(state.glow, x, y);
      const mirror = waterline * 2 - state.fy[i];
      if (mirror > waterline && mirror < g.H) {
        ctx.globalAlpha = bright * 0.3;
        ctx.drawImage(state.glow, x + Math.sin(t * 2 + i) * g.U * 0.4, mirror - size / 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWater(ctx, g, t) {
    ctx.fillStyle = '#5f7f92';
    const step = Math.max(2, g.U * 3);
    for (let i = 0; i < 12; i++) {
      const y = g.H * 0.64 + i * step;
      const x = (noise2(i * 3.3, t * 0.05, 5) * 1.6 - 0.3) * g.W;
      ctx.globalAlpha = 0.14 + 0.1 * Math.sin(t * 0.6 + i);
      ctx.fillRect(x, y, g.U * (10 + i * 2), 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBanks(g, rand);
    state.front = paintFront(g, rand);
    state.glow = paintGlow(Math.max(3, g.U * 3.6));
    placeFlies(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t);
    drawFlies(ctx, g, t, dt, api.props, api.pointer);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { flies: 1, ramp: 'lines', cell: 8, boost: 0.3, gain: 1.2, tint: 0.5 },
    maxFps: 24,
    setup,
    draw,
  });
})();
