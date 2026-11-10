/*
 * 水月 Shuiyue — a full moon doubled in dark water.
 *
 * A humpback stone bridge and a small pavilion stand on the far bank, willow
 * hangs from both corners. Sky, bank and moon are baked once and mirrored into
 * the water; the clock retints them once a minute. Between repaints only the
 * water rows, the willow, a thin cloud, a few rings and one petal move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WATER = 0.56;
  const MOON = { x: 0.5, y: 0.25, r: 0.115 };
  const RETINT_SECONDS = 60;
  const RIPPLES = [
    { x: 0.34, y: 0.72, sx: 1, phase: 0.0 },
    { x: 0.62, y: 0.8, sx: 1.3, phase: 0.31 },
    { x: 0.5, y: 0.66, sx: 0.9, phase: 0.58 },
    { x: 0.76, y: 0.68, sx: 1.1, phase: 0.83 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- back: sky, moon, hills, bridge, pavilion ---------------------------

  function paintSky(ctx, g, sky, rand) {
    const horizon = g.H * WATER;
    // Keep the sky a deep ink-indigo by day too so the moon always reads.
    const wash = 0.5 * (1 - sky.night);
    const ink = rgb('#1a2140');
    const top = mixColor(sky.top, ink, 0.45 + wash * 0.4);
    const low = mixColor(sky.low, rgb('#33456e'), 0.4 + wash * 0.4);
    const grad = ctx.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, horizon + 1);
    ctx.fillStyle = '#ece6d2';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = (0.1 + sky.night * 0.4) * (0.3 + rand() * 0.7);
      ctx.fillRect(rand() * g.W, rand() * horizon * 0.7, 1, 1);
    }
    ctx.globalAlpha = 1;
    state.low = low;
  }

  function paintMoon(ctx, g, sky) {
    const cx = g.W * MOON.x;
    const cy = g.H * MOON.y;
    const r = g.H * MOON.r;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.4);
    glow.addColorStop(0, `rgba(236,230,205,${0.3 + sky.night * 0.15})`);
    glow.addColorStop(1, 'rgba(236,230,205,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 3.5, cy - r * 3.5, r * 7, r * 7);
    ctx.fillStyle = '#efe9d4';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    // A few soft grey plains on the face.
    ctx.fillStyle = '#c9c3ab';
    const maria = [[-0.35, -0.2, 0.3], [0.2, -0.35, 0.2], [0.05, 0.15, 0.28], [-0.25, 0.4, 0.16], [0.4, 0.2, 0.15]];
    for (const m of maria) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(cx + m[0] * r, cy + m[1] * r, m[2] * r, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function ridgeY(g, x, base, height, seed) {
    return base - height * (0.35 + 0.65 * fbm(x * 0.012, seed, 4, seed + 3));
  }

  function paintHills(ctx, g, sky) {
    const horizon = g.H * WATER;
    const far = mixColor(rgb('#58698f'), sky.haze, 0.25);
    const near = mixColor(rgb('#2c3a5e'), sky.haze, 0.15);
    const layers = [
      { col: far, base: horizon, h: g.H * 0.16, seed: 4 },
      { col: near, base: horizon, h: g.H * 0.09, seed: 11 },
    ];
    for (const l of layers) {
      ctx.fillStyle = hex(l.col);
      ctx.beginPath();
      ctx.moveTo(0, horizon + 1);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, l.base, l.h, l.seed));
      ctx.lineTo(g.W, horizon + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Humpback stone bridge: one round arch that completes its circle in the water.
  function paintBridge(ctx, g, sky) {
    const horizon = g.H * WATER;
    const cx = g.W * 0.33;
    const span = g.W * 0.3;
    const rise = g.H * 0.075;
    const stone = mixColor(rgb('#27304d'), sky.haze, 0.1);
    const dark = mixColor(rgb('#161c33'), sky.haze, 0.05);
    ctx.fillStyle = hex(stone);
    ctx.beginPath();
    ctx.moveTo(cx - span * 0.62, horizon);
    ctx.lineTo(cx - span * 0.62, horizon - rise * 0.55);
    ctx.quadraticCurveTo(cx - span * 0.4, horizon - rise * 1.5, cx, horizon - rise * 1.7);
    ctx.quadraticCurveTo(cx + span * 0.4, horizon - rise * 1.5, cx + span * 0.62, horizon - rise * 0.55);
    ctx.lineTo(cx + span * 0.62, horizon);
    ctx.closePath();
    ctx.fill();
    // Parapet line along the deck.
    ctx.strokeStyle = hex(dark);
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - span * 0.62, horizon - rise * 0.55);
    ctx.quadraticCurveTo(cx - span * 0.4, horizon - rise * 1.5 - g.U, cx, horizon - rise * 1.7 - g.U);
    ctx.quadraticCurveTo(cx + span * 0.4, horizon - rise * 1.5 - g.U, cx + span * 0.62, horizon - rise * 0.55);
    ctx.stroke();
    ctx.fillStyle = hex(dark);
    for (let k = -4; k <= 4; k++) {
      const f = k / 4;
      const px = cx + f * span * 0.55;
      const py = horizon - rise * 1.3 * (1 - f * f) * 0.95 - g.U * 1.6;
      ctx.fillRect(px, py, 1, g.U * 1.6);
    }
    // Arch opening, a half circle seen against the far hills.
    ctx.fillStyle = hex(mixColor(rgb('#5a6b92'), sky.haze, 0.3));
    ctx.beginPath();
    ctx.ellipse(cx, horizon, span * 0.17, rise * 0.95, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(mixColor(stone, rgb('#9a9a92'), 0.45));
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, horizon, span * 0.17 + g.U * 0.5, rise * 0.95 + g.U * 0.5, 0, Math.PI, 0);
    ctx.stroke();
  }

  // A small square pavilion with a hip roof and upturned eaves.
  function paintPavilion(ctx, g, sky) {
    const horizon = g.H * WATER;
    const cx = g.W * 0.72;
    const u = g.U;
    const base = horizon - g.H * 0.045;
    const ink = mixColor(rgb('#161c33'), sky.haze, 0.08);
    const post = mixColor(rgb('#7d3a30'), rgb('#2a2433'), 0.35);
    // Rise of land under it.
    ctx.fillStyle = hex(ink);
    ctx.beginPath();
    ctx.ellipse(cx, horizon, g.W * 0.12, g.H * 0.05, 0, Math.PI, 0);
    ctx.fill();
    // Platform and four posts.
    ctx.fillStyle = hex(mixColor(rgb('#59607a'), sky.haze, 0.2));
    ctx.fillRect(cx - u * 7, base, u * 14, u * 1.2);
    ctx.fillStyle = hex(post);
    for (const dx of [-6, -2, 2, 6]) ctx.fillRect(cx + u * dx - u * 0.35, base - u * 6.5, Math.max(1, u * 0.7), u * 6.5);
    ctx.fillStyle = hex(mixColor(post, rgb('#d8cfae'), 0.15));
    ctx.fillRect(cx - u * 6.4, base - u * 6.5, u * 12.8, Math.max(1, u * 0.7));
    // Roof: a curved eave sweeping up at both ends, a ridge on top.
    const ry = base - u * 6.5;
    ctx.fillStyle = hex(ink);
    ctx.beginPath();
    ctx.moveTo(cx - u * 11.5, ry - u * 2.8);
    ctx.quadraticCurveTo(cx - u * 8, ry + u * 0.4, cx - u * 4, ry - u * 1.4);
    ctx.lineTo(cx - u * 2.2, ry - u * 4.2);
    ctx.lineTo(cx + u * 2.2, ry - u * 4.2);
    ctx.lineTo(cx + u * 4, ry - u * 1.4);
    ctx.quadraticCurveTo(cx + u * 8, ry + u * 0.4, cx + u * 11.5, ry - u * 2.8);
    ctx.quadraticCurveTo(cx + u * 8, ry - u * 3.4, cx + u * 3, ry - u * 5.2);
    ctx.lineTo(cx - u * 3, ry - u * 5.2);
    ctx.quadraticCurveTo(cx - u * 8, ry - u * 3.4, cx - u * 11.5, ry - u * 2.8);
    ctx.fill();
    ctx.fillRect(cx - u * 0.5, ry - u * 7.2, Math.max(1, u), u * 2.2);
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintMoon(ctx, g, sky);
    paintHills(ctx, g, sky);
    paintBridge(ctx, g, sky);
    paintPavilion(ctx, g, sky);
    return c;
  }

  // ---- water: the back layer mirrored, darkened, streaked -----------------

  function paintWater(g, back, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const horizon = Math.floor(g.H * WATER);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, g.W, g.H - horizon);
    ctx.clip();
    ctx.translate(0, horizon * 2);
    ctx.scale(1, -1);
    ctx.drawImage(back, 0, 0);
    ctx.restore();
    const tint = ctx.createLinearGradient(0, horizon, 0, g.H);
    tint.addColorStop(0, 'rgba(18,28,52,0.4)');
    tint.addColorStop(1, 'rgba(10,16,34,0.72)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, horizon, g.W, g.H - horizon);
    // Faint long streaks of the surface.
    ctx.fillStyle = '#dcd6bf';
    for (let i = 0; i < g.W * 0.5; i++) {
      const y = horizon + 2 + rand() * (g.H - horizon - 2);
      ctx.globalAlpha = 0.05 + rand() * 0.07;
      ctx.fillRect(rand() * g.W, y, g.U * (1.5 + rand() * 4), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- willow: branches fall from the top corners -------------------------

  function strand(ctx, g, x0, y0, len, rand, col) {
    const sway = (rand() - 0.5) * g.U * 3;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + sway, y0 + len * 0.55, x0 + sway * 0.4, y0 + len);
    ctx.stroke();
    // Tiny leaves along the lower half.
    ctx.fillStyle = col;
    for (let k = 0.35; k < 1; k += 0.13) ctx.fillRect(x0 + sway * k * 0.6 + (rand() - 0.5) * 2, y0 + len * k, 1, 2);
  }

  function bough(ctx, g, x0, y0, x1, y1, rand, cols) {
    ctx.strokeStyle = cols.wood;
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - g.U * 2, x1, y1);
    ctx.stroke();
    const n = Math.round(Math.abs(x1 - x0) / 1.6);
    for (let i = 0; i < n; i++) {
      const t = (i + rand()) / n;
      const px = lerp(x0, x1, t);
      const py = lerp(y0, y1, t) - Math.sin(t * Math.PI) * g.U * 1.6;
      const len = g.H * (0.14 + rand() * 0.34) * (0.5 + 0.5 * t);
      strand(ctx, g, px, py, len, rand, rand() < 0.3 ? cols.light : cols.leaf);
    }
  }

  function paintWillow(g, sky, rand) {
    const c = layer(g.W, g.H * 0.72);
    const ctx = c.getContext('2d');
    const dim = 1 - sky.night * 0.35;
    const cols = {
      wood: hex(mixColor(rgb('#2a2a26'), rgb('#101420'), 0.4)),
      leaf: hex(mixColor(rgb('#3f5a3a'), rgb('#141c24'), 1 - dim + 0.25)),
      light: hex(mixColor(rgb('#6f8a52'), rgb('#1c2430'), 1 - dim + 0.2)),
    };
    bough(ctx, g, -2, g.H * 0.04, g.W * 0.2, g.H * 0.05, rand, cols);
    bough(ctx, g, -2, g.H * 0.0, g.W * 0.12, g.H * 0.1, rand, cols);
    bough(ctx, g, g.W + 2, g.H * 0.02, g.W * 0.8, g.H * 0.06, rand, cols);
    bough(ctx, g, g.W + 2, g.H * 0.08, g.W * 0.9, g.H * 0.13, rand, cols);
    return c;
  }

  function paintCloud(g) {
    const w = Math.ceil(g.W * 0.5);
    const h = Math.ceil(g.H * 0.07);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = fbm(x * 0.05, y * 0.16, 3, 17);
        const edge = Math.sin((x / w) * Math.PI);
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 160;
        img.data[i + 2] = 190;
        img.data[i + 3] = smoothstep(0.45, 0.75, v) * band * edge * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake ---------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(52);
    state.back = paintBack(g, sky, rand);
    state.water = paintWater(g, state.back, sky, rand);
    state.willow = paintWillow(g, sky, K.rng(8));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion -------------------------------------------------------------

  // Water rows two at a time, each nudged sideways; the moon column breaks up.
  function drawWater(ctx, g, t) {
    const horizon = Math.floor(g.H * WATER);
    for (let y = horizon; y < g.H; y += 2) {
      const d = (y - horizon) / (g.H - horizon);
      const dx = Math.sin(t * 1.1 + y * 0.8) * g.U * (0.12 + d * 0.35);
      ctx.drawImage(state.water, 0, y, g.W, 2, dx, y, g.W, 2);
    }
  }

  function drawGlints(ctx, g, t) {
    const horizon = g.H * WATER;
    const cx = g.W * MOON.x;
    ctx.fillStyle = '#efe9d4';
    for (let i = 0; i < 9; i++) {
      const d = (i + 0.5) / 9;
      const y = horizon + d * (g.H - horizon) * 0.95;
      const wob = Math.sin(t * 0.7 + i * 2.1);
      ctx.globalAlpha = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.7));
      ctx.fillRect(cx + wob * g.U * 3 - g.U * (2 + d * 5), y, g.U * (4 + d * 10), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawCloud(ctx, g, t) {
    const c = state.cloud;
    const span = g.W + c.width;
    const x = ((t * g.U * 0.7) % span) - c.width;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(c, x, g.H * 0.2);
    ctx.drawImage(c, (x + span * 0.55) % span - c.width, g.H * 0.12);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t, amount) {
    if (amount <= 0) return;
    const horizon = g.H * WATER;
    ctx.strokeStyle = '#e4dec6';
    ctx.lineWidth = 1;
    for (const r of RIPPLES) {
      const a = (t / 11 + r.phase) % 1;
      const rad = g.U * (1 + a * 13) * r.sx;
      ctx.globalAlpha = Math.min(1, amount) * (1 - a) * (1 - a) * 0.5;
      ctx.beginPath();
      ctx.ellipse(g.W * r.x, lerp(horizon, g.H, (r.y - WATER) / (1 - WATER)), rad, rad * 0.26, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // One peach blossom petal crossing slowly with a little turn.
  function drawPetal(ctx, g, t) {
    const a = (t / 70) % 1;
    const fade = smoothstep(0, 0.06, a) * (1 - smoothstep(0.94, 1, a));
    const x = lerp(g.W * 0.12, g.W * 0.9, a) + Math.sin(t * 0.5) * g.U;
    const y = g.H * (0.78 + 0.05 * Math.sin(t * 0.21)) + Math.sin(t * 0.9) * g.U * 0.2;
    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = '#e6c4b4';
    ctx.beginPath();
    ctx.ellipse(x, y, g.U * 1.1, g.U * 0.55, Math.sin(t * 0.4) * 0.6, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c4564a';
    ctx.globalAlpha = fade * 0.5;
    ctx.fillRect(x - g.U * 0.2, y - 0.5, Math.max(1, g.U * 0.4), 1);
    ctx.globalAlpha = 1;
  }

  // Willow rows shift more the lower they hang.
  function drawWillow(ctx, g, t) {
    const w = state.willow;
    for (let y = 0; y < w.height; y += 2) {
      const k = y / w.height;
      const dx = Math.sin(t * 0.8 + y * 0.09) * g.U * 0.9 * k * k + Math.sin(t * 0.37) * g.U * 0.4 * k;
      ctx.drawImage(w, 0, y, w.width, 2, dx, y, w.width, 2);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloud = paintCloud(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawCloud(ctx, g, t);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    drawRipples(ctx, g, t, props.ripples);
    if (props.petal) drawPetal(ctx, g, t);
    drawWillow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', ripples: 1, petal: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
