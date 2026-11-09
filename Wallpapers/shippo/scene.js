/*
 * 七宝 Shippo — the seven treasures pattern of interlocking circles.
 *
 * The cloth is baked once as a wide tile of indigo circles with gold lines and
 * vermilion stars, plus a sparse gold layer. Each frame lays both back in thin
 * horizontal strips that slide sideways in a slow wave, with a soft band of
 * warm light drifting across.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INDIGO = ['#1c2d4c', '#2a3f66', '#121c33'];
  const GOLD = '#c2a255';
  const GOLD_DIM = '#b09646';
  const VERMILION = '#c0472d';
  const WASHI = '#e8dec6';
  const STRIPS = 44;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function paintCloth(W, H, a) {
    const c = layer(W + a * 3, H + a * 2);
    const ctx = c.getContext('2d');
    const r = a / Math.SQRT2;
    const nx = Math.ceil(c.width / a) + 1;
    const ny = Math.ceil(c.height / a) + 1;
    ctx.fillStyle = INDIGO[2];
    ctx.fillRect(0, 0, c.width, c.height);
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        ctx.fillStyle = INDIGO[(i + j) & 1 ? 0 : 1];
        circle(ctx, i * a, j * a, r);
        ctx.fill();
      }
    }
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = Math.max(0.8, a * 0.11);
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        circle(ctx, i * a, j * a, r);
        ctx.stroke();
      }
    }
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        const sx = (i + 0.5) * a;
        const sy = (j + 0.5) * a;
        const s = a * 0.17;
        ctx.fillStyle = VERMILION;
        ctx.beginPath();
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx + s, sy);
        ctx.lineTo(sx, sy + s);
        ctx.lineTo(sx - s, sy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GOLD;
        circle(ctx, i * a, j * a, Math.max(0.7, a * 0.07));
        ctx.fill();
      }
    }
    return c;
  }

  function paintGoldLayer(W, H, a) {
    const b = a * 2;
    const c = layer(W + b * 3, H + b * 2);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(0.9, a * 0.09);
    const r = b / Math.SQRT2;
    const nx = Math.ceil(c.width / b) + 1;
    const ny = Math.ceil(c.height / b) + 1;
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        circle(ctx, (i + 0.5) * b, (j + 0.5) * b, r);
        ctx.stroke();
      }
    }
    return { c, b };
  }

  function paintBand(W) {
    const c = layer(Math.max(8, W * 0.5), 1);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, 'rgba(232,222,198,0)');
    g.addColorStop(0.5, 'rgba(232,222,198,0.34)');
    g.addColorStop(1, 'rgba(232,222,198,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, 1);
    return c;
  }

  function paintShade(W, H) {
    const c = layer(W, H);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(10,16,30,0)');
    g.addColorStop(1, 'rgba(10,16,30,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return c;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const a = Math.max(8, H / 5.5);
    state.W = W;
    state.H = H;
    state.a = a;
    state.cloth = paintCloth(W, H, a);
    const gold = paintGoldLayer(W, H, a);
    state.gold = gold.c;
    state.goldB = gold.b;
    state.band = paintBand(W);
    state.shade = paintShade(W, H);
    state.sh = Math.max(2, Math.ceil(H / STRIPS));
  }

  function wrap(v, m) {
    return ((v % m) + m) % m;
  }

  function draw(ctx, t, dt, api) {
    const { sway, shine } = api.props;
    const { W, H, a, sh } = state;
    const b = state.goldB;
    const amp = a * 0.2 * sway;
    const span = W + state.band.width;
    const bandX = wrap(t * W * 0.03, span) - state.band.width;
    for (let y = 0; y < H; y += sh) {
      const h = Math.min(sh, H - y);
      const w1 = Math.sin(y * 0.03 + t * 0.55) + 0.5 * Math.sin(y * 0.07 - t * 0.37);
      const sx = a + wrap(w1 * amp, a);
      ctx.globalAlpha = 1;
      ctx.drawImage(state.cloth, sx, y + a, W, h, 0, y, W, h);
      const w2 = Math.sin(y * 0.06 - t * 0.43 + 1.7) + 0.4 * Math.sin(y * 0.15 + t * 0.3);
      ctx.globalAlpha = 0.25;
      ctx.drawImage(state.gold, b + wrap(w2 * amp * 1.3 + t * a * 0.1, b), y + b, W, h, 0, y, W, h);
      ctx.globalAlpha = Math.min(1, shine * 0.8);
      ctx.drawImage(state.band, 0, 0, state.band.width, 1, bandX + y * 0.35, y, state.band.width, h);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(state.shade, 0, 0);
  }

  Kasuri.run({
    defaults: { sway: 1, shine: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
