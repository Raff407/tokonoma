/*
 * 樹氷 Juhyo — firs buried in rime on a mountain slope at dusk.
 *
 * Sky, ridges, slopes and the crowds of frosted firs are baked once. The wind
 * drives two tiling bands of blown snow along the slopes and a short pool of
 * flakes across the whole view.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = [[0, '#3f5076'], [0.4, '#7584a2'], [0.75, '#b9b3ac'], [1, '#e2c99a']];
  const SUN = '#e8cf98';
  const RIDGES = ['#7b86a2', '#5c688a'];
  const SLOPE_LIT = '#d9dde3';
  const SLOPE_SHADE = '#8e9ab2';
  const RIME_LIT = '#f0e9d8';
  const RIME_MID = '#c6ccd8';
  const RIME_SHADE = '#7f8ba6';
  const NEEDLE = '#33443e';
  const FLAKE = '#eef0f2';
  const MAX_FLAKES = 360;
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

  function mix(a, b, t) {
    return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), t));
  }

  // ---- land ----------------------------------------------------------------

  function paintSky(ctx, g) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    for (const [s, c] of SKY) sky.addColorStop(s, c);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = SUN;
    ctx.globalAlpha = 0.35;
    blob(ctx, g.W * 0.22, g.H * 0.3, g.U * 8, g.U * 8);
    ctx.globalAlpha = 1;
    blob(ctx, g.W * 0.22, g.H * 0.3, g.U * 4, g.U * 4);
  }

  function ridge(ctx, g, base, rise, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * (base - fbm(x * scale, seed, 4, seed) * rise));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function slopeTop(g, s, x) {
    return g.H * (s.base - s.tilt * (x / g.W)) - fbm(x / (g.U * 30), s.seed, 3, s.seed) * g.H * 0.05;
  }

  function paintSlope(ctx, g, s) {
    ctx.fillStyle = s.shade;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, slopeTop(g, s, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = s.lit;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, slopeTop(g, s, x) + g.U * 1.2);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  // ---- snow monsters -------------------------------------------------------

  function lumps(g, rand, x, y, h, lean) {
    const tiers = 7 + Math.floor(rand() * 4);
    const base = h * (0.24 + rand() * 0.08);
    const out = [];
    for (let k = 0; k < tiers; k++) {
      const t = k / tiers;
      const width = base * Math.pow(1 - t, 0.8) + h * 0.03;
      const cy = y - h * t * 0.94;
      const cx = x + lean * t * h + Math.sin(t * 9 + x) * width * 0.12;
      const n = width > base * 0.5 ? 3 : 2;
      for (let j = 0; j < n; j++) {
        const f = n === 1 ? 0 : j / (n - 1) - 0.5;
        const r = width * (0.45 + rand() * 0.3);
        out.push({
          x: cx + f * width * 1.1 + (rand() - 0.5) * width * 0.25,
          y: cy - rand() * h * 0.04,
          rx: r,
          ry: r * (0.55 + rand() * 0.3),
        });
      }
    }
    out.push({ x: x + lean * h * 0.95, y: y - h * 0.97, rx: h * 0.035, ry: h * 0.06 });
    return out;
  }

  function monster(ctx, g, rand, x, y, h, haze) {
    const lit = mix(RIME_LIT, haze.colour, haze.amount);
    const mid = mix(RIME_MID, haze.colour, haze.amount);
    const shade = mix(RIME_SHADE, haze.colour, haze.amount);
    const parts = lumps(g, rand, x, y, h, (rand() - 0.35) * 0.14);
    ctx.fillStyle = shade;
    for (const p of parts) blob(ctx, p.x, p.y, p.rx, p.ry);
    ctx.fillStyle = mid;
    for (const p of parts) blob(ctx, p.x - p.rx * 0.16, p.y - p.ry * 0.14, p.rx * 0.8, p.ry * 0.8);
    ctx.fillStyle = lit;
    for (const p of parts) blob(ctx, p.x - p.rx * 0.36, p.y - p.ry * 0.3, p.rx * 0.48, p.ry * 0.5);
    if (haze.amount > 0.5 || h < g.U * 8) return;
    ctx.fillStyle = mix(NEEDLE, haze.colour, haze.amount);
    for (const p of parts) {
      if (rand() < 0.4) continue;
      const dx = p.rx * (0.3 + rand() * 0.5);
      blob(ctx, p.x + dx, p.y + p.ry * 0.55, p.rx * 0.22, Math.max(0.6, p.ry * 0.1));
    }
  }

  function crowd(ctx, g, rand, s, count, size, haze) {
    const spots = [];
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.2 + rand() * 0.6) / count) * g.W * 1.06 - g.W * 0.03;
      spots.push([x, slopeTop(g, s, x) + g.U * (1 + rand() * s.depth)]);
    }
    spots.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) monster(ctx, g, rand, x, y, size * (0.7 + rand() * 0.6), haze);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    ridge(ctx, g, 0.5, 0.16, 0.006, 3, RIDGES[0]);
    ridge(ctx, g, 0.56, 0.1, 0.012, 7, RIDGES[1]);
    const far = { base: 0.58, tilt: 0.06, seed: 11, depth: 4, lit: '#aab3c6', shade: '#8590aa' };
    const mid = { base: 0.7, tilt: 0.14, seed: 17, depth: 6, lit: '#c3c9d4', shade: SLOPE_SHADE };
    const near = { base: 0.86, tilt: 0.1, seed: 23, depth: 8, lit: SLOPE_LIT, shade: '#a4adc0' };
    paintSlope(ctx, g, far);
    crowd(ctx, g, rand, far, Math.round(g.W / (g.U * 4)), g.U * 5, { colour: '#8a95ae', amount: 0.55 });
    paintSlope(ctx, g, mid);
    crowd(ctx, g, rand, mid, Math.round(g.W / (g.U * 12)), g.U * 16, { colour: '#8a95ae', amount: 0.25 });
    paintSlope(ctx, g, near);
    state.nearSlope = near;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const near = state.nearSlope;
    const xs = [0.06, 0.27, 0.6, 0.88];
    for (const fx of xs) {
      const x = g.W * (fx + (rand() - 0.5) * 0.06);
      const y = slopeTop(g, near, x) + g.U * (6 + rand() * 6);
      monster(ctx, g, rand, x, y, g.U * (40 + rand() * 14), { colour: '#8a95ae', amount: 0 });
    }
    return c;
  }

  // ---- wind ----------------------------------------------------------------

  function paintDrift(g, seed) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 18), y / (g.U * 2.5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.36, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 238;
        img.data[i + 2] = 242;
        img.data[i + 3] = a * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawDrift(ctx, img, x, y, alpha) {
    const w = img.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -x, y);
    ctx.drawImage(img, w - x, y);
  }

  function resetFlake(g, i, anywhere) {
    const r = state.rand;
    state.fx[i] = anywhere ? r() * g.W : -r() * g.W * 0.2;
    state.fy[i] = r() * g.H;
    state.fv[i] = 0.6 + r() * 0.8;
    state.fp[i] = r() * TAU;
  }

  function drawFlakes(ctx, g, t, dt, wind, snow) {
    const count = Math.min(MAX_FLAKES, Math.round(g.W * 0.5 * snow));
    const push = g.U * (4 + wind * 22);
    ctx.fillStyle = FLAKE;
    for (let i = 0; i < count; i++) {
      const v = state.fv[i];
      state.fx[i] += push * v * dt;
      state.fy[i] += (g.U * 2.2 + Math.sin(t * 1.4 + state.fp[i]) * g.U * 3) * dt;
      if (state.fx[i] > g.W + 2 || state.fy[i] > g.H) resetFlake(g, i, false);
      ctx.globalAlpha = 0.45 + v * 0.35;
      ctx.fillRect(state.fx[i], state.fy[i], v > 1 && wind > 0.6 ? 3 : 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.driftA = paintDrift(g, 51);
    state.driftB = paintDrift(g, 67);
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, i, true);
    state.ox = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, snow } = api.props;
    const step = Math.min(dt, 0.1);
    state.ox += g.U * (2 + wind * 9) * step;
    const a = state.ox % state.driftA.width;
    const b = (state.ox * 1.6 + state.driftB.width * 0.4) % state.driftB.width;
    ctx.drawImage(state.back, 0, 0);
    if (snow > 0) drawDrift(ctx, state.driftA, a, g.H * 0.6, Math.min(1, snow * 0.7));
    ctx.globalAlpha = 1;
    ctx.drawImage(state.front, 0, 0);
    if (snow > 0) drawDrift(ctx, state.driftB, b, g.H * 0.82, Math.min(1, snow * 0.8));
    ctx.globalAlpha = 1;
    drawFlakes(ctx, g, t, step, wind, snow);
  }

  Kasuri.run({
    defaults: { wind: 1, snow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
