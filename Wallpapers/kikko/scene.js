/*
 * 亀甲 Kikko — the turtle-shell hexagon lattice, gold thread on indigo, each cell
 * holding a small blossom. A dim and a lit copy are baked once; a soft diagonal band
 * of the lit copy rolls across, like light moving over woven silk.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const BANDS = 14;
  const state = {};

  const INDIGO = ['#1d2742', '#222d4c', '#1a2340'];
  const DIM = { line: '#8a7338', flower: '#6e5c30', petal: '#7a3a2c' };
  const LIT = { line: '#f0d27a', flower: '#e6c259', petal: '#d6452c' };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hex(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = TAU * i / 6 + TAU / 12;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function blossom(ctx, x, y, r, pal) {
    ctx.fillStyle = pal.petal;
    for (let i = 0; i < 5; i++) {
      const a = TAU * i / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.34, r * 0.24, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = pal.flower;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.8, r * 0.2), 0, TAU);
    ctx.fill();
  }

  function lattice(ctx, g, pal, withGround, rand) {
    if (withGround) {
      ctx.fillStyle = INDIGO[0];
      ctx.fillRect(0, 0, g.W, g.H);
    }
    const r = g.r;
    const dx = r * Math.sqrt(3);
    const dy = r * 1.5;
    ctx.lineJoin = 'round';
    for (let row = -1; row * dy < g.H + r * 2; row++) {
      for (let col = -1; col * dx < g.W + dx; col++) {
        const x = col * dx + (row & 1 ? dx / 2 : 0);
        const y = row * dy;
        if (withGround) {
          ctx.fillStyle = INDIGO[1 + ((rand() * 2) | 0)];
          hex(ctx, x, y, r * 0.92);
          ctx.fill();
        }
        ctx.strokeStyle = pal.line;
        ctx.lineWidth = Math.max(1, r * 0.1);
        hex(ctx, x, y, r * 0.94);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.8, r * 0.05);
        hex(ctx, x, y, r * 0.66);
        ctx.stroke();
        blossom(ctx, x, y, r * 0.4, pal);
      }
    }
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const r = Math.max(4, H / 100 * 6.5 * (api.props.scale || 1));
    const g = { W, H, r };
    const rand = K.rng(api.seed);
    state.g = g;
    state.scale = api.props.scale;
    state.dim = layer(W, H);
    state.lit = layer(W, H);
    lattice(state.dim.getContext('2d'), g, DIM, true, rand);
    const lc = state.lit.getContext('2d');
    lattice(lc, g, LIT, false, rand);
  }

  function draw(ctx, t, dt, api) {
    if (api.props.scale !== state.scale) setup(ctx, api);
    const g = state.g;
    const sheen = api.props.sheen;
    ctx.drawImage(state.dim, 0, 0);
    if (sheen <= 0) return;
    const span = g.W + g.H * 0.5;
    const width = g.W * 0.32;
    const pos = ((t * 0.045) % 1.4 - 0.2) * span;
    const slant = g.H * 0.5;
    const bw = width / BANDS;
    for (let i = 0; i < BANDS; i++) {
      const f = (i + 0.5) / BANDS;
      const a = Math.sin(f * Math.PI);
      const x = pos + i * bw;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + slant, 0);
      ctx.lineTo(x + slant + bw + 1, 0);
      ctx.lineTo(x + bw + 1, g.H);
      ctx.lineTo(x, g.H);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = Math.min(1, a * a * 0.9 * sheen);
      ctx.drawImage(state.lit, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { sheen: 1, scale: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
