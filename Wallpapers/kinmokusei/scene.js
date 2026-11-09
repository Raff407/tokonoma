/*
 * 金木犀 Kinmokusei — an osmanthus tree in orange bloom on a quiet night street.
 *
 * Sky, tiled roofs, wall, tree and paving are baked once. Only the paper
 * lantern (a slow sway and a soft glow) and a short pool of drifting
 * blossoms move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MAX_PETALS = 60;
  const GROUND = 0.78;
  const TREE = { x: 0.64, y: 0.42 };
  const LAMP = { x: 0.3, y: 0.33 };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
    grad.addColorStop(0, '#0d1230');
    grad.addColorStop(0.6, '#1f2650');
    grad.addColorStop(1, '#3a3558');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e8e2cc';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.5;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
    }
    ctx.globalAlpha = 0.18;
    blob(ctx, g.W * 0.82, g.H * 0.16, g.U * 9, g.U * 9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#efe6c8';
    blob(ctx, g.W * 0.82, g.H * 0.16, g.U * 4.4, g.U * 4.4);
  }

  // A tiled roof ridge with a curved sweep and a row of end tiles.
  function roof(ctx, g, x0, x1, base, rise) {
    const w = x1 - x0;
    ctx.fillStyle = '#4a5278';
    ctx.beginPath();
    ctx.moveTo(x0 - g.U * 2, base + g.U * 2);
    ctx.quadraticCurveTo(x0 + w * 0.12, base, x0 + w * 0.3, base - rise * 0.9);
    ctx.lineTo(x1 - w * 0.3, base - rise * 0.9);
    ctx.quadraticCurveTo(x1 - w * 0.12, base, x1 + g.U * 2, base + g.U * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a82a8';
    ctx.fillRect(x0 + w * 0.3, base - rise * 0.9 - g.U * 0.7, w * 0.4, g.U * 0.7);
    ctx.fillStyle = '#2c3254';
    for (let x = x0 + w * 0.12; x < x1 - w * 0.1; x += g.U * 1.3) ctx.fillRect(x, base - rise * 0.4, 1, rise * 0.4 + g.U);
  }

  function paintTown(ctx, g, rand) {
    const base = g.H * 0.5;
    roof(ctx, g, g.W * 0.0, g.W * 0.36, base, g.U * 9);
    roof(ctx, g, g.W * 0.3, g.W * 0.58, base - g.U * 2, g.U * 7);
    roof(ctx, g, g.W * 0.7, g.W * 1.04, base - g.U * 1, g.U * 8);
    // lit paper windows under the eaves
    const lit = [[0.07, 0.04], [0.19, 0.035], [0.41, 0.04], [0.86, 0.045]];
    for (const [fx, fw] of lit) {
      ctx.fillStyle = '#d79a52';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(g.W * fx, base + g.U * 4, g.W * fw, g.U * 5);
      ctx.fillStyle = '#6b4a34';
      ctx.globalAlpha = 1;
      ctx.fillRect(g.W * fx + g.W * fw * 0.5, base + g.U * 4, 1, g.U * 5);
      ctx.fillRect(g.W * fx, base + g.U * 6.5, g.W * fw, 1);
    }
    ctx.fillStyle = '#2a2e4c';
    ctx.fillRect(0, base + g.U * 2, g.W, g.H * GROUND - base - g.U * 2);
  }

  // Plaster wall with a tiled cap and wooden lattice, across the whole street.
  function paintWall(ctx, g) {
    const top = g.H * 0.6;
    const bot = g.H * GROUND;
    ctx.fillStyle = '#585c80';
    ctx.fillRect(0, top, g.W, bot - top);
    ctx.fillStyle = '#3a3e5c';
    ctx.fillRect(0, top - g.U * 1.6, g.W, g.U * 1.6);
    ctx.fillStyle = '#8a90b4';
    ctx.fillRect(0, top - g.U * 1.9, g.W, Math.max(1, g.U * 0.4));
    // lower boards in dark wood
    ctx.fillStyle = '#2c2a3c';
    ctx.fillRect(0, top + (bot - top) * 0.55, g.W, (bot - top) * 0.45);
    ctx.fillStyle = '#4a4658';
    for (let x = 0; x < g.W; x += g.U * 2.2) ctx.fillRect(x, top + (bot - top) * 0.55, 1, (bot - top) * 0.45);
    // lattice
    ctx.fillStyle = '#8a6a4a';
    for (let x = 0; x < g.W; x += g.U * 3.2) ctx.fillRect(x, top + g.U, Math.max(1, g.U * 0.35), (bot - top) * 0.45);
    ctx.fillRect(0, top + g.U, g.W, Math.max(1, g.U * 0.35));
  }

  function paintTree(ctx, g, rand) {
    const tx = g.W * TREE.x;
    const ty = g.H * TREE.y;
    const R = g.U * 24;
    // trunk and two limbs
    ctx.fillStyle = '#7a5a40';
    ctx.beginPath();
    ctx.moveTo(tx - g.U * 2.4, g.H * GROUND);
    ctx.lineTo(tx - g.U * 1.2, ty + R * 0.3);
    ctx.lineTo(tx + g.U * 1.2, ty + R * 0.3);
    ctx.lineTo(tx + g.U * 2.8, g.H * GROUND);
    ctx.closePath();
    ctx.fill();
    // leaf mass in moss, then lighter moss, then orange flowers
    const mass = [];
    for (let i = 0; i < 70; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      mass.push([tx + Math.cos(a) * d * R * 1.15, ty + Math.sin(a) * d * R * 0.8 - g.U * 2, g.U * (3 + rand() * 4)]);
    }
    const tones = ['#18281f', '#213a26', '#2c4a2c'];
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = tones[pass];
      for (const [x, y, r] of mass) blob(ctx, x - pass * g.U * 0.8, y - pass * g.U * 0.9, r * (1 - pass * 0.18), r * (0.85 - pass * 0.15));
    }
    const warm = ['#e08a2c', '#c8722a', '#ecaa48', '#b85a26'];
    for (let i = 0; i < 520; i++) {
      const m = mass[Math.floor(rand() * mass.length)];
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * m[2];
      const x = m[0] + Math.cos(a) * d - g.U;
      const y = m[1] + Math.sin(a) * d * 0.8 - g.U;
      ctx.fillStyle = warm[Math.floor(rand() * warm.length)];
      ctx.globalAlpha = 0.75 + rand() * 0.25;
      ctx.fillRect(x, y, Math.max(1, g.U * 0.55), Math.max(1, g.U * 0.55));
    }
    ctx.globalAlpha = 1;
  }

  function paintGround(ctx, g, rand) {
    const top = g.H * GROUND;
    ctx.fillStyle = '#44455e';
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#8a8aa8';
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.6));
    // paving stones
    ctx.fillStyle = '#22233a';
    for (let y = top + g.U * 3; y < g.H; y += g.U * 4) ctx.fillRect(0, y, g.W, 1);
    for (let row = 0; row * g.U * 4 + top < g.H; row++) {
      for (let x = (row % 2) * g.U * 4; x < g.W; x += g.U * 8) ctx.fillRect(x, top + g.U * 3 + row * g.U * 4, 1, g.U * 4);
    }
    // fallen blossoms already on the stones
    const warm = ['#e08a2c', '#c8722a', '#ecaa48'];
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = warm[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.6;
      const near = g.W * TREE.x + (rand() - 0.5) * g.W * 0.5;
      ctx.fillRect(near, top + g.U + rand() * (g.H - top - g.U * 2), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Warm light the lantern throws on wall, tree and stones.
  function paintGlow(g) {
    const c = layer(g.U * 80, g.U * 80);
    const ctx = c.getContext('2d');
    const r = c.width / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(240,160,70,0.8)');
    grad.addColorStop(0.35, 'rgba(230,130,55,0.4)');
    grad.addColorStop(1, 'rgba(200,90,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Paper lantern on a short bracket: ribs, black caps, a lit paper body.
  function paintLantern(g) {
    const w = Math.ceil(g.U * 10);
    const h = Math.ceil(g.U * 18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    ctx.fillStyle = '#2a2220';
    ctx.fillRect(cx - 0.5, 0, 1, g.U * 2);
    const body = ctx.createRadialGradient(cx, h * 0.55, 0, cx, h * 0.55, w * 0.7);
    body.addColorStop(0, '#f6c070');
    body.addColorStop(1, '#c4562a');
    ctx.fillStyle = body;
    blob(ctx, cx, h * 0.55, w * 0.46, h * 0.36);
    ctx.fillStyle = '#7a2a1c';
    for (let k = -2; k <= 2; k++) ctx.fillRect(cx - w * 0.44, h * 0.55 + k * g.U * 1.3, w * 0.88, 1);
    ctx.fillStyle = '#16141a';
    ctx.fillRect(cx - w * 0.28, h * 0.17, w * 0.56, g.U * 1.1);
    ctx.fillRect(cx - w * 0.28, h * 0.9, w * 0.56, g.U * 1.1);
    return c;
  }

  function newPetal(g, p, rand, fresh) {
    p.x = g.W * TREE.x + (rand() - 0.5) * g.U * 44;
    p.y = fresh ? g.H * (TREE.y - 0.1) + rand() * g.U * 26 : g.H * (TREE.y - 0.05) + rand() * g.U * 20;
    p.vy = g.U * (4 + rand() * 3);
    p.sway = 1 + rand() * 2;
    p.phase = rand() * TAU;
    p.drift = g.U * (2 + rand() * 3);
    p.floor = g.H * (GROUND + 0.01 + rand() * 0.18);
    p.tone = Math.floor(rand() * 3);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(77);
    state.g = g;
    const bg = layer(g.W, g.H);
    const bx = bg.getContext('2d');
    paintSky(bx, g, rand);
    paintTown(bx, g, rand);
    paintWall(bx, g);
    paintTree(bx, g, rand);
    paintGround(bx, g, rand);
    state.bg = bg;
    state.glow = paintGlow(g);
    state.lantern = paintLantern(g);
    state.rand = K.rng(5);
    state.petals = [];
    for (let i = 0; i < MAX_PETALS; i++) {
      const p = {};
      newPetal(g, p, state.rand, true);
      p.y += state.rand() * (p.floor - p.y);
      state.petals.push(p);
    }
  }

  const TONES = ['#e08a2c', '#ecaa48', '#c8722a'];

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.bg, 0, 0);
    const lx = g.W * LAMP.x;
    const ly = g.H * LAMP.y;
    const swing = Math.sin(t * 0.8) * 0.12;
    const breath = 0.85 + 0.15 * Math.sin(t * 0.45);
    if (props.glow > 0) {
      ctx.globalAlpha = Math.min(1, breath * props.glow * 0.8);
      ctx.drawImage(state.glow, lx - state.glow.width / 2, ly + g.U * 2 - state.glow.height / 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#2a2220';
    ctx.fillRect(lx - g.U * 7, ly - g.U * 4.5, g.U * 7, Math.max(1, g.U * 0.7));
    ctx.save();
    ctx.translate(lx, ly - g.U * 4);
    ctx.rotate(swing);
    ctx.drawImage(state.lantern, -state.lantern.width / 2, 0);
    ctx.restore();
    const count = Math.round(MAX_PETALS * Math.min(1, props.petals / 1.5));
    for (let i = 0; i < count; i++) {
      const p = state.petals[i];
      p.y += p.vy * dt;
      p.x += Math.sin(t * p.sway + p.phase) * p.drift * dt;
      if (p.y >= p.floor) newPetal(g, p, state.rand, false);
      ctx.fillStyle = TONES[p.tone];
      ctx.fillRect(p.x, p.y, Math.max(1.5, g.U * 1.1), Math.max(1.5, g.U * 0.8));
    }
  }

  Kasuri.run({
    defaults: { petals: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
