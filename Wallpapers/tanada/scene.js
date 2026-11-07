/*
 * 棚田 Tanada — flooded rice terraces stepping down a hillside, holding the sky.
 *
 * Every terrace is one curved band filled with the clock's sky colours, so the
 * whole slope changes with the hour. It repaints once a minute. Between
 * repaints only a few shimmer dashes and some dragonflies move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, noise2 } = K;

  const TERRACES = 8;
  const MAX_DASHES = 90;
  const MAX_FLIES = 12;
  const RETINT_SECONDS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A contour line down the slope; f is 0 at the top terrace, 1 at the bottom.
  function contour(g, x, f) {
    const y = lerp(0.42, 1.04, Math.pow(f, 1.25));
    const bend = (Math.sin(x * 0.012 + 0.5) * 0.06 + Math.sin(x * 0.031) * 0.018) * (0.35 + f);
    return g.H * (y + bend);
  }

  function paintHills(ctx, g, sky) {
    const far = mixColor(sky.haze, [60, 92, 78], 0.5);
    const near = mixColor(mixColor(sky.haze, [44, 84, 54], 0.8), sky.amb, 0.08);
    ctx.fillStyle = toHex(far);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.5);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.36 - fbm(x * 0.008, 3, 4, 4) * 0.2));
    ctx.lineTo(g.W, g.H * 0.5);
    ctx.fill();
    ctx.fillStyle = toHex(near);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.55);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.46 - fbm(x * 0.014, 7, 3, 8) * 0.14));
    ctx.lineTo(g.W, g.H * 0.55);
    ctx.fill();
  }

  function paintTerrace(ctx, g, sky, i) {
    const f0 = i / TERRACES;
    const f1 = (i + 1) / TERRACES;
    const y0 = contour(g, g.W / 2, f0);
    const y1 = contour(g, g.W / 2, f1);
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    const mirror = (i % 3) / 6;
    grad.addColorStop(0, toHex(mixColor(sky.top, sky.low, 0.3 + mirror)));
    grad.addColorStop(1, toHex(mixColor(sky.top, sky.low, 0.72 + mirror * 0.4)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, contour(g, 0, f0));
    for (let x = 2; x <= g.W + 2; x += 2) ctx.lineTo(x, contour(g, x, f0));
    for (let x = g.W + 2; x >= 0; x -= 2) ctx.lineTo(x, contour(g, x, f1));
    ctx.fill();
  }

  function paintLevee(ctx, g, sky, i, rand) {
    const f = (i + 1) / TERRACES;
    const dark = mixColor([58, 84, 46], [24, 30, 44], sky.night * 0.7);
    const green = mixColor([122, 160, 76], [40, 52, 60], sky.night * 0.75);
    ctx.fillStyle = toHex(dark);
    const h = Math.max(1, g.U * (0.7 + f * 3.4));
    for (let x = 0; x < g.W; x += 1) ctx.fillRect(x, contour(g, x, f) - h, 1.5, h);
    // Young rice along the near edge of each paddy.
    ctx.fillStyle = toHex(green);
    const rows = Math.round(g.W * 1.4);
    for (let k = 0; k < rows; k++) {
      const x = rand() * g.W;
      const y = contour(g, x, f) - h - rand() * g.U * (1 + f * 3);
      ctx.fillRect(x, y, 1, Math.max(1, g.U * (0.5 + f)));
    }
  }

  function repaint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    const rand = K.rng(17);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.45);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    paintHills(ctx, g, sky);
    ctx.fillStyle = toHex(mixColor(sky.low, sky.top, 0.3));
    ctx.fillRect(0, g.H * 0.54, g.W, g.H * 0.46);
    for (let i = 0; i < TERRACES; i++) paintTerrace(ctx, g, sky, i);
    for (let i = 0; i < TERRACES; i++) paintLevee(ctx, g, sky, i, rand);
    state.world = c;
    state.glint = toHex(mixColor(sky.low, [244, 240, 226], 0.55));
    state.fly = sky.night > 0.5 ? '#7d6a68' : '#b8452f';
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function placeDashes(g, rand) {
    state.dx = new Float32Array(MAX_DASHES);
    state.dy = new Float32Array(MAX_DASHES);
    state.dp = new Float32Array(MAX_DASHES);
    state.dl = new Float32Array(MAX_DASHES);
    for (let i = 0; i < MAX_DASHES; i++) {
      const f = (Math.floor(rand() * TERRACES) + 0.2 + rand() * 0.5) / TERRACES;
      const x = rand() * g.W;
      state.dx[i] = x;
      state.dy[i] = contour(g, x, f);
      state.dp[i] = rand() * 6.28;
      state.dl[i] = g.U * (1.6 + f * 7);
    }
  }

  function drawDashes(ctx, t) {
    ctx.fillStyle = state.glint;
    for (let i = 0; i < MAX_DASHES; i++) {
      const v = Math.sin(t * 0.8 + state.dp[i]);
      if (v < 0.1) continue;
      ctx.globalAlpha = v * 0.55;
      ctx.fillRect(state.dx[i] + Math.sin(t * 0.3 + i) * 2, state.dy[i], state.dl[i], 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlies(ctx, g, t) {
    ctx.fillStyle = state.fly;
    const wing = '#d8d8cc';
    for (let i = 0; i < MAX_FLIES; i++) {
      const dash = Math.floor(t * 0.25 + i * 0.37);
      const a = noise2(dash, i * 5.1, 2);
      const b = noise2(dash + 1, i * 5.1, 2);
      const u = K.smoothstep(0.65, 1, (t * 0.25 + i * 0.37) % 1);
      const hx = lerp(a, b, u);
      const hy = lerp(noise2(dash, i * 9.7, 7), noise2(dash + 1, i * 9.7, 7), u);
      const x = g.W * (hx * 1.4 - 0.2);
      const y = g.H * (0.35 + hy * 0.6);
      const s = Math.max(1, g.U * 0.5);
      ctx.fillStyle = state.fly;
      ctx.fillRect(x - s * 2, y, s * 4, Math.max(1, s * 0.7));
      ctx.fillStyle = wing;
      ctx.globalAlpha = 0.6;
      const up = Math.sin(t * 28 + i) > 0 ? -1 : 1;
      ctx.fillRect(x - s, y + up * s, s * 2.4, 1);
      ctx.globalAlpha = 1;
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    placeDashes(g, K.rng(api.seed));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== api.props.time) repaint(g, api.props.time);
    ctx.drawImage(state.world, 0, 0);
    drawDashes(ctx, t);
    if (api.props.dragonflies) drawFlies(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', dragonflies: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.35 },
    maxFps: 20,
    setup,
    draw,
  });
})();
