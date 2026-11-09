/*
 * 蜜柑 Mikan — mandarin orchards on stone terraces above a calm sea.
 *
 * Sky, sea, islands and the terraced slope are baked into layers and repainted
 * once a minute from the clock. Between repaints only clouds, their shadows on
 * the slope, a few glints on the water and one small boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.37;
  const TERRACES = 9;
  const RETINT_SECONDS = 60;
  const GLINTS = 14;
  const SHADOWS = 3;
  const LEAF = ['#263f2c', '#355536', '#4f7044', '#6c8a52'];
  const FRUIT = ['#e08a34', '#d9702c', '#eaa443'];
  const FRUIT_LIT = '#f4c467';
  const WALL = ['#8b867a', '#a8a293', '#6c6a62'];
  const SOIL = '#6a5a3e';
  const GRASS = '#5d6b3c';
  const SEA = '#2c5b82';
  const ISLE = '#33475a';
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

  const hex = (c) => toHex(c);
  const tint = (h, amb, k = 1) => {
    const c = parseColor(h);
    return hex([lerp(c[0], c[0] * amb[0] / 255, k), lerp(c[1], c[1] * amb[1] / 255, k), lerp(c[2], c[2] * amb[2] / 255, k)]);
  };

  // ---- the slope ---------------------------------------------------------

  // Top edge of the hill: low at the left, rising to the right.
  function ridge(g, x) {
    const f = x / g.W;
    return g.H * (0.62 - 0.46 * smoothstep(0.3, 1.1, f)) + (fbm(x / (g.U * 22), 3.1, 3, 7) - 0.5) * g.U * 5;
  }

  // Terrace i edge (0 = ridge, TERRACES = bottom of screen), widening toward the viewer.
  function terraceY(g, i, x) {
    const top = ridge(g, x);
    const k = Math.pow(i / TERRACES, 1.35);
    const sag = Math.sin((x / g.W) * Math.PI * 1.3 + i * 0.5) * g.U * (0.6 + i * 0.35);
    return lerp(top, g.H * 1.04, k) + sag * (i > 0 ? 1 : 0);
  }

  function band(ctx, g, i0, i1, lift0, lift1) {
    ctx.beginPath();
    for (let x = -2; x <= g.W + 2; x += 2) ctx.lineTo(x, terraceY(g, i0, x) - lift0);
    for (let x = g.W + 2; x >= -2; x -= 2) ctx.lineTo(x, terraceY(g, i1, x) - lift1);
    ctx.closePath();
    ctx.fill();
  }

  function tree(ctx, g, rand, x, y, r, amb, fruit) {
    ctx.fillStyle = tint(LEAF[0], amb);
    blob(ctx, x, y - r * 0.8, r, r * 0.85);
    ctx.fillStyle = tint(LEAF[1], amb);
    blob(ctx, x - r * 0.15, y - r * 0.95, r * 0.8, r * 0.65);
    ctx.fillStyle = tint(LEAF[2], amb);
    blob(ctx, x - r * 0.35, y - r * 1.15, r * 0.48, r * 0.38);
    ctx.fillStyle = tint(LEAF[3], amb);
    blob(ctx, x - r * 0.45, y - r * 1.3, r * 0.22, r * 0.16);
    const n = Math.round(2 + r * fruit * 0.45);
    const fr = Math.max(0.6, r * 0.11);
    for (let k = 0; k < n; k++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r * 0.82;
      const fx = x + Math.cos(a) * d;
      const fy = y - r * 0.85 + Math.sin(a) * d * 0.75;
      ctx.fillStyle = tint(FRUIT[k % FRUIT.length], amb, 0.55);
      blob(ctx, fx, fy, fr, fr);
      if (fr > 1.2) {
        ctx.fillStyle = tint(FRUIT_LIT, amb, 0.5);
        blob(ctx, fx - fr * 0.3, fy - fr * 0.3, fr * 0.4, fr * 0.4);
      }
    }
  }

  function paintSlope(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const amb = sky.amb;
    for (let i = 0; i < TERRACES; i++) {
      const depth = (i + 1) / TERRACES;
      const wall = g.U * (0.8 + depth * 3.2);
      ctx.fillStyle = tint(hex(mixColor(parseColor(GRASS), sky.haze, 0.45 * (1 - depth))), amb);
      band(ctx, g, i, i + 1, 0, wall);
      ctx.fillStyle = tint(SOIL, amb);
      band(ctx, g, i + 1, i + 1, wall * 1.15, wall);
      ctx.fillStyle = tint(WALL[0], amb);
      band(ctx, g, i + 1, i + 1, wall, 0);
      stones(ctx, g, rand, i + 1, wall, amb);
      const r = g.U * (1.2 + depth * 4.2);
      for (let x = -r; x < g.W + r; ) {
        const y = terraceY(g, i + 1, x) - wall * 1.1 - rand() * r * 0.15;
        tree(ctx, g, rand, x, y, r * (0.85 + rand() * 0.3), amb, depth * 2.4);
        x += r * (1.7 + rand() * 0.6);
      }
    }
    return c;
  }

  // Sparse light and dark stones laid into each retaining wall.
  function stones(ctx, g, rand, i, wall, amb) {
    const step = Math.max(2, wall * 1.3);
    for (let x = 0; x < g.W; x += step * (0.7 + rand() * 0.6)) {
      const y = terraceY(g, i, x) - wall * (0.25 + rand() * 0.5);
      ctx.fillStyle = tint(rand() < 0.5 ? WALL[1] : WALL[2], amb);
      blob(ctx, x, y, step * 0.35, Math.max(0.5, wall * 0.18));
    }
  }

  // ---- sky and sea -------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hy = g.H * HORIZON;
    steps(ctx, g, 0, hy + 1, [sky.top, mixColor(sky.top, sky.low, 0.35), mixColor(sky.top, sky.low, 0.7), sky.low], rand);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * hy * 0.9, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const sea = mixColor(parseColor(tint(SEA, sky.amb)), sky.low, 0.15);
    steps(ctx, g, hy, g.H, [mixColor(sea, sky.low, 0.45), mixColor(sea, sky.low, 0.2), sea], rand, g.H * 0.2);
    isles(ctx, g, sky, hy);
    ctx.fillStyle = hex(mixColor(sky.low, [240, 236, 224], 0.4));
    ctx.globalAlpha = 0.35;
    for (let y = hy + 2; y < g.H * 0.6; y += g.U * (1.4 + rand() * 1.4)) {
      for (let x = rand() * g.U * 10; x < g.W; x += g.U * (8 + rand() * 18)) {
        ctx.fillRect(x, y, g.U * (2 + rand() * 5), 1);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Flat colour bands, dithered where they meet, so the weave sees a few clean tones.
  function steps(ctx, g, y0, y1, inks, rand, span) {
    const h = Math.ceil(y1 - y0);
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    const reach = span || h;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / reach) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, Math.floor(y0));
  }

  function isles(ctx, g, sky, hy) {
    const ink = hex(mixColor(parseColor(ISLE), sky.haze, 0.4));
    ctx.fillStyle = ink;
    const hills = [[0.08, 0.16, 3.2], [0.3, 0.1, 2.2], [0.5, 0.2, 4.4], [0.72, 0.07, 1.6]];
    for (const [cx, hw, h] of hills) {
      ctx.beginPath();
      ctx.moveTo((cx - hw) * g.W, hy + 1);
      for (let k = 0; k <= 20; k++) {
        const x = (cx - hw + (2 * hw * k) / 20) * g.W;
        const d = (k / 20) * 2 - 1;
        ctx.lineTo(x, hy - g.U * h * (1 - d * d) * (0.85 + fbm(x * 0.1, 1, 2, 3) * 0.3));
      }
      ctx.lineTo((cx + hw) * g.W, hy + 1);
      ctx.fill();
    }
  }

  // Wisps that tile sideways, kept to the upper sky.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 37);
    for (let y = 0; y < h; y++) {
      const fade = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = v * (0.6 + fade * 0.4) > 0.6 ? 215 : v * (0.6 + fade * 0.4) > 0.53 ? 120 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintShadow(g) {
    const w = Math.ceil(g.W * 0.5);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.scale(1, h / w);
    const grad = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(14,18,30,0.42)');
    grad.addColorStop(0.6, 'rgba(14,18,30,0.3)');
    grad.addColorStop(1, 'rgba(14,18,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, w);
    return c;
  }

  function paintBoat(g) {
    const s = Math.max(1, g.U * 0.9);
    const c = layer(s * 9, s * 5);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(s * 3.4, s * 0.6, s * 2.2, s * 2);
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(s * 3.4, s * 0.6, s * 2.2, s * 0.5);
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath();
    ctx.moveTo(0, s * 2.6);
    ctx.lineTo(s * 9, s * 2.6);
    ctx.lineTo(s * 7.8, s * 4);
    ctx.lineTo(s * 0.8, s * 4);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(53);
    state.back = paintBack(g, sky, rand);
    state.slope = paintSlope(g, sky, rand);
    state.cloudAlpha = 0.8 - sky.night * 0.5;
    state.glint = hex(mixColor(sky.low, [250, 246, 232], 0.6));
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.6) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    const hy = g.H * HORIZON;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const p = state.glints[i];
      const a = 0.5 + 0.5 * Math.sin(t * 0.6 + p.phase);
      ctx.globalAlpha = a * 0.6;
      const x = ((p.x + t * g.U * 0.4 * p.v) % (g.W * 0.9));
      ctx.fillRect(x, hy + p.y * g.H * 0.22, p.w * g.U, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const span = g.W * 0.75;
    const p = ((t * g.U * 0.9) % (span + g.W * 0.2)) - g.W * 0.1;
    const b = state.boat;
    const y = g.H * (HORIZON + 0.08) + Math.sin(t * 1.3) * 0.5;
    ctx.drawImage(b, p, y - b.height);
    ctx.fillStyle = state.glint;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(p - g.U * 6, y - 1, g.U * 6, 1);
    ctx.globalAlpha = 1;
  }

  // Cloud shadows sliding down across the terraces.
  function drawShadows(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.shadow;
    ctx.globalAlpha = Math.min(1, amount * 0.9) * (1 - state.dim * 0.8);
    for (let i = 0; i < SHADOWS; i++) {
      const loop = g.W + c.width;
      const x = ((t * g.U * 1.6 + i * loop / SHADOWS) % loop) - c.width;
      const y = g.H * (0.38 + i * 0.2) - c.height / 2;
      ctx.drawImage(c, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    state.shadow = paintShadow(g);
    state.boat = paintBoat(g);
    const rand = K.rng(17);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      state.glints.push({ x: rand() * g.W, y: rand(), w: 1.5 + rand() * 3, v: 0.5 + rand(), phase: rand() * TAU });
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.slope, 0, 0);
    drawShadows(ctx, g, t, props.clouds);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
