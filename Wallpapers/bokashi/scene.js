/*
 * 暈し Bokashi — woodblock graded dye over layered ridges at dawn.
 *
 * The sky is one tall strip of stepped colour with soft, dithered edges, slid up and
 * down slowly. Sun, mist strips and three ridges are baked once and only moved.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const STOPS = [
    [0, '#1f2850'], [0.16, '#2f3f78'], [0.3, '#5a6a9a'], [0.42, '#c9c8c4'],
    [0.5, '#e8dcc0'], [0.58, '#e9b878'], [0.66, '#d6452c'], [0.8, '#a63a2c'], [1, '#5a3036'],
  ];
  const STRIP = 1.5;
  const BANDS = 12;
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

  function colourAt(inks, f) {
    for (let i = 1; i < STOPS.length; i++) {
      if (f <= STOPS[i][0]) {
        const k = (f - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]);
        const a = inks[i - 1];
        const b = inks[i];
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
    }
    return inks[inks.length - 1];
  }

  // Stepped dye: each band is a flat tone, the seam between bands is a soft dithered blend.
  function paintSky(g, rand) {
    const h = Math.ceil(g.H * STRIP);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    const inks = STOPS.map((s) => K.parseColor(s[1]));
    const seam = h / BANDS;
    for (let y = 0; y < h; y++) {
      const band = Math.floor(y / seam);
      const into = (y - band * seam) / seam;
      const blend = into > 0.55 ? (into - 0.55) / 0.45 : 0;
      const grain = 1 + (rand() - 0.5) * 0.02;
      for (let x = 0; x < g.W; x++) {
        const k = blend * blend * (3 - 2 * blend);
        const ink = colourAt(inks, Math.min(1, (band + 0.4 + k) / BANDS));
        const i = (y * g.W + x) * 4;
        d[i] = ink[0] * grain;
        d[i + 1] = ink[1] * grain;
        d[i + 2] = ink[2] * grain;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSun(g) {
    const r = g.U * 9;
    const c = layer(r * 2 + 4, r * 2 + 4);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(240, 214, 160, 0.35)';
    blob(ctx, r + 2, r + 2, r, r);
    ctx.fillStyle = '#d6452c';
    blob(ctx, r + 2, r + 2, r * 0.72, r * 0.72);
    ctx.fillStyle = '#e07a4c';
    blob(ctx, r + 2 - r * 0.12, r + 2 - r * 0.12, r * 0.42, r * 0.42);
    return c;
  }

  function paintMist(g, rand, tone) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.U * 12);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * w + rand() * g.U * 4;
      const y = c.height * (0.3 + rand() * 0.4);
      const rx = g.U * (10 + rand() * 14);
      blob(ctx, x, y, rx, g.U * (0.7 + rand() * 0.8));
      blob(ctx, x - w, y, rx, g.U * 0.9);
      blob(ctx, x + rx * 0.5, y - g.U * 0.8, rx * 0.5, g.U * 0.5);
    }
    return c;
  }

  function paintRidge(g, rand, base, amp, seed, fill, edge, pines) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = (x) => g.H * base + fbm(x / (g.U * 38), seed, 4, seed * 7) * g.H * amp;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, top(x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = edge;
    for (let x = 0; x < g.W; x += 2) ctx.fillRect(x, top(x), 2, Math.max(1, g.U * 0.35));
    if (pines) {
      ctx.fillStyle = fill;
      for (let i = 0; i < pines; i++) {
        const x = rand() * g.W;
        const h = g.U * (5 + rand() * 6);
        const y = top(x) + g.U * 0.5;
        ctx.fillRect(x - g.U * 0.18, y - h, g.U * 0.36, h);
        for (let k = 0; k < 4; k++) {
          const py = y - h * (0.3 + k * 0.2);
          const w = g.U * (2.2 - k * 0.4);
          blob(ctx, x + (k % 2 ? 1 : -1) * g.U * 0.4, py, w, g.U * 0.55);
        }
      }
    }
    return c;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.sun = paintSun(g);
    state.mistFar = paintMist(g, rand, 'rgba(240, 226, 196, 0.8)');
    state.mistNear = paintMist(g, rand, 'rgba(222, 204, 176, 0.75)');
    state.far = paintRidge(g, rand, 0.58, 0.14, 2.3, '#4a5478', '#7a82a0', 0);
    state.mid = paintRidge(g, rand, 0.7, 0.12, 5.1, '#38463f', '#5a6a58', 0);
    state.near = paintRidge(g, rand, 0.84, 0.1, 8.7, '#1f2623', '#3d4a3c', 14);
  }

  function strip(ctx, img, g, t, speed, y, mix) {
    const w = img.width;
    const a = ((t * speed) % w + w) % w;
    ctx.globalAlpha = mix;
    ctx.drawImage(img, -a, y);
    ctx.drawImage(img, w - a, y);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drift, mist, sun } = api.props;
    const span = g.H * (STRIP - 1);
    const off = span * (0.5 + 0.5 * Math.sin(t * 0.05 * drift));
    ctx.drawImage(state.sky, 0, -off);
    if (sun) {
      const s = state.sun;
      const sx = g.W * 0.64;
      const sy = g.H * 0.5 - g.U * 6 * Math.sin(t * 0.04 * drift) - s.height / 2;
      ctx.drawImage(s, sx - s.width / 2, sy);
    }
    ctx.drawImage(state.far, 0, 0);
    strip(ctx, state.mistFar, g, t, g.U * 0.9, g.H * 0.54, 0.9 * mist);
    ctx.drawImage(state.mid, 0, 0);
    strip(ctx, state.mistNear, g, t, -g.U * 1.4 + state.mistNear.width * 4, g.H * 0.66, 0.9 * mist);
    ctx.drawImage(state.near, 0, 0);
  }

  Kasuri.run({
    defaults: { drift: 1, mist: 1, sun: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
