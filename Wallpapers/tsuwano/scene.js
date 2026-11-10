/*
 * 津和野 Tsuwano — a castle-town canal. White namako walls and a gate with
 * red tiles stand over a stone bank; big koi swim in the water below.
 *
 * Sky, hill, walls and the wall's reflection are baked once and repainted
 * once a minute from the clock. Between repaints only the reflection ripple,
 * a few glints, drifting leaves and the koi move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HILL = 0.3;
  const ROOF_TOP = 0.275;
  const ROOF_BOT = 0.315;
  const WALL_BOT = 0.485;
  const NAMAKO = 0.405;
  const BANK = 0.53;
  const GATE = [0.4, 0.6];
  const RETINT_SECONDS = 60;
  const MAX_KOI = 7;
  const SEGS = 9;
  const PROFILE = [0.62, 0.86, 1, 1, 0.92, 0.78, 0.62, 0.46, 0.32];
  const KOI = [
    { cx: 0.3, cy: 0.72, ax: 0.2, ay: 0.06, w: 0.21, p: 0.0, body: '#d6602f', patch: '#d6452c' },
    { cx: 0.62, cy: 0.83, ax: 0.26, ay: 0.05, w: 0.17, p: 2.1, body: '#e8e2d0', patch: '#d6452c' },
    { cx: 0.5, cy: 0.64, ax: 0.3, ay: 0.04, w: 0.15, p: 4.0, body: '#e8e2d0', patch: '#2a2d3c' },
    { cx: 0.75, cy: 0.74, ax: 0.18, ay: 0.07, w: 0.24, p: 1.0, body: '#d9a73a', patch: '#e8e2d0' },
    { cx: 0.2, cy: 0.88, ax: 0.15, ay: 0.04, w: 0.19, p: 5.2, body: '#d6452c', patch: '#e8e2d0' },
    { cx: 0.85, cy: 0.9, ax: 0.1, ay: 0.04, w: 0.22, p: 3.3, body: '#2a2d3c', patch: '#d6602f' },
    { cx: 0.4, cy: 0.94, ax: 0.2, ay: 0.03, w: 0.16, p: 0.8, body: '#e8e2d0', patch: '#d9a73a' },
  ];
  const LEAVES = [
    { x: 0.1, y: 0.6, v: 0.012, c: '#c8452c' },
    { x: 0.35, y: 0.78, v: 0.009, c: '#d9a73a' },
    { x: 0.55, y: 0.57, v: 0.011, c: '#c8452c' },
    { x: 0.7, y: 0.9, v: 0.008, c: '#b8412c' },
    { x: 0.9, y: 0.68, v: 0.01, c: '#d9a73a' },
    { x: 0.22, y: 0.95, v: 0.007, c: '#c8452c' },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // Colour lit by the sky, then pulled toward night ink.
  function lit(sky, h, amount = 0.18, dark = '#141a2c') {
    const c = mixColor(rgb(h), sky.amb, amount * (1 - sky.night));
    return hex(mixColor(c, rgb(dark), sky.night * 0.68));
  }

  // ---- sky and far hill --------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HILL);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.2, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintHill(ctx, g, sky);
    return c;
  }

  // The castle hill: a soft green ridge with a few pale pines along it.
  function paintHill(ctx, g, sky) {
    const far = mixColor(mixColor(rgb('#5d7a68'), sky.haze, 0.5), rgb('#1c2438'), sky.night * 0.6);
    ctx.fillStyle = hex(far);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.4);
    for (let px = 0; px <= g.W; px += 2) {
      const f = px / g.W;
      const bump = Math.pow(Math.max(0, 1 - Math.abs(f - 0.72) / 0.42), 1.5);
      const top = g.H * (0.285 - 0.11 * bump) + (fbm(px * 0.05, 3, 3, 7) - 0.5) * g.U * 2;
      ctx.lineTo(px, top);
    }
    ctx.lineTo(g.W, g.H * 0.4);
    ctx.closePath();
    ctx.fill();
    const near = mixColor(mixColor(rgb('#3f5e48'), sky.haze, 0.25), rgb('#141c2c'), sky.night * 0.65);
    ctx.fillStyle = hex(near);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.4);
    for (let px = 0; px <= g.W; px += 2) {
      const f = px / g.W;
      const bump = Math.pow(Math.max(0, 1 - Math.abs(f - 0.3) / 0.35), 1.4);
      const top = g.H * (0.3 - 0.07 * bump) + (fbm(px * 0.07, 9, 3, 13) - 0.5) * g.U * 1.6;
      ctx.lineTo(px, top);
    }
    ctx.lineTo(g.W, g.H * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const d = lerp(fbm(x * 0.016, y * 0.08, 4, 21), fbm((x - w) * 0.016, y * 0.08, 4, 21), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, d) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- trees -------------------------------------------------------------

  function blobTree(ctx, g, sky, rand, cx, cy, spread, cols, n) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = lit(sky, cols[Math.floor(rand() * cols.length)], 0.15);
      const a = rand() * 6.28;
      const r = rand();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * spread, cy + Math.sin(a) * r * spread * 0.7, g.U * (1.3 + rand() * 1.5), 0, 6.3);
      ctx.fill();
    }
  }

  function paintTrees(ctx, g, sky, rand) {
    const maple = ['#b8412c', '#c8562c', '#d9a73a', '#a8402e'];
    blobTree(ctx, g, sky, rand, g.W * 0.1, g.H * 0.22, g.U * 9, maple, 70);
    blobTree(ctx, g, sky, rand, g.W * 0.9, g.H * 0.2, g.U * 8, maple, 60);
    blobTree(ctx, g, sky, rand, g.W * 0.7, g.H * 0.25, g.U * 5, ['#3c5a3c', '#2f4a36'], 34);
    blobTree(ctx, g, sky, rand, g.W * 0.27, g.H * 0.255, g.U * 4, ['#3c5a3c', '#4c6a44'], 24);
  }

  // ---- roofs and walls ---------------------------------------------------

  function tileRoof(ctx, g, sky, x0, x1, y0, y1, inset) {
    ctx.fillStyle = lit(sky, '#a8442e', 0.2);
    ctx.beginPath();
    ctx.moveTo(x0 + inset, y0);
    ctx.lineTo(x1 - inset, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = lit(sky, '#7a2e22', 0.2);
    const step = Math.max(2, g.U * 0.9);
    for (let px = x0; px < x1; px += step) {
      const f = (px - x0) / (x1 - x0);
      ctx.fillRect(px + (f - 0.5) * inset * 1.4 + inset * 0.7, y0, 1, y1 - y0);
    }
    ctx.fillStyle = lit(sky, '#4a3430', 0.1);
    ctx.fillRect(x0 + inset, y0 - Math.max(1, g.U * 0.5), x1 - x0 - inset * 2, Math.max(1, g.U * 0.5));
    ctx.fillStyle = lit(sky, '#2a2630', 0.1);
    ctx.fillRect(x0, y1, x1 - x0, Math.max(1, g.U * 0.35));
  }

  function paintWall(ctx, g, sky) {
    const top = g.H * ROOF_BOT;
    const white = lit(sky, '#ece8dc', 0.3);
    ctx.fillStyle = white;
    ctx.fillRect(0, top, g.W, g.H * WALL_BOT - top);
    // Upper plaster: faint post lines.
    ctx.fillStyle = lit(sky, '#a8a498', 0.2);
    for (let f = 0.04; f < 1; f += 0.12) ctx.fillRect(g.W * f, top, 1, g.H * NAMAKO - top);
    // Lower namako: dark tiles divided by raised white joints.
    const n0 = g.H * NAMAKO;
    const n1 = g.H * WALL_BOT;
    ctx.fillStyle = lit(sky, '#2a3040', 0.12);
    ctx.fillRect(0, n0, g.W, n1 - n0);
    ctx.fillStyle = lit(sky, '#e8e4d8', 0.25);
    const cellH = Math.max(2, g.U * 1.5);
    for (let py = n0; py < n1; py += cellH) ctx.fillRect(0, py, g.W, 1);
    let row = 0;
    for (let py = n0; py < n1; py += cellH, row++) {
      for (let px = (row % 2) * cellH * 0.5; px < g.W; px += cellH) ctx.fillRect(px, py, 1, cellH);
    }
    ctx.fillRect(0, n0, g.W, Math.max(1, g.U * 0.35));
    tileRoof(ctx, g, sky, -2, g.W + 2, g.H * ROOF_TOP, top, 0);
  }

  function paintGate(ctx, g, sky) {
    const x0 = g.W * GATE[0];
    const x1 = g.W * GATE[1];
    const y1 = g.H * WALL_BOT;
    ctx.fillStyle = lit(sky, '#ece8dc', 0.3);
    ctx.fillRect(x0, g.H * 0.3, x1 - x0, y1 - g.H * 0.3);
    // Dark doorway between two wooden posts.
    const dx0 = x0 + g.W * 0.03;
    const dx1 = x1 - g.W * 0.03;
    ctx.fillStyle = lit(sky, '#1c1a1e', 0.05, '#0a0c14');
    ctx.fillRect(dx0, g.H * 0.355, dx1 - dx0, y1 - g.H * 0.355);
    ctx.fillStyle = lit(sky, '#5a3a2a', 0.15);
    const post = Math.max(2, g.U * 0.9);
    ctx.fillRect(dx0 - post, g.H * 0.34, post, y1 - g.H * 0.34);
    ctx.fillRect(dx1, g.H * 0.34, post, y1 - g.H * 0.34);
    ctx.fillRect(dx0 - post, g.H * 0.34, dx1 - dx0 + post * 2, Math.max(2, g.U * 0.9));
    // Two layers of red tile, the top one narrower.
    tileRoof(ctx, g, sky, x0 - g.W * 0.03, x1 + g.W * 0.03, g.H * 0.225, g.H * 0.3, g.W * 0.025);
    tileRoof(ctx, g, sky, x0 + g.W * 0.03, x1 - g.W * 0.03, g.H * 0.185, g.H * 0.225, g.W * 0.018);
    // Warm lamps under the eaves glow after dark.
    if (sky.night > 0.1) {
      ctx.fillStyle = `rgba(246,200,120,${0.85 * sky.night})`;
      ctx.fillRect(dx0 - post * 2, g.H * 0.325, Math.max(2, g.U * 0.9), Math.max(2, g.U * 1.2));
      ctx.fillRect(dx1 + post * 1.1, g.H * 0.325, Math.max(2, g.U * 0.9), Math.max(2, g.U * 1.2));
    }
  }

  function paintBank(ctx, g, sky, rand) {
    const y0 = g.H * WALL_BOT;
    const y1 = g.H * BANK;
    ctx.fillStyle = lit(sky, '#8a8a84', 0.2);
    ctx.fillRect(0, y0, g.W, y1 - y0);
    ctx.fillStyle = lit(sky, '#5c5e5c', 0.15);
    const rowH = Math.max(2, g.U * 1.3);
    for (let py = y0 + rowH; py < y1; py += rowH) ctx.fillRect(0, py, g.W, 1);
    let r = 0;
    for (let py = y0; py < y1; py += rowH, r++) {
      for (let px = (r % 2) * g.U * 2; px < g.W; px += g.U * (3 + rand() * 2)) ctx.fillRect(px, py, 1, rowH);
    }
    ctx.fillStyle = lit(sky, '#4c6a44', 0.15);
    ctx.fillRect(0, y0, g.W, Math.max(1, g.U * 0.6));
    ctx.fillStyle = lit(sky, '#2c3a30', 0.1);
    ctx.fillRect(0, y1 - 1, g.W, 1);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H * BANK + 1);
    const ctx = c.getContext('2d');
    paintTrees(ctx, g, sky, rand);
    paintWall(ctx, g, sky);
    paintGate(ctx, g, sky);
    paintBank(ctx, g, sky, rand);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * BANK;
    const deep = mixColor(rgb('#2f5a66'), rgb('#0e1424'), sky.night * 0.7);
    const top = mixColor(mixColor(deep, sky.low, 0.5 * (1 - sky.night * 0.5)), rgb('#4a7a76'), 0.25);
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    return c;
  }

  // The wall upside down, fading with depth.
  function paintReflection(g, front, sky) {
    const h = Math.ceil(g.H * 0.32);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(front, 0, g.H * BANK - h + 0, g.W, h, 0, 0, g.W, h);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,0.8)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.water = paintWater(g, sky);
    state.refl = paintReflection(g, state.front, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.glint = hex(mixColor(rgb('#f4f0e0'), sky.amb, 0.4));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- koi ---------------------------------------------------------------

  function pathX(g, k, t) {
    return g.W * (k.cx + k.ax * Math.sin(k.w * t + k.p));
  }

  function pathY(g, k, t) {
    return g.H * (k.cy + k.ay * Math.sin(k.w * 1.37 * t + k.p * 1.7));
  }

  function makeChains(g) {
    state.chains = KOI.map((k, n) => {
      const xs = new Float32Array(SEGS);
      const ys = new Float32Array(SEGS);
      const s = g.U * (1.5 + (k.cy - BANK) * 2.2);
      const hx = pathX(g, k, 0);
      const hy = pathY(g, k, 0);
      const dir = Math.cos(k.p) >= 0 ? 1 : -1;
      for (let i = 0; i < SEGS; i++) {
        xs[i] = hx - dir * i * s * 1.25;
        ys[i] = hy;
      }
      return { xs, ys, s };
    });
  }

  function followChain(ch) {
    const d = ch.s * 1.25;
    for (let i = 1; i < SEGS; i++) {
      const dx = ch.xs[i] - ch.xs[i - 1];
      const dy = ch.ys[i] - ch.ys[i - 1];
      const len = Math.hypot(dx, dy) || 1;
      ch.xs[i] = ch.xs[i - 1] + (dx / len) * d;
      ch.ys[i] = ch.ys[i - 1] + (dy / len) * d;
    }
  }

  function drawKoi(ctx, g, t, n) {
    const k = KOI[n];
    const ch = state.chains[n];
    ch.xs[0] = pathX(g, k, t);
    ch.ys[0] = pathY(g, k, t);
    followChain(ch);
    const s = ch.s;
    const dim = 1 - state.night * 0.45;
    // Shadow on the bed first, then the body, head last.
    ctx.fillStyle = 'rgba(8,24,30,0.22)';
    for (let i = SEGS - 1; i >= 0; i--) {
      ctx.beginPath();
      ctx.arc(ch.xs[i] + s * 0.5, ch.ys[i] + s * 0.9, s * PROFILE[i] * 1.05, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = dim;
    for (let i = SEGS - 1; i >= 0; i--) {
      const j = i > 0 ? i - 1 : 0;
      const dx = ch.xs[i] - ch.xs[j];
      const dy = ch.ys[i] - ch.ys[j];
      const len = Math.hypot(dx, dy) || 1;
      const sway = Math.sin(t * 3.2 - i * 0.8 + n) * s * 0.35 * (i / SEGS);
      const px = ch.xs[i] - (dy / len) * sway;
      const py = ch.ys[i] + (dx / len) * sway;
      ctx.fillStyle = (i === 2 || i === 3 || i === 6) ? k.patch : k.body;
      ctx.beginPath();
      ctx.arc(px, py, s * PROFILE[i], 0, 6.3);
      ctx.fill();
      if (i === SEGS - 1) {
        // Tail fan.
        ctx.fillStyle = k.body;
        ctx.globalAlpha = dim * 0.7;
        const ex = ch.xs[i] + (dx / len) * s * 0.9;
        const ey = ch.ys[i] + (dy / len) * s * 0.9;
        ctx.beginPath();
        ctx.arc(ex - (dy / len) * s * 0.6, ey + (dx / len) * s * 0.6, s * 0.6, 0, 6.3);
        ctx.arc(ex + (dy / len) * s * 0.6, ey - (dx / len) * s * 0.6, s * 0.6, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = dim;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- motion ------------------------------------------------------------

  function drawReflection(ctx, g, t) {
    const r = state.refl;
    const y0 = Math.round(g.H * BANK);
    const band = 2;
    for (let sy = 0; sy < r.height; sy += band) {
      const wob = Math.sin(t * 1.4 + sy * 0.6) * g.U * 0.35 * (0.4 + sy / r.height);
      ctx.drawImage(r, 0, sy, r.width, band, wob, y0 + sy, r.width, band);
    }
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    for (let i = 0; i < 14; i++) {
      const a = Math.sin(t * 0.7 + i * 2.3);
      if (a < 0.2) continue;
      ctx.globalAlpha = (a - 0.2) * 0.45 * (1 - state.night * 0.6);
      const gx = g.W * ((i * 0.137 + 0.05) % 1);
      const gy = g.H * (0.56 + ((i * 0.071) % 0.42));
      ctx.fillRect(gx + Math.sin(t * 0.3 + i) * g.U, gy, g.U * (1.2 + (i % 3) * 0.6), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t) {
    const sz = Math.max(2, g.U * 0.7);
    for (let i = 0; i < LEAVES.length; i++) {
      const l = LEAVES[i];
      const px = ((l.x + t * l.v) % 1.1) * g.W - g.W * 0.05;
      const py = g.H * l.y + Math.sin(t * 0.8 + i * 1.9) * g.U * 0.4;
      ctx.fillStyle = l.c;
      ctx.globalAlpha = 0.9 - state.night * 0.4;
      ctx.fillRect(px, py, sz, Math.max(1, sz * 0.6));
      ctx.fillRect(px + sz * 0.3, py - 1, Math.max(1, sz * 0.5), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    makeChains(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.water, 0, 0, g.W, g.H, 0, 0, g.W, g.H);
    drawReflection(ctx, g, t);
    drawGlints(ctx, g, t);
    const count = Math.min(MAX_KOI, Math.round(props.koi));
    for (let n = 0; n < count; n++) drawKoi(ctx, g, t, n);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', koi: 5, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
