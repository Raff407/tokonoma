/*
 * 夜桜 Sakura — one old cherry tree at night, shedding petals.
 *
 * The branches grow once by recursion and bake into a layer. The blossom sits
 * in two more layers that slide a fraction of a cell against each other, which
 * is enough to read as a breeze. Petals land and collect in a pile layer that
 * slowly fades. The cursor is a small gust.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { noise2, fbm, lerp } = K;

  const PETALS = ['#f3dfd9', '#e6bcc2', '#d79aa8'];
  const BARK = '#1b1518';
  const MAX_PETALS = 420;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.86);
    sky.addColorStop(0, '#0f1428');
    sky.addColorStop(0.65, '#2b2a49');
    sky.addColorStop(1, '#5a4562');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#2d2a44';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, g.H * (0.8 - fbm(x * 0.012, 3.1, 3, 5) * 0.14));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#1b1a26';
    ctx.fillRect(0, g.H * 0.87, g.W, g.H * 0.13);
    ctx.fillStyle = '#c47f88';
    for (let i = 0; i < g.W / 3; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.2;
      ctx.fillRect(rand() * g.W, g.H * (0.88 + rand() * 0.12), 2, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function growBranch(ctx, tips, g, rand, x, y, angle, length, width, depth) {
    const nx = x + Math.cos(angle) * length;
    const ny = y + Math.sin(angle) * length;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      (x + nx) / 2 + (rand() - 0.5) * length * 0.3,
      (y + ny) / 2 + (rand() - 0.5) * length * 0.3,
      nx, ny,
    );
    ctx.stroke();
    if (depth <= 4) tips.push({ x: nx, y: ny, depth });
    if (depth === 0) return;
    const forks = depth > 5 ? 2 : 2 + (rand() < 0.45 ? 1 : 0);
    for (let i = 0; i < forks; i++) {
      const spread = (i - (forks - 1) / 2) * (0.5 + rand() * 0.35);
      const nextAngle = angle + spread + (rand() - 0.5) * 0.25;
      growBranch(ctx, tips, g, rand, nx, ny, nextAngle, length * (0.72 + rand() * 0.1), width * 0.68, depth - 1);
    }
  }

  function paintCluster(ctx, rand, x, y, radius, pale) {
    const puffs = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < puffs; i++) {
      const a = rand() * 6.28;
      const r = rand() * radius;
      ctx.fillStyle = pale ? PETALS[Math.floor(rand() * 2)] : '#a96f81';
      ctx.globalAlpha = pale ? 0.72 : 0.9;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, radius * (0.28 + rand() * 0.4), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintTree(g, rand) {
    const bark = layer(g.W, g.H);
    const bctx = bark.getContext('2d');
    bctx.strokeStyle = BARK;
    bctx.lineCap = 'round';
    const tips = [];
    const rootX = g.W * 0.3;
    growBranch(bctx, tips, g, rand, rootX, g.H * 0.95, -1.5, g.U * 22, g.U * 5.4, 7);
    growBranch(bctx, tips, g, rand, rootX, g.H * 0.72, -0.62, g.U * 20, g.U * 3.4, 6);
    growBranch(bctx, tips, g, rand, rootX, g.H * 0.74, -2.5, g.U * 15, g.U * 2.8, 5);
    const under = layer(g.W, g.H);
    const over = layer(g.W, g.H);
    const uctx = under.getContext('2d');
    const octx = over.getContext('2d');
    for (const tip of tips) {
      if (rand() < 0.4) paintCluster(uctx, rand, tip.x, tip.y + g.U, g.U * 2.2, false);
    }
    for (const tip of tips) {
      if (rand() < 0.55) paintCluster(octx, rand, tip.x, tip.y - g.U * 0.4, g.U * (tip.depth < 2 ? 2 : 1.5), true);
    }
    return { bark, under, over, tips };
  }

  function resetPetal(g, i, anywhere) {
    const r = state.rand;
    const tip = state.tree.tips[Math.floor(r() * state.tree.tips.length)];
    state.px[i] = anywhere ? r() * g.W : tip.x;
    state.py[i] = anywhere ? r() * g.H * 0.85 : tip.y;
    state.pv[i] = g.U * (2.4 + r() * 2.8);
    state.pp[i] = r() * 6.28;
  }

  function pushFromPointer(g, i, pointer, dt) {
    const dx = state.px[i] - pointer.x;
    const dy = state.py[i] - pointer.y;
    const reach = g.U * 18;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach || d2 < 0.01) return;
    const push = ((1 - Math.sqrt(d2) / reach) * g.U * 60 * dt) / Math.sqrt(d2);
    state.px[i] += dx * push;
    state.py[i] += dy * push * 0.6;
  }

  function drawPetals(ctx, g, t, dt, props, pointer) {
    const count = Math.min(MAX_PETALS, Math.round(g.W * 1.2 * props.petals));
    const pile = state.pile.getContext('2d');
    const ground = g.H * 0.87;
    for (let i = 0; i < count; i++) {
      const gust = noise2(state.py[i] * 0.02 + t * 0.09, i * 0.13, 3) - 0.28;
      state.px[i] += gust * props.wind * g.U * 12 * dt + Math.sin(t * 1.4 + state.pp[i]) * g.U * 1.6 * dt;
      state.py[i] += state.pv[i] * dt;
      if (pointer.active) pushFromPointer(g, i, pointer, dt);
      if (state.py[i] > ground + (i % 11) * g.U * 1.1) {
        pile.fillStyle = PETALS[i % 3];
        pile.fillRect(state.px[i], state.py[i], 1, 1);
        resetPetal(g, i, false);
      }
      if (state.px[i] > g.W + 2 || state.px[i] < -2) resetPetal(g, i, false);
      const wide = Math.abs(Math.sin(t * 2.2 + state.pp[i])) > 0.5 ? 2 : 1;
      ctx.fillStyle = PETALS[i % 3];
      ctx.fillRect(state.px[i], state.py[i], wide, 1);
    }
  }

  function fadePile(dt) {
    state.pileIn -= dt;
    if (state.pileIn > 0) return;
    state.pileIn = 4;
    const pile = state.pile.getContext('2d');
    pile.globalCompositeOperation = 'destination-out';
    pile.fillStyle = 'rgba(0,0,0,0.08)';
    pile.fillRect(0, 0, state.g.W, state.g.H);
    pile.globalCompositeOperation = 'source-over';
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.tree = paintTree(g, rand);
    state.pile = layer(g.W, g.H);
    state.pileIn = 4;
    state.px = new Float32Array(MAX_PETALS);
    state.py = new Float32Array(MAX_PETALS);
    state.pv = new Float32Array(MAX_PETALS);
    state.pp = new Float32Array(MAX_PETALS);
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const sway = props.wind * g.U * 0.5;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.pile, 0, 0);
    ctx.drawImage(state.tree.under, Math.sin(t * 0.5) * sway * 0.5, 0);
    ctx.drawImage(state.tree.bark, 0, 0);
    ctx.drawImage(state.tree.over, Math.sin(t * 0.7 + 1) * sway, Math.cos(t * 0.5) * sway * 0.4);
    drawPetals(ctx, g, t, dt, props, api.pointer);
    fadePile(dt);
  }

  Kasuri.run({
    defaults: { petals: 1, wind: 1, ramp: 'kana', cell: 8, boost: 0.2, gain: 1.15, tint: 0.5 },
    maxFps: 24,
    setup,
    draw,
  });
})();
