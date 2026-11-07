/*
 * 霧 Kiri — mountains in ink wash, with mist moving through the valleys.
 *
 * Painted like a hanging scroll: dark ink on pale paper, each ridge fading to
 * nothing at its foot so the next one can float in front of it. Paper-coloured
 * mist banks slide between the ridges. A far temple, a few birds, one red seal.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor: P, mixColor, toHex } = K;

  const PAPER = '#e8e1d0';
  const INK = P('#14130f');
  const WASH = P(PAPER);
  const SEAL = '#a8392a';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function ridgeLine(g, base, rise, scale, seed) {
    const n = Math.ceil(g.W) + 2;
    const ys = new Float32Array(n);
    for (let x = 0; x < n; x++) {
      const shape = 1 - Math.abs(fbm(x * scale, seed * 3.1, 5, seed) * 2 - 1);
      ys[x] = g.H * (base - Math.pow(shape, 2.2) * rise);
    }
    return ys;
  }

  function paintRidge(g, ys, depth, fade) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const colour = mixColor(WASH, INK, depth);
    for (let x = 0; x < g.W; x++) {
      const top = Math.max(0, Math.floor(ys[x]));
      const span = fade * g.H;
      for (let y = top; y < g.H; y++) {
        const d = (y - ys[x]) / span;
        if (d > 1) break;
        const streak = fbm(x * 0.05, y * 0.016, 3, 11);
        const a = (1 - smoothstep(0, 1, d)) * lerp(0.62, 1, streak);
        const i = (y * g.W + x) * 4;
        img.data[i] = colour[0];
        img.data[i + 1] = colour[1];
        img.data[i + 2] = colour[2];
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPines(ctx, g, rand, ys, count) {
    ctx.fillStyle = toHex(INK);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * (g.W - 1));
      const h = g.U * (1.6 + rand() * 2.2);
      const y = ys[x] + g.U * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.34, y);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + h * 0.34, y);
      ctx.fill();
    }
  }

  function paintTemple(ctx, g, x, y) {
    const u = g.U * 1.1;
    ctx.fillStyle = '#26241f';
    for (let k = 0; k < 3; k++) {
      const w = u * (5 - k * 1.2);
      const top = y - u * (2.4 + k * 2.3);
      ctx.beginPath();
      ctx.moveTo(x - w, top + u * 1.4);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w, top + u * 1.4);
      ctx.fill();
      ctx.fillRect(x - w * 0.55, top + u * 1.4, w * 1.1, u);
    }
  }

  function paintSeal(ctx, g) {
    const s = g.U * 3.6;
    const x = g.W - s - g.U * 3;
    const y = g.H - s - g.U * 4;
    ctx.fillStyle = SEAL;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x + s * 0.3, y + s * 0.2, Math.max(1, s * 0.12), s * 0.6);
    ctx.fillRect(x + s * 0.2, y + s * 0.45, s * 0.6, Math.max(1, s * 0.12));
  }

  function paintMist(w, h, seed, scale) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const rgb = P(PAPER);
    const density = (x, y) => fbm(x * scale, y * scale * 2.8, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = smoothstep(0.4, 0.72, v) * band * 215;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeRidges(g, rand) {
    const specs = [
      { base: 0.5, rise: 0.44, scale: 0.008, seed: 4, depth: 0.4, fade: 0.3 },
      { base: 0.66, rise: 0.42, scale: 0.011, seed: 9, depth: 0.6, fade: 0.3 },
      { base: 0.82, rise: 0.4, scale: 0.014, seed: 15, depth: 0.8, fade: 0.3 },
      { base: 1, rise: 0.3, scale: 0.02, seed: 22, depth: 0.96, fade: 0.34 },
    ];
    return specs.map((s, i) => {
      const ys = ridgeLine(g, s.base, s.rise, s.scale, s.seed);
      const canvas = paintRidge(g, ys, s.depth, s.fade);
      const ctx = canvas.getContext('2d');
      if (i === 3) paintPines(ctx, g, rand, ys, Math.round(g.W * 0.5));
      if (i === 1) {
        const x = Math.floor(g.W * 0.68);
        paintTemple(ctx, g, x, ys[x] + g.U);
      }
      return canvas;
    });
  }

  function drawBank(ctx, tile, y, offset) {
    const w = tile.width;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y);
    ctx.drawImage(tile, x + w, y);
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = '#2a2822';
    ctx.lineWidth = 1;
    const span = g.W + g.U * 30;
    for (let i = 0; i < 3; i++) {
      const x = ((t * g.U * 1.3 + i * g.U * 7 + state.birdStart) % span) - g.U * 15;
      const y = g.H * 0.2 + i * g.U * 2.4 + Math.sin(t * 0.3 + i) * g.U;
      const flap = Math.sin(t * 3 + i * 2) * g.U * 0.7;
      const w = g.U * 1.4;
      ctx.beginPath();
      ctx.moveTo(x - w, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y - flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.ridges = makeRidges(g, rand);
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.34);
    state.mists = [paintMist(w, h, 3, 0.012), paintMist(w, h, 13, 0.016), paintMist(w, h, 27, 0.02)];
    state.seal = layer(g.W, g.H);
    paintSeal(state.seal.getContext('2d'), g);
    state.birdStart = rand() * g.W;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const drift = t * g.U * api.props.drift;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(state.ridges[0], 0, 0);
    drawBirds(ctx, g, t);
    drawBank(ctx, state.mists[0], g.H * 0.26, drift * 1.1);
    ctx.drawImage(state.ridges[1], 0, 0);
    drawBank(ctx, state.mists[1], g.H * 0.44, -drift * 1.6);
    ctx.drawImage(state.ridges[2], 0, 0);
    drawBank(ctx, state.mists[2], g.H * 0.62, drift * 2.3);
    ctx.drawImage(state.ridges[3], 0, 0);
    ctx.drawImage(state.seal, 0, 0);
  }

  Kasuri.run({
    defaults: { drift: 1, ramp: 'kana', cell: 8, invert: true, bg: PAPER, tint: 0.5, dither: 0.3, boost: 0.2 },
    maxFps: 20,
    setup,
    draw,
  });
})();
