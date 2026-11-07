/*
 * 海月 Kurage — moon jellyfish rising through deep indigo water.
 *
 * Each bell contracts and relaxes on its own slow beat and lifts a little on
 * every stroke, sinking between. Tentacles are chains that follow the bell's
 * past, so they trail behind it. Pale light falls from above; marine snow
 * drifts down. The cursor makes them turn away, gently.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const BELL = '#dfe4e6';
  const BELL_EDGE = '#e9e9de';
  const CORE = '#b86a7d';
  const TENTACLE = '#8fa3b8';
  const SNOW = '#a9bacb';
  const MAX_JELLIES = 16;
  const MAX_SNOW = 240;
  const TENTACLES = 5;
  const SEGMENTS = 9;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintDeep(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#2a5579');
    grad.addColorStop(0.5, '#153154');
    grad.addColorStop(1, '#0b1730');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Shafts of light that lean and tile sideways.
  function paintShafts(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const profile = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      profile[x] = lerp(fbm(x * 0.05, 2, 2, 3), fbm((x - w) * 0.05, 2, 2, 3), x / w);
    }
    const lean = 0.35;
    for (let y = 0; y < h; y++) {
      const fall = Math.pow(1 - y / h, 1.6);
      const shift = Math.floor(y * lean);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 186;
        img.data[i + 2] = 208;
        img.data[i + 3] = smoothstep(0.5, 0.68, profile[(x + shift) % w]) * fall * 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeJelly(g, rand, anywhere) {
    const size = g.U * (5 + rand() * rand() * 10);
    const trail = new Float32Array(SEGMENTS * 2);
    const jelly = {
      x: rand() * g.W,
      y: anywhere ? rand() * g.H : g.H + size * 5,
      size,
      phase: rand() * 6.28,
      beat: 0.45 + rand() * 0.3,
      drift: (rand() - 0.5) * g.U * 1.4,
      trail,
      alpha: lerp(0.6, 1, smoothstep(g.U * 5, g.U * 13, size)),
    };
    for (let i = 0; i < SEGMENTS; i++) {
      trail[i * 2] = jelly.x;
      trail[i * 2 + 1] = jelly.y + i * size * 0.35;
    }
    return jelly;
  }

  function moveJelly(g, j, t, dt, pointer) {
    const stroke = Math.sin(t * j.beat * 3 + j.phase);
    const push = Math.max(0, stroke);
    j.y += (-push * g.U * 5.4 + g.U * 1.1) * dt;
    j.x += (j.drift + Math.sin(t * 0.13 + j.phase) * g.U * 0.9) * dt;
    if (pointer.active) {
      const dx = j.x - pointer.x;
      const dy = j.y - pointer.y;
      const reach = g.U * 24;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach * reach && d2 > 1) j.x += (dx / Math.sqrt(d2)) * g.U * 6 * dt;
    }
    if (j.x < -j.size * 2) j.x = g.W + j.size * 2;
    if (j.x > g.W + j.size * 2) j.x = -j.size * 2;
    if (j.y < -j.size * 6) j.y = g.H + j.size * 6;
    followTrail(j, dt);
    return stroke;
  }

  function followTrail(j, dt) {
    const trail = j.trail;
    const gap = j.size * 0.6;
    const ease = Math.min(1, dt * 4);
    trail[0] += (j.x - trail[0]) * ease;
    trail[1] += (j.y - trail[1]) * ease;
    for (let i = 1; i < SEGMENTS; i++) {
      const dx = trail[i * 2] - trail[(i - 1) * 2];
      const dy = trail[i * 2 + 1] - trail[(i - 1) * 2 + 1];
      const d = Math.hypot(dx, dy) || 1;
      trail[i * 2] = trail[(i - 1) * 2] + (dx / d) * gap;
      trail[i * 2 + 1] = trail[(i - 1) * 2 + 1] + (dy / d) * gap + dt * j.size * 0.2;
    }
  }

  function drawTentacles(ctx, j, t, width) {
    ctx.strokeStyle = TENTACLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < TENTACLES; k++) {
      const spread = ((k / (TENTACLES - 1)) * 2 - 1) * width * 0.82;
      ctx.moveTo(j.x + spread, j.y);
      for (let i = 1; i < SEGMENTS; i++) {
        const f = i / SEGMENTS;
        const wave = Math.sin(t * 1.2 + i * 0.8 + k * 1.3 + j.phase) * j.size * 0.24 * f;
        ctx.lineTo(j.trail[i * 2] + spread * (1 - f * 0.25) + wave, j.trail[i * 2 + 1]);
      }
    }
    ctx.stroke();
  }

  function drawBell(ctx, j, width, height) {
    ctx.fillStyle = BELL;
    ctx.beginPath();
    ctx.moveTo(j.x - width, j.y);
    ctx.bezierCurveTo(j.x - width, j.y - height * 1.3, j.x + width, j.y - height * 1.3, j.x + width, j.y);
    ctx.quadraticCurveTo(j.x, j.y - height * 0.28, j.x - width, j.y);
    ctx.fill();
    ctx.strokeStyle = BELL_EDGE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = CORE;
    const r = width * 0.2;
    ctx.globalAlpha *= 0.85;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.arc(j.x + k * r * 1.1, j.y - height * 0.42, r, 0, 6.3);
      ctx.fill();
    }
  }

  function drawJellies(ctx, g, t, dt, props, pointer) {
    const count = Math.min(MAX_JELLIES, Math.round(9 * props.jellies));
    for (let i = 0; i < count; i++) {
      const j = state.jellies[i];
      const stroke = moveJelly(g, j, t, dt, pointer);
      const width = j.size * (1 - stroke * 0.16);
      const height = j.size * (0.72 + stroke * 0.2);
      ctx.globalAlpha = j.alpha * 0.7;
      drawTentacles(ctx, j, t, width);
      ctx.globalAlpha = j.alpha * 0.95;
      drawBell(ctx, j, width, height);
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(ctx, g, t, dt) {
    ctx.fillStyle = SNOW;
    for (let i = 0; i < MAX_SNOW; i++) {
      state.sy[i] += state.sv[i] * dt;
      if (state.sy[i] > g.H) state.sy[i] = 0;
      ctx.globalAlpha = 0.14 + (i % 4) * 0.1;
      ctx.fillRect(state.sx[i] + Math.sin(t * 0.3 + i) * g.U, state.sy[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.deep = paintDeep(g);
    state.shafts = paintShafts(Math.ceil(g.W * 1.2), g.H);
    state.jellies = [];
    for (let i = 0; i < MAX_JELLIES; i++) state.jellies.push(makeJelly(g, rand, true));
    state.jellies.sort((a, b) => a.size - b.size);
    state.sx = new Float32Array(MAX_SNOW);
    state.sy = new Float32Array(MAX_SNOW);
    state.sv = new Float32Array(MAX_SNOW);
    for (let i = 0; i < MAX_SNOW; i++) {
      state.sx[i] = rand() * g.W;
      state.sy[i] = rand() * g.H;
      state.sv[i] = g.U * (0.5 + rand() * 1.4);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.deep, 0, 0);
    const w = state.shafts.width;
    const x = (t * g.U * 0.7) % w;
    ctx.drawImage(state.shafts, x, 0);
    ctx.drawImage(state.shafts, x - w, 0);
    drawSnow(ctx, g, t, dt);
    drawJellies(ctx, g, t, dt, api.props, api.pointer);
  }

  Kasuri.run({
    defaults: { jellies: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, tint: 0.5 },
    maxFps: 24,
    setup,
    draw,
  });
})();
