/*
 * 横丁 Yokocho — a narrow lantern alley in the rain, late.
 *
 * The buildings run to one vanishing point and are baked once. Lanterns are a
 * short list of glow sprites that breathe on their own. The wet road holds a
 * broken column of light under each lantern and shopfront.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const LANTERNS = ['#d9583c', '#e0a14f', '#c8452f'];
  const WALLS = ['#2c2a38', '#3a2f33', '#2b3440', '#3b3230', '#30303f'];
  const FOOT = 0.92;
  const SHINE_ROWS = 9;
  const MAX_DROPS = 500;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGlow(radius, colour) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  // s runs from 0 at the far end of the alley to 1 at the viewer.
  function wallPoint(g, side, s, height) {
    const vx = g.W * 0.5;
    const vy = g.H * 0.46;
    const x = vx + side * s * g.W * 0.56;
    const y = vy - height * s * g.H * 0.62;
    return [x, y];
  }

  function quad(ctx, a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
  }

  function paintFacade(ctx, g, rand, side, s0, s1, tone) {
    const foot = -FOOT;
    ctx.fillStyle = tone;
    quad(ctx, wallPoint(g, side, s0, 1.1), wallPoint(g, side, s1, 1.1), wallPoint(g, side, s1, foot), wallPoint(g, side, s0, foot));
    // Lit shopfront at street level, a dark eave and a noren over it.
    ctx.fillStyle = rand() < 0.75 ? '#b9803f' : '#5e4e3a';
    quad(ctx, wallPoint(g, side, s0, -0.1), wallPoint(g, side, s1, -0.1), wallPoint(g, side, s1, foot), wallPoint(g, side, s0, foot));
    ctx.fillStyle = '#17151c';
    quad(ctx, wallPoint(g, side, s0, 0.12), wallPoint(g, side, s1, 0.12), wallPoint(g, side, s1, -0.02), wallPoint(g, side, s0, -0.02));
    ctx.fillStyle = rand() < 0.5 ? '#8a3229' : '#2c4066';
    quad(ctx, wallPoint(g, side, s0, -0.02), wallPoint(g, side, s1, -0.02), wallPoint(g, side, s1, -0.26), wallPoint(g, side, s0, -0.26));
    if (rand() < 0.6) {
      ctx.fillStyle = '#d8b679';
      const m = lerp(s0, s1, 0.3);
      const n = lerp(s0, s1, 0.7);
      quad(ctx, wallPoint(g, side, m, 0.6), wallPoint(g, side, n, 0.6), wallPoint(g, side, n, 0.36), wallPoint(g, side, m, 0.36));
    }
  }

  function paintStreet(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.5);
    sky.addColorStop(0, '#141a33');
    sky.addColorStop(1, '#4a4c70');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    const road = ctx.createLinearGradient(0, g.H * 0.46, 0, g.H);
    road.addColorStop(0, '#3a3440');
    road.addColorStop(1, '#17151f');
    ctx.fillStyle = road;
    ctx.fillRect(0, g.H * 0.46, g.W, g.H * 0.54);
    const steps = [0, 0.1, 0.2, 0.32, 0.46, 0.64, 0.84, 1.15];
    for (let i = 0; i < steps.length - 1; i++) {
      for (const side of [-1, 1]) {
        paintFacade(ctx, g, rand, side, steps[i], steps[i + 1], WALLS[Math.floor(rand() * WALLS.length)]);
      }
    }
    return { canvas: c, steps };
  }

  function placeLanterns(g, steps, rand) {
    const list = [];
    for (let i = 1; i < steps.length - 1; i++) {
      for (const side of [-1, 1]) {
        const s = steps[i];
        const [x, y] = wallPoint(g, side * 0.9, s, 0.0);
        const foot = wallPoint(g, side * 0.74, s, -FOOT);
        const glow = Math.floor(rand() * LANTERNS.length);
        list.push({ x, y, fx: foot[0], fy: foot[1], s, size: Math.max(1.2, s * g.U * 6), glow, phase: rand() * 6.28 });
      }
    }
    return list;
  }

  function paintLanterns(ctx, g, t) {
    const sprites = state.glows;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of state.lanterns) {
      const breathe = 0.78 + 0.22 * Math.sin(t * 0.7 + l.phase);
      const r = l.size * 4;
      ctx.globalAlpha = breathe;
      ctx.drawImage(sprites[l.glow], l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const l of state.lanterns) {
      ctx.fillStyle = LANTERNS[l.glow];
      ctx.beginPath();
      ctx.ellipse(l.x, l.y, l.size * 0.8, l.size, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintRoad(ctx, g, t) {
    for (const l of state.lanterns) {
      ctx.fillStyle = LANTERNS[l.glow];
      const reach = Math.min(g.H - l.fy, l.s * g.U * 26);
      for (let k = 0; k < SHINE_ROWS; k++) {
        const f = k / SHINE_ROWS;
        const y = l.fy + f * reach;
        const wob = Math.sin(t * 1.4 + k * 1.3 + l.phase) * l.s * g.U * 1.1;
        const w = l.size * (1.5 + Math.sin(t + k * 2.2 + l.phase) * 0.5);
        ctx.globalAlpha = 0.46 * (1 - f);
        ctx.fillRect(l.fx + wob - w * (l.fx < g.W / 2 ? 0 : 1), y, w, Math.max(1, l.s * g.U * 1.2));
      }
    }
    ctx.globalAlpha = 1;
  }

  function resetDrop(g, i, anywhere) {
    const r = state.rand;
    state.dx[i] = r() * g.W;
    state.dy[i] = anywhere ? r() * g.H : -g.U * 5;
    state.dv[i] = g.U * (55 + r() * 40);
  }

  function paintRain(ctx, g, dt, amount) {
    const count = Math.min(MAX_DROPS, Math.round(g.W * 2 * amount));
    const len = Math.max(2, g.U * 2.8);
    ctx.fillStyle = '#b6c0d4';
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
    const street = paintStreet(g, rand);
    state.street = street.canvas;
    state.lanterns = placeLanterns(g, street.steps, rand);
    state.glows = LANTERNS.map((c) => paintGlow(32, c));
    state.dx = new Float32Array(MAX_DROPS);
    state.dy = new Float32Array(MAX_DROPS);
    state.dv = new Float32Array(MAX_DROPS);
    for (let i = 0; i < MAX_DROPS; i++) resetDrop(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.street, 0, 0);
    paintRoad(ctx, g, t);
    paintLanterns(ctx, g, t);
    paintRain(ctx, g, dt, api.props.rain);
  }

  Kasuri.run({
    defaults: { rain: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, tint: 0.5 },
    maxFps: 24,
    setup,
    draw,
  });
})();
