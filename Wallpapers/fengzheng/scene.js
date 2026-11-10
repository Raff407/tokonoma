/*
 * 风筝 Fengzheng — paper kites with long tails over green hills.
 *
 * Sky, clouds, hills, pagoda and pines are baked once. Per frame the cloud strip
 * slides and a handful of kites are drawn: a swallow, a butterfly, a diamond and
 * a chain of discs, each with a ribbon tail that ripples and a thin string.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;

  const INK = '#2b2a2c';
  const WASHI = '#eee6d2';
  const INDIGO = '#34507a';
  const VERMILION = '#c8452c';
  const MOSS = '#5f7f4f';
  const GOLD = '#d3a948';
  const TAIL_TONES = [VERMILION, GOLD, INDIGO, WASHI];
  const SEGS = 16;
  const CHAIN = 9;
  const DISC_TONES = [VERMILION, GOLD, INDIGO, MOSS];
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100 };
  }

  // ---- baked layers --------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    gr.addColorStop(0, '#a9c0c8');
    gr.addColorStop(0.55, '#d3dcd2');
    gr.addColorStop(1, '#ece6cf');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintClouds(g, rand) {
    const w = g.W;
    const c = layer(w, g.H * 0.55);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f3eedc';
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * g.U * 6;
      const y = g.H * (0.06 + rand() * 0.34);
      const rx = g.U * (7 + rand() * 12);
      blob(ctx, x, y, rx, g.U * (0.7 + rand() * 0.8));
      blob(ctx, x + rx * 0.5, y - g.U * 0.9, rx * 0.5, g.U * 0.6);
      blob(ctx, x - rx * 0.6, y + g.U * 0.7, rx * 0.45, g.U * 0.5);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function ridge(ctx, g, base, amp, scale, seed, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, base + (fbm(x / (g.U * scale), seed, 4, seed * 7) - 0.5) * amp);
    }
    ctx.lineTo(g.W + 2, g.H);
    ctx.fill();
  }

  function ridgeY(g, x, base, amp, scale, seed) {
    return base + (fbm(x / (g.U * scale), seed, 4, seed * 7) - 0.5) * amp;
  }

  function pagoda(ctx, x, y, u) {
    ctx.fillStyle = '#4a5560';
    ctx.fillRect(x - u * 0.7, y - u * 2.4, u * 1.4, u * 2.4);
    for (let i = 0; i < 5; i++) {
      const w = u * (2.6 - i * 0.38);
      const ty = y - u * (0.9 + i * 1.5);
      ctx.fillStyle = '#3d4852';
      ctx.beginPath();
      ctx.moveTo(x - w * 1.15, ty);
      ctx.lineTo(x - w * 0.6, ty - u * 0.7);
      ctx.lineTo(x + w * 0.6, ty - u * 0.7);
      ctx.lineTo(x + w * 1.15, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#56626c';
      ctx.fillRect(x - w * 0.55, ty, w * 1.1, u * 0.5);
    }
    ctx.fillStyle = '#3d4852';
    ctx.fillRect(x - u * 0.08, y - u * 10.6, u * 0.16, u * 1.6);
  }

  function pine(ctx, x, y, u, rand) {
    ctx.fillStyle = '#4b3e32';
    ctx.fillRect(x - u * 0.18, y - u * 2.4, u * 0.36, u * 2.4);
    ctx.fillStyle = '#3f5c3c';
    for (let i = 0; i < 3; i++) {
      blob(ctx, x + (rand() - 0.5) * u * 0.6, y - u * (2.2 + i * 0.9), u * (1.5 - i * 0.25), u * 0.55);
    }
  }

  function paintHills(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ph = Math.round(g.W * 0.78);
    ridge(ctx, g, g.H * 0.58, g.H * 0.2, 36, 3.2, '#a3b8b4');
    ridge(ctx, g, g.H * 0.64, g.H * 0.18, 28, 5.6, '#8aa59a');
    pagoda(ctx, ph, ridgeY(g, ph, g.H * 0.64, g.H * 0.18, 28, 5.6) + g.U * 0.8, g.U * 1.05);
    ridge(ctx, g, g.H * 0.74, g.H * 0.16, 24, 8.1, '#6f9170');
    ridge(ctx, g, g.H * 0.85, g.H * 0.1, 20, 12.3, '#587d4f');
    terraces(ctx, g);
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      pine(ctx, x, ridgeY(g, x, g.H * 0.85, g.H * 0.1, 20, 12.3) + g.U * 1.2, g.U * (1.1 + rand() * 0.6), rand);
    }
    return c;
  }

  function terraces(ctx, g) {
    ctx.strokeStyle = '#7ea05f';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = 0.6;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let x = 0; x <= g.W + 2; x += 3) {
        const y = ridgeY(g, x, g.H * 0.85, g.H * 0.1, 20, 12.3) + g.U * (1.5 + k * 2.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#486b44';
    ctx.fillRect(0, g.H * 0.97, g.W, g.H * 0.03);
  }

  // ---- kites ---------------------------------------------------------------

  function makeKites(g, rand) {
    const U = g.U;
    const defs = [
      { kind: 'swallow', hx: 0.2, hy: 0.24, s: 9.5, c: INDIGO, d: VERMILION },
      { kind: 'butterfly', hx: 0.5, hy: 0.16, s: 8.5, c: VERMILION, d: GOLD },
      { kind: 'diamond', hx: 0.82, hy: 0.28, s: 9, c: GOLD, d: INDIGO },
      { kind: 'chain', hx: 0.36, hy: 0.4, s: 2.6, c: VERMILION, d: GOLD },
      { kind: 'swallow', hx: 0.68, hy: 0.4, s: 6.5, c: VERMILION, d: INK },
    ];
    return defs.map((d, i) => ({
      kind: d.kind, hx: d.hx * g.W, hy: d.hy * g.H, s: d.s * U, c: d.c, d: d.d,
      ax: U * (4 + rand() * 4), ay: U * (2 + rand() * 2),
      fa: 0.18 + rand() * 0.12, fb: 0.14 + rand() * 0.1, p: rand() * TAU, q: rand() * TAU, i,
    }));
  }

  function tail(ctx, x, y, len, t, k, sway, u) {
    ctx.lineWidth = Math.max(1.5, u * 0.8);
    ctx.strokeStyle = TAIL_TONES[k.i % 4];
    ctx.beginPath();
    ctx.moveTo(x, y);
    const seg = len / SEGS;
    for (let j = 1; j <= SEGS; j++) {
      const f = j / SEGS;
      ctx.lineTo(x + Math.sin(t * 2.2 - j * 0.55 + k.p) * u * 1.6 * f * sway + f * u * 1.2, y + j * seg);
    }
    ctx.stroke();
    for (let j = 3; j <= SEGS; j += 3) {
      const f = j / SEGS;
      ctx.fillStyle = TAIL_TONES[(k.i + j / 3) % 4];
      ctx.fillRect(x + Math.sin(t * 2.2 - j * 0.55 + k.p) * u * 1.6 * f * sway + f * u * 1.2 - u * 0.5, y + j * seg - u * 0.3, u, u * 0.6);
    }
  }

  function string(ctx, x, y, g, k) {
    ctx.strokeStyle = 'rgba(60,56,52,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - g.U * 3 - (k.hx - g.W * 0.5) * 0.05, g.H * 0.7, g.W * (0.1 + 0.15 * k.i), g.H + 4);
    ctx.stroke();
  }

  function diamond(ctx, k) {
    const s = k.s;
    ctx.fillStyle = k.c;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s * 0.9);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = k.d;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(s * 0.32, 0);
    ctx.lineTo(0, s * 0.4);
    ctx.lineTo(-s * 0.32, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(0, s * 0.9);
    ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0);
    ctx.stroke();
  }

  function swallow(ctx, k, flap) {
    const s = k.s;
    ctx.fillStyle = k.c;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.quadraticCurveTo(side * s * 0.9, -s * (0.75 + flap), side * s * 1.3, -s * 0.35);
      ctx.lineTo(side * s * 0.85, s * 0.1);
      ctx.quadraticCurveTo(side * s * 0.4, s * 0.05, 0, s * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = k.d;
    blob(ctx, 0, 0, s * 0.18, s * 0.42);
    ctx.fillStyle = k.c;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.3);
    ctx.lineTo(-s * 0.4, s * 0.85);
    ctx.lineTo(0, s * 0.55);
    ctx.lineTo(s * 0.4, s * 0.85);
    ctx.lineTo(s * 0.18, s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WASHI;
    blob(ctx, -s * 0.7, -s * 0.2, s * 0.14, s * 0.1);
    blob(ctx, s * 0.7, -s * 0.2, s * 0.14, s * 0.1);
  }

  function butterfly(ctx, k, flap) {
    const s = k.s;
    const w = 0.85 + flap * 0.3;
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = k.c;
      blob(ctx, side * s * 0.55 * w, -s * 0.35, s * 0.6 * w, s * 0.5);
      ctx.fillStyle = k.d;
      blob(ctx, side * s * 0.45 * w, s * 0.35, s * 0.4 * w, s * 0.38);
      ctx.fillStyle = WASHI;
      blob(ctx, side * s * 0.6 * w, -s * 0.4, s * 0.16, s * 0.16);
    }
    ctx.fillStyle = INK;
    blob(ctx, 0, 0, s * 0.1, s * 0.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.25, -s * 1.0);
    ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.25, -s * 1.0);
    ctx.stroke();
  }

  function drawChain(ctx, k, g, t, sway) {
    const r = k.s;
    let px = 0;
    let py = 0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (let j = 0; j < CHAIN; j++) {
      const x = k.x + j * r * 1.7 + Math.sin(t * 1.3 - j * 0.7 + k.p) * r * 0.9 * sway;
      const y = k.y + j * r * 0.9 + Math.sin(t * 1.1 - j * 0.6 + k.q) * r * 0.7 * sway;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r * 1.4);
      ctx.lineTo(x - r * 0.3, y + r * 1.4);
      ctx.stroke();
      ctx.fillStyle = DISC_TONES[j % 4];
      blob(ctx, x, y, r * (j === 0 ? 1.15 : 0.95), r * (j === 0 ? 1.15 : 0.95));
      ctx.fillStyle = WASHI;
      blob(ctx, x + r * 0.1, y, r * 0.35, r * 0.35);
      if (j === 0) { px = x; py = y; }
    }
    ctx.strokeStyle = 'rgba(60,56,52,0.35)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - g.U * 6, g.H * 0.7, g.W * 0.3, g.H + 4);
    ctx.stroke();
  }

  function drawKite(ctx, k, g, t, sway, tl) {
    k.x = k.hx + Math.sin(t * k.fa + k.p) * k.ax * sway;
    k.y = k.hy + Math.sin(t * k.fb + k.q) * k.ay * sway;
    if (k.kind === 'chain') { drawChain(ctx, k, g, t, sway); return; }
    const tilt = Math.cos(t * k.fa + k.p) * 0.18 * sway;
    const flap = Math.sin(t * 1.6 + k.p) * 0.12 * sway;
    string(ctx, k.x, k.y, g, k);
    const down = k.kind === 'diamond' ? k.s * 0.9 : k.kind === 'butterfly' ? k.s * 0.6 : k.s * 0.8;
    tail(ctx, k.x + Math.sin(tilt) * down, k.y + down, g.U * tl, t, k, sway, g.U);
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(tilt);
    if (k.kind === 'diamond') diamond(ctx, k);
    else if (k.kind === 'swallow') swallow(ctx, k, flap);
    else butterfly(ctx, k, flap);
    ctx.restore();
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.clouds = paintClouds(g, rand);
    state.hills = paintHills(g, rand);
    state.kites = makeKites(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { kites, breeze } = api.props;
    const sway = 0.3 + breeze * 0.7;
    const count = Math.min(state.kites.length, Math.round(2 + kites * 1.5));
    const n = kites <= 0 ? 0 : count;
    ctx.drawImage(state.sky, 0, 0);
    const off = (t * g.U * 0.9) % g.W;
    ctx.drawImage(state.clouds, off - g.W, 0);
    ctx.drawImage(state.clouds, off, 0);
    ctx.drawImage(state.hills, 0, 0);
    for (let i = 0; i < n; i++) drawKite(ctx, state.kites[i], g, t, sway, i === 3 ? 0 : 30 + (i % 3) * 4);
  }

  Kasuri.run({
    defaults: { kites: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
