/*
 * 友禅 Yuzen — bands of dyed silk drifting like cloth in water.
 *
 * Each band is one baked strip of pattern: chrysanthemums and flowing stream lines in
 * indigo, vermilion, washi and gold. Every frame the strip is copied in narrow slices
 * that rise and fall with a slow wave, with a little light and shade where the cloth
 * folds. The strips tile sideways so they can slide without a seam.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SLICES = 56;
  const INK = '#141a30';
  const WASHI = '#e3dcc6';
  const GOLD = '#c9a24a';
  const VERMILION = '#b8432b';
  const MOSS = '#5d6c42';
  const INDIGO = ['#1c2650', '#26346a', '#33448a'];

  // ground, flower, flower centre, stream line, leaf
  const BANDS = [
    { ground: INDIGO[0], petal: WASHI, heart: GOLD, line: INDIGO[2], leaf: MOSS, y: 0.1, v: 3.2, ph: 0.4 },
    { ground: WASHI, petal: VERMILION, heart: GOLD, line: INDIGO[1], leaf: MOSS, y: 0.34, v: -2.6, ph: 2.1 },
    { ground: VERMILION, petal: WASHI, heart: GOLD, line: '#8e2f1e', leaf: INDIGO[0], y: 0.58, v: 3.6, ph: 3.7 },
    { ground: INDIGO[1], petal: GOLD, heart: VERMILION, line: INDIGO[2], leaf: MOSS, y: 0.82, v: -3, ph: 5.2 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const bh = Math.round(Math.min(34 * U, W * 0.3));
    const P = Math.round(Math.min(48 * U, W * 0.5));
    return { W, H, U, bh, P, sw: Math.ceil(W / SLICES) + 1 };
  }

  // ---- motifs --------------------------------------------------------------

  function petals(ctx, x, y, r, count, wide, fill, edge, lw) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = lw;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.4, r * wide, a, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Chrysanthemum: two rings of long petals around a small round heart.
  function kiku(ctx, x, y, r, band, U) {
    const lw = Math.max(1, U * 0.3);
    petals(ctx, x, y, r, 18, 0.15, band.petal, band.ground, lw);
    petals(ctx, x, y, r * 0.66, 12, 0.17, band.petal, band.line, lw);
    ctx.fillStyle = band.heart;
    ctx.strokeStyle = band.ground;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function leaf(ctx, x, y, len, ang, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5, len * 0.5, len * 0.18, ang, 0, TAU);
    ctx.fill();
  }

  // Flowing stream: parallel waves whose period is the strip period so it tiles.
  function stream(ctx, g, w, y0, amp, band) {
    ctx.strokeStyle = band.line;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.lineWidth = Math.max(1, g.U * (0.9 - k * 0.12));
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const yy = y0 + k * g.U * 2.2 + Math.sin((x / g.P) * TAU + k * 0.5) * amp;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  }

  function paintStrip(g, band, seed) {
    const w = g.W + g.P + g.sw * 2;
    const c = layer(w, g.bh);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    const U = g.U;
    ctx.fillStyle = band.ground;
    ctx.fillRect(0, 0, w, g.bh);
    // faint woven grain
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < g.bh; y += 3) ctx.fillRect(0, y, w, 1);
    stream(ctx, g, w, g.bh * 0.08 + U, U * 1.4, band);
    stream(ctx, g, w, g.bh * 0.78, U * 1.4, band);
    for (let x0 = -g.P; x0 < w; x0 += g.P) {
      leaf(ctx, x0 + g.P * 0.08, g.bh * 0.62, U * 9, -0.5, band.leaf);
      leaf(ctx, x0 + g.P * 0.42, g.bh * 0.34, U * 8, 3.6, band.leaf);
      leaf(ctx, x0 + g.P * 0.9, g.bh * 0.5, U * 7, 0.6, band.leaf);
      kiku(ctx, x0 + g.P * 0.25, g.bh * 0.4, U * 8.5, band, U);
      kiku(ctx, x0 + g.P * 0.72, g.bh * 0.62, U * 6.2, band, U);
      ctx.fillStyle = band.heart;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x0 + g.P * (0.45 + rand() * 0.4), g.bh * (0.25 + rand() * 0.5), U * 0.6, 0, TAU);
        ctx.fill();
      }
    }
    // gold thread along both selvedges
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, 0, w, Math.max(1, U * 0.7));
    ctx.fillRect(0, g.bh - Math.max(1, U * 0.7), w, Math.max(1, U * 0.7));
    return c;
  }

  function paintBackdrop(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = 'rgba(38,52,106,0.35)';
    for (let y = 0; y < g.H; y += 4) ctx.fillRect(0, y, g.W, 1);
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.back = paintBackdrop(g);
    state.strips = BANDS.map((b, i) => paintStrip(g, b, api.seed + i * 17));
  }

  function drawBand(ctx, g, band, strip, t, sway, drift) {
    const base = g.H * band.y;
    const amp = g.U * 5 * sway;
    const off = (((t * band.v * g.U * drift) % g.P) + g.P) % g.P;
    const k1 = 0.0095 / g.U * 1.6;
    const k2 = 0.021 / g.U * 1.6;
    const prev = { y: 0 };
    for (let i = 0; i < SLICES; i++) {
      const x = i * (g.W / SLICES);
      const ph = band.ph;
      const y = base + amp * (Math.sin(x * k1 + t * 0.55 + ph) + 0.45 * Math.sin(x * k2 - t * 0.8 + ph * 2));
      const stretch = 1 + 0.06 * sway * Math.sin(x * k1 * 1.3 - t * 0.5 + ph);
      const h = g.bh * stretch;
      const dy = i ? y - prev.y : 0;
      prev.y = y;
      ctx.fillStyle = 'rgba(6,8,20,0.38)';
      ctx.fillRect(x, y + h - g.U * 0.5, g.sw, g.U * 2.4);
      ctx.drawImage(strip, x + off, 0, g.sw, g.bh, x, y, g.sw, h);
      const s = Math.max(-1, Math.min(1, dy / (g.U * 1.2)));
      if (s > 0.02) {
        ctx.fillStyle = 'rgba(8,10,28,' + (s * 0.3).toFixed(3) + ')';
        ctx.fillRect(x, y, g.sw, h);
      } else if (s < -0.02) {
        ctx.fillStyle = 'rgba(240,230,200,' + (-s * 0.16).toFixed(3) + ')';
        ctx.fillRect(x, y, g.sw, h);
      }
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, drift } = api.props;
    ctx.drawImage(state.back, 0, 0);
    for (let i = 0; i < BANDS.length; i++) drawBand(ctx, g, BANDS[i], state.strips[i], t, sway, drift);
  }

  Kasuri.run({
    defaults: { sway: 1, drift: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
