/*
 * 家紋 Kamon — a field of family crests in ink and gold on indigo.
 *
 * Four crest designs are baked once as round sprites, each in a calm and a bright
 * version. Every frame turns the sprites a little and lays the bright one over the
 * calm one with a weight that follows a slow wave crossing the grid.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const INDIGO = ['#1d2a4a', '#232f52', '#18233f'];
  const INK = '#15151c';
  const GOLD = '#c9a24a';
  const GOLD_BRIGHT = '#f0d68a';
  const WASHI = '#e6dcc3';
  const ROWS = 4.6;
  const DESIGNS = 4;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.3, r), 0, TAU);
    ctx.fill();
  }

  // plum: five round petals around a seed
  function plum(ctx, r, gold) {
    ctx.fillStyle = gold;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      disc(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.25);
    }
    ctx.fillStyle = INK;
    disc(ctx, 0, 0, r * 0.12);
    ctx.fillStyle = gold;
    disc(ctx, 0, 0, r * 0.07);
  }

  // three comma shapes chasing each other
  function tomoe(ctx, r, gold) {
    ctx.fillStyle = gold;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * TAU);
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r * 0.22, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.22, -r * 0.3);
      ctx.bezierCurveTo(r * 0.3, -r * 0.05, r * 0.2, r * 0.12, -r * 0.05, r * 0.2);
      ctx.bezierCurveTo(r * 0.12, r * 0.02, r * 0.1, -r * 0.1, r * 0.0, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // chrysanthemum: ring of petals with a round heart
  function kiku(ctx, r, gold) {
    ctx.fillStyle = gold;
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((i / 16) * TAU);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.5, r * 0.07, r * 0.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    disc(ctx, 0, 0, r * 0.26);
    ctx.fillStyle = INK;
    disc(ctx, 0, 0, r * 0.17);
    ctx.fillStyle = gold;
    disc(ctx, 0, 0, r * 0.08);
  }

  // bellflower: five pointed petals
  function kikyo(ctx, r, gold) {
    ctx.fillStyle = gold;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.3, -r * 0.3, 0, -r * 0.66);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = INK;
    disc(ctx, 0, 0, r * 0.1);
  }

  const MOTIFS = [plum, tomoe, kiku, kikyo];

  function crest(size, design, bright) {
    const S = size * 2;
    const c = layer(S, S);
    const ctx = c.getContext('2d');
    const r = S / 2 - 1;
    const gold = bright ? GOLD_BRIGHT : GOLD;
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = gold;
    disc(ctx, 0, 0, r);
    ctx.fillStyle = INK;
    disc(ctx, 0, 0, r * 0.94);
    ctx.strokeStyle = gold;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.stroke();
    MOTIFS[design](ctx, r * 0.95, gold);
    if (bright) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = WASHI;
      disc(ctx, 0, 0, r * 0.94);
    }
    return c;
  }

  function paintCloth(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = INDIGO[0];
    ctx.fillRect(0, 0, g.W, g.H);
    for (let i = 0; i < g.W * g.H * 0.05; i++) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = INDIGO[1 + (rand() < 0.5 ? 1 : 0)];
      ctx.fillRect(rand() * g.W, rand() * g.H, 1 + rand() * g.U * 2, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const rand = K.rng(api.seed);
    const g = { W, H, U: H / 100 };
    const D = H / ROWS;
    const stepX = D * 1.12;
    const stepY = D * 1.02;
    const cols = Math.ceil(W / stepX) + 2;
    const rows = Math.ceil(H / stepY) + 2;
    const size = Math.round(D * 0.92);
    const calm = [];
    const bright = [];
    for (let d = 0; d < DESIGNS; d++) {
      calm.push(crest(size, d, false));
      bright.push(crest(size, d, true));
    }
    const items = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - 0.5 + (r % 2) * 0.5) * stepX + (W - (cols - 2) * stepX) / 2;
        const y = (r - 0.5) * stepY + (H - (rows - 2) * stepY) / 2;
        const design = (c + r * 3 + (r >> 1)) % DESIGNS;
        items.push({
          x, y, d: design,
          dir: (r + c) % 2 ? 1 : -1,
          rate: 0.18 + rand() * 0.1,
          phase: rand() * TAU,
          order: c * 0.6 + r * 0.9,
        });
      }
    }
    state.g = g;
    state.size = size;
    state.cloth = paintCloth(g, rand);
    state.calm = calm;
    state.bright = bright;
    state.items = items;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const half = state.size / 2;
    const spin = api.props.spin;
    const shim = api.props.shimmer;
    ctx.drawImage(state.cloth, 0, 0);
    const items = state.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const a = it.phase + it.dir * it.rate * spin * t;
      const w = Math.sin(t * 0.7 - it.order * 0.55);
      const lit = w > 0.35 ? (w - 0.35) / 0.65 : 0;
      const breathe = 1 + 0.015 * Math.sin(t * 0.5 + it.phase);
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(a);
      ctx.scale(breathe, breathe);
      ctx.drawImage(state.calm[it.d], -half, -half, state.size, state.size);
      if (lit > 0 && shim > 0) {
        ctx.globalAlpha = Math.min(1, lit * shim);
        ctx.drawImage(state.bright[it.d], -half, -half, state.size, state.size);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  Kasuri.run({
    defaults: { shimmer: 1, spin: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
