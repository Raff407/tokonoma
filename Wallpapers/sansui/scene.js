/*
 * 山水 Sansui — an ink-wash landscape: tall peaks in layers, a river, one small boat.
 *
 * Sky, each mountain layer, the river and the near cliffs are baked once into their own
 * layers so the mist strips can pass between them. Per frame: a few drawImage calls,
 * three tiling mist strips, a handful of water streaks and the boat.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WASHI_TOP = K.parseColor('#e9dfc6');
  const WASHI_LOW = K.parseColor('#ddd1b4');
  const WATER = K.parseColor('#b9bcb2');
  const WATER_DEEP = K.parseColor('#9ea6a3');
  const SUN = '#c4553a';
  const MIST = [236, 228, 208];
  const INK = '#23282c';
  const BOAT_TRIP = 110;
  const STREAKS = 26;
  const state = {};

  // Each layer: peaks as [x, height, half width] in fractions of W/H, an ink, a baseline.
  const LAYERS = [
    {
      base: 0.5, hill: 0.04, fade: 0.2, rough: 0.03, seed: 3,
      dark: '#7f8b94', light: '#a9afae',
      peaks: [[0.06, 0.14, 0.12], [0.2, 0.22, 0.07], [0.27, 0.3, 0.06], [0.34, 0.2, 0.08], [0.5, 0.17, 0.12], [0.63, 0.34, 0.06], [0.7, 0.25, 0.07], [0.84, 0.2, 0.1], [0.97, 0.27, 0.07]],
    },
    {
      base: 0.72, hill: 0.03, fade: 0.18, rough: 0.04, seed: 17,
      dark: '#4b5961', light: '#7c8a8b',
      peaks: [[0.1, 0.2, 0.09], [0.23, 0.36, 0.06], [0.29, 0.26, 0.06], [0.42, 0.14, 0.12], [0.55, 0.1, 0.1], [0.74, 0.22, 0.07], [0.8, 0.31, 0.055], [0.92, 0.18, 0.09]],
    },
  ];
  const CLIFFS = {
    seed: 29, rough: 0.04, dark: '#1f2427', light: '#3c4a47',
    peaks: [[0.0, 0.72, 0.22], [0.13, 0.42, 0.12], [1.0, 0.46, 0.2], [0.88, 0.24, 0.1]],
  };

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
    const U = H / 100;
    const river = Math.round(H * 0.77);
    return { W, H, U, river };
  }

  // Height of a spec's skyline at column x, measured up from its baseline.
  function peakHeight(spec, g, x) {
    let h = 0;
    for (const [px, ph, pw] of spec.peaks) {
      const d = (x / g.W - px) / (pw * g.H / g.W);
      const lean = d < 0 ? 1.15 : 0.85;
      const k = d * lean;
      h = Math.max(h, ph * Math.exp(-k * k * 2.6) * (1 - 0.08 * Math.cos(k * 7)));
    }
    const n = fbm(x / (g.U * 6), spec.seed, 4, spec.seed) - 0.5;
    const m = fbm(x / (g.U * 22), spec.seed + 9, 3, spec.seed) - 0.5;
    return (h + m * spec.rough * 2 + n * spec.rough * (0.5 + h * 2.5)) * g.H;
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.75));
      for (let x = 0; x < g.W; x++) {
        const grain = (rand() - 0.5) * 0.12;
        const t = Math.max(0, Math.min(1, f + grain));
        const i = (y * g.W + x) * 4;
        d[i] = lerp(WASHI_TOP[0], WASHI_LOW[0], t);
        d[i + 1] = lerp(WASHI_TOP[1], WASHI_LOW[1], t);
        d[i + 2] = lerp(WASHI_TOP[2], WASHI_LOW[2], t);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = SUN;
    blob(ctx, g.W * 0.56, g.H * 0.17, g.U * 5.5, g.U * 5.5);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- mountains -----------------------------------------------------------

  // Ink is darkest along the ridge and washes out toward the foot, with vertical texture strokes.
  function paintRange(g, spec, base, fade, hill) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const dark = K.parseColor(spec.dark);
    const light = K.parseColor(spec.light);
    const fadePx = fade * g.H;
    for (let x = 0; x < g.W; x++) {
      const ridge = base - hill - peakHeight(spec, g, x);
      const y0 = Math.max(0, Math.floor(ridge));
      for (let y = y0; y < g.H; y++) {
        const depth = y - ridge;
        if (depth < 0) continue;
        const foot = fadePx > 0 ? smoothstep(base - fadePx, base + fadePx * 0.2, y) : 0;
        const tex = fbm(x / (g.U * 0.9), y / (g.U * 5), 3, spec.seed + 5);
        const edge = 1 - smoothstep(0, g.U * 2.2, depth);
        const wash = Math.max(0, Math.min(1, (1 - foot) * (0.72 + tex * 0.45) + edge * 0.3));
        if (wash <= 0.02) continue;
        const k = Math.max(0, Math.min(1, edge * 0.8 + (tex - 0.35) * 0.9));
        const i = (y * g.W + x) * 4;
        d[i] = lerp(light[0], dark[0], k);
        d[i + 1] = lerp(light[1], dark[1], k);
        d[i + 2] = lerp(light[2], dark[2], k);
        d[i + 3] = Math.round(Math.min(1, wash) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function pine(ctx, x, y, h, ink) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1, h * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.08, y - h);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const f = 0.45 + i * 0.22;
      const w = h * (0.42 - i * 0.1);
      blob(ctx, x + h * 0.08 * f + (i % 2 ? w * 0.2 : -w * 0.2), y - h * f, w, w * 0.32);
    }
  }

  function paintCliffs(g, rand) {
    const c = paintRange(g, CLIFFS, g.H + g.U * 2, 0, 0);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const left = i < 6;
      const x = left ? g.W * (0.01 + rand() * 0.2) : g.W * (0.85 + rand() * 0.15);
      const top = g.H + g.U * 2 - peakHeight(CLIFFS, g, x);
      if (top > g.H * 0.95 || top < 0) continue;
      pine(ctx, x, top + g.U * 1.5, g.U * (3.5 + rand() * 3), '#1b2023');
    }
    return c;
  }

  // ---- river ---------------------------------------------------------------

  function paintRiver(g, rand) {
    const top = g.river;
    const h = g.H - top;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = y / Math.max(1, h);
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 14), (top + y) / (g.U * 0.8), 3, 41);
        const t = Math.max(0, Math.min(1, f * 0.7 + (n - 0.5) * 0.6));
        const i = (y * g.W + x) * 4;
        d[i] = lerp(WATER[0], WATER_DEEP[0], t);
        d[i + 1] = lerp(WATER[1], WATER_DEEP[1], t);
        d[i + 2] = lerp(WATER[2], WATER_DEEP[2], t);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#6f7c7c';
    for (let i = 0; i < 4; i++) {
      blob(ctx, g.W * (0.3 + rand() * 0.45), g.U * (0.6 + rand() * 1.2), g.U * (3 + rand() * 4), g.U * 0.35);
    }
    return c;
  }

  function makeStreaks(g, rand) {
    const f = () => new Float32Array(STREAKS);
    const s = { x: f(), y: f(), len: f(), v: f(), p: f() };
    for (let i = 0; i < STREAKS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = g.river + g.U * 1.5 + rand() * (g.H - g.river - g.U * 2);
      s.len[i] = g.U * (2 + rand() * 5);
      s.v[i] = g.U * (0.4 + rand() * 0.6);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t) {
    const s = state.streaks;
    ctx.fillStyle = '#d9d3c0';
    for (let i = 0; i < STREAKS; i++) {
      const x = ((s.x[i] + t * s.v[i]) % (g.W + s.len[i])) - s.len[i];
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.5 + s.p[i]);
      ctx.fillRect(x, s.y[i], s.len[i], Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g, height, seed, alpha) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.max(2, Math.ceil(g.H * height));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 3.5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.pow(Math.sin((y / h) * Math.PI), 0.8);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = smoothstep(0.3, 0.62, v) * band;
        const i = (y * w + x) * 4;
        img.data[i] = MIST[0];
        img.data[i + 1] = MIST[1];
        img.data[i + 2] = MIST[2];
        img.data[i + 3] = Math.round(a * alpha);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawStrip(ctx, strip, y, offset, alpha) {
    if (alpha <= 0) return;
    const w = strip.width;
    const a = ((offset % w) + w) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(strip, -a, y);
    ctx.drawImage(strip, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- boat ----------------------------------------------------------------

  function drawBoat(ctx, g, t) {
    const u = g.U;
    const f = (t / BOAT_TRIP + 0.32) % 1;
    const x = lerp(g.W * 0.1, g.W * 0.92, f);
    const y = g.river + u * 6.5 + Math.sin(t * 0.9) * u * 0.25;
    const L = u * 7.5;
    ctx.fillStyle = '#dcd5c2';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x - L * 2.6, y + u * 0.4, L * 1.6, Math.max(1, u * 0.35));
    ctx.fillRect(x - L * 1.9, y + u * 1.2, L * 1.0, Math.max(1, u * 0.3));
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = INK;
    ctx.fillRect(x - L * 0.85, y + u * 0.5, L * 1.7, u * 1.1);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x - L, y - u * 1.3);
    ctx.quadraticCurveTo(x - L * 0.6, y + u * 0.4, x, y + u * 0.4);
    ctx.quadraticCurveTo(x + L * 0.6, y + u * 0.4, x + L * 1.05, y - u * 1.6);
    ctx.lineTo(x + L * 0.7, y - u * 0.9);
    ctx.lineTo(x - L * 0.7, y - u * 0.8);
    ctx.closePath();
    ctx.fill();
    // ferryman: body, wide hat, long pole into the water
    const fx = x + L * 0.3;
    ctx.fillRect(fx - u * 0.6, y - u * 4, u * 1.3, u * 3.3);
    ctx.beginPath();
    ctx.moveTo(fx - u * 2, y - u * 3.9);
    ctx.lineTo(fx, y - u * 5.6);
    ctx.lineTo(fx + u * 2.1, y - u * 3.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(fx + u * 2.5, y - u * 7.5);
    ctx.lineTo(fx - u * 3.2, y + u * 1.8);
    ctx.stroke();
    // a small cabin of matting at the stern
    ctx.fillStyle = '#5a5445';
    ctx.beginPath();
    ctx.ellipse(x - L * 0.42, y - u * 1.0, L * 0.32, u * 1.7, 0, Math.PI, TAU);
    ctx.fill();
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.far = paintRange(g, LAYERS[0], LAYERS[0].base * g.H, LAYERS[0].fade, LAYERS[0].hill * g.H);
    state.mid = paintRange(g, LAYERS[1], LAYERS[1].base * g.H, LAYERS[1].fade, LAYERS[1].hill * g.H);
    state.river = paintRiver(g, rand);
    state.cliffs = paintCliffs(g, rand);
    state.mistHigh = paintMist(g, 0.16, 71, 235);
    state.mistMid = paintMist(g, 0.14, 83, 235);
    state.mistLow = paintMist(g, 0.07, 97, 150);
    state.streaks = makeStreaks(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, boat } = api.props;
    const u = g.U;
    ctx.drawImage(state.sky, 0, 0);
    drawStrip(ctx, state.mistHigh, g.H * 0.2, t * u * 0.9, mist * 0.7);
    ctx.drawImage(state.far, 0, 0);
    drawStrip(ctx, state.mistHigh, g.H * 0.36, t * u * 1.6 + g.W * 0.3, mist);
    ctx.drawImage(state.mid, 0, 0);
    drawStrip(ctx, state.mistMid, g.H * 0.5, -t * u * 1.3, mist);
    drawStrip(ctx, state.mistMid, g.H * 0.64, t * u * 1.1 + g.W * 0.5, mist);
    ctx.drawImage(state.river, 0, g.river);
    drawStreaks(ctx, g, t);
    if (boat) drawBoat(ctx, g, t);
    drawStrip(ctx, state.mistLow, g.river - g.H * 0.03, t * u * 1.8, mist * 0.8);
    ctx.drawImage(state.cliffs, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
