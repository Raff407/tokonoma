/*
 * 柿 Kaki — a bare persimmon tree in late autumn, crows and the last of the fruit.
 *
 * Tree and fruit are baked from one recursion. Three crows sit on it, bobbing
 * and shifting; another few cross the dusk now and then. A roof and thin smoke
 * in the distance.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const CROW = '#0e0e13';
  const FRUIT = ['#d5702a', '#e08a36', '#c55c24'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.86);
    sky.addColorStop(0, '#2b3254');
    sky.addColorStop(0.55, '#8c6a78');
    sky.addColorStop(1, '#e0a970');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#efd0a0';
    ctx.beginPath();
    ctx.arc(g.W * 0.76, g.H * 0.68, g.U * 7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6f5a6c';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(g.W * rand(), g.H * (0.3 + i * 0.06), g.W * (0.14 + rand() * 0.3), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4c4258';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.9);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.8 - fbm(x * 0.012, 2, 3, 4) * 0.12));
    ctx.lineTo(g.W, g.H * 0.9);
    ctx.fill();
    const x = g.W * 0.62;
    const y = g.H * 0.86;
    ctx.fillStyle = '#2a2433';
    ctx.beginPath();
    ctx.moveTo(x - g.U * 13, y - g.U * 5);
    ctx.lineTo(x, y - g.U * 13);
    ctx.lineTo(x + g.U * 13, y - g.U * 5);
    ctx.fill();
    ctx.fillRect(x - g.U * 9, y - g.U * 5, g.U * 18, g.U * 6);
    ctx.fillStyle = '#e6b66a';
    ctx.fillRect(x - g.U * 3, y - g.U * 3.4, g.U * 3, g.U * 2.2);
    state.chimney = { x: x + g.U * 3, y: y - g.U * 10 };
    return c;
  }

  function growBranch(ctx, g, rand, x, y, angle, len, width, depth, spots) {
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    if (depth <= 3) spots.push({ x: nx, y: ny, flat: Math.abs(Math.sin(angle)) < 0.65, width });
    if (depth === 0) return;
    const forks = depth > 5 ? 2 : 2 + (rand() < 0.3 ? 1 : 0);
    for (let i = 0; i < forks; i++) {
      const spread = (i - (forks - 1) / 2) * (0.55 + rand() * 0.45);
      growBranch(ctx, g, rand, nx, ny, angle + spread + (rand() - 0.5) * 0.4, len * (0.72 + rand() * 0.1), width * 0.66, depth - 1, spots);
    }
  }

  function paintTree(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#17110f';
    ctx.lineCap = 'round';
    const spots = [];
    growBranch(ctx, g, rand, g.W * 0.32, g.H, -1.42, g.U * 26, g.U * 6, 7, spots);
    growBranch(ctx, g, rand, g.W * 0.33, g.H * 0.76, -0.45, g.U * 22, g.U * 3.4, 6, spots);
    growBranch(ctx, g, rand, g.W * 0.32, g.H * 0.78, -2.5, g.U * 15, g.U * 2.6, 5, spots);
    for (const s of spots) {
      if (rand() > 0.34) continue;
      ctx.fillStyle = FRUIT[Math.floor(rand() * FRUIT.length)];
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + g.U * 1.2, g.U * 1.5, g.U * 1.3, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#2a1e16';
      ctx.fillRect(s.x - 0.5, s.y - 0.2, 1, Math.max(1, g.U * 0.3));
    }
    state.spots = spots;
    ctx.fillStyle = '#2a2433';
    ctx.fillRect(0, g.H * 0.96, g.W, g.H * 0.04);
    return c;
  }

  function drawCrow(ctx, x, y, u, t, phase) {
    const shift = Math.max(0, Math.sin(t * 0.33 + phase) - 0.86) * 8;
    const bob = Math.sin(t * 0.8 + phase) * u * 0.12;
    const head = Math.sin(t * 0.21 + phase * 3) > 0 ? 1 : -1;
    ctx.fillStyle = CROW;
    ctx.beginPath();
    ctx.ellipse(x, y - u * 3 + bob, u * 3.4, u * 2.2, -0.35 * head, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + head * u * 3, y - u * 5.2 + bob - shift * u * 0.5, u * 1.5, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + head * u * 4.2, y - u * 5.6 + bob - shift * u * 0.5);
    ctx.lineTo(x + head * u * 6.2, y - u * 5 + bob - shift * u * 0.5);
    ctx.lineTo(x + head * u * 4.2, y - u * 4.6 + bob - shift * u * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - head * u * 2.6, y - u * 3 + bob);
    ctx.lineTo(x - head * u * 7, y - u * 0.6 + bob);
    ctx.lineTo(x - head * u * 2, y - u * 1.5 + bob);
    ctx.fill();
    ctx.fillRect(x - u * 0.5, y - u * 1.2, Math.max(1, u * 0.35), u * 1.3);
    ctx.fillRect(x + u * 0.6, y - u * 1.2, Math.max(1, u * 0.35), u * 1.3);
  }

  function drawFlyers(ctx, g, t) {
    ctx.strokeStyle = CROW;
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    const span = g.W + g.U * 90;
    for (let i = 0; i < 5; i++) {
      const x = g.W + g.U * 15 - ((t * g.U * 8 + i * g.U * 9) % span);
      const y = g.H * 0.22 + i * g.U * 2.6 + Math.sin(t * 0.3 + i) * g.U * 1.4;
      const flap = Math.sin(t * 5 + i * 1.7) * g.U * 1.6;
      const w = g.U * 3;
      ctx.beginPath();
      ctx.moveTo(x - w, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y - flap);
      ctx.stroke();
    }
  }

  function drawSmoke(ctx, g, t) {
    ctx.fillStyle = '#b8a9a2';
    for (let i = 0; i < 26; i++) {
      const a = ((t * 0.05 + i / 26) % 1);
      ctx.globalAlpha = (1 - a) * 0.5;
      ctx.fillRect(state.chimney.x + Math.sin(a * 7 + t * 0.2) * g.U * 1.3 + a * g.U * 8, state.chimney.y - a * g.U * 28, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.tree = paintTree(g, rand);
    const flats = state.spots.filter((s) => s.flat && s.width > g.U * 0.5 && s.y < g.H * 0.8);
    state.crows = [];
    for (let i = 0; i < 3 && flats.length; i++) {
      const s = flats[Math.floor(rand() * flats.length)];
      state.crows.push({ x: s.x, y: s.y, phase: rand() * 6.28 });
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const sway = Math.sin(t * 0.4) * g.U * 0.25 * api.props.wind;
    ctx.drawImage(state.sky, 0, 0);
    drawSmoke(ctx, g, t);
    ctx.drawImage(state.tree, sway, 0);
    for (const c of state.crows) drawCrow(ctx, c.x + sway, c.y, g.U * 0.95, t, c.phase);
    drawFlyers(ctx, g, t);
  }

  Kasuri.run({
    defaults: { wind: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
