/*
 * 火山 Kazan — a volcano smouldering at night over a black lake.
 *
 * The cone and its lava threads are baked; the threads brighten and dim as one
 * layer. Smoke is sixty soft sprites rising and spreading, lit from below near
 * the crater. A few embers. Nothing erupts, it just breathes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const WATER = 0.76;
  const MAX_PUFFS = 60;
  const MAX_EMBERS = 44;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintPuff(r, g, b) {
    const size = 48;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function coneTop(g, x) {
    const d = Math.abs(x - state.crater.x) / (g.U * 66);
    const slope = 1 - Math.pow(Math.min(1, d), 0.72);
    const rough = (fbm(x * 0.05, 3, 3, 8) - 0.5) * g.U * 2.5;
    return Math.max(state.crater.y, g.H * WATER - slope * (g.H * WATER - state.crater.y) + rough);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    sky.addColorStop(0, '#111733');
    sky.addColorStop(0.65, '#3b3560');
    sky.addColorStop(1, '#85525a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#ced1da';
    for (let i = 0; i < g.W * 0.8; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.6, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#20202f';
    ctx.beginPath();
    ctx.moveTo(0, g.H * WATER);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, coneTop(g, x));
    ctx.lineTo(g.W, g.H * WATER);
    ctx.fill();
    const lake = ctx.createLinearGradient(0, g.H * WATER, 0, g.H);
    lake.addColorStop(0, '#4a3a4c');
    lake.addColorStop(1, '#121527');
    ctx.fillStyle = lake;
    ctx.fillRect(0, g.H * WATER, g.W, g.H * (1 - WATER));
    return c;
  }

  function paintLava(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const cr = state.crater;
    const glow = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, g.U * 18);
    glow.addColorStop(0, 'rgba(226,120,60,0.85)');
    glow.addColorStop(1, 'rgba(180,60,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cr.x - g.U * 18, cr.y - g.U * 18, g.U * 36, g.U * 36);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      let x = cr.x + side * rand() * g.U * 3;
      let y = cr.y + g.U;
      const steps = 8 + Math.floor(rand() * 9);
      ctx.strokeStyle = i < 3 ? '#e4843f' : '#c15332';
      ctx.lineWidth = Math.max(1, g.U * (0.8 - i * 0.05));
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < steps; k++) {
        x += side * g.U * (0.8 + rand() * 2.6);
        y += g.U * (1.4 + rand() * 1.6);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return c;
  }

  function paintRipples(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.5, 3, 14);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 170;
        img.data[i + 1] = 110;
        img.data[i + 2] = 96;
        img.data[i + 3] = K.smoothstep(0.55, 0.7, v) * 80;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function resetPuff(g, i, anywhere) {
    const r = state.rand;
    state.pa[i] = anywhere ? r() : 0;
    state.px[i] = (r() - 0.5) * g.U * 5;
    state.pv[i] = 0.055 + r() * 0.04;
    state.ps[i] = r() * 6.28;
  }

  function drawSmoke(ctx, g, t, dt, props) {
    const cr = state.crater;
    const height = g.H * 0.74;
    for (let i = 0; i < MAX_PUFFS; i++) {
      state.pa[i] += state.pv[i] * dt * props.smoke;
      if (state.pa[i] >= 1) resetPuff(g, i, false);
      const a = state.pa[i];
      const size = g.U * (3 + a * 34);
      const lean = a * a * g.U * 46 + Math.sin(t * 0.17 + state.ps[i]) * a * g.U * 7;
      const x = cr.x + state.px[i] * (1 + a * 8) + lean;
      const y = cr.y - a * height;
      const lit = a < 0.2;
      ctx.globalAlpha = Math.min(1, (1 - a) * 1.25);
      ctx.drawImage(lit ? state.hotPuff : state.puff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx, g, dt) {
    const cr = state.crater;
    ctx.fillStyle = '#eca45a';
    for (let i = 0; i < MAX_EMBERS; i++) {
      state.el[i] -= dt * 0.45;
      if (state.el[i] <= 0) {
        state.ex[i] = cr.x + (state.rand() - 0.5) * g.U * 7;
        state.ey[i] = cr.y;
        state.evx[i] = (state.rand() - 0.5) * g.U * 7;
        state.evy[i] = -g.U * (4 + state.rand() * 10);
        state.el[i] = 0.4 + state.rand() * 0.6;
      }
      state.evy[i] += g.U * 3 * dt;
      state.ex[i] += state.evx[i] * dt;
      state.ey[i] += state.evy[i] * dt;
      ctx.globalAlpha = Math.min(1, state.el[i] * 1.6);
      ctx.fillRect(state.ex[i], state.ey[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.crater = { x: g.W * 0.52, y: g.H * 0.27 };
    state.world = paintWorld(g, rand);
    state.lava = paintLava(g, rand);
    state.ripples = paintRipples(Math.ceil(g.W * 1.3), Math.ceil(g.H * (1 - WATER)));
    state.puff = paintPuff(164, 154, 166);
    state.hotPuff = paintPuff(222, 132, 92);
    state.pa = new Float32Array(MAX_PUFFS);
    state.px = new Float32Array(MAX_PUFFS);
    state.pv = new Float32Array(MAX_PUFFS);
    state.ps = new Float32Array(MAX_PUFFS);
    for (let i = 0; i < MAX_PUFFS; i++) resetPuff(g, i, true);
    state.ex = new Float32Array(MAX_EMBERS);
    state.ey = new Float32Array(MAX_EMBERS);
    state.evx = new Float32Array(MAX_EMBERS);
    state.evy = new Float32Array(MAX_EMBERS);
    state.el = new Float32Array(MAX_EMBERS);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.world, 0, 0);
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.45);
    ctx.drawImage(state.lava, 0, 0);
    ctx.globalAlpha = 1;
    drawSmoke(ctx, g, t, dt, api.props);
    drawEmbers(ctx, g, dt);
    // The glow on the lake is only the lava layer, flipped.
    const line = g.H * WATER;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(0, line * 2);
    ctx.scale(1, -1);
    ctx.drawImage(state.lava, 0, 0, g.W, line, 0, line * 0.5, g.W, line * 0.5);
    ctx.restore();
    const w = state.ripples.width;
    const x = -((t * g.U * 1.2) % w);
    ctx.drawImage(state.ripples, x, line);
    ctx.drawImage(state.ripples, x + w, line);
  }

  Kasuri.run({
    defaults: { smoke: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, tint: 0.5 },
    maxFps: 20,
    setup,
    draw,
  });
})();
