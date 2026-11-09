/*
 * 稲穂 Inaho — golden rice at harvest, sheaves drying on wooden hasa racks.
 *
 * Sky, hills, the far paddies and the racks are baked into layers and repainted
 * once a minute from the clock. The near rice is one baked layer drawn in thin
 * upright strips, each leaned by a travelling wind wave, so the ears bow and
 * rise in rolling gusts. A soft bright band sweeps the far field, and a few red
 * dragonflies drift above the stalks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.4;
  const NEAR_TOP = 0.7;
  const STRIPS = 40;
  const RETINT_SECONDS = 60;
  const DRAGONFLIES = 5;
  const GUSTS = 2;
  const NIGHT_INK = parseColor('#141a2c');
  const RICE = { deep: '#8e6a2a', mid: '#b88c3a', lit: '#d8b057', pale: '#e6c878' };
  const STRAW = { body: '#d6b466', shade: '#8a6630', tie: '#3e3020', top: '#ecd89a' };
  const WOOD = '#4a3826';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  // A colour as the current sky lights it: tinted by the ambient light, sunk toward ink at night.
  function lit(sky, color, keep = 0.55) {
    const c = rgb(color).map((v, i) => v * lerp(1, sky.amb[i] / 255, keep));
    return mixColor(c, NIGHT_INK, sky.night * 0.62);
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 2);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintOrb(ctx, g, sky);
  }

  function paintOrb(ctx, g, sky) {
    const day = sky.night < 0.5;
    const t = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const ox = g.W * lerp(0.92, 0.08, t);
    const oy = g.H * (0.34 - Math.sin(t * Math.PI) * 0.24);
    const r = g.U * (day ? 3.6 : 3);
    ctx.fillStyle = day ? hex(mixColor(rgb('#f4e2b0'), sky.low, 0.25)) : '#e8e4d4';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ridgeY(g, x, base, height, freq, seed) {
    return g.H * base - g.H * height * fbm(x * freq, 1.5, 4, seed);
  }

  function paintHills(ctx, g, sky) {
    const far = mixColor(sky.haze, rgb('#3e4e72'), 0.45);
    const near = lit(sky, '#4c5e3e', 0.5);
    const bands = [
      { color: far, base: HORIZON + 0.04, height: 0.26, freq: 0.01, seed: 3 },
      { color: mixColor(far, near, 0.6), base: HORIZON + 0.03, height: 0.15, freq: 0.018, seed: 8 },
    ];
    for (const b of bands) {
      ctx.fillStyle = hex(b.color);
      ctx.beginPath();
      ctx.moveTo(0, g.H * (HORIZON + 0.02));
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, b.base, b.height, b.freq, b.seed));
      ctx.lineTo(g.W, g.H * (HORIZON + 0.02));
      ctx.closePath();
      ctx.fill();
    }
    paintGrove(ctx, g, sky);
  }

  // A clump of trees and a small farmhouse roof at the field's far edge.
  function paintGrove(ctx, g, sky) {
    const rand = K.rng(17);
    ctx.fillStyle = hex(lit(sky, '#2f4430', 0.5));
    for (let i = 0; i < 26; i++) {
      const x = g.W * (0.72 + rand() * 0.16);
      const y = g.H * (HORIZON + 0.005) - rand() * g.U * 3;
      ctx.beginPath();
      ctx.arc(x, y, g.U * (1.2 + rand() * 1.6), 0, TAU);
      ctx.fill();
    }
    const rx = g.W * 0.8;
    const ry = g.H * (HORIZON + 0.012);
    ctx.fillStyle = hex(lit(sky, '#6a5236', 0.5));
    ctx.beginPath();
    ctx.moveTo(rx - g.U * 4.5, ry);
    ctx.lineTo(rx - g.U * 2, ry - g.U * 3.2);
    ctx.lineTo(rx + g.U * 2, ry - g.U * 3.2);
    ctx.lineTo(rx + g.U * 4.5, ry);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(lit(sky, '#d8cfb4', 0.5));
    ctx.fillRect(rx - g.U * 3.5, ry, g.U * 7, g.U * 1.6);
  }

  // ---- far paddies -------------------------------------------------------

  function paintField(ctx, g, sky, rand) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(lit(sky, RICE.mid), sky.haze, 0.35)));
    grad.addColorStop(0.5, hex(lit(sky, RICE.lit)));
    grad.addColorStop(1, hex(lit(sky, RICE.mid)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Levees between paddies, closer together toward the horizon.
    ctx.fillStyle = hex(lit(sky, '#5e5a34', 0.5));
    for (let k = 1; k < 9; k++) {
      const f = Math.pow(k / 9, 1.8);
      const y = top + (g.H - top) * f;
      const tilt = (k % 2 ? 1 : -1) * g.U * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, y - tilt);
      ctx.lineTo(g.W, y + tilt);
      ctx.lineTo(g.W, y + tilt + Math.max(1, f * g.U * 0.9));
      ctx.lineTo(0, y - tilt + Math.max(1, f * g.U * 0.9));
      ctx.closePath();
      ctx.fill();
    }
    const tones = [RICE.deep, RICE.pale, RICE.mid].map((c) => hex(lit(sky, c)));
    for (let i = 0; i < g.W * g.H * 0.08; i++) {
      const f = rand();
      const y = top + (g.H - top) * f;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.globalAlpha = 0.25 + f * 0.4;
      ctx.fillRect(rand() * g.W, y, Math.max(1, f * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- hasa racks --------------------------------------------------------

  // One rack: posts crossed at the top, two beams, each hung with a wall of drying sheaves.
  function paintRack(ctx, g, sky, rand, r) {
    const wood = hex(lit(sky, WOOD, 0.4));
    const x0 = g.W * r.x0;
    const x1 = g.W * r.x1;
    const base0 = g.H * r.base0;
    const base1 = g.H * r.base1;
    const h0 = g.H * r.h;
    const h1 = h0 * r.shrink;
    const baseAt = (x) => lerp(base0, base1, (x - x0) / (x1 - x0));
    const hAt = (x) => lerp(h0, h1, (x - x0) / (x1 - x0));
    const postW = Math.max(1, g.U * 0.9 * r.scale);
    ctx.fillStyle = hex(lit(sky, '#5a4a26', 0.5));
    for (let x = x0; x < x1; x += 1) ctx.fillRect(x, baseAt(x), 1, Math.max(1, hAt(x) * 0.08));
    ctx.strokeStyle = wood;
    ctx.lineWidth = postW;
    for (let k = 0; k <= r.posts; k++) {
      const px = lerp(x0, x1, k / r.posts);
      const top = baseAt(px) - hAt(px) * 1.25;
      const lean = hAt(px) * 0.12;
      ctx.beginPath();
      ctx.moveTo(px - lean, baseAt(px));
      ctx.lineTo(px + lean * 0.4, top);
      ctx.moveTo(px + lean, baseAt(px));
      ctx.lineTo(px - lean * 0.4, top);
      ctx.stroke();
    }
    paintFringe(ctx, g, sky, rand, { x0, x1, baseAt, hAt, lift: 1, scale: r.scale });
    paintFringe(ctx, g, sky, rand, { x0, x1, baseAt, hAt, lift: 0.52, scale: r.scale });
  }

  function paintFringe(ctx, g, sky, rand, f) {
    const body = lit(sky, STRAW.body);
    const shade = lit(sky, STRAW.shade);
    const top = lit(sky, STRAW.top);
    const step = Math.max(1, g.U * 0.7 * f.scale);
    for (let x = f.x0; x < f.x1; x += step) {
      const beam = f.baseAt(x) - f.hAt(x) * f.lift;
      const len = f.hAt(x) * (0.36 + rand() * 0.06);
      ctx.fillStyle = hex(lit(sky, '#3a3020', 0.4));
      ctx.fillRect(x, beam + len, step, Math.max(1, len * 0.12));
      ctx.fillStyle = hex(mixColor(body, top, rand() * 0.6));
      ctx.fillRect(x, beam, step, len);
      ctx.fillStyle = hex(shade);
      ctx.fillRect(x, beam + len * 0.55, step, len * 0.45);
      ctx.fillStyle = hex(mixColor(shade, body, 0.5));
      ctx.fillRect(x + step * 0.5, beam + len * 0.55, Math.max(1, step * 0.4), len * (0.3 + rand() * 0.25));
    }
    ctx.fillStyle = hex(lit(sky, STRAW.tie, 0.4));
    for (let x = f.x0; x < f.x1; x += 1) ctx.fillRect(x, f.baseAt(x) - f.hAt(x) * f.lift - 1, 1, Math.max(1, g.U * 0.6 * f.scale));
  }

  const RACKS = [
    { x0: 0.62, x1: 0.96, base0: 0.53, base1: 0.5, h: 0.09, shrink: 0.75, posts: 6, scale: 0.6 },
    { x0: 0.03, x1: 0.56, base0: 0.76, base1: 0.62, h: 0.24, shrink: 0.55, posts: 7, scale: 1 },
  ];

  // ---- near rice ---------------------------------------------------------

  function paintStalk(ctx, g, rand, tones, x, base) {
    const h = g.H * (0.1 + rand() * 0.09);
    const lean = (rand() - 0.3) * g.U * 2;
    const tipX = x + lean;
    const tipY = base - h;
    ctx.strokeStyle = tones.stem[Math.floor(rand() * tones.stem.length)];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x, base - h * 0.6, tipX, tipY);
    ctx.stroke();
    // The heavy ear arcs over and hangs down from the tip.
    const dir = rand() < 0.7 ? 1 : -1;
    const ear = g.U * (3.5 + rand() * 2.5);
    const grain = Math.max(1, g.U * 1.1);
    ctx.fillStyle = tones.ear[Math.floor(rand() * tones.ear.length)];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI * 0.8;
      const ex = tipX + dir * Math.sin(a) * ear * 0.6;
      const ey = tipY - Math.cos(a) * ear * 0.25 + (k / 10) * ear * 0.75;
      ctx.fillRect(ex, ey, grain, grain);
    }
  }

  function paintNear(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(41);
    const top = g.H * NEAR_TOP;
    const grad = ctx.createLinearGradient(0, top + g.H * 0.12, 0, g.H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, hex(lit(sky, '#8a6c30')));
    grad.addColorStop(1, hex(lit(sky, '#4e4424')));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top + g.H * 0.12, g.W, g.H);
    const tones = {
      stem: ['#9a8640', '#a8903e', '#7e7436', '#b89a48'].map((c) => hex(lit(sky, c))),
      ear: [RICE.mid, RICE.lit, RICE.pale, RICE.lit, '#c89a40'].map((c) => hex(lit(sky, c))),
    };
    const count = Math.floor(g.W * 1.5);
    for (let i = 0; i < count; i++) {
      const base = g.H * (1.0 + rand() * 0.06);
      paintStalk(ctx, g, rand, tones, rand() * g.W, base);
    }
    return c;
  }

  // ---- moving pieces -----------------------------------------------------

  function paintGust(g) {
    const w = Math.ceil(g.W * 0.35);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, 'rgba(244,228,170,0.55)');
    grad.addColorStop(1, 'rgba(244,228,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-w / 2, -w / 2, w, w);
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 29);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(23);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, sky, rand);
    paintHills(bctx, g, sky);
    paintField(bctx, g, sky, rand);
    const mid = layer(g.W, g.H);
    const mctx = mid.getContext('2d');
    for (const r of RACKS) paintRack(mctx, g, sky, K.rng(7), r);
    state.back = back;
    state.mid = mid;
    state.near = paintNear(g, sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = 0.7 - state.night * 0.5;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawGusts(ctx, g, t, wind) {
    if (wind <= 0) return;
    const art = state.gust;
    const span = g.W + art.width;
    for (let i = 0; i < GUSTS; i++) {
      const p = ((t * 0.035 * (0.6 + wind * 0.4) + i / GUSTS) % 1);
      const gx = -art.width + p * span;
      const gy = g.H * (0.46 + i * 0.12) - art.height / 2;
      ctx.globalAlpha = Math.min(1, 0.5 * wind) * (1 - state.night * 0.7) * Math.sin(p * Math.PI);
      ctx.drawImage(art, gx, gy);
    }
    ctx.globalAlpha = 1;
  }

  // Lean of the near rice at column x: a slow swell plus quicker gusts rolling left to right.
  function sway(g, x, t, wind) {
    const a = Math.sin(t * 0.9 - x * 0.018) * 0.6 + Math.sin(t * 2.1 - x * 0.05 + 1.3) * 0.25;
    return (0.03 + a * 0.06) * wind;
  }

  function drawNear(ctx, g, t, wind) {
    const sw = Math.ceil(g.W / STRIPS);
    for (let i = 0; i < STRIPS; i++) {
      const x = i * sw;
      const k = sway(g, x + sw / 2, t, wind);
      ctx.setTransform(1, 0, -k, 1, k * g.H, 0);
      ctx.drawImage(state.near, x, 0, sw + 1, g.H, x, 0, sw + 1, g.H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawDragonflies(ctx, g, t) {
    const s = Math.max(1, g.U * 0.6);
    ctx.globalAlpha = 1 - state.night * 0.6;
    for (let i = 0; i < DRAGONFLIES; i++) {
      const phase = i * 1.9;
      const dx = g.W * (0.15 + 0.17 * i) + Math.sin(t * 0.21 + phase) * g.W * 0.08 + Math.sin(t * 1.3 + phase * 2) * g.U * 2;
      const dy = g.H * (0.58 + (i % 3) * 0.06) + Math.sin(t * 0.37 + phase) * g.H * 0.05 + Math.sin(t * 2.3 + phase) * g.U;
      ctx.fillStyle = '#c8452c';
      ctx.fillRect(dx - s * 2, dy, s * 4, s);
      ctx.fillStyle = '#e8e2d0';
      const flap = Math.sin(t * 18 + phase) > 0 ? 1 : 0;
      ctx.fillRect(dx - s * 0.5, dy - s * (1 + flap), s * 2, s);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    state.gust = paintGust(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const wind = clamp(props.wind, 0, 2);
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawGusts(ctx, g, t, wind);
    ctx.drawImage(state.mid, 0, 0);
    if (props.dragonflies) drawDragonflies(ctx, g, t);
    drawNear(ctx, g, t, wind);
  }

  Kasuri.run({
    defaults: { time: 'auto', wind: 1, dragonflies: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
