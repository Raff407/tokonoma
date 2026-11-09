/*
 * 鱗 Uroko — the triangle scale pattern of Japanese cloth and lacquer.
 *
 * Ink triangles sit on washi in offset rows. Three baked layers hold the same
 * scales in different tones; the tinted ones fade in and out slowly for the colour
 * drift. A sheen layer is masked by two soft diagonal bands that sweep across.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const WASHI = '#e8e0cc';
  const INK = '#20232b';
  const TONES = {
    base: ['#20232b', '#2a2f3a', '#1c1f27'],
    indigo: ['#27406a', '#2f4d7c', '#1f3558'],
    moss: ['#4a5e3c', '#586d46', '#3c4e31'],
    vermilion: ['#8a3a2b', '#a14631', '#74301f'],
  };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function scalesLayer(g, rand, tones, bg) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, g.W, g.H);
    }
    const s = g.s;
    const h = s * 0.866;
    const rows = Math.ceil(g.H / h) + 1;
    const cols = Math.ceil(g.W / s) + 2;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * s * 0.5;
      for (let i = -1; i < cols; i++) {
        const x = i * s + off;
        const y = r * h;
        const k = Math.floor(rand() * tones.length);
        ctx.fillStyle = tones[k];
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y);
        ctx.lineTo(x + s - s * 0.04, y + h - 0.5);
        ctx.lineTo(x + s * 0.04, y + h - 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    return c;
  }

  function sheenLayer(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.s;
    const h = s * 0.866;
    const rows = Math.ceil(g.H / h) + 1;
    const cols = Math.ceil(g.W / s) + 2;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * s * 0.5;
      for (let i = -1; i < cols; i++) {
        const x = i * s + off;
        const y = r * h;
        ctx.fillStyle = 'rgba(244,238,220,' + (0.55 + rand() * 0.4).toFixed(2) + ')';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y + h * 0.2);
        ctx.lineTo(x + s * 0.8, y + h * 0.9);
        ctx.lineTo(x + s * 0.2, y + h * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }
    return c;
  }

  function bandStrip(len, thick) {
    const c = layer(len, thick);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, len, thick);
    return c;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const s = Math.max(6, (H / 12) / (api.props.scales || 1));
    const g = { W, H, s, diag: Math.hypot(W, H) };
    const rand = K.rng(api.seed);
    state.g = g;
    state.base = scalesLayer(g, rand, TONES.base, WASHI);
    state.indigo = scalesLayer(g, rand, TONES.indigo, null);
    state.moss = scalesLayer(g, rand, TONES.moss, null);
    state.vermilion = scalesLayer(g, rand, TONES.vermilion, null);
    state.sheen = sheenLayer(g, rand);
    state.scratch = layer(g.W, g.H);
    state.mask = layer(g.W, g.H);
    state.band = bandStrip(Math.ceil(g.diag * 0.35), Math.ceil(g.diag));
    state.scaleKey = api.props.scales;
  }

  function wave(t, period, phase) {
    return Math.max(0, Math.sin(t * 6.2831853 / period + phase));
  }

  function drawBand(sx, g, pos, alpha) {
    // a band crossing the frame on a slant, centred on pos along the width
    const bw = state.band.width;
    sx.save();
    sx.globalAlpha = alpha;
    sx.translate(pos, g.H * 0.5);
    sx.rotate(0.45);
    sx.drawImage(state.band, -bw / 2, -g.diag / 2);
    sx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { shimmer, drift } = api.props;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(state.base, 0, 0);

    const d = Math.min(2, drift);
    ctx.globalAlpha = Math.min(1, 0.55 * d * wave(t, 90, 0));
    ctx.drawImage(state.indigo, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.55 * d * wave(t, 90, 2.1));
    ctx.drawImage(state.moss, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.5 * d * wave(t, 90, 4.2));
    ctx.drawImage(state.vermilion, 0, 0);

    const sx = state.scratch.getContext('2d');
    sx.globalCompositeOperation = 'source-over';
    sx.globalAlpha = 1;
    sx.clearRect(0, 0, g.W, g.H);
    sx.drawImage(state.sheen, 0, 0);
    sx.globalCompositeOperation = 'destination-in';
    const span = g.W + g.H * 0.6;
    const p1 = ((t * g.W * 0.045) % span) - g.H * 0.3;
    const p2 = ((t * g.W * 0.045 + span * 0.55) % span) - g.H * 0.3;
    // destination-in keeps only what the mask covers, so build the mask additively
    const mask = state.mask;
    const mx = mask.getContext('2d');
    mx.globalCompositeOperation = 'source-over';
    mx.clearRect(0, 0, g.W, g.H);
    drawBand(mx, g, p1, 1);
    drawBand(mx, g, p2, 0.7);
    sx.drawImage(mask, 0, 0);
    sx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, 0.8 * shimmer);
    ctx.drawImage(state.scratch, 0, 0);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { shimmer: 1, drift: 1, scales: 1, mode: 'glyph', ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
