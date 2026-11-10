/*
 * 切子 Kiriko — Edo kiriko cut glass seen from above on a dark table: a plate cut with
 * the hemp-leaf lattice and fan rim, and two tumblers with star bases. A dim and a lit copy
 * are baked once; a soft slanted band of the lit copy slides across, so the cuts catch light
 * in turn and a pool of blue light drifts over the wood.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const BANDS = 12;
  const state = {};

  const WOOD = ['#33271f', '#3b2d23', '#2b2019'];
  const DIM = {
    wood: '#4a3526', glass: '#27408a', clear: '#4f6a96', cut: '#9aa9c4', rim: '#6d7f9e',
    shade: '#141c38', pool: 'rgba(40,64,120,0.30)', star: '#7f8fb0',
  };
  const LIT = {
    wood: '#6a4a30', glass: '#4a68a8', clear: '#cfd8e2', cut: '#f2ead2', rim: '#e6ecf2',
    shade: '#2a3a6a', pool: 'rgba(90,130,200,0.45)', star: '#f0e4be',
  };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, TAU);
  }

  function table(ctx, g, rand) {
    ctx.fillStyle = WOOD[0];
    ctx.fillRect(0, 0, g.W, g.H);
    for (let y = 0; y < g.H; y += 1) {
      ctx.fillStyle = WOOD[1 + ((rand() * 2) | 0)];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y, g.W, 1 + (rand() < 0.3 ? 1 : 0));
    }
    ctx.globalAlpha = 1;
  }

  function grain(ctx, g, pal, rand) {
    ctx.strokeStyle = pal.wood;
    ctx.lineWidth = Math.max(0.6, g.u * 0.12);
    for (let i = 0; i < 40; i++) {
      const y = rand() * g.H;
      const x = rand() * g.W;
      const len = g.W * (0.15 + rand() * 0.4);
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.3, y + g.u * 0.4, x + len * 0.7, y - g.u * 0.4, x + len, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // hemp-leaf cut: hexagon with spokes from the centre to each corner
  function hexagram(ctx, x, y, r) {
    r *= 1.55;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = TAU * i / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      ctx.moveTo(x, y);
      ctx.lineTo(px, py);
      ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function lattice(ctx, x, y, R, r, pal, lw) {
    ctx.strokeStyle = pal.cut;
    ctx.lineWidth = lw;
    const dx = r * Math.sqrt(3);
    const dy = r * 1.5;
    const n = Math.ceil(R / dy) + 1;
    for (let row = -n; row <= n; row++) {
      for (let col = -n; col <= n; col++) {
        const px = x + col * dx + (row & 1 ? dx / 2 : 0);
        const py = y + row * dy;
        if (Math.hypot(px - x, py - y) < R + r) hexagram(ctx, px, py, r * 0.62);
      }
    }
  }

  function fans(ctx, x, y, r0, r1, n, pal, lw) {
    ctx.strokeStyle = pal.cut;
    ctx.lineWidth = lw;
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n;
      const b = a + TAU / n * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(b) * r1, y + Math.sin(b) * r1);
      ctx.lineTo(x + Math.cos(a + TAU / n) * r0, y + Math.sin(a + TAU / n) * r0);
      ctx.stroke();
    }
  }

  function star(ctx, x, y, r, pal, n, lw) {
    ctx.strokeStyle = pal.star;
    ctx.lineWidth = lw;
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
    for (let k = 1; k <= 2; k++) {
      disc(ctx, x, y, r * k / 3);
      ctx.stroke();
    }
  }

  function plate(ctx, g, pal) {
    const { x, y, R } = g.plate;
    const lw = Math.max(0.8, g.u * 0.16);
    // shade and blue pool thrown on the table
    ctx.fillStyle = pal.shade;
    ctx.globalAlpha = 0.7;
    disc(ctx, x + R * 0.16, y + R * 0.2, R * 1.04);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.pool;
    disc(ctx, x + R * 0.34, y + R * 0.4, R * 0.95);
    ctx.fill();
    // indigo flashed rim, clear well
    ctx.fillStyle = pal.glass;
    disc(ctx, x, y, R);
    ctx.fill();
    ctx.fillStyle = pal.rim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = lw * 2;
    ctx.strokeStyle = pal.rim;
    disc(ctx, x, y, R * 0.985);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.clear;
    disc(ctx, x, y, R * 0.7);
    ctx.fill();
    ctx.strokeStyle = pal.cut;
    ctx.lineWidth = lw * 1.3;
    disc(ctx, x, y, R * 0.7);
    ctx.stroke();
    fans(ctx, x, y, R * 0.72, R * 0.97, 36, pal, lw);
    ctx.save();
    disc(ctx, x, y, R * 0.68);
    ctx.clip();
    lattice(ctx, x, y, R * 0.7, g.cut, pal, lw);
    ctx.restore();
    star(ctx, x, y, R * 0.12, pal, 8, lw);
  }

  function tumbler(ctx, g, pal, t) {
    const { x, y, R } = t;
    const lw = Math.max(0.8, g.u * 0.14);
    ctx.fillStyle = pal.shade;
    ctx.globalAlpha = 0.7;
    disc(ctx, x + R * 0.2, y + R * 0.26, R * 1.04);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.pool;
    disc(ctx, x + R * 0.45, y + R * 0.55, R * 0.9);
    ctx.fill();
    ctx.fillStyle = pal.glass;
    disc(ctx, x, y, R);
    ctx.fill();
    ctx.fillStyle = pal.clear;
    disc(ctx, x, y, R * 0.76);
    ctx.fill();
    ctx.strokeStyle = pal.rim;
    ctx.lineWidth = lw * 1.4;
    disc(ctx, x, y, R * 0.76);
    ctx.stroke();
    disc(ctx, x, y, R);
    ctx.stroke();
    ctx.save();
    disc(ctx, x, y, R * 0.74);
    ctx.clip();
    star(ctx, x, y, R * 0.74, pal, 16, lw);
    ctx.restore();
    fans(ctx, x, y, R * 0.78, R * 0.97, 24, pal, lw);
  }

  function paint(ctx, g, pal, rand) {
    plate(ctx, g, pal);
    g.tumblers.forEach((t) => tumbler(ctx, g, pal, t));
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const u = H / 100;
    const m = Math.min(1, W / (u * 150));
    const R = Math.min(H * 0.36, W * 0.24);
    const g = {
      W, H, u: u * m,
      cut: Math.max(3, u * 7 * (api.props.facets || 1)),
      plate: { x: W * 0.38, y: H * 0.52, R },
      tumblers: [
        { x: W * 0.72, y: H * 0.3, R: R * 0.42 },
        { x: W * 0.78, y: H * 0.72, R: R * 0.36 },
      ],
    };
    state.g = g;
    state.facets = api.props.facets;
    const rand = K.rng(api.seed);
    state.dim = layer(W, H);
    state.lit = layer(W, H);
    const dc = state.dim.getContext('2d');
    table(dc, g, rand);
    grain(dc, g, DIM, K.rng(api.seed + 3));
    paint(dc, g, DIM, rand);
    const lc = state.lit.getContext('2d');
    lc.fillStyle = '#000';
    lc.fillRect(0, 0, W, H);
    grain(lc, g, LIT, K.rng(api.seed + 3));
    paint(lc, g, LIT, rand);
  }

  function draw(ctx, t, dt, api) {
    if (api.props.facets !== state.facets) setup(ctx, api);
    const g = state.g;
    const shine = api.props.shine;
    ctx.drawImage(state.dim, 0, 0);
    if (shine <= 0) return;
    const span = g.W + g.H * 0.6;
    const width = g.W * 0.34;
    const pos = ((t * 0.04) % 1.5 - 0.25) * span;
    const slant = g.H * 0.6;
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
      ctx.globalAlpha = Math.min(1, a * a * 0.85 * shine);
      ctx.drawImage(state.lit, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { shine: 1, facets: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
