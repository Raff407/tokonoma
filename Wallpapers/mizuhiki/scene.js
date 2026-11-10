/*
 * 水引 Mizuhiki — gift cords in red, white and gold looping over washi paper.
 *
 * Paper and its fibres are baked once. Each cord is a slow looping curve drawn as
 * a shadow, a base stroke and a dashed second colour whose offset runs along the
 * cord, which gives the twisted two-colour look. The loop shapes drift a little so
 * the cords seem to tie and untie.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const STEPS = 240;
  const PAPER = ['#e8dfc8', '#e2d8bf', '#ece4d0', '#ddd2b6'];
  const CHAINS = [
    { y: 0.3, loops: 3, round: 1.8, slide: 0.5, dir: 1, ph: 0 },
    { y: 0.7, loops: 3, round: 1.8, slide: 0.5, dir: -1, ph: 2 },
    { y: 0.5, loops: 2, round: 2, slide: 0.35, dir: 1, ph: 4 },
  ];
  const ONE = { y: 0.5, loops: 3, round: 1.8, slide: 0.5, dir: 1, ph: 0 };
  const CORDS = [
    { off: -1, base: '#b5301f', twist: '#ece4d0', flow: 1 },
    { off: 0, base: '#ece4d0', twist: '#b5301f', flow: -1, light: true },
    { off: 1, base: '#cfa94c', twist: '#a38234', flow: 1, gold: true },
  ];
  const state = { dash: [0, 0], none: [] };

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
    return { W, H, U, cx: W * 0.5, cy: H * 0.5, size: Math.min(W * 0.5, H * 0.95) };
  }

  function paintPaper(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = PAPER.map(K.parseColor);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = K.fbm(x / (g.U * 14), y / (g.U * 14), 3, 7);
        const ink = inks[Math.min(3, Math.floor(n * 4 + rand() * 0.6))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(150,130,96,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < g.W * g.H / 260; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const a = (rand() - 0.5) * 1.2;
      const l = g.U * (1 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    return c;
  }

  // One point on a drifting looping curve; writes into out to avoid allocation.
  // A looping chain: a trochoid whose loops slide along while the chain breathes.
  function fillChain(g, ch, t) {
    const span = ch.loops * TAU;
    const a = (g.W * 1.25) / span;
    const b = a * ch.round;
    const ph = t * ch.slide * ch.dir;
    const wave = g.H * 0.035;
    const P = state.px;
    const Q = state.py;
    const NX = state.nx;
    const NY = state.ny;
    for (let i = 0; i <= STEPS; i++) {
      const th = (i / STEPS - 0.5) * span;
      const u = th + ph;
      const sn = Math.sin(u);
      const cs = Math.cos(u);
      const x = g.cx + ch.dir * (a * th - b * sn);
      const y = ch.y * g.H + b * cs * 0.9 + Math.sin(th * 0.35 + t * 0.4 + ch.ph) * wave;
      const dx = ch.dir * (a - b * cs);
      const dy = -b * sn * 0.9;
      const l = Math.hypot(dx, dy) || 1;
      P[i] = x;
      Q[i] = y;
      NX[i] = -dy / l;
      NY[i] = dx / l;
    }
  }

  function traceOffset(ctx, off, dx, dy) {
    const P = state.px;
    const Q = state.py;
    const NX = state.nx;
    const NY = state.ny;
    ctx.moveTo(P[0] + NX[0] * off + dx, Q[0] + NY[0] * off + dy);
    for (let i = 1; i <= STEPS; i++) ctx.lineTo(P[i] + NX[i] * off + dx, Q[i] + NY[i] * off + dy);
  }

  function drawCord(ctx, g, c, t) {
    const w = g.U * 2.7;
    const off = c.off * w * 1.05;
    ctx.setLineDash(state.none);
    ctx.lineWidth = w * 1.1;
    ctx.strokeStyle = 'rgba(70,52,34,0.24)';
    ctx.beginPath();
    traceOffset(ctx, off, g.U * 0.6, g.U * 0.8);
    ctx.stroke();

    ctx.lineWidth = w;
    ctx.strokeStyle = c.base;
    ctx.beginPath();
    traceOffset(ctx, off, 0, 0);
    ctx.stroke();

    const seg = g.U * 1.7;
    state.dash[0] = seg;
    state.dash[1] = seg;
    ctx.setLineDash(state.dash);
    ctx.lineDashOffset = -t * g.U * 5 * c.flow;
    ctx.lineWidth = w * 0.4;
    ctx.strokeStyle = c.twist;
    ctx.beginPath();
    traceOffset(ctx, off, 0, 0);
    ctx.stroke();
    ctx.setLineDash(state.none);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.px = new Float32Array(STEPS + 1);
    state.py = new Float32Array(STEPS + 1);
    state.nx = new Float32Array(STEPS + 1);
    state.ny = new Float32Array(STEPS + 1);
    state.paper = paintPaper(g, K.rng(api.seed));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { chains, gold } = api.props;
    const n = Math.max(1, Math.min(CHAINS.length, Math.round(chains)));
    ctx.drawImage(state.paper, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < n; k++) {
      fillChain(g, n === 1 ? ONE : CHAINS[k], t);
      for (let i = 0; i < CORDS.length; i++) {
        const c = CORDS[i];
        if (c.gold) {
          if (gold <= 0.02) continue;
          ctx.globalAlpha = Math.min(1, gold);
        }
        drawCord(ctx, g, c, t);
        ctx.globalAlpha = 1;
      }
    }
  }

  Kasuri.run({
    defaults: { chains: 2, gold: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
