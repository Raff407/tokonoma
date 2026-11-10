/*
 * 雪の大谷 Yuki no Otani — a mountain road cut between walls of spring snow.
 *
 * Sky with the far ridge and the whole corridor (two sheer snow walls with
 * strata, grey asphalt with lines) are baked once. Per frame: clouds slide in
 * the strip of sky, a soft band of sun breathes on the lit wall, a bus drives
 * slowly away up the road, and a short pool of flakes drifts down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const MAX_FLAKES = 110;
  const FLAKES = 50;
  const BUS_TRIP = 46; // seconds for one bus to drive away
  const SKY = ['#7d9fc6', '#95b3d2', '#b0c8dc', '#ccdae3', '#e2e7e6'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function mix(a, b, t) {
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const vy = H * 0.56;
    // rw: road half-width on the bottom row, hw: wall height per unit depth
    return { W, H, U: H / 100, cx: W * 0.5, vy, rw: W * 0.2, hw: H * 0.62 };
  }

  // ---- sky and ridge -------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.vy + 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.vy);
    SKY.forEach((ink, i) => grad.addColorStop(i / (SKY.length - 1), ink));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    paintRidge(ctx, g);
    return c;
  }

  function ridgeY(g, x) {
    const peak = Math.exp(-(((x - g.W * 0.46) / (g.W * 0.1)) ** 2)) * g.H * 0.2;
    const peak2 = Math.exp(-(((x - g.W * 0.57) / (g.W * 0.07)) ** 2)) * g.H * 0.13;
    return g.vy - g.H * 0.03 - peak - peak2 + (fbm(x / (g.U * 6), 2.2, 4, 7) - 0.5) * g.H * 0.04;
  }

  function paintRidge(ctx, g) {
    ctx.fillStyle = '#7b8ea9';
    ctx.beginPath();
    ctx.moveTo(0, g.vy + 2);
    for (let x = 0; x <= g.W + 2; x += 1) ctx.lineTo(x, ridgeY(g, x));
    ctx.lineTo(g.W, g.vy + 2);
    ctx.fill();
    // snowfields with rock gullies
    ctx.fillStyle = '#e9ebe6';
    for (let x = 0; x < g.W; x++) {
      const y = ridgeY(g, x);
      const gully = fbm(x / (g.U * 1.6), 0.5, 2, 5);
      ctx.fillRect(x, y, 1, (g.vy - y) * (0.55 + gully * 0.5));
    }
    const grad = ctx.createLinearGradient(0, g.vy - g.H * 0.14, 0, g.vy + 2);
    grad.addColorStop(0, 'rgba(214,222,226,0)');
    grad.addColorStop(0.7, 'rgba(214,222,226,0.9)');
    grad.addColorStop(1, 'rgba(214,222,226,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.vy - g.H * 0.14, g.W, g.H * 0.14 + 2);
  }

  // ---- corridor ------------------------------------------------------------

  const INK = {
    lit: '#f2ede1', litBand: '#c9bea8', litLow: '#ded5c3',
    shade: '#c3cedb', shadeBand: '#93a2b8', shadeLow: '#aebccd',
    lip: '#fbf9f2', haze: '#d6dee3',
    road: '#7a7d83', roadDark: '#5f636b', line: '#efece4', slush: '#dcdcd6',
  };

  function wallTopJitter(g, z, side) {
    return (fbm(z * 1.3, side * 4.1, 3, 17) - 0.5);
  }

  function wallColor(g, P, x, y, side, s) {
    const z = 1 / s;
    const ybot = g.vy + s * (g.H - g.vy);
    const ytop = g.vy - s * g.hw * (1 + wallTopJitter(g, z, side) * 0.08);
    if (y < ytop) return null;
    const h = (ybot - y) / (ybot - ytop);
    const lit = side < 0;
    const warp = fbm(z * 0.8, h * 2, 2, side > 0 ? 9 : 4);
    // soft horizontal strata, converging to the far end like real layers
    const band = Math.sin(h * 46 + warp * 6);
    const fine = Math.sin(h * 130 + warp * 9);
    let col = mix(lit ? P.litLow : P.shadeLow, lit ? P.lit : P.shade, 0.35 + h * 0.9);
    if (band > 0.9) col = mix(col, lit ? P.litBand : P.shadeBand, 0.45);
    else if (fine > 0.94) col = mix(col, lit ? P.litBand : P.shadeBand, 0.2);
    // faint vertical scoops left by the rotary plough
    const scoop = Math.sin(z * 9 + h * 1.5);
    col = mix(col, lit ? P.litLow : P.shadeBand, Math.max(0, scoop - 0.6) * 0.25);
    // overhanging lip: bright rim with a thin shadow under it
    if (h > 0.965) col = mix(col, P.lip, 0.85);
    else if (h > 0.92) col = mix(col, lit ? P.litBand : P.shadeBand, 0.35 * (h - 0.92) / 0.045);
    // dirty snow bank at the foot
    if (h < 0.04) col = mix(col, lit ? P.litBand : P.shadeBand, 0.3);
    return mix(col, P.haze, Math.max(0, 0.8 - s * 1.6));
  }

  function roadColor(g, P, x, y) {
    const sr = (y - g.vy) / (g.H - g.vy);
    const u = (x - g.cx) / (sr * g.rw);
    const au = Math.abs(u);
    const z = 1 / sr;
    const n = fbm(x / (g.U * 2), y / (g.U * 1.2), 3, 31);
    let col = mix(P.roadDark, P.road, 0.55 + (n - 0.5) * 0.6);
    // darker wheel tracks in each lane
    const lane = Math.abs(au - 0.5);
    if (lane < 0.12) col = mix(col, P.roadDark, 0.35 * (1 - lane / 0.12));
    // white edge lines and a dashed centre line
    if (au > 0.8 && au < 0.85) col = mix(col, P.line, 0.85);
    if (au < 0.025 && (z * 0.9) % 1 < 0.5) col = mix(col, P.line, 0.85);
    // a few small slush patches and the snowy shoulder
    if (n > 0.76 && au < 0.8) col = mix(col, P.slush, 0.55);
    if (au > 0.88) col = mix(col, P.slush, Math.min(1, (au - 0.88) * 9));
    return mix(col, P.haze, Math.max(0, 0.75 - sr * 2));
  }

  function paintCorridor(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const P = {};
    for (const k in INK) P[k] = K.parseColor(INK[k]);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const dx = x - g.cx;
        const side = dx < 0 ? -1 : 1;
        const s = Math.max(0.004, Math.abs(dx) / g.rw);
        const ybot = g.vy + s * (g.H - g.vy);
        const col = y > ybot ? roadColor(g, P, x, y) : wallColor(g, P, x, y, side, s);
        if (col) {
          const i = (y * g.W + x) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    paintPoles(ctx, g);
    return c;
  }

  // red and white snow poles standing in the shoulder
  function paintPoles(ctx, g) {
    for (let i = 0; i < 7; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const s = 0.14 + i * 0.13 + (side > 0 ? 0.06 : 0);
        if (s > 1) continue;
        const x = g.cx + side * s * g.rw * 0.93;
        const y = g.vy + s * (g.H - g.vy);
        const h = s * g.H * 0.16 + 1;
        const w = Math.max(1, s * g.U * 1.1);
        ctx.fillStyle = '#ece8dc';
        ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = '#c4452f';
        ctx.fillRect(x - w / 2, y - h, w, h * 0.22);
        ctx.fillRect(x - w / 2, y - h * 0.56, w, h * 0.18);
      }
    }
  }

  // ---- sun, clouds, bus, flakes -------------------------------------------

  // a soft warm wash of sun across the upper lit wall
  function paintSun(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, g.cx, g.H * 0.7);
    grad.addColorStop(0, 'rgba(240,214,150,0.32)');
    grad.addColorStop(0.6, 'rgba(240,214,150,0.12)');
    grad.addColorStop(1, 'rgba(240,214,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(g.cx - g.W * 0.03, g.vy - g.H * 0.02);
    ctx.lineTo(0, g.H * 0.95);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  function paintClouds(g, rand) {
    const w = Math.round(g.W * 1.2);
    const c = layer(w, g.vy);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * w + rand() * g.W * 0.04;
      const y = g.vy * (0.08 + rand() * 0.5);
      const rx = g.W * (0.035 + rand() * 0.04);
      ctx.fillStyle = i % 2 ? '#eef0ec' : '#e1e7ea';
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath();
        ctx.ellipse(x + j * rx * 0.55, y - (2 - Math.abs(j)) * g.U * 0.7, rx * (1 - Math.abs(j) * 0.18), g.U * (1.6 + rand() * 1.2), 0, 0, TAU);
        ctx.fill();
      }
    }
    return c;
  }

  // a sightseeing bus seen from behind, driving away in the left lane
  function drawBus(ctx, g, t) {
    const p = (t / BUS_TRIP) % 1;
    const sr = 0.95 * Math.pow(1 - p, 1.6) + 0.04;
    const fade = Math.min(1, (1 - p) * 8, p * 12);
    const x = g.cx - 0.45 * sr * g.rw;
    const y = g.vy + sr * (g.H - g.vy);
    const w = sr * g.rw * 0.62;
    const h = w * 1.05;
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#2b3140';
    ctx.fillRect(x - w * 0.42, y - h * 0.08, w * 0.2, h * 0.1);
    ctx.fillRect(x + w * 0.22, y - h * 0.08, w * 0.2, h * 0.1);
    ctx.fillStyle = '#ebe6d8';
    ctx.fillRect(x - w / 2, y - h, w, h * 0.94);
    ctx.fillStyle = '#3c4a63';
    ctx.fillRect(x - w * 0.42, y - h * 0.9, w * 0.84, h * 0.34);
    ctx.fillStyle = '#c4452f';
    ctx.fillRect(x - w / 2, y - h * 0.48, w, h * 0.1);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(x - w * 0.44, y - h * 0.28, w * 0.1, h * 0.06);
    ctx.fillRect(x + w * 0.34, y - h * 0.28, w * 0.1, h * 0.06);
    ctx.globalAlpha = 1;
  }

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), v: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES), z: new Float32Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.6 + rand() * 0.8;
      f.p[i] = rand() * TAU;
      f.z[i] = rand() < 0.3 ? 2 : 1;
    }
    return f;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.clouds = paintClouds(g, rand);
    state.corridor = paintCorridor(g);
    state.sun = paintSun(g);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { beams, snow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.sky, 0, 0);
    const cw = state.clouds.width;
    const off = (t * g.W * 0.014) % cw;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(state.clouds, -off, 0);
    ctx.drawImage(state.clouds, cw - off, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.corridor, 0, 0);
    drawBus(ctx, g, t);
    ctx.globalAlpha = Math.min(1, Math.max(0, beams * (0.6 + 0.4 * Math.sin(t * 0.21))));
    ctx.drawImage(state.sun, 0, 0);
    ctx.globalAlpha = 1;
    const F = state.flakes;
    const count = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    ctx.fillStyle = '#f7f5ee';
    for (let i = 0; i < count; i++) {
      F.y[i] += F.v[i] * g.U * 2.4 * step;
      F.x[i] += (Math.sin(t * 0.7 + F.p[i]) * 0.6 - 0.35) * g.U * step * 2;
      if (F.y[i] > g.H) { F.y[i] = -2; F.x[i] = (F.x[i] + g.W * 0.37) % g.W; }
      if (F.x[i] < 0) F.x[i] += g.W;
      ctx.fillRect(F.x[i], F.y[i], F.z[i], F.z[i]);
    }
  }

  Kasuri.run({
    defaults: { beams: 1, snow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
