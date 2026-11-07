/*
 * 紫陽花 Ajisai — hydrangeas in the June rains, with a snail on its way.
 *
 * Each flower head is hundreds of four-petal florets, baked once. Two layers
 * of leaves and blooms nod against each other by a fraction of a cell. Drops
 * run down in front, and one snail crosses a leaf very slowly.
 */
(function () {
  'use strict';

  const K = KasuriCore;

  const BLOOMS = [
    ['#3f5a9c', '#6b82bd', '#a3b3d8'],
    ['#6a4f9a', '#9478b8', '#c3b0d6'],
    ['#a65f8d', '#c98bab', '#e4c2cf'],
  ];
  const LEAF = ['#2f5a3c', '#3c6e49', '#25492f'];
  const MAX_DROPS = 340;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintLeaf(ctx, g, rand, x, y, size, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.quadraticCurveTo(0, -size * 0.75, size, 0);
    ctx.quadraticCurveTo(0, size * 0.75, -size, 0);
    ctx.fill();
    ctx.strokeStyle = '#6d9a6c';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    for (let i = -2; i <= 2; i++) {
      const vx = i * size * 0.3;
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + size * 0.2, -size * 0.34);
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + size * 0.2, size * 0.34);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintBloom(ctx, g, rand, x, y, radius, inks) {
    ctx.fillStyle = inks[0];
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 6.3);
    ctx.fill();
    const florets = Math.round(radius * radius * 0.42);
    for (let i = 0; i < florets; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * radius;
      const fx = x + Math.cos(a) * d;
      const fy = y + Math.sin(a) * d * 0.94;
      const lit = (y - fy) / radius + rand() * 0.8;
      ctx.fillStyle = inks[lit > 0.75 ? 2 : lit > 0.1 ? 1 : 0];
      const s = Math.max(1, g.U * 0.75);
      ctx.fillRect(fx - s, fy, s * 2, Math.max(1, s * 0.6));
      ctx.fillRect(fx - s * 0.3, fy - s, Math.max(1, s * 0.6), s * 2);
    }
  }

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#465a58');
    grad.addColorStop(1, '#1d2c28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintBush(g, rand, count, large) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < count * 4; i++) {
      paintLeaf(ctx, g, rand, rand() * g.W, g.H * (0.1 + rand()), g.U * (large ? 9 + rand() * 6 : 6 + rand() * 4), rand() * 6.28);
    }
    for (let i = 0; i < count; i++) {
      const inks = BLOOMS[Math.floor(rand() * BLOOMS.length)];
      const x = ((i + 0.2 + rand() * 0.6) / count) * g.W;
      const y = g.H * (large ? 0.45 + rand() * 0.42 : 0.1 + rand() * 0.55);
      paintBloom(ctx, g, rand, x, y, g.U * (large ? 11 + rand() * 6 : 7 + rand() * 4), inks);
    }
    return c;
  }

  function paintHeroLeaf(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const leaf = { x: g.W * 0.32, y: g.H * 0.9, size: g.U * 25 };
    paintLeaf(ctx, g, rand, leaf.x, leaf.y, leaf.size, -0.1);
    state.leaf = leaf;
    return c;
  }

  function drawSnail(ctx, g, t) {
    const { x: lx, y: ly, size } = state.leaf;
    const along = ((t * 0.008 + 0.3) % 1) * 1.6 - 0.8;
    const x = lx + along * size;
    const y = ly - size * 0.09 - along * size * 0.1;
    const u = g.U;
    const stretch = 1 + Math.sin(t * 0.8) * 0.07;
    ctx.fillStyle = '#b09d7c';
    ctx.fillRect(x - u * 3.4 * stretch, y, u * 7 * stretch, Math.max(1, u * 1.1));
    ctx.fillRect(x + u * 3.1 * stretch, y - u * 2, Math.max(1, u * 0.45), u * 2.2);
    ctx.fillRect(x + u * 3.9 * stretch, y - u * 1.8, Math.max(1, u * 0.45), u * 2);
    ctx.fillStyle = '#7b5a3b';
    ctx.beginPath();
    ctx.arc(x - u * 0.4, y - u * 1.5, u * 2.3, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c7a877';
    ctx.beginPath();
    ctx.arc(x - u * 0.4, y - u * 1.5, u * 1.05, 0, 6.3);
    ctx.fill();
  }

  function resetDrop(g, i, anywhere) {
    const r = state.rand;
    state.dx[i] = r() * g.W;
    state.dy[i] = anywhere ? r() * g.H : -g.U * 3;
    state.dv[i] = g.U * (42 + r() * 36);
  }

  function drawRain(ctx, g, dt, amount) {
    const count = Math.min(MAX_DROPS, Math.round(g.W * 1.3 * amount));
    const len = Math.max(2, g.U * 2.2);
    ctx.fillStyle = '#cfdce0';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < count; i++) {
      state.dy[i] += state.dv[i] * dt;
      if (state.dy[i] > g.H) resetDrop(g, i, false);
      ctx.fillRect(state.dx[i], state.dy[i], 1, len);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g);
    state.far = paintBush(g, rand, 7, false);
    state.near = paintBush(g, rand, 6, true);
    state.hero = paintHeroLeaf(g, rand);
    state.dx = new Float32Array(MAX_DROPS);
    state.dy = new Float32Array(MAX_DROPS);
    state.dv = new Float32Array(MAX_DROPS);
    for (let i = 0; i < MAX_DROPS; i++) resetDrop(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const nod = g.U * 0.6;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.far, Math.sin(t * 0.5) * nod * 0.7, Math.cos(t * 0.37) * nod * 0.5);
    ctx.drawImage(state.near, Math.sin(t * 0.43 + 2) * nod, Math.cos(t * 0.61 + 1) * nod * 0.8);
    ctx.drawImage(state.hero, 0, Math.sin(t * 0.7) * nod * 0.5);
    drawSnail(ctx, g, t);
    drawRain(ctx, g, dt, api.props.rain);
  }

  Kasuri.run({
    defaults: { rain: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
