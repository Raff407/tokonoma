/*
 * 障子 Shoji — sunlit paper screens with the garden's shadow moving on them.
 *
 * A bamboo and a maple are baked at low resolution and scaled up, which gives
 * the soft edge a real shadow has. Three such layers slide on their own slow
 * breeze. The wooden lattice is baked on top. Once in a while a sparrow's
 * shadow lands on the branch, stays a while, and goes. Dark ink on pale paper.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, fbm } = K;

  const PAPER = '#e9e0cc';
  const WOOD = '#3a2a1e';
  const SHADOW = '#3f3a33';
  const BLUR_SCALE = 3;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function bambooShadow(g, rand) {
    const s = BLUR_SCALE;
    const c = layer(g.W * 1.2 / s, g.H / s);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = SHADOW;
    ctx.fillStyle = SHADOW;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = (c.width * (i + 0.5 + (rand() - 0.5) * 0.5)) / 7;
      const lean = (rand() - 0.5) * c.width * 0.05;
      ctx.lineWidth = Math.max(1, (g.U * (1.1 + rand() * 0.8)) / s);
      ctx.beginPath();
      ctx.moveTo(x, c.height);
      ctx.lineTo(x + lean, 0);
      ctx.stroke();
      for (let k = 0; k < 9; k++) {
        const y = rand() * c.height * 0.7;
        const dir = rand() < 0.5 ? -1 : 1;
        const len = (g.U * (6 + rand() * 7)) / s;
        ctx.lineWidth = Math.max(0.8, (g.U * 0.9) / s);
        ctx.beginPath();
        ctx.moveTo(x + lean * (1 - y / c.height), y);
        ctx.lineTo(x + lean * (1 - y / c.height) + dir * len, y + len * (0.25 + rand() * 0.4));
        ctx.stroke();
      }
    }
    return c;
  }

  function maplePoint(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283 + 0.3;
      const d = i % 2 ? r * 0.45 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.fill();
  }

  function growTwig(ctx, g, rand, x, y, angle, length, width, depth, perches) {
    const nx = x + Math.cos(angle) * length;
    const ny = y + Math.sin(angle) * length;
    ctx.lineWidth = Math.max(0.8, width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    if (depth === 3) perches.push({ x: nx, y: ny });
    if (depth === 0) {
      for (let i = 0; i < 4; i++) {
        maplePoint(ctx, nx + (rand() - 0.5) * length, ny + (rand() - 0.5) * length, (g.U * (1.8 + rand() * 1.3)) / BLUR_SCALE);
      }
      return;
    }
    growTwig(ctx, g, rand, nx, ny, angle - 0.42 - rand() * 0.25, length * 0.76, width * 0.7, depth - 1, perches);
    growTwig(ctx, g, rand, nx, ny, angle + 0.3 + rand() * 0.25, length * 0.72, width * 0.68, depth - 1, perches);
  }

  function mapleShadow(g, rand) {
    const s = BLUR_SCALE;
    const c = layer(g.W * 1.2 / s, g.H / s);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = SHADOW;
    ctx.fillStyle = SHADOW;
    ctx.lineCap = 'round';
    const perches = [];
    growTwig(ctx, g, rand, c.width * 1.02, c.height * 0.22, 2.75, (g.U * 22) / s, (g.U * 2.4) / s, 5, perches);
    state.perches = perches.map((p) => ({ x: p.x * s, y: p.y * s }));
    return c;
  }

  function paintLattice(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const bar = Math.max(1, Math.round(g.U * 0.7));
    const heavy = Math.max(2, Math.round(g.U * 2.2));
    const panels = Math.max(2, Math.round(g.W / (g.U * 52)));
    const panelW = g.W / panels;
    const rows = 7;
    const cols = 4;
    ctx.fillStyle = WOOD;
    for (let p = 0; p < panels; p++) {
      for (let i = 1; i < cols; i++) ctx.fillRect(p * panelW + (panelW * i) / cols, 0, bar, g.H * 0.8);
      for (let j = 0; j <= rows; j++) ctx.fillRect(p * panelW, ((g.H * 0.8) * j) / rows, panelW, bar);
      ctx.fillRect(p * panelW - heavy / 2, 0, heavy, g.H);
    }
    ctx.fillRect(0, 0, g.W, heavy);
    ctx.fillRect(0, g.H - heavy, g.W, heavy);
    // Koshi panel: solid wood along the bottom of each panel.
    const skirt = ctx.createLinearGradient(0, g.H * 0.8, 0, g.H);
    skirt.addColorStop(0, '#5a4331');
    skirt.addColorStop(1, '#2f2118');
    ctx.fillStyle = skirt;
    ctx.fillRect(0, g.H * 0.8, g.W, g.H * 0.2);
    ctx.fillStyle = WOOD;
    for (let p = 0; p <= panels; p++) ctx.fillRect(p * panelW - heavy / 2, g.H * 0.8, heavy, g.H * 0.2);
    return c;
  }

  // Warm patch from a sun that slides along the paper over the day.
  function paintSun(g) {
    const c = layer(g.W * 2, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(g.W, g.H * 0.3, 0, g.W, g.H * 0.3, g.W * 0.8);
    grad.addColorStop(0, 'rgba(240,216,170,0.6)');
    grad.addColorStop(1, 'rgba(240,216,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function drawSparrow(ctx, g, x, y, flap) {
    const u = g.U * 0.55;
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x, y - u, u * 2.4, u * 1.4, -0.25, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + u * 2, y - u * 2, u * 1.05, 0, 6.3);
    ctx.fill();
    ctx.fillRect(x - u * 4, y - u * 0.6, u * 2.2, Math.max(1, u * 0.7));
    if (flap > 0) {
      ctx.beginPath();
      ctx.moveTo(x - u, y - u);
      ctx.lineTo(x - u * 2, y - u * (3 + flap * 3));
      ctx.lineTo(x + u, y - u * 1.2);
      ctx.fill();
    }
  }

  function stepSparrow(g, t, dt) {
    const b = state.bird;
    b.wait -= dt;
    if (b.mode === 'away' && b.wait <= 0) {
      const target = state.perches[Math.floor(state.rand() * state.perches.length)];
      b.tx = target.x - g.W * 0.1;
      b.ty = target.y;
      b.x = b.tx + g.W * (state.rand() < 0.5 ? -0.5 : 0.5);
      b.y = b.ty - g.H * 0.3;
      b.mode = 'flying';
    } else if (b.mode === 'flying') {
      b.x += (b.tx - b.x) * Math.min(1, dt * 1.4);
      b.y += (b.ty - b.y) * Math.min(1, dt * 1.4);
      if (Math.hypot(b.tx - b.x, b.ty - b.y) < g.U) {
        b.mode = 'perched';
        b.wait = 10 + state.rand() * 20;
      }
    } else if (b.mode === 'perched' && b.wait <= 0) {
      b.mode = 'leaving';
    } else if (b.mode === 'leaving') {
      b.x += g.U * 34 * dt;
      b.y -= g.U * 18 * dt;
      if (b.x > g.W * 1.1 || b.y < -g.U * 6) {
        b.mode = 'away';
        b.wait = 14 + state.rand() * 30;
      }
    }
    return b.mode === 'perched' ? 0 : 0.5 + 0.5 * Math.sin(t * 22);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.far = bambooShadow(g, rand);
    state.near = mapleShadow(g, rand);
    state.lattice = paintLattice(g);
    state.sun = paintSun(g);
    state.bird = { mode: 'away', wait: 4, x: 0, y: 0, tx: 0, ty: 0 };
  }

  function drawShadow(ctx, img, g, x, y, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - g.W * 0.1, y, g.W * 1.2, g.H);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const wind = props.breeze * g.U;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(state.sun, -g.W * (0.2 + 0.6 * ((K.hourOf(new Date()) / 24) % 1)), 0);
    drawShadow(ctx, state.far, g, Math.sin(t * 0.33) * wind * 2.2 + Math.sin(t * 0.81) * wind * 0.6, 0, 0.62);
    drawShadow(ctx, state.near, g, Math.sin(t * 0.47 + 1) * wind * 1.7, Math.sin(t * 0.31) * wind * 0.8, 0.82);
    ctx.globalAlpha = 1;
    const flap = stepSparrow(g, t, dt);
    if (state.bird.mode !== 'away') {
      const b = state.bird;
      drawSparrow(ctx, g, b.x + Math.sin(t * 0.47 + 1) * wind * 1.7, b.y + Math.sin(t * 0.31) * wind * 0.8, flap);
    }
    ctx.drawImage(state.lattice, 0, 0);
  }

  Kasuri.run({
    defaults: { breeze: 1, ramp: 'kana', cell: 8, invert: true, bg: PAPER, tint: 0.5, dither: 0.3, boost: 0.2 },
    maxFps: 20,
    setup,
    draw,
  });
})();
