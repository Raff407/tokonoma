/*
 * 熊猫 Xiongmao — a giant panda resting in a bamboo grove in morning mist.
 *
 * Three depths of bamboo are baked once as whole layers and sheared sideways each frame
 * to sway. The panda is baked once. Mist is a tiling strip; leaves are a small pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const LEAVES = 12;
  const MAX_LEAVES = 24;
  const LEAF_TONES = ['#6f8a4e', '#8a9a55', '#a9a65a', '#5c7a47'];
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
    const U = H / 100;
    return { W, H, U, gy: H * 0.86, cx: W * 0.5 };
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, '#c9d0c0');
    gr.addColorStop(0.45, '#dde0cf');
    gr.addColorStop(0.8, '#b9c3a6');
    gr.addColorStop(1, '#6f7f5a');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function stalk(ctx, x, y0, y1, w, base, light, rand) {
    ctx.fillStyle = base;
    ctx.fillRect(x - w / 2, y1, w, y0 - y1);
    ctx.fillStyle = light;
    ctx.fillRect(x - w / 2, y1, Math.max(0.6, w * 0.3), y0 - y1);
    const seg = w * 7 + 2;
    ctx.fillStyle = 'rgba(52,71,58,0.85)';
    for (let y = y0 - seg * (0.4 + rand() * 0.5); y > y1; y -= seg * (0.9 + rand() * 0.3)) {
      ctx.fillRect(x - w * 0.62, y, w * 1.24, Math.max(0.8, w * 0.28));
    }
  }

  function leafSpray(ctx, x, y, size, dir, tone, rand) {
    ctx.fillStyle = tone;
    for (let i = 0; i < 4; i++) {
      const a = dir * (0.3 + i * 0.45) + (rand() - 0.5) * 0.3 - 0.4;
      const len = size * (0.8 + rand() * 0.5);
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + len * 0.15,
        len * 0.5, Math.max(0.7, size * 0.1), a + 0.3, 0, TAU);
      ctx.fill();
    }
  }

  // One depth of bamboo: tall stalks that run off the top, with leaf sprays high up.
  function paintBamboo(g, rand, count, wMin, wMax, base, light, leaf, skipMid) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      let x = (i + 0.2 + rand() * 0.6) * (g.W / count);
      if (skipMid && Math.abs(x - g.cx) < g.W * 0.16) x += (x < g.cx ? -1 : 1) * g.W * 0.16;
      const w = g.U * (wMin + rand() * (wMax - wMin));
      const top = -g.U * 5;
      stalk(ctx, x, g.gy + g.U * 3, top, w, base, light, rand);
      for (let j = 0; j < 3; j++) {
        const y = g.H * (0.05 + rand() * 0.45);
        const d = rand() < 0.5 ? 1 : -1;
        leafSpray(ctx, x + d * w, y, g.U * (4 + wMax * 2), d > 0 ? 0 : Math.PI, leaf, rand);
      }
    }
    return c;
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, g.gy - g.U * 6, 0, g.H);
    gr.addColorStop(0, 'rgba(111,127,90,0)');
    gr.addColorStop(0.35, '#6a7a52');
    gr.addColorStop(1, '#3b4a36');
    ctx.fillStyle = gr;
    ctx.fillRect(0, g.gy - g.U * 6, g.W, g.H);
    ctx.fillStyle = '#7f8c5c';
    for (let i = 0; i < 90; i++) {
      blob(ctx, rand() * g.W, g.gy + rand() * (g.H - g.gy), g.U * (0.8 + rand() * 1.4), g.U * 0.25, (rand() - 0.5) * 0.4);
    }
    ctx.fillStyle = '#a79d5e';
    for (let i = 0; i < 30; i++) {
      blob(ctx, rand() * g.W, g.gy + g.U * 1.5 + rand() * (g.H - g.gy - g.U * 2), g.U * 0.9, g.U * 0.2, (rand() - 0.5));
    }
    return c;
  }

  // A seated panda seen from the front, one paw lifting a bamboo shoot to the mouth.
  function paintPanda(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const x = g.cx;
    const y = g.gy + u * 4;
    const INK = '#232b2a';
    const WHITE = '#ece8d9';
    const SHADE = '#bfbfb0';
    ctx.fillStyle = 'rgba(30,40,30,0.35)';
    blob(ctx, x, y + u * 1.5, u * 24, u * 3.2);
    // back legs
    ctx.fillStyle = INK;
    blob(ctx, x - u * 15, y - u * 3, u * 8.5, u * 5.5, -0.2);
    blob(ctx, x + u * 15, y - u * 3, u * 8.5, u * 5.5, 0.2);
    // body
    ctx.fillStyle = SHADE;
    blob(ctx, x, y - u * 15, u * 19, u * 15);
    ctx.fillStyle = WHITE;
    blob(ctx, x, y - u * 16.5, u * 18, u * 14);
    // black shoulder band and arms
    ctx.fillStyle = INK;
    blob(ctx, x, y - u * 24, u * 20, u * 5);
    blob(ctx, x - u * 15, y - u * 15, u * 5, u * 11, 0.28);
    blob(ctx, x + u * 15, y - u * 15, u * 5, u * 11, -0.28);
    // paws holding a shoot
    blob(ctx, x - u * 8.5, y - u * 25.5, u * 4, u * 3.4);
    blob(ctx, x + u * 8.5, y - u * 25.5, u * 4, u * 3.4);
    ctx.fillStyle = '#7f9a58';
    ctx.save();
    ctx.translate(x, y - u * 26.5);
    ctx.rotate(-0.12);
    ctx.fillRect(-u * 9, -u * 1.2, u * 18, u * 2.4);
    ctx.fillStyle = '#5c7a47';
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * u * 3.5, -u * 1.4, u * 0.5, u * 2.8);
    ctx.restore();
    // head
    const hy = y - u * 36;
    ctx.fillStyle = INK;
    blob(ctx, x - u * 9, hy - u * 9.5, u * 4.4, u * 4.4);
    blob(ctx, x + u * 9, hy - u * 9.5, u * 4.4, u * 4.4);
    ctx.fillStyle = SHADE;
    blob(ctx, x, hy + u * 0.6, u * 13.4, u * 11.4);
    ctx.fillStyle = WHITE;
    blob(ctx, x, hy, u * 13, u * 11);
    // eye patches, eyes, nose, mouth
    ctx.fillStyle = INK;
    blob(ctx, x - u * 5.3, hy - u * 0.5, u * 3, u * 4.2, 0.55);
    blob(ctx, x + u * 5.3, hy - u * 0.5, u * 3, u * 4.2, -0.55);
    ctx.fillStyle = WHITE;
    blob(ctx, x - u * 5, hy - u * 0.8, u * 0.9, u * 0.9);
    blob(ctx, x + u * 5, hy - u * 0.8, u * 0.9, u * 0.9);
    ctx.fillStyle = INK;
    blob(ctx, x, hy + u * 3.2, u * 2.1, u * 1.4);
    ctx.fillRect(x - u * 0.2, hy + u * 4, u * 0.4, u * 1.4);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.0);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(232,232,218,0.42)';
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * (w / 6);
      const y = h * (0.35 + 0.3 * K.fbm(i * 1.7, 2.2, 2, 7));
      for (const o of [-w, 0, w]) blob(ctx, x + o, y, w * 0.2, g.U * 3.2);
    }
    return c;
  }

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vy: f(), vx: f(), a: f(), p: f(), size: f(), tone: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = r() * g.W;
    L.y[i] = scatter ? r() * g.H * 0.9 : -g.U * 2;
    L.vy[i] = g.U * (2.4 + r() * 2);
    L.vx[i] = g.U * (0.4 + r() * 1.2);
    L.size[i] = g.U * (1.7 + r() * 1.3);
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
  }

  function stepLeaf(g, L, i, t, dt) {
    L.y[i] += L.vy[i] * dt;
    L.x[i] += (L.vx[i] + Math.sin(t * 0.9 + L.p[i]) * g.U * 1.6) * dt;
    L.a[i] += dt * 0.8;
    if (L.y[i] > g.gy + g.U * 6 || L.x[i] > g.W + g.U * 4) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.5 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.6, sz * 0.14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawSway(ctx, img, g, t, amp, phase, k) {
    const s = Math.sin(t * 0.55 + phase) * amp * 0.035 * k + Math.sin(t * 1.3 + phase * 2) * amp * 0.01 * k;
    ctx.setTransform(1, 0, s, 1, -s * g.gy, 0);
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMist(ctx, g, t, mist, y, speed, alpha) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * speed) % w;
    ctx.globalAlpha = Math.min(1, alpha * mist);
    ctx.drawImage(m, -a, y);
    ctx.drawImage(m, w - a, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.sky = paintSky(g);
    state.far = paintBamboo(g, rand, Math.max(8, Math.round(g.W / (g.U * 9))), 1.0, 1.6, '#8c9d7b', '#a9b698', '#8fa27f', false);
    state.mid = paintBamboo(g, rand, Math.max(5, Math.round(g.W / (g.U * 17))), 1.8, 2.8, '#5f7a4c', '#7e9565', '#6f8a4e', true);
    state.ground = paintGround(g, rand);
    state.panda = paintPanda(g);
    state.near = paintBamboo(g, rand, Math.max(3, Math.round(g.W / (g.U * 55))), 3.2, 4.4, '#3f5a3b', '#58744a', '#4d6a40', true);
    state.mist = paintMist(g);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, leaves, mist } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.sky, 0, 0);
    drawSway(ctx, state.far, g, t, sway, 0.4, 0.6);
    drawMist(ctx, g, t, mist, g.H * 0.3, 1.0, 0.75);
    drawSway(ctx, state.mid, g, t, sway, 2.1, 1.0);
    ctx.drawImage(state.ground, 0, 0);
    ctx.drawImage(state.panda, 0, 0);
    drawMist(ctx, g, t, mist, g.H * 0.62, -0.7, 0.45);
    drawSway(ctx, state.near, g, t, sway, 4.0, 1.5);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { sway: 1, leaves: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
