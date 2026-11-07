/*
 * 銀杏 Icho — a ginkgo avenue in November, the road gone gold.
 *
 * Trees step down a single vanishing point and are baked, nearest last. The
 * canopy breathes as one layer. Fan-shaped leaves fall in front in three sizes
 * and settle into nothing at the road.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const GOLD = ['#e6bc45', '#d8a734', '#f0d26a', '#c7952f'];
  const MAX_LEAVES = 420;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintRoad(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const vy = g.H * 0.5;
    const sky = ctx.createLinearGradient(0, 0, 0, vy);
    sky.addColorStop(0, '#7fa0b4');
    sky.addColorStop(1, '#efdcae');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, vy);
    const ground = ctx.createLinearGradient(0, vy, 0, g.H);
    ground.addColorStop(0, '#c99f42');
    ground.addColorStop(1, '#8c6a2a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, vy, g.W, g.H - vy);
    ctx.fillStyle = '#7f7a6c';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.5 - g.U * 0.6, vy);
    ctx.lineTo(g.W * 0.5 + g.U * 0.6, vy);
    ctx.lineTo(g.W * 0.66, g.H);
    ctx.lineTo(g.W * 0.34, g.H);
    ctx.fill();
    for (let i = 0; i < g.W * 3; i++) {
      const y = lerp(vy, g.H, Math.pow(rand(), 0.7));
      const f = (y - vy) / (g.H - vy);
      ctx.fillStyle = GOLD[Math.floor(rand() * GOLD.length)];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(rand() * g.W, y, Math.max(1, f * g.U * 2), Math.max(1, f * g.U));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintTree(ctx, g, rand, x, base, s) {
    const trunkH = s * 34;
    ctx.fillStyle = '#322419';
    ctx.fillRect(x - s * 1.6, base - trunkH, s * 3.2, trunkH);
    const puffs = 46;
    for (let i = 0; i < puffs; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const px = x + Math.cos(a) * d * s * 13;
      const py = base - trunkH * 1.1 + Math.sin(a) * d * s * 19 - s * 8;
      ctx.fillStyle = GOLD[Math.floor(rand() * GOLD.length)];
      ctx.beginPath();
      ctx.arc(px, py, s * (2 + rand() * 2.4), 0, 6.3);
      ctx.fill();
    }
  }

  function paintTrees(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const vx = g.W * 0.5;
    const vy = g.H * 0.5;
    for (let d = 0; d < 9; d++) {
      const f = Math.pow(d / 8, 2.2);
      const s = g.U * lerp(0.14, 1.65, f);
      const base = vy + (g.H * 0.5 - g.U) * lerp(0.03, 0.95, f);
      const off = g.W * lerp(0.02, 0.5, f);
      paintTree(ctx, g, rand, vx - off, base, s);
      paintTree(ctx, g, rand, vx + off, base, s);
    }
    return c;
  }

  function resetLeaf(g, i, anywhere) {
    const r = state.rand;
    state.lx[i] = r() * g.W * 1.1 - g.W * 0.05;
    state.ly[i] = anywhere ? r() * g.H : -g.U * 2;
    state.lv[i] = g.U * (4 + r() * 5);
    state.lp[i] = r() * 6.28;
    state.ls[i] = r() < 0.08 ? 3 : r() < 0.35 ? 2 : 1;
  }

  function drawLeaves(ctx, g, t, dt, props) {
    const count = Math.min(MAX_LEAVES, Math.round(g.W * 1.5 * props.leaves));
    for (let i = 0; i < count; i++) {
      state.ly[i] += state.lv[i] * dt;
      state.lx[i] += (props.wind * g.U * 2.4 + Math.sin(t * 1.2 + state.lp[i]) * g.U * 3.2) * dt;
      if (state.ly[i] > g.H * (0.6 + (i % 5) * 0.08)) resetLeaf(g, i, false);
      if (state.lx[i] > g.W) state.lx[i] -= g.W;
      const s = state.ls[i];
      const turn = Math.abs(Math.sin(t * 2.1 + state.lp[i]));
      ctx.fillStyle = GOLD[i % GOLD.length];
      ctx.fillRect(state.lx[i], state.ly[i], Math.max(1, s * (turn > 0.45 ? 1 : 0.5)), Math.max(1, s * 0.6));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.road = paintRoad(g, rand);
    state.trees = paintTrees(g, rand);
    state.lx = new Float32Array(MAX_LEAVES);
    state.ly = new Float32Array(MAX_LEAVES);
    state.lv = new Float32Array(MAX_LEAVES);
    state.lp = new Float32Array(MAX_LEAVES);
    state.ls = new Float32Array(MAX_LEAVES);
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.road, 0, 0);
    ctx.drawImage(state.trees, Math.sin(t * 0.4) * g.U * 0.35 * props.wind, Math.cos(t * 0.3) * g.U * 0.15);
    drawLeaves(ctx, g, t, dt, props);
  }

  Kasuri.run({
    defaults: { leaves: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
