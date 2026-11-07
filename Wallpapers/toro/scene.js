/*
 * 灯籠流し Toro — paper lanterns set adrift on a night river.
 *
 * Lanterns ride bands of depth: nearer means larger and faster, and they are
 * kept in depth order so the near ones cover the far ones. Each sits on a long
 * broken reflection. A click on the water sets a new one afloat there.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const PAPER = '#f0c98a';
  const PAPER_DARK = '#c98a4e';
  const FRAME = '#2a1b14';
  const SHORE = 0.4;
  const MAX_LANTERNS = 34;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGlow(radius) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(226,154,84,0.55)');
    grad.addColorStop(1, 'rgba(200,110,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintTemple(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#0b0d16';
    ctx.fillRect(x - u * 7, y - u * 5, u * 14, u * 5);
    for (let tier = 0; tier < 2; tier++) {
      const w = u * (12 - tier * 4);
      const top = y - u * (9 + tier * 5);
      ctx.beginPath();
      ctx.moveTo(x - w, top + u * 4);
      ctx.quadraticCurveTo(x - w * 0.4, top + u * 3, x, top);
      ctx.quadraticCurveTo(x + w * 0.4, top + u * 3, x + w, top + u * 4);
      ctx.fill();
    }
    ctx.fillStyle = '#d29a58';
    ctx.fillRect(x - u * 4, y - u * 3.4, u * 2, u * 1.8);
    ctx.fillRect(x + u * 2, y - u * 3.4, u * 2, u * 1.8);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const shore = g.H * SHORE;
    const sky = ctx.createLinearGradient(0, 0, 0, shore);
    sky.addColorStop(0, '#080b1b');
    sky.addColorStop(1, '#1e2340');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, shore);
    ctx.fillStyle = '#aab1c4';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * shore * 0.7, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#181c33';
    ctx.beginPath();
    ctx.moveTo(0, shore);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, shore - fbm(x * 0.01, 2, 4, 5) * g.H * 0.2);
    ctx.lineTo(g.W, shore);
    ctx.fill();
    paintTemple(ctx, g, g.W * 0.72, shore);
    const water = ctx.createLinearGradient(0, shore, 0, g.H);
    water.addColorStop(0, '#262d4a');
    water.addColorStop(1, '#0f1426');
    ctx.fillStyle = water;
    ctx.fillRect(0, shore, g.W, g.H - shore);
    return c;
  }

  // Thin horizontal streaks that tile sideways.
  function paintRipples(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.024, y * 0.5, 3, seed);
    for (let y = 0; y < h; y++) {
      const near = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 104;
        img.data[i + 1] = 118;
        img.data[i + 2] = 156;
        img.data[i + 3] = smoothstep(0.54, 0.7, v) * (45 + near * 60);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeLantern(g, rand, depth, x) {
    return { depth, x, phase: rand() * 6.28, speed: 0.75 + rand() * 0.5, life: 0.8 + rand() * 0.2 };
  }

  function drawLantern(ctx, g, l, t) {
    const scale = lerp(0.42, 1.55, l.depth);
    const y = g.H * lerp(SHORE + 0.04, 0.93, l.depth) + Math.sin(t * 0.8 + l.phase) * g.U * 0.35 * scale;
    const x = l.x;
    const w = g.U * 3.2 * scale;
    const h = g.U * 4 * scale;
    const flicker = 0.82 + 0.18 * Math.sin(t * 1.7 + l.phase * 3);
    ctx.globalCompositeOperation = 'lighter';
    const size = state.glow.width * scale;
    ctx.globalAlpha = 0.85 * flicker;
    ctx.drawImage(state.glow, x - size / 2, y - h / 2 - size / 2, size, size);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PAPER_DARK;
    for (let k = 0; k < 6; k++) {
      const wob = Math.sin(t * 1.3 + l.phase + k * 1.1) * g.U * 0.6 * scale;
      ctx.globalAlpha = (0.42 - k * 0.06) * flicker;
      ctx.fillRect(x - w * 0.42 + wob, y + (k + 0.5) * g.U * 1.3 * scale, w * 0.84, Math.max(1, g.U * 0.7 * scale));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - w * 0.62, y, w * 1.24, Math.max(1, g.U * 0.7 * scale));
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = flicker;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - w * 0.6, y - h - Math.max(1, g.U * 0.5), w * 1.2, Math.max(1, g.U * 0.6));
    ctx.fillRect(x - 0.5, y - h, 1, h);
  }

  function moveLanterns(g, dt, props) {
    const speed = g.U * 2.6 * props.drift;
    const margin = g.U * 12;
    for (const l of state.lanterns) {
      l.x += speed * dt * lerp(0.45, 1.5, l.depth) * l.speed;
      if (l.x > g.W + margin) l.x = -margin;
    }
  }

  function fillLanterns(g, count) {
    const list = state.lanterns;
    const rand = state.rand;
    while (list.length < count) list.push(makeLantern(g, rand, Math.pow(rand(), 1.4), rand() * g.W));
    if (list.length > count) list.length = count;
    list.sort((a, b) => a.depth - b.depth);
  }

  function onClick(x, y, api) {
    const g = state.g;
    const depth = (y / g.H - (SHORE + 0.04)) / (0.93 - SHORE - 0.04);
    if (depth < 0 || depth > 1) return;
    state.lanterns.shift();
    state.lanterns.push(makeLantern(g, state.rand, depth, x));
    state.lanterns.sort((a, b) => a.depth - b.depth);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.ripples = paintRipples(Math.ceil(g.W * 1.3), Math.ceil(g.H * (1 - SHORE)), 4);
    state.glow = paintGlow(Math.max(5, g.U * 9));
    state.lanterns = [];
    state.wanted = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const wanted = Math.min(MAX_LANTERNS, Math.round(18 * props.lanterns));
    if (wanted !== state.wanted) {
      fillLanterns(g, wanted);
      state.wanted = wanted;
    }
    ctx.drawImage(state.back, 0, 0);
    const w = state.ripples.width;
    const x = (t * g.U * 2.4 * props.drift) % w;
    ctx.drawImage(state.ripples, x, g.H * SHORE);
    ctx.drawImage(state.ripples, x - w, g.H * SHORE);
    moveLanterns(g, dt, props);
    for (const l of state.lanterns) drawLantern(ctx, g, l, t);
  }

  Kasuri.run({
    defaults: { lanterns: 1, drift: 1, ramp: 'lines', cell: 8, boost: 0.3, gain: 1.2, tint: 0.45 },
    maxFps: 24,
    setup,
    draw,
    onClick,
  });
})();
